/**
 * 通常の鍵発行・独立失効の現在認可と対象候補を判断する。
 * @responsibility 保存Ownerへ閉じた候補を渡し、保存・乱数生成・提示を引き取らない。
 * @trace ARCH-000013
 */
import { evaluateManagementPermission } from "../access/management-permission.ts";
import type { AccessManagementState } from "../state/parse.ts";
import { resolveCredentialAuthentication } from "./authentication.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CREDENTIAL_ID = /^[0-9a-f]{24}$/;

/**
 * 保存前の鍵変更候補と対象位置を表す。
 * @responsibility 発行の容量予約用資格と失効対象を区別する。
 * @trace ARCH-000013
 * @shape 所有済みnext状態・operation・credentialIndex。
 * @invariant 発行placeholderは実資格でも保存許可でもない。
 * @boundary 同Lock内の私有保存Ownerだけ。
 * @security 内部SnapshotをPackage公開結果へ返さない。
 * @compatibility 現Schema v2。通常発行・独立失効だけ。
 */
export type PreparedCredentialChange = {
  next: AccessManagementState;
  operation: "issueCredential" | "revokeCredential";
  credentialIndex: number;
};

/**
 * 同改訂の現在認可とexact対象から通常鍵変更候補を作る。
 * @responsibility 途中交換・未完了初回・既失効・元発行ID再利用を新処置にしない。
 * @trace ARCH-000013
 * @input 鍵・完全状態・期待改訂・受付UUID・操作・User ID・失効時の資格ID。
 * @returns 所有候補または非開示拒否のnull。
 * @precondition 保存Ownerが既存Lock内で完全Schemaを検査した状態。
 * @postcondition 入力状態を変更せず、対象外情報を候補で保持する。
 * @effect 本人Verifier照合とメモリ候補だけ。鍵生成・I/Oなし。
 * @failure 不正入力・未認証・未許可・対象差・未解決交換はnull。
 * @invariant 既失効を元要求completedへ丸めず、Secretを再取得しない。
 * @boundary 現在の意味判断と物理保存。
 * @security 古いRole投影やrequest IDだけをAuthorityにしない。
 * @concurrency 同じLock内で評価し、別要求で候補を再利用しない。
 */
export function prepareCredentialChange(
  token: string,
  current: AccessManagementState,
  expectedRevision: number,
  operationId: string,
  operation: "issueCredential" | "revokeCredential",
  userId: unknown,
  credentialId?: unknown,
): PreparedCredentialChange | null {
  if (
    typeof token !== "string" ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !UUID.test(operationId) ||
    typeof userId !== "string" ||
    !UUID.test(userId) ||
    (operation !== "issueCredential" && operation !== "revokeCredential") ||
    (operation === "issueCredential" && credentialId !== undefined) ||
    (operation === "revokeCredential" &&
      (typeof credentialId !== "string" || !CREDENTIAL_ID.test(credentialId)))
  )
    return null;
  if (
    current.initialization.stage !== "completed" ||
    current.revision !== expectedRevision ||
    current.revision >= Number.MAX_SAFE_INTEGER ||
    current.operationId === operationId ||
    current.initialization.attemptId === operationId ||
    current.unresolvedKeyExchanges.length !== 0 ||
    current.credentials.some((item) => item.operationId === operationId)
  )
    return null;
  const actor = resolveCredentialAuthentication(token, current);
  if (
    !actor ||
    evaluateManagementPermission(actor.role, { operation }) !== "allowed" ||
    !current.users.some((item) => item.userId === userId)
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  let credentialIndex: number;
  if (operation === "issueCredential") {
    credentialIndex = next.credentials.length;
    next.credentials.push({
      credentialId: "f".repeat(24),
      userId,
      tokenVersion: 1,
      tokenSalt: "f".repeat(32),
      tokenVerifier: "f".repeat(64),
      revoked: false,
      operationId,
      presentation: "not_attempted",
    });
  } else {
    credentialIndex = next.credentials.findIndex(
      (item) => item.credentialId === credentialId && item.userId === userId,
    );
    const target = next.credentials[credentialIndex];
    if (!target || target.revoked) return null;
    target.revoked = true;
  }
  return { next, operation, credentialIndex };
}
