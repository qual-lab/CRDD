/**
 * Repository操作をVersion Controlの完成操作へ接続する。
 * @packageDocumentation
 * @responsibility 検査・認可済みの操作要求を対応するVersion Control操作へ渡す。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary ServerのRepository操作とVersion Control。
 */

import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import type { FilesystemStoreRoot } from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import { parseRepositoryProjectContextMarkdown } from "@qual-lab/crdd-document-model";
import {
  type ChangesResult,
  commitChanges,
  type FileDiff,
  getRepository,
  pushRepositoryRevision,
  type Repository,
  readFileDiff,
  readRemoteTarget,
  readTree,
  readWorkingChanges,
  resolveVerifiedRepositoryRoot,
  stagePaths,
  type TreePage,
  unstagePaths,
} from "@qual-lab/crdd-version-control";
import {
  type GitHostLinkedAccessSession,
  resolveGitHostLinkedDevelopmentAccess,
} from "./access.ts";
import type { ProjectViewData } from "./project-context.ts";

/**
 * 公開要求が現在の送信先・Branch・Revisionを指していることを確認する。
 * @responsibility 古い公開確認をGit処置の発行前に拒否する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary 現在認可済みRepositoryの観測。Pushは発行しない。
 */
export function assertRepositoryActionTarget(
  repository: Repository,
  request: RepositoryActionRequest,
): void {
  if (request.operation !== "publish_revision") return;
  const target = readRemoteTarget(repository);
  if (
    target.status !== "available" ||
    target.destination !== request.destination ||
    target.branch !== request.branch ||
    target.revisionIdentity !== request.revisionIdentity
  )
    throw new Error("workbench_repository_publication_target_changed");
}
/**
 * Workbenchの確定済み操作をGitの完成操作へ対応付ける。
 * @responsibility UI操作名を技術要求へ変換し、認可・搬送・保存は呼出し側に残す。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 現在認可を確認済みのRepositoryと閉形式のUI操作要求。
 * @returns VCの元の技術結果をそのまま返す。
 * @precondition HTTPの対象・資格・現在許可は呼出し側で確認済み。
 * @postcondition 一要求を一つのVC完成操作へ配送する。
 * @effect 操作に応じIndex・Commit・確認済みRemoteへEffectを発行し得る。
 * @failure VCのunknown・発行済み・未確認を成功や未実施へ畳まない。
 * @invariant 自動再送・Force操作・新しい保存状態を追加しない。
 * @boundary WorkbenchのUI要求とGit技術操作。
 * @security 任意Commandや未定義fieldを下位へ渡さない。
 * @concurrency 呼出し側の既存認可・実行調停の範囲で同期実行する。
 */
export function executeRepositoryAction(
  repository: Repository,
  request: RepositoryActionRequest,
): ChangesResult {
  if (request.operation === "prepare")
    return stagePaths(repository, { paths: request.paths });
  if (request.operation === "unprepare")
    return unstagePaths(repository, { paths: request.paths });
  if (request.operation === "create_revision")
    return commitChanges(repository, { message: request.message });
  return pushRepositoryRevision(repository, {
    destination: request.destination,
    branch: request.branch,
    revisionIdentity: request.revisionIdentity,
    humanConfirmed: request.humanConfirmed,
  });
}

/**
 * Workbench向けに現在のLocal Change Setを観測する。
 *
 * @responsibility 検証済みRepository RootだけをVersion Control Adapterへ渡し、観測不能をCleanへ畳まない。
 * @trace ARCH-000002
 * @input repositoryRootにWorkbench起動時に解決したRepository Rootを受け取る。
 * @returns 作業ツリーの観測状態、Local Change Setおよび理由を返す。
 * @precondition repositoryRootはAbsolute Path候補である。
 * @postcondition availableではVersion Control公開契約を通過した完全なLocal Change Setを返す。
 * @effect Git Processを読取り専用引数で実行する。
 * @failure Root不正またはGit観測失敗を理由付きunknownとして返す。
 * @invariant 観測不能を変更0件またはCleanと表示しない。
 * @boundary Workbench Application AdapterとVersion Control Adapterの直接境界。
 * @security Repository Pathを結果へ含めず、任意のGit引数を受け付けない。
 * @concurrency 起動時の単一Snapshotとして同期観測する。
 */
export function readRepositoryChangeSet(
  repositoryRoot: string,
): ProjectViewData["repository"] {
  const verification = getRepository(repositoryRoot);
  if (verification.status !== "completed")
    return Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "repository_root_invalid",
    });
  try {
    const changes = readWorkingChanges(verification.capability, "HEAD");
    return Object.freeze({
      state: "available",
      changeSet: Object.freeze({
        contract: changes.contract,
        contractRevision: changes.contractRevision,
        revisionChanges: changes.revisionChanges,
        preparedChanges: changes.preparedChanges,
        workingChanges: changes.workingChanges,
        unregisteredPaths: changes.unregisteredPaths,
        observationComplete: changes.observationComplete,
        repositoryPathReported: changes.repositoryPathReported,
      }),
      publicationTarget: readRemoteTarget(verification.capability),
      reason: null,
    });
  } catch {
    return Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "observation_failed",
    });
  }
}

