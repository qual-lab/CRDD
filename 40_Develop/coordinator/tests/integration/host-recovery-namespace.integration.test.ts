/**
 * Node本番初期化と停止時の失敗保全を局所確認する。
 *
 * @packageDocumentation
 * @responsibility Nodeの本番接続と、試験子の失敗・終了不明時の保全を確認する。
 * @trace ERB-IT-003
 * @level IT
 * @scope 通常作成のNode直接接続と自己生成領域での本番正常系。
 * @boundary 失敗保全はmemory依存、本番入口は専用TEMPと実Node Filesystem境界。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 既存Node Ownerの正常系を、新規Repository-local領域と子Processに隔離する。
 * @trace ERB-IT-003
 * @precondition Node.jsと自己生成Repository-local親。
 * @observation 子Process終了、用途別assertion、試験領域の不存在。
 * @cleanup 子Process終了後、今回作成したRootのIdentityを照合して回収する。
 */
function runNodeNamespaceCase(source: string): void {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  for (const directory of [path.join(repository, ".crdd"), parent]) {
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  const root = fs.mkdtempSync(path.join(parent, "node-namespace-"));
  const identity = fs.lstatSync(root);
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: { ...process.env, TEMP: root, TMP: root },
      encoding: "utf8",
      timeout: 100_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
  // 起動・終了不明なら試験物を勝手に回収しない。
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, `${result.stderr}\n保持した試験Root: ${root}`);
  const current = fs.lstatSync(root);
  assert.equal(current.isSymbolicLink(), false);
  assert.equal(current.dev, identity.dev);
  assert.equal(current.ino, identity.ino);
  assert.equal(path.dirname(root), parent);
  // 正常終了後も未知物・回復記録があれば保全する。既知の空Directoryだけを除去する。
  assert.deepEqual(fs.readdirSync(root), ["crdd-coordinator-recovery-v1"]);
  const namespace = path.join(root, "crdd-coordinator-recovery-v1");
  const metadata = fs.lstatSync(namespace);
  assert.equal(metadata.isDirectory() && !metadata.isSymbolicLink(), true);
  assert.deepEqual(fs.readdirSync(namespace), []);
  fs.rmdirSync(namespace);
  fs.rmdirSync(root);
  assert.equal(fs.existsSync(root), false);
}

/**
 * 実境界試験自体の清掃が失敗・不明の証拠を消さないことを有限代役で確認する。
 * @trace ERB-IT-003
 * @precondition 本文を読取り、FS・子Processはmemory代役のみ使用する。
 * @stimulus 非0終了・起動失敗・signal終了・未知残存・正常を与える。
 * @observation Directory削除の呼出し数。
 * @oracle 正常だけ既知の空Directory二つを回収し、他は削除0。
 * @cleanup N/A: 実資源を生成しない。
 * @boundary 試験用Process境界の失敗保持。
 */
test("Namespace試験は子失敗・終了不明・未知残存を削除せず保持する", () => {
  const source = readFileSync(import.meta.filename, "utf8");
  const body = sourceDeclaration(source, "runNodeNamespaceCase").replaceAll(
    "import.meta.url",
    JSON.stringify(import.meta.url),
  );
  for (const scenario of ["failed", "error", "signal", "unknown", "normal"]) {
    const removed: string[] = [];
    const execute = runInNewContext(`(${body})`, {
      assert: {
        ...assert,
        // VM境界の配列prototype差だけを除き、要素と順序の厳密比較は維持する。
        deepEqual: (actual: readonly unknown[], expected: readonly unknown[]) =>
          assert.deepEqual(Array.from(actual), Array.from(expected)),
      },
      path,
      fileURLToPath,
      URL,
      process: { platform: "win32", execPath: "fixture", env: {} },
      spawnSync: () => ({
        status: scenario === "failed" ? 1 : 0,
        error: scenario === "error" ? new Error("fixture") : undefined,
        signal: scenario === "signal" ? "SIGTERM" : null,
        stderr: "fixture",
      }),
      fs: {
        lstatSync: () => ({
          dev: 1,
          ino: 2,
          isSymbolicLink: () => false,
          isDirectory: () => true,
        }),
        realpathSync: { native: (value: string) => value },
        mkdtempSync: (prefix: string) => `${prefix}fixture`,
        readdirSync: (value: string) =>
          value.endsWith("crdd-coordinator-recovery-v1")
            ? []
            : scenario === "unknown"
              ? ["unknown"]
              : ["crdd-coordinator-recovery-v1"],
        rmdirSync: (value: string) => removed.push(value),
        existsSync: () => false,
      },
    }) as (source: string) => void;
    if (scenario === "normal") {
      execute("");
      assert.equal(removed.length, 2);
    } else {
      assert.throws(() => execute(""));
      assert.equal(removed.length, 0, scenario);
    }
  }
});

