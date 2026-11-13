/**
 * orchestrator:unit:state-queryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:state-queryが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @trace PRL-UT-006
 * @level UT
 * @scope project、runtime、state、query、public
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import type { ProjectExecutionState } from "../../../../execution-model/src/index.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { createCoordinatorState } from "../../../src/state/create.ts";
import type { CoordinatorStatePort } from "../../../src/state/persistence.ts";

import {
  executeCoordinatorPublicStateQuery,
  queryCoordinatorState,
} from "../../../src/state/query.ts";
import { taskExecutionSelections } from "../../fixtures/ai-selection.ts";

/**
 * 既存State照会の受付世代だけでPortを構成する。
 * @responsibility 内部Reader廃止後も同じ世代と未初期化・解放不明の分類を維持する。
 * @trace PRL-UT-006
 * @precondition Source本文と有限なReader返却値だけを使う。
 * @stimulus 正常値、真正不存在、読取り失敗、解放不明を与える。
 * @observation 固定intake view、一回の照会、元epochと構成停止理由。
 * @oracle 不明を補完せず、正常時だけ同じepochでPortを作る。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Co構成とEMの既存State照会。
 */
test("現在Port構成はStateのintake viewだけを一度取得する", () => {
  const source = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../../src/state/transaction.ts", import.meta.url),
        "utf8",
      ),
      "createCurrentCoordinatorPersistencePorts",
    ),
    { mode: "strip" },
  );
  const root = {};
  let calls = 0;
  let reply: unknown = {
    status: "completed",
    reason: "ready",
    value: { intakeEpoch: "epoch-a" },
  };
  const port = {};
  const create = new Function(
    "readState",
    "verifyRuntimePersistenceRepository",
    "createCoordinatorSnapshotPersistencePorts",
    `${source}; return createCurrentCoordinatorPersistencePorts;`,
  )(
    (actual: unknown, binding: string, scope: string) => {
      calls++;
      assert.equal(actual, root);
      assert.equal(binding, "binding-a");
      assert.equal(scope, "intake");
      return reply;
    },
    () => root,
    (directory: string, binding: string, epoch: string) => {
      assert.equal(directory, "fixture-root");
      assert.equal(binding, "binding-a");
      assert.equal(epoch, "epoch-a");
      return port;
    },
  );
  assert.equal(create("fixture-root", "binding-a"), port);
  for (const [value, expected] of [
    [
      { status: "completed", reason: "absent", value: null },
      "orchestrator_snapshot_not_initialized",
    ],
    [
      { status: "blocked", reason: "read_unknown", value: null },
      "orchestrator_snapshot_not_initialized",
    ],
    [
      {
        status: "blocked",
        reason: "orchestrator_snapshot_lock_release_unconfirmed",
        value: null,
      },
      "orchestrator_snapshot_lock_release_unconfirmed",
    ],
  ] as const) {
    reply = value;
    assert.throws(() => create("fixture-root", "binding-a"), {
      message: expected,
    });
  }
  assert.equal(calls, 4);
});

/**
 * 公開状態照会の本番本文が同じ保存版から表示を作ることを確認する。
 * @responsibility 再読取り削減と採用確認前後のfresh観測を区別する。
 * @trace PPR-UT-006
 * @precondition 正規の状態値と有限のRepository・保存観測を使う。
 * @stimulus 同改訂・採用済み別改訂・対象不存在・読取り不明を与える。
 * @observation 読取り数・採用確認数・同版の世代と受付世代。
 * @oracle 通常は一回、採用確認を挟む場合は二回取得し、追加Portを構築しない。
 * @cleanup N/A: Sourceの読取りと有限のメモリ代役だけ。
 * @boundary Co照会本文と固定下位結果。実Git・Lockの成立は主張しない。
 */
