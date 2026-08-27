export type HostGenerationLossEvent =
  | "failure_detected"
  | "cleanup_confirmed_failure"
  | "cleanup_unknown";

export function reduceHostGenerationLossTransition(
  event: HostGenerationLossEvent,
) {
  return Object.freeze({
    retired: true,
    revokeEffectCapabilities: true,
    beginEffectDrain: event === "failure_detected",
    poisonProcess: event === "cleanup_unknown",
  });
}
