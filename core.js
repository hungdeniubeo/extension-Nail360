/* Pure data functions. No DOM, extension APIs, or network access. */
(function(root){
  'use strict';
  const MAX_ROWS = 2000, MAX_COLUMNS = 40, MAX_CELL = 2000, MAX_TOTAL = 1000000;
  const text = v => String(v ?? '').replace(/\r\n?/g, '\n').trim();
  const key = v => text(v).normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const uniqueHeaders = (headers, n) => {
    const used = new Set();
    return Array.from({length:n}, (_,i)=>{
      const base=text(headers[i]) || `Cột ${i+1}`;
      let label=base, suffix=2;
      while(used.has(key(label))) label=`${base} (${suffix++})`;
      used.add(key(label)); return label;
    });
  };
  function cleanDataset(raw){
    const input=Array.isArray(raw.rows) ? raw.rows : [];
    let rows=input.filter(Array.isArray).slice(0,MAX_ROWS).map(r=>r.slice(0,MAX_COLUMNS).map(v=>text(v).slice(0,MAX_CELL))).filter(r=>r.some(Boolean));
    let size=0, totalTruncated=false;
    const cut=rows.findIndex(r=>{size+=r.reduce((n,v)=>n+v.length+4,0);return size>MAX_TOTAL;});
    if(cut>=0){rows=rows.slice(0,cut);totalTruncated=true;}
    const n=Math.min(MAX_COLUMNS,Math.max((raw.headers || []).length,0,...rows.map(r=>r.length)));
    return {...raw,headers:uniqueHeaders(raw.headers || [],n),rows:rows.map(r=>Array.from({length:n},(_,i)=>r[i]||'')),truncated:!!raw.truncated || totalTruncated || input.length>MAX_ROWS || (raw.headers||[]).length>MAX_COLUMNS || input.some(r=>Array.isArray(r)&&(r.length>MAX_COLUMNS||r.some(v=>text(v).length>MAX_CELL)))};
  }
  function parseDelimited(source, delimiter){
    let rows=[], row=[], cell='', quoted=false;
    for(let i=0;i<source.length;i++){
      const c=source[i];
      if(quoted){if(c==='"' && source[i+1]==='"'){cell+='"'; i++;}else if(c==='"'){quoted=false;}else{cell+=c;}}
      else if(c==='"' && cell===''){quoted=true;}
      else if(c===delimiter){row.push(cell);cell='';}
      else if(c==='\n'){row.push(cell); rows.push(row);row=[];cell='';}
      else{cell+=c;}
    }
    if(quoted) throw Error('Dữ liệu có dấu ngoặc kép chưa đóng. Kiểm tra CSV hoặc dùng chế độ một dòng một mục.');
    row.push(cell);rows.push(row);
    return rows.filter(r=>r.some(v=>text(v)));
  }
  function detectDelimiter(source){
    // TSV copied from a spreadsheet takes precedence. A single-column list
    // stays a list unless multiple lines form a consistent CSV shape.
    if(source.includes('\t')) return '\t';
    const lines=source.split('\n').filter(s=>s.trim()).slice(0,8);
    if(lines.length>=2){
      for(const d of [',',';']){
        try {const p=parseDelimited(lines.join('\n'),d);if(p.length>=2&&p[0].length>1&&p.every(r=>r.length===p[0].length))return d;} catch{}
      }
    }
    return null;
  }
  function parsePaste(input, format='auto', hasHeader=false){
    const src=String(input??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/^\n+|\n+$/g,'');
    if(!src.trim())throw Error('Chưa có dữ liệu để lưu.');
    if(src.length>5000000)throw Error('Dữ liệu quá lớn. Hãy chia nhỏ trước khi dán.');
    const d=format==='tsv'?'\t':format==='csv'?',':format==='semi'?';':format==='list'?null:detectDelimiter(src);
    const rows=d?parseDelimited(src,d):src.split('\n').map(s=>[s]).filter(r=>r[0].trim());
    const headers=hasHeader?(rows.shift()||[]):[];
    if(!rows.length)throw Error('Không có dòng dữ liệu sau hàng tiêu đề.');
    return cleanDataset({headers,rows,source:'Dán thủ công',kind:'paste',capturedAt:new Date().toISOString(),format:d?'Bảng':'Danh sách'});
  }
  function guessColumn(headers){
    const patterns=[/^(service|services|service name|service type|dịch vụ|tên dịch vụ)$/i,/service|dịch vụ/i,/appointment\s*(id|number|#)|booking\s*(id|number)|ticket\s*(id|number)/i,/^id$/i];
    for(const pattern of patterns){const i=headers.findIndex(h=>pattern.test(h));if(i>=0)return i;}
    return 0;
  }
  function splitValues(value,mode){
    const t=text(value); if(!t)return [];
    let xs=[t];
    if(mode==='lines')xs=t.split(/\n+/);
    if(mode==='separators')xs=t.split(/[\n;|]+/);
    if(mode==='comma')xs=t.split(/[\n;,|]+/);
    return xs.map(text).filter(Boolean);
  }
  function group(dataset, selection, split='none'){
    const map=new Map();let empty=0,units=0;
    if(!dataset)return {map,empty,units,rows:0};
    const primary=Number(selection.primary), secondary=selection.secondary===''||selection.secondary==null?-1:Number(selection.secondary);
    for(const row of dataset.rows){
      const main=splitValues(row[primary],split), second=secondary<0?'':text(row[secondary]);
      if(!main.length || (secondary>=0&&!second)){empty++;continue;}
      for(const value of main){
        const id=JSON.stringify([key(value),secondary<0?'':key(second)]);
        const item=map.get(id)||{label:secondary<0?value:`${value} | ${second}`,count:0};
        item.count++;units++;map.set(id,item);
      }
    }
    return {map,empty,units,rows:dataset.rows.length};
  }
  function compare(a,b,sa,sb,split='none'){
    const A=group(a,sa,split),B=group(b,sb,split);
    const all=new Set([...A.map.keys(),...B.map.keys()]);
    const entries=[...all].map(k=>{const x=A.map.get(k),y=B.map.get(k);const ca=x?.count||0,cb=y?.count||0;return{label:x?.label||y?.label,a:ca,b:cb,delta:ca-cb,status:ca===cb?'match':!ca?'onlyB':!cb?'onlyA':'mismatch'};});
    entries.sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta)||x.label.localeCompare(y.label,'en',{numeric:true}));
    const differences=entries.filter(r=>r.delta!==0);
    return {A,B,entries,differences,net:A.units-B.units,absolute:differences.reduce((s,r)=>s+Math.abs(r.delta),0)};
  }
  function csv(rows){
    const safe=v=>{
      let s=String(v??'');
      // Avoid formula execution if an exported text cell is opened in Excel.
      if(typeof v==='string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    return '\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n');
  }
  const api={MAX_ROWS,MAX_COLUMNS,MAX_CELL,cleanDataset,parsePaste,guessColumn,group,compare,csv,key};
  if(typeof module==='object' && module.exports)module.exports=api;else root.N360Core=api;
})(globalThis);
