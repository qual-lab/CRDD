/**
 * Task受付とQueueの状態更新を保存へ接続する。
 * @responsibility 受付世代・Queue遷移を判定し、既存の短期保存トランザクション内で確定する。
 * @trace ARCH-000004、ARCH-000008
 */
import { resolveCoordinatorNamedPaths } from "../storage/state.ts";
import { assertCoordinatorArea } from "../storage/state.ts";
import { assertCoordinatorAreaUnchanged } from "../storage/state.ts";
import type { StoreResult } from "../state/result.ts";
import { borrowCoordinatorActiveLease } from "../execution/lease.ts";
import { completed } from "../state/result.ts";
import { blocked } from "../state/result.ts";
import { leaseAcquisitionFootprintAbsent } from "../storage/state.ts";
import { activeLeaseIsObserved } from "../execution/lease.ts";
import { readExactLeaseEvidence } from "../storage/state.ts";
import { writeCoordinatorSnapshotState } from "../storage/state.ts";
import { withCoordinatorSnapshotOperation } from "../storage/state.ts";
import { coordinatorSnapshotLeaseResourcesAbsent } from "../storage/state.ts";
import { coordinatorSnapshotIntakeMatches } from "../state/settlement.ts";
import { encodeCoordinatorStateValue } from "../state/validation.ts";
import { COORDINATOR_PROJECT_SNAPSHOT_SCHEMA } from "../storage/state.ts";
import { leaseIdentity } from "../state/validation.ts";
import { validId } from "../state/validation.ts";
import { validResultReference } from "../state/validation.ts";
import { validQueueEntry } from "./validation.ts";
import type { CoordinatorLease } from "../state/persistence.ts";
import type { CoordinatorStatePort } from "../state/persistence.ts";
import type { ProjectQueueEntry } from "./types.ts";
import type { ProjectQueueState } from "./types.ts";
import type { SingleTaskRecord } from "./types.ts";
import { inspectSingleTaskRecord } from "./validation.ts";
import { resolveCoordinatorWorkspaceTaskTarget } from "../workspace/operations.ts";
import { historyRow } from "../storage/history.ts";
import path from "node:path";

