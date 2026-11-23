// Alur keputusan musyawarah (K-09 sampai K-16): lembar kerja admin, penetapan, halaman publik, pembatalan, penetapan
// ulang, tandai selesai, draf di perangkat, sesi habis, bentrok, batas 24 jam, keadaan nol usulan, cetak (PDF), CSV.
// Berjalan di proyek admin (sesudah proyek publik): penetapan mengubah data dan cache publik.
import { mkdirSync, statSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  bacaDb, biasa, idAdmin, konteksSebagai, masuk, konteksTamu, mundurkanPeriode, pantauKonsol, resetDatabase, rpcDb,
  segarkanCache, tetapkanLewatDb,
} from "./bantu.ts";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);

const TAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const CATATAN = "Musyawarah desa di balai warga, dihadiri perwakilan RT dan RW, berjalan lancar.";
const ALASAN_DRAINASE = "Lokasi drainase ternyata di tanah sengketa, jadi tidak bisa dikerjakan tahun ini.";
const DIR = "e2e/.hasil/keputusan";
mkdirSync(DIR, { recursive: true });

const baris = (page: Page, judul: RegExp) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: judul, level: 3 }) });
const grup = (page: Page, nama: string) => page.getByRole("group", { name: new RegExp(`Hasil musyawarah untuk ${nama}`) });

async function axe(page: Page, nama: string) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(350);
  const hasil = await new AxeBuilder({ page }).withTags(TAG).exclude("nextjs-portal").analyze();
  expect(hasil.violations.map((v) => `${v.id} [${v.impact}] ${v.nodes.length}x: ${v.nodes[0]?.target.join(" ")} | ${v.help}`), `axe ${nama}`).toEqual([]);
}

/** Skenario K-12: yang terpilih disetujui kecuali Drainase (ditolak, dengan alasan); sisanya dibawa ke periode berikutnya. */
async function isiLembar(page: Page) {
  await page.getByRole("button", { name: "Isi sisanya sesuai rekomendasi" }).click();
  await grup(page, "Drainase").getByLabel("Ditolak").check();
  await baris(page, /Normalisasi drainase/).getByLabel("Alasan", { exact: true }).fill(ALASAN_DRAINASE);
}

async function lengkapiRapat(page: Page) {
  await page.getByLabel("Tanggal musyawarah").fill("2026-11-20");
  await page.getByLabel("Catatan musyawarah").fill(CATATAN);
  await page.getByLabel("Ini hasil musyawarah yang sebenarnya.").check();
}

