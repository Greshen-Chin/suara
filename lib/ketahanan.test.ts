import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { semuaKombinasiBobot } from "./bobot-simulasi.ts";
import fallback from "./fallback-data.json" with { type: "json" };
import {
  bergantungPadaBobot,
  calonPagu,
  cariPaguBergantung,
  gabungNama,
  hitungAwalKetahanan,
  hitungKetahanan,
  kunciKetahanan,
  kalimatKetahanan,
  ketahananBertahap,
} from "./ketahanan.ts";
import { bangunTangga } from "./peta-pagu.ts";
import { pilihOptimal, type Usulan, type Wilayah } from "./seleksi.ts";
import { kasusAcak } from "./uji-acak.ts";

const JT = 1_000_000;
const biasa = (teks: string): string => teks.replaceAll(" ", " ");

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
const namaDari = (id: string) => usulan.find((u) => u.id === id)!.namaSingkat;
const namaSemua = (ids: readonly string[]) => ids.map(namaDari).sort();

/** Pembanding paling sederhana: panggil pilihOptimal untuk tiap kombinasi bobot. */
function cara_lama(u: Usulan[], w: Wilayah[], pagu: number) {
  const hitung = new Map<string, number>();
  for (const bobot of semuaKombinasiBobot()) {
    const kunci = pilihOptimal(u, w, pagu, bobot)
      .filter((h) => h.selected)
      .map((h) => h.id)
      .sort()
      .join("|");
    hitung.set(kunci, (hitung.get(kunci) ?? 0) + 1);
  }
  return [...hitung].map(([k, n]) => `${n}:${k}`).sort();
}
const cara_baru = (u: Usulan[], w: Wilayah[], pagu: number) =>
  hitungKetahanan(u, w, pagu).pilihan.map((p) => `${p.jumlah}:${[...p.ids].sort().join("|")}`).sort();

describe("S-04: uji ketahanan pada data demo", () => {
  it("pagu Rp 300 juta: satu hasil untuk 231 dari 231 kombinasi", () => {
    const h = hitungKetahanan(usulan, wilayah, 300 * JT);
    assert.equal(h.total, 231);
    assert.equal(h.pilihan.length, 1);
    assert.equal(h.pilihan[0].jumlah, 231);
    assert.deepEqual(namaSemua(h.pilihan[0].ids), ["Drainase", "Jalan SDN 03", "Jembatan", "Lampu PJU"]);
    assert.equal(bergantungPadaBobot(h), false);
    assert.equal(h.perUsulan[usulan.find((u) => u.namaSingkat === "Drainase")!.id], 231);
    assert.equal(h.perUsulan[usulan.find((u) => u.namaSingkat === "Talud")!.id], 0);
  });

  it("pagu Rp 450 juta: 133 dan 98", () => {
    const h = hitungKetahanan(usulan, wilayah, 450 * JT);
    assert.deepEqual(h.pilihan.map((p) => p.jumlah), [133, 98]);
    assert.deepEqual(namaSemua(h.pilihan[0].ids), ["Balai warga", "Drainase", "Jalan SDN 03", "Jembatan", "Lampu PJU"]);
    assert.deepEqual(namaSemua(h.pilihan[1].ids), ["Drainase", "Jembatan", "Lampu PJU", "Talud"]);
    assert.equal(bergantungPadaBobot(h), true);
  });

  it("pagu Rp 250 juta: 147, 49, dan 35", () => {
    const h = hitungKetahanan(usulan, wilayah, 250 * JT);
    assert.deepEqual(h.pilihan.map((p) => p.jumlah), [147, 49, 35]);
    assert.deepEqual(namaSemua(h.pilihan[0].ids), ["Drainase", "Jembatan", "Lampu PJU"]);
    assert.deepEqual(namaSemua(h.pilihan[1].ids), ["Drainase", "Jalan SDN 03", "Lampu PJU"]);
    assert.deepEqual(namaSemua(h.pilihan[2].ids), ["Drainase", "Jalan SDN 03", "Jembatan"]);
  });

  it("jumlah per pilihan selalu 231, dan perUsulan konsisten dengan pilihan", () => {
    for (const pagu of [0, 50, 100, 250, 300, 450, 800].map((x) => x * JT)) {
      const h = hitungKetahanan(usulan, wilayah, pagu);
      assert.equal(h.pilihan.reduce((n, p) => n + p.jumlah, 0), 231, `pagu ${pagu / JT}`);
      for (const u of usulan) {
        const dihitung = h.pilihan.filter((p) => p.ids.includes(u.id)).reduce((n, p) => n + p.jumlah, 0);
        assert.equal(h.perUsulan[u.id], dihitung);
      }
    }
  });

  it("semua preset di bagian 2 brief menghasilkan pilihan yang sama pada Rp 300 juta (sama dengan hasil resmi)", () => {
    const presetan = [
      { popularitas: 100, urgensi: 0, pemerataan: 0 },
      { popularitas: 10, urgensi: 80, pemerataan: 10 },
      { popularitas: 10, urgensi: 30, pemerataan: 60 },
    ];
    const resmi = hitungKetahanan(usulan, wilayah, 300 * JT).pilihan[0].ids.slice().sort();
    for (const b of presetan) {
      const h = hitungKetahanan(usulan, wilayah, 300 * JT, [b]);
      assert.deepEqual(h.pilihan[0].ids.slice().sort(), resmi);
    }
  });
});

