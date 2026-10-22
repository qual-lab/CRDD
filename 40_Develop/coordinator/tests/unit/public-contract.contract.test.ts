/**
 * orchestrator:unit:public-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:public-contractが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope project、runtime、public、contract
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectCoordinatorDecisionRequest,
  COORDINATOR_HUMAN_DECISION_CONTRACT,
} from "../../src/decision/request.ts";
import { inspectCoordinatorObjectiveRequest } from "../../src/objective/request.ts";
import { isCoordinatorDecisionRecord } from "../../src/decision/records.ts";
import { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "../../src/operation-result-contract.ts";
import {
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
} from "../../src/task/executor.ts";

const repositoryRevision = "a".repeat(40);

/**
 * Execution Portは既存Single Task結果契約を意味変更せず所有するを検証する。
 *
 * @responsibility Execution Portは既存Single Task結果契約を意味変更せず所有するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Execution Portは既存Single Task結果契約を意味変更せず所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Execution Portは既存Single Task結果契約を意味変更せず所有する", () => {
  assert.equal(
    COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    "crdd-coordinator/orchestrator-single-task-adapter",
  );
  assert.equal(COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION, 3);
});

/**
 * objectiveRequestのTest準備責務を実行する。
 *
 * @responsibility objectiveRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus objectiveRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
function objectiveRequest() {
  return {
    requestId: "request-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    repositoryRevision,
    objective: "公開契約を検証する",
    acceptanceCriteria: ["閉じた入力だけを受理する"],
    allowedPaths: ["40_Develop/coordinator"],
    readPaths: ["06_Architecture/orchestrator"],
    maximumConcurrency: 2,
    maximumReplans: 1,
    originLane: "interactive",
    adoptResult: false,
    intakeEpoch: "fixture-epoch",
  } as const;
}

/**
 * decisionRequestのTest準備責務を実行する。
 *
 * @responsibility decisionRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus decisionRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
function decisionRequest() {
  return {
    decisionId: "decision-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    generation: 2,
    repositoryRevision,
    selectedOption: "resume",
    continuationCapability: "opaque-capability",
    comment: "再開する",
  } as const;
}

/**
 * Objective要求は閉じた公開契約へsnapshotするを検証する。
 *
 * @responsibility Objective要求は閉じた公開契約へsnapshotするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective要求は閉じた公開契約へsnapshotするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective要求は閉じた公開契約へsnapshotする", () => {
  assert.equal(
    COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
    "crdd-coordinator/orchestrator-public-runtime/v1",
  );
  const source = objectiveRequest();
  const inspected = inspectCoordinatorObjectiveRequest(source);
  assert.ok(inspected);
  assert.notEqual(inspected, source);
  assert.ok(Object.isFrozen(inspected));
  assert.ok(Object.isFrozen(inspected.acceptanceCriteria));
});

/**
 * Objectiveの任意四項目を全組合せで固定する。
 *
 * @responsibility 明示Profile／Workspaceのexact搬送と省略時の非生成を全十六組合せで検証する。
 * @trace PRL-UT-014
 * @precondition 正常なObjectiveと四つの任意入力を使用する。
 * @stimulus 四項目の有無を全十六組合せで入力検査へ渡す。
 * @observation Snapshot全体、Profile ID、所有Propertyと不変性を確認する。
 * @oracle 同じ入力だけが固定され、省略したProfileを補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary N/A: 純粋な入力検査。
 */
