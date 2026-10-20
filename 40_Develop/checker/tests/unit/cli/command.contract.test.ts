/**
 * 単一CLI受付と既存三モードの搬送を検証する。
 *
 * @packageDocumentation
 * @responsibility 選択・flag除去・呼出し回数・例外伝播と非公開入口を固定する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope cli、command、dispatch
 * @boundary RCM-UT-001=N/A: 三操作を局所代役にした同期検査。 / RCM-UT-002=N/A: 固定Sourceの読取りと同期例外伝播。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { runCheckerCommand } from "../../../src/cli/command.ts";
import type { CheckerRunRequest } from "../../../src/cli/types.ts";

/**
 * 三モードの選択と引数搬送を検証する。
 *
 * @responsibility 旧binの優先順・反復flag除去・元配列不変を確認する。
 * @trace RCM-UT-001
 * @precondition 固定Sourceの三操作importだけを局所代役にする。
 * @stimulus 通常・各mode・位置違い・反復・両指定を受付へ渡す。
 * @observation 選択先・引数・cwd・callback・返却値を取得する。
 * @oracle 一操作一回で、固定期待搬送と同じ結果になる。
 * @cleanup N/A: VM外の状態・外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の同期代役である。
 */
test("CLI受付は旧binの三モードとflag処理を維持する", () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../../src/cli/command.ts", import.meta.url),
      "utf8",
    ),
  );
  const body = source
    .replace(/^import\s*\{[^}]+\}\s*from\s*"[^"]+";\s*$/gmu, "")
    .replace("export function", "function");
  assert.doesNotMatch(body, /^import\s/mu);
  const cases = [
    {
      arguments: ["--root", "."],
      selected: "document",
      forwarded: ["--root", "."],
    },
    {
      arguments: ["--semantic", "--write"],
      selected: "semantic",
      forwarded: ["--write"],
    },
    {
      arguments: ["--root", ".", "--semantic"],
      selected: "semantic",
      forwarded: ["--root", "."],
    },
    {
      arguments: ["--semantic", "--semantic"],
      selected: "semantic",
      forwarded: [],
    },
    {
      arguments: ["--test-catalog", "--all"],
      selected: "catalog",
      forwarded: ["--all"],
    },
    {
      arguments: ["--test-catalog", "--test-catalog"],
      selected: "catalog",
      forwarded: [],
    },
    {
      arguments: ["--semantic", "--test-catalog"],
      selected: "catalog",
      forwarded: ["--semantic"],
    },
    {
      arguments: ["--test-catalog", "--semantic"],
      selected: "catalog",
      forwarded: ["--semantic"],
    },
  ];
  for (const entry of cases) {
    const calls: { selected: string; request: CheckerRunRequest }[] = [];
    const result = { exitCode: 17 };
    const context = Object.fromEntries(
      [
        ["runChecker", "document"],
        ["runSemanticCoverage", "semantic"],
        ["runTestCatalog", "catalog"],
      ].map(([name, selected]) => [
        name,
        (request: CheckerRunRequest) => {
          calls.push({ selected: selected ?? "", request });
          return result;
        },
      ]),
    );
    const runCommand = vm.runInNewContext(
      `${body}\nrunCheckerCommand;`,
      context,
    ) as typeof runCheckerCommand;
    const request = {
      arguments: entry.arguments,
      cwd: "synthetic",
      writeOutput: (_value: string) => {},
      writeError: (_value: string) => {},
    };
    const before = JSON.stringify(request.arguments);
    assert.equal(runCommand(request), result);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.selected, entry.selected);
    assert.deepEqual(
      Array.from(calls[0]?.request.arguments ?? []),
      entry.forwarded,
    );
    assert.equal(calls[0]?.request.cwd, request.cwd);
    assert.equal(calls[0]?.request.writeOutput, request.writeOutput);
    assert.equal(calls[0]?.request.writeError, request.writeError);
    assert.equal(JSON.stringify(request.arguments), before);
  }
});

/**
 * 実処理の拒否と出力失敗を受付が上書きしないことを検証する。
 *
 * @responsibility 両mode・不明引数の既存終了値とcallback例外を確認する。
 * @trace RCM-UT-002
 * @precondition Root観測前に拒否される入力だけを使う。
 * @stimulus 実受付へ不正入力と失敗する出力先を渡す。
 * @observation 出力・終了値・例外を取得する。
 * @oracle 固定エラーと終了値を維持し、例外を成功へ丸めない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 受付と引数拒否の同期計算である。
 */
test("CLI受付は既存の不正入力と出力例外を保持する", () => {
  for (const [commandArguments, code, expected] of [
    [["--semantic", "--test-catalog"], 64, "test_catalog_arguments_invalid\n"],
    [["--semantic", "--unexpected"], 64, "semantic_arguments_invalid\n"],
    [["--unexpected"], 2, "Unknown option: --unexpected\n"],
  ] as const) {
    let error = "";
    const result = runCheckerCommand({
      arguments: commandArguments,
      cwd: "unused",
      writeOutput: () => assert.fail("unexpected output"),
      writeError: (value) => {
        error += value;
      },
    });
    assert.equal(result.exitCode, code);
    assert.equal(error, expected);
  }
  const failure = new Error("synthetic_output_failure");
  assert.throws(
    () =>
      runCheckerCommand({
        arguments: ["--semantic", "--unexpected"],
        cwd: "unused",
        writeOutput: () => {},
        writeError: () => {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
});

/**
 * Process接続と公開APIを単一受付から分離することを検証する。
 *
 * @responsibility binだけがProcessを接続し、内部受付をRootへ公開しないことを固定する。
 * @trace RCM-UT-002
 * @precondition 自Packageの固定入口Sourceを読む。
 * @stimulus 宣言とimport先を照合する。
 * @observation Process参照とRoot公開集合を取得する。
 * @oracle 受付内Process依存なし・binから単一受付・型の実Owner直接公開である。
 * @cleanup N/A: 同期読取りだけで終了する。
 * @boundary RCM-UT-002=N/A: 自PackageのSource構造を確認する。
 */
test("CLI受付はProcessとRoot公開集合から独立する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const index = fs.readFileSync(
    new URL("../../../src/index.ts", import.meta.url),
    "utf8",
  );
  const bin = fs.readFileSync(
    new URL("../../../bin/checker.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bprocess\./u);
  assert.doesNotMatch(index, /runCheckerCommand|cli\/command/u);
  assert.match(
    index,
    /export type \{ CheckerResult, CheckerRunRequest \} from "\.\/cli\/types\.ts"/u,
  );
  assert.match(bin, /from "\.\.\/src\/cli\/command\.ts"/u);
  assert.equal((bin.match(/runCheckerCommand\(/gu) ?? []).length, 1);
  assert.doesNotMatch(bin, /--semantic|--test-catalog/u);
});
