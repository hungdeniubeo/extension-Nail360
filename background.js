// Opening the panel from the toolbar grants temporary activeTab access.
function setup() {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.warn);
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
setup();
