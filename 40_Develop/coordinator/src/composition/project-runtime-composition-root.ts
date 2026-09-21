/**
 * project-runtime-composition-rootに属する責務をまとめる。
 *
 * @responsibility projectRuntimeDataBoundaryBlockedを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import type { Writable } from "node:stream";
import type { ProjectRuntimeExecutionPublicationObservation } from "../../../project-runtime/src/index.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../runtime-data/src/index.ts";
import {
  createProjectRuntimeObjectiveResult,
  inspectProjectRuntimeDecisionRequest,
  inspectProjectRuntimeObjectiveRequest,
  inspectProjectRuntimeStateQuery,
  integrateProjectRuntimeOperation,
  issueProjectRuntimeHumanDecision,
  PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
  PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
  type ProjectRuntimeCandidatePort,
  type ProjectRuntimeObjectiveRequest,
  projectProjectRuntimeState,
  projectRuntimeDecisionRecordId,
  queryProjectRuntimeState,
  recoverProjectRuntimeHumanDecision,
  replaceProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
} from "../../../project-runtime/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../security/coordinator-task-runtime.ts";
import {
  collectDockerRecoveryAcknowledgementAfterProjectRecord,
  consumeDockerRecoveryReceiptAfterProjectSettlement,
  recoverRuntimeOwnedDockerTask,
  resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
} from "../security/docker-recovery-runtime.ts";
import { recordProjectRuntimeExecutionEvent } from "../security/execution-intelligence-adapter.ts";
import {
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
} from "../security/platform-provisioner-package-filesystem.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "../security/project-runtime-candidate-integration-adapter.ts";
import { createProjectRuntimeDecisionCapabilityAdapter } from "../security/project-runtime-decision-capability-adapter.ts";
import { createProjectRuntimeDecisionRecoveryStore } from "../security/project-runtime-decision-recovery-store.ts";
import {
  createProjectRuntimePersistencePorts,
  readProjectRuntimeState,
} from "../security/project-runtime-durable-foundation.ts";
import { createProjectRuntimeExecutionAuthorizationAdapter } from "../security/project-runtime-execution-authorization-adapter.ts";
import { createProjectRuntimeIntegrationRecordAdapter } from "../security/project-runtime-integration-record-adapter.ts";
import { runProjectRuntimeObjective } from "../security/project-runtime-objective-intake.ts";
import { runProjectRuntimeSingleTaskAttempt } from "../security/project-runtime-single-task-adapter.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../security/project-runtime-windows-decision-store.ts";
import {
  createProjectRuntimeWindowsPlatformAdapter,
  observeProjectRuntimePlatformFamily,
} from "../security/project-runtime-windows-platform-adapter.ts";
import { inspectRepositoryIdentityCandidate } from "../security/repository-operation-runtime.ts";

export const PROJECT_RUNTIME_RECOVERY_LIFECYCLE_PREFIX =
  "[Project Runtime recovery] " as const;
export const PROJECT_RUNTIME_EXECUTION_INTELLIGENCE_PREFIX =
  "[Project Runtime execution intelligence] " as const;
const PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS = 5_000;

/**
 * Runtime Data Boundary Blockedを公開結果へ投影する。
 *
 * @responsibility Runtime Data Boundary Blockedの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: RepositoryRuntimeDataAreaBlockedError
 * @returns projectRuntimeDataBoundaryBlockedの計算結果を返す。
 * @precondition 「error: RepositoryRuntimeDataAreaBlockedError」がprojectRuntimeDataBoundaryBlockedの入力契約を満たす。
 * @postcondition projectRuntimeDataBoundaryBlockedの責務を完了した結果だけを返す。
 * @effect N/A: projectRuntimeDataBoundaryBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectRuntimeDataBoundaryBlockedは独自の失敗分岐を所有しない。
 * @invariant projectRuntimeDataBoundaryBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectRuntimeDataBoundaryBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: projectRuntimeDataBoundaryBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectRuntimeDataBoundaryBlockedは共有非同期状態を持たない同期処理である。
 */
