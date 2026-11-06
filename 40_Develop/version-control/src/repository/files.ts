/**
 * Repositoryの現在作業内容のTree読取り。
 * @responsibility Main／Linkedの共通Git読取り、Path・Cursor検査とページングを所有する。
 * @trace ARCH-000002 ARCH-000009
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createWorktreeGitContext } from "../worktree/crud.ts";
import { isCommitId, isCommitPath } from "./commit.ts";
import path from "node:path";
import { types } from "node:util";
import {
  materializeGitCommitTreeCandidate,
  readGitCommitFileCandidate,
} from "../git/objects.ts";
import { resolveRepositoryGitLayout } from "./layout.ts";
import { runGitReadCommand } from "../git/read.ts";
import { readRepositoryFormat } from "./revision.ts";
import {
  getRepositoryFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "./location.ts";
import type {
  FileReadRequest,
  WorkingFile,
  TreeEntry,
  TreePage,
  CommitFile,
  CommitFileReadRequest,
  CommitFilesCopyRequest,
  CommitFilesCopyResult,
} from "./types.ts";

/**
 * Git管理下と未追跡のPathを同じWorktreeから有界に読む。
 * @responsibility TreeとFile差分の存在確認。Package内部専用。
 * @trace ARCH-000002
 * @failure Git失敗・不正UTF-8を空集合へ補完しない。
 */
export function readRepositoryPaths(root: string): readonly string[] {
  const result = runGitReadCommand(
    root,
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    2 * 1024 * 1024,
  );
  if (result.error !== undefined || result.status !== 0)
    throw new Error("repository_worktree_observation_failed");
  return Object.freeze(
    new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .split("\0")
      .filter(Boolean),
  );
}

type ChangePathSets = Readonly<{
  prepared: ReadonlySet<string>;
  working: ReadonlySet<string>;
  unregistered: ReadonlySet<string>;
}>;

/**
 * Repository相対Pathの公開契約を検証する。
 *
 * @responsibility 絶対Path、親遡及、制御文字および空Segmentを拒否し、区切りを正規化する。
 * @trace ARCH-000002
 * @input value: 未信頼Path候補、isRootAllowed: 空文字Rootを許可するか。
 * @returns 検証済みRepository相対Path。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition 返却値は`/`区切りで末尾Slashを持たない。
 * @effect N/A: 文字列検証だけを行う。
 * @failure 契約外Pathは固定Errorで拒否する。
 * @invariant Root許可を子Pathの緩和へ流用しない。
 * @boundary 未信頼入力とRepository Worktree ViewのPath境界。
 * @security Root外参照と制御文字を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function validateRelativePath(
  value: unknown,
  isRootAllowed: boolean,
): string {
  if (typeof value !== "string")
    throw new Error("repository_worktree_path_invalid");
  const normalized = value.replaceAll("\\", "/");
  if (
    (!isRootAllowed && normalized.length === 0) ||
    normalized.length > 4_096 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/u.test(normalized) ||
    normalized
      .split("/")
      .some(
        (segment) =>
          segment === "." ||
          segment === ".." ||
          (!isRootAllowed && segment.length === 0),
      ) ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  )
    throw new Error("repository_worktree_path_invalid");
  return normalized.replace(/\/$/u, "");
}

/**
 * Tree CursorをDirectoryへ拘束して復号する。
 *
 * @responsibility Cursorの形、Directory BindingおよびPath契約を一度に検証する。
 * @trace ARCH-000002
 * @input value: 未信頼Cursor、directory: 現在の一覧Directory。
 * @returns 検証済みの直前Path、または初回を表すnull。
 * @precondition directoryは検証済みRepository相対Pathである。
 * @postcondition 非null結果は同じdirectoryへ結合したRepository相対Pathである。
 * @effect N/A: Cursorを復号・検証するだけである。
 * @failure 不正Encoding、Schema、DirectoryまたはPathを固定Errorで拒否する。
 * @invariant 別DirectoryのCursorを再利用しない。
 * @boundary Client CursorとWorktree Paginationの境界。
 * @security Cursorから任意Pathへの移動を許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
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

/**
 * Path集合から指定Directoryの直下要素だけを導出する。
 *
 * @responsibility Flat Path集合と変更集合を一段のTree Entryへ決定論的に投影する。
 * @trace ARCH-000002
 * @input paths: 観測Path集合、directory: 対象Directory、changes: 変更区分集合。
 * @returns 対象Directory直下の一意なWorktree Entry集合。
 * @precondition 全PathとdirectoryはRepository相対Pathとして検証済みである。
 * @postcondition EntryはPath順で一意になり、子孫を直下Directoryへ畳む。
 * @effect N/A: 入力集合を変更しない。
 * @failure N/A: 検証済み入力だけを扱う。
 * @invariant Prepared、Working、Unregisteredの区分を失わない。
 * @boundary Git観測のFlat Path集合とWorkbench Tree表示の境界。
 * @security Host絶対Pathを生成または公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function immediateEntries(
  paths: readonly string[],
  directory: string,
  changes: ChangePathSets,
): readonly TreeEntry[] {
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
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
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
 * @input capability、変更Path集合、Directory、Cursor、上限を受け取る。
 * @returns 直下Entryと継続Cursorを返す。
 * @precondition capabilityは検証済みRepository Rootである。
 * @postcondition EntryはRepository相対Pathだけを含み、上限を超えない。
 * @effect Repositoryの追跡済み・未追跡Pathを読取る。
 * @failure Path、Cursor、上限またはGit観測が不正なら例外で拒否する。
 * @invariant Directoryを再帰全展開せず、Cursorは別Directoryへ再利用できない。
 * @boundary Workbench Tree要求とVersion Controlの境界。
 * @security PathをCommand optionやFilesystem Authorityへ昇格しない。
 * @concurrency 一回のGit読取り内だけでPageを構成する。
 */
