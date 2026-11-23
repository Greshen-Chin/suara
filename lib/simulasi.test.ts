import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungRekomendasi } from "./pratinjau.ts";
import {
  bandingkanBobot,
  bisaDitambah,
  hitungResmi,
  hitungSimulasi,
  keadaanResmi,
  lepaskan,
  namaSingkatDari,
  rentangPagu,
  ringkasPerRw,
  samaKeadaan,
  sisaTempat,
  susunDasar,
  susunUsulan,
  tambahkan,
  ubahUrgensi,
  type DataSimulasi,
  type KeadaanSimulasi,
} from "./simulasi.ts";
import { bangunTangga } from "./peta-pagu.ts";
import { dataSimulasiCadangan } from "./simulasi-cadangan.ts";

const JT = 1_000_000;
const data: DataSimulasi = dataSimulasiCadangan();
const resmi = hitungResmi(data);
const idForum = (nama: string) => data.forum.find((f) => f.namaSingkat === nama)!.id;
const terbiayai = (h: { selected: boolean; namaSingkat: string }[]) =>
  h.filter((x) => x.selected).map((x) => x.namaSingkat).sort();

describe("S-01: simulasi dengan nilai resmi sama dengan rekomendasi resmi, baris demi baris", () => {
  it("keadaan resmi menghasilkan hasil yang identik dengan hitungRekomendasi(dasar)", () => {
    const h = hitungSimulasi(data, keadaanResmi(data), resmi);
    const langsung = hitungRekomendasi(data.dasar);
    assert.equal(h.hasil.length, langsung.length);
    h.hasil.forEach((baris, i) => {
      assert.equal(baris.id, langsung[i].id, `urutan ${i + 1}`);
      assert.equal(baris.peringkat, langsung[i].peringkat);
      assert.equal(baris.selected, langsung[i].selected);
      assert.equal(baris.skor, langsung[i].skor);
      assert.equal(baris.totalBerjalan, langsung[i].totalBerjalan);
    });
    assert.equal(h.samaDenganResmi, true);
    assert.equal(h.skorBeda, false);
  });

  it("hasil resmi demo: empat terbiayai, sisa Rp 15 juta; tidak ada yang berubah", () => {
    const h = hitungSimulasi(data, keadaanResmi(data), resmi);
    assert.deepEqual(terbiayai(h.hasil), ["Drainase", "Jalan SDN 03", "Jembatan", "Lampu PJU"]);
    assert.equal(h.terbiayai, 4);
    assert.equal(h.sisa, 15 * JT);
    assert.equal(h.jumlah, 7);
    assert.equal(h.banding.berubah.length, 0);
    assert.equal(h.banding.masuk.length, 0);
    assert.equal(h.banding.keluar, null);
  });

  it("hanya pagu atau hanya bobot yang berbeda: tidak lagi sama dengan resmi", () => {
    const paguLain = hitungSimulasi(data, { ...keadaanResmi(data), pagu: 505 * JT }, resmi);
    assert.equal(paguLain.samaDenganResmi, false);
    assert.ok(terbiayai(paguLain.hasil).includes("Talud"));
    const bobotLain = hitungSimulasi(data, { ...keadaanResmi(data), bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } }, resmi);
    assert.equal(bobotLain.samaDenganResmi, false);
    assert.equal(bobotLain.skorBeda, true);
  });
});

describe("hasil simulasi pada angka brief", () => {
  it("Rp 505 juta: Talud terbiayai (langkah kedua di bagian 10 brief)", () => {
    const h = hitungSimulasi(data, { ...keadaanResmi(data), pagu: 505 * JT }, resmi);
    assert.deepEqual(terbiayai(h.hasil), ["Drainase", "Jalan SDN 03", "Jembatan", "Lampu PJU", "Talud"]);
    assert.equal(h.sisa, 0);
  });

  it("pagu lebih kecil dari usulan termurah: tidak ada yang terbiayai, tidak melempar", () => {
    const h = hitungSimulasi(data, { ...keadaanResmi(data), pagu: 30 * JT }, resmi);
    assert.equal(h.terbiayai, 0);
    assert.equal(h.sisa, 30 * JT);
    assert.equal(h.mode.terpilih.length, 0);
  });

  it("pagu memuat semuanya", () => {
    const h = hitungSimulasi(data, { ...keadaanResmi(data), pagu: 800 * JT }, resmi);
    assert.equal(h.terbiayai, 7);
    assert.equal(h.sisa, 5 * JT);
  });

  it("pagu dan bobot berubah bersamaan, dan usulan forum ditambahkan: semuanya ikut dihitung", () => {
    const keadaan: KeadaanSimulasi = {
      pagu: 350 * JT,
      bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 },
      tambah: [{ id: idForum("Lampu gang"), urgensi: 8 }],
    };
    const h = hitungSimulasi(data, keadaan, resmi);
    const langsung = hitungRekomendasi(susunDasar(data, keadaan));
    assert.deepEqual(h.hasil.map((x) => [x.id, x.selected]), langsung.map((x) => [x.id, x.selected]));
    assert.equal(h.jumlah, 8);
    assert.equal(h.dasar.pagu, 350 * JT);
    assert.deepEqual(h.dasar.bobot, keadaan.bobot);
  });
});

