/**
 * 実行結果の型・理由と構造検査を所有する。
 *
 * @responsibility 生出力を公開せず、固定理由と相関した結果だけを上位へ搬送する。
 * @trace ARCH-000008
 */

import { dockerProcessControllerPublicCompletionReasons } from "../../../domain-model/src/index.ts";

import { types as utilTypes } from "node:util";
import type {
  TaskCompletionRecord,
  RuntimeLifecycleState,
} from "./controller.ts";
import {
  evaluateProviderTaskScope,
  parseProviderResult,
  parseUnambiguousJsonDocument,
  type ProviderTurnCountDiagnostic,
} from "../../../ai-adapter/src/index.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import { createHash } from "node:crypto";
import type { CoordinatorAiResultItem } from "./advice.ts";
import type { CoordinatorTaskRecoveryObligation } from "./recovery.ts";

export const PURPOSES = Object.freeze([
  "create_subscription_auth_probe",
  "start_subscription_auth_probe_attached",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_egress",
  "create_provider",
  "start_proxy",
  "start_provider_attached",
] as const);

/**
 * Docker Process Controllerが実行する固定Command用途を表す。
 *
 * @responsibility Command Planで許可する用途の型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定Purpose配列の要素だけからなる文字列unionである。
 * @invariant 任意Command用途を追加しない。
 * @boundary Runtime PlanからDocker Command実行への用途境界。
 * @security 固定用途以外のCommand発行を型境界へ昇格させない。
 * @compatibility 利用側は固定Purpose配列の要素だけへ依存する。
 */
type DockerCommandPurpose = (typeof PURPOSES)[number];

/**
 * Provider本体起動を除くDocker準備Command用途を表す。
 *
 * @responsibility 段階別Setup診断へ対応する用途集合を所有する。
 * @trace ARCH-000008
 * @shape DockerCommandPurposeからProvider起動用途を除外した文字列unionである。
 * @invariant Setup用途とProvider本体起動用途を混同しない。
 * @boundary Docker SetupとProvider実行の診断境界。
 * @security 固定Setup用途以外を診断理由へ変換しない。
 * @compatibility 利用側は固定Setup理由Registryと一対一対応する用途だけへ依存する。
 */
type DockerSetupCommandPurpose = Exclude<
  DockerCommandPurpose,
  "start_provider_attached"
>;

export const SETUP_COMMAND_FAILURE_REASONS = Object.freeze({
  create_subscription_auth_probe:
    "docker_setup_create_subscription_auth_probe_failed",
  start_subscription_auth_probe_attached:
    "docker_setup_start_subscription_auth_probe_attached_failed",
  create_internal_network: "docker_setup_create_internal_network_failed",
  create_egress_network: "docker_setup_create_egress_network_failed",
  create_proxy: "docker_setup_create_proxy_failed",
  connect_proxy_egress: "docker_setup_connect_proxy_egress_failed",
  create_provider: "docker_setup_create_provider_failed",
  start_proxy: "docker_setup_start_proxy_failed",
} satisfies Readonly<
  Record<
    DockerSetupCommandPurpose,
    DockerProcessControllerPublicCompletionReason
  >
>);

/**
 * 値がDocker Process Controllerの固定Setup用途か判定する。
 *
 * @responsibility 任意文字列を固定Purpose集合とexact照合し、段階別診断へ安全に接続する。
 * @trace ARCH-000008
 * @input value: string
 * @returns 固定Purposeにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の文字列を受け取る。
 * @postcondition trueの場合、値をDockerSetupCommandPurposeとして扱える。
 * @effect N/A: 不変Purpose集合を参照するだけである。
 * @failure N/A: 未知値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で用途を許可しない。
 * @boundary Docker Command Planから公開診断理由への分類境界。
 * @security Command引数や出力を返さず、固定Purposeだけを識別する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
export function isDockerSetupCommandPurpose(
  value: string,
): value is DockerSetupCommandPurpose {
  return (
    value !== "start_provider_attached" &&
    (PURPOSES as readonly string[]).includes(value)
  );
}

/**
 * Docker Process Controllerの最終理由を表す。
 *
 * @responsibility 公開失敗理由と完了・取消理由の閉じた型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定公開理由へ完了と取消の二状態を加えた文字列unionである。
 * @invariant 未知理由またはProvider生出力を含まない。
 * @boundary Docker Process Controller内部結果から最終公開結果への境界。
 * @security 固定理由だけを公開する。
 * @compatibility 利用側は宣言済みの最終理由だけへ依存する。
 */
export type DockerProcessControllerFinalReason =
  | DockerProcessControllerPublicCompletionReason
  | "provider_operation_completed"
  | "provider_operation_cancelled";

/**
 * 値がDocker Process Controllerの公開完了理由か判定する。
 *
 * @responsibility 下位結果の未知文字列をOwner Registry由来の固定理由から分離する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns 固定Registryにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の観測値を受け取る。
 * @postcondition trueの場合、値をDockerProcessControllerPublicCompletionReasonとして扱える。
 * @effect N/A: 不変Registryを参照するだけである。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で理由を許可しない。
 * @boundary 下位Provider結果からDocker Process Controller公開結果への診断境界。
 * @security 生出力または自由文を公開理由へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
export function isDockerProcessControllerPublicCompletionReason(
  value: unknown,
): value is DockerProcessControllerPublicCompletionReason {
  return typeof value === "string" && blockedCompletionReasons.has(value);
}

/**
 * 最初の失敗を後続の清掃結果と分けて説明する。
 *
 * @responsibility 固定段階と理由、要求・応答・記録の異なる観測を保持する。
 * @trace ARCH-000008
 * @shape 固定用途、段階、理由、例外分類と三つの観測値。
 * @invariant Handle取得をDocker受理、応答を記録成功と同一視しない。
 * @boundary Controllerから受動診断の利用側への搬送。
 * @security 自由文、Path、argv、Provider出力や秘密値を含めない。
 * @compatibility 診断は実行・清掃・Recoveryの判定を変更しない。
 */
export type PrimaryFailureDiagnostic = Readonly<{
  purpose: string | null;
  stage:
    | "submission_record"
    | "command_restriction"
    | "command_start"
    | "provider_start_observation"
    | "command_wait"
    | "execution_classification"
    | "resource_receipt_record"
    | "subscription_auth_verification"
    | "provider_result_normalization";
  reason: DockerProcessControllerFinalReason;
  exceptionCode: string | null;
  commandHandleObtained: boolean;
  responseObserved: boolean;
  receiptRecorded: boolean;
  /** 診断専用。confirmedでも非0終了を実行許可へ変換しない。 */
  authenticationStatus?: "confirmed" | "unconfirmed" | "unknown";
  /** Claude助言のTurn拒否だけに付く非秘密metadata。 */
  turnCountDiagnostic?: ProviderTurnCountDiagnostic;
  commandObservation: Readonly<{
    exitCode: number | null;
    stdoutBytes: number;
    stderrBytes: number;
  }> | null;
}>;

