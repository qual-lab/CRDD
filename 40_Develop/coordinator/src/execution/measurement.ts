/**
 * 開発検証の計測・限定Session・Source観測を所有する。
 *
 * @responsibility 観測値と実行許可を分け、同じSession内の予約・期限・取消・Operation結合を維持する。
 * @trace ARCH-000018
 */

import { createHash } from "node:crypto";
import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readSync,
  realpathSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import {
  getRepository,
  readRepositorySnapshot,
} from "../../../version-control/src/index.ts";
import { snapshotPlainArray, snapshotPlainRecord } from "../input/snapshot.ts";
import {
  bindOwnedDevelopmentOperationContext,
  borrowRuntimeOwnedRepositorySource,
  type DevelopmentOperationContext,
  verifyOwnedOperationManagementCapability,
} from "./operation.ts";
import { isRuntimeProcessPoisoned } from "./process-safety-state.ts";
import { snapshotCoordinatorTaskRequest } from "./request.ts";

const STATE_LABELS = Object.freeze({
  "STATE-ADMISSION": "受付・実行条件の確認",
  "STATE-OPERATION-ACQUIRING": "作業領域と排他制御の準備",
  "STATE-OPERATION-READY": "権限・送信許可・入力の準備",
  "STATE-TASK-AUTHORIZED": "実装段階（起動準備・回収を含む）",
  "STATE-EXECUTOR-CLEAN": "実装候補の取得・検証",
  "STATE-CANDIDATE-CAPTURED": "レビュー段階（起動準備・回収を含む）",
  "STATE-REVIEWER-CLEAN": "レビュー結果の確認・候補保存",
  "STATE-REMEDIATION-AUTHORIZED": "是正実装の準備・実行・回収",
  "STATE-REMEDIATION-EXECUTOR-CLEAN": "是正候補の取得・検証",
  "STATE-REMEDIATION-CANDIDATE-CAPTURED": "再レビューの準備・実行・回収",
  "STATE-REMEDIATION-REVIEWER-CLEAN": "再レビュー結果の確認・候補保存",
  "STATE-HOST-CLEAN": "結果の公開条件確認",
  "STATE-RESULT-PUBLISHED": "比較用候補の破棄・終了記録",
  "STATE-BLOCKED-CLEAN": "停止結果の記録（回収確認済み）",
  "STATE-PROCESS-RESTART-REQUIRED": "停止結果の記録（再起動が必要）",
  "STATE-RECOVERY-REQUIRED": "停止結果の記録（復旧が必要）",
  "STATE-OPERATOR-TRANSFER-REQUIRED": "停止結果の記録（人間への引渡しが必要）",
});

/**
 * development-execution-timingで使用するIntervalの値契約を定義する。
 *
 * @responsibility IntervalのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000018
 * @shape Intervalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Intervalで宣言した値と責務の対応を維持する。
 * @boundary N/A: Intervalの宣言は外部境界を開かない。
 * @security N/A: IntervalはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Intervalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Interval = Readonly<{
  state: string;
  elapsedMs: number | null;
}>;

/**
 * 観測用の計測だけを構築し、Authority用時計・Timer・Listener・Capabilityを追加しない。
 *
 * @responsibility Development Execution Timingの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000018
 * @input now: () => number、writeProgress: (text: string) => boolean
 * @returns createDevelopmentExecutionTimingの計算結果を返す。
 * @precondition 「now: () => number、writeProgress: (text: string) => boolean」がcreateDevelopmentExecutionTimingの入力契約を満たす。
 * @postcondition createDevelopmentExecutionTimingの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentExecutionTimingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDevelopmentExecutionTimingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDevelopmentExecutionTimingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentExecutionTimingはProcess内の同一Subsystemで完結する。
 * @security N/A: createDevelopmentExecutionTimingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDevelopmentExecutionTimingは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentExecutionTiming(
  now: () => number = () => performance.now(),
  writeProgress?: (text: string) => boolean,
) {
  let measurementComplete = true;
  let progressConfirmed = true;
  let isFinished = false;
  let previousTime: number | null = null;
  let stateStartedAt: number | null = null;
  let currentState: string | null = null;
  let firstStateAt: number | null = null;
  let finishedAt: number | null = null;
  let identityCount = 0;
  let identityElapsedMs = 0;
  let identityMeasurementComplete = true;
  const intervals: Interval[] = [];

  /**
   * Timeを読み取る。
   *
   * @responsibility Timeの読取り元、上限、読取不能時の結果境界を所有する。
   * @trace ARCH-000018
   * @input N/A: 実行時引数を受け取らない。
   * @returns readTimeの計算結果を返す。
   * @precondition 「N/A: 実行時引数を受け取らない。」がreadTimeの入力契約を満たす。
   * @postcondition readTimeの責務を完了した結果だけを返す。
   * @effect N/A: readTimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure readTimeは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant readTimeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: readTimeはProcess内の同一Subsystemで完結する。
   * @security N/A: readTimeはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: readTimeは共有非同期状態を持たない同期処理である。
   */
  function readTime() {
    try {
      const value = now();
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        (previousTime !== null && value < previousTime)
      ) {
        measurementComplete = false;
        return null;
      }
      previousTime = value;
      return value;
    } catch {
      measurementComplete = false;
      return null;
    }
  }
  const startedAt = readTime();

  /**
   * Intervalを終了する。
   *
   * @responsibility Intervalの終了条件、資源解放、終了不能時の境界を所有する。
   * @trace ARCH-000018
   * @input time: number | null
   * @returns closeIntervalの計算結果を返す。
   * @precondition 「time: number | null」がcloseIntervalの入力契約を満たす。
   * @postcondition closeIntervalの責務を完了した結果だけを返す。
   * @effect N/A: closeIntervalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: closeIntervalは独自の失敗分岐を所有しない。
   * @invariant closeIntervalは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: closeIntervalはProcess内の同一Subsystemで完結する。
   * @security N/A: closeIntervalはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: closeIntervalは共有非同期状態を持たない同期処理である。
   */
  function closeInterval(time: number | null) {
    if (currentState === null) return;
    intervals.push(
      Object.freeze({
        state: currentState,
        elapsedMs:
          time !== null && stateStartedAt !== null
            ? time - stateStartedAt
            : null,
      }),
    );
  }

  return Object.freeze({
    /**
     * Lifecycle 状態を観測する。
     *
     * @responsibility Lifecycle 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000018
     * @input state: string
     * @returns observeLifecycleStateの計算結果を返す。
     * @precondition 「state: string」がobserveLifecycleStateの入力契約を満たす。
     * @postcondition observeLifecycleStateの責務を完了した結果だけを返す。
     * @effect 局所計測値を更新し、指定された進行出力callbackがある場合は固定ラベルを同期配送する。
     * @failure observeLifecycleStateは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant observeLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 計測状態と呼出し元が指定した進行出力先の境界。取消・実行Authorityを発行しない。
     * @security N/A: observeLifecycleStateはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: observeLifecycleStateは共有非同期状態を持たない同期処理である。
     */
    observeLifecycleState(state: string) {
      if (isFinished || state === currentState) return;
      if (!Object.hasOwn(STATE_LABELS, state)) {
        measurementComplete = false;
        return;
      }
      const time = readTime();
      if (currentState === null && intervals.length === 0) firstStateAt = time;
      closeInterval(time);
      currentState = state;
      stateStartedAt = time;
      if (writeProgress && progressConfirmed) {
        try {
          const written: unknown = writeProgress(
            `[進行状況] ${STATE_LABELS[state as keyof typeof STATE_LABELS]}\n`,
          );
          void Promise.resolve(written).catch(() => {});
          progressConfirmed = written === true;
        } catch {
          progressConfirmed = false;
        }
      }
    },
    /**
     * measure Identityを決定する。
     *
     * @responsibility measure Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000018
     * @input observe: () => Result
     * @returns Resultを返す。
     * @precondition 「observe: () => Result」がmeasureIdentityの入力契約を満たす。
     * @postcondition measureIdentityの責務を完了した結果だけを返す。
     * @effect N/A: measureIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: measureIdentityは独自の失敗分岐を所有しない。
     * @invariant measureIdentityは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: measureIdentityはProcess内の同一Subsystemで完結する。
     * @security N/A: measureIdentityはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: measureIdentityは共有非同期状態を持たない同期処理である。
     */
    measureIdentity<Result>(observe: () => Result): Result {
      if (isFinished) return observe();
      const before = readTime();
      identityCount += 1;
      try {
        return observe();
      } finally {
        const after = readTime();
        if (before === null || after === null) {
          identityMeasurementComplete = false;
        } else {
          identityElapsedMs += after - before;
        }
      }
    },
    /**
     * development-execution-timingを終了状態へ収束させる。
     *
     * @responsibility development-execution-timingの終了条件、最終状態、残存義務の境界を所有する。
     * @trace ARCH-000018
     * @input N/A: 実行時引数を受け取らない。
     * @returns finishの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がfinishの入力契約を満たす。
     * @postcondition finishの責務を完了した結果だけを返す。
     * @effect N/A: finishは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: finishは独自の失敗分岐を所有しない。
     * @invariant finishは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: finishはProcess内の同一Subsystemで完結する。
     * @security N/A: finishはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: finishは共有非同期状態を持たない同期処理である。
     */
    finish() {
      if (isFinished) return;
      finishedAt = readTime();
      closeInterval(finishedAt);
      currentState = null;
      isFinished = true;
    },
    /**
     * development-execution-timingを所有Snapshotへ変換する。
     *
     * @responsibility development-execution-timingの取得範囲、plain-data制約、拒否境界を所有する。
     * @trace ARCH-000018
     * @input N/A: 実行時引数を受け取らない。
     * @returns snapshotの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がsnapshotの入力契約を満たす。
     * @postcondition snapshotの責務を完了した結果だけを返す。
     * @effect N/A: snapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: snapshotは独自の失敗分岐を所有しない。
     * @invariant snapshotは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: snapshotはProcess内の同一Subsystemで完結する。
     * @security N/A: snapshotはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: snapshotは共有非同期状態を持たない同期処理である。
     */
    snapshot() {
      return Object.freeze({
        measurementComplete,
        progressOutputConfirmed: writeProgress ? progressConfirmed : null,
        finished: isFinished,
        totalElapsedMs:
          finishedAt !== null && startedAt !== null
            ? finishedAt - startedAt
            : null,
        initialUnattributedMs:
          firstStateAt !== null && startedAt !== null
            ? firstStateAt - startedAt
            : null,
        intervals: Object.freeze([...intervals]),
        identityObservation: Object.freeze({
          callCount: identityCount,
          elapsedMs: identityMeasurementComplete ? identityElapsedMs : null,
          measurementComplete: identityMeasurementComplete,
        }),
      });
    },
  });
}

