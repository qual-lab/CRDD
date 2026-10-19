/**
 * 資格の発行・独立失効と管理情報の取得を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { evaluateManagementPermission } from "../authorization/management.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  CURRENT_LIMIT,
  locked,
  PENDING_LIMIT,
  preparePublicationBytes,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { resolveCredentialAuthentication } from "./authentication.ts";
import { projectKeyExchangeState } from "./exchange.ts";
import { createCredentialMaterial, readCredentialId } from "./token.ts";
import type {
  CredentialAdministrationSnapshot,
  CredentialAdministrationStateResult,
  CredentialIssuanceObservation,
  CredentialIssuanceSnapshot,
  CredentialManagementResult,
} from "./types.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const CREDENTIAL_ID = /^[0-9a-f]{24}$/;

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

/**
 * Workbenchの資格管理一覧を現在認可と同じ保存Lockで読む。
 * @responsibility 一改訂の非秘密対象と交換相関だけを、清掃・解放確認後に返す。
 * @trace ARCH-000013
 * @input 検証済み用途限定RootとServer memoryのBearer。
 * @returns 同改訂Snapshotまたは固定unavailable。
 * @precondition 同Process Workbenchの内部Consumerだけ。MCP／Remoteへ公開しない。
 * @postcondition 材料を処置した要求は事実0、次fresh要求だけで再評価する。
 * @effect 既存Lock・完全current読取り・現在認証・許可後の既知材料清掃。
 * @failure 認証・初回・認可・Schema・材料・清掃・Lock解放不明はSnapshot0。
 * @invariant readManagementState四kindを変えず、一覧を操作Authorityや過去完了証明にしない。
 * @boundary AM保存Owner→同Process資格管理Consumer。
 * @security Secret・Verifier・salt・Root・内容・内部回復参照を返さない。
 * @concurrency 全Writerと同じLockの一改訂。次操作はfresh認可する。
 */
