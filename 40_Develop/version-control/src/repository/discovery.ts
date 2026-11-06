/**
 * 入れ子Repository・固定本文・改訂の有限なGit観測を提供する。
 * @responsibility 入れ子Repository・固定本文・改訂の有限なGit観測を提供する。
 * @trace ARCH-000002
 */
import { executeGit } from "../git/execute.ts";
import {
  getRepositoryFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
} from "./location.ts";
import path from "node:path";

// Repositoryの一覧と宣言されたsubmoduleを技術値として観測する。

const MAX_OUTPUT_BYTES = 16 * 1_024 * 1_024;

/**
 * Git Commandを実行する。
 *
 * @responsibility Git Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000002
 * @input root: string、commandArguments: readonly string[]
 * @returns runGitCommandの計算結果を返す。
 * @precondition 「root: string、commandArguments: readonly string[]」がrunGitCommandの入力契約を満たす。
 * @postcondition runGitCommandの責務を完了した結果だけを返す。
 * @effect runGitCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runGitCommandは独自の失敗分岐を所有しない。
 * @invariant runGitCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: runGitCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runGitCommandは共有非同期状態を持たない同期処理である。
 */
type GitObservationResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
};
/** Rootを再検証して固定Git観測を発行し、終了不明を成功へ補完しない。 */
function runGitCommand(
  root: string,
  commandArguments: readonly string[],
): GitObservationResult {
  const repository = getRepositoryFromWorkingDirectory(root);
  const actual =
    repository.status === "completed"
      ? resolveVerifiedRepositoryRoot(repository.capability)
      : null;
  if (actual === null) return { status: null, stdout: "", stderr: "" };
  const result = executeGit(actual, commandArguments, {
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  return {
    status: result.error || result.signal ? null : result.status,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? "",
    ...(result.error ? { error: result.error } : {}),
  };
}

/**
 * failure Reasonを決定する。
 *
 * @responsibility failure Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input result: GitObservationResult
 * @returns stringを返す。
 * @precondition 「result: GitObservationResult」がfailureReasonの入力契約を満たす。
 * @postcondition failureReasonの責務を完了した結果だけを返す。
 * @effect N/A: failureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failureReasonは独自の失敗分岐を所有しない。
 * @invariant failureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: failureReasonはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: failureReasonは共有非同期状態を持たない同期処理である。
 */
function failureReason(result: GitObservationResult): string {
  if (result.error && "code" in result.error && result.error.code === "ENOENT")
    return "version_control_not_installed";
  if (/not a git repository/iu.test(result.stderr || ""))
    return "repository_not_found";
  return "repository_observation_failed";
}

/**
 * checker-repository-observation-adapterで使用するRepository Entry Observationの値契約を定義する。
 *
 * @responsibility Repository Entry ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryEntryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryEntryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryEntryObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryEntryObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryEntryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryEntryObservation = Readonly<{
  relativePath: string;
  kind: "file" | "nested_repository";
  contentIdentity: string | null;
  conflicted: boolean;
}>;

/**
 * Declared Nested Repository Pathsを観測する。
 *
 * @responsibility Declared Nested Repository Pathsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input configPath: string
 * @returns | Readonly<{ status: "completed"; paths: readonly string[] }> | Readonly<{ status: "unavailable"; paths: readonly string[] }>を返す。
 * @precondition 「configPath: string」がreadRepositorySubmodulesの入力契約を満たす。
 * @postcondition readRepositorySubmodulesの責務を完了した結果だけを返す。
 * @effect ローカルGit子Processで宣言を読み取る。書込み・外部送信は行わない。
 * @failure N/A: readRepositorySubmodulesは独自の失敗分岐を所有しない。
 * @invariant readRepositorySubmodulesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readRepositorySubmodulesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRepositorySubmodulesは共有非同期状態を持たない同期処理である。
 */
export function readRepositorySubmodules(
  repositoryRoot: string,
):
  | Readonly<{ status: "completed"; paths: readonly string[] }>
  | Readonly<{ status: "unavailable"; paths: readonly string[] }> {
  const raw = executeGit(
    repositoryRoot,
    [
      "config",
      "-z",
      "--file",
      path.join(repositoryRoot, ".gitmodules"),
      "--get-regexp",
      "^submodule\\..*\\.path$",
    ],
    { maxBuffer: MAX_OUTPUT_BYTES },
  );
  const result = {
    status: raw.error || raw.signal ? null : raw.status,
    stdout: raw.stdout?.toString("utf8") ?? "",
  };
  if (result.status === 1)
    return Object.freeze({ status: "completed", paths: Object.freeze([]) });
  if (result.status !== 0)
    return Object.freeze({ status: "unavailable", paths: Object.freeze([]) });
  const paths: string[] = [];
  for (const entry of result.stdout.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\n");
    if (separator < 0)
      return Object.freeze({
        status: "unavailable",
        paths: Object.freeze([]),
      });
    paths.push(entry.slice(separator + 1));
  }
  return Object.freeze({
    status: "completed",
    paths: Object.freeze([...new Set(paths)]),
  });
}

/**
 * Repository Entriesを観測する。
 *
 * @responsibility Repository Entriesの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input scopeRoot: string
 * @returns | Readonly<{ status: "completed"; entries: readonly RepositoryEntryObservation[]; nestedRepositoryObservationComplete: boolean; repositoryPathReported: false; }> | Readonly<{ status: "unavailable"; reason: string; entries: readonly RepositoryEntryObservation[]; repositoryPathReported: false; }>を返す。
 * @precondition 「scopeRoot: string」がreadRepositoryEntriesの入力契約を満たす。
 * @postcondition readRepositoryEntriesの責務を完了した結果だけを返す。
 * @effect ローカルGit子Processで対象Entryを観測する。書込み・外部送信は行わない。
 * @failure N/A: readRepositoryEntriesは独自の失敗分岐を所有しない。
 * @invariant readRepositoryEntriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readRepositoryEntriesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRepositoryEntriesは共有非同期状態を持たない同期処理である。
 */
export function readRepositoryEntries(scopeRoot: string):
  | Readonly<{
      status: "completed";
      entries: readonly RepositoryEntryObservation[];
      nestedRepositoryObservationComplete: boolean;
      repositoryPathReported: false;
    }>
  | Readonly<{
      status: "unavailable";
      reason: string;
      entries: readonly RepositoryEntryObservation[];
      repositoryPathReported: false;
    }> {
  const rootResult = runGitCommand(scopeRoot, ["rev-parse", "--show-toplevel"]);
  if (rootResult.status !== 0)
    return Object.freeze({
      status: "unavailable",
      reason: failureReason(rootResult),
      entries: Object.freeze([]),
      repositoryPathReported: false,
    });
  const repositoryRoot = path.resolve(rootResult.stdout.trim());
  const relativeScope = path.relative(repositoryRoot, path.resolve(scopeRoot));
  if (relativeScope.startsWith("..") || path.isAbsolute(relativeScope))
    return Object.freeze({
      status: "unavailable",
      reason: "repository_boundary_invalid",
      entries: Object.freeze([]),
      repositoryPathReported: false,
    });
  const selector = relativeScope === "" ? "." : relativeScope;
  const files = runGitCommand(repositoryRoot, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    selector,
  ]);
  const staged = runGitCommand(repositoryRoot, [
    "ls-files",
    "--stage",
    "-z",
    "--",
    selector,
  ]);
  if (files.status !== 0)
    return Object.freeze({
      status: "unavailable",
      reason: "repository_entries_observation_failed",
      entries: Object.freeze([]),
      repositoryPathReported: false,
    });
  const result = new Map<string, RepositoryEntryObservation>();
  for (const repositoryRelative of files.stdout.split("\0").filter(Boolean)) {
    const absolute = path.resolve(repositoryRoot, repositoryRelative);
    const scopeRelative = path
      .relative(path.resolve(scopeRoot), absolute)
      .replaceAll("\\", "/");
    if (scopeRelative.startsWith("../") || path.isAbsolute(scopeRelative))
      continue;
    result.set(scopeRelative, {
      relativePath: scopeRelative,
      kind: "file",
      contentIdentity: null,
      conflicted: false,
    });
  }
  if (staged.status !== 0)
    return Object.freeze({
      status: "completed",
      entries: Object.freeze([...result.values()]),
      nestedRepositoryObservationComplete: false,
      repositoryPathReported: false,
    });
  const nested = new Map<
    string,
    { contentIdentity: string | null; conflicted: boolean }
  >();
  for (const entry of staged.stdout.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\t");
    const metadata =
      separator < 0
        ? null
        : /^(\d{6}) ([0-9a-f]{40,64}) ([0-3])$/iu.exec(
            entry.slice(0, separator),
          );
    if (!metadata)
      return Object.freeze({
        status: "completed",
        entries: Object.freeze([...result.values()]),
        nestedRepositoryObservationComplete: false,
        repositoryPathReported: false,
      });
    if (metadata[1] !== "160000") continue;
    const absolute = path.resolve(repositoryRoot, entry.slice(separator + 1));
    const scopeRelative = path
      .relative(path.resolve(scopeRoot), absolute)
      .replaceAll("\\", "/");
    if (scopeRelative.startsWith("../") || path.isAbsolute(scopeRelative))
      continue;
    const existing = nested.get(scopeRelative);
    nested.set(scopeRelative, {
      contentIdentity:
        metadata[3] === "0"
          ? (metadata[2]?.toLowerCase() ?? null)
          : (existing?.contentIdentity ?? null),
      conflicted: metadata[3] !== "0" || existing?.conflicted === true,
    });
  }
  for (const [relativePath, value] of nested)
    result.set(relativePath, {
      relativePath,
      kind: "nested_repository",
      ...value,
    });
  return Object.freeze({
    status: "completed",
    entries: Object.freeze(
      [...result.values()].sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath),
      ),
    ),
    nestedRepositoryObservationComplete: true,
    repositoryPathReported: false,
  });
}
