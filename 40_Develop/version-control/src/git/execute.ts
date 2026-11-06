/**
 * Git Processの技術的な起動条件を共有する。
 * @responsibility exactなGit配置、親環境の分離、有界入出力と終了結果を所有する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @boundary Package内部専用。任意Commandを公開するAPIではない。
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { devNull } from "node:os";
import path from "node:path";

/** 固定Git実行の期限・入出力上限・Indexと設定分離を指定する。 */
type GitExecutionOptions = Readonly<{
  maxBuffer: number;
  timeout?: number;
  input?: string | Buffer;
  indexFile?: string;
  gitDirectory?: string;
  configuration?: "isolated" | "repository";
}>;

/** 同じ有効設定範囲でclean／process Filterの設定名だけを有界観測する。値は公開しない。 */
export function inspectGitExternalFilters(
  root: string,
  options: GitExecutionOptions,
): SpawnSyncReturns<Buffer> {
  return executeGit(
    root,
    [
      "config",
      "--includes",
      "--null",
      "--name-only",
      "--get-regexp",
      "^filter\\..*\\.(clean|process)$",
    ],
    options,
  );
}

/**
 * 呼出し元が構成した固定Git操作を、指定Worktreeの管理領域へ送る。
 * @responsibility Linkedの.git FileをDirectoryと誤認せず、HEADとIndexの対象を固定する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @input 検証済みRoot、内部固定引数、既存の期限・容量・一時Index条件。
 * @returns 子Processの元の終了値・error・有界bytes。
 * @precondition 呼出し元がRoot・Git配置・操作入力と発行許可を検証済み。.git FileはGitの標準解決へ渡す。
 * @postcondition Shell・親GIT_*・hook・fsmonitor・置換Objectを使わない。
 * @effect 指定されたローカルGit操作。送信はRemote操作Ownerだけが要求する。
 * @failure 子の非0・配置拒否・期限・容量超過は元結果で返す。
 * @invariant Repository設定が必要な操作だけ明示的に既存設定を読む。
 * @security 絶対Path・生出力を公開結果に変換する責務は持たない。
 * @concurrency 同期子の終了まで待つ。共有Lockや自動再試行は追加しない。
 */
export function executeGit(
  root: string,
  args: readonly string[],
  options: GitExecutionOptions,
): SpawnSyncReturns<Buffer> {
  const empty = process.platform === "win32" ? "NUL" : devNull;
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
  );
  return spawnSync(
    "git",
    [
      "--no-pager",
      "--no-optional-locks",
      ...(args[0] === "check-ignore" ? [] : ["--literal-pathspecs"]),
      "--no-replace-objects",
      `--git-dir=${options.gitDirectory ?? path.join(root, ".git")}`,
      `--work-tree=${root}`,
      "-c",
      "core.bare=false",
      "-c",
      "core.fsmonitor=false",
      "-c",
      `core.hooksPath=${empty}`,
      "-c",
      "commit.gpgSign=false",
      "-c",
      "merge.autoStash=false",
      ...args,
    ],
    {
      cwd: root,
      env: {
        ...environment,
        ...(options.configuration === "repository"
          ? {}
          : {
              GIT_CONFIG_GLOBAL: empty,
              GIT_CONFIG_SYSTEM: empty,
            }),
        GIT_TERMINAL_PROMPT: "0",
        GIT_NO_LAZY_FETCH: "1",
        ...(options.indexFile ? { GIT_INDEX_FILE: options.indexFile } : {}),
      },
      ...(options.input === undefined ? {} : { input: options.input }),
      encoding: "buffer",
      windowsHide: true,
      shell: false,
      timeout: options.timeout ?? 30_000,
      maxBuffer: options.maxBuffer,
    },
  );
}