describe("kesetaraan dengan pilihOptimal (inti DP yang lebih cepat)", () => {
  it("data demo di berbagai pagu, termasuk tepat di titik tangga", () => {
    const tangga = bangunTangga(usulan, wilayah, fallback.bobot_resmi);
    const pagu = [0, 39 * JT, 40 * JT, 300 * JT, 800 * JT, ...tangga.titik.slice(1, 12).flatMap((t) => [t.pagu - 1, t.pagu])];
    for (const p of pagu) assert.deepEqual(cara_baru(usulan, wilayah, p), cara_lama(usulan, wilayah, p), `pagu ${p}`);
  });

  it("kasus acak berbenih tetap dengan seri sengaja: 25 kasus x 3 pagu", () => {
    for (let benih = 1; benih <= 25; benih++) {
      const k = kasusAcak(benih, 1 + (benih % 9));
      const total = k.usulan.reduce((n, u) => n + u.estimatedBudget, 0);
      for (const bagian of [0.2, 0.5, 0.8]) {
        const pagu = Math.round((total * bagian) / JT) * JT;
        assert.deepEqual(cara_baru(k.usulan, k.wilayah, pagu), cara_lama(k.usulan, k.wilayah, pagu), `benih ${benih}, pagu ${pagu}`);
      }
    }
  });

  it("tanpa usulan: satu pilihan kosong untuk semua kombinasi", () => {
    const h = hitungKetahanan([], wilayah, 300 * JT);
    assert.equal(h.pilihan.length, 1);
    assert.deepEqual(h.pilihan[0].ids, []);
    assert.equal(h.pilihan[0].jumlah, 231);
  });

  it("lebih dari 16 usulan melempar RangeError sebelum mengalokasikan apa pun", () => {
    const banyak = Array.from({ length: 40 }, (_, i) => ({ ...usulan[0], id: `x${i}` }));
    assert.throws(() => hitungKetahanan(banyak, wilayah, 300 * JT), RangeError);
  });
});

describe("hitungan bertahap", () => {
  it("setiap next() menyelesaikan satu kombinasi dan hasil akhirnya sama dengan versi sekali jalan", () => {
    const g = ketahananBertahap(usulan, wilayah, 450 * JT);
    const kemajuan: number[] = [];
    let r = g.next();
    while (!r.done) {
      kemajuan.push(r.value);
      r = g.next();
    }
    assert.equal(kemajuan.length, 231);
    assert.deepEqual(kemajuan.slice(0, 3), [1, 2, 3]);
    assert.equal(kemajuan[230], 231);
    assert.deepEqual(r.value, hitungKetahanan(usulan, wilayah, 450 * JT));
  });

  it("dibatalkan cukup dengan berhenti memanggil next(); hitungan baru tidak terpengaruh", () => {
    const g = ketahananBertahap(usulan, wilayah, 450 * JT);
    g.next();
    g.next();
    g.return({ pagu: 0, total: 0, pilihan: [], perUsulan: {} });
    assert.deepEqual(hitungKetahanan(usulan, wilayah, 300 * JT).pilihan.map((p) => p.jumlah), [231]);
  });
});

