/**
 * coordinator:integration:test-execution-profileの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:test-execution-profileが所有する検証責務を実行する。
 * @trace CQS-IT-011
 * @level IT
 * @scope execution、profile
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const GATE_PREFIX = "Windows Process Gate:";
const gateFiles = [
  {
    file: "coordinator-task-process.integration.test.ts",
    prefixOccurrences: 1,
    expandedCases: 2,
    expansion: /for \(const cleanupConfirmed of \[true, false\]\)/,
  },
  {
    file: "docker-owned-process.integration.test.ts",
    prefixOccurrences: 3,
    expandedCases: 4,
    expansion: /for \(const mode of \["stdout-limit", "stderr-limit"\]\)/,
  },
  {
    file: "docker-process-controller.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 2,
    expansion: /for \(const dockerCleanupConfirmed of \[true, false\]\)/,
  },
] as const;

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

/**
 * Source Headerを除いた実行Sourceを返す。
 *
 * @responsibility Test Source Header内の説明を実行Caseとして誤算入しない。
 * @trace CQS-IT-011
 * @precondition sourceはTypeScript Test Source全体である。
 * @stimulus block commentを除外する。
 * @observation 実行Sourceの文字列を返す。
 * @oracle Source Header内だけにある試験名が結果へ残らない。
 * @cleanup N/A: Filesystem資源を取得しない純粋な文字列変換である。
 * @boundary Adjacent 1 Block: Test Source Header→Test Execution Profile Contract
 */
function executableTestSource(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * discoverGateFilesのTest準備責務を実行する。
 *
 * @responsibility discoverGateFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CQS-IT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus discoverGateFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
function discoverGateFiles(
  files: readonly string[],
  read: (file: string) => string,
) {
  return files.filter(
    (file) =>
      file !== "test-execution-profile.contract.test.ts" &&
      executableTestSource(read(file)).includes(GATE_PREFIX),
  );
}

/**
 * 制限Process用試験と実Windows Process Gateは同じ8件の閉集合を所有するを検証する。
 *
 * @responsibility 制限Process用試験と実Windows Process Gateは同じ8件の閉集合を所有するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 制限Process用試験と実Windows Process Gateは同じ8件の閉集合を所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("制限Process用試験と実Windows Process Gateは同じ8件の閉集合を所有する", () => {
  const scripts = packageJson.scripts ?? {};
  assert.match(
    scripts["test:restricted-process"] ?? "",
    /--test-skip-pattern=\^Windows Process Gate:/,
  );
  assert.match(
    scripts["test:windows-process"] ?? "",
    /--test-name-pattern=\^Windows Process Gate:/,
  );
  assert.equal(scripts.test, "npm run check && npm run test:run");
  assert.equal(
    scripts["test:run"],
    "npm run test:windows-process && npm run test:restricted-process",
  );
  assert.doesNotMatch(scripts.test ?? "", /test-(?:skip|name)-pattern/);

  let gateCount = 0;
  const testDirectory = new URL(".", import.meta.url);
  const allTestFiles = fs
    .readdirSync(testDirectory)
    .filter((file) => file.endsWith(".test.ts"));
  const allowedGateFiles = new Set(gateFiles.map(({ file }) => file));
  const discoveredGateFiles = discoverGateFiles(allTestFiles, (file) =>
    fs.readFileSync(new URL(file, testDirectory), "utf8"),
  );
  assert.deepEqual(discoveredGateFiles.sort(), [...allowedGateFiles].sort());
  for (const {
    file,
    prefixOccurrences,
    expandedCases,
    expansion,
  } of gateFiles) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    const occurrences =
      executableTestSource(source).split(GATE_PREFIX).length - 1;
    assert.equal(occurrences, prefixOccurrences);
    assert.match(source, expansion);
    gateCount += expandedCases;
    assert.match(scripts["test:windows-process"] ?? "", new RegExp(file));
  }
  assert.equal(gateCount, 8);
});

/**
 * 未分類のWindows Process Gateを別試験ファイルへ追加すると閉集合が不一致になるを検証する。
 *
 * @responsibility 未分類のWindows Process Gateを別試験ファイルへ追加すると閉集合が不一致になるの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未分類のWindows Process Gateを別試験ファイルへ追加すると閉集合が不一致になるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Test Catalog→Owner Runner
 */
test("未分類のWindows Process Gateを別試験ファイルへ追加すると閉集合が不一致になる", () => {
  const files = [
    "test-execution-profile.contract.test.ts",
    ...gateFiles.map(({ file }) => file),
    "unclassified-process.test.ts",
  ];
  const discoveredItems = discoverGateFiles(files, (file) =>
    file === "unclassified-process.test.ts" ? GATE_PREFIX : "",
  );
  assert.deepEqual(discoveredItems, ["unclassified-process.test.ts"]);
  assert.notDeepEqual(
    discoveredItems.sort(),
    gateFiles.map(({ file }) => file).sort(),
  );
});
