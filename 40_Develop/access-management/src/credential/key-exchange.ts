/**
 * 鍵交換の開始・再入場と段階候補を判断する。
 * @responsibility 四経路を同じ相関へ結び、実保存・鍵生成・提示を引き取らない。
 * @trace ARCH-000013
 */
import { types } from "node:util";
import type {
  AccessManagementState,
  KeyExchangeRecord,
} from "../state/parse.ts";
import { resolveCredentialAuthentication } from "./authentication.ts";
import type { CredentialMaterial } from "./token-material.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CREDENTIAL_ID = /^[0-9a-f]{24}$/;
const KEY_EXCHANGE_REVISION_RESERVE = 6;
const INITIAL_CONNECTION_COMPLETION_REVISION_RESERVE = 1;

/**
 * exact交換参照の形式だけを検査する。
 * @responsibility 参照を現在Authorityや保存済み存在へ昇格しない。
 * @trace ARCH-000013
 * @input 信頼しない参照値。
 * @returns 現Schemaの交換参照の場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 入力を変更・暗黙変換しない。
 * @effect N/A: primitiveの形式検査だけ。
 * @failure 不正値はfalse。
 * @invariant ID形式からrecord存在・完了・認可を推定しない。
 * @boundary 入力と非秘密観測。
 * @security Getterや文字列化を実行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function isKeyExchangeRecoveryId(value: unknown): value is string {
  const prefix = "access-management.key-exchange.";
  return (
    typeof value === "string" &&
    value.startsWith(prefix) &&
    UUID.test(value.slice(prefix.length))
  );
}

/**
 * 保存済み交換の非秘密な現在段階を表す。
 * @responsibility 段階・起点相関・提示状態をSecretや成功Receiptから分離する。
 * @trace ARCH-000013
 * @shape 改訂・元Recovery・操作・起点入口・範囲・発行先・旧ID集合・段階。storedだけ新資格IDと提示状態。
 * @invariant 未解決recordの現在観測だけで、提示／終了の完了を推定しない。
 * @boundary 現在管理者または信頼Hostへの読取り投影。
 * @security token・salt・Verifier・Root・対象外User／資格を含めない。
 * @compatibility 現Schema v2、非秘密観測専用。
 */
export type KeyExchangeSnapshot = Readonly<
  {
    revision: number;
    recoveryId: string;
    operationId: string;
    entry: "workbench" | "host";
    scope: "targeted" | "all";
    recipientUserId: string;
    oldCredentialIds: readonly string[];
  } & (
    | { stage: "prepared" | "revoked" }
    | {
        stage: "credential_stored";
        newCredentialId: string;
        presentation: "not_attempted" | "unconfirmed" | "confirmed";
      }
  )
>;

/**
 * 現在Authorityからexact交換の事実だけを投影する。
 * @responsibility 読取りを継続・確認・終了処置へ転用しない。
 * @trace ARCH-000013
 * @input 完全current、現在入口と鍵、exact Recovery。
 * @returns 所有済み凍結投影、または非開示のnull。
 * @precondition 保存Ownerが同Lockで完全Schemaを検査済み。Hostは信頼内部入口。
 * @postcondition 入力を変更せず、起点entryを保持する。
 * @effect Workbench現在資格の照合とメモリ投影だけ。
 * @failure 非管理者・初回Workbench・別参照・record不存在・不正入口はnull。
 * @invariant 不存在はclosed／未実施／完了の証明ではない。改訂余裕や明示確認を観測条件にしない。
 * @boundary 現在認可と交換状態読取り。
 * @security 参照だけのAuthority復元・Secret復元0。
 * @concurrency 同じSnapshot一回だけ。次要求はfresh再認可。
 */
