/**
 * Host初回設定の保存段階と一度だけの対話提示を接続する。
 * @responsibility 元試行で保存を進め、新規発行した鍵だけをTTYへ渡す。
 * @trace ARCH-000013
 */
import { randomUUID } from "node:crypto";
import { presentKeyToTerminal } from "../credential/present-key-to-terminal.ts";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
  readHostInitializationState,
  recordCredentialPresentation,
} from "../state/file-store.ts";

/**
 * Host初回実行の非秘密結果と必要な次行動を表す。
 * @responsibility 一度提示と初回接続完了を区別する。
 * @trace ARCH-000013
 * @shape 固定statusとreasonのみ。鍵・Root・Verifierは含まない。
 * @invariant awaiting_connectionは初回completedでも通常Authorityでもない。
 * @boundary 信頼済みHost内部Owner。MCPへ公開しない。
 * @security 生鍵を結果・例外へ複製しない。
 * @compatibility 最新AM v2保存だけ。旧形式移行はフロントAIが行う。
 */
export type HostInitializationResult = Readonly<
  | { status: "awaiting_connection"; reason: "host_key_presented" }
  | { status: "key_exchange_required"; reason: "host_key_not_replayable" }
  | { status: "existing"; reason: "host_already_initialized" }
  | { status: "cancelled"; reason: "host_initialization_cancelled" }
  | {
      status: "blocked";
      reason:
        | "host_terminal_required"
        | "host_initialization_input_rejected"
        | "host_initialization_unavailable"
        | "host_previous_state_not_empty"
        | "host_key_presentation_unconfirmed";
    }
>;

/**
 * 検証済みHost Rootで初回設定を進め、新規の鍵だけ一度提示する。
 * @responsibility Readerの元段階から保存APIを結び、途中資格の再表示を禁止する。
 * @trace ARCH-000013
 * @input 検証済みRoot、表示名、Host明示開始、旧二領域の同期観測、対話TTY、取消Signal。
 * @returns 非秘密の次行動。初回completedや通常利用許可は返さない。
 * @precondition ログイン済みHost内部入口。旧Writer停止は切替前提。Root準備は呼出側。
 * @postcondition 各保存の読戻し・清掃・Lock終了後だけ次段階へ進む。
 * @effect 元相関・User・資格・提示状態の保存と一度のTTY書込み。
 * @failure 不明は保持停止。資格保存後のSecret喪失は既存明示交換への案内だけ。
 * @invariant 保存済みattempt／Userを再利用し、追加鍵・再初期化・再表示は0。
 * @boundary Host内部composition→AM保存→Node TTY。MCP／HTTPへの公開操作ではない。
 * @security Tokenを結果・ログ・状態へ保存しない。表示名に制御文字を許さない。
 * @concurrency 保存中は既存AM Lock、TTY中はLockなし。同期保存前ごとに取消を確認する。
 */
export async function initializeFromHost(
  root: FilesystemStoreRoot,
  username: string,
  explicitlyRequested: boolean,
  observePrevious: () => readonly [unknown, unknown],
  terminal: NodeJS.WriteStream,
  signal: AbortSignal,
): Promise<HostInitializationResult> {
  const cancelled: HostInitializationResult = {
    status: "cancelled",
    reason: "host_initialization_cancelled",
  };
  const unavailable: HostInitializationResult = {
    status: "blocked",
    reason: "host_initialization_unavailable",
  };
  if (signal.aborted) return cancelled;
  if (terminal.isTTY !== true || !terminal.writable || terminal.destroyed)
    return { status: "blocked", reason: "host_terminal_required" };
  if (
    explicitlyRequested !== true ||
    typeof username !== "string" ||
    username !== username.trim() ||
    [...username].length < 1 ||
    [...username].length > 128 ||
    /[\p{Cc}\p{Cs}]/u.test(username) ||
    typeof observePrevious !== "function"
  )
    return { status: "blocked", reason: "host_initialization_input_rejected" };
  const observed = readHostInitializationState(root);
  if (observed.status === "unknown") return unavailable;
  if (observed.status === "existing")
    return { status: "existing", reason: "host_already_initialized" };
  if (
    observed.status === "in_progress" &&
    observed.stage === "credential_stored"
  )
    return observed.presentation === "confirmed" && !observed.unresolvedExchange
      ? { status: "awaiting_connection", reason: "host_key_presented" }
      : { status: "key_exchange_required", reason: "host_key_not_replayable" };
  let attemptId: string;
  if (observed.status === "fresh") {
    try {
      const previous = observePrevious();
      if (
        !Array.isArray(previous) ||
        previous.length !== 2 ||
        previous[0] !== "uninitialized" ||
        previous[1] !== "absent"
      )
        return { status: "blocked", reason: "host_previous_state_not_empty" };
    } catch {
      return unavailable;
    }
    if (signal.aborted) return cancelled;
    attemptId = randomUUID();
    const initial = initializeAccessManagementState(
      root,
      attemptId,
      true,
      observePrevious,
    );
    if (initial.status !== "completed") return unavailable;
  } else attemptId = observed.attemptId;
  if (signal.aborted) return cancelled;
  if (observed.status === "fresh" || observed.stage === "correlated") {
    const user = createInitialAdministrator(root, attemptId, username);
    if (user.status !== "completed") return unavailable;
  }
  if (signal.aborted) return cancelled;
  let token: string;
  let credentialId: string;
  let issuedRevision: number;
  {
    const issued = createInitialCredential(root, attemptId);
    if (issued.status !== "completed") return unavailable;
    if (!issued.value.created || issued.value.token === null)
      return {
        status: "key_exchange_required",
        reason: "host_key_not_replayable",
      };
    token = issued.value.token;
    credentialId = issued.value.credentialId;
    issuedRevision = issued.value.revision;
  }
  if (signal.aborted) return cancelled;
  const started = recordCredentialPresentation(root, {
    credentialId,
    issuanceOperationId: attemptId,
    expectedRevision: issuedRevision,
    target: "unconfirmed",
  });
  if (started.status !== "completed") return unavailable;
  const pending = presentKeyToTerminal(terminal, token, signal);
  token = "";
  const presented = await pending;
  if (signal.aborted) return cancelled;
  if (!presented)
    return { status: "blocked", reason: "host_key_presentation_unconfirmed" };
  const confirmed = recordCredentialPresentation(root, {
    credentialId: started.value.credentialId,
    issuanceOperationId: started.value.issuanceOperationId,
    expectedRevision: started.value.revision,
    presentationOperationId: started.value.presentationOperationId,
    target: "confirmed",
  });
  return confirmed.status === "completed"
    ? { status: "awaiting_connection", reason: "host_key_presented" }
    : unavailable;
}
