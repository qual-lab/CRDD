/**
 * Attemptの資源記録・回復結果の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */

import type { TurnCountDiagnostic } from "../../../ai-adapter/src/index.ts";
import type { ResourceSnapshot } from "../../../docker-isolation/src/index.ts";
import type {
  RUNTIME_REPAIR_ACTIONS,
  RUNTIME_REPAIR_DIRECTORIES,
} from "./validation.ts";

/**
 * 修復Machineが所有し保存Ownerへ渡す技術状態。
 * @responsibility 固定8処置と三用途の世代実体、現在結果と回収失敗を保持する。
 * @trace ARCH-000008
 * @shape actions、directories、engine、stale、hostSafety、cleanup、cleanupFailure。
 * @invariant 人間の保持判断・Task/Home/Provider・任意Pathは含めない。
 * @boundary 下位Machineと上位の永続化境界。
 * @security 復号成功は実資源観測・排他・実行許可ではない。
 * @compatibility 旧Journal・署名chain・OS別phaseを受理しない。
 */
export type DockerRuntimeRepairCheckpoint = Readonly<{
  actions: Readonly<
    Record<(typeof RUNTIME_REPAIR_ACTIONS)[number], RepairAction>
  >;
  directories: Readonly<
    Record<
      (typeof RUNTIME_REPAIR_DIRECTORIES)[number],
      Readonly<{
        expected: DirectoryIdentity | null;
        source: DirectoryObservation;
        retained: DirectoryObservation;
      }>
    >
  >;
  engine: "unobserved" | "ready" | "unavailable" | "unknown";
  stale: "absent" | "retained" | "unknown";
  hostSafety: "safe" | "manual_recovery_required" | "unknown";
  cleanup: "not_requested" | "pending" | "confirmed" | "unknown";
  cleanupFailure:
    | "operation_cleanup_unknown"
    | "observation_cleanup_unknown"
    | null;
}>;

/**
 * 元修復結果とは独立した三退避先の回収進捗。
 * @responsibility 意図保存・要求履歴・不存在観測を分離する。
 * @trace ARCH-000008
 * @shape 固定三用途ごとにintent、request、absenceを保持する。
 * @invariant 過去の要求不明を現在の不存在確認で消さない。
 * @boundary DIの純粋技術値と上位の専用保存Owner。
 * @security 実体、Scope、Path、Authority、保持判断を複製しない。
 * @compatibility 元の8処置checkpointとは別の最新値契約。
 */
export type DockerRuntimeRepairDisposalCheckpoint = Readonly<{
  directories: Readonly<
    Record<
      (typeof RUNTIME_REPAIR_DIRECTORIES)[number],
      Readonly<{
        intent: "not_saved" | "saved";
        request: "not_issued" | "issued" | "unknown";
        absence: "unobserved" | "confirmed_absent" | "unknown";
      }>
    >
  >;
}>;

/**
 * 一技術処置の保存意図、発行観測、結果観測を分離する。
 * @responsibility 未発行と発行不明を同じ値へ畳まない。
 * @trace ARCH-000008
 * @shape intent、request、resultの有限な組。
 * @invariant 値は実処置許可や実完了の証明ではない。
 * @boundary 保存Ownerと修復Machineの値契約。
 * @security 任意コマンド・Path・生応答を持たない。
 * @compatibility 最新構造だけを受理する。
 */
export type RepairAction = Readonly<{
  intent: "not_saved" | "saved";
  request: "not_issued" | "issued" | "unknown";
  result: "unobserved" | "not_required" | "confirmed" | "unknown";
}>;

/**
 * 処置対象Directoryの非秘密な実体相関。
 * @responsibility 同名の別実体を期待した対象と混同しない。
 * @trace ARCH-000008
 * @shape dev、ino、birthtimeNsの正の十進文字列。
 * @invariant HashやPathだけを実体確認へ代用しない。
 * @boundary 技術観測と保存値。
 * @security 生Pathと処置Authorityを持たない。
 * @compatibility OS数値を丸めない文字列表現だけ。
 */
export type DirectoryIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * 不存在、未観測、観測不能と存在を区別する。
 * @responsibility 不明値を不存在へ変換しない。
 * @trace ARCH-000008
 * @shape stateと存在時だけのidentity。
 * @invariant present以外に実体値を捏造しない。
 * @boundary 現在観測の値契約。
 * @security 値から削除・再利用許可を発行しない。
 * @compatibility 最新の四状態だけ。
 */
