/**
 * coordinator:integration:project-runtime-durable-foundationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-durable-foundationが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、durable、foundation
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireProjectRuntimeLease,
  acquireProjectRuntimeSnapshotLease,
  acquireProjectRuntimeSnapshotPilotLock,
  inspectProjectRuntimeSnapshotLeaseAcquisitionOwner,
  reconcileProjectRuntimeSnapshotLeaseOwnerLoss,
  createProjectRuntimePersistencePorts,
  createProjectRuntimeSnapshotPersistencePorts,
  createProjectRuntimeSnapshotAcceptanceDecisionStore,
  createProjectRuntimeSnapshotDecisionRecoveryStore,
  createProjectRuntimeSnapshotIntegrationRecordPort,
  describeProjectRuntimeDurableFoundation,
  decodeProjectRuntimeStateQueueSnapshotPilot,
  encodeProjectRuntimeStateQueueSnapshotPilot,
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  readProjectRuntimeSnapshot,
  readLegacyProjectRuntimeStateAndQueueInputs,
  readLegacyProjectRuntimeLeaseInputs,
  reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss,
  reconcileProjectRuntimeLeaseOwnerLoss,
  selectNextProjectOperation,
  settleProjectOperationQueueLeaseRelease,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
  writeProjectRuntimeSnapshot,
  writeProjectRuntimeSnapshotState,
  initializeProjectRuntimeSnapshot,
  inspectProjectRuntimeSnapshotIntake,
  maintainProjectRuntimeSnapshot,
  createCurrentProjectRuntimePersistencePorts,
} from "../../src/project-runtime/project-runtime-durable-foundation.ts";
import {
  createProjectRuntimeState,
  adoptProjectRuntimeExistingCandidate,
  type ProjectRuntimeState,
  type ProjectRuntimeAcceptanceDecisionRecord,
  type ProjectRuntimeDecisionRecoveryIntent,
} from "../../../project-runtime/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";
import { acquireRuntimeOwnedProjectRuntimeStateKernelLock } from "../../src/host-runtime/candidate-store-kernel-lock.ts";

const MAX_RECORD_BYTES = 16 * 1024 * 1024;

/**
 * 名前付き保存領域の真正不存在を読取りだけで返す。
 * @responsibility Snapshotと旧入力Readerが初期化Effectを発行しないことを判定する。
 * @trace PRL-IT-005
 * @precondition Git Rootだけがある自己所有fixtureを用いる。
 * @stimulus Snapshotと旧State/Queue/Lease入力を読む。
 * @observation 結果とRoot内容、Git exclude bytesを取得する。
 * @oracle 真正不存在を返しDirectoryやIgnore設定を変更しない。
 * @cleanup fixture hookが所有Rootを清掃する。
 * @boundary Repository Runtime Data Owner→foundation Reader。
 */
test("名前付き保存領域の不存在はReader初期化Effectを発行しない", (t) => {
  const { root } = fixture(t);
  const rootNames = fs.readdirSync(root);
  const excludePath = path.join(root, ".git", "info", "exclude");
  const excludeBytes = fs.readFileSync(excludePath);
  const snapshot = readProjectRuntimeSnapshot(root, "binding-a");
  const states = readLegacyProjectRuntimeStateAndQueueInputs(root);
  const leases = readLegacyProjectRuntimeLeaseInputs(root);
  assert.equal(snapshot.status, "completed");
  assert.equal(snapshot.value, null);
  assert.equal(states.status, "completed");
  assert.equal(states.value?.sourceRecords.length, 0);
  assert.equal(leases.status, "completed");
  assert.equal(leases.value?.sourceRecords.length, 0);
  assert.deepEqual(fs.readdirSync(root), rootNames);
  assert.deepEqual(fs.readFileSync(excludePath), excludeBytes);
});

/**
 * 名前付きareaの観測不能を空入力へ変換しない。
 * @responsibility Owner blockedをReaderの停止結果へ接続する。
 * @trace PRL-IT-005
 * @precondition 正常な旧State記録がある自己所有fixtureを用いる。
 * @stimulus project-runtime areaのlstatへEACCESを注入する。
 * @observation 全Readerの状態と既存記録bytesを取得する。
 * @oracle 空入力/absent成功ではなくblockedとなり旧記録不変。
 * @cleanup 注入関数を復元しfixture hookで清掃する。
 * @boundary Runtime Data Ownerの観測障害→foundation Reader。
 */
test("名前付きareaの観測不能はSnapshotと旧入力Readerを停止する", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", state, 0).status,
    "completed",
  );
  const runtime = path.join(root, ".crdd", "project-runtime");
  const location = path.join(stateDirectory(root), "generation-1.json");
  const beforeBytes = fs.readFileSync(location);
  const original = fs.lstatSync;
  Reflect.set(fs, "lstatSync", ((target: fs.PathLike, ...args: unknown[]) => {
    if (String(target) === runtime)
      throw Object.assign(new Error("injected_area_observation_failure"), {
        code: "EACCES",
      });
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  try {
    assert.equal(
      readProjectRuntimeSnapshot(root, "binding-a").status,
      "blocked",
    );
    assert.equal(
      readLegacyProjectRuntimeStateAndQueueInputs(root).status,
      "blocked",
    );
    assert.equal(readLegacyProjectRuntimeLeaseInputs(root).status, "blocked");
  } finally {
    Reflect.set(fs, "lstatSync", original);
  }
  assert.deepEqual(fs.readFileSync(location), beforeBytes);
});

for (const readerKind of ["snapshot", "state", "lease"] as const) {
  /**
   * 空areaでも読取り途中の置換を現在境界の成立へ丸めない。
   * @responsibility 開始と終了の不透明Identityを同じReader結果へ結ぶ。
   * @trace PRL-IT-005
   * @precondition 正規の空project-runtime areaがある。
   * @stimulus 最初の子Path観測時にareaを別物理Directoryへ置換する。
   * @observation Reader結果、新旧areaの内容、置換実行を取得する。
   * @oracle 完全な空入力でもblockedとなりReaderの書込みは0。
   * @cleanup 注入関数を復元しfixture内の新旧areaを清掃する。
   * @boundary Runtime Data境界置換→Snapshot/旧入力Reader。
   */
  test(`名前付き空areaの途中置換は${readerKind}Readerを停止する`, (t) => {
    const { root } = fixture(t);
    const runtime = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        root,
        "project-runtime",
      ),
      "fixture_area_invalid",
    ).directory;
    const prior = path.join(root, "prior-runtime-area");
    const childPath = path.join(
      runtime,
      readerKind === "snapshot"
        ? "state.pending.json"
        : readerKind === "state"
          ? "state"
          : "recovery",
    );
    const original = fs.lstatSync;
    let wasAreaReplaced = false;
    Reflect.set(fs, "lstatSync", ((target: fs.PathLike, ...args: unknown[]) => {
      if (String(target) === childPath && !wasAreaReplaced) {
        wasAreaReplaced = true;
        fs.renameSync(runtime, prior);
        fs.mkdirSync(runtime);
      }
      return Reflect.apply(original, fs, [target, ...args]);
    }) as typeof fs.lstatSync);
    try {
      const result =
        readerKind === "snapshot"
          ? readProjectRuntimeSnapshot(root, "binding-a")
          : readerKind === "state"
            ? readLegacyProjectRuntimeStateAndQueueInputs(root)
            : readLegacyProjectRuntimeLeaseInputs(root);
      assert.equal(wasAreaReplaced, true);
      assert.equal(result.status, "blocked");
    } finally {
      Reflect.set(fs, "lstatSync", original);
    }
    assert.deepEqual(fs.readdirSync(runtime), []);
    assert.deepEqual(fs.readdirSync(prior), []);
  });
}

for (const fault of ["unobservable", "alias"] as const) {
  /**
   * tmpの親境界を確認できないLeaseを削除しない。
   * @responsibility Owner blockedと物理Identity/Recovery Identityの保持を判定する。
   * @trace PRL-IT-012
   * @precondition 新版の実Leaseと取得intentがある。
   * @stimulus tmpの観測不能またはjunction置換後にreleaseを呼ぶ。
   * @observation 停止結果、回復ID、Lock実体と保存bytesを取得する。
   * @oracle 手動回復を要求し同じLockと回復参照を残す。
   * @cleanup 親と注入関数を復元し同じLeaseを解放後fixtureを清掃する。
   * @boundary opaque Lease→Runtime Data Owner→Filesystem cleanup。
   */
  test(`tmp親境界の${fault}はLeaseを不存在にせず削除を拒否する`, (t) => {
    const { root } = fixture(t);
    assert.equal(
      initializeProjectRuntimeSnapshot(root, "binding-a").status,
      "completed",
    );
    const acquired = acquireProjectRuntimeSnapshotLease(
      root,
      "binding-a",
      "project-a",
      "canonical",
      "canonical-adoption",
    );
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("fixture_lease_failed");
    const beforeSnapshot = readProjectRuntimeSnapshot(root, "binding-a").value;
    assert.ok(beforeSnapshot?.schemaRevision === 2);
    const recoveryId = beforeSnapshot.leaseIntents[0]?.recoveryId;
    assert.ok(recoveryId);
    const temporary = path.join(root, ".crdd", "tmp");
    const moved = path.join(root, "prior-temporary-area");
    const locks = path.join(temporary, "project-runtime-leases");
    const names = fs.readdirSync(locks);
    assert.equal(names.length, 1);
    const lockName = names[0];
    assert.ok(lockName);
    const lockPath = path.join(locks, lockName);
    const lockMetadata = fs.lstatSync(lockPath);
    const statePath = path.join(root, ".crdd", "project-runtime", "state.json");
    const beforeBytes = fs.readFileSync(statePath);
    const original = fs.lstatSync;
    if (fault === "alias") {
      fs.renameSync(temporary, moved);
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
    assert.equal(acquired.value.release().status, "completed");
    assert.equal(fs.existsSync(lockPath), false);
  });
}

/**
 * 採用前の既知拒否を実保存と履歴へ接続することを検証する。
 * @responsibility Receiptなしの終了証拠をexact Ownerだけ整理する。
 * @trace PRL-IT-012
 * @precondition 新版保存と別Projectの終了証拠がある。
 * @stimulus dirty観測で採用を拒否し、履歴へ終了を搬送する。
 * @observation 採用回数、結果、証拠と履歴を読む。
 * @oracle Effect 0、失敗要約一件、別Projectの証拠不変。
 * @cleanup fixtureの終了hookで所有Rootを回収する。
 * @boundary 採用Applicationから本番保存Portと実Lease。
 */
test("snapshot production: rejected adoption retires exact evidence without receipt", async (t) => {
  const { root } = fixture(t);
  assert.equal(
    initializeProjectRuntimeSnapshot(root, "binding-a").status,
    "completed",
  );
  const ports = createCurrentProjectRuntimePersistencePorts(root, "binding-a");
  const other = ports.lease.acquire(
    "project-b",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(other.status, "completed");
  if (other.status !== "completed") throw new Error("fixture_lease_failed");
  assert.equal(other.value.release().status, "completed");
  const otherEvidence = readProjectRuntimeSnapshot(root, "binding-a").value
    ?.leaseEvidence;
  let effects = 0;
  const result = await adoptProjectRuntimeExistingCandidate(
    {
      lease: ports.lease,
      records: createProjectRuntimeSnapshotIntegrationRecordPort({
        workingDirectory: root,
        repositoryBindingId: "binding-a",
        projectId: "project-a",
        milestoneId: "candidate",
        queueId: "adoption-a",
      }),
      candidate: {
        observeLeaseOwner: () => ({ status: "not_running" }),
        observeCanonicalRepository: () => ({
          status: "observed",
          repositoryRevision: "a".repeat(40),
          dirty: true,
          observedPaths: ["result.txt"],
        }),
        adoptCandidate: async () => {
          effects += 1;
          throw new Error("must_not_adopt");
        },
      },
    },
    {
      projectId: "project-a",
      adoptionAuthorized: true,
      allowedPaths: ["result.txt"],
      candidate: {
        candidateId: "candidate-a",
        candidateHash: "b".repeat(64),
        baseRevision: "a".repeat(40),
        changedPaths: ["result.txt"],
      },
    },
  );
  assert.equal(
    result.reason,
    "project_runtime_adoption_revision_or_scope_mismatch",
  );
  assert.equal(result.effectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.receiptId, null);
  assert.equal(effects, 0);
  const recorded = readProjectRuntimeSnapshot(root, "binding-a").value;
  assert.ok(recorded?.results[0]);
  assert.equal(
    (recorded.results[0].value as { status: string }).status,
    "rejected",
  );
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 1);
  const closed = readProjectRuntimeSnapshot(root, "binding-a").value;
  assert.equal(closed?.results.length, 0);
  assert.deepEqual(closed?.leaseEvidence, otherEvidence);
  const lines = fs
    .readFileSync(
      path.join(root, ".crdd", "project-runtime", "history.jsonl"),
      "utf8",
    )
    .trim()
    .split("\n");
  assert.equal(JSON.parse(lines[1] ?? "{}").outcome, "failed");
});

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
    initializeProjectRuntimeSnapshot(root, "binding-a").status,
    "completed",
  );
  const ports = createCurrentProjectRuntimePersistencePorts(root, "binding-a");
  const lease = ports.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("fixture_lease_failed");
  assert.equal(lease.value.release().status, "completed");
  const records = createProjectRuntimeSnapshotIntegrationRecordPort({
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
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 1);
  const retained = readProjectRuntimeSnapshot(root, "binding-a").value;
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
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 1);
  const closed = readProjectRuntimeSnapshot(root, "binding-a").value;
  assert.equal(closed?.results.length, 0);
  assert.equal(closed?.leaseEvidence.length, 0);
  assert.equal(closed?.projects.length, 1);
});

