/**
 * coordinator:integration:project-runtime-decision-recovery-storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-decision-recovery-storeが所有する検証責務を実行する。
 * @trace PRL-IT-013
 * @level IT
 * @scope project、runtime、decision、recovery、store
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireProjectRuntimeSnapshotPilotLock,
  createProjectRuntimeSnapshotDecisionRecoveryStore,
  writeProjectRuntimeSnapshot,
} from "../../../orchestrator/src/storage/current-state-store.ts";
import {
  createProjectRuntimeState,
  type ProjectRuntimeDecisionRecoveryIntent,
} from "../../../orchestrator/src/index.ts";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/storage/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/repository/index.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(t: test.TestContext) {
  const temporary = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      fileURLToPath(new URL("../../../../", import.meta.url)),
      "tmp",
    ),
    "fixture_repository_root_invalid",
  ).directory;
  const root = fs.mkdtempSync(path.join(temporary, "crdd-decision-recovery-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => {
    assert.equal(path.dirname(root), temporary);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const state = createProjectRuntimeState({
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
  assert.equal(state.status, "completed");
  if (state.status !== "completed") throw new Error("fixture_state_invalid");
  const held = acquireProjectRuntimeSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("fixture_lock_invalid");
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
    projects: [state.state],
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
  return root;
}
/**
 * intentのTest準備責務を実行する。
 *
 * @responsibility intentがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus intentを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function intent(): ProjectRuntimeDecisionRecoveryIntent {
  return Object.freeze({
    recoveryId: "decision-recovery-a",
    recordId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 2,
    newGeneration: 3,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  });
}

/**
 * independent decision recovery intent survives a fresh store and settles by CASを検証する。
 *
 * @responsibility independent decision recovery intent survives a fresh store and settles by CASの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus independent decision recovery intent survives a fresh store and settles by CASの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("independent decision recovery intent survives a fresh store and settles by CAS", (t) => {
  const root = fixture(t);
  const first = createProjectRuntimeSnapshotDecisionRecoveryStore(
    root,
    "binding-a",
  );
  const value = intent();
  assert.equal((first.create(value) as { status: string }).status, "completed");
  const reopened = createProjectRuntimeSnapshotDecisionRecoveryStore(
    root,
    "binding-a",
  );
  assert.deepEqual(
    (reopened.read(value.recoveryId) as { value: unknown }).value,
    value,
  );
  const settled = Object.freeze({ ...value, disposition: "settled" as const });
  assert.equal(
    (reopened.compareAndSet(value, settled) as { status: string }).status,
    "completed",
  );
  assert.deepEqual(
    (reopened.read(value.recoveryId) as { value: unknown }).value,
    settled,
  );
});

/**
 * recovery intent store rejects duplicate creation and a stale CASを検証する。
 *
 * @responsibility recovery intent store rejects duplicate creation and a stale CASの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus recovery intent store rejects duplicate creation and a stale CASの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("recovery intent store rejects duplicate creation and a stale CAS", (t) => {
  const root = fixture(t);
  const store = createProjectRuntimeSnapshotDecisionRecoveryStore(
    root,
    "binding-a",
  );
  const value = intent();
  assert.equal((store.create(value) as { status: string }).status, "completed");
  const file = path.join(root, ".crdd", "orchestrator", "state.json");
  const before = fs.readFileSync(file);
  assert.equal((store.create(value) as { status: string }).status, "blocked");
  const stale = Object.freeze({ ...value, unknownBoundary: "queue_update" });
  assert.equal(
    (
      store.compareAndSet(stale, {
        ...stale,
        disposition: "settled",
      }) as { status: string }
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(
    (store.read(value.recoveryId) as { value: unknown }).value,
    value,
  );
});

/**
 * 未知の判断回復欄を含む現在状態が読取り停止になることを検証する。
 *
 * @responsibility 未知欄の拒否と破損bytesの保全を確認する。
 * @trace PRL-IT-013
 * @precondition 対象Queueへ結合した回復記録が現行Snapshotに確定している。
 * @stimulus 回復値へ未知欄を挿入し外側の内容Hashだけは一致させる。
 * @observation 新しいStoreの返却理由と状態Fileのbytesを観測する。
 * @oracle 内容契約不正として回復を要求し、不正保存を置換しない。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("未知の判断回復欄は現在状態を置換せず停止する", (t) => {
  const root = fixture(t);
  const store = createProjectRuntimeSnapshotDecisionRecoveryStore(
    root,
    "binding-a",
  );
  const value = intent();
  assert.equal((store.create(value) as { status: string }).status, "completed");
  const file = path.join(root, ".crdd", "orchestrator", "state.json");
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  saved.payload.decisionRecoveries[0].value.unexpected = true;
  saved.contentHash = createHash("sha256")
    .update(JSON.stringify(saved.payload))
    .digest("hex");
  fs.writeFileSync(file, JSON.stringify(saved));
  const before = fs.readFileSync(file);
  const observed = createProjectRuntimeSnapshotDecisionRecoveryStore(
    root,
    "binding-a",
  ).read(value.recoveryId) as {
    status: string;
    reason: string;
    manualRecoveryRequired: boolean;
  };
  assert.equal(observed.status, "blocked");
  assert.equal(
    observed.reason,
    "project_runtime_snapshot_invalid_or_unconfirmed",
  );
  assert.equal(observed.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(file), before);
});
