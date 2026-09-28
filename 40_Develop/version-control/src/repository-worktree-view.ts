/**
 * Repository Worktreeの遅延Treeと選択File差分を公開する。
 *
 * @packageDocumentation
 * @responsibility 検証済みRepository内のPath一覧と差分を、Git固有出力を漏らさない読取り契約へ変換する。
 * @trace ARCH-000002 ARCH-000009
 * @boundary Version Control AdapterとWorkbench等のConsumerの境界。
 * @effect RepositoryとVersion Control Metadataを読取るだけである。
 * @security 任意Path、絶対Path、親参照およびRepository外Contentを拒否する。
 */
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export type RepositoryWorktreeEntry = Readonly<{
  path: string;
  name: string;
  kind: "directory" | "file";
  prepared: boolean;
  working: boolean;
  unregistered: boolean;
}>;

export type RepositoryWorktreeTreePage = Readonly<{
  directory: string;
  entries: readonly RepositoryWorktreeEntry[];
  nextCursor: string | null;
}>;

export type RepositoryWorktreeFileDiff = Readonly<{
  path: string;
  preparedPatch: string;
  workingPatch: string;
  preparedTruncated: boolean;
  workingTruncated: boolean;
  unregistered: boolean;
}>;

export type RepositoryWorktreeViewObservation = Readonly<{
  paths: readonly string[];
  readPatch(path: string): Readonly<{
    preparedPatch: string;
    workingPatch: string;
    preparedTruncated: boolean;
    workingTruncated: boolean;
  }>;
}>;

export type RepositoryWorktreeViewAdapter = (
  repositoryRoot: string,
) => RepositoryWorktreeViewObservation;

type ChangePathSets = Readonly<{
  prepared: ReadonlySet<string>;
  working: ReadonlySet<string>;
  unregistered: ReadonlySet<string>;
}>;

/** Repository相対Pathの公開契約を検証する。 */
function validateRelativePath(value: unknown, allowRoot: boolean): string {
  if (typeof value !== "string")
    throw new Error("repository_worktree_path_invalid");
  const normalized = value.replaceAll("\\", "/");
  if (
    (!allowRoot && normalized.length === 0) ||
    normalized.length > 4_096 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/u.test(normalized) ||
    normalized
      .split("/")
      .some(
        (segment) =>
          segment === "." ||
          segment === ".." ||
          (!allowRoot && segment.length === 0),
      ) ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  )
    throw new Error("repository_worktree_path_invalid");
  return normalized.replace(/\/$/u, "");
}

/** Tree CursorをDirectoryへ拘束して復号する。 */
function decodeCursor(value: unknown, directory: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 8_192)
    throw new Error("repository_worktree_cursor_invalid");
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      decoded[0] !== directory ||
      typeof decoded[1] !== "string"
    )
      throw new Error("repository_worktree_cursor_invalid");
    return validateRelativePath(decoded[1], false);
  } catch {
    throw new Error("repository_worktree_cursor_invalid");
  }
}

/** Path集合から指定Directoryの直下要素だけを導出する。 */
function immediateEntries(
  paths: readonly string[],
  directory: string,
  changes: ChangePathSets,
): readonly RepositoryWorktreeEntry[] {
  const prefix = directory.length === 0 ? "" : `${directory}/`;
  const entries = new Map<string, "directory" | "file">();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const remaining = path.slice(prefix.length);
    const [name] = remaining.split("/", 1);
    if (name === undefined || name.length === 0) continue;
    const childPath = `${prefix}${name}`;
    const kind = remaining.includes("/") ? "directory" : "file";
    if (entries.get(childPath) !== "directory") entries.set(childPath, kind);
  }
  const hasChangedDescendant = (path: string, set: ReadonlySet<string>) =>
    set.has(path) ||
    [...set].some((candidate) => candidate.startsWith(`${path}/`));
  return Object.freeze(
    [...entries.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([path, kind]) =>
        Object.freeze({
          path,
          name: path.slice(prefix.length),
          kind,
          prepared: hasChangedDescendant(path, changes.prepared),
          working: hasChangedDescendant(path, changes.working),
          unregistered: hasChangedDescendant(path, changes.unregistered),
        }),
      ),
  );
}