/**
 * 公開初期化入口を実Processで通し、Queryや再初期化が世代を作り直さないことを検証する。
 * @responsibility 運用手順と本番の明示初期化を同じ入口へ結合する。
 * @trace PRL-IT-012
 * @precondition 自己所有の新品Repositoryを使う。
 * @stimulus 公開launcherのautomation初期化を二回実行する。
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
   * @stimulus automation project --initialize --jsonを実Processで実行する。
   * @observation 正式JSON応答を解析して返す。
   * @oracle 初回と再実行は同じ受付世代でcompletedとなる。
   * @cleanup 同期子Processは終了まで待ち、親試験がfixtureを回収する。
   * @boundary PRL-IT-012=Direct Boundary: 公開launcher→CLI→Repository保存。
   */
  const invoke = () =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [launcher, "automation", "project", "--initialize", "--json"],
        { cwd: root, windowsHide: true, encoding: "utf8" },
      ),
    );
  const first = invoke();
  const second = invoke();
  assert.equal(first.status, "completed");
  assert.equal(second.status, "completed");
  assert.equal(second.value, first.value);
  assert.deepEqual(
    fs.readdirSync(path.join(root, ".crdd", "project-runtime")),
    ["state.json", "state.lock"],
  );
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
  assert.equal(readProjectRuntimeSnapshot(root, "binding-a").value, null);
  const initialized = initializeProjectRuntimeSnapshot(root, "binding-a");
  assert.equal(initialized.status, "completed");
  assert.equal(
    initializeProjectRuntimeSnapshot(root, "binding-a").value,
    initialized.value,
  );
  const persistence = createCurrentProjectRuntimePersistencePorts(
    root,
    "binding-a",
  );
  const lease = persistence.lease.acquire(
    "project-a",
    "canonical",
    "canonical-adoption",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("adoption_lease_failed");
  assert.equal(lease.value.release().status, "completed");
  const records = createProjectRuntimeSnapshotIntegrationRecordPort({
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
  const snapshot = readProjectRuntimeSnapshot(root, "binding-a");
  assert.equal(snapshot.value?.projects.length, 0);
  assert.equal(snapshot.value?.queueEntries.length, 0);
  assert.equal(snapshot.value?.results.length, 1);
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 1);
  const retired = readProjectRuntimeSnapshot(root, "binding-a");
  assert.equal(retired.value?.results.length, 0);
  assert.equal(retired.value?.leaseEvidence.length, 0);
  assert.equal(retired.value?.intakeEpoch, initialized.value);
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 0);
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
  const initial = initializeProjectRuntimeSnapshot(root, "binding-a");
  if (initial.status !== "completed") throw new Error("bootstrap_failed");
  const epoch = initial.value;
  const ports = createProjectRuntimeSnapshotPersistencePorts(
    root,
    "binding-a",
    epoch,
  );
  const closed: ProjectRuntimeState = {
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
      createProjectRuntimeSnapshotIntegrationRecordPort({
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
    ...(readProjectRuntimeSnapshot(root, "binding-a").value?.leaseEvidence ??
      []),
  );
  const queued = readProjectRuntimeSnapshot(root, "binding-a").value;
  assert.ok(queued);
  const beforeRetirement = fs.readFileSync(
    path.join(root, ".crdd", "project-runtime", "state.json"),
    "utf8",
  );
  assert.equal(
    writeProjectRuntimeSnapshot(
      root,
      "binding-a",
      JSON.stringify({
        ...queued,
        snapshotRevision: queued.snapshotRevision + 1,
        projects: [
          {
            ...closed,
            generation: closed.generation + 1,
            milestone: { ...closed.milestone, id: "milestone-new" },
          },
        ],
      }),
      queued.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.equal(
    fs.readFileSync(
      path.join(root, ".crdd", "project-runtime", "state.json"),
      "utf8",
    ),
    beforeRetirement,
  );
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 1);
  const snapshot = readProjectRuntimeSnapshot(root, "binding-a");
  assert.notEqual(snapshot.value?.intakeEpoch, epoch);
  assert.equal(snapshot.value?.queueEntries.length, 0);
  assert.equal(snapshot.value?.projects.length, 2);
  assert.equal(snapshot.value?.results.length, 2);
  assert.deepEqual(snapshot.value?.leaseEvidence, canonicalEvidence);
  assert.equal(snapshot.value?.historyPending.length, 0);
  assert.equal(maintainProjectRuntimeSnapshot(root, "binding-a").value, 0);
  assert.equal(ports.state.enqueueOperation(input).status, "blocked");
  const stale = {
    epoch,
    queueId: "queue-new",
    requestHash: "d".repeat(64),
    projectId: "project-new",
    milestoneId: "milestone-new",
  };
  assert.equal(
    inspectProjectRuntimeSnapshotIntake(root, "binding-a", stale).status,
    "blocked",
  );
  const stalePorts = createProjectRuntimeSnapshotPersistencePorts(
    root,
    "binding-a",
    epoch,
    stale,
  );
  assert.equal(
    stalePorts.state.writeState({ ...state, projectId: "project-new" }, 0)
      .status,
    "blocked",
  );
  assert.equal(
    readProjectRuntimeSnapshot(root, "binding-a").value?.projects.some(
      (item) => item.projectId === "project-new",
    ),
    false,
  );
  const historyRows = fs
    .readFileSync(
      path.join(root, ".crdd", "project-runtime", "history.jsonl"),
      "utf8",
    )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(historyRows.filter((row) => row.id === "canonical").length, 1);
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
    const held = acquireProjectRuntimeSnapshotPilotLock(root);
    if (held.status !== "completed") throw new Error("fixture_lock_failed");
    const rootHash = held.value.repositoryRootHash;
    assert.equal(held.value.release(), true);
    assert.equal(
      writeProjectRuntimeSnapshot(
        root,
        "binding-a",
        JSON.stringify({
          schema: "crdd-coordinator/project-runtime-snapshot/v2",
          schemaRevision: 2,
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
          acceptanceDecisions: [],
          decisionRecoveries: [],
        }),
        0,
      ).status,
      "completed",
    );
    const current = path.join(root, ".crdd", "project-runtime", "state.json");
    if (mode === "never_acquired") {
      const bytes = fs.readFileSync(current, "utf8");
      const absent = reconcileProjectRuntimeSnapshotLeaseOwnerLoss(
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
        fs.existsSync(
          path.join(root, ".crdd", "tmp", "project-runtime-leases"),
        ),
        false,
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
              JSON.parse(fs.readFileSync(String(args[0]), "utf8")).payload
                .leaseEvidence.length > 0
            ) {
              isInjected = true;
              throw new Error("acquired_save_failed");
            }
            return Reflect.apply(originalRename, fs, args);
          },
        )
      : null;
    const ports = createProjectRuntimeSnapshotPersistencePorts(
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
        path.join(root, ".crdd", "project-runtime", "state.pending.json"),
      );
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
    const locks = path.join(root, ".crdd", "tmp", "project-runtime-leases");
    const lock = path.join(locks, fs.readdirSync(locks)[0] as string);
    if (mode === "nonempty")
      fs.writeFileSync(path.join(lock, "in-use"), "fixture");
    if (mode === "unbound_absent" || mode === "unbound_no_parent")
      fs.rmdirSync(lock);
    if (mode === "unbound_no_parent") {
      fs.rmdirSync(locks);
      fs.rmdirSync(path.dirname(locks));
    }
    const before = JSON.parse(fs.readFileSync(current, "utf8")).payload;
    const recoveryId = before.leaseIntents[0].recoveryId;
    if (mode === "unbound_absent") {
      const bytes = fs.readFileSync(current, "utf8");
      const content = {
        kind: "project-operation",
        queueId,
        ownerGeneration: before.leaseIntents[0].ownerGeneration,
        ownerProcessId: before.leaseIntents[0].ownerProcessId,
        disposition: "acquisition_unknown_closed",
      };
      const skipped = {
        ...before,
        snapshotRevision: before.snapshotRevision + 1,
        leaseIntents: [],
        leaseEvidence: [
          {
            schema: "crdd-coordinator/project-runtime-durable-foundation/v1",
            schemaRevision: 1,
            recordKind: "lease-evidence",
            repositoryBindingId: "binding-a",
            projectId: "project-a",
            createdGeneration: 1,
            updatedGeneration: 2,
            contentHash: createHash("sha256")
              .update(JSON.stringify(content))
              .digest("hex"),
            content,
          },
        ],
      };
      assert.equal(
        writeProjectRuntimeSnapshot(
          root,
          "binding-a",
          JSON.stringify(skipped),
          before.snapshotRevision,
        ).status,
        "blocked",
      );
      assert.equal(fs.readFileSync(current, "utf8"), bytes);
      const pendingPath = path.join(
        root,
        ".crdd",
        "project-runtime",
        "state.pending.json",
      );
      const pendingBytes = `${JSON.stringify({
        payload: skipped,
        contentHash: createHash("sha256")
          .update(JSON.stringify(skipped))
          .digest("hex"),
        baseRevision: before.snapshotRevision,
        baseHash: createHash("sha256").update(bytes).digest("hex"),
      })}\n`;
      fs.writeFileSync(pendingPath, pendingBytes);
      assert.equal(
        writeProjectRuntimeSnapshot(
          root,
          "binding-a",
          JSON.stringify(skipped),
          before.snapshotRevision,
        ).status,
        "blocked",
      );
      assert.equal(fs.readFileSync(current, "utf8"), bytes);
      assert.equal(fs.readFileSync(pendingPath, "utf8"), pendingBytes);
      // 自己所有の不正入力fixtureだけを戻し、正規経路の反証を続ける。
      fs.unlinkSync(pendingPath);
    }
    let shouldFailEnd = mode === "save_failure";
    const ending = t.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof originalRename>) => {
        if (
          shouldFailEnd &&
          String(args[1]) === current &&
          JSON.parse(fs.readFileSync(String(args[0]), "utf8")).payload
            .leaseIntents.length === 0
        ) {
          shouldFailEnd = false;
          throw new Error("end_save_failed");
        }
        return Reflect.apply(originalRename, fs, args);
      },
    );
    const originalLoad = Atomics.load;
    const isReleaseUnknown = mode === "initial_release_unknown";
    const releasing = t.mock.method(
      Atomics,
      "load",
      (...args: Parameters<typeof originalLoad>) => {
        const value = Reflect.apply(originalLoad, Atomics, args);
        if (isReleaseUnknown && Number(value) === 2) {
          return 3;
        }
        return value;
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
      const observationLock = acquireProjectRuntimeSnapshotPilotLock(root);
      assert.equal(observationLock.status, "completed");
      if (observationLock.status === "completed")
        assert.equal(observationLock.value.release(), true);
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
        JSON.parse(fs.readFileSync(current, "utf8")).payload.leaseIntents
          .length > 0,
      );
      if (mode === "save_failure") {
        const stateBytes = fs.readFileSync(current, "utf8");
        const pending = fs.readFileSync(
          path.join(root, ".crdd", "project-runtime", "state.pending.json"),
          "utf8",
        );
        let pendingCallbackCalls = 0;
        const repeated = reconcileProjectRuntimeSnapshotLeaseOwnerLoss(
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
            path.join(root, ".crdd", "project-runtime", "state.pending.json"),
            "utf8",
          ),
          pending,
        );
        assert.equal(fs.existsSync(lock), false);
        const payload = JSON.parse(pending).payload;
        const revision = JSON.parse(fs.readFileSync(current, "utf8")).payload
          .snapshotRevision;
        assert.equal(
          writeProjectRuntimeSnapshot(
            root,
            "binding-a",
            JSON.stringify(payload),
            revision,
          ).status,
          "completed",
        );
      }
    } else {
      assert.equal(result.status, "completed");
      const saved = JSON.parse(fs.readFileSync(current, "utf8")).payload;
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
    const held = acquireProjectRuntimeSnapshotPilotLock(root);
    if (held.status !== "completed") throw new Error("lock_fixture_failed");
    const rootHash = held.value.repositoryRootHash;
    assert.equal(held.value.release(), true);
    const payload = {
      schema: "crdd-coordinator/project-runtime-snapshot/v2",
      schemaRevision: 2,
      repositoryRootHash: rootHash,
      repositoryBindingId: "binding-a",
      snapshotRevision: 1,
      intakeEpoch: "epoch-a",
      intakeBindings: [{ queueId: "queue-a", epoch: "epoch-a" }],
      projects: [state],
      queueEntries: [
        {
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
      acceptanceDecisions: [],
      decisionRecoveries: [],
    };
    assert.equal(
      writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
        .status,
      "completed",
    );
    const directory = path.join(root, ".crdd", "project-runtime");
    const current = path.join(directory, "state.json");
    if (failure === "intent_release_confirmation") {
      const original = Atomics.load;
      const mock = t.mock.method(
        Atomics,
        "load",
        (...args: Parameters<typeof original>) => {
          const observed = Reflect.apply(original, Atomics, args);
          if (
            Number(observed) === 2 &&
            JSON.parse(fs.readFileSync(current, "utf8")).payload.leaseIntents
              .length === 1
          )
            return 3;
          return observed;
        },
      );
      try {
        const failed = acquireProjectRuntimeSnapshotLease(
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
          JSON.parse(fs.readFileSync(current, "utf8")).payload.leaseIntents[0]
            .recoveryId,
        );
        assert.equal(
          fs.existsSync(
            path.join(root, ".crdd", "tmp", "project-runtime-leases"),
          ),
          false,
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
            stack.includes("acquireProjectRuntimeSnapshotLease") &&
            !stack.includes("withProjectRuntimeSnapshotOperation") &&
            JSON.parse(fs.readFileSync(current, "utf8")).payload.leaseIntents
              .length === 1
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
        const failed = acquireProjectRuntimeSnapshotLease(
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
              path.join(oldRoot, ".crdd", "project-runtime", "state.json"),
              "utf8",
            ),
          ).payload.leaseIntents[0].recoveryId,
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
      let failed: ReturnType<typeof acquireProjectRuntimeSnapshotLease>;
      try {
        failed = acquireProjectRuntimeSnapshotLease(
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
      assert.equal(
        failed.recoveryId,
        pending.payload.leaseIntents[0].recoveryId,
      );
      if (failure === "intent_record") {
        assert.equal(saved.payload.leaseIntents.length, 0);
        assert.equal(
          fs.existsSync(
            path.join(root, ".crdd", "tmp", "project-runtime-leases"),
          ),
          false,
        );
        continue;
      }
      assert.equal(saved.payload.leaseIntents[0].phase, "acquisition_reserved");
      assert.equal(saved.payload.leaseEvidence.length, 0);
      assert.equal(
        fs.readdirSync(
          path.join(root, ".crdd", "tmp", "project-runtime-leases"),
        ).length,
        1,
      );
      assert.equal(
        readProjectRuntimeSnapshot(root, "binding-a").status,
        "blocked",
      );
    } else {
      const acquired = acquireProjectRuntimeSnapshotLease(
        root,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(acquired.status, "completed");
      if (acquired.status !== "completed")
        throw new Error("lease_fixture_failed");
      const original = fs.rmdirSync;
      const mock = t.mock.method(
        fs,
        "rmdirSync",
        (...args: Parameters<typeof original>) => {
          if (String(args[0]).includes("project-runtime-leases"))
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
      const saved = readProjectRuntimeSnapshot(root, "binding-a");
      assert.equal(saved.status, "completed");
      assert.equal(saved.value?.leaseIntents.at(-1)?.phase, "release_pending");
      assert.equal(saved.value?.leaseEvidence.length, 1);
      const before = fs.readFileSync(current, "utf8");
      assert.equal(
        acquireProjectRuntimeSnapshotLease(
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
 * 判断記録と判断回復の統合保存を確認する。
 * @responsibility 一回限り作成、完全一致比較交換と世代連鎖を検証する。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryのv2保存を使う。
 * @stimulus 作成・再送・異内容・確定・回復更新・破損世代を与える。
 * @observation 保存内容と再構築したPortの返却値を照合する。
 * @oracle 競合時はbytesを変えず、二世代単独・未知欄を拒否する。
 * @cleanup 自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 判断Store Port→統合保存。
 */
test("Host Windows: 統合判断Storeは二世代とexact回復CASを保存する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const held = acquireProjectRuntimeSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const queue = {
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
    schema: "crdd-coordinator/project-runtime-snapshot/v2",
    schemaRevision: 2,
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
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
      .status,
    "completed",
  );
  const store = createProjectRuntimeSnapshotAcceptanceDecisionStore(
    root,
    "binding-a",
  );
  const decision: ProjectRuntimeAcceptanceDecisionRecord = {
    recordId: "decision-a",
    decisionId: "authority-a",
    sourceSpecId: "SPEC-000002",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    expectedGeneration: 1,
    target: "objective",
    targetId: "objective-a",
    decision: "accept",
    criterionEvidenceIds: ["evidence-a"],
    principalId: "principal-a",
    disposition: "prepared",
    newGeneration: null,
  };
  assert.equal(store.read("missing").value, null);
  assert.equal(store.create(decision).status, "completed");
  const file = path.join(root, ".crdd", "project-runtime", "state.json");
  const before = fs.readFileSync(file, "utf8");
  assert.equal(store.create(decision).status, "blocked");
  const finalized = {
    ...decision,
    disposition: "finalized" as const,
    newGeneration: 2,
  };
  assert.equal(
    store.compareAndSet({ ...decision, principalId: "different" }, finalized)
      .status,
    "blocked",
  );
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.equal(store.compareAndSet(decision, finalized).status, "completed");
  assert.equal(store.compareAndSet(decision, finalized).status, "blocked");
  assert.deepEqual(
    createProjectRuntimeSnapshotAcceptanceDecisionStore(root, "binding-a").read(
      decision.recordId,
    ).value,
    finalized,
  );
  const recovery: ProjectRuntimeDecisionRecoveryIntent = {
    recoveryId: "recovery-a",
    recordId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 1,
    newGeneration: 2,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  };
  const recoveryStore = createProjectRuntimeSnapshotDecisionRecoveryStore(
    root,
    "binding-a",
  );
  const created = recoveryStore.create(recovery) as { status: string };
  assert.equal(created.status, "completed");
  assert.equal(
    (recoveryStore.create(recovery) as { status: string }).status,
    "blocked",
  );
  const settled = { ...recovery, disposition: "settled" as const };
  assert.equal(
    (
      recoveryStore.compareAndSet(
        { ...recovery, unknownBoundary: "other" },
        settled,
      ) as { status: string }
    ).status,
    "blocked",
  );
  assert.equal(
    (recoveryStore.compareAndSet(recovery, settled) as { status: string })
      .status,
    "completed",
  );
  assert.deepEqual(
    (
      createProjectRuntimeSnapshotDecisionRecoveryStore(root, "binding-a").read(
        "recovery-a",
      ) as { value: unknown }
    ).value,
    settled,
  );
  const observed = readProjectRuntimeSnapshot(root, "binding-a");
  assert.equal(observed.status, "completed");
  if (
    observed.status !== "completed" ||
    !observed.value ||
    observed.value.schemaRevision !== 2
  )
    throw new Error("snapshot_fixture_failed");
  assert.equal(observed.value.decisionRecoveries[0]?.generation, 2);
  for (const malformed of [
    {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      acceptanceDecisions: observed.value.acceptanceDecisions.filter(
        (item) => item.generation === 2,
      ),
    },
    {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      decisionRecoveries: [
        { generation: 2, value: { ...settled, secret: "forbidden" } },
      ],
    },
    {
      ...observed.value,
      schema: "unknown",
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
  ]) {
    const unchanged = fs.readFileSync(file, "utf8");
    assert.equal(
      writeProjectRuntimeSnapshot(
        root,
        "binding-a",
        JSON.stringify(malformed),
        observed.value.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), unchanged);
  }
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "project-runtime", "state")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "project-runtime", "recovery")),
    false,
  );
  const results = createProjectRuntimeSnapshotIntegrationRecordPort({
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
    createProjectRuntimeSnapshotIntegrationRecordPort({
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
    fs.existsSync(path.join(root, ".crdd", "project-runtime", "results")),
    false,
  );
  const ports = createProjectRuntimeSnapshotPersistencePorts(
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
    inspectProjectRuntimeSnapshotLeaseAcquisitionOwner(root, "binding-a").value,
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
  const releasedSnapshot = readProjectRuntimeSnapshot(root, "binding-a");
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
  assert.deepEqual(
    fs.readdirSync(path.join(root, ".crdd", "tmp", "project-runtime-leases")),
    [],
  );
  assert.deepEqual(
    fs.readdirSync(path.join(root, ".crdd", "project-runtime")).sort(),
    ["state.json", "state.lock"],
  );
});

/**
 * 統合保存の読取りと真正不存在を確認する。
 * @responsibility 未確定保存・破損・観測不能を正常値へ畳まない。
 * @trace PRL-IT-005
 * @precondition 自己所有の独立Repositoryを使う。
 * @stimulus 不存在、保存後、pending、結合差、aliasと親の観測失敗を与える。
 * @observation 読取り値、停止結果、元bytesと保存領域の不存在を確認する。
 * @oracle 読取りで保存先を作らず、不明時は記録を保全する。
 * @cleanup mockを戻し自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 統合保存→内部読取り。
 */
test("Host Windows: 統合Snapshot読取りは不存在と未確定を区別する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const empty = readProjectRuntimeSnapshot(root, "binding-a");
  assert.equal(empty.status, "completed");
  assert.equal(empty.value, null);
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  for (const generation of [-1, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      writeProjectRuntimeSnapshotState(
        root,
        "binding-a",
        JSON.stringify(state),
        generation,
      ).status,
      "blocked",
    );
  }
  assert.equal(
    writeProjectRuntimeSnapshotState(root, "binding-a", "{", 0).status,
    "blocked",
  );
  assert.equal(
    writeProjectRuntimeSnapshotState(
      root,
      "binding-a",
      JSON.stringify(state),
      0,
    ).status,
    "blocked",
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  const held = acquireProjectRuntimeSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-runtime-snapshot/v1",
    schemaRevision: 1,
    repositoryRootHash: rootHash,
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
  };
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
      .status,
    "completed",
  );
  assert.deepEqual(
    readProjectRuntimeSnapshot(root, "binding-a").value,
    payload,
  );
  const directory = path.join(root, ".crdd", "project-runtime");
  const current = path.join(directory, "state.json");
  const before = fs.readFileSync(current, "utf8");
  assert.equal(readProjectRuntimeSnapshot(root, "binding-b").status, "blocked");
  const pending = path.join(directory, "state.pending.json");
  fs.writeFileSync(pending, "{");
  assert.equal(readProjectRuntimeSnapshot(root, "binding-a").status, "blocked");
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.equal(fs.readFileSync(current, "utf8"), before);
  fs.unlinkSync(pending);
  const alias = path.join(directory, "alias.json");
  fs.linkSync(current, alias);
  assert.equal(readProjectRuntimeSnapshot(root, "binding-a").status, "blocked");
  fs.unlinkSync(alias);
  fs.writeFileSync(current, "{");
  assert.equal(readProjectRuntimeSnapshot(root, "binding-a").status, "blocked");
  assert.equal(fs.readFileSync(current, "utf8"), "{");
  fs.writeFileSync(current, before);
  for (const code of ["EACCES", "ENOENT"]) {
    const original = fs.lstatSync;
    let calls = 0;
    const mocked = t.mock.method(
      fs,
      "lstatSync",
      (...args: Parameters<typeof original>) => {
        if (
          String(args[0]) === path.join(root, ".crdd") &&
          ++calls === (code === "ENOENT" ? 2 : 1)
        )
          throw Object.assign(new Error("injected_parent_observation"), {
            code,
          });
        return Reflect.apply(original, fs, args);
      },
    );
    try {
      assert.equal(
        readProjectRuntimeSnapshot(root, "binding-a").status,
        "blocked",
      );
      assert.ok(calls > 0);
    } finally {
      mocked.mock.restore();
    }
    assert.equal(fs.readFileSync(current, "utf8"), before);
  }
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
  const held = acquireProjectRuntimeSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("fixture_owner_failed");
  const repositoryRootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-runtime-snapshot/v2",
    schemaRevision: 2,
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
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
      .status,
    "completed",
  );
  const ports = createProjectRuntimeSnapshotPersistencePorts(
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
  const current = path.join(root, ".crdd", "project-runtime", "state.json");
  const before = fs.readFileSync(current, "utf8");
  assert.equal(port.enqueueOperation(input).status, "completed");
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(
    port.enqueueOperation({ ...input, requestHash: "d".repeat(64) }).status,
    "blocked",
  );
  const retired = createProjectRuntimeSnapshotPersistencePorts(
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
 * @oracle 併存する取得段階を保持し、不正な更新は上書きしない。
 * @cleanup Leaseをfinallyで解放しfixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 全区画の結合→Snapshot保存。
 */
test("Host Windows: 統合Snapshotは受付結合と未解決記録を保持する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const queue = enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  try {
    const observed = readLegacyProjectRuntimeLeaseInputs(root);
    assert.equal(observed.status, "completed");
    assert.ok(observed.value);
    const evidence = observed.value.evidence[0];
    assert.ok(evidence);
    const held = acquireProjectRuntimeSnapshotPilotLock(root);
    assert.equal(held.status, "completed");
    if (held.status !== "completed") throw new Error("lock_fixture_failed");
    const rootHash = held.value.repositoryRootHash;
    assert.equal(held.value.release(), true);
    const resultValue = {
      status: "completed",
      candidateReference: "candidate-a",
    };
    const payload = {
      schema: "crdd-coordinator/project-runtime-snapshot/v1",
      schemaRevision: 1,
      repositoryRootHash: rootHash,
      repositoryBindingId: "binding-a",
      snapshotRevision: 1,
      intakeEpoch: "epoch-new",
      intakeBindings: [{ queueId: "queue-a", epoch: "epoch-original" }],
      projects: [state],
      queueEntries: [queue.value],
      leaseEvidence: observed.value.evidence,
      leaseIntents: ["acquisition_pending", "lock_owned"].map((phase) => ({
        projectId: "project-a",
        queueId: "queue-a",
        kind: "project-operation",
        ownerGeneration: evidence.content.ownerGeneration,
        ownerProcessId: evidence.content.ownerProcessId,
        recoveryId: `lease-acquisition-${createHash("sha256").update("binding-a\0project-operation").digest("hex").slice(0, 40)}`,
        phase,
      })),
      results: [
        {
          contract: "crdd-coordinator/project-runtime-integration/v1",
          kind: "integration",
          repositoryBindingId: "binding-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          identity: "result-a",
          contentHash: createHash("sha256")
            .update(JSON.stringify(resultValue))
            .digest("hex"),
          value: resultValue,
        },
      ],
      historyPending: [],
    };
    assert.equal(
      writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
        .status,
      "completed",
    );
    const current = path.join(root, ".crdd", "project-runtime", "state.json");
    const before = fs.readFileSync(current, "utf8");
    assert.deepEqual(JSON.parse(before).payload, payload);
    const next = { ...payload, snapshotRevision: 2 };
    for (const invalid of [
      { ...next, intakeBindings: [{ queueId: "queue-a", epoch: "epoch-new" }] },
      { ...next, results: [] },
      { ...next, leaseIntents: [] },
      {
        ...next,
        leaseIntents: payload.leaseIntents.map((item) => ({
          ...item,
          ownerProcessId: item.ownerProcessId + 1,
        })),
      },
      { ...next, projects: [{ ...state, generation: state.generation + 2 }] },
      {
        ...next,
        queueEntries: [
          { ...queue.value, generation: 2, scopeHash: "d".repeat(64) },
        ],
      },
      {
        ...next,
        leaseIntents: [{ ...payload.leaseIntents[0], recoveryId: "different" }],
      },
    ]) {
      assert.equal(
        writeProjectRuntimeSnapshot(
          root,
          "binding-a",
          JSON.stringify(invalid),
          1,
        ).status,
        "blocked",
      );
      assert.equal(fs.readFileSync(current, "utf8"), before);
      const pendingPath = path.join(
        root,
        ".crdd",
        "project-runtime",
        "state.pending.json",
      );
      const pending = `${JSON.stringify({ payload: invalid, contentHash: createHash("sha256").update(JSON.stringify(invalid)).digest("hex"), baseRevision: 1, baseHash: createHash("sha256").update(before).digest("hex") })}\n`;
      fs.writeFileSync(pendingPath, pending);
      assert.equal(
        writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(next), 1)
          .status,
        "blocked",
      );
      assert.equal(fs.readFileSync(current, "utf8"), before);
      assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);
      fs.unlinkSync(pendingPath);
    }
    const pendingPayload = { ...next, repositoryRootHash: rootHash };
    const pending = `${JSON.stringify({ payload: pendingPayload, contentHash: createHash("sha256").update(JSON.stringify(pendingPayload)).digest("hex"), baseRevision: 1, baseHash: "0".repeat(64) })}\n`;
    const pendingPath = path.join(
      root,
      ".crdd",
      "project-runtime",
      "state.pending.json",
    );
    fs.writeFileSync(pendingPath, pending);
    assert.equal(
      writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(next), 1)
        .status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), before);
    assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);
    const updatedState = { ...state, generation: state.generation + 1 };
    assert.equal(
      writeProjectRuntimeSnapshotState(
        root,
        "binding-a",
        JSON.stringify(updatedState),
        state.generation,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), before);
    assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);
    fs.unlinkSync(pendingPath);
    const changed = writeProjectRuntimeSnapshotState(
      root,
      "binding-a",
      JSON.stringify(updatedState),
      state.generation,
    );
    assert.equal(changed.status, "completed");
    assert.deepEqual(changed.value, updatedState);
    const expected = {
      ...payload,
      snapshotRevision: 2,
      projects: [updatedState],
    };
    assert.deepEqual(
      readProjectRuntimeSnapshot(root, "binding-a").value,
      expected,
    );
    const savedBytes = fs.readFileSync(current, "utf8");
    assert.equal(
      writeProjectRuntimeSnapshotState(
        root,
        "binding-a",
        JSON.stringify(updatedState),
        state.generation,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), savedBytes);
    const additional = { ...state, projectId: "project-b", generation: 1 };
    assert.equal(
      writeProjectRuntimeSnapshotState(
        root,
        "binding-a",
        JSON.stringify(additional),
        0,
      ).status,
      "completed",
    );
    assert.deepEqual(readProjectRuntimeSnapshot(root, "binding-a").value, {
      ...expected,
      snapshotRevision: 3,
      projects: [updatedState, additional],
    });
    const previousBytes = fs.readFileSync(current, "utf8");
    const rename = t.mock.method(fs, "renameSync", () => {
      throw new Error("state_update_rename_injected");
    });
    try {
      const interrupted = writeProjectRuntimeSnapshotState(
        root,
        "binding-a",
        JSON.stringify({
          ...updatedState,
          generation: updatedState.generation + 1,
        }),
        updatedState.generation,
      );
      assert.equal(interrupted.status, "blocked");
      assert.equal(interrupted.manualRecoveryRequired, true);
    } finally {
      rename.mock.restore();
    }
    assert.equal(fs.readFileSync(current, "utf8"), previousBytes);
    assert.ok(fs.existsSync(pendingPath));
    const reacquired = acquireProjectRuntimeSnapshotPilotLock(root);
    assert.equal(reacquired.status, "completed");
    if (reacquired.status !== "completed")
      throw new Error("lock_reacquisition_failed");
    assert.equal(reacquired.value.release(), true);
  } finally {
    assert.equal(lease.value.release().status, "completed");
  }
});

/**
 * 統合Snapshotの固定候補保存と再入場を確認する。
 * @responsibility 旧Writerを切替せず保存CASと途中再開を反証する。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryと本番生成したState値を使う。
 * @stimulus 正常保存、同候補再送、世代競合、rename失敗と再入場を実行する。
 * @observation state.json本文、固定pending、改訂番号を確認する。
 * @oracle 同候補は一重確定し、競合は上書きせず中断候補を保持する。
 * @cleanup mockを復元して自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Snapshot保存→Windows Filesystem。
 */
test("Host Windows: 統合Snapshotは固定pendingから一重確定する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const held = acquireProjectRuntimeSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-runtime-snapshot/v1",
    schemaRevision: 1,
    repositoryRootHash: rootHash,
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
  };
  const current = path.join(root, ".crdd", "project-runtime", "state.json");
  const pending = path.join(
    root,
    ".crdd",
    "project-runtime",
    "state.pending.json",
  );
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
      .status,
    "completed",
  );
  const first = fs.readFileSync(current, "utf8");
  assert.deepEqual(JSON.parse(first).payload, payload);
  assert.equal(fs.existsSync(pending), false);
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
      .status,
    "completed",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  const conflict = { ...payload, intakeEpoch: "epoch-conflict" };
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(conflict), 0)
      .status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  const next = {
    ...payload,
    snapshotRevision: 2,
    projects: [{ ...state, generation: 2 }],
  };
  const rename = t.mock.method(fs, "renameSync", () => {
    throw new Error("injected_rename_failure");
  });
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(next), 1)
      .status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  assert.ok(fs.existsSync(pending));
  const savedPending = fs.readFileSync(pending, "utf8");
  assert.deepEqual(JSON.parse(savedPending).payload, next);
  rename.mock.restore();
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(next), 1)
      .status,
    "completed",
  );
  assert.equal(fs.readFileSync(current, "utf8"), savedPending);
  assert.equal(fs.existsSync(pending), false);
  fs.writeFileSync(pending, savedPending);
  assert.equal(
    writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(next), 1)
      .status,
    "completed",
  );
  assert.equal(fs.existsSync(pending), false);
  fs.writeFileSync(pending, "{");
  assert.equal(
    writeProjectRuntimeSnapshot(
      root,
      "binding-a",
      JSON.stringify({ ...next, snapshotRevision: 3 }),
      2,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.equal(fs.readFileSync(current, "utf8"), savedPending);
});