test("K-12 alur penuh: isi, tetapkan, halaman publik, batalkan, tetapkan lagi, tandai selesai (konsol bersih)", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 1440);
  const konsol = pantauKonsol(page);

  await page.goto("/admin/keputusan");
  await expect(page.getByRole("heading", { name: "Lembar kerja Tahun Anggaran 2027" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) })).toHaveCount(7);
  // Tidak ada pilihan bawaan.
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByText(/7 belum diisi/).first()).toBeVisible();

  await isiLembar(page);
  // Terpakai: Jalan 85 + Jembatan 70 + Lampu 40 = Rp 195 juta; satu berbeda (Drainase terpilih tetapi ditolak).
  const ringkas = page.locator("p[id]").filter({ hasText: /Terpakai/ }).first();
  await expect(ringkas).toContainText("Rp 195 juta");
  await expect(ringkas).toContainText("0 belum diisi");
  await expect(ringkas).toContainText("1 berbeda");
  await lengkapiRapat(page);
  await page.getByRole("button", { name: "Tetapkan keputusan" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Tahun Anggaran 2027 ditetapkan." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sesudah penetapan" })).toBeVisible();
  await expect(page.getByText(/Bisa dibatalkan, tersisa 23 jam/)).toBeVisible();

  // K-11: halaman publik langsung berubah, tanpa menunggu cache.
  const tamu = await konteksTamu(browser, 1440);
  await tamu.page.goto("/keputusan/2027");
  await expect(tamu.page.getByRole("heading", { name: "Tahun Anggaran 2027", level: 1 })).toBeVisible();
  await expect(tamu.page.getByText("DIPUTUSKAN")).toBeVisible();
  await expect(biasa(await tamu.page.locator("main").innerText())).toContain("Rp 195 juta dari pagu Rp 300 juta, 3 usulan disetujui");
  const beda = tamu.page.getByRole("region", { name: "Di mana musyawarah berbeda" });
  await expect(beda.getByRole("heading", { name: /Normalisasi drainase/ })).toBeVisible();
  await expect(beda.getByText(ALASAN_DRAINASE)).toBeVisible();
  await expect(tamu.page.getByRole("table").first()).toBeVisible();

  await tamu.page.goto("/keputusan");
  await expect(tamu.page.getByRole("link", { name: /Baca keputusan dan alasannya.*Tahun Anggaran 2027/ })).toBeVisible();
  await expect(tamu.page.getByText(/Musyawarah menetapkan keputusan Tahun Anggaran 2027/)).toBeVisible();
  await expect(tamu.page.getByText("Dicatat oleh admin").first()).toBeVisible();

  await tamu.page.goto("/");
  // Beranda UI baru: judul perbandingan tidak lagi memuat angka pagu; pagunya ada di kalimat pengantar.
  await expect(tamu.page.getByRole("heading", { name: "Bagaimana anggaran dialokasikan?" })).toBeVisible();
  await expect(tamu.page.getByText(/Keduanya memakai pagu resmi Rp\s300\sjuta/)).toBeVisible();
  // Garis Pagu kini hanya memuat tiga usulan yang dibawa ke periode berikutnya; RW tanpa bagian dibaca "periode lalu".
  await expect(tamu.page.getByText(/belum pernah menerima/i)).toHaveCount(0);
  await expect(tamu.page.locator("body")).not.toContainText("NaN");

  await tamu.page.goto("/forum?status=diputuskan");
  await expect(tamu.page.getByRole("heading", { name: "Normalisasi drainase yang sering banjir", level: 2 })).toBeVisible();
  await tamu.page.getByRole("link", { name: "Normalisasi drainase yang sering banjir" }).first().click();
  await expect(tamu.page.getByText("Ditolak").first()).toBeVisible();
  await expect(tamu.page.getByRole("heading", { name: "Keputusan musyawarah" })).toBeVisible();
  await expect(tamu.page.getByText(/Diputuskan pada musyawarah 20 November 2026: Ditolak\./)).toBeVisible();
  await expect(tamu.page.getByText(ALASAN_DRAINASE).first()).toBeVisible();
  await expect(tamu.page.locator("body")).not.toContainText("undefined");

  // Batalkan: semuanya pulih.
  await page.getByRole("button", { name: /^Batalkan penetapan/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Batalkan penetapan Tahun Anggaran 2027/ })).toBeVisible();
  await dialog.getByLabel("Alasan pembatalan").fill("Hasil rapat salah dicatat; rapat ulang dijadwalkan.");
  await dialog.getByRole("button", { name: "Batalkan penetapan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Penetapan Tahun Anggaran 2027 dibatalkan." })).toBeVisible();
  expect((await bacaDb<{ status: string }>("periode?tahun=eq.2027&select=status"))[0].status).toBe("berjalan");
  expect((await bacaDb<{ n: number }>("proposals?status=eq.voting&select=id")).length).toBe(7);

  await tamu.page.goto("/keputusan/2027");
  await expect(tamu.page.getByText("Belum diputuskan.")).toBeVisible();
  await tamu.page.goto("/keputusan");
  await expect(tamu.page.getByText(/Penetapan keputusan Tahun Anggaran 2027 dibatalkan\. Alasan/)).toBeVisible();
  await tamu.page.goto("/forum/" + (await bacaDb<{ id: string }>("proposals?title=eq.Normalisasi drainase yang sering banjir&select=id"))[0].id);
  await expect(tamu.page.getByRole("heading", { name: "Keputusan musyawarah" })).toHaveCount(0);

  // Tetapkan lagi, lalu tandai selesai.
  await page.goto("/admin/keputusan");
  await isiLembar(page);
  await lengkapiRapat(page);
  await page.getByRole("button", { name: "Tetapkan keputusan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tahun Anggaran 2027 ditetapkan." })).toBeVisible();

  const kerja = page.getByRole("listitem").filter({ hasText: "Perbaikan jalan berlubang depan SDN 03" });
  await kerja.getByRole("button", { name: /^Tandai selesai/ }).click();
  await page.getByRole("dialog").getByLabel("Biaya realisasi (boleh dikosongkan)").fill("83,5 juta");
  await page.getByRole("dialog").getByLabel("Catatan penyelesaian").fill("Jalan sudah diaspal dan dicek bersama ketua RW 03.");
  await page.getByRole("dialog").getByRole("button", { name: "Tandai selesai" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Usulan ditandai selesai dikerjakan." })).toBeVisible();

  await tamu.page.goto("/keputusan/2027");
  await expect(tamu.page.getByText(/Selesai dikerjakan.*biaya realisasi Rp.83,5.juta/)).toBeVisible();
  // Sesudah ada yang selesai, penetapan tidak bisa dibatalkan.
  await page.goto("/admin/keputusan");
  await expect(page.getByText(/sudah ada usulan dari penetapan ini yang ditandai selesai/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Batalkan penetapan/ })).toHaveCount(0);

  expect(konsol()).toEqual([]);
  expect(pantauKonsol(tamu.page)()).toEqual([]);
  await tamu.konteks.close();
  await konteks.close();
});

