/**
 * 管理状態のUTF-8入力を容量・閉集合・現在参照・段階相関で検査する。
 * @responsibility 保存Adapterへ渡す完全Snapshotと不正入力を区別する。
 * @trace ARCH-000013
 */
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { types } from "node:util";
import type { AccessRole } from "../access/management-permission.ts";

const MAX_STATE_BYTES = 16_777_216;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CREDENTIAL_PATTERN = /^[0-9a-f]{24}$/;

/**
 * 初回の現在参照と終了時の歴史的参照を分ける。
 * @responsibility 保存された初回事実の段階別形状を保持する。
 * @trace ARCH-000013
 * @shape correlated、user_stored、credential_stored、completedの判別共用体。
 * @invariant 途中のIDは現在参照、完了後のIDは歴史的参照。
 * @boundary Access Management保存内部。公開DTOではない。
 * @security 秘密値・認可Authorityを含まない。
 * @compatibility 新state schemaRevision 1のみ。旧形式fallbackなし。
 */
export type InitializationRecord =
  | { stage: "correlated"; attemptId: string }
  | { stage: "user_stored"; attemptId: string; userId: string }
  | {
      stage: "credential_stored";
      attemptId: string;
      userId: string;
      credentialId: string;
      receipt: "unconfirmed" | "confirmed";
      normalConnection: "unconfirmed" | "confirmed";
    }
  | {
      stage: "completed";
      attemptId: string;
      initialUserId: string;
      initialCredentialId: string;
      delivery: "confirmed";
      receipt: "confirmed";
      normalConnection: "confirmed";
    };

/**
 * 交換対象・発行先と保存済み段階を表す。
 * @responsibility 未解決交換だけを現在状態に保持する。
 * @trace ARCH-000013
 * @shape 固定対象集合とprepared／revoked／credential_storedの共用体。
 * @invariant newCredentialIdは資格保存後だけ存在する。
 * @boundary Access Management保存内部。
 * @security Recovery参照はAuthorityではなく、Secretを含まない。
 * @compatibility 新state schemaRevision 1のみ。
 */
export type KeyExchangeRecord = {
  recoveryId: string;
  operationId: string;
  entry: "workbench" | "host";
  scope: "targeted" | "all";
  recipientUserId: string;
  oldCredentialIds: string[];
} & (
  | { stage: "prepared" | "revoked" }
  | { stage: "credential_stored"; newCredentialId: string }
);

/**
 * 単一改訂の管理状態を表す。
 * @responsibility User・資格・登録・公開・初回・未解決交換を同じ閉集合へ結合する。
 * @trace ARCH-000013
 * @shape 固定包絡と7項目。資格のsalt／Verifierを含む内部型。
 * @invariant 現在参照は実在し、各IDは一意。通常Receiptと一般履歴は含まない。
 * @boundary 保存内部。返却値を公開DTOとして使用しない。
 * @security 生Secret非保存。Verifierは公開・log・Evidenceへ出さない。
 * @compatibility crdd-access-management/state、schemaRevision 1。
 */
export type AccessManagementState = {
  contract: "crdd-access-management/state";
  schemaRevision: 1;
  revision: number;
  operationId: string;
  users: { userId: string; username: string; role: AccessRole }[];
  roleContentAccess: {
    role: AccessRole;
    workspaceIds: ("development" | "management")[];
  }[];
  credentials: {
    credentialId: string;
    userId: string;
    tokenVersion: 1;
    tokenSalt: string;
    tokenVerifier: string;
    revoked: boolean;
    operationId: string;
    delivery: "not_attempted" | "unconfirmed" | "confirmed";
  }[];
  registeredRepositories: {
    repositoryId: string;
    repositoryRoot: string;
    bindingId: string;
  }[];
  exposure: {
    repositoryId: string;
    workspaceIds: ("development" | "management")[];
  }[];
  initialization: InitializationRecord;
  unresolvedKeyExchanges: KeyExchangeRecord[];
};

