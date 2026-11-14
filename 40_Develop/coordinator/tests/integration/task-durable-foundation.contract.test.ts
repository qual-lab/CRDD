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
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type {} from "../../../execution-model/src/index.ts";
import {
  initializeExecutionStore,
  type ProjectExecutionState,
  queryPlan,
  readLease,
  readState,
  recoverLease,
  saveIntegrationRecord,
  savePlan,
  saveProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readRepositoryStorageIdentity,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/configuration/runtime-data.ts";
import {
  acquireCoordinatorSnapshotLease,
  borrowCoordinatorActiveLease,
  inspectCoordinatorSnapshotLeaseAcquisitionOwner,
  reconcileCoordinatorSnapshotLeaseOwnerLoss,
} from "../../src/execution/lease.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createCoordinatorState } from "../../src/state/create.ts";
import { projectState } from "../../src/state/projection.ts";
import { maintainCoordinatorSnapshot } from "../../src/state/retirement.ts";
import {
  createCoordinatorSnapshotPersistencePorts,
  createCurrentCoordinatorPersistencePorts,
} from "../../src/state/transaction.ts";
import {
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  reserveProjectTaskStart,
  settleProjectTask,
} from "../../src/task/lifecycle.ts";
import { createCoordinatorSnapshotIntegrationRecordPort } from "../../src/workspace/commands.ts";
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
 * @stimulus 空の改訂1を初期化し、payloadを改訂2へ配置して公開Readerで確認する。
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
  const verified = verifyRuntimePersistenceRepository(root);
  const initialized = initializeExecutionStore(verified, "binding-a");
  assert.equal(initialized.status, "completed");
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  for (const state of payload.projects as readonly ProjectExecutionState[]) {
    const saved = saveProjectExecutionState(verified, "binding-a", state, 0);
    assert.equal(saved.status, "completed");
  }
  const bytes = fs.readFileSync(file);
  const repository = getRepository(root);
  assert.equal(repository.status, "completed");
  if (repository.status !== "completed") throw Error("fixture_root_invalid");
  const currentRead = readState(repository.capability, { scope: "recovery" });
  assert.equal(currentRead.status, "completed");
  const current = currentRead.value;
  assert.ok(current);
  assert.equal(current.sourceText, bytes.toString("utf8"));
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
    `${canonicalJson({ ...current.snapshot, ...rest, revision: payload.snapshotRevision, previous: { revision: current.snapshot.revision, payloadSha256: current.payloadSha256 } })}\n`,
  );
  // 値準備だけ。生Writerの保証はDomain試験へ分離し、実保存は以降の有限Portが所有する。
  fs.writeFileSync(file, fixtureBytes);
  const observed = readFixtureSnapshot(root, "binding-a");
  assert.equal(observed.status, "completed");
  return observed;
}

/**
 * 保存fixtureの期待Root結合を既存VC観測から独立に計算する。
 * @responsibility Hash取得だけのためにDomain私有排他へ依存しない。
 * @trace PRL-IT-005
 * @precondition 今回の自己生成Rootだけを渡す。
 * @stimulus 真正Rootと二つの既存Repository実体Identityを読む。
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
  const identity = readRepositoryStorageIdentity(verified.capability);
  assert.ok(actualRoot && identity);
  return createHash("sha256")
    .update("crdd-coordinator-repository-state-binding-v1\0")
    .update(
      JSON.stringify([
        actualRoot,
        identity.repositoryIdentity,
        identity.repositoryInstanceIdentity,
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
  const observed = readState(
    verifyRuntimePersistenceRepository(root),
    binding,
    "execution",
  );
  if (observed.status !== "completed" || observed.value === null)
    return { ...observed, value: null };
  const bytes = fs.readFileSync(
    path.join(root, ".crdd", "domain-model", "state.json"),
    "utf8",
  );
  const projected = taskView(root, bytes);
  assert.deepEqual(projected.projects, observed.value.projects);
  assert.deepEqual(projected.queueEntries, observed.value.queueEntries);
  assert.equal(projected.intakeEpoch, observed.value.intakeEpoch);
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
  const observed = readState(repository.capability, { scope: "recovery" });
  assert.equal(observed.status, "completed");
  const decoded = observed.value;
  assert.ok(decoded);
  assert.equal(decoded.sourceText, bytes);
  assert.ok(
    decoded.snapshot.repositoryBindingId !== null &&
      decoded.snapshot.intakeEpoch !== null,
  );
  const view = {
    schema: "crdd-execution-model/project-snapshot/v7" as const,
    schemaRevision: 7 as const,
    repositoryRootHash: rootHash,
    repositoryBindingId: decoded.snapshot.repositoryBindingId,
    intakeEpoch: decoded.snapshot.intakeEpoch,
    snapshotRevision: decoded.snapshot.revision,
    projects: decoded.projects,
    intakeBindings: decoded.snapshot.intakeBindings,
    queueEntries: decoded.snapshot.queueEntries,
    workspaces: decoded.snapshot.workspaces,
    leaseEvidence: decoded.snapshot.leaseEvidence,
    leaseIntents: decoded.snapshot.leaseIntents,
    results: decoded.snapshot.results,
    historyPending: decoded.snapshot.historyPending,
    decisions: decoded.snapshot.decisions,
    blockers: decoded.snapshot.blockers,
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
    const { root } = fixture(t);
    assert.equal(
      initializeExecutionStore(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
      ).status,
      "completed",
    );
    const acquired = acquireCoordinatorSnapshotLease(
      root,
      "binding-a",
      "project-a",
      "canonical",
      "canonical-adoption",
    );
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("fixture_lease_failed");
    const beforeSnapshot = readFixtureSnapshot(root, "binding-a").value;
    assert.ok(beforeSnapshot?.schemaRevision === 7);
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
    const statePath = path.join(root, ".crdd", "domain-model", "state.json");
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
        "canonical",
        "canonical-adoption",
        (owner) => ({ ...owner, status: "absent" }),
      ).status,
      "completed",
    );
    assert.equal(fs.existsSync(lockPath), false);
  });
}

/**
 * 同Projectの採用結果を段階的に整理しても参照中の終了証拠を失わないことを検証する。
 * @responsibility 採用結果と共用Lease証拠の参照終了を一緒に処置する。
 * @trace PRL-IT-012
 * @precondition 新版保存に終了済み採用結果二件を保持する。
 * @stimulus 一件を参照保護し、整理後に参照を解除する。
 * @observation 結果、Lease証拠、履歴と最新Projectを読む。
 * @oracle 各結果の参照終了後だけ退役し、残る結果の証拠を保持する。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 新版保存、履歴と参照保護。
 */
test("snapshot production: shared adoption evidence survives staged retirement", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  const other = ports.lease.acquire(
    "project-b",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(other.status, "completed");
  if (other.status !== "completed") throw new Error("fixture_lease_failed");
  assert.equal(other.value.release().status, "completed");
  const otherEvidence = readFixtureSnapshot(root, "binding-a").value
    ?.leaseEvidence;
  const lease = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(lease.status, "completed", JSON.stringify(lease));
  if (lease.status !== "completed") throw new Error("fixture_lease_failed");
  assert.equal(lease.value.release().status, "completed");
  const records = createCoordinatorSnapshotIntegrationRecordPort({
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "adoption-a",
  });
  for (const identity of ["receipt-a", "receipt-b"])
    assert.equal(
      records.write({
        kind: "adoption",
        identity,
        value: {
          status: "completed",
          receiptId: identity,
          beforeRevision: "a".repeat(40),
          afterRevision: "b".repeat(40),
          changedPaths: ["result.txt"],
          cleanupConfirmed: true,
        },
      }).status,
      "completed",
    );
  const protectedState = {
    ...state,
    milestone: { ...state.milestone, criterionEvidenceIds: ["receipt-b"] },
  };
  assert.equal(ports.state.writeState(protectedState, 0).status, "completed");
  assert.equal(maintainCoordinatorSnapshot(root, "binding-a").value, 1);
  const retained = readFixtureSnapshot(root, "binding-a").value;
  assert.deepEqual(
    retained?.results.map((item) => item.identity),
    ["receipt-b"],
  );
  assert.ok(retained && retained.leaseEvidence.length > 0);
  assert.equal(
    ports.state.writeState(
      {
        ...protectedState,
        generation: protectedState.generation + 1,
        milestone: { ...protectedState.milestone, criterionEvidenceIds: [] },
      },
      protectedState.generation,
    ).status,
    "completed",
  );
  assert.equal(maintainCoordinatorSnapshot(root, "binding-a").value, 1);
  const closed = readFixtureSnapshot(root, "binding-a").value;
  assert.equal(closed?.results.length, 0);
  assert.deepEqual(closed?.leaseEvidence, otherEvidence);
  assert.equal(closed?.projects.length, 1);
});

