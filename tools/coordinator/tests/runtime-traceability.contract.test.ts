import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCoordinatorRuntimeTraceability } from "../src/core/runtime-traceability.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function currentTrace(): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "tools/coordinator/runtime/coordinator-runtime-traceability.json",
      ),
      "utf8",
    ),
  );
}

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

test("Coordinator Runtime TraceはArchitecture・実在試験・検証区分を閉じる", () => {
  assert.deepEqual(
    inspectCoordinatorRuntimeTraceability(currentTrace(), repositoryReader),
    {
      status: "accepted",
      resources: 9,
      states: 20,
      transitions: 20,
      invariants: 9,
      verificationBindings: 8,
    },
  );
});

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

test("Architectureまたは実在する試験名に接続できないTraceを拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  trace.architectureDocument = "tools/coordinator/architecture/missing.md";
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

test("Trace entityの欠落・余分field、risk typo、terminal内遷移と観測境界差を拒否する", () => {
  const trace = currentTrace() as Record<string, unknown>;
  const resources = structuredClone(trace.resources) as Record<
    string,
    unknown
  >[];
  const transitions = structuredClone(trace.transitions) as Record<
    string,
    unknown
  >[];
  resources[0] = { ...resources[0], accidental: true };
  transitions[0] = {
    ...transitions[0],
    from: ["STATE-PROCESS-RESTART-REQUIRED"],
    risk: "hgh",
  };
  trace.resources = resources;
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

test("検証caseの重複tuple・source未接続・未観測資源・拒否結果の誤到達を拒否する", () => {
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
    assert.ok(
      result.issues.includes(
        "VER-TASK-NORMAL:case_tuple_duplicate:TRANS-ADMISSION-TO-OPERATION-ACQUIRING:STATE-ADMISSION:normal",
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