export const QUEUE_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["leased", "waiting_foreground", "cancelled"]),
  leased: Object.freeze([
    "running",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  running: Object.freeze([
    "integration_pending",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  waiting_foreground: Object.freeze(["queued", "cancelled"]),
  integration_pending: Object.freeze([
    "completed",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  replan_required: Object.freeze([
    "queued",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  human_decision_required: Object.freeze([
    "replan_required",
    "recovery_required",
    "cancelled",
  ]),
  recovery_required: Object.freeze([
    "queued",
    "recovery_required",
    "cancelled",
  ]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
} satisfies Record<ProjectQueueState, readonly ProjectQueueState[]>);

/**
 * State作成より前に、発行時の受付結合を確認する。
 * @responsibility 拒否する依頼からProject状態を生成しない。
 * @trace ARCH-000004
 * @input Repository Root、binding、依頼の発行時結合。
 * @returns 検証成功または停止。
 * @precondition Rootと呼出し主体は上位で検証済み。
 * @postcondition 状態を書き換えず受付を評価する。
 * @effect 短期排他と読取りのみ。
 * @failure 旧世代、異内容、未初期化は停止。
 * @invariant この確認だけを後続保存の保証にしない。
 * @boundary 本番入口と現在状態。
 * @security 認証または権限を発行しない。
 * @concurrency 保存時も同じ判定を再実行する。
 */
export function inspectCoordinatorSnapshotIntake(
  workingDirectory: string,
  binding: string,
  intake: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): StoreResult<true> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) =>
      coordinatorSnapshotIntakeMatches(current, intake)
        ? completed("orchestrator_intake_verified", {
            next: null,
            value: true as const,
          })
        : blocked("orchestrator_intake_epoch_retired"),
  );
}

/**
 * 統合保存用State／Queueの全操作を構成する。
 * @responsibility 既存Portの世代・選択・実行Owner・回復契約を同じ保存Ownerへ接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、Request発行時に取得したintakeEpoch。
 * @returns State／Queue Port。既存本番Factoryは変更しない。
 * @precondition 全入力照合済みSnapshotと有効な発行時受付世代がある。
 * @postcondition 各操作が同じ排他内の比較と保存確認を使用する。
 * @effect 操作時にだけ統合Snapshotを読取り・保存する。
 * @failure 世代・受付・Owner・回復不一致は保全停止する。
 * @invariant 保存改訂をState／Queue世代や実資源の証明にしない。
 * @boundary Coreの既存State Portと統合保存。
 * @security 過去Requestを現在世代へ自動付替えしない。
 * @concurrency 選択から待機Queue更新まで自己再取得せず一つの短期Ownerに閉じる。
 */
export function createCoordinatorSnapshotStatePort(
  workingDirectory: string,
  binding: string,
  intakeEpoch: string,
  intake?: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): CoordinatorStatePort {
  if (!validId(binding) || !validId(intakeEpoch))
    throw new Error("snapshot_port_binding_invalid");
  return Object.freeze({
    readWorkspaceTaskTarget: (queueId: string) =>
      resolveCoordinatorWorkspaceTaskTarget(workingDirectory, binding, queueId),
    writeState: (state, expectedGeneration, resultFacts) =>
      writeCoordinatorSnapshotState(
        workingDirectory,
        binding,
        encodeCoordinatorStateValue(state),
        expectedGeneration,
        intake,
        resultFacts,
      ),
    readState: (projectId) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        if (!validId(projectId))
          return blocked("orchestrator_state_identity_invalid");
        return completed("orchestrator_state_observed", {
          next: null,
          value:
            current.projects.find((item) => item.projectId === projectId) ??
            null,
        });
      }),
    enqueueOperation: (input) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        const existing = current.queueEntries.find(
          (item) => item.queueId === input.queueId,
        );
        if (existing) {
          const epoch = current.intakeBindings.find(
            (item) => item.queueId === input.queueId,
          )?.epoch;
          return epoch === intakeEpoch &&
            existing.requestHash === input.requestHash &&
            existing.projectId === input.projectId &&
            existing.milestoneId === input.milestoneId
            ? completed("orchestrator_queue_request_reused", {
                next: null,
                value: existing,
              })
            : blocked("orchestrator_queue_identity_conflict");
        }
        if (current.intakeEpoch !== intakeEpoch)
          return blocked("orchestrator_intake_epoch_retired");
        const value: ProjectQueueEntry = {
          ...input,
          workspaceId: input.workspaceId ?? null,
          state: "queued",
          generation: 1,
          ownerGeneration: null,
          resumeCondition: null,
          resultReference: null,
        };
        if (
          !validQueueEntry(value) ||
          value.singleTask !== undefined ||
          !current.projects.some((item) => item.projectId === value.projectId)
        )
          return blocked("orchestrator_queue_input_invalid");
        if (
          value.workspaceId != null &&
          (!current.queueEntries.some(
            (entry) =>
              entry.projectId === value.projectId &&
              entry.workspaceId === value.workspaceId,
          ) ||
            !current.workspaces.some(
              (entry) =>
                entry.workspaceId === value.workspaceId &&
                entry.phase === "ready" &&
                entry.holdUntil === null,
            ))
        )
          return blocked("orchestrator_workspace_not_ready");
        return completed("orchestrator_queue_entry_durable", {
          next: {
            ...current,
            queueEntries: [...current.queueEntries, value],
            intakeBindings: [
              ...current.intakeBindings,
              { queueId: value.queueId, epoch: intakeEpoch },
            ],
          },
          value,
        });
      }),
    readQueue: (queueId) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        if (!validId(queueId))
          return blocked("orchestrator_queue_input_invalid");
        const value = current.queueEntries.find(
          (item) => item.queueId === queueId,
        );
        return value
          ? completed("orchestrator_queue_observed", { next: null, value })
          : blocked("orchestrator_queue_observation_unknown");
      }),
    selectNextOperation: () =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        const orderedTasks = [...current.queueEntries].sort((a, b) =>
          a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0,
        );
        const isActive = orderedTasks.some(
          (item) => item.ownerGeneration !== null,
        );
        const interactive = orderedTasks.find(
          (item) =>
            item.originLane === "interactive" &&
            item.state === "queued" &&
            item.ownerGeneration === null,
        );
        if (isActive || interactive) {
          const reason = isActive
            ? "active_operation_pending"
            : "interactive_queue_pending";
          let hasChanged = false;
          const queueEntries = current.queueEntries.map((item) => {
            if (
              item.originLane !== "scheduled" ||
              item.state !== "queued" ||
              item.ownerGeneration !== null
            )
              return item;
            hasChanged = true;
            return {
              ...item,
              state: "waiting_foreground" as const,
              generation: item.generation + 1,
              resumeCondition: reason,
              resultReference: null,
            };
          });
          return completed(
            isActive
              ? "orchestrator_active_operation_retained"
              : "orchestrator_interactive_queue_selected",
            {
              next: hasChanged ? { ...current, queueEntries } : null,
              value: isActive ? null : (interactive ?? null),
            },
          );
        }
        const waiting = orderedTasks.find(
          (item) =>
            item.originLane === "scheduled" &&
            item.state === "waiting_foreground" &&
            item.ownerGeneration === null,
        );
        if (waiting) {
          const value = {
            ...waiting,
            state: "queued" as const,
            generation: waiting.generation + 1,
            resumeCondition: null,
            resultReference: null,
          };
          return completed("orchestrator_scheduled_queue_selected", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === value.queueId ? value : item,
              ),
            },
            value,
          });
        }
        const value =
          orderedTasks.find(
            (item) =>
              item.originLane === "scheduled" &&
              item.state === "queued" &&
              item.ownerGeneration === null,
          ) ?? null;
        return completed(
          value
            ? "orchestrator_scheduled_queue_selected"
            : "orchestrator_queue_empty",
          { next: null, value },
        );
      }),
    updateQueue: (queueId, expectedGeneration, next) =>
      withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const previous = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          if (previous?.singleTask)
            return blocked("orchestrator_single_task_owner_required");
          if (
            !validId(queueId) ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !previous ||
            previous.generation !== expectedGeneration
          )
            return blocked("orchestrator_queue_generation_conflict");
          if (next.resumeCondition !== null && !validId(next.resumeCondition))
            return blocked("orchestrator_queue_resume_condition_invalid");
          if (
            next.resultReference !== null &&
            !validResultReference(next.resultReference)
          )
            return blocked("orchestrator_queue_result_reference_invalid");
          if (
            !(
              QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
            ).includes(next.state)
          )
            return blocked("orchestrator_queue_transition_invalid");
          if (
            previous.state === "recovery_required" &&
            next.state === "recovery_required" &&
            !(
              previous.ownerGeneration === null &&
              previous.resumeCondition === "owner_loss" &&
              next.lease === null &&
              next.resumeCondition === "exact_recovery" &&
              next.resultReference !== null
            )
          )
            return blocked("orchestrator_queue_recovery_binding_invalid");
          if (
            previous.state === "recovery_required" &&
            next.state === "queued" &&
            !(
              previous.ownerGeneration === null &&
              previous.resumeCondition === "owner_loss" &&
              previous.resultReference !== null &&
              next.lease === null &&
              next.resumeCondition === null &&
              next.resultReference === null
            )
          )
            return blocked("orchestrator_queue_owner_loss_reset_invalid");
          const activeLease = next.lease
            ? borrowCoordinatorActiveLease(next.lease)
            : undefined;
          const isRequired =
            previous.ownerGeneration !== null ||
            next.state === "leased" ||
            next.state === "running";
          if (!isRequired && next.lease !== null)
            return blocked("orchestrator_queue_lease_invalid");
          if (
            isRequired &&
            (activeLease?.kind !== "project-operation" ||
              activeLease.repositoryRoot !== owner.repositoryRoot ||
              activeLease.repositoryBindingId !== binding ||
              activeLease.projectId !== previous.projectId ||
              activeLease.queueId !== queueId ||
              !activeLeaseIsObserved(activeLease))
          )
            return blocked("orchestrator_queue_lease_invalid");
          if (
            isRequired &&
            previous.ownerGeneration !== null &&
            previous.ownerGeneration !== activeLease?.ownerGeneration
          )
            return blocked("orchestrator_queue_owner_mismatch");
          const value: ProjectQueueEntry = {
            ...previous,
            state: next.state,
            generation: previous.generation + 1,
            ownerGeneration: isRequired
              ? (activeLease?.ownerGeneration ?? null)
              : null,
            resumeCondition: next.resumeCondition,
            resultReference: next.resultReference,
          };
          if (!validQueueEntry(value))
            return blocked("orchestrator_queue_record_mismatch");
          return completed("orchestrator_queue_state_durable", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === queueId ? value : item,
              ),
            },
            value,
          });
        },
      ),
    settleQueueRecovery: (queueId, expectedGeneration, recoveryId) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        const previous = current.queueEntries.find(
          (item) => item.queueId === queueId,
        );
        if (
          !validId(queueId) ||
          !validResultReference(recoveryId) ||
          !Number.isSafeInteger(expectedGeneration) ||
          expectedGeneration < 1 ||
          !previous ||
          previous.generation !== expectedGeneration
        )
          return blocked("orchestrator_queue_recovery_generation_conflict");
        if (
          previous.state !== "recovery_required" ||
          previous.ownerGeneration !== null ||
          previous.resumeCondition !== "exact_recovery" ||
          previous.resultReference !== recoveryId
        )
          return blocked("orchestrator_queue_recovery_identity_mismatch");
        const value: ProjectQueueEntry = {
          ...previous,
          state: "queued",
          generation: previous.generation + 1,
          ownerGeneration: null,
          resumeCondition: "exact_recovery_settled",
          resultReference: recoveryId,
        };
        return completed("orchestrator_queue_recovery_settled", {
          next: {
            ...current,
            queueEntries: current.queueEntries.map((item) =>
              item.queueId === queueId ? value : item,
            ),
          },
          value,
        });
      }),
    settleQueueLeaseRelease: (queueId, expectedGeneration, ownerGeneration) =>
      withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const previous = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          if (
            !validId(queueId) ||
            !validId(ownerGeneration) ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !previous ||
            previous.generation !== expectedGeneration ||
            previous.ownerGeneration !== ownerGeneration ||
            previous.state === "leased" ||
            previous.state === "running"
          )
            return blocked(
              "orchestrator_queue_release_settlement_state_mismatch",
              true,
            );
          const paths = resolveCoordinatorNamedPaths(owner.repositoryRoot);
          if (!paths) throw new Error("orchestrator_repository_root_invalid");
          const runtime = paths.coordinator;
          const boundary = assertCoordinatorArea(
            owner.repositoryRoot,
            "coordinator",
            runtime,
          );
          const identity = leaseIdentity(
            binding,
            previous.projectId,
            queueId,
            "project-operation",
          );
          const locks =
            current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
              ? path.join(paths.temporary, "orchestrator-leases")
              : path.join(runtime, "work", "locks");
          if (
            !(current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
              ? coordinatorSnapshotLeaseResourcesAbsent(
                  owner.repositoryRoot,
                  identity,
                )
              : leaseAcquisitionFootprintAbsent(
                  locks,
                  identity,
                  [
                    ".lock",
                    ".release-unknown",
                    ".acquire-pending",
                    ".acquire-lock-owned",
                  ].map((suffix) => path.join(locks, `${identity}${suffix}`)),
                ))
          )
            return blocked(
              "orchestrator_queue_release_settlement_resource_present",
              true,
            );
          assertCoordinatorAreaUnchanged(
            owner.repositoryRoot,
            "coordinator",
            boundary,
          );
          const evidence =
            current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
              ? {
                  released: current.leaseEvidence.find(
                    (item) =>
                      item.projectId === previous.projectId &&
                      item.content.queueId === queueId &&
                      item.content.kind === "project-operation" &&
                      item.content.ownerGeneration === ownerGeneration &&
                      item.content.disposition === "released",
                  ),
                  recovered: current.leaseEvidence.find(
                    (item) =>
                      item.projectId === previous.projectId &&
                      item.content.queueId === queueId &&
                      item.content.kind === "project-operation" &&
                      item.content.ownerGeneration === ownerGeneration &&
                      item.content.disposition === "recovered_after_owner_loss",
                  ),
                }
              : readExactLeaseEvidence(
                  path.join(runtime, "recovery", "leases"),
                  {
                    repositoryBindingId: binding,
                    projectId: previous.projectId,
                    queueId,
                    kind: "project-operation",
                    identity,
                    ownerGeneration,
                  },
                );
          if (
            current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA &&
            current.leaseIntents.some(
              (item) => item.ownerGeneration === ownerGeneration,
            )
          )
            return blocked("orchestrator_queue_release_intent_unsettled", true);
          if (!evidence.released || evidence.recovered)
            return blocked(
              "orchestrator_queue_release_evidence_mismatch",
              true,
            );
          const value = {
            ...previous,
            generation: previous.generation + 1,
            ownerGeneration: null,
          };
          return completed("orchestrator_queue_release_settled", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === queueId ? value : item,
              ),
            },
            value,
          });
        },
      ),
  });
}

