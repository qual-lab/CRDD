/**
 * coordinator:integration:task-durable-foundationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-durable-foundationが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、durable、foundation
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Coordinator Application Port→Core
 */

import assert from "node:assert/strict";
import { prepareFixtureRecovery } from "../support/recovery-repository.ts";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs";
import { parseStoredExecutionFixture } from "../../../execution-model/tests/fixtures/stored-execution.ts";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { acquireLock } from "@qual-lab/crdd-lock";
import {
  readProjectExecutionState,
  readQueueEntry,
  updateQueue,
  createQueue,
  selectNextQueueEntry,
  initializeExecutionStore,
  type ProjectExecutionInitialization,
  type ProjectExecutionState,
  queryPlan,
  readLease,
  readState,
  readExecutionState,
  readWorkspaceState,
  recoverLease,
  saveIntegrationRecord,
  savePlan,
  saveProjectExecutionState,
} from "@qual-lab/crdd-execution-model";
import {
  initialExecutionInput,
  projectExecutionFixture,
  taskStartFixture,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  getRepository,
  resolveVerifiedRepositoryRoot,
} from "@qual-lab/crdd-version-control";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
  resolveExecutionStorageDirectory,
} from "../../src/lifecycle/host.ts";
import {
  acquireCoordinatorSnapshotLease,
  settleCoordinatorSnapshotQueueLeaseRelease,
  borrowCoordinatorActiveLease,
  inspectCoordinatorSnapshotLeaseAcquisitionOwner,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
  updateCoordinatorQueue,
} from "../../src/lifecycle/host.ts";
import { createTestPersistence } from "../fixtures/task-persistence-fixture.ts";
import {
  finishOperationLease,
  runCoordinatorOperation,
} from "../../src/lifecycle/execution.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

// 保存の生Writer反例はDomainの保存試験が所有する。

/**
 * 最新の空Snapshotを明示作成してから、自己生成の試験開始値を配置する。
 * @responsibility 現行codecで検証した合成値を準備し、生Writerの検証とは分離する。
 * @trace PRL-IT-005
 * @input root: 自己所有Repository、payload: 試験用のTask表示値。
 * @returns 用途固定公開Readerで確認した試験開始値。
 * @precondition rootはこのCaseが作成した未使用の合成Repositoryである。
 * @stimulus 初回Queue／Project受付後、現在版の次改訂へ合成値を配置して公開Readerで確認する。
 * @observation 初期化結果と公開Readerの投影値を取得する。
 * @oracle 未検証本文や旧Schemaを試験開始値へ補完しない。
 * @effect 自己所有fixture内の現在状態だけを作成・更新する。
 * @cleanup 呼出しCaseが自己所有Rootを終了後に回収する。
 * @boundary PRL-IT-005=Direct Boundary: 合成Task状態の準備。出版・排他保証はDomain試験が所有する。
 */
function seedSnapshot(
  root: string,
  payload: Record<string, unknown> & { snapshotRevision: number },
) {
  const verified = resolveExecutionStorageDirectory(root);
  const initialized = initializeExecutionStore(verified, "binding-a");
  assert.equal(initialized.status, "completed");
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  for (const state of payload.projects as readonly ProjectExecutionState[]) {
    const queue = (
      payload.queueEntries as readonly { queueId: string; projectId: string }[]
    ).find((item) => item.projectId === state.projectId);
    const saved = createQueue(verified, "binding-a", {
      kind: "scheduled",
      input: [
        {
          queueId: queue?.queueId ?? `queue-${state.projectId}`,
          projectId: state.projectId,
          milestoneId: state.milestoneId,
          requestHash: "b".repeat(64),
          originLane: "interactive",
          repositoryRevision: state.repositoryRevision,
          scopeHash: "c".repeat(64),
        },
        initialExecutionInput(state),
      ],
    });
    assert.equal(saved.status, "completed");
    assert.deepEqual(
      readProjectExecutionState(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        state.projectId,
      ).value,
      { ...state, queueId: queue?.queueId ?? `queue-${state.projectId}` },
    );
  }
  const bytes = fs.readFileSync(file);
  const repository = getRepository(root);
  assert.equal(repository.status, "completed");
  if (repository.status !== "completed") throw Error("fixture_root_invalid");
  const currentRead = readState(prepareFixtureRecovery(repository.capability), {
    scope: "recovery",
  });
  assert.equal(currentRead.status, "completed");
  const current = currentRead.value;
  assert.ok(current);
  assert.equal(
    current.payloadSha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  const stored = parseStoredExecutionFixture(bytes.toString("utf8"));
  payload.queueEntries = (
    payload.queueEntries as readonly Record<string, unknown>[]
  ).map((item) => ({
    ...stored.queueEntries.find((queue) => queue.queueId === item.queueId),
    ...item,
  }));
  const {
    schema: _schema,
    schemaRevision: _version,
    repositoryRootHash: _rootHash,
    snapshotRevision: _revision,
    projects: _projects,
    ...rest
  } = payload;
  payload.snapshotRevision = current.snapshot.revision + 1;
  const fixtureBytes = Buffer.from(
    `${canonicalJson({ ...stored, ...rest, revision: payload.snapshotRevision, previous: { revision: current.snapshot.revision, payloadSha256: current.payloadSha256 } })}\n`,
  );
  // 値準備だけ。生Writerの保証はDomain試験へ分離し、実保存は以降の有限Portが所有する。
  fs.writeFileSync(file, fixtureBytes);
  const observed = readFixtureSnapshot(root, "binding-a");
  assert.equal(observed.status, "completed");
  return observed;
}

/**
 * 保存fixtureの期待Root結合をFilesystemの観測値から独立に計算する。
 * @responsibility Hash取得だけのためにDomain私有排他へ依存しない。
 * @trace PRL-IT-005
 * @precondition 今回の自己生成Rootだけを渡す。
 * @stimulus 真正Rootのディレクトリ実体を読む。
 * @observation 固定の保存結合Hash。
 * @oracle 実Writerが同じ結合を再検査し、不一致はfixture作成時に失敗する。
 * @cleanup N/A: 読取りだけで資源を取得しない。
 * @boundary 試験期待値の組立て。製品保存API・Authorityではない。
 */
function fixtureRepositoryHash(root: string) {
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  const actualRoot = resolveVerifiedRepositoryRoot(verified.capability);
  assert.ok(actualRoot);
  const identity = fs.lstatSync(actualRoot, { bigint: true });
  const ino =
    process.platform === "win32" && identity.ino < 0n
      ? BigInt.asUintN(64, identity.ino)
      : identity.ino;
  return createHash("sha256")
    .update("crdd-execution-storage-directory/v1\0")
    .update(
      JSON.stringify([
        actualRoot,
        String(identity.dev),
        String(ino),
        String(identity.birthtimeNs),
      ]),
      "utf8",
    )
    .digest("hex");
}

/**
 * 結合試験自身の物理Snapshotを公開Readerと同じ版へ照合して観測する。
 * @responsibility 生Readerを公開・借用せず、自己生成物の全区画を反証用に読む。
 * @trace PRL-IT-005
 * @precondition 呼出しCaseが所有するRootで並行Writerが存在しない。
 * @stimulus 概要Readerと回復Readerが同じ保存本文を観測することを照合する。
 * @observation 公開区画と物理投影の同値性、全区画の期待値。
 * @oracle 拒否・不存在・不一致を成功へ補完しない。
 * @cleanup Rootは各Caseの既存hookが回収する。
 * @boundary 試験用観測だけ。保存・排他・Authorityを実装しない。
 */
function readFixtureSnapshot(root: string, binding: string) {
  const observed = readExecutionState(
    resolveExecutionStorageDirectory(root),
    binding,
  );
  if (observed.status !== "completed" || observed.value === null)
    return { ...observed, value: null };
  const bytes = fs.readFileSync(
    path.join(root, ".crdd", "execution-model", "state.json"),
    "utf8",
  );
  const projected = taskView(root, bytes);
  assert.deepEqual(projected.projects, observed.value.projects);
  assert.deepEqual(projected.queueEntries, observed.value.queueEntries);
  assert.equal(projected.schemaRevision, observed.value.schemaRevision);
  return { ...observed, value: projected };
}

/**
 * 最新の物理Snapshotを同じRepositoryのTask表示へ投影する。
 * @responsibility 公開ReaderのSnapshot・Project投影と元本文を照合する。
 * @trace PRL-IT-005
 * @precondition rootとbytesは同じCaseの自己生成物である。
 * @stimulus VCで確定したRepositoryを公開Readerへ渡す。
 * @observation 保存読取りとTask投影の成功値。
 * @oracle 別Rootや不正本文を成功へ補完しない。
 * @cleanup 呼出しCaseが自己生成Rootを清掃する。
 * @boundary 公開Readerの短期排他と保存読取り。製品Writerは呼ばない。
 */
function taskView(root: string, bytes: string) {
  const rootHash = fixtureRepositoryHash(root);
  const repository = getRepository(root);
  assert.equal(repository.status, "completed");
  if (repository.status !== "completed") throw Error("fixture_root_invalid");
  const observed = readState(prepareFixtureRecovery(repository.capability), {
    scope: "recovery",
  });
  assert.equal(observed.status, "completed");
  const decoded = observed.value;
  assert.ok(decoded);
  assert.equal(
    decoded.payloadSha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  const snapshot = parseStoredExecutionFixture(bytes);
  assert.ok(snapshot.repositoryBindingId !== null);
  const workspace = readWorkspaceState(
    resolveExecutionStorageDirectory(root),
    snapshot.repositoryBindingId,
  );
  assert.equal(workspace.status, "completed", workspace.reason);
  assert.ok(workspace.value);
  assert.equal(workspace.value.snapshotRevision, snapshot.revision);
  const view = {
    schema: "crdd-execution-model/project-snapshot/v9" as const,
    schemaRevision: 9 as const,
    repositoryRootHash: rootHash,
    repositoryBindingId: snapshot.repositoryBindingId,
    snapshotRevision: snapshot.revision,
    projects: workspace.value.projects,
    queueEntries: snapshot.queueEntries,
    workspaces: snapshot.workspaces,
    leaseEvidence: snapshot.leaseEvidence,
    leaseIntents: snapshot.leaseIntents,
    results: snapshot.results,
    historyPending: snapshot.historyPending,
    decisions: snapshot.decisions,
    blockers: snapshot.blockers,
  };
  assert.ok(view);
  return view;
}

for (const fault of ["unobservable", "alias"] as const) {
  /**
   * tmpの親境界を確認できないLeaseを削除しない。
   * @responsibility Owner blockedと物理Identity/Recovery Identityの保持を判定する。
   * @trace PRL-IT-012
   * @precondition 新版の実Leaseと取得intentがある。
   * @stimulus tmpの観測不能又は親移動・junction置換を試行する。OS拒否時はalias未成立を明示する。
   * @observation 停止結果、回復ID、Lock実体と保存bytesを取得する。
   * @oracle 置換成立時だけ解放拒否と同じLock・回復参照を確認する。OSが親移動を拒否した場合は元実体・保存不変と正常解放を確認する。
   * @cleanup OS拒否時は正常解放、置換成立時は親を復元し終了したdescriptorの元回復IDで既存回復を行い、fixtureを清掃する。
   * @boundary opaque Lease→Runtime Data Owner→Filesystem cleanup。
   */
  test(`tmp親境界の${fault}はLeaseを不存在にせず削除を拒否する`, (t) => {
    const { root } = currentQueueFixture(t);
    const acquired = acquireCoordinatorSnapshotLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("fixture_lease_failed");
    const beforeSnapshot = readFixtureSnapshot(root, "binding-a").value;
    assert.ok(beforeSnapshot?.schemaRevision === 9);
    const recoveryId = beforeSnapshot.leaseIntents[0]?.recoveryId;
    assert.ok(recoveryId);
    const temporary = path.join(root, ".crdd", "lock");
    const moved = path.join(root, "prior-temporary-area");
    const locks = temporary;
    const names = fs.readdirSync(locks);
    assert.equal(names.length, 1);
    const lockName = names[0];
    assert.ok(lockName);
    const lockPath = path.join(locks, lockName);
    const lockMetadata = fs.lstatSync(lockPath);
    const statePath = path.join(root, ".crdd", "execution-model", "state.json");
    const beforeBytes = fs.readFileSync(statePath);
    const original = fs.lstatSync;
    if (fault === "alias") {
      try {
        fs.renameSync(temporary, moved);
      } catch (error) {
        // Windowsが保持中fdの祖先移動を拒否した場合、aliasは成立していない。
        assert.ok(
          ["EPERM", "EACCES", "EBUSY"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          ),
        );
        assert.equal(fs.existsSync(moved), false);
        const current = fs.lstatSync(lockPath);
        assert.equal(current.dev, lockMetadata.dev);
        assert.equal(current.ino, lockMetadata.ino);
        assert.deepEqual(fs.readFileSync(statePath), beforeBytes);
        assert.equal(acquired.value.release().status, "completed");
        assert.equal(fs.existsSync(lockPath), false);
        t.diagnostic(
          "OSが保持中Leaseの親移動を拒否。aliasを作成したSource反証とは区別する。",
        );
        return;
      }
      fs.symlinkSync(moved, temporary, "junction");
    } else {
      Reflect.set(fs, "lstatSync", ((
        target: fs.PathLike,
        ...args: unknown[]
      ) => {
        if (String(target) === temporary)
          throw Object.assign(new Error("injected_tmp_observation_failure"), {
            code: "EACCES",
          });
        return Reflect.apply(original, fs, [target, ...args]);
      }) as typeof fs.lstatSync);
    }
    try {
      const result = acquired.value.release();
      assert.equal(result.status, "blocked");
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(result.recoveryId, recoveryId);
    } finally {
      Reflect.set(fs, "lstatSync", original);
      if (fault === "alias") {
        fs.unlinkSync(temporary);
        fs.renameSync(moved, temporary);
      }
    }
    const actual = fs.lstatSync(lockPath);
    assert.equal(actual.dev, lockMetadata.dev);
    assert.equal(actual.ino, lockMetadata.ino);
    assert.equal(actual.birthtimeMs, lockMetadata.birthtimeMs);
    assert.deepEqual(fs.readFileSync(statePath), beforeBytes);
    assert.equal(
      reconcileCoordinatorSnapshotLeaseOwnerLoss(
        root,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
        (owner) => ({ ...owner, status: "absent" }),
      ).status,
      "completed",
    );
    assert.equal(fs.existsSync(lockPath), false);
  });
}

/**
 * 廃止した公開初期化commandを実Processで拒否しStateを作らないことを検証する。
 * @responsibility 運用手順と本番の明示初期化を同じ入口へ結合する。
 * @trace PRL-IT-012
 * @precondition 自己所有の新品Repositoryを使う。
 * @stimulus 公開launcherのproject initを二回実行する。
 * @observation 応答、保存世代とFile一覧を読む。
 * @oracle 二回とも同じ拒否でState・Provider・旧Directoryを作らない。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 公開launcher、CLI、実保存。
 */
test("snapshot production: removed initialization command cannot create state", (t) => {
  const { root } = fixture(t);
  const launcher = fileURLToPath(
    new URL("../../../../template/tools/crdd-coordinator.ts", import.meta.url),
  );
  /**
   * 公開入口から自己所有Repositoryを明示初期化する。
   * @responsibility 同じ入口の再実行結果と受付世代を観測する。
   * @trace PRL-IT-012
   * @precondition 新品のGit Repositoryと固定launcherを使用する。
   * @stimulus project init --jsonを実Processで実行する。
   * @observation 正式JSON応答を解析して返す。
   * @oracle 初回と再実行はどちらも未知commandとして拒否される。
   * @cleanup 同期子Processは終了まで待ち、親試験がfixtureを回収する。
   * @boundary PRL-IT-012=Direct Boundary: 公開launcher→CLI→Repository保存。
   */
  const invoke = () =>
    spawnSync(process.execPath, [launcher, "project", "init", "--json"], {
      cwd: root,
      windowsHide: true,
      encoding: "utf8",
    });
  const first = invoke();
  const second = invoke();
  assert.equal(first.status, 64);
  assert.equal(second.status, 64);
  assert.equal(second.stderr, first.stderr);
  assert.equal(first.stdout, "");
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model", "state.json")),
    false,
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd", "orchestrator")), false);
});

/**
 * 二Processの初回観測を揃え、同ID受付を既存Writerで一体化する。
 * @responsibility 敗者Projectの残存と、同内容再送による初期値の上書きを反証する。
 * @trace PRL-IT-005
 * @precondition 各Caseの自己所有Repositoryと有効な初回Stateを用いる。
 * @stimulus 両子がQueue不存在を観測してから、同内容又は異Projectの受付を解放する。
 * @observation 子の終了、受付結果と同じSnapshotのProject・Queue・Hash。
 * @oracle 保存するのは勝者のProjectとQueue一組だけ。同内容は元値を返し異内容は追加0。
 * @cleanup finallyで両子の終了をjoinしてから既存fixtureがRootを回収する。
 * @boundary Node子Process二つとEMの実Writer・共通Lock。
 */
test("初回StateとQueueの受付は二Processの古い観測でも一組だけを保存する", {
  timeout: 60000,
}, async (t) => {
  const domainUrl = import.meta.resolve("@qual-lab/crdd-execution-model");
  const worker = `
    import {createQueue,readExecutionState} from ${JSON.stringify(domainUrl)};
    const [root,json]=process.argv.slice(1);
    const input=JSON.parse(json);
    const storage={directory:root};
    const before=readExecutionState(storage,"binding-a");
    if(before.status!=="completed")throw Error("observation_failed");
    process.stdout.write(JSON.stringify({ready:true,queues:before.value?.queueEntries.length??0})+"\\n");
    await new Promise(resolve=>process.stdin.once("data",resolve));
    const result=createQueue(storage,"binding-a",{kind:"scheduled",input:[input.queue,input.state]});
    process.stdout.write(JSON.stringify(result)+"\\n");
  `;
  for (const sameContent of [false, true]) {
    const { root, state } = fixture(t);
    const initialization = initialExecutionInput(state);
    assert.equal(
      initializeExecutionStore(
        resolveExecutionStorageDirectory(root),
        "binding-a",
      ).status,
      "completed",
    );
    const queue = {
      queueId: "parallel-request",
      projectId: state.projectId,
      milestoneId: state.milestoneId,
      requestHash: "b".repeat(64),
      originLane: "interactive" as const,
      repositoryRevision: state.repositoryRevision,
      scopeHash: "c".repeat(64),
    };
    const beforeAcceptance = fs.readFileSync(
      path.join(root, ".crdd", "execution-model", "state.json"),
      "utf8",
    );
    let stateHooks = 0;
    const accessorState = {
      ...initialization,
      get projectId() {
        stateHooks++;
        return state.projectId;
      },
    };
    const proxyState = new Proxy(initialization, {
      ownKeys() {
        stateHooks++;
        return Reflect.ownKeys(state);
      },
    });
    for (const invalid of [
      state,
      accessorState,
      proxyState,
      { ...initialization, generation: 2 },
      { ...initialization, projectId: "project-unbound" },
      { ...initialization, milestoneId: "milestone-unbound" },
      { ...initialization, repositoryRevision: "d".repeat(40) },
    ]) {
      const rejected = createQueue(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        {
          kind: "scheduled",
          input: [queue, invalid as unknown as ProjectExecutionInitialization],
        },
      );
      assert.equal(rejected.status, "blocked");
      assert.equal(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
          "utf8",
        ),
        beforeAcceptance,
      );
    }
    assert.equal(stateHooks, 0);
    const inputs = [
      { queue, state: initialization },
      {
        queue: {
          ...queue,
          projectId: sameContent ? queue.projectId : "project-other",
          requestHash: sameContent ? queue.requestHash : "d".repeat(64),
        },
        state: {
          ...initialization,
          projectId: sameContent ? state.projectId : "project-other",
          ownerGeneration: "other-owner",
        },
      },
    ];
    const children = [];
    try {
      for (const input of inputs) {
        const child = spawn(
          process.execPath,
          [
            "--input-type=module",
            "--eval",
            worker,
            root,
            JSON.stringify(input),
          ],
          { windowsHide: true, stdio: "pipe" },
        );
        const ready = once(child.stdout, "data", {
          signal: AbortSignal.timeout(15000),
        });
        const closed = once(child, "close");
        closed.catch(() => {});
        children.push({ child, ready, closed });
        const [bytes] = await ready;
        assert.deepEqual(JSON.parse(String(bytes)), { ready: true, queues: 0 });
      }
      const outcomes = [];
      for (const item of children) {
        const response = once(item.child.stdout, "data", {
          signal: AbortSignal.timeout(15000),
        });
        item.child.stdin.end("go");
        const [bytes] = await response;
        outcomes.push(JSON.parse(String(bytes)));
        const [code, signal] = await item.closed;
        assert.equal(code, 0);
        assert.equal(signal, null);
      }
      assert.equal(outcomes[0].status, "completed", outcomes[0].reason);
      assert.equal(outcomes[1].status, sameContent ? "completed" : "blocked");
      assert.equal(
        outcomes[1].reason,
        sameContent
          ? "coordinator_queue_request_reused"
          : "coordinator_queue_identity_conflict",
      );
      const saved = readFixtureSnapshot(root, "binding-a").value;
      assert.ok(saved);
      assert.equal(saved.projects.length, 1);
      assert.equal(saved.queueEntries.length, 1);
      assert.equal(saved.projects[0]?.projectId, state.projectId);
      assert.equal(saved.projects[0]?.ownerGeneration, state.ownerGeneration);
      assert.equal(saved.queueEntries[0]?.requestHash, queue.requestHash);
      assert.equal(saved.queueEntries[0]?.queueId, queue.queueId);
    } finally {
      for (const item of children) {
        if (item.child.exitCode === null && item.child.signalCode === null)
          item.child.kill();
        await item.closed;
        assert.ok(
          item.child.exitCode !== null || item.child.signalCode !== null,
        );
      }
    }
  }
});

/**
 * 新品初期化と同じ要求の再初期化を検証する。
 * @responsibility 再初期化が既存の保存版を変更しないことを確認する。
 * @trace PRL-IT-012
 * @precondition Repository-localの隔離fixtureを用いる。
 * @stimulus 同じRootで明示初期化を二度行う。
 * @observation 保存本文と改訂を読む。
 * @oracle 二回目にも同じ結果を返し、版と本文を変更しない。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 初期化入口から実保存。
 */
test("snapshot production: fresh bootstrap is idempotent", (t) => {
  const { root } = fixture(t);
  assert.equal(readFixtureSnapshot(root, "binding-a").value, null);
  const initialized = initializeExecutionStore(
    resolveExecutionStorageDirectory(root),
    "binding-a",
  );
  assert.equal(initialized.status, "completed");
  const beforeInitialization = fs.readFileSync(
    path.join(root, ".crdd", "execution-model", "state.json"),
    "utf8",
  );
  const beforeRevision = readFixtureSnapshot(root, "binding-a").value
    ?.snapshotRevision;
  assert.equal(
    initializeExecutionStore(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    ).value,
    initialized.value,
  );
  assert.equal(
    fs.readFileSync(
      path.join(root, ".crdd", "execution-model", "state.json"),
      "utf8",
    ),
    beforeInitialization,
  );
  assert.equal(
    readFixtureSnapshot(root, "binding-a").value?.snapshotRevision,
    beforeRevision,
  );
});

/**
 * 新版Owner喪失処置の観測と終了境界を検証する。
 * @responsibility 存続・不明・対象変更を回収完了へ畳まない。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryのv2現在状態と通常Leaseを使う。
 * @stimulus Owner観測結果、空Directory、保存中断を変える。
 * @observation intent、終了証拠、Queue、実排他、同じ回復参照を読む。
 * @oracle absent一致時だけ回収し、取得未確定の成功証拠を作らない。
 * @cleanup mockを戻し、自己所有fixtureだけを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Snapshot→Process観測→実排他。
 */
test("Host Windows: 新版Owner喪失は現在観測と同じ取得へ結合する", {
  skip: process.platform !== "win32",
}, (t) => {
  for (const mode of [
    "alive",
    "unknown",
    "mismatch",
    "nonempty",
    "normal",
    "bound",
    "target_changed",
    "observer_throw",
    "initial_release_unknown",
    "never_acquired",
    "save_failure",
    "unbound_absent",
    "unbound_no_parent",
    "unbound_present",
  ] as const) {
    const { root, state } = fixture(t);
    const queueId = "queue-a";
    const rootHash = fixtureRepositoryHash(root);
    assert.equal(
      seedSnapshot(root, {
        schema: "crdd-execution-model/project-snapshot/v9",
        schemaRevision: 9,
        workspaces: [],
        repositoryRootHash: rootHash,
        repositoryBindingId: "binding-a",
        snapshotRevision: 1,
        projects: [state],
        queueEntries: [
          {
            historySettled: false,
            workspaceId: null,
            queueId,
            projectId: "project-a",
            milestoneId: "milestone-a",
            requestHash: "b".repeat(64),
            originLane: "interactive",
            repositoryRevision: "a".repeat(40),
            scopeHash: "c".repeat(64),
            state: "queued",
            generation: 1,
            ownerGeneration: null,
            resumeCondition: null,
            resultReference: null,
          },
        ],
        leaseIntents: [],
        leaseEvidence: [],
        results: [],
        historyPending: [],
        decisions: [],
        blockers: [],
      }).status,
      "completed",
    );
    const current = path.join(root, ".crdd", "execution-model", "state.json");
    if (mode === "never_acquired") {
      const bytes = fs.readFileSync(current, "utf8");
      const absent = reconcileCoordinatorSnapshotLeaseOwnerLoss(
        root,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
        () => {
          throw new Error("must_not_observe");
        },
      );
      assert.equal(absent.status, "completed");
      assert.equal(fs.readFileSync(current, "utf8"), bytes);
      assert.equal(
        fs
          .readdirSync(path.join(root, ".crdd", "lock"))
          .filter((name) => name.startsWith("coordinator.lease.")).length,
        0,
      );
      continue;
    }
    const originalRename = fs.renameSync;
    let isInjected = false;
    const isUnbound = mode.startsWith("unbound");
    const mock = isUnbound
      ? t.mock.method(
          fs,
          "renameSync",
          (...args: Parameters<typeof originalRename>) => {
            if (
              !isInjected &&
              String(args[1]) === current &&
              JSON.parse(fs.readFileSync(String(args[0]), "utf8")).leaseEvidence
                .length > 0
            ) {
              isInjected = true;
              throw new Error("acquired_save_failed");
            }
            return Reflect.apply(originalRename, fs, args);
          },
        )
      : null;
    const ports = Object.freeze({
      workingDirectory: root,
      repository: resolveExecutionStorageDirectory(root),
      repositoryBindingId: "binding-a",
      intake: undefined,
    });
    const acquired = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      queueId,
      "project-operation",
    );
    mock?.mock.restore();
    if (isUnbound) {
      assert.equal(acquired.status, "blocked");
      // 本試験が所有する失敗候補を戻し、回収入口の現在状態からの処置だけを評価する。
      fs.unlinkSync(
        path.join(root, ".crdd", "execution-model", "state.pending.json"),
      );
      assert.equal(
        fs.existsSync(
          path.join(root, ".crdd", "execution-model", "state.lock"),
        ),
        false,
      );
    } else assert.equal(acquired.status, "completed");
    const statePort = ports;
    if (mode === "bound" && acquired.status === "completed") {
      assert.equal(
        updateCoordinatorQueue(statePort, "queue-a", 1, {
          state: "leased",
          lease: acquired.value,
          resumeCondition: null,
          resultReference: null,
        }).status,
        "completed",
      );
    }
    const locks = path.join(root, ".crdd", "lock");
    const lock = path.join(locks, fs.readdirSync(locks)[0] as string);
    if (mode === "nonempty") fs.appendFileSync(lock, "fixture");
    if (mode === "unbound_absent" || mode === "unbound_no_parent")
      fs.unlinkSync(lock);
    if (mode === "unbound_no_parent") {
      fs.rmdirSync(locks);
    }
    const before = taskView(root, fs.readFileSync(current, "utf8"));
    assert.ok(before.leaseIntents[0]);
    const recoveryId = before.leaseIntents[0].recoveryId;
    let shouldFailEnd = mode === "save_failure";
    const ending = t.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof originalRename>) => {
        if (
          shouldFailEnd &&
          String(args[1]) === current &&
          JSON.parse(fs.readFileSync(String(args[0]), "utf8")).leaseIntents
            .length === 0
        ) {
          shouldFailEnd = false;
          throw new Error("end_save_failed");
        }
        return Reflect.apply(originalRename, fs, args);
      },
    );
    const originalRelease = fs.rmSync;
    const isReleaseUnknown = mode === "initial_release_unknown";
    const releasing = t.mock.method(
      fs,
      "rmSync",
      (...args: Parameters<typeof originalRelease>) => {
        if (
          isReleaseUnknown &&
          path.dirname(String(args[0])) === path.join(root, ".crdd", "lock") &&
          /^execution-model\.state\.lock$/u.test(path.basename(String(args[0])))
        )
          throw Error("injected_initial_snapshot_release_unknown");
        return Reflect.apply(originalRelease, fs, args);
      },
    );
    let isCallbackObserved = false;
    const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      root,
      "binding-a",
      "project-a",
      queueId,
      "project-operation",
      (owner) => {
        isCallbackObserved = true;
        // callbackが短期排他を保持していないことを実Ownerの再取得で確認する。
        const observed = readExecutionState(
          resolveExecutionStorageDirectory(root),
          "binding-a",
        );
        assert.equal(observed.status, "completed", observed.reason);
        if (mode === "observer_throw") throw new Error("observation_failed");
        if (mode === "target_changed" && acquired.status === "completed") {
          assert.equal(
            updateCoordinatorQueue(statePort, "queue-a", 1, {
              state: "leased",
              lease: acquired.value,
              resumeCondition: null,
              resultReference: null,
            }).status,
            "completed",
          );
        }
        return {
          ...owner,
          status:
            mode === "alive"
              ? "alive"
              : mode === "unknown"
                ? "unknown"
                : "absent",
          ownerGeneration:
            mode === "mismatch" ? "other-owner" : owner.ownerGeneration,
        };
      },
    );
    releasing.mock.restore();
    ending.mock.restore();
    if (
      [
        "alive",
        "unknown",
        "mismatch",
        "observer_throw",
        "target_changed",
        "initial_release_unknown",
        "nonempty",
        "save_failure",
      ].includes(mode)
    ) {
      assert.equal(result.status, "blocked", mode);
      if (mode !== "alive") assert.equal(result.recoveryId, recoveryId);
      if (mode === "initial_release_unknown") {
        assert.equal(isCallbackObserved, false);
        assert.equal(result.manualRecoveryRequired, true);
      }
      assert.equal(fs.existsSync(lock), mode !== "save_failure");
      assert.ok(
        JSON.parse(fs.readFileSync(current, "utf8")).leaseIntents.length > 0,
      );
      if (mode === "save_failure") {
        const stateBytes = fs.readFileSync(current, "utf8");
        const pending = fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.pending.json"),
          "utf8",
        );
        let pendingCallbackCalls = 0;
        const repeated = reconcileCoordinatorSnapshotLeaseOwnerLoss(
          root,
          "binding-a",
          "project-a",
          queueId,
          "project-operation",
          () => {
            pendingCallbackCalls += 1;
            throw new Error("must_not_observe_pending");
          },
        );
        assert.equal(repeated.status, "blocked");
        assert.equal(pendingCallbackCalls, 0);
        assert.equal(repeated.recoveryId, recoveryId);
        assert.equal(repeated.manualRecoveryRequired, true);
        assert.equal(fs.readFileSync(current, "utf8"), stateBytes);
        assert.equal(
          fs.readFileSync(
            path.join(root, ".crdd", "execution-model", "state.pending.json"),
            "utf8",
          ),
          pending,
        );
        assert.equal(fs.existsSync(lock), false);
        // 自己生成の未確定fixtureを配置する。出版の保証はDomain試験が所有する。
        const fixtureBytes = Buffer.from(pending);
        fs.writeFileSync(current, fixtureBytes);
        fs.unlinkSync(
          path.join(root, ".crdd", "execution-model", "state.pending.json"),
        );
        assert.deepEqual(fs.readFileSync(current), fixtureBytes);
        assert.throws(
          () =>
            fs.lstatSync(
              path.join(root, ".crdd", "execution-model", "state.pending.json"),
            ),
          { code: "ENOENT" },
        );
        // 未出版候補の値検査はEMが所有する。ここでは明示配置と元pendingの除去だけを確認する。
      }
    } else {
      assert.equal(result.status, "completed");
      const saved = JSON.parse(fs.readFileSync(current, "utf8"));
      assert.deepEqual(result.value?.queue, saved.queueEntries[0]);
      assert.equal(saved.leaseIntents.length, 0);
      assert.equal(
        saved.leaseEvidence.at(-1).content.disposition,
        isUnbound ? "acquisition_unknown_closed" : "recovered_after_owner_loss",
      );
      assert.equal(saved.leaseEvidence.length, isUnbound ? 1 : 2);
      assert.equal(
        saved.queueEntries[0].state,
        mode === "bound" ? "recovery_required" : "queued",
      );
      assert.equal(saved.queueEntries[0].ownerGeneration, null);
      assert.equal(
        saved.queueEntries[0].resumeCondition,
        mode === "bound" ? "owner_loss" : null,
      );
      assert.equal(saved.queueEntries[0].resultReference, recoveryId);
      assert.equal(fs.existsSync(lock), false);
    }
  }
});

