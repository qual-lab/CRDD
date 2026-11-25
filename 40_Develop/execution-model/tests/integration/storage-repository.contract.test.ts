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
import * as domain from "../../src/index.ts";
import {
  executionStorageOperationIdentity,
  observeExecutionRecoveryRepository,
  observeExecutionSettlementRepository,
  observeExecutionStorageRepository,
  observeOperationRepository,
} from "../../src/storage/lock.ts";
import {
  createExecutionDataArea,
  observePhysicalExecutionDataArea,
} from "../../src/storage/store.ts";
import { readStoredExecutionFixture } from "../fixtures/stored-execution.ts";
import {
  createRepositoryTestDirectory,
  prepareFixtureRecovery,
} from "../support/repository-test-directory.ts";
import { sourceDeclaration } from "../support/source-declaration.ts";

/**
 * 正規Rootの物理保存領域だけをGitなしで扱えることを確認する。
 * @responsibility 保存OwnerのRootを受けた下位処理がGitの有無を使わないことを反証する。
 * @trace PRL-IT-012
 * @precondition 試験が所有する通常ディレクトリと既存の.crdd親。
 * @stimulus 親欠測、領域欠測、初回作成、再作成を観測する。
 * @observation 領域結果、前後の実体識別値、余分な作成の有無。
 * @oracle 起点欠測はblocked、領域欠測だけをnot_observedとし、既存領域は再作成しない。
 * @cleanup この試験が作成したRootだけを既存helperで回収する。
 * @boundary 私有の物理領域操作。公開保存入口の認可を代替しない。
 */
test("確認済みRootの物理保存領域はGitなしで観測と排他的作成ができる", (t) => {
  const owned = createRepositoryTestDirectory("runtime-physical-area-");
  t.after(owned.cleanup);
  const root = owned.path;
  const binding = domain.readExecutionStorageBinding(root);
  assert.match(binding ?? "", /^[0-9a-f]{64}$/u);
  const originalStat = fs.lstatSync;
  const missingFileId = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof originalStat>) => {
      const stat = Reflect.apply(originalStat, fs, args);
      if (stat && String(args[0]) === root && typeof stat.ino === "bigint") {
        stat.ino = 0n;
      }
      return stat;
    },
  );
  try {
    assert.equal(domain.readExecutionStorageBinding(root), null);
  } finally {
    missingFileId.mock.restore();
  }
  assert.equal(domain.readExecutionStorageBinding(root), binding);
  assert.equal(
    observePhysicalExecutionDataArea(
      path.join(root, "missing"),
      "execution-model",
    ).status,
    "blocked",
  );
  assert.equal(
    observePhysicalExecutionDataArea(root, "execution-model").status,
    "not_observed",
  );
  fs.mkdirSync(path.join(root, ".crdd"));
  const created = createExecutionDataArea(root);
  assert.equal(created.status, "created");
  if (created.status !== "created") assert.fail("fixture_area_creation_failed");
  assert.deepEqual(
    observePhysicalExecutionDataArea(root, "execution-model"),
    created.observation,
  );
  assert.equal(createExecutionDataArea(root).effectIssued, false);
  assert.deepEqual(fs.readdirSync(root), [".crdd"]);
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd")), [
    "execution-model",
  ]);
});

