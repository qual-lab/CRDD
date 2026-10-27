/**
 * 一般の実行依頼定義を純粋な保存候補へ変換する。
 * @responsibility 定義Hash・参照・DAG・全体CASを照合し対象以外の区画を保全する。
 * @trace ARCH-000008
 * @boundary 状態値だけ。I/O・認可・実行Authorityは扱わない。
 */
import { createHash } from "node:crypto";
import { snapshotPlainRecord } from "../plain-data/snapshot.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import type { RuntimeProjectDefinition } from "../state/types.ts";
import {
  decodeRuntimeDomainSnapshot,
  hashRuntimeProjectDefinition,
  validId,
} from "../state/validation.ts";
import type { ProjectTaskDefinition } from "../task/types.ts";
import type { ProjectObjectiveDefinition } from "./types.ts";
import {
  inspectExecutionPlanDefinition,
  inspectRuntimeProjectDefinition,
} from "./validation.ts";

/**
 * 対象と定義本文を結合したHashを導く。
 * @responsibility 別対象の同じ本文を同一改訂と扱わない。
 * @trace ARCH-000008
 * @input project、kind、definition: 検査済み対象と定義。
 * @returns 正規UTF-8定義のSHA-256。
 * @precondition 定義の値検査を完了している。
 * @postcondition 実行状態・OwnerをHashへ混入させない。
 * @effect N/A: 純粋変換。
 * @failure 符号化不能では例外。
 * @invariant ProjectとMilestone、種別とIDを固定する。
 * @boundary 一般定義の比較交換。
 * @security Hashを操作Authorityにしない。
 * @concurrency N/A: 状態共有なし。
 */
export function hashRuntimeEntityDefinition(
  project: RuntimeProjectDefinition,
  kind: "objective" | "task",
  definition: ProjectObjectiveDefinition | ProjectTaskDefinition,
): string {
  return createHash("sha256")
    .update("crdd-domain/definition/v1\0")
    .update(
      encodeRuntimeStateValue({
        projectId: project.projectId,
        milestoneId: project.milestoneId,
        kind,
        definition,
      }),
    )
    .digest("hex");
}

/**
 * 一つの一般CRUD要求を同じSnapshotの次版へ変換する。
 * @responsibility 管理実行・受付・判断等が参照する対象を変更せず対象外区画を保持する。
 * @trace ARCH-000008
 * @input before: 元byte、kind: 固定CRUD用途、request: 未信頼入力、binding: 現在結合、revision: 現在Repository改訂。
 * @returns 次byteと返却値、又は固定した拒否・競合。
 * @precondition 操作認可と物理排他は保存Ownerが別に確認する。
 * @postcondition 未指定属性・Owner・Selectionを捏造せず新Schemaだけを生成する。
 * @effect N/A: 純粋候補生成。
 * @failure 入力不正・参照中・定義差・全体CAS差を区別する。
 * @invariant 未選択区画を変更せずCascade・自動再適用を行わない。
 * @boundary 一般定義の責務と単一物理Writer。
 * @security 任意更新callbackや完成状態の捏造を受け付けない。
 * @concurrency 同じ要求を物理確定直前にも再導出する。
 */
