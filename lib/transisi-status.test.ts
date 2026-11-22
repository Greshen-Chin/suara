import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LABEL_TRANSISI,
  adalahStatusTujuan,
  bolehPindah,
  keteranganTanpaAksi,
  teksStatusAdmin,
  transisiTersedia,
} from "./transisi-status.ts";

describe("transisi yang tersedia di halaman admin", () => {
  it("forum: masuk hitungan anggaran atau tidak dilanjutkan", () => {
    assert.deepEqual([...transisiTersedia("forum")].sort(), ["rejected", "voting"]);
  });

  it("voting: hanya kembali ke pembahasan", () => {
    assert.deepEqual(transisiTersedia("voting"), ["forum"]);
  });

  it("penetapan hasil musyawarah SENGAJA tidak ada: voting -> approved/rejected, approved -> done", () => {
    assert.equal(bolehPindah("voting", "approved"), false);
    assert.equal(bolehPindah("voting", "rejected"), false);
    assert.equal(bolehPindah("approved", "done"), false);
    assert.deepEqual(transisiTersedia("approved"), []);
    assert.deepEqual(transisiTersedia("done"), []);
    assert.deepEqual(transisiTersedia("rejected"), []);
  });

  it("forum -> approved atau done ditolak", () => {
    assert.equal(bolehPindah("forum", "approved"), false);
    assert.equal(bolehPindah("forum", "done"), false);
    assert.equal(bolehPindah("forum", "forum"), false);
  });

  it("status yang tidak dikenal tidak punya perpindahan", () => {
    assert.deepEqual(transisiTersedia("entah"), []);
    assert.equal(bolehPindah("entah", "voting"), false);
  });

  it("adalahStatusTujuan hanya mengenal tiga tujuan", () => {
    assert.equal(adalahStatusTujuan("voting"), true);
    assert.equal(adalahStatusTujuan("forum"), true);
    assert.equal(adalahStatusTujuan("rejected"), true);
    assert.equal(adalahStatusTujuan("approved"), false);
    assert.equal(adalahStatusTujuan(undefined), false);
  });
});

describe("teks", () => {
  it("setiap tujuan punya label tombol", () => {
    assert.equal(LABEL_TRANSISI.voting, "Masukkan ke hitungan anggaran");
    assert.equal(LABEL_TRANSISI.rejected, "Tidak dilanjutkan");
    assert.equal(LABEL_TRANSISI.forum, "Kembalikan ke pembahasan");
  });

  it("keterangan tanpa aksi menjelaskan alasannya, termasuk yang tersembunyi", () => {
    assert.match(keteranganTanpaAksi("forum", true), /Tampilkan kembali dulu di Moderasi/);
    assert.match(keteranganTanpaAksi("approved", false), /halaman Keputusan/);
    assert.match(keteranganTanpaAksi("rejected", false), /tidak dilanjutkan/);
  });

  it("rejected tanpa urgensi dibaca 'Tidak dilanjutkan'; yang pernah dinilai tetap 'Ditolak'", () => {
    assert.equal(teksStatusAdmin("rejected", null), "Tidak dilanjutkan");
    assert.equal(teksStatusAdmin("rejected", 7), undefined);
    assert.equal(teksStatusAdmin("forum", null), undefined);
  });
});