/**
 * 部分形式や未知区画を保存前に拒否する。
 * @responsibility 不完全なSnapshotをstate.jsonとして成立させない。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryを使用する。
 * @stimulus 部分codec、Root差、区画欠落、未知区画を入力する。
 * @observation 保存File不存在を確認する。
 * @oracle 不正入力は現在値を作らない。
 * @cleanup 自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 入力検証→Snapshot保存。
 */
test("Host Windows: 統合Snapshotは部分形式と結合不明を保存しない", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const held = acquireProjectRuntimeSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-runtime-snapshot/v1",
    schemaRevision: 1,
    repositoryRootHash: rootHash,
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
  };
  for (const invalid of [
    { ...payload, repositoryRootHash: "0".repeat(64) },
    { ...payload, results: undefined },
    { ...payload, extra: true },
    {
      ...payload,
      schema: "crdd-coordinator/project-runtime-state-queue-snapshot-pilot/v1",
    },
  ]) {
    assert.equal(
      writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(invalid), 0)
        .status,
      "blocked",
    );
    assert.equal(
      fs.existsSync(path.join(root, ".crdd", "project-runtime", "state.json")),
      false,
    );
  }
  const other = fixture(t);
  const otherRuntime = path.join(other.root, ".crdd");
  assert.equal(path.dirname(otherRuntime), fs.realpathSync.native(other.root));
  assert.equal(fs.existsSync(otherRuntime), false);
  const original = fs.realpathSync.native;
  let hasChangedAfterAcquisition = false;
  const mocked = t.mock.method(
    fs.realpathSync,
    "native",
    (...args: Parameters<typeof original>) => {
      const stack = new Error("root_observation").stack ?? "";
      if (
        String(args[0]) === root &&
        stack.includes("writeProjectRuntimeSnapshot") &&
        stack.includes("resolveProjectRuntimeNamedPaths") &&
        !stack.includes("acquireProjectRuntimeSnapshotPilotLock")
      ) {
        hasChangedAfterAcquisition = true;
        return other.root;
      }
      return Reflect.apply(original, fs.realpathSync, args);
    },
  );
  try {
    assert.equal(
      writeProjectRuntimeSnapshot(root, "binding-a", JSON.stringify(payload), 0)
        .status,
      "blocked",
    );
    assert.equal(hasChangedAfterAcquisition, true);
  } finally {
    mocked.mock.restore();
  }
  assert.equal(fs.existsSync(otherRuntime), false);
  for (const name of ["state.json", "state.pending.json", "state.lock"])
    assert.equal(
      fs.existsSync(path.join(root, ".crdd", "project-runtime", name)),
      false,
    );
});

