/**
 * 最初の管理者の保存と初期化状態の出版を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { randomUUID } from "node:crypto";
import {
  prepareHostInitializationRoot,
  type CrosRootInput,
  type FilesystemStoreRoot,
} from "./root.ts";
import { locked } from "../storage/lock.ts";
import {
  isAccountIssuer,
  isAccountSubject,
  parseAccessManagementState,
} from "../storage/parse.ts";
import {
  CURRENT,
  PENDING,
  present,
  REPLACE,
  readCurrent,
  serialize,
  writeExclusive,
} from "../storage/store.ts";
import type {
  AccessManagementState,
  StateStoreResult,
} from "../storage/types.ts";

/**
 * Hostで確認済みの外部主体を最初の管理者として一回だけ保存する。
 * @trace ARCH-000013
 * @boundary 本人確認とHost端末での明示確認は呼出し側。HTTPやMCPから直接利用しない。
 * @effect 同じ保存Lockの下で初回stateだけを作る。鍵の発行・旧状態の更新は行わない。
 */
export function initializeAdministratorFromHost(
  input: CrosRootInput,
  username: string,
  identity: Readonly<{ issuer: string; subject: string }>,
  signal: AbortSignal,
): StateStoreResult<
  Readonly<{ revision: number; attemptId: string; created: boolean }>
> {
  const rejected = {
    status: "unavailable",
    reason: "state_store_initialization_input_rejected",
    publication: "not_attempted",
    revision: null,
    cleanupConfirmed: true,
  } as const;
  if (
    signal.aborted ||
    typeof username !== "string" ||
    username !== username.trim() ||
    [...username].length < 1 ||
    [...username].length > 128 ||
    /[\p{Cc}\p{Cs}]/u.test(username) ||
    !identity ||
    !isAccountIssuer(identity.issuer) ||
    !isAccountSubject(identity.subject)
  )
    return rejected;
  const subject = identity.subject;
  const prepared = prepareHostInitializationRoot(input);
  if (prepared.status !== "ready")
    return {
      ...rejected,
      reason: "host_account_initialization_root_unavailable",
      cleanupConfirmed: false,
    };
  return storeInitialState(
    prepared.root,
    () => {
      const attemptId = randomUUID();
      const userId = randomUUID();
      const state: AccessManagementState = {
        contract: "crdd-access-management/state",
        schemaRevision: 4,
        revision: 1,
        operationId: attemptId,
        users: [
          {
            userId,
            username,
            role: "administrator",
            accountLinks: [
              { issuer: identity.issuer, subject, bindingId: randomUUID() },
            ],
          },
        ],
        registeredRepositories: [],
        initialization: {
          stage: "completed",
          attemptId,
          initialUserId: userId,
          connection: "account_confirmed",
        },
      };
      return state;
    },
    prepared.isCurrent,
    signal,
  );
}

/** 初回保存の排他と保存先の実体確認、完全読戻しを行う。 */
function storeInitialState(
  root: FilesystemStoreRoot,
  build: () => AccessManagementState,
  isCurrent: () => boolean,
  signal: AbortSignal,
): StateStoreResult<
  Readonly<{ revision: number; attemptId: string; created: boolean }>
> {
  return locked<
    Readonly<{ revision: number; attemptId: string; created: boolean }>
  >(root, () => {
    let publication: "not_attempted" | "unconfirmed" | "confirmed" =
      "not_attempted";
    let revision: number | null = null;
    try {
      if (present(root, PENDING) || present(root, REPLACE))
        return {
          status: "unavailable",
          reason: "state_store_initialization_material_present",
          publication,
          revision,
          cleanupConfirmed: false,
        };
      if (present(root, CURRENT))
        return {
          status: "unavailable",
          reason: "state_store_initialization_current_conflict",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      const baseline = build();
      const expected = serialize(baseline);
      if (parseAccessManagementState(expected).status !== "parsed")
        throw new Error("initial_state_invalid");
      if (!isCurrent() || signal.aborted)
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
        value: {
          revision: 1,
          attemptId: baseline.initialization.attemptId,
          created: true,
        },
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
