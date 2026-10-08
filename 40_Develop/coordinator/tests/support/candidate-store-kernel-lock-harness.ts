/**
 * Candidate StoreのKernel Lock操作を試験用Processへ接続する。
 *
 * @packageDocumentation
 * @responsibility Host・Supervisor・対話Lockの所有結果とReader操作を試験へ搬送する。
 * @trace CPR-IT-001
 * @trace ERB-IT-003
 * @level IT
 * @scope Candidate Store／Hostの排他
 * @boundary 試験用子Process→Native Kernel Lock。実Storeの採用・変更は行わない。
 */
import type { ChildProcess } from "node:child_process";

import {
  type HostOperationSupervisorLockOutcome,
  type InteractiveConsoleKernelLockOutcome,
  prepareHostOperationSupervisorLockRequest,
} from "../../src/host-execution/kernel-lock.ts";
import {
  prepareInteractiveConsoleKernelLockRequest,
  runHostOperationSupervisorLifecycle,
  runInteractiveConsoleKernelLockLifecycle,
} from "../../src/host-execution/kernel-lock-lifecycle.ts";

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
