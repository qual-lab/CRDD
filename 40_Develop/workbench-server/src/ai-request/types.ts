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

export type WorkbenchAiRequestMode = "read_only_advice" | "change_candidate";

export type WorkbenchAiRequestCommand = Readonly<{
  mode: WorkbenchAiRequestMode;
  profileId: string;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
}>;

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

export type WorkbenchAiRequestSnapshot = Readonly<{
  requestId: string;
  mode: WorkbenchAiRequestMode | null;
  profileId: string | null;
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
  candidate: Readonly<{
    candidateId: string;
    disposition: "untrusted_not_adopted";
  }> | null;
}>;

export type WorkbenchAiRequests = Readonly<{
  start: (
    request: WorkbenchAiRequestCommand,
  ) => Promise<WorkbenchAiRequestStartResult>;
  observe: (requestId: string) => Promise<WorkbenchAiRequestSnapshot>;
  cancel: (requestId: string) => Promise<WorkbenchAiRequestSnapshot>;
}>;

/**
 * Workbenchへ表示する変更候補の安全な確認投影。
 *
 * @responsibility 候補内容を複製せず、採用判断に必要なIdentity、分類、期限、基準Revision、Hashおよび変更Pathを保持する。
 * @trace ARCH-000015
 * @shape Coordinatorの候補確認Applicationと同じ閉じたPropertyを持つ。
 * @invariant 候補本文、Host Path、秘密値および採用Authorityを含めない。
 * @boundary Coordinator ApplicationとWorkbench View Modelの境界。
 * @security changedPathsは表示情報でありFilesystem Authorityではない。
 * @compatibility Coordinator側の構造型Applicationと一致する。
 */
export type WorkbenchCandidateReview = Readonly<{
  candidateId: string;
  informationClassification: "public" | "internal" | "confidential";
  expiresAtMs: number;
  baseRevision: string;
  candidateHash: string;
  patchHash: string;
  changedPaths: readonly string[];
}>;

/**
 * Workbench変更候補の確認結果。
 *
 * @responsibility 利用可能候補と観測不能を別状態として保持する。
 * @trace ARCH-000015
 * @shape 状態、理由および任意の候補確認投影を持つ。
 * @invariant availableだけがcandidateを持つ。
 * @boundary Coordinator ApplicationとWorkbenchの境界。
 * @security 下位Storeの内部情報を含めない。
 * @compatibility Coordinator側の構造型結果と一致する。
 */
export type WorkbenchCandidateReviewResult = Readonly<{
  status: "available" | "blocked";
  reason: string;
  candidate: WorkbenchCandidateReview | null;
}>;

/**
 * Workbench変更候補の操作結果。
 *
 * @responsibility 採用・破棄の完了、Effect状態、cleanupおよび回復要否を保持する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @shape 操作、状態、理由、候補・Receipt Identity、Effect・Recovery情報を持つ。
 * @invariant blockedを成功へ畳まず、Effect不明を明示する。
 * @boundary Coordinator ApplicationとWorkbenchの境界。
 * @security Capability、Host Path、候補内容または秘密値を含めない。
 * @compatibility Coordinator側の構造型結果と一致する。
 */
export type WorkbenchCandidateActionResult = Readonly<{
  operation: "adopt" | "discard";
  status: "completed" | "blocked";
  reason: string;
  candidateId: string | null;
  receiptId: string | null;
  effectIssued: boolean;
  effectStateUnknown: boolean;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  recoveryIds: readonly string[];
}>;

/**
 * Workbench変更候補Application Port。
 *
 * @responsibility Effect 0の確認、明示採用および確認付き破棄を別操作として公開する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @shape review、adopt、discardの非同期操作を持つ。
 * @invariant confirmedなしで採用または破棄Effectを発行しない。
 * @boundary WorkbenchとCoordinator Applicationの境界。
 * @security Candidate IDをAuthorityとして扱わない。
 * @compatibility Coordinator側の構造型Applicationと一致する。
 */
export type WorkbenchCandidateActions = Readonly<{
  review: (candidateId: string) => Promise<WorkbenchCandidateReviewResult>;
  adopt: (
    candidateId: string,
    confirmed: boolean,
  ) => Promise<WorkbenchCandidateActionResult>;
  discard: (
    candidateId: string,
    confirmed: boolean,
  ) => Promise<WorkbenchCandidateActionResult>;
}>;
