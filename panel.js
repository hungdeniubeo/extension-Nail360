(()=>{
'use strict';
const C=globalThis.N360Core,$=id=>document.getElementById(id),E=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;};
const initial=()=>({A:null,B:null,selection:{A:{primary:0,secondary:''},B:{primary:0,secondary:''}},split:'none',page:null});
let state=initial(),busy=false,mode='diff',comparison=null,openTab='compare';
const allowedHost=h=>['nail360pro.com','nail360.info','nail360.com'].some(base=>h===base||h.endsWith('.'+base));
let saveQueue=Promise.resolve();
function save(){const snapshot=structuredClone(state);saveQueue=saveQueue.catch(()=>{}).then(()=>chrome.storage.session.set({n360SupportSession:snapshot})).catch(err=>notify('Không lưu được phiên tạm: '+err.message,'info'));}
function notify(message,type='success'){$('status').hidden=!message;$('status').textContent=message||'';$('status').className=type;}
function makeButton(label,fn,cls=''){const b=E('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function options(select,items,value){for(const item of items){const opt=E('option','',item.label);opt.value=item.value;select.append(opt);}select.value=String(value);}
function setBusy(value){busy=value;document.querySelectorAll('button[data-capture]').forEach(b=>b.disabled=value);$('inspect').disabled=value;}
function showTab(which){openTab=which;for(const tab of ['compare','qa']){$(tab+'-view').hidden=tab!==which;$('tab-'+tab).classList.toggle('active',tab===which);$('tab-'+tab).setAttribute('aria-selected',String(tab===which));}notify('');}
function safeSource(url){try{const u=new URL(url);return u.origin+u.pathname;}catch{return String(url||'').slice(0,250);}}
function formatTime(v){try{return new Date(v).toLocaleString('vi-VN');}catch{return '';}}
function replaceSlot(slot,raw){const d=C.cleanDataset(raw);if(!d.rows.length||!d.headers.length)throw Error('Không có dòng hoặc cột dữ liệu.');state[slot]=d;state.selection[slot]={primary:C.guessColumn(d.headers),secondary:''};save();renderSlot(slot);renderResults();notify(`Đã lưu bảng ${slot}: ${d.rows.length} dòng. Kiểm tra lại cột cần đối chiếu.`);}
function clearSlot(slot){state[slot]=null;state.selection[slot]={primary:0,secondary:''};save();renderSlot(slot);renderResults();notify('Đã xóa bảng '+slot+'.');}
function captureButton(label,fn,cls){const b=makeButton(label,fn,cls);b.dataset.capture='true';b.disabled=busy;return b;}
function renderSlot(slot){
  const root=$('slot-'+slot),d=state[slot],selection=state.selection[slot];root.replaceChildren();
  const head=E('div','snapshot-head');head.append(E('div','letter',slot));const title=E('div','snapshot-title');title.append(E('strong','',slot==='A'?'Trang A · nguồn đối chiếu':'Trang B · nguồn cần kiểm tra'));title.append(E('div','source',d?(d.caption?d.caption+' · ':'')+safeSource(d.source):'Chưa chụp dữ liệu'));head.append(title,E('span',d?'count loaded':'count',d?`${d.rows.length} dòng`:'Trống'));root.append(head);
  const actions=E('div','actions');actions.append(captureButton('Quét bảng',()=>scanSlot(slot),'primary'),captureButton('Chọn vùng',()=>pickSlot(slot)),makeButton('Dán',()=>pasteBox(slot)));if(d)actions.append(makeButton('×',()=>clearSlot(slot),'icon-btn'));root.append(actions);
  if(d){
    root.append(E('div','meta',`${formatTime(d.capturedAt)} · ${d.headers.length} cột${d.kind==='cards'?' · vùng chọn thử nghiệm':''}${d.kind==='demo'?' · dữ liệu giả lập':''}`));
    if(d.truncated||d.notes){root.append(E('div','callout',[d.truncated?'Dữ liệu vượt giới hạn (2.000 dòng / 40 cột / 2.000 ký tự mỗi ô / 1 triệu ký tự mỗi bảng); kết quả có thể thiếu.':'',d.notes||''].filter(Boolean).join('\n')));}
    const grid=E('div','column-grid');const primary=E('select'),secondary=E('select');primary.id='primary-'+slot;secondary.id='secondary-'+slot;
    const columns=d.headers.map((h,i)=>({label:h,value:String(i)}));options(primary,columns,selection.primary);options(secondary,[{label:'Không dùng',value:''},...columns.filter(x=>Number(x.value)!==Number(selection.primary))],selection.secondary);
    const field=(label,select)=>{const div=E('div');const l=E('label','',label);l.htmlFor=select.id;div.append(l,select);return div;};grid.append(field('Cột chính',primary),field('Cột ghép (tùy chọn)',secondary));root.append(grid);
    primary.addEventListener('change',()=>{state.selection[slot].primary=Number(primary.value);if(String(state.selection[slot].secondary)===primary.value)state.selection[slot].secondary='';save();renderSlot(slot);renderResults();});
    secondary.addEventListener('change',()=>{state.selection[slot].secondary=secondary.value;save();renderResults();});
    const details=E('details','preview');details.append(E('summary','','Xem trước 5 dòng (có thể chứa thông tin khách hàng)'));details.addEventListener('toggle',()=>{if(details.open&&!details.querySelector('table')){const sc=E('div','table-scroll');sc.append(table(d.headers,d.rows.slice(0,5)));details.append(sc);}});root.append(details);
  }
  root.append(E('div','dynamic'));
}
function table(headers,rows){const t=E('table');const thead=E('thead'),hr=E('tr');for(const h of headers)hr.append(E('th','',h));thead.append(hr);const tbody=E('tbody');for(const row of rows){const tr=E('tr');for(const v of row)tr.append(E('td','',v));tbody.append(tr);}t.append(thead,tbody);return t;}
function dynamic(slot){const n=$('slot-'+slot).querySelector('.dynamic');n.replaceChildren();return n;}
function pasteBox(slot){
  const root=dynamic(slot),box=E('div','paste-box');const instructions=E('p','muted small','Dán danh sách service (mỗi dòng một mục) hoặc bảng CSV/TSV đã sao chép. Không dán thông tin nhạy cảm nếu không cần.');const area=E('textarea');area.placeholder='Service\nManicure\nPedicure\n…';area.rows=5;area.setAttribute('aria-label','Dữ liệu bảng '+slot);
  const format=E('select');format.setAttribute('aria-label','Định dạng dữ liệu');options(format,[{label:'Tự nhận dạng',value:'auto'},{label:'Một dòng một mục',value:'list'},{label:'TSV (tab)',value:'tsv'},{label:'CSV (dấu phẩy)',value:'csv'},{label:'Dấu chấm phẩy',value:'semi'}],'auto');
  const check=E('label','check-row'),header=E('input');header.type='checkbox';check.append(header,document.createTextNode('Dòng đầu là tên cột'));const act=E('div','actions');act.append(makeButton('Lưu bảng '+slot,()=>{try{replaceSlot(slot,C.parsePaste(area.value,format.value,header.checked));}catch(err){notify(err.message,'error');}},'primary'),makeButton('Hủy',()=>root.replaceChildren()));box.append(instructions,area,E('label','','Định dạng'),format,check,act);root.append(box);area.focus();
}
async function tabAccess(){
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(!tab?.id)throw Error('Không tìm thấy tab web đang mở.');
  if(tab.url){const url=new URL(tab.url);if(!['https:','http:'].includes(url.protocol))throw Error('Hãy mở tab website NAIL360PRO trước.');if(!allowedHost(url.hostname)&&!window.confirm('Tab hiện tại không thuộc domain Nail360 đã biết. Chỉ tiếp tục nếu đây là môi trường salon/test mà mày được phép kiểm tra.'))throw Error('Đã hủy truy cập trang.');}
  try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['capture.js']});}catch(err){throw Error('Chrome chưa cấp quyền đọc tab này. Bấm icon N360 Support trên thanh công cụ Chrome khi đang ở trang cần chụp, sau đó thử lại. (Có thể trang không cho phép extension.)');}
  const [where]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({hostname:location.hostname,protocol:location.protocol})});
  if(!where?.result)throw Error('Không đọc được địa chỉ trang.');
  if(!tab.url&&!allowedHost(where.result.hostname)&&!window.confirm('Trang này không thuộc domain Nail360 đã biết. Chỉ tiếp tục nếu được phép kiểm tra.'))throw Error('Đã hủy truy cập trang.');
  return tab.id;
}
async function invoke(tabId,method,arg){const [res]=await chrome.scripting.executeScript({target:{tabId},func:(method,arg)=>globalThis.__n360SupportCapture[method](arg),args:[method,arg??null]});if(!res||res.result===undefined)throw Error('Không nhận được kết quả từ trang. Có thể trang đã chuyển hoặc tải lại.');return res.result;}
async function scanSlot(slot){if(busy)return;setBusy(true);notify('Đang tìm bảng trên tab hiện tại…');try{
  const tab=await tabAccess(),candidates=await invoke(tab,'scan');
  if(!candidates.length){notify('Không tìm được bảng HTML/ARIA có dữ liệu. Thử Chọn vùng hoặc Dán danh sách.','info');return;}
  if(candidates.length===1){replaceSlot(slot,await invoke(tab,'capture',candidates[0].id));return;}
  const root=dynamic(slot),box=E('div','picker');box.append(E('p','muted small',`Tìm thấy ${candidates.length} bảng. Chọn bảng cần đối chiếu:`));
  for(const item of candidates){const b=makeButton(`${item.label} · ${item.count} dòng${item.headers.length?'\n'+item.headers.join(' · '):''}`,async()=>{if(busy)return;setBusy(true);try{replaceSlot(slot,await invoke(tab,'capture',item.id));}catch(err){notify('Không chụp được bảng: '+err.message,'error');}finally{setBusy(false);}});b.style.whiteSpace='pre-line';box.append(b);}box.append(makeButton('Hủy',()=>root.replaceChildren()));root.append(box);notify('Chọn đúng bảng trong danh sách bên dưới.');
}catch(err){notify(err.message,'error');}finally{setBusy(false);}}
async function pickSlot(slot){if(busy)return;setBusy(true);try{const tab=await tabAccess();notify('Di chuột lên bảng hoặc nhóm dòng trên web, bấm để chọn. Nhấn Esc để hủy.','info');const result=await invoke(tab,'pick');if(result.error){notify(result.error,'info');return;}replaceSlot(slot,result.data);}catch(err){notify(err.message,'error');}finally{setBusy(false);}}
function number(v){return String(v);}function delta(v){return v>0?'+'+v:String(v);}
function stat(value,label,warn){const div=E('div',warn?'stat warn':'stat');div.append(E('strong','',number(value)),E('span','',label));return div;}
function renderResults(){
  $('settings').hidden=!(state.A&&state.B);$('results').hidden=!(state.A&&state.B);comparison=null;if(!state.A||!state.B)return;
  $('split').value=state.split;comparison=C.compare(state.A,state.B,state.selection.A,state.selection.B,state.split);
  const r=comparison;$('stats').replaceChildren(stat(r.A.units,'Mục bên A'),stat(r.B.units,'Mục bên B'),stat(delta(r.net),'Chênh A − B',r.net!==0));
  $('result-state').textContent=r.differences.length?`${r.differences.length} mục lệch`:r.A.units?'Khớp theo khóa':'Không có khóa hợp lệ';$('result-state').className='state-chip '+(r.differences.length?'diff':r.A.units?'same':'');
  const warnings=[];
  if(r.A.empty||r.B.empty)warnings.push(`Bỏ qua dòng có khóa trống: A ${r.A.empty}, B ${r.B.empty}.`);
  if(state.A.truncated||state.B.truncated)warnings.push('Có bảng bị cắt do giới hạn dữ liệu. Không dùng kết quả làm số tổng chính thức.');
  if(state.A.kind==='cards'||state.B.kind==='cards')warnings.push('Vùng chọn thử nghiệm: kiểm tra kỹ các cột trong phần xem trước.');
  if((state.selection.A.secondary!=='')!==(state.selection.B.secondary!==''))warnings.push('Hai bảng đang dùng số cột khóa khác nhau. Chọn cùng loại khóa ở cả A và B.');
  if(state.split!=='none')warnings.push('Đang đếm từng service sau khi tách ô, không phải số appointment.');
  if(!r.A.units||!r.B.units)warnings.push('Một bên không có khóa hợp lệ. Hãy kiểm tra cột chính và cột ghép.');
  $('result-warning').hidden=!warnings.length;$('result-warning').textContent=warnings.join('\n');
  renderTable();
}
function renderTable(){if(!comparison)return;const q=C.key($('search').value),rows=(mode==='diff'?comparison.differences:comparison.entries).filter(r=>C.key(r.label).includes(q));const root=$('result-table');root.replaceChildren();
  const t=E('table'),thead=E('thead'),tr=E('tr');for(const [i,h] of ['Service / khóa','A','B','A − B'].entries())tr.append(E('th',i?'number':'',h));thead.append(tr);t.append(thead);const body=E('tbody');
  for(const r of rows.slice(0,200)){const row=E('tr');row.append(E('td','key',r.label),E('td','number',number(r.a)),E('td','number',number(r.b)),E('td','number '+(r.delta>0?'delta-pos':r.delta<0?'delta-neg':'delta-zero'),delta(r.delta)));body.append(row);}
  if(!rows.length){const row=E('tr'),cell=E('td','muted',q?'Không có mục phù hợp.':mode==='diff'?'Không có chênh lệch theo khóa đã chọn.':'Không có dữ liệu hợp lệ.');cell.colSpan=4;row.append(cell);body.append(row);}t.append(body);root.append(t);
  $('result-summary').textContent=`Dòng gốc: A ${comparison.A.rows} · B ${comparison.B.rows}. ${rows.length>200?'Hiển thị 200/'+rows.length+' mục; CSV có đầy đủ.':`${rows.length} mục đang hiển thị.`}`;
}
function setMode(next){mode=next;$('show-diff').classList.toggle('selected',mode==='diff');$('show-all').classList.toggle('selected',mode==='all');renderTable();}
function columnName(slot){const d=state[slot],s=state.selection[slot];return d.headers[s.primary]+(s.secondary!==''?' + '+d.headers[Number(s.secondary)]:'');}
function resultText(){if(!comparison)return '';const r=comparison;const splitLabel=$('split').selectedOptions[0]?.textContent||state.split;return [
  'NAIL360PRO — A/B DATA CHECK',`A: ${safeSource(state.A.source)} | ${columnName('A')} | ${formatTime(state.A.capturedAt)}`,`B: ${safeSource(state.B.source)} | ${columnName('B')} | ${formatTime(state.B.capturedAt)}`,`Rows: A ${r.A.rows} | B ${r.B.rows}`,`Counted units: A ${r.A.units} | B ${r.B.units} | A-B ${delta(r.net)}`,`Ignored blank-key rows: A ${r.A.empty} | B ${r.B.empty}`,`Split rule: ${splitLabel}`,`Different keys: ${r.differences.length}`,'', 'Key | A | B | A-B',...r.differences.map(x=>`${x.label.replace(/\n/g,' ')} | ${x.a} | ${x.b} | ${delta(x.delta)}`),'','Scope: rendered data only. Confirm matching salon/date/status, pagination, unit of count and selected columns.'].join('\n');}