/**
 * Repository Treeの一Directoryを上限付きで観測する。
 *
 * @responsibility Directory単位の遅延展開、変更状態およびQuery拘束Cursorを所有する。
 * @trace ARCH-000009
 * @input capability、変更Path集合、Directory、Cursor、上限およびAdapterを受け取る。
 * @returns 直下Entryと継続Cursorを返す。
 * @precondition capabilityは検証済みRepository Rootである。
 * @postcondition EntryはRepository相対Pathだけを含み、上限を超えない。
 * @effect Repositoryの追跡済み・未追跡Pathを読取る。
 * @failure Path、Cursor、上限またはAdapter観測が不正なら例外で拒否する。
 * @invariant Directoryを再帰全展開せず、Cursorは別Directoryへ再利用できない。
 * @boundary Workbench Tree要求とVersion Control Adapterの境界。
 * @security PathをCommand optionやFilesystem Authorityへ昇格しない。
 * @concurrency 一回のAdapter Snapshot内だけでPageを構成する。
 */
export function observeRepositoryWorktreeTree(
  capability: VerifiedRepositoryRoot,
  changes: Readonly<{
    preparedChanges: readonly string[];
    workingChanges: readonly string[];
    unregisteredPaths: readonly string[];
  }>,
  directoryValue: unknown,
  cursorValue: unknown,
  limitValue: unknown,
  adapter: RepositoryWorktreeViewAdapter,
): RepositoryWorktreeTreePage {
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null) throw new Error("verified_repository_root_required");
  const directory = validateRelativePath(directoryValue ?? "", true);
  const cursor = decodeCursor(cursorValue, directory);
  const limit = limitValue === undefined ? 50 : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("repository_worktree_limit_invalid");
  const observation = adapter(root);
  const paths = Object.freeze(
    [
      ...new Set(
        observation.paths.map((path) => validateRelativePath(path, false)),
      ),
    ].sort(),
  );
  if (
    directory.length > 0 &&
    !paths.some((path) => path.startsWith(`${directory}/`))
  )
    throw new Error("repository_worktree_directory_not_found");
  const entries = immediateEntries(paths, directory, {
    prepared: new Set(changes.preparedChanges),
    working: new Set(changes.workingChanges),
    unregistered: new Set(changes.unregisteredPaths),
  });
  const after =
    cursor === null ? entries : entries.filter((entry) => entry.path > cursor);
  const page = after.slice(0, limit);
  const nextCursor =
    after.length > limit
      ? Buffer.from(
          JSON.stringify([directory, page.at(-1)?.path]),
          "utf8",
        ).toString("base64url")
      : null;
  return Object.freeze({ directory, entries: Object.freeze(page), nextCursor });
}

/**
 * 選択FileのPrepared／Working差分を観測する。
 *
 * @responsibility Treeで選択した一Fileの差分区分と切詰め状態を公開する。
 * @trace ARCH-000009
 * @input capability、変更Path集合、選択PathおよびAdapterを受け取る。
 * @returns Prepared／Working Patchと未追跡状態を返す。
 * @precondition Pathは現在Adapter Snapshotに存在するFileである。
 * @postcondition PathとPatch以外のRepository Identityを公開しない。
 * @effect RepositoryとVersion Control Metadataを読取る。
 * @failure 不正・不存在・Directory Pathまたは観測失敗を例外で拒否する。
 * @invariant 未追跡Fileの内容を暗黙に読取らず、未追跡状態だけを返す。
 * @boundary Workbench File Diff要求とVersion Control Adapterの境界。
 * @security `--`でPath optionを分離し、絶対Pathを結果へ含めない。
 * @concurrency Patchは同じAdapter呼出しの観測時点に限る。
 */
export function observeRepositoryWorktreeFileDiff(
  capability: VerifiedRepositoryRoot,
  changes: Readonly<{
    unregisteredPaths: readonly string[];
  }>,
  pathValue: unknown,
  adapter: RepositoryWorktreeViewAdapter,
): RepositoryWorktreeFileDiff {
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null) throw new Error("verified_repository_root_required");
  const selectedPath = validateRelativePath(pathValue, false);
  const observation = adapter(root);
  if (!observation.paths.includes(selectedPath))
    throw new Error("repository_worktree_file_not_found");
  const patch = observation.readPatch(selectedPath);
  return Object.freeze({
    path: selectedPath,
    ...patch,
    unregistered: changes.unregisteredPaths.includes(selectedPath),
  });
}
