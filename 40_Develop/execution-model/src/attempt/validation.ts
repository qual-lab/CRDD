/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import { createHash } from "node:crypto";
import { inspectExecutionSelection } from "../task/validation.ts";
import { snapshotPlainRecord } from "../plain-data/snapshot.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import type { CoordinatorStateSnapshot } from "../state/types.ts";
import {
  coordinatorHistoryLineBytes,
  coordinatorOperationSummaryBytes,
  hasRuntimeStateRecordKeys,
  isSha256Hex,
} from "../state/validation.ts";
import { coordinatorConsumerCompletionPolicy } from "../task/validation.ts";
import type { DockerRuntimeRepairCheckpoint } from "./repair-types.ts";
import {
  decodeDockerRuntimeRepairCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  decodeDockerRuntimeRepairRetentionTargets,
  dockerRuntimeRepairCheckpointIsSettled,
  dockerRuntimeRepairDisposalIsSettled,
  validateDockerRuntimeRepairCheckpointTransition,
  validateDockerRuntimeRepairSessionCheckpoint,
} from "./repair-validation.ts";
import type {
  CoordinatorRepairRetentionReceipt,
  CoordinatorResourceBook,
  CoordinatorStateOperation,
  CoordinatorStateRepairOperation,
  CoordinatorStateTaskOperation,
  DockerRestartCheckpoint,
} from "./types.ts";

/**
 * 保存された資源集合の形と相関を確認する。実在や削除許可は判定しない。
 * @responsibility Identityの重複を作らず、非秘密Snapshotとkey別checkpointを結合する。
 * @trace ARCH-000008
 * @effect N/A: JSON値の純粋検査だけ。
 * @failure 旧配列形式、欠測・重複key、秘密値を含み得る未正規化fieldは拒否する。
 */
export function validateCoordinatorResourceBook(
  value: unknown,
): value is CoordinatorResourceBook | null {
  if (value === null) return true;
  if (!hasRuntimeStateRecordKeys(value, ["snapshot", "checkpoints", "cleanup"]))
    return false;
  const book = value as CoordinatorResourceBook;
  if (
    !hasRuntimeStateRecordKeys(book.snapshot, ["resources"]) ||
    !Array.isArray(book.snapshot.resources) ||
    !Array.isArray(book.checkpoints) ||
    book.snapshot.resources.length === 0 ||
    book.snapshot.resources.length !== book.checkpoints.length ||
    !hasRuntimeStateRecordKeys(book.cleanup, [
      "cleanupOrder",
      "setupTimeoutMs",
      "unreceiptedAbsence",
      "verifyLabelAbsence",
    ]) ||
    !Array.isArray(book.cleanup.cleanupOrder) ||
    !Number.isSafeInteger(book.cleanup.setupTimeoutMs) ||
    book.cleanup.setupTimeoutMs <= 0 ||
    !["retain", "observe"].includes(book.cleanup.unreceiptedAbsence) ||
    typeof book.cleanup.verifyLabelAbsence !== "boolean"
  )
    return false;
  const keys = new Set<string>();
  const resourceNames = new Set<string>();
  for (const resource of book.snapshot.resources) {
    if (
      !hasRuntimeStateRecordKeys(resource, [
        "key",
        "identity",
        "request",
        "configuration",
      ]) ||
      typeof resource.key !== "string" ||
      resource.key.length === 0 ||
      keys.has(resource.key) ||
      !hasRuntimeStateRecordKeys(resource.identity, [
        "kind",
        "dockerId",
        "name",
        "ownershipLabel",
      ]) ||
      !["container", "network"].includes(resource.identity.kind) ||
      (resource.identity.dockerId !== null &&
        !isSha256Hex(resource.identity.dockerId)) ||
      typeof resource.identity.name !== "string" ||
      !resource.identity.name ||
      typeof resource.identity.ownershipLabel !== "string" ||
      !resource.identity.ownershipLabel ||
      !["not_issued", "issued", "unknown"].includes(resource.request) ||
      (resource.request === "issued" && resource.identity.dockerId === null) ||
      (resource.request === "not_issued" &&
        resource.identity.dockerId !== null) ||
      !hasRuntimeStateRecordKeys(resource.configuration, [
        "image",
        "command",
        "environmentNames",
        "mounts",
        "networks",
        "internal",
      ])
    )
      return false;
    const resourceName = `${resource.identity.kind}\0${resource.identity.name}`;
    if (resourceNames.has(resourceName)) return false;
    resourceNames.add(resourceName);
    keys.add(resource.key);
    const c = resource.configuration;
    if (
      (c.image !== null && typeof c.image !== "string") ||
      (c.command !== null &&
        (!Array.isArray(c.command) ||
          c.command.some((v: unknown) => v !== "<redacted>"))) ||
      (c.environmentNames !== null &&
        (!Array.isArray(c.environmentNames) ||
          c.environmentNames.some(
            (v: unknown) =>
              typeof v !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(v),
          ))) ||
      (c.networks !== null &&
        (!Array.isArray(c.networks) ||
          c.networks.some((v: unknown) => typeof v !== "string"))) ||
      (c.internal !== null && typeof c.internal !== "boolean") ||
      (c.mounts !== null &&
        (!Array.isArray(c.mounts) ||
          c.mounts.some(
            (v: unknown) =>
              !hasRuntimeStateRecordKeys(v, ["source", "target", "readOnly"]) ||
              typeof (v as { source: unknown }).source !== "string" ||
              typeof (v as { target: unknown }).target !== "string" ||
              typeof (v as { readOnly: unknown }).readOnly !== "boolean",
          )))
    )
      return false;
  }
  const checkpointKeys = new Set<string>();
  for (const checkpoint of book.checkpoints) {
    if (
      !hasRuntimeStateRecordKeys(checkpoint, [
        "key",
        "submission",
        "receiptSource",
        "observation",
        "absenceEvidenceSha256",
      ]) ||
      !keys.has(checkpoint.key) ||
      checkpointKeys.has(checkpoint.key) ||
      !["none", "intent_saved", "not_issued"].includes(checkpoint.submission) ||
      (checkpoint.receiptSource !== null &&
        !["docker_create_result", "runtime_reconciliation"].includes(
          checkpoint.receiptSource,
        )) ||
      !["unobserved", "present", "absent", "unknown"].includes(
        checkpoint.observation,
      ) ||
      (checkpoint.absenceEvidenceSha256 !== null &&
        !isSha256Hex(checkpoint.absenceEvidenceSha256))
    )
      return false;
    checkpointKeys.add(checkpoint.key);
    const resource = book.snapshot.resources.find(
      (r) => r.key === checkpoint.key,
    );
    if (
      !resource ||
      (checkpoint.receiptSource !== null &&
        resource.identity.dockerId === null) ||
      (resource.identity.dockerId !== null &&
        checkpoint.receiptSource === null) ||
      (checkpoint.submission !== "intent_saved" &&
        (resource.request !== "not_issued" ||
          resource.identity.dockerId !== null ||
          checkpoint.observation !== "unobserved" ||
          checkpoint.absenceEvidenceSha256 !== null)) ||
      (checkpoint.observation === "absent") !==
        (checkpoint.absenceEvidenceSha256 !== null)
    )
      return false;
  }
  return (
    book.cleanup.cleanupOrder.length === keys.size &&
    new Set(book.cleanup.cleanupOrder).size === keys.size &&
    book.cleanup.cleanupOrder.every((key) => keys.has(key))
  );
}

/**
 * 元資源の識別情報と既知IDを保持したまま観測を更新する。
 * @responsibility 初回Intentの原子確定と既知事実の巻戻し拒否を所有する。
 * @trace ARCH-000008
 * @effect N/A: 値の比較だけ。構成差を回収拒否へ転化しない。
 */
export function validateCoordinatorResourceBookTransition(
  before: CoordinatorResourceBook | null,
  after: CoordinatorResourceBook | null,
): boolean {
  if (!validateCoordinatorResourceBook(after)) return false;
  if (before === null)
    return (
      after === null ||
      (after.checkpoints.filter((c) => c.submission === "intent_saved")
        .length === 1 &&
        after.checkpoints.every(
          (c) =>
            c.submission !== "not_issued" &&
            c.receiptSource === null &&
            c.observation === "unobserved",
        ) &&
        after.snapshot.resources.every((r) => r.identity.dockerId === null))
    );
  if (
    after === null ||
    encodeRuntimeStateValue(before.cleanup) !==
      encodeRuntimeStateValue(after.cleanup) ||
    before.snapshot.resources.length !== after.snapshot.resources.length
  )
    return false;
  for (const resource of after.snapshot.resources) {
    const previous = before.snapshot.resources.find(
      (r) => r.key === resource.key,
    );
    const checkpoint = after.checkpoints.find((c) => c.key === resource.key);
    const prior = before.checkpoints.find((c) => c.key === resource.key);
    if (
      !previous ||
      !checkpoint ||
      !prior ||
      resource.identity.kind !== previous.identity.kind ||
      resource.identity.name !== previous.identity.name ||
      resource.identity.ownershipLabel !== previous.identity.ownershipLabel ||
      (previous.identity.dockerId !== null &&
        resource.identity.dockerId !== previous.identity.dockerId) ||
      (prior.receiptSource !== null &&
        checkpoint.receiptSource !== prior.receiptSource) ||
      (prior.submission !== checkpoint.submission &&
        !["none:intent_saved", "intent_saved:not_issued"].includes(
          `${prior.submission}:${checkpoint.submission}`,
        ))
    )
      return false;
  }
  return true;
}

/**
 * 修復専用の終端・処置・履歴条件を同じ判定で確認する。
 * @responsibility Taskの配送・ACK条件を修復へ流用せず、二つの保存codecで条件を共用する。
 * @trace ARCH-000008
 * @input operation: codec検証済み修復、snapshot: 同じ保存の回復・配送区画。
 * @returns 終了条件が成立する場合だけtrue。
 * @precondition 物理Ownerが現在の保存資格と履歴読戻しを別途確認する。
 * @postcondition 保存値や他操作を変更しない。
 * @effect N/A: メモリ内の同期比較だけ。
 * @failure 未回収かつ引渡し未確定の保持物・未終端・未確認履歴・同ID参照はfalse。
 * @invariant 通常更新の暗黙除去拒否とTask終了契約を変更しない。
 * @boundary 修復現在状態と既存completion Writer。
 * @security 候補生成を削除許可や実資源不存在の観測にしない。
 * @concurrency 元版・履歴・現在Ownerの再照合は物理Writerが所有する。
 */
export function coordinatorRepairCanComplete(
  operation: CoordinatorStateRepairOperation,
  snapshot: Readonly<{
    unresolvedRecoveries: readonly Readonly<{ recoveryId: string }>[];
    pendingDeliveries: readonly Readonly<{ recoveryId: string }>[];
  }>,
): boolean {
  return !(
    operation.phase !== "settling" ||
    operation.outcome?.status !== "recovered" ||
    operation.outcome.reason !== "runtime_repair_recovered" ||
    operation.outcome.cleanupConfirmed !== true ||
    operation.primaryFailure !== null ||
    operation.checkpoint?.engine !== "ready" ||
    operation.checkpoint.hostSafety !== "safe" ||
    operation.checkpoint.cleanup !== "confirmed" ||
    operation.checkpoint.cleanupFailure !== null ||
    !dockerRuntimeRepairCheckpointIsSettled(operation.checkpoint) ||
    !(
      (operation.disposition === "not_applicable" &&
        operation.checkpoint.stale === "absent") ||
      (operation.disposition === "discard" &&
        operation.checkpoint.stale === "retained" &&
        operation.disposal !== null &&
        dockerRuntimeRepairDisposalIsSettled(operation.disposal.checkpoint)) ||
      (operation.disposition === "retained_by_human_decision" &&
        operation.checkpoint.stale === "retained" &&
        operation.retention !== undefined)
    ) ||
    operation.history?.confirmed !== true ||
    JSON.parse(operation.identityJson).consumer !== "coordinator_cli" ||
    snapshot.unresolvedRecoveries.some(
      (item) => item.recoveryId === operation.recoveryId,
    ) ||
    snapshot.pendingDeliveries.some(
      (item) => item.recoveryId === operation.recoveryId,
    )
  );
}

