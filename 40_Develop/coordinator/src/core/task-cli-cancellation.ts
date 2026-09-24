/**
 * task-cli-cancellationに属する責務をまとめる。
 *
 * @responsibility TaskCliSignalを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { types as utilTypes } from "node:util";

const intrinsicPromiseThen = Promise.prototype.then;
const taskCliSignals = ["SIGINT", "SIGTERM"] as const;

/**
 * task-cli-cancellationで使用するTask Cli Signalの値契約を定義する。
 *
 * @responsibility Task Cli SignalのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCliSignalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignal = (typeof taskCliSignals)[number];
/**
 * task-cli-cancellationで使用するTask Cli Signal Listenerの値契約を定義する。
 *
 * @responsibility Task Cli Signal ListenerのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCliSignalListenerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalListenerで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalListenerの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalListenerはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalListenerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignalListener = () => void;
/**
 * task-cli-cancellationで使用するTask Cli Cancellation 失敗 Reasonの値契約を定義する。
 *
 * @responsibility Task Cli Cancellation 失敗 ReasonのProperty、Identity、状態制約を型境界として所有する。
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
 * task-cli-cancellationで使用するTask Cli Signal Portの値契約を定義する。
 *
 * @responsibility Task Cli Signal PortのProperty、Identity、状態制約を型境界として所有する。
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
 * Task Cli Cancellation Latchを構築する。
 *
 * @responsibility Task Cli Cancellation Latchの構築入力、生成結果、不正入力の拒否境界を所有する。
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
 * Task Cli Cancellation Signals To PortをIdentityへ結合する。
 *
 * @responsibility Task Cli Cancellation Signals To Portの結合条件、相関Identity、不一致の拒否境界を所有する。
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
 * Task Cli Cancellation SignalsをIdentityへ結合する。
 *
 * @responsibility Task Cli Cancellation Signalsの結合条件、相関Identity、不一致の拒否境界を所有する。
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
 * Task Cli Cancellation Signals For TestingをIdentityへ結合する。
 *
 * @responsibility Task Cli Cancellation Signals For Testingの結合条件、相関Identity、不一致の拒否境界を所有する。
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
 * Task Cli Cancellation 失敗を公開結果へ投影する。
 *
 * @responsibility Task Cli Cancellation 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
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
