/**
 * 検証ToolのIPC診断をExecutorの技術契約だけで検査する。
 * @packageDocumentation
 * @responsibility 閉じた非秘密fieldと相関だけを検査し、記録Host・EMをロードしない。
 * @trace ERB-IT-004
 * @boundary 開発・検証専用。保存・実行・回復処置を行わない。
 */
import { isAttemptFailureReason, PURPOSES } from "../src/lifecycle/attempt.ts";

/** IPC診断は閉じた非秘密fieldだけを受け取る。 @trace ERB-IT-004 */
export function isPrimaryFailureDiagnostic(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const hasObservation = Object.hasOwn(record, "commandObservation");
  const hasAuthenticationStatus = Object.hasOwn(record, "authenticationStatus");
  const hasTurnCountDiagnostic = Object.hasOwn(record, "turnCountDiagnostic");
  const hasIsolationFailure = Object.hasOwn(record, "isolationFailure");
  const isolation = record.isolationFailure as
    | Record<string, unknown>
    | null
    | undefined;
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
        ...(hasIsolationFailure ? ["isolationFailure"] : []),
      ].sort(),
    ) &&
    (!hasIsolationFailure ||
      isolation === null ||
      (isolation != null &&
        typeof isolation === "object" &&
        exactKeys(isolation, [
          "commandHandleObtained",
          "exceptionCode",
          "kind",
          "notification",
          "reason",
          "responseObserved",
          "stage",
          "stepKey",
        ]) &&
        isolation.stepKey === record.purpose &&
        typeof isolation.stage === "string" &&
        [
          "preparation",
          "notification",
          "start",
          "wait",
          "observation",
        ].includes(isolation.stage) &&
        typeof isolation.reason === "string" &&
        /^docker_[a-z_]{1,160}$/u.test(isolation.reason) &&
        typeof isolation.kind === "string" &&
        [
          "threw",
          "invalid_return",
          "start_unconfirmed",
          "command_failed",
        ].includes(isolation.kind) &&
        (isolation.notification === null ||
          (typeof isolation.notification === "string" &&
            [
              "onSubmitting",
              "onNotIssued",
              "onCreated",
              "onStarted",
              "onObserved",
              "onCompleted",
              "onCleanupSubmitting",
              "onResourceIdentified",
              "onCleanupCompleted",
              "onResourcesClosed",
            ].includes(isolation.notification))) &&
        typeof isolation.commandHandleObtained === "boolean" &&
        typeof isolation.responseObserved === "boolean" &&
        (!isolation.responseObserved || isolation.commandHandleObtained) &&
        (isolation.exceptionCode === null ||
          (typeof isolation.exceptionCode === "string" &&
            isolation.exceptionCode.length <= 100 &&
            /^(?:unclassified_exception|E[A-Z]+|PROCESS_FAILURE|docker_effect_[a-z_]+|owned_operation_[a-z_]+)$/u.test(
              isolation.exceptionCode,
            ))))) &&
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
            (!Number.isSafeInteger(Number(turnCount.numberText)) ||
              Number(turnCount.numberText) < 1))))) &&
    (record.purpose === null ||
      (typeof record.purpose === "string" &&
        (PURPOSES as readonly string[]).includes(record.purpose))) &&
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
    isAttemptFailureReason(record.reason) &&
    (record.exceptionCode === null ||
      (typeof record.exceptionCode === "string" &&
        [
          "unclassified_exception",
          "PROCESS_FAILURE",
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
function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => actualKeys.includes(key))
  );
}
