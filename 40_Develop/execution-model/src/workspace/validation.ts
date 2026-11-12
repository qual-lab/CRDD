/**
 * Workspaceと統合結果の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import type { CoordinatorSnapshot } from "../state/types.ts";
import {
  encodeRuntimeStateValue,
  hashRuntimeStateValueText,
  historyRow,
  snapshotRuntimeStateArray,
  snapshotRuntimeStateRecord,
  validId,
} from "../state/validation.ts";
import type {
  CoordinatorResultRecord,
  CoordinatorWorkspace,
  CoordinatorWorkspaceResult,
  WorkspaceCandidateRequest,
  WorkspaceCommand,
} from "./types.ts";

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
    const r = snapshotRuntimeStateRecord(
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
  const r = snapshotRuntimeStateRecord(
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
    const selection = snapshotRuntimeStateArray(
      r.selection,
      Number.MAX_SAFE_INTEGER,
    );
    const changes = snapshotRuntimeStateArray(
      r.relatedChangeIds,
      Number.MAX_SAFE_INTEGER,
    );
    if (selection.status !== "ok" || changes.status !== "ok") return null;
    const items = selection.value.map((item) =>
      snapshotRuntimeStateRecord(item, new Set(["path", "blobId", "mode"])),
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
 * Workspaceの現在記録を元世代と非使用条件へ限定して更新する。
 * @responsibility Queue・Lease値・世代・未解決参照・破棄確認を元の順序で検査する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh Snapshot、対象ID・期待世代・次値、observations: 同じOwnerが取得するProcess IDと有限時刻観測。
 * @returns 既存結果封筒の変更候補又は投影、拒否時は元の固定理由。
 * @precondition 同じ短期保存Ownerがfresh SnapshotとRepository結合を検証している。
 * @postcondition 入力と対象外区画を変更せず、拒否・非削除では時計を呼ばない。
 * @effect 成功する削除候補の末尾でだけ同期時計を二回観測する。保存・Git操作なし。
 * @failure 元の判定順と拒否理由を維持する。
 * @invariant 候補のcompletedを耐久保存・認可・実資源終了の証明へ読み替えない。
 * @boundary Coordinator専用メモリ投影と、別Ownerが持つ単一Writer。
 * @security 値はAuthorityではなく、保存Ownerや任意Snapshot callbackを公開せず、用途固定の同期clock以外を受けない。
 * @concurrency 保存CASと現在Owner再確認・解放は既存Writerが行う。
 */

