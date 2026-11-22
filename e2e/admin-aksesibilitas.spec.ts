// Audit aksesibilitas otomatis (axe-core, WCAG 2.0/2.1/2.2 A dan AA) pada semua halaman /admin/* dan /akun,
// di 360 px dan 1440 px, termasuk keadaan dialog terbuka, galat validasi, pratinjau tampil, dan setiap langkah
// "Buat akun warga". Ditambah pemeriksaan keyboard, reflow, dan target sentuh.
// axe tidak menggantikan uji manual dengan pembaca layar; lihat docs/admin.md.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { konteksSebagai, pantauKonsol, resetDatabase } from "./bantu.ts";

test.describe.configure({ mode: "serial" });
test.beforeAll(resetDatabase);

const LEBAR = [360, 1440] as const;
const TAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LAMPU_GANG = "Lampu jalan gang RW 07 gelap";
const TALUD = "Talud penahan longsor tebing RW 07";

async function periksa(page: Page, nama: string) {
  // Kursor dipindah dan transisi warna ditunggu selesai: yang diukur keadaan diam.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(350);
  const hasil = await new AxeBuilder({ page })
    .withTags(TAG)
    .exclude("nextjs-portal") // lencana alat pengembang Next.js, bukan bagian aplikasi
    .analyze();
  const ringkas = hasil.violations.map((v) => `${v.id} [${v.impact}] ${v.nodes.length}x: ${v.nodes[0]?.target.join(" ")} | ${v.help}`);
  expect(ringkas, `pelanggaran axe di ${nama}`).toEqual([]);
}

async function idUsulan(page: Page, judul: string, status: "menunggu" | "voting"): Promise<string> {
  await page.goto(`/admin/usulan?status=${status}`);
  const href = await page.getByRole("link", { name: new RegExp(`^Tinjau ${judul}`) }).getAttribute("href");
  return href!.replace("/admin/usulan/", "");
}

