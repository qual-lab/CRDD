/**
 * Workspaceの公開入力・現在投影を既存操作へ接続する。
 * @responsibility Host指定を受けず所属・世代・現在認可を確定する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @boundary Workbench／MCPと既存Workspace Owner。
 * @security Root・Binding・内部一時物を公開しない。
 */

import path from "node:path";
import {
  type CoordinatorWorkspace,
  containsRecognizedSecretText,
  readCoordinatorWorkspaceState,
  saveCoordinatorIntegrationRecord,
  saveCoordinatorWorkspaceRecord,
} from "../../../domain-model/src/index.ts";
import {
  changedPaths,
  gitLocalChangeSetAdapter,
  inspectWorkspaceCandidatePatch,
  inspectWorkspaceFile,
  observeLocalChangeSet,
  observeRepositoryWorktree,
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import type { StoreResult } from "../state/result.ts";

import {
  deriveCoordinatorRepositoryBindingId,
  validIdentity as isStableId,
} from "../state/validation.ts";
import { manageCoordinatorWorkspace } from "./operations.ts";
import type {
  CoordinatorIntegrationRecordPort,
  IntegrationRecordBinding,
} from "./record.ts";

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
  const snapshot = readCoordinatorWorkspaceState(
    verifyRuntimePersistenceRepository(ownerRoot),
    binding,
  );
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

/**
 * 候補公開と採用結果の保存Portを統合保存へ結合する。
 * @responsibility 同Identityの再送を同内容に限定し、後処理の結果を耐久化する。
 * @trace ARCH-000005
 * @input binding: Repository・Project・Milestone・Queueの固定結合。
 * @returns 既存の結果保存Port。
 * @precondition 全入力照合済み保存と対象Queueがある。
 * @postcondition 保存を受領や実適用の許可へ読み替えない。
 * @effect 新しい結果だけを同じ排他内で保存する。
 * @failure 不正値、結合差、異内容再送、保存失敗は停止する。
 * @invariant 採用後の保存失敗から候補を再適用しない。
 * @boundary 結果保存PortとRepository内現在状態。
 * @security 新しいAuthorityや既読状態を作成しない。
 * @concurrency 読取り、同Identity照合、更新を同じOwnerで行う。
 */
export function createCoordinatorSnapshotIntegrationRecordPort(
  binding: IntegrationRecordBinding,
): CoordinatorIntegrationRecordPort {
  const storageRepository = verifyRuntimePersistenceRepository(
    binding.workingDirectory,
  );
  return Object.freeze({
    /**
     * 同Identity・同内容に限定して結果を保存する。
     * @responsibility 候補公開と採用結果の不変な保存を所有する。
     * @trace ARCH-000005
     * @input record: 既存結果Portの値。
     * @returns 保存確定または停止。
     * @precondition 対象Queueと結合が一致する。
     * @postcondition 同内容再送で保存を増やさない。
     * @effect 新しい結果を統合保存へ追加する。
     * @failure 異内容再送を拒否する。
     * @invariant 保存失敗から再適用しない。
     * @boundary 結果Portと保存。
     * @security 既読やAuthorityを新設しない。
     * @concurrency 照合と更新を同じOwnerで行う。
     */
    write(record) {
      return saveCoordinatorIntegrationRecord(
        storageRepository,
        binding.repositoryBindingId,
        binding,
        record,
      );
    },
  });
}

/**
 * 既存操作Leaseに結合したWorkspace現在値を保存する。
 * @responsibility 同対象世代比較、Queue対象結合と終了後整理を一つのSnapshotへ閉じる。
 * @trace ARCH-000004
 * @input 所属Root、Repository結合、実在Project／Queue、Lease世代、期待Workspace世代と次値。
 * @returns 確定した現在値又はblocked。
 * @precondition 呼出し元は既存project-operation Leaseを保持する。
 * @postcondition 同じLease・Queue・対象・世代だけを更新する。
 * @effect 既存state.jsonを原子的保存し読戻す。Gitは実行しない。
 * @failure 対象不一致・使用中・未解決・保存不明は停止。
 * @invariant 新台帳・Lockを追加せず、Taskの現在値を重複保存しない。
 * @boundary Workspace操作と既存Snapshot Writer。
 * @security 状態名だけを削除許可としない。
 * @concurrency 既存短期Snapshot排他だけを保持する。
 */
export function writeCoordinatorWorkspaceRecord(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  ownerGeneration: string,
  workspaceId: string,
  expectedGeneration: number,
  nextRecord: CoordinatorWorkspace | null,
): StoreResult<CoordinatorWorkspace | null> {
  return saveCoordinatorWorkspaceRecord(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    projectId,
    queueId,
    ownerGeneration,
    workspaceId,
    expectedGeneration,
    nextRecord,
    { processId: process.pid, now: () => Date.now() },
  );
}

import { inspectWorkspaceCommand } from "../../../domain-model/src/index.ts";