/**
 * 一次失敗の固定診断だけを受理する。
 *
 * @responsibility 自由文や不整合な観測を検証記録へ搬送しない。
 * @trace ARCH-000004
 * @input value: JSONから取得した診断候補。
 * @returns nullまたは完全な固定診断ならtrue。
 * @precondition 値はJSON parserを通過している。
 * @postcondition 未知の項目、理由、例外分類を拒否する。
 * @effect N/A: 値の確認だけを行う。
 * @failure 不正値はfalseへ閉じる。
 * @invariant Handle、応答、記録の順序を逆転させない。
 * @boundary Runtime診断からE2Eの記録への搬送。
 * @security Path、秘密値や生出力を受理しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function isPrimaryFailureDiagnostic(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const hasObservation = Object.hasOwn(record, "commandObservation");
  const hasAuthenticationStatus = Object.hasOwn(record, "authenticationStatus");
  const hasTurnCountDiagnostic = Object.hasOwn(record, "turnCountDiagnostic");
  const turnCount = record.turnCountDiagnostic as
    | Record<string, unknown>
    | undefined;
  const observation = record.commandObservation as
    | Record<string, unknown>
    | null
    | undefined;
  return (
    exactKeys(
      record,
      [
        "commandHandleObtained",
        "exceptionCode",
        "purpose",
        "reason",
        "receiptRecorded",
        "responseObserved",
        "stage",
        ...(hasObservation ? ["commandObservation"] : []),
        ...(hasAuthenticationStatus ? ["authenticationStatus"] : []),
        ...(hasTurnCountDiagnostic ? ["turnCountDiagnostic"] : []),
      ].sort(),
    ) &&
    (!hasObservation ||
      observation === null ||
      (observation !== undefined &&
        typeof observation === "object" &&
        exactKeys(observation, ["exitCode", "stderrBytes", "stdoutBytes"]) &&
        record.responseObserved === true &&
        (observation.exitCode === null ||
          (Number.isSafeInteger(observation.exitCode) &&
            Number(observation.exitCode) >= 0)) &&
        [observation.stdoutBytes, observation.stderrBytes].every(
          (v) => Number.isSafeInteger(v) && Number(v) >= 0,
        ))) &&
    (!hasAuthenticationStatus ||
      (record.purpose === "start_subscription_auth_probe_attached" &&
        ["execution_classification", "subscription_auth_verification"].includes(
          String(record.stage),
        ) &&
        record.responseObserved === true &&
        observation != null &&
        observation.exitCode !== null &&
        ["confirmed", "unconfirmed", "unknown"].includes(
          typeof record.authenticationStatus === "string"
            ? record.authenticationStatus
            : "",
        ))) &&
    (!hasTurnCountDiagnostic ||
      (record.purpose === "start_provider_attached" &&
        record.stage === "provider_result_normalization" &&
        record.reason === "workbench_ai_claude_turn_count_invalid" &&
        record.responseObserved === true &&
        observation?.exitCode === 0 &&
        turnCount != null &&
        typeof turnCount === "object" &&
        exactKeys(turnCount, ["numberText", "valueType"]) &&
        typeof turnCount.valueType === "string" &&
        [
          "missing",
          "null",
          "boolean",
          "number",
          "string",
          "array",
          "object",
        ].includes(turnCount.valueType) &&
        (turnCount.numberText === null ||
          (turnCount.valueType === "number" &&
            typeof turnCount.numberText === "string" &&
            turnCount.numberText.length <= 32 &&
            Number.isFinite(Number(turnCount.numberText)) &&
            String(Number(turnCount.numberText)) === turnCount.numberText &&
            (!Number.isInteger(Number(turnCount.numberText)) ||
              Number(turnCount.numberText) < 1 ||
              Number(turnCount.numberText) > 2))))) &&
    (record.purpose === null ||
      (typeof record.purpose === "string" &&
        [
          "create_subscription_auth_probe",
          "start_subscription_auth_probe_attached",
          "create_internal_network",
          "create_egress_network",
          "create_proxy",
          "connect_proxy_egress",
          "create_provider",
          "start_proxy",
          "start_provider_attached",
        ].includes(record.purpose))) &&
    typeof record.stage === "string" &&
    [
      "submission_record",
      "command_restriction",
      "command_start",
      "provider_start_observation",
      "command_wait",
      "execution_classification",
      "resource_receipt_record",
      "subscription_auth_verification",
      "provider_result_normalization",
    ].includes(record.stage) &&
    dockerProcessControllerPublicCompletionReasons.some(
      (reason) => reason === record.reason,
    ) &&
    (record.exceptionCode === null ||
      (typeof record.exceptionCode === "string" &&
        [
          "unclassified_exception",
          "ENOENT",
          "EACCES",
          "EPERM",
          "ETIMEDOUT",
          "ECONNREFUSED",
          "EPIPE",
          "docker_effect_management_required",
          "docker_effect_plan_invalid",
          "docker_effect_plan_replaced",
          "docker_effect_command_not_owned",
          "docker_effect_platform_unsupported",
          "docker_effect_cli_untrusted",
          "docker_effect_cli_replaced",
          "docker_effect_path_invalid",
          "docker_effect_config_invalid",
          "docker_effect_config_replaced",
          "docker_effect_filesystem_identity_invalid",
          "owned_operation_management_binding_required",
          "owned_operation_unknown_child",
          "owned_operation_child_replaced",
          "owned_operation_mount_replaced",
        ].includes(record.exceptionCode))) &&
    typeof record.commandHandleObtained === "boolean" &&
    typeof record.responseObserved === "boolean" &&
    typeof record.receiptRecorded === "boolean" &&
    (record.responseObserved !== true ||
      record.commandHandleObtained === true) &&
    (record.receiptRecorded !== true ||
      (record.responseObserved === true &&
        typeof record.purpose === "string" &&
        record.purpose.startsWith("create_")))
  );
}

/** Provider実行観測の閉じた診断項目。実行許可・清掃判定には使用しない。 */
export const PROVIDER_EXECUTION_OBSERVATION_KEYS = new Set([
  "transport",
  "turnCompleted",
  "itemErrorCount",
  "itemErrorCodeModeCount",
  "commandExecutionStartedCount",
  "commandExecutionCompletedCount",
  "commandExecutionFailedCount",
  "commandExecutionDeclinedCount",
  "commandExecutionExitCode0Count",
  "commandExecutionExitCode1Count",
  "commandExecutionExitCode126Count",
  "commandExecutionExitCode127Count",
  "commandExecutionOtherNonzeroExitCodeCount",
  "commandExecutionMissingExitCodeCount",
  "commandFamilyPythonCount",
  "commandFamilyPosixTextCount",
  "commandFamilyGitCount",
  "commandFamilyApplyPatchCount",
  "commandFailurePermissionCount",
  "commandFailureReadOnlyFilesystemCount",
  "commandFailureMissingPathCount",
  "commandFailureCommandNotFoundCount",
  "commandFailureSyntaxCount",
  "commandFailureSandboxCount",
  "commandFailureUnclassifiedCount",
  "fileChangeStartedCount",
  "fileChangeCompletedCount",
  "fileChangeFailedCount",
  "fileChangeDeclinedCount",
  "rawEventReported",
  "commandReported",
  "pathReported",
  "providerTextReported",
]);

/** 既存の非秘密実行観測を閉じた値へ検査する。生Command・Path・本文は受理しない。
 * @responsibility 実行診断の固定field・数値境界を公開結果と受動診断で共用する。
 * @trace ERB-IT-021
 */
export function inspectProviderExecutionObservation(raw: unknown) {
  const observation =
    snapshotPlainRecord(raw, PROVIDER_EXECUTION_OBSERVATION_KEYS) ??
    snapshotPlainRecord(
      raw,
      new Set(
        [...PROVIDER_EXECUTION_OBSERVATION_KEYS].filter(
          (key) => key !== "itemErrorCount" && key !== "itemErrorCodeModeCount",
        ),
      ),
    );
  if (!observation) return null;
  const hasErrorCounts =
    Object.hasOwn(observation, "itemErrorCount") ||
    Object.hasOwn(observation, "itemErrorCodeModeCount");
  if (
    (observation.transport === "fixed_cli_jsonl_v0_164_0" || hasErrorCounts) &&
    (!Number.isSafeInteger(observation.itemErrorCount) ||
      !Number.isSafeInteger(observation.itemErrorCodeModeCount) ||
      (observation.itemErrorCodeModeCount as number) < 0 ||
      (observation.itemErrorCount as number) > 4096 ||
      (observation.itemErrorCodeModeCount as number) >
        (observation.itemErrorCount as number))
  )
    return null;
  const countKeys = [
    "commandExecutionStartedCount",
    "commandExecutionCompletedCount",
    "commandExecutionFailedCount",
    "commandExecutionDeclinedCount",
    "commandExecutionExitCode0Count",
    "commandExecutionExitCode1Count",
    "commandExecutionExitCode126Count",
    "commandExecutionExitCode127Count",
    "commandExecutionOtherNonzeroExitCodeCount",
    "commandExecutionMissingExitCodeCount",
    "commandFamilyPythonCount",
    "commandFamilyPosixTextCount",
    "commandFamilyGitCount",
    "commandFamilyApplyPatchCount",
    "commandFailurePermissionCount",
    "commandFailureReadOnlyFilesystemCount",
    "commandFailureMissingPathCount",
    "commandFailureCommandNotFoundCount",
    "commandFailureSyntaxCount",
    "commandFailureSandboxCount",
    "commandFailureUnclassifiedCount",
    "fileChangeStartedCount",
    "fileChangeCompletedCount",
    "fileChangeFailedCount",
    "fileChangeDeclinedCount",
  ] as const;
  if (
    !["fixed_cli_jsonl_v0_149_1", "fixed_cli_jsonl_v0_164_0"].includes(
      observation.transport as string,
    ) ||
    observation.turnCompleted !== true ||
    !countKeys.every(
      (key) =>
        Number.isSafeInteger(observation[key]) &&
        (observation[key] as number) >= 0,
    ) ||
    observation.rawEventReported !== false ||
    observation.commandReported !== false ||
    observation.pathReported !== false ||
    observation.providerTextReported !== false
  )
    return null;
  return Object.freeze({ ...observation });
}

/** 候補拒否の非秘密診断。判定条件・実行許可・保存状態を所有しない。
 * @responsibility 候補取得と申告Path照合の不成立を分離する。
 * @trace ERB-IT-021
 */
export type CandidateValidationFailureDiagnostic = Readonly<{
  captureStatus: "unavailable" | "capability_unavailable" | "captured";
  pathsMatch: boolean | null;
  candidatePathCount: number | null;
  reportedPathCount: number | null;
  providerExecutionObservation: ReturnType<
    typeof inspectProviderExecutionObservation
  >;
}>;

/** 各試行の編集照合又はレビュー分類だけを表す受動診断。
 * @responsibility 本文・Pathを複製せず、初回と限定是正の観測を分離する。
 * @trace ERB-IT-021
 */
export type TaskStageDiagnostic =
  | Readonly<{
      taskRole: "executor";
      result: CandidateValidationFailureDiagnostic;
    }>
  | Readonly<{
      taskRole: "reviewer";
      decision: "approved" | "changes_requested";
      findingCount: number;
      categoryCounts: readonly number[];
    }>;

/** 段階診断の閉じたfieldと件数相関を検査する。採否・Authorityは変更しない。
 * @responsibility 自由文、余分field、欠測を成功観測へ変換しない。
 * @trace ERB-IT-021
 */
export function inspectTaskStageDiagnostic(
  raw: unknown,
): TaskStageDiagnostic | null {
  const executor = snapshotPlainRecord(raw, new Set(["taskRole", "result"]));
  if (executor?.taskRole === "executor") {
    const result = inspectCandidateValidationFailureDiagnostic(executor.result);
    return result ? Object.freeze({ taskRole: "executor", result }) : null;
  }
  const reviewer = snapshotPlainRecord(
    raw,
    new Set(["taskRole", "decision", "findingCount", "categoryCounts"]),
  );
  if (
    reviewer?.taskRole !== "reviewer" ||
    !["approved", "changes_requested"].includes(reviewer.decision as string) ||
    !Number.isSafeInteger(reviewer.findingCount) ||
    (reviewer.findingCount as number) < 0 ||
    (reviewer.findingCount as number) > 64
  )
    return null;
  const counts = snapshotPlainArray<unknown>(reviewer.categoryCounts, 4);
  if (
    counts.status !== "ok" ||
    counts.value.length !== 4 ||
    !counts.value.every(
      (n) =>
        Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 64,
    )
  )
    return null;
  const categoryCounts = counts.value as number[];
  if (
    categoryCounts.reduce((a, b) => a + b, 0) !== reviewer.findingCount ||
    (reviewer.decision === "approved") !== (reviewer.findingCount === 0)
  )
    return null;
  return Object.freeze({
    taskRole: "reviewer",
    decision: reviewer.decision as "approved" | "changes_requested",
    findingCount: reviewer.findingCount as number,
    categoryCounts: Object.freeze([...categoryCounts]),
  });
}

/** 固定分類と件数だけを受理し、本文・Path・余分fieldを診断へ搬送しない。
 * @responsibility 候補拒否診断の相関した値境界を検査する。
 * @trace ERB-IT-021
 */
