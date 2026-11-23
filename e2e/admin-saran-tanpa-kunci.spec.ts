// A-01: TANPA GEMINI_API_KEY fitur saran urgensi tidak meninggalkan jejak apa pun di antarmuka, dan beranda tidak
// mengklaim AI menilai urgensi. Berjalan di server produksi (port 3100) yang sengaja dibangun tanpa kunci; tes
// berkunci ada di saran-urgensi.spec.ts (server port 3102).
import { expect, test } from "@playwright/test";
import { bacaDb, konteksSebagai, pantauKonsol, resetDatabase } from "./bantu.ts";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);

test("admin: formulir urgensi persis seperti sebelum ada fitur, tanpa label, tombol, atau teks AI", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await page.goto("/admin/usulan?status=menunggu");
  await page.getByRole("link", { name: /^Tinjau Lampu jalan gang RW 07 gelap/ }).click();
  await expect(page.getByRole("heading", { name: "Lampu jalan gang RW 07 gelap", level: 1 })).toBeVisible();

  // Formulir urgensi ada seperti biasa.
  await expect(page.getByRole("group", { name: "Urgensi, 1 sampai 10" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Masukkan ke hitungan anggaran" })).toBeVisible();
  // Isi usulan tampil sebagai paragraf biasa, tanpa sorotan.
  await expect(page.getByText("Gang di belakang musala RW 07 tidak ada lampunya")).toBeVisible();
  await expect(page.locator("mark")).toHaveCount(0);

  // Tidak ada jejak AI sama sekali di halaman tinjau.
  await expect(page.getByText(/Saran AI/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /saran AI/i })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: /Saran AI/ })).toHaveCount(0);
  await expect(page.getByText("Teks yang dikirim ke AI")).toHaveCount(0);
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("beranda: tidak mengklaim AI menilai urgensi, dan pernyataan tentang AI benar menurut keadaan", async ({ page }) => {
  const konsol = pantauKonsol(page);
  await page.goto("/");
  await expect(page.getByText("AI tidak dipakai untuk menilai urgensi. Admin desa menilainya 1 sampai 10 dengan rubrik dan menuliskan alasannya.")).toBeVisible();
  await expect(page.getByText(/AI menilai urgensi/)).toHaveCount(0);
  await expect(page.getByText(/AI menyarankan nilai urgensi/)).toHaveCount(0);
  await expect(page.getByText("AI tidak ikut memutuskan. Musyawarah desa dan admin yang menetapkan, dan setiap perubahan tercatat.")).toBeVisible();
  // Deteksi usulan mirip tetap disebut, dengan catatan jujur bila AI tidak tersedia.
  await expect(page.getByText(/AI mengenali usulan yang mirip dari maknanya/)).toBeVisible();
  expect(konsol()).toEqual([]);
});

test("detail usulan publik tidak memuat saran AI, dan /api/health menyatakan fitur mati", async ({ page, request }) => {
  const [voting] = await bacaDb<{ id: string }>("proposals?status=eq.voting&select=id&limit=1");
  await page.goto(`/forum/${voting.id}`);
  await expect(page.getByRole("heading", { name: "Urgensi", level: 2 })).toBeVisible();
  await expect(page.getByText(/Saran AI/)).toHaveCount(0);

  const h = await request.get("/api/health");
  expect(h.ok()).toBeTruthy();
  const j = (await h.json()) as { db: string; saran_ai: boolean; periode: number };
  expect(j.db).toBe("ok");
  expect(j.saran_ai).toBe(false);
  expect(j.periode).toBe(2027);
});
