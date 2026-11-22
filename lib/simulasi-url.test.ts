import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { semuaKombinasiBobot, tulisBobot } from "./bobot-simulasi.ts";
import { keadaanResmi, samaKeadaan, sisaTempat, type DataSimulasi, type KeadaanSimulasi } from "./simulasi.ts";
import { dataSimulasiCadangan } from "./simulasi-cadangan.ts";
import { bacaKeadaan, tulisKeadaan } from "./simulasi-url.ts";
import { acakBerbenih } from "./uji-acak.ts";

const JT = 1_000_000;
const data: DataSimulasi = dataSimulasiCadangan();
const resmi = keadaanResmi(data);
const [lampu, atap, tong] = ["Lampu gang", "Atap pos ronda", "Tong sampah"].map((n) => data.forum.find((f) => f.namaSingkat === n)!.id);

describe("S-06: tulis lalu baca menghasilkan keadaan yang sama", () => {
  it("keadaan resmi ditulis sebagai alamat polos dan dibaca kembali sebagai resmi", () => {
    assert.equal(tulisKeadaan(resmi, data), "");
    const { keadaan, tidakTersedia, terpotong } = bacaKeadaan("", data);
    assert.ok(samaKeadaan(keadaan, resmi));
    assert.equal(tidakTersedia, 0);
    assert.equal(terpotong, 0);
  });

  it("bentuk yang ditulis: pagu, bobot, lalu tiap usulan tambahan sebagai parameter sendiri", () => {
    const k: KeadaanSimulasi = {
      pagu: 350 * JT,
      bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 },
      tambah: [{ id: lampu, urgensi: 8 }, { id: atap, urgensi: 5 }],
    };
    assert.equal(tulisKeadaan(k, data), `?pagu=350000000&bobot=20-60-20&tambah=${lampu}.8&tambah=${atap}.5`);
  });

  it("nilai yang sama dengan resmi tidak ditulis", () => {
    assert.equal(tulisKeadaan({ ...resmi, pagu: 400 * JT }, data), "?pagu=400000000");
    assert.equal(tulisKeadaan({ ...resmi, bobot: { popularitas: 10, urgensi: 80, pemerataan: 10 } }, data), "?bobot=10-80-10");
    assert.equal(tulisKeadaan({ ...resmi, tambah: [{ id: tong, urgensi: 3 }] }, data), `?tambah=${tong}.3`);
  });

  it("bolak-balik untuk 300 keadaan acak berbenih tetap", () => {
    const acak = acakBerbenih(31);
    const bobot = semuaKombinasiBobot();
    for (let i = 0; i < 300; i++) {
      const forum = data.forum.filter(() => acak() < 0.4);
      const k: KeadaanSimulasi = {
        pagu: acak() < 0.2 ? resmi.pagu : (10 + Math.floor(acak() * 790)) * JT + (acak() < 0.3 ? Math.floor(acak() * 999) * 1000 : 0),
        bobot: acak() < 0.2 ? resmi.bobot : bobot[Math.floor(acak() * bobot.length)],
        tambah: forum.map((f) => ({ id: f.id, urgensi: 1 + Math.floor(acak() * 10) })),
      };
      const dibaca = bacaKeadaan(tulisKeadaan(k, data), data);
      assert.ok(samaKeadaan(dibaca.keadaan, k), `keadaan ke-${i}: ${tulisKeadaan(k, data)}`);
      assert.equal(dibaca.tidakTersedia, 0);
      assert.equal(dibaca.terpotong, 0);
    }
  });

  it("alamat yang ditulis tidak mengandung rahasia atau data pribadi: hanya angka, bobot, dan id usulan", () => {
    const k: KeadaanSimulasi = { pagu: 350 * JT, bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 }, tambah: [{ id: lampu, urgensi: 8 }] };
    assert.match(tulisKeadaan(k, data), /^\?pagu=\d+&bobot=\d+-\d+-\d+&tambah=[0-9a-f-]{36}\.\d+$/);
  });
});

