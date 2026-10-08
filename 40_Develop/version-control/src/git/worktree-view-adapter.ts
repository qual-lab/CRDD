/**
 * Git Repository WorktreeのPathとPatchを読取るAdapter。
 *
 * @packageDocumentation
 * @responsibility Git CLIのPath／Patch出力をVersion Control公開観測へ適合する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @boundary Git ProcessとRepository Worktree View Portの境界。
 * @effect Git MetadataとWorktreeを読取るだけである。
 * @security Shellを使わず固定Commandと`--`区切りだけを実行する。
 */
import { spawnSync } from "node:child_process";

import type { RepositoryWorktreeViewAdapter } from "../repository/worktree-view.ts";

const MAX_PATCH_BYTES = 256 * 1_024;

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
 * @boundary Version Control AdapterとGit Processの境界。
 * @security 未信頼文字列をCommand Lineへ連結しない。
 * @concurrency 呼出しごとに同期Processを所有し、Handleを保持しない。
 */
function executeGit(repositoryRoot: string, gitArguments: readonly string[]) {
  const result = spawnSync("git", gitArguments, {
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

/** Git CLIを使うRepository Worktree View Adapterを構築する。 */
export const gitRepositoryWorktreeViewAdapter: RepositoryWorktreeViewAdapter = (
  repositoryRoot,
) => {
  const paths = Object.freeze(
    new TextDecoder("utf-8", { fatal: true })
      .decode(
        executeGit(repositoryRoot, [
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
    /**
     * Gitを利用したRepository Tree／Diff観測境界におけるreadPatchの処理境界を固定する。
     *
     * @responsibility Gitを利用したRepository Tree／Diff観測境界に必要な入力処理、失敗分類および結果生成を所有する。
     * @trace ARCH-000002
     * @input 宣言された引数だけを受け取る。
     * @returns 宣言された結果型を返す。
     * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
     * @postcondition 成功時だけ検証済みの結果を返す。
     * @effect 宣言または注入された依存以外へEffectを発行しない。
     * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
     * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
     * @boundary 呼出し元と本Moduleの局所責務境界。
     * @security 秘密値と未許可情報を出力またはlogへ追加しない。
     * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
     */
    readPatch(selectedPath: string) {
      const prepared = patchText(
        executeGit(repositoryRoot, [
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
        executeGit(repositoryRoot, [
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
