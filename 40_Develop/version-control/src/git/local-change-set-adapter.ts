import { type SpawnSyncReturns, spawnSync } from "node:child_process";

import type {
  LocalChangeSetAdapter,
  LocalChangeSetObservation,
} from "../local-change-set.ts";

export type GitLocalChangeSetProcessResult = Pick<
  SpawnSyncReturns<Buffer>,
  "error" | "status" | "stdout"
>;

export type GitLocalChangeSetCommandRunner = (
  commandArguments: readonly string[],
) => GitLocalChangeSetProcessResult;

function parsePaths(
  result: GitLocalChangeSetProcessResult,
  phase: string,
): readonly string[] {
  if (result.error !== undefined || result.status !== 0)
    throw new Error(`local_change_set_observation_failed:${phase}`);
  return Object.freeze(
    new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .split("\0")
      .filter(Boolean),
  );
}

export function createGitLocalChangeSetAdapter(
  commandRunner?: GitLocalChangeSetCommandRunner,
): LocalChangeSetAdapter {
  return (repositoryRoot, comparisonBase): LocalChangeSetObservation => {
    const runCommand =
      commandRunner ??
      ((commandArguments: readonly string[]) =>
        spawnSync("git", commandArguments, {
          cwd: repositoryRoot,
          encoding: "buffer",
          windowsHide: true,
          shell: false,
          timeout: 30_000,
          maxBuffer: 16 * 1_024 * 1_024,
        }));
    return Object.freeze({
      revisionChanges: parsePaths(
        runCommand([
          "diff",
          "--name-only",
          "--no-renames",
          "-z",
          `${comparisonBase}...HEAD`,
        ]),
        "revision_changes",
      ),
      preparedChanges: parsePaths(
        runCommand([
          "diff",
          "--cached",
          "--name-only",
          "--no-renames",
          "-z",
          "HEAD",
        ]),
        "prepared_changes",
      ),
      workingChanges: parsePaths(
        runCommand(["diff", "--name-only", "--no-renames", "-z"]),
        "working_changes",
      ),
      unregisteredPaths: parsePaths(
        runCommand(["ls-files", "--others", "--exclude-standard", "-z"]),
        "unregistered_paths",
      ),
    });
  };
}

export const gitLocalChangeSetAdapter = createGitLocalChangeSetAdapter();