export function inspectCandidateValidationFailureDiagnostic(
  raw: unknown,
): CandidateValidationFailureDiagnostic | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "captureStatus",
      "pathsMatch",
      "candidatePathCount",
      "reportedPathCount",
      "providerExecutionObservation",
    ]),
  );
  const count = (v: unknown) =>
    v === null ||
    (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1000);
  if (
    !value ||
    !["unavailable", "capability_unavailable", "captured"].includes(
      value.captureStatus as string,
    ) ||
    (value.pathsMatch !== null && typeof value.pathsMatch !== "boolean") ||
    !count(value.candidatePathCount) ||
    !count(value.reportedPathCount)
  )
    return null;
  const captured = value.captureStatus === "captured";
  const comparable =
    captured &&
    value.candidatePathCount !== null &&
    value.reportedPathCount !== null;
  if (
    (!captured && value.candidatePathCount !== null) ||
    comparable !== (value.pathsMatch !== null) ||
    (value.pathsMatch === true &&
      value.candidatePathCount !== value.reportedPathCount)
  )
    return null;
  const observation =
    value.providerExecutionObservation === null
      ? null
      : inspectProviderExecutionObservation(value.providerExecutionObservation);
  if (value.providerExecutionObservation !== null && !observation) return null;
  return Object.freeze({
    captureStatus:
      value.captureStatus as CandidateValidationFailureDiagnostic["captureStatus"],
    pathsMatch: value.pathsMatch as boolean | null,
    candidatePathCount: value.candidatePathCount as number | null,
    reportedPathCount: value.reportedPathCount as number | null,
    providerExecutionObservation: observation,
  });
}

/** 回復開始の診断専用段階。実行許可・清掃判定には使用しない。 */
export const RECOVERY_START_FAILURE_STAGES = Object.freeze([
  "plan_validation",
  "operation_context",
  "provider_home",
  "home_lock",
  "operation_binding",
  "state_conflict",
  "operation_start_save",
  "settlement_binding",
  "host_submission",
  "home_lock_release",
  "unknown",
] as const);

/** 開始Ownerから受動診断へ渡す固定段階と、取得済みの場合だけの元参照。 */
export type RecoveryStartFailureDiagnostic = Readonly<{
  stage: (typeof RECOVERY_START_FAILURE_STAGES)[number];
  recoveryId: string | null;
}>;

/** 診断の未知値・余分な内容を拒否し、Authorityを伴わない値へ閉じる。 */
export function inspectRecoveryStartFailureDiagnostic(
  raw: unknown,
): RecoveryStartFailureDiagnostic | null {
  const value = snapshotPlainRecord(raw, new Set(["stage", "recoveryId"]));
  if (
    !value ||
    !RECOVERY_START_FAILURE_STAGES.includes(
      value.stage as RecoveryStartFailureDiagnostic["stage"],
    ) ||
    (value.recoveryId !== null && !parseDockerTaskRecoveryId(value.recoveryId))
  )
    return null;
  return Object.freeze({
    stage: value.stage as RecoveryStartFailureDiagnostic["stage"],
    recoveryId: value.recoveryId as string | null,
  });
}

const BLOCKED_START_KEYS = Object.freeze([
  "cleanupConfirmed",
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "normalizedResult",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);

const STARTED_KEYS = Object.freeze([
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "normalizedResult",
  "normalizedResultReportedAfterCleanupOnly",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);

const COMPLETION_KEYS = Object.freeze([
  "cancellationRequested",
  "cleanupConfirmed",
  "containersAbsent",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "mountLeaseReleased",
  "networksAbsent",
  "normalizedResult",
  "operationId",
  "processTreeTerminationConfirmed",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryCompleted",
  "recoveryFinalizationCapability",
  "recoveryId",
  "resultBytes",
  "resultSha256",
  "selectionRecordId",
  "status",
  "subscriptionAuthConfirmed",
  "untrustedProviderTextReported",
]);

/**
 * own Data Valueを決定する。
 *
 * @responsibility own Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns unknownを返す。
 * @precondition 「value: unknown、key: string」がownDataValueの入力契約を満たす。
 * @postcondition ownDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataValueは共有非同期状態を持たない同期処理である。
 */
export function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Plain 記録が完全一致するか判定する。
 *
 * @responsibility Plain 記録の比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedKeys: readonly string[]
 * @returns exactPlainRecordの計算結果を返す。
 * @precondition 「value: unknown、expectedKeys: readonly string[]」がexactPlainRecordの入力契約を満たす。
 * @postcondition exactPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure exactPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security exactPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactPlainRecordは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecord(value: unknown, expectedKeys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  )
    return null;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== "string") ||
      (keys as string[]).sort().join("\0") !==
        [...expectedKeys].sort().join("\0")
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries: [string, unknown][] = [];
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      )
        return null;
      entries.push([key, descriptor.value]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } catch {
    return null;
  }
}

/**
 * Producer-owned exact projection for the controller's synchronous result.
 *
 * @responsibility Docker Process Controller Start 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown」がprojectDockerProcessControllerStartResultの入力契約を満たす。
 * @postcondition projectDockerProcessControllerStartResultの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerProcessControllerStartResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerProcessControllerStartResultは独自の失敗分岐を所有しない。
 * @invariant projectDockerProcessControllerStartResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectDockerProcessControllerStartResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency projectDockerProcessControllerStartResultは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function projectDockerProcessControllerStartResult(
  value: unknown,
  handedOffRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const blockedRecord = exactPlainRecord(value, BLOCKED_START_KEYS);
  if (blockedRecord && ownDataValue(blockedRecord, "status") === "blocked") {
    const record = blockedRecord;
    const rawRecoveryId = ownDataValue(record, "recoveryId");
    const recoveryId =
      rawRecoveryId === null
        ? null
        : publicVerifiedDockerRecoveryId(rawRecoveryId);
    const cleanupConfirmed = ownDataValue(record, "cleanupConfirmed");
    const manualRecoveryRequired = ownDataValue(
      record,
      "manualRecoveryRequired",
    );
    return record &&
      typeof ownDataValue(record, "reason") === "string" &&
      ownDataValue(record, "controlCapability") === null &&
      ownDataValue(record, "completion") === null &&
      ownDataValue(record, "operationId") === null &&
      typeof cleanupConfirmed === "boolean" &&
      typeof manualRecoveryRequired === "boolean" &&
      (cleanupConfirmed === true || manualRecoveryRequired === true) &&
      (recoveryId === null || manualRecoveryRequired === true) &&
      ownDataValue(record, "dockerEffectStarted") === false &&
      ownDataValue(record, "providerRequestStarted") === false &&
      ownDataValue(record, "normalizedResult") === null &&
      ownDataValue(record, "rawOutputReported") === false &&
      ownDataValue(record, "untrustedProviderTextReported") === false &&
      ownDataValue(record, "credentialAbsenceVerified") === false &&
      ownDataValue(record, "hostPathReported") === false &&
      ownDataValue(record, "proxyCredentialReported") === false &&
      recoveryId === rawRecoveryId
      ? Object.freeze({ ...record, recoveryId })
      : null;
  }
  const record = exactPlainRecord(value, STARTED_KEYS);
  const status = ownDataValue(record, "status");
  const recoveryId = publicVerifiedDockerRecoveryId(
    ownDataValue(record, "recoveryId"),
  );
  return record &&
    status === "started" &&
    typeof ownDataValue(record, "reason") === "string" &&
    typeof ownDataValue(record, "operationId") === "string" &&
    (expectedOperationId === undefined ||
      ownDataValue(record, "operationId") === expectedOperationId) &&
    ownDataValue(record, "controlCapability") !== null &&
    typeof ownDataValue(record, "controlCapability") === "object" &&
    ownDataValue(record, "completion") instanceof Promise &&
    ownDataValue(record, "dockerEffectStarted") === true &&
    ownDataValue(record, "providerRequestStarted") === false &&
    ownDataValue(record, "normalizedResult") === null &&
    ownDataValue(record, "normalizedResultReportedAfterCleanupOnly") === true &&
    ownDataValue(record, "rawOutputReported") === false &&
    ownDataValue(record, "untrustedProviderTextReported") === false &&
    ownDataValue(record, "credentialAbsenceVerified") === false &&
    ownDataValue(record, "hostPathReported") === false &&
    ownDataValue(record, "proxyCredentialReported") === false &&
    recoveryId !== null &&
    recoveryId === handedOffRecoveryId
    ? Object.freeze({ ...record, recoveryId })
    : null;
}

/**
 * Producer-owned exact projection for the controller's asynchronous result.
 *
 * @responsibility Docker Process Controller Completion 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown」がprojectDockerProcessControllerCompletionResultの入力契約を満たす。
 * @postcondition projectDockerProcessControllerCompletionResultの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerProcessControllerCompletionResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerProcessControllerCompletionResultは独自の失敗分岐を所有しない。
 * @invariant projectDockerProcessControllerCompletionResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectDockerProcessControllerCompletionResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDockerProcessControllerCompletionResultは共有非同期状態を持たない同期処理である。
 */
