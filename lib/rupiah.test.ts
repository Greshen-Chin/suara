import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRupiah } from "./rupiah.ts";

const nilai = (s: string) => {
  const h = parseRupiah(s);
  return h.ok ? h.nilai : `galat: ${h.pesan}`;
};
/** Pesan galat; gagal bila masukannya malah diterima. */
const pesan = (s: string): string => {
  const h = parseRupiah(s);
  return h.ok ? `DITERIMA ${h.nilai}` : h.pesan;
};

describe("parseRupiah: cara menulis yang harus diterima", () => {
  it("angka polos", () => {
    assert.equal(nilai("85000000"), 85_000_000);
    assert.equal(nilai("  85000000  "), 85_000_000);
  });

  it("pemisah ribuan titik atau koma", () => {
    assert.equal(nilai("85.000.000"), 85_000_000);
    assert.equal(nilai("85,000,000"), 85_000_000);
    assert.equal(nilai("1.250.000"), 1_250_000);
  });

  it("awalan Rp dengan atau tanpa spasi dan titik", () => {
    assert.equal(nilai("Rp 85.000.000"), 85_000_000);
    assert.equal(nilai("Rp85.000.000"), 85_000_000);
    assert.equal(nilai("Rp. 85.000.000"), 85_000_000);
    assert.equal(nilai("rp 85000000"), 85_000_000);
    assert.equal(nilai("IDR 85000000"), 85_000_000);
  });

  it("akhiran ,- atau ,00 atau 'rupiah'", () => {
    assert.equal(nilai("Rp 85.000.000,-"), 85_000_000);
    assert.equal(nilai("85.000.000,00"), 85_000_000);
    assert.equal(nilai("85.000.000 rupiah"), 85_000_000);
  });

  it("satuan jt, juta, miliar, ribu", () => {
    assert.equal(nilai("Rp 85 jt"), 85_000_000);
    assert.equal(nilai("85jt"), 85_000_000);
    assert.equal(nilai("85 juta"), 85_000_000);
    assert.equal(nilai("Rp 85 Juta"), 85_000_000);
    assert.equal(nilai("2 miliar"), 2_000_000_000);
    assert.equal(nilai("1 milyar"), 1_000_000_000);
    assert.equal(nilai("750 ribu"), 750_000);
    assert.equal(nilai("750rb"), 750_000);
    assert.equal(nilai("500k"), 500_000);
  });

  it("desimal dengan satuan: koma atau titik", () => {
    assert.equal(nilai("1,5 miliar"), 1_500_000_000);
    assert.equal(nilai("1.5 miliar"), 1_500_000_000);
    assert.equal(nilai("85,5 juta"), 85_500_000);
    assert.equal(nilai("2,25 jt"), 2_250_000);
  });

  it("tidak ada kesalahan pembulatan floating point", () => {
    assert.equal(nilai("0,1 juta"), 100_000);
    assert.equal(nilai("1,1 juta"), 1_100_000);
    assert.equal(nilai("4,35 juta"), 4_350_000);
  });
});

describe("parseRupiah: yang harus ditolak dengan pesan yang membantu", () => {
  it("kosong", () => {
    assert.match(pesan(""), /Isi perkiraan biaya/);
    assert.match(pesan("   "), /Isi perkiraan biaya/);
  });

  it("bukan angka", () => {
    assert.match(pesan("abc"), /Tulis biaya dalam angka/);
    assert.match(pesan("sepuluh juta"), /Tulis biaya dalam angka/);
    assert.match(pesan("85 juta 500 ribu"), /Tulis biaya dalam angka/);
  });

  it("koma desimal tanpa satuan tidak ditebak", () => {
    assert.match(pesan("85,5"), /tanpa koma desimal/);
    assert.match(pesan("1.5"), /tanpa koma desimal/);
  });

  it("nol dan negatif", () => {
    assert.match(pesan("0"), /lebih dari nol/);
    assert.match(pesan("-5000000"), /Tulis biaya dalam angka/);
  });

  it("terlalu besar", () => {
    assert.match(pesan("99999999999999"), /terlalu besar/);
  });

  it("sisipan teks aneh tidak lolos", () => {
    assert.match(pesan("85.000.000; drop table"), /Tulis biaya/);
    assert.match(pesan("<b>85</b> juta"), /Tulis biaya/);
  });
});