export function prepareCoordinatorWorkspaceRecordUpdate(
  current: CoordinatorSnapshot,
  projectId: string,
  queueId: string,
  ownerGeneration: string,
  workspaceId: string,
  expectedGeneration: number,
  nextRecord: CoordinatorWorkspace | null,
  observations: Readonly<{ processId: number; now: () => number }>,
) {
  const queue = current.queueEntries.find(
    (entry) => entry.queueId === queueId && entry.projectId === projectId,
  );
  const owned = current.leaseIntents.some(
    (intent) =>
      intent.projectId === projectId &&
      intent.queueId === queueId &&
      intent.kind === "project-operation" &&
      intent.phase === "lock_owned" &&
      intent.ownerGeneration === ownerGeneration &&
      intent.ownerProcessId === observations.processId,
  );
  if (!queue || !owned) return blocked("orchestrator_workspace_lease_mismatch");
  const previous = current.workspaces.find(
    (entry) => entry.workspaceId === workspaceId,
  );
  if ((previous?.generation ?? 0) !== expectedGeneration)
    return blocked("orchestrator_workspace_generation_conflict");
  if (queue.workspaceId != null && queue.workspaceId !== workspaceId)
    return blocked("orchestrator_workspace_target_mismatch");
  if (
    nextRecord &&
    (!validCoordinatorWorkspace(nextRecord) ||
      nextRecord.workspaceId !== workspaceId ||
      nextRecord.generation !== expectedGeneration + 1)
  )
    return blocked("orchestrator_workspace_record_invalid");
  // binding-wide操作Leaseを維持し、既存Task／回復参照から非使用を導く。
  const affectedProjects = new Set(
    current.queueEntries
      .filter((entry) => entry.workspaceId === workspaceId)
      .map((entry) => entry.projectId),
  );
  affectedProjects.add(projectId);
  const singleTaskBusy = current.queueEntries.some(
    (entry) =>
      affectedProjects.has(entry.projectId) &&
      entry.singleTask &&
      (entry.singleTask.phase !== "settled" ||
        !entry.singleTask.cleanupConfirmed ||
        entry.singleTask.recoveryIds.length > 0),
  );
  const busy =
    singleTaskBusy ||
    current.projects
      .filter((entry) => affectedProjects.has(entry.projectId))
      .some((entry) =>
        entry.tasks.some(
          (task) =>
            [
              "starting",
              "running",
              "cleanup_pending",
              "recovery_required",
            ].includes(task.state) ||
            task.recoveryUnresolved ||
            task.recoveryObligations.some(
              (obligation) =>
                !["settled", "acknowledged"].includes(obligation.phase),
            ),
        ),
      );
  if (busy) return blocked("orchestrator_workspace_in_use_or_unresolved");
  if (
    (nextRecord?.phase === "discarding" || nextRecord === null) &&
    current.queueEntries.some(
      (entry) =>
        entry.workspaceId === workspaceId &&
        entry.queueId !== queueId &&
        !["completed", "cancelled"].includes(entry.state),
    )
  )
    return blocked("orchestrator_workspace_other_queue_pending");
  if (
    nextRecord?.phase === "discarding" &&
    previous?.holdUntil !== null &&
    previous?.holdUntil !== undefined
  )
    return blocked("orchestrator_workspace_held");
  if (
    nextRecord === null &&
    (previous?.lastResult?.worktreeRemoved !== true ||
      previous.lastResult.branchRemoved !== true ||
      previous.lastResult.workspaceDirectoryRetained !== false)
  )
    return blocked("orchestrator_workspace_disposal_unconfirmed");
  const workspaces = current.workspaces.filter(
    (entry) => entry.workspaceId !== workspaceId,
  );
  if (nextRecord) workspaces.push(nextRecord);
  return completed("orchestrator_workspace_record_saved", {
    next: {
      ...current,
      workspaces,
      queueEntries: current.queueEntries.map((entry) =>
        entry.queueId === queueId ||
        (nextRecord === null && entry.workspaceId === workspaceId)
          ? {
              ...entry,
              workspaceId: nextRecord === null ? null : workspaceId,
              ...(nextRecord === null &&
              !["completed", "cancelled"].includes(entry.state)
                ? { state: "cancelled" as const, resumeCondition: null }
                : {}),
              generation: entry.generation + 1,
            }
          : entry,
      ),
      historyPending:
        nextRecord === null
          ? [
              ...current.historyPending,
              historyRow(
                {
                  id: `workspace-${workspaceId}`,
                  occurredAt: new Date(observations.now()).toISOString(),
                  outcome: "cancelled",
                  primaryFailure: previous?.primaryFailure ? "cleanup" : null,
                  cleanup: "confirmed",
                },
                observations.now(),
              ),
            ]
          : current.historyPending,
    },
    value: nextRecord,
  });
}

/**
 * 候補生成の完了形を元の外側freezeだけで構築する。
 * @responsibility 保存完了でない既存三fieldを保持する。
 * @trace ARCH-000004
 * @input reason: 固定理由、value: 局所値。
 * @returns 既存完了封筒。
 * @precondition 局所検査済み。
 * @postcondition nested値はfreeze・cloneしない。
 * @effect N/A: 値構築のみ。
 * @failure N/A: 判定は用途別関数。
 * @invariant 保存・認可成立を表さない。
 * @boundary 非公開constructor。
 * @security Authorityなし。
 * @concurrency N/A: 状態なし。
 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/**
 * 拒否形を元の五fieldと外側freezeで構築する。
 * @responsibility 候補生成の拒否を保存失敗と混同しない。
 * @trace ARCH-000004
 * @input reason: 元の固定理由。
 * @returns 回復参照なしの拒否。
 * @precondition I/O未発行。
 * @postcondition 回復義務を生成しない。
 * @effect N/A: 値構築のみ。
 * @failure N/A: 判定は用途別関数。
 * @invariant 保存Ownerの失敗を覆わない。
 * @boundary 非公開constructor。
 * @security 秘密・Authorityなし。
 * @concurrency N/A: 状態なし。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

/**
 * 候補公開・採用結果の保存候補を同じIdentityへ限定する。
 * @responsibility 結果本文の不変・Queue所属と同内容再入場を判定する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 元Snapshot、binding: 保存結合の値、record: 統合又は採用結果。
 * @returns 既存結果封筒の変更候補又は投影、拒否時は元の固定理由。
 * @precondition 同じ短期保存Ownerがfresh SnapshotとRepository結合を検証している。
 * @postcondition 入力と対象外区画を変更しない。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 元の判定順と拒否理由を維持する。
 * @invariant 候補のcompletedを耐久保存・認可・実資源終了の証明へ読み替えない。
 * @boundary Coordinator専用メモリ投影と、別Ownerが持つ単一Writer。
 * @security 値はAuthorityではなく、保存Ownerや任意callbackを公開しない。
 * @concurrency 保存CASと現在Owner再確認・解放は既存Writerが行う。
 */

