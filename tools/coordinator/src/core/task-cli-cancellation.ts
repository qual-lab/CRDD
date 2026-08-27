import { types as utilTypes } from "node:util";

const INTRINSIC_PROMISE_THEN = Promise.prototype.then;

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
