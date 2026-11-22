import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RUBRIK_URGENSI, label, rubrikUntuk } from "./urgensi.ts";

describe("rubrik urgensi", () => {
  it("menutup 1 sampai 10 tanpa celah dan tanpa tumpang tindih", () => {
    const dipakai: number[] = [];
    for (const t of RUBRIK_URGENSI) for (let n = t.dari; n <= t.sampai; n++) dipakai.push(n);
    assert.deepEqual(dipakai, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("empat tingkat dengan nama yang dipakai di formulir", () => {
    assert.deepEqual(
      RUBRIK_URGENSI.map((t) => t.ringkas),
      [
        "Bisa menunggu periode berikutnya",
        "Mengganggu kegiatan sehari-hari",
        "Merugikan banyak warga bila ditunda",
        "Menyangkut keselamatan",
      ],
    );
  });

  it("rubrikUntuk menemukan tingkat tiap nilai, dan null di luar skala", () => {
    assert.equal(rubrikUntuk(1)?.ringkas, "Bisa menunggu periode berikutnya");
    assert.equal(rubrikUntuk(3)?.ringkas, "Bisa menunggu periode berikutnya");
    assert.equal(rubrikUntuk(4)?.ringkas, "Mengganggu kegiatan sehari-hari");
    assert.equal(rubrikUntuk(8)?.ringkas, "Merugikan banyak warga bila ditunda");
    assert.equal(rubrikUntuk(10)?.ringkas, "Menyangkut keselamatan");
    assert.equal(rubrikUntuk(0), null);
    assert.equal(rubrikUntuk(11), null);
  });

  it("selaras dengan nilai urgensi pada data demo", () => {
    // Gapura 3 (tampilan), Jalan SDN 03 8 (merugikan setiap hari), Talud 10 (keselamatan).
    assert.equal(rubrikUntuk(3)?.dari, 1);
    assert.equal(rubrikUntuk(8)?.dari, 7);
    assert.equal(rubrikUntuk(10)?.dari, 9);
  });

  it("label rentang memakai tanda pisah panjang", () => {
    assert.equal(label(RUBRIK_URGENSI[0]), "1–3");
  });
});
