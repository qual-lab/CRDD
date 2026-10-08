/**
 * coordinator:integration:platform-provisioner-package-filesystemの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:platform-provisioner-package-filesystemが所有する検証責務を実行する。
 * @trace AIT-IT-013
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope platform、provisioner、package、filesystem
 * @boundary AIT-IT-013=Adjacent 1 Block: Signer→Staging→Manifest配置
 * @boundary ERB-IT-001/ERB-IT-002=Partial Boundary: 固定Tool Source→Process起動・所有graph。実Process lifecycleは対象外。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { runInNewContext } from "node:vm";
import {
  createRuntimeLocalTypeScriptWorker,
  runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver,
  spawnRuntimeLocalTypeScriptChild,
} from "../../src/host-runtime/runtime-local-typescript-child-entrypoints.ts";
import { createDevelopmentMeasurementConstraints } from "../../src/task/development-measurement-constraints.ts";
import {
  assertReleaseSigningConsumerClosureForVerification,
  assertRuntimePackageCapabilityConsumerGraphForVerification,
  assertRuntimeSourceDeclaredGraphBoundaryForVerification,
  assertRuntimeSourceModuleBoundaryForVerification,
  assertVerificationToolCapabilityGraphForVerification,
  consumeRuntimeOwnedVerifiedCoordinatorPackageCapability,
  createIsolatedVerifiedPackageCapabilityStateCandidate,
  describePlatformProvisionerPackageFilesystemContract,
  diagnoseRuntimeDistributionFilesystemForVerification,
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectPlatformProvisionerPackageFilesystemCandidate,
  inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate,
  inspectVerifiedNativeDistributionCandidate,
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  releaseSigningProtectedPathDiagnosticForVerification,
  runtimePackageCapabilityConsumerGraphDiagnosticForVerification,
  runtimeNamedFunctionGraphSnapshotForVerification,
  verifyBundledCoordinatorPackageCandidate,
} from "../../src/platform-access/platform-provisioner-package-filesystem.ts";
import {
  calculateRuntimeExecutionIdentityCandidate,
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
} from "../../src/platform-access/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../../src/diagnostics/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "../support/test-support.ts";

const developmentFixtureRoots = new Set<string>();
const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Domain保存排他Workerの固定起動と改変拒否を検証する。
 *
 * @responsibility 兄弟Domainへの依存接続が未登録のWorker一般の許可にならないことを確認する。
 * @trace AIT-IT-013
 * @trace ERB-IT-002
 * @precondition 実Sourceの読取りとMemory内の変異だけを使用する。
 * @stimulus 固定Owner・参照先を観測し、Target、alias、起動数、importを変更する。
 * @observation 固定Source受理と全変異拒否を例外から観測する。
 * @oracle Workerの固定Owner・起動点・参照先がすべて一致する場合だけ受理する。
 * @cleanup N/A: Worker、Process、一時Directoryを作成しない。
 * @boundary Partial Boundary: 配布Source→保存Workerの静的接続。実Worker lifecycleは既存保存排他試験が所有する。
 */
test("Domain保存Workerの固定参照だけを受理し改変を拒否する", () => {
  const owner = "40_Develop/domain-model/src/storage/filesystem-store-root.ts";
  const worker =
    "40_Develop/domain-model/src/storage/filesystem-store-kernel-lock-worker.ts";
  const source = fs.readFileSync(
    path.resolve(coordinatorRoot, "../../", owner),
    "utf8",
  );
  const workerSource = fs.readFileSync(
    path.resolve(coordinatorRoot, "../../", worker),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceModuleBoundaryForVerification(owner, source),
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceModuleBoundaryForVerification(worker, workerSource),
  );
  for (const [before, after] of [
    ["./filesystem-store-kernel-lock-worker.ts", "./other-worker.ts"],
    [
      "./filesystem-store-kernel-lock-worker.ts",
      "./filesystem-store-kernel-lock-worker.ts?alias",
    ],
    ["new Worker(", "new OtherWorker("],
    ["import { Worker }", "import { Worker as OtherWorker }"],
    ['import { Worker } from "node:worker_threads";', ""],
    [
      'import { Worker } from "node:worker_threads";',
      'import { Worker } from "node:net";',
    ],
    [
      "const worker = new Worker(",
      'const extra = new Worker(new URL("./filesystem-store-kernel-lock-worker.ts", import.meta.url), {}); const worker = new Worker(',
    ],
  ] as const) {
    assert.ok(source.includes(before), before);
    assert.throws(
      () =>
        assertRuntimeSourceModuleBoundaryForVerification(
          owner,
          source.replace(before, after),
        ),
      /child_worker_unbound|child_url_unbound/u,
    );
  }
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        owner.replace("filesystem-store-root.ts", "other-root.ts"),
        source,
      ),
    /child_worker_unbound|child_url_unbound/u,
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        worker,
        workerSource.replace(
          "parentPort, workerData",
          "parentPort, workerData, Worker",
        ),
      ),
    /child_worker_unbound/u,
  );
});

/**
 * Native保護検証Toolの五つの固定起動を本番Runtimeへ混入させず検査する。
 * @responsibility 固定owner、引数、親の検証と非同期所有の変更を拒否する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition Source読取りとMemory内の変異だけ。Native/Cargo/Gitを起動しない。
 * @stimulus 五ownerを観測し、Root検証・起動条件・引数・listener・呼出し関係を個別に改変する。
 * @observation 固定Source受理と全変異拒否。
 * @oracle 未登録ownerや外部入力から新たなProcess許可を作らない。
 * @cleanup N/A: OS資源や一時fileを作成しない。
 * @boundary ERB-IT-001/ERB-IT-002=Partial Boundary: Source→検証Tool専用Process graph。実Native保護・Process lifecycleの成立は対象外。
 */
test("Native保護検証Toolの五固定起動と所有関係の改変を拒否する", () => {
  const sourcePath = "scripts/verify-native-protection.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  const helpers = [
    "lintNativeProtectionArtifact",
    "buildNativeProtectionArtifact",
    "executeNativeProtectionGuard",
    "executeNativeProtectionZeroCase",
  ];
  const graph = runtimeNamedFunctionGraphSnapshotForVerification(
    sourcePath,
    source,
    [...helpers, "runNativeProtection"],
  );
  assert.equal(graph.length, 5);
  for (const helper of helpers)
    assert.equal(
      graph.find((node) => node.name === helper)?.lexicalScope,
      "runNativeProtection",
    );
  for (const [before, after] of [
    [
      "const verified = verifyRepositoryRoot(repository);",
      'const verified = { status: "completed", capability: null };',
    ],
    ['"+1.94.1-x86_64-pc-windows-msvc",', '"+unknown-toolchain",'],
    ['exactTest + ".missing"', 'exactTest + ".other"'],
    ['child.on("error",', 'child.on("other-event",'],
    ['child.once("close",', 'child.once("other-event",'],
    ["assert.equal(artifacts.length, 1,", "assert.equal(artifacts.length, 2,"],
    [
      "const build = buildNativeProtectionArtifact();",
      "const build = lintNativeProtectionArtifact();",
    ],
    [
      "function executeNativeProtectionGuard()",
      "function otherNativeProtectionGuard()",
    ],
    [
      "function lintNativeProtectionArtifact()",
      'function lintNativeProtectionArtifact(injected = spawnSync("other", [], { shell: false }))',
    ],
  ] as const) {
    assert.ok(source.includes(before));
    const mutated = source.replace(before, after);
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_(?:child_process|capability_flow|capability_graph)_(?:unbound|mismatch|executable_unbound|ownership_unbound)/u,
    );
  }
});

/**
 * Host回復Nativeの二搬送と六つのmode供給元を閉グラフへ結合する。
 *
 * @responsibility 未登録起動点、mode変更、実行条件・所有者変更を拒否する。
 * @trace AIT-IT-013
 * @precondition 現在Sourceの読取りとMemory内の変異だけ。Nativeは起動しない。
 * @stimulus 二つの搬送、六wrapper、型引数・引数defaultを個別に変更する。
 * @observation 固定Source受理と各変異の例外を観測する。
 * @oracle 登録Sourceだけ受理し、起動・搬送・供給元の変更は拒否する。
 * @cleanup N/A: OS資源や一時fileを作成しない。
 * @boundary Source→署名対象の起動点と呼出し元の静的検査。
 */
test("Host回復Nativeの二搬送と六wrapperの閉グラフを確認する", () => {
  const sourcePath = "src/host-runtime/host-terminal-windows-adapter.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const [before, after] of [
    ["[nativeMode]", '["--unexpected-mode"]'],
    ['? "--host-terminal-observe"', '? "--unexpected-mode"'],
    ['"--host-terminal-save",', '"--host-terminal-read",'],
    ['"--host-terminal-read",', '"--host-terminal-save",'],
    [
      '"--host-terminal-known-file-save",',
      '"--host-terminal-known-file-read",',
    ],
    [
      '    evaluateKnownFileHostTerminalReadResponse,\n    "--host-terminal-known-file-read",',
      '    evaluateKnownFileHostTerminalReadResponse,\n    "--host-terminal-known-file-save",',
    ],
    [
      '    "eleven",\n    requestContexts,',
      '    "known_file",\n    requestContexts,',
    ],
    [
      '    "known_file",\n    knownFileRequestContexts,',
      '    "eleven",\n    knownFileRequestContexts,',
    ],
    ["shell: false,", "shell: true,"],
    ["timeout: 5000,", "timeout: 1,"],
    [
      "function executeHostTerminalRecordRequest<",
      "export function executeHostTerminalRecordRequest<",
    ],
    [
      "function executeTerminalObservationRequest<",
      "function renamedTerminalObservationRequest<",
    ],
    [
      "  request: HostTerminalSaveRequest | HostTerminalReadRequest,",
      "  request: HostTerminalSaveRequest | HostTerminalReadRequest = spawnSync(process.execPath, []),",
    ],
    [
      "  Observation extends",
      "  Observation = typeof spawnSync(process.execPath, []) extends",
    ],
  ] as const) {
    assert.ok(source.includes(before), before);
    const mutated = source.replace(before, after);
    assert.notEqual(mutated, source);
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_(?:child_process|capability|parse)/u,
      before,
    );
  }
  const moved = `${source.replace(
    "function executeTerminalObservationRequest<",
    "function nestedOwner() { function executeTerminalObservationRequest<",
  )}\n}`;
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        sourcePath,
        moved,
      ),
    /runtime_dependency_capability_graph_mismatch:executeTerminalObservationRequest:scope:nestedOwner/u,
  );
});

/**
 * 型引数付き宣言の境界を文字列や後方の括弧と混同しないことを確認する。
 *
 * @responsibility 型引数の入れ子と不正終端を四つの関数検査へ共通の境界で渡す。
 * @trace AIT-IT-013
 * @precondition 合成SourceだけをMemoryで解析する。
 * @stimulus 通常、generic、入れ子、文字列山括弧、不正終端を入力する。
 * @observation 名前・本体の取得件数と解析拒否を観測する。
 * @oracle 正常形は一件、不正な型引数終端は後方へ探索せず拒否する。
 * @cleanup N/A: 外部操作や共有状態はない。
 * @boundary 関数宣言の解析→本体・所有者の検査。
 */
test("名前付き関数の型引数終端と文字列を区別する", () => {
  for (const source of [
    "function sample(value: string) { return value; }",
    "function sample<T>(value: T) { return value; }",
    "function sample<T extends Readonly<Array<string>>>(value: T) { return value; }",
    'function sample<T extends "<" | ">">(value: T) { return value; }',
  ]) {
    const graphs = runtimeNamedFunctionGraphSnapshotForVerification(
      "src/host-runtime/generic-fixture.ts",
      source,
      ["sample"],
    );
    assert.equal(graphs.length, 1);
    assert.equal(graphs[0]?.name, "sample");
    assert.equal(graphs[0]?.lexicalScope, "module");
  }
  for (const source of [
    "function sample<T(value: T) { return value; }",
    "function sample<T> misplaced(value: T) { return value; }",
    'function sample<T extends ">"(value: T) { return value; }',
    'function sample"<"T>(value: T) { return value; }',
  ]) {
    assert.throws(() => {
      const graphs = runtimeNamedFunctionGraphSnapshotForVerification(
        "src/host-runtime/generic-fixture.ts",
        source,
        ["sample"],
      );
      assert.equal(graphs.length, 1);
    });
  }
});

