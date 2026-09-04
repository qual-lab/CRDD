import assert from "node:assert/strict";
import fs from "node:fs";

type RuntimeTraceObservation = Readonly<{
  id: string;
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

export type RuntimeTraceCase = RuntimeTraceObservation &
  Readonly<
    | { transitionId: string; attemptClassificationId?: never }
    | { transitionId?: never; attemptClassificationId: string }
  >;

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
  verificationBindings: Array<{
    testPath: string;
    cases: RuntimeTraceCase[];
  }>;
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

export function getRuntimeTraceCaseIdsForTestPath(testPath: string) {
  return Object.freeze(
    runtimeTrace.verificationBindings
      .filter((binding) => binding.testPath === testPath)
      .flatMap((binding) => binding.cases.map((candidate) => candidate.id))
      .sort(),
  );
}

export function assertRuntimeTraceExecutionCoverage(
  testPath: string,
  registeredItems: readonly string[],
  executed: ReadonlySet<string>,
) {
  const canonicalItems = getRuntimeTraceCaseIdsForTestPath(testPath);
  assert.deepEqual(
    [...registeredItems].sort(),
    canonicalItems,
    "trace registry mismatch",
  );
  assert.deepEqual(
    [...executed].sort(),
    canonicalItems,
    "trace execution mismatch",
  );
}

export function assertRuntimeTraceCase(
  caseId: string,
  observed: RuntimeTraceCase,
) {
  assert.equal(runtimeTrace.effectObservationScope, "transition_delta");
  assert.deepEqual(observed, getRuntimeTraceCase(caseId));
}