/**
 * 実Node正常系の結果契約を維持する。
 * @trace ERB-IT-003
 * @precondition 固定Namespaceを事前作成しない専用TEMPを使用する。
 * @stimulus 本番入口を呼ぶ。診断は受動・Operationは実行なし。
 * @observation 公開結果とHost Recovery IDの相関。
 * @oracle 旧UTのassertionを同じ本番入口へ適用する。
 * @cleanup runNodeNamespaceCaseが自己生成領域だけを回収する。
 * @boundary Coordinator→既存Node Owner→Node Filesystem。
 */
test("production doctorは通常Taskに不要な永続準備状態を公開しない", {
  timeout: 120_000,
}, () => {
  runNodeNamespaceCase(`
import assert from "node:assert/strict";
import { runDoctor, REQUIRED_CHECK_IDS } from ${JSON.stringify(new URL("../../src/execution/diagnostics.ts", import.meta.url).href)};

  const report = await runDoctor({
    activeIsolation: false,
    cwd: process.cwd(),
  });
  for (const removedKey of [
    "runtimeRoot",
    "runtimeRootPathIdentity",
    "runtimeActivation",
    "runtimeRootEvaluation",
    "runtimeRootProtectionPrecheck",
  ]) {
    assert.equal(Object.hasOwn(report, removedKey), false);
  }
  assert.equal(Object.hasOwn(report.egress, "authorityRoot"), false);
  assert.equal(Object.hasOwn(report.egress, "activation"), false);
  assert.equal(REQUIRED_CHECK_IDS.includes("runtime.root"), false);
  assert.equal(report.diagnosticMode, "passive_preflight");
  assert.equal(report.reportVersion, 12);
  assert.equal(Object.hasOwn(report, "repositoryLocation"), true);
  assert.equal(Object.hasOwn(report, "repositoryGitLayout"), false);
  assert.equal(report.repositoryLocation.pathReported, false);
  assert.equal(report.fakeProviderLifecycle.fakeProviderExecuted, false);
`);
});

/**
 * 実Node正常系の結果契約を維持する。
 * @trace ERB-IT-003
 * @precondition 固定Namespaceを事前作成しない専用TEMPを使用する。
 * @stimulus 本番入口を呼ぶ。診断は受動・Operationは実行なし。
 * @observation 公開結果とHost Recovery IDの相関。
 * @oracle 旧UTのassertionを同じ本番入口へ適用する。
 * @cleanup runNodeNamespaceCaseが自己生成領域だけを回収する。
 * @boundary Coordinator→既存Node Owner→Node Filesystem。
 */
test("production Operationは実Directory producerのexact Host Recovery IDを公開する", {
  timeout: 120_000,
}, () => {
  runNodeNamespaceCase(`
import assert from "node:assert/strict";
import { createRuntimeOwnedCoordinatorOperation, cleanupOwnedOperationDirectories, getOwnedHostRecoveryId } from ${JSON.stringify(new URL("../../src/execution/operation.ts", import.meta.url).href)};

  for (let attempt = 0; attempt < 2; attempt++) {
  const created = createRuntimeOwnedCoordinatorOperation();
  try {
    assert.equal(getOwnedHostRecoveryId(created.owned), created.hostRecoveryId);
    assert.match(
      created.hostRecoveryId,
      /^host\\.[a-z0-9-]+\\.[0-9a-f-]{36}\\.[a-f0-9]{64}$/u,
    );
  } finally {
    cleanupOwnedOperationDirectories(created.owned);
  }
  }
`);
});

