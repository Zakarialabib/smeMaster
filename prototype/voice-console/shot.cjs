const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await pg.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);

  // Click the nav buttons instead of the keyboard: the keyboard handler ignores
  // keys when focus is in an input, and body focus is not guaranteed.
  const targets = [
    ['live', 'Live'], ['config', 'Config'], ['cost', 'Cost'],
    ['topology', 'Topology'], ['calls', 'Calls'], ['ops', 'Ops'],
  ];
  for (const [name, label] of targets) {
    const btn = pg.locator('nav[aria-label="Voice console"] button', { hasText: new RegExp('^' + label) }).first();
    await btn.click();
    await pg.waitForTimeout(450);
    const bodyLen = (await pg.innerText('body')).length;
    const h1 = await pg.locator('h1').first().innerText().catch(() => '(no h1)');
    await pg.screenshot({ path: `C:/Users/user/AppData/Local/Temp/pr_${name}.png`, fullPage: true });
    console.log(`${name.padEnd(9)} bodyLen=${String(bodyLen).padEnd(5)} h1="${h1}"`);
  }
  console.log('---- ERRORS ----');
  console.log(errs.length ? errs.join('\n') : 'NONE');
  await b.close();
})();
