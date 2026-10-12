/**
 * 鍵交換の開始条件と固定対象集合を判断する。
 * @responsibility 四経路を同じ準備相関へ結び、保存・失効・生成・提示を引き取らない。
 * @trace ARCH-000013
 */
import { types } from "node:util";
import type { AccessManagementState } from "../state/parse.ts";
import { resolveCredentialAuthentication } from "./authentication.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CREDENTIAL_ID = /^[0-9a-f]{24}$/;
const KEY_EXCHANGE_REVISION_RESERVE = 6;
const INITIAL_CONNECTION_COMPLETION_REVISION_RESERVE = 1;

/**
 * 現在条件と事前表示した集合から交換準備候補を作る。
 * @responsibility 現在Authority・発行先・確認と固定旧集合を同じ改訂へ結ぶ。
 * @trace ARCH-000013
 * @input 完全状態、入口、Workbench鍵またはHostのnull、期待改訂、交換UUID、範囲、発行先、表示済み旧ID集合、明示確認。
 * @returns 所有済みprepared候補、または非開示拒否のnull。
 * @precondition 同Lock内の保存Ownerが完全Schemaを検査済み。Hostは信頼内部入口。Consumerは対象名・範囲・保持情報を事前表示済み。
 * @postcondition 入力を変更せず、旧資格・User・Role・登録・公開・初回を保持する。
 * @effect Workbenchの現在Verifier照合とメモリ候補だけ。UUID・資格生成・保存・失効なし。
 * @failure 不正入力・改訂差・未認可・対象差・未確認・既存交換はnull。
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
  const descriptors = Object.getOwnPropertyDescriptors(
    displayedOldCredentialIds,
  );
  const length: unknown = Object.getOwnPropertyDescriptor(
    displayedOldCredentialIds,
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
  if (
    current.revision !== expectedRevision ||
    current.unresolvedKeyExchanges.length !== 0 ||
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
