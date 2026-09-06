import type { ChildProcess } from "node:child_process";

import {
  acquireHostOperationSupervisorLockUsingChild,
  acquireInteractiveConsoleKernelLockOutcomeUsingWorker,
  type HostOperationSupervisorLockOutcome,
  type InteractiveConsoleKernelLockOutcome,
  prepareHostOperationSupervisorLockRequest,
  prepareInteractiveConsoleKernelLockRequest,
} from "../../src/security/candidate-store-kernel-lock.ts";

type InteractiveWorker = Parameters<
  typeof acquireInteractiveConsoleKernelLockOutcomeUsingWorker
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
  return acquireInteractiveConsoleKernelLockOutcomeUsingWorker(
    worker,
    request.sharedState,
  );
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
  return acquireHostOperationSupervisorLockUsingChild(request, child);
}
