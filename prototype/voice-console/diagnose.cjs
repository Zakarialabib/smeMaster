const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e.stack || e).slice(0, 700)));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 400)); });
  await pg.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await sleep(900);

  await pg.locator('text=Transfer failures').first().click();
  await sleep(400);
  const open = pg.locator('button', { hasText: /^Open the/ }).first();
  console.log('btn:', await open.innerText());
  await open.click();
  await sleep(900);

  const body = await pg.innerText('body');
  console.log('BODY_LEN', body.length);
  console.log('drill banner?', body.includes('Filtered from an alert') ? 'YES' : 'NO');
  console.log('h1 count:', await pg.locator('h1').count());
  console.log('table rows:', await pg.locator('table tbody tr').count());
  console.log('---- first 400 of body ----');
  console.log(body.slice(0, 400));
  console.log('---- ERRORS ----');
  console.log(errs.length ? errs.join('\n---\n') : 'NONE');
  await b.close();
})();
