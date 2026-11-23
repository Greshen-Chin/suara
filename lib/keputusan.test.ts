import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  akibatWilayah,
  alasanWajib,
  bacaDibaca,
  berbedaDariRekomendasi,
  butirUntukServer,
  dibacaDari,
  isiSesuaiRekomendasi,
  jelaskanPerubahan,
  kalimatSejalan,
  penahanPenetapan,
  penjelasanAlasan,
  periksaPilihan,
  ringkasLembar,
  sisaWaktuBatal,
  teksSisaWaktu,
  uraiHitungan,
  type BarisHitungan,
  type HitunganResmi,
  type Isian,
} from "./keputusan.ts";

const JT = 1_000_000;
const ALASAN = "Alasan yang cukup panjang untuk dibaca warga.";

function baris(peringkat: number, nama: string, rw: number, biayaJuta: number, terpilih: boolean, skor = 9): BarisHitungan {
  return {
    peringkat, id: `id-${nama}`, judul: `Judul ${nama}`, namaSingkat: nama, rw, biaya: biayaJuta * JT, dukungan: 10,
    urgensi: 8, skor, status: terpilih ? "terpilih" : "ditunda", terpilih,
  };
}

// Mirip data demo: tiga terpilih (285 juta), dua tidak.
const BARIS = [
  baris(1, "Talud", 7, 220, false, 10),
  baris(2, "Jalan", 3, 85, true, 9.6),
  baris(3, "Drainase", 7, 90, true, 9.2),
  baris(4, "Jembatan", 7, 70, true, 8.8),
  baris(5, "Gapura", 1, 180, false, 6),
];
const PAGU = 300 * JT;

const sejalan = (): Isian =>
  Object.fromEntries(BARIS.map((b) => [b.id, { hasil: b.terpilih ? "disetujui" : "dilanjutkan", alasan: "", sumberDana: "" }])) as Isian;

describe("aturan alasan", () => {
  test("berbeda dari rekomendasi: disetujui padahal tidak terpilih, atau tidak disetujui padahal terpilih", () => {
    assert.equal(berbedaDariRekomendasi("disetujui", true), false);
    assert.equal(berbedaDariRekomendasi("disetujui", false), true);
    for (const h of ["dilanjutkan", "dana_lain", "ditolak"] as const) {
      assert.equal(berbedaDariRekomendasi(h, true), true, `${h} padahal terpilih`);
      assert.equal(berbedaDariRekomendasi(h, false), false, `${h} dan tidak terpilih`);
    }
  });

  test("alasan wajib: selalu untuk ditolak dan dana lain, selain itu hanya bila berbeda", () => {
    assert.equal(alasanWajib("ditolak", false), true);
    assert.equal(alasanWajib("dana_lain", false), true);
    assert.equal(alasanWajib("disetujui", false), true);
    assert.equal(alasanWajib("dilanjutkan", true), true);
    assert.equal(alasanWajib("disetujui", true), false);
    assert.equal(alasanWajib("dilanjutkan", false), false);
  });

  test("penjelasan hanya ada bila alasan wajib, dan tidak memakai kata pengesahan", () => {
    assert.equal(penjelasanAlasan("disetujui", true), null);
    assert.equal(penjelasanAlasan("dilanjutkan", false), null);
    assert.match(penjelasanAlasan("disetujui", false)!, /Berbeda dari rekomendasi, jadi warga perlu tahu alasannya/);
    assert.match(penjelasanAlasan("ditolak", true)!, /selalu butuh alasan/);
    assert.match(penjelasanAlasan("dana_lain", false)!, /sumber dana/);
    for (const h of ["disetujui", "dana_lain", "dilanjutkan", "ditolak"] as const)
      for (const t of [true, false]) assert.doesNotMatch(penjelasanAlasan(h, t) ?? "", /pengesah/i);
  });
});

