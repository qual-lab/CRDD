/**
 * storage/parseの処理を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { isAbsolute } from "node:path";
import { types } from "node:util";
import { deriveRepositoryBindingId } from "../repository/binding.ts";
import type { GitHostLinkedRepository } from "../repository/types.ts";
import type { AccessManagementState } from "./types.ts";

export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/** 検証済み外部主体IDの保存形式。本人性は判定しない。 @trace ARCH-000013 */
export function isAccountSubject(value: unknown): value is string {
  return typeof value === "string" && /^[!-~]{1,255}$/u.test(value);
}

/** 発行者の保存形式だけを検査する。発行者の信頼性は受付側で検証する。 */
export function isAccountIssuer(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^https:\/\/[!-~]{1,2040}$/u.test(value) ||
    /[?#\\]/u.test(value)
  )
    return false;
  const authority = value.slice(8).split("/", 1)[0];
  const parsed = URL.parse(value);
  return Boolean(authority && !authority.includes("@") && parsed);
}

export function isInvitationEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(
      value,
    )
  );
}

export function isInvitationDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

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
type StateParseResult =
  | { status: "parsed"; state: AccessManagementState }
  | {
      status: "invalid";
      reason:
        | "state_input_invalid"
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

function ownDataRecord(value: unknown, limit: number) {
  if (!value || typeof value !== "object" || types.isProxy(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length > limit) return null;
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    if (typeof key !== "string") return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
}

/** 提供元の参照を補完せず検査し、保存用の独立値として返す。 */
export function captureGitHostReference(
  value: unknown,
): GitHostLinkedRepository | null {
  const reference = ownDataRecord(value, 4);
  if (
    !reference ||
    !["provider", "host", "repositoryId", "providerData"].every((name) =>
      Object.hasOwn(reference, name),
    )
  )
    return null;
  const { provider, host, repositoryId, providerData } = reference;
  if (
    typeof provider !== "string" ||
    !/^[a-z][a-z0-9-]{0,31}$/u.test(provider) ||
    typeof host !== "string" ||
    host.length > 253 ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z0-9]+$/u.test(host) ||
    typeof repositoryId !== "string" ||
    !/^[!-~]{1,255}$/u.test(repositoryId)
  )
    return null;
  const data = ownDataRecord(providerData, 16);
  if (!data) return null;
  const entries: [string, string][] = [];
  for (const [key, item] of Object.entries(data)) {
    if (
      !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/u.test(key) ||
      typeof item !== "string" ||
      !/^[!-~]{1,255}$/u.test(item)
    )
      return null;
    entries.push([key, item]);
  }
  return {
    provider,
    host,
    repositoryId,
    providerData: Object.fromEntries(entries),
  };
}

/**
 * 管理状態のraw bytesを完全検査する。
 * @responsibility 入力型、strict UTF-8、閉Schema、現在・歴史参照と段階相関を検査する。
 * @trace ARCH-000013
 * @input Uint8ArrayのUTF-8 JSON。固定byte上限は持たない。
 * @returns 新しく所有した状態または固定拒否理由。
 * @precondition 保存Readerは別にRoot・実体同一性・Lockを確認する。
 * @postcondition 不正入力にSnapshotを返さず、変換・補完・旧形式fallbackをしない。
 * @effect N/A: I/O・鍵生成・認可・保存なし。
 * @failure 文字コード、Schema・参照不一致を区別する。
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
      "registeredRepositories",
      "initialization",
    ]);
    if (
      state.contract !== "crdd-access-management/state" ||
      state.schemaRevision !== 4 ||
      !Number.isSafeInteger(state.revision) ||
      (state.revision as number) < 1 ||
      typeof state.operationId !== "string" ||
      !UUID_V4.test(state.operationId)
    )
      throw new Error("invalid");
    for (const key of ["users", "registeredRepositories"])
      if (!Array.isArray(state[key])) throw new Error("invalid");
    const users = new Map<string, Record<string, unknown>>();
    const accountIdentities = new Set<string>();
    const accountBindingIds = new Set<string>();
    const invitationDigests = new Set<string>();
    for (const value of state.users as unknown[]) {
      const hasLinks =
        value !== null &&
        typeof value === "object" &&
        Object.hasOwn(value, "accountLinks");
      const hasInvitation =
        value !== null &&
        typeof value === "object" &&
        Object.hasOwn(value, "invitation");
      if (hasLinks && hasInvitation) throw new Error("invalid");
      const user = requireClosedRecord(value, [
        "userId",
        "username",
        "role",
        ...(hasLinks ? ["accountLinks"] : []),
        ...(hasInvitation ? ["invitation"] : []),
      ]);
      if (
        typeof user.userId !== "string" ||
        !UUID_V4.test(user.userId) ||
        users.has(user.userId) ||
        typeof user.username !== "string" ||
        user.username !== user.username.trim() ||
        [...user.username].length < 1 ||
        [...user.username].length > 128 ||
        /[\p{Cc}\p{Cs}]/u.test(user.username) ||
        !["developer", "manager", "administrator"].includes(user.role as string)
      )
        throw new Error("invalid");
      if (hasLinks) {
        if (!Array.isArray(user.accountLinks) || user.accountLinks.length === 0)
          throw new Error("invalid");
        const issuers = new Set<string>();
        for (const link of user.accountLinks) {
          const { issuer, subject, bindingId } = requireClosedRecord(link, [
            "issuer",
            "subject",
            "bindingId",
          ]);
          if (
            !isAccountIssuer(issuer) ||
            !isAccountSubject(subject) ||
            typeof bindingId !== "string" ||
            !UUID_V4.test(bindingId) ||
            issuers.has(issuer) ||
            accountBindingIds.has(bindingId)
          )
            throw new Error("invalid");
          const identity = JSON.stringify([issuer, subject]);
          if (accountIdentities.has(identity)) throw new Error("invalid");
          issuers.add(issuer);
          accountIdentities.add(identity);
          accountBindingIds.add(bindingId);
        }
      }
      if (hasInvitation) {
        const invitation = requireClosedRecord(user.invitation, [
          "email",
          "digest",
          "expiresAt",
        ]);
        if (
          !isInvitationEmail(invitation.email) ||
          !isInvitationDigest(invitation.digest) ||
          invitationDigests.has(invitation.digest) ||
          typeof invitation.expiresAt !== "number" ||
          !Number.isSafeInteger(invitation.expiresAt) ||
          invitation.expiresAt <= 0
        )
          throw new Error("invalid");
        invitationDigests.add(invitation.digest);
      }
      users.set(user.userId, user);
    }
    const repositories = new Set<string>();
    const bindings = new Set<string>();
    for (const value of state.registeredRepositories as unknown[]) {
      const repository = requireClosedRecord(value, [
        "repositoryId",
        "repositoryRoot",
        "bindingId",
        "hostedRepository",
      ]);
      if (
        typeof repository.repositoryId !== "string" ||
        !RESOURCE_ID.test(repository.repositoryId) ||
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
      const expectedBinding = deriveRepositoryBindingId(
        repository.repositoryId,
        repository.repositoryRoot,
      );
      if (repository.bindingId !== expectedBinding) throw new Error("invalid");
      if (!captureGitHostReference(repository.hostedRepository))
        throw new Error("invalid");
    }
    const initialization = requireClosedRecord(state.initialization, [
      "stage",
      "attemptId",
      "initialUserId",
      "connection",
    ]);
    if (
      initialization.stage !== "completed" ||
      initialization.connection !== "account_confirmed" ||
      typeof initialization.attemptId !== "string" ||
      !UUID_V4.test(initialization.attemptId) ||
      typeof initialization.initialUserId !== "string" ||
      !UUID_V4.test(initialization.initialUserId)
    )
      throw new Error("invalid");
    const initialUser = users.get(initialization.initialUserId);
    const links = initialUser?.accountLinks;
    if (
      state.revision === 1 &&
      (state.operationId !== initialization.attemptId ||
        users.size !== 1 ||
        initialUser?.role !== "administrator" ||
        !Array.isArray(links) ||
        links.length !== 1 ||
        repositories.size !== 0)
    )
      throw new Error("invalid");
    return { status: "parsed", state: state as AccessManagementState };
  } catch {
    return { status: "invalid", reason: "state_schema_invalid" };
  }
}