export function readTree(
  capability: Repository,
  changes: Readonly<{
    preparedChanges: readonly string[];
    workingChanges: readonly string[];
    unregisteredPaths: readonly string[];
  }>,
  directoryValue: unknown,
  cursorValue: unknown,
  limitValue: unknown,
): TreePage {
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null) throw new Error("verified_repository_root_required");
  const directory = validateRelativePath(directoryValue ?? "", true);
  const cursor = decodeCursor(cursorValue, directory);
  const limit = limitValue === undefined ? 50 : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("repository_worktree_limit_invalid");
  const paths = Object.freeze(
    [
      ...new Set(
        readRepositoryPaths(root).map((path) =>
          validateRelativePath(path, false),
        ),
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
  const remainingEntries =
    cursor === null ? entries : entries.filter((entry) => entry.path > cursor);
  const pageEntries = remainingEntries.slice(0, limit);
  const nextCursor =
    remainingEntries.length > limit
      ? Buffer.from(
          JSON.stringify([directory, pageEntries.at(-1)?.path]),
          "utf8",
        ).toString("base64url")
      : null;
  return Object.freeze({
    directory,
    entries: Object.freeze(pageEntries),
    nextCursor,
  });
}

type CopyDirectory = Readonly<{
  path: string;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

/** Named Requestを実行前に固定し、Accessorを操作として呼ばない。 */
function captureFileRequest(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).some(
        (k) => typeof k !== "string" || !keys.includes(k),
      )
    )
      return null;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) return null;
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

/**
 * 固定CommitのFileを既存Object Readerで読み取る。
 * @responsibility Root原本・Commit・Path・mode・bytes・checksumと上限を同じ結果へ結合する。
 * @trace ARCH-000002
 * @effect Git Objectの読取りのみ。作業TreeとIndexは変更しない。
 * @failure 不正Request、欠測Object、読取り不能はnull。
 */
export function readCommitFile(
  repository: Repository,
  request: CommitFileReadRequest,
): CommitFile | null {
  try {
    const root = resolveVerifiedRepositoryRoot(repository);
    if (root === null) return null;
    const input = captureFileRequest(request, [
      "commit",
      "path",
      "maximumBytes",
    ]);
    if (
      !input ||
      typeof input.commit !== "string" ||
      typeof input.path !== "string"
    )
      return null;
    const result = readGitCommitFileCandidate({
      commonDirectory:
        resolveRepositoryGitLayout(root).commonDirectory.realPath,
      revision: input.commit,
      relativePath: input.path,
      ...(input.maximumBytes === undefined
        ? {}
        : { maximumBytes: input.maximumBytes }),
    });
    return result?.status === "read"
      ? Object.freeze({
          status: "read",
          revisionIdentity: result.revision,
          relativePath: result.relativePath,
          mode: result.mode,
          bytes: result.bytes,
          sha256: result.sha256,
          repositoryPathReported: false,
        })
      : null;
  } catch {
    return null;
  }
}

/** Copy呼出し中だけ保持するDirectoryの実体。永続化・権限発行はしない。 */
function observeCopyDirectory(directory: string): CopyDirectory | null {
  try {
    const stat = fs.lstatSync(directory, { bigint: true });
    const real = fs.realpathSync.native(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      !sameCopyPath(real, directory)
    )
      return null;
    return Object.freeze({
      path: directory,
      dev: stat.dev,
      ino: stat.ino,
      birthtimeNs: stat.birthtimeNs,
    });
  } catch {
    return null;
  }
}

/** 表記差だけを吸収し、実体の照合とは分離する。 */
function sameCopyPath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase()
    : path.normalize(left) === path.normalize(right);
}

