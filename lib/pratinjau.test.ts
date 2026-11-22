import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fallback from "./fallback-data.json" with { type: "json" };
import {
  bandingkan,
  hitungPratinjau,
  hitungRekomendasi,
  kalimatPerpindahan,
  labelRw,
  modePaguDari,
  ringkasanBanding,
  terapkanPerubahan,
  type DasarHitung,
  type UsulanHitung,
} from "./pratinjau.ts";

/** rupiah() memakai spasi tak terputus; tes membandingkan dengan spasi biasa supaya mudah dibaca. */
const biasa = (teks: string | null): string => (teks ?? "").replaceAll(" ", " ");

const DIBUAT = "2026-11-08T00:00:00.000Z";

const dasar: DasarHitung = {
  usulan: fallback.usulan_voting.map((u) => ({
    id: u.id,
    title: u.title,
    namaSingkat: u.nama_singkat,
    category: u.category,
    rw: u.rw,
    estimatedBudget: u.estimated_budget,
    voteCount: u.vote_count,
    urgencyScore: u.urgency_score,
    dibuat: DIBUAT,
  })),
  wilayah: fallback.wilayah.map((w) => ({
    rw: w.rw,
    nama: w.nama,
    penduduk: w.penduduk,
    anggaranLalu: w.anggaran_lalu,
  })),
  pagu: 300_000_000,
  bobot: fallback.bobot_resmi,
};

const lampuGang: UsulanHitung = {
  id: "6f1b3d0a-1001-4c8e-9a10-000000000001",
  title: "Lampu jalan gang RW 07 gelap",
  namaSingkat: "Lampu gang",
  category: "infrastruktur",
  rw: 7,
  estimatedBudget: 25_000_000,
  voteCount: 8,
  urgencyScore: 8,
  dibuat: "2026-11-20T00:00:00.000Z",
};

const terpilih = (h: { selected: boolean; namaSingkat: string }[]) =>
  h.filter((x) => x.selected).map((x) => x.namaSingkat).sort();

describe("terapkanPerubahan", () => {
  it("tidak mengubah masukan aslinya", () => {
    const salinan = JSON.stringify(dasar);
    terapkanPerubahan(dasar, { jenis: "pagu", pagu: 1 });
    terapkanPerubahan(dasar, { jenis: "masuk", usulan: lampuGang });
    terapkanPerubahan(dasar, { jenis: "keluar", id: dasar.usulan[0].id });
    assert.equal(JSON.stringify(dasar), salinan);
  });

  it("masuk menambah satu usulan; memasukkan id yang sama dua kali menggantinya", () => {
    const sekali = terapkanPerubahan(dasar, { jenis: "masuk", usulan: lampuGang });
    const dua = terapkanPerubahan(sekali, { jenis: "masuk", usulan: { ...lampuGang, urgencyScore: 3 } });
    assert.equal(sekali.usulan.length, 8);
    assert.equal(dua.usulan.length, 8);
    assert.equal(dua.usulan.find((u) => u.id === lampuGang.id)?.urgencyScore, 3);
  });

  it("keluar membuang usulan itu", () => {
    const baru = terapkanPerubahan(dasar, { jenis: "keluar", id: dasar.usulan[0].id });
    assert.equal(baru.usulan.length, 6);
    assert.ok(!baru.usulan.some((u) => u.id === dasar.usulan[0].id));
  });

  it("urutan masuk mengikuti created_at lalu id, seperti pilih_optimal di SQL", () => {
    const awal: UsulanHitung = { ...lampuGang, id: "a", dibuat: "2026-01-01T00:00:00.000Z" };
    const kembar: UsulanHitung = { ...lampuGang, id: "0", dibuat: DIBUAT };
    const hasil = terapkanPerubahan(dasar, { jenis: "masuk", usulan: awal });
    assert.equal(hasil.usulan[0].id, "a", "yang paling lama dibuat ada di depan");
    const seri = terapkanPerubahan({ ...dasar, usulan: [{ ...dasar.usulan[0], id: "b" }] }, { jenis: "masuk", usulan: kembar });
    assert.deepEqual(seri.usulan.map((u) => u.id), ["0", "b"], "waktu sama: id yang lebih kecil lebih dulu");
  });
});