describe("periksaPilihan", () => {
  const terpilih = { terpilih: true };
  const tidak = { terpilih: false };

  test("baris yang belum dipilih bukan galat", () => {
    assert.deepEqual(periksaPilihan(terpilih, { hasil: null, alasan: "", sumberDana: "" }), {});
  });
  test("sejalan tanpa alasan sah; alasan yang diisi tetap dibatasi 20-500", () => {
    assert.deepEqual(periksaPilihan(terpilih, { hasil: "disetujui", alasan: "", sumberDana: "" }), {});
    assert.ok(periksaPilihan(terpilih, { hasil: "disetujui", alasan: "pendek", sumberDana: "" }).alasan);
    assert.deepEqual(periksaPilihan(terpilih, { hasil: "disetujui", alasan: "a".repeat(20), sumberDana: "" }), {});
    assert.deepEqual(periksaPilihan(terpilih, { hasil: "disetujui", alasan: "a".repeat(500), sumberDana: "" }), {});
    assert.ok(periksaPilihan(terpilih, { hasil: "disetujui", alasan: "a".repeat(501), sumberDana: "" }).alasan);
  });
  test("spasi di tepi tidak dihitung", () => {
    assert.ok(periksaPilihan(tidak, { hasil: "ditolak", alasan: `${" ".repeat(30)}a`, sumberDana: "" }).alasan);
    assert.ok(periksaPilihan(tidak, { hasil: "ditolak", alasan: " ".repeat(30), sumberDana: "" }).alasan);
  });
  test("berbeda dari rekomendasi: alasan wajib", () => {
    assert.ok(periksaPilihan(tidak, { hasil: "disetujui", alasan: "", sumberDana: "" }).alasan);
    assert.ok(periksaPilihan(terpilih, { hasil: "dilanjutkan", alasan: "", sumberDana: "" }).alasan);
    assert.deepEqual(periksaPilihan(terpilih, { hasil: "dilanjutkan", alasan: ALASAN, sumberDana: "" }), {});
  });
  test("dana lain: alasan dan sumber dana 3-80", () => {
    const g = (sumberDana: string, alasan = ALASAN) => periksaPilihan(tidak, { hasil: "dana_lain", alasan, sumberDana });
    assert.ok(g("ab").sumberDana);
    assert.ok(g("").sumberDana);
    assert.equal(g("abc").sumberDana, undefined);
    assert.equal(g("s".repeat(80)).sumberDana, undefined);
    assert.ok(g("s".repeat(81)).sumberDana);
    assert.ok(g("abc", "").alasan);
  });
  test("sumber dana diabaikan untuk hasil lain", () => {
    assert.deepEqual(periksaPilihan(tidak, { hasil: "ditolak", alasan: ALASAN, sumberDana: "x" }), {});
  });
  test("emoji dihitung sebagai satu karakter, seperti char_length di database", () => {
    assert.deepEqual(periksaPilihan(tidak, { hasil: "ditolak", alasan: "😀".repeat(20), sumberDana: "" }), {});
    assert.ok(periksaPilihan(tidak, { hasil: "ditolak", alasan: "😀".repeat(19), sumberDana: "" }).alasan);
  });
});

