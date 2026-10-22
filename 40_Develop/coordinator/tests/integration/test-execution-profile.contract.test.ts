/**
 * coordinator:integration:test-execution-profileの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:test-execution-profileが所有する検証責務を実行する。
 * @trace CQS-IT-011
 * @level IT
 * @scope execution、profile
 * @boundary CQS-IT-011=Adjacent 1 Block: Test Catalog→Owner Runner
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const HOST_WINDOWS_PREFIX = "Host Windows:";
const portableTestDirectories = ["unit", "integration", "system"] as const;
const gateFiles = [
  {
    file: "integration/development-native-observation.integration.test.ts",
    prefixOccurrences: 1,
    expandedCases: 1,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/docker-effect-runtime.contract.test.ts",
    prefixOccurrences: 2,
    expandedCases: 2,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/kernel-lock.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 1,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/coordinator-state-runtime.contract.test.ts",
    prefixOccurrences: 4,
    expandedCases: 4,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/docker-recovery-owner-reentry.contract.test.ts",
    prefixOccurrences: 3,
    expandedCases: 13,
    expansion: /for \(const \{ repeatCount, retained \} of \[/,
  },
  {
    file: "integration/docker-auth-create-closure.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 1,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/host-recovery-record.contract.test.ts",
    prefixOccurrences: 12,
    expandedCases: 12,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/current-host-transition.integration.test.ts",
    prefixOccurrences: 1,
    expandedCases: 28,
    expansion: /for \(const publicationFault of \[/,
  },
  {
    file: "integration/current-state-marker-cleanup.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 1,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/coordinator-task-process.integration.test.ts",
    prefixOccurrences: 1,
    expandedCases: 2,
    expansion: /for \(const cleanupConfirmed of \[true, false\]\)/,
  },
  {
    file: "integration/codex-executor-sandbox.integration.test.ts",
    prefixOccurrences: 1,
    expandedCases: 1,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/docker-process-controller.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 2,
    expansion: /for \(const dockerCleanupConfirmed of \[true, false\]\)/,
  },
  {
    file: "integration/native-git-provenance.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 1,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/host-terminal-caller-checkpoint.integration.test.ts",
    prefixOccurrences: 8,
    expandedCases: 8,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/task-durable-foundation.contract.test.ts",
    prefixOccurrences: 10,
    expandedCases: 10,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/task-history.contract.test.ts",
    prefixOccurrences: 10,
    expandedCases: 10,
    expansion: /test\("Host Windows:/,
  },
  {
    file: "integration/runtime-repair-owner.contract.test.ts",
    prefixOccurrences: 15,
    expandedCases: 15,
    expansion: /test\("Host Windows:/,
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
 * @boundary CQS-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
function executableTestSource(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * 旧graph検査の別実行経路を残さない。
 * @responsibility 退役Scriptを任意検査aliasから再導入しない。
 * @trace CQS-IT-011
 * @precondition 現行package設定を読む。
 * @stimulus 旧aliasと通常checkを照合する。
 * @observation 旧aliasの不存在と現行checkの維持。
 * @oracle 通常の整形・型・lint・台帳確認を保持する。
 * @cleanup N/A: 読取りだけ。
 * @boundary 実行Profileの配置回帰。
 */
test("旧署名graphの任意実行入口を残さず通常checkを維持する", () => {
  const scripts = packageJson.scripts ?? {};
  for (const name of [
    "verification-tools:graph:check",
    "test:verification-tools",
    "runtime-capability-graph:check",
    "test:docker-isolation-distribution",
  ])
    assert.equal(scripts[name], undefined, name);
  assert.equal(
    scripts.check,
    "npm run format:check && npm run typecheck && npm run lint && npm run runtime-traceability:check && npm run task-design-traceability:check",
  );
});

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
 * @boundary CQS-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
function discoverGateFiles(
  files: readonly string[],
  read: (file: string) => string,
) {
  return files.filter(
    (file) =>
      file !== "integration/test-execution-profile.contract.test.ts" &&
      executableTestSource(read(file)).includes(HOST_WINDOWS_PREFIX),
  );
}

