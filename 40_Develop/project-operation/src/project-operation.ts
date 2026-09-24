/**
 * Project OperationのSource状態を定義する。
 *
 * @responsibility completeと五つの不完全状態を空値へ畳まず型境界で固定する。
 * @trace ARCH-000005
 * @shape complete、missing、restricted、stale、conflicting、unknownの閉集合を表す。
 * @invariant 不完全状態をcompleteへ暗黙変換しない。
 * @boundary Project Source ReaderとProjectorの型境界。
 * @security restrictedをmissingへ変換して存在推測の手掛かりを追加しない。
 * @compatibility 利用側は宣言済み六状態だけへ依存する。
 */
export type ProjectOperationSourceState =
  | "complete"
  | "missing"
  | "restricted"
  | "stale"
  | "conflicting"
  | "unknown";

/**
 * Projectorへ渡す一つのSource観測を定義する。
 *
 * @responsibility 項目Identity、状態、出所、改訂版、観測時点および観測値を同じ入力へ閉じる。
 * @trace ARCH-000005
 * @shape fieldIdとstateを必須とし、観測可能なSource情報だけを任意Propertyで保持する。
 * @invariant restricted状態の公開結果へSource Identityとvalueを引き継がない。
 * @boundary 複数Source ReaderとProjectorの入力境界。
 * @security valueは呼出し側で許可済みの構造化値に限り、本型はAuthorityを表さない。
 * @compatibility 新しい状態追加はProjectorと全Consumerの再評価を必要とする。
 */
export type ProjectOperationSource = Readonly<{
  fieldId: string;
  state: ProjectOperationSourceState;
  sourceId?: string;
  sourceRevision?: string;
  observedAt?: string;
  value?: unknown;
}>;

/**
 * Project Viewへ投影した一つの項目を定義する。
 *
 * @responsibility 入力状態を保ったまま、開示可能な出所と値だけを公開する。
 * @trace ARCH-000005
 * @shape fieldId、state、source、revision、observedAtおよびvalueを表す。
 * @invariant restrictedではsourceId、sourceRevision、observedAt、valueをnullへ固定する。
 * @boundary ProjectorとWorkbench／MCP等の利用側の結果境界。
 * @security restricted Sourceの存在以上の情報を公開しない。
 * @compatibility nullは未観測または非開示であり、空文字や正常値を意味しない。
 */
export type ProjectOperationProjectionItem = Readonly<{
  fieldId: string;
  state: ProjectOperationSourceState;
  sourceId: string | null;
  sourceRevision: string | null;
  observedAt: string | null;
  value: unknown | null;
}>;

/**
 * Project Viewの読取り専用結果を定義する。
 *
 * @responsibility 全項目の状態と全体のcomplete／partial判定を同じProjectionへ閉じる。
 * @trace ARCH-000005
 * @shape projectId、projectionId、statusおよび項目列を表す。
 * @invariant 一つでも不完全状態があればstatusをpartialとする。
 * @boundary Projectorと利用側の公開Read Model境界。
 * @security Projectionは書込みAuthorityまたは非開示Source一覧を持たない。
 * @compatibility 利用側はstatusだけで個別項目の状態を推定しない。
 */
export type ProjectOperationProjection = Readonly<{
  projectId: string;
  projectionId: string;
  status: "complete" | "partial";
  items: readonly ProjectOperationProjectionItem[];
}>;

/**
 * Project Operation候補のCanonical最小記録を定義する。
 *
 * @responsibility Candidate Identity、出所、対象Owner、基準Revision、媒体表示および状態を一つの記録へ閉じる。
 * @trace ARCH-000006
 * @shape created／under_review／adopted／rejected／heldの状態と採否Relationを表す。
 * @invariant adopted以外の状態は所有正本Revisionを変更しない。
 * @boundary Candidate Storeと所有正本Writerの型境界。
 * @security 媒体表示名から候補種別、Ownerまたは採用Authorityを推定しない。
 * @compatibility Candidate IdentityとsourceRevisionの意味を変更しない。
 */
export type ProjectOperationCandidate = Readonly<{
  candidateId: string;
  sourceId: string;
  sourceRevision: string;
  targetOwner: string;
  expectedOwnerRevision: number;
  mediumLabel: string;
  state: "created" | "under_review" | "adopted" | "rejected" | "held";
}>;

/**
 * 候補へ適用する人間判断を定義する。
 *
 * @responsibility adopt、reject、holdと判断主体・対象Revisionを明示入力として保持する。
 * @trace ARCH-000006
 * @shape decision、principalId、authorityVerifiedおよびobservedOwnerRevisionを表す。
 * @invariant authorityVerifiedは外部Authority境界の観測結果であり、本Subsystemが発行しない。
 * @boundary Human Decision AdapterとCandidate Adoptionの入力境界。
 * @security principalIdだけからAuthorityを推定しない。
 * @compatibility 判断値の追加時は正本Effectと全利用側を再評価する。
 */
export type ProjectOperationCandidateDecision = Readonly<{
  decision: "adopt" | "reject" | "hold";
  principalId: string;
  authorityVerified: boolean;
  observedOwnerRevision: number;
}>;

/**
 * 候補採否の公開結果を定義する。
 *
 * @responsibility 採否状態、正本Effect有無、次Revisionおよび拒否理由を一つの結果へ閉じる。
 * @trace ARCH-000006
 * @shape completedまたはblockedと、Candidate状態・Effect情報を表す。
 * @invariant blocked、reject、holdではownerEffectIssuedをfalseとする。
 * @boundary Candidate Adoptionと所有正本Writerの結果境界。
 * @security 結果は採用Authorityまたは正本Writer Capabilityを含まない。
 * @compatibility reason値は利用側が安全な停止を識別する安定契約である。
 */
export type ProjectOperationCandidateDecisionResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "project_operation_candidate_adopted"
    | "project_operation_candidate_rejected"
    | "project_operation_candidate_held"
    | "project_operation_candidate_invalid"
    | "project_operation_candidate_authority_invalid"
    | "project_operation_candidate_revision_conflict"
    | "project_operation_candidate_already_decided";
  candidateState: ProjectOperationCandidate["state"];
  ownerEffectIssued: boolean;
  nextOwnerRevision: number | null;
}>;

/**
 * 部分Source集合から根拠付きProject Viewを生成する。
 *
 * @responsibility 不完全状態を個別に保持し、restricted Sourceの詳細を除去した読取りProjectionを返す。
 * @trace ARCH-000005
 * @input projectId: 対象Project、projectionId: 投影Identity、sources: Source観測集合。
 * @returns 完全性と項目別状態を持つProjectOperationProjection。
 * @precondition Project、Projectionおよびfield Identityが空でなく、fieldIdが重複しない。
 * @postcondition 入力順を保ち、complete以外を完全状態へ畳まない。
 * @effect N/A: 入力値から新しい読取り値を構築するだけである。
 * @failure 不正Identityまたは重複fieldIdは例外で拒否し、部分Projectionを返さない。
 * @invariant restricted項目からSource、Revision、時点および値を公開しない。
 * @boundary 複数Source ReaderとProject Management Projectionの直接境界。
 * @security 非開示SourceのIdentity、Revision、値を結果へ含めない。
 * @concurrency N/A: 不変Snapshotの同期変換だけを行う。
 */
export function projectProjectOperationSources(
  projectId: string,
  projectionId: string,
  sources: readonly ProjectOperationSource[],
): ProjectOperationProjection {
  if (!projectId || !projectionId || sources.some((source) => !source.fieldId))
    throw new Error("project_operation_projection_input_invalid");
  if (new Set(sources.map((source) => source.fieldId)).size !== sources.length)
    throw new Error("project_operation_projection_field_duplicate");
  const items = sources.map((source): ProjectOperationProjectionItem => {
    const isRestricted = source.state === "restricted";
    return Object.freeze({
      fieldId: source.fieldId,
      state: source.state,
      sourceId: isRestricted ? null : (source.sourceId ?? null),
      sourceRevision: isRestricted ? null : (source.sourceRevision ?? null),
      observedAt: isRestricted ? null : (source.observedAt ?? null),
      value: isRestricted ? null : (source.value ?? null),
    });
  });
  return Object.freeze({
    projectId,
    projectionId,
    status: items.every((item) => item.state === "complete")
      ? "complete"
      : "partial",
    items: Object.freeze(items),
  });
}

/**
 * 人間判断を候補へ適用し、所有正本Effectの可否を決定する。
 *
 * @responsibility Authority、出所、Owner、状態およびRevisionを検証し、明示adoptだけを一回の正本Effectへ変換する。
 * @trace ARCH-000006
 * @input candidate: Candidate Store記録、decision: Authority境界で検証済みの判断入力。
 * @returns 候補状態、Effect有無および次Revisionを持つ決定結果。
 * @precondition Candidateと判断は同じ固定Snapshotから取得される。
 * @postcondition reject／hold／blockedは正本Effect 0、adoptだけが次Revisionを一つ進める。
 * @effect adopt成功時だけ所有正本Writerへ一回のEffectを許可する結果を返す。
 * @failure Authority不足、出所・Owner不足、競合Revisionまたは決定済み候補をblockedへ閉じる。
 * @invariant 媒体表示名の一致または結果受領だけでadoptしない。
 * @boundary Candidate Store→Authority Gate→所有正本Writerの境界。
 * @security authorityVerifiedがfalseの判断では正本Effectを許可しない。
 * @concurrency observedOwnerRevisionとexpectedOwnerRevisionの一致で競合更新を拒否する。
 */
export function applyProjectOperationCandidateDecision(
  candidate: ProjectOperationCandidate,
  decision: ProjectOperationCandidateDecision,
): ProjectOperationCandidateDecisionResult {
  if (
    !candidate.candidateId ||
    !candidate.sourceId ||
    !candidate.sourceRevision ||
    !candidate.targetOwner
  )
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_invalid",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (!decision.authorityVerified || !decision.principalId)
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_authority_invalid",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (candidate.state === "adopted" || candidate.state === "rejected")
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_already_decided",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (decision.observedOwnerRevision !== candidate.expectedOwnerRevision)
    return Object.freeze({
      status: "blocked",
      reason: "project_operation_candidate_revision_conflict",
      candidateState: candidate.state,
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (decision.decision === "reject")
    return Object.freeze({
      status: "completed",
      reason: "project_operation_candidate_rejected",
      candidateState: "rejected",
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  if (decision.decision === "hold")
    return Object.freeze({
      status: "completed",
      reason: "project_operation_candidate_held",
      candidateState: "held",
      ownerEffectIssued: false,
      nextOwnerRevision: null,
    });
  return Object.freeze({
    status: "completed",
    reason: "project_operation_candidate_adopted",
    candidateState: "adopted",
    ownerEffectIssued: true,
    nextOwnerRevision: candidate.expectedOwnerRevision + 1,
  });
}