for (const lebar of LEBAR) {
  test(`axe: ringkasan, usulan, dan tinjau usulan @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);
    const konsol = pantauKonsol(page);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Ringkasan", level: 1 })).toBeVisible();
    await periksa(page, `/admin ${lebar}`);

    await page.goto("/admin/usulan");
    await expect(page.getByRole("table")).toBeVisible();
    await periksa(page, `/admin/usulan ${lebar}`);

    await page.goto("/admin/usulan?status=voting&rw=7&urut=dukungan");
    await periksa(page, `/admin/usulan (filter) ${lebar}`);

    await page.goto("/admin/usulan?q=tidak-ada-yang-cocok");
    await expect(page.getByRole("heading", { name: "Tidak ada usulan yang cocok" })).toBeVisible();
    await periksa(page, `/admin/usulan (kosong) ${lebar}`);

    // Tinjau usulan forum: isi, dengan galat, dengan pratinjau, dan dengan dialog terbuka.
    const id = await idUsulan(page, LAMPU_GANG, "menunggu");
    await page.goto(`/admin/usulan/${id}`);
    await expect(page.getByRole("heading", { name: LAMPU_GANG, level: 1 })).toBeVisible();
    await expect(page.getByText(/Mencari usulan yang mirip|Tidak ada usulan lain yang mirip|Usulan serupa/).first()).toBeVisible();
    await periksa(page, `/admin/usulan/[id] ${lebar}`);

    await page.getByRole("button", { name: "Masukkan ke hitungan anggaran" }).click();
    await expect(page.getByRole("alert").getByText("Ada isian yang belum sesuai.")).toBeVisible();
    await periksa(page, `/admin/usulan/[id] galat ${lebar}`);

    await page.getByRole("radio", { name: "8", exact: true }).check();
    await page.getByLabel("Alasan urgensi").fill("Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.");
    await expect(page.getByText(/Jika dimasukkan dengan urgensi 8/)).toBeVisible({ timeout: 30_000 });
    await periksa(page, `/admin/usulan/[id] pratinjau ${lebar}`);

    await page.getByRole("button", { name: /^Tidak dilanjutkan/ }).click();
    await expect(page.getByRole("dialog", { name: "Tidak melanjutkan usulan ini?" })).toBeVisible();
    await periksa(page, `dialog tidak dilanjutkan ${lebar}`);
    await page.getByRole("dialog").getByRole("button", { name: "Tidak dilanjutkan" }).click();
    await expect(page.getByRole("dialog").getByText(/minimal 10 karakter/)).toBeVisible();
    await periksa(page, `dialog galat ${lebar}`);
    await page.keyboard.press("Escape");

    // Usulan voting: dialog kembalikan dengan pratinjau di dalamnya.
    const idVoting = await idUsulan(page, TALUD, "voting");
    await page.goto(`/admin/usulan/${idVoting}`);
    await page.getByRole("button", { name: /^Kembalikan ke pembahasan/ }).click();
    await expect(page.getByRole("dialog").getByText(/Jika dikembalikan ke pembahasan/)).toBeVisible({ timeout: 30_000 });
    await periksa(page, `dialog kembalikan + pratinjau ${lebar}`);

    expect(konsol()).toEqual([]);
    await konteks.close();
  });

  test(`axe: anggaran (pagu dan bobot) @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);
    const konsol = pantauKonsol(page);

    await page.goto("/admin/anggaran");
    await expect(page.getByRole("heading", { name: "Anggaran", level: 1 })).toBeVisible();
    await periksa(page, `/admin/anggaran ${lebar}`);

    const bobot = page.locator("form").filter({ has: page.getByLabel("Popularitas") });
    await bobot.getByLabel("Urgensi", { exact: true }).fill("35");
    await expect(bobot.locator("[data-siap]")).toHaveText("Jumlah 95. Kurang 5.");
    await periksa(page, `/admin/anggaran bobot kurang ${lebar}`);

    await bobot.getByLabel("Popularitas").fill("20");
    await bobot.getByLabel("Urgensi", { exact: true }).fill("60");
    await bobot.getByLabel("Pemerataan").fill("20");
    await expect(bobot.getByText(/usulan berubah status|Tidak ada usulan yang berubah status/)).toBeVisible({ timeout: 30_000 });
    await periksa(page, `/admin/anggaran pratinjau bobot ${lebar}`);

    await bobot.getByRole("button", { name: "Simpan bobot" }).click();
    await expect(bobot.getByRole("alert")).toContainText("Ada isian yang belum sesuai.");
    await periksa(page, `/admin/anggaran galat ${lebar}`);

    const pagu = page.locator("form").filter({ has: page.getByLabel("Pagu baru") });
    await pagu.getByLabel("Pagu baru").fill("400 juta");
    await expect(pagu.getByText(/usulan berubah status|Tidak ada usulan yang berubah status/)).toBeVisible({ timeout: 30_000 });
    await periksa(page, `/admin/anggaran pratinjau pagu ${lebar}`);

    expect(konsol()).toEqual([]);
    await konteks.close();
  });

  test(`axe: akun, buat akun (semua langkah), dan detail akun @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);
    const konsol = pantauKonsol(page);

    await page.goto("/admin/akun");
    await expect(page.getByRole("table")).toBeVisible();
    await periksa(page, `/admin/akun ${lebar}`);
    await page.goto("/admin/akun?q=tidak-ada&peran=admin&sandi=belum");
    await expect(page.getByRole("heading", { name: "Tidak ada akun yang cocok" })).toBeVisible();
    await periksa(page, `/admin/akun (kosong) ${lebar}`);

    // Alur membuat akun: tiap langkah, dengan galat dan hasil.
    await page.goto("/admin/akun/baru");
    await expect(page.getByRole("heading", { name: "Pilih warga" })).toBeVisible();
    await periksa(page, `/admin/akun/baru langkah 1 ${lebar}`);
    const nomor = lebar === 360 ? "21" : "22"; // tiap lebar memakai warga berbeda
    await page.getByLabel("Nama atau nomor warga").fill(nomor);
    await expect(page.getByText("1 warga ditemukan.")).toBeVisible();
    await periksa(page, `/admin/akun/baru hasil cari ${lebar}`);
    await page.getByRole("button", { name: /^Pilih / }).click();
    await expect(page.getByText("Nama pengguna ini tersedia.")).toBeVisible();
    await periksa(page, `/admin/akun/baru langkah 2 ${lebar}`);
    await page.getByLabel("Nama pengguna").fill("admin");
    await expect(page.getByText("Nama pengguna ini sudah dipakai.")).toBeVisible();
    await periksa(page, `/admin/akun/baru langkah 2 galat ${lebar}`);
    await page.getByLabel("Nama pengguna").fill(`warga.uji${lebar}`);
    await expect(page.getByText("Nama pengguna ini tersedia.")).toBeVisible();
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByRole("heading", { name: /Kata sandi awal untuk/ })).toBeVisible();
    await periksa(page, `/admin/akun/baru langkah 3 ${lebar}`);
    await page.getByLabel("Saya ketik sendiri.").check();
    await page.getByLabel("Kata sandi", { exact: true }).fill("pendek");
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ada isian yang belum sesuai." })).toBeVisible();
    await periksa(page, `/admin/akun/baru langkah 3 galat ${lebar}`);
    await page.getByLabel("Dibuat otomatis (disarankan).", { exact: false }).check();
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page.getByText("Serahkan langsung ke warga.")).toBeVisible();
    await periksa(page, `/admin/akun/baru hasil ${lebar}`);

    // Detail akun dengan dialog terbuka.
    await page.goto(`/admin/akun?q=warga.uji${lebar}`);
    await page.getByRole("link", { name: `warga.uji${lebar}` }).click();
    await expect(page.getByRole("heading", { name: `warga.uji${lebar}`, level: 1 })).toBeVisible();
    await periksa(page, `/admin/akun/[id] ${lebar}`);
    await page.getByRole("button", { name: /^Nonaktifkan/ }).click();
    await expect(page.getByRole("dialog", { name: /Nonaktifkan akun/ })).toBeVisible();
    await periksa(page, `dialog nonaktifkan ${lebar}`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Atur ulang kata sandi/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Atur ulang" }).click();
    await expect(page.getByRole("dialog").getByText(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)).toBeVisible();
    await periksa(page, `dialog atur ulang hasil ${lebar}`);

    expect(konsol()).toEqual([]);
    await konteks.close();
  });

  test(`axe: moderasi dan dialognya @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksSebagai(browser, "admin", lebar);
    const konsol = pantauKonsol(page);

    await page.goto("/admin/moderasi");
    await expect(page.getByRole("heading", { name: "Moderasi", level: 1 })).toBeVisible();
    await periksa(page, `/admin/moderasi ${lebar}`);

    await page.getByRole("region", { name: "Komentar terbaru" }).getByRole("button", { name: /^Sembunyikan/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Sembunyikan komentar ini?" })).toBeVisible();
    await periksa(page, `dialog sembunyikan (moderasi) ${lebar}`);
    await page.keyboard.press("Escape");

    await page.getByRole("region", { name: /Konten tersembunyi/ }).getByRole("button", { name: /^Tampilkan kembali/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Tampilkan kembali komentar ini?" })).toBeVisible();
    await periksa(page, `dialog tampilkan ${lebar}`);
    await page.getByRole("dialog").getByRole("button", { name: "Tampilkan kembali" }).click();
    await expect(page.getByRole("dialog").getByText(/minimal 10 karakter/)).toBeVisible();
    await periksa(page, `dialog tampilkan galat ${lebar}`);

    expect(konsol()).toEqual([]);
    await konteks.close();
  });

  test(`axe: ganti kata sandi, halaman khusus admin, dan 404 @${lebar}`, async ({ browser }) => {
    const w = await konteksSebagai(browser, "warga", lebar);
    const konsol = pantauKonsol(w.page);
    await w.page.goto("/akun");
    await expect(w.page.getByRole("heading", { name: "Ganti kata sandi" })).toBeVisible();
    await periksa(w.page, `/akun ${lebar}`);
    await w.page.getByRole("button", { name: "Ganti kata sandi" }).click();
    await expect(w.page.getByRole("alert").getByText("Ada isian yang belum sesuai.")).toBeVisible();
    await periksa(w.page, `/akun galat ${lebar}`);

    await w.page.goto("/admin");
    await expect(w.page.getByRole("heading", { name: "Halaman ini khusus admin desa" })).toBeVisible();
    await periksa(w.page, `/admin sebagai warga ${lebar}`);
    expect(konsol()).toEqual([]);
    await w.konteks.close();

    const a = await konteksSebagai(browser, "admin", lebar);
    await a.page.goto("/admin/usulan/00000000-0000-4000-8000-000000000000");
    await expect(a.page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
    await periksa(a.page, `404 admin ${lebar}`);
    await a.konteks.close();
  });
}

test("reflow: tanpa gulir horizontal di 320 px (setara zoom 400%)", async ({ browser }) => {
  const { konteks, page } = await konsolAdmin(browser);
  const id = await idUsulan(page, LAMPU_GANG, "menunggu");
  for (const alamat of ["/admin", "/admin/usulan", `/admin/usulan/${id}`, "/admin/anggaran", "/admin/akun", "/admin/akun/baru", "/admin/moderasi", "/akun"]) {
    await page.goto(alamat);
    await page.waitForLoadState("networkidle");
    const lebar = await page.evaluate(() => ({ isi: document.documentElement.scrollWidth, layar: document.documentElement.clientWidth }));
    expect(lebar.isi, `gulir horizontal di ${alamat}`).toBeLessThanOrEqual(lebar.layar);
  }
  await konteks.close();
});

async function konsolAdmin(browser: Parameters<typeof konteksSebagai>[0]) {
  return konteksSebagai(browser, "admin", 320);
}

test("spasi teks (WCAG 1.4.12): jarak baris, huruf, kata, dan paragraf diperlebar tanpa konten terpotong atau gulir horizontal", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 360);
  const id = await idUsulan(page, LAMPU_GANG, "menunggu");
  // Nilai terburuk yang diizinkan kriteria 1.4.12.
  const spasi = `
    * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
    p { margin-bottom: 2em !important; }
  `;
  for (const alamat of ["/admin", "/admin/usulan", `/admin/usulan/${id}`, "/admin/anggaran", "/admin/akun", "/admin/akun/baru", "/admin/moderasi"]) {
    await page.goto(alamat);
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: spasi });
    const hasil = await page.evaluate(() => ({
      isi: document.documentElement.scrollWidth,
      layar: document.documentElement.clientWidth,
      // Teks dalam kontrol yang terpotong (tombol dan tautan berukuran tetap) menandakan konten hilang.
      terpotong: [...document.querySelectorAll<HTMLElement>("button, .tombol")]
        .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1)
        .map((el) => (el.textContent ?? "").trim().slice(0, 40)),
    }));
    expect(hasil.isi, `gulir horizontal di ${alamat} dengan spasi teks diperlebar`).toBeLessThanOrEqual(hasil.layar);
    expect(hasil.terpotong, `teks tombol terpotong di ${alamat}`).toEqual([]);
  }
  await konteks.close();
});