/**
 * 本番Node入口が固定childの不正実体を拒否し、部分生成を元の分類で回収する。
 * @trace ERB-IT-003
 * @precondition 自己生成の専用TEMPだけを使用する。
 * @stimulus 固定childのFile／junctionと、子Directory生成失敗を与える。
 * @observation 本番作成失敗の分類、既存実体不変、記録・Rootの残存。
 * @oracle 不正childは清掃未確認・IDなし、回収済み部分生成はclean。Nativeへ迂回しない。
 * @cleanup 自作のFile／junction／空targetだけを元実体と照合して除去する。
 * @boundary 本番Operation→実Node Filesystem。
 */
test("production Operationは不正Namespaceと部分生成失敗を既存分類へ返す", {
  timeout: 120_000,
}, () => {
  runNodeNamespaceCase(`
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRuntimeOwnedCoordinatorOperation, classifyOwnedOperationDirectoryCreationFailure } from ${JSON.stringify(new URL("../../src/execution/operation.ts", import.meta.url).href)};
const parent = fs.realpathSync(os.tmpdir());
const directory = path.join(parent, "crdd-coordinator-recovery-v1");
function reject(expected) {
  assert.throws(() => createRuntimeOwnedCoordinatorOperation(), error => {
    assert.deepEqual(classifyOwnedOperationDirectoryCreationFailure(error), expected);
    return true;
  });
  assert.deepEqual(fs.readdirSync(parent).filter(name => name.startsWith("crdd-coordinator-doctor-")), []);
}
const refused = { cleanupConfirmed: false, manualRecoveryRequired: true, hostRecoveryId: null };
fs.writeFileSync(directory, "owned-fixture", { flag: "wx" });
const file = fs.lstatSync(directory);
reject(refused);
assert.equal(fs.readFileSync(directory, "utf8"), "owned-fixture");
assert.equal(fs.lstatSync(directory).ino, file.ino);
fs.unlinkSync(directory);
const target = path.join(parent, "link-target");
fs.mkdirSync(target);
const targetIdentity = fs.lstatSync(target);
fs.symlinkSync(target, directory, process.platform === "win32" ? "junction" : "dir");
assert.equal(fs.lstatSync(directory).isSymbolicLink(), true);
reject(refused);
assert.equal(fs.realpathSync(directory), fs.realpathSync(target));
fs.unlinkSync(directory);
const currentTarget = fs.lstatSync(target);
assert.equal(currentTarget.isDirectory() && !currentTarget.isSymbolicLink(), true);
assert.equal(currentTarget.dev, targetIdentity.dev);
assert.equal(currentTarget.ino, targetIdentity.ino);
assert.deepEqual(fs.readdirSync(target), []);
fs.rmdirSync(target);
const mkdir = fs.mkdirSync;
try {
  fs.mkdirSync = (target, options) => {
    if (path.basename(String(target)) === "management") throw new Error("fixture_child_creation");
    return mkdir(target, options);
  };
  reject({ cleanupConfirmed: true, manualRecoveryRequired: false, hostRecoveryId: null });
} finally {
  fs.mkdirSync = mkdir;
}
assert.deepEqual(fs.readdirSync(directory), []);
`);
});

/**
 * 本番作成が既存Node Ownerへ直接接続しNative Namespaceへ依存しないことを確認する。
 * @trace ERB-IT-003
 * @boundary Source接続の確認。実Nodeの成立は本Suiteの本番Operation試験と保存試験で確認する。
 */
test("通常producerは既存NodeのDirectory Ownerへ直接接続する", () => {
  const source = readFileSync(
    new URL("../../src/execution/operation.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /createDirectories: createOwnedOperationDirectories,/u);
  assert.equal(source.includes("initializeWindowsHostRecordNamespace"), false);
  assert.equal(
    source.includes("createProtectedRuntimeOwnedOperationDirectories"),
    false,
  );
});
