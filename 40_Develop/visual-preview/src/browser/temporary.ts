/**
 * ブラウザー検証だけが使う固定tmp領域を準備する。
 * @responsibility 検証済みRepository、Ignore登録、通常Directoryの境界を保つ。
 * @trace ARCH-000003
 * @boundary 他モデルやCoordinatorの保存処理を利用しない。
 */
import fs from "node:fs";
import path from "node:path";
import {
  getRepositoryFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
  registerRepositoryLocalIgnore,
} from "../../../version-control/src/index.ts";

/** 固定検証Rootを準備し、部分Effectの情報を消さず拒否する。 */
export function prepareVerificationTemporaryArea(
  workingDirectory: string,
  invalidReason: string,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  if (verified.status !== "completed") throw new Error(invalidReason);
  const repositoryRoot = resolveVerifiedRepositoryRoot(verified.capability);
  if (repositoryRoot === null) throw new Error(invalidReason);
  const ignore = registerRepositoryLocalIgnore(verified.capability, ".crdd/");
  if (ignore.status !== "registered") {
    throw Object.assign(new Error(ignore.reason), ignore);
  }
  const root = path.join(repositoryRoot, ".crdd");
  const directory = path.join(root, "tmp");
  for (const target of [root, directory]) {
    try {
      fs.mkdirSync(target, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const observed = fs.lstatSync(target);
    if (
      !observed.isDirectory() ||
      observed.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("runtime_data_area_boundary_invalid");
    }
  }
  return Object.freeze({ directory });
}