test("keyboard: tautan tabel dan pilihan urgensi bisa dioperasikan, fokus terlihat; Esc menutup dialog dan mengembalikan fokus", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 1440);
  await page.goto("/admin/usulan");
  const tinjau = page.getByRole("link", { name: /^Tinjau/ }).first();
  await tinjau.focus();
  await expect(tinjau).toBeFocused();
  const outline = await tinjau.evaluate((el) => {
    const s = getComputedStyle(el);
    return { gaya: s.outlineStyle, lebar: parseFloat(s.outlineWidth) };
  });
  expect(outline.gaya).not.toBe("none");
  expect(outline.lebar).toBeGreaterThanOrEqual(2);

  // Urgensi: tombol radio, dipilih dengan panah dari keyboard.
  const id = await idUsulan(page, LAMPU_GANG, "menunggu");
  await page.goto(`/admin/usulan/${id}`);
  const satu = page.getByRole("radio", { name: "1", exact: true });
  await satu.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "2", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "3", exact: true })).toBeChecked();

  // Dialog: Esc menutup, fokus kembali ke tombol yang membukanya.
  const pemicu = page.getByRole("button", { name: /^Tidak dilanjutkan/ });
  await pemicu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Tidak melanjutkan usulan ini?" })).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Alasan")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(pemicu).toBeFocused();
  await konteks.close();
});

