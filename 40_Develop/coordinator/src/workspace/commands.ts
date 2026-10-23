/**
 * Workspaceの公開入力・現在投影を既存操作へ接続する。
 * @responsibility Host指定を受けず所属・世代・現在認可を確定する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @boundary Workbench／MCPと既存Workspace Owner。
 * @security Root・Binding・内部一時物を公開しない。
 */
import path from "node:path";
import { types } from "node:util";
import {
  inspectWorkspaceFile,
  inspectWorkspaceCandidatePatch,
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
  observeLocalChangeSet,
  gitLocalChangeSetAdapter,
  changedPaths,
  observeRepositoryWorktree,
  validWorkspaceDisplayName,
  validWorkspaceCandidateRequest,
  type WorkspaceCandidateSelection,
} from "../../../version-control/src/index.ts";
import { snapshotPlainRecord, snapshotPlainArray } from "../state/model.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/model.ts";
import { readCoordinatorSnapshot } from "../storage/current-state.ts";
import { manageCoordinatorWorkspace } from "./operations.ts";
import type { CoordinatorWorkspace } from "./record.ts";
import { containsRecognizedSecretText } from "../../../domain-model/src/index.ts";

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
              | { operation: "create"; baseCommit: string; name: string | null }
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
                  selection: readonly WorkspaceCandidateSelection[];
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
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
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
  typeof value === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
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
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);
const fields: Readonly<Record<string, readonly string[]>> = {
  get: [],
  inspect: ["path"],
  "candidate-diff": ["path"],
  create: ["baseCommit", "name"],
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
    !validWorkspaceDisplayName(r.name)
  )
    return null;
  if (
    operation === "create" &&
    (!isGitObjectId(r.baseCommit) || r.expectedGeneration !== 0)
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
      !["adopted", "rejected"].includes(String(r.disposition)))
  )
    return null;
  if (operation === "freeze") {
    const selection = snapshotPlainArray(r.selection, 1000);
    const changes = snapshotPlainArray(r.relatedChangeIds, 100);
    if (selection.status !== "ok" || changes.status !== "ok") return null;
    const items = selection.value.map((item) =>
      snapshotPlainRecord(item, new Set(["path", "blobId", "mode"])),
    );
    if (items.some((item) => item === null)) return null;
    const safe = { ...r, selection: items, relatedChangeIds: changes.value };
    if (
      !validWorkspaceCandidateRequest({
        workspaceId: r.workspaceId,
        operationId: r.operationId,
        baseCommit: r.baseCommit,
        expectedWorkspaceHead: r.expectedHead,
        selection: safe.selection,
        candidateName: r.candidateName,
        workspaceName: null,
        relatedChangeIds: safe.relatedChangeIds,
      })
    )
      return null;
    return safe as unknown as WorkspaceCommand;
  }
  if (
    (operation === "inspect" || operation === "candidate-diff") &&
    (typeof r.path !== "string" ||
      !validWorkspaceCandidateRequest({
        workspaceId: r.workspaceId,
        operationId: r.workspaceId,
        baseCommit: "0".repeat(40),
        expectedWorkspaceHead: "0".repeat(40),
        selection: [{ path: r.path, mode: null, blobId: null }],
        workspaceName: null,
        candidateName: null,
        relatedChangeIds: [],
      }))
  )
    return null;
  return r as WorkspaceCommand;
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
function workspaceView(record: CoordinatorWorkspace) {
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
export type WorkspaceView = ReturnType<typeof workspaceView>;

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
export function executeWorkspaceCommand(
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
  const root = verifyRepositoryRoot(ownerRoot);
  if (
    root.status !== "completed" ||
    resolveVerifiedRepositoryRoot(root.capability) !== ownerRoot
  )
    throw new Error("workspace_access_unavailable");
  const binding = deriveCoordinatorRepositoryBindingId(ownerRoot);
  const snapshot = readCoordinatorSnapshot(ownerRoot, binding);
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
        !isStableId(cursor[2])
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
              ) as CoordinatorWorkspace,
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
    if (command.operation === "candidate-diff") {
      if (!record.candidate?.candidateCommit)
        throw new Error("workspace_target_unavailable");
      data = inspectWorkspaceCandidatePatch(
        root.capability,
        record.candidate.request,
        record.candidate.candidateCommit,
        command.path,
      );
      if (containsWorkspaceOutputSecret(data))
        throw new Error("workspace_content_unavailable");
      if (!allowed()) throw new Error("workspace_result_unavailable");
      return {
        contract: "crdd-orchestrator/workspace-surface/v1" as const,
        projectId,
        operation: command.operation,
        data,
      };
    }
    const observed = observeRepositoryWorktree(
      root.capability,
      record.workspaceId,
    );
    if (
      observed.status !== "completed" ||
      observed.workspaceId !== record.workspaceId ||
      observed.relativePath === null ||
      observed.observation?.head !== record.head ||
      record.phase !== "ready"
    )
      throw new Error("workspace_target_unavailable");
    const target = verifyRepositoryRoot(
      path.join(ownerRoot, observed.relativePath),
    );
    if (target.status !== "completed")
      throw new Error("workspace_target_unavailable");
    data =
      command.operation === "inspect"
        ? inspectWorkspaceFile(
            root.capability,
            record.workspaceId,
            record.baseCommit,
            command.path,
          )
        : {
            workspace: workspaceView(record),
            changedPaths: changedPaths(
              observeLocalChangeSet(
                target.capability,
                record.baseCommit,
                gitLocalChangeSetAdapter,
              ),
            ),
          };
  } else {
    const { operation, ...input } = command;
    const result = manageCoordinatorWorkspace({
      ...input,
      operation: operation === "select" ? "observe" : operation,
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
    } as Parameters<typeof manageCoordinatorWorkspace>[0]);
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
      adoptionReleaseFailure: result.adoptionReleaseFailure,
      adoptionReleaseRecoveryId: result.adoptionReleaseRecoveryId,
    };
  }
  if (!allowed()) throw new Error("workspace_result_unavailable");
  if (containsWorkspaceOutputSecret(data))
    throw new Error("workspace_content_unavailable");
  return {
    contract: "crdd-orchestrator/workspace-surface/v1" as const,
    projectId,
    operation: command.operation,
    data,
  };
}
