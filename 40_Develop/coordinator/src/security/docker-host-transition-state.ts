import { createHash } from "node:crypto";

import { parseHostRecoveryToken } from "./host-recovery-record.ts";

function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

export function validateDockerHostTransitionLineage(
  value: unknown,
  requiredNextState?: string,
) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const intent = value as Record<string, unknown>;
  const currentToken = String(intent.currentToken ?? "");
  const expectedToken = String(intent.expectedToken ?? "");
  const current = parseHostRecoveryToken(currentToken);
  const expected = parseHostRecoveryToken(expectedToken);
  const recordBefore = intent.recordBefore;
  if (
    !recordBefore ||
    typeof recordBefore !== "object" ||
    Array.isArray(recordBefore) ||
    Object.getPrototypeOf(recordBefore) !== Object.prototype ||
    current.rootName !== intent.rootName ||
    expected.rootName !== intent.rootName ||
    current.nonce !== intent.nonce ||
    expected.nonce !== intent.nonce ||
    (requiredNextState !== undefined &&
      intent.nextState !== requiredNextState) ||
    typeof intent.currentState !== "string" ||
    typeof intent.nextState !== "string" ||
    intent.currentToken === intent.expectedToken
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const before = recordBefore as Record<string, unknown>;
  const beforeHash = createHash("sha256")
    .update(canonical(before))
    .digest("hex");
  const successor = Object.freeze({ ...before, state: intent.nextState });
  const successorHash = createHash("sha256")
    .update(canonical(successor))
    .digest("hex");
  if (
    current.recordHash !== beforeHash ||
    expected.recordHash !== successorHash ||
    before.state !== intent.currentState ||
    successor.state !== intent.nextState
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  return Object.freeze({ currentToken, expectedToken, current, expected });
}