describe("S-07: beberapa usulan forum ditambahkan sekaligus", () => {
  const keadaan = ["Lampu gang", "Atap pos ronda", "Tong sampah"].reduce(
    (k, nama, i) => tambahkan(data, k, idForum(nama), [8, 6, 4][i]),
    keadaanResmi(data),
  );

  it("semuanya masuk daftar dengan urgensinya masing-masing", () => {
    assert.equal(keadaan.tambah.length, 3);
    const dasar = susunDasar(data, keadaan);
    assert.equal(dasar.usulan.length, 10);
    for (const [nama, urgensi] of [["Lampu gang", 8], ["Atap pos ronda", 6], ["Tong sampah", 4]] as const) {
      assert.equal(dasar.usulan.find((u) => u.id === idForum(nama))?.urgencyScore, urgensi, nama);
    }
  });

  it("semuanya tampil sebagai 'masuk' di perbandingan; tidak ada yang menimpa yang lain", () => {
    const h = hitungSimulasi(data, keadaan, resmi);
    assert.deepEqual(h.banding.masuk.map((m) => m.nama).sort(), ["Atap pos ronda", "Lampu gang", "Tong sampah"]);
    assert.ok(h.banding.masuk.every((m) => m.sesudah !== null && m.sebelum === null));
    assert.equal(h.jumlah, 10);
    for (const m of h.banding.masuk) assert.equal(h.posisi.get(m.id)?.jumlah, 10);
  });

  it("urutan penambahan tidak mengubah hasil (urutan seri mengikuti created_at, bukan urutan klik)", () => {
    const balik = ["Tong sampah", "Atap pos ronda", "Lampu gang"].reduce(
      (k, nama, i) => tambahkan(data, k, idForum(nama), [4, 6, 8][i]),
      keadaanResmi(data),
    );
    const a = hitungSimulasi(data, keadaan, resmi).hasil.map((x) => [x.id, x.peringkat, x.selected]);
    const b = hitungSimulasi(data, balik, resmi).hasil.map((x) => [x.id, x.peringkat, x.selected]);
    assert.deepEqual(a, b);
  });

  it("menambah, mengubah urgensi, dan melepas", () => {
    const k1 = tambahkan(data, keadaanResmi(data), idForum("Lampu gang"), 8);
    assert.equal(k1.tambah.length, 1);
    const k2 = ubahUrgensi(k1, idForum("Lampu gang"), 3);
    assert.equal(k2.tambah[0].urgensi, 3);
    assert.equal(lepaskan(k2, idForum("Lampu gang")).tambah.length, 0);
    assert.ok(samaKeadaan(lepaskan(k2, idForum("Lampu gang")), keadaanResmi(data)));
  });

  it("menolak: id tidak dikenal, sudah ditambahkan, urgensi di luar 1-10 atau bukan bilangan bulat", () => {
    const k = keadaanResmi(data);
    assert.equal(tambahkan(data, k, "bukan-id", 5), k);
    const sekali = tambahkan(data, k, idForum("Lampu gang"), 5);
    assert.equal(tambahkan(data, sekali, idForum("Lampu gang"), 7), sekali);
    for (const u of [0, 11, 5.5, Number.NaN, -1]) assert.equal(tambahkan(data, k, idForum("Atap pos ronda"), u), k, `urgensi ${u}`);
    assert.equal(ubahUrgensi(sekali, idForum("Lampu gang"), 11), sekali);
  });

  it("batas 16 usulan: tempat habis, tambahan ditolak", () => {
    assert.equal(sisaTempat(data), 9);
    // Data dengan 14 usulan voting: hanya dua tempat tersisa.
    const hampirPenuh: DataSimulasi = {
      ...data,
      dasar: { ...data.dasar, usulan: Array.from({ length: 14 }, (_, i) => ({ ...data.dasar.usulan[i % 7], id: `v${i}`, dibuat: `2026-11-0${(i % 9) + 1}T00:00:00.000Z` })) },
    };
    assert.equal(sisaTempat(hampirPenuh), 2);
    let k = keadaanResmi(hampirPenuh);
    for (const nama of ["Lampu gang", "Atap pos ronda", "Tong sampah"]) k = tambahkan(hampirPenuh, k, idForum(nama), 5);
    assert.equal(k.tambah.length, 2, "yang ketiga ditolak");
    assert.doesNotThrow(() => hitungSimulasi(hampirPenuh, k, hitungResmi(hampirPenuh)));
    assert.equal(sisaTempat({ ...hampirPenuh, dasar: { ...hampirPenuh.dasar, usulan: [...hampirPenuh.dasar.usulan, ...hampirPenuh.dasar.usulan.slice(0, 2)] } }), 0);
  });

  it("bisaDitambah tidak memuat yang sudah ditambahkan", () => {
    const k = tambahkan(data, keadaanResmi(data), idForum("Lampu gang"), 5);
    assert.equal(bisaDitambah(data, k).length, data.forum.length - 1);
    assert.ok(!bisaDitambah(data, k).some((f) => f.id === idForum("Lampu gang")));
  });

  it("susunDasar tidak mengubah data aslinya dan melewati tambahan yang tidak dikenal", () => {
    const salinan = JSON.stringify(data);
    susunDasar(data, { ...keadaanResmi(data), tambah: [{ id: "tidak-ada", urgensi: 5 }, { id: idForum("Lampu gang"), urgensi: 5 }] });
    assert.equal(JSON.stringify(data), salinan);
    assert.equal(susunDasar(data, { ...keadaanResmi(data), tambah: [{ id: "tidak-ada", urgensi: 5 }] }).usulan.length, 7);
  });
});

