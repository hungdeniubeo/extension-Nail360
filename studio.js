(()=>{
'use strict';
const $=id=>document.getElementById(id),state=$('studio-state');
async function embed(smoke){
  $('qa-embed').disabled=$('qa-smoke').disabled=true;state.textContent='Đang mở QA Studio…';
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!tab.url||new URL(tab.url).origin!=='https://dev.nail360.info')throw Error('Chỉ chạy trên https://dev.nail360.info. Hãy mở trang DEV đã đăng nhập và cấp Site access.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['qa-core.js','qa-page.js']});
    const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(run)=>{const api=globalThis.__n360QAStudio;if(!api)return false;api.show();if(run)api.runSmoke();return true;},args:[smoke]});
    if(!r?.result)throw Error('Không khởi tạo được runner ở tab chính.');
    state.textContent=smoke?'Đã yêu cầu chạy smoke test. Xem kết quả trên trang hoặc Admin.':'Đã mở QA Studio trong website. Bạn có thể đóng side panel.';
  }catch(e){state.textContent='Không mở được QA Studio: '+e.message;}
  finally{$('qa-embed').disabled=$('qa-smoke').disabled=false;}
}
$('qa-embed').addEventListener('click',()=>embed(false));$('qa-smoke').addEventListener('click',()=>embed(true));
$('qa-admin').addEventListener('click',async()=>{try{await chrome.tabs.create({url:chrome.runtime.getURL('admin.html')});}catch(e){state.textContent=e.message;}});
})();
