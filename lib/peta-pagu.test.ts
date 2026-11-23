import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fallback from "./fallback-data.json" with { type: "json" };
import {
  bangunTangga,
  dalamRuas,
  hasilPada,
  kalimatRuas,
  ruasPerUsulan,
  terpilihPada,
  ujungSumbu,
  type Ruas,
} from "./peta-pagu.ts";
import { pilihOptimal, type Bobot, type Usulan, type Wilayah } from "./seleksi.ts";
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
const bobot: Bobot = fallback.bobot_resmi;

const langsung = (u: Usulan[], w: Wilayah[], pagu: number, b: Bobot): string[] =>
  pilihOptimal(u, w, pagu, b)
    .filter((h) => h.selected)
    .map((h) => h.id)
    .sort();

/** Bukti inti: pada pagu ini, tangga memilih persis yang dipilih pilihOptimal. */
function samaDenganPilihOptimal(u: Usulan[], w: Wilayah[], b: Bobot, pagu: number, nama: string) {
  const tangga = bangunTangga(u, w, b);
  assert.deepEqual([...terpilihPada(tangga, pagu)].sort(), langsung(u, w, pagu, b), `${nama}: pagu ${pagu}`);
}

/** "40–65, 110–155, 195+" dalam juta, seperti tabel brief. */
const notasi = (ruas: readonly Ruas[]): string =>
  ruas
    .map((r) => (r.sampai === null ? `${r.dari / JT}+` : r.sampai === r.dari ? `${r.dari / JT}` : `${r.dari / JT}–${r.sampai / JT}`))
    .join(", ");

describe("bangunTangga: bentuk", () => {
  it("titik pertama pagu 0 dengan kombinasi kosong; pagu dan nilai naik ketat", () => {
    const { titik } = bangunTangga(usulan, wilayah, bobot);
    assert.equal(titik[0].pagu, 0);
    assert.equal(titik[0].mask, 0);
    for (let i = 1; i < titik.length; i++) {
      assert.ok(titik[i].pagu > titik[i - 1].pagu, `pagu naik di ${i}`);
      assert.ok(titik[i].nilai > titik[i - 1].nilai, `nilai naik di ${i}`);
    }
  });

  it("tanpa usulan: satu titik kosong, tidak ada galat", () => {
    const tangga = bangunTangga([], wilayah, bobot);
    assert.equal(tangga.titik.length, 1);
    assert.equal(terpilihPada(tangga, 300 * JT).size, 0);
    assert.equal(ruasPerUsulan(tangga, { langkah: 5 * JT, maks: 800 * JT }).size, 0);
  });

  it("pagu di bawah usulan termurah: tidak ada yang terbiayai; pagu negatif juga tidak melempar", () => {
    const tangga = bangunTangga(usulan, wilayah, bobot);
    assert.equal(terpilihPada(tangga, 39 * JT).size, 0);
    assert.equal(terpilihPada(tangga, -1).size, 0);
  });

  it("lebih dari 16 usulan melempar RangeError seperti pilihOptimal", () => {
    const banyak = Array.from({ length: 17 }, (_, i) => ({ ...usulan[0], id: `x${i}` }));
    assert.throws(() => bangunTangga(banyak, wilayah, bobot), RangeError);
  });
});

