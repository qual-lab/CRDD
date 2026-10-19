/**
 * 初回限定接続の用途判定と確認結果の保存を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import crypto from "node:crypto";
import { types } from "node:util";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import type {
  AuthenticatedRequest,
  ConnectionAuthenticationResult,
  InitialConnectionBinding,
} from "../credential/types.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import { locked } from "../storage/lock.ts";
import type {
  AccessManagementState,
  StateStoreResult,
} from "../storage/types.ts";

/**
 * 初回確認相関をgetter・Proxyの呼出しなしに所有値へ変換する。
 * @responsibility 閉じた四fieldとUUID・資格・改訂境界を保存前に検査する。
 * @trace ARCH-000013
 * @input 信頼しない相関値。
 * @returns 所有した四field、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition 入力不変、accessor実行0。
 * @effect N/A: メモリ値の形式検査だけ。
 * @failure 不正・欠測・余分・未知prototypeはnull。
 * @invariant 欠測を既定値や現在値で補完しない。
 * @boundary 非Authority相関の閉入力。
 * @security 自由文字列・Secretを返却契約へ混入させない。
 * @concurrency N/A: 共有状態なし。
 */
export function readInitialConnectionBinding(
  value: unknown,
): InitialConnectionBinding | null {
  if (value === null || typeof value !== "object" || types.isProxy(value))
    return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = ["attemptId", "userId", "credentialId", "expectedRevision"];
  const actual = Reflect.ownKeys(descriptors);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key as string)) ||
    Object.values(descriptors).some((item) => !Object.hasOwn(item, "value"))
  )
    return null;
  const attemptId: unknown = descriptors.attemptId?.value;
  const userId: unknown = descriptors.userId?.value;
  const credentialId: unknown = descriptors.credentialId?.value;
  const expectedRevision: unknown = descriptors.expectedRevision?.value;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (
    typeof attemptId !== "string" ||
    !uuid.test(attemptId) ||
    typeof userId !== "string" ||
    !uuid.test(userId) ||
    typeof credentialId !== "string" ||
    !/^[0-9a-f]{24}$/.test(credentialId) ||
    typeof expectedRevision !== "number" ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    expectedRevision === Number.MAX_SAFE_INTEGER
  )
    return null;
  return Object.freeze({ attemptId, userId, credentialId, expectedRevision });
}

/**
 * 同じSnapshotの認証本人から通常または限定初回の用途を選ぶ。
 * @responsibility 初回の最新有効提示資格だけを限定候補にする。
 * @trace ARCH-000013
 * @input Schema検査済みSnapshotと同じLock・改訂で照合した本人。
 * @returns normal／initialの所有投影、またはnull。
 * @precondition 本人は同じSnapshotのKDF照合結果。
 * @postcondition 状態を変更せず、限定候補に通常本人情報を含めない。
 * @effect N/A: 値の比較だけ。
 * @failure 改訂差・初回段階差・提示不明・交換途中はnull。
 * @invariant 通常認証のcompleted要件を弱めない。
 * @boundary 認証本人と要求用途の純粋判定。
 * @security 候補から内容・管理・Tool実行の権限を発行しない。
 * @concurrency 保存Ownerが同じLock下で使う。
 */
export function selectConnectionAuthentication(
  state: AccessManagementState,
  actor: AuthenticatedRequest,
): Exclude<ConnectionAuthenticationResult, { status: "unavailable" }> | null {
  if (actor.revision !== state.revision) return null;
  const initial = state.initialization;
  if (initial.stage === "completed")
    return Object.freeze({ status: "normal", snapshot: actor });
  if (
    initial.stage !== "credential_stored" ||
    initial.userId !== actor.userId ||
    initial.confirmationCredentialId !== actor.credentialId ||
    state.unresolvedKeyExchanges.length !== 0 ||
    !state.credentials.some(
      (item) =>
        item.credentialId === actor.credentialId &&
        !item.revoked &&
        item.presentation === "confirmed",
    )
  )
    return null;
  return Object.freeze({
    status: "initial",
    binding: Object.freeze({
      attemptId: initial.attemptId,
      userId: actor.userId,
      credentialId: actor.credentialId,
      expectedRevision: state.revision,
    }),
  });
}