describe("ringkasLembar", () => {
  test("lembar kosong: semua belum diisi, sisa sama dengan pagu", () => {
    const r = ringkasLembar(BARIS, {}, PAGU);
    assert.equal(r.belumDiisi, 5);
    assert.equal(r.terpakai, 0);
    assert.equal(r.sisa, PAGU);
    assert.equal(r.melebihi, 0);
  });

  test("mengikuti rekomendasi: terpakai 245 juta, sisa 55 juta, tidak ada yang berbeda", () => {
    const r = ringkasLembar(BARIS, sejalan(), PAGU);
    assert.equal(r.disetujui, 3);
    assert.equal(r.dilanjutkan, 2);
    assert.equal(r.terpakai, 245 * JT);
    assert.equal(r.sisa, 55 * JT);
    assert.equal(r.belumDiisi, 0);
    assert.equal(r.berbeda, 0);
    assert.equal(r.galat, 0);
  });

  test("menghitung yang berbeda, dana lain tidak memakai pagu, dan galat isian", () => {
    const isian = sejalan();
    isian["id-Talud"] = { hasil: "dana_lain", alasan: ALASAN, sumberDana: "Dana kebencanaan" };
    isian["id-Gapura"] = { hasil: "disetujui", alasan: "", sumberDana: "" }; // berbeda, tanpa alasan = galat
    const r = ringkasLembar(BARIS, isian, PAGU);
    assert.equal(r.danaLain, 1);
    assert.equal(r.berbeda, 1);
    assert.equal(r.galat, 1);
    assert.equal(r.terpakai, (85 + 90 + 70 + 180) * JT);
    assert.equal(r.melebihi, 125 * JT);
    assert.equal(r.sisa, -125 * JT);
  });

  test("tepat sebesar pagu tidak melebihi", () => {
    const r = ringkasLembar(BARIS, sejalan(), 245 * JT);
    assert.equal(r.melebihi, 0);
    assert.equal(r.sisa, 0);
  });

  test("tanpa usulan sama sekali: tidak ada pembagian nol", () => {
    const r = ringkasLembar([], {}, PAGU);
    assert.deepEqual([r.jumlah, r.terpakai, r.belumDiisi, r.sisa], [0, 0, 0, PAGU]);
  });
});

describe("isiSesuaiRekomendasi", () => {
  test("hanya mengisi yang belum dipilih; yang sudah dipilih tidak disentuh", () => {
    const awal: Isian = { "id-Jalan": { hasil: "ditolak", alasan: ALASAN, sumberDana: "" } };
    const hasil = isiSesuaiRekomendasi(BARIS, awal);
    assert.equal(hasil["id-Jalan"].hasil, "ditolak");
    assert.equal(hasil["id-Jalan"].alasan, ALASAN);
    assert.equal(hasil["id-Talud"].hasil, "dilanjutkan");
    assert.equal(hasil["id-Drainase"].hasil, "disetujui");
    assert.equal(awal["id-Drainase"], undefined, "masukan tidak diubah");
  });
  test("bisa diubah lagi sesudahnya dan mempertahankan teks yang sudah diketik", () => {
    const awal: Isian = { "id-Gapura": { hasil: null, alasan: "teks setengah jadi", sumberDana: "" } };
    const hasil = isiSesuaiRekomendasi(BARIS, awal);
    assert.equal(hasil["id-Gapura"].hasil, "dilanjutkan");
    assert.equal(hasil["id-Gapura"].alasan, "teks setengah jadi");
  });
});

