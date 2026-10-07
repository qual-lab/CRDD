/**
 * Coordinatorの現在状態を閉じた保存形式として検証する。
 * @responsibility 固定操作情報、現在資源、未解決回復と結果搬送の構造・相関を所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import { validateDockerHostTransitionLineage } from "../docker-runtime/docker-host-transition-state.ts";
import { dockerProcessControllerPublicCompletionReasons } from "../docker-runtime/docker-process-controller-result-reasons.ts";
import {
  isSha256Hex,
  parseDockerTaskRecoveryId,
} from "../docker-runtime/docker-recovery-identity.ts";
import {
  exactRecordKeys,
  validateDockerRecoveryBase,
} from "../docker-runtime/docker-recovery-record-model.ts";
import { parseHostRecoveryToken } from "../host-runtime/host-recovery-record.ts";

export const COORDINATOR_STATE_SCHEMA = "crdd-coordinator/current-state/v1";
export const MAX_COORDINATOR_STATE_BYTES = 16 * 1024 * 1024;
export const MAX_COORDINATOR_STATE_OPERATIONS = 64;
const PURPOSE_RESOURCE = {
  create_egress_network: "egress",
  create_internal_network: "internal",
  create_provider: "provider",
  create_proxy: "proxy",
  create_subscription_auth_probe: "auth",
} as const;
const COMMAND_PURPOSES = [
  ...Object.keys(PURPOSE_RESOURCE),
  "start_subscription_auth_probe_attached",
  "connect_proxy_egress",
  "start_proxy",
  "start_provider_attached",
];
const FAILURE_STAGES = [
  "submission_record",
  "command_restriction",
  "command_start",
  "provider_start_observation",
  "command_wait",
  "execution_classification",
  "resource_receipt_record",
  "subscription_auth_verification",
  "provider_result_normalization",
];
const FINAL_REASONS = new Set<string>([
  ...dockerProcessControllerPublicCompletionReasons,
  "provider_operation_completed",
  "provider_operation_cancelled",
]);

/**
 * 一操作の固定情報と更新可能な現在値を分ける。
 * @responsibility 操作相関、全purposeの評価と一次失敗の保持を型境界にする。
 * @trace ARCH-000008
 * @shape identityとそのHash、exact回復ID、phase、resources、host、lease、execution、結果と要約参照。
 * @invariant checkpointの更新でidentityと回復IDを変更しない。
 * @boundary 保存内容からRuntimeの現在観測への接続。
 * @security 保存値は操作・回復Authorityを発行しない。
 * @compatibility 最新形式だけを扱い、旧Directory形式の読取りを行わない。
 */
export type CoordinatorStateOperation = Readonly<{
  identityJson: string;
  identitySha256: string;
  recoveryId: string;
  phase: "executing" | "settling" | "awaiting_delivery";
  resources: readonly Readonly<{
    purpose: keyof typeof PURPOSE_RESOURCE;
    request:
      | "not_requested"
      | "intent_saved"
      | "issued"
      | "identified"
      | "unknown";
    dockerId: string | null;
    receiptSource: "docker_create_result" | "runtime_reconciliation" | null;
    observation: "unobserved" | "present" | "absent" | "unknown";
    absence: Readonly<{
      recoveryId: string;
      purpose: keyof typeof PURPOSE_RESOURCE;
      plannedResourceName: string;
      dockerId: string | null;
      evidenceSha256: string;
    }> | null;
  }>[];
  host: Readonly<{
    currentToken: string;
    pendingTransitionJson: string | null;
    cleanup: "not_requested" | "pending" | "confirmed" | "unknown";
  }>;
  lease: "held" | "released" | "unknown";
  execution: Readonly<{
    providerStart: "not_started" | "started" | "unknown";
    externalSend: "not_issued" | "issued" | "unknown";
    sharedWrite: "not_issued" | "possible" | "unknown";
    ownerEffect: "active" | "disabled" | "unknown";
    workspaceReusable: false;
  }>;
  primaryFailure: Readonly<{
    purpose: string | null;
    stage: string;
    reason: string;
    exceptionCode: string | null;
    commandHandleObtained: boolean;
    responseObserved: boolean;
    receiptRecorded: boolean;
  }> | null;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    cleanupConfirmed: boolean;
  }> | null;
  summarySha256: string | null;
}>;

