// /simulasi saat tidak ada usulan dalam hitungan anggaran (S-11): keadaan yang terjadi setelah periode ditutup oleh
// fitur Keputusan. Admin mengembalikan SEMUA usulan voting ke pembahasan lewat antarmuka, lewat jalur yang sama
// dengan sungguhan (Server Action memanggil updateTag, jadi cache publik langsung segar).
//
// Berkas ini sengaja bernama "admin.zz-..." supaya berjalan paling akhir di proyek admin: ia mengosongkan hitungan
// anggaran dan tidak memulihkannya (berkas lain me-reset database di awalnya).
import { expect, test } from "@playwright/test";
import { konteksSebagai, konteksTamu, pantauKonsol, resetDatabase } from "./bantu.ts";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);

test("semua usulan dikembalikan ke pembahasan: /simulasi menjelaskan, tanpa kendali, tanpa galat", async ({ browser }) => {
  test.setTimeout(240_000);
  const { konteks, page } = await konteksSebagai(browser, "admin", 1440);

  for (let i = 0; i < 7; i++) {
    await page.goto("/admin/usulan?status=voting");
    await page.getByRole("link", { name: /^Tinjau / }).first().click();
    await page.getByRole("button", { name: /^Kembalikan ke pembahasan/ }).click();
    const dialog = page.getByRole("dialog", { name: "Kembalikan usulan ke pembahasan?" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Alasan").fill("Periode anggaran ditutup, usulan dibahas ulang tahun depan.");
    await dialog.getByRole("button", { name: "Kembalikan", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/usulan\?berhasil=kembali&id=/);
  }
  await konteks.close();

  const tamu = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(tamu.page);
  await tamu.page.goto("/simulasi");
  await expect(tamu.page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();
  await expect(tamu.page.getByRole("heading", { name: "Belum ada usulan dalam hitungan anggaran" })).toBeVisible();
  await expect(tamu.page.getByRole("link", { name: "Lihat forum warga" })).toHaveAttribute("href", "/forum");
  await tamu.page.screenshot({ path: "e2e/.hasil/layar/simulasi-kosong-360.png", fullPage: true });
  // Kendali tidak dirender.
  await expect(tamu.page.getByLabel("Pagu simulasi", { exact: true })).toHaveCount(0);
  await expect(tamu.page.getByRole("button", { name: "Bagikan simulasi ini" })).toHaveCount(0);

  // Halaman lain yang memakai hitungan yang sama tetap hidup.
  await tamu.page.goto("/");
  await expect(tamu.page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(konsol()).toEqual([]);
  await tamu.konteks.close();
});
