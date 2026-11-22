// Tangkapan layar untuk tinjauan visual (360, 768, 1440 px). Hasil di e2e/.hasil/layar/.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { barisUsulan, konteksSebagai } from "./bantu.ts";

const LEBAR = [360, 768, 1440] as const;
const DIR = "e2e/.hasil/layar";
mkdirSync(DIR, { recursive: true });

test.describe.configure({ mode: "serial" });
// Tidak me-reset database di sini: cache Next ("use cache") masih memegang id lama selama 60 detik.

for (const lebar of LEBAR) {
  test(`pengunjung: daftar, detail voting, detail forum @${lebar}`, async ({ browser }) => {
    const konteks = await browser.newContext({ viewport: { width: lebar, height: 900 } });
    const page = await konteks.newPage();
    await page.goto("/forum");
    await expect(page.getByRole("heading", { name: "Forum warga", level: 1 })).toBeVisible();
    await page.screenshot({ path: `${DIR}/forum-pengunjung-${lebar}.png`, fullPage: true });

    await page.getByRole("link", { name: "Talud penahan longsor tebing RW 07" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Talud");
    await page.screenshot({ path: `${DIR}/detail-voting-${lebar}.png`, fullPage: true });

    await page.goto("/forum");
    await page.getByRole("link", { name: "Lampu jalan gang RW 07 gelap" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lampu jalan gang");
    await page.screenshot({ path: `${DIR}/detail-forum-${lebar}.png`, fullPage: true });

    await page.goto("/forum?status=voting&urut=dukungan&rw=7");
    await page.screenshot({ path: `${DIR}/forum-filter-${lebar}.png`, fullPage: true });
    await page.goto("/forum?rw=3&kategori=sosial");
    await page.screenshot({ path: `${DIR}/forum-kosong-${lebar}.png`, fullPage: true });
    await konteks.close();
  });
}

test("warga: formulir usulan dan tinjauan @360 dan @1440", async ({ browser }) => {
  for (const lebar of [360, 1440]) {
    const { konteks, page } = await konteksSebagai(browser, "warga", lebar);
    await page.goto("/forum/usul");
    await expect(page.getByLabel("Judul usulan")).toBeVisible();
    await page.screenshot({ path: `${DIR}/usul-isi-${lebar}.png`, fullPage: true });

    await page.getByLabel("Judul usulan").fill("Lampu di lorong RW 07 tidak menyala");
    await page.getByLabel("Ceritakan usulan Anda").fill("Lorong dekat musala tidak ada penerangan, warga takut lewat malam hari dan anak-anak sering jatuh.");
    await page.getByLabel("Kategori").selectOption("infrastruktur");
    await page.getByLabel("Perkiraan biaya").fill("Rp 20 jt");
    await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
    await expect(page.getByRole("heading", { name: /usulan yang mirip|Tidak ada usulan yang mirip/ })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${DIR}/usul-periksa-${lebar}.png`, fullPage: true });
    await konteks.close();
  }
});

test("warga: daftar dengan tombol dukung @360 dan admin: dialog @1440", async ({ browser }) => {
  const w = await konteksSebagai(browser, "warga", 360);
  await w.page.goto("/forum");
  await expect(barisUsulan(w.page, "Lampu jalan gang RW 07 gelap").getByRole("button", { name: /Dukung/ })).toBeVisible();
  await w.page.screenshot({ path: `${DIR}/forum-warga-360.png`, fullPage: false });
  await w.konteks.close();

  const a = await konteksSebagai(browser, "admin", 1440);
  await a.page.goto("/forum");
  await a.page.getByRole("link", { name: "Tong sampah terpilah di pasar RW 03" }).first().click();
  await a.page.getByRole("button", { name: /Sembunyikan usulan/ }).click();
  await expect(a.page.getByRole("dialog")).toBeVisible();
  await a.page.screenshot({ path: `${DIR}/dialog-admin-1440.png`, fullPage: false });
  await a.konteks.close();
});