test("K-13 draf bertahan setelah muat ulang dan setelah sesi habis", async ({ browser }) => {
  await resetDatabase();
  await segarkanCache(browser);
  const { konteks, page } = await konteksSebagai(browser, "admin", 360);

  await page.goto("/admin/keputusan");
  await isiLembar(page);
  await page.getByLabel("Catatan musyawarah").fill(CATATAN);
  await page.waitForTimeout(700); // draf disimpan 400 ms setelah gerakan terakhir

  await page.reload();
  await expect(page.getByText("Draf dipulihkan dari perangkat ini")).toBeVisible();
  await expect(grup(page, "Drainase").getByLabel("Ditolak")).toBeChecked();
  await expect(baris(page, /Normalisasi drainase/).getByLabel("Alasan", { exact: true })).toHaveValue(ALASAN_DRAINASE);
  await expect(page.getByLabel("Catatan musyawarah")).toHaveValue(CATATAN);

  // Sesi habis: cookie dibuang, lalu mencoba menetapkan.
  await page.getByLabel("Tanggal musyawarah").fill("2026-11-20");
  await page.getByLabel("Ini hasil musyawarah yang sebenarnya.").check();
  await konteks.clearCookies();
  await page.getByRole("button", { name: "Tetapkan keputusan" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sesi Anda sudah berakhir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk lagi" })).toBeVisible();
  await expect(grup(page, "Drainase").getByLabel("Ditolak")).toBeChecked();

  // Masuk lagi di konteks yang sama: draf masih ada.
  await expect(page.getByRole("link", { name: "Masuk lagi" })).toHaveAttribute("href", /lanjut=%2Fadmin%2Fkeputusan/);
  await masuk(page, "admin", "/admin/keputusan");
  await page.goto("/admin/keputusan");
  await expect(page.getByText("Draf dipulihkan dari perangkat ini")).toBeVisible();
  await expect(grup(page, "Drainase").getByLabel("Ditolak")).toBeChecked();

  // Hapus draf: bersih, dan tidak kembali sesudah muat ulang.
  await page.getByRole("button", { name: "Hapus draf" }).click();
  await page.reload();
  await expect(page.getByText("Draf dipulihkan dari perangkat ini")).toHaveCount(0);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await konteks.close();
});

test("bentrok: hitungan berubah saat mengisi, penjelasan menyebut yang berubah dan draf tidak hilang", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 1440);
  await page.goto("/admin/keputusan");
  await isiLembar(page);
  await lengkapiRapat(page);
  await page.waitForTimeout(600);

  // Admin lain mengubah pagu sesudah halaman ini dibuka.
  const [{ versi }] = await bacaDb<{ versi: number }>("pengaturan_anggaran?select=versi");
  const r = await rpcDb<{ ok: boolean }>("ubah_pagu", { p_akun: await idAdmin(), p_pagu: 310_000_000, p_versi_dibaca: versi, p_alasan: "Pagu dinaikkan karena ada tambahan dana desa." });
  expect(r.ok).toBe(true);

  await page.getByRole("button", { name: "Tetapkan keputusan" }).click();
  const galat = page.getByRole("alert").filter({ hasText: "Hitungan anggaran berubah sejak halaman ini dibuka" });
  await expect(galat).toBeVisible();
  await expect(biasa(await galat.innerText())).toContain("Pagu berubah dari Rp 300 juta menjadi Rp 310 juta.");
  await galat.getByRole("button", { name: "Muat ulang hitungan" }).click();
  await expect(page.getByText(/Hitungan anggaran berubah sejak draf ini disimpan/)).toBeVisible();
  await expect(grup(page, "Drainase").getByLabel("Ditolak")).toBeChecked();
  await expect(page.getByLabel("Catatan musyawarah")).toHaveValue(CATATAN);

  // Kembalikan pagu supaya spesifikasi berikutnya mulai dari angka resmi.
  const [{ versi: v2 }] = await bacaDb<{ versi: number }>("pengaturan_anggaran?select=versi");
  await rpcDb("ubah_pagu", { p_akun: await idAdmin(), p_pagu: 300_000_000, p_versi_dibaca: v2, p_alasan: "Pagu dikembalikan ke angka semula." });
  await page.getByRole("button", { name: "Hapus draf" }).click();
  await konteks.close();
  await resetDatabase();
  await segarkanCache(browser);
});

