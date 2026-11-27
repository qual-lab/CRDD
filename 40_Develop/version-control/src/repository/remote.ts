/**
 * 確認済みRemoteの観測と通常Pushを所有する。
 * @responsibility 公開先・元Commitの照合と送信結果の読戻し。採用と認可は所有しない。
 * @trace ARCH-000009
 */
import type { SpawnSyncReturns } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { executeGit } from "../git/execute.ts";
import {
  observeVerifiedRepositoryLayout,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "./location.ts";
import type {
  RemoteTarget,
  RepositoryPushRequest,
  ChangesResult,
} from "./types.ts";
/** Git子Processの出力・終了・起動失敗の観測値。 */
type ProcessResult = Pick<
  SpawnSyncReturns<Buffer>,
  "error" | "signal" | "status" | "stdout"
>;
/** Repository設定を使う固定Git操作を入出力上限付きで発行する。 */
function runGit(root: string, args: readonly string[]) {
  return executeGit(root, args, {
    maxBuffer: 4 * 1024 * 1024,
    configuration: "repository",
  });
}
/** 成功応答から単一Revisionを取得し、失敗・不正値はnullにする。 */
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

/** Remote照会の一行からRevisionを取得し、複数行・失敗・不正値はnullにする。 */
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

/** 成功応答から制御文字を含まない一行だけを取得し、不明はnullにする。 */
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

/**
 * ローカル設定に明示された単一のHTTPS接続先を観測する。送信先の実行許可ではない。
 * 設定の捕捉を指定した場合、正式な読取りと同じ設定を次の観測と照合できる。
 * 照合はGitを起動せず、実体と内容の一致だけを返す。差異と観測不能はどちらもfalse。
 */
export function readOriginHttpsRemote(repository: Repository): string | null;
export function readOriginHttpsRemote(
  repository: Repository,
  options: Readonly<{ captureConfiguration: true }>,
): Readonly<{ address: string; configurationIsCurrent: () => boolean }> | null;
export function readOriginHttpsRemote(
  repository: Repository,
  options?: Readonly<{ captureConfiguration: true }>,
):
  | string
  | Readonly<{ address: string; configurationIsCurrent: () => boolean }>
  | null {
  if (options?.captureConfiguration) {
    const observation = observeVerifiedRepositoryLayout(repository, true);
    const captured = observation?.layout.configSnapshot;
    if (!observation || !captured?.contentSha256) return null;
    const address = readLocalHttpsRemote(observation.root, "url");
    const configurationIsCurrent = () =>
      isDeepStrictEqual(
        captured,
        observeVerifiedRepositoryLayout(repository, true)?.layout
          .configSnapshot,
      );
    // 正式なGit読取りを前後で同じ設定に結び付ける。差や観測不能は再利用しない。
    return address && configurationIsCurrent()
      ? Object.freeze({ address, configurationIsCurrent })
      : null;
  }
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) return null;
  return readLocalHttpsRemote(root, "url") ?? null;
}

/** undefinedは設定なし、nullは設定を一意かつ安全に読めない場合。 */
function readLocalHttpsRemote(
  root: string,
  field: "url" | "pushurl",
): string | undefined | null {
  const result = executeGit(
    root,
    [
      "config",
      "--local",
      "--no-includes",
      "--null",
      "--get-all",
      `remote.origin.${field}`,
    ],
    { maxBuffer: 4_096 },
  );
  if (result.error || result.signal) return null;
  if (result.status === 1 && result.stdout.length === 0) return undefined;
  if (result.status !== 0) return null;
  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(result.stdout);
    const [address, end, ...rest] = raw.split("\0");
    if (
      !address ||
      end !== "" ||
      rest.length !== 0 ||
      /[\s\p{Cc}]/u.test(address)
    )
      return null;
    const url = new URL(address);
    return url.protocol === "https:" &&
      url.href === address &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? address
      : null;
  } catch {
    return null;
  }
}

/**
 * 確認されたHEADと公開Branchを、明示のHTTPS originだけへ結び付ける。
 * @trace ARCH-000009
 * @boundary 本人の認可と通信の分離は呼出し側。ここでは資格を受け取らず、Git送信もしない。
 */
export function readOriginHttpsPublicationTarget(
  repository: Repository,
  request: RepositoryPushRequest,
): Readonly<{
  address: string;
  revisionIdentity: string;
  reference: string;
}> | null {
  if (request.destination !== "origin" || request.humanConfirmed !== true)
    return null;
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) return null;
  const target = readRemoteTarget(repository);
  if (
    target.status !== "available" ||
    target.destination !== request.destination ||
    target.branch !== request.branch ||
    target.revisionIdentity !== request.revisionIdentity
  )
    return null;
  const address = readLocalHttpsRemote(root, "url");
  if (!address) return null;
  const pushUrl = readLocalHttpsRemote(root, "pushurl");
  if (pushUrl !== undefined && pushUrl !== address) return null;
  return Object.freeze({
    address,
    revisionIdentity: request.revisionIdentity,
    reference: `refs/heads/${request.branch}`,
  });
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
    localBranch: null,
    revisionIdentity: null,
  });
  const reference = singleLineValue(
    runGit(repositoryRoot, ["symbolic-ref", "--quiet", "HEAD"]),
  );
  const revisionIdentity = revisionFrom(
    runGit(repositoryRoot, ["rev-parse", "HEAD"]),
  );
  const prefix = "refs/heads/";
  if (
    !reference?.startsWith(prefix) ||
    reference.length === prefix.length ||
    revisionIdentity === null
  )
    return unknown;
  const branch = reference.slice(prefix.length);
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
      localBranch: branch,
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
    localBranch: branch,
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