/**
 * 取得・解放途中の不明状態を確認する。
 * @responsibility 保存失敗と物理操作失敗を清掃完了へ丸めない。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryとv2保存を使う。
 * @stimulus 取得証拠の置換失敗と実排他の解放失敗を注入する。
 * @observation 回復参照、残存intent、実排他と再取得拒否を確認する。
 * @oracle 同じexact Identityを維持し、使用中のQueueを解除しない。
 * @cleanup mockを戻して自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 統合Lease→保存と実排他。
 */
test("Host Windows: 統合Leaseは取得・解放途中の記録を保全する", {
  skip: process.platform !== "win32",
}, (t) => {
  for (const failure of [
    "intent_record",
    "acquired_record",
    "root_replacement",
    "intent_release_confirmation",
    "physical_release",
  ] as const) {
    const { root, state } = fixture(t);
    const rootHash = fixtureRepositoryHash(root);
    const payload = {
      schema: "crdd-execution-model/project-snapshot/v9",
      schemaRevision: 9,
      workspaces: [],
      repositoryRootHash: rootHash,
      repositoryBindingId: "binding-a",
      snapshotRevision: 1,
      projects: [state],
      queueEntries: [
        {
          workspaceId: null,
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "interactive",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
          state: "queued",
          generation: 1,
          ownerGeneration: null,
          resumeCondition: null,
          resultReference: null,
        },
      ],
      leaseEvidence: [],
      leaseIntents: [],
      results: [],
      historyPending: [],
      decisions: [],
      blockers: [],
    };
    assert.equal(seedSnapshot(root, payload).status, "completed");
    const directory = path.join(root, ".crdd", "execution-model");
    const current = path.join(directory, "state.json");
    if (failure === "intent_release_confirmation") {
      const original = fs.rmSync;
      const mock = t.mock.method(
        fs,
        "rmSync",
        (...args: Parameters<typeof original>) => {
          if (
            path.dirname(String(args[0])) ===
              path.join(root, ".crdd", "lock") &&
            /^execution-model\.state\.lock$/u.test(
              path.basename(String(args[0])),
            ) &&
            JSON.parse(fs.readFileSync(current, "utf8")).leaseIntents.length ===
              1
          )
            throw Error("injected_intent_lock_release_unknown");
          return Reflect.apply(original, fs, args);
        },
      );
      try {
        const failed = acquireCoordinatorSnapshotLease(
          root,
          "binding-a",
          "project-a",
          "queue-a",
          "project-operation",
        );
        assert.equal(failed.status, "blocked");
        assert.equal(failed.manualRecoveryRequired, true);
        assert.equal(
          failed.recoveryId,
          JSON.parse(fs.readFileSync(current, "utf8")).leaseIntents[0]
            .recoveryId,
        );
        assert.equal(
          fs
            .readdirSync(path.join(root, ".crdd", "lock"))
            .filter((name) => name.startsWith("coordinator.lease.")).length,
          0,
        );
      } finally {
        mock.mock.restore();
      }
    } else if (failure === "root_replacement") {
      const original = fs.lstatSync;
      const oldRoot = `${root}-original`;
      let isReplaced = false;
      const mock = t.mock.method(
        fs,
        "lstatSync",
        (...args: Parameters<typeof original>) => {
          const stack = new Error().stack ?? "";
          if (
            !isReplaced &&
            String(args[0]) === root &&
            stack.includes("acquireCoordinatorSnapshotLease") &&
            !stack.includes("withSnapshotOperation") &&
            JSON.parse(fs.readFileSync(current, "utf8")).leaseIntents.length ===
              1
          ) {
            isReplaced = true;
            fs.renameSync(root, oldRoot);
            fs.mkdirSync(root);
            execFileSync("git", ["init", "--quiet", root], {
              windowsHide: true,
            });
          }
          return Reflect.apply(original, fs, args);
        },
      );
      try {
        const failed = acquireCoordinatorSnapshotLease(
          root,
          "binding-a",
          "project-a",
          "queue-a",
          "project-operation",
        );
        assert.equal(isReplaced, true);
        assert.equal(failed.status, "blocked");
        assert.equal(
          failed.recoveryId,
          JSON.parse(
            fs.readFileSync(
              path.join(oldRoot, ".crdd", "execution-model", "state.json"),
              "utf8",
            ),
          ).leaseIntents[0].recoveryId,
        );
        assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
      } finally {
        mock.mock.restore();
        if (isReplaced) {
          assert.equal(path.dirname(root), path.dirname(oldRoot));
          fs.rmSync(root, { recursive: true, force: true });
          fs.renameSync(oldRoot, root);
        }
      }
    } else if (failure === "acquired_record" || failure === "intent_record") {
      const original = fs.renameSync;
      let calls = 0;
      const mock = t.mock.method(
        fs,
        "renameSync",
        (...args: Parameters<typeof original>) => {
          if (
            String(args[1]) === current &&
            ++calls === (failure === "intent_record" ? 1 : 2)
          )
            throw new Error("injected_acquired_record_failure");
          return Reflect.apply(original, fs, args);
        },
      );
      let failed: ReturnType<typeof acquireCoordinatorSnapshotLease>;
      try {
        failed = acquireCoordinatorSnapshotLease(
          root,
          "binding-a",
          "project-a",
          "queue-a",
          "project-operation",
        );
      } finally {
        mock.mock.restore();
      }
      assert.equal(failed.status, "blocked");
      if (failed.status !== "blocked")
        throw new Error("expected_lease_failure");
      assert.equal(failed.manualRecoveryRequired, true);
      assert.ok(failed.recoveryId?.startsWith("lease-acquisition-"));
      assert.equal(
        fs.existsSync(path.join(directory, "state.pending.json")),
        true,
      );
      const saved = JSON.parse(fs.readFileSync(current, "utf8"));
      const pending = JSON.parse(
        fs.readFileSync(path.join(directory, "state.pending.json"), "utf8"),
      );
      assert.equal(failed.recoveryId, pending.leaseIntents[0].recoveryId);
      if (failure === "intent_record") {
        assert.equal(saved.leaseIntents.length, 0);
        assert.equal(
          fs
            .readdirSync(path.join(root, ".crdd", "lock"))
            .filter((name) => name.startsWith("coordinator.lease.")).length,
          0,
        );
        continue;
      }
      assert.equal(saved.leaseIntents[0].phase, "acquisition_reserved");
      assert.equal(saved.leaseEvidence.length, 0);
      assert.equal(fs.readdirSync(path.join(root, ".crdd", "lock")).length, 1);
      assert.equal(readFixtureSnapshot(root, "binding-a").status, "blocked");
    } else {
      const acquired = acquireCoordinatorSnapshotLease(
        root,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(acquired.status, "completed");
      if (acquired.status !== "completed")
        throw new Error("lease_fixture_failed");
      const original = fs.rmSync;
      const mock = t.mock.method(
        fs,
        "rmSync",
        (...args: Parameters<typeof original>) => {
          if (String(args[0]).includes("coordinator.lease."))
            throw new Error("injected_release_failure");
          return Reflect.apply(original, fs, args);
        },
      );
      let failed: ReturnType<typeof acquired.value.release>;
      try {
        failed = acquired.value.release();
      } finally {
        mock.mock.restore();
      }
      assert.equal(failed.status, "blocked");
      if (failed.status !== "blocked")
        throw new Error("expected_release_failure");
      assert.equal(failed.manualRecoveryRequired, true);
      assert.ok(failed.recoveryId?.startsWith("lease-acquisition-"));
      const saved = readFixtureSnapshot(root, "binding-a");
      assert.equal(saved.status, "completed");
      assert.equal(saved.value?.leaseIntents.at(-1)?.phase, "release_pending");
      assert.equal(saved.value?.leaseEvidence.length, 1);
      const before = fs.readFileSync(current, "utf8");
      assert.equal(
        acquireCoordinatorSnapshotLease(
          root,
          "binding-a",
          "project-a",
          "queue-a",
          "project-operation",
        ).status,
        "blocked",
      );
      assert.equal(fs.readFileSync(current, "utf8"), before);
    }
  }
});

/**
 * 統合・採用の結果記録とLease終了の一体保存を確認する。
 * @responsibility 結果の同一再送、異内容拒否とLease解放後のQueue整合を検証する。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryの現行State保存を使う。
 * @stimulus 結果作成・再送・異内容・Lease取得／解放・Queue終了を与える。
 * @observation 保存内容と再構築したPortの返却値を照合する。
 * @oracle 結果競合時はbytesを変えず、Lease解放前のQueue終了解決を拒否する。
 * @cleanup 自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 結果記録・Lease→統合保存。
 */
test("Host Windows: 統合結果記録とLease終了を同じStateへ保存する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const rootHash = fixtureRepositoryHash(root);
  const queue = {
    historySettled: false,
    workspaceId: null,
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive",
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
  };
  const payload = {
    schema: "crdd-execution-model/project-snapshot/v9",
    schemaRevision: 9,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    projects: [state],
    queueEntries: [queue],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  assert.equal(seedSnapshot(root, payload).status, "completed");
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const resultsBinding = {
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
  };
  for (const kind of ["integration", "adoption"] as const) {
    const result = {
      kind,
      identity: `result-${kind}`,
      value: { status: "confirmed" },
    };
    assert.equal(
      saveIntegrationRecord(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        resultsBinding,
        result,
      ).status,
      "completed",
    );
    const exact = fs.readFileSync(file, "utf8");
    assert.equal(
      saveIntegrationRecord(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        resultsBinding,
        result,
      ).status,
      "completed",
    );
    assert.equal(
      saveIntegrationRecord(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        resultsBinding,
        { ...result, value: { status: "different" } },
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), exact);
  }
  assert.equal(
    saveIntegrationRecord(
      resolveExecutionStorageDirectory(root),
      "binding-a",
      {
        repositoryBindingId: "binding-a",
        projectId: "project-a",
        milestoneId: "other",
        queueId: "queue-a",
      },
      { kind: "integration", identity: "result-other", value: {} },
    ).status,
    "blocked",
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model", "results")),
    false,
  );
  const ports = Object.freeze({
    workingDirectory: root,
    repository: resolveExecutionStorageDirectory(root),
    repositoryBindingId: "binding-a",
    intake: undefined,
  });
  const statePort = ports;
  const operation = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(operation.status, "completed");
  if (operation.status !== "completed")
    throw new Error("snapshot_lease_fixture_failed");
  const beforeOwnerRead = fs.readFileSync(file);
  const ownerRead = inspectCoordinatorSnapshotLeaseAcquisitionOwner(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.equal(ownerRead.status, "completed");
  assert.deepEqual(ownerRead.value, {
    acquisition: {
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      queueId: "queue-a",
      ownerGeneration: operation.value.ownerGeneration,
      ownerProcessId: process.pid,
      recoveryId: `lease-acquisition-${createHash("sha256").update("binding-a\0project-a\0queue-a\0project-operation").digest("hex").slice(0, 40)}`,
    },
  });
  assert.deepEqual(fs.readFileSync(file), beforeOwnerRead);
  assert.equal(
    acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    ).status,
    "blocked",
  );
  const beforeReconcile = fs.readFileSync(file);
  assert.equal(
    reconcileCoordinatorSnapshotLeaseOwnerLoss(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
      (owner) => ({
        ...owner,
        status: "alive",
      }),
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), beforeReconcile);
  const leased = updateCoordinatorQueue(statePort, "queue-a", 1, {
    state: "leased",
    lease: operation.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed", leased.reason);
  const running = updateCoordinatorQueue(statePort, "queue-a", 2, {
    state: "running",
    lease: operation.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(running.status, "completed", running.reason);
  assert.equal(
    updateCoordinatorQueue(statePort, "queue-a", 3, {
      state: "integration_pending",
      lease: operation.value,
      resumeCondition: null,
      resultReference: "integration-a",
    }).status,
    "completed",
  );
  assert.equal(
    settleCoordinatorSnapshotQueueLeaseRelease(
      statePort.repository,
      statePort.repositoryBindingId,
      "queue-a",
      4,
      operation.value.ownerGeneration,
    ).status,
    "blocked",
  );
  assert.equal(operation.value.release().status, "completed");
  assert.equal(operation.value.release().status, "blocked");
  assert.deepEqual(
    inspectCoordinatorSnapshotLeaseAcquisitionOwner(
      root,
      "binding-a",
      "queue-a",
    ).value,
    { acquisition: null },
  );
  assert.equal(
    settleCoordinatorSnapshotQueueLeaseRelease(
      statePort.repository,
      statePort.repositoryBindingId,
      "queue-a",
      4,
      operation.value.ownerGeneration,
    ).status,
    "completed",
  );
  const releasedSnapshot = readFixtureSnapshot(root, "binding-a");
  assert.equal(releasedSnapshot.status, "completed");
  assert.equal(releasedSnapshot.value?.leaseIntents.length, 0);
  assert.equal(releasedSnapshot.value?.leaseEvidence.length, 2);
  const settledBytes = fs.readFileSync(file);
  const recoveredQueue = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    () => {
      throw new Error("no_operation_owner_to_observe");
    },
  );
  assert.equal(recoveredQueue.status, "completed");
  assert.deepEqual(
    recoveredQueue.value?.queue,
    readQueueEntry(ports.repository, ports.repositoryBindingId, "queue-a")
      .value,
  );
  assert.deepEqual(fs.readFileSync(file), settledBytes);
  const invalidQueue = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "other-project",
    "queue-a",
    "project-operation",
    () => {
      throw new Error("invalid_binding_must_not_observe");
    },
  );
  assert.equal(invalidQueue.status, "blocked");
  if (invalidQueue.status !== "blocked")
    throw new Error("recovery_fixture_failed");
  assert.equal(invalidQueue.manualRecoveryRequired, true);
  assert.match(invalidQueue.recoveryId ?? "", /^lease-acquisition-/);
  assert.deepEqual(fs.readFileSync(file), settledBytes);
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd", "lock")), []);
  assert.deepEqual(
    fs.readdirSync(path.join(root, ".crdd", "execution-model")).sort(),
    ["state.json"],
  );
});

/**
 * 通常終端を実保存し、退役した受領fieldの混入を拒否する。
 * @responsibility 現行Task契約の余剰field拒否と元本文保全を実Filesystemで反証する。
 * @trace PRL-IT-005
 * @precondition 自己所有Git Repositoryと現行Snapshotを使う。
 * @stimulus 通常終了候補と、旧受領fieldを追加した候補を与える。
 * @observation state.json bytes、世代、保存結果を確認する。
 * @oracle 旧受領fieldを持つ候補では元bytesを変更せず、通常終端だけは保存する。
 * @cleanup 自己所有fixtureを終了hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: Taskモデル→実Snapshot Writer。Dockerは対象外。
 */
test("Host Windows: 通常Task終端を保存し旧受領fieldを拒否する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, ports } = currentQueueFixture(t);
  const existing = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.ok(
    existing.status === "completed" && existing.value.milestoneId !== null,
    existing.reason,
  );
  const { queueId, projectId, milestoneId, requestHash } = existing.value;
  const intake = {
    operation: "start" as const,
    queueId,
    projectId,
    milestoneId,
    requestHash,
  };
  const observed = readProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    projectId,
    queueId,
  );
  assert.ok(observed.value);
  let state = observed.value;
  for (const command of [
    {
      kind: "task_start" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    },
    {
      kind: "task_handoff" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
    },
    {
      kind: "task_started" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
    },
  ]) {
    const next = saveProjectExecutionState(
      ports.repository,
      ports.repositoryBindingId,
      command,
      state.generation,
      intake,
    );
    assert.equal(next.status, "completed", next.reason);
    if (next.status !== "completed")
      throw Error("fixture_task_transition_failed");
    state = next.value;
  }
  const settle = {
    kind: "task_settle" as const,
    projectId: state.projectId,
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    authorityBindingId: "authority-a",
    outcome: "completed" as const,
    cleanupConfirmed: true,
    recoveryObligations: [],
    recoveryUnresolved: false,
    resultUnresolved: false,
  };
  const acceptance = {
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    recoveryId: "recovery-a",
    settlementGeneration: state.generation + 1,
    repositoryBinding: "a".repeat(64),
    resultId: "b".repeat(64),
    consumer: "coordinator" as const,
  };
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const bytes = fs.readFileSync(file);
  for (const resultAcceptances of [
    [acceptance],
    [acceptance, { ...acceptance, recoveryId: "recovery-b" }],
    [{ ...acceptance, settlementGeneration: state.generation + 2 }],
    [{ ...acceptance, extra: true }],
  ]) {
    const rejected = Reflect.apply(saveProjectExecutionState, undefined, [
      resolveExecutionStorageDirectory(root),
      "binding-a",
      { ...settle, resultAcceptances },
      state.generation,
      intake,
    ]);
    assert.equal(rejected.status, "blocked");
    assert.equal(
      rejected.reason,
      "coordinator_snapshot_input_invalid",
      "退役した受領fieldを現行Task契約へ混入させない",
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
  }
  const saved = saveProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    settle,
    state.generation,
    intake,
  );
  assert.ok(saved.status === "completed", saved.reason);
  const readBack = readProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    projectId,
    queueId,
  );
  assert.equal(
    readBack.value?.tasks.find(
      ({ definition }) => definition.id === settle.taskId,
    )?.state,
    "completed",
  );
});