export function prepareCoordinatorIntegrationRecordCreation(
  current: CoordinatorSnapshot,
  binding: Pick<
    CoordinatorResultRecord,
    "repositoryBindingId" | "projectId" | "milestoneId" | "queueId"
  >,
  record: Pick<CoordinatorResultRecord, "kind" | "identity" | "value">,
) {
  const value: CoordinatorResultRecord = {
    contract: COORDINATOR_INTEGRATION_CONTRACT,
    kind: record.kind,
    repositoryBindingId: binding.repositoryBindingId,
    projectId: binding.projectId,
    milestoneId: binding.milestoneId,
    queueId: binding.queueId,
    identity: record.identity,
    contentHash: hashRuntimeStateValueText(
      encodeRuntimeStateValue(record.value),
    ),
    value: record.value,
  };
  if (!validCoordinatorResultRecord(value))
    return blocked("orchestrator_result_invalid");
  const queue = current.queueEntries.find(
    (item) => item.queueId === binding.queueId,
  );
  if (
    (value.kind === "integration" && (!queue || queue.singleTask)) ||
    (value.milestoneId === null && !queue?.singleTask) ||
    (queue &&
      (queue.projectId !== binding.projectId ||
        queue.milestoneId !== binding.milestoneId))
  )
    return blocked("orchestrator_result_binding_invalid");
  const old = current.results.find(
    (item) =>
      item.kind === value.kind &&
      item.projectId === value.projectId &&
      item.identity === value.identity,
  );
  if (old && encodeRuntimeStateValue(old) !== encodeRuntimeStateValue(value))
    return blocked("orchestrator_result_identity_conflict");
  return completed("orchestrator_result_durable", {
    next: old ? null : { ...current, results: [...current.results, value] },
    value: { written: true as const },
  });
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 *
 * @responsibility task-attempt-runtimeの入力からown Data Propertyを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input container: object、key: string
 * @returns unknownを返す。
 * @precondition 「container: object、key: string」がownDataPropertyの入力契約を満たす。
 * @postcondition ownDataPropertyの責務を完了した結果だけを返す。
 * @effect N/A: ownDataPropertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataPropertyは独自の失敗分岐を所有しない。
 * @invariant ownDataPropertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataPropertyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataPropertyは共有非同期状態を持たない同期処理である。
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

/**
 * Plain Containerかを判定する。
 *
 * @responsibility Plain Containerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainContainerの入力契約を満たす。
 * @postcondition isPlainContainerの責務を完了した結果だけを返す。
 * @effect N/A: isPlainContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainContainerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlainContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlainContainerは共有非同期状態を持たない同期処理である。
 */
function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Workspace観測の閉じた値をsnapshotする。
 * @responsibility 欠測・null・空配列と方式別の変更相関を維持する。
 * @trace ARCH-000004
 * @input 未検証の観測値。
 * @returns 凍結metadata又はnull。
 * @precondition N/A: unknownを受ける。
 * @postcondition 元値の変更を搬送しない。
 * @effect N/A: 値検査のみ。
 * @failure 不正・不整合・getterはnull。
 * @invariant Pathは相対値であり内容・Host所在を含まない。
 * @boundary Coordinator結果から認可済み上位。
 * @security Authorityを新設しない。
 * @concurrency 純粋同期処理。
 */
export function snapshotCoordinatorWorkspaceResult(
  raw: unknown,
): CoordinatorWorkspaceResult | null {
  try {
    if (!isPlainContainer(raw)) return null;
    const keys = [
      "workspaceId",
      "changedPaths",
      "canonicalRepositoryChanged",
      "changeAttribution",
      "workspaceDeletionIssued",
    ];
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) =>
          !Object.hasOwn(
            Object.getOwnPropertyDescriptor(raw, key) ?? {},
            "value",
          ),
      )
    )
      return null;
    const id = ownDataProperty(raw, "workspaceId");
    const paths = ownDataProperty(raw, "changedPaths");
    const changed = ownDataProperty(raw, "canonicalRepositoryChanged");
    if (
      (id !== null &&
        (typeof id !== "string" ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id))) ||
      ownDataProperty(raw, "changeAttribution") !== "unattributed" ||
      ownDataProperty(raw, "workspaceDeletionIssued") !== false ||
      (changed !== null && typeof changed !== "boolean")
    )
      return null;
    let snapshot: readonly string[] | null = null;
    if (paths !== null) {
      if (
        !Array.isArray(paths) ||
        types.isProxy(paths) ||
        Reflect.ownKeys(paths).length !== paths.length + 1
      )
        return null;
      const values: string[] = [];
      for (let index = 0; index < paths.length; index++) {
        const value = ownDataProperty(paths, String(index));
        if (
          typeof value !== "string" ||
          value.length === 0 ||
          /[\\:\0\r\n]/u.test(value) ||
          value
            .split("/")
            .some((part) => part === "" || part === "." || part === "..")
        )
          return null;
        values.push(value);
      }
      if (new Set(values).size !== values.length) return null;
      snapshot = Object.freeze(values);
    }
    if (
      id === null
        ? changed !== (snapshot === null ? null : snapshot.length > 0)
        : changed !== false
    )
      return null;
    return Object.freeze({
      workspaceId: id,
      changedPaths: snapshot,
      canonicalRepositoryChanged: changed,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    });
  } catch {
    return null;
  }
}

