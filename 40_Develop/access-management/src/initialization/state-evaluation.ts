/**
 * 初回Host設定の観測分類と明示開始条件を評価する。
 *
 * @responsibility 確認済み未初期化、途中、既存、観測不能を純粋計算で区別する。
 * @trace ARCH-000013
 */

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
