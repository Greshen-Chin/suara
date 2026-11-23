import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungResmi, hitungSimulasi, keadaanResmi, tambahkan, type DataSimulasi, type KeadaanSimulasi } from "./simulasi.ts";
import { dataSimulasiCadangan } from "./simulasi-cadangan.ts";
import { kalimatPosisiAndaian, kalimatYangBerubah, ringkasHasil, ringkasMenempel } from "./simulasi-kalimat.ts";

const JT = 1_000_000;
const biasa = (teks: string): string => teks.replaceAll(" ", " ");
const data: DataSimulasi = dataSimulasiCadangan();
const resmi = hitungResmi(data);
const r = keadaanResmi(data);

function berubah(k: KeadaanSimulasi): string[] {
  const h = hitungSimulasi(data, k, resmi);
  const bobotBeda = k.bobot.popularitas !== r.bobot.popularitas || k.bobot.urgensi !== r.bobot.urgensi || k.bobot.pemerataan !== r.bobot.pemerataan;
  return kalimatYangBerubah(h.banding, { bobotBeda, skorBeda: h.skorBeda }).map(biasa);
}

describe("ringkasHasil dan ringkasMenempel", () => {
  it("empat keadaan: sebagian, tidak ada yang muat, semuanya, dan nol usulan", () => {
    assert.equal(biasa(ringkasHasil({ jumlah: 7, terbiayai: 4, sisa: 15 * JT })), "4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta.");
    assert.equal(biasa(ringkasHasil({ jumlah: 7, terbiayai: 0, sisa: 30 * JT })), "Belum ada usulan yang muat.");
    assert.equal(biasa(ringkasHasil({ jumlah: 7, terbiayai: 7, sisa: 5 * JT })), "Semua usulan terbiayai, sisa Rp 5 juta.");
    assert.equal(biasa(ringkasHasil({ jumlah: 0, terbiayai: 0, sisa: 0 })), "Belum ada usulan dalam hitungan anggaran.");
  });

  it("bilah menempel di ponsel memakai bentuk dari brief", () => {
    assert.equal(biasa(ringkasMenempel(300 * JT, { terbiayai: 4, sisa: 15 * JT })), "Rp 300 juta · 4 terbiayai · sisa Rp 15 juta");
  });
});

describe("kalimatYangBerubah: tidak pernah diam", () => {
  it("bobot 100/0/0 pada Rp 300 juta: yang terbiayai sama, Gapura dan Balai warga menjadi Ditunda (contoh brief)", () => {
    const k = berubah({ ...r, bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } });
    assert.equal(k[0], "2 usulan berubah status. Sisa pagu tetap Rp 15 juta.");
    assert.equal(k[1], "Usulan yang terbiayai sama dengan rekomendasi resmi.");
    assert.equal(k[2], "Gapura RW 01 dan Balai warga RW 01 berubah dari Tidak terpilih menjadi Ditunda.");
    assert.ok(k.includes("Talud RW 07 turun dari peringkat 1 ke 2, tetapi tetap ditunda."));
    assert.ok(k.includes("Drainase RW 07 turun dari peringkat 2 ke 3, tetapi tetap terbiayai."));
  });

  it("bobot 10/80/10: tidak ada status yang berubah, tetapi peringkat disebut", () => {
    const k = berubah({ ...r, bobot: { popularitas: 10, urgensi: 80, pemerataan: 10 } });
    assert.deepEqual(k, [
      "Tidak ada usulan yang berubah status.",
      "Usulan yang terbiayai sama dengan rekomendasi resmi.",
      "Jalan SDN 03 RW 03 naik dari peringkat 5 ke 4, tetapi tetap terbiayai.",
      "Lampu PJU RW 07 turun dari peringkat 4 ke 5, tetapi tetap terbiayai.",
    ]);
  });

  it("bobot 10/30/60: urutan dan status sama, hanya skor yang berubah; kalimat tetap menyebutnya", () => {
    const k = berubah({ ...r, bobot: { popularitas: 10, urgensi: 30, pemerataan: 60 } });
    assert.deepEqual(k, [
      "Tidak ada usulan yang berubah status.",
      "Bobot yang berbeda mengubah skor, tetapi urutan dan status tiap usulan sama.",
    ]);
  });

  it("pagu saja berubah: status bergeser, peringkat tidak", () => {
    assert.deepEqual(berubah({ ...r, pagu: 450 * JT }), [
      "2 usulan berubah status. Sisa pagu Rp 15 juta menjadi Rp 55 juta.",
      "Gapura RW 01 berubah dari Tidak terpilih menjadi Ditunda.",
      "Balai warga RW 01 berubah dari Tidak terpilih menjadi Terbiayai.",
    ]);
    assert.deepEqual(berubah({ ...r, pagu: 505 * JT }), [
      "1 usulan berubah status. Sisa pagu Rp 15 juta menjadi Rp 0.",
      "Talud RW 07 berubah dari Ditunda menjadi Terbiayai.",
    ]);
  });

  it("pagu terlalu kecil: usulan yang berubah dikelompokkan dan disebut semuanya", () => {
    const k = berubah({ ...r, pagu: 30 * JT });
    assert.equal(k[0], "5 usulan berubah status. Sisa pagu Rp 15 juta menjadi Rp 30 juta.");
    assert.ok(k.includes("Talud RW 07 berubah dari Ditunda menjadi Tidak terpilih."));
    assert.ok(k.includes("Drainase RW 07, Jembatan RW 07, Lampu PJU RW 07 dan Jalan SDN 03 RW 03 berubah dari Terbiayai menjadi Tidak terpilih."));
  });

  it("usulan forum ditambahkan: dihitung sebagai 'lain', kalimat tidak mengklaim yang terbiayai sama", () => {
    const k = berubah(tambahkan(data, r, data.forum.find((f) => f.namaSingkat === "Lampu gang")!.id, 8));
    assert.equal(k[0], "1 usulan lain berubah status. Sisa pagu Rp 15 juta menjadi Rp 75 juta.");
    assert.ok(!k.includes("Usulan yang terbiayai sama dengan rekomendasi resmi."));
    assert.ok(k.includes("Jalan SDN 03 RW 03 berubah dari Terbiayai menjadi Tidak terpilih."));
  });

  it("peringkat yang bergeser lebih dari tiga: tiga disebut, sisanya dihitung", () => {
    const k = berubah({ ...r, bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } });
    assert.equal(k[k.length - 1], "1 usulan lain juga berganti peringkat.");
  });
});

describe("kalimatPosisiAndaian", () => {
  it("bentuk dari brief: urgensi, peringkat, dan status", () => {
    const k = tambahkan(data, r, data.forum.find((f) => f.namaSingkat === "Lampu gang")!.id, 8);
    const h = hitungSimulasi(data, k, resmi);
    assert.equal(
      biasa(kalimatPosisiAndaian(h.banding.masuk[0], 8)),
      "Dengan urgensi 8, Lampu gang RW 07 berada di peringkat 3 dari 8: Terbiayai.",
    );
  });

  it("urgensi rendah: peringkat bawah dan tidak terbiayai pada pagu kecil", () => {
    const k = { ...tambahkan(data, r, data.forum.find((f) => f.namaSingkat === "Pelatihan menjahit")!.id, 2), pagu: 100 * JT };
    const h = hitungSimulasi(data, k, resmi);
    assert.match(biasa(kalimatPosisiAndaian(h.banding.masuk[0], 2)), /^Dengan urgensi 2, Pelatihan menjahit RW 01 berada di peringkat \d+ dari 8: /);
  });
});
