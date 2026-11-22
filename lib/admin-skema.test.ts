import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BATAS_ADMIN,
  keadaanJumlahBobot,
  periksaAlasanUrgensi,
  periksaBobot,
  periksaNamaSingkat,
  periksaPagu,
  periksaUrgensi,
  sisaUntukUrgensi,
} from "./admin-skema.ts";

describe("periksaPagu", () => {
  it("menerima cara menulis sehari-hari", () => {
    for (const [teks, nilai] of [
      ["300000000", 300_000_000],
      ["300.000.000", 300_000_000],
      ["Rp 300 jt", 300_000_000],
      ["1,5 miliar", 1_500_000_000],
      ["10 juta", 10_000_000],
      ["10 miliar", 10_000_000_000],
    ] as const) {
      assert.deepEqual(periksaPagu(teks), { ok: true, nilai }, teks);
    }
  });

  it("menolak di luar Rp 10 juta sampai Rp 10 miliar dengan petunjuk", () => {
    const kecil = periksaPagu("9,9 juta");
    assert.equal(kecil.ok, false);
    assert.match(kecil.ok ? "" : kecil.pesan, /minimal Rp 10 juta/);
    const besar = periksaPagu("10,1 miliar");
    assert.match(besar.ok ? "" : besar.pesan, /maksimal Rp 10 miliar/);
  });

  it("pesan galat membicarakan pagu, bukan biaya usulan", () => {
    for (const teks of ["", "   ", "banyak sekali", "85,5"]) {
      const h = periksaPagu(teks);
      assert.equal(h.ok, false, teks);
      assert.doesNotMatch(h.ok ? "" : h.pesan, /biaya/i, teks);
    }
  });

  it("batas yang sama dengan check di tabel pengaturan_anggaran", () => {
    assert.deepEqual(BATAS_ADMIN.pagu, { min: 10_000_000, maks: 10_000_000_000 });
  });
});

describe("periksaUrgensi", () => {
  it("menerima bilangan bulat 1 sampai 10, sebagai angka atau teks", () => {
    for (let n = 1; n <= 10; n++) {
      assert.deepEqual(periksaUrgensi(n), { ok: true, nilai: n });
      assert.deepEqual(periksaUrgensi(String(n)), { ok: true, nilai: n });
    }
  });

  it("menolak 0, 11, pecahan, kosong, dan bukan angka", () => {
    for (const v of [0, 11, 5.5, "", "  ", "abc", null, undefined, NaN, "7a"]) {
      assert.equal(periksaUrgensi(v).ok, false, String(v));
    }
  });
});

describe("periksaAlasanUrgensi", () => {
  it("minimal 20 karakter setelah dirapikan", () => {
    assert.equal(periksaAlasanUrgensi("terlalu pendek").ok, false);
    assert.equal(periksaAlasanUrgensi("   " + "x".repeat(19) + "   ").ok, false);
    assert.deepEqual(periksaAlasanUrgensi("  " + "x".repeat(20) + "  "), { ok: true, nilai: "x".repeat(20) });
  });

  it("maksimal 500 karakter", () => {
    assert.equal(periksaAlasanUrgensi("x".repeat(500)).ok, true);
    assert.equal(periksaAlasanUrgensi("x".repeat(501)).ok, false);
  });

  it("menghitung titik kode, bukan unit UTF-16 (emoji satu karakter)", () => {
    assert.equal(periksaAlasanUrgensi("😀".repeat(20)).ok, true);
  });
});

describe("periksaNamaSingkat", () => {
  it("kosong berarti tetap memakai nama yang ada (null)", () => {
    assert.deepEqual(periksaNamaSingkat(""), { ok: true, nilai: null });
    assert.deepEqual(periksaNamaSingkat("   "), { ok: true, nilai: null });
  });

  it("2 sampai 24 karakter", () => {
    assert.equal(periksaNamaSingkat("x").ok, false);
    assert.deepEqual(periksaNamaSingkat("  Lampu   gang "), { ok: true, nilai: "Lampu gang" });
    assert.equal(periksaNamaSingkat("x".repeat(25)).ok, false);
  });
});

describe("periksaBobot", () => {
  const m = (popularitas: string, urgensi: string, pemerataan: string) => ({ popularitas, urgensi, pemerataan });

  it("menerima tiga bilangan bulat yang berjumlah 100", () => {
    assert.deepEqual(periksaBobot(m("30", "40", "30")), { ok: true, nilai: { popularitas: 30, urgensi: 40, pemerataan: 30 } });
    assert.deepEqual(periksaBobot(m("0", "100", "0")), { ok: true, nilai: { popularitas: 0, urgensi: 100, pemerataan: 0 } });
    assert.deepEqual(periksaBobot(m(" 50 ", "25", "25")).ok, true);
  });

  it("jumlah bukan 100 ditolak dengan selisihnya", () => {
    const h = periksaBobot(m("30", "40", "25"));
    assert.equal(h.ok, false);
    assert.match(h.ok ? "" : (h.galat.jumlah ?? ""), /tepat 100, sekarang 95/);
  });

  it("kolom yang salah ditunjuk satu per satu", () => {
    const h = periksaBobot(m("30.5", "", "-5"));
    assert.equal(h.ok, false);
    if (!h.ok) assert.deepEqual(Object.keys(h.galat).sort(), ["pemerataan", "popularitas", "urgensi"]);
  });

  it("di atas 100 atau tiga digit lebih ditolak", () => {
    assert.equal(periksaBobot(m("101", "0", "0")).ok, false);
    assert.equal(periksaBobot(m("1000", "0", "0")).ok, false);
  });
});

describe("keadaanJumlahBobot", () => {
  const m = (popularitas: string, urgensi: string, pemerataan: string) => ({ popularitas, urgensi, pemerataan });

  it("tepat 100: siap disimpan", () => {
    assert.deepEqual(keadaanJumlahBobot(m("30", "40", "30")), { jumlah: 100, kurang: 0, siap: true, teks: "Jumlah 100. Siap disimpan." });
  });

  it("kurang dan lebih disebut dengan angkanya", () => {
    assert.equal(keadaanJumlahBobot(m("30", "35", "30")).teks, "Jumlah 95. Kurang 5.");
    assert.equal(keadaanJumlahBobot(m("30", "45", "30")).teks, "Jumlah 105. Lebih 5.");
    assert.equal(keadaanJumlahBobot(m("30", "35", "30")).siap, false);
  });

  it("kolom kosong atau rusak: tidak pernah siap, meski jumlahnya kebetulan 100", () => {
    const h = keadaanJumlahBobot(m("50", "50", ""));
    assert.equal(h.jumlah, 100);
    assert.equal(h.siap, false);
    assert.match(h.teks, /Isi ketiga kolom/);
  });
});

describe("sisaUntukUrgensi", () => {
  it("100 dikurangi dua kolom lainnya", () => {
    assert.equal(sisaUntukUrgensi({ popularitas: "30", pemerataan: "30" }), 40);
    assert.equal(sisaUntukUrgensi({ popularitas: "100", pemerataan: "0" }), 0);
  });

  it("null bila melebihi 100 atau kolomnya belum valid", () => {
    assert.equal(sisaUntukUrgensi({ popularitas: "70", pemerataan: "40" }), null);
    assert.equal(sisaUntukUrgensi({ popularitas: "", pemerataan: "40" }), null);
  });
});