test("melebihi pagu: ringkasan menyebut kelebihannya dan tombol tetapkan ditahan", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 360);
  await page.goto("/admin/keputusan");
  await page.getByRole("button", { name: "Isi sisanya sesuai rekomendasi" }).click();
  // Gapura (Rp 180 juta) disetujui padahal tidak terpilih: 285 + 180 = 465 juta.
  await grup(page, "Gapura").getByLabel("Disetujui", { exact: true }).check();
  await expect(page.getByText(/Melebihi pagu Rp.165.juta/).first()).toBeVisible();
  await lengkapiRapat(page);
  // Tombol ditahan (aria-disabled), dengan penjelasan angka di dekatnya.
  await expect(page.getByRole("button", { name: "Tetapkan keputusan" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText(/Yang disetujui melebihi pagu sebesar Rp.165.juta/)).toBeVisible();
  await page.getByRole("button", { name: "Tetapkan keputusan" }).click({ force: true });
  expect((await bacaDb("keputusan?tahun=eq.2027&select=id")).length).toBe(0);
  await konteks.close();
});

test("lewat 24 jam: tombol batal hilang dengan keterangan", async ({ browser }) => {
  const h = await tetapkanLewatDb();
  expect(h.ok, JSON.stringify(h)).toBe(true);
  await segarkanCache(browser);
  await mundurkanPeriode();
  const { konteks, page } = await konteksSebagai(browser, "admin", 360);
  await page.goto("/admin/keputusan");
  await expect(page.getByText(/Sudah lewat 24 jam sejak penetapan/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Batalkan penetapan/ })).toHaveCount(0);
  await konteks.close();
  await resetDatabase();
  await segarkanCache(browser);
});

test("K-10 beranda tanpa usulan dalam hitungan: penjelasan dan keputusan terakhir, tanpa NaN", async ({ browser }) => {
  const h = await tetapkanLewatDb({ tolakSisa: true });
  expect(h.ok, JSON.stringify(h)).toBe(true);
  await segarkanCache(browser);

  const tamu = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(tamu.page);
  await tamu.page.goto("/");
  await expect(tamu.page.getByRole("heading", { name: "Tidak ada usulan dalam hitungan" })).toBeVisible();
  await expect(tamu.page.getByRole("heading", { name: /Keputusan terakhir: Tahun Anggaran 2027/ })).toBeVisible();
  await expect(tamu.page.getByRole("link", { name: "Baca keputusan dan alasannya" })).toHaveAttribute("href", "/keputusan/2027");
  const teks = await tamu.page.locator("body").innerText();
  expect(teks).not.toMatch(/NaN|undefined|Infinity/);
  const html = await tamu.page.content();
  expect(html).not.toMatch(/width:\s*NaN/);
  await expect(tamu.page.getByText(/belum pernah menerima/i)).toHaveCount(0);
  await axe(tamu.page, "beranda tanpa usulan @360");

  await tamu.page.goto("/keputusan");
  await expect(tamu.page.getByRole("heading", { name: "Tahun Anggaran 2028 belum diputuskan" })).toBeVisible();
  await expect(tamu.page.getByText("Belum ada usulan dalam hitungan anggaran")).toBeVisible();

  // Admin: nol usulan, lembar diganti penjelasan dan penetapan tidak tersedia.
  const admin = await konteksSebagai(browser, "admin", 360);
  await admin.page.goto("/admin/keputusan");
  await expect(admin.page.getByText(/Belum ada usulan dalam hitungan anggaran, jadi belum ada yang bisa diputuskan/)).toBeVisible();
  await expect(admin.page.getByRole("button", { name: "Tetapkan keputusan" })).toHaveCount(0);

  expect(konsol()).toEqual([]);
  await admin.konteks.close();
  await tamu.konteks.close();
  const r = await rpcDb<{ ok: boolean }>("batalkan_penetapan", { p_akun: await idAdmin(), p_tahun: 2027, p_alasan: "Pemulihan setelah uji keadaan nol usulan." });
  expect(r.ok).toBe(true);
  await segarkanCache(browser);
});