describe("pratinjau pagu", () => {
  it("pagu yang sama tidak mengubah apa pun", () => {
    const h = hitungPratinjau(dasar, { jenis: "pagu", pagu: dasar.pagu });
    assert.equal(h.banding.berubah.length, 0);
    assert.equal(biasa(h.ringkasan), "Tidak ada usulan yang berubah status.");
    assert.equal(h.perpindahan, null);
  });

  it("pagu lebih besar: Balai warga ikut terbiayai, Gapura ditunda", () => {
    const h = hitungPratinjau(dasar, { jenis: "pagu", pagu: 400_000_000 });
    assert.deepEqual(h.banding.berubah.map((b) => [b.nama, b.sebelum?.status, b.sesudah?.status]), [
      ["Gapura", "tidak-terpilih", "ditunda"],
      ["Balai warga", "tidak-terpilih", "terpilih"],
    ]);
    assert.equal(biasa(h.ringkasan), "2 usulan berubah status. Sisa pagu Rp 15 juta menjadi Rp 5 juta.");
    assert.equal(h.paguSekarang, 300_000_000);
    assert.equal(h.paguSesudah, 400_000_000);
  });

  it("pagu lebih kecil: tiga usulan tidak lagi terbiayai", () => {
    const h = hitungPratinjau(dasar, { jenis: "pagu", pagu: 100_000_000 });
    assert.equal(h.banding.berubah.length, 3);
    assert.ok(h.banding.berubah.every((b) => b.sebelum?.status === "terpilih" && b.sesudah?.status === "tidak-terpilih"));
    assert.equal(h.banding.terbiayaiSebelum, 4);
    assert.equal(h.banding.terbiayaiSesudah, 1);
  });
});

describe("pratinjau bobot", () => {
  it("bobot yang sama tidak mengubah apa pun", () => {
    const h = hitungPratinjau(dasar, { jenis: "bobot", bobot: dasar.bobot });
    assert.equal(h.banding.berubah.length, 0);
    assert.equal(h.banding.tetap.length, 7);
  });

  it("popularitas dominan membangunkan Gapura (RW besar, suara banyak) menjadi ditunda", () => {
    const h = hitungPratinjau(dasar, { jenis: "bobot", bobot: { popularitas: 80, urgensi: 10, pemerataan: 10 } });
    assert.deepEqual(h.banding.berubah.map((b) => [b.nama, b.sesudah?.status]), [["Gapura", "ditunda"]]);
    assert.equal(biasa(h.ringkasan), "1 usulan berubah status. Sisa pagu tetap Rp 15 juta.");
  });

  it("peringkat sebelum dan sesudah diambil dari rekomendasi masing-masing", () => {
    const h = hitungPratinjau(dasar, { jenis: "bobot", bobot: { popularitas: 80, urgensi: 10, pemerataan: 10 } });
    const talud = [...h.banding.berubah, ...h.banding.tetap].find((b) => b.nama === "Talud");
    assert.equal(talud?.sebelum?.peringkat, 1);
    assert.equal(typeof talud?.sesudah?.peringkat, "number");
  });
});

