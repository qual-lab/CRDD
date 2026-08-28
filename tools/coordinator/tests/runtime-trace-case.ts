import assert from "node:assert/strict";
import fs from "node:fs";

export type RuntimeTraceCase = Readonly<{
  id: string;
  transitionId: string;
  fromState: string;
  outcome: string;
  expectedEndState: string;
  effectObservations: Readonly<{
    provider: number;
    host: number;
    cleanup: number;
  }>;
  expectedStatus: string;
  resourcePostconditions: Readonly<Record<string, string>>;
}>;

const runtimeTrace = JSON.parse(
  fs.readFileSync(
    new URL(
      "../runtime/coordinator-runtime-traceability.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  effectObservationScope: string;
  verificationBindings: Array<{ cases: RuntimeTraceCase[] }>;
};
const traceCases = new Map(
  runtimeTrace.verificationBindings.flatMap((binding) =>
    binding.cases.map((candidate) => [candidate.id, candidate] as const),
  ),
);

export function getRuntimeTraceCase(caseId: string) {
  const candidate = traceCases.get(caseId);
  assert.ok(candidate, `missing canonical trace case: ${caseId}`);
  return candidate;
}

export function assertRuntimeTraceCase(
  caseId: string,
  observed: RuntimeTraceCase,
) {
  assert.equal(runtimeTrace.effectObservationScope, "transition_delta");
  assert.deepEqual(observed, getRuntimeTraceCase(caseId));
}
