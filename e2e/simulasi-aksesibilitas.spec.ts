// Aksesibilitas /simulasi: axe (WCAG 2.0/2.1/2.2 A dan AA) di 360 dan 1440 px untuk setiap keadaan baru, keyboard penuh,
// pengumuman dibatasi frekuensinya (S-09), padanan teks Peta Pagu (S-10), reflow 320 px, spasi teks WCAG 1.4.12, dan
// target sentuh 44 px. axe tidak menggantikan uji manual dengan pembaca layar; lihat docs/simulasi.md.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { idUsulanForum, konteksTamu, pantauKonsol, resetDanSegarkan, sliderPagu } from "./bantu.ts";

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => resetDanSegarkan(browser));

const LEBAR = [360, 1440] as const;
const TAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const JT = 1_000_000;

async function periksa(page: Page, nama: string) {
  // Kursor dipindah dan transisi (0,15 dtk) ditunggu selesai: yang diukur keadaan diam.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const hasil = await new AxeBuilder({ page }).withTags(TAG).exclude("nextjs-portal").analyze();
  const ringkas = hasil.violations.map((v) => `${v.id} [${v.impact}] ${v.nodes.length}x: ${v.nodes[0]?.target.join(" ")} | ${v.help}`);
  expect(ringkas, `pelanggaran axe di ${nama}`).toEqual([]);
}

