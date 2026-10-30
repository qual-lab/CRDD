/**
 * 保存移管の用途別Root観測を実Repositoryへ接続する。
 * @packageDocumentation
 * @responsibility Root真正性、四用途の現在性と同期観測拒否を確認する。
 * @trace PRL-IT-012
 * @level IT
 * @scope Domain保存の内部Repository境界。AI・Docker・実行Authorityは使用しない。
 * @boundary Host Context→Domain保存観測→Version Control。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { types } from "node:util";
import vm from "node:vm";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import * as domain from "../../src/index.ts";
import {
  observeRuntimeExecutionRepository,
  observeRuntimeRecoveryRepository,
  observeRuntimeSettlementRepository,
  observeRuntimeStorageRepository,
  runtimeStorageOperationIdentity,
} from "../../src/storage/runtime-repository.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { sourceDeclaration } from "../support/source-declaration.ts";

/**
 * 技術保存入口へ生Pathや構造だけ同じ参照を渡してもEffectを発行しない。
 * @responsibility 固定用途名だけでRootの真正性を省略する退行を拒否する。
 * @trace PRL-IT-012
 * @precondition 自己生成の空Root以外を使わない。
 * @stimulus 全固定保存・照会入口へ旧文字列と偽参照を与える。
 * @observation 拒否結果とDirectory内容の不変。
 * @oracle 初期化・Lock・Snapshot作成がなく、private WriterもRoot非公開。
 * @cleanup 今回Rootだけを既存helperで清掃する。
 * @boundary Host限定の保存API。真正Rootは実行Authorityの代替ではない。
 */
test("技術保存の全入口は生Path・偽RootをEffect前に拒否する", (t) => {
  const directory = createRepositoryTestDirectory("runtime-root-rejection-");
  t.after(directory.cleanup);
  const before = fs.readdirSync(directory.path);
  const names = [
    "readCoordinatorSnapshotIntakeEpoch",
    "initializeCoordinatorSnapshot",
    "saveCoordinatorIntegrationRecord",
    "saveCoordinatorWorkspaceRecord",
    "createCoordinatorAcceptanceDecision",
    "readCoordinatorAcceptanceDecision",
    "finalizeCoordinatorAcceptanceDecision",
    "createCoordinatorDecisionRecovery",
    "readCoordinatorDecisionRecovery",
    "updateCoordinatorDecisionRecovery",
    "readCoordinatorLeaseAcquisitionOwner",
    "confirmCoordinatorLeaseAcquisition",
    "saveCoordinatorLeaseReleaseIntent",
    "settleCoordinatorLeaseRelease",
    "verifyCoordinatorQueueIntake",
    "readCoordinatorQueueProject",
    "createCoordinatorQueueEntry",
    "readCoordinatorQueueEntry",
    "settleCoordinatorQueueRecovery",
    "createCoordinatorSingleTaskQueue",
    "closeCoordinatorUnstartedTaskQueue",
    "readCoordinatorCurrentState",
    "reserveCoordinatorLeaseAcquisition",
    "readCoordinatorLeaseOwnerLoss",
    "reconcileCoordinatorReleasedLease",
    "reserveCoordinatorLeaseRecovery",
    "settleCoordinatorLeaseRecovery",
    "settleCoordinatorQueueLeaseRelease",
    "updateCoordinatorQueueEntry",
    "updateCoordinatorSingleTaskQueue",
    "selectCoordinatorQueueEntry",
    "maintainCoordinatorSnapshotRecords",
    "transferCoordinatorSnapshotHistoryRecords",
    "readCoordinatorWorkspaceState",
    "readCoordinatorTaskIntakeState",
    "readCoordinatorExecutionState",
    "saveCoordinatorManagedProject",
  ] as const;
  for (const name of names)
    for (const root of [
      directory.path,
      {},
      { contract: "crdd-version-control/repository-location/v1" },
    ]) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: 宣言した固定集合の拒否契約を全件確認する試験。
      const operation = domain[name] as unknown as (...args: unknown[]) => {
        status: string;
      };
      const result = operation(root, "arbitrary-binding");
      assert.equal(result.status, "blocked", name);
      assert.deepEqual(fs.readdirSync(directory.path), before, name);
    }
  for (const name of [
    "writeCoordinatorSnapshot",
    "writeCoordinatorSnapshotOwned",
    "writeCoordinatorStateSnapshot",
    "withCoordinatorSnapshotOperation",
    "acquireCoordinatorSnapshotPilotLock",
    "resolveCoordinatorNamedPaths",
    "assertCoordinatorArea",
    "assertCoordinatorAreaUnchanged",
    "coordinatorSnapshotLeaseResourcesAbsent",
  ])
    assert.equal(name in domain, false, name);
});

