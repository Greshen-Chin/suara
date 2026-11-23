// E2E fitur forum. Berjalan serial karena tiap tes melanjutkan keadaan database sebelumnya.
// Setiap tes juga memastikan konsol browser bersih (tanpa console.error maupun galat halaman).
import { expect, test, type Page } from "@playwright/test";
import { AKUN, barisUsulan, konteksSebagai, mundurkanWaktu, pantauKonsol, resetDatabase } from "./bantu.ts";

test.describe.configure({ mode: "serial" });

// Server dimulai baru oleh Playwright, jadi cache Next masih kosong dan reset aman di sini.
test.beforeAll(resetDatabase);

const LAMPU_GANG = "Lampu jalan gang RW 07 gelap";
const JEMBATAN = "Jembatan kecil penghubung ke sekolah";
const TONG_SAMPAH = "Tong sampah terpilah di pasar RW 03";

const teksUtama = (page: Page) => page.locator("main").innerText();

async function isiUsulan(page: Page, judul: string, cerita: string, biaya: string, kategori = "infrastruktur") {
  await page.getByLabel("Judul usulan").fill(judul);
  await page.getByLabel("Ceritakan usulan Anda").fill(cerita);
  await page.getByLabel("Kategori").selectOption(kategori);
  await page.getByLabel("Perkiraan biaya").fill(biaya);
}

