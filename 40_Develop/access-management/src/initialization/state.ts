/**
 * 保存済み初回段階を非Authorityの現在状態へ投影する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  CURRENT,
  locked,
  PENDING,
  present,
  REPLACE,
  readCurrent,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";

/**
 * 初回の再入場に必要な非秘密の保存観測を表す。
 * @responsibility AM入力不存在・進行段階・既存・観測不能を分離する。
 * @trace ARCH-000013
 * @shape fresh／existing／unknown、または段階別のin_progressと元試行・改訂・生成済みID。
 * @invariant freshはAM入力だけの不存在で、旧CROS入力不存在やHost初期化Authorityではない。
 * @boundary 信頼されたHost内部OwnerとAM保存Owner。MCP／HTTPへ公開しない。
 * @security Secret・salt・Verifier・Root・User一覧を含めない。
 * @compatibility v2だけ。旧形式を補完・変換しない。
 */
export type HostInitializationStateResult =
  | Readonly<{ status: "fresh" }>
  | Readonly<{ status: "existing" }>
  | Readonly<{
      status: "unknown";
      reason: "host_initialization_state_unavailable";
    }>
  | (Readonly<{ status: "in_progress"; attemptId: string; revision: number }> &
      (
        | Readonly<{ stage: "correlated" }>
        | Readonly<{ stage: "user_stored"; userId: string }>
        | Readonly<{
            stage: "credential_stored";
            userId: string;
            initialCredentialId: string;
            confirmationCredentialId: string;
            presentation: "not_attempted" | "unconfirmed" | "confirmed";
            unresolvedExchange: boolean;
          }>
      ));

/**
 * 検査済み現在状態からHost再入場に必要な項目だけを選ぶ。
 * @responsibility 元試行・生成済みID・提示段階を保持して追加生成を防ぐ。
 * @trace ARCH-000013
 * @input 同LockでSchema検査・保存材料処置済みの完全Snapshot。
 * @returns 所有済み段階投影。完了済みはexistingだけ。
 * @precondition 保存Ownerがv2を検査済み。任意値用のParserではない。
 * @postcondition 状態を変更せず、未生成User／資格のfieldを追加しない。
 * @effect N/A: メモリ値の選択だけ。
 * @failure 確認資格の欠測はunknown。
 * @invariant completedを再初期化候補に戻さず、資格保存段階を再表示許可にしない。
 * @boundary 完全内部SnapshotからHost専用非秘密投影。
 * @security 認証・通常管理・初回開始のAuthorityを発行しない。
 * @concurrency 保存Ownerが同じLock内で使用し、後続保存はfresh照合する。
 */
export function projectHostInitializationState(
  state: AccessManagementState,
): HostInitializationStateResult {
  const initial = state.initialization;
  if (initial.stage === "completed")
    return Object.freeze({ status: "existing" });
  const common = {
    status: "in_progress" as const,
    attemptId: initial.attemptId,
    revision: state.revision,
  };
  if (initial.stage === "correlated")
    return Object.freeze({ ...common, stage: initial.stage });
  if (initial.stage === "user_stored")
    return Object.freeze({
      ...common,
      stage: initial.stage,
      userId: initial.userId,
    });
  const credential = state.credentials.find(
    (item) => item.credentialId === initial.confirmationCredentialId,
  );
  if (!credential)
    return Object.freeze({
      status: "unknown",
      reason: "host_initialization_state_unavailable",
    });
  return Object.freeze({
    ...common,
    stage: initial.stage,
    userId: initial.userId,
    initialCredentialId: initial.initialCredentialId,
    confirmationCredentialId: initial.confirmationCredentialId,
    presentation: credential.presentation,
    unresolvedExchange: state.unresolvedKeyExchanges.length !== 0,
  });
}

/**
 * 初回状態に対応する開始条件と次の処置を表す。
 *
 * @responsibility 分類と処置の組合せを閉じ、途中や不明の新規開始を表現しない。
 * @trace ARCH-000013
 * @shape 四状態とcanStart、状態に対応するnextActionの判別共用体。
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
      state: "in_progress";
      canStart: false;
      nextAction: "observe_attempt";
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
 * 管理状態と進行試行の観測分類から初回開始条件を判定する。
 *
 * @responsibility 双方未初期化確認と明示開始だけを開始候補にし、途中・既存・不明を分離する。
 * @trace ARCH-000013
 * @input 管理観測uninitialized／same_attempt／existing／unknown、試行観測absent／confirmed／unknown、Booleanの明示開始。
 * @returns 四状態と形式上のcanStart、対応する次の処置。
 * @precondition 呼出側が同一Root・保存Ownerの排他下で観測する。absentは確認済み不存在、confirmedは進行試行、same_attemptは同元試行との照合済み分類。
 * @postcondition 欠測・不正型・矛盾はunknownで停止し、暗黙変換や入力変更を行わない。
 * @effect N/A: primitive比較と返却値の構築だけで、UUID・鍵・Filesystem操作を持たない。
 * @failure 観測不能と相関不一致をunknownとして保持する。外部故障の発生原因は呼出側が保持する。
 * @invariant 未初期化からの作成と、途中からの元試行再観測を同じ処置にしない。
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
  if (
    (managementObservation === "uninitialized" ||
      managementObservation === "same_attempt") &&
    attemptObservation === "confirmed"
  )
    return {
      state: "in_progress",
      canStart: false,
      nextAction: "observe_attempt",
    };
  if (managementObservation === "existing" && attemptObservation === "absent")
    return {
      state: "existing",
      canStart: false,
      nextAction: "reject_initialization",
    };
  return { state: "unknown", canStart: false, nextAction: "stop" };
}

/**
 * 保存済みの初回元試行と段階をHost再入場へ返す。
 * @responsibility AM入力不存在と観測不能を区別し、same exact試行の再開を支える。
 * @trace ARCH-000013
 * @input 信頼されたHost Ownerの検証済み管理Root。
 * @returns 非Authorityなfresh／in_progress／existing、または固定unknown。
 * @precondition Host専用内部利用。旧入力・旧Writer停止・Root準備はHost切替Ownerが別に確認する。
 * @postcondition 完全状態・既知pending処置・Lock終了後だけ段階を返す。
 * @effect 既存Lock、current／pending／replaceの観測、既知出版材料のexact清掃。
 * @failure partial・base初回材料・孤立replace・旧版・解放不明はunknown。
 * @invariant UUID・鍵・User生成0、Secret再取得0。freshは初期化許可ではない。
 * @boundary 同Lock保存OwnerからHost内部再入場。公開状態照会ではない。
 * @security Secret・Verifier・salt・Root・Lock回復参照を返さない。
 * @concurrency 既存Writerと同じLock内の一改訂。旧CROS Writerへの排他は主張しない。
 */
export function readHostInitializationState(
  root: FilesystemStoreRoot,
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
      settlePending(root, current, () => {
        publication = "confirmed";
      });
      const value = projectHostInitializationState(current.state);
      if (value.status === "unknown")
        throw new Error("initial_projection_unknown");
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