/**
 * 統合保存上のState／Queue全操作を新版Factoryの実Leaseと照合する。
 * @responsibility 自己再取得を避け、優先順位・世代・回復Identityを維持する。
 * @trace PRL-IT-005
 * @precondition 自己所有RepositoryのSnapshotを全区画で初期化する。
 * @stimulus 全8操作、同依頼再送、異内容、旧受付、使用中、終了と回復を実行する。
 * @observation Queue値、世代、保存bytesとLease解放結果を確認する。
 * @oracle 使用中を割込まず、結果・回復参照はexactに照合し、再取得なしで確定する。
 * @cleanup 未解放Leaseをfinallyで解放しfixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Persistence Factory→統合保存と新版Lease。
 */
test("Host Windows: 統合State PortはQueue全操作と優先順位を保存する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const ports = Object.freeze({
    workingDirectory: root,
    repository: resolveExecutionStorageDirectory(root),
    repositoryBindingId: "binding-a",
    intake: {
      operation: "start" as const,
      queueId: input.queueId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      requestHash: input.requestHash,
    },
  });
  const port = ports;
  assert.equal(
    initializeExecutionStore(port.repository, port.repositoryBindingId).status,
    "completed",
  );
  const seeded = createQueue(port.repository, port.repositoryBindingId, {
    kind: "scheduled",
    input: [input, initialExecutionInput(state)],
  });
  assert.equal(seeded.status, "completed", seeded.reason);
  assert.deepEqual(
    readProjectExecutionState(
      port.repository,
      port.repositoryBindingId,
      "project-a",
    ).value,
    { ...state, queueId: input.queueId },
  );
  assert.equal(
    readProjectExecutionState(
      port.repository,
      port.repositoryBindingId,
      "project-missing",
    ).value,
    null,
  );
  assert.equal(
    saveProjectExecutionState(
      port.repository,
      port.repositoryBindingId,
      {
        kind: "task_start",
        projectId: state.projectId,
        taskId: "task-a",
        attemptId: "attempt-a",
        authorityBindingId: "authority-a",
      },
      state.generation,
      port.intake,
    ).status,
    "completed",
  );
  assert.equal(
    createQueue(port.repository, port.repositoryBindingId, {
      kind: "scheduled",
      input: [input],
    }).status,
    "completed",
  );
  const current = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(current, "utf8");
  assert.equal(
    createQueue(port.repository, port.repositoryBindingId, {
      kind: "scheduled",
      input: [input],
    }).status,
    "completed",
  );
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(
    createQueue(port.repository, port.repositoryBindingId, {
      kind: "scheduled",
      input: [{ ...input, requestHash: "d".repeat(64) }],
    }).status,
    "blocked",
  );
  const retired = Object.freeze({
    workingDirectory: root,
    repository: resolveExecutionStorageDirectory(root),
    repositoryBindingId: "binding-a",
    intake: undefined,
  });
  assert.equal(
    createQueue(retired.repository, retired.repositoryBindingId, {
      kind: "scheduled",
      input: [{ ...input, requestHash: "d".repeat(64) }],
    }).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(
    createQueue(port.repository, port.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          ...input,
          queueId: "queue-i",
          originLane: "interactive",
        },
      ],
    }).status,
    "completed",
  );
  assert.equal(
    selectNextQueueEntry(port.repository, port.repositoryBindingId, "queue-a")
      .value?.queueId,
    "queue-i",
  );
  assert.equal(
    readQueueEntry(port.repository, port.repositoryBindingId, "queue-a").value
      ?.state,
    "waiting_foreground",
  );
  const acquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-i",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("fixture_lease_failed");
  let released = false;
  try {
    assert.equal(
      updateCoordinatorQueue(port, "queue-i", 1, {
        state: "leased",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "blocked",
    );
    assert.equal(
      updateCoordinatorQueue(port, "queue-i", 1, {
        state: "leased",
        lease: acquired.value,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "completed",
    );
    assert.equal(
      selectNextQueueEntry(port.repository, port.repositoryBindingId, "queue-a")
        .value,
      null,
    );
    assert.equal(
      updateCoordinatorQueue(port, "queue-i", 2, {
        state: "running",
        lease: acquired.value,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "completed",
    );
    assert.equal(
      updateCoordinatorQueue(port, "queue-i", 3, {
        state: "recovery_required",
        lease: acquired.value,
        resumeCondition: "exact_recovery",
        resultReference: "recovery-a",
      }).status,
      "completed",
    );
    assert.equal(
      settleCoordinatorSnapshotQueueLeaseRelease(
        port.repository,
        port.repositoryBindingId,
        "queue-i",
        4,
        acquired.value.ownerGeneration,
      ).status,
      "blocked",
    );
    assert.equal(acquired.value.release().status, "completed");
    released = true;
    const settled = settleCoordinatorSnapshotQueueLeaseRelease(
      port.repository,
      port.repositoryBindingId,
      "queue-i",
      4,
      acquired.value.ownerGeneration,
    );
    assert.equal(settled.status, "completed");
    assert.equal(settled.value?.ownerGeneration, null);
    assert.equal(
      updateQueue(port.repository, port.repositoryBindingId, {
        kind: "recovery",
        input: ["queue-i", 5, "different-recovery"],
      }).status,
      "blocked",
    );
    const resumed = updateQueue(port.repository, port.repositoryBindingId, {
      kind: "recovery",
      input: ["queue-i", 5, "recovery-a"],
    });
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.value?.resumeCondition, "exact_recovery_settled");
    assert.equal(
      updateCoordinatorQueue(port, "queue-i", 6, {
        state: "cancelled",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "completed",
    );
    const scheduled = selectNextQueueEntry(
      port.repository,
      port.repositoryBindingId,
      "queue-a",
    );
    assert.equal(scheduled.value?.queueId, "queue-a");
    assert.equal(scheduled.value?.state, "queued");
    assert.equal(scheduled.value?.generation, 3);
    assert.equal(
      updateCoordinatorQueue(port, "queue-a", 1, {
        state: "cancelled",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "blocked",
    );
    assert.equal(
      readQueueEntry(port.repository, port.repositoryBindingId, "queue-missing")
        .status,
      "blocked",
    );
  } finally {
    if (!released) assert.equal(acquired.value.release().status, "completed");
  }
});

/**
 * Queueと途中Leaseと結果を含む一体保存を確認する。
 * @responsibility 保存整理で未解決値や元の受付結合を落とさない。
 * @trace PRL-IT-005
 * @precondition 本番生成したQueueとLease証拠を自己所有fixtureで使う。
 * @stimulus 非空Snapshotを保存し、受付変更、結果欠落、Identity変更、State更新と保存失敗を試す。
 * @observation 値の一致と拒否後の現在File不変を確認する。
 * @oracle 現行の取得意図と証拠を保持し、不正な更新は上書きしない。
 * @cleanup Leaseをfinallyで解放しfixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 全区画の結合→Snapshot保存。
 */
test("Host Windows: 統合Snapshotは受付結合と未解決記録を保持する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const initial = initializeExecutionStore(
    resolveExecutionStorageDirectory(root),
    "binding-a",
  );
  assert.equal(initial.status, "completed");
  const ports = createTestPersistence(root, "binding-a");
  const queue = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [
      {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: "b".repeat(64),
        originLane: "scheduled",
        repositoryRevision: "a".repeat(40),
        scopeHash: "c".repeat(64),
      },
      initialExecutionInput(state),
    ],
  });
  assert.equal(queue.status, "completed");
  if (queue.status !== "completed") throw new Error("queue_fixture_failed");
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  try {
    const observed = readFixtureSnapshot(root, "binding-a");
    assert.equal(observed.status, "completed");
    assert.ok(observed.value);
    if (observed.value.schema !== "crdd-execution-model/project-snapshot/v9")
      throw new Error("fixture_schema_invalid");
    const rootHash = observed.value.repositoryRootHash;
    const resultValue = {
      status: "completed",
      candidateReference: "candidate-a",
    };
    const payload = {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      results: [
        {
          contract: "crdd-coordinator/integration/v1",
          kind: "integration",
          repositoryBindingId: "binding-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          identity: "result-a",
          contentHash: createHash("sha256")
            .update(canonicalJson(resultValue))
            .digest("hex"),
          value: resultValue,
        },
      ],
      historyPending: [],
    };
    assert.equal(
      saveIntegrationRecord(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        {
          repositoryBindingId: "binding-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
        },
        { kind: "integration", identity: "result-a", value: resultValue },
      ).status,
      "completed",
    );
    const current = path.join(root, ".crdd", "execution-model", "state.json");
    const before = fs.readFileSync(current, "utf8");
    assert.deepEqual(readFixtureSnapshot(root, "binding-a").value, payload);
    const next = { ...payload, snapshotRevision: payload.snapshotRevision + 1 };
    const pendingPayload = { ...next, repositoryRootHash: rootHash };
    const pending = `${JSON.stringify({ payload: pendingPayload, contentHash: createHash("sha256").update(JSON.stringify(pendingPayload)).digest("hex"), baseRevision: payload.snapshotRevision, baseHash: "0".repeat(64) })}\n`;
    const pendingPath = path.join(
      root,
      ".crdd",
      "execution-model",
      "state.pending.json",
    );
    fs.writeFileSync(pendingPath, pending);
    const command = {
      kind: "task_start" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    };
    const prepared = taskStartFixture(
      state,
      state.generation,
      "task-a",
      "attempt-a",
      "authority-a",
    );
    assert.ok(prepared.state);
    const updatedState = { ...prepared.state, queueId: "queue-a" };
    const intake = {
      operation: "resume" as const,
      queueId: "queue-a",
      projectId: state.projectId,
      milestoneId: state.milestoneId,
      requestHash: "b".repeat(64),
    };
    assert.equal(
      saveProjectExecutionState(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        command,
        state.generation,
        intake,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), before);
    assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);
    fs.unlinkSync(pendingPath);
    const changed = saveProjectExecutionState(
      resolveExecutionStorageDirectory(root),
      "binding-a",
      command,
      state.generation,
      intake,
    );
    assert.equal(changed.status, "completed");
    assert.deepEqual(changed.value, updatedState);
    const expected = {
      ...payload,
      snapshotRevision: payload.snapshotRevision + 1,
      projects: [updatedState],
    };
    assert.deepEqual(readFixtureSnapshot(root, "binding-a").value, expected);
    const savedBytes = fs.readFileSync(current, "utf8");
    assert.equal(
      saveProjectExecutionState(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        command,
        state.generation,
        intake,
      ).status,
      "completed",
    );
    assert.equal(fs.readFileSync(current, "utf8"), savedBytes);
    const additional = { ...state, projectId: "project-b", generation: 1 };
    const additionalQueue = createQueue(
      ports.repository,
      ports.repositoryBindingId,
      {
        kind: "scheduled",
        input: [
          {
            queueId: "queue-b",
            projectId: "project-b",
            milestoneId: additional.milestoneId,
            requestHash: "d".repeat(64),
            originLane: "scheduled",
            repositoryRevision: additional.repositoryRevision,
            scopeHash: "e".repeat(64),
          },
          initialExecutionInput(additional),
        ],
      },
    );
    assert.equal(additionalQueue.status, "completed");
    assert.ok(additionalQueue.value);
    assert.deepEqual(readFixtureSnapshot(root, "binding-a").value, {
      ...expected,
      snapshotRevision: payload.snapshotRevision + 2,
      projects: [updatedState, { ...additional, queueId: "queue-b" }],
      queueEntries: [...expected.queueEntries, additionalQueue.value],
    });
    const previousBytes = fs.readFileSync(current, "utf8");
    const rename = t.mock.method(fs, "renameSync", () => {
      throw new Error("state_update_rename_injected");
    });
    try {
      const interrupted = saveProjectExecutionState(
        resolveExecutionStorageDirectory(root),
        "binding-a",
        {
          kind: "task_handoff",
          projectId: state.projectId,
          taskId: "task-a",
          attemptId: "attempt-a",
          operationId: "operation-a",
        },
        updatedState.generation,
        intake,
      );
      assert.equal(interrupted.status, "blocked");
      assert.equal(interrupted.manualRecoveryRequired, true);
    } finally {
      rename.mock.restore();
    }
    assert.equal(fs.readFileSync(current, "utf8"), previousBytes);
    assert.ok(fs.existsSync(pendingPath));
    const reacquired = readExecutionState(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    );
    assert.equal(reacquired.status, "blocked");
    // この理由はKernel取得後のpending拒否だけ。競合・解放不明とは区別する。
    assert.equal(reacquired.reason, "coordinator_state_reentry_required");
  } finally {
    const pending = path.join(
      root,
      ".crdd",
      "execution-model",
      "state.pending.json",
    );
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
    const marker = path.join(root, ".crdd", "execution-model", "state.lock");
    if (fs.existsSync(marker)) fs.unlinkSync(marker);
    assert.equal(lease.value.release().status, "completed");
  }
});

/**
 * stateDirectoryのTest準備責務を実行する。
 *
 * @responsibility stateDirectoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateDirectoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function stateDirectory(root: string) {
  return path.join(root, ".crdd", "execution-model", "state", "project-a");
}

/**
 * queueDirectoryのTest準備責務を実行する。
 *
 * @responsibility queueDirectoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus queueDirectoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function queueDirectory(root: string) {
  return path.join(root, ".crdd", "execution-model", "queues", "queue-a");
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(t: test.TestContext) {
  const temporary = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      fileURLToPath(new URL("../../../../", import.meta.url)),
      "tmp",
    ),
    "fixture_repository_root_invalid",
  ).directory;
  const root = fs.mkdtempSync(path.join(temporary, "crdd-project-durable-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => {
    assert.equal(path.dirname(root), temporary);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=NUL",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const created = projectExecutionFixture({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency: 2,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/a.ts"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture_failed");
  return { root, state: created.state };
}

/**
 * 現行保存と一件のQueueを子Process試験用に初期化する。
 * @responsibility 旧個別Writerを使わずOwner損失試験の正常前状態を作る。
 * @trace PRL-IT-012
 * @precondition fixtureが自己所有Repositoryと正常Project状態を返す。
 * @stimulus 明示初期化後、初回QueueとProjectを同じ受付で保存する。
 * @observation 各保存結果と現行Portを取得する。
 * @oracle すべてcompletedで、呼出し元が現行Leaseを取得できる。
 * @cleanup 呼出し元のfixture hookが自己所有Rootを回収する。
 * @boundary 子Process試験の入力準備から現在Snapshot保存。
 */
function currentQueueFixture(t: test.TestContext, binding = "binding-a") {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(resolveExecutionStorageDirectory(root), binding)
      .status,
    "completed",
  );
  const ports = createTestPersistence(root, binding);
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  assert.deepEqual(
    readProjectExecutionState(
      ports.repository,
      ports.repositoryBindingId,
      state.projectId,
      "queue-a",
    ).value,
    { ...state, queueId: "queue-a" },
  );
  const intake = {
    operation: "start" as const,
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
  };
  return { root, ports, intake };
}

/** @trace PRL-IT-005 競合が取得段階を一周させず、取消後も既発行の取得を確定する。 */
test("Lease取得は短期Lock競合で予約・物理取得をやり直さない", async (t) => {
  for (const mode of [
    "reservation",
    "cancel_after_reservation",
    "evidence",
    "cancel_after_lock",
    "evidence_timeout",
    "graph_evidence_timeout",
    "revoked_after_evidence",
    "cancel_graph_after_lock",
  ] as const) {
    const { root, ports } = currentQueueFixture(t);
    const binding = ports.repositoryBindingId;
    const controller = new AbortController();
    const directory = path.join(root, ".crdd", "lock");
    const file = path.join(root, ".crdd", "execution-model", "state.json");
    const stored = () =>
      parseStoredExecutionFixture(fs.readFileSync(file, "utf8"));
    const before = stored().revision;
    const holdStorage = () => {
      const other = acquireLock({
        directory,
        name: "execution-model.state.lock",
        identity: "temporary-priority-fixture",
      });
      if (other.status !== "acquired") throw Error(other.reason);
      return delay(mode.endsWith("timeout") ? 900 : 40).then(() =>
        assert.equal(other.lock.release(), true),
      );
    };
    let otherRelease: Promise<void> | undefined;
    let physicalStarts = 0;
    let revalidated = 0;
    let reservedGeneration: string | undefined;
    if (mode === "reservation") otherRelease = holdStorage();
    const open = fs.openSync;
    const instrument = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof open>) => {
        const descriptor = open(...args);
        if (
          args[1] === "wx+" &&
          path.basename(String(args[0])).startsWith("coordinator.lease.")
        ) {
          physicalStarts++;
          const current = stored();
          assert.equal(current.revision, before + 1);
          assert.equal(current.leaseIntents.length, 1);
          reservedGeneration = current.leaseIntents[0]?.ownerGeneration;
          if (mode !== "reservation") otherRelease = holdStorage();
          if (
            mode === "cancel_after_lock" ||
            mode === "cancel_graph_after_lock"
          )
            controller.abort();
        }
        return descriptor;
      },
    );
    const rename = fs.renameSync;
    const cancelReservation =
      mode === "cancel_after_reservation"
        ? t.mock.method(
            fs,
            "renameSync",
            (...args: Parameters<typeof rename>) => {
              rename(...args);
              if (String(args[1]) === file && stored().revision === before + 1)
                controller.abort();
            },
          )
        : null;
    try {
      if (
        mode === "revoked_after_evidence" ||
        mode === "graph_evidence_timeout" ||
        mode === "cancel_graph_after_lock"
      ) {
        const state = readProjectExecutionState(
          ports.repository,
          binding,
          "project-a",
          "queue-a",
        ).value;
        assert.ok(state);
        const result = await runCoordinatorOperation({
          kind: "scheduled",
          persistence: ports,
          leaseWait: {
            revalidate: async () => {
              revalidated++;
              return false;
            },
          },
          input: {
            projectId: "project-a",
            milestoneId: "milestone-a",
            queueId: "queue-a",
            taskExecutions: state.tasks.map((task) => ({
              taskId: task.definition.id,
              authorityBindingId: "fixture-binding",
              taskRequest: null,
              repositoryRoot: root,
            })),
            cancellationSignal: controller.signal,
          },
        });
        const after = stored();
        assert.equal(physicalStarts, 1);
        assert.equal(result.status, "blocked");
        assert.equal(after.queueEntries[0]?.state, "queued");
        assert.equal(after.queueEntries[0]?.generation, 1);
        assert.equal(after.operations.length, 0);
        if (mode !== "graph_evidence_timeout") {
          assert.equal(revalidated, mode === "revoked_after_evidence" ? 1 : 0);
          assert.equal(
            result.reason,
            mode === "revoked_after_evidence"
              ? "coordinator_authenticated_principal_not_verified"
              : "coordinator_lease_acquisition_cancelled",
          );
          assert.equal(result.cleanupConfirmed, true);
          assert.equal(result.effectState, "no_effect");
          assert.equal(after.leaseIntents.length, 0);
        } else {
          assert.equal(revalidated, 0);
          assert.equal(
            result.reason,
            "coordinator_lease_acquisition_recovery_required",
          );
          assert.equal(result.cleanupConfirmed, false);
          assert.equal(result.effectState, "unknown");
          assert.deepEqual(result.recoveryIds, [
            after.leaseIntents[0]?.recoveryId,
          ]);
        }
        continue;
      }
      const acquired = await acquireCoordinatorSnapshotLease(
        root,
        binding,
        "project-a",
        "queue-a",
        "project-operation",
        undefined,
        {
          signal: controller.signal,
          revalidate: async () => {
            revalidated++;
            return true;
          },
        },
      );
      if (mode === "evidence_timeout" || mode === "cancel_after_reservation") {
        assert.equal(acquired.status, "blocked");
        if (acquired.status !== "blocked")
          throw Error("unexpected_acquisition");
        assert.equal(
          acquired.reason,
          "coordinator_lease_acquisition_recovery_required",
        );
        assert.equal(acquired.manualRecoveryRequired, true);
        const after = stored();
        const expectedPhysicalStarts = mode === "evidence_timeout" ? 1 : 0;
        assert.equal(physicalStarts, expectedPhysicalStarts);
        assert.equal(after.revision, before + 1);
        assert.deepEqual(
          after.leaseIntents.map((intent) => intent.phase),
          ["acquisition_reserved"],
        );
        assert.equal(acquired.recoveryId, after.leaseIntents[0]?.recoveryId);
        assert.equal(
          fs
            .readdirSync(directory)
            .filter((name) => name.startsWith("coordinator.lease.")).length,
          expectedPhysicalStarts,
        );
        continue;
      }
      assert.equal(
        acquired.status,
        "completed",
        `${mode}: ${acquired.reason}; opens=${physicalStarts}; revision=${stored().revision}; before=${before}`,
      );
      assert.equal(physicalStarts, 1);
      assert.equal(revalidated > 0, mode === "reservation");
      const after = stored();
      assert.equal(after.revision, before + 2);
      assert.deepEqual(
        after.leaseIntents.map(
          (intent: { ownerGeneration: string }) => intent.ownerGeneration,
        ),
        [reservedGeneration, reservedGeneration],
      );
      if (acquired.status === "completed") {
        assert.equal(acquired.value.isHeld(), true);
        assert.equal(
          acquired.value.evidenceWaited === true,
          mode !== "reservation",
        );
        assert.equal(acquired.value.release().status, "completed");
      }
    } finally {
      cancelReservation?.mock.restore();
      instrument.mock.restore();
      await otherRelease;
    }
  }
});