test("公開状態照会は同版のProjectと受付世代を使い採用確認後だけ再取得する", () => {
  const source = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../../src/state/query.ts", import.meta.url),
        "utf8",
      ),
      "executeCoordinatorPublicStateQuery",
    ),
    { mode: "strip" },
  );
  for (const mode of ["current", "adopted", "absent", "unknown"] as const) {
    const state = runtimeState();
    const capability = {};
    let reads = 0;
    let adoptionChecks = 0;
    let displayedEpoch: string | null = null;
    const dependencies = {
      inspectCoordinatorStateQuery: () => request,
      isPrincipalId: () => true,
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => "fixture-root",
      getRepository: () => ({ capability }),
      readRepositorySnapshot: () => ({
        revisionIdentity: mode === "adopted" ? "b".repeat(40) : revision,
      }),
      verifyRuntimePersistenceRepository: () => capability,
      deriveCoordinatorRepositoryBindingId: () => "binding-a",
      readState: (root: unknown, binding: string, scope: string) => {
        assert.strictEqual(root, capability);
        assert.equal(binding, "binding-a");
        assert.equal(scope, "execution");
        reads++;
        if (mode === "unknown")
          return {
            status: "blocked",
            value: null,
            manualRecoveryRequired: true,
          };
        return {
          status: "completed",
          value: {
            projects:
              mode === "absent" ? [] : [{ ...state, generation: reads }],
            queueEntries: [],
            intakeEpoch: `epoch-${reads}`,
            schemaRevision: 7,
          },
        };
      },
      workspacePlanReadyForAcceptance: () => {
        adoptionChecks++;
        assert.equal(reads, 1);
        return true;
      },
      createCurrentCoordinatorPersistencePorts: () =>
        assert.fail("unexpected_state_reread"),
      queryCoordinatorState: (
        reader: Pick<CoordinatorStatePort, "readState">,
        query: typeof request,
        epoch: string,
      ) => {
        displayedEpoch = epoch;
        return queryCoordinatorState(reader, query, epoch);
      },
      COORDINATOR_PUBLIC_RUNTIME_CONTRACT: "public-fixture",
      COORDINATOR_STATE_QUERY_CONTRACT: "query-fixture",
    };
    const evaluate = new Function(
      ...Object.keys(dependencies),
      `${source}; return executeCoordinatorPublicStateQuery;`,
    )(...Object.values(dependencies));
    const result = evaluate(request, "fixture-root", {
      principalId: "local:fixture",
    });
    assert.equal(reads, mode === "adopted" ? 2 : 1, mode);
    assert.equal(adoptionChecks, mode === "adopted" ? 1 : 0, mode);
    if (mode === "unknown") {
      assert.equal(result.status, "blocked");
      assert.equal(result.observationState, "unknown");
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(displayedEpoch, null);
    } else {
      assert.equal(result.status, "completed");
      assert.equal(
        result.observationState,
        mode === "absent" ? "absent" : "observed",
      );
      assert.equal(displayedEpoch, `epoch-${reads}`);
      assert.equal(result.intakeEpoch, displayedEpoch);
      if (mode !== "absent") assert.equal(result.projection.generation, reads);
    }
  }
});

const revision = "a".repeat(40);
const request = Object.freeze({
  requestId: "query-a",
  projectId: "project-a",
  repositoryRevision: revision,
});

/**
 * Host Storeを渡さない公開照会でも、認証Contextの欠測を拒否する。
 * @trace PPR-UT-006
 * @precondition 正規の照会要求と、参照してはならない所在を使う。
 * @stimulus 認証Contextなし又は不正Principalで照会する。
 * @observation 本人確認の固定拒否理由とEffect状態。
 * @oracle Repositoryを解決する前に認証不足で停止する。
 * @cleanup N/A: 読取り・保存前の拒否のみ。
 * @boundary 同一Processの公開入力検査。認証そのものの実測ではない。
 */
test("公開状態照会はHost Storeを認証の代替にせず未認証入力を拒否する", () => {
  for (const authentication of [undefined, { principalId: "" }]) {
    const result = executeCoordinatorPublicStateQuery(
      request,
      "must-not-be-read",
      authentication,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "orchestrator_authenticated_principal_not_verified",
    );
    assert.equal(result.effectState, "no_effect");
  }
});

