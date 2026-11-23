const { chromium } = require('@playwright/test');

async function check() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/simulasi');
  const buttons = await page.locator('button').all();
  for (const b of buttons) {
    const t = await b.innerText();
    if (t.includes('Jt')) {
      const cls = await b.getAttribute('class');
      const box = await b.boundingBox();
      console.log({ t, cls, box });
    }
  }
  await browser.close();
}

check().catch(console.error);