/** @trace PRL-IT-005 解放Intent・物理解放・終了証拠・Queue確定を一周だけ実行する。 */
test("Lease解放は競合した保存段階だけを待ち、物理Lockを二度解放しない", async (t) => {
  for (const mode of [
    "intent",
    "evidence",
    "queue",
    "intent_timeout",
    "evidence_timeout",
    "queue_timeout",
  ] as const) {
    const { root, ports } = currentQueueFixture(t);
    const binding = ports.repositoryBindingId;
    const directory = path.join(root, ".crdd", "lock");
    const file = path.join(root, ".crdd", "execution-model", "state.json");
    const stored = () =>
      parseStoredExecutionFixture(fs.readFileSync(file, "utf8"));
    const acquired = await acquireCoordinatorSnapshotLease(
      root,
      binding,
      "project-a",
      "queue-a",
      "project-operation",
      undefined,
      { signal: new AbortController().signal },
    );
    assert.equal(acquired.status, "completed", acquired.reason);
    const lease = acquired.value;
    const leased = updateCoordinatorQueue(ports, "queue-a", 1, {
      state: "leased",
      lease,
      resumeCondition: null,
      resultReference: null,
    });
    assert.equal(leased.status, "completed", leased.reason);
    const cancelled = updateCoordinatorQueue(
      ports,
      "queue-a",
      leased.value.generation,
      {
        state: "cancelled",
        lease,
        resumeCondition: null,
        resultReference: null,
      },
    );
    assert.equal(cancelled.status, "completed", cancelled.reason);
    const before = stored();
    const originalRecoveryId = before.leaseIntents[0]?.recoveryId;
    assert.ok(originalRecoveryId);
    let otherRelease: Promise<void> | undefined;
    let removals = 0;
    const hold = () => {
      const lock = acquireLock({
        directory,
        name: "execution-model.state.lock",
        identity: "temporary-release-fixture",
      });
      if (lock.status !== "acquired") throw Error(lock.reason);
      return delay(mode.endsWith("_timeout") ? 900 : 40).then(() =>
        assert.equal(lock.lock.release(), true),
      );
    };
    if (mode.startsWith("intent")) otherRelease = hold();
    const rm = fs.rmSync;
    const hook = t.mock.method(
      fs,
      "rmSync",
      (...args: Parameters<typeof rm>) => {
        const name = path.basename(String(args[0]));
        rm(...args);
        if (name.startsWith("coordinator.lease.")) {
          removals++;
          if (!otherRelease && mode.startsWith("evidence"))
            otherRelease = hold();
        } else if (
          name === "execution-model.state.lock" &&
          removals === 1 &&
          !otherRelease &&
          mode.startsWith("queue")
        ) {
          otherRelease = hold();
        }
      },
    );
    try {
      const pending = finishOperationLease(lease, {
        kind: "scheduled",
        repository: ports.repository,
        binding,
        queueId: "queue-a",
        queue: cancelled.value,
      });
      assert.equal(lease.isHeld(), false);
      assert.equal(borrowCoordinatorActiveLease(lease), undefined);
      assert.equal(
        lease.release().reason,
        "coordinator_lease_already_released",
      );
      const result = await pending;
      assert.ok(otherRelease, mode);
      await otherRelease;
      assert.equal(removals, mode === "intent_timeout" ? 0 : 1, mode);
      const after = stored();
      if (mode.endsWith("_timeout")) {
        assert.equal(result.status, "blocked");
        assert.ok("recoveryId" in result);
        assert.equal(result.recoveryId, originalRecoveryId);
        assert.equal(
          after.queueEntries[0]?.ownerGeneration,
          lease.ownerGeneration,
        );
        assert.equal(
          after.leaseIntents.length,
          mode === "intent_timeout" ? 2 : mode === "evidence_timeout" ? 3 : 0,
        );
        if (mode === "intent_timeout")
          assert.equal(
            fs
              .readdirSync(directory)
              .filter((name) => name.startsWith("coordinator.lease.")).length,
            1,
          );
      } else {
        assert.equal(result.status, "completed", `${mode}: ${result.reason}`);
        assert.equal(after.leaseIntents.length, 0);
        assert.equal(after.queueEntries[0]?.ownerGeneration, null);
        assert.equal(after.revision, before.revision + 3);
      }
    } finally {
      hook.mock.restore();
      await otherRelease;
    }
  }
});

