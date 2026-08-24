export const DOCKER_RECOVERY_STATE_MACHINE_CONTRACT =
  "crdd-coordinator/docker-recovery-state-machine";
export const DOCKER_RECOVERY_STATE_MACHINE_CONTRACT_REVISION = 1;

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
  identityOrContentMismatch: boolean,
  expectedEntryCount: number,
) {
  if (
    unknownEntryPresent ||
    identityOrContentMismatch ||
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
  });
}