/**
 * 取得中と解放後のLease入力を非破壊で保持する。
 * @responsibility 証拠と物理残存を区別した移行入力を確認する。
 * @trace PRL-IT-005
 * @precondition 本番入口から二種類のLeaseを取得する。
 * @stimulus 取得中と解放後に旧記録を読み取る。
 * @observation 証拠、途中Marker、実ファイルHashを比較する。
 * @oracle 読取りは非破壊で、解放前後の証拠が残る。
 * @cleanup Leaseをfinallyで解放し自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 旧Lease保存→移行入力。
 */
test("旧Lease入力は取得中のMarkerと解放済み証拠を保持する", (t) => {
  const { root } = fixture(t);
  const leases = ["project-operation", "canonical-adoption"] as const;
  for (const kind of leases) {
    const acquired = acquireProjectRuntimeLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      kind,
    );
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("lease_fixture_failed");
    try {
      const observed = readLegacyProjectRuntimeLeaseInputs(root);
      assert.equal(observed.status, "completed");
      assert.ok(observed.value);
      assert.equal(observed.value.migrationCommitted, false);
      assert.ok(
        observed.value.evidence.some(
          (row) =>
            row.content.kind === kind && row.content.disposition === "acquired",
        ),
      );
      for (const footprint of ["lock", "acquisition", "ownership"])
        assert.ok(
          observed.value.footprints.some((row) => row.kind === footprint),
        );
      for (const source of observed.value.sourceRecords) {
        const bytes = fs.readFileSync(
          path.join(root, ".crdd", "project-runtime", source.relativePath),
        );
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          source.sha256,
        );
      }
      assert.deepEqual(readLegacyProjectRuntimeLeaseInputs(root), observed);
    } finally {
      assert.equal(acquired.value.release().status, "completed");
    }
  }
  const settled = readLegacyProjectRuntimeLeaseInputs(root);
  assert.equal(settled.status, "completed");
  assert.ok(settled.value);
  assert.equal(settled.value.evidence.length, 4);
  assert.equal(settled.value.footprints.length, 0);
});

/**
 * 解放証拠だけの記録と未知残存を停止させる。
 * @responsibility 不完全な旧入力を空値や移行済みにしない。
 * @trace PRL-IT-005
 * @precondition 本番Leaseを取得し解放したfixtureを使用する。
 * @stimulus acquired証拠の欠落、未知File、外部hardlinkを与える。
 * @observation 停止結果と元Fileの保存を確認する。
 * @oracle 不正入力はblockedで削除されない。
 * @cleanup 自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 旧Lease入力の拒否境界。
 */
test("旧Lease入力は証拠の欠落と未知残存を省略しない", (t) => {
  for (const failure of [
    "missing-acquired",
    "unknown-file",
    "external-hardlink",
  ]) {
    const { root } = fixture(t);
    const acquired = acquireProjectRuntimeLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(acquired.status, "completed");
    if (acquired.status !== "completed")
      throw new Error("lease_fixture_failed");
    assert.equal(acquired.value.release().status, "completed");
    const directory = path.join(
      root,
      ".crdd",
      "project-runtime",
      "recovery",
      "leases",
    );
    const first = fs
      .readdirSync(directory)
      .find((name) => !name.endsWith("-released.json"));
    assert.ok(first);
    if (failure === "missing-acquired")
      fs.unlinkSync(path.join(directory, first));
    if (failure === "unknown-file")
      fs.writeFileSync(
        path.join(
          root,
          ".crdd",
          "project-runtime",
          "work",
          "locks",
          "unknown.txt",
        ),
        "unknown",
      );
    if (failure === "external-hardlink")
      fs.linkSync(
        path.join(directory, first),
        path.join(root, "outside-lease.json"),
      );
    const previousRows = fs.readdirSync(directory);
    const rejected = readLegacyProjectRuntimeLeaseInputs(root);
    assert.equal(rejected.status, "blocked", failure);
    assert.equal(
      rejected.reason,
      "project_runtime_legacy_leases_invalid_or_unknown",
    );
    assert.deepEqual(fs.readdirSync(directory), previousRows);
  }
});

