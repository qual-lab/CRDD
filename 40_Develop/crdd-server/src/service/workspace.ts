/**
 * HTTP／MCP共通の作業領域管理を所有する。
 * @responsibility 対象・世代を照合し、実行モデルへの保存とVersion Controlの処置を接続する。
 * @trace ARCH-000005, ARCH-000012
 * @boundary 確認済みの要求、既存の実行・採用排他、Worktreeの操作。
 */

import { GIT_OBJECT_ID, RESOURCE_ID, UUID } from "./identity.ts";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import { randomUUID } from "node:crypto";
import fs, { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";
import {
  beginWorkspaceOperation,
  type RepositoryWorktreeResult,
  readWorkspaceState,
  saveIntegrationRecord,
  updateWorkspaceMetadata,
  type WorkspaceCandidateRequest,
  type WorkspaceCandidateResult,
  type WorkspaceRecord,
} from "@qual-lab/crdd-execution-model";
import {
  type CommitSelection,
  type CommitTemporary,
  createCommit,
  createReference,
  createWorktree,
  getRepository,
  getWorktree,
  mergeCommit,
  type Repository,
  readCommitDiff,
  readFile,
  readRepositoryLocation,
  readRepositoryRevision,
  readWorkingChanges,
  readWorktreeCreationSource,
  removeReference,
  removeWorktree,
  resolveVerifiedRepositoryRoot,
  type WorktreeResult,
  type WorktreeTarget,
} from "@qual-lab/crdd-version-control";
import {
  resolveRepositoryExecutionDataPaths,
  type PreparedWorkspaceTarget,
  deriveCoordinatorRepositoryBindingId,
  validIdentity,
  containsRecognizedSecretText,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "@qual-lab/crdd-coordinator";

/** 認可済みProjectのWorkspace記録から実行候補を渡す。実Worktreeは実行側が排他内で確認する。 @trace ARCH-000005 */
export function prepareWorkspaceExecutionTarget(
  ownerRepositoryRoot: string,
  projectId: string,
  workspaceId: string | null | undefined,
): PreparedWorkspaceTarget | null {
  return observeWorkspaceExecutionTarget(
    ownerRepositoryRoot,
    projectId,
    workspaceId,
  ).value;
}

/** 一時的な保存競合と対象の不在を区別して実行受付へ渡す。 @trace ARCH-000012 */
export function observeWorkspaceExecutionTarget(
  ownerRepositoryRoot: string,
  projectId: string,
  workspaceId: string | null | undefined,
) {
  const observed = (value: PreparedWorkspaceTarget | null) => ({
    status: "completed" as const,
    reason: value
      ? "coordinator_workspace_target_observed"
      : "coordinator_workspace_target_changed",
    value,
  });
  if (!isWorkspaceId(workspaceId)) return observed(null);
  try {
    const snapshot = readWorkspaceState(
      { directory: ownerRepositoryRoot },
      deriveCoordinatorRepositoryBindingId(ownerRepositoryRoot),
    );
    if (snapshot.status !== "completed") return snapshot;
    if (
      !snapshot.value?.queueEntries.some(
        (queue) =>
          queue.projectId === projectId && queue.workspaceId === workspaceId,
      )
    )
      return observed(null);
    const record = snapshot.value.workspaces.find(
      (entry) => entry.workspaceId === workspaceId,
    );
    if (record?.phase !== "ready" || record.holdUntil !== null)
      return observed(null);
    const worktree = Object.freeze(workspaceWorktreeTarget(workspaceId));
    if (
      record.lastResult?.relativePath !== worktree.relativePath ||
      record.lastResult?.branch !== worktree.branch
    )
      return observed(null);
    return observed(
      Object.freeze({
        ownerRepositoryRoot,
        workspaceId,
        executionTree: path.join(ownerRepositoryRoot, worktree.relativePath),
        baseCommit: record.baseCommit,
        worktree,
      }),
    );
  } catch {
    return {
      status: "blocked" as const,
      reason: "coordinator_workspace_target_observation_unconfirmed",
      manualRecoveryRequired: true,
      recoveryId: null,
      value: null,
    };
  }
}

/**
 * 単体接続を起動時のRepositoryと現在のManifestへ結合する。
 * @responsibility 指定IDが起動対象と一致し、処置前後に同じ実体を認識できる場合だけ許可する。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @boundary 単体の起動構成とCoordinatorのWorkspace操作。
 */
export function resolveLocalWorkspaceAccess(
  repositoryRoot: string,
  repositoryId: string,
  signal: AbortSignal,
) {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed") return null;
  const initial = readRepositoryManifest(repositoryRoot);
  if (
    initial.status !== "ready" ||
    initial.manifest.repositoryId !== repositoryId
  )
    return null;
  return {
    ownerRoot: repositoryRoot,
    projectId: initial.manifest.projectId,
    authorize: () => {
      if (
        signal.aborted ||
        resolveVerifiedRepositoryRoot(verified.capability) !== repositoryRoot
      )
        return false;
      const fresh = readRepositoryManifest(repositoryRoot);
      return fresh.status === "ready" && fresh.identity === initial.identity;
    },
  };
}

/**
 * 内部Workspace記録を必要最小限の現在投影へ変換する。
 * @responsibility 候補の同一性・元失敗・清掃失敗を保持する。
 * @trace ARCH-000004
 * @input 所属確認済み記録。
 * @returns Root・内部一時物を持たない投影。
 * @precondition 現在認可済み。
 * @postcondition 保存記録をそのまま公開しない。
 * @effect N/A: 値投影。
 * @failure N/A: 型検査済み入力。
 * @invariant 未実施・不明を成功にしない。
 * @boundary Coordinator→Surface。
 * @security 本文・資格を複製しない。
 * @concurrency 取得した一Snapshotだけを投影する。
 */
function workspaceView(record: WorkspaceRecord): WorkspaceView {
  const c = record.candidate;
  return {
    workspaceId: record.workspaceId,
    name: record.name,
    generation: record.generation,
    baseCommit: record.baseCommit,
    head: record.head,
    phase: record.phase,
    holdUntil: record.holdUntil,
    primaryFailure: record.primaryFailure,
    candidate:
      c === null
        ? null
        : {
            operationId: c.request.operationId,
            name: c.request.candidateName,
            workspaceName: c.request.workspaceName,
            phase: c.phase,
            baseCommit: c.request.baseCommit,
            candidateCommit: c.candidateCommit,
            mergeCommit: c.mergeCommit,
            target: c.target,
            disposition: c.disposition,
            selection: c.request.selection,
            relatedChangeIds: c.request.relatedChangeIds,
            primaryFailure: c.primaryFailure,
            cleanupFailure: c.cleanupFailure,
            lastResult:
              c.lastResult === null
                ? null
                : {
                    status: c.lastResult.status,
                    reason: c.lastResult.reason,
                    effectIssued: c.lastResult.effectIssued,
                    cleanupConfirmed: c.lastResult.cleanupConfirmed,
                  },
          },
  };
}

/**
 * 公開現在投影の型を共有する。
 * @responsibility Browserに内部保存型を流用させない。
 * @trace ARCH-000004
 * @shape workspaceViewが選択した非秘密fieldだけ。
 * @invariant 型だけを認可へ使わない。
 * @boundary 公開投影の利用側。
 * @security 内部一時物とRootを含まない。
 * @compatibility 投影の変更時に両Surfaceを確認する。
 */
export interface WorkspaceView
  extends Pick<
    WorkspaceRecord,
    | "workspaceId"
    | "name"
    | "generation"
    | "baseCommit"
    | "head"
    | "phase"
    | "holdUntil"
    | "primaryFailure"
  > {
  readonly candidate: WorkspaceCandidateView | null;
}

type WorkspaceCandidate = NonNullable<WorkspaceRecord["candidate"]>;

interface WorkspaceCandidateView
  extends Pick<
    WorkspaceCandidate,
    | "phase"
    | "candidateCommit"
    | "mergeCommit"
    | "target"
    | "disposition"
    | "primaryFailure"
    | "cleanupFailure"
  > {
  readonly operationId: WorkspaceCandidate["request"]["operationId"];
  readonly name: WorkspaceCandidate["request"]["candidateName"];
  readonly workspaceName: WorkspaceCandidate["request"]["workspaceName"];
  readonly baseCommit: WorkspaceCandidate["request"]["baseCommit"];
  readonly selection: WorkspaceCandidate["request"]["selection"];
  readonly relatedChangeIds: WorkspaceCandidate["request"]["relatedChangeIds"];
  readonly lastResult: Pick<
    NonNullable<WorkspaceCandidate["lastResult"]>,
    "status" | "reason" | "effectIssued" | "cleanupConfirmed"
  > | null;
}

/**
 * 公開する文字列をJSON化前に既存の秘密判定へ渡す。
 * @responsibility raw本文と差分の削除行も同じ出力境界で検査する。
 * @trace ARCH-000004
 * @input Ownerが構築した投影。未検証外部objectは受けない。
 * @returns 既知秘密を含む場合true。
 * @precondition 閉入力又は内部のplain投影。
 * @postcondition 表示本文を編集・redactしない。
 * @effect N/A: 値検査のみ。
 * @failure 検出時は呼出し元が固定拒否へ閉じる。
 * @invariant 検査成功は未知秘密不存在の保証ではない。
 * @boundary 公開前のCoordinator投影。
 * @security patchは元値とhunkの検査用本文を両方確認する。
 * @concurrency N/A: 局所値のみ。
 */
function containsWorkspaceOutputSecret(value: unknown): boolean {
  if (typeof value === "string") return containsRecognizedSecretText(value);
  if (Array.isArray(value)) return value.some(containsWorkspaceOutputSecret);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => {
    if (containsWorkspaceOutputSecret(item)) return true;
    if (key !== "patch" || typeof item !== "string") return false;
    let inHunk = false;
    const lines: string[] = [];
    for (const line of item.split(/\r?\n/u)) {
      if (line.startsWith("diff --git ")) inHunk = false;
      else if (line.startsWith("@@ ")) inHunk = true;
      else if (inHunk && /^[ +-]/u.test(line)) lines.push(line.slice(1));
    }
    return containsRecognizedSecretText(lines.join("\n"));
  });
}

/**
 * 公開操作を検証済み固定Ownerへ一回配送する。
 * @responsibility 所属・世代・現在認可と既存Lease／Writerを接続する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @input Server解決Root・Project、閉入力、現在認可callback、Signal。
 * @returns 検証した現在投影と技術処置結果。
 * @precondition Root／Project／callbackは外部JSONでなくServer構成が所有。
 * @postcondition 返却直前の現在許可不成立では公開しない。
 * @effect 読取り又は明示された既存Git／Snapshot操作。
 * @failure 不明・不一致は固定理由で停止。発行後取消はrollbackしない。
 * @invariant 新State・Lock・自動再送なし。
 * @boundary Surface→Coordinator→VC。
 * @security 保存BindingとHost Pathを返さない。
 * @concurrency 同期Ownerの終了を待ち、操作内でも現在許可を再検査する。
 */
export function executeWorkspace(
  ownerRoot: string,
  projectId: string,
  raw: unknown,
  authorize: () => boolean,
  signal: AbortSignal = new AbortController().signal,
) {
  const command = inspectWorkspaceCommand(raw);
  if (!command || command.projectId !== projectId)
    throw new Error("workspace_input_invalid");
  if (containsWorkspaceOutputSecret(command))
    throw new Error("workspace_input_invalid");
  const allowed = () => !signal.aborted && authorize();
  if (!allowed()) throw new Error("workspace_access_unavailable");
  const readsContent =
    command.operation === "get" ||
    command.operation === "inspect" ||
    command.operation === "candidate-diff";
  const contentRepository = readsContent
    ? getRepository(ownerRoot, "placement")
    : null;
  const directory =
    contentRepository === null
      ? readRepositoryLocation(ownerRoot)?.directory
      : contentRepository.status === "completed"
        ? contentRepository.placement.directory
        : null;
  if (directory !== ownerRoot) throw new Error("workspace_access_unavailable");
  const binding = deriveCoordinatorRepositoryBindingId(ownerRoot);
  const snapshot = readWorkspaceState({ directory: ownerRoot }, binding);
  if (snapshot.status !== "completed" || !snapshot.value)
    throw new Error("workspace_state_unavailable");
  const current = snapshot.value;
  const queues = current.queueEntries
    .filter((q) => q.projectId === projectId)
    .sort((a, b) =>
      a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0,
    );
  const record =
    command.operation === "list"
      ? null
      : (current.workspaces.find(
          (w) => w.workspaceId === command.workspaceId,
        ) ?? null);
  const queue =
    command.operation === "list"
      ? null
      : queues.find((q) => q.queueId === command.queueId);
  if (command.operation !== "list") {
    if (
      !queue ||
      (command.operation !== "create" && !record) ||
      (record && !queues.some((q) => q.workspaceId === record.workspaceId)) ||
      (command.operation !== "create" &&
        command.operation !== "select" &&
        queue.workspaceId !== command.workspaceId)
    )
      throw new Error("workspace_target_unavailable");
  }
  let data: unknown;
  if (command.operation === "list") {
    let after = "";
    if (command.cursor !== null) {
      let cursor: unknown;
      try {
        cursor = JSON.parse(
          Buffer.from(command.cursor, "base64url").toString("utf8"),
        );
      } catch {
        throw new Error("workspace_cursor_invalid");
      }
      if (
        !Array.isArray(cursor) ||
        cursor.length !== 3 ||
        cursor[0] !== projectId ||
        cursor[1] !== current.snapshotRevision ||
        !validIdentity(cursor[2])
      )
        throw new Error("workspace_cursor_stale");
      after = cursor[2];
    }
    const remaining = queues.filter((q) => q.queueId > after);
    const page = remaining.slice(0, command.limit);
    data = {
      entries: page.map((q) => ({
        queueId: q.queueId,
        state: q.state,
        workspace: q.workspaceId
          ? workspaceView(
              current.workspaces.find(
                (w) => w.workspaceId === q.workspaceId,
              ) as WorkspaceRecord,
            )
          : null,
      })),
      nextCursor:
        remaining.length > page.length
          ? Buffer.from(
              JSON.stringify([
                projectId,
                current.snapshotRevision,
                page.at(-1)?.queueId,
              ]),
            ).toString("base64url")
          : null,
    };
  } else if (
    command.operation === "get" ||
    command.operation === "inspect" ||
    command.operation === "candidate-diff"
  ) {
    if (!record) throw new Error("workspace_target_unavailable");
    if (contentRepository?.status !== "completed")
      throw new Error("workspace_access_unavailable");
    if (command.operation === "candidate-diff") {
      if (!record.candidate?.candidateCommit)
        throw new Error("workspace_target_unavailable");
      data = readWorkspaceCandidatePatch(
        contentRepository.capability,
        record.candidate.request,
        record.candidate.candidateCommit,
        command.path,
      );
      if (containsWorkspaceOutputSecret(data))
        throw new Error("workspace_content_unavailable");
      if (!allowed()) throw new Error("workspace_result_unavailable");
      return {
        contract: "crdd-server/workspace-surface/v1" as const,
        projectId,
        operation: command.operation,
        data,
      };
    }
    if (record.phase !== "ready")
      throw new Error("workspace_target_unavailable");
    if (command.operation === "inspect") {
      if (record.head === null) throw new Error("workspace_target_unavailable");
      try {
        data = readFile(contentRepository.capability, {
          baseCommit: record.baseCommit,
          path: command.path,
          worktree: {
            ...workspaceWorktreeTarget(record.workspaceId),
            expectedHead: record.head,
          },
        });
      } catch (error) {
        if (
          error instanceof Error &&
          /^(repository_file_worktree_mismatch|worktree_(target_mismatch|repository_invalid|owner_invalid|path_invalid|branch_in_use|branch_not_direct|ref_unavailable))$/u.test(
            error.message,
          )
        )
          throw new Error("workspace_target_unavailable");
        throw error;
      }
    } else {
      const observed = getWorktree(
        contentRepository.capability,
        workspaceWorktreeTarget(record.workspaceId),
        "target",
      );
      if (
        observed.status !== "completed" ||
        observed.relativePath === null ||
        observed.observation?.head !== record.head
      )
        throw new Error("workspace_target_unavailable");
      const target = getRepository(path.join(ownerRoot, observed.relativePath));
      if (target.status !== "completed")
        throw new Error("workspace_target_unavailable");
      data = {
        workspace: workspaceView(record),
        changedPaths: readWorkingChanges(target.capability, record.baseCommit)
          .changedPaths,
      };
    }
  } else {
    const { operation, ...input } = command;
    const result = manageWorkspace({
      ...input,
      operation,
      ...(operation === "create" && command.name === null
        ? { name: undefined }
        : {}),
      ...(operation === "close-candidate"
        ? {
            referencesReleased:
              record?.holdUntil === null &&
              !current.queueEntries.some(
                (q) =>
                  q.workspaceId === command.workspaceId &&
                  q.queueId !== command.queueId &&
                  !["completed", "cancelled"].includes(q.state),
              ),
          }
        : {}),
      ownerRepositoryRoot: ownerRoot,
      repositoryBindingId: binding,
      authorize: allowed,
    } as Parameters<typeof manageWorkspace>[0]);
    data = {
      status: result.status,
      reason: result.reason,
      workspace:
        result.workspace === null ? null : workspaceView(result.workspace),
      gitEffectIssued:
        result.candidateResult?.effectIssued ??
        result.gitResult?.effectIssued ??
        false,
      cleanupConfirmed: result.candidateResult?.cleanupConfirmed ?? null,
      manualRecoveryRequired: result.manualRecoveryRequired,
      recoveryId: result.recoveryId,
      releaseFailure: result.releaseFailure,
      releaseRecoveryId: result.releaseRecoveryId,
    };
  }
  if (!allowed()) throw new Error("workspace_result_unavailable");
  if (containsWorkspaceOutputSecret(data))
    throw new Error("workspace_content_unavailable");
  return {
    contract: "crdd-server/workspace-surface/v1" as const,
    projectId,
    operation: command.operation,
    data,
  };
}

/**
 * 公開入力の閉じた操作集合。
 * @responsibility 読取り・固定・採用・終了を別要求にする。
 * @trace ARCH-000004
 * @shape Project／Queue／Workspace IDと確認済み操作値。
 * @invariant Root・Binding・認可関数を含めない。
 * @boundary JSON入力。
 * @security 参照解放の自己申告を受けない。
 * @compatibility 新Workspace専用、旧Bundleの採用契約とは別。
 */
export type WorkspaceCommand =
  | Readonly<{
      operation: "list";
      projectId: string;
      cursor: string | null;
      limit: number;
    }>
  | (Readonly<{ projectId: string; queueId: string; workspaceId: string }> &
      (
        | { operation: "get" }
        | { operation: "inspect"; path: string }
        | { operation: "candidate-diff"; path: string }
        | (Readonly<{ expectedGeneration: number }> &
            (
              | {
                  operation: "create";
                  baseBranch: string;
                  baseCommit: string;
                  name: string | null;
                  acceptUncommittedChangesExcluded?: boolean;
                }
              | { operation: "select" }
              | { operation: "rename"; name: string | null }
              | { operation: "hold"; until: string | null }
              | {
                  operation: "discard";
                  expectedHead: string;
                  discardChanges: boolean;
                }
              | {
                  operation: "freeze";
                  operationId: string;
                  baseCommit: string;
                  expectedHead: string;
                  selection: readonly CommitSelection[];
                  candidateName: string | null;
                  relatedChangeIds: readonly string[];
                }
              | {
                  operation: "adopt";
                  candidateCommit: string;
                  targetBranch: string;
                  expectedTargetHead: string;
                }
              | {
                  operation: "close-candidate";
                  expectedCommit: string | null;
                  disposition: "adopted" | "rejected";
                }
            ))
      ));

/**
 * 公開入力の既存安定ID形式を検査する。
 * @responsibility Project・Queue IDの字句境界だけを扱う。
 * @trace ARCH-000004
 * @input 未検証値。
 * @returns 安定ID形式か。
 * @precondition N/A: 未検証値。
 * @postcondition 所属・認可は別に検査する。
 * @effect N/A: 純粋値検査。
 * @failure 不正はfalse。
 * @invariant ID形式はAuthorityではない。
 * @boundary 公開入力。
 * @security Pathを解決しない。
 * @concurrency N/A: 状態なし。
 */
const isStableId = (value: unknown): value is string =>
  typeof value === "string" && RESOURCE_ID.test(value);

/**
 * WorkspaceのUUID形式を検査する。
 * @responsibility 任意PathをWorkspace IDとして受けない。
 * @trace ARCH-000004
 * @input 未検証値。
 * @returns UUID形式か。
 * @precondition N/A: 未検証値。
 * @postcondition 存在は別に観測する。
 * @effect N/A: 純粋値検査。
 * @failure 不正はfalse。
 * @invariant UUID形式は所有根拠ではない。
 * @boundary 公開入力。
 * @security IDから任意Rootを受理しない。
 * @concurrency N/A: 状態なし。
 */
const isWorkspaceId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/**
 * 対応するGit Object IDの字句形式を検査する。
 * @responsibility Ref名と固定Object IDを混同しない。
 * @trace ARCH-000009
 * @input 未検証値。
 * @returns SHA-1又はSHA-256のGit Object ID形式か。
 * @precondition N/A: 未検証値。
 * @postcondition Object実在はVCが観測する。
 * @effect N/A: 純粋値検査。
 * @failure 不正はfalse。
 * @invariant 形式だけで固定内容を保証しない。
 * @boundary 公開入力。
 * @security Git命令を発行しない。
 * @concurrency N/A: 状態なし。
 */
const isGitObjectId = (value: unknown): value is string =>
  typeof value === "string" && GIT_OBJECT_ID.test(value);

/** コマンドの表示名を検査する。保存値の成立はEMのWriterが別に確認する。 */
const validDisplayName = (value: unknown): value is string | null =>
  value === null ||
  (typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value));

