/**
 * 保護された判断Storeから、現在のClient Principalを観測する。
 *
 * @packageDocumentation
 * @responsibility 検証済みPrincipalだけを返し、確認不能をunknownとして保持する。
 * @trace ARCH-000004
 * @boundary OrchestratorとRuntime所有の保護された判断Storeの境界。
 */
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/protected-decision.ts";

/**
 * Runtime所有の判断Storeを開き、Client Principalを観測する。
 *
 * @responsibility 保護Storeの確認結果をPrincipal観測結果へ投影する。
 * @trace ARCH-000004
 * @input N/A: 呼出し引数を受け取らない。
 * @returns 検証できたPrincipal ID、またはunknownを返す。
 * @precondition Runtime所有Storeを確認できる実行環境である。
 * @postcondition 下位Storeがcompletedの場合だけverifiedを返す。
 * @effect 下位Adapterを通じて保護Storeと実行環境を確認し、既存契約に従い未作成Storeを初期化し得る。
 * @failure Storeを確認できなければunknownを返し、検証済みと扱わない。
 * @invariant 観測不能を不存在または認証成功へ変換しない。
 * @boundary 保護された判断Storeから公開Principal観測への境界。
 * @security 秘密値や判断Authorityは返さず、検証済みPrincipal IDだけを公開する。
 * @concurrency 下位Storeの排他・検証契約を変更せず、呼出しごとに観測する。
 */
export function observeRuntimeOwnedProjectClientPrincipal() {
  const observed = openRuntimeOwnedWindowsProjectDecisionStore();
  return observed.status === "completed"
    ? Object.freeze({
        status: "verified" as const,
        principalId: observed.principalId,
      })
    : Object.freeze({ status: "unknown" as const });
}
