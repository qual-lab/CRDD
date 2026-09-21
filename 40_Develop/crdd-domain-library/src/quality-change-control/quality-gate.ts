/**
 * 固定改訂版と必須確認集合から現在の品質Gateを導出する。
 *
 * @responsibility 変更候補の固定、必須確認集合の保持、結果統合および是正後の再入場を所有する。
 * @trace ARCH-000003
 */

/**
 * 品質確認の結果状態を定義する。
 *
 * @responsibility 確認結果を合格、指摘あり、確認不能へ限定する。
 * @trace ARCH-000003
 * @shape QualityCheckStatusが表す有限状態を固定する。
 * @invariant 未完了または確認不能をpassへ含めない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authorityまたは秘密値を扱わない。
 * @compatibility 利用側は宣言済み状態だけを使用する。
 */
export type QualityCheckStatus = "pass" | "finding" | "blocked";

/**
 * 固定した変更候補を定義する。
 *
 * @responsibility 改訂版と必須確認集合を一つの不変なSnapshotとして保持する。
 * @trace ARCH-000003
 * @shape revisionとrequiredCheckIdsを固定する。
 * @invariant requiredCheckIdsは空でなく重複せず、外部から変更できない。
 * @boundary N/A: 値契約は外部境界を開かない。
 * @security N/A: Authorityまたは秘密値を扱わない。
 * @compatibility 利用側は改訂版と必須確認集合だけへ依存する。
 */
export type FixedQualityCandidate = Readonly<{
  revision: string;
  requiredCheckIds: readonly string[];
}>;

/**
 * 一件の品質確認結果を定義する。
 *
 * @responsibility 確認Identity、対象改訂版、状態および未確認理由を保持する。
 * @trace ARCH-000003
 * @shape checkId、revision、status、reasonを固定する。
 * @invariant blockedは空でないreasonを持つ。
 * @boundary N/A: 値契約は外部境界を開かない。
 * @security N/A: Authorityまたは秘密値を扱わない。
 * @compatibility 利用側は宣言済みPropertyだけへ依存する。
 */
export type QualityCheckResult = Readonly<{
  checkId: string;
  revision: string;
  status: QualityCheckStatus;
  reason?: string;
}>;

/**
 * 現在の品質Gate状態を定義する。
 *
 * @responsibility 完了、指摘、未確認を区別した統合結果を保持する。
 * @trace ARCH-000003
 * @shape state、revision、required、completed、missing、findings、blockedを固定する。
 * @invariant verifiedはmissing、findings、blockedを持たない。
 * @boundary N/A: 値契約は外部境界を開かない。
 * @security N/A: Release Authorityを付与しない。
 * @compatibility stateは品質状態でありRelease判断ではない。
 */
export type IntegratedQualityGate = Readonly<{
  state: "verified" | "changes_required" | "under_review";
  revision: string;
  requiredCheckIds: readonly string[];
  completedCheckIds: readonly string[];
  missingCheckIds: readonly string[];
  findingCheckIds: readonly string[];
  blockedCheckIds: readonly string[];
}>;

/**
 * 空でないIdentityを検証する。
 *
 * @responsibility 改訂版と確認Identityの空値を拒否する。
 * @trace ARCH-000003
 * @input value: string、label: string
 * @returns trim済みIdentityを返す。
 * @precondition labelが入力項目を一意に示す。
 * @postcondition 空白だけの値を返さない。
 * @effect N/A: 局所値だけを扱う。
 * @failure 空値ではTypeErrorを送出する。
 * @invariant 入力Identityの文字大小を変更しない。
 * @boundary N/A: Process内で完結する。
 * @security N/A: 秘密値またはAuthorityを扱わない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function requireIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${label}_required`);
  return normalized;
}

/**
 * 改訂版と必須確認集合を固定する。
 *
 * @responsibility 品質統合中に縮小できない必須確認集合を生成する。
 * @trace ARCH-000003
 * @input revision: string、requiredCheckIds: readonly string[]
 * @returns 変更不能なFixedQualityCandidateを返す。
 * @precondition 必須確認集合が一件以上与えられる。
 * @postcondition 入力配列と独立した凍結Snapshotを返す。
 * @effect N/A: 外部または共有Effectを発行しない。
 * @failure 空集合、空Identity、重複IdentityをTypeErrorで拒否する。
 * @invariant 固定後の必須確認集合を統合都合で縮小しない。
 * @boundary N/A: Process内Domain契約で完結する。
 * @security N/A: 確認集合をRelease Authorityへ読み替えない。
 * @concurrency 同じ入力から独立した不変Snapshotを返す。
 */