/**
 * Only fixed labels generated above reach this bounded best-effort sink.
 *
 * @responsibility Development Measurement Progressの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000018
 * @input text: string
 * @returns writeDevelopmentMeasurementProgressの計算結果を返す。
 * @precondition 「text: string」がwriteDevelopmentMeasurementProgressの入力契約を満たす。
 * @postcondition writeDevelopmentMeasurementProgressの責務を完了した結果だけを返す。
 * @effect 許可した固定ラベルのUTF-8列だけをstderr descriptor 2へ同期書込みする。
 * @failure writeDevelopmentMeasurementProgressは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeDevelopmentMeasurementProgressは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 固定ラベルの計測表示とOSのstderr書込み境界。
 * @security N/A: writeDevelopmentMeasurementProgressはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeDevelopmentMeasurementProgressは共有非同期状態を持たない同期処理である。
 */
export function writeDevelopmentMeasurementProgress(text: string) {
  try {
    if (
      !Object.values(STATE_LABELS).some(
        (label) => text === `[進行状況] ${label}\n`,
      )
    )
      return false;
    const bytes = Buffer.from(text, "utf8");
    if (bytes.byteLength > 256) return false;
    return writeSync(2, bytes) === bytes.byteLength;
  } catch {
    return false;
  }
}

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

const developmentMeasurementSessionCONFIG_KEYS = new Set([
  "repositoryRoot",
  "expectedCommit",
  "expectedTree",
  "expectedSourceSha256",
  "tasks",
  "expiresAtMs",
]);

const SHA256 = /^[a-f0-9]{64}$/u;

const COMMIT = /^[a-f0-9]{40}$/u;

const developmentMeasurementSessionMAX_DURATION_MS = 3_600_000;

