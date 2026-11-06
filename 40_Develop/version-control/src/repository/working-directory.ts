/**
 * 対象Worktreeの変更を読み取り、明示選択を固有Indexへ反映する。
 * @responsibility 四区分の変更観測とStage／Unstageの結果分類。内容の採否は上位が所有する。
 * @trace ARCH-000002 ARCH-000009
 */
import type { SpawnSyncReturns } from "node:child_process";
import { runGitReadCommand } from "../git/read.ts";
import { executeGit, inspectGitExternalFilters } from "../git/execute.ts";
import { resolveVerifiedRepositoryRoot, type Repository } from "./location.ts";
import type { ChangesResult, PathsRequest, WorkingChanges } from "./types.ts";

export const LOCAL_CHANGE_SET_CONTRACT =
  "crdd-version-control/local-change-set/v1";
export const LOCAL_CHANGE_SET_CONTRACT_REVISION = 1;

/** 選択Path以外を追加せず、Root逸脱・option・重複をEffect前に拒否する。 */
function changePaths(
  repository: Repository,
  request: PathsRequest,
  stage: boolean,
): ChangesResult {
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) throw Error("verified_repository_root_required");
  if (
    !Array.isArray(request.paths) ||
    request.paths.length === 0 ||
    new Set(request.paths).size !== request.paths.length ||
    request.paths.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.length === 0 ||
        entry.startsWith("-") ||
        entry.startsWith("/") ||
        entry.includes("\\") ||
        /[\u0000-\u001f\u007f]/u.test(entry) ||
        entry
          .split("/")
          .some((part) => part === "" || part === "." || part === ".."),
    )
  )
    throw Error("change_publication_paths_invalid");
  const started = performance.now();
  const maxBuffer = 4 * 1024 * 1024;
  const deadline = started + 30_000;
  if (stage && !stageFiltersAreSafe(root, request.paths, deadline, maxBuffer))
    return Object.freeze({
      status: "blocked",
      reason: "prepare_external_filter_unavailable",
      effectIssued: false,
      effectConfirmed: false,
      revisionIdentity: null,
      automaticRetryIssued: false,
      forcePublicationIssued: false,
    });
  const timeout = stage ? Math.ceil(deadline - performance.now()) : 30_000;
  if (timeout <= 0)
    return Object.freeze({
      status: "blocked",
      reason: "prepare_external_filter_unavailable",
      effectIssued: false,
      effectConfirmed: false,
      revisionIdentity: null,
      automaticRetryIssued: false,
      forcePublicationIssued: false,
    });
  const execution = executeGit(
    root,
    stage
      ? ["add", "--", ...request.paths]
      : ["reset", "--quiet", "HEAD", "--", ...request.paths],
    { maxBuffer, configuration: "repository", timeout },
  );
  const operation = stage ? "prepare" : "unprepare";
  return Object.freeze({
    status:
      execution.error || execution.signal
        ? "unknown"
        : execution.status === 0
          ? "completed"
          : "blocked",
    reason:
      execution.error || execution.signal
        ? "repository_effect_unknown"
        : `${operation}_${execution.status === 0 ? "completed" : "rejected"}`,
    effectIssued: true,
    effectConfirmed:
      !execution.error && !execution.signal && execution.status === 0,
    revisionIdentity: null,
    automaticRetryIssued: false,
    forcePublicationIssued: false,
  });
}

