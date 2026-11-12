/**
 * 設定保存だけの固定Repository配置を観測・準備する。
 * @responsibility config以外のRuntime領域を扱わず、元の実体確認・Ignore結果を保持する。
 * @trace ARCH-000011
 * @boundary 検証済みVC RootとRepository-localの設定Directory。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  type Repository,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

/** 設定Owner内部だけで固定Pathを作る。任意領域の要求を受け付けない。 */
export function configurationPaths(repository: Repository) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(repository);
  if (
    !repositoryRoot ||
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  )
    return null;
  const root = path.join(repositoryRoot, ".crdd");
  return Object.freeze({
    repositoryRoot,
    root,
    config: path.join(root, "config"),
  });
}

/** 読取りだけで真正不存在・境界不正・観測不能を区別する。 */
export function observeConfigurationDirectory(repository: Repository) {
  try {
    const paths = configurationPaths(repository);
    if (!paths)
      return Object.freeze({
        status: "blocked" as const,
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false as const,
      });
    const identities: string[] = [];
    for (const target of [paths.root, paths.config]) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed" as const,
            reason: "repository_runtime_data_area_absent",
            effectIssued: false as const,
          });
        throw error;
      }
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target
      )
        return Object.freeze({
          status: "blocked" as const,
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false as const,
        });
      const canonical = fs.lstatSync(fs.realpathSync.native(target), {
        bigint: true,
      });
      if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
        return Object.freeze({
          status: "blocked" as const,
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false as const,
        });
      identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    return Object.freeze({
      status: "ready" as const,
      repositoryRoot: paths.repositoryRoot,
      directory: paths.config,
      boundaryIdentity: createHash("sha256")
        .update(identities.join("\0"))
        .digest("hex"),
      effectIssued: false as const,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_area_observation_failed",
      effectIssued: false as const,
    });
  }
}

/** 設定保存の明示要求だけが既存Ignore登録後に固定Directoryを準備する。 */
export function ensureConfigurationDirectory(repository: Repository) {
  const paths = configurationPaths(repository);
  if (!paths) return null;
  const ignore = registerRepositoryLocalIgnore(repository, ".crdd/");
  if (ignore.status !== "registered")
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_ignore_registration_blocked" as const,
      effectIssued: ignore.effectIssued,
      effectStateUnknown: ignore.effectStateUnknown,
      effectConfirmation: ignore.effectConfirmation,
      cleanupConfirmed: ignore.cleanupConfirmed,
      retryAllowed: ignore.retryAllowed,
      recoveryReference: ignore.recoveryReference,
      repositoryPathReported: false as const,
    });
  for (const target of [paths.root, paths.config]) {
    try {
      fs.mkdirSync(target, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const metadata = fs.lstatSync(target);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("runtime_data_area_boundary_invalid");
  }
  return Object.freeze({
    status: "ready" as const,
    repositoryRoot: paths.repositoryRoot,
    directory: paths.config,
  });
}
