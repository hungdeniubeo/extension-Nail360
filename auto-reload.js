/* Reload a trusted unpacked build only after the local Mac updater installs it.
 * No remote requests; keep local history and unfinished QA work intact. */
(()=>{
'use strict';
const ALARM='n360-auto-reload', KEY='n360AutoReloadAttempt', DEV='https://dev.nail360.info/*';
const parse=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,4})(?:\.(?:0|[1-9]\d{0,4})){0,3}$/.test(v)&&v.split('.').every(x=>Number(x)<=65535)?v.split('.').map(Number):null;
function newer(a,b){const x=parse(a),y=parse(b);if(!x||!y)return false;for(let i=0;i<4;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0;}return false;}
let checking=false;
async function safe(){
  // Any open extension page may contain an unsaved report or an active scan.
  const contexts=await chrome.runtime.getContexts({});
  if(contexts.some(c=>c.contextType!=='BACKGROUND'))return false;
  const {n360SupportSession:s}=await chrome.storage.session.get('n360SupportSession');
  if(s&&(s.A||s.B||s.page))return false;
  const tabs=await chrome.tabs.query({url:DEV});
  if(tabs.length>20)return false;
  for(const tab of tabs){
    if(!Number.isInteger(tab.id))return false;
    const [probe]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>Array.from(document.querySelectorAll('[data-n360-qa-studio]')).some(el=>getComputedStyle(el).display!=='none')});
    if(probe?.result!==false)return false;
  }
  // Recheck extension views and snapshots after the asynchronous page probes.
  const views=await chrome.runtime.getContexts({});
  if(views.some(c=>c.contextType!=='BACKGROUND'))return false;
  const {n360SupportSession:latest}=await chrome.storage.session.get('n360SupportSession');
  return !(latest&&(latest.A||latest.B||latest.page));
}
async function check(){
  if(checking)return;checking=true;
  try{
    const res=await fetch(chrome.runtime.getURL('update-status.json')+'?t='+Date.now(),{cache:'no-store'});
    if(!res.ok)return;
    const marker=await res.json(), current=chrome.runtime.getManifest().version, candidate=marker?.version;
    if(!newer(candidate,current))return;
    const previous=(await chrome.storage.local.get(KEY))[KEY];
    if(previous?.from===current&&previous?.to===candidate&&Date.now()-previous.at<600000)return;
    if(!await safe())return;
    // Wait for the existing QA storage queue; then recheck before applying.
    await qaQueue;
    if(!await safe())return;
    await chrome.storage.local.set({[KEY]:{from:current,to:candidate,at:Date.now()}});
    chrome.runtime.reload();
  }catch(e){console.warn('N360 auto reload deferred:',String(e?.message||e));}
  finally{checking=false;}
}
async function ensureAlarm(){try{if(!await chrome.alarms.get(ALARM))await chrome.alarms.create(ALARM,{delayInMinutes:1,periodInMinutes:1});}catch(e){console.warn('N360 alarm:',e);}}
chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void check();});
chrome.runtime.onStartup.addListener(()=>{void ensureAlarm();void check();});
chrome.runtime.onInstalled.addListener(()=>{void ensureAlarm();});
void ensureAlarm();
})();
