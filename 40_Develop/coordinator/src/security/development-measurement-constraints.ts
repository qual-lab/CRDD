/**
 * development-measurement-constraintsに属する責務をまとめる。
 *
 * @responsibility Providerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_DURATION_MS = 3_600_000;
const CONFIG_KEYS = new Set(["bindingSha256", "expiresAtMs", "tasks"]);
const TASK_KEYS = new Set(["scopeSha256", "executor", "reviewer"]);
const OBSERVATION_KEYS = new Set([
  "bindingSha256",
  "wallTimeMs",
  "monotonicTimeMs",
]);

/**
 * development-measurement-constraintsで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * development-measurement-constraintsで使用するRoleの値契約を定義する。
 *
 * @responsibility RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Roleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Roleで宣言した値と責務の対応を維持する。
 * @boundary N/A: Roleの宣言は外部境界を開かない。
 * @security RoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Roleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Role = "executor" | "reviewer";
/**
 * development-measurement-constraintsで使用するStop Reasonの値契約を定義する。
 *
 * @responsibility Stop ReasonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StopReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StopReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: StopReasonの宣言は外部境界を開かない。
 * @security StopReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StopReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StopReason =
  | "cancelled"
  | "expired"
  | "identity_mismatch"
  | "observation_invalid"
  | "cleanup_unknown";
/**
 * development-measurement-constraintsで使用するRefusalの値契約を定義する。
 *
 * @responsibility RefusalのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Refusalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Refusalで宣言した値と責務の対応を維持する。
 * @boundary N/A: Refusalの宣言は外部境界を開かない。
 * @security RefusalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Refusalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Refusal = StopReason | "task_unavailable" | "invocation_unavailable";
/**
 * development-measurement-constraintsで使用するConstraint 結果の値契約を定義する。
 *
 * @responsibility Constraint 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ConstraintResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConstraintResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConstraintResultの宣言は外部境界を開かない。
 * @security ConstraintResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConstraintResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ConstraintResult<T> =
  | Readonly<{ status: "recorded"; value: T }>
  | Readonly<{ status: "blocked"; reason: Refusal }>;
/**
 * development-measurement-constraintsで使用するObservationの値契約を定義する。
 *
 * @responsibility ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Observationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Observationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Observationの宣言は外部境界を開かない。
 * @security ObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Observationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Observation = Readonly<{
  bindingSha256: string;
  wallTimeMs: number;
  monotonicTimeMs: number;
}>;
/**
 * development-measurement-constraintsで使用するTask 状態の値契約を定義する。
 *
 * @responsibility Task 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskStateの宣言は外部境界を開かない。
 * @security TaskStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskState = {
  scopeSha256: string;
  executor: Provider;
  reviewer: Provider;
  token: object | null;
  settled: boolean;
  invocationCount: number;
  pendingCount: number;
};
/**
 * development-measurement-constraintsで使用するInvocation 状態の値契約を定義する。
 *
 * @responsibility Invocation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape InvocationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InvocationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: InvocationStateの宣言は外部境界を開かない。
 * @security InvocationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InvocationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InvocationState = {
  task: TaskState;
  provider: Provider;
  role: Role;
  phase: "reserved" | "consumed" | "settled";
};

/**
 * Observationを構造化値へ解析する。
 *
 * @responsibility Observationの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Observation | nullを返す。
 * @precondition 「raw: unknown」がparseObservationの入力契約を満たす。
 * @postcondition parseObservationの責務を完了した結果だけを返す。
 * @effect N/A: parseObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseObservationは独自の失敗分岐を所有しない。
 * @invariant parseObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseObservationはProcess内の同一Subsystemで完結する。
 * @security parseObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseObservationは共有非同期状態を持たない同期処理である。
 */
function parseObservation(raw: unknown): Observation | null {
  const record = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (
    !record ||
    typeof record.bindingSha256 !== "string" ||
    !HASH_PATTERN.test(record.bindingSha256) ||
    typeof record.wallTimeMs !== "number" ||
    !Number.isSafeInteger(record.wallTimeMs) ||
    record.wallTimeMs < 0 ||
    typeof record.monotonicTimeMs !== "number" ||
    !Number.isFinite(record.monotonicTimeMs) ||
    record.monotonicTimeMs < 0
  )
    return null;
  return Object.freeze({
    bindingSha256: record.bindingSha256,
    wallTimeMs: record.wallTimeMs,
    monotonicTimeMs: record.monotonicTimeMs,
  });
}

