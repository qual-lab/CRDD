/**
 * Windows所有子の固定tree終了補助を確認する。
 * @packageDocumentation
 * @responsibility 固定構成、開始前拒否、補助終了と元子終了の区別を反証する。
 * @trace ERB-IT-002
 * @level IT
 * @scope 合成Process境界。実taskkill・Docker・Provider要求0。
 * @boundary 別Node fixtureで観測を差し替え、実OS成立とは区別する。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * 固定tree終了補助の開始と終了観測を分離する。
 * @responsibility 失敗・期限・close不能を成功へ畳まず元子終了と補助終了を区別する。
 * @trace ERB-IT-002
 * @precondition Windows、別Nodeの差替えで実taskkill要求0。
 * @stimulus 正常、非zero、signal、error、期限、出力超過、元子終了、環境不能、観測後元子終了。
 * @observation 固定spawn構成、開始・結果・close、終了要求回数。
 * @oracle 開始前拒否は要求0、待機不能は未完了、補助終了を元子終了へ代用しない。
 * @cleanup 同期fixture子終了と模擬stream破棄。
 * @boundary 公開Platform Access技術入口の合成OS境界。
 */
test("Windows tree補助の九境界を分離し未知の終了を補完しない", {
  skip: process.platform !== "win32",
}, () => {
  for (const scenario of [
    "normal",
    "nonzero",
    "signal",
    "error",
    "pending",
    "output",
    "closed",
    "environment",
    "late_closed",
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        fileURLToPath(
          new URL("../fixtures/child-tree-termination.ts", import.meta.url),
        ),
        scenario,
      ],
      {
        shell: false,
        windowsHide: true,
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 64 * 1024,
      },
    );
    assert.equal(result.error, undefined, scenario);
    assert.equal(result.signal, null, scenario);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).realTerminationIssued, false);
  }
});
