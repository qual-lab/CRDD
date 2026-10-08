/**
 * Orchestratorの本番業務操作をCoordinatorの固定実行能力へ接続する。
 *
 * @responsibility Objective受付、判断、受入判断と状態照会の六公開操作を、検証済みRepository・現在保存・Coordinatorの既存実行能力へ接続する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import type { Writable } from "node:stream";
import {
  recoverRuntimeOwnedDockerTask,
  resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
} from "../../coordinator/src/docker-execution/recovery-lifecycle.ts";
import {
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
} from "../../coordinator/src/platform-access/package-verification.ts";
import { inspectRepositoryIdentityCandidate } from "../../coordinator/src/repository-operation/binding.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  captureRuntimeOwnedCoordinatorTaskResultDelivery,
  startRuntimeOwnedCoordinatorTask,
} from "../../coordinator/src/task/execution.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/repository/location.ts";
import type { OrchestratorExecutionPublicationObservation } from "./task/dispatch.ts";
import { createOrchestratorAcceptanceAuthorityAdapter } from "./decision/authority-adapter.ts";
import { createOrchestratorDecisionCapabilityAdapter } from "./decision/capability-adapter.ts";
import { createOrchestratorExecutionAuthorizationAdapter } from "./task/authorization-adapter.ts";
import { createOrchestratorObjectiveResult } from "./objective/plan.ts";
import { inspectOrchestratorDecisionRequest } from "./decision/request.ts";
import {
  inspectOrchestratorObjectiveRequest,
  type OrchestratorObjectiveRequest,
} from "./objective/request.ts";
import {
  inspectOrchestratorStateQuery,
  ORCHESTRATOR_STATE_QUERY_CONTRACT,
} from "./state/query-contract.ts";
import { integrateOrchestratorOperation } from "./candidate/integrate.ts";
import {
  issueOrchestratorHumanDecision,
  orchestratorDecisionRecordId,
  recoverOrchestratorHumanDecision,
  replaceOrchestratorHumanDecision,
  submitOrchestratorHumanDecision,
} from "./decision/lifecycle.ts";
import { ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT } from "./operation-result-contract.ts";
import type { OrchestratorCandidatePort } from "./candidate/operations.ts";
import { projectOrchestratorState } from "./state/transitions.ts";
import { queryOrchestratorState } from "./state/query.ts";
import { recordOrchestratorAcceptanceDecision } from "./decision/record-acceptance.ts";
import { recordOrchestratorExecutionEvent } from "./task/intelligence-adapter.ts";
import { runOrchestratorSingleTaskAttempt } from "./task/execute-attempt.ts";
import {
  createOrchestratorSnapshotAcceptanceDecisionStore as createOrchestratorAcceptanceDecisionStore,
  createOrchestratorSnapshotDecisionRecoveryStore as createOrchestratorDecisionRecoveryStore,
  createOrchestratorSnapshotIntegrationRecordPort as createOrchestratorIntegrationRecordAdapter,
  createCurrentOrchestratorPersistencePorts as createOrchestratorPersistencePorts,
  maintainOrchestratorSnapshot,
  readOrchestratorSnapshot,
  readCurrentOrchestratorState as readOrchestratorState,
} from "./storage/current-state.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "./storage/protected-decision.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "./candidate/integration-adapter.ts";
import {
  collectDockerRecoveryAcknowledgementAfterProjectRecord,
  consumeDockerRecoveryReceiptAfterProjectSettlement,
  createProjectResultAcceptanceReader,
} from "./task/settle-docker-recovery.ts";
import { runOrchestratorObjective } from "./objective/intake-dependencies.ts";
import {
  createOrchestratorWindowsPlatformAdapter,
  observeOrchestratorPlatformFamily,
} from "./platform/windows-adapter.ts";

export const ORCHESTRATOR_RECOVERY_LIFECYCLE_PREFIX =
  "[Orchestrator recovery] " as const;
export const ORCHESTRATOR_EXECUTION_INTELLIGENCE_PREFIX =
  "[Orchestrator execution intelligence] " as const;
const ORCHESTRATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS = 5_000;

/**
 * Runtime Data Boundary Blockedを公開結果へ投影する。
 *
 * @responsibility Runtime Data Boundary Blockedの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: RepositoryRuntimeDataAreaBlockedError
 * @returns orchestratorDataBoundaryBlockedの計算結果を返す。
 * @precondition 「error: RepositoryRuntimeDataAreaBlockedError」がorchestratorDataBoundaryBlockedの入力契約を満たす。
 * @postcondition orchestratorDataBoundaryBlockedの責務を完了した結果だけを返す。
 * @effect N/A: orchestratorDataBoundaryBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: orchestratorDataBoundaryBlockedは独自の失敗分岐を所有しない。
 * @invariant orchestratorDataBoundaryBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: orchestratorDataBoundaryBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: orchestratorDataBoundaryBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: orchestratorDataBoundaryBlockedは共有非同期状態を持たない同期処理である。
 */
export function orchestratorDataBoundaryBlocked(
  error: RepositoryRuntimeDataAreaBlockedError,
) {
  return Object.freeze({
    contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
    status: "blocked" as const,
    reason: error.reason,
    cleanupConfirmed: error.cleanupConfirmed,
    manualRecoveryRequired: error.effectStateUnknown || !error.cleanupConfirmed,
    effectState: error.effectStateUnknown
      ? ("unknown" as const)
      : error.effectIssued
        ? ("settled" as const)
        : ("no_effect" as const),
    effectIssued: error.effectIssued,
    effectStateUnknown: error.effectStateUnknown,
    retryAllowed: error.retryAllowed,
    recoveryIds: Object.freeze(
      error.recoveryReference === null ? [] : [error.recoveryReference],
    ),
  });
}