/** 同じ有効設定で、今回追加するPathに外部clean／processが適用されないことを確認する。 */
function stageFiltersAreSafe(
  root: string,
  paths: readonly string[],
  deadline: number,
  maxBuffer: number,
): boolean {
  try {
    const filters = inspectGitExternalFilters(root, {
      maxBuffer,
      configuration: "repository",
      timeout: Math.max(1, Math.ceil(deadline - performance.now())),
    });
    if (filters.error || filters.signal || performance.now() >= deadline)
      return false;
    if (filters.status === 1 && filters.stdout.byteLength === 0) return true;
    if (filters.status !== 0) return false;
    const decode = (bytes: Buffer) =>
      new TextDecoder("utf8", { fatal: true }).decode(bytes);
    const names = decode(filters.stdout);
    if (!names.endsWith("\0")) return false;
    const drivers = new Set<string>();
    for (const name of names.slice(0, -1).split("\0")) {
      const match = /^filter\.(.+)\.(?:clean|process)$/u.exec(name);
      if (!match?.[1]) return false;
      drivers.add(match[1]);
    }
    // Directory指定もGit自身のliteral Path選択でFile集合へ展開する。
    const timeout = Math.ceil(deadline - performance.now());
    if (timeout <= 0) return false;
    const files = executeGit(
      root,
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ...paths,
      ],
      { maxBuffer, configuration: "repository", timeout },
    );
    if (files.error || files.signal || files.status !== 0) return false;
    const source = decode(files.stdout);
    if (source !== "" && !source.endsWith("\0")) return false;
    const selected = [...new Set(source.split("\0").filter(Boolean))];
    validatePaths(selected, "stage_filters");
    if (selected.length === 0) return performance.now() < deadline;
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) return false;
    const attributes = executeGit(
      root,
      ["check-attr", "-z", "--stdin", "filter"],
      {
        maxBuffer,
        configuration: "repository",
        timeout: remaining,
        input: Buffer.from(`${selected.join("\0")}\0`),
      },
    );
    if (
      attributes.error ||
      attributes.signal ||
      attributes.status !== 0 ||
      performance.now() >= deadline
    )
      return false;
    const text = decode(attributes.stdout);
    if (!text.endsWith("\0")) return false;
    const fields = text.slice(0, -1).split("\0");
    if (fields.length !== selected.length * 3) return false;
    for (let index = 0; index < selected.length; index++) {
      const value = fields[index * 3 + 2];
      if (
        fields[index * 3] !== selected[index] ||
        fields[index * 3 + 1] !== "filter" ||
        value === undefined ||
        value.length === 0 ||
        drivers.has(value)
      )
        return false;
    }
    // 予約表示値と同名driverも一致なら拒否する。未設定と明示文字列を混同しない。
    return true;
  } catch {
    return false;
  }
}

/** 指定WorktreeのIndexへ明示Pathだけを追加する。 */
export function stagePaths(
  repository: Repository,
  request: PathsRequest,
): ChangesResult {
  return changePaths(repository, request, true);
}

/** 指定Worktreeの明示PathだけをHEADのStage状態へ戻す。作業Fileは変更しない。 */
export function unstagePaths(
  repository: Repository,
  request: PathsRequest,
): ChangesResult {
  return changePaths(repository, request, false);
}

/**
 * Pathsを構造化値へ解析する。
 *
 * @responsibility Pathsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000002
 * @input result: SpawnSyncReturns<Buffer>、phase: string
 * @returns readonly string[]を返す。
 * @precondition 「result: SpawnSyncReturns<Buffer>、phase: string」がparsePathsの入力契約を満たす。
 * @postcondition parsePathsの責務を完了した結果だけを返す。
 * @effect N/A: parsePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parsePathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parsePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: parsePathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parsePathsは共有非同期状態を持たない同期処理である。
 */
function parsePaths(
  result: SpawnSyncReturns<Buffer>,
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
 * Comparison Baseの契約を検証する。
 *
 * @responsibility Comparison Baseの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000002
 * @input value: unknown
 * @returns asserts value is stringを返す。
 * @precondition 「value: unknown」がvalidateComparisonBaseの入力契約を満たす。
 * @postcondition validateComparisonBaseの責務を完了した結果だけを返す。
 * @effect N/A: validateComparisonBaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateComparisonBaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateComparisonBaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateComparisonBaseはProcess内の同一Subsystemで完結する。
 * @security N/A: validateComparisonBaseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateComparisonBaseは共有非同期状態を持たない同期処理である。
 */
function validateComparisonBase(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_024 ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    value.startsWith("-")
  )
    throw new Error("change_comparison_base_invalid");
}

