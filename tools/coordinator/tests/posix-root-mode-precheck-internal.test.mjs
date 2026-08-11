import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePosixRuntimeRootModeObservationForInternalUse
} from "../src/security/posix-root-mode-precheck-internal.mjs";

function observation(overrides = {}) {
  return { ownerUid: 1000n, effectiveUid: 1000n, mode: 0o40700n, ...overrides };
}

test("POSIX Runtime Rootのcurrent owner、owner rwxおよび追加write bitをprecheckする", () => {
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(observation()).passed, true);
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(
    observation({ mode: 0o40755n })).passed, true);
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(
    observation({ ownerUid: 1001n })).reason, "posix_runtime_root_current_owner_mismatch");
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(
    observation({ mode: 0o40600n })).reason, "posix_runtime_root_owner_rwx_required");
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(
    observation({ mode: 0o40720n })).reason,
  "posix_runtime_root_additional_write_bits_rejected");
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(
    observation({ mode: 0o40702n })).reason,
  "posix_runtime_root_additional_write_bits_rejected");
});

test("POSIX mode precheckの内部観測もexact plain-dataだけを受理する", () => {
  const extra = observation();
  extra.extra = true;
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(extra).reason,
    "posix_mode_observation_invalid");
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(
    observation({ ownerUid: 1000 })).reason, "posix_mode_observation_invalid");
  let getterCalls = 0;
  const accessor = observation();
  Object.defineProperty(accessor, "mode", {
    enumerable: true,
    get() { getterCalls += 1; return 0o40700n; }
  });
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(accessor).reason,
    "posix_mode_observation_invalid");
  assert.equal(getterCalls, 0);
  assert.equal(evaluatePosixRuntimeRootModeObservationForInternalUse(new Proxy(observation(), {}))
    .reason, "posix_mode_observation_invalid");
});
