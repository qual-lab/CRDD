/**
 * 単段実行・AIツール認証・Attempt資源回収とHost環境の技術窓口を公開する。
 * @packageDocumentation
 * @responsibility 単発実行、対象別の資源観測・回収、環境観測・再起動・修復と必要な型だけを明示公開する。
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @boundary 上位判断と下位技術処理の間。Taskの順序・Queue・再試行・保存は所有しない。
 */
// 構成と一試行の生涯。startのcompletionは清掃を含む終了まで待つ。
import { types } from "node:util";
import { createAttemptExecutor } from "./attempt/operations.ts";
import type { DockerIsolationRuntimeOptions } from "./attempt/types.ts";
import { createAuthenticationExecutor } from "./authentication/operations.ts";
import type { AuthenticationOptions } from "./authentication/types.ts";
import type { Executor, ExecutorRequest } from "./lifecycle/types.ts";
import { createIsolationProbe } from "./probe/operations.ts";
import type { IsolationProbeOptions } from "./probe/types.ts";

/**
 * 用途別の確定入力を既存のOperationへ結合する共通公開入口。
 * @responsibility 準備を内部に閉じ、実行・取消・清掃を含む完了を返す。
 * @trace ARCH-000008
 * @input request: 単段実行・認証・固定Probe。options: 用途に必要な既存接続。
 * @returns 用途に対応した一回限りのExecutor、準備拒否はnull。
 * @effect 準備だけ。Docker操作はstart後に限定する。
 * @failure 別用途への切替・自動再送は行わない。
 * @invariant 保存・Task順序・保持判断を所有しない。
 */
export function createExecutor(
  request: ExecutorRequest<"attempt">,
  options: DockerIsolationRuntimeOptions,
  random?: Readonly<{ randomBytes: (size: number) => Buffer }>,
): Executor<"attempt"> | null;
export function createExecutor(
  request: ExecutorRequest<"authentication">,
  options: AuthenticationOptions,
): Executor<"authentication"> | null;
export function createExecutor(
  request: ExecutorRequest<"isolation_probe">,
  options: IsolationProbeOptions,
): Executor<"isolation_probe"> | null;
export function createExecutor(
  request:
    | ExecutorRequest<"attempt">
    | ExecutorRequest<"authentication">
    | ExecutorRequest<"isolation_probe">,
  options?:
    | DockerIsolationRuntimeOptions
    | IsolationProbeOptions
    | AuthenticationOptions,
  random?: Readonly<{ randomBytes: (size: number) => Buffer }>,
):
  | Executor<"attempt">
  | Executor<"authentication">
  | Executor<"isolation_probe">
  | null {
  if (!request || typeof request !== "object" || types.isProxy(request))
    return null;
  const kind = Object.getOwnPropertyDescriptor(request, "kind")?.value;
  if (kind === "isolation_probe")
    return createIsolationProbe(
      request as ExecutorRequest<"isolation_probe">,
      options as IsolationProbeOptions,
    );
  if (kind === "authentication") {
    if (Object.hasOwn(request, "purpose")) return null;
    const action = Object.getOwnPropertyDescriptor(request, "action")?.value;
    if (action !== "status" && action !== "login") return null;
    if (!options || typeof options !== "object" || types.isProxy(options))
      return null;
    if (
      Object.getPrototypeOf(options) !== Object.prototype &&
      Object.getPrototypeOf(options) !== null
    )
      return null;
    const descriptor = Object.getOwnPropertyDescriptor(
      options,
      "managementDirectory",
    );
    if (
      Reflect.ownKeys(options).length !== 1 ||
      !descriptor ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    )
      return null;
    return createAuthenticationExecutor(
      request as ExecutorRequest<"authentication">,
      descriptor.value,
    );
  }
  if (Object.hasOwn(request, "action")) return null;
  if (kind !== "attempt") return null;
  return createAttemptExecutor(
    request as ExecutorRequest<"attempt">,
    options as DockerIsolationRuntimeOptions,
    random,
  );
}

export type {
  DockerEnvironmentRequest,
  DockerEnvironmentResult,
  DockerEnvironmentStatus,
  DockerEnvironmentRestartEvent,
} from "../../docker-isolation/src/index.ts";
export {
  inspectDockerEnvironment,
  restartDockerEnvironment,
} from "../../docker-isolation/src/index.ts";
export type {
  AttemptCancelInput,
  AttemptDiagnosticNotice,
  AttemptFailureReason,
  AttemptResultReason,
  AttemptTerminalObservation,
  PrimaryFailureDiagnostic,
  ProcessStartedNotice,
} from "./attempt/types.ts";
export type { AuthenticationOptions } from "./authentication/types.ts";
export type {
  ExecutorCallbacks,
  ResourceCleanupCallbacks,
} from "./lifecycle/callbacks.ts";
export {
  cleanupResources,
  inspectResources,
} from "./lifecycle/cleanup.ts";
export type {
  ResourceTarget,
  ResourceInspection,
  ResourceCleanupResult,
  CancelArguments,
  CancelResult,
  CompletionResult,
  Executor,
  ExecutorRequest,
  RecordProjection,
  StartInput,
  StartResult,
} from "./lifecycle/types.ts";
export type {
  IsolationProbeFacts,
  IsolationProbeOptions,
} from "./probe/types.ts";
