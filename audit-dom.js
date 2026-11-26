/* DOM adapter: reads visible top-frame content only; does not click or transmit. */
(()=>{'use strict';if(globalThis.__n360AuditDOM)return;const A=globalThis.N360Audit;if(!A)return;
const scope='table,[role="grid"],[role="table"],[role="treegrid"]',clean=v=>String(v??'').replace(/\s+/g,' ').trim(),text=e=>clean(e?.innerText??e?.textContent??'');
const visible=e=>!!(e instanceof Element&&e.getClientRects().length&&getComputedStyle(e).visibility==='visible'&&!e.closest('[hidden],[aria-hidden="true"],[data-n360-qa-studio],nav,aside,footer,[role="navigation"]'));
const all=(r,s)=>Array.from(r.querySelectorAll(s)).filter(visible);
const cells=(r,t)=>all(r,'td,th,[role="cell"],[role="gridcell"],[role="columnheader"],[role="rowheader"]').filter(c=>c.closest(scope)===t&&c.closest('tr,[role="row"]')===r);
function rangeFor(t){ // associate pagination only within a nearby single-table container
 for(let p=t.parentElement,depth=0;p&&p!==document.body&&depth<4;p=p.parentElement,depth++){
  if(all(p,scope).length!==1)break;const txt=text(p);if(txt.length>120000)break;
  const found=[...txt.matchAll(/\b(?:showing|displaying)\s+(\d+)\s*(?:to|[-–])\s*(\d+)\s+of\s+(\d+)(?:\s+(?:entries|records|appointments|items|results))?\b/gi)];
  if(found.length===1){const [,s,e,n]=found[0].map(Number);if(s>=1&&e>=s&&n>=e&&n<=1000000)return {start:s,end:e,total:n};}
  if(found.length>1)break;
 }return null;
}
function table(t){const rows=all(t,'tr,[role="row"]').filter(r=>r.closest(scope)===t),head=rows.filter(r=>r.closest('thead')||cells(r,t).length&&cells(r,t).every(c=>c.matches('th:not([scope="row"]),[role="columnheader"]'))),body=rows.filter(r=>!head.includes(r)&&!r.closest('tfoot')&&cells(r,t).length),foot=rows.filter(r=>r.closest('tfoot'));const headers=head.length===1?cells(head[0],t).map(text):[],complex=head.length!==1||all(t,'[rowspan],[colspan],[aria-rowspan],[aria-colspan]').some(e=>['rowspan','colspan','aria-rowspan','aria-colspan'].some(k=>Number(e.getAttribute(k))>1))||body.some(r=>cells(r,t).length!==headers.length);const range=rangeFor(t),data=body.slice(0,500).map(r=>cells(r,t).slice(0,40).map(c=>text(c).slice(0,160))),footer=foot.length===1?cells(foot[0],t).map(text):null;const virtual=Number(t.getAttribute('aria-rowcount'))>body.length+head.length||!!t.querySelector('[aria-rowindex]')&& !range;
 return {headers,rows:data,range,complex,virtual,truncated:body.length>500||headers.length>40,complete:!!range&&range.start===1&&range.end===range.total&&range.total===body.length,footer:footer&&footer.length===headers.length&&footer.some(v=>/^(grand )?total$/i.test(v))?footer:null};}
function groups(root){const groups=[];for(const dl of all(root,'dl').slice(0,30)){const list=[];for(const dt of all(dl,'dt')){const dd=dt.nextElementSibling;if(dd?.matches('dd')&&visible(dd))list.push({label:text(dt),value:text(dd)});}if(list.length)groups.push(list);}
 for(const t of all(root,'table').slice(0,30)){if(t.querySelector('thead'))continue;const pairs=all(t,'tr').filter(r=>r.closest('table')===t).map(r=>cells(r,t));if(pairs.length>=2&&pairs.length<=30&&pairs.every(r=>r.length===2))groups.push(pairs.map(r=>({label:text(r[0]),value:text(r[1])})));}
 // Explicit semantic label/value attributes (if the site provides them).
 for(const s of all(root,'[data-qa-summary]')){const pairs=all(s,'[data-qa-label][data-qa-value]').map(e=>({label:e.getAttribute('data-qa-label'),value:e.getAttribute('data-qa-value')}));if(pairs.length)groups.push(pairs);}
 return groups.slice(0,30);}
function api(){const counts=new Map();let observed=0;try{for(const e of performance.getEntriesByType('resource')){if(!['fetch','xmlhttprequest'].includes(e.initiatorType))continue;let same=false;try{same=new URL(e.name).origin===location.origin;}catch{}if(!same||!Number.isInteger(e.responseStatus)||e.responseStatus<100)continue;observed++;if(e.responseStatus>=400&&e.responseStatus<=599)counts.set(e.responseStatus,(counts.get(e.responseStatus)||0)+1);}}catch{}return {observed,failed:[...counts].sort((a,b)=>b[0]-a[0]).map(([status,count])=>({status,count}))};}
const fatalPatterns=[[/\b(?:500|502|503|504)\b.*(?:error|unavailable|gateway)/i,'HTTP 5xx error banner'],[/internal server error/i,'Internal server error'],[/bad gateway/i,'Bad gateway'],[/service unavailable/i,'Service unavailable'],[/something went wrong/i,'Something went wrong'],[/unexpected application error/i,'Unexpected application error']];
function appointmentCalendar(root){const labels=new Set(all(root,'button,[role="button"],span,label').slice(0,2500).map(e=>text(e).toLowerCase()).filter(t=>t.length<40));return labels.has("new appointment")&&(labels.has("daily view")||labels.has("all technician"));}
// HOME: structural observations only. No names, input values, customer IDs or raw DOM.
function homeSignals(){
 const cap=12000,limit=100,shown=e=>!!(e.getClientRects().length&&getComputedStyle(e).visibility==='visible'&&!e.closest('[hidden],[aria-hidden="true"],[inert],[data-n360-qa-studio],[data-n360-deep-picker]'));
 const keys={'no guests in the waiting list':'emptyWaitingList','walk-in':'walkIn','view turn list':'turnList','add service ticket':'addTicket','check out':'checkout','messages':'messages','notifications':'notifications','all status':'status','phone':'phone','search':'search'};
 const counts=Object.fromEntries(Object.values(keys).map(k=>[k,0]));counts.turn=0;
 const path=e=>{const a=[];for(let p=e;p&&p!==document.documentElement&&a.length<18;p=p.parentElement){const t=p.localName;if(!/^[a-z][a-z0-9-]*$/.test(t))return null;const i=Array.from(p.parentElement?.children||[]).filter(x=>x.localName===t).indexOf(p)+1;a.unshift(`${t}:nth-of-type(${i})`);}const s='html > '+a.join(' > ');return s.length<=600&&document.querySelector(s)===e?s:null;};
 const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round);};
 const candidates=document.querySelectorAll('div,span,p,small,strong,b,label,button,a,li,h1,h2,h3,input,[role="button"],[role="status"],[role="alert"]');
 const found=[],turnValues=[];let limited=candidates.length>cap;
 for(const e of Array.from(candidates).slice(0,cap)){
  if(e.matches('input:not([type="hidden"])')){if((e.getAttribute('name')==='search'||clean(e.getAttribute('placeholder')).toLowerCase()==='search')&&shown(e))found.push({e,kind:'search'});continue;}
  const raw=clean(e.textContent);if(!raw||raw.length>100)continue;
  const v=clean(e.innerText??e.textContent).toLowerCase();let kind=Object.hasOwn(keys,v)?keys[v]:null;const m=v.match(/^turn\s*:\s*(-?\d{1,7}(?:\.\d{1,4})?)$/);
  if(!kind&&!m)continue;if(!shown(e))continue;
  found.push({e,kind:kind||'turn',value:m?Number(m[1]):undefined});
 }
 // Nested spans and containers representing one label must count only once.
 const seen=new Map(found.map(x=>[x.e,x.kind])),parents=new Set();for(const x of found)for(let p=x.e.parentElement;p;p=p.parentElement)if(seen.get(p)===x.kind)parents.add(p);
 const signals=[];for(const x of found){if(parents.has(x.e))continue;if(signals.length>=limit){limited=true;break;}counts[x.kind]++;if(x.kind==='turn')turnValues.push(x.value);
  const ancestors=[];for(let p=x.e.parentElement;p&&p!==document.body&&ancestors.length<4;p=p.parentElement)ancestors.push({selector:path(p),tag:p.localName,children:p.children.length,rect:rect(p)});
  signals.push({kind:x.kind,selector:path(x.e),rect:rect(x.e),ancestors});
 }
 return {schema:1,counts,turnValues,signals,limited,viewport:[innerWidth,innerHeight],http:api(),note:'Only fixed labels and numeric Turn values; Walk-In labels are not confirmed ticket counts. DOM paths are structural and can change.'};
}
function snapshot(){const mains=all(document,'main,[role="main"]'),root=mains.length===1?mains[0]:document;const heads=all(root,'h1,h2,[role="heading"]').map(text).filter(s=>s.length<100).slice(0,20);const fatal=new Set();for(const el of all(root,'h1,h2,[role="alert"],[role="alertdialog"]').slice(0,50))for(const [p,label] of fatalPatterns)if(p.test(text(el)))fatal.add(label);const busy=all(root,'[aria-busy="true"],[role="progressbar"]').some(e=>!e.matches('progress[value]'));const module=A.moduleFor(location.pathname,heads);return {module,home:module==='Home'?homeSignals():null,calendar:module==='Appointment'&&appointmentCalendar(root),ready:document.readyState!=='loading',busy,online:navigator.onLine,content:all(root,'h1,h2,table,[role="grid"],button,[role="button"],[role="main"]').length>0,fatal:[...fatal],api:api(),tables:all(root,scope).filter(e=>!e.parentElement?.closest(scope)).slice(0,15).map(table),groups:groups(root)};}
globalThis.__n360AuditDOM={snapshot,homeSignals};})();
