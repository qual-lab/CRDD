export const DOCKER_RECOVERY_STATE_MACHINE_CONTRACT =
  "crdd-coordinator/docker-recovery-state-machine";
export const DOCKER_RECOVERY_STATE_MACHINE_CONTRACT_REVISION = 2;

export function releaseRecoverySynchronizations(
  attempts: readonly Readonly<{
    release: () => boolean;
    reason: string;
  }>[],
) {
  let firstFailure: string | null = null;
  for (const attempt of attempts) {
    try {
      if (!attempt.release()) firstFailure ??= attempt.reason;
    } catch {
      firstFailure ??= attempt.reason;
    }
  }
  return firstFailure;
}

export function classifyCommittedPairDeleteState(
  contentPresent: boolean,
  commitPresent: boolean,
) {
  if (contentPresent && commitPresent) return "remove_content" as const;
  if (!contentPresent && commitPresent) return "remove_commit" as const;
  if (!contentPresent && !commitPresent) return "complete" as const;
  return "third_state" as const;
}

export function classifyCommittedPairMoveState(
  sourceContentPresent: boolean,
  sourceCommitPresent: boolean,
  targetContentPresent: boolean,
  targetCommitPresent: boolean,
) {
  if (
    sourceContentPresent &&
    sourceCommitPresent &&
    !targetContentPresent &&
    !targetCommitPresent
  )
    return "move_content" as const;
  if (
    !sourceContentPresent &&
    sourceCommitPresent &&
    targetContentPresent &&
    !targetCommitPresent
  )
    return "move_commit" as const;
  if (
    !sourceContentPresent &&
    !sourceCommitPresent &&
    targetContentPresent &&
    targetCommitPresent
  )
    return "complete" as const;
  return "third_state" as const;
}

export function classifyCleanupDirectoryState(
  directoryPresent: boolean,
  unknownEntryPresent: boolean,
  hasIdentityOrContentMismatch: boolean,
  expectedEntryCount: number,
) {
  if (
    unknownEntryPresent ||
    hasIdentityOrContentMismatch ||
    !Number.isSafeInteger(expectedEntryCount) ||
    expectedEntryCount < 0
  )
    return "third_state" as const;
  if (!directoryPresent) return "complete" as const;
  return expectedEntryCount === 0
    ? ("remove_directory" as const)
    : ("remove_expected_entries" as const);
}

export function describeDockerRecoveryStateMachineContract() {
  return Object.freeze({
    deleteKnownStates: Object.freeze([
      "remove_content",
      "remove_commit",
      "complete",
    ]),
    moveKnownStates: Object.freeze(["move_content", "move_commit", "complete"]),
    cleanupSuccessResidue: 0,
    thirdStateTreatment: "preserve_evidence_and_fail_closed",
    lockReleaseTreatment: "attempt_all_and_report_first_failure",
  });
}
