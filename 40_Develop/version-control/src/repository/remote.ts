/**
 * 確認済みRemoteの観測と通常Pushを所有する。
 * @responsibility 公開先・元Commitの照合と送信結果の読戻し。採用と認可は所有しない。
 * @trace ARCH-000009
 */
import type { SpawnSyncReturns } from "node:child_process";
import { executeGit } from "../git/execute.ts";
import { resolveVerifiedRepositoryRoot, type Repository } from "./location.ts";
import type {
  RemoteTarget,
  RepositoryPushRequest,
  ChangesResult,
} from "./types.ts";
type ProcessResult = Pick<
  SpawnSyncReturns<Buffer>,
  "error" | "signal" | "status" | "stdout"
>;
function runGit(root: string, args: readonly string[]) {
  return executeGit(root, args, {
    maxBuffer: 4 * 1024 * 1024,
    configuration: "repository",
  });
}
function revisionFrom(result: ProcessResult): string | null {
  if (result.error !== undefined || result.signal || result.status !== 0)
    return null;
  try {
    const value = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .trim();
    return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value) ? value : null;
  } catch {
    return null;
  }
}

function remoteRevisionFrom(result: ProcessResult): string | null {
  if (result.error !== undefined || result.signal || result.status !== 0)
    return null;
  try {
    const lines = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean);
    if (lines.length !== 1) return null;
    const identity = lines[0]?.split(/\s+/u)[0] ?? "";
    return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(identity) ? identity : null;
  } catch {
    return null;
  }
}

function singleLineValue(result: ProcessResult): string | null {
  if (result.error !== undefined || result.signal || result.status !== 0)
    return null;
  try {
    const value = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .trim();
    return value.length > 0 &&
      !/[\u0000-\u001f\u007f]/u.test(value) &&
      !value.includes("\n") &&
      !value.includes("\r")
      ? value
      : null;
  } catch {
    return null;
  }
}

/** 現在Branchの上流設定を観測し、URL・Credentialは公開しない。 */
export function readRemoteTarget(repository: Repository): RemoteTarget {
  const repositoryRoot = resolveVerifiedRepositoryRoot(repository);
  if (repositoryRoot === null) throw Error("verified_repository_root_required");

  const unknown: RemoteTarget = Object.freeze({
    status: "unknown",
    reason: "publication_target_observation_failed",
    destination: null,
    branch: null,
    revisionIdentity: null,
  });
  const branch = singleLineValue(
    runGit(repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
  );
  const revisionIdentity = revisionFrom(
    runGit(repositoryRoot, ["rev-parse", "HEAD"]),
  );
  if (branch === null || revisionIdentity === null) return unknown;
  const destinationResult = runGit(repositoryRoot, [
    "config",
    "--get",
    `branch.${branch}.remote`,
  ]);
  const mergeResult = runGit(repositoryRoot, [
    "config",
    "--get",
    `branch.${branch}.merge`,
  ]);
  const destination = singleLineValue(destinationResult);
  const mergeReference = singleLineValue(mergeResult);
  const destinationMissing =
    !destinationResult.error &&
    !destinationResult.signal &&
    destinationResult.status === 1 &&
    destinationResult.stdout.length === 0;
  const mergeMissing =
    !mergeResult.error &&
    !mergeResult.signal &&
    mergeResult.status === 1 &&
    mergeResult.stdout.length === 0;
  // 一方が未設定でも、他方の観測失敗を未設定へ畳まない。
  if (
    (!destinationMissing && destination === null) ||
    (!mergeMissing && mergeReference === null)
  )
    return unknown;
  if (destination === null || mergeReference === null)
    return Object.freeze({
      status: "not_configured",
      reason: "publication_upstream_not_configured",
      destination: null,
      branch,
      revisionIdentity,
    });
  if (
    !mergeReference.startsWith("refs/heads/") ||
    mergeReference.length === "refs/heads/".length
  )
    return unknown;
  const mergeFormat = runGit(repositoryRoot, [
    "check-ref-format",
    mergeReference,
  ]);
  if (mergeFormat.error || mergeFormat.signal || mergeFormat.status !== 0)
    return unknown;
  // "." は同じRepositoryを指すGit標準の特別名。それ以外は設定済みRemote名だけを返す。
  if (destination !== ".") {
    const format = runGit(repositoryRoot, [
      "check-ref-format",
      `refs/remotes/${destination}/HEAD`,
    ]);
    if (format.error || format.signal || format.status !== 0) return unknown;
    const remotes = runGit(repositoryRoot, ["remote"]);
    if (remotes.error || remotes.signal || remotes.status !== 0) return unknown;
    try {
      const names = new TextDecoder("utf-8", { fatal: true })
        .decode(remotes.stdout)
        .split(/\r?\n/u)
        .filter(Boolean);
      if (!names.includes(destination)) return unknown;
    } catch {
      return unknown;
    }
  }
  return Object.freeze({
    status: "available",
    reason: "publication_target_observed",
    destination,
    branch: mergeReference.slice("refs/heads/".length),
    revisionIdentity,
  });
}
/** 確認済みCommitだけを通常Pushし、Remoteの同じRefを読戻す。自動再送・Forceは行わない。 */
export function pushRepositoryRevision(
  repository: Repository,
  request: RepositoryPushRequest,
): ChangesResult {
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) throw Error("verified_repository_root_required");
  if (
    request.humanConfirmed !== true ||
    [request.destination, request.branch, request.revisionIdentity].some(
      (value) =>
        typeof value !== "string" ||
        value.length === 0 ||
        value.startsWith("-") ||
        /[\u0000-\u0020\u007f]/u.test(value),
    )
  )
    throw Error("change_publication_target_invalid");
  const current = revisionFrom(runGit(root, ["rev-parse", "HEAD"]));
  let status: ChangesResult["status"] = "blocked",
    reason = "publication_revision_changed";
  let effectIssued = false,
    effectConfirmed = false;
  if (current !== null && current === request.revisionIdentity) {
    effectIssued = true;
    const sent = runGit(root, [
      "push",
      "--porcelain",
      request.destination,
      `${request.revisionIdentity}:refs/heads/${request.branch}`,
    ]);
    if (sent.error || sent.signal) {
      status = "unknown";
      reason = "publication_result_unknown";
    } else if (sent.status !== 0) reason = "publication_rejected";
    else {
      const observed = remoteRevisionFrom(
        runGit(root, [
          "ls-remote",
          request.destination,
          `refs/heads/${request.branch}`,
        ]),
      );
      if (observed === current) {
        status = "completed";
        reason = "publication_confirmed";
        effectConfirmed = true;
      } else {
        status = "unknown";
        reason = "publication_observation_unknown";
      }
    }
  }
  return Object.freeze({
    status,
    reason,
    effectIssued,
    effectConfirmed,
    revisionIdentity: effectIssued ? current : null,
    automaticRetryIssued: false,
    forcePublicationIssued: false,
  });
}
