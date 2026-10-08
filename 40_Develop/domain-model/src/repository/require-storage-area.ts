/**
 * Runtime領域保存結果の検査。
 *
 * @responsibility 保存失敗の回復・cleanup情報を保持し、不正・停止結果をreadyへ畳まない。
 * @trace ARCH-000011
 */
import type {
  ensureRepositoryRuntimeDataArea,
  ensureRepositoryRuntimeDataAreaWithAdapter,
} from "../storage/ensure-area.ts";

/**
 * RepositoryRuntimeDataAreaBlockedErrorが担う状態と操作を提供する。
 *
 * @responsibility RepositoryRuntimeDataAreaBlockedErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000011
 * @construction RepositoryRuntimeDataAreaBlockedErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle RepositoryRuntimeDataAreaBlockedErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: RepositoryRuntimeDataAreaBlockedErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: RepositoryRuntimeDataAreaBlockedErrorの宣言自体は実行時失敗を所有しない。
 * @invariant RepositoryRuntimeDataAreaBlockedErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRuntimeDataAreaBlockedErrorの宣言は外部境界を開かない。
 * @security N/A: RepositoryRuntimeDataAreaBlockedErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: RepositoryRuntimeDataAreaBlockedErrorは共有非同期状態を持たない同期処理である。
 */
export class RepositoryRuntimeDataAreaBlockedError extends Error {
  readonly reason: string;
  readonly effectIssued: boolean;
  readonly effectStateUnknown: boolean;
  readonly cleanupConfirmed: boolean;
  readonly retryAllowed: boolean;
  readonly recoveryReference: string | null;
  readonly repositoryPathReported = false as const;

  constructor(
    result: Exclude<
      ReturnType<typeof ensureRepositoryRuntimeDataAreaWithAdapter>,
      null | { status: "ready" }
    >,
  ) {
    super(result.reason);
    this.name = "RepositoryRuntimeDataAreaBlockedError";
    this.reason = result.reason;
    this.effectIssued = result.effectIssued;
    this.effectStateUnknown = result.effectStateUnknown;
    this.cleanupConfirmed = result.cleanupConfirmed;
    this.retryAllowed = result.retryAllowed;
    this.recoveryReference = result.recoveryReference;
  }
}

/**
 * require Ready Repository Runtime Data Areaを決定する。
 *
 * @responsibility require Ready Repository Runtime Data Areaの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input result: ReturnType<typeof ensureRepositoryRuntimeDataArea>、invalidReason: string
 * @returns requireReadyRepositoryRuntimeDataAreaの計算結果を返す。
 * @precondition 「result: ReturnType<typeof ensureRepositoryRuntimeDataArea>、invalidReason: string」がrequireReadyRepositoryRuntimeDataAreaの入力契約を満たす。
 * @postcondition requireReadyRepositoryRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: requireReadyRepositoryRuntimeDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireReadyRepositoryRuntimeDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireReadyRepositoryRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireReadyRepositoryRuntimeDataAreaはProcess内の同一Subsystemで完結する。
 * @security N/A: requireReadyRepositoryRuntimeDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requireReadyRepositoryRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function requireReadyRepositoryRuntimeDataArea(
  result: ReturnType<typeof ensureRepositoryRuntimeDataArea>,
  invalidReason: string,
) {
  if (result?.status === "ready") return result;
  if (result?.status === "blocked")
    throw new RepositoryRuntimeDataAreaBlockedError(result);
  throw new Error(invalidReason);
}
