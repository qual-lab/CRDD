/**
 * 資格提示の閉じた入力と単調更新を判定する。
 * @responsibility 非秘密相関から提示対象だけを選び、認証・出力観測・保存を引き取らない。
 * @trace ARCH-000013
 */
import { types } from "node:util";
import type { AccessManagementState } from "../state/parse.ts";

/**
 * 信頼済み提示Ownerが渡す非秘密の更新相関。
 * @responsibility 提示前の保存と出力観測後の保存を別入力へ閉じる。
 * @trace ARCH-000013
 * @shape 資格ID・元発行ID・期待改訂・target。confirmedだけ提示Operation IDを持つ。
 * @invariant 生Secret・観測callback・Root・任意fieldを含まない。
 * @boundary 内部提示Ownerと同Lock保存Owner。
 * @security 相関値はAuthorityや出力成立の証明ではない。
 * @compatibility v2資格presentationの単調遷移だけを扱う。
 */
export type CredentialPresentationUpdate = Readonly<{
  credentialId: string;
  issuanceOperationId: string;
  expectedRevision: number;
}> &
  (
    | Readonly<{ target: "unconfirmed" }>
    | Readonly<{ target: "confirmed"; presentationOperationId: string }>
  );

/**
 * 提示入力をgetterやProxyを実行せず検査する。
 * @responsibility 余分・欠損・未知targetを保存Effect前に拒否する。
 * @trace ARCH-000013
 * @input 信頼しない更新値。
 * @returns 所有済み閉入力、またはnull。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 入力を変更せず、accessorを呼ばない。
 * @effect N/A: descriptorとprimitiveの検査のみ。
 * @failure 不正形状はnull。
 * @invariant 不正値を既定targetへ補完しない。
 * @boundary 内部提示入力の形式検査。
 * @security Secretや自由な文字列を返却契約へ混入させない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function readCredentialPresentationUpdate(
  value: unknown,
): CredentialPresentationUpdate | null {
  if (value === null || typeof value !== "object" || types.isProxy(value))
    return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((item) => !Object.hasOwn(item, "value")))
    return null;
  const target: unknown = descriptors.target?.value;
  const keys = [
    "credentialId",
    "issuanceOperationId",
    "expectedRevision",
    "target",
  ];
  if (target === "confirmed") keys.push("presentationOperationId");
  else if (target !== "unconfirmed") return null;
  const actualKeys = Reflect.ownKeys(descriptors);
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => !keys.includes(key as string))
  )
    return null;
  const credentialId: unknown = descriptors.credentialId?.value;
  const issuanceOperationId: unknown = descriptors.issuanceOperationId?.value;
  const expectedRevision: unknown = descriptors.expectedRevision?.value;
  const presentationOperationId: unknown =
    descriptors.presentationOperationId?.value;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (
    typeof credentialId !== "string" ||
    !/^[0-9a-f]{24}$/.test(credentialId) ||
    typeof issuanceOperationId !== "string" ||
    !uuid.test(issuanceOperationId) ||
    typeof expectedRevision !== "number" ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    expectedRevision === Number.MAX_SAFE_INTEGER
  )
    return null;
  if (target === "confirmed") {
    if (
      typeof presentationOperationId !== "string" ||
      !uuid.test(presentationOperationId)
    )
      return null;
    return Object.freeze({
      credentialId,
      issuanceOperationId,
      expectedRevision,
      target,
      presentationOperationId,
    });
  }
  return Object.freeze({
    credentialId,
    issuanceOperationId,
    expectedRevision,
    target,
  });
}

/**
 * 現在Snapshotから単調更新できる資格indexを選ぶ。
 * @responsibility 失効・交換・古い改訂・別提示相関を拒否する。
 * @trace ARCH-000013
 * @input 同Lockの完全Snapshotと形式検査済み更新。
 * @returns 対象index、または拒否のnull。
 * @precondition Snapshotはv2 Parserで検査済み、更新は閉入力。
 * @postcondition Snapshotを変更せず、same-state再入場を拒否する。
 * @effect N/A: 値の比較だけ。
 * @failure 相関不一致・不許可段階はnull。
 * @invariant completedの歴史的確認資格を結替えない。
 * @boundary 提示の意味判断と保存I/O。
 * @security 結果は出力観測や通常Authorityを証明しない。
 * @concurrency 保存Ownerが同じLock内で使用し、Lock外の再利用は禁止。
 */
export function selectCredentialPresentationTarget(
  state: AccessManagementState,
  update: CredentialPresentationUpdate,
): number | null {
  if (
    state.revision !== update.expectedRevision ||
    (update.target === "confirmed" &&
      state.operationId !== update.presentationOperationId)
  )
    return null;
  const index = state.credentials.findIndex(
    (item) => item.credentialId === update.credentialId,
  );
  const credential = state.credentials[index];
  if (
    !credential ||
    credential.revoked ||
    credential.operationId !== update.issuanceOperationId ||
    credential.presentation !==
      (update.target === "unconfirmed" ? "not_attempted" : "unconfirmed")
  )
    return null;
  const initial = state.initialization;
  if (
    initial.stage !== "completed" &&
    (initial.stage !== "credential_stored" ||
      initial.confirmationCredentialId !== credential.credentialId ||
      initial.userId !== credential.userId)
  )
    return null;
  const exchanges = state.unresolvedKeyExchanges;
  if (exchanges.length !== 0) {
    const exchange = exchanges[0];
    if (
      exchanges.length !== 1 ||
      exchange?.stage !== "credential_stored" ||
      exchange.newCredentialId !== credential.credentialId ||
      exchange.recipientUserId !== credential.userId ||
      (initial.stage === "credential_stored" && exchange.entry !== "host")
    )
      return null;
  }
  return index;
}
