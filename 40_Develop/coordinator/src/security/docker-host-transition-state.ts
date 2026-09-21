import { createHash } from "node:crypto";

import { parseHostRecoveryToken } from "./host-recovery-record.ts";

/**
 * canonicalの処理を実行する。
 *
 * @responsibility canonicalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalの入力契約を満たす。
 * @postcondition canonicalの責務を完了した結果だけを返す。
 * @effect N/A: canonicalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalは独自の失敗分岐を所有しない。
 * @invariant canonicalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalはProcess内の同一Subsystemで完結する。
 * @security canonicalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalは共有非同期状態を持たない同期処理である。
 */
function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

/**
 * validateDockerHostTransitionLineageの処理を実行する。
 *
 * @responsibility validateDockerHostTransitionLineageに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown、requiredNextState: string
 * @returns validateDockerHostTransitionLineageの計算結果を返す。
 * @precondition 「value: unknown、requiredNextState: string」がvalidateDockerHostTransitionLineageの入力契約を満たす。
 * @postcondition validateDockerHostTransitionLineageの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerHostTransitionLineageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateDockerHostTransitionLineageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateDockerHostTransitionLineageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerHostTransitionLineageはProcess内の同一Subsystemで完結する。
 * @security validateDockerHostTransitionLineageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerHostTransitionLineageは共有非同期状態を持たない同期処理である。
 */
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