export function projectDockerProcessControllerCompletionResult(
  value: unknown,
  expectedRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const record = exactPlainRecord(value, COMPLETION_KEYS);
  if (!record) return null;
  const status = ownDataValue(record, "status");
  const cleanupConfirmed = ownDataValue(record, "cleanupConfirmed");
  const manualRecoveryRequired = ownDataValue(record, "manualRecoveryRequired");
  const rawRecoveryId = ownDataValue(record, "recoveryId");
  const recoveryId =
    rawRecoveryId === null
      ? null
      : publicVerifiedDockerRecoveryId(rawRecoveryId);
  const expected = publicVerifiedDockerRecoveryId(expectedRecoveryId);
  const processTreeTerminated = ownDataValue(
    record,
    "processTreeTerminationConfirmed",
  );
  const containersAbsent = ownDataValue(record, "containersAbsent");
  const networksAbsent = ownDataValue(record, "networksAbsent");
  const mountLeaseReleased = ownDataValue(record, "mountLeaseReleased");
  const recoveryCompleted = ownDataValue(record, "recoveryCompleted");
  const isCleanupFromResources =
    processTreeTerminated === true &&
    containersAbsent === true &&
    networksAbsent === true &&
    mountLeaseReleased === true &&
    recoveryCompleted === true;
  const providerRequestStarted = ownDataValue(record, "providerRequestStarted");
  const cancellationRequested = ownDataValue(record, "cancellationRequested");
  const normalizedResult = ownDataValue(record, "normalizedResult");
  const resultSha256 = ownDataValue(record, "resultSha256");
  const resultBytes = ownDataValue(record, "resultBytes");
  const subscriptionAuthConfirmed = ownDataValue(
    record,
    "subscriptionAuthConfirmed",
  );
  const recoveryFinalizationCapability = ownDataValue(
    record,
    "recoveryFinalizationCapability",
  );
  const reason = ownDataValue(record, "reason");
  if (
    (status !== "completed" &&
      status !== "blocked" &&
      status !== "cancelled") ||
    typeof reason !== "string" ||
    typeof cleanupConfirmed !== "boolean" ||
    typeof manualRecoveryRequired !== "boolean" ||
    typeof ownDataValue(record, "operationId") !== "string" ||
    (expectedOperationId !== undefined &&
      ownDataValue(record, "operationId") !== expectedOperationId) ||
    typeof ownDataValue(record, "selectionRecordId") !== "string" ||
    ownDataValue(record, "dockerEffectStarted") !== true ||
    typeof providerRequestStarted !== "boolean" ||
    typeof cancellationRequested !== "boolean" ||
    typeof processTreeTerminated !== "boolean" ||
    typeof containersAbsent !== "boolean" ||
    typeof networksAbsent !== "boolean" ||
    typeof mountLeaseReleased !== "boolean" ||
    typeof recoveryCompleted !== "boolean" ||
    cleanupConfirmed !== isCleanupFromResources ||
    !Number.isSafeInteger(resultBytes) ||
    (resultBytes as number) < 0 ||
    (resultSha256 !== null &&
      (typeof resultSha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(resultSha256))) ||
    (recoveryFinalizationCapability !== null &&
      typeof recoveryFinalizationCapability !== "object") ||
    typeof subscriptionAuthConfirmed !== "boolean" ||
    ownDataValue(record, "rawOutputReported") !== false ||
    ownDataValue(record, "untrustedProviderTextReported") !== false ||
    ownDataValue(record, "credentialAbsenceVerified") !== false ||
    ownDataValue(record, "hostPathReported") !== false ||
    ownDataValue(record, "proxyCredentialReported") !== false ||
    !expected ||
    (cleanupConfirmed === true
      ? recoveryId !== null || manualRecoveryRequired !== false
      : recoveryId !== expected ||
        manualRecoveryRequired !== true ||
        status !== "blocked" ||
        reason !== "docker_process_controller_cleanup_unconfirmed" ||
        normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0 ||
        recoveryFinalizationCapability !== null) ||
    (cleanupConfirmed === true &&
      (recoveryFinalizationCapability === null ||
        typeof recoveryFinalizationCapability !== "object")) ||
    (status === "completed"
      ? reason !== "provider_operation_completed" ||
        providerRequestStarted !== true ||
        cancellationRequested !== false ||
        subscriptionAuthConfirmed !== true ||
        normalizedResult === null ||
        typeof normalizedResult !== "object" ||
        typeof resultSha256 !== "string" ||
        resultBytes === 0
      : normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0) ||
    (status === "cancelled" &&
      (reason !== "provider_operation_cancelled" ||
        cancellationRequested !== true)) ||
    (status === "blocked" &&
      cleanupConfirmed === true &&
      !blockedCompletionReasons.has(reason))
  )
    return null;
  return Object.freeze({ ...record, recoveryId });
}

/**
 * Coordinator Task Terminal Lifecycle 状態を分類する。
 *
 * @responsibility Coordinator Task Terminal Lifecycle 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input result: TaskCompletionRecord
 * @returns RuntimeLifecycleStateを返す。
 * @precondition 「result: TaskCompletionRecord」がclassifyCoordinatorTaskTerminalLifecycleStateの入力契約を満たす。
 * @postcondition classifyCoordinatorTaskTerminalLifecycleStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCoordinatorTaskTerminalLifecycleStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCoordinatorTaskTerminalLifecycleStateは独自の失敗分岐を所有しない。
 * @invariant classifyCoordinatorTaskTerminalLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCoordinatorTaskTerminalLifecycleStateはProcess内の同一Subsystemで完結する。
 * @security classifyCoordinatorTaskTerminalLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCoordinatorTaskTerminalLifecycleStateは共有非同期状態を持たない同期処理である。
 */
export function classifyCoordinatorTaskTerminalLifecycleState(
  result: TaskCompletionRecord,
): RuntimeLifecycleState {
  const exactRecoveryAvailable =
    result.hostRecoveryId !== null ||
    result.dockerRecoveryIds.length > 0 ||
    result.candidateRecoveryId !== null ||
    result.candidateStoreRecoveryId !== null;
  if (
    result.manualRecoveryRequired === true ||
    result.cleanupConfirmed !== true ||
    exactRecoveryAvailable
  )
    return exactRecoveryAvailable
      ? ("STATE-RECOVERY-REQUIRED" as const)
      : ("STATE-OPERATOR-TRANSFER-REQUIRED" as const);
  if (result.processRestartRequired === true)
    return "STATE-PROCESS-RESTART-REQUIRED" as const;
  if (result.status === "completed") return "STATE-RESULT-PUBLISHED" as const;
  return "STATE-BLOCKED-CLEAN" as const;
}

/**
 * Testable projection used only after the outer development cleanup settles.
 *
 * @responsibility Development Task 結果 After Outer 清掃の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input taskResult: Readonly<Record<string, unknown>>、cleanupConfirmed: boolean
 * @returns projectDevelopmentTaskResultAfterOuterCleanupの計算結果を返す。
 * @precondition 「taskResult: Readonly<Record<string, unknown>>、cleanupConfirmed: boolean」がprojectDevelopmentTaskResultAfterOuterCleanupの入力契約を満たす。
 * @postcondition projectDevelopmentTaskResultAfterOuterCleanupの責務を完了した結果だけを返す。
 * @effect N/A: projectDevelopmentTaskResultAfterOuterCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectDevelopmentTaskResultAfterOuterCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectDevelopmentTaskResultAfterOuterCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDevelopmentTaskResultAfterOuterCleanupはProcess内の同一Subsystemで完結する。
 * @security projectDevelopmentTaskResultAfterOuterCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDevelopmentTaskResultAfterOuterCleanupは共有非同期状態を持たない同期処理である。
 */
export function projectDevelopmentTaskResultAfterOuterCleanup(
  taskResult: Readonly<Record<string, unknown>>,
  cleanupConfirmed: boolean,
) {
  if (cleanupConfirmed) return taskResult;
  const snapshot: Record<string, unknown> = Object.create(null);
  const descriptors = Object.getOwnPropertyDescriptors(taskResult);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string")
      throw new Error("development_task_result_projection_invalid");
    if (key === "providerTurnObservations") continue;
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      throw new Error("development_task_result_projection_invalid");
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

const blockedCompletionReasons = new Set<string>(
  dockerProcessControllerPublicCompletionReasons,
);

/**
 * Docker Process Controllerが公開できる完了理由を表す。
 *
 * @responsibility 清掃後に上位へ公開できる固定理由の型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定Registry要素だけからなる文字列unionである。
 * @invariant Provider生出力や未登録理由を含まない。
 * @boundary Docker Process Controller結果から上位Coordinator結果への投影境界。
 * @security 固定語彙だけを許可し、秘密値や自由文を搬送しない。
 * @compatibility 利用側は公開Registryに含まれる理由だけへ依存する。
 */
export type DockerProcessControllerPublicCompletionReason =
  (typeof dockerProcessControllerPublicCompletionReasons)[number];

const recoveryObservationKeys = new Set([
  "status",
  "reason",
  "manualRecoveryRequired",
  "dockerRecoveryId",
  "dockerRecoveryIds",
  "activeStableLogicalHomeBindingHashes",
] as const);

/**
 * 現在状態の入場観測だけをTaskの固定判定へ変換する。
 * @responsibility 可否と排他解放の相関を確認し、旧在庫形式を受理しない。
 * @trace ARCH-000008
 * @input rawObservation: 現在入場Inspectorの結果。
 * @returns completedまたは非秘密の固定blocked理由。
 * @precondition 入場投影は後続beginの衝突判定を省略しない。
 * @postcondition availableでも解放未確認なら拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure Proxy・Accessor・未知key・不正相関は拒否する。
 * @invariant 内部ID・任意理由・旧在庫を公開へ搬送しない。
 * @boundary 現在入場DTOとTaskの失敗診断。
 * @security 固定理由以外を結果へ含めない。
 * @concurrency N/A: 同期の値変換だけ。
 */
export function projectCurrentDockerAdmission(rawObservation: unknown) {
  const value = snapshotPlainRecord(
    rawObservation,
    new Set(["status", "reason", "lockReleased"]),
  );
  if (
    value?.status === "available" &&
    value.reason === "coordinator_current_admission_available" &&
    value.lockReleased === true
  )
    return Object.freeze({ status: "completed" as const });
  return Object.freeze({
    status: "blocked" as const,
    reason:
      value?.status === "blocked" &&
      value.reason === "coordinator_current_admission_unconfirmed" &&
      value.lockReleased === false
        ? "docker_process_controller_recovery_observation_unknown"
        : "docker_process_controller_recovery_unavailable",
  });
}

const recoveryStartReasonClass = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_cleanup_tombstone_conflict",
    "docker_process_controller_recovery_conflict",
  ],
  ...(
    [
      "docker_task_runtime_state_pending_incomplete",
      "docker_task_runtime_state_orphan_commit",
      "docker_task_runtime_state_orphan_pointer",
      "docker_task_runtime_state_orphan_temporary",
      "docker_task_recovery_orphan_commit",
      "docker_task_recovery_orphan_temporary",
      "docker_task_recovery_duplicate_base",
      "docker_task_recovery_duplicate_base_commit",
      "docker_task_recovery_base_commit_missing",
    ] as const
  ).map(
    (reason) =>
      [reason, "docker_process_controller_recovery_partial_state"] as const,
  ),
  ...(
    [
      "docker_task_runtime_state_binding_changed",
      "docker_task_runtime_state_user_binding_changed",
      "docker_task_runtime_state_root_replaced",
      "docker_task_runtime_state_entry_replaced",
      "docker_task_runtime_state_cleanup_replaced",
      "docker_task_recovery_active_run_mismatch",
      "docker_task_recovery_base_commit_mismatch",
      "docker_task_recovery_base_mismatch",
      "docker_task_recovery_host_binding_changed",
      "docker_task_recovery_host_mismatch",
      "docker_task_recovery_pointer_mismatch",
    ] as const
  ).map(
    (reason) =>
      [reason, "docker_process_controller_recovery_identity_mismatch"] as const,
  ),
  ...(
    [
      "docker_task_host_operation_generation_active_or_unknown",
      "docker_task_process_generation_active_or_unknown",
      "docker_task_recovery_home_generation_active_or_unknown",
      "docker_task_recovery_home_lock_release_unconfirmed",
      "docker_task_recovery_host_lock_release_unconfirmed",
      "docker_task_runtime_state_generation_active_or_unknown",
      "docker_task_runtime_state_lock_release_unconfirmed",
      "docker_task_runtime_state_audit_failed",
      "docker_task_recovery_record_observation_unknown",
      "docker_task_runtime_state_unavailable",
      "docker_task_recovery_begin_failed_closed",
      "docker_task_recovery_failed_closed",
    ] as const
  ).map(
    (reason) =>
      [
        reason,
        "docker_process_controller_recovery_observation_unknown",
      ] as const,
  ),
]);

