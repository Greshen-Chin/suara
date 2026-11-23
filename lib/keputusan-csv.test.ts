import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BOM, KEPALA_CSV, bangunCsv, netralkanSel, sel, type BarisCsv } from "./keputusan-csv.ts";

const dasar: BarisCsv = {
  peringkat: 2, judul: "Jalan SDN 03", rw: 3, biaya: 85_000_000, hasil: "disetujui", beda: false,
  statusRekomendasi: "terpilih", skor: 9.6, dukungan: 30, alasan: "Mengikuti rekomendasi: peringkat 2 dari 7, skor 9,6.",
  sumberDana: null, statusSekarang: "approved", selesaiPada: null, catatanSelesai: null, biayaRealisasi: null,
};

describe("netralkanSel (injeksi rumus)", () => {
  test("sel teks yang diawali = + - @ diberi awalan kutip tunggal", () => {
    for (const awal of ["=", "+", "-", "@"]) {
      assert.equal(netralkanSel(`${awal}HYPERLINK("http://jahat.invalid")`), `'${awal}HYPERLINK("http://jahat.invalid")`);
    }
    assert.equal(netralkanSel("=1+1"), "'=1+1");
    assert.equal(netralkanSel("@SUM(A1)"), "'@SUM(A1)");
  });
  test("juga bila diawali spasi, tab, atau carriage return", () => {
    assert.equal(netralkanSel("  =1+1"), "'  =1+1");
    assert.equal(netralkanSel("\t=1+1"), "'\t=1+1");
    assert.equal(netralkanSel("\r=1+1"), "'\r=1+1");
    assert.equal(netralkanSel("\t sisa"), "'\t sisa");
  });
  test("teks biasa dan teks yang memuat tanda itu di tengah tidak diubah", () => {
    assert.equal(netralkanSel("Jalan SDN 03"), "Jalan SDN 03");
    assert.equal(netralkanSel("biaya = 85 juta"), "biaya = 85 juta");
    assert.equal(netralkanSel("RW 01 - RW 03"), "RW 01 - RW 03");
    assert.equal(netralkanSel("a@b"), "a@b");
    assert.equal(netralkanSel(""), "");
  });
});

describe("sel", () => {
  test("angka apa adanya, null kosong, angka tak hingga kosong", () => {
    assert.equal(sel(85_000_000), "85000000");
    assert.equal(sel(9.6), "9.6");
    assert.equal(sel(0), "0");
    assert.equal(sel(null), "");
    assert.equal(sel(undefined), "");
    assert.equal(sel(Number.NaN), "");
  });
  test("teks dikutip bila memuat koma, kutip, atau baris baru; kutip digandakan", () => {
    assert.equal(sel("a, b"), '"a, b"');
    assert.equal(sel('dia berkata "ya"'), '"dia berkata ""ya"""');
    assert.equal(sel("baris satu\nbaris dua"), '"baris satu\nbaris dua"');
    assert.equal(sel("tanpa tanda"), "tanpa tanda");
  });
  test("rumus yang dikutip tetap dinetralkan", () => {
    assert.equal(sel('=HYPERLINK("a","b")'), `"'=HYPERLINK(""a"",""b"")"`);
  });
});

describe("bangunCsv", () => {
  test("diawali BOM dan kepala kolom, berakhir CRLF", () => {
    const csv = bangunCsv(2027, [dasar]);
    assert.ok(csv.startsWith(`${BOM}Tahun Anggaran,`));
    assert.ok(csv.endsWith("\r\n"));
    const garis = csv.slice(1).split("\r\n");
    assert.equal(garis[0].split(",").length, KEPALA_CSV.length);
    assert.equal(garis.length, 3); // kepala, satu baris, dan sisa kosong sesudah CRLF terakhir
  });

  test("sebuah baris: label hasil dan status dalam bahasa Indonesia, tanpa status mentah", () => {
    const [, baris] = bangunCsv(2027, [dasar]).slice(1).split("\r\n");
    assert.equal(
      baris,
      '2027,2,Jalan SDN 03,3,85000000,Disetujui,Tidak,Terpilih,9.6,30,"Mengikuti rekomendasi: peringkat 2 dari 7, skor 9,6.",,Disetujui,,,',
    );
    assert.doesNotMatch(baris, /approved|undefined|null/);
  });

  test("urutan menurut peringkat; yang tanpa peringkat (periode lampau) di akhir", () => {
    const csv = bangunCsv(2026, [
      { ...dasar, peringkat: null, judul: "Lampau B", biaya: 2 },
      { ...dasar, peringkat: 3, judul: "Ketiga" },
      { ...dasar, peringkat: 1, judul: "Pertama" },
      { ...dasar, peringkat: null, judul: "Lampau A", biaya: 1 },
    ]);
    const judul = csv.slice(1).split("\r\n").slice(1, 5).map((g) => g.split(",")[2]);
    assert.deepEqual(judul, ["Pertama", "Ketiga", "Lampau A", "Lampau B"]);
  });

  test("periode tanpa rekomendasi: kolom perbandingan kosong, bukan 'Tidak'", () => {
    const [, baris] = bangunCsv(2026, [{ ...dasar, peringkat: null, statusRekomendasi: null, skor: null, beda: false }]).slice(1).split("\r\n");
    const kolom = baris.split(",");
    assert.equal(kolom[1], "");
    assert.equal(kolom[6], "");
    assert.equal(kolom[7], "");
    assert.equal(kolom[8], "");
  });

  test("sel berbahaya dari judul, alasan, sumber dana, dan catatan dinetralkan", () => {
    const csv = bangunCsv(2027, [
      { ...dasar, judul: "=cmd|' /C calc'!A0", alasan: "+1+1", sumberDana: "@SUM(1)", catatanSelesai: "-2+3", statusSekarang: "done", selesaiPada: "2026-11-02T03:00:00Z" },
    ]);
    const baris = csv.slice(1).split("\r\n")[1];
    assert.ok(baris.includes("'=cmd|' /C calc'!A0"));
    assert.ok(baris.includes(",'+1+1,"));
    assert.ok(baris.includes(",'@SUM(1),"));
    assert.ok(baris.includes(",'-2+3,"));
    // Tidak ada sel yang dimulai langsung dengan karakter rumus (setelah koma pemisah atau di awal baris).
    assert.doesNotMatch(baris, /(^|,)[=+\-@]/);
    assert.ok(baris.includes(",2026-11-02,"), "tanggal selesai hanya tanggalnya");
  });

  test("usulan yang kelak disembunyikan tidak membocorkan judulnya", () => {
    const baris = bangunCsv(2027, [{ ...dasar, judul: null }]).slice(1).split("\r\n")[1];
    assert.ok(baris.includes("(usulan disembunyikan)"));
  });

  test("tanpa baris: hanya kepala", () => {
    const garis = bangunCsv(2027, []).slice(1).split("\r\n");
    assert.deepEqual([garis.length, garis[1]], [2, ""]);
  });

  test("hasil dan status lain dibaca dengan kata sehari-hari", () => {
    const csv = bangunCsv(2027, [
      { ...dasar, peringkat: 1, hasil: "dana_lain", beda: false, statusRekomendasi: "ditunda", sumberDana: "Dana kebencanaan kabupaten", statusSekarang: "referred", biayaRealisasi: 5 },
    ]);
    const baris = csv.slice(1).split("\r\n")[1];
    assert.ok(baris.includes("Diajukan ke dana lain,Tidak,Ditunda"));
    assert.ok(baris.includes("Dana kebencanaan kabupaten,Diajukan ke dana lain,"));
  });
});
