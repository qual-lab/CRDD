/**
 * development-execution-timingに属する責務をまとめる。
 *
 * @responsibility Intervalを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000018
 */
import { writeSync } from "node:fs";
import { performance } from "node:perf_hooks";

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
  "STATE-CANDIDATE-STAGED": "作業領域の後片付け",
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
 * Passive diagnostics only: no authority clock, timer, listener or capability.
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
     * @effect N/A: observeLifecycleStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure observeLifecycleStateは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant observeLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: observeLifecycleStateはProcess内の同一Subsystemで完結する。
     * @security N/A: observeLifecycleStateはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: observeLifecycleStateは共有非同期状態を持たない同期処理である。
     */
    observeLifecycleState(state: string) {
      if (isFinished || state === currentState) return;
      if (!Object.hasOwn(STATE_LABELS, state) || intervals.length >= 31) {
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
          progressConfirmed =
            writeProgress(
              `[進行状況] ${STATE_LABELS[state as keyof typeof STATE_LABELS]}\n`,
            ) === true;
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
 * @effect N/A: writeDevelopmentMeasurementProgressは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeDevelopmentMeasurementProgressは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeDevelopmentMeasurementProgressは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeDevelopmentMeasurementProgressはProcess内の同一Subsystemで完結する。
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
