import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { samarkan } from "./samarkan.ts";

/** Teks yang HARUS berubah: [teks asli, bagian yang tidak boleh tersisa, penanda yang harus ada]. */
const HARUS_SAMAR: [string, string, string][] = [
  ["Hubungi 081234567890 untuk info.", "081234567890", "[telepon]"],
  ["Telepon saya 0812-3456-7890 ya.", "0812-3456-7890", "[telepon]"],
  ["WA: +62 812 3456 7890.", "3456 7890", "[telepon]"],
  ["Nomor +6281234567890 aktif.", "81234567890", "[telepon]"],
  ["HP 0857 1234 5678", "1234 5678", "[telepon]"],
  ["Kontak 628123456789 saja.", "8123456789", "[telepon]"],
  ["NIK 3201123456789012 sudah dicek.", "3201123456789012", "[nomor identitas]"],
  ["KK: 3201 1234 5678 9012", "5678 9012", "[nomor identitas]"],
  ["NIK 3201-1234-5678-9012", "3201-1234", "[nomor identitas]"],
  ["Kirim ke budi.santoso@gmail.com sekarang", "budi.santoso", "[email]"],
  ["email: warga_rw07@desa.go.id", "warga_rw07", "[email]"],
  ["Transfer ke rekening 1234567890 atas nama desa", "1234567890", "[nomor rekening]"],
  ["No. rek BCA 0123456789", "0123456789", "[nomor rekening]"],
  ["rekening: 1234-5678-9012", "1234-5678", "[nomor rekening]"],
  ["Rumah saya di Jl. Mawar No. 12 RT 03/RW 07.", "Mawar", "[alamat]"],
  ["Tinggal di Jalan Melati Indah No 5.", "Melati", "[alamat]"],
  ["Gang Kenari nomor 7B dekat pos.", "Kenari", "[alamat]"],
  ["Kata Bu Sari lampu mati.", "Sari", "[nama]"],
  ["Pak RT Budi sudah tahu.", "Budi", "[nama]"],
  ["Laporan dari Bapak Sutrisno kemarin.", "Sutrisno", "[nama]"],
  ["Pak Haji Ahmad Fauzi menyumbang.", "Ahmad", "[nama]"],
  ["Warga bernama Joko Widodo mengeluh.", "Joko", "[nama]"],
  ["Mbak Rina yang melapor.", "Rina", "[nama]"],
  ["Hubungi Bu RT 03 Wati.", "Wati", "[nama]"],
];

/** Teks yang TIDAK boleh berubah sama sekali. */
const TIDAK_BOLEH_SAMAR: string[] = [
  "Biaya perbaikan sekitar Rp 150.000.000 untuk seluruh ruas.",
  "Anggaran Rp 1.250.000.000 sudah termasuk bahan.",
  "Jalan menuju SDN 03 rusak parah.",
  "Warga RW 07 sudah dua tahun menunggu.",
  "Lampu di RW 03 dan RW 07 mati sejak 2025.",
  "Panjang saluran sekitar 420 meter dan lebar 2,5 meter.",
  "Ada 35 keluarga dan 120 jiwa yang terdampak.",
  "Kejadian pukul 18.30 sampai 19.45 setiap hari.",
  "Pembangunan dimulai 12 Agustus 2026.",
  "Jalan lingkungan utama berlubang di banyak titik.",
  "Ibu-ibu PKK dan bapak-bapak ronda sudah sepakat.",
  "Pak RT Selasa depan akan meninjau lokasi.",
  "Rekening listrik naik jadi dua kali lipat.",
  "Tinggi talud 4 meter, volume 1200 m3.",
];

describe("samarkan: data pribadi diganti penanda", () => {
  for (const [asli, bagian, penanda] of HARUS_SAMAR) {
    it(`menyamarkan: ${asli}`, () => {
      const h = samarkan(asli);
      assert.ok(!h.teks.includes(bagian), `masih memuat "${bagian}": ${h.teks}`);
      assert.ok(h.teks.includes(penanda), `tanpa ${penanda}: ${h.teks}`);
      assert.ok(h.jumlah >= 1);
    });
  }
});

describe("samarkan: yang bukan data pribadi dibiarkan", () => {
  for (const asli of TIDAK_BOLEH_SAMAR) {
    it(`tidak mengubah: ${asli}`, () => {
      const h = samarkan(asli);
      assert.equal(h.teks, asli);
      assert.equal(h.jumlah, 0);
    });
  }
});

describe("samarkan: bentuk hasil", () => {
  it("bagian menandai persis yang disamarkan dan menyusun kembali teksnya", () => {
    const h = samarkan("Kata Bu Sari, telepon 081234567890, lampu mati.");
    assert.equal(h.bagian.map((b) => b.teks).join(""), h.teks);
    assert.deepEqual(
      h.bagian.filter((b) => b.samar).map((b) => b.teks),
      ["[nama]", "[telepon]"],
    );
    assert.equal(h.jumlah, 2);
  });

  it("teks kosong menghasilkan hasil kosong", () => {
    assert.deepEqual(samarkan(""), { teks: "", bagian: [], jumlah: 0 });
  });

  it("penanda yang dipalsukan di masukan dibuang, bukan dipercaya", () => {
    const h = samarkan("a\u0001nama\u0002b");
    assert.equal(h.teks, "anamab");
    assert.equal(h.jumlah, 0);
  });

  it("kata 'rekening' tanpa nomor panjang tidak mengubah apa pun", () => {
    assert.equal(samarkan("rekening desa sudah diperiksa").teks, "rekening desa sudah diperiksa");
  });

  it("rekening menyisakan katanya supaya kalimat tetap terbaca", () => {
    assert.equal(samarkan("rekening 1234567890").teks, "rekening [nomor rekening]");
  });
});
