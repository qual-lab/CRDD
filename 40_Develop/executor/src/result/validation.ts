/**
 * Provider単段の技術結果と非秘密診断を検査する。
 * @packageDocumentation
 * @responsibility 技術結果・回復参照・非秘密診断の閉形式検査を所有し、Task進行や是正証拠の発行を行わない。
 * @trace ARCH-000008
 * @boundary Provider結果と上位の受入・保存の間。
 */
import { types as utilTypes } from "node:util";
import { PROVIDER_ADVICE_OUTPUT_REASONS } from "../../../ai-adapter/src/index.ts";

export const ATTEMPT_COMPLETION_REASONS = Object.freeze([
  "provider_deadline_exceeded",
  "docker_setup_deadline_exceeded",
  "provider_output_limit_exceeded",
  "provider_process_signalled",
  "provider_process_exit_nonzero",
  "provider_subscription_quota_exhausted",
  "provider_authentication_expired",
  "provider_operation_budget_exceeded",
  "provider_turn_limit_exceeded",
  "provider_structured_output_retry_exhausted",
  "provider_invocation_rejected",
  "provider_network_unavailable",
  "provider_service_unavailable",
  "docker_setup_create_subscription_auth_probe_failed",
  "docker_setup_start_subscription_auth_probe_attached_failed",
  "docker_setup_create_internal_network_failed",
  "docker_setup_create_egress_network_failed",
  "docker_setup_create_proxy_failed",
  "docker_setup_connect_proxy_egress_failed",
  "docker_setup_create_provider_failed",
  "docker_setup_start_proxy_failed",
  "docker_setup_command_failed",
  "docker_resource_submission_record_unavailable",
  "docker_resource_receipt_unavailable",
  "docker_process_controller_execution_restricted",
  "provider_subscription_auth_not_confirmed",
  "provider_result_invalid",
  "workbench_ai_advice_result_identity_invalid",
  "workbench_ai_advice_result_input_invalid",
  "workbench_ai_advice_result_items_invalid",
  "workbench_ai_advice_result_schema_invalid",
  ...PROVIDER_ADVICE_OUTPUT_REASONS,
  "provider_task_result_input_invalid",
  "provider_task_result_json_invalid",
  "provider_task_result_envelope_status_invalid",
  "provider_task_result_turn_count_invalid",
  "provider_task_result_turn_limit_mismatch",
  "provider_task_result_cost_metadata_invalid",
  "provider_task_reviewer_result_transport_invalid",
  "provider_task_executor_shape_invalid",
  "provider_task_reviewer_shape_invalid",
  "provider_task_reviewer_keys_invalid",
  "provider_task_reviewer_decision_invalid",
  "provider_task_reviewer_summary_invalid",
  "provider_task_reviewer_findings_invalid",
  "provider_task_reviewer_finding_invalid",
  "provider_task_reviewer_decision_inconsistent",
  "docker_process_controller_execution_failed_closed",
  "docker_process_controller_provider_start_failed",
  "docker_process_controller_provider_start_observation_failed",
  "repository_revision_changed",
] as const);

/**
 * 技術結果の固定field集合を動的Propertyなしに捕捉する。
 * @responsibility 既存診断shapeの受理順序を変えず値を局所化する。
 * @trace ARCH-000008
 * @input 未検査値とこのModule内の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition 永続化・保存Schemaの判断は行わない。
 * @postcondition getter・Proxy・継承値を評価しない。
 * @effect N/A: 同期の検査のみ。
 * @failure 不正shape・取得不能はnull。
 * @invariant 観測不能を成功へ補完しない。
 * @boundary 結果・診断の内部捕捉。
 * @security 任意のfieldを公開結果へ混入させない。
 * @concurrency N/A: 共有状態なし。
 */
function snapshotPlainRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}
import type {
  AttemptFailureReason,
  RecoveryStartFailureDiagnostic,
} from "./types.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import type { Recovery } from "../attempt/types.ts";

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
} satisfies Readonly<Record<DockerSetupCommandPurpose, AttemptFailureReason>>);

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

export const PROVIDER_RESULT_MAXIMUM_RAW_BYTES = 65_536;