/**
 * Runtime sibling component宣言は各Identityを一度だけ所有するを検証する。
 *
 * @responsibility Runtime sibling component宣言は各Identityを一度だけ所有するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime sibling component宣言は各Identityを一度だけ所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime sibling component宣言は各Identityを一度だけ所有する", () => {
  const source = fs.readFileSync(
    path.join(
      coordinatorRoot,
      "src/platform-access/platform-provisioner-package-filesystem.ts",
    ),
    "utf8",
  );
  const declaration = source.match(
    /const RUNTIME_SIBLING_COMPONENTS = Object\.freeze\(\[([\s\S]*?)\n\]\);/u,
  )?.[1];
  assert.ok(declaration);
  for (const field of ["sourcePrefix", "packagePath", "packageName"] as const) {
    const declaredValues: string[] = Array.from(
      declaration.matchAll(new RegExp(`${field}: "([^"]+)"`, "gu")),
      (match) => match[1] ?? "",
    );
    assert.ok(declaredValues.length > 0, `${field}: no declared values`);
    assert.equal(
      new Set(declaredValues).size,
      declaredValues.length,
      `${field}: duplicate value`,
    );
  }
});

/**
 * restart machineのWSL対象とDocker観測引数は閉集合で保持するを検証する。
 *
 * @responsibility restart machineのWSL対象とDocker観測引数は閉集合で保持するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart machineのWSL対象とDocker観測引数は閉集合で保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("restart machineのWSL対象とDocker観測引数は閉集合で保持する", () => {
  const sourcePath = "src/docker-desktop/docker-restart-machine.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  assert.equal((source.match(/\bspawnSync\s*\(/gu) ?? []).length, 3);
  assert.doesNotMatch(
    source,
    /terminateWsl|terminateProcesses|--terminate|--shutdown/u,
  );
  assert.match(source, /session\.stopDesktop\(\)/u);
  for (const [from, to] of [
    ["--list", "--terminate"],
    ["--no-trunc", "--all"],
    ["--running", "--shutdown"],
  ] as const) {
    assert.ok(source.includes(from));
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          source.replace(from, to),
        ),
      /runtime_dependency_child_process_unbound/u,
    );
  }
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        sourcePath,
        `${source}\nfunction terminateWsl() { return spawnSync("wsl.exe", ["--terminate", "docker-desktop"]); }\n`,
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

/**
 * Native repair/restart spawnは同じ署名観測所有者と閉じた引数集合を要求するを検証する。
 *
 * @responsibility Native repair/restart spawnは同じ署名観測所有者と閉じた引数集合を要求するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Native repair/restart spawnは同じ署名観測所有者と閉じた引数集合を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Native repair/restart spawnは同じ署名観測所有者と閉じた引数集合を要求する", () => {
  const sourcePath =
    "src/docker-desktop/docker-desktop-repair-native-process.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  const flag = "--docker-desktop-restart-helper";
  assert.ok(source.includes(flag));
  assert.match(source, /--docker-desktop-repair-helper/u);
  assert.match(source, /spawn\(executablePath, \[helperMode\]/u);
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        sourcePath,
        source.replace(flag, "--unauthorized-helper"),
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

/**
 * verificationToolSourcesのTest準備責務を実行する。
 *
 * @responsibility verificationToolSourcesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus verificationToolSourcesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function verificationToolSources() {
  const scriptsRoot = path.join(coordinatorRoot, "scripts");
  const sources: Record<string, string> = {};
  /**
   * visitのTest準備責務を実行する。
   *
   * @responsibility visitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace AIT-IT-013
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus visitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  const visit = (root: string, relativeRoot: string) => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const relative = `${relativeRoot}/${entry.name}`;
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) {
        visit(absolute, relative);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts"))
        sources[relative] = fs.readFileSync(absolute, "utf8");
    }
  };
  visit(scriptsRoot, "scripts");
  return sources;
}

/**
 * runtimeTypeScriptSourcesのTest準備責務を実行する。
 *
 * @responsibility runtimeTypeScriptSourcesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runtimeTypeScriptSourcesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function runtimeTypeScriptSources() {
  const sources: Record<string, string> = {};
  /**
   * visitのTest準備責務を実行する。
   *
   * @responsibility visitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace AIT-IT-013
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus visitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  const visit = (root: string, relativeRoot: string) => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const relative = `${relativeRoot}/${entry.name}`;
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) {
        visit(absolute, relative);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts"))
        sources[relative] = fs.readFileSync(absolute, "utf8");
    }
  };
  for (const root of ["bin", "src", "scripts"])
    visit(path.join(coordinatorRoot, root), root);
  visit(
    path.resolve(coordinatorRoot, "../orchestrator/src"),
    "40_Develop/orchestrator/src",
  );
  return sources;
}
/**
 * removeDevelopmentFixtureのTest準備責務を実行する。
 *
 * @responsibility removeDevelopmentFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus removeDevelopmentFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function removeDevelopmentFixture(root: string) {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.equal(fs.realpathSync.native(root), root);
  fs.rmSync(root, { recursive: true, force: true });
  developmentFixtureRoots.delete(root);
}

after(() => {
  for (const root of developmentFixtureRoots) removeDevelopmentFixture(root);
});

/**
 * local TypeScript子wrapperはroleとkindを実行前に検証し、targetを外へ公開しないを検証する。
 *
 * @responsibility local TypeScript子wrapperはroleとkindを実行前に検証し、targetを外へ公開しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus local TypeScript子wrapperはroleとkindを実行前に検証し、targetを外へ公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("local TypeScript子wrapperはroleとkindを実行前に検証し、targetを外へ公開しない", () => {
  assert.throws(
    () => spawnRuntimeLocalTypeScriptChild("unknown" as never, [], {}),
    /runtime_local_typescript_child_entrypoint_unknown/u,
  );
  assert.throws(
    () =>
      spawnRuntimeLocalTypeScriptChild("candidate_store_lock_worker", [], {}),
    /runtime_local_typescript_child_entrypoint_kind_mismatch/u,
  );
  assert.throws(
    () =>
      spawnRuntimeLocalTypeScriptChild("host_operation_lock_supervisor", [], {
        shell: true,
      }),
    /runtime_local_typescript_child_spawn_shell_forbidden/u,
  );
  assert.throws(
    () =>
      createRuntimeLocalTypeScriptWorker("host_operation_lock_supervisor", {}),
    /runtime_local_typescript_child_entrypoint_kind_mismatch/u,
  );
  assert.throws(
    () => createRuntimeLocalTypeScriptWorker("unknown" as never, {}),
    /runtime_local_typescript_child_entrypoint_unknown/u,
  );
  assert.throws(
    () =>
      createRuntimeLocalTypeScriptWorker("candidate_store_lock_worker", {
        eval: true,
      }),
    /runtime_local_typescript_child_worker_eval_forbidden/u,
  );
  const projectionTokens =
    runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver();
  assert.equal(projectionTokens.length, 4);
  assert.equal(
    projectionTokens.every(
      (entrypoint) =>
        Object.isFrozen(entrypoint) &&
        !("url" in entrypoint) &&
        !("filePath" in entrypoint) &&
        !("relativePath" in entrypoint),
    ),
    true,
  );
});

/**
 * developmentFixtureのTest準備責務を実行する。
 *
 * @responsibility developmentFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus developmentFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function developmentFixture(omittedEntrypoint: string | null = null) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-development-package-"),
  );
  developmentFixtureRoots.add(root);
  const distributionRoot = path.join(root, "distribution");
  const packageRoot = path.join(distributionRoot, "40_Develop", "coordinator");
  const repositoryRoot = path.resolve(coordinatorRoot, "../..");
  for (const relative of [
    "40_Develop/coordinator/package.json",
    "40_Develop/coordinator/bin",
    "40_Develop/coordinator/src",
    "40_Develop/coordinator/scripts",
    "40_Develop/ai-adapter/package.json",
    "40_Develop/ai-adapter/src",
    "40_Develop/artifact-signing/package.json",
    "40_Develop/artifact-signing/src",
    "40_Develop/cros/package.json",
    "40_Develop/cros/src",
    "40_Develop/mcp-server/package.json",
    "40_Develop/mcp-server/src",
    "40_Develop/orchestrator/package.json",
    "40_Develop/orchestrator/src",
    "40_Develop/execution-intelligence/package.json",
    "40_Develop/execution-intelligence/src",
    "40_Develop/domain-model/package.json",
    "40_Develop/domain-model/src",
    "40_Develop/version-control/package.json",
    "40_Develop/version-control/src",
    "template/tools",
    "README.md",
  ]) {
    const source = path.join(repositoryRoot, ...relative.split("/"));
    const target = path.join(distributionRoot, ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  }
  fs.rmSync(
    path.join(
      distributionRoot,
      "template",
      "tools",
      "coordinator",
      "coordinator-package-manifest.json",
    ),
    { force: true },
  );
  const oracleRoot = path.join(root, "oracle");
  fs.cpSync(distributionRoot, oracleRoot, { recursive: true });
  /**
   * gitのTest準備責務を実行する。
   *
   * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace AIT-IT-013
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus gitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  function git(...args: string[]) {
    const result = spawnSync("git", ["-C", oracleRoot, ...args], {
      encoding: "utf8",
      shell: false,
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "--quiet");
  git("-c", "core.autocrlf=false", "add", "--force", "--", ".");
  const expectedCrddTree = git("write-tree");
  const observed =
    inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
      distributionRoot,
    );
  assert.equal(
    observed.status,
    "candidate",
    JSON.stringify({
      observed,
      diagnostic:
        diagnoseRuntimeDistributionFilesystemForVerification(distributionRoot),
    }),
  );
  if (omittedEntrypoint)
    fs.unlinkSync(path.join(packageRoot, omittedEntrypoint));
  return {
    root,
    distributionRoot,
    packageRoot,
    input: {
      distributionRoot,
      expectedPackageContentRootSha256: observed.packageContentRootSha256,
    },
    expectedCrddTree,
    cleanup() {
      removeDevelopmentFixture(root);
    },
  };
}

/**
 * 開発版はRuntime依存閉包を実体照合し、署名・実行Authorityを発行しないを検証する。
 *
 * @responsibility 開発版はRuntime依存閉包を実体照合し、署名・実行Authorityを発行しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開発版はRuntime依存閉包を実体照合し、署名・実行Authorityを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("開発版はRuntime依存閉包を実体照合し、署名・実行Authorityを発行しない", () => {
  const fixture = developmentFixture();
  try {
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "candidate", JSON.stringify(result));
    assert.equal(result.executionSourceKind, "fixed_development_candidate");
    assert.equal(result.entrypoints.length, 5);
    assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
    assert.equal(result.releaseIdentityRuntimeOwned, false);
    assert.equal(result.crddDistributionConfirmed, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.networkEffectIssued, false);
    assert.equal(JSON.stringify(result).includes(fixture.root), false);
    const repeated = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(repeated.status, "candidate");
    assert.equal(repeated.sourceIdentitySha256, result.sourceIdentitySha256);
    const previousRoot = path.join(fixture.root, "previous");
    fs.renameSync(fixture.distributionRoot, previousRoot);
    fs.cpSync(previousRoot, fixture.distributionRoot, { recursive: true });
    const replaced = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(replaced.status, "candidate");
    assert.notEqual(replaced.sourceIdentitySha256, result.sourceIdentitySha256);
  } finally {
    fixture.cleanup();
  }
});

/**
 * 実行能力を持たないchild_processのtype-only importはRuntime候補を失効させないを検証する。
 *
 * @responsibility 実行能力を持たないchild_processのtype-only importはRuntime候補を失効させないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行能力を持たないchild_processのtype-only importはRuntime候補を失効させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行能力を持たないchild_processのtype-only importはRuntime候補を失効させない", () => {
  const fixture = developmentFixture();
  try {
    fs.appendFileSync(
      path.join(
        fixture.packageRoot,
        "src",
        "host-runtime",
        "candidate-store-kernel-lock.ts",
      ),
      [
        'import type { ChildProcess } from "node:child_process";',
        'import { type SpawnOptions } from "node:child_process";',
        'export type { ChildProcessWithoutNullStreams } from "node:child_process";',
        'export { type WorkerOptions } from "node:worker_threads";',
        "export type FixtureChild = ChildProcess;",
        "export type FixtureOptions = SpawnOptions;",
        "",
      ].join("\n"),
    );
    const result =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
        fixture.distributionRoot,
      );
    assert.equal(result.status, "candidate", JSON.stringify(result));
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.effectAuthorizationIssued, false);
  } finally {
    fixture.cleanup();
  }
});

/**
 * type-only star再公開は実行能力として扱わず、value star再公開だけを拒否するを検証する。
 *
 * @responsibility type-only star再公開は実行能力として扱わず、value star再公開だけを拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus type-only star再公開は実行能力として扱わず、value star再公開だけを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("type-only star再公開は実行能力として扱わず、value star再公開だけを拒否する", () => {
  assert.doesNotThrow(() =>
    assertRuntimeSourceModuleBoundaryForVerification(
      "src/index.ts",
      [
        'export type * from "node:child_process";',
        'export type * as ChildTypes from "node:child_process";',
        'export type * from "node:worker_threads";',
        'import { type Module } from "node:module";',
        'export { type Module as NodeModule } from "node:module";',
        "",
      ].join("\n"),
    ),
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        "src/index.ts",
        'export * from "node:child_process";\n',
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

/**
 * loader能力のnamespace・bracket取得と文字列再構成を直接の理由で拒否するを検証する。
 *
 * @responsibility loader能力のnamespace・bracket取得と文字列再構成を直接の理由で拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus loader能力のnamespace・bracket取得と文字列再構成を直接の理由で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("loader能力のnamespace・bracket取得と文字列再構成を直接の理由で拒否する", () => {
  for (const source of [
    'import * as moduleBuiltin from "node:module"; void moduleBuiltin.createRequire;\n',
    'import moduleBuiltin from "node:module"; void moduleBuiltin;\n',
    'export { createRequire } from "node:module";\n',
    'void process["getBuiltinModule"]?.("node:child_process");\n',
    'void process?.["getBuiltinModule"]?.("node:child_process");\n',
    'void import(["node:", "child_", "process"].join(""));\n',
  ]) {
    assert.throws(
      () =>
        assertRuntimeSourceModuleBoundaryForVerification(
          "src/host-runtime/loader-attack.ts",
          source,
        ),
      /runtime_dependency_(?:child_process|loader)_unbound/u,
    );
  }
});

/**
 * 宣言済みProcess利用側は実ソースのcall・scope・引数から完全一致を要求するを検証する。
 *
 * @responsibility 宣言済みProcess利用側は実ソースのcall・scope・引数から完全一致を要求するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 宣言済みProcess利用側は実ソースのcall・scope・引数から完全一致を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("宣言済みProcess利用側は実ソースのcall・scope・引数から完全一致を要求する", () => {
  const sourcePath = "src/candidate/candidate-store-windows-adapter.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "spawnSync(selectedExecutable, [], {",
      "spawnSync(selectedExecutable || process.argv0, [], {",
    ),
    source.replace('import { spawnSync } from "node:child_process";', ""),
    source.replace(
      "spawnSync(selectedExecutable, [], {",
      "spawnSync((selectedExecutable = process.argv0), [], {",
    ),
    source
      .replace(
        "const selectedExecutable =",
        "if (false) { const selectedExecutable =",
      )
      .replace(
        "const execution = spawnSync(selectedExecutable, [], {",
        "}\n  const execution = spawnSync(selectedExecutable, [], {",
      ),
  ]) {
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_child_process_unbound/u,
    );
  }
});

/**
 * Claude再認証のProcess WrapperをRuntime能力Graphへ完全一致させることを検証する。
 *
 * @responsibility Human-only再認証で追加したDocker CLI子Processの実行点、検証済み実行ファイル搬送およびclose所有を署名前観測へ固定する。
 * @trace AIT-IT-013
 * @precondition 固定候補と同じClaude再認証Sourceを読み取る。
 * @stimulus 現行Sourceと、実行ファイルまたはclose所有を改変した反例を宣言済みGraphへ照合する。
 * @observation Runtime Source Graphの受理または固定拒否理由を観測する。
 * @oracle 現行Sourceだけを受理し、Process実行境界の改変を拒否する。
 * @cleanup N/A: 読取りとProcess内解析だけで永続資源を作成しない。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude再認証のProcess Wrapperを署名前Runtime能力Graphへ固定する", () => {
  const sourcePath = "src/provider/claude-subscription-authentication.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "spawn(executable, command.argv, {",
      "spawn(process.execPath, command.argv, {",
    ),
    source.replace('child.once("close", finish);', "finish(null, null);"),
    source.replace(
      "const executable = verifyTrustedDockerCliSnapshot(dockerCli);",
      "const executable = dockerCli.executablePath;",
    ),
    source.replace(
      "const environment = createDockerProcessEnvironment();",
      "const environment = process.env;",
    ),
    source.replace(
      'const workingDirectory = path.win32.join(systemRoot, "System32");',
      "const workingDirectory = process.cwd();",
    ),
    source.replace(
      'if (!systemRoot)\n    throw new Error("docker_effect_working_directory_unavailable");',
      "void systemRoot;",
    ),
    source.replace(
      'if (!fs.statSync(workingDirectory).isDirectory())\n    throw new Error("docker_effect_working_directory_unavailable");',
      "void fs.statSync(workingDirectory);",
    ),
    source.replace(
      "        authorityLive,\n      );",
      "        () => true,\n      );",
    ),
  ]) {
    assert.notEqual(mutated, source);
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_child_process_(?:unbound|executable_unbound|ownership_unbound)/u,
    );
  }
});

/**
 * Native Coverageの固定された試験実行物集合からの呼出しを検証する。
 *
 * @responsibility 検査済みCargo出力の集合以外を実行する改変を拒否する。
 * @trace AIT-IT-013
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行引数、列挙元または実行前Hash検査を個別に改変する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 * @boundary ERB-IT-001/ERB-IT-002=Partial Boundary: 全Tool Source→固定Process graph。実Process lifecycleは対象外。
 */
test("Native Coverageの試験実行物は検査済み集合の固定呼出しだけを受理する", () => {
  const sources = verificationToolSources();
  const coveragePath = "scripts/check-platform-access-coverage.ts";
  const coverage = sources[coveragePath] ?? "";
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(
      coveragePath,
      coverage,
    ),
  );
  for (const [before, after] of [
    [
      "executeCommand(executable, [], {",
      'executeCommand("arbitrary.exe", [], {',
    ],
    [
      "for (const executable of testExecutables)",
      "for (const executable of binaries)",
    ],
    [
      "const artifactHashes = coverageObjects.map(",
      "const otherHashes = coverageObjects.map(",
    ],
  ] as const) {
    assert.ok(coverage.includes(before));
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          coveragePath,
          coverage.replace(before, after),
        ),
      /runtime_dependency_child_process_unbound/u,
    );
  }
});