/**
 * 入力検査結果を秘密を含まない拒否理由と分ける。
 * @responsibility 失敗時にSnapshotや入力本文を返さない。
 * @trace ARCH-000013
 * @shape parsedとinvalidの判別共用体。
 * @invariant invalidには状態値がない。
 * @boundary 内部保存Reader向け。
 * @security reasonに入力本文や秘密を含まない。
 * @compatibility 保存成功・認可・Root成立を表さない。
 */
export type StateParseResult =
  | { status: "parsed"; state: AccessManagementState }
  | {
      status: "invalid";
      reason:
        | "state_input_invalid"
        | "state_too_large"
        | "state_encoding_invalid"
        | "state_schema_invalid";
    };

/**
 * JSON由来のobjectを完全なfield集合へ制限する。
 * @responsibility 配列・null・欠損・余分fieldを拒否する。
 * @trace ARCH-000013
 * @input JSON.parse由来の値と期待field名。
 * @returns 検査済みrecord。失敗は例外。
 * @precondition 任意objectを受ける公開入口ではない。
 * @postcondition 全fieldがown propertyとして存在する。
 * @effect N/A: メモリ検査のみ。
 * @failure 不一致を固定例外で親parserへ返す。
 * @invariant 入力の補完・余分field削除を行わない。
 * @boundary 同File内のJSON検査。
 * @security 入力値を例外本文へ含めない。
 * @concurrency N/A: 共有状態なし。
 */
function requireClosedRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid");
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record);
  if (
    actualKeys.length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    throw new Error("invalid");
  return record;
}

/**
 * 管理状態のraw bytesを完全検査する。
 * @responsibility parse前容量、strict UTF-8、閉Schema、現在・歴史参照と段階相関を検査する。
 * @trace ARCH-000013
 * @input Uint8ArrayのUTF-8 JSON。16 MiB以下。
 * @returns 新しく所有した状態または固定拒否理由。
 * @precondition 保存Readerは別にRoot・実体同一性・Lockを確認する。
 * @postcondition 不正入力にSnapshotを返さず、変換・補完・旧形式fallbackをしない。
 * @effect N/A: I/O・鍵生成・認可・保存なし。
 * @failure 容量、文字コード、Schema・参照不一致を区別する。
 * @invariant parse成功から保存・Authority・配送確認を推定しない。
 * @boundary 保存の純粋検査部分だけ。
 * @security Secretを受理するfieldがなく、失敗へ本文を添付しない。
 * @concurrency 入力を同期でdecodeし、返却stateは入力と共有しない。
 */