export type RepositoryFilesRequest =
  | Readonly<{ kind: "tree"; directory: string; cursor?: string }>
  | Readonly<{ kind: "diff"; path: string }>;

export type RepositoryFilesResponse = Readonly<{ repositoryId: string }> &
  (
    | Readonly<{ kind: "tree"; tree: TreePage }>
    | Readonly<{ kind: "diff"; diff: FileDiff }>
  );

export type LocalRepositoryFilesTarget = Readonly<{
  repositoryId: string;
  projectId: string;
  allowMissingManifest: boolean;
}>;

function observeLocalRepositoryFilesIdentity(
  root: string,
  target: LocalRepositoryFilesTarget,
): string | null {
  const manifest = readRepositoryManifest(root);
  if (manifest.status === "ready")
    return manifest.manifest.repositoryId === target.repositoryId &&
      manifest.manifest.projectId === target.projectId
      ? `manifest:${manifest.identity}`
      : null;
  if (manifest.status !== "missing" || !target.allowMissingManifest)
    return null;
  // Manifestなしで起動した単体だけ、現在のProject Contextから同じ対象を解決する。
  const file = path.join(root, "PROJECT_CONTEXT.md");
  const before = lstatSync(file, { bigint: true });
  if (!before.isFile() || before.ino === 0n) return null;
  const source = readFileSync(file, "utf8");
  const after = lstatSync(file, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.mtimeNs !== after.mtimeNs ||
    before.size !== after.size
  )
    return null;
  const { result } = parseRepositoryProjectContextMarkdown(source);
  return result?.repositoryId === target.repositoryId &&
    result.projectId === target.projectId
    ? "project-context"
    : null;
}

/** 対象を認可してから、要求された作業ツリー資源だけを観測する。 @trace ARCH-000012 */
export async function readRepositoryFiles(
  repositoryId: string,
  request: RepositoryFilesRequest,
  input:
    | {
        scope: "local";
        repositoryRoot: string;
        target: LocalRepositoryFilesTarget | undefined;
      }
    | {
        scope: "shared";
        root: FilesystemStoreRoot;
        session: GitHostLinkedAccessSession;
      },
  signal: AbortSignal,
): Promise<RepositoryFilesResponse | null> {
  if (signal.aborted) return null;
  const selected =
    input.scope === "shared"
      ? await resolveGitHostLinkedDevelopmentAccess(
          input.root,
          input.session,
          repositoryId,
          false,
          signal,
        )
      : input.target?.repositoryId === repositoryId
        ? {
            ownerRoot: input.repositoryRoot,
            authorize: null,
            target: input.target,
          }
        : null;
  if (!selected || signal.aborted) return null;
  const target = getRepository(selected.ownerRoot);
  if (target.status !== "completed" || signal.aborted)
    throw new Error("repository_files_unavailable");
  const localIdentity =
    "target" in selected
      ? observeLocalRepositoryFilesIdentity(selected.ownerRoot, selected.target)
      : undefined;
  if (
    localIdentity === null ||
    selected.authorize?.() === false ||
    signal.aborted
  )
    return null;
  const repository = target.capability;
  const changes = readWorkingChanges(repository, "HEAD");
  const result: RepositoryFilesResponse =
    request.kind === "tree"
      ? {
          repositoryId,
          kind: "tree",
          tree: readTree(
            repository,
            changes,
            request.directory,
            request.cursor,
            50,
          ),
        }
      : {
          repositoryId,
          kind: "diff",
          diff: readFileDiff(repository, changes, request.path),
        };
  // 同期観測中に届いた切断通知を処理する機会を置く。
  await setTimeout(0);
  if (
    signal.aborted ||
    resolveVerifiedRepositoryRoot(repository) !== selected.ownerRoot ||
    ("target" in selected
      ? observeLocalRepositoryFilesIdentity(
          selected.ownerRoot,
          selected.target,
        ) !== localIdentity
      : !selected.authorize()) ||
    signal.aborted
  )
    throw new Error("repository_files_unavailable");
  return result;
}

/**
 * 操作後の再観測失敗を、完了済みEffectの失敗へ書き換えず表示用Snapshotへ反映する。
 *
 * @responsibility 直前SnapshotのProject Contextを保持し、Repository部分だけを観測不能へ落とす。
 * @trace ARCH-000012
 * @input surfaceに操作前の最後の完全なWorkbench Snapshotを受け取る。
 * @returns Repository観測だけをunknownにしたSnapshotを返す。
 * @precondition Change Publication結果は別途確定済みである。
 * @postcondition Project Context、TopicおよびMeetingを変更せず、RepositoryをCleanと表示しない。
 * @effect N/A: 不変View Modelを新しく構築するだけである。
 * @failure N/A: 固定fieldの変換だけを行う。
 * @invariant 完了済みEffectのstatusとreasonを変更しない。
 * @boundary Repository Effect結果と操作後Read Model再観測の境界。
 * @security 失敗したPathまたは内部Errorを表示Modelへ含めない。
 * @concurrency 最後に確定したSnapshotだけを基礎にする。
 */
