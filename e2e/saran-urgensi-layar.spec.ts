// Tangkapan layar saran urgensi untuk tinjauan visual (e2e/.hasil/layar/saran-*.png). Bukan uji perilaku:
// perilakunya ada di saran-urgensi.spec.ts. Memakai Gemini tiruan di port 54399 dan server aplikasi port 3102.
import { expect, test, type Page } from "@playwright/test";
import { konteksSebagai, resetDatabase } from "./bantu.ts";

test.describe.configure({ mode: "serial" });

const APP = "http://localhost:3102";
const GEMINI = "http://127.0.0.1:54399";
const LAYAR = "e2e/.hasil/layar";

const atur = (o: object) => fetch(`${GEMINI}/__uji/atur`, { method: "POST", body: JSON.stringify(o) });

test.beforeAll(async () => {
  await resetDatabase();
  await fetch(`${GEMINI}/__uji/reset`, { method: "POST" });
});

async function buka(page: Page, judul: string) {
  await page.goto("/admin/usulan?status=menunggu");
  await page.getByRole("link", { name: new RegExp(`^Tinjau ${judul}`) }).click();
  await expect(page.getByRole("heading", { name: judul, level: 1 })).toBeVisible();
}

for (const lebar of [360, 768, 1440]) {
  test(`tangkap saran urgensi @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar, APP);
    await buka(page, "Lampu jalan gang RW 07 gelap");
    const form = page.locator("#form-masuk").locator("..");
    await form.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${LAYAR}/saran-1-awal-${lebar}.png`, fullPage: true });

    await page.getByRole("radio", { name: "8", exact: true }).check();
    await page.getByRole("complementary", { name: /Saran AI/ }).getByRole("button", { name: "Minta saran AI" }).click();
    await expect(page.getByText("Keyakinan sedang.")).toBeVisible();
    await page.getByRole("button", { name: "Sorot di usulan" }).first().click();
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${LAYAR}/saran-2-saran-${lebar}.png`, fullPage: true });
    await page.getByRole("complementary", { name: /Saran AI/ }).screenshot({ path: `${LAYAR}/saran-2b-catatan-${lebar}.png` });

    await page.getByRole("radio", { name: "3", exact: true }).check();
    await page.getByLabel("Alasan urgensi").fill("Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.");
    await page.screenshot({ path: `${LAYAR}/saran-3-jauh-${lebar}.png`, fullPage: true });
    await konteks.close();
  });
}

test("tangkap galat dan halaman publik", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 360, APP);
  await atur({ mode: "kuota" });
  await buka(page, "Timbangan dan meja baru untuk posyandu RW 03");
  await page.getByRole("radio", { name: "6", exact: true }).check();
  await page.getByRole("complementary", { name: /Saran AI/ }).getByRole("button", { name: "Minta saran AI" }).click();
  await expect(page.getByText("Kuota AI sedang habis.").first()).toBeVisible();
  await page.screenshot({ path: `${LAYAR}/saran-4-galat-360.png`, fullPage: true });
  await atur({ mode: "normal" });

  // Masukkan Lampu gang dengan saran dibuka, lalu lihat halaman publiknya.
  await buka(page, "Lampu jalan gang RW 07 gelap");
  await page.getByRole("radio", { name: "8", exact: true }).check();
  await page.getByRole("complementary", { name: /Saran AI/ }).getByRole("button", { name: /Minta saran AI|Coba lagi/ }).click();
  await expect(page.getByText("Keyakinan sedang.")).toBeVisible();
  await page.getByLabel("Alasan urgensi").fill("Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.");
  await page.getByRole("button", { name: "Masukkan ke hitungan anggaran" }).click();
  await expect(page).toHaveURL(/berhasil=voting&id=/);
  const id = new URL(page.url()).searchParams.get("id");
  for (const lebar of [360, 1440]) {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto(`/forum/${id}`);
    await page.getByText("Alasan dari saran AI").click();
    await page.getByRole("heading", { name: "Urgensi", level: 2 }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${LAYAR}/saran-5-publik-${lebar}.png`, fullPage: false });
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");
  await page.getByRole("heading", { name: "Mengapa hasilnya bisa berbeda?" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${LAYAR}/saran-6-beranda-360.png`, fullPage: false });
  await konteks.close();
});
