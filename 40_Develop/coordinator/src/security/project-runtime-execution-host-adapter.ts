import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  createRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import type {
  ProjectRuntimeClockIdentityPort,
  ProjectRuntimeProcessSafetyPort,
} from "../../../project-runtime/src/index.ts";

export type ProjectRuntimeExecutionHostAdapterOptions = Readonly<{
  now?: ProjectRuntimeClockIdentityPort["now"];
  poisonAfterCleanupUnknown?: ProjectRuntimeProcessSafetyPort["poisonAfterCleanupUnknown"];
}>;

/** Build the Host-owned capabilities required by Project Runtime execution. */
export function createProjectRuntimeExecutionHostPorts(
  options: ProjectRuntimeExecutionHostAdapterOptions = {},
) {
  return Object.freeze({
    clockIdentity: Object.freeze({
      now:
        options.now ??
        (() =>
          Object.freeze({
            monotonicMs: performance.now(),
            iso: new Date().toISOString(),
          })),
      createStableId: (prefix: string, parts: readonly string[]) =>
        `${prefix}-${createHash("sha256")
          .update(parts.join("\0"))
          .digest("hex")
          .slice(0, 40)}`,
    }) satisfies ProjectRuntimeClockIdentityPort,
    processSafety: Object.freeze({
      createRecoveryIdentity: createRuntimeProcessRecoveryIdentity,
      poisonAfterCleanupUnknown:
        options.poisonAfterCleanupUnknown ??
        poisonRuntimeProcessAfterCleanupUnknown,
    }) satisfies ProjectRuntimeProcessSafetyPort,
  });
}