/** コマンドが指定する相対File Pathを検査し、仮のCandidateを組み立てない。 */
const validFilePath = (value: unknown): value is string =>
  typeof value === "string" &&
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
    );

const fields: Readonly<Record<string, readonly string[]>> = {
  get: [],
  inspect: ["path"],
  "candidate-diff": ["path"],
  create: ["baseBranch", "baseCommit", "name"],
  select: [],
  rename: ["name"],
  hold: ["until"],
  discard: ["expectedHead", "discardChanges"],
  freeze: [
    "operationId",
    "baseCommit",
    "expectedHead",
    "selection",
    "candidateName",
    "relatedChangeIds",
  ],
  adopt: ["candidateCommit", "targetBranch", "expectedTargetHead"],
  "close-candidate": ["expectedCommit", "disposition"],
};

/**
 * 公開操作を認可・Root観測より前に閉検査する。
 * @responsibility 未知field、callback、Host指定と不正選択を拒否する。
 * @trace ARCH-000004
 * @input 未検証JSON値。
 * @returns 閉じた操作又はnull。
 * @precondition N/A: 未検証入力を受ける。
 * @postcondition 形式成立を認可へ変換しない。
 * @effect N/A: 値検査。
 * @failure 不正値はnull。
 * @invariant 固定と採用を一要求にしない。
 * @boundary 公開JSON。
 * @security Proxy・Accessorを実行しない。
 * @concurrency N/A: 局所値のみ。
 */