/**
 * Pathsの契約を検証する。
 *
 * @responsibility Pathsの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000002
 * @input paths: readonly string[]、phase: string
 * @returns N/A: validatePathsは戻り値を返さない。
 * @precondition 「paths: readonly string[]、phase: string」がvalidatePathsの入力契約を満たす。
 * @postcondition validatePathsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: validatePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validatePathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validatePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatePathsはProcess内の同一Subsystemで完結する。
 * @security N/A: validatePathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validatePathsは共有非同期状態を持たない同期処理である。
 */
function validatePaths(paths: readonly string[], phase: string): void {
  if (
    paths.some(
      (entry) =>
        entry.length === 0 ||
        entry.includes("\\") ||
        entry.startsWith("/") ||
        /^[A-Za-z]:/u.test(entry) ||
        entry
          .split("/")
          .some(
            (segment) => segment === "" || segment === "." || segment === "..",
          ),
    )
  )
    throw new Error(`local_change_set_observation_invalid:${phase}`);
}

/**
 * Sortedを重複のない順序へ正規化する。
 *
 * @responsibility Sortedの重複判定、順序規則、結果集合境界を所有する。
 * @trace ARCH-000002
 * @input groups: readonly (readonly string[])[]
 * @returns readonly string[]を返す。
 * @precondition 「groups: readonly (readonly string[])[]」がuniqueSortedの入力契約を満たす。
 * @postcondition uniqueSortedの責務を完了した結果だけを返す。
 * @effect N/A: uniqueSortedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uniqueSortedは独自の失敗分岐を所有しない。
 * @invariant uniqueSortedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uniqueSortedはProcess内の同一Subsystemで完結する。
 * @security N/A: uniqueSortedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: uniqueSortedは共有非同期状態を持たない同期処理である。
 */
function uniqueSorted(
  groups: readonly (readonly string[])[],
): readonly string[] {
  return Object.freeze(
    [...new Set(groups.flat())].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

/**
 * 現在WorktreeのRevision間・Index・作業内容・未追跡の変更を読む。
 * @responsibility 固定Git実装に直結し、四観測のどれかが不明なら部分集合を返さない。
 * @trace ARCH-000002
 * @effect 検証済みRootで有界なGit読取りを行い、Index・HEADは変更しない。
 * @failure 入力不正、Process失敗、Path不正は例外。
 */
export function readWorkingChanges(
  capability: Repository,
  comparisonBase: unknown,
): WorkingChanges {
  validateComparisonBase(comparisonBase);
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null)
    throw new Error("verified_repository_root_required");
  const runCommand = (args: readonly string[]) =>
    runGitReadCommand(repositoryRoot, args, 16 * 1024 * 1024);
  const observed = Object.freeze({
    revisionChanges: parsePaths(
      runCommand([
        "diff",
        "--no-ext-diff",
        "--no-textconv",
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
        "--no-ext-diff",
        "--no-textconv",
        "--cached",
        "--name-only",
        "--no-renames",
        "-z",
        "HEAD",
      ]),
      "prepared_changes",
    ),
    workingChanges: parsePaths(
      runCommand([
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--name-only",
        "--no-renames",
        "-z",
      ]),
      "working_changes",
    ),
    unregisteredPaths: parsePaths(
      runCommand(["ls-files", "--others", "--exclude-standard", "-z"]),
      "unregistered_paths",
    ),
  });
  validatePaths(observed.revisionChanges, "revision_changes");
  validatePaths(observed.preparedChanges, "prepared_changes");
  validatePaths(observed.workingChanges, "working_changes");
  validatePaths(observed.unregisteredPaths, "unregistered_paths");
  return Object.freeze({
    contract: LOCAL_CHANGE_SET_CONTRACT,
    contractRevision: LOCAL_CHANGE_SET_CONTRACT_REVISION,
    revisionChanges: uniqueSorted([observed.revisionChanges]),
    preparedChanges: uniqueSorted([observed.preparedChanges]),
    workingChanges: uniqueSorted([observed.workingChanges]),
    unregisteredPaths: uniqueSorted([observed.unregisteredPaths]),
    changedPaths: uniqueSorted([
      observed.revisionChanges,
      observed.preparedChanges,
      observed.workingChanges,
      observed.unregisteredPaths,
    ]),
    observationComplete: true,
    repositoryPathReported: false,
  });
}
