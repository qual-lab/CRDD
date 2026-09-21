const DOCKER_TASK_RECOVERY_ID =
  /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;

/**
 * isSha256Hexの処理を実行する。
 *
 * @responsibility isSha256Hexに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSha256Hexの入力契約を満たす。
 * @postcondition isSha256Hexの責務を完了した結果だけを返す。
 * @effect N/A: isSha256Hexは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSha256Hexは独自の失敗分岐を所有しない。
 * @invariant isSha256Hexは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSha256HexはProcess内の同一Subsystemで完結する。
 * @security isSha256HexはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSha256Hexは共有非同期状態を持たない同期処理である。
 */
export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

/**
 * parseDockerTaskRecoveryIdの処理を実行する。
 *
 * @responsibility parseDockerTaskRecoveryIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns parseDockerTaskRecoveryIdの計算結果を返す。
 * @precondition 「token: unknown」がparseDockerTaskRecoveryIdの入力契約を満たす。
 * @postcondition parseDockerTaskRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerTaskRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDockerTaskRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant parseDockerTaskRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDockerTaskRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security parseDockerTaskRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerTaskRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function parseDockerTaskRecoveryId(token: unknown) {
  if (typeof token !== "string") return null;
  const match = DOCKER_TASK_RECOVERY_ID.exec(token);
  return match?.[1] && match[2] && match[3]
    ? Object.freeze({
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      })
    : null;
}