/**
 * 取得前後のMarkerと未確定解放を元のまま保持する。
 * @responsibility 証拠公開前の残存を移行入力から落とさない。
 * @trace PRL-IT-005
 * @precondition 自己所有fixtureに既知shapeの途中Fileを作成する。
 * @stimulus 取得候補の内部hardlink対と解放不明Markerを読み取る。
 * @observation 全footprint、元bytes Hash、非変更を観測する。
 * @oracle 証拠が未公開でも残存を返し、Ownerの生死は判断しない。
 * @cleanup 自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 取得中断残存→移行入力。
 */
test("旧Lease入力は証拠公開前の内部hardlinkと解放不明を保持する", (t) => {
  const { root } = fixture(t);
  const locks = path.join(root, ".crdd", "project-runtime", "work", "locks");
  fs.mkdirSync(locks, { recursive: true });
  const marker = JSON.stringify({
    kind: "project-operation",
    queueId: "queue-a",
    ownerGeneration: "owner-a",
    ownerProcessId: process.pid,
    recoveryId: "lease-acquisition-a",
  });
  const pending = path.join(
    locks,
    ".pending-project-operation-binding-a-acquisition-fixture.tmp",
  );
  fs.writeFileSync(pending, marker);
  fs.linkSync(
    pending,
    path.join(locks, "project-operation-binding-a.acquire-pending"),
  );
  fs.writeFileSync(
    path.join(locks, "project-operation-binding-a.acquire-lock-owned"),
    marker,
  );
  fs.writeFileSync(
    path.join(locks, "project-operation-binding-a.release-unknown"),
    "owner-a\n",
  );
  fs.mkdirSync(path.join(locks, "project-operation-binding-a.lock"));
  const input = readLegacyProjectRuntimeLeaseInputs(root);
  assert.equal(input.status, "completed");
  assert.ok(input.value);
  assert.equal(input.value.evidence.length, 0);
  assert.deepEqual(input.value.footprints.map((row) => row.kind).sort(), [
    "acquisition",
    "lock",
    "ownership",
    "release",
    "temporary",
  ]);
  assert.equal(input.value.sourceRecords.length, 4);
  assert.equal(input.value.migrationCommitted, false);
  assert.equal(fs.statSync(pending).nlink, 2);
  assert.deepEqual(readLegacyProjectRuntimeLeaseInputs(root), input);
});

/**
 * 保存排他の不正入力と非Windows境界を確認する。
 *
 * @responsibility 不正HashでWorkerを開始しない拒否条件を確認する。
 * @trace PRL-IT-005
 * @precondition 不正値を入力する。非Windows分岐はその実行環境で確認する。
 * @stimulus 不正Hashと非Windows時の正規Hashを低水準入口へ渡す。
 * @observation nullの非取得結果を観測する。
 * @oracle 不正入力と非Windowsでは取得handleを返さない。
 * @cleanup N/A: 拒否入力はWorkerを取得しない。
 * @boundary PRL-IT-005=Direct Boundary: 入力→Windows排他入口。
 */
test("Snapshot排他は不正Hashと非Windowsを取得前に拒否する", () => {
  for (const value of [
    null,
    undefined,
    "",
    "a".repeat(63),
    "A".repeat(64),
    1,
  ]) {
    assert.equal(acquireRuntimeOwnedProjectRuntimeStateKernelLock(value), null);
  }
  if (process.platform !== "win32") {
    assert.equal(
      acquireRuntimeOwnedProjectRuntimeStateKernelLock("a".repeat(64)),
      null,
    );
  }
});

/**
 * Repository結合した排他とProcess喪失後の再取得を実環境で確認する。
 *
 * @responsibility 同Rootの競合を拒否し、OS排他の解放を反証する。
 * @trace PRL-IT-005
 * @precondition Windows上の自己所有Repository fixtureを使用する。
 * @stimulus 独立Processが取得し、競合、別Root、通常解放と強制終了を試す。
 * @observation 取得結果、保持handleと子Processの終了を観測する。
 * @oracle 同Rootだけ拒否し、終了後に新しいhandleを取得できる。
 * @cleanup 子Processを終了確認し、全handle解放後にfixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Repository検証→Windows Named Pipe。
 */
test("Host Windows: Snapshot排他は配下・case差を統一しOwner終了後に再取得できる", {
  skip: process.platform !== "win32",
}, async (t) => {
  const { root } = fixture(t);
  const { root: otherRoot } = fixture(t);
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  const ownerProbe = fileURLToPath(
    new URL(
      "../fixtures/project-runtime-snapshot-lock-owner.ts",
      import.meta.url,
    ),
  );
  const child = spawn(process.execPath, [ownerProbe, root], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const [ready] = await once(child.stdout, "data", {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(String(ready), "ready");
    for (const contender of [root, nested, root.toUpperCase()]) {
      const result = acquireProjectRuntimeSnapshotPilotLock(contender);
      try {
        assert.equal(result.status, "blocked");
        assert.equal(
          result.reason,
          "project_runtime_snapshot_lock_unavailable",
        );
      } finally {
        if (result.status === "completed") {
          assert.equal(result.value.release(), true);
        }
      }
    }
    const independent = acquireProjectRuntimeSnapshotPilotLock(otherRoot);
    assert.equal(independent.status, "completed");
    if (independent.status === "completed") {
      try {
        assert.equal(independent.value.assertLive(), true);
      } finally {
        assert.equal(independent.value.release(), true);
      }
      assert.equal(independent.value.assertLive(), false);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close", {
        signal: AbortSignal.timeout(10000),
      });
      child.kill("SIGKILL");
      await closed;
    }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = acquireProjectRuntimeSnapshotPilotLock(root);
    assert.equal(result.status, "completed");
    if (result.status === "completed") {
      try {
        assert.equal(result.value.assertLive(), true);
      } finally {
        assert.equal(result.value.release(), true);
      }
      assert.equal(result.value.assertLive(), false);
    }
  }
  assert.equal(
    acquireProjectRuntimeSnapshotPilotLock(path.join(root, "missing")).status,
    "blocked",
  );
});

/**
 * State／Queue試行codecの閉じた入力・破損拒否を検証する。
 *
 * @responsibility 部分形式の相関と値分離を反証する。
 * @trace PRL-IT-005
 * @precondition 通常Stateを持つ自己所有fixtureを用意する。
 * @stimulus 符号化、復号、改竄、結合不一致と不正形状を入力する。
 * @observation 戻り値、入力値と復号値の独立性を確認する。
 * @oracle 有効な部分形式だけ受理し、全負例で停止する。
 * @cleanup fixture hookが自己所有領域を回収する。codecは書込みしない。
 * @boundary PRL-IT-005=Direct Boundary: JSON→保存試行codec。
 */
test("Snapshot試行codecは重複・孤立・改竄を拒否し独立した値を返す", (t) => {
  const { state } = fixture(t);
  const payload = {
    schema: "crdd-coordinator/project-runtime-state-queue-snapshot-pilot/v1",
    schemaRevision: 1,
    repositoryBindingId: "binding-a",
    snapshotRevision: 3,
    projects: [state],
    queueEntries: [
      {
        queueId: "queue-a",
        projectId: state.projectId,
        milestoneId: "old-milestone",
        requestHash: "a".repeat(64),
        originLane: "interactive",
        repositoryRevision: "b".repeat(40),
        scopeHash: "c".repeat(64),
        state: "completed",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: "result-a",
      },
    ],
  };
  const original = JSON.stringify(payload);
  const encoded = encodeProjectRuntimeStateQueueSnapshotPilot(
    original,
    "binding-a",
  );
  assert.equal(encoded.status, "completed");
  if (encoded.status !== "completed") throw new Error("codec_failed");
  const decoded = decodeProjectRuntimeStateQueueSnapshotPilot(
    encoded.value,
    "binding-a",
  );
  assert.equal(decoded.status, "completed");
  if (decoded.status !== "completed") throw new Error("codec_failed");
  assert.deepEqual(decoded.value, payload);
  const changed = decoded.value.projects[0];
  assert.ok(changed);
  Object.assign(changed, { generation: 9 });
  assert.equal(JSON.stringify(payload), original);
  for (const invalid of [
    { ...payload, extra: null },
    { ...payload, snapshotRevision: 0 },
    { ...payload, projects: [state, state] },
    {
      ...payload,
      queueEntries: [...payload.queueEntries, ...payload.queueEntries],
    },
    { ...payload, projects: [] },
    { ...payload, projects: [{ ...state, extra: null }] },
  ])
    assert.equal(
      encodeProjectRuntimeStateQueueSnapshotPilot(
        JSON.stringify(invalid),
        "binding-a",
      ).status,
      "blocked",
    );
  assert.equal(
    encodeProjectRuntimeStateQueueSnapshotPilot(original, "binding-b").status,
    "blocked",
  );
  assert.equal(
    decodeProjectRuntimeStateQueueSnapshotPilot(encoded.value, "binding-b")
      .status,
    "blocked",
  );
  const altered = JSON.parse(encoded.value);
  altered.payload.snapshotRevision = 4;
  assert.equal(
    decodeProjectRuntimeStateQueueSnapshotPilot(
      JSON.stringify(altered),
      "binding-a",
    ).status,
    "blocked",
  );
  const extraEnvelope = { ...JSON.parse(encoded.value), extra: null };
  assert.equal(
    decodeProjectRuntimeStateQueueSnapshotPilot(
      JSON.stringify(extraEnvelope),
      "binding-a",
    ).status,
    "blocked",
  );
  for (const invalid of [
    "{",
    "あ".repeat(Math.ceil(MAX_RECORD_BYTES / 3) + 1),
  ]) {
    assert.equal(
      encodeProjectRuntimeStateQueueSnapshotPilot(invalid, "binding-a").status,
      "blocked",
    );
    assert.equal(
      decodeProjectRuntimeStateQueueSnapshotPilot(invalid, "binding-a").status,
      "blocked",
    );
  }
});

/**
 * stateEnvelopeのTest準備責務を実行する。
 *
 * @responsibility stateEnvelopeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateEnvelopeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function stateEnvelope(state: ProjectRuntimeState) {
  const serialized = JSON.stringify(state);
  return {
    schema: "crdd-coordinator/project-runtime-durable-foundation/v1",
    schemaRevision: 1,
    recordKind: "project-state",
    repositoryBindingId: "binding-a",
    projectId: state.projectId,
    createdGeneration: 1,
    updatedGeneration: state.generation,
    contentHash: createHash("sha256").update(serialized, "utf8").digest("hex"),
    content: state,
  };
}

/**
 * storedEnvelopeBytesのTest準備責務を実行する。
 *
 * @responsibility storedEnvelopeBytesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus storedEnvelopeBytesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function storedEnvelopeBytes(state: ProjectRuntimeState) {
  return Buffer.byteLength(`${JSON.stringify(stateEnvelope(state))}\n`, "utf8");
}

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
  return path.join(root, ".crdd", "project-runtime", "state", "project-a");
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
  return path.join(root, ".crdd", "project-runtime", "queues", "queue-a");
}

/**
 * stateWithStoredBytesのTest準備責務を実行する。
 *
 * @responsibility stateWithStoredBytesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateWithStoredBytesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function stateWithStoredBytes(
  template: ProjectRuntimeState,
  targetBytes: number,
): ProjectRuntimeState {
  const pathValue = "p".repeat(512);
  const mutable = structuredClone(template) as unknown as {
    milestone: { acceptanceCriteria: string[] };
    tasks: Array<{
      definition: {
        id: string;
        objectiveId: string;
        dependencies: string[];
        allowedPaths: string[];
        conflictKeys: string[];
      };
    }>;
  } & Omit<ProjectRuntimeState, "milestone" | "tasks">;
  mutable.milestone.acceptanceCriteria = ["a", "b"];
  mutable.tasks = Array.from({ length: 1024 }, (_unused, index) => ({
    ...structuredClone(template.tasks[0]),
    definition: {
      id: `task-${index}`,
      objectiveId: "objective-a",
      dependencies: [],
      allowedPaths: Array.from({ length: 28 }, () => pathValue),
      conflictKeys: [],
    },
  }));
  let remaining =
    targetBytes -
    storedEnvelopeBytes(mutable as unknown as ProjectRuntimeState);
  if (remaining < 0) throw new Error("record_boundary_fixture_too_large");
  const wholePaths = Math.floor(remaining / 515);
  for (let index = 0; index < wholePaths; index += 1) {
    const task = mutable.tasks[index % mutable.tasks.length];
    if (!task || task.definition.allowedPaths.length >= 128)
      throw new Error("record_boundary_fixture_capacity_exhausted");
    task.definition.allowedPaths.push(pathValue);
  }
  remaining =
    targetBytes -
    storedEnvelopeBytes(mutable as unknown as ProjectRuntimeState);
  const firstGrowth = Math.min(remaining, 511);
  mutable.milestone.acceptanceCriteria[0] = "a".repeat(1 + firstGrowth);
  remaining -= firstGrowth;
  mutable.milestone.acceptanceCriteria[1] = "b".repeat(1 + remaining);
  const result = mutable as unknown as ProjectRuntimeState;
  assert.equal(storedEnvelopeBytes(result), targetBytes);
  return result;
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
  const temporary = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
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
  const created = createProjectRuntimeState({
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
  const write = writeProjectRuntimeState(root, "binding-a", state, 0);
  assert.equal(write.status, "completed");
  const read = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(read.status, "completed");
  assert.deepEqual(read.value, state);

  const stale = writeProjectRuntimeState(root, "binding-a", state, 0);
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "project_runtime_state_generation_conflict");
});

/**
 * 旧記録の最新値と全世代の導出元を、保存を変更せず取得できることを確認する。
 *
 * @responsibility 移行準備が正常記録を保持し、移行完了を誤表示しないことを検証する。
 * @trace PRL-IT-005
 * @precondition 本番WriterでStateとQueueを作成する。
 * @stimulus 旧形式の移行入力を二度読み取る。
 * @observation 最新Envelope、全世代Hashと実ファイルのbyte列を比較する。
 * @oracle 最新世代が一致し、全導出元が残り、読取り前後でbyte列が変わらない。
 * @cleanup fixtureが所有するRepositoryを試験終了後に回収する。
 * @boundary 旧Filesystem保存Adapter→移行準備。
 */
