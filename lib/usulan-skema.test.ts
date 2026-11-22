import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BATAS,
  adalahUuid,
  panjang,
  periksaAlasan,
  periksaKomentar,
  periksaUsulan,
  rapikanTeks,
  type MasukanUsulan,
} from "./usulan-skema.ts";

const SAH: MasukanUsulan = {
  judul: "Lampu jalan gang RW 07 gelap",
  namaSingkat: "",
  deskripsi: "Gang di belakang musala tidak ada lampunya dan warga takut lewat malam hari.",
  kategori: "infrastruktur",
  rw: "7",
  biaya: "Rp 25 jt",
};

describe("periksaUsulan", () => {
  it("menerima masukan yang sah dan mengembalikan nilai yang sudah dirapikan", () => {
    const h = periksaUsulan({ ...SAH, judul: "  Lampu   jalan  gang RW 07 gelap ", namaSingkat: " Lampu gang " }, [1, 3, 7]);
    assert.ok(h.ok);
    assert.deepEqual(h.data, {
      judul: "Lampu jalan gang RW 07 gelap",
      namaSingkat: "Lampu gang",
      deskripsi: SAH.deskripsi,
      kategori: "infrastruktur",
      rw: 7,
      biaya: 25_000_000,
    });
  });

  it("nama singkat kosong menjadi null", () => {
    const h = periksaUsulan(SAH);
    assert.ok(h.ok);
    assert.equal(h.data.namaSingkat, null);
  });

  it("empat cara menulis biaya menghasilkan angka yang sama", () => {
    for (const biaya of ["85000000", "85.000.000", "Rp 85 jt", "85 juta"]) {
      const h = periksaUsulan({ ...SAH, biaya });
      assert.ok(h.ok, biaya);
      assert.equal(h.data.biaya, 85_000_000, biaya);
    }
  });

  it("galat disebut per bidang, dengan pesan yang bisa ditindaklanjuti", () => {
    const h = periksaUsulan({ judul: "", namaSingkat: "x", deskripsi: "pendek", kategori: "?", rw: "", biaya: "" });
    assert.ok(!h.ok);
    assert.deepEqual(Object.keys(h.galat).sort(), ["biaya", "deskripsi", "judul", "kategori", "namaSingkat", "rw"]);
    assert.match(h.galat.judul!, /Tulis judul/);
    assert.match(h.galat.deskripsi!, /apa masalahnya, siapa yang terdampak, dan di mana/);
  });

  it("batas judul: 7 ditolak, 8 diterima, 80 diterima, 81 ditolak", () => {
    assert.ok(!periksaUsulan({ ...SAH, judul: "a".repeat(7) }).ok);
    assert.ok(periksaUsulan({ ...SAH, judul: "a".repeat(8) }).ok);
    assert.ok(periksaUsulan({ ...SAH, judul: "a".repeat(80) }).ok);
    const h = periksaUsulan({ ...SAH, judul: "a".repeat(81) });
    assert.ok(!h.ok);
    assert.match(h.galat.judul!, /Ringkas sampai 80/);
  });

  it("batas biaya: di bawah Rp 100 ribu dan di atas Rp 5 miliar ditolak", () => {
    const rendah = periksaUsulan({ ...SAH, biaya: "85" });
    assert.ok(!rendah.ok);
    assert.match(rendah.galat.biaya!, /minimal Rp 100\.000/);
    const tinggi = periksaUsulan({ ...SAH, biaya: "6 miliar" });
    assert.ok(!tinggi.ok);
    assert.match(tinggi.galat.biaya!, /maksimal Rp 5 miliar/);
    assert.ok(periksaUsulan({ ...SAH, biaya: "100000" }).ok);
    assert.ok(periksaUsulan({ ...SAH, biaya: "5 miliar" }).ok);
  });

  it("RW harus ada di daftar RW bila daftar diberikan", () => {
    assert.ok(!periksaUsulan({ ...SAH, rw: "9" }, [1, 3, 7]).ok);
    assert.ok(periksaUsulan({ ...SAH, rw: "9" }).ok);
    assert.ok(!periksaUsulan({ ...SAH, rw: "abc" }).ok);
    assert.ok(!periksaUsulan({ ...SAH, rw: "7.5" }).ok);
  });

  it("kategori di luar daftar ditolak", () => {
    assert.ok(!periksaUsulan({ ...SAH, kategori: "politik" }).ok);
  });
});

describe("rapikanTeks dan panjang", () => {
  it("membuang karakter NUL dan kontrol, yang membuat Postgres menolak teks", () => {
    assert.equal(rapikanTeks("a\u0000b\u0007c", false), "abc");
  });

  it("judul menjadi satu baris; deskripsi mempertahankan paragraf tetapi bukan baris kosong beruntun", () => {
    assert.equal(rapikanTeks("a\n\n b\t c", false), "a b c");
    assert.equal(rapikanTeks("a\r\nb\n\n\n\nc  ", true), "a\nb\n\nc");
  });

  it("panjang menghitung titik kode seperti char_length() Postgres", () => {
    assert.equal(panjang("abc"), 3);
    assert.equal(panjang("😀😀"), 2);
    assert.equal("😀😀".length, 4);
  });
});

describe("periksaKomentar dan periksaAlasan", () => {
  it("komentar kosong atau hanya spasi ditolak", () => {
    assert.ok(!periksaKomentar("").ok);
    assert.ok(!periksaKomentar("  \n ").ok);
  });

  it("komentar dipangkas; 1.000 karakter diterima, 1.001 ditolak", () => {
    const h = periksaKomentar("  Setuju.  ");
    assert.ok(h.ok);
    assert.equal(h.isi, "Setuju.");
    assert.ok(periksaKomentar("a".repeat(BATAS.komentar.maks)).ok);
    const panjangSekali = periksaKomentar("a".repeat(BATAS.komentar.maks + 1));
    assert.ok(!panjangSekali.ok);
    assert.match(panjangSekali.pesan, /Maksimal 1000/);
  });

  it("komentar tetap teks biasa: tautan dan tag tidak diubah atau dibuang", () => {
    const h = periksaKomentar("Lihat <b>ini</b> http://contoh.invalid/promo");
    assert.ok(h.ok);
    assert.equal(h.isi, "Lihat <b>ini</b> http://contoh.invalid/promo");
  });

  it("alasan minimal 10 karakter, maksimal 500", () => {
    assert.ok(!periksaAlasan("pendek").ok);
    assert.ok(!periksaAlasan("         ").ok);
    assert.ok(periksaAlasan("Berisi tautan promosi.").ok);
    assert.ok(!periksaAlasan("a".repeat(501)).ok);
  });
});

describe("adalahUuid", () => {
  it("menerima UUID dan menolak yang lain", () => {
    assert.ok(adalahUuid("6f1b3d0a-1001-4c8e-9a10-000000000001"));
    assert.ok(!adalahUuid("6f1b3d0a-1001-4c8e-9a10"));
    assert.ok(!adalahUuid("'; drop table proposals;--"));
    assert.ok(!adalahUuid(undefined));
    assert.ok(!adalahUuid(42));
  });
});