export function parseAccessManagementState(
  bytes: Uint8Array,
): StateParseResult {
  if (!types.isUint8Array(bytes))
    return { status: "invalid", reason: "state_input_invalid" };
  const byteLength = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array.prototype),
    "byteLength",
  )?.get?.call(bytes) as number;
  if (byteLength > MAX_STATE_BYTES)
    return { status: "invalid", reason: "state_too_large" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { status: "invalid", reason: "state_encoding_invalid" };
  }
  try {
    const state = requireClosedRecord(JSON.parse(text), [
      "contract",
      "schemaRevision",
      "revision",
      "operationId",
      "users",
      "roleContentAccess",
      "credentials",
      "registeredRepositories",
      "exposure",
      "initialization",
      "unresolvedKeyExchanges",
    ]);
    if (
      state.contract !== "crdd-access-management/state" ||
      state.schemaRevision !== 1 ||
      !Number.isSafeInteger(state.revision) ||
      (state.revision as number) < 1 ||
      typeof state.operationId !== "string" ||
      !UUID_PATTERN.test(state.operationId)
    )
      throw new Error("invalid");
    for (const key of [
      "users",
      "roleContentAccess",
      "credentials",
      "registeredRepositories",
      "exposure",
      "unresolvedKeyExchanges",
    ])
      if (!Array.isArray(state[key])) throw new Error("invalid");
    const users = new Map<string, Record<string, unknown>>();
    for (const value of state.users as unknown[]) {
      const user = requireClosedRecord(value, ["userId", "username", "role"]);
      if (
        typeof user.userId !== "string" ||
        !UUID_PATTERN.test(user.userId) ||
        users.has(user.userId) ||
        typeof user.username !== "string" ||
        user.username !== user.username.trim() ||
        [...user.username].length < 1 ||
        [...user.username].length > 128 ||
        /[\p{Cc}\p{Cs}]/u.test(user.username) ||
        !["developer", "manager", "administrator"].includes(user.role as string)
      )
        throw new Error("invalid");
      users.set(user.userId, user);
    }
    const roles = new Set<string>();
    for (const value of state.roleContentAccess as unknown[]) {
      const role = requireClosedRecord(value, ["role", "workspaceIds"]);
      if (
        typeof role.role !== "string" ||
        !["developer", "manager", "administrator"].includes(role.role) ||
        roles.has(role.role)
      )
        throw new Error("invalid");
      roles.add(role.role);
      requireWorkspaceIds(role.workspaceIds);
    }
    if (roles.size !== 3) throw new Error("invalid");
    const repositories = new Set<string>();
    const bindings = new Set<string>();
    for (const value of state.registeredRepositories as unknown[]) {
      const repository = requireClosedRecord(value, [
        "repositoryId",
        "repositoryRoot",
        "bindingId",
      ]);
      if (
        typeof repository.repositoryId !== "string" ||
        !ID_PATTERN.test(repository.repositoryId) ||
        repositories.has(repository.repositoryId) ||
        typeof repository.repositoryRoot !== "string" ||
        !isAbsolute(repository.repositoryRoot) ||
        /[\p{Cc}\p{Cs}]/u.test(repository.repositoryRoot) ||
        typeof repository.bindingId !== "string" ||
        !/^binding-[0-9a-f]{32}$/.test(repository.bindingId) ||
        bindings.has(repository.bindingId)
      )
        throw new Error("invalid");
      repositories.add(repository.repositoryId);
      bindings.add(repository.bindingId);
      const normalizedRoot = resolve(repository.repositoryRoot).replace(
        /[\\/]+$/u,
        "",
      );
      const bindingRoot =
        process.platform === "win32"
          ? normalizedRoot.toLowerCase()
          : normalizedRoot;
      const expectedBinding = `binding-${createHash("sha256").update(`${repository.repositoryId}\n${bindingRoot}`, "utf8").digest("hex").slice(0, 32)}`;
      if (repository.bindingId !== expectedBinding) throw new Error("invalid");
    }
    const exposures = new Set<string>();
    for (const value of state.exposure as unknown[]) {
      const exposure = requireClosedRecord(value, [
        "repositoryId",
        "workspaceIds",
      ]);
      if (
        typeof exposure.repositoryId !== "string" ||
        !repositories.has(exposure.repositoryId) ||
        exposures.has(exposure.repositoryId)
      )
        throw new Error("invalid");
      exposures.add(exposure.repositoryId);
      requireWorkspaceIds(exposure.workspaceIds);
    }
    const credentials = new Map<string, Record<string, unknown>>();
    const issuanceIds = new Set<string>();
    for (const value of state.credentials as unknown[]) {
      const credential = requireClosedRecord(value, [
        "credentialId",
        "userId",
        "tokenVersion",
        "tokenSalt",
        "tokenVerifier",
        "revoked",
        "operationId",
        "delivery",
      ]);
      if (
        typeof credential.credentialId !== "string" ||
        !CREDENTIAL_PATTERN.test(credential.credentialId) ||
        credentials.has(credential.credentialId) ||
        typeof credential.userId !== "string" ||
        !users.has(credential.userId) ||
        credential.tokenVersion !== 1 ||
        typeof credential.tokenSalt !== "string" ||
        !/^[0-9a-f]{32}$/.test(credential.tokenSalt) ||
        typeof credential.tokenVerifier !== "string" ||
        !/^[0-9a-f]{64}$/.test(credential.tokenVerifier) ||
        typeof credential.revoked !== "boolean" ||
        typeof credential.operationId !== "string" ||
        !UUID_PATTERN.test(credential.operationId) ||
        issuanceIds.has(credential.operationId) ||
        !["not_attempted", "unconfirmed", "confirmed"].includes(
          credential.delivery as string,
        )
      )
        throw new Error("invalid");
      credentials.set(credential.credentialId, credential);
      issuanceIds.add(credential.operationId);
    }
    const initialization = state.initialization as Record<string, unknown>;
    const stage = initialization?.stage;
    const initialKeys =
      stage === "correlated"
        ? ["stage", "attemptId"]
        : stage === "user_stored"
          ? ["stage", "attemptId", "userId"]
          : stage === "credential_stored"
            ? [
                "stage",
                "attemptId",
                "userId",
                "credentialId",
                "receipt",
                "normalConnection",
              ]
            : [
                "stage",
                "attemptId",
                "initialUserId",
                "initialCredentialId",
                "delivery",
                "receipt",
                "normalConnection",
              ];
    requireClosedRecord(initialization, initialKeys);
    if (
      typeof initialization.attemptId !== "string" ||
      !UUID_PATTERN.test(initialization.attemptId)
    )
      throw new Error("invalid");
    if (
      stage !== "completed" &&
      (repositories.size !== 0 ||
        exposures.size !== 0 ||
        (state.unresolvedKeyExchanges as unknown[]).length !== 0)
    )
      throw new Error("invalid");
    if (stage === "correlated") {
      if (users.size !== 0 || credentials.size !== 0)
        throw new Error("invalid");
    } else if (stage === "user_stored" || stage === "credential_stored") {
      if (
        users.size !== 1 ||
        typeof initialization.userId !== "string" ||
        users.get(initialization.userId)?.role !== "administrator" ||
        (stage === "user_stored" && credentials.size !== 0)
      )
        throw new Error("invalid");
      if (stage === "credential_stored") {
        const credential = credentials.get(
          initialization.credentialId as string,
        );
        if (
          credentials.size !== 1 ||
          !credential ||
          credential.revoked !== false ||
          credential.userId !== initialization.userId ||
          credential.operationId !== initialization.attemptId ||
          !["unconfirmed", "confirmed"].includes(
            initialization.receipt as string,
          ) ||
          !["unconfirmed", "confirmed"].includes(
            initialization.normalConnection as string,
          ) ||
          (initialization.receipt === "confirmed" &&
            credential.delivery !== "confirmed") ||
          (initialization.normalConnection === "confirmed" &&
            initialization.receipt !== "confirmed")
        )
          throw new Error("invalid");
      }
    } else if (stage === "completed") {
      if (
        typeof initialization.initialUserId !== "string" ||
        !UUID_PATTERN.test(initialization.initialUserId) ||
        typeof initialization.initialCredentialId !== "string" ||
        !CREDENTIAL_PATTERN.test(initialization.initialCredentialId) ||
        initialization.delivery !== "confirmed" ||
        initialization.receipt !== "confirmed" ||
        initialization.normalConnection !== "confirmed"
      )
        throw new Error("invalid");
      const historicalCredential = credentials.get(
        initialization.initialCredentialId,
      );
      if (
        historicalCredential &&
        (historicalCredential.userId !== initialization.initialUserId ||
          historicalCredential.operationId !== initialization.attemptId ||
          historicalCredential.delivery !== "confirmed")
      )
        throw new Error("invalid");
    } else throw new Error("invalid");
    const exchangeIds = new Set<string>();
    const oldIds = new Set<string>();
    for (const value of state.unresolvedKeyExchanges as unknown[]) {
      const entry = value as Record<string, unknown>;
      const exchange = requireClosedRecord(value, [
        "stage",
        "recoveryId",
        "operationId",
        "entry",
        "scope",
        "recipientUserId",
        "oldCredentialIds",
        ...(entry?.stage === "credential_stored" ? ["newCredentialId"] : []),
      ]);
      if (
        !["prepared", "revoked", "credential_stored"].includes(
          exchange.stage as string,
        ) ||
        typeof exchange.operationId !== "string" ||
        !UUID_PATTERN.test(exchange.operationId) ||
        exchangeIds.has(exchange.operationId) ||
        exchange.operationId === initialization.attemptId ||
        exchange.recoveryId !==
          `access-management.key-exchange.${exchange.operationId}` ||
        !["workbench", "host"].includes(exchange.entry as string) ||
        !["targeted", "all"].includes(exchange.scope as string) ||
        typeof exchange.recipientUserId !== "string" ||
        !users.has(exchange.recipientUserId) ||
        !Array.isArray(exchange.oldCredentialIds)
      )
        throw new Error("invalid");
      exchangeIds.add(exchange.operationId);
      if (
        exchange.scope === "all" &&
        users.get(exchange.recipientUserId as string)?.role !== "administrator"
      )
        throw new Error("invalid");
      const activeCredentialIds = [...credentials.values()]
        .filter(
          (credential) =>
            credential.revoked === false &&
            (exchange.scope === "all" ||
              credential.userId === exchange.recipientUserId),
        )
        .map((credential) => credential.credentialId as string);
      if (
        exchange.stage === "prepared" &&
        (activeCredentialIds.length !== exchange.oldCredentialIds.length ||
          activeCredentialIds.some(
            (id) => !(exchange.oldCredentialIds as unknown[]).includes(id),
          ))
      )
        throw new Error("invalid");
      if (exchange.stage === "revoked" && activeCredentialIds.length !== 0)
        throw new Error("invalid");
      for (const id of exchange.oldCredentialIds) {
        const credential = credentials.get(id);
        if (
          !credential ||
          oldIds.has(id) ||
          (exchange.scope === "targeted" &&
            credential.userId !== exchange.recipientUserId) ||
          (exchange.stage === "prepared"
            ? credential.revoked !== false
            : credential.revoked !== true)
        )
          throw new Error("invalid");
        oldIds.add(id);
      }
      if (exchange.stage === "credential_stored") {
        const credential = credentials.get(exchange.newCredentialId as string);
        if (
          !credential ||
          credential.userId !== exchange.recipientUserId ||
          credential.operationId !== exchange.operationId ||
          credential.revoked !== false ||
          oldIds.has(exchange.newCredentialId as string) ||
          activeCredentialIds.length !== 1 ||
          activeCredentialIds[0] !== exchange.newCredentialId
        )
          throw new Error("invalid");
      } else if (issuanceIds.has(exchange.operationId))
        throw new Error("invalid");
    }
    return { status: "parsed", state: state as AccessManagementState };
  } catch {
    return { status: "invalid", reason: "state_schema_invalid" };
  }
}

/**
 * 内容Workspaceの固定語彙と重複なし集合を検査する。
 * @responsibility 管理操作等を内容範囲へ混入させない。
 * @trace ARCH-000013
 * @input JSON由来workspaceIds。
 * @returns N/A: 正常時に値を返さない。
 * @precondition JSON parse後だけ使用する。
 * @postcondition development／managementのみを重複なく含む。
 * @effect N/A: メモリ検査のみ。
 * @failure 不一致は親parserで固定拒否理由へ変換する。
 * @invariant 空集合は許可するが欠測を空へ変換しない。
 * @boundary 同Fileの状態検査。
 * @security 内容範囲の検査を実行Authorityにしない。
 * @concurrency N/A: 共有状態なし。
 */
function requireWorkspaceIds(value: unknown): void {
  if (
    !Array.isArray(value) ||
    new Set(value).size !== value.length ||
    value.some((item) => item !== "development" && item !== "management")
  )
    throw new Error("invalid");
}