/**
 * Taskに結合したWorkspace観測を公開用の閉じた値へ写す。
 * @responsibility 試行相関・対象一致・欠測と観測不能を維持する。
 * @trace ARCH-000004
 * @input raw: 観測配列、expectedWorkspaceId: 要求対象（省略時も配列内の対象一致を検査）。
 * @returns 凍結した観測配列。不正又は重複はnull。
 * @precondition N/A: 外部由来のunknownを受ける。
 * @postcondition 元値の後続変更を公開結果へ搬送しない。
 * @effect N/A: 値検査と複製だけ。
 * @failure getter・Proxy・別対象・不明を空配列へ変換しない。
 * @invariant 変更観測は採用・Commit・Mergeの完了ではない。
 * @boundary Coordinator結果とWorkbench／MCPの公開投影。
 * @security 本文・絶対Path・Authorityを追加しない。
 * @concurrency 同期処理で共有状態を持たない。
 */
export function inspectCoordinatorWorkspaceResults(
  raw: unknown,
  expectedWorkspaceId?: string | null,
):
  | readonly Readonly<{
      taskId: string;
      attemptId: string;
      operationId: string;
      result: CoordinatorWorkspaceResult;
    }>[]
  | null {
  const array = snapshotRuntimeStateArray(raw, Number.MAX_SAFE_INTEGER);
  if (array.status !== "ok" || array.value.length === 0) return null;
  const entries: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    result: CoordinatorWorkspaceResult;
  }>[] = [];
  const attempts = new Set<string>();
  const operations = new Set<string>();
  let workspaceId = expectedWorkspaceId;
  for (const value of array.value) {
    const entry = snapshotRuntimeStateRecord(
      value,
      new Set(["taskId", "attemptId", "operationId", "result"] as const),
    );
    if (
      !entry ||
      !validId(entry.taskId) ||
      !validId(entry.attemptId) ||
      !validId(entry.operationId) ||
      attempts.has(entry.attemptId) ||
      operations.has(entry.operationId)
    )
      return null;
    const result = snapshotCoordinatorWorkspaceResult(entry.result);
    if (
      !result ||
      (workspaceId !== undefined && result.workspaceId !== workspaceId)
    )
      return null;
    workspaceId = result.workspaceId;
    attempts.add(entry.attemptId);
    operations.add(entry.operationId);
    entries.push(
      Object.freeze({
        taskId: entry.taskId,
        attemptId: entry.attemptId,
        operationId: entry.operationId,
        result,
      }),
    );
  }
  return Object.freeze(entries);
}

/**
 * Workspace現在値の閉じた保存形式を検査する。
 * @responsibility 旧値・欠落・追加項目・不正相関を拒否する。
 * @trace ARCH-000004
 * @input value: 未検証JSON値。
 * @returns 新形式として有効か。
 * @precondition JSONをdecodeした値だけを渡す。
 * @postcondition 形式検査をGit実状態の成立にしない。
 * @effect N/A: 値検査のみ。
 * @failure 不正値はfalse。
 * @invariant unknownを成功に補完しない。
 * @boundary Snapshotのcodec。
 * @security 外部Authorityを作らない。
 * @concurrency N/A: 局所処理。
 */