const INVENTORY_REASONS = new Set([
  "docker_task_recovery_inventory_available",
  "docker_task_multiple_recovery_inventory_available",
]);

const BLOCKED_REASONS_WITH_INVENTORY = new Set([
  "docker_task_recovery_home_lock_release_unconfirmed",
  "docker_task_recovery_host_lock_release_unconfirmed",
  "docker_task_runtime_state_lock_release_unconfirmed",
]);

/**
 * public Docker 回復 Start Reasonを決定する。
 *
 * @responsibility public Docker 回復 Start Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: unknown
 * @returns publicDockerRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がpublicDockerRecoveryStartReasonの入力契約を満たす。
 * @postcondition publicDockerRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: publicDockerRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: publicDockerRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant publicDockerRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: publicDockerRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security publicDockerRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publicDockerRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
export function publicDockerRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = recoveryStartReasonClass.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

/**
 * public Verified Docker 回復 Idを決定する。
 *
 * @responsibility public Verified Docker 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns publicVerifiedDockerRecoveryIdの計算結果を返す。
 * @precondition 「value: unknown」がpublicVerifiedDockerRecoveryIdの入力契約を満たす。
 * @postcondition publicVerifiedDockerRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: publicVerifiedDockerRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: publicVerifiedDockerRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant publicVerifiedDockerRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: publicVerifiedDockerRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security publicVerifiedDockerRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publicVerifiedDockerRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function publicVerifiedDockerRecoveryId(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}

/**
 * Docker 回復 Admissionを公開結果へ投影する。
 *
 * @responsibility Docker 回復 Admissionの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input rawObservation: unknown
 * @returns projectDockerRecoveryAdmissionの計算結果を返す。
 * @precondition 「rawObservation: unknown」がprojectDockerRecoveryAdmissionの入力契約を満たす。
 * @postcondition projectDockerRecoveryAdmissionの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerRecoveryAdmissionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerRecoveryAdmissionは独自の失敗分岐を所有しない。
 * @invariant projectDockerRecoveryAdmissionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDockerRecoveryAdmissionはProcess内の同一Subsystemで完結する。
 * @security projectDockerRecoveryAdmissionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDockerRecoveryAdmissionは共有非同期状態を持たない同期処理である。
 */
