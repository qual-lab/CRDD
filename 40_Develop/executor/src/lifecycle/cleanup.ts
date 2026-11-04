/**
 * 共通Lifecycleと単独再入場をDI正本の資源APIへ接続する。
 * @packageDocumentation
 * @responsibility 通知と元結果を搬送し、資源探索・構成照合・削除を再実装しない。
 * @trace ARCH-000008
 * @boundary 保存・許可・保持判断は上位、技術処置はDI。
 */
import { types as utilTypes } from "node:util";
import {
  cleanupIsolation,
  type ResourceCleanupResult as IsolationResourceCleanupResult,
  type ResourceInspection as IsolationResourceInspection,
  inspectIsolation,
  type ResourceTarget as IsolationResourceTarget,
} from "../../../docker-isolation/src/index.ts";
import {
  cleanupAttemptResources,
  inspectAttemptResources,
} from "../attempt/recovery.ts";
import type {
  DockerResourceCleanupObservation,
  DockerResourceReceipts,
  HomeLease,
  ResourceCleanupResult,
  ResourceInspection,
  ResourceTarget,
} from "../attempt/types.ts";
import { cleanupAuthenticationResources } from "../authentication/operations.ts";
import type { AuthenticationCleanupResult } from "../authentication/types.ts";
import type { ResourceCleanupCallbacks } from "./callbacks.ts";
import type { AuthenticationResourceTarget } from "./types.ts";

/**
 * 保持中のHome技術Leaseを一回解放する。
 * @responsibility Promise・例外・falseを解放成功へ変換しない。
 * @trace ARCH-000008
 * @precondition 呼出し元が実行終了又は開始前拒否を確認している。
 * @postcondition 同じ呼出し内で解放を再試行しない。
 * @effect 元Home Leaseのreleaseを一回だけ呼ぶ。
 */
export function releaseHomeLease(homeLease: HomeLease): boolean {
  try {
    const released: unknown = homeLease.release();
    if (utilTypes.isPromise(released)) void released.catch(() => {});
    return released === true;
  } catch {
    return false;
  }
}

/**
 * 対象の現在観測だけを返す。診断の先行実行を回収の条件にしない。
 * @responsibility 元情報をDIへ渡し、unknownを不存在へ変換しない。
 * @trace ARCH-000008
 * @input target: 確定した技術対象。purpose: 資源集合の限定観測。
 * @returns 資源観測又はDirectoryの元結果。
 * @effect DIによる読取りと自作configの取得・終了。
 * @failure 不明は元参照を保持したblocked又はnull。
 */
export function inspectResources(
  target: ResourceTarget,
  purpose?: keyof DockerResourceReceipts,
): ResourceInspection;
export function inspectResources(
  target: IsolationResourceTarget<"directory", "inspect">,
): IsolationResourceInspection<"directory">;
export function inspectResources(
  target: IsolationResourceTarget<"container">,
): IsolationResourceInspection<"container">;
export function inspectResources(
  target:
    | ResourceTarget
    | IsolationResourceTarget<"directory", "inspect">
    | IsolationResourceTarget<"container">,
  purpose?: keyof DockerResourceReceipts,
):
  | ResourceInspection
  | IsolationResourceInspection<"directory">
  | IsolationResourceInspection<"container">
  | null {
  if (utilTypes.isProxy(target)) throw Error("resource_target_invalid");
  if (target?.kind === "docker_runtime_directory")
    return inspectIsolation(target);
  if (target?.kind === "container") return inspectIsolation(target);
  return inspectAttemptResources(target, purpose);
}

/**
 * 確定した資源をDIで回収し、元の技術結果を返す。
 * @responsibility 上位への逆照会や保存判断を追加せず、必要通知と完了を搬送する。
 * @trace ARCH-000008
 * @input target: 元資源の技術情報。callbacks: 保存方法を知らない通知。
 * @returns 技術回収の結果。Process終了や保存を推測しない。
 * @effect DIの実体照合・元ID削除・現在不存在確認だけ。
 * @failure 不明時は同じ対象参照と回収未確認を保持する。
 */
export function cleanupResources(
  target: AuthenticationResourceTarget,
): Promise<AuthenticationCleanupResult>;
export function cleanupResources(
  target: ResourceTarget,
  callbacks?: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  >,
): Promise<ResourceCleanupResult>;
export function cleanupResources(
  target: IsolationResourceTarget<"directory", "cleanup">,
): Promise<IsolationResourceCleanupResult<"directory">>;
export function cleanupResources(
  target: IsolationResourceTarget<"container">,
): IsolationResourceCleanupResult<"container">;
export function cleanupResources(
  target:
    | ResourceTarget
    | IsolationResourceTarget<"directory", "cleanup">
    | AuthenticationResourceTarget
    | IsolationResourceTarget<"container">,
  callbacks: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  > = {},
):
  | Promise<ResourceCleanupResult>
  | Promise<IsolationResourceCleanupResult<"directory">>
  | Promise<AuthenticationCleanupResult>
  | IsolationResourceCleanupResult<"container"> {
  if (utilTypes.isProxy(target)) throw Error("resource_target_invalid");
  if (target?.kind === "docker_runtime_directory")
    return cleanupIsolation(target);
  if (target?.kind === "authentication") {
    target.signal?.throwIfAborted();
    return cleanupAuthenticationResources(target);
  }
  if (target?.kind === "container") return cleanupIsolation(target);
  return cleanupAttemptResources(target, callbacks);
}