export function projectKeyExchangeState(
  current: AccessManagementState,
  entry: "workbench" | "host",
  token: string | null,
  recoveryId: string,
): KeyExchangeSnapshot | null {
  if (
    !isKeyExchangeRecoveryId(recoveryId) ||
    (entry !== "host" && entry !== "workbench") ||
    (entry === "host" ? token !== null : typeof token !== "string")
  )
    return null;
  if (
    entry === "workbench" &&
    (current.initialization.stage !== "completed" ||
      typeof token !== "string" ||
      resolveCredentialAuthentication(token, current)?.role !== "administrator")
  )
    return null;
  const exchange = current.unresolvedKeyExchanges.find(
    (item) => item.recoveryId === recoveryId,
  );
  if (!exchange) return null;
  const initial = current.initialization;
  if (
    initial.stage !== "completed" &&
    (entry !== "host" ||
      initial.stage !== "credential_stored" ||
      exchange.entry !== "host" ||
      exchange.scope !== "targeted" ||
      exchange.recipientUserId !== initial.userId)
  )
    return null;
  const base = {
    revision: current.revision,
    recoveryId: exchange.recoveryId,
    operationId: exchange.operationId,
    entry: exchange.entry,
    scope: exchange.scope,
    recipientUserId: exchange.recipientUserId,
    oldCredentialIds: Object.freeze([...exchange.oldCredentialIds]),
  };
  if (exchange.stage !== "credential_stored")
    return Object.freeze({ ...base, stage: exchange.stage });
  const credential = current.credentials.find(
    (item) =>
      item.credentialId === exchange.newCredentialId &&
      item.userId === exchange.recipientUserId &&
      item.operationId === exchange.operationId &&
      !item.revoked,
  );
  if (!credential) return null;
  return Object.freeze({
    ...base,
    stage: exchange.stage,
    newCredentialId: exchange.newCredentialId,
    presentation: credential.presentation,
  });
}

/**
 * 現在条件と事前表示した集合から交換準備候補を作る。
 * @responsibility 現在Authority・発行先・確認と固定旧集合を同じ改訂へ結ぶ。
 * @trace ARCH-000013
 * @input 完全状態、入口、鍵、期待改訂、交換UUID、範囲、発行先、表示済み旧ID集合、確認、任意の未確認交換参照。
 * @returns 所有済みprepared候補、または非開示拒否のnull。
 * @precondition 同Lock内の保存Ownerが完全Schemaを検査済み。Hostは信頼内部入口。Consumerは対象名・範囲・保持情報を事前表示済み。
 * @postcondition 入力と資格・User・Role・初回を保持し、明示引継ぎだけ旧storedを新preparedへ一候補で置換する。
 * @effect Workbenchの現在Verifier照合とメモリ候補だけ。UUID・資格生成・保存・失効なし。
 * @failure 不正入力・改訂差・未認可・対象差・確認不足・未指定の既存交換はnull。
 * @invariant 旧集合0件も許可。preparedは失効成功でも生成許可でもない。
 * @boundary 資格の意味判断と既存保存Owner。MCP公開APIではない。
 * @security 表示集合やRecovery参照をAuthorityにしない。Hostへ追加認証を要求しない。
 * @concurrency 同じLock内の一要求だけ。各保存段階と再入場は別に照合する。
 */
