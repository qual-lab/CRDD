/**
 * Tree／差分の固定Git読取りを実行する内部部品。
 * @responsibility 親Git環境による対象変更と読取り時の外部変換・任意更新を抑止する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @boundary Version Control内部からローカルGit子Process。
 * @security 公開API・認可・保存・Lockを追加しない。
 */
import { spawnSync } from "node:child_process";
import { devNull } from "node:os";
import path from "node:path";

/**
 * 二Adapterが組み立てたdiff／ls-filesを同じ読取り条件で実行する。
 * @responsibility 固定Root、非対話、外部変換なしの同期子Processを所有する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @input repositoryRoot: 検証済みRoot、args: 固定diff／ls-files引数、maxBuffer: 利用側の既存上限。
 * @returns 元子Processのstatus・error・stdout等。意味上の結果は利用側が分類する。
 * @precondition 呼出し元がRootと選択Path・比較Revisionを検証する。
 * @postcondition 親GIT_*を継承せず、指定した作業Treeで読取りを完了または失敗する。
 * @effect ローカルGit読取り。diff前だけ設定を一回観測し、新しいLock・履歴・状態を保存しない。
 * @failure 不正commandは拒否し、起動失敗・期限・出力超過は元結果へ保持する。
 * @invariant 利用側ごとの出力上限とエラー分類を変えない。
 * @boundary Git CLIのdiff／ls-filesに限定。全Git操作の保証ではない。
 * @security 外部Diff・textconv・fsmonitor・pager・遅延fetch・任意index更新を抑止する。
 * @concurrency 同期子の終了まで待ち、共有Stateを所有しない。
 */
export function runGitReadCommand(
  repositoryRoot: string,
  args: readonly string[],
  maxBuffer: number,
) {
  if (args[0] !== "diff" && args[0] !== "ls-files")
    throw new Error("git_read_command_unsupported");
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^GIT_/iu.test(name)),
  );
  // Git for WindowsはNodeのdevice Path（\\.\nul）をconfig Pathとして受理しない。
  const emptyConfig = process.platform === "win32" ? "NUL" : devNull;
  const prefix = [
    "--no-pager",
    "--no-optional-locks",
    "--literal-pathspecs",
    "--no-replace-objects",
    `--git-dir=${path.join(repositoryRoot, ".git")}`,
    `--work-tree=${repositoryRoot}`,
    "-c",
    "core.bare=false",
    "-c",
    "core.fsmonitor=false",
  ];
  const options = {
    cwd: repositoryRoot,
    env: {
      ...environment,
      GIT_CONFIG_GLOBAL: emptyConfig,
      GIT_CONFIG_SYSTEM: emptyConfig,
      GIT_TERMINAL_PROMPT: "0",
      GIT_NO_LAZY_FETCH: "1",
    },
    encoding: "buffer" as const,
    windowsHide: true,
    shell: false,
    timeout: 30_000,
    maxBuffer,
  };
  const started = performance.now();
  if (args[0] === "diff") {
    const filters = spawnSync(
      "git",
      [
        ...prefix,
        "config",
        "--includes",
        "--null",
        "--name-only",
        "--get-regexp",
        "^filter\\..*\\.(clean|process)$",
      ],
      options,
    );
    if (
      filters.error ||
      filters.status !== 1 ||
      filters.stdout.byteLength !== 0
    )
      return {
        ...filters,
        status: null,
        stdout: Buffer.alloc(0),
        error:
          filters.error ?? new Error("git_read_external_filter_unavailable"),
      };
  }
  const timeout = 30_000 - Math.ceil(performance.now() - started);
  if (timeout <= 0)
    return {
      pid: 0,
      output: [],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: null,
      signal: null,
      error: Object.assign(new Error("git_read_deadline_exceeded"), {
        code: "ETIMEDOUT",
      }),
    };
  return spawnSync("git", [...prefix, ...args], { ...options, timeout });
}
