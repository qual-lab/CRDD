/**
 * Workbench読取り助言を署名済みCoordinator Runtimeへ接続する。
 *
 * @packageDocumentation
 * @responsibility 署名配布物の確認、Operation、Provider Home、Selection、Docker回復、取消およびcleanupを一つの助言Lifecycleへ閉じる。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Workbench助言Executorと署名済みDocker Provider Runtimeの実境界。
 * @effect 明示確認済み依頼ごとに選択Providerを最大一回実行し、所有する一時資源を清掃する。
 * @security Repository／WorkspaceをProviderへ共有せず、抽出済み助言JSONだけを返す。
 */
import {
  isRuntimeProcessEffectBlocked,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../host-runtime/runtime-process-safety-state.ts";
import { prepareRuntimeOwnedClaudeDockerAdviceCandidate } from "../provider/claude-docker-runtime-adapter.ts";
import { prepareRuntimeOwnedCodexDockerAdviceCandidate } from "../provider/codex-docker-runtime-adapter.ts";
import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createRuntimeOwnedCoordinatorOperation,
} from "../repository-operation/coordinator-operation-creation-internal.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "../provider/delegation-selection-grant-runtime.ts";
import { bindRuntimeOwnedRepositoryOperation } from "../repository-operation/repository-operation-runtime.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  startRuntimeOwnedDockerProcessController,
} from "../docker-runtime/docker-process-controller.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  finalizeRuntimeOwnedDockerRecovery,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerHostCleanupReceipt,
} from "../docker-runtime/docker-recovery-runtime.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  classifyOwnedOperationDirectoryCreationFailure,
  cleanupOwnedOperationDirectoriesAsync,
  confirmOwnedHostOperationGenerationLockReadiness,
  observeOwnedHostOperationGenerationLoss,
  verifyOwnedOperationCleanupOutcome,
} from "../host-runtime/execution-environment.ts";
import { consumeRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../platform-access/platform-provisioner-package-filesystem.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "../provider/provider-home-mount-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "../provider/provider-home-windows-adapter.ts";
import type { WorkbenchAiAdviceExecutionPlan } from "./workbench-ai-advice-execution-plan.ts";
import type {
  WorkbenchAiAdviceRuntimePort,
  WorkbenchAiAdviceRuntimeResult,
} from "./workbench-ai-advice-provider-executor.ts";
import {
  issueRuntimeOwnedWorkbenchAiAdvicePacket,
  revokeRuntimeOwnedWorkbenchAiAdvicePacket,
} from "./workbench-ai-advice-runtime-packet.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";

export const WORKBENCH_AI_ADVICE_PRODUCTION_RUNTIME_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-production-runtime";
export const WORKBENCH_AI_ADVICE_PRODUCTION_RUNTIME_CONTRACT_REVISION = 1;

/**
 * 助言Runtimeの初回失敗に結合する非公開の回復情報を表す。
 *
 * @responsibility 清掃分類と取得済みexact参照を同じ初回結果に保持する。
 * @trace ARCH-000008
 * @shape 清掃確認、手動回復要否および取得済み参照またはnullの閉じた値。
 * @invariant 清掃確認済みの場合は参照を回復対象として保持しない。
 * @boundary Coordinator内部の失敗分類境界。
 * @security 元参照を公開JSON、理由、Provider入力またはlogへ複製しない。
 * @compatibility 公開結果SchemaおよびRecovery Authorityを変更しない。
 */
type HostFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;

const hostFailures = new WeakMap<object, HostFailure>();
const initializationFailures = new WeakMap<Error, HostFailure>();

/**
 * 同じ初回Runtime結果に保持されたHost失敗分類を内部で照会する。
 *
 * @responsibility 元の結果Objectに結合した分類だけを返す。
 * @trace ARCH-000008
 * @input result: 初回Runtime結果または未知の値。
 * @returns 保持済み分類、または結合がなければnull。
 * @precondition 呼出し元はCoordinator内部で結果Objectを保持している。
 * @postcondition copy、公開投影または別Processに元参照を復元しない。
 * @effect N/A: Process内WeakMapを読み取るだけである。
 * @failure 未登録の値をnullとし、Host資源不存在とは解釈しない。
 * @invariant 参照の照会から削除権限、非使用または回復成功を発行しない。
 * @boundary 非公開Runtime結果と内部失敗分類の境界。
 * @security 公開indexへexportせず、JSON列挙対象へ値を追加しない。
 * @concurrency 同じ結果への分類を返却後に変更しない。
 */
export function classifyWorkbenchAiAdviceHostFailure(result: unknown) {
  return result !== null && typeof result === "object"
    ? (hostFailures.get(result) ?? null)
    : null;
}

/**
 * 署名済みWorkbench助言Production Runtime境界で使用するRuntimeRecordの構造を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type RuntimeRecord = Readonly<Record<string, unknown>>;
/**
 * 署名済みWorkbench助言Production Runtime境界で使用するOperationの構造を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */
type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
  hostGenerationFailureDetected?: Promise<void>;
  hostGenerationLoss?: Promise<"cleanup_confirmed_failure" | "cleanup_unknown">;
  releaseHostGenerationDrain?: () => boolean;
}>;