test("旧State／Queueの全世代を検証し、書込みなしで最新値を抽出する", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", state, 0).status,
    "completed",
  );
  const next = { ...state, generation: 2 };
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", next, 1).status,
    "completed",
  );
  const queue = enqueueProjectOperation(root, "binding-a", {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "scheduled",
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  });
  assert.equal(queue.status, "completed");
  const location = path.join(stateDirectory(root), "generation-2.json");
  const before = fs.readFileSync(location);
  const result = readLegacyProjectRuntimeStateAndQueueInputs(root);
  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw new Error("legacy_inputs_failed");
  assert.equal(result.value.migrationCommitted, false);
  assert.deepEqual(
    result.value.states.map((record) => record.content),
    [next],
  );
  assert.equal(result.value.queues.length, 1);
  assert.equal(result.value.sourceRecords.length, 3);
  assert.equal(
    result.value.sourceRecords[0]?.relativePath,
    "state/project-a/generation-1.json",
  );
  assert.deepEqual(readLegacyProjectRuntimeStateAndQueueInputs(root), result);
  assert.deepEqual(fs.readFileSync(location), before);
  assert.equal(
    fs.existsSync(path.join(root, ".crdd/project-runtime/state.json")),
    false,
  );
});

/**
 * 最新世代が読めても旧記録が不正なら移行入力を返さないことを確認する。
 *
 * @responsibility 欠番・古い世代のHash破損を最新値で隠さない拒否を検証する。
 * @trace PRL-IT-005
 * @precondition 本番Writerで連続する二世代を保存する。
 * @stimulus 古い世代を改変し、その後欠番状態で再読取りする。
 * @observation 拒否結果と最新世代のbyte列を取得する。
 * @oracle どちらもblockedであり、新保存先の作成も最新世代の変更もない。
 * @cleanup fixtureが所有するRepositoryを試験終了後に回収する。
 * @boundary 旧Filesystem保存Adapter→移行準備の拒否境界。
 */
test("旧世代のHash破損と欠番を移行準備で拒否する", (t) => {
  const { root, state } = fixture(t);
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", state, 0).status,
    "completed",
  );
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", { ...state, generation: 2 }, 1)
      .status,
    "completed",
  );
  const first = path.join(stateDirectory(root), "generation-1.json");
  const second = path.join(stateDirectory(root), "generation-2.json");
  const before = fs.readFileSync(second);
  const record = JSON.parse(fs.readFileSync(first, "utf8"));
  record.contentHash = "0".repeat(64);
  fs.writeFileSync(first, JSON.stringify(record));
  const corrupt = readLegacyProjectRuntimeStateAndQueueInputs(root);
  assert.equal(corrupt.status, "blocked");
  assert.equal(corrupt.manualRecoveryRequired, false);
  fs.unlinkSync(first);
  assert.equal(
    readLegacyProjectRuntimeStateAndQueueInputs(root).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(second), before);
  assert.equal(
    fs.existsSync(path.join(root, ".crdd/project-runtime/state.json")),
    false,
  );
});

/**
 * 親領域の不正と列挙後の観測不能を、真正の記録不存在から区別する。
 *
 * @responsibility 不正親、aliasと読取不能を空入力成功へ変換しないことを検証する。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryと旧Writerによる正常記録を用いる。
 * @stimulus 親を不正実体へ置換し、列挙済み子の観測を失敗させる。
 * @observation 結果、手動回復表示、最新記録のbyte列を観測する。
 * @oracle 不存在だけ成功し、不正・観測不能では候補なしのblockedとなる。
 * @cleanup mockをrestoreし、fixtureが自己所有Repositoryだけを回収する。
 * @boundary 旧保存領域の親／子Directory観測→移行準備。
 */
test("旧入力の真正不存在・不正親・alias・列挙後観測不能を区別する", (t) => {
  const { root, state } = fixture(t);
  const absent = readLegacyProjectRuntimeStateAndQueueInputs(root);
  assert.equal(absent.status, "completed");
  if (absent.status !== "completed") throw new Error("absent_inputs_failed");
  assert.equal(absent.value.sourceRecords.length, 0);
  const crdd = path.join(root, ".crdd");
  fs.writeFileSync(crdd, "not-a-directory");
  assert.equal(
    readLegacyProjectRuntimeStateAndQueueInputs(root).status,
    "blocked",
  );
  fs.unlinkSync(crdd);
  fs.mkdirSync(crdd);
  const runtime = path.join(crdd, "project-runtime");
  fs.writeFileSync(runtime, "not-a-directory");
  assert.equal(
    readLegacyProjectRuntimeStateAndQueueInputs(root).status,
    "blocked",
  );
  fs.unlinkSync(runtime);
  fs.symlinkSync(path.join(root, "absent-owned-target"), runtime, "junction");
  assert.equal(
    readLegacyProjectRuntimeStateAndQueueInputs(root).status,
    "blocked",
  );
  fs.unlinkSync(runtime);
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", state, 0).status,
    "completed",
  );
  const target = stateDirectory(root);
  const location = path.join(target, "generation-1.json");
  const before = fs.readFileSync(location);
  const original = fs.lstatSync;
  const mock = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof original>) => {
      if (String(args[0]) === target)
        throw Object.assign(new Error("observation_unavailable"), {
          code: "ENOENT",
        });
      return Reflect.apply(original, fs, args);
    },
  );
  const unknown = readLegacyProjectRuntimeStateAndQueueInputs(root);
  mock.mock.restore();
  assert.equal(unknown.status, "blocked");
  assert.equal(unknown.manualRecoveryRequired, false);
  assert.deepEqual(fs.readFileSync(location), before);
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
  const ports = createProjectRuntimePersistencePorts(root, "binding-a");
  assert.equal(ports.state.writeState.length, 2);
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
    writeProjectRuntimeState(root, "binding-a", state, 0).status,
    "completed",
  );
  const record = path.join(stateDirectory(root), "generation-1.json");
  const original = JSON.parse(fs.readFileSync(record, "utf8")) as Record<
    string,
    unknown
  >;
  fs.writeFileSync(record, "{}\n", "utf8");
  const read = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(read.status, "blocked");
  assert.equal(read.reason, "project_runtime_state_observation_unknown");
  assert.equal(read.manualRecoveryRequired, true);

  const rewritten = { ...original };
  rewritten.content = { contract: "crdd-coordinator/project-runtime-state/v1" };
  rewritten.contentHash = createHash("sha256")
    .update(JSON.stringify(rewritten.content), "utf8")
    .digest("hex");
  fs.writeFileSync(record, `${JSON.stringify(rewritten)}\n`, "utf8");
  assert.equal(
    readProjectRuntimeState(root, "binding-a", "project-a").reason,
    "project_runtime_state_observation_unknown",
  );
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
      writeProjectRuntimeState(root, "binding-a", state, 0).status,
      "completed",
      item.name,
    );
    const location = path.join(stateDirectory(root), "generation-1.json");
    const envelope = JSON.parse(fs.readFileSync(location, "utf8")) as {
      content: { tasks: Record<string, unknown>[] };
      contentHash: string;
    };
    const task = envelope.content.tasks[0];
    if (!task) throw new Error("fixture_task_missing");
    item.mutate(task);
    envelope.contentHash = createHash("sha256")
      .update(JSON.stringify(envelope.content), "utf8")
      .digest("hex");
    fs.writeFileSync(location, `${JSON.stringify(envelope)}\n`, "utf8");

    const observed = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(observed.status, "blocked", item.name);
    assert.equal(
      observed.reason,
      "project_runtime_state_observation_unknown",
      item.name,
    );
    assert.equal(observed.manualRecoveryRequired, true, item.name);
  }
});