describe("S-06: masukan rusak tidak menggagalkan halaman", () => {
  it("nilai tidak sah diabaikan diam-diam, yang sah tetap dipakai", () => {
    const dibaca = bacaKeadaan(`?pagu=abc&bobot=20-60-30&tambah=bukan-id.5`, data);
    assert.ok(samaKeadaan(dibaca.keadaan, resmi));
    const separuh = bacaKeadaan(`?pagu=abc&bobot=20-60-20`, data);
    assert.equal(separuh.keadaan.pagu, resmi.pagu);
    assert.equal(tulisBobot(separuh.keadaan.bobot), "20-60-20");
  });

  it("pagu di luar batas admin atau bukan angka bulat: diabaikan", () => {
    for (const p of ["9999999", "10000000001", "-5", "1.5e8", "300000000.5", "0x10", "", " 300000000", "٣٠٠"]) {
      assert.equal(bacaKeadaan(`?pagu=${encodeURIComponent(p)}`, data).keadaan.pagu, resmi.pagu, JSON.stringify(p));
    }
    assert.equal(bacaKeadaan("?pagu=10000000", data).keadaan.pagu, 10 * JT);
    assert.equal(bacaKeadaan("?pagu=10000000000", data).keadaan.pagu, 10_000 * JT);
  });

  it("tambahan: id bukan uuid, urgensi di luar 1-10, tanpa titik, dan duplikat diabaikan", () => {
    const sampah = [`${lampu}.0`, `${lampu}.11`, `${lampu}.x`, lampu, `${lampu.slice(1)}.5`, ".5", "", `${lampu}.5.5`];
    for (const s of sampah) {
      const d = bacaKeadaan(`?tambah=${encodeURIComponent(s)}`, data);
      assert.equal(d.keadaan.tambah.length, 0, JSON.stringify(s));
    }
    const dobel = bacaKeadaan(`?tambah=${lampu}.5&tambah=${lampu}.9`, data);
    assert.deepEqual(dobel.keadaan.tambah, [{ id: lampu, urgensi: 5 }]);
  });

  it("daftar dipisah koma dalam satu parameter juga dibaca", () => {
    const d = bacaKeadaan(`?tambah=${lampu}.8,${atap}.5`, data);
    assert.deepEqual(d.keadaan.tambah, [{ id: lampu, urgensi: 8 }, { id: atap, urgensi: 5 }]);
  });

  it("awalan '?' boleh ada atau tidak; teks aneh tidak pernah melempar", () => {
    assert.equal(bacaKeadaan("pagu=400000000", data).keadaan.pagu, 400 * JT);
    assert.equal(bacaKeadaan("?pagu=400000000", data).keadaan.pagu, 400 * JT);
    const aneh = ["%", "%%%", "?&&&", "?=", "?pagu", "?pagu=%E0%A4%A", "?tambah=%00", "?" + "a=1&".repeat(5000), "??pagu=1", "#x", "\u0000", "?bobot=%FF"];
    for (const a of aneh) assert.doesNotThrow(() => bacaKeadaan(a, data), JSON.stringify(a.slice(0, 20)));
    const acak = acakBerbenih(5);
    for (let i = 0; i < 500; i++) {
      const teks = Array.from({ length: 1 + Math.floor(acak() * 60) }, () => String.fromCharCode(Math.floor(acak() * 400))).join("");
      assert.doesNotThrow(() => bacaKeadaan(teks, data));
      assert.doesNotThrow(() => bacaKeadaan(`?${teks}`, data));
    }
  });

  it("hasil bacaan selalu keadaan yang sah: bobot berjumlah 100, pagu dalam batas, tambahan dikenal", () => {
    const acak = acakBerbenih(77);
    for (let i = 0; i < 200; i++) {
      const bagian = [
        acak() < 0.5 ? `pagu=${Math.floor(acak() * 2e10)}` : "",
        acak() < 0.5 ? `bobot=${Math.floor(acak() * 120)}-${Math.floor(acak() * 120)}-${Math.floor(acak() * 120)}` : "",
        acak() < 0.5 ? `tambah=${data.forum[Math.floor(acak() * data.forum.length)].id}.${Math.floor(acak() * 14)}` : "",
      ].filter(Boolean);
      const { keadaan } = bacaKeadaan(bagian.join("&"), data);
      const b = keadaan.bobot;
      assert.equal(b.popularitas + b.urgensi + b.pemerataan, 100);
      assert.ok(keadaan.pagu >= 10 * JT && keadaan.pagu <= 10_000 * JT);
      assert.ok(keadaan.tambah.every((t) => data.forum.some((f) => f.id === t.id) && t.urgensi >= 1 && t.urgensi <= 10));
    }
  });
});

describe("usulan di alamat yang tidak bisa dipakai", () => {
  it("bukan forum lagi (mis. sudah masuk voting) atau tidak dikenal: dihitung agar halaman bisa memberi tahu, tidak dimasukkan", () => {
    const sudahVoting = data.dasar.usulan[0].id;
    const asing = "6f1b3d0a-9999-4c8e-9a10-000000000001";
    const d = bacaKeadaan(`?tambah=${sudahVoting}.5&tambah=${asing}.5&tambah=${lampu}.7`, data);
    assert.equal(d.tidakTersedia, 2);
    assert.deepEqual(d.keadaan.tambah, [{ id: lampu, urgensi: 7 }]);
  });

  it("melebihi tempat yang tersisa (maksimal 16 usulan): yang kelebihan dihitung sebagai terpotong", () => {
    const hampirPenuh: DataSimulasi = {
      ...data,
      dasar: { ...data.dasar, usulan: Array.from({ length: 15 }, (_, i) => ({ ...data.dasar.usulan[i % 7], id: `v${i}` })) },
    };
    assert.equal(sisaTempat(hampirPenuh), 1);
    const d = bacaKeadaan(`?tambah=${lampu}.7&tambah=${atap}.7&tambah=${tong}.7`, hampirPenuh);
    assert.deepEqual(d.keadaan.tambah, [{ id: lampu, urgensi: 7 }]);
    assert.equal(d.terpotong, 2);
    assert.equal(d.tidakTersedia, 0);
  });
});