/**
 * development-measurement-sessionで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DevelopmentMeasurementSessionProvider = "codex" | "claude";

/**
 * development-measurement-sessionで使用するRoleの値契約を定義する。
 *
 * @responsibility RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Roleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Roleで宣言した値と責務の対応を維持する。
 * @boundary N/A: Roleの宣言は外部境界を開かない。
 * @security RoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Roleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DevelopmentMeasurementSessionRole = "executor" | "reviewer";

/**
 * development-measurement-sessionで使用するConstraintsの値契約を定義する。
 *
 * @responsibility ConstraintsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Constraintsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Constraintsで宣言した値と責務の対応を維持する。
 * @boundary N/A: Constraintsの宣言は外部境界を開かない。
 * @security ConstraintsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Constraintsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Constraints = NonNullable<
  ReturnType<typeof createDevelopmentMeasurementConstraints>
>;

/**
 * development-measurement-sessionで使用するTask Requestの値契約を定義する。
 *
 * @responsibility Task RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskRequestの宣言は外部境界を開かない。
 * @security TaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskRequest = Extract<
  NonNullable<ReturnType<typeof snapshotCoordinatorTaskRequest>>,
  { status: "accepted" }
>["request"];

/**
 * development-measurement-sessionで使用するTaskの値契約を定義する。
 *
 * @responsibility TaskのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Taskが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Taskで宣言した値と責務の対応を維持する。
 * @boundary N/A: Taskの宣言は外部境界を開かない。
 * @security TaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Taskの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Task = Readonly<{
  request: TaskRequest;
  scopeSha256: string;
  executor: DevelopmentMeasurementSessionProvider;
  reviewer: DevelopmentMeasurementSessionProvider;
}>;

/**
 * development-measurement-sessionで使用するConfigurationの値契約を定義する。
 *
 * @responsibility ConfigurationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Configurationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Configurationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Configurationの宣言は外部境界を開かない。
 * @security ConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Configurationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Configuration = Readonly<{
  repositoryRoot: string;
  expectedCommit: string;
  expectedTree: string;
  expectedSourceSha256: string;
  tasks: readonly Task[];
  expiresAtMs: number;
}>;

/**
 * development-measurement-sessionで使用するIdentityの値契約を定義する。
 *
 * @responsibility IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Identityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Identityで宣言した値と責務の対応を維持する。
 * @boundary N/A: Identityの宣言は外部境界を開かない。
 * @security IdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Identityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Identity = Readonly<{
  sourceIdentitySha256: string;
  repositoryIdentitySha256: string;
}>;

// 本番Source観測の根拠だけを元Identityへ結合する。
const sourceObservations = new WeakMap<
  Identity,
  Readonly<{
    scope: NonNullable<
      ReturnType<typeof observeRuntimeOwnedDevelopmentSource>
    >["scope"];
    expectedSourceSha256: string;
  }>
>();

/**
 * development-measurement-sessionで使用するDependenciesの値契約を定義する。
 *
 * @responsibility DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Dependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Dependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: Dependenciesの宣言は外部境界を開かない。
 * @security DependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Dependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Dependencies = Readonly<{
  bindOperationContext?: (
    managementCapability: object,
    context: DevelopmentOperationContext,
  ) => boolean;
  observe: (configuration: Configuration) => Identity | null;
  wallNow: () => number;
  monotonicNow: () => number;
  isEffectBlocked: () => boolean;
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  borrowRepository: typeof borrowRuntimeOwnedRepositorySource;
}>;

/**
 * development-measurement-sessionで使用するSessionの値契約を定義する。
 *
 * @responsibility SessionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Sessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sessionの宣言は外部境界を開かない。
 * @security SessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Session = {
  timing: ReturnType<typeof createDevelopmentExecutionTiming>;
  configuration: Configuration;
  identity: Identity;
  bindingSha256: string;
  constraints: Constraints;
  signal: AbortSignal;
  closed: boolean;
};

/**
 * development-measurement-sessionで使用するTask Bindingの値契約を定義する。
 *
 * @responsibility Task BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskBindingの宣言は外部境界を開かない。
 * @security TaskBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskBinding = {
  operationContext?: DevelopmentOperationContext;
  session: Session;
  task: Task;
  token: object;
  managementCapability: object | null;
  settled: boolean;
};

/**
 * development-measurement-sessionのHashを算出する。
 *
 * @responsibility development-measurement-sessionの入力byte列、Hash algorithm、算出結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns digestの計算結果を返す。
 * @precondition 「value: unknown」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: digestはProcess内の同一Subsystemで完結する。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

/**
 * Taskを所有Snapshotへ変換する。
 *
 * @responsibility Taskの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Task | nullを返す。
 * @precondition 「raw: unknown」がsnapshotTaskの入力契約を満たす。
 * @postcondition snapshotTaskの責務を完了した結果だけを返す。
 * @effect N/A: snapshotTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotTaskはProcess内の同一Subsystemで完結する。
 * @security snapshotTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotTaskは共有非同期状態を持たない同期処理である。
 */
function snapshotTask(raw: unknown): Task | null {
  try {
    const parsed = snapshotCoordinatorTaskRequest(raw);
    if (parsed?.status !== "accepted") return null;
    const request = parsed.request;
    const executor = request.taskExecutionSelections?.executor.provider;
    if (
      (executor !== "codex" && executor !== "claude") ||
      request.isLocalCandidateOnly !== true ||
      request.hasUnresolvedDirection !== false ||
      request.requiresCrossContextAlignment !== false ||
      request.workClass !== "bounded_implementation" ||
      request.planState !== "complete" ||
      request.risk !== "low" ||
      request.difficulty !== "low" ||
      request.decisionImpact !== "limited"
    )
      return null;
    const reviewer = request.taskExecutionSelections?.reviewer.provider;
    if (reviewer !== "codex" && reviewer !== "claude") return null;
    return Object.freeze({
      request,
      executor,
      reviewer,
      scopeSha256: digest([
        "crdd-development-task/v1",
        request,
        executor,
        reviewer,
      ]),
    });
  } catch {
    return null;
  }
}

/**
 * Configurationを所有Snapshotへ変換する。
 *
 * @responsibility Configurationの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Configuration | nullを返す。
 * @precondition 「raw: unknown」がsnapshotConfigurationの入力契約を満たす。
 * @postcondition snapshotConfigurationの責務を完了した結果だけを返す。
 * @effect N/A: snapshotConfigurationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotConfigurationは独自の失敗分岐を所有しない。
 * @invariant snapshotConfigurationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotConfigurationはProcess内の同一Subsystemで完結する。
 * @security snapshotConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotConfigurationは共有非同期状態を持たない同期処理である。
 */
function snapshotConfiguration(raw: unknown): Configuration | null {
  const config = snapshotPlainRecord(
    raw,
    developmentMeasurementSessionCONFIG_KEYS,
  );
  if (!config) return null;
  const taskInputs = snapshotPlainArray(config.tasks, 2);
  if (
    taskInputs.status !== "ok" ||
    taskInputs.value.length !== 2 ||
    typeof config.repositoryRoot !== "string" ||
    !path.isAbsolute(config.repositoryRoot) ||
    path.normalize(config.repositoryRoot) !== config.repositoryRoot ||
    typeof config.expectedCommit !== "string" ||
    !COMMIT.test(config.expectedCommit) ||
    typeof config.expectedTree !== "string" ||
    !COMMIT.test(config.expectedTree) ||
    typeof config.expectedSourceSha256 !== "string" ||
    !SHA256.test(config.expectedSourceSha256) ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs)
  )
    return null;
  const tasks: Task[] = [];
  for (const input of taskInputs.value) {
    const task = snapshotTask(input);
    if (
      !task ||
      tasks.some(
        (existing) =>
          existing.executor === task.executor ||
          existing.scopeSha256 === task.scopeSha256,
      )
    )
      return null;
    tasks.push(task);
  }
  return Object.freeze({
    repositoryRoot: config.repositoryRoot,
    expectedCommit: config.expectedCommit,
    expectedTree: config.expectedTree,
    expectedSourceSha256: config.expectedSourceSha256,
    tasks: Object.freeze(tasks),
    expiresAtMs: config.expiresAtMs,
  });
}

/**
 * 固定SourceとTask Repositoryを同じ観測区間で確認する。
 *
 * @responsibility 署名配布へ依存せず、Source期待値と元Repository実体の継続性を照合する。
 * @trace ARCH-000004
 * @input configuration: 固定入力。priorIdentity: 再観測時の元admission実体。
 * @returns Identity | nullを返す。
 * @precondition 「configuration: Configuration」がobserveProductionの入力契約を満たす。
 * @postcondition observeProductionの責務を完了した結果だけを返す。
 * @effect SourceとRepositoryを読み、既存私有Mapへ観測を結合する。
 * @failure 欠測・期待差・元実体観測失効・観測中差替えはnull。
 * @invariant fresh Hashだけで元Session Identityの失効を上書きしない。
 * @boundary 固定SourceのFilesystem観測とRepository照合。
 * @security observeProductionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 旧実体観測前後と新実体観測最終確認を重ねる。変更不能や原子的ロードは保証しない。
 */