export function projectRuntimeDataBoundaryBlocked(
  error: RepositoryRuntimeDataAreaBlockedError,
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
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
 * project-runtime-composition-rootで使用するProject Runtime 回復 Diagnostic Outcomeの値契約を定義する。
 *
 * @responsibility Project Runtime 回復 Diagnostic OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeRecoveryDiagnosticOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeRecoveryDiagnosticOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeRecoveryDiagnosticOutcomeの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeRecoveryDiagnosticOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeRecoveryDiagnosticOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeRecoveryDiagnosticOutcome =
  | "success"
  | "callback_error"
  | "stream_error"
  | "stream_close"
  | "timeout"
  | "unavailable"
  | "throw";

/**
 * Project Runtime Internal Diagnostic Reporterを構築する。
 *
 * @responsibility Project Runtime Internal Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>
 * @returns createProjectRuntimeInternalDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>」がcreateProjectRuntimeInternalDiagnosticReporterの入力契約を満たす。
 * @postcondition createProjectRuntimeInternalDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeInternalDiagnosticReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProjectRuntimeInternalDiagnosticReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeInternalDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimeInternalDiagnosticReporterはProcess内の同一Subsystemで完結する。
 * @security N/A: createProjectRuntimeInternalDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency createProjectRuntimeInternalDiagnosticReporterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createProjectRuntimeInternalDiagnosticReporter(
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
    | ((outcome: ProjectRuntimeRecoveryDiagnosticOutcome) => void)
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
    new Promise<ProjectRuntimeRecoveryDiagnosticOutcome>((resolve) => {
      if (isDisposed || isUnavailable || !stream.writable || stream.destroyed) {
        resolve("unavailable");
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (
        outcome: ProjectRuntimeRecoveryDiagnosticOutcome,
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
 * Project Runtime 回復 Diagnostic Reporterを構築する。
 *
 * @responsibility Project Runtime 回復 Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createProjectRuntimeRecoveryDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateProjectRuntimeRecoveryDiagnosticReporterの入力契約を満たす。
 * @postcondition createProjectRuntimeRecoveryDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeRecoveryDiagnosticReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeRecoveryDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeRecoveryDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimeRecoveryDiagnosticReporterはProcess内の同一Subsystemで完結する。
 * @security N/A: createProjectRuntimeRecoveryDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createProjectRuntimeRecoveryDiagnosticReporterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeRecoveryDiagnosticReporter(
  stream: Writable,
  timeoutMs = PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createProjectRuntimeInternalDiagnosticReporter(stream, {
    prefix: PROJECT_RUNTIME_RECOVERY_LIFECYCLE_PREFIX,
    event: "project_runtime_recovery_transition",
    timeoutMs,
  });
}

/**
 * Project Runtime Execution Intelligence Diagnostic Reporterを構築する。
 *
 * @responsibility Project Runtime Execution Intelligence Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createProjectRuntimeExecutionIntelligenceDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateProjectRuntimeExecutionIntelligenceDiagnosticReporterの入力契約を満たす。
 * @postcondition createProjectRuntimeExecutionIntelligenceDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeExecutionIntelligenceDiagnosticReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeExecutionIntelligenceDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeExecutionIntelligenceDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimeExecutionIntelligenceDiagnosticReporterはProcess内の同一Subsystemで完結する。
 * @security N/A: createProjectRuntimeExecutionIntelligenceDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createProjectRuntimeExecutionIntelligenceDiagnosticReporterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeExecutionIntelligenceDiagnosticReporter(
  stream: Writable,
  timeoutMs = PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createProjectRuntimeInternalDiagnosticReporter(stream, {
    prefix: PROJECT_RUNTIME_EXECUTION_INTELLIGENCE_PREFIX,
    event: "project_runtime_execution_intelligence_publication",
    timeoutMs,
  });
}

const productionRecoveryDiagnosticReporter =
  createProjectRuntimeRecoveryDiagnosticReporter(process.stderr);
const productionExecutionIntelligenceDiagnosticReporter =
  createProjectRuntimeExecutionIntelligenceDiagnosticReporter(process.stderr);

/**
 * Project Runtime 回復 Diagnosticを書き込む。
 *
 * @responsibility Project Runtime 回復 Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input event: object
 * @returns N/A: writeProjectRuntimeRecoveryDiagnosticは戻り値を返さない。
 * @precondition 「event: object」がwriteProjectRuntimeRecoveryDiagnosticの入力契約を満たす。
 * @postcondition writeProjectRuntimeRecoveryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: writeProjectRuntimeRecoveryDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeProjectRuntimeRecoveryDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeProjectRuntimeRecoveryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeProjectRuntimeRecoveryDiagnosticはProcess内の同一Subsystemで完結する。
 * @security N/A: writeProjectRuntimeRecoveryDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeProjectRuntimeRecoveryDiagnosticは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function writeProjectRuntimeRecoveryDiagnostic(event: object) {
  await productionRecoveryDiagnosticReporter.report(event);
}

/**
 * Project Runtime Execution Intelligence Diagnosticを書き込む。
 *
 * @responsibility Project Runtime Execution Intelligence Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input observation: ProjectRuntimeExecutionPublicationObservation
 * @returns writeProjectRuntimeExecutionIntelligenceDiagnosticの計算結果を返す。
 * @precondition 「observation: ProjectRuntimeExecutionPublicationObservation」がwriteProjectRuntimeExecutionIntelligenceDiagnosticの入力契約を満たす。
 * @postcondition writeProjectRuntimeExecutionIntelligenceDiagnosticの責務を完了した結果だけを返す。
 * @effect N/A: writeProjectRuntimeExecutionIntelligenceDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeProjectRuntimeExecutionIntelligenceDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeProjectRuntimeExecutionIntelligenceDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeProjectRuntimeExecutionIntelligenceDiagnosticはProcess内の同一Subsystemで完結する。
 * @security N/A: writeProjectRuntimeExecutionIntelligenceDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeProjectRuntimeExecutionIntelligenceDiagnosticは共有非同期状態を持たない同期処理である。
 */
function writeProjectRuntimeExecutionIntelligenceDiagnostic(
  observation: ProjectRuntimeExecutionPublicationObservation,
) {
  if (observation.status === "completed") return;
  void productionExecutionIntelligenceDiagnosticReporter.report(observation);
}

/**
 * project-runtime-composition-rootで使用するPublic Execution Dependenciesの値契約を定義する。
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
  frontProviderForTask: (
    requestedExecutorProvider: "auto" | "codex" | "claude",
  ) => "codex" | "claude";
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore;
  createIntegrationAdapter: (
    repositoryRoot: string,
  ) => ProjectRuntimeCandidatePort;
  resolveTaskRecoveryCorrelations?: typeof resolveRuntimeOwnedDockerTaskRecoveryCorrelations;
  recordExecutionEvent: typeof recordProjectRuntimeExecutionEvent;
  observeExecutionEventPublication: (
    observation: ProjectRuntimeExecutionPublicationObservation,
  ) => void;
}>;

/**
 * project-runtime-composition-rootで使用するProject Runtime Public Development Dependenciesの値契約を定義する。
 *
 * @responsibility Project Runtime Public Development DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimePublicDevelopmentDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimePublicDevelopmentDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimePublicDevelopmentDependenciesの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimePublicDevelopmentDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimePublicDevelopmentDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimePublicDevelopmentDependencies = Omit<
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
    frontProviderForTask: () => "codex",
    openDecisionStore: openRuntimeOwnedWindowsProjectDecisionStore,
    createIntegrationAdapter:
      createRuntimeOwnedProjectCandidateIntegrationAdapter,
    resolveTaskRecoveryCorrelations:
      resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
    recordExecutionEvent: recordProjectRuntimeExecutionEvent,
    observeExecutionEventPublication:
      writeProjectRuntimeExecutionIntelligenceDiagnostic,
  });

/**
 * project-runtime-composition-rootを安定Identityへ変換する。
 *
 * @responsibility project-runtime-composition-rootの正規化条件、一意性、変換不能時の拒否境界を所有する。
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
 * Canonical Single Task request used by both execution and bounded E2E admission.
 *
 * @responsibility Project Runtime Coordinator Task Requestの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: ProjectRuntimeObjectiveRequest、frontProvider: "codex" | "claude"
 * @returns buildProjectRuntimeCoordinatorTaskRequestの計算結果を返す。
 * @precondition 「request: ProjectRuntimeObjectiveRequest、frontProvider: "codex" | "claude"」がbuildProjectRuntimeCoordinatorTaskRequestの入力契約を満たす。
 * @postcondition buildProjectRuntimeCoordinatorTaskRequestの責務を完了した結果だけを返す。
 * @effect N/A: buildProjectRuntimeCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildProjectRuntimeCoordinatorTaskRequestは独自の失敗分岐を所有しない。
 * @invariant buildProjectRuntimeCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildProjectRuntimeCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security N/A: buildProjectRuntimeCoordinatorTaskRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: buildProjectRuntimeCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function buildProjectRuntimeCoordinatorTaskRequest(
  request: ProjectRuntimeObjectiveRequest,
  frontProvider: "codex" | "claude",
) {
  return Object.freeze({
    frontProvider,
    requestedExecutorProvider: request.requestedExecutorProvider ?? "auto",
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
 * @responsibility Project Runtime Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeProjectRuntimePublicObjectiveの計算結果を返す。
 * @precondition 「runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteProjectRuntimePublicObjectiveの入力契約を満たす。
 * @postcondition executeProjectRuntimePublicObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: executeProjectRuntimePublicObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeProjectRuntimePublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeProjectRuntimePublicObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeProjectRuntimePublicObjectiveはProcess内の同一Subsystemで完結する。
 * @security N/A: executeProjectRuntimePublicObjectiveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency executeProjectRuntimePublicObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeProjectRuntimePublicObjective(
  runtimeDependencies: PublicExecutionDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectProjectRuntimeObjectiveRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_objective_request_invalid",
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_repository_root_not_verified",
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const observedPlatform = observeProjectRuntimePlatformFamily();
  const platform =
    observedPlatform.status === "observed" &&
    observedPlatform.platformFamily === "windows"
      ? createProjectRuntimeWindowsPlatformAdapter()
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
  const execution = await runProjectRuntimeObjective(
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
            reason: "project_runtime_repository_revision_mismatch",
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
       * @input request: ProjectRuntimeObjectiveRequest
       * @returns planObjectiveの計算結果を返す。
       * @precondition 「request: ProjectRuntimeObjectiveRequest」がplanObjectiveの入力契約を満たす。
       * @postcondition planObjectiveの責務を完了した結果だけを返す。
       * @effect N/A: planObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: planObjectiveは独自の失敗分岐を所有しない。
       * @invariant planObjectiveは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: planObjectiveはProcess内の同一Subsystemで完結する。
       * @security N/A: planObjectiveはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: planObjectiveは共有非同期状態を持たない同期処理である。
       */
      planObjective(request: ProjectRuntimeObjectiveRequest) {
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
              taskRequest: buildProjectRuntimeCoordinatorTaskRequest(
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
      acknowledgeTaskRecovery:
        consumeDockerRecoveryReceiptAfterProjectSettlement,
      finalizeTaskRecoveryAcknowledgement:
        collectDockerRecoveryAcknowledgementAfterProjectRecord,
      ...(runtimeDependencies.resolveTaskRecoveryCorrelations
        ? {
            resolveTaskRecoveryCorrelations:
              runtimeDependencies.resolveTaskRecoveryCorrelations,
          }
        : {}),
      observeRecoveryTransition: writeProjectRuntimeRecoveryDiagnostic,
      execution: {
        authorization: createProjectRuntimeExecutionAuthorizationAdapter({
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
          runProjectRuntimeSingleTaskAttempt(
            {
              startTask: runtimeDependencies.startTask,
              cancelTask: runtimeDependencies.cancelTask,
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
    execution.reason !==
      "project_runtime_tasks_completed_integration_pending" ||
    typeof execution.queueId !== "string"
  )
    return execution;
  const integrationAdapter =
    runtimeDependencies.createIntegrationAdapter(repositoryRoot);
  const repositoryBindingId = stable("binding", repositoryRoot);
  const integration = await integrateProjectRuntimeOperation(
    Object.freeze({
      candidate: Object.freeze({ ...integrationAdapter, observeLeaseOwner }),
      records: createProjectRuntimeIntegrationRecordAdapter({
        workingDirectory: repositoryRoot,
        repositoryBindingId,
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId: execution.queueId,
      }),
      persistence: createProjectRuntimePersistencePorts(
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
    integration.reason === "project_runtime_milestone_accepted"
  ) {
    const latest = readProjectRuntimeState(
      repositoryRoot,
      stable("binding", repositoryRoot),
      request.projectId,
    );
    if (latest.status !== "completed" || latest.value === null)
      return createProjectRuntimeObjectiveResult(request, {
        status: "blocked",
        reason: "project_runtime_state_observation_unknown",
        queueId: execution.queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return createProjectRuntimeObjectiveResult(request, {
      status: "completed",
      reason: integration.reason,
      queueId: execution.queueId,
      projection: projectProjectRuntimeState(latest.value),
      cleanupConfirmed: integration.cleanupConfirmed,
      manualRecoveryRequired: integration.manualRecoveryRequired,
      recoveryIds: integration.recoveryIds,
      effectState: "settled",
    });
  }
  if (
    integration.status !== "blocked" ||
    integration.reason !== "project_runtime_integration_conflict" ||
    typeof integration.candidateId !== "string" ||
    typeof integration.stateGeneration !== "number"
  )
    return integration;
  const protectedStore = runtimeDependencies.openDecisionStore();
  if (protectedStore.status !== "completed")
    return Object.freeze({
      ...integration,
      reason: "project_runtime_decision_store_unavailable",
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
  const decisionCapability = createProjectRuntimeDecisionCapabilityAdapter();
  const decisionCommon = {
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: execution.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createProjectRuntimeDecisionRecoveryStore(repositoryRoot),
    capability: decisionCapability,
    persistence: createProjectRuntimePersistencePorts(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ),
  } as const;
  const decision = request.decisionCapabilityReplacement
    ? request.decisionCapabilityReplacement.decisionId !== decisionId
      ? Object.freeze({
          contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
          status: "blocked" as const,
          reason: "project_runtime_decision_replacement_binding_mismatch",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect" as const,
        })
      : replaceProjectRuntimeHumanDecision(decisionCommon, {
          recordId: projectRuntimeDecisionRecordId(
            decisionCapability,
            request.projectId,
            request.milestoneId,
            decisionId,
          ),
          replacementRequestId:
            request.decisionCapabilityReplacement.replacementRequestId,
          lifetimeMs: 24 * 60 * 60 * 1_000,
        })
    : issueProjectRuntimeHumanDecision(decisionCommon, {
        decisionId,
        repositoryRevision: request.repositoryRevision,
        expectedGeneration: integration.stateGeneration,
        allowedOptions: Object.freeze(["resume", "cancel"]),
        lifetimeMs: 24 * 60 * 60 * 1_000,
      });
  return Object.freeze({ ...integration, decision });
}

/**
 * Project Runtime Public Objectiveを実行する。
 *
 * @responsibility Project Runtime Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runProjectRuntimePublicObjectiveの計算結果を返す。
 * @precondition 「rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunProjectRuntimePublicObjectiveの入力契約を満たす。
 * @postcondition runProjectRuntimePublicObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: runProjectRuntimePublicObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runProjectRuntimePublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectRuntimePublicObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runProjectRuntimePublicObjectiveはProcess内の同一Subsystemで完結する。
 * @security N/A: runProjectRuntimePublicObjectiveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runProjectRuntimePublicObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function runProjectRuntimePublicObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return Promise.resolve(
      executeProjectRuntimePublicObjective(
        productionExecutionDependencies,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    ).catch((error: unknown) => {
      if (error instanceof RepositoryRuntimeDataAreaBlockedError)
        return projectRuntimeDataBoundaryBlocked(error);
      throw error;
    });
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return Promise.resolve(projectRuntimeDataBoundaryBlocked(error));
    throw error;
  }
}

/**
 * Development-only composition. The supplied starter still needs its own admitted capability.
 *
 * @responsibility Development Project Runtime Public Objective 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Omit< ProjectRuntimePublicDevelopmentDependencies, "createIntegrationAdapter" > & Readonly<{ createIntegrationAdapter?: PublicExecutionDependencies["createIntegrationAdapter"]; }>
 * @returns createDevelopmentProjectRuntimePublicObjectiveCandidateの計算結果を返す。
 * @precondition 「dependencies: Omit< ProjectRuntimePublicDevelopmentDependencies, "createIntegrationAdapter" > & Readonly<{ createIntegrationAdapter?: PublicExecutionDependencies["createIntegrationAdapter"]; }>」がcreateDevelopmentProjectRuntimePublicObjectiveCandidateの入力契約を満たす。
 * @postcondition createDevelopmentProjectRuntimePublicObjectiveCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentProjectRuntimePublicObjectiveCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDevelopmentProjectRuntimePublicObjectiveCandidateは独自の失敗分岐を所有しない。
 * @invariant createDevelopmentProjectRuntimePublicObjectiveCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentProjectRuntimePublicObjectiveCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: createDevelopmentProjectRuntimePublicObjectiveCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDevelopmentProjectRuntimePublicObjectiveCandidateは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentProjectRuntimePublicObjectiveCandidate(
  dependencies: Omit<
    ProjectRuntimePublicDevelopmentDependencies,
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
      dependencies.recordExecutionEvent ?? recordProjectRuntimeExecutionEvent,
    observeExecutionEventPublication:
      dependencies.observeExecutionEventPublication ??
      writeProjectRuntimeExecutionIntelligenceDiagnostic,
  });
  return Object.freeze({
    productionAuthority: false,
    run: (
      rawRequest: unknown,
      cancellationSignal: AbortSignal,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeProjectRuntimePublicObjective(
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
      executeProjectRuntimePublicDecision(
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
      executeProjectRuntimePublicStateQuery(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
  });
}

/**
 * Project Runtime Public Decisionを実行する。
 *
 * @responsibility Project Runtime Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeProjectRuntimePublicDecisionの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteProjectRuntimePublicDecisionの入力契約を満たす。
 * @postcondition executeProjectRuntimePublicDecisionの責務を完了した結果だけを返す。
 * @effect N/A: executeProjectRuntimePublicDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeProjectRuntimePublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeProjectRuntimePublicDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeProjectRuntimePublicDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: executeProjectRuntimePublicDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeProjectRuntimePublicDecisionは共有非同期状態を持たない同期処理である。
 */
function executeProjectRuntimePublicDecision(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectProjectRuntimeDecisionRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_decision_input_invalid",
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_repository_root_not_verified",
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const decisionCapability = createProjectRuntimeDecisionCapabilityAdapter();
  const recordId = projectRuntimeDecisionRecordId(
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_decision_not_observed",
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
    recoveryStore: createProjectRuntimeDecisionRecoveryStore(repositoryRoot),
    capability: decisionCapability,
    persistence: createProjectRuntimePersistencePorts(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ),
  } as const;
  if (record.disposition === "prepared")
    return recoverProjectRuntimeHumanDecision(commonFields, { recordId });
  return submitProjectRuntimeHumanDecision(commonFields, {
    decisionId,
    recordId,
    repositoryRevision: request.repositoryRevision,
    generation: request.generation,
    selectedOption: request.selectedOption,
    continuationCapability: request.continuationCapability,
  });
}

/**
 * Production decision entry shared by the CLI and MCP process.
 *
 * @responsibility Project Runtime Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runProjectRuntimePublicDecisionの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunProjectRuntimePublicDecisionの入力契約を満たす。
 * @postcondition runProjectRuntimePublicDecisionの責務を完了した結果だけを返す。
 * @effect N/A: runProjectRuntimePublicDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runProjectRuntimePublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectRuntimePublicDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runProjectRuntimePublicDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: runProjectRuntimePublicDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runProjectRuntimePublicDecisionは共有非同期状態を持たない同期処理である。
 */
export function runProjectRuntimePublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeProjectRuntimePublicDecision(
      openRuntimeOwnedWindowsProjectDecisionStore,
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return projectRuntimeDataBoundaryBlocked(error);
    throw error;
  }
}

/**
 * Read-only state entry shared by local transports. No mutation port is exposed.
 *
 * @responsibility Project Runtime Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeProjectRuntimePublicStateQueryの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteProjectRuntimePublicStateQueryの入力契約を満たす。
 * @postcondition executeProjectRuntimePublicStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: executeProjectRuntimePublicStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executeProjectRuntimePublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeProjectRuntimePublicStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeProjectRuntimePublicStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: executeProjectRuntimePublicStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeProjectRuntimePublicStateQueryは共有非同期状態を持たない同期処理である。
 */
function executeProjectRuntimePublicStateQuery(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectProjectRuntimeStateQuery(rawRequest);
  if (!request)
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_state_query_invalid",
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
  if (!identity || identity.commit !== request.repositoryRevision)
    return Object.freeze({
      contract: PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_state_revision_mismatch",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown" as const,
      projection: null,
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
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  return queryProjectRuntimeState(
    createProjectRuntimePersistencePorts(
      repositoryRoot,
      stable("binding", repositoryRoot),
    ).state,
    request,
  );
}

/**
 * Production read-only state entry shared by local transports.
 *
 * @responsibility Project Runtime Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runProjectRuntimePublicStateQueryの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunProjectRuntimePublicStateQueryの入力契約を満たす。
 * @postcondition runProjectRuntimePublicStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: runProjectRuntimePublicStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runProjectRuntimePublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectRuntimePublicStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runProjectRuntimePublicStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: runProjectRuntimePublicStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runProjectRuntimePublicStateQueryは共有非同期状態を持たない同期処理である。
 */
export function runProjectRuntimePublicStateQuery(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeProjectRuntimePublicStateQuery(
      openRuntimeOwnedWindowsProjectDecisionStore,
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return projectRuntimeDataBoundaryBlocked(error);
    throw error;
  }
}