/**
 * 署名済みWorkbench助言Production Runtime境界で使用するWorkbenchAiAdviceRuntimeDependenciesの構造を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceRuntimeDependencies = Readonly<{
  consumeVerifiedPackage: (capability: unknown) => boolean;
  createOperation: () => Promise<Operation>;
  bindRepository: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string }> | null;
  observeProviderHome: typeof inspectRuntimeOwnedWindowsProviderHomeCandidate;
  issueMountGrant: typeof issueRuntimeOwnedProviderHomeMountGrant;
  consumeMountGrant: typeof consumeRuntimeOwnedProviderHomeMountGrant;
  revokeMountGrant: typeof revokeRuntimeOwnedProviderHomeMountGrant;
  issueSelection: typeof issueRuntimeOwnedDelegationSelectionGrant;
  revokeSelection: typeof revokeRuntimeOwnedDelegationSelectionGrant;
  issuePacket: typeof issueRuntimeOwnedWorkbenchAiAdvicePacket;
  revokePacket: typeof revokeRuntimeOwnedWorkbenchAiAdvicePacket;
  prepareCodex: typeof prepareRuntimeOwnedCodexDockerAdviceCandidate;
  prepareClaude: typeof prepareRuntimeOwnedClaudeDockerAdviceCandidate;
  startProcess: typeof startRuntimeOwnedDockerProcessController;
  cancelProcess: typeof cancelRuntimeOwnedDockerProcessController;
  prepareDockerHostCleanup: typeof prepareRuntimeOwnedDockerHostCleanup;
  cleanupOperation: typeof cleanupOwnedOperationDirectoriesAsync;
  classifyOperationCleanup: typeof verifyOwnedOperationCleanupOutcome;
  recordDockerHostCleanupReceipt: (
    capability: unknown,
    completion: Readonly<{
      hostCleanupOutcome: unknown;
      dockerCompletion: unknown;
    }>,
  ) => boolean;
  finalizeDockerRecovery: typeof finalizeRuntimeOwnedDockerRecovery;
  abandonDockerRecovery: typeof abandonRuntimeOwnedDockerRecovery;
  abandonOperation: typeof abandonOwnedHostOperationGenerationLock;
  poisonAfterCleanupUnknown: () => void;
}>;

/**
 * 署名配布物Capabilityを依頼ごとに発行するProduction助言Runtimeを生成する。
 *
 * @responsibility 一回用の署名配布物CapabilityをRuntimeへ渡し、助言Lifecycleの外へ再利用可能なAuthorityを公開しない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input issueVerifiedPackageCapability: 現在配布物を検証して一回用Capabilityを返す関数、repositoryRootCapability: 元Repositoryの検証済みRoot Capability。
 * @returns Workbench Provider Executorへ注入できるRuntime Port。
 * @precondition 発行関数は秘密値を返さず、失敗時はnullを返す。
 * @postcondition 各呼出しは独立Operationを所有し、completedはHost／Docker cleanup後だけ返る。
 * @effect 選択ProviderのDocker ProcessとRepository-local Runtime状態を操作する。
 * @failure 署名、Identity、取消、Process、回復またはcleanupの不成立をblockedへ閉じる。
 * @invariant 自動再送、Provider fallback、Repository Mountおよび生出力公開を行わず、Selection前に元Repository Identityへ結合する。
 * @boundary Workbench Production Compositionと署名済みCoordinator Runtimeの間。
 * @security Capability、Host Path、Credentialおよび生Provider出力を公開結果へ含めない。
 * @concurrency 呼出しごとに独立Operationを生成し、共有Authorityを使い回さない。
 */
export function createRuntimeOwnedWorkbenchAiAdviceProductionRuntime(
  issueVerifiedPackageCapability: () => unknown,
  repositoryRootCapability: VerifiedRepositoryRoot,
): WorkbenchAiAdviceRuntimePort {
  const repositoryRoot = resolveVerifiedRepositoryRoot(
    repositoryRootCapability,
  );
  const runtime = createWorkbenchAiAdviceRuntime(
    createProductionDependencies(repositoryRoot),
  );
  return (executionPlan, cancellationSignal) =>
    runtime(
      executionPlan,
      cancellationSignal,
      issueVerifiedPackageCapability(),
    );
}

