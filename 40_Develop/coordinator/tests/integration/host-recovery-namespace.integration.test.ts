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
import { execFileSync, spawnSync } from "node:child_process";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";
import { getRepository } from "@qual-lab/crdd-version-control";
import {
  classifyOwnedOperationDirectoryCreationFailure,
  cleanupOwnedOperationDirectories,
  createCoordinatorOperation,
  getOwnedHostRecoveryId,
} from "../../src/lifecycle/host.ts";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 現行Hostの作業先となる試験専用Gitリポジトリを用意する。
 * @trace ERB-IT-003
 * @boundary 操作対象は既存fixtureが作成した試験Rootだけ。
 */
function hostNamespaceFixture(t: test.TestContext) {
  const directory = createRepositoryTestDirectory("node-host-namespace-");
  t.after(directory.cleanup);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory.path, ...args], { windowsHide: true });
  git("init", "--quiet");
  git(
    "-c",
    "user.name=CRDD Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  );
  const verified = getRepository(directory.path);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw Error("fixture_repository_invalid");
  return {
    root: directory.path,
    parent: path.join(directory.path, ".crdd", "coordinator"),
    input: {
      root: verified.capability,
      purpose: "isolation_probe" as const,
      recordingCurrent: () => true,
    },
  };
}

/**
 * 既存Node Ownerの正常系を、新規Repository-local領域と子Processに隔離する。
 * @trace ERB-IT-003
 * @precondition Node.jsと自己生成Repository-local親。
 * @observation 子Process終了、用途別assertion、試験領域の不存在。
 * @cleanup 子Process終了後、今回作成したRootのIdentityを照合して回収する。
 */
function runNodeNamespaceCase(source: string, expectsNamespace = true): void {
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
  assert.deepEqual(
    fs.readdirSync(root),
    expectsNamespace ? ["crdd-coordinator-recovery-v1"] : [],
  );
  if (expectsNamespace) {
    const namespace = path.join(root, "crdd-coordinator-recovery-v1");
    const metadata = fs.lstatSync(namespace);
    assert.equal(metadata.isDirectory() && !metadata.isSymbolicLink(), true);
    assert.deepEqual(fs.readdirSync(namespace), []);
    fs.rmdirSync(namespace);
  }
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
test("production doctorは受動診断でHost領域・Namespaceを作成しない", {
  timeout: 120_000,
}, () => {
  runNodeNamespaceCase(
    `
import assert from "node:assert/strict";
import { runDoctor, REQUIRED_CHECK_IDS } from ${JSON.stringify(new URL("../../src/lifecycle/environment.ts", import.meta.url).href)};

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
  assert.equal(report.reportVersion, 17);
  assert.equal(report.filesystem.policy, null);
  assert.equal(report.recovery.required, false);
  const directories = report.checks.find(item => item.id === "operation.directories");
  assert.equal(directories.status, "not_implemented");
  assert.equal(directories.reason, "owned_operation_directories_not_requested");
  assert.equal(report.blockers.some(item => item.id === "operation.directories" && item.reason === directories.reason), true);
  assert.equal(Object.hasOwn(report.credentials, "forwardedNames"), false);
  assert.equal(Object.hasOwn(report.credentials, "environmentFiltered"), false);
  assert.equal(report.credentials.valuesRecorded, false);
  assert.ok(Array.isArray(report.credentials.detectedNames));
  assert.equal(REQUIRED_CHECK_IDS.includes("execution.credential_environment"), false);
  assert.equal(report.checks.some(item => item.id === "execution.credential_environment"), false);
  assert.equal(Object.hasOwn(report, "repositoryLocation"), true);
  assert.equal(Object.hasOwn(report, "repositoryGitLayout"), false);
  assert.equal(report.repositoryLocation.pathReported, false);
  assert.equal(report.fakeProviderLifecycle.fakeProviderExecuted, false);
`,
    false,
  );
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
}, (t) => {
  const { input, parent } = hostNamespaceFixture(t);
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 2; attempt++) {
    const created = createCoordinatorOperation(input);
    try {
      assert.equal(
        getOwnedHostRecoveryId(created.owned),
        created.hostRecoveryId,
      );
      assert.equal(
        created.hostRecoveryId,
        `host-operation.${created.operationId}`,
      );
      assert.match(created.hostRecoveryId, /^host-operation\.OP-[0-9]+$/u);
      assert.equal(created.owned.root, path.join(parent, created.operationId));
      assert.ok(!seen.has(created.hostRecoveryId));
      seen.add(created.hostRecoveryId);
    } finally {
      cleanupOwnedOperationDirectories(created.owned);
      assert.equal(fs.existsSync(created.owned.root), false);
    }
  }
});

