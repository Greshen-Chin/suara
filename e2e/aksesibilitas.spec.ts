// Audit aksesibilitas otomatis (axe-core, WCAG 2.0/2.1/2.2 A dan AA) pada halaman forum, untuk
// pengunjung, warga, dan admin, di 360 px dan 1440 px, termasuk keadaan dialog terbuka, galat
// validasi, dan setiap langkah formulir. Ditambah pemeriksaan keyboard dan target sentuh.
// axe tidak menggantikan uji manual dengan pembaca layar; lihat catatan di docs/forum.md.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { konteksSebagai, pantauKonsol, resetDanSegarkan } from "./bantu.ts";

test.describe.configure({ mode: "serial" });
// Segarkan juga cache publik: tanpa itu daftar forum masih memuat id dari database sebelum reset, dan halaman detailnya "tidak ditemukan".
test.beforeAll(async ({ browser }) => resetDanSegarkan(browser));

const LEBAR = [360, 1440] as const;
const TAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function periksa(page: Page, nama: string) {
  // Kursor dipindah dan transisi warna (0,15 dtk) ditunggu selesai: yang diukur keadaan diam,
  // bukan warna di tengah transisi hover pada tombol yang baru saja diklik.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const hasil = await new AxeBuilder({ page })
    .withTags(TAG)
    .exclude("nextjs-portal") // lencana alat pengembang Next.js, bukan bagian aplikasi
    .analyze();
  const ringkas = hasil.violations.map((v) => `${v.id} [${v.impact}] ${v.nodes.length}x: ${v.nodes[0]?.target.join(" ")} | ${v.help}`);
  expect(ringkas, `pelanggaran axe di ${nama}`).toEqual([]);
  return hasil.passes.length;
}

async function idUsulan(page: Page, judul: string): Promise<string> {
  await page.goto("/forum");
  const href = await page.getByRole("link", { name: judul, exact: true }).first().getAttribute("href");
  return href!.replace("/forum/", "");
}

async function konteks(browser: Browser, peran: "tamu" | "warga" | "admin", lebar: number) {
  if (peran === "tamu") {
    const k = await browser.newContext({ viewport: { width: lebar, height: 900 } });
    return { konteks: k, page: await k.newPage() };
  }
  return konteksSebagai(browser, peran, lebar);
}