export function prepareRuntimeDefinitionChange(
  before: unknown,
  kind:
    | "plan.save"
    | "objective.create"
    | "objective.update"
    | "objective.delete"
    | "task.create"
    | "task.update"
    | "task.delete",
  raw: unknown,
  binding: string,
  revision: string,
) {
  const denied = (
    reason:
      | "input_invalid"
      | "target_referenced"
      | "target_missing"
      | "target_exists",
  ) => ({ status: "blocked" as const, reason });
  const request = snapshotPlainRecord(
    raw,
    new Set([
      "projectId",
      "milestoneId",
      "expected",
      ...(!kind.endsWith(".create") ? ["expectedDefinitionHash"] : []),
      ...(kind === "plan.save" || !kind.endsWith(".delete")
        ? ["definition"]
        : []),
      ...(kind.startsWith("objective.") && !kind.endsWith(".create")
        ? ["objectiveId"]
        : []),
      ...(kind.startsWith("task.") && !kind.endsWith(".create")
        ? ["taskId"]
        : []),
    ]),
  );
  if (!request || !validId(request.projectId) || !validId(request.milestoneId))
    return denied("input_invalid");
  const expected = snapshotPlainRecord(
    request.expected,
    new Set(["revision", "payloadSha256"]),
  );
  const decoded = decodeRuntimeDomainSnapshot(before, binding);
  if (
    !decoded ||
    !expected ||
    !Number.isSafeInteger(expected.revision) ||
    typeof expected.payloadSha256 !== "string"
  )
    return denied("input_invalid");
  if (
    decoded.snapshot.revision !== expected.revision ||
    decoded.payloadSha256 !== expected.payloadSha256
  )
    return { status: "conflict" as const, reason: "state_changed" as const };
  const snapshot = decoded.snapshot;
  const current = snapshot.projects.find(
    (p) =>
      p.projectId === request.projectId &&
      p.milestoneId === request.milestoneId,
  );
  if (
    snapshot.projects.some(
      (p) =>
        p.projectId === request.projectId &&
        p.milestoneId !== request.milestoneId,
    )
  )
    return denied("target_exists");
  const referenced =
    snapshot.managedExecutions.some((p) => p.projectId === request.projectId) ||
    snapshot.acceptanceDecisions.some(
      (row) => row.record.projectId === request.projectId,
    ) ||
    snapshot.decisionRecoveries.some(
      (row) => row.value.projectId === request.projectId,
    ) ||
    [snapshot.queueEntries, snapshot.results, snapshot.resultReceipts].some(
      (rows) => rows.some((row) => row.projectId === request.projectId),
    );
  if (
    referenced ||
    (current &&
      (current.milestone.state !== "planned" ||
        current.milestone.criterionEvidenceIds.length !== 0 ||
        current.decisionApplicationId !== null ||
        current.objectives.some(
          (o) => o.state !== "planned" || o.criterionEvidenceIds.length !== 0,
        )))
  )
    return denied("target_referenced");
  if (kind !== "plan.save" && !current) return denied("target_missing");
  let objectives = current?.objectives ?? [];
  let tasks = current?.tasks ?? [];
  let criteria = current?.milestone.acceptanceCriteria ?? [];
  let value: unknown = null;
  let changedId: string | null = null;
  if (kind === "plan.save") {
    const plan = inspectExecutionPlanDefinition(request.definition);
    if (!plan) return denied("input_invalid");
    const expectedHash = current ? hashRuntimeProjectDefinition(current) : null;
    if (request.expectedDefinitionHash !== expectedHash)
      return {
        status: "conflict" as const,
        reason: "definition_changed" as const,
      };
    objectives = plan.objectives.map((definition) => ({
      definition,
      state: "planned" as const,
      criterionEvidenceIds: [],
    }));
    tasks = plan.tasks;
    criteria = plan.milestoneAcceptanceCriteria;
  } else {
    const objective = kind.startsWith("objective.");
    const id = request[objective ? "objectiveId" : "taskId"];
    const rows = objective ? objectives.map((o) => o.definition) : tasks;
    const definition = kind.endsWith(".delete")
      ? null
      : snapshotPlainRecord(
          request.definition,
          new Set(
            objective
              ? ["id", "acceptanceCriteria"]
              : [
                  "id",
                  "objectiveId",
                  "dependencies",
                  "allowedPaths",
                  "conflictKeys",
                ],
          ),
        );
    const targetId = kind.endsWith(".create") ? definition?.id : id;
    if (!validId(targetId) || (definition && definition.id !== targetId))
      return denied("input_invalid");
    changedId = targetId;
    const prior = rows.find((row) => row.id === targetId);
    if (kind.endsWith(".create") ? !!prior : !prior)
      return denied(prior ? "target_exists" : "target_missing");
    if (
      !kind.endsWith(".create") &&
      current &&
      prior &&
      request.expectedDefinitionHash !==
        hashRuntimeEntityDefinition(
          current,
          objective ? "objective" : "task",
          prior,
        )
    )
      return {
        status: "conflict" as const,
        reason: "definition_changed" as const,
      };
    if (kind.endsWith(".delete")) {
      if (
        objective
          ? tasks.some((t) => t.objectiveId === targetId)
          : tasks.some((t) => t.dependencies.includes(targetId))
      )
        return denied("target_referenced");
      if (objective)
        objectives = objectives.filter((o) => o.definition.id !== targetId);
      else tasks = tasks.filter((t) => t.id !== targetId);
      value = { id: targetId };
    } else if (objective) {
      const row = {
        definition: definition as ProjectObjectiveDefinition,
        state: "planned" as const,
        criterionEvidenceIds: [],
      };
      objectives = kind.endsWith(".create")
        ? [...objectives, row]
        : objectives.map((o) => (o.definition.id === targetId ? row : o));
    } else {
      const row = definition as ProjectTaskDefinition;
      tasks = kind.endsWith(".create")
        ? [...tasks, row]
        : tasks.map((t) => (t.id === targetId ? row : t));
    }
  }
  const project = inspectRuntimeProjectDefinition({
    contract: "crdd-domain/project-state/v1",
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: current?.repositoryRevision ?? revision,
    generation: (current?.generation ?? 0) + 1,
    decisionApplicationId: null,
    milestone: {
      id: request.milestoneId,
      acceptanceCriteria: criteria,
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives,
    tasks,
  });
  if (!project) return denied("input_invalid");
  if (value === null) {
    if (kind === "plan.save")
      value = {
        definition: {
          milestoneAcceptanceCriteria: project.milestone.acceptanceCriteria,
          objectives: project.objectives.map((o) => o.definition),
          tasks: project.tasks,
        },
        definitionHash: hashRuntimeProjectDefinition(project),
      };
    else {
      const objective = kind.startsWith("objective.");
      const definition = objective
        ? project.objectives.find((o) => o.definition.id === changedId)
            ?.definition
        : project.tasks.find((t) => t.id === changedId);
      if (!definition) return denied("input_invalid");
      value = {
        definition,
        definitionHash: hashRuntimeEntityDefinition(
          project,
          objective ? "objective" : "task",
          definition,
        ),
      };
    }
  }
  const next = {
    ...snapshot,
    revision: snapshot.revision + 1,
    previous: {
      revision: snapshot.revision,
      payloadSha256: decoded.payloadSha256,
    },
    projects: current
      ? snapshot.projects.map((p) =>
          p.projectId === project.projectId ? project : p,
        )
      : [...snapshot.projects, project],
  };
  const bytes = Buffer.from(encodeRuntimeStateValue(next) + "\n");
  if (!decodeRuntimeDomainSnapshot(bytes, binding))
    return denied("input_invalid");
  return { status: "prepared" as const, bytes, value };
}
