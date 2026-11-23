import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { anggaranTiapRw, namaRw, susunDuaBatang } from "./keputusan-banding.ts";
import type { KeputusanPublik, Periode, WilayahPeriode } from "./keputusan-tipe.ts";

const JT = 1_000_000;

const WILAYAH: WilayahPeriode[] = [
  { rw: 1, nama: "RW 01", penduduk: 3000 },
  { rw: 3, nama: "RW 03", penduduk: 2000 },
  { rw: 7, nama: "RW 07", penduduk: 400 },
];

const periode = (ubah: Partial<Periode> = {}): Periode => ({
  tahun: 2027, status: "diputuskan", diputuskanPada: "2026-11-20T10:00:00Z", tanggalMusyawarah: "2026-11-20", catatan: "Catatan rapat yang cukup panjang.",
  pagu: 300 * JT, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 }, adaRekomendasi: true,
  wilayahSebelum: { "1": 250 * JT, "3": 60 * JT, "7": 0 }, diputuskanOleh: "admin", jumlah: { disetujui: 3, danaLain: 0, dilanjutkan: 2, ditolak: 0 },
  beda: 0, terpakai: 0, ...ubah,
});

function k(id: string, peringkat: number, rw: number, biayaJuta: number, hasil: KeputusanPublik["hasil"], terpilih: boolean, beda = false): KeputusanPublik {
  return {
    proposalId: id, judul: `Judul ${id}`, namaSingkat: id, hasil, alasan: null, sumberDana: null, peringkat, jumlahUsulan: 5, skor: 9,
    statusRekomendasi: terpilih ? "terpilih" : "ditunda", biaya: biayaJuta * JT, dukungan: 10, urgensi: 8, rw, beda,
    statusSekarang: "approved", selesaiPada: null, catatanSelesai: null, biayaRealisasi: null,
  };
}

const SEJALAN = [
  k("Talud", 1, 7, 220, "dilanjutkan", false),
  k("Jalan", 2, 3, 85, "disetujui", true),
  k("Drainase", 3, 7, 90, "disetujui", true),
  k("Jembatan", 4, 7, 70, "disetujui", true),
  k("Gapura", 5, 1, 180, "dilanjutkan", false),
];

describe("susunDuaBatang", () => {
  test("mengikuti rekomendasi: kedua batang sama, tidak ada yang berbeda", () => {
    const d = susunDuaBatang(periode(), SEJALAN, WILAYAH)!;
    assert.deepEqual(d.rekomendasi!.terpilih.map((i) => i.id), ["Jalan", "Drainase", "Jembatan"]);
    assert.deepEqual(d.keputusan.terpilih.map((i) => i.id), ["Jalan", "Drainase", "Jembatan"]);
    assert.equal(d.beda.size, 0);
    assert.equal(d.pagu, 300 * JT);
    // Skala sama: sisa dan lebar dihitung dari pagu yang sama.
    assert.equal(d.rekomendasi!.tata.sisa.rupiah, 55 * JT);
    assert.equal(d.keputusan.tata.sisa.rupiah, 55 * JT);
  });

  test("berbeda: terpilih tetapi tidak disetujui, dan disetujui padahal tidak terpilih, ditandai di kedua batang", () => {
    const berbeda = [
      k("Talud", 1, 7, 220, "dilanjutkan", false),
      k("Jalan", 2, 3, 85, "disetujui", true),
      k("Drainase", 3, 7, 90, "ditolak", true, true),
      k("Jembatan", 4, 7, 70, "disetujui", true),
      k("Gapura", 5, 1, 180, "disetujui", false, true),
    ];
    const d = susunDuaBatang(periode({ pagu: 450 * JT }), berbeda, WILAYAH)!;
    assert.deepEqual([...d.beda].sort(), ["Drainase", "Gapura"]);
    assert.deepEqual(d.rekomendasi!.terpilih.map((i) => i.id), ["Jalan", "Drainase", "Jembatan"]);
    assert.deepEqual(d.keputusan.terpilih.map((i) => i.id), ["Jalan", "Jembatan", "Gapura"]);
  });

  test("periode lampau tanpa rekomendasi: hanya batang keputusan, tidak ada tanda beda", () => {
    const d = susunDuaBatang(periode({ adaRekomendasi: false, tahun: 2026, pagu: 320 * JT }), [
      { ...k("A", 1, 1, 150, "disetujui", false), peringkat: null, statusRekomendasi: null },
      { ...k("B", 2, 1, 100, "disetujui", false), peringkat: null, statusRekomendasi: null },
    ], WILAYAH)!;
    assert.equal(d.rekomendasi, null);
    assert.equal(d.keputusan.terpilih.length, 2);
    assert.equal(d.beda.size, 0);
  });

  test("tidak ada yang disetujui: batang kosong dengan sisa penuh, bukan galat", () => {
    const d = susunDuaBatang(periode(), SEJALAN.map((x) => ({ ...x, hasil: "dilanjutkan" as const, beda: x.statusRekomendasi === "terpilih" })), WILAYAH)!;
    assert.equal(d.keputusan.terpilih.length, 0);
    assert.equal(d.keputusan.tata.sisa.lebar, 100);
  });

  test("periode berjalan, tanpa pagu, atau data yang melebihi pagu: null (halaman tidak menggambar batang)", () => {
    assert.equal(susunDuaBatang(periode({ status: "berjalan" }), SEJALAN, WILAYAH), null);
    assert.equal(susunDuaBatang(periode({ pagu: null }), SEJALAN, WILAYAH), null);
    assert.equal(susunDuaBatang(periode({ pagu: 100 * JT }), SEJALAN, WILAYAH), null);
  });

  test("nama usulan yang disembunyikan tidak bocor: dipakai 'Usulan'", () => {
    const d = susunDuaBatang(periode(), SEJALAN.map((x) => ({ ...x, judul: null, namaSingkat: null })), WILAYAH)!;
    assert.ok(d.keputusan.terpilih.every((i) => i.nama === "Usulan" && i.judul === ""));
  });
});

describe("anggaranTiapRw", () => {
  test("diterima, per penduduk, dan periode lalu menurut potret", () => {
    const r = anggaranTiapRw(periode(), SEJALAN, WILAYAH);
    assert.deepEqual(r.map((x) => [x.rw, x.diterima, x.perPenduduk, x.periodeLalu]), [
      [1, 0, 0, 250 * JT],
      [3, 85 * JT, 42_500, 60 * JT],
      [7, 160 * JT, 400_000, 0],
    ]);
  });
  test("tanpa potret periode lalu: null, bukan 0", () => {
    const r = anggaranTiapRw({ wilayahSebelum: null }, SEJALAN, WILAYAH);
    assert.ok(r.every((x) => x.periodeLalu === null));
  });
  test("tanpa penduduk: tidak ada pembagian nol", () => {
    const r = anggaranTiapRw({ wilayahSebelum: null }, SEJALAN, [{ rw: 7, nama: "RW 07", penduduk: 0 }]);
    assert.equal(r[0].perPenduduk, 0);
  });
});

describe("namaRw", () => {
  test("memakai nama dari wilayah, atau RW dengan dua digit bila tidak dikenal", () => {
    assert.equal(namaRw(3, WILAYAH), "RW 03");
    assert.equal(namaRw(9, WILAYAH), "RW 09");
    assert.equal(namaRw(null, WILAYAH), "Tanpa RW");
  });
});
