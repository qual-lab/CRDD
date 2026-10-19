/**
 * 鍵の一度提示と現在の提示結果を記録する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import crypto from "node:crypto";
import { types } from "node:util";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
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
 * 対話端末への一書込みだけを完了通知まで待つ。
 * @responsibility 先行取消・故障を保持し、遅延通知から再送や成功を作らない。
 * @trace ARCH-000013
 * @input Host所有TTY、短命鍵、取消Signal。
 * @returns 当該chunkのサービス側提示を確認できた場合だけtrue。
 * @precondition 信頼されたNode WriteStream。任意の外部Writerの成功申告は受けない。
 * @postcondition 一write以下、callback join後に当該Listenerを除去しBufferを消去する。
 * @effect TTYへ鍵と案内を一writeする。end／destroy／再送は0。
 * @failure throw・error・close・abortはfalse。callback未着は保留を維持する。
 * @invariant callback前の取消・故障を遅延成功で上書きしない。
 * @boundary Node TTYのwrite callback／error／closeと保存Owner。
 * @security Listenerは鍵本文を返さず、JS stringの物理zeroizeは保証しない。
 * @concurrency 同書込みをjoinし、error通知tick後に当該Listenerだけを解放する。
 */
export async function presentKeyToTerminal(
  terminal: NodeJS.WriteStream,
  token: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted || terminal.isTTY !== true || !terminal.writable)
    return false;
  const bytes = Buffer.from(
    `接続鍵（一度だけ表示します。安全な場所へ控えてください）:\n${token}\nこの鍵でWorkbenchまたはMCPへ接続してください。\n`,
    "utf8",
  );
  token = "";
  return new Promise<boolean>((resolve) => {
    let failed = false;
    let callbackJoined = false;
    const fail = () => {
      failed = true;
    };
    const finish = (error?: Error | null) => {
      if (callbackJoined) return;
      callbackJoined = true;
      const presented = !error && !failed && !signal.aborted;
      bytes.fill(0);
      // write errorはcallbackの後に通知されるため、当該Listenerを通知tickまで保持する。
      setImmediate(() => {
        terminal.removeListener("error", fail);
        terminal.removeListener("close", fail);
        signal.removeEventListener("abort", fail);
        resolve(presented && !failed && !signal.aborted);
      });
    };
    terminal.on("error", fail);
    terminal.on("close", fail);
    signal.addEventListener("abort", fail, { once: true });
    if (signal.aborted || terminal.isTTY !== true || !terminal.writable) {
      finish(new Error("terminal_unavailable"));
      return;
    }
    try {
      terminal.write(bytes, finish);
    } catch {
      finish(new Error("terminal_write_failed"));
    }
  });
}

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

/**
 * 資格の提示前記録と出力観測後の記録を同じ保存Ownerで出版する。
 * @responsibility 非秘密exact相関をfresh照合し、対象presentationだけを一改訂進める。
 * @trace ARCH-000013
 * @input 検証済みRootと閉じた提示更新。confirmedは出力を観測した内部Ownerだけが要求する。
 * @returns 保存・清掃・Lock終了済みの非秘密相関、または既知出版と未完了。
 * @precondition 信頼済み内部Consumer用。相関入力やParser受理自体をAuthorityにしない。
 * @postcondition not_attempted→unconfirmedまたはunconfirmed→confirmedだけを保存し、再入場は提示許可を返さない。
 * @effect 既存Lock、current読取り、出版UUID、pending・replace・読戻し・材料清掃。
 * @failure 形式不正・失効・交換・改訂／提示不一致は更新0。保存／清掃／解放不明ではcompletedを返さない。
 * @invariant 他資格・User・Role・登録・初回歴史ID・未解決交換を変更しない。
 * @boundary 内部提示OwnerとAM保存。実TTY／HTTP観測・管理認可は呼出し側。
 * @security 生Secretを受け取らず返さず、遅延callbackは返した非秘密相関だけを保持する。
 * @concurrency 全Reader／Writerと同じLockで同期出版し、次更新は現在改訂を取り直す。
 */
export function updateCredentialPresentationState(
  root: FilesystemStoreRoot,
  input: unknown,
): StateStoreResult<
  Readonly<{
    revision: number;
    operationId: string;
    credentialId: string;
    issuanceOperationId: string;
    presentationOperationId: string;
    presentation: "unconfirmed" | "confirmed";
  }>
> {
  const update = readCredentialPresentationUpdate(input);
  if (!update)
    return {
      status: "unavailable",
      reason: "state_store_presentation_input_rejected",
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
      if (
        settlePending(root, current, () => {
          publication = "confirmed";
        }) !== "none"
      )
        return {
          status: "unavailable",
          reason: "state_store_previous_pending_settled",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      cleanupConfirmed = true;
      const index = selectCredentialPresentationTarget(current.state, update);
      if (index === null)
        return {
          status: "unavailable",
          reason: "state_store_presentation_rejected",
          publication,
          revision,
          cleanupConfirmed,
        };
      const operationId = crypto.randomUUID();
      if (
        !ATTEMPT_UUID.test(operationId) ||
        operationId === current.state.operationId ||
        operationId === update.issuanceOperationId
      )
        throw new Error("uuid_collision");
      const next = structuredClone(current.state);
      const credential = next.credentials[index];
      if (!credential) throw new Error("presentation_target_missing");
      next.revision = current.state.revision + 1;
      next.operationId = operationId;
      credential.presentation = update.target;
      const parsed = parseAccessManagementState(serialize(next));
      if (parsed.status !== "parsed")
        throw new Error("presentation_candidate_invalid");
      const result = publishState(root, current, parsed.state, "credential");
      return result.status === "completed"
        ? {
            ...result,
            value: {
              revision: result.value.revision,
              operationId: result.value.operationId,
              credentialId: update.credentialId,
              issuanceOperationId: update.issuanceOperationId,
              presentationOperationId:
                update.target === "unconfirmed"
                  ? result.value.operationId
                  : update.presentationOperationId,
              presentation: update.target,
            },
          }
        : result;
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_presentation_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}