export const PROVIDER_ADVICE_OUTPUT_REASONS = Object.freeze([
  "workbench_ai_provider_output_invalid",
  "workbench_ai_codex_output_invalid",
  "workbench_ai_codex_completion_invalid",
  "workbench_ai_codex_tool_event_forbidden",
  "workbench_ai_codex_final_message_invalid",
  "workbench_ai_claude_envelope_invalid",
  "workbench_ai_claude_completion_invalid",
  "workbench_ai_claude_turn_count_invalid",
  "workbench_ai_claude_metadata_invalid",
  "workbench_ai_claude_structured_output_invalid",
] as const);

/**
 * 技術実行区画を保存Envelopeから独立して検証する。
 * @responsibility Operation、exact回復参照、配送待ちの構造と相関を検証する。
 * @trace ARCH-000008
 * @input snapshot: 復号済みの現在集合、repositoryBinding: 検証済みRepository結合。
 * @returns 全ての構造・相関条件が成立する場合だけtrue。
 * @precondition 入力はJSONから復号され、保存Rootの検証は呼出し側が行う。
 * @postcondition 未知区画や孤立参照を受理しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 不正構造・相関不一致はfalse。
 * @invariant 保存形式の検証と実資源観測を同一視しない。
 * @boundary 保存Envelopeと技術実行モデル。
 * @security 保存内容を処置Authorityへ昇格しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function validCoordinatorExecutionState(
  snapshot: Pick<
    CoordinatorStateSnapshot,
    "operations" | "unresolvedRecoveries" | "pendingDeliveries"
  >,
  repositoryBinding: string,
): boolean {
  if (
    !Array.isArray(snapshot.operations) ||
    !Array.isArray(snapshot.unresolvedRecoveries) ||
    !Array.isArray(snapshot.pendingDeliveries)
  )
    return false;
  const operations = new Map<string, CoordinatorStateOperation>();
  let unresolvedRestarts = 0;
  let unresolvedRepairs = 0;
  let previousNonce = "";
  for (const operation of snapshot.operations) {
    if (operation.kind === "runtime_repair") {
      if (
        !validCoordinatorRepairOperation(operation, repositoryBinding as string)
      )
        return false;
      const nonce = coordinatorOperationNonce(operation);
      if (nonce <= previousNonce) return false;
      previousNonce = nonce;
      operations.set(nonce, operation);
      if (operation.phase !== "awaiting_delivery" && ++unresolvedRepairs > 1)
        return false;
      continue;
    }
    if (operation.kind !== "docker_task") return false;
    if (
      !hasRuntimeStateRecordKeys(operation, [
        "kind",
        "dockerRestart",
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
        "history",
      ])
    )
      return false;
    const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
    if (
      !recovery ||
      recovery.operationNonce <= previousNonce ||
      typeof operation.identityJson !== "string" ||
      !operation.identityJson.endsWith("\n")
    )
      return false;
    const identity = JSON.parse(operation.identityJson);
    if (
      `${JSON.stringify(identity)}\n` !== operation.identityJson ||
      !validateCoordinatorOperationIdentity(
        identity,
        recovery.operationNonce,
        repositoryBinding,
      ) ||
      createHash("sha256")
        .update(operation.identityJson, "utf8")
        .digest("hex") !== operation.identitySha256 ||
      recovery.baseHash !== operation.identitySha256 ||
      recovery.stableLogicalHomeBindingHash !==
        identity.stableLogicalHomeBindingHash
    )
      return false;
    previousNonce = recovery.operationNonce;
    if (operation.dockerRestart !== null) {
      const restart = decodeDockerRestartCheckpoint(operation.dockerRestart);
      if (
        !restart ||
        restart.requestId !==
          createDockerRestartRequestId(
            repositoryBinding,
            operation.identitySha256,
            operation.recoveryId,
            restart.scopeSha256,
          )
      )
        return false;
      if (restart.result === null || !isDockerRestartCheckpointSettled(restart))
        unresolvedRestarts += 1;
      if (unresolvedRestarts > 1) return false;
    }
    operations.set(recovery.operationNonce, operation);
    if (
      !["executing", "settling", "awaiting_delivery"].includes(
        operation.phase,
      ) ||
      !["held", "released", "unknown"].includes(operation.lease) ||
      (operation.summarySha256 !== null &&
        !isSha256Hex(operation.summarySha256))
    )
      return false;
    if (
      !validateCoordinatorResourceBook(operation.resources) ||
      operation.resources?.snapshot.resources.some(
        (resource: CoordinatorResourceBook["snapshot"]["resources"][number]) =>
          resource.identity.ownershipLabel !== identity.ownershipLabel,
      )
    )
      return false;
    if (
      !hasRuntimeStateRecordKeys(operation.host, [
        "currentToken",
        "pendingTransitionJson",
        "cleanup",
      ]) ||
      !["not_requested", "pending", "confirmed", "unknown"].includes(
        operation.host.cleanup,
      )
    )
      return false;
    const initialHost = parseHostRecoveryToken(identity.initialHostRecoveryId);
    const currentHost = parseHostRecoveryToken(operation.host.currentToken);
    if (
      initialHost.rootName !== currentHost.rootName ||
      initialHost.nonce !== currentHost.nonce
    )
      return false;
    if (operation.host.pendingTransitionJson !== null) {
      if (typeof operation.host.pendingTransitionJson !== "string")
        return false;
      const transition = JSON.parse(operation.host.pendingTransitionJson);
      if (
        `${JSON.stringify(transition)}\n` !==
          operation.host.pendingTransitionJson ||
        !hasRuntimeStateRecordKeys(transition, [
          "currentToken",
          "expectedToken",
          "rootName",
          "nonce",
          "currentState",
          "nextState",
          "recordBefore",
        ])
      )
        return false;
      const lineage = validateHostRecoveryTransitionLineage(transition);
      if (
        ![
          "host_only:docker_submission_started",
          "docker_submission_started:host_only",
          "docker_submission_started:docker_absent_confirmed",
        ].includes(`${transition.currentState}:${transition.nextState}`)
      )
        return false;
      if (
        lineage.current.rootName !== initialHost.rootName ||
        lineage.current.nonce !== initialHost.nonce ||
        ![lineage.currentToken, lineage.expectedToken].includes(
          operation.host.currentToken,
        )
      )
        return false;
    }
    const execution = operation.execution;
    if (
      !hasRuntimeStateRecordKeys(execution, [
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
      !["not_issued", "possible", "unknown"].includes(execution.sharedWrite) ||
      !["active", "disabled", "unknown"].includes(execution.ownerEffect) ||
      execution.workspaceReusable !== false
    )
      return false;
    if (
      !validCoordinatorPrimaryFailure(operation.primaryFailure) ||
      !validCoordinatorOutcome(operation.outcome)
    )
      return false;
    if ((operation.summarySha256 === null) !== (operation.history === null))
      return false;
    if (operation.history !== null) {
      const history = operation.history;
      if (
        !operation.outcome ||
        !hasRuntimeStateRecordKeys(history, [
          "occurredAt",
          "lineSha256",
          "confirmed",
        ]) ||
        typeof history.occurredAt !== "string" ||
        !Number.isFinite(Date.parse(history.occurredAt)) ||
        new Date(Date.parse(history.occurredAt)).toISOString() !==
          history.occurredAt ||
        !isSha256Hex(history.lineSha256) ||
        typeof history.confirmed !== "boolean" ||
        createHash("sha256")
          .update(coordinatorOperationSummaryBytes(operation))
          .digest("hex") !== operation.summarySha256 ||
        createHash("sha256")
          .update(coordinatorHistoryLineBytes(operation, history.occurredAt))
          .digest("hex") !== history.lineSha256
      )
        return false;
    }
  }
  let previousRecovery = "";
  for (const recovery of snapshot.unresolvedRecoveries) {
    const referencedOperation = operations.get(recovery.operationNonce);
    if (
      !hasRuntimeStateRecordKeys(recovery, [
        "operationNonce",
        "recoveryId",
        "reason",
        "obligations",
      ]) ||
      recovery.operationNonce <= previousRecovery ||
      referencedOperation?.kind !== "docker_task" ||
      referencedOperation.recoveryId !== recovery.recoveryId ||
      !finalReasons.has(recovery.reason) ||
      !Array.isArray(recovery.obligations) ||
      recovery.obligations.length === 0 ||
      recovery.obligations.length > 4
    )
      return false;
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
        return false;
      previousObligation = obligation;
    }
  }
  let previousDelivery = "";
  const deliveryResultIds = new Map<string, string>();
  for (const delivery of snapshot.pendingDeliveries) {
    const deliveryOperation = operations.get(delivery.operationNonce);
    if (
      !hasRuntimeStateRecordKeys(delivery, [
        "operationNonce",
        "recoveryId",
        "resultId",
        "consumer",
      ]) ||
      !deliveryOperation ||
      deliveryOperation.kind !== "docker_task" ||
      deliveryOperation.recoveryId !== delivery.recoveryId ||
      !isSha256Hex(delivery.resultId) ||
      delivery.consumer !== "orchestrator" ||
      JSON.parse(deliveryOperation.identityJson).consumer !== delivery.consumer
    )
      return false;
    const key = `${delivery.operationNonce}:${delivery.consumer}`;
    if (key <= previousDelivery) return false;
    const fixedResultId = deliveryResultIds.get(delivery.operationNonce);
    if (fixedResultId !== undefined && fixedResultId !== delivery.resultId)
      return false;
    deliveryResultIds.set(delivery.operationNonce, delivery.resultId);
    previousDelivery = key;
  }
  return true;
}

/**
 * 修復variantの不変Identityと技術・上位状態の相関を検査する。
 * @responsibility Task専用値を要求せず、固定Identityとexact回復IDへ結合する。
 * @trace ARCH-000008
 * @input operation: 未信頼保存値、repositoryBinding: 外側の検証済み結合。
 * @returns 完全な修復variantだけtrue。
 * @precondition 外側codecが正規JSONから復号した値である。
 * @postcondition 署名や旧記録を新形式へ補完しない。
 * @effect N/A: 値の検査だけ。
 * @failure 不正key、別結合、結果／保持判断の矛盾はfalse。
 * @invariant 復号成功を人間承認や実修復成功へ昇格しない。
 * @boundary 保存envelopeと下位の技術DTO。
 * @security 生Path、Provider、Homeを修復Identityへ入れない。
 * @concurrency N/A: 同期の値検査。
 */