/** @trace PRL-IT-005 所有済みGraphの取消終端を、短期Lock待ち後に元世代だけへ保存する。 */
test("Graph取消のQueue終端は短期Lock競合を待ちTaskを始めない", async (t) => {
  for (const mode of [
    "released_before_deadline",
    "terminal_and_recovery_timeout",
  ] as const) {
    const { root, ports } = currentQueueFixture(t);
    const binding = ports.repositoryBindingId;
    const state = readProjectExecutionState(
      ports.repository,
      binding,
      "project-a",
      "queue-a",
    ).value;
    assert.ok(state);
    const file = path.join(root, ".crdd", "execution-model", "state.json");
    const stored = () =>
      parseStoredExecutionFixture(fs.readFileSync(file, "utf8"));
    const directory = path.join(root, ".crdd", "lock");
    const controller = new AbortController();
    let otherRelease: Promise<void> | undefined;
    let expectedRecoveryId: string | undefined;
    let oldOwner: string | null | undefined;
    const rm = fs.rmSync;
    const hook = t.mock.method(
      fs,
      "rmSync",
      (...args: Parameters<typeof rm>) => {
        rm(...args);
        if (
          !otherRelease &&
          path.basename(String(args[0])) === "execution-model.state.lock" &&
          stored().queueEntries[0]?.state === "leased"
        ) {
          const lock = acquireLock({
            directory,
            name: "execution-model.state.lock",
            identity: "temporary-terminal-fixture",
          });
          if (lock.status !== "acquired") throw Error(lock.reason);
          const current = stored();
          expectedRecoveryId = current.leaseIntents[0]?.recoveryId;
          oldOwner = current.queueEntries[0]?.ownerGeneration;
          otherRelease = delay(
            mode === "terminal_and_recovery_timeout" ? 1700 : 40,
          ).then(() => assert.equal(lock.lock.release(), true));
          controller.abort();
        }
      },
    );
    try {
      const result = await runCoordinatorOperation({
        kind: "scheduled",
        persistence: ports,
        leaseWait: {},
        input: {
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          taskExecutions: state.tasks.map((task) => ({
            taskId: task.definition.id,
            authorityBindingId: "fixture-binding",
            taskRequest: null,
            repositoryRoot: root,
          })),
          cancellationSignal: controller.signal,
        },
      });
      assert.ok(otherRelease);
      const after = stored();
      if (mode === "terminal_and_recovery_timeout") {
        assert.ok(expectedRecoveryId && oldOwner);
        assert.equal(result.status, "blocked", result.reason);
        assert.equal(result.effectState, "unknown");
        assert.equal(result.cleanupConfirmed, false);
        assert.deepEqual(result.recoveryIds, [expectedRecoveryId]);
        assert.equal(after.queueEntries[0]?.state, "leased");
        assert.equal(after.queueEntries[0]?.ownerGeneration, oldOwner);
        assert.ok(
          after.leaseEvidence.some(
            ({ content }) =>
              content.queueId === "queue-a" &&
              content.ownerGeneration === oldOwner &&
              content.disposition === "released",
          ),
        );
      } else {
        assert.equal(result.status, "cancelled", result.reason);
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(result.effectState, "no_effect");
        assert.equal(after.queueEntries[0]?.state, "cancelled");
        assert.equal(after.queueEntries[0]?.ownerGeneration, null);
      }
      assert.equal(after.operations.length, 0);
      assert.equal(after.leaseIntents.length, 0);
    } finally {
      hook.mock.restore();
      await otherRelease;
    }
  }
});

/**
 * 一般定義の保存が既存管理実行と受付を保持する。
 * @responsibility 管理用Portと一般CRUDが同じ物理Writerと版を使うことを確認する。
 * @trace PRL-IT-012
 * @precondition 自己生成Repositoryに管理実行と待機中受付が一件ずつある。
 * @stimulus 別Projectの計画をDomain公開APIから保存する。
 * @observation 全区画の保存前後値と現在版。
 * @oracle projects・revision・previous以外は完全一致し、既存管理実行を変えない。
 * @cleanup fixtureが今回Rootだけを確認後清掃する。
 * @boundary 外部AI・Docker・過去保持物なしの実保存。
 */
test("一般CRUDは既存の管理実行・待機受付・技術区画を保全する", (t) => {
  const { root } = currentQueueFixture(t);
  execFileSync(
    "git",
    [
      "-C",
      root,
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
      "synthetic baseline",
    ],
    { windowsHide: true },
  );
  fs.appendFileSync(path.join(root, ".git", "info", "exclude"), "\n.crdd/\n");
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const access = {
    root: { directory: root },
    principalId: "test-principal",
    initialSourceRevision: "1".repeat(40),
    revalidate: () => true,
  };
  const target = { projectId: "project-b", milestoneId: "milestone-b" };
  const observed = queryPlan(access, target);
  assert.ok(
    observed.status === "available" || observed.status === "absent",
    JSON.stringify(observed),
  );
  if (observed.status !== "available" && observed.status !== "absent") return;
  assert.ok(observed.version);
  if (!observed.version) throw new Error("fixture_state_version_missing");
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const before = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(before.managedExecutions.length, 1);
  assert.equal(before.queueEntries.length, 1);
  const history = path.join(root, ".crdd", "execution-model", "history.jsonl");
  const occurredAt = "2026-10-28T00:00:00.000Z";
  const historyBytes = Buffer.from(
    `${canonicalJson({ schema: "crdd-execution-model/history-row/v3", occurredAt, summary: { schema: "crdd-coordinator/task-summary/v1", record: { id: "synthetic-history", occurredAt, outcome: "completed", primaryFailure: null, cleanup: "confirmed" } } })}\n`,
  );
  fs.writeFileSync(history, historyBytes);
  const saved = savePlan(access, {
    ...target,
    expected: observed.version,
    expectedDefinitionHash: null,
    definition: {
      milestoneAcceptanceCriteria: ["確認"],
      objectives: [{ id: "objective-b", acceptanceCriteria: ["確認"] }],
      tasks: [
        {
          id: "task-b",
          objectiveId: "objective-b",
          dependencies: [],
          allowedPaths: ["src/b.ts"],
          conflictKeys: [],
        },
      ],
    },
  });
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  assert.deepEqual(fs.readFileSync(history), historyBytes);
  const after = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of Object.keys(before)) {
    if (!["projects", "revision", "previous"].includes(key))
      assert.deepEqual(after[key], before[key], key);
  }
  assert.deepEqual(
    after.projects.find(
      (project: { projectId: string }) => project.projectId === "project-a",
    ),
    before.projects[0],
  );
});

/**
 * PR-D-N-01 durably creates and reads generation-bound Project Stateを検証する。
 *
 * @responsibility PR-D-N-01 durably creates and reads generation-bound Project Stateの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-N-01 durably creates and reads generation-bound Project Stateの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-N-01 durably creates and reads generation-bound Project State", (t) => {
  const { root, ports, intake } = currentQueueFixture(t);
  const initial = readProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    "project-a",
  );
  assert.equal(initial.status, "completed");
  assert.ok(initial.value);
  const generation = initial.value.generation;
  const command = {
    kind: "task_start" as const,
    projectId: "project-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    authorityBindingId: "authority-a",
  };
  const write = saveProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    command,
    generation,
    intake,
  );
  assert.equal(write.status, "completed");
  assert.ok(write.value);
  assert.equal(write.value.generation, generation + 1);
  assert.equal(write.value.tasks[0]?.state, "starting");
  assert.equal(write.value.tasks[0]?.startPhase, "reserved");
  const selections = write.value.taskExecutionSelections;
  assert.equal(Object.isFrozen(selections), true);
  assert.equal(Object.isFrozen(selections.executor), true);
  assert.equal(Object.isFrozen(selections.reviewer), true);
  assert.equal(write.value.taskExecutionSelections, selections);
  const read = readProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    "project-a",
  );
  assert.equal(read.status, "completed");
  assert.deepEqual(read.value, write.value);

  const target = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(target);
  const replay = saveProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    command,
    generation,
    intake,
  );
  assert.equal(replay.status, "completed");
  assert.equal(Object.isFrozen(replay.value?.taskExecutionSelections), true);
  assert.deepEqual(fs.readFileSync(target), before);
  const stale = saveProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    { ...command, authorityBindingId: "different-authority" },
    generation,
    intake,
  );
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "coordinator_generation_or_identity_mismatch");
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal(fs.existsSync(stateDirectory(root)), false);
});

/**
 * Repository RootとBindingを構成時に閉じた平坦なState接続を検証する。
 *
 * @responsibility Root・Binding・受付情報と残る操作の結合を判定する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository内の起点を変えてState接続を構成し、正式保存の結果を読む。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Repository RootとBindingを構成時に閉じた平坦なState接続を返す", (t) => {
  const { root, ports, intake: originalIntake } = currentQueueFixture(t);
  const intake = Object.freeze({
    ...originalIntake,
    operation: "resume" as const,
  });
  const bound = Object.freeze({
    workingDirectory: root,
    repository: resolveExecutionStorageDirectory(root),
    repositoryBindingId: "binding-a",
    intake: intake,
  });
  assert.equal(bound.intake, intake);
  assert.equal(bound.repositoryBindingId, "binding-a");
  assert.deepEqual(bound.repository, { directory: root });
  assert.equal(Object.hasOwn(ports, "writeState"), false);
  assert.equal(Object.hasOwn(ports, "updateTask"), false);
  assert.equal(Object.hasOwn(ports, "readState"), false);
  assert.equal(Object.hasOwn(ports, "lease"), false);
  assert.equal(Object.hasOwn(ports, "settleQueueLeaseRelease"), false);
  assert.equal(bound.workingDirectory, root);
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  const nestedBound = Object.freeze({
    workingDirectory: nested,
    repository: resolveExecutionStorageDirectory(nested),
    repositoryBindingId: "binding-a",
    intake: intake,
  });
  assert.equal(nestedBound.workingDirectory, nested);
  assert.deepEqual(nestedBound.repository, { directory: root });
  assert.throws(
    () => resolveExecutionStorageDirectory("relative-only"),
    /coordinator_repository_root_invalid/u,
  );
  const initial = readProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    "project-a",
  );
  assert.ok(initial.value);
  const write = saveProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    {
      kind: "task_start",
      projectId: "project-a",
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    },
    initial.value.generation,
    nestedBound.intake,
  );
  assert.equal(write.status, "completed");
  const read = readProjectExecutionState(
    ports.repository,
    ports.repositoryBindingId,
    "project-a",
  );
  assert.equal(read.status, "completed");
  assert.deepEqual(read.value, write.value);
});

/**
 * PR-D-A-01 rejects an unknown queue record kind on exact retryを検証する。
 *
 * @responsibility PR-D-A-01 rejects an unknown queue record kind on exact retryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 rejects an unknown queue record kind on exact retryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 rejects an unknown queue record kind on exact retry", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createTestPersistence(root, "binding-a");
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [input, initialExecutionInput(state)],
    }).status,
    "completed",
  );
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
    string,
    unknown
  >;
  const payload = record as { queueEntries: Record<string, unknown>[] };
  const queue = payload.queueEntries[0];
  if (!queue) throw new Error("fixture_queue_missing");
  queue.recordKind = "unknown";
  fs.writeFileSync(location, `${canonicalJson(record)}\n`, "utf8");
  const before = fs.readFileSync(location);
  const result = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [input],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_state_read_unconfirmed");
  assert.equal(result.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(location), before);
  assert.equal(fs.existsSync(queueDirectory(root)), false);
});

/**
 * PR-D-Q-00 selects only queues owned by the requested Project bindingを検証する。
 *
 * @responsibility PR-D-Q-00 selects only queues owned by the requested Project bindingの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-Q-00 selects only queues owned by the requested Project bindingの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-Q-00 selects only queues owned by the requested Project binding", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createTestPersistence(root, "binding-a");
  const commonFields = {
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          ...commonFields,
          queueId: "queue-a",
          projectId: "project-a",
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(location);
  const selectedA = selectNextQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  const selectedB = readFixtureSnapshot(root, "binding-b");
  assert.equal(selectedA.status, "completed");
  assert.equal(selectedA.value?.queueId, "queue-a");
  assert.equal(selectedB.status, "blocked");
  assert.equal(selectedB.reason, "coordinator_snapshot_binding_invalid");
  assert.deepEqual(fs.readFileSync(location), before);
  assert.throws(
    () => createTestPersistence(root, "binding-b"),
    /coordinator_snapshot_not_initialized/u,
  );
});

/**
 * PR-D-Q-01 binds queue ownership to a live opaque leaseを検証する。
 *
 * @responsibility PR-D-Q-01 binds queue ownership to a live opaque leaseの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-Q-01 binds queue ownership to a live opaque leaseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-Q-01 binds queue ownership to a live opaque lease", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createTestPersistence(root, "binding-a");
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const created = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [input, initialExecutionInput(state)],
  });
  assert.equal(created.reason, "coordinator_queue_entry_durable");
  const observed = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [input],
  });
  assert.equal(observed.reason, "coordinator_queue_request_reused");
  assert.equal(created.status, "completed");
  assert.equal(observed.status, "completed");
  if (created.status !== "completed" || observed.status !== "completed")
    throw new Error("queue_observation_failed");
  assert.deepEqual(observed.value, created.value);
  assert.equal(fs.existsSync(queueDirectory(root)), false);
  const conflict = createQueue(ports.repository, ports.repositoryBindingId, {
    kind: "scheduled",
    input: [
      {
        ...input,
        requestHash: "d".repeat(64),
      },
    ],
  });
  assert.equal(conflict.status, "blocked");
  assert.equal(conflict.reason, "coordinator_queue_identity_conflict");

  const missingLease = updateCoordinatorQueue(ports, "queue-a", 1, {
    state: "leased",
    lease: null,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(missingLease.reason, "coordinator_queue_lease_invalid");
  const fabricatedLease = updateCoordinatorQueue(ports, "queue-a", 1, {
    state: "leased",
    lease: {
      kind: "project-operation",
      ownerGeneration: "fabricated-owner",
      isHeld: () => false,
      release: () => ({
        status: "completed" as const,
        reason: "fabricated",
        value: { released: true as const },
      }),
    },
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(fabricatedLease.reason, "coordinator_queue_lease_invalid");
  const acquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateCoordinatorQueue(ports, "queue-a", 1, {
    state: "leased",
    lease: acquired.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  const stale = updateCoordinatorQueue(ports, "queue-a", 1, {
    state: "running",
    lease: acquired.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(stale.reason, "coordinator_queue_generation_conflict");
  const wrongQueueLease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "coordinator_lease_binding_invalid");
  assert.equal(acquired.value.release().status, "completed");
  const releasedLease = updateCoordinatorQueue(ports, "queue-a", 2, {
    state: "running",
    lease: acquired.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(releasedLease.reason, "coordinator_queue_lease_invalid");
});

/**
 * QueueのProject／Queue結合を再送と更新で維持する。
 *
 * @responsibility 外側Hash一致でも取得意図と異なるQueue Identityを拒否する。
 * @trace PRL-IT-012
 * @precondition 現行Queueが保存済みで、exact Leaseを取得している。
 * @stimulus Project IDまたはQueue IDを破損し、再送／実行状態更新を要求する。
 * @observation 操作結果、state.json bytesと自己所有Lease解放結果を取得する。
 * @oracle 全反例を拒否して保存不変とし、fixture復元後は同じLeaseを解放できる。
 * @cleanup 注入bytesを自己所有fixtureの正常値へ戻しLeaseを解放し、hookがRootを回収する。
 * @boundary 現在Queue／取得意図の結合検査。
 */
