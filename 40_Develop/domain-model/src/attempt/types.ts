/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { purposeResource } from "./validation.ts";
import type { DockerRuntimeRepairCheckpoint } from "./repair-types.ts";
import type { DockerRuntimeRepairDisposalCheckpoint } from "./repair-types.ts";
import type { DockerRuntimeRepairRetentionTargets } from "./repair-types.ts";

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
    authenticationStatus?: "confirmed" | "unconfirmed" | "unknown";
    turnCountDiagnostic?: ProviderTurnCountDiagnostic;
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
 * 拒否したTurn metadataの有無・型・有限数値だけを表す。
 * @responsibility 未信頼文字列・Object本文を診断へ複製しない。
 * @trace ARCH-000015
 * @shape 欠落を区別する固定型名と、有限数値を正規化した短い文字列表記又はnull。
 * @invariant 観測値は受理判定や実行許可を変更しない。
 * @boundary Provider出力の抽出と上位の一次失敗診断。
 * @security 数値以外の実値・生Envelopeを含めない。
 * @compatibility 既存結果への任意の診断追加。
 */
export type ProviderTurnCountDiagnostic = Readonly<{
  valueType:
    | "missing"
    | "null"
    | "boolean"
    | "number"
    | "string"
    | "array"
    | "object";
  numberText: string | null;
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