export function projectDockerRecoveryAdmission(rawObservation: unknown) {
  const observation = snapshotPlainRecord(
    rawObservation,
    recoveryObservationKeys,
  );
  if (!observation)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const idsSnapshot = snapshotPlainArray(observation.dockerRecoveryIds, 256);
  const parsedIds =
    idsSnapshot.status === "ok"
      ? idsSnapshot.value.map(parseDockerTaskRecoveryId)
      : [];
  const ids =
    idsSnapshot.status === "ok" && parsedIds.every((value) => value !== null)
      ? parsedIds.map((value) => value?.token as string)
      : null;
  const singleId =
    observation.dockerRecoveryId === null ||
    publicVerifiedDockerRecoveryId(observation.dockerRecoveryId) !== null
      ? publicVerifiedDockerRecoveryId(observation.dockerRecoveryId)
      : undefined;
  const hashes = snapshotPlainArray(
    observation.activeStableLogicalHomeBindingHashes,
    256,
  );
  const hashValues =
    hashes.status === "ok" && hashes.value.every(isSha256Hex)
      ? (hashes.value as readonly string[])
      : null;
  const isIdsUnique = ids !== null && new Set(ids).size === ids.length;
  const isHashesUnique =
    hashValues !== null && new Set(hashValues).size === hashValues.length;
  const stableHashes = new Set(
    parsedIds.flatMap((value) =>
      value ? [value.stableLogicalHomeBindingHash] : [],
    ),
  );
  const isShapeValid =
    ids !== null &&
    hashValues !== null &&
    isIdsUnique &&
    isHashesUnique &&
    hashValues.every((value) => stableHashes.has(value)) &&
    (observation.status === "completed" || observation.status === "blocked") &&
    typeof observation.reason === "string" &&
    typeof observation.manualRecoveryRequired === "boolean" &&
    singleId !== undefined &&
    (ids.length === 1 ? singleId === ids[0] : singleId === null);
  if (!isShapeValid)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const isClean =
    observation.status === "completed" &&
    observation.reason === "docker_task_runtime_state_clean" &&
    observation.manualRecoveryRequired === false &&
    singleId === null &&
    ids.length === 0 &&
    hashValues.length === 0;
  if (isClean)
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const inventoryReason =
    ids.length === 1
      ? "docker_task_recovery_inventory_available"
      : "docker_task_multiple_recovery_inventory_available";
  const isBlockedShape =
    observation.status === "blocked" &&
    observation.manualRecoveryRequired === true &&
    recoveryStartReasonClass.has(observation.reason) &&
    (ids.length === 0
      ? !INVENTORY_REASONS.has(observation.reason)
      : BLOCKED_REASONS_WITH_INVENTORY.has(observation.reason));
  const isInventoryShape =
    observation.status === "completed" &&
    observation.manualRecoveryRequired === true &&
    ids.length > 0 &&
    observation.reason === inventoryReason;
  if (!isBlockedShape && !isInventoryShape)
    return Object.freeze({
      status: "blocked" as const,
      reason: publicDockerRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  return Object.freeze({
    status: "blocked" as const,
    reason: publicDockerRecoveryStartReason(observation.reason),
    manualRecoveryRequired: true,
    dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
    dockerRecoveryIds: Object.freeze(ids),
  });
}

/**
 * 回復投影のHash候補が小文字64桁であるか確認する。
 * @responsibility 投影値の文法だけを確認し、回復資格を発行しない。
 * @trace ARCH-000008
 * @input value: 未信頼の投影候補。
 * @returns 小文字64桁hexだけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態と外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 同一回復投影の値検査だけ。
 * @security 文法一致を実資源の存在・回復資格へ昇格しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export const COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS = Object.freeze({
  prepareFailed: "coordinator_task_provider_prepare_failed",
  modelSelectionInvalid: "coordinator_task_provider_model_selection_invalid",
  mountAuthorizationInvalid:
    "coordinator_task_provider_mount_authorization_invalid",
  taskPacketInvalid: "coordinator_task_provider_task_packet_invalid",
  planInvalid: "coordinator_task_provider_plan_invalid",
  authorityInvalid: "coordinator_task_provider_authority_invalid",
  recoveryCorrelationInvalid:
    "coordinator_task_provider_recovery_correlation_invalid",
} as const);

export const coordinatorTaskPublicReasons = Object.freeze([
  "coordinator_task_workspace_review_completed",
  "coordinator_task_workspace_borrowing_unavailable",
  "coordinator_task_workspace_unexpected_changes",
  ...Object.values(COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS),
  ...dockerProcessControllerPublicCompletionReasons,
  "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
  "coordinator_task_cancellation_protocol_failed_cleanup_unknown",
  "coordinator_task_cancellation_receipt_invalid",
  "coordinator_task_cancelled_after_provider_cleanup",
  "coordinator_task_cancelled_before_candidate_capture",
  "coordinator_task_cancelled_before_independent_review",
  "coordinator_task_cancelled_before_stage_start",
  "coordinator_task_cancelled_during_external_send_authorization",
  "coordinator_task_cancelled_during_operation_creation",
  "coordinator_task_candidate_approved",
  "coordinator_task_candidate_persistence_failed",
  "coordinator_task_candidate_persistence_not_authorized",
  "coordinator_task_candidate_publish_unconfirmed",
  "coordinator_task_candidate_recognized_secret_rejected",
  "coordinator_task_candidate_revision_invalid",
  "coordinator_task_candidate_store_unavailable",
  "coordinator_task_candidate_verification_failed",
  "coordinator_task_control_invalid",
  "coordinator_task_completed",
  "coordinator_task_development_invocation_not_authorized",
  "coordinator_task_development_invocation_settlement_invalid",
  "coordinator_task_development_permission_expired",
  "coordinator_task_development_permission_required",
  "coordinator_task_docker_finalization_capability_missing",
  "coordinator_task_docker_recovery_finalization_unconfirmed",
  "coordinator_task_docker_recovery_handoff_state_invalid",
  "coordinator_task_docker_recovery_projection_invalid",
  "coordinator_task_execution_slate_unavailable",
  "coordinator_task_external_send_authorization_mode_invalid",
  "coordinator_task_external_send_confirmation_cancelled",
  "coordinator_task_external_send_confirmation_declined_invalid",
  "coordinator_task_external_send_confirmation_reader_failed",
  "coordinator_task_external_send_confirmation_timeout",
  "coordinator_task_external_send_confirmation_unavailable",
  "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_and_operation_recovery_required",
  "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required",
  "coordinator_task_external_send_not_authorized",
  "coordinator_task_external_send_notice_unavailable",
  "coordinator_task_external_send_policy_unresolved",
  "coordinator_task_network_policy_changed",
  "coordinator_task_failed_closed",
  "coordinator_task_final_projection_failed_closed",
  "coordinator_task_git_object_format_unsupported",
  "coordinator_task_host_cleanup_intent_unconfirmed",
  "coordinator_task_host_cleanup_receipt_unconfirmed",
  "coordinator_task_host_generation_lock_activation_failed",
  "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required",
  "coordinator_task_host_generation_lock_not_ready",
  "coordinator_task_host_generation_lock_not_ready_cleanup_confirmed",
  "coordinator_task_host_generation_lock_protocol_failed_cleanup_confirmed",
  "coordinator_task_host_generation_lock_start_failed_cleanup_confirmed",
  "coordinator_task_host_generation_lock_unavailable",
  "coordinator_task_host_generation_lost_cleanup_confirmed",
  "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
  "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
  "coordinator_task_independent_review_not_approved",
  "coordinator_task_internal_outcome_invalid",
  "coordinator_task_mount_grant_consume_failed",
  "coordinator_task_mount_grant_issue_failed",
  "coordinator_task_operation_cleanup_outcome_invalid",
  "coordinator_task_operation_cleanup_unconfirmed",
  "coordinator_task_operation_creation_failed",
  "coordinator_task_operation_initialization_cleanup_unknown_process_restart_required",
  "coordinator_task_operation_initialization_failed_cleanup_confirmed",
  "coordinator_task_packet_issue_failed",
  "coordinator_task_process_completion_contract_invalid",
  "coordinator_task_process_completion_unconfirmed",
  "coordinator_task_process_restart_required",
  "coordinator_task_process_start_contract_invalid",
  "coordinator_task_process_start_failed",
  "coordinator_task_provider_failed",
  "coordinator_task_provider_home_observation_failed",
  "coordinator_task_provider_home_reobservation_failed",
  "coordinator_task_provider_selection_refresh_failed",
  "coordinator_task_provider_selection_refresh_mismatch",
  "coordinator_task_provider_selection_refresh_revoke_failed",
  "coordinator_task_read_projection_recognized_secret_rejected",
  "coordinator_task_recovery_correlation_invalid",
  "coordinator_task_remediated_candidate_invalid",
  "coordinator_task_remediation_recognized_secret_rejected",
  "coordinator_task_repository_binding_failed",
  "coordinator_task_repository_preflight_failed",
  "coordinator_task_request_invalid",
  "coordinator_task_result_observation_invalid",
  "coordinator_task_review_remediation_invalid",
  "coordinator_task_reviewer_read_projection_failed",
  "coordinator_task_runtime_cleanup_in_progress",
  "coordinator_task_scope_recognized_secret_rejected",
  "coordinator_task_selection_failed",
  "coordinator_task_selection_notice_unavailable",
  "coordinator_task_selection_slate_mismatch",
  "coordinator_task_stage_failed_closed",
  "coordinator_task_started",
  "coordinator_task_workload_split_required",
  "coordinator_task_workspace_materialization_failed",
  "docker_process_controller_recovery_conflict",
  "docker_process_controller_recovery_identity_mismatch",
  "docker_process_controller_recovery_observation_unknown",
  "docker_process_controller_recovery_unavailable",
  "provider_cancellation_grace_exceeded",
  "provider_cancellation_requested",
  "provider_operation_cancelled",
] as const);

/**
 * Coordinator Taskが公開できる理由を表す。
 *
 * @responsibility Task結果へ公開できる固定理由の型境界を所有する。
 * @trace ARCH-000004
 * @shape 固定Registry要素だけからなる文字列unionである。
 * @invariant 内部理由、自由文およびProvider生出力を含まない。
 * @boundary 下位Runtime結果からCoordinator Task公開結果への投影境界。
 * @security exactな固定値だけを許可する。
 * @compatibility 利用側は公開Registryに含まれる理由だけへ依存する。
 */
export type CoordinatorTaskPublicReason =
  (typeof coordinatorTaskPublicReasons)[number];

const coordinatorTaskPublicReasonSet = new Set<string>(
  coordinatorTaskPublicReasons,
);

/**
 * 未信頼の下位理由をCoordinator Taskの固定公開理由へ閉じる。
 *
 * @responsibility 公開可能なexact reasonと未知値の代替理由を分離する。
 * @trace ARCH-000004
 * @input value: 未信頼の下位理由、fallback: 呼出し境界が所有する固定代替理由。
 * @returns 登録済み理由または指定された固定代替理由。
 * @precondition fallbackがCoordinatorTaskPublicReasonである。
 * @postcondition 戻り値は常にCoordinator Task公開Registryの要素である。
 * @effect N/A: 入力と不変Registryだけを読み取る。
 * @failure 未知値は例外にせずfallbackへ閉じる。
 * @invariant 自由文、prefix一致だけの値およびProvider生出力を公開しない。
 * @boundary 下位Runtime結果からCoordinator Task公開結果への投影境界。
 * @security exact Registry一致だけを許可する。
 * @concurrency N/A: 不変集合を同期的に参照する。
 */
export function projectCoordinatorTaskPublicReason(
  value: unknown,
  fallback: CoordinatorTaskPublicReason,
): CoordinatorTaskPublicReason {
  return typeof value === "string" && coordinatorTaskPublicReasonSet.has(value)
    ? (value as CoordinatorTaskPublicReason)
    : fallback;
}

export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT =
  "crdd-coordinator/provider-task-structured-result";

export const PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION = 20;

const MAXIMUM_RAW_BYTES = 65_536;

const MAXIMUM_SUMMARY_BYTES = 8_192;

const MAXIMUM_PATHS = 1_000;

const MAXIMUM_FINDINGS = 64;

const MAXIMUM_FINDING_MESSAGE_BYTES = 4_096;

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

const FINDING_CATEGORIES = new Set([
  "acceptance_criterion_not_met",
  "implementation_defect",
  "verification_defect",
  "security_or_authority_defect",
]);

const remediationRecords = new WeakMap<
  object,
  readonly Readonly<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    path: string;
    category:
      | "acceptance_criterion_not_met"
      | "implementation_defect"
      | "verification_defect"
      | "security_or_authority_defect";
    criterionNumber: number;
    message: string;
    messageSha256: string;
  }>[]
>();

/**
 * 記録かを判定する。
 *
 * @responsibility 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security isRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: Record<string, unknown>、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => actualKeys.includes(key))
  );
}

/**
 * Stringが有効か判定する。
 *
 * @responsibility Stringの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown、maximumBytes: number
 * @returns validStringの計算結果を返す。
 * @precondition 「value: unknown、maximumBytes: number」がvalidStringの入力契約を満たす。
 * @postcondition validStringの責務を完了した結果だけを返す。
 * @effect N/A: validStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validStringは独自の失敗分岐を所有しない。
 * @invariant validStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validStringはProcess内の同一Subsystemで完結する。
 * @security validStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validStringは共有非同期状態を持たない同期処理である。
 */
function validString(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}

/**
 * Pathが有効か判定する。
 *
 * @responsibility Pathの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns validPathの計算結果を返す。
 * @precondition 「value: unknown」がvalidPathの入力契約を満たす。
 * @postcondition validPathの責務を完了した結果だけを返す。
 * @effect N/A: validPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validPathは独自の失敗分岐を所有しない。
 * @invariant validPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPathはProcess内の同一Subsystemで完結する。
 * @security validPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validPathは共有非同期状態を持たない同期処理である。
 */
function validPath(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1_024 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every(
        (segment) => segment.length > 0 && segment !== "." && segment !== "..",
      )
  );
}

/**
 * provider-task-structured-resultで使用する結果 Mismatch Reasonの値契約を定義する。
 *
 * @responsibility 結果 Mismatch ReasonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ResultMismatchReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ResultMismatchReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: ResultMismatchReasonの宣言は外部境界を開かない。
 * @security ResultMismatchReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ResultMismatchReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ResultMismatchReason =
  | "provider_task_result_input_invalid"
  | "provider_task_result_json_invalid"
  | "provider_task_result_envelope_status_invalid"
  | "provider_task_result_turn_count_invalid"
  | "provider_task_result_cost_metadata_invalid"
  | "provider_task_reviewer_result_transport_invalid"
  | "provider_turn_limit_exceeded"
  | "provider_task_result_turn_limit_mismatch"
  | "provider_structured_output_retry_exhausted"
  | "provider_task_executor_shape_invalid"
  | "provider_task_reviewer_shape_invalid"
  | "provider_task_reviewer_keys_invalid"
  | "provider_task_reviewer_decision_invalid"
  | "provider_task_reviewer_summary_invalid"
  | "provider_task_reviewer_findings_invalid"
  | "provider_task_reviewer_finding_invalid"
  | "provider_task_reviewer_decision_inconsistent";

/**
 * rejectedを決定する。
 *
 * @responsibility rejectedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input reason: ResultMismatchReason
 * @returns rejectedの計算結果を返す。
 * @precondition 「reason: ResultMismatchReason」がrejectedの入力契約を満たす。
 * @postcondition rejectedの責務を完了した結果だけを返す。
 * @effect N/A: rejectedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedは独自の失敗分岐を所有しない。
 * @invariant rejectedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: rejectedはProcess内の同一Subsystemで完結する。
 * @security rejectedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedは共有非同期状態を持たない同期処理である。
 */
function rejected(reason: ResultMismatchReason) {
  return Object.freeze({ normalizedResult: null, reason });
}

/**
 * executor 結果を決定する。
 *
 * @responsibility executor 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>
 * @returns executorResultの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がexecutorResultの入力契約を満たす。
 * @postcondition executorResultの責務を完了した結果だけを返す。
 * @effect N/A: executorResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executorResultは独自の失敗分岐を所有しない。
 * @invariant executorResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executorResultはProcess内の同一Subsystemで完結する。
 * @security executorResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: executorResultは共有非同期状態を持たない同期処理である。
 */
