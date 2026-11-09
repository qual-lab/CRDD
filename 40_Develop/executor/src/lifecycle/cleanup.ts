/**
 * 元Snapshotの明示観測・単独回収とHome技術Leaseの解放を提供する。
 * @responsibility 資源Model・Docker操作・保存判断を再構築せずDI正本へ接続する。
 * @trace ARCH-000008
 */
import { types } from "node:util";
import {
  cleanupIsolation,
  inspectIsolation,
  type IsolationCallbacks,
  type IsolationSettings,
  type IsolationExecution,
  type ResourceTarget,
  type ResourceInspection,
  type ResourceCleanupResult,
} from "../../../docker-isolation/src/index.ts";
import type { HomeLease } from "./types.ts";

/** 元Leaseの一回解放を試み、非同期値・例外を成功へ変換しない。 @trace ARCH-000008 */
export function releaseHomeLease(homeLease: HomeLease): boolean {
  try {
    const released: unknown = homeLease.release();
    if (types.isPromise(released)) void released.catch(() => {});
    return released === true;
  } catch {
    return false;
  }
}

/** 不正な用途判別によるgetter／Proxy実行をDI接続前に拒否する。 @trace ARCH-000008 */
function validateResourceTarget(target: unknown): void {
  if (!target || typeof target !== "object" || types.isProxy(target))
    throw Error("resource_target_invalid");
  const descriptor = Object.getOwnPropertyDescriptor(target, "kind");
  if (
    descriptor &&
    (!("value" in descriptor) ||
      !["container", "docker_runtime_directory"].includes(descriptor.value))
  )
    throw Error("resource_target_invalid");
  if (!descriptor) {
    const prototype = Object.getPrototypeOf(target);
    if (prototype !== Object.prototype && prototype !== null)
      throw Error("resource_target_invalid");
  }
}

/**
 * 元資源の観測だけをDIへ委譲する。
 * @responsibility Signal・unknownと元結果を維持し、診断を回収許可にしない。
 * @trace ARCH-000008
 * @effect 対象限定のDI読取りだけ。新しい構成やRecovery状態を作らない。
 */
export function inspectResources(
  target: ResourceTarget<"snapshot", "inspect">,
  settings: IsolationSettings,
  options?: Readonly<{ signal?: AbortSignal; stopOnUnknownAbsence?: boolean }>,
): ResourceInspection<"snapshot">;
export function inspectResources(
  target: ResourceTarget<"container">,
  settings: IsolationSettings,
): ResourceInspection<"container">;
export function inspectResources(
  target: ResourceTarget<"directory", "inspect">,
  settings: IsolationSettings,
): ResourceInspection<"directory">;
export function inspectResources(
  target: ResourceTarget,
  settings: IsolationSettings,
  options?: Readonly<{ signal?: AbortSignal; stopOnUnknownAbsence?: boolean }>,
): ResourceInspection {
  validateResourceTarget(target);
  return inspectIsolation(
    target as ResourceTarget<"snapshot">,
    settings,
    options,
  );
}

/**
 * 元Snapshotの回収をDIへ委譲する。取消と最終結果は元Sessionに保持する。
 * @responsibility 通常と再入場で同じ技術契約を使い、Receiptや用途から構成を再生成しない。
 * @trace ARCH-000008
 * @effect DIの照合・元ID回収・不存在確認だけ。上位の保持・保存判断は行わない。
 */
export function cleanupResources(
  target: ResourceTarget<"snapshot">,
  settings: IsolationSettings,
  callbacks?: IsolationCallbacks,
): IsolationExecution;
export function cleanupResources(
  target: ResourceTarget<"container">,
  settings: IsolationSettings,
): ResourceCleanupResult<"container">;
export function cleanupResources(
  target: ResourceTarget<"directory", "cleanup">,
  settings: IsolationSettings,
): Promise<ResourceCleanupResult<"directory">>;
export function cleanupResources(
  target: ResourceTarget,
  settings: IsolationSettings,
  callbacks: IsolationCallbacks = {},
):
  | IsolationExecution
  | ResourceCleanupResult<"container">
  | Promise<ResourceCleanupResult<"directory">> {
  validateResourceTarget(target);
  return cleanupIsolation(
    target as ResourceTarget<"snapshot">,
    settings,
    callbacks,
  );
}
