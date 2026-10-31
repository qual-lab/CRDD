/**
 * 一試行（Attempt）の構成診断・開始成功・拒否と清掃後の終端結果を組み立てる。
 * @packageDocumentation
 * @responsibility 非秘密構成診断を投影し、状態遷移や保存を行わず結果公開の共同条件を保持する。
 * @trace ARCH-000008
 * @boundary 一試行の実行Ownerが観測した値と上位へ返す技術結果。
 */
import { createHash } from "node:crypto";
import {
  projectCodexExecutionBoundary,
  convertProviderError,
  parseProviderResult,
  type ProviderResultParseResult,
} from "../../../ai-adapter/src/index.ts";
import type {
  AttemptDiagnosticNotice,
  AttemptPlan,
  StartResultInput,
  StartResult,
  CompletionResultInput,
  CompletionResult,
} from "./types.ts";
import {
  projectDockerExecutionBoundary,
  type CommandObservation,
  type DockerCommandExecutionClassification,
} from "../../../docker-isolation/src/index.ts";
import { SETUP_COMMAND_FAILURE_REASONS } from "./constants.ts";

/**
 * AI Adapterの内容検査と内容Hashの算出を一つの結果へまとめる。
 * @responsibility Task・Advice・Probeの変換だけを行い、実行状態・通知・保存を変更しない。
 * @trace ARCH-000008
 * @input 同じ試行の内部構成と観測済みの出力。生出力は返さない。
 * @returns AI Adapterの検査結果と、成功時だけのHash・Byte数。
 * @effect N/A: メモリ内の内容検査とHash計算のみ。
 * @invariant 呼出しのタイミングと失敗の確定は実行Ownerが所有する。
 */
export function parseAttemptOutput(
  plan: AttemptPlan,
  execution: CommandObservation,
  stdoutBytes: number,
): Readonly<{
  result: ProviderResultParseResult;
  resultSha256: string | null;
  resultBytes: number;
}> {
  const result = parseProviderResult(
    plan.operationMode === "isolated_task"
      ? {
          provider: plan.provider,
          purpose: "task",
          taskRole: plan.taskRole,
          selectedEffort: plan.executionSelection.reasoningEffort,
          raw: execution.stdout,
          taskWorkload: plan.taskWorkload,
        }
      : plan.operationMode === "workbench_advice"
        ? {
            provider: plan.provider,
            purpose: "advice",
            raw: execution.stdout,
            allowedReferences: plan.adviceAllowedReferences ?? [],
          }
        : {
            provider: plan.provider,
            purpose: "probe",
            raw: execution.stdout,
          },
  );
  return Object.freeze({
    result,
    resultSha256:
      result.status === "confirmed"
        ? createHash("sha256").update(execution.stdout, "utf8").digest("hex")
        : null,
    resultBytes: result.status === "confirmed" ? stdoutBytes : 0,
  });
}

/**
 * 一試行の開始成功・拒否を同じ入口で組み立てる。
 * @responsibility 結果の固定fieldと相関条件を所有し、Handle・Promiseを生成しない。
 * @trace ARCH-000008
 * @input 開始Ownerが確定した判別可能な入力と、準備・選択の既存補足値。
 * @returns 入力statusに対応する凍結結果。
 * @precondition 成功時のHandleとPromiseは同じ実行Ownerのものである。
 * @postcondition 拒否時は元回復参照と清掃不明の義務を保持し、成功時は同じPromiseを返す。
 * @effect N/A: 値の組立てと凍結のみ。
 * @failure 検査や起動の失敗判断は呼出しOwnerが確定する。
 * @invariant 開始成功をProvider実Process開始や清掃完了として扱わない。
 * @boundary 実行Ownerから利用側への開始結果。
 * @security 新しい実行許可を発行せず、回復参照を置換しない。
 * @concurrency 非同期処理を開始せず、Ownerが渡したPromiseを保持する。
 */
