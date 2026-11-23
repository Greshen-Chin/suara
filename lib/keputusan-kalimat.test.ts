import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CATATAN_BUKAN_PENGESAHAN,
  TEKS_SEJALAN_SEMUA,
  TEKS_TANPA_REKOMENDASI,
  namaPeriode,
  rincianHasil,
  ringkasTerpakai,
  tanggalMusyawarahTeks,
  teksCap,
} from "./keputusan-kalimat.ts";

const biasa = (s: string) => s.replaceAll(" ", " ");

describe("kalimat keputusan", () => {
  test("rincian hasil hanya menyebut yang tidak nol", () => {
    assert.equal(rincianHasil({ disetujui: 4, danaLain: 0, dilanjutkan: 3, ditolak: 0 }), "4 disetujui, 3 dibawa ke periode berikutnya");
    assert.equal(
      rincianHasil({ disetujui: 1, danaLain: 1, dilanjutkan: 1, ditolak: 1 }),
      "1 disetujui, 1 diajukan ke dana lain, 1 dibawa ke periode berikutnya, 1 ditolak",
    );
    assert.equal(rincianHasil({ disetujui: 0, danaLain: 0, dilanjutkan: 0, ditolak: 0 }), "Tidak ada keputusan");
  });
  test("ringkas terpakai, dengan dan tanpa pagu", () => {
    const j = { disetujui: 4, danaLain: 0, dilanjutkan: 3, ditolak: 0 };
    assert.equal(biasa(ringkasTerpakai({ terpakai: 285_000_000, pagu: 300_000_000, jumlah: j })), "Rp 285 juta dari pagu Rp 300 juta, 4 usulan disetujui");
    assert.equal(biasa(ringkasTerpakai({ terpakai: 0, pagu: null, jumlah: { ...j, disetujui: 0 } })), "Rp 0, 0 usulan disetujui");
  });
  test("tanggal dan cap: tanggal rapat tidak bergeser sehari karena zona waktu", () => {
    assert.equal(tanggalMusyawarahTeks("2026-11-20"), "20 November 2026");
    assert.equal(tanggalMusyawarahTeks("2025-12-12"), "12 Desember 2025");
    assert.equal(tanggalMusyawarahTeks("2026-01-01"), "1 Januari 2026");
    assert.equal(tanggalMusyawarahTeks(null), null);
    assert.equal(teksCap("2026-11-20"), "DIPUTUSKAN · 20 November 2026");
    assert.equal(teksCap(null), "DIPUTUSKAN");
  });
  test("nama periode, dan tidak ada kata 'pengesahan' kecuali untuk menyangkalnya", () => {
    assert.equal(namaPeriode(2027), "Tahun Anggaran 2027");
    assert.match(CATATAN_BUKAN_PENGESAHAN, /bukan pengesahan anggaran/);
    assert.match(CATATAN_BUKAN_PENGESAHAN, /Data purwarupa/);
    for (const t of [TEKS_TANPA_REKOMENDASI, TEKS_SEJALAN_SEMUA, rincianHasil({ disetujui: 1, danaLain: 0, dilanjutkan: 0, ditolak: 0 })]) {
      assert.doesNotMatch(t, /pengesah/i);
    }
    assert.equal(TEKS_TANPA_REKOMENDASI, "Periode ini diputuskan sebelum SUARA dipakai, jadi tidak ada rekomendasi untuk dibandingkan.");
    assert.equal(TEKS_SEJALAN_SEMUA, "Musyawarah mengikuti seluruh rekomendasi.");
  });
});