describe("S-02: tangga sama dengan pilihOptimal", () => {
  it("data demo: di setiap titik tangga, tepat sebelum, dan tepat sesudahnya", () => {
    const { titik } = bangunTangga(usulan, wilayah, bobot);
    assert.ok(titik.length > 10, "demo punya banyak titik tangga");
    for (const t of titik) {
      for (const pagu of [t.pagu - 1, t.pagu, t.pagu + 1]) {
        if (pagu >= 0) samaDenganPilihOptimal(usulan, wilayah, bobot, pagu, "demo");
      }
    }
  });

  it("data demo dengan bobot lain: preset dan tiga sudut", () => {
    const bobotLain: Bobot[] = [
      { popularitas: 100, urgensi: 0, pemerataan: 0 },
      { popularitas: 0, urgensi: 100, pemerataan: 0 },
      { popularitas: 0, urgensi: 0, pemerataan: 100 },
      { popularitas: 10, urgensi: 80, pemerataan: 10 },
      { popularitas: 10, urgensi: 30, pemerataan: 60 },
    ];
    for (const b of bobotLain) {
      for (const t of bangunTangga(usulan, wilayah, b).titik) {
        for (const pagu of [t.pagu - 1, t.pagu]) {
          if (pagu >= 0) samaDenganPilihOptimal(usulan, wilayah, b, pagu, `bobot ${JSON.stringify(b)}`);
        }
      }
    }
  });

  it("60 kasus acak berbenih tetap (1 sampai 12 usulan, dengan seri sengaja)", () => {
    let adaSeri = 0;
    for (let benih = 1; benih <= 60; benih++) {
      const jumlah = 1 + (benih % 12);
      const k = kasusAcak(benih, jumlah);
      const tangga = bangunTangga(k.usulan, k.wilayah, k.bobot);
      for (const t of tangga.titik) {
        for (const pagu of [t.pagu - 1, t.pagu, t.pagu + 1]) {
          if (pagu >= 0) samaDenganPilihOptimal(k.usulan, k.wilayah, k.bobot, pagu, `benih ${benih}`);
        }
      }
      // Seri: dua usulan yang sama persis dalam skor (salinan) ada di kasus ini.
      const skor = new Set(tangga.urutan.map((b) => b.nilai));
      if (skor.size < tangga.urutan.length) adaSeri++;
    }
    assert.ok(adaSeri >= 20, `kasus dengan seri skor: ${adaSeri}`);
  });

  it("biaya sangat besar (ratusan triliun rupiah per usulan) tetap sama dengan pilihOptimal", () => {
    const besar = usulan.slice(0, 4).map((u, i) => ({ ...u, estimatedBudget: (i + 1) * 3e14 }));
    const tangga = bangunTangga(besar, wilayah, bobot);
    for (const t of tangga.titik) {
      for (const pagu of [t.pagu - 1, t.pagu]) {
        if (pagu >= 0) samaDenganPilihOptimal(besar, wilayah, bobot, pagu, "biaya besar");
      }
    }
  });

  it("16 usulan: tangga dibangun cepat dan sama dengan pilihOptimal di titik yang diuji", () => {
    const k = kasusAcak(99, 16);
    const mulai = performance.now();
    const tangga = bangunTangga(k.usulan, k.wilayah, k.bobot);
    const ms = performance.now() - mulai;
    assert.ok(ms < 1500, `bangunTangga 16 usulan ${Math.round(ms)} ms`);
    // pilihOptimal 16 usulan makan ±5 ms per panggilan: periksa sampel titik, bukan semuanya.
    const sampel = tangga.titik.filter((_, i) => i % Math.ceil(tangga.titik.length / 12) === 0);
    for (const t of sampel) samaDenganPilihOptimal(k.usulan, k.wilayah, k.bobot, t.pagu, "16 usulan");
  });
});

