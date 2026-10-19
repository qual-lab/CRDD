/**
 * 最初の管理者・資格の保存とHost初回設定の手順を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import crypto, { randomUUID } from "node:crypto";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  presentKeyToTerminal,
  updateCredentialPresentationState,
} from "../credential/presentation.ts";
import { createCredentialMaterial } from "../credential/token.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  CURRENT,
  CURRENT_LIMIT,
  hash,
  locked,
  PENDING,
  PENDING_LIMIT,
  present,
  publishState,
  REPLACE,
  readCurrent,
  serialize,
  settlePending,
  writeExclusive,
} from "../storage/store.ts";
import type {
  AccessManagementState,
  StateStoreResult,
} from "../storage/types.ts";
import {
  evaluateHostInitializationState,
  readHostInitializationState,
} from "./state.ts";

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
  const started = updateCredentialPresentationState(root, {
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
  const confirmed = updateCredentialPresentationState(root, {
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

/**
 * 初回相関の完全な基準状態を構築する。
 * @responsibility 初期Roleと空集合を一つの固定候補にする。
 * @trace ARCH-000013
 * @input 検査済み元試行UUID。
 * @returns revision1の所有Snapshot。
 * @precondition 内部Ownerがprimitive入力を検査済み。
 * @postcondition 操作IDと元試行が一致する。
 * @effect N/A: メモリ値だけ。
 * @failure N/A: 固定形状の構築のみ。
 * @invariant User・資格・登録・公開・交換は空。
 * @boundary 初回相関と初期状態。
 * @security Secret・認可Authorityは生成しない。
 * @concurrency N/A: 局所値だけ。
 */
function initialBaseline(attemptId: string): AccessManagementState {
  return {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: attemptId,
    users: [],
    credentials: [],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    initialization: { stage: "correlated", attemptId },
  };
}

/**
 * 初回の元試行だけを排他的に保存・再観測する。
 * @responsibility 完全な同元試行baselineと未初期化・破損を分離する。
 * @trace ARCH-000013
 * @input 既存Root、元試行UUID、明示開始、旧管理状態と進行記録の観測tuple。
 * @returns 相関読戻し済みの改訂・元試行・新規作成有無、または未完了。
 * @precondition 信頼済みHostの内部Ownerだけが呼ぶ。旧入力は同じLockで安定化するか書込み不能である。観測callbackは同期read-onlyで、Promise・外部／永続Effect・UUID・鍵・別Store更新・応答を行わない。
 * @postcondition 新規または同元試行の完全baseline読戻し後だけcompletedを返す。
 * @effect Lock取得・排他的current作成・読取り。User UUID・鍵・Root準備は行わない。
 * @failure 別試行・途中材料・partial current・旧観測不明・保存失敗は保持停止。
 * @invariant 既存currentを置換・修復・削除せず、元試行をAuthorityへ変換しない。
 * @boundary AM内部初回保存Ownerと既存Filesystem保存部品。
 * @security 生Secret・Verifier・Pathを公開しない。鍵操作は未接続。
 * @concurrency 同じLock内で観測一回、wxで採用一件。旧Owner回収は既存exact経路だけ。
 */
export function initializeAccessManagementState(
  root: FilesystemStoreRoot,
  attemptId: string,
  isStartRequested: boolean,
  observePrevious: () => readonly [unknown, unknown],
): StateStoreResult<
  Readonly<{ revision: number; attemptId: string; created: boolean }>
