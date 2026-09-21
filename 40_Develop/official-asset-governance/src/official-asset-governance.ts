/**
 * 公式素材の判断と収載照合を純粋なDomain契約として所有する。
 *
 * @responsibility 素材の判断、Revision競合、状態遷移および収載根拠の一意な相関を実装する。
 * @trace ARCH-000017
 */

/**
 * 公式素材が取り得るCanonicalな状態。
 *
 * @responsibility 候補、採用、用途制限および取下げを互いに異なる状態として表す。
 * @trace ARCH-000017
 * @shape candidate、approved、restricted、withdrawnの閉じたUnion。
 * @invariant restrictedとwithdrawnをapprovedへ畳まない。
 * @boundary 公式素材Governance Subsystem内の状態契約。
 * @security 状態値だけでは公開、再配布または用途外利用のAuthorityを与えない。
 * @compatibility 値の追加または意味変更はARCH-000017と利用側の再確認を必要とする。
 */
export type OfficialAssetState =
  | "candidate"
  | "approved"
  | "restricted"
  | "withdrawn";

/**
 * 素材判断として許可する操作。
 *
 * @responsibility 状態遷移を採用、用途制限および取下げの明示判断へ限定する。
 * @trace ARCH-000017
 * @shape approve、restrict、withdrawの閉じたUnion。
 * @invariant 不明状態や自動採用を判断値として表現しない。
 * @boundary 決定権限者からDomain判断境界へ渡す操作契約。
 * @security 判断値自体は決定権限の証明ではない。
 * @compatibility 未知値は受理せず、新しい判断種別は契約改訂を必要とする。
 */
export type OfficialAssetDecision = "approve" | "restrict" | "withdraw";

/**
 * 公式素材のCanonical Record。
 *
 * @responsibility 一つの素材Identityへ出所、権利根拠、許可用途、対象版、判断者および状態を結合する。
 * @trace ARCH-000017
 * @shape assetIdとassetRevisionをIdentity軸、recordRevisionを競合制御軸として持つPlain Data。
 * @invariant 判断済み状態でも公開・Release Authorityを内包しない。
 * @boundary Domain判断と永続Store Adapterの間で利用する値契約。
 * @security 秘密値、Credentialおよび法的判断の自動証明を保持しない。
 * @compatibility 必須fieldの削除または意味変更は契約改訂を必要とする。
 */
export type OfficialAssetRecord = Readonly<{
  assetId: string;
  assetRevision: string;
  sourceStatement: string;
  rightsBasis: string | null;
  allowedPurposes: readonly string[];
  decisionAuthorityId: string | null;
  decidedAt: string | null;
  targetRelease: string | null;
  state: OfficialAssetState;
  recordRevision: number;
}>;

/**
 * 公式素材へ適用する判断入力。
 *
 * @responsibility 判断主体、用途、対象素材版および期待Record Revisionを確定前に固定する。
 * @trace ARCH-000017
 * @shape 一つの素材Identity、対象版、期待Revision、判断、根拠、用途および判断時点を持つ。
 * @invariant 判断対象と判断Authorityを別素材へ流用しない。
 * @boundary 人間判断をDomain状態遷移へ渡す入力境界。
 * @security decisionAuthorityIdは識別情報でありCredentialや署名値を含めない。
 * @compatibility 未知fieldを受理する公開Decoderは本Domain関数の外側で所有する。
 */
export type OfficialAssetDecisionInput = Readonly<{
  assetId: string;
  assetRevision: string;
  expectedRecordRevision: number;
  decision: OfficialAssetDecision;
  rightsBasis: string;
  allowedPurposes: readonly string[];
  decisionAuthorityId: string;
  decidedAt: string;
  targetRelease: string | null;
}>;

/**
 * 素材判断の完了または安全な拒否結果。
 *
 * @responsibility 共有状態の更新可否、競合RevisionおよびEffect発行可否を呼出し側へ明示する。
 * @trace ARCH-000017
 * @shape completedは更新後Record、blockedは理由と現在Revisionを持つ判別Union。
 * @invariant blocked結果ではstoreEffectIssuedが常にfalseである。
 * @boundary Domain判断からStore Adapterへ渡す結果境界。
 * @security 拒否時も未確認権利を承認済みとして公開しない。
 * @compatibility reason codeは利用側が安全な再評価経路を選ぶ安定値として扱う。
 */
export type OfficialAssetDecisionResult =
  | Readonly<{
      status: "completed";
      reason: "official_asset_decision_applied";
      record: OfficialAssetRecord;
      storeEffectIssued: true;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "official_asset_decision_input_invalid"
        | "official_asset_decision_target_mismatch"
        | "official_asset_decision_revision_conflict"
        | "official_asset_decision_transition_invalid";
      currentRecordRevision: number;
      storeEffectIssued: false;
    }>;

/**
 * 公式収載先が保持すべき素材判断Relation。
 *
 * @responsibility 収載物から素材Identity、対象版、判断Record Revisionおよび許可用途へ戻れるようにする。
 * @trace ARCH-000017
 * @shape inclusionIdと素材判断の相関fieldを持つ読取り専用Record。
 * @invariant 収載RelationはRelease公開または再配布Authorityを含まない。
 * @boundary 公式素材RecordとRepository収載先の照合境界。
 * @security 権利根拠本文を複製せず判断Recordへ参照で戻す。
 * @compatibility Relation fieldの削除は既存収載物の追跡不能を招くため許可しない。
 */
export type OfficialInclusionRecord = Readonly<{
  inclusionId: string;
  assetId: string;
  assetRevision: string;
  decisionRecordRevision: number;
  allowedPurpose: string;
  targetRelease: string | null;
}>;

