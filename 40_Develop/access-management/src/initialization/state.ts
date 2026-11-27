/**
 * 保存済み初回段階を非Authorityの現在状態へ投影する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "./root.ts";
import {
  CURRENT,
  PENDING,
  present,
  REPLACE,
  readCurrent,
  settlePending,
} from "../storage/store.ts";
import { locked } from "../storage/lock.ts";

/**
 * 初回の再入場に必要な非秘密の保存観測を表す。
 * @responsibility AM入力不存在・進行段階・既存・観測不能を分離する。
 * @trace ARCH-000013
 * @shape fresh／existing／unknown。
 * @invariant freshはAM入力だけの不存在で、旧CROS入力不存在やHost初期化Authorityではない。
 * @boundary 信頼されたHost内部OwnerとAM保存Owner。MCP／HTTPへ公開しない。
 * @security Secret・salt・Verifier・Root・User一覧を含めない。
 * @compatibility 現行保存形式だけ。旧形式を補完・変換しない。
 */
export type HostInitializationStateResult =
  | Readonly<{ status: "fresh" }>
  | Readonly<{
      status: "existing";
      connection: "account_confirmed";
      administratorLinked?: boolean;
    }>
  | Readonly<{
      status: "unknown";
      reason: "host_initialization_state_unavailable";
    }>;

/**
 * 現行保存の有無をHostへ返す。
 * @responsibility AM入力の不存在・既存・観測不能を区別する。
 * @trace ARCH-000013
 * @input 信頼されたHost Ownerの検証済み管理Root。
 * @returns 非Authorityなfresh／existing、または固定unknown。
 * @precondition Host専用内部利用。Root準備はHost入口が担当する。
 * @postcondition 完全状態・既知pending処置・Lock終了後だけ段階を返す。
 * @effect 既存Lock、current／pending／replaceの観測、既知出版材料のexact清掃。
 * @failure 不完全・孤立した保存途中の材料、旧版、解放不明はunknown。
 * @invariant UUID・鍵・User生成0、Secret再取得0。freshは初期化許可ではない。
 * @boundary 同Lock保存OwnerからHost内部再入場。公開状態照会ではない。
 * @security Secret・Verifier・salt・Root・Lock回復参照を返さない。
 * @concurrency 現行Writerと同じLock内の一改訂。
 */
export function readHostInitializationState(
  root: FilesystemStoreRoot,
  options?: Readonly<{
    settlePending?: false;
    acceptsAdministratorIssuer?: (issuer: string) => boolean;
  }>,
): HostInitializationStateResult {
  const result = locked<HostInitializationStateResult>(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    try {
      if (!present(root, CURRENT)) {
        if (present(root, PENDING) || present(root, REPLACE))
          throw new Error("initial_material_present");
        return {
          status: "completed",
          value: Object.freeze({ status: "fresh" }),
          publication,
          revision,
          cleanupConfirmed: true,
        };
      }
      const current = readCurrent(root);
      revision = current.state.revision;
      if (options?.settlePending === false) {
        if (present(root, PENDING) || present(root, REPLACE))
          throw new Error("initial_material_present");
      } else
        settlePending(root, current, () => {
          publication = "confirmed";
        });
      const initialization = Object.freeze({
        status: "existing" as const,
        connection: current.state.initialization.connection,
      });
      const acceptsIssuer = options?.acceptsAdministratorIssuer;
      const value = acceptsIssuer
        ? Object.freeze({
            ...initialization,
            administratorLinked: current.state.users.some(
              (user) =>
                user.role === "administrator" &&
                user.accountLinks?.some(({ issuer }) => acceptsIssuer(issuer)),
            ),
          })
        : initialization;
      return {
        status: "completed",
        value,
        publication,
        revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "host_initialization_state_unavailable",
        publication,
        revision,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? result.value
    : { status: "unknown", reason: "host_initialization_state_unavailable" };
}
