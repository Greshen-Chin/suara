import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AWALAN_DRAF,
  bacaDraf,
  hapusDraf,
  kunciDraf,
  serialkanDraf,
  simpanDraf,
  temukanDraf,
  type Draf,
  type Penyimpanan,
} from "./keputusan-draf.ts";

class Simpanan implements Penyimpanan {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

/** Penyimpanan yang selalu melempar, seperti jendela pribadi atau data situs yang diblokir. */
class Rusak implements Penyimpanan {
  get length(): number {
    throw new Error("diblokir");
  }
  key(): string | null {
    throw new Error("diblokir");
  }
  getItem(): string | null {
    throw new Error("diblokir");
  }
  setItem(): void {
    throw new Error("diblokir");
  }
  removeItem(): void {
    throw new Error("diblokir");
  }
}

const ID = new Set(["a", "b", "c"]);
const draf = (ubah: Partial<Draf> = {}): Draf => ({
  isian: {
    a: { hasil: "disetujui", alasan: "", sumberDana: "" },
    b: { hasil: "dana_lain", alasan: "Alasan yang cukup panjang.", sumberDana: "Dana desa" },
  },
  tanggal: "2026-11-20",
  catatan: "Rapat di balai warga.",
  disimpan: 1000,
  ...ubah,
});

describe("bacaDraf", () => {
  test("bolak-balik: yang disimpan terbaca sama", () => {
    assert.deepEqual(bacaDraf(serialkanDraf(draf()), ID), draf());
  });
  test("teks rusak, bentuk salah, atau terlalu besar menghasilkan null tanpa melempar", () => {
    for (const buruk of [null, "", "{", "[]", "null", "5", '{"v":2,"isian":{}}', '{"v":1}', '{"v":1,"isian":[]}', "x".repeat(300_000)]) {
      assert.equal(bacaDraf(buruk, ID), null, String(buruk).slice(0, 20));
    }
  });
  test("usulan yang sudah tidak ada dibuang; hasil tidak dikenal dibaca sebagai belum dipilih", () => {
    const teks = JSON.stringify({
      v: 1,
      isian: { a: { hasil: "setuju", alasan: "tetap ada", sumberDana: "" }, hilang: { hasil: "ditolak", alasan: "x", sumberDana: "" } },
      tanggal: "",
      catatan: "",
      disimpan: 5,
    });
    const d = bacaDraf(teks, ID)!;
    assert.deepEqual(Object.keys(d.isian), ["a"]);
    assert.equal(d.isian.a.hasil, null);
    assert.equal(d.isian.a.alasan, "tetap ada");
  });
  test("baris kosong tidak disimpan; draf tanpa isi yang berarti null", () => {
    const kosong = JSON.stringify({ v: 1, isian: { a: { hasil: null, alasan: "", sumberDana: "" } }, tanggal: "", catatan: "", disimpan: 1 });
    assert.equal(bacaDraf(kosong, ID), null);
  });
  test("tanggal yang bukan YYYY-MM-DD dan teks panjang dibersihkan", () => {
    const teks = JSON.stringify({ v: 1, isian: { a: { hasil: "ditolak", alasan: "a".repeat(5000), sumberDana: 12 } }, tanggal: "kemarin", catatan: 7, disimpan: "x" });
    const d = bacaDraf(teks, ID)!;
    assert.equal(d.tanggal, "");
    assert.equal(d.catatan, "");
    assert.equal(d.isian.a.alasan.length, 2000);
    assert.equal(d.isian.a.sumberDana, "");
    assert.equal(d.disimpan, 0);
  });
  test("kunci berbahaya seperti __proto__ tidak lolos", () => {
    const teks = '{"v":1,"isian":{"__proto__":{"hasil":"ditolak","alasan":"x"},"a":{"hasil":"ditolak","alasan":"x"}},"tanggal":"","catatan":"","disimpan":1}';
    const d = bacaDraf(teks, ID)!;
    assert.deepEqual(Object.keys(d.isian), ["a"]);
    assert.equal(({} as Record<string, unknown>).hasil, undefined);
  });
});

describe("temukanDraf", () => {
  test("draf dengan tahun dan sidik yang sama ditemukan persis", () => {
    const s = new Simpanan();
    simpanDraf(s, 2027, "sidik1", draf());
    const r = temukanDraf(s, 2027, "sidik1", ID)!;
    assert.equal(r.persis, true);
    assert.deepEqual(r.draf, draf());
  });
  test("sidik berubah: draf terbaru tahun yang sama tetap dipulihkan, ditandai bukan persis", () => {
    const s = new Simpanan();
    simpanDraf(s, 2027, "lama1", draf({ disimpan: 10, catatan: "lebih lama" }));
    simpanDraf(s, 2027, "lama2", draf({ disimpan: 20, catatan: "lebih baru" }));
    simpanDraf(s, 2028, "lain", draf({ disimpan: 99, catatan: "tahun lain" }));
    const r = temukanDraf(s, 2027, "baru", ID)!;
    assert.equal(r.persis, false);
    assert.equal(r.draf.catatan, "lebih baru");
  });
  test("tidak ada draf: null; draf tahun lain tidak ikut", () => {
    const s = new Simpanan();
    assert.equal(temukanDraf(s, 2027, "x", ID), null);
    simpanDraf(s, 2028, "x", draf());
    assert.equal(temukanDraf(s, 2027, "x", ID), null);
  });
  test("tahun 2027 tidak tertukar dengan 20270 (awalan memuat titik dua)", () => {
    const s = new Simpanan();
    s.setItem(`${AWALAN_DRAF}20270:x`, serialkanDraf(draf()));
    assert.equal(temukanDraf(s, 2027, "y", ID), null);
  });
});

describe("hapusDraf dan penyimpanan yang rusak", () => {
  test("hapus semua draf tahun ini, sidik apa pun, dan hanya tahun ini", () => {
    const s = new Simpanan();
    simpanDraf(s, 2027, "a", draf());
    simpanDraf(s, 2027, "b", draf());
    simpanDraf(s, 2028, "a", draf());
    s.setItem("lain", "x");
    hapusDraf(s, 2027);
    assert.deepEqual([...s.data.keys()].sort(), [kunciDraf(2028, "a"), "lain"].sort());
  });
  test("penyimpanan yang melempar tidak merusak apa pun", () => {
    const r = new Rusak();
    assert.equal(simpanDraf(r, 2027, "a", draf()), false);
    assert.equal(temukanDraf(r, 2027, "a", ID), null);
    assert.doesNotThrow(() => hapusDraf(r, 2027));
  });
});