/**
 * 同じ物理結合の用途差と元相関を確認する。
 * @responsibility Revision変更とOwner失効を別に観測し、新しい資格を作らない。
 * @trace PRL-IT-012
 * @precondition Repository内の新しい合成Gitだけを使う。
 * @stimulus 同じRootを借用しHEAD変更とHost現在性失効を与える。
 * @observation binding一致、再検証、偽Root・交差用途の拒否。
 * @oracle 通常と回復読取りだけがRevisionへ依存し、業務と終端は元実体条件を保つ。
 * @cleanup 今回生成した合成Rootだけをhookで削除する。
 * @boundary Domain内部のRoot観測。保存完了や実行成功の根拠にはしない。
 */
test("四用途は同じ実体結合を使いながら現在性条件を混同しない", (t) => {
  const directory = createRepositoryTestDirectory("runtime-repository-");
  t.after(directory.cleanup);
  const root = directory.path;
  const git = path.join(root, ".git");
  fs.mkdirSync(path.join(git, "refs", "heads"), { recursive: true });
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n");
  const reference = path.join(git, "refs", "heads", "main");
  fs.writeFileSync(reference, `${"1".repeat(40)}\n`);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  const capability = verified.capability;
  const storage = observeRuntimeStorageRepository(capability);
  const recovery = observeRuntimeRecoveryRepository(capability);
  assert.ok(storage);
  assert.ok(recovery);
  let live = true;
  const identity = Object.freeze({});
  const access = Object.freeze({
    identity,
    observeRepository: () =>
      Object.freeze({
        root: capability,
        purpose: "execution",
        operationId: "operation-a",
        revalidate: () => live && recovery.revalidate(),
      }),
  });
  const execution = observeRuntimeExecutionRepository(access);
  const settlement = observeRuntimeSettlementRepository({
    root: capability,
    purpose: "settlement",
    operationId: "operation-a",
    revalidate: () => storage.revalidate(),
  });
  assert.ok(execution);
  assert.ok(settlement);
  assert.equal(runtimeStorageOperationIdentity(access), identity);
  for (const observed of [storage, recovery, execution, settlement]) {
    assert.equal(observed.repositoryBinding, storage.repositoryBinding);
    assert.equal(observed.revalidate(), true);
  }
  for (const purpose of ["storage", "recovery", "settlement"]) {
    assert.equal(
      observeRuntimeExecutionRepository({
        ...access,
        observeRepository: () => ({
          root: capability,
          purpose,
          operationId: "operation-a",
          revalidate: () => true,
        }),
      }),
      null,
    );
  }
  assert.equal(
    observeRuntimeStorageRepository({
      contract: "crdd-version-control/repository-location/v1",
    }),
    null,
  );
  assert.equal(
    observeRuntimeExecutionRepository({
      ...access,
      observeRepository: () => ({
        root: {},
        purpose: "execution",
        operationId: "operation-a",
        revalidate: () => true,
      }),
    }),
    null,
  );
  fs.writeFileSync(reference, `${"2".repeat(40)}\n`);
  assert.equal(recovery.revalidate(), false);
  assert.equal(execution.revalidate(), false);
  assert.equal(storage.revalidate(), true);
  assert.equal(settlement.revalidate(), true);
  live = false;
  assert.equal(execution.revalidate(), false);
  const executionWithLiveHost = observeRuntimeExecutionRepository({
    ...access,
    observeRepository: () => ({
      root: capability,
      purpose: "execution",
      operationId: "operation-a",
      revalidate: () => true,
    }),
  });
  const settlementWithLiveHost = observeRuntimeSettlementRepository({
    root: capability,
    purpose: "settlement",
    operationId: "operation-a",
    revalidate: () => true,
  });
  assert.ok(executionWithLiveHost);
  assert.ok(settlementWithLiveHost);
  const originalGit = path.join(root, ".git-original");
  fs.renameSync(git, originalGit);
  fs.cpSync(originalGit, git, { recursive: true });
  assert.equal(executionWithLiveHost.revalidate(), false);
  assert.equal(settlementWithLiveHost.revalidate(), false);
});
/**
 * inherited thenを評価せず拒否する。
 * @responsibility 実宣言を隔離VMで実行しPrototype汚染による非同期値の混入を反証する。
 * @trace PRL-IT-012
 * @precondition 製品と同じdata・synchronous・通常観測宣言を使う。
 * @stimulus VMだけのObject.prototypeへthen getterを置く。
 * @observation 観測拒否、getter呼出し0、Root照合0。
 * @oracle 同期でない可能性のある結果から保存先を導出しない。
 * @cleanup VMだけを破棄し親ProcessのPrototypeを変更しない。
 * @boundary 保存内部の同期Host観測。
 */