describe("pratinjau perpindahan status", () => {
  it("forum -> voting: kalimat peringkat dan usulan yang bergeser", () => {
    const h = hitungPratinjau(dasar, { jenis: "masuk", usulan: lampuGang });
    assert.equal(h.banding.masuk.length, 1);
    assert.equal(h.banding.masuk[0].nama, "Lampu gang");
    assert.equal(h.banding.masuk[0].sebelum, null);
    assert.equal(h.banding.masuk[0].sesudah?.status, "terpilih");
    assert.equal(
      h.perpindahan,
      "Jika dimasukkan dengan urgensi 8, usulan ini berada di peringkat 3 dari 8 rekomendasi: Terbiayai. Jalan SDN 03 RW 03 bergeser menjadi Tidak terpilih.",
    );
    assert.equal(biasa(h.ringkasan), "1 usulan lain berubah status. Sisa pagu Rp 15 juta menjadi Rp 75 juta.");
  });

  it("usulan yang dimasukkan tidak dihitung sebagai 'berubah'; ia punya kejadian sendiri", () => {
    const h = hitungPratinjau(dasar, { jenis: "masuk", usulan: lampuGang });
    assert.ok(!h.banding.berubah.some((b) => b.id === lampuGang.id));
    assert.equal(h.banding.masuk[0].kejadian, "masuk");
    assert.equal(h.banding.keluar, null);
  });

  it("forum -> voting dengan urgensi rendah: usulan lain ditunda, dua sekaligus dijelaskan", () => {
    const rendah: UsulanHitung = { ...lampuGang, urgencyScore: 2, estimatedBudget: 8_000_000, rw: 1, namaSingkat: "Atap" };
    const h = hitungPratinjau(dasar, { jenis: "masuk", usulan: rendah });
    assert.match(h.perpindahan ?? "", /^Jika dimasukkan dengan urgensi 2, usulan ini berada di peringkat \d+ dari 8 rekomendasi: /);
    assert.match(h.perpindahan ?? "", /Gapura RW 01 bergeser menjadi Ditunda\. Balai warga RW 01 bergeser menjadi Ditunda\./);
  });

  it("voting -> forum: usulan keluar dari hitungan dan sisa pagu bertambah", () => {
    const lampuPju = dasar.usulan.find((u) => u.namaSingkat === "Lampu PJU")!;
    const h = hitungPratinjau(dasar, { jenis: "keluar", id: lampuPju.id });
    assert.equal(h.banding.keluar?.nama, "Lampu PJU");
    assert.equal(h.banding.keluar?.sesudah, null);
    assert.equal(h.banding.keluar?.sebelum?.status, "terpilih");
    assert.equal(h.perpindahan, "Jika dikembalikan ke pembahasan, usulan ini tidak lagi dihitung dalam anggaran.");
    assert.equal(biasa(h.ringkasan), "Tidak ada usulan lain yang berubah status. Sisa pagu Rp 15 juta menjadi Rp 55 juta.");
  });

  it("lebih dari tiga usulan bergeser: tiga disebut, sisanya dihitung", () => {
    const baris = (id: string) => ({
      id,
      nama: id,
      judul: id,
      rw: 1,
      biaya: 1,
      sebelum: { peringkat: 1, status: "terpilih" as const, skor: 1, jumlah: 5 },
      sesudah: { peringkat: 1, status: "ditunda" as const, skor: 1, jumlah: 5 },
      kejadian: "berubah" as const,
    });
    const masuk = { ...baris("m"), sebelum: null, kejadian: "masuk" as const };
    const kalimat = kalimatPerpindahan(
      {
        berubah: ["a", "b", "c", "d", "e"].map(baris),
        tetap: [],
        masuk: [masuk],
        keluar: null,
        sisaSebelum: 0,
        sisaSesudah: 0,
        terbiayaiSebelum: 0,
        terbiayaiSesudah: 0,
      },
      5,
    );
    assert.match(kalimat ?? "", /a RW 01 bergeser menjadi Ditunda\. b RW 01 .* c RW 01 .* 2 usulan lain juga berubah status\.$/);
  });
});

describe("ringkasanBanding", () => {
  it("tidak ada yang berubah", () => {
    const h = hitungPratinjau(dasar, { jenis: "bobot", bobot: dasar.bobot });
    assert.equal(biasa(ringkasanBanding(h.banding)), "Tidak ada usulan yang berubah status.");
  });

  it("status tidak berubah tetapi sisa pagu berubah (pagu naik sedikit)", () => {
    const h = hitungPratinjau(dasar, { jenis: "pagu", pagu: 305_000_000 });
    assert.equal(biasa(h.ringkasan), "Tidak ada usulan yang berubah status. Sisa pagu Rp 15 juta menjadi Rp 20 juta.");
  });
});

describe("kesetaraan dengan pilihOptimal", () => {
  it("'sekarang' pada pratinjau sama dengan hitungRekomendasi pada keadaan awal", () => {
    const h = hitungPratinjau(dasar, { jenis: "pagu", pagu: 400_000_000 });
    const langsung = hitungRekomendasi(dasar);
    assert.deepEqual(
      h.sekarang.terpilih.map((t) => t.nama).sort(),
      terpilih(langsung),
    );
  });

  it("'sesudah' sama dengan hitungRekomendasi pada keadaan yang sudah diubah", () => {
    const h = hitungPratinjau(dasar, { jenis: "bobot", bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 } });
    const langsung = hitungRekomendasi({ ...dasar, bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 } });
    assert.deepEqual(h.sesudah.terpilih.map((t) => t.nama).sort(), terpilih(langsung));
  });

  it("lebih dari 16 usulan melempar RangeError (penanda: pratinjau belum bisa dihitung)", () => {
    const banyak = Array.from({ length: 17 }, (_, i) => ({ ...dasar.usulan[0], id: `u${i}` }));
    assert.throws(() => hitungPratinjau({ ...dasar, usulan: banyak }, { jenis: "pagu", pagu: 1 }), RangeError);
  });
});