export function validCoordinatorRepairOperation(
  operation: CoordinatorStateRepairOperation,
  repositoryBinding: string,
): boolean {
  if (
    !hasRuntimeStateRecordKeys(operation, [
      "kind",
      "identityJson",
      "identitySha256",
      "recoveryId",
      "phase",
      "checkpoint",
      "disposition",
      "disposal",
      ...(Object.hasOwn(operation, "retention") ? ["retention"] : []),
      "primaryFailure",
      "outcome",
      "summarySha256",
      "history",
    ]) ||
    operation.kind !== "runtime_repair" ||
    typeof operation.identityJson !== "string"
  )
    return false;
  try {
    const identity = JSON.parse(operation.identityJson);
    if (
      !hasRuntimeStateRecordKeys(identity, [
        "schema",
        "kind",
        "operationNonce",
        "operationId",
        "repositoryBinding",
        "consumer",
      ]) ||
      identity.schema !== "crdd-coordinator/runtime-repair-identity/v2" ||
      identity.kind !== operation.kind ||
      identity.repositoryBinding !== repositoryBinding ||
      !isSha256Hex(identity.operationNonce) ||
      typeof identity.operationId !== "string" ||
      !/^OP-[0-9]{6,}$/u.test(identity.operationId) ||
      identity.consumer !== "coordinator_cli" ||
      `${JSON.stringify(identity)}\n` !== operation.identityJson
    )
      return false;
    const hash = createHash("sha256")
      .update(operation.identityJson, "utf8")
      .digest("hex");
    if (
      operation.identitySha256 !== hash ||
      operation.recoveryId !==
        `docker-runtime-repair.${identity.operationNonce}.${hash}` ||
      ![
        "repairing",
        "settling",
        "awaiting_disposition",
        "awaiting_delivery",
      ].includes(operation.phase) ||
      ![
        "not_applicable",
        "pending_human_decision",
        "retained_by_human_decision",
        "discard",
      ].includes(operation.disposition)
    )
      return false;
    const checkpoint =
      operation.checkpoint === null
        ? null
        : decodeDockerRuntimeRepairCheckpoint(operation.checkpoint);
    if (operation.checkpoint !== null && !checkpoint) return false;
    if (
      Object.hasOwn(operation, "retention") &&
      (!validCoordinatorRepairRetentionReceipt(operation.retention) ||
        operation.disposition !== "retained_by_human_decision" ||
        operation.phase !== "settling" ||
        operation.disposal !== null ||
        operation.outcome?.status !== "recovered" ||
        operation.primaryFailure !== null ||
        !checkpoint ||
        !coordinatorRepairRetentionMatchesCheckpoint(
          operation.retention,
          checkpoint,
        ))
    )
      return false;
    if (
      (checkpoint?.stale === "retained") !==
      (operation.disposition !== "not_applicable")
    )
      return false;
    if ((operation.disposition === "discard") !== (operation.disposal !== null))
      return false;
    if (operation.disposal !== null) {
      const disposal = operation.disposal;
      if (
        !hasRuntimeStateRecordKeys(disposal, ["decidedAt", "checkpoint"]) ||
        typeof disposal.decidedAt !== "string" ||
        !Number.isFinite(Date.parse(disposal.decidedAt)) ||
        new Date(disposal.decidedAt).toISOString() !== disposal.decidedAt ||
        !decodeDockerRuntimeRepairDisposalCheckpoint(disposal.checkpoint) ||
        (!dockerRuntimeRepairDisposalIsSettled(disposal.checkpoint) &&
          (operation.summarySha256 !== null || operation.history !== null)) ||
        operation.phase !== "settling" ||
        operation.outcome?.status !== "recovered" ||
        operation.primaryFailure !== null ||
        checkpoint?.stale !== "retained"
      )
        return false;
    }
    const failure = operation.primaryFailure;
    if (
      failure !== null &&
      (!hasRuntimeStateRecordKeys(failure, ["stage", "reason"]) ||
        !["preparation", "checkpoint", "repair", "delivery"].includes(
          failure.stage,
        ) ||
        !repairReasons.has(failure.reason) ||
        failure.reason === "runtime_repair_recovered")
    )
      return false;
    const outcome = operation.outcome;
    if (outcome !== null) {
      if (
        !hasRuntimeStateRecordKeys(outcome, [
          "status",
          "reason",
          "cleanupConfirmed",
        ]) ||
        !["recovered", "blocked", "cancelled"].includes(outcome.status) ||
        !repairReasons.has(outcome.reason) ||
        typeof outcome.cleanupConfirmed !== "boolean"
      )
        return false;
      if (
        (outcome.status === "recovered") !==
          (outcome.reason === "runtime_repair_recovered") ||
        (outcome.status === "cancelled") !==
          (outcome.reason === "runtime_repair_cancelled")
      )
        return false;
      if (
        outcome.cleanupConfirmed !==
        (checkpoint === null ||
          checkpoint.cleanup === "confirmed" ||
          checkpoint.cleanup === "not_requested")
      )
        return false;
      if (
        outcome.status === "recovered" &&
        (checkpoint?.engine !== "ready" ||
          checkpoint.hostSafety !== "safe" ||
          checkpoint.stale === "unknown" ||
          checkpoint.cleanup !== "confirmed" ||
          checkpoint.cleanupFailure !== null ||
          failure !== null ||
          !dockerRuntimeRepairCheckpointIsSettled(checkpoint))
      )
        return false;
    }
    if (operation.phase === "repairing" ? outcome !== null : outcome === null)
      return false;
    if (
      operation.phase === "awaiting_disposition" &&
      (outcome?.status !== "recovered" ||
        operation.disposition !== "pending_human_decision")
    )
      return false;
    if (
      operation.phase === "awaiting_delivery" &&
      (!outcome?.cleanupConfirmed ||
        (checkpoint !== null && checkpoint.hostSafety !== "safe") ||
        operation.disposition === "pending_human_decision")
    )
      return false;
    if ((operation.summarySha256 === null) !== (operation.history === null))
      return false;
    if (operation.history === null) return true;
    const history = operation.history;
    return (
      coordinatorRepairCanSummarize(operation) &&
      hasRuntimeStateRecordKeys(history, [
        "occurredAt",
        "lineSha256",
        "confirmed",
      ]) &&
      typeof history.occurredAt === "string" &&
      Number.isFinite(Date.parse(history.occurredAt)) &&
      new Date(history.occurredAt).toISOString() === history.occurredAt &&
      (operation.retention === undefined ||
        history.occurredAt === operation.retention.decidedAt) &&
      typeof history.confirmed === "boolean" &&
      isSha256Hex(history.lineSha256) &&
      createHash("sha256")
        .update(coordinatorRepairSummaryBytes(operation))
        .digest("hex") === operation.summarySha256 &&
      createHash("sha256")
        .update(
          coordinatorRepairHistoryLineBytes(operation, history.occurredAt),
        )
        .digest("hex") === history.lineSha256
    );
  } catch {
    return false;
  }
}

/**
 * 検査済みvariantの共通操作世代を取り出す。
 * @responsibility Task専用回復ID parserへ修復IDを渡さない。
 * @trace ARCH-000008
 * @input operation: 検査済みの一操作。
 * @returns 不変Identityに保存した64hex世代。
 * @precondition operationは現在codecが検査済み。
 * @postcondition 返却値からAuthorityを生成しない。
 * @effect N/A: 局所JSONの読取りのみ。
 * @failure 不正JSONは外側codecへ例外を返す。
 * @invariant 異なるvariantで同じ世代を重複させない。
 * @boundary 現在操作の相関と順序。
 * @security 任意PathやHomeを参照しない。
 * @concurrency N/A: 同期値読取り。
 */
export function coordinatorOperationNonce(
  operation: CoordinatorStateOperation,
): string {
  return JSON.parse(operation.identityJson).operationNonce;
}