/**
 * 計画を生成せず単発Taskを同じ受付世代へ保存する。
 * @responsibility 入力同一性と実Workspace所属を既存Snapshotで確定する。
 * @trace ARCH-000004
 * @input 現在Root、binding、受付世代、単発Queue。
 * @returns 同一受付又は確定した新品Queue。
 * @precondition 上位で実Projectと主体を認可する。
 * @postcondition 保存確認より前に下位実行を開始しない。
 * @effect 既存state.jsonの更新のみ。
 * @failure 旧世代、別入力、無効Workspaceは停止。
 * @invariant Project計画・架空Milestoneを作らない。
 * @boundary 単発受付と既存Writer。
 * @security 本文・資格を保存しない。
 * @concurrency 既存Snapshot排他だけを使用する。
 */
export function enqueueCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  intakeEpoch: string,
  input: ProjectQueueEntry,
): StoreResult<ProjectQueueEntry> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (
        !validQueueEntry(input) ||
        !input.singleTask ||
        input.milestoneId !== null ||
        input.singleTask.phase !== "accepted" ||
        input.state !== "queued" ||
        input.generation !== 1 ||
        input.ownerGeneration !== null ||
        input.resultReference !== null ||
        input.resumeCondition !== null
      )
        return blocked("orchestrator_single_task_input_invalid");
      const existing = current.queueEntries.find(
        (entry) => entry.queueId === input.queueId,
      );
      if (existing) {
        const epoch = current.intakeBindings.find(
          (entry) => entry.queueId === input.queueId,
        )?.epoch;
        const keys = [
          "projectId",
          "milestoneId",
          "requestHash",
          "repositoryRevision",
          "scopeHash",
          "workspaceId",
        ] as const;
        const identityKeys = [
          "principalId",
          "mode",
          "executionSelection",
          "taskId",
          "attemptId",
          "operationId",
        ] as const;
        return epoch === intakeEpoch &&
          existing.singleTask &&
          keys.every((key) => existing[key] === input[key]) &&
          identityKeys.every(
            (key) =>
              encodeCoordinatorStateValue(existing.singleTask?.[key]) ===
              encodeCoordinatorStateValue(input.singleTask?.[key]),
          )
          ? completed("orchestrator_single_task_reused", {
              next: null,
              value: existing,
            })
          : blocked("orchestrator_queue_identity_conflict");
      }
      if (current.intakeEpoch !== intakeEpoch)
        return blocked("orchestrator_intake_epoch_retired");
      if (
        input.workspaceId != null &&
        (!current.queueEntries.some(
          (entry) =>
            entry.projectId === input.projectId &&
            entry.workspaceId === input.workspaceId,
        ) ||
          !current.workspaces.some(
            (entry) =>
              entry.workspaceId === input.workspaceId &&
              entry.phase === "ready" &&
              entry.holdUntil === null,
          ))
      )
        return blocked("orchestrator_workspace_not_ready");
      return completed("orchestrator_single_task_durable", {
        next: {
          ...current,
          queueEntries: [...current.queueEntries, input],
          intakeBindings: [
            ...current.intakeBindings,
            { queueId: input.queueId, epoch: intakeEpoch },
          ],
        },
        value: input,
      });
    },
  );
}