/**
 * PR-D-A-01 rejects malformed envelopes, generation gaps, and residual inventoryを検証する。
 *
 * @responsibility PR-D-A-01 rejects malformed envelopes, generation gaps, and residual inventoryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 rejects malformed envelopes, generation gaps, and residual inventoryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 rejects malformed envelopes, generation gaps, and residual inventory", (t) => {
  const cases: ReadonlyArray<{
    name: string;
    mutate: (directory: string, state: ProjectRuntimeState) => void;
  }> = [
    {
      name: "filename-generation-mismatch",
      mutate: (directory) =>
        fs.renameSync(
          path.join(directory, "generation-1.json"),
          path.join(directory, "generation-2.json"),
        ),
    },
    {
      name: "missing-generation",
      mutate: (directory, state) => {
        const generationThree = { ...state, generation: 3 };
        fs.writeFileSync(
          path.join(directory, "generation-3.json"),
          `${JSON.stringify(stateEnvelope(generationThree))}\n`,
          "utf8",
        );
      },
    },
    {
      name: "pending-residue",
      mutate: (directory) =>
        fs.writeFileSync(
          path.join(directory, ".pending-interrupted"),
          "residue",
          "utf8",
        ),
    },
    {
      name: "unknown-inventory",
      mutate: (directory) =>
        fs.writeFileSync(path.join(directory, "notes.txt"), "unknown", "utf8"),
    },
    {
      name: "envelope-extra-field",
      mutate: (directory) => {
        const location = path.join(directory, "generation-1.json");
        const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
          string,
          unknown
        >;
        record.unexpected = true;
        fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
      },
    },
    {
      name: "envelope-missing-field",
      mutate: (directory) => {
        const location = path.join(directory, "generation-1.json");
        const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
          string,
          unknown
        >;
        delete record.createdGeneration;
        fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
      },
    },
    {
      name: "unknown-record-kind",
      mutate: (directory) => {
        const location = path.join(directory, "generation-1.json");
        const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
          string,
          unknown
        >;
        record.recordKind = "unknown";
        fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
      },
    },
  ];

  for (const scenario of cases) {
    const { root, state } = fixture(t);
    assert.equal(
      writeProjectRuntimeState(root, "binding-a", state, 0).status,
      "completed",
      scenario.name,
    );
    scenario.mutate(stateDirectory(root), state);
    const priorNames = fs.readdirSync(stateDirectory(root)).sort();
    const result = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(result.status, "blocked", scenario.name);
    assert.equal(result.manualRecoveryRequired, true, scenario.name);
    assert.deepEqual(
      fs.readdirSync(stateDirectory(root)).sort(),
      priorNames,
      scenario.name,
    );
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
  const { root } = fixture(t);
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
    enqueueProjectOperation(root, "binding-a", input).status,
    "completed",
  );
  const location = path.join(queueDirectory(root), "generation-1.json");
  const record = JSON.parse(fs.readFileSync(location, "utf8")) as Record<
    string,
    unknown
  >;
  record.recordKind = "unknown";
  fs.writeFileSync(location, `${JSON.stringify(record)}\n`, "utf8");
  const result = enqueueProjectOperation(root, "binding-a", input);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "project_runtime_mutation_observation_unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), ["generation-1.json"]);
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
  const { root } = fixture(t);
  const commonFields = {
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      ...commonFields,
      queueId: "queue-a",
      projectId: "project-a",
    }).status,
    "completed",
  );
  assert.equal(
    enqueueProjectOperation(root, "binding-b", {
      ...commonFields,
      queueId: "queue-b",
      projectId: "project-b",
    }).status,
    "completed",
  );
  const selectedA = selectNextProjectOperation(root, "binding-a");
  const selectedB = selectNextProjectOperation(root, "binding-b");
  assert.equal(selectedA.status, "completed");
  assert.equal(selectedA.value?.queueId, "queue-a");
  assert.equal(selectedB.status, "completed");
  assert.equal(selectedB.value?.queueId, "queue-b");
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
  const { root } = fixture(t);
  const input = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const created = enqueueProjectOperation(root, "binding-a", input);
  assert.equal(created.reason, "project_runtime_queue_entry_durable");
  const observed = enqueueProjectOperation(root, "binding-a", input);
  assert.equal(observed.reason, "project_runtime_queue_request_reused");
  assert.equal(created.status, "completed");
  assert.equal(observed.status, "completed");
  if (created.status !== "completed" || observed.status !== "completed")
    throw new Error("queue_observation_failed");
  assert.deepEqual(observed.value, created.value);
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), ["generation-1.json"]);
  const conflict = enqueueProjectOperation(root, "binding-a", {
    ...input,
    requestHash: "d".repeat(64),
  });
  assert.equal(conflict.status, "blocked");
  assert.equal(conflict.reason, "project_runtime_queue_identity_conflict");

  const missingLease = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: null,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(missingLease.reason, "project_runtime_queue_lease_invalid");
  const fabricatedLease = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
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
    },
  );
  assert.equal(fabricatedLease.reason, "project_runtime_queue_lease_invalid");
  const acquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  const stale = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "running",
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(stale.reason, "project_runtime_queue_generation_conflict");
  const wrongQueueLease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "project_runtime_lease_unavailable");
  assert.equal(acquired.value.release().status, "completed");
  const releasedLease = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "running",
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(releasedLease.reason, "project_runtime_queue_lease_invalid");
});

/**
 * PR-D-A-01 rejects identity changes in every queue generationを検証する。
 *
 * @responsibility PR-D-A-01 rejects identity changes in every queue generationの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 rejects identity changes in every queue generationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 rejects identity changes in every queue generation", (t) => {
  for (const identity of ["project", "queue"] as const) {
    for (const operation of ["retry", "update"] as const) {
      const { root } = fixture(t);
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
        enqueueProjectOperation(root, "binding-a", input).status,
        "completed",
      );
      const lease = acquireProjectRuntimeLease(
        root,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
      );
      assert.equal(lease.status, "completed");
      if (lease.status !== "completed") throw new Error("lease_fixture_failed");
      assert.equal(
        updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
          state: "leased",
          lease: lease.value,
          resumeCondition: null,
          resultReference: null,
        }).status,
        "completed",
      );

      const first = path.join(queueDirectory(root), "generation-1.json");
      const record = JSON.parse(fs.readFileSync(first, "utf8")) as Record<
        string,
        unknown
      >;
      const content = record.content as Record<string, unknown>;
      if (identity === "project") {
        record.projectId = "project-b";
        content.projectId = "project-b";
      } else {
        content.queueId = "queue-b";
      }
      record.contentHash = createHash("sha256")
        .update(JSON.stringify(content), "utf8")
        .digest("hex");
      fs.writeFileSync(first, `${JSON.stringify(record)}\n`, "utf8");

      const result =
        operation === "retry"
          ? enqueueProjectOperation(root, "binding-a", input)
          : updateProjectOperationQueueState(root, "binding-a", "queue-a", 2, {
              state: "running",
              lease: lease.value,
              resumeCondition: null,
              resultReference: null,
            });
      assert.equal(result.status, "blocked", `${identity}-${operation}`);
      assert.equal(
        result.reason,
        "project_runtime_queue_record_mismatch",
        `${identity}-${operation}`,
      );
      assert.equal(
        result.manualRecoveryRequired,
        true,
        `${identity}-${operation}`,
      );
      assert.deepEqual(fs.readdirSync(queueDirectory(root)).sort(), [
        "generation-1.json",
        "generation-2.json",
      ]);
      assert.equal(lease.value.release().status, "completed");
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
  const { root } = fixture(t);
  const first = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(first.status, "completed");
  const duplicate = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(duplicate.status, "blocked");
  assert.equal(duplicate.reason, "project_runtime_lease_unavailable");
  const adoption = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "canonical-adoption",
  );
  assert.equal(adoption.status, "completed");
  const crossQueueAdoption = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(crossQueueAdoption.status, "blocked");
  assert.equal(crossQueueAdoption.reason, "project_runtime_lease_unavailable");
  if (first.status !== "completed" || adoption.status !== "completed")
    throw new Error("lease_fixture_failed");
  assert.equal(first.value.release().status, "completed");
  assert.equal(
    first.value.release().reason,
    "project_runtime_lease_already_released",
  );
  assert.equal(adoption.value.release().status, "completed");
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * PR-D-A-01 preserves a recovery marker when lease release evidence failsを検証する。
 *
 * @responsibility PR-D-A-01 preserves a recovery marker when lease release evidence failsの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 preserves a recovery marker when lease release evidence failsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 preserves a recovery marker when lease release evidence fails", (t) => {
  const { root } = fixture(t);
  const acquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(acquired.status, "completed");
  if (acquired.status !== "completed") throw new Error("lease_fixture_failed");
  const leases = path.join(
    root,
    ".crdd",
    "project-runtime",
    "recovery",
    "leases",
  );
  fs.renameSync(leases, `${leases}.saved`);
  fs.writeFileSync(leases, "not-a-directory", "utf8");
  const released = acquired.value.release();
  assert.equal(released.status, "blocked");
  assert.equal(released.reason, "project_runtime_lease_release_unknown");
  assert.equal(released.manualRecoveryRequired, true);
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(reacquired.status, "blocked");
  assert.equal(reacquired.reason, "project_runtime_lease_recovery_required");
  assert.equal(reacquired.manualRecoveryRequired, true);
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const moduleUrl = new URL(
    "../../src/project-runtime/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease, updateProjectOperationQueueState } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);
const queued = updateProjectOperationQueueState(${JSON.stringify(root)}, "binding-a", "queue-a", 1, { state: "leased", lease: lease.value, resumeCondition: null, resultReference: null });
if (queued.status !== "completed") process.exit(21);`,
    ],
    { windowsHide: true },
  );
  const before = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(before.status, "completed");
  assert.equal(before.status === "completed" && before.value.state, "leased");
  let observedOwnerProcessId = 0;
  const recovered = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
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
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const moduleUrl = new URL(
    "../../src/project-runtime/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );

  const locks = path.join(root, ".crdd", "project-runtime", "work", "locks");
  const marker = path.join(
    locks,
    "project-operation-binding-a.acquire-pending",
  );
  const lock = path.join(locks, "project-operation-binding-a.lock");
  assert.equal(fs.existsSync(marker), true);
  assert.equal(fs.existsSync(lock), true);
  const acquisitionMarkerBytes = fs.readFileSync(marker, "utf8");
  const blockedAcquire = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "project_runtime_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  assert.equal(blockedAcquire.recoveryId, null);

  let observedOwnerProcessId = 0;
  const recovered = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => {
      observedOwnerProcessId = owner.ownerProcessId;
      return { status: "absent", ...owner };
    },
  );
  assert.equal(recovered.status, "completed");
  assert.notEqual(observedOwnerProcessId, process.pid);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(lock), false);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "queued");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
  assert.match(
    queue.status === "completed" ? (queue.value.resultReference ?? "") : "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  fs.writeFileSync(marker, acquisitionMarkerBytes, "utf8");
  const resumedSettlement = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(resumedSettlement.status, "completed");
  assert.equal(
    resumedSettlement.status === "completed" &&
      resumedSettlement.value.generation,
    2,
  );
  assert.equal(fs.existsSync(marker), false);
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
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
  const { root } = fixture(t);
  const moduleUrl = new URL(
    "../../src/project-runtime/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "canonical-adoption");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );
  const blockedAcquire = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(blockedAcquire.status, "blocked");
  assert.equal(blockedAcquire.reason, "project_runtime_lease_unavailable");
  assert.equal(blockedAcquire.manualRecoveryRequired, false);
  assert.equal(blockedAcquire.recoveryId, null);
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.match(
    recovered.status === "completed" ? (recovered.value.recoveryId ?? "") : "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
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
  const { root } = fixture(t);
  const signal = path.join(root, "live-owner-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "project-runtime-lease-interleaving-probe.ts",
  );
  const child = spawn(process.execPath, [probe, root, signal, "hold"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(signal) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(signal), true);
  const contender = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(contender.status, "blocked");
  assert.equal(contender.reason, "project_runtime_lease_unavailable");
  assert.equal(contender.manualRecoveryRequired, false);
  assert.equal(contender.recoveryId, null);
  fs.writeFileSync(`${signal}.go`, "go\n", "utf8");
  const exitCode = await new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  assert.equal(exitCode, 0);
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
  const { root } = fixture(t);
  const signal = path.join(root, "pre-publication-ready");
  const probe = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "project-runtime-lease-interleaving-probe.ts",
  );
  const child = spawn(
    process.execPath,
    [probe, root, signal, "pause-before-publish"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(signal) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(signal), true);
  const contender = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(contender.status, "blocked");
  assert.equal(contender.reason, "project_runtime_lease_unavailable");
  assert.equal(contender.manualRecoveryRequired, false);
  assert.equal(contender.recoveryId, null);
  child.kill();
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.match(
    recovered.status === "completed" ? (recovered.value.recoveryId ?? "") : "",
    /^lease-acquisition-[0-9a-f]{40}$/u,
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "canonical-adoption",
  );
  assert.equal(reacquired.status, "completed");
  if (reacquired.status === "completed")
    assert.equal(reacquired.value.release().status, "completed");
});

/**
 * PR-A-04 returns the exact Recovery ID when acquisition Marker readback fails after publicationを検証する。
 *
 * @responsibility PR-A-04 returns the exact Recovery ID when acquisition Marker readback fails after publicationの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 returns the exact Recovery ID when acquisition Marker readback fails after publicationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 returns the exact Recovery ID when acquisition Marker readback fails after publication", (t) => {
  const { root } = fixture(t);
  const marker = path.join(
    root,
    ".crdd",
    "project-runtime",
    "work",
    "locks",
    "canonical-adoption-binding-a-project-a.acquire-pending",
  );
  const originalReadFileSync = fs.readFileSync;
  let isFaultInjected = false;
  /**
   * faultingReadFileSyncのTest準備責務を実行する。
   *
   * @responsibility faultingReadFileSyncがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace PRL-IT-012
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus faultingReadFileSyncを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  const faultingReadFileSync = ((...args: unknown[]) => {
    if (!isFaultInjected && String(args[0]) === marker) {
      isFaultInjected = true;
      throw new Error("injected_acquisition_marker_readback_failure");
    }
    return Reflect.apply(originalReadFileSync, fs, args);
  }) as typeof fs.readFileSync;
  let acquisition: ReturnType<typeof acquireProjectRuntimeLease>;
  Object.defineProperty(fs, "readFileSync", {
    configurable: true,
    writable: true,
    value: faultingReadFileSync,
  });
  try {
    acquisition = acquireProjectRuntimeLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "canonical-adoption",
    );
  } finally {
    Object.defineProperty(fs, "readFileSync", {
      configurable: true,
      writable: true,
      value: originalReadFileSync,
    });
  }
  assert.equal(isFaultInjected, true);
  assert.equal(acquisition.status, "blocked");
  assert.equal(
    acquisition.reason,
    "project_runtime_lease_acquisition_recovery_required",
  );
  assert.equal(
    acquisition.status === "blocked" && acquisition.manualRecoveryRequired,
    true,
  );
  const recoveryId =
    acquisition.status === "blocked" ? acquisition.recoveryId : null;
  assert.match(recoveryId ?? "", /^lease-acquisition-[0-9a-f]{40}$/u);
  assert.equal(fs.existsSync(marker), true);
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        ".crdd",
        "project-runtime",
        "work",
        "locks",
        "canonical-adoption-binding-a-project-a.lock",
      ),
    ),
    false,
  );
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(
    recovered.status === "completed" && recovered.value.recoveryId,
    recoveryId,
  );
  assert.equal(fs.existsSync(marker), false);
});

/**
 * PR-A-04 preserves a published acquisition when temporary cleanup is unknownを検証する。
 *
 * @responsibility PR-A-04 preserves a published acquisition when temporary cleanup is unknownの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 preserves a published acquisition when temporary cleanup is unknownの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 preserves a published acquisition when temporary cleanup is unknown", (t) => {
  const { root } = fixture(t);
  const locks = path.join(root, ".crdd", "project-runtime", "work", "locks");
  const identity = "canonical-adoption-binding-a-project-a";
  const marker = path.join(locks, `${identity}.acquire-pending`);
  const lock = path.join(locks, `${identity}.lock`);
  const originalRmSync = fs.rmSync;
  let isCleanupFaultInjected = false;
  /**
   * faultingRmSyncのTest準備責務を実行する。
   *
   * @responsibility faultingRmSyncがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace PRL-IT-012
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus faultingRmSyncを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  const faultingRmSync = ((...args: unknown[]) => {
    if (
      !isCleanupFaultInjected &&
      path
        .basename(String(args[0]))
        .startsWith(
          ".pending-canonical-adoption-binding-a-project-a-acquisition-",
        )
    ) {
      isCleanupFaultInjected = true;
      throw new Error("injected_acquisition_temporary_cleanup_failure");
    }
    return Reflect.apply(originalRmSync, fs, args);
  }) as typeof fs.rmSync;
  let acquisition: ReturnType<typeof acquireProjectRuntimeLease>;
  Object.defineProperty(fs, "rmSync", {
    configurable: true,
    writable: true,
    value: faultingRmSync,
  });
  try {
    acquisition = acquireProjectRuntimeLease(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      "canonical-adoption",
    );
  } finally {
    Object.defineProperty(fs, "rmSync", {
      configurable: true,
      writable: true,
      value: originalRmSync,
    });
  }
  assert.equal(isCleanupFaultInjected, true);
  assert.equal(acquisition.status, "blocked");
  assert.equal(
    acquisition.reason,
    "project_runtime_lease_acquisition_recovery_required",
  );
  assert.equal(
    acquisition.status === "blocked" && acquisition.manualRecoveryRequired,
    true,
  );
  const recoveryId =
    acquisition.status === "blocked" ? acquisition.recoveryId : null;
  assert.match(recoveryId ?? "", /^lease-acquisition-[0-9a-f]{40}$/u);
  assert.equal(fs.existsSync(marker), true);
  assert.equal(fs.existsSync(lock), false);
  const recovered = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(
    recovered.status === "completed" && recovered.value.recoveryId,
    recoveryId,
  );
  assert.equal(fs.existsSync(marker), false);
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const moduleUrl = new URL(
    "../../src/project-runtime/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "project-operation");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );
  const locks = path.join(root, ".crdd", "project-runtime", "work", "locks");
  const acquisitionMarker = path.join(
    locks,
    "project-operation-binding-a.acquire-pending",
  );
  const pending = JSON.parse(fs.readFileSync(acquisitionMarker, "utf8")) as {
    ownerGeneration: string;
  };
  const releaseMarker = path.join(
    locks,
    "project-operation-binding-a.release-unknown",
  );
  fs.writeFileSync(releaseMarker, `${pending.ownerGeneration}\n`, "utf8");
  const recovered = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(recovered.status, "completed");
  assert.equal(fs.existsSync(acquisitionMarker), false);
  assert.equal(fs.existsSync(releaseMarker), false);
  assert.equal(
    fs.existsSync(path.join(locks, "project-operation-binding-a.lock")),
    false,
  );
  const reacquired = acquireProjectRuntimeLease(
    root,
    "binding-a",
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
  const { root } = fixture(t);
  const moduleUrl = new URL(
    "../../src/project-runtime/project-runtime-durable-foundation.ts",
    import.meta.url,
  ).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireProjectRuntimeLease } from ${JSON.stringify(moduleUrl)};
const lease = acquireProjectRuntimeLease(${JSON.stringify(root)}, "binding-a", "project-a", "queue-a", "canonical-adoption");
if (lease.status !== "completed") process.exit(20);`,
    ],
    { windowsHide: true },
  );
  const locks = path.join(root, ".crdd", "project-runtime", "work", "locks");
  const ownershipMarker = path.join(
    locks,
    "canonical-adoption-binding-a-project-a.acquire-lock-owned",
  );
  const ownership = JSON.parse(fs.readFileSync(ownershipMarker, "utf8")) as {
    recoveryId: string;
  };
  ownership.recoveryId = `lease-acquisition-${"0".repeat(40)}`;
  fs.writeFileSync(ownershipMarker, `${JSON.stringify(ownership)}\n`, "utf8");
  const before = new Map(
    fs
      .readdirSync(locks)
      .sort()
      .map((name) => [
        name,
        fs.lstatSync(path.join(locks, name)).isFile()
          ? fs.readFileSync(path.join(locks, name), "utf8")
          : "<directory>",
      ]),
  );
  const result = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
    root,
    "binding-a",
    "project-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "project_runtime_lease_acquisition_recovery_evidence_mismatch",
  );
  assert.deepEqual(
    new Map(
      fs
        .readdirSync(locks)
        .sort()
        .map((name) => [
          name,
          fs.lstatSync(path.join(locks, name)).isFile()
            ? fs.readFileSync(path.join(locks, name), "utf8")
            : "<directory>",
        ]),
    ),
    before,
  );
});

/**
 * PR-D-A-01 preserves malformed and partial acquisition state with an exact recovery IDを検証する。
 *
 * @responsibility PR-D-A-01 preserves malformed and partial acquisition state with an exact recovery IDの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 preserves malformed and partial acquisition state with an exact recovery IDの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 preserves malformed and partial acquisition state with an exact recovery ID", (t) => {
  for (const scenario of [
    "malformed-marker",
    "partial-temporary",
    "existing-lock",
  ] as const) {
    const { root: scenarioRoot } = fixture(t);
    const initialized = acquireProjectRuntimeLease(
      scenarioRoot,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(initialized.status, "completed");
    if (initialized.status !== "completed")
      throw new Error("lease_fixture_failed");
    assert.equal(initialized.value.release().status, "completed");
    const locks = path.join(
      scenarioRoot,
      ".crdd",
      "project-runtime",
      "work",
      "locks",
    );
    if (scenario === "malformed-marker")
      fs.writeFileSync(
        path.join(locks, "project-operation-binding-a.acquire-pending"),
        '{"ownerGeneration":',
        "utf8",
      );
    if (scenario === "partial-temporary")
      fs.writeFileSync(
        path.join(
          locks,
          ".pending-project-operation-binding-a-acquisition-partial.tmp",
        ),
        "partial",
        "utf8",
      );
    if (scenario === "existing-lock")
      fs.mkdirSync(path.join(locks, "project-operation-binding-a.lock"));
    const result = acquireProjectRuntimeLease(
      scenarioRoot,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    );
    assert.equal(result.status, "blocked", scenario);
    const doesRequireRecovery = scenario === "existing-lock";
    assert.equal(
      result.status === "blocked" && result.manualRecoveryRequired,
      doesRequireRecovery,
      scenario,
    );
    if (doesRequireRecovery)
      assert.match(
        result.status === "blocked" ? (result.recoveryId ?? "") : "",
        /^lease-acquisition-[0-9a-f]{40}$/u,
        scenario,
      );
    else {
      assert.equal(
        result.reason,
        "project_runtime_lease_unavailable",
        scenario,
      );
      assert.equal(result.recoveryId, null, scenario);
    }
    assert.notEqual(
      result.reason,
      "project_runtime_lease_acquisition_rolled_back",
    );
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    1,
    {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  const running = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "running",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(running.status, "completed");
  const terminalIntent = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    3,
    {
      state: "integration_pending",
      lease: lease.value,
      resumeCondition: "objective_integration",
      resultReference: "result-a",
    },
  );
  assert.equal(terminalIntent.status, "completed");
  assert.equal(
    terminalIntent.status === "completed" &&
      terminalIntent.value.ownerGeneration,
    lease.value.ownerGeneration,
  );
  assert.equal(
    settleProjectOperationQueueLeaseRelease(
      root,
      "binding-a",
      "queue-a",
      4,
      lease.value.ownerGeneration,
    ).status,
    "blocked",
  );
  assert.equal(lease.value.release().status, "completed");
  const settled = settleProjectOperationQueueLeaseRelease(
    root,
    "binding-a",
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
  const { root } = fixture(t);
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-long-recovery",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  const leased = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-long-recovery",
    1,
    {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(leased.status, "completed");
  const running = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-long-recovery",
    2,
    {
      state: "running",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    },
  );
  assert.equal(running.status, "completed");
  const recoveryRequired = updateProjectOperationQueueState(
    root,
    "binding-a",
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
  const settled = settleProjectOperationQueueLeaseRelease(
    root,
    "binding-a",
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-a",
      generation,
      {
        state,
        lease: lease.value,
        resumeCondition:
          state === "integration_pending" ? "objective_integration" : null,
        resultReference: state === "integration_pending" ? "result-a" : null,
      },
    );
    assert.equal(updated.status, "completed");
    generation += 1;
  }
  assert.equal(lease.value.release().status, "completed");
  let observerCalls = 0;
  const reconciled = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  let generation = 1;
  for (const state of ["leased", "running", "integration_pending"] as const) {
    const updated = updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-a",
      generation,
      {
        state,
        lease: lease.value,
        resumeCondition:
          state === "integration_pending" ? "objective_integration" : null,
        resultReference: state === "integration_pending" ? "result-a" : null,
      },
    );
    assert.equal(updated.status, "completed");
    generation += 1;
  }
  assert.equal(lease.value.release().status, "completed");
  const evidenceDirectory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "recovery",
    "leases",
  );
  const releasedName = fs
    .readdirSync(evidenceDirectory)
    .find((name) => name.endsWith("-released.json"));
  assert.ok(releasedName);
  const releasedPath = path.join(evidenceDirectory, releasedName);
  const envelope = JSON.parse(fs.readFileSync(releasedPath, "utf8")) as {
    content: Record<string, unknown>;
    contentHash: string;
  };
  envelope.content.queueId = "queue-b";
  envelope.contentHash = createHash("sha256")
    .update(JSON.stringify(envelope.content), "utf8")
    .digest("hex");
  fs.writeFileSync(releasedPath, `${JSON.stringify(envelope)}\n`, "utf8");

  const settlement = settleProjectOperationQueueLeaseRelease(
    root,
    "binding-a",
    "queue-a",
    4,
    lease.value.ownerGeneration,
  );
  assert.equal(settlement.status, "blocked");
  assert.equal(settlement.manualRecoveryRequired, true);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    lease.value.ownerGeneration,
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  const evidenceDirectory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "recovery",
    "leases",
  );
  const acquiredName = fs
    .readdirSync(evidenceDirectory)
    .find((name) => !name.includes("released") && name.endsWith(".json"));
  assert.ok(acquiredName);
  const acquired = JSON.parse(
    fs.readFileSync(path.join(evidenceDirectory, acquiredName), "utf8"),
  ) as Record<string, unknown>;
  const recoveredName = acquiredName.replace(/\.json$/u, "-recovered.json");
  fs.writeFileSync(
    path.join(evidenceDirectory, recoveredName),
    `${JSON.stringify({ ...acquired, content: {} })}\n`,
    "utf8",
  );
  const result = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    (owner) => ({ status: "absent", ...owner }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.manualRecoveryRequired, true);
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
  const { root } = fixture(t);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
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
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).status,
    "completed",
  );
  for (const status of ["alive", "unknown"] as const) {
    const outcome = reconcileProjectRuntimeLeaseOwnerLoss(
      root,
      "binding-a",
      "project-a",
      "queue-a",
      (owner) => ({ ...owner, status }),
    );
    assert.equal(outcome.status, "blocked");
    assert.equal(
      outcome.reason,
      status === "alive"
        ? "project_runtime_lease_owner_still_active"
        : "project_runtime_lease_owner_observation_unknown",
    );
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
  const { root } = fixture(t);
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
    enqueueProjectOperation(root, "binding-a", input).status,
    "completed",
  );
  const lease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
  );
  assert.equal(lease.status, "completed");
  if (lease.status !== "completed") throw new Error("lease_fixture_failed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 1, {
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
    const result = updateProjectOperationQueueState(
      root,
      "binding-a",
      "queue-a",
      2,
      {
        state,
        lease: null,
        resumeCondition:
          state === "replan_required" || state === "human_decision_required"
            ? "resume-a"
            : state === "recovery_required"
              ? "recover-a"
              : null,
        resultReference: state === "cancelled" ? "cancelled-a" : null,
      },
    );
    assert.equal(result.reason, "project_runtime_queue_lease_invalid", state);
  }
  const fabricated = updateProjectOperationQueueState(
    root,
    "binding-a",
    "queue-a",
    2,
    {
      state: "replan_required",
      lease: {
        kind: "project-operation",
        ownerGeneration: lease.value.ownerGeneration,
        release: lease.value.release,
      },
      resumeCondition: "resume-a",
      resultReference: null,
    },
  );
  assert.equal(fabricated.reason, "project_runtime_queue_lease_invalid");
  const wrongQueueLease = acquireProjectRuntimeLease(
    root,
    "binding-a",
    "project-a",
    "queue-b",
    "project-operation",
  );
  assert.equal(wrongQueueLease.status, "blocked");
  assert.equal(wrongQueueLease.reason, "project_runtime_lease_unavailable");
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), [
    "generation-1.json",
    "generation-2.json",
  ]);
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 2, {
      state: "recovery_required",
      lease: lease.value,
      resumeCondition: "recover-a",
      resultReference: null,
    }).status,
    "completed",
  );
  assert.equal(lease.value.release().status, "completed");
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 3, {
      state: "leased",
      lease: lease.value,
      resumeCondition: null,
      resultReference: null,
    }).reason,
    "project_runtime_queue_transition_invalid",
  );
  assert.equal(
    updateProjectOperationQueueState(root, "binding-a", "queue-a", 3, {
      state: "cancelled",
      lease: lease.value,
      resumeCondition: null,
      resultReference: "cancelled-a",
    }).reason,
    "project_runtime_queue_lease_invalid",
  );
  assert.deepEqual(fs.readdirSync(queueDirectory(root)), [
    "generation-1.json",
    "generation-2.json",
    "generation-3.json",
  ]);
});

/**
 * PR-D-A-01 enforces the exact stored-record byte boundaryを検証する。
 *
 * @responsibility PR-D-A-01 enforces the exact stored-record byte boundaryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 enforces the exact stored-record byte boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-D-A-01 enforces the exact stored-record byte boundary", (t) => {
  for (const targetBytes of [MAX_RECORD_BYTES - 1, MAX_RECORD_BYTES]) {
    const { root, state } = fixture(t);
    const boundary = stateWithStoredBytes(state, targetBytes);
    const written = writeProjectRuntimeState(root, "binding-a", boundary, 0);
    assert.equal(written.status, "completed", String(targetBytes));
    const location = path.join(stateDirectory(root), "generation-1.json");
    assert.equal(fs.statSync(location).size, targetBytes);
    const observed = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(observed.status, "completed", String(targetBytes));
  }

  const { root, state } = fixture(t);
  const oversized = stateWithStoredBytes(state, MAX_RECORD_BYTES + 1);
  const rejected = writeProjectRuntimeState(root, "binding-a", oversized, 0);
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.reason, "project_runtime_mutation_observation_unknown");
  assert.equal(rejected.manualRecoveryRequired, true);
  assert.equal(
    fs.existsSync(path.join(stateDirectory(root), "generation-1.json")),
    false,
  );
});

/**
 * describes the durable foundation without claiming the upper Runtime completeを検証する。
 *
 * @responsibility describes the durable foundation without claiming the upper Runtime completeの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus describes the durable foundation without claiming the upper Runtime completeの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("describes the durable foundation without claiming the upper Runtime complete", () => {
  const contract = describeProjectRuntimeDurableFoundation();
  assert.equal(contract.upperProjectRuntimeCapabilityComplete, false);
  assert.equal(
    contract.staleLockDisposition,
    "blocked_manual_reconciliation_required_before_reuse",
  );
});