/**
 * 正規化結果で使用する文字列の空値・前後空白・NUL・UTF-8容量を検査する。
 * @responsibility TaskとAdviceが同じ既存の文字列条件を利用する。
 * @trace ARCH-000015
 * @input value: 未検査値、maximumBytes: 用途側が所有する容量上限。
 * @returns 条件を満たす文字列だけtrue。
 * @precondition 容量上限は各結果契約の定数。
 * @postcondition 入力を変更せず、Authorityや参照許可を付与しない。
 * @effect N/A: 純粋な値検査。
 * @failure 不正な値はfalse。
 * @invariant Provider生出力を保存・公開しない。
 * @boundary Executor内部の結果検査。
 * @security 秘密不存在や意味上の妥当性を証明しない。
 * @concurrency N/A: 同期処理。
 */
export function validResultString(
  value: unknown,
  maximumBytes: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}

/**
 * 値がDocker Process Controllerの公開完了理由か判定する。
 *
 * @responsibility 下位結果の未知文字列をOwner Registry由来の固定理由から分離する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns 固定Registryにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の観測値を受け取る。
 * @postcondition trueの場合、値をAttemptFailureReasonとして扱える。
 * @effect N/A: 不変Registryを参照するだけである。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で理由を許可しない。
 * @boundary 下位Provider結果からDocker Process Controller公開結果への診断境界。
 * @security 生出力または自由文を公開理由へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
export function isAttemptFailureReason(
  value: unknown,
): value is AttemptFailureReason {
  return typeof value === "string" && blockedCompletionReasons.has(value);
}

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
    ATTEMPT_COMPLETION_REASONS.some((reason) => reason === record.reason) &&
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

/** error本文の語句観測。相互排他の原因分類ではない。 */
const ITEM_ERROR_MENTION_KEYS = [
  "itemErrorHostMentionCount",
  "itemErrorSpawnMentionCount",
  "itemErrorProtocolMentionCount",
  "itemErrorConnectionMentionCount",
  "itemErrorToolMentionCount",
  "itemErrorPermissionMentionCount",
  "itemErrorMissingPathMentionCount",
  "itemErrorTimeoutMentionCount",
  "itemErrorUnclassifiedCount",
] as const;

