// Opening the panel from the toolbar grants temporary activeTab access.
function setup() {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.warn);
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
setup();

// QA data stays in this Chrome profile. No network or external messaging.
importScripts('qa-core.js');
const Q=globalThis.N360QA;
let qaQueue=Promise.resolve();
async function qaAction(m){
  const data=Q.store((await chrome.storage.local.get(Q.KEY))[Q.KEY]);
  switch(m.type){
    case 'qa:list':return data;
    case 'qa:openAdmin':await chrome.tabs.create({url:chrome.runtime.getURL('admin.html')});return data;
    case 'qa:saveSuite':data.suites=Q.upsert(data.suites,Q.suite(m.suite),Q.MAX_SUITES);break;
    case 'qa:deleteSuite':data.suites=data.suites.filter(s=>s.id!==m.id);break;
    case 'qa:saveRun':{const r=Q.run(m.run);data.runs=Q.upsert(data.runs,r,Q.MAX_RUNS);break;}
    case 'qa:issue':{if(!Q.ISSUES.includes(m.status))throw Error('Invalid issue status');const r=data.runs.find(x=>x.id===m.runId);const t=r?.results.find(x=>x.id===m.testId&&x.status==='FAIL');if(!t)throw Error('Issue not found');t.issue=m.status;break;}
    case 'qa:clearRuns':data.runs=[];break;
    default:throw Error('Unknown QA action');
  }
  await chrome.storage.local.set({[Q.KEY]:data});return data;
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(typeof m?.type!=='string'||!m.type.startsWith('qa:'))return;
  const extensionPage=typeof sender.url==='string'&&['panel.html','admin.html'].some(p=>sender.url===chrome.runtime.getURL(p));
  const devPage=Q.isDev(sender.url)&&sender.frameId===0;
  if(sender.id!==chrome.runtime.id||(!extensionPage&&!devPage)){reply({ok:false,error:'Unauthorized QA context'});return;}
  const allowed=extensionPage||['qa:list','qa:saveSuite','qa:saveRun','qa:openAdmin'].includes(m.type);
  if(!allowed){reply({ok:false,error:'Unauthorized QA action'});return;}
  const task=qaQueue.then(()=>qaAction(m));qaQueue=task.catch(()=>{});
  task.then(data=>reply({ok:true,data}),err=>reply({ok:false,error:String(err.message||err)}));return true;
});

// Checks the local update marker even while the side panel is closed.
importScripts('auto-reload.js');
