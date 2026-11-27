/**
 * 表示倍率からChromiumのズーム段階への変換を検証する。
 * @trace ARCH-000003
 * @level UT
 * @boundary 数値計算のみ。ブラウザー・ネットワーク・ファイルを使わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { toChromiumZoomLevel } from "../../src/browser/measure.ts";

test("既定倍率・拡大・縮小を対応するズーム段階へ変換する", () => {
  assert.equal(toChromiumZoomLevel(1), 0);
  assert.equal(toChromiumZoomLevel(1.2), 1);
  assert.ok(Math.abs(toChromiumZoomLevel(1.2 ** 3) - 3) < 1e-12);
  assert.ok(Math.abs(toChromiumZoomLevel(1 / 1.2) + 1) < 1e-12);
});

test("正の有限値でない倍率を拒否する", () => {
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => toChromiumZoomLevel(factor), {
      message: "visual_zoom_factor_invalid",
    });
  }
});