/**
 * Native端末検証のCargo構築と実行物起動を固定された所有者へ接続する。
 *
 * @responsibility Tool専用起動の引数、実体検査、終了通知とNode入力範囲の改変を拒否する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 現行端末検証Sourceを読取り投影として取得できる。
 * @stimulus 固定Sourceを照合し、起動・実体・終了通知とNode入力をメモリ内で改変する。
 * @observation 正規Sourceの受理と各改変の拒否を取得する。
 * @oracle 二つの正式Toolだけが固定起動を利用でき、改変は拒否される。
 * @cleanup N/A: Source読取りとメモリ内改変だけで、CargoとNativeを起動しない。
 * @boundary 検証Sourceから宣言Graphへの構造検査。実Nativeの成功を主張しない。
 */
test("Native端末検証は固定構築・実体・終了所有者とNode入力範囲を維持する", () => {
  for (const sourcePath of [
    "scripts/verify-native-terminal-namespace.ts",
    "scripts/verify-native-terminal-fixtures.ts",
  ]) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, sourcePath),
      "utf8",
    );
    assert.doesNotThrow(() =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        sourcePath,
        source,
      ),
    );
    for (const [before, after] of [
      ['"--no-run",', '"--release",'],
      [
        "assert.equal(artifacts.length, 1);",
        "assert.equal(artifacts.length, 2);",
      ],
      ["fs.realpathSync(binary)", "fs.realpathSync(crate)"],
      ['child.once("close",', 'child.once("exit",'],
      ["shell: false,", "shell: true,"],
    ] as const) {
      assert.ok(source.includes(before));
      assert.throws(
        () =>
          assertRuntimeSourceDeclaredGraphBoundaryForVerification(
            sourcePath,
            source.replace(before, after),
          ),
        /runtime_dependency_(?:child_process(?:_executable|_ownership)?|capability_flow)_unbound/u,
      );
    }
    const extraNodeReference = `${source}\nconst escapedNodeBinary = process.execPath;\n`;
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          extraNodeReference,
        ),
      /runtime_dependency_(?:child_process(?:_executable|_ownership)?|capability_flow)_unbound/u,
    );
  }
});

/**
 * 全検証Toolの宣言集合と実SourceのProcess起動点を照合する。
 *
 * @responsibility 検証専用Graphの全Source・呼出し・結果搬送の欠落と改変を拒否する。
 * @trace AIT-IT-013
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 現行scriptsのSourceを読取り投影として取得できる。
 * @stimulus 全Sourceを照合し、起動引数・所有関係・結果搬送を個別に改変する。
 * @observation 固定Graphの受理と各改変の拒否を取得する。
 * @oracle 正規集合だけが受理され、欠落・追加・改変は拒否される。
 * @cleanup N/A: Source読取りとメモリ内改変のみで実Processを起動しない。
 * @boundary Sourceから検証Tool専用Graph。実NativeやProviderのlifecycleは対象外。
 */
test("検証Toolの全Sourceと実Process起動点を独立グラフとして完全一致させる", () => {
  const sources = verificationToolSources();
  assert.doesNotThrow(() =>
    assertVerificationToolCapabilityGraphForVerification(sources),
  );
  const preparationPath = "scripts/prepare-release-candidate.ts";
  const preparation = sources[preparationPath] ?? "";
  for (const [before, after] of [
    ['[launcher, "promote-release"]', '[launcher, "other-command"]'],
    ["cwd: repositoryRoot,", "cwd: workDirectory,"],
    ["bindings.runPromotion(", "bindings.runSigner("],
  ] as const) {
    assert.ok(preparation.includes(before));
    const changedPreparation = {
      ...sources,
      [preparationPath]: preparation.replace(before, after),
    };
    assert.throws(
      () =>
        assertVerificationToolCapabilityGraphForVerification(
          changedPreparation,
        ),
      /runtime_dependency_(?:child_process|capability_flow)_unbound/u,
    );
  }

  const missing = { ...sources };
  delete missing["scripts/check-dynamic-fake-provider-coverage.ts"];
  assert.throws(
    () => assertVerificationToolCapabilityGraphForVerification(missing),
    /runtime_dependency_capability_graph_mismatch/u,
  );

  const changedOptions = { ...sources };
  changedOptions["scripts/check-dynamic-fake-provider-coverage.ts"] =
    sources["scripts/check-dynamic-fake-provider-coverage.ts"]?.replace(
      "timeout: 120_000,",
      "timeout: 1,",
    ) ?? "";
  assert.throws(
    () => assertVerificationToolCapabilityGraphForVerification(changedOptions),
    /runtime_dependency_child_process_unbound/u,
  );

  const unknown = { ...sources };
  unknown["scripts/nested/unregistered-process.ts"] =
    'import { spawnSync } from "node:child_process";\nspawnSync(process.execPath, ["--version"], { shell: false });\n';
  assert.throws(
    () => assertVerificationToolCapabilityGraphForVerification(unknown),
    /runtime_dependency_child_process_unbound/u,
  );

  const loaderResultReplaced = { ...sources };
  for (const [before, after] of [
    [
      "40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime.ts",
      "40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime-internal.ts",
    ],
    [
      "recoveryModule.inspectRuntimeOwnedDockerTaskRecoveryState()",
      "recoveryModule.inspectRuntimeOwnedDockerTaskRecoveryState({})",
    ],
    [
      "const recoveryModule = (await import(",
      "const otherModule = (await import(",
    ],
  ] as const) {
    const recoveryLoaderChanged = { ...sources };
    const original =
      sources["scripts/verify-project-runtime-real-providers.ts"] ?? "";
    assert.ok(original.includes(before));
    recoveryLoaderChanged["scripts/verify-project-runtime-real-providers.ts"] =
      original.replace(before, after);
    assert.throws(
      () =>
        assertVerificationToolCapabilityGraphForVerification(
          recoveryLoaderChanged,
        ),
      /runtime_dependency_(?:loader|child_process|capability_flow)_unbound/u,
    );
  }
  loaderResultReplaced["scripts/verify-project-runtime-real-providers.ts"] =
    sources["scripts/verify-project-runtime-real-providers.ts"]?.replace(
      "const native =\n    nativeModule.verifyBundledCoordinatorPackageFromFixedManifestCandidate({",
      'const native = Object.freeze({ status: "candidate", reason: "decoy" });\n    void nativeModule.verifyBundledCoordinatorPackageFromFixedManifestCandidate({',
    ) ?? "";
  assert.throws(
    () =>
      assertVerificationToolCapabilityGraphForVerification(
        loaderResultReplaced,
      ),
    /runtime_dependency_capability_flow_unbound/u,
  );
});

/**
 * 候補昇格が統合後の単一入口と固定操作だけを利用することを確認する。
 *
 * @responsibility 起動入口の統合を固定Graphへ接続し、旧入口・別操作の再導入を拒否する。
 * @trace AIT-IT-013
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 現行の候補準備Sourceを読み取れる。
 * @stimulus 正規Sourceを照合し、Launcher名と昇格操作を個別に改変する。
 * @observation 正規Graphの受理と改変Graphの拒否を取得する。
 * @oracle 単一Coordinator入口とpromote-release操作だけが受理される。
 * @cleanup N/A: メモリ内照合だけで実署名・子Process起動は行わない。
 * @boundary 候補準備Sourceと検証Tool専用Process Graph。実署名・昇格は対象外。
 */
test("候補昇格の固定Graphは統合後の単一Coordinator入口へ接続する", () => {
  const sourcePath = "scripts/prepare-release-candidate.ts";
  const source = verificationToolSources()[sourcePath] ?? "";
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const [before, after] of [
    ['"coordinator.ts"', '"launch.ts"'],
    ['[launcher, "promote-release"]', '[launcher, "other-command"]'],
    ['storage: "signature",', 'storage: "other",'],
  ] as const) {
    assert.ok(source.includes(before));
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          source.replace(before, after),
        ),
      /runtime_dependency_(?:child_process|capability_flow)_unbound/u,
    );
  }
});

/**
 * Process wrapper注入後のproperty callと内部lifecycle callを利用側閉包へ含めるを検証する。
 *
 * @responsibility Process wrapper注入後のproperty callと内部lifecycle callを利用側閉包へ含めるの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Process wrapper注入後のproperty callと内部lifecycle callを利用側閉包へ含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Process wrapper注入後のproperty callと内部lifecycle callを利用側閉包へ含める", () => {
  const dockerPath = "src/docker-runtime/docker-effect-runtime.ts";
  const dockerSource = fs.readFileSync(
    path.join(coordinatorRoot, dockerPath),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        dockerPath,
        dockerSource.replace(
          "dependencies.startProcess(\n      DOCKER_CLI_EXECUTABLE,",
          "dependencies.startProcess(\n      process.execPath,",
        ),
      ),
    /runtime_dependency_child_process_unbound/u,
  );

  const lifecyclePath = "src/cli/interactive-console.ts";
  const lifecycleSource = fs.readFileSync(
    path.join(coordinatorRoot, lifecyclePath),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        lifecyclePath,
        lifecycleSource.replace(
          "runInteractiveConsoleReaderLifecycle(",
          "Promise.resolve(",
        ),
      ),
    /runtime_dependency_child_lifecycle_unbound/u,
  );
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        lifecyclePath,
        lifecycleSource.replace(
          "return runInteractiveConsoleReaderLifecycle(",
          "if (false) return runInteractiveConsoleReaderLifecycle(",
        ),
      ),
    /runtime_dependency_capability_flow_unbound/u,
  );
});

/**
 * 非同期子Processは同期完了・所有保持・lifecycle移管のいずれかを証明するを検証する。
 *
 * @responsibility 非同期子Processは同期完了・所有保持・lifecycle移管のいずれかを証明するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非同期子Processは同期完了・所有保持・lifecycle移管のいずれかを証明するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("非同期子Processは同期完了・所有保持・lifecycle移管のいずれかを証明する", () => {
  const cases = [
    {
      path: "src/host-runtime/runtime-local-typescript-child-entrypoints.ts",
      mutate: (source: string) =>
        source.replace(
          "return spawn(process.execPath,",
          "spawn(process.execPath,",
        ),
    },
    {
      path: "src/docker-runtime/docker-owned-process.ts",
      mutate: (source: string) =>
        source.replace('child.once("spawn",', 'child.on("spawn",'),
    },
    {
      path: "src/docker-desktop/docker-desktop-repair-native-process.ts",
      mutate: (source: string) =>
        source.replace("const created =", "const ignored ="),
    },
  ];
  for (const target of cases) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, target.path),
      "utf8",
    );
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          target.path,
          target.mutate(source),
        ),
      /runtime_dependency_child_process_ownership_unbound/u,
    );
  }
});

/**
 * 配布観測から開発・署名・導入・Capability利用側までを実ソースから閉じるを検証する。
 *
 * @responsibility 配布観測から開発・署名・導入・Capability利用側までを実ソースから閉じるの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布観測から開発・署名・導入・Capability利用側までを実ソースから閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("配布観測から開発・署名・導入・Capability利用側までを実ソースから閉じる", () => {
  const sourcePath =
    "src/platform-access/platform-provisioner-package-filesystem.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "const observed = observeRuntimeDistribution(root.realPath);",
      "const observed = observePackage(root.realPath);",
    ),
    source.replace(
      "const reverified = verifyInstalledCoordinatorPackageCandidate(request);",
      "const reverified = release;",
    ),
    source.replace(
      "const verification =\n    verifyBundledCoordinatorPackageFromFixedManifestCandidate(input);",
      "const verification = verifyBundledCoordinatorPackageCandidate(input);",
    ),
    source
      .replace(
        "const observed = observeRuntimeDistribution(root.realPath);",
        "const observed = observePackage(root.realPath);",
      )
      .replace(
        "const manifestPath = path.join(",
        "void observeRuntimeDistribution(root.realPath);\n    const manifestPath = path.join(",
      ),
  ]) {
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_(?:public_consumer|capability_flow)_unbound/u,
    );
  }
});

/**
 * Runtime Package Capabilityの宣言集合と全実利用側を完全一致させるを検証する。
 *
 * @responsibility Runtime Package Capabilityの宣言集合と全実利用側を完全一致させるの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Package Capabilityの宣言集合と全実利用側を完全一致させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime Package Capabilityの宣言集合と全実利用側を完全一致させる", () => {
  const sources = runtimeTypeScriptSources();
  assert.doesNotThrow(() =>
    assertRuntimePackageCapabilityConsumerGraphForVerification(sources),
  );

  const missing = { ...sources };
  missing["40_Develop/orchestrator/src/task/composition-root.ts"] =
    sources["40_Develop/orchestrator/src/task/composition-root.ts"]?.replace(
      "revokeRuntimeExecutionAuthorization:\n      revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,",
      "revokeRuntimeExecutionAuthorization: () => false,",
    ) ?? "";
  assert.throws(
    () => assertRuntimePackageCapabilityConsumerGraphForVerification(missing),
    /runtime_dependency_consumer_graph_mismatch/u,
  );

  const additional = { ...sources };
  additional["src/task/coordinator-task-runtime.ts"] =
    sources["src/task/coordinator-task-runtime.ts"]?.replace(
      "!consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
      "!consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(consumeRuntimeOwnedVerifiedCoordinatorPackageCapability({}),) && !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
    ) ?? "";
  assert.throws(
    () =>
      assertRuntimePackageCapabilityConsumerGraphForVerification(additional),
    /runtime_dependency_consumer_graph_mismatch/u,
  );
});

/**
 * 追加した利用側を旧版の必須集合へ混ぜないことを確認する。
 *
 * @responsibility 現行とv0.21の利用側集合を実際の選別本体で区別する。
 * @trace AIT-IT-013
 * @precondition 登録表と選別関数だけをSourceから抽出してMemoryで評価する。
 * @stimulus 現行の全件、旧版集合、旧版に新利用側を混ぜた集合を渡す。
 * @observation 選別本体の受理とconsumer_set拒否を観測する。
 * @oracle 旧版は新規三利用側を要求せず、混入は拒否する。現行は三件を要求する。
 * @cleanup N/A: VM評価のみ。OS・Native・署名操作を行わない。
 * @boundary 配布検証の版別利用側選別。下位Source解析は別の既存契約試験で確認する。
 */
test("Runtime Package Capabilityの旧版集合へ新Host利用側を混ぜない", () => {
  const source = fs.readFileSync(
    path.join(
      coordinatorRoot,
      "src/platform-access/platform-provisioner-package-filesystem.ts",
    ),
    "utf8",
  );
  const table = source.match(
    /const exactRuntimePackageCapabilityConsumers = Object\.freeze\([\s\S]*?\n\);/u,
  )?.[0];
  const body = source.match(
    /function assertExactRuntimePackageCapabilityConsumerGraph\([\s\S]*?\n\}/u,
  )?.[0];
  assert.ok(table);
  assert.ok(body);
  const scope = {
    assertRuntimePackageCapabilityHandoffClosure: () => {},
    assertReleaseAssuranceConsumerClosure: () => {},
    runtimePackageCapabilityConsumerGraphForVerification: () => scope.observed,
    observed: [] as readonly Readonly<{
      source: string;
      symbol: string;
      owner: string;
      use: string;
      occurrence: number;
    }>[],
    current: [] as readonly Readonly<{
      source: string;
      symbol: string;
      owner: string;
      use: string;
      occurrence: number;
    }>[],
    check: undefined as
      | undefined
      | ((sources: object, selection: string, profile: string) => void),
  };
  runInNewContext(
    stripTypeScriptTypes(
      `${table}\n${body}\nfunction runtimePackageCapabilityConsumerIdentity(consumer) { return [consumer.source, consumer.symbol, consumer.owner, consumer.use, consumer.occurrence].join("\\0"); }\nglobalThis.current = exactRuntimePackageCapabilityConsumers; globalThis.check = assertExactRuntimePackageCapabilityConsumerGraph;`,
    ),
    scope,
  );
  assert.ok(scope.check);
  const hostGraphs = scope.current.filter((item) =>
    [
      "src/host-runtime/host-recovery-namespace-windows-adapter.ts",
      "src/host-runtime/host-terminal-windows-adapter.ts",
    ].includes(item.source),
  );
  assert.equal(hostGraphs.length, 3);
  const legacyGraphs = scope.current.filter(
    (item) =>
      ![
        "src/workbench-ai/workbench-ai-advice-production-runtime.ts",
        "src/workbench-ai/workbench-ai-change-candidate-runtime.ts",
        "src/host-runtime/host-recovery-namespace-windows-adapter.ts",
        "src/host-runtime/host-terminal-windows-adapter.ts",
      ].includes(item.source),
  );
  scope.observed = scope.current;
  assert.doesNotThrow(() => scope.check?.({}, "repository", "current"));
  scope.observed = legacyGraphs;
  assert.doesNotThrow(() => scope.check?.({}, "repository", "v0.21"));
  assert.throws(
    () => scope.check?.({}, "repository", "current"),
    /consumer_set/u,
  );
  scope.observed = [...legacyGraphs, ...hostGraphs];
  assert.throws(
    () => scope.check?.({}, "repository", "v0.21"),
    /consumer_set/u,
  );
});