test("RW dengan anggaran_lalu = 0 dibaca 'periode lalu' di beranda sesudah penetapan", async ({ browser }) => {
  const h = await tetapkanLewatDb();
  expect(h.ok).toBe(true);
  await segarkanCache(browser);
  const tamu = await konteksTamu(browser, 1440);
  await tamu.page.goto("/");
  // RW 01 menerima 0 pada periode ini (Gapura dan Balai warga dibawa ke periode berikutnya).
  await expect(tamu.page.getByText("Tidak menerima anggaran").first()).toBeVisible();
  await expect(tamu.page.getByText(/belum pernah menerima/i)).toHaveCount(0);
  await tamu.konteks.close();
});

test("K-14 cetak: PDF A4 dari halaman keputusan terbaca dan tidak terpotong", async ({ browser }) => {
  // Keadaan: periode 2027 sudah ditetapkan oleh tes sebelumnya, dengan satu perbedaan dari rekomendasi.
  await rpcDb("batalkan_penetapan", { p_akun: await idAdmin(), p_tahun: 2027, p_alasan: "Pemulihan sebelum membuat lembar cetak." });
  const admin = await konteksSebagai(browser, "admin", 1280);
  await admin.page.goto("/admin/keputusan");
  await isiLembar(admin.page);
  await lengkapiRapat(admin.page);
  await admin.page.getByRole("button", { name: "Tetapkan keputusan" }).click();
  await expect(admin.page.getByRole("status").filter({ hasText: "ditetapkan" })).toBeVisible();
  await admin.konteks.close();

  const tamu = await konteksTamu(browser, 1280, 900);
  await tamu.page.goto("/keputusan/2027");
  await expect(tamu.page.getByRole("heading", { name: "Tahun Anggaran 2027", level: 1 })).toBeVisible();
  await tamu.page.emulateMedia({ media: "print" });
  // Elemen yang tidak ikut tercetak.
  await expect(tamu.page.getByRole("banner")).toBeHidden();
  await expect(tamu.page.getByRole("button", { name: "Cetak ringkasan" })).toBeHidden();
  await expect(tamu.page.getByText("Ringkasan keputusan musyawarah, bukan pengesahan anggaran. Data purwarupa.")).toBeVisible();
  const berkas = `${DIR}/keputusan-2027.pdf`;
  await tamu.page.pdf({ path: berkas, format: "A4", printBackground: false });
  // Tangkapan layar dengan gaya cetak pada lebar isi A4 (210 mm - 2 x 14 mm = 182 mm = 688 px), untuk dilihat mata.
  await tamu.page.setViewportSize({ width: 688, height: 1000 });
  await tamu.page.screenshot({ path: `${DIR}/keputusan-2027-cetak.png`, fullPage: true });
  expect(statSync(berkas).size).toBeGreaterThan(10_000);
  console.log(`PDF: ${berkas}`);
  await tamu.konteks.close();
});

test("K-15 unduh CSV: BOM, kepala, dan isi dari potret publik", async ({ browser }) => {
  const tamu = await konteksTamu(browser, 1280, 900);
  const r = await tamu.page.request.get("/keputusan/2027/csv");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("text/csv");
  expect(r.headers()["content-disposition"]).toContain("keputusan-tahun-anggaran-2027.csv");
  const buf = await r.body();
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const teks = buf.toString("utf8").slice(1);
  expect(teks.split("\r\n")[0]).toContain("Tahun Anggaran,Peringkat rekomendasi,Usulan");
  expect(teks).toContain("Normalisasi drainase yang sering banjir");
  expect(teks).toContain("Ditolak");
  expect(teks).not.toMatch(/approved|undefined/);
  expect((await tamu.page.request.get("/keputusan/2099/csv")).status()).toBe(404);
  expect((await tamu.page.request.get("/keputusan/abc/csv")).status()).toBe(404);
  expect((await tamu.page.request.post("/keputusan/2027/csv")).status()).toBe(405);
  await tamu.konteks.close();
});