> {
  if (
    typeof attemptId !== "string" ||
    !ATTEMPT_UUID.test(attemptId) ||
    isStartRequested !== true ||
    typeof observePrevious !== "function"
  )
    return {
      status: "unavailable",
      reason: "state_store_initialization_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked<
    Readonly<{ revision: number; attemptId: string; created: boolean }>
  >(root, () => {
    let publication: "not_attempted" | "unconfirmed" | "confirmed" =
      "not_attempted";
    let revision: number | null = null;
    try {
      const baseline = initialBaseline(attemptId);
      const expected = serialize(baseline);
      if (
        parseAccessManagementState(expected).status !== "parsed" ||
        isStartRequested !== true
      )
        return {
          status: "unavailable",
          reason: "state_store_initialization_input_rejected",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      if (present(root, PENDING) || present(root, REPLACE))
        return {
          status: "unavailable",
          reason: "state_store_initialization_material_present",
          publication,
          revision,
          cleanupConfirmed: false,
        };
      if (present(root, CURRENT)) {
        const current = readCurrent(root);
        if (!current.bytes.equals(expected))
          return {
            status: "unavailable",
            reason: "state_store_initialization_current_conflict",
            publication,
            revision: current.state.revision,
            cleanupConfirmed: true,
          };
        return {
          status: "completed",
          value: { revision: 1, attemptId, created: false },
          publication: "confirmed",
          revision: 1,
          cleanupConfirmed: true,
        };
      }
      const observation = observePrevious();
      if (
        !Array.isArray(observation) ||
        observation.length !== 2 ||
        !evaluateHostInitializationState(observation[0], observation[1], true)
          .canStart
      )
        return {
          status: "unavailable",
          reason: "state_store_initialization_observation_rejected",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      publication = "unconfirmed";
      writeExclusive(root, CURRENT, expected);
      const current = readCurrent(root);
      if (!current.bytes.equals(expected))
        throw new Error("read_back_mismatch");
      publication = "confirmed";
      revision = 1;
      return {
        status: "completed",
        value: { revision: 1, attemptId, created: true },
        publication,
        revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_initialization_failed",
        publication,
        revision,
        cleanupConfirmed: false,
      };
    }
  });
}

/**
 * 保存済み初回相関に最初の管理者を生成・保存する。
 * @responsibility 初回Userの生成と保存済み同Userの再観測を分離する。
 * @trace ARCH-000013
 * @input 既存Root・元試行UUID・表示専用username。
 * @returns 保存改訂・User ID・保存名・新規生成有無、または未完了。
 * @precondition 信頼済みHost内部保存Ownerだけが呼ぶ。元試行相関を保存済み。
 * @postcondition 完全user_storedの読戻し後だけcompleted。
 * @effect Lock、UUID生成、初回Userのpending・replace・current保存。
 * @failure 別試行・非canonical相関・途中材料・保存失敗は保持停止。
 * @invariant 保存済みUserを増やさず、名前を再要求で変更しない。鍵・認証・Root準備・Host完了は未接続。
 * @boundary 初回User保存段階とFilesystem。
 * @security primitive入力を先に検査し、User IDをAuthorityにしない。
 * @concurrency 同じLock内の一生成・一出版。base材料の再出版なし。
 */
export function createInitialAdministrator(
  root: FilesystemStoreRoot,
  attemptId: string,
  username: string,
): StateStoreResult<
  Readonly<{
    revision: number;
    userId: string;
    username: string;
    created: boolean;
  }>
> {
  if (
    typeof attemptId !== "string" ||
    !ATTEMPT_UUID.test(attemptId) ||
    typeof username !== "string" ||
    username !== username.trim() ||
    [...username].length < 1 ||
    [...username].length > 128 ||
    /[\p{Cc}\p{Cs}]/u.test(username)
  )
    return {
      status: "unavailable",
      reason: "state_store_initial_user_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked<
    Readonly<{
      revision: number;
      userId: string;
      username: string;
      created: boolean;
    }>
  >(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      settlePending(root, current, () => {
        publication = "confirmed";
      });
      cleanupConfirmed = true;
      const expected = initialBaseline(attemptId);
      if (current.state.initialization.stage === "user_stored") {
        const user = current.state.users[0];
        if (
          !user ||
          user.userId === attemptId ||
          current.state.operationId === attemptId ||
          current.state.operationId === user.userId
        )
          throw new Error("initial_user_conflict");
        expected.revision = 2;
        expected.operationId = current.state.operationId;
        expected.users = [{ ...user }];
        expected.initialization = {
          stage: "user_stored",
          attemptId,
          userId: user.userId,
        };
        if (!serialize(expected).equals(current.bytes))
          throw new Error("initial_user_conflict");
        return {
          status: "completed",
          value: {
            revision: 2,
            userId: user.userId,
            username: user.username,
            created: false,
          },
          publication: "confirmed",
          revision: 2,
          cleanupConfirmed: true,
        };
      }
      if (!serialize(expected).equals(current.bytes))
        throw new Error("initial_baseline_conflict");
      expected.revision = 2;
      expected.operationId = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";
      const reservedUserId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
      expected.users = [
        {
          userId: reservedUserId,
          username,
          role: "administrator",
        },
      ];
      expected.initialization = {
        stage: "user_stored",
        attemptId,
        userId: reservedUserId,
      };
      const reservation = serialize(expected);
      const pendingReservation = serialize({
        contract: "crdd-access-management/pending",
        schemaRevision: 1,
        kind: "initialization",
        baseRevision: current.state.revision,
        baseSha256: hash(current.bytes),
        nextRevision: expected.revision,
        nextSha256: hash(reservation),
        operationId: expected.operationId,
        nextSnapshot: expected,
      });
      if (
        reservation.byteLength > CURRENT_LIMIT ||
        pendingReservation.byteLength > PENDING_LIMIT
      )
        throw new Error("initial_user_capacity");
      const userId = crypto.randomUUID();
      const operationId = crypto.randomUUID();
      if (
        userId === attemptId ||
        operationId === attemptId ||
        operationId === userId ||
        !ATTEMPT_UUID.test(userId) ||
        !ATTEMPT_UUID.test(operationId)
      )
        throw new Error("uuid_collision");
      expected.operationId = operationId;
      expected.users = [{ userId, username, role: "administrator" }];
      expected.initialization = { stage: "user_stored", attemptId, userId };
      const parsed = parseAccessManagementState(serialize(expected));
      if (parsed.status !== "parsed") throw new Error("initial_user_invalid");
      const result = publishState(
        root,
        current,
        parsed.state,
        "initialization",
      );
      return result.status === "completed"
        ? { ...result, value: { revision: 2, userId, username, created: true } }
        : result;
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_initial_user_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}

/**
 * 保存済み初回管理者へ最初の鍵を一回だけ保存する。
 * @responsibility 完全資格の出版と保存済み資格の再観測を分離する。
 * @trace ARCH-000013
 * @input 既存Root・保存済み元試行UUID。
 * @returns 改訂・資格ID・生成有無と一回限りの短命鍵、または未完了。
 * @precondition 信頼済みHost内部Ownerだけが呼ぶ。初回Userを保存済み。
 * @postcondition 出版・読戻し・Lock解放が確認できた新規保存だけtokenを返す。
 * @effect 既存Lock、乱数・KDF、資格のpending・replace・current保存。
 * @failure 別試行・非canonical状態・途中材料・保存不明は保持停止。
 * @invariant 同元試行へ追加資格を生成せず、保存済みSecretを復元しない。
 * @boundary 初回資格保存とFilesystem。配送・認証・公開入口は別段階。
 * @security tokenは内部短命返却値だけ。current・ログ・診断へ保存しない。
 * @concurrency 同じLock内で容量検査から一生成・一出版まで行う。
 */
export function createInitialCredential(
  root: FilesystemStoreRoot,
  attemptId: string,
): StateStoreResult<
  Readonly<{
    revision: number;
    credentialId: string;
    created: boolean;
    token: string | null;
  }>
> {
  if (typeof attemptId !== "string" || !ATTEMPT_UUID.test(attemptId))
    return {
      status: "unavailable",
      reason: "state_store_initial_credential_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked<
    Readonly<{
      revision: number;
      credentialId: string;
      created: boolean;
      token: string | null;
    }>
  >(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      settlePending(root, current, () => {
        publication = "confirmed";
      });
      cleanupConfirmed = true;
      const user = current.state.users[0];
      if (
        user?.role !== "administrator" ||
        user.userId === attemptId ||
        current.state.operationId === attemptId ||
        current.state.operationId === user.userId
      )
        throw new Error("initial_user_conflict");
      const expected = initialBaseline(attemptId);
      expected.revision = current.state.revision;
      expected.operationId = current.state.operationId;
      expected.users = [{ ...user }];
      const initialization = current.state.initialization;
      if (initialization.stage === "credential_stored") {
        const credential = current.state.credentials[0];
        if (!credential || current.state.revision < 3)
          throw new Error("initial_credential_conflict");
        expected.credentials = [{ ...credential }];
        expected.initialization = {
          stage: "credential_stored",
          attemptId,
          userId: user.userId,
          initialCredentialId: credential.credentialId,
          confirmationCredentialId: credential.credentialId,
        };
        if (!serialize(expected).equals(current.bytes))
          throw new Error("initial_credential_conflict");
        return {
          status: "completed",
          value: {
            revision: current.state.revision,
            credentialId: credential.credentialId,
            created: false,
            token: null,
          },
          publication: "confirmed",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      }
      expected.initialization = {
        stage: "user_stored",
        attemptId,
        userId: user.userId,
      };
      if (
        current.state.revision !== 2 ||
        !serialize(expected).equals(current.bytes)
      )
        throw new Error("initial_user_conflict");
      expected.revision = 3;
      expected.operationId = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";
      expected.credentials = [
        {
          credentialId: "f".repeat(24),
          userId: user.userId,
          tokenVersion: 1,
          tokenSalt: "f".repeat(32),
          tokenVerifier: "f".repeat(64),
          revoked: false,
          operationId: attemptId,
          presentation: "not_attempted",
        },
      ];
      expected.initialization = {
        stage: "credential_stored",
        attemptId,
        userId: user.userId,
        initialCredentialId: "f".repeat(24),
        confirmationCredentialId: "f".repeat(24),
      };
      const reservation = serialize(expected);
      const pendingReservation = serialize({
        contract: "crdd-access-management/pending",
        schemaRevision: 1,
        kind: "initialization",
        baseRevision: current.state.revision,
        baseSha256: hash(current.bytes),
        nextRevision: 3,
        nextSha256: hash(reservation),
        operationId: expected.operationId,
        nextSnapshot: expected,
      });
      if (
        reservation.byteLength > CURRENT_LIMIT ||
        pendingReservation.byteLength > PENDING_LIMIT
      )
        throw new Error("initial_credential_capacity");
      const operationId = crypto.randomUUID();
      if (
        !ATTEMPT_UUID.test(operationId) ||
        operationId === attemptId ||
        operationId === user.userId ||
        operationId === current.state.operationId
      )
        throw new Error("uuid_collision");
      const material = createCredentialMaterial();
      expected.operationId = operationId;
      expected.credentials[0] = {
        userId: user.userId,
        tokenVersion: 1,
        revoked: false,
        operationId: attemptId,
        presentation: "not_attempted",
        credentialId: material.credentialId,
        tokenSalt: material.tokenSalt,
        tokenVerifier: material.tokenVerifier,
      };
      expected.initialization.initialCredentialId = material.credentialId;
      expected.initialization.confirmationCredentialId = material.credentialId;
      const parsed = parseAccessManagementState(serialize(expected));
      if (parsed.status !== "parsed")
        throw new Error("initial_credential_invalid");
      const result = publishState(
        root,
        current,
        parsed.state,
        "initialization",
      );
      return result.status === "completed"
        ? {
            ...result,
            value: {
              revision: 3,
              credentialId: material.credentialId,
              created: true,
              token: material.token,
            },
          }
        : result;
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_initial_credential_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}
