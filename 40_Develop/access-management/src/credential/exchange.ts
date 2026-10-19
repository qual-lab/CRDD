/**
 * 同じ交換参照による準備・失効・発行・提示・終了を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { types } from "node:util";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  CURRENT_LIMIT,
  PENDING_LIMIT,
  preparePublicationBytes,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import { locked } from "../storage/lock.ts";
import type {
  AccessManagementState,
  KeyExchangeRecord,
} from "../storage/types.ts";
import { resolveCredentialAuthentication } from "./authentication.ts";
import {
  presentKeyToTerminal,
  updateCredentialPresentationState,
} from "./presentation.ts";
import { createCredentialMaterial, readCredentialId } from "./token.ts";
import type {
  CredentialMaterial,
  KeyExchangeCompletionResult,
  KeyExchangeObservation,
  KeyExchangeResult,
} from "./types.ts";

/**
 * 対象表示と人間確認を終えたHost交換入力を表す。
 * @responsibility 交換と終了の操作Identityを分け、現在改訂へ結ぶ。
 * @trace ARCH-000013
 * @shape 期待改訂・交換／終了UUID・範囲・既存発行先・表示旧集合・確認、任意の前交換参照。
 * @invariant 入力は確認そのものやRoot Authorityの証明ではない。
 * @boundary 信頼HostのCLI選択Ownerから内部composition。
 * @security 生鍵やcallbackを保持しない。Remote入力を直接渡さない。
 * @compatibility 最新交換契約だけ。再入場でも同じ操作入力を保持する。
 */
export type HostKeyExchangeInput = Readonly<{
  expectedRevision: number;
  exchangeOperationId: string;
  completionOperationId: string;
  scope: "targeted" | "all";
  recipientUserId: string;
  displayedOldCredentialIds: readonly string[];
  confirmed: boolean;
  previousRecoveryId?: string;
}>;

/**
 * Host交換の非秘密結果と未完了段階を表す。
 * @responsibility 保存・提示・終了を区別し、取消からEffect0を推定させない。
 * @trace ARCH-000013
 * @shape 完了は相関と改訂、再交換必要は元参照、開始前取消は固定値、不明は段階・出版・清掃・主副失敗。
 * @invariant completedは一度提示とrecord整理まで。初回接続完了や本人受領ではない。
 * @boundary 信頼Host内部Consumer。MCPへ公開しない。
 * @security 生鍵・Root・Verifier・内部Lock参照を返さない。
 * @compatibility 既存exchange／presentation／finishの結果を限定投影する。
 */
export type HostKeyExchangeResult =
  | Readonly<{
      status: "completed";
      reason: "host_key_exchange_presented";
      recoveryId: string;
      revision: number;
    }>
  | Readonly<{
      status: "key_exchange_required";
      reason: "host_key_not_replayable";
      recoveryId: string;
    }>
  | Readonly<{
      status: "cancelled";
      reason: "host_key_exchange_cancelled";
      recoveryId: null;
    }>
  | Readonly<{
      status: "blocked";
      reason: "host_key_exchange_incomplete";
      recoveryId: string | null;
      lastConfirmedOperationId: string | null;
      lastConfirmedStage:
        | "not_started"
        | "prepared"
        | "revoked"
        | "credential_stored";
      stage: "before_exchange" | "exchange" | "presentation" | "completion";
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
      firstFailure:
        | "input"
        | "terminal"
        | "cancelled"
        | "observation"
        | "presentation"
        | Extract<
            KeyExchangeResult,
            { reason: "key_exchange_unavailable" }
          >["firstFailure"]
        | Extract<
            KeyExchangeCompletionResult,
            { reason: "key_exchange_completion_unavailable" }
          >["firstFailure"];
      secondaryFailure: "release" | null;
    }>;