test("PR-D-A-01 現行QueueのIdentity変更を再送・更新で拒否する", (t) => {
  for (const identity of ["project", "queue"] as const) {
    for (const operation of ["retry", "update"] as const) {
      const { root, state } = fixture(t);
      assert.equal(
        initializeExecutionStore(
          resolveExecutionStorageDirectory(root),
          "binding-a",
        ).status,
        "completed",
      );
      const ports = createTestPersistence(root, "binding-a");
      const input = {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: "b".repeat(64),
        originLane: "scheduled" as const,
        repositoryRevision: "a".repeat(40),
        scopeHash: "c".repeat(64),
      };
      assert.equal(
        createQueue(ports.repository, ports.repositoryBindingId, {
          kind: "scheduled",
          input: [input, initialExecutionInput(state)],
        }).status,
        "completed",
      );
      const lease = acquireCoordinatorSnapshotLease(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(lease.status, "completed");
      if (lease.status !== "completed") throw new Error("lease_fixture_failed");
      const location = path.join(
        root,
        ".crdd",
        "execution-model",
        "state.json",
      );
      let original: Buffer | null = null;
      try {
        assert.equal(
          updateCoordinatorQueue(ports, "queue-a", 1, {
            state: "leased",
            lease: lease.value,
            resumeCondition: null,
            resultReference: null,
          }).status,
          "completed",
        );
        original = fs.readFileSync(location);
        const envelope = JSON.parse(original.toString("utf8"));
        const queue = envelope.queueEntries[0];
        queue[identity === "project" ? "projectId" : "queueId"] =
          identity === "project" ? "project-b" : "queue-b";
        fs.writeFileSync(location, JSON.stringify(envelope), "utf8");
        const before = fs.readFileSync(location);
        const result =
          operation === "retry"
            ? createQueue(ports.repository, ports.repositoryBindingId, {
                kind: "scheduled",
                input: [input],
              })
            : updateCoordinatorQueue(ports, "queue-a", 2, {
                state: "running",
                lease: lease.value,
                resumeCondition: null,
                resultReference: null,
              });
        assert.equal(result.status, "blocked", `${identity}-${operation}`);
        assert.equal(result.reason, "coordinator_state_read_unconfirmed");
        assert.equal(result.manualRecoveryRequired, true);
        assert.deepEqual(fs.readFileSync(location), before);
        assert.equal(fs.existsSync(queueDirectory(root)), false);
      } finally {
        if (original) fs.writeFileSync(location, original);
        assert.equal(lease.value.release().status, "completed");
      }
    }
  }
});

/**
 * PR-D-Q-01 serializes project operations across queuesを検証する。
 *
 * @responsibility PR-D-Q-01 serializes project operations across queuesの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-Q-01 serializes project operations across queuesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-Q-01 serializes project operations across queues", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createTestPersistence(root, "binding-a");
  const queueInput = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          ...queueInput,
          queueId: "queue-a",
          requestHash: "b".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        { ...queueInput, queueId: "queue-b", requestHash: "e".repeat(64) },
      ],
    }).status,
    "completed",
  );
  const first = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  const duplicate = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(duplicate.status, "blocked");
  assert.equal(duplicate.reason, "coordinator_lease_unavailable");
  const crossQueue = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(crossQueue.status, "blocked");
  assert.equal(crossQueue.reason, "coordinator_lease_unavailable");
  if (first.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(first.value.release().status, "completed");
  assert.equal(
    first.value.release().reason,
    "coordinator_lease_already_released",
  );
  const reacquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * Lease解放後の終了保存失敗を同じ回復参照へ結ぶ。
 *
 * @responsibility 実排他不存在だけで終了保存を完了へ畳まず、未解決参照を保全する。
 * @trace PRL-IT-012
 * @precondition 現行Queueが保存済みで、exact Leaseを取得している。
 * @stimulus 解放意図の保存後、終了証拠をstate.jsonへ確定するrenameだけを失敗させる。
 * @observation 解放結果、保存されたIntent、pending、実排他不存在と再取得結果を確認する。
 * @oracle 解放はexact回復参照付きblocked、Intentは保持、再取得は停止する。
 * @cleanup 注入関数を復元し、自己所有Rootをfixture hookで回収する。
 * @boundary opaque Leaseの実解放と現在保存の終了確定。
 */
test("PR-D-A-01 Lease終了保存失敗は回復参照を保全して再取得を拒否する", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      resolveExecutionStorageDirectory(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createTestPersistence(root, "binding-a");
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "interactive",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  const acquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const directory = path.join(root, ".crdd", "execution-model");
  const current = path.join(directory, "state.json");
  const pending = path.join(directory, "state.pending.json");
  const before = JSON.parse(fs.readFileSync(current, "utf8"));
  const recoveryId = before.leaseIntents[0].recoveryId;
  const rename = fs.renameSync;
  let saves = 0;
  const injection = t.mock.method(
    fs,
    "renameSync",
    (...args: Parameters<typeof rename>) => {
      if (
        String(args[0]) === pending &&
        String(args[1]) === current &&
        ++saves === 2
      )
        throw new Error("injected_lease_settlement_save_failure");
      return Reflect.apply(rename, fs, args);
    },
  );
  let released: ReturnType<typeof acquired.value.release>;
  try {
    released = acquired.value.release();
  } finally {
    injection.mock.restore();
  }
  assert.equal(saves, 2);
  assert.equal(released.status, "blocked");
  assert.equal(released.reason, "coordinator_lease_release_unknown");
  assert.equal(released.manualRecoveryRequired, true);
  assert.equal(released.recoveryId, recoveryId);
  const saved = JSON.parse(fs.readFileSync(current, "utf8"));
  assert.equal(saved.leaseIntents.length, before.leaseIntents.length + 1);
  assert.equal(saved.leaseIntents.at(-1).phase, "release_pending");
  assert.ok(
    saved.leaseIntents.every(
      (intent: { recoveryId: string; ownerGeneration: string }) =>
        intent.recoveryId === recoveryId &&
        intent.ownerGeneration === acquired.value.ownerGeneration,
    ),
  );
  const proposed = JSON.parse(fs.readFileSync(pending, "utf8"));
  assert.equal(proposed.leaseIntents.length, 0);
  assert.ok(
    proposed.leaseEvidence.some(
      (row: { content: { disposition: string; ownerGeneration: string } }) =>
        row.content.disposition === "released" &&
        row.content.ownerGeneration === acquired.value.ownerGeneration,
    ),
  );
  const locks = path.join(root, ".crdd", "lock");
  assert.deepEqual(fs.readdirSync(locks), []);
  const currentBytes = fs.readFileSync(current);
  const pendingBytes = fs.readFileSync(pending);
  const reacquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "blocked");
  assert.equal(reacquired.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(current), currentBytes);
  assert.deepEqual(fs.readFileSync(pending), pendingBytes);
});

/**
 * PR-A-04 reconciles an exited lease owner without starting new workを検証する。
 *
 * @responsibility PR-A-04 reconciles an exited lease owner without starting new workの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 reconciles an exited lease owner without starting new workの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 reconciles an exited lease owner without starting new work", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const moduleUrl = new URL("../../src/lifecycle/host.ts", import.meta.url)
    .href;
  execFileSync(
    process.execPath,
    [
      "--eval",
      `import { acquireCoordinatorSnapshotLease } from ${JSON.stringify(moduleUrl)};
import { createTestPersistence } from ${JSON.stringify(new URL("../fixtures/task-persistence-fixture.ts", import.meta.url).href)};
import { updateCoordinatorQueue } from ${JSON.stringify(new URL("../../src/lifecycle/host.ts", import.meta.url).href)};
const lease = acquireCoordinatorSnapshotLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") { process.stdout.write(JSON.stringify({ status: lease.status, reason: lease.reason, manualRecoveryRequired: lease.manualRecoveryRequired })); process.exit(20); }
const queued = updateCoordinatorQueue(createTestPersistence(${JSON.stringify(root)}, "binding-a"), "queue-a", 1, { state: "leased", lease: lease.value, resumeCondition: null, resultReference: null });
if (queued.status !== "completed") process.exit(21);`,
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const before = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.equal(before.status, "completed");
  assert.equal(before.status === "completed" && before.value.state, "leased");
  let observedOwnerProcessId = 0;
  const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => {
      observedOwnerProcessId = owner.ownerProcessId;
      return {
        status: "absent",
        ownerProcessId: owner.ownerProcessId,
        ownerGeneration: owner.ownerGeneration,
      };
    },
  );
  assert.equal(recovered.status, "completed");
  assert.notEqual(observedOwnerProcessId, process.pid);
  assert.equal(
    recovered.status === "completed" && recovered.value.queue?.state,
    "recovery_required",
  );
  assert.equal(
    recovered.status === "completed" && recovered.value.queue?.ownerGeneration,
    null,
  );
  assert.equal(
    recovered.status === "completed" && recovered.value.queue?.resumeCondition,
    "owner_loss",
  );
  assert.ok(recovered.status === "completed" && recovered.value.queue);
  // Graphの回復は正式な再開で元Queueを整合させる。Leaseだけでは通過できない。
  for (const generation of [undefined, recovered.value.queue.generation]) {
    const reacquired = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
      generation,
    );
    assert.equal(reacquired.reason, "coordinator_lease_unavailable");
    assert.equal(reacquired.status, "blocked");
  }
  const after = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.ok(after.status === "completed", after.reason);
  assert.deepEqual(after.value, recovered.value.queue);
});

/**
 * PR-A-04 recovers a lease acquisition interrupted before Queue ownershipを検証する。
 *
 * @responsibility PR-A-04 recovers a lease acquisition interrupted before Queue ownershipの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 recovers a lease acquisition interrupted before Queue ownershipの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 recovers a lease acquisition interrupted before Queue ownership", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const moduleUrl = new URL("../../src/lifecycle/host.ts", import.meta.url)
    .href;
  execFileSync(
    process.execPath,
    [
      "--eval",
      `import { acquireCoordinatorSnapshotLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireCoordinatorSnapshotLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") { process.stdout.write(JSON.stringify({status: lease.status, reason: lease.reason})); process.exit(20); }`,
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const current = path.join(root, ".crdd", "execution-model", "state.json");
  const acquiredSnapshot = JSON.parse(fs.readFileSync(current, "utf8"));
  const recoveryId = acquiredSnapshot.leaseIntents[0].recoveryId;
  const locks = path.join(root, ".crdd", "lock");
  assert.equal(fs.readdirSync(locks).length, 1);
  const blockedAcquire = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "coordinator_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  let observedOwnerProcessId = 0;
  const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => {
      observedOwnerProcessId = owner.ownerProcessId;
      return { status: "absent", ...owner };
    },
  );
  assert.equal(recovered.status, "completed");
  assert.notEqual(observedOwnerProcessId, process.pid);
  assert.deepEqual(fs.readdirSync(locks), []);
  const queue = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.equal(queue.status, "completed");
  assert.equal(queue.value?.state, "queued");
  assert.equal(queue.value?.ownerGeneration, null);
  assert.equal(queue.value?.resultReference, recoveryId);
  const bytes = fs.readFileSync(current);
  const resumedSettlement = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    () => {
      throw new Error("settled_owner_must_not_be_observed_again");
    },
  );
  assert.equal(resumedSettlement.status, "completed");
  assert.equal(
    resumedSettlement.value?.queue?.generation,
    queue.value?.generation,
  );
  assert.deepEqual(fs.readFileSync(current), bytes);
  const after = readFixtureSnapshot(root, "binding-a");
  assert.equal(after.status, "completed");
  assert.equal(after.value?.leaseIntents.length, 0);
  const reacquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * PR-A-04 classifies a late contender against a live owner as unavailableを検証する。
 *
 * @responsibility PR-A-04 classifies a late contender against a live owner as unavailableの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 classifies a late contender against a live owner as unavailableの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 classifies a late contender against a live owner as unavailable", async (t) => {
  const { root, ports } = currentQueueFixture(t);
  const signal = path.join(root, "live-owner-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "task-lease-interleaving-probe.ts",
  );
  const child = spawn(
    process.execPath,
    [probe, root, signal, "hold", "project-operation", "queue-a", "project-a"],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = new Promise<number | null>((resolve, reject) => {
    child.once("close", resolve);
    child.once("error", reject);
  });
  try {
    const deadline = Date.now() + 10_000;
    while (!fs.existsSync(signal) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(fs.existsSync(signal), true);
    const statePath = path.join(root, ".crdd", "execution-model", "state.json");
    const before = fs.readFileSync(statePath);
    const contender = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(contender.status, "blocked");
    assert.equal(contender.reason, "coordinator_lease_unavailable");
    assert.equal(contender.manualRecoveryRequired, false);
    assert.equal(contender.recoveryId, null);
    assert.deepEqual(fs.readFileSync(statePath), before);
    fs.writeFileSync(`${signal}.go`, "go\n", "utf8");
    const exitCode = await closed;
    assert.equal(exitCode, 0);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  }
});

/**
 * PR-A-04 keeps pre-publication contention effect-free and recovers only after owner lossを検証する。
 *
 * @responsibility PR-A-04 keeps pre-publication contention effect-free and recovers only after owner lossの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 keeps pre-publication contention effect-free and recovers only after owner lossの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 keeps pre-publication contention effect-free and recovers only after owner loss", async (t) => {
  const { root, ports } = currentQueueFixture(t);
  const signal = path.join(root, "pre-publication-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "task-lease-interleaving-probe.ts",
  );
  const child = spawn(
    process.execPath,
    [
      probe,
      root,
      signal,
      "pause-before-publish",
      "project-operation",
      "queue-a",
      "project-a",
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const closed = new Promise<number | null>((resolve, reject) => {
    child.once("close", resolve);
    child.once("error", reject);
  });
  try {
    const deadline = Date.now() + 10_000;
    while (!fs.existsSync(signal) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(fs.existsSync(signal), true);
    const statePath = path.join(root, ".crdd", "execution-model", "state.json");
    const before = fs.readFileSync(statePath);
    const snapshot = readFixtureSnapshot(root, "binding-a");
    assert.equal(snapshot.status, "completed");
    const recoveryId = snapshot.value?.leaseIntents[0]?.recoveryId;
    assert.equal(typeof recoveryId, "string");
    const contender = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(contender.status, "blocked");
    assert.equal(contender.reason, "coordinator_lease_unavailable");
    assert.equal(contender.manualRecoveryRequired, false);
    assert.equal(contender.recoveryId, null);
    assert.deepEqual(fs.readFileSync(statePath), before);
    child.kill();
    await closed;
    const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
      (owner) => ({ status: "absent", ...owner }),
    );
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.value?.recoveryId, recoveryId);
    const reacquired = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(reacquired.status, "completed");
    if (reacquired.status === "completed")
      assert.equal(reacquired.value.release().status, "completed");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  }
});

/**
 * 取得実体の読戻し失敗を検証する。
 *
 * @responsibility 取得予約後の観測失敗でもexact回復参照と資源を保全する。
 * @trace PRL-IT-012
 * @precondition 現行Snapshotと自己所有Queueを初期化する。
 * @stimulus 現行Leaseの対象Filesystem観測を一度失敗させる。
 * @observation 取得結果、耐久取得意図、実排他と回復参照を観測する。
 * @oracle 不明を成功へ畳まず、同じ回復参照で再入場・解放できる。
 * @cleanup 注入を解除し自己所有Leaseを解放後Fixtureを回収する。
 * @boundary 現行保存Portと実Filesystemの取得・解放境界。
 */
test("PR-A-04 取得実体の読戻し失敗は現行取得意図の回復参照を保全する", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const original = fs.lstatSync;
  let isInjected = false;
  const mock = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof original>) => {
      const observedPath = String(args[0]);
      if (
        !isInjected &&
        path.dirname(observedPath) === path.join(root, ".crdd", "lock") &&
        path.basename(observedPath).startsWith("coordinator.lease.") &&
        observedPath.endsWith(".lock") &&
        fs.existsSync(observedPath)
      ) {
        // 予約前の不存在確認は通し、作成済みの実体を読む段階だけを失敗させる。
        isInjected = true;
        throw new Error("injected_physical_lease_readback_failure");
      }
      return Reflect.apply(original, fs, args);
    },
  );
  let failed: ReturnType<typeof acquireCoordinatorSnapshotLease>;
  try {
    failed = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
  } finally {
    mock.mock.restore();
  }
  assert.equal(isInjected, true);
  assert.equal(failed.status, "blocked");
  assert.equal(
    failed.reason,
    "coordinator_lease_acquisition_recovery_required",
  );
  assert.equal(failed.manualRecoveryRequired, true);
  const before = readFixtureSnapshot(root, "binding-a");
  assert.equal(before.status, "completed");
  assert.equal(before.value?.leaseIntents[0]?.phase, "acquisition_reserved");
  assert.equal(before.value?.leaseIntents[0]?.recoveryId, failed.recoveryId);
  assert.match(failed.recoveryId ?? "", /^lease-acquisition-[0-9a-f]{40}$/u);
  const locks = path.join(root, ".crdd", "lock");
  assert.equal(fs.readdirSync(locks).length, 1);
  const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.recoveryId, failed.recoveryId);
  assert.deepEqual(fs.readdirSync(locks), []);
  assert.equal(
    readFixtureSnapshot(root, "binding-a").value?.leaseIntents.length,
    0,
  );
  const reacquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * 実排他の清掃観測失敗を検証する。
 *
 * @responsibility 解放失敗を終了へ畳まず、現行取得意図からexact再入場を確認する。
 * @trace PRL-IT-012
 * @precondition 現行Snapshotと自己所有Queueを初期化する。
 * @stimulus 現行Leaseの対象Filesystem観測を一度失敗させる。
 * @observation 取得結果、耐久取得意図、実排他と回復参照を観測する。
 * @oracle 不明を成功へ畳まず、同じ回復参照で再入場・解放できる。
 * @cleanup 注入を解除し自己所有Leaseを解放後Fixtureを回収する。
 * @boundary 現行保存Portと実Filesystemの取得・解放境界。
 */