describe("butirUntukServer dan penahanPenetapan", () => {
  test("null selama masih ada baris yang belum dipilih", () => {
    assert.equal(butirUntukServer(BARIS, {}), null);
    const isian = sejalan();
    isian["id-Gapura"] = { hasil: null, alasan: "", sumberDana: "" };
    assert.equal(butirUntukServer(BARIS, isian), null);
  });
  test("alasan dipangkas dan kosong jadi null; sumber dana hanya untuk dana lain", () => {
    const isian = sejalan();
    isian["id-Talud"] = { hasil: "dana_lain", alasan: `  ${ALASAN}  `, sumberDana: " Dana desa " };
    isian["id-Gapura"] = { hasil: "ditolak", alasan: ALASAN, sumberDana: "sisa" };
    const butir = butirUntukServer(BARIS, isian)!;
    assert.equal(butir.length, 5);
    assert.deepEqual(butir.find((b) => b.id === "id-Talud"), { id: "id-Talud", hasil: "dana_lain", alasan: ALASAN, sumber_dana: "Dana desa" });
    assert.equal(butir.find((b) => b.id === "id-Gapura")!.sumber_dana, null);
    assert.equal(butir.find((b) => b.id === "id-Jalan")!.alasan, null);
  });
  test("penahan: nol usulan, melebihi pagu, belum diisi, galat; lalu tidak ada", () => {
    assert.match(penahanPenetapan(ringkasLembar([], {}, PAGU))!, /Tidak ada usulan/);
    assert.match(penahanPenetapan(ringkasLembar(BARIS, {}, PAGU))!, /5 usulan belum dipilih/);
    const lebih = sejalan();
    lebih["id-Gapura"] = { hasil: "disetujui", alasan: ALASAN, sumberDana: "" };
    assert.match(penahanPenetapan(ringkasLembar(BARIS, lebih, PAGU))!, /melebihi pagu sebesar Rp.125.juta/);
    const galat = sejalan();
    galat["id-Gapura"] = { hasil: "ditolak", alasan: "", sumberDana: "" };
    assert.match(penahanPenetapan(ringkasLembar(BARIS, galat, PAGU))!, /1 usulan masih punya isian yang belum sah/);
    assert.equal(penahanPenetapan(ringkasLembar(BARIS, sejalan(), PAGU)), null);
  });
  test("melebihi pagu didahulukan dibanding belum diisi (angkanya yang paling berguna)", () => {
    const isian: Isian = { "id-Gapura": { hasil: "disetujui", alasan: ALASAN, sumberDana: "" }, "id-Talud": { hasil: "disetujui", alasan: ALASAN, sumberDana: "" } };
    assert.match(penahanPenetapan(ringkasLembar(BARIS, isian, PAGU))!, /melebihi pagu/);
  });
});

describe("kalimatSejalan", () => {
  test("sama dengan kalimat yang ditulis SQL", () => {
    assert.equal(kalimatSejalan(BARIS[1], 5), "Mengikuti rekomendasi: peringkat 2 dari 5, skor 9,6.");
    assert.equal(kalimatSejalan(BARIS[4], 5), "Mengikuti rekomendasi: belum terbiayai, peringkat 5 dari 5, skor 6,0.");
    assert.equal(kalimatSejalan({ peringkat: 1, skor: 10, terpilih: true }, 7), "Mengikuti rekomendasi: peringkat 1 dari 7, skor 10,0.");
  });
});

describe("akibatWilayah", () => {
  const WILAYAH = [
    { rw: 1, nama: "RW 01", anggaranLalu: 250 * JT },
    { rw: 3, nama: "RW 03", anggaranLalu: 60 * JT },
    { rw: 7, nama: "RW 07", anggaranLalu: 0 },
  ];
  test("sesudah = biaya yang disetujui per RW; RW tanpa bagian menjadi 0; dana lain tidak dihitung", () => {
    const isian = sejalan();
    isian["id-Talud"] = { hasil: "dana_lain", alasan: ALASAN, sumberDana: "Dana kebencanaan" };
    const a = akibatWilayah(WILAYAH, BARIS, isian);
    assert.deepEqual(a.map((x) => [x.rw, x.sekarang, x.sesudah]), [
      [1, 250 * JT, 0],
      [3, 60 * JT, 85 * JT],
      [7, 0, 160 * JT],
    ]);
  });
  test("belum ada yang disetujui: semua 0", () => {
    assert.ok(akibatWilayah(WILAYAH, BARIS, {}).every((x) => x.sesudah === 0));
  });
});