/**
 * Docker Task 回復 Idを構造化値へ解析する。
 *
 * @responsibility Docker Task 回復 Idの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns parseDockerTaskRecoveryIdの計算結果を返す。
 * @precondition 「token: unknown」がparseDockerTaskRecoveryIdの入力契約を満たす。
 * @postcondition parseDockerTaskRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerTaskRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDockerTaskRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant parseDockerTaskRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDockerTaskRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security parseDockerTaskRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerTaskRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function parseDockerTaskRecoveryId(token: unknown) {
  if (typeof token !== "string") return null;
  const match = DOCKER_TASK_RECOVERY_ID.exec(token);
  return match?.[1] && match[2] && match[3]
    ? Object.freeze({
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      })
    : null;
}

/**
 * 現在状態の操作IdentityをRepository結合と照合する。
 * @responsibility 旧RuntimeState証明を受け入れず、操作・Home・Host・予定資源の閉じた相関を検査する。
 * @trace ARCH-000008
 * @input value: 保存されたIdentity、nonce: 操作世代、repositoryBinding: 現在Repository結合。
 * @returns 必須項目と相関がすべて成立した場合だけtrue。
 * @precondition Repository結合は外側Snapshotの検証済み入力である。
 * @postcondition 旧形式や追加項目を新Identityとして解釈しない。
 * @effect N/A: 入力の同期検査のみ。
 * @failure 不正な形式・結合・Host相関をfalseとして返す。
 * @invariant Home・Hostの証明をRepository Hashで代替しない。
 * @boundary 保存形式と同一Process内の検査境界。
 * @security 保存Pathは処置許可を付与しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function validateCoordinatorOperationIdentity(
  value: unknown,
  nonce: string,
  repositoryBinding: string,
): boolean {
  const identity = value as Record<string, unknown>;
  const keys = [
    "schema",
    "operationNonce",
    "provider",
    "consumer",
    "operationId",
    "grantRef",
    "executionSelection",
    "taskAttempt",
    "stableLogicalHomeBindingHash",
    "providerHomeIdentityHash",
    "repositoryBinding",
    "ownershipLabel",
    "operationMode",
    "workspaceMountMode",
    ...(Object.hasOwn(identity, "workspaceProtected")
      ? ["workspaceProtected"]
      : []),
    ...(Object.hasOwn(identity, "workspaceProtection")
      ? ["workspaceProtection"]
      : []),
    "initialHostRecoveryId",
    "initialHostRecovery",
    "hostPaths",
  ];
  const hasCorrelation = Object.hasOwn(identity ?? {}, "recoveryCorrelationId");
  if (
    !hasRuntimeStateRecordKeys(
      value,
      hasCorrelation ? [...keys, "recoveryCorrelationId"] : keys,
    )
  )
    return false;
  const token = identity.initialHostRecoveryId;
  if (typeof token !== "string") return false;
  try {
    parseHostRecoveryToken(token);
  } catch {
    return false;
  }
  return (
    identity.schema === OPERATION_IDENTITY_SCHEMA &&
    coordinatorConsumerCompletionPolicy(identity.consumer) !== null &&
    identity.operationNonce === nonce &&
    identity.repositoryBinding === repositoryBinding &&
    isSha256Hex(identity.repositoryBinding) &&
    (identity.provider === "codex" || identity.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(String(identity.operationId ?? "")) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(String(identity.grantRef ?? "")) &&
    inspectExecutionSelection(identity.executionSelection)?.provider ===
      identity.provider &&
    (identity.taskAttempt === 0 || identity.taskAttempt === 1) &&
    [
      identity.stableLogicalHomeBindingHash,
      identity.providerHomeIdentityHash,
    ].every(isSha256Hex) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
      String(identity.ownershipLabel ?? ""),
    ) &&
    ["boolean_probe", "isolated_task", "workbench_advice"].includes(
      String(identity.operationMode),
    ) &&
    (identity.workspaceMountMode === null ||
      identity.workspaceMountMode === "read_only" ||
      identity.workspaceMountMode === "read_write") &&
    (!Object.hasOwn(identity, "workspaceProtected") ||
      (identity.workspaceProtected === true &&
        identity.operationMode === "isolated_task" &&
        identity.workspaceMountMode !== null &&
        hasRuntimeStateRecordKeys(identity.workspaceProtection, [
          "gitSourcePath",
          "internalSourcePath",
        ]) &&
        Object.values(
          identity.workspaceProtection as Record<string, unknown>,
        ).every(
          (item) => typeof item === "string" && !/[\0\r\n,]/u.test(item),
        ))) &&
    (!Object.hasOwn(identity, "workspaceProtection") ||
      identity.workspaceProtected === true) &&
    (!hasCorrelation ||
      (typeof identity.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          identity.recoveryCorrelationId,
        ))) &&
    validateHostSnapshot(identity.initialHostRecovery, token) &&
    hasRuntimeStateRecordKeys(identity.hostPaths, ["root", "marker"]) &&
    typeof (identity.hostPaths as Record<string, unknown>).root === "string" &&
    typeof (identity.hostPaths as Record<string, unknown>).marker === "string"
  );
}

/**
 * 再起動checkpointの閉じた許容組合せを復号する。
 * @responsibility 未評価field・hostile値・偽の完了を拒否する。
 * @trace ARCH-000008
 * @input value: 未信頼の保存候補。
 * @returns 所有する固定Snapshot、またはnull。
 * @precondition N/A: 任意値を受け取り安全に拒否する。
 * @postcondition completedは要求と回収の両confirmedの場合だけ返す。
 * @effect N/A: 値の観測だけ。
 * @failure 欠落・余剰・accessor・Proxy・不正組合せはnull。
 * @invariant cleanup不要と確認を区別する。
 * @boundary 未信頼値と保存モデル。
 * @security getterやProxyの処理を実行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function decodeDockerRestartCheckpoint(
  value: unknown,
): DockerRestartCheckpoint | null {
  const record = snapshotPlainRecord(
    value,
    new Set(["requestId", "scopeSha256", "request", "cleanup", "result"]),
  );
  if (
    !record ||
    !recoveryIsSha256Hex(record.requestId) ||
    !recoveryIsSha256Hex(record.scopeSha256) ||
    !["not_issued", "unknown", "issued", "confirmed"].includes(
      record.request as string,
    ) ||
    !["not_required", "pending", "confirmed", "unknown"].includes(
      record.cleanup as string,
    )
  )
    return null;
  const result =
    record.result === null
      ? null
      : snapshotPlainRecord(
          record.result,
          new Set(["status", "reason", "request", "effectOutcomeUnknown"]),
        );
  if (
    record.result !== null &&
    (!result ||
      !["completed", "blocked"].includes(result.status as string) ||
      !["not_issued", "unknown", "issued", "confirmed"].includes(
        result.request as string,
      ) ||
      typeof result.effectOutcomeUnknown !== "boolean" ||
      typeof result.reason !== "string" ||
      !/^[a-z][a-z0-9_]{0,159}$/u.test(result.reason))
  )
    return null;
  if (
    (record.request === "not_issued") !== (record.cleanup === "not_required") ||
    (result?.status === "completed" &&
      (record.request !== "confirmed" ||
        record.cleanup !== "confirmed" ||
        result.request !== "confirmed" ||
        result.effectOutcomeUnknown !== false)) ||
    (result?.request === "not_issued" &&
      ["issued", "confirmed"].includes(record.request as string)) ||
    (record.request === "not_issued" &&
      result !== null &&
      (result.request !== "not_issued" ||
        result.effectOutcomeUnknown !== false)) ||
    (record.cleanup === "unknown" && result?.status !== "blocked")
  )
    return null;
  return Object.freeze({
    requestId: record.requestId,
    scopeSha256: record.scopeSha256,
    request: record.request,
    cleanup: record.cleanup,
    result: result ? Object.freeze({ ...result }) : null,
  }) as DockerRestartCheckpoint;
}

/**
 * 元操作と採用Scopeから再起動要求の相関Hashを再計算する。
 * @responsibility 任意64hexを同じ要求の根拠として受理しない。
 * @trace ARCH-000008
 * @input repositoryBinding、identitySha256、recoveryId、scopeSha256: 固定非秘密相関。
 * @returns 固定envelopeのSHA-256、または不正結合のnull。
 * @precondition Scopeは現在Ownerが確認した対象と既存fenceに結合する。
 * @postcondition exact回復IDの元内容Hashと一致する場合だけ相関値を返す。
 * @effect N/A: Hash計算だけ。
 * @failure 不正Hash・別Identity・不正回復参照はnull。
 * @invariant Hashは現在許可・排他・実結果の証明ではない。
 * @boundary 保存相関値の生成。
 * @security 秘密値・Path・Promptをenvelopeへ追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function createDockerRestartRequestId(
  repositoryBinding: unknown,
  identitySha256: unknown,
  recoveryId: unknown,
  scopeSha256: unknown,
): string | null {
  const recovery = parseDockerTaskRecoveryId(recoveryId);
  if (
    !recoveryIsSha256Hex(repositoryBinding) ||
    !recoveryIsSha256Hex(identitySha256) ||
    !recoveryIsSha256Hex(scopeSha256) ||
    !recovery ||
    recovery.baseHash !== identitySha256
  )
    return null;
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: "crdd-coordinator/docker-restart-request/v1",
        purpose: "docker_restart",
        repositoryBinding,
        identitySha256,
        recoveryId,
        scopeSha256,
      }),
      "utf8",
    )
    .digest("hex");
}

/**
 * 再起動の残存義務がTaskの終了を妨げるかを同じ条件で判定する。
 * @responsibility 履歴Readerと終端Writerの許容形を一つの純粋判定に固定する。
 * @trace ARCH-000008
 * @input value: 未信頼の再起動checkpointまたは記録なしのnull。
 * @returns 記録なし、未要求、確定再起動、確定未発行、発行済み既知失敗の終了形だけtrue。
 * @precondition 実Owner・資源・排他・Host不存在は利用側が別に確認する。
 * @postcondition blockedを再起動成功やTask成功へ変換しない。
 * @effect N/A: 値の復号と比較だけ。
 * @failure 欠測・旧形式・矛盾・Effect不明・回収不明はfalse。
 * @invariant 上位unknownをnot_issuedへ巻き戻さず、再要求を許可しない。
 * @boundary 保存モデルと終端利用側。
 * @security 保存値だけから処置Authorityを発行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function isDockerRestartCheckpointSettled(value: unknown): boolean {
  if (value === null) return true;
  const checkpoint = decodeDockerRestartCheckpoint(value);
  if (!checkpoint) return false;
  if (
    checkpoint.request === "not_issued" &&
    checkpoint.cleanup === "not_required" &&
    checkpoint.result === null
  )
    return true;
  if (
    checkpoint.cleanup !== "confirmed" ||
    checkpoint.result === null ||
    checkpoint.result.effectOutcomeUnknown !== false
  )
    return false;
  return (
    (checkpoint.request === "confirmed" &&
      checkpoint.result.request === "confirmed") ||
    (checkpoint.request === "unknown" &&
      checkpoint.result.status === "blocked" &&
      checkpoint.result.request === "not_issued") ||
    (checkpoint.request === "issued" &&
      checkpoint.result.status === "blocked" &&
      checkpoint.result.request === "issued")
  );
}

export const purposeResource = Object.freeze({
  create_egress_network: "egress",
  create_internal_network: "internal",
  create_provider: "provider",
  create_proxy: "proxy",
  create_subscription_auth_probe: "auth",
} as const);

/**
 * Host 回復 Tokenを構造化値へ解析する。
 *
 * @responsibility Host 回復 Tokenの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns parseHostRecoveryTokenの計算結果を返す。
 * @precondition 「token: unknown」がparseHostRecoveryTokenの入力契約を満たす。
 * @postcondition parseHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: parseHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseHostRecoveryTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security parseHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function parseHostRecoveryToken(token: unknown) {
  if (typeof token !== "string") throw new Error("host_recovery_token_invalid");
  const match =
    /^host\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(
      token ?? "",
    );
  if (!match) throw new Error("host_recovery_token_invalid");
  const rootName = match[1];
  const nonce = match[2];
  const recordHash = match[3];
  if (!rootName || !nonce || !recordHash)
    throw new Error("host_recovery_token_invalid");
  return { rootName, nonce, recordHash };
}

/**
 * Host記録の状態遷移相関の契約を検証する。
 *
 * @responsibility Host記録の状態遷移相関の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、requiredNextState: string
 * @returns validateHostRecoveryTransitionLineageの計算結果を返す。
 * @precondition 「value: unknown、requiredNextState: string」がvalidateHostRecoveryTransitionLineageの入力契約を満たす。
 * @postcondition validateHostRecoveryTransitionLineageの責務を完了した結果だけを返す。
 * @effect N/A: validateHostRecoveryTransitionLineageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateHostRecoveryTransitionLineageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateHostRecoveryTransitionLineageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateHostRecoveryTransitionLineageはProcess内の同一Subsystemで完結する。
 * @security validateHostRecoveryTransitionLineageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateHostRecoveryTransitionLineageは共有非同期状態を持たない同期処理である。
 */
export function validateHostRecoveryTransitionLineage(
  value: unknown,
  requiredNextState?: string,
) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const intent = value as Record<string, unknown>;
  const currentToken = String(intent.currentToken ?? "");
  const expectedToken = String(intent.expectedToken ?? "");
  const current = parseHostRecoveryToken(currentToken);
  const expected = parseHostRecoveryToken(expectedToken);
  const recordBefore = intent.recordBefore;
  if (
    !recordBefore ||
    typeof recordBefore !== "object" ||
    Array.isArray(recordBefore) ||
    Object.getPrototypeOf(recordBefore) !== Object.prototype ||
    current.rootName !== intent.rootName ||
    expected.rootName !== intent.rootName ||
    current.nonce !== intent.nonce ||
    expected.nonce !== intent.nonce ||
    (requiredNextState !== undefined &&
      intent.nextState !== requiredNextState) ||
    typeof intent.currentState !== "string" ||
    typeof intent.nextState !== "string" ||
    intent.currentToken === intent.expectedToken
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const before = recordBefore as Record<string, unknown>;
  const beforeHash = createHash("sha256")
    .update(canonicalHostRecoveryTransitionRecord(before))
    .digest("hex");
  const successor = Object.freeze({ ...before, state: intent.nextState });
  const successorHash = createHash("sha256")
    .update(canonicalHostRecoveryTransitionRecord(successor))
    .digest("hex");
  if (
    current.recordHash !== beforeHash ||
    expected.recordHash !== successorHash ||
    before.state !== intent.currentState ||
    successor.state !== intent.nextState
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  return Object.freeze({ currentToken, expectedToken, current, expected });
}

/**
 * 一次失敗の固定分類を現在状態と履歴で共用する。
 * @responsibility 失敗の相関と許可分類を一つの値検査で維持する。
 * @trace ARCH-000008
 * @input value: JSONから得た一次失敗またはnull。
 * @returns 固定契約に適合する場合だけtrue。
 * @precondition Proxyやaccessorは上位のJSON境界で除外済み。
 * @postcondition 未知分類やreceiptだけの成功を拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure 不正shapeと分類はfalse。
 * @invariant 一次失敗を清掃結果で上書きしない。
 * @boundary 保存JSONの共通検証。
 * @security 自由な例外本文やPathを許可しない。
 * @concurrency N/A: 同期処理だけ。
 */
export function validCoordinatorPrimaryFailure(value: unknown): boolean {
  if (value === null) return true;
  // 既存診断にない観測値を0で補わず、追加された場合だけ閉じて検査する。
  const hasObservation =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "commandObservation");
  const hasAuthenticationStatus =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "authenticationStatus");
  const hasTurnCountDiagnostic =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "turnCountDiagnostic");
  if (
    !hasRuntimeStateRecordKeys(value, [
      "purpose",
      "stage",
      "reason",
      "exceptionCode",
      "commandHandleObtained",
      "responseObserved",
      "receiptRecorded",
      ...(hasObservation ? ["commandObservation"] : []),
      ...(hasAuthenticationStatus ? ["authenticationStatus"] : []),
      ...(hasTurnCountDiagnostic ? ["turnCountDiagnostic"] : []),
    ])
  )
    return false;
  const failure = value as NonNullable<
    CoordinatorStateTaskOperation["primaryFailure"]
  >;
  return (
    (failure.purpose === null || commandPurposes.includes(failure.purpose)) &&
    failureStages.includes(failure.stage) &&
    finalReasons.has(failure.reason) &&
    (failure.exceptionCode === null ||
      [
        "ENOENT",
        "EACCES",
        "EPERM",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "EPIPE",
        "unclassified_exception",
      ].includes(failure.exceptionCode) ||
      /^docker_effect_(management_required|plan_invalid|plan_replaced|command_not_owned|platform_unsupported|cli_untrusted|cli_replaced|path_invalid|config_invalid|config_replaced|filesystem_identity_invalid)$/u.test(
        failure.exceptionCode,
      ) ||
      /^owned_operation_(management_binding_required|unknown_child|child_replaced|mount_replaced)$/u.test(
        failure.exceptionCode,
      )) &&
    [
      failure.commandHandleObtained,
      failure.responseObserved,
      failure.receiptRecorded,
    ].every((isObservedFlag) => typeof isObservedFlag === "boolean") &&
    (!failure.receiptRecorded || failure.responseObserved) &&
    (!hasAuthenticationStatus ||
      (failure.purpose === "start_subscription_auth_probe_attached" &&
        ["execution_classification", "subscription_auth_verification"].includes(
          failure.stage,
        ) &&
        failure.responseObserved &&
        failure.commandObservation != null &&
        failure.commandObservation.exitCode !== null &&
        ["confirmed", "unconfirmed", "unknown"].includes(
          failure.authenticationStatus ?? "",
        ))) &&
    (!hasTurnCountDiagnostic ||
      (failure.purpose === "start_provider_attached" &&
        failure.stage === "provider_result_normalization" &&
        failure.reason === "workbench_ai_claude_turn_count_invalid" &&
        failure.responseObserved &&
        failure.commandObservation?.exitCode === 0 &&
        hasRuntimeStateRecordKeys(failure.turnCountDiagnostic, [
          "valueType",
          "numberText",
        ]) &&
        [
          "missing",
          "null",
          "boolean",
          "number",
          "string",
          "array",
          "object",
        ].includes(failure.turnCountDiagnostic?.valueType ?? "") &&
        (failure.turnCountDiagnostic?.numberText === null ||
          (failure.turnCountDiagnostic?.valueType === "number" &&
            typeof failure.turnCountDiagnostic.numberText === "string" &&
            failure.turnCountDiagnostic.numberText.length <= 32 &&
            Number.isFinite(Number(failure.turnCountDiagnostic.numberText)) &&
            String(Number(failure.turnCountDiagnostic.numberText)) ===
              failure.turnCountDiagnostic.numberText &&
            (!Number.isInteger(
              Number(failure.turnCountDiagnostic.numberText),
            ) ||
              Number(failure.turnCountDiagnostic.numberText) < 1 ||
              Number(failure.turnCountDiagnostic.numberText) > 2))))) &&
    (!hasObservation ||
      failure.commandObservation === null ||
      (failure.responseObserved &&
        hasRuntimeStateRecordKeys(failure.commandObservation, [
          "exitCode",
          "stdoutBytes",
          "stderrBytes",
        ]) &&
        (failure.commandObservation?.exitCode === null ||
          (Number.isSafeInteger(failure.commandObservation?.exitCode) &&
            Number(failure.commandObservation?.exitCode) >= 0)) &&
        [
          failure.commandObservation?.stdoutBytes,
          failure.commandObservation?.stderrBytes,
        ].every((v) => Number.isSafeInteger(v) && Number(v) >= 0)))
  );
}

