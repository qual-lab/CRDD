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
      resources: 10,
      states: 12,
      transitions: 11,
      invariants: 7,
      verificationBindings: 17,
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
        "TRANS-ADMISSION-TO-OPERATION:resourcesAcquired_unknown:RES-NOT-FOUND",
      ),
    );
    assert.ok(
      result.issues.includes(
        "TRANS-ADMISSION-TO-OPERATION:verification_missing:abnormal",
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
