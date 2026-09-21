/**
 * project-runtime-public-adapterに属する責務をまとめる。
 *
 * @responsibility observeRuntimeOwnedProjectClientPrincipalを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../security/project-runtime-windows-decision-store.ts";
import {
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
  runProjectRuntimePublicStateQuery,
} from "./project-runtime-composition-root.ts";

export {
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
  runProjectRuntimePublicStateQuery,
};

/**
 * Runtime 所有 Project Client Principalを観測する。
 *
 * @responsibility Runtime 所有 Project Client Principalの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns observeRuntimeOwnedProjectClientPrincipalの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveRuntimeOwnedProjectClientPrincipalの入力契約を満たす。
 * @postcondition observeRuntimeOwnedProjectClientPrincipalの責務を完了した結果だけを返す。
 * @effect N/A: observeRuntimeOwnedProjectClientPrincipalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeRuntimeOwnedProjectClientPrincipalは独自の失敗分岐を所有しない。
 * @invariant observeRuntimeOwnedProjectClientPrincipalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: observeRuntimeOwnedProjectClientPrincipalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeRuntimeOwnedProjectClientPrincipalは共有非同期状態を持たない同期処理である。
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
