import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { amankanTujuan } from "./tujuan.ts";

describe("amankanTujuan", () => {
  it("menerima jalur di situs ini", () => {
    assert.equal(amankanTujuan("/akun"), "/akun");
    assert.equal(amankanTujuan("/keputusan?tahun=2026#atas"), "/keputusan?tahun=2026#atas");
  });

  it("menolak alamat situs lain dan trik penulisannya", () => {
    for (const jahat of [
      "https://jahat.example",
      "//jahat.example",
      "/\\jahat.example",
      "\\\\jahat.example",
      "/\tjahat.example",
      "/\r\nSet-Cookie:x",
      "javascript:alert(1)",
      "jahat.example",
    ]) {
      assert.equal(amankanTujuan(jahat), "/akun", JSON.stringify(jahat));
    }
  });

  it("karakter ter-encode tetap jalur di situs ini, tidak bisa keluar", () => {
    assert.equal(amankanTujuan("/%0d%0aSet-Cookie:x"), "/%0d%0aSet-Cookie:x");
    assert.equal(amankanTujuan("/%2F%2Fjahat.example"), "/%2F%2Fjahat.example");
  });

  it("nilai kosong, bukan teks, atau halaman masuk kembali ke bawaan", () => {
    assert.equal(amankanTujuan(null), "/akun");
    assert.equal(amankanTujuan(""), "/akun");
    assert.equal(amankanTujuan("/masuk"), "/akun");
    assert.equal(amankanTujuan("/masuk", "/"), "/");
  });
});
