import { types as utilTypes } from "node:util";

const intrinsicPromiseThen = Promise.prototype.then;
const taskCliSignals = ["SIGINT", "SIGTERM"] as const;

/**
 * TaskCliSignalが扱う値の構造を表す。
 *
 * @responsibility TaskCliSignalに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape TaskCliSignalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignal = (typeof taskCliSignals)[number];
/**
 * TaskCliSignalListenerが扱う値の構造を表す。
 *
 * @responsibility TaskCliSignalListenerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape TaskCliSignalListenerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalListenerで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalListenerの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalListenerはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalListenerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignalListener = () => void;
/**
 * TaskCliCancellationFailureReasonが扱う値の構造を表す。
 *
 * @responsibility TaskCliCancellationFailureReasonに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape TaskCliCancellationFailureReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliCancellationFailureReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliCancellationFailureReasonの宣言は外部境界を開かない。
 * @security N/A: TaskCliCancellationFailureReasonはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliCancellationFailureReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskCliCancellationFailureReason =
  | "task_cli_cancellation_signal_binding_failed"
  | "task_cli_cancellation_signal_release_failed";
/**
 * TaskCliSignalPortが扱う値の構造を表す。
 *
 * @responsibility TaskCliSignalPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape TaskCliSignalPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalPortの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignalPort = Readonly<{
  on: (signal: TaskCliSignal, listener: TaskCliSignalListener) => void;
  removeListener: (
    signal: TaskCliSignal,
    listener: TaskCliSignalListener,
  ) => void;
}>;

/**
 * createTaskCliCancellationLatchの処理を実行する。
 *
 * @responsibility createTaskCliCancellationLatchに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input requestCancellation: () => Promise<unknown>
 * @returns createTaskCliCancellationLatchの計算結果を返す。
 * @precondition 「requestCancellation: () => Promise<unknown>」がcreateTaskCliCancellationLatchの入力契約を満たす。
 * @postcondition createTaskCliCancellationLatchの責務を完了した結果だけを返す。
 * @effect N/A: createTaskCliCancellationLatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createTaskCliCancellationLatchは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTaskCliCancellationLatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createTaskCliCancellationLatchはProcess内の同一Subsystemで完結する。
 * @security N/A: createTaskCliCancellationLatchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency createTaskCliCancellationLatchは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createTaskCliCancellationLatch(
  requestCancellation: () => Promise<unknown>,
) {
  let cancellationPromise: Promise<unknown> | null = null;
  let observerCount = 0;
  const request = () => {
    if (cancellationPromise) return cancellationPromise;
    try {
      const observed = requestCancellation();
      if (
        !observed ||
        typeof observed !== "object" ||
        utilTypes.isProxy(observed) ||
        !utilTypes.isPromise(observed) ||
        Object.getPrototypeOf(observed) !== Promise.prototype ||
        Object.getOwnPropertyDescriptor(observed, "then") !== undefined
      )
        throw new Error("task_cli_cancellation_promise_invalid");
      cancellationPromise = observed;
    } catch (error) {
      cancellationPromise = Promise.reject(error);
    }
    observerCount += 1;
    try {
      void intrinsicPromiseThen.call(
        cancellationPromise,
        () => undefined,
        () => undefined,
      );
    } catch {
      cancellationPromise = Promise.reject(
        new Error("task_cli_cancellation_observer_failed"),
      );
      void intrinsicPromiseThen.call(
        cancellationPromise,
        () => undefined,
        () => undefined,
      );
    }
    return cancellationPromise;
  };
  return Object.freeze({
    request,
    observedPromise: () => cancellationPromise,
    observerCount: () => observerCount,
  });
}

/**
 * bindTaskCliCancellationSignalsToPortの処理を実行する。
 *
 * @responsibility bindTaskCliCancellationSignalsToPortに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input port: TaskCliSignalPort、requestCancellation: () => Promise<unknown>
 * @returns bindTaskCliCancellationSignalsToPortの計算結果を返す。
 * @precondition 「port: TaskCliSignalPort、requestCancellation: () => Promise<unknown>」がbindTaskCliCancellationSignalsToPortの入力契約を満たす。
 * @postcondition bindTaskCliCancellationSignalsToPortの責務を完了した結果だけを返す。
 * @effect N/A: bindTaskCliCancellationSignalsToPortは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure bindTaskCliCancellationSignalsToPortは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindTaskCliCancellationSignalsToPortは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: bindTaskCliCancellationSignalsToPortはProcess内の同一Subsystemで完結する。
 * @security N/A: bindTaskCliCancellationSignalsToPortはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: bindTaskCliCancellationSignalsToPortは共有非同期状態を持たない同期処理である。
 */