/**
 * 素材判断を現在Recordへ適用する。
 *
 * @responsibility 完全な判断だけを一致するRevisionへ一回適用し、競合・不完全入力・不正遷移をEffect 0で拒否する。
 * @trace ARCH-000017
 * @input current: 現在の素材Record、input: 決定権限者が固定した判断入力。
 * @returns 更新後Recordを含む完了、または理由付きのEffect 0拒否を返す。
 * @precondition currentは検証済みStoreから同一Identityの現行値として取得されている。
 * @postcondition 完了時だけrecordRevisionを一つ増やし、入力の判断根拠とAuthorityを同じRecordへ結合する。
 * @effect 完了結果はStore Adapterへ一回の更新許可を与えるが、本関数自身は外部Effectを発行しない。
 * @failure 入力欠落、対象不一致、Revision競合またはwithdrawnからの再採用を区別して拒否する。
 * @invariant 生成手段だけから権利を推定せず、approved／restrictedには一つ以上の許可用途を要求する。
 * @boundary 決定権限者の判断と公式素材Storeの直接境界。
 * @security 判断Recordから公開、Releaseまたは用途外利用のAuthorityを生成しない。
 * @concurrency expectedRecordRevisionと現行Revisionの一致により同一素材への競合判断を直列化する。
 */
export function applyOfficialAssetDecision(
  current: OfficialAssetRecord,
  input: OfficialAssetDecisionInput,
): OfficialAssetDecisionResult {
  const nonEmpty = (value: string) => value.trim().length > 0;
  if (
    !nonEmpty(input.assetId) ||
    !nonEmpty(input.assetRevision) ||
    !Number.isSafeInteger(input.expectedRecordRevision) ||
    input.expectedRecordRevision < 0 ||
    !nonEmpty(input.rightsBasis) ||
    !nonEmpty(input.decisionAuthorityId) ||
    !nonEmpty(input.decidedAt) ||
    input.allowedPurposes.some((purpose) => !nonEmpty(purpose)) ||
    ((input.decision === "approve" || input.decision === "restrict") &&
      input.allowedPurposes.length === 0)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "official_asset_decision_input_invalid",
      currentRecordRevision: current.recordRevision,
      storeEffectIssued: false,
    });
  }
  if (
    current.assetId !== input.assetId ||
    current.assetRevision !== input.assetRevision
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "official_asset_decision_target_mismatch",
      currentRecordRevision: current.recordRevision,
      storeEffectIssued: false,
    });
  }
  if (current.recordRevision !== input.expectedRecordRevision) {
    return Object.freeze({
      status: "blocked",
      reason: "official_asset_decision_revision_conflict",
      currentRecordRevision: current.recordRevision,
      storeEffectIssued: false,
    });
  }
  if (current.state === "withdrawn" && input.decision !== "withdraw") {
    return Object.freeze({
      status: "blocked",
      reason: "official_asset_decision_transition_invalid",
      currentRecordRevision: current.recordRevision,
      storeEffectIssued: false,
    });
  }
  const state: OfficialAssetState =
    input.decision === "approve"
      ? "approved"
      : input.decision === "restrict"
        ? "restricted"
        : "withdrawn";
  return Object.freeze({
    status: "completed",
    reason: "official_asset_decision_applied",
    record: Object.freeze({
      ...current,
      rightsBasis: input.rightsBasis,
      allowedPurposes: Object.freeze([...input.allowedPurposes]),
      decisionAuthorityId: input.decisionAuthorityId,
      decidedAt: input.decidedAt,
      targetRelease: input.targetRelease,
      state,
      recordRevision: current.recordRevision + 1,
    }),
    storeEffectIssued: true,
  });
}

/**
 * 収載Relationが素材判断と許可用途へ一意に戻れるかを検証する。
 *
 * @responsibility 公式収載物の素材Identity、対象版、判断Revision、用途および対象ReleaseをCanonical Recordと照合する。
 * @trace ARCH-000017
 * @input record: 判断済み素材Record、inclusion: 公式収載先が保持するRelation。
 * @returns 完全一致かつ許可状態の場合だけverified、それ以外は理由付きblockedを返す。
 * @precondition 両入力は各Ownerから取得した不変値である。
 * @postcondition 入力、Repositoryまたは公開状態を変更しない。
 * @effect N/A: 読取り済み値を比較するだけである。
 * @failure Identity、Revision、用途、Releaseまたは状態の不一致を一つのblocked結果へ閉じる。
 * @invariant restrictedは記録された用途だけを許し、withdrawnとcandidateは収載可能としない。
 * @boundary 素材Recordと公式Repository収載Relationの照合境界。
 * @security 照合成功からRelease公開・再配布Authorityを生成しない。
 * @concurrency N/A: 同じSnapshotの不変値を同期比較する。
 */
export function verifyOfficialAssetInclusion(
  record: OfficialAssetRecord,
  inclusion: OfficialInclusionRecord,
): Readonly<
  | { status: "verified"; reason: "official_asset_inclusion_verified" }
  | { status: "blocked"; reason: "official_asset_inclusion_mismatch" }
> {
  const isVerified =
    (record.state === "approved" || record.state === "restricted") &&
    record.assetId === inclusion.assetId &&
    record.assetRevision === inclusion.assetRevision &&
    record.recordRevision === inclusion.decisionRecordRevision &&
    record.allowedPurposes.includes(inclusion.allowedPurpose) &&
    record.targetRelease === inclusion.targetRelease;
  return Object.freeze(
    isVerified
      ? {
          status: "verified",
          reason: "official_asset_inclusion_verified",
        }
      : {
          status: "blocked",
          reason: "official_asset_inclusion_mismatch",
        },
  );
}
