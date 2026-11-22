import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KODE_BERHASIL, bacaBerhasil, bagianJejak, susunPesanBerhasil, urlBerhasil } from "./admin-pesan.ts";

const ID = "6f1b3d0a-1001-4c8e-9a10-000000000001";

describe("bacaBerhasil", () => {
  it("menerima kode yang dikenal dengan UUID", () => {
    for (const kode of KODE_BERHASIL) assert.deepEqual(bacaBerhasil({ berhasil: kode, id: ID }), { kode, id: ID });
  });

  it("menolak kode asing, UUID rusak, dan yang tidak lengkap", () => {
    assert.equal(bacaBerhasil({ berhasil: "<script>", id: ID }), null);
    assert.equal(bacaBerhasil({ berhasil: "voting", id: "1; drop table" }), null);
    assert.equal(bacaBerhasil({ berhasil: "voting" }), null);
    assert.equal(bacaBerhasil({ id: ID }), null);
    assert.equal(bacaBerhasil({}), null);
  });

  it("parameter berulang: yang pertama dipakai", () => {
    assert.deepEqual(bacaBerhasil({ berhasil: ["tampil", "voting"], id: [ID, "x"] }), { kode: "tampil", id: ID });
  });

  it("hanya kode dari daftar tertutup yang bisa muncul: tidak ada teks dari URL", () => {
    const b = bacaBerhasil({ berhasil: "voting", id: ID, pesan: "Anda menang undian" });
    assert.ok(b && !("pesan" in b));
  });
});

describe("susunPesanBerhasil", () => {
  it("memasukkan ke hitungan anggaran menyebut nama dan kedua tempat jejaknya", () => {
    const p = susunPesanBerhasil({ kode: "voting", id: ID }, "Lampu gang");
    assert.equal(p.ringkas, "“Lampu gang” masuk hitungan anggaran.");
    assert.deepEqual(p.jejak && bagianJejak(p.jejak), ["halaman utama", "riwayat usulan"]);
  });

  it("nama yang tidak ditemukan memakai kata umum, bukan 'null'", () => {
    assert.equal(susunPesanBerhasil({ kode: "kembali", id: ID }, null).ringkas, "Usulan ini kembali ke pembahasan dan tidak lagi dihitung dalam anggaran.");
    assert.equal(susunPesanBerhasil({ kode: "nonaktif", id: ID }, null).ringkas, "Akun ini dinonaktifkan dan keluar dari semua perangkat.");
  });

  it("tidak dilanjutkan menjelaskan bahwa usulan tetap bisa dibaca", () => {
    assert.match(susunPesanBerhasil({ kode: "tidak-dilanjutkan", id: ID }, "Atap").ringkas, /tetap bisa dibaca warga/);
  });

  it("perubahan akun tidak menyebut jejak publik (jejaknya tertutup)", () => {
    assert.equal(susunPesanBerhasil({ kode: "nonaktif", id: ID }, "agus").jejak, null);
    assert.equal(susunPesanBerhasil({ kode: "aktif", id: ID }, "agus").jejak, null);
  });

  it("nama dengan tanda kutip atau markup tetap teks biasa (dirender React sebagai teks)", () => {
    assert.equal(susunPesanBerhasil({ kode: "voting", id: ID }, '<b>"x"</b>').ringkas, '“<b>"x"</b>” masuk hitungan anggaran.');
  });
});

describe("urlBerhasil", () => {
  it("menyusun alamat daftar dengan kode dan id", () => {
    assert.equal(urlBerhasil("/admin/usulan", "voting", ID), `/admin/usulan?berhasil=voting&id=${ID}`);
  });
});