export function createStartResult(
  input: StartResultInput & Readonly<{ status: "blocked" }>,
): StartResult & Readonly<{ status: "blocked" }>;
export function createStartResult(
  input: StartResultInput & Readonly<{ status: "started" }>,
): StartResult & Readonly<{ status: "started" }>;
export function createStartResult(input: StartResultInput): StartResult;
export function createStartResult(input: StartResultInput): StartResult {
  const result =
    input.status === "started"
      ? {
          ...(input.preparationFailed === undefined
            ? {}
            : { preparationFailed: input.preparationFailed }),
          status: "started" as const,
          reason: "docker_process_controller_started" as const,
          controlCapability: input.controlCapability,
          completion: input.completion,
          operationId: input.operationId,
          recoveryId: input.recoveryId,
          dockerEffectStarted: true as const,
          providerRequestStarted: false as const,
          rawOutputReported: false as const,
          untrustedProviderTextReported: false as const,
          credentialAbsenceVerified: false as const,
          normalizedResult: null,
          normalizedResultReportedAfterCleanupOnly: true as const,
          hostPathReported: false as const,
          proxyCredentialReported: false as const,
        }
      : {
          ...(input.preparationFailed === undefined
            ? {}
            : { preparationFailed: input.preparationFailed }),
          status: "blocked" as const,
          reason: input.reason,
          controlCapability: null,
          completion: null,
          operationId: null,
          recoveryId: input.recoveryId ?? null,
          cleanupConfirmed: input.cleanupConfirmed ?? false,
          manualRecoveryRequired:
            input.manualRecoveryRequired === true ||
            input.cleanupConfirmed !== true ||
            input.recoveryId != null,
          dockerEffectStarted: false as const,
          providerRequestStarted: false as const,
          normalizedResult: null,
          rawOutputReported: false as const,
          untrustedProviderTextReported: false as const,
          credentialAbsenceVerified: false as const,
          hostPathReported: false as const,
          proxyCredentialReported: false as const,
        };
  if (input.selection === undefined) return Object.freeze(result);
  return Object.freeze({
    ...result,
    selectionNotice: input.selection.notice,
    selectedModel: input.selection.model,
    selectedEffort: input.selection.effort,
  });
}

/**
 * 清掃後の一試行結果を組み立てる。
 * @responsibility 内容・観測・所見を公開できる共同条件を保持する。
 * @trace ARCH-000008
 * @input 終端状態、理由、操作IDと選定記録ID、元回復参照、実行Ownerの観測値。
 * @returns 明示されたCompletionResult契約を満たす凍結結果。
 * @precondition 内容と所見はAI Adapterの検査を通っている。
 * @postcondition 清掃不明・取消・失敗時は所見を返さず、是正許可を含めない。
 * @effect N/A: 結果の値だけを構築する。
 * @failure 清掃条件の欠測は既存の回復待ち結果へ閉じる。
 * @invariant 共有状態・保存・次試行の許可発行を所有しない。
 * @boundary 技術実行から信頼した上位への一時的な結果搬送。
 * @security 所見本文の保存・外部公開は上位が別に判断する。
 * @concurrency N/A: 同期の値構築のみ。
 */