export function prepareKeyExchange(
  current: AccessManagementState,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): AccessManagementState | null {
  if (
    (entry !== "workbench" && entry !== "host") ||
    (scope !== "targeted" && scope !== "all") ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    expectedRevision >
      Number.MAX_SAFE_INTEGER -
        KEY_EXCHANGE_REVISION_RESERVE -
        (current.initialization.stage === "credential_stored"
          ? INITIAL_CONNECTION_COMPLETION_REVISION_RESERVE
          : 0) ||
    typeof operationId !== "string" ||
    !UUID.test(operationId) ||
    typeof recipientUserId !== "string" ||
    !UUID.test(recipientUserId) ||
    typeof confirmed !== "boolean" ||
    ((entry === "host" || scope === "all") && !confirmed) ||
    (entry === "host" ? token !== null : typeof token !== "string") ||
    types.isProxy(displayedOldCredentialIds) ||
    !Array.isArray(displayedOldCredentialIds)
  )
    return null;
  const displayed = readDisplayedCredentialIds(displayedOldCredentialIds);
  if (!displayed) return null;
  const previous = current.unresolvedKeyExchanges[0];
  if (previousRecoveryId !== undefined) {
    if (
      !isKeyExchangeRecoveryId(previousRecoveryId) ||
      current.unresolvedKeyExchanges.length !== 1 ||
      previous?.stage !== "credential_stored" ||
      previous.recoveryId !== previousRecoveryId ||
      previous.operationId === operationId ||
      (scope === "targeted" && previous.recipientUserId !== recipientUserId)
    )
      return null;
    const credential = current.credentials.find(
      (item) =>
        item.credentialId === previous.newCredentialId &&
        item.userId === previous.recipientUserId &&
        item.operationId === previous.operationId &&
        !item.revoked,
    );
    if (
      !credential ||
      credential.presentation === "confirmed" ||
      !displayed.includes(previous.newCredentialId)
    )
      return null;
  }
  if (
    current.revision !== expectedRevision ||
    (previousRecoveryId === undefined &&
      current.unresolvedKeyExchanges.length !== 0) ||
    current.operationId === operationId ||
    current.initialization.attemptId === operationId ||
    current.credentials.some((item) => item.operationId === operationId)
  )
    return null;
  const recipient = current.users.find(
    (item) => item.userId === recipientUserId,
  );
  if (!recipient || (scope === "all" && recipient.role !== "administrator"))
    return null;
  const initial = current.initialization;
  if (
    initial.stage !== "completed" &&
    (initial.stage !== "credential_stored" ||
      entry !== "host" ||
      scope !== "targeted" ||
      initial.userId !== recipientUserId)
  )
    return null;
  if (
    entry === "workbench" &&
    (typeof token !== "string" ||
      resolveCredentialAuthentication(token, current)?.role !== "administrator")
  )
    return null;
  const oldCredentialIds = current.credentials
    .filter(
      (item) =>
        !item.revoked && (scope === "all" || item.userId === recipientUserId),
    )
    .map((item) => item.credentialId);
  if (
    displayed.length !== oldCredentialIds.length ||
    oldCredentialIds.some((id) => !displayed.includes(id))
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  if (previousRecoveryId !== undefined) next.unresolvedKeyExchanges = [];
  next.unresolvedKeyExchanges.push({
    stage: "prepared",
    recoveryId: `access-management.key-exchange.${operationId}`,
    operationId,
    entry,
    scope,
    recipientUserId,
    oldCredentialIds,
  });
  return next;
}

/**
 * 表示済み資格ID集合を実行可能Propertyなしで所有する。
 * @responsibility 開始と再入場で同じ入力検査を使う。
 * @trace ARCH-000013
 * @input 信頼しないID配列。
 * @returns 一意IDの所有配列、またはnull。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 入力を変更・実行しない。
 * @effect N/A: descriptorと値の検査だけ。
 * @failure Proxy・accessor・疎配列・追加field・不正IDはnull。
 * @invariant 表示・認証・確認そのものを証明しない。
 * @boundary 内部入力形式と交換意味判定。
 * @security ID集合から操作Authorityを生成しない。
 * @concurrency N/A: 共有状態なし。
 */
export function readDisplayedCredentialIds(input: unknown): string[] | null {
  if (types.isProxy(input) || !Array.isArray(input)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const length: unknown = Object.getOwnPropertyDescriptor(
    input,
    "length",
  )?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(descriptors).length !== length + 1
  )
    return null;
  const displayed: string[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    const id: unknown = descriptor?.value;
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      typeof id !== "string" ||
      !CREDENTIAL_ID.test(id) ||
      displayed.includes(id)
    )
      return null;
    displayed.push(id);
  }
  return displayed;
}

/**
 * 保存済み交換を現在Authorityと同じ表示集合から選ぶ。
 * @responsibility 起点entry・旧集合を再生成せずexact再入場へ閉じる。
 * @trace ARCH-000013
 * @input 完全current、現在入口・鍵、期待改訂、交換UUID、範囲・発行先・表示集合・確認。
 * @returns 所有済み交換record、またはnull。
 * @precondition 保存Ownerが同Lockで完全Schemaを検査済み。Hostは信頼入口。
 * @postcondition 状態と起点相関を変更しない。
 * @effect Workbenchの現在Verifier照合とメモリ所有だけ。
 * @failure 別相関・非管理者・初回別経路・改訂余裕不足・未確認はnull。
 * @invariant admissionを過去要求から復元しない。WorkbenchはWorkbench起点だけ。
 * @boundary 再入場の現在認可と保存段階。
 * @security Recovery参照・失効した元鍵をAuthorityにしない。
 * @concurrency 各要求でfreshに評価する。
 */