/**
 * Repository一つの未終了集合を保持する。
 * @responsibility 単調改訂、元内容Hash、操作参照と未受理結果を型として分離する。
 * @trace ARCH-000008
 * @shape 固定schema、改訂相関、Repository結合と三つの現在集合。
 * @invariant 履歴や候補本体を現在集合へ蓄積しない。
 * @boundary 保存Ownerと状態利用側。
 * @security JSONは実資源観測やAuthorityの代わりではない。
 * @compatibility 最新schemaのみ。移行はフロントAIが所有する。
 */
export type CoordinatorStateSnapshot = Readonly<{
  schema: typeof COORDINATOR_STATE_SCHEMA;
  revision: number;
  previous: Readonly<{ revision: number; payloadSha256: string }> | null;
  repositoryBinding: string;
  operations: readonly CoordinatorStateOperation[];
  unresolvedRecoveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    reason: string;
    obligations: readonly (
      | "docker_resources"
      | "host_cleanup"
      | "lease_release"
      | "result_delivery"
    )[];
  }>[];
  pendingDeliveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    resultId: string;
    consumer: "coordinator_cli" | "project_runtime" | "workbench";
    acceptanceSha256: string | null;
  }>[];
}>;

/**
 * 宣言したJSON値を再帰的なkey順序で一意に符号化する。
 * @responsibility 不正型・accessor・Proxy・過剰深度を拒否し、配列順は保持する。
 * @trace ARCH-000008
 * @input value: 保存候補のplain JSON値、depth: 内部再帰深度。
 * @returns sorted-key JSON本文。
 * @precondition N/A: 不正値も受け取り拒否する。
 * @postcondition 同じ値のobject key順に依存しない本文を返す。
 * @effect N/A: メモリ内の値だけを扱う。
 * @failure 不正型、循環・過剰深度、accessorとProxyでは例外。
 * @invariant 配列の意味順序は並べ替えない。
 * @boundary 呼出し側の値と保存byte列。
 * @security getterやProxy trapを評価しない。
 * @concurrency N/A: 同期の値変換で共有状態を更新しない。
 */