describe("cariPaguBergantung: ajakan dihitung, bukan ditanam", () => {
  const tangga = bangunTangga(usulan, wilayah, fallback.bobot_resmi);
  const opsi = { langkah: 5 * JT, min: 10 * JT, maks: 800 * JT };

  function cari(pagu: number): number | null {
    const g = cariPaguBergantung(usulan, wilayah, tangga, pagu, opsi);
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
    }
  }

  it("dari Rp 300 juta: Rp 280 juta (bukan 450; temuan yang dicatat di laporan)", () => {
    assert.equal(cari(300 * JT), 280 * JT);
  });

  it("calon yang dikembalikan benar-benar bergantung pada bobot, dan calon yang lebih dekat tidak", () => {
    for (const pagu of [300, 60, 200, 700].map((x) => x * JT)) {
      const hasil = cari(pagu);
      assert.notEqual(hasil, null, `pagu ${pagu / JT}`);
      assert.equal(bergantungPadaBobot(hitungKetahanan(usulan, wilayah, hasil!)), true, `hasil ${hasil! / JT} harus bergantung`);
      const jarak = Math.abs(hasil! - pagu);
      for (const c of calonPagu(tangga, pagu, opsi)) {
        if (Math.abs(c - pagu) < jarak) {
          assert.equal(bergantungPadaBobot(hitungKetahanan(usulan, wilayah, c)), false, `calon ${c / JT} lebih dekat tetapi tidak bergantung`);
        }
      }
    }
  });

  it("satu usulan saja: tidak ada pagu yang bergantung pada bobot, hasilnya null", () => {
    const satu = [usulan[3]];
    const t = bangunTangga(satu, wilayah, fallback.bobot_resmi);
    const g = cariPaguBergantung(satu, wilayah, t, 300 * JT, opsi);
    let r = g.next();
    while (!r.done) r = g.next();
    assert.equal(r.value, null);
  });

  it("calonPagu: terdekat lebih dulu, di dalam rentang, tanpa pagu sekarang, paling banyak batasCalon", () => {
    const calon = calonPagu(tangga, 300 * JT, { ...opsi, batasCalon: 10 });
    assert.ok(calon.length <= 10);
    assert.ok(!calon.includes(300 * JT));
    assert.ok(calon.every((c) => c >= opsi.min && c <= opsi.maks && c % opsi.langkah === 0));
    const jarak = calon.map((c) => Math.abs(c - 300 * JT));
    assert.deepEqual(jarak, [...jarak].sort((a, b) => a - b));
  });
});

describe("kalimatKetahanan", () => {
  it("semua sama", () => {
    assert.equal(
      biasa(kalimatKetahanan(hitungKetahanan(usulan, wilayah, 300 * JT), namaDari)),
      "Pada pagu Rp 300 juta, hasilnya sama untuk 231 dari 231 kombinasi bobot. Rekomendasi ini tidak bergantung pada bobot yang dipilih.",
    );
  });

  it("sebagian: hanya bedanya yang disebut", () => {
    assert.equal(
      biasa(kalimatKetahanan(hitungKetahanan(usulan, wilayah, 450 * JT), namaDari)),
      "Pada pagu Rp 450 juta, bobot menentukan. 133 dari 231 kombinasi membiayai Balai warga dan Jalan SDN 03; 98 lainnya membiayai Talud.",
    );
  });

  it("tiga pilihan", () => {
    assert.equal(
      biasa(kalimatKetahanan(hitungKetahanan(usulan, wilayah, 250 * JT), namaDari)),
      "Pada pagu Rp 250 juta, bobot menentukan. 147 dari 231 kombinasi membiayai Jembatan dan Lampu PJU; 49 lainnya membiayai Jalan SDN 03 dan Lampu PJU; 35 lainnya membiayai Jalan SDN 03 dan Jembatan.",
    );
  });

  it("lebih dari tiga pilihan: tiga teratas disebut, sisanya dihitung", () => {
    const h = {
      pagu: 100 * JT,
      total: 231,
      pilihan: [
        { ids: ["a"], jumlah: 100 },
        { ids: ["b"], jumlah: 60 },
        { ids: ["c"], jumlah: 40 },
        { ids: ["d"], jumlah: 20 },
        { ids: ["e"], jumlah: 11 },
      ],
      perUsulan: {},
    };
    const kalimat = biasa(kalimatKetahanan(h, (id) => id.toUpperCase()));
    assert.match(kalimat, /^Pada pagu Rp 100 juta, bobot menentukan\. 100 dari 231 kombinasi membiayai A; 60 lainnya membiayai B; 40 lainnya membiayai C\./);
    assert.match(kalimat, /2 pilihan lain dihasilkan oleh 31 kombinasi sisanya\.$/);
  });

  it("satu pilihan yang merupakan bagian dari pilihan lain tidak menghasilkan kalimat kosong", () => {
    const h = {
      pagu: 100 * JT,
      total: 231,
      pilihan: [
        { ids: ["a"], jumlah: 200 },
        { ids: ["a", "b"], jumlah: 31 },
      ],
      perUsulan: {},
    };
    assert.equal(
      biasa(kalimatKetahanan(h, (id) => id.toUpperCase())),
      "Pada pagu Rp 100 juta, bobot menentukan. 200 dari 231 kombinasi hanya membiayai yang sama pada semua pilihan; 31 lainnya membiayai B.",
    );
  });

  it("gabungNama", () => {
    assert.equal(gabungNama([]), "");
    assert.equal(gabungNama(["A"]), "A");
    assert.equal(gabungNama(["A", "B"]), "A dan B");
    assert.equal(gabungNama(["A", "B", "C"]), "A, B dan C");
  });
});