/**
 * 最終結果の相関を現在状態と履歴で共用する。
 * @responsibility 状態、固定理由、清掃評価の組合せを維持する。
 * @trace ARCH-000008
 * @input value: JSONから得た最終結果またはnull。
 * @returns 固定契約に適合する場合だけtrue。
 * @precondition JSON値境界で検査する。
 * @postcondition 成功・取消理由と状態の不一致を拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure 不正shapeと相関はfalse。
 * @invariant 清掃評価を状態だけから推定しない。
 * @boundary 保存JSONの共通検証。
 * @security 固定理由以外の本文を許可しない。
 * @concurrency N/A: 同期処理だけ。
 */
export function validCoordinatorOutcome(value: unknown): boolean {
  if (value === null) return true;
  if (
    !hasRuntimeStateRecordKeys(value, ["status", "reason", "cleanupConfirmed"])
  )
    return false;
  const outcome = value as NonNullable<
    CoordinatorStateTaskOperation["outcome"]
  >;
  return (
    typeof outcome.cleanupConfirmed === "boolean" &&
    finalReasons.has(outcome.reason) &&
    (outcome.status === "completed"
      ? outcome.reason === "provider_operation_completed"
      : outcome.status === "cancelled"
        ? outcome.reason === "provider_operation_cancelled"
        : outcome.status === "blocked" &&
          ![
            "provider_operation_completed",
            "provider_operation_cancelled",
          ].includes(outcome.reason))
  );
}

/**
 * 通常終端または専用認証unknown終了の全五資源を共同評価する。
 * @responsibility 後続利用側が資源一値だけから限定終了を推定しないようにする。
 * @trace ARCH-000008
 * @input operation: 現在Decoderで構造と相関を確認したTask。
 * @returns 通常終端、または専用相関付きauth不存在を含む全終端ならtrue。
 * @precondition 保存の真正性と物理観測は各Ownerが確認する。
 * @postcondition Task成功・配送・Host清掃を単独で確定しない。
 * @effect N/A: 同期値判定だけ。
 * @failure 未終端・専用Hash差・限定条件差はfalse。
 * @invariant auth request unknownをidentifiedや未発行へ変更しない。
 * @boundary 保存モデルとHost・履歴・配送・次受付の共同条件。
 * @security 専用Writerを迂回する保存は別の物理Guardで拒否する。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorTaskResourcesAreSettled(
  operation: CoordinatorStateTaskOperation,
): boolean {
  const book = operation.resources;
  if (!book)
    return (
      operation.phase !== "executing" &&
      operation.execution.providerStart === "not_started" &&
      operation.execution.externalSend === "not_issued" &&
      operation.execution.sharedWrite === "not_issued" &&
      operation.execution.ownerEffect === "disabled" &&
      ((operation.outcome?.status === "blocked" &&
        operation.outcome.cleanupConfirmed) ||
        // 技術要求前の切断。Host回収・Lease解放・最終結果は別のOwnerが確定する。
        (operation.resources === null &&
          operation.phase === "settling" &&
          operation.lease === "held" &&
          operation.outcome === null &&
          operation.primaryFailure === null &&
          operation.summarySha256 === null &&
          operation.history === null &&
          isDockerRestartCheckpointSettled(operation.dockerRestart)))
    );
  if (book.checkpoints.every(coordinatorResourceIsSettled)) return true;
  const hash = coordinatorAuthenticationClosureEvidence(operation);
  return (
    hash !== null &&
    book.checkpoints.every(
      (resource) =>
        coordinatorResourceIsSettled(resource) ||
        (resource.key === "create_subscription_auth_probe" &&
          resource.observation === "absent" &&
          resource.absenceEvidenceSha256 === hash &&
          book.snapshot.resources.find((r) => r.key === resource.key)?.identity
            .dockerId === null),
    )
  );
}

/**
 * 保持引渡しの時刻と閉じた三用途値を検査する。
 * @responsibility 期限欠測・時刻補完・Node検査の独自再定義を拒否する。
 * @trace ARCH-000008
 * @input value: JSON境界を通ったreceipt候補。
 * @returns 正規時刻・exact7日・少なくとも一保持実体がある場合だけtrue。
 * @precondition 元checkpoint相関・実観測は別に確認する。
 * @postcondition 現在時計や期限超過から値を変更しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 不正形・日付範囲外・差1ms・三用途不正はfalse。
 * @invariant 時刻は処置Authorityや保存確定の証明ではない。
 * @boundary 条件付きreceiptの保存Schema。
 * @security Path・余剰fieldを受理しない。
 * @concurrency N/A: 入力を変更しない。
 */
export function validCoordinatorRepairRetentionReceipt(
  value: unknown,
): value is CoordinatorRepairRetentionReceipt {
  if (
    !hasRuntimeStateRecordKeys(value, ["decidedAt", "reviewAfter", "targets"])
  )
    return false;
  const receipt = value as CoordinatorRepairRetentionReceipt;
  if (
    typeof receipt.decidedAt !== "string" ||
    typeof receipt.reviewAfter !== "string"
  )
    return false;
  const time = Date.parse(receipt.decidedAt);
  const review = Date.parse(receipt.reviewAfter);
  const targets = decodeDockerRuntimeRepairRetentionTargets(receipt.targets);
  return (
    Number.isFinite(time) &&
    Number.isFinite(review) &&
    review - time === 604800000 &&
    new Date(time).toISOString() === receipt.decidedAt &&
    new Date(review).toISOString() === receipt.reviewAfter &&
    targets !== null &&
    Object.values(targets).some((target) => target !== null)
  );
}

/**
 * 保持receiptを元修復の用途別実体と再照合する。
 * @responsibility present消失・用途交換・保持不要の過剰拒否を防ぐ。
 * @trace ARCH-000008
 * @input receipt: 検査済み保持値、checkpoint: 実decoderを通った元技術値。
 * @returns 三用途が対応actionと実体へ正確に投影される場合だけtrue。
 * @precondition fresh読取りと明示保持は上位が別に確認する。
 * @postcondition expected非nullの正規absentを受理する。
 * @effect N/A: 値比較のみ。
 * @failure 不明・実体差・action不一致はfalse。
 * @invariant 元presentを用途内nullへ丸めない。
 * @boundary 技術checkpointと保持引渡し候補。
 * @security 一致を実保存・削除許可にしない。
 * @concurrency N/A: 同期比較。
 */
export function coordinatorRepairRetentionMatchesCheckpoint(
  receipt: CoordinatorRepairRetentionReceipt,
  checkpoint: DockerRuntimeRepairCheckpoint,
): boolean {
  return (["primary", "failed", "auxiliary"] as const).every((purpose) => {
    const pair = checkpoint.directories[purpose];
    const action =
      checkpoint.actions[
        purpose === "primary"
          ? "retain_runtime"
          : purpose === "failed"
            ? "retain_failed_runtime"
            : "retain_auxiliary_runtime"
      ];
    const target = receipt.targets[purpose];
    return pair.retained.state === "present"
      ? action.intent === "saved" &&
          action.request === "issued" &&
          action.result === "confirmed" &&
          pair.expected !== null &&
          target !== null &&
          encodeRuntimeStateValue(pair.expected) ===
            encodeRuntimeStateValue(pair.retained.identity) &&
          encodeRuntimeStateValue(target) ===
            encodeRuntimeStateValue(pair.expected)
      : pair.retained.state === "absent" &&
          action.request === "not_issued" &&
          action.result === "not_required" &&
          target === null;
  });
}

export const repairReasons = new Set([
  "runtime_repair_recovered",
  "runtime_repair_failed_closed",
  "runtime_repair_boundary_unavailable",
  "runtime_repair_state_unavailable",
  "runtime_repair_observation_unknown",
  "runtime_repair_effect_unknown",
  "runtime_repair_cancelled",
  "runtime_repair_cleanup_unknown",
]);

/**
 * 修復の終了要約へ進める共同条件を検査する。
 * @responsibility 保存値の終端条件をTask条件と分離する。
 * @trace ARCH-000008
 * @input operation: 復号済み修復。
 * @returns 成功終端または回収結果まで確定した失敗Snapshotだけtrue。
 * @precondition Identityとcheckpointは外側codecで確認する。
 * @postcondition 実行中・回収待ちを固定せず、失敗のunknown・判断待ちは維持する。
 * @effect N/A: 値の検査のみ。
 * @failure 共同条件の欠測・不一致はfalse。
 * @invariant trueは現在の実資源観測や引渡しの証明ではない。
 * @boundary 修復状態と非Authorityの終了要約。
 * @security 技術処置を許可しない。
 * @concurrency N/A: 同期処理。
 */
export function coordinatorRepairCanSummarize(
  operation: CoordinatorStateRepairOperation,
): boolean {
  if (
    operation.phase === "settling" &&
    operation.disposition !== "pending_human_decision" &&
    operation.checkpoint !== null &&
    ["confirmed", "unknown"].includes(operation.checkpoint.cleanup) &&
    (operation.outcome?.status === "blocked" ||
      operation.outcome?.status === "cancelled")
  )
    return validCoordinatorRepairSummary(
      JSON.parse(coordinatorRepairSummaryBytes(operation).toString("utf8")),
    );
  return (
    operation.phase === "settling" &&
    operation.outcome?.status === "recovered" &&
    operation.outcome.cleanupConfirmed &&
    operation.primaryFailure === null &&
    operation.disposition !== "pending_human_decision" &&
    (operation.disposition !== "discard" ||
      (operation.disposal !== null &&
        dockerRuntimeRepairDisposalIsSettled(operation.disposal.checkpoint))) &&
    operation.checkpoint?.engine === "ready" &&
    operation.checkpoint.hostSafety === "safe" &&
    operation.checkpoint.cleanup === "confirmed" &&
    operation.checkpoint.cleanupFailure === null &&
    dockerRuntimeRepairCheckpointIsSettled(operation.checkpoint)
  );
}