export function inspectWorkspaceCommand(
  value: unknown,
): WorkspaceCommand | null {
  if (!value || typeof value !== "object" || types.isProxy(value)) return null;
  const operation = Object.getOwnPropertyDescriptor(value, "operation")?.value;
  if (operation === "list") {
    const r = snapshotPlainRecord(
      value,
      new Set(["operation", "projectId", "cursor", "limit"]),
    );
    return r &&
      isStableId(r.projectId) &&
      (r.cursor === null ||
        (typeof r.cursor === "string" && r.cursor.length <= 1024)) &&
      Number.isSafeInteger(r.limit) &&
      Number(r.limit) >= 1 &&
      Number(r.limit) <= 50
      ? (r as WorkspaceCommand)
      : null;
  }
  if (typeof operation !== "string" || !Object.hasOwn(fields, operation))
    return null;
  const read =
    operation === "get" ||
    operation === "inspect" ||
    operation === "candidate-diff";
  const r = snapshotPlainRecord(
    value,
    new Set([
      "operation",
      "projectId",
      "queueId",
      "workspaceId",
      ...(!read ? ["expectedGeneration"] : []),
      ...(fields[operation] ?? []),
      ...(operation === "create" &&
      Object.hasOwn(value, "acceptUncommittedChangesExcluded")
        ? ["acceptUncommittedChangesExcluded"]
        : []),
    ]),
  );
  if (
    !r ||
    !isStableId(r.projectId) ||
    !isStableId(r.queueId) ||
    !isWorkspaceId(r.workspaceId) ||
    (!read &&
      (!Number.isSafeInteger(r.expectedGeneration) ||
        Number(r.expectedGeneration) < 0))
  )
    return null;
  if (
    (operation === "rename" || operation === "create") &&
    !validDisplayName(r.name)
  )
    return null;
  if (
    operation === "create" &&
    (!isGitObjectId(r.baseCommit) ||
      typeof r.baseBranch !== "string" ||
      !r.baseBranch ||
      /[\u0000-\u0020\u007f]/u.test(r.baseBranch) ||
      (Object.hasOwn(r, "acceptUncommittedChangesExcluded") &&
        typeof r.acceptUncommittedChangesExcluded !== "boolean") ||
      r.expectedGeneration !== 0)
  )
    return null;
  if (
    operation === "hold" &&
    !(
      r.until === null ||
      (typeof r.until === "string" && Number.isFinite(Date.parse(r.until)))
    )
  )
    return null;
  if (
    operation === "discard" &&
    (!isGitObjectId(r.expectedHead) || typeof r.discardChanges !== "boolean")
  )
    return null;
  if (
    operation === "adopt" &&
    (!isGitObjectId(r.candidateCommit) ||
      !isGitObjectId(r.expectedTargetHead) ||
      typeof r.targetBranch !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(r.targetBranch))
  )
    return null;
  if (
    operation === "close-candidate" &&
    (!(r.expectedCommit === null || isGitObjectId(r.expectedCommit)) ||
      typeof r.disposition !== "string" ||
      !["adopted", "rejected"].includes(r.disposition))
  )
    return null;
  if (operation === "freeze") {
    const selection = snapshotPlainArray(r.selection, Number.MAX_SAFE_INTEGER);
    const changes = snapshotPlainArray(
      r.relatedChangeIds,
      Number.MAX_SAFE_INTEGER,
    );
    if (selection.status !== "ok" || changes.status !== "ok") return null;
    const items = selection.value.map((item) =>
      snapshotPlainRecord(item, new Set(["path", "blobId", "mode"])),
    );
    if (items.some((item) => item === null)) return null;
    const safe = { ...r, selection: items, relatedChangeIds: changes.value };
    if (
      !isWorkspaceId(r.operationId) ||
      !isGitObjectId(r.baseCommit) ||
      !isGitObjectId(r.expectedHead) ||
      r.baseCommit.length !== r.expectedHead.length ||
      !validDisplayName(r.candidateName) ||
      changes.value.some(
        (id) => typeof id !== "string" || !/^CHG-\d{6}$/u.test(id),
      ) ||
      new Set(changes.value).size !== changes.value.length ||
      items.length === 0
    )
      return null;
    const paths = new Set<string>();
    for (const item of items) {
      if (
        !item ||
        !validFilePath(item.path) ||
        !(
          (item.blobId === null && item.mode === null) ||
          (isGitObjectId(item.blobId) &&
            item.blobId.length === r.baseCommit.length &&
            typeof item.mode === "string" &&
            ["100644", "100755"].includes(item.mode))
        )
      )
        return null;
      const key = item.path.toLowerCase();
      if (paths.has(key)) return null;
      paths.add(key);
    }
    return safe as unknown as WorkspaceCommand;
  }
  if (
    (operation === "inspect" || operation === "candidate-diff") &&
    !validFilePath(r.path)
  )
    return null;
  return r as WorkspaceCommand;
}

