import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alternatifNama, periksaNamaPengguna, POLA_NAMA_PENGGUNA, saranNamaPengguna } from "./nama-pengguna.ts";

describe("saranNamaPengguna", () => {
  it("huruf kecil, kata digabung titik", () => {
    assert.equal(saranNamaPengguna("Agus Santoso"), "agus.santoso");
    assert.equal(saranNamaPengguna("  Citra   Dewi Lestari "), "citra.dewi.lestari");
  });

  it("aksen dan tanda baca dibuang", () => {
    assert.equal(saranNamaPengguna("Siti Nurhaliza, S.Pd."), "siti.nurhaliza.s.pd");
    assert.equal(saranNamaPengguna("José Ñandú"), "jose.nandu");
  });

  it("hasilnya selalu lolos pola database", () => {
    for (const nama of ["Agus Santoso", "A", "", "!!!", "Ni Luh Putu Ayu Kadek Wulandari Pradnyaswari Surya", "田中 太郎"]) {
      assert.match(saranNamaPengguna(nama), POLA_NAMA_PENGGUNA, `"${nama}"`);
    }
  });

  it("terlalu pendek atau tanpa huruf Latin jatuh ke 'warga'", () => {
    assert.equal(saranNamaPengguna("Al"), "warga");
    assert.equal(saranNamaPengguna("田中 太郎"), "warga");
  });

  it("dipotong di 32 karakter tanpa titik di ujung", () => {
    const saran = saranNamaPengguna("Ni Luh Putu Ayu Kadek Wulandari Pradnyaswari Surya");
    assert.ok(saran.length <= 32);
    assert.doesNotMatch(saran, /[._-]$/);
  });
});

describe("alternatifNama", () => {
  it("menambah angka di belakang", () => {
    assert.equal(alternatifNama("agus.santoso", 2), "agus.santoso2");
    assert.equal(alternatifNama("agus.santoso", 12), "agus.santoso12");
  });

  it("tetap muat dalam 32 karakter", () => {
    const panjang = "a".repeat(32);
    const alt = alternatifNama(panjang, 7);
    assert.equal(alt.length, 32);
    assert.match(alt, POLA_NAMA_PENGGUNA);
    assert.ok(alt.endsWith("7"));
  });
});

describe("periksaNamaPengguna", () => {
  it("nama yang sah", () => {
    for (const n of ["abc", "agus.santoso", "warga-70", "a_b.c-1", "x".repeat(32)]) assert.equal(periksaNamaPengguna(n), null, n);
  });

  it("alasan penolakan yang bisa ditindaklanjuti", () => {
    assert.match(periksaNamaPengguna("") ?? "", /Isi nama pengguna/);
    assert.match(periksaNamaPengguna("ab") ?? "", /minimal 3/);
    assert.match(periksaNamaPengguna("x".repeat(33)) ?? "", /maksimal 32/);
    assert.match(periksaNamaPengguna("Agus") ?? "", /huruf kecil/);
    assert.match(periksaNamaPengguna("agus santoso") ?? "", /Tanpa spasi/);
    assert.match(periksaNamaPengguna("agus@desa") ?? "", /huruf kecil/);
  });

  it("selaras dengan pola yang dipakai database dan formulir masuk", () => {
    assert.equal(POLA_NAMA_PENGGUNA.source, "^[a-z0-9._-]{3,32}$");
  });
});
