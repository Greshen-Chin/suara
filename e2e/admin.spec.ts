// E2E halaman admin. Berjalan serial karena tiap tes melanjutkan keadaan database sebelumnya, dan
// SESUDAH tes forum (lihat playwright.config.ts). Setiap tes memastikan konsol browser bersih.
import { expect, test, type Page } from "@playwright/test";
import { barisUsulan, konteksSebagai, pantauKonsol, resetDatabase } from "./bantu.ts";

test.describe.configure({ mode: "serial" });

test.beforeAll(resetDatabase);

const LAMPU_GANG = "Lampu jalan gang RW 07 gelap";
const POSYANDU = "Timbangan dan meja baru untuk posyandu RW 03";
const KATA_SANDI_BARU = "Kata-sandi-baru-2026";

const idDariUrl = (page: Page) => new URL(page.url()).searchParams.get("id") ?? "";

async function tinjau(page: Page, judul: string) {
  await page.goto("/admin/usulan?status=menunggu");
  await page.getByRole("link", { name: new RegExp(`^Tinjau ${judul}`) }).click();
  await expect(page.getByRole("heading", { name: judul, level: 1 })).toBeVisible();
}

test("belum masuk dialihkan ke halaman masuk; warga mendapat halaman khusus admin", async ({ page, browser }) => {
  await page.goto("/admin/anggaran");
  await expect(page).toHaveURL(/\/masuk\?lanjut=%2Fadmin%2Fanggaran/);

  const { konteks, page: warga } = await konteksSebagai(browser, "warga");
  const konsol = pantauKonsol(warga);
  for (const alamat of ["/admin", "/admin/usulan", "/admin/anggaran", "/admin/akun", "/admin/akun/baru", "/admin/moderasi"]) {
    await warga.goto(alamat);
    await expect(warga.getByRole("heading", { name: "Halaman ini khusus admin desa", level: 1 }), alamat).toBeVisible();
  }
  await expect(warga.getByRole("link", { name: "Ke forum warga" })).toBeVisible();
  // Pita mode admin dan tautan "Admin" di header tidak ada untuk warga.
  await expect(warga.getByText("Mode admin desa")).toHaveCount(0);
  await expect(warga.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("admin: pita mode, tautan di header, navigasi bagian, dan ringkasan pekerjaan", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await page.goto("/admin");
  await expect(page.getByText("Mode admin desa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Bagian admin" });
  await expect(nav.getByRole("link", { name: "Ringkasan" })).toHaveAttribute("aria-current", "page");
  for (const bagian of ["Usulan", "Anggaran", "Akun", "Moderasi"]) await expect(nav.getByRole("link", { name: bagian })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Ringkasan", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "usulan menunggu ditinjau" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "dari maksimal 16 usulan masuk hitungan anggaran" })).toBeVisible();
  await expect(page.getByText("4 terbiayai, 1 ditunda, 2 tidak terpilih.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jejak keputusan terbaru" })).toBeVisible();

  await nav.getByRole("link", { name: "Anggaran" }).click();
  await expect(page).toHaveURL(/\/admin\/anggaran$/);
  await expect(nav.getByRole("link", { name: "Anggaran" })).toHaveAttribute("aria-current", "page");

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("daftar usulan: filter di URL, pencarian, dan keadaan kosong", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await page.goto("/admin/usulan");
  await expect(page.getByRole("table")).toBeVisible();
  // 13 usulan (6 forum dan 7 voting), yang menunggu ditinjau paling atas.
  await expect(page.getByText("Menampilkan 13 dari 13 usulan")).toBeVisible();

  await page.getByLabel("Status", { exact: true }).selectOption("voting");
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page).toHaveURL(/status=voting/);
  await expect(page.getByText("Menampilkan 7 dari 7 usulan")).toBeVisible();
  // Usulan yang masuk hitungan menampilkan posisi anggaran, sama dengan Garis Pagu dan forum.
  await expect(page.getByText("Peringkat 1 dari 7").first()).toBeVisible();

  await page.goto("/admin/usulan?q=tidak-ada-yang-cocok");
  await expect(page.getByRole("heading", { name: "Tidak ada usulan yang cocok" })).toBeVisible();
  await page.getByRole("link", { name: "Hapus filter" }).last().click();
  await expect(page.getByText("Menampilkan 13 dari 13 usulan")).toBeVisible();

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("usulan forum masuk hitungan anggaran dengan urgensi dan pratinjau; halaman utama dan forum langsung berubah", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await tinjau(page, LAMPU_GANG);
  await expect(page.getByRole("heading", { name: "Keputusan" })).toBeVisible();
  // Rubrik urgensi terbaca sebelum memilih angka.
  await expect(page.getByText("Menyangkut keselamatan")).toBeVisible();
  await expect(page.getByText("Pratinjau tampil begitu Anda memilih nilai urgensi.")).toBeVisible();

  // Alasan terlalu pendek ditolak dengan galat di dekat kolomnya dan ringkasan yang menaut ke kolom.
  await page.getByRole("radio", { name: "8", exact: true }).check();
  await page.getByLabel("Alasan urgensi").fill("terlalu pendek");
  await page.getByRole("button", { name: "Masukkan ke hitungan anggaran" }).click();
  await expect(page.getByRole("alert").getByText("Ada isian yang belum sesuai.")).toBeVisible();
  await expect(page.getByText(/Tulis alasan urgensinya, minimal 20 karakter/).first()).toBeVisible();

  await page.getByLabel("Alasan urgensi").fill("Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.");
  // Pratinjau dihitung otomatis begitu isiannya valid.
  await expect(page.getByText(/Jika dimasukkan dengan urgensi 8, usulan ini berada di peringkat \d+ dari 8 rekomendasi: Terbiayai\./)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Sekarang", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Sesudah disimpan", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: "Masukkan ke hitungan anggaran" }).click();
  await expect(page).toHaveURL(/\/admin\/usulan\?berhasil=voting&id=/);
  const id = idDariUrl(page);
  const pesan = page.getByRole("status").filter({ hasText: "masuk hitungan anggaran." });
  await expect(pesan).toBeVisible();
  await expect(pesan).toBeFocused(); // fokus ke pesan konfirmasi
  await expect(pesan.getByRole("link", { name: "halaman utama" })).toBeVisible();
  await expect(pesan.getByRole("link", { name: "riwayat usulan" })).toHaveAttribute("href", `/forum/${id}`);
  await expect(page.locator('tr[data-baru="true"]')).toHaveCount(1);

  // Forum dan halaman utama memakai angka baru seketika (cache ditandai dan diperbarui).
  await page.goto(`/forum/${id}`);
  await expect(page.getByText(/Peringkat \d dari 8 rekomendasi/)).toBeVisible();
  await expect(page.getByText("Nilai 8 dari 10")).toBeVisible();
  await expect(page.getByText(/dimasukkan ke hitungan anggaran dengan urgensi 8 dari 10/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/Usulan dimasukkan ke hitungan anggaran dengan urgensi 8 dari 10\. Alasan: Gang gelap/).first()).toBeVisible();
  await page.goto("/forum");
  await expect(barisUsulan(page, LAMPU_GANG).getByText(/Peringkat \d dari 8 rekomendasi/)).toBeVisible();

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("tidak dilanjutkan dan kembalikan ke pembahasan memakai dialog alasan; pratinjau tampil di dialog", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  // Tidak dilanjutkan
  await tinjau(page, POSYANDU);
  await page.getByRole("button", { name: /^Tidak dilanjutkan/ }).click();
  const dialog = page.getByRole("dialog", { name: "Tidak melanjutkan usulan ini?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Alasan")).toBeFocused(); // fokus awal ke kolom alasan
  await dialog.getByRole("button", { name: "Tidak dilanjutkan" }).click();
  await expect(dialog.getByText(/minimal 10 karakter/)).toBeVisible();
  await dialog.getByLabel("Alasan").fill("Biaya perlu dihitung ulang karena timbangan lama masih bisa dikalibrasi.");
  await dialog.getByRole("button", { name: "Tidak dilanjutkan" }).click();
  await expect(page).toHaveURL(/\/admin\/usulan\?berhasil=tidak-dilanjutkan&id=/);
  await expect(page.getByRole("status").filter({ hasText: "tidak dilanjutkan. Usulan tetap bisa dibaca warga." })).toBeFocused();
  // Status ditulis "Tidak dilanjutkan" (bukan "Ditolak") untuk usulan yang belum pernah dinilai.
  await expect(page.locator('tr[data-baru="true"]').getByText("Tidak dilanjutkan")).toBeVisible();

  // Kembalikan ke pembahasan (usulan yang tadi dimasukkan)
  await page.goto("/admin/usulan?status=voting");
  await page.getByRole("link", { name: new RegExp(`^Tinjau ${LAMPU_GANG}`) }).click();
  await page.getByRole("button", { name: /^Kembalikan ke pembahasan/ }).click();
  const dialog2 = page.getByRole("dialog", { name: "Kembalikan usulan ke pembahasan?" });
  await expect(dialog2).toBeVisible();
  await expect(dialog2.getByText(/Jika dikembalikan ke pembahasan, usulan ini tidak lagi dihitung dalam anggaran\./)).toBeVisible({ timeout: 30_000 });
  await dialog2.getByLabel("Alasan").fill("Biaya perlu dihitung ulang bersama ketua RW.");
  await dialog2.getByRole("button", { name: "Kembalikan", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/usulan\?berhasil=kembali&id=/);
  await expect(page.getByRole("status").filter({ hasText: "kembali ke pembahasan" })).toBeFocused();

  // Urgensi dikosongkan: forum berkata jujur "belum dinilai".
  await page.goto(`/forum/${idDariUrl(page)}`);
  await expect(page.getByText("Urgensi belum dinilai.")).toBeVisible();

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("anggaran: penunjuk jumlah bobot, pratinjau, simpan, dan riwayat yang jujur soal pelakunya", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await page.goto("/admin/anggaran");
  const bobot = page.locator("form").filter({ has: page.getByLabel("Popularitas") });
  await expect(bobot.getByLabel("Popularitas")).toHaveValue("30");

  // Penunjuk jumlah: kurang, lalu "Isi sisanya ke urgensi", lalu siap.
  // Dua salinan sengaja ada: yang terlihat langsung berubah, yang diumumkan ke pembaca layar ditunda.
  const penunjuk = bobot.locator("[data-siap]");
  await bobot.getByLabel("Urgensi", { exact: true }).fill("35");
  await expect(penunjuk).toHaveText("Jumlah 95. Kurang 5.");
  await bobot.getByRole("button", { name: "Isi sisanya ke urgensi (40)" }).click();
  await expect(penunjuk).toHaveText("Jumlah 100. Siap disimpan.");

  await bobot.getByLabel("Popularitas").fill("20");
  await bobot.getByLabel("Urgensi", { exact: true }).fill("60");
  await bobot.getByLabel("Pemerataan").fill("20");
  await expect(penunjuk).toHaveText("Jumlah 100. Siap disimpan.");
  await expect(bobot.getByRole("status").filter({ hasText: "Jumlah 100. Siap disimpan." })).toBeAttached(); // diumumkan, setelah jeda
  await expect(bobot.getByText(/usulan berubah status|Tidak ada usulan yang berubah status/)).toBeVisible({ timeout: 30_000 });

  // Tanpa alasan: galat di dekat kolom, isian tidak hilang.
  await bobot.getByRole("button", { name: "Simpan bobot" }).click();
  await expect(bobot.getByRole("alert")).toContainText("Ada isian yang belum sesuai.");
  await expect(bobot.getByLabel("Popularitas")).toHaveValue("20");

  await bobot.getByLabel("Alasan").fill("Musyawarah memutuskan urgensi lebih menentukan daripada jumlah suara.");
  await bobot.getByRole("button", { name: "Simpan bobot" }).click();
  await expect(bobot.getByText("Bobot disimpan.")).toBeVisible();

  const riwayat = page.getByRole("region", { name: "Riwayat perubahan pagu dan bobot" });
  await expect(riwayat.getByText(/Bobot penilaian diubah: popularitas 30 menjadi 20, urgensi 40 menjadi 60, pemerataan 30 menjadi 20\. Alasan: Musyawarah/)).toBeVisible();
  await expect(riwayat.getByText("Dicatat oleh admin").first()).toBeVisible(); // nama pengguna admin yang sebenarnya

  // Jejak yang sama terbaca warga di halaman utama.
  await page.goto("/");
  await expect(page.getByText(/Bobot penilaian diubah: popularitas 30 menjadi 20/).first()).toBeVisible();

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("pagu: rupiah toleran, pratinjau, simpan; admin lain yang menyimpan lebih dulu tidak tertimpa (bentrok versi)", async ({ browser }) => {
  const a = await konteksSebagai(browser, "admin");
  const b = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(a.page);

  for (const p of [a.page, b.page]) await p.goto("/admin/anggaran");
  const formPagu = (p: Page) => p.locator("form").filter({ has: p.getByLabel("Pagu baru") });

  // Admin A: "350 juta" terbaca, pratinjau tampil, simpan.
  await formPagu(a.page).getByLabel("Pagu baru").fill("350 juta");
  await expect(formPagu(a.page).getByText("Terbaca sebagai Rp 350.000.000")).toBeVisible();
  await expect(formPagu(a.page).getByText(/usulan berubah status|Tidak ada usulan yang berubah status/)).toBeVisible({ timeout: 30_000 });
  await formPagu(a.page).getByLabel("Alasan").fill("Dana tambahan dari kabupaten sudah masuk.");
  await formPagu(a.page).getByRole("button", { name: "Simpan pagu" }).click();
  await expect(formPagu(a.page).getByText("Pagu disimpan.")).toBeVisible();
  await expect(formPagu(a.page).getByText("Rp 350.000.000").first()).toBeVisible(); // pagu yang berlaku diperbarui

  // Admin B masih memegang versi lama: ditolak, dengan nilai terbaru di samping yang diketik.
  await formPagu(b.page).getByLabel("Pagu baru").fill("360 juta");
  await formPagu(b.page).getByLabel("Alasan").fill("Usul kenaikan lain dari bendahara desa.");
  await formPagu(b.page).getByRole("button", { name: "Simpan pagu" }).click();
  const alert = formPagu(b.page).getByRole("alert");
  await expect(alert).toContainText(/Pagu sudah diubah admin lain pada .* WIB\. Muat ulang untuk melihat nilai terbaru\./);
  await expect(alert.getByText("Rp 350.000.000")).toBeVisible();
  await expect(alert.getByText("Rp 360.000.000")).toBeVisible();
  await alert.getByRole("button", { name: "Muat ulang nilai terbaru" }).click();
  await expect(formPagu(b.page).getByLabel("Pagu baru")).toHaveValue("350.000.000");
  await expect(formPagu(b.page).getByRole("alert")).toHaveCount(0);

  expect(konsol()).toEqual([]);
  await a.konteks.close();
  await b.konteks.close();
});

test("buat akun warga, masuk sebagai warga baru, ganti kata sandi, mendukung; lalu dinonaktifkan dan sesinya langsung tidak berlaku", async ({ browser }) => {
  const admin = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(admin.page);
  const { page } = admin;

  // Langkah 1: pilih warga lewat nomor (hanya warga tanpa akun yang muncul).
  await page.goto("/admin/akun/baru");
  await expect(page.getByRole("heading", { name: "Pilih warga" })).toBeVisible();
  await page.getByLabel("Nama atau nomor warga").fill("69"); // warga 69 sudah punya akun (uji)
  await page.getByLabel("Nama atau nomor warga").fill("20");
  await expect(page.getByText("1 warga ditemukan.")).toBeVisible();
  await page.getByRole("button", { name: /^Pilih Budi Lestari/ }).click();

  // Langkah 2: nama pengguna disarankan dari nama warga, dicek ketersediaannya.
  await expect(page.getByRole("heading", { name: "Nama pengguna" })).toBeFocused();
  await expect(page.getByLabel("Nama pengguna")).toHaveValue("budi.lestari");
  await expect(page.getByText("Nama pengguna ini tersedia.")).toBeVisible();
  await page.getByLabel("Nama pengguna").fill("Budi Lestari");
  await expect(page.getByText(/Pakai huruf kecil, angka, titik/)).toBeVisible();
  await page.getByLabel("Nama pengguna").fill("admin");
  await expect(page.getByText("Nama pengguna ini sudah dipakai.")).toBeVisible();
  await page.getByLabel("Nama pengguna").fill("budi.lestari");
  await expect(page.getByText("Nama pengguna ini tersedia.")).toBeVisible();
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Langkah 3 dan 4: kata sandi dibuat server dan tampil sekali.
  await expect(page.getByRole("heading", { name: "Kata sandi awal untuk budi.lestari" })).toBeFocused();
  await page.getByRole("button", { name: "Buat akun" }).click();
  const sandiEl = page.getByText(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  await expect(sandiEl).toBeVisible();
  const kataSandi = (await sandiEl.innerText()).trim();
  await expect(page.getByText("Serahkan langsung ke warga.")).toBeVisible();
  await expect(page.getByText("Kata sandi ini tidak akan tampil lagi")).toBeVisible();
  expect(page.url()).not.toContain(kataSandi); // tidak masuk URL
  expect(await page.evaluate(() => JSON.stringify([{ ...sessionStorage }, { ...localStorage }]))).not.toContain(kataSandi); // tidak tersimpan di browser

  // Warga baru masuk: langsung diminta mengganti kata sandi.
  const warga = await browser.newContext({ viewport: { width: 360, height: 800 }, locale: "id-ID", baseURL: "http://localhost:3100" });
  const w = await warga.newPage();
  const konsolW = pantauKonsol(w);
  await w.goto("/masuk");
  await w.getByLabel("Nama pengguna").fill("budi.lestari");
  await w.getByLabel("Kata sandi", { exact: true }).fill(kataSandi);
  await w.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(w).toHaveURL(/\/akun$/);
  await expect(w.getByText("Ganti kata sandi Anda dulu.")).toBeVisible();
  await expect(w.getByText("Minimal 8 karakter, maksimal 128.")).toBeVisible(); // aturan tampil sebelum mengetik

  // Salah di kata sandi lama, lalu benar.
  await w.getByLabel("Kata sandi sekarang").fill("bukan-kata-sandi-saya");
  await w.getByLabel("Kata sandi baru", { exact: true }).fill(KATA_SANDI_BARU);
  await w.getByLabel("Ulangi kata sandi baru").fill(KATA_SANDI_BARU);
  await w.getByRole("button", { name: "Ganti kata sandi" }).click();
  await expect(w.getByRole("alert").getByText("Kata sandi yang sekarang tidak sesuai.")).toBeVisible();
  await w.getByLabel("Kata sandi sekarang").fill(kataSandi);
  await w.getByLabel("Kata sandi baru", { exact: true }).fill(KATA_SANDI_BARU);
  await w.getByLabel("Ulangi kata sandi baru").fill(KATA_SANDI_BARU);
  await w.getByRole("button", { name: "Ganti kata sandi" }).click();
  await expect(w.getByText("Kata sandi diganti.")).toBeVisible();

  // Sekarang warga baru bisa mendukung (akun tertaut ke warga RW 01).
  await w.goto("/forum");
  const atap = barisUsulan(w, /Atap pos ronda/);
  await atap.getByRole("button", { name: /dukung/i }).click();
  await expect(atap.getByRole("button", { name: /dukung/i })).toHaveAttribute("aria-pressed", "true");

  // Admin melihat akun itu (nama lengkap dan nomor hanya di halaman admin) dan jejaknya.
  await page.goto("/admin/akun?q=budi.lestari");
  await expect(page.getByRole("row", { name: /budi\.lestari/ })).toContainText("Budi Lestari");
  await expect(page.getByRole("row", { name: /budi\.lestari/ })).toContainText("Nomor 20");
  await page.getByRole("link", { name: "budi.lestari" }).click();
  await expect(page.getByText("Akun dibuat oleh admin.")).toBeVisible();
  await expect(page.getByText("Pemilik akun mengganti kata sandinya sendiri.")).toBeVisible();

  // Menonaktifkan: dialog menyebut akibatnya; sesi warga langsung tidak berlaku.
  await page.getByRole("button", { name: /^Nonaktifkan/ }).click();
  const dialog = page.getByRole("dialog", { name: "Nonaktifkan akun budi.lestari?" });
  await expect(dialog.getByText("Pemilik akun akan keluar dari semua perangkat")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Batal" })).toBeFocused(); // fokus awal ke yang aman
  await dialog.getByRole("button", { name: "Nonaktifkan akun" }).click();
  await expect(page.getByRole("status").filter({ hasText: "dinonaktifkan dan keluar dari semua perangkat" })).toBeFocused();
  await expect(page.getByText("Dinonaktifkan oleh admin. Semua sesinya dicabut.")).toBeVisible();

  // Tidak berputar antara /akun dan /masuk: halaman masuk menjelaskan bahwa sesinya sudah berakhir.
  await w.goto("/akun");
  await expect(w).toHaveURL(/\/masuk\?sesi=berakhir/);
  await expect(w.getByText("Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan.")).toBeVisible();
  await w.goto("/masuk");
  await w.getByLabel("Nama pengguna").fill("budi.lestari");
  await w.getByLabel("Kata sandi", { exact: true }).fill(KATA_SANDI_BARU);
  await w.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(w.locator("#galat-masuk")).toContainText("Nama pengguna atau kata sandi salah.");
  // Kolom kata sandi dikosongkan setelah percobaan; diisi lagi untuk masuk setelah diaktifkan kembali.
  await w.getByLabel("Kata sandi", { exact: true }).fill(KATA_SANDI_BARU);

  // Diaktifkan kembali: bisa masuk lagi dengan kata sandinya.
  await page.getByRole("button", { name: /^Aktifkan kembali/ }).click();
  await page.getByRole("dialog", { name: "Aktifkan kembali akun budi.lestari?" }).getByRole("button", { name: "Aktifkan kembali" }).click();
  await expect(page.getByRole("status").filter({ hasText: "aktif kembali" })).toBeFocused();
  await w.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(w).toHaveURL(/\/akun$/);

  // Atur ulang kata sandi: tampil sekali di dalam dialog, lalu hilang saat ditutup.
  await page.getByRole("button", { name: /^Atur ulang kata sandi/ }).click();
  const dialogReset = page.getByRole("dialog", { name: "Atur ulang kata sandi?" });
  await dialogReset.getByRole("button", { name: "Atur ulang" }).click();
  // Setelah berhasil dialog berganti isi dan nama: dari pertanyaan menjadi hasilnya.
  const hasilReset = page.getByRole("dialog", { name: /Kata sandi diatur ulang. Catat kata sandi ini sekarang./ });
  await expect(hasilReset.getByText(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)).toBeVisible();
  await hasilReset.getByRole("button", { name: "Selesai" }).click();
  await expect(hasilReset).toBeHidden();
  await page.getByRole("button", { name: /^Atur ulang kata sandi/ }).click();
  await expect(page.getByRole("dialog", { name: "Atur ulang kata sandi?" }).getByText(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)).toHaveCount(0);

  // Akun itu tidak menulis jejak keputusan publik (jejaknya tertutup).
  await page.goto("/");
  await expect(page.getByText("budi.lestari")).toHaveCount(0);

  expect(konsol()).toEqual([]);
  expect(konsolW()).toEqual([]);
  await warga.close();
  await admin.konteks.close();
});

test("admin tidak bisa menonaktifkan akunnya sendiri; akun admin tidak bisa dibuat dari UI", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await page.goto("/admin/akun?peran=admin");
  await page.getByRole("link", { name: "admin", exact: true }).first().click();
  await expect(page.getByText("Ini akun Anda.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Nonaktifkan/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Atur ulang kata sandi/ })).toHaveCount(0);

  // Alur membuat akun tidak punya pilihan peran.
  await page.goto("/admin/akun/baru");
  await expect(page.getByText("Hanya untuk warga yang sudah terdaftar.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: /peran/i })).toHaveCount(0);

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("moderasi: sembunyikan komentar dari daftar, lihat isinya di sini, tampilkan kembali dengan alasan", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);

  await page.goto("/admin/moderasi");
  const terbaru = page.getByRole("region", { name: "Komentar terbaru" });
  const pertama = terbaru.getByRole("listitem").first();
  const isi = (await pertama.locator("p").nth(1).innerText()).trim();
  const idUsulan = (await pertama.getByRole("link").first().getAttribute("href"))!.replace("/admin/usulan/", "");
  expect(isi.length).toBeGreaterThan(10);

  await pertama.getByRole("button", { name: /^Sembunyikan/ }).click();
  const dialog = page.getByRole("dialog", { name: "Sembunyikan komentar ini?" });
  await dialog.getByLabel("Alasan").fill("Berisi data pribadi yang tidak pantas dibaca umum.");
  await dialog.getByRole("button", { name: "Sembunyikan", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/moderasi\?berhasil=sembunyi&id=/);
  await expect(page.getByRole("status").filter({ hasText: "Konten disembunyikan dari publik." })).toBeFocused();

  // Admin masih melihat isinya (ditandai "Tidak terlihat publik") dan siapa yang menyembunyikan.
  const tersembunyi = page.getByRole("region", { name: /Konten tersembunyi/ });
  const baris = tersembunyi.getByRole("listitem").filter({ hasText: isi });
  await expect(baris.getByText("Tidak terlihat publik")).toBeVisible();
  await expect(baris.getByText(/oleh admin\. Alasan: Berisi data pribadi/)).toBeVisible();

  // Warga tidak melihat isinya, hanya tanggal dan alasan.
  await page.goto(`/forum/${idUsulan}`);
  await expect(page.getByText(isi, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Alasan: Berisi data pribadi yang tidak pantas dibaca umum.").first()).toBeVisible();

  // Tampilkan kembali: alasan wajib, tercatat di jejak publik.
  await page.goto("/admin/moderasi");
  const barisTampil = page.getByRole("region", { name: /Konten tersembunyi/ }).getByRole("listitem").filter({ hasText: isi });
  await barisTampil.getByRole("button", { name: /^Tampilkan kembali/ }).click();
  const dialogTampil = page.getByRole("dialog", { name: "Tampilkan kembali komentar ini?" });
  await dialogTampil.getByRole("button", { name: "Tampilkan kembali" }).click();
  await expect(dialogTampil.getByText(/minimal 10 karakter/)).toBeVisible();
  await dialogTampil.getByLabel("Alasan").fill("Setelah dibaca ulang, isinya tidak melanggar aturan.");
  await dialogTampil.getByRole("button", { name: "Tampilkan kembali" }).click();
  await expect(page).toHaveURL(/\/admin\/moderasi\?berhasil=tampil&id=/);
  await expect(page.getByRole("status").filter({ hasText: "Konten tampil kembali untuk publik." })).toBeFocused();

  await page.goto(`/forum/${idUsulan}`);
  await expect(page.getByText(isi, { exact: true })).toBeVisible();
  await expect(page.getByText(/Satu komentar ditampilkan kembali oleh admin desa\. Alasan: Setelah dibaca ulang/)).toBeVisible();

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("usulan atau akun yang tidak ada: halaman 404 yang membantu", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  for (const alamat of ["/admin/usulan/00000000-0000-4000-8000-000000000000", "/admin/usulan/bukan-uuid", "/admin/akun/00000000-0000-4000-8000-000000000000"]) {
    await page.goto(alamat);
    await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" }), alamat).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat semua usulan" })).toBeVisible();
  }
  await konteks.close();
});
