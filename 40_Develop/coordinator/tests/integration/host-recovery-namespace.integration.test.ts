/**
 * 共有境界の初期化搬送と停止時の部分結果を局所確認する。
 *
 * @packageDocumentation
 * @responsibility Native出所拒否、mode相関、部分作成と不明を同じ本体で反証する。
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定frameの局所搬送と、Host Windows枠の検証済み固定Native正常系。
 * @boundary Portableではmemory依存、Host Windowsでは専用TEMPと実Windows保護境界。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 検証済み固定Nativeの正常系を、新規Repository-local領域と子Processに隔離する。
 * @trace ERB-IT-003
 * @precondition 適格なWindows対話ユーザーと検証済みNative配布物。
 * @observation 子Process終了、用途別assertion、試験領域の不存在。
 * @cleanup 子Process終了後、今回作成したRootのIdentityを照合して回収する。
 */
function runProtectedNativeCase(source: string): void {
  assert.equal(process.platform, "win32");
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  for (const directory of [path.join(repository, ".crdd"), parent]) {
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  const root = fs.mkdtempSync(path.join(parent, "native-contract-"));
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
test("Native試験は子失敗・終了不明・未知残存を削除せず保持する", () => {
  const source = readFileSync(import.meta.filename, "utf8");
  const body = sourceDeclaration(source, "runProtectedNativeCase").replaceAll(
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
 * 実Native正常系の結果契約を維持する。
 * @trace ERB-IT-003
 * @precondition 固定Namespaceを事前作成しない専用TEMPを使用する。
 * @stimulus 本番入口を呼ぶ。診断は受動・Operationは実行なし。
 * @observation 公開結果とHost Recovery IDの相関。
 * @oracle 旧UTのassertionを同じ本番入口へ適用する。
 * @cleanup runProtectedNativeCaseが自己生成領域だけを回収する。
 * @boundary Coordinator→検証済み固定Native→Windows保護付きFilesystem。
 */
test("Host Windows: production doctorは通常Taskに不要な永続準備状態を公開しない", {
  timeout: 120_000,
}, () => {
  runProtectedNativeCase(`
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
 * 実Native正常系の結果契約を維持する。
 * @trace ERB-IT-003
 * @precondition 固定Namespaceを事前作成しない専用TEMPを使用する。
 * @stimulus 本番入口を呼ぶ。診断は受動・Operationは実行なし。
 * @observation 公開結果とHost Recovery IDの相関。
 * @oracle 旧UTのassertionを同じ本番入口へ適用する。
 * @cleanup runProtectedNativeCaseが自己生成領域だけを回収する。
 * @boundary Coordinator→検証済み固定Native→Windows保護付きFilesystem。
 */
test("Host Windows: production Operationは実Directory producerのexact Host Recovery IDを公開する", {
  timeout: 120_000,
}, () => {
  runProtectedNativeCase(`
import assert from "node:assert/strict";
import { createRuntimeOwnedCoordinatorOperation, cleanupOwnedOperationDirectories, getOwnedHostRecoveryId } from ${JSON.stringify(new URL("../../src/execution/operation.ts", import.meta.url).href)};

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
`);
});

/**
 * 本番作成入口の保護検証順序と失敗移送を同じ本体で確認する。
 *
 * @responsibility 出所拒否後のRoot作成と、下位負例の早期拒否への置換を防ぐ。
 * @trace ERB-IT-003
 * @precondition 現本体Sourceと非Authority依存のみ。実共有領域を使用しない。
 * @stimulus Windows正常・初期化停止・親不正・下位失敗と非Windowsを与える。
 * @observation 初期化→生成の順序、opaque失敗分類、渡した親。
 * @oracle Windows停止は生成0・清掃未確認・IDなし。非Windowsは既存primitiveだけ。
 * @cleanup N/A: 実OS Effectなし。
 * @boundary 通常作成Owner→出所照合初期化Adapter／下位primitiveの局所接続。
 */
test("通常producerはWindows保護検証をRoot・marker生成より先に行う", () => {
  const source = readFileSync(
    new URL("../../src/execution/operation.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /createDirectories: createProtectedRuntimeOwnedOperationDirectories,/u,
  );
  const body = sourceDeclaration(
    source,
    "createProtectedRuntimeOwnedOperationDirectories",
  );
  for (const scenario of [
    "normal",
    "blocked",
    "bad_parent",
    "primitive_failure",
    "non_windows",
  ]) {
    const events: string[] = [];
    const root = Object.freeze({ fixture: "owned" });
    const primitiveFailure = new Error("fixture_root_creation_failed");
    let classification: {
      cleanupConfirmed: boolean;
      hostRecoveryId: string | null;
    } | null = null;
    const executeAdapter = runInNewContext(`(${body})`, {
      process: { platform: scenario === "non_windows" ? "linux" : "win32" },
      fs: {
        realpathSync: () => "C:\\fixture\\parent",
        lstatSync: () => ({
          isDirectory: () => scenario !== "bad_parent",
          isSymbolicLink: () => false,
        }),
      },
      os: { tmpdir: () => "C:\\fixture\\parent" },
      initializeWindowsHostRecordNamespace: (parent: string) => {
        events.push("initialize");
        assert.equal(parent, "C:\\fixture\\parent");
        return { status: scenario === "blocked" ? "blocked" : "initialized" };
      },
      createOwnedOperationDirectories: (parent?: string) => {
        events.push("create");
        assert.equal(
          parent,
          scenario === "non_windows" ? undefined : "C:\\fixture\\parent",
        );
        if (scenario === "primitive_failure") throw primitiveFailure;
        return root;
      },
      fail: (
        cause: unknown,
        cleanupConfirmed: boolean,
        hostRecoveryId: string | null,
      ) => {
        classification = { cleanupConfirmed, hostRecoveryId };
        throw cause;
      },
    }) as () => unknown;
    if (["blocked", "bad_parent", "primitive_failure"].includes(scenario)) {
      assert.throws(executeAdapter);
      if (scenario === "primitive_failure") {
        assert.equal(classification, null);
      } else {
        assert.deepEqual(classification, {
          cleanupConfirmed: scenario === "bad_parent",
          hostRecoveryId: null,
        });
      }
    } else {
      assert.equal(executeAdapter(), root);
    }
    assert.deepEqual(
      events,
      scenario === "bad_parent"
        ? []
        : scenario === "blocked"
          ? ["initialize"]
          : scenario === "non_windows"
            ? ["create"]
            : ["initialize", "create"],
    );
  }
});
