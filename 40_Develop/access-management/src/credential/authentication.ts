/**
 * 現在資格のVerifierを照合し要求専用の本人情報を返す。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { locked, readCurrent, settlePending } from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { readCredentialId, verifyCredentialToken } from "./token.ts";
import type {
  AuthenticatedRequest,
  CredentialAuthenticationResult,
} from "./types.ts";

/**
 * 検査済み同一Snapshotから本人だけを認証・投影する。
 * @responsibility 現在資格・User・Roleを結合して固定DTOへ閉じる。
 * @trace ARCH-000013
 * @input 信頼しない鍵文字列とSchema検査済み所有Snapshot。
 * @returns 所有済み本人投影、または非開示拒否のnull。
 * @precondition 保存Ownerが同じ既存Lock下で完全Schemaを検査済み。
 * @postcondition Snapshotを変更せず、返却配列を共有しない。
 * @effect 同期Verifier照合だけ。I/O・鍵生成・配送なし。
 * @failure 不正形式・未知資格・失効・不一致・参照欠測・暗号故障はnull。
 * @invariant 初回credential_storedの照合を初回完了・通常接続記録へ昇格しない。
 * @boundary AM認証純粋解決。管理許可・Exposure・実Repository権限は別。
 * @security Secret・他User・保存材料を結果へ含めない。
 * @concurrency 呼出側の既存Lock区間内だけ。次要求は現在状態を読み直す。
 */
export function resolveCredentialAuthentication(
  token: string,
  state: AccessManagementState,
): AuthenticatedRequest | null {
  const credentialId = readCredentialId(token);
  if (!credentialId) return null;
  const credential = state.credentials.find(
    (item) => item.credentialId === credentialId,
  );
  if (
    !credential ||
    credential.revoked ||
    !verifyCredentialToken(token, credential)
  )
    return null;
  const user = state.users.find((item) => item.userId === credential.userId);
  if (!user) return null;
  const role = state.roleContentAccess.find((item) => item.role === user.role);
  if (!role) return null;
  return Object.freeze({
    revision: state.revision,
    credentialId,
    userId: user.userId,
    username: user.username,
    role: user.role,
    workspaceIds: Object.freeze([...role.workspaceIds]),
  });
}

/**
 * 現在状態を読み同じLock区間内で資格の本人投影を解決する。
 * @responsibility 要求毎の現在改訂と認証結果を結合して非秘密結果へ閉じる。
 * @trace ARCH-000013
 * @input 既存Rootと信頼しないBearer文字列。
 * @returns 本人の固定投影、認証拒否または状態未確認。
 * @precondition Rootは既存内部Ownerが検証済み。公開Transportは入力境界を別検査する。
 * @postcondition 読戻し・認証・投影・Lock解放確認時だけcompleted。
 * @effect 既存Lock、現在状態読取り、確認済み短命材料清掃、同期KDF。
 * @failure 失効・不一致等は同一拒否、保存／排他不明では本人情報0。
 * @invariant 管理実行許可・内容取得・初回完了・永続Sessionを作らない。
 * @boundary AM専用認証入口と内部保存Owner。
 * @security 生鍵・salt・Verifier・Root・Lock回復IDを結果へ含めない。
 * @concurrency 全Writerと同じLock下の同一改訂。後続Effectは別の現在認可。
 */
export function authenticateCredential(
  root: FilesystemStoreRoot,
  token: string,
): CredentialAuthenticationResult {
  return authenticateStoredCredential(root, token, false);
}

/**
 * 初回設定完了後の通常接続だけを認証する。
 * @responsibility 初回途中の本人確認と通常Surface接続を分離する。
 * @trace ARCH-000013
 * @input 検証済み管理Rootと信頼しないBearer文字列。
 * @returns 非秘密の本人投影、または既存の固定認証拒否・状態未確認。
 * @precondition Rootは既存保存Ownerが検証済み。
 * @postcondition 同改訂の有効資格と初回completed、清掃・Lock解放を確認した場合だけ成功。
 * @effect 既存Lock、状態読取り、同期KDF。認証成功後だけ短命材料を清掃する。
 * @failure 初回未完了・失効・不一致は同一拒否。状態・清掃・解放不明は本人情報なし。
 * @invariant 通常接続の受領記録・内容権限・永続Sessionを生成しない。
 * @boundary AM保存Ownerから通常Surfaceの要求内認証へ渡す。
 * @security 生鍵・内部Path・Verifierを返さず、認可対象Repositoryを観測しない。
 * @concurrency 同じLockの同改訂。後続内容操作は現在認可を取り直す。
 */
export function authenticateNormalConnection(
  root: FilesystemStoreRoot,
  token: string,
): CredentialAuthenticationResult {
  return authenticateStoredCredential(root, token, true);
}

/**
 * 用途別の初回完了条件を既存保存境界で照合する。
 * @responsibility 共通の資格照合・結果非開示・排他解放を重複させない。
 * @trace ARCH-000013
 * @input 管理Root、Bearer、通常接続の初回完了必須指定。
 * @returns 同改訂の本人投影、または固定の未取得結果。
 * @precondition 公開入口が用途を固定し、外部入力で用途を変更しない。
 * @postcondition 通常接続では有効資格と初回完了の確認前に材料を変更しない。
 * @effect 既存状態・Lock・KDFと短命材料清掃。新StoreやLockを作らない。
 * @failure 不正資格・未完了は拒否、観測・清掃・解放不明は状態未確認。
 * @invariant 初回本人確認の既存順序と結果を変更しない。
 * @boundary 二つの認証用途と単一保存Owner。
 * @security 対象Repository・生鍵・下位例外を公開しない。
 * @concurrency 同じ保存Lock内で認証と初回状態を照合する。
 */
function authenticateStoredCredential(
  root: FilesystemStoreRoot,
  token: string,
  requireCompletedInitialization: boolean,
): CredentialAuthenticationResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    };
  const result = locked<AuthenticatedRequest>(root, () => {
    try {
      const current = readCurrent(root);
      if (!requireCompletedInitialization)
        settlePending(root, current, () => {});
      const snapshot = resolveCredentialAuthentication(token, current.state);
      if (
        !snapshot ||
        (requireCompletedInitialization &&
          current.state.initialization.stage !== "completed")
      )
        return {
          status: "unavailable",
          reason: "credential_authentication_rejected",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      if (requireCompletedInitialization)
        settlePending(root, current, () => {});
      return {
        status: "completed",
        value: snapshot,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "credential_authentication_state_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? { status: "completed", snapshot: result.value }
    : {
        status: "unavailable",
        reason:
          result.reason === "credential_authentication_rejected" &&
          result.cleanupConfirmed
            ? "credential_authentication_rejected"
            : "credential_authentication_state_unavailable",
      };
}
