/**
 * 単独試験の記録を製品Executorの公開入口へ結合する。
 * @responsibility 試験Rootの保存と終端受領だけを所有し、実行・Home排他・清掃を複製しない。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary 明示承認された試験専用。実行判断と過去保持物の操作は行わない。
 */
import { PURPOSES, isAttemptFailureReason } from "../src/lifecycle/attempt.ts";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readCommittedJson,
  writeCommittedJson,
  applyCoordinatorResourceEvent,
  applyCoordinatorResourceCleanup,
  type CoordinatorResourceBook,
  observeRepositoryRuntimeDataArea,
} from "../../domain-model/src/index.ts";
import { getRepository } from "../../version-control/src/index.ts";
import { observeWindowsProviderHome } from "../../platform-access/src/index.ts";
import {
  createExecutor,
  type ExecutorRequest,
  type ExecutorCallbacks,
  type CompletionResult,
  type AttemptTerminalObservation,
  type AttemptDiagnosticNotice,
} from "../src/index.ts";

/** 元要求と同じRootに必要な通知を保存し、公開ExecutorのCompletionをjoinする。 @trace ERB-IT-004 */
export function createStandaloneProviderAttemptHost(
  directory: string,
  request: ExecutorRequest<"attempt">,
  onProviderStarted?: () => void,
) {
  const root = fs.realpathSync(directory);
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const verified = getRepository(repository);
  if (verified.status !== "completed") throw Error(verified.reason);
  const area = observeRepositoryRuntimeDataArea(verified.capability, "tests");
  if (area.status !== "ready") throw Error(area.reason);
  const parent = area.directory;
  const relative = path.relative(parent, root);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw Error("standalone_host_root_outside_tests");
  if (
    root.toLowerCase() !== path.resolve(directory).toLowerCase() ||
    fs.lstatSync(root).isSymbolicLink() ||
    fs.readdirSync(root).length
  )
    throw Error("standalone_host_root_invalid");
  const identity = fs.statSync(root, { bigint: true });
  const runtime = createExecutor(request, {
    paths: {
      tmp: path.join(root, "tmp"),
      management: path.join(root, "management"),
    },
  });
  if (!runtime) throw Error("standalone_host_plan_or_lease_invalid");
  const operationId = request.target.operationId,
    provider = request.selection.provider;
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const requestHash = hash(JSON.stringify(request));
  const recoveryId = `docker-task.${request.target.stableLogicalHomeBindingHash}.${hash(root)}.${requestHash}`;
  const management = {},
    recovery = {};
  let sequence = 0,
    opened = false,
    released = false,
    closed = false,
    terminalAttempted = false,
    homeChecked = false;
  let nativeCleanupConfirmed = true,
    homeFailure: string | null = null;
  let resources: CoordinatorResourceBook | null = null;
  let lastPayloadSha256 = requestHash;
  let terminal: AttemptTerminalObservation | null = null;
  let originalResult: CompletionResult<"attempt"> | null = null;
  let diagnostic: Readonly<
    Pick<
      Extract<
        AttemptDiagnosticNotice,
        { event: "coordinator_provider_boundary_settled" }
      >,
      | "primaryFailure"
      | "providerProcessStartedObserved"
      | "processTreeTerminationObserved"
      | "containersAbsentObserved"
      | "networksAbsentObserved"
      | "cleanupConfirmed"
    >
  > | null = null;
  function current(): boolean {
    try {
      const stat = fs.statSync(root, { bigint: true });
      return (
        !fs.lstatSync(root).isSymbolicLink() &&
        stat.dev === identity.dev &&
        stat.ino === identity.ino &&
        stat.birthtimeNs === identity.birthtimeNs &&
        hash(JSON.stringify(request)) === requestHash
      );
    } catch {
      return false;
    }
  }
  function save(kind: string, fields: object = {}): void {
    if (!current()) throw Error("standalone_host_owner_unconfirmed");
    const name = `event-${String(++sequence).padStart(3, "0")}.json`;
    const value = {
      kind,
      recordedAt: new Date().toISOString(),
      operationId,
      provider,
      recoveryId,
      sequence,
      ...fields,
    };
    const written = writeCommittedJson(root, name, name, value);
    const read = readCommittedJson(written.target, name);
    if (
      read.hash !== written.hash ||
      read.identityText !== written.identityText ||
      JSON.stringify(read.value) !== JSON.stringify(value)
    )
      throw Error("standalone_host_save_unconfirmed");
    lastPayloadSha256 = written.hash;
  }
  const callbacks: ExecutorCallbacks<"attempt"> = {
    onCommandSubmitting: (purpose, frame) => {
      if (!purpose.startsWith("create_")) return;
      // Executorが同じHomeの排他を取得した後、最初の資源Effectより前に再観測する。
      if (!homeChecked) {
        homeChecked = true;
        nativeCleanupConfirmed = false;
        const observed = observeWindowsProviderHome(
          provider,
          request.target.providerHomeSourcePath,
        );
        nativeCleanupConfirmed =
          (!observed.processEffectIssued || observed.helperExitConfirmed) &&
          observed.filesystemEffectIssued === false;
        if (
          observed.status !== "candidate" ||
          !observed.processEffectIssued ||
          !observed.helperExitConfirmed ||
          !observed.artifactVerifiedBeforeAndAfter ||
          observed.filesystemEffectIssued ||
          [
            "providerHomeIdentityHash",
            "providerHomeProtectionHash",
            "localUserBindingHash",
            "stableLogicalHomeBindingHash",
          ].some(
            (key) =>
              Reflect.get(observed, key) !== Reflect.get(request.target, key),
          )
        ) {
          homeFailure = "trial_home_changed_or_unconfirmed";
          throw Error(homeFailure);
        }
      }
      const next = applyCoordinatorResourceEvent(resources, {
        ...frame,
        event: "submission",
        key: purpose,
      });
      if (!next) throw Error("resource_submission_unconfirmed");
      save("submission_planned", { resources: next });
      resources = next;
    },
    onCommandNotIssued: (purpose) => {
      if (!purpose.startsWith("create_")) return;
      const next = applyCoordinatorResourceEvent(resources, {
        event: "not_issued",
        key: purpose,
      });
      if (!next) throw Error("resource_not_issued_unconfirmed");
      save("resource_not_issued", { resources: next });
      resources = next;
    },
    onResourceCreated: (purpose, _id, frame) => {
      const next = applyCoordinatorResourceEvent(resources, {
        ...frame,
        event: "receipt",
        key: purpose,
      });
      if (!next) throw Error("resource_receipt_unconfirmed");
      save("receipt_recorded", { resources: next });
      resources = next;
    },
    onResourceIdentified: (key, frame) => {
      const next = applyCoordinatorResourceEvent(resources, {
        ...frame,
        event: "identified",
        key,
      });
      if (!next) throw Error("resource_receipt_unconfirmed");
      save("receipt_recorded", { resources: next });
      resources = next;
    },
    onProviderSubmitting: () => save("provider_submission"),
    onStarted: () => {
      onProviderStarted?.();
    },
    onCleanupCompleted: (observation) => {
      terminal = observation;
      released = observation.homeLeaseReleased;
      if (
        !released ||
        !observation.processTreeTerminationConfirmed ||
        !observation.containersAbsent ||
        !observation.networksAbsent ||
        !resources ||
        !observation.resourceSnapshot ||
        !observation.resources
      )
        return;
      const next = applyCoordinatorResourceCleanup(
        resources,
        observation.resourceSnapshot,
        observation.resources,
        { recoveryId, previousPayloadSha256: lastPayloadSha256 },
      );
      if (!next || next.checkpoints.some((c) => c.observation === "unknown"))
        throw Error("absence_unconfirmed");
      save("home_released");
      save("absence_observed", { resources: next });
      resources = next;
      save("mount_recorded");
      save("recovery_closed");
      closed = true;
    },
    onDiagnostic: (notice) => {
      if (notice.event !== "coordinator_provider_boundary_settled") return;
      diagnostic = Object.freeze({
        primaryFailure: notice.primaryFailure,
        providerProcessStartedObserved: notice.providerProcessStartedObserved,
        processTreeTerminationObserved: notice.processTreeTerminationObserved,
        containersAbsentObserved: notice.containersAbsentObserved,
        networksAbsentObserved: notice.networksAbsentObserved,
        cleanupConfirmed: notice.cleanupConfirmed,
      });
      if (closed && released) save("execution_settled", diagnostic);
    },
  };
  return Object.freeze({
    runtime,
    management,
    recoveryId,
    get nativeCleanupConfirmed() {
      return nativeCleanupConfirmed;
    },
    get releaseConfirmed() {
      return released;
    },
    get homeFailure() {
      return homeFailure;
    },
    readDiagnostic: () => diagnostic,
    readTerminal: () => terminal,
    start: () => {
      if (!opened) {
        save("recovery_opened");
        save("recovery_handoff");
        opened = true;
      }
      const started = runtime.start({
        managementCapability: management,
        reference: { recoveryId, recoveryCapability: recovery },
        callbacks,
      });
      if (started.status !== "started") return started;
      return {
        ...started,
        completion: started.completion.then((result) => {
          originalResult = result;
          return result;
        }),
      };
    },
    recordTerminal: (result: CompletionResult<"attempt">) => {
      if (
        result !== originalResult ||
        !terminal ||
        !closed ||
        !released ||
        terminalAttempted ||
        !result.cleanupConfirmed
      )
        return false;
      terminalAttempted = true;
      save("terminal_received", {
        status: result.status,
        reason: result.reason,
        resultSha256: result.resultSha256,
        resultBytes: result.resultBytes,
      });
      return true;
    },
  });
}
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