test("確定済みRootは正規パスの後に一度だけ実体を照合し、途中の差替えを拒否する", (t) => {
  const owned = createRepositoryTestDirectory("storage-root-revalidate-");
  t.after(owned.cleanup);
  const root = path.join(owned.path, "root");
  fs.mkdirSync(root);
  const observe = fs.lstatSync;
  const realpath = fs.realpathSync.native;
  const events: string[] = [];
  let fault: "none" | "alias" | "replace" = "none";
  const stat = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof observe>) => {
      if (args[0] === root) events.push("stat");
      return observe(...args);
    },
  );
  const resolve = t.mock.method(
    fs.realpathSync,
    "native",
    (name: fs.PathLike) => {
      const resolved = realpath(name);
      if (name !== root) return resolved;
      events.push("realpath");
      if (fault === "alias") return path.join(owned.path, "alias");
      if (fault === "replace") {
        fault = "none";
        fs.renameSync(root, path.join(owned.path, "previous"));
        fs.mkdirSync(root);
      }
      return resolved;
    },
  );
  try {
    const repository = observeExecutionStorageRepository({ directory: root });
    assert.ok(repository);
    assert.deepEqual(events.splice(0), ["stat", "realpath", "stat"]);
    assert.equal(repository.revalidate(), true);
    assert.deepEqual(events.splice(0), ["realpath", "stat"]);
    assert.equal(
      domain.readExecutionStorageBinding(root, repository.repositoryBinding),
      repository.repositoryBinding,
    );
    assert.deepEqual(events.splice(0), ["realpath", "stat"]);
    assert.equal(domain.readExecutionStorageBinding(root, "other"), null);
    assert.deepEqual(events.splice(0), ["realpath", "stat"]);
    fault = "alias";
    assert.equal(
      domain.readExecutionStorageBinding(root, repository.repositoryBinding),
      null,
    );
    assert.deepEqual(events.splice(0), ["realpath"]);
    fault = "replace";
    assert.equal(
      domain.readExecutionStorageBinding(root, repository.repositoryBinding),
      null,
    );
    assert.deepEqual(events.splice(0), ["realpath", "stat"]);
  } finally {
    stat.mock.restore();
    resolve.mock.restore();
  }
});

/**
 * Gitを持たない保存先で、定義の初期化・保存・再読取りを実行する。
 * @responsibility 上位が渡した保存先と参照値だけで完成操作が成立することを確認する。
 * @trace PRL-IT-012
 * @precondition 今回生成した空ディレクトリを使う。
 * @stimulus 確定ディレクトリを初期化し、Planを保存して再読取りする。
 * @observation 保存・読取りの結果とディレクトリ内の生成物。
 * @oracle Git設定を作らず、無効な保存先の照会は拒否する。
 * @cleanup 今回生成したRootだけを回収する。
 * @boundary 信頼した利用側→EM公開定義操作→物理保存。
 */
