/**
 * Worktree固有IndexからのCommitを生成し、確定したHEADを確認する。
 * @responsibility Commitの技術結果。採用・Ref命名・結果保存は所有しない。
 * @trace ARCH-000009
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { WorktreeGitContext } from "../worktree/types.ts";
import { executeGit } from "../git/execute.ts";
import { createWorktreeGitContext } from "../worktree/crud.ts";
import { resolveVerifiedRepositoryRoot, type Repository } from "./location.ts";
import type {
  ChangesCommitRequest,
  ChangesResult,
  CommitCreateRequest,
  CommitCreateResult,
  CommitTemporary,
} from "./types.ts";

// 既存一時領域のexact再入場Identity。業務候補の分類ではない。
const COMMIT_TEMPORARY_PREFIX = "candidate-index-";

type MutableCommitResult = {
  status: "completed" | "blocked";
  reason: string;
  commitId: string | null;
  effectIssued: boolean;
  cleanupConfirmed: boolean;
  temporary: CommitTemporary | null;
  changedPaths: readonly string[];
};
/** 確認されたMessageで現在IndexをCommitし、Commit IDの読戻しまで結果へ含める。 */
export function commitChanges(
  repository: Repository,
  request: ChangesCommitRequest,
): ChangesResult {
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) throw Error("verified_repository_root_required");
  if (
    typeof request.message !== "string" ||
    request.message.trim().length === 0 ||
    request.message.length > 4096 ||
    /[\u0000\u007f]/u.test(request.message)
  )
    throw Error("change_publication_message_invalid");
  const execution = executeGit(
    root,
    ["commit", "--quiet", "--message", request.message],
    { maxBuffer: 4 * 1024 * 1024, configuration: "repository" },
  );
  let status: ChangesResult["status"] =
    execution.error || execution.signal
      ? "unknown"
      : execution.status === 0
        ? "completed"
        : "blocked";
  let reason =
    execution.error || execution.signal
      ? "revision_creation_unknown"
      : execution.status === 0
        ? "revision_created"
        : "revision_creation_rejected";
  let revisionIdentity: string | null = null;
  if (status === "completed") {
    const observed = executeGit(root, ["rev-parse", "HEAD"], {
      maxBuffer: 4 * 1024 * 1024,
      configuration: "repository",
    });
    const value = observed?.stdout.toString("utf8").trim();
    if (
      observed &&
      !observed.error &&
      observed.status === 0 &&
      value &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value)
    )
      revisionIdentity = value;
    else {
      status = "unknown";
      reason = "revision_identity_unknown";
    }
  }
  return Object.freeze({
    status,
    reason,
    effectIssued: true,
    effectConfirmed: status === "completed",
    revisionIdentity,
    automaticRetryIssued: false,
    forcePublicationIssued: false,
  });
}