/** 同じ呼出しで採取したRoot・親・出力の実体と比較する。 */
function isCopyDirectoryUnchanged(directory: CopyDirectory): boolean {
  const current = observeCopyDirectory(directory.path);
  return (
    current !== null &&
    current.dev === directory.dev &&
    current.ino === directory.ino &&
    current.birthtimeNs === directory.birthtimeNs
  );
}

/** 一次失敗・発行・観測不能・回収を別々の事実として返す。 */
function blockedCopy(
  reason: Extract<CommitFilesCopyResult, { status: "blocked" }>["reason"],
  effectIssued: boolean,
  isEffectStateUnknown: boolean,
  cleanupConfirmed: boolean,
): CommitFilesCopyResult {
  return Object.freeze({
    status: "blocked",
    reason,
    effectIssued,
    effectStateUnknown: isEffectStateUnknown,
    cleanupConfirmed,
    repositoryPathReported: false,
    outputPathReported: false,
  });
}

/**
 * 固定Commitの選択内容を出力Repository内へコピーする。
 * @responsibility 空出力先・Root/親/対象の実体を同一呼出し内で照合し、既存Materializeへ委譲する。
 * @trace ARCH-000002
 * @effect 検証した空Directoryだけへ生成し、失敗時は同じ実体だけを回収する。
 * @failure 別Repository境界・差替え・内容拒否・部分生成・Cleanup不明を成功へ変換しない。
 * @security 独立Token、Registry、任意Path削除や絶対Pathの結果公開を追加しない。
 */
