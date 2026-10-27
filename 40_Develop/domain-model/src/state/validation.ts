/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { RuntimeStoredManagedProject } from "./types.ts";
import type { CoordinatorState } from "./types.ts";
import { decodeRuntimeStateBytes } from "./codec.ts";
import { validCoordinatorExecutionState } from "../attempt/validation.ts";
import type { ProjectResultAcceptance } from "../task/types.ts";
import { decodeProjectResultAcceptance } from "../task/validation.ts";
import type { CoordinatorStoredTask } from "./types.ts";
import type { ProjectTaskRecord } from "../task/types.ts";
import type { ProjectTaskRecoveryObligation } from "../task/types.ts";
import type { CoordinatorStateSnapshot } from "./types.ts";
import { encodeRuntimeStateValue } from "./codec.ts";
import { types } from "node:util";
import { isDockerRestartCheckpointSettled } from "../attempt/validation.ts";
import { coordinatorTaskResourcesAreSettled } from "../attempt/validation.ts";
import type { CoordinatorSnapshot } from "./types.ts";
import { validCoordinatorState } from "../task/validation.ts";
import { validQueueEntry } from "../task/validation.ts";
import { validCoordinatorWorkspace } from "../workspace/validation.ts";
import type { LeaseEvidenceEnvelope } from "./types.ts";
import { validCoordinatorResultRecord } from "../workspace/validation.ts";
import type { CoordinatorAcceptanceDecisionEnvelope } from "../decision/types.ts";
import { validCoordinatorAcceptanceDecisionEnvelope } from "../decision/validation.ts";
import { validCoordinatorDecisionRecoveryIntent } from "../decision/validation.ts";
import type { CoordinatorStateTaskOperation } from "../attempt/types.ts";
import { createHash } from "node:crypto";
import type { CoordinatorLeaseKind as LeaseKind } from "./types.ts";
import type { HistoryRow } from "./types.ts";
import { types as utilTypes } from "node:util";
import type { ProjectQueueEntry } from "../task/types.ts";
import type { SingleTaskRecord } from "../task/types.ts";
import type { ArraySnapshot } from "./types.ts";
import type {
  RuntimeDomainSnapshot,
  RuntimeProjectDefinition,
} from "./types.ts";
import {
  inspectExecutionPlanDefinition,
  inspectRuntimeProjectDefinition,
} from "../objective/validation.ts";
import { hashRuntimeStateContent } from "./codec.ts";

/**
 * 保存済みcheckpointから同じ終了履歴行を導出する。
 * @responsibility 要約・初回時刻とexact行Hashの共通符号化を履歴Writerへ渡す。
 * @trace ARCH-000008
 * @input currentBytes: 現在状態、recoveryId: 対象、repositoryBinding: 検証済み結合。
 * @returns 正規UTF-8行と末尾LF、またはnull。
 * @precondition 対象の要約と初回時刻がcheckpointへ固定済みである。
 * @postcondition 確認状態を行へ含めず、初回と確認済みで同じ本文を返す。
 * @effect N/A: メモリ内の検証と符号化だけ。
 * @failure 未固定、別対象、不正状態や行Hash不一致はnull。
 * @invariant 行の導出を物理保存、終端確認、削除許可にしない。
 * @boundary 現在状態の固定相関と履歴保存の値境界。
 * @security 任意の履歴本文、Path、秘密値を受けない。
 * @concurrency 保存と元版の再照合は物理Writerが所有する。
 */
export function prepareCoordinatorStateHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeRuntimeDomainSnapshot(currentBytes, repositoryBinding);
  const operation = current?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  if (!operation?.history) return null;
  const bytes = coordinatorHistoryLineBytes(
    operation,
    operation.history.occurredAt,
  );
  return createHash("sha256").update(bytes).digest("hex") ===
    operation.history.lineSha256
    ? bytes
    : null;
}

/**
 * 対象IDを含む計画定義だけの内容Hashを導出する。
 * @responsibility 判断状態・管理実行値を定義同一性から分離する。
 * @trace ARCH-000004
 * @input project: 検査済みCore Project。
 * @returns 対象と正規化定義へ結合したSHA-256。
 * @precondition 呼出し側がCore定義の値検査を完了している。
 * @postcondition 判断・Ownerの変化だけでは定義Hashを変更しない。
 * @effect N/A: 値のHash計算だけ。
 * @failure 通常データでない値は共通encoderが拒否する。
 * @invariant 対象IDを除いた本文だけのHashへ置換しない。
 * @boundary 同じSnapshot内の定義と管理実行参照。
 * @security Hashを操作許可として使用しない。
 * @concurrency N/A: 共有状態なし。
 */
export function hashRuntimeProjectDefinition(
  project: RuntimeProjectDefinition,
): string {
  return hashRuntimeStateContent({
    projectId: project.projectId,
    milestoneId: project.milestoneId,
    definition: {
      milestoneAcceptanceCriteria: project.milestone.acceptanceCriteria,
      objectives: project.objectives.map((objective) => objective.definition),
      tasks: project.tasks,
    },
  });
}

/**
 * Core定義と管理実行参照を分離した新形式だけを復号する。
 * @responsibility 完全な区画検査・単一定義・管理行の一対一参照と既存の終端相関を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input input: 正規byte列、repositoryBinding: 対象Repository結合。
 * @returns 正本、管理実行のメモリ投影、本文Hash。拒否時null。
 * @precondition N/A: 未信頼byte列を拒否可能。
 * @postcondition Coreのみの対象に架空のOwner・Selection・Taskを生成しない。
 * @effect N/A: 値検査・メモリ投影だけ。
 * @failure 旧Schema、欠測、重複、孤立、定義Hash差、技術相関差はnull。
 * @invariant 管理投影は保存正本ではなく、Task定義はprojectsだけに保存する。
 * @boundary 新Schemaのcodec。保存先切替・Writer確定とは別。
 * @security unknown・元参照を保ち、現在Authorityを復元しない。
 * @concurrency N/A: 同期の値検査。
 */