/**
 * 既存Queueに結合したWorkspace操作入力。
 * @responsibility 任意Pathと暗黙作成を受け付けない。
 * @trace ARCH-000004
 * @shape 所属Root・Repository／Project／Queue・UUIDと明示操作。
 * @invariant 採用済みという申告だけでは削除しない。
 * @boundary 内部Package API。Surfaceの認可は呼出し元。
 * @security Root文字列は検証後にだけ使用する。
 * @compatibility 新しい独立Serverや入口は追加しない。
 */
export type WorkspaceManagementRequest = Readonly<{
  ownerRepositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  workspaceId: string;
  expectedGeneration?: number;
  authorize?: () => boolean;
}> &
  (
    | {
        operation: "create";
        baseBranch: string;
        baseCommit: string;
        name?: string;
        acceptUncommittedChangesExcluded?: boolean;
      }
    | { operation: "rename"; name: string | null }
    | {
        operation: "freeze";
        operationId: string;
        baseCommit: string;
        expectedHead: string;
        selection: readonly CommitSelection[];
        candidateName: string | null;
        relatedChangeIds: readonly string[];
        authorize: () => boolean;
      }
    | {
        operation: "adopt";
        candidateCommit: string;
        targetBranch: string;
        expectedTargetHead: string;
        authorize: () => boolean;
      }
    | {
        operation: "close-candidate";
        expectedCommit: string | null;
        disposition: "adopted" | "rejected";
        referencesReleased: boolean;
        authorize: () => boolean;
      }
    | { operation: "observe" | "select" }
    | { operation: "discard"; expectedHead: string; discardChanges?: boolean }
    | { operation: "hold"; until: string | null }
    | { operation: "adopted" }
  );

/**
 * 同じSnapshotと既存操作Leaseを用いてWorkspaceを処置する。
 * @responsibility Git結果と保存結果を分離し、同IDの再入場情報を返す。
 * @trace ARCH-000004
 * @input request: 実在するProject／Queueの明示操作。
 * @returns 一次理由、現在値、Git段階とLease解放結果。
 * @precondition 上位が認可・破棄の決定権限を確認する。
 * @postcondition 未確定保存を成功にせず、Task終端だけでは削除しない。
 * @effect 既存stateと専用Worktree／Refの更新。
 * @failure 採用証拠未接続・使用中・保留・不明は停止。
 * @invariant 新Lock／台帳なし、Git中は短期Snapshot排他を解放する。
 * @boundary Coordinator→VC公開APIと既存Writer。
 * @security Directの通常Treeを削除しない。
 * @concurrency 既存binding-wide操作Leaseを維持する。
 */
