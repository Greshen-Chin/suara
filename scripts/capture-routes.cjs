const { chromium } = require('@playwright/test');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/Greshen chin/.gemini/antigravity/brain/b05c7439-ea20-47ac-829f-2f76fdf86000');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const routes = [
    { name: 'forum', url: 'http://localhost:3000/forum' },
    { name: 'forum-detail', url: 'http://localhost:3000/forum/6f1b3d0a-0001-4c8e-9a10-000000000001' },
    { name: 'forum-usul', url: 'http://localhost:3000/forum/usul' },
    { name: 'keputusan', url: 'http://localhost:3000/keputusan' }
  ];

  for (const r of routes) {
    for (const vp of [{ name: 'desktop-1440', width: 1440, height: 900 }, { name: 'mobile-390', width: 390, height: 844 }]) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2
      });

      try {
        console.log(`Navigating to ${r.url} at ${vp.name}...`);
        await page.goto(r.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);

        const filePath = path.join(ARTIFACT_DIR, `ss-${r.name}-${vp.name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`Saved: ${filePath}`);
      } catch (err) {
        console.error(`Error on ${r.name} ${vp.name}:`, err.message);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log('Capture finished!');
}

main().catch(console.error);
