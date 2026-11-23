import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashKataSandi,
  perluHashUlang,
  periksaKataSandiBaru,
  verifikasiKataSandi,
} from "./kata-sandi.ts";

describe("hashKataSandi dan verifikasiKataSandi", () => {
  it("format PHC scrypt dengan parameter OWASP", async () => {
    const h = await hashKataSandi("musyawarah-desa-07");
    assert.match(h, /^\$scrypt\$ln=17,r=8,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
  });

  it("kata sandi yang benar cocok, yang salah tidak", async () => {
    const h = await hashKataSandi("musyawarah-desa-07");
    assert.equal(await verifikasiKataSandi("musyawarah-desa-07", h), true);
    assert.equal(await verifikasiKataSandi("musyawarah-desa-08", h), false);
    assert.equal(await verifikasiKataSandi("", h), false);
  });

  it("salt acak: kata sandi sama menghasilkan hash berbeda", async () => {
    const [a, b] = await Promise.all([
      hashKataSandi("sama-persis-123"),
      hashKataSandi("sama-persis-123"),
    ]);
    assert.notEqual(a, b);
    assert.notEqual(a.split("$")[3], b.split("$")[3], "salt harus berbeda");
  });

  it("hash yang diubah sedikit selalu ditolak", async () => {
    const h = await hashKataSandi("musyawarah-desa-07");
    // Ubah karakter di tengah hash (karakter terakhir base64 bisa hanya berisi bit padding).
    const i = h.length - 20;
    const ganti = h[i] === "A" ? "B" : "A";
    const rusak = h.slice(0, i) + ganti + h.slice(i + 1);
    assert.equal(await verifikasiKataSandi("musyawarah-desa-07", rusak), false);
  });

  it("format rusak atau parameter tidak wajar ditolak tanpa error", async () => {
    for (const rusak of ["", "plain", "$scrypt$ln=30,r=8,p=1$AAAA$BBBB", "$bcrypt$xx"]) {
      assert.equal(await verifikasiKataSandi("apa saja", rusak), false);
    }
  });

  it("kata sandi lebih dari 128 karakter tidak diproses", async () => {
    await assert.rejects(hashKataSandi("x".repeat(129)), RangeError);
    const h = await hashKataSandi("musyawarah-desa-07");
    assert.equal(await verifikasiKataSandi("x".repeat(129), h), false);
  });
});

describe("perluHashUlang", () => {
  it("false untuk hash dengan parameter sekarang", async () => {
    assert.equal(perluHashUlang(await hashKataSandi("musyawarah-desa-07")), false);
  });

  it("true untuk parameter lebih lemah atau format asing", () => {
    const lama = `$scrypt$ln=15,r=8,p=1$${"A".repeat(22)}$${"B".repeat(86)}`;
    assert.equal(perluHashUlang(lama), true);
    assert.equal(perluHashUlang("$bcrypt$xx"), true);
  });
});

describe("periksaKataSandiBaru", () => {
  it("menolak yang terlalu pendek atau umum; memuat nama pengguna boleh (sementara)", () => {
    assert.match(periksaKataSandiBaru("pendek", "budi") ?? "", /minimal 8/);
    assert.match(periksaKataSandiBaru("password1", "budi") ?? "", /terlalu umum/);
    assert.equal(periksaKataSandiBaru("budi-rw07-2026", "budi"), null);
  });

  it("menerima kata sandi yang wajar", () => {
    assert.equal(periksaKataSandiBaru("talud tebing aman", "budi"), null);
  });
});
