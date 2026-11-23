const { chromium } = require('@playwright/test');
const path = require('path');

const outDir = 'C:\\Users\\Greshen chin\\.gemini\\antigravity\\brain\\b05c7439-ea20-47ac-829f-2f76fdf86000';

async function main() {
  console.log('Launching browser (msedge)...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const viewports = [
    { name: 'desktop-1440', w: 1440, h: 900 },
    { name: 'laptop-1280', w: 1280, h: 800 },
    { name: 'tablet-768', w: 768, h: 1024 },
    { name: 'mobile-390', w: 390, h: 844 },
    { name: 'mobile-320', w: 320, h: 700 },
  ];

  for (const vp of viewports) {
    console.log(`Capturing ${vp.name} (${vp.w}x${vp.h})...`);
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/simulasi', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outDir, `ss-simulasi-v2-${vp.name}.png`), fullPage: true });

    if (vp.name === 'desktop-1440') {
      const details = page.locator('details');
      if (await details.count() > 0) {
        await details.first().evaluate((el) => { el.open = true; });
        await page.screenshot({ path: path.join(outDir, 'ss-simulasi-v2-desktop-1440-expanded.png'), fullPage: true });
      }
    }

    if (vp.name === 'laptop-1280') {
      await page.getByRole('radio', { name: 'Suara terbanyak' }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, 'ss-simulasi-v2-laptop-1280-suara.png'), fullPage: true });
    }

    await ctx.close();
  }

  await browser.close();
  console.log('ALL_SCREENSHOTS_DONE');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