export function validCoordinatorWorkspace(
  value: unknown,
): value is CoordinatorWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
    "baseCommit,candidate,generation,head,holdUntil,lastResult,name,pending,phase,primaryFailure,workspaceId"
  )
    return false;
  if (!validWorkspaceDisplayName(record.name)) return false;
  if (
    record.candidate !== null &&
    !validCandidateRecord(record.candidate, record.workspaceId)
  )
    return false;
  if (
    !(
      record.primaryFailure === null ||
      (typeof record.primaryFailure === "string" &&
        /^worktree_[a-z_]+$/u.test(record.primaryFailure))
    )
  )
    return false;
  if (
    typeof record.workspaceId !== "string" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
      record.workspaceId,
    ) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    ![record.baseCommit, record.head].every(
      (item) =>
        typeof item === "string" &&
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(item),
    ) ||
    !["creating", "ready", "discarding"].includes(String(record.phase)) ||
    !(
      record.holdUntil === null ||
      (typeof record.holdUntil === "string" &&
        Number.isFinite(Date.parse(record.holdUntil)))
    )
  )
    return false;
  if (record.phase === "ready" && record.pending !== null) return false;
  if (record.pending !== null) {
    if (typeof record.pending !== "object" || Array.isArray(record.pending))
      return false;
    const pending = record.pending as Record<string, unknown>;
    if (
      Object.keys(pending).sort().join(",") !==
        "discardChanges,expectedHead,kind,operationId" ||
      typeof pending.operationId !== "string" ||
      !/^[a-f0-9-]{36}$/u.test(pending.operationId) ||
      pending.kind !== (record.phase === "creating" ? "create" : "discard") ||
      pending.expectedHead !== record.head ||
      typeof pending.discardChanges !== "boolean"
    )
      return false;
  } else if (record.phase !== "ready") return false;
  if (record.lastResult !== null) {
    if (
      typeof record.lastResult !== "object" ||
      Array.isArray(record.lastResult)
    )
      return false;
    const result = record.lastResult as Record<string, unknown>;
    if (
      Object.keys(result).sort().join(",") !==
        "branch,branchRemoved,effectIssued,expectedCommit,observation,reason,relativePath,status,workspaceDirectoryRetained,workspaceId,worktreeRemoved" ||
      result.workspaceId !== record.workspaceId ||
      !["completed", "blocked"].includes(String(result.status)) ||
      typeof result.reason !== "string" ||
      !/^worktree_[a-z_]+$/u.test(result.reason) ||
      !(
        result.relativePath === null ||
        result.relativePath ===
          `.crdd/workspaces/${record.workspaceId}/worktree`
      ) ||
      !(
        result.branch === null ||
        result.branch === `crdd/workspace/${record.workspaceId}`
      ) ||
      !(
        result.expectedCommit === null ||
        (typeof result.expectedCommit === "string" &&
          /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(result.expectedCommit))
      ) ||
      typeof result.effectIssued !== "boolean" ||
      ![
        result.worktreeRemoved,
        result.branchRemoved,
        result.workspaceDirectoryRetained,
      ].every((item) => item === null || typeof item === "boolean")
    )
      return false;
    if (result.observation !== null) {
      if (
        !result.observation ||
        typeof result.observation !== "object" ||
        Array.isArray(result.observation)
      )
        return false;
      const observation = result.observation as Record<string, unknown>;
      if (
        Object.keys(observation).sort().join(",") !==
          "branchHead,directoryPresent,dirty,head,locked,prunable,registered" ||
        ![
          observation.registered,
          observation.directoryPresent,
          observation.locked,
          observation.prunable,
        ].every((item) => typeof item === "boolean") ||
        ![observation.head, observation.branchHead].every(
          (item) =>
            item === null ||
            (typeof item === "string" &&
              /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(item)),
        ) ||
        !(observation.dirty === null || typeof observation.dirty === "boolean")
      )
        return false;
    }
  }
  return true;
}

