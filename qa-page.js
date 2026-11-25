/* Runs in the isolated world of the DEV top frame. No requests or credentials. */
(()=>{
'use strict';
if(globalThis.__n360QAStudio)return;
const Q=globalThis.N360QA;if(!Q||location.origin!==Q.ORIGIN||window.top!==window)return;
let host,root,record=null,pickCleanup=null,running=false,stop=false,stored=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const send=async(type,args={})=>{const r=await chrome.runtime.sendMessage({type,...args});if(!r?.ok)throw Error(r?.error||'Cannot access local QA storage');return r.data;};
const visible=e=>!!(e instanceof Element&&e.getClientRects().length&&getComputedStyle(e).visibility==='visible'&&!e.closest('[hidden],[aria-hidden="true"]'));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const text=e=>clean(e?.innerText||e?.textContent);
const inOverlay=e=>e===host||!!e?.closest?.('[data-n360-qa-studio]');
const scope='table,[role="grid"],[role="table"],[role="treegrid"]';
function elements(selector){try{return Array.from(document.querySelectorAll(selector)).filter(e=>!inOverlay(e));}catch{return [];}}
function unique(selector){const list=elements(selector);return list.length===1?list[0]:null;}
function locator(e){
 if(!(e instanceof Element)||e.getRootNode()!==document)throw Error('Chỉ hỗ trợ DOM chính, không hỗ trợ iframe/shadow DOM.');
 for(const attr of ['data-testid','data-test','data-qa','id']){const v=e.getAttribute(attr);if(v&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v)){const s=`[${attr}="${v}"]`;if(unique(s)===e)return s;}}
 const parts=[];for(let el=e;el&&el!==document.documentElement&&parts.length<12;el=el.parentElement){const tag=el.localName;if(!/^[a-z][a-z0-9-]*$/.test(tag))break;const siblings=Array.from(el.parentElement?.children||[]).filter(x=>x.localName===tag);parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(el)+1})`);const s='html > '+parts.join(' > ');if(unique(s)===e&&s.length<=600)return s;}
 throw Error('Không tạo được selector ổn định. Hãy chọn phần tử có ID hoặc data-testid.');
}
function signature(e){let h=2166136261;for(const c of clean(e.getAttribute('aria-label')||text(e)).toLowerCase())h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h.toString(16);}
function safeTab(e){
 if(!e||!e.matches('[role="tab"]')||!visible(e)||e.closest('form,[contenteditable="true"],[aria-disabled="true"],[disabled]')||e.matches('input,textarea,select,[type="submit"],[type="reset"]'))return false;
 const label=clean(e.getAttribute('aria-label')||text(e));if(!label||/\b(delete|remove|cancel|save|submit|pay|checkout|refund|charge|void|confirm|create|book|sign out|log out)\b|xóa|xoá|hủy|huỷ|thanh toán|lưu|tạo|đăng xuất/i.test(label))return false;
 const href=e.getAttribute('href');if(href){try{const u=new URL(href,location.href);if(u.origin!==location.origin||u.pathname!==location.pathname||u.search!==location.search)return false;}catch{return false;}}
 return true;
}
function countRows(e){return Array.from(e.querySelectorAll('tr,[role="row"]')).filter(r=>visible(r)&&r.closest(scope)===e&&!r.closest('thead,tfoot')&&Array.from(r.querySelectorAll('td,[role="cell"],[role="gridcell"],[role="rowheader"]')).some(visible)).length;}
const result=(name,status,expected,actual,ms=0)=>({name,status,expected,actual,ms});
function smoke(){
 const results=[];const add=(...args)=>results.push(result(...args));
 add('Document ready',document.readyState==='complete'||document.readyState==='interactive'?'PASS':'FAIL','DOM ready','readyState: '+document.readyState);
 add('Browser network state',navigator.onLine?'PASS':'FAIL','Browser online (not a server health check)',navigator.onLine?'Browser reports online':'Browser reports offline');
 const content=Array.from(document.querySelectorAll('main,[role="main"],h1,h2,table,[role="grid"],button,[role="button"]')).some(e=>!inOverlay(e)&&visible(e));
 add('Visible page content',content?'PASS':'FAIL','At least one visible main region, heading, table or control',content?'Visible content found':'No matching visible content');
 const fatal=Array.from(document.querySelectorAll('h1,h2,[role="alert"],[role="alertdialog"]')).filter(e=>!inOverlay(e)&&visible(e)).some(e=>/^(?:error\s+)?(?:500|502|503|504)(?:\s|$)|internal server error|bad gateway|service unavailable|something went wrong|unexpected application error/i.test(text(e)));
 add('Fatal error banner (heuristic)',fatal?'FAIL':'PASS','No matching fatal error heading or alert',fatal?'Visible fatal-error pattern found; verify manually':'No configured fatal-error pattern detected');
 const tables=elements(scope).filter(visible),rows=tables.reduce((n,e)=>n+countRows(e),0);
 add('Rendered data tables',tables.length&&rows?'PASS':'SKIP','Inspect rendered tables; empty/missing is not a product defect by itself',tables.length?`${tables.length} table(s), ${rows} rendered data row(s)`:'No supported visible table; custom calendar may be valid');
 return results;
}
async function waitFor(fn,timeout=3000){const end=Date.now()+timeout;do{if(stop)return false;if(fn())return true;await delay(150);}while(Date.now()<end);return false;}
function describe(s){return s.type==='count'?`Rendered row count = ${s.expected}`:s.type==='text'?'Selected element contains configured text':s.type==='visible'?'Unique selected element is visible':'Safe tab is selected';}
async function execute(s){const start=performance.now();let status='FAIL',actual='Assertion did not pass within 3 seconds';const finish=()=>result(s.label,status,describe(s),actual,performance.now()-start);
 if(s.type==='clickTab'){
  const found=await waitFor(()=>{const e=unique(s.selector);return safeTab(e)&&signature(e)===s.signature;});if(!found){actual=stop?'Stopped by user':'Tab missing, changed, disabled or unsafe';status=stop?'SKIP':'FAIL';return finish();}
  const e=unique(s.selector);if(!safeTab(e)||signature(e)!==s.signature){actual='Tab no longer safe';return finish();}e.click();
  const selected=await waitFor(()=>{const t=unique(s.selector);return !!t&&t.getAttribute('aria-selected')==='true';});status=stop?'SKIP':selected?'PASS':'FAIL';actual=stop?'Stopped by user':selected?'aria-selected=true after click':'Click did not produce aria-selected=true';return finish();
 }
 let lastCount=null;
 const ok=await waitFor(()=>{const e=unique(s.selector);if(!visible(e))return false;if(s.type==='visible')return true;if(s.type==='text')return text(e).toLowerCase().includes(s.expected.toLowerCase());if(s.type==='count'&&e.matches(scope)){lastCount=countRows(e);return lastCount===s.expected;}return false;});
 status=stop?'SKIP':ok?'PASS':'FAIL';actual=stop?'Stopped by user':s.type==='count'?(lastCount===null?'Table missing or hidden':`Rendered row count = ${lastCount}`):ok?'Assertion passed':actual;return finish();
}
function setStatus(s){if(root)root.getElementById('status').textContent=s;}
function locked(){if(!root)return;for(const id of ['smoke','record','visible','text','count','save','suite','run','name','expected','cancel'])root.getElementById(id).disabled=running;root.getElementById('stop').disabled=!running;}
function recordView(){if(!root)return;const info=root.getElementById('record-state');info.textContent=record?`Đang ghi ${record.steps.length}/${Q.MAX_STEPS} bước · ${record.route}`:'Chưa ghi kịch bản';const list=root.getElementById('steps');list.replaceChildren();for(const [i,s] of (record?.steps||[]).entries()){const li=document.createElement('li');li.textContent=`${i+1}. ${s.label}`;list.append(li);}}
function addStep(s){if(!record||record.steps.length>=Q.MAX_STEPS){setStatus('Đã đạt giới hạn 40 bước hoặc chưa bắt đầu ghi.');return;}if(location.pathname!==record.route){setStatus('Đường dẫn đã đổi. Hãy bắt đầu kịch bản mới ở trang này.');return;}record.steps.push(Q.step(s));recordView();}
function recordClicks(e){if(!record||running||pickCleanup||!e.isTrusted||e.composedPath().includes(host)||location.pathname!==record.route)return;const target=e.target instanceof Element?e.target.closest('[role="tab"]'):null;if(!safeTab(target))return;try{addStep({type:'clickTab',selector:locator(target),signature:signature(target),label:'Switch tab (ARIA)'});}catch(err){setStatus(err.message);}}
function stopPick(){if(pickCleanup)pickCleanup();}
function choose(type){
 if(!record){setStatus('Bấm Bắt đầu ghi trước.');return;}if(running)return;stopPick();const expected=root.getElementById('expected').value.trim();if(type==='text'&&!expected){setStatus('Nhập nội dung mong đợi (không chứa thông tin khách hàng).');return;}if(type==='count'&&expected&&!/^\d{1,5}$/.test(expected)){setStatus('Nhập số dòng hoặc để trống để lấy baseline hiện tại.');return;}
 const shield=document.createElement('div');shield.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(6,55,50,.06);cursor:crosshair;pointer-events:auto;';document.documentElement.append(shield);setStatus('Bấm chọn phần tử trên trang; Esc để hủy. Không thực hiện click của salon.');
 const block=e=>{e.preventDefault();e.stopImmediatePropagation();};
 const key=e=>{if(e.key==='Escape'){block(e);stopPick();setStatus('Đã hủy chọn.');}};
 const click=e=>{block(e);let target=document.elementsFromPoint(e.clientX,e.clientY).find(x=>x!==shield&&!inOverlay(x));try{if(type==='count')target=target?.closest(scope);if(!target||!visible(target))throw Error('Chọn phần tử đang hiển thị (bảng đối với đếm dòng).');if(target.matches('input,textarea,[contenteditable]')||target.closest('input,textarea,[contenteditable]'))throw Error('Không ghi trường nhập liệu.');const s={type,selector:locator(target),label:type==='visible'?'Element visible':type==='text'?'Expected text':'Rendered row count'};if(type==='text')s.expected=expected;if(type==='count')s.expected=expected?Number(expected):countRows(target);addStep(s);setStatus('Đã ghi bước kiểm tra.');}catch(err){setStatus(err.message);}finally{stopPick();}};
 for(const name of ['pointerdown','pointerup','mousedown','mouseup','dblclick','contextmenu'])shield.addEventListener(name,block);shield.addEventListener('click',click);document.addEventListener('keydown',key,true);const timer=setTimeout(()=>{stopPick();setStatus('Hết thời gian chọn.');},30000);pickCleanup=()=>{clearTimeout(timer);shield.remove();document.removeEventListener('keydown',key,true);pickCleanup=null;};
}
async function refresh(){const data=await send('qa:list');stored=data.suites.filter(s=>s.route===location.pathname);if(!root)return;const sel=root.getElementById('suite'),old=sel.value;sel.replaceChildren();const p=document.createElement('option');p.value='';p.textContent='Chọn suite đã lưu trên trang này';sel.append(p);for(const s of stored){const o=document.createElement('option');o.value=s.id;o.textContent=`${s.name} (${s.steps.length})`;sel.append(o);}if(stored.some(s=>s.id===old))sel.value=old;}
async function run(kind){
 if(running)return;if(record){setStatus('Lưu hoặc hủy bản ghi trước khi chạy test.');return;}
 const s=kind==='suite'?stored.find(x=>x.id===root.getElementById('suite').value):null;if(kind==='suite'&&!s){setStatus('Chọn suite cần chạy.');return;}
 if(s&&s.route!==location.pathname){setStatus('Sai đường dẫn DEV; mở đúng trang đã ghi.');return;}
 if(s?.steps.some(x=>x.type==='clickTab')&&!confirm('Chạy lại thao tác click tab trên DEV? Chỉ dùng salon test được phép kiểm tra. Không chạy thanh toán hoặc thao tác ghi dữ liệu.'))return;
 running=true;stop=false;locked();setStatus('Đang chạy test…');const route=location.pathname,results=[];
 try{
  if(s){for(let i=0;i<s.steps.length;i++){const step=s.steps[i];if(stop||location.origin!==Q.ORIGIN||location.pathname!==route||results.some(t=>t.status==='FAIL')){results.push(result(step.label,'SKIP',describe(step),'Stopped after failed step, route change or cancellation'));continue;}setStatus(`Đang chạy ${i+1}/${s.steps.length}: ${step.label}`);try{results.push(await execute(step));}catch{results.push(result(step.label,'FAIL',describe(step),'Browser action failed; inspect target manually'));}}}
  else{await waitFor(()=>document.readyState!=='loading',3000);results.push(...smoke());}
  const r={id:crypto.randomUUID(),suiteId:s?.id||null,name:s?.name||'DEV smoke test',route,results};await send('qa:saveRun',{run:r});const sum=Q.summarize(results);setStatus(`Đã lưu kết quả: ${sum.pass} PASS · ${sum.fail} FAIL · ${sum.skip} SKIP. Mở Admin để xem chi tiết.`);
  if(root){const list=root.getElementById('last');list.replaceChildren();for(const t of results){const li=document.createElement('li');li.textContent=`${t.status} · ${t.name}`;li.className=t.status.toLowerCase();list.append(li);}}
 }catch(err){setStatus('Không hoàn tất/lưu test: '+err.message);}finally{running=false;locked();}
}
function show(){
 if(host?.isConnected){host.style.removeProperty('display');refresh().catch(e=>setStatus(e.message));return;}
 host=document.createElement('div');host.setAttribute('data-n360-qa-studio','');host.style.cssText='all:initial!important;position:fixed!important;right:12px!important;bottom:12px!important;z-index:2147483647!important;width:min(345px,calc(100vw - 24px))!important;';root=host.attachShadow({mode:'closed'});
 root.innerHTML=`<style>:host{font:13px/1.45 system-ui;color:#173c40}*{box-sizing:border-box}section{font:13px/1.45 system-ui;background:#fff;border:1px solid #c9ddda;border-radius:12px;box-shadow:0 6px 26px #0003;overflow:hidden;max-height:min(82vh,680px);display:flex;flex-direction:column}header{background:#103d40;color:#fff;padding:10px 12px;display:flex;justify-content:space-between;align-items:center}header button{background:#245559;color:#fff;border:0;min-height:25px}h3,p{margin:0}small{color:#526a6d}main{padding:11px;overflow:auto}button,input,select{font:inherit}button{border:1px solid #cbdcda;border-radius:7px;background:white;color:#173c40;padding:7px 8px;cursor:pointer;min-height:34px}button.primary{background:#087f79;color:white;border-color:#087f79}button:disabled{opacity:.5;cursor:default}input,select{width:100%;border:1px solid #cbdcda;border-radius:6px;padding:7px;margin:5px 0}div.row{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap}.row button{flex:1}#status{background:#edf6f4;padding:8px;border-radius:6px;overflow-wrap:anywhere;margin:8px 0}ul{margin:5px 0;padding-left:20px;max-height:100px;overflow:auto}.pass{color:#137455}.fail{color:#b42318}.skip{color:#677784}hr{border:0;border-top:1px solid #dde8e6;margin:10px 0}label{display:block;font-size:12px}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #087f79}</style><section><header><div><strong>N360 QA Studio</strong><div style="font-size:10px;color:#c6e1dd">DEV · Embedded runner</div></div><button id="close" aria-label="Đóng QA Studio">×</button></header><main><p><small>Chỉ DOM đang hiển thị. Không nhập mật khẩu, tạo/hủy booking hoặc thanh toán.</small></p><div class="row"><button id="smoke" class="primary">Run smoke test</button><button id="stop" disabled>Dừng</button></div><div id="status" role="status" aria-live="polite">Sẵn sàng kiểm thử.</div><ul id="last"></ul><hr><h3>Kịch bản regression</h3><select id="suite" aria-label="Suite"></select><div class="row"><button id="run" class="primary">Run suite</button><button id="refresh">Làm mới</button></div><hr><h3>Record &amp; Replay</h3><label for="name">Tên suite (không chứa tên khách)</label><input id="name" maxlength="100" placeholder="Appointment - date view"><div class="row"><button id="record">Bắt đầu ghi</button><button id="cancel">Hủy bản ghi</button></div><small>Click tab ARIA thật để ghi thao tác. Chọn assertion để ghi kết quả mong đợi.</small><p id="record-state"></p><ul id="steps"></ul><label for="expected">Text mong đợi / số dòng (để trống khi lấy baseline)</label><input id="expected" maxlength="160" placeholder="Ví dụ: Appointment hoặc 11"><div class="row"><button id="visible">Thấy phần tử</button><button id="text">Có text</button><button id="count">Đếm dòng</button></div><div class="row"><button id="save" class="primary">Lưu suite</button></div><small>Kết quả lưu cục bộ. Mở trang Admin từ side panel Chrome.</small></main></section>`;
 document.documentElement.append(host);document.addEventListener('click',recordClicks,true);
 const $=id=>root.getElementById(id);$('close').onclick=()=>{if(running){stop=true;setStatus('Đang dừng test.');return;}if(record&&!confirm('Đóng QA Studio và bỏ bản ghi chưa lưu?'))return;record=null;stopPick();recordView();host.style.setProperty('display','none','important');};$('smoke').onclick=()=>run('smoke');$('run').onclick=()=>run('suite');$('stop').onclick=()=>{stop=true;setStatus('Đang dừng…');};$('refresh').onclick=()=>refresh().catch(e=>setStatus(e.message));
 $('record').onclick=()=>{if(record&&!confirm('Bỏ bản ghi hiện tại?'))return;stopPick();record={id:crypto.randomUUID(),name:'',route:location.pathname,steps:[]};recordView();setStatus('Đang ghi. Thao tác tab hoặc thêm assertion.');};$('cancel').onclick=()=>{record=null;stopPick();recordView();setStatus('Đã hủy bản ghi.');};for(const type of ['visible','text','count'])$(type).onclick=()=>choose(type);
 $('save').onclick=async()=>{try{if(!record)throw Error('Chưa bắt đầu ghi.');if(record.route!==location.pathname)throw Error('Đường dẫn đã đổi; quay lại trang ban đầu.');record.name=$('name').value.trim();const s=Q.suite(record);await send('qa:saveSuite',{suite:s});record=null;recordView();await refresh();$('suite').value=s.id;setStatus('Đã lưu suite. Có thể Run suite ngay.');}catch(e){setStatus(e.message);}};
 recordView();refresh().catch(e=>setStatus(e.message));
}
globalThis.__n360QAStudio={show,runSmoke:async()=>{show();await run('smoke');}};
})();
