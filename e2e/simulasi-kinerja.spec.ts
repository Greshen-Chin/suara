// S-12: kinerja /simulasi dengan 16 usulan (batas pencarian kombinasi) dan CPU diperlambat 4x.
//
// Yang diukur: tugas utas utama tunggal paling lama (Long Tasks API: melaporkan semua tugas lebih dari 50 ms) selama
//   (a) menggeser pagu berkali-kali (hitungan utama: pilihOptimal + banding, Peta Pagu tidak dihitung ulang),
//   (b) memindahkan bobot (Peta Pagu dihitung ulang: 65.536 kombinasi diurutkan), dan
//   (c) menunggu uji ketahanan (231 kombinasi bobot) selesai: dipotong per giliran, tidak boleh memblokir.
// Batasnya 100 ms. Angkanya ditulis ke e2e/.hasil/kinerja-simulasi.json dan dilaporkan di docs/simulasi.md.
//
// Server tiruan diberi tiga usulan forum tambahan (7 voting + 9 forum = 16) dan dibersihkan lagi sesudahnya.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { hapusUsulanUji, konteksTamu, resetDanSegarkan, sliderPagu, tambahUsulanUji } from "./bantu.ts";

test.describe.configure({ mode: "serial" });

const JT = 1_000_000;
const BATAS_MS = 100;
const ID_FORUM = [
  ...[1, 2, 3, 4, 5, 6].map((n) => `6f1b3d0a-1001-4c8e-9a10-00000000000${n}`),
  ...[1, 2, 3].map((n) => `6f1b3d0a-1001-4c8e-9a10-00000000009${n}`),
];

test.beforeAll(async ({ browser }) => {
  await resetDanSegarkan(browser);
  await tambahUsulanUji(browser);
});
test.afterAll(async ({ browser }) => {
  await hapusUsulanUji(browser);
});

async function ukur(throttle: number, lebar: number, browser: import("@playwright/test").Browser) {
  const { konteks, page } = await konteksTamu(browser, lebar, 900);
  const cdp = await konteks.newCDPSession(page);
  await page.goto(`/simulasi?${ID_FORUM.map((id) => `tambah=${id}.5`).join("&")}`);
  await expect(page.getByRole("heading", { name: "Simulasi anggaran", level: 1 })).toBeVisible();

  // Menunggu hidrasi dan 16 usulan terhitung (7 voting + 9 forum andaian).
  const peta = page.getByRole("list", { name: "Pagu yang dibutuhkan tiap usulan, dari yang paling cepat terbiayai" });
  await expect(peta.getByRole("listitem")).toHaveCount(16, { timeout: 30_000 });
  await expect(async () => {
    await sliderPagu(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("pagu-besar")).not.toHaveText("Rp 300 juta", { timeout: 1000 });
    await page.keyboard.press("ArrowLeft");
  }).toPass({ timeout: 30_000 });
  await page.waitForTimeout(1500);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.evaluate(() => {
    const w = window as unknown as { __tugas: number[]; __amati?: PerformanceObserver };
    w.__tugas = [];
    w.__amati = new PerformanceObserver((daftar) => {
      for (const e of daftar.getEntries()) w.__tugas.push(e.duration);
    });
    w.__amati.observe({ type: "longtask" });
  });
  const tugas = async () => (await page.evaluate(() => (window as unknown as { __tugas: number[] }).__tugas)).slice();

  // (a) Menggeser pagu: 60 langkah berturut-turut dengan keyboard.
  await sliderPagu(page).focus();
  await sliderPagu(page).fill(String(300 * JT));
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(500);
  const tugasPagu = await tugas();

  // (b) Memindahkan bobot: Peta Pagu dihitung ulang tiap kali (preset bolak-balik, lalu geseran bobot).
  const sebelumBobot = tugasPagu.length;
  for (const nama of ["Dukungan saja", "Keselamatan dulu", "Merata dulu", "Resmi"]) {
    await page.getByRole("button", { name: nama, exact: true }).click();
    await page.waitForTimeout(250);
  }
  await page.getByLabel("Popularitas", { exact: true }).focus();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(500);
  const tugasBobot = (await tugas()).slice(sebelumBobot);

  // (c) Uji ketahanan: berhenti menggeser, lalu tunggu kalimatnya sesuai pagu terakhir. Diukur sejak berhenti.
  const sebelumKetahanan = (await tugas()).length;
  const paguAkhir = Number(await sliderPagu(page).inputValue()) / JT;
  const mulai = Date.now();
  await expect(page.getByText(`Pada pagu Rp ${paguAkhir} juta,`)).toBeVisible({ timeout: 60_000 });
  const lamaKetahananMs = Date.now() - mulai;
  const tugasKetahanan = (await tugas()).slice(sebelumKetahanan);

  const semua = [...tugasPagu, ...tugasBobot, ...tugasKetahanan];
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await konteks.close();
  const maks = (a: number[]) => (a.length === 0 ? 0 : Math.round(Math.max(...a)));
  return {
    cpuDiperlambat: throttle,
    lebar,
    usulan: 16,
    tugasTerpanjangMs: { menggeserPagu: maks(tugasPagu), memindahBobot: maks(tugasBobot), ujiKetahanan: maks(tugasKetahanan), semua: maks(semua) },
    jumlahTugasLebihDari50Ms: { menggeserPagu: tugasPagu.length, memindahBobot: tugasBobot.length, ujiKetahanan: tugasKetahanan.length },
    ujiKetahananSelesaiSetelahBerhentiMs: lamaKetahananMs,
  };
}

test("16 usulan, CPU 4x lebih lambat: tidak ada tugas utas utama lebih dari 100 ms saat menggeser pagu dan bobot", async ({ browser }) => {
  test.setTimeout(240_000);
  const hasil = [await ukur(1, 1440, browser), await ukur(4, 360, browser), await ukur(4, 1440, browser)];
  mkdirSync("e2e/.hasil", { recursive: true });
  writeFileSync("e2e/.hasil/kinerja-simulasi.json", JSON.stringify({ batasMs: BATAS_MS, diukurPada: new Date().toISOString(), hasil }, null, 2));
  console.log(JSON.stringify(hasil, null, 1));
  for (const h of hasil) {
    expect(h.tugasTerpanjangMs.semua, `CPU ${h.cpuDiperlambat}x @${h.lebar}: tugas terpanjang`).toBeLessThanOrEqual(BATAS_MS);
  }
});