export function withUnknownRepositoryObservation(
  surface: ProjectViewData,
): ProjectViewData {
  return Object.freeze({
    ...surface,
    repository: Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "observation_failed",
    }),
  });
}

/**
 * WorkbenchのRepository操作要求を定義する。
 * @responsibility UI／HTTPの操作名を所有し、Git技術APIへ業務上の操作集合を持ち込まない。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary 既存Form／JSONの形状を維持する。新しい実行許可を発行しない。
 */
export type RepositoryActionRequest =
  | Readonly<{ operation: "prepare"; paths: readonly string[] }>
  | Readonly<{ operation: "unprepare"; paths: readonly string[] }>
  | Readonly<{ operation: "create_revision"; message: string }>
  | Readonly<{
      operation: "publish_revision";
      destination: string;
      branch: string;
      revisionIdentity: string;
      humanConfirmed: true;
    }>;

/**
 * 操作に相関したVersion Control結果だけを公開可能にする。
 * @responsibility 状態・理由・Effect・Revisionの組合せを閉検査する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 今回の操作要求と未知のOwner結果。
 * @returns 相関を確認した既存結果。
 * @precondition Ownerへ同じ要求を最大一回配送済みである。
 * @postcondition blockedでも発行済みEffectを消さない。
 * @effect N/A: 結果だけを検査する。
 * @failure 未知field・理由・相関を固定理由で拒否する。
 * @invariant 結果不明を成功または未処置へ補完しない。
 * @boundary Version Control OwnerとWorkbench表示の境界。
 * @security 生出力・Remote URL・秘密を結果へ追加しない。
 * @concurrency 他要求の結果を相関に使用しない。
 */
export function inspectRepositoryActionResult(
  request: RepositoryActionRequest,
  value: unknown,
): ChangesResult {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("repository_action_result_invalid");
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).sort().join(",") !==
      "automaticRetryIssued,effectConfirmed,effectIssued,forcePublicationIssued,reason,revisionIdentity,status" ||
    result.automaticRetryIssued !== false ||
    result.forcePublicationIssued !== false ||
    typeof result.effectIssued !== "boolean" ||
    typeof result.effectConfirmed !== "boolean" ||
    typeof result.reason !== "string" ||
    (result.revisionIdentity !== null &&
      (typeof result.revisionIdentity !== "string" ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(result.revisionIdentity)))
  )
    throw new Error("repository_action_result_invalid");
  let expected: readonly [string, boolean, boolean, boolean] | undefined;
  if (request.operation === "prepare" || request.operation === "unprepare") {
    if (
      request.operation === "prepare" &&
      result.reason === "prepare_external_filter_unavailable"
    )
      expected = ["blocked", false, false, false];
    else if (result.reason === `${request.operation}_completed`)
      expected = ["completed", true, true, false];
    else if (result.reason === `${request.operation}_rejected`)
      expected = ["blocked", true, false, false];
    else if (result.reason === "repository_effect_unknown")
      expected = ["unknown", true, false, false];
  } else if (request.operation === "create_revision") {
    if (result.reason === "revision_created")
      expected = ["completed", true, true, true];
    else if (result.reason === "revision_creation_rejected")
      expected = ["blocked", true, false, false];
    else if (
      result.reason === "revision_creation_unknown" ||
      result.reason === "revision_identity_unknown"
    )
      expected = ["unknown", true, false, false];
  } else {
    if (result.reason === "publication_revision_changed")
      expected = ["blocked", false, false, false];
    else if (result.reason === "publication_rejected")
      expected = ["blocked", true, false, true];
    else if (
      result.reason === "publication_result_unknown" ||
      result.reason === "publication_observation_unknown"
    )
      expected = ["unknown", true, false, true];
    else if (result.reason === "publication_confirmed")
      expected = ["completed", true, true, true];
    if (expected?.[3] && result.revisionIdentity !== request.revisionIdentity)
      throw new Error("repository_action_result_invalid");
  }
  if (
    expected === undefined ||
    result.status !== expected[0] ||
    result.effectIssued !== expected[1] ||
    result.effectConfirmed !== expected[2] ||
    (result.revisionIdentity !== null) !== expected[3]
  )
    throw new Error("repository_action_result_invalid");
  return Object.freeze({
    status: expected[0] as ChangesResult["status"],
    reason: result.reason,
    effectIssued: expected[1],
    effectConfirmed: expected[2],
    revisionIdentity: result.revisionIdentity as string | null,
    automaticRetryIssued: false,
    forcePublicationIssued: false,
  });
}
