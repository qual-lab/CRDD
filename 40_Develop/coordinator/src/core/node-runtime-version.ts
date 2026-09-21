export const COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT =
  "crdd-coordinator/node-runtime-version";
export const COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT_REVISION = 1;
export const MINIMUM_COORDINATOR_NODE_VERSION = "24.12.0";

const MINIMUM = Object.freeze({ major: 24, minor: 12, patch: 0 });

/**
 * isSupportedCoordinatorNodeRuntimeの処理を実行する。
 *
 * @responsibility isSupportedCoordinatorNodeRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns isSupportedCoordinatorNodeRuntimeの計算結果を返す。
 * @precondition 「value: unknown」がisSupportedCoordinatorNodeRuntimeの入力契約を満たす。
 * @postcondition isSupportedCoordinatorNodeRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedCoordinatorNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedCoordinatorNodeRuntimeは独自の失敗分岐を所有しない。
 * @invariant isSupportedCoordinatorNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedCoordinatorNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: isSupportedCoordinatorNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSupportedCoordinatorNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function isSupportedCoordinatorNodeRuntime(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value);
  if (!match) return false;
  const [major, minor, patch] = match
    .slice(1)
    .map((part) => Number.parseInt(part ?? "", 10));
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  return (
    (major ?? -1) > MINIMUM.major ||
    ((major ?? -1) === MINIMUM.major &&
      ((minor ?? -1) > MINIMUM.minor ||
        ((minor ?? -1) === MINIMUM.minor && (patch ?? -1) >= MINIMUM.patch)))
  );
}

/**
 * assertSupportedCoordinatorNodeRuntimeの処理を実行する。
 *
 * @responsibility assertSupportedCoordinatorNodeRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns N/A: assertSupportedCoordinatorNodeRuntimeは戻り値を返さない。
 * @precondition 「value: unknown」がassertSupportedCoordinatorNodeRuntimeの入力契約を満たす。
 * @postcondition assertSupportedCoordinatorNodeRuntimeの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertSupportedCoordinatorNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertSupportedCoordinatorNodeRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertSupportedCoordinatorNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertSupportedCoordinatorNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: assertSupportedCoordinatorNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertSupportedCoordinatorNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function assertSupportedCoordinatorNodeRuntime(value: unknown) {
  if (!isSupportedCoordinatorNodeRuntime(value)) {
    throw new Error("coordinator_node_version_unsupported");
  }
}

/**
 * describeCoordinatorNodeRuntimeVersionContractの処理を実行する。
 *
 * @responsibility describeCoordinatorNodeRuntimeVersionContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorNodeRuntimeVersionContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorNodeRuntimeVersionContractの入力契約を満たす。
 * @postcondition describeCoordinatorNodeRuntimeVersionContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorNodeRuntimeVersionContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorNodeRuntimeVersionContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorNodeRuntimeVersionContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorNodeRuntimeVersionContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorNodeRuntimeVersionContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorNodeRuntimeVersionContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorNodeRuntimeVersionContract() {
  return Object.freeze({
    contract: COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT,
    contractRevision: COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT_REVISION,
    minimumVersion: MINIMUM_COORDINATOR_NODE_VERSION,
    checkTiming: "before_interactive_input_release_verification_or_effect",
    pathLookupAuthority: false,
    unsupportedRuntimeFallbackAllowed: false,
  });
}
