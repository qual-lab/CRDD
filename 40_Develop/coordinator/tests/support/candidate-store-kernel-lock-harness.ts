import type { ChildProcess } from "node:child_process";

import {
  type HostOperationSupervisorLockOutcome,
  type InteractiveConsoleKernelLockOutcome,
  prepareHostOperationSupervisorLockRequest,
} from "../../src/security/candidate-store-kernel-lock.ts";
import {
  prepareInteractiveConsoleKernelLockRequest,
  runHostOperationSupervisorLifecycle,
  runInteractiveConsoleKernelLockLifecycle,
} from "../../src/security/candidate-store-kernel-lock-lifecycle-internal.ts";

type InteractiveWorker = Parameters<
  typeof runInteractiveConsoleKernelLockLifecycle
>[0];

export async function acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
  workerFactory: (
    pipeName: string,
    sharedState: SharedArrayBuffer,
  ) => InteractiveWorker,
): Promise<InteractiveConsoleKernelLockOutcome> {
  const request = prepareInteractiveConsoleKernelLockRequest();
  if (!request) return Object.freeze({ status: "unavailable", lock: null });
  let worker: InteractiveWorker;
  try {
    worker = workerFactory(request.pipeName, request.sharedState);
  } catch {
    return Object.freeze({ status: "cleanup_unknown", lock: null });
  }
  return runInteractiveConsoleKernelLockLifecycle(worker, request.sharedState);
}

export async function acquireHostOperationSupervisorLockUsingChildFactory(
  rootName: unknown,
  nonce: unknown,
  childFactory: (
    pipeName: string,
    environment: NodeJS.ProcessEnv,
  ) => ChildProcess,
  timing: Readonly<{
    acquireTimeoutMs: number;
    releaseTimeoutMs: number;
  }> = Object.freeze({ acquireTimeoutMs: 1_000, releaseTimeoutMs: 1_000 }),
): Promise<HostOperationSupervisorLockOutcome> {
  const request = prepareHostOperationSupervisorLockRequest(
    rootName,
    nonce,
    timing,
  );
  if (!request) return Object.freeze({ status: "unavailable", lock: null });
  let child: ChildProcess;
  try {
    child = childFactory(request.pipeName, request.environment);
  } catch {
    return Object.freeze({ status: "cleanup_confirmed_failure", lock: null });
  }
  return runHostOperationSupervisorLifecycle(request, child);
}