/** 確認済みの選択だけからCommit Objectを生成する。Ref／HEAD／通常Indexは更新しない。 */
export function createCommit(
  repository: Repository,
  request: CommitCreateRequest,
): CommitCreateResult {
  const previousCommit = request.previousCommit ?? null;
  const previousTemporary = request.temporary ?? null;
  return operateCommit(
    repository,
    request,
    (ctx, result) => {
      if (result.temporary) {
        cleanCommitTemporary(ctx, request.temporaryDirectory, result.temporary);
        result.temporary = null;
        result.cleanupConfirmed = true;
      }
      if (previousCommit !== null) {
        if (!isCommitId(previousCommit))
          throw new Error("commit_create_input_invalid");
        result.changedPaths = verifyCommitSelection(
          ctx,
          request,
          previousCommit,
        );
        result.commitId = previousCommit;
        result.reason = "commit_create_existing_confirmed";
        return;
      }
      const observation = ctx.inspect();
      if (
        !observation.registered ||
        !observation.directoryPresent ||
        observation.locked ||
        observation.prunable ||
        observation.head !== request.expectedHead ||
        (ctx.branch !== "" && observation.branchHead !== request.expectedHead)
      )
        throw new Error("commit_create_worktree_mismatch");
      const temporary = fs.mkdtempSync(
        path.join(
          commitTemporaryParent(ctx, request.temporaryDirectory),
          COMMIT_TEMPORARY_PREFIX,
        ),
      );
      result.temporary = {
        relativePath: path
          .relative(ctx.owner, temporary)
          .split(path.sep)
          .join("/"),
        identity: null,
      };
      result.cleanupConfirmed = false;
      const indexFile = path.join(temporary, "index");
      /**
       * 自己所有の一時indexだけへGit操作を結合する。
       * @responsibility 通常indexを更新せず非0を一次失敗へ返す。
       * @trace ARCH-000009
       * @input args: 固定Git引数、input: 確認済みraw bytes。
       * @returns 有界stdout。
       * @precondition 親は本操作が作成した一時Directory。
       * @postcondition index指定を全要求へ維持。
       * @effect argsで指定したGit Object／一時index操作。
       * @failure 非0・応答不明は停止。
       * @invariant Shellを使わない。
       * @boundary 実Git。
       * @security 生stderrを返さない。
       * @concurrency 既存上位Lease下。
       */
      const run = (args: string[], input?: Buffer) => {
        const response = ctx.run(ctx.owner, args, {
          indexFile,
          ...(input === undefined ? {} : { input }),
        });
        if (response.status !== 0) throw new Error("commit_create_git_failed");
        return response.stdout.trim();
      };
      try {
        result.temporary = {
          ...result.temporary,
          identity: temporaryIdentity(fs.lstatSync(temporary)),
        };
        run(["read-tree", request.baseCommit]);
        for (const item of request.selection) {
          let cursor = ctx.target;
          const segments = item.path.split("/");
          for (const segment of segments.slice(0, -1)) {
            cursor = path.join(cursor, segment);
            const info = fs.lstatSync(cursor);
            if (
              !info.isDirectory() ||
              info.isSymbolicLink() ||
              fs.existsSync(path.join(cursor, ".git"))
            )
              throw new Error("commit_create_path_invalid");
          }
          const absolute = path.join(ctx.target, ...segments);
          if (item.blobId === null) {
            try {
              fs.lstatSync(absolute);
              throw new Error("commit_create_deletion_mismatch");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                throw error;
            }
            run(["update-index", "--force-remove", "--", item.path]);
          } else {
            const info = fs.lstatSync(absolute);
            if (
              !info.isFile() ||
              info.isSymbolicLink() ||
              info.nlink !== 1 ||
              info.size > 64 * 1024 * 1024
            )
              throw new Error("commit_create_path_invalid");
            const bytes = fs.readFileSync(absolute);
            const calculated = createHash(
              item.blobId.length === 40 ? "sha1" : "sha256",
            )
              .update(`blob ${bytes.length}\0`)
              .update(bytes)
              .digest("hex");
            if (calculated !== item.blobId)
              throw new Error("commit_create_content_changed");
            result.effectIssued = true;
            if (run(["hash-object", "-w", "--stdin"], bytes) !== item.blobId)
              throw new Error("commit_create_blob_mismatch");
            run([
              "update-index",
              "--add",
              "--cacheinfo",
              item.mode as string,
              item.blobId,
              item.path,
            ]);
          }
        }
        result.effectIssued = true;
        const tree = run(["write-tree"]);
        const commit = run([
          "commit-tree",
          tree,
          "-p",
          request.baseCommit,
          "-m",
          request.message,
        ]);
        result.commitId = commit;
        result.changedPaths = verifyCommitSelection(ctx, request, commit);
        if (ctx.inspect().head !== request.expectedHead)
          throw new Error("commit_create_worktree_mismatch");
        result.reason = "commit_create_completed";
      } finally {
        try {
          cleanCommitTemporary(
            ctx,
            request.temporaryDirectory,
            result.temporary,
          );
          result.temporary = null;
          result.cleanupConfirmed = true;
        } catch {
          result.cleanupConfirmed = false;
        }
      }
    },
    previousTemporary,
  );
}

