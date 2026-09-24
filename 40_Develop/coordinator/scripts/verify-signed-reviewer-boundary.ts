/**
 * verify-signed-reviewer-boundaryに属する責務をまとめる。
 *
 * @responsibility RuntimeRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/repository-location.ts";
import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import {
  displayVerificationRecording,
  runRecordedVerification,
} from "../src/core/verification-result-record.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-reviewer-boundary-verification";
export const SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION = 1;

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
]);
/**
 * verify-signed-reviewer-boundaryで使用するRuntime 記録の値契約を定義する。
 *
 * @responsibility Runtime 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeRecordの宣言は外部境界を開かない。
 * @security N/A: RuntimeRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeRecord = Readonly<Record<string, unknown>>;

/**
 * empty String Arrayを決定する。
 *
 * @responsibility empty String Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns emptyStringArrayの計算結果を返す。
 * @precondition 「value: unknown」がemptyStringArrayの入力契約を満たす。
 * @postcondition emptyStringArrayの責務を完了した結果だけを返す。
 * @effect N/A: emptyStringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: emptyStringArrayは独自の失敗分岐を所有しない。
 * @invariant emptyStringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: emptyStringArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: emptyStringArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: emptyStringArrayは共有非同期状態を持たない同期処理である。
 */
function emptyStringArray(value: unknown) {
  const items = snapshotPlainArray<unknown>(value, 0);
  return items.status === "ok" && items.value.length === 0;
}

/**
 * Completed Routeが完全一致するか判定する。
 *
 * @responsibility Completed Routeの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input result: RuntimeRecord、route: string
 * @returns exactCompletedRouteの計算結果を返す。
 * @precondition 「result: RuntimeRecord、route: string」がexactCompletedRouteの入力契約を満たす。
 * @postcondition exactCompletedRouteの責務を完了した結果だけを返す。
 * @effect N/A: exactCompletedRouteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactCompletedRouteは独自の失敗分岐を所有しない。
 * @invariant exactCompletedRouteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactCompletedRouteはProcess内の同一Subsystemで完結する。
 * @security N/A: exactCompletedRouteはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactCompletedRouteは共有非同期状態を持たない同期処理である。
 */
function exactCompletedRoute(result: RuntimeRecord, route: string) {
  return (
    result.contract === SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT &&
    result.contractRevision ===
      SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION &&
    result.status === "completed" &&
    result.reason === "signed_general_task_verification_completed" &&
    result.requestedRouteProfile === route &&
    result.exactCandidateContentVerified === true &&
    result.candidateDiscarded === true &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.processRestartRequired === false &&
    result.effectStateUnknown === false &&
    result.canonicalRepositoryChanged === false &&
    result.rawProviderOutputReported === false &&
    result.hostPathReported === false &&
    result.credentialReported === false &&
    result.hostRecoveryId === null &&
    emptyStringArray(result.hostRecoveryIds) &&
    result.dockerRecoveryId === null &&
    emptyStringArray(result.dockerRecoveryIds) &&
    result.candidateRecoveryId === null &&
    emptyStringArray(result.candidateRecoveryIds) &&
    result.candidateStoreRecoveryId === null &&
    emptyStringArray(result.candidateStoreRecoveryIds)
  );
}

/**
 * 結果を停止結果として構築する。
 *
 * @responsibility 結果の停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input results: readonly RuntimeRecord[]、failedRouteProfile: SignedGeneralTaskRouteProfile | null、isEffectStateUnknown
 * @returns blockedResultの計算結果を返す。
 * @precondition 「results: readonly RuntimeRecord[]、failedRouteProfile: SignedGeneralTaskRouteProfile | null、isEffectStateUnknown」がblockedResultの入力契約を満たす。
 * @postcondition blockedResultの責務を完了した結果だけを返す。
 * @effect N/A: blockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedResultは独自の失敗分岐を所有しない。
 * @invariant blockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedResultはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedResultは共有非同期状態を持たない同期処理である。
 */
function blockedResult(
  results: readonly RuntimeRecord[],
  failedRouteProfile: SignedGeneralTaskRouteProfile | null,
  isEffectStateUnknown = false,
) {
  const last = results.at(-1);
  const isFinalEffectStateUnknown =
    isEffectStateUnknown ||
    (last !== undefined && last.effectStateUnknown !== false);
  return Object.freeze({
    contract: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason: "signed_reviewer_boundary_integration_incomplete",
    requestedRoutes: ROUTES,
    attemptedRouteCount: results.length,
    completedRouteCount: Math.max(
      0,
      results.length - (failedRouteProfile ? 1 : 0),
    ),
    failedRouteProfile,
    results: Object.freeze([...results]),
    cleanupConfirmed:
      !isFinalEffectStateUnknown && last?.cleanupConfirmed === true,
    manualRecoveryRequired:
      isFinalEffectStateUnknown || last?.manualRecoveryRequired !== false,
    processRestartRequired:
      isRuntimeProcessPoisoned() || last?.processRestartRequired === true,
    effectStateUnknown: isFinalEffectStateUnknown,
    canonicalRepositoryChanged: isFinalEffectStateUnknown
      ? null
      : last?.canonicalRepositoryChanged === true,
    rawProviderOutputReported: isFinalEffectStateUnknown ? null : false,
    hostPathReported: isFinalEffectStateUnknown ? null : false,
    credentialReported: isFinalEffectStateUnknown ? null : false,
    hostRecoveryId: isFinalEffectStateUnknown
      ? null
      : (last?.hostRecoveryId ?? null),
    hostRecoveryIds: isFinalEffectStateUnknown
      ? Object.freeze([])
      : (last?.hostRecoveryIds ?? Object.freeze([])),
    dockerRecoveryId: isFinalEffectStateUnknown
      ? null
      : (last?.dockerRecoveryId ?? null),
    dockerRecoveryIds: isFinalEffectStateUnknown
      ? Object.freeze([])
      : (last?.dockerRecoveryIds ?? Object.freeze([])),
    candidateRecoveryId: isFinalEffectStateUnknown
      ? null
      : (last?.candidateRecoveryId ?? null),
    candidateRecoveryIds: isFinalEffectStateUnknown
      ? Object.freeze([])
      : (last?.candidateRecoveryIds ?? Object.freeze([])),
    candidateStoreRecoveryId: isFinalEffectStateUnknown
      ? null
      : (last?.candidateStoreRecoveryId ?? null),
    candidateStoreRecoveryIds: isFinalEffectStateUnknown
      ? Object.freeze([])
      : (last?.candidateStoreRecoveryIds ?? Object.freeze([])),
    recoveryIdentityAmbiguous: isFinalEffectStateUnknown,
  });
}