test("target sentuh: kontrol mandiri minimal 44 x 44 px di 360 px", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 360);
  const id = await idUsulan(page, LAMPU_GANG, "menunggu");
  // Semua halaman dikumpulkan dulu, supaya satu putaran menunjukkan semua yang kurang, bukan hanya yang pertama.
  const semua: Record<string, unknown[]> = {};
  for (const alamat of ["/admin", "/admin/usulan", `/admin/usulan/${id}`, "/admin/anggaran", "/admin/akun", "/admin/akun/baru", "/admin/moderasi", "/akun"]) {
    await page.goto(alamat);
    await page.waitForLoadState("networkidle");
    const kecil = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a[href], button, select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea")]
        .filter((el) => el.offsetParent !== null && !el.closest("nextjs-portal") && !el.closest("dialog:not([open])"))
        .filter((el) => !el.classList.contains("sr-only") && !el.closest(".lompat"))
        // Tautan di tengah kalimat dikecualikan oleh WCAG 2.5.8; yang dicek: kontrol mandiri.
        .filter((el) => getComputedStyle(el).display !== "inline")
        .map((el) => ({ nama: (el.textContent ?? "").trim().slice(0, 40) || el.tagName, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
        .filter((e) => e.h < 43.5 || e.w < 43.5),
    );
    if (kecil.length > 0) semua[alamat] = kecil;
  }
  expect(semua, "kontrol kurang dari 44 px").toEqual({});
  await konteks.close();
});