async function copy(text){try{await navigator.clipboard.writeText(text);notify('Đã sao chép vào clipboard.');}catch{notify('Chrome không cho phép sao chép clipboard. Thử lại khi side panel đang được chọn.','error');}}
function confirmExport(){return window.confirm('Kết quả xuất có các giá trị khóa đã chọn và địa chỉ trang. Kiểm tra dữ liệu khách hàng trước khi chia sẻ. Tiếp tục?');}
function exportResult(){if(!comparison||!confirmExport())return;const rows=[['Key','A','B','A-B','Status'],...comparison.entries.map(x=>[x.label,x.a,x.b,x.delta,x.status])];const url=URL.createObjectURL(new Blob([C.csv(rows)],{type:'text/csv;charset=utf-8'}));const link=E('a');link.href=url;link.download='n360-comparison-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Đã yêu cầu tải CSV. Kiểm tra thư mục Downloads.');}
async function inspect(){if(busy)return;setBusy(true);try{const tab=await tabAccess();state.page=await invoke(tab,'inspect');save();renderPage();notify('Đã đọc thông tin trang.');}catch(err){notify(err.message,'error');}finally{setBusy(false);}}
function renderPage(){const p=state.page;$('page-info').textContent=p?[`Trang: ${p.title}`,`URL: ${safeSource(p.source)}`,`Thời điểm: ${formatTime(p.time)}`,`Viewport: ${p.viewport}`,`Navigator online: ${p.online?'Yes':'No'} (không xác nhận kết nối server)`,`Bảng có dữ liệu: ${p.tables}`,`Tiêu đề: ${p.headings.join(' · ')||'—'}`].join('\n'):'Chưa lấy thông tin trang.';}
function prepareBug(){if(!comparison)return;showTab('qa');$('bug-title').value='[Appointment] A/B count mismatch';$('bug-module').value='Appointment';$('bug-steps').value='1. Open the two pages being compared.\n2. Select the same salon, date range and status filters.\n3. Compare the displayed appointment or service list using the same key.';$('bug-expected').value='Counts and matching keys should be consistent for the same filters and counting unit.';$('bug-actual').value=`A: ${comparison.A.units} counted units. B: ${comparison.B.units} counted units. Difference (A-B): ${delta(comparison.net)}. ${comparison.differences.length} differing keys. Verify whether both pages count the same type of record.`;$('bug-include').checked=false;}
async function copyBug(){const get=id=>$(id).value.trim();if(!get('bug-title')){notify('Nhập tiêu đề bug trước.','error');$('bug-title').focus();return;}
  const p=state.page,include=$('bug-include').checked&&comparison;
  const report=[get('bug-title'),'','Module: '+get('bug-module'),'Environment: '+(get('bug-env')||'Not specified'),...(p?['Page: '+safeSource(p.source),'Captured: '+formatTime(p.time),'Viewport: '+p.viewport]:[]),'','Steps to reproduce:',get('bug-steps')||'Not specified','','Expected result:',get('bug-expected')||'Not specified','','Actual result:',get('bug-actual')||'Not specified',...(include?['','Comparison details:',resultText()]:[])].join('\n');
  if(window.confirm('Bug report có thể chứa URL hoặc thông tin salon/khách hàng. Kiểm tra trước khi gửi. Sao chép?'))await copy(report);
}
function demo(){if((state.A||state.B)&&!window.confirm('Thay bảng A/B hiện tại bằng dữ liệu giả lập?'))return;const make=(services,caption)=>C.cleanDataset({headers:['Appointment ID','Service'],rows:services.map((service,i)=>['DEMO-'+String(i+1).padStart(2,'0'),service]),source:'Dữ liệu mẫu giả lập',caption,kind:'demo',capturedAt:new Date().toISOString()});
  const common=['Manicure','Manicure','Manicure','Pedicure','Pedicure','Pedicure','Gel Polish','Gel Polish','Acrylic Fill'];state.A=make([...common,'Pedicure','Gel Polish'],'Trang A · giả lập');state.B=make(common,'Trang B · giả lập');state.selection={A:{primary:1,secondary:''},B:{primary:1,secondary:''}};state.split='none';save();renderSlot('A');renderSlot('B');renderResults();notify('Dữ liệu mẫu (không phải dữ liệu salon thật): A 11, B 9.');}