test("pengunjung membaca semuanya tanpa masuk", async ({ page }) => {
  const konsol = pantauKonsol(page);
  await page.goto("/forum");
  await expect(page.getByRole("heading", { name: "Forum warga", level: 1 })).toBeVisible();

  // Forum memuat usulan forum DAN voting dalam satu daftar (bukan kosong).
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(17);
  await expect(page.getByText("Menampilkan 17 dari 17 usulan")).toBeVisible();
  // Pengunjung diarahkan masuk, bukan dihadapkan tombol yang tidak bisa dipakai.
  await expect(page.getByRole("link", { name: /Masuk untuk mendukung/ })).toHaveCount(13);
  await expect(page.getByRole("button", { name: /^Dukung/ })).toHaveCount(0);

  // Posisi terhadap Garis Pagu, dengan teks (bukan hanya warna).
  const talud = barisUsulan(page, /Talud/);
  await expect(talud.getByText("Peringkat 1 dari 7 rekomendasi")).toBeVisible();
  await expect(talud.getByText("Ditunda", { exact: true })).toBeVisible();
  await expect(barisUsulan(page, /Lampu PJU/).getByText("Terbiayai", { exact: true })).toBeVisible();
  // Dukungan per 1.000 penduduk RW 07: 8 suara / 400 penduduk = 20.
  await expect(talud.getByText("20 per 1.000 penduduk RW")).toBeVisible();

  // Detail: komentar, jejak komentar yang disembunyikan, dan riwayat moderasi, semuanya terbaca publik.
  await page.getByRole("link", { name: TONG_SAMPAH }).first().click();
  await expect(page.getByRole("heading", { name: TONG_SAMPAH, level: 1 })).toBeVisible();
  await expect(page.getByText("Komentar disembunyikan", { exact: true })).toBeVisible();
  await expect(page.getByText("Alasan: Berisi tautan promosi yang tidak berkaitan dengan usulan.").first()).toBeVisible();
  await expect(page.getByText("http://contoh.invalid")).toHaveCount(0); // isi yang disembunyikan tidak bocor
  await expect(page.getByRole("heading", { name: "Komentar (2)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk untuk berkomentar" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  // Halaman utama ikut menampilkan jejak moderasi.
  await page.goto("/");
  await expect(page.getByText("Satu komentar disembunyikan oleh admin desa.").first()).toBeVisible();

  expect(konsol()).toEqual([]);
});

test("usulan yang tidak ada: halaman 404 yang membantu", async ({ page }) => {
  for (const alamat of ["/forum/00000000-0000-4000-8000-000000000000", "/forum/bukan-uuid"]) {
    await page.goto(alamat);
    await expect(page.getByRole("heading", { name: "Usulan tidak ditemukan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat semua usulan" })).toBeVisible();
  }
});

test("filter dan urutan tersimpan di URL; hasil kosong punya tombol hapus filter", async ({ page }) => {
  const konsol = pantauKonsol(page);
  await page.goto("/forum");
  // Di ponsel filter dilipat: terbuka lewat tombolnya, dan tombol memberi tahu keadaannya.
  const buka = page.getByRole("button", { name: "Saring dan urutkan" });
  await expect(buka).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Status", { exact: true })).toBeHidden();
  await buka.click();
  await expect(buka).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Status", { exact: true }).selectOption("voting");
  await expect(page).toHaveURL(/status=voting/);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(7);

  await page.getByLabel("Urutkan", { exact: true }).selectOption("dukungan");
  await expect(page).toHaveURL(/urut=dukungan/);
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Gapura dan taman gerbang desa"); // 60 dukungan

  // Tombol kembali bekerja karena keadaannya ada di URL.
  await page.goBack();
  await expect(page).not.toHaveURL(/urut=/);
  await expect(page.getByRole("button", { name: /Saring dan urutkan · 1 aktif/ })).toBeVisible(); // status=voting masih aktif

  await page.goto("/forum?rw=3&kategori=sosial");
  await expect(page.getByRole("heading", { name: "Tidak ada usulan yang cocok" })).toBeVisible();
  await page.getByRole("link", { name: "Hapus filter" }).last().click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(17);
  expect(konsol()).toEqual([]);
});

test("warga mendukung dan membatalkan; angka forum dan halaman utama ikut berubah", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "warga");
  const konsol = pantauKonsol(page);

  // Usulan forum: dukung -> didukung -> batal.
  await page.goto("/forum");
  const baris = barisUsulan(page, LAMPU_GANG);
  const tombol = baris.getByRole("button", { name: /dukung/i });
  await expect(tombol).toHaveAttribute("aria-pressed", "false");
  await expect(baris.getByText("8", { exact: true })).toBeVisible();

  await tombol.click();
  await expect(tombol).toHaveAttribute("aria-pressed", "true");
  await expect(tombol).toContainText("Didukung");
  await expect(baris.getByText("9", { exact: true })).toBeVisible();
  await expect(baris.getByRole("status").filter({ hasText: "Dukungan ditambahkan. Sekarang 9 dukungan." })).toBeAttached();

  await page.reload();
  const sesudahMuat = barisUsulan(page, LAMPU_GANG);
  await expect(sesudahMuat.getByRole("button", { name: /Didukung/ })).toHaveAttribute("aria-pressed", "true");
  await expect(sesudahMuat.getByText("9", { exact: true })).toBeVisible();

  await sesudahMuat.getByRole("button", { name: /Didukung/ }).click();
  await expect(sesudahMuat.getByRole("status")).toContainText("Dukungan dibatalkan. Sekarang 8 dukungan.");
  await expect(sesudahMuat.getByRole("button", { name: /^Dukung/ })).toHaveAttribute("aria-pressed", "false");
  await expect(sesudahMuat.getByText("8", { exact: true })).toBeVisible();

  // Usulan voting: dukungan mengubah angka di halaman utama (cache ditandai dan diperbarui).
  await page.goto("/");
  expect(await teksUtama(page)).toContain("27 suara, 67,5 per 1.000 penduduk");

  await page.goto("/forum");
  const jembatan = barisUsulan(page, JEMBATAN);
  await jembatan.getByRole("button", { name: /^Dukung/ }).click();
  await expect(jembatan.getByRole("status")).toContainText("Dukungan ditambahkan. Sekarang 6 dukungan.");
  await expect(jembatan.getByRole("button", { name: /Didukung/ })).toBeVisible();
  await expect(jembatan.getByText("6", { exact: true })).toBeVisible();

  await page.goto("/");
  expect(await teksUtama(page)).toContain("28 suara, 70 per 1.000 penduduk");

  // Dikembalikan supaya tes berikutnya mulai dari angka seed.
  await page.goto("/forum");
  await barisUsulan(page, JEMBATAN).getByRole("button", { name: /Didukung/ }).click();
  await expect(barisUsulan(page, JEMBATAN).getByRole("status")).toContainText("Dukungan dibatalkan. Sekarang 5 dukungan.");
  await page.goto("/");
  expect(await teksUtama(page)).toContain("27 suara, 67,5 per 1.000 penduduk");

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("admin tidak memberi dukungan dan komentarnya berlabel Admin desa", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin");
  const konsol = pantauKonsol(page);
  await page.goto("/forum");
  await expect(page.getByRole("button", { name: /^Dukung/ })).toHaveCount(0);
  await expect(page.getByText("Admin desa tidak memberi dukungan, supaya hasilnya tidak terpengaruh.").first()).toBeVisible();

  await page.getByRole("link", { name: LAMPU_GANG }).first().click();
  await expect(page.getByText("Admin desa", { exact: true }).first()).toBeVisible();
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("warga: periksa usulan serupa lalu gabung dukungan (usulan baru dibatalkan)", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "warga");
  const konsol = pantauKonsol(page);

  await page.goto("/forum/usul");
  await isiUsulan(
    page,
    "Lampu di lorong RW 07 tidak menyala",
    "Lorong dekat musala tidak ada penerangan, warga takut lewat malam hari dan anak-anak sering jatuh.",
    "Rp 20 jt",
  );
  await expect(page.getByText("Terbaca: Rp 20.000.000")).toBeVisible();
  await page.getByRole("button", { name: "Periksa usulan serupa" }).click();

  await expect(page.getByRole("heading", { name: /Ada \d usulan yang mirip/ })).toBeVisible({ timeout: 30_000 });
  // Label AI hanya muncul karena embedding benar-benar dipakai.
  await expect(page.getByText(/^AI membandingkan makna usulan Anda/)).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(LAMPU_GANG) })).toBeVisible();
  await expect(page.getByText(/Sama-sama menyebut .*di RW yang sama/)).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`Dukung usulan ini.*${LAMPU_GANG}`) }).click();
  await expect(page).toHaveURL(/\/forum\/[0-9a-f-]{36}\?gabung=1$/);
  await expect(page.getByText("Dukungan Anda sudah digabungkan")).toBeVisible();
  await expect(page.getByRole("heading", { name: LAMPU_GANG, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Didukung/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("9", { exact: true })).toBeVisible();

  // Draf dihapus setelah berhasil, dan tidak ada usulan baru yang terkirim.
  await page.goto("/forum/usul");
  await expect(page.getByLabel("Judul usulan")).toHaveValue("");
  await page.goto("/forum");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(17);

  // Kembalikan dukungan.
  await page.getByRole("link", { name: LAMPU_GANG }).first().click();
  await expect(page.getByRole("heading", { name: LAMPU_GANG, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Didukung/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Dukungan dibatalkan" })).toBeAttached();
  await expect(page.getByRole("button", { name: /^Dukung/ })).toHaveAttribute("aria-pressed", "false");
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("warga: validasi, draf, sesi habis, kirim usulan, dan batas laju", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "warga");
  const konsol = pantauKonsol(page);

  await page.goto("/forum/usul");
  // Isian kosong: galat di dekat kolomnya, fokus ke kolom pertama yang salah.
  await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ada 4 isian yang perlu diperbaiki." })).toBeVisible();
  await expect(page.getByLabel("Judul usulan")).toBeFocused();
  await expect(page.getByText("Tulis judul usulan.")).toBeVisible();
  await expect(page.getByText("Pilih kategori.")).toBeVisible();

  // Biaya: "85" ditolak dengan petunjuk; 85 juta diterima.
  await isiUsulan(
    page,
    "Perpustakaan desa dengan komputer dan internet",
    "Anak-anak butuh tempat membaca dan mengerjakan tugas dengan komputer dan internet gratis di desa.",
    "85",
  );
  await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
  await expect(page.getByText(/Biaya minimal Rp 100\.000/)).toBeVisible();
  await page.getByLabel("Perkiraan biaya").fill("85 juta");
  await expect(page.getByText("Terbaca: Rp 85.000.000")).toBeVisible();

  // Draf bertahan saat halaman dimuat ulang.
  await page.reload();
  await expect(page.getByText("Draf Anda dipulihkan dari perangkat ini.")).toBeVisible();
  await expect(page.getByLabel("Judul usulan")).toHaveValue("Perpustakaan desa dengan komputer dan internet");
  await expect(page.getByLabel("RW lokasi")).toHaveValue("7"); // bawaan: RW warga

  await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
  await expect(page.getByRole("heading", { name: "Tidak ada usulan yang mirip" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Lanjut ke tinjauan" }).click();
  await expect(page.getByRole("heading", { name: "Tinjau usulan Anda" })).toBeFocused();
  await expect(page.getByText("Rp 85.000.000")).toBeVisible();

  // Sesi habis saat mengirim: pesan jelas, lalu kembali ke formulir dengan draf utuh.
  await konteks.clearCookies();
  await page.getByRole("button", { name: "Kirim usulan" }).click();
  await expect(page.getByText(/Sesi Anda sudah berakhir/)).toBeVisible();
  await page.getByRole("link", { name: "Masuk lagi" }).click();
  await page.getByLabel("Nama pengguna").fill(AKUN.warga.nama);
  await page.getByLabel("Kata sandi", { exact: true }).fill(AKUN.warga.sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/forum\/usul$/);
  await expect(page.getByText("Draf Anda dipulihkan dari perangkat ini.")).toBeVisible();
  await expect(page.getByLabel("Judul usulan")).toHaveValue("Perpustakaan desa dengan komputer dan internet");

  // Kirim: halaman detail usulan baru dengan konfirmasi, status Sedang dibahas, dukungan pertama dari pengusul.
  await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
  await page.getByRole("button", { name: "Lanjut ke tinjauan" }).click();
  await page.getByRole("button", { name: "Kirim usulan" }).click();
  await expect(page).toHaveURL(/\/forum\/[0-9a-f-]{36}\?baru=1$/);
  await expect(page.getByText("Usulan Anda sudah terkirim")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perpustakaan desa dengan komputer dan internet", level: 1 })).toBeVisible();
  await expect(page.getByText("Sedang dibahas").first()).toBeVisible();
  await expect(page.getByText("Urgensi belum dinilai")).toBeVisible();
  await expect(page.getByRole("button", { name: /Didukung/ })).toBeVisible();
  const alamatBaru = new URL(page.url()).pathname;

  // Tampil di daftar tanpa menunggu cache kedaluwarsa.
  await page.goto("/forum");
  await expect(page.getByText("Menampilkan 18 dari 18 usulan")).toBeVisible();

  // Komentar: muncul tanpa memuat ulang halaman; yang kedua terlalu cepat ditolak dengan waktu tunggu.
  await page.goto(alamatBaru);
  let jumlahMuat = 0;
  page.on("load", () => jumlahMuat++);
  const kolom = page.getByLabel("Tulis komentar");
  await kolom.fill("Setuju, anak saya butuh tempat belajar yang tenang.");
  await page.getByRole("button", { name: "Kirim komentar" }).click();
  await expect(page.getByText("Setuju, anak saya butuh tempat belajar yang tenang.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Komentar (1)" })).toBeVisible();
  await expect(kolom).toHaveValue("");
  await expect(page.getByText("Komentar terkirim.")).toBeVisible();
  expect(jumlahMuat).toBe(0);

  await kolom.fill("Komentar kedua terlalu cepat.");
  await page.getByRole("button", { name: "Kirim komentar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Tunggu \d+ detik lagi/ })).toBeVisible();
  await expect(kolom).toHaveValue("Komentar kedua terlalu cepat."); // teks tidak hilang saat gagal
  await mundurkanWaktu();
  await page.getByRole("button", { name: "Kirim komentar" }).click();
  await expect(page.getByRole("heading", { name: "Komentar (2)" })).toBeVisible();

  // Batas karakter: pesan di dekat kolom.
  await kolom.fill("x".repeat(1001));
  await expect(page.getByText("Komentar terlalu panjang. Maksimal 1000 karakter.")).toBeVisible();
  await kolom.fill("");

  // Batas laju usulan: tiga per 24 jam. Usulan pertama sudah terkirim di atas.
  await mundurkanWaktu(); // memundurkan juga usulan tadi; hitung ulang dari nol
  for (const n of [1, 2, 3]) {
    await page.goto("/forum/usul");
    await isiUsulan(page, `Usulan uji batas laju nomor ${n}`, "Usulan ini dibuat untuk menguji batas jumlah usulan per hari dengan isian yang cukup panjang.", "50 juta", "sosial");
    await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
    await page.getByRole("button", { name: /Lanjut ke tinjauan|Tetap ajukan usulan saya/ }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: "Kirim usulan" }).click();
    await expect(page).toHaveURL(/\?baru=1$/);
  }
  await page.goto("/forum/usul");
  await isiUsulan(page, "Usulan uji batas laju nomor 4", "Usulan keempat dalam sehari seharusnya ditolak dengan pesan kapan bisa mencoba lagi.", "50 juta", "sosial");
  await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
  await page.getByRole("button", { name: /Lanjut ke tinjauan|Tetap ajukan usulan saya/ }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Kirim usulan" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Anda sudah mengirim 3 usulan dalam 24 jam terakhir\. Usulan berikutnya bisa dikirim \d+ jam lagi\./ })).toBeVisible();
  await expect(page).toHaveURL(/\/forum\/usul$/); // tidak berpindah, isian tetap ada

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("admin menyembunyikan komentar dengan dialog; jejaknya terbaca publik", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 1440);
  const konsol = pantauKonsol(page);

  await page.goto("/forum");
  await page.getByRole("link", { name: "Pelatihan menjahit untuk ibu rumah tangga" }).first().click();
  const tombol = page.getByRole("button", { name: /Sembunyikan \(komentar dari .*RW 01\)/ }).first();

  // Dialog asli: fokus terperangkap, Esc menutup, fokus kembali ke tombol asal.
  await tombol.click();
  const dialog = page.getByRole("dialog", { name: "Sembunyikan komentar ini?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Alasan")).toBeFocused();
  // Dialog modal asli: fokus hanya berputar di dalam dialog (atau keluar ke antarmuka browser,
  // yang membuat activeElement menjadi body). Elemen halaman di belakangnya tidak pernah terjangkau.
  const sempat: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    sempat.push(
      await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return "browser";
        return a.closest("dialog") ? "dialog" : `LUAR:${a.tagName}`;
      }),
    );
  }
  expect(sempat.filter((x) => x.startsWith("LUAR"))).toEqual([]);
  expect(sempat).toContain("dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(tombol).toBeFocused();

  // Alasan wajib: terlalu pendek ditolak, pesannya di dekat kolom.
  await tombol.click();
  await dialog.getByLabel("Alasan").fill("pendek");
  await dialog.getByRole("button", { name: "Sembunyikan", exact: true }).click();
  await expect(dialog.getByText(/Tulis alasannya, minimal 10 karakter/)).toBeVisible();
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Alasan").fill("Mengandung data pribadi warga.");
  await dialog.getByRole("button", { name: "Sembunyikan", exact: true }).click();
  await expect(dialog).toBeHidden();
  const jejak = page.getByText("Komentar disembunyikan", { exact: true });
  await expect(jejak).toBeVisible();
  await expect(page.getByText("Alasan: Mengandung data pribadi warga.", { exact: true })).toBeVisible();
  // Fokus berpindah ke jejak (tombol pemicunya sudah hilang).
  await expect(page.locator('[id^="komentar-"]:focus')).toHaveCount(1);

  // Pengunjung (tanpa akun) melihat jejak yang sama, tanpa isi komentar.
  const tamu = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const halamanTamu = await tamu.newPage();
  await halamanTamu.goto(page.url());
  await expect(halamanTamu.getByText("Alasan: Mengandung data pribadi warga.", { exact: true })).toBeVisible();
  await expect(halamanTamu.getByRole("heading", { name: /Komentar \(2\)/ })).toBeVisible(); // 3 komentar, 1 tersembunyi tidak dihitung
  await halamanTamu.goto("/");
  await expect(halamanTamu.getByText("Alasan: Mengandung data pribadi warga.").first()).toBeVisible();
  await tamu.close();

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("admin menyembunyikan usulan: hilang dari daftar, jejak publik tetap ada", async ({ browser }) => {
  const { konteks, page } = await konteksSebagai(browser, "admin", 1440);
  const konsol = pantauKonsol(page);

  await page.goto("/forum");
  await page.getByRole("link", { name: "Lampu taman lapangan RW 01 sering mati" }).first().click();
  await page.getByRole("button", { name: /Sembunyikan usulan/ }).click();
  const dialog = page.getByRole("dialog", { name: "Sembunyikan usulan ini?" });
  await dialog.getByLabel("Alasan").fill("Duplikat dengan usulan lain di forum.");
  await dialog.getByRole("button", { name: "Sembunyikan", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Usulan disembunyikan", level: 1 })).toBeVisible();
  await expect(page.locator("#hasil-moderasi")).toBeFocused();
  await expect(page.locator("#hasil-moderasi")).toContainText("Alasan: Duplikat dengan usulan lain di forum.");
  const alamat = new URL(page.url()).pathname;

  await page.goto("/forum");
  // 17 usulan seed (13 + 4 periode lampau) + 4 yang dibuat tes sebelumnya = 21; satu disembunyikan -> 20.
  await expect(page.getByText("Menampilkan 20 dari 20 usulan")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lampu taman lapangan RW 01 sering mati" })).toHaveCount(0);

  const tamu = await browser.newContext();
  const halamanTamu = await tamu.newPage();
  await halamanTamu.goto(alamat);
  await expect(halamanTamu.getByRole("heading", { name: "Usulan disembunyikan", level: 1 })).toBeVisible();
  await expect(halamanTamu.locator("#hasil-moderasi")).toContainText("Disembunyikan oleh admin desa");
  await expect(halamanTamu.locator("#hasil-moderasi")).toContainText("Alasan: Duplikat dengan usulan lain di forum.");
  await expect(halamanTamu.getByText("Lampu taman lapangan")).toHaveCount(0); // judulnya tidak ikut bocor
  await expect(halamanTamu.getByRole("heading", { name: "Komentar" })).toHaveCount(0); // diskusi ikut ditutup
  await tamu.close();

  expect(konsol()).toEqual([]);
  await konteks.close();
});