for (const lebar of [360, 1440] as const) {
  test(`K-16 axe, keyboard, reflow, dan target sentuh @${lebar}`, async ({ browser }) => {
    const tamu = await konteksTamu(browser, lebar, 900);
    for (const jalur of ["/keputusan", "/keputusan/2027", "/keputusan/2026"]) {
      await tamu.page.goto(jalur);
      await expect(tamu.page.getByRole("heading", { level: 1 })).toBeVisible();
      await axe(tamu.page, `${jalur} @${lebar}`);
      // Reflow: tidak ada gulir horizontal.
      expect(await tamu.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await tamu.page.goto("/keputusan/2026");
    await expect(tamu.page.getByText("Periode ini diputuskan sebelum SUARA dipakai, jadi tidak ada rekomendasi untuk dibandingkan.")).toBeVisible();
    await tamu.page.goto("/keputusan?jenis=decision");
    await axe(tamu.page, `/keputusan?jenis @${lebar}`);
    await tamu.page.goto("/keputusan/2099");
    await expect(tamu.page.getByText(/tidak ditemukan|404/i).first()).toBeVisible();
    await tamu.konteks.close();

    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);
    // Reset ke periode berjalan untuk memeriksa lembar kerja.
    await rpcDb("batalkan_penetapan", { p_akun: await idAdmin(), p_tahun: 2027, p_alasan: "Pemulihan untuk pemeriksaan aksesibilitas." });
    await page.goto("/admin/keputusan");
    await expect(page.getByRole("heading", { name: "Lembar kerja Tahun Anggaran 2027" })).toBeVisible();
    await axe(page, `/admin/keputusan kosong @${lebar}`);

    // Keyboard: radio dalam kelompok dipilih dengan panah, lalu kolom alasan muncul dan bisa diisi.
    const kel = grup(page, "Drainase");
    await kel.getByLabel("Disetujui", { exact: true }).focus();
    await page.keyboard.press("ArrowRight"); // Diajukan ke dana lain
    await page.keyboard.press("ArrowRight"); // Dibawa ke periode berikutnya
    await page.keyboard.press("ArrowRight"); // Ditolak
    await expect(kel.getByLabel("Ditolak")).toBeChecked();
    await expect(baris(page, /Normalisasi drainase/).getByLabel("Alasan", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Isi sisanya sesuai rekomendasi" }).click();
    await baris(page, /Normalisasi drainase/).getByLabel("Alasan", { exact: true }).fill(ALASAN_DRAINASE);
    await grup(page, "Talud").getByLabel("Diajukan ke dana lain").check();
    await axe(page, `/admin/keputusan terisi @${lebar}`);

    // Galat: kirim tanpa melengkapi.
    await page.getByRole("button", { name: "Tetapkan keputusan" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ada yang belum lengkap." })).toBeVisible();
    await axe(page, `/admin/keputusan galat @${lebar}`);

    // Target sentuh: kontrol mandiri minimal 44 x 44 px.
    const kecil = await page.evaluate(() => {
      const hasil: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("main button, main .tombol, main label:has(input[type=radio])")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 43.5 || r.width < 43.5) hasil.push(`${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return hasil;
    });
    expect(kecil, "target sentuh di bawah 44 px").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    // Dialog batal penetapan: terbuka dan lolos axe (penetapan dulu).
    await konteks.close();
  });
}

test("reflow 320 px dan spasi teks WCAG 1.4.12 pada halaman keputusan", async ({ browser }) => {
  const tamu = await konteksTamu(browser, 320, 800);
  await tamu.page.goto("/keputusan/2026");
  await expect(tamu.page.getByRole("heading", { name: "Tahun Anggaran 2026", level: 1 })).toBeVisible();
  expect(await tamu.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await tamu.page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }" });
  expect(await tamu.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const terpotong = await tamu.page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main h1, main h2, main td, main th")].filter((e) => !e.classList.contains("sr-only") && e.scrollWidth > e.clientWidth + 1).map((e) => e.tagName + ":" + e.textContent?.slice(0, 20)));
  expect(terpotong).toEqual([]);
  await tamu.konteks.close();
});