test("Objectiveの任意四項目は全十六組合せでexactにsnapshotする", () => {
  const optionalFieldNames = [
    {
      decisionCapabilityReplacement: {
        decisionId: "decision-1",
        replacementRequestId: "request-2",
      },
    },
    { requestedExecutorProvider: "codex" },
    { requestedProfileId: "PROFILE-100001" },
    { workspaceId: "11111111-1111-1111-1111-111111111111" },
  ];
  for (let mask = 0; mask < 16; mask += 1) {
    const source = Object.assign(
      { ...objectiveRequest() },
      ...optionalFieldNames.filter(
        (_entry, index) => (mask & (1 << index)) !== 0,
      ),
    );
    const inspected = inspectCoordinatorObjectiveRequest(source);
    assert.ok(inspected, `mask=${mask}`);
    assert.deepEqual(inspected, source);
    assert.equal(
      Object.hasOwn(inspected, "requestedProfileId"),
      (mask & 4) !== 0,
    );
    assert.ok(Object.isFrozen(inspected));
  }
  const source = {
    ...objectiveRequest(),
    requestedProfileId: "PROFILE-999999",
  };
  const inspected = inspectCoordinatorObjectiveRequest(source);
  assert.ok(inspected); // 形式受理は登録済み・利用可能の証明ではない。
  source.requestedProfileId = "PROFILE-100002";
  assert.equal(inspected.requestedProfileId, "PROFILE-999999");
});

/**
 * 不正Profileと動的入力を評価前に拒否する。
 *
 * @responsibility Profileの型・形式・閉じた形と非実行拒否を検証する。
 * @trace PRL-UT-014
 * @precondition 不正値、getterとProxy trapを持つ合成入力を使用する。
 * @stimulus Objective入力検査へ各入力を渡す。
 * @observation 拒否結果とgetter／trap呼出し件数を確認する。
 * @oracle 全件null、getter／trap呼出し0で、未知fieldも拒否する。
 * @cleanup N/A: メモリ内の入力だけを使用する。
 * @boundary N/A: 純粋な入力検査。
 */
test("ObjectiveのProfileは不正形式・Accessor・Proxyを実行せず拒否する", () => {
  for (const requestedProfileId of [
    undefined,
    null,
    1,
    {},
    "",
    "PROFILE-12345",
    "profile-100001",
    "PROFILE-100001\n",
    "PROFILE-100001/other",
  ]) {
    assert.equal(
      inspectCoordinatorObjectiveRequest({
        ...objectiveRequest(),
        requestedProfileId,
      }),
      null,
    );
  }
  let calls = 0;
  const accessor = Object.defineProperty(
    { ...objectiveRequest() },
    "requestedProfileId",
    {
      enumerable: true,
      get: () => {
        calls += 1;
        return "PROFILE-100001";
      },
    },
  );
  const proxy = new Proxy(
    { ...objectiveRequest(), requestedProfileId: "PROFILE-100001" },
    {
      ownKeys: () => {
        calls += 1;
        throw new Error("trap must not execute");
      },
      getPrototypeOf: () => {
        calls += 1;
        throw new Error("trap must not execute");
      },
    },
  );
  assert.equal(inspectCoordinatorObjectiveRequest(accessor), null);
  assert.equal(inspectCoordinatorObjectiveRequest(proxy), null);
  assert.equal(calls, 0);
  assert.equal(
    inspectCoordinatorObjectiveRequest({
      ...objectiveRequest(),
      requestedProfileId: "PROFILE-100001",
      selectionGrant: "not-authority",
    }),
    null,
  );
});

