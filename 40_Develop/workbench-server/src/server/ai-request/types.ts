/**
 * WorkbenchのAI依頼Application契約。
 *
 * @responsibility 現在Sessionの依頼、状態、事実・共有分析・追加推論の値契約を所有し、会話履歴やProvider実行を所有しない。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @boundary Workbench Client Modelと外部AI実行Application Adapterの境界。
 * @effect 型定義はEffect 0。開始・取消は注入されたApplicationへだけ委譲する。
 * @security Promptや結果をRepository、URL、logへ保存せず、秘密値を入力契約へ含めない。
 */
import type {
  ExecutionSelection,
  SingleTaskCommand,
  WorkspaceResult,
} from "../../../../coordinator/src/index.ts";

/** Workbenchが受け付けるAI依頼の用途区分。 */
export type WorkbenchAiRequestMode = "read_only_advice" | "workspace_edit";

/** AI依頼の入力・対象・実行条件を受け付ける要求。 */
export type WorkbenchAiRequestCommand = SingleTaskCommand;

/** AI依頼の受付結果と追跡参照。 */
export type WorkbenchAiRequestStartResult = Readonly<{
  status: "accepted" | "blocked";
  requestId: string | null;
  reason: string | null;
}>;

/**
 * AI結果の一項目と、その意味を支える正本参照。
 *
 * @responsibility 結果本文を根拠参照から切り離さずWorkbench表示へ搬送する。
 * @trace ARCH-000015
 * @shape textと一件以上のRepository相対参照を持つ。
 * @invariant 参照のない本文を事実、共有分析または追加推論として扱わない。
 * @boundary 外部AI結果とWorkbench表示Modelの境界。
 * @security 参照は表示用Identityであり、任意Path読取りAuthorityを付与しない。
 * @compatibility 利用側はtextとreferencesだけへ依存する。
 */
export type WorkbenchAiResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/** 同一AI依頼の進行・終端・回復情報の公開投影。 */
export type WorkbenchAiRequestSnapshot = Readonly<{
  requestId: string;
  mode: WorkbenchAiRequestMode | null;
  executionSelection: ExecutionSelection | null;
  status:
    | "accepted"
    | "running"
    | "completed"
    | "blocked"
    | "cancelled"
    | "unknown";
  reason: string | null;
  facts: readonly WorkbenchAiResultItem[];
  sharedAnalysis: readonly WorkbenchAiResultItem[];
  additionalInferences: readonly WorkbenchAiResultItem[];
  nextOptions: readonly WorkbenchAiResultItem[];
  candidate: null;
  workspaceResult?: WorkspaceResult | null;
  taskId?: string | null;
  attemptId?: string | null;
  operationId?: string | null;
  executionStatus?: string | null;
  primaryFailure?: string | null;
  cleanupConfirmed?: boolean;
  recoveryIds?: readonly string[];
  secondaryFailures?: readonly string[];
}>;

/** AI依頼の開始・照会・取消・終了を結ぶWorkbench側の操作契約。 */
export type WorkbenchAiRequests = Readonly<{
  start: (
    request: WorkbenchAiRequestCommand,
  ) => Promise<WorkbenchAiRequestStartResult>;
  observe: (requestId: string) => Promise<WorkbenchAiRequestSnapshot>;
  cancel: (requestId: string) => Promise<WorkbenchAiRequestSnapshot>;
  close?: () => Promise<void>;
}>;
