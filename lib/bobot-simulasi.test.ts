import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bacaBobotUrl,
  bobotPreset,
  geserBobot,
  jumlahBobot,
  KUNCI_BOBOT,
  PRESET_BOBOT,
  semuaKombinasiBobot,
  tulisBobot,
} from "./bobot-simulasi.ts";
import type { Bobot } from "./seleksi.ts";
import { acakBerbenih } from "./uji-acak.ts";

const resmi: Bobot = { popularitas: 30, urgensi: 40, pemerataan: 30 };

function periksaSah(b: Bobot, konteks: string) {
  assert.equal(jumlahBobot(b), 100, `${konteks}: jumlah ${JSON.stringify(b)}`);
  for (const k of KUNCI_BOBOT) {
    assert.ok(Number.isInteger(b[k]) && b[k] >= 0 && b[k] <= 100, `${konteks}: ${k}=${b[k]}`);
    assert.equal(b[k] % 5, 0, `${konteks}: ${k}=${b[k]} bukan kelipatan 5`);
  }
}

describe("S-05: geserBobot selalu berjumlah 100", () => {
  it("dua lainnya dibagi proporsional dengan sisa terbesar", () => {
    // 50 untuk popularitas: sisa 50 dibagi 40:30 -> 28,57 dan 21,43 -> 30 dan 20.
    assert.deepEqual(geserBobot(resmi, "popularitas", 50), { popularitas: 50, urgensi: 30, pemerataan: 20 });
    assert.deepEqual(geserBobot(resmi, "urgensi", 20), { popularitas: 40, urgensi: 20, pemerataan: 40 });
  });

  it("keduanya nol: dibagi rata, yang pertama menurut urutan kolom mendapat kelebihan", () => {
    const sudut: Bobot = { popularitas: 100, urgensi: 0, pemerataan: 0 };
    assert.deepEqual(geserBobot(sudut, "popularitas", 60), { popularitas: 60, urgensi: 20, pemerataan: 20 });
    assert.deepEqual(geserBobot(sudut, "popularitas", 55), { popularitas: 55, urgensi: 25, pemerataan: 20 });
    // Yang digeser urgensi: dua lainnya adalah popularitas dan pemerataan.
    const u: Bobot = { popularitas: 0, urgensi: 100, pemerataan: 0 };
    assert.deepEqual(geserBobot(u, "urgensi", 55), { popularitas: 25, urgensi: 55, pemerataan: 20 });
  });

  it("digeser ke 100 mengosongkan dua lainnya; digeser ke 0 menyerahkan semuanya", () => {
    assert.deepEqual(geserBobot(resmi, "urgensi", 100), { popularitas: 0, urgensi: 100, pemerataan: 0 });
    assert.deepEqual(geserBobot(resmi, "urgensi", 0), { popularitas: 50, urgensi: 0, pemerataan: 50 });
  });

  it("nilai dibulatkan ke kelipatan 5 dan dijepit 0-100; bukan angka tidak mengubah apa pun", () => {
    assert.equal(geserBobot(resmi, "popularitas", 52).popularitas, 50);
    assert.equal(geserBobot(resmi, "popularitas", 53).popularitas, 55);
    assert.equal(geserBobot(resmi, "popularitas", 130).popularitas, 100);
    assert.equal(geserBobot(resmi, "popularitas", -40).popularitas, 0);
    assert.equal(geserBobot(resmi, "popularitas", Number.NaN), resmi);
    assert.equal(geserBobot(resmi, "popularitas", Number.POSITIVE_INFINITY), resmi);
  });

  it("dari bobot resmi yang bukan kelipatan 5 (mis. 33/33/34), geseran pertama sudah menghasilkan keadaan sah", () => {
    const resmiGanjil: Bobot = { popularitas: 33, urgensi: 33, pemerataan: 34 };
    assert.deepEqual(geserBobot(resmiGanjil, "urgensi", 40), { popularitas: 30, urgensi: 40, pemerataan: 30 });
  });

  it("urutan geseran acak berbenih tetap: 20 urutan x 300 geseran, tidak pernah tidak sah", () => {
    for (let benih = 1; benih <= 20; benih++) {
      const acak = acakBerbenih(benih);
      let b: Bobot = benih % 2 === 0 ? resmi : { popularitas: 33, urgensi: 33, pemerataan: 34 };
      for (let i = 0; i < 300; i++) {
        const kunci = KUNCI_BOBOT[Math.floor(acak() * 3)];
        // Termasuk nilai di luar rentang dan bukan kelipatan 5.
        const nilai = Math.floor(acak() * 150) - 20;
        b = geserBobot(b, kunci, nilai);
        if (i > 0 || benih % 2 === 0) periksaSah(b, `benih ${benih} langkah ${i}`);
      }
    }
  });

  it("bobot yang digeser selalu bernilai yang diminta (setelah pembulatan dan penjepitan)", () => {
    const acak = acakBerbenih(7);
    let b = resmi;
    for (let i = 0; i < 200; i++) {
      const kunci = KUNCI_BOBOT[Math.floor(acak() * 3)];
      const nilai = Math.floor(acak() * 101);
      b = geserBobot(b, kunci, nilai);
      assert.equal(b[kunci], Math.min(100, Math.max(0, Math.round(nilai / 5) * 5)));
    }
  });
});

describe("kombinasi dan preset", () => {
  it("231 kombinasi bobot, semuanya sah dan berbeda; sudut lebih dulu", () => {
    const semua = semuaKombinasiBobot();
    assert.equal(semua.length, 231);
    assert.equal(new Set(semua.map(tulisBobot)).size, 231);
    semua.forEach((b, i) => periksaSah(b, `kombinasi ${i}`));
    assert.deepEqual(
      semua.slice(0, 3).map(tulisBobot).sort(),
      ["0-0-100", "0-100-0", "100-0-0"],
    );
  });

  it("preset: resmi memakai nilai dari database, tiga lainnya sah", () => {
    assert.equal(PRESET_BOBOT.length, 4);
    assert.deepEqual(bobotPreset(PRESET_BOBOT[0], resmi), resmi);
    for (const p of PRESET_BOBOT.slice(1)) periksaSah(bobotPreset(p, resmi), p.kunci);
    assert.deepEqual(
      PRESET_BOBOT.slice(1).map((p) => [p.label, tulisBobot(p.bobot!)]),
      [
        ["Dukungan saja", "100-0-0"],
        ["Keselamatan dulu", "10-80-10"],
        ["Merata dulu", "10-30-60"],
      ],
    );
  });
});

describe("bacaBobotUrl dan tulisBobot", () => {
  it("bolak-balik", () => {
    for (const b of semuaKombinasiBobot()) assert.deepEqual(bacaBobotUrl(tulisBobot(b)), b);
    assert.deepEqual(bacaBobotUrl("33-33-34"), { popularitas: 33, urgensi: 33, pemerataan: 34 });
  });

  it("masukan rusak menghasilkan null, tidak melempar", () => {
    for (const teks of ["", "20-60", "20-60-20-0", "a-b-c", "20-60-21", "-10-60-50", "20,60,20", "20-60-20 ", "1000-0-0", "20--60-20", "２０-６０-２０"]) {
      assert.equal(bacaBobotUrl(teks), null, JSON.stringify(teks));
    }
  });
});