/**
 * 公開結果の閉じた保存値を確認する。
 * @responsibility 旧入力と統合保存で同じ結果契約を検証する。
 * @trace ARCH-000005
 * @input value: JSONから復号した値。
 * @returns 既存結果Recordとして有効か。
 * @precondition getterやtoJSONを持たないJSON値を渡す。
 * @postcondition 結合ID、kind、Identity、内容Hashを確認する。
 * @effect N/A: 値の検証のみ。
 * @failure 不正形状はfalse。
 * @invariant 結果Recordの受理を実適用や既読へ読み替えない。
 * @boundary 保存JSONと既存結果契約。
 * @security Authorityを生成しない。
 * @concurrency N/A: 同期の純粋検証。
 */
export function validCoordinatorResultRecord(
  value: unknown,
): value is CoordinatorResultRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    JSON.stringify(Object.keys(record).sort()) ===
      JSON.stringify(
        [
          "contract",
          "kind",
          "repositoryBindingId",
          "projectId",
          "milestoneId",
          "queueId",
          "identity",
          "contentHash",
          "value",
        ].sort(),
      ) &&
    record.contract === COORDINATOR_INTEGRATION_CONTRACT &&
    (record.kind === "integration" || record.kind === "adoption") &&
    typeof record.identity === "string" &&
    INTEGRATION_RECORD_IDENTITY.test(record.identity) &&
    [record.repositoryBindingId, record.projectId, record.queueId].every(
      (id) => typeof id === "string" && INTEGRATION_BINDING_IDENTITY.test(id),
    ) &&
    ((typeof record.milestoneId === "string" &&
      INTEGRATION_BINDING_IDENTITY.test(record.milestoneId)) ||
      (record.milestoneId === null &&
        record.kind === "adoption" &&
        record.value !== null &&
        typeof record.value === "object" &&
        ["workspace-candidate", "workspace-candidate-close"].includes(
          String((record.value as Record<string, unknown>).recordKind),
        ))) &&
    record.contentHash ===
      createHash("sha256")
        .update(encodeRuntimeStateValue(record.value))
        .digest("hex")
  );
}

/**
 * 固定候補の閉じた保存形式と段階相関を検査する。
 * @responsibility 欠落・余剰・別Workspace・不正結果の拒否。
 * @trace ARCH-000004
 * @input value: JSON値、workspaceId: 所属ID。
 * @returns 有効な現在記録か。
 * @precondition JSON decode後。
 * @postcondition 形式検査を認可・実Git観測と同一視しない。
 * @effect N/A: 値検査。
 * @failure 不正はfalse。
 * @invariant 不明を固定済みに補完しない。
 * @boundary 保存codec。
 * @security 同じWorkspaceへ閉じる。
 * @concurrency N/A: 局所処理。
 */
