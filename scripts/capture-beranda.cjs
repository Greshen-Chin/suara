const { chromium } = require('@playwright/test');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/Greshen chin/.gemini/antigravity/brain/b05c7439-ea20-47ac-829f-2f76fdf86000');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'laptop-1280', width: 1280, height: 800 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'mobile-320', width: 320, height: 700 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });

    try {
      console.log(`Loading http://localhost:3000/ at ${vp.width}x${vp.height}...`);
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      const filePath = path.join(ARTIFACT_DIR, `ss-beranda-${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot: ${filePath}`);

      // Also capture the hero fold viewport screenshot
      const foldPath = path.join(ARTIFACT_DIR, `ss-beranda-${vp.name}-fold.png`);
      await page.screenshot({ path: foldPath, fullPage: false });
      console.log(`Saved fold screenshot: ${foldPath}`);
    } catch (err) {
      console.error(`Error on ${vp.name}:`, err);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('Capture finished!');
}

main().catch(console.error);