export function decodeRuntimeDomainSnapshot(
  input: unknown,
  repositoryBinding: unknown,
): Readonly<{
  snapshot: RuntimeDomainSnapshot;
  projects: readonly CoordinatorState[];
  payloadSha256: string;
}> | null {
  try {
    if (!isSha256Hex(repositoryBinding)) return null;
    const decoded = decodeRuntimeStateBytes(input);
    const value = decoded?.value;
    if (
      !decoded ||
      !exactRecordKeys(value, [
        "schema",
        "revision",
        "previous",
        "repositoryBinding",
        "operations",
        "unresolvedRecoveries",
        "pendingDeliveries",
        "repositoryBindingId",
        "intakeEpoch",
        "intakeBindings",
        "projects",
        "managedExecutions",
        "queueEntries",
        "workspaces",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "acceptanceDecisions",
        "decisionRecoveries",
        "resultReceipts",
      ])
    )
      return null;
    const snapshot = value as RuntimeDomainSnapshot;
    if (
      snapshot.schema !== "crdd-domain/runtime-state/v1" ||
      snapshot.repositoryBinding !== repositoryBinding ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 1 ||
      (snapshot.revision === 1
        ? snapshot.previous !== null
        : !exactRecordKeys(snapshot.previous, ["revision", "payloadSha256"]) ||
          snapshot.previous?.revision !== snapshot.revision - 1 ||
          !isSha256Hex(snapshot.previous?.payloadSha256)) ||
      !validCoordinatorExecutionState(snapshot, repositoryBinding) ||
      !Array.isArray(snapshot.pendingDeliveries) ||
      !snapshot.pendingDeliveries.every((delivery) =>
        exactRecordKeys(delivery, [
          "operationNonce",
          "recoveryId",
          "resultId",
          "consumer",
        ]),
      ) ||
      !Array.isArray(snapshot.projects) ||
      !Array.isArray(snapshot.managedExecutions) ||
      !Array.isArray(snapshot.resultReceipts)
    )
      return null;
    const definitions: RuntimeProjectDefinition[] = [];
    for (const raw of snapshot.projects) {
      const definition = inspectRuntimeProjectDefinition(raw);
      if (
        !definition ||
        definitions.some((item) => item.projectId === definition.projectId)
      )
        return null;
      definitions.push(definition);
    }
    if (
      snapshot.repositoryBindingId === null &&
      (definitions.length > 0 || snapshot.managedExecutions.length > 0)
    )
      return null;
    const projects: RuntimeStoredManagedProject[] = [];
    const seen = new Set<string>();
    for (const execution of snapshot.managedExecutions) {
      if (
        !exactRecordKeys(execution, [
          "projectId",
          "milestoneId",
          "definitionHash",
          "taskExecutionSelections",
          "ownerGeneration",
          "maximumConcurrency",
          "tasks",
        ]) ||
        seen.has(execution.projectId) ||
        !Array.isArray(execution.tasks)
      )
        return null;
      const definition = definitions.find(
        (item) =>
          item.projectId === execution.projectId &&
          item.milestoneId === execution.milestoneId,
      );
      if (
        !definition ||
        !inspectExecutionPlanDefinition({
          milestoneAcceptanceCriteria: definition.milestone.acceptanceCriteria,
          objectives: definition.objectives.map(
            (objective) => objective.definition,
          ),
          tasks: definition.tasks,
        }) ||
        execution.definitionHash !== hashRuntimeProjectDefinition(definition) ||
        execution.tasks.length !== definition.tasks.length
      )
        return null;
      const taskIds = new Set<string>();
      const tasks: CoordinatorStoredTask[] = [];
      for (const task of execution.tasks) {
        if (
          !exactRecordKeys(task, [
            "taskId",
            "state",
            "attemptId",
            "operationId",
            "authorityBindingId",
            "startPhase",
            "settlement",
            "recoveryObligations",
            "resultAcceptanceIds",
            "candidateId",
            "retryCount",
            "supersededBy",
          ]) ||
          taskIds.has(task.taskId)
        )
          return null;
        const taskDefinition = definition.tasks.find(
          (item) => item.id === task.taskId,
        );
        if (!taskDefinition) return null;
        if (definition.tasks[tasks.length]?.id !== task.taskId) return null;
        taskIds.add(task.taskId);
        const { taskId: _taskId, ...record } = task;
        tasks.push(Object.freeze({ ...record, definition: taskDefinition }));
      }
      seen.add(execution.projectId);
      const { contract: _contract, tasks: _definitions, ...core } = definition;
      projects.push(
        Object.freeze({
          ...core,
          contract: "crdd-coordinator/project-state/v2",
          taskExecutionSelections: execution.taskExecutionSelections,
          ownerGeneration: execution.ownerGeneration,
          maximumConcurrency: execution.maximumConcurrency,
          tasks: Object.freeze(tasks),
        }),
      );
    }
    const projection = projectRuntimeSnapshotSections(
      snapshot,
      Object.freeze(projects),
      repositoryBinding,
      decoded.payloadSha256,
      definitions,
    );
    return projection
      ? Object.freeze({
          snapshot,
          projects: projection.projects,
          payloadSha256: decoded.payloadSha256,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * この保存モデルが受け取るSHA-256文字列を検査する。
 * @responsibility 一般Helperを公開せず、保存値の固定文法だけを検査する。
 * @trace ARCH-000008
 * @input value: 未信頼値。
 * @returns 小文字64桁hexの場合だけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態や外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 同一モデル内の値検査だけ。
 * @security Hash文法の一致から回復資格や真正性を推定しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * 記録 Keysが完全一致するか判定する。
 *
 * @responsibility 記録 Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、keys: readonly string[]
 * @returns exactRecordKeysの計算結果を返す。
 * @precondition 「value: unknown、keys: readonly string[]」がexactRecordKeysの入力契約を満たす。
 * @postcondition exactRecordKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactRecordKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactRecordKeysは独自の失敗分岐を所有しない。
 * @invariant exactRecordKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactRecordKeysはProcess内の同一Subsystemで完結する。
 * @security exactRecordKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactRecordKeysは共有非同期状態を持たない同期処理である。
 */
export function exactRecordKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

/**
 * Task固有の元事実と参照した技術記録から状態を投影する。
 * @responsibility cleanupと結果不明を別に導出し、欠落参照を成功へ畳まない。
 * @trace ARCH-000004、ARCH-000008
 * @input input: Task境界の元事実、snapshot: codecで検証済みの技術現在区画。
 * @returns 二つの公開状態、又は元事実・参照が不正な場合のnull。
 * @precondition 呼出し元がTask／Attemptと参照集合の結合を検証する。
 * @postcondition OperationのないExecutorの観測とDockerの資源観測を混同しない。
 * @effect N/A: メモリ内の同期投影だけ。
 * @failure 未知kind、欠落・重複・別種の回復参照はnull。
 * @invariant 参照中Operationを履歴だけへ移した状態を受理しない。
 * @boundary 単一保存codecの内部値と既存Task状態。
 * @security 保存値だけで実資源を観測したとは扱わない。
 * @concurrency N/A: Writer、Lock、外部Readerを呼び出さない。
 */
export function projectCoordinatorTaskSettlement(
  input: unknown,
  snapshot: Pick<
    CoordinatorStateSnapshot,
    "operations" | "unresolvedRecoveries"
  >,
): Readonly<{ cleanupConfirmed: boolean; recoveryUnresolved: boolean }> | null {
  try {
    const fact: unknown = JSON.parse(encodeRuntimeStateValue(input));
    if (!plainObject(fact) || types.isProxy(fact)) return null;
    if (fact.kind === "pending" || fact.kind === "unissued") {
      if (!exactKeys(fact, ["kind"])) return null;
      return Object.freeze({
        cleanupConfirmed: fact.kind === "unissued",
        recoveryUnresolved: false,
      });
    }
    if (fact.kind === "executor_result") {
      if (
        !exactKeys(fact, ["kind", "cleanupConfirmed", "recoveryUnresolved"]) ||
        typeof fact.cleanupConfirmed !== "boolean" ||
        typeof fact.recoveryUnresolved !== "boolean"
      )
        return null;
      return Object.freeze({
        cleanupConfirmed: fact.cleanupConfirmed,
        recoveryUnresolved: fact.recoveryUnresolved,
      });
    }
    if (
      fact.kind !== "operations" ||
      !exactKeys(fact, ["kind", "recoveryIds", "resultUnresolved"]) ||
      typeof fact.resultUnresolved !== "boolean" ||
      !Array.isArray(fact.recoveryIds) ||
      fact.recoveryIds.length === 0 ||
      fact.recoveryIds.length > 128 ||
      !fact.recoveryIds.every((id) => typeof id === "string") ||
      new Set(fact.recoveryIds).size !== fact.recoveryIds.length
    )
      return null;
    const recoveryIds = fact.recoveryIds as readonly string[];
    const operations = recoveryIds.map((id) =>
      snapshot.operations.find((operation) => operation.recoveryId === id),
    );
    if (operations.some((operation) => operation?.kind !== "docker_task"))
      return null;
    return Object.freeze({
      cleanupConfirmed:
        !fact.resultUnresolved &&
        operations.every(
          (operation) =>
            operation?.kind === "docker_task" &&
            operation.phase !== "executing" &&
            operation.outcome?.cleanupConfirmed === true &&
            operation.host.cleanup === "confirmed" &&
            operation.host.pendingTransitionJson === null &&
            operation.lease === "released" &&
            operation.execution.ownerEffect === "disabled" &&
            (operation.dockerRestart === null ||
              isDockerRestartCheckpointSettled(operation.dockerRestart)) &&
            coordinatorTaskResourcesAreSettled(operation),
        ),
      recoveryUnresolved: fact.resultUnresolved,
    });
  } catch {
    return null;
  }
}

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security validIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
export function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/**
 * Task現在区画を保存改訂と物理Envelopeから独立して検証する。
 * @responsibility Task、Queue、Workspace、Lease、判断、統合結果と履歴参照の相関を所有する。
 * @trace ARCH-000004
 * @input snapshot: 復号済み現在区画、binding: 期待する業務Repository結合。
 * @returns 全区画と相互参照が有効な場合だけtrue。
 * @precondition JSON入力とRoot情報は呼出し側で検証する。
 * @postcondition 旧形式の欠落を補完せず、孤立した参照を拒否する。
 * @effect N/A: 同期の値検査だけ。
 * @failure 不正構造と相関不一致はfalse。
 * @invariant 業務世代、受付世代と保存改訂を混同しない。
 * @boundary 保存EnvelopeとTask現在モデル。
 * @security 記録から実効LeaseやAuthorityを復元しない。
 * @concurrency N/A: 保存・排他取得を行わない。
 */
export function validCoordinatorTaskState(
  snapshot: Omit<
    CoordinatorSnapshot,
    "schema" | "schemaRevision" | "repositoryRootHash" | "snapshotRevision"
  >,
  binding: string,
): boolean {
  if (
    !Array.isArray(snapshot.projects) ||
    !snapshot.projects.every(validCoordinatorState)
  )
    return false;
  return validRuntimeTaskReferences(snapshot, binding);
}

/**
 * 定義の存在と受付・判断・Lease等の共通参照を同じSnapshotで検査する。
 * @responsibility CoreのみのProjectも正本の対象集合へ含め、技術状態を補完しない。
 * @trace ARCH-000004、ARCH-000008
 * @input snapshot: 個別モデルの検査後の共通区画、binding: Repository結合。
 * @returns 参照相関をすべて満たす場合true。
 * @precondition 区画は正規JSONの復号結果であり、Project値は呼出し側が検査済み。
 * @postcondition 定義対象の不存在と不正な参照を区別せず成功へ補完しない。
 * @effect N/A: 値検査だけ。
 * @failure 不正・重複・孤立参照はfalse。
 * @invariant Projectの値検査は呼出し側のCore／管理実行Ownerが行う。
 * @boundary 定義と管理実行の共通保存内参照。
 * @security 記録を現在の権限や実資源不存在の証拠にしない。
 * @concurrency N/A: 同期の局所処理。
 */
function validRuntimeTaskReferences(
  snapshot: Omit<
    CoordinatorSnapshot,
    | "schema"
    | "schemaRevision"
    | "repositoryRootHash"
    | "snapshotRevision"
    | "projects"
  > &
    Readonly<{ projects: readonly Readonly<{ projectId: string }>[] }>,
  binding: string,
): boolean {
  for (const key of [
    "intakeBindings",
    "projects",
    "queueEntries",
    "leaseEvidence",
    "leaseIntents",
    "results",
    "historyPending",
  ] as const)
    if (!Array.isArray(snapshot[key])) return false;
  if (!(snapshot.queueEntries as unknown[]).every(validQueueEntry))
    return false;
  if (
    !Array.isArray(snapshot.workspaces) ||
    !snapshot.workspaces.every(validCoordinatorWorkspace) ||
    new Set(snapshot.workspaces.map((item) => item.workspaceId)).size !==
      snapshot.workspaces.length
  )
    return false;
  if (
    snapshot.queueEntries.some(
      (entry) =>
        entry.workspaceId != null &&
        !snapshot.workspaces.some(
          (workspace) => workspace.workspaceId === entry.workspaceId,
        ),
    )
  )
    return false;
  const projects = new Set(snapshot.projects.map((item) => item.projectId));
  const queues = new Map(
    snapshot.queueEntries.map((item) => [item.queueId, item]),
  );
  if (
    projects.size !== snapshot.projects.length ||
    queues.size !== snapshot.queueEntries.length ||
    snapshot.queueEntries.some(
      (item) => !item.singleTask && !projects.has(item.projectId),
    )
  )
    return false;
  const intake = new Set<string>();
  for (const item of snapshot.intakeBindings) {
    if (
      !plainObject(item) ||
      !exactKeys(item, ["queueId", "epoch"]) ||
      !validId(item.epoch) ||
      !queues.has(item.queueId) ||
      intake.has(item.queueId)
    )
      return false;
    intake.add(item.queueId);
  }
  if (intake.size !== queues.size) return false;
  const evidenceGroups = new Map<string, LeaseEvidenceEnvelope[]>();
  for (const record of snapshot.leaseEvidence) {
    if (
      !plainObject(record) ||
      !exactKeys(record, [
        "schema",
        "schemaRevision",
        "recordKind",
        "repositoryBindingId",
        "projectId",
        "createdGeneration",
        "updatedGeneration",
        "contentHash",
        "content",
      ]) ||
      record.schema !== COORDINATOR_DURABLE_FOUNDATION_CONTRACT ||
      record.schemaRevision !== 1 ||
      record.recordKind !== "lease-evidence" ||
      record.repositoryBindingId !== binding ||
      !validId(record.projectId) ||
      !validLeaseEvidence(record.content) ||
      record.createdGeneration !== 1 ||
      record.updatedGeneration !==
        (record.content.disposition === "acquired" ? 1 : 2) ||
      record.contentHash !== digest(encodeRuntimeStateValue(record.content)) ||
      !(record.content.kind === "canonical-adoption"
        ? record.content.queueId === "canonical"
        : queues.get(record.content.queueId)?.projectId === record.projectId)
    )
      return false;
    const key = `${leaseIdentity(binding, record.projectId, record.content.queueId, record.content.kind)}\0${record.content.ownerGeneration}`;
    const groups = evidenceGroups.get(key) ?? [];
    groups.push(record);
    evidenceGroups.set(key, groups);
  }
  for (const groups of evidenceGroups.values()) {
    const acquired = groups.find(
      (item) => item.content.disposition === "acquired",
    );
    if (
      (!acquired &&
        !(
          groups.length === 1 &&
          groups[0]?.content.disposition === "acquisition_unknown_closed"
        )) ||
      groups.length > 2 ||
      new Set(groups.map((item) => item.content.disposition)).size !==
        groups.length ||
      groups.some(
        (item) =>
          item.projectId !== groups[0]?.projectId ||
          item.content.queueId !== groups[0]?.content.queueId ||
          item.content.ownerProcessId !== groups[0]?.content.ownerProcessId ||
          (acquired &&
            item.content.disposition === "acquisition_unknown_closed"),
      )
    )
      return false;
  }
  const intents = new Set<string>();
  const intentOwners = new Map<string, string>();
  for (const item of snapshot.leaseIntents) {
    if (
      !plainObject(item) ||
      !exactKeys(item, [
        "projectId",
        "queueId",
        "kind",
        "ownerGeneration",
        "ownerProcessId",
        "recoveryId",
        "phase",
        "physicalIdentity",
      ]) ||
      !validId(item.projectId) ||
      !(item.kind === "canonical-adoption"
        ? item.queueId === "canonical"
        : queues.get(item.queueId)?.projectId === item.projectId) ||
      (item.kind !== "project-operation" &&
        item.kind !== "canonical-adoption") ||
      !validId(item.ownerGeneration) ||
      !Number.isSafeInteger(item.ownerProcessId) ||
      item.ownerProcessId < 1 ||
      item.recoveryId !==
        leaseAcquisitionRecoveryId(
          binding,
          item.projectId,
          item.queueId,
          item.kind,
        ) ||
      ![
        "acquisition_pending",
        "acquisition_reserved",
        "lock_owned",
        "release_pending",
        "recovery_pending",
      ].includes(item.phase)
    )
      return false;
    if (
      !(
        ((item.phase === "acquisition_pending" ||
          item.phase === "acquisition_reserved" ||
          item.phase === "recovery_pending") &&
          item.physicalIdentity === null) ||
        (item.phase !== "acquisition_pending" &&
          item.phase !== "acquisition_reserved" &&
          typeof item.physicalIdentity === "string" &&
          HASH.test(item.physicalIdentity))
      )
    )
      return false;
    const key = `${leaseIdentity(binding, item.projectId, item.queueId, item.kind)}\0${item.ownerGeneration}\0${item.phase}`;
    const leaseKey = leaseIdentity(
      binding,
      item.projectId,
      item.queueId,
      item.kind,
    );
    const ownerKey = `${item.ownerGeneration}\0${item.ownerProcessId}\0${item.queueId}\0${item.projectId}`;
    const evidence = evidenceGroups.get(`${leaseKey}\0${item.ownerGeneration}`);
    if (
      evidence?.some(
        (record) =>
          record.projectId !== item.projectId ||
          record.content.queueId !== item.queueId ||
          record.content.ownerProcessId !== item.ownerProcessId,
      )
    )
      return false;
    if (intentOwners.has(leaseKey) && intentOwners.get(leaseKey) !== ownerKey)
      return false;
    intentOwners.set(leaseKey, ownerKey);
    if (intents.has(key)) return false;
    intents.add(key);
  }
  const results = new Set<string>();
  for (const item of snapshot.results) {
    if (
      !validCoordinatorResultRecord(item) ||
      item.repositoryBindingId !== binding ||
      (queues.has(item.queueId) &&
        (queues.get(item.queueId)?.projectId !== item.projectId ||
          queues.get(item.queueId)?.milestoneId !== item.milestoneId))
    )
      return false;
    const key = `${item.kind}\0${item.projectId}\0${item.identity}`;
    if (results.has(key)) return false;
    results.add(key);
  }
  const history = new Set<string>();
  for (const item of snapshot.historyPending) {
    historyRow(item, Date.now());
    if (history.has(item.id)) return false;
    history.add(item.id);
  }
  {
    for (const groups of evidenceGroups.values()) {
      const acquired = groups.find(
        (item) => item.content.disposition === "acquired",
      );
      if (
        groups.length === 1 &&
        acquired &&
        !snapshot.leaseIntents.some(
          (item) =>
            item.projectId === acquired.projectId &&
            item.queueId === acquired.content.queueId &&
            item.kind === acquired.content.kind &&
            item.ownerGeneration === acquired.content.ownerGeneration &&
            item.ownerProcessId === acquired.content.ownerProcessId &&
            item.phase === "lock_owned",
        )
      )
        return false;
    }
    if (
      !Array.isArray(snapshot.acceptanceDecisions) ||
      !Array.isArray(snapshot.decisionRecoveries)
    )
      return false;
    const decisions = new Map<
      string,
      CoordinatorAcceptanceDecisionEnvelope[]
    >();
    for (const item of snapshot.acceptanceDecisions) {
      if (
        !plainObject(item) ||
        !exactKeys(item, [
          "contract",
          "repositoryBindingId",
          "recordId",
          "generation",
          "previousHash",
          "record",
        ]) ||
        !validId(item.recordId) ||
        !validCoordinatorAcceptanceDecisionEnvelope(
          item,
          binding,
          item.recordId,
        ) ||
        !plainObject(item.record) ||
        !exactKeys(item.record, [
          "recordId",
          "decisionId",
          "sourceSpecId",
          "projectId",
          "milestoneId",
          "repositoryRevision",
          "expectedGeneration",
          "target",
          "targetId",
          "decision",
          "criterionEvidenceIds",
          "principalId",
          "disposition",
          "newGeneration",
        ]) ||
        !projects.has(item.record.projectId)
      )
        return false;
      const groups = decisions.get(item.recordId) ?? [];
      groups.push(item);
      decisions.set(item.recordId, groups);
    }
    for (const groups of decisions.values()) {
      const first = groups.find((item) => item.generation === 1);
      const second = groups.find((item) => item.generation === 2);
      if (
        !first ||
        groups.length > 2 ||
        new Set(groups.map((item) => item.generation)).size !== groups.length ||
        (second &&
          second.previousHash !== digest(encodeRuntimeStateValue(first)))
      )
        return false;
    }
    const recoveries = new Set<string>();
    for (const item of snapshot.decisionRecoveries) {
      if (
        !plainObject(item) ||
        !exactKeys(item, ["generation", "value"]) ||
        !Number.isSafeInteger(item.generation) ||
        Number(item.generation) < 1 ||
        !validCoordinatorDecisionRecoveryIntent(item.value) ||
        !plainObject(item.value) ||
        !exactKeys(item.value, [
          "recoveryId",
          "recordId",
          "projectId",
          "milestoneId",
          "queueId",
          "applicationId",
          "expectedGeneration",
          "newGeneration",
          "observedDisposition",
          "unknownBoundary",
          "disposition",
        ]) ||
        queues.get(item.value.queueId)?.projectId !== item.value.projectId ||
        queues.get(item.value.queueId)?.milestoneId !==
          item.value.milestoneId ||
        recoveries.has(item.value.recoveryId)
      )
        return false;
      recoveries.add(item.value.recoveryId);
    }
  }
  return true;
}

export const COORDINATOR_STATE_CONTRACT =
  "crdd-coordinator/project-state/v2" as const;

/**
 * CoordinatorのTaskと技術実行を閉じた保存形式として検証する。
 * @responsibility Task・Queue・Workspaceと固定操作情報、現在資源、未解決回復、受領、履歴の構造・相関を所有する。
 * @trace ARCH-000004、ARCH-000008
 */

export const COORDINATOR_STATE_SCHEMA = "crdd-domain/runtime-state/v1";

/**
 * 検証済み操作の要約本文を一意に符号化する。
 * @responsibility 内容Hashと履歴行Hashの共通の内容投影を所有する。
 * @trace ARCH-000008
 * @input operation: 復号済み操作。
 * @returns 正規UTF-8本文と末尾LF。
 * @precondition 呼出し元が操作構造を検証する。
 * @postcondition history確認情報とPathを本文へ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正JSON値は例外。
 * @invariant 確認済み更新で履歴行の内容を変えない。
 * @boundary 現在状態と要約内容。
 * @security 非Authorityの内容だけを返す。
 * @concurrency N/A: 保存を行わない。
 */
export function coordinatorOperationSummaryBytes(
  operation: CoordinatorStateTaskOperation,
): Buffer {
  const identity = JSON.parse(operation.identityJson);
  const legacy = (schema: string) => ({
    schema,
    ...(operation.dockerRestart === null
      ? {}
      : { dockerRestart: operation.dockerRestart }),
    operationId: identity.operationId,
    operationNonce: identity.operationNonce,
    recoveryId: operation.recoveryId,
    identitySha256: operation.identitySha256,
    primaryFailure: operation.primaryFailure,
    execution: operation.execution,
    outcome: operation.outcome,
    hostCleanup: operation.host.cleanup,
    lease: operation.lease,
  });
  const oldBytes = Buffer.from(
    `${encodeRuntimeStateValue(legacy(operation.dockerRestart === null ? "crdd-coordinator/operation-summary/v2" : "crdd-coordinator/operation-summary/v3"))}\n`,
  );
  if (
    (identity.consumer !== "workbench" &&
      identity.consumer !== "coordinator_cli") ||
    typeof identity.recoveryCorrelationId !== "string"
  )
    return oldBytes;
  if (
    operation.summarySha256 !== null &&
    createHash("sha256").update(oldBytes).digest("hex") ===
      operation.summarySha256
  )
    return oldBytes;
  return Buffer.from(
    `${encodeRuntimeStateValue({
      schema: "crdd-coordinator/operation-summary/v4",
      consumer: identity.consumer,
      recoveryCorrelationId: identity.recoveryCorrelationId ?? null,
      ...(operation.dockerRestart === null
        ? {}
        : { dockerRestart: operation.dockerRestart }),
      operationId: identity.operationId,
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      identitySha256: operation.identitySha256,
      primaryFailure: operation.primaryFailure,
      execution: operation.execution,
      outcome: operation.outcome,
      hostCleanup: operation.host.cleanup,
      lease: operation.lease,
    })}\n`,
  );
}

/**
 * 固定した要約時刻を含む履歴行を符号化する。
 * @responsibility 確認状態を除外したexact行Identityを所有する。
 * @trace ARCH-000008
 * @input operation: 検証済み操作、occurredAt: 最初の正規UTC時刻。
 * @returns 履歴行の正規本文。
 * @precondition 時刻と操作内容を呼出し元で確認する。
 * @postcondition confirmedを行Hashへ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正内容は例外。
 * @invariant 再入場の現在時刻で行を再生成しない。
 * @boundary 操作の終了要約と時刻込み履歴行。
 * @security 生出力やPathを追加しない。
 * @concurrency N/A: 保存を行わない。
 */
export function coordinatorHistoryLineBytes(
  operation: CoordinatorStateTaskOperation,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeRuntimeStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(
        coordinatorOperationSummaryBytes(operation).toString("utf8"),
      ),
    })}\n`,
  );
}

/**
 * Plain 記録を所有Snapshotへ変換する。
 *
 * @responsibility Plain 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、expectedKeys: ReadonlySet<K>
 * @returns Readonly<Record<K, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedKeys: ReadonlySet<K>」がsnapshotPlainRecordの入力契約を満たす。
 * @postcondition snapshotPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotPlainRecordは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  expectedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== expectedKeys.size ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * ObjectをPlain Dataとして検証する。
 *
 * @responsibility Objectの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がplainObjectの入力契約を満たす。
 * @postcondition plainObjectの責務を完了した結果だけを返す。
 * @effect N/A: plainObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainObjectは独自の失敗分岐を所有しない。
 * @invariant plainObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainObjectはProcess内の同一Subsystemで完結する。
 * @security plainObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: plainObjectは共有非同期状態を持たない同期処理である。
 */
export function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: object、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: object、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
export function exactKeys(value: object, keys: readonly string[]) {
  const actualValues = Object.keys(value).sort();
  const expectedValues = [...keys].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((key, index) => key === expectedValues[index])
  );
}

export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export const COORDINATOR_DURABLE_FOUNDATION_CONTRACT =
  "crdd-coordinator/orchestrator-durable-foundation/v1" as const;

/**
 * Lease Evidenceが有効か判定する。
 *
 * @responsibility Lease Evidenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validLeaseEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がvalidLeaseEvidenceの入力契約を満たす。
 * @postcondition validLeaseEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validLeaseEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validLeaseEvidenceは独自の失敗分岐を所有しない。
 * @invariant validLeaseEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validLeaseEvidenceはProcess内の同一Subsystemで完結する。
 * @security validLeaseEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validLeaseEvidenceは共有非同期状態を持たない同期処理である。
 */
export function validLeaseEvidence(value: unknown) {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "disposition",
    ]) &&
    (value.kind === "project-operation" ||
      value.kind === "canonical-adoption") &&
    validId(value.queueId) &&
    validId(value.ownerGeneration) &&
    Number.isSafeInteger(value.ownerProcessId) &&
    Number(value.ownerProcessId) > 0 &&
    (value.disposition === "acquired" ||
      value.disposition === "released" ||
      value.disposition === "recovered_after_owner_loss" ||
      value.disposition === "acquisition_unknown_closed")
  );
}

/**
 * durable-foundationのHashを算出する。
 *
 * @responsibility durable-foundationの入力byte列、Hash algorithm、算出結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns digestの計算結果を返す。
 * @precondition 「value: string」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: digestはProcess内の同一Subsystemで完結する。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
export function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * lease Identityを決定する。
 *
 * @responsibility lease Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseIdentityの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseIdentityの入力契約を満たす。
 * @postcondition leaseIdentityの責務を完了した結果だけを返す。
 * @effect N/A: leaseIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseIdentityは独自の失敗分岐を所有しない。
 * @invariant leaseIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseIdentityはProcess内の同一Subsystemで完結する。
 * @security leaseIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseIdentityは共有非同期状態を持たない同期処理である。
 */
export function leaseIdentity(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  return kind === "project-operation"
    ? `${kind}-${repositoryBindingId}`
    : kind === "canonical-adoption"
      ? `${kind}-${repositoryBindingId}-${projectId}`
      : `${kind}-${projectId}-${queueId}`;
}

/**
 * lease Acquisition 回復 Idを決定する。
 *
 * @responsibility lease Acquisition 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseAcquisitionRecoveryIdの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseAcquisitionRecoveryIdの入力契約を満たす。
 * @postcondition leaseAcquisitionRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function leaseAcquisitionRecoveryId(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  const identityInput =
    kind === "project-operation"
      ? `${repositoryBindingId}\0${kind}`
      : kind === "canonical-adoption"
        ? `${repositoryBindingId}\0${projectId}\0${kind}`
        : `${repositoryBindingId}\0${projectId}\0${queueId}\0${kind}`;
  return `lease-acquisition-${digest(identityInput).slice(0, 40)}`;
}

export const HASH = /^[0-9a-f]{64}$/u;

/**
 * 終了要約を固定順序へ検証する。
 *
 * @responsibility 保存可能な分類だけを受け入れる。
 * @trace ARCH-000004
 * @input JSON値と現在時刻。
 * @returns 閉じた終了要約。
 * @precondition 入力はJSON由来。
 * @postcondition ID、時刻、分類を検証済み。
 * @effect N/A: 局所値のみ。
 * @failure 許可外値で例外。
 * @invariant 未解決義務を履歴へ移さない。
 * @boundary 終了要約入力。
 * @security 自由記述や秘密値を拒否する。
 * @concurrency N/A: 同期判定。
 */
export function historyRow(value: unknown, now: number): HistoryRow {
  const row = closedObject(value, [
    "id",
    "occurredAt",
    "outcome",
    "primaryFailure",
    "cleanup",
  ]);
  if (typeof row.id !== "string" || !ID.test(row.id)) throw new Error("id");
  if (
    row.outcome !== "completed" &&
    row.outcome !== "failed" &&
    row.outcome !== "cancelled"
  )
    throw new Error("outcome");
  if (
    row.primaryFailure !== null &&
    row.primaryFailure !== "execution" &&
    row.primaryFailure !== "storage" &&
    row.primaryFailure !== "delivery" &&
    row.primaryFailure !== "cleanup" &&
    row.primaryFailure !== "cancel"
  )
    throw new Error("failure");
  if (
    row.cleanup !== "confirmed" &&
    row.cleanup !== "unknown" &&
    row.cleanup !== "not_required"
  )
    throw new Error("cleanup");
  return {
    id: row.id,
    occurredAt: timestamp(row.occurredAt, now),
    outcome: row.outcome,
    primaryFailure: row.primaryFailure,
    cleanup: row.cleanup,
  };
}

export const COORDINATOR_PROJECT_SNAPSHOT_SCHEMA =
  "crdd-coordinator/project-snapshot/v5";

/**
 * Plain 記録かを判定する。
 *
 * @responsibility Plain 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainRecordの入力契約を満たす。
 * @postcondition isPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: isPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isPlainRecordは共有非同期状態を持たない同期処理である。
 */
export function isPlainRecord(value: unknown): value is object {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Data Descriptorかを判定する。
 *
 * @responsibility Data Descriptorの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input descriptor: PropertyDescriptor | undefined、shouldBeEnumerable
 * @returns descriptor is PropertyDescriptor & { value: unknown }を返す。
 * @precondition 「descriptor: PropertyDescriptor | undefined、shouldBeEnumerable」がisDataDescriptorの入力契約を満たす。
 * @postcondition isDataDescriptorの責務を完了した結果だけを返す。
 * @effect N/A: isDataDescriptorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDataDescriptorは独自の失敗分岐を所有しない。
 * @invariant isDataDescriptorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDataDescriptorはProcess内の同一Subsystemで完結する。
 * @security N/A: isDataDescriptorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDataDescriptorは共有非同期状態を持たない同期処理である。
 */
export function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(
    descriptor !== undefined &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

export const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * nullable Idを決定する。
 *
 * @responsibility nullable Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableIdの入力契約を満たす。
 * @postcondition nullableIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableIdは独自の失敗分岐を所有しない。
 * @invariant nullableIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableIdはProcess内の同一Subsystemで完結する。
 * @security nullableIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableIdは共有非同期状態を持たない同期処理である。
 */
export function nullableId(value: unknown) {
  return value === null || validId(value);
}

/**
 * string Arrayを決定する。
 *
 * @responsibility string Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum
 * @returns value is readonly string[]を返す。
 * @precondition 「value: unknown、maximum」がstringArrayの入力契約を満たす。
 * @postcondition stringArrayの責務を完了した結果だけを返す。
 * @effect N/A: stringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringArrayは独自の失敗分岐を所有しない。
 * @invariant stringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringArrayはProcess内の同一Subsystemで完結する。
 * @security stringArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stringArrayは共有非同期状態を持たない同期処理である。
 */
export function stringArray(
  value: unknown,
  maximum = 128,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (item) =>
        typeof item === "string" && item.length > 0 && item.length <= 512,
    )
  );
}

/**
 * nullable 候補 Idを決定する。
 *
 * @responsibility nullable 候補 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableCandidateIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableCandidateIdの入力契約を満たす。
 * @postcondition nullableCandidateIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableCandidateIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableCandidateIdは独自の失敗分岐を所有しない。
 * @invariant nullableCandidateIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableCandidateIdはProcess内の同一Subsystemで完結する。
 * @security nullableCandidateIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableCandidateIdは共有非同期状態を持たない同期処理である。
 */
export function nullableCandidateId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * 単発記録とQueueの共同状態を確認する。
 * @responsibility 未回収の完了表示と段階混同をcodecで拒否する。
 * @trace ARCH-000004
 * @input JSONから確認したQueueと単発記録。
 * @returns 共同状態が成立する場合のみtrue。
 * @precondition 単発記録の閉検査が成功している。
 * @postcondition Owner喪失を成功へ変換しない。
 * @effect なし。
 * @failure 不整合はfalse。
 * @invariant Project計画用Queueへ適用しない。
 * @boundary 既存Snapshot codec。
 * @security 状態名から実資源の不存在を推定しない。
 * @concurrency 同期値検査。
 */
export function singleTaskQueueIsConsistent(
  queue: Pick<
    ProjectQueueEntry,
    "state" | "ownerGeneration" | "resumeCondition" | "resultReference"
  >,
  record: SingleTaskRecord,
): boolean {
  if (
    queue.state === "recovery_required" &&
    queue.ownerGeneration === null &&
    ["owner_loss", "exact_recovery"].includes(queue.resumeCondition ?? "") &&
    record.phase !== "settled"
  )
    return true;
  if (record.phase === "accepted")
    return (
      queue.state === "queued" &&
      queue.ownerGeneration === null &&
      queue.resumeCondition === null &&
      queue.resultReference === null
    );
  if (record.phase !== "settled")
    return (
      queue.state === "running" &&
      queue.ownerGeneration !== null &&
      queue.resumeCondition === null
    );
  if (!record.cleanupConfirmed || record.recoveryIds.length > 0)
    return queue.state === "recovery_required";
  return (
    queue.state ===
      (record.status === "cancelled" ? "cancelled" : "completed") &&
    queue.resumeCondition === null
  );
}

/**
 * nullable 結果 Referenceを決定する。
 *
 * @responsibility nullable 結果 Referenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableResultReferenceの計算結果を返す。
 * @precondition 「value: unknown」がnullableResultReferenceの入力契約を満たす。
 * @postcondition nullableResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: nullableResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableResultReferenceは独自の失敗分岐を所有しない。
 * @invariant nullableResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableResultReferenceはProcess内の同一Subsystemで完結する。
 * @security nullableResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableResultReferenceは共有非同期状態を持たない同期処理である。
 */
export function nullableResultReference(value: unknown) {
  return value === null || validResultReference(value);
}

/**
 * JSONの閉じたProperty集合を確認する。
 *
 * @responsibility 未知のPropertyや配列を拒否する。
 * @trace ARCH-000004
 * @input 未検証値と許可Key。
 * @returns 閉じたObject。
 * @precondition JSONから得た値。
 * @postcondition Keyの過不足を拒否済み。
 * @effect N/A: 局所値のみ。
 * @failure 不正shapeで例外。
 * @invariant 未知値を既知へ畳まない。
 * @boundary JSON入力。
 * @security 許可外情報を保存しない。
 * @concurrency N/A: 同期判定。
 */
export function closedObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("shape");
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify([...keys].sort()))
    throw new Error("keys");
  return record;
}

/**
 * UTC時刻を検証する。
 *
 * @responsibility 不正値と未来時刻を拒否する。
 * @trace ARCH-000004
 * @input ISO時刻と現在時刻。
 * @returns 検証済みISO時刻。
 * @precondition 現在時刻は安全な整数。
 * @postcondition 正規UTC表現で未来ではない。
 * @effect N/A: 局所値のみ。
 * @failure 時刻不正で例外。
 * @invariant 時計逆行を期限切れへ畳まない。
 * @boundary 保存時刻。
 * @security 時刻からAuthorityを発行しない。
 * @concurrency N/A: 同期判定。
 */
export function timestamp(value: unknown, now: number): string {
  if (typeof value !== "string") throw new Error("time");
  const milliseconds = Date.parse(value);
  if (
    !Number.isSafeInteger(milliseconds) ||
    new Date(milliseconds).toISOString() !== value ||
    milliseconds > now
  )
    throw new Error("time");
  return value;
}

/**
 * nullable 回復 Idを決定する。
 *
 * @responsibility nullable 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableRecoveryIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableRecoveryIdの入力契約を満たす。
 * @postcondition nullableRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant nullableRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security nullableRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function nullableRecoveryId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * Plain Arrayを所有Snapshotへ変換する。
 *
 * @responsibility Plain Arrayの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximumLength: number
 * @returns ArraySnapshot<T>を返す。
 * @precondition 「value: unknown、maximumLength: number」がsnapshotPlainArrayの入力契約を満たす。
 * @postcondition snapshotPlainArrayの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainArrayは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotPlainArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotPlainArrayは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): ArraySnapshot<T> {
  try {
    if (
      !Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      !Number.isSafeInteger(maximumLength) ||
      maximumLength < 0
    )
      return Object.freeze({ status: "blocked", value: null });
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !isDataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0 ||
      initialLength.value > maximumLength
    )
      return Object.freeze({ status: "blocked", value: null });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !isDataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    )
      return Object.freeze({ status: "blocked", value: null });
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor))
        return Object.freeze({ status: "blocked", value: null });
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({
      status: "ok" as const,
      value: Object.freeze(snapshotItems),
    });
  } catch {
    return Object.freeze({ status: "blocked", value: null });
  }
}

// Queue results may carry an exact opaque candidate or recovery reference.
// These references use the same closed character set as stable IDs, but can
// exceed the 128-character limit of ordinary project-local identifiers.

/**
 * 結果 Referenceが有効か判定する。
 *
 * @responsibility 結果 Referenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidResultReferenceの入力契約を満たす。
 * @postcondition validResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: validResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validResultReferenceは独自の失敗分岐を所有しない。
 * @invariant validResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validResultReferenceはProcess内の同一Subsystemで完結する。
 * @security validResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validResultReferenceは共有非同期状態を持たない同期処理である。
 */
export function validResultReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * 技術記録を完全な値へ投影し、定義集合との相関を検査する。
 * @responsibility 受領本文・終端導出・exact操作参照を一度だけ実装する。
 * @trace ARCH-000004、ARCH-000008
 * @input snapshot: 共通区画と管理Task値、Repository結合、本文Hash、定義対象集合。
 * @returns 検査済み投影、又はnull。
 * @precondition 正規JSONから得た共通区画と検査済み定義対象を受け取る。
 * @postcondition 同じ受領を別Task・別世代へ流用しない。
 * @effect N/A: 局所の値検査だけ。
 * @failure 欠測・不一致・孤立参照はnull。
 * @invariant Coreだけの対象に偽のTask・Selection・Ownerを作らない。
 * @boundary 正本と管理実行用のメモリ投影。旧形式Readerではない。
 * @security 成功から保存確定・実資源不存在・現在Authorityを推定しない。
 * @concurrency N/A: 同期の局所処理。
 */
function projectRuntimeSnapshotSections(
  snapshot: RuntimeDomainSnapshot,
  managedProjects: readonly RuntimeStoredManagedProject[],
  repositoryBinding: string,
  payloadSha256: string,
  definitionProjects: readonly Readonly<{ projectId: string }>[],
) {
  const receipts = new Map<string, ProjectResultAcceptance>();
  for (const item of snapshot.resultReceipts) {
    const receipt = decodeProjectResultAcceptance(item);
    const project = managedProjects.find(
      (entry) => entry.projectId === receipt?.projectId,
    );
    if (
      !receipt ||
      receipts.has(receipt.recoveryId) ||
      !project ||
      receipt.repositoryBinding !== repositoryBinding ||
      receipt.repositoryBindingId !== snapshot.repositoryBindingId ||
      receipt.milestoneId !== project.milestoneId ||
      receipt.settlementGeneration > project.generation ||
      !project.tasks.some(
        (task: CoordinatorStoredTask) => task.definition.id === receipt.taskId,
      ) ||
      snapshot.pendingDeliveries.some(
        (delivery) => delivery.recoveryId === receipt.recoveryId,
      )
    )
      return null;
    const operation = snapshot.operations.find(
      (entry) => entry.recoveryId === receipt.recoveryId,
    );
    if (
      operation &&
      (operation.kind !== "docker_task" ||
        operation.history?.confirmed !== true ||
        operation.summarySha256 !== receipt.resultId ||
        projectCoordinatorTaskSettlement(
          {
            kind: "operations",
            recoveryIds: [receipt.recoveryId],
            resultUnresolved: false,
          },
          snapshot,
        )?.cleanupConfirmed !== true ||
        snapshot.unresolvedRecoveries.some(
          (recovery) => recovery.recoveryId === receipt.recoveryId,
        ) ||
        (JSON.parse(operation.identityJson).recoveryCorrelationId ??
          JSON.parse(operation.identityJson).operationId) !==
          receipt.operationId)
    )
      return null;
    receipts.set(receipt.recoveryId, item);
  }

  const claimedOperations = new Set<string>();
  const projects: CoordinatorState[] = [];
  for (const project of managedProjects) {
    if (!Array.isArray(project.tasks)) return null;
    const tasks: ProjectTaskRecord[] = [];
    for (const task of project.tasks) {
      if (
        !exactRecordKeys(task, [
          "definition",
          "state",
          "attemptId",
          "operationId",
          "authorityBindingId",
          "startPhase",
          "settlement",
          "recoveryObligations",
          "resultAcceptanceIds",
          "candidateId",
          "retryCount",
          "supersededBy",
        ]) ||
        !Array.isArray(task.resultAcceptanceIds) ||
        new Set(task.resultAcceptanceIds).size !==
          task.resultAcceptanceIds.length ||
        !Array.isArray(task.recoveryObligations)
      )
        return null;
      const settlement = projectCoordinatorTaskSettlement(
        task.settlement,
        snapshot,
      );
      if (!settlement) return null;
      const matching = snapshot.operations
        .filter((operation) => {
          if (operation.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(operation.identityJson);
          return (
            identity.consumer === "orchestrator" &&
            (identity.recoveryCorrelationId ?? identity.operationId) ===
              task.operationId
          );
        })
        .map((operation) => operation.recoveryId);
      const referenced =
        task.settlement.kind === "operations"
          ? task.settlement.recoveryIds
          : [];
      if (
        matching.length !== referenced.length ||
        matching.some((id) => !referenced.includes(id)) ||
        referenced.some((id: string) => claimedOperations.has(id))
      )
        return null;
      for (const id of referenced) claimedOperations.add(id);
      const resultAcceptances: ProjectResultAcceptance[] = [];
      for (const id of task.resultAcceptanceIds) {
        const receipt = receipts.get(id);
        if (!receipt) return null;
        resultAcceptances.push(receipt);
      }
      const recoveryObligations: ProjectTaskRecoveryObligation[] = [];
      for (const obligation of task.recoveryObligations) {
        if (obligation.kind !== "docker") {
          if (!exactRecordKeys(obligation, ["kind", "recoveryId", "phase"]))
            return null;
          recoveryObligations.push(obligation);
          continue;
        }
        if (!exactRecordKeys(obligation, ["kind", "recoveryId"])) return null;
        const acknowledgement = receipts.get(obligation.recoveryId);
        if (acknowledgement) {
          recoveryObligations.push({
            ...obligation,
            phase: "acknowledged",
            acknowledgement,
          });
          continue;
        }
        const observed = projectCoordinatorTaskSettlement(
          {
            kind: "operations",
            recoveryIds: [obligation.recoveryId],
            resultUnresolved: false,
          },
          snapshot,
        );
        if (!observed) return null;
        recoveryObligations.push({
          ...obligation,
          phase: observed.cleanupConfirmed ? "settled" : "required",
        });
      }
      const {
        settlement: _settlement,
        resultAcceptanceIds: _ids,
        recoveryObligations: _obligations,
        ...record
      } = task;
      tasks.push(
        Object.freeze({
          ...record,
          ...settlement,
          resultAcceptances,
          recoveryObligations,
        }),
      );
    }
    projects.push(Object.freeze({ ...project, tasks: Object.freeze(tasks) }));
  }
  const taskSections = {
    ...snapshot,
    repositoryBindingId: snapshot.repositoryBindingId ?? "",
    intakeEpoch: snapshot.intakeEpoch ?? "",
    projects,
  };
  if (snapshot.repositoryBindingId === null || snapshot.intakeEpoch === null) {
    if (
      snapshot.repositoryBindingId !== null ||
      snapshot.intakeEpoch !== null ||
      snapshot.resultReceipts.length !== 0 ||
      [
        "projects",
        "queueEntries",
        "intakeBindings",
        "workspaces",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "acceptanceDecisions",
        "decisionRecoveries",
      ].some(
        (key) =>
          !Array.isArray(
            (snapshot as unknown as Record<string, unknown>)[key],
          ) ||
          ((snapshot as unknown as Record<string, unknown[]>)[key]?.length ??
            -1) !== 0,
      )
    )
      return null;
  } else if (
    !validId(snapshot.repositoryBindingId) ||
    !validId(snapshot.intakeEpoch) ||
    !projects.every(validCoordinatorState) ||
    !validRuntimeTaskReferences(
      { ...taskSections, projects: definitionProjects },
      snapshot.repositoryBindingId,
    )
  )
    return null;
  return Object.freeze({
    snapshot,
    projects: Object.freeze(projects),
    payloadSha256,
  });
}

/**
 * 現在状態の全区画と既存結合を検証する。
 * @responsibility 部分codecを完全保存形式として受理しない。
 * @trace ARCH-000004
 * @input value: JSON値、binding: 期待Repository結合、rootHash: 取得済みRoot結合。
 * @returns 閉じたSnapshotとして有効か。
 * @precondition JSON値だけを渡す。
 * @postcondition 参照、証拠、受付結合、結果と終了要約を検証する。
 * @effect N/A: 値検証のみ。
 * @failure 不正形状・未知区画・孤立参照はfalse。
 * @invariant Owner状態や清掃を推定しない。
 * @boundary JSONから保存契約。
 * @security 既存保護情報を新規発行しない。
 * @concurrency N/A: 同期検証。
 */
export function validCoordinatorSnapshot(
  value: unknown,
  binding: string,
  rootHash: string,
): value is CoordinatorSnapshot {
  try {
    if (
      !plainObject(value) ||
      !exactKeys(value, [
        "schema",
        "schemaRevision",
        "repositoryRootHash",
        "repositoryBindingId",
        "snapshotRevision",
        "intakeEpoch",
        "intakeBindings",
        "projects",
        "queueEntries",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "acceptanceDecisions",
        "decisionRecoveries",
        "workspaces",
      ]) ||
      value.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
      value.schemaRevision !== 5 ||
      value.repositoryBindingId !== binding ||
      value.repositoryRootHash !== rootHash ||
      !validId(binding) ||
      !isSha256Hex(rootHash) ||
      !validId(value.intakeEpoch) ||
      !Number.isSafeInteger(value.snapshotRevision) ||
      Number(value.snapshotRevision) < 1
    )
      return false;
    return validCoordinatorTaskState(
      value as unknown as CoordinatorSnapshot,
      binding,
    );
  } catch {
    return false;
  }
}