export function encodeCoordinatorStateValue(value: unknown, depth = 0): string {
  if (depth > 32 || types.isProxy(value))
    throw new Error("coordinator_state_value_invalid");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (!value || typeof value !== "object")
    throw new Error("coordinator_state_value_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    Object.values(descriptors).some((d) => !Object.hasOwn(d, "value"))
  )
    throw new Error("coordinator_state_value_invalid");
  if (Array.isArray(value)) {
    if (
      keys.length !== value.length + 1 ||
      !Object.hasOwn(descriptors, "length")
    )
      throw new Error("coordinator_state_value_invalid");
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor) throw new Error("coordinator_state_value_invalid");
      items.push(encodeCoordinatorStateValue(descriptor.value, depth + 1));
    }
    return `[${items.join(",")}]`;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error("coordinator_state_value_invalid");
  return `{${Object.keys(descriptors)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${encodeCoordinatorStateValue(descriptors[key]?.value, depth + 1)}`,
    )
    .join(",")}}`;
}

/**
 * 現在状態と固定情報に使用する内容Hashを導出する。
 * @responsibility 宣言したsorted-key UTF-8本文と一つのLFへ結合する。
 * @trace ARCH-000008
 * @input value: plain JSON値。
 * @returns 内容のSHA-256。
 * @precondition 値が固定encodingで表現可能。
 * @postcondition objectの挿入順に依存しない。
 * @effect N/A: メモリ内のHash計算だけ。
 * @failure 不正値はencoderの例外を返す。
 * @invariant 可変SnapshotのHashと固定操作情報のHashを混同しない。
 * @boundary 保存内容の相関。
 * @security HashをAuthorityとして発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function coordinatorStateContentHash(value: unknown): string {
  return createHash("sha256")
    .update(`${encodeCoordinatorStateValue(value)}\n`, "utf8")
    .digest("hex");
}

/**
 * 保存本文を閉じた現在状態へ復号する。
 * @responsibility byte形式、操作Identity、資源と未終了参照の構造相関を検査する。
 * @trace ARCH-000008
 * @input bytes: UTF-8保存本文、repositoryBinding: 呼出し側で検証したRepository結合Hash。
 * @returns 検証済みの不変Snapshotと本文Hash、またはnull。
 * @precondition Repositoryの現在Identityは別のRuntime境界で確認する。
 * @postcondition 不正本文、別Repository、重複・孤立参照を拒否する。
 * @effect N/A: メモリ内の復号だけ。
 * @failure 構造、encodingまたは相関不一致はnull。
 * @invariant 過去unknownと現在観測を区別し、Hostの確定本文を再符号化しない。
 * @boundary 非Authorityの保存内容とRuntimeの再観測。
 * @security 本文を実資源不存在、所有権または処置許可へ昇格しない。
 * @concurrency N/A: 保存や共有状態更新を行わない。
 */
export function decodeCoordinatorStateSnapshot(
  input: unknown,
  repositoryBinding: unknown,
): Readonly<{
  snapshot: CoordinatorStateSnapshot;
  payloadSha256: string;
}> | null {
  try {
    if (
      types.isProxy(input) ||
      !Buffer.isBuffer(input) ||
      !isSha256Hex(repositoryBinding)
    )
      return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (
      !Number.isSafeInteger(length) ||
      length === 0 ||
      length > MAX_COORDINATOR_STATE_BYTES
    )
      return null;
    const buffer = Object.getOwnPropertyDescriptor(
      intrinsic,
      "buffer",
    )?.get?.call(input);
    const offset = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteOffset",
    )?.get?.call(input);
    const bytes = Buffer.from(new Uint8Array(buffer, offset, length));
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const parsed = JSON.parse(text, (_key, value) =>
      value && typeof value === "object" ? Object.freeze(value) : value,
    );
    if (
      `${encodeCoordinatorStateValue(parsed)}\n` !== text ||
      !exactRecordKeys(parsed, [
        "schema",
        "revision",
        "previous",
        "repositoryBinding",
        "operations",
        "unresolvedRecoveries",
        "pendingDeliveries",
      ])
    )
      return null;
    const snapshot = parsed as CoordinatorStateSnapshot;
    if (
      snapshot.schema !== COORDINATOR_STATE_SCHEMA ||
      snapshot.repositoryBinding !== repositoryBinding ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 1
    )
      return null;
    if (
      snapshot.revision === 1
        ? snapshot.previous !== null
        : !exactRecordKeys(snapshot.previous, ["revision", "payloadSha256"]) ||
          snapshot.previous === null ||
          !Number.isSafeInteger(snapshot.previous.revision) ||
          snapshot.previous.revision !== snapshot.revision - 1 ||
          !isSha256Hex(snapshot.previous.payloadSha256)
    )
      return null;
    if (
      !Array.isArray(snapshot.operations) ||
      snapshot.operations.length > MAX_COORDINATOR_STATE_OPERATIONS ||
      !Array.isArray(snapshot.unresolvedRecoveries) ||
      snapshot.unresolvedRecoveries.length > MAX_COORDINATOR_STATE_OPERATIONS ||
      !Array.isArray(snapshot.pendingDeliveries) ||
      snapshot.pendingDeliveries.length > MAX_COORDINATOR_STATE_OPERATIONS * 3
    )
      return null;
    const operations = new Map<string, CoordinatorStateOperation>();
    let previousNonce = "";
    for (const operation of snapshot.operations) {
      if (
        !exactRecordKeys(operation, [
          "identityJson",
          "identitySha256",
          "recoveryId",
          "phase",
          "resources",
          "host",
          "lease",
          "execution",
          "primaryFailure",
          "outcome",
          "summarySha256",
        ])
      )
        return null;
      const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
      if (
        !recovery ||
        recovery.operationNonce <= previousNonce ||
        typeof operation.identityJson !== "string" ||
        !operation.identityJson.endsWith("\n")
      )
        return null;
      const identity = JSON.parse(operation.identityJson);
      if (
        `${JSON.stringify(identity)}\n` !== operation.identityJson ||
        !validateDockerRecoveryBase(identity, recovery.operationNonce) ||
        createHash("sha256")
          .update(operation.identityJson, "utf8")
          .digest("hex") !== operation.identitySha256 ||
        recovery.baseHash !== operation.identitySha256 ||
        recovery.stableLogicalHomeBindingHash !==
          identity.stableLogicalHomeBindingHash
      )
        return null;
      previousNonce = recovery.operationNonce;
      operations.set(recovery.operationNonce, operation);
      if (
        !["executing", "settling", "awaiting_delivery"].includes(
          operation.phase,
        ) ||
        !["held", "released", "unknown"].includes(operation.lease) ||
        (operation.summarySha256 !== null &&
          !isSha256Hex(operation.summarySha256))
      )
        return null;
      if (
        !Array.isArray(operation.resources) ||
        operation.resources.length !== 5
      )
        return null;
      for (const [index, purpose] of Object.keys(PURPOSE_RESOURCE).entries()) {
        const resource = operation.resources[index];
        if (
          !resource ||
          !exactRecordKeys(resource, [
            "purpose",
            "request",
            "dockerId",
            "receiptSource",
            "observation",
            "absence",
          ]) ||
          resource.purpose !== purpose ||
          ![
            "not_requested",
            "intent_saved",
            "issued",
            "identified",
            "unknown",
          ].includes(resource.request) ||
          !["unobserved", "present", "absent", "unknown"].includes(
            resource.observation,
          )
        )
          return null;
        if (
          resource.request === "identified"
            ? !isSha256Hex(resource.dockerId) ||
              !["docker_create_result", "runtime_reconciliation"].includes(
                resource.receiptSource ?? "",
              )
            : resource.dockerId !== null || resource.receiptSource !== null
        )
          return null;
        if (resource.observation === "absent") {
          const absence = resource.absence;
          if (
            !exactRecordKeys(absence, [
              "recoveryId",
              "purpose",
              "plannedResourceName",
              "dockerId",
              "evidenceSha256",
            ]) ||
            !absence ||
            absence.recoveryId !== operation.recoveryId ||
            absence.purpose !== purpose ||
            absence.plannedResourceName !==
              identity.resources[
                PURPOSE_RESOURCE[purpose as keyof typeof PURPOSE_RESOURCE]
              ] ||
            absence.dockerId !== resource.dockerId ||
            !isSha256Hex(absence.evidenceSha256)
          )
            return null;
        } else if (resource.absence !== null) return null;
      }
      if (
        !exactRecordKeys(operation.host, [
          "currentToken",
          "pendingTransitionJson",
          "cleanup",
        ]) ||
        !["not_requested", "pending", "confirmed", "unknown"].includes(
          operation.host.cleanup,
        )
      )
        return null;
      const initialHost = parseHostRecoveryToken(
        identity.initialHostRecoveryId,
      );
      const currentHost = parseHostRecoveryToken(operation.host.currentToken);
      if (
        initialHost.rootName !== currentHost.rootName ||
        initialHost.nonce !== currentHost.nonce
      )
        return null;
      if (operation.host.pendingTransitionJson !== null) {
        if (typeof operation.host.pendingTransitionJson !== "string")
          return null;
        const transition = JSON.parse(operation.host.pendingTransitionJson);
        if (
          `${JSON.stringify(transition)}\n` !==
            operation.host.pendingTransitionJson ||
          !exactRecordKeys(transition, [
            "currentToken",
            "expectedToken",
            "rootName",
            "nonce",
            "currentState",
            "nextState",
            "recordBefore",
          ])
        )
          return null;
        const lineage = validateDockerHostTransitionLineage(transition);
        if (
          ![
            "host_only:docker_submission_started",
            "docker_submission_started:host_only",
            "docker_submission_started:docker_absent_confirmed",
          ].includes(`${transition.currentState}:${transition.nextState}`)
        )
          return null;
        if (
          lineage.current.rootName !== initialHost.rootName ||
          lineage.current.nonce !== initialHost.nonce ||
          ![lineage.currentToken, lineage.expectedToken].includes(
            operation.host.currentToken,
          )
        )
          return null;
      }
      const execution = operation.execution;
      if (
        !exactRecordKeys(execution, [
          "providerStart",
          "externalSend",
          "sharedWrite",
          "ownerEffect",
          "workspaceReusable",
        ]) ||
        !["not_started", "started", "unknown"].includes(
          execution.providerStart,
        ) ||
        !["not_issued", "issued", "unknown"].includes(execution.externalSend) ||
        !["not_issued", "possible", "unknown"].includes(
          execution.sharedWrite,
        ) ||
        !["active", "disabled", "unknown"].includes(execution.ownerEffect) ||
        execution.workspaceReusable !== false
      )
        return null;
      if (operation.primaryFailure !== null) {
        const failure = operation.primaryFailure;
        if (
          !exactRecordKeys(failure, [
            "purpose",
            "stage",
            "reason",
            "exceptionCode",
            "commandHandleObtained",
            "responseObserved",
            "receiptRecorded",
          ]) ||
          (failure.purpose !== null &&
            !COMMAND_PURPOSES.includes(failure.purpose)) ||
          !FAILURE_STAGES.includes(failure.stage) ||
          !FINAL_REASONS.has(failure.reason) ||
          (failure.exceptionCode !== null &&
            ![
              "ENOENT",
              "EACCES",
              "EPERM",
              "ETIMEDOUT",
              "ECONNREFUSED",
              "EPIPE",
              "unclassified_exception",
            ].includes(failure.exceptionCode) &&
            !/^docker_effect_(management_required|plan_invalid|plan_replaced|command_not_owned|platform_unsupported|cli_untrusted|cli_replaced|path_invalid|config_invalid|config_replaced|filesystem_identity_invalid)$/u.test(
              failure.exceptionCode,
            ) &&
            !/^owned_operation_(management_binding_required|unknown_child|child_replaced|mount_replaced)$/u.test(
              failure.exceptionCode,
            )) ||
          [
            failure.commandHandleObtained,
            failure.responseObserved,
            failure.receiptRecorded,
          ].some((value) => typeof value !== "boolean") ||
          (failure.receiptRecorded && !failure.responseObserved)
        )
          return null;
      }
      if (operation.outcome !== null) {
        const outcome = operation.outcome;
        if (
          !exactRecordKeys(outcome, ["status", "reason", "cleanupConfirmed"]) ||
          typeof outcome.cleanupConfirmed !== "boolean" ||
          !FINAL_REASONS.has(outcome.reason) ||
          (outcome.status === "completed"
            ? outcome.reason !== "provider_operation_completed"
            : outcome.status === "cancelled"
              ? outcome.reason !== "provider_operation_cancelled"
              : outcome.status !== "blocked" ||
                [
                  "provider_operation_completed",
                  "provider_operation_cancelled",
                ].includes(outcome.reason))
        )
          return null;
      }
    }
    let previousRecovery = "";
    for (const recovery of snapshot.unresolvedRecoveries) {
      if (
        !exactRecordKeys(recovery, [
          "operationNonce",
          "recoveryId",
          "reason",
          "obligations",
        ]) ||
        recovery.operationNonce <= previousRecovery ||
        operations.get(recovery.operationNonce)?.recoveryId !==
          recovery.recoveryId ||
        !FINAL_REASONS.has(recovery.reason) ||
        !Array.isArray(recovery.obligations) ||
        recovery.obligations.length === 0 ||
        recovery.obligations.length > 4
      )
        return null;
      previousRecovery = recovery.operationNonce;
      let previousObligation = "";
      for (const obligation of recovery.obligations) {
        if (
          ![
            "docker_resources",
            "host_cleanup",
            "lease_release",
            "result_delivery",
          ].includes(obligation) ||
          obligation <= previousObligation
        )
          return null;
        previousObligation = obligation;
      }
    }
    let previousDelivery = "";
    for (const delivery of snapshot.pendingDeliveries) {
      if (
        !exactRecordKeys(delivery, [
          "operationNonce",
          "recoveryId",
          "resultId",
          "consumer",
          "acceptanceSha256",
        ]) ||
        operations.get(delivery.operationNonce)?.recoveryId !==
          delivery.recoveryId ||
        !isSha256Hex(delivery.resultId) ||
        !["coordinator_cli", "project_runtime", "workbench"].includes(
          delivery.consumer,
        ) ||
        (delivery.acceptanceSha256 !== null &&
          !isSha256Hex(delivery.acceptanceSha256))
      )
        return null;
      const key = `${delivery.operationNonce}:${delivery.consumer}`;
      if (key <= previousDelivery) return null;
      previousDelivery = key;
    }
    return Object.freeze({
      snapshot,
      payloadSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch {
    return null;
  }
}

/**
 * 同じRepositoryの現在状態更新で既知事実を保全する。
 * @responsibility exact元本文、固定Identity、確定資源と一次結果の保持を検査する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文または初回のnull、nextBytes: 次本文、repositoryBinding: 現在結合。
 * @returns 許可された内容遷移だけtrue。
 * @precondition 物理Ownerが元Fileの観測と初回Root条件を確認する。
 * @postcondition 不変情報と未終了集合の暗黙除去を拒否する。
 * @effect N/A: メモリ内の比較のみ。
 * @failure 復号・改訂・遷移不一致はfalse。
 * @invariant unknownを既知事実の消去や再実行許可へ用いない。
 * @boundary 保存候補の構造と実処置前の検証。
 * @security trueは資源終端・Authority・保存確定の証明ではない。
 * @concurrency N/A: 排他とfresh観測は物理Writerの責務。
 */
export function validateCoordinatorStateTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  try {
    const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (!next || (currentBytes !== null && !current)) return false;
    if (!current) {
      if (next.snapshot.revision !== 1 || next.snapshot.previous !== null)
        return false;
    } else if (
      next.snapshot.revision !== current.snapshot.revision + 1 ||
      next.snapshot.previous?.revision !== current.snapshot.revision ||
      next.snapshot.previous.payloadSha256 !== current.payloadSha256
    )
      return false;
    const priorOperations = new Map(
      (current?.snapshot.operations ?? []).map((operation) => [
        parseDockerTaskRecoveryId(operation.recoveryId)?.operationNonce,
        operation,
      ]),
    );
    const phases = ["executing", "settling", "awaiting_delivery"];
    for (const operation of next.snapshot.operations) {
      const nonce = parseDockerTaskRecoveryId(
        operation.recoveryId,
      )?.operationNonce;
      const prior = priorOperations.get(nonce);
      if (!prior) {
        const identity = JSON.parse(operation.identityJson);
        if (
          operation.phase !== "executing" ||
          operation.resources.some(
            (resource) =>
              resource.request !== "not_requested" ||
              resource.observation !== "unobserved",
          ) ||
          operation.host.currentToken !== identity.initialHostRecoveryId ||
          operation.host.pendingTransitionJson !== null ||
          operation.host.cleanup !== "not_requested" ||
          operation.lease !== "held" ||
          operation.execution.providerStart !== "not_started" ||
          operation.execution.externalSend !== "not_issued" ||
          operation.execution.sharedWrite !== "not_issued" ||
          operation.execution.ownerEffect !== "active" ||
          operation.primaryFailure !== null ||
          operation.outcome !== null ||
          operation.summarySha256 !== null
        )
          return false;
        continue;
      }
      priorOperations.delete(nonce);
      if (
        operation.identityJson !== prior.identityJson ||
        operation.identitySha256 !== prior.identitySha256 ||
        operation.recoveryId !== prior.recoveryId ||
        phases.indexOf(operation.phase) < phases.indexOf(prior.phase)
      )
        return false;
      for (const [index, resource] of operation.resources.entries()) {
        const before = prior.resources[index];
        if (!before) return false;
        if (
          before.request !== resource.request &&
          ![
            "not_requested:intent_saved",
            "intent_saved:issued",
            "intent_saved:unknown",
            "unknown:issued",
            "unknown:identified",
            "issued:identified",
          ].includes(`${before.request}:${resource.request}`)
        )
          return false;
        if (
          before.request === "identified" &&
          (resource.dockerId !== before.dockerId ||
            resource.receiptSource !== before.receiptSource)
        )
          return false;
      }
      if (
        prior.primaryFailure !== null &&
        encodeCoordinatorStateValue(operation.primaryFailure) !==
          encodeCoordinatorStateValue(prior.primaryFailure)
      )
        return false;
      if (
        prior.summarySha256 !== null &&
        operation.summarySha256 !== prior.summarySha256
      )
        return false;
      if (
        prior.outcome !== null &&
        (operation.outcome === null ||
          operation.outcome.status !== prior.outcome.status ||
          operation.outcome.reason !== prior.outcome.reason ||
          (prior.outcome.cleanupConfirmed &&
            !operation.outcome.cleanupConfirmed))
      )
        return false;
      for (const [field, known] of [
        ["providerStart", "started"],
        ["externalSend", "issued"],
        ["sharedWrite", "possible"],
        ["ownerEffect", "disabled"],
      ] as const) {
        if (
          prior.execution[field] === known &&
          operation.execution[field] !== known
        )
          return false;
        if (
          prior.execution[field] === "unknown" &&
          operation.execution[field] !== "unknown" &&
          operation.execution[field] !== known
        )
          return false;
      }
      if (prior.lease === "released" && operation.lease !== "released")
        return false;
      if (
        prior.host.cleanup === "confirmed" &&
        operation.host.cleanup !== "confirmed"
      )
        return false;
      const pending =
        prior.host.pendingTransitionJson === null
          ? null
          : JSON.parse(prior.host.pendingTransitionJson);
      if (
        operation.host.currentToken !== prior.host.currentToken &&
        (!pending ||
          pending.currentToken !== prior.host.currentToken ||
          operation.host.currentToken !== pending.expectedToken)
      )
        return false;
      if (
        operation.host.pendingTransitionJson !==
        prior.host.pendingTransitionJson
      ) {
        if (pending && operation.host.currentToken !== pending.expectedToken)
          return false;
        if (
          operation.host.pendingTransitionJson !== null &&
          JSON.parse(operation.host.pendingTransitionJson).currentToken !==
            operation.host.currentToken
        )
          return false;
      }
    }
    if (priorOperations.size !== 0) return false;
    for (const before of current?.snapshot.unresolvedRecoveries ?? []) {
      const after = next.snapshot.unresolvedRecoveries.find(
        (item) => item.operationNonce === before.operationNonce,
      );
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        before.obligations.some(
          (obligation) => !after.obligations.includes(obligation),
        )
      )
        return false;
    }
    for (const before of current?.snapshot.pendingDeliveries ?? []) {
      const after = next.snapshot.pendingDeliveries.find(
        (item) =>
          item.operationNonce === before.operationNonce &&
          item.consumer === before.consumer,
      );
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        after.resultId !== before.resultId ||
        (before.acceptanceSha256 !== null &&
          after.acceptanceSha256 !== before.acceptanceSha256)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
