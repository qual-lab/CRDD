/**
 * Git一覧と取得不能時の代替探索から検査対象を観測する。
 *
 * @responsibility 探索順、除外、入れ子Repositoryと観測不能の記録を維持する。
 * @trace ARCH-000001
 */
import fs from "node:fs";
import path from "node:path";
import {
  observeNestedRepository,
  observeRepositoryEntries,
} from "../../../version-control/src/index.ts";
import {
  errorCode,
  isWithin,
  lstatIfPresent,
  pathContainsSymbolicLink,
  samePath,
} from "./observe.ts";
import type {
  Discovery,
  GitlinkEntry,
  RepositoryDiscoveryInput,
} from "./types.ts";

/**
 * Project Filesを探索する。
 *
 * @responsibility Project Filesの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000001
 * @input input: 初期観測済みのRoot・入れ子宣言・基準版状態。add: 従来の診断収集先。
 * @returns Discoveryを返す。
 * @precondition inputは同じ起動の初期Root・基準版観測から得た値である。
 * @postcondition 観測したFile・基準版状態・除外・未観測事項を元の順序で返す。
 * @effect Version Control公開操作とFilesystem metadata・一覧の同期読取りを行う。書込みなし。
 * @failure Git一覧の取得不能は既存の代替探索へ進む。観測失敗は診断と未観測へ記録する。
 * @invariant discoverProjectFilesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証RootのGit観測とFilesystem観測。未初期化境界やLinkを内容検査へ広げない。
 * @security N/A: discoverProjectFilesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: discoverProjectFilesは共有非同期状態を持たない同期処理である。
 */