/**
 * 単発Taskの開始・終端を同じ実行Leaseと世代で保存する。
 * @responsibility 元ID、失敗・回復参照を保持して終端だけを更新する。
 * @trace ARCH-000004
 * @input Root、binding、Queue、期待世代、実Lease、次記録。
 * @returns 更新したQueue又は停止。
 * @precondition 呼出し元は同じTaskをjoinするOwner。
 * @postcondition 未解決cleanupを完了Queueへ変えない。
 * @effect 既存Snapshot更新。履歴は既存搬送へ渡す。
 * @failure 世代・Lease・識別子・遷移不一致で停止。
 * @invariant 本文・回答を保存せず採用を行わない。
 * @boundary 単発実行と既存Writer。
 * @security 保存値から実Leaseを復元しない。
 * @concurrency 既存operation LeaseとSnapshot短期排他。
 */
export function updateCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  lease: CoordinatorLease,
  raw: unknown,
): StoreResult<ProjectQueueEntry> {
  const record = inspectSingleTaskRecord(raw);
  if (!record) return blocked("orchestrator_single_task_record_invalid");
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const previous = current.queueEntries.find(
        (entry) => entry.queueId === queueId,
      );
      const active = borrowCoordinatorActiveLease(lease);
      if (
        !previous?.singleTask ||
        previous.generation !== expectedGeneration ||
        active?.kind !== "project-operation" ||
        active.repositoryRoot !== owner.repositoryRoot ||
        active.repositoryBindingId !== binding ||
        active.projectId !== previous.projectId ||
        active.queueId !== queueId ||
        !activeLeaseIsObserved(active) ||
        (previous.ownerGeneration !== null &&
          previous.ownerGeneration !== active.ownerGeneration)
      )
        return blocked("orchestrator_single_task_owner_mismatch");
      const identityKeys = [
        "principalId",
        "mode",
        "executionSelection",
        "taskId",
        "attemptId",
        "operationId",
      ] as const;
      if (
        identityKeys.some(
          (key) =>
            encodeCoordinatorStateValue(previous.singleTask?.[key]) !==
            encodeCoordinatorStateValue(record[key]),
        )
      )
        return blocked("orchestrator_single_task_identity_conflict");
      if (previous.singleTask.phase === "settled") {
        if (
          previous.singleTask.status !== record.status ||
          previous.singleTask.reason !== record.reason ||
          (previous.singleTask.cleanupConfirmed && !record.cleanupConfirmed) ||
          record.recoveryIds.some(
            (id) => !previous.singleTask?.recoveryIds.includes(id),
          )
        )
          return blocked("orchestrator_single_task_terminal_identity_conflict");
        if (
          encodeCoordinatorStateValue(previous.singleTask) ===
          encodeCoordinatorStateValue(record)
        )
          return completed("orchestrator_single_task_already_saved", {
            next: null,
            value: previous,
          });
      }
      const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
        accepted: ["starting"],
        starting: ["starting", "running", "settled"],
        running: ["settled"],
        settled: ["settled"],
      };
      if (!phases[previous.singleTask.phase].includes(record.phase))
        return blocked("orchestrator_single_task_transition_invalid");
      const terminal = record.phase === "settled";
      const clean =
        terminal && record.cleanupConfirmed && record.recoveryIds.length === 0;
      const value: ProjectQueueEntry = {
        ...previous,
        singleTask: record,
        generation: previous.generation + 1,
        ownerGeneration: active.ownerGeneration,
        state: !terminal
          ? "running"
          : !clean
            ? "recovery_required"
            : record.status === "cancelled"
              ? "cancelled"
              : "completed",
        resumeCondition: !terminal || clean ? null : "exact_recovery",
        resultReference: clean ? null : previous.resultReference,
      };
      const row = clean
        ? historyRow(
            {
              id: queueId,
              occurredAt: new Date().toISOString(),
              outcome:
                record.status === "completed"
                  ? "completed"
                  : record.status === "cancelled"
                    ? "cancelled"
                    : "failed",
              primaryFailure:
                record.status === "completed"
                  ? null
                  : record.status === "cancelled"
                    ? "cancel"
                    : "execution",
              cleanup: "confirmed",
            },
            Date.now(),
          )
        : null;
      return completed("orchestrator_single_task_saved", {
        next: {
          ...current,
          queueEntries: current.queueEntries.map((entry) =>
            entry.queueId === queueId ? value : entry,
          ),
          historyPending: row
            ? [
                ...current.historyPending.filter((item) => item.id !== queueId),
                row,
              ]
            : current.historyPending,
        },
        value,
      });
    },
  );
}

