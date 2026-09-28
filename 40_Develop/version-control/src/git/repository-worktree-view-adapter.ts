/**
 * Git Repository WorktreeのPathとPatchを読取るAdapter。
 *
 * @packageDocumentation
 * @responsibility Git CLIのPath／Patch出力をVersion Control公開観測へ適合する。
 * @trace ARCH-000002 ARCH-000009
 * @boundary Git ProcessとRepository Worktree View Portの境界。
 * @effect Git MetadataとWorktreeを読取るだけである。
 * @security Shellを使わず固定Commandと`--`区切りだけを実行する。
 */
import { spawnSync } from "node:child_process";

import type { RepositoryWorktreeViewAdapter } from "../repository-worktree-view.ts";

const MAX_PATCH_BYTES = 256 * 1_024;

/** Git Commandを固定Repository Rootで実行する。 */
function run(repositoryRoot: string, arguments_: readonly string[]) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "buffer",
    windowsHide: true,
    shell: false,
    timeout: 30_000,
    maxBuffer: 2 * 1_024 * 1_024,
  });
  if (result.error !== undefined || result.status !== 0)
    throw new Error("repository_worktree_observation_failed");
  return result.stdout;
}

/** Patchを固定上限へ切り詰め、UTF-8 Textへ変換する。 */
function patchText(
  bytes: Buffer,
): Readonly<{ text: string; truncated: boolean }> {
  const truncated = bytes.byteLength > MAX_PATCH_BYTES;
  return Object.freeze({
    text: new TextDecoder("utf-8").decode(
      truncated ? bytes.subarray(0, MAX_PATCH_BYTES) : bytes,
    ),
    truncated,
  });
}

/** Git CLIを使うRepository Worktree View Adapterを構築する。 */
export const gitRepositoryWorktreeViewAdapter: RepositoryWorktreeViewAdapter = (
  repositoryRoot,
) => {
  const paths = Object.freeze(
    new TextDecoder("utf-8", { fatal: true })
      .decode(
        run(repositoryRoot, [
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          "-z",
        ]),
      )
      .split("\0")
      .filter(Boolean),
  );
  return Object.freeze({
    paths,
    readPatch(selectedPath: string) {
      const prepared = patchText(
        run(repositoryRoot, [
          "diff",
          "--cached",
          "--no-ext-diff",
          "--no-renames",
          "--unified=3",
          "--",
          selectedPath,
        ]),
      );
      const working = patchText(
        run(repositoryRoot, [
          "diff",
          "--no-ext-diff",
          "--no-renames",
          "--unified=3",
          "--",
          selectedPath,
        ]),
      );
      return Object.freeze({
        preparedPatch: prepared.text,
        workingPatch: working.text,
        preparedTruncated: prepared.truncated,
        workingTruncated: working.truncated,
      });
    },
  });
};
