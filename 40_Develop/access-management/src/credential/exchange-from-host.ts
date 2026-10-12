/**
 * Host交換の保存・一度提示・確認済み終了を接続する。
 * @responsibility CLIの選択や認証を引き取らず、確定した各改訂で既存Ownerを呼ぶ。
 * @trace ARCH-000013
 */
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  exchangeCredentialsFromHost,
  finishKeyExchangeFromHost,
  readKeyExchangeStateFromHost,
  recordCredentialPresentation,
  type KeyExchangeResult,
  type KeyExchangeCompletionResult,
} from "../state/file-store.ts";
import { presentKeyToTerminal } from "./present-key-to-terminal.ts";

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
      const started = recordCredentialPresentation(root, {
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
      const confirmed = recordCredentialPresentation(root, {
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
