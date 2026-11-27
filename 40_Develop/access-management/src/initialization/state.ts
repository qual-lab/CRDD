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
 * 初回状態に対応する開始条件と次の処置を表す。
 *
 * @responsibility 分類と処置の組合せを閉じ、途中や不明の新規開始を表現しない。
 * @trace ARCH-000013
 * @shape 三状態とcanStart、状態に対応するnextActionの判別共用体。
 * @invariant canStartがtrueなのは未初期化と明示開始が揃う場合だけ。
 * @boundary Access Management内の純粋判定。外部公開Schemaではない。
 * @security 開始条件の分類であり、Host信頼・Root・排他・保存・鍵EffectのAuthorityではない。
 * @compatibility 旧bootstrapや通常管理の固定Role判定とは別契約。
 */
export type HostInitializationDecision =
  | Readonly<{
      state: "uninitialized";
      canStart: true;
      nextAction: "start";
    }>
  | Readonly<{
      state: "uninitialized";
      canStart: false;
      nextAction: "await_explicit_start";
    }>
  | Readonly<{
      state: "existing";
      canStart: false;
      nextAction: "reject_initialization";
    }>
  | Readonly<{
      state: "unknown";
      canStart: false;
      nextAction: "stop";
    }>;

/**
 * 管理状態と旧材料の観測分類から初回開始条件を判定する。
 *
 * @responsibility 双方未初期化確認と明示開始だけを開始候補にし、既存と観測不能を分離する。
 * @trace ARCH-000013
 * @input 管理観測uninitialized／existing／unknown、試行観測absent／unknown、Booleanの明示開始。
 * @returns 三状態と形式上のcanStart、対応する次の処置。
 * @precondition 呼出側が同一Root・保存Ownerの排他下で観測する。absentは確認済み不存在。
 * @postcondition 欠測・不正型・矛盾はunknownで停止し、暗黙変換や入力変更を行わない。
 * @effect N/A: primitive比較と返却値の構築だけで、UUID・鍵・Filesystem操作を持たない。
 * @failure 観測不能と相関不一致をunknownとして保持する。外部故障の発生原因は呼出側が保持する。
 * @invariant 旧形式の途中試行は再開しない。
 * @boundary 観測分類の純粋計算。物理観測・保存・認証・Host入口には未接続。
 * @security canStartから処理Authorityを発行しない。実処置前には現在Host・Root・排他・相関確定を別に確認する。
 * @concurrency N/A: 共有状態を保持せず、観測の現在性は保存Ownerが確認する。
 */
export function evaluateHostInitializationState(
  managementObservation: unknown,
  attemptObservation: unknown,
  isStartRequested: unknown,
): HostInitializationDecision {
  if (typeof isStartRequested !== "boolean")
    return { state: "unknown", canStart: false, nextAction: "stop" };
  if (
    managementObservation === "uninitialized" &&
    attemptObservation === "absent"
  ) {
    return isStartRequested
      ? { state: "uninitialized", canStart: true, nextAction: "start" }
      : {
          state: "uninitialized",
          canStart: false,
          nextAction: "await_explicit_start",
        };
  }
  if (managementObservation === "existing" && attemptObservation === "absent")
    return {
      state: "existing",
      canStart: false,
      nextAction: "reject_initialization",
    };
  return { state: "unknown", canStart: false, nextAction: "stop" };
}

/**
 * 現行保存の有無をHostへ返す。
 * @responsibility AM入力の不存在・既存・観測不能を区別する。
 * @trace ARCH-000013
 * @input 信頼されたHost Ownerの検証済み管理Root。
 * @returns 非Authorityなfresh／existing、または固定unknown。
 * @precondition Host専用内部利用。旧入力・旧Writer停止・Root準備はHost切替Ownerが別に確認する。
 * @postcondition 完全状態・既知pending処置・Lock終了後だけ段階を返す。
 * @effect 既存Lock、current／pending／replaceの観測、既知出版材料のexact清掃。
 * @failure 不完全・孤立した保存途中の材料、旧版、解放不明はunknown。
 * @invariant UUID・鍵・User生成0、Secret再取得0。freshは初期化許可ではない。
 * @boundary 同Lock保存OwnerからHost内部再入場。公開状態照会ではない。
 * @security Secret・Verifier・salt・Root・Lock回復参照を返さない。
 * @concurrency 既存Writerと同じLock内の一改訂。旧CROS Writerへの排他は主張しない。
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