function executorResult(value: Record<string, unknown>) {
  if (
    !exactKeys(value, ["status", "summary", "changedPaths", "verification"]) ||
    value.status !== "completed" ||
    !validString(value.summary, MAXIMUM_SUMMARY_BYTES) ||
    !Array.isArray(value.changedPaths) ||
    value.changedPaths.length > MAXIMUM_PATHS ||
    !value.changedPaths.every(validPath) ||
    new Set(value.changedPaths.map((item) => item.toUpperCase())).size !==
      value.changedPaths.length ||
    !Array.isArray(value.verification) ||
    value.verification.length > 32 ||
    !value.verification.every((item) => validString(item, 1_024))
  ) {
    return rejected("provider_task_executor_shape_invalid");
  }
  return Object.freeze({
    normalizedResult: Object.freeze({
      status: "completed" as const,
      changedPaths: Object.freeze([...(value.changedPaths as string[])]),
      verificationCount: value.verification.length,
    }),
    reason: null,
  });
}

/**
 * reviewer 結果を決定する。
 *
 * @responsibility reviewer 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>
 * @returns reviewerResultの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がreviewerResultの入力契約を満たす。
 * @postcondition reviewerResultの責務を完了した結果だけを返す。
 * @effect N/A: reviewerResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reviewerResultは独自の失敗分岐を所有しない。
 * @invariant reviewerResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reviewerResultはProcess内の同一Subsystemで完結する。
 * @security reviewerResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reviewerResultは共有非同期状態を持たない同期処理である。
 */
function reviewerResult(value: Record<string, unknown>) {
  if (!exactKeys(value, ["decision", "summary", "findings"]))
    return rejected("provider_task_reviewer_keys_invalid");
  if (value.decision !== "approved" && value.decision !== "changes_requested")
    return rejected("provider_task_reviewer_decision_invalid");
  if (!validString(value.summary, MAXIMUM_SUMMARY_BYTES))
    return rejected("provider_task_reviewer_summary_invalid");
  if (
    !Array.isArray(value.findings) ||
    value.findings.length > MAXIMUM_FINDINGS
  )
    return rejected("provider_task_reviewer_findings_invalid");
  const findings = value.findings.map((finding) => {
    if (
      !isRecord(finding) ||
      !exactKeys(finding, [
        "severity",
        "path",
        "category",
        "criterionNumber",
        "message",
      ]) ||
      typeof finding.severity !== "string" ||
      !SEVERITIES.has(finding.severity) ||
      !validPath(finding.path) ||
      typeof finding.category !== "string" ||
      !FINDING_CATEGORIES.has(finding.category) ||
      typeof finding.criterionNumber !== "number" ||
      !Number.isInteger(finding.criterionNumber) ||
      finding.criterionNumber < 1 ||
      finding.criterionNumber > 16 ||
      !validString(finding.message, MAXIMUM_FINDING_MESSAGE_BYTES)
    ) {
      return null;
    }
    return Object.freeze({
      severity: finding.severity as
        | "critical"
        | "high"
        | "medium"
        | "low"
        | "info",
      path: finding.path as string,
      category: finding.category as
        | "acceptance_criterion_not_met"
        | "implementation_defect"
        | "verification_defect"
        | "security_or_authority_defect",
      criterionNumber: finding.criterionNumber as number,
      message: finding.message as string,
      messageSha256: createHash("sha256")
        .update("crdd-review-finding-message-v1\0")
        .update(finding.message as string, "utf8")
        .digest("hex"),
    });
  });
  if (findings.some((finding) => finding === null))
    return rejected("provider_task_reviewer_finding_invalid");
  if (value.decision === "approved" && findings.length > 0)
    return rejected("provider_task_reviewer_decision_inconsistent");
  if (value.decision === "changes_requested" && findings.length === 0)
    return rejected("provider_task_reviewer_decision_inconsistent");
  const remediationCapability =
    value.decision === "changes_requested" ? Object.freeze({}) : null;
  if (remediationCapability) {
    remediationRecords.set(
      remediationCapability,
      Object.freeze([
        ...(findings as NonNullable<(typeof findings)[number]>[]),
      ]),
    );
  }
  return Object.freeze({
    normalizedResult: Object.freeze({
      decision: value.decision as "approved" | "changes_requested",
      findingCount: findings.length,
      findingDiagnostics: Object.freeze(
        (findings as NonNullable<(typeof findings)[number]>[]).map(
          ({ severity, path, category, criterionNumber, messageSha256 }) =>
            Object.freeze({
              severity,
              path,
              category,
              criterionNumber,
              messageSha256,
            }),
        ),
      ),
      ...(remediationCapability ? { remediationCapability } : {}),
    }),
    reason: null,
  });
}

/**
 * Provider Task Remediationを一回限りで消費する。
 *
 * @responsibility Provider Task Remediationの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input remediationCapability: unknown
 * @returns consumeProviderTaskRemediationの計算結果を返す。
 * @precondition 「remediationCapability: unknown」がconsumeProviderTaskRemediationの入力契約を満たす。
 * @postcondition consumeProviderTaskRemediationの責務を完了した結果だけを返す。
 * @effect N/A: consumeProviderTaskRemediationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeProviderTaskRemediationは独自の失敗分岐を所有しない。
 * @invariant consumeProviderTaskRemediationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeProviderTaskRemediationはProcess内の同一Subsystemで完結する。
 * @security consumeProviderTaskRemediationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeProviderTaskRemediationは共有非同期状態を持たない同期処理である。
 */
export function consumeProviderTaskRemediation(remediationCapability: unknown) {
  if (!remediationCapability || typeof remediationCapability !== "object")
    return null;
  const findings = remediationRecords.get(remediationCapability);
  if (!findings) return null;
  remediationRecords.delete(remediationCapability);
  return Object.freeze({
    status: "consumed" as const,
    findings,
    findingCount: findings.length,
    untrustedProviderTextReported: false,
  });
}