export function manageWorkspace(request: WorkspaceManagementRequest) {
  const result = {
    status: "blocked" as "completed" | "blocked",
    reason: "coordinator_workspace_input_invalid",
    workspaceId: request.workspaceId,
    workspace: null as WorkspaceRecord | null,
    gitResult: null as RepositoryWorktreeResult | null,
    candidateResult: null as WorkspaceCandidateResult | null,
    leaseReleased: null as boolean | null,
    manualRecoveryRequired: false,
    recoveryId: null as string | null,
    releaseFailure: null as string | null,
    releaseRecoveryId: null as string | null,
  };
  if (request.operation === "adopted")
    return {
      ...result,
      reason: "coordinator_workspace_adoption_not_connected",
    };
  if (request.operation === "rename" || request.operation === "hold") {
    const location = readRepositoryLocation(request.ownerRepositoryRoot);
    if (!location || location.linked) return result;
    try {
      if (request.authorize && !request.authorize())
        return { ...result, reason: "coordinator_candidate_not_authorized" };
      const saved = updateWorkspaceMetadata(
        { directory: location.directory },
        request.repositoryBindingId,
        request.projectId,
        request.queueId,
        request.workspaceId,
        request.expectedGeneration,
        request.operation === "rename"
          ? { kind: "rename", value: request.name }
          : { kind: "hold", value: request.until },
      );
      return saved.status === "completed"
        ? {
            ...result,
            status: "completed" as const,
            reason: "coordinator_workspace_operation_completed",
            workspace: saved.value,
          }
        : {
            ...result,
            reason: saved.reason,
            manualRecoveryRequired: saved.manualRecoveryRequired,
            recoveryId: saved.recoveryId,
          };
    } catch {
      return {
        ...result,
        reason: "coordinator_workspace_operation_unconfirmed",
      };
    }
  }
  const verified = getRepository(request.ownerRepositoryRoot, "placement");
  if (verified.status !== "completed" || verified.placement.linked)
    return result;
  // Gitの操作はVCで確認する。EMへ渡す保存先はこの操作の受付で確定する。
  const storage = { directory: verified.placement.directory };
  // GitをまたぐWorkspace操作は短期排他内でStateを読み、共通の操作Lockを取る。
  const lease = beginWorkspaceOperation(
    storage,
    request.repositoryBindingId,
    request.projectId,
    request.queueId,
    request.workspaceId,
    request.operation,
  );
  if (lease.status !== "completed")
    return {
      ...result,
      reason: lease.reason,
      manualRecoveryRequired: lease.manualRecoveryRequired,
      recoveryId: lease.recoveryId,
    };
  try {
    const worktreeChange = lease.value;
    let record = worktreeChange.record;
    if (
      request.expectedGeneration !== undefined &&
      request.expectedGeneration !== (worktreeChange.generation ?? 0)
    )
      throw new Error("coordinator_workspace_generation_conflict");
    if (request.authorize && !request.authorize())
      throw new Error("coordinator_candidate_not_authorized");
    const consumeSave = (saved: ReturnType<typeof worktreeChange.save>) => {
      if (saved.status !== "completed") {
        result.manualRecoveryRequired = saved.manualRecoveryRequired;
        result.recoveryId = saved.recoveryId;
        throw new Error(saved.reason);
      }
      record = saved.value;
      result.workspace = record;
    };
    const milestoneId = worktreeChange.milestoneId;
    const assertOperationHeld = () => {
      if (!worktreeChange.isHeld()) {
        result.manualRecoveryRequired = true;
        throw new Error("workspace_operation_lock_requires_manual_review");
      }
    };
    const save = (
      next: WorkspaceRecord | null,
      unissuedAdoption?: WorkspaceCandidateResult,
    ) => {
      consumeSave(
        worktreeChange.save(record?.generation ?? 0, next, unissuedAdoption),
      );
    };
    if (worktreeChange.generation !== null && !worktreeChange.linkedToProject)
      throw new Error("coordinator_workspace_target_mismatch");
    /**
     * Candidateの採否と固定Identityを既存の不変結果Portへ保存する。
     * @responsibility Ref回収より先に判断結果を確定する。
     * @trace ARCH-000004
     * @input candidate: 同じWorkspaceの確定した採否。
     * @returns N/A: 保存確定だけ正常終了。
     * @precondition Workspaceの操作Lockを保持。
     * @postcondition 同Identity・同内容だけ再送可能。
     * @effect 既存Snapshotの結果保存。
     * @failure 保存不明はRef回収前に停止。
     * @invariant Git成功を品質成立へ変換しない。
     * @boundary 既存結果Port。
     * @security 名前・結果をAuthorityにしない。
     * @concurrency 新しい排他を追加しない。
     */
    const recordDisposition = (
      candidate: NonNullable<WorkspaceRecord["candidate"]>,
    ) => {
      if (candidate.disposition === null)
        throw new Error("coordinator_candidate_disposition_invalid");
      assertOperationHeld();
      const recorded = saveIntegrationRecord(
        storage,
        request.repositoryBindingId,
        {
          repositoryBindingId: request.repositoryBindingId,
          projectId: request.projectId,
          queueId: request.queueId,
          milestoneId,
        },
        {
          kind: "adoption",
          identity: `workspace-candidate-${candidate.request.operationId}`,
          value: {
            recordKind: "workspace-candidate",
            request: candidate.request,
            candidateCommit: candidate.candidateCommit,
            target: candidate.target,
            mergeCommit: candidate.mergeCommit,
            disposition: candidate.disposition,
            primaryFailure: candidate.primaryFailure,
          },
        },
      );
      if (recorded.status !== "completed")
        throw new Error("coordinator_candidate_record_unconfirmed");
    };
    /**
     * 採否と分離したRef回収終端を既存結果Portへ確定する。
     * @responsibility 元採否の不変性と回収失敗の保持を両立する。
     * @trace ARCH-000004
     * @input candidate: 回収中の同候補。
     * @returns 保存確認時だけ正常終了。
     * @precondition 技術結果でRef・一時物の不存在を確認済み。
     * @postcondition 確定前にcandidateを消さない。
     * @effect 既存結果保存のみ。
     * @failure 保存不明は既存現在値を保持。
     * @invariant 同Identity・同本文だけ再送する。
     * @boundary 既存Snapshot。
     * @security 採用Authorityを新設しない。
     * @concurrency 既存操作Lease下。
     */
    const recordCandidateClosure = (
      candidate: NonNullable<WorkspaceRecord["candidate"]>,
    ) => {
      assertOperationHeld();
      const identity = `workspace-candidate-close-${candidate.request.operationId}`;
      const value = worktreeChange.closure?.value ?? {
        recordKind: "workspace-candidate-close",
        workspaceId: candidate.request.workspaceId,
        operationId: candidate.request.operationId,
        candidateCommit: candidate.candidateCommit,
        disposition: candidate.disposition,
        cleanupFailure: candidate.cleanupFailure,
        refAbsent: true,
      };
      const saved = saveIntegrationRecord(
        storage,
        request.repositoryBindingId,
        {
          repositoryBindingId: request.repositoryBindingId,
          projectId: request.projectId,
          queueId: request.queueId,
          milestoneId,
        },
        {
          kind: "adoption",
          identity,
          value,
        },
      );
      if (saved.status !== "completed")
        throw new Error("coordinator_candidate_closure_unconfirmed");
    };
    if (request.operation === "create") {
      if (worktreeChange.generation !== null)
        throw new Error("coordinator_workspace_already_recorded");
      if (request.authorize && !request.authorize())
        throw new Error("coordinator_candidate_not_authorized");
      const { dirty, observedBase } = readWorktreeCreationSource(
        verified.capability,
        request.baseBranch,
      );
      if (!observedBase || observedBase.commitId !== request.baseCommit)
        throw new Error("workspace_creation_branch_head_changed");
      if (request.authorize && !request.authorize())
        throw new Error("coordinator_candidate_not_authorized");
      if (dirty && request.acceptUncommittedChangesExcluded !== true)
        throw new Error("workspace_creation_confirmation_required");
      save({
        workspaceId: request.workspaceId,
        name: request.name ?? null,
        candidate: null,
        generation: 1,
        baseCommit: request.baseCommit,
        head: request.baseCommit,
        phase: "creating",
        holdUntil: null,
        pending: {
          operationId: randomUUID(),
          kind: "create",
          expectedHead: request.baseCommit,
          discardChanges: false,
        },
        lastResult: null,
        primaryFailure: null,
      });
      if (request.authorize && !request.authorize())
        throw new Error("coordinator_candidate_not_authorized");
      assertWorkspaceDirectoryAvailable(
        request.ownerRepositoryRoot,
        request.workspaceId,
      );
      if (!worktreeChange?.isHeld()) {
        result.manualRecoveryRequired = true;
        throw new Error("workspace_operation_lock_requires_manual_review");
      }
      result.gitResult = workspaceWorktreeResult(
        request.ownerRepositoryRoot,
        request.workspaceId,
        createWorktree(verified.capability, {
          ...workspaceWorktreeTarget(request.workspaceId),
          baseCommit: request.baseCommit,
          observedBase,
        }),
        false,
      );
    } else {
      if (!record) throw new Error("coordinator_workspace_not_found");
      if (["freeze", "adopt", "close-candidate"].includes(request.operation)) {
        if (record.phase !== "ready" || record.holdUntil !== null)
          throw new Error("coordinator_workspace_not_ready");
        let fixedBeforeAdoption: WorkspaceRecord["candidate"] = null;
        if (request.operation === "freeze") {
          const intent = {
            workspaceId: record.workspaceId,
            operationId: request.operationId,
            baseCommit: request.baseCommit,
            expectedWorkspaceHead: request.expectedHead,
            selection: request.selection,
            workspaceName: record.candidate
              ? record.candidate.request.workspaceName
              : record.name,
            candidateName: request.candidateName,
            relatedChangeIds: request.relatedChangeIds,
          };
          if (
            record.candidate &&
            (!["freezing", "fixed"].includes(record.candidate.phase) ||
              !isDeepStrictEqual(record.candidate.request, intent))
          )
            throw new Error("coordinator_candidate_pending");
          if (
            !inspectWorkspaceCommand({
              operation: "freeze",
              projectId: request.projectId,
              queueId: request.queueId,
              workspaceId: request.workspaceId,
              expectedGeneration: record.generation,
              operationId: request.operationId,
              baseCommit: request.baseCommit,
              expectedHead: request.expectedHead,
              selection: request.selection,
              candidateName: request.candidateName,
              relatedChangeIds: request.relatedChangeIds,
            })
          )
            throw new Error("coordinator_candidate_input_invalid");
          if (record.head !== request.expectedHead || !request.authorize())
            throw new Error("coordinator_candidate_not_authorized");
          for (const id of request.relatedChangeIds) {
            if (!/^CHG-\d{6}$/u.test(id))
              throw new Error("coordinator_candidate_change_invalid");
            const file = path.join(
              request.ownerRepositoryRoot,
              "99_Roadmap",
              "Changes",
              id,
              "change.md",
            );
            // 登録されたCHG参照だけを表示へ載せる。内容・採否は読み替えない。
            if (!existsSync(file) || lstatSync(file).isSymbolicLink())
              throw new Error("coordinator_candidate_change_not_found");
          }
          const previousCommit = record.candidate?.candidateCommit ?? null;
          const primaryFailure = record.candidate?.primaryFailure ?? null;
          const previousResult = record.candidate?.lastResult ?? null;
          save({
            ...record,
            generation: record.generation + 1,
            candidate: {
              request: intent,
              phase: "freezing",
              candidateCommit: previousCommit,
              target: null,
              mergeCommit: null,
              disposition: null,
              lastResult: previousResult,
              primaryFailure,
              cleanupFailure: null,
            },
          });
          if (!request.authorize())
            throw new Error("coordinator_candidate_not_authorized");
          const accepted = result.workspace?.candidate;
          if (!accepted) throw new Error("coordinator_candidate_input_invalid");
          assertOperationHeld();
          result.candidateResult = freezeWorkspaceCandidate(
            verified.capability,
            accepted.request,
            previousCommit,
            previousResult?.temporary ?? null,
          );
        } else if (request.operation === "adopt") {
          const c = record.candidate;
          if (
            !c ||
            !["fixed", "merging", "merged"].includes(c.phase) ||
            c.candidateCommit !== request.candidateCommit
          )
            throw new Error("coordinator_candidate_mismatch");
          const target = {
            targetBranch: request.targetBranch,
            expectedTargetHead: request.expectedTargetHead,
          };
          if (c.target && !isDeepStrictEqual(c.target, target))
            throw new Error("coordinator_candidate_target_mismatch");
          if (!request.authorize())
            throw new Error("coordinator_candidate_not_authorized");
          if (c.phase === "fixed") fixedBeforeAdoption = c;
          save({
            ...record,
            generation: record.generation + 1,
            candidate: { ...c, phase: "merging", target },
          });
          if (!request.authorize())
            throw new Error("coordinator_candidate_not_authorized");
          assertOperationHeld();
          result.candidateResult = mergeWorkspaceCandidate(
            verified.capability,
            c.request,
            { ...target, candidateCommit: request.candidateCommit },
          );
        } else if (request.operation === "close-candidate") {
          const c = record.candidate;
          if (
            !c ||
            c.candidateCommit !== request.expectedCommit ||
            !request.referencesReleased ||
            worktreeChange.otherQueuePending ||
            !request.authorize() ||
            (c.phase === "removing" && c.disposition !== request.disposition) ||
            (request.disposition === "adopted" &&
              c.disposition !== "adopted") ||
            (request.disposition === "rejected" &&
              !["freezing", "fixed", "removing"].includes(c.phase))
          )
            throw new Error("coordinator_candidate_removal_not_authorized");
          save({
            ...record,
            generation: record.generation + 1,
            candidate: {
              ...c,
              phase: "removing",
              disposition: request.disposition,
            },
          });
          recordDisposition({ ...c, disposition: request.disposition });
          if (!request.authorize())
            throw new Error("coordinator_candidate_not_authorized");
          assertOperationHeld();
          result.candidateResult = removeWorkspaceCandidate(
            verified.capability,
            c.request,
            request.expectedCommit,
            c.lastResult?.temporary ?? null,
          );
        }
        if (result.candidateResult && record?.candidate) {
          const technical = result.candidateResult;
          const c = record.candidate;
          if (
            fixedBeforeAdoption !== null &&
            technical.status === "blocked" &&
            technical.reason === "commit_merge_target_changed" &&
            !technical.effectIssued
          ) {
            save(
              {
                ...record,
                generation: record.generation + 1,
                candidate: fixedBeforeAdoption,
              },
              technical,
            );
            throw new Error(technical.reason);
          }
          const completed =
            technical.status === "completed" && technical.cleanupConfirmed;
          if (completed && request.operation === "adopt")
            recordDisposition({
              ...c,
              mergeCommit: technical.mergeCommit ?? c.mergeCommit,
              disposition: "adopted",
            });
          if (completed && request.operation === "close-candidate")
            recordCandidateClosure(c);
          save({
            ...record,
            generation: record.generation + 1,
            candidate:
              completed && request.operation === "close-candidate"
                ? null
                : {
                    ...c,
                    phase: completed
                      ? request.operation === "freeze"
                        ? "fixed"
                        : request.operation === "adopt"
                          ? "merged"
                          : c.phase
                      : c.phase,
                    candidateCommit:
                      technical.candidateCommit ?? c.candidateCommit,
                    mergeCommit: technical.mergeCommit ?? c.mergeCommit,
                    disposition:
                      completed && request.operation === "adopt"
                        ? "adopted"
                        : c.disposition,
                    lastResult: technical,
                    primaryFailure:
                      c.primaryFailure ??
                      (technical.status === "blocked" &&
                      request.operation !== "close-candidate"
                        ? technical.reason
                        : null),
                    cleanupFailure:
                      c.cleanupFailure ??
                      (technical.status === "blocked" &&
                      request.operation === "close-candidate"
                        ? technical.reason
                        : null),
                  },
          });
          if (!completed) throw new Error(technical.reason);
        }
      } else if (request.operation === "discard") {
        if (record.candidate)
          throw new Error("coordinator_candidate_still_referenced");
        if (record.holdUntil !== null)
          throw new Error("coordinator_workspace_held");
        if (
          record.head !== request.expectedHead ||
          (record.pending?.kind === "discard" &&
            record.pending.discardChanges !== (request.discardChanges === true))
        )
          throw new Error("coordinator_workspace_discard_mismatch");
        save({
          ...record,
          generation: record.generation + 1,
          phase: "discarding",
          pending:
            record.pending?.kind === "discard"
              ? record.pending
              : {
                  operationId: randomUUID(),
                  kind: "discard",
                  expectedHead: request.expectedHead,
                  discardChanges: request.discardChanges === true,
                },
        });
        if (request.authorize && !request.authorize())
          throw new Error("coordinator_candidate_not_authorized");
        if (!worktreeChange?.isHeld()) {
          result.manualRecoveryRequired = true;
          throw new Error("workspace_operation_lock_requires_manual_review");
        }
        result.gitResult = workspaceWorktreeResult(
          request.ownerRepositoryRoot,
          request.workspaceId,
          removeWorktree(verified.capability, {
            ...workspaceWorktreeTarget(request.workspaceId),
            expectedHead: request.expectedHead,
            discardChanges: request.discardChanges === true,
          }),
          true,
        );
      } else {
        if (!worktreeChange?.isHeld()) {
          result.manualRecoveryRequired = true;
          throw new Error("workspace_operation_lock_requires_manual_review");
        }
        result.gitResult = workspaceWorktreeResult(
          request.ownerRepositoryRoot,
          request.workspaceId,
          getWorktree(
            verified.capability,
            workspaceWorktreeTarget(request.workspaceId),
          ),
        );
      }
    }
    if (result.gitResult && record) {
      const gitResult = result.gitResult;
      consumeSave(worktreeChange.saveObservation(record.generation, gitResult));
      if (request.operation === "discard" && gitResult.status === "completed") {
        if (gitResult.workspaceDirectoryRetained)
          throw new Error("coordinator_workspace_materials_retained");
        save(null);
      }
      if (gitResult.status !== "completed") throw new Error(gitResult.reason);
      if (record?.phase === "creating")
        throw new Error("coordinator_workspace_creation_unconfirmed");
    }
    result.status = "completed";
    result.reason = "coordinator_workspace_operation_completed";
    result.workspace = record;
  } catch (error) {
    result.reason =
      error instanceof Error && /^[a-z_]+$/u.test(error.message)
        ? error.message
        : "coordinator_workspace_operation_unconfirmed";
    // 返却値が未確定でも、保存された同UUIDの意図は消さない。
  } finally {
    try {
      const released = lease.value.release();
      result.leaseReleased = released.status === "completed";
      if (released.status !== "completed") {
        if (result.status === "completed") result.reason = released.reason;
        result.releaseFailure = released.reason;
        result.releaseRecoveryId = released.recoveryId;
        result.manualRecoveryRequired ||= released.manualRecoveryRequired;
        result.recoveryId ??= released.recoveryId;
        result.status = "blocked";
      }
    } catch {
      if (result.status === "completed")
        result.reason = "coordinator_workspace_lease_release_unconfirmed";
      result.releaseFailure = "coordinator_workspace_lease_release_unconfirmed";
      result.leaseReleased = false;
      result.manualRecoveryRequired = true;
      result.status = "blocked";
    }
  }
  return result;
}