function bindTaskCliCancellationSignalsToPort(
  port: TaskCliSignalPort,
  requestCancellation: () => Promise<unknown>,
) {
  const cancellation = createTaskCliCancellationLatch(requestCancellation);
  const cancel = () => void cancellation.request();
  const registered = new Set<TaskCliSignal>();
  let isReleaseAttempted = false;

  const removeRegisteredListeners = () => {
    const failures: TaskCliSignal[] = [];
    for (const signal of taskCliSignals) {
      if (!registered.has(signal)) continue;
      try {
        port.removeListener(signal, cancel);
        registered.delete(signal);
      } catch {
        failures.push(signal);
      }
    }
    return Object.freeze({
      status:
        failures.length === 0 ? ("released" as const) : ("failed" as const),
      failedSignals: Object.freeze(failures),
    });
  };

  try {
    for (const signal of taskCliSignals) {
      port.on(signal, cancel);
      registered.add(signal);
    }
  } catch {
    const rollback = removeRegisteredListeners();
    void cancellation.request();
    return Object.freeze({
      status: "binding_failed" as const,
      cancellation,
      listener: cancel,
      rollback,
      unbind: () => {
        if (isReleaseAttempted)
          return Object.freeze({
            status:
              registered.size === 0
                ? ("released" as const)
                : ("failed" as const),
            failedSignals: Object.freeze([...registered]),
          });
        isReleaseAttempted = true;
        return removeRegisteredListeners();
      },
    });
  }

  return Object.freeze({
    status: "bound" as const,
    cancellation,
    listener: cancel,
    rollback: Object.freeze({
      status: "released" as const,
      failedSignals: Object.freeze([] as TaskCliSignal[]),
    }),
    unbind: () => {
      if (isReleaseAttempted)
        return Object.freeze({
          status:
            registered.size === 0 ? ("released" as const) : ("failed" as const),
          failedSignals: Object.freeze([...registered]),
        });
      isReleaseAttempted = true;
      return removeRegisteredListeners();
    },
  });
}

/**
 * bindTaskCliCancellationSignalsの処理を実行する。
 *
 * @responsibility bindTaskCliCancellationSignalsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input requestCancellation: () => Promise<unknown>
 * @returns bindTaskCliCancellationSignalsの計算結果を返す。
 * @precondition 「requestCancellation: () => Promise<unknown>」がbindTaskCliCancellationSignalsの入力契約を満たす。
 * @postcondition bindTaskCliCancellationSignalsの責務を完了した結果だけを返す。
 * @effect bindTaskCliCancellationSignalsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: bindTaskCliCancellationSignalsは独自の失敗分岐を所有しない。
 * @invariant bindTaskCliCancellationSignalsは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: bindTaskCliCancellationSignalsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: bindTaskCliCancellationSignalsは共有非同期状態を持たない同期処理である。
 */
export function bindTaskCliCancellationSignals(
  requestCancellation: () => Promise<unknown>,
) {
  return bindTaskCliCancellationSignalsToPort(
    Object.freeze({
      on: (signal, listener) => process.on(signal, listener),
      removeListener: (signal, listener) =>
        process.removeListener(signal, listener),
    }),
    requestCancellation,
  );
}

/**
 * bindTaskCliCancellationSignalsForTestingの処理を実行する。
 *
 * @responsibility bindTaskCliCancellationSignalsForTestingに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input port: TaskCliSignalPort、requestCancellation: () => Promise<unknown>
 * @returns bindTaskCliCancellationSignalsForTestingの計算結果を返す。
 * @precondition 「port: TaskCliSignalPort、requestCancellation: () => Promise<unknown>」がbindTaskCliCancellationSignalsForTestingの入力契約を満たす。
 * @postcondition bindTaskCliCancellationSignalsForTestingの責務を完了した結果だけを返す。
 * @effect N/A: bindTaskCliCancellationSignalsForTestingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: bindTaskCliCancellationSignalsForTestingは独自の失敗分岐を所有しない。
 * @invariant bindTaskCliCancellationSignalsForTestingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: bindTaskCliCancellationSignalsForTestingはProcess内の同一Subsystemで完結する。
 * @security N/A: bindTaskCliCancellationSignalsForTestingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: bindTaskCliCancellationSignalsForTestingは共有非同期状態を持たない同期処理である。
 */
export function bindTaskCliCancellationSignalsForTesting(
  port: TaskCliSignalPort,
  requestCancellation: () => Promise<unknown>,
) {
  return bindTaskCliCancellationSignalsToPort(port, requestCancellation);
}

/**
 * projectTaskCliCancellationFailureの処理を実行する。
 *
 * @responsibility projectTaskCliCancellationFailureに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input result: Result、reason: TaskCliCancellationFailureReason
 * @returns Readonly< Omit<Result, "command" | "status" | "reason"> & Readonly<{ command: "task"; status: "blocked"; reason: TaskCliCancellationFailureReason; }> >を返す。
 * @precondition 「result: Result、reason: TaskCliCancellationFailureReason」がprojectTaskCliCancellationFailureの入力契約を満たす。
 * @postcondition projectTaskCliCancellationFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectTaskCliCancellationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectTaskCliCancellationFailureは独自の失敗分岐を所有しない。
 * @invariant projectTaskCliCancellationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectTaskCliCancellationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: projectTaskCliCancellationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectTaskCliCancellationFailureは共有非同期状態を持たない同期処理である。
 */
export function projectTaskCliCancellationFailure<
  const Result extends Readonly<Record<string, unknown>> &
    Readonly<{ status: string; reason: string }>,
>(
  result: Result,
  reason: TaskCliCancellationFailureReason,
): Readonly<
  Omit<Result, "command" | "status" | "reason"> &
    Readonly<{
      command: "task";
      status: "blocked";
      reason: TaskCliCancellationFailureReason;
    }>
> {
  return Object.freeze({
    ...result,
    command: "task" as const,
    status: "blocked" as const,
    reason,
  }) as Readonly<
    Omit<Result, "command" | "status" | "reason"> &
      Readonly<{
        command: "task";
        status: "blocked";
        reason: TaskCliCancellationFailureReason;
      }>
  >;
}