/**
 * 修復checkpointから公開可能な終了要約だけを符号化する。
 * @responsibility 通常はDirectory実体を投影せず、明示保持receiptだけ非Authority Node実体を含める。Owner・Scope・Task fieldは投影しない。
 * @trace ARCH-000008
 * @input operation: 検証済みの終端修復。
 * @returns LF付きcanonical要約bytes。
 * @precondition 外側で共同終端を確認する。
 * @postcondition discardの判断時刻・進捗、handoffの固定期限・三用途実体を保持し、出版時刻・確認flag・Snapshot改訂を含めない。
 * @effect N/A: 値の符号化のみ。
 * @failure 不正な内部Identityは例外。
 * @invariant 要約から実行Authorityや保持物の実体を復元しない。
 * @boundary 保存済み技術値と履歴投影。
 * @security 生Path・秘密・生出力を含めない。
 * @concurrency N/A: 同期構築。
 */
export function coordinatorRepairSummaryBytes(
  operation: CoordinatorStateRepairOperation,
): Buffer {
  const identity = JSON.parse(operation.identityJson);
  const checkpoint = operation.checkpoint;
  if (!checkpoint) throw new Error("repair_checkpoint_missing");
  return Buffer.from(
    `${encodeRuntimeStateValue({
      schema: "crdd-coordinator/repair-summary/v1",
      operationId: identity.operationId,
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      identitySha256: operation.identitySha256,
      primaryFailure: operation.primaryFailure,
      outcome: operation.outcome,
      disposition: operation.disposition,
      ...(operation.retention !== undefined
        ? { retention: operation.retention }
        : {}),
      ...(operation.disposition === "discard"
        ? { disposal: operation.disposal }
        : {}),
      technical: {
        actions: checkpoint.actions,
        engine: checkpoint.engine,
        stale: checkpoint.stale,
        hostSafety: checkpoint.hostSafety,
        cleanup: checkpoint.cleanup,
        cleanupFailure: checkpoint.cleanupFailure,
      },
    })}\n`,
  );
}

/**
 * 修復の固定時刻を履歴行へ結合する。
 * @responsibility 要約Hashと時刻込み行Hashを区別する。
 * @trace ARCH-000008
 * @input operation: 終端修復、occurredAt: 最初の正規UTC時刻。
 * @returns LF付きcanonical履歴行。
 * @precondition 値と時刻は呼出し元で確認済み。
 * @postcondition confirmedを行へ含めない。
 * @effect N/A: メモリ内構築。
 * @failure 内部値の符号化不正は例外。
 * @invariant 再試行時刻で行を変えない。
 * @boundary 現在状態と履歴行。
 * @security 行はAuthorityではない。
 * @concurrency N/A: 保存を行わない。
 */