/**
 * 公開初期化入口を実Processで通し、Queryや再初期化が世代を作り直さないことを検証する。
 * @responsibility 運用手順と本番の明示初期化を同じ入口へ結合する。
 * @trace PRL-IT-012
 * @precondition 自己所有の新品Repositoryを使う。
 * @stimulus 公開launcherのproject initを二回実行する。
 * @observation 応答、保存世代とFile一覧を読む。
 * @oracle 同じ受付世代、単一state.json、Providerや旧Directoryなし。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 公開launcher、CLI、実保存。
 */
test("snapshot production: public initialization is explicit and idempotent", (t) => {
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
   * @oracle 初回と再実行は同じ受付世代でcompletedとなる。
   * @cleanup 同期子Processは終了まで待ち、親試験がfixtureを回収する。
   * @boundary PRL-IT-012=Direct Boundary: 公開launcher→CLI→Repository保存。
   */
  const invoke = () =>
    JSON.parse(
      execFileSync(process.execPath, [launcher, "project", "init", "--json"], {
        cwd: root,
        windowsHide: true,
        encoding: "utf8",
      }),
    );
  const first = invoke();
  const second = invoke();
  assert.equal(first.status, "completed");
  assert.equal(second.status, "completed");
  assert.equal(second.value, first.value);
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd", "domain-model")), [
    "state.json",
  ]);
  assert.equal(fs.existsSync(path.join(root, ".crdd", "orchestrator")), false);
});

/**
 * 新品初期化と、通常Queueを持たない既存候補の採用接続を検証する。
 * @responsibility 保存刷新で独立採用の能力を失わないことを確認する。
 * @trace PRL-IT-012
 * @precondition Repository-localの隔離fixtureを用いる。
 * @stimulus 初期化、採用Lease取得・解放、結果再送を行う。
 * @observation 現在値とLease、結果件数を読む。
 * @oracle ProjectとQueueは空のままで、一件の結果だけが保存される。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 本番Persistence Factoryから実保存・実Lease。
 */
test("snapshot production: fresh bootstrap and independent adoption", (t) => {
  const { root } = fixture(t);
  assert.equal(readFixtureSnapshot(root, "binding-a").value, null);
  const initialized = initializeExecutionStore(
    verifyRuntimePersistenceRepository(root),
    "binding-a",
  );
  assert.equal(initialized.status, "completed");
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).value,
    initialized.value,
  );
  const persistence = createCurrentCoordinatorPersistencePorts(
    root,
    "binding-a",
  );
  const lease = persistence.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(lease.status, "completed", JSON.stringify(lease));
  if (lease.status !== "completed") throw new Error("adoption_lease_failed");
  assert.equal(lease.value.release().status, "completed");
  const records = createCoordinatorSnapshotIntegrationRecordPort({
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "workbench-candidate",
    queueId: "adoption-a",
  });
  const record = {
    kind: "adoption" as const,
    identity: "receipt-a",
    value: {
      status: "completed",
      receiptId: "receipt-a",
      beforeRevision: "a".repeat(40),
      afterRevision: "b".repeat(40),
      changedPaths: ["result.txt"],
      cleanupConfirmed: true,
    },
  };
  assert.equal(records.write(record).status, "completed");
  assert.equal(records.write(record).status, "completed");
  assert.equal(
    records.write({ ...record, value: { status: "blocked" } }).status,
    "blocked",
  );
  assert.equal(
    records.write({ ...record, kind: "integration" }).status,
    "blocked",
  );
  const snapshot = readFixtureSnapshot(root, "binding-a");
  assert.equal(snapshot.value?.projects.length, 0);
  assert.equal(snapshot.value?.queueEntries.length, 0);
  assert.equal(snapshot.value?.results.length, 1);
  assert.equal(maintainCoordinatorSnapshot(root, "binding-a").value, 1);
  const retired = readFixtureSnapshot(root, "binding-a");
  assert.equal(retired.value?.results.length, 0);
  assert.equal(retired.value?.leaseEvidence.length, 0);
  assert.equal(retired.value?.intakeEpoch, initialized.value);
  assert.equal(maintainCoordinatorSnapshot(root, "binding-a").value, 0);
});

/**
 * 終了済みQueueの履歴確定と受付世代の一体更新を検証する。
 * @responsibility 最新Projectを保持し、古い依頼の再実行を拒否する。
 * @trace PRL-IT-012
 * @precondition 新版Snapshotと閉じた取消状態を用いる。
 * @stimulus Queueを終了し、整理と旧受付再送を行う。
 * @observation Queue、受付世代、履歴行、Project状態を読む。
 * @oracle 履歴一行、Queueゼロ、世代変更、Project保持、旧受付拒否。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 本番保存Factoryと履歴・受付。
 */
