/**
 * Runtimeの観測結果を共通の契約条件で判定する。
 *
 * @packageDocumentation
 * @responsibility 各試験が取得した結果・Effect・回収状態を比較し、未観測を成功へ丸めない。
 * @trace PPR-UT-006
 * @trace CPR-IT-001
 * @trace ERB-IT-001
 * @trace ERB-IT-006
 * @trace ERB-IT-008
 * @trace ERB-IT-012
 * @trace ERB-IT-014
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @level UT
 * @level IT
 * @scope 観測DTOと契約assertion
 * @boundary N/A: 渡された観測値を判定するだけで、実資源の観測・回収自体は行わない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

type RuntimeTraceCommonObservation = Readonly<{
  id: string;
  outcome: string;
  effectObservations: Readonly<{
    provider: number;
    host: number;
    cleanup: number;
  }>;
  expectedStatus: string;
  resourcePostconditions: Readonly<Record<string, string>>;
}>;

export type RuntimeTraceCase = RuntimeTraceCommonObservation &
  Readonly<
    | {
        transitionId: string;
        attemptClassificationId?: never;
        fromState: string;
        expectedEndState: string;
      }
    | {
        transitionId?: never;
        attemptClassificationId: string;
        fromState: string;
        expectedEndState: string;
      }
    | {
        transitionId?: never;
        attemptClassificationId: string;
        localAttemptObservation: string;
        finalGlobalObservation: Readonly<{ state: string }>;
        fromState?: never;
        expectedEndState?: never;
      }
  >;

const runtimeTrace = JSON.parse(
  fs.readFileSync(
    new URL(
      "../../../../07_Quality/Registry/coordinator-runtime-traceability.json",
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
