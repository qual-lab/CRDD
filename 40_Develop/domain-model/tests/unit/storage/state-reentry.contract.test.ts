/**
 * 保存値モデルの再入場判定を検証する。
 * @packageDocumentation
 * @responsibility 値モデルの純粋な再入場分類を全組合せと反例で確認する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 共通保存状態の局所判定。
 * @boundary Process内の純粋判定。実保存・資源回収の証明ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRuntimeSnapshotReentry,
  coordinatorSnapshotIntakeMatches,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  type CoordinatorSnapshot,
} from "../../../src/index.ts";

/**
 * 受付世代と同じ依頼の再入場を局所判定する。
 * @responsibility Queue不存在と既存Queueの同内容確認を分離する。
 * @trace PRL-UT-006
 * @precondition 受付照合が読む値を持つ合成Snapshotを使用する。
 * @stimulus 新規、同世代・異本文、退役済み世代と不正IDを渡す。
 * @observation 判定値と元のSnapshot本文を取得する。
 * @oracle 新規は現在世代だけ、既存Queueは保存された元世代と同じ本文だけを受理する。
 * @cleanup N/A: メモリ内の局所判定のみ。
 * @boundary 全体codec・実受付・現在Ownerの検証は別試験が所有する。
 */
test("受付照合は新規の現世代と既存Queueの元世代を混同しない", () => {
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [],
    queueEntries: [],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const intake = {
    epoch: "epoch-a",
    queueId: "queue-a",
    requestHash: "b".repeat(64),
    projectId: "project-a",
    milestoneId: "milestone-a",
  };
  const before = JSON.stringify(current);
  assert.equal(coordinatorSnapshotIntakeMatches(current, intake), true);
  assert.equal(
    coordinatorSnapshotIntakeMatches(current, {
      ...intake,
      epoch: "old-epoch",
    }),
    false,
  );
  const queued: CoordinatorSnapshot = {
    ...current,
    intakeEpoch: "epoch-b",
    intakeBindings: [{ queueId: intake.queueId, epoch: intake.epoch }],
    queueEntries: [
      {
        workspaceId: null,
        queueId: intake.queueId,
        projectId: intake.projectId,
        milestoneId: intake.milestoneId,
        requestHash: intake.requestHash,
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
  };
  assert.equal(coordinatorSnapshotIntakeMatches(queued, intake), true);
  for (const changed of [
    { ...intake, epoch: "epoch-b" },
    { ...intake, requestHash: "c".repeat(64) },
    { ...intake, projectId: "project-b" },
    { ...intake, milestoneId: "milestone-b" },
    { ...intake, queueId: "" },
    { ...intake, requestHash: "invalid" },
  ])
    assert.equal(coordinatorSnapshotIntakeMatches(queued, changed), false);
  assert.equal(
    coordinatorSnapshotIntakeMatches({ ...queued, intakeBindings: [] }, intake),
    false,
  );
  assert.equal(JSON.stringify(current), before);
});

/**
 * Snapshotの元版と次版のexact内容だけを保存再入場へ分類する。
 * @responsibility 版番号だけの一致、異内容、別Repositoryの誤受理を反証する。
 * @trace PRL-UT-006
 * @precondition 合成したSnapshot Identityとexact bytes Hashを使用する。
 * @stimulus 元版・次版・Hash差・結合差・観測不能を判定へ渡す。
 * @observation publish_pending、remove_pending、blockedの返却を取得する。
 * @oracle 元版とHashの一致だけが公開候補、次版exact一致だけが回収候補となる。
 * @cleanup N/A: 純粋判定でFile、Lock、Processを作成しない。
 * @boundary N/A: 保存とDockerを呼ばない局所の状態分類である。
 */
test("Runtime Snapshotは元版・次版のexact内容と結合を照合する", () => {
  const previousHash = "a".repeat(64);
  const nextHash = "b".repeat(64);
  const pending = {
    revision: 2,
    previous: { revision: 1, payloadSha256: previousHash },
    repositoryBinding: "repository-a",
    payloadSha256: nextHash,
  };
  const current = {
    status: "present" as const,
    revision: 1,
    repositoryBinding: "repository-a",
    payloadSha256: previousHash,
  };
  assert.equal(
    classifyRuntimeSnapshotReentry(
      current,
      pending,
      "repository-a",
      "existing",
    ),
    "publish_pending",
  );
  assert.equal(
    classifyRuntimeSnapshotReentry(
      { ...current, revision: 2, payloadSha256: nextHash },
      pending,
      "repository-a",
      "existing",
    ),
    "remove_pending",
  );
  for (const observation of [
    { ...current, payloadSha256: nextHash },
    { ...current, revision: 2 },
    { ...current, revision: 3, payloadSha256: nextHash },
    { ...current, repositoryBinding: "repository-b" },
    { ...current, payloadSha256: "" },
    { ...current, revision: 1.5 },
    { ...current, revision: Number.MAX_SAFE_INTEGER + 1 },
    { status: "unknown" as const },
    { status: "absent" as const },
  ]) {
    assert.equal(
      classifyRuntimeSnapshotReentry(
        observation,
        pending,
        "repository-a",
        "existing",
      ),
      "blocked",
    );
  }
  assert.equal(
    classifyRuntimeSnapshotReentry(current, pending, "repository-a", "unknown"),
    "blocked",
  );
});

/**
 * 初回保存は新Root・明示不存在・初版という全条件を要求する。
 * @responsibility 旧状態喪失を新しい初回保存へ誤分類しないことを確認する。
 * @trace PRL-UT-006
 * @precondition 初版pendingとRoot条件の閉じた観測を用いる。
 * @stimulus Root三状態と正規Fileの存在／不存在／観測不能を組み合わせる。
 * @observation 初回公開候補、確定済み回収候補、停止を比較する。
 * @oracle 新Rootかつ明示不存在だけを初回公開候補とし、確定済みexact一致は回収候補とする。
 * @cleanup N/A: 合成値だけを使用し、物理Rootは作成しない。
 * @boundary N/A: 初回条件の局所判定。Root検証や清掃成立を証明しない。
 */
test("Coordinator Snapshotの初回条件は不存在と観測不能を区別する", () => {
  const pending = {
    revision: 1,
    previous: null,
    repositoryBinding: "repository-a",
    payloadSha256: "a".repeat(64),
  };
  for (const rootState of ["new", "existing", "unknown"] as const) {
    assert.equal(
      classifyRuntimeSnapshotReentry(
        { status: "absent" },
        pending,
        "repository-a",
        rootState,
      ),
      rootState === "new" ? "publish_pending" : "blocked",
    );
    assert.equal(
      classifyRuntimeSnapshotReentry(
        { status: "unknown" },
        pending,
        "repository-a",
        rootState,
      ),
      "blocked",
    );
  }
  assert.equal(
    classifyRuntimeSnapshotReentry(
      { status: "present", ...pending },
      pending,
      "repository-a",
      "existing",
    ),
    "remove_pending",
  );
});

/**
 * Snapshotの改訂相関とHash形状の不正を停止へ分類する。
 * @responsibility 小数・非安全整数・改訂飛越し・不正Hash・結合差を反証する。
 * @trace PRL-UT-006
 * @precondition 元版の合成観測と次版pendingを使用する。
 * @stimulus 次版とpreviousの各不正variantを同じ観測へ渡す。
 * @observation 判定結果と入力不変を取得する。
 * @oracle 全不正variantがblockedであり、入力値を変更しない。
 * @cleanup N/A: 合成入力だけを扱い、共有状態を持たない。
 * @boundary N/A: Identity相関の局所反証。全Snapshot Schemaの検証は別責務である。
 */
test("Coordinator Snapshotは不正な改訂相関とHashを拒否する", () => {
  const current = {
    status: "present" as const,
    revision: 1,
    repositoryBinding: "repository-a",
    payloadSha256: "a".repeat(64),
  };
  const pending = {
    revision: 2,
    previous: { revision: 1, payloadSha256: "a".repeat(64) },
    repositoryBinding: "repository-a",
    payloadSha256: "b".repeat(64),
  };
  for (const candidate of [
    { ...pending, revision: 0 },
    { ...pending, revision: 2.5 },
    { ...pending, revision: 3 },
    { ...pending, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...pending, previous: null },
    { ...pending, previous: { revision: 0, payloadSha256: "a".repeat(64) } },
    { ...pending, previous: { revision: 1.5, payloadSha256: "a".repeat(64) } },
    {
      ...pending,
      previous: {
        revision: Number.MAX_SAFE_INTEGER,
        payloadSha256: "a".repeat(64),
      },
    },
    { ...pending, previous: { revision: 1, payloadSha256: "" } },
    { ...pending, previous: { revision: 1, payloadSha256: "c".repeat(64) } },
    { ...pending, payloadSha256: "" },
    { ...pending, payloadSha256: "B".repeat(64) },
    { ...pending, repositoryBinding: "repository-b" },
  ]) {
    const before = JSON.stringify(candidate);
    assert.equal(
      classifyRuntimeSnapshotReentry(
        current,
        candidate,
        "repository-a",
        "existing",
      ),
      "blocked",
    );
    assert.equal(JSON.stringify(candidate), before);
  }
  assert.equal(
    classifyRuntimeSnapshotReentry(current, pending, "", "existing"),
    "blocked",
  );
});