export function copyCommitFiles(
  repository: Repository,
  request: CommitFilesCopyRequest,
): CommitFilesCopyResult | null {
  const sourceRoot = resolveVerifiedRepositoryRoot(repository);
  if (sourceRoot === null) return null;
  const input = captureFileRequest(request, [
    "commit",
    "outputRepository",
    "relativeDirectory",
    "paths",
    "inspectContent",
  ]);
  if (
    !input ||
    typeof input.commit !== "string" ||
    typeof input.relativeDirectory !== "string" ||
    !(input.paths === null || Array.isArray(input.paths)) ||
    !(
      input.inspectContent === null ||
      typeof input.inspectContent === "function"
    )
  ) {
    return blockedCopy("candidate_output_invalid", false, false, true);
  }
  const outputRepository = input.outputRepository as Repository;
  let paths: readonly string[] | null = null;
  if (input.paths !== null) {
    if (types.isProxy(input.paths))
      return blockedCopy("candidate_output_invalid", false, false, true);
    const descriptors = Object.getOwnPropertyDescriptors(input.paths);
    const captured: string[] = [];
    for (let index = 0; index < input.paths.length; index++) {
      const descriptor = descriptors[String(index)];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      )
        return blockedCopy("candidate_output_invalid", false, false, true);
      captured.push(descriptor.value);
    }
    paths = Object.freeze(captured);
  }
  const outputRoot = resolveVerifiedRepositoryRoot(outputRepository);
  if (outputRoot === null)
    return blockedCopy("candidate_output_invalid", false, false, true);
  let directory: string;
  try {
    const relative = validateRelativePath(input.relativeDirectory, false);
    if (
      relative !== input.relativeDirectory ||
      relative.split("/").some((segment) => segment.toLowerCase() === ".git")
    )
      throw Error("copy_output_invalid");
    directory = path.join(outputRoot, ...relative.split("/"));
  } catch {
    return blockedCopy("candidate_output_invalid", false, false, true);
  }
  const source = observeCopyDirectory(sourceRoot);
  const owner = observeCopyDirectory(outputRoot);
  const parent = observeCopyDirectory(path.dirname(directory));
  const target = observeCopyDirectory(directory);
  if (!source || !owner || !parent || !target)
    return blockedCopy("candidate_output_invalid", false, false, true);
  const sameTarget = () => {
    if (
      !isCopyDirectoryUnchanged(source) ||
      !isCopyDirectoryUnchanged(owner) ||
      !isCopyDirectoryUnchanged(parent) ||
      !isCopyDirectoryUnchanged(target)
    )
      return false;
    if (
      resolveVerifiedRepositoryRoot(repository) !== sourceRoot ||
      resolveVerifiedRepositoryRoot(outputRepository) !== outputRoot
    )
      return false;
    const nearest = getRepositoryFromWorkingDirectory(directory);
    return (
      nearest.status === "completed" &&
      sameCopyPath(
        resolveVerifiedRepositoryRoot(nearest.capability) ?? "",
        outputRoot,
      )
    );
  };
  try {
    if (!sameTarget() || fs.readdirSync(directory).length !== 0)
      return blockedCopy("candidate_output_invalid", false, false, true);
  } catch {
    return blockedCopy("candidate_output_invalid", false, false, true);
  }
  let isInvalidated = false;
  let isContentRejected = false;
  let wasMaterializationInvoked = false;
  try {
    const inspect = input.inspectContent;
    wasMaterializationInvoked = true;
    const result = materializeGitCommitTreeCandidate(
      {
        commonDirectory:
          resolveRepositoryGitLayout(sourceRoot).commonDirectory.realPath,
        revision: input.commit,
        workspace: directory,
        ...(paths === null ? {} : { readPaths: paths }),
      },
      (relativePath, bytes) => {
        const decision: unknown =
          inspect === null
            ? false
            : inspect(relativePath, Uint8Array.from(bytes));
        if (types.isPromise(decision)) {
          // 同期Queryの契約違反は拒否する。待機せず、Rejectだけを確実に消費する。
          void Promise.resolve(decision).catch(() => {});
        }
        if (!sameTarget() || fs.readdirSync(directory).length !== 0) {
          isInvalidated = true;
          return true;
        }
        return decision !== false;
      },
    );
    if (result?.status === "materialized" && sameTarget() && !isInvalidated)
      return Object.freeze({
        status: "materialized",
        baseRevisionIdentity: result.baseCommit,
        baseSnapshotIdentity: result.baseTree,
        fileCount: result.fileCount,
        byteLength: result.byteLength,
        contentManifestHash: result.contentManifestHash,
        repositoryPathReported: false,
        outputPathReported: false,
      });
    isContentRejected = result?.status === "blocked";
  } catch {
    /* 元失敗を保持し、同じ出力先だけを下で回収する。 */
  }
  if (isInvalidated || !sameTarget())
    return blockedCopy(
      "candidate_materialization_cleanup_unconfirmed",
      isInvalidated ? false : wasMaterializationInvoked,
      true,
      false,
    );
  // 明示的な書込み前拒否以外は、空一覧から未発行を推定しない。
  const effectIssued = wasMaterializationInvoked && !isContentRejected;
  try {
    fs.rmSync(directory, { recursive: true });
    try {
      fs.lstatSync(directory);
      throw Error("copy_cleanup_unconfirmed");
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
    }
  } catch {
    return blockedCopy(
      "candidate_materialization_cleanup_unconfirmed",
      effectIssued,
      true,
      false,
    );
  }
  return blockedCopy(
    isContentRejected
      ? "fixed_snapshot_content_policy_rejected"
      : "candidate_materialization_failed",
    effectIssued,
    !isContentRejected,
    true,
  );
}