test("継承したthenはgetterを評価せずRoot照合前に拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../src/storage/runtime-repository.ts", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ types });
  vm.runInContext(
    ["data", "synchronous", "observeRuntimeExecutionRepository"]
      .map((name) => sourceDeclaration(source, name))
      .join("\n") +
      `\nlet getterCalls = 0, rootCalls = 0;
    function observeRuntimeStorageRepository() { rootCalls++; return {}; }
    Object.defineProperty(Object.prototype, "then", { configurable: true, get() { getterCalls++; throw Error("then_accessed"); } });
    const observed = observeRuntimeExecutionRepository({ observeRepository: () => ({ purpose: "execution", root: {}, operationId: "op", revalidate: () => true }) });
    globalThis.result = { observed, getterCalls, rootCalls };`,
    context,
  );
  const result = context.result;
  assert.equal(result.observed, null);
  assert.equal(result.getterCalls, 0);
  assert.equal(result.rootCalls, 0);
});

/**
 * 観測不能なHost入力を評価せず拒否する。
 * @responsibility accessor・Proxy・thenable・拒否Promiseから保存資格を作らない。
 * @trace PRL-IT-012
 * @precondition 実Filesystemや認証情報を必要としない。
 * @stimulus 不正なHost Contextと六値照合callbackを与える。
 * @observation 呼出し列、未処理拒否、Root観測のnullを確認する。
 * @oracle 同期trueだけを認め、then getterやProxy trapを呼ばない。
 * @cleanup unhandledRejection監視をfinallyで外す。
 * @boundary 同期Host観測とDomain保存入力。
 */
test("不正Contextと非同期観測を拒否し内部Host読取りだけを受ける", async () => {
  let effects = 0;
  const getter = Object.defineProperty({}, "observeRepository", {
    get() {
      effects++;
      throw Error("getter");
    },
  });
  const proxy = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        effects++;
        throw Error("proxy");
      },
    },
  );
  assert.equal(observeRuntimeExecutionRepository(getter), null);
  assert.equal(observeRuntimeExecutionRepository(proxy), null);
  // biome-ignore lint/suspicious/noThenProperty: then getterを評価しない拒否境界の反例。
  const thenable = Object.defineProperty({}, "then", {
    get() {
      effects++;
      throw Error("then");
    },
  });
  assert.equal(
    observeRuntimeExecutionRepository({ observeRepository: () => thenable }),
    null,
  );
  assert.equal(effects, 0);
  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", listener);
  try {
    for (const callback of [
      () => {
        throw Error("observation");
      },
      () => Promise.reject(Error("rejected")),
      () => Promise.resolve(true),
      () => thenable,
      () => false,
    ]) {
      assert.equal(
        observeRuntimeExecutionRepository({ observeRepository: callback }),
        null,
      );
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    assert.equal(effects, 0);
  } finally {
    process.removeListener("unhandledRejection", listener);
  }
});