/**
 * 明示Host交換を保存から一度提示・終了まで実行する。
 * @responsibility 確定した最新改訂だけを渡し、saved token nullを再表示しない。
 * @trace ARCH-000013
 * @input 用途限定Root、Host選択Ownerの所有済み入力、TTY、取消Signal。
 * @returns 非秘密の完了または必要な次行動。
 * @precondition ログイン済みHost内部Owner。対象・旧集合・影響の表示と確認済み。
 * @postcondition 新資格だけ一度提示し、confirmedだけrecord整理する。
 * @effect 既存交換・提示保存・Node TTY一write・終了保存。
 * @failure 保存後取消／故障は確定Effectを保持して停止、再送・自動別交換なし。
 * @invariant 交換UUIDと終了UUIDは別。各段階の直前確定revisionを次段階へ渡す。
 * @boundary 信頼Host→保存Owner→TTY。CLIの対象選択は呼出側。
 * @security 生鍵は短命参照とTTY Bufferだけ。結果・履歴・例外へ複製しない。
 * @concurrency 同期保存前ごとに取消を検査し、開始済みTTY callbackをjoinする。
 */
export async function exchangeFromHost(
  root: FilesystemStoreRoot,
  input: HostKeyExchangeInput,
  terminal: NodeJS.WriteStream,
  signal: AbortSignal,
): Promise<HostKeyExchangeResult> {
  let token: string | null = null;
  let recoveryId: string | null = null;
  let lastConfirmedOperationId: string | null = null;
  let lastConfirmedStage:
    | "not_started"
    | "prepared"
    | "revoked"
    | "credential_stored" = "not_started";
  let secondaryFailure: "release" | null = null;
  let stage: "before_exchange" | "exchange" | "presentation" | "completion" =
    "before_exchange";
  let publication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  let cleanupConfirmed = true;
  let firstFailure: Extract<
    HostKeyExchangeResult,
    { status: "blocked" }
  >["firstFailure"] = "input";
  try {
    if (signal.aborted)
      return {
        status: "cancelled",
        reason: "host_key_exchange_cancelled",
        recoveryId: null,
      };
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (
      typeof input.completionOperationId !== "string" ||
      !uuid.test(input.completionOperationId) ||
      input.completionOperationId === input.exchangeOperationId
    )
      throw new Error("input");
    firstFailure = "terminal";
    if (terminal.isTTY !== true || !terminal.writable || terminal.destroyed)
      throw new Error("terminal");
    stage = "exchange";
    firstFailure = "prepare";
    let credentialId: string;
    let revision: number;
    {
      const result = exchangeCredentialsFromHost(
        root,
        input.expectedRevision,
        input.exchangeOperationId,
        input.scope,
        input.recipientUserId,
        input.displayedOldCredentialIds,
        input.confirmed,
        input.previousRecoveryId,
      );
      if (result.status !== "completed") {
        if (result.reason === "key_exchange_unavailable") {
          recoveryId = result.recoveryId;
          lastConfirmedOperationId = result.lastConfirmedOperationId;
          lastConfirmedStage = result.lastConfirmedStage;
          publication = result.publication;
          cleanupConfirmed = result.cleanupConfirmed;
          return {
            status: "blocked",
            reason: "host_key_exchange_incomplete",
            recoveryId,
            lastConfirmedOperationId,
            lastConfirmedStage,
            stage,
            publication,
            cleanupConfirmed,
            firstFailure: result.firstFailure,
            secondaryFailure: result.secondaryFailure,
          };
        }
        firstFailure = "input";
        throw new Error("rejected");
      }
      recoveryId = result.recoveryId;
      lastConfirmedOperationId = result.operationId;
      lastConfirmedStage = "credential_stored";
      credentialId = result.credentialId;
      revision = result.revision;
      token = result.token;
      publication = "confirmed";
    }
    firstFailure = "cancelled";
    if (signal.aborted) throw new Error("cancelled_after_storage");
    stage = "presentation";
    if (token === null) {
      firstFailure = "observation";
      cleanupConfirmed = false;
      const current = readKeyExchangeStateFromHost(root, recoveryId);
      if (
        current.status !== "observed" ||
        current.snapshot.stage !== "credential_stored"
      )
        throw new Error("observation");
      cleanupConfirmed = true;
      if (signal.aborted) {
        firstFailure = "cancelled";
        throw new Error("cancelled_after_observation");
      }
      if (current.snapshot.presentation !== "confirmed")
        return {
          status: "key_exchange_required",
          reason: "host_key_not_replayable",
          recoveryId,
        };
      revision = current.snapshot.revision;
    } else {
      firstFailure = "prepare";
      const started = updateCredentialPresentationState(root, {
        credentialId,
        issuanceOperationId: input.exchangeOperationId,
        expectedRevision: revision,
        target: "unconfirmed",
      });
      publication = started.publication;
      cleanupConfirmed = started.cleanupConfirmed;
      if (started.status !== "completed") {
        firstFailure = "presentation";
        secondaryFailure = started.secondaryReason ? "release" : null;
        throw new Error("presentation_start");
      }
      firstFailure = "cancelled";
      if (signal.aborted) throw new Error("cancelled_after_start");
      firstFailure = "presentation";
      const pending = presentKeyToTerminal(terminal, token, signal);
      token = null;
      const presented = await pending;
      if (!presented || signal.aborted)
        throw new Error("presentation_unconfirmed");
      firstFailure = "prepare";
      const confirmed = updateCredentialPresentationState(root, {
        credentialId,
        issuanceOperationId: input.exchangeOperationId,
        expectedRevision: started.value.revision,
        target: "confirmed",
        presentationOperationId: started.value.presentationOperationId,
      });
      publication = confirmed.publication;
      cleanupConfirmed = confirmed.cleanupConfirmed;
      if (confirmed.status !== "completed") {
        firstFailure = "presentation";
        secondaryFailure = confirmed.secondaryReason ? "release" : null;
        throw new Error("presentation_confirm");
      }
      revision = confirmed.value.revision;
    }
    firstFailure = "cancelled";
    if (signal.aborted) throw new Error("cancelled_before_finish");
    stage = "completion";
    firstFailure = "prepare";
    const finished = finishKeyExchangeFromHost(
      root,
      revision,
      input.completionOperationId,
      recoveryId,
    );
    if (finished.status === "completed") {
      publication = "confirmed";
      cleanupConfirmed = true;
      if (signal.aborted) {
        firstFailure = "cancelled";
        throw new Error("cancelled_after_completion");
      }
      return {
        status: "completed",
        reason: "host_key_exchange_presented",
        recoveryId,
        revision: finished.revision,
      };
    }
    if (finished.reason === "key_exchange_completion_unavailable")
      return {
        status: "blocked",
        reason: "host_key_exchange_incomplete",
        recoveryId,
        lastConfirmedOperationId,
        lastConfirmedStage,
        stage,
        publication: finished.publication,
        cleanupConfirmed: finished.cleanupConfirmed,
        firstFailure: finished.firstFailure,
        secondaryFailure: finished.secondaryFailure,
      };
    firstFailure = "input";
    throw new Error("finish_rejected");
  } catch {
    return {
      status: "blocked",
      reason: "host_key_exchange_incomplete",
      recoveryId,
      lastConfirmedOperationId,
      lastConfirmedStage,
      stage,
      publication,
      cleanupConfirmed,
      firstFailure,
      secondaryFailure,
    };
  } finally {
    token = null;
  }
}

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