export function validCandidateRecord(
  value: unknown,
  workspaceId: unknown,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (
    Object.keys(c).sort().join(",") !==
      "candidateCommit,cleanupFailure,disposition,lastResult,mergeCommit,phase,primaryFailure,request,target" ||
    !["freezing", "fixed", "merging", "merged", "removing"].includes(
      String(c.phase),
    )
  )
    return false;
  const hash = (v: unknown) =>
    typeof v === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(v);
  if (
    !(c.candidateCommit === null || hash(c.candidateCommit)) ||
    !(c.mergeCommit === null || hash(c.mergeCommit)) ||
    ![null, "adopted", "rejected"].includes(c.disposition as null) ||
    (!["freezing", "removing"].includes(String(c.phase)) &&
      c.candidateCommit === null)
  )
    return false;
  const r = c.request;
  if (!validWorkspaceCandidateRequest(r) || r.workspaceId !== workspaceId)
    return false;
  if (
    (typeof c.candidateCommit === "string" &&
      c.candidateCommit.length !== r.baseCommit.length) ||
    (typeof c.mergeCommit === "string" &&
      c.mergeCommit.length !== r.baseCommit.length)
  )
    return false;
  if (
    !(
      c.primaryFailure === null ||
      (typeof c.primaryFailure === "string" &&
        /^(?:candidate|worktree|commit_(?:create|merge|temporary))_[a-z_]+$/u.test(
          c.primaryFailure,
        ))
    )
  )
    return false;
  if (
    !(
      c.cleanupFailure === null ||
      (typeof c.cleanupFailure === "string" &&
        /^(?:candidate|worktree|commit_(?:create|temporary))_[a-z_]+$/u.test(
          c.cleanupFailure,
        ))
    )
  )
    return false;
  if (
    ["freezing", "fixed"].includes(String(c.phase)) &&
    (c.target !== null || c.disposition !== null || c.mergeCommit !== null)
  )
    return false;
  if (c.phase === "merged" && c.disposition !== "adopted") return false;
  if (c.phase === "merging" && c.disposition === "rejected") return false;
  if (
    c.phase === "removing" &&
    c.candidateCommit === null &&
    c.disposition !== "rejected"
  )
    return false;
  if (c.target !== null) {
    const target = c.target as Record<string, unknown>;
    if (
      !target ||
      typeof target !== "object" ||
      Object.keys(target).sort().join(",") !==
        "expectedTargetHead,targetBranch" ||
      typeof target.targetBranch !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(target.targetBranch) ||
      !hash(target.expectedTargetHead)
    )
      return false;
  }
  if (["fixed", "merged"].includes(String(c.phase)) && c.lastResult === null)
    return false;
  if (["merging", "merged"].includes(String(c.phase)) && c.target === null)
    return false;
  if (c.phase === "removing" && c.disposition === null) return false;
  if (c.lastResult !== null) {
    const result = c.lastResult as Record<string, unknown>;
    if (
      !result ||
      typeof result !== "object" ||
      Object.keys(result).sort().join(",") !==
        "candidateCommit,candidateRef,changedPaths,cleanupConfirmed,effectIssued,mergeCommit,reason,status,temporary" ||
      !["completed", "blocked"].includes(String(result.status)) ||
      typeof result.reason !== "string" ||
      !/^(?:candidate|worktree|commit_(?:create|merge|temporary))_[a-z_]+$/u.test(
        result.reason,
      ) ||
      !(result.candidateCommit === null || hash(result.candidateCommit)) ||
      !(result.mergeCommit === null || hash(result.mergeCommit)) ||
      !(
        result.candidateRef === null ||
        result.candidateRef ===
          `refs/heads/crdd/candidate/${workspaceId}/${r.operationId}`
      ) ||
      typeof result.cleanupConfirmed !== "boolean" ||
      typeof result.effectIssued !== "boolean" ||
      !Array.isArray(result.changedPaths) ||
      result.changedPaths.some((p) => typeof p !== "string")
    )
      return false;
    if (result.temporary !== null) {
      const temporary = result.temporary as Record<string, unknown>;
      const prefix = `.crdd/workspaces/${workspaceId}/candidate-index-`;
      if (
        !temporary ||
        typeof temporary !== "object" ||
        Object.keys(temporary).sort().join(",") !== "identity,relativePath" ||
        typeof temporary.relativePath !== "string" ||
        !temporary.relativePath.startsWith(prefix) ||
        !/^[A-Za-z0-9]{6}$/u.test(
          temporary.relativePath.slice(prefix.length),
        ) ||
        !(
          temporary.identity === null ||
          (typeof temporary.identity === "string" &&
            /^[a-f0-9]{64}$/u.test(temporary.identity))
        ) ||
        result.cleanupConfirmed !== false
      )
        return false;
    } else if (result.cleanupConfirmed !== true) return false;
    if (
      result.candidateCommit !== null &&
      result.candidateCommit !== c.candidateCommit
    )
      return false;
    if (result.mergeCommit !== null && result.mergeCommit !== c.mergeCommit)
      return false;
    if (
      c.phase === "fixed" &&
      (result.status !== "completed" ||
        result.cleanupConfirmed !== true ||
        ![
          "commit_create_completed",
          "commit_create_existing_confirmed",
        ].includes(String(result.reason)) ||
        result.candidateCommit !== c.candidateCommit)
    )
      return false;
    if (
      c.phase === "merged" &&
      (result.status !== "completed" ||
        result.cleanupConfirmed !== true ||
        ![
          "commit_merge_completed",
          "commit_merge_existing_confirmed",
          "commit_merge_already_integrated",
        ].includes(String(result.reason)) ||
        result.candidateCommit !== c.candidateCommit ||
        (result.mergeCommit === null &&
          result.reason !== "commit_merge_already_integrated"))
    )
      return false;
  }
  return true;
}

export const COORDINATOR_INTEGRATION_CONTRACT =
  "crdd-coordinator/orchestrator-integration/v1" as const;

export const INTEGRATION_RECORD_IDENTITY =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/u;

export const INTEGRATION_BINDING_IDENTITY =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

const WORKSPACE_UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

const COMMIT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