/**
 * Portable試験とHost Windows試験は同じ実環境専用の閉集合を重複なく所有することを検証する。
 *
 * @responsibility Portable試験とHost Windows試験は同じ実環境専用の閉集合を重複なく所有するの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Portable試験とHost Windows試験は同じ実環境専用の閉集合を重複なく所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("Portable試験とHost Windows試験は同じ実環境専用の閉集合を重複なく所有する", () => {
  const scripts = packageJson.scripts ?? {};
  assert.equal(
    scripts["test:portable"],
    'node --experimental-test-module-mocks --test --test-concurrency=1 "--test-skip-pattern=^(Host Windows:|Windows Process Gate:)" ./tests/unit/**/*.test.ts ./tests/integration/*.test.ts ./tests/system/*.test.ts',
  );
  assert.equal(
    scripts["test:host-windows"],
    'node --experimental-test-module-mocks --test --test-concurrency=1 "--test-name-pattern=^Host Windows:" ./tests/integration/docker-effect-runtime.contract.test.ts ./tests/integration/kernel-lock.contract.test.ts ./tests/integration/coordinator-state-runtime.contract.test.ts ./tests/integration/docker-recovery-owner-reentry.contract.test.ts ./tests/integration/host-recovery-record.contract.test.ts ./tests/integration/current-host-transition.integration.test.ts ./tests/integration/current-state-marker-cleanup.contract.test.ts ./tests/integration/coordinator-task-process.integration.test.ts ./tests/integration/codex-executor-sandbox.integration.test.ts ./tests/integration/docker-process-controller.contract.test.ts ./tests/integration/native-git-provenance.contract.test.ts ./tests/integration/host-terminal-caller-checkpoint.integration.test.ts ./tests/integration/task-durable-foundation.contract.test.ts ./tests/integration/task-history.contract.test.ts ./tests/integration/runtime-repair-owner.contract.test.ts ./tests/integration/docker-auth-create-closure.contract.test.ts ./tests/integration/development-native-observation.integration.test.ts',
  );
  assert.equal(scripts.test, "npm run check && npm run test:run");
  assert.equal(scripts["test:run"], "npm run test:portable");
  assert.equal(
    scripts["test:all"],
    "npm run check && npm run test:run && npm run test:host-windows",
  );
  assert.doesNotMatch(scripts.test ?? "", /test:host-windows/);
  assert.doesNotMatch(scripts["test:run"] ?? "", /test:host-windows/);
  assert.doesNotMatch(scripts.test ?? "", /test-(?:skip|name)-pattern/);

  let gateCount = 0;
  const testsRoot = new URL("../", import.meta.url);
  const allTestFiles = portableTestDirectories.flatMap((directory) =>
    fs
      .readdirSync(new URL(`${directory}/`, testsRoot))
      .filter((file) => file.endsWith(".test.ts"))
      .map((file) => `${directory}/${file}`),
  );
  const allowedGateFiles = new Set(gateFiles.map(({ file }) => file));
  assert.equal(allowedGateFiles.size, gateFiles.length);
  const discoveredGateFiles = discoverGateFiles(allTestFiles, (file) =>
    fs.readFileSync(new URL(file, testsRoot), "utf8"),
  );
  assert.deepEqual(discoveredGateFiles.sort(), [...allowedGateFiles].sort());
  for (const {
    file,
    prefixOccurrences,
    expandedCases,
    expansion,
  } of gateFiles) {
    const source = fs.readFileSync(new URL(file, testsRoot), "utf8");
    const occurrences =
      executableTestSource(source).split(HOST_WINDOWS_PREFIX).length - 1;
    assert.equal(occurrences, prefixOccurrences);
    assert.match(source, expansion);
    if (file === "integration/docker-recovery-owner-reentry.contract.test.ts") {
      const ownerLoop = executableTestSource(source).match(
        /for \(const \{ repeatCount, retained \} of \[([\s\S]*?)\]\)/u,
      );
      assert.ok(ownerLoop);
      assert.deepEqual(
        [
          ...(ownerLoop[1] ?? "").matchAll(
            /\{ repeatCount: (\d+), retained: (true|false) \}/gu,
          ),
        ].map((match) => [Number(match[1]), match[2] === "true"]),
        [
          [1, false],
          [1, true],
          [2, false],
        ],
      );
      const producerLoop = executableTestSource(source).match(
        /for \(const producerMode of \[([\s\S]*?)\] as const\)/u,
      );
      assert.ok(producerLoop);
      assert.deepEqual(
        [...(producerLoop[1] ?? "").matchAll(/"([^"]+)"/gu)].map(
          (match) => match[1],
        ),
        [
          "producer",
          "state_saved",
          "host_started",
          "cleanup_withheld",
          "parent_terminated",
        ],
      );
      const faultLoop = executableTestSource(source).match(
        /for \(const fault of \[([\s\S]*?)\]\)\s*\{\s*test\(`Host Windows: 認証create通常例外/u,
      );
      assert.ok(faultLoop);
      const faultValues = [...(faultLoop[1] ?? "").matchAll(/"([^"]+)"/gu)].map(
        (match) => match[1],
      );
      assert.deepEqual(faultValues, [
        "image",
        "inspect",
        "before_unknown",
        "after_unknown",
        "packet",
      ]);
      assert.equal(new Set(faultValues).size, 5);
    }
    gateCount += expandedCases;
    assert.match(scripts["test:host-windows"] ?? "", new RegExp(file));
  }
  assert.equal(gateCount, 112);
});

/**
 * 未分類のHost Windows試験を別試験ファイルへ追加すると閉集合が不一致になるを検証する。
 *
 * @responsibility 未分類のHost Windows試験を別試験ファイルへ追加すると閉集合が不一致になるの合否判定を所有する。
 * @trace CQS-IT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未分類のHost Windows試験を別試験ファイルへ追加すると閉集合が不一致になるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-IT-011=Direct Boundary: coordinator Test Source→対象契約
 */
test("未分類のHost Windows試験を別試験ファイルへ追加すると閉集合が不一致になる", () => {
  const duplicated = [...gateFiles, gateFiles[0]];
  assert.throws(
    () =>
      assert.equal(
        new Set(duplicated.map(({ file }) => file)).size,
        duplicated.length,
      ),
    { code: "ERR_ASSERTION" },
  );
  const files = [
    "integration/test-execution-profile.contract.test.ts",
    ...gateFiles.map(({ file }) => file),
    "unit/unclassified-process.test.ts",
  ];
  const discoveredItems = discoverGateFiles(files, (file) =>
    file === "unit/unclassified-process.test.ts" ? HOST_WINDOWS_PREFIX : "",
  );
  assert.deepEqual(discoveredItems, ["unit/unclassified-process.test.ts"]);
  assert.notDeepEqual(
    discoveredItems.sort(),
    gateFiles.map(({ file }) => file).sort(),
  );
});
