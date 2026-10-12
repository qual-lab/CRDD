/**
 * 初回限定接続の非秘密相関と通常接続の用途を判定する。
 * @responsibility 初回候補を通常本人のAuthorityへ昇格せず、同改訂の相関へ閉じる。
 * @trace ARCH-000013
 */
import { types } from "node:util";
import type { AccessManagementState } from "../state/parse.ts";
import type { AuthenticatedRequest } from "./authentication.ts";

/**
 * 完全な限定要求の検査前後を結ぶ非秘密の初回相関。
 * @responsibility 元試行・本人・最新確認資格・判定時改訂を一つの値へ閉じる。
 * @trace ARCH-000013
 * @shape attemptId・userId・credentialId・expectedRevision。
 * @invariant 相関だけで通常Authorityや確認済み接続を表さない。
 * @boundary 内部要求判定Ownerから完全要求検査Ownerを経由した保存入力。
 * @security Secret・Role・内容・Rootを含めず、外部応答へ公開しない。
 * @compatibility v2初回記録専用。後続通常管理の改訂へ流用しない。
 */
export type InitialConnectionBinding = Readonly<{
  attemptId: string;
  userId: string;
  credentialId: string;
  expectedRevision: number;
}>;

/**
 * 要求内の通常本人と限定初回候補を区別する。
 * @responsibility 初回候補にはRole・内容権限を搬送しない。
 * @trace ARCH-000013
 * @shape normalは本人投影、initialは非Authority相関、unavailableは固定理由。
 * @invariant initialは初回接続成功でも通常認証成功でもない。
 * @boundary 保存OwnerからSurfaceの要求用途判定。
 * @security 拒否時に資格・User・状態の存在を開示しない。
 * @compatibility 公開Protocolではない。Consumerで固定応答へ変換する。
 */
export type ConnectionAuthenticationResult =
  | Readonly<{ status: "normal"; snapshot: AuthenticatedRequest }>
  | Readonly<{ status: "initial"; binding: InitialConnectionBinding }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "connection_authentication_rejected"
        | "connection_state_unavailable";
    }>;

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
