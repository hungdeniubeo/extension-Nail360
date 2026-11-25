/* Runs in Chrome's isolated world only after an explicit user action. */
(()=>{
  'use strict';
  if(globalThis.__n360SupportCapture)return;
  const LIMIT=2000, COLS=40, CELL=2000;
  let candidates=[];let scanGeneration=0;let stopPicking=null;
  const text=el=>(el?.innerText||'').replace(/\r\n?/g,'\n').trim();
  function visible(el){
    if(!el||!(el instanceof Element)||!el.getClientRects().length)return false;
    for(let p=el;p && p!==document.documentElement;p=p.parentElement){
      const s=getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse')return false;
    }
    return true;
  }
  const scopeSelector='table,[role="grid"],[role="treegrid"],[role="table"]';
  function cellValues(row, owner){
    const native=row.tagName==='TR';
    const cells=native?Array.from(row.cells):Array.from(row.querySelectorAll('[role="cell"],[role="gridcell"],[role="columnheader"],[role="rowheader"]')).filter(c=>c.closest('[role="row"]')===row);
    return cells.filter(c=>visible(c)&&c.closest(scopeSelector)===owner).flatMap(c=>{
      const span=Math.max(1,Math.min(COLS,Number(c.getAttribute('colspan')||c.getAttribute('aria-colspan'))||1));
      const value=text(c);return [value,...Array(span-1).fill('')];
    });
  }
  function isHeader(row){
    if(row.closest('thead'))return true;
    const cells=Array.from(row.querySelectorAll('th,td,[role="cell"],[role="gridcell"],[role="columnheader"],[role="rowheader"]'));
    return cells.length>0&&cells.every(c=>c.matches('th:not([scope="row"]),[role="columnheader"]'));
  }
  function readTable(el){
    const rows=Array.from(el.querySelectorAll('tr,[role="row"]')).filter(r=>r.closest(scopeSelector)===el&&visible(r));
    const headerRows=rows.filter(isHeader);
    const headers=headerRows.length?cellValues(headerRows.at(-1),el):[];
    const body=rows.filter(r=>!isHeader(r)&&!r.closest('tfoot')).map(r=>cellValues(r,el)).filter(r=>r.some(Boolean));
    return {headers,rows:body,kind:'table',rawCount:body.length,notes:[headerRows.length>1?'Bảng nhiều hàng tiêu đề: dùng hàng tiêu đề cuối.':'',el.querySelector('[rowspan]:not([rowspan=\"1\"]),[aria-rowspan]:not([aria-rowspan=\"1\"])')?'Có ô gộp theo chiều dọc (rowspan); cần kiểm tra cột thủ công.':''].filter(Boolean).join(' ')};
  }
  function label(el,i){
    const explicit=el.getAttribute('aria-label')||el.getAttribute('title')||text(el.querySelector('caption'));
    if(explicit)return explicit.slice(0,100);
    const headings=Array.from(document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')).filter(h=>visible(h)&&(h.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING));
    return text(headings.at(-1)).slice(0,90)||`Bảng ${i+1}`;
  }
  function meta(d){
    const truncated=d.rows.length>LIMIT||d.headers.length>COLS||d.rows.some(r=>r.length>COLS||r.some(v=>v.length>CELL));
    let rows=d.rows.slice(0,LIMIT).map(r=>r.slice(0,COLS).map(v=>v.slice(0,CELL)));let chars=0;const cut=rows.findIndex(r=>{chars+=r.reduce((n,v)=>n+v.length+4,0);return chars>1000000;});if(cut>=0)rows=rows.slice(0,cut);
    return {...d,headers:d.headers.slice(0,COLS).map(v=>v.slice(0,CELL)),rows,truncated:truncated||cut>=0,source:location.origin+location.pathname,caption:(d.caption||document.title).slice(0,150),capturedAt:new Date().toISOString()};
  }
  function scan(){
    scanGeneration++;
    candidates=Array.from(document.querySelectorAll(scopeSelector)).filter(visible).map((el,i)=>{
      const data=readTable(el);return {el,data,label:label(el,i)};
    }).filter(c=>c.data.rows.length>0).sort((a,b)=>b.data.rows.length-a.data.rows.length).slice(0,25);
    return candidates.map((c,i)=>({id:`${scanGeneration}:${i}`,label:c.label,count:c.data.rows.length,headers:c.data.headers.slice(0,8).map(v=>v.slice(0,80)),kind:c.el.tagName}));
  }
  function capture(id){
    const [generation,index]=String(id).split(':').map(Number);const c=generation===scanGeneration?candidates[index]:null;if(!c||!c.el.isConnected||!visible(c.el))throw Error('Bảng đã thay đổi. Quét lại trang.');
    const fresh=readTable(c.el);if(!fresh.rows.length)throw Error('Bảng không còn dòng dữ liệu.');
    return meta({...fresh,caption:c.label});
  }
  function findRepeated(target){
    // For non-table calendar/list layouts: choose a sibling group only if
    // elements share a structural signature. Avoid selecting the entire page.
    for(let node=target, depth=0;node&&node.parentElement&&depth<8;node=node.parentElement,depth++){
      const parent=node.parentElement;
      if(parent.matches('body,html,nav,header,footer,form,[role="navigation"]'))break;
      if(!visible(node)||!text(node))continue;
      const same=Array.from(parent.children).filter(s=>s.tagName===node.tagName&&visible(s)&&text(s)&&!s.matches('script,style,button,input,select,textarea,svg'));
      const tokens=Array.from(node.classList).filter(c=>c.length<80);
      let matched=tokens.length?same.filter(s=>tokens.some(c=>s.classList.contains(c))):same;
      if(matched.length<2)continue;
      const lines=matched.map(el=>text(el).split(/\n+/).map(s=>s.trim()).filter(Boolean));
      if(lines.some(r=>r.length>COLS)||lines.every(r=>r.length===1&&r[0].length>300))continue;
      return {el:parent,items:matched,kind:'cards'};
    }
    return null;
  }
  function identify(el){
    const table=el?.closest(scopeSelector);
    if(table&&visible(table))return{el:table,kind:'table'};
    return el?findRepeated(el):null;
  }
  function pick(){
    if(stopPicking)stopPicking('Đã hủy lượt chọn trước.');
    return new Promise(resolve=>{
      let current=null, last=null;
      const shield=document.createElement('div'), overlay=document.createElement('div'), hint=document.createElement('div');
      shield.style.cssText='position:fixed;inset:0;z-index:2147483645;pointer-events:auto;background:transparent;cursor:crosshair;touch-action:none;';
      overlay.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #23a699;background:rgba(35,166,153,.10);box-shadow:0 0 0 1px white;border-radius:4px;display:none;box-sizing:border-box;';
      hint.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;top:12px;left:12px;max-width:calc(100vw - 24px);background:#103b3e;color:white;font:600 13px/1.5 system-ui;padding:10px 14px;border-radius:8px;box-shadow:0 3px 12px #0004;';
      hint.textContent='N360 Support: chọn bảng hoặc nhóm dòng lặp lại. Esc để hủy.';
      document.documentElement.append(shield,overlay,hint);
      let timer;
      function finish(result){clearTimeout(timer);shield.removeEventListener('pointermove',move);shield.removeEventListener('click',click);document.removeEventListener('keydown',keydown,true);window.removeEventListener('scroll',refresh,true);shield.remove();overlay.remove();hint.remove();stopPicking=null;resolve(result);}
      stopPicking=message=>finish({error:message});
      function refresh(){if(!current||!current.el.isConnected){overlay.style.display='none';return;}const r=current.el.getBoundingClientRect();Object.assign(overlay.style,{display:'block',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});}
      function underlying(e){return document.elementsFromPoint(e.clientX,e.clientY).find(el=>el!==shield&&el!==overlay&&el!==hint);}
      function suppress(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}
      function move(e){e.stopPropagation();const target=underlying(e);if(target===last)return;last=target;current=identify(target);refresh();}
      function click(e){
        // Always suppress the chosen click; no salon action should be triggered.
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        current=identify(underlying(e));
        if(!current){hint.textContent='Không tìm được bảng/nhóm dòng. Chọn vùng khác hoặc nhấn Esc.';return;}
        try{
          let data;
          if(current.kind==='table')data=readTable(current.el);
          else {const rows=current.items.map(el=>text(el).split(/\n+/).map(s=>s.trim()).filter(Boolean));data={headers:[],rows,rawCount:rows.length,kind:'cards',notes:'Nhóm dòng nhận dạng thử nghiệm; thứ tự các dòng chữ có thể khác nhau. Kiểm tra cột trước khi đối chiếu.'};}
          if(!data.rows.length){hint.textContent='Vùng này không có dữ liệu. Chọn lại.';return;}
          finish({data:meta(data)});
        }catch(err){finish({error:err.message});}
      }
      function keydown(e){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish({error:'Đã hủy chọn vùng.'});}}
      shield.addEventListener('pointermove',move);shield.addEventListener('click',click);for(const event of ['pointerdown','pointerup','mousedown','mouseup','dblclick','contextmenu'])shield.addEventListener(event,suppress);document.addEventListener('keydown',keydown,true);window.addEventListener('scroll',refresh,true);
      timer=setTimeout(()=>finish({error:'Hết thời gian chọn vùng. Thử lại nếu cần.'}),45000);
    });
  }
  function inspect(){
    return {source:location.origin+location.pathname,title:document.title.slice(0,150),online:navigator.onLine,viewport:`${innerWidth} × ${innerHeight}`,tables:scan().length,headings:Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]')).filter(visible).slice(0,12).map(h=>text(h).slice(0,100)),time:new Date().toISOString()};
  }
  globalThis.__n360SupportCapture={scan,capture,pick,inspect};
})();
