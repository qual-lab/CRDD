/**
 * Coordinatorの現在状態を閉じた保存形式として検証する。
 * @responsibility 固定操作情報、現在資源、未解決回復と結果搬送の構造・相関を所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  decodeDockerRuntimeRepairCheckpoint,
  createDockerRuntimeRepairDisposalCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  dockerRuntimeRepairDisposalIsSettled,
  decodeDockerRuntimeRepairRetentionTargets,
  type DockerRuntimeRepairRetentionTargets,
  validateDockerRuntimeRepairDisposalTransition,
  dockerRuntimeRepairCheckpointIsSettled,
  prepareDockerRuntimeRepairSessionCheckpoint,
  validateDockerRuntimeRepairCheckpointTransition,
  validateDockerRuntimeRepairSessionCheckpoint,
  type DockerRuntimeRepairCheckpoint,
  type DockerRuntimeRepairDisposalCheckpoint,
} from "../../../docker-isolation/src/index.ts";
import { dockerProcessControllerPublicCompletionReasons } from "../provider/execution-result-reasons.ts";
import { isSha256Hex, parseDockerTaskRecoveryId } from "./recovery-identity.ts";
import {
  parseHostRecoveryToken,
  validateHostRecoveryTransitionLineage,
} from "../host-execution/recovery-record.ts";
import {
  createDockerRestartRequestId,
  decodeDockerRestartCheckpoint,
  isDockerRestartCheckpointSettled,
  type DockerRestartCheckpoint,
  validateDockerRestartCheckpointTransition,
} from "./restart-checkpoint.ts";

/**
 * 記録 Keysが完全一致するか判定する。
 *
 * @responsibility 記録 Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、keys: readonly string[]
 * @returns exactRecordKeysの計算結果を返す。
 * @precondition 「value: unknown、keys: readonly string[]」がexactRecordKeysの入力契約を満たす。
 * @postcondition exactRecordKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactRecordKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactRecordKeysは独自の失敗分岐を所有しない。
 * @invariant exactRecordKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactRecordKeysはProcess内の同一Subsystemで完結する。
 * @security exactRecordKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactRecordKeysは共有非同期状態を持たない同期処理である。
 */
function exactRecordKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

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
function validateHostSnapshot(value: unknown, initialToken: string) {
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

export const COORDINATOR_STATE_SCHEMA = "crdd-coordinator/current-state/v2";
const OPERATION_IDENTITY_SCHEMA = "crdd-coordinator/operation-identity/v1";

/**
 * 本番利用側に固定された結果受領方式を返す。
 * @responsibility 一時的な返却と後続再開用の耐久ACKを区別する。
 * @trace ARCH-000008
 * @input consumer: 固定組立てが選択した利用側識別子。
 * @returns transient、durable、または未知利用側のnull。
 * @precondition N/A: 未知値も受け取り拒否する。
 * @postcondition Orchestratorの耐久受領を入力指定で降格しない。
 * @effect N/A: 値の同期判定だけで保存や配送を行わない。
 * @failure 未知識別子・非文字列ではnull。
 * @invariant 受領方式は資源回収やCandidate保全の証明ではない。
 * @boundary 本番組立ての利用側と保存モデルの固定契約。
 * @security Objectの変換・getter・Proxyを評価しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorConsumerCompletionPolicy(
  consumer: unknown,
): "transient" | "durable" | null {
  if (consumer === "orchestrator") return "durable";
  if (consumer === "coordinator_cli" || consumer === "workbench")
    return "transient";
  return null;
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
function validateCoordinatorOperationIdentity(
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
    "profileId",
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
    /^PROFILE-[0-9]{6,}$/u.test(String(identity.profileId ?? "")) &&
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
export const MAX_COORDINATOR_STATE_BYTES = 16 * 1024 * 1024;
export const MAX_COORDINATOR_STATE_OPERATIONS = 64;
const purposeResource = {
  create_egress_network: "egress",
  create_internal_network: "internal",
  create_provider: "provider",
  create_proxy: "proxy",
  create_subscription_auth_probe: "auth",
} as const;
const commandPurposes = [
  ...Object.keys(purposeResource),
  "start_subscription_auth_probe_attached",
  "connect_proxy_egress",
  "start_proxy",
  "start_provider_attached",
];
const failureStages = [
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
const finalReasons = new Set<string>([
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
export type CoordinatorStateTaskOperation = Readonly<{
  kind: "docker_task";
  dockerRestart: DockerRestartCheckpoint | null;
  identityJson: string;
  identitySha256: string;
  recoveryId: string;
  phase: "executing" | "settling" | "awaiting_delivery";
  resources: readonly Readonly<{
    purpose: keyof typeof purposeResource;
    request:
      | "not_requested"
      | "not_issued"
      | "intent_saved"
      | "issued"
      | "identified"
      | "unknown";
    dockerId: string | null;
    receiptSource: "docker_create_result" | "runtime_reconciliation" | null;
    observation: "unobserved" | "present" | "absent" | "unknown";
    absence: Readonly<{
      recoveryId: string;
      purpose: keyof typeof purposeResource;
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
    commandObservation?: Readonly<{
      exitCode: number | null;
      stdoutBytes: number;
      stderrBytes: number;
    }> | null;
  }> | null;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    cleanupConfirmed: boolean;
  }> | null;
  summarySha256: string | null;
  history: Readonly<{
    occurredAt: string;
    lineSha256: string;
    confirmed: boolean;
  }> | null;
}>;

/**
 * Taskの実行情報を持たない実行環境修復の現在値。
 * @responsibility 技術checkpointと上位の保持判断・一次失敗を分離する。
 * @trace ARCH-000008
 * @shape kind、不変Identity、exact回復ID、phase、checkpoint、disposition、disposal、primaryFailure、outcome、summary/history。
 * @invariant Provider・Home・五資源を架空値で埋めない。
 * @boundary Repository現在状態と下位の技術観測。
 * @security 保存値は実処置や人間承認を発行しない。
 * @compatibility 最新v2だけ。旧記録はフロントAIが移行する。
 */
export type CoordinatorStateRepairOperation = Readonly<{
  kind: "runtime_repair";
  identityJson: string;
  identitySha256: string;
  recoveryId: string;
  phase:
    | "repairing"
    | "settling"
    | "awaiting_disposition"
    | "awaiting_delivery";
  // Nativeだけでなく同じSession内の観測資源cleanupもDI契約のまま保持する。
  checkpoint: DockerRuntimeRepairCheckpoint | null;
  disposition:
    | "not_applicable"
    | "pending_human_decision"
    | "retained_by_human_decision"
    | "discard";
  retention?: CoordinatorRepairRetentionReceipt;
  // 回収判断と進捗だけ。要約・履歴は操作直下へ一度だけ確定する。
  disposal: Readonly<{
    decidedAt: string;
    checkpoint: DockerRuntimeRepairDisposalCheckpoint;
  }> | null;
  primaryFailure: Readonly<{
    stage: "preparation" | "checkpoint" | "repair" | "delivery";
    reason: string;
  }> | null;
  outcome: Readonly<{
    status: "recovered" | "blocked" | "cancelled";
    reason: string;
    cleanupConfirmed: boolean;
  }> | null;
  summarySha256: string | null;
  history: Readonly<{
    occurredAt: string;
    lineSha256: string;
    confirmed: boolean;
  }> | null;
}>;

/**
 * 同じ閉集合に保存するTaskまたは実行環境修復。
 * @responsibility 各操作固有のfieldをkindで区別する。
 * @trace ARCH-000008
 * @shape docker_taskまたはruntime_repair。
 * @invariant kindを狭めずTask固有状態へアクセスしない。
 * @boundary 一つの現在状態内の異なる操作。
 * @security 一方のIdentityを他方のAuthorityへ変換しない。
 * @compatibility 判別不能な旧形状を受理しない。
 */
export type CoordinatorStateOperation =
  | CoordinatorStateTaskOperation
  | CoordinatorStateRepairOperation;

/**
 * 明示保持を利用者管理へ引き渡すための固定情報。
 * @responsibility 再判断期限と三用途の非Authority照合値を一つに結合する。
 * @trace ARCH-000008
 * @shape 正規UTC判断時刻、exact7日後の期限、用途別Node実体／null。
 * @invariant receiptの存在だけでは物理保存・引渡し・削除許可を主張しない。
 * @boundary 専用保持候補と既存履歴一行。
 * @security 生Path・Owner・Scope・秘密値を持たない。
 * @compatibility 新handoff形だけの条件付きfield。旧履歴へ補完しない。
 */
export type CoordinatorRepairRetentionReceipt = Readonly<{
  decidedAt: string;
  reviewAfter: string;
  targets: DockerRuntimeRepairRetentionTargets;
}>;

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
function validCoordinatorRepairRetentionReceipt(
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
function coordinatorRepairRetentionMatchesCheckpoint(
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

const repairReasons = new Set([
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
function validCoordinatorRepairOperation(
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
function coordinatorOperationNonce(
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
function coordinatorResourceIsSettled(
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
function coordinatorAuthenticationClosureEvidence(
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
 * 二組四観測を同じauth unknownへだけ保存する候補を導出する。
 * @responsibility 元結果・他資源・他操作を保持し、専用Writerの固定候補を作る。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、observationsValue、repositoryBinding: 元本文と専用観測。
 * @returns 専用次版、同値本文、または不正入力のnull。
 * @precondition 呼出し側が実観測と生成源の終端を確認している。
 * @postcondition 候補だけでは保存や限定終了を許可しない。
 * @effect N/A: 同期値変換だけ。
 * @failure 欠測・一回観測・観測不明・限定条件差はnull。
 * @invariant 過去request unknown・一次失敗・元結果を保持する。
 * @boundary 専用回収Ownerと物理Writer。
 * @security 通常resource／cleanup候補からこの辺を生成しない。
 * @concurrency 元版Hashは既存previousとCASへ結合する。
 */
export function prepareCoordinatorAuthenticationUnknownClosureSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (
      !current ||
      typeof recoveryId !== "string" ||
      encodeCoordinatorStateValue(observationsValue) !==
        encodeCoordinatorStateValue([
          { round: 1, name: "absent", name_label: "absent" },
          { round: 2, name: "absent", name_label: "absent" },
        ])
    )
      return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation) return null;
    const hash = coordinatorAuthenticationClosureEvidence(operation);
    if (!hash) return null;
    if (coordinatorTaskResourcesAreSettled(operation))
      return Buffer.from(currentBytes as Buffer);
    const identity = JSON.parse(operation.identityJson);
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : {
              ...operation,
              resources: operation.resources.map((resource) =>
                resource.purpose !== "create_subscription_auth_probe"
                  ? resource
                  : {
                      ...resource,
                      observation: "absent",
                      absence: {
                        recoveryId,
                        purpose: resource.purpose,
                        plannedResourceName: identity.resources.auth,
                        dockerId: null,
                        evidenceSha256: hash,
                      },
                    },
              ),
            },
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

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
    consumer: "orchestrator";
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
 * 一回確定した操作Identityを最新Snapshotの次版へ追加する。
 * @responsibility 初回checkpointと元版Hashを構成し、既存操作・回復・搬送を保持する。
 * @trace ARCH-000008
 * @input currentBytes: 確認済み元本文または初回null、identityJson: 確定基本情報、repositoryBinding: 検証済み結合。
 * @returns 構造と遷移を検査した次版のbyte列、またはnull。
 * @precondition 呼出し元がHome Leaseを保持し、初期Hostと操作Ownerを確認している。
 * @postcondition 同じIdentityを再追加せず、他操作の現在値を変更しない。
 * @effect N/A: メモリ内の候補構築だけ。保存・Host遷移・Docker要求は発行しない。
 * @failure 不正本文、重複Identity、上限または元版不一致はnull。
 * @invariant null元版は初回Authorityを意味せず、Writerで新品領域を別確認する。
 * @boundary 固定Operation情報とRepository現在Snapshot。
 * @security JSONからAuthorityを発行せず、秘密や追加Pathを生成しない。
 * @concurrency 元版Hashを保持し、競合時に盲目的な再試行をしない。
 */
export function prepareCoordinatorStateOperationSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const identitySha256 = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const recoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${identity.operationNonce}.${identitySha256}`;
    const operation: CoordinatorStateTaskOperation = {
      kind: "docker_task",
      dockerRestart: null,
      identityJson,
      identitySha256,
      recoveryId,
      phase: "executing",
      resources: (
        Object.keys(purposeResource) as (keyof typeof purposeResource)[]
      ).map((purpose) => ({
        purpose,
        request: "not_requested",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      })),
      host: {
        currentToken: identity.initialHostRecoveryId,
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      lease: "held",
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "active",
        workspaceReusable: false,
      },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    if (
      current?.snapshot.operations.some(
        (item) =>
          item.kind === "runtime_repair" && item.phase !== "awaiting_delivery",
      )
    )
      return null;
    const operations = [...(current?.snapshot.operations ?? []), operation];
    operations.sort((left, right) => {
      const a = JSON.parse(left.identityJson).operationNonce as string;
      const b = JSON.parse(right.identityJson).operationNonce as string;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const next: CoordinatorStateSnapshot = {
      schema: COORDINATOR_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
      pendingDeliveries: current?.snapshot.pendingDeliveries ?? [],
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 修復Identityを同じ現在状態へ追加する候補を構成する。
 * @responsibility Task fieldを作らず、既存全操作と参照を保存する。
 * @trace ARCH-000008
 * @input currentBytes: 元版または初回null、identityJson: 修復固定情報、repositoryBinding: 現在結合。
 * @returns 最新v2の次版、またはnull。
 * @precondition 物理Ownerが現在Root・利用者・操作Scopeを別に確認する。
 * @postcondition 同じRepository内の未終了修復は一つだけ。
 * @effect N/A: 候補生成のみ。
 * @failure 旧Schema、Identity不正、衝突、重複修復はnull。
 * @invariant 候補から処置・排他Authorityを生成しない。
 * @boundary 修復の不変情報と現在Snapshot。
 * @security Provider・Home・任意Pathを補完しない。
 * @concurrency 元版Hashへ結合し、保存側で競合照合する。
 */
export function prepareCoordinatorStateRepairSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const hash = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const operation: CoordinatorStateRepairOperation = {
      kind: "runtime_repair",
      identityJson,
      identitySha256: hash,
      recoveryId: `docker-runtime-repair.${identity.operationNonce}.${hash}`,
      phase: "repairing",
      checkpoint: null,
      disposition: "not_applicable",
      disposal: null,
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    if (
      !validCoordinatorRepairOperation(operation, repositoryBinding as string)
    )
      return null;
    const operations = [
      ...(current?.snapshot.operations ?? []),
      operation,
    ].sort((a, b) =>
      coordinatorOperationNonce(a) < coordinatorOperationNonce(b)
        ? -1
        : coordinatorOperationNonce(a) > coordinatorOperationNonce(b)
          ? 1
          : 0,
    );
    const next = {
      schema: COORDINATOR_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
      pendingDeliveries: current?.snapshot.pendingDeliveries ?? [],
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一修復の技術値と上位状態だけを元版へ結合する。
 * @responsibility 他Task／修復・履歴・配送を変更しない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、recoveryId: exact参照、update: 修復可変五field、repositoryBinding: 現在結合。
 * @returns 検査済み次版、またはnull。
 * @precondition 実Writerが観測・保持判断の根拠を確認する。
 * @postcondition Identity・回復ID・対象外全文を保持する。
 * @effect N/A: 値検査と候補生成だけ。
 * @failure 余剰field、別kind、巻戻し・順序違反はnull。
 * @invariant 保存候補は実処置や人間判断の証明ではない。
 * @boundary 技術通知と現在状態の更新。
 * @security 任意SnapshotやTask fieldの更新を受け付けない。
 * @concurrency 元版・revision・Hashを固定する。
 */
export function prepareCoordinatorStateRepairCheckpointSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  update: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current) return null;
    const value = JSON.parse(encodeCoordinatorStateValue(update));
    if (
      !exactRecordKeys(value, [
        "phase",
        "checkpoint",
        "disposition",
        "primaryFailure",
        "outcome",
      ])
    )
      return null;
    const target = current.snapshot.operations.find(
      (item): item is CoordinatorStateRepairOperation =>
        item.kind === "runtime_repair" && item.recoveryId === recoveryId,
    );
    if (!target) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === target ? { ...item, ...value } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ未終端修復の新しい補助子取得を次版へ結合する。
 * @responsibility 回収済みの旧呼出しと新呼出しの回収義務を分ける。
 * @trace ARCH-000008
 * @input currentBytes: 元版、recoveryId: exact修復参照、repositoryBinding: 現在結合。
 * @returns cleanupだけpendingへ変えた次版、またはnull。
 * @precondition 実Ownerが同じ主体・Scopeと新Native子の取得を別途確認する。
 * @postcondition 元の一次失敗・確定結果・他操作を変更しない。
 * @effect N/A: 純粋な保存候補生成。
 * @failure 未回収、回収失敗、終端済み、一次失敗あり、別IDはnull。
 * @invariant unknownを新取得で成功へ変えず、通常遷移を緩めない。
 * @boundary 値候補と物理Writer／実Native Session。
 * @security 戻り値は取得・処置・保存の許可ではない。
 * @concurrency 元版HashとRevisionを維持し、Writerで再照合する。
 */
export function prepareCoordinatorStateRepairSessionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const target = current.snapshot.operations.find(
      (item): item is CoordinatorStateRepairOperation =>
        item.kind === "runtime_repair" && item.recoveryId === recoveryId,
    );
    if (
      target?.phase !== "repairing" ||
      target.primaryFailure !== null ||
      target.outcome !== null
    )
      return null;
    const checkpoint = prepareDockerRuntimeRepairSessionCheckpoint(
      target.checkpoint,
    );
    if (checkpoint === null) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === target ? { ...item, checkpoint } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransitionValue(
      currentBytes,
      bytes,
      repositoryBinding,
      recoveryId,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 未出版の保持判断待ちへ期限と用途別照合値を一度だけ結合する。
 * @responsibility 期限付き引渡し候補だけを専用保存から導入する。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact参照、receipt: 時刻と三用途、repositoryBinding: 現在結合。
 * @returns 一改訂の完全候補、または拒否のnull。
 * @precondition fresh読取り・明示保持・物理Ownerは呼出し元が確認する。
 * @postcondition 元結果・技術checkpoint・他操作・参照・配送は全文維持する。
 * @effect N/A: 純粋値だけ。物理保存は既存専用Writerが所有する。
 * @failure 既出版・既保持・時刻不正・用途差・非正規元版はnull。
 * @invariant 新しい保持期限を再入場や現在時計から補完しない。
 * @boundary 純粋引渡し候補と既存専用Writer。
 * @security 一般更新の許可集合を拡張しない。
 * @concurrency 元本文と版は物理保存時に別に再確認する。
 */
export function prepareCoordinatorStateRepairRetentionHandoffSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  receipt: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const target = current?.snapshot.operations.find(
      (operation): operation is CoordinatorStateRepairOperation =>
        operation.kind === "runtime_repair" &&
        operation.recoveryId === recoveryId,
    );
    const captured = JSON.parse(encodeCoordinatorStateValue(receipt));
    if (
      !current ||
      !target ||
      !Buffer.isBuffer(currentBytes) ||
      !currentBytes.equals(
        Buffer.from(`${encodeCoordinatorStateValue(current.snapshot)}\n`),
      ) ||
      target.summarySha256 !== null ||
      target.history !== null ||
      target.phase !== "awaiting_disposition" ||
      target.disposition !== "pending_human_decision" ||
      target.disposal !== null ||
      target.outcome?.status !== "recovered" ||
      target.primaryFailure !== null ||
      Object.hasOwn(target, "retention") ||
      !validCoordinatorRepairRetentionReceipt(captured) ||
      !target.checkpoint ||
      target.checkpoint.stale !== "retained" ||
      target.checkpoint.engine !== "ready" ||
      target.checkpoint.hostSafety !== "safe" ||
      target.checkpoint.cleanup !== "confirmed" ||
      target.checkpoint.cleanupFailure !== null ||
      !dockerRuntimeRepairCheckpointIsSettled(target.checkpoint) ||
      !coordinatorRepairRetentionMatchesCheckpoint(captured, target.checkpoint)
    )
      return null;
    const bytes = Buffer.from(
      `${encodeCoordinatorStateValue({
        ...current.snapshot,
        revision: current.snapshot.revision + 1,
        previous: {
          revision: current.snapshot.revision,
          payloadSha256: current.payloadSha256,
        },
        operations: current.snapshot.operations.map((operation) =>
          operation.recoveryId === recoveryId
            ? {
                ...operation,
                phase: "settling",
                disposition: "retained_by_human_decision",
                retention: captured,
              }
            : operation,
        ),
      })}\n`,
    );
    return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保持引渡し候補を元版から全文再導出する。
 * @responsibility 専用候補へ他操作や余剰更新を混入させない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、recoveryId: exact参照、repositoryBinding: 結合。
 * @returns 元版から同じreceiptを再導出した完全一致だけtrue。
 * @precondition fresh読取り・Owner・物理保存は別の責務。
 * @postcondition 一般Writerからのreceipt導入を許可しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 別ID・余剰変更・非正規本文・既出版はfalse。
 * @invariant trueを実保存・引渡し・削除許可と同一視しない。
 * @boundary 専用純粋候補と既存専用Writer境界。
 * @security 保存JSONから人間承認を復元しない。
 * @concurrency 元版の再観測は物理Writerが所有する。
 */
export function validateCoordinatorStateRepairRetentionHandoffTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): boolean {
  const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
  const target = next?.snapshot.operations.find(
    (operation): operation is CoordinatorStateRepairOperation =>
      operation.kind === "runtime_repair" &&
      operation.recoveryId === recoveryId,
  );
  if (!target?.retention || !Buffer.isBuffer(nextBytes)) return false;
  return (
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      currentBytes,
      recoveryId,
      target.retention,
      repositoryBinding,
    )?.equals(nextBytes) === true
  );
}

/**
 * fresh再入場の完全候補を元版から独立に再導出して照合する。
 * @responsibility 専用更新へ他field変更を混入させない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 保存候補、recoveryId: exact参照、repositoryBinding: 結合。
 * @returns 再導出したcanonical bytesと一致する場合だけtrue。
 * @precondition Writerが真正Ownerと現在Native取得を別途確認する。
 * @postcondition 通常Writerの更新許可を拡大しない。
 * @effect N/A: メモリ検査のみ。
 * @failure 不正元版、別ID、余分変更、非canonical候補はfalse。
 * @invariant cleanup以外の操作内容・参照・結果を保全する。
 * @boundary 専用候補と物理保存。
 * @security trueはAuthorityや実Session取得の証明ではない。
 * @concurrency N/A: 排他・元版再観測は保存Owner。
 */
export function validateCoordinatorStateRepairSessionTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): boolean {
  const expected = prepareCoordinatorStateRepairSessionSnapshot(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  return (
    expected !== null &&
    Buffer.isBuffer(nextBytes) &&
    expected.equals(nextBytes)
  );
}

/**
 * 未出版の保持判断待ちから通常回収の判断だけを確定する。
 * @responsibility 元修復結果を変更せず、後続進捗の初期値を同じ操作へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact対象、decidedAt: UTC判断時刻、repositoryBinding: 現在結合。
 * @returns 判断と初期進捗だけを追加した次版、またはnull。
 * @precondition 実Ownerと採用済み回収方針は保存側で確認する。
 * @postcondition 元checkpoint・結果・失敗・他操作・参照・配送を全文保持する。
 * @effect N/A: 純粋な候補生成だけ。
 * @failure 未完了、既保持、既出版、別ID、非正規元版・時刻はnull。
 * @invariant 各用途の削除意図はまだ未保存であり、物理処置を許可しない。
 * @boundary 上位の回収判断と専用Writerへ渡す値候補。
 * @security 通常checkpoint更新からこの判断を偽装できない。
 * @concurrency 元版Hash・改訂を固定し、物理保存は別途CASする。
 */
export function prepareCoordinatorStateRepairDisposalDecisionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  decidedAt: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  if (
    !current ||
    !Buffer.isBuffer(currentBytes) ||
    !currentBytes.equals(
      Buffer.from(`${encodeCoordinatorStateValue(current.snapshot)}\n`),
    ) ||
    typeof recoveryId !== "string" ||
    typeof decidedAt !== "string" ||
    !Number.isFinite(Date.parse(decidedAt)) ||
    new Date(decidedAt).toISOString() !== decidedAt
  )
    return null;
  const targets = current.snapshot.operations.filter(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const target = targets[0];
  if (
    targets.length !== 1 ||
    !target ||
    target.phase !== "awaiting_disposition" ||
    target.disposition !== "pending_human_decision" ||
    target.disposal !== null ||
    target.summarySha256 !== null ||
    target.history !== null ||
    target.outcome?.status !== "recovered" ||
    target.primaryFailure !== null ||
    target.checkpoint?.stale !== "retained" ||
    target.checkpoint.engine !== "ready" ||
    target.checkpoint.hostSafety !== "safe" ||
    target.checkpoint.cleanup !== "confirmed" ||
    target.checkpoint.cleanupFailure !== null ||
    !dockerRuntimeRepairCheckpointIsSettled(target.checkpoint)
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.map((item) =>
      item === target
        ? {
            ...item,
            phase: "settling",
            disposition: "discard",
            disposal: {
              decidedAt,
              checkpoint: createDockerRuntimeRepairDisposalCheckpoint(),
            },
          }
        : item,
    ),
  };
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 同じ回収判断の一用途だけに単調な技術進捗を結合する。
 * @responsibility 元修復・判断時刻・履歴と別用途を変更しない。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact対象、purpose: 固定用途、checkpoint: 次の回収値、repositoryBinding: 結合。
 * @returns 検査済み次版。同値なら改訂しない元版bytes、拒否時null。
 * @precondition 実体・Owner・保存確認と処置順序はDriver／Writerが所有する。
 * @postcondition 要約確定後は同値も拒否し、元結果は全文維持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 判断前、別ID、用途外変更、巻戻し、後続出版済みはnull。
 * @invariant 候補生成や同値返却は保存・不存在・Effect 0の実証ではない。
 * @boundary DIの値検査と既存現在状態。
 * @security 通常更新の許可集合を広げない。
 * @concurrency 元版CASと同値時の無書込み確認は物理Writerへ接続する。
 */
export function prepareCoordinatorStateRepairDisposalProgressSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  purpose: unknown,
  checkpoint: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const captured = decodeDockerRuntimeRepairDisposalCheckpoint(checkpoint);
  if (
    !current ||
    !captured ||
    !Buffer.isBuffer(currentBytes) ||
    !currentBytes.equals(
      Buffer.from(`${encodeCoordinatorStateValue(current.snapshot)}\n`),
    ) ||
    typeof recoveryId !== "string"
  )
    return null;
  const targets = current.snapshot.operations.filter(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const target = targets[0];
  if (
    targets.length !== 1 ||
    !target ||
    target.phase !== "settling" ||
    target.disposition !== "discard" ||
    !target.disposal ||
    target.summarySha256 !== null ||
    target.history !== null ||
    !validateDockerRuntimeRepairDisposalTransition(
      target.disposal.checkpoint,
      captured,
      purpose,
    )
  )
    return null;
  if (
    encodeCoordinatorStateValue(target.disposal.checkpoint) ===
    encodeCoordinatorStateValue(captured)
  )
    return Buffer.from(currentBytes);
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.map((item) =>
      item === target
        ? {
            ...item,
            disposal: { ...target.disposal, checkpoint: captured },
          }
        : item,
    ),
  };
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 専用回収候補を元版から再導出して全文照合する。
 * @responsibility decisionと一用途progressを通常保存・任意Snapshotから分離する。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、recoveryId: exact参照、purpose: decisionまたは固定用途、repositoryBinding: 結合。
 * @returns 専用候補と正規bytesが完全一致する場合だけtrue。
 * @precondition 物理Owner・CAS・purposeと保存入口の結合はWriterが別に確認する。
 * @postcondition 候補に含まれる時刻以外の新しい判断情報を推測しない。
 * @effect N/A: メモリ内の値再導出だけ。
 * @failure 別対象、別用途、他field差、非正規候補はfalse。
 * @invariant 同値progressは元版bytesだけを許し、改訂を増やさない。
 * @boundary 専用候補と物理Writer／保存再入場。
 * @security trueは処置・実保存の許可ではない。
 * @concurrency 元版・候補の複製と再観測は物理保存側の責務。
 */
export function validateCoordinatorStateRepairDisposalTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  purpose: unknown,
  repositoryBinding: unknown,
): boolean {
  const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
  const target = next?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!target?.disposal || !Buffer.isBuffer(nextBytes)) return false;
  const expected =
    purpose === "decision"
      ? prepareCoordinatorStateRepairDisposalDecisionSnapshot(
          currentBytes,
          recoveryId,
          target.disposal.decidedAt,
          repositoryBinding,
        )
      : prepareCoordinatorStateRepairDisposalProgressSnapshot(
          currentBytes,
          recoveryId,
          purpose,
          target.disposal.checkpoint,
          repositoryBinding,
        );
  return expected?.equals(nextBytes) === true;
}

/**
 * exact修復の保存途中本文を既存候補から再導出する。
 * @responsibility 出版可能なmetadataと技術再開の許可を分離する。
 * @trace ARCH-000008
 * @input currentBytes: 明示不存在または元版、pendingBytes: 短命候補、recoveryId: exact参照、repositoryBinding: 現在結合。
 * @returns 一意な出版種別と元版・候補の複製、またはnull。
 * @precondition 物理OwnerがRoot・実体・排他・markerを別に確認する。
 * @postcondition 新しい観測・処置・人間判断を生成しない。
 * @effect N/A: メモリ内の再導出だけ。
 * @failure 非canonical・別対象・非対象変更・複数解釈はnull。
 * @invariant 初回は単一の空Repairだけ、既出版同値は改訂不変。
 * @boundary pending metadataと物理Writer。
 * @security 結果はNative・Dockerの実行許可ではない。
 * @concurrency 元版と実体の再照合はWriterが行う。
 */
export function classifyCoordinatorRepairPublication(
  currentBytes: unknown,
  pendingBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
) {
  if (!Buffer.isBuffer(pendingBytes) || typeof recoveryId !== "string")
    return null;
  const next = decodeCoordinatorStateSnapshot(pendingBytes, repositoryBinding);
  const before =
    currentBytes === null
      ? null
      : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
  if (
    !next ||
    (currentBytes !== null && !before) ||
    !pendingBytes.equals(
      Buffer.from(`${encodeCoordinatorStateValue(next.snapshot)}\n`),
    ) ||
    (before &&
      (!Buffer.isBuffer(currentBytes) ||
        !currentBytes.equals(
          Buffer.from(`${encodeCoordinatorStateValue(before.snapshot)}\n`),
        )))
  )
    return null;
  const targets = next.snapshot.operations.filter(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (targets.length !== 1) return null;
  const target = targets[0];
  if (!target) return null;
  const modes: (
    | "initial_publication"
    | "identity"
    | "checkpoint"
    | "session_begin"
    | "retention_handoff"
    | "disposal_decision"
    | "disposal_primary"
    | "disposal_failed"
    | "disposal_auxiliary"
    | "remove_pending"
  )[] = [];
  if (Buffer.isBuffer(currentBytes) && pendingBytes.equals(currentBytes))
    modes.push("remove_pending");
  else {
    const prior = before?.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (!prior) {
      const expected = prepareCoordinatorStateRepairSnapshot(
        currentBytes,
        target.identityJson,
        repositoryBinding,
      );
      if (
        expected?.equals(pendingBytes) &&
        (before !== null ||
          (next.snapshot.operations.length === 1 &&
            next.snapshot.unresolvedRecoveries.length === 0 &&
            next.snapshot.pendingDeliveries.length === 0))
      )
        modes.push(before ? "identity" : "initial_publication");
    } else if (prior.kind === "runtime_repair") {
      const expected = prepareCoordinatorStateRepairCheckpointSnapshot(
        currentBytes,
        recoveryId,
        {
          phase: target.phase,
          checkpoint: target.checkpoint,
          disposition: target.disposition,
          primaryFailure: target.primaryFailure,
          outcome: target.outcome,
        },
        repositoryBinding,
      );
      if (expected?.equals(pendingBytes)) modes.push("checkpoint");
      if (
        validateCoordinatorStateRepairRetentionHandoffTransition(
          currentBytes,
          pendingBytes,
          recoveryId,
          repositoryBinding,
        )
      )
        modes.push("retention_handoff");
      if (
        prepareCoordinatorStateRepairSessionSnapshot(
          currentBytes,
          recoveryId,
          repositoryBinding,
        )?.equals(pendingBytes)
      )
        modes.push("session_begin");
      for (const purpose of [
        "decision",
        "primary",
        "failed",
        "auxiliary",
      ] as const) {
        if (
          validateCoordinatorStateRepairDisposalTransition(
            currentBytes,
            pendingBytes,
            recoveryId,
            purpose,
            repositoryBinding,
          )
        )
          modes.push(`disposal_${purpose}`);
      }
    }
  }
  if (modes.length !== 1 || !modes[0]) return null;
  return Object.freeze({
    mode: modes[0],
    before: Buffer.isBuffer(currentBytes) ? Buffer.from(currentBytes) : null,
    candidate: Buffer.from(pendingBytes),
  });
}

/**
 * 同じ回復参照の指定checkpointだけを次のSnapshotへ接続する。
 *
 * @responsibility 要求前・発行後・作成結果と現在観測の構造的な遷移を保存候補へ搬送する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文。recoveryId: exact参照。resourceValue: 完全評価。repositoryBinding: 検証済み結合。kind: 資源・Host・実行終端の固定種別。
 * @returns 遷移検査済みの次版byte列、またはnull。
 * @precondition 現在観測と要求の発行事実は呼出し側の実行境界で取得する。
 * @postcondition 指定したcheckpoint以外を保持し、一次失敗・確定結果の不許可更新を拒否する。
 * @effect N/A: 純粋な値変換だけ。保存やDocker要求を発行しない。
 * @failure 不正値・別参照・不正遷移・改訂上限をnullで拒否する。
 * @invariant unknownを成功や再発行許可に変換せず、既知の作成Identityを置換しない。
 * @boundary 実行境界の観測値と固定Snapshotの間。
 * @security 保存値から実資源不存在やAuthorityを推定しない。
 * @concurrency 元版相関を保持し、Writerで競合確認と排他を行う。
 */
function prepareCoordinatorStateOperationCheckpoint(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
  kind: "resource" | "host" | "lifecycle" | "restart",
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const resource = JSON.parse(encodeCoordinatorStateValue(resourceValue));
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      (kind === "resource" &&
        !operation.resources.some(
          (item) => item.purpose === resource?.purpose,
        )) ||
      (kind === "lifecycle" &&
        !exactRecordKeys(resource, [
          "phase",
          "lease",
          "execution",
          "primaryFailure",
          "outcome",
          "summarySha256",
        ]))
    )
      return null;
    if (
      kind === "resource" &&
      resource?.request === "unknown" &&
      resource?.observation === "absent" &&
      !operation.resources.some(
        (item) =>
          encodeCoordinatorStateValue(item) ===
          encodeCoordinatorStateValue(resource),
      )
    )
      return null;
    if (
      kind === "lifecycle" &&
      resource.summarySha256 !== operation.summarySha256
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item.kind !== "docker_task" || item !== operation
          ? item
          : {
              ...item,
              dockerRestart: kind === "restart" ? resource : item.dockerRestart,
              ...(kind === "lifecycle" ? resource : {}),
              host: kind === "host" ? resource : item.host,
              resources:
                kind !== "resource"
                  ? item.resources
                  : item.resources.map((before) =>
                      before.purpose === resource.purpose ? resource : before,
                    ),
            },
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一資源の評価だけを次版へ搬送する。
 *
 * @responsibility 固定資源purposeと現在操作のcheckpointを相関する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。resourceValue: 一資源評価。repositoryBinding: 現在結合。
 * @returns 遷移検査済みの次版、またはnull。
 * @precondition 評価は実行Ownerが取得する。
 * @postcondition 他資源とHost・結果は変更しない。
 * @effect N/A: 純粋な値変換だけ。
 * @failure 不正値、別参照・結合と不許可遷移を拒否する。
 * @invariant ID・要求の既知事実を消さない。
 * @boundary 実行評価と保存候補。
 * @security 値変換を資源観測やAuthorityへ昇格しない。
 * @concurrency 元版Hashを保持し、Writerで競合照合する。
 */
export function prepareCoordinatorStateResourceSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    resourceValue,
    repositoryBinding,
    "resource",
  );
}

/**
 * Hostの処置前記録と観測済み次世代を次版へ搬送する。
 *
 * @responsibility 保存済み遷移意図を経ない世代変更と未確定意図の消去を拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。hostValue: Host現在評価。repositoryBinding: 現在結合。
 * @returns lineageと改訂遷移を検査した次版、またはnull。
 * @precondition Hostの実体、処置と受理結果は既存Host Ownerが確認する。
 * @postcondition 同じ操作のHostだけを更新し、他checkpointを保持する。
 * @effect N/A: 値変換のみ。Host処置や保存は行わない。
 * @failure 別世代、処置前記録欠測、不正本文と不許可遷移はnull。
 * @invariant 処置前意図から完了を推定せず、unknownを成功へ丸めない。
 * @boundary Host Ownerの確定記録とSnapshot候補。
 * @security Host TokenとJSONを処置Authorityとして扱わない。
 * @concurrency 元版相関を保持し、実保存時に再照合を要求する。
 */
export function prepareCoordinatorStateHostSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  hostValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    hostValue,
    repositoryBinding,
    "host",
  );
}

/**
 * 実行・Lease・一次失敗・最終結果の現在評価を次版へ搬送する。
 *
 * @responsibility 実行checkpointの閉じたfield集合を更新し、固定Identity・資源・Hostを保持する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。lifecycleValue: 固定六fieldの現在評価。repositoryBinding: 現在結合。
 * @returns 既知事実保持と改訂遷移を検査した次版、またはnull。
 * @precondition 実行とLeaseの現在事実は各Ownerが取得している。
 * @postcondition 一次失敗・確定結果・要約Hashの上書きと既知Effectの未発行化を拒否する。
 * @effect N/A: 値変換だけ。Provider実行・Lease操作・保存は行わない。
 * @failure 未評価field、不正値、別結合と不許可遷移はnull。
 * @invariant 過去unknownを未発行へ戻さず、後続回収で最初の失敗を消さない。
 * @boundary 実行Ownerの現在評価とSnapshot保存候補。
 * @security 保存結果を資源不存在、Authority失効やLease解放の実証にしない。
 * @concurrency 元版Hashへ結合し、Writerの排他とfresh照合を要求する。
 */
export function prepareCoordinatorStateLifecycleSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  lifecycleValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    lifecycleValue,
    repositoryBinding,
    "lifecycle",
  );
}

/**
 * 同じ操作の単一再起動checkpointを次版へ搬送する。
 * @responsibility 固定要求ID・Scopeと許容組合せを他の操作から分離する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、checkpoint、repositoryBinding: 元版とexact対象。
 * @returns 遷移確認済みの次版、またはnull。
 * @precondition 実行許可・同Owner観測・Host排他は呼出し側が別に確認する。
 * @postcondition Task一次失敗・結果・他操作を変更しない。
 * @effect N/A: 保存候補の値変換だけ。
 * @failure 別要求・不正組合せ・元版不一致はnull。
 * @invariant 一操作一要求。保存値から要求を再発行しない。
 * @boundary 再起動Ownerの観測と現在Snapshot。
 * @security Hash・保存成功を操作Authorityにしない。
 * @concurrency 元版相関と既存Writer排他を要求する。
 */
export function prepareCoordinatorStateRestartSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  checkpoint: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    checkpoint,
    repositoryBinding,
    "restart",
  );
}

/**
 * 五資源の回収観測を同じ改訂版へまとめる。
 *
 * @responsibility 未要求、exact IDの不存在と観測不能を区別して保存候補へ接続する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。observationsValue: 固定五資源の回収結果。repositoryBinding: 現在結合。
 * @returns 全資源の相関と遷移が成立する次版、またはnull。
 * @precondition 呼出し側が現在の回収結果を実行Ownerから取得している。
 * @postcondition 全五資源を一回の改訂で更新し、他操作とHost・実行結果を保持する。
 * @effect N/A: 値変換だけ。資源削除や保存は行わない。
 * @failure 欠測、重複、別名・別ID、未要求の偽装と不正遷移を拒否する。
 * @invariant ID未確定の不存在を通常回収の成立へ昇格しない。
 * @boundary 回収Ownerの観測と現在状態の保存候補。
 * @security 観測のHashは相関用であり、実不存在やAuthorityの証明ではない。
 * @concurrency 全結果を同じ元版へ結合し、物理Writerの競合照合を要求する。
 */
export function prepareCoordinatorStateCleanupSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const observations = JSON.parse(
      encodeCoordinatorStateValue(observationsValue),
    );
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation || !Array.isArray(observations) || observations.length !== 5)
      return null;
    const identity = JSON.parse(operation.identityJson);
    const resources = operation.resources.map((resource, index) => {
      const observed = observations[index];
      if (
        !exactRecordKeys(observed, [
          "purpose",
          "plannedResourceName",
          "dockerId",
          "observation",
        ]) ||
        observed.purpose !== resource.purpose ||
        observed.plannedResourceName !==
          identity.resources[purposeResource[resource.purpose]] ||
        observed.dockerId !== resource.dockerId ||
        !["not_requested", "absent", "unknown"].includes(observed.observation)
      )
        throw new Error("coordinator_state_cleanup_invalid");
      if (observed.observation === "not_requested") {
        if (
          !["not_requested", "not_issued"].includes(resource.request) ||
          resource.dockerId !== null
        )
          throw new Error("coordinator_state_cleanup_invalid");
        return resource;
      }
      if (
        ["not_requested", "not_issued"].includes(resource.request) ||
        (observed.observation === "absent" && resource.request !== "identified")
      )
        throw new Error("coordinator_state_cleanup_invalid");
      return {
        ...resource,
        observation: observed.observation,
        absence:
          observed.observation === "absent"
            ? {
                recoveryId,
                purpose: resource.purpose,
                plannedResourceName: observed.plannedResourceName,
                dockerId: resource.dockerId,
                evidenceSha256: createHash("sha256")
                  .update(
                    encodeCoordinatorStateValue({
                      recoveryId,
                      previousPayloadSha256: current.payloadSha256,
                      observation: observed,
                    }),
                  )
                  .digest("hex"),
              }
            : null,
      };
    });
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation ? { ...item, resources } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ操作の回収義務と結果受理checkpointを次版へ搬送する。
 *
 * @responsibility 他操作を保持し、exact回復参照と結果Identityを現在集合へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。referencesValue: recoveryとdeliveries。repositoryBinding: 現在結合。
 * @returns 構造・相関・遷移を確認した次版、またはnull。
 * @precondition 義務と耐久受理根拠は各Ownerが取得する。
 * @postcondition 同じ操作の参照だけを更新し、未確定の削除と受理Hashの巻戻しを拒否する。
 * @effect N/A: 純粋な値変換。搬送・受理・削除は発行しない。
 * @failure 不正入力、他操作参照、既知結果変更と不許可除去はnull。
 * @invariant 受理記録の存在を実受理へ読み替えず、未解決義務を期限で消さない。
 * @boundary 終端・Consumer Ownerと現在状態の参照集合。
 * @security 回復参照を新Authorityや外部への開示許可にしない。
 * @concurrency 元版Hashに結合し、Writerの競合確認を要求する。
 */
export function prepareCoordinatorStateReferencesSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  referencesValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const nonce = parseDockerTaskRecoveryId(recoveryId)?.operationNonce;
    const references = JSON.parse(encodeCoordinatorStateValue(referencesValue));
    if (
      !operation ||
      !nonce ||
      !exactRecordKeys(references, ["recovery", "deliveries"]) ||
      !Array.isArray(references.deliveries)
    )
      return null;
    const recovery = references.recovery;
    if (
      (recovery !== null &&
        (recovery.operationNonce !== nonce ||
          recovery.recoveryId !== recoveryId)) ||
      references.deliveries.some(
        (delivery: { operationNonce: unknown; recoveryId: unknown } | null) =>
          !delivery ||
          delivery.operationNonce !== nonce ||
          delivery.recoveryId !== recoveryId,
      )
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      unresolvedRecoveries: [
        ...current.snapshot.unresolvedRecoveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...(recovery === null ? [] : [recovery]),
      ].sort((a, b) =>
        a.operationNonce < b.operationNonce
          ? -1
          : a.operationNonce > b.operationNonce
            ? 1
            : 0,
      ),
      pendingDeliveries: [
        ...current.snapshot.pendingDeliveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...references.deliveries,
      ].sort((a, b) => {
        const first = `${a.operationNonce}:${a.consumer}`;
        const second = `${b.operationNonce}:${b.consumer}`;
        return first < second ? -1 : first > second ? 1 : 0;
      }),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存済み操作から終了要約の候補内容だけを導出する。
 * @responsibility 相関、一次失敗、最終結果と清掃状態を上書きせず要約へ分離する。
 * @trace ARCH-000008
 * @input currentBytes: 正規Snapshot、recoveryId: exact対象、repositoryBinding: 検証済み結合。
 * @returns 正規要約本文、要約Hashと導出元Hash、またはnull。
 * @precondition 対象は実行中でなく最終結果が保存されている。
 * @postcondition 元Snapshotを変更せず、固定・履歴保存の許可を発行しない。
 * @effect N/A: メモリ内の導出だけ。
 * @failure 不正Snapshot、別対象、未確定結果、確定要約との不一致はnull。
 * @invariant 一次失敗と清掃不明を保持し、返却値を要約固定・保存・操作除去の許可にしない。
 * @boundary 現在状態から非Authorityの終了履歴内容。
 * @security 任意要約、任意Path、外部出力や回復権限を受けない。
 * @concurrency 導出元Hashを返し、物理Writerで元版の再照合を要求する。
 */
export function prepareCoordinatorStateHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Readonly<{
  summaryBytes: Buffer;
  summarySha256: string;
  sourcePayloadSha256: string;
}> | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation || operation.phase === "executing" || !operation.outcome)
      return null;
    const summaryBytes = coordinatorOperationSummaryBytes(operation);
    const summarySha256 = createHash("sha256")
      .update(summaryBytes)
      .digest("hex");
    if (
      operation.summarySha256 !== null &&
      operation.summarySha256 !== summarySha256
    )
      return null;
    return Object.freeze({
      summaryBytes,
      summarySha256,
      sourcePayloadSha256: current.payloadSha256,
    });
  } catch {
    return null;
  }
}

/**
 * 固定済み終端要約を結果IDとして必要搬送先を登録する候補を作る。
 *
 * @responsibility 結果本文を既存操作要約へ限定し、時刻・File Identity・全体改訂を結果IDから除外する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、consumersValue: 必要搬送先、repositoryBinding: 現在結合。
 * @returns 同じ結果を未受理で登録する次版、同じ登録の元版、またはnull。
 * @precondition 終端要約Hashは真正終端Writerが固定済みである。
 * @postcondition 再登録で受理を巻き戻さず、結果・必要集合を差し替えない。
 * @effect N/A: メモリ内候補の構築だけ。
 * @failure 未終端・未固定、保存Consumerと異なる集合・重複・未知Consumerを拒否する。
 * @invariant 候補生成を実清掃・Consumer受理・保存成立へ昇格しない。
 * @boundary 終端要約と現在状態の結果搬送集合。
 * @security 任意結果本文・Path・受理Hashを受け付けない。
 * @concurrency 元版と真正終端の共同照合は物理Writerが行う。
 */
export function prepareCoordinatorStateResultDeliverySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  consumersValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const summary = prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const consumers = JSON.parse(encodeCoordinatorStateValue(consumersValue));
    const identity = operation ? JSON.parse(operation.identityJson) : null;
    const requiredConsumers =
      identity?.consumer === "orchestrator" ? ["orchestrator"] : [];
    if (
      !current ||
      !summary ||
      !operation ||
      operation.summarySha256 !== summary.summarySha256 ||
      operation.outcome?.cleanupConfirmed !== true ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation) ||
      !Array.isArray(consumers) ||
      encodeCoordinatorStateValue(consumers) !==
        encodeCoordinatorStateValue(requiredConsumers)
    )
      return null;
    const nonce = identity.operationNonce;
    if (requiredConsumers.length === 0)
      return Buffer.from(currentBytes as Buffer);
    const existingEntries = current.snapshot.pendingDeliveries.filter(
      (item) => item.operationNonce === nonce,
    );
    if (existingEntries.length !== 0) {
      return existingEntries.length === consumers.length &&
        existingEntries.every(
          (item, index) =>
            item.consumer === consumers[index] &&
            item.resultId === summary.summarySha256 &&
            item.recoveryId === recoveryId,
        )
        ? Buffer.from(currentBytes as Buffer)
        : null;
    }
    return prepareCoordinatorStateReferencesSnapshot(
      currentBytes,
      recoveryId,
      {
        recovery:
          current.snapshot.unresolvedRecoveries.find(
            (item) => item.operationNonce === nonce,
          ) ?? null,
        deliveries: consumers.map((consumer) => ({
          operationNonce: nonce,
          recoveryId,
          resultId: summary.summarySha256,
          consumer,
          acceptanceSha256: null,
        })),
      },
      repositoryBinding,
    );
  } catch {
    return null;
  }
}

/**
 * 固定十一項目の上位受理本文を同じRepositoryへ照合する。
 * @responsibility 受理候補と整理済み観測で同じ値契約を使用する。
 * @trace ARCH-000008
 * @input value: 固定上位Readerの本文、repositoryBinding: 現在Repository結合。
 * @returns 正規JSONの受理本文、またはnull。
 * @precondition 上位の実保存と現在Attemptの照合は上位Readerが所有する。
 * @postcondition 旧形式・追加項目・別Repositoryを受理しない。
 * @effect N/A: メモリ内の符号化と検証だけ。
 * @failure 不正値・accessor・Proxy・分類不一致はnull。
 * @invariant 本文の妥当性を耐久保存や処置Authorityへ昇格しない。
 * @boundary 上位受理の固定値契約。
 * @security 自由本文・Path・秘密値を許可しない。
 * @concurrency N/A: 同期の値検査だけ。
 */
export function decodeCoordinatorProjectAcceptance(
  value: unknown,
  repositoryBinding: unknown,
) {
  try {
    const acknowledgement = JSON.parse(encodeCoordinatorStateValue(value));
    if (
      !exactRecordKeys(acknowledgement, [
        "repositoryBindingId",
        "projectId",
        "milestoneId",
        "taskId",
        "attemptId",
        "operationId",
        "recoveryId",
        "settlementGeneration",
        "repositoryBinding",
        "resultId",
        "consumer",
      ]) ||
      acknowledgement.consumer !== "orchestrator" ||
      acknowledgement.repositoryBinding !== repositoryBinding ||
      !isSha256Hex(acknowledgement.repositoryBinding) ||
      !isSha256Hex(acknowledgement.resultId) ||
      !Number.isSafeInteger(acknowledgement.settlementGeneration) ||
      acknowledgement.settlementGeneration < 1 ||
      [
        "repositoryBindingId",
        "projectId",
        "milestoneId",
        "taskId",
        "attemptId",
        "operationId",
        "recoveryId",
      ].some(
        (key) =>
          typeof acknowledgement[key] !== "string" ||
          acknowledgement[key].length === 0 ||
          acknowledgement[key].length > 1024,
      )
    )
      return null;
    return acknowledgement;
  } catch {
    return null;
  }
}

/**
 * 保存済み上位受理本文から一搬送の受理候補を導出する。
 * @responsibility 十一項目の閉集合と固定結果の相関、初回受理Hashの不変性を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、acknowledgementValue: 上位Readerの受理本文、repositoryBinding: 現在結合。
 * @returns 対象一搬送だけを受理する次版、同じ受理の元版、またはnull。
 * @precondition 物理Writerが上位保存・排他解放・fresh読戻しを別途確認する。
 * @postcondition 他搬送・回復義務・操作を維持し、初回受理を差し替えない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 旧形式、追加項目、別結合・結果・操作、未登録搬送と受理差替えはnull。
 * @invariant 候補生成や入力Hashを実保存・受理Authorityへ昇格しない。
 * @boundary 上位受理本文と下位の固定結果搬送。
 * @security Path、時刻、File Identity、自己Hashを本文へ混ぜない。
 * @concurrency 更新排他内のfresh上位読戻しと元版照合は物理Writerが所有する。
 */
export function prepareCoordinatorStateProjectAcceptanceSnapshot(
  currentBytes: unknown,
  acknowledgementValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const acknowledgement = decodeCoordinatorProjectAcceptance(
      acknowledgementValue,
      repositoryBinding,
    );
    if (!acknowledgement) return null;
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item) => item.recoveryId === acknowledgement.recoveryId,
    );
    const identity = operation ? JSON.parse(operation.identityJson) : null;
    if (
      !current ||
      !operation ||
      (identity.recoveryCorrelationId ?? identity.operationId) !==
        acknowledgement.operationId
    )
      return null;
    const deliveries = current.snapshot.pendingDeliveries.filter(
      (item) => item.recoveryId === acknowledgement.recoveryId,
    );
    const registered = prepareCoordinatorStateResultDeliverySnapshot(
      currentBytes,
      acknowledgement.recoveryId,
      deliveries.map((item) => item.consumer),
      repositoryBinding,
    );
    const target = deliveries.find((item) => item.consumer === "orchestrator");
    if (
      !registered?.equals(currentBytes as Buffer) ||
      !target ||
      target.resultId !== acknowledgement.resultId
    )
      return null;
    const acceptanceSha256 = createHash("sha256")
      .update(`${encodeCoordinatorStateValue(acknowledgement)}\n`, "utf8")
      .digest("hex");
    if (target.acceptanceSha256 !== null)
      return target.acceptanceSha256 === acceptanceSha256
        ? Buffer.from(currentBytes as Buffer)
        : null;
    return prepareCoordinatorStateReferencesSnapshot(
      currentBytes,
      acknowledgement.recoveryId,
      {
        recovery:
          current.snapshot.unresolvedRecoveries.find(
            (item) => item.recoveryId === acknowledgement.recoveryId,
          ) ?? null,
        deliveries: deliveries.map((item) =>
          item === target ? { ...item, acceptanceSha256 } : item,
        ),
      },
      repositoryBinding,
    );
  } catch {
    return null;
  }
}

/**
 * 検証済み操作の要約本文を一意に符号化する。
 * @responsibility 内容Hashと履歴行Hashの共通の内容投影を所有する。
 * @trace ARCH-000008
 * @input operation: 復号済み操作。
 * @returns 正規UTF-8本文と末尾LF。
 * @precondition 呼出し元が操作構造を検証する。
 * @postcondition history確認情報とPathを本文へ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正JSON値は例外。
 * @invariant 確認済み更新で履歴行の内容を変えない。
 * @boundary 現在状態と要約内容。
 * @security 非Authorityの内容だけを返す。
 * @concurrency N/A: 保存を行わない。
 */
function coordinatorOperationSummaryBytes(
  operation: CoordinatorStateTaskOperation,
): Buffer {
  const identity = JSON.parse(operation.identityJson);
  const legacy = (schema: string) => ({
    schema,
    ...(operation.dockerRestart === null
      ? {}
      : { dockerRestart: operation.dockerRestart }),
    operationId: identity.operationId,
    operationNonce: identity.operationNonce,
    recoveryId: operation.recoveryId,
    identitySha256: operation.identitySha256,
    primaryFailure: operation.primaryFailure,
    execution: operation.execution,
    outcome: operation.outcome,
    hostCleanup: operation.host.cleanup,
    lease: operation.lease,
  });
  const oldBytes = Buffer.from(
    `${encodeCoordinatorStateValue(legacy(operation.dockerRestart === null ? "crdd-coordinator/operation-summary/v2" : "crdd-coordinator/operation-summary/v3"))}\n`,
  );
  if (
    (identity.consumer !== "workbench" &&
      identity.consumer !== "coordinator_cli") ||
    typeof identity.recoveryCorrelationId !== "string"
  )
    return oldBytes;
  if (
    operation.summarySha256 !== null &&
    createHash("sha256").update(oldBytes).digest("hex") ===
      operation.summarySha256
  )
    return oldBytes;
  return Buffer.from(
    `${encodeCoordinatorStateValue({
      schema: "crdd-coordinator/operation-summary/v4",
      consumer: identity.consumer,
      recoveryCorrelationId: identity.recoveryCorrelationId ?? null,
      ...(operation.dockerRestart === null
        ? {}
        : { dockerRestart: operation.dockerRestart }),
      operationId: identity.operationId,
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      identitySha256: operation.identitySha256,
      primaryFailure: operation.primaryFailure,
      execution: operation.execution,
      outcome: operation.outcome,
      hostCleanup: operation.host.cleanup,
      lease: operation.lease,
    })}\n`,
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
function coordinatorRepairCanSummarize(
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
function coordinatorRepairSummaryBytes(
  operation: CoordinatorStateRepairOperation,
): Buffer {
  const identity = JSON.parse(operation.identityJson);
  const checkpoint = operation.checkpoint;
  if (!checkpoint) throw new Error("repair_checkpoint_missing");
  return Buffer.from(
    `${encodeCoordinatorStateValue({
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
function coordinatorRepairHistoryLineBytes(
  operation: CoordinatorStateRepairOperation,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeCoordinatorStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(
        coordinatorRepairSummaryBytes(operation).toString("utf8"),
      ),
    })}\n`,
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
function validCoordinatorRepairSummary(value: unknown): boolean {
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
 * 検証済み修復の非Authority要約と導出元Hashを返す。
 * @responsibility Task用要約関数へ修復を渡さない。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文、recoveryId: exact修復、repositoryBinding: 現在結合。
 * @returns 要約bytes・Hashと導出元Hash、またはnull。
 * @precondition 物理Owner・実修復は別に確認する。
 * @postcondition 固定済み要約との不一致を拒否する。
 * @effect N/A: メモリ内導出。
 * @failure 未終端・保持未決・別対象・Hash差はnull。
 * @invariant 要約生成は保存や操作除去の許可ではない。
 * @boundary 現在状態から履歴投影。
 * @security 任意要約やPathを入力に持たない。
 * @concurrency 導出元Hashを物理Writerで再照合する。
 */
export function prepareCoordinatorRepairHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
) {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!current || !operation || !coordinatorRepairCanSummarize(operation))
    return null;
  const summaryBytes = coordinatorRepairSummaryBytes(operation);
  const summarySha256 = createHash("sha256").update(summaryBytes).digest("hex");
  if (
    operation.summarySha256 !== null &&
    operation.summarySha256 !== summarySha256
  )
    return null;
  return Object.freeze({
    summaryBytes,
    summarySha256,
    sourcePayloadSha256: current.payloadSha256,
  });
}

/**
 * 修復の初回時刻と両Hashを固定する候補を生成する。
 * @responsibility 未確認から確認済みへの専用遷移だけを作る。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、occurredAt、confirmed、repositoryBinding: 固定元版・対象・時刻・確認値・結合。
 * @returns 次版または同じ確認状態の元版、拒否時null。
 * @precondition 実保存読戻しは専用物理Ownerが確認する。
 * @postcondition 技術値・時刻・Hash・他操作を変更しない。
 * @effect N/A: 値候補生成のみ。
 * @failure 初回true、時刻差、巻戻し、未終端はnull。
 * @invariant true候補は実保存の根拠ではない。
 * @boundary 修復終了と単一状態の履歴相関。
 * @security Task配送や架空資源情報を作らない。
 * @concurrency 元版全文は既存Writer内で再確認する。
 */
export function prepareCoordinatorRepairHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const summary = prepareCoordinatorRepairHistorySummary(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  if (
    !current ||
    !operation ||
    !summary ||
    typeof occurredAt !== "string" ||
    !Number.isFinite(Date.parse(occurredAt)) ||
    new Date(occurredAt).toISOString() !== occurredAt ||
    typeof confirmed !== "boolean" ||
    (operation.retention !== undefined &&
      occurredAt !== operation.retention.decidedAt)
  )
    return null;
  if (operation.history) {
    if (
      operation.history.occurredAt !== occurredAt ||
      (operation.history.confirmed && !confirmed)
    )
      return null;
    if (operation.history.confirmed === confirmed)
      return Buffer.from(`${encodeCoordinatorStateValue(current.snapshot)}\n`);
  } else if (confirmed) return null;
  const history = {
    occurredAt,
    lineSha256: createHash("sha256")
      .update(coordinatorRepairHistoryLineBytes(operation, occurredAt))
      .digest("hex"),
    confirmed,
  };
  const candidate = Buffer.from(
    `${encodeCoordinatorStateValue({
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation
          ? { ...item, summarySha256: summary.summarySha256, history }
          : item,
      ),
    })}\n`,
  );
  return validateCoordinatorStateTransition(
    currentBytes,
    candidate,
    repositoryBinding,
  )
    ? candidate
    : null;
}

/**
 * 修復の固定済み相関から同じ履歴行を導出する。
 * @responsibility 再入場でも初回時刻と行Hashを維持する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文、recoveryId: exact修復、repositoryBinding: 結合。
 * @returns 固定したLF付き行、またはnull。
 * @precondition 初回時刻とHashが現在状態へ保存済み。
 * @postcondition confirmedの前後で同じ行を返す。
 * @effect N/A: メモリ内導出。
 * @failure 未固定・別対象・不正相関はnull。
 * @invariant 行の存在・実保存を主張しない。
 * @boundary 現在状態と履歴Writer。
 * @security 任意本文・時刻を受け付けない。
 * @concurrency 物理照合は既存Writerが行う。
 */
export function prepareCoordinatorRepairHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  return operation?.history
    ? coordinatorRepairHistoryLineBytes(operation, operation.history.occurredAt)
    : null;
}

/**
 * 履歴Bufferのown methodやaccessorを評価せず内容を捕捉する。
 * @responsibility 偽equals・偽length・Proxyを保存候補比較へ使わない。
 * @trace ARCH-000008
 * @input input: 履歴canonicalまたはpendingのBuffer候補。
 * @returns 上限内の独立したBuffer、拒否時null。
 * @precondition 呼出し元が不存在を空Bufferへ明示変換する。
 * @postcondition 元Bufferやdescriptorを変更しない。
 * @effect N/A: メモリ内複製。
 * @failure Proxy・非Buffer・長さ不正・上限超過はnull。
 * @invariant 呼出し側のequals結果を信頼しない。
 * @boundary 未信頼byte入力と純粋な履歴再導出。
 * @security 外部入力のgetter・thenableを実行しない。
 * @concurrency N/A: 同期捕捉。
 */
function copyCoordinatorRepairHistoryBytes(input: unknown): Buffer | null {
  try {
    if (types.isProxy(input) || !Buffer.isBuffer(input)) return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
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
    return Buffer.from(new Uint8Array(buffer, offset, length));
  } catch {
    return null;
  }
}

/**
 * 修復の未確認行と保存途中全文から専用出版候補を再導出する。
 * @responsibility 固定時刻・内容と期間整理を同じ元版へ結合する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、historyBytes、pendingBytes、retentionDays、repositoryBinding: 現在状態・対象・履歴・短命候補・日数・結合。
 * @returns 確認次版とcanonical履歴候補、またはnull。
 * @precondition 実体・Owner・設定と読戻しは専用物理Writerが確認する。
 * @postcondition 同じ行の重複追記・時刻変更を行わない。
 * @effect N/A: 独立Bufferの値導出だけ。
 * @failure 不正行、同ID異内容、重複、pending全文差、設定不正はnull。
 * @invariant 確認済み欠測を新たな出版成功へ変換しない。
 * @boundary 修復の固定履歴相関と共通JSONL保存。
 * @security Task管理資格・任意Pathを合成しない。
 * @concurrency 元版・設定・全文の再照合は既存物理Writerが行う。
 */
export function prepareCoordinatorRepairHistoryPublication(
  currentBytes: unknown,
  recoveryId: unknown,
  historyBytes: unknown,
  pendingBytes: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
) {
  const canonical = copyCoordinatorRepairHistoryBytes(historyBytes);
  const pending =
    pendingBytes === null
      ? null
      : copyCoordinatorRepairHistoryBytes(pendingBytes);
  if (!canonical || (pendingBytes !== null && !pending)) return null;
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!current || !operation?.history || operation.history.confirmed)
    return null;
  const line = prepareCoordinatorRepairHistoryLine(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  const snapshotBytes = prepareCoordinatorRepairHistorySnapshot(
    currentBytes,
    recoveryId,
    operation.history.occurredAt,
    true,
    repositoryBinding,
  );
  const rows = decodeCoordinatorHistoryRows(canonical);
  if (!line || !snapshotBytes || !rows) return null;
  const existing = rows.find((row) => row.recoveryId === recoveryId);
  if (existing && !Buffer.from(existing.line).equals(line)) return null;
  const candidateHistory = prepareCoordinatorHistoryRetention(
    currentBytes,
    existing ? canonical : Buffer.concat([canonical, line]),
    operation.history.occurredAt,
    retentionDays,
    repositoryBinding,
  );
  if (
    !candidateHistory ||
    (pending !== null && !pending.equals(candidateHistory))
  )
    return null;
  return Object.freeze({
    snapshotBytes,
    historyBytes: candidateHistory,
    historyChanged: !canonical.equals(candidateHistory),
  });
}

/**
 * 固定した要約時刻を含む履歴行を符号化する。
 * @responsibility 確認状態を除外したexact行Identityを所有する。
 * @trace ARCH-000008
 * @input operation: 検証済み操作、occurredAt: 最初の正規UTC時刻。
 * @returns 履歴行の正規本文。
 * @precondition 時刻と操作内容を呼出し元で確認する。
 * @postcondition confirmedを行Hashへ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正内容は例外。
 * @invariant 再入場の現在時刻で行を再生成しない。
 * @boundary 操作の終了要約と時刻込み履歴行。
 * @security 生出力やPathを追加しない。
 * @concurrency N/A: 保存を行わない。
 */
function coordinatorHistoryLineBytes(
  operation: CoordinatorStateTaskOperation,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeCoordinatorStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(
        coordinatorOperationSummaryBytes(operation).toString("utf8"),
      ),
    })}\n`,
  );
}

/**
 * 保存済みcheckpointから同じ終了履歴行を導出する。
 * @responsibility 要約・初回時刻とexact行Hashの共通符号化を履歴Writerへ渡す。
 * @trace ARCH-000008
 * @input currentBytes: 現在状態、recoveryId: 対象、repositoryBinding: 検証済み結合。
 * @returns 正規UTF-8行と末尾LF、またはnull。
 * @precondition 対象の要約と初回時刻がcheckpointへ固定済みである。
 * @postcondition 確認状態を行へ含めず、初回と確認済みで同じ本文を返す。
 * @effect N/A: メモリ内の検証と符号化だけ。
 * @failure 未固定、別対象、不正状態や行Hash不一致はnull。
 * @invariant 行の導出を物理保存、終端確認、削除許可にしない。
 * @boundary 現在状態の固定相関と履歴保存の値境界。
 * @security 任意の履歴本文、Path、秘密値を受けない。
 * @concurrency 保存と元版の再照合は物理Writerが所有する。
 */
export function prepareCoordinatorStateHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  if (!operation?.history) return null;
  const bytes = coordinatorHistoryLineBytes(
    operation,
    operation.history.occurredAt,
  );
  return createHash("sha256").update(bytes).digest("hex") ===
    operation.history.lineSha256
    ? bytes
    : null;
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
function validCoordinatorPrimaryFailure(value: unknown): boolean {
  if (value === null) return true;
  // 既存診断にない観測値を0で補わず、追加された場合だけ閉じて検査する。
  const hasObservation =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "commandObservation");
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
function validCoordinatorOutcome(value: unknown): boolean {
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
 * 終了履歴を全行検査し、exact行の相関だけを返す。
 * @responsibility 破損、部分行、重複、未知値を期間整理へ渡さない。
 * @trace ARCH-000008
 * @input bytes: 固定履歴Fileから安定読取りしたUTF-8本文。
 * @returns 正規行・時刻・回復参照・両Hashの不変集合、またはnull。
 * @precondition File実体とRootは物理Ownerが確認する。
 * @postcondition 全行を検証するまで部分結果を返さない。
 * @effect N/A: メモリ内の復号と検査だけ。
 * @failure 容量超過、不正UTF-8、部分行、未知Schema、重複はnull。
 * @invariant 容量・破損を行削除で解消せず、履歴をAuthorityへ昇格しない。
 * @boundary 終了履歴の値契約と物理Writer。
 * @security 自由本文、秘密値、任意Pathを許可しない。
 * @concurrency 元Fileと元状態の再照合は物理Ownerが行う。
 */
export function decodeCoordinatorHistoryRows(bytes: unknown) {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_COORDINATOR_STATE_BYTES)
      return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!Buffer.from(text, "utf8").equals(bytes)) return null;
    if (text === "") return Object.freeze([]);
    if (!text.endsWith("\n")) return null;
    const seen = new Set<string>();
    const rows = text
      .slice(0, -1)
      .split("\n")
      .map((line) => {
        const row = JSON.parse(line);
        const summary = row?.summary;
        if (summary?.schema === "crdd-coordinator/repair-summary/v1") {
          if (
            !exactRecordKeys(row, ["schema", "occurredAt", "summary"]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            typeof row.occurredAt !== "string" ||
            !Number.isFinite(Date.parse(row.occurredAt)) ||
            new Date(row.occurredAt).toISOString() !== row.occurredAt ||
            `${encodeCoordinatorStateValue(row)}\n` !== `${line}\n` ||
            !validCoordinatorRepairSummary(summary) ||
            (summary.retention !== undefined &&
              row.occurredAt !== summary.retention.decidedAt) ||
            seen.has(summary.recoveryId)
          )
            throw new Error("repair_history_row_invalid");
          seen.add(summary.recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: row.occurredAt as string,
            ...(summary.retention === undefined
              ? {}
              : { reviewAfter: summary.retention.reviewAfter as string }),
            recoveryId: summary.recoveryId as string,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeCoordinatorStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (
          !exactRecordKeys(row, ["schema", "occurredAt", "summary"]) ||
          row.schema !== "crdd-coordinator/history-row/v2" ||
          typeof row.occurredAt !== "string" ||
          !Number.isFinite(Date.parse(row.occurredAt)) ||
          new Date(Date.parse(row.occurredAt)).toISOString() !==
            row.occurredAt ||
          `${encodeCoordinatorStateValue(row)}\n` !== `${line}\n` ||
          !exactRecordKeys(summary, [
            "schema",
            ...(summary?.schema === "crdd-coordinator/operation-summary/v4"
              ? ["consumer", "recoveryCorrelationId"]
              : []),
            ...(summary?.schema === "crdd-coordinator/operation-summary/v3" ||
            (summary?.schema === "crdd-coordinator/operation-summary/v4" &&
              Object.hasOwn(summary, "dockerRestart"))
              ? ["dockerRestart"]
              : []),
            "operationId",
            "operationNonce",
            "recoveryId",
            "identitySha256",
            "primaryFailure",
            "execution",
            "outcome",
            "hostCleanup",
            "lease",
          ]) ||
          ![
            "crdd-coordinator/operation-summary/v2",
            "crdd-coordinator/operation-summary/v3",
            "crdd-coordinator/operation-summary/v4",
          ].includes(summary.schema) ||
          (summary.schema === "crdd-coordinator/operation-summary/v4" &&
            (coordinatorConsumerCompletionPolicy(summary.consumer) === null ||
              !(
                summary.recoveryCorrelationId === null ||
                (typeof summary.recoveryCorrelationId === "string" &&
                  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
                    summary.recoveryCorrelationId,
                  ))
              ))) ||
          ((summary.schema === "crdd-coordinator/operation-summary/v3" ||
            (summary.schema === "crdd-coordinator/operation-summary/v4" &&
              Object.hasOwn(summary, "dockerRestart"))) &&
            (summary.dockerRestart === null ||
              !isDockerRestartCheckpointSettled(summary.dockerRestart))) ||
          typeof summary.operationId !== "string" ||
          !/^OP-[0-9]{6,}$/u.test(summary.operationId) ||
          !isSha256Hex(summary.operationNonce) ||
          !isSha256Hex(summary.identitySha256) ||
          !validCoordinatorPrimaryFailure(summary.primaryFailure) ||
          !exactRecordKeys(summary.execution, [
            "providerStart",
            "externalSend",
            "sharedWrite",
            "ownerEffect",
            "workspaceReusable",
          ]) ||
          !["not_started", "started", "unknown"].includes(
            summary.execution.providerStart,
          ) ||
          !["not_issued", "issued", "unknown"].includes(
            summary.execution.externalSend,
          ) ||
          !["not_issued", "possible", "unknown"].includes(
            summary.execution.sharedWrite,
          ) ||
          summary.execution.ownerEffect !== "disabled" ||
          summary.execution.workspaceReusable !== false ||
          !validCoordinatorOutcome(summary.outcome) ||
          summary.outcome?.cleanupConfirmed !== true ||
          summary.hostCleanup !== "confirmed" ||
          summary.lease !== "released"
        )
          throw new Error("history_row_invalid");
        const recovery = parseDockerTaskRecoveryId(summary.recoveryId);
        if (
          !recovery ||
          recovery.operationNonce !== summary.operationNonce ||
          recovery.baseHash !== summary.identitySha256 ||
          seen.has(summary.recoveryId)
        )
          throw new Error("history_identity_invalid");
        seen.add(summary.recoveryId);
        return Object.freeze({
          line: `${line}\n`,
          occurredAt: row.occurredAt as string,
          recoveryId: summary.recoveryId as string,
          lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
          summarySha256: createHash("sha256")
            .update(`${encodeCoordinatorStateValue(summary)}\n`)
            .digest("hex"),
        });
      });
    return Object.freeze(rows);
  } catch {
    return null;
  }
}

/**
 * 検査済み終了履歴から保持期間内・保持期限前・未終了参照の行を残す候補を作る。
 * @responsibility 期間整理と保存確認の順序を現在状態へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 現在Snapshot、historyBytes: 履歴本文、now: 固定UTC時刻、retentionDays: 設定日数、repositoryBinding: 現在結合。
 * @returns 元の行順と本文を維持した候補、またはnull。
 * @precondition 更新排他内の元File実体・版・設定を物理Writerが再照合する。
 * @postcondition 未確認行は期限外でも保持し、確認済みの欠落行を再追加しない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 全行検査失敗、設定不正、未確認行欠落または相関不一致はnull。
 * @invariant 件数・容量を理由に削除せず、状態の操作・搬送を変更しない。
 * @boundary 現在状態と通常履歴の保持期間。
 * @security 候補生成は実保存・読戻し・操作除去のAuthorityを発行しない。
 * @concurrency 判定時刻・設定と元本文への結合を保存側が保持する。
 */
export function prepareCoordinatorHistoryRetention(
  currentBytes: unknown,
  historyBytes: unknown,
  now: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const rows = decodeCoordinatorHistoryRows(historyBytes);
  if (
    !current ||
    !rows ||
    typeof now !== "string" ||
    !Number.isFinite(Date.parse(now)) ||
    new Date(Date.parse(now)).toISOString() !== now ||
    typeof retentionDays !== "number" ||
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 104249991
  )
    return null;
  const cutoff = Date.parse(now) - retentionDays * 86400000;
  if (!Number.isSafeInteger(cutoff)) return null;
  const byRecovery = new Map(rows.map((row) => [row.recoveryId, row]));
  const protectedRecoveries = new Set<string>();
  for (const operation of current.snapshot.operations) {
    if (!operation.history) continue;
    const activeRetention =
      operation.kind === "runtime_repair" && operation.retention !== undefined;
    const row = byRecovery.get(operation.recoveryId);
    if (
      (row &&
        (row.lineSha256 !== operation.history.lineSha256 ||
          row.summarySha256 !== operation.summarySha256)) ||
      (!row && (!operation.history.confirmed || activeRetention))
    )
      return null;
    if (!operation.history.confirmed || activeRetention)
      protectedRecoveries.add(operation.recoveryId);
  }
  return Buffer.from(
    rows
      .filter(
        (row) =>
          protectedRecoveries.has(row.recoveryId) ||
          ("reviewAfter" in row &&
            typeof row.reviewAfter === "string" &&
            Date.parse(now) < Date.parse(row.reviewAfter)) ||
          Date.parse(row.occurredAt) >= cutoff,
      )
      .map((row) => row.line)
      .join(""),
    "utf8",
  );
}

/**
 * 現在終端の履歴出版候補を固定時刻と全文から再導出する。
 * @responsibility Process内の過去試行情報を復元せず、同じ行・保持設定・pendingを照合する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、historyBytes、pendingBytes、retentionDays、repositoryBinding: 現在状態と固定履歴入力。
 * @returns 確認済みSnapshotと履歴全文の候補、またはnull。
 * @precondition 実終端、Root、File実体、排他と現在設定は保存Ownerが別に確認する。
 * @postcondition 固定時刻・行内容を変えず、同じIDの行を再追加しない。
 * @effect N/A: 純粋な候補導出だけ。保存・削除・処置許可の発行なし。
 * @failure 不正履歴、同ID異内容、重複、pending全文差、設定差による再導出不一致はnull。
 * @invariant JSONやHashの一致を実終端やWriter Authorityへ昇格しない。
 * @boundary 現在終端の固定行と通常履歴の保存途中全文。
 * @security 未知本文を相関情報や履歴へ追加しない。
 * @concurrency 元Snapshotと全履歴・設定を実Writer内でも再照合する。
 */
export function prepareCoordinatorRecoveredHistoryPublication(
  currentBytes: unknown,
  recoveryId: unknown,
  historyBytes: unknown,
  pendingBytes: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
) {
  try {
    const copied: Buffer[] = [];
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    for (const input of pendingBytes === null
      ? [historyBytes]
      : [historyBytes, pendingBytes]) {
      if (types.isProxy(input) || !Buffer.isBuffer(input)) return null;
      const length = Object.getOwnPropertyDescriptor(
        intrinsic,
        "byteLength",
      )?.get?.call(input);
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
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
      copied.push(Buffer.from(new Uint8Array(buffer, offset, length)));
    }
    const canonical = copied[0];
    const pending = pendingBytes === null ? null : copied[1];
    if (canonical === undefined || pending === undefined) return null;
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!current || !operation?.history || operation.history.confirmed)
      return null;
    const line = prepareCoordinatorStateHistoryLine(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    const snapshotBytes = prepareCoordinatorStateHistorySnapshot(
      currentBytes,
      recoveryId,
      operation.history.occurredAt,
      true,
      repositoryBinding,
    );
    const rows = decodeCoordinatorHistoryRows(canonical);
    if (!line || !snapshotBytes || !rows) return null;
    const existing = rows.find((row) => row.recoveryId === recoveryId);
    if (existing && !Buffer.from(existing.line).equals(line)) return null;
    const candidateHistory = prepareCoordinatorHistoryRetention(
      currentBytes,
      existing ? canonical : Buffer.concat([canonical, line]),
      operation.history.occurredAt,
      retentionDays,
      repositoryBinding,
    );
    if (
      !candidateHistory ||
      (pending !== null && !pending.equals(candidateHistory))
    )
      return null;
    return Object.freeze({
      snapshotBytes: Buffer.from(snapshotBytes),
      historyBytes: Buffer.from(candidateHistory),
      historyChanged: !canonical.equals(candidateHistory),
    });
  } catch {
    return null;
  }
}

/**
 * 履歴の初回固定または保存確認の候補を同じ操作へ結合する。
 * @responsibility 最初の時刻と行Hashを固定し、確認状態の巻戻しを拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: 対象、occurredAt: 固定時刻、confirmed: 保存確認候補、repositoryBinding: 現在結合。
 * @returns 改訂相関を含む候補Snapshot、またはnull。
 * @precondition 実終端と保存読戻しの根拠は物理Writerで別途確認する。
 * @postcondition 他操作・資源・参照を変更しない。
 * @effect N/A: メモリ内の候補生成。
 * @failure 未終端評価、時刻不正、初回true、既存内容差はnull。
 * @invariant 候補生成を実終端・保存・除去の許可にしない。
 * @boundary 終端Ownerと単一Snapshotの短命な履歴相関。
 * @security 一般Writerは実保存根拠なしの履歴変更を拒否する。
 * @concurrency 元版Hashへ結合して物理Writerで再照合する。
 */
export function prepareCoordinatorStateHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (
      !current ||
      typeof recoveryId !== "string" ||
      typeof occurredAt !== "string" ||
      typeof confirmed !== "boolean"
    )
      return null;
    const time = Date.parse(occurredAt);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== occurredAt)
      return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      operation.phase === "executing" ||
      !operation.outcome?.cleanupConfirmed ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation)
    )
      return null;
    if (!operation.history && confirmed) return null;
    const summary = prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    if (!summary) return null;
    const history = {
      occurredAt,
      lineSha256: createHash("sha256")
        .update(coordinatorHistoryLineBytes(operation, occurredAt))
        .digest("hex"),
      confirmed,
    };
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : { ...item, summarySha256: summary.summarySha256, history },
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
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
      snapshot.pendingDeliveries.length > MAX_COORDINATOR_STATE_OPERATIONS
    )
      return null;
    const operations = new Map<string, CoordinatorStateOperation>();
    let unresolvedRestarts = 0;
    let unresolvedRepairs = 0;
    let previousNonce = "";
    for (const operation of snapshot.operations) {
      if (operation.kind === "runtime_repair") {
        if (
          !validCoordinatorRepairOperation(
            operation,
            repositoryBinding as string,
          )
        )
          return null;
        const nonce = coordinatorOperationNonce(operation);
        if (nonce <= previousNonce) return null;
        previousNonce = nonce;
        operations.set(nonce, operation);
        if (operation.phase !== "awaiting_delivery" && ++unresolvedRepairs > 1)
          return null;
        continue;
      }
      if (operation.kind !== "docker_task") return null;
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
        return null;
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
          return null;
        if (
          restart.result === null ||
          !isDockerRestartCheckpointSettled(restart)
        )
          unresolvedRestarts += 1;
        if (unresolvedRestarts > 1) return null;
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
        return null;
      if (
        !Array.isArray(operation.resources) ||
        operation.resources.length !== 5
      )
        return null;
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
          return null;
        if (
          resource.request === "not_issued" &&
          (resource.observation !== "unobserved" || resource.absence !== null)
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
                purposeResource[purpose as keyof typeof purposeResource]
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
        const lineage = validateHostRecoveryTransitionLineage(transition);
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
      if (
        !validCoordinatorPrimaryFailure(operation.primaryFailure) ||
        !validCoordinatorOutcome(operation.outcome)
      )
        return null;
      if ((operation.summarySha256 === null) !== (operation.history === null))
        return null;
      if (operation.history !== null) {
        const history = operation.history;
        if (
          !operation.outcome ||
          !exactRecordKeys(history, [
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
          return null;
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
    const deliveryResultIds = new Map<string, string>();
    for (const delivery of snapshot.pendingDeliveries) {
      const deliveryOperation = operations.get(delivery.operationNonce);
      if (
        !exactRecordKeys(delivery, [
          "operationNonce",
          "recoveryId",
          "resultId",
          "consumer",
          "acceptanceSha256",
        ]) ||
        !deliveryOperation ||
        deliveryOperation.kind !== "docker_task" ||
        deliveryOperation.recoveryId !== delivery.recoveryId ||
        !isSha256Hex(delivery.resultId) ||
        delivery.consumer !== "orchestrator" ||
        JSON.parse(deliveryOperation.identityJson).consumer !==
          delivery.consumer ||
        (delivery.acceptanceSha256 !== null &&
          !isSha256Hex(delivery.acceptanceSha256))
      )
        return null;
      const key = `${delivery.operationNonce}:${delivery.consumer}`;
      if (key <= previousDelivery) return null;
      const fixedResultId = deliveryResultIds.get(delivery.operationNonce);
      if (fixedResultId !== undefined && fixedResultId !== delivery.resultId)
        return null;
      deliveryResultIds.set(delivery.operationNonce, delivery.resultId);
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
 * 終端・履歴確認・全搬送受理を満たす一操作だけの終了候補を作る。
 * @responsibility 操作と同じ回復・搬送参照を一改訂で取り除く値契約を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、repositoryBinding: 現在結合。
 * @returns 固定対象だけを除去した次Snapshot、またはnull。
 * @precondition 物理Ownerが実終端と固定利用側に必要な耐久受理根拠を別途照合する。
 * @postcondition 他操作・他参照と元版相関を保持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 実行中、清掃・Lease・履歴未確認、搬送未受理または不正入力はnull。
 * @invariant 候補を実終端・受理・除去Authorityへ昇格せず、一般更新の除去拒否を維持する。
 * @boundary 現在操作の閉集合と通常履歴。
 * @security unknown Createや不明Effectを成功へ丸めない。
 * @concurrency 元版と真正根拠の同時照合は物理Writerの責務。
 */
export function prepareCoordinatorStateCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  const completionPolicy = operation
    ? coordinatorConsumerCompletionPolicy(
        JSON.parse(operation.identityJson).consumer,
      )
    : null;
  if (
    !current ||
    !operation ||
    !completionPolicy ||
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    operation.host.cleanup !== "confirmed" ||
    operation.host.pendingTransitionJson !== null ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.history?.confirmed !== true ||
    !prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    ) ||
    (completionPolicy === "durable" &&
      !current.snapshot.pendingDeliveries.some(
        (delivery) => delivery.recoveryId === recoveryId,
      )) ||
    (completionPolicy === "transient" &&
      current.snapshot.pendingDeliveries.some(
        (delivery) => delivery.recoveryId === recoveryId,
      )) ||
    !coordinatorTaskResourcesAreSettled(operation) ||
    current.snapshot.pendingDeliveries.some(
      (delivery) =>
        delivery.recoveryId === recoveryId &&
        (delivery.acceptanceSha256 === null ||
          delivery.resultId !== operation.summarySha256),
    )
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    pendingDeliveries: current.snapshot.pendingDeliveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 退避物が存在しない修復の履歴確認後に現在操作だけを除去する。
 * @responsibility Taskの配送・ACK条件を修復へ流用しない終了候補を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文、recoveryId: exact修復、repositoryBinding: 現在結合。
 * @returns 対象一件だけを除去した次版、またはnull。
 * @precondition 物理Ownerが現在の保存資格と履歴読戻しを別途確認する。
 * @postcondition 他操作・回復参照・配送は全文維持する。
 * @effect N/A: メモリ内の値候補だけ。
 * @failure 未回収かつ引渡し未確定の保持物・未終端・未確認履歴・同ID参照・不正入力はnull。
 * @invariant 通常更新の暗黙除去拒否とTask終了契約を変更しない。
 * @boundary 修復現在状態と既存completion Writer。
 * @security 候補生成を削除許可や実資源不存在の観測にしない。
 * @concurrency 元版・履歴・現在Ownerの再照合は物理Writerが所有する。
 */
export function prepareCoordinatorStateRepairCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (
    !current ||
    !operation ||
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
    !prepareCoordinatorRepairHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    ) ||
    current.snapshot.unresolvedRecoveries.some(
      (item) => item.recoveryId === recoveryId,
    ) ||
    current.snapshot.pendingDeliveries.some(
      (item) => item.recoveryId === recoveryId,
    )
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (item) => item.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
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
  return validateCoordinatorStateTransitionValue(
    currentBytes,
    nextBytes,
    repositoryBinding,
    null,
  );
}

/**
 * 中断した単一資源の作成Receipt保存を完全本文から再導出する。
 * @responsibility exact対象・一資源差分と既出版同本文を区別する。
 * @trace ARCH-000008
 * @input currentBytes、pendingBytes: 正規本文、recoveryId: exact参照、repositoryBinding: 現在Repository結合。
 * @returns publish_pending／remove_pending、または拒否のnull。
 * @precondition 呼出し側が実体、旧Owner失効と排他を別途確認する。
 * @postcondition 他操作・状態・Authorityを変える候補を受理しない。
 * @effect N/A: メモリ内の復号・完全再導出だけ。
 * @failure 不正本文、対象差、資源差分複数、版・前版Hash不整合はnull。
 * @invariant ID受領記録を実資源の現在存在・回収証明へ昇格しない。
 * @boundary 保存候補の意味検査。物理出版と実資源処置は別Owner。
 * @security 保存本文から処置Authorityを生成しない。
 * @concurrency N/A: 物理的な元版一致と排他は保存Ownerが担当する。
 */
export function classifyCoordinatorResourcePublication(
  currentBytes: unknown,
  pendingBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): "publish_pending" | "remove_pending" | null {
  try {
    if (!Buffer.isBuffer(currentBytes) || !Buffer.isBuffer(pendingBytes))
      return null;
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const pending = decodeCoordinatorStateSnapshot(
      pendingBytes,
      repositoryBinding,
    );
    if (
      !current ||
      !pending ||
      !currentBytes.equals(
        Buffer.from(`${encodeCoordinatorStateValue(current.snapshot)}\n`),
      ) ||
      !pendingBytes.equals(
        Buffer.from(`${encodeCoordinatorStateValue(pending.snapshot)}\n`),
      )
    )
      return null;
    const prior = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const next = pending.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!prior || !next || prior.identityJson !== next.identityJson)
      return null;
    if (currentBytes.equals(pendingBytes)) return "remove_pending";
    const changed = next.resources.filter(
      (resource, index) =>
        encodeCoordinatorStateValue(resource) !==
        encodeCoordinatorStateValue(prior.resources[index]),
    );
    const resource = changed[0];
    const previous = prior.resources.find(
      (item) => item.purpose === resource?.purpose,
    );
    if (
      changed.length !== 1 ||
      !resource ||
      previous?.request !== "intent_saved" ||
      resource.request !== "identified" ||
      resource.receiptSource !== "docker_create_result" ||
      resource.dockerId === null
    )
      return null;
    const derived = prepareCoordinatorStateResourceSnapshot(
      currentBytes,
      recoveryId,
      resource,
      repositoryBinding,
    );
    return derived?.equals(pendingBytes) ? "publish_pending" : null;
  } catch {
    return null;
  }
}

/**
 * 通常更新と用途限定の修復再入場を共通の全状態検査へ通す。
 * @responsibility 再入場対象だけ専用技術遷移を使い、他の保全条件を維持する。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、repositoryBinding: 結合、repairSessionId: 専用対象またはnull。
 * @returns 全状態と遷移が共同成立する場合だけtrue。
 * @precondition 専用呼出し側が再導出した完全候補を照合する。
 * @postcondition 通常入口ではcleanup巻戻しを許可しない。
 * @effect N/A: メモリ内の値検査だけ。
 * @failure 不正値・別対象・不正遷移はfalse。
 * @invariant Task、他修復、一次失敗と確定結果を保全する。
 * @boundary 保存値の検査。実Native取得や保存とは別。
 * @security trueを実処置Authorityへ昇格しない。
 * @concurrency N/A: 物理排他はWriterが所有。
 */
function validateCoordinatorStateTransitionValue(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
  repairSessionId: string | null,
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
                  value.execution.providerStart === "unknown" ||
                  value.execution.externalSend === "unknown" ||
                  value.execution.sharedWrite === "unknown" ||
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
