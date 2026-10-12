/**
 * Host初回設定の非Authorityな現在段階を投影する。
 * @responsibility 保存された元試行を再入場へ搬送し、秘密や開始許可を返さない。
 * @trace ARCH-000013
 */
import type { AccessManagementState } from "../state/parse.ts";

/**
 * 初回の再入場に必要な非秘密の保存観測を表す。
 * @responsibility AM入力不存在・進行段階・既存・観測不能を分離する。
 * @trace ARCH-000013
 * @shape fresh／existing／unknown、または段階別のin_progressと元試行・改訂・生成済みID。
 * @invariant freshはAM入力だけの不存在で、旧CROS入力不存在やHost初期化Authorityではない。
 * @boundary 信頼されたHost内部OwnerとAM保存Owner。MCP／HTTPへ公開しない。
 * @security Secret・salt・Verifier・Root・User一覧を含めない。
 * @compatibility v2だけ。旧形式を補完・変換しない。
 */
export type HostInitializationStateResult =
  | Readonly<{ status: "fresh" }>
  | Readonly<{ status: "existing" }>
  | Readonly<{
      status: "unknown";
      reason: "host_initialization_state_unavailable";
    }>
  | (Readonly<{ status: "in_progress"; attemptId: string; revision: number }> &
      (
        | Readonly<{ stage: "correlated" }>
        | Readonly<{ stage: "user_stored"; userId: string }>
        | Readonly<{
            stage: "credential_stored";
            userId: string;
            initialCredentialId: string;
            confirmationCredentialId: string;
            presentation: "not_attempted" | "unconfirmed" | "confirmed";
            unresolvedExchange: boolean;
          }>
      ));

/**
 * 検査済み現在状態からHost再入場に必要な項目だけを選ぶ。
 * @responsibility 元試行・生成済みID・提示段階を保持して追加生成を防ぐ。
 * @trace ARCH-000013
 * @input 同LockでSchema検査・保存材料処置済みの完全Snapshot。
 * @returns 所有済み段階投影。完了済みはexistingだけ。
 * @precondition 保存Ownerがv2を検査済み。任意値用のParserではない。
 * @postcondition 状態を変更せず、未生成User／資格のfieldを追加しない。
 * @effect N/A: メモリ値の選択だけ。
 * @failure 確認資格の欠測はunknown。
 * @invariant completedを再初期化候補に戻さず、資格保存段階を再表示許可にしない。
 * @boundary 完全内部SnapshotからHost専用非秘密投影。
 * @security 認証・通常管理・初回開始のAuthorityを発行しない。
 * @concurrency 保存Ownerが同じLock内で使用し、後続保存はfresh照合する。
 */
export function projectHostInitializationState(
  state: AccessManagementState,
): HostInitializationStateResult {
  const initial = state.initialization;
  if (initial.stage === "completed")
    return Object.freeze({ status: "existing" });
  const common = {
    status: "in_progress" as const,
    attemptId: initial.attemptId,
    revision: state.revision,
  };
  if (initial.stage === "correlated")
    return Object.freeze({ ...common, stage: initial.stage });
  if (initial.stage === "user_stored")
    return Object.freeze({
      ...common,
      stage: initial.stage,
      userId: initial.userId,
    });
  const credential = state.credentials.find(
    (item) => item.credentialId === initial.confirmationCredentialId,
  );
  if (!credential)
    return Object.freeze({
      status: "unknown",
      reason: "host_initialization_state_unavailable",
    });
  return Object.freeze({
    ...common,
    stage: initial.stage,
    userId: initial.userId,
    initialCredentialId: initial.initialCredentialId,
    confirmationCredentialId: initial.confirmationCredentialId,
    presentation: credential.presentation,
    unresolvedExchange: state.unresolvedKeyExchanges.length !== 0,
  });
}
