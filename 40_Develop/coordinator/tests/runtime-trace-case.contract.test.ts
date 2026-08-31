import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRuntimeTraceCase,
  getRuntimeTraceCase,
} from "./runtime-trace-case.ts";

test("実観測のEffect差分がCanonical値から1件でもずれれば拒否する", () => {
  const canonical = getRuntimeTraceCase("CASE-RECOVERY-TO-RECOVERED");
  assert.throws(
    () =>
      assertRuntimeTraceCase(canonical.id, {
        ...canonical,
        effectObservations: {
          ...canonical.effectObservations,
          cleanup: canonical.effectObservations.cleanup + 1,
        },
      }),
    assert.AssertionError,
  );
});
