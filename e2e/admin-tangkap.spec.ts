// Tangkapan layar halaman admin untuk tinjauan visual (360, 768, 1440 px). Hasil di e2e/.hasil/layar/admin-*.png.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { konteksSebagai, resetDatabase } from "./bantu.ts";

const LEBAR = [360, 768, 1440] as const;
const DIR = "e2e/.hasil/layar";
mkdirSync(DIR, { recursive: true });

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);

async function foto(page: Page, nama: string, lebar: number, penuh = true) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/admin-${nama}-${lebar}.png`, fullPage: penuh });
}

for (const lebar of LEBAR) {
  test(`admin: ringkasan, usulan, tinjau, anggaran @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Ringkasan", level: 1 })).toBeVisible();
    await foto(page, "ringkasan", lebar);

    await page.goto("/admin/usulan");
    await expect(page.getByRole("table")).toBeVisible();
    await foto(page, "usulan", lebar);

    await page.getByRole("link", { name: /^Tinjau Lampu jalan gang/ }).click();
    await expect(page.getByRole("heading", { name: "Lampu jalan gang RW 07 gelap", level: 1 })).toBeVisible();
    await page.getByRole("radio", { name: "8", exact: true }).check();
    await page.getByLabel("Alasan urgensi").fill("Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.");
    await expect(page.getByText(/Jika dimasukkan dengan urgensi 8/)).toBeVisible({ timeout: 30_000 });
    await foto(page, "tinjau", lebar);

    await page.goto("/admin/anggaran");
    const bobot = page.locator("form").filter({ has: page.getByLabel("Popularitas") });
    await bobot.getByLabel("Popularitas").fill("20");
    await bobot.getByLabel("Urgensi", { exact: true }).fill("60");
    await bobot.getByLabel("Pemerataan").fill("20");
    await expect(bobot.getByText(/usulan berubah status|Tidak ada usulan yang berubah status/)).toBeVisible({ timeout: 30_000 });
    await foto(page, "anggaran", lebar);
    await konteks.close();
  });

  test(`admin: akun, buat akun, moderasi, dialog @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);

    await page.goto("/admin/akun");
    await expect(page.getByRole("table")).toBeVisible();
    await foto(page, "akun", lebar);

    await page.goto("/admin/akun/baru");
    await page.getByLabel("Nama atau nomor warga").fill(lebar === 360 ? "23" : lebar === 768 ? "24" : "25");
    await expect(page.getByText("1 warga ditemukan.")).toBeVisible();
    await foto(page, "akun-baru-1", lebar);
    await page.getByRole("button", { name: /^Pilih / }).click();
    await expect(page.getByText("Nama pengguna ini tersedia.")).toBeVisible();
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page.getByText("Serahkan langsung ke warga.")).toBeVisible();
    await foto(page, "akun-baru-hasil", lebar);

    await page.goto("/admin/moderasi");
    await expect(page.getByRole("heading", { name: "Moderasi", level: 1 })).toBeVisible();
    await foto(page, "moderasi", lebar);

    await page.goto("/admin/usulan?status=voting");
    await page.getByRole("link", { name: /^Tinjau Talud/ }).click();
    await page.getByRole("button", { name: /^Kembalikan ke pembahasan/ }).click();
    await expect(page.getByRole("dialog").getByText(/Jika dikembalikan ke pembahasan/)).toBeVisible({ timeout: 30_000 });
    await foto(page, "dialog-kembalikan", lebar, false);
    await konteks.close();
  });
}
