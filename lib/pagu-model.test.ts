import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fallback from "./fallback-data.json" with { type: "json" };
import { susunModePagu } from "./pagu-model.ts";
import { greedyPilih, pilihOptimal, type Usulan, type Wilayah } from "./seleksi.ts";

const PAGU = 300_000_000;
const NBSP = " ";

const usulan: Usulan[] = fallback.usulan_voting.map((u) => ({
  id: u.id,
  title: u.title,
  namaSingkat: u.nama_singkat,
  category: u.category,
  rw: u.rw,
  estimatedBudget: u.estimated_budget,
  voteCount: u.vote_count,
  urgencyScore: u.urgency_score,
}));
const wilayahTs: Wilayah[] = fallback.wilayah.map((w) => ({
  rw: w.rw,
  nama: w.nama,
  penduduk: w.penduduk,
  anggaranLalu: w.anggaran_lalu,
}));
const wilayah = fallback.wilayah.map((w) => ({
  ...w,
  jumlah_usulan: 0,
  jumlah_suara: 0,
}));

const baris = (h: ReturnType<typeof pilihOptimal>) =>
  h.map((x) => ({
    peringkat: x.peringkat,
    id: x.id,
    title: x.title,
    nama_singkat: x.namaSingkat,
    category: x.category,
    rw: x.rw,
    estimated_budget: x.estimatedBudget,
    vote_count: x.voteCount,
    urgency_score: x.urgencyScore,
    skor: x.skor,
    selected: x.selected,
    total_berjalan: x.totalBerjalan,
  }));

const bobot = fallback.bobot_resmi;
const suara = susunModePagu(
  "suara",
  baris(greedyPilih(usulan, wilayahTs, PAGU, "suara", bobot)),
  wilayah,
  PAGU,
);
const rekom = susunModePagu(
  "rekomendasi",
  baris(pilihOptimal(usulan, wilayahTs, PAGU, bobot)),
  wilayah,
  PAGU,
);

describe("susunModePagu: suara terbanyak", () => {
  it("kalimat ringkasan menyebut RW 07 tidak kebagian", () => {
    assert.equal(
      suara.ringkasan,
      "2 proyek, semuanya di RW 01. RW 07 belum pernah menerima anggaran dan kali ini tetap tidak kebagian.",
    );
  });

  it("sisa Rp 10 juta; lebar blok + sisa = 100%", () => {
    assert.equal(suara.tata.sisa.rupiah, 10_000_000);
    const jumlah =
      suara.tata.blok.reduce((n, b) => n + b.lebar, 0) + suara.tata.sisa.lebar;
    assert.ok(Math.abs(jumlah - 100) < 1e-9);
  });

  it("lima usulan tidak terbiayai, tidak ada yang ditunda", () => {
    assert.equal(suara.tidakTerbiayai.length, 5);
    assert.equal(suara.ditunda.length, 0);
  });
});

describe("susunModePagu: rekomendasi SUARA", () => {
  it("kalimat ringkasan menyebut 4 proyek untuk 2 RW tertinggal", () => {
    assert.equal(
      rekom.ringkasan,
      "4 proyek yang mendesak untuk 2 RW yang selama ini tertinggal, dari pagu yang sama.",
    );
  });

  it("sisa Rp 15 juta; lebar blok + sisa = 100%", () => {
    assert.equal(rekom.tata.sisa.rupiah, 15_000_000);
    const jumlah =
      rekom.tata.blok.reduce((n, b) => n + b.lebar, 0) + rekom.tata.sisa.lebar;
    assert.ok(Math.abs(jumlah - 100) < 1e-9);
  });

  it("talud ditunda dengan penjelasan jujur dari data", () => {
    assert.equal(rekom.ditunda.length, 1);
    const [talud] = rekom.ditunda;
    assert.equal(talud.pertanyaan, "Kenapa talud ditunda?");
    assert.match(talud.paragraf[0], new RegExp(`biayanya Rp${NBSP}220${NBSP}juta`));
    assert.match(talud.paragraf[1], new RegExp(`pagu tinggal Rp${NBSP}80${NBSP}juta`));
    assert.match(talud.paragraf[1], new RegExp(`Rp${NBSP}285${NBSP}juta`));
    assert.match(talud.paragraf[2], /dana kebencanaan kabupaten/);
    assert.match(talud.paragraf[2], /musyawarah desa/);
  });

  it("dua usulan lain tidak terpilih (bukan ditunda)", () => {
    const status = rekom.tidakTerbiayai.map((i) => `${i.nama}:${i.status}`).sort();
    assert.deepEqual(status, [
      "Balai warga:tidak-terpilih",
      "Gapura:tidak-terpilih",
      "Talud:ditunda",
    ]);
  });
});