/**
 * Provider Task Structured 結果を固定Schemaへ正規化する。
 *
 * @responsibility Provider Task Structured 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input provider: unknown、taskRole: unknown、selectedEffort: unknown、raw: unknown、taskWorkload: unknown
 * @returns normalizeProviderTaskStructuredResultの計算結果を返す。
 * @precondition 「provider: unknown、taskRole: unknown、selectedEffort: unknown、raw: unknown、taskWorkload: unknown」がnormalizeProviderTaskStructuredResultの入力契約を満たす。
 * @postcondition normalizeProviderTaskStructuredResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeProviderTaskStructuredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeProviderTaskStructuredResultは独自の失敗分岐を所有しない。
 * @invariant normalizeProviderTaskStructuredResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeProviderTaskStructuredResultはProcess内の同一Subsystemで完結する。
 * @security normalizeProviderTaskStructuredResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeProviderTaskStructuredResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeProviderTaskStructuredResult(
  provider: unknown,
  taskRole: unknown,
  selectedEffort: unknown,
  raw: unknown,
  taskWorkload?: unknown,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    (selectedEffort !== "low" &&
      selectedEffort !== "medium" &&
      selectedEffort !== "high") ||
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const turnBudget =
    provider === "claude"
      ? evaluateProviderTaskScope("claude", taskRole, taskWorkload)
      : null;
  if (provider === "claude" && turnBudget?.status !== "candidate") {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const extracted = parseProviderResult({
    provider,
    purpose: "task",
    taskRole,
    raw,
  });
  if (extracted.status !== "confirmed" || extracted.value === null) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        extracted.error?.reason ??
        ("provider_task_result_json_invalid" as const),
      normalizedResult: null,
      rawOutputReported: false,
      untrustedProviderTextReported: false,
      credentialAbsenceVerified: false,
    });
  }
  const value = extracted.value;
  const result = isRecord(value)
    ? taskRole === "executor"
      ? executorResult(value)
      : reviewerResult(value)
    : rejected(
        taskRole === "executor"
          ? "provider_task_executor_shape_invalid"
          : "provider_task_reviewer_shape_invalid",
      );
  return result.normalizedResult
    ? Object.freeze({
        status: "confirmed" as const,
        provider,
        taskRole,
        normalizedResult: Object.freeze({
          ...result.normalizedResult,
          ...(provider === "codex" &&
          "codexExecutionObservation" in extracted &&
          extracted.codexExecutionObservation
            ? {
                providerExecutionObservation:
                  extracted.codexExecutionObservation,
              }
            : {}),
          ...(provider === "claude" &&
          turnBudget?.status === "candidate" &&
          typeof extracted.providerReportedTurns === "number"
            ? {
                providerTurnObservation: Object.freeze({
                  provider: "claude" as const,
                  taskRole,
                  requestedMaximumTurns: turnBudget.maximumTurns,
                  providerReportedTurns: extracted.providerReportedTurns,
                }),
              }
            : {}),
        }),
        rawOutputReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      })
    : Object.freeze({
        status: "blocked" as const,
        reason: result.reason,
        normalizedResult: null,
        rawOutputReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      });
}

/**
 * Provider Task Structured 結果 契約の公開契約を記述する。
 *
 * @responsibility Provider Task Structured 結果 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderTaskStructuredResultContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderTaskStructuredResultContractの入力契約を満たす。
 * @postcondition describeProviderTaskStructuredResultContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderTaskStructuredResultContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderTaskStructuredResultContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderTaskStructuredResultContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderTaskStructuredResultContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderTaskStructuredResultContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderTaskStructuredResultContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderTaskStructuredResultContract() {
  return Object.freeze({
    contract: PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT,
    contractRevision: PROVIDER_TASK_STRUCTURED_RESULT_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"]),
    roles: Object.freeze(["executor", "reviewer"]),
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    acceptedClaudeTurnObservation:
      "requested_cli_limit_and_reported_metadata_without_comparison",
    claudeMaximumApiEquivalentCostUsdByEffort: null,
    claudeApiEquivalentCostDisposition:
      "validated_nonnegative_finite_usage_metadata_not_billing_authority",
    duplicateKeysAllowed: false,
    mismatchDiagnostics:
      "fixed_structural_reason_identifier_only_without_raw_provider_output",
    claudeResultTransport: Object.freeze({
      executor: "provider_structured_output_then_crdd_validation",
      reviewer: "provider_json_envelope_result_then_crdd_validation",
    }),
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    boundedRemediationCapability:
      "opaque_single_use_path_severity_category_criterion_secret_screened_message_claim_and_message_hash_projection",
    reviewerMessageForwardedToExecutor:
      "bounded_untrusted_defect_claim_after_secret_screening",
    credentialAbsenceVerified: false,
  });
}

export const PROVIDER_ADVICE_RESULT_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-result";

export const PROVIDER_ADVICE_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_TEXT_BYTES = 8_192;

const MAXIMUM_REFERENCE_BYTES = 512;

const MAXIMUM_ITEMS_PER_SECTION = 64;

const MAXIMUM_REFERENCES_PER_ITEM = 16;

const resultKeys = [
  "contract",
  "contractRevision",
  "status",
  "facts",
  "sharedAnalysis",
  "additionalInferences",
  "nextOptions",
] as const;

const itemKeys = ["text", "references"] as const;

/**
 * 読取り助言結果の閉じたSchema検証境界で使用するAdviceResultの構造を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceResult = Readonly<{
  status: "completed";
  reason: null;
  facts: readonly CoordinatorAiResultItem[];
  sharedAnalysis: readonly CoordinatorAiResultItem[];
  additionalInferences: readonly CoordinatorAiResultItem[];
  nextOptions: readonly CoordinatorAiResultItem[];
}>;

/**
 * 生Provider出力を読取り助言結果へ正規化する。
 *
 * @responsibility 曖昧でない単一JSONと許可済み参照集合だけを受理する。
 * @trace ARCH-000015
 * @input raw: 生Provider出力、allowedReferences: 読取り投影が許可したexact参照集合。
 * @returns confirmed時だけ正規化結果を返し、不正時は理由付きadviceResultRejectedを返す。
 * @precondition allowedReferencesはProviderへ渡した読取り投影から生成する。
 * @postcondition 全項目は本文と一件以上の許可済み参照を持つ。
 * @effect N/A: 入力検証と値の複製だけを行う。
 * @failure JSON、Schema、文字数または参照が不正なら生出力を含めずadviceResultRejectedにする。
 * @invariant 四つの結果区分と本文・参照の対応を変えない。
 * @boundary 生Provider出力とCoordinator読取り助言結果の境界。
 * @security 許可集合外参照、重複Key、余分なKeyおよび過大出力を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function normalizeAdviceResult(
  raw: unknown,
  allowedReferences: readonly string[],
) {
  const allowed = inspectAllowedReferences(allowedReferences);
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES ||
    allowed === null
  )
    return adviceResultRejected("workbench_ai_advice_result_input_invalid");

  const value = parseUnambiguousJsonDocument(raw);
  if (!isExactRecord(value, resultKeys))
    return adviceResultRejected("workbench_ai_advice_result_schema_invalid");
  if (
    value.contract !== PROVIDER_ADVICE_RESULT_CONTRACT ||
    value.contractRevision !== PROVIDER_ADVICE_RESULT_CONTRACT_REVISION ||
    value.status !== "completed"
  )
    return adviceResultRejected("workbench_ai_advice_result_identity_invalid");

  const facts = inspectItems(value.facts, allowed);
  const sharedAnalysis = inspectItems(value.sharedAnalysis, allowed);
  const additionalInferences = inspectItems(
    value.additionalInferences,
    allowed,
  );
  const nextOptions = inspectItems(value.nextOptions, allowed);
  if (
    facts === null ||
    sharedAnalysis === null ||
    additionalInferences === null ||
    nextOptions === null ||
    facts.length +
      sharedAnalysis.length +
      additionalInferences.length +
      nextOptions.length ===
      0
  )
    return adviceResultRejected("workbench_ai_advice_result_items_invalid");

  return Object.freeze({
    status: "confirmed" as const,
    reason: null,
    normalizedResult: Object.freeze({
      status: "completed" as const,
      reason: null,
      facts,
      sharedAnalysis,
      additionalInferences,
      nextOptions,
    }) satisfies AdviceResult,
    rawOutputReported: false as const,
  });
}

/**
 * 公開結果契約を返す。
 *
 * @responsibility Provider Adapterが固定すべきContract Identity、上限および非公開条件を宣言する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 読取り助言結果の固定契約。
 * @precondition N/A: 定数だけを参照する。
 * @postcondition 実装と試験が同じ上限を参照できる。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant 生Provider出力を公開しない。
 * @boundary N/A: 契約説明で外部境界を開かない。
 * @security rawOutputReportedは常にfalseである。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function describeAdviceResultContract() {
  return Object.freeze({
    contract: PROVIDER_ADVICE_RESULT_CONTRACT,
    contractRevision: PROVIDER_ADVICE_RESULT_CONTRACT_REVISION,
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    maximumItemsPerSection: MAXIMUM_ITEMS_PER_SECTION,
    maximumReferencesPerItem: MAXIMUM_REFERENCES_PER_ITEM,
    duplicateKeysAllowed: false,
    outOfProjectionReferencesAllowed: false,
    rawOutputReported: false,
  });
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるinspectAllowedReferencesの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
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

function inspectAllowedReferences(
  values: readonly string[],
): ReadonlySet<string> | null {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > 1_024 ||
    values.some(
      (reference) => !validString(reference, MAXIMUM_REFERENCE_BYTES),
    ) ||
    new Set(values).size !== values.length
  )
    return null;
  return new Set(values);
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるinspectItemsの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
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

function inspectItems(
  value: unknown,
  allowedReferences: ReadonlySet<string>,
): readonly CoordinatorAiResultItem[] | null {
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS_PER_SECTION)
    return null;
  const items: CoordinatorAiResultItem[] = [];
  for (const item of value) {
    if (
      !isExactRecord(item, itemKeys) ||
      !validString(item.text, MAXIMUM_TEXT_BYTES) ||
      !Array.isArray(item.references) ||
      item.references.length === 0 ||
      item.references.length > MAXIMUM_REFERENCES_PER_ITEM ||
      item.references.some(
        (reference) =>
          !validString(reference, MAXIMUM_REFERENCE_BYTES) ||
          !allowedReferences.has(reference),
      ) ||
      new Set(item.references).size !== item.references.length
    )
      return null;
    items.push(
      Object.freeze({
        text: item.text,
        references: Object.freeze([...item.references] as string[]),
      }),
    );
  }
  return Object.freeze(items);
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるadviceResultRejectedの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
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

function adviceResultRejected(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    normalizedResult: null,
    rawOutputReported: false as const,
  });
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるisExactRecordの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
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

function isExactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => key in value);
}

/**
 * 助言項目配列のJSON Schemaを生成する。
 *
 * @responsibility 四区分で共通利用する本文と根拠参照の閉じたSchemaを一か所で所有する。
 * @trace ARCH-000015
 * @input N/A: 固定Schemaだけを生成する。
 * @returns 助言項目配列のJSON Schema。
 * @precondition N/A: 呼出し条件を持たない。
 * @postcondition 余分Property、空参照および過大配列を許可しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Result Normalizerより強い意味主張を追加しない。
 * @boundary ProviderのSchema制約とCoordinatorの最終検証の間。
 * @security 参照の許可集合確認はProviderでなくCoordinatorが所有する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function itemArraySchema() {
  return Object.freeze({
    type: "array",
    maxItems: 64,
    items: Object.freeze({
      type: "object",
      properties: Object.freeze({
        text: Object.freeze({ type: "string", minLength: 1, maxLength: 8192 }),
        references: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: 16,
          uniqueItems: true,
          items: Object.freeze({
            type: "string",
            minLength: 1,
            maxLength: 512,
          }),
        }),
      }),
      required: Object.freeze(["text", "references"]),
      additionalProperties: false,
    }),
  });
}

const adviceResultSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({
    contract: Object.freeze({
      const: "crdd-coordinator/workbench-ai-advice-result",
    }),
    contractRevision: Object.freeze({ const: 1 }),
    status: Object.freeze({ const: "completed" }),
    facts: itemArraySchema(),
    sharedAnalysis: itemArraySchema(),
    additionalInferences: itemArraySchema(),
    nextOptions: itemArraySchema(),
  }),
  required: Object.freeze([
    "contract",
    "contractRevision",
    "status",
    "facts",
    "sharedAnalysis",
    "additionalInferences",
    "nextOptions",
  ]),
  additionalProperties: false,
});

/**
 * Providerの出力制約へ渡す共通助言結果Schemaを公開する。
 *
 * @responsibility 四区分の結果意味と項目制約をCoordinatorで所有し、ProviderのCLI計画には中立な値として渡す。
 * @trace ARCH-000015
 * @input N/A: 現行の固定結果契約を投影する。
 * @returns 不変な助言結果JSON Schema。
 * @precondition N/A: Authorityや外部入力を要求しない。
 * @postcondition 共通Normalizerと同じ結果契約・改訂・四区分を保持する。
 * @effect N/A: 固定Objectを返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Provider差によって結果の意味を変更しない。
 * @boundary Coordinatorの意味契約とAI AdapterのCLI出力制約の間。
 * @security 許可参照集合の最終確認はCoordinatorに残す。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeAdviceResultSchema() {
  return adviceResultSchema;
}

/**
 * execution-portで使用するCoordinator Single Task 結果の値契約を定義する。
 *
 * @responsibility Coordinator Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskAttemptResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptResult = Readonly<{
  contract: "crdd-coordinator/task-attempt";
  operationId: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
  workspaceResult?: CoordinatorWorkspaceResult;
}>;

/**
 * Host 回復 Tokenを表示形式へ整形する。
 *
 * @responsibility Host 回復 Tokenの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000008
 * @input rootName: string、nonce: string、recordHash: string
 * @returns formatHostRecoveryTokenの計算結果を返す。
 * @precondition 「rootName: string、nonce: string、recordHash: string」がformatHostRecoveryTokenの入力契約を満たす。
 * @postcondition formatHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: formatHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: formatHostRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant formatHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: formatHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security formatHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: formatHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function formatHostRecoveryToken(
  rootName: string,
  nonce: string,
  recordHash: string,
) {
  return `host.${rootName}.${nonce}.${recordHash}`;
}

import type { CoordinatorWorkspaceResult } from "../../../domain-model/src/index.ts";
