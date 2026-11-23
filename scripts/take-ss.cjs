const { chromium } = require('@playwright/test');
const path = require('path');

const outDir = 'C:\\Users\\Greshen chin\\.gemini\\antigravity\\brain\\b05c7439-ea20-47ac-829f-2f76fdf86000';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  // 1. Publik / Pengunjung
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('Capturing beranda...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, 'ss-01-beranda.png'), fullPage: true });

  console.log('Capturing forum publik...');
  await page.goto('http://localhost:3000/forum', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, 'ss-02-forum.png'), fullPage: true });

  console.log('Capturing detail usulan...');
  await page.goto('http://localhost:3000/forum/6f1b3d0a-0004-4c8e-9a10-000000000004', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, 'ss-03-detail-talud.png'), fullPage: true });

  await context.close();

  // 2. Warga login
  const wargaCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const wargaPage = await wargaCtx.newPage();
  console.log('Logging in as warga...');
  await wargaPage.goto('http://localhost:3000/masuk');
  await wargaPage.getByLabel('Nama pengguna').fill('warga');
  await wargaPage.getByLabel('Kata sandi', { exact: true }).fill('warga123');
  await wargaPage.getByRole('button', { name: 'Masuk', exact: true }).click();
  await wargaPage.waitForURL((u) => !u.pathname.startsWith('/masuk'));

  console.log('Capturing forum as warga...');
  await wargaPage.goto('http://localhost:3000/forum', { waitUntil: 'networkidle' });
  await wargaPage.screenshot({ path: path.join(outDir, 'ss-04-forum-warga.png'), fullPage: true });

  console.log('Capturing usul baru as warga...');
  await wargaPage.goto('http://localhost:3000/forum/usul', { waitUntil: 'networkidle' });
  await wargaPage.screenshot({ path: path.join(outDir, 'ss-05-form-usulan.png'), fullPage: true });
  await wargaCtx.close();

  // 3. Admin login
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adminPage = await adminCtx.newPage();
  console.log('Logging in as admin...');
  await adminPage.goto('http://localhost:3000/masuk');
  await adminPage.getByLabel('Nama pengguna').fill('admin');
  await adminPage.getByLabel('Kata sandi', { exact: true }).fill('admin123');
  await adminPage.getByRole('button', { name: 'Masuk', exact: true }).click();
  await adminPage.waitForURL((u) => !u.pathname.startsWith('/masuk'));

  console.log('Capturing admin dashboard...');
  await adminPage.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  await adminPage.screenshot({ path: path.join(outDir, 'ss-06-admin-dashboard.png'), fullPage: true });

  console.log('Capturing admin usulan...');
  await adminPage.goto('http://localhost:3000/admin/usulan', { waitUntil: 'networkidle' });
  await adminPage.screenshot({ path: path.join(outDir, 'ss-07-admin-usulan.png'), fullPage: true });

  console.log('Capturing admin anggaran...');
  await adminPage.goto('http://localhost:3000/admin/anggaran', { waitUntil: 'networkidle' });
  await adminPage.screenshot({ path: path.join(outDir, 'ss-08-admin-anggaran.png'), fullPage: true });

  console.log('Capturing admin akun...');
  await adminPage.goto('http://localhost:3000/admin/akun', { waitUntil: 'networkidle' });
  await adminPage.screenshot({ path: path.join(outDir, 'ss-09-admin-akun.png'), fullPage: true });

  console.log('Capturing admin moderasi...');
  await adminPage.goto('http://localhost:3000/admin/moderasi', { waitUntil: 'networkidle' });
  await adminPage.screenshot({ path: path.join(outDir, 'ss-10-admin-moderasi.png'), fullPage: true });

  await adminCtx.close();
  await browser.close();
  console.log('All screenshots captured!');
}

run().catch(e => console.error('FAILED:', e));
