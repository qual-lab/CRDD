/**
 * RepositoryのReader・Writer・Recoveryが共有するCurrentState wx排他を所有する。
 * @trace ARCH-000008
 * @boundary 旧OS方式との混在・残存の自動回復は認めない。
 */
import fs from "node:fs";
import path from "node:path";
import { acquireLock, type LockResult } from "../../../lock/src/index.ts";

/** Rootを再検証し、保存OwnerとしてRepository内の固定Lock所在を準備する。 */
export function acquireRuntimeStateLock(
  repositoryRootHash: unknown,
  repositoryRoot: string,
): LockResult {
  const refused: LockResult = Object.freeze({
    status: "blocked",
    reason: "lock_input_invalid",
    reference: null,
    cleanupConfirmed: true,
    descriptorClosed: true,
  });
  if (
    typeof repositoryRootHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(repositoryRootHash) ||
    typeof repositoryRoot !== "string" ||
    !path.isAbsolute(repositoryRoot)
  )
    return refused;
  try {
    const root = fs.lstatSync(repositoryRoot);
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot
    )
      return refused;
    const directory = path.join(repositoryRoot, ".crdd");
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "EEXIST"
      )
        return refused;
    }
    const result = acquireLock({
      directory,
      name: `current-state.${repositoryRootHash}.lock`,
      identity: `current-state:${repositoryRootHash}`,
    });
    return result;
  } catch {
    return refused;
  }
}