describe("ringkasPerRw: siapa yang kebagian", () => {
  it("rekomendasi resmi demo: RW 07 mendapat Rp 200 juta, RW 03 Rp 85 juta, RW 01 tidak kebagian", () => {
    const baris = ringkasPerRw(data.dasar.wilayah, resmi.hasil);
    const rw = (n: number) => baris.find((b) => b.rw === n)!;
    assert.equal(rw(7).rupiah, 200 * JT);
    assert.equal(rw(7).jumlah, 3);
    assert.equal(rw(7).perPenduduk, 500_000);
    assert.equal(rw(3).rupiah, 85 * JT);
    assert.equal(rw(3).jumlah, 1);
    assert.equal(rw(3).perPenduduk, 42_500);
    assert.equal(rw(1).rupiah, 0);
    assert.equal(rw(1).jumlah, 0);
    assert.equal(rw(1).perPenduduk, 0);
  });

  it("jumlahnya sama dengan total biaya yang terbiayai; RW tanpa usulan tetap muncul; penduduk nol tidak membagi nol", () => {
    const baris = ringkasPerRw([...data.dasar.wilayah, { rw: 9, nama: "RW 09", penduduk: 0, anggaranLalu: 0 }], resmi.hasil);
    assert.equal(baris.length, 4);
    assert.equal(baris.reduce((n, b) => n + b.rupiah, 0), 285 * JT);
    assert.equal(baris[3].perPenduduk, 0);
    assert.ok(baris.every((b) => Number.isFinite(b.perPenduduk)));
  });
});

describe("namaSingkatDari", () => {
  it("memakai nama singkat bila ada; judul pendek apa adanya; judul panjang dipotong di batas kata", () => {
    assert.equal(namaSingkatDari("Lampu gang", "Lampu jalan gang RW 07 gelap"), "Lampu gang");
    assert.equal(namaSingkatDari(null, "Atap pos ronda"), "Atap pos ronda");
    assert.equal(namaSingkatDari("  ", "Atap pos ronda"), "Atap pos ronda");
    const panjang = namaSingkatDari(null, "Pelatihan menjahit untuk ibu rumah tangga di balai desa");
    assert.ok(panjang.length <= 25 && panjang.endsWith("…"), panjang);
    assert.equal(panjang, "Pelatihan menjahit untuk…");
  });
});

