// E2E halaman /simulasi: pagu, bobot, uji ketahanan, Peta Pagu, usulan forum andaian, alamat yang bisa dibagikan,
// masukan alamat yang rusak, dan tanpa JavaScript. Berjalan terhadap server tiruan Supabase (data demo) dan build
// produksi; angka-angkanya dari data demo (lihat docs/simulasi.md).
//
// Teks dicocokkan dengan STRING, bukan regex: Playwright menormalkan spasi pada string, sedangkan regex melihat
// spasi tak terputus di dalam "Rp 300 juta" apa adanya.
import { expect, test, type Page } from "@playwright/test";
import { biasa, idUsulanForum, konteksTamu, pantauKonsol, resetDanSegarkan, sliderPagu } from "./bantu.ts";

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => resetDanSegarkan(browser));

const JT = 1_000_000;
const query = (page: Page) => new URL(page.url()).search;
const besarPagu = (page: Page) => page.getByTestId("pagu-besar");

/** Menggeser pagu lewat slider. Diulang sampai berhasil: sebelum hidrasi, peristiwa input belum ditangani. */
async function aturPagu(page: Page, juta: number) {
  await expect(async () => {
    await sliderPagu(page).fill(String(juta * JT));
    await expect(besarPagu(page)).toHaveText(`Rp ${juta} juta`, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

/** Menunggu halaman terhidrasi: geseran harus menanggapi. */
async function buka(page: Page, alamat = "/simulasi") {
  await page.goto(alamat);
  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();
  await expect(async () => {
    const awal = await besarPagu(page).innerText();
    await sliderPagu(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(besarPagu(page)).not.toHaveText(awal, { timeout: 1000 });
    await page.keyboard.press("ArrowLeft");
    await expect(besarPagu(page)).toHaveText(awal, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

const ringkasan = (page: Page, teks: string) => page.getByText(teks).first();
const daftarAndaian = (page: Page) => page.getByRole("list", { name: "Usulan forum yang ditambahkan ke simulasi" });
const petaPagu = (page: Page) => page.getByRole("list", { name: "Pagu yang dibutuhkan tiap usulan, dari yang paling cepat terbiayai" });

test("keadaan resmi: judul, ringkasan, batang, peta, tabel per RW, dan uji ketahanan 231 dari 231", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 1440);
  const konsol = pantauKonsol(page);
  await page.goto("/simulasi");

  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();
  await expect(page.getByText("Ubah pagu dan bobot, lalu lihat usulan mana yang terbiayai.").first()).toBeVisible();
  await expect(ringkasan(page, "4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Pembagian pagu Rp 300 juta" })).toBeVisible();
  await expect(page.getByText("Sama dengan rekomendasi resmi.")).toBeVisible();

  // Uji ketahanan sudah ada di HTML pertama (dihitung di server), dan ajakan dihitung, bukan ditanam.
  await expect(page.getByText("hasilnya sama untuk 231 dari 231 kombinasi bobot. Rekomendasi ini tidak bergantung pada bobot yang dipilih.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Coba pagu Rp 280 juta" })).toBeVisible();

  // Peta Pagu: tujuh baris dengan kalimat, urutan dari yang paling cepat terbiayai.
  const peta = petaPagu(page);
  await expect(peta.getByRole("listitem")).toHaveCount(7);
  await expect(peta.getByRole("listitem").first()).toContainText("Lampu PJU");
  await expect(peta.getByRole("listitem").last()).toContainText("Talud");
  await expect(peta).toContainText("Talud baru muat kalau pagunya Rp 505 juta, Rp 205 juta lebih banyak dari pagu sekarang.");
  await expect(peta).toContainText("Gapura muat pada Rp 465–500 juta, lalu lagi dari Rp 685 juta.");
  await expect(peta).toContainText("Balai warga muat pada Rp 395–460 juta, Rp 615–680 juta, lalu lagi dari Rp 795 juta.");

  // Tabel per RW: RW 07 mendapat Rp 200 juta (Rp 500.000 per penduduk), RW 01 tidak kebagian.
  const tabel = page.getByRole("table", { name: "Anggaran yang diterima tiap RW, rekomendasi resmi dan simulasi Anda" });
  await expect(tabel).toBeVisible();
  await expect(tabel.getByRole("row", { name: /RW 07/ })).toContainText("Rp 200 juta");
  await expect(tabel.getByRole("row", { name: /RW 07/ })).toContainText("Rp 500.000");
  await expect(tabel.getByRole("row", { name: /RW 01/ })).toContainText("Rp 0");

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("langkah manual pemilik: pagu Rp 505 juta menjadikan Talud terbiayai, kembali ke Rp 300 juta menyebut 231 dari 231", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(page);
  await buka(page);

  await aturPagu(page, 505);
  await expect(ringkasan(page, "5 dari 7 usulan terbiayai. Sisa pagu Rp 0.")).toBeVisible();
  const barisTalud = petaPagu(page).getByRole("listitem").filter({ hasText: "Talud" });
  await expect(barisTalud).toContainText("Terbiayai");
  await expect(barisTalud).toContainText("Talud terbiayai mulai Rp 505 juta dan seterusnya.");
  await expect(page.getByRole("list", { name: "Usulan yang berubah dari rekomendasi resmi" })).toContainText("Talud RW 07");
  await expect(page.getByRole("list", { name: "Pembagian pagu Rp 505 juta" })).toContainText("Talud");

  // Kembali ke pagu resmi.
  await page.getByRole("button", { name: /Kembali ke pagu resmi/ }).click();
  await expect(besarPagu(page)).toHaveText("Rp 300 juta");
  await expect(page.getByText("hasilnya sama untuk 231 dari 231 kombinasi bobot")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Sama dengan rekomendasi resmi.")).toBeVisible();
  await expect.poll(() => query(page)).toBe("");

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("uji ketahanan: Rp 450 juta bobot menentukan (133 dan 98), Rp 250 juta tiga pilihan, ajakan Rp 280 juta", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 1440);
  await buka(page);

  await aturPagu(page, 450);
  await expect(
    page.getByText("Pada pagu Rp 450 juta, bobot menentukan. 133 dari 231 kombinasi membiayai Balai warga dan Jalan SDN 03; 98 lainnya membiayai Talud."),
  ).toBeVisible({ timeout: 20_000 });
  // Rincian per usulan: Drainase pada 231 dari 231, Talud pada 98.
  const rincian = page.getByRole("list", { name: /Berapa kombinasi bobot yang membiayai tiap usulan/ });
  await expect(rincian.getByRole("listitem").filter({ hasText: "Drainase" })).toContainText("231 dari 231");
  await expect(rincian.getByRole("listitem").filter({ hasText: "Talud" })).toContainText("98 dari 231");

  await aturPagu(page, 250);
  await expect(
    page.getByText(
      "Pada pagu Rp 250 juta, bobot menentukan. 147 dari 231 kombinasi membiayai Jembatan dan Lampu PJU; 49 lainnya membiayai Jalan SDN 03 dan Lampu PJU; 35 lainnya membiayai Jalan SDN 03 dan Jembatan.",
    ),
  ).toBeVisible({ timeout: 20_000 });

  // Ajakan dihitung untuk pagu yang bobotnya tidak berpengaruh, lalu menggeser pagu ke sana.
  await aturPagu(page, 300);
  const coba = page.getByRole("button", { name: "Coba pagu Rp 280 juta" });
  await expect(coba).toBeVisible({ timeout: 20_000 });
  await coba.click();
  await expect(besarPagu(page)).toHaveText("Rp 280 juta");
  await expect(page.getByText("Pada pagu Rp 280 juta, bobot menentukan")).toBeVisible({ timeout: 20_000 });
  await konteks.close();
});

test("bobot: preset, geseran yang selalu berjumlah 100, dan kalimat apa yang berubah", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 1440);
  const konsol = pantauKonsol(page);
  await buka(page);

  const nilai = async () => [
    Number(await page.getByLabel("Popularitas", { exact: true }).inputValue()),
    Number(await page.getByLabel("Urgensi", { exact: true }).inputValue()),
    Number(await page.getByLabel("Pemerataan", { exact: true }).inputValue()),
  ];
  expect(await nilai()).toEqual([30, 40, 30]);
  await expect(page.getByRole("button", { name: "Resmi", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Preset "Dukungan saja" (100/0/0): yang terbiayai tetap sama, tetapi Gapura dan Balai warga menjadi Ditunda.
  await page.getByRole("button", { name: "Dukungan saja" }).click();
  await expect(page.getByRole("button", { name: "Dukungan saja" })).toHaveAttribute("aria-pressed", "true");
  expect(await nilai()).toEqual([100, 0, 0]);
  await expect(ringkasan(page, "4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta.")).toBeVisible();
  await expect(page.getByText("Usulan yang terbiayai sama dengan rekomendasi resmi.").first()).toBeVisible();
  await expect(page.getByText("Dengan bobot Anda, pada pagu ini")).toBeVisible();
  await expect(page.getByText("Gapura RW 01 dan Balai warga RW 01 berubah dari Tidak terpilih menjadi Ditunda.")).toBeVisible();

  // Menggeser satu bobot dengan keyboard membagi ulang dua lainnya; jumlahnya tetap 100 dan semuanya kelipatan 5.
  await page.getByRole("button", { name: "Resmi", exact: true }).click();
  const pop = page.getByLabel("Popularitas", { exact: true });
  await pop.focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
    const [a, b, c] = await nilai();
    expect(a + b + c).toBe(100);
    expect([a, b, c].every((x) => x % 5 === 0 && x >= 0 && x <= 100)).toBe(true);
  }
  expect((await nilai())[0]).toBe(50);
  await page.keyboard.press("End");
  expect(await nilai()).toEqual([100, 0, 0]);

  // Alamat memuat bobot, dan muat ulang memulihkannya.
  await expect.poll(() => query(page)).toBe("?bobot=100-0-0");
  await page.reload();
  await expect(page.getByLabel("Popularitas", { exact: true })).toHaveValue("100");
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("alamat: tulis, muat ulang, buka di perangkat lain, dan tombol kembali menghasilkan keadaan yang sama", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(page);
  await buka(page);

  await aturPagu(page, 350);
  await page.getByRole("button", { name: "Keselamatan dulu" }).click();
  await expect.poll(() => query(page), { timeout: 10_000 }).toBe("?pagu=350000000&bobot=10-80-10");

  await page.reload();
  await expect(besarPagu(page)).toHaveText("Rp 350 juta");
  await expect(page.getByLabel("Urgensi", { exact: true })).toHaveValue("80");

  // Salin tautan lewat tombol, buka di konteks lain (perangkat lain): keadaannya sama.
  await konteks.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Bagikan simulasi ini" }).click();
  await expect(page.getByText("Tautan disalin. Siapa pun yang membukanya melihat simulasi yang sama.")).toBeVisible();
  const tautan = await page.evaluate(() => navigator.clipboard.readText());
  expect(tautan).toMatch(/\/simulasi\?pagu=350000000&bobot=10-80-10$/);

  const lain = await konteksTamu(browser, 1440);
  await lain.page.goto(tautan);
  await expect(besarPagu(lain.page)).toHaveText("Rp 350 juta", { timeout: 20_000 });
  await expect(lain.page.getByLabel("Popularitas", { exact: true })).toHaveValue("10");
  await lain.konteks.close();

  // Tombol kembali: alamat sebelumnya memulihkan keadaannya.
  await page.goto("/simulasi?pagu=450000000");
  await expect(besarPagu(page)).toHaveText("Rp 450 juta", { timeout: 20_000 });
  await page.goBack();
  await expect(besarPagu(page)).toHaveText("Rp 350 juta", { timeout: 20_000 });
  await page.goForward();
  await expect(besarPagu(page)).toHaveText("Rp 450 juta", { timeout: 20_000 });

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("alamat rusak tidak menggagalkan halaman; nilai tidak sah diabaikan, yang sah dipakai", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(page);
  const rusak = [
    "/simulasi?pagu=abc&bobot=1-2-3&tambah=xyz.5",
    "/simulasi?pagu=99&bobot=100-100-100&tambah=%00",
    "/simulasi?pagu=9999999999999999999&tambah=&tambah=,,",
    "/simulasi?%E0%A4%A=%",
    "/simulasi?bobot=20-60-20&pagu=bukan",
  ];
  for (const alamat of rusak) {
    await page.goto(alamat);
    await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 }), alamat).toBeVisible();
    await expect(page.getByLabel("Popularitas", { exact: true }), alamat).toBeVisible();
    await expect(besarPagu(page), alamat).toHaveText("Rp 300 juta");
  }
  // Satu nilai sah di antara yang rusak tetap dipakai (alamat terakhir).
  await expect(page.getByLabel("Popularitas", { exact: true })).toHaveValue("20", { timeout: 20_000 });
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("tambah usulan forum: satu, beberapa sekaligus (S-07), ubah urgensi, lepas, dan alamat memuatnya", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 1440);
  const konsol = pantauKonsol(page);
  await buka(page);

  const pilih = page.getByLabel("Usulan dari forum", { exact: true });
  const tambah = page.getByRole("button", { name: "Tambahkan ke simulasi" });
  const daftar = daftarAndaian(page);

  async function tambahkan(nama: string, urgensi: number) {
    await expect(async () => {
      await pilih.selectOption({ label: await pilih.locator("option", { hasText: nama }).first().innerText() });
      await page.getByRole("radio", { name: String(urgensi), exact: true }).check({ force: true });
      await tambah.click();
      await expect(daftar.getByRole("listitem").filter({ hasText: nama })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });
  }

  await tambahkan("Lampu gang", 8);
  await expect(daftar.getByRole("listitem").filter({ hasText: "Lampu gang" })).toContainText("andaian");
  await expect(daftar).toContainText("Dengan urgensi 8, Lampu gang RW 07 berada di peringkat 3 dari 8: Terbiayai.", { timeout: 20_000 });
  await expect(ringkasan(page, "4 dari 8 usulan terbiayai")).toBeVisible();

  // Dua lagi sekaligus: semuanya tampil benar, tidak ada yang menimpa yang lain.
  await tambahkan("Atap pos ronda", 6);
  await tambahkan("Tong sampah", 4);
  await expect(daftar.getByRole("listitem")).toHaveCount(3);
  await expect(ringkasan(page, "dari 10 usulan terbiayai")).toBeVisible({ timeout: 20_000 });
  const peta = petaPagu(page);
  await expect(peta.getByRole("listitem")).toHaveCount(10);
  for (const nama of ["Lampu gang", "Atap pos ronda", "Tong sampah"]) {
    await expect(peta.getByRole("listitem").filter({ hasText: nama })).toContainText("andaian");
  }
  await expect(page.getByRole("list", { name: "Pembagian pagu Rp 300 juta" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Pembagian pagu resmi Rp 300 juta" })).toBeVisible();

  // Alamat memuat ketiganya; muat ulang memulihkan semuanya dengan urgensinya masing-masing.
  await expect.poll(() => (query(page).match(/tambah=/g) ?? []).length, { timeout: 10_000 }).toBe(3);
  await page.reload();
  await expect(daftar.getByRole("listitem")).toHaveCount(3, { timeout: 20_000 });
  await expect(daftar.getByRole("listitem").filter({ hasText: "Atap pos ronda" }).getByLabel("Urgensi andaian")).toHaveValue("6");

  // Ubah urgensi dan lepas.
  await daftar.getByRole("listitem").filter({ hasText: "Tong sampah" }).getByLabel("Urgensi andaian").selectOption("9");
  await expect(daftar).toContainText("Dengan urgensi 9, Tong sampah", { timeout: 20_000 });
  await daftar.getByRole("listitem").filter({ hasText: "Tong sampah" }).getByRole("button", { name: /Lepas/ }).click();
  await expect(daftar.getByRole("listitem")).toHaveCount(2);
  await expect(peta.getByRole("listitem")).toHaveCount(9, { timeout: 20_000 });

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("dari forum: tautan 'Lihat kalau usulan ini dihitung' membuka simulasi dengan usulan itu sudah ditambahkan", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(page);
  const id = await idUsulanForum(page, "Lampu jalan gang RW 07 gelap");
  await page.goto(`/forum/${id}`);
  const tautan = page.getByRole("link", { name: "Lihat kalau usulan ini dihitung" });
  await expect(tautan).toBeVisible();
  await expect(tautan).toHaveAttribute("href", `/simulasi?tambah=${id}.5`);

  // Navigasi lunak (klik), bukan memuat ulang: keadaan dibaca dari alamat setelah berpindah halaman.
  await tautan.click();
  await expect(page).toHaveURL(/\/simulasi\?tambah=/);
  const daftar = daftarAndaian(page);
  await expect(daftar.getByRole("listitem")).toHaveCount(1, { timeout: 20_000 });
  await expect(daftar).toContainText("Dengan urgensi 5, Lampu gang RW 07 berada di peringkat", { timeout: 20_000 });

  // Usulan yang berstatus voting tidak punya tautan itu.
  await page.goto("/forum");
  await page.getByRole("link", { name: "Talud penahan longsor tebing RW 07" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Talud");
  await expect(page.getByRole("link", { name: "Lihat kalau usulan ini dihitung" })).toHaveCount(0);

  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("usulan di alamat yang bukan forum lagi diabaikan dengan satu kalimat pemberitahuan", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  const konsol = pantauKonsol(page);
  const idVoting = await idUsulanForum(page, "Talud penahan longsor tebing RW 07");
  const idForum = await idUsulanForum(page, "Atap pos ronda RW 01 bocor saat hujan");
  await page.goto(`/simulasi?tambah=${idVoting}.5&tambah=${idForum}.6`);
  await expect(page.getByText("Satu usulan dari tautan ini tidak bisa ditambahkan lagi")).toBeVisible({ timeout: 20_000 });
  const daftar = daftarAndaian(page);
  await expect(daftar.getByRole("listitem")).toHaveCount(1);
  await expect(daftar).toContainText("Atap pos ronda");
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("ponsel: bilah ringkasan di dasar layar bisa ditekan dan membawa kembali ke pengatur pagu", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360, 800);
  const konsol = pantauKonsol(page);
  await buka(page);
  // Gulir jauh ke bawah: pengatur pagu tidak terlihat lagi, tetapi ringkasannya tetap menempel.
  await page.getByLabel("Usulan dari forum", { exact: true }).scrollIntoViewIfNeeded();
  await expect(sliderPagu(page)).not.toBeInViewport();
  const bilah = page.getByRole("link", { name: /Ke pengatur pagu/ });
  await expect(bilah).toBeInViewport();
  await expect(bilah).toHaveAccessibleName("Rp 300 juta, 4 terbiayai, sisa Rp 15 juta. Ke pengatur pagu");
  await bilah.click();
  await expect(page).toHaveURL(/#kendali-pagu$/);
  await expect(sliderPagu(page)).toBeInViewport();
  expect(konsol()).toEqual([]);
  await konteks.close();
});

test("tanpa JavaScript: rekomendasi resmi, Peta Pagu, tabel per RW, dan uji ketahanan tetap terbaca dari server", async ({ browser }) => {
  const konteks = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 900 }, locale: "id-ID", baseURL: "http://localhost:3100" });
  const page = await konteks.newPage();
  await page.goto("/simulasi");

  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();
  await expect(page.getByText("4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta.").first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Pembagian pagu Rp 300 juta" })).toContainText("Drainase");
  await expect(petaPagu(page).getByRole("listitem")).toHaveCount(7);
  await expect(page.getByRole("table", { name: "Anggaran yang diterima tiap RW, rekomendasi resmi dan simulasi Anda" })).toBeVisible();
  await expect(page.getByText("hasilnya sama untuk 231 dari 231 kombinasi bobot")).toBeVisible();
  // Kendali disertai kalimat bahwa simulasi butuh JavaScript. Diperiksa di HTML dari server, bukan di tampilan: bila
  // skrip dimatikan lewat Playwright, parser Chromium sudah memutuskan memperlakukan isi <noscript> sebagai teks.
  const html = biasa(await page.content());
  expect(html).toContain("Mengubah pagu dan bobot butuh JavaScript.");
  // Peta punya padanan teks di HTML dari server.
  expect(html).toContain("Talud baru muat kalau pagunya Rp 505 juta");
  await konteks.close();
});
