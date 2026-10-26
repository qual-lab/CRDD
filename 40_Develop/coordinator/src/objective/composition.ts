/**
 * Objective受付の本番依存と開発用構成を組み立てる。
 * @responsibility 既存Ownerを接続し、進行・保存規則を再定義しない。
 * @trace ARCH-000004
 */
import {
  cancelRuntimeOwnedCoordinatorTask,
  captureRuntimeOwnedCoordinatorTaskResultDelivery,
  startRuntimeOwnedCoordinatorTask,
} from "../execution/controller.ts";
import { recordCoordinatorExecutionEvent } from "../task/dispatch.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/decision.ts";
import { writeCoordinatorExecutionIntelligenceDiagnostic } from "../execution/diagnostics.ts";
import { coordinatorDataBoundaryBlocked } from "../state/result.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";
import { executeCoordinatorPublicDecision } from "../decision/lifecycle.ts";
import { executeCoordinatorPublicStateQuery } from "../state/query.ts";
import type {
  PublicExecutionDependencies,
  CoordinatorPublicDevelopmentDependencies,
} from "./types.ts";
import { executeCoordinatorPublicObjective } from "./execute.ts";

const productionExecutionDependencies: PublicExecutionDependencies =
  Object.freeze({
    startTask: startRuntimeOwnedCoordinatorTask,
    cancelTask: cancelRuntimeOwnedCoordinatorTask,
    captureResultDelivery: captureRuntimeOwnedCoordinatorTaskResultDelivery,
    openDecisionStore: openRuntimeOwnedWindowsProjectDecisionStore,
    recordExecutionEvent: recordCoordinatorExecutionEvent,
    observeExecutionEventPublication:
      writeCoordinatorExecutionIntelligenceDiagnostic,
  });

/**
 * Coordinator Public Objectiveを実行する。
 *
 * @responsibility Coordinator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runCoordinatorPublicObjectiveの計算結果を返す。
 * @precondition 「rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunCoordinatorPublicObjectiveの入力契約を満たす。
 * @postcondition runCoordinatorPublicObjectiveの責務を完了した結果だけを返す。
 * @effect Repository・判断記録を観測し、受付状態の保存と認可済みTask実行を既存Ownerへ委譲する。
 * @failure runCoordinatorPublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 予約・開始・結果保存・配送の順序と同じ要求Identityを維持する。
 * @boundary 公開Objective入力→認証・保存・実行依存の境界を接続する。
 * @security 認証済み主体・Repository・要求範囲を既存境界で検証し、現在の許可外へ実行を拡張しない。
 * @concurrency 取消Signalと実行・保存・結果搬送の非同期完了を既存Lifecycleへ接続する。
 */
export function runCoordinatorPublicObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return Promise.resolve(
      executeCoordinatorPublicObjective(
        productionExecutionDependencies,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    ).catch((error: unknown) => {
      if (error instanceof RepositoryRuntimeDataAreaBlockedError)
        return coordinatorDataBoundaryBlocked(error);
      throw error;
    });
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return Promise.resolve(coordinatorDataBoundaryBlocked(error));
    throw error;
  }
}

/**
 * Development-only composition. The supplied starter still needs its own admitted capability.
 *
 * @responsibility Development Coordinator Public Objective 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorPublicDevelopmentDependencies
 * @returns createDevelopmentCoordinatorPublicObjectiveCandidateの計算結果を返す。
 * @precondition 「dependencies: CoordinatorPublicDevelopmentDependencies」がcreateDevelopmentCoordinatorPublicObjectiveCandidateの入力契約を満たす。
 * @postcondition createDevelopmentCoordinatorPublicObjectiveCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentCoordinatorPublicObjectiveCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDevelopmentCoordinatorPublicObjectiveCandidateは独自の失敗分岐を所有しない。
 * @invariant createDevelopmentCoordinatorPublicObjectiveCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentCoordinatorPublicObjectiveCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: createDevelopmentCoordinatorPublicObjectiveCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDevelopmentCoordinatorPublicObjectiveCandidateは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentCoordinatorPublicObjectiveCandidate(
  dependencies: CoordinatorPublicDevelopmentDependencies,
) {
  const fixed = Object.freeze({
    ...dependencies,
    recordExecutionEvent:
      dependencies.recordExecutionEvent ?? recordCoordinatorExecutionEvent,
    observeExecutionEventPublication:
      dependencies.observeExecutionEventPublication ??
      writeCoordinatorExecutionIntelligenceDiagnostic,
  });
  return Object.freeze({
    productionAuthority: false,
    run: (
      rawRequest: unknown,
      cancellationSignal: AbortSignal,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeCoordinatorPublicObjective(
        fixed,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    runDecision: (
      rawRequest: unknown,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeCoordinatorPublicDecision(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
    runStateQuery: (
      rawRequest: unknown,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeCoordinatorPublicStateQuery(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
  });
}