/**
 * 試験専用の依存注入候補を生成する。
 *
 * @responsibility 注入済み依存を使うRuntimeと固定の非Authority package candidateを試験へ提供する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input dependencies: 全外部境界を明示注入したRuntime依存。
 * @returns runtime関数と試験専用package candidate。
 * @precondition dependenciesは試験が所有し、Production Capabilityを含めない。
 * @postcondition Candidate自体はProduction Authorityを持たない。
 * @effect N/A: 候補生成時には外部Effectを発行しない。
 * @failure N/A: 実行時失敗は返却Runtimeの閉じた結果へ収束する。
 * @invariant Production署名Capabilityを偽装しない。
 * @boundary Contract TestとWorkbench助言Runtime Coreの試験境界。
 * @security 実Credential、Host PathまたはProvider Homeを組み込まない。
 * @concurrency Runtime呼出しごとの依存Lifecycleは注入先が所有する。
 */
export function createIsolatedWorkbenchAiAdviceRuntimeCandidate(
  dependencies: WorkbenchAiAdviceRuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    run: createWorkbenchAiAdviceRuntime(dependencies),
  });
}

/**
 * 署名済みWorkbench助言Production Runtime境界におけるcreateWorkbenchAiAdviceRuntimeの処理境界を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function createWorkbenchAiAdviceRuntime(
  dependencies: WorkbenchAiAdviceRuntimeDependencies,
) {
  return async (
    plan: WorkbenchAiAdviceExecutionPlan,
    cancellationSignal: AbortSignal,
    verifiedPackageCapability: unknown,
  ): Promise<WorkbenchAiAdviceRuntimeResult> => {
    if (cancellationSignal.aborted)
      return blocked(
        "workbench_ai_advice_cancelled_before_runtime_effect",
        false,
        true,
      );
    if (
      isRuntimeProcessEffectBlocked() ||
      !dependencies.consumeVerifiedPackage(verifiedPackageCapability)
    )
      return blocked(
        "workbench_ai_advice_release_verification_required",
        false,
        true,
      );

    let operation: Operation | null = null;
    let mountControl: object | null = null;
    let selectionControl: object | null = null;
    let packetOwner: object | null = null;
    let processControl: object | null = null;
    let recoveryCapability: object | null = null;
    let recoveryFinalizationCapability: object | null = null;
    let selectionCleanupConfirmed = true;
    let providerEffectIssued = false;
    let isOperationCleaned = false;
    let hostGenerationFailed = false;
    let abortListener: (() => void) | null = null;

    try {
      operation = await dependencies.createOperation();
      if (cancellationSignal.aborted)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_cancelled_during_operation_creation",
        );

      const repositoryBinding = dependencies.bindRepository(
        operation.managementCapability,
      );
      if (
        !repositoryBinding ||
        repositoryBinding.operationId !== operation.operationId
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_repository_binding_unavailable",
        );

      const selectionInput = selectionRequest(plan, operation.operationId);
      const selection = dependencies.issueSelection(
        operation.managementCapability,
        selectionInput,
      ) as RuntimeRecord;
      selectionControl = objectValue(selection.controlCapability);
      let selectionUse = objectValue(selection.useCapability);
      if (!validSelection(selection, selectionControl, selectionUse, plan))
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_unavailable",
        );

      const observation = dependencies.observeProviderHome(
        plan.provider,
        new Date().toISOString(),
      ) as RuntimeRecord;
      const observationCapability = objectValue(
        observation.observationCapability,
      );
      if (
        observation.status !== "candidate" ||
        !observationCapability ||
        observation.provider !== plan.provider
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_provider_home_unavailable",
        );

      const mount = dependencies.issueMountGrant(
        operation.managementCapability,
        observationCapability,
        plan.profileId,
      ) as RuntimeRecord;
      mountControl = objectValue(mount.controlCapability);
      const mountUse = objectValue(mount.useCapability);
      if (mount.status !== "issued" || !mountControl || !mountUse)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_grant_unavailable",
        );
      const mountObservation = dependencies.observeProviderHome(
        plan.provider,
        new Date().toISOString(),
      ) as RuntimeRecord;
      const mountObservationCapability = objectValue(
        mountObservation.observationCapability,
      );
      if (
        mountObservation.status !== "candidate" ||
        !mountObservationCapability ||
        mountObservation.provider !== plan.provider
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_reobservation_unavailable",
        );
      const consumedMount = dependencies.consumeMountGrant(
        mountUse,
        operation.managementCapability,
        mountObservationCapability,
      ) as RuntimeRecord;
      const mountAuthorization = objectValue(
        consumedMount.mountAuthorizationCapability,
      );
      if (consumedMount.status !== "consumed" || !mountAuthorization)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_mount_authorization_unavailable",
        );

      const revokedSelection = dependencies.revokeSelection(
        selectionControl,
        operation.managementCapability,
      ) as RuntimeRecord;
      if (revokedSelection.status !== "revoked")
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_refresh_revoke_failed",
        );
      selectionControl = null;
      const refreshedSelection = dependencies.issueSelection(
        operation.managementCapability,
        selectionInput,
      ) as RuntimeRecord;
      const refreshedSelectionControl = objectValue(
        refreshedSelection.controlCapability,
      );
      const refreshedSelectionUse = objectValue(
        refreshedSelection.useCapability,
      );
      selectionControl = refreshedSelectionControl;
      if (
        !validSelection(
          refreshedSelection,
          refreshedSelectionControl,
          refreshedSelectionUse,
          plan,
        )
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_refresh_unavailable",
        );
      selectionUse = refreshedSelectionUse;
      if (!sameSelection(selection, refreshedSelection))
        throw new AdviceRuntimeError(
          "workbench_ai_advice_selection_refresh_mismatch",
        );
      const packet = dependencies.issuePacket({
        operationId: operation.operationId,
        profileId: plan.profileId,
        provider: plan.provider,
        taskHash: plan.taskHash,
        projectionHash: plan.projectionHash,
        providerPrompt: plan.providerPrompt,
        providerCommand: plan.providerCommand,
      }) as RuntimeRecord;
      packetOwner = objectValue(packet.ownerCapability);
      const packetUse = objectValue(packet.useCapability);
      if (packet.status !== "issued" || !packetOwner || !packetUse)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_runtime_packet_unavailable",
        );

      const prepared = (
        plan.provider === "codex"
          ? dependencies.prepareCodex
          : dependencies.prepareClaude
      )(
        operation.managementCapability,
        operation.mountCapability,
        mountAuthorization,
        selectionUse,
        packetUse,
        packetOwner,
      ) as RuntimeRecord;
      const preparedCapability = objectValue(prepared.preparedCapability);
      if (prepared.status !== "prepared" || !preparedCapability)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_provider_preparation_failed",
        );
      packetOwner = null;
      selectionControl = null;
      mountControl = null;

      const process = dependencies.startProcess(
        preparedCapability,
        operation.managementCapability,
        (capability: unknown) => {
          recoveryCapability = objectValue(capability);
          return recoveryCapability !== null;
        },
      ) as RuntimeRecord;
      processControl = objectValue(process.controlCapability);
      const completion = process.completion;
      providerEffectIssued = process.dockerEffectStarted === true;
      if (
        process.status !== "started" ||
        !processControl ||
        !(completion instanceof Promise)
      )
        throw new AdviceRuntimeError(
          stringValue(process.reason) ??
            "workbench_ai_advice_process_start_failed",
        );

      abortListener = () => {
        if (processControl && operation)
          void dependencies.cancelProcess(
            processControl,
            operation.managementCapability,
          );
      };
      cancellationSignal.addEventListener("abort", abortListener, {
        once: true,
      });
      operation.hostGenerationFailureDetected?.then(() => {
        hostGenerationFailed = true;
        abortListener?.();
      });

      const result = (await completion) as RuntimeRecord;
      processControl = null;
      if (result.cleanupConfirmed !== true)
        throw new AdviceRuntimeError(
          stringValue(result.reason) ??
            "workbench_ai_advice_provider_cleanup_unconfirmed",
        );
      const providerCompletionReason = cancellationSignal.aborted
        ? "workbench_ai_advice_cancelled_after_provider_effect"
        : hostGenerationFailed
          ? "workbench_ai_advice_host_generation_lost"
          : result.status === "completed"
            ? null
            : (stringValue(result.reason) ??
              "workbench_ai_advice_provider_failed");
      recoveryFinalizationCapability = objectValue(
        result.recoveryFinalizationCapability,
      );
      if (
        !recoveryCapability ||
        !recoveryFinalizationCapability ||
        recoveryCapability !== recoveryFinalizationCapability
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_recovery_finalization_unavailable",
        );
      const normalized =
        providerCompletionReason === null
          ? recordValue(result.normalizedResult)
          : null;
      const adviceJson = normalized ? stringValue(normalized.adviceJson) : null;
      if (
        providerCompletionReason === null &&
        (normalized?.contract !==
          "crdd-coordinator/workbench-ai-advice-provider-output" ||
          normalized?.contractRevision !== 1 ||
          !adviceJson)
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_normalized_result_invalid",
        );

      if (
        !dependencies.prepareDockerHostCleanup(recoveryFinalizationCapability)
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_host_cleanup_intent_unconfirmed",
        );
      const hostCleanupOutcome = await dependencies.cleanupOperation(
        operation.owned,
      );
      const hostCleanup =
        dependencies.classifyOperationCleanup(hostCleanupOutcome);
      if (!hostCleanup)
        throw new AdviceRuntimeError(
          "workbench_ai_advice_operation_cleanup_unconfirmed",
        );
      isOperationCleaned = true;
      if (
        !dependencies.recordDockerHostCleanupReceipt(
          recoveryFinalizationCapability,
          Object.freeze({ hostCleanupOutcome, dockerCompletion: result }),
        ) ||
        dependencies.finalizeDockerRecovery(recoveryFinalizationCapability)
          .status !== "completed"
      )
        throw new AdviceRuntimeError(
          "workbench_ai_advice_docker_recovery_finalization_unconfirmed",
        );
      recoveryCapability = null;
      recoveryFinalizationCapability = null;
      operation.releaseHostGenerationDrain?.();
      if (hostCleanup === "protocol_failure_cleanup_confirmed")
        return blocked("workbench_ai_advice_host_generation_lost", true, true);
      if (providerCompletionReason !== null)
        return blocked(providerCompletionReason, true, true);
      if (adviceJson === null)
        return blocked(
          "workbench_ai_advice_normalized_result_invalid",
          true,
          true,
        );
      return Object.freeze({
        status: "completed" as const,
        reason: null,
        adviceJson,
        providerEffectIssued: true as const,
        cleanupConfirmed: true as const,
      });
    } catch (error) {
      if (processControl && operation) {
        try {
          await dependencies.cancelProcess(
            processControl,
            operation.managementCapability,
          );
        } catch {}
      }
      if (packetOwner) dependencies.revokePacket(packetOwner);
      if (selectionControl && operation) {
        try {
          const revokedSelection = dependencies.revokeSelection(
            selectionControl,
            operation.managementCapability,
          ) as RuntimeRecord;
          if (revokedSelection.status === "revoked") selectionControl = null;
          else selectionCleanupConfirmed = false;
        } catch {
          selectionCleanupConfirmed = false;
        }
      }
      if (mountControl && operation)
        dependencies.revokeMountGrant(
          mountControl,
          operation.managementCapability,
        );
      if (recoveryCapability)
        dependencies.abandonDockerRecovery(recoveryCapability);

      const initializationFailure =
        error instanceof AdviceRuntimeError
          ? (initializationFailures.get(error) ?? null)
          : classifyOwnedCoordinatorOperationCreationFailure(error);
      let cleanupConfirmed =
        isOperationCleaned ||
        (operation === null &&
          initializationFailure?.cleanupConfirmed === true);
      if (operation && !isOperationCleaned && !providerEffectIssued) {
        try {
          const cleanup = dependencies.classifyOperationCleanup(
            await dependencies.cleanupOperation(operation.owned),
          );
          cleanupConfirmed = cleanup !== null;
        } catch {
          cleanupConfirmed = false;
        }
      }
      cleanupConfirmed = cleanupConfirmed && selectionCleanupConfirmed;
      if (operation && !cleanupConfirmed) {
        try {
          await dependencies.abandonOperation(operation.managementCapability);
        } catch {}
      }
      if (!cleanupConfirmed) dependencies.poisonAfterCleanupUnknown();
      operation?.releaseHostGenerationDrain?.();
      const result = blocked(
        error instanceof AdviceRuntimeError
          ? error.reason
          : "workbench_ai_advice_runtime_failed_closed",
        providerEffectIssued,
        cleanupConfirmed,
      );
      hostFailures.set(
        result,
        Object.freeze({
          cleanupConfirmed,
          manualRecoveryRequired: !cleanupConfirmed,
          hostRecoveryId: cleanupConfirmed
            ? null
            : (operation?.hostRecoveryId ??
              initializationFailure?.hostRecoveryId ??
              null),
        }),
      );
      return result;
    } finally {
      if (abortListener)
        cancellationSignal.removeEventListener("abort", abortListener);
    }
  };
}

/**
 * 署名済みWorkbench助言Production Runtime境界で使用するAdviceRuntimeErrorのlifecycleを固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @construction 明示された入力からだけ生成する。
 * @lifecycle 生成元の処理範囲を越えてAuthorityまたは資源を保持しない。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

class AdviceRuntimeError extends Error {
  readonly reason: string;

  /**
   * 公開理由と私有Host分類を同じ初期化失敗へ結合する。
   *
   * @responsibility 下位で取得済みの分類を外側catchまで保持する。
   * @trace ARCH-000008
   * @input reason: 固定理由、hostFailure: 私有分類またはnull。
   * @returns 現在Process内の失敗Object。
   * @precondition 分類は所有Operation境界の観測結果である。
   * @postcondition 理由へ元参照を埋め込まない。
   * @effect N/A: Errorの局所値を初期化するだけである。
   * @failure N/A: 自身で追加の資源処置をしない。
   * @invariant 分類の保持から回復成功やAuthorityを発行しない。
   * @boundary 下位初期化と外側の失敗処理の境界。
   * @security Errorを公開結果として返さず、私有参照はJSON投影しない。
   * @concurrency 生成後に分類を置換しない。
   */
  constructor(reason: string, hostFailure: HostFailure | null = null) {
    super(reason);
    this.reason = reason;
    if (hostFailure !== null) initializationFailures.set(this, hostFailure);
  }
}