/** Provider実行観測の閉じた診断項目。実行許可・清掃判定には使用しない。 */
const observationKeys = new Set([
  "transport",
  "turnCompleted",
  "itemErrorCount",
  "itemErrorCodeModeCount",
  "itemErrorKnownWarningTextCount",
  ...ITEM_ERROR_MENTION_KEYS,
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
export function inspectAttemptObservation(raw: unknown) {
  const withoutWarningText = new Set(
    [...observationKeys].filter(
      (key) => key !== "itemErrorKnownWarningTextCount",
    ),
  );
  const withoutMentions = new Set(
    [...withoutWarningText].filter(
      (key) => !(ITEM_ERROR_MENTION_KEYS as readonly string[]).includes(key),
    ),
  );
  const observation =
    snapshotPlainRecord(raw, observationKeys) ??
    snapshotPlainRecord(raw, withoutWarningText) ??
    snapshotPlainRecord(raw, withoutMentions) ??
    snapshotPlainRecord(
      raw,
      new Set(
        [...withoutMentions].filter(
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
  if (
    Object.hasOwn(observation, "itemErrorKnownWarningTextCount") &&
    (!Number.isSafeInteger(observation.itemErrorKnownWarningTextCount) ||
      (observation.itemErrorKnownWarningTextCount as number) < 0 ||
      (observation.itemErrorKnownWarningTextCount as number) >
        (observation.itemErrorCount as number))
  )
    return null;
  // 旧観測の欠測は補完しない。新fieldは全件・有限・総数以下だけを受理する。
  if (
    ITEM_ERROR_MENTION_KEYS.some((key) => Object.hasOwn(observation, key)) &&
    !ITEM_ERROR_MENTION_KEYS.every(
      (key) =>
        Number.isSafeInteger(observation[key]) &&
        (observation[key] as number) >= 0 &&
        (observation[key] as number) <= (observation.itemErrorCount as number),
    )
  )
    return null;
  if (Object.hasOwn(observation, "itemErrorUnclassifiedCount")) {
    const classified =
      (observation.itemErrorCount as number) -
      (observation.itemErrorUnclassifiedCount as number);
    const mentions = ITEM_ERROR_MENTION_KEYS.filter(
      (key) => key !== "itemErrorUnclassifiedCount",
    ).map((key) => observation[key] as number);
    if (
      mentions.some((count) => count > classified) ||
      mentions.reduce((sum, count) => sum + count, 0) < classified
    )
      return null;
  }
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
 * @precondition 「value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown」がprojectAttemptStartResultの入力契約を満たす。
 * @postcondition projectAttemptStartResultの責務を完了した結果だけを返す。
 * @effect N/A: projectAttemptStartResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectAttemptStartResultは独自の失敗分岐を所有しない。
 * @invariant projectAttemptStartResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectAttemptStartResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency projectAttemptStartResultは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function projectAttemptStartResult(
  value: unknown,
  handedOffRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const blockedRecord = exactPlainRecord(value, BLOCKED_START_KEYS);
  if (blockedRecord && ownDataValue(blockedRecord, "status") === "blocked") {
    const record = blockedRecord;
    const rawRecoveryId = ownDataValue(record, "recoveryId");
    const recoveryId =
      rawRecoveryId === null ? null : resolveRecoveryReference(rawRecoveryId);
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
  const recoveryId = resolveRecoveryReference(
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
 * @precondition 「value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown」がprojectAttemptResultの入力契約を満たす。
 * @postcondition projectAttemptResultの責務を完了した結果だけを返す。
 * @effect N/A: projectAttemptResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectAttemptResultは独自の失敗分岐を所有しない。
 * @invariant projectAttemptResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectAttemptResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectAttemptResultは共有非同期状態を持たない同期処理である。
 */
export function projectAttemptResult(
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
    rawRecoveryId === null ? null : resolveRecoveryReference(rawRecoveryId);
  const expected = resolveRecoveryReference(expectedRecoveryId);
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

const blockedCompletionReasons = new Set<string>(ATTEMPT_COMPLETION_REASONS);

// 現行Hostの開始・在庫投影が返す有限理由だけを受ける。
// 旧保存方式のProducer不在理由を分類契約として保持しない。未知値は従来どおりunavailable。
const recoveryStartReasonClass = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  ...[
    "docker_task_recovery_home_lock_release_unconfirmed",
    "docker_task_recovery_host_lock_release_unconfirmed",
    "docker_task_runtime_state_lock_release_unconfirmed",
    "docker_task_recovery_begin_failed_closed",
    "docker_task_recovery_failed_closed",
  ].map(
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
 * @returns resolveRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がresolveRecoveryStartReasonの入力契約を満たす。
 * @postcondition resolveRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryStartReason(reason: unknown) {
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
 * @returns resolveRecoveryReferenceの計算結果を返す。
 * @precondition 「value: unknown」がresolveRecoveryReferenceの入力契約を満たす。
 * @postcondition resolveRecoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryReferenceはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryReferenceは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryReference(value: unknown) {
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

/**
 * Ready 回復を所有Snapshotへ変換する。
 *
 * @responsibility Ready 回復の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns Recovery | nullを返す。
 * @precondition 「value: unknown」がsnapshotReadyRecoveryの入力契約を満たす。
 * @postcondition snapshotReadyRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: snapshotReadyRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotReadyRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotReadyRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotReadyRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotReadyRecoveryは共有非同期状態を持たない同期処理である。
 */
export function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

/**
 * Blocked 回復 With Exact Idを所有Snapshotへ変換する。
 *
 * @responsibility Blocked 回復 With Exact Idの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedStableLogicalHomeBindingHash: string
 * @returns snapshotBlockedRecoveryWithExactIdの計算結果を返す。
 * @precondition 「value: unknown、expectedStableLogicalHomeBindingHash: string」がsnapshotBlockedRecoveryWithExactIdの入力契約を満たす。
 * @postcondition snapshotBlockedRecoveryWithExactIdの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBlockedRecoveryWithExactIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBlockedRecoveryWithExactIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBlockedRecoveryWithExactIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotBlockedRecoveryWithExactIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBlockedRecoveryWithExactIdは共有非同期状態を持たない同期処理である。
 */
export function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (utilTypes.isProxy(value)) return null;
  let hasOwner = false;
  try {
    const keys = Object.keys(value).sort().join("\0");
    hasOwner =
      keys ===
      [
        "reason",
        "recoveryId",
        "status",
        "recoveryCapability",
        "manualRecoveryRequired",
      ]
        .sort()
        .join("\0");
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      (keys !== ["reason", "recoveryId", "status"].sort().join("\0") &&
        !hasOwner)
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = resolveRecoveryReference(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  const capability = ownDataValue(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      utilTypes.isProxy(capability) ||
      ownDataValue(value, "manualRecoveryRequired") !== true)
  )
    return null;
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({
        status,
        reason,
        recoveryId,
        recoveryCapability: capability ?? null,
      })
    : null;
}