/**
 * freshな本人と初回相関から一出版または直後の再観測を選ぶ。
 * @responsibility 後続別改訂・別資格・失効・交換を古い初回成功へ丸めない。
 * @trace ARCH-000013
 * @input 完全Snapshot、同改訂の認証本人、閉入力相関。
 * @returns publish／observed、またはnull。
 * @precondition 同じ保存Lock内のfresh KDFとParser結果。
 * @postcondition 状態を変更せず、初回completed直後だけ再観測を許す。
 * @effect N/A: 値の比較だけ。
 * @failure 各相関差・未解決交換・提示未確認はnull。
 * @invariant 初回元資格と最新確認資格を混同しない。
 * @boundary 初回確認の純粋条件と保存Owner。
 * @security 判定をConsumerの完全要求検査や応答完了の証明にしない。
 * @concurrency 同じLock内だけ。次要求は再認証する。
 */
export function selectInitialConnectionConfirmation(
  state: AccessManagementState,
  actor: AuthenticatedRequest,
  binding: InitialConnectionBinding,
): "publish" | "observed" | null {
  const initial = state.initialization;
  if (
    actor.revision !== state.revision ||
    actor.userId !== binding.userId ||
    actor.credentialId !== binding.credentialId ||
    initial.attemptId !== binding.attemptId ||
    state.unresolvedKeyExchanges.length !== 0 ||
    !state.credentials.some(
      (item) =>
        item.credentialId === binding.credentialId &&
        !item.revoked &&
        item.presentation === "confirmed",
    )
  )
    return null;
  if (
    initial.stage === "credential_stored" &&
    initial.userId === binding.userId &&
    initial.confirmationCredentialId === binding.credentialId &&
    state.revision === binding.expectedRevision
  )
    return "publish";
  if (
    initial.stage === "completed" &&
    initial.initialUserId === binding.userId &&
    initial.confirmationCredentialId === binding.credentialId &&
    state.revision === binding.expectedRevision + 1
  )
    return "observed";
  return null;
}

/**
 * 通常本人か初回限定候補かを一回の同Lock認証で判定する。
 * @responsibility Lock外のstage読取りや二認証の組合せを排除する。
 * @trace ARCH-000013
 * @input 検証済み管理Rootと信頼しないBearer。
 * @returns 通常本人、非Authority初回相関、固定拒否／状態未確認。
 * @precondition Surfaceは初回候補を完全な限定接続要求の検査Ownerへ渡す。MCPはdiscover、Local Workbenchは専用connect POSTである。
 * @postcondition 認証・用途判定・材料清掃・Lock解放後だけ投影を返す。
 * @effect 既存Lock・状態読取り・KDF・許可後の既存pending処置。
 * @failure 不正資格・段階差は固定拒否、観測・清掃・解放不明は情報0。
 * @invariant 初回候補へ通常Role・内容・Toolの権限を付与しない。
 * @boundary AM要求内認証とSurfaceの用途別Handler。
 * @security 生鍵・Verifier・内部Path・状態Snapshotを返さない。
 * @concurrency 同じLock・同改訂で判定し、確認出版時はfreshに照合する。
 */
