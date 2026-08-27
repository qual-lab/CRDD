import { EventEmitter } from "node:events";

import { bindTaskCliCancellationSignalsForTesting } from "../../src/core/task-cli-cancellation.ts";

const scenario = process.argv[2];
if (
  !["sync_throw", "async_reject", "malformed", "never"].includes(scenario ?? "")
)
  throw new Error("task_cli_cancellation_probe_scenario_invalid");

let cancellationEffects = 0;
let outputCount = 0;
const signals = new EventEmitter();
const binding = bindTaskCliCancellationSignalsForTesting(
  {
    on: (signal, listener) => signals.on(signal, listener),
    removeListener: (signal, listener) =>
      signals.removeListener(signal, listener),
  },
  () => {
    cancellationEffects += 1;
    if (scenario === "sync_throw") throw new Error("fixed_sync_throw");
    if (scenario === "async_reject")
      return Promise.reject(new Error("fixed_async_reject"));
    if (scenario === "malformed")
      return Object.freeze({
        status: "requested",
      }) as unknown as Promise<unknown>;
    return new Promise<never>(() => undefined);
  },
);
signals.emit("SIGINT");
signals.emit("SIGTERM");
signals.emit("SIGINT");

await new Promise<void>((resolve) => setImmediate(resolve));
binding.unbind();
outputCount += 1;
process.stdout.write(
  `${JSON.stringify({
    scenario,
    cancellationEffects,
    observerCount: binding.cancellation.observerCount(),
    sigintListeners: signals.listenerCount("SIGINT"),
    sigtermListeners: signals.listenerCount("SIGTERM"),
    outputCount,
  })}\n`,
);
