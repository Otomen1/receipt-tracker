const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const compiled=path.join(root,'.receipt-engine-build/lib');
const {recognizeReceipt}=require(path.join(compiled,'receipt-engine'));
const {preprocess,otsu}=require(path.join(compiled,'receipt-engine/preprocess'));
const {homography,mapPoint,rectify,IDENTITY,rotate}=require(path.join(compiled,'receipt-engine/geometry'));
const {strictDate,extract,numericWord}=require(path.join(compiled,'receipt-engine/extract'));
const {interpretLayout}=require(path.join(compiled,'receipt-engine/layout'));
const {validate}=require(path.join(compiled,'receipt-engine/validate'));
const {structuredOutput}=require(path.join(compiled,'receipt-engine/output'));
const {lineAmount,deriveUnit,cents}=require(path.join(compiled,'receipt-engine/decimal'));
const {createRecognizer}=require(path.join(compiled,'receipt-engine/recognize'));
const {decodeReceiptImage}=require(path.join(compiled,'receipt-input/image'));
const {recognizeImageIsolated}=require(path.join(compiled,'receipt-input/isolated'));
const templates=JSON.parse(fs.readFileSync(path.join(root,'assets/receipt-engine/templates.json')));
function parse(text){return extract(interpretLayout(text.split('\n').map((text,id)=>({id,text,score:1,glyphs:[],box:{x:0,y:id*30,width:500,height:20}}))));}
const sample='ABC GROCERY\nDATE 28/02/2025\nITEM QTY UNIT AMOUNT\nRICE 2 5.50 11.00\nDISCOUNT 1.00\nSST 0.60\nGRAND TOTAL RM 10.60\nPAID BY CASH';

