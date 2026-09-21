/**
 * coordinator:integration:runtime-traceabilityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:runtime-traceabilityが所有する検証責務を実行する。
 * @trace PPR-IT-018
 * @level IT
 * @scope runtime、traceability
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCoordinatorRuntimeTraceability } from "../../src/core/runtime-traceability.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

/**
 * currentTraceのTest準備責務を実行する。
 *
 * @responsibility currentTraceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-IT-018
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus currentTraceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
function currentTrace(): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "07_Quality/Registry/coordinator-runtime-traceability.json",
      ),
      "utf8",
    ),
  );
}

/**
 * repositoryReaderのTest準備責務を実行する。
 *
 * @responsibility repositoryReaderがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-IT-018
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus repositoryReaderを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
function repositoryReader(repositoryRelativePath: string): string | null {
  try {
    return fs.readFileSync(
      path.join(repositoryRoot, ...repositoryRelativePath.split("/")),
      "utf8",
    );
  } catch {
    return null;
  }
}

/**
 * Coordinator Runtime TraceはArchitecture・実在試験・検証区分を閉じるを検証する。
 *
 * @responsibility Coordinator Runtime TraceはArchitecture・実在試験・検証区分を閉じるの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Coordinator Runtime TraceはArchitecture・実在試験・検証区分を閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("Coordinator Runtime TraceはArchitecture・実在試験・検証区分を閉じる", () => {
  assert.deepEqual(
    inspectCoordinatorRuntimeTraceability(currentTrace(), repositoryReader),
    {
      status: "accepted",
      resources: 10,
      states: 32,
      transitions: 31,
      attemptClassifications: 5,
      invariants: 12,
      verificationBindings: 25,
    },
  );
});

/**
 * 参照切れ・孤立・必要検証区分の欠落を一括して拒否するを検証する。
 *
 * @responsibility 参照切れ・孤立・必要検証区分の欠落を一括して拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 参照切れ・孤立・必要検証区分の欠落を一括して拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("参照切れ・孤立・必要検証区分の欠落を一括して拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const transitions = structuredClone(trace.transitions) as Record<
    string,
    unknown
  >[];
  const bindings = structuredClone(trace.verificationBindings) as Record<
    string,
    unknown
  >[];
  const resources = structuredClone(trace.resources) as Record<
    string,
    unknown
  >[];
  resources.push({
    id: "RES-ORPHAN",
    owner: "nobody",
    kind: "test_only",
    lifecycle: "never",
  });
  transitions[0] = {
    ...transitions[0],
    resourcesAcquired: ["RES-NOT-FOUND"],
    requiredVerificationKinds: ["normal", "quasi_normal", "abnormal"],
  };
  trace.transitions = transitions;
  trace.resources = resources;
  trace.verificationBindings = bindings.filter(
    (binding) => binding.kind !== "abnormal",
  );
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION-ACQUIRING:resourcesAcquired_unknown:RES-NOT-FOUND",
      ),
    );
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION-ACQUIRING:verification_missing:abnormal",
      ),
    );
    assert.ok(result.issues.includes("resource_orphan:RES-ORPHAN"));
  }
});

/**
 * Architectureまたは実在する試験名に接続できないTraceを拒否するを検証する。
 *
 * @responsibility Architectureまたは実在する試験名に接続できないTraceを拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Architectureまたは実在する試験名に接続できないTraceを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("Architectureまたは実在する試験名に接続できないTraceを拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  trace.architectureDocument = "06_Architecture/Details/coordinator/missing.md";
  const bindings = structuredClone(trace.verificationBindings) as Record<
    string,
    unknown
  >[];
  bindings[0] = { ...bindings[0], testName: "存在しない試験" };
  trace.verificationBindings = bindings;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(result.issues.includes("architecture_document_unavailable"));
    assert.ok(result.issues.includes("VER-TASK-NORMAL:test_name_not_found"));
  }
});

/**
 * effect観測scopeとCanonical case完全一致assertionの無いTraceを拒否するを検証する。
 *
 * @responsibility effect観測scopeとCanonical case完全一致assertionの無いTraceを拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus effect観測scopeとCanonical case完全一致assertionの無いTraceを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("effect観測scopeとCanonical case完全一致assertionの無いTraceを拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  trace.effectObservationScope = "cumulative";
  const result = inspectCoordinatorRuntimeTraceability(
    trace,
    (relativePath) => {
      const source = repositoryReader(relativePath);
      return (
        source?.replaceAll(": assertRuntimeTraceCase", ": unusedTraceCase") ??
        null
      );
    },
  );
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(result.issues.includes("trace_effect_observation_scope_invalid"));
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.startsWith("VER-TASK-NORMAL:") &&
          issue.endsWith(":trace_assertion_registry_invalid"),
      ),
    );
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.startsWith("VER-RECOVERY-NORMAL:") &&
          issue.endsWith(":trace_assertion_registry_invalid"),
      ),
    );
  }
});

/**
 * Trace entityの欠落・余分field、risk typo、terminal内遷移と観測境界差を拒否するを検証する。
 *
 * @responsibility Trace entityの欠落・余分field、risk typo、terminal内遷移と観測境界差を拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Trace entityの欠落・余分field、risk typo、terminal内遷移と観測境界差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("Trace entityの欠落・余分field、risk typo、terminal内遷移と観測境界差を拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const states = structuredClone(trace.states) as Record<string, unknown>[];
  const resources = structuredClone(trace.resources) as Record<
    string,
    unknown
  >[];
  const transitions = structuredClone(trace.transitions) as Record<
    string,
    unknown
  >[];
  resources[0] = { ...resources[0], accidental: true };
  states[0] = { ...states[0], scope: "unknown_scope" };
  transitions[0] = {
    ...transitions[0],
    from: ["STATE-PROCESS-RESTART-REQUIRED"],
    risk: "hgh",
  };
  trace.resources = resources;
  trace.states = states;
  trace.transitions = transitions;
  const boundaries = structuredClone(
    trace.verificationBoundaryByBinding,
  ) as Record<string, unknown>;
  boundaries["VER-TASK-NORMAL"] = "self_claimed";
  trace.verificationBoundaryByBinding = boundaries;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes("RES-HOST-GENERATION:resource_shape_invalid"),
    );
    assert.ok(result.issues.includes("STATE-ADMISSION:state_shape_invalid"));
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION-ACQUIRING:transition_shape_invalid",
      ),
    );
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION-ACQUIRING:same_invocation_from_terminal:STATE-PROCESS-RESTART-REQUIRED",
      ),
    );
    assert.ok(
      result.issues.includes("VER-TASK-NORMAL:verification_boundary_invalid"),
    );
  }
});

/**
 * 検証caseの開始状態・終了状態・資源意味とsource別区分欠落を拒否するを検証する。
 *
 * @responsibility 検証caseの開始状態・終了状態・資源意味とsource別区分欠落を拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 検証caseの開始状態・終了状態・資源意味とsource別区分欠落を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("検証caseの開始状態・終了状態・資源意味とsource別区分欠落を拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const bindings = structuredClone(trace.verificationBindings) as Record<
    string,
    unknown
  >[];
  const taskNormal = bindings.find(
    (binding) => binding.id === "VER-TASK-NORMAL",
  );
  assert.ok(taskNormal);
  const cases = structuredClone(taskNormal.cases) as Record<string, unknown>[];
  cases[0] = {
    ...cases[0],
    fromState: "STATE-TASK-AUTHORIZED",
    expectedEndState: "STATE-RESULT-PUBLISHED",
    resourcePostconditions: { "RES-CANDIDATE-ENTRY": "unknown" },
  };
  taskNormal.cases = cases;
  trace.verificationBindings = bindings;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes(
        "VER-TASK-NORMAL:case_from_state_mismatch:TRANS-ADMISSION-TO-OPERATION-ACQUIRING",
      ),
    );
    assert.ok(
      result.issues.includes(
        "VER-TASK-NORMAL:case_taken_end_state_mismatch:TRANS-ADMISSION-TO-OPERATION-ACQUIRING",
      ),
    );
    assert.ok(
      result.issues.includes(
        "VER-TASK-NORMAL:case_resource_postcondition_invalid:RES-CANDIDATE-ENTRY",
      ),
    );
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION-ACQUIRING:verification_case_missing:STATE-ADMISSION:normal",
      ),
    );
  }
});

/**
 * 検証caseのsource未接続・未観測資源・拒否結果の誤到達を拒否するを検証する。
 *
 * @responsibility 検証caseのsource未接続・未観測資源・拒否結果の誤到達を拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 検証caseのsource未接続・未観測資源・拒否結果の誤到達を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("検証caseのsource未接続・未観測資源・拒否結果の誤到達を拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const bindings = structuredClone(trace.verificationBindings) as Record<
    string,
    unknown
  >[];
  const taskNormal = bindings.find(
    (binding) => binding.id === "VER-TASK-NORMAL",
  );
  assert.ok(taskNormal);
  const cases = structuredClone(taskNormal.cases) as Record<string, unknown>[];
  const duplicate = {
    ...cases[0],
    id: "CASE-NOT-CONNECTED-TO-SOURCE",
  };
  cases.push(duplicate);
  cases[0] = { ...cases[0], outcome: "rejected" };
  taskNormal.cases = cases;
  taskNormal.observedResources = (
    taskNormal.observedResources as string[]
  ).filter((resource) => resource !== "RES-CANDIDATE-ENTRY");
  trace.verificationBindings = bindings;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes(
        "VER-TASK-NORMAL:case_rejected_reaches_to:TRANS-ADMISSION-TO-OPERATION-ACQUIRING",
      ),
    );
    assert.ok(result.issues.includes("VER-TASK-NORMAL:test_case_id_not_found"));
    assert.ok(
      result.issues.includes(
        "VER-TASK-NORMAL:case_resource_not_observed:RES-CANDIDATE-ENTRY",
      ),
    );
  }
});

/**
 * bindingが宣言するだけでcaseが観測しない資源を拒否するを検証する。
 *
 * @responsibility bindingが宣言するだけでcaseが観測しない資源を拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus bindingが宣言するだけでcaseが観測しない資源を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("bindingが宣言するだけでcaseが観測しない資源を拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const bindings = structuredClone(trace.verificationBindings) as Record<
    string,
    unknown
  >[];
  const partial = bindings.find(
    (binding) => binding.id === "VER-PARTIAL-PAIR-ABNORMAL",
  );
  assert.ok(partial);
  partial.observedResources = [
    ...(partial.observedResources as string[]),
    "RES-CANDIDATE-ENTRY",
  ];
  trace.verificationBindings = bindings;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes(
        "VER-PARTIAL-PAIR-ABNORMAL:RES-CANDIDATE-ENTRY:observed_resource_unused",
      ),
    );
  }
});

/**
 * 拒否試行を実遷移または状態変更として記録するTraceを拒否するを検証する。
 *
 * @responsibility 拒否試行を実遷移または状態変更として記録するTraceを拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 拒否試行を実遷移または状態変更として記録するTraceを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("拒否試行を実遷移または状態変更として記録するTraceを拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const bindings = structuredClone(trace.verificationBindings) as Record<
    string,
    unknown
  >[];
  const binding = bindings.find(
    (candidate) =>
      candidate.id === "VER-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE",
  );
  assert.ok(binding);
  const cases = structuredClone(binding.cases) as Record<string, unknown>[];
  cases[0] = {
    ...cases[0],
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-PUBLISHED",
  };
  binding.cases = cases;
  trace.verificationBindings = bindings;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes(
        "VER-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE:case_attempt_outcome_invalid:ATTEMPT-REPAIR-HISTORY-FOREIGN-PREPARE",
      ),
    );
    assert.ok(
      result.issues.includes(
        "VER-REPAIR-HISTORY-PUBLICATION-FOREIGN-PREPARE:case_attempt_mutates_state:ATTEMPT-REPAIR-HISTORY-FOREIGN-PREPARE",
      ),
    );
  }
});

/**
 * operation terminalからの遷移と非terminalからのRecovery invocationを拒否するを検証する。
 *
 * @responsibility operation terminalからの遷移と非terminalからのRecovery invocationを拒否するの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus operation terminalからの遷移と非terminalからのRecovery invocationを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
test("operation terminalからの遷移と非terminalからのRecovery invocationを拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const transitions = structuredClone(trace.transitions) as Record<
    string,
    unknown
  >[];
  transitions[0] = {
    ...transitions[0],
    from: ["STATE-PROCESS-RESTART-REQUIRED"],
  };
  transitions[1] = {
    ...transitions[1],
    invocation: "recovery",
  };
  trace.transitions = transitions;
  const result = inspectCoordinatorRuntimeTraceability(trace, repositoryReader);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION-ACQUIRING:from_operation_terminal:STATE-PROCESS-RESTART-REQUIRED",
      ),
    );
    assert.ok(
      result.issues.includes(
        "TRANS-OPERATION-ACQUIRING-TO-READY:recovery_from_nonrecoverable:STATE-OPERATION-ACQUIRING",
      ),
    );
  }
});
