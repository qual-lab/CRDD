import { types as utilTypes } from "node:util";

const INTRINSIC_PROMISE_THEN = Promise.prototype.then;
const TASK_CLI_SIGNALS = ["SIGINT", "SIGTERM"] as const;

type TaskCliSignal = (typeof TASK_CLI_SIGNALS)[number];
type TaskCliSignalListener = () => void;
type TaskCliSignalPort = Readonly<{
  on: (signal: TaskCliSignal, listener: TaskCliSignalListener) => void;
  removeListener: (
    signal: TaskCliSignal,
    listener: TaskCliSignalListener,
  ) => void;
}>;

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
      void INTRINSIC_PROMISE_THEN.call(
        cancellationPromise,
        () => undefined,
        () => undefined,
      );
    } catch {
      cancellationPromise = Promise.reject(
        new Error("task_cli_cancellation_observer_failed"),
      );
      void INTRINSIC_PROMISE_THEN.call(
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

function bindTaskCliCancellationSignalsToPort(
  port: TaskCliSignalPort,
  requestCancellation: () => Promise<unknown>,
) {
  const cancellation = createTaskCliCancellationLatch(requestCancellation);
  const cancel = () => void cancellation.request();
  const registered = new Set<TaskCliSignal>();
  let releaseAttempted = false;

  const removeRegisteredListeners = () => {
    const failures: TaskCliSignal[] = [];
    for (const signal of TASK_CLI_SIGNALS) {
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
    for (const signal of TASK_CLI_SIGNALS) {
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
        if (releaseAttempted)
          return Object.freeze({
            status:
              registered.size === 0
                ? ("released" as const)
                : ("failed" as const),
            failedSignals: Object.freeze([...registered]),
          });
        releaseAttempted = true;
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
      if (releaseAttempted)
        return Object.freeze({
          status:
            registered.size === 0 ? ("released" as const) : ("failed" as const),
          failedSignals: Object.freeze([...registered]),
        });
      releaseAttempted = true;
      return removeRegisteredListeners();
    },
  });
}

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

export function bindTaskCliCancellationSignalsForTesting(
  port: TaskCliSignalPort,
  requestCancellation: () => Promise<unknown>,
) {
  return bindTaskCliCancellationSignalsToPort(port, requestCancellation);
}
