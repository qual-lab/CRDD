/**
 * Docker Task回復IDを技術的な相関成分へ解析する。
 * @responsibility 三成分の固定文法を検査し、解析結果から操作Authorityを発行しない。
 * @trace ARCH-000008
 */
const DOCKER_TASK_RECOVERY_ID =
  /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u;

/**
 * Docker Task 回復 Idを構造化値へ解析する。
 *
 * @responsibility Docker Task 回復 Idの入力文法、解析結果、不正文法の拒否境界を所有する。
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
