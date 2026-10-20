/**
 * Visual Preview公開CLIの拒否と公開API集合を検証する。
 * @packageDocumentation
 * @responsibility 入力拒否の終了値・公開JSONと、承認された五操作を確認する。
 * @trace ERB-IT-018
 * @level IT
 * @scope visual-preview、cli、public-api
 * @boundary ERB-IT-018=Direct Boundary: Node CLI→引数拒否と公開結果。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as preview from "../../src/index.ts";

/**
 * 不正なCLI入力をBrowserやListener開始前に拒否する。
 * @responsibility 公開CLIの終了1と単一の機密を含まないJSONを維持する。
 * @trace ERB-IT-018
 * @precondition 未知Option、重複Option、値欠落を合成する。
 * @stimulus 実CLIを各入力で一回ずつ起動する。
 * @observation 終了値、stdout、stderrを取得する。
 * @oracle stdoutは空、stderrは期待reasonの単一JSON、終了値は1。
 * @cleanup 各子Processは同期joinし、Listener・Profileは取得前に拒否する。
 * @boundary ERB-IT-018=Direct Boundary: Process引数→CLI拒否。
 */
test("CLIは不正入力を起動前に単一の公開結果で拒否する", () => {
  for (const [argumentValues, reason] of [
    [["--unknown", "x"], "visual_preview_option_unknown"],
    [["--root"], "visual_preview_option_value_required"],
    [["--root", "a", "--root", "b"], "visual_preview_option_duplicated"],
    [["verify-zoom", "--unknown", "x"], "visual_zoom_option_unknown"],
    [["verify-zoom"], "visual_zoom_required_option_missing"],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("../../bin/visual-preview.ts", import.meta.url)),
        ...argumentValues,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10_000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.deepEqual(JSON.parse(result.stderr), {
      contract: "crdd/visual-preview/v1",
      status: "blocked",
      reason,
    });
  }
});

/**
 * 公開操作を承認された五つに限定する。
 * @responsibility 内部Process型・注入器・DevTools操作の一括公開を拒否する。
 * @trace ERB-IT-018
 * @precondition Package Rootをimport済みである。
 * @stimulus 実行時export名を列挙する。
 * @observation 正規順の公開名集合を取得する。
 * @oracle 既存四操作と承認されたBrowser終了操作だけが存在する。
 * @cleanup N/A: importと局所集合比較だけで資源を取得しない。
 * @boundary ERB-IT-018=N/A: 公開Moduleの同期的な集合照合。
 */
test("Root APIは承認された五操作だけを公開する", () => {
  assert.deepEqual(Object.keys(preview).sort(), [
    "closeOwnedBrowserProcessTree",
    "observeLocalListener",
    "startVisualPreview",
    "verifyBrowserZoom",
    "verifyLocalWebApplicationVisual",
  ]);
});