describe("bentrok", () => {
  const sekarang = (ubah: Partial<HitunganResmi> = {}): HitunganResmi => ({
    sidik: "x", pagu: PAGU, versiBobot: 1, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 },
    usulan: BARIS, ...ubah,
  });

  test("tidak ada yang berubah → tidak ada kalimat", () => {
    assert.deepEqual(jelaskanPerubahan(dibacaDari(sekarang()), sekarang()), []);
  });
  test("pagu, bobot, status, usulan baru, dan usulan yang hilang disebut satu per satu", () => {
    const dibaca = dibacaDari(sekarang());
    const kini = sekarang({
      pagu: 310 * JT,
      versiBobot: 2,
      usulan: [
        { ...BARIS[0], status: "terpilih", terpilih: true },
        ...BARIS.slice(1, 4),
        baris(6, "Lampu", 7, 40, false),
      ],
    });
    const k = jelaskanPerubahan(dibaca, kini).map((x) => x.replaceAll(" ", " "));
    assert.deepEqual(k, [
      "Pagu berubah dari Rp 300 juta menjadi Rp 310 juta.",
      "Bobot penilaian diubah.",
      "Talud sekarang terpilih (tadinya ditunda).",
      "Lampu kini ikut dihitung.",
      "Gapura tidak lagi dihitung.",
    ]);
  });
  test("bacaDibaca menerima bentuk yang benar dan menolak sisanya tanpa melempar", () => {
    const sah = JSON.stringify(dibacaDari(sekarang()));
    assert.deepEqual(bacaDibaca(sah), dibacaDari(sekarang()));
    for (const buruk of [null, undefined, 5, "", "{", "[]", "null", '{"pagu": "x"}', '{"pagu":1,"versiBobot":1,"usulan":[{"id":1}]}',
      '{"pagu":1,"versiBobot":1,"usulan":[{"id":"a","nama":"b","status":"lain"}]}', "x".repeat(30_000)]) {
      assert.equal(bacaDibaca(buruk), null, String(buruk).slice(0, 30));
    }
  });
});

describe("uraiHitungan", () => {
  const mentah = {
    sidik: "abc", pagu: 300_000_000, versi_bobot: 1, jumlah: 1, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 },
    usulan: [{ peringkat: 1, id: "u1", judul: "Judul", nama_singkat: "Singkat", rw: 7, biaya: 70_000_000, dukungan: 5, urgensi: 8, skor: 9.5, status: "terpilih", terpilih: true }],
  };
  test("mengurai jawaban sidik_hitungan", () => {
    const h = uraiHitungan(mentah);
    assert.equal(h.sidik, "abc");
    assert.equal(h.versiBobot, 1);
    assert.deepEqual(h.usulan[0], { peringkat: 1, id: "u1", judul: "Judul", namaSingkat: "Singkat", rw: 7, biaya: 70_000_000, dukungan: 5, urgensi: 8, skor: 9.5, status: "terpilih", terpilih: true });
  });
  test("melempar bila bentuknya tidak cocok", () => {
    assert.throws(() => uraiHitungan(null));
    assert.throws(() => uraiHitungan({ ...mentah, usulan: "x" }));
    assert.throws(() => uraiHitungan({ ...mentah, pagu: "300" }));
    assert.throws(() => uraiHitungan({ ...mentah, usulan: [{ ...mentah.usulan[0], status: "lain" }] }));
  });
});

describe("sisa waktu pembatalan", () => {
  const putus = "2026-11-20T10:00:00.000Z";
  const pada = (jamSetelah: number, menit = 0) => new Date(new Date(putus).getTime() + jamSetelah * 3_600_000 + menit * 60_000);

  test("batas tepat 24 jam", () => {
    assert.equal(sisaWaktuBatal(putus, pada(0)), 24 * 3_600_000);
    assert.equal(sisaWaktuBatal(putus, pada(24)), 0);
    assert.ok(sisaWaktuBatal(putus, pada(25)) < 0);
  });
  test("teks: jam dan menit, menit saja, kurang dari semenit, lewat", () => {
    assert.equal(teksSisaWaktu(sisaWaktuBatal(putus, pada(0, 50))), "tersisa 23 jam 10 menit");
    assert.equal(teksSisaWaktu(sisaWaktuBatal(putus, pada(1))), "tersisa 23 jam");
    assert.equal(teksSisaWaktu(sisaWaktuBatal(putus, pada(23, 48))), "tersisa 12 menit");
    assert.equal(teksSisaWaktu(30_000), "tersisa kurang dari 1 menit");
    assert.equal(teksSisaWaktu(0), "sudah lewat");
    assert.equal(teksSisaWaktu(-5), "sudah lewat");
  });
});