/**
 * 旧修復と新再起動のRuntime Identityは所有関数ごとにCanonical検証値を要求するを検証する。
 *
 * @responsibility 旧修復と新再起動のRuntime Identityは所有関数ごとにCanonical検証値を要求するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧修復と新再起動のRuntime Identityは所有関数ごとにCanonical検証値を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("旧修復と新再起動のRuntime Identityは所有関数ごとにCanonical検証値を要求する", () => {
  const sources = runtimeTypeScriptSources();
  const sourcePath = "src/docker-runtime/docker-recovery-runtime-internal.ts";
  const source = sources[sourcePath];
  assert.ok(source);
  for (const owner of [
    "recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart",
    "prepareRuntimeOwnedDockerRestart",
    "recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart",
  ]) {
    const start = source.indexOf(`export function ${owner}(`);
    assert.ok(start >= 0);
    const suffix = source.slice(start);
    const altered =
      source.slice(0, start) +
      suffix.replace(
        /runtimeExecutionIdentitySha256:\s*verification\.runtimeExecutionIdentitySha256/u,
        "runtimeExecutionIdentitySha256: callerIdentity",
      );
    assert.notEqual(altered, source);
    assert.throws(
      () =>
        assertRuntimePackageCapabilityConsumerGraphForVerification({
          ...sources,
          [sourcePath]: altered,
        }),
      /assurance_consumer:recovery_runtime_identity:shape/u,
    );
  }
});

/**
 * 実行能力の反証は利用側伝播の意図したphaseで拒否するを検証する。
 *
 * @responsibility 実行能力の反証は利用側伝播の意図したphaseで拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行能力の反証は利用側伝播の意図したphaseで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行能力の反証は利用側伝播の意図したphaseで拒否する", () => {
  const sources = runtimeTypeScriptSources();
  const cases = [
    {
      phase: "consumer_import",
      path: "40_Develop/orchestrator/src/task/composition-root.ts",
      from: "issueRuntimeOwnedVerifiedCoordinatorPackageCapability,",
      to: "issueRuntimeOwnedVerifiedCoordinatorPackageCapability as issueCapability,",
    },
    {
      phase: "consumer_handoff",
      path: "40_Develop/orchestrator/src/task/execution-authorization-adapter.ts",
      from: "value: capability,",
      to: "value: { ...capability },",
    },
    {
      phase: "consumer_handoff",
      path: "40_Develop/orchestrator/src/task/execution-authorization-adapter.ts",
      from: 'reason: "project_runtime_execution_authorization_revoked",\n              value: null,',
      to: 'reason: "project_runtime_execution_authorization_revoked",\n              value: capability,',
    },
    {
      phase: "consumer_handoff",
      path: "40_Develop/orchestrator/src/application/project-runtime-execution.ts",
      from: "? issuedAuthorization.value\n              : null;",
      to: "? {}\n              : null;",
    },
    {
      phase: "consumer_handoff",
      path: "40_Develop/orchestrator/src/application/project-runtime-execution.ts",
      from: "runtimeExecutionCapability,\n            taskRequest:",
      to: "runtimeExecutionCapability: {},\n            taskRequest:",
    },
    {
      phase: "consumer_import",
      path: "src/task/coordinator-task-runtime.ts",
      from: "!consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(\n      verifiedPackageCapability,",
      to: "!decoy.consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(\n      verifiedPackageCapability,",
    },
    {
      phase: "consumer_handoff",
      path: "src/task/coordinator-task-runtime.ts",
      from: "  if (\n    !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
      to: "  void productionRuntime.start(rawRequest, repositoryRoot, new Date().toISOString(), recoveryCorrelationId);\n  if (\n    !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
    },
    {
      phase: "assurance_consumer",
      path: "scripts/promote-release-manifest.ts",
      from: "expectedRelease: release.expected,",
      to: "expectedRelease: { ...release.expected },",
    },
    {
      phase: "assurance_consumer",
      path: "scripts/promote-release-manifest.ts",
      from: "sourceCommit: release.expected.crddCommit,",
      to: "sourceCommit: release.expected.crddTree,",
    },
    {
      phase: "assurance_consumer",
      path: "src/docker-runtime/docker-recovery-runtime-internal.ts",
      from: "crddManifestHash: verification.manifestHash,",
      to: 'crddManifestHash: "forged",',
    },
    {
      phase: "assurance_consumer",
      path: "src/docker-runtime/docker-recovery-runtime-internal.ts",
      from: "runtimeExecutionIdentitySha256:\n          verification.runtimeExecutionIdentitySha256,",
      to: 'runtimeExecutionIdentitySha256: "forged",',
    },
  ] as const;
  for (const scenario of cases) {
    const mutated = { ...sources };
    const before = mutated[scenario.path] ?? "";
    mutated[scenario.path] = before.replace(scenario.from, scenario.to);
    assert.notEqual(mutated[scenario.path], before, scenario.path);
    const result =
      runtimePackageCapabilityConsumerGraphDiagnosticForVerification(mutated);
    assert.equal(result.status, "blocked");
    assert.equal(result.phase, scenario.phase, result.reason);
    assert.equal(
      result.publicReason,
      "platform_provisioner_runtime_dependency_consumer_graph_mismatch",
    );
    assert.equal(result.runtimeExecution, "not_performed");
    assert.throws(
      () => assertRuntimePackageCapabilityConsumerGraphForVerification(mutated),
      /platform_provisioner_runtime_dependency_consumer_graph_mismatch/u,
    );
  }
});

/**
 * 署名入口は配布観測結果を秘密入力前の検査と署名結果へ同じflowで伝播するを検証する。
 *
 * @responsibility 署名入口は配布観測結果を秘密入力前の検査と署名結果へ同じflowで伝播するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名入口は配布観測結果を秘密入力前の検査と署名結果へ同じflowで伝播するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名入口は配布観測結果を秘密入力前の検査と署名結果へ同じflowで伝播する", () => {
  const source = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertReleaseSigningConsumerClosureForVerification(source),
  );
  for (const mutated of [
    source.replace(
      "preflightReleaseManifest(options);",
      "void preflightReleaseManifest;",
    ),
    source.replace(
      "packageContentRootSha256: packageObservation.packageContentRootSha256,",
      "packageContentRootSha256: compiled.payload.packageContentRootSha256,",
    ),
    source.replace(
      'const passphrase = await readHiddenLine("Release key passphrase: ");',
      'const passphrase = "not-observed";',
    ),
    source.replace(
      "compilePlatformProvisionerManifestPayloadCandidate,",
      "compilePlatformProvisionerManifestPayloadCandidate as compilePayload,",
    ),
    source.replace("signature: signature.signature,", 'signature: "forged",'),
    source.replace(
      "payload: compiled.payload,",
      "payload: { ...compiled.payload },",
    ),
  ])
    assert.throws(
      () => assertReleaseSigningConsumerClosureForVerification(mutated),
      /runtime_dependency_signing_consumer_unbound/u,
    );
});

/**
 * 署名の保護対象flowを同名decoy・事前Effect・条件付き証明で迂回できないを検証する。
 *
 * @responsibility 署名の保護対象flowを同名decoy・事前Effect・条件付き証明で迂回できないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名の保護対象flowを同名decoy・事前Effect・条件付き証明で迂回できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名の保護対象flowを同名decoy・事前Effect・条件付き証明で迂回できない", () => {
  const source = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  const mutations = [
    `function main() {}\n${source}`,
    `function decoy() { function signReleaseManifest() {} }\n${source}`,
    `await main();\n${source}`,
    `readHiddenLine("before-main");\n${source}`,
    `fs["readFileSync"]("before-main");\n${source}`,
    `Reflect.get(fs, "readFileSync")("before-main");\n${source}`,
    `class BeforeMain { static value = readHiddenLine("before-main"); }\n${source}`,
    `[0].map(() => readHiddenLine("before-main"));\n${source}`,
    source.replace(
      "export async function main(args: string[] = process.argv.slice(2)) {",
      'export async function main(args: string[] = process.argv.slice(2), value = readHiddenLine("before-main")) {',
    ),
    source.replace(
      "preflightReleaseManifest(options);",
      "if (false) preflightReleaseManifest(options);",
    ),
  ];
  for (const mutated of mutations) {
    assert.notEqual(mutated, source, "反証が現行Sourceへ作用したこと");
    assert.throws(
      () => assertReleaseSigningConsumerClosureForVerification(mutated),
      /runtime_dependency_signing_consumer_unbound/u,
    );
  }
});

/**
 * 署名の反証は意図した保護phaseで最初に拒否しEffect経路へ到達させないを検証する。
 *
 * @responsibility 署名の反証は意図した保護phaseで最初に拒否しEffect経路へ到達させないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名の反証は意図した保護phaseで最初に拒否しEffect経路へ到達させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名の反証は意図した保護phaseで最初に拒否しEffect経路へ到達させない", () => {
  const source = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  const cases = [
    {
      phase: "binding_use",
      mutate: (value: string) =>
        value.replace(
          "export async function main(args: string[] = process.argv.slice(2)) {",
          "export async function main(args: string[] = process.argv.slice(2)) {\n  const readHiddenLine = () => Promise.resolve('forged');",
        ),
    },
    {
      phase: "binding_use",
      mutate: (value: string) =>
        `class HiddenPrompt { static value = readHiddenLine('forged'); }\n${value}`,
    },
    {
      phase: "call_graph",
      mutate: (value: string) =>
        value.replace(
          "const preflight = preflightReleaseManifest(options);",
          "const preflight = false ? preflightReleaseManifest(options) : preflightReleaseManifest(options);",
        ),
    },
    {
      phase: "binding_use",
      mutate: (value: string) =>
        value.replace(
          "const preflight = preflightReleaseManifest(options);",
          "const early = await readHiddenLine('early');\n  void early;\n  const preflight = preflightReleaseManifest(options);",
        ),
    },
    {
      phase: "call_graph",
      mutate: (value: string) =>
        value.replace(
          "preflight.authorization, passphrase",
          "{ ...preflight.authorization }, passphrase",
        ),
    },
  ] as const;
  for (const scenario of cases) {
    const mutated = scenario.mutate(source);
    assert.notEqual(mutated, source);
    const result =
      releaseSigningProtectedPathDiagnosticForVerification(mutated);
    assert.equal(result.status, "blocked");
    assert.equal(result.phase, scenario.phase, result.reason);
    assert.equal(
      result.publicReason,
      "platform_provisioner_runtime_dependency_signing_consumer_unbound",
    );
    assert.equal(result.runtimeExecution, "not_performed");
    assert.throws(
      () => assertReleaseSigningConsumerClosureForVerification(mutated),
      /platform_provisioner_runtime_dependency_signing_consumer_unbound/u,
    );
  }
});

/**
 * 公開結果はCanonical観測値を欠落・再解釈・混合せず投影するを検証する。
 *
 * @responsibility 公開結果はCanonical観測値を欠落・再解釈・混合せず投影するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開結果はCanonical観測値を欠落・再解釈・混合せず投影するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開結果はCanonical観測値を欠落・再解釈・混合せず投影する", () => {
  const sourcePath =
    "src/platform-access/platform-provisioner-package-filesystem.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "packageName: observed.observation.packageName,",
      "packageName: observed.observation.packageVersion,",
    ),
    source.replace(
      "packageContentRootSha256: observed.contentRoot.packageContentRootSha256,",
      'packageContentRootSha256: observed.contentRoot.packageContentRootSha256 ?? "",',
    ),
    source.replace(
      "packageByteLength: observed.packageByteLength,",
      "packageByteLength: observed.packageByteLength, additional: true,",
    ),
  ])
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_capability_flow_unbound/u,
    );
});

/**
 * 利用者向けCoordinatorまたはMCP Launcherの欠落をRuntime候補として受理しないを検証する。
 *
 * @responsibility 利用者向けCoordinatorまたはMCP Launcherの欠落をRuntime候補として受理しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 利用者向けCoordinatorまたはMCP Launcherの欠落をRuntime候補として受理しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("利用者向けCoordinatorまたはMCP Launcherの欠落をRuntime候補として受理しない", () => {
  for (const launcher of ["crdd-coordinator.ts", "crdd-mcp.ts"]) {
    const fixture = developmentFixture();
    try {
      fs.unlinkSync(
        path.join(fixture.distributionRoot, "template", "tools", launcher),
      );
      const result =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          fixture.distributionRoot,
        );
      assert.equal(result.status, "blocked");
      assert.equal(result.runtimeAuthorityConferred, false);
    } finally {
      fixture.cleanup();
    }
  }
});

/**
 * Tree一致だけで起動entrypointの不足を受理しないを検証する。
 *
 * @responsibility Tree一致だけで起動entrypointの不足を受理しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Tree一致だけで起動entrypointの不足を受理しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Tree一致だけで起動entrypointの不足を受理しない", () => {
  const fixture = developmentFixture("src/cli/interactive-console-reader.ts");
  try {
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "development_package_observation_failed");
  } finally {
    fixture.cleanup();
  }
});

/**
 * 新しいlocal TypeScript子entrypoint宣言の必須Registry登録漏れを受理しないを検証する。
 *
 * @responsibility 新しいlocal TypeScript子entrypoint宣言の必須Registry登録漏れを受理しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 新しいlocal TypeScript子entrypoint宣言の必須Registry登録漏れを受理しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("新しいlocal TypeScript子entrypoint宣言の必須Registry登録漏れを受理しない", () => {
  const fixture = developmentFixture();
  try {
    fs.appendFileSync(
      path.join(
        fixture.packageRoot,
        "src",
        "host-runtime",
        "runtime-local-typescript-child-entrypoints.ts",
      ),
      'declareLocalTypeScriptChildEntrypoint("candidate_store_lock_worker", "worker", "./unregistered-child.ts", import.meta.url,);\n',
    );
    fs.writeFileSync(
      path.join(
        fixture.packageRoot,
        "src",
        "host-runtime",
        "unregistered-child.ts",
      ),
      "export {};\n",
    );
    const result =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
        fixture.distributionRoot,
      );
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.effectAuthorizationIssued, false);
  } finally {
    fixture.cleanup();
  }
});

for (const scenario of [
  "variable_declaration",
  "template_declaration",
  "direct_url",
  "direct_worker",
  "direct_process_exec",
  "registered_without_declaration",
  "declared_without_use",
  "use_without_declaration",
  "variable_use",
  "template_use",
  "duplicate_path",
  "wrong_wrapper_kind",
  "worker_namespace",
  "worker_dynamic_import",
  "bare_worker_threads",
  "same_name_local_function",
  "wrapper_alias_import",
  "wrapper_reexport",
  "wrapper_function_value",
  "process_alias",
  "reflect_exec_path",
  "concatenated_url",
  "observer_projection_import",
  "recovery_direct_spawn",
  "old_caller_factory",
  "direct_fork",
  "process_argv0",
  "process_argv_index_zero",
  "process_argv_at_zero",
  "literal_node",
  "literal_node_exe",
  "worker_reexport",
  "worker_require",
  "wrapper_type_import",
  "query_specifier",
  "fragment_specifier",
  "percent_encoded_specifier",
  "child_process_reexport_bridge",
  "child_process_require",
  "fork_function_value",
  "fork_parenthesized",
  "fork_call",
  "fork_apply",
  "fork_bind",
  "fork_reflect_apply",
  "parenthesized_node_target",
  "optional_node_target",
  "node_variable_target",
  "argv0_variable_target",
  "query_process_target",
  "fragment_process_target",
  "percent_process_target",
  "encoded_separator_process_target",
  "unused_unknown_owner_spawn",
  "unused_known_owner_primitive",
  "unused_fork_import",
  "immediate_create_require",
  "parenthesized_loader",
  "loader_call",
  "process_builtin_loader",
  "worker_process_builtin_loader",
  "bracket_argv0_allowed_owner",
  "bracket_argv_index_allowed_owner",
  "internal_lifecycle_sibling_import",
  "internal_lifecycle_reexport",
  "internal_lifecycle_dynamic_import",
  "internal_lifecycle_alias_import",
  "escaped_child_process_specifier",
  "template_worker_threads_specifier",
  "optional_bracket_argv0_allowed_owner",
  "semicolonless_value_reexport",
  "concatenated_dynamic_import",
  "create_require_namespace",
  "start_owned_process_sibling_import",
  "absolute_node_allowed_owner",
] as const) {
  /**
   * local TypeScript子entrypointの宣言・利用迂回を拒否する: ${scenario}を検証する。
   *
   * @responsibility local TypeScript子entrypointの宣言・利用迂回を拒否する: ${scenario}の合否判定を所有する。
   * @trace AIT-IT-013
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus local TypeScript子entrypointの宣言・利用迂回を拒否する: ${scenario}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`local TypeScript子entrypointの宣言・利用迂回を拒否する: ${scenario}`, () => {
    const fixture = developmentFixture();
    try {
      const declarationModule = path.join(
        fixture.packageRoot,
        "src",
        "host-runtime",
        "runtime-local-typescript-child-entrypoints.ts",
      );
      const consumer = path.join(
        fixture.packageRoot,
        "src",
        "host-runtime",
        "candidate-store-kernel-lock.ts",
      );
      if (scenario === "variable_declaration")
        fs.appendFileSync(
          declarationModule,
          'const extraChild = "./unregistered-child.ts"; declareLocalTypeScriptChildEntrypoint("candidate_store_lock_worker", "worker", extraChild, import.meta.url);\n',
        );
      if (scenario === "template_declaration")
        fs.appendFileSync(
          declarationModule,
          'declareLocalTypeScriptChildEntrypoint("candidate_store_lock_worker", "worker", `./unregistered-child.ts`, import.meta.url);\n',
        );
      if (scenario === "direct_url")
        fs.appendFileSync(
          consumer,
          'new URL("./unregistered-child.ts", import.meta.url);\n',
        );
      if (scenario === "direct_worker")
        fs.appendFileSync(
          consumer,
          'import { Worker as ThreadWorker } from "node:worker_threads"; new ThreadWorker(new URL("./unregistered-child.ts", import.meta.url));\n',
        );
      if (scenario === "direct_process_exec")
        fs.appendFileSync(
          consumer,
          'spawn(process["execPath"], ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "registered_without_declaration") {
        const source = fs.readFileSync(declarationModule, "utf8");
        fs.writeFileSync(
          declarationModule,
          source.replace(
            [
              "  declareLocalTypeScriptChildEntrypoint(",
              '    "host_operation_lock_supervisor",',
              '    "spawn",',
              '    "./host-operation-lock-supervisor.ts",',
              "    import.meta.url,",
              "  ),",
              "",
            ].join("\n"),
            "",
          ),
        );
        assert.notEqual(
          fs.readFileSync(declarationModule, "utf8"),
          source,
          scenario,
        );
      }
      if (scenario === "declared_without_use") {
        const source = fs.readFileSync(consumer, "utf8");
        fs.writeFileSync(
          consumer,
          source.replace(
            '      "host_operation_lock_supervisor",',
            '      "candidate_store_lock_worker",',
          ),
        );
        assert.notEqual(fs.readFileSync(consumer, "utf8"), source, scenario);
      }
      if (scenario === "use_without_declaration") {
        const source = fs.readFileSync(declarationModule, "utf8");
        fs.writeFileSync(
          declarationModule,
          source.replace(
            [
              "  declareLocalTypeScriptChildEntrypoint(",
              '    "host_operation_lock_supervisor",',
              '    "spawn",',
              '    "./host-operation-lock-supervisor.ts",',
              "    import.meta.url,",
              "  ),",
              "",
            ].join("\n"),
            "",
          ),
        );
        assert.notEqual(
          fs.readFileSync(declarationModule, "utf8"),
          source,
          scenario,
        );
      }
      if (scenario === "variable_use")
        fs.appendFileSync(
          consumer,
          'const childRole = "candidate_store_lock_worker"; createRuntimeLocalTypeScriptWorker(childRole, {});\n',
        );
      if (scenario === "template_use")
        fs.appendFileSync(
          consumer,
          "createRuntimeLocalTypeScriptWorker(`candidate_store_lock_worker`, {});\n",
        );
      if (scenario === "duplicate_path") {
        const source = fs.readFileSync(declarationModule, "utf8");
        fs.writeFileSync(
          declarationModule,
          source.replace(
            '"../cli/interactive-console-reader.ts"',
            '"./host-operation-lock-supervisor.ts"',
          ),
        );
      }
      if (scenario === "wrong_wrapper_kind")
        fs.appendFileSync(
          consumer,
          'spawnRuntimeLocalTypeScriptChild(spawn, "candidate_store_lock_worker", [], {});\n',
        );
      if (scenario === "worker_namespace")
        fs.appendFileSync(
          consumer,
          'import * as threads from "node:worker_threads"; new threads.Worker("./unregistered-child.ts");\n',
        );
      if (scenario === "worker_dynamic_import")
        fs.appendFileSync(
          consumer,
          'const threads = await import("node:worker_threads"); new threads.Worker("./unregistered-child.ts");\n',
        );
      if (scenario === "bare_worker_threads")
        fs.appendFileSync(
          consumer,
          'import { Worker } from "worker_threads"; new Worker("./unregistered-child.ts");\n',
        );
      if (scenario === "same_name_local_function")
        fs.appendFileSync(
          consumer,
          "function createRuntimeLocalTypeScriptWorker() {}\n",
        );
      if (scenario === "wrapper_alias_import")
        fs.appendFileSync(
          consumer,
          'import { createRuntimeLocalTypeScriptWorker as createWorker } from "./runtime-local-typescript-child-entrypoints.ts"; createWorker("candidate_store_lock_worker", {});\n',
        );
      if (scenario === "wrapper_reexport")
        fs.appendFileSync(
          consumer,
          'export { createRuntimeLocalTypeScriptWorker } from "./runtime-local-typescript-child-entrypoints.ts";\n',
        );
      if (scenario === "wrapper_function_value")
        fs.appendFileSync(
          consumer,
          "const factory = createRuntimeLocalTypeScriptWorker; void factory;\n",
        );
      if (scenario === "process_alias")
        fs.appendFileSync(
          consumer,
          'const runtimeProcess = process; spawn(runtimeProcess.execPath, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "reflect_exec_path")
        fs.appendFileSync(
          consumer,
          'spawn(Reflect.get(process, "execPath"), ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "concatenated_url")
        fs.appendFileSync(
          consumer,
          'new URL("./unregistered-child." + "ts", import.meta.url);\n',
        );
      if (scenario === "observer_projection_import")
        fs.appendFileSync(
          consumer,
          'import { runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver } from "./runtime-local-typescript-child-entrypoints.ts"; runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver();\n',
        );
      if (scenario === "recovery_direct_spawn")
        fs.appendFileSync(
          path.join(
            fixture.packageRoot,
            "scripts",
            "verify-signed-recovery-matrix.ts",
          ),
          'spawn(process.execPath, ["./verify-signed-recovery-matrix.ts"]);\n',
        );
      if (scenario === "old_caller_factory")
        fs.appendFileSync(
          consumer,
          'spawnRuntimeLocalTypeScriptChild(spawn, "host_operation_lock_supervisor", [], {});\n',
        );
      if (scenario === "direct_fork")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; fork("./unregistered-child.ts");\n',
        );
      if (scenario === "process_argv0")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn(process.argv0, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "process_argv_index_zero")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn(process.argv[0], ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "process_argv_at_zero")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn(process.argv.at(0), ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "literal_node")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn("node", ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "literal_node_exe")
        fs.appendFileSync(
          consumer,
          'import { execFile } from "node:child_process"; execFile("node.exe", ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "worker_reexport")
        fs.appendFileSync(
          consumer,
          'export { Worker } from "node:worker_threads";\n',
        );
      if (scenario === "worker_require")
        fs.appendFileSync(
          consumer,
          'const threads = require("node:worker_threads"); void threads.Worker;\n',
        );
      if (scenario === "wrapper_type_import")
        fs.appendFileSync(
          consumer,
          'import { type createRuntimeLocalTypeScriptWorker } from "./runtime-local-typescript-child-entrypoints.ts";\n',
        );
      if (scenario === "query_specifier")
        fs.appendFileSync(consumer, 'import "./unregistered-child.ts?raw";\n');
      if (scenario === "fragment_specifier")
        fs.appendFileSync(
          consumer,
          'import "./unregistered-child.ts#child";\n',
        );
      if (scenario === "percent_encoded_specifier")
        fs.appendFileSync(consumer, 'import "./unregistered%2Dchild.ts";\n');
      if (scenario === "child_process_reexport_bridge") {
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "host-runtime",
            "child-bridge.ts",
          ),
          'export { spawn as launch } from "node:child_process";\n',
        );
        fs.appendFileSync(
          consumer,
          'import { launch } from "./child-bridge.ts"; launch(process.argv0, ["./unregistered-child.ts"]);\n',
        );
      }
      if (scenario === "child_process_require")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const child = load("node:child_process"); child.spawn(process.argv0, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "fork_function_value")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; const launch = fork; void launch;\n',
        );
      if (scenario === "fork_parenthesized")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; (fork)("./unregistered-child.ts");\n',
        );
      if (scenario === "fork_call")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; fork.call(undefined, "./unregistered-child.ts");\n',
        );
      if (scenario === "fork_apply")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; fork.apply(undefined, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "fork_bind")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; const launch = fork.bind(undefined); void launch;\n',
        );
      if (scenario === "fork_reflect_apply")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; Reflect.apply(fork, undefined, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "parenthesized_node_target")
        fs.appendFileSync(
          declarationModule,
          'spawn((process.argv0), ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "optional_node_target")
        fs.appendFileSync(
          declarationModule,
          'spawn(process?.argv0, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "node_variable_target")
        fs.appendFileSync(
          declarationModule,
          'const unboundNodeTarget = "./unregistered-child.ts"; spawn("node", [unboundNodeTarget]);\n',
        );
      if (scenario === "argv0_variable_target")
        fs.appendFileSync(
          declarationModule,
          'const unboundArgvTarget = "./unregistered-child.ts"; spawn(process.argv0, [unboundArgvTarget]);\n',
        );
      if (
        [
          "query_process_target",
          "fragment_process_target",
          "percent_process_target",
          "encoded_separator_process_target",
        ].includes(scenario)
      ) {
        const target =
          scenario === "query_process_target"
            ? "./unregistered-child.ts?run"
            : scenario === "fragment_process_target"
              ? "./unregistered-child.ts#run"
              : scenario === "percent_process_target"
                ? "./unregistered-child.%74%73"
                : "./nested%2Funregistered-child.ts";
        fs.appendFileSync(
          declarationModule,
          `import { fileURLToPath } from "node:url"; spawn(process.argv0, [fileURLToPath(new URL("${target}", import.meta.url))]);\n`,
        );
      }
      if (scenario === "unused_unknown_owner_spawn")
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import { spawn } from "node:child_process";\n',
        );
      if (scenario === "unused_known_owner_primitive")
        fs.appendFileSync(
          consumer,
          'import { execFile } from "node:child_process";\n',
        );
      if (scenario === "unused_fork_import")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process";\n',
        );
      if (scenario === "immediate_create_require")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const child = createRequire(import.meta.url)("node:child_process"); void child;\n',
        );
      if (scenario === "parenthesized_loader")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const child = (load)("node:child_process"); void child;\n',
        );
      if (scenario === "loader_call")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const child = load.call(undefined, "node:child_process"); void child;\n',
        );
      if (scenario === "process_builtin_loader")
        fs.appendFileSync(
          consumer,
          'const child = process.getBuiltinModule?.("node:child_process"); void child;\n',
        );
      if (scenario === "worker_process_builtin_loader")
        fs.appendFileSync(
          consumer,
          "const threads = process.getBuiltinModule?.(`node:worker_threads`); void threads;\n",
        );
      if (
        scenario === "bracket_argv0_allowed_owner" ||
        scenario === "bracket_argv_index_allowed_owner" ||
        scenario === "optional_bracket_argv0_allowed_owner"
      ) {
        const owner = path.join(
          fixture.packageRoot,
          "src",
          "docker-runtime",
          "docker-owned-process.ts",
        );
        fs.writeFileSync(
          owner,
          [
            'import { spawn } from "node:child_process";',
            scenario === "bracket_argv0_allowed_owner"
              ? 'spawn(process["argv0"], ["./unregistered-child.ts"]);'
              : scenario === "bracket_argv_index_allowed_owner"
                ? 'spawn(process.argv["0"], ["./unregistered-child.ts"]);'
                : 'spawn(process?.["argv0"], ["./unregistered-child.ts"]);',
            "",
          ].join("\n"),
        );
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import "./docker-runtime/docker-owned-process.ts";\n',
        );
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "docker-runtime",
            "unregistered-child.ts",
          ),
          "export {};\n",
        );
      }
      if (
        [
          "internal_lifecycle_sibling_import",
          "internal_lifecycle_reexport",
          "internal_lifecycle_dynamic_import",
          "internal_lifecycle_alias_import",
        ].includes(scenario)
      ) {
        const sibling = path.join(
          fixture.packageRoot,
          "src",
          "docker-runtime",
          "docker-owned-process.ts",
        );
        const importSource =
          scenario === "internal_lifecycle_reexport"
            ? 'export { runInteractiveConsoleReaderLifecycle } from "../cli/interactive-console-reader-lifecycle-internal.ts";\n'
            : scenario === "internal_lifecycle_dynamic_import"
              ? 'void import("../cli/interactive-console-reader-lifecycle-internal.ts");\n'
              : scenario === "internal_lifecycle_alias_import"
                ? 'import { runInteractiveConsoleReaderLifecycle as run } from "../cli/interactive-console-reader-lifecycle-internal.ts"; void run;\n'
                : 'import { runInteractiveConsoleReaderLifecycle } from "../cli/interactive-console-reader-lifecycle-internal.ts"; void runInteractiveConsoleReaderLifecycle;\n';
        fs.writeFileSync(sibling, importSource);
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "cli",
            "interactive-console-reader-lifecycle-internal.ts",
          ),
          "export function runInteractiveConsoleReaderLifecycle() {}\n",
        );
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import "./docker-runtime/docker-owned-process.ts";\n',
        );
      }
      if (scenario === "escaped_child_process_specifier")
        fs.appendFileSync(
          consumer,
          'const protectedModule = "node:\\u0063hild_process"; void protectedModule;\n',
        );
      if (scenario === "template_worker_threads_specifier")
        fs.appendFileSync(
          consumer,
          "const protectedModule = `node:worker_threads`; void protectedModule;\n",
        );
      if (scenario === "semicolonless_value_reexport")
        fs.appendFileSync(
          consumer,
          'import type { ChildProcess } from "node:child_process"\nexport { spawn } from "node:child_process"\n',
        );
      if (scenario === "concatenated_dynamic_import")
        fs.appendFileSync(
          consumer,
          'const protectedName = "node:" + "child_process"; void import(protectedName);\n',
        );
      if (scenario === "create_require_namespace")
        fs.appendFileSync(
          consumer,
          'import * as moduleBuiltin from "node:module"; const load = moduleBuiltin.createRequire(import.meta.url); void load("node:child_process");\n',
        );
      if (scenario === "start_owned_process_sibling_import") {
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "docker-runtime",
            "docker-owned-process.ts",
          ),
          "export function startOwnedProcess() {}\n",
        );
        fs.appendFileSync(
          consumer,
          'import { startOwnedProcess } from "./docker-owned-process.ts"; void startOwnedProcess;\n',
        );
      }
      if (scenario === "absolute_node_allowed_owner") {
        const owner = path.join(
          fixture.packageRoot,
          "src",
          "docker-runtime",
          "docker-owned-process.ts",
        );
        fs.writeFileSync(
          owner,
          [
            'import { spawn } from "node:child_process";',
            'export function startOwnedProcess() { return spawn("C:\\\\Program Files\\\\nodejs\\\\node.exe", ["./unregistered-child.ts"]); }',
            "",
          ].join("\n"),
        );
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import "./docker-runtime/docker-owned-process.ts";\n',
        );
      }
      const directBoundaryExpectations = new Map<
        string,
        Readonly<{ relativePath: string; reason: RegExp }>
      >([
        [
          "unused_unknown_owner_spawn",
          {
            relativePath: "src/index.ts",
            reason: /runtime_dependency_child_process_unbound/u,
          },
        ],
        ...[
          "unused_known_owner_primitive",
          "unused_fork_import",
          "immediate_create_require",
          "parenthesized_loader",
          "loader_call",
          "process_builtin_loader",
          "escaped_child_process_specifier",
          "semicolonless_value_reexport",
          "concatenated_dynamic_import",
          "create_require_namespace",
          "start_owned_process_sibling_import",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/host-runtime/candidate-store-kernel-lock.ts",
                reason: /runtime_dependency_child_process_unbound/u,
              },
            ] as const,
        ),
        [
          "absolute_node_allowed_owner",
          {
            relativePath: "src/docker-runtime/docker-owned-process.ts",
            reason: /runtime_dependency_child_process_unbound/u,
          },
        ],
        ...[
          "worker_process_builtin_loader",
          "template_worker_threads_specifier",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/host-runtime/candidate-store-kernel-lock.ts",
                reason: /runtime_dependency_child_worker_unbound/u,
              },
            ] as const,
        ),
        ...[
          "bracket_argv0_allowed_owner",
          "bracket_argv_index_allowed_owner",
          "optional_bracket_argv0_allowed_owner",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/docker-runtime/docker-owned-process.ts",
                reason: /runtime_dependency_child_process_unbound/u,
              },
            ] as const,
        ),
        ...[
          "internal_lifecycle_sibling_import",
          "internal_lifecycle_reexport",
          "internal_lifecycle_dynamic_import",
          "internal_lifecycle_alias_import",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/docker-runtime/docker-owned-process.ts",
                reason: /runtime_dependency_child_lifecycle_unbound/u,
              },
            ] as const,
        ),
      ]);
      const directExpectation = directBoundaryExpectations.get(scenario);
      if (directExpectation) {
        const source = fs.readFileSync(
          path.join(fixture.packageRoot, directExpectation.relativePath),
          "utf8",
        );
        assert.throws(
          () =>
            assertRuntimeSourceModuleBoundaryForVerification(
              directExpectation.relativePath,
              source,
            ),
          directExpectation.reason,
          scenario,
        );
      }
      if (
        scenario === "variable_declaration" ||
        scenario === "template_declaration" ||
        scenario === "direct_url" ||
        scenario === "child_process_reexport_bridge" ||
        scenario === "child_process_require" ||
        scenario === "fork_parenthesized" ||
        scenario === "fork_call" ||
        scenario === "fork_apply" ||
        scenario === "fork_bind" ||
        scenario === "fork_reflect_apply" ||
        scenario === "parenthesized_node_target" ||
        scenario === "optional_node_target" ||
        scenario === "node_variable_target" ||
        scenario === "argv0_variable_target" ||
        scenario === "query_process_target" ||
        scenario === "fragment_process_target" ||
        scenario === "percent_process_target" ||
        scenario === "encoded_separator_process_target"
      )
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "host-runtime",
            "unregistered-child.ts",
          ),
          "export {};\n",
        );
      const result =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          fixture.distributionRoot,
        );
      assert.equal(result.status, "blocked", scenario);
      assert.equal(result.runtimeAuthorityConferred, false, scenario);
      assert.equal(result.effectAuthorizationIssued, false, scenario);
      if (directExpectation) {
        const fixed = inspectFixedDevelopmentCoordinatorPackageCandidate(
          fixture.input,
        );
        assert.equal(fixed.status, "blocked", scenario);
        assert.equal(fixed.runtimeAuthorityConferred, false, scenario);
      }
    } finally {
      fixture.cleanup();
    }
  });
}

/**
 * 内部lifecycleまたはProcess wrapperを正規leafから再転送しないを検証する。
 *
 * @responsibility 内部lifecycleまたはProcess wrapperを正規leafから再転送しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 内部lifecycleまたはProcess wrapperを正規leafから再転送しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("内部lifecycleまたはProcess wrapperを正規leafから再転送しない", () => {
  const interactiveSource = fs.readFileSync(
    path.join(coordinatorRoot, "src", "cli", "interactive-console.ts"),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        "src/cli/interactive-console.ts",
        `${interactiveSource}\nexport { runInteractiveConsoleReaderLifecycle };\n`,
      ),
    /runtime_dependency_child_lifecycle_unbound/u,
  );

  const dockerEffectSource = fs.readFileSync(
    path.join(
      coordinatorRoot,
      "src",
      "docker-runtime",
      "docker-effect-runtime.ts",
    ),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        "src/docker-runtime/docker-effect-runtime.ts",
        `${dockerEffectSource}\nconst leakedStartProcess = startOwnedProcess; void leakedStartProcess;\n`,
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

for (const target of ["package", "expected_package"] as const) {
  /**
   * 開発版の${target}差替えを拒否するを検証する。
   *
   * @responsibility 開発版の${target}差替えを拒否するの合否判定を所有する。
   * @trace AIT-IT-013
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 開発版の${target}差替えを拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`開発版の${target}差替えを拒否する`, () => {
    const fixture = developmentFixture();
    try {
      const input = { ...fixture.input };
      if (target === "package")
        fs.appendFileSync(
          path.join(fixture.packageRoot, "bin", "coordinator.ts"),
          "// changed\n",
        );
      if (target === "expected_package")
        input.expectedPackageContentRootSha256 = "d".repeat(64);
      const result = inspectFixedDevelopmentCoordinatorPackageCandidate(input);
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "development_package_identity_mismatch");
      assert.equal(result.runtimeAuthorityConferred, false);
    } finally {
      fixture.cleanup();
    }
  });
}

/**
 * Runtime依存外の文書変更は開発Source Identityを失効させないを検証する。
 *
 * @responsibility Runtime依存外の文書変更は開発Source Identityを失効させないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime依存外の文書変更は開発Source Identityを失効させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime依存外の文書変更は開発Source Identityを失効させない", () => {
  const fixture = developmentFixture();
  try {
    const initial = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(initial.status, "candidate");
    fs.appendFileSync(
      path.join(fixture.distributionRoot, "README.md"),
      "changed\n",
    );
    const changed = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(changed.status, "candidate");
    assert.equal(changed.sourceIdentitySha256, initial.sourceIdentitySha256);
  } finally {
    fixture.cleanup();
  }
});

/**
 * 開発版へ混入した署名manifestをReleaseへ昇格しないを検証する。
 *
 * @responsibility 開発版へ混入した署名manifestをReleaseへ昇格しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開発版へ混入した署名manifestをReleaseへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("開発版へ混入した署名manifestをReleaseへ昇格しない", () => {
  const fixture = developmentFixture();
  try {
    const target = path.join(
      fixture.distributionRoot,
      "template/tools/coordinator/coordinator-package-manifest.json",
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "not a trusted artifact");
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "development_package_release_artifact_present");
  } finally {
    fixture.cleanup();
  }
});

for (const relativePath of [
  "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
]) {
  /**
   * 開発Sourceと別に検証する${relativePath}をSource Identityへ混在させないを検証する。
   *
   * @responsibility 開発Sourceと別に検証する${relativePath}をSource Identityへ混在させないの合否判定を所有する。
   * @trace AIT-IT-013
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 開発Sourceと別に検証する${relativePath}をSource Identityへ混在させないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`開発Sourceと別に検証する${relativePath}をSource Identityへ混在させない`, () => {
    const fixture = developmentFixture();
    try {
      const target = path.join(fixture.distributionRoot, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "not a trusted artifact");
      const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
        fixture.input,
      );
      assert.equal(result.status, "candidate");
    } finally {
      fixture.cleanup();
    }
  });
}

/**
 * 開発版のRoot alias、入力getterと追加keyを拒否し、Git metadataだけをTreeから除外するを検証する。
 *
 * @responsibility 開発版のRoot alias、入力getterと追加keyを拒否し、Git metadataだけをTreeから除外するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開発版のRoot alias、入力getterと追加keyを拒否し、Git metadataだけをTreeから除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("開発版のRoot alias、入力getterと追加keyを拒否し、Git metadataだけをTreeから除外する", () => {
  const fixture = developmentFixture();
  try {
    let getterCalls = 0;
    const accessor = Object.defineProperty(
      { ...fixture.input },
      "expectedCrddTree",
      {
        get() {
          getterCalls += 1;
          return fixture.expectedCrddTree;
        },
      },
    );
    for (const input of [
      accessor,
      { ...fixture.input, extra: true },
      { ...fixture.input, distributionRoot: "relative" },
    ]) {
      assert.equal(
        inspectFixedDevelopmentCoordinatorPackageCandidate(input).status,
        "blocked",
      );
    }
    assert.equal(getterCalls, 0);
    const alias = path.join(fixture.root, "alias");
    fs.symlinkSync(
      fixture.distributionRoot,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate({
        ...fixture.input,
        distributionRoot: alias,
      }).status,
      "blocked",
    );
    fs.mkdirSync(path.join(fixture.distributionRoot, ".git"));
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate(fixture.input).status,
      "candidate",
    );
  } finally {
    fixture.cleanup();
  }
});

/**
 * 実体観測と開始枠を結合し、準備待機後のRoot差替えで消費を拒否するを検証する。
 *
 * @responsibility 実体観測と開始枠を結合し、準備待機後のRoot差替えで消費を拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実体観測と開始枠を結合し、準備待機後のRoot差替えで消費を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("実体観測と開始枠を結合し、準備待機後のRoot差替えで消費を拒否する", async () => {
  const fixture = developmentFixture();
  try {
    const initial = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(initial.status, "candidate");
    // Identity component only: this test does not supply human approval or
    // exercise the not-yet-connected production execution boundary.
    /**
     * observeのTest準備責務を実行する。
     *
     * @responsibility observeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
     * @trace AIT-IT-013
     * @precondition 呼出し元Test Caseが必要な入力を渡す。
     * @stimulus observeを呼び出す。
     * @observation 返却値、生成fixtureまたは観測値を取得する。
     * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
     * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
     * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
     */
    const observe = () => {
      const current = inspectFixedDevelopmentCoordinatorPackageCandidate(
        fixture.input,
      );
      return current.status === "candidate"
        ? {
            bindingSha256: current.sourceIdentitySha256,
            wallTimeMs: 100,
            monotonicTimeMs: 100,
          }
        : null;
    };
    const scopeSha256 = "1".repeat(64);
    const constraints = createDevelopmentMeasurementConstraints(
      {
        bindingSha256: initial.sourceIdentitySha256,
        expiresAtMs: 1_100,
        tasks: [
          { scopeSha256, executor: "codex", reviewer: "claude" },
          {
            scopeSha256: "2".repeat(64),
            executor: "claude",
            reviewer: "codex",
          },
        ],
      },
      observe(),
    );
    assert.ok(constraints);
    const task = constraints.reserveTask(scopeSha256, observe());
    assert.equal(task.status, "recorded");
    const invocation = constraints.reserveInvocation(
      task.value,
      "codex",
      "executor",
      observe(),
    );
    assert.equal(invocation.status, "recorded");
    await Promise.resolve().then(() => {
      const previousRoot = path.join(fixture.root, "previous");
      fs.renameSync(fixture.distributionRoot, previousRoot);
      fs.cpSync(previousRoot, fixture.distributionRoot, { recursive: true });
    });
    const result = constraints.consumeInvocation(
      invocation.value,
      task.value,
      "codex",
      "executor",
      observe(),
    );
    assert.deepEqual(result, {
      status: "blocked",
      reason: "identity_mismatch",
    });
    assert.equal(
      constraints.settleInvocation(invocation.value).status,
      "recorded",
    );
    assert.equal(
      constraints.settleTask(task.value, "finished").status,
      "recorded",
    );
    assert.equal(constraints.inspect().productionAuthorityConferred, false);
  } finally {
    fixture.cleanup();
  }
});