/**
 * 署名済みWorkbench助言Production Runtime境界におけるselectionRequestの処理境界を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function selectionRequest(
  plan: WorkbenchAiAdviceExecutionPlan,
  operationId: string,
) {
  return Object.freeze({
    frontProvider: plan.provider,
    delegationNeed: "beneficial",
    delegationReason: "explicit_user_delegation",
    requestedExecutorProvider: plan.provider,
    requestedProfileId: plan.profileId,
    subjectProvider: null,
    requiresIndependentProvider: false,
    role: "coordinator",
    workClass: "diagnosis",
    planState: "complete",
    risk: "low",
    difficulty: "medium",
    decisionImpact: "material",
    isLocalCandidateOnly: false,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: true,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
  });
}

/**
 * Workbench助言のSelectionが固定実行計画と一致するか判定する。
 *
 * @responsibility Provider Effect前にProfile、Model、推論強度およびCapabilityの完全性を検査する。
 * @trace ARCH-000010
 * @input selection: Selection結果、controlCapability: 制御Capability、useCapability: 利用Capability、plan: 固定実行計画
 * @returns 固定実行計画と完全一致する発行済みSelectionだけtrueを返す。
 * @precondition Selection結果は署名CoordinatorのSelection境界から返されている。
 * @postcondition trueでもProvider Effect Authorityを発行しない。
 * @effect N/A: 入力値の比較だけを行う。
 * @failure 不足、不一致または不正状態をfalseへ閉じる。
 * @invariant Repository／Workspace共有可否を変更しない。
 * @boundary Workbench助言LifecycleとSelection Grant境界。
 * @security Capability自体を公開結果へ含めない。
 * @concurrency N/A: 共有状態を持たない同期判定である。
 */