test("snapshot production: retire closed queue and reject old intake", (t) => {
  const { root, state } = fixture(t);
  const initial = initializeExecutionStore(
    verifyRuntimePersistenceRepository(root),
    "binding-a",
  );
  if (initial.status !== "completed") throw new Error("bootstrap_failed");
  const epoch = initial.value;
  const ports = createCoordinatorSnapshotPersistencePorts(
    root,
    "binding-a",
    epoch,
  );
  const closed: ProjectExecutionState = {
    ...state,
    milestone: {
      ...state.milestone,
      state: "cancelled",
      criterionEvidenceIds: ["receipt-a"],
    },
    objectives: state.objectives.map((item) => ({
      ...item,
      state: "cancelled" as const,
    })),
    tasks: state.tasks.map((item) => ({
      ...item,
      state: "cancelled" as const,
      cleanupConfirmed: true,
      startPhase: "settled" as const,
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
    })),
  };
  assert.equal(ports.state.writeState(closed, 0).status, "completed");
  const input = {
    queueId: "canonical",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(ports.state.enqueueOperation(input).status, "completed");
  assert.equal(
    ports.state.updateQueue("canonical", 1, {
      state: "cancelled",
      lease: null,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  const canonicalEvidence: unknown[] = [];
  for (const projectId of ["project-a", "project-b"]) {
    if (projectId === "project-b")
      assert.equal(
        ports.state.writeState(
          {
            ...closed,
            projectId,
            milestone: {
              ...closed.milestone,
              criterionEvidenceIds: ["receipt-b"],
            },
          },
          0,
        ).status,
        "completed",
      );
    const acquired = ports.lease.acquire(
      projectId,
      "canonical",
      "canonical-adoption",
    );
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("fixture_adoption_failed");
    assert.equal(acquired.value.release().status, "completed");
    const identity = projectId === "project-a" ? "receipt-a" : "receipt-b";
    assert.equal(
      createCoordinatorSnapshotIntegrationRecordPort({
        workingDirectory: root,
        repositoryBindingId: "binding-a",
        projectId,
        milestoneId: "milestone-a",
        queueId: projectId === "project-a" ? "canonical" : "adoption-b",
      }).write({
        kind: "adoption",
        identity,
        value: {
          status: "completed",
          receiptId: identity,
          beforeRevision: "a".repeat(40),
          afterRevision: "b".repeat(40),
          changedPaths: ["result.txt"],
          cleanupConfirmed: true,
        },
      }).status,
      "completed",
    );
  }
  canonicalEvidence.push(
    ...(readFixtureSnapshot(root, "binding-a").value?.leaseEvidence ?? []),
  );
  const queued = readFixtureSnapshot(root, "binding-a").value;
  assert.ok(queued);
  const beforeRetirement = fs.readFileSync(
    path.join(root, ".crdd", "domain-model", "state.json"),
    "utf8",
  );
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      {
        ...closed,
        generation: closed.generation + 1,
        milestone: { ...closed.milestone, id: "milestone-new" },
      } as ProjectExecutionState,
      closed.generation,
    ).status,
    "blocked",
  );
  assert.equal(
    fs.readFileSync(
      path.join(root, ".crdd", "domain-model", "state.json"),
      "utf8",
    ),
    beforeRetirement,
  );
  assert.equal(maintainCoordinatorSnapshot(root, "binding-a").value, 1);
  const snapshot = readFixtureSnapshot(root, "binding-a");
  assert.notEqual(snapshot.value?.intakeEpoch, epoch);
  assert.equal(snapshot.value?.queueEntries.length, 0);
  assert.equal(snapshot.value?.projects.length, 2);
  assert.equal(snapshot.value?.results.length, 2);
  assert.deepEqual(snapshot.value?.leaseEvidence, canonicalEvidence);
  assert.equal(snapshot.value?.historyPending.length, 0);
  assert.equal(maintainCoordinatorSnapshot(root, "binding-a").value, 0);
  assert.equal(ports.state.enqueueOperation(input).status, "blocked");
  const stale = {
    epoch,
    queueId: "queue-new",
    requestHash: "d".repeat(64),
    projectId: "project-new",
    milestoneId: "milestone-new",
  };
  const stalePorts = createCoordinatorSnapshotPersistencePorts(
    root,
    "binding-a",
    epoch,
    stale,
  );
  const staleWrite = stalePorts.state.writeState(
    { ...state, projectId: "project-new" },
    0,
  );
  assert.equal(staleWrite.status, "blocked");
  assert.equal(staleWrite.reason, "orchestrator_intake_epoch_retired");
  assert.equal(staleWrite.manualRecoveryRequired, false);
  assert.equal(staleWrite.recoveryId, null);
  assert.equal(
    readFixtureSnapshot(root, "binding-a").value?.projects.some(
      (item) => item.projectId === "project-new",
    ),
    false,
  );
  const historyRows = fs
    .readFileSync(
      path.join(root, ".crdd", "domain-model", "history.jsonl"),
      "utf8",
    )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    historyRows.filter((row) => row.summary?.record?.id === "canonical").length,
    1,
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
    "adoption_same",
    "adoption_other",
    "never_acquired",
    "save_failure",
    "unbound_absent",
    "unbound_no_parent",
    "unbound_present",
  ] as const) {
    const { root, state } = fixture(t);
    const isAdoption = mode.startsWith("adoption");
    const queueId = isAdoption ? "canonical" : "queue-a";
    const rootHash = fixtureRepositoryHash(root);
    assert.equal(
      seedSnapshot(root, {
        schema: "crdd-execution-model/project-snapshot/v7",
        schemaRevision: 7,
        workspaces: [],
        repositoryRootHash: rootHash,
        repositoryBindingId: "binding-a",
        snapshotRevision: 1,
        intakeEpoch: "epoch-a",
        intakeBindings: [{ queueId, epoch: "epoch-a" }],
        projects:
          mode === "adoption_other"
            ? [state, { ...state, projectId: "project-b" }]
            : [state],
        queueEntries: [
          {
            workspaceId: null,
            queueId,
            projectId: mode === "adoption_other" ? "project-b" : "project-a",
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
    const current = path.join(root, ".crdd", "domain-model", "state.json");
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
    const ports = createCoordinatorSnapshotPersistencePorts(
      root,
      "binding-a",
      "epoch-a",
    );
    const acquired = ports.lease.acquire(
      "project-a",
      queueId,
      isAdoption ? "canonical-adoption" : "project-operation",
    );
    mock?.mock.restore();
    if (isUnbound) {
      assert.equal(acquired.status, "blocked");
      // 本試験が所有する失敗候補を戻し、回収入口の現在状態からの処置だけを評価する。
      fs.unlinkSync(
        path.join(root, ".crdd", "domain-model", "state.pending.json"),
      );
      assert.equal(fs.existsSync(path.join(root, ".crdd", "domain-model", "state.lock")), false);
    } else assert.equal(acquired.status, "completed");
    const statePort = ports.state;
    if (mode === "bound" && acquired.status === "completed") {
      assert.equal(
        statePort.updateQueue("queue-a", 1, {
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
    const result = (
      isAdoption
        ? ports.lease.reconcileAdoptionOwnerLoss.bind(null, "project-a")
        : ports.lease.reconcileOperationOwnerLoss.bind(
            null,
            "project-a",
            queueId,
          )
    )((owner) => {
      isCallbackObserved = true;
      // callbackが短期排他を保持していないことを実Ownerの再取得で確認する。
      const observed = readState(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
        "execution",
      );
      assert.equal(observed.status, "completed", observed.reason);
      if (mode === "observer_throw") throw new Error("observation_failed");
      if (mode === "target_changed" && acquired.status === "completed") {
        assert.equal(
          statePort.updateQueue("queue-a", 1, {
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
    });
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
          path.join(root, ".crdd", "domain-model", "state.pending.json"),
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
            path.join(root, ".crdd", "domain-model", "state.pending.json"),
            "utf8",
          ),
          pending,
        );
        assert.equal(fs.existsSync(lock), false);
        // 自己生成の未確定fixtureを配置する。出版の保証はDomain試験が所有する。
        const fixtureBytes = Buffer.from(pending);
        fs.writeFileSync(current, fixtureBytes);
        fs.unlinkSync(
          path.join(root, ".crdd", "domain-model", "state.pending.json"),
        );
        assert.deepEqual(fs.readFileSync(current), fixtureBytes);
        assert.throws(
          () =>
            fs.lstatSync(
              path.join(root, ".crdd", "domain-model", "state.pending.json"),
            ),
          { code: "ENOENT" },
        );
        // 未出版候補の値検査はEMが所有する。ここでは明示配置と元pendingの除去だけを確認する。
      }
    } else {
      assert.equal(result.status, "completed");
      const saved = JSON.parse(fs.readFileSync(current, "utf8"));
      assert.deepEqual(
        result.value,
        isAdoption ? { recoveryId } : saved.queueEntries[0],
      );
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
      assert.equal(
        saved.queueEntries[0].resultReference,
        isAdoption ? null : recoveryId,
      );
      if (isAdoption) {
        assert.deepEqual(saved.queueEntries, before.queueEntries);
        assert.deepEqual(saved.results, before.results);
      }
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
      schema: "crdd-execution-model/project-snapshot/v7",
      schemaRevision: 7,
      workspaces: [],
      repositoryRootHash: rootHash,
      repositoryBindingId: "binding-a",
      snapshotRevision: 1,
      intakeEpoch: "epoch-a",
      intakeBindings: [{ queueId: "queue-a", epoch: "epoch-a" }],
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
    const directory = path.join(root, ".crdd", "domain-model");
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
              path.join(oldRoot, ".crdd", "domain-model", "state.json"),
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
    schema: "crdd-execution-model/project-snapshot/v7",
    schemaRevision: 7,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [{ queueId: "queue-a", epoch: "epoch-a" }],
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
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  const results = createCoordinatorSnapshotIntegrationRecordPort({
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
  });
  for (const kind of ["integration", "adoption"] as const) {
    const result = {
      kind,
      identity: `result-${kind}`,
      value: { status: "confirmed" },
    };
    assert.equal(results.write(result).status, "completed");
    const exact = fs.readFileSync(file, "utf8");
    assert.equal(results.write(result).status, "completed");
    assert.equal(
      results.write({ ...result, value: { status: "different" } }).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), exact);
  }
  assert.equal(
    createCoordinatorSnapshotIntegrationRecordPort({
      workingDirectory: root,
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "other",
      queueId: "queue-a",
    }).write({ kind: "integration", identity: "result-other", value: {} })
      .status,
    "blocked",
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "domain-model", "results")),
    false,
  );
  const ports = createCoordinatorSnapshotPersistencePorts(
    root,
    "binding-a",
    "epoch-a",
  );
  const statePort = ports.state;
  const operation = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(operation.status, "completed");
  if (operation.status !== "completed")
    throw new Error("snapshot_lease_fixture_failed");
  const beforeOwnerRead = fs.readFileSync(file);
  const ownerRead = ports.lease.inspectAcquisitionOwner();
  assert.equal(ownerRead.status, "completed");
  assert.deepEqual(ownerRead.value, {
    acquisition: {
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      queueId: "queue-a",
      ownerGeneration: operation.value.ownerGeneration,
      ownerProcessId: process.pid,
      recoveryId: `lease-acquisition-${createHash("sha256").update("binding-a\0project-operation").digest("hex").slice(0, 40)}`,
    },
  });
  assert.deepEqual(fs.readFileSync(file), beforeOwnerRead);
  assert.equal(
    ports.lease.acquire("project-a", "queue-a", "project-operation").status,
    "blocked",
  );
  const adoption = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(adoption.status, "completed");
  if (adoption.status !== "completed")
    throw new Error("snapshot_adoption_fixture_failed");
  assert.equal(adoption.value.release().status, "completed");
  const beforeReconcile = fs.readFileSync(file);
  assert.equal(
    ports.lease.reconcileOperationOwnerLoss(
      "project-a",
      "queue-a",
      (owner) => ({
        ...owner,
        status: "alive",
      }),
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), beforeReconcile);
  const adoptionReconcile = ports.lease.reconcileAdoptionOwnerLoss(
    "project-a",
    () => {
      throw new Error("no_adoption_owner_to_observe");
    },
  );
  assert.equal(adoptionReconcile.status, "completed");
  assert.deepEqual(adoptionReconcile.value, { recoveryId: null });
  assert.deepEqual(fs.readFileSync(file), beforeReconcile);
  assert.equal(
    statePort.updateQueue("queue-a", 1, {
      state: "leased",
      lease: operation.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  assert.equal(
    statePort.updateQueue("queue-a", 2, {
      state: "running",
      lease: operation.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  assert.equal(
    statePort.updateQueue("queue-a", 3, {
      state: "integration_pending",
      lease: operation.value,
      resumeCondition: null,
      resultReference: "integration-a",
    }).status,
    "completed",
  );
  assert.equal(
    statePort.settleQueueLeaseRelease(
      "queue-a",
      4,
      operation.value.ownerGeneration,
    ).status,
    "blocked",
  );
  assert.equal(operation.value.release().status, "completed");
  assert.equal(operation.value.release().status, "blocked");
  assert.deepEqual(
    inspectCoordinatorSnapshotLeaseAcquisitionOwner(root, "binding-a").value,
    { acquisition: null },
  );
  assert.equal(
    statePort.settleQueueLeaseRelease(
      "queue-a",
      4,
      operation.value.ownerGeneration,
    ).status,
    "completed",
  );
  const releasedSnapshot = readFixtureSnapshot(root, "binding-a");
  assert.equal(releasedSnapshot.status, "completed");
  assert.equal(releasedSnapshot.value?.leaseIntents.length, 0);
  assert.equal(releasedSnapshot.value?.leaseEvidence.length, 4);
  const settledBytes = fs.readFileSync(file);
  const recoveredQueue = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
    () => {
      throw new Error("no_operation_owner_to_observe");
    },
  );
  assert.equal(recoveredQueue.status, "completed");
  assert.deepEqual(
    recoveredQueue.value,
    ports.state.readQueue("queue-a").value,
  );
  assert.deepEqual(fs.readFileSync(file), settledBytes);
  const invalidQueue = ports.lease.reconcileOperationOwnerLoss(
    "other-project",
    "queue-a",
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
    fs.readdirSync(path.join(root, ".crdd", "domain-model")).sort(),
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
  const created = fixture(t);
  const root = created.root;
  let state = created.state;
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      state as ProjectExecutionState,
      0,
    ).status,
    "completed",
  );
  const reserved = reserveProjectTaskStart(
    state,
    state.generation,
    "task-a",
    "attempt-a",
    "authority-a",
  );
  assert.ok(reserved.state);
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      reserved.state as ProjectExecutionState,
      state.generation,
    ).status,
    "completed",
  );
  state = reserved.state;
  const prepared = prepareProjectTaskHandoff(
    state,
    state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  );
  assert.ok(prepared.state);
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      prepared.state as ProjectExecutionState,
      state.generation,
    ).status,
    "completed",
  );
  state = prepared.state;
  const started = observeProjectTaskStarted(
    state,
    state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  );
  assert.ok(started.state);
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      started.state as ProjectExecutionState,
      state.generation,
    ).status,
    "completed",
  );
  state = started.state;
  const settled = settleProjectTask(state, state.generation, {
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    authorityBindingId: "authority-a",
    outcome: "completed",
    cleanupConfirmed: true,
    recoveryObligations: [],
    recoveryUnresolved: false,
  });
  assert.ok(settled.state);
  const acceptance = {
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    recoveryId: "recovery-a",
    settlementGeneration: settled.state.generation,
    repositoryBinding: "a".repeat(64),
    resultId: "b".repeat(64),
    consumer: "orchestrator" as const,
  };
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  const bytes = fs.readFileSync(file);
  for (const resultAcceptances of [
    [acceptance],
    [acceptance, { ...acceptance, recoveryId: "recovery-b" }],
    [{ ...acceptance, settlementGeneration: settled.state.generation + 1 }],
    [{ ...acceptance, extra: true }],
  ]) {
    const candidate: unknown = {
      ...settled.state,
      tasks: settled.state.tasks.map((task) => ({
        ...task,
        resultAcceptances,
      })),
    };
    assert.equal(
      saveProjectExecutionState(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
        candidate as ProjectExecutionState,
        state.generation,
      ).status,
      "blocked",
      "退役した受領fieldを現行Task契約へ混入させない",
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
  }
  assert.equal(
    saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      settled.state as ProjectExecutionState,
      state.generation,
    ).status,
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
  const repositoryRootHash = fixtureRepositoryHash(root);
  const payload = {
    schema: "crdd-execution-model/project-snapshot/v7",
    schemaRevision: 7,
    workspaces: [],
    repositoryRootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  assert.equal(seedSnapshot(root, payload).status, "completed");
  const ports = createCoordinatorSnapshotPersistencePorts(
    root,
    "binding-a",
    "epoch-a",
  );
  const port = ports.state;
  assert.deepEqual(port.readState("project-a").value, state);
  assert.equal(port.readState("project-missing").value, null);
  assert.equal(
    port.writeState(
      { ...state, generation: state.generation + 1 },
      state.generation,
    ).status,
    "completed",
  );
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(port.enqueueOperation(input).status, "completed");
  const current = path.join(root, ".crdd", "domain-model", "state.json");
  const before = fs.readFileSync(current, "utf8");
  assert.equal(port.enqueueOperation(input).status, "completed");
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(
    port.enqueueOperation({ ...input, requestHash: "d".repeat(64) }).status,
    "blocked",
  );
  const retired = createCoordinatorSnapshotPersistencePorts(
    root,
    "binding-a",
    "old-epoch",
  ).state;
  assert.equal(
    retired.enqueueOperation({ ...input, queueId: "queue-retired" }).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(
    port.enqueueOperation({
      ...input,
      queueId: "queue-i",
      originLane: "interactive",
    }).status,
    "completed",
  );
  assert.equal(port.selectNextOperation().value?.queueId, "queue-i");
  assert.equal(port.readQueue("queue-a").value?.state, "waiting_foreground");
  const acquired = ports.lease.acquire(
    "project-a",
    "queue-i",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("fixture_lease_failed");
  let released = false;
  try {
    assert.equal(
      port.updateQueue("queue-i", 1, {
        state: "leased",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "blocked",
    );
    assert.equal(
      port.updateQueue("queue-i", 1, {
        state: "leased",
        lease: acquired.value,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "completed",
    );
    assert.equal(port.selectNextOperation().value, null);
    assert.equal(
      port.updateQueue("queue-i", 2, {
        state: "running",
        lease: acquired.value,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "completed",
    );
    assert.equal(
      port.updateQueue("queue-i", 3, {
        state: "recovery_required",
        lease: acquired.value,
        resumeCondition: "exact_recovery",
        resultReference: "recovery-a",
      }).status,
      "completed",
    );
    assert.equal(
      port.settleQueueLeaseRelease("queue-i", 4, acquired.value.ownerGeneration)
        .status,
      "blocked",
    );
    assert.equal(acquired.value.release().status, "completed");
    released = true;
    const settled = port.settleQueueLeaseRelease(
      "queue-i",
      4,
      acquired.value.ownerGeneration,
    );
    assert.equal(settled.status, "completed");
    assert.equal(settled.value?.ownerGeneration, null);
    assert.equal(
      port.settleQueueRecovery("queue-i", 5, "different-recovery").status,
      "blocked",
    );
    const resumed = port.settleQueueRecovery("queue-i", 5, "recovery-a");
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.value?.resumeCondition, "exact_recovery_settled");
    assert.equal(
      port.updateQueue("queue-i", 6, {
        state: "cancelled",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "completed",
    );
    const scheduled = port.selectNextOperation();
    assert.equal(scheduled.value?.queueId, "queue-a");
    assert.equal(scheduled.value?.state, "queued");
    assert.equal(scheduled.value?.generation, 3);
    assert.equal(
      port.updateQueue("queue-a", 1, {
        state: "cancelled",
        lease: null,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "blocked",
    );
    assert.equal(port.readQueue("queue-missing").status, "blocked");
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
    verifyRuntimePersistenceRepository(root),
    "binding-a",
  );
  assert.equal(initial.status, "completed");
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  const queue = ports.state.enqueueOperation({
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled",
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  });
  assert.equal(queue.status, "completed");
  if (queue.status !== "completed") throw new Error("queue_fixture_failed");
  const lease = ports.lease.acquire(
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
    if (observed.value.schema !== "crdd-execution-model/project-snapshot/v7")
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
          contract: "crdd-coordinator/orchestrator-integration/v1",
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
        verifyRuntimePersistenceRepository(root),
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
    const current = path.join(root, ".crdd", "domain-model", "state.json");
    const before = fs.readFileSync(current, "utf8");
    assert.deepEqual(readFixtureSnapshot(root, "binding-a").value, payload);
    const next = { ...payload, snapshotRevision: payload.snapshotRevision + 1 };
    const pendingPayload = { ...next, repositoryRootHash: rootHash };
    const pending = `${JSON.stringify({ payload: pendingPayload, contentHash: createHash("sha256").update(JSON.stringify(pendingPayload)).digest("hex"), baseRevision: payload.snapshotRevision, baseHash: "0".repeat(64) })}\n`;
    const pendingPath = path.join(
      root,
      ".crdd",
      "domain-model",
      "state.pending.json",
    );
    fs.writeFileSync(pendingPath, pending);
    const updatedState = { ...state, generation: state.generation + 1 };
    assert.equal(
      saveProjectExecutionState(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
        updatedState as ProjectExecutionState,
        state.generation,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), before);
    assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);
    fs.unlinkSync(pendingPath);
    const changed = saveProjectExecutionState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      updatedState as ProjectExecutionState,
      state.generation,
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
        verifyRuntimePersistenceRepository(root),
        "binding-a",
        updatedState as ProjectExecutionState,
        state.generation,
      ).status,
      "completed",
    );
    assert.equal(fs.readFileSync(current, "utf8"), savedBytes);
    const additional = { ...state, projectId: "project-b", generation: 1 };
    assert.equal(
      saveProjectExecutionState(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
        additional as ProjectExecutionState,
        0,
      ).status,
      "completed",
    );
    assert.deepEqual(readFixtureSnapshot(root, "binding-a").value, {
      ...expected,
      snapshotRevision: payload.snapshotRevision + 2,
      projects: [updatedState, additional],
    });
    const previousBytes = fs.readFileSync(current, "utf8");
    const rename = t.mock.method(fs, "renameSync", () => {
      throw new Error("state_update_rename_injected");
    });
    try {
      const interrupted = saveProjectExecutionState(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
        {
          ...updatedState,
          generation: updatedState.generation + 1,
        } as ProjectExecutionState,
        updatedState.generation,
      );
      assert.equal(interrupted.status, "blocked");
      assert.equal(interrupted.manualRecoveryRequired, true);
    } finally {
      rename.mock.restore();
    }
    assert.equal(fs.readFileSync(current, "utf8"), previousBytes);
    assert.ok(fs.existsSync(pendingPath));
    const reacquired = readState(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
      "execution",
    );
    assert.equal(reacquired.status, "blocked");
    // この理由はKernel取得後のpending拒否だけ。競合・解放不明とは区別する。
    assert.equal(reacquired.reason, "coordinator_state_reentry_required");
  } finally {
    const pending = path.join(
      root,
      ".crdd",
      "domain-model",
      "state.pending.json",
    );
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
    const marker = path.join(root, ".crdd", "domain-model", "state.lock");
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
  return path.join(root, ".crdd", "domain-model", "state", "project-a");
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
  return path.join(root, ".crdd", "domain-model", "queues", "queue-a");
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
  const created = createCoordinatorState({
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
 * @stimulus 明示初期化、State保存とQueue受付を実行する。
 * @observation 各保存結果と現行Portを取得する。
 * @oracle すべてcompletedで、呼出し元が現行Leaseを取得できる。
 * @cleanup 呼出し元のfixture hookが自己所有Rootを回収する。
 * @boundary 子Process試験の入力準備から現在Snapshot保存。
 */
function currentQueueFixture(t: test.TestContext, binding = "binding-a") {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(verifyRuntimePersistenceRepository(root), binding)
      .status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, binding);
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  return { root, ports };
}

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
    root: verified.capability,
    principalId: "test-principal",
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
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  const before = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(before.managedExecutions.length, 1);
  assert.equal(before.queueEntries.length, 1);
  const history = path.join(root, ".crdd", "domain-model", "history.jsonl");
  const occurredAt = "2026-10-28T00:00:00.000Z";
  const historyBytes = Buffer.from(
    `${canonicalJson({ schema: "crdd-coordinator/history-row/v2", occurredAt, summary: { schema: "crdd-coordinator/task-summary/v1", record: { id: "synthetic-history", occurredAt, outcome: "completed", primaryFailure: null, cleanup: "confirmed" } } })}\n`,
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
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  const write = ports.state.writeState(state, 0);
  assert.equal(write.status, "completed");
  assert.ok(write.value);
  const selections = write.value.taskExecutionSelections;
  assert.equal(Object.isFrozen(selections), true);
  assert.equal(Object.isFrozen(selections.executor), true);
  assert.equal(Object.isFrozen(selections.reviewer), true);
  assert.equal(projectState(write.value).taskExecutionSelections, selections);
  const read = ports.state.readState("project-a");
  assert.equal(read.status, "completed");
  assert.deepEqual(read.value, state);

  const target = path.join(root, ".crdd", "domain-model", "state.json");
  const before = fs.readFileSync(target);
  const replay = ports.state.writeState(state, 0);
  assert.equal(replay.status, "completed");
  assert.equal(Object.isFrozen(replay.value?.taskExecutionSelections), true);
  assert.deepEqual(fs.readFileSync(target), before);
  const stale = ports.state.writeState(
    {
      ...state,
      milestone: {
        ...state.milestone,
        acceptanceCriteria: ["different candidate"],
      },
    },
    0,
  );
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "orchestrator_state_generation_conflict");
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal(fs.existsSync(stateDirectory(root)), false);
});

/**
 * Repository RootとBindingを構成時に閉じたState／Lease Portを返すを検証する。
 *
 * @responsibility Repository RootとBindingを構成時に閉じたState／Lease Portを返すの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository RootとBindingを構成時に閉じたState／Lease Portを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Repository RootとBindingを構成時に閉じたState／Lease Portを返す", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState.length, 3);
  assert.equal(ports.state.readState.length, 1);
  assert.equal(ports.lease.acquire.length, 3);
  const write = ports.state.writeState(state, 0);
  assert.equal(write.status, "completed");
  const read = ports.state.readState("project-a");
  assert.equal(read.status, "completed");
  assert.deepEqual(read.value, state);
});

/**
 * PR-D-A-01 rejects corrupt or semantically invalid durable stateを検証する。
 *
 * @responsibility PR-D-A-01 rejects corrupt or semantically invalid durable stateの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 rejects corrupt or semantically invalid durable stateの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 rejects corrupt or semantically invalid durable state", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  const record = path.join(root, ".crdd", "domain-model", "state.json");
  const original = JSON.parse(fs.readFileSync(record, "utf8")) as Record<
    string,
    unknown
  >;
  fs.writeFileSync(record, "{}\n", "utf8");
  const corruptBytes = fs.readFileSync(record);
  const read = ports.state.readState("project-a");
  assert.equal(read.status, "blocked");
  assert.equal(read.reason, "coordinator_state_read_unconfirmed");
  assert.equal(read.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(record), corruptBytes);

  const rewritten = { ...original };
  const payload = rewritten as { projects: unknown[] };
  payload.projects[0] = {
    contract: "crdd-execution-model/project-state/v3",
  };
  fs.writeFileSync(record, `${canonicalJson(rewritten)}\n`, "utf8");
  const invalidBytes = fs.readFileSync(record);
  assert.equal(
    ports.state.readState("project-a").reason,
    "coordinator_state_read_unconfirmed",
  );
  assert.deepEqual(fs.readFileSync(record), invalidBytes);
});

/**
 * PR-D-A-01 rejects impossible Task state and identity tuplesを検証する。
 *
 * @responsibility PR-D-A-01 rejects impossible Task state and identity tuplesの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 rejects impossible Task state and identity tuplesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 rejects impossible Task state and identity tuples", (t) => {
  const cases = [
    {
      name: "running-without-operation",
      mutate(task: Record<string, unknown>) {
        task.state = "running";
        task.startPhase = "running";
        task.attemptId = "attempt-a";
        task.operationId = null;
        task.authorityBindingId = "authority-a";
      },
    },
    {
      name: "handoff-without-operation",
      mutate(task: Record<string, unknown>) {
        task.state = "starting";
        task.startPhase = "handoff_prepared";
        task.attemptId = "attempt-a";
        task.operationId = null;
        task.authorityBindingId = "authority-a";
      },
    },
    {
      name: "ready-with-running-phase",
      mutate(task: Record<string, unknown>) {
        task.state = "ready";
        task.startPhase = "running";
        task.attemptId = null;
        task.operationId = null;
        task.authorityBindingId = null;
      },
    },
  ] as const;

  for (const item of cases) {
    const { root, state } = fixture(t);
    assert.equal(
      initializeExecutionStore(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
      ).status,
      "completed",
    );
    const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
    assert.equal(
      ports.state.writeState(state, 0).status,
      "completed",
      item.name,
    );
    const location = path.join(root, ".crdd", "domain-model", "state.json");
    const envelope = JSON.parse(fs.readFileSync(location, "utf8")) as {
      projects: { tasks: Record<string, unknown>[] }[];
      contentHash: string;
    };
    const task = envelope.projects[0]?.tasks[0];
    if (!task) throw new Error("fixture_task_missing");
    item.mutate(task);
    fs.writeFileSync(location, `${canonicalJson(envelope)}\n`, "utf8");

    const invalidBytes = fs.readFileSync(location);
    const observed = ports.state.readState("project-a");
    assert.equal(observed.status, "blocked", item.name);
    assert.equal(
      observed.reason,
      "coordinator_state_read_unconfirmed",
      item.name,
    );
    assert.equal(observed.manualRecoveryRequired, true, item.name);
    assert.deepEqual(fs.readFileSync(location), invalidBytes, item.name);
  }
});

/**
 * 現行保存Envelopeの破損と未確定pendingを拒否する。
 *
 * @responsibility 固定された現在保存形式を満たさない入力を停止し、既存bytesを保全する。
 * @trace PRL-IT-012
 * @precondition 明示初期化後のStateが単一state.jsonへ保存済みである。
 * @stimulus 必須欄欠落・未知欄・不正Schema・Hash破損・不正改訂番号・未確定pendingを注入する。
 * @observation Readerの結果と現在File、pendingのbytesを取得する。
 * @oracle 全反例をblockedとして返し、不正入力を修復や成功へ畳まず保存を変更しない。
 * @cleanup fixture hookが自己所有Rootを清掃する。
 * @boundary 現行Snapshot ReaderとRepository-local保存境界。
 */
test("PR-D-A-01 現行Envelope破損と未確定pendingを拒否して保全する", (t) => {
  for (const mode of [
    "extra-field",
    "missing-base",
    "unknown-schema",
    "negative-revision",
    "invalid-hash",
    "pending-residue",
  ] as const) {
    const { root, state } = fixture(t);
    assert.equal(
      initializeExecutionStore(
        verifyRuntimePersistenceRepository(root),
        "binding-a",
      ).status,
      "completed",
      mode,
    );
    const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
    assert.equal(ports.state.writeState(state, 0).status, "completed", mode);
    const directory = path.join(root, ".crdd", "domain-model");
    const location = path.join(directory, "state.json");
    const pending = path.join(directory, "state.pending.json");
    const envelope = JSON.parse(fs.readFileSync(location, "utf8"));
    if (mode === "extra-field") envelope.unexpected = true;
    else if (mode === "missing-base") delete envelope.previous;
    else if (mode === "unknown-schema") envelope.schema = "unknown";
    else if (mode === "negative-revision") envelope.revision = -1;
    else if (mode === "invalid-hash")
      envelope.previous.payloadSha256 = "invalid";
    else fs.writeFileSync(pending, "unconfirmed", "utf8");
    if (mode !== "pending-residue")
      fs.writeFileSync(location, `${canonicalJson(envelope)}\n`, "utf8");
    const before = fs.readFileSync(location);
    const pendingBefore =
      mode === "pending-residue" ? fs.readFileSync(pending) : null;
    const names = fs.readdirSync(directory).sort();
    const observed = ports.state.readState("project-a");
    assert.equal(observed.status, "blocked", mode);
    assert.equal(observed.manualRecoveryRequired, true, mode);
    assert.deepEqual(fs.readFileSync(location), before, mode);
    assert.deepEqual(fs.readdirSync(directory).sort(), names, mode);
    if (pendingBefore)
      assert.deepEqual(fs.readFileSync(pending), pendingBefore, mode);
  }
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
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(ports.state.enqueueOperation(input).status, "completed");
  const location = path.join(root, ".crdd", "domain-model", "state.json");
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
  const result = ports.state.enqueueOperation(input);
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
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  const commonFields = {
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    ports.state.enqueueOperation({
      ...commonFields,
      queueId: "queue-a",
      projectId: "project-a",
    }).status,
    "completed",
  );
  const location = path.join(root, ".crdd", "domain-model", "state.json");
  const before = fs.readFileSync(location);
  const selectedA = ports.state.selectNextOperation();
  const selectedB = readFixtureSnapshot(root, "binding-b");
  assert.equal(selectedA.status, "completed");
  assert.equal(selectedA.value?.queueId, "queue-a");
  assert.equal(selectedB.status, "blocked");
  assert.equal(selectedB.reason, "orchestrator_snapshot_binding_invalid");
  assert.deepEqual(fs.readFileSync(location), before);
  assert.throws(
    () => createCurrentCoordinatorPersistencePorts(root, "binding-b"),
    /orchestrator_snapshot_not_initialized/u,
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
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const created = ports.state.enqueueOperation(input);
  assert.equal(created.reason, "orchestrator_queue_entry_durable");
  const observed = ports.state.enqueueOperation(input);
  assert.equal(observed.reason, "orchestrator_queue_request_reused");
  assert.equal(created.status, "completed");
  assert.equal(observed.status, "completed");
  if (created.status !== "completed" || observed.status !== "completed")
    throw new Error("queue_observation_failed");
  assert.deepEqual(observed.value, created.value);
  assert.equal(fs.existsSync(queueDirectory(root)), false);
  const conflict = ports.state.enqueueOperation({
    ...input,
    requestHash: "d".repeat(64),
  });
  assert.equal(conflict.status, "blocked");
  assert.equal(conflict.reason, "orchestrator_queue_identity_conflict");

  const missingLease = ports.state.updateQueue("queue-a", 1, {
    state: "leased",
    lease: null,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(missingLease.reason, "orchestrator_queue_lease_invalid");
  const fabricatedLease = ports.state.updateQueue("queue-a", 1, {
    state: "leased",
    lease: {
      kind: "project-operation",
      ownerGeneration: "fabricated-owner",
      release: () => ({
        status: "completed" as const,
        reason: "fabricated",
        value: { released: true as const },
      }),
    },
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(fabricatedLease.reason, "orchestrator_queue_lease_invalid");
  const acquired = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = ports.state.updateQueue("queue-a", 1, {
    state: "leased",
    lease: acquired.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  const stale = ports.state.updateQueue("queue-a", 1, {
    state: "running",
    lease: acquired.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(stale.reason, "orchestrator_queue_generation_conflict");
  const wrongQueueLease = ports.lease.acquire(
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "orchestrator_lease_binding_invalid");
  assert.equal(acquired.value.release().status, "completed");
  const releasedLease = ports.state.updateQueue("queue-a", 2, {
    state: "running",
    lease: acquired.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(releasedLease.reason, "orchestrator_queue_lease_invalid");
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
          verifyRuntimePersistenceRepository(root),
          "binding-a",
        ).status,
        "completed",
      );
      const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
      assert.equal(ports.state.writeState(state, 0).status, "completed");
      const input = {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: "b".repeat(64),
        originLane: "scheduled" as const,
        repositoryRevision: "a".repeat(40),
        scopeHash: "c".repeat(64),
      };
      assert.equal(ports.state.enqueueOperation(input).status, "completed");
      const lease = ports.lease.acquire(
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(lease.status, "completed");
      if (lease.status !== "completed") throw new Error("lease_fixture_failed");
      const location = path.join(root, ".crdd", "domain-model", "state.json");
      let original: Buffer | null = null;
      try {
        assert.equal(
          ports.state.updateQueue("queue-a", 1, {
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
            ? ports.state.enqueueOperation(input)
            : ports.state.updateQueue("queue-a", 2, {
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
 * PR-D-Q-01 serializes operation and project-scoped adoption leasesを検証する。
 *
 * @responsibility PR-D-Q-01 serializes operation and project-scoped adoption leasesの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-Q-01 serializes operation and project-scoped adoption leasesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-Q-01 serializes operation and project-scoped adoption leases", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "interactive",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const first = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  const duplicate = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(duplicate.status, "blocked");
  assert.equal(duplicate.reason, "orchestrator_lease_unavailable");
  const adoption = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(adoption.status, "completed");
  const crossQueueAdoption = ports.lease.acquire(
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(crossQueueAdoption.status, "blocked");
  assert.equal(crossQueueAdoption.reason, "orchestrator_lease_binding_invalid");
  const duplicateAdoption = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(duplicateAdoption.status, "blocked");
  assert.equal(duplicateAdoption.reason, "orchestrator_lease_unavailable");
  if (first.status !== "completed" || adoption.status !== "completed")
    throw new Error("lease_fixture_failed");
  assert.equal(first.value.release().status, "completed");
  assert.equal(
    first.value.release().reason,
    "orchestrator_lease_already_released",
  );
  assert.equal(adoption.value.release().status, "completed");
  const reacquired = ports.lease.acquire(
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
      verifyRuntimePersistenceRepository(root),
      "binding-a",
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState(state, 0).status, "completed");
  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "interactive",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const acquired = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const directory = path.join(root, ".crdd", "domain-model");
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
  assert.equal(released.reason, "orchestrator_lease_release_unknown");
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
  const reacquired = ports.lease.acquire(
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
  const moduleUrl = new URL("../../src/execution/lease.ts", import.meta.url)
    .href;
  execFileSync(
    process.execPath,
    [
      "--eval",
      `import { acquireCoordinatorSnapshotLease } from ${JSON.stringify(moduleUrl)};
import { createCurrentCoordinatorPersistencePorts } from ${JSON.stringify(new URL("../../src/state/transaction.ts", import.meta.url).href)};
const lease = acquireCoordinatorSnapshotLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") { process.stdout.write(JSON.stringify({ status: lease.status, reason: lease.reason, manualRecoveryRequired: lease.manualRecoveryRequired })); process.exit(20); }
const queued = createCurrentCoordinatorPersistencePorts(${JSON.stringify(root)}, "binding-a").state.updateQueue("queue-a", 1, { state: "leased", lease: lease.value, resumeCondition: null, resultReference: null });
if (queued.status !== "completed") process.exit(21);`,
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const before = ports.state.readQueue("queue-a");
  assert.equal(before.status, "completed");
  assert.equal(before.status === "completed" && before.value.state, "leased");
  let observedOwnerProcessId = 0;
  const recovered = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
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
    recovered.status === "completed" && recovered.value.state,
    "recovery_required",
  );
  assert.equal(
    recovered.status === "completed" && recovered.value.ownerGeneration,
    null,
  );
  assert.equal(
    recovered.status === "completed" && recovered.value.resumeCondition,
    "owner_loss",
  );
  const reacquired = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
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
  const moduleUrl = new URL("../../src/execution/lease.ts", import.meta.url)
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
  const current = path.join(root, ".crdd", "domain-model", "state.json");
  const acquiredSnapshot = JSON.parse(fs.readFileSync(current, "utf8"));
  const recoveryId = acquiredSnapshot.leaseIntents[0].recoveryId;
  const locks = path.join(root, ".crdd", "lock");
  assert.equal(fs.readdirSync(locks).length, 1);
  const blockedAcquire = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "orchestrator_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  let observedOwnerProcessId = 0;
  const recovered = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
    (owner) => {
      observedOwnerProcessId = owner.ownerProcessId;
      return { status: "absent", ...owner };
    },
  );
  assert.equal(recovered.status, "completed");
  assert.notEqual(observedOwnerProcessId, process.pid);
  assert.deepEqual(fs.readdirSync(locks), []);
  const queue = ports.state.readQueue("queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.value?.state, "queued");
  assert.equal(queue.value?.ownerGeneration, null);
  assert.equal(queue.value?.resultReference, recoveryId);
  const bytes = fs.readFileSync(current);
  const resumedSettlement = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
    () => {
      throw new Error("settled_owner_must_not_be_observed_again");
    },
  );
  assert.equal(resumedSettlement.status, "completed");
  assert.equal(resumedSettlement.value?.generation, queue.value?.generation);
  assert.deepEqual(fs.readFileSync(current), bytes);
  const after = readFixtureSnapshot(root, "binding-a");
  assert.equal(after.status, "completed");
  assert.equal(after.value?.leaseIntents.length, 0);
  const reacquired = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * PR-A-04 recovers canonical-adoption acquisition across Queue callersを検証する。
 *
 * @responsibility PR-A-04 recovers canonical-adoption acquisition across Queue callersの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 recovers canonical-adoption acquisition across Queue callersの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 recovers canonical-adoption acquisition across Queue callers", (t) => {
  const { root, ports } = currentQueueFixture(t);
  const moduleUrl = new URL("../../src/execution/lease.ts", import.meta.url)
    .href;
  execFileSync(
    process.execPath,
    [
      "--eval",
      `import { acquireCoordinatorSnapshotLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireCoordinatorSnapshotLease(${JSON.stringify(root)}, "binding-a", "project-a", "canonical", "canonical-adoption");
if (lease.status !== "completed") { process.stdout.write(JSON.stringify({status: lease.status, reason: lease.reason})); process.exit(20); }`,
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const current = path.join(root, ".crdd", "domain-model", "state.json");
  const before = JSON.parse(fs.readFileSync(current, "utf8"));
  const recoveryId = before.leaseIntents[0].recoveryId;
  const blockedAcquire = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "orchestrator_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  const recovered = ports.lease.reconcileAdoptionOwnerLoss(
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.recoveryId, recoveryId);
  const after = readFixtureSnapshot(root, "binding-a");
  assert.equal(after.status, "completed");
  assert.equal(after.value?.leaseIntents.length, 0);
  assert.equal(after.value?.queueEntries[0]?.state, "queued");
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd", "lock")), []);
  const reacquired = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
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
    [
      probe,
      root,
      signal,
      "hold",
      "canonical-adoption",
      "canonical",
      "project-a",
    ],
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
    const statePath = path.join(root, ".crdd", "domain-model", "state.json");
    const before = fs.readFileSync(statePath);
    const contender = ports.lease.acquire(
      "project-a",
      "canonical",
      "canonical-adoption",
    );
    assert.equal(contender.status, "blocked");
    assert.equal(contender.reason, "orchestrator_lease_unavailable");
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
      "canonical-adoption",
      "canonical",
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
    const statePath = path.join(root, ".crdd", "domain-model", "state.json");
    const before = fs.readFileSync(statePath);
    const snapshot = readFixtureSnapshot(root, "binding-a");
    assert.equal(snapshot.status, "completed");
    const recoveryId = snapshot.value?.leaseIntents[0]?.recoveryId;
    assert.equal(typeof recoveryId, "string");
    const contender = ports.lease.acquire(
      "project-a",
      "canonical",
      "canonical-adoption",
    );
    assert.equal(contender.status, "blocked");
    assert.equal(contender.reason, "orchestrator_lease_unavailable");
    assert.equal(contender.manualRecoveryRequired, false);
    assert.equal(contender.recoveryId, null);
    assert.deepEqual(fs.readFileSync(statePath), before);
    child.kill();
    await closed;
    const recovered = ports.lease.reconcileAdoptionOwnerLoss(
      "project-a",
      (owner) => ({ status: "absent", ...owner }),
    );
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.value?.recoveryId, recoveryId);
    const reacquired = ports.lease.acquire(
      "project-a",
      "canonical",
      "canonical-adoption",
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
      if (
        !isInjected &&
        String(args[0]).includes("coordinator.lease.") &&
        String(args[0]).endsWith(".lock")
      ) {
        isInjected = true;
        throw new Error("injected_physical_lease_readback_failure");
      }
      return Reflect.apply(original, fs, args);
    },
  );
  let failed: ReturnType<typeof ports.lease.acquire>;
  try {
    failed = ports.lease.acquire(
      "project-a",
      "canonical",
      "canonical-adoption",
    );
  } finally {
    mock.mock.restore();
  }
  assert.equal(isInjected, true);
  assert.equal(failed.status, "blocked");
  assert.equal(
    failed.reason,
    "orchestrator_lease_acquisition_recovery_required",
  );
  assert.equal(failed.manualRecoveryRequired, true);
  const before = readFixtureSnapshot(root, "binding-a");
  assert.equal(before.status, "completed");
  assert.equal(before.value?.leaseIntents[0]?.phase, "acquisition_reserved");
  assert.equal(before.value?.leaseIntents[0]?.recoveryId, failed.recoveryId);
  assert.match(failed.recoveryId ?? "", /^lease-acquisition-[0-9a-f]{40}$/u);
  const locks = path.join(root, ".crdd", "lock");
  assert.equal(fs.readdirSync(locks).length, 1);
  const recovered = ports.lease.reconcileAdoptionOwnerLoss(
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.recoveryId, failed.recoveryId);
  assert.deepEqual(fs.readdirSync(locks), []);
  assert.equal(
    readFixtureSnapshot(root, "binding-a").value?.leaseIntents.length,
    0,
  );
  const reacquired = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
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
  const acquired = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
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
  const recovered = ports.lease.reconcileAdoptionOwnerLoss(
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.recoveryId, failed.recoveryId);
  assert.equal(fs.existsSync(lock), false);
  assert.equal(
    readFixtureSnapshot(root, "binding-a").value?.leaseIntents.length,
    0,
  );
  const reacquired = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
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
  const moduleUrl = new URL("../../src/execution/lease.ts", import.meta.url)
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
  const recovered = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.value?.resultReference, recoveryId);
  const after = readFixtureSnapshot(root, "binding-a");
  assert.equal(after.value?.leaseIntents.length, 0);
  assert.equal(after.value?.queueEntries[0]?.state, "queued");
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd", "lock")), []);
  const reacquired = ports.lease.acquire(
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
    const lease = ports.lease.acquire(
      "project-a",
      "canonical",
      "canonical-adoption",
    );
    assert.equal(lease.status, "completed");
    if (lease.status !== "completed") throw new Error("lease_fixture_failed");
    const location = path.join(root, ".crdd", "domain-model", "state.json");
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
    const result = ports.lease.reconcileAdoptionOwnerLoss(
      "project-a",
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
    const initial = ports.lease.acquire(
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
    const directory = path.join(root, ".crdd", "domain-model");
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
    const result = ports.lease.acquire(
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(result.status, "blocked", scenario);
    assert.equal(
      result.reason,
      scenario === "existing-lock"
        ? "orchestrator_lease_preexisting_resource"
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
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = ports.state.updateQueue("queue-a", 1, {
    state: "leased",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  const running = ports.state.updateQueue("queue-a", 2, {
    state: "running",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(running.status, "completed");
  const terminalIntent = ports.state.updateQueue("queue-a", 3, {
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
  const location = path.join(root, ".crdd", "domain-model", "state.json");
  const before = fs.readFileSync(location);
  assert.equal(
    ports.state.settleQueueLeaseRelease(
      "queue-a",
      4,
      lease.value.ownerGeneration,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(location), before);
  assert.equal(lease.value.release().status, "completed");
  const releasedQueue = ports.state.readQueue("queue-a");
  assert.equal(
    releasedQueue.value?.ownerGeneration,
    lease.value.ownerGeneration,
  );
  const settled = ports.state.settleQueueLeaseRelease(
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
    ports.state.enqueueOperation({
      queueId: "queue-long-recovery",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "interactive",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-long-recovery",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = ports.state.updateQueue("queue-long-recovery", 1, {
    state: "leased",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(leased.status, "completed");
  const running = ports.state.updateQueue("queue-long-recovery", 2, {
    state: "running",
    lease: lease.value,
    resumeCondition: null,
    resultReference: null,
  });
  assert.equal(running.status, "completed");
  const recoveryRequired = ports.state.updateQueue("queue-long-recovery", 3, {
    state: "recovery_required",
    lease: lease.value,
    resumeCondition: "runtime_recovery",
    resultReference: recoveryId,
  });
  assert.equal(recoveryRequired.status, "completed");
  assert.equal(
    recoveryRequired.status === "completed" &&
      recoveryRequired.value.resultReference,
    recoveryId,
  );
  assert.equal(lease.value.release().status, "completed");
  const settled = ports.state.settleQueueLeaseRelease(
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
test("PR-A-04 reconciles a released terminal intent after owner settlement was interrupted", (t) => {
  const { ports } = currentQueueFixture(t);
  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = ports.state.updateQueue("queue-a", generation, {
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
  const reconciled = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
    () => {
      observerCalls += 1;
      return null;
    },
  );
  assert.equal(reconciled.status, "completed");
  assert.equal(observerCalls, 0);
  assert.equal(
    reconciled.status === "completed" && reconciled.value.state,
    "integration_pending",
  );
  assert.equal(
    reconciled.status === "completed" && reconciled.value.ownerGeneration,
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
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = ports.state.updateQueue("queue-a", generation, {
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
  const location = path.join(root, ".crdd", "domain-model", "state.json");
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
  const settlement = ports.state.settleQueueLeaseRelease(
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
  assert.equal(ports.state.readQueue("queue-a").status, "blocked");
  const missing = JSON.parse(originalBytes.toString("utf8"));
  missing.leaseEvidence = missing.leaseEvidence.filter(
    (item: { content: { disposition: string } }) =>
      item.content.disposition !== "released",
  );
  fs.writeFileSync(location, `${canonicalJson(missing)}\n`, "utf8");
  const missingBytes = fs.readFileSync(location);
  let observations = 0;
  const retry = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
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
    ports.state.settleQueueLeaseRelease(
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
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    ports.state.updateQueue("queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  const location = path.join(root, ".crdd", "domain-model", "state.json");
  const originalBytes = fs.readFileSync(location);
  const record = JSON.parse(originalBytes.toString("utf8"));
  const acquired = record.leaseEvidence[0];
  record.leaseEvidence.push({ ...acquired, content: {} });
  fs.writeFileSync(location, `${canonicalJson(record)}\n`, "utf8");
  const before = fs.readFileSync(location);
  const locks = path.join(root, ".crdd", "lock");
  const names = fs.readdirSync(locks);
  const result = ports.lease.reconcileOperationOwnerLoss(
    "project-a",
    "queue-a",
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
  const location = path.join(root, ".crdd", "domain-model", "state.json");
  assert.equal(
    ports.state.enqueueOperation({
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    }).status,
    "completed",
  );
  const lease = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    ports.state.updateQueue("queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  for (const status of ["alive", "unknown"] as const) {
    const before = fs.readFileSync(location);
    const outcome = ports.lease.reconcileOperationOwnerLoss(
      "project-a",
      "queue-a",
      (owner) => ({ ...owner, status }),
    );
    assert.equal(outcome.status, "blocked");
    assert.equal(
      outcome.reason,
      status === "alive"
        ? "orchestrator_lease_owner_still_active"
        : "orchestrator_lease_owner_observation_unknown",
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
  assert.equal(ports.state.enqueueOperation(input).status, "completed");
  const lease = ports.lease.acquire(
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    ports.state.updateQueue("queue-a", 1, {
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
    const result = ports.state.updateQueue("queue-a", 2, {
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
    assert.equal(result.reason, "orchestrator_queue_lease_invalid", state);
  }
  const fabricated = ports.state.updateQueue("queue-a", 2, {
    state: "replan_required",
    lease: {
      kind: "project-operation",
      ownerGeneration: lease.value.ownerGeneration,
      release: lease.value.release,
    },
    resumeCondition: "resume-a",
    resultReference: null,
  });
  assert.equal(fabricated.reason, "orchestrator_queue_lease_invalid");
  const wrongQueueLease = ports.lease.acquire(
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "orchestrator_lease_binding_invalid");
  assert.equal(ports.state.readQueue("queue-a").value?.generation, 2);
  assert.equal(fs.existsSync(queueDirectory(root)), false);
  assert.equal(
    ports.state.updateQueue("queue-a", 2, {
      state: "recovery_required",
      lease: lease.value,
      resumeCondition: "recover-a",
      resultReference: null,
    }).status,
    "completed",
  );
  assert.equal(lease.value.release().status, "completed");
  assert.equal(
    ports.state.updateQueue("queue-a", 3, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).reason,
    "orchestrator_queue_transition_invalid",
  );
  assert.equal(
    ports.state.updateQueue("queue-a", 3, {
      state: "cancelled",
      lease: lease.value,
      resumeCondition: null,
      resultReference: "cancelled-a",
    }).reason,
    "orchestrator_queue_lease_invalid",
  );
  assert.equal(ports.state.readQueue("queue-a").value?.generation, 3);
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
  const old = ports.lease.acquire("project-a", "queue-a", "project-operation");
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
    verifyRuntimePersistenceRepository(root),
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
    verifyRuntimePersistenceRepository(root),
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
    ports.lease.reconcileOperationOwnerLoss(
      "project-a",
      "queue-a",
      (owner) => ({ ...owner, status: "absent" }),
    ).status,
    "completed",
  );
  const next = ports.lease.acquire("project-a", "queue-a", "project-operation");
  assert.equal(next.status, "completed");
  if (next.status !== "completed") throw Error("fixture");
  const nextActive = borrowCoordinatorActiveLease(next.value);
  assert.ok(nextActive);
  const before = fs.readFileSync(nextActive.lock);
  let physicalCalls = 0;
  const delayed = recoverLease(
    verifyRuntimePersistenceRepository(root),
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
    const old = ports.lease.acquire(
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
      verifyRuntimePersistenceRepository(root),
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
      recoverLease(verifyRuntimePersistenceRepository(root), "binding-a", {
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
    const stateFile = path.join(root, ".crdd", "domain-model", "state.json"),
      before = fs.readFileSync(stateFile),
      physical = fs.readFileSync(active.lock);
    let calls = 0;
    const result = recoverLease(
      verifyRuntimePersistenceRepository(root),
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
      ports.lease.acquire("project-a", "queue-a", "project-operation").status,
      "blocked",
      mode,
    );
    assert.equal(
      ports.lease.reconcileOperationOwnerLoss(
        "project-a",
        "queue-a",
        (owner) => ({ ...owner, status: "absent" }),
      ).status,
      "completed",
      mode,
    );
    assert.equal(fs.existsSync(active.lock), false, mode);
  }
});
/**
 * 既存の有効ID域で取得・通常解放・実Process終了後の回復を維持する。
 * @trace PRL-IT-012
 * @oracle 長い単一名・連続dotをTraversalと誤認せず、元世代の回収後に新取得できる。
 * @boundary 自己生成Repositoryと子Processだけ。Fixture hookでRootを回収する。
 */
test("長期Leaseの既存ID域はwx取得・通常解放・Crash回復で維持する", (t) => {
  for (const binding of ["a..b", "b".repeat(120)]) {
    const { root, ports } = currentQueueFixture(t, binding);
    const held = ports.lease.acquire(
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(held.status, "completed");
    if (held.status !== "completed") throw Error("fixture");
    assert.equal(held.value.release().status, "completed");
    const url = new URL("../../src/execution/lease.ts", import.meta.url).href;
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import {acquireCoordinatorSnapshotLease} from ${JSON.stringify(url)};const r=acquireCoordinatorSnapshotLease(${JSON.stringify(root)},${JSON.stringify(binding)},"project-a","queue-a","project-operation");if(r.status!=="completed")process.exit(20);`,
      ],
      { windowsHide: true },
    );
    const recovered = ports.lease.reconcileOperationOwnerLoss(
      "project-a",
      "queue-a",
      (owner) => ({ ...owner, status: "absent" }),
    );
    assert.equal(recovered.status, "completed", JSON.stringify(recovered));
    const next = ports.lease.acquire(
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(next.status, "completed");
    if (next.status === "completed")
      assert.equal(next.value.release().status, "completed");
  }
});

/**
 * 初回保持観測拒否とRepository再検証例外でも元descriptorを終了する。
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
        if (String(args[0]).includes("coordinator.lease.") && args[1] === "wx")
          descriptor = fd;
        return fd;
      },
    );
    const held = ports.lease.acquire(
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
            : new Error().stack?.includes(
                "verifyRuntimePersistenceRepository",
              ) === true;
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
    const recovered = ports.lease.reconcileOperationOwnerLoss(
      "project-a",
      "queue-a",
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
    let result: ReturnType<typeof ports.lease.acquire>;
    try {
      result = ports.lease.acquire("project-a", "queue-a", "project-operation");
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