/**
 * 署名済みPlatform Access観測は開発版Rootや自己申告の署名状態を拒否するを検証する。
 *
 * @responsibility 署名済みPlatform Access観測は開発版Rootや自己申告の署名状態を拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名済みPlatform Access観測は開発版Rootや自己申告の署名状態を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名済みPlatform Access観測は開発版Rootや自己申告の署名状態を拒否する", () => {
  const fixture = developmentFixture();
  try {
    const request = {
      distributionRoot: fixture.distributionRoot,
      evaluationTime: "2026-08-30T00:00:00.000Z",
      expectedRelease: {
        manifestHash: "1".repeat(64),
        releaseSequence: 1,
        crddVersion: "v0.18.0",
        crddCommit: "2".repeat(40),
        crddTree: fixture.expectedCrddTree,
        packageContentRootSha256:
          fixture.input.expectedPackageContentRootSha256,
      },
    };
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(request).status,
      "blocked",
    );
    assert.equal(
      inspectVerifiedNativeDistributionCandidate({
        ...request,
        nativeReleaseSignatureVerified: true,
      }).status,
      "blocked",
    );
    let getterCalls = 0;
    const invalid = Object.defineProperty({ ...request }, "expectedRelease", {
      get() {
        getterCalls += 1;
        return request.expectedRelease;
      },
    });
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(invalid).status,
      "blocked",
    );
    assert.equal(getterCalls, 0);
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(null).status,
      "blocked",
    );
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate(fixture.input).status,
      "candidate",
    );
  } finally {
    fixture.cleanup();
  }
});

/**
 * Task package capabilityは偽造・不正入力・再利用を受理しないを検証する。
 *
 * @responsibility Task package capabilityは偽造・不正入力・再利用を受理しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task package capabilityは偽造・不正入力・再利用を受理しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task package capabilityは偽造・不正入力・再利用を受理しない", () => {
  const issued = issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
    evaluationTime: "not-a-time",
    callerRoot: "C:\\caller-selected",
  });
  assert.equal(issued.capability, null);
  const forged = Object.freeze({});
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(forged),
    false,
  );
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(forged),
    false,
  );
});

/**
 * Package Capability状態機械はfresh exact Identityを一度だけ受理するを検証する。
 *
 * @responsibility Package Capability状態機械はfresh exact Identityを一度だけ受理するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Package Capability状態機械はfresh exact Identityを一度だけ受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Package Capability状態機械はfresh exact Identityを一度だけ受理する", () => {
  const state = createIsolatedVerifiedPackageCapabilityStateCandidate();
  const identity = Object.freeze({
    manifestHash: "1".repeat(64),
    releaseSequence: 19,
    runtimeExecutionIdentitySha256: "4".repeat(64),
    interactiveConsoleReaderArtifactSha256: "5".repeat(64),
  });
  const capability = state.issue(identity, 1_000);
  assert.equal(state.consume(capability, identity, 1_001), true);
  assert.equal(state.consume(capability, identity, 1_002), false);
  const stale = state.issue(identity, 1_000);
  assert.equal(state.consume(stale, identity, 6_000), false);
  for (const key of Object.keys(identity)) {
    const changed = Object.freeze({
      ...identity,
      [key]:
        key === "releaseSequence"
          ? 20
          : "6".repeat(String(identity[key as keyof typeof identity]).length),
    });
    const mismatched = state.issue(identity, 1_000);
    assert.equal(state.consume(mismatched, changed, 1_001), false, key);
  }
  const isolated = state.issue(identity, 1_000);
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(isolated),
    false,
  );
  assert.equal(state.runtimeAuthorityIssued, false);
  assert.equal(state.productionConsumerCompatible, false);
});

/**
 * frameのTest準備責務を実行する。
 *
 * @responsibility frameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus frameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function frame(payload: Record<string, unknown>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assertCanonicalCandidate(canonical);
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return Buffer.concat([
    Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"),
    length,
    canonical.canonicalBytes,
  ]);
}

/**
 * signedManifestのTest準備責務を実行する。
 *
 * @responsibility signedManifestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus signedManifestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function signedManifest(
  packageContentRootSha256: string,
  revision = PLATFORM_PROVISIONER_MANIFEST_REVISION,
  expiresAt: string | null = "2027-08-15T00:00:00.000Z",
) {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const executionFields = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "4".repeat(64),
    },
  };
  const runtimeIdentity =
    calculateRuntimeExecutionIdentityCandidate(executionFields);
  assert.equal(runtimeIdentity.status, "candidate");
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: revision,
    ...executionFields,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    runtimeExecutionIdentitySha256:
      runtimeIdentity.runtimeExecutionIdentitySha256,
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt,
  };
  return {
    input: {
      manifestEnvelope: {
        contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
        contractRevision: revision,
        payload,
        signatures: [
          {
            keyId: createHash("sha256").update(spki).digest("hex"),
            algorithm: "Ed25519",
            signature: sign(null, frame(payload), signer.privateKey).toString(
              "base64url",
            ),
          },
        ],
      },
      evaluationTime: "2026-08-16T00:00:00.000Z",
      expectedCrddVersion: payload.crddVersion,
      expectedCrddCommit: payload.crddCommit,
      expectedCrddTree: payload.crddTree,
    },
  };
}

/**
 * 固定Coordinator packageをPath非公開で一覧化するを検証する。
 *
 * @responsibility 固定Coordinator packageをPath非公開で一覧化するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Coordinator packageをPath非公開で一覧化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定Coordinator packageをPath非公開で一覧化する", () => {
  const result = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(result.status, "candidate");
  assert.equal(result.packageName, "@qual-lab/crdd-coordinator");
  assert.equal(result.runtimeOwnedPackageRoot, true);
  assert.equal(result.stableFilesystemIdentityObserved, true);
  assert.equal(typeof result.permissionPolicyConfirmed, "boolean");
  if (process.platform === "win32") {
    assert.equal(result.permissionPolicyConfirmed, false);
  }
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal("files" in result, false);
  assert.equal("packageRoot" in result, false);
  assert.equal("path" in result, false);
});

/**
 * Host Operation Supervisor sourceは再帰Package inventoryのexact non-link fileであるを検証する。
 *
 * @responsibility Host Operation Supervisor sourceは再帰Package inventoryのexact non-link fileであるの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisor sourceは再帰Package inventoryのexact non-link fileであるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Operation Supervisor sourceは再帰Package inventoryのexact non-link fileである", () => {
  const entrypoint = path.resolve(
    import.meta.dirname,
    "../../src/host-runtime/host-operation-lock-supervisor.ts",
  );
  const metadata = fs.lstatSync(entrypoint);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(entrypoint), entrypoint);
  const packageCandidate =
    inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(packageCandidate.status, "candidate");
  assert.equal(typeof packageCandidate.packageContentRootSha256, "string");
});

/**
 * caller選択Rootは非Authorityのまま内容変更をcontent rootへ反映するを検証する。
 *
 * @responsibility caller選択Rootは非Authorityのまま内容変更をcontent rootへ反映するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus caller選択Rootは非Authorityのまま内容変更をcontent rootへ反映するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("caller選択Rootは非Authorityのまま内容変更をcontent rootへ反映する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-observation-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: {
          "./cli": "./bin/coordinator.ts",
          "./host-runtime": "./src/host-runtime/index.ts",
        },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 1;\n",
    );
    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    assert.equal(first.runtimeOwnedPackageRoot, false);
    assert.equal(first.runtimeCapabilityIssued, false);
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 2;\n",
    );
    const second = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(second.status, "candidate");
    assert.notEqual(
      first.packageContentRootSha256,
      second.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 文書・試験はRuntime Execution Identityへ入らず、実行sourceは必ず入るを検証する。
 *
 * @responsibility 文書・試験はRuntime Execution Identityへ入らず、実行sourceは必ず入るの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 文書・試験はRuntime Execution Identityへ入らず、実行sourceは必ず入るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("文書・試験はRuntime Execution Identityへ入らず、実行sourceは必ず入る", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-execution-set-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: {
          "./cli": "./bin/coordinator.ts",
          "./host-runtime": "./src/host-runtime/index.ts",
        },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(path.join(root, "README.md"), "first\n");
    fs.writeFileSync(path.join(root, "tests", "fixture.ts"), "first\n");
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 1;\n",
    );
    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    fs.writeFileSync(path.join(root, "README.md"), "second\n");
    fs.writeFileSync(path.join(root, "tests", "fixture.ts"), "second\n");
    const documentationOnly =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(documentationOnly.status, "candidate");
    assert.equal(
      documentationOnly.packageContentRootSha256,
      first.packageContentRootSha256,
    );
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 2;\n",
    );
    const runtimeChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(runtimeChanged.status, "candidate");
    assert.notEqual(
      runtimeChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 責務分離後のRuntime componentを静的依存閉包として実行Identityへ含めるを検証する。
 *
 * @responsibility 責務分離後のRuntime componentを静的依存閉包として実行Identityへ含めるの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 責務分離後のRuntime componentを静的依存閉包として実行Identityへ含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("責務分離後のRuntime componentを静的依存閉包として実行Identityへ含める", () => {
  const fixture = developmentFixture();
  const root = fixture.distributionRoot;
  try {
    const coordinatorRoot = path.join(root, "40_Develop", "coordinator");
    const projectRuntimeRoot = path.join(
      root,
      "40_Develop",
      "orchestrator",
      "src",
    );
    const projectRuntimePackagePath = path.join(
      root,
      "40_Develop",
      "orchestrator",
      "package.json",
    );
    const projectRuntimeMetadata = JSON.parse(
      fs.readFileSync(projectRuntimePackagePath, "utf8"),
    ) as Record<string, unknown>;
    const valuePath = path.join(
      projectRuntimeRoot,
      "public-contract",
      "integration-result.ts",
    );
    const unusedCoordinatorPath = path.join(
      coordinatorRoot,
      "src",
      "unused-production.ts",
    );
    fs.writeFileSync(
      unusedCoordinatorPath,
      "export const unusedProduction = 1;\n",
    );
    const unusedSiblingPath = path.join(
      projectRuntimeRoot,
      "core",
      "unused-sibling.ts",
    );
    fs.writeFileSync(unusedSiblingPath, "export const unusedSibling = 1;\n");
    const first =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    const originalSiblingValue = fs.readFileSync(valuePath, "utf8");
    fs.writeFileSync(
      valuePath,
      [
        'import { spawnRuntimeLocalTypeScriptChild } from "../../../coordinator/src/host-runtime/runtime-local-typescript-child-entrypoints.ts";',
        'spawnRuntimeLocalTypeScriptChild("interactive_console_reader", [], {});',
        "export const value = 1;",
        "",
      ].join("\n"),
    );
    assert.equal(
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root)
        .status,
      "candidate",
    );
    for (const bypass of [
      'import { Worker as ThreadWorker } from "node:worker_threads";\nnew ThreadWorker("./child.ts");\nexport const value = 1;\n',
      "const runtimeProcess = process;\nvoid runtimeProcess.execPath;\nexport const value = 1;\n",
    ]) {
      fs.writeFileSync(valuePath, bypass);
      assert.equal(
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root)
          .status,
        "blocked",
        bypass,
      );
    }
    fs.writeFileSync(valuePath, originalSiblingValue);
    fs.writeFileSync(
      path.join(root, "README.md"),
      "not in the runtime execution closure\n",
    );
    const documentationOnly =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(documentationOnly.status, "candidate");
    assert.equal(
      documentationOnly.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify({ ...projectRuntimeMetadata, type: "commonjs" }),
    );
    const incompatibleMetadata =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(incompatibleMetadata.status, "blocked");
    assert.equal(incompatibleMetadata.runtimeAuthorityConferred, false);
    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify(projectRuntimeMetadata),
    );

    fs.rmSync(projectRuntimePackagePath);
    const missingMetadata =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(missingMetadata.status, "blocked");
    assert.equal(missingMetadata.runtimeAuthorityConferred, false);
    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify(projectRuntimeMetadata),
    );

    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify({ ...projectRuntimeMetadata, version: "0.0.1" }),
    );
    const metadataChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(metadataChanged.status, "candidate");
    assert.notEqual(
      metadataChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );
    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify(projectRuntimeMetadata),
    );

    fs.writeFileSync(unusedSiblingPath, "export const unusedSibling = 2;\n");
    const unusedSiblingChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(unusedSiblingChanged.status, "candidate");
    assert.notEqual(
      unusedSiblingChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      unusedCoordinatorPath,
      "export const unusedProduction = 2;\n",
    );
    const unusedCoordinatorChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(unusedCoordinatorChanged.status, "candidate");
    assert.notEqual(
      unusedCoordinatorChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.appendFileSync(
      path.join(root, "template", "tools", "crdd-mcp.ts"),
      "// public launcher changed\n",
    );
    const launcherChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(launcherChanged.status, "candidate");
    assert.notEqual(
      launcherChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.appendFileSync(valuePath, "// changed runtime dependency\n");
    const dependencyChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(dependencyChanged.status, "candidate");
    assert.notEqual(
      dependencyChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(coordinatorRoot, "src", "index.ts"),
      'export { value } from "../../untrusted-component/src/index.ts";\n',
    );
    const outside =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(outside.status, "blocked");
    assert.equal(outside.runtimeAuthorityConferred, false);
  } finally {
    fixture.cleanup();
  }
});

/**
 * 非正規表記または実行集合外へのrelative importを署名候補へ含めず拒否するを検証する。
 *
 * @responsibility 非正規表記または実行集合外へのrelative importを署名候補へ含めず拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非正規表記または実行集合外へのrelative importを署名候補へ含めず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("非正規表記または実行集合外へのrelative importを署名候補へ含めず拒否する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-dependency-boundary-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: {
          "./cli": "./bin/coordinator.ts",
          "./host-runtime": "./src/host-runtime/index.ts",
        },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "outside.ts"),
      "export const value = 1;\n",
    );
    for (const specifier of [
      "../../outside.ts",
      "..\\..\\outside.ts",
      ".%2e/.%2e/outside.ts",
      "../../outside.ts?candidate=1",
      "../../outside.ts#candidate",
    ]) {
      fs.writeFileSync(
        path.join(root, "src", "entry.ts"),
        `export { value } from ${JSON.stringify(specifier)};\n`,
      );
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", specifier);
      assert.equal(result.runtimeAuthorityConferred, false, specifier);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 共通Launcherの署名・4経路・Recovery入口と静的依存だけを実行Identityへ含めるを検証する。
 *
 * @responsibility 共通Launcherの署名・4経路・Recovery入口と静的依存だけを実行Identityへ含めるの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通Launcherの署名・4経路・Recovery入口と静的依存だけを実行Identityへ含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("共通Launcherの署名・4経路・Recovery入口と静的依存だけを実行Identityへ含める", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-launch-closure-"));
  try {
    for (const directory of ["bin", "src", "src/provider", "scripts"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: {
          "./cli": "./bin/coordinator.ts",
          "./host-runtime": "./src/host-runtime/index.ts",
        },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "bin", "coordinator.ts"),
      [
        'import "../src/entry.ts";',
        'await import("../src/cli/coordinator-command.ts");',
        'await import("../scripts/verify-signed-route-matrix.ts");',
        'await import("../scripts/verify-signed-recovery-matrix.ts");',
        'await import("../scripts/sign-release-manifest.ts");',
        'await import("../scripts/promote-release-manifest.ts");',
        'await import("../scripts/authenticate-claude-subscription.ts");',
        "const target = new URL(plan.entryRelativePath, import.meta.url);",
        "process.argv = [process.execPath, fileURLToPath(target), ...plan.forwardedArgs];",
        "",
      ].join("\n"),
    );
    fs.mkdirSync(path.join(root, "src", "cli"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "cli", "coordinator-command.ts"),
      "export {};\n",
    );
    fs.writeFileSync(path.join(root, "src", "entry.ts"), "export {};\n");
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-route-matrix.ts"),
      'import "./verify-signed-general-task.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-general-task.ts"),
      "export const route = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-recovery-matrix.ts"),
      'import "./recovery-helper.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      "export const recovery = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "sign-release-manifest.ts"),
      'import "./signing-helper.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "signing-helper.ts"),
      "export const signing = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "promote-release-manifest.ts"),
      'import "./release-manifest-promotion.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "release-manifest-promotion.ts"),
      "export const promotion = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "authenticate-claude-subscription.ts"),
      'import "../src/provider/claude-subscription-authentication.ts";\n',
    );
    fs.writeFileSync(
      path.join(
        root,
        "src",
        "provider",
        "claude-subscription-authentication.ts",
      ),
      "export const authentication = 1;\n",
    );
    const unrelated = path.join(root, "scripts", "unrelated.ts");
    fs.writeFileSync(unrelated, "export const unrelated = 1;\n");

    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    const launcherPath = path.join(root, "bin", "coordinator.ts");
    const canonicalLauncher = fs.readFileSync(launcherPath, "utf8");
    fs.writeFileSync(
      launcherPath,
      canonicalLauncher.replace(
        "fileURLToPath(target)",
        "fileURLToPath(otherTarget)",
      ),
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(launcherPath, canonicalLauncher);
    fs.writeFileSync(unrelated, "export const unrelated = 2;\n");
    const unrelatedChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(unrelatedChanged.status, "candidate");
    assert.equal(
      unrelatedChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      "export const recovery = 2;\n",
    );
    const dependencyChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(dependencyChanged.status, "candidate");
    assert.notEqual(
      dependencyChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      'const target = "./late-bound.ts";\nawait import(target);\n',
    );
    const unboundDynamic =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(unboundDynamic.status, "blocked");
    assert.equal(unboundDynamic.runtimeAuthorityConferred, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 実行Identityのmodule構文を字句解析し、コメント・非relative・未束縛dynamicによる閉包回避を拒否するを検証する。
 *
 * @responsibility 実行Identityのmodule構文を字句解析し、コメント・非relative・未束縛dynamicによる閉包回避を拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行Identityのmodule構文を字句解析し、コメント・非relative・未束縛dynamicによる閉包回避を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行Identityのmodule構文を字句解析し、コメント・非relative・未束縛dynamicによる閉包回避を拒否する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-module-lexer-"));
  try {
    for (const directory of ["bin", "src", "src/provider", "scripts"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: {
          "./cli": "./bin/coordinator.ts",
          "./host-runtime": "./src/host-runtime/index.ts",
        },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "bin", "coordinator.ts"),
      [
        'await import("../src/cli/coordinator-command.ts");',
        'await import("../scripts/verify-signed-route-matrix.ts");',
        'await import("../scripts/verify-signed-recovery-matrix.ts");',
        'await import("../scripts/sign-release-manifest.ts");',
        'await import("../scripts/promote-release-manifest.ts");',
        'await import("../scripts/authenticate-claude-subscription.ts");',
        "",
      ].join("\n"),
    );
    fs.mkdirSync(path.join(root, "src", "cli"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "cli", "coordinator-command.ts"),
      "export {};\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-route-matrix.ts"),
      'import "./verify-signed-general-task.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-general-task.ts"),
      "export const task = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-recovery-matrix.ts"),
      "export const recovery = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "sign-release-manifest.ts"),
      "export const sign = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "promote-release-manifest.ts"),
      "export const promote = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "authenticate-claude-subscription.ts"),
      'import "../src/provider/claude-subscription-authentication.ts";\n',
    );
    fs.writeFileSync(
      path.join(
        root,
        "src",
        "provider",
        "claude-subscription-authentication.ts",
      ),
      "export const authentication = true;\n",
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    const launcher = path.join(root, "bin", "coordinator.ts");
    const canonicalLauncher = fs.readFileSync(launcher, "utf8");
    fs.writeFileSync(
      launcher,
      `${canonicalLauncher}await import("../scripts/unlisted.ts");\n`,
    );
    fs.writeFileSync(path.join(root, "scripts", "unlisted.ts"), "export {};\n");
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(
      launcher,
      canonicalLauncher.replace(
        'await import("../scripts/sign-release-manifest.ts");\n',
        "",
      ),
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(launcher, canonicalLauncher);

    const target = path.join(root, "scripts", "verify-signed-general-task.ts");
    for (const source of [
      'import/*comment*/("../../tests/helper.ts");\n',
      'import value from "external-package";\n',
      'import value from "C:/outside.ts";\n',
      'import value from "file:///outside.ts";\n',
      'import value from "fs";\n',
      'import value from "node:not-a-builtin";\n',
      'const target = new URL("./late.ts", import.meta.url);\nawait import(target.href);\n',
    ]) {
      fs.writeFileSync(target, source);
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", source);
      assert.equal(result.runtimeAuthorityConferred, false, source);
    }

    fs.writeFileSync(
      target,
      'import/*comment*/ value from/*comment*/ "node:path";\nexport { value as task };\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    for (const source of [
      'import { spawn } from "node:child_process";\nspawn(process.execPath, ["./late-child.ts"]);\n',
      'import * as childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'import childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'const childProcess = await import("node:child_process");\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'import { fork } from "node:child_process";\nfork("./late-child.ts");\n',
      'import { Worker } from "node:worker_threads";\nnew Worker(new URL("./late-child.ts", import.meta.url));\n',
      'import { fork } from "node:child_process";\nconst target = "./late-child.ts";\nfork(target);\n',
      'import { fork as launchChild } from "node:child_process";\nconst target = "./late-child.ts";\nlaunchChild(target);\n',
      'import { spawn } from "node:child_process";\nconst argv = [fileURLToPath(import.meta.url)];\nspawn(process.execPath, argv);\n',
      'import { spawn } from "node:child_process";\nconst launch = spawn;\nlaunch(process.execPath, [fileURLToPath(import.meta.url)]);\n',
      'import { spawn } from "node:child_process";\n(spawn)(process.execPath, [fileURLToPath(import.meta.url)]);\n',
      'import { spawnSync } from "node:child_process";\nspawnSync(process.execPath, ["./late-child.ts"]);\n',
      'import { execFile } from "node:child_process";\nexecFile(process.execPath, ["./late-child.ts"]);\n',
      'import { execFileSync } from "node:child_process";\nexecFileSync(process.execPath, ["./late-child.ts"]);\n',
      'import { spawn as launchSelf } from "node:child_process";\nimport { fileURLToPath } from "node:url";\nlaunchSelf(process.execPath, [fileURLToPath(import.meta.url)]);\n',
    ]) {
      fs.writeFileSync(target, source);
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", source);
      assert.equal(result.runtimeAuthorityConferred, false, source);
    }

    const childTarget = path.join(root, "scripts", "late-child.ts");
    fs.writeFileSync(childTarget, "export const child = true;\n");
    fs.writeFileSync(
      target,
      'import { fork as launchChild } from "node:child_process";\nlaunchChild("./late-child.ts");\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );

    fs.writeFileSync(
      target,
      'import path from "node:path";\nimport { spawnSync } from "node:child_process";\nspawnSync(path.join(process.env.SystemRoot ?? "C:\\\\Windows", "System32", "taskkill.exe",), ["/PID", "1", "/T", "/F"]);\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Repository textのLFとCRLFは同じ正本内容として検証し、意味差分は拒否するを検証する。
 *
 * @responsibility Repository textのLFとCRLFは同じ正本内容として検証し、意味差分は拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository textのLFとCRLFは同じ正本内容として検証し、意味差分は拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Repository textのLFとCRLFは同じ正本内容として検証し、意味差分は拒否する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-line-ending-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    const metadata = JSON.stringify({
      name: "@qual-lab/crdd-coordinator",
      version: "0.0.0-development",
      private: true,
      type: "module",
      exports: {
        "./cli": "./bin/coordinator.ts",
        "./host-runtime": "./src/host-runtime/index.ts",
      },
      scripts: {},
      engines: {},
      devDependencies: {},
    });
    fs.writeFileSync(path.join(root, "package.json"), `${metadata}\n`);
    const entrypoint = path.join(root, "src", "entry.ts");
    fs.writeFileSync(entrypoint, "export const value = 1;\nexport {};\n");
    const lf = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(lf.status, "candidate");
    fs.writeFileSync(entrypoint, "export const value = 1;\r\nexport {};\r\n");
    const crlf = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(crlf.status, "candidate");
    assert.equal(crlf.packageContentRootSha256, lf.packageContentRootSha256);
    fs.writeFileSync(entrypoint, "export const value = 2;\r\nexport {};\r\n");
    const changed = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(changed.status, "candidate");
    assert.notEqual(
      changed.packageContentRootSha256,
      lf.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Coordinator packageはexact CLI-only exports境界を必須にするを検証する。
 *
 * @responsibility Coordinator packageはexact CLI-only exports境界を必須にするの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Coordinator packageはexact CLI-only exports境界を必須にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Coordinator packageはexact CLI-only exports境界を必須にする", () => {
  for (const exportsValue of [
    undefined,
    {},
    { "./cli": "./bin/coordinator.ts", "./internal": "./src/internal.ts" },
    { "./cli": "./src/docker-runtime/docker-recovery-runtime-internal.ts" },
  ]) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-package-exports-boundary-"),
    );
    try {
      const metadata: Record<string, unknown> = {
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        scripts: {},
        engines: {},
        devDependencies: {},
      };
      if (exportsValue !== undefined) metadata.exports = exportsValue;
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify(metadata),
      );
      assert.equal(
        inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
        "blocked",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

/**
 * 入れ子directoryの走査中にentryを追加・削除・型変更しても安定inventoryへ流用しないを検証する。
 *
 * @responsibility 入れ子directoryの走査中にentryを追加・削除・型変更しても安定inventoryへ流用しないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 入れ子directoryの走査中にentryを追加・削除・型変更しても安定inventoryへ流用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("入れ子directoryの走査中にentryを追加・削除・型変更しても安定inventoryへ流用しない", () => {
  for (const scenario of ["add", "remove", "replace_type"] as const) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-package-directory-race-"),
    );
    const sourceRoot = path.join(root, "src");
    fs.mkdirSync(sourceRoot);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: {
          "./cli": "./bin/coordinator.ts",
          "./host-runtime": "./src/host-runtime/index.ts",
        },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(path.join(sourceRoot, "entry.ts"), "export {};");
    const changedPath = path.join(sourceRoot, "changed.ts");
    if (scenario !== "add") fs.writeFileSync(changedPath, "export {};");
    const originalRead = fs.readSync;
    const originalLstat = fs.lstatSync;
    const sourceRootMetadata = fs.lstatSync(sourceRoot, { bigint: true });
    let isChanged = false;
    Reflect.set(fs, "lstatSync", (target: fs.PathLike, ...args: unknown[]) =>
      target === sourceRoot
        ? sourceRootMetadata
        : Reflect.apply(originalLstat, fs, [target, ...args]),
    );
    Reflect.set(fs, "readSync", (descriptor: number, ...args: unknown[]) => {
      const byteLength = Reflect.apply(originalRead, fs, [descriptor, ...args]);
      if (!isChanged && byteLength > 0) {
        isChanged = true;
        if (scenario === "add") {
          fs.writeFileSync(changedPath, "export {};");
        } else {
          fs.rmSync(changedPath);
          if (scenario === "replace_type") fs.mkdirSync(changedPath);
        }
      }
      return byteLength;
    });
    try {
      assert.equal(
        inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
        "blocked",
      );
    } finally {
      Reflect.set(fs, "readSync", originalRead);
      Reflect.set(fs, "lstatSync", originalLstat);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

/**
 * 同梱manifestは固定Release鍵以外の署名を拒否するを検証する。
 *
 * @responsibility 同梱manifestは固定Release鍵以外の署名を拒否するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同梱manifestは固定Release鍵以外の署名を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("同梱manifestは固定Release鍵以外の署名を拒否する", () => {
  const observation = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observation.status, "candidate");
  assert.equal(typeof observation.packageContentRootSha256, "string");
  const fixture = signedManifest(observation.packageContentRootSha256);
  const result = verifyBundledCoordinatorPackageCandidate(fixture.input);
  assert.equal(result.status, "blocked");
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal("files" in result, false);
  assert.equal("signature" in result, false);
  assert.equal("releaseSignerSpkiDer" in result, false);
});

/**
 * 期限なしmanifestも固定Release鍵と配布結合を迂回できないを検証する。
 *
 * @responsibility 期限なしmanifestも固定Release鍵と配布結合を迂回できないの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 期限なしmanifestも固定Release鍵と配布結合を迂回できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("期限なしmanifestも固定Release鍵と配布結合を迂回できない", () => {
  const observed = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observed.status, "candidate");
  const value = signedManifest(
    observed.packageContentRootSha256,
    PLATFORM_PROVISIONER_MANIFEST_REVISION,
    null,
  );
  for (const evaluationTime of [
    "2026-08-16T00:00:00.000Z",
    "2099-01-01T00:00:00.000Z",
  ]) {
    const result = verifyBundledCoordinatorPackageCandidate({
      ...value.input,
      evaluationTime,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
    assert.equal(result.crddDistributionConfirmed, false);
    assert.equal(result.effectAuthorizationIssued, false);
  }
});

/**
 * 不正Root、Release Identity不一致およびpackage metadataをfail closedにするを検証する。
 *
 * @responsibility 不正Root、Release Identity不一致およびpackage metadataをfail closedにするの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正Root、Release Identity不一致およびpackage metadataをfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("不正Root、Release Identity不一致およびpackage metadataをfail closedにする", () => {
  assert.equal(
    inspectPlatformProvisionerPackageFilesystemCandidate(null).status,
    "blocked",
  );
  const observation = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observation.status, "candidate");
  assert.equal(typeof observation.packageContentRootSha256, "string");
  const fixture = signedManifest(observation.packageContentRootSha256);
  fixture.input.expectedCrddCommit = "c".repeat(40);
  assert.equal(
    verifyBundledCoordinatorPackageCandidate(fixture.input).status,
    "blocked",
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-package-invalid-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * package Filesystem contractは観測をTrustおよびEffectから分離するを検証する。
 *
 * @responsibility package Filesystem contractは観測をTrustおよびEffectから分離するの合否判定を所有する。
 * @trace AIT-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus package Filesystem contractは観測をTrustおよびEffectから分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("package Filesystem contractは観測をTrustおよびEffectから分離する", () => {
  const contract = describePlatformProvisionerPackageFilesystemContract();
  assert.equal(contract.contractRevision, 6);
  assert.equal(
    contract.runtimeExecutionSet,
    "closed_public_launchers_coordinator_package_and_transitively_reached_sibling_sources_with_package_metadata",
  );
  assert.equal(
    contract.requiredArtifactResolution,
    "single_distribution_root_relative_registry_atomically_resolved_non_nullable_and_consumed_without_path_reinterpretation",
  );
  assert.equal(
    contract.localNodeChildEntrypointRegistration,
    "declared_role_kind_path_actual_canonical_wrapper_call_sites_and_required_registry_exactly_match_with_runtime_kind_validation",
  );
  const source = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../src/platform-access/platform-provisioner-package-filesystem.ts",
    ),
    "utf8",
  );
  assert.equal(source.includes("observed.observation.files.find"), false);
  assert.equal(source.includes("DEVELOPMENT_ENTRYPOINTS"), false);
  assert.equal(source.includes("developmentEntrypoints"), false);
  assert.equal(
    contract.runtimeOwnedPackageFilesystemRead,
    "implemented_candidate_without_permission_authority",
  );
  assert.equal(
    contract.runtimeOwnedCrddReleaseIdentitySelection,
    "implemented_fixed_manifest_signature_and_runtime_execution_identity_candidate",
  );
  assert.equal(
    contract.runtimeOwnedReleaseTrustSelection,
    "implemented_single_ed25519_anchor_pinned",
  );
  assert.equal(
    contract.ownerAndPermissionPolicyVerification,
    "posix_implemented_candidate_windows_effective_access_not_implemented",
  );
  assert.equal(
    contract.windowsSystemAndAdministratorsWriteRuntimeReadAclVerification,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.releaseTrustModel,
    "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
  );
  assert.equal(
    contract.signedManifestPath,
    "template/tools/coordinator/coordinator-package-manifest.json",
  );
  assert.equal(
    contract.releaseTrustAnchorConfiguration,
    "configured_immutable_source_literal",
  );
  assert.equal(
    contract.policyIdentityBinding,
    "owned_root_protection_and_key_storage_policy_hashes_required",
  );
  assert.equal(
    contract.effectController,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.taskGateAuthority,
    "held_alone_grants_no_operation_console_filesystem_provider_or_network_authority",
  );
  assert.equal(
    contract.processPoisonGate,
    "before_manifest_package_filesystem_observation",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorPersistence,
    "implemented_candidate",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorTransition,
    "implemented_candidate",
  );
  assert.equal(
    contract.unsignedOrModifiedCheckoutCanAuthorizeProvisioningEffect,
    false,
  );
  assert.equal(
    contract.repositoryContainedOfficialReleaseCanAuthorizeProvisioningEffect,
    true,
  );
  assert.equal(contract.nativeArtifactsInSignedGitTree, true);
  assert.equal(contract.exactRootGitMetadataExcludedFromSignedGitTree, true);
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
});