export function selectKeyExchangeContinuation(
  current: AccessManagementState,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeRecord | null {
  const displayed = readDisplayedCredentialIds(displayedOldCredentialIds);
  const exchange = current.unresolvedKeyExchanges[0];
  if (
    !displayed ||
    current.unresolvedKeyExchanges.length !== 1 ||
    !exchange ||
    (entry !== "host" && entry !== "workbench") ||
    (entry === "host" ? token !== null : typeof token !== "string") ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== current.revision ||
    exchange.operationId !== operationId ||
    exchange.recoveryId !== `access-management.key-exchange.${operationId}` ||
    exchange.scope !== scope ||
    exchange.recipientUserId !== recipientUserId ||
    typeof confirmed !== "boolean" ||
    ((entry === "host" || scope === "all") && !confirmed) ||
    (entry === "workbench" && exchange.entry !== "workbench") ||
    displayed.length !== exchange.oldCredentialIds.length ||
    exchange.oldCredentialIds.some((id) => !displayed.includes(id))
  )
    return null;
  if (
    previousRecoveryId !== undefined &&
    (!isKeyExchangeRecoveryId(previousRecoveryId) ||
      previousRecoveryId === exchange.recoveryId ||
      current.credentials.filter(
        (credential) =>
          exchange.oldCredentialIds.includes(credential.credentialId) &&
          `access-management.key-exchange.${credential.operationId}` ===
            previousRecoveryId &&
          credential.presentation !== "confirmed" &&
          credential.revoked === (exchange.stage !== "prepared"),
      ).length !== 1)
  )
    return null;
  const initial = current.initialization;
  if (
    initial.stage !== "completed" &&
    (initial.stage !== "credential_stored" ||
      entry !== "host" ||
      scope !== "targeted" ||
      recipientUserId !== initial.userId)
  )
    return null;
  const confirmedPublications =
    exchange.stage === "prepared" ? 1 : exchange.stage === "revoked" ? 2 : 3;
  const reserve =
    KEY_EXCHANGE_REVISION_RESERVE -
    confirmedPublications +
    (initial.stage === "credential_stored"
      ? INITIAL_CONNECTION_COMPLETION_REVISION_RESERVE
      : 0);
  if (current.revision > Number.MAX_SAFE_INTEGER - reserve) return null;
  if (
    entry === "workbench" &&
    (typeof token !== "string" ||
      resolveCredentialAuthentication(token, current)?.role !== "administrator")
  )
    return null;
  return structuredClone(exchange);
}

/**
 * preparedの固定旧集合だけを失効候補へ移す。
 * @responsibility 相関確定前の失効をせず、対象外資格を保持する。
 * @trace ARCH-000013
 * @input 完全currentとexact Recovery。
 * @returns revoked候補またはnull。
 * @precondition 同Lock要求の現在admissionとprepared出版を保存Ownerが確認済み。
 * @postcondition 入力を変更せず旧集合だけをrevokedへ移す。
 * @effect N/A: メモリ候補だけ。実失効は別出版。
 * @failure 段階・相関・改訂不一致はnull。
 * @invariant 起点entry・範囲・発行先・旧集合と初回を保持する。
 * @boundary 純粋段階候補と物理保存。
 * @security 同一要求の失効後に旧Bearerで再認可しない。
 * @concurrency 同じLock内の要求だけ。
 */
export function prepareKeyExchangeRevocation(
  current: AccessManagementState,
  recoveryId: string,
): AccessManagementState | null {
  const exchange = current.unresolvedKeyExchanges[0];
  if (
    current.unresolvedKeyExchanges.length !== 1 ||
    exchange?.stage !== "prepared" ||
    exchange.recoveryId !== recoveryId ||
    current.revision >= Number.MAX_SAFE_INTEGER
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = exchange.operationId;
  for (const item of next.credentials)
    if (exchange.oldCredentialIds.includes(item.credentialId))
      item.revoked = true;
  next.unresolvedKeyExchanges = [{ ...exchange, stage: "revoked" }];
  return next;
}

/**
 * revokedへ固定長資格材料を結合した保存候補を作る。
 * @responsibility 発行先と初回確認対象を同じ改訂へ結ぶ。
 * @trace ARCH-000013
 * @input 完全current、exact Recovery、保存用資格材料。
 * @returns credential_stored候補またはnull。
 * @precondition 同Lockのadmissionとrevoked確定済み。実材料は生成Owner、予約材料は容量検査だけに使用。
 * @postcondition 元初資格・履歴・対象外情報を保持する。
 * @effect N/A: メモリだけ。生成・保存・提示なし。
 * @failure 段階・相関・改訂差はnull。完全Parserは保存Ownerが実材料で別に確認する。
 * @invariant materialに生鍵を要求しない。予約候補を出版しない。
 * @boundary 失効後の候補と保存・容量Owner。
 * @security 初回completed後の歴史確認IDを結替えない。
 * @concurrency 同じLock区間だけ。
 */
export function prepareExchangedCredential(
  current: AccessManagementState,
  recoveryId: string,
  material: Pick<
    CredentialMaterial,
    "credentialId" | "tokenSalt" | "tokenVerifier"
  >,
): AccessManagementState | null {
  const exchange = current.unresolvedKeyExchanges[0];
  if (
    current.unresolvedKeyExchanges.length !== 1 ||
    exchange?.stage !== "revoked" ||
    exchange.recoveryId !== recoveryId ||
    current.revision >= Number.MAX_SAFE_INTEGER
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = exchange.operationId;
  next.credentials.push({
    credentialId: material.credentialId,
    userId: exchange.recipientUserId,
    tokenVersion: 1,
    tokenSalt: material.tokenSalt,
    tokenVerifier: material.tokenVerifier,
    revoked: false,
    operationId: exchange.operationId,
    presentation: "not_attempted",
  });
  next.unresolvedKeyExchanges = [
    {
      ...exchange,
      stage: "credential_stored",
      newCredentialId: material.credentialId,
    },
  ];
  if (next.initialization.stage === "credential_stored")
    next.initialization.confirmationCredentialId = material.credentialId;
  return next;
}

/**
 * 提示確認済みのexact交換記録だけを終了候補にする。
 * @responsibility 資格や提示を変更せず、現在認可と確定事実から記録を閉じる。
 * @trace ARCH-000013
 * @input 完全current、入口・現在鍵、期待改訂、終了操作UUID、交換参照。
 * @returns 一改訂の終了候補またはnull。
 * @precondition 保存Ownerの同Lock完全状態。Hostは信頼内部入口。
 * @postcondition 資格・User・Role・初回・登録・公開を保持する。
 * @effect N/A: メモリ候補だけ。実保存は既存Owner。
 * @failure 不明・未確認・非認可・別相関・改訂余裕不足はnull。
 * @invariant 未提示／未確認は単独で除去せず、record不在を終了成功へ変換しない。
 * @boundary 現在資格とexact交換終了。
 * @security 秘密値を受け取らず生成・復元しない。
 * @concurrency 同Lockのfresh状態だけを使用する。
 */
export function prepareKeyExchangeCompletion(
  current: AccessManagementState,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): AccessManagementState | null {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== current.revision ||
    expectedRevision >
      Number.MAX_SAFE_INTEGER -
        (current.initialization.stage === "credential_stored" ? 2 : 1) ||
    typeof operationId !== "string" ||
    !UUID.test(operationId) ||
    current.operationId === operationId ||
    current.initialization.attemptId === operationId ||
    current.credentials.some(
      (credential) => credential.operationId === operationId,
    ) ||
    current.unresolvedKeyExchanges.length !== 1
  )
    return null;
  const snapshot = projectKeyExchangeState(current, entry, token, recoveryId);
  const exchange = current.unresolvedKeyExchanges[0];
  if (
    !exchange ||
    snapshot?.stage !== "credential_stored" ||
    snapshot.presentation !== "confirmed" ||
    exchange.operationId === operationId ||
    exchange.oldCredentialIds.some(
      (id) =>
        !current.credentials.some(
          (credential) => credential.credentialId === id && credential.revoked,
        ),
    )
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  next.unresolvedKeyExchanges = [];
  return next;
}