describe("bandingkan dan modePaguDari", () => {
  it("batang pagu dibuat dari hasil yang sama dengan halaman utama", () => {
    const hasil = hitungRekomendasi(dasar);
    const mode = modePaguDari(hasil, dasar.wilayah, dasar.pagu);
    assert.equal(mode.kunci, "rekomendasi");
    assert.equal(mode.terpilih.length, 4);
    assert.equal(mode.tata.sisa.rupiah, 15_000_000);
  });

  it("tanpa usulan sama sekali tetap menghasilkan batang kosong, bukan galat", () => {
    const kosong = { ...dasar, usulan: [] };
    const hasil = hitungRekomendasi(kosong);
    const b = bandingkan(kosong, kosong, hasil, hasil);
    assert.equal(b.berubah.length, 0);
    assert.equal(modePaguDari(hasil, dasar.wilayah, dasar.pagu).terpilih.length, 0);
  });

  it("labelRw memberi nol di depan", () => {
    assert.equal(labelRw(7), "RW 07");
    assert.equal(labelRw(12), "RW 12");
  });
});

describe("beberapa usulan masuk sekaligus (simulasi)", () => {
  const atap: UsulanHitung = {
    ...lampuGang,
    id: "6f1b3d0a-1001-4c8e-9a10-000000000003",
    title: "Atap pos ronda RW 01 bocor",
    namaSingkat: "Atap pos",
    rw: 1,
    estimatedBudget: 8_000_000,
    voteCount: 3,
    urgencyScore: 6,
    dibuat: "2026-11-21T00:00:00.000Z",
  };
  const dua = terapkanPerubahan(terapkanPerubahan(dasar, { jenis: "masuk", usulan: lampuGang }), { jenis: "masuk", usulan: atap });

  it("keduanya tercatat, tidak ada yang menimpa yang lain", () => {
    const banding = bandingkan(dasar, dua, hitungRekomendasi(dasar), hitungRekomendasi(dua));
    assert.deepEqual(banding.masuk.map((m) => m.nama).sort(), ["Atap pos", "Lampu gang"]);
    assert.ok(banding.masuk.every((m) => m.kejadian === "masuk" && m.sebelum === null && m.sesudah !== null));
    assert.ok(!banding.berubah.some((b) => b.id === lampuGang.id || b.id === atap.id));
  });

  it("urutan masuk mengikuti peringkat sesudah", () => {
    const banding = bandingkan(dasar, dua, hitungRekomendasi(dasar), hitungRekomendasi(dua));
    const peringkat = banding.masuk.map((m) => m.sesudah!.peringkat);
    assert.deepEqual(peringkat, [...peringkat].sort((a, b) => a - b));
  });

  it("ringkasan menyebut 'lain' dan kalimat perpindahan memuat kedua usulan", () => {
    const banding = bandingkan(dasar, dua, hitungRekomendasi(dasar), hitungRekomendasi(dua));
    assert.match(ringkasanBanding(banding), /usulan lain/);
    const kalimat = kalimatPerpindahan(banding) ?? "";
    assert.match(kalimat, /^Jika dimasukkan, /);
    assert.match(kalimat, /Lampu gang RW 07 berada di peringkat \d+ dari 9 rekomendasi: /);
    assert.match(kalimat, /Atap pos RW 01 berada di peringkat \d+ dari 9 rekomendasi: /);
  });

  it("satu usulan masuk tetap memakai kalimat lama (halaman admin tidak berubah)", () => {
    const satu = terapkanPerubahan(dasar, { jenis: "masuk", usulan: lampuGang });
    const banding = bandingkan(dasar, satu, hitungRekomendasi(dasar), hitungRekomendasi(satu));
    assert.match(kalimatPerpindahan(banding, 8) ?? "", /^Jika dimasukkan dengan urgensi 8, usulan ini berada di peringkat 3 dari 8 rekomendasi: Terbiayai\./);
  });
});