test("確定したディレクトリでGitなしに定義を保存・再読取りする", (t) => {
  const owned = createRepositoryTestDirectory("definition-no-git-");
  t.after(owned.cleanup);
  const access: domain.ExecutionModelAccess = {
    root: { directory: owned.path },
    principalId: "principal-fixture",
    revalidate: () => true,
    initialSourceRevision: "1".repeat(40),
  };
  const target = { projectId: "project-a", milestoneId: "milestone-a" };
  const initialized = domain.initializeExecutionState(access, {
    ...target,
    expectedAbsence: true,
  });
  assert.equal(initialized.status, "saved");
  if (initialized.status !== "saved")
    assert.fail("definition_initialization_failed");
  const saved = domain.savePlan(access, {
    ...target,
    expected: initialized.version,
    expectedDefinitionHash: null,
    definition: {
      milestoneAcceptanceCriteria: ["確認"],
      objectives: [{ id: "objective", acceptanceCriteria: ["確認"] }],
      tasks: [
        {
          id: "task",
          objectiveId: "objective",
          dependencies: [],
          allowedPaths: ["src/file.ts"],
          conflictKeys: [],
        },
      ],
    },
  });
  assert.equal(saved.status, "saved");
  assert.equal(domain.queryPlan(access, target).status, "available");
  let recoveryCurrent = true;
  const recovery = {
    purpose: "recovery",
    root: access.root,
    revalidate: () => recoveryCurrent,
  };
  const observed = domain.readState(recovery, { scope: "recovery" });
  assert.equal(observed.status, "completed");
  assert.equal(observed.lockReleased, true);
  assert.ok(observed.value);
  assert.deepEqual(Object.keys(observed.value).sort(), [
    "operationStates",
    "payloadSha256",
    "snapshot",
    "versionEvidence",
  ]);
  assert.deepEqual(Object.keys(observed.value.snapshot).sort(), [
    "operations",
    "revision",
    "unresolvedRecoveries",
  ]);
  assert.equal(observed.value.snapshot.revision, saved.version.revision);
  assert.equal(observed.value.payloadSha256, saved.version.payloadSha256);
  const versionEvidence = observed.value.versionEvidence;
  const forged = Object.create(Object.getPrototypeOf(versionEvidence));
  let traps = 0;
  const proxy = new Proxy(versionEvidence, {
    get() {
      traps++;
      throw new Error("must_not_observe_version_evidence_proxy");
    },
    getPrototypeOf() {
      traps++;
      throw new Error("must_not_observe_version_evidence_proxy");
    },
  });
  assert.equal(versionEvidence.matches(versionEvidence), true);
  assert.equal(versionEvidence.matches(forged), false);
  assert.equal(versionEvidence.matches(proxy), false);
  assert.equal(traps, 0);
  assert.equal(
    readStoredExecutionFixture(owned.path, observed.value.payloadSha256)
      .revision,
    observed.value.snapshot.revision,
  );
  assert.throws(
    () =>
      readStoredExecutionFixture(owned.path, initialized.version.payloadSha256),
    { code: "ERR_ASSERTION" },
  );
  assert.ok(Object.isFrozen(observed.value.snapshot));
  assert.equal(observed.historyPublicationStage, null);
  assert.equal(observed.completionPublicationReady, false);
  assert.equal(Object.hasOwn(observed, "currentHistoryPublication"), false);
  assert.equal(Object.hasOwn(observed, "currentCompletionPublication"), false);
  recoveryCurrent = false;
  const refused = domain.readState(recovery, { scope: "recovery" });
  assert.equal(refused.status, "blocked");
  assert.equal(refused.value, null);
  assert.equal(refused.historyPublicationStage, null);
  assert.equal(refused.completionPublicationReady, false);
  const missing = path.join(owned.path, "missing");
  assert.equal(
    domain.queryPlan({ ...access, root: { directory: missing } }, target)
      .status,
    "blocked",
  );
  assert.deepEqual(fs.readdirSync(owned.path), [".crdd"]);
});

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
    "initializeExecutionStore",
    "updateWorkspaceMetadata",
    "beginWorkspaceOperation",
    "saveIntegrationRecord",
    "readLease",
    "acquireLease",
    "releaseLease",
    "releaseLease",
    "readProjectExecutionState",
    "createQueue",
    "readQueueEntry",
    "updateQueue",
    "createQueue",
    "updateQueue",
    "acquireLease",
    "readLease",
    "recoverLease",
    "recoverLease",
    "recoverLease",
    "updateQueue",
    "updateQueue",
    "updateQueue",
    "selectNextQueueEntry",
    "retireStateRecords",
    "transferHistory",
    "readState",
    "saveProjectExecutionState",
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
    "writeSnapshot",
    "writeSnapshotOwned",
    "writeStateSnapshot",
    "withSnapshotOperation",
    "acquireSnapshotPilotLock",
    "resolveNamedPaths",
    "assertArea",
    "assertAreaUnchanged",
    "observePhysicalExecutionDataArea",
    "observeSnapshotLeaseResources",
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
 * @oracle 回復と上位から現在性を受け取る実行だけが、呼出し側の観測結果で失効する。
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
  const storageInput = { directory: root };
  const storage = observeExecutionStorageRepository(storageInput);
  let sourceCurrent = true;
  const recovery = observeExecutionRecoveryRepository(
    prepareFixtureRecovery(root, () => sourceCurrent),
  );
  assert.ok(storage);
  assert.ok(recovery);
  let live = true;
  const identity = Object.freeze({});
  const access = Object.freeze({
    identity,
    observeRepository: () =>
      Object.freeze({
        root: storageInput,
        purpose: "execution",
        operationId: "operation-a",
        revalidate: () => live && recovery.revalidate(),
      }),
  });
  const execution = observeOperationRepository(access);
  const settlement = observeExecutionSettlementRepository({
    root: storageInput,
    purpose: "settlement",
    operationId: "operation-a",
    revalidate: () => storage.revalidate(),
  });
  assert.ok(execution);
  assert.ok(settlement);
  assert.equal(executionStorageOperationIdentity(access), identity);
  for (const observed of [storage, recovery, execution, settlement]) {
    assert.equal(observed.repositoryBinding, storage.repositoryBinding);
    assert.equal(observed.revalidate(), true);
  }
  for (const purpose of ["storage", "recovery", "settlement"]) {
    assert.equal(
      observeOperationRepository({
        ...access,
        observeRepository: () => ({
          root: storageInput,
          purpose,
          operationId: "operation-a",
          revalidate: () => true,
        }),
      }),
      null,
    );
  }
  assert.equal(
    Reflect.apply(observeExecutionStorageRepository, undefined, [
      { repositoryRoot: root },
    ]),
    null,
  );
  assert.equal(
    observeOperationRepository({
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
  assert.equal(recovery.revalidate(), true);
  sourceCurrent = false;
  assert.equal(recovery.revalidate(), false);
  assert.equal(execution.revalidate(), false);
  assert.equal(storage.revalidate(), true);
  assert.equal(settlement.revalidate(), true);
  live = false;
  assert.equal(execution.revalidate(), false);
  let hostValid = true;
  const executionWithLiveHost = observeOperationRepository({
    ...access,
    observeRepository: () => ({
      root: storageInput,
      purpose: "execution",
      operationId: "operation-a",
      revalidate: () => hostValid,
    }),
  });
  const settlementWithLiveHost = observeExecutionSettlementRepository({
    root: storageInput,
    purpose: "settlement",
    operationId: "operation-a",
    revalidate: () => hostValid,
  });
  assert.ok(executionWithLiveHost);
  assert.ok(settlementWithLiveHost);
  const originalGit = path.join(root, ".git-original");
  fs.renameSync(git, originalGit);
  fs.cpSync(originalGit, git, { recursive: true });
  // 保存領域が同じなら通常保存の結合は変わらない。Gitの変更を受けて停止するかはHostが判断する。
  assert.equal(storage.revalidate(), true);
  assert.equal(executionWithLiveHost.revalidate(), true);
  assert.equal(settlementWithLiveHost.revalidate(), true);
  hostValid = false;
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
    new URL("../../src/storage/lock.ts", import.meta.url),
    "utf8",
  );
  const context = vm.createContext({ types });
  vm.runInContext(
    ["data", "synchronous", "observeOperationRepository"]
      .map((name) => sourceDeclaration(source, name))
      .join("\n") +
      `\nlet getterCalls = 0, rootCalls = 0;
    function observeExecutionStorageRepository() { rootCalls++; return {}; }
    Object.defineProperty(Object.prototype, "then", { configurable: true, get() { getterCalls++; throw Error("then_accessed"); } });
    const observed = observeOperationRepository({ observeRepository: () => ({ purpose: "execution", root: {}, operationId: "op", revalidate: () => true }) });
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
  assert.equal(observeOperationRepository(getter), null);
  assert.equal(observeOperationRepository(proxy), null);
  // biome-ignore lint/suspicious/noThenProperty: then getterを評価しない拒否境界の反例。
  const thenable = Object.defineProperty({}, "then", {
    get() {
      effects++;
      throw Error("then");
    },
  });
  assert.equal(
    observeOperationRepository({ observeRepository: () => thenable }),
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
        observeOperationRepository({ observeRepository: callback }),
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