export type DirectoryObservation = Readonly<{
  state: "unobserved" | "absent" | "present" | "unknown";
  identity: DirectoryIdentity | null;
}>;

/**
 * 明示保持する三退避先の非Authority照合値。
 * @responsibility 用途内の明示不存在と全体の観測失敗を区別する。
 * @trace ARCH-000008
 * @shape 三用途それぞれにNode実体または明示不存在のnull。
 * @invariant Path・Scope・処置許可を持たず、NodeとNativeの単位を混用しない。
 * @boundary DI固定読取りと上位の明示保持receipt。
 * @security 明示保持限定の非秘密metadata。
 * @compatibility 現行checkpointと固定nonceの三用途だけ。
 */
export type DockerRuntimeRepairRetentionTargets = Readonly<
  Record<(typeof RUNTIME_REPAIR_DIRECTORIES)[number], DirectoryIdentity | null>
>;

/** 同じ操作の技術Snapshotと記録状態。資源Identityをcheckpointへ複製しない。 */
export type CoordinatorResourceBook = Readonly<{
  snapshot: ResourceSnapshot;
  checkpoints: readonly Readonly<{
    key: string;
    submission: "none" | "intent_saved" | "not_issued";
    receiptSource: "docker_create_result" | "runtime_reconciliation" | null;
    observation: "unobserved" | "present" | "absent" | "unknown";
    absenceEvidenceSha256: string | null;
  }>[];
  cleanup: Readonly<{
    cleanupOrder: readonly string[];
    setupTimeoutMs: number;
    unreceiptedAbsence: "retain" | "observe";
    verifyLabelAbsence: boolean;
  }>;
}>;

/**
 * 一操作の固定相関・現在状態・元資源記録を保持する。
 * @responsibility 永続状態の意味だけを定義し実体観測や操作許可を発行しない。
 * @trace ARCH-000008
 */
export type CoordinatorStateTaskOperation = Readonly<{
  kind: "docker_task";
  dockerRestart: DockerRestartCheckpoint | null;
  identityJson: string;
  identitySha256: string;
  recoveryId: string;
  phase: "executing" | "settling" | "awaiting_delivery";
  resources: CoordinatorResourceBook | null;
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
    authenticationStatus?: "confirmed" | "unconfirmed" | "unknown";
    turnCountDiagnostic?: TurnCountDiagnostic;
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
 * 一操作に一度だけ結合する再起動要求の現在値。
 * @responsibility 未発行・受付・完了、清掃不要と清掃結果を分ける。
 * @trace ARCH-000008
 * @shape 固定要求ID、Scope Hash、要求状態、回収状態、一次確定結果。
 * @invariant 結果・ID・Scopeを置換せず、過去unknownを成功へ推定しない。
 * @boundary Repository-local現在状態。
 * @security Hashと保存状態は操作Authorityを発行しない。
 * @compatibility 最新構造だけ。旧phaseと署名chainは受理しない。
 */
export type DockerRestartCheckpoint = Readonly<{
  requestId: string;
  scopeSha256: string;
  request: "not_issued" | "unknown" | "issued" | "confirmed";
  cleanup: "not_required" | "pending" | "confirmed" | "unknown";
  result: Readonly<{
    status: "completed" | "blocked";
    reason: string;
    request: "not_issued" | "unknown" | "issued" | "confirmed";
    effectOutcomeUnknown: boolean;
  }> | null;
}>;

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
 * Coordinatorの最新現在状態をRepositoryへ保存する。
 * @responsibility 既存のRoot観測・排他・bounded読取りを用いた固定二Fileの保存確定とSnapshot再入場分類を所有する。
 * @trace ARCH-000008
 */

/**
 * 修復保存の用途を既存更新と後続回収へ限定する。
 * @responsibility 未知用途を通常checkpointへ代用しない。
 * @trace ARCH-000008
 * @shape checkpoint、session_begin、retention_handoff、回収判断と固定三用途。
 * @invariant 用途値から処置Authorityを発行しない。
 * @boundary 私有保存Contextと完全候補検査。
 * @security 任意操作・Pathを含めない。
 * @compatibility 現在の明示用途だけ。
 */
export type RepairWritePurpose =
  | "checkpoint"
  | "session_begin"
  | "retention_handoff"
  | "disposal_decision"
  | "disposal_primary"
  | "disposal_failed"
  | "disposal_auxiliary";

export type { TurnCountDiagnostic };