async function buka(page: Page, alamat = "/simulasi") {
  await page.goto(alamat);
  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();
  // Tunggu hidrasi: geseran harus menanggapi.
  await expect(async () => {
    const awal = await page.getByTestId("pagu-besar").innerText();
    await sliderPagu(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("pagu-besar")).not.toHaveText(awal, { timeout: 1000 });
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("pagu-besar")).toHaveText(awal, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

for (const lebar of LEBAR) {
  test(`axe: keadaan resmi, pagu berubah, bobot berubah, tabel dan penjelasan terbuka @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksTamu(browser, lebar);
    const konsol = pantauKonsol(page);
    await buka(page);
    await periksa(page, `resmi @${lebar}`);

    await sliderPagu(page).fill(String(505 * JT));
    await expect(page.getByText("5 dari 7 usulan terbiayai").first()).toBeVisible();
    await periksa(page, `pagu 505 @${lebar}`);

    await page.getByRole("button", { name: "Dukungan saja" }).click();
    await expect(page.getByText("Dengan bobot Anda, pada pagu ini")).toBeVisible();
    await periksa(page, `bobot 100/0/0 @${lebar}`);

    await page.getByText("Kenapa ruasnya bisa terputus?").click();
    await page.getByText("Lihat sebagai tabel").click();
    await expect(page.getByRole("table", { name: "Pagu yang membuat tiap usulan terbiayai, dari yang paling cepat" })).toBeVisible();
    await periksa(page, `penjelasan dan tabel peta terbuka @${lebar}`);

    expect(konsol()).toEqual([]);
    await konteks.close();
  });

  test(`axe: pagu diketik salah (galat), usulan forum andaian, dan catatan alamat @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksTamu(browser, lebar);
    const konsol = pantauKonsol(page);
    await buka(page);

    await page.getByLabel("Atau ketik pagu").fill("abc");
    await page.getByRole("button", { name: "Pakai" }).click();
    await expect(page.getByText("Tulis pagu dalam angka")).toBeVisible();
    await periksa(page, `galat ketik pagu @${lebar}`);
    await page.getByLabel("Atau ketik pagu").fill("Rp 350 jt");
    await page.getByRole("button", { name: "Pakai" }).click();
    await expect(page.getByTestId("pagu-besar")).toHaveText("Rp 350 juta");

    await page.getByRole("button", { name: "Tambahkan ke simulasi" }).click();
    await expect(page.getByText("Pilih satu usulan dulu.")).toBeVisible();
    await periksa(page, `galat tambah usulan @${lebar}`);

    await page.getByLabel("Usulan dari forum", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("radio", { name: "7", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Tambahkan ke simulasi" }).click();
    await expect(page.getByRole("list", { name: "Usulan forum yang ditambahkan ke simulasi" }).getByRole("listitem")).toHaveCount(1);
    await periksa(page, `usulan andaian ditambahkan @${lebar}`);

    const idVoting = await idUsulanForum(page, "Talud penahan longsor tebing RW 07");
    await page.goto(`/simulasi?tambah=${idVoting}.5`);
    await expect(page.getByText("tidak bisa ditambahkan lagi")).toBeVisible({ timeout: 20_000 });
    await periksa(page, `catatan alamat @${lebar}`);

    expect(konsol()).toEqual([]);
    await konteks.close();
  });
}

test("keyboard: geseran pagu dan bobot, preset, dan tombol bisa dioperasikan penuh; fokus terlihat dan tidak tertutup bilah bawah", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  await buka(page);

  const slider = sliderPagu(page);
  await slider.focus();
  await expect(slider).toBeFocused();
  const cincin = await slider.evaluate((el) => {
    const s = getComputedStyle(el);
    return { gaya: s.outlineStyle, lebar: parseFloat(s.outlineWidth) };
  });
  expect(cincin.gaya).not.toBe("none");
  expect(cincin.lebar).toBeGreaterThanOrEqual(2);

  const nilai = async () => Number(await slider.inputValue());
  const awal = await nilai();
  await page.keyboard.press("ArrowRight");
  expect(await nilai()).toBe(awal + 5 * JT);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  expect(await nilai()).toBe(10 * JT);
  await page.keyboard.press("End");
  expect(await nilai()).toBe(800 * JT);
  await expect(page.getByText("Semua usulan terbiayai, sisa Rp 5 juta.").first()).toBeVisible();

  // Preset dengan Enter dan Spasi.
  const preset = page.getByRole("button", { name: "Merata dulu" });
  await preset.focus();
  await page.keyboard.press("Enter");
  await expect(preset).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Resmi", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Resmi", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Bilah ringkasan di dasar layar tidak menutupi elemen yang menerima fokus (WCAG 2.4.11): fokus digulirkan ke atasnya.
  const pilih = page.getByLabel("Usulan dari forum", { exact: true });
  await pilih.focus();
  const kotak = await pilih.boundingBox();
  const tinggiLayar = page.viewportSize()!.height;
  const bilah = await page.getByText(/· \d+ terbiayai · sisa/).boundingBox();
  expect(kotak && bilah).toBeTruthy();
  expect(kotak!.y + kotak!.height, "kolom terfokus tidak boleh berada di bawah tepi atas bilah").toBeLessThanOrEqual(bilah!.y + 1);
  expect(bilah!.y + bilah!.height).toBeLessThanOrEqual(tinggiLayar + 1);
  await konteks.close();
});

test("S-09: menggeser pagu berkali-kali menghasilkan paling banyak satu pengumuman per jeda", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  await buka(page);

  await page.evaluate(() => {
    const w = window as unknown as { __pengumuman: string[] };
    w.__pengumuman = [];
    const catat = (el: Element) => {
      const teks = (el.textContent ?? "").trim();
      if (teks) w.__pengumuman.push(teks);
    };
    for (const el of document.querySelectorAll('[role="status"]')) {
      new MutationObserver(() => catat(el)).observe(el, { childList: true, characterData: true, subtree: true });
    }
  });

  // Dua puluh langkah dalam waktu singkat, lalu jeda: pembaca layar tidak boleh dibanjiri.
  await sliderPagu(page).focus();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(2500);
  const diumumkan = await page.evaluate(() => (window as unknown as { __pengumuman: string[] }).__pengumuman);
  expect(diumumkan.length, `pengumuman: ${JSON.stringify(diumumkan)}`).toBeLessThanOrEqual(1);
  await konteks.close();
});

test("S-10: setiap baris Peta Pagu punya kalimat, ada tabel setara, dan petanya sendiri disembunyikan dari pembaca layar", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 1440);
  await buka(page);
  const peta = page.getByRole("list", { name: "Pagu yang dibutuhkan tiap usulan, dari yang paling cepat terbiayai" });
  const baris = peta.getByRole("listitem");
  await expect(baris).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    // Tiap baris: nama, status berteks (bukan hanya warna), dan satu kalimat lengkap yang berisi angka rupiah.
    await expect(baris.nth(i)).toContainText(/Terbiayai|Ditunda|Tidak terpilih/);
    await expect(baris.nth(i)).toContainText(/Rp\s\d+/);
    await expect(baris.nth(i).locator('[aria-hidden="true"]').first()).toBeAttached();
  }
  await page.getByText("Lihat sebagai tabel").click();
  const tabel = page.getByRole("table", { name: "Pagu yang membuat tiap usulan terbiayai, dari yang paling cepat" });
  await expect(tabel.getByRole("rowheader")).toHaveCount(7);
  await expect(tabel.getByRole("columnheader")).toHaveText(["Usulan", "Biaya", "Terbiayai pada pagu", "Pada pagu Anda"]);
  await expect(tabel.getByRole("row", { name: /Gapura RW 01/ })).toContainText("Rp 465–500 juta, dari Rp 685 juta");
  await konteks.close();
});

