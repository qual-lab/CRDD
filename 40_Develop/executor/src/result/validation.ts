/**
 * Provider単段の技術結果と非秘密診断を検査する。
 * @packageDocumentation
 * @responsibility 生出力の閉形式検査と元レビュー結果の一回使用証拠を所有し、Task進行は管理しない。
 * @trace ARCH-000008
 * @boundary Provider結果と上位の受入・保存の間。
 */
import { types as utilTypes } from "node:util";
import {
  dockerProcessControllerPublicCompletionReasons,
  snapshotPlainRecord,
} from "../../../domain-model/src/index.ts";
import type { ProviderTurnCountDiagnostic } from "../../../ai-adapter/src/index.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";

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
export function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => actualKeys.includes(key))
  );
}
