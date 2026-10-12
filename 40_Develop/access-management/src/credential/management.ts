/**
 * 通常鍵変更の候補と、現在資格の発行事実・管理一覧を判断・投影する。
 * @responsibility 保存Ownerへ閉じた候補を渡し、保存・乱数生成・提示を引き取らない。
 * @trace ARCH-000013
 */
import { evaluateManagementPermission } from "../access/management-permission.ts";
import type { AccessManagementState } from "../state/parse.ts";
import { resolveCredentialAuthentication } from "./authentication.ts";
import {
  projectKeyExchangeState,
  type KeyExchangeSnapshot,
} from "./key-exchange.ts";
import type { AccessRole } from "../access/management-permission.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CREDENTIAL_ID = /^[0-9a-f]{24}$/;

/**
 * 現在管理者へ返す資格管理画面の非秘密Snapshotを表す。
 * @responsibility 対象選択・旧集合表示・未解決交換を一改訂へ結び、資格材料を除外する。
 * @trace ARCH-000013
 * @shape revision、actorUserId、users、credentials、exchange。
 * @invariant exchange nullは現在recordなしで、過去交換の完了証明ではない。
 * @boundary 同Process Workbench専用の内部公開API。MCP／Remoteへ公開しない。
 * @security Secret・salt・Verifier・Root・内容権限・Repository情報を含めない。
 * @compatibility 最新Schema v2のUser結合と交換相関だけ。
 */
export type CredentialAdministrationSnapshot = Readonly<{
  revision: number;
  actorUserId: string;
  users: readonly Readonly<{
    userId: string;
    username: string;
    role: AccessRole;
  }>[];
  credentials: readonly Omit<CredentialIssuanceSnapshot, "revision">[];
  exchange: KeyExchangeSnapshot | null;
}>;

/**
 * 資格管理の非秘密投影と取得不能を分ける。
 * @responsibility 認証・認可・材料処置・解放不明でSnapshotを返さない。
 * @trace ARCH-000013
 * @shape completedのsnapshot、または固定unavailableのreason。
 * @invariant 未取得は空一覧でも過去処理の失敗証明でもない。
 * @boundary AM保存Ownerから同Process Workbenchへ。
 * @security 拒否時に対象存在・件数・Role・保存Pathを開示しない。
 * @compatibility 一覧・表示専用。処置時には別のfresh認可を要求する。
 */
export type CredentialAdministrationStateResult =
  | Readonly<{
      status: "completed";
      snapshot: CredentialAdministrationSnapshot;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "credential_administration_unavailable";
    }>;

/**
 * 同じ改訂の現在管理者へ資格一覧と交換相関を投影する。
 * @responsibility 対象選択を非秘密値へ閉じ、表示結果を処置Authorityにしない。
 * @trace ARCH-000013
 * @input 完全検査済み現在状態と信頼しないBearer。
 * @returns 不変な所有Snapshot、または非開示拒否のnull。
 * @precondition 保存Ownerが既存Lock内で完全Schemaを検査する。
 * @postcondition 現在administrator・初回完了時だけ一改訂の値を返す。
 * @effect 現在資格のVerifier照合と局所投影だけ。保存・鍵生成・提示0。
 * @failure 初回途中・非管理者・失効・交換相関不明はnull。
 * @invariant 内部配列やCredential recordを共有せず、内容権限を取得しない。
 * @boundary 現在意味の投影と物理保存Owner。
 * @security 資格材料・Root・Repository Bindingを返さない。
 * @concurrency 同Lock内の一Snapshotだけ。後続操作は現在条件を再評価する。
 */
export function projectCredentialAdministration(
  current: AccessManagementState,
  token: string,
): CredentialAdministrationSnapshot | null {
  if (current.initialization.stage !== "completed") return null;
  const actor = resolveCredentialAuthentication(token, current);
  if (actor?.role !== "administrator") return null;
  const record = current.unresolvedKeyExchanges[0];
  const exchange = record
    ? projectKeyExchangeState(current, "workbench", token, record.recoveryId)
    : null;
  if (record && !exchange) return null;
  return Object.freeze({
    revision: current.revision,
    actorUserId: actor.userId,
    users: Object.freeze(
      current.users.map(({ userId, username, role }) =>
        Object.freeze({ userId, username, role }),
      ),
    ),
    credentials: Object.freeze(
      current.credentials.map(
        ({ credentialId, userId, operationId, presentation, revoked }) =>
          Object.freeze({
            credentialId,
            userId,
            issuanceOperationId: operationId,
            presentation,
            revoked,
          }),
      ),
    ),
    exchange,
  });
}

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

/**
 * 現在資格recordの非秘密な発行相関を表す。
 * @responsibility 保存済み事実を元要求の成功Receiptから分離する。
 * @trace ARCH-000013
 * @shape 改訂・資格ID・User ID・元発行ID・提示状態・現在失効。
 * @invariant revokedは元失効要求のcompletedを証明しない。
 * @boundary 管理者向けの短命読取り投影。
 * @security Secret・salt・Verifier・他資格・Root・Recoveryを含めない。
 * @compatibility 現Schema v2資格。未発行確定・履歴・再表示なし。
 */
export type CredentialIssuanceSnapshot = Readonly<{
  revision: number;
  credentialId: string;
  userId: string;
  issuanceOperationId: string;
  presentation: "not_attempted" | "unconfirmed" | "confirmed";
  revoked: boolean;
}>;

/**
 * 現在管理者のexact元発行相関だけを投影する。
 * @responsibility 対象不存在や結合差を未発行確定へ丸めない。
 * @trace ARCH-000013
 * @input 鍵・完全検査済み状態・元発行UUID・User UUID。
 * @returns 所有済み凍結投影、または固定非開示拒否のnull。
 * @precondition 同Lock内の保存Ownerが完全状態を検査済み。
 * @postcondition 入力状態を変更せず、秘密・内部参照を透過しない。
 * @effect 現在BearerのVerifier照合とメモリ投影だけ。
 * @failure 初回未完了・未認証・非管理者・不正相関・record不在はnull。
 * @invariant 元発行IDは独立失効要求の受付IDではない。
 * @boundary 現在資格の意味投影。物理観測・材料処置・解放は別Owner。
 * @security 古いRoleや相関ID自体をAuthorityにしない。
 * @concurrency 同じ改訂の一読取りだけ。次要求はfresh状態で再評価する。
 */
export function projectCredentialIssuance(
  token: string,
  current: AccessManagementState,
  issuanceOperationId: string,
  userId: string,
): CredentialIssuanceSnapshot | null {
  if (
    typeof token !== "string" ||
    typeof issuanceOperationId !== "string" ||
    !UUID.test(issuanceOperationId) ||
    typeof userId !== "string" ||
    !UUID.test(userId) ||
    current.initialization.stage !== "completed"
  )
    return null;
  const actor = resolveCredentialAuthentication(token, current);
  if (actor?.role !== "administrator") return null;
  const credential = current.credentials.find(
    (item) =>
      item.operationId === issuanceOperationId && item.userId === userId,
  );
  if (!credential) return null;
  return Object.freeze({
    revision: current.revision,
    credentialId: credential.credentialId,
    userId: credential.userId,
    issuanceOperationId: credential.operationId,
    presentation: credential.presentation,
    revoked: credential.revoked,
  });
}