for (const lebar of LEBAR) {
  for (const peran of ["tamu", "warga", "admin"] as const) {
    test(`axe: daftar, detail, beranda sebagai ${peran} @${lebar}`, async ({ browser }) => {
      const { konteks: k, page } = await konteks(browser, peran, lebar);
      const konsol = pantauKonsol(page);

      await page.goto("/forum");
      await expect(page.getByRole("heading", { name: "Forum warga", level: 1 })).toBeVisible();
      await periksa(page, `/forum ${peran} ${lebar}`);

      await page.goto("/forum?status=voting&rw=7&urut=per-seribu");
      await periksa(page, `/forum (filter) ${peran} ${lebar}`);

      await page.goto("/forum?rw=3&kategori=sosial");
      await expect(page.getByRole("heading", { name: "Tidak ada usulan yang cocok" })).toBeVisible();
      await periksa(page, `/forum (kosong) ${peran} ${lebar}`);

      for (const judul of ["Talud penahan longsor tebing RW 07", "Lampu jalan gang RW 07 gelap", "Tong sampah terpilah di pasar RW 03"]) {
        const id = await idUsulan(page, judul);
        await page.goto(`/forum/${id}`);
        await expect(page.getByRole("heading", { name: judul, level: 1 })).toBeVisible();
        await periksa(page, `/forum/[id] ${judul} ${peran} ${lebar}`);
      }

      await page.goto("/forum/00000000-0000-4000-8000-000000000000");
      await expect(page.getByRole("heading", { name: "Usulan tidak ditemukan" })).toBeVisible();
      await periksa(page, `404 ${peran} ${lebar}`);

      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await periksa(page, `/ ${peran} ${lebar}`);

      expect(konsol()).toEqual([]);
      await k.close();
    });
  }

  test(`axe: formulir usulan, semua langkah dan galat @${lebar}`, async ({ browser }) => {
    const { konteks: k, page } = await konteksSebagai(browser, "warga", lebar);
    const konsol = pantauKonsol(page);

    await page.goto("/forum/usul");
    await expect(page.getByLabel("Judul usulan")).toBeVisible();
    await periksa(page, `/forum/usul isi ${lebar}`);

    await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
    await expect(page.getByText("Tulis judul usulan.")).toBeVisible();
    await periksa(page, `/forum/usul galat ${lebar}`);

    await page.getByLabel("Judul usulan").fill("Lampu di lorong RW 07 tidak menyala");
    await page.getByLabel("Ceritakan usulan Anda").fill("Lorong dekat musala tidak ada penerangan, warga takut lewat malam hari dan anak-anak sering jatuh.");
    await page.getByLabel("Kategori").selectOption("infrastruktur");
    await page.getByLabel("Perkiraan biaya").fill("Rp 20 jt");
    await page.getByRole("button", { name: "Periksa usulan serupa" }).click();
    await expect(page.getByRole("heading", { name: /usulan yang mirip/ })).toBeVisible({ timeout: 30_000 });
    await periksa(page, `/forum/usul periksa ${lebar}`);

    await page.getByRole("button", { name: "Tetap ajukan usulan saya" }).click();
    await expect(page.getByRole("heading", { name: "Tinjau usulan Anda" })).toBeVisible();
    await periksa(page, `/forum/usul tinjau ${lebar}`);
    await page.evaluate(() => sessionStorage.clear());

    expect(konsol()).toEqual([]);
    await k.close();
  });

  test(`axe: dialog moderasi terbuka (admin) @${lebar}`, async ({ browser }) => {
    const { konteks: k, page } = await konteksSebagai(browser, "admin", lebar);
    const konsol = pantauKonsol(page);
    const id = await idUsulan(page, "Atap pos ronda RW 01 bocor saat hujan");
    await page.goto(`/forum/${id}`);

    await page.getByRole("button", { name: /Sembunyikan \(komentar dari/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await periksa(page, `dialog komentar ${lebar}`);

    await page.getByRole("dialog").getByLabel("Alasan").fill("pendek");
    await page.getByRole("dialog").getByRole("button", { name: "Sembunyikan", exact: true }).click();
    await expect(page.getByRole("dialog").getByText(/minimal 10 karakter/)).toBeVisible();
    await periksa(page, `dialog galat ${lebar}`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Sembunyikan usulan/ }).click();
    await expect(page.getByRole("dialog", { name: "Sembunyikan usulan ini?" })).toBeVisible();
    await periksa(page, `dialog usulan ${lebar}`);

    expect(konsol()).toEqual([]);
    await k.close();
  });
}

test("reflow: tanpa gulir horizontal di 320 px (setara zoom 400%)", async ({ browser }) => {
  const { konteks: k, page } = await konteksSebagai(browser, "warga", 320);
  const id = await idUsulan(page, "Lampu jalan gang RW 07 gelap");
  for (const alamat of ["/forum", `/forum/${id}`, "/forum/usul", "/forum?status=voting"]) {
    await page.goto(alamat);
    await page.waitForLoadState("networkidle");
    const lebar = await page.evaluate(() => ({ isi: document.documentElement.scrollWidth, layar: document.documentElement.clientWidth }));
    expect(lebar.isi, `gulir horizontal di ${alamat}`).toBeLessThanOrEqual(lebar.layar);
  }
  await k.close();
});

test("keyboard: tombol dukung bisa dioperasikan penuh dengan keyboard, fokus terlihat", async ({ browser }) => {
  const { konteks: k, page } = await konteksSebagai(browser, "warga", 1440);
  await page.goto("/forum");
  const tombol = page.getByRole("button", { name: /dukung usulan Lampu jalan gang/i });
  await tombol.focus();
  await expect(tombol).toBeFocused();
  // Cincin fokus terlihat: outline 3px yang bukan "none".
  const outline = await tombol.evaluate((el) => {
    const s = getComputedStyle(el);
    return { gaya: s.outlineStyle, lebar: parseFloat(s.outlineWidth) };
  });
  expect(outline.gaya).not.toBe("none");
  expect(outline.lebar).toBeGreaterThanOrEqual(2);

  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Dukungan ditambahkan" })).toBeAttached();
  await expect(tombol).toBeFocused(); // fokus tidak lepas setelah aksi (aria-disabled, bukan disabled)
  await page.keyboard.press("Space");
  await expect(page.getByRole("status").filter({ hasText: "Dukungan dibatalkan" })).toBeAttached();
  await k.close();
});

test("target sentuh: semua kontrol interaktif minimal 44 x 44 px di 360 px", async ({ browser }) => {
  const { konteks: k, page } = await konteksSebagai(browser, "warga", 360);
  for (const alamat of ["/forum", "/forum/usul"]) {
    await page.goto(alamat);
    await page.waitForLoadState("networkidle");
    const kecil = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a[href], button, select, input:not([type=hidden]), textarea")]
        .filter((el) => el.offsetParent !== null && !el.closest("nextjs-portal"))
        .filter((el) => !el.classList.contains("sr-only") && !el.closest(".lompat"))
        // Tautan di tengah kalimat dikecualikan oleh WCAG 2.5.8; yang dicek: kontrol mandiri.
        .filter((el) => getComputedStyle(el).display !== "inline")
        .map((el) => ({ nama: (el.textContent ?? "").trim().slice(0, 40) || el.tagName, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
        .filter((e) => e.h < 43.5 || e.w < 43.5),
    );
    expect(kecil, `kontrol kurang dari 44 px di ${alamat}`).toEqual([]);
  }
  await k.close();
});
