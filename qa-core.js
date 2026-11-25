/* Local automation model, shared by runner, worker and dashboard. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.N360QA=api;})(globalThis,()=>{
'use strict';
const ORIGIN='https://dev.nail360.info',KEY='n360QAStoreV1',MAX_STEPS=40,MAX_SUITES=40,MAX_RUNS=100;
const TYPES=['clickTab','visible','text','count'],STATUSES=['PASS','FAIL','SKIP'],ISSUES=['Open','Investigating','Resolved','Ignored'];
const str=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
function route(v){if(typeof v!=='string'||v.length>300||!v.startsWith('/')||v.startsWith('//')||/[?#\\\x00-\x1f]/.test(v))throw Error('Invalid DEV route');return v;}
function isDev(url){try{return new URL(url).origin===ORIGIN;}catch{return false;}}
function key(v){const s=str(v,80);if(!/^[a-zA-Z0-9_-]{1,80}$/.test(s))throw Error('Invalid record ID');return s;}
function step(v){if(!v||!TYPES.includes(v.type))throw Error('Unsupported test step');const selector=str(v.selector,600);if(!selector||selector!==v.selector)throw Error('Invalid selector');const s={type:v.type,selector,label:str(v.label,100)||v.type};if(v.type==='text'){s.expected=str(v.expected,160);if(!s.expected)throw Error('Expected text is empty');}if(v.type==='count'){if(!Number.isInteger(v.expected)||v.expected<0||v.expected>10000)throw Error('Invalid expected row count');s.expected=v.expected;}if(v.type==='clickTab'){s.signature=key(v.signature);}return s;}
function suite(v){if(!v||!Array.isArray(v.steps)||!v.steps.length||v.steps.length>MAX_STEPS)throw Error('Suite must have 1–40 steps');const name=str(v.name,100);if(!name)throw Error('Enter a suite name');return {id:key(v.id),name,route:route(v.route),steps:v.steps.map(step),updatedAt:new Date().toISOString()};}
function summarize(results){const s={pass:0,fail:0,skip:0,total:0};for(const t of results||[]){if(STATUSES.includes(t.status)){s[t.status.toLowerCase()]++;s.total++;}}return s;}
function run(v){if(!v||!Array.isArray(v.results)||!v.results.length||v.results.length>MAX_STEPS)throw Error('Invalid test results');const results=v.results.map((t,i)=>{if(!STATUSES.includes(t.status))throw Error('Invalid result status');return {id:String(i+1),name:str(t.name,120)||'Check '+(i+1),status:t.status,expected:str(t.expected,240),actual:str(t.actual,240),ms:Number.isFinite(t.ms)?Math.max(0,Math.min(120000,Math.round(t.ms))):0,issue:t.status==='FAIL'?'Open':null};});return {id:key(v.id),suiteId:v.suiteId?key(v.suiteId):null,name:str(v.name,100)||'DEV smoke test',route:route(v.route),at:new Date().toISOString(),results,summary:summarize(results)};}
function store(v){return {suites:Array.isArray(v?.suites)?v.suites.slice(0,MAX_SUITES):[],runs:Array.isArray(v?.runs)?v.runs.slice(0,MAX_RUNS):[]};}
function upsert(list,item,max){return [item,...list.filter(x=>x.id!==item.id)].slice(0,max);}
function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s\u0000-\u0020]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
function report(r,t){return [`[N360 QA] ${t.name}`,'Environment: DEV',`Suite: ${r.name}`,`Route: ${r.route}`,`Time: ${r.at}`,`Run ID: ${r.id}`,'','Steps to reproduce:','1. Open the recorded DEV route using the same authorized test salon and filters.','2. Run the same suite and check the failing step.','3. Verify the result manually.','','Expected:',t.expected||'Not specified','','Actual:',t.actual||'Not specified','','Note: DOM-based automated check; investigate before filing a confirmed product defect.'].join('\n');}
return {ORIGIN,KEY,MAX_STEPS,MAX_SUITES,MAX_RUNS,TYPES,STATUSES,ISSUES,isDev,route,step,suite,summarize,run,store,upsert,csv,report};
});