describe("rentangPagu dan bandingkanBobot", () => {
  it("demo: dari Rp 10 juta sampai Rp 800 juta, langkah Rp 5 juta", () => {
    assert.deepEqual(rentangPagu(data.dasar.usulan, data.dasar.pagu), { langkah: 5 * JT, min: 10 * JT, maks: 800 * JT });
  });

  it("usulan forum andaian memperbesar total biaya dan bisa menggeser ujung sumbu", () => {
    const k = tambahkan(data, keadaanResmi(data), idForum("Lampu gang"), 8);
    // 795 + 25 = 820 juta -> dibulatkan ke atas ke kelipatan Rp 50 juta.
    assert.equal(rentangPagu(susunUsulan(data, k.tambah), data.dasar.pagu).maks, 850 * JT);
  });

  it("dua kali pagu resmi dipakai bila lebih besar dari total biaya", () => {
    const sedikit = data.dasar.usulan.slice(0, 2);
    assert.equal(rentangPagu(sedikit, 500 * JT).maks, 1_000 * JT);
  });

  it("bobot sama dengan resmi: tidak ada yang berubah karena bobot", () => {
    const h = hitungSimulasi(data, keadaanResmi(data), resmi);
    const b = bandingkanBobot(data, h.dasar, h.hasil);
    assert.equal(b.banding.berubah.length, 0);
    assert.equal(b.skorBeda, false);
  });

  it("hanya bobot yang dibandingkan: pagu dan usulan andaian dipertahankan di kedua sisi", () => {
    const k: KeadaanSimulasi = {
      pagu: 450 * JT,
      bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 },
      tambah: [{ id: idForum("Lampu gang"), urgensi: 8 }],
    };
    const h = hitungSimulasi(data, k, resmi);
    const b = bandingkanBobot(data, h.dasar, h.hasil);
    // Usulan andaian ada di kedua sisi, jadi bukan "masuk"; pagu sama di kedua sisi.
    assert.equal(b.banding.masuk.length, 0);
    assert.equal(b.skorBeda, true);
    // Terhadap resmi, usulan andaian adalah 'masuk'; terhadap bobot resmi saja, bukan.
    assert.equal(h.banding.masuk.length, 1);
  });

  it("pagu 300 juta, bobot 100/0/0: Gapura dan Balai warga menjadi Ditunda karena bobot (contoh brief)", () => {
    const k: KeadaanSimulasi = { ...keadaanResmi(data), bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } };
    const h = hitungSimulasi(data, k, resmi);
    const b = bandingkanBobot(data, h.dasar, h.hasil);
    assert.deepEqual(b.banding.berubah.map((x) => [x.nama, x.sebelum?.status, x.sesudah?.status]).sort(), [
      ["Balai warga", "tidak-terpilih", "ditunda"],
      ["Gapura", "tidak-terpilih", "ditunda"],
    ]);
  });
});

describe("hitungSimulasi dengan tangga sama dengan tanpa tangga (pilihOptimal)", () => {
  const kasus: KeadaanSimulasi[] = [
    keadaanResmi(data),
    { ...keadaanResmi(data), pagu: 505 * JT },
    { ...keadaanResmi(data), pagu: 30 * JT },
    { ...keadaanResmi(data), pagu: 800 * JT, bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } },
    { pagu: 450 * JT, bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 }, tambah: [{ id: idForum("Lampu gang"), urgensi: 8 }, { id: idForum("Atap pos ronda"), urgensi: 3 }] },
  ];

  it("semua bidang hasil identik, termasuk perbandingan dan per RW", () => {
    for (const k of kasus) {
      const usulan = susunUsulan(data, k.tambah);
      const tangga = bangunTangga(usulan, data.dasar.wilayah, k.bobot);
      const a = hitungSimulasi(data, k, resmi, tangga);
      const b = hitungSimulasi(data, k, resmi);
      assert.deepEqual(a.hasil, b.hasil);
      assert.deepEqual(a.banding, b.banding);
      assert.deepEqual(a.mode, b.mode);
      assert.deepEqual([...a.posisi], [...b.posisi]);
      assert.equal(a.sisa, b.sisa);
      assert.equal(a.skorBeda, b.skorBeda);
    }
  });

  it("bandingkanBobot dengan tangga patokan sama dengan tanpa tangga", () => {
    for (const k of kasus) {
      const h = hitungSimulasi(data, k, resmi);
      const usulan = susunUsulan(data, k.tambah);
      const tanggaPatokan = bangunTangga(usulan, data.dasar.wilayah, data.dasar.bobot);
      assert.deepEqual(bandingkanBobot(data, h.dasar, h.hasil, tanggaPatokan), bandingkanBobot(data, h.dasar, h.hasil));
    }
  });
});
