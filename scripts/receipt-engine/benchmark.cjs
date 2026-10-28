// Development diagnostics only; each subprocess receives pixels/path, never GT.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),args=process.argv.slice(2);
const get=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalize=s=>String(s??'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
function edit(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}return prev[b.length];}
function decimalEqual(a,b){
  const parse=value=>{if(value==null||typeof value==='boolean')return null;const m=/^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));return m?{n:BigInt(m[1]+m[2]+(m[3]??'')),scale:(m[3]??'').length}:null;};
  const x=parse(a),y=parse(b);return !!x&&!!y&&x.n*10n**BigInt(y.scale)===y.n*10n**BigInt(x.scale);
}
function align(expected,actual){
  const dp=Array.from({length:expected.length+1},()=>Array(actual.length+1).fill(0)),step=dp.map(r=>r.map(()=>''));
  for(let i=1;i<=expected.length;i++){dp[i][0]=i;step[i][0]='miss';}for(let j=1;j<=actual.length;j++){dp[0][j]=j;step[0][j]='extra';}
  for(let i=1;i<=expected.length;i++)for(let j=1;j<=actual.length;j++){
    const a=normalize(expected[i-1].name),b=normalize(actual[j-1].name);
    const options=[[dp[i-1][j-1]+edit([...a],[...b])/Math.max(a.length,b.length,1),'match'],[dp[i-1][j]+1,'miss'],[dp[i][j-1]+1,'extra']].sort((a,b)=>a[0]-b[0]);
    [dp[i][j],step[i][j]]=options[0];
  }
  const pairs=[];let i=expected.length,j=actual.length;while(i||j){const s=step[i][j];if(s==='match')pairs.push([--i,--j]);else if(s==='miss')pairs.push([--i,null]);else pairs.push([null,--j]);}return pairs.reverse();
}
function score(row,prediction){
  const g=row.ground_truth,d=prediction?.data??{},fields={},items={};
  for(const key of ['merchant','receipt_date','total','currency','category','sst_amount','discount','payment_method'])if(g[key]!=null){
    const correct=['total','sst_amount','discount'].includes(key)?decimalEqual(g[key],d[key]):key==='receipt_date'?g[key]===d[key]:d[key]!=null&&normalize(g[key])===normalize(d[key]);
    fields[key]={correct:correct?1:0,total:1};
  }
  if(Array.isArray(g.items)){
    const actual=(prediction?.parsed?.items??[]).filter(i=>i.name.value!=null).map(i=>({name:i.name.value,quantity:i.quantity.value,price:i.unitPrice.value,line_amount:i.lineAmount.value}));
    for(const key of ['name','quantity','price','line_amount'])items[key]={correct:0,total:0};
    for(const [a,b]of align(g.items,actual))for(const key of Object.keys(items)){
      if(a!=null&&g.items[a][key]==null)continue;items[key].total++;
      if(a!=null&&b!=null&&(key==='name'?normalize(g.items[a][key])===normalize(actual[b][key]):decimalEqual(g.items[a][key],actual[b][key])))items[key].correct++;
    }
  }
  const profile=row.source==='sroie'?'sroie_uppercase_whitespace_regions_v1':'synthetic_strict_render_text_v1';
  const text=s=>row.source==='sroie'?String(s??'').normalize('NFC').toUpperCase().replace(/\s+/g,' ').trim():String(s??'').normalize('NFC').replace(/\r\n?/g,'\n');
  const expected=text(g.raw_text),actual=text(d.raw_text),aw=expected.trim()?expected.trim().split(/\s+/):[],bw=actual.trim()?actual.trim().split(/\s+/):[];
  const coveredItems=Array.isArray(g.items)&&g.items.every(i=>['name','quantity','price','line_amount'].every(k=>i[k]!=null));
  const complete=keys=>coveredItems&&keys.every(k=>g[k]!=null)?keys.every(k=>fields[k].correct===1)&&Object.values(items).every(v=>v.correct===v.total):null;
  return {id:row.id,source:row.source,variant:row.variant,status:prediction?'ok':'processing_error',fields,items,
    text:{profile,characters:[...expected].length,character_errors:edit([...expected],[...actual]),words:aw.length,word_errors:edit(aw,bw)},
    core_complete:complete(['merchant','receipt_date','total']),full_complete:complete(['merchant','receipt_date','total','currency','category','sst_amount','discount','payment_method']),
    review:prediction?.validation?.confidence!=='high',confidence:prediction?.validation?.confidence??'low',
    unknown_glyphs:prediction?.diagnostics?.unknownGlyphs??null,warnings:prediction?.validation?.warnings??['Processing failed'],measurement:prediction?.measurement??null};
}
function aggregate(scores){
  const fields={},items={},text={characters:0,character_errors:0,words:0,word_errors:0};
  for(const s of scores){for(const [source,dest]of[[s.fields,fields],[s.items,items]])for(const[k,v]of Object.entries(source)){dest[k]??={correct:0,total:0};dest[k].correct+=v.correct;dest[k].total+=v.total;}for(const k of Object.keys(text))text[k]+=s.text[k];}
  for(const group of [fields,items])for(const v of Object.values(group))v.accuracy=v.total?v.correct/v.total:null;
  const complete=key=>{const eligible=scores.filter(s=>s[key]!=null);return{eligible:eligible.length,correct:eligible.filter(s=>s[key]).length,accuracy:eligible.length?eligible.filter(s=>s[key]).length/eligible.length:null};};
  const perf=key=>{const v=scores.map(s=>s.measurement?.[key]).filter(Number.isFinite).sort((a,b)=>a-b);return{samples:v.length,p50:v.length?v[Math.ceil(v.length*.5)-1]:null,p95:v.length?v[Math.ceil(v.length*.95)-1]:null,max:v.length?v.at(-1):null};};
  return {receipts:scores.length,fields,items,text:{...text,CER:text.characters?text.character_errors/text.characters:null,WER:text.words?text.word_errors/text.words:null},core_complete:complete('core_complete'),full_complete:complete('full_complete'),review_rate:scores.length?scores.filter(s=>s.review).length/scores.length:null,processing_failures:scores.filter(s=>s.status!=='ok').length,performance:{wall_ms:perf('wall_ms'),cpu_ms:perf('cpu_ms'),peak_rss_kib:perf('peak_rss_kib')}};
}
function main(){
  const manifest=get('--manifest',null),output=get('--output',null),limit=Number(get('--limit','20'));
  if(!manifest||!output||!Number.isSafeInteger(limit)||limit<1)throw Error('Required: --manifest path --output path [--limit 20]');
  const body=fs.readFileSync(path.resolve(root,manifest),'utf8'),rows=body.trim().split('\n').filter(Boolean).map(JSON.parse);
  if(rows.some(r=>r.split!=='development'||['validation','test'].includes(r.original_split)))throw Error('Phase 4 runner permits development data only; held-out evaluation belongs to Phase 5.');
  const selected=rows.slice(0,limit);if(!selected.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Empty dataset or duplicate IDs');
  const scores=[],errors=[];
  const cache=path.join(root,'datasets/receipt-engine/local/runs',sha(body).slice(0,12));fs.mkdirSync(cache,{recursive:true});
  for(const [index,row]of selected.entries()){
    const image=path.resolve(root,row.image_path);if(sha(fs.readFileSync(image))!==row.sha256)throw Error(`Changed input image: ${row.id}`);
    const resultFile=path.join(cache,`${index}.json`);if(fs.existsSync(resultFile))fs.unlinkSync(resultFile);
    const processResult=spawnSync(process.execPath,[path.join(root,'.receipt-engine-build/scripts/receipt-engine/run.js'),'--image',image,'--output',resultFile],
      {cwd:root,encoding:'utf8',timeout:65000,maxBuffer:1024*1024,env:{...process.env,MISTRAL_API_KEY:'',NODE_OPTIONS:`--require=${path.join(root,'tests/receipt-engine/network-guard.cjs')}`}});
    let prediction=null;
    if(processResult.status===0&&fs.existsSync(resultFile))prediction=JSON.parse(fs.readFileSync(resultFile,'utf8'));
    else errors.push({id:row.id,status:processResult.error?.code??'worker_error',error:processResult.stderr.slice(0,500)});
    const result=score(row,prediction);scores.push(result);
    console.log(`${index+1}/${selected.length} ${row.id}: ${result.status}, total=${prediction?.data.total??'unknown'}, unknown glyphs=${result.unknown_glyphs}`);
  }
  const slices={};for(const variant of new Set(scores.map(s=>s.variant)))slices[variant]=aggregate(scores.filter(s=>s.variant===variant));
  const engineFiles=['lib/receipt-engine','lib/receipt-input'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.ts')).map(f=>`${dir}/${f}`));
  const report={schema:'receipt-phase4-development-benchmark/v1',status:'measured_development_diagnostics',engine:'custom-classical-v1',created_at:new Date().toISOString(),
    selected_receipts:selected.length,attempted_receipts:selected.length,manifest_sha256:sha(body),template_sha256:sha(fs.readFileSync(path.join(root,'assets/receipt-engine/templates.json'))),
    scorer_sha256:sha(fs.readFileSync(__filename)),engine_sha256:Object.fromEntries(engineFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),network_guard_enabled:true,source_annotation_states:[...new Set(selected.map(r=>r.annotation_review))],
    environment:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length,concurrency:1},
    metrics:aggregate(scores),slices,results:scores,errors,release_ready:false,legacy_comparison:null,
    limits:['Development data only; these cases may be used to tune this prototype.','Synthetic fixtures share the development font used to build templates.','Source labels are not independently verified. Real item/full-receipt accuracy is unavailable without annotations.','No held-out result or superiority over Mistral is established.','No cloud recognition, production upload/storage, UI flow, PDF or deployment was tested.']};
  fs.mkdirSync(path.dirname(path.resolve(root,output)),{recursive:true});fs.writeFileSync(path.resolve(root,output),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.metrics,null,2));
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={score,aggregate,decimalEqual,align};