test("PR-A-04 実排他の清掃失敗は現行解放意図と回復参照を保全する", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const acquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const locks = path.join(root, ".crdd", "lock");
  const names = fs.readdirSync(locks);
  assert.equal(names.length, 1);
  const lockName = names[0];
  assert.equal(typeof lockName, "string");
  if (lockName === undefined) throw new Error("lease_resource_missing");
  const lock = path.join(locks, lockName);
  const original = fs.rmSync;
  let isInjected = false;
  const mock = t.mock.method(
    fs,
    "rmSync",
    (...args: Parameters<typeof original>) => {
      if (String(args[0]) === lock) {
        isInjected = true;
        throw new Error("injected_physical_lease_cleanup_failure");
      }
      return Reflect.apply(original, fs, args);
    },
  );
  let failed: ReturnType<typeof acquired.value.release>;
  try {
    failed = acquired.value.release();
  } finally {
    mock.mock.restore();
  }
  assert.equal(isInjected, true);
  assert.equal(failed.status, "blocked");
  assert.equal(failed.manualRecoveryRequired, true);
  const saved = readFixtureSnapshot(root, "binding-a");
  assert.equal(saved.status, "completed");
  assert.equal(saved.value?.leaseIntents.at(-1)?.phase, "release_pending");
  assert.equal(saved.value?.leaseIntents.at(-1)?.recoveryId, failed.recoveryId);
  assert.equal(fs.existsSync(lock), true);
  const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.recoveryId, failed.recoveryId);
  assert.equal(fs.existsSync(lock), false);
  assert.equal(
    readFixtureSnapshot(root, "binding-a").value?.leaseIntents.length,
    0,
  );
  const reacquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * PR-A-04 reconciles release intent created before Queue ownershipを検証する。
 *
 * @responsibility PR-A-04 reconciles release intent created before Queue ownershipの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 reconciles release intent created before Queue ownershipの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 reconciles release intent created before Queue ownership", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const moduleUrl = new URL("../../src/lifecycle/host.ts", import.meta.url)
    .href;
  execFileSync(
    process.execPath,
    [
      "--eval",
      `import fs from "node:fs";
import { acquireCoordinatorSnapshotLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireCoordinatorSnapshotLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);
const original = fs.rmSync;
fs.rmSync = (...args) => {
  if (String(args[0]).includes("coordinator.lease.")) throw new Error("injected_lease_release_failure");
  return Reflect.apply(original, fs, args);
};
const release = lease.value.release();
fs.rmSync = original;
if (release.status !== "blocked" || !release.manualRecoveryRequired) process.exit(21);`,
    ],
    { windowsHide: true },
  );
  const saved = readFixtureSnapshot(root, "binding-a");
  assert.equal(saved.status, "completed");
  assert.equal(saved.value?.leaseIntents.at(-1)?.phase, "release_pending");
  assert.equal(saved.value?.queueEntries[0]?.ownerGeneration, null);
  const recoveryId = saved.value?.leaseIntents.at(-1)?.recoveryId;
  assert.equal(typeof recoveryId, "string");
  const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.queue?.resultReference, recoveryId);
  const after = readFixtureSnapshot(root, "binding-a");
  assert.equal(after.value?.leaseIntents.length, 0);
  assert.equal(after.value?.queueEntries[0]?.state, "queued");
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd", "lock")), []);
  const reacquired = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * PR-A-04 leaves mismatched acquisition and release identities unchangedを検証する。
 *
 * @responsibility PR-A-04 leaves mismatched acquisition and release identities unchangedの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 leaves mismatched acquisition and release identities unchangedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 leaves mismatched acquisition and release identities unchanged", (t) => {
  for (const field of ["ownerGeneration", "recoveryId"] as const) {
    const { root, ports } = currentQueueFixture(t);
    const lease = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(lease.status, "completed");
    if (lease.status !== "completed") throw new Error("lease_fixture_failed");
    const location = path.join(root, ".crdd", "execution-model", "state.json");
    const originalBytes = fs.readFileSync(location);
    const record = JSON.parse(originalBytes.toString("utf8"));
    const owned = record.leaseIntents.at(-1);
    assert.equal(owned.phase, "lock_owned");
    const release = { ...owned, phase: "release_pending" };
    release[field] =
      field === "ownerGeneration"
        ? "other-owner"
        : `lease-acquisition-${"0".repeat(40)}`;
    record.leaseIntents.push(release);
    fs.writeFileSync(location, `${canonicalJson(record)}\n`, "utf8");
    const before = fs.readFileSync(location);
    const locks = path.join(root, ".crdd", "lock");
    const names = fs.readdirSync(locks);
    let observations = 0;
    const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
      (owner) => {
        observations++;
        return { status: "absent", ...owner };
      },
    );
    assert.equal(result.status, "blocked", field);
    assert.equal(result.manualRecoveryRequired, true, field);
    assert.equal(observations, 0, field);
    assert.deepEqual(fs.readFileSync(location), before, field);
    assert.deepEqual(fs.readdirSync(locks), names, field);
    fs.writeFileSync(location, originalBytes);
    assert.equal(lease.value.release().status, "completed");
    assert.deepEqual(fs.readdirSync(locks), []);
  }
});

/**
 * 現行取得前の破損・未確定保存・既存排他の保全を検証する。
 *
 * @responsibility 新しい取得意図を作れない状態で既存資源を変更しないことを確認する。
 * @trace PRL-IT-012
 * @precondition 現行状態とQueueを初期化し、一度取得・解放した自己所有Fixtureを使う。
 * @stimulus 状態破損、未確定pendingまたは既存排他を注入して取得を要求する。
 * @observation 拒否理由、回復参照、保存bytesと排他名集合を比較する。
 * @oracle 取得を拒否し、既存内容を保全して未確定Identityから回復参照を捏造しない。
 * @cleanup 登録済みhookが自己所有の注入物とFixtureを回収する。
 * @boundary 現行Snapshotと実Filesystemの取得前観測。
 */
test("PR-D-A-01 現行取得前の破損・未確定保存・既存排他を保全して拒否する", (t) => {
  for (const scenario of [
    "malformed-state",
    "partial-pending",
    "existing-lock",
  ] as const) {
    const { root, ports } = currentQueueFixture(t);
    const initial = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(initial.status, "completed");
    if (initial.status !== "completed") throw new Error("lease_fixture_failed");
    const locks = path.join(root, ".crdd", "lock");
    const lockName = fs.readdirSync(locks)[0];
    if (lockName === undefined) throw new Error("lease_resource_missing");
    assert.equal(initial.value.release().status, "completed");
    const directory = path.join(root, ".crdd", "execution-model");
    const location = path.join(directory, "state.json");
    const pending = path.join(directory, "state.pending.json");
    if (scenario === "malformed-state")
      fs.writeFileSync(location, '{"payload":', "utf8");
    if (scenario === "partial-pending")
      fs.writeFileSync(pending, '{"payload":', "utf8");
    if (scenario === "existing-lock") fs.mkdirSync(path.join(locks, lockName));
    const before = fs.readFileSync(location);
    const pendingBefore = fs.existsSync(pending)
      ? fs.readFileSync(pending)
      : null;
    const names = fs.readdirSync(locks);
    const result = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(result.status, "blocked", scenario);
    assert.equal(
      result.reason,
      scenario === "existing-lock"
        ? "coordinator_lease_preexisting_resource"
        : scenario === "partial-pending"
          ? "coordinator_state_reentry_required"
          : "coordinator_state_read_unconfirmed",
      scenario,
    );
    assert.equal(result.recoveryId, null, scenario);
    assert.deepEqual(fs.readFileSync(location), before, scenario);
    assert.deepEqual(
      fs.existsSync(pending) ? fs.readFileSync(pending) : null,
      pendingBefore,
      scenario,
    );
    assert.deepEqual(fs.readdirSync(locks), names, scenario);
    assert.equal(fs.existsSync(path.join(directory, "work")), false);
  }
});

/**
 * PR-A-04 clears Queue ownership only after exact lease release settlementを検証する。
 *
 * @responsibility PR-A-04 clears Queue ownership only after exact lease release settlementの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 clears Queue ownership only after exact lease release settlementの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 clears Queue ownership only after exact lease release settlement", (t) => {
  const { root, ports } = currentQueueFixture(t);
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateCoordinatorQueue(ports, "queue-a", 1, {
    state: "leased",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  const running = updateCoordinatorQueue(ports, "queue-a", 2, {
    state: "running",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(running.status, "completed");
  const terminalIntent = updateCoordinatorQueue(ports, "queue-a", 3, {
    state: "integration_pending",
    lease: lease.value,
    resumeCondition: "objective_integration",
    resultReference: "result-a",
  });
  assert.equal(terminalIntent.status, "completed");
  assert.equal(
    terminalIntent.status === "completed" &&
      terminalIntent.value.ownerGeneration,
    lease.value.ownerGeneration,
  );
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(location);
  assert.equal(
    settleCoordinatorSnapshotQueueLeaseRelease(
      ports.repository,
      ports.repositoryBindingId,
      "queue-a",
      4,
      lease.value.ownerGeneration,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(location), before);
  assert.equal(lease.value.release().status, "completed");
  const releasedQueue = readQueueEntry(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
  );
  assert.equal(
    releasedQueue.value?.ownerGeneration,
    lease.value.ownerGeneration,
  );
  const settled = settleCoordinatorSnapshotQueueLeaseRelease(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settled.status, "completed");
  assert.equal(
    settled.status === "completed" && settled.value.ownerGeneration,
    null,
  );
  assert.equal(
    settled.status === "completed" && settled.value.state,
    "integration_pending",
  );
});

/**
 * PR-A-04 preserves an exact long recovery reference in Queue terminal intentを検証する。
 *
 * @responsibility PR-A-04 preserves an exact long recovery reference in Queue terminal intentの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 preserves an exact long recovery reference in Queue terminal intentの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 preserves an exact long recovery reference in Queue terminal intent", (t) => {
  const { ports } = currentQueueFixture(t);
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-long-recovery",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "interactive",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-long-recovery",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateCoordinatorQueue(ports, "queue-long-recovery", 1, {
    state: "leased",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  const running = updateCoordinatorQueue(ports, "queue-long-recovery", 2, {
    state: "running",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(running.status, "completed");
  const recoveryRequired = updateCoordinatorQueue(
    ports,
    "queue-long-recovery",
    3,
    {
      state: "recovery_required",
      lease: lease.value,
      resumeCondition: "runtime_recovery",
      resultReference: recoveryId,
    },
  );
  assert.equal(recoveryRequired.status, "completed");
  assert.equal(
    recoveryRequired.status === "completed" &&
      recoveryRequired.value.resultReference,
    recoveryId,
  );
  assert.equal(lease.value.release().status, "completed");
  const settled = settleCoordinatorSnapshotQueueLeaseRelease(
    ports.repository,
    ports.repositoryBindingId,
    "queue-long-recovery",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settled.status, "completed");
  assert.equal(
    settled.status === "completed" && settled.value.resultReference,
    recoveryId,
  );
});

/**
 * PR-A-04 reconciles a released terminal intent after owner settlement was interruptedを検証する。
 *
 * @responsibility PR-A-04 reconciles a released terminal intent after owner settlement was interruptedの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 reconciles a released terminal intent after owner settlement was interruptedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
/** @trace PRL-IT-012 解放証拠を残す前に元Ownerが消失しても取消・採用待ちを再実行に戻さない。 */
test("Owner喪失でLeaseを回収しても取消・採用待ちのQueue結果を保持する", async (t) => {
  for (const disposition of ["cancelled", "integration_pending"] as const) {
    const { root, ports } = currentQueueFixture(t);
    const signal = path.join(root, "release-interrupted-ready");
    const probe = fileURLToPath(
      new URL("../fixtures/task-lease-interleaving-probe.ts", import.meta.url),
    );
    const child = spawn(
      process.execPath,
      [
        probe,
        root,
        signal,
        "hold",
        "project-operation",
        "queue-a",
        "project-a",
        disposition,
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    const closed = once(child, "close");
    let errors = "";
    child.stderr.on("data", (chunk) => {
      errors += String(chunk);
    });
    try {
      const deadline = performance.now() + 8000;
      while (
        !fs.existsSync(signal) &&
        child.exitCode === null &&
        child.signalCode === null &&
        performance.now() < deadline
      )
        await delay(20);
      assert.ok(fs.existsSync(signal), errors);
      const original = readQueueEntry(
        ports.repository,
        ports.repositoryBindingId,
        "queue-a",
      );
      assert.ok(
        original.status === "completed" && original.value.ownerGeneration,
      );
      assert.equal(original.value.state, disposition);
      const baseline = parseStoredExecutionFixture(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
          "utf8",
        ),
      );
      assert.ok(
        baseline.leaseIntents.some(
          (intent) =>
            intent.phase === "lock_owned" &&
            intent.ownerProcessId === child.pid,
        ),
      );
      assert.equal(
        baseline.leaseEvidence.some(
          (evidence) =>
            evidence.content.ownerGeneration ===
              original.value.ownerGeneration &&
            evidence.content.disposition !== "acquired",
        ),
        false,
      );
      assert.ok(child.kill("SIGKILL"));
      await closed;
      const finished = reconcileCoordinatorSnapshotLeaseOwnerLoss(
        root,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
        (owner) => {
          assert.equal(owner.ownerProcessId, child.pid);
          assert.throws(() => process.kill(owner.ownerProcessId, 0), {
            code: "ESRCH",
          });
          return { ...owner, status: "absent" };
        },
      );
      assert.ok(finished.status === "completed", finished.reason);
      assert.deepEqual(finished.value.queue, {
        ...original.value,
        ownerGeneration: null,
        generation: original.value.generation + 1,
      });
      const final = parseStoredExecutionFixture(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
          "utf8",
        ),
      );
      assert.equal(final.leaseIntents.length, 0);
      assert.ok(
        final.leaseEvidence.some(
          (evidence) =>
            evidence.content.ownerGeneration ===
              original.value.ownerGeneration &&
            evidence.content.disposition === "recovered_after_owner_loss",
        ),
      );
      assert.deepEqual(final.projects, baseline.projects);
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await closed;
    }
  }
});

/** @trace PRL-IT-005 回復の初回読取りの競合と、回復処置後の不明を混同しない。 */
test("GraphのLease回復は初回読取りだけ短期Lockを待ち、取消・認可喪失では処置しない", async (t) => {
  const { root, ports } = currentQueueFixture(t);
  const binding = ports.repositoryBindingId;
  const lease = acquireCoordinatorSnapshotLease(
    root,
    binding,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.ok(lease.status === "completed", lease.reason);
  const state = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(state, "utf8");
  let calls = 0;
  const observe = (owner: {
    ownerProcessId: number;
    ownerGeneration: string;
  }) => {
    calls += 1;
    return { ...owner, status: "alive" as const };
  };
  const args = [
    root,
    binding,
    "project-a",
    "queue-a",
    "project-operation",
    observe,
  ] as const;
  try {
    for (const mode of ["cancelled", "revoked", "released"] as const) {
      const other = acquireLock({
        directory: path.join(root, ".crdd", "lock"),
        name: "execution-model.state.lock",
        identity: "recovery-read-contention-fixture",
      });
      assert.ok(
        other.status === "acquired",
        other.status === "acquired" ? undefined : other.reason,
      );
      let releaseNeeded = true;
      try {
        assert.deepEqual(reconcileCoordinatorSnapshotLeaseOwnerLoss(...args), {
          status: "blocked",
          reason: "coordinator_snapshot_lock_contended",
          value: null,
          manualRecoveryRequired: false,
          recoveryId: null,
        });
        const controller = new AbortController();
        const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(...args, {
          signal: controller.signal,
          revalidate: async () => {
            if (mode === "revoked") return false;
            assert.equal(other.lock.release(), true);
            releaseNeeded = false;
            return true;
          },
        });
        if (mode === "cancelled") controller.abort();
        if (mode !== "released") {
          assert.equal(await result, null);
          assert.equal(calls, 0);
        } else {
          assert.equal(
            (await result)?.reason,
            "coordinator_lease_owner_still_active",
          );
          assert.equal(calls, 1);
        }
        assert.equal(fs.readFileSync(state, "utf8"), before);
      } finally {
        if (releaseNeeded) assert.equal(other.lock.release(), true);
      }
    }
  } finally {
    assert.equal(lease.value.release().status, "completed");
  }
});

test("PR-A-04 reconciles a released terminal intent after owner settlement was interrupted", (t) => {
  const { ports } = currentQueueFixture(t);
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = updateCoordinatorQueue(ports, "queue-a", generation, {
      state,
      lease: lease.value,
      resumeCondition:
        state === "integration_pending" ? "objective_integration" : null,
      resultReference: state === "integration_pending" ? "result-a" : null,
    });
    assert.equal(updated.status, "completed");
    generation += 1;
  }
  assert.equal(lease.value.release().status, "completed");
  let observerCalls = 0;
  const reconciled = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    () => {
      observerCalls += 1;
      return null;
    },
  );
  assert.equal(reconciled.status, "completed");
  assert.equal(observerCalls, 0);
  assert.equal(
    reconciled.status === "completed" && reconciled.value.queue?.state,
    "integration_pending",
  );
  assert.equal(
    reconciled.status === "completed" &&
      reconciled.value.queue?.ownerGeneration,
    null,
  );
});

