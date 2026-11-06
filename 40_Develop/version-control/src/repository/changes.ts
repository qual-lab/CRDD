/**
 * 選択FileのIndex／作業内容の差分を固定Git実装から読み取る。
 * @responsibility 原本・Pathの確認、差分の区分、出力上限と観測不能時の拒否を所有する。
 * @trace ARCH-000002 ARCH-000009
 */
import { isCommitId, isCommitPath } from "./commit.ts";
import type { CommitDiffRequest, CommitDiff, FileDiff } from "./types.ts";
import { runGitReadCommand } from "../git/read.ts";
import { resolveVerifiedRepositoryRoot, type Repository } from "./location.ts";

import { readRepositoryPaths, validateRelativePath } from "./files.ts";

const MAX_PATCH_BYTES = 256 * 1024;

/**
 * Git Commandを固定Repository Rootで実行する。
 *
 * @responsibility Shellを介さず固定Git引数を実行し、成功した標準出力だけを返す。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @input repositoryRoot: 検証済みRoot、gitArguments: 固定Git引数集合。
 * @returns Git標準出力のBuffer。
 * @precondition 引数は呼出し側が固定Commandと`--`境界を構成済みである。
 * @postcondition exit code 0かつProcess Errorなしの場合だけBufferを返す。
 * @effect Git子Processを一回起動する。
 * @failure 起動失敗、Timeoutまたは非0終了を固定Errorへ閉じる。
 * @invariant Shellを使わずRepository Rootを変更しない。
 * @boundary Version ControlとGit Processの境界。
 * @security 未信頼文字列をCommand Lineへ連結しない。
 * @concurrency 呼出しごとに同期Processを所有し、Handleを保持しない。
 */
function readPatchBytes(
  repositoryRoot: string,
  gitArguments: readonly string[],
) {
  const result = runGitReadCommand(
    repositoryRoot,
    gitArguments,
    2 * 1_024 * 1_024,
  );
  if (result.error !== undefined || result.status !== 0)
    throw new Error("repository_worktree_observation_failed");
  return result.stdout;
}

/**
 * Patchを固定上限へ切り詰め、UTF-8 Textへ変換する。
 *
 * @responsibility Git出力を公開上限内へ切り詰め、切詰め有無とTextを同時に返す。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @input bytes: Gitから得たPatch Buffer。
 * @returns UTF-8 Textと切詰め状態。
 * @precondition bytesは現在のGit Process出力である。
 * @postcondition textの元Byte数は固定上限以下である。
 * @effect N/A: Bufferを読取るだけである。
 * @failure N/A: Buffer入力だけを扱う。
 * @invariant 切詰め時はisTruncated=trueを返す。
 * @boundary Git Byte出力とWorkbench Diff Textの境界。
 * @security 上限を超える出力をMemoryへ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function patchText(
  bytes: Buffer,
): Readonly<{ text: string; truncated: boolean }> {
  const isTruncated = bytes.byteLength > MAX_PATCH_BYTES;
  return Object.freeze({
    text: new TextDecoder("utf-8").decode(
      isTruncated ? bytes.subarray(0, MAX_PATCH_BYTES) : bytes,
    ),
    truncated: isTruncated,
  });
}

/**
 * 選択FileのPrepared／Working差分を観測する。
 *
 * @responsibility Treeで選択した一Fileの差分区分と切詰め状態を公開する。
 * @trace ARCH-000009
 * @input capability、変更Path集合、選択Pathを受け取る。
 * @returns Prepared／Working Patchと未追跡状態を返す。
 * @precondition Pathは現在のGit Path一覧に存在するFileである。
 * @postcondition PathとPatch以外のRepository Identityを公開しない。
 * @effect RepositoryとVersion Control Metadataを読取る。
 * @failure 不正・不存在・Directory Pathまたは観測失敗を例外で拒否する。
 * @invariant 未追跡Fileの内容を暗黙に読取らず、未追跡状態だけを返す。
 * @boundary Workbench File Diff要求とVersion Controlの境界。
 * @security `--`でPath optionを分離し、絶対Pathを結果へ含めない。
 * @concurrency Patchは当該Git読取りの観測時点に限る。
 */
export function readFileDiff(
  capability: Repository,
  changes: Readonly<{
    unregisteredPaths: readonly string[];
  }>,
  pathValue: unknown,
): FileDiff {
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null) throw new Error("verified_repository_root_required");
  const selectedPath = validateRelativePath(pathValue, false);
  const paths = readRepositoryPaths(root);
  if (!paths.includes(selectedPath))
    throw new Error("repository_worktree_file_not_found");
  const prepared = patchText(
    readPatchBytes(root, [
      "diff",
      "--cached",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      "--unified=3",
      "--",
      selectedPath,
    ]),
  );
  const working = patchText(
    readPatchBytes(root, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      "--unified=3",
      "--",
      selectedPath,
    ]),
  );
  const patch = {
    preparedPatch: prepared.text,
    workingPatch: working.text,
    preparedTruncated: prepared.truncated,
    workingTruncated: working.truncated,
  };
  return Object.freeze({
    path: selectedPath,
    ...patch,
    unregistered: changes.unregisteredPaths.includes(selectedPath),
  });
}

/** 現在FileやIndexを混ぜず、二つの固定Commit間のFile差分を読む。 */
export function readCommitDiff(
  repository: Repository,
  request: CommitDiffRequest,
): CommitDiff {
  if (
    !isCommitId(request.baseCommit) ||
    !isCommitId(request.commitId) ||
    !isCommitPath(request.path)
  )
    throw Error("commit_diff_input_invalid");
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) throw Error("verified_repository_root_required");
  const bytes = readPatchBytes(root, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    request.baseCommit,
    request.commitId,
    "--",
    request.path,
  ]);
  if (bytes.length > MAX_PATCH_BYTES)
    throw Error("commit_diff_observation_unavailable");
  const patch = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return {
    baseCommit: request.baseCommit,
    commitId: request.commitId,
    path: request.path,
    binary: patch.includes("Binary files "),
    patch,
    truncated: false,
  };
}