/** 検証したWorkspace UUIDから上位所有の配置とBranchを導く。Git操作は行わない。 */
export function workspaceWorktreeTarget(workspaceId: string): WorktreeTarget {
  if (!UUID.test(workspaceId)) throw new Error("worktree_id_invalid");
  return {
    relativePath: `.crdd/workspaces/${workspaceId}/worktree`,
    branch: `crdd/workspace/${workspaceId}`,
  };
}

/** exactなRepositoryの名前付き領域から既存Workspace親を得る。作成はしない。 */
function workspaceDirectory(root: string, workspaceId: string): string {
  workspaceWorktreeTarget(workspaceId);
  const repository = getRepository(root);
  const paths =
    repository.status === "completed"
      ? resolveRepositoryExecutionDataPaths(repository.capability)
      : null;
  if (paths === null) throw Error("workspace_directory_boundary_invalid");
  return path.join(paths.workspaces, workspaceId);
}

/** 新しいWorkspaceが既存の専用親を引き継がないことを上位で保証する。 */
export function assertWorkspaceDirectoryAvailable(
  root: string,
  workspaceId: string,
): void {
  try {
    fs.lstatSync(workspaceDirectory(root, workspaceId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("worktree_target_exists");
}

/** 既存保存形状へ投影する。廃棄成功時だけ既知のWorkspace親を再照合する。 */
export function workspaceWorktreeResult(
  root: string,
  workspaceId: string,
  value: WorktreeResult,
  removeParent = false,
): RepositoryWorktreeResult {
  let retained = value.parentDirectoryRetained;
  let reason = value.reason;
  let status = value.status;
  if (
    removeParent &&
    status === "completed" &&
    value.worktreeRemoved &&
    value.branchRemoved
  ) {
    const expected = workspaceWorktreeTarget(workspaceId);
    try {
      const parent = workspaceDirectory(root, workspaceId);
      if (
        value.relativePath !== expected.relativePath ||
        value.branch !== expected.branch
      )
        throw new Error();
      let cursor = root;
      for (const segment of path.relative(root, parent).split(path.sep)) {
        cursor = path.join(cursor, segment);
        const info = fs.lstatSync(cursor);
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          fs.realpathSync.native(cursor) !== cursor
        )
          throw new Error();
      }
      if (fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
      try {
        fs.lstatSync(parent);
        retained = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        retained = false;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") retained = false;
      else {
        status = "blocked";
        reason = "worktree_parent_cleanup_unconfirmed";
        retained = null;
      }
    }
  }
  const { parentDirectoryRetained: _parent, ...result } = value;
  return {
    ...result,
    status,
    reason,
    workspaceId,
    workspaceDirectoryRetained: retained,
  };
}

/** 業務IntentをGit技術要求へ投影し、Commit直後に同期CASで保持Refを確保する。 */
export function freezeWorkspaceCandidate(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  previousCommit: string | null = null,
  previousTemporary: CommitTemporary | null = null,
): WorkspaceCandidateResult {
  const reference = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
  let result: WorkspaceCandidateResult = {
    status: "blocked",
    reason: "candidate_input_invalid",
    candidateRef: reference,
    candidateCommit: previousCommit,
    mergeCommit: null,
    effectIssued: false,
    cleanupConfirmed: previousTemporary === null,
    temporary: previousTemporary,
    changedPaths: [],
  };
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null)
    return { ...result, reason: "worktree_repository_invalid" };
  const held = readRepositoryRevision(repository, { reference });
  if (held.status !== "completed")
    return {
      ...result,
      reason:
        held.reason === "reference_not_direct"
          ? "candidate_ref_not_direct"
          : "candidate_ref_unavailable",
    };
  if (
    held.present &&
    previousCommit !== null &&
    held.commitId !== previousCommit
  )
    return { ...result, reason: "candidate_ref_mismatch" };
  const fixedCommit = held.commitId ?? previousCommit;
  const target = workspaceWorktreeTarget(request.workspaceId);
  const technical = createCommit(repository, {
    worktree: target,
    baseCommit: request.baseCommit,
    expectedHead: request.expectedWorkspaceHead,
    selection: request.selection,
    message: `Candidate: ${request.candidateName ?? request.operationId}`,
    temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
    previousCommit: fixedCommit,
    temporary: previousTemporary,
  });
  result = {
    ...result,
    status: technical.status,
    reason: technical.reason,
    candidateCommit: technical.commitId ?? fixedCommit,
    effectIssued: technical.effectIssued,
    cleanupConfirmed: technical.cleanupConfirmed,
    temporary: technical.temporary,
    changedPaths: technical.changedPaths,
  };
  // 保存やawaitを挟まず、既知OIDの保持を確保する。保存成功だけでGC保護を主張しない。
  if (technical.commitId !== null) {
    const bound = createReference(repository, {
      name: reference,
      commitId: technical.commitId,
    });
    result = {
      ...result,
      effectIssued: result.effectIssued || bound.effectIssued,
    };
    if (bound.status !== "completed")
      return {
        ...result,
        status: "blocked",
        reason:
          technical.status === "blocked"
            ? technical.reason
            : bound.reason === "reference_update_rejected"
              ? "candidate_git_failed"
              : "candidate_ref_unconfirmed",
      };
  }
  return result;
}

/** 明示的な候補終了を、期待OID付きRef削除と既知の短命Index回収へ投影する。 */
export function removeWorkspaceCandidate(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  expectedCommit: string | null,
  previousTemporary: CommitTemporary | null = null,
): WorkspaceCandidateResult {
  const reference = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
  const result: WorkspaceCandidateResult = {
    status: "blocked",
    reason: "candidate_input_invalid",
    candidateRef: reference,
    candidateCommit: expectedCommit,
    mergeCommit: null,
    effectIssued: false,
    cleanupConfirmed: previousTemporary === null,
    temporary: previousTemporary,
    changedPaths: [],
  };
  if (expectedCommit !== null) {
    const verified = createCommit(repository, {
      baseCommit: request.baseCommit,
      expectedHead: request.expectedWorkspaceHead,
      selection: request.selection,
      message: `Candidate: ${request.candidateName ?? request.operationId}`,
      temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
      previousCommit: expectedCommit,
      temporary: previousTemporary,
    });
    if (verified.status !== "completed")
      return {
        ...result,
        reason: verified.reason,
        cleanupConfirmed: verified.cleanupConfirmed,
        temporary: verified.temporary,
      };
    previousTemporary = verified.temporary;
  }
  const removed = removeReference(repository, {
    name: reference,
    expectedCommitId: expectedCommit,
    ...(previousTemporary
      ? {
          temporaryIndex: {
            directory: `.crdd/workspaces/${request.workspaceId}`,
            value: previousTemporary,
          },
        }
      : {}),
  });
  const failureReasons: Readonly<Record<string, string>> = {
    reference_commit_changed: "candidate_ref_mismatch",
    reference_checked_out: "candidate_ref_in_use",
    reference_update_rejected: "candidate_ref_removal_unconfirmed",
    reference_result_unconfirmed: "candidate_ref_removal_unconfirmed",
    reference_not_direct: "candidate_ref_not_direct",
    reference_temporary_cleanup_unconfirmed:
      "commit_temporary_cleanup_unconfirmed",
  };
  return {
    ...result,
    status: removed.status === "completed" ? "completed" : "blocked",
    reason:
      removed.status === "completed"
        ? removed.effectIssued
          ? "candidate_ref_removed"
          : "candidate_ref_absent"
        : (failureReasons[removed.reason] ?? "candidate_ref_unavailable"),
    effectIssued: removed.effectIssued,
    cleanupConfirmed: removed.cleanupConfirmed,
    temporary: removed.temporary,
  };
}

/** 既存採用Intentの内容確認・保持Ref確認を終え、現在RepositoryへMergeを依頼する。 */
export function mergeWorkspaceCandidate(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  target: Readonly<{
    candidateCommit: string;
    targetBranch: string;
    expectedTargetHead: string;
  }>,
): WorkspaceCandidateResult {
  const reference = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
  const result: WorkspaceCandidateResult = {
    status: "blocked",
    reason: "candidate_input_invalid",
    candidateRef: reference,
    candidateCommit: target.candidateCommit,
    mergeCommit: null,
    effectIssued: false,
    cleanupConfirmed: true,
    temporary: null,
    changedPaths: [],
  };
  const held = readRepositoryRevision(repository, { reference });
  if (held.status !== "completed")
    return {
      ...result,
      reason:
        held.reason === "reference_not_direct"
          ? "candidate_ref_not_direct"
          : "candidate_ref_unavailable",
    };
  if (held.commitId !== target.candidateCommit)
    return { ...result, reason: "candidate_ref_mismatch" };
  const fixed = createCommit(repository, {
    baseCommit: request.baseCommit,
    expectedHead: request.expectedWorkspaceHead,
    selection: request.selection,
    message: `Candidate: ${request.candidateName ?? request.operationId}`,
    temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
    previousCommit: target.candidateCommit,
  });
  if (fixed.status !== "completed") return { ...result, reason: fixed.reason };
  const message = [
    `Merge Candidate: ${request.candidateName ?? request.operationId}`,
    "",
    ...(request.workspaceName ? [`Workspace: ${request.workspaceName}`] : []),
    `Workspace-ID: ${request.workspaceId}`,
    `Base-Commit: ${request.baseCommit}`,
    `Candidate-Commit: ${target.candidateCommit}`,
    ...request.relatedChangeIds.map((id) => `Related-CHG: ${id}`),
  ].join("\n");
  const merged = mergeCommit(repository, {
    baseCommit: request.baseCommit,
    sourceCommit: target.candidateCommit,
    targetBranch: target.targetBranch,
    expectedHead: target.expectedTargetHead,
    message,
  });
  return {
    ...result,
    status: merged.status,
    reason: merged.reason,
    mergeCommit: merged.commitId,
    effectIssued: merged.effectIssued,
    changedPaths: fixed.changedPaths,
  };
}

/** 保存済み候補の選択相関を確認してから、固定Objectの差分だけを返す。 */
export function readWorkspaceCandidatePatch(
  repository: Repository,
  request: WorkspaceCandidateRequest,
  commit: string,
  selectedPath: string,
) {
  const selection = request.selection.find(
    (item) => item.path === selectedPath,
  );
  if (!selection) throw Error("candidate_path_invalid");
  const verified = createCommit(repository, {
    baseCommit: request.baseCommit,
    expectedHead: request.expectedWorkspaceHead,
    selection: request.selection,
    message: `Candidate: ${request.candidateName ?? request.operationId}`,
    temporaryDirectory: `.crdd/workspaces/${request.workspaceId}`,
    previousCommit: commit,
  });
  if (verified.status !== "completed") throw Error(verified.reason);
  const diff = readCommitDiff(repository, {
    baseCommit: request.baseCommit,
    commitId: commit,
    path: selectedPath,
  });
  return {
    baseCommit: diff.baseCommit,
    head: commit,
    candidateCommit: commit,
    selection,
    content: null,
    binary: diff.binary,
    patch: diff.patch,
  };
}
