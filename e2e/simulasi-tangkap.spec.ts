// Tangkapan layar /simulasi untuk tinjauan visual (360, 768, 1440 px). Hasil di e2e/.hasil/layar/simulasi-*.png.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { konteksTamu, sliderPagu } from "./bantu.ts";

const LEBAR = [360, 768, 1440] as const;
const DIR = "e2e/.hasil/layar";
const JT = 1_000_000;
mkdirSync(DIR, { recursive: true });

test.describe.configure({ mode: "serial" });

async function buka(page: Page, alamat = "/simulasi") {
  await page.goto(alamat);
  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();
  await expect(async () => {
    const awal = await page.getByTestId("pagu-besar").innerText();
    await sliderPagu(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("pagu-besar")).not.toHaveText(awal, { timeout: 1000 });
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("pagu-besar")).toHaveText(awal, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await page.mouse.move(1, 1);
}

async function foto(page: Page, nama: string, lebar: number, penuh = true) {
  await page.waitForTimeout(900); // geser selesai, hitungan bertahap selesai, FLIP selesai
  await page.screenshot({ path: `${DIR}/simulasi-${nama}-${lebar}.png`, fullPage: penuh });
}

for (const lebar of LEBAR) {
  test(`pengunjung: resmi, pagu Rp 505 juta, bobot dan peta terbuka @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksTamu(browser, lebar, lebar === 1440 ? 900 : 800);
    await buka(page);
    await foto(page, "resmi", lebar);
    await page.screenshot({ path: `${DIR}/simulasi-resmi-layar-${lebar}.png`, fullPage: false });

    await sliderPagu(page).fill(String(505 * JT));
    await expect(page.getByText("5 dari 7 usulan terbiayai").first()).toBeVisible();
    await foto(page, "pagu505", lebar);
    await page.screenshot({ path: `${DIR}/simulasi-pagu505-layar-${lebar}.png`, fullPage: false });

    await page.getByRole("button", { name: "Dukungan saja" }).click();
    await expect(page.getByText("Dengan bobot Anda, pada pagu ini")).toBeVisible();
    await foto(page, "bobot", lebar);

    await page.getByText("Kenapa ruasnya bisa terputus?").click();
    await page.getByText("Lihat sebagai tabel").click();
    await foto(page, "peta-terbuka", lebar);
    await konteks.close();
  });

  test(`pengunjung: pagu Rp 450 juta (bobot menentukan), usulan forum andaian, pagu kecil dan besar @${lebar}`, async ({ browser }) => {
    const { konteks, page } = await konteksTamu(browser, lebar, lebar === 1440 ? 900 : 800);
    await buka(page);

    await sliderPagu(page).fill(String(450 * JT));
    await expect(page.getByText("Pada pagu Rp 450 juta, bobot menentukan")).toBeVisible({ timeout: 20_000 });
    await foto(page, "pagu450", lebar);

    // Pagu terlalu kecil dan terlalu besar, sebelum ada usulan andaian.
    await sliderPagu(page).fill(String(30 * JT));
    await expect(page.getByText("Belum ada usulan yang muat.").first()).toBeVisible();
    await foto(page, "pagu-kecil", lebar);

    await sliderPagu(page).fill(String(800 * JT));
    await expect(page.getByText("Semua usulan terbiayai").first()).toBeVisible();
    await foto(page, "pagu-besar", lebar);

    await sliderPagu(page).fill(String(450 * JT));
    await page.getByLabel("Usulan dari forum", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("radio", { name: "8", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Tambahkan ke simulasi" }).click();
    await page.getByLabel("Usulan dari forum", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("radio", { name: "6", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Tambahkan ke simulasi" }).click();
    await expect(page.getByRole("list", { name: "Usulan forum yang ditambahkan ke simulasi" }).getByRole("listitem")).toHaveCount(2);
    await foto(page, "andaian", lebar);
    await konteks.close();
  });
}