/**
 * Objective要求は未知field・accessor・ProxyをEffect前に拒否するを検証する。
 *
 * @responsibility Objective要求は未知field・accessor・ProxyをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective要求は未知field・accessor・ProxyをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective要求は未知field・accessor・ProxyをEffect前に拒否する", () => {
  assert.equal(
    inspectCoordinatorObjectiveRequest({ ...objectiveRequest(), extra: 1 }),
    null,
  );
  assert.equal(
    inspectCoordinatorObjectiveRequest(
      Object.defineProperty({ ...objectiveRequest() }, "objective", {
        get: () => "shape-shifting",
        enumerable: true,
      }),
    ),
    null,
  );
  assert.equal(
    inspectCoordinatorObjectiveRequest(new Proxy(objectiveRequest(), {})),
    null,
  );
  const symbolExtended = { ...objectiveRequest() } as Record<
    PropertyKey,
    unknown
  >;
  symbolExtended[Symbol("hidden")] = true;
  assert.equal(inspectCoordinatorObjectiveRequest(symbolExtended), null);
  const nonEnumerableExtended = Object.defineProperty(
    { ...objectiveRequest() },
    "hidden",
    { value: true },
  );
  assert.equal(inspectCoordinatorObjectiveRequest(nonEnumerableExtended), null);
  const alteredCriteria = [...objectiveRequest().acceptanceCriteria];
  Object.setPrototypeOf(alteredCriteria, null);
  assert.equal(
    inspectCoordinatorObjectiveRequest({
      ...objectiveRequest(),
      acceptanceCriteria: alteredCriteria,
    }),
    null,
  );
});

/**
 * Objective要求はRepository外を指すPath表現をEffect前に拒否するを検証する。
 *
 * @responsibility Objective要求はRepository外を指すPath表現をEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective要求はRepository外を指すPath表現をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective要求はRepository外を指すPath表現をEffect前に拒否する", () => {
  for (const pathValue of [
    "C:\\project\\outside",
    "/absolute/path",
    "../outside",
    "inside/../outside",
    "inside//file",
  ]) {
    assert.equal(
      inspectCoordinatorObjectiveRequest({
        ...objectiveRequest(),
        allowedPaths: [pathValue],
      }),
      null,
    );
    assert.equal(
      inspectCoordinatorObjectiveRequest({
        ...objectiveRequest(),
        readPaths: [pathValue],
      }),
      null,
    );
  }
});

/**
 * 判断要求はTransportに依存しない閉じた公開契約へsnapshotするを検証する。
 *
 * @responsibility 判断要求はTransportに依存しない閉じた公開契約へsnapshotするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断要求はTransportに依存しない閉じた公開契約へsnapshotするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("判断要求はTransportに依存しない閉じた公開契約へsnapshotする", () => {
  assert.equal(
    COORDINATOR_HUMAN_DECISION_CONTRACT,
    "crdd-coordinator/orchestrator-human-decision/v1",
  );
  const source = decisionRequest();
  const inspected = inspectCoordinatorDecisionRequest(source);
  assert.ok(inspected);
  assert.notEqual(inspected, source);
  assert.ok(Object.isFrozen(inspected));
  assert.equal(inspected.selectedOption, "resume");
});

/**
 * 判断Store RecordはCoordinatorの閉じた意味契約で検証するを検証する。
 *
 * @responsibility 判断Store RecordはCoordinatorの閉じた意味契約で検証するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断Store RecordはCoordinatorの閉じた意味契約で検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("判断Store RecordはOrchestratorの閉じた意味契約で検証する", () => {
  const record = {
    recordId: "decision-record-1",
    decisionId: "decision-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    queueId: "queue-1",
    repositoryRevision,
    expectedGeneration: 1,
    principalId: "principal-1",
    allowedOptions: ["resume", "cancel"],
    capabilityHash: "b".repeat(64),
    expiresAtEpochMs: 1,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  } as const;
  assert.equal(isCoordinatorDecisionRecord(record), true);
  assert.equal(
    isCoordinatorDecisionRecord({ ...record, provider: "codex" }),
    false,
  );
  assert.equal(
    isCoordinatorDecisionRecord({
      ...record,
      disposition: "completed",
    }),
    false,
  );
  assert.equal(
    isCoordinatorDecisionRecord({
      ...record,
      selectedOption: "resume",
      newGeneration: 1,
    }),
    false,
  );
  assert.equal(
    isCoordinatorDecisionRecord(
      new Proxy(record, {
        getPrototypeOf: () => {
          throw new Error("untrusted-record");
        },
      }),
    ),
    false,
  );
});

/**
 * 判断要求は未知field・改行comment・不正世代をEffect前に拒否するを検証する。
 *
 * @responsibility 判断要求は未知field・改行comment・不正世代をEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断要求は未知field・改行comment・不正世代をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("判断要求は未知field・改行comment・不正世代をEffect前に拒否する", () => {
  assert.equal(
    inspectCoordinatorDecisionRequest({ ...decisionRequest(), extra: 1 }),
    null,
  );
  assert.equal(
    inspectCoordinatorDecisionRequest({
      ...decisionRequest(),
      comment: "line1\nline2",
    }),
    null,
  );
  assert.equal(
    inspectCoordinatorDecisionRequest({
      ...decisionRequest(),
      generation: 0,
    }),
    null,
  );
});
