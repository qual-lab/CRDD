/**
 * 環境共通のbackend観測入口を固定Process境界へ接続する。
 * @packageDocumentation
 * @responsibility 固定argv・環境・有界出力と不明返却を反証する。
 * @trace ERB-IT-002
 * @level IT
 * @scope 別Nodeの合成OS境界。実WSL・Docker・Provider操作0。
 * @boundary 公開Root API→固定一覧Processの差替え。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * 正常と独立故障を一時点の状態だけへ分類する。
 * @responsibility 取得不能・未対応を停止や実環境成立へ補完しない。
 * @trace ERB-IT-002
 * @precondition Windows、別ProcessのModule差替え。
 * @stimulus 停止・稼働と七つの取得不能条件。
 * @observation 固定Process構成、要求件数、返却状態、子exit。
 * @oracle 正常だけstopped／running、未対応・失敗はunknown、開始前拒否は要求0。
 * @cleanup 同期fixture子終了。実Native・WSL・Docker資源は取得しない。
 * @boundary 公開入口と合成Process結果。実環境観測とは区別する。
 */
test("backend観測は固定二操作だけを発行し失敗と未対応をunknownへ閉じる", {
  skip: process.platform !== "win32",
}, () => {
  for (const scenario of [
    "stopped",
    "running",
    "status",
    "signal",
    "stderr",
    "encoding",
    "throw",
    "environment",
    "unsupported",
  ]) {
    const observed = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        fileURLToPath(new URL("../fixtures/backend-state.ts", import.meta.url)),
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
    assert.equal(observed.error, undefined);
    assert.equal(observed.signal, null);
    assert.equal(observed.status, 0, observed.stderr);
    assert.equal(JSON.parse(observed.stdout).realWslOrDockerIssued, false);
  }
});