/**
 * 本番の新しいCoordinator親で不正実体の保全と自己生成物の回収を確認する。
 * @trace ERB-IT-003
 * @precondition 毎回独立した試験Repositoryと固定の試験資源を使う。
 * @stimulus 親をFileまたはlinkにし、別Caseで子の作成を一度失敗させる。
 * @observation 既存実体、link先、失敗分類と新規作業領域の有無。
 * @oracle 既存実体へ書かず、部分作成が回収済みのときだけ回収成功を返す。
 * @cleanup 自己生成のlinkを明示解除し、残りは今回のfixtureだけを回収する。
 * @boundary 本番OperationとNode Filesystem。実AI・Dockerは使わない。
 */
test("production Operationは不正Namespaceと部分生成失敗を既存分類へ返す", {
  timeout: 120_000,
}, async (t) => {
  for (const scenario of ["file", "link", "partial"] as const) {
    await t.test(scenario, (sub) => {
      const { input, parent, root } = hostNamespaceFixture(sub);
      fs.mkdirSync(path.dirname(parent));
      const target = path.join(root, "link-target");
      let original: fs.Stats | null = null;
      let injected = false;
      let mkdirMock: ReturnType<typeof sub.mock.method> | undefined;
      if (scenario === "file") {
        fs.writeFileSync(parent, "owned-fixture", { flag: "wx" });
        original = fs.lstatSync(parent);
      } else if (scenario === "link") {
        fs.mkdirSync(target);
        fs.symlinkSync(
          target,
          parent,
          process.platform === "win32" ? "junction" : "dir",
        );
        original = fs.lstatSync(target);
      } else {
        const mkdir = fs.mkdirSync;
        mkdirMock = sub.mock.method(
          fs,
          "mkdirSync",
          (...args: Parameters<typeof fs.mkdirSync>) => {
            if (!injected && path.basename(String(args[0])) === "management") {
              injected = true;
              throw Error("fixture_child_creation");
            }
            return Reflect.apply(mkdir, fs, args);
          },
        );
      }
      try {
        assert.throws(
          () => createCoordinatorOperation(input),
          (error) => {
            const result =
              classifyOwnedOperationDirectoryCreationFailure(error);
            assert.ok(result);
            assert.equal(
              result.manualRecoveryRequired,
              !result.cleanupConfirmed,
            );
            if (scenario === "partial")
              assert.equal(result.cleanupConfirmed, true);
            if (!result.cleanupConfirmed)
              assert.match(
                result.hostRecoveryId ?? "",
                /^host-operation\.OP-[0-9]+$/u,
              );
            return true;
          },
        );
        if (scenario === "file") {
          assert.equal(fs.readFileSync(parent, "utf8"), "owned-fixture");
          assert.equal(fs.lstatSync(parent).ino, original?.ino);
        } else if (scenario === "link") {
          assert.equal(fs.realpathSync(parent), target);
          assert.equal(fs.lstatSync(target).ino, original?.ino);
          assert.deepEqual(fs.readdirSync(target), []);
        } else {
          assert.equal(injected, true);
          assert.deepEqual(fs.readdirSync(parent), []);
        }
      } finally {
        mkdirMock?.mock.restore();
        if (
          scenario === "link" &&
          fs.lstatSync(parent).isSymbolicLink() &&
          fs.realpathSync(parent) === target
        )
          fs.unlinkSync(parent);
      }
    });
  }
});

/**
 * 本番作成が既存Node Ownerへ直接接続しNative Namespaceへ依存しないことを確認する。
 * @trace ERB-IT-003
 * @boundary Source接続の確認。実Nodeの成立は本Suiteの本番Operation試験と保存試験で確認する。
 */
test("通常producerは既存NodeのDirectory Ownerへ直接接続する", () => {
  const source = readFileSync(
    new URL("../../src/lifecycle/host.ts", import.meta.url),
    "utf8",
  );
  const producer = sourceDeclaration(source, "createCoordinatorOperation");
  assert.match(
    producer,
    /const owned = createOwnedOperationDirectories\(input\);/u,
  );
  assert.equal(source.includes("initializeWindowsHostRecordNamespace"), false);
  assert.equal(source.includes("createProtectedOperationDirectories"), false);
});
