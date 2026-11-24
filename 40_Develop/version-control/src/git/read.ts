/**
 * Tree／差分の固定Git読取りを実行する内部部品。
 * @responsibility 親Git環境による対象変更と読取り時の外部変換・任意更新を抑止する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 * @boundary Version Control内部からローカルGit子Process。
 * @security 公開API・認可・保存・Lockを追加しない。
 */
import { executeGit, inspectGitExternalFilters } from "./execute.ts";
import type { Repository } from "../repository/location.ts";
import type { EntitySnapshot } from "../repository/layout.ts";

/** HEAD配下のBranch名の文法だけを検査する。登録と参照の有無は別に観測する。 @trace ARCH-000009 */
export function isBranchName(branch: unknown): branch is string {
  return (
    typeof branch === "string" &&
    branch.length !== 0 &&
    !/[\u0000-\u0020\u007f\\:*?[~^]/u.test(branch) &&
    !branch.includes("..") &&
    !branch.includes("@{") &&
    !branch.endsWith(".") &&
    !branch
      .split("/")
      .some((part) => !part || part.startsWith(".") || part.endsWith(".lock"))
  );
}

/** 完全一致する直接Branch Refだけを一つのGit出力から読む。 @trace ARCH-000009 */
export function readDirectBranchOid(
  name: string,
  run: (args: readonly string[]) => {
    status: number | null;
    stdout: string;
    stderr: string;
  },
  requiredType?: "commit",
): string | null {
  const result = run([
    "for-each-ref",
    `--format=%(refname)%00%(objectname)%00%(symref)${requiredType ? "%00%(objecttype)" : ""}`,
    "--",
    name,
  ]);
  if (result.status !== 0 || result.stderr !== "")
    throw Error("worktree_ref_unavailable");
  let oid: string | null = null;
  for (const row of result.stdout.split(/\r?\n/u)) {
    const [key, value, symbolic, ...extra] = row.split("\0");
    if (key !== name) continue;
    if (symbolic) throw Error("worktree_branch_not_direct");
    if (
      oid !== null ||
      (requiredType
        ? extra.length !== 1 || extra[0] !== requiredType
        : extra.length !== 0) ||
      symbolic !== "" ||
      !value ||
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)
    )
      throw Error("worktree_ref_unavailable");
    oid = value;
  }
  return oid;
}

const branchCommitKey = Symbol("branch commit observation");

/** 同じRepositoryへの作成要求に渡せる、VCが観測した固定Commit。 @trace ARCH-000009 */
class ObservedBranchCommit {
  readonly #repository: Repository;
  readonly #commitId: string;
  readonly #checkedConfiguration: EntitySnapshot | null;

  constructor(
    key: typeof branchCommitKey,
    repository: Repository,
    commitId: string,
    checkedConfiguration: EntitySnapshot | null,
  ) {
    if (key !== branchCommitKey) throw Error("worktree_commit_invalid");
    this.#repository = repository;
    this.#commitId = commitId;
    this.#checkedConfiguration = checkedConfiguration;
    Object.freeze(this);
  }

  get commitId(): string {
    return this.#commitId;
  }

  static matches(value: unknown, repository: Repository, oid: string): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      #repository in value &&
      value.#repository === repository &&
      value.#commitId === oid
    );
  }

  static configuration(
    value: unknown,
    repository: Repository,
    oid: string,
  ): EntitySnapshot | null {
    return typeof value === "object" &&
      value !== null &&
      #checkedConfiguration in value &&
      ObservedBranchCommit.matches(value, repository, oid)
      ? value.#checkedConfiguration
      : null;
  }
}
Object.freeze(ObservedBranchCommit);
Object.freeze(ObservedBranchCommit.prototype);

/** 同じGit応答で直接RefとCommit種別が成立した場合だけ、固定基準を発行する。 @trace ARCH-000009 */
export function observeBranchCommit(
  repository: Repository,
  name: string,
  run: Parameters<typeof readDirectBranchOid>[1],
  checkedConfiguration: EntitySnapshot | null,
): ObservedBranchCommit | null {
  const oid = readDirectBranchOid(name, run, "commit");
  return oid === null
    ? null
    : new ObservedBranchCommit(
        branchCommitKey,
        repository,
        oid,
        checkedConfiguration,
      );
}

export type { ObservedBranchCommit };
export const matchesBranchCommit = ObservedBranchCommit.matches;
export const checkedBranchConfiguration = ObservedBranchCommit.configuration;

/**
 * 内容読取り操作が組み立てたdiff／ls-filesを同じ条件で実行する。
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
  const started = performance.now();
  if (args[0] === "diff") {
    const filters = inspectGitExternalFilters(repositoryRoot, { maxBuffer });
    if (
      filters.error ||
      filters.signal ||
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
  return executeGit(repositoryRoot, args, { maxBuffer, timeout });
}
