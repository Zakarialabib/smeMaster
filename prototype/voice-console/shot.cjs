const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const pg = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push('CONSOLE: ' + m.text().slice(0, 300)); });
  await pg.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await sleep(900);

  const nav = 'nav[aria-label="Voice console"]';
  const go = async (label, file, full = true) => {
    await pg.locator(`${nav} button`, { hasText: new RegExp('^' + label) }).first().click();
    await sleep(500);
    await pg.screenshot({ path: `C:/Users/user/AppData/Local/Temp/ps_${file}.png`, fullPage: full });
    const h1 = await pg.locator('h1').first().innerText().catch(() => '(none)');
    console.log(`${label.padEnd(10)} h1="${h1.split('\n')[0]}"`);
  };

  await go('Settings', 'settings');
  // settings sub-tabs
  for (const [t, f] of [['Local hardware', 'settings_local'], ['Keys', 'settings_keys']]) {
    await pg.locator('button', { hasText: new RegExp('^' + t) }).first().click();
    await sleep(400);
    await pg.screenshot({ path: `C:/Users/user/AppData/Local/Temp/ps_${f}.png`, fullPage: true });
    console.log('  tab', t, 'ok');
  }
  // drill-down flow, end to end
  await go('Ops', 'ops');
  await pg.locator('text=Transfer failures').first().click();
  await sleep(400);
  await pg.locator('button', { hasText: /^Open the/ }).first().click();
  await sleep(600);
  const rows = await pg.locator('table tbody tr').count();
  console.log('DRILL rows =', rows, '| banner =', (await pg.innerText('body')).includes('Filtered from an alert') ? 'YES' : 'NO');
  await pg.screenshot({ path: 'C:/Users/user/AppData/Local/Temp/ps_drill.png', fullPage: true });

  console.log('---- ERRORS ----');
  console.log(errs.length ? errs.join('\n') : 'NONE');
  await b.close();
})();
