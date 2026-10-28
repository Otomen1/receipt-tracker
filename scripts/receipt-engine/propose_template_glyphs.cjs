// Training-only alignment. Source words/receipt images stay in ignored storage.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..');
const {decodeReceiptImage}=require(path.join(root,'.receipt-engine-build/lib/receipt-input/image'));
const {preprocess}=require(path.join(root,'.receipt-engine-build/lib/receipt-engine/preprocess'));
const {segment}=require(path.join(root,'.receipt-engine-build/lib/receipt-engine/segment'));
const {IDENTITY}=require(path.join(root,'.receipt-engine-build/lib/receipt-engine/geometry'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
  const body=fs.readFileSync(path.join(root,'datasets/receipt-engine/manifests/phase4-template-parents.jsonl'),'utf8');
  const parents=body.trim().split('\n').map(JSON.parse),out=path.join(root,'datasets/receipt-engine/local/glyph-proposals');
  fs.mkdirSync(out,{recursive:true});const proposals=[];
  for(const [parentIndex,parent]of parents.entries()){
    if(parent.split!=='development'||parent.original_split!=='train'||parent.purpose!=='template_training')throw Error('Non-training parent');
    const bytes=fs.readFileSync(path.join(root,parent.image_path)),annotationBytes=fs.readFileSync(path.join(root,parent.source_annotation));
    if(sha(bytes)!==parent.sha256||sha(annotationBytes)!==parent.source_annotation_sha256)throw Error('Changed source');
    const meta=await sharp(bytes,{limitInputPixels:40000000}).metadata();
    if(meta.orientation&&meta.orientation!==1)throw Error('Annotation coordinate rotation needs explicit handling');
    const prepared=await sharp(bytes,{limitInputPixels:40000000}).resize({width:1600,height:2400,fit:'inside',withoutEnlargement:true}).png().toBuffer();
    const image=await decodeReceiptImage(prepared),sx=image.width/meta.width,sy=image.height/meta.height;
    const page=preprocess(image,{deskew:false,autoPerspective:false}),annotation=JSON.parse(annotationBytes),candidates=[];
    for(let region=0;region<annotation.words.length;region++){
      const text=annotation.words[region],characters=[...text.replace(/\s/g,'')],box=annotation.bboxes[region];
      const x=Math.max(0,Math.floor(box[0]*sx)-2),y=Math.max(0,Math.floor(box[1]*sy)-2);
      const w=Math.min(page.width,Math.ceil(box[2]*sx)+2)-x,h=Math.min(page.height,Math.ceil(box[3]*sy)+2)-y;
      if(!/^[A-Z0-9][A-Z0-9 .,/:()&'\-]{1,19}$/.test(text)||characters.length<3||characters.length>16||h<10||h>80||w<20||w<=0)continue;
      const data=new Uint8Array(w*h*6);
      for(let row=0;row<h;row++)data.set(page.data.subarray((y+row)*page.width+x,(y+row)*page.width+x+w),(row+h*2)*w);
      const lines=segment({width:w,height:h*6,data,toInput:IDENTITY,operations:[]});
      if(lines.length!==1||lines[0].glyphs.length!==characters.length)continue;
      candidates.push({region,characters,source_box:box,crop_box:{x,y,width:w,height:h},line:lines[0]});
    }
    const selected=[],seen=new Set();let count=0;
    while(selected.length<6&&candidates.length){
      candidates.sort((a,b)=>new Set(b.characters.filter(c=>!seen.has(c))).size-new Set(a.characters.filter(c=>!seen.has(c))).size||a.region-b.region);
      const c=candidates.shift();if(count+c.characters.length>55)continue;
      selected.push(c);count+=c.characters.length;c.characters.forEach(x=>seen.add(x));
    }
    for(const c of selected){
      const id=`p${String(parentIndex).padStart(2,'0')}-r${String(c.region).padStart(3,'0')}`;
      for(const [i,glyph]of c.line.glyphs.entries()){
        const glyphId=`${id}-g${String(i).padStart(2,'0')}`,file=path.join(out,`${glyphId}.png`);
        const encoded=await sharp(Buffer.from(Uint8Array.from(glyph.ink,v=>v?0:255)),{raw:{width:glyph.box.width,height:glyph.box.height,channels:1}}).png().toBuffer();
        fs.writeFileSync(file,encoded);
        proposals.push({id:glyphId,parent_id:parent.id,source_region:c.region,source_region_box:c.source_box,
          source_glyph_box:{x:(c.crop_box.x+glyph.box.x)/sx,y:(c.crop_box.y+glyph.box.y-c.crop_box.height*2)/sy,width:glyph.box.width/sx,height:glyph.box.height/sy},
          proposed_character:c.characters[i],nominal_height:c.line.nominalHeight,training_scale:{x:sx,y:sy},
          proposal_path:path.relative(root,file),proposal_png_sha256:sha(encoded)});
      }
    }
    console.log(`${parentIndex+1}/${parents.length}: ${selected.length} words / ${count} glyph proposals`);
  }
  const file=path.join(out,'proposals.jsonl');fs.writeFileSync(file,proposals.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const files=['scripts/receipt-engine/propose_template_glyphs.cjs','lib/receipt-engine/preprocess.ts','lib/receipt-engine/segment.ts'];
  fs.writeFileSync(path.join(root,'datasets/receipt-engine/reports/phase4-glyph-proposals.json'),JSON.stringify({
    schema:'receipt-glyph-proposals/v2',parents:parents.length,glyphs:proposals.length,parent_manifest_sha256:sha(body),proposal_manifest_sha256:sha(fs.readFileSync(file)),
    generation_sha256:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),node:process.version,sharp_versions:sharp.versions,
    settings:{max_training_width:1600,max_training_height:2400,deskew:false,autoPerspective:false,max_words_per_parent:6,max_glyphs_per_parent:55},
    labels:'proposals_only_not_automatic_acceptance',source_word_context_published:false,inference_receives_annotations:false},null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
