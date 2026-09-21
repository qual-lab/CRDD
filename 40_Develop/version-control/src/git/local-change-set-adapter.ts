import { type SpawnSyncReturns, spawnSync } from "node:child_process";

import type {
  LocalChangeSetAdapter,
  LocalChangeSetObservation,
} from "../local-change-set.ts";

/**
 * GitLocalChangeSetProcessResultが扱う値の構造を表す。
 *
 * @responsibility GitLocalChangeSetProcessResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape GitLocalChangeSetProcessResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant GitLocalChangeSetProcessResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: GitLocalChangeSetProcessResultの宣言は外部境界を開かない。
 * @security N/A: GitLocalChangeSetProcessResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility GitLocalChangeSetProcessResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type GitLocalChangeSetProcessResult = Pick<
  SpawnSyncReturns<Buffer>,
  "error" | "status" | "stdout"
>;

/**
 * GitLocalChangeSetCommandRunnerが扱う値の構造を表す。
 *
 * @responsibility GitLocalChangeSetCommandRunnerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape GitLocalChangeSetCommandRunnerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant GitLocalChangeSetCommandRunnerで宣言した値と責務の対応を維持する。
 * @boundary N/A: GitLocalChangeSetCommandRunnerの宣言は外部境界を開かない。
 * @security N/A: GitLocalChangeSetCommandRunnerはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility GitLocalChangeSetCommandRunnerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type GitLocalChangeSetCommandRunner = (
  commandArguments: readonly string[],
) => GitLocalChangeSetProcessResult;

/**
 * parsePathsの処理を実行する。
 *
 * @responsibility parsePathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input result: GitLocalChangeSetProcessResult、phase: string
 * @returns readonly string[]を返す。
 * @precondition 「result: GitLocalChangeSetProcessResult、phase: string」がparsePathsの入力契約を満たす。
 * @postcondition parsePathsの責務を完了した結果だけを返す。
 * @effect N/A: parsePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parsePathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parsePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: parsePathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parsePathsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createGitLocalChangeSetAdapterの処理を実行する。
 *
 * @responsibility createGitLocalChangeSetAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input commandRunner: GitLocalChangeSetCommandRunner
 * @returns LocalChangeSetAdapterを返す。
 * @precondition 「commandRunner: GitLocalChangeSetCommandRunner」がcreateGitLocalChangeSetAdapterの入力契約を満たす。
 * @postcondition createGitLocalChangeSetAdapterの責務を完了した結果だけを返す。
 * @effect createGitLocalChangeSetAdapterはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: createGitLocalChangeSetAdapterは独自の失敗分岐を所有しない。
 * @invariant createGitLocalChangeSetAdapterは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createGitLocalChangeSetAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createGitLocalChangeSetAdapterは共有非同期状態を持たない同期処理である。
 */
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