function validSelection(
  selection: RuntimeRecord,
  controlCapability: object | null,
  useCapability: object | null,
  plan: WorkbenchAiAdviceExecutionPlan,
) {
  return (
    selection.status === "issued" &&
    controlCapability !== null &&
    useCapability !== null &&
    selection.executorProvider === plan.provider &&
    selection.profileId === plan.profileId &&
    selection.selectedModel === plan.exactModelId &&
    selection.selectedEffort === plan.reasoningEffort &&
    typeof selection.speedMode === "string" &&
    typeof selection.selectionNotice === "string"
  );
}

/**
 * Mount前後のSelectionが同じ意味を保持するか判定する。
 *
 * @responsibility 短命Selectionの再発行によってProvider、Profile、Model、推論強度、速度または理由が変化しないことを保証する。
 * @trace ARCH-000010
 * @input initial: Mount前Selection、refreshed: Effect直前Selection
 * @returns 意味Propertyが完全一致する場合だけtrueを返す。
 * @precondition 両Selectionは同じOperationと入力から発行されている。
 * @postcondition Capability Object Identityは比較対象に含めない。
 * @effect N/A: 入力値の比較だけを行う。
 * @failure 意味差または不足Propertyをfalseへ閉じる。
 * @invariant Selectionの短命性と一回消費性を変更しない。
 * @boundary Mount前選定とProvider Effect直前選定の境界。
 * @security Selection理由以外の内部状態を公開しない。
 * @concurrency N/A: 共有状態を持たない同期判定である。
 */