test('strict calendar parsing refuses rollovers and ambiguous short years',()=>{
  assert.equal(strictDate('TARIKH 29/02/2024'),'2024-02-29');
  for(const text of ['29/02/2025','31/04/2025','02/03/24','2025-13-01']) assert.equal(strictDate(text),null);
});
test('decimal arithmetic retains gifts, weighted goods and exact cent derivation',()=>{
  assert.equal(lineAmount('4.80','0.75'),'3.60');assert.equal(lineAmount('0.10','3'),'0.30');
  assert.equal(cents('0.00'),0n);assert.equal(deriveUnit('11.00','2'),'5.50');assert.equal(deriveUnit('1.00','3'),null);
});
test('English receipt parsing respects unit prices, tax, discounts and payable total',()=>{
  const parsed=parse(sample),data=structuredOutput(parsed,sample);
  assert.equal(data.merchant,'ABC GROCERY');assert.equal(data.receipt_date,'2025-02-28');assert.equal(data.total,10.60);
  assert.deepEqual(data.items,[{name:'RICE',quantity:2,price:5.5}]);assert.equal(parsed.items[0].lineAmount.value,'11.00');
  assert.deepEqual(validate(parsed,0),[]);
});
test('Malay summary labels and zero priced items are retained',()=>{
  const p=parse('RESTORAN CERIA\nTARIKH 28/02/2025\nITEM QTY UNIT AMOUNT\nHADIAH 1 0.00 0.00\nDISKAUN 0.00\nSST 0.00\nJUMLAH RM 0.00\nBAYARAN TUNAI');
  const d=structuredOutput(p,'fixture');assert.equal(d.total,0);assert.equal(d.items[0].price,0);assert.equal(d.payment_method,'Cash');
});
test('wrapped product names and explicit QTY/UNIT continuation retain field evidence',()=>{
  const p=parse('ABC STORE\nDATE 28/02/2025\nITEM QTY UNIT AMOUNT\nFRESH\nMILK QTY 2\nUNIT 5.50 AMOUNT 11.00\nTOTAL RM 11.00');
  assert.equal(p.items[0].name.value,'FRESH MILK');assert.equal(p.items[0].quantity.value,'2');assert.equal(p.items[0].unitPrice.value,'5.50');
  assert.equal(p.items[0].name.lineIds.length,3);
});
test('subtotal, cash tender and total item count do not replace the payable total',()=>{
  const p=parse('ABC STORE\nSUBTOTAL 20.00\nTOTAL ITEMS 3\nAMOUNT DUE RM 18.00\nCASH 20.00\nCHANGE 2.00');
  assert.equal(p.total.value,'18.00');
});
test('conflicting totals and unreadable product names cause abstention',()=>{
  const p=parse(sample.replace('RICE','R?CE')+'\nTOTAL RM 99.00');
  assert.equal(p.total.value,null);assert.equal(p.items[0].name.value,null);assert.deepEqual(structuredOutput(p,'').items,[]);
  assert.match(p.warnings.join(' '),/Conflicting total/);
});
test('a single unlabeled item amount is not invented as a unit price',()=>{
  const p=parse('ABC STORE\nITEM QTY UNIT AMOUNT\nBREAD 5.00\nTOTAL RM 5.00');
  assert.equal(p.items[0].unitPrice.value,null);assert.equal(structuredOutput(p,'').items[0].price,undefined);
  assert.match(validate(p,0).join(' '),/unit price is unresolved/);
});
test('arithmetic mismatches produce warnings without modifying the printed amounts',()=>{
  const p=parse(sample.replace('10.60','99.00'));
  assert.match(validate(p,0).join(' '),/No balancing values were invented/);assert.equal(p.total.value,'99.00');
});
test('numeric correction requires a unique close visual alternative, not blind O-to-zero substitution',()=>{
  const glyph={character:'O',candidates:[{character:'O',distance:.03,score:.97},{character:'0',distance:.05,score:.95}]};
  const dot={character:'.',candidates:[]},zero={character:'0',candidates:[]};
  assert.deepEqual(numericWord({text:'O.00',glyphs:[glyph,dot,zero,zero]}),{value:'0.00',corrected:true});
  assert.equal(numericWord({text:'O.00',glyphs:[]}),null);
  glyph.candidates.push({character:'8',distance:.06,score:.94});assert.equal(numericWord({text:'O.00',glyphs:[glyph,dot,zero,zero]}),null);
});
test('image budgets and malformed rasters fail before expensive processing',()=>{
  assert.throws(()=>preprocess({width:5,height:5,data:new Uint8Array(4)}),/Invalid raster/);
  assert.throws(()=>preprocess({width:4000,height:4000,data:new Uint8Array(0)}),/budget/);
});
test('pure-black ink survives Otsu; constant pages do not acquire invented text',()=>{
  const image={width:10,height:10,data:new Uint8Array(100).fill(255)};image.data[45]=0;
  assert.equal(otsu(image)[45],1);image.data.fill(255);
  const r=recognizeReceipt(image,templates,{orientation:0});assert.equal(r.data.total,null);assert.equal(r.data.merchant,null);assert.equal(r.diagnostics.totalGlyphs,0);assert.equal(r.validation.confidence,'low');
});
test('perspective coordinates round trip observed corners and reject crossing quads',()=>{
  const from=[{x:0,y:0},{x:99,y:0},{x:99,y:99},{x:0,y:99}],to=[{x:10,y:5},{x:90,y:10},{x:85,y:95},{x:5,y:90}];
  const m=homography(from,to);
  for(let i=0;i<4;i++){const p=mapPoint(m,from[i].x,from[i].y);assert.ok(Math.hypot(p.x-to[i].x,p.y-to[i].y)<1e-6);}
  assert.throws(()=>rectify({width:100,height:100,data:new Uint8Array(10000)},[from[0],from[2],from[1],from[3]],20000),/convex/);
});
test('rotation preserves a source coordinate transform for non-square pages',()=>{
  const page={width:8,height:4,data:new Uint8Array(32),operations:[],toInput:IDENTITY};page.data[1*8+2]=1;
  const rotated=rotate(page,180);let mapped=0;
  for(let i=0;i<rotated.data.length;i++)if(rotated.data[i]){const p=mapPoint(rotated.toInput,i%rotated.width,Math.floor(i/rotated.width));if(Math.hypot(p.x-2,p.y-1)<1) mapped++;}
  assert.equal(mapped,1);
});
test('template loading rejects held-out banks and corrupt bitmaps',()=>{
  assert.throws(()=>createRecognizer({...templates,sourceSplit:'test'}),/non-development/);
  assert.throws(()=>createRecognizer({...templates,templates:[{...templates.templates[0],bitmap:'bad'}]}),/Invalid glyph/);
});
for(const index of [0,1])test(`pixels to receipt fields: ${index===0?'English':'Malay'} development fixture`,async()=>{
  const gt=JSON.parse(fs.readFileSync(path.join(__dirname,`fixtures/receipt-${index}.json`)));
  const image=await decodeReceiptImage(fs.readFileSync(path.join(__dirname,`fixtures/receipt-${index}.png`)));
  const result=recognizeReceipt(image,templates,{orientation:0});
  for(const key of ['merchant','receipt_date','currency','payment_method']) assert.equal(result.data[key],gt[key],key);
  // Content must match exactly; geometric column padding is represented by boxes,
  // not a promise to infer a printer's original count of space characters.
  assert.equal(result.data.raw_text.replace(/[^\S\n]+/g,' '),gt.raw_text.replace(/[^\S\n]+/g,' '));
  assert.equal(result.data.total,Number(gt.total));assert.equal(result.data.discount,Number(gt.discount));
  assert.deepEqual(result.data.items,gt.items.map(i=>({name:i.name,quantity:Number(i.quantity),price:Number(i.price)})));
  assert.notEqual(result.validation.confidence,'high');assert.equal(result.diagnostics.calibration,'uncalibrated');
});
test('decoder refuses PDFs and malformed images without invoking an external recognizer',async()=>{
  await assert.rejects(decodeReceiptImage(Buffer.from('%PDF-1.7 fixture')),/no cloud fallback/);
  await assert.rejects(decodeReceiptImage(Buffer.from('not an image')));
});
test('automatic orientation handles a physically rotated page without choosing a few dots',async()=>{
  const sharp=require('sharp');
  const bytes=fs.readFileSync(path.join(__dirname,'fixtures/receipt-0.png'));
  for(const angle of [90,180]){
    const image=await decodeReceiptImage(await sharp(bytes).rotate(angle).png().toBuffer());
    const result=recognizeReceipt(image,templates);
    assert.equal(result.data.merchant,'SAMPLE GROCERY STORE');assert.equal(result.data.total,18.4);
    assert.ok(result.diagnostics.totalGlyphs>150);
  }
});
test('a connected scan frame does not collapse all receipt text into one band',async()=>{
  const sharp=require('sharp'),bytes=fs.readFileSync(path.join(__dirname,'fixtures/receipt-0.png'));
  const framed=await sharp(bytes).extend({top:5,bottom:5,left:5,right:5,background:'#000000'}).png().toBuffer();
  const result=recognizeReceipt(await decodeReceiptImage(framed),templates,{orientation:0});
  assert.equal(result.data.merchant,'SAMPLE GROCERY STORE');assert.equal(result.data.total,18.4);
  assert.ok(result.diagnostics.operations.some(s=>s.startsWith('suppress_graphics:')));assert.ok(result.lines.length>10);
});
test('isolated worker has a hard deadline and supports caller cancellation',async()=>{
  const bytes=fs.readFileSync(path.join(__dirname,'fixtures/receipt-0.png'));
  await assert.rejects(recognizeImageIsolated(bytes,templates,{},1),/deadline exceeded/);
  const controller=new AbortController();const running=recognizeImageIsolated(bytes,templates,{},60000,controller.signal);controller.abort();
  await assert.rejects(running,/aborted/);
});
test('CLI and worker complete with JS networking forbidden and no Mistral credential',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'receipt-offline-test-'));
  try{
    const out=path.join(dir,'result.json'),guard=path.join(__dirname,'network-guard.cjs');
    const env={...process.env,MISTRAL_API_KEY:'',NODE_OPTIONS:`--require=${guard}`};
    const result=spawnSync(process.execPath,[path.join(root,'.receipt-engine-build/scripts/receipt-engine/run.js'),'--image',path.join(__dirname,'fixtures/receipt-0.png'),'--output',out,'--upright'],{cwd:root,env,encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.stderr);const data=JSON.parse(fs.readFileSync(out));
    assert.equal(data.engine,'custom-classical-v1');assert.equal(data.data.total,18.4);assert.ok(data.measurement.wall_ms>0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