/**
 * runtimeStateのTest準備責務を実行する。
 *
 * @responsibility runtimeStateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runtimeStateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function runtimeState(): ProjectExecutionState {
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: request.projectId,
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["Objectiveが受理される"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["Taskが完了する"] }],
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
  assert.ok(created.state);
  return created.state;
}

/**
 * readerのTest準備責務を実行する。
 *
 * @responsibility readerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus readerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function reader(
  result: ReturnType<CoordinatorStatePort["readState"]>,
): Pick<CoordinatorStatePort, "readState"> {
  return Object.freeze({ readState: () => result });
}

/**
 * 状態参照は閉じた要求だけを受け入れるを検証する。
 *
 * @responsibility 状態参照は閉じた要求だけを受け入れるの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態参照は閉じた要求だけを受け入れるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態参照は閉じた要求だけを受け入れる", () => {
  assert.deepEqual(inspectCoordinatorStateQuery(request), request);
  assert.equal(
    inspectCoordinatorStateQuery({ ...request, unexpected: true }),
    null,
  );
});

/**
 * 状態参照はCoordinatorのcanonical投影だけを返すを検証する。
 *
 * @responsibility 状態参照はCoordinatorのcanonical投影だけを返すの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態参照はCoordinatorのcanonical投影だけを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態参照はOrchestratorのcanonical投影だけを返す", () => {
  const result = queryCoordinatorState(
    reader({ status: "completed", reason: "observed", value: runtimeState() }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "observed");
  assert.equal(result.projection?.projectId, request.projectId);
  assert.equal(result.effectState, "no_effect");
  assert.deepEqual(inspectCoordinatorStateQueryResult(result), result);
  assert.equal(
    inspectCoordinatorStateQueryResult({
      ...result,
      contract: "crdd-coordinator/orchestrator-public-runtime/v1",
    }),
    null,
  );
});

/**
 * 状態不存在は失敗や成功推定ではなくabsent観測として返すを検証する。
 *
 * @responsibility 状態不存在は失敗や成功推定ではなくabsent観測として返すの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態不存在は失敗や成功推定ではなくabsent観測として返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態不存在は失敗や成功推定ではなくabsent観測として返す", () => {
  const result = queryCoordinatorState(
    reader({ status: "completed", reason: "absent", value: null }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "absent");
  assert.equal(result.projection, null);
});

/**
 * 異なるRepository改訂版の状態を現在値として返さないを検証する。
 *
 * @responsibility 異なるRepository改訂版の状態を現在値として返さないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 異なるRepository改訂版の状態を現在値として返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("異なるRepository改訂版の状態を現在値として返さない", () => {
  const result = queryCoordinatorState(
    reader({
      status: "completed",
      reason: "observed",
      value: { ...runtimeState(), repositoryRevision: "b".repeat(40) },
    }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "orchestrator_state_revision_mismatch");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.projection, null);
});

/**
 * 観測不能と既存Recovery義務をEffect発行と混同しないを検証する。
 *
 * @responsibility 観測不能と既存Recovery義務をEffect発行と混同しないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測不能と既存Recovery義務をEffect発行と混同しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("観測不能と既存Recovery義務をEffect発行と混同しない", () => {
  const result = queryCoordinatorState(
    reader({
      status: "blocked",
      reason: "store_unavailable",
      value: null,
      manualRecoveryRequired: true,
      recoveryId: "recovery-a",
    }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.effectState, "no_effect");
});

import { parseRuntimeActivityObservation } from "../../../src/state/observation.ts";
import {
  inspectCoordinatorStateQuery,
  inspectCoordinatorStateQueryResult,
} from "../../../src/state/projection.ts";

/**
 * 取得済み活動観測を量だけで欠測へ変えない。
 * @trace PRL-UT-006
 * @precondition 10001出所と単発記録、51履歴eventの合成値を使う。
 * @stimulus 完全集合と重複・不明参照・閉Schema違反を渡す。
 * @observation 保持された件数と不正時のnull。
 * @oracle 観測済み内容の量とSchema・Identity相関を区別する。
 * @cleanup N/A: 純粋値だけ。
 */
test("活動結果は10001出所・単発記録と51eventを保持する", () => {
  const sources = Array.from({ length: 10001 }, (_, index) => ({
    repositoryId: `repo-${index.toString().padStart(5, "0")}`,
    revision: "a".repeat(40),
  }));
  const singleTasks = sources.map((source, index) => ({
    repositoryId: source.repositoryId,
    requestId: `request-${index}`,
    mode: "workspace_edit",
    phase: "settled",
    status: "unknown",
    cleanupConfirmed: false,
    recoveryRequired: true,
  }));
  const events = Array.from({ length: 51 }, (_, index) => ({
    repositoryId: sources[0]?.repositoryId,
    eventId: `execution-${(50 - index).toString(16).padStart(64, "0")}`,
    occurredAt: "2026-11-12T00:00:00.000Z",
    objectiveId: "objective-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    status: "unknown",
    reason: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
  }));
  const raw = {
    projectId: "project-a",
    state: "absent",
    reason: "runtime_activity_state_absent",
    projection: null,
    currentSourceRepositoryId: null,
    sources,
    eventState: "observed",
    eventReason: "runtime_activity_events_observed",
    events,
    eventContinuation: null,
    singleTasks,
  };
  const observed = parseRuntimeActivityObservation(raw);
  assert.equal(observed?.sources.length, 10001);
  assert.equal(observed?.singleTasks?.length, 10001);
  assert.equal(observed?.events.length, 51);
  assert.equal(
    parseRuntimeActivityObservation({
      ...raw,
      sources: [...sources, sources[0]],
    }),
    null,
  );
  assert.equal(
    parseRuntimeActivityObservation({ ...raw, events: [...events, events[0]] }),
    null,
  );
  assert.equal(
    parseRuntimeActivityObservation({
      ...raw,
      singleTasks: [{ ...singleTasks[0], repositoryId: "missing" }],
    }),
    null,
  );
});