export function coordinatorRepairHistoryLineBytes(
  operation: CoordinatorStateRepairOperation,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeRuntimeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(
        coordinatorRepairSummaryBytes(operation).toString("utf8"),
      ),
    })}\n`,
  );
}
/**
 * Docker Task回復IDを技術的な相関成分へ解析する。
 * @responsibility 三成分の固定文法を検査し、解析結果から操作Authorityを発行しない。
 * @trace ARCH-000008
 */
export const DOCKER_TASK_RECOVERY_ID =
  /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u;

export const OPERATION_IDENTITY_SCHEMA =
  "crdd-coordinator/operation-identity/v4";

/**
 * Host Snapshotの契約を検証する。
 *
 * @responsibility Host Snapshotの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、initialToken: string
 * @returns validateHostSnapshotの計算結果を返す。
 * @precondition 「value: unknown、initialToken: string」がvalidateHostSnapshotの入力契約を満たす。
 * @postcondition validateHostSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: validateHostSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateHostSnapshotは独自の失敗分岐を所有しない。
 * @invariant validateHostSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateHostSnapshotはProcess内の同一Subsystemで完結する。
 * @security validateHostSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateHostSnapshotは共有非同期状態を持たない同期処理である。
 */
export function validateHostSnapshot(value: unknown, initialToken: string) {
  if (
    !hasRuntimeStateRecordKeys(value, [
      "token",
      "recordHash",
      "directoryIdentity",
      "markerIdentity",
      "record",
    ])
  )
    return false;
  const snapshot = value as Record<string, unknown>;
  const parsed = parseHostRecoveryToken(initialToken);
  const record = snapshot.record;
  const hostRecord = record as Record<string, unknown>;
  const rootIdentity = hostRecord?.rootIdentity;
  const childIdentities = hostRecord?.childIdentities;
  const identityValid = (identity: unknown, isChild: boolean) =>
    hasRuntimeStateRecordKeys(
      identity,
      isChild
        ? ["pathName", "dev", "ino", "birthtimeNs"]
        : ["dev", "ino", "birthtimeNs"],
    ) &&
    ["dev", "ino", "birthtimeNs"].every(
      (key) =>
        typeof (identity as Record<string, unknown>)[key] === "string" &&
        /^\d+$/u.test(String((identity as Record<string, unknown>)[key])),
    ) &&
    (!isChild ||
      (typeof (identity as Record<string, unknown>).pathName === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/u.test(
          String((identity as Record<string, unknown>).pathName),
        )));
  return (
    snapshot.token === initialToken &&
    snapshot.recordHash === parsed.recordHash &&
    typeof snapshot.directoryIdentity === "string" &&
    /^\d+:\d+:\d+$/u.test(snapshot.directoryIdentity) &&
    typeof snapshot.markerIdentity === "string" &&
    /^\d+:\d+:\d+$/u.test(snapshot.markerIdentity) &&
    hasRuntimeStateRecordKeys(record, [
      "schema",
      "state",
      "rootName",
      "rootIdentity",
      "childIdentities",
      "createdAt",
    ]) &&
    hostRecord.schema === "crdd-coordinator-host-recovery/v1" &&
    hostRecord.rootName === parsed.rootName &&
    ["host_only", "docker_submission_started"].includes(
      String(hostRecord.state),
    ) &&
    typeof hostRecord.createdAt === "string" &&
    identityValid(rootIdentity, false) &&
    childIdentities !== null &&
    typeof childIdentities === "object" &&
    !Array.isArray(childIdentities) &&
    Object.keys(childIdentities as Record<string, unknown>).length <= 8 &&
    Object.values(childIdentities as Record<string, unknown>).every(
      (identity) => identityValid(identity, true),
    ) &&
    Object.hasOwn(childIdentities as Record<string, unknown>, "management")
  );
}

/**
 * この保存モデルが受け取るSHA-256文字列を検査する。
 * @responsibility 一般Helperを公開せず、保存値の固定文法だけを検査する。
 * @trace ARCH-000008
 * @input value: 未信頼値。
 * @returns 小文字64桁hexの場合だけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態や外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 再起動要求相関の値検査だけ。
 * @security Hash文法の一致から処置許可や真正性を推定しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
export function recoveryIsSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * canonicalHostRecoveryTransitionRecordを決定する。
 *
 * @responsibility canonicalHostRecoveryTransitionRecordの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalHostRecoveryTransitionRecordの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalHostRecoveryTransitionRecordの入力契約を満たす。
 * @postcondition canonicalHostRecoveryTransitionRecordの責務を完了した結果だけを返す。
 * @effect N/A: canonicalHostRecoveryTransitionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalHostRecoveryTransitionRecordは独自の失敗分岐を所有しない。
 * @invariant canonicalHostRecoveryTransitionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalHostRecoveryTransitionRecordはProcess内の同一Subsystemで完結する。
 * @security canonicalHostRecoveryTransitionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalHostRecoveryTransitionRecordは共有非同期状態を持たない同期処理である。
 */
export function canonicalHostRecoveryTransitionRecord(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

export const commandPurposes = [
  ...Object.keys(purposeResource),
  "start_subscription_auth_probe_attached",
  "connect_proxy_egress",
  "start_proxy",
  "start_provider_attached",
];

export const failureStages = [
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

export const dockerProcessControllerPublicCompletionReasons = Object.freeze([
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

export const finalReasons = new Set<string>([
  ...dockerProcessControllerPublicCompletionReasons,
  "provider_operation_completed",
  "provider_operation_cancelled",
]);

/**
 * 復号済み資源の現在記録が既存の終了条件を満たすか判定する。
 * @responsibility 履歴・配送・操作除去・次操作で同じ資源終了条件を使用する。
 * @trace ARCH-000008
 * @input resource: 現在状態Decoderが構造と相関を確認した一資源。
 * @returns 未要求・未発行、または実ID確定後の不存在だけtrue。
 * @precondition resourceは復号済み現在操作に属する。
 * @postcondition 作成結果不明を不存在観測だけで終了可能へ変換しない。
 * @effect N/A: 同期値判定のみ。
 * @failure 未終了の要求・観測はfalse。
 * @invariant 実資源観測・保存許可を発行せず、cleanup更新入口の条件を変更しない。
 * @boundary 検証済み保存記録と終端可否の判定。
 * @security 記録の終了条件は処置Authorityや実不存在の証明ではない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorResourceIsSettled(
  resource: CoordinatorResourceBook["checkpoints"][number],
): boolean {
  return (
    resource.submission === "none" ||
    resource.submission === "not_issued" ||
    (resource.receiptSource !== null && resource.observation === "absent")
  );
}

/**
 * 専用不存在記録の再導出可能な相関Hashを生成する。
 * @responsibility 履歴本文を蓄積せず、同じIdentity・再起動・四観測へ結合する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderで確認済みのTask。
 * @returns 専用Hash、または限定条件不成立のnull。
 * @precondition 実観測と元版保証は専用Writerが別に所有する。
 * @postcondition 通常absenceのHash形式を変更しない。
 * @effect N/A: 同期Hash計算だけ。
 * @failure 不正Identity・限定条件不成立はnull。
 * @invariant 元版相関は既存CASへ委ね、過去本文を追加保持しない。
 * @boundary 専用記録と後続の共同終了判定。
 * @security Hashは観測の真正性やAuthorityを発行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorAuthenticationClosureEvidence(
  operation: CoordinatorStateTaskOperation,
): string | null {
  if (!coordinatorAuthenticationUnknownCanClose(operation)) return null;
  const identity = JSON.parse(operation.identityJson);
  const resource = operation.resources?.snapshot.resources.find(
    (item) => item.key === "create_subscription_auth_probe",
  );
  if (resource?.identity.kind !== "container" || !resource.identity.name)
    return null;
  return createHash("sha256")
    .update(
      encodeRuntimeStateValue({
        domain: "crdd-coordinator/authentication-unknown-absence/v1",
        identitySha256: operation.identitySha256,
        recoveryId: operation.recoveryId,
        purpose: "create_subscription_auth_probe",
        plannedResourceName: resource.identity.name,
        ownershipLabel: identity.ownershipLabel,
        dockerId: null,
        restart: operation.dockerRestart,
        observations: [
          { round: 1, name: "absent", name_label: "absent" },
          { round: 2, name: "absent", name_label: "absent" },
        ],
      }),
    )
    .digest("hex");
}

/**
 * 現在状態を使わず修復要約の閉集合を検査する。
 * @responsibility Taskと異なるID・結果・技術投影を単独で検証する。
 * @trace ARCH-000008
 * @input value: JSONから得た要約。
 * @returns 今回の有限な修復要約だけtrue。
 * @precondition 呼出し元がcanonical JSON境界を確認する。
 * @postcondition 成功へunknownを混ぜず、失敗の未知値は有限相関のまま保持する。
 * @effect N/A: 値検査のみ。
 * @failure 不正shape・相関はfalse。
 * @invariant 復号成功を実修復や保持物引渡しにしない。
 * @boundary 履歴の自己完結する投影契約。
 * @security Path・Owner・Scope・Task情報の混入を拒否する。
 * @concurrency N/A: 同期処理。
 */
export function validCoordinatorRepairSummary(value: unknown): boolean {
  const hasRetention =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "retention");
  const discard =
    value !== null &&
    typeof value === "object" &&
    (value as { disposition?: unknown }).disposition === "discard";
  if (
    !hasRuntimeStateRecordKeys(value, [
      "schema",
      "operationId",
      "operationNonce",
      "recoveryId",
      "identitySha256",
      "primaryFailure",
      "outcome",
      "disposition",
      "technical",
      ...(discard ? ["disposal"] : []),
      ...(hasRetention ? ["retention"] : []),
    ])
  )
    return false;
  const summary = value as {
    schema: unknown;
    operationId: unknown;
    operationNonce: unknown;
    recoveryId: unknown;
    identitySha256: unknown;
    primaryFailure: unknown;
    disposition: unknown;
    retention?: unknown;
    disposal?: {
      decidedAt: unknown;
      checkpoint: unknown;
    };
    outcome: { status: unknown; reason: unknown; cleanupConfirmed: unknown };
    technical: {
      actions: Record<
        string,
        { intent: unknown; request: unknown; result: unknown }
      >;
      engine: unknown;
      stale: unknown;
      hostSafety: unknown;
      cleanup: unknown;
      cleanupFailure: unknown;
    };
  };
  if (
    discard &&
    (!hasRuntimeStateRecordKeys(summary.disposal, [
      "decidedAt",
      "checkpoint",
    ]) ||
      typeof summary.disposal?.decidedAt !== "string" ||
      !Number.isFinite(Date.parse(summary.disposal.decidedAt)) ||
      new Date(summary.disposal.decidedAt).toISOString() !==
        summary.disposal.decidedAt ||
      !decodeDockerRuntimeRepairDisposalCheckpoint(
        summary.disposal.checkpoint,
      ) ||
      !dockerRuntimeRepairDisposalIsSettled(summary.disposal.checkpoint))
  )
    return false;
  const technical = summary.technical;
  if (
    hasRetention &&
    (!validCoordinatorRepairRetentionReceipt(summary.retention) ||
      summary.disposition !== "retained_by_human_decision" ||
      summary.outcome?.status !== "recovered" ||
      summary.primaryFailure !== null)
  )
    return false;
  const names = [
    "stop_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ];
  if (
    hasRuntimeStateRecordKeys(summary.outcome, [
      "status",
      "reason",
      "cleanupConfirmed",
    ]) &&
    (summary.outcome.status === "blocked" ||
      summary.outcome.status === "cancelled")
  ) {
    const failure = summary.primaryFailure as {
      stage: unknown;
      reason: unknown;
    } | null;
    return (
      summary.schema === "crdd-coordinator/repair-summary/v1" &&
      typeof summary.operationId === "string" &&
      /^OP-[0-9]{6,}$/u.test(summary.operationId) &&
      isSha256Hex(summary.operationNonce) &&
      isSha256Hex(summary.identitySha256) &&
      summary.recoveryId ===
        `docker-runtime-repair.${summary.operationNonce}.${summary.identitySha256}` &&
      typeof summary.outcome.reason === "string" &&
      repairReasons.has(summary.outcome.reason) &&
      summary.outcome.reason !== "runtime_repair_recovered" &&
      (summary.outcome.status === "cancelled") ===
        (summary.outcome.reason === "runtime_repair_cancelled") &&
      (failure === null ||
        (hasRuntimeStateRecordKeys(failure, ["stage", "reason"]) &&
          ["preparation", "checkpoint", "repair", "delivery"].includes(
            failure.stage as string,
          ) &&
          failure.reason === summary.outcome.reason)) &&
      (summary.outcome.status !== "cancelled" || failure === null) &&
      hasRuntimeStateRecordKeys(technical, [
        "actions",
        "engine",
        "stale",
        "hostSafety",
        "cleanup",
        "cleanupFailure",
      ]) &&
      ["unobserved", "ready", "unavailable", "unknown"].includes(
        technical.engine as string,
      ) &&
      ["safe", "manual_recovery_required", "unknown"].includes(
        technical.hostSafety as string,
      ) &&
      ["confirmed", "unknown"].includes(technical.cleanup as string) &&
      [
        null,
        "operation_cleanup_unknown",
        "observation_cleanup_unknown",
      ].includes(technical.cleanupFailure as string | null) &&
      (technical.cleanupFailure !== "observation_cleanup_unknown" ||
        technical.cleanup === "unknown") &&
      summary.outcome.cleanupConfirmed ===
        (technical.cleanup === "confirmed") &&
      ((technical.stale === "retained" &&
        summary.disposition === "retained_by_human_decision") ||
        (["absent", "unknown"].includes(technical.stale as string) &&
          summary.disposition === "not_applicable")) &&
      hasRuntimeStateRecordKeys(technical.actions, names) &&
      names.every((name, index) => {
        const action = technical.actions[name];
        if (
          !action ||
          !hasRuntimeStateRecordKeys(action, ["intent", "request", "result"]) ||
          !["not_saved", "saved"].includes(action.intent as string) ||
          !["not_issued", "issued", "unknown"].includes(
            action.request as string,
          ) ||
          !["unobserved", "not_required", "confirmed", "unknown"].includes(
            action.result as string,
          )
        )
          return false;
        if (
          action.intent === "not_saved" &&
          (action.request !== "not_issued" ||
            !["unobserved", "not_required"].includes(action.result as string))
        )
          return false;
        if (
          action.request === "unknown"
            ? action.result !== "unknown"
            : action.request === "not_issued"
              ? !["unobserved", "not_required"].includes(
                  action.result as string,
                )
              : action.intent !== "saved" || action.result === "not_required"
        )
          return false;
        return (
          action.intent !== "saved" ||
          names
            .slice(0, index)
            .every((previous) =>
              ["confirmed", "not_required"].includes(
                technical.actions[previous]?.result as string,
              ),
            )
        );
      }) &&
      (technical.stale !== "absent" ||
        [
          "retain_runtime",
          "retain_failed_runtime",
          "retain_auxiliary_runtime",
        ].every((name) => technical.actions[name]?.result !== "confirmed"))
    );
  }
  return (
    summary.schema === "crdd-coordinator/repair-summary/v1" &&
    typeof summary.operationId === "string" &&
    /^OP-[0-9]{6,}$/u.test(summary.operationId) &&
    isSha256Hex(summary.operationNonce) &&
    isSha256Hex(summary.identitySha256) &&
    summary.recoveryId ===
      `docker-runtime-repair.${summary.operationNonce}.${summary.identitySha256}` &&
    summary.primaryFailure === null &&
    hasRuntimeStateRecordKeys(summary.outcome, [
      "status",
      "reason",
      "cleanupConfirmed",
    ]) &&
    summary.outcome.status === "recovered" &&
    summary.outcome.reason === "runtime_repair_recovered" &&
    summary.outcome.cleanupConfirmed === true &&
    hasRuntimeStateRecordKeys(technical, [
      "actions",
      "engine",
      "stale",
      "hostSafety",
      "cleanup",
      "cleanupFailure",
    ]) &&
    technical.engine === "ready" &&
    technical.hostSafety === "safe" &&
    technical.cleanup === "confirmed" &&
    technical.cleanupFailure === null &&
    ((technical.stale === "absent" &&
      summary.disposition === "not_applicable") ||
      (technical.stale === "retained" &&
        ["retained_by_human_decision", "discard"].includes(
          summary.disposition as string,
        ))) &&
    hasRuntimeStateRecordKeys(technical.actions, names) &&
    names.every((name) => {
      const action = technical.actions[name];
      return (
        action !== undefined &&
        hasRuntimeStateRecordKeys(action, ["intent", "request", "result"]) &&
        ((action.result === "confirmed" &&
          action.intent === "saved" &&
          action.request === "issued") ||
          (action.result === "not_required" &&
            (action.intent === "not_saved" || action.intent === "saved") &&
            action.request === "not_issued"))
      );
    }) &&
    (!hasRetention ||
      (["primary", "failed", "auxiliary"] as const).every((purpose) => {
        const receipt = summary.retention as CoordinatorRepairRetentionReceipt;
        const action =
          technical.actions[
            purpose === "primary"
              ? "retain_runtime"
              : purpose === "failed"
                ? "retain_failed_runtime"
                : "retain_auxiliary_runtime"
          ];
        return receipt.targets[purpose] === null
          ? action?.request === "not_issued" && action.result === "not_required"
          : action?.intent === "saved" &&
              action.request === "issued" &&
              action.result === "confirmed";
      })) &&
    (technical.stale !== "absent" ||
      [
        "retain_runtime",
        "retain_failed_runtime",
        "retain_auxiliary_runtime",
      ].every((name) => technical.actions[name]?.result !== "confirmed"))
  );
}

/**
 * 認証create結果不明の限定終了に必要な保存条件を共同評価する。
 * @responsibility 通常回収を緩めず、同じTaskの完全再起動と未実行条件を要求する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderで相関確認済みのTask。
 * @returns 専用不存在観測へ進める保存条件だけが成立すればtrue。
 * @precondition 物理Owner・排他・CLI終端は呼出し側が別に確認する。
 * @postcondition 実不存在・保存許可・Task完了を発行しない。
 * @effect N/A: 同期値検査だけ。
 * @failure 不正相関、auth以外の未終端、未確定再起動はfalse。
 * @invariant unknownと未発行を区別し、blocked再起動をfenceにしない。
 * @boundary 現在保存値と専用回収Owner。
 * @security 保存値から物理処置Authorityを生成しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorAuthenticationUnknownCanClose(
  operation: CoordinatorStateTaskOperation,
): boolean {
  try {
    const book = operation.resources;
    const auth = book?.checkpoints.find(
      (item) => item.key === "create_subscription_auth_probe",
    );
    const authResource = book?.snapshot.resources.find(
      (item) => item.key === "create_subscription_auth_probe",
    );
    const restart = operation.dockerRestart;
    const identity = JSON.parse(operation.identityJson);
    return (
      operation.phase !== "executing" &&
      book !== null &&
      auth?.submission === "intent_saved" &&
      authResource?.identity.dockerId === null &&
      auth.receiptSource === null &&
      auth.observation !== "present" &&
      book.checkpoints.every(
        (item) => item === auth || coordinatorResourceIsSettled(item),
      ) &&
      operation.execution.providerStart === "not_started" &&
      operation.execution.externalSend === "not_issued" &&
      operation.execution.sharedWrite === "not_issued" &&
      operation.execution.ownerEffect === "disabled" &&
      operation.execution.workspaceReusable === false &&
      restart?.request === "confirmed" &&
      restart.cleanup === "confirmed" &&
      restart.result?.status === "completed" &&
      restart.result.request === "confirmed" &&
      restart.result.effectOutcomeUnknown === false &&
      createDockerRestartRequestId(
        identity.repositoryBinding,
        operation.identitySha256,
        operation.recoveryId,
        restart.scopeSha256,
      ) === restart.requestId
    );
  } catch {
    return false;
  }
}

/**
 * 復号済みOperationのLifecycleと未解決義務の保全を判定する。
 * @responsibility Effect履歴、正常継続、修復専用辺と配送参照を同じ規則で検査する。
 * @trace ARCH-000008
 * @input current: 検査済み元値、next: 検査済み次値、repairSessionId: 既存専用用途。
 * @returns 既存の全遷移条件が成立した場合だけtrue。
 * @precondition byte復号・元改訂・Hash比較は保存Ownerが同じ順序で確認する。
 * @postcondition unknownと一次結果を補完せず、実資源の観測を発行しない。
 * @effect N/A: 同期値判定だけ。
 * @failure 不正遷移・相関又は解釈不能はfalse。
 * @invariant 正常継続とOwner喪失後の回復Authorityを混同しない。
 * @boundary Operationの意味と統合保存の構造・CAS。
 * @security この判定だけで実行・削除Authorityを生成しない。
 * @concurrency Writerのfresh元版検査を外へ移動しない。
 */
export function validateCoordinatorOperationTransitions(
  current: Readonly<{ snapshot: CoordinatorStateSnapshot }> | null,
  next: Readonly<{ snapshot: CoordinatorStateSnapshot }>,
  repairSessionId: string | null,
): boolean {
  try {
    const priorOperations = new Map(
      (current?.snapshot.operations ?? []).map((operation) => [
        coordinatorOperationNonce(operation),
        operation,
      ]),
    );
    const phases = ["executing", "settling", "awaiting_delivery"];
    for (const operation of next.snapshot.operations) {
      const nonce = coordinatorOperationNonce(operation);
      const prior = priorOperations.get(nonce);
      if (operation.kind === "runtime_repair") {
        if (prior === undefined) {
          if (
            operation.phase !== "repairing" ||
            operation.checkpoint !== null ||
            operation.disposition !== "not_applicable" ||
            operation.disposal !== null ||
            operation.primaryFailure !== null ||
            operation.outcome !== null ||
            operation.summarySha256 !== null ||
            operation.history !== null
          )
            return false;
        } else {
          if (
            prior.kind !== "runtime_repair" ||
            operation.identityJson !== prior.identityJson ||
            operation.identitySha256 !== prior.identitySha256 ||
            operation.recoveryId !== prior.recoveryId
          )
            return false;
          // 回収進捗は専用の完全再導出だけ。通常保存で判断・技術値を更新しない。
          if (
            encodeRuntimeStateValue(operation.retention ?? null) !==
              encodeRuntimeStateValue(prior.retention ?? null) ||
            encodeRuntimeStateValue(operation.disposal) !==
              encodeRuntimeStateValue(prior.disposal) ||
            (prior.disposal !== null &&
              encodeRuntimeStateValue({
                ...operation,
                summarySha256: null,
                history: null,
              }) !==
                encodeRuntimeStateValue({
                  ...prior,
                  summarySha256: null,
                  history: null,
                }))
          )
            return false;
          if (
            prior.disposition === "pending_human_decision" &&
            operation.disposition !== prior.disposition
          )
            return false;
          if (
            operation.phase !== prior.phase &&
            !(
              (prior.phase === "repairing" &&
                ["settling", "awaiting_disposition"].includes(
                  operation.phase,
                )) ||
              (prior.phase === "settling" &&
                operation.phase === "awaiting_delivery")
            )
          )
            return false;
          if (
            prior.checkpoint !== null
              ? !(operation.recoveryId === repairSessionId
                  ? validateDockerRuntimeRepairSessionCheckpoint(
                      prior.checkpoint,
                      operation.checkpoint,
                    )
                  : validateDockerRuntimeRepairCheckpointTransition(
                      prior.checkpoint,
                      operation.checkpoint,
                    ))
              : operation.checkpoint !== null &&
                (Object.values(operation.checkpoint.actions).some(
                  (action) =>
                    action.intent !== "not_saved" ||
                    action.request !== "not_issued" ||
                    action.result !== "unobserved",
                ) ||
                  Object.values(operation.checkpoint.directories).some(
                    (pair) =>
                      pair.expected !== null ||
                      pair.source.state !== "unobserved" ||
                      pair.retained.state !== "unobserved",
                  ))
          )
            return false;
          if (
            prior.primaryFailure !== null &&
            encodeRuntimeStateValue(prior.primaryFailure) !==
              encodeRuntimeStateValue(operation.primaryFailure)
          )
            return false;
          if (
            prior.outcome !== null &&
            (operation.outcome === null ||
              encodeRuntimeStateValue(operation.primaryFailure) !==
                encodeRuntimeStateValue(prior.primaryFailure) ||
              encodeRuntimeStateValue(operation.checkpoint?.actions ?? null) !==
                encodeRuntimeStateValue(prior.checkpoint?.actions ?? null) ||
              operation.outcome.status !== prior.outcome.status ||
              operation.outcome.reason !== prior.outcome.reason ||
              (prior.outcome.cleanupConfirmed &&
                !operation.outcome.cleanupConfirmed))
          )
            return false;
          if (
            operation.disposition === "retained_by_human_decision" &&
            prior.disposition === "not_applicable"
          )
            return false;
          if (
            prior.disposition === "retained_by_human_decision" &&
            operation.disposition !== prior.disposition
          )
            return false;
          if (
            prior.summarySha256 !== null &&
            operation.summarySha256 !== prior.summarySha256
          )
            return false;
          if (prior.history === null) {
            if (operation.history?.confirmed) return false;
          } else if (
            operation.history === null ||
            operation.history.occurredAt !== prior.history.occurredAt ||
            operation.history.lineSha256 !== prior.history.lineSha256 ||
            (prior.history.confirmed && !operation.history.confirmed)
          )
            return false;
          if (
            (prior.history !== null || operation.history !== null) &&
            encodeRuntimeStateValue({
              ...prior,
              summarySha256: null,
              history: null,
            }) !==
              encodeRuntimeStateValue({
                ...operation,
                summarySha256: null,
                history: null,
              })
          )
            return false;
        }
        priorOperations.delete(nonce);
        continue;
      }
      if (!prior) {
        const identity = JSON.parse(operation.identityJson);
        // 新操作だけを制約する。旧競合Snapshotの読取り・回収を不能にしない。
        if (
          next.snapshot.operations.some((other) => {
            if (other.recoveryId === operation.recoveryId) return false;
            if (other.kind === "runtime_repair")
              return other.phase !== "awaiting_delivery";
            if (
              JSON.parse(other.identityJson).stableLogicalHomeBindingHash !==
              identity.stableLogicalHomeBindingHash
            )
              return false;
            const before = current?.snapshot.operations.find(
              (item): item is CoordinatorStateTaskOperation =>
                item.kind === "docker_task" &&
                item.recoveryId === other.recoveryId,
            );
            if (!before) return true;
            const previousIdentity = JSON.parse(before.identityJson);
            // 同一Hostの正常技術終端は、物理Host清掃を二重に要求しない。
            // marker実体は状態遷移ごとに置換されるため、その同一性は比較しない。
            const sameHostContinuation =
              previousIdentity.operationId === identity.operationId &&
              previousIdentity.recoveryCorrelationId ===
                identity.recoveryCorrelationId &&
              previousIdentity.hostPaths.root === identity.hostPaths.root &&
              previousIdentity.hostPaths.marker === identity.hostPaths.marker &&
              previousIdentity.initialHostRecoveryId ===
                identity.initialHostRecoveryId &&
              previousIdentity.initialHostRecovery.directoryIdentity ===
                identity.initialHostRecovery.directoryIdentity &&
              encodeRuntimeStateValue(before) ===
                encodeRuntimeStateValue(other);
            // 同じ更新内の終端偽装や、二つの新規開始を受理しない。
            return (
              [before, other].some((value) => {
                const hostCleanupComplete =
                  value.phase !== "executing" &&
                  value.outcome?.cleanupConfirmed === true &&
                  value.host.cleanup === "confirmed";
                const hostCleanupDeferred =
                  sameHostContinuation &&
                  value.phase === "executing" &&
                  value.outcome === null &&
                  value.primaryFailure === null &&
                  value.summarySha256 === null &&
                  value.history === null &&
                  value.dockerRestart === null &&
                  value.execution.workspaceReusable === false &&
                  value.host.cleanup === "not_requested" &&
                  value.host.currentToken === identity.initialHostRecoveryId;
                return (
                  !(hostCleanupComplete || hostCleanupDeferred) ||
                  value.host.pendingTransitionJson !== null ||
                  value.lease !== "released" ||
                  value.execution.ownerEffect !== "disabled" ||
                  // 過去Effectの不確実性は、同Hostの正常技術終端を取り消さない。
                  // 新stageのAuthorityは開始保存前の既存実行入口が確認する。
                  (!hostCleanupDeferred &&
                    (value.execution.providerStart === "unknown" ||
                      value.execution.externalSend === "unknown" ||
                      value.execution.sharedWrite === "unknown")) ||
                  !coordinatorTaskResourcesAreSettled(value)
                );
              }) ||
              [current?.snapshot, next.snapshot].some((snapshot) =>
                snapshot?.unresolvedRecoveries.some(
                  (recovery) =>
                    recovery.recoveryId === other.recoveryId &&
                    recovery.obligations.some(
                      (obligation) => obligation !== "result_delivery",
                    ),
                ),
              )
            );
          })
        )
          return false;
        if (
          operation.phase !== "executing" ||
          operation.resources !== null ||
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
          operation.summarySha256 !== null ||
          operation.history !== null ||
          operation.dockerRestart !== null
        )
          return false;
        continue;
      }
      priorOperations.delete(nonce);
      if (prior.kind !== "docker_task") return false;
      if (
        !validateDockerRestartCheckpointTransition(
          prior.dockerRestart,
          operation.dockerRestart,
        )
      )
        return false;
      if (
        operation.identityJson !== prior.identityJson ||
        operation.identitySha256 !== prior.identitySha256 ||
        operation.recoveryId !== prior.recoveryId ||
        phases.indexOf(operation.phase) < phases.indexOf(prior.phase)
      )
        return false;
      if (
        prior.dockerRestart === null &&
        operation.dockerRestart !== null &&
        encodeRuntimeStateValue(operation.resources) !==
          encodeRuntimeStateValue(prior.resources)
      )
        return false;
      if (
        prior.dockerRestart !== null &&
        operation.resources?.checkpoints.some(
          (checkpoint) =>
            checkpoint.submission === "intent_saved" &&
            prior.resources?.checkpoints.find(
              (before) => before.key === checkpoint.key,
            )?.submission !== "intent_saved",
        )
      )
        return false;
      if (
        !validateCoordinatorResourceBookTransition(
          prior.resources,
          operation.resources,
        )
      )
        return false;
      if (
        prior.primaryFailure !== null &&
        encodeRuntimeStateValue(operation.primaryFailure) !==
          encodeRuntimeStateValue(prior.primaryFailure)
      )
        return false;
      if (
        prior.summarySha256 !== null &&
        operation.summarySha256 !== prior.summarySha256
      )
        return false;
      if (prior.history === null) {
        if (operation.history?.confirmed) return false;
      } else if (
        operation.history === null ||
        operation.history.occurredAt !== prior.history.occurredAt ||
        operation.history.lineSha256 !== prior.history.lineSha256 ||
        (prior.history.confirmed && !operation.history.confirmed)
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
        after.resultId !== before.resultId
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 一度だけの要求と単調な結果・回収更新を検査する。
 * @responsibility 要求置換、terminal書換え、未知値の未発行化を拒否する。
 * @trace ARCH-000008
 * @input beforeValue、afterValue: 元版と次版の単一checkpoint。
 * @returns 許可された構造的な遷移だけtrue。
 * @precondition 同じOwnerの受付観測とfresh権限は保存利用側が別に確認する。
 * @postcondition blocked後は結果不変で回収だけ進行できる。
 * @effect N/A: 値の比較だけ。
 * @failure 不正構造・別要求・逆行・二度目の要求はfalse。
 * @invariant trueは再発行許可、回収実証やWriter成功ではない。
 * @boundary 元保存値と次版候補。
 * @security 保存から生Ownerを復元しない。
 * @concurrency N/A: 元版照合と排他はWriterが所有する。
 */
export function validateDockerRestartCheckpointTransition(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  if (beforeValue === null && afterValue === null) return true;
  const after = decodeDockerRestartCheckpoint(afterValue);
  if (!after) return false;
  if (beforeValue === null)
    return (
      after.request === "not_issued" &&
      after.cleanup === "not_required" &&
      after.result === null
    );
  const before = decodeDockerRestartCheckpoint(beforeValue);
  if (
    !before ||
    before.requestId !== after.requestId ||
    before.scopeSha256 !== after.scopeSha256 ||
    (before.result !== null &&
      (after.result?.status !== before.result.status ||
        after.result.reason !== before.result.reason ||
        after.result.request !== before.result.request ||
        after.result.effectOutcomeUnknown !==
          before.result.effectOutcomeUnknown ||
        after.request !== before.request))
  )
    return false;
  if (
    before.request !== after.request &&
    ![
      "not_issued:unknown",
      "unknown:issued",
      "unknown:confirmed",
      "issued:confirmed",
    ].includes(`${before.request}:${after.request}`)
  )
    return false;
  return (
    before.cleanup === after.cleanup ||
    ["not_required:pending", "pending:confirmed", "pending:unknown"].includes(
      `${before.cleanup}:${after.cleanup}`,
    )
  );
}
