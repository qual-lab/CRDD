/**
 * 履歴保存の公開結果と残存を保持する失敗契約を所有する。
 * @responsibility 履歴保存の公開結果と残存を保持する失敗契約を所有する。
 * @trace ARCH-000007
 */

/**
 * execution-intelligence-storeで使用するExecution Intelligence Publication 結果の値契約を定義する。
 *
 * @responsibility Execution Intelligence Publication 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligencePublicationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligencePublicationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligencePublicationResultの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligencePublicationResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligencePublicationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionIntelligencePublicationResult =
  | Readonly<{
      status: "completed";
      reason: "execution_event_recorded" | "execution_event_already_recorded";
      eventId: string;
      effectState: "settled";
      effectIssued: true;
      effectStateUnknown: false;
      cleanupConfirmed: true;
      retryAllowed: false;
      manualRecoveryRequired: false;
      residualArtifactIds: readonly [];
      recoveryReference: null;
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      effectState: "no_effect" | "settled" | "unknown";
      effectIssued: boolean;
      effectStateUnknown: boolean;
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      manualRecoveryRequired: boolean;
      residualArtifactIds: readonly string[];
      recoveryReference: string | null;
    }>;

/**
 * MutationBoundaryErrorが担う状態と操作を提供する。
 *
 * @responsibility MutationBoundaryErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000007
 * @construction MutationBoundaryErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle MutationBoundaryErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: MutationBoundaryErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: MutationBoundaryErrorの宣言自体は実行時失敗を所有しない。
 * @invariant MutationBoundaryErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: MutationBoundaryErrorの宣言は外部境界を開かない。
 * @security N/A: MutationBoundaryErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: MutationBoundaryErrorは共有非同期状態を持たない同期処理である。
 */
export class MutationBoundaryError extends Error {
  readonly residualArtifactIds: readonly string[];

  constructor(reason: string, residualArtifactIds: readonly string[]) {
    super(reason);
    this.name = "MutationBoundaryError";
    this.residualArtifactIds = Object.freeze([...residualArtifactIds]);
  }
}

/**
 * Publicationを停止結果として構築する。
 *
 * @responsibility Publicationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000007
 * @input reason: string、effectState: "no_effect" | "settled" | "unknown"、cleanupConfirmed: boolean、residualArtifactIds: readonly string[]、retryAllowed、boundary: Readonly<{ effectIssued?: boolean; effectStateUnknown?: boolean; recoveryReference?: string | null; }>
 * @returns ExecutionIntelligencePublicationResultを返す。
 * @precondition 「reason: string、effectState: "no_effect" | "settled" | "unknown"、cleanupConfirmed: boolean、residualArtifactIds: readonly string[]、retryAllowed、boundary: Readonly<{ effectIssued?: boolean; effectStateUnknown?: boolean; recoveryReference?: string | null; }>」がblockedPublicationの入力契約を満たす。
 * @postcondition blockedPublicationの責務を完了した結果だけを返す。
 * @effect N/A: blockedPublicationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedPublicationは独自の失敗分岐を所有しない。
 * @invariant blockedPublicationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: blockedPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedPublicationは共有非同期状態を持たない同期処理である。
 */
export function blockedPublication(
  reason: string,
  effectState: "no_effect" | "settled" | "unknown",
  cleanupConfirmed: boolean,
  residualArtifactIds: readonly string[],
  retryAllowed = false,
  boundary: Readonly<{
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    recoveryReference?: string | null;
  }> = {},
): Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }> {
  const isEffectStateUnknown =
    boundary.effectStateUnknown ?? effectState === "unknown";
  const recoveryReference = boundary.recoveryReference ?? null;
  return Object.freeze({
    status: "blocked" as const,
    reason,
    effectState,
    effectIssued: boundary.effectIssued ?? effectState !== "no_effect",
    effectStateUnknown: isEffectStateUnknown,
    cleanupConfirmed,
    retryAllowed,
    manualRecoveryRequired:
      isEffectStateUnknown || !cleanupConfirmed || recoveryReference !== null,
    residualArtifactIds: Object.freeze([...residualArtifactIds]),
    recoveryReference,
  });
}