/**
 * orchestrator-composition-rootで使用するOrchestrator 回復 Diagnostic Outcomeの値契約を定義する。
 *
 * @responsibility Orchestrator 回復 Diagnostic OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorRecoveryDiagnosticOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorRecoveryDiagnosticOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorRecoveryDiagnosticOutcomeの宣言は外部境界を開かない。
 * @security N/A: OrchestratorRecoveryDiagnosticOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorRecoveryDiagnosticOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorRecoveryDiagnosticOutcome =
  | "success"
  | "callback_error"
  | "stream_error"
  | "stream_close"
  | "timeout"
  | "unavailable"
  | "throw";

/**
 * Orchestrator Internal Diagnostic Reporterを構築する。
 *
 * @responsibility Orchestrator Internal Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>
 * @returns createOrchestratorInternalDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>」がcreateOrchestratorInternalDiagnosticReporterの入力契約を満たす。
 * @postcondition createOrchestratorInternalDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect N/A: createOrchestratorInternalDiagnosticReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOrchestratorInternalDiagnosticReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOrchestratorInternalDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOrchestratorInternalDiagnosticReporterはProcess内の同一Subsystemで完結する。
 * @security N/A: createOrchestratorInternalDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency createOrchestratorInternalDiagnosticReporterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createOrchestratorInternalDiagnosticReporter(
  stream: Writable,
  input: Readonly<{
    prefix: string;
    event: string;
    timeoutMs: number;
  }>,
) {
  let isUnavailable = !stream.writable || stream.destroyed;
  let isDisposed = false;
  let pending:
    | ((outcome: OrchestratorRecoveryDiagnosticOutcome) => void)
    | null = null;
  let tail = Promise.resolve();
  const onError = () => {
    isUnavailable = true;
    pending?.("stream_error");
  };
  const onClose = () => {
    isUnavailable = true;
    pending?.("stream_close");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  stream.on("error", onError);
  stream.on("close", onClose);

  const writeOne = (event: object) =>
    new Promise<OrchestratorRecoveryDiagnosticOutcome>((resolve) => {
      if (isDisposed || isUnavailable || !stream.writable || stream.destroyed) {
        resolve("unavailable");
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (
        outcome: OrchestratorRecoveryDiagnosticOutcome,
        isDisable = false,
      ) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        if (isDisable) isUnavailable = true;
        resolve(outcome);
      };
      pending = (outcome) => settle(outcome, true);
      timer = setTimeout(() => settle("timeout", true), input.timeoutMs);
      try {
        stream.write(
          `${input.prefix}${JSON.stringify({
            ...event,
            event: input.event,
          })}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle("success");
            else settle("callback_error", true);
          },
        );
      } catch {
        settle("throw", true);
      }
    });

  const report = (event: object) => {
    const result = tail.then(() => writeOne(event));
    tail = result.then(() => undefined);
    return result;
  };
  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;
    isUnavailable = true;
    pending?.("unavailable");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  return Object.freeze({ report, dispose });
}

/**
 * Orchestrator 回復 Diagnostic Reporterを構築する。
 *
 * @responsibility Orchestrator 回復 Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createOrchestratorRecoveryDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateOrchestratorRecoveryDiagnosticReporterの入力契約を満たす。
 * @postcondition createOrchestratorRecoveryDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect N/A: createOrchestratorRecoveryDiagnosticReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOrchestratorRecoveryDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorRecoveryDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOrchestratorRecoveryDiagnosticReporterはProcess内の同一Subsystemで完結する。
 * @security N/A: createOrchestratorRecoveryDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createOrchestratorRecoveryDiagnosticReporterは共有非同期状態を持たない同期処理である。
 */
export function createOrchestratorRecoveryDiagnosticReporter(
  stream: Writable,
  timeoutMs = ORCHESTRATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createOrchestratorInternalDiagnosticReporter(stream, {
    prefix: ORCHESTRATOR_RECOVERY_LIFECYCLE_PREFIX,
    event: "orchestrator_recovery_transition",
    timeoutMs,
  });
}

/**
 * Orchestrator Execution Intelligence Diagnostic Reporterを構築する。
 *
 * @responsibility Orchestrator Execution Intelligence Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createOrchestratorExecutionIntelligenceDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateOrchestratorExecutionIntelligenceDiagnosticReporterの入力契約を満たす。
 * @postcondition createOrchestratorExecutionIntelligenceDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorExecutionIntelligenceDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterはProcess内の同一Subsystemで完結する。
 * @security N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterは共有非同期状態を持たない同期処理である。
 */
export function createOrchestratorExecutionIntelligenceDiagnosticReporter(
  stream: Writable,
  timeoutMs = ORCHESTRATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createOrchestratorInternalDiagnosticReporter(stream, {
    prefix: ORCHESTRATOR_EXECUTION_INTELLIGENCE_PREFIX,
    event: "orchestrator_execution_intelligence_publication",
    timeoutMs,
  });
}

const productionRecoveryDiagnosticReporter =
  createOrchestratorRecoveryDiagnosticReporter(process.stderr);
const productionExecutionIntelligenceDiagnosticReporter =
  createOrchestratorExecutionIntelligenceDiagnosticReporter(process.stderr);