function reset(){if((state.A||state.B||state.page)&&!window.confirm('Xóa toàn bộ dữ liệu chụp A/B và thông tin trang trong phiên này?'))return;state=initial();save();$('search').value='';for(const id of ['bug-title','bug-env','bug-steps','bug-expected','bug-actual'])$(id).value='';$('bug-include').checked=false;renderSlot('A');renderSlot('B');renderResults();renderPage();notify('Đã xóa dữ liệu trong phiên extension.');}
async function init(){try{const s=await chrome.storage.session.get('n360SupportSession');if(s.n360SupportSession){state={...initial(),...s.n360SupportSession};for(const slot of ['A','B'])if(state[slot])state[slot]=C.cleanDataset(state[slot]);}}catch(err){notify('Không khôi phục được phiên cũ: '+err.message,'info');}renderSlot('A');renderSlot('B');renderResults();renderPage();}
for(const tab of ['compare','qa'])$('tab-'+tab).addEventListener('click',()=>showTab(tab));$('split').addEventListener('change',()=>{state.split=$('split').value;save();renderResults();});$('show-diff').addEventListener('click',()=>setMode('diff'));$('show-all').addEventListener('click',()=>setMode('all'));$('search').addEventListener('input',renderTable);$('copy-result').addEventListener('click',()=>{if(comparison&&confirmExport())copy(resultText());});$('export-result').addEventListener('click',exportResult);$('create-bug').addEventListener('click',prepareBug);$('inspect').addEventListener('click',inspect);$('copy-bug').addEventListener('click',copyBug);$('load-demo').addEventListener('click',demo);$('reset').addEventListener('click',reset);init();
})();
