import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lamaTunggu, tanggalDanJam, tanggalPanjang, waktuRelatif } from "./waktu.ts";

const SEKARANG = new Date("2026-11-22T12:00:00Z");
const lalu = (detik: number) => new Date(SEKARANG.getTime() - detik * 1000).toISOString();

describe("waktuRelatif", () => {
  it("di bawah semenit: baru saja", () => {
    assert.equal(waktuRelatif(lalu(0), SEKARANG), "baru saja");
    assert.equal(waktuRelatif(lalu(59), SEKARANG), "baru saja");
  });

  it("menit dan jam, membulat ke bawah", () => {
    assert.equal(waktuRelatif(lalu(60), SEKARANG), "1 menit lalu");
    assert.equal(waktuRelatif(lalu(59 * 60 + 59), SEKARANG), "59 menit lalu");
    assert.equal(waktuRelatif(lalu(3600), SEKARANG), "1 jam lalu");
    assert.equal(waktuRelatif(lalu(23 * 3600 + 3599), SEKARANG), "23 jam lalu");
  });

  it("hari: kemarin, lalu N hari", () => {
    assert.equal(waktuRelatif(lalu(86_400), SEKARANG), "kemarin");
    assert.equal(waktuRelatif(lalu(47 * 3600), SEKARANG), "kemarin");
    assert.equal(waktuRelatif(lalu(3 * 86_400), SEKARANG), "3 hari lalu");
    assert.equal(waktuRelatif(lalu(6 * 86_400 + 80_000), SEKARANG), "6 hari lalu");
  });

  it("minggu, bulan, tahun", () => {
    assert.equal(waktuRelatif(lalu(7 * 86_400), SEKARANG), "1 minggu lalu");
    assert.equal(waktuRelatif(lalu(20 * 86_400), SEKARANG), "2 minggu lalu");
    assert.equal(waktuRelatif(lalu(45 * 86_400), SEKARANG), "1 bulan lalu");
    assert.equal(waktuRelatif(lalu(400 * 86_400), SEKARANG), "1 tahun lalu");
  });

  it("waktu di masa depan (jam server berbeda sedikit) tidak menghasilkan angka negatif", () => {
    assert.equal(waktuRelatif(lalu(-30), SEKARANG), "baru saja");
  });

  it("tanggal yang rusak menghasilkan teks kosong, bukan 'NaN'", () => {
    assert.equal(waktuRelatif("bukan tanggal", SEKARANG), "");
  });
});

describe("format tanggal", () => {
  it("tanggal panjang dalam bahasa Indonesia dan zona Jakarta", () => {
    assert.equal(tanggalPanjang("2026-11-22T12:00:00Z"), "22 November 2026");
    // 18.00 UTC sudah hari berikutnya di Jakarta (WIB = UTC+7)
    assert.equal(tanggalPanjang("2026-11-22T18:00:00Z"), "23 November 2026");
  });

  it("tanggal dan jam dengan WIB", () => {
    assert.match(tanggalDanJam("2026-11-22T12:05:00Z"), /^22 November 2026.*19:05 WIB$/);
  });
});

describe("lamaTunggu", () => {
  it("detik, menit, jam, dibulatkan ke atas supaya tidak menjanjikan terlalu cepat", () => {
    assert.equal(lamaTunggu(1), "1 detik");
    assert.equal(lamaTunggu(0.2), "1 detik");
    assert.equal(lamaTunggu(20), "20 detik");
    assert.equal(lamaTunggu(61), "2 menit");
    assert.equal(lamaTunggu(3599), "1 jam");
    assert.equal(lamaTunggu(3540), "59 menit");
    assert.equal(lamaTunggu(3600), "1 jam");
    assert.equal(lamaTunggu(3601), "2 jam");
    assert.equal(lamaTunggu(23 * 3600 + 10), "24 jam");
  });
});