function observeProduction(configuration: Configuration): Identity | null {
  const repository = readRepositorySnapshot(
    getRepository(configuration.repositoryRoot).capability,
  );
  if (
    !repository ||
    repository.revisionIdentity !== configuration.expectedCommit ||
    repository.snapshotIdentity !== configuration.expectedTree
  )
    return null;
  const source = observeRuntimeOwnedDevelopmentSource();
  if (!source || source.sourceSha256 !== configuration.expectedSourceSha256)
    return null;
  const reobserved = readRepositorySnapshot(
    getRepository(configuration.repositoryRoot).capability,
  );
  if (JSON.stringify(repository) !== JSON.stringify(reobserved)) return null;
  const identity: Identity = Object.freeze({
    sourceIdentitySha256: source.sourceIdentitySha256,
    repositoryIdentitySha256: digest([
      "crdd-development-repository/v1",
      configuration.repositoryRoot,
      {
        repositoryKind: repository.repositoryForm,
        logicalRepositoryIdentity: repository.repositoryIdentity,
        repositoryInstanceIdentity: repository.repositoryInstanceIdentity,
        revision: repository.revisionIdentity,
        status: "candidate",
        commit: repository.revisionIdentity,
        tree: repository.snapshotIdentity,
        externalGitCliUsed: false,
        repositoryPathReported: false,
      },
    ]),
  });
  sourceObservations.set(
    identity,
    Object.freeze({
      scope: source.scope,
      expectedSourceSha256: source.sourceSha256,
    }),
  );
  return identity;
}

/**
 * development-measurement-sessionを停止結果として構築する。
 *
 * @responsibility development-measurement-sessionの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    capability: null,
    executionSourceKind: "fixed_development_candidate" as const,
    releaseAuthorityConferred: false,
    providerEffectIssued: false,
  });
}

/**
 * Session Runtimeを構築する。
 *
 * @responsibility Session Runtimeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createSessionRuntimeの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateSessionRuntimeの入力契約を満たす。
 * @postcondition createSessionRuntimeの責務を完了した結果だけを返す。
 * @effect createSessionRuntimeは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure createSessionRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createSessionRuntimeは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createSessionRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSessionRuntimeは共有非同期状態を持たない同期処理である。
 */
