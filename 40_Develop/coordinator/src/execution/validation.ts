/**
 * execution/validation.tsの値契約と判定を所有する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008
 */
import { coordinatorOperationSummaryBytes } from "../storage/state.ts";
import { coordinatorHistoryLineBytes } from "../storage/state.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import { decodeDockerRestartCheckpoint } from "./result.ts";
import { validateHostRecoveryTransitionLineage } from "./result.ts";
import { exactRecordKeys } from "../state/validation.ts";
import type { CoordinatorStateSnapshot } from "../storage/state.ts";
import { validateDockerRuntimeRepairCheckpointTransition } from "../../../docker-isolation/src/index.ts";
import { validateDockerRuntimeRepairSessionCheckpoint } from "../../../docker-isolation/src/index.ts";
import { validateDockerRestartCheckpointTransition } from "./result.ts";
import { isSha256Hex } from "../state/validation.ts";
import type { CoordinatorStateTaskOperation } from "./types.ts";
import type { CoordinatorStateRepairOperation } from "./types.ts";
import type { CoordinatorStateOperation } from "./types.ts";
import type { CoordinatorRepairRetentionReceipt } from "./types.ts";
import { coordinatorRepairSummaryBytes } from "./result.ts";
import { coordinatorRepairHistoryLineBytes } from "./result.ts";
import { encodeCoordinatorStateValue } from "../state/validation.ts";
import { createHash } from "node:crypto";
import type { DockerRuntimeRepairCheckpoint } from "../../../docker-isolation/src/index.ts";
import { decodeDockerRuntimeRepairCheckpoint } from "../../../docker-isolation/src/index.ts";
import { decodeDockerRuntimeRepairDisposalCheckpoint } from "../../../docker-isolation/src/index.ts";
import { decodeDockerRuntimeRepairRetentionTargets } from "../../../docker-isolation/src/index.ts";
import { dockerRuntimeRepairCheckpointIsSettled } from "../../../docker-isolation/src/index.ts";
import { dockerRuntimeRepairDisposalIsSettled } from "../../../docker-isolation/src/index.ts";
import { createDockerRestartRequestId } from "./result.ts";
import { dockerProcessControllerPublicCompletionReasons } from "./result.ts";
import { isDockerRestartCheckpointSettled } from "./result.ts";
import { parseHostRecoveryToken } from "./result.ts";
import { inspectExecutionSelection } from "../selection/validation.ts";
import { coordinatorConsumerCompletionPolicy } from "../task/acceptance.ts";

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
    !exactRecordKeys(value, [
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
    exactRecordKeys(
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
    exactRecordKeys(record, [
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

export const OPERATION_IDENTITY_SCHEMA =
  "crdd-coordinator/operation-identity/v2";

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
    "providerHomeProtectionHash",
    "localUserBindingHash",
    "repositoryBinding",
    "ownershipLabel",
    "resources",
    "images",
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
    !exactRecordKeys(
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
      identity.providerHomeProtectionHash,
      identity.localUserBindingHash,
    ].every(isSha256Hex) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
      String(identity.ownershipLabel ?? ""),
    ) &&
    exactRecordKeys(identity.resources, [
      "auth",
      "provider",
      "proxy",
      "internal",
      "egress",
    ]) &&
    Object.values(identity.resources as Record<string, unknown>).every(
      (item) =>
        typeof item === "string" &&
        /^crdd-(auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u.test(
          item,
        ),
    ) &&
    exactRecordKeys(identity.images, ["provider", "proxy"]) &&
    Object.values(identity.images as Record<string, unknown>).every(
      (item) => typeof item === "string" && /^sha256:[a-f0-9]{64}$/u.test(item),
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
        exactRecordKeys(identity.workspaceProtection, [
          "gitSourcePath",
          "internalSourcePath",
        ]) &&
        Object.values(
          identity.workspaceProtection as Record<string, unknown>,
        ).every(
          (item) =>
            typeof item === "string" &&
            item.length <= 4096 &&
            !/[\0\r\n,]/u.test(item),
        ))) &&
    (!Object.hasOwn(identity, "workspaceProtection") ||
      identity.workspaceProtected === true) &&
    (!hasCorrelation ||
      (typeof identity.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          identity.recoveryCorrelationId,
        ))) &&
    validateHostSnapshot(identity.initialHostRecovery, token) &&
    exactRecordKeys(identity.hostPaths, ["root", "marker"]) &&
    typeof (identity.hostPaths as Record<string, unknown>).root === "string" &&
    typeof (identity.hostPaths as Record<string, unknown>).marker === "string"
  );
}

export const purposeResource = {
  create_egress_network: "egress",
  create_internal_network: "internal",
  create_provider: "provider",
  create_proxy: "proxy",
  create_subscription_auth_probe: "auth",
} as const;

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

export const finalReasons = new Set<string>([
  ...dockerProcessControllerPublicCompletionReasons,
  "provider_operation_completed",
  "provider_operation_cancelled",
]);

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
  if (!exactRecordKeys(value, ["decidedAt", "reviewAfter", "targets"]))
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
          encodeCoordinatorStateValue(pair.expected) ===
            encodeCoordinatorStateValue(pair.retained.identity) &&
          encodeCoordinatorStateValue(target) ===
            encodeCoordinatorStateValue(pair.expected)
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
    !exactRecordKeys(operation, [
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
      !exactRecordKeys(identity, [
        "schema",
        "kind",
        "operationNonce",
        "operationId",
        "repositoryBinding",
        "ownerBindingSha256",
        "scopeSha256",
        "consumer",
      ]) ||
      identity.schema !== "crdd-coordinator/runtime-repair-identity/v1" ||
      identity.kind !== operation.kind ||
      identity.repositoryBinding !== repositoryBinding ||
      !isSha256Hex(identity.operationNonce) ||
      !isSha256Hex(identity.ownerBindingSha256) ||
      !isSha256Hex(identity.scopeSha256) ||
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
        !exactRecordKeys(disposal, ["decidedAt", "checkpoint"]) ||
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
      (!exactRecordKeys(failure, ["stage", "reason"]) ||
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
        !exactRecordKeys(outcome, ["status", "reason", "cleanupConfirmed"]) ||
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
      exactRecordKeys(history, ["occurredAt", "lineSha256", "confirmed"]) &&
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
  resource: CoordinatorStateTaskOperation["resources"][number],
): boolean {
  return (
    resource.request === "not_requested" ||
    resource.request === "not_issued" ||
    (resource.request === "identified" && resource.observation === "absent")
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
    const auth = operation.resources.find(
      (item) => item.purpose === "create_subscription_auth_probe",
    );
    const restart = operation.dockerRestart;
    const identity = JSON.parse(operation.identityJson);
    return (
      operation.phase !== "executing" &&
      operation.resources.length === 5 &&
      new Set(operation.resources.map((item) => item.purpose)).size === 5 &&
      auth?.request === "unknown" &&
      auth.dockerId === null &&
      auth.receiptSource === null &&
      auth.observation !== "present" &&
      operation.resources.every(
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
  return createHash("sha256")
    .update(
      encodeCoordinatorStateValue({
        domain: "crdd-coordinator/authentication-unknown-absence/v1",
        identitySha256: operation.identitySha256,
        recoveryId: operation.recoveryId,
        purpose: "create_subscription_auth_probe",
        plannedResourceName: identity.resources.auth,
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
  if (operation.resources.every(coordinatorResourceIsSettled)) return true;
  const hash = coordinatorAuthenticationClosureEvidence(operation);
  const identity = JSON.parse(operation.identityJson);
  return (
    hash !== null &&
    operation.resources.every(
      (resource) =>
        coordinatorResourceIsSettled(resource) ||
        (resource.purpose === "create_subscription_auth_probe" &&
          resource.observation === "absent" &&
          resource.absence?.evidenceSha256 === hash &&
          resource.absence.recoveryId === operation.recoveryId &&
          resource.absence.purpose === resource.purpose &&
          resource.absence.plannedResourceName === identity.resources.auth &&
          resource.absence.dockerId === null),
    )
  );
}

/**
 * 解放済みで五資源が既知終端の操作だけをHost不存在観測へ接続する。
 * @responsibility Host清掃欄が未要求でも観測可能な限定条件を判定する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderが相関を確認したTask操作。
 * @returns 現在Host／markerの観測へ進める場合だけtrue。
 * @precondition 元token／Root結合、fresh排他と実不存在は別途確認する。
 * @postcondition trueをHost清掃・Task成功・履歴確定へ昇格しない。
 * @effect N/A: メモリ内の値判定だけ。
 * @failure 未解放・Owner有効／不明・未終端・遷移／再起動未解決はfalse。
 * @invariant 過去unknownを成功へ変換せずWorkspaceを再利用しない。
 * @boundary 保存済み終端条件と実Host観測。
 * @security 保存値だけでは処置Authorityを作らない。
 * @concurrency N/A: 実体・排他の前後照合は回収Ownerが担当する。
 */
export function coordinatorReleasedTaskCanObserveHostAbsence(
  operation: CoordinatorStateTaskOperation,
): boolean {
  return (
    operation.lease === "released" &&
    operation.execution.ownerEffect === "disabled" &&
    operation.execution.workspaceReusable === false &&
    operation.host.pendingTransitionJson === null &&
    (operation.dockerRestart === null ||
      isDockerRestartCheckpointSettled(operation.dockerRestart)) &&
    operation.resources.length === 5 &&
    operation.resources.every(
      (resource) =>
        resource.request === "identified" && resource.observation === "absent",
    ) &&
    coordinatorTaskResourcesAreSettled(operation)
  );
}

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
    !exactRecordKeys(value, [
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
    (!exactRecordKeys(summary.disposal, ["decidedAt", "checkpoint"]) ||
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
    "terminate_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ];
  if (
    exactRecordKeys(summary.outcome, [
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
        (exactRecordKeys(failure, ["stage", "reason"]) &&
          ["preparation", "checkpoint", "repair", "delivery"].includes(
            failure.stage as string,
          ) &&
          failure.reason === summary.outcome.reason)) &&
      (summary.outcome.status !== "cancelled" || failure === null) &&
      exactRecordKeys(technical, [
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
        "helper_cleanup_unknown",
        "helper_protocol_failed",
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
      exactRecordKeys(technical.actions, names) &&
      names.every((name, index) => {
        const action = technical.actions[name];
        if (
          !action ||
          !exactRecordKeys(action, ["intent", "request", "result"]) ||
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
    exactRecordKeys(summary.outcome, [
      "status",
      "reason",
      "cleanupConfirmed",
    ]) &&
    summary.outcome.status === "recovered" &&
    summary.outcome.reason === "runtime_repair_recovered" &&
    summary.outcome.cleanupConfirmed === true &&
    exactRecordKeys(technical, [
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
    exactRecordKeys(technical.actions, names) &&
    names.every((name) => {
      const action = technical.actions[name];
      return (
        action !== undefined &&
        exactRecordKeys(action, ["intent", "request", "result"]) &&
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
    !exactRecordKeys(value, [
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
        exactRecordKeys(failure.turnCountDiagnostic, [
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
        exactRecordKeys(failure.commandObservation, [
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
  if (!exactRecordKeys(value, ["status", "reason", "cleanupConfirmed"]))
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
            encodeCoordinatorStateValue(operation.retention ?? null) !==
              encodeCoordinatorStateValue(prior.retention ?? null) ||
            encodeCoordinatorStateValue(operation.disposal) !==
              encodeCoordinatorStateValue(prior.disposal) ||
            (prior.disposal !== null &&
              encodeCoordinatorStateValue({
                ...operation,
                summarySha256: null,
                history: null,
              }) !==
                encodeCoordinatorStateValue({
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
            encodeCoordinatorStateValue(prior.primaryFailure) !==
              encodeCoordinatorStateValue(operation.primaryFailure)
          )
            return false;
          if (
            prior.outcome !== null &&
            (operation.outcome === null ||
              encodeCoordinatorStateValue(operation.primaryFailure) !==
                encodeCoordinatorStateValue(prior.primaryFailure) ||
              encodeCoordinatorStateValue(
                operation.checkpoint?.actions ?? null,
              ) !==
                encodeCoordinatorStateValue(
                  prior.checkpoint?.actions ?? null,
                ) ||
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
            encodeCoordinatorStateValue({
              ...prior,
              summarySha256: null,
              history: null,
            }) !==
              encodeCoordinatorStateValue({
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
              encodeCoordinatorStateValue(before) ===
                encodeCoordinatorStateValue(other);
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
        encodeCoordinatorStateValue(operation.resources) !==
          encodeCoordinatorStateValue(prior.resources)
      )
        return false;
      for (const [index, resource] of operation.resources.entries()) {
        const before = prior.resources[index];
        if (!before) return false;
        if (
          prior.dockerRestart !== null &&
          before.request !== resource.request &&
          ["intent_saved", "issued", "unknown"].includes(resource.request)
        )
          return false;
        if (
          before.request !== resource.request &&
          ![
            "not_requested:intent_saved",
            "intent_saved:issued",
            "intent_saved:identified",
            "intent_saved:not_issued",
            "intent_saved:unknown",
            "issued:unknown",
            "unknown:issued",
            "unknown:identified",
            "issued:identified",
          ].includes(`${before.request}:${resource.request}`)
        )
          return false;
        if (
          before.request === "intent_saved" &&
          resource.request === "identified" &&
          (before.observation !== "unobserved" ||
            before.absence !== null ||
            resource.receiptSource !== "docker_create_result" ||
            resource.observation !== "unobserved" ||
            resource.absence !== null)
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

export const MAX_COORDINATOR_STATE_OPERATIONS = 64;

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
    snapshot.operations.length > MAX_COORDINATOR_STATE_OPERATIONS ||
    !Array.isArray(snapshot.unresolvedRecoveries) ||
    snapshot.unresolvedRecoveries.length > MAX_COORDINATOR_STATE_OPERATIONS ||
    !Array.isArray(snapshot.pendingDeliveries) ||
    snapshot.pendingDeliveries.length > MAX_COORDINATOR_STATE_OPERATIONS
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
      !exactRecordKeys(operation, [
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
    if (!Array.isArray(operation.resources) || operation.resources.length !== 5)
      return false;
    for (const [index, purpose] of Object.keys(purposeResource).entries()) {
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
          "not_issued",
          "intent_saved",
          "issued",
          "identified",
          "unknown",
        ].includes(resource.request) ||
        !["unobserved", "present", "absent", "unknown"].includes(
          resource.observation,
        )
      )
        return false;
      if (
        resource.request === "not_issued" &&
        (resource.observation !== "unobserved" || resource.absence !== null)
      )
        return false;
      if (
        resource.request === "identified"
          ? !isSha256Hex(resource.dockerId) ||
            !["docker_create_result", "runtime_reconciliation"].includes(
              resource.receiptSource ?? "",
            )
          : resource.dockerId !== null || resource.receiptSource !== null
      )
        return false;
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
              purposeResource[purpose as keyof typeof purposeResource]
            ] ||
          absence.dockerId !== resource.dockerId ||
          !isSha256Hex(absence.evidenceSha256)
        )
          return false;
      } else if (resource.absence !== null) return false;
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
        !exactRecordKeys(history, ["occurredAt", "lineSha256", "confirmed"]) ||
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
      !exactRecordKeys(recovery, [
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
      !exactRecordKeys(delivery, [
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
