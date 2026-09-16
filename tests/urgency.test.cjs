const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'app.js'), 'utf8').split(/\r?\n/);
const names = ['GEOCODE_CACHE_KEY','resourceTypes','RESOURCE_TYPE_COMPATIBILITY_COLUMNS','RESEARCH_WEIGHTS','RESEARCH_URGENCY_MAX','RESEARCH_CONFIG','DEBUG_ALGORITHM_DIAGNOSTICS','state','RELIEF_HUB','HIGH_URGENCY_THRESHOLD','HOUSEHOLD_FIELD_ALIASES','BENCHMARK_WARMUP_RUNS','BENCHMARK_REPETITIONS'];
const chunks = [];
for(let i=0;i<lines.length;i++) {
  if (/^(async )?function \w+/.test(lines[i]) || names.some(n=>lines[i].startsWith('const '+n+' ='))) {
    let code=lines[i];
    while(true) { try {new vm.Script(code);break;} catch(e) {if(i+1>=lines.length)throw e;code+='\n'+lines[++i];} }
    chunks.push(code);
  }
}
const ctx=vm.createContext({console,performance,localStorage:{getItem:()=>null}});
vm.runInContext(chunks.join('\n'),ctx);
const run = code => vm.runInContext(code,ctx);
const fixture = urgency => ({household_id:'T-'+urgency, urgency, latitude:14.6203, longitude:120.9732, compatible_resource:'Food'});
ctx.rows=[fixture(1),fixture(2),fixture(3),fixture(4),fixture(5)];
ctx.resources=['Food','Medical','Water','Food','Medical'].map((resource_type,i)=>({resource_id:'R'+i,resource_type,latitude:14.6201+i*0.0001,longitude:120.9731,available:true}));
test('strict parser, execution guards and fixed weights',()=>{
 for(const value of [0,6,7,10,100,'', ' ',NaN,2.5,'3.5',null,undefined,true,[],Infinity]) {
  ctx.value=value;
  assert.equal(run('parseUrgencyValue(value)'),null);
  assert.throws(()=>run("runAssignment('enhanced', [{household_id:'bad',urgency:value}],resources)"),/integer from 1 through 5/);
  assert.throws(()=>run('createDynamicUrgencyEvents([{urgency:value}])'),/integer from 1 through 5/);
 }
 for(const value of [1,2,3,4,5,'1','5']) {ctx.value=value; assert.equal(run('parseUrgencyValue(value)'),Number(value));}
 assert.equal(run('getUrgencyScaleMax([{urgency:100}])'),5);
 assert.equal(run('JSON.stringify(RESEARCH_WEIGHTS)'),JSON.stringify({distance:0.164,urgency:0.539,compatibility:0.297}));
});
test('five boundary transitions and repeated-profile generation',()=>{
 for(const [before,after] of [[1,3],[2,4],[3,5],[4,2],[5,3]]) {
  ctx.single=[fixture(before)];
  const e=run('createDynamicUrgencyEvents(single,1)[0]');
  assert.equal(e.newUrgency,after); assert.equal(e.delta,2); assert.equal(e.triggered,true);
  console.log(`T-${before} | ${before} | ${after} | ${e.delta} | ${e.triggered}`);
 }
 ctx.single=[fixture(5)];
 const events=run('createDynamicUrgencyEvents(single,10)');
 assert.equal(JSON.stringify(events),run('JSON.stringify(createDynamicUrgencyEvents(single,10))'));
 let previous=5;
 for(const e of events){assert.equal(e.previousUrgency,previous);assert(e.newUrgency>=1&&e.newUrgency<=5);previous=e.newUrgency;}
});
test('non-triggers retain assignment and ignore forged trigger flags; stale/invalid events rejected',()=>{
 for(const [before,after] of [[3,4],[4,4]]) {
  ctx.input=[fixture(before)]; ctx.events=[{householdIndex:0,previousUrgency:before,newUrgency:after,triggered:true,delta:99}];
  const result=run('runDynamicPerformanceBenchmarkSample(input,resources.slice(0,1),events)');
  assert.equal(result.events[0].triggered,false);assert.equal(result.events[0].changed,false);
  assert.equal(result.events[0].fullMs,0);assert.equal(result.events[0].selectiveMs,0);
  console.log(`T-${before} | ${before} | ${after} | ${result.events[0].delta} | false`);
 }
 assert.throws(()=>run('applyDynamicEventRows(rows,{householdIndex:0,previousUrgency:2,newUrgency:4})'),/does not match/);
 assert.throws(()=>run('applyDynamicEventRows(rows,{householdIndex:0,previousUrgency:1,newUrgency:7})'),/integers from 1 through 5/);
});
test('all valid transitions agree, including changed global min/max bounds',()=>{
 let boundsChanged=0;
 for(let before=1;before<=5;before++)for(let after=1;after<=5;after++) {
  ctx.input=[fixture(before),{...fixture(2),household_id:'other'}];
  // Both households mismatch this resource, ensuring a nonzero normalization minimum.
  ctx.res=[{...ctx.resources[0],resource_type:'Medical'}]; ctx.after=after;
  const check=run(`(()=>{const initial=runAssignment('enhanced',input,res);const updated=applyDynamicEventRows(input,{householdIndex:0,previousUrgency:input[0].urgency,newUrgency:after});const full=runAssignment('enhanced',updated,res);const selective=selectiveEnhancedReassignment(initial,updated,res,[0]);return {full,selective};})()`);
  assert.deepEqual(check.selective.costMatrix,check.full.costMatrix);
  assert.equal(check.selective.cost,check.full.cost);
  assert.deepEqual(check.selective.output.map(x=>x.householdIndex),check.full.output.map(x=>x.householdIndex));
  if(check.selective.normalizationBoundsChanged)boundsChanged++;
 }
 assert(boundsChanged>0);
 ctx.events=[{householdIndex:2,previousUrgency:3,newUrgency:4},{householdIndex:4,previousUrgency:5,newUrgency:3}];
 const result=run('runDynamicPerformanceBenchmarkSample(rows,resources,events)');
 assert.equal(result.events[1].validation.absCostDiff,0);
 assert.equal(result.events[1].validation.agreementRate,1);
});
const datasetPath=path.join(root,'tmp/chapter4/dataset-analysis.json');
test('research dataset benchmark: five events, identical full/selective results', {skip:!fs.existsSync(datasetPath)},()=>{
 const data=JSON.parse(fs.readFileSync(datasetPath,'utf8'));
 ctx.researchRows=data['System Import'].eligible.slice(0,60);
 ctx.researchResources=data.resources.rows.slice(0,60);
 ctx.verifySample = sample => {
   for (const e of sample.events) {
     assert.equal(e.validation.absCostDiff,0);
     assert.equal(e.validation.agreementRate,1);
     assert(e.validation.fullOneToOne && e.validation.selectiveOneToOne);
   }
 };
 const before=JSON.stringify([ctx.researchRows,ctx.researchResources]);
 run('const originalBenchmarkSample = runDynamicPerformanceBenchmarkSample; runDynamicPerformanceBenchmarkSample = (...args) => { const sample = originalBenchmarkSample(...args); verifySample(sample); return sample; };');
 const result=run('runDynamicPerformanceBenchmark(researchRows,researchResources)');
 assert.equal(JSON.stringify([ctx.researchRows,ctx.researchResources]),before);
 assert.equal(result.events.length,5);
 for(const e of result.events) {
  assert.equal(e.validation.absCostDiff,0);assert.equal(e.validation.agreementRate,1);
  assert(e.previousUrgency>=1&&e.previousUrgency<=5&&e.newUrgency>=1&&e.newUrgency<=5);
  console.log(`${ctx.researchRows[e.householdIndex].household_id} | ${e.previousUrgency} | ${e.newUrgency} | ${e.delta} | ${e.triggered}`);
 }
 console.log(`Benchmark: ${result.warmups} warmups, ${result.repetitions} repetitions; all 165 event comparisons agree.`);
});
