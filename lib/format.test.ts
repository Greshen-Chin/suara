import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { persen } from "./format.ts";

describe("persen", () => {
  test("persen biasa", () => {
    assert.equal(persen(50, 200), 25);
    assert.equal(persen(8, 8), 100);
    assert.equal(persen(0, 8), 0);
  });
  test("pembagi nol atau tidak sah menghasilkan 0, bukan NaN atau Infinity (tanpa usulan: width: NaN%)", () => {
    assert.equal(persen(0, 0), 0);
    assert.equal(persen(5, 0), 0);
    assert.equal(persen(5, -3), 0);
    assert.equal(persen(5, Number.NaN), 0);
    assert.equal(persen(Number.NaN, 5), 0);
    assert.equal(persen(Number.POSITIVE_INFINITY, 5), 0);
  });
  test("dibatasi 0 sampai 100", () => {
    assert.equal(persen(300, 200), 100);
    assert.equal(persen(-5, 200), 0);
  });
});
