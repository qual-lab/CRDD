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

type Interval = Readonly<{
  state: string;
  elapsedMs: number | null;
}>;

/** Passive diagnostics only: no authority clock, timer, listener or capability. */
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
    finish() {
      if (isFinished) return;
      finishedAt = readTime();
      closeInterval(finishedAt);
      currentState = null;
      isFinished = true;
    },
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

/** Only fixed labels generated above reach this bounded best-effort sink. */
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
