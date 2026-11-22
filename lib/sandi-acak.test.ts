import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periksaKataSandiBaru } from "./kata-sandi.ts";
import { ANGKA_SANDI, buatSandiAcak, HURUF_SANDI } from "./sandi-acak.ts";

const MIRIP = /[l1io0]/;

describe("buatSandiAcak", () => {
  it("tiga kelompok empat karakter dipisah tanda hubung", () => {
    for (let i = 0; i < 200; i++) assert.match(buatSandiAcak(), /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  });

  it("tanpa karakter yang mudah tertukar: l, 1, i, o, 0", () => {
    for (let i = 0; i < 500; i++) assert.doesNotMatch(buatSandiAcak(), MIRIP);
    assert.doesNotMatch(HURUF_SANDI + ANGKA_SANDI, MIRIP);
  });

  it("selalu memuat huruf dan angka", () => {
    for (let i = 0; i < 500; i++) {
      const bahan = buatSandiAcak().replaceAll("-", "");
      assert.match(bahan, /[a-z]/);
      assert.match(bahan, /[2-9]/);
    }
  });

  it("lolos aturan kata sandi baru, termasuk tidak memuat nama pengguna", () => {
    for (let i = 0; i < 200; i++) {
      const sandi = buatSandiAcak("agus.santoso");
      assert.equal(periksaKataSandiBaru(sandi, "agus.santoso"), null);
    }
  });

  it("mengundi ulang bila hasilnya memuat nama pengguna", () => {
    // Pengundi palsu: undian pertama menghasilkan "aaaa-aaaa-aaaa" (memuat nama "aaa"), lalu bergeser.
    let n = 0;
    const acak = () => (n++ < 12 ? 0 : (n % 20) + 8);
    const sandi = buatSandiAcak("aaa", acak);
    assert.doesNotMatch(sandi, /aaa/);
  });

  it("menolak undian tanpa angka: dicoba ulang sampai ada huruf dan angka", () => {
    let n = 0;
    // 12 undian pertama menunjuk huruf semua (indeks 0), berikutnya campuran.
    const acak = (_min: number, maks: number) => (n++ < 12 ? 0 : (n * 7) % maks);
    const bahan = buatSandiAcak("", acak).replaceAll("-", "");
    assert.match(bahan, /[2-9]/);
  });

  it("dua kata sandi berturut-turut hampir pasti berbeda (tidak ditulis tetap)", () => {
    const set = new Set(Array.from({ length: 50 }, () => buatSandiAcak()));
    assert.equal(set.size, 50);
  });

  it("gagal dengan jelas bila pengundi rusak (bukan berputar selamanya)", () => {
    assert.throws(() => buatSandiAcak("", () => 0), /Tidak bisa membuat kata sandi/);
  });
});
