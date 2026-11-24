/**
 * 与えられた一時領域内で、この検証が所有する作業Directoryを管理する。
 * @responsibility 一時領域を探索・準備せず、今回の作業物だけを作成して回収する。
 * @trace ARCH-000003
 */
import fs from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

/** Linkを経由しない既存Directoryの実体を取得する。 @trace ARCH-000003 */
function observeDirectory(directory: string): fs.BigIntStats {
  try {
    const observed = fs.lstatSync(directory, { bigint: true });
    if (
      observed.isDirectory() &&
      !observed.isSymbolicLink() &&
      fs.realpathSync.native(directory) === directory
    )
      return observed;
  } catch {
    // 公開診断にはOSエラーの絶対Pathを返さない。
  }
  throw new Error("visual_temporary_directory_invalid");
}

/** 指定済み一時領域の子を一つ作り、同じ実体を確認できる場合だけ回収する。 @trace ARCH-000003 */
export function createVerificationTemporaryDirectory(
  temporaryDirectory: string,
  prefix: "visual-browser-zoom-" | "local-web-visual-",
) {
  if (
    typeof temporaryDirectory !== "string" ||
    !path.isAbsolute(temporaryDirectory) ||
    /[\u0000-\u001f\u007f]/u.test(temporaryDirectory)
  )
    throw new Error("visual_temporary_directory_invalid");
  const parent = path.resolve(temporaryDirectory);
  const parentIdentity = observeDirectory(parent);
  const sameDirectory = (left: fs.BigIntStats, right: fs.BigIntStats) =>
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs;
  let directory: string;
  try {
    directory = fs.mkdtempSync(path.join(parent, prefix));
  } catch {
    throw new Error("visual_temporary_directory_creation_failed");
  }
  const identity = observeDirectory(directory);
  if (!sameDirectory(observeDirectory(parent), parentIdentity))
    throw new Error("visual_temporary_directory_changed");
  return Object.freeze({
    directory,
    async remove() {
      if (
        !sameDirectory(observeDirectory(parent), parentIdentity) ||
        !sameDirectory(observeDirectory(directory), identity)
      )
        throw new Error("visual_temporary_directory_changed");
      try {
        await rm(directory, {
          recursive: true,
          force: false,
          maxRetries: 10,
          retryDelay: 200,
        });
      } catch {
        throw new Error("visual_temporary_directory_cleanup_failed");
      }
      try {
        fs.lstatSync(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
        throw new Error("visual_temporary_directory_cleanup_unconfirmed");
      }
      return false;
    },
  });
}
