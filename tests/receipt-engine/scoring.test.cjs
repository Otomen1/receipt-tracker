const test=require('node:test'),assert=require('node:assert/strict');
const {score,aggregate,decimalEqual,align}=require('../../scripts/receipt-engine/benchmark.cjs');
const row={id:'fixture',source:'synthetic',split:'development',variant:'clean',ground_truth:{merchant:'ABC',receipt_date:'2025-02-28',total:'0.00',raw_text:'ABC\nGIFT 0.00',items:[{name:'GIFT',quantity:'1',price:'0.00',line_amount:'0.00'}]}};
const f=value=>({value,state:'observed'});
const prediction=()=>({data:{merchant:'ABC',receipt_date:'2025-02-28',total:0,raw_text:'ABC\nGIFT 0.00'},parsed:{items:[{name:f('GIFT'),quantity:f('1'),unitPrice:f('0'),lineAmount:f('0')}]},validation:{confidence:'medium',warnings:[]}});
test('zero prices compare correctly without coercing missing, booleans or infinity to zero',()=>{
  assert.ok(decimalEqual('0.00',0));assert.ok(decimalEqual('0.750',.75));
  for(const v of [null,undefined,false,Infinity,NaN,''])assert.equal(decimalEqual('0.00',v),false);
});
test('missing whole predictions count as field/text errors and require review',()=>{
  const s=score(row,null);assert.equal(s.fields.total.correct,0);assert.equal(s.text.character_errors,s.text.characters);assert.equal(s.review,true);assert.equal(s.core_complete,false);
});
test('extra and missing item rows are penalized while unannotated items remain unavailable',()=>{
  const p=prediction();p.parsed.items.push(p.parsed.items[0]);
  assert.deepEqual(score(row,p).items.name,{correct:1,total:2});
  p.parsed.items=[];assert.deepEqual(score(row,p).items.price,{correct:0,total:1});
  const unannotated={...row,ground_truth:{...row.ground_truth,items:null}};
  assert.deepEqual(score(unannotated,p).items,{});assert.equal(score(unannotated,p).core_complete,null);
});
test('alignment uses name evidence independently of prices',()=>{
  assert.deepEqual(align([{name:'RICE'},{name:'MILK'}],[{name:'MILK',price:999}]),[[0,null],[1,0]]);
});
test('empty cohorts have unavailable metrics and supplied fixtures are not actual inference',()=>{
  const empty=aggregate([]);assert.equal(empty.text.CER,null);assert.equal(empty.core_complete.accuracy,null);assert.equal(empty.performance.wall_ms.p50,null);
  const s=score(row,prediction());assert.equal(s.core_complete,true);assert.equal(s.measurement,null);
});
