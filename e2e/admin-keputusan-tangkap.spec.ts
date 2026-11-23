// Tangkapan layar halaman keputusan (publik dan admin) untuk tinjauan visual (360, 768, 1440 px).
// Hasil di e2e/.hasil/layar/keputusan-*.png. Berjalan di proyek admin: penetapan mengubah data dan cache publik.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { konteksSebagai, konteksTamu, resetDatabase, rpcDb, segarkanCache, tetapkanLewatDb, idAdmin, bacaDb } from "./bantu.ts";

const LEBAR = [360, 768, 1440] as const;
const DIR = "e2e/.hasil/layar";
mkdirSync(DIR, { recursive: true });

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);

async function foto(page: Page, nama: string, lebar: number, penuh = true) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/keputusan-${nama}-${lebar}.png`, fullPage: penuh });
}

test("publik sebelum penetapan: /keputusan, /keputusan/2026, /keputusan/2027", async ({ browser }) => {
  for (const lebar of LEBAR) {
    const { konteks, page } = await konteksTamu(browser, lebar);
    await page.goto("/keputusan");
    await expect(page.getByRole("heading", { name: "Keputusan musyawarah", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tahun Anggaran 2027 belum diputuskan" })).toBeVisible();
    await foto(page, "daftar-awal", lebar);

    await page.goto("/keputusan/2026");
    await expect(page.getByRole("heading", { name: "Tahun Anggaran 2026", level: 1 })).toBeVisible();
    await foto(page, "periode-2026", lebar);

    await page.goto("/keputusan/2027");
    await expect(page.getByText("Belum diputuskan.")).toBeVisible();
    await foto(page, "periode-2027-belum", lebar);
    await konteks.close();
  }
});

test("admin: lembar kerja kosong, terisi, dan tinjau", async ({ browser }) => {
  for (const lebar of LEBAR) {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);
    await page.goto("/admin/keputusan");
    await expect(page.getByRole("heading", { name: "Keputusan", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Lembar kerja Tahun Anggaran 2027/ })).toBeVisible();
    await foto(page, "admin-kosong", lebar);

    await page.getByRole("button", { name: "Isi sisanya sesuai rekomendasi" }).click();
    // Satu berbeda dengan alasan, satu dana lain, satu ditolak sehingga semua bentuk isian terlihat.
    const grup = (nama: string) => page.getByRole("group", { name: new RegExp(`Hasil musyawarah untuk ${nama}`) });
    await grup("Drainase").getByLabel("Ditolak").check();
    await page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Normalisasi drainase/ }) }).getByLabel("Alasan", { exact: true }).fill("Lokasi drainase ternyata di tanah sengketa, jadi tidak bisa dikerjakan tahun ini.");
    await grup("Talud").getByLabel("Diajukan ke dana lain").check();
    const talud = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /Talud penahan/ }) });
    await talud.getByLabel("Sumber dana").fill("Dana kebencanaan kabupaten");
    await talud.getByLabel("Alasan", { exact: true }).fill("Biaya terlalu besar untuk dana desa dan risikonya tinggi, jadi diajukan ke kabupaten.");
    await foto(page, "admin-terisi", lebar);

    await page.getByLabel("Tanggal musyawarah").fill("2026-11-20");
    await page.getByLabel("Catatan musyawarah").fill("Musyawarah desa di balai warga, dihadiri perwakilan RT dan RW, berjalan lancar.");
    await page.getByLabel("Ini hasil musyawarah yang sebenarnya.").check();
    await page.getByRole("heading", { name: "Tinjau dan tetapkan" }).scrollIntoViewIfNeeded();
    await foto(page, "admin-tinjau", lebar);
    await konteks.close();
  }
});

test("publik dan admin sesudah penetapan", async ({ browser }) => {
  const h = await tetapkanLewatDb();
  expect(h.ok, JSON.stringify(h)).toBe(true);
  await segarkanCache(browser);
  for (const lebar of LEBAR) {
    const { konteks, page } = await konteksTamu(browser, lebar);
    await page.goto("/keputusan/2027");
    await expect(page.getByRole("heading", { name: "Tahun Anggaran 2027", level: 1 })).toBeVisible();
    await foto(page, "periode-2027", lebar);
    await page.goto("/keputusan");
    await foto(page, "daftar", lebar);
    await konteks.close();

    const admin = await konteksSebagai(browser, "admin", lebar);
    await admin.page.goto("/admin/keputusan");
    await expect(admin.page.getByRole("heading", { name: "Sesudah penetapan" })).toBeVisible();
    await foto(admin.page, "admin-sesudah", lebar);
    await admin.konteks.close();
  }
  // Pembatalan lewat SQL supaya data kembali bersih untuk spesifikasi berikutnya.
  const r = await rpcDb<{ ok: boolean }>("batalkan_penetapan", { p_akun: await idAdmin(), p_tahun: 2027, p_alasan: "Pemulihan setelah tangkapan layar." });
  expect(r.ok).toBe(true);
  expect((await bacaDb<{ status: string }>("periode?tahun=eq.2027&select=status"))[0].status).toBe("berjalan");
  await segarkanCache(browser);
});

test("beranda tanpa usulan dalam hitungan (semua sudah diputuskan)", async ({ browser }) => {
  const h = await tetapkanLewatDb({ tolakSisa: true });
  expect(h.ok, JSON.stringify(h)).toBe(true);
  await segarkanCache(browser);
  for (const lebar of [360, 1440] as const) {
    const { konteks, page } = await konteksTamu(browser, lebar);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tidak ada usulan dalam hitungan" })).toBeVisible();
    await foto(page, "beranda-nol", lebar, false);
    await page.goto("/keputusan");
    await expect(page.getByRole("heading", { name: "Tahun Anggaran 2028 belum diputuskan" })).toBeVisible();
    await foto(page, "daftar-nol", lebar);
    await konteks.close();
  }
  const r = await rpcDb<{ ok: boolean }>("batalkan_penetapan", { p_akun: await idAdmin(), p_tahun: 2027, p_alasan: "Pemulihan setelah tangkapan layar." });
  expect(r.ok).toBe(true);
  await segarkanCache(browser);
});