/** 選択Commitの各段階を保持し、未確認を成功へ補完しない。 */
function operateCommit(
  repository: Repository,
  request: CommitCreateRequest,
  action: (ctx: WorktreeGitContext, result: MutableCommitResult) => void,
  previousTemporary: CommitTemporary | null,
): CommitCreateResult {
  const result: MutableCommitResult = {
    status: "blocked",
    reason: "commit_create_input_invalid",
    commitId: null,
    effectIssued: false,
    cleanupConfirmed: previousTemporary === null,
    temporary: previousTemporary,
    changedPaths: [],
  };
  try {
    if (!validCommitCreateRequest(request))
      throw Error("commit_create_input_invalid");
    const ctx = createWorktreeGitContext(repository, request.worktree);
    if (request.previousCommit == null || previousTemporary !== null)
      commitTemporaryParent(ctx, request.temporaryDirectory);
    action(ctx, result);
    if (result.cleanupConfirmed) result.status = "completed";
    else result.reason = "commit_temporary_cleanup_unconfirmed";
  } catch (error) {
    result.reason =
      error instanceof Error &&
      /^(?:commit_create|commit_temporary|worktree)_[a-z_]+$/u.test(
        error.message,
      )
        ? error.message
        : "commit_create_outcome_unknown";
  }
  return result;
}

function verifyCommitSelection(
  ctx: WorktreeGitContext,
  request: CommitCreateRequest,
  commit: string,
) {
  const parents = ctx.run(ctx.owner, [
    "rev-list",
    "--parents",
    "-n",
    "1",
    commit,
  ]);
  if (
    parents.status !== 0 ||
    parents.stdout.trim() !== `${commit} ${request.baseCommit}`
  )
    throw new Error("commit_create_parent_mismatch");
  const diff = ctx.run(ctx.owner, [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "--no-renames",
    "-r",
    "-z",
    request.baseCommit,
    commit,
  ]);
  if (diff.status !== 0) throw new Error("commit_create_diff_unavailable");
  const paths = diff.stdout.split("\0").filter(Boolean);
  if (
    !paths.length ||
    paths.some((p) => !request.selection.some((s) => s.path === p))
  )
    throw new Error("commit_create_selection_mismatch");
  for (const item of request.selection) {
    const entry = ctx.run(ctx.owner, [
      "ls-tree",
      "-z",
      commit,
      "--",
      item.path,
    ]);
    const expected =
      item.blobId === null
        ? ""
        : `${item.mode} blob ${item.blobId}\t${item.path}\0`;
    if (entry.status !== 0 || entry.stdout !== expected)
      throw new Error("commit_create_content_mismatch");
  }
  return paths;
}

/**
 * 一時Directoryの実体照合値を作る。
 * @responsibility 名前が同じ別実体の誤回収を避ける。
 * @trace ARCH-000009
 * @input info: lstat結果。
 * @returns 非秘密の照合Hash。
 * @precondition 自己生成Directory。
 * @postcondition Authorityは発行しない。
 * @effect N/A: 局所計算。
 * @failure 計算失敗を呼出し元へ返す。
 * @invariant Pathだけに依存しない。
 * @boundary 同一Process。
 * @security dev・ino・生成時刻を使用する。
 * @concurrency 内容更新によって変わらない識別属性だけを使う。
 */
export function temporaryIdentity(info: fs.Stats): string {
  return createHash("sha256")
    .update(JSON.stringify([info.dev, info.ino, info.birthtimeMs]))
    .digest("hex");
}

/**
 * 同じ候補の既知一時indexだけを再照合して回収する。
 * @responsibility 不存在と観測不能を区別し兄弟領域を触らない。
 * @trace ARCH-000009
 * @input 検証済みGit context、上位確定の管理相対Directory、既存一時参照。
 * @returns 正常終了時だけ不存在確認済み。
 * @precondition 上位が同対象の既存操作排他を保持。
 * @postcondition Path・実体・限定内容が違えば削除しない。
 * @effect 自己所有indexとそのDirectoryの削除。
 * @failure 観測不能・不一致・削除失敗はthrow。
 * @invariant 新Registry・再帰探索なし。
 * @boundary Repository-local .crdd。
 * @security linkと未知の内容を拒否する。
 * @concurrency 非協調Hostの競合を完全原子化したとは扱わない。
 */