/**
 * 取得意図すらない単発受付だけを未開始の拒否として閉じる。
 * @responsibility Lease競合拒否と取得結果不明を区別する。
 * @trace ARCH-000004
 * @input Repository、binding、受付ID、期待世代と固定理由。
 * @returns 同じ受付の終端、又は処置しない停止。
 * @precondition Providerと実Leaseの取得を開始していない。
 * @postcondition 取得意図があればcleanupを確定しない。
 * @effect 既存Writerと履歴搬送待ちだけ。
 * @failure 取得意図・段階・世代が異なれば停止する。
 * @invariant 新しいLeaseや回復参照を捏造しない。
 * @boundary 受付Ownerと既存保存。
 * @security 本文を保存しない。
 * @concurrency 既存Snapshotの短期排他で照合する。
 */
export function closeUnstartedCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  reason: string,
): StoreResult<ProjectQueueEntry> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      const previous = current.queueEntries.find(
        (entry) => entry.queueId === queueId,
      );
      if (
        !previous?.singleTask ||
        previous.generation !== expectedGeneration ||
        previous.singleTask.phase !== "accepted" ||
        previous.ownerGeneration !== null ||
        current.leaseIntents.some((intent) => intent.queueId === queueId)
      )
        return blocked("orchestrator_single_task_unstarted_unconfirmed");
      const record = inspectSingleTaskRecord({
        ...previous.singleTask,
        phase: "settled",
        status: "blocked",
        reason,
        cleanupConfirmed: true,
      });
      if (!record) return blocked("orchestrator_single_task_record_invalid");
      const value: ProjectQueueEntry = {
        ...previous,
        singleTask: record,
        generation: previous.generation + 1,
        state: "completed",
        resumeCondition: null,
      };
      const row = historyRow(
        {
          id: queueId,
          occurredAt: new Date().toISOString(),
          outcome: "failed",
          primaryFailure: "execution",
          cleanup: "confirmed",
        },
        Date.now(),
      );
      return completed("orchestrator_single_task_not_started", {
        next: {
          ...current,
          queueEntries: current.queueEntries.map((entry) =>
            entry.queueId === queueId ? value : entry,
          ),
          historyPending: row
            ? [...current.historyPending, row]
            : current.historyPending,
        },
        value,
      });
    },
  );
}