/**
 * Orchestrator 回復 Diagnosticを書き込む。
 *
 * @responsibility Orchestrator 回復 Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input event: object
 * @returns N/A: writeOrchestratorRecoveryDiagnosticは戻り値を返さない。
 * @precondition 「event: object」がwriteOrchestratorRecoveryDiagnosticの入力契約を満たす。
 * @postcondition writeOrchestratorRecoveryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: writeOrchestratorRecoveryDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeOrchestratorRecoveryDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeOrchestratorRecoveryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeOrchestratorRecoveryDiagnosticはProcess内の同一Subsystemで完結する。
 * @security N/A: writeOrchestratorRecoveryDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeOrchestratorRecoveryDiagnosticは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function writeOrchestratorRecoveryDiagnostic(event: object) {
  await productionRecoveryDiagnosticReporter.report(event);
}

/**
 * Orchestrator Execution Intelligence Diagnosticを書き込む。
 *
 * @responsibility Orchestrator Execution Intelligence Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input observation: OrchestratorExecutionPublicationObservation
 * @returns writeOrchestratorExecutionIntelligenceDiagnosticの計算結果を返す。
 * @precondition 「observation: OrchestratorExecutionPublicationObservation」がwriteOrchestratorExecutionIntelligenceDiagnosticの入力契約を満たす。
 * @postcondition writeOrchestratorExecutionIntelligenceDiagnosticの責務を完了した結果だけを返す。
 * @effect N/A: writeOrchestratorExecutionIntelligenceDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeOrchestratorExecutionIntelligenceDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeOrchestratorExecutionIntelligenceDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeOrchestratorExecutionIntelligenceDiagnosticはProcess内の同一Subsystemで完結する。
 * @security N/A: writeOrchestratorExecutionIntelligenceDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeOrchestratorExecutionIntelligenceDiagnosticは共有非同期状態を持たない同期処理である。
 */
function writeOrchestratorExecutionIntelligenceDiagnostic(
  observation: OrchestratorExecutionPublicationObservation,
) {
  if (observation.status === "completed") return;
  void productionExecutionIntelligenceDiagnosticReporter.report(observation);
}

/**
 * orchestrator-composition-rootで使用するPublic Execution Dependenciesの値契約を定義する。
 *
 * @responsibility Public Execution DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PublicExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PublicExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: PublicExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: PublicExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PublicExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PublicExecutionDependencies = Readonly<{
  issueRuntimeExecutionAuthorization: () => object | null;
  revokeRuntimeExecutionAuthorization?: (capability: object) => boolean;
  startTask: typeof startRuntimeOwnedCoordinatorTask;
  cancelTask: typeof cancelRuntimeOwnedCoordinatorTask;
  captureResultDelivery: typeof captureRuntimeOwnedCoordinatorTaskResultDelivery;
  frontProviderForTask: (
    requestedExecutorProvider: "auto" | "codex" | "claude",
  ) => "codex" | "claude";
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore;
  createIntegrationAdapter: (
    repositoryRoot: string,
  ) => OrchestratorCandidatePort;
  resolveTaskRecoveryCorrelations?: typeof resolveRuntimeOwnedDockerTaskRecoveryCorrelations;
  recordExecutionEvent: typeof recordOrchestratorExecutionEvent;
  observeExecutionEventPublication: (
    observation: OrchestratorExecutionPublicationObservation,
  ) => void;
}>;

/**
 * orchestrator-composition-rootで使用するOrchestrator Public Development Dependenciesの値契約を定義する。
 *
 * @responsibility Orchestrator Public Development DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPublicDevelopmentDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPublicDevelopmentDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPublicDevelopmentDependenciesの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPublicDevelopmentDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPublicDevelopmentDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPublicDevelopmentDependencies = Omit<
  PublicExecutionDependencies,
  "recordExecutionEvent" | "observeExecutionEventPublication"
> &
  Partial<
    Pick<
      PublicExecutionDependencies,
      "recordExecutionEvent" | "observeExecutionEventPublication"
    >
  >;

const productionExecutionDependencies: PublicExecutionDependencies =
  Object.freeze({
    issueRuntimeExecutionAuthorization: () =>
      issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
        evaluationTime: new Date().toISOString(),
      }).capability,
    revokeRuntimeExecutionAuthorization:
      revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
    startTask: startRuntimeOwnedCoordinatorTask,
    cancelTask: cancelRuntimeOwnedCoordinatorTask,
    captureResultDelivery: captureRuntimeOwnedCoordinatorTaskResultDelivery,
    frontProviderForTask: () => "codex",
    openDecisionStore: openRuntimeOwnedWindowsProjectDecisionStore,
    createIntegrationAdapter:
      createRuntimeOwnedProjectCandidateIntegrationAdapter,
    resolveTaskRecoveryCorrelations:
      resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
    recordExecutionEvent: recordOrchestratorExecutionEvent,
    observeExecutionEventPublication:
      writeOrchestratorExecutionIntelligenceDiagnostic,
  });

/**
 * orchestrator-composition-rootを安定Identityへ変換する。
 *
 * @responsibility orchestrator-composition-rootの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input prefix: string、parts: readonly string[]
 * @returns stableの計算結果を返す。
 * @precondition 「prefix: string、parts: readonly string[]」がstableの入力契約を満たす。
 * @postcondition stableの責務を完了した結果だけを返す。
 * @effect N/A: stableは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stableは独自の失敗分岐を所有しない。
 * @invariant stableは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stableはProcess内の同一Subsystemで完結する。
 * @security N/A: stableはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableは共有非同期状態を持たない同期処理である。
 */
