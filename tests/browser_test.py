from pathlib import Path
import base64
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':390,'height':1000},accept_downloads=True)
    panel=ctx.new_page(); errors=[];panel.on('pageerror',lambda e:errors.append(str(e)))
    panel.on('dialog',lambda d:d.accept())
    # Mock only Chrome's session storage to test the actual panel UI in a normal browser tab.
    panel.set_content((ROOT/'panel.html').read_text().replace('<script src="core.js" defer></script>','').replace('<script src="panel.js" defer></script>','').replace('<link rel="stylesheet" href="panel.css">','').replace('icons/logo.svg','data:image/svg+xml;base64,'+base64.b64encode((ROOT/'icons/logo.svg').read_bytes()).decode()))
    panel.add_style_tag(content=(ROOT/'panel.css').read_text())
    panel.evaluate("""window.chrome = window.chrome || {}; window._mockStore = {}; window.chrome.storage = {session: {get: async (k)=>({[k]:window._mockStore[k]}), set: async (v)=>Object.assign(window._mockStore,structuredClone(v))}};""")
    panel.add_script_tag(content=(ROOT/'core.js').read_text())
    panel.add_script_tag(content=(ROOT/'panel.js').read_text())
    panel.locator('#tab-compare').click();panel.locator('#slot-A button').first.wait_for();panel.get_by_text('Thử dữ liệu mẫu 11 vs 9',exact=True).click()
    panel.locator('#result-state').wait_for();assert panel.locator('#result-state').inner_text()=='2 mục lệch'
    assert panel.locator('#stats strong').all_inner_texts()==['11','9','+2']
    assert panel.locator('#result-table tbody tr').count()==2
    assert 'Gel Polish' in panel.locator('#result-table').inner_text()
    assert 'Pedicure' in panel.locator('#result-table').inner_text()
    panel.screenshot(path=str(ROOT/'demo-preview.png'),full_page=True)
    panel.get_by_text('Tất cả',exact=True).click();assert panel.locator('#result-table tbody tr').count()==4
    panel.locator('#search').fill('gel');assert panel.locator('#result-table tbody tr').count()==1
    panel.locator('#search').fill('');panel.locator('#show-diff').click()
    with panel.expect_download() as download:
        panel.locator('#export-result').click()
    csv=Path(download.value.path()).read_text(encoding='utf-8-sig');assert 'Gel Polish' in csv and 'Pedicure' in csv
    panel.locator('#create-bug').click();assert 'A: 11' in panel.locator('#bug-actual').input_value();assert not panel.locator('#bug-include').is_checked()
    panel.locator('#tab-compare').click();panel.wait_for_timeout(100);assert panel.evaluate('window._mockStore.n360SupportSession.A.rows.length')==11
    panel.locator('#reset').click();assert panel.locator('#results').is_hidden()
    for slot,values in [('A','Service\nGel\nGel\nPedi'),('B','Service\nGel\nPedi')]:
        area=panel.locator('#slot-'+slot);area.get_by_role('button',name='Dán',exact=True).click();area.locator('textarea').fill(values);area.locator('input[type=checkbox]').check();area.get_by_role('button',name='Lưu bảng '+slot).click()
    assert panel.locator('#stats strong').all_inner_texts()==['3','2','+1'];assert 'Gel' in panel.locator('#result-table').inner_text()
    fixture=ctx.new_page();fixture.set_content('''<h1>Appointments</h1><table aria-label="A appointments"><thead><tr><th>Appointment ID</th><th>Service</th><th style="display:none">Hidden</th></tr></thead><tbody><tr><td>1</td><td>Manicure</td><td style="display:none">secret</td></tr><tr><td>2</td><td>Pedicure</td><td style="display:none">secret</td></tr><tr hidden><td>3</td><td>Hidden row</td></tr></tbody><tfoot><tr><td>Total</td><td>2</td></tr></tfoot></table><div role="grid" aria-label="B appointments"><div role="row"><div role="columnheader">Service</div></div><div role="row"><div role="gridcell">Gel Polish</div></div></div><table hidden><tr><td>Hidden table</td></tr></table><div id="cardlist"><article class="appt">Alpha<br>Gel</article><article class="appt">Beta<br>Pedi</article></div>''')
    fixture.add_script_tag(content=(ROOT/'capture.js').read_text())
    cs=fixture.evaluate('window.__n360SupportCapture.scan()');assert len(cs)==2,cs
    assert cs[0]['count']==2 and cs[0]['headers']==['Appointment ID','Service'],cs
    captured=fixture.evaluate('(id)=>window.__n360SupportCapture.capture(id)',cs[0]['id']);assert captured['rows']==[['1','Manicure'],['2','Pedicure']],captured
    grid=fixture.evaluate('(id)=>window.__n360SupportCapture.capture(id)',cs[1]['id']);assert grid['rows']==[['Gel Polish']],grid
    fixture.evaluate('window.__n360SupportCapture.scan()')
    stale=fixture.evaluate('(id)=>{try{window.__n360SupportCapture.capture(id);return false}catch{return true}}',cs[0]['id']);assert stale
    fixture.evaluate('window.siteClicks=0;document.querySelector("table").addEventListener("click",()=>window.siteClicks++);window.pickResult=window.__n360SupportCapture.pick();true')
    box=fixture.locator('td').first.bounding_box();fixture.mouse.click(box['x']+5,box['y']+5)
    selected=fixture.evaluate('window.pickResult');assert selected['data']['rows']==[['1','Manicure'],['2','Pedicure']],selected
    assert fixture.evaluate('window.siteClicks')==0
    fixture.evaluate('window.pickResult=window.__n360SupportCapture.pick();true');box=fixture.locator('article').first.bounding_box();fixture.mouse.click(box['x']+5,box['y']+5);selected=fixture.evaluate('window.pickResult');assert selected['data']['kind']=='cards',selected
    assert not errors,errors
    print('PASS: Chromium UI with mocked session storage, demo, table filter, CSV download, bug report, session save, reset, paste, HTML/ARIA scan, hidden rows/columns, stale selection, safe region pick and card pick.')
    ctx.close();browser.close()

