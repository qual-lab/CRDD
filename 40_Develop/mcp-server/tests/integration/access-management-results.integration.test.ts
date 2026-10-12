/**
 * AMの結果分類と最終MCP応答の境界を別Processで検証する。
 * @packageDocumentation
 * @responsibility 試験Module差替えを親Processや本番Sourceから隔離する。
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @level IT
 * @scope MCP公開Resolverから結果投影まで。実AM保存・実HTTP試験と併用する。
 * @boundary 有限時間・有限出力の所有子Process。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * 固定した保存結果を公開Resolver経由で搬送する。
 * @responsibility 理由mapping・拒否・事前取消・UTF-8上限の反証を実行する。
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @precondition 固定NodeのModule mock機能と正式fixture Sourceが存在する。
 * @stimulus 既知十二理由・未知理由・read拒否と不明・16MiB境界を渡す。
 * @observation 子Process終了code、固定確認出力、fixture内の公開結果全field照合。
 * @oracle 差替え未適用・部分応答・未知理由透過・事前取消後実行は失敗する。
 * @cleanup 子Process終了待ち、fixtureの所有Root不存在確認。
 * @boundary 試験用合成Producer→本番MCP公開API。実保存成立を主張しない。
 */
for (const mode of ["normal", "before-mock-failure", "timeout"]) {
  test(`管理結果fixture ${mode}の結果と所有Root回収を確認する`, () => {
    const base = fileURLToPath(
      new URL("../../../../.crdd/tests/", import.meta.url),
    );
    fs.mkdirSync(base, { recursive: true });
    const owned = fs.mkdtempSync(path.join(base, "mcp-management-results-"));
    const sentinel = fs.mkdtempSync(
      path.join(base, "mcp-management-sentinel-"),
    );
    const sentinelFile = path.join(sentinel, "untouched.txt");
    fs.writeFileSync(sentinelFile, "unchanged");
    try {
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          fileURLToPath(
            new URL(
              "../fixtures/access-management-results.ts",
              import.meta.url,
            ),
          ),
          owned,
          mode,
        ],
        {
          encoding: "utf8",
          timeout: mode === "timeout" ? 2000 : 30000,
          maxBuffer: 65536,
          windowsHide: true,
        },
      );
      if (mode === "timeout") {
        assert.equal(
          (result.error as NodeJS.ErrnoException | undefined)?.code,
          "ETIMEDOUT",
        );
        assert.equal(result.status, null);
        assert.equal(result.signal, "SIGTERM");
        assert.equal(result.stdout, "fixture-timeout-ready\n");
      } else {
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.equal(result.status, mode === "normal" ? 0 : 1, result.stderr);
        if (mode === "normal")
          assert.equal(
            result.stdout,
            "management-result-boundaries: verified\n",
          );
        else assert.match(result.stderr, /fixture_before_mock_failure/u);
      }
    } finally {
      // spawnSync帰還は子Process終端後。共有baseやprefix集合を削除しない。
      assert.equal(path.dirname(owned), path.resolve(base));
      assert.equal(fs.realpathSync.native(owned), owned);
      assert.ok(path.basename(owned).startsWith("mcp-management-results-"));
      fs.rmSync(owned, { recursive: true, force: true });
      assert.equal(fs.existsSync(owned), false);
      assert.equal(fs.readFileSync(sentinelFile, "utf8"), "unchanged");
      assert.equal(path.dirname(sentinel), path.resolve(base));
      assert.equal(fs.realpathSync.native(sentinel), sentinel);
      assert.ok(path.basename(sentinel).startsWith("mcp-management-sentinel-"));
      fs.rmSync(sentinel, { recursive: true, force: true });
      assert.equal(fs.existsSync(sentinel), false);
    }
  });
}