export function fixQualityCandidate(
  revision: string,
  requiredCheckIds: readonly string[],
): FixedQualityCandidate {
  const fixedRevision = requireIdentity(revision, "revision");
  if (requiredCheckIds.length === 0)
    throw new TypeError("required_check_set_empty");
  const normalizedCheckIds = requiredCheckIds.map((value) =>
    requireIdentity(value, "check_id"),
  );
  if (new Set(normalizedCheckIds).size !== normalizedCheckIds.length)
    throw new TypeError("required_check_id_duplicate");
  return Object.freeze({
    revision: fixedRevision,
    requiredCheckIds: Object.freeze([...normalizedCheckIds]),
  });
}

/**
 * 固定候補へ同じ改訂版の確認結果を統合する。
 *
 * @responsibility 欠落、指摘、確認不能および別改訂版混入を保持して現在Gateを導出する。
 * @trace ARCH-000003
 * @input candidate: FixedQualityCandidate、results: readonly QualityCheckResult[]
 * @returns IntegratedQualityGateを返す。
 * @precondition candidateはfixQualityCandidateが生成したSnapshotである。
 * @postcondition 全必須確認が同じ改訂版でpassした場合だけverifiedを返す。
 * @effect N/A: 結果を投影するだけでReleaseまたはRepository Effectを発行しない。
 * @failure 未登録確認、重複結果、別改訂版、blocked理由欠落をTypeErrorで拒否する。
 * @invariant 部分Pass、旧Pass、観測不能を全体Passへ畳まない。
 * @boundary 各独立確認結果と品質状態統合の境界。
 * @security 統合結果はRisk受容またはRelease Authorityを付与しない。
 * @concurrency 入力Snapshotを変更せず同じ入力から同じ結果を返す。
 */
export function integrateQualityGate(
  candidate: FixedQualityCandidate,
  results: readonly QualityCheckResult[],
): IntegratedQualityGate {
  const required = new Set(candidate.requiredCheckIds);
  const observed = new Map<string, QualityCheckResult>();
  for (const result of results) {
    const checkId = requireIdentity(result.checkId, "check_id");
    if (!required.has(checkId)) throw new TypeError("check_id_not_required");
    if (observed.has(checkId)) throw new TypeError("check_result_duplicate");
    if (result.revision !== candidate.revision)
      throw new TypeError("check_result_revision_mismatch");
    if (result.status === "blocked" && !result.reason?.trim())
      throw new TypeError("blocked_reason_required");
    observed.set(checkId, { ...result, checkId });
  }

  const missingCheckIds = candidate.requiredCheckIds.filter(
    (id) => !observed.has(id),
  );
  const findings = candidate.requiredCheckIds.filter(
    (id) => observed.get(id)?.status === "finding",
  );
  const blockedCheckIds = candidate.requiredCheckIds.filter(
    (id) => observed.get(id)?.status === "blocked",
  );
  const completedCheckIds = candidate.requiredCheckIds.filter((id) =>
    observed.has(id),
  );
  const state =
    findings.length > 0
      ? "changes_required"
      : missingCheckIds.length > 0 || blockedCheckIds.length > 0
        ? "under_review"
        : "verified";

  return Object.freeze({
    state,
    revision: candidate.revision,
    requiredCheckIds: candidate.requiredCheckIds,
    completedCheckIds: Object.freeze(completedCheckIds),
    missingCheckIds: Object.freeze(missingCheckIds),
    findingCheckIds: Object.freeze(findings),
    blockedCheckIds: Object.freeze(blockedCheckIds),
  });
}

/**
 * 是正後の新しい固定候補を作る。
 *
 * @responsibility 旧結果を流用せず必須確認集合だけを新改訂版へ引き継ぐ。
 * @trace ARCH-000003
 * @input previous: FixedQualityCandidate、newRevision: string
 * @returns 新改訂版のFixedQualityCandidateを返す。
 * @precondition newRevisionがprevious.revisionと異なる。
 * @postcondition 必須確認集合を維持し、確認結果を一件も持たない新Snapshotを返す。
 * @effect N/A: RepositoryまたはRelease Effectを発行しない。
 * @failure 同一改訂版への再入場をTypeErrorで拒否する。
 * @invariant 旧改訂版のPass結果を新改訂版へ転用しない。
 * @boundary 是正結果と再レビュー開始の境界。
 * @security 再入場はRisk受容またはRelease Authorityを付与しない。
 * @concurrency 新旧Snapshotは独立し共有可変状態を持たない。
 */
export function reenterQualityReview(
  previous: FixedQualityCandidate,
  newRevision: string,
): FixedQualityCandidate {
  const normalizedRevision = requireIdentity(newRevision, "revision");
  if (normalizedRevision === previous.revision)
    throw new TypeError("new_revision_required");
  return fixQualityCandidate(normalizedRevision, previous.requiredCheckIds);
}