export function createCompletionResult(
  input: CompletionResultInput,
): CompletionResult {
  const { status, reason, operationId, recoveryId } = input;
  const cleanupConfirmed =
    input.processTreeTerminationConfirmed &&
    input.containersAbsent &&
    input.networksAbsent &&
    input.homeLeaseReleased;
  return Object.freeze({
    status: cleanupConfirmed ? status : ("blocked" as const),
    reason: cleanupConfirmed
      ? reason
      : "docker_process_controller_cleanup_unconfirmed",
    operationId: operationId,
    recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    dockerEffectStarted: true,
    providerRequestStarted: input.providerRequestStarted,
    cancellationRequested: input.cancellationRequested,
    processTreeTerminationConfirmed: input.processTreeTerminationConfirmed,
    containersAbsent: input.containersAbsent,
    networksAbsent: input.networksAbsent,
    homeLeaseReleased: input.homeLeaseReleased,
    cleanupConfirmed,
    resultSha256:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? input.resultSha256
        : null,
    resultBytes:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? input.resultBytes
        : 0,
    normalizedResult:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? input.normalizedResult
        : null,
    providerExecutionObservation:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? (input.providerExecutionObservation ?? null)
        : null,
    providerTurnObservation:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? (input.providerTurnObservation ?? null)
        : null,
    reviewFindings:
      cleanupConfirmed &&
      status === "completed" &&
      !input.cancellationRequested &&
      input.normalizedResult !== null &&
      "decision" in input.normalizedResult &&
      input.normalizedResult.decision === "changes_requested" &&
      input.reviewFindings?.length
        ? input.reviewFindings
        : null,
    subscriptionAuthConfirmed: input.subscriptionAuthConfirmed,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * 下位の技術分類を公開用途別の理由へ投影する。
 *
 * @responsibility Docker Isolationの分類を再計算せず、Providerと用途の意味へ接続する。
 * @trace ARCH-000008
 * @input execution: 元の観測、purpose: 用途、provider: Provider、classified: 下位の技術分類。
 * @returns convertCommandResultの計算結果を返す。
 * @precondition 「execution: CommandObservation | null、purpose: string、provider: "codex" | "claude"」がconvertCommandResultの入力契約を満たす。
 * @postcondition convertCommandResultの責務を完了した結果だけを返す。
 * @effect N/A: convertCommandResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: convertCommandResultは独自の失敗分岐を所有しない。
 * @invariant convertCommandResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security convertCommandResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: convertCommandResultは共有非同期状態を持たない同期処理である。
 */
export function convertCommandResult(
  execution: CommandObservation | null,
  purpose: string,
  provider: "codex" | "claude",
  classified: DockerCommandExecutionClassification,
) {
  const isProvider = purpose === "start_provider_attached";
  if (classified.category === "deadline_exceeded")
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? "provider_deadline_exceeded"
        : "docker_setup_deadline_exceeded",
    });
  if (classified.category === "output_limit_exceeded")
    return Object.freeze({
      ok: false,
      reason: "provider_output_limit_exceeded",
    });
  if (classified.category === "signalled")
    return Object.freeze({ ok: false, reason: "provider_process_signalled" });
  if (classified.category === "nonzero_exit") {
    if (execution === null)
      throw new Error("docker_command_classification_inconsistent");
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? convertProviderError(provider, execution).reason
        : Object.hasOwn(SETUP_COMMAND_FAILURE_REASONS, purpose)
          ? SETUP_COMMAND_FAILURE_REASONS[
              purpose as keyof typeof SETUP_COMMAND_FAILURE_REASONS
            ]
          : "docker_setup_command_failed",
    });
  }
  return Object.freeze({
    ok: true,
    reason: "command_completed",
    stdoutBytes: classified.stdoutBytes,
  });
}

/**
 * 隔離構成を秘密を含まない設定診断へ投影する。
 * @responsibility 設定値だけを通知用データへ変換し、隔離の実成立を推定しない。
 * @trace ARCH-000008
 * @input 同じ試行の固定技術構成。
 * @returns 操作相関と設定項目だけを含む通知値。
 * @effect N/A: 値の投影のみ。通知の発行はexecuteが所有する。
 * @boundary 技術構成と上位へ渡す非秘密診断。
 * @security Command本文、Home Path、認証情報を返さない。
 */
export function createConfigurationNotice(
  plan: AttemptPlan,
): Extract<
  AttemptDiagnosticNotice,
  { event: "coordinator_provider_boundary_configured" }
> {
  const docker = projectDockerExecutionBoundary(
    plan.commands,
    plan.providerImageDigest,
  );
  const codex =
    plan.provider === "codex"
      ? projectCodexExecutionBoundary(docker?.payloadArgv ?? [])
      : null;
  return Object.freeze({
    event: "coordinator_provider_boundary_configured" as const,
    taskRole: plan.taskRole,
    provider: plan.provider,
    operationId: plan.operationId,
    approvalModeConfigured: codex?.approvalModeConfigured ?? "not_applicable",
    sandboxModeConfigured: codex?.sandboxModeConfigured ?? "not_applicable",
    workspaceMountModeConfigured: plan.workspaceMountMode,
    networkPolicyHash: plan.networkPolicy?.policyHash ?? null,
    rootFilesystemReadOnlyConfigured:
      docker?.rootFilesystemReadOnlyConfigured ?? false,
    nonRootUserConfigured: docker?.nonRootUserConfigured ?? false,
    workdirConfigured: docker?.workdirConfigured ?? false,
  });
}