export function cleanCommitTemporary(
  ctx: WorktreeGitContext,
  relativeDirectory: string,
  temporary: CommitTemporary,
): void {
  const prefix = `${relativeDirectory}/${COMMIT_TEMPORARY_PREFIX}`;
  if (
    !temporary.relativePath.startsWith(prefix) ||
    !/^[A-Za-z0-9]{6}$/u.test(temporary.relativePath.slice(prefix.length)) ||
    temporary.identity === null ||
    !/^[a-f0-9]{64}$/u.test(temporary.identity)
  )
    throw new Error("commit_temporary_identity_mismatch");
  const parent = commitTemporaryParent(ctx, relativeDirectory);
  if (
    fs.realpathSync.native(parent) !== parent ||
    fs.lstatSync(parent).isSymbolicLink()
  )
    throw new Error("commit_temporary_identity_mismatch");
  const target = path.join(ctx.owner, ...temporary.relativePath.split("/"));
  if (path.dirname(target) !== parent)
    throw new Error("commit_temporary_identity_mismatch");
  let info: fs.Stats;
  try {
    info = fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    temporaryIdentity(info) !== temporary.identity
  )
    throw new Error("commit_temporary_identity_mismatch");
  for (const name of fs.readdirSync(target)) {
    const item = fs.lstatSync(path.join(target, name));
    if (
      !["index", "index.lock"].includes(name) ||
      !item.isFile() ||
      item.isSymbolicLink() ||
      item.nlink !== 1
    )
      throw new Error("commit_temporary_contents_unknown");
  }
  fs.rmSync(target, { recursive: true });
  try {
    fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("commit_temporary_cleanup_unconfirmed");
}

/** 上位確定のRepository-local一時Index親をlink非追従で確認する。 */
function commitTemporaryParent(
  ctx: WorktreeGitContext,
  relativeDirectory: string,
): string {
  if (
    typeof relativeDirectory !== "string" ||
    !relativeDirectory.startsWith(".crdd/") ||
    relativeDirectory
      .split("/")
      .some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.toLowerCase() === ".git" ||
          /[\\:\x00-\x1f\x7f]/u.test(segment),
      )
  )
    throw Error("commit_temporary_identity_mismatch");
  let parent = ctx.owner;
  for (const segment of relativeDirectory.split("/")) {
    parent = path.join(parent, segment);
    const info = fs.lstatSync(parent);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      fs.realpathSync.native(parent) !== parent
    )
      throw Error("commit_temporary_identity_mismatch");
  }
  return parent;
}

/** Git Object文法だけを判定し、存在・認可へ昇格しない。 */
export function isCommitId(value: unknown): value is string {
  return (
    typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value)
  );
}
/** 選択と技術要求の閉形式を検査する。業務ID・CHG・採否は扱わない。 */
function validCommitCreateRequest(
  value: unknown,
): value is CommitCreateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).some(
      (key) =>
        ![
          "baseCommit",
          "worktree",
          "expectedHead",
          "selection",
          "message",
          "temporaryDirectory",
          "previousCommit",
          "temporary",
        ].includes(key),
    ) ||
    !isCommitId(r.baseCommit) ||
    !isCommitId(r.expectedHead) ||
    r.baseCommit.length !== r.expectedHead.length ||
    typeof r.message !== "string" ||
    !r.message.trim() ||
    r.message.length > 4096 ||
    /[\x00\x7f]/u.test(r.message) ||
    typeof r.temporaryDirectory !== "string" ||
    (r.previousCommit !== undefined &&
      r.previousCommit !== null &&
      !isCommitId(r.previousCommit)) ||
    !Array.isArray(r.selection) ||
    r.selection.length < 1 ||
    r.selection.length > 1000
  )
    return false;
  const paths = new Set<string>();
  for (const item of r.selection) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).sort().join(",") !== "blobId,mode,path" ||
      !isCommitPath(item.path) ||
      !(
        (item.blobId === null && item.mode === null) ||
        (isCommitId(item.blobId) &&
          item.blobId.length === r.baseCommit.length &&
          ["100644", "100755"].includes(item.mode))
      ) ||
      paths.has(item.path.toLowerCase())
    )
      return false;
    paths.add(item.path.toLowerCase());
  }
  return true;
}

/** 固定選択で使用する相対File Pathの閉形式。 */
export function isCommitPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1000 &&
    !value
      .split("/")
      .some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.trim() !== segment ||
          /[. ]$/u.test(segment) ||
          /^\.(?:git|crdd)$/iu.test(segment) ||
          /[\\:\x00-\x1f\x7f*?[\]]/u.test(segment),
      )
  );
}