function sameSelection(initial: RuntimeRecord, refreshed: RuntimeRecord) {
  return (
    initial.executorProvider === refreshed.executorProvider &&
    initial.profileId === refreshed.profileId &&
    initial.selectedModel === refreshed.selectedModel &&
    initial.selectedEffort === refreshed.selectedEffort &&
    initial.speedMode === refreshed.speedMode &&
    initial.selectionNotice === refreshed.selectionNotice
  );
}

/**
 * Operation作成と世代Lock準備を同じ初期化失敗境界へ閉じる。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input dependencies: 固定本番依存、または非Authorityの局所試験依存。
 * @returns 準備済みOperationと同じ世代の喪失観測。
 * @precondition 作成境界は取得済み参照と失敗分類を所有する。
 * @postcondition 初期化失敗は清掃分類と未解決のexact参照を同じErrorへ保持する。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

async function createProductionOperation(
  dependencies: OperationInitializationDependencies = productionOperationInitialization,
): Promise<Operation> {
  let operation: Operation;
  try {
    operation = dependencies.create();
  } catch (error) {
    const creation =
      classifyOwnedOperationDirectoryCreationFailure(error) ??
      classifyOwnedCoordinatorOperationCreationFailure(error);
    if (!creation?.cleanupConfirmed) dependencies.poison();
    throw new AdviceRuntimeError(
      creation?.cleanupConfirmed
        ? "workbench_ai_advice_operation_initialization_failed_cleanup_confirmed"
        : "workbench_ai_advice_operation_initialization_cleanup_unknown_process_restart_required",
      creation,
    );
  }
  try {
    const activation = await dependencies.activate(
      operation.managementCapability,
    );
    if (activation !== "activated") throw new Error("activation_failed");
    const readiness = await dependencies.confirmReadiness(
      operation.managementCapability,
    );
    if (readiness !== "ready") throw new Error("readiness_failed");
    const loss = dependencies.observeLoss(operation.managementCapability);
    return Object.freeze({
      ...operation,
      hostGenerationFailureDetected: loss.detected,
      hostGenerationLoss: loss.outcome,
      releaseHostGenerationDrain: loss.releaseDrain,
    });
  } catch {
    let cleanupConfirmed = false;
    try {
      cleanupConfirmed =
        dependencies.classifyCleanup(
          await dependencies.cleanup(operation.owned),
        ) !== null;
    } catch {}
    if (!cleanupConfirmed) dependencies.poison();
    throw new AdviceRuntimeError(
      cleanupConfirmed
        ? "workbench_ai_advice_host_generation_lock_unavailable_cleanup_confirmed"
        : "workbench_ai_advice_host_generation_lock_cleanup_unknown_process_restart_required",
      Object.freeze({
        cleanupConfirmed,
        manualRecoveryRequired: !cleanupConfirmed,
        hostRecoveryId: cleanupConfirmed ? null : operation.hostRecoveryId,
      }),
    );
  }
}

/**
 * Operation作成と世代Lock準備の固定依存を表す。
 *
 * @responsibility 本番と局所反証を同じ初期化処理へ接続する。
 * @trace ARCH-000008
 * @shape 作成、activation、readiness、喪失観測、清掃、清掃分類および停止の七依存。
 * @invariant 清掃分類に成功を捏造する既定値を持たない。
 * @boundary 助言RuntimeのOperation初期化境界。
 * @security 試験依存から本番Authorityを発行しない。
 * @compatibility 本番依存は既存のCoordinator所有Operationへ固定する。
 */
