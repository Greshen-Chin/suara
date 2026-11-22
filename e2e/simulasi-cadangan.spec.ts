// /simulasi saat database tidak terjangkau (S-11): data cadangan dengan penanda, dan simulasi tetap berjalan.
//
// Server ketiga (next dev, port 3101) dijalankan dengan SUPABASE_URL ke port yang tidak melayani apa pun, jadi setiap
// pembacaan database gagal seketika dan jatuh ke lib/fallback-*.json. Server dev dipakai (bukan build) karena build
// produksi sudah memegang HTML dari data tiruan; konsol dev berisi peringatan yang bukan bagian aplikasi, jadi di sini
// hanya galat halaman (pageerror) yang diperiksa.
import { expect, test } from "@playwright/test";

const ALAMAT = "http://localhost:3101";

test("database tidak terjangkau: penanda data contoh, resmi dari cadangan, dan simulasi tetap berjalan", async ({ browser }) => {
  test.setTimeout(180_000);
  const konteks = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID", baseURL: ALAMAT });
  const page = await konteks.newPage();
  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(e.message));

  await page.goto("/simulasi", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible({ timeout: 120_000 });

  // Penanda jelas, dan angkanya sama dengan data demo cadangan.
  await expect(page.getByText("Ini data contoh.")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "e2e/.hasil/layar/simulasi-cadangan-1440.png", fullPage: false });
  await expect(page.getByText("4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta.").first()).toBeVisible();
  await expect(page.getByText("hasilnya sama untuk 231 dari 231 kombinasi bobot")).toBeVisible();

  // Simulasi tetap berjalan di peramban.
  const slider = page.getByLabel("Pagu simulasi", { exact: true });
  await expect(async () => {
    await slider.fill(String(505 * 1_000_000));
    await expect(page.getByTestId("pagu-besar")).toHaveText("Rp 505 juta", { timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText("5 dari 7 usulan terbiayai. Sisa pagu Rp 0.").first()).toBeVisible();

  // Usulan forum dari cadangan bisa ditambahkan.
  await page.getByLabel("Usulan dari forum", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Tambahkan ke simulasi" }).click();
  await expect(page.getByRole("list", { name: "Usulan forum yang ditambahkan ke simulasi" }).getByRole("listitem")).toHaveCount(1);

  expect(galat).toEqual([]);
  await konteks.close();
});
