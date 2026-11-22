import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_KEMIRIPAN as P,
  alasanKemiripan,
  hitungSkorMirip,
  kataBersama,
  pilihUsulanMirip,
  type KandidatMirip,
} from "./kemiripan.ts";

describe("hitungSkorMirip (mode embedding)", () => {
  it("kosinus di bawah batas bawah: makna 0, hanya lokasi yang tersisa", () => {
    assert.equal(hitungSkorMirip({ kosinus: 0.7, samaRw: false }), 0);
    assert.ok(Math.abs(hitungSkorMirip({ kosinus: 0.7, samaRw: true }) - P.bobotLokasi) < 1e-9);
  });

  it("kosinus di atas batas atas: makna 1", () => {
    assert.ok(Math.abs(hitungSkorMirip({ kosinus: 0.99, samaRw: false }) - P.bobotMakna) < 1e-9);
    assert.ok(Math.abs(hitungSkorMirip({ kosinus: 0.99, samaRw: true }) - 1) < 1e-9);
  });

  it("rumusnya: bobotMakna x makna + bobotLokasi x lokasi", () => {
    const tengah = (P.kosinusBawah + P.kosinusAtas) / 2;
    assert.ok(Math.abs(hitungSkorMirip({ kosinus: tengah, samaRw: true }) - (0.8 * 0.5 + 0.2)) < 1e-9);
  });

  it("RW yang sama menaikkan skor tetapi tidak cukup untuk lolos ambang sendirian", () => {
    assert.ok(hitungSkorMirip({ kosinus: 0.5, samaRw: true }) < P.ambang);
  });

  it("makin mirip, makin tinggi (monoton)", () => {
    let sebelumnya = -1;
    for (let k = 0.7; k <= 1; k += 0.02) {
      const s = hitungSkorMirip({ kosinus: k, samaRw: false });
      assert.ok(s >= sebelumnya);
      sebelumnya = s;
    }
  });
});

describe("hitungSkorMirip (mode cadangan teks)", () => {
  it("memakai trigram judul dan isi, bukan kosinus", () => {
    const tinggi = hitungSkorMirip({ kosinus: null, simJudul: 0.5, simIsi: 0.5, samaRw: false });
    const rendah = hitungSkorMirip({ kosinus: null, simJudul: 0.1, simIsi: 0.1, samaRw: false });
    assert.ok(tinggi > rendah);
    assert.ok(Math.abs(tinggi - P.bobotMakna) < 1e-9);
  });
});

describe("kataBersama", () => {
  it("memilih kata khas yang dipakai kedua usulan, mengabaikan kata umum", () => {
    const k = kataBersama(
      { judul: "Lampu jalan gang RW 07 gelap", deskripsi: "Warga takut lewat malam hari di gang." },
      { title: "Lampu PJU jalan setapak RW 07", description: "Pemasangan lampu penerangan jalan di jalan setapak utama." },
    );
    assert.deepEqual(k, ["jalan", "lampu"]);
  });

  it("tanpa kata bersama menghasilkan daftar kosong", () => {
    assert.deepEqual(
      kataBersama({ judul: "Perpustakaan desa", deskripsi: "Komputer dan internet gratis." }, { title: "Gapura gerbang", description: "Pintu masuk." }),
      [],
    );
  });

  it("angka dan kata pendek tidak dipakai sebagai alasan", () => {
    assert.deepEqual(
      kataBersama({ judul: "RW 07 RT 03", deskripsi: "2026" }, { title: "RW 07 RT 03", description: "2026" }),
      [],
    );
  });
});

