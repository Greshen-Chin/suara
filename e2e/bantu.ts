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