/**
 * Signed Reviewer Boundary Verificationを実行する。
 *
 * @responsibility Signed Reviewer Boundary Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryRoot: string、routeRun: typeof runSignedGeneralTaskVerification
 * @returns runSignedReviewerBoundaryVerificationの計算結果を返す。
 * @precondition 「repositoryRoot: string、routeRun: typeof runSignedGeneralTaskVerification」がrunSignedReviewerBoundaryVerificationの入力契約を満たす。
 * @postcondition runSignedReviewerBoundaryVerificationの責務を完了した結果だけを返す。
 * @effect N/A: runSignedReviewerBoundaryVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runSignedReviewerBoundaryVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runSignedReviewerBoundaryVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runSignedReviewerBoundaryVerificationはProcess内の同一Subsystemで完結する。
 * @security N/A: runSignedReviewerBoundaryVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runSignedReviewerBoundaryVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runSignedReviewerBoundaryVerification(
  repositoryRoot: string,
  routeRun: typeof runSignedGeneralTaskVerification = runSignedGeneralTaskVerification,
) {
  if (isRuntimeProcessPoisoned()) return blockedResult([], null, true);
  const results: RuntimeRecord[] = [];
  for (const route of ROUTES) {
    try {
      const result = (await routeRun(
        repositoryRoot,
        undefined,
        route,
      )) as RuntimeRecord;
      results.push(result);
      if (!exactCompletedRoute(result, route))
        return blockedResult(results, route);
    } catch {
      poisonRuntimeProcessAfterCleanupUnknown();
      return blockedResult(results, route, true);
    }
  }
  return Object.freeze({
    contract: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION,
    status: "completed" as const,
    reason: "signed_reviewer_boundary_integration_completed",
    requestedRoutes: ROUTES,
    attemptedRouteCount: ROUTES.length,
    completedRouteCount: ROUTES.length,
    failedRouteProfile: null,
    results: Object.freeze(results),
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    effectStateUnknown: false,
    canonicalRepositoryChanged: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
    hostRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateRecoveryIds: Object.freeze([]),
    candidateStoreRecoveryId: null,
    candidateStoreRecoveryIds: Object.freeze([]),
    recoveryIdentityAmbiguous: false,
  });
}

/**
 * Signed Reviewer Boundary Verification 契約の公開契約を記述する。
 *
 * @responsibility Signed Reviewer Boundary Verification 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeSignedReviewerBoundaryVerificationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeSignedReviewerBoundaryVerificationContractの入力契約を満たす。
 * @postcondition describeSignedReviewerBoundaryVerificationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeSignedReviewerBoundaryVerificationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSignedReviewerBoundaryVerificationContractは独自の失敗分岐を所有しない。
 * @invariant describeSignedReviewerBoundaryVerificationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSignedReviewerBoundaryVerificationContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeSignedReviewerBoundaryVerificationContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeSignedReviewerBoundaryVerificationContractは共有非同期状態を持たない同期処理である。
 */
export function describeSignedReviewerBoundaryVerificationContract() {
  return Object.freeze({
    contract: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION,
    routes: ROUTES,
    purpose:
      "verify_real_codex_and_claude_reviewer_projection_decision_settlement_and_cleanup_before_four_route_system_e2e",
    standardRegressionExternalProviderEffect: false,
    explicitRunExternalProviderEffect: true,
    stop: "first_nonconforming_route",
  });
}

/**
 * verify-signed-reviewer-boundaryのCommand処理を開始する。
 *
 * @responsibility verify-signed-reviewer-boundaryの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns mainの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了した結果だけを返す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: mainは独自の失敗分岐を所有しない。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  if (process.argv.length !== 2) {
    process.stdout.write(
      `${JSON.stringify(blockedResult([], null), null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
  const outcome = await runRecordedVerification(
    "reviewer-boundary",
    process.cwd(),
    () =>
      runSignedReviewerBoundaryVerification(
        resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
      ),
    () => {
      poisonRuntimeProcessAfterCleanupUnknown();
      return blockedResult([], null, true);
    },
  );
  displayVerificationRecording(outcome);
  if (outcome.result !== null)
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
  process.exitCode = outcome.exitCode;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
