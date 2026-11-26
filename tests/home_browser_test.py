from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://dev.nail360.info/light/admin/home'
HTML = '''<!doctype html><html><body><header><input name="search" placeholder="Search" value="PRIVATE-INPUT"><button>View <span>Turn List</span></button><button>Check Out</button><button>Messages</button><button>Notifications</button><button>All Status</button></header><main><aside><button><span>Add Service Ticket</span></button><div><span>No guests in the waiting list</span></div><article><span>PRIVATE-CUSTOMER</span><div><span>Walk-In</span></div><button>...</button></article></aside><div><article><span>PRIVATE-TECHNICIAN</span><div><span>Turn: 0</span></div></article><article><span>Turn: 1.5</span></article><div hidden><span>Walk-In</span><span>Turn: 99</span></div></div></main></body></html>'''
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page()
    page.set_content(HTML)
    for name in ['audit-core.js','audit-dom.js','deep-agent.js']:
        page.add_script_tag(content=(ROOT/name).read_text().replace('location.origin','"https://dev.nail360.info"').replace('location.pathname','"/light/admin/home"'))
    h=page.evaluate('window.__n360AuditDOM.homeSignals()')
    assert h['counts']['walkIn']==1,h
    assert h['counts']['emptyWaitingList']==1,h
    assert h['counts']['addTicket']==1 and h['counts']['search']==1 and h['counts']['turnList']==1,h
    assert h['turnValues']==[0,1.5],h
    assert not h['limited']
    assert 'PRIVATE-' not in str(h)
    assert all(page.locator(s['selector']).count()==1 for s in h['signals'] if s['selector'])
    checks=page.evaluate('window.N360Audit.scan(window.__n360AuditDOM.snapshot())')
    d={c['code']:c for c in checks}
    assert d['HOME-CONTROLS']['status']=='PASS'
    assert d['HOME-WAITING']['status']=='SKIP'
    assert d['HOME-TURN']['status']=='SKIP'
    assert not any(x['category']=='business' and x['status']=='PASS' for x in checks)
    assert 'PRIVATE-' not in str(checks)
    assert not any(c['label']=='Check Out' for c in page.evaluate('window.__n360DeepAgent.controls().controls'))
    page.evaluate("document.querySelector('aside').remove()")
    d={c['code']:c for c in page.evaluate('window.N360Audit.scan(window.__n360AuditDOM.snapshot())')}
    assert d['HOME-CONTROLS']['status']=='SKIP'
    assert d['HOME-WAITING']['status']=='SKIP'
    b.close()
print('HOME fixture: counts, nested labels, hidden items, Turn zero/fraction, structural selectors, privacy, checkout guard, missing controls, no unsupported business PASS: OK')
