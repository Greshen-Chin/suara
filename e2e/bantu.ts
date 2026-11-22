import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const AKUN = {
  warga: { nama: "warga", sandi: "warga123" },
  admin: { nama: "admin", sandi: "admin123" },
} as const;

/** Mengumpulkan galat konsol dan galat halaman. Konsol harus bersih di akhir tiap tes. */
export function pantauKonsol(page: Page): () => string[] {
  const galat: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") galat.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => galat.push(`pageerror: ${e.message}`));
  return () => galat;
}

export async function masuk(page: Page, peran: keyof typeof AKUN, lanjut?: string) {
  await page.goto(lanjut ? `/masuk?lanjut=${encodeURIComponent(lanjut)}` : "/masuk");
  await page.getByLabel("Nama pengguna").fill(AKUN[peran].nama);
  await page.getByLabel("Kata sandi", { exact: true }).fill(AKUN[peran].sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
}

export async function konteksSebagai(browser: Browser, peran: keyof typeof AKUN, lebar = 360): Promise<{ konteks: BrowserContext; page: Page }> {
  const konteks = await browser.newContext({ viewport: { width: lebar, height: 800 }, locale: "id-ID", timezoneId: "Asia/Jakarta", baseURL: "http://localhost:3100" });
  const page = await konteks.newPage();
  await masuk(page, peran);
  return { konteks, page };
}

export async function resetDatabase() {
  const r = await fetch("http://localhost:54321/__uji/reset", { method: "POST" });
  expect(r.ok).toBeTruthy();
}

export async function mundurkanWaktu() {
  const r = await fetch("http://localhost:54321/__uji/mundur", { method: "POST" });
  expect(r.ok).toBeTruthy();
}

/** Baris usulan di daftar forum menurut judulnya. */
export const barisUsulan = (page: Page, judul: string | RegExp) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: judul, level: 2 }) });

/** Konteks pengunjung tanpa masuk, dengan locale dan zona waktu yang sama dengan konfigurasi. */
export async function konteksTamu(browser: Browser, lebar = 360, tinggi = 900): Promise<{ konteks: BrowserContext; page: Page }> {
  const konteks = await browser.newContext({ viewport: { width: lebar, height: tinggi }, locale: "id-ID", timezoneId: "Asia/Jakarta", baseURL: "http://localhost:3100" });
  return { konteks, page: await konteks.newPage() };
}

/** Id usulan dari tautan di daftar forum (mis. untuk membuka /simulasi?tambah=<id>.5). */
export async function idUsulanForum(page: Page, judul: string): Promise<string> {
  await page.goto("/forum");
  const href = await page.getByRole("link", { name: judul, exact: true }).first().getAttribute("href");
  return href!.replace("/forum/", "");
}

/** Slider pagu pada halaman simulasi. */
export const sliderPagu = (page: Page) => page.getByLabel("Pagu simulasi", { exact: true });

/** Spasi tak terputus (rupiah, dan bentuk &nbsp; pada HTML hasil serialisasi) dibuat biasa supaya teks mudah dibandingkan. */
export const biasa = (teks: string | null): string => (teks ?? "").replaceAll(" ", " ").replaceAll("&nbsp;", " ");

/**
 * Reset database, lalu segarkan cache "use cache" Next: sesudah reset, cache masih memegang data dan id sebelumnya
 * (sampai 60 detik). Warga mendukung lalu membatalkan dukungan pada usulan forum: Server Action-nya memanggil
 * updateTag, dan keadaan database kembali persis sama. Dipakai berkas yang membaca halaman publik berbasis cache.
 */
export async function resetDanSegarkan(browser: Browser) {
  await resetDatabase();
  await segarkanCache(browser);
}

/** Tiga usulan forum tambahan di server tiruan (untuk 16 usulan pada simulasi), lalu segarkan cache. */
export async function tambahUsulanUji(browser: Browser) {
  const r = await fetch("http://localhost:54321/__uji/usulan-tambahan", { method: "POST" });
  expect(r.ok).toBeTruthy();
  await segarkanCache(browser);
}

export async function hapusUsulanUji(browser: Browser) {
  const r = await fetch("http://localhost:54321/__uji/usulan-tambahan", { method: "DELETE" });
  expect(r.ok).toBeTruthy();
  await segarkanCache(browser);
}

/** Warga mendukung lalu membatalkan: Server Action memanggil updateTag, database kembali sama. */
export async function segarkanCache(browser: Browser) {
  const { konteks, page } = await konteksSebagai(browser, "warga", 360);
  await page.goto("/forum");
  const tombol = page.getByRole("button", { name: /dukung usulan Lampu jalan gang/i });
  await tombol.click();
  await expect(page.getByRole("status").filter({ hasText: "Dukungan ditambahkan" })).toBeAttached();
  await tombol.click();
  await expect(page.getByRole("status").filter({ hasText: "Dukungan dibatalkan" })).toBeAttached();
  await konteks.close();
}
