import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungTataPagu, titikSkala } from "./pagu.ts";

const PAGU = 300_000_000;
const BATAS = 1e-9;

describe("hitungTataPagu", () => {
  it("lebar blok terpilih + sisa tepat 100%", () => {
    const set = [
      { id: "a", biaya: 85_000_000 },
      { id: "b", biaya: 90_000_000 },
      { id: "c", biaya: 70_000_000 },
      { id: "d", biaya: 40_000_000 },
    ];
    const { blok, sisa } = hitungTataPagu(set, PAGU);
    const jumlah = blok.reduce((n, b) => n + b.lebar, 0) + sisa.lebar;
    assert.ok(Math.abs(jumlah - 100) < BATAS, `jumlah lebar = ${jumlah}`);
    assert.equal(sisa.rupiah, 15_000_000);
  });

  it("lebar blok persis sebanding dengan biayanya", () => {
    const { blok } = hitungTataPagu(
      [
        { id: "kecil", biaya: 40_000_000 },
        { id: "besar", biaya: 180_000_000 },
      ],
      PAGU,
    );
    assert.ok(Math.abs(blok[0].lebar - (40 / 300) * 100) < BATAS);
    assert.ok(Math.abs(blok[1].lebar - (180 / 300) * 100) < BATAS);
    assert.ok(Math.abs(blok[1].lebar / blok[0].lebar - 4.5) < BATAS);
  });

  it("blok tersusun berurutan tanpa celah", () => {
    const { blok, sisa } = hitungTataPagu(
      [
        { id: "a", biaya: 100_000_000 },
        { id: "b", biaya: 50_000_000 },
      ],
      PAGU,
    );
    assert.equal(blok[0].mulai, 0);
    assert.ok(Math.abs(blok[1].mulai - (blok[0].mulai + blok[0].lebar)) < BATAS);
    assert.ok(Math.abs(sisa.mulai - (blok[1].mulai + blok[1].lebar)) < BATAS);
  });

  it("pagu terpakai penuh menyisakan lebar 0", () => {
    const { sisa } = hitungTataPagu([{ id: "a", biaya: PAGU }], PAGU);
    assert.equal(sisa.rupiah, 0);
    assert.ok(Math.abs(sisa.lebar) < BATAS);
  });

  it("tanpa usulan terpilih, seluruh batang adalah sisa", () => {
    const { blok, sisa } = hitungTataPagu([], PAGU);
    assert.equal(blok.length, 0);
    assert.equal(sisa.lebar, 100);
  });

  it("menolak total biaya yang melebihi pagu", () => {
    assert.throws(
      () => hitungTataPagu([{ id: "a", biaya: PAGU + 1 }], PAGU),
      RangeError,
    );
  });

  it("menolak pagu nol atau negatif", () => {
    assert.throws(() => hitungTataPagu([], 0), RangeError);
    assert.throws(() => hitungTataPagu([], -1), RangeError);
  });
});

describe("titikSkala", () => {
  it("membagi pagu rata dari Rp 0 sampai pagu", () => {
    assert.deepEqual(titikSkala(PAGU), [
      { rupiah: 0, posisi: 0 },
      { rupiah: 100_000_000, posisi: (1 / 3) * 100 },
      { rupiah: 200_000_000, posisi: (2 / 3) * 100 },
      { rupiah: 300_000_000, posisi: 100 },
    ]);
  });
});