/**
 * refuseを決定する。
 *
 * @responsibility refuseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: Refusal
 * @returns ConstraintResult<never>を返す。
 * @precondition 「reason: Refusal」がrefuseの入力契約を満たす。
 * @postcondition refuseの責務を完了した結果だけを返す。
 * @effect N/A: refuseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: refuseは独自の失敗分岐を所有しない。
 * @invariant refuseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: refuseはProcess内の同一Subsystemで完結する。
 * @security refuseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: refuseは共有非同期状態を持たない同期処理である。
 */
function refuse(reason: Refusal): ConstraintResult<never> {
  return Object.freeze({ status: "blocked", reason });
}

/**
 * recordを決定する。
 *
 * @responsibility recordの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: T
 * @returns ConstraintResult<T>を返す。
 * @precondition 「value: T」がrecordの入力契約を満たす。
 * @postcondition recordの責務を完了した結果だけを返す。
 * @effect N/A: recordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recordは独自の失敗分岐を所有しない。
 * @invariant recordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recordはProcess内の同一Subsystemで完結する。
 * @security recordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recordは共有非同期状態を持たない同期処理である。
 */
function record<T>(value: T): ConstraintResult<T> {
  return Object.freeze({ status: "recorded", value });
}

/**
 * I/O-free accounting only. This factory neither authenticates approval/identity
 *
 * @responsibility Development Measurement Constraintsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、initialObservation: unknown
 * @returns createDevelopmentMeasurementConstraintsの計算結果を返す。
 * @precondition 「raw: unknown、initialObservation: unknown」がcreateDevelopmentMeasurementConstraintsの入力契約を満たす。
 * @postcondition createDevelopmentMeasurementConstraintsの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentMeasurementConstraintsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDevelopmentMeasurementConstraintsは独自の失敗分岐を所有しない。
 * @invariant createDevelopmentMeasurementConstraintsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentMeasurementConstraintsはProcess内の同一Subsystemで完結する。
 * @security createDevelopmentMeasurementConstraintsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDevelopmentMeasurementConstraintsは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentMeasurementConstraints(
  raw: unknown,
  initialObservation: unknown,
) {
  const config = snapshotPlainRecord(raw, CONFIG_KEYS);
  const initial = parseObservation(initialObservation);
  const taskSnapshots = snapshotPlainArray(config?.tasks, 2);
  if (
    !config ||
    !initial ||
    config.bindingSha256 !== initial.bindingSha256 ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs) ||
    config.expiresAtMs <= initial.wallTimeMs ||
    config.expiresAtMs - initial.wallTimeMs > MAX_DURATION_MS ||
    taskSnapshots.status !== "ok" ||
    taskSnapshots.value.length !== 2
  )
    return null;

  const tasks: TaskState[] = [];
  for (const rawTask of taskSnapshots.value) {
    const task = snapshotPlainRecord(rawTask, TASK_KEYS);
    if (
      !task ||
      typeof task.scopeSha256 !== "string" ||
      !HASH_PATTERN.test(task.scopeSha256) ||
      (task.executor !== "codex" && task.executor !== "claude") ||
      (task.reviewer !== "codex" && task.reviewer !== "claude") ||
      task.executor === task.reviewer ||
      tasks.some(
        (existing) =>
          existing.scopeSha256 === task.scopeSha256 ||
          existing.executor === task.executor,
      )
    )
      return null;
    tasks.push({
      scopeSha256: task.scopeSha256,
      executor: task.executor,
      reviewer: task.reviewer,
      token: null,
      settled: false,
      invocationCount: 0,
      pendingCount: 0,
    });
  }

  const expiresAtMs = config.expiresAtMs;
  const durationMs = expiresAtMs - initial.wallTimeMs;
  const bindingSha256 = initial.bindingSha256;
  const initialMonotonicTimeMs = initial.monotonicTimeMs;
  const taskTokens = new WeakMap<object, TaskState>();
  const invocationTokens = new WeakMap<object, InvocationState>();
  let activeTask: TaskState | null = null;
  let stopReason: StopReason | null = null;
  let lastObservation = initial;
  let invocationCount = 0;

  /**
   * Observationを検査する。
   *
   * @responsibility Observationの検査条件、違反分類、検査結果境界を所有する。
   * @trace ARCH-000004
   * @input rawObservation: unknown
   * @returns StopReason | nullを返す。
   * @precondition 「rawObservation: unknown」がcheckObservationの入力契約を満たす。
   * @postcondition checkObservationの責務を完了した結果だけを返す。
   * @effect N/A: checkObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: checkObservationは独自の失敗分岐を所有しない。
   * @invariant checkObservationは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: checkObservationはProcess内の同一Subsystemで完結する。
   * @security checkObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: checkObservationは共有非同期状態を持たない同期処理である。
   */
  function checkObservation(rawObservation: unknown): StopReason | null {
    if (stopReason) return stopReason;
    const observation = parseObservation(rawObservation);
    if (
      !observation ||
      observation.wallTimeMs < lastObservation.wallTimeMs ||
      observation.monotonicTimeMs < lastObservation.monotonicTimeMs
    ) {
      stopReason = "observation_invalid";
    } else if (observation.bindingSha256 !== bindingSha256) {
      stopReason = "identity_mismatch";
    } else {
      lastObservation = observation;
      if (
        observation.wallTimeMs >= expiresAtMs ||
        observation.monotonicTimeMs - initialMonotonicTimeMs >= durationMs
      )
        stopReason = "expired";
    }
    return stopReason;
  }

  return Object.freeze({
    productionAuthorityConferred: false as const,
    /**
     * development-measurement-constraintsを検査する。
     *
     * @responsibility development-measurement-constraintsの検査条件、違反分類、検査結果境界を所有する。
     * @trace ARCH-000004
     * @input observation: unknown
     * @returns checkの計算結果を返す。
     * @precondition 「observation: unknown」がcheckの入力契約を満たす。
     * @postcondition checkの責務を完了した結果だけを返す。
     * @effect N/A: checkは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: checkは独自の失敗分岐を所有しない。
     * @invariant checkは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: checkはProcess内の同一Subsystemで完結する。
     * @security checkはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: checkは共有非同期状態を持たない同期処理である。
     */
    check(observation: unknown) {
      const refusal = checkObservation(observation);
      return refusal ? refuse(refusal) : record(null);
    },
    /**
     * reserve Taskを決定する。
     *
     * @responsibility reserve Taskの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input scopeSha256: string、observation: unknown
     * @returns reserveTaskの計算結果を返す。
     * @precondition 「scopeSha256: string、observation: unknown」がreserveTaskの入力契約を満たす。
     * @postcondition reserveTaskの責務を完了した結果だけを返す。
     * @effect N/A: reserveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveTaskは独自の失敗分岐を所有しない。
     * @invariant reserveTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveTaskはProcess内の同一Subsystemで完結する。
     * @security reserveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveTaskは共有非同期状態を持たない同期処理である。
     */
    reserveTask(scopeSha256: string, observation: unknown) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const task = tasks.find((entry) => entry.scopeSha256 === scopeSha256);
      if (!task || task.token || activeTask) return refuse("task_unavailable");
      const token = Object.freeze({});
      task.token = token;
      taskTokens.set(token, task);
      activeTask = task;
      return record(token);
    },
    /**
     * reserve Invocationを決定する。
     *
     * @responsibility reserve Invocationの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input taskToken: object、provider: Provider、role: Role、observation: unknown
     * @returns reserveInvocationの計算結果を返す。
     * @precondition 「taskToken: object、provider: Provider、role: Role、observation: unknown」がreserveInvocationの入力契約を満たす。
     * @postcondition reserveInvocationの責務を完了した結果だけを返す。
     * @effect N/A: reserveInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveInvocationは独自の失敗分岐を所有しない。
     * @invariant reserveInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveInvocationはProcess内の同一Subsystemで完結する。
     * @security reserveInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveInvocationは共有非同期状態を持たない同期処理である。
     */
    reserveInvocation(
      taskToken: object,
      provider: Provider,
      role: Role,
      observation: unknown,
    ) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const task = taskTokens.get(taskToken);
      if (
        !task ||
        task !== activeTask ||
        task.settled ||
        task.pendingCount !== 0 ||
        (role !== "executor" && role !== "reviewer") ||
        task[role] !== provider ||
        task.invocationCount >= 4 ||
        invocationCount >= 8
      )
        return refuse("invocation_unavailable");
      const token = Object.freeze({});
      invocationTokens.set(token, { task, provider, role, phase: "reserved" });
      task.invocationCount += 1;
      task.pendingCount += 1;
      invocationCount += 1;
      return record(token);
    },
    /**
     * Invocationを一回限りで消費する。
     *
     * @responsibility Invocationの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
     * @trace ARCH-000004
     * @input invocationToken: object、taskToken: object、provider: Provider、role: Role、observation: unknown
     * @returns consumeInvocationの計算結果を返す。
     * @precondition 「invocationToken: object、taskToken: object、provider: Provider、role: Role、observation: unknown」がconsumeInvocationの入力契約を満たす。
     * @postcondition consumeInvocationの責務を完了した結果だけを返す。
     * @effect N/A: consumeInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: consumeInvocationは独自の失敗分岐を所有しない。
     * @invariant consumeInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: consumeInvocationはProcess内の同一Subsystemで完結する。
     * @security consumeInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: consumeInvocationは共有非同期状態を持たない同期処理である。
     */
    consumeInvocation(
      invocationToken: object,
      taskToken: object,
      provider: Provider,
      role: Role,
      observation: unknown,
    ) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const invocation = invocationTokens.get(invocationToken);
      if (
        invocation?.phase !== "reserved" ||
        invocation.task !== activeTask ||
        invocation.task !== taskTokens.get(taskToken) ||
        invocation.provider !== provider ||
        invocation.role !== role
      )
        return refuse("invocation_unavailable");
      invocation.phase = "consumed";
      return record(null);
    },
    // Settlement records that the caller finished its existing lifecycle; it
    // does not prove resource absence, perform cleanup, or refund a reservation.
    /**
     * Invocationを終端状態へ確定する。
     *
     * @responsibility Invocationの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input invocationToken: object
     * @returns settleInvocationの計算結果を返す。
     * @precondition 「invocationToken: object」がsettleInvocationの入力契約を満たす。
     * @postcondition settleInvocationの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationは独自の失敗分岐を所有しない。
     * @invariant settleInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationはProcess内の同一Subsystemで完結する。
     * @security settleInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationは共有非同期状態を持たない同期処理である。
     */
    settleInvocation(invocationToken: object) {
      const invocation = invocationTokens.get(invocationToken);
      if (!invocation || invocation.phase === "settled")
        return refuse("invocation_unavailable");
      invocation.phase = "settled";
      invocation.task.pendingCount -= 1;
      return record(null);
    },
    /**
     * Taskを終端状態へ確定する。
     *
     * @responsibility Taskの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskToken: object、outcome: "finished" | "cleanup_unknown"
     * @returns settleTaskの計算結果を返す。
     * @precondition 「taskToken: object、outcome: "finished" | "cleanup_unknown"」がsettleTaskの入力契約を満たす。
     * @postcondition settleTaskの責務を完了した結果だけを返す。
     * @effect N/A: settleTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleTaskは独自の失敗分岐を所有しない。
     * @invariant settleTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleTaskはProcess内の同一Subsystemで完結する。
     * @security settleTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleTaskは共有非同期状態を持たない同期処理である。
     */
    settleTask(taskToken: object, outcome: "finished" | "cleanup_unknown") {
      const task = taskTokens.get(taskToken);
      if (
        !task ||
        task !== activeTask ||
        task.settled ||
        (outcome !== "finished" && outcome !== "cleanup_unknown") ||
        (outcome === "finished" && task.pendingCount !== 0)
      )
        return refuse("task_unavailable");
      if (outcome === "cleanup_unknown" && !stopReason)
        stopReason = "cleanup_unknown";
      task.settled = true;
      activeTask = null;
      return record(null);
    },
    /**
     * development-measurement-constraintsを取り消す。
     *
     * @responsibility development-measurement-constraintsの取消条件、終了状態、残存Effectの境界を所有する。
     * @trace ARCH-000004
     * @input N/A: 実行時引数を受け取らない。
     * @returns N/A: cancelは戻り値を返さない。
     * @precondition 「N/A: 実行時引数を受け取らない。」がcancelの入力契約を満たす。
     * @postcondition cancelの責務を完了して呼出し元へ制御を戻す。
     * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: cancelは独自の失敗分岐を所有しない。
     * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: cancelはProcess内の同一Subsystemで完結する。
     * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: cancelは共有非同期状態を持たない同期処理である。
     */
    cancel() {
      stopReason ??= "cancelled";
    },
    /**
     * development-measurement-constraintsを観測する。
     *
     * @responsibility development-measurement-constraintsの観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000004
     * @input N/A: 実行時引数を受け取らない。
     * @returns inspectの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がinspectの入力契約を満たす。
     * @postcondition inspectの責務を完了した結果だけを返す。
     * @effect N/A: inspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: inspectは独自の失敗分岐を所有しない。
     * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: inspectはProcess内の同一Subsystemで完結する。
     * @security inspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
     */
    inspect() {
      return Object.freeze({
        productionAuthorityConferred: false as const,
        invocationCount,
        reservedTaskCount: tasks.filter((task) => task.token !== null).length,
        settledTaskCount: tasks.filter((task) => task.settled).length,
        stopReason,
      });
    },
  });
}