/**
 * PR-A-04 requires exact Queue-bound lease evidence before clearing ownershipを検証する。
 *
 * @responsibility PR-A-04 requires exact Queue-bound lease evidence before clearing ownershipの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 requires exact Queue-bound lease evidence before clearing ownershipの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 requires exact Queue-bound lease evidence before clearing ownership", (t) => {
  const { root, ports } = currentQueueFixture(t);
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = updateCoordinatorQueue(ports, "queue-a", generation, {
      state,
      lease: lease.value,
      resumeCondition:
        state === "integration_pending" ? "objective_integration" : null,
      resultReference: state === "integration_pending" ? "result-a" : null,
    });
    assert.equal(updated.status, "completed");
    generation += 1;
  }
  assert.equal(lease.value.release().status, "completed");
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  const originalBytes = fs.readFileSync(location);
  const snapshot = JSON.parse(originalBytes.toString("utf8"));
  const released = snapshot.leaseEvidence.find(
    (item: { content: { disposition: string } }) =>
      item.content.disposition === "released",
  );
  assert.ok(released);
  released.content.queueId = "queue-b";
  released.contentHash = createHash("sha256")
    .update(canonicalJson(released.content))
    .digest("hex");
  fs.writeFileSync(location, `${canonicalJson(snapshot)}\n`, "utf8");
  const before = fs.readFileSync(location);
  const settlement = settleCoordinatorSnapshotQueueLeaseRelease(
    ports.repository,
    ports.repositoryBindingId,
    "queue-a",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settlement.status, "blocked");
  assert.equal(settlement.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(location), before);
  assert.equal(
    snapshot.queueEntries[0].ownerGeneration,
    lease.value.ownerGeneration,
  );
  assert.equal(
    readQueueEntry(ports.repository, ports.repositoryBindingId, "queue-a")
      .status,
    "blocked",
  );
  const missing = JSON.parse(originalBytes.toString("utf8"));
  missing.leaseEvidence = missing.leaseEvidence.filter(
    (item: { content: { disposition: string } }) =>
      item.content.disposition !== "released",
  );
  fs.writeFileSync(location, `${canonicalJson(missing)}\n`, "utf8");
  const missingBytes = fs.readFileSync(location);
  let observations = 0;
  const retry = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => {
      observations++;
      return { status: "absent", ...owner };
    },
  );
  assert.equal(retry.status, "blocked");
  assert.equal(retry.manualRecoveryRequired, true);
  assert.equal(observations, 0);
  assert.deepEqual(fs.readFileSync(location), missingBytes);
  fs.writeFileSync(location, originalBytes);
  assert.equal(
    settleCoordinatorSnapshotQueueLeaseRelease(
      ports.repository,
      ports.repositoryBindingId,
      "queue-a",
      4,
      lease.value.ownerGeneration,
    ).status,
    "completed",
  );
});

/**
 * PR-A-04 rejects malformed pre-existing recovered evidenceを検証する。
 *
 * @responsibility PR-A-04 rejects malformed pre-existing recovered evidenceの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 rejects malformed pre-existing recovered evidenceの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 rejects malformed pre-existing recovered evidence", (t) => {
  const { root, ports } = currentQueueFixture(t);
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateCoordinatorQueue(ports, "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  const originalBytes = fs.readFileSync(location);
  const record = JSON.parse(originalBytes.toString("utf8"));
  const acquired = record.leaseEvidence[0];
  record.leaseEvidence.push({ ...acquired, content: {} });
  fs.writeFileSync(location, `${canonicalJson(record)}\n`, "utf8");
  const before = fs.readFileSync(location);
  const locks = path.join(root, ".crdd", "lock");
  const names = fs.readdirSync(locks);
  const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(location), before);
  assert.deepEqual(fs.readdirSync(locks), names);
  fs.writeFileSync(location, originalBytes);
  assert.equal(lease.value.release().status, "completed");
});

/**
 * PR-A-04 does not steal a lease from a live or unobservable ownerを検証する。
 *
 * @responsibility PR-A-04 does not steal a lease from a live or unobservable ownerの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 does not steal a lease from a live or unobservable ownerの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 does not steal a lease from a live or unobservable owner", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: "a".repeat(40),
          scopeHash: "c".repeat(64),
        },
      ],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateCoordinatorQueue(ports, "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  for (const status of ["alive", "unknown"] as const) {
    const before = fs.readFileSync(location);
    const outcome = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
      (owner) => ({ ...owner, status }),
    );
    assert.equal(outcome.status, "blocked");
    assert.equal(
      outcome.reason,
      status === "alive"
        ? "coordinator_lease_owner_still_active"
        : "coordinator_lease_owner_observation_unknown",
    );
    assert.deepEqual(fs.readFileSync(location), before, status);
  }
  assert.equal(lease.value.release().status, "completed");
});

/**
 * PR-D-A-01 rejects generic recovery resume without advancing generationを検証する。
 *
 * @responsibility PR-D-A-01 rejects generic recovery resume without advancing generationの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 rejects generic recovery resume without advancing generationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 rejects generic recovery resume without advancing generation", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    createQueue(ports.repository, ports.repositoryBindingId, {
      kind: "scheduled",
      input: [input],
    }).status,
    "completed",
  );
  const lease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateCoordinatorQueue(ports, "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  for (const state of [
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ] as const) {
    const result = updateCoordinatorQueue(ports, "queue-a", 2, {
      state,
      lease: null,
      resumeCondition:
        state === "replan_required" || state === "human_decision_required"
          ? "resume-a"
          : state === "recovery_required"
            ? "recover-a"
            : null,
      resultReference: state === "cancelled" ? "cancelled-a" : null,
    });
    assert.equal(result.reason, "coordinator_queue_lease_invalid", state);
  }
  const fabricated = updateCoordinatorQueue(ports, "queue-a", 2, {
    state: "replan_required",
    lease: {
      kind: "project-operation",
      ownerGeneration: lease.value.ownerGeneration,
      isHeld: lease.value.isHeld,
      release: lease.value.release,
    },
    resumeCondition: "resume-a",
    resultReference: null,
  });
  assert.equal(fabricated.reason, "coordinator_queue_lease_invalid");
  const wrongQueueLease = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "coordinator_lease_binding_invalid");
  assert.equal(
    readQueueEntry(ports.repository, ports.repositoryBindingId, "queue-a").value
      ?.generation,
    2,
  );
  assert.equal(fs.existsSync(queueDirectory(root)), false);
  assert.equal(
    updateCoordinatorQueue(ports, "queue-a", 2, {
      state: "recovery_required",
      lease: lease.value,
      resumeCondition: "recover-a",
      resultReference: null,
    }).status,
    "completed",
  );
  assert.equal(lease.value.release().status, "completed");
  assert.equal(
    updateCoordinatorQueue(ports, "queue-a", 3, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).reason,
    "coordinator_queue_transition_invalid",
  );
  assert.equal(
    updateCoordinatorQueue(ports, "queue-a", 3, {
      state: "cancelled",
      lease: lease.value,
      resumeCondition: null,
      resultReference: "cancelled-a",
    }).reason,
    "coordinator_queue_lease_invalid",
  );
  assert.equal(
    readQueueEntry(ports.repository, ports.repositoryBindingId, "queue-a").value
      ?.generation,
    3,
  );
  assert.equal(fs.existsSync(queueDirectory(root)), false);
});

/**
 * 遅延回復者はfresh照合で拒否され、新しいOwnerのFileを処置しない。
 * @trace PRL-IT-012
 * @boundary Coordinator→Domain短期排他→自己生成Filesystem。実AI・Dockerを起動しない。
 * @oracle 回復Bの物理処置0、新Ownerのbytes・世代不変。fixtureが今回Rootを回収する。
 */
test("長期wx Leaseの遅延回復は新Ownerを削除しない", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const old = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(old.status, "completed");
  if (old.status !== "completed") throw Error("fixture");
  const active = borrowCoordinatorActiveLease(old.value);
  assert.ok(active);
  // 実Process終了と同じくdescriptorだけを閉じ、元FileとIntentを残す。
  assert.equal(active.physicalLock.release(true), true);
  const observeRoot = (repositoryRoot: string) => {
    const s = fs.lstatSync(repositoryRoot);
    return {
      repositoryRoot,
      rootIdentity: createHash("sha256")
        .update(JSON.stringify([s.dev, s.ino, s.birthtimeMs]), "utf8")
        .digest("hex"),
    };
  };
  const inspected = readLease(
    resolveExecutionStorageDirectory(root),
    "binding-a",
    {
      kind: "owner_loss",
      input: ["project-a", "queue-a", "project-operation", { observeRoot }],
    },
  );
  assert.equal(inspected.status, "completed");
  if (inspected.status !== "completed") throw Error("fixture");
  const initial = inspected.value,
    own = initial.intents,
    first = own[0];
  assert.ok(first);
  const pending = {
    ...first,
    phase: "recovery_pending" as const,
    physicalIdentity: active.snapshotPhysicalIdentity ?? null,
  };
  const reserved = recoverLease(
    resolveExecutionStorageDirectory(root),
    "binding-a",
    {
      kind: "intent",
      input: [
        "project-a",
        "queue-a",
        "project-operation",
        initial,
        own,
        pending,
        first.recoveryId,
        { observeRoot },
      ],
    },
  );
  assert.equal(reserved.status, "completed");
  // Aは同じpendingへ再入場して回収・保存し、その後新Ownerが取得する。
  assert.equal(
    reconcileCoordinatorSnapshotLeaseOwnerLoss(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
      (owner) => ({ ...owner, status: "absent" }),
    ).status,
    "completed",
  );
  const next = acquireCoordinatorSnapshotLease(
    ports.workingDirectory,
    ports.repositoryBindingId,
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(next.status, "completed");
  if (next.status !== "completed") throw Error("fixture");
  const nextActive = borrowCoordinatorActiveLease(next.value);
  assert.ok(nextActive);
  const before = fs.readFileSync(nextActive.lock);
  let physicalCalls = 0;
  const delayed = recoverLease(
    resolveExecutionStorageDirectory(root),
    "binding-a",
    {
      kind: "observed",
      input: [
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
        initial,
        own,
        pending,
        first,
        first.recoveryId,
        {
          observeRoot,
          recoverResources: () => {
            physicalCalls++;
            fs.unlinkSync(nextActive.lock);
            return true;
          },
          resourcesAbsent: () => true,
        },
      ],
    },
  );
  assert.equal(delayed.status, "blocked");
  assert.equal(physicalCalls, 0);
  assert.deepEqual(fs.readFileSync(nextActive.lock), before);
  assert.notEqual(next.value.ownerGeneration, old.value.ownerGeneration);
  assert.equal(next.value.release().status, "completed");
});

/**
 * 同期回収の不成立と不存在不明を保存成功にしない。
 * @trace PRL-IT-012
 * @oracle Promise／false／throw／不存在不明で元File・pending・回復IDを保全し、開始を拒否する。
 * @boundary Domain短期Owner→用途固定回収Callback。fixture以外の保持物は操作しない。
 */
test("長期Lease回復は同期処置と明示不存在の両方を要求する", (t) => {
  for (const mode of [
    "promise",
    "false",
    "throw",
    "absence_unknown",
  ] as const) {
    const { root, ports } = currentQueueFixture(t);
    const old = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(old.status, "completed");
    if (old.status !== "completed") throw Error("fixture");
    const active = borrowCoordinatorActiveLease(old.value);
    assert.ok(active);
    assert.equal(active.physicalLock.release(true), true);
    const observeRoot = (repositoryRoot: string) => {
      const s = fs.lstatSync(repositoryRoot);
      return {
        repositoryRoot,
        rootIdentity: createHash("sha256")
          .update(JSON.stringify([s.dev, s.ino, s.birthtimeMs]), "utf8")
          .digest("hex"),
      };
    };
    const inspected = readLease(
      resolveExecutionStorageDirectory(root),
      "binding-a",
      {
        kind: "owner_loss",
        input: ["project-a", "queue-a", "project-operation", { observeRoot }],
      },
    );
    if (inspected.status !== "completed") throw Error("fixture");
    const initial = inspected.value,
      own = initial.intents,
      first = own[0];
    assert.ok(first);
    const pending = {
      ...first,
      phase: "recovery_pending" as const,
      physicalIdentity: active.snapshotPhysicalIdentity ?? null,
    };
    assert.equal(
      recoverLease(resolveExecutionStorageDirectory(root), "binding-a", {
        kind: "intent",
        input: [
          "project-a",
          "queue-a",
          "project-operation",
          initial,
          own,
          pending,
          first.recoveryId,
          { observeRoot },
        ],
      }).status,
      "completed",
    );
    const stateFile = path.join(root, ".crdd", "execution-model", "state.json"),
      before = fs.readFileSync(stateFile),
      physical = fs.readFileSync(active.lock);
    let calls = 0;
    const result = recoverLease(
      resolveExecutionStorageDirectory(root),
      "binding-a",
      {
        kind: "observed",
        input: [
          "binding-a",
          "project-a",
          "queue-a",
          "project-operation",
          initial,
          own,
          pending,
          first,
          first.recoveryId,
          {
            observeRoot,
            recoverResources: () => {
              calls++;
              if (mode === "throw") throw Error("injected");
              return mode === "promise"
                ? (Promise.resolve(true) as never)
                : mode === "absence_unknown";
            },
            resourcesAbsent: () => Promise.resolve(true) as never,
          },
        ],
      },
    );
    assert.equal(result.status, "blocked", mode);
    assert.equal(calls, 1, mode);
    assert.deepEqual(fs.readFileSync(stateFile), before, mode);
    assert.deepEqual(fs.readFileSync(active.lock), physical, mode);
    assert.equal(
      acquireCoordinatorSnapshotLease(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
      ).status,
      "blocked",
      mode,
    );
    assert.equal(
      reconcileCoordinatorSnapshotLeaseOwnerLoss(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
        (owner) => ({ ...owner, status: "absent" }),
      ).status,
      "completed",
      mode,
    );
    assert.equal(fs.existsSync(active.lock), false, mode);
  }
});
/**
 * Git管理領域が欠けても、確定ディレクトリで取得・観測・解放・実Process終了後の回復を維持する。
 * @trace PRL-IT-012
 * @oracle 長い単一名・連続dotをTraversalと誤認せず、元世代の回収後に新取得できる。
 * @boundary 自己生成Repositoryと子Processだけ。Fixture hookでRootを回収する。
 */
test("長期Leaseの既存ID域はGitなしでもwx取得・通常解放・Crash回復で維持する", (t) => {
  for (const binding of ["a..b", "b".repeat(120)]) {
    const { root, ports } = currentQueueFixture(t, binding);
    const git = path.join(root, ".git");
    const heldGit = path.join(root, ".git-lease-fixture");
    fs.renameSync(git, heldGit);
    try {
      assert.equal(fs.existsSync(git), false);
      const held = acquireCoordinatorSnapshotLease(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(held.status, "completed");
      if (held.status !== "completed") throw Error("fixture");
      const observed = inspectCoordinatorSnapshotLeaseAcquisitionOwner(
        root,
        binding,
        "queue-a",
      );
      assert.equal(observed.status, "completed");
      assert.equal(
        observed.value?.acquisition?.ownerGeneration,
        held.value.ownerGeneration,
      );
      assert.equal(held.value.release().status, "completed");
      const url = new URL("../../src/lifecycle/host.ts", import.meta.url).href;
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `import {acquireCoordinatorSnapshotLease} from ${JSON.stringify(url)};const r=acquireCoordinatorSnapshotLease(${JSON.stringify(root)},${JSON.stringify(binding)},"project-a","queue-a","project-operation");if(r.status!=="completed")process.exit(20);`,
        ],
        { windowsHide: true },
      );
      const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
        (owner) => ({ ...owner, status: "absent" }),
      );
      assert.equal(recovered.status, "completed", JSON.stringify(recovered));
      const next = acquireCoordinatorSnapshotLease(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(next.status, "completed");
      if (next.status === "completed")
        assert.equal(next.value.release().status, "completed");
    } finally {
      fs.renameSync(heldGit, git);
    }
  }
});

/**
 * Lockまたは確定ディレクトリの観測拒否でも元descriptorを終了する。
 * @trace PRL-IT-012
 * @oracle 例外を漏らさず同じ回復ID・元bytesを保全し、descriptorはEBADF、同ID回復で閉じる。
 * @boundary 共通Lockの元fdとCoordinatorの解放・回復。自己生成Root以外は操作しない。
 */
test("長期Leaseの解放前拒否はdescriptorを閉じ同じ回復参照を保持する", (t) => {
  for (const mode of ["observation", "repository"] as const) {
    const { root, ports } = currentQueueFixture(t);
    const open = fs.openSync;
    let descriptor = -1;
    const opening = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof open>) => {
        const fd = Reflect.apply(open, fs, args);
        if (String(args[0]).includes("coordinator.lease.") && args[1] === "wx+")
          descriptor = fd;
        return fd;
      },
    );
    const held = acquireCoordinatorSnapshotLease(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
    );
    opening.mock.restore();
    if (held.status !== "completed") throw Error("fixture");
    assert.ok(descriptor >= 0);
    const active = borrowCoordinatorActiveLease(held.value);
    assert.ok(active);
    const before = fs.readFileSync(active.lock);
    const prior = readFixtureSnapshot(root, "binding-a").value?.leaseIntents[0]
      ?.recoveryId;
    const stat = fs.lstatSync;
    let injected = false;
    const injection = t.mock.method(
      fs,
      "lstatSync",
      (...args: Parameters<typeof stat>) => {
        const selected =
          mode === "observation"
            ? String(args[0]) === active.lock
            : String(args[0]) === root;
        if (selected) {
          injected = true;
          throw Error("injected_release_boundary");
        }
        return Reflect.apply(stat, fs, args);
      },
    );
    let result: ReturnType<typeof held.value.release>;
    try {
      result = held.value.release();
    } finally {
      injection.mock.restore();
    }
    assert.equal(injected, true, mode);
    assert.equal(result.status, "blocked", mode);
    assert.equal(result.recoveryId, prior, mode);
    assert.throws(() => fs.fstatSync(descriptor), { code: "EBADF" });
    assert.deepEqual(fs.readFileSync(active.lock), before);
    const recovered = reconcileCoordinatorSnapshotLeaseOwnerLoss(
      ports.workingDirectory,
      ports.repositoryBindingId,
      "project-a",
      "queue-a",
      "project-operation",
      (owner) => ({ ...owner, status: "absent" }),
    );
    assert.equal(recovered.status, "completed", JSON.stringify(recovered));
  }
});

/**
 * File観測はopen後の置換・読取り中増大でも上限+1byte以内で停止する。
 * @trace PRL-IT-012
 * @oracle 取得不明と元回復IDを保持し、read上限・fd終了・残存保全を直接観測する。
 * @boundary 新品FixtureのFile故障注入。過去保持物の回収は行わない。
 */
test("長期Lease File観測はopened実体を先に検査し固定上限で読む", (t) => {
  for (const mode of ["grow-at-open", "grow-at-read"] as const) {
    const { root, ports } = currentQueueFixture(t);
    const open = fs.openSync,
      read = fs.readSync;
    let descriptor = -1,
      requested = 0,
      injected = false;
    const opening = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof open>) => {
        const fd = Reflect.apply(open, fs, args);
        if (
          String(args[0]).includes("coordinator.lease.") &&
          args[1] === "r" &&
          new Error().stack?.includes("observePhysicalLeaseFile")
        ) {
          descriptor = fd;
          if (mode === "grow-at-open") {
            injected = true;
            fs.appendFileSync(String(args[0]), "x".repeat(4096));
          }
        }
        return fd;
      },
    );
    const reading = t.mock.method(fs, "readSync", (...args: unknown[]) => {
      if (
        args[0] === descriptor &&
        descriptor >= 0 &&
        new Error().stack?.includes("observePhysicalLeaseFile")
      ) {
        assert.equal(typeof args[3], "number");
        requested += Number(args[3]);
        if (!injected && mode === "grow-at-read") {
          injected = true;
          const locks = path.join(root, ".crdd", "lock");
          const lockName = fs.readdirSync(locks)[0];
          assert.ok(lockName);
          fs.appendFileSync(path.join(locks, lockName), "x".repeat(4096));
        }
      }
      return Reflect.apply(read, fs, args);
    });
    let result: ReturnType<typeof acquireCoordinatorSnapshotLease>;
    try {
      result = acquireCoordinatorSnapshotLease(
        ports.workingDirectory,
        ports.repositoryBindingId,
        "project-a",
        "queue-a",
        "project-operation",
      );
    } finally {
      opening.mock.restore();
      reading.mock.restore();
    }
    assert.equal(injected, true, mode);
    assert.equal(result.status, "blocked", mode);
    assert.ok(result.recoveryId, mode);
    assert.ok(requested <= 2049, mode);
    if (mode === "grow-at-open") assert.equal(requested, 0);
    assert.throws(() => fs.fstatSync(descriptor), { code: "EBADF" });
    const locks = path.join(root, ".crdd", "lock");
    assert.equal(fs.readdirSync(locks).length, 1);
  }
});
