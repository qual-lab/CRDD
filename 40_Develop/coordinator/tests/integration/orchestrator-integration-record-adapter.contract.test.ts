/**
 * coordinator:integration:orchestrator-integration-record-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:orchestrator-integration-record-adapterが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、integration、record、adapter
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireOrchestratorSnapshotPilotLock,
  createOrchestratorSnapshotIntegrationRecordPort,
  readOrchestratorSnapshot,
  writeOrchestratorSnapshot,
} from "../../../orchestrator/src/storage/current-state.ts";
import { createOrchestratorState } from "../../../orchestrator/src/index.ts";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(t: test.TestContext) {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(repository, "tmp"),
    "fixture_repository_root_invalid",
  );
  const parent = fs.realpathSync.native(area.directory);
  const root = fs.mkdtempSync(
    path.join(parent, "crdd-project-integration-record-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(path.dirname(root), parent);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const created = createOrchestratorState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture_state_invalid");
  const held = acquireOrchestratorSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("fixture_lock_invalid");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/orchestrator-snapshot/v2",
    schemaRevision: 2,
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [{ queueId: "queue-a", epoch: "epoch-a" }],
    projects: [created.state],
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
    writeOrchestratorSnapshot(root, "binding-a", JSON.stringify(payload), 0)
      .status,
    "completed",
  );
  return { root };
}

/**
 * adapterのTest準備責務を実行する。
 *
 * @responsibility adapterがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus adapterを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function adapter(root: string, projectId = "project-a") {
  return createOrchestratorSnapshotIntegrationRecordPort({
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId,
    milestoneId: "milestone-a",
    queueId: "queue-a",
  });
}

/**
 * integration records are immutable and an identical retry is idempotentを検証する。
 *
 * @responsibility integration records are immutable and an identical retry is idempotentの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus integration records are immutable and an identical retry is idempotentの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("integration records are immutable and an identical retry is idempotent", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const record = {
    kind: "integration" as const,
    identity: "candidate-a",
    value: { status: "candidate", changedPaths: ["result.txt"] },
  };
  assert.equal(records.write(record).status, "completed");
  const file = path.join(root, ".crdd", "orchestrator", "state.json");
  const before = fs.readFileSync(file);
  assert.equal(records.write(record).status, "completed");
  assert.deepEqual(fs.readFileSync(file), before);
  const observed = readOrchestratorSnapshot(root, "binding-a");
  assert.equal(observed.status, "completed");
  assert.equal(observed.value?.results.length, 1);
  assert.equal(observed.value?.results[0]?.identity, "candidate-a");
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "orchestrator", "results")),
    false,
  );
});

/**
 * 正規Candidate IdentityをIntegration Recordとして保存できることを検証する。
 *
 * @responsibility Candidate Storeが発行する完全なCandidate IDとIntegration Record境界の互換性を判定する。
 * @trace PRL-IT-005
 * @precondition Candidate IDは`candidate.<64hex>.<64hex>`の正規形式である。
 * @stimulus 正規Candidate IDをIdentityとするIntegration Recordを書き込む。
 * @observation 書込み結果と生成Recordを取得する。
 * @oracle 128文字を超える正規Identityを長さだけで拒否せず、完全なIdentityを保持する。
 * @cleanup 登録済みhookが一時Repositoryを清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Candidate Store→Integration Record Adapter
 */
test("canonical candidate identity is preserved by the integration record", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const candidateId = `candidate.${"a".repeat(64)}.${"b".repeat(64)}`;
  const result = records.write({
    kind: "integration",
    identity: candidateId,
    value: { status: "candidate", changedPaths: ["result.txt"] },
  });
  assert.equal(result.status, "completed");
  const observed = readOrchestratorSnapshot(root, "binding-a");
  assert.equal(observed.status, "completed");
  assert.equal(observed.value?.results.length, 1);
  assert.equal(observed.value?.results[0]?.identity, candidateId);
});

/**
 * an identity collision is blocked without replacing the first recordを検証する。
 *
 * @responsibility an identity collision is blocked without replacing the first recordの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus an identity collision is blocked without replacing the first recordの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("an identity collision is blocked without replacing the first record", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const first = {
    kind: "adoption" as const,
    identity: "receipt-a",
    value: { afterRevision: "a".repeat(40) },
  };
  assert.equal(records.write(first).status, "completed");
  const target = path.join(root, ".crdd", "orchestrator", "state.json");
  const original = fs.readFileSync(target);
  const collision = records.write({
    ...first,
    value: { afterRevision: "b".repeat(40) },
  });
  assert.equal(collision.status, "blocked");
  assert.equal(collision.reason, "orchestrator_result_identity_conflict");
  assert.deepEqual(fs.readFileSync(target), original);
  const observed = readOrchestratorSnapshot(root, "binding-a");
  assert.equal(observed.status, "completed");
  assert.equal(observed.value?.results.length, 1);
  assert.equal(observed.value?.results[0]?.identity, "receipt-a");
});

/**
 * invalid path identities fail before creating a record directoryを検証する。
 *
 * @responsibility invalid path identities fail before creating a record directoryの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus invalid path identities fail before creating a record directoryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("invalid path identities fail before creating a record directory", (t) => {
  const { root } = fixture(t);
  const escaped = `escape-${path.basename(root)}`;
  const outside = path.join(root, "..", escaped);
  const file = path.join(root, ".crdd", "orchestrator", "state.json");
  const before = fs.readFileSync(file);
  const result = adapter(root, `../${escaped}`).write({
    kind: "integration",
    identity: "candidate-a",
    value: {},
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "orchestrator_result_invalid");
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.existsSync(outside), false);
});

/**
 * 未知欄・結果Hash・Queue結合の破損を現在保存から拒否する。
 * @responsibility 外側Hashだけの一致を結果契約の証明にしないことを確認する。
 * @trace PRL-IT-005
 * @precondition 対象Queueに結合した候補結果が単一状態に保存済みである。
 * @stimulus 結果の未知欄、内容Hash、Queue結合を個別に破損する。
 * @observation 読取りの状態と保存bytesを確認する。
 * @oracle 観測不能として停止し不正保存を置換しない。
 * @cleanup 登録済みhookが自己所有Repositoryを回収する。
 * @boundary 結果Port→現在Snapshotの内容検査。
 */
test("現行結果保存は未知欄・Hash・Queue結合破損を拒否して保全する", (t) => {
  const { root } = fixture(t);
  assert.equal(
    adapter(root).write({
      kind: "integration",
      identity: "candidate-a",
      value: { status: "candidate" },
    }).status,
    "completed",
  );
  const file = path.join(root, ".crdd", "orchestrator", "state.json");
  const original = fs.readFileSync(file, "utf8");
  for (const change of [
    { unexpected: true },
    { contentHash: "f".repeat(64) },
    { milestoneId: "milestone-mismatch" },
  ]) {
    const saved = JSON.parse(original);
    Object.assign(saved.payload.results[0], change);
    saved.contentHash = createHash("sha256")
      .update(JSON.stringify(saved.payload))
      .digest("hex");
    fs.writeFileSync(file, JSON.stringify(saved));
    const before = fs.readFileSync(file);
    const observed = readOrchestratorSnapshot(root, "binding-a");
    assert.equal(observed.status, "blocked", JSON.stringify(change));
    assert.equal(
      observed.reason,
      "orchestrator_snapshot_invalid_or_unconfirmed",
    );
    assert.equal(observed.manualRecoveryRequired, true);
    assert.deepEqual(fs.readFileSync(file), before);
  }
});