export function observeProjectFiles(
  input: RepositoryDiscoveryInput,
  add: (severity: string, code: string, file: string, message: string) => void,
): Discovery {
  const {
    root,
    declaredSubmodules,
    baselineCandidateRoot,
    isBaselineDeclared,
    isBaselineDeclarationCandidate,
    isBaselineEntryDirectory,
  } = input;
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  /**
   * Initialized Baseline Without Gitかを判定する。
   *
   * @responsibility Initialized Baseline Without Gitの判定条件とtrue／false境界を所有する。
   * @trace ARCH-000001
   * @input baselineRoot: string
   * @returns booleanを返す。
   * @precondition 「baselineRoot: string」がisInitializedBaselineWithoutGitの入力契約を満たす。
   * @postcondition isInitializedBaselineWithoutGitの責務を完了した結果だけを返す。
   * @effect 基準版のGit markerと参照先metadataを同期読取りする。書込みなし。
   * @failure N/A: isInitializedBaselineWithoutGitは独自の失敗分岐を所有しない。
   * @invariant isInitializedBaselineWithoutGitは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: isInitializedBaselineWithoutGitはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: isInitializedBaselineWithoutGitは共有非同期状態を持たない同期処理である。
   */
  function isInitializedBaselineWithoutGit(baselineRoot: string): boolean {
    const gitMarker = path.join(baselineRoot, ".git");
    if (pathContainsSymbolicLink(root, gitMarker)) return false;
    const markerStat = lstatIfPresent(gitMarker);
    if (!markerStat) return false;
    if (markerStat.isDirectory()) return true;
    if (!markerStat.isFile()) return false;
    const content = fs.readFileSync(gitMarker, "utf8");
    const match = content.match(/^\s*gitdir:\s*(.+?)\s*$/mu);
    if (!match) return false;
    const gitDirectory = path.resolve(baselineRoot, match[1]);
    if (!isWithin(root, gitDirectory)) return false;
    if (pathContainsSymbolicLink(root, gitDirectory)) return false;
    return lstatIfPresent(gitDirectory)?.isDirectory() === true;
  }
  /**
   * walkを決定する。
   *
   * @responsibility walkの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000001
   * @input directory: string、predicate: (file: string) => boolean、excludedDirectories: ReadonlySet<string>、excludedPaths: string[]、excludedLinks: string[]、unavailableDirectories: Set<string>、excludedDirectoryPaths: ReadonlySet<string>
   * @returns string[]を返す。
   * @precondition 「directory: string、predicate: (file: string) => boolean、excludedDirectories: ReadonlySet<string>、excludedPaths: string[]、excludedLinks: string[]、unavailableDirectories: Set<string>、excludedDirectoryPaths: ReadonlySet<string>」がwalkの入力契約を満たす。
   * @postcondition walkの責務を完了した結果だけを返す。
   * @effect Directory metadataと一覧を同期読取りし、局所の除外・未観測集合と診断へ記録する。File書込みなし。
   * @failure walkは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant walkは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: walkはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: walkは共有非同期状態を持たない同期処理である。
   */
  function walk(
    directory: string,
    predicate: (file: string) => boolean,
    excludedDirectories: ReadonlySet<string> = new Set<string>(),
    excludedPaths: string[] = [],
    excludedLinks: string[] = [],
    unavailableDirectories: Set<string> = new Set<string>(),
    excludedDirectoryPaths: ReadonlySet<string> = new Set<string>(),
  ): string[] {
    /**
     * current-profileを失敗として終了させる。
     *
     * @responsibility current-profileの失敗条件、診断情報、終了結果境界を所有する。
     * @trace ARCH-000001
     * @input code: string、message: string
     * @returns nullを返す。
     * @precondition 「code: string、message: string」がfailの入力契約を満たす。
     * @postcondition failの責務を完了した結果だけを返す。
     * @effect 既存addへ診断を渡し、この探索のunavailableDirectoriesへ未観測事項を追加する。File書込みなし。
     * @failure N/A: failは独自の失敗分岐を所有しない。
     * @invariant failは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: failはProcess内の同一Subsystemで完結する。
     * @security N/A: failはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: failは共有非同期状態を持たない同期処理である。
     */
    function fail(code: string, message: string): null {
      const target = relative(directory);
      add("error", code, target, message);
      unavailableDirectories.add(`${target}: ${message}`);
      return null;
    }

    /**
     * Directoryを観測する。
     *
     * @responsibility Directoryの観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000001
     * @input N/A: 実行時引数を受け取らない。
     * @returns fs.Stats | nullを返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がinspectDirectoryの入力契約を満たす。
     * @postcondition inspectDirectoryの責務を完了した結果だけを返す。
     * @effect Directory自体のmetadataを同期読取りし、不正時は既存failへ記録する。File書込みなし。
     * @failure inspectDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant inspectDirectoryは宣言した境界以外へEffectを拡張しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security N/A: inspectDirectoryはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: inspectDirectoryは共有非同期状態を持たない同期処理である。
     */
    function inspectDirectory(): fs.Stats | null {
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(directory);
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          return fail(
            "discovery-directory-missing",
            "The directory disappeared during fallback discovery.",
          );
        }
        if (errorCode(error) === "ENOTDIR") {
          return fail(
            "discovery-directory-invalid",
            "The fallback discovery target is no longer a directory.",
          );
        }
        return fail(
          "discovery-directory-metadata-failed",
          `Could not inspect the directory during fallback discovery: ${errorCode(error) || "unknown error"}.`,
        );
      }
      if (stat.isSymbolicLink()) {
        return fail(
          "discovery-directory-symbolic",
          "The directory became a symbolic link or junction during fallback discovery.",
        );
      }
      if (!stat.isDirectory()) {
        return fail(
          "discovery-directory-invalid",
          "The fallback discovery target is no longer a directory.",
        );
      }
      return stat;
    }

    const before = inspectDirectory();
    if (!before) return [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        fail(
          "discovery-directory-missing",
          "The directory disappeared while fallback discovery was reading it.",
        );
      } else if (errorCode(error) === "ENOTDIR") {
        fail(
          "discovery-directory-invalid",
          "The fallback discovery target was replaced by a non-directory.",
        );
      } else {
        fail(
          "discovery-directory-list-failed",
          `Could not read the directory during fallback discovery: ${errorCode(error) || "unknown error"}.`,
        );
      }
      return [];
    }
    const after = inspectDirectory();
    if (!after) return [];
    if (before.dev !== after.dev || before.ino !== after.ino) {
      fail(
        "discovery-directory-replaced",
        "The directory was replaced while fallback discovery was reading it.",
      );
      return [];
    }
    const discoveredFiles: string[] = [];
    for (const entry of entries) {
      const current = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        excludedLinks.push(relative(current));
        continue;
      }
      if (
        entry.isDirectory() &&
        excludedDirectoryPaths.has(path.resolve(current))
      ) {
        excludedPaths.push(relative(current));
        continue;
      }
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
        excludedPaths.push(relative(current));
        continue;
      }
      if (entry.isDirectory()) {
        discoveredFiles.push(
          ...walk(
            current,
            predicate,
            excludedDirectories,
            excludedPaths,
            excludedLinks,
            unavailableDirectories,
            excludedDirectoryPaths,
          ),
        );
      } else if (predicate(current)) discoveredFiles.push(current);
    }
    return discoveredFiles.sort();
  }
  const repositoryEntries = observeRepositoryEntries(root);
  const gitFailure: string | null =
    repositoryEntries.status === "unavailable"
      ? repositoryEntries.reason === "version_control_not_installed"
        ? "not-installed"
        : repositoryEntries.reason === "repository_not_found"
          ? "not-repository"
          : repositoryEntries.reason ===
                "repository_entries_observation_failed" ||
              repositoryEntries.reason === "repository_entries_output_invalid"
            ? "list-failed"
            : "repository-check-failed"
      : null;
  if (repositoryEntries.status === "completed") {
    const isStagedOutputValid =
      repositoryEntries.nestedRepositoryObservationComplete;
    const nestedEntries = repositoryEntries.entries.filter(
      (entry) => entry.kind === "nested_repository",
    );
    const gitlinkEntries: GitlinkEntry[] = nestedEntries
      .filter((entry) => !entry.conflicted && entry.contentIdentity !== null)
      .map((entry) => ({
        path: path.resolve(root, entry.relativePath),
        oid: entry.contentIdentity ?? "",
      }));
    const conflictedGitlinks = nestedEntries
      .filter((entry) => entry.conflicted)
      .map((entry) => path.resolve(root, entry.relativePath));
    const declaredGitlinkCandidates = declaredSubmodules
      .map((item) => path.resolve(root, item))
      .filter((item) => isWithin(root, item));
    const gitlinks = [
      ...new Set(
        isStagedOutputValid
          ? [
              ...gitlinkEntries.map((entry) => entry.path),
              ...conflictedGitlinks,
            ]
          : declaredGitlinkCandidates,
      ),
    ].sort();
    const baselineGitlink =
      gitlinkEntries.find((entry) =>
        samePath(entry.path, baselineCandidateRoot),
      ) ?? null;
    const isBaselineGitlinkConflicted = conflictedGitlinks.some((entry) =>
      samePath(entry, baselineCandidateRoot),
    );
    const isBaselineGitlinkIndexed =
      isStagedOutputValid && !isBaselineGitlinkConflicted
        ? Boolean(baselineGitlink)
        : null;
    const isBaselineSubmodule =
      isBaselineDeclarationCandidate ||
      isBaselineGitlinkIndexed === true ||
      isBaselineGitlinkConflicted;
    const isBaselineWorktreePresent = isBaselineSubmodule
      ? isBaselineEntryDirectory &&
        !pathContainsSymbolicLink(root, baselineCandidateRoot)
      : null;
    const baselineObservation =
      isBaselineWorktreePresent === true
        ? observeNestedRepository(root, "00_CRDD")
        : null;
    const isBaselineOwnRepository =
      baselineObservation?.exactRepository === true;
    const isBaselineGitDirectoryAccessible =
      isBaselineOwnRepository &&
      baselineObservation?.metadataAccessible === true;
    const baselineHeadOid = isBaselineOwnRepository
      ? (baselineObservation?.revisionIdentity ?? null)
      : null;
    const isBaselineHeadReadable = baselineHeadOid !== null;
    const baselineGitlinkOid = baselineGitlink?.oid?.toLowerCase() ?? null;
    const isBaselineHeadMatchingGitlink =
      isBaselineHeadReadable && baselineGitlinkOid
        ? baselineHeadOid === baselineGitlinkOid
        : null;
    const isBaselineSubmoduleInitialized = !isBaselineSubmodule
      ? null
      : isBaselineGitlinkIndexed === true && isBaselineWorktreePresent === false
        ? false
        : isBaselineGitDirectoryAccessible && isBaselineHeadReadable
          ? true
          : null;
    const baselineSubmoduleState = {
      declared: isBaselineSubmodule ? isBaselineDeclared : null,
      gitlink_indexed: isBaselineSubmodule ? isBaselineGitlinkIndexed : null,
      gitlink_conflicted: isBaselineSubmodule
        ? isBaselineGitlinkConflicted
        : null,
      gitlink_oid: isBaselineSubmodule ? baselineGitlinkOid : null,
      worktree_present: isBaselineWorktreePresent,
      gitdir_accessible:
        isBaselineWorktreePresent === true
          ? isBaselineGitDirectoryAccessible
          : isBaselineWorktreePresent === false
            ? false
            : null,
      head_readable:
        isBaselineWorktreePresent === true
          ? isBaselineHeadReadable
          : isBaselineWorktreePresent === false
            ? false
            : null,
      head_oid: baselineHeadOid,
      head_matches_gitlink: isBaselineHeadMatchingGitlink,
    };
    const skippedSymbolicLinks: string[] = [];
    const files = repositoryEntries.entries
      .filter((entry) => entry.kind === "file")
      .map((entry) => path.resolve(root, entry.relativePath))
      .filter((item) => {
        if (!isWithin(root, item)) return false;
        if (pathContainsSymbolicLink(root, item)) {
          skippedSymbolicLinks.push(relative(item));
          return false;
        }
        return lstatIfPresent(item)?.isFile() ?? false;
      })
      .sort();
    return {
      files,
      source: "git",
      git_failure: null,
      gitlink_detection: isStagedOutputValid
        ? conflictedGitlinks.length > 0
          ? "git-index-conflicted"
          : "git-index"
        : "unavailable",
      gitlinks,
      baseline_submodule: isBaselineSubmodule,
      baseline_submodule_initialized: isBaselineSubmoduleInitialized,
      baseline_submodule_state: baselineSubmoduleState,
      exclusions: [
        "Git-ignored files",
        ...(skippedSymbolicLinks.length > 0
          ? ["Symbolic links and junctions"]
          : []),
        ...(isBaselineSubmodule
          ? ["Adopted CRDD baseline submodule contents"]
          : []),
        ...(gitlinks.length > 0 ? ["Gitlink submodule contents"] : []),
      ],
      unchecked: [
        "Git-ignored files",
        ...(isStagedOutputValid
          ? gitlinks.map(
              (item) => `Gitlink submodule boundary: ${relative(item)}`,
            )
          : [
              "Gitlink detection unavailable: repository entry kinds were not read",
            ]),
        ...(isBaselineSubmodule
          ? [
              "Adopted CRDD baseline submodule contents, except baseline version headers and targets directly referenced by project documents",
            ]
          : []),
        ...skippedSymbolicLinks.map(
          (item) => `Symbolic link excluded: ${item}`,
        ),
      ],
    };
  }

  const excludedNames = new Set<string>([
    ".git",
    ".cache",
    ".next",
    ".nuxt",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "venv",
    "vendor",
  ]);
  const fallbackGitlinks = declaredSubmodules
    .map((item) => path.resolve(root, item))
    .filter((item) => isWithin(root, item));
  const fallbackGitlinkPaths = new Set<string>(fallbackGitlinks);
  const excludedPaths: string[] = [];
  const excludedLinks: string[] = [];
  const unavailableDirectories = new Set<string>();
  const isFallbackBaselineInitialized =
    isBaselineDeclarationCandidate &&
    isBaselineEntryDirectory &&
    !pathContainsSymbolicLink(root, baselineCandidateRoot) &&
    isInitializedBaselineWithoutGit(baselineCandidateRoot);
  const fallbackBaselineState = {
    declared: isBaselineDeclarationCandidate ? isBaselineDeclared : null,
    gitlink_indexed: null,
    gitlink_conflicted: null,
    gitlink_oid: null,
    worktree_present: isBaselineDeclarationCandidate
      ? isBaselineEntryDirectory &&
        !pathContainsSymbolicLink(root, baselineCandidateRoot)
      : null,
    gitdir_accessible: isBaselineDeclarationCandidate
      ? isFallbackBaselineInitialized
      : null,
    head_readable: null,
    head_oid: null,
    head_matches_gitlink: null,
  };
  return {
    files: walk(
      root,
      () => true,
      excludedNames,
      excludedPaths,
      excludedLinks,
      unavailableDirectories,
      fallbackGitlinkPaths,
    ),
    source: "walk-fallback",
    git_failure: gitFailure,
    gitlink_detection: "unavailable",
    gitlinks: fallbackGitlinks,
    baseline_submodule: isBaselineDeclarationCandidate,
    baseline_submodule_initialized: null,
    baseline_submodule_state: fallbackBaselineState,
    exclusions: [
      ...[...excludedNames].sort(),
      ...(excludedLinks.length > 0 ? ["Symbolic links and junctions"] : []),
    ],
    unchecked:
      excludedPaths.length > 0 ||
      excludedLinks.length > 0 ||
      unavailableDirectories.size > 0
        ? [
            "Gitlink detection unavailable: Git index modes were not read",
            ...excludedPaths.map((item) => `Fallback excluded: ${item}`),
            ...excludedLinks.map((item) => `Symbolic link excluded: ${item}`),
            ...[...unavailableDirectories].map(
              (item) => `Fallback discovery unavailable: ${item}`,
            ),
          ]
        : [
            "Git file selection unavailable; fallback directory exclusions applied.",
            "Gitlink detection unavailable: Git index modes were not read",
          ],
  };
}