export function readCredentialAdministrationState(
  root: FilesystemStoreRoot,
  token: string,
): CredentialAdministrationStateResult {
  const unavailable = {
    status: "unavailable" as const,
    reason: "credential_administration_unavailable" as const,
  };
  if (!readCredentialId(token)) return unavailable;
  const result = locked<CredentialAdministrationSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const snapshot = projectCredentialAdministration(current.state, token);
      if (!snapshot)
        return {
          status: "unavailable",
          reason: unavailable.reason,
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      if (settlePending(root, current, () => {}) !== "none")
        return {
          status: "unavailable",
          reason: unavailable.reason,
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
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
        reason: unavailable.reason,
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? { status: "completed", snapshot: result.value }
    : unavailable;
}

/**
 * 通常鍵変更の現在判定と物理保存を同じLockで実行する。
 * @responsibility 容量予約前の生成を禁止し、保存後の不明でSecretを返さない。
 * @trace ARCH-000013
 * @input 検証済みRoot・Bearer・期待改訂・受付UUID・固定操作・exact対象。
 * @returns 閉じた管理結果。新規成功発行だけ短命token。
 * @precondition 同Processの内部提示Ownerが呼ぶ。
 * @postcondition 対象外の資格・User・Role・登録・初回・交換状態を保持する。
 * @effect 既存Lockとpending／replace／current。issueだけ容量確認後に鍵生成。
 * @failure 認可前は固定拒否、認可後は主失敗と今回出版事実を保持する。
 * @invariant 先行出版を今回成功へ帰属せず、既失効を再出版しない。
 * @boundary 鍵変更の意味判断と既存保存Adapter。
 * @security Secretを失敗結果・例外本文へ含めず、内部Lock回復参照も公開しない。
 * @concurrency 既存Lock内で現在認可・対象・改訂・容量・保存を直列化する。
 */
function executeCredentialManagementMutation(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  operation: "issueCredential" | "revokeCredential",
  userId: unknown,
  credentialId?: unknown,
): CredentialManagementResult {
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    typeof userId !== "string" ||
    !ATTEMPT_UUID.test(userId) ||
    (operation === "revokeCredential" &&
      (typeof credentialId !== "string" ||
        !/^[0-9a-f]{24}$/.test(credentialId)))
  )
    return { status: "unavailable", reason: "credential_management_rejected" };
  let admitted = false;
  let issuedToken: string | undefined;
  let targetCredentialId: string | null = null;
  let publication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  const result = locked(root, () => {
    let revision: number | null = null;
    let stage = "read";
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "authorization";
      const prepared = prepareCredentialChange(
        token,
        current.state,
        expectedRevision,
        operationId,
        operation,
        userId,
        credentialId,
      );
      if (!prepared)
        return {
          status: "unavailable" as const,
          reason: "credential_management_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      stage = "pending";
      const settled = settlePending(root, current, () => {});
      cleanupConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      stage = "capacity";
      const reservation = preparePublicationBytes(
        current,
        prepared.next,
        "credential",
      );
      if (
        reservation.nextBytes.byteLength > CURRENT_LIMIT ||
        reservation.pendingBytes.byteLength > PENDING_LIMIT
      )
        throw new Error("credential_capacity");
      const target = prepared.next.credentials[prepared.credentialIndex];
      if (!target) throw new Error("credential_target_invalid");
      if (operation === "issueCredential") {
        stage = "generation";
        const material = createCredentialMaterial();
        if (
          current.state.credentials.some(
            (item) => item.credentialId === material.credentialId,
          )
        )
          throw new Error("credential_identity_collision");
        target.credentialId = material.credentialId;
        target.tokenSalt = material.tokenSalt;
        target.tokenVerifier = material.tokenVerifier;
        issuedToken = material.token;
      }
      targetCredentialId = target.credentialId;
      stage = "candidate";
      const parsed = parseAccessManagementState(serialize(prepared.next));
      if (parsed.status !== "parsed")
        throw new Error("credential_candidate_invalid");
      stage = "publication";
      const published = publishState(root, current, parsed.state, "credential");
      publication = published.publication;
      return published;
    } catch {
      return {
        status: "unavailable" as const,
        reason: `state_store_credential_${stage}_failed`,
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "credential_management_rejected" };
  if (result.status === "completed" && targetCredentialId !== null) {
    const completed = {
      status: "completed" as const,
      operationId,
      expectedRevision,
      revision: result.value.revision,
      userId,
      credentialId: targetCredentialId,
      publication: "confirmed" as const,
      cleanupConfirmed: true as const,
    };
    if (operation === "issueCredential" && typeof issuedToken === "string")
      return { ...completed, operation, token: issuedToken };
    if (operation === "revokeCredential") return { ...completed, operation };
  }
  return {
    status: "unavailable",
    reason: "credential_management_unavailable",
    primaryFailure:
      result.status === "unavailable"
        ? result.reason
        : "state_store_credential_result_invalid",
    operationId,
    expectedRevision,
    observedRevision: result.revision,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 既存Userへ通常の鍵を一回発行して保存する。
 * @responsibility 現在administratorの要求だけを一資格追加へ接続する。
 * @trace ARCH-000013
 * @input Root・Bearer・期待改訂・受付UUID・既存userId。
 * @returns 新規成功保存時だけ短命鍵と非秘密相関、または未完了。
 * @precondition 通常Workbenchの同Process提示Ownerだけが呼ぶ。
 * @postcondition 既存資格失効0、元受付Identityを資格へ保存する。
 * @effect 容量予約後の鍵生成と既存状態出版。
 * @failure 生成・保存・清掃・解放不明ではSecret返却0。
 * @invariant 元発行の再要求からSecretを再取得・再発行しない。
 * @boundary 内部保存APIと一度提示Owner。
 * @security tokenをMCP・log・履歴へ公開しない。
 * @concurrency 既存同Lockで現在認可する。
 */
export function issueCredential(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: unknown,
): CredentialManagementResult {
  return executeCredentialManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    "issueCredential",
    userId,
  );
}

/**
 * exact資格とUser結合だけを独立失効する。
 * @responsibility 新発行・交換・対象外失効を行わない。
 * @trace ARCH-000013
 * @input Root・Bearer・期待改訂・受付UUID・userId・credentialId。
 * @returns 今回出版の非秘密結果、または固定拒否／未完了。
 * @precondition 通常Workbenchの現在administrator。
 * @postcondition 元発行ID・提示状態・対象外情報を保持する。
 * @effect exact資格のrevokedと状態改訂だけを保存する。
 * @failure 既失効・不一致は出版0。応答喪失をrollbackへ戻さない。
 * @invariant 同request IDと既失効だけから元要求completedを推定しない。
 * @boundary 内部通常失効API。Host／MCPへ公開しない。
 * @security Secret・新資格・交換Recovery 0。
 * @concurrency 既存Lock下で現在認可とexact対象を照合する。
 */
export function revokeCredential(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: unknown,
  credentialId: unknown,
): CredentialManagementResult {
  return executeCredentialManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    "revokeCredential",
    userId,
    credentialId,
  );
}

/**
 * 現在管理者へ元発行IDとUserのexact保存事実だけを返す。
 * @responsibility 材料処置・Lock解放不明から古い資格事実を返さない。
 * @trace ARCH-000013
 * @input 検証済みRoot・Bearer・元発行UUID・User UUID。
 * @returns 非秘密の現在観測、または固定unavailable。
 * @precondition 同Processの信頼済みWorkbench Consumerが呼ぶ。
 * @postcondition 既存材料処置がnone、Lock解放確認済みの場合だけ事実を返す。
 * @effect 同Lock current読取り・現在認証・相関確認後だけ既存材料処置。
 * @failure 材料処置・清掃・観測・解放不明、未許可は事実0。
 * @invariant 生成・再表示・Receipt・元失効要求のcompleted推定0。
 * @boundary 専用の資格読取りと既存Filesystem保存Owner。
 * @security token・salt・Verifier・内部Root・他User情報を透過しない。
 * @concurrency 同じLock内で照合し、材料を処置した要求は次のfresh要求へ戻す。
 */
export function readCredentialIssuance(
  root: FilesystemStoreRoot,
  token: string,
  issuanceOperationId: string,
  userId: string,
): CredentialIssuanceObservation {
  const unavailable = Object.freeze({
    status: "unavailable" as const,
    reason: "credential_issuance_unavailable" as const,
  });
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
    typeof issuanceOperationId !== "string" ||
    !ATTEMPT_UUID.test(issuanceOperationId) ||
    typeof userId !== "string" ||
    !ATTEMPT_UUID.test(userId)
  )
    return unavailable;
  const result = locked<CredentialIssuanceSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const snapshot = projectCredentialIssuance(
        token,
        current.state,
        issuanceOperationId,
        userId,
      );
      if (!snapshot || settlePending(root, current, () => {}) !== "none")
        return {
          status: "unavailable",
          reason: "credential_issuance_unavailable",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: false,
        };
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
        reason: "credential_issuance_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? Object.freeze({ status: "observed", snapshot: result.value })
    : unavailable;
}