describe("S-03: ruas per usulan pada data demo (langkah Rp 5 juta)", () => {
  const tangga = bangunTangga(usulan, wilayah, bobot);
  const ruas = ruasPerUsulan(tangga, { langkah: 5 * JT, maks: 800 * JT });
  const per = (nama: string) => notasi(ruas.get(usulan.find((u) => u.namaSingkat === nama)!.id)!);

  it("angka persis seperti brief", () => {
    assert.equal(per("Talud"), "505+");
    assert.equal(per("Gapura"), "465–500, 685+");
    assert.equal(per("Balai warga"), "395–460, 615–680, 795+");
    assert.equal(per("Jalan SDN 03"), "195, 285+");
    assert.equal(per("Drainase"), "90–105, 130–190, 200+");
    assert.equal(per("Jembatan"), "70–85, 110–125, 160+");
    assert.equal(per("Lampu PJU"), "40–65, 110–155, 195+");
  });

  it("di setiap titik kisi Rp 0 sampai 800 juta, ruas sama dengan pilihOptimal", () => {
    for (let pagu = 0; pagu <= 800 * JT; pagu += 5 * JT) {
      const dariRuas = usulan.filter((u) => dalamRuas(ruas.get(u.id)!, pagu)).map((u) => u.id).sort();
      assert.deepEqual(dariRuas, langsung(usulan, wilayah, pagu, bobot), `pagu ${pagu / JT} juta`);
    }
  });

  it("kasus acak: ruas pada kisi sama dengan pilihOptimal di tiap titik kisi", () => {
    for (let benih = 200; benih < 215; benih++) {
      const k = kasusAcak(benih, 2 + (benih % 7));
      const t = bangunTangga(k.usulan, k.wilayah, k.bobot);
      const total = k.usulan.reduce((n, u) => n + u.estimatedBudget, 0);
      const maks = ujungSumbu(total, 100 * JT, 5 * JT);
      const r = ruasPerUsulan(t, { langkah: 5 * JT, maks });
      for (let pagu = 0; pagu <= maks; pagu += 5 * JT) {
        const dariRuas = k.usulan.filter((u) => dalamRuas(r.get(u.id)!, pagu)).map((u) => u.id).sort();
        assert.deepEqual(dariRuas, langsung(k.usulan, k.wilayah, pagu, k.bobot), `benih ${benih}, pagu ${pagu / JT} juta`);
      }
    }
  });

  it("titik tangga di antara dua titik kisi baru terlihat di titik kisi berikutnya", () => {
    const u: Usulan[] = [
      { ...usulan[0], id: "a", namaSingkat: "A", rw: 1, estimatedBudget: 12_500_000, voteCount: 5, urgencyScore: 8 },
    ];
    const r = ruasPerUsulan(bangunTangga(u, wilayah, bobot), { langkah: 5 * JT, maks: 50 * JT });
    assert.equal(notasi(r.get("a")!), "15+");
  });
});

describe("ujungSumbu", () => {
  it("data demo: total biaya Rp 795 juta dibulatkan ke Rp 800 juta", () => {
    assert.equal(ujungSumbu(795 * JT, 300 * JT, 5 * JT), 800 * JT);
  });
  it("dua kali pagu resmi bila lebih besar dari total biaya, dibulatkan ke kelipatan Rp 50 juta", () => {
    assert.equal(ujungSumbu(100 * JT, 500 * JT, 5 * JT), 1_000 * JT);
    assert.equal(ujungSumbu(100 * JT, 310 * JT, 5 * JT), 650 * JT);
  });
});

describe("kalimatRuas", () => {
  const tangga = bangunTangga(usulan, wilayah, bobot);
  const ruas = ruasPerUsulan(tangga, { langkah: 5 * JT, maks: 800 * JT });
  const dari = (nama: string) => ruas.get(usulan.find((u) => u.namaSingkat === nama)!.id)!;

  it("satu ruas terbuka, belum muat: selisih dari pagu sekarang", () => {
    assert.equal(
      biasa(kalimatRuas("Talud", dari("Talud"), 300 * JT, 800 * JT, false)),
      "Talud baru muat kalau pagunya Rp 505 juta, Rp 205 juta lebih banyak dari pagu sekarang.",
    );
  });

  it("satu ruas terbuka, sudah muat", () => {
    assert.equal(
      biasa(kalimatRuas("Talud", dari("Talud"), 520 * JT, 800 * JT, true)),
      "Talud terbiayai mulai Rp 505 juta dan seterusnya. Pagu Anda sudah sampai di sana.",
    );
  });

  it("terputus: dua ruas, dan tiga ruas", () => {
    assert.equal(
      biasa(kalimatRuas("Gapura", dari("Gapura"), 300 * JT, 800 * JT, false)),
      "Gapura muat pada Rp 465–500 juta, lalu lagi dari Rp 685 juta.",
    );
    assert.equal(
      biasa(kalimatRuas("Balai warga", dari("Balai warga"), 300 * JT, 800 * JT, false)),
      "Balai warga muat pada Rp 395–460 juta, Rp 615–680 juta, lalu lagi dari Rp 795 juta.",
    );
    assert.equal(
      biasa(kalimatRuas("Jalan SDN 03", dari("Jalan SDN 03"), 300 * JT, 800 * JT, true)),
      "Jalan SDN 03 muat pada Rp 195 juta, lalu lagi dari Rp 285 juta.",
    );
  });

  it("satu ruas tertutup, dan tanpa ruas sama sekali", () => {
    assert.equal(
      biasa(kalimatRuas("X", [{ dari: 100 * JT, sampai: 200 * JT }], 150 * JT, 800 * JT, true)),
      "X hanya muat pada Rp 100–200 juta.",
    );
    assert.equal(biasa(kalimatRuas("X", [], 150 * JT, 800 * JT, false)), "X tidak terbiayai pada pagu berapa pun sampai Rp 800 juta.");
  });

  it("pagu diketik di luar kisi: kalimat tidak bertentangan dengan status sebenarnya", () => {
    // Terbiayai pada pagu ini (mis. titik tangga Rp 503,5 juta), padahal ruas dimulai Rp 505 juta.
    assert.equal(
      biasa(kalimatRuas("Talud", [{ dari: 505 * JT, sampai: null }], 504 * JT, 800 * JT, true)),
      "Talud terbiayai di pagu ini dan seterusnya.",
    );
  });
});