test("reflow: tanpa gulir horizontal di 320 px (setara zoom 400%), juga dengan usulan andaian dan tabel terbuka", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 320);
  await buka(page);
  await page.getByText("Lihat sebagai tabel").click();
  await page.getByText("Kenapa ruasnya bisa terputus?").click();
  await sliderPagu(page).fill(String(800 * JT));
  await page.getByLabel("Usulan dari forum", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Tambahkan ke simulasi" }).click();
  await page.waitForTimeout(500);
  const lebar = await page.evaluate(() => ({ isi: document.documentElement.scrollWidth, layar: document.documentElement.clientWidth }));
  expect(lebar.isi, "gulir horizontal di /simulasi").toBeLessThanOrEqual(lebar.layar);
  await konteks.close();
});

for (const lebar of LEBAR) {
  test(`spasi teks WCAG 1.4.12: tanpa konten terpotong dan tanpa gulir horizontal @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksTamu(browser, lebar);
    await buka(page);
    await page.getByText("Lihat sebagai tabel").click();
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
                p { margin-bottom: 2em !important; }`,
    });
    await page.waitForTimeout(300);
    const hasil = await page.evaluate(() => {
      const tepat = { isi: document.documentElement.scrollWidth, layar: document.documentElement.clientWidth };
      const terpotong: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("main *")) {
        // Batang Garis Pagu sengaja memotong nama blok kecil (komponen yang sama dengan beranda); isinya tersedia di daftar.
        if (el.closest('[aria-label^="Pembagian pagu"]')) continue;
        // Yang memang disembunyikan secara visual (sr-only, kepala tabel di layar sempit) bukan konten yang terpotong.
        if (el.clientWidth <= 1 && el.clientHeight <= 1) continue;
        const s = getComputedStyle(el);
        if (!/(hidden|clip)/.test(`${s.overflowX} ${s.overflowY}`)) continue;
        if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
          terpotong.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`);
        }
      }
      return { tepat, terpotong };
    });
    expect(hasil.tepat.isi, "gulir horizontal").toBeLessThanOrEqual(hasil.tepat.layar);
    expect(hasil.terpotong, "elemen dengan isi terpotong").toEqual([]);
    await konteks.close();
  });
}

test("target sentuh: semua kontrol mandiri minimal 44 x 44 px di 360 px", async ({ browser }) => {
  const { konteks, page } = await konteksTamu(browser, 360);
  await buka(page);
  await page.getByText("Lihat sebagai tabel").click();
  const kecil = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main a[href], main button, main select, main input:not([type=hidden]), main summary, main textarea")]
      .filter((el) => el.offsetParent !== null && !el.classList.contains("sr-only"))
      // Tautan di tengah kalimat dikecualikan oleh WCAG 2.5.8; yang dicek: kontrol mandiri.
      .filter((el) => getComputedStyle(el).display !== "inline")
      .map((el) => ({ nama: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40) || el.tagName, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
      .filter((e) => e.h < 43.5 || e.w < 43.5),
  );
  expect(kecil, "kontrol kurang dari 44 px di /simulasi").toEqual([]);
  await konteks.close();
});