describe("alasanKemiripan", () => {
  const baru = { judul: "Lampu jalan gang RW 07 gelap", deskripsi: "Gang gelap malam hari.", rw: 7, kategori: "infrastruktur" };
  const lama = { title: "Lampu PJU jalan setapak RW 07", description: "Lampu penerangan jalan setapak.", rw: 7, category: "infrastruktur" };

  it("menyebut kata yang sama, RW yang sama, dan kategori", () => {
    assert.equal(
      alasanKemiripan({ baru, lama, mode: "ai", makna: 0.9 }),
      "Sama-sama menyebut “jalan” dan “lampu”, di RW yang sama, kategori sama (infrastruktur).",
    );
  });

  it("RW berbeda disebut apa adanya", () => {
    assert.match(alasanKemiripan({ baru: { ...baru, rw: 1 }, lama, mode: "ai", makna: 0.9 }), /di RW 07/);
  });

  it("tanpa kata bersama: mode embedding boleh mengaku maknanya mirip, mode cadangan tidak", () => {
    const beda = { ...lama, title: "Penerangan lorong", description: "Cahaya." };
    const b = { judul: "Kali meluap", deskripsi: "Air masuk pekarangan.", rw: 7, kategori: null };
    assert.match(alasanKemiripan({ baru: b, lama: beda, mode: "ai", makna: 0.8 }), /^Maknanya mirip, meski kata-katanya berbeda/);
    assert.match(alasanKemiripan({ baru: b, lama: beda, mode: "teks", makna: 0.8 }), /^Isinya mirip/);
  });

  it("selalu satu kalimat yang berakhir titik", () => {
    assert.match(alasanKemiripan({ baru, lama, mode: "ai", makna: 0.9 }), /^[^.]+\.$/);
  });
});

describe("pilihUsulanMirip", () => {
  const baru = { judul: "Lampu jalan gang RW 07 gelap", deskripsi: "Gang gelap, warga takut lewat malam.", rw: 7, kategori: "infrastruktur" };
  const k = (id: string, kosinus: number, ubah: Partial<KandidatMirip> = {}): KandidatMirip => ({
    id, title: `Usulan ${id}`, description: "Lampu jalan.", category: "infrastruktur", rw: 7, status: "voting", voteCount: 5, kosinus, ...ubah,
  });

  it("hanya yang melewati ambang, terurut skor, maksimal tiga", () => {
    const hasil = pilihUsulanMirip([k("a", 0.9), k("b", 0.95), k("c", 0.93), k("d", 0.94), k("rendah", 0.84)], baru, "ai");
    assert.deepEqual(hasil.map((h) => h.id), ["b", "d", "c"]);
    assert.ok(hasil[0].skor >= hasil[1].skor);
  });

  it("tidak ada yang mirip menghasilkan daftar kosong", () => {
    assert.deepEqual(pilihUsulanMirip([k("a", 0.82), k("b", 0.86)], baru, "ai"), []);
  });

  it("RW berbeda memerlukan kosinus lebih tinggi", () => {
    const hasil = pilihUsulanMirip([k("sama", 0.9, { rw: 7 }), k("beda", 0.9, { rw: 1 })], baru, "ai");
    assert.deepEqual(hasil.map((h) => h.id), ["sama"]);
  });

  it("skor sama: dukungan lebih banyak didahulukan", () => {
    const hasil = pilihUsulanMirip([k("sedikit", 0.95, { voteCount: 2 }), k("banyak", 0.95, { voteCount: 30 })], baru, "ai");
    assert.deepEqual(hasil.map((h) => h.id), ["banyak", "sedikit"]);
  });

  it("mode cadangan memakai ambang teks dan tidak memakai kosinus", () => {
    const hasil = pilihUsulanMirip(
      [
        { ...k("mirip", 0), kosinus: null, simJudul: 0.5, simIsi: 0.5 },
        { ...k("tidak", 0), kosinus: null, simJudul: 0.1, simIsi: 0.1, rw: 1 },
      ],
      baru,
      "teks",
    );
    assert.deepEqual(hasil.map((h) => h.id), ["mirip"]);
    assert.doesNotMatch(hasil[0].alasan, /Maknanya mirip/);
  });

  it("menyertakan judul, RW, dukungan, dan alasan yang bisa dibaca", () => {
    const [h] = pilihUsulanMirip([k("a", 0.95)], baru, "ai");
    assert.deepEqual([h.judul, h.rw, h.dukungan], ["Usulan a", 7, 5]);
    assert.match(h.alasan, /Sama-sama menyebut/);
  });
});