/**
 * 交換の現在認可と三段階出版を同じLockで実行する。
 * @responsibility 失効前の相関確定と失効後の一生成を既存保存へ接続する。
 * @trace ARCH-000013
 * @input Root、入口・鍵、期待改訂、交換UUID、範囲、既存発行先、表示集合、確認。
 * @returns 保存完了結果または非秘密の拒否・未完了。
 * @precondition 同Processの提示Ownerまたはログイン済みHost入口。事前表示はConsumerが完了済み。
 * @postcondition 未解決recordと提示not_attemptedを保持し、新規保存・清掃・解放成功時だけtokenを返す。
 * @effect prepared・revoked・credential_storedを別出版。失効確定後だけ容量予約・一生成。
 * @failure 各境界不成立で先へ進まず、最初の失敗と最後の確認段階を分ける。
 * @invariant 同要求内で失効後の旧鍵再認可0。別要求はfresh認可。stored再生成0。
 * @boundary 現在Authority、Filesystem出版、短命提示用結果。
 * @security 生鍵保存・再表示・新Recovery・内部Path公開なし。
 * @concurrency 既存Lock一つ。同一要求のadmissionを次要求へ保存しない。
 */
function executeKeyExchange(
  root: FilesystemStoreRoot,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeResult {
  const displayed = readDisplayedCredentialIds(displayedOldCredentialIds);
  if (
    !displayed ||
    (previousRecoveryId !== undefined &&
      !isKeyExchangeRecoveryId(previousRecoveryId)) ||
    (entry !== "host" && entry !== "workbench") ||
    (entry === "host"
      ? token !== null
      : typeof token !== "string" || !readCredentialId(token)) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    (scope !== "all" && scope !== "targeted") ||
    typeof recipientUserId !== "string" ||
    !ATTEMPT_UUID.test(recipientUserId) ||
    typeof confirmed !== "boolean" ||
    ((entry === "host" || scope === "all") && !confirmed)
  )
    return { status: "unavailable", reason: "key_exchange_rejected" };
  let admitted = false;
  let issuedToken: string | null = null;
  let recoveryId: string | null = null;
  let lastConfirmedOperationId: string | null = null;
  let lastConfirmedStage:
    | "not_started"
    | "prepared"
    | "revoked"
    | "credential_stored" = "not_started";
  let firstFailure: Extract<
    KeyExchangeResult,
    { reason: "key_exchange_unavailable" }
  >["firstFailure"] = "read";
  const result = locked(root, () => {
    let revision: number | null = null;
    let publication: "not_attempted" | "unconfirmed" | "confirmed" =
      "not_attempted";
    let cleanupConfirmed = false;
    try {
      let current = readCurrent(root);
      revision = current.state.revision;
      const continuation = selectKeyExchangeContinuation(
        current.state,
        entry,
        token,
        expectedRevision,
        operationId,
        scope,
        recipientUserId,
        displayed,
        confirmed,
        previousRecoveryId,
      );
      const prepared = continuation
        ? null
        : prepareKeyExchange(
            current.state,
            entry,
            token,
            expectedRevision,
            operationId,
            scope,
            recipientUserId,
            displayed,
            confirmed,
            previousRecoveryId,
          );
      if (!continuation && !prepared)
        return {
          status: "unavailable" as const,
          reason: "key_exchange_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      if (continuation) {
        recoveryId = continuation.recoveryId;
        lastConfirmedOperationId = continuation.operationId;
        lastConfirmedStage = continuation.stage;
      } else if (previousRecoveryId !== undefined) {
        const previous = current.state.unresolvedKeyExchanges[0];
        if (previous) {
          recoveryId = previous.recoveryId;
          lastConfirmedOperationId = previous.operationId;
          lastConfirmedStage = previous.stage;
        }
      }
      firstFailure = "pending";
      const settled = settlePending(root, current, () => {});
      cleanupConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      let next = prepared;
      while (true) {
        const exchange = current.state.unresolvedKeyExchanges[0];
        if (!next && exchange?.stage === "credential_stored")
          return {
            status: "completed" as const,
            value: {
              exchange: structuredClone(exchange),
              revision: current.state.revision,
            },
            publication: "confirmed" as const,
            revision: current.state.revision,
            cleanupConfirmed: true as const,
          };
        firstFailure = "candidate";
        if (!next && exchange?.stage === "prepared")
          next = prepareKeyExchangeRevocation(
            current.state,
            exchange.recoveryId,
          );
        else if (!next && exchange?.stage === "revoked") {
          firstFailure = "capacity";
          const reservation = prepareExchangedCredential(
            current.state,
            exchange.recoveryId,
            {
              credentialId: "f".repeat(24),
              tokenSalt: "f".repeat(32),
              tokenVerifier: "f".repeat(64),
            },
          );
          if (!reservation) throw new Error("candidate");
          const reserved = preparePublicationBytes(
            current,
            reservation,
            "credential",
          );
          if (
            reserved.nextBytes.byteLength > CURRENT_LIMIT ||
            reserved.pendingBytes.byteLength > PENDING_LIMIT
          )
            throw new Error("capacity");
          firstFailure = "generation";
          const material = createCredentialMaterial();
          if (
            current.state.credentials.some(
              (item) => item.credentialId === material.credentialId,
            )
          )
            throw new Error("collision");
          next = prepareExchangedCredential(
            current.state,
            exchange.recoveryId,
            material,
          );
          issuedToken = material.token;
        }
        if (!next) throw new Error("candidate");
        const parsed = parseAccessManagementState(serialize(next));
        if (parsed.status !== "parsed") throw new Error("candidate");
        firstFailure = "prepare";
        publication = "not_attempted";
        cleanupConfirmed = false;
        const published = publishState(
          root,
          current,
          parsed.state,
          "credential",
        );
        publication = published.publication;
        revision = published.revision;
        cleanupConfirmed = published.cleanupConfirmed;
        if (published.publication === "confirmed") {
          const known = parsed.state.unresolvedKeyExchanges[0];
          if (known) {
            recoveryId = known.recoveryId;
            lastConfirmedOperationId = known.operationId;
            lastConfirmedStage = known.stage;
          }
        }
        if (published.status !== "completed") {
          firstFailure =
            published.reason === "state_store_publish_failed"
              ? "publish"
              : published.reason === "state_store_read_back_failed"
                ? "read_back"
                : published.reason === "state_store_cleanup_failed"
                  ? "cleanup"
                  : published.reason === "state_store_capacity_exceeded"
                    ? "capacity"
                    : "prepare";
          return published;
        }
        firstFailure = "read_back";
        current = readCurrent(root);
        if (!current.bytes.equals(serialize(parsed.state)))
          throw new Error("read_back");
        next = null;
      }
    } catch {
      return {
        status: "unavailable" as const,
        reason: "state_store_key_exchange_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "key_exchange_rejected" };
  if (result.status === "completed") {
    const exchange = result.value.exchange;
    return {
      status: "completed",
      operationId,
      recoveryId: exchange.recoveryId,
      entry: exchange.entry,
      scope: exchange.scope,
      userId: exchange.recipientUserId,
      oldCredentialIds: Object.freeze([...exchange.oldCredentialIds]),
      credentialId: exchange.newCredentialId,
      expectedRevision,
      revision: result.value.revision,
      lastConfirmedStage: "credential_stored",
      token: issuedToken,
      cleanupConfirmed: true,
    };
  }
  const releaseFailure =
    !!result.secondaryReason ||
    !!result.lockRecoveryId ||
    result.reason === "state_store_lock_unknown";
  return {
    status: "unavailable",
    reason: "key_exchange_unavailable",
    operationId,
    recoveryId,
    expectedRevision,
    observedRevision: result.revision,
    lastConfirmedOperationId,
    lastConfirmedStage,
    firstFailure:
      releaseFailure &&
      result.reason !== "state_store_key_exchange_failed" &&
      !result.secondaryReason
        ? "release"
        : firstFailure,
    secondaryFailure:
      releaseFailure && result.secondaryReason ? "release" : null,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在administratorの指定／全員交換を保存する。
 * @responsibility Workbench同Processだけを交換保存へ接続する。
 * @trace ARCH-000013
 * @input Root・現在鍵・期待改訂・交換UUID・範囲・発行先・表示旧集合・確認・任意の前交換参照。
 * @returns core保存結果。新規成功時だけ一度提示用token。
 * @precondition 事前表示済み。全員だけ明示確認。提示Ownerが後続処置を担う。
 * @postcondition recordと未提示事実を保持し、入力対象外を変更しない。
 * @effect 既存Lock内の三出版と一資格生成。
 * @failure 現在非管理者・別相関・保存／清掃／解放不明は停止。
 * @invariant Recoveryは認可ではなく、旧鍵の再認証は別要求だけ。
 * @boundary Workbench BackendからAMへの用途限定内部入口。
 * @security MCP公開・秘密保存・再表示0。
 * @concurrency 同期保存。同一受付は現在recordで再観測する。
 */
export function exchangeCredentials(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeResult {
  return executeKeyExchange(
    root,
    "workbench",
    token,
    expectedRevision,
    operationId,
    scope,
    recipientUserId,
    displayedOldCredentialIds,
    confirmed,
    previousRecoveryId,
  );
}

/**
 * 信頼Hostの指定／全員交換とexact継続を保存する。
 * @responsibility 資格喪失でも新Recoveryや起点entry変更なしで進める。
 * @trace ARCH-000013
 * @input Root・期待改訂・交換UUID・範囲・発行先・表示旧集合・確認・任意の前交換参照。
 * @returns core保存結果。stored再入場はtoken null。
 * @precondition ログイン済みHost入口。双方事前表示と明示確認済み。
 * @postcondition 起点entryとexact相関を保持する。
 * @effect 既存保存処理だけ。追加認証・OS昇格なし。
 * @failure 不明・対象差・未確認・材料不明は停止。
 * @invariant 初回途中は同User指定だけ。初期化・Role修復へ転用しない。
 * @boundary Host対話Ownerから用途限定保存。
 * @security Remote／MCPから呼ばない。生鍵の再取得・保存0。
 * @concurrency 同じ既存Lockで現在状態を再照合する。
 */
export function exchangeCredentialsFromHost(
  root: FilesystemStoreRoot,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeResult {
  return executeKeyExchange(
    root,
    "host",
    null,
    expectedRevision,
    operationId,
    scope,
    recipientUserId,
    displayedOldCredentialIds,
    confirmed,
    previousRecoveryId,
  );
}

/**
 * 確認済み交換の終了候補を既存保存へ接続する。
 * @responsibility 現在認可を材料処置前に検査し、recordだけを一出版で除去する。
 * @trace ARCH-000013
 * @input Root、入口・鍵、期待改訂、終了操作UUID、exact交換参照。
 * @returns 非秘密の確定結果または拒否・保存不明。
 * @precondition Workbench同Processまたはログイン済みHostの内部Owner。
 * @postcondition 資格・提示・初回・対象外field不変。
 * @effect 既存Lockとpending／replaceによる一出版・読戻し・材料清掃。
 * @failure 未確認は処置0。材料処置・保存・解放不明は停止。
 * @invariant Secret破棄やrecord不在を終了成功へ変換しない。
 * @boundary 現在認可・exact終了・Filesystem確定。
 * @security 生鍵なし。認可前に材料処置しない。
 * @concurrency 既存単一Lockへ閉じ、次要求はfresh再評価。
 */
function completeKeyExchange(
  root: FilesystemStoreRoot,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): KeyExchangeCompletionResult {
  if (
    !isKeyExchangeRecoveryId(recoveryId) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    (entry === "workbench" &&
      (typeof token !== "string" || !readCredentialId(token)))
  )
    return {
      status: "unavailable",
      reason: "key_exchange_completion_rejected",
    };
  let admitted = false;
  let firstFailure: Extract<
    KeyExchangeCompletionResult,
    { reason: "key_exchange_completion_unavailable" }
  >["firstFailure"] = "pending";
  const result = locked<Readonly<{ revision: number; operationId: string }>>(
    root,
    () => {
      let revision: number | null = null;
      let cleanupConfirmed = false;
      try {
        const current = readCurrent(root);
        revision = current.state.revision;
        const next = prepareKeyExchangeCompletion(
          current.state,
          entry,
          token,
          expectedRevision,
          operationId,
          recoveryId,
        );
        if (!next)
          return {
            status: "unavailable",
            reason: "state_store_completion_rejected",
            publication: "not_attempted",
            revision,
            cleanupConfirmed: true,
          };
        admitted = true;
        if (settlePending(root, current, () => {}) !== "none")
          return {
            status: "unavailable",
            reason: "state_store_previous_pending_settled",
            publication: "not_attempted",
            revision,
            cleanupConfirmed: true,
          };
        cleanupConfirmed = true;
        firstFailure = "prepare";
        const parsed = parseAccessManagementState(serialize(next));
        if (parsed.status !== "parsed") throw new Error("candidate");
        const published = publishState(
          root,
          current,
          parsed.state,
          "credential",
        );
        if (published.status !== "completed")
          firstFailure =
            published.reason === "state_store_publish_failed"
              ? "publish"
              : published.reason === "state_store_read_back_failed"
                ? "read_back"
                : published.reason === "state_store_cleanup_failed"
                  ? "cleanup"
                  : published.reason === "state_store_capacity_exceeded"
                    ? "capacity"
                    : "prepare";
        return published;
      } catch {
        return {
          status: "unavailable",
          reason: "state_store_completion_failed",
          publication: "not_attempted",
          revision,
          cleanupConfirmed,
        };
      }
    },
  );
  if (!admitted)
    return {
      status: "unavailable",
      reason: "key_exchange_completion_rejected",
    };
  if (result.status === "completed")
    return {
      status: "completed",
      revision: result.value.revision,
      operationId,
      recoveryId,
      cleanupConfirmed: true,
    };
  const releaseFailure =
    !!result.secondaryReason ||
    !!result.lockRecoveryId ||
    result.reason === "state_store_lock_unknown";
  return {
    status: "unavailable",
    reason: "key_exchange_completion_unavailable",
    operationId,
    recoveryId,
    observedRevision: result.revision,
    firstFailure:
      releaseFailure &&
      !result.secondaryReason &&
      result.reason !== "state_store_completion_failed"
        ? "release"
        : firstFailure,
    secondaryFailure:
      releaseFailure && result.secondaryReason ? "release" : null,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在管理者の確認済み交換を閉じる。
 * @responsibility Workbench内部の終了処置を現在資格で認可する。
 * @trace ARCH-000013
 * @input Root、現在鍵、期待改訂、終了操作UUID、交換参照。
 * @returns 非秘密の終了結果。
 * @precondition 同Process内部Consumer、提示confirmed。
 * @postcondition record以外を保持する。
 * @effect 既存保存Ownerの一出版。
 * @failure 非管理者・未知・未確認・保存不明は停止。
 * @invariant 拒否とrecord不在から完了を推定しない。
 * @boundary Workbench内部とAM。
 * @security MCPへ公開しない。
 * @concurrency 既存Lockでfresh再認可。
 */
export function finishKeyExchange(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): KeyExchangeCompletionResult {
  return completeKeyExchange(
    root,
    "workbench",
    token,
    expectedRevision,
    operationId,
    recoveryId,
  );
}

/**
 * 信頼Hostの確認済み交換を閉じる。
 * @responsibility 資格喪失時も現在exact交換だけを整理する。
 * @trace ARCH-000013
 * @input Root、期待改訂、終了操作UUID、交換参照。
 * @returns 非秘密の終了結果。
 * @precondition ログイン済みHost内部入口。初回は同UserのHost指定だけ。
 * @postcondition record以外を保持する。
 * @effect 既存保存Ownerの一出版。
 * @failure 相関・提示・保存不明は停止。
 * @invariant 追加認証・初期化・Role修復をしない。
 * @boundary 信頼HostとAM。
 * @security Remote／MCPへ公開しない。
 * @concurrency 同じ既存Lockで再評価。
 */
export function finishKeyExchangeFromHost(
  root: FilesystemStoreRoot,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): KeyExchangeCompletionResult {
  return completeKeyExchange(
    root,
    "host",
    null,
    expectedRevision,
    operationId,
    recoveryId,
  );
}

/**
 * 現在Authorityとexact参照を既存Lockの読取りへ接続する。
 * @responsibility 認可前処置・材料処置後の旧事実返却を拒否する。
 * @trace ARCH-000013
 * @input Root、現在入口・鍵、exact Recovery。
 * @returns 凍結された非秘密観測または固定未取得。
 * @precondition Workbench同Processまたは信頼Host内部Ownerだけ。
 * @postcondition 材料処置noneとLock解放確認後だけ現在事実を返す。
 * @effect current・現在認可・相関を照合後、既存材料だけ処置する。
 * @failure 観測・清掃・解放不明では事実0。
 * @invariant 新出版・失効・生成・提示・record終了0。
 * @boundary 資格の投影とFilesystem保存Owner。
 * @security Snapshot内部材料・Secret・Lock参照の透過0。
 * @concurrency 同じLock一回。材料処置要求はfresh次要求へ戻す。
 */
function observeKeyExchange(
  root: FilesystemStoreRoot,
  entry: "workbench" | "host",
  token: string | null,
  recoveryId: string,
): KeyExchangeObservation {
  const unavailable = Object.freeze({
    status: "unavailable" as const,
    reason: "key_exchange_state_unavailable" as const,
  });
  if (
    !isKeyExchangeRecoveryId(recoveryId) ||
    (entry === "workbench" &&
      (typeof token !== "string" || !readCredentialId(token)))
  )
    return unavailable;
  const result = locked<KeyExchangeSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const snapshot = projectKeyExchangeState(
        current.state,
        entry,
        token,
        recoveryId,
      );
      if (!snapshot || settlePending(root, current, () => {}) !== "none")
        return {
          status: "unavailable",
          reason: "key_exchange_state_unavailable",
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
        reason: "key_exchange_state_unavailable",
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

/**
 * 現在administratorへHost起点も含めexact交換を非秘密観測する。
 * @responsibility 起点entryを維持し、継続の入口制約を弱めない。
 * @trace ARCH-000013
 * @input Root・現在Bearer・exact Recovery。
 * @returns 非秘密観測または固定未取得。
 * @precondition 同ProcessのWorkbench管理読取りOwnerだけ。
 * @postcondition 交換や提示を進めず、現在事実だけを返す。
 * @effect 既存Lock読取りと許可後の材料処置だけ。
 * @failure 非管理者・初回途中・不明は事実0。
 * @invariant 記録不存在からclosedを推定しない。
 * @boundary Workbench内部の状態読取り。
 * @security MCP公開・秘密値の返却0。
 * @concurrency 毎回現在Authorityを再照合する。
 */
export function readKeyExchangeState(
  root: FilesystemStoreRoot,
  token: string,
  recoveryId: string,
): KeyExchangeObservation {
  return observeKeyExchange(root, "workbench", token, recoveryId);
}

/**
 * 信頼Hostへexact交換の非秘密な現在状態だけを返す。
 * @responsibility 資格喪失時の観測を新交換やAuthority復元と分ける。
 * @trace ARCH-000013
 * @input Root・exact Recovery。
 * @returns 非秘密観測または固定未取得。
 * @precondition ログイン済みHostの内部Owner。初回は同User指定交換だけ。
 * @postcondition 追加確認・失効・生成・提示・終了処置なし。
 * @effect 既存Lockとcurrent観測、許可後の材料処置だけ。
 * @failure 相関・段階・観測不明は事実0。
 * @invariant Host信頼をRemoteへ転用しない。
 * @boundary Host内部状態確認。
 * @security token・Verifier・salt・内部Path公開0。
 * @concurrency 毎回完全currentで再評価する。
 */
export function readKeyExchangeStateFromHost(
  root: FilesystemStoreRoot,
  recoveryId: string,
): KeyExchangeObservation {
  return observeKeyExchange(root, "host", null, recoveryId);
}
