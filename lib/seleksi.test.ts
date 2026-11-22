import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fallback from "./fallback-data.json" with { type: "json" };
import {
  greedyPilih,
  pilihOptimal,
  statusUsulan,
  type Usulan,
  type Wilayah,
} from "./seleksi.ts";

const PAGU = 300_000_000;
const BOBOT = fallback.bobot_resmi;

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

const wilayah: Wilayah[] = fallback.wilayah.map((w) => ({
  rw: w.rw,
  nama: w.nama,
  penduduk: w.penduduk,
  anggaranLalu: w.anggaran_lalu,
}));

const namaTerpilih = (h: { selected: boolean; namaSingkat: string }[]) =>
  h.filter((x) => x.selected).map((x) => x.namaSingkat).sort();
const total = (h: { selected: boolean; estimatedBudget: number }[]) =>
  h.filter((x) => x.selected).reduce((n, x) => n + x.estimatedBudget, 0);

describe("suara terbanyak (greedy)", () => {
  const hasil = greedyPilih(usulan, wilayah, PAGU, "suara", BOBOT);

  it("memilih dua usulan RW 01 dengan sisa Rp 10 juta", () => {
    assert.deepEqual(namaTerpilih(hasil), ["Balai warga", "Gapura"]);
    assert.equal(total(hasil), 290_000_000);
    assert.ok(
      hasil.filter((h) => h.selected).every((h) => h.rw === 1),
      "semua terpilih berasal dari RW 01",
    );
  });

  it("tidak melewati pagu", () => {
    assert.ok(total(hasil) <= PAGU);
  });
});

describe("rekomendasi (kombinasi terbaik)", () => {
  const hasil = pilihOptimal(usulan, wilayah, PAGU, BOBOT);

  it("memilih empat kebutuhan dasar dengan sisa Rp 15 juta", () => {
    assert.deepEqual(namaTerpilih(hasil), [
      "Drainase",
      "Jalan SDN 03",
      "Jembatan",
      "Lampu PJU",
    ]);
    assert.equal(total(hasil), 285_000_000);
  });

  it("skor mengikuti rumus: Talud 10, Drainase 9,6", () => {
    const skor = Object.fromEntries(hasil.map((h) => [h.namaSingkat, h.skor]));
    assert.equal(skor["Talud"], 10);
    assert.equal(skor["Drainase"], 9.6);
    assert.equal(skor["Gapura"], 4.2);
  });

  it("talud berskor tertinggi tetapi tidak terpilih", () => {
    assert.equal(hasil[0].namaSingkat, "Talud");
    assert.equal(hasil[0].selected, false);
  });

  it("greedy biasa menurut skor akan memilih talud lebih dulu; kombinasi terbaik tidak", () => {
    const greedy = greedyPilih(usulan, wilayah, PAGU, "skor", BOBOT);
    assert.equal(greedy[0].namaSingkat, "Talud");
    assert.equal(greedy[0].selected, true);
    assert.ok(!namaTerpilih(hasil).includes("Talud"));
  });

  it("selalu muat dalam pagu, berapa pun pagunya", () => {
    for (const pagu of [0, 40_000_000, 125_000_000, 220_000_000, 500_000_000]) {
      const h = pilihOptimal(usulan, wilayah, pagu, BOBOT);
      assert.ok(total(h) <= pagu, `pagu ${pagu}`);
    }
  });

  it("total berjalan hanya menghitung usulan terpilih", () => {
    assert.equal(hasil[hasil.length - 1].totalBerjalan, 285_000_000);
  });

  it("menolak lebih dari 16 usulan", () => {
    const banyak = Array.from({ length: 17 }, (_, i) => ({
      ...usulan[0],
      id: `u${i}`,
    }));
    assert.throws(() => pilihOptimal(banyak, wilayah, PAGU, BOBOT), RangeError);
  });
});

describe("statusUsulan", () => {
  it("pada rekomendasi: talud ditunda, gapura dan balai warga tidak terpilih", () => {
    const status = Object.fromEntries(
      statusUsulan(pilihOptimal(usulan, wilayah, PAGU, BOBOT), "skor").map(
        (h) => [h.namaSingkat, h.status],
      ),
    );
    assert.equal(status["Talud"], "ditunda");
    assert.equal(status["Gapura"], "tidak-terpilih");
    assert.equal(status["Balai warga"], "tidak-terpilih");
    assert.equal(status["Drainase"], "terpilih");
  });

  it("pada suara terbanyak: yang tidak masuk tidak pernah berstatus ditunda", () => {
    const hasil = statusUsulan(
      greedyPilih(usulan, wilayah, PAGU, "suara", BOBOT),
      "suara",
    );
    assert.ok(hasil.every((h) => h.status !== "ditunda"));
  });
});