function stable(prefix: string, ...parts: readonly string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 40)}`;
}

/**
 * 公開Objectiveを既存のSingle Task入力へ変換する。
 *
 * @responsibility Orchestrator Coordinator Task Requestの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: OrchestratorObjectiveRequest、frontProvider: "codex" | "claude"
 * @returns buildOrchestratorCoordinatorTaskRequestの計算結果を返す。
 * @precondition 「request: OrchestratorObjectiveRequest、frontProvider: "codex" | "claude"」がbuildOrchestratorCoordinatorTaskRequestの入力契約を満たす。
 * @postcondition 明示Profile IDをexactに搬送し、省略時は既存の自動選択を維持する。
 * @effect N/A: buildOrchestratorCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildOrchestratorCoordinatorTaskRequestは独自の失敗分岐を所有しない。
 * @invariant buildOrchestratorCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildOrchestratorCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security Profile IDは選択希望だけを表し、Resolver／Grantの適合性検証または実行Authorityを代替しない。
 * @concurrency N/A: buildOrchestratorCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function buildOrchestratorCoordinatorTaskRequest(
  request: OrchestratorObjectiveRequest,
  frontProvider: "codex" | "claude",
) {
  return Object.freeze({
    frontProvider,
    requestedExecutorProvider: request.requestedExecutorProvider ?? "auto",
    ...(request.requestedProfileId !== undefined
      ? { requestedProfileId: request.requestedProfileId }
      : {}),
    objective: request.objective,
    acceptanceCriteria: Object.freeze([...request.acceptanceCriteria]),
    allowedPaths: Object.freeze([...request.allowedPaths]),
    readPaths: Object.freeze([...request.readPaths]),
    workClass: "bounded_implementation" as const,
    planState: "complete" as const,
    risk: "low" as const,
    difficulty: "low" as const,
    decisionImpact: "limited" as const,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

/**
 * Production composition shared by the CLI and MCP transports.
 *
 * @responsibility Orchestrator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeOrchestratorPublicObjectiveの計算結果を返す。
 * @precondition 「runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteOrchestratorPublicObjectiveの入力契約を満たす。
 * @postcondition executeOrchestratorPublicObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: executeOrchestratorPublicObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeOrchestratorPublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeOrchestratorPublicObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeOrchestratorPublicObjectiveはProcess内の同一Subsystemで完結する。
 * @security N/A: executeOrchestratorPublicObjectiveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency executeOrchestratorPublicObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeOrchestratorPublicObjective(
  runtimeDependencies: PublicExecutionDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectOrchestratorObjectiveRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_objective_request_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
  const authenticated = runtimeDependencies.openDecisionStore();
  if (
    authenticated.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== authenticated.principalId)
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const observedPlatform = observeOrchestratorPlatformFamily();
  const platform =
    observedPlatform.status === "observed" &&
    observedPlatform.platformFamily === "windows"
      ? createOrchestratorWindowsPlatformAdapter()
      : null;
  const observeLeaseOwner = (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => {
    const lockLease = platform?.operations.lock_lease as
      | Readonly<{ observeLeaseOwner: (value: typeof owner) => unknown }>
      | undefined;
    return (
      lockLease?.observeLeaseOwner(owner) ??
      Object.freeze({
        status: "unknown",
        ownerProcessId: owner.ownerProcessId,
        ownerGeneration: owner.ownerGeneration,
      })
    );
  };
  const execution = await runOrchestratorObjective(
    {
      authenticatedPrincipalId: authenticated.principalId,
      /**
       * Project Bindingを検証する。
       *
       * @responsibility Project Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
       * @trace ARCH-000004
       * @input input
       * @returns verifyProjectBindingの計算結果を返す。
       * @precondition 「input」がverifyProjectBindingの入力契約を満たす。
       * @postcondition verifyProjectBindingの責務を完了した結果だけを返す。
       * @effect N/A: verifyProjectBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: verifyProjectBindingは独自の失敗分岐を所有しない。
       * @invariant verifyProjectBindingは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: verifyProjectBindingはProcess内の同一Subsystemで完結する。
       * @security N/A: verifyProjectBindingはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: verifyProjectBindingは共有非同期状態を持たない同期処理である。
       */
      verifyProjectBinding(input) {
        if (
          identity?.status !== "candidate" ||
          identity.commit !== input.repositoryRevision
        )
          return Object.freeze({
            status: "blocked",
            reason: "orchestrator_repository_revision_mismatch",
          });
        return Object.freeze({
          status: "verified",
          repositoryBindingId: stable("binding", repositoryRoot),
          repositoryRevision: identity.commit,
          workingDirectory: repositoryRoot,
          repositoryRoot,
          bindingCapability: Object.freeze({}),
        });
      },
      /**
       * plan Objectiveを決定する。
       *
       * @responsibility plan Objectiveの導出に必要な入力、判定規則、返却結果の境界を所有する。
       * @trace ARCH-000004
       * @input request: OrchestratorObjectiveRequest
       * @returns planObjectiveの計算結果を返す。
       * @precondition 「request: OrchestratorObjectiveRequest」がplanObjectiveの入力契約を満たす。
       * @postcondition planObjectiveの責務を完了した結果だけを返す。
       * @effect N/A: planObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: planObjectiveは独自の失敗分岐を所有しない。
       * @invariant planObjectiveは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: planObjectiveはProcess内の同一Subsystemで完結する。
       * @security N/A: planObjectiveはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: planObjectiveは共有非同期状態を持たない同期処理である。
       */
      planObjective(request: OrchestratorObjectiveRequest) {
        const objectiveId = stable(
          "objective",
          request.projectId,
          request.milestoneId,
          request.requestId,
        );
        const taskId = stable("task", objectiveId);
        return Object.freeze({
          milestoneAcceptanceCriteria: Object.freeze([
            ...request.acceptanceCriteria,
          ]),
          objectives: Object.freeze([
            {
              id: objectiveId,
              acceptanceCriteria: Object.freeze([
                ...request.acceptanceCriteria,
              ]),
            },
          ]),
          tasks: Object.freeze([
            {
              id: taskId,
              objectiveId,
              dependencies: Object.freeze([]),
              allowedPaths: Object.freeze([...request.allowedPaths]),
              conflictKeys: Object.freeze([...request.allowedPaths]),
            },
          ]),
        });
      },
      /**
       * Task Executionsを構築する。
       *
       * @responsibility Task Executionsの構築入力、生成結果、不正入力の拒否境界を所有する。
       * @trace ARCH-000004
       * @input request、_bindingCapability、state
       * @returns createTaskExecutionsの計算結果を返す。
       * @precondition 「request、_bindingCapability、state」がcreateTaskExecutionsの入力契約を満たす。
       * @postcondition createTaskExecutionsの責務を完了した結果だけを返す。
       * @effect N/A: createTaskExecutionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: createTaskExecutionsは独自の失敗分岐を所有しない。
       * @invariant createTaskExecutionsは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: createTaskExecutionsはProcess内の同一Subsystemで完結する。
       * @security N/A: createTaskExecutionsはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: createTaskExecutionsは共有非同期状態を持たない同期処理である。
       */
      createTaskExecutions(request, _bindingCapability, state) {
        return state.tasks
          .filter((task) => task.state !== "superseded")
          .map((task) => {
            const objective = state.objectives.find(
              (candidate) =>
                candidate.definition.id === task.definition.objectiveId,
            );
            return Object.freeze({
              taskId: task.definition.id,
              repositoryRoot,
              taskRequest: buildOrchestratorCoordinatorTaskRequest(
                Object.freeze({
                  ...request,
                  acceptanceCriteria: Object.freeze([
                    ...(objective?.definition.acceptanceCriteria ?? []),
                  ]),
                  allowedPaths: Object.freeze([
                    ...task.definition.allowedPaths,
                  ]),
                }),
                runtimeDependencies.frontProviderForTask(
                  request.requestedExecutorProvider ?? "auto",
                ),
              ),
            });
          });
      },
      observeLeaseOwner,
      recoverTaskRecovery: recoverRuntimeOwnedDockerTask,
      acknowledgeTaskRecovery: (settlement) =>
        consumeDockerRecoveryReceiptAfterProjectSettlement(settlement, {
          workingDirectory,
          repositoryRoot,
          repositoryBindingId: stable("binding", repositoryRoot),
        }),
      finalizeTaskRecoveryAcknowledgement: (settlement) =>
        collectDockerRecoveryAcknowledgementAfterProjectRecord(settlement, {
          workingDirectory,
          repositoryRoot,
          repositoryBindingId: stable("binding", repositoryRoot),
        }),
      ...(runtimeDependencies.resolveTaskRecoveryCorrelations
        ? {
            resolveTaskRecoveryCorrelations:
              runtimeDependencies.resolveTaskRecoveryCorrelations,
          }
        : {}),
      observeRecoveryTransition: writeOrchestratorRecoveryDiagnostic,
      execution: {
        resultDelivery: {
          repositoryBindingId: stable("binding", repositoryRoot),
          createAcceptanceReader: (acceptance) =>
            createProjectResultAcceptanceReader({
              workingDirectory: repositoryRoot,
              repositoryBindingId: acceptance.repositoryBindingId,
              projectId: acceptance.projectId,
              milestoneId: acceptance.milestoneId,
              taskId: acceptance.taskId,
              attemptId: acceptance.attemptId,
              operationId: acceptance.operationId,
              recoveryId: acceptance.recoveryId,
            }),
        },
        authorization: createOrchestratorExecutionAuthorizationAdapter({
          issueRuntimeCapability:
            runtimeDependencies.issueRuntimeExecutionAuthorization,
          ...(runtimeDependencies.revokeRuntimeExecutionAuthorization
            ? {
                revokeRuntimeCapability:
                  runtimeDependencies.revokeRuntimeExecutionAuthorization,
              }
            : {}),
        }),
        runSingleTaskAttempt: (input) =>
          runOrchestratorSingleTaskAttempt(
            {
              startTask: (
                taskRequest,
                root,
                capability,
                correlation,
                observer,
              ) =>
                runtimeDependencies.startTask(
                  taskRequest,
                  root,
                  capability,
                  correlation,
                  observer,
                  "orchestrator",
                ),
              cancelTask: runtimeDependencies.cancelTask,
              captureResultDelivery: runtimeDependencies.captureResultDelivery,
            },
            input,
          ),
        executionObservation: {
          recordTaskAttempt: (observation) =>
            runtimeDependencies.recordExecutionEvent(
              repositoryRoot,
              observation,
            ),
          observePublication:
            runtimeDependencies.observeExecutionEventPublication,
        },
      },
    },
    request,
    cancellationSignal,
  );
  if (
    execution.status !== "completed" ||
    execution.reason !== "orchestrator_tasks_completed_integration_pending" ||
    typeof execution.queueId !== "string"
  )
    return execution;
  const integrationAdapter =
    runtimeDependencies.createIntegrationAdapter(repositoryRoot);
  const repositoryBindingId = stable("binding", repositoryRoot);
  const integration = await integrateOrchestratorOperation(
    Object.freeze({
      candidate: Object.freeze({ ...integrationAdapter, observeLeaseOwner }),
      records: createOrchestratorIntegrationRecordAdapter({
        workingDirectory: repositoryRoot,
        repositoryBindingId,
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId: execution.queueId,
      }),
      persistence: createOrchestratorPersistencePorts(
        repositoryRoot,
        repositoryBindingId,
      ),
    }),
    {
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId: execution.queueId,
      allowedPaths: request.allowedPaths,
      adoptionAuthorized: request.adoptResult,
    },
  );
  if (
    integration.status === "completed" &&
    (integration.reason === "orchestrator_milestone_accepted" ||
      integration.reason === "orchestrator_acceptance_decision_required")
  ) {
    const latest = readOrchestratorState(
      repositoryRoot,
      stable("binding", repositoryRoot),
      request.projectId,
    );
    if (latest.status !== "completed" || latest.value === null)
      return createOrchestratorObjectiveResult(request, {
        status: "blocked",
        reason: "orchestrator_state_observation_unknown",
        queueId: execution.queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return createOrchestratorObjectiveResult(request, {
      status:
        integration.reason === "orchestrator_milestone_accepted"
          ? "completed"
          : "blocked",
      reason: integration.reason,
      queueId: execution.queueId,
      projection: projectOrchestratorState(latest.value),
      cleanupConfirmed: integration.cleanupConfirmed,
      manualRecoveryRequired: integration.manualRecoveryRequired,
      recoveryIds: integration.recoveryIds,
      effectState: "settled",
    });
  }
  if (
    integration.status !== "blocked" ||
    integration.reason !== "orchestrator_integration_conflict" ||
    typeof integration.candidateId !== "string" ||
    typeof integration.stateGeneration !== "number"
  )
    return integration;
  const protectedStore = runtimeDependencies.openDecisionStore();
  if (protectedStore.status !== "completed")
    return Object.freeze({
      ...integration,
      reason: "orchestrator_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  const decisionId = stable(
    "decision",
    request.projectId,
    request.milestoneId,
    execution.queueId,
    integration.candidateId,
  );
  const decisionCapability = createOrchestratorDecisionCapabilityAdapter();
  const decisionCommon = {
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: execution.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createOrchestratorDecisionRecoveryStore(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ),
    capability: decisionCapability,
    persistence: createOrchestratorPersistencePorts(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ),
  } as const;
  const decision = request.decisionCapabilityReplacement
    ? request.decisionCapabilityReplacement.decisionId !== decisionId
      ? Object.freeze({
          contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
          status: "blocked" as const,
          reason: "orchestrator_decision_replacement_binding_mismatch",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect" as const,
        })
      : replaceOrchestratorHumanDecision(decisionCommon, {
          recordId: orchestratorDecisionRecordId(
            decisionCapability,
            request.projectId,
            request.milestoneId,
            decisionId,
          ),
          replacementRequestId:
            request.decisionCapabilityReplacement.replacementRequestId,
          lifetimeMs: 24 * 60 * 60 * 1_000,
        })
    : issueOrchestratorHumanDecision(decisionCommon, {
        decisionId,
        repositoryRevision: request.repositoryRevision,
        expectedGeneration: integration.stateGeneration,
        allowedOptions: Object.freeze(["resume", "cancel"]),
        lifetimeMs: 24 * 60 * 60 * 1_000,
      });
  return Object.freeze({ ...integration, decision });
}

/**
 * Orchestrator Public Objectiveを実行する。
 *
 * @responsibility Orchestrator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runOrchestratorPublicObjectiveの計算結果を返す。
 * @precondition 「rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunOrchestratorPublicObjectiveの入力契約を満たす。
 * @postcondition runOrchestratorPublicObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: runOrchestratorPublicObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runOrchestratorPublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runOrchestratorPublicObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runOrchestratorPublicObjectiveはProcess内の同一Subsystemで完結する。
 * @security N/A: runOrchestratorPublicObjectiveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runOrchestratorPublicObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function runOrchestratorPublicObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return Promise.resolve(
      executeOrchestratorPublicObjective(
        productionExecutionDependencies,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    ).catch((error: unknown) => {
      if (error instanceof RepositoryRuntimeDataAreaBlockedError)
        return orchestratorDataBoundaryBlocked(error);
      throw error;
    });
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return Promise.resolve(orchestratorDataBoundaryBlocked(error));
    throw error;
  }
}

/**
 * Development-only composition. The supplied starter still needs its own admitted capability.
 *
 * @responsibility Development Orchestrator Public Objective 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Omit< OrchestratorPublicDevelopmentDependencies, "createIntegrationAdapter" > & Readonly<{ createIntegrationAdapter?: PublicExecutionDependencies["createIntegrationAdapter"]; }>
 * @returns createDevelopmentOrchestratorPublicObjectiveCandidateの計算結果を返す。
 * @precondition 「dependencies: Omit< OrchestratorPublicDevelopmentDependencies, "createIntegrationAdapter" > & Readonly<{ createIntegrationAdapter?: PublicExecutionDependencies["createIntegrationAdapter"]; }>」がcreateDevelopmentOrchestratorPublicObjectiveCandidateの入力契約を満たす。
 * @postcondition createDevelopmentOrchestratorPublicObjectiveCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentOrchestratorPublicObjectiveCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDevelopmentOrchestratorPublicObjectiveCandidateは独自の失敗分岐を所有しない。
 * @invariant createDevelopmentOrchestratorPublicObjectiveCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentOrchestratorPublicObjectiveCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: createDevelopmentOrchestratorPublicObjectiveCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDevelopmentOrchestratorPublicObjectiveCandidateは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentOrchestratorPublicObjectiveCandidate(
  dependencies: Omit<
    OrchestratorPublicDevelopmentDependencies,
    "createIntegrationAdapter"
  > &
    Readonly<{
      createIntegrationAdapter?: PublicExecutionDependencies["createIntegrationAdapter"];
    }>,
) {
  const fixed = Object.freeze({
    ...dependencies,
    createIntegrationAdapter:
      dependencies.createIntegrationAdapter ??
      createRuntimeOwnedProjectCandidateIntegrationAdapter,
    recordExecutionEvent:
      dependencies.recordExecutionEvent ?? recordOrchestratorExecutionEvent,
    observeExecutionEventPublication:
      dependencies.observeExecutionEventPublication ??
      writeOrchestratorExecutionIntelligenceDiagnostic,
  });
  return Object.freeze({
    productionAuthority: false,
    run: (
      rawRequest: unknown,
      cancellationSignal: AbortSignal,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeOrchestratorPublicObjective(
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
      executeOrchestratorPublicDecision(
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
      executeOrchestratorPublicStateQuery(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
  });
}

/**
 * Orchestrator Public Decisionを実行する。
 *
 * @responsibility Orchestrator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeOrchestratorPublicDecisionの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteOrchestratorPublicDecisionの入力契約を満たす。
 * @postcondition executeOrchestratorPublicDecisionの責務を完了した結果だけを返す。
 * @effect N/A: executeOrchestratorPublicDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeOrchestratorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeOrchestratorPublicDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeOrchestratorPublicDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: executeOrchestratorPublicDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeOrchestratorPublicDecisionは共有非同期状態を持たない同期処理である。
 */
function executeOrchestratorPublicDecision(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectOrchestratorDecisionRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_input_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const { decisionId, projectId, milestoneId } = request;
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const protectedStore = openDecisionStore();
  if (
    protectedStore.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== protectedStore.principalId)
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const decisionCapability = createOrchestratorDecisionCapabilityAdapter();
  const recordId = orchestratorDecisionRecordId(
    decisionCapability,
    projectId,
    milestoneId,
    decisionId,
  );
  const observed = protectedStore.store.read(recordId) as Readonly<{
    status: "completed";
    value: Readonly<Record<string, unknown>> | null;
  }> | null;
  const record = observed?.status === "completed" ? observed.value : null;
  if (
    !record ||
    typeof record.queueId !== "string" ||
    typeof record.repositoryRevision !== "string"
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_not_observed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const commonFields = {
    projectId,
    milestoneId,
    queueId: record.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createOrchestratorDecisionRecoveryStore(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ),
    capability: decisionCapability,
    persistence: createOrchestratorPersistencePorts(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ),
  } as const;
  const result =
    record.disposition === "prepared"
      ? recoverOrchestratorHumanDecision(commonFields, { recordId })
      : submitOrchestratorHumanDecision(commonFields, {
          decisionId,
          recordId,
          repositoryRevision: request.repositoryRevision,
          generation: request.generation,
          selectedOption: request.selectedOption,
          continuationCapability: request.continuationCapability,
        });
  if (result.status === "completed") {
    const maintained = maintainOrchestratorSnapshot(
      repositoryRoot,
      stable("binding", repositoryRoot),
    );
    if (maintained.status !== "completed")
      return Object.freeze({
        ...result,
        status: "blocked" as const,
        reason: maintained.reason,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown" as const,
      });
  }
  return result;
}

/**
 * Production decision entry shared by the CLI and MCP process.
 *
 * @responsibility Orchestrator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runOrchestratorPublicDecisionの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunOrchestratorPublicDecisionの入力契約を満たす。
 * @postcondition runOrchestratorPublicDecisionの責務を完了した結果だけを返す。
 * @effect N/A: runOrchestratorPublicDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runOrchestratorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runOrchestratorPublicDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runOrchestratorPublicDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: runOrchestratorPublicDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runOrchestratorPublicDecisionは共有非同期状態を持たない同期処理である。
 */
export function runOrchestratorPublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeOrchestratorPublicDecision(
      openRuntimeOwnedWindowsProjectDecisionStore,
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return orchestratorDataBoundaryBlocked(error);
    throw error;
  }
}

/**
 * Public Acceptance Decisionを検証済みRepository、認証Principal、耐久Storeおよび状態Storeへ接続する。
 *
 * @responsibility SPEC-000002の明示判断だけを公開入口からAcceptance Decision Applicationへ搬送する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns Acceptance Decision Applicationの公開結果を返す。
 * @precondition 認証ContextはRuntime-owned認証境界で構築される。
 * @postcondition 成功時は一つのDecision Recordと必要な状態更新だけを確定する。
 * @effect Repository-local Acceptance Decision StoreとOrchestrator Stateだけを更新する。
 * @failure Root、Revision、Principal、AuthorityまたはStoreを確認できない場合はEffectを拡張せず停止する。
 * @invariant Task作成、Provider EffectおよびProjection由来Authorityを発行しない。
 * @boundary Public Transport→Coordinator Composition→Orchestrator→Repository-local Storeの境界。
 * @security 認証Principalをexact比較し、非公開Store Pathや秘密値を結果へ含めない。
 * @concurrency State世代とDecision Recordの排他的世代作成で競合を拒否する。
 */
export function executeOrchestratorPublicAcceptanceDecision(
  authenticate: () =>
    | Readonly<{ status: "completed"; principalId: string }>
    | Readonly<{ status: "blocked"; principalId: null }>,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    let repositoryRoot: string;
    try {
      repositoryRoot =
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    } catch {
      return Object.freeze({
        contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_repository_root_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    }
    const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
    const candidate =
      rawRequest && typeof rawRequest === "object"
        ? (rawRequest as Readonly<{
            repositoryRevision?: unknown;
            projectId?: unknown;
            principalId?: unknown;
          }>)
        : null;
    if (
      !identity ||
      typeof candidate?.repositoryRevision !== "string" ||
      identity.commit !== candidate.repositoryRevision
    )
      return Object.freeze({
        contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_acceptance_revision_mismatch",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const authenticated = authenticate();
    if (
      authenticated.status !== "completed" ||
      authenticationContext === undefined ||
      authenticationContext.principalId !== authenticated.principalId ||
      candidate.principalId !== authenticated.principalId ||
      typeof candidate.projectId !== "string"
    )
      return Object.freeze({
        contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const repositoryBindingId = stable("binding", repositoryRoot);
    const result = recordOrchestratorAcceptanceDecision(
      Object.freeze({
        state: createOrchestratorPersistencePorts(
          repositoryRoot,
          repositoryBindingId,
        ).state,
        authority: createOrchestratorAcceptanceAuthorityAdapter(
          authenticated.principalId,
        ),
        store: createOrchestratorAcceptanceDecisionStore(
          repositoryRoot,
          repositoryBindingId,
        ),
      }),
      rawRequest,
    );
    if (result.status === "completed") {
      const maintenance = maintainOrchestratorSnapshot(
        repositoryRoot,
        repositoryBindingId,
      );
      if (maintenance.status !== "completed")
        return Object.freeze({
          ...result,
          status: "blocked" as const,
          reason: maintenance.reason,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
    }
    return result;
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return orchestratorDataBoundaryBlocked(error);
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_acceptance_boundary_unknown",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  }
}

/**
 * Production認証境界を用いてPublic Acceptance Decisionを実行する。
 *
 * @responsibility Runtime-owned Principal観測を公開Acceptance Decision入口へ固定する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns executeOrchestratorPublicAcceptanceDecisionの結果を返す。
 * @precondition Runtime-owned Windows Decision StoreがLocal Principalを検証できる。
 * @postcondition Production入口は検証済みPrincipalだけをCoreへ渡す。
 * @effect Acceptance Decision Recordと必要なOrchestrator Stateだけを更新する。
 * @failure 認証またはRuntime Data観測不能を理由付き停止へ変換する。
 * @invariant Test専用認証をProduction入口へ使用しない。
 * @boundary Local TransportとProduction Composition Rootの境界。
 * @security Store自体を公開せずPrincipal観測結果だけをAuthorityへ渡す。
 * @concurrency 下位Storeの世代制御を維持する。
 */
export function runOrchestratorPublicAcceptanceDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeOrchestratorPublicAcceptanceDecision(
    () => {
      const observed = openRuntimeOwnedWindowsProjectDecisionStore();
      return observed.status === "completed"
        ? Object.freeze({
            status: "completed" as const,
            principalId: observed.principalId,
          })
        : Object.freeze({ status: "blocked" as const, principalId: null });
    },
    rawRequest,
    workingDirectory,
    authenticationContext,
  );
}

/**
 * Read-only state entry shared by local transports. No mutation port is exposed.
 *
 * @responsibility Orchestrator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeOrchestratorPublicStateQueryの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteOrchestratorPublicStateQueryの入力契約を満たす。
 * @postcondition executeOrchestratorPublicStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: executeOrchestratorPublicStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeOrchestratorPublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeOrchestratorPublicStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeOrchestratorPublicStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: executeOrchestratorPublicStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeOrchestratorPublicStateQueryは共有非同期状態を持たない同期処理である。
 */
export function executeOrchestratorPublicStateQuery(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectOrchestratorStateQuery(rawRequest);
  if (!request)
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_state_query_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
  if (!identity || identity.commit !== request.repositoryRevision)
    return Object.freeze({
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_state_revision_mismatch",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown" as const,
      projection: null,
      intakeEpoch: null,
      cleanupConfirmed: true as const,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const authenticated = openDecisionStore();
  if (
    authenticated.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== authenticated.principalId)
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const snapshot = readOrchestratorSnapshot(
    repositoryRoot,
    stable("binding", repositoryRoot),
  );
  if (
    snapshot.status !== "completed" ||
    snapshot.value === null ||
    snapshot.value.schemaRevision !== 2
  )
    return Object.freeze({
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_snapshot_not_initialized",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown" as const,
      projection: null,
      intakeEpoch: null,
      cleanupConfirmed: true as const,
      manualRecoveryRequired:
        snapshot.status === "blocked" && snapshot.manualRecoveryRequired,
      effectState: "no_effect" as const,
    });
  return queryOrchestratorState(
    createOrchestratorPersistencePorts(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ).state,
    request,
    snapshot.value.intakeEpoch,
  );
}

/**
 * Production read-only state entry shared by local transports.
 *
 * @responsibility Orchestrator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runOrchestratorPublicStateQueryの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunOrchestratorPublicStateQueryの入力契約を満たす。
 * @postcondition runOrchestratorPublicStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: runOrchestratorPublicStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runOrchestratorPublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runOrchestratorPublicStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runOrchestratorPublicStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: runOrchestratorPublicStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runOrchestratorPublicStateQueryは共有非同期状態を持たない同期処理である。
 */
export function runOrchestratorPublicStateQuery(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeOrchestratorPublicStateQuery(
      () =>
        openRuntimeOwnedWindowsProjectDecisionStore({
          initializeIfMissing: false,
        }),
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return orchestratorDataBoundaryBlocked(error);
    throw error;
  }
}