describe("hasilPada: hasil lengkap dari tangga sama dengan pilihOptimal", () => {
  it("data demo di berbagai pagu: semua bidang (urutan, peringkat, skor, terpilih, total berjalan) identik", () => {
    const tangga = bangunTangga(usulan, wilayah, bobot);
    for (const pagu of [0, 39 * JT, 40 * JT, 150 * JT, 300 * JT, 505 * JT, 800 * JT, -5]) {
      assert.deepEqual(hasilPada(tangga, pagu), pilihOptimal(usulan, wilayah, pagu, bobot), `pagu ${pagu}`);
    }
  });

  it("40 kasus acak berbenih tetap dengan seri: identik di titik tangga dan di antaranya", () => {
    for (let benih = 300; benih < 340; benih++) {
      const k = kasusAcak(benih, 1 + (benih % 10));
      const tangga = bangunTangga(k.usulan, k.wilayah, k.bobot);
      const total = k.usulan.reduce((n, u) => n + u.estimatedBudget, 0);
      const uji = [0, Math.round(total / 2), total, ...tangga.titik.slice(0, 8).flatMap((t) => [t.pagu - 1, t.pagu])];
      for (const pagu of uji) {
        assert.deepEqual(hasilPada(tangga, pagu), pilihOptimal(k.usulan, k.wilayah, pagu, k.bobot), `benih ${benih}, pagu ${pagu}`);
      }
    }
  });

  it("tanpa usulan: daftar kosong", () => {
    assert.deepEqual(hasilPada(bangunTangga([], wilayah, bobot), 300 * JT), []);
  });
});

describe("bangunTangga dengan batas Pareto: ringkas dan cepat", () => {
  it("16 usulan: titik tangga jauh lebih sedikit dari 65.536 kombinasi, dan dibangun dalam hitungan milidetik", () => {
    const k = kasusAcak(4242, 16);
    const mulai = performance.now();
    const tangga = bangunTangga(k.usulan, k.wilayah, k.bobot);
    const ms = performance.now() - mulai;
    console.log(`  16 usulan: ${tangga.titik.length} titik tangga, ${ms.toFixed(1)} ms`);
    assert.ok(tangga.titik.length < 65_536);
    assert.ok(ms < 100, `bangunTangga 16 usulan ${ms} ms`);
  });

  it("kasus terburuk (nilai sebanding dengan biaya, jadi hampir tak ada yang kalah): tetap benar", () => {
    const sebanding: Usulan[] = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`, title: `S${i}`, namaSingkat: `S${i}`, category: "infrastruktur", rw: 1,
      estimatedBudget: (i + 1) * 7 * JT, voteCount: 5, urgencyScore: 5,
    }));
    const w: Wilayah[] = [{ rw: 1, nama: "RW 01", penduduk: 1000, anggaranLalu: 0 }];
    const b: Bobot = { popularitas: 0, urgensi: 100, pemerataan: 0 };
    const tangga = bangunTangga(sebanding, w, b);
    for (const t of tangga.titik.filter((_, i) => i % 40 === 0)) {
      assert.deepEqual(hasilPada(tangga, t.pagu).filter((h) => h.selected).map((h) => h.id).sort(), langsung(sebanding, w, t.pagu, b));
    }
  });
});
