import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCleanupDirectoryState,
  classifyCommittedPairDeleteState,
  classifyCommittedPairMoveState,
  describeDockerRecoveryStateMachineContract,
  releaseRecoverySynchronizations,
} from "../../src/security/docker-recovery-state-machine.ts";

test("delete state machineは到達可能3状態だけを回復する", () => {
  assert.equal(classifyCommittedPairDeleteState(true, true), "remove_content");
  assert.equal(classifyCommittedPairDeleteState(false, true), "remove_commit");
  assert.equal(classifyCommittedPairDeleteState(false, false), "complete");
  assert.equal(classifyCommittedPairDeleteState(true, false), "third_state");
});

test("move state machineは16組合せ中3状態だけを回復する", () => {
  const known = new Map([
    ["1100", "move_content"],
    ["0110", "move_commit"],
    ["0011", "complete"],
  ]);
  for (let bits = 0; bits < 16; bits += 1) {
    const values = [3, 2, 1, 0].map((shift) => Boolean(bits & (1 << shift)));
    const key = values.map(Number).join("");
    assert.equal(
      classifyCommittedPairMoveState(
        values[0] ?? false,
        values[1] ?? false,
        values[2] ?? false,
        values[3] ?? false,
      ),
      known.get(key) ?? "third_state",
      key,
    );
  }
});

test("cleanup state machineは安全な完全削除とEvidence保持を分離する", () => {
  assert.equal(
    classifyCleanupDirectoryState(true, false, false, 2),
    "remove_expected_entries",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, false, false, 0),
    "remove_directory",
  );
  assert.equal(
    classifyCleanupDirectoryState(false, false, false, 0),
    "complete",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, true, false, 2),
    "third_state",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, false, true, 2),
    "third_state",
  );
  assert.deepEqual(describeDockerRecoveryStateMachineContract(), {
    deleteKnownStates: ["remove_content", "remove_commit", "complete"],
    moveKnownStates: ["move_content", "move_commit", "complete"],
    cleanupSuccessResidue: 0,
    thirdStateTreatment: "preserve_evidence_and_fail_closed",
    lockReleaseTreatment: "attempt_all_and_report_first_failure",
  });
});

test("lock release state machineは失敗後も全同期境界の解放を試す", () => {
  const attempts: string[] = [];
  assert.equal(
    releaseRecoverySynchronizations([
      {
        release: () => {
          attempts.push("runtime");
          throw new Error("fixture");
        },
        reason: "runtime_release_failed",
      },
      {
        release: () => {
          attempts.push("home");
          return false;
        },
        reason: "home_release_failed",
      },
      {
        release: () => {
          attempts.push("host");
          return true;
        },
        reason: "host_release_failed",
      },
    ]),
    "runtime_release_failed",
  );
  assert.deepEqual(attempts, ["runtime", "home", "host"]);
  assert.equal(releaseRecoverySynchronizations([]), null);
});