/**
 * 説明用の一行名を検査する。
 * @responsibility 制御文字・空名・過大入力をMessageへ流さない。
 * @trace ARCH-000009
 * @input value: 任意表示名。
 * @returns 説明用として有効か。
 * @precondition N/A: 未検証値も受け付ける。
 * @postcondition Identity・認可判定は変えない。
 * @effect N/A: 値検査。
 * @failure 不正値はfalse。
 * @invariant nullは名前省略。
 * @boundary 同一Process。
 * @security Shell・Ref用の安全性を意味しない。
 * @concurrency N/A: 状態なし。
 */
export function validWorkspaceDisplayName(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.trim() === value &&
      value.length > 0 &&
      !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
  );
}

/**
 * 固定要求の閉じた値契約を保存前とGit発行前で共用する。
 * @responsibility 管理Path・重複・欠測と明示削除の混同を拒否する。
 * @trace ARCH-000009
 * @input value: 未検証JSON値。
 * @returns 固定要求として有効か。
 * @precondition N/A: 未検証値を受け付ける。
 * @postcondition 内容実測・認可・Git実体確認は別に残す。
 * @effect N/A: 値検査。
 * @failure 不正はfalse。
 * @invariant 形式成立をEffect許可にしない。
 * @boundary VC／既存Snapshot codec。
 * @security Directory・glob・管理Pathを拒否。
 * @concurrency N/A: 局所値だけ。
 */
export function validWorkspaceCandidateRequest(
  value: unknown,
): value is WorkspaceCandidateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).sort().join(",") !==
      "baseCommit,candidateName,expectedWorkspaceHead,operationId,relatedChangeIds,selection,workspaceId,workspaceName" ||
    typeof r.operationId !== "string" ||
    !WORKSPACE_UUID.test(r.operationId) ||
    typeof r.workspaceId !== "string" ||
    !WORKSPACE_UUID.test(r.workspaceId) ||
    typeof r.baseCommit !== "string" ||
    !COMMIT_ID.test(r.baseCommit) ||
    typeof r.expectedWorkspaceHead !== "string" ||
    !COMMIT_ID.test(r.expectedWorkspaceHead) ||
    r.baseCommit.length !== r.expectedWorkspaceHead.length ||
    !validWorkspaceDisplayName(r.workspaceName) ||
    !validWorkspaceDisplayName(r.candidateName) ||
    !Array.isArray(r.relatedChangeIds) ||
    r.relatedChangeIds.some(
      (id) => typeof id !== "string" || !/^CHG-\d{6}$/u.test(id),
    ) ||
    new Set(r.relatedChangeIds).size !== r.relatedChangeIds.length ||
    !Array.isArray(r.selection) ||
    r.selection.length < 1
  )
    return false;
  const selected = new Set<string>();
  for (const item of r.selection) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).sort().join(",") !== "blobId,mode,path" ||
      typeof item.path !== "string" ||
      item.path
        .split("/")
        .some(
          (segment: string) =>
            !segment ||
            segment === "." ||
            segment === ".." ||
            segment.trim() !== segment ||
            /[. ]$/u.test(segment) ||
            /^\.(?:git|crdd)$/iu.test(segment) ||
            /[\\:\x00-\x1f\x7f*?[\]]/u.test(segment),
        ) ||
      !(
        (item.blobId === null && item.mode === null) ||
        (typeof item.blobId === "string" &&
          COMMIT_ID.test(item.blobId) &&
          item.blobId.length === r.baseCommit.length &&
          ["100644", "100755"].includes(item.mode))
      )
    )
      return false;
    const key = item.path.toLowerCase();
    if (selected.has(key)) return false;
    selected.add(key);
  }
  return true;
}

/**
 * Workspaceの固定Commit ID文法を検査する。
 * @responsibility SHA-1／SHA-256の既存閉形式だけを判定する。
 * @trace ARCH-000004
 * @input value: 未信頼のCommit ID候補。
 * @returns 固定文法に一致する文字列だけtrue。
 * @precondition N/A: 任意値を拒否できる。
 * @postcondition 検査に使う可変実体を利用側へ返さない。
 * @effect N/A: 純粋な値検査。
 * @failure 不正値はfalse。
 * @invariant 文法一致からCommitの存在・採用・権限を推定しない。
 * @boundary Domainの値とVersion Controlの技術操作。
 * @security 正規表現の変更口を公開しない。
 * @concurrency N/A: 共有可変状態を更新しない。
 */
export function isWorkspaceCommitId(value: unknown): value is string {
  return typeof value === "string" && COMMIT_ID.test(value);
}