describe("S-12 (bagian logika): 16 usulan", () => {
  it("hitungKetahanan jauh lebih cepat daripada 231 x pilihOptimal, dan hasilnya sama", () => {
    const k = kasusAcak(4242, 16);
    const total = k.usulan.reduce((n, u) => n + u.estimatedBudget, 0);
    const pagu = Math.round((total * 0.5) / JT) * JT;

    let t = performance.now();
    const lama = cara_lama(k.usulan, k.wilayah, pagu);
    const msLama = performance.now() - t;
    t = performance.now();
    const baru = cara_baru(k.usulan, k.wilayah, pagu);
    const msBaru = performance.now() - t;

    console.log(`  16 usulan: 231 x pilihOptimal ${Math.round(msLama)} ms; hitungKetahanan ${Math.round(msBaru)} ms`);
    assert.deepEqual(baru, lama);
    assert.ok(msBaru < msLama, "inti baru harus lebih cepat");
  });
});

describe("hitungAwalKetahanan (dihitung di server untuk keadaan resmi)", () => {
  const usulanHitung = usulan.map((u, i) => ({ ...u, dibuat: `2026-11-0${i + 1}T00:00:00.000Z` }));
  const opsi = { langkah: 5 * JT, min: 10 * JT, maks: 800 * JT };

  it("demo pada Rp 300 juta: hasil sama untuk 231 dari 231, dan ajakan Rp 280 juta dihitung", () => {
    const a = hitungAwalKetahanan(usulanHitung, wilayah, 300 * JT, fallback.bobot_resmi, opsi);
    assert.equal(a.ketahanan.pilihan.length, 1);
    assert.equal(a.ajakan, 280 * JT);
    assert.equal(a.kunci, kunciKetahanan(300 * JT, usulanHitung));
    assert.equal(a.kunciAjakan, `${a.kunci}|30-40-30`);
  });

  it("pada pagu yang bobotnya menentukan: tidak ada ajakan (tidak perlu)", () => {
    const a = hitungAwalKetahanan(usulanHitung, wilayah, 450 * JT, fallback.bobot_resmi, opsi);
    assert.equal(a.ketahanan.pilihan.length, 2);
    assert.equal(a.ajakan, null);
  });

  it("kunci berubah bila pagu atau urgensi berubah, tetapi tidak bila hanya urutan bobot yang beda", () => {
    const k = kunciKetahanan(300 * JT, usulanHitung);
    assert.notEqual(k, kunciKetahanan(305 * JT, usulanHitung));
    assert.notEqual(k, kunciKetahanan(300 * JT, usulanHitung.map((u, i) => (i === 0 ? { ...u, urgencyScore: 9 } : u))));
    assert.equal(k, kunciKetahanan(300 * JT, usulanHitung.map((u) => ({ ...u }))));
  });
});

describe("kalimatKetahanan tidak bergantung pada urutan usulan di data", () => {
  it("urutan terbalik atau diacak menghasilkan kalimat yang sama (nama menurut abjad)", () => {
    const acak = [usulan[3], usulan[6], usulan[0], usulan[5], usulan[2], usulan[1], usulan[4]];
    const dasar = kalimatKetahanan(hitungKetahanan(usulan, wilayah, 450 * JT), namaDari);
    for (const urutan of [[...usulan].reverse(), acak]) {
      assert.equal(kalimatKetahanan(hitungKetahanan(urutan, wilayah, 450 * JT), namaDari), dasar);
    }
    assert.equal(
      biasa(dasar),
      "Pada pagu Rp 450 juta, bobot menentukan. 133 dari 231 kombinasi membiayai Balai warga dan Jalan SDN 03; 98 lainnya membiayai Talud.",
    );
  });
});