type OperationInitializationDependencies = Readonly<{
  create: () => Operation;
  activate: typeof activateOwnedHostOperationGenerationLock;
  confirmReadiness: typeof confirmOwnedHostOperationGenerationLockReadiness;
  observeLoss: typeof observeOwnedHostOperationGenerationLoss;
  cleanup: typeof cleanupOwnedOperationDirectoriesAsync;
  classifyCleanup: typeof verifyOwnedOperationCleanupOutcome;
  poison: () => void;
}>;

const productionOperationInitialization: OperationInitializationDependencies =
  Object.freeze({
    create: createRuntimeOwnedCoordinatorOperation,
    activate: activateOwnedHostOperationGenerationLock,
    confirmReadiness: confirmOwnedHostOperationGenerationLockReadiness,
    observeLoss: observeOwnedHostOperationGenerationLoss,
    cleanup: cleanupOwnedOperationDirectoriesAsync,
    classifyCleanup: verifyOwnedOperationCleanupOutcome,
    poison: poisonRuntimeProcessAfterCleanupUnknown,
  });

/**
 * 権限を持たないOperation初期化の局所反証候補を構成する。
 *
 * @responsibility 本番と同じ作成・世代Lock失敗分類を偽依存で実行する。
 * @trace ARCH-000008
 * @input dependencies: 局所試験用の閉じた依存。
 * @returns productionAuthority=falseと初期化関数。
 * @precondition 依存は本番のAuthorityまたは実資源を取得しない。
 * @postcondition 候補から署名Runtimeの権限を発行しない。
 * @effect 返されたcreate実行時だけ注入依存を呼ぶ。
 * @failure 本番と同じ私有失敗分類を保持してthrowする。
 * @invariant 本番の固定依存を変更しない。
 * @boundary Coordinator内部の局所反証境界。
 * @security 公開index、CLIまたはHTTPへ入口を追加しない。
 * @concurrency 候補生成時に依存集合を固定する。
 */