function createSessionRuntime(dependencies: Dependencies) {
  const sessions = new WeakMap<object, Session>();
  const taskBindings = new WeakMap<object, TaskBinding>();
  const operationBindings = new WeakMap<object, TaskBinding>();
  const invocationBindings = new WeakMap<object, TaskBinding>();
  const cleanupBindings = new WeakMap<object, TaskBinding>();
  let admissionStarted = false;

  /**
   * development-measurement-sessionを観測する。
   *
   * @responsibility development-measurement-sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
   * @trace ARCH-000004
   * @input session: Session
   * @returns observeの計算結果を返す。
   * @precondition 「session: Session」がobserveの入力契約を満たす。
   * @postcondition observeの責務を完了した結果だけを返す。
   * @effect N/A: observeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure observeは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant observeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: observeはProcess内の同一Subsystemで完結する。
   * @security observeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: observeは共有非同期状態を持たない同期処理である。
   */
  function observe(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const identity = session.timing.measureIdentity(() =>
        dependencies.observe(session.configuration),
      );
      const bindingSha256 =
        identity && digest(identity) === digest(session.identity)
          ? session.bindingSha256
          : "0".repeat(64);
      const observation = {
        bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        identity,
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  /**
   * Bound Sessionを検査する。
   *
   * @responsibility Bound Sessionの検査条件、違反分類、検査結果境界を所有する。
   * @trace ARCH-000004
   * @input session: Session
   * @returns checkBoundSessionの計算結果を返す。
   * @precondition 「session: Session」がcheckBoundSessionの入力契約を満たす。
   * @postcondition checkBoundSessionの責務を完了した結果だけを返す。
   * @effect N/A: checkBoundSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure checkBoundSessionは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant checkBoundSessionは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: checkBoundSessionはProcess内の同一Subsystemで完結する。
   * @security checkBoundSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: checkBoundSessionは共有非同期状態を持たない同期処理である。
   */
  function checkBoundSession(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const observation = {
        bindingSha256: session.bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  /**
   * operation Validを決定する。
   *
   * @responsibility operation Validの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000004
   * @input binding: TaskBinding
   * @returns operationValidの計算結果を返す。
   * @precondition 「binding: TaskBinding」がoperationValidの入力契約を満たす。
   * @postcondition operationValidの責務を完了した結果だけを返す。
   * @effect N/A: operationValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure operationValidは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant operationValidは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: operationValidはProcess内の同一Subsystemで完結する。
   * @security operationValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: operationValidは共有非同期状態を持たない同期処理である。
   */
  function operationValid(binding: TaskBinding) {
    try {
      return (
        !binding.settled &&
        binding.managementCapability !== null &&
        dependencies.verifyOperation(binding.managementCapability)
          .managementScopeBound === true
      );
    } catch {
      return false;
    }
  }

  return Object.freeze({
    /**
     * development-measurement-sessionを要求する。
     *
     * @responsibility development-measurement-sessionの要求条件、受理結果、Effect未成立との分離境界を所有する。
     * @trace ARCH-000004
     * @input raw: unknown、signal: AbortSignal
     * @returns requestの計算結果を返す。
     * @precondition 「raw: unknown、signal: AbortSignal」がrequestの入力契約を満たす。
     * @postcondition requestの責務を完了した結果だけを返す。
     * @effect N/A: requestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure requestは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant requestは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: requestはProcess内の同一Subsystemで完結する。
     * @security requestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency requestは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
     */
    async request(raw: unknown, signal: AbortSignal) {
      if (admissionStarted)
        return blocked("development_measurement_admission_already_attempted");
      admissionStarted = true;
      try {
        if (
          !signal ||
          types.isProxy(signal) ||
          !(signal instanceof AbortSignal) ||
          signal.aborted ||
          dependencies.isEffectBlocked()
        )
          return blocked("development_measurement_unavailable");
        const configuration = snapshotConfiguration(raw);
        const wallTimeMs = dependencies.wallNow();
        const monotonicTimeMs = dependencies.monotonicNow();
        if (
          !configuration ||
          configuration.expiresAtMs <= wallTimeMs ||
          configuration.expiresAtMs - wallTimeMs >
            developmentMeasurementSessionMAX_DURATION_MS
        )
          return blocked("development_measurement_configuration_invalid");
        const timing = createDevelopmentExecutionTiming();
        const identity = timing.measureIdentity(() =>
          dependencies.observe(configuration),
        );
        if (!identity)
          return blocked("development_measurement_identity_not_verified");
        const bindingSha256 = digest([
          "crdd-development-session/v1",
          configuration,
          identity,
        ]);
        const constraints = createDevelopmentMeasurementConstraints(
          {
            bindingSha256,
            expiresAtMs: configuration.expiresAtMs,
            tasks: configuration.tasks.map(
              ({ scopeSha256, executor, reviewer }) => ({
                scopeSha256,
                executor,
                reviewer,
              }),
            ),
          },
          { bindingSha256, wallTimeMs, monotonicTimeMs },
        );
        if (!constraints)
          return blocked("development_measurement_configuration_invalid");
        const session: Session = {
          timing,
          configuration,
          identity,
          bindingSha256,
          constraints,
          signal,
          closed: false,
        };
        const finalObservation = observe(session);
        if (
          signal.aborted ||
          dependencies.isEffectBlocked() ||
          finalObservation?.result.status !== "recorded"
        )
          return blocked("development_measurement_admission_changed");
        const capability = Object.freeze({});
        sessions.set(capability, session);
        return Object.freeze({
          status: "authorized" as const,
          capability,
          bindingSha256,
          expiresAtMs: configuration.expiresAtMs,
          executionSourceKind: "fixed_development_candidate" as const,
          releaseAuthorityConferred: false,
          providerEffectIssued: false,
        });
      } catch {
        return blocked("development_measurement_admission_failed");
      }
    },
    /**
     * reserve Taskを決定する。
     *
     * @responsibility reserve Taskの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input sessionCapability: object、raw: unknown
     * @returns reserveTaskの計算結果を返す。
     * @precondition 「sessionCapability: object、raw: unknown」がreserveTaskの入力契約を満たす。
     * @postcondition reserveTaskの責務を完了した結果だけを返す。
     * @effect N/A: reserveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveTaskは独自の失敗分岐を所有しない。
     * @invariant reserveTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveTaskはProcess内の同一Subsystemで完結する。
     * @security reserveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveTaskは共有非同期状態を持たない同期処理である。
     */
    reserveTask(sessionCapability: object, raw: unknown) {
      const session = sessions.get(sessionCapability);
      const task = snapshotTask(raw);
      const observation = session && observe(session);
      if (!session || !task || observation?.result.status !== "recorded")
        return null;
      const reserved = session.constraints.reserveTask(
        task.scopeSha256,
        observation.observation,
      );
      if (reserved.status !== "recorded") return null;
      const capability = Object.freeze({});
      taskBindings.set(capability, {
        session,
        task,
        token: reserved.value,
        managementCapability: null,
        settled: false,
      });
      return capability;
    },
    /**
     * task Boundaryを決定する。
     *
     * @responsibility task Boundaryの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object
     * @returns taskBoundaryの計算結果を返す。
     * @precondition 「taskCapability: object」がtaskBoundaryの入力契約を満たす。
     * @postcondition taskBoundaryの責務を完了した結果だけを返す。
     * @effect N/A: taskBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: taskBoundaryは独自の失敗分岐を所有しない。
     * @invariant taskBoundaryは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: taskBoundaryはProcess内の同一Subsystemで完結する。
     * @security taskBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: taskBoundaryは共有非同期状態を持たない同期処理である。
     */
    taskBoundary(taskCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return null;
      return Object.freeze({
        repositoryRoot: binding.session.configuration.repositoryRoot,
        expiresAtMs: binding.session.configuration.expiresAtMs,
        signal: binding.session.signal,
        request: binding.task.request,
        checkNewWork: () =>
          !binding.settled &&
          checkBoundSession(binding.session)?.result.status === "recorded",
      });
    },
    /**
     * OperationをIdentityへ結合する。
     *
     * @responsibility Operationの結合条件、相関Identity、不一致の拒否境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、managementCapability: object、repositoryBindingCapability: object
     * @returns bindOperationの計算結果を返す。
     * @precondition 「taskCapability: object、managementCapability: object、repositoryBindingCapability: object」がbindOperationの入力契約を満たす。
     * @postcondition bindOperationの責務を完了した結果だけを返す。
     * @effect 本番ではSession照合と同じContextのOperation結合が同期trueの場合だけSession Mapを確定する。局所候補はSession内だけに結合する。
     * @failure 不正・二重結合、設定されたcallbackのfalse・例外・未知戻り値ではSessionを確定しない。
     * @invariant 元の新規／清掃参照と動的検査を保ち、取消・終了後を通常Operationへ戻さない。
     * @boundary 診断Sessionと同じOperationの管理binding。
     * @security 結合は資源・Authorityの発行ではない。Task・Repository・Revisionの元照合を維持する。
     * @concurrency 同期trueからSession確定までawaitや外部処理を挟まない。
     */
    bindOperation(
      taskCapability: object,
      managementCapability: object,
      repositoryBindingCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (
        !binding ||
        binding.settled ||
        binding.managementCapability ||
        operationBindings.has(managementCapability) ||
        observe(binding.session)?.result.status !== "recorded"
      )
        return false;
      try {
        const operation = dependencies.verifyOperation(managementCapability);
        const repository = dependencies.borrowRepository(
          repositoryBindingCapability,
          managementCapability,
        );
        if (
          !repository ||
          repository.operationId !== operation.operationId ||
          repository.repositoryRoot !==
            binding.session.configuration.repositoryRoot ||
          repository.revision !== binding.session.configuration.expectedCommit
        )
          return false;
        const cleanupContext = Object.freeze({});
        const operationContext = Object.freeze({
          checkNewWork: () =>
            !binding.settled &&
            checkBoundSession(binding.session)?.result.status === "recorded",
          newWorkContext: taskCapability,
          cleanupContext,
        });
        if (
          dependencies.bindOperationContext &&
          dependencies.bindOperationContext(
            managementCapability,
            operationContext,
          ) !== true
        )
          return false;
        binding.managementCapability = managementCapability;
        binding.operationContext = operationContext;
        operationBindings.set(managementCapability, binding);
        cleanupBindings.set(cleanupContext, binding);
        return true;
      } catch {
        return false;
      }
    },
    /**
     * Operationを検査する。
     *
     * @responsibility Operationの検査条件、違反分類、検査結果境界を所有する。
     * @trace ARCH-000004
     * @input managementCapability: object
     * @returns checkOperationの計算結果を返す。
     * @precondition 「managementCapability: object」がcheckOperationの入力契約を満たす。
     * @postcondition checkOperationの責務を完了した結果だけを返す。
     * @effect N/A: checkOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure checkOperationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant checkOperationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: checkOperationはProcess内の同一Subsystemで完結する。
     * @security checkOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: checkOperationは共有非同期状態を持たない同期処理である。
     */
    checkOperation(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      if (!binding || binding.settled) return false;
      try {
        dependencies.verifyOperation(managementCapability);
        return observe(binding.session)?.result.status === "recorded";
      } catch {
        return false;
      }
    },
    /**
     * operation Contextを決定する。
     *
     * @responsibility operation Contextの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input managementCapability: object
     * @returns operationContextの計算結果を返す。
     * @precondition 「managementCapability: object」がoperationContextの入力契約を満たす。
     * @postcondition operationContextの責務を完了した結果だけを返す。
     * @effect N/A: operationContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: operationContextは独自の失敗分岐を所有しない。
     * @invariant operationContextは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: operationContextはProcess内の同一Subsystemで完結する。
     * @security operationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: operationContextは共有非同期状態を持たない同期処理である。
     */
    operationContext(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      return binding?.operationContext ?? null;
    },
    /**
     * reserve Invocationを決定する。
     *
     * @responsibility reserve Invocationの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、provider: Provider、role: Role
     * @returns reserveInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、provider: Provider、role: Role」がreserveInvocationの入力契約を満たす。
     * @postcondition reserveInvocationの責務を完了した結果だけを返す。
     * @effect N/A: reserveInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveInvocationは独自の失敗分岐を所有しない。
     * @invariant reserveInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveInvocationはProcess内の同一Subsystemで完結する。
     * @security reserveInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveInvocationは共有非同期状態を持たない同期処理である。
     */
    reserveInvocation(
      taskCapability: object,
      provider: DevelopmentMeasurementSessionProvider,
      role: DevelopmentMeasurementSessionRole,
    ) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (!binding || !observed || observed.result.status !== "recorded")
        return null;
      const reserved = binding.session.constraints.reserveInvocation(
        binding.token,
        provider,
        role,
        observed.observation,
      );
      if (reserved.status !== "recorded") return null;
      invocationBindings.set(reserved.value, binding);
      return reserved.value;
    },
    /**
     * Invocationを一回限りで消費する。
     *
     * @responsibility Invocationの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object、provider: Provider、role: Role
     * @returns consumeInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object、provider: Provider、role: Role」がconsumeInvocationの入力契約を満たす。
     * @postcondition consumeInvocationの責務を完了した結果だけを返す。
     * @effect consumeInvocationは外部ProcessまたはRuntime境界の操作を呼び出す。
     * @failure N/A: consumeInvocationは独自の失敗分岐を所有しない。
     * @invariant consumeInvocationは宣言した境界以外へEffectを拡張しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security consumeInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: consumeInvocationは共有非同期状態を持たない同期処理である。
     */
    consumeInvocation(
      taskCapability: object,
      invocationCapability: object,
      provider: DevelopmentMeasurementSessionProvider,
      role: DevelopmentMeasurementSessionRole,
    ) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (
        !binding ||
        !observed ||
        observed.result.status !== "recorded" ||
        binding.session.constraints.consumeInvocation(
          invocationCapability,
          binding.token,
          provider,
          role,
          observed.observation,
        ).status !== "recorded"
      )
        return false;
      // Provider Effect直前に元Source／Repositoryとの完全Identity比較を完了した。
      return true;
    },
    /**
     * Invocationを終端状態へ確定する。
     *
     * @responsibility Invocationの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object
     * @returns settleInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object」がsettleInvocationの入力契約を満たす。
     * @postcondition settleInvocationの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationは独自の失敗分岐を所有しない。
     * @invariant settleInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationはProcess内の同一Subsystemで完結する。
     * @security settleInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationは共有非同期状態を持たない同期処理である。
     */
    settleInvocation(taskCapability: object, invocationCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return wasSettled;
    },
    /**
     * Invocation And Verifyを終端状態へ確定する。
     *
     * @responsibility Invocation And Verifyの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object
     * @returns settleInvocationAndVerifyの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object」がsettleInvocationAndVerifyの入力契約を満たす。
     * @postcondition settleInvocationAndVerifyの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationAndVerifyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationAndVerifyは独自の失敗分岐を所有しない。
     * @invariant settleInvocationAndVerifyは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationAndVerifyはProcess内の同一Subsystemで完結する。
     * @security settleInvocationAndVerifyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationAndVerifyは共有非同期状態を持たない同期処理である。
     */
    settleInvocationAndVerify(
      taskCapability: object,
      invocationCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const observed = operationValid(binding) && observe(binding.session);
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return Boolean(
        wasSettled && observed && observed.result.status === "recorded",
      );
    },
    /**
     * Taskを終端状態へ確定する。
     *
     * @responsibility Taskの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、outcome: "finished" | "cleanup_unknown"
     * @returns settleTaskの計算結果を返す。
     * @precondition 「taskCapability: object、outcome: "finished" | "cleanup_unknown"」がsettleTaskの入力契約を満たす。
     * @postcondition settleTaskの責務を完了した結果だけを返す。
     * @effect N/A: settleTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleTaskは独自の失敗分岐を所有しない。
     * @invariant settleTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleTaskはProcess内の同一Subsystemで完結する。
     * @security settleTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleTaskは共有非同期状態を持たない同期処理である。
     */
    settleTask(
      taskCapability: object,
      outcome: "finished" | "cleanup_unknown",
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return false;
      const settled = binding.session.constraints.settleTask(
        binding.token,
        outcome,
      );
      if (settled.status !== "recorded") return false;
      binding.settled = true;
      return true;
    },
    /**
     * development-measurement-sessionを取り消す。
     *
     * @responsibility development-measurement-sessionの取消条件、終了状態、残存Effectの境界を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns cancelの計算結果を返す。
     * @precondition 「capability: object」がcancelの入力契約を満たす。
     * @postcondition cancelの責務を完了した結果だけを返す。
     * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: cancelは独自の失敗分岐を所有しない。
     * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: cancelはProcess内の同一Subsystemで完結する。
     * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: cancelは共有非同期状態を持たない同期処理である。
     */
    cancel(capability: object) {
      const session = sessions.get(capability);
      if (!session) return false;
      session.closed = true;
      session.constraints.cancel();
      return true;
    },
    /**
     * development-measurement-sessionを観測する。
     *
     * @responsibility development-measurement-sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns inspectの計算結果を返す。
     * @precondition 「capability: object」がinspectの入力契約を満たす。
     * @postcondition inspectの責務を完了した結果だけを返す。
     * @effect N/A: inspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: inspectは独自の失敗分岐を所有しない。
     * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: inspectはProcess内の同一Subsystemで完結する。
     * @security inspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
     */
    inspect(capability: object) {
      const session = sessions.get(capability);
      if (!session) return null;
      checkBoundSession(session);
      return Object.freeze({
        ...session.constraints.inspect(),
        sourceObservation: sourceObservations.get(session.identity) ?? null,
        identityObservation: session.timing.snapshot().identityObservation,
      });
    },
    /**
     * tasksを決定する。
     *
     * @responsibility tasksの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns tasksの計算結果を返す。
     * @precondition 「capability: object」がtasksの入力契約を満たす。
     * @postcondition tasksの責務を完了した結果だけを返す。
     * @effect N/A: tasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: tasksは独自の失敗分岐を所有しない。
     * @invariant tasksは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: tasksはProcess内の同一Subsystemで完結する。
     * @security tasksはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: tasksは共有非同期状態を持たない同期処理である。
     */
    tasks(capability: object) {
      const session = sessions.get(capability);
      if (!session || observe(session)?.result.status !== "recorded")
        return null;
      return Object.freeze(
        session.configuration.tasks.map((task) => task.request),
      );
    },
  });
}

const productionRuntime = createSessionRuntime(
  Object.freeze({
    bindOperationContext: bindOwnedDevelopmentOperationContext,
    observe: observeProduction,
    wallNow: Date.now,
    monotonicNow: () => performance.now(),
    isEffectBlocked: isRuntimeProcessPoisoned,
    verifyOperation: verifyOwnedOperationManagementCapability,
    borrowRepository: borrowRuntimeOwnedRepositorySource,
  }),
);

/**
 * Runtime 所有 Development Measurement Sessionを要求する。
 *
 * @responsibility Runtime 所有 Development Measurement Sessionの要求条件、受理結果、Effect未成立との分離境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、signal: AbortSignal
 * @returns requestRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「raw: unknown、signal: AbortSignal」がrequestRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition requestRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant requestRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security requestRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function requestRuntimeOwnedDevelopmentMeasurementSession(
  raw: unknown,
  signal: AbortSignal,
) {
  return productionRuntime.request(raw, signal);
}

/**
 * Runtime 所有 Development Measurement Sessionを観測する。
 *
 * @responsibility Runtime 所有 Development Measurement Sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns inspectRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「capability: object」がinspectRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.inspect(capability);
}

/**
 * Runtime 所有 Development Measurement Tasksを読み取る。
 *
 * @responsibility Runtime 所有 Development Measurement Tasksの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns readRuntimeOwnedDevelopmentMeasurementTasksの計算結果を返す。
 * @precondition 「capability: object」がreadRuntimeOwnedDevelopmentMeasurementTasksの入力契約を満たす。
 * @postcondition readRuntimeOwnedDevelopmentMeasurementTasksの責務を完了した結果だけを返す。
 * @effect N/A: readRuntimeOwnedDevelopmentMeasurementTasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readRuntimeOwnedDevelopmentMeasurementTasksは独自の失敗分岐を所有しない。
 * @invariant readRuntimeOwnedDevelopmentMeasurementTasksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readRuntimeOwnedDevelopmentMeasurementTasksはProcess内の同一Subsystemで完結する。
 * @security readRuntimeOwnedDevelopmentMeasurementTasksはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRuntimeOwnedDevelopmentMeasurementTasksは共有非同期状態を持たない同期処理である。
 */
export function readRuntimeOwnedDevelopmentMeasurementTasks(
  capability: object,
) {
  return productionRuntime.tasks(capability);
}

/**
 * Runtime 所有 Development Measurement Sessionを取り消す。
 *
 * @responsibility Runtime 所有 Development Measurement Sessionの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns cancelRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「capability: object」がcancelRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.cancel(capability);
}

/**
 * Internal Task facade; caller values cannot construct an admitted session.
 *
 * @responsibility development-measurement-sessionの入力からreserve Runtime 所有 Development Measurement Taskを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input sessionCapability: object、request: unknown、repositoryRoot: unknown
 * @returns reserveRuntimeOwnedDevelopmentMeasurementTaskの計算結果を返す。
 * @precondition 「sessionCapability: object、request: unknown、repositoryRoot: unknown」がreserveRuntimeOwnedDevelopmentMeasurementTaskの入力契約を満たす。
 * @postcondition reserveRuntimeOwnedDevelopmentMeasurementTaskの責務を完了した結果だけを返す。
 * @effect N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは独自の失敗分岐を所有しない。
 * @invariant reserveRuntimeOwnedDevelopmentMeasurementTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskはProcess内の同一Subsystemで完結する。
 * @security reserveRuntimeOwnedDevelopmentMeasurementTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは共有非同期状態を持たない同期処理である。
 */
export function reserveRuntimeOwnedDevelopmentMeasurementTask(
  sessionCapability: object,
  request: unknown,
  repositoryRoot: unknown,
) {
  const taskCapability = productionRuntime.reserveTask(
    sessionCapability,
    request,
  );
  if (!taskCapability) return null;
  const boundary = productionRuntime.taskBoundary(taskCapability);
  if (!boundary || boundary.repositoryRoot !== repositoryRoot) {
    productionRuntime.settleTask(taskCapability, "finished");
    return null;
  }
  return Object.freeze({
    ...boundary,
    context: taskCapability,
    bindOperation: (
      managementCapability: object,
      repositoryBindingCapability: object,
    ) =>
      productionRuntime.bindOperation(
        taskCapability,
        managementCapability,
        repositoryBindingCapability,
      ),
    beginInvocation: (
      provider: DevelopmentMeasurementSessionProvider,
      role: DevelopmentMeasurementSessionRole,
    ) => {
      const invocation = productionRuntime.reserveInvocation(
        taskCapability,
        provider,
        role,
      );
      if (!invocation) return null;
      return Object.freeze({
        commandRestriction: (purpose: string) =>
          purpose === "start_provider_attached"
            ? productionRuntime.consumeInvocation(
                taskCapability,
                invocation,
                provider,
                role,
              )
            : boundary.checkNewWork(),
        settle: () => {
          return productionRuntime.settleInvocationAndVerify(
            taskCapability,
            invocation,
          );
        },
      });
    },
    finish: (outcome: "finished" | "cleanup_unknown") =>
      productionRuntime.settleTask(taskCapability, outcome),
  });
}

/**
 * Isolated capability namespace: never accepted by the production facade.
 *
 * @responsibility Isolated Development Measurement Session 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createIsolatedDevelopmentMeasurementSessionCandidateの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateIsolatedDevelopmentMeasurementSessionCandidateの入力契約を満たす。
 * @postcondition createIsolatedDevelopmentMeasurementSessionCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDevelopmentMeasurementSessionCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedDevelopmentMeasurementSessionCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedDevelopmentMeasurementSessionCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDevelopmentMeasurementSessionCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDevelopmentMeasurementSessionCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDevelopmentMeasurementSessionCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDevelopmentMeasurementSessionCandidate(
  dependencies: Dependencies,
) {
  return createSessionRuntime(dependencies);
}

const SOURCE_SCOPE = "crdd-development-source-snapshot/v4";

const PACKAGES = [
  "access-management",
  "ai-adapter",
  "coordinator",
  "docker-isolation",
  "configuration-model",
  "document-model",
  "execution-model",
  "executor",
  "execution-intelligence",
  "lock",
  "mcp-server",
  "version-control",
] as const;

const DIRECTORIES = [
  "src",
  "bin",
  "runtime",
  "config",
  "schemas",
  "scripts",
  "policies",
] as const;

const sourceRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);

/**
 * Snapshotの観測事実を保持する。実行許可や配布元真正性は表さない。
 *
 * @responsibility 再現可能な内容Hashと同Session内の実体Hashを区別する。
 * @trace ARCH-000004
 * @shape Scope、内容Hash、実体Hash、件数とbyte数を持つ不変値。
 * @invariant 内容Hashへ絶対RootとOS上の実体番号を含めない。
 * @boundary Repository内の固定Source範囲だけを表す。
 * @security 本文・秘密値・実行Authorityを返さない。
 * @compatibility Scope版が異なるHashを同じ観測契約と解釈しない。
 */
type SourceObservation = Readonly<{
  scope: typeof SOURCE_SCOPE;
  sourceSha256: string;
  sourceIdentitySha256: string;
  fileCount: number;
  totalBytes: number;
}>;

/**
 * Directory名を列挙し、同じhandleを必ず閉じる。
 *
 * @responsibility Source診断の対象名を独自の件数上限で欠落させない。
 * @trace ARCH-000004
 * @input directory: 固定Scope内のDirectory。
 * @returns コード単位順に並べた名前集合。
 * @precondition 呼出し元がDirectory種別を確認している。
 * @postcondition 成功・失敗とも開いたhandleのcloseを一回試行する。
 * @effect Directoryを読取り専用で開閉する。
 * @failure 列挙・close失敗は例外を返す。
 * @invariant 外部への書込みと永続状態を作らない。
 * @boundary Node Directory handleの所有期間。
 * @security File名だけを内部で保持し、対象Scopeを拡張しない。
 * @concurrency 後続の二読取りが追加・欠落差を照合する。
 */
function readDirectoryNames(directory: string): string[] {
  const handle = opendirSync(directory);
  const names: string[] = [];
  try {
    for (;;) {
      const entry = handle.readSync();
      if (!entry) break;
      names.push(entry.name);
    }
    return names.sort();
  } finally {
    handle.closeSync();
  }
}

/**
 * 固定Root以下を二度読み、途中で変化したSnapshotを拒否する。
 *
 * @responsibility 通常Fileの内容とRoot・Directory・File実体の前後一致を確認する。
 * @trace ARCH-000004
 * @input root: 内部で固定したSource Root。
 * @returns 一致した不変観測値。観測不能・不一致はnull。
 * @precondition 呼出し元が観測対象Rootを固定している。
 * @postcondition 部分結果を成功値として返さない。
 * @effect Filesystemの読取りだけを行う。
 * @failure link、欠落、非通常File、読取り差を拒否する。
 * @invariant 外部へ実行許可を発行せず、内容Hashと実体Hashを分ける。
 * @boundary Node Filesystemから読取り可能な固定Sourceだけを観測する。
 * @security linkを辿らず、外部Rootを返さず、書込みを行わない。
 * @concurrency 二読取りの差を拒否するが、ロード済みModuleとの原子的同一性は保証しない。
 */
function captureDevelopmentSource(root: string): SourceObservation | null {
  try {
    const passes: string[] = [];
    let result: SourceObservation | null = null;
    for (let pass = 0; pass < 2; pass += 1) {
      const content: unknown[] = [SOURCE_SCOPE, PACKAGES, DIRECTORIES];
      const identities: unknown[] = [];
      let fileCount = 0;
      let totalBytes = 0;
      const packagesWithSource = new Set<string>();
      const pending: Array<{
        absolute: string;
        relative: string;
      }> = [];
      // Root parents are checked independently; root mtime is intentionally not
      // included because excluded .crdd/document updates do not change Source.
      for (const absolute of [root, path.join(root, "40_Develop")]) {
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        if (path.resolve(realpathSync(absolute)) !== path.resolve(absolute))
          return null;
        identities.push([
          absolute === root ? "." : "40_Develop",
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
      }
      for (const packageName of PACKAGES) {
        const relative = `40_Develop/${packageName}`;
        const absolute = path.join(root, "40_Develop", packageName);
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        identities.push([
          relative,
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
        pending.push({
          absolute: path.join(absolute, "package.json"),
          relative: `${relative}/package.json`,
        });
        for (const directory of DIRECTORIES) {
          const child = path.join(absolute, directory);
          let childStat: BigIntStats;
          try {
            childStat = lstatSync(child, { bigint: true });
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "ENOENT" ||
              directory === "src"
            )
              throw error;
            content.push([`${relative}/${directory}`, "absent"]);
            continue;
          }
          if (!childStat.isDirectory() || childStat.isSymbolicLink())
            return null;
          pending.push({
            absolute: child,
            relative: `${relative}/${directory}`,
          });
        }
      }
      while (pending.length > 0) {
        const entry = pending.pop();
        if (!entry) return null;
        const before = lstatSync(entry.absolute, { bigint: true });
        if (before.isSymbolicLink()) return null;
        if (entry.relative.endsWith("/package.json") && !before.isFile())
          return null;
        if (before.isDirectory()) {
          const names = readDirectoryNames(entry.absolute);
          content.push([entry.relative, "directory", names]);
          identities.push([
            entry.relative,
            String(before.dev),
            String(before.ino),
            String(before.birthtimeNs),
          ]);
          for (const name of names) {
            pending.push({
              absolute: path.join(entry.absolute, name),
              relative: `${entry.relative}/${name}`,
            });
          }
          continue;
        }
        if (!before.isFile() || before.nlink !== 1n) return null;
        fileCount += 1;
        const sourcePackage = entry.relative.match(
          /^40_Develop\/([^/]+)\/src\//u,
        )?.[1];
        if (sourcePackage) packagesWithSource.add(sourcePackage);
        const descriptor = openSync(
          entry.absolute,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        let bytes: Buffer;
        let identity: string;
        try {
          const opened = fstatSync(descriptor, { bigint: true });
          identity = JSON.stringify(
            [
              before.dev,
              before.ino,
              before.size,
              before.mtimeNs,
              before.ctimeNs,
              before.birthtimeNs,
              before.nlink,
            ].map(String),
          );
          const openedIdentity = JSON.stringify(
            [
              opened.dev,
              opened.ino,
              opened.size,
              opened.mtimeNs,
              opened.ctimeNs,
              opened.birthtimeNs,
              opened.nlink,
            ].map(String),
          );
          if (
            !opened.isFile() ||
            opened.nlink !== 1n ||
            openedIdentity !== identity
          )
            return null;
          const buffer = Buffer.alloc(Number(opened.size) + 1);
          let offset = 0;
          while (offset < buffer.length) {
            const count = readSync(
              descriptor,
              buffer,
              offset,
              buffer.length - offset,
              offset,
            );
            if (count === 0) break;
            offset += count;
          }
          if (offset !== Number(opened.size)) return null;
          bytes = buffer.subarray(0, offset);
          const after = fstatSync(descriptor, { bigint: true });
          if (
            JSON.stringify(
              [
                after.dev,
                after.ino,
                after.size,
                after.mtimeNs,
                after.ctimeNs,
                after.birthtimeNs,
                after.nlink,
              ].map(String),
            ) !== identity
          )
            return null;
        } finally {
          closeSync(descriptor);
        }
        const after = lstatSync(entry.absolute, { bigint: true });
        if (
          !after.isFile() ||
          after.nlink !== 1n ||
          after.isSymbolicLink() ||
          JSON.stringify(
            [
              after.dev,
              after.ino,
              after.size,
              after.mtimeNs,
              after.ctimeNs,
              after.birthtimeNs,
              after.nlink,
            ].map(String),
          ) !== identity
        )
          return null;
        totalBytes += bytes.length;
        content.push([
          entry.relative,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ]);
        identities.push([entry.relative, identity]);
      }
      if (packagesWithSource.size !== PACKAGES.length) return null;
      content.splice(
        3,
        content.length - 3,
        ...content
          .slice(3)
          .sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b)
              ? -1
              : JSON.stringify(a) > JSON.stringify(b)
                ? 1
                : 0,
          ),
      );
      identities.sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
      const sourceSha256 = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex");
      const sourceIdentitySha256 = createHash("sha256")
        .update(JSON.stringify([sourceSha256, identities]))
        .digest("hex");
      passes.push(sourceIdentitySha256);
      result = Object.freeze({
        scope: SOURCE_SCOPE,
        sourceSha256,
        sourceIdentitySha256,
        fileCount,
        totalBytes,
      });
    }
    return passes[0] === passes[1] ? result : null;
  } catch {
    return null;
  }
}

/**
 * このModule自身が属するRepositoryの開発Sourceを観測する。
 *
 * @responsibility Sessionと入力生成Toolの固定Source観測入口を共有する。
 * @trace ARCH-000004
 * @input N/A: RootとScopeはModuleから固定し、呼出し元に選ばせない。
 * @returns 固定Scope全体のSnapshot観測値。不完全な観測はnull。
 * @precondition 固定Scopeの全Packageと必要Sourceが読取り可能である。
 * @postcondition 成功値は二読取りで内容・実体が一致する。
 * @effect Sourceを同期読取りする。永続状態を作らない。
 * @failure 欠落、不正実体、途中変更はnull。
 * @invariant この値は実行Authorityでも配布署名でもない。
 * @boundary 固定RepositoryのSourceのみを読み取る。
 * @security 任意Root、期待値自動補完、Source本文の公開を許さない。
 * @concurrency Snapshot観測中の差を拒否する。将来の変更不能は保証しない。
 */
export function observeRuntimeOwnedDevelopmentSource(): SourceObservation | null {
  return captureDevelopmentSource(sourceRoot);
}