/**
 * 現在Worktreeの内容・比較差分・raw Blob値を同じ対象から読む。
 * @responsibility 省略時の比較HEADを一度確定し、明示Baseと同じ前後照合を行う。
 * @trace ARCH-000002 ARCH-000009
 * @failure HEADなし・不正Base・形式不一致・内容／HEAD変更は拒否する。
 * @security Path・link・容量・期限の既存検査を維持し、読取りを採用許可にしない。
 */
export function readFile(
  capability: Repository,
  request: FileReadRequest,
): WorkingFile {
  const { baseCommit: requestedBase, path: selectedPath } = request;
  if (
    (requestedBase !== undefined && !isCommitId(requestedBase)) ||
    !isCommitPath(selectedPath)
  )
    throw Error("repository_file_input_invalid");
  const ctx = createWorktreeGitContext(capability);
  const before = ctx.inspect();
  if (
    !before.registered ||
    !before.directoryPresent ||
    before.locked ||
    before.prunable ||
    !before.head
  )
    throw new Error("repository_file_worktree_mismatch");
  const format = readRepositoryFormat(capability);
  if (format === null)
    throw new Error("repository_file_observation_unavailable");
  const oidLength = format.objectFormat === "sha1" ? 40 : 64;
  if (before.head.length !== oidLength)
    throw new Error("repository_file_worktree_mismatch");
  const baseCommit = requestedBase ?? before.head;
  if (baseCommit.length !== oidLength)
    throw new Error("repository_file_input_invalid");
  const segments = selectedPath.split("/");
  let directory = ctx.target;
  for (const segment of segments.slice(0, -1)) {
    directory = path.join(directory, segment);
    const info = fs.lstatSync(directory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      fs.existsSync(path.join(directory, ".git"))
    )
      throw new Error("repository_file_path_invalid");
  }
  const file = path.join(ctx.target, ...segments);
  let bytes: Buffer | null = null;
  let mode: "100644" | "100755" | null = null;
  try {
    const info = fs.lstatSync(file);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.nlink !== 1 ||
      info.size > 1024 * 1024
    )
      throw new Error("repository_file_path_invalid");
    bytes = fs.readFileSync(file);
    if (bytes.length > 1024 * 1024)
      throw new Error("repository_file_content_too_large");
    const tracked = ctx.run(ctx.owner, [
      "ls-tree",
      baseCommit,
      "--",
      selectedPath,
    ]);
    if (tracked.status !== 0)
      throw new Error("repository_file_observation_unavailable");
    mode = (
      process.platform === "win32"
        ? tracked.stdout.startsWith("100755 ")
        : (info.mode & 0o111) !== 0
    )
      ? "100755"
      : "100644";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const diff = ctx.run(ctx.target, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    baseCommit,
    "--",
    selectedPath,
  ]);
  if (diff.status !== 0 || Buffer.byteLength(diff.stdout) > 256 * 1024)
    throw new Error("repository_file_observation_unavailable");
  if (ctx.inspect().head !== before.head)
    throw new Error("repository_file_worktree_mismatch");
  if (bytes !== null) {
    const fresh = fs.lstatSync(file);
    if (
      !fresh.isFile() ||
      fresh.isSymbolicLink() ||
      fresh.nlink !== 1 ||
      fresh.size > 1024 * 1024 ||
      !fs.readFileSync(file).equals(bytes)
    )
      throw new Error("repository_file_content_changed");
  } else {
    try {
      fs.lstatSync(file);
      throw new Error("repository_file_content_changed");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const blobId =
    bytes === null
      ? null
      : createHash(format.objectFormat)
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest("hex");
  let content: string | null = null;
  let binary = false;
  if (bytes !== null) {
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      binary = bytes.includes(0);
    } catch {
      binary = true;
    }
    if (binary) content = null;
  }
  return {
    baseCommit,
    head: before.head,
    selection: {
      path: selectedPath,
      blobId,
      mode,
    },
    content,
    binary,
    patch: diff.stdout,
    truncated: false,
  };
}