export function createIsolatedWorkbenchAiOperationCandidate(
  dependencies: OperationInitializationDependencies,
) {
  const fixed = Object.freeze({ ...dependencies });
  return Object.freeze({
    productionAuthority: false as const,
    /**
     * 固定した偽依存で本番と同じ初期化処理を開始する。
     *
     * @responsibility 局所反証を別実装で代替せず同じ失敗境界へ接続する。
     * @trace ARCH-000008
     * @input N/A: 候補生成時の固定依存だけを用いる。
     * @returns 準備済み偽Operation、または私有分類付きの失敗。
     * @precondition 注入依存は本番権限を取得しない。
     * @postcondition 元の失敗分類と未解決参照を保持する。
     * @effect 注入された依存だけを呼ぶ。
     * @failure 本番と同じ初期化失敗をthrowする。
     * @invariant 本番依存を変更しない。
     * @boundary Coordinator内部の局所反証境界。
     * @security 公開入口や本番Authorityを提供しない。
     * @concurrency 実行ごとにOperationを局所保持する。
     */
    create: () => createProductionOperation(fixed),
  });
}

/**
 * 検証済みRepositoryへ閉じたWorkbench助言Production依存を構築する。
 *
 * @responsibility Workbench助言OperationのRepository結合と署名Coordinator実境界を同じ依存集合へ固定する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @input repositoryRoot: 検証済みCapabilityから解決したRepository Root。解決不能時はnull。
 * @returns Repository Scopeへ閉じたProduction Runtime依存を返す。
 * @precondition Repository RootはVersion Control境界で検証済み、または解決不能としてnullである。
 * @postcondition nullの場合も別Repositoryへfallbackせず、Repository結合時にFail Closedとなる。
 * @effect N/A: 依存関数を構成するだけで、OperationまたはFilesystem Effectをまだ発行しない。
 * @failure Repository結合不能は実行時に`workbench_ai_advice_repository_binding_unavailable`へ閉じる。
 * @invariant Repository／WorkspaceのProvider Mountを有効化しない。
 * @boundary Workbench CLIの検証済みRepository Capabilityと署名Coordinator Runtimeの境界。
 * @security Repository Pathを公開結果、Task PacketまたはProvider入力へ追加しない。
 * @concurrency 返却依存はOperationごとに独立したCapabilityへ結合される。
 */
function createProductionDependencies(
  repositoryRoot: string | null,
): WorkbenchAiAdviceRuntimeDependencies {
  return Object.freeze({
    consumeVerifiedPackage:
      consumeRuntimeOwnedVerifiedCoordinatorPackageCapability,
    createOperation: createProductionOperation,
    bindRepository: (managementCapability) =>
      repositoryRoot === null
        ? null
        : bindRuntimeOwnedRepositoryOperation(
            managementCapability,
            repositoryRoot,
          ),
    observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
    issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
    consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
    revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
    issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
    revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
    issuePacket: issueRuntimeOwnedWorkbenchAiAdvicePacket,
    revokePacket: revokeRuntimeOwnedWorkbenchAiAdvicePacket,
    prepareCodex: prepareRuntimeOwnedCodexDockerAdviceCandidate,
    prepareClaude: prepareRuntimeOwnedClaudeDockerAdviceCandidate,
    startProcess: startRuntimeOwnedDockerProcessController,
    cancelProcess: cancelRuntimeOwnedDockerProcessController,
    prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
    cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
    classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
    recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
    finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
    abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
    abandonOperation: abandonOwnedHostOperationGenerationLock,
    poisonAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
  });
}

/**
 * 署名済みWorkbench助言Production Runtime境界におけるobjectValueの処理境界を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function objectValue(value: unknown): object | null {
  return value !== null && typeof value === "object" ? value : null;
}

/**
 * 署名済みWorkbench助言Production Runtime境界におけるrecordValueの処理境界を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function recordValue(value: unknown): RuntimeRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RuntimeRecord)
    : null;
}

/**
 * 署名済みWorkbench助言Production Runtime境界におけるstringValueの処理境界を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * 署名済みWorkbench助言Production Runtime境界におけるblockedの処理境界を固定する。
 *
 * @responsibility 署名済みWorkbench助言Production Runtime境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000008
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function blocked(
  reason: string,
  providerEffectIssued: boolean,
  cleanupConfirmed: boolean,
): WorkbenchAiAdviceRuntimeResult {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    adviceJson: null,
    providerEffectIssued,
    cleanupConfirmed,
  });
}