export function resolveConnectionAuthentication(
  root: FilesystemStoreRoot,
  token: string,
): ConnectionAuthenticationResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "connection_authentication_rejected",
    };
  const result = locked<
    Exclude<ConnectionAuthenticationResult, { status: "unavailable" }>
  >(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      const value =
        actor && selectConnectionAuthentication(current.state, actor);
      if (!value)
        return {
          status: "unavailable",
          reason: "connection_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      settlePending(root, current, () => {});
      return {
        status: "completed",
        value,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "connection_state_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? result.value
    : {
        status: "unavailable",
        reason:
          result.reason === "connection_authentication_rejected" &&
          result.cleanupConfirmed
            ? "connection_authentication_rejected"
            : "connection_state_unavailable",
      };
}

/**
 * 完全な限定要求の受理後に初回接続を保存確定する。
 * @responsibility freshな鍵・相関・提示・交換状態を同Lockで再照合する。
 * @trace ARCH-000013
 * @input 検証済みRoot、Bearer、閉じた初回相関、Consumer所有のAbortSignal。
 * @returns 保存／再観測と清掃・Lock終了済みの非秘密出版結果、または未完了。
 * @precondition 信頼済みConsumerがSurface別の完全限定接続要求を検査済み。入力相関だけでは許可しない。
 * @postcondition 一出版後は同歴史相関と直後改訂だけ再観測。通常Authorityは返さない。
 * @effect 既存Lock・fresh KDF・既存pending処置・completedの同期出版／読戻し／清掃。
 * @failure 開始前取消・不正相関はRoot観測0。状態・出版・清掃不明では成功を返さない。
 * @invariant 新User・資格・元試行は0。現在状態の出版Operation IDだけを生成する。
 * @boundary AM同期保存とSurfaceの完全要求検査・応答前取消再確認。
 * @security 生鍵を保存・返却せず、相関と内部保存結果を外部へ透過しない。
 * @concurrency Signalは開始前Gate。同期保存開始後は完了し、Consumerが取消後の応答を止める。
 */
export function confirmInitialConnection(
  root: FilesystemStoreRoot,
  token: string,
  input: unknown,
  signal: AbortSignal,
): StateStoreResult<Readonly<{ revision: number; operationId: string }>> {
  const binding = readInitialConnectionBinding(input);
  if (signal.aborted || !binding || !readCredentialId(token))
    return {
      status: "unavailable",
      reason: signal.aborted
        ? "initial_connection_cancelled"
        : "initial_connection_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      const actor = resolveCredentialAuthentication(token, current.state);
      const action =
        actor &&
        selectInitialConnectionConfirmation(current.state, actor, binding);
      if (!action)
        return {
          status: "unavailable",
          reason: "initial_connection_rejected",
          publication,
          revision,
          cleanupConfirmed,
        };
      const pending = settlePending(root, current, () => {
        publication = "confirmed";
      });
      cleanupConfirmed = true;
      if (action === "observed")
        return {
          status: "completed",
          value: { revision, operationId: current.state.operationId },
          publication: "confirmed",
          revision,
          cleanupConfirmed,
        };
      if (pending !== "none")
        return {
          status: "unavailable",
          reason: "state_store_previous_pending_settled",
          publication,
          revision,
          cleanupConfirmed,
        };
      const initial = current.state.initialization;
      if (initial.stage !== "credential_stored")
        throw new Error("initial_stage_mismatch");
      const operationId = crypto.randomUUID();
      if (
        !ATTEMPT_UUID.test(operationId) ||
        operationId === current.state.operationId ||
        operationId === initial.attemptId
      )
        throw new Error("uuid_collision");
      const next = structuredClone(current.state);
      next.revision += 1;
      next.operationId = operationId;
      next.initialization = {
        stage: "completed",
        attemptId: initial.attemptId,
        initialUserId: initial.userId,
        initialCredentialId: initial.initialCredentialId,
        confirmationCredentialId: initial.confirmationCredentialId,
        connection: "confirmed",
      };
      const parsed = parseAccessManagementState(serialize(next));
      if (parsed.status !== "parsed")
        throw new Error("initial_candidate_invalid");
      return publishState(root, current, parsed.state, "initialization");
    } catch {
      return {
        status: "unavailable",
        reason: "initial_connection_state_unavailable",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}
