/**
 * 公開System Directory観測の固定境界を確認する。
 * @packageDocumentation
 * @responsibility 正常対照とArtifact・Process・Protocol異常の取得不能を確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 固定Nativeの開始前拒否・開始後観測・decode
 * @boundary Node子ProcessでのModule差替え。実Native起動とは区別する。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * 正常と各独立失敗点で固定公開入口の処置を確認する。
 * @responsibility 前後同一性とProtocol異常を成功へ補完しない反例を検出する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition Windows。別Processの試験専用差替えで実Nativeを起動しない。
 * @stimulus 14固定scenarioのfixtureを順に起動する。
 * @observation exit、固定件数、取得有無。
 * @oracle 正常だけDirectoryを返し、開始前拒否はspawn0、開始後は再観測1。
 * @cleanup 各同期子Processの終了を確認する。File生成なし。
 * @boundary 公開Node入口の固定Process構成と合成Native応答。
 */
test("System Directoryは正常だけ取得し14境界の前後条件を保持する", {
  skip: process.platform !== "win32",
}, () => {
  for (const scenario of [
    "normal",
    "artifact_missing",
    "hash_mismatch",
    "artifact_changed",
    "spawn_error",
    "status",
    "signal",
    "stderr",
    "prefix",
    "length",
    "relative",
    "nul",
    "noncanonical",
    "utf16",
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        fileURLToPath(
          new URL(
            "../fixtures/system-directory-observation.ts",
            import.meta.url,
          ),
        ),
        scenario,
      ],
      {
        shell: false,
        windowsHide: true,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 64 * 1024,
      },
    );
    assert.equal(result.error, undefined, scenario);
    assert.equal(result.signal, null, scenario);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).observed, scenario === "normal");
  }
});
