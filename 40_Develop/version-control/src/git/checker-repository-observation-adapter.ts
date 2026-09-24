/**
 * checker-repository-observation-adapterに属する責務をまとめる。
 *
 * @responsibility runGitCommandを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

// Git固有の観測をCheckerが利用する中立なRepository結果へ変換するAdapter。

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
function runGitCommand(root: string, commandArguments: readonly string[]) {
  return spawnSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 30_000,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Pathが同一かを判定する。
 *
 * @responsibility Pathの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000002
 * @input left: string、right: string
 * @returns booleanを返す。
 * @precondition 「left: string、right: string」がsamePathの入力契約を満たす。
 * @postcondition samePathの責務を完了した結果だけを返す。
 * @effect samePathは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: samePathは独自の失敗分岐を所有しない。
 * @invariant samePathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: samePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: samePathは共有非同期状態を持たない同期処理である。
 */
function samePath(left: string, right: string): boolean {
  const leftResolved = path.resolve(left);
  const rightResolved = path.resolve(right);
  return process.platform === "win32"
    ? leftResolved.toLocaleLowerCase("en-US") ===
        rightResolved.toLocaleLowerCase("en-US")
    : leftResolved === rightResolved;
}

/**
 * failure Reasonを決定する。
 *
 * @responsibility failure Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input result: ReturnType<typeof runGitCommand>
 * @returns stringを返す。
 * @precondition 「result: ReturnType<typeof runGitCommand>」がfailureReasonの入力契約を満たす。
 * @postcondition failureReasonの責務を完了した結果だけを返す。
 * @effect N/A: failureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failureReasonは独自の失敗分岐を所有しない。
 * @invariant failureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: failureReasonはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: failureReasonは共有非同期状態を持たない同期処理である。
 */
function failureReason(result: ReturnType<typeof runGitCommand>): string {
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
 * @precondition 「configPath: string」がobserveDeclaredNestedRepositoryPathsの入力契約を満たす。
 * @postcondition observeDeclaredNestedRepositoryPathsの責務を完了した結果だけを返す。
 * @effect observeDeclaredNestedRepositoryPathsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: observeDeclaredNestedRepositoryPathsは独自の失敗分岐を所有しない。
 * @invariant observeDeclaredNestedRepositoryPathsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observeDeclaredNestedRepositoryPathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeDeclaredNestedRepositoryPathsは共有非同期状態を持たない同期処理である。
 */
export function observeDeclaredNestedRepositoryPaths(
  configPath: string,
):
  | Readonly<{ status: "completed"; paths: readonly string[] }>
  | Readonly<{ status: "unavailable"; paths: readonly string[] }> {
  const result = spawnSync(
    "git",
    [
      "config",
      "-z",
      "--file",
      configPath,
      "--get-regexp",
      "^submodule\\..*\\.path$",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 30_000,
      maxBuffer: MAX_OUTPUT_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
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
 * @precondition 「scopeRoot: string」がobserveRepositoryEntriesの入力契約を満たす。
 * @postcondition observeRepositoryEntriesの責務を完了した結果だけを返す。
 * @effect N/A: observeRepositoryEntriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeRepositoryEntriesは独自の失敗分岐を所有しない。
 * @invariant observeRepositoryEntriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observeRepositoryEntriesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeRepositoryEntriesは共有非同期状態を持たない同期処理である。
 */
export function observeRepositoryEntries(scopeRoot: string):
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

/**
 * Nested Repositoryを観測する。
 *
 * @responsibility Nested Repositoryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input scopeRoot: string、relativePath: string
 * @returns observeNestedRepositoryの計算結果を返す。
 * @precondition 「scopeRoot: string、relativePath: string」がobserveNestedRepositoryの入力契約を満たす。
 * @postcondition observeNestedRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: observeNestedRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeNestedRepositoryは独自の失敗分岐を所有しない。
 * @invariant observeNestedRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observeNestedRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeNestedRepositoryは共有非同期状態を持たない同期処理である。
 */
export function observeNestedRepository(
  scopeRoot: string,
  relativePath: string,
) {
  const target = path.resolve(scopeRoot, relativePath);
  const top = runGitCommand(target, ["rev-parse", "--show-toplevel"]);
  const metadata = runGitCommand(target, ["rev-parse", "--absolute-git-dir"]);
  const revision = runGitCommand(target, ["rev-parse", "--verify", "HEAD"]);
  const revisionIdentity =
    revision.status === 0 && /^[0-9a-f]{40,64}$/iu.test(revision.stdout.trim())
      ? revision.stdout.trim().toLowerCase()
      : null;
  return Object.freeze({
    exactRepository: top.status === 0 && samePath(top.stdout.trim(), target),
    metadataAccessible: metadata.status === 0,
    revisionIdentity,
    repositoryPathReported: false,
  });
}

/**
 * Fixed Snapshot Textを読み取る。
 *
 * @responsibility Fixed Snapshot Textの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000002
 * @input repositoryRoot: string、revisionIdentity: string、relativePath: string
 * @returns string | nullを返す。
 * @precondition 「repositoryRoot: string、revisionIdentity: string、relativePath: string」がreadFixedSnapshotTextの入力契約を満たす。
 * @postcondition readFixedSnapshotTextの責務を完了した結果だけを返す。
 * @effect N/A: readFixedSnapshotTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readFixedSnapshotTextは独自の失敗分岐を所有しない。
 * @invariant readFixedSnapshotTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readFixedSnapshotTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readFixedSnapshotTextは共有非同期状態を持たない同期処理である。
 */
export function readFixedSnapshotText(
  repositoryRoot: string,
  revisionIdentity: string,
  relativePath: string,
): string | null {
  if (
    !/^[0-9a-f]{40,64}$/iu.test(revisionIdentity) ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return null;
  const result = runGitCommand(repositoryRoot, [
    "--no-replace-objects",
    "show",
    `${revisionIdentity}:${relativePath}`,
  ]);
  return result.status === 0 ? result.stdout : null;
}

/**
 * Revision Identityを一意に解決する。
 *
 * @responsibility Revision Identityの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input repositoryRoot: string、selector: string
 * @returns string | nullを返す。
 * @precondition 「repositoryRoot: string、selector: string」がresolveRevisionIdentityの入力契約を満たす。
 * @postcondition resolveRevisionIdentityの責務を完了した結果だけを返す。
 * @effect N/A: resolveRevisionIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRevisionIdentityは独自の失敗分岐を所有しない。
 * @invariant resolveRevisionIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resolveRevisionIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRevisionIdentityは共有非同期状態を持たない同期処理である。
 */
export function resolveRevisionIdentity(
  repositoryRoot: string,
  selector: string,
): string | null {
  if (
    selector.length === 0 ||
    selector.length > 1_024 ||
    /[\u0000-\u001f\u007f]/u.test(selector) ||
    selector.startsWith("-")
  )
    return null;
  const result = runGitCommand(repositoryRoot, [
    "rev-parse",
    "--verify",
    selector,
  ]);
  const value = result.status === 0 ? result.stdout.trim().toLowerCase() : "";
  return /^[0-9a-f]{40,64}$/u.test(value) ? value : null;
}
