/**
 * PAの固定試験vectorと故障注入を技術lifecycleへ接続する。
 *
 * @packageDocumentation
 * @responsibility Host・Supervisor・対話Lockの所有結果とReader操作を試験へ搬送する。
 * @trace ERB-IT-003
 * @level IT
 * @scope Runtime共通／Hostの排他
 * @boundary 試験用子Process→Native Kernel Lock。実Storeの採用・変更は行わない。
 */
import type { ChildProcess } from "node:child_process";
import type {
  HostOperationSupervisorLockOutcome,
  InteractiveConsoleKernelLockOutcome,
} from "../../src/index.ts";
import { createWindowsHostOperationSupervisorEnvironment } from "../../src/index.ts";

import {
  runHostOperationSupervisorLifecycle,
  runInteractiveConsoleKernelLockLifecycle,
} from "../../src/lock/lifecycle.ts";

type InteractiveWorker = Parameters<
  typeof runInteractiveConsoleKernelLockLifecycle
>[0];

export async function acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
  workerFactory: (
    pipeName: string,
    sharedState: SharedArrayBuffer,
  ) => InteractiveWorker,
): Promise<InteractiveConsoleKernelLockOutcome> {
  const request = {
    pipeName:
      "\\\\.\\pipe\\CRDD.Coordinator.InteractiveConsole.35c9e1deadacbe764ea5d49063605059",
  };
  const sharedState = new SharedArrayBuffer(4);
  let worker: InteractiveWorker;
  try {
    worker = workerFactory(request.pipeName, sharedState);
  } catch {
    return Object.freeze({ status: "cleanup_unknown", lock: null });
  }
  return runInteractiveConsoleKernelLockLifecycle(worker, sharedState);
}

export async function acquireHostOperationSupervisorLockUsingChildFactory(
  _rootName: unknown,
  _nonce: unknown,
  childFactory: (
    pipeName: string,
    environment: NodeJS.ProcessEnv,
  ) => ChildProcess,
  timing: Readonly<{
    acquireTimeoutMs: number;
    releaseTimeoutMs: number;
  }> = Object.freeze({ acquireTimeoutMs: 1_000, releaseTimeoutMs: 1_000 }),
): Promise<HostOperationSupervisorLockOutcome> {
  const request = {
    pipeName:
      "\\\\.\\pipe\\CRDD.Coordinator.HostOperation.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    timing,
  };
  const environment = createWindowsHostOperationSupervisorEnvironment();
  if (!environment) return Object.freeze({ status: "unavailable", lock: null });
  const fixedRequest = Object.freeze({ ...request, environment });
  let child: ChildProcess;
  try {
    child = childFactory(request.pipeName, environment);
  } catch {
    return Object.freeze({ status: "cleanup_confirmed_failure", lock: null });
  }
  return runHostOperationSupervisorLifecycle(fixedRequest, child);
}
