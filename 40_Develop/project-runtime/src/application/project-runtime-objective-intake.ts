import type {
  ProjectObjectiveDefinition,
  ProjectTaskDefinition,
  ProjectTaskRecoveryObligation,
  projectProjectRuntimeState,
} from "../core/project-runtime-state.ts";
import {
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
} from "../public-contract/objective-request.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";

export const PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/project-runtime-objective-intake/v1" as const;

export type ProjectRuntimeObjectivePlan = Readonly<{
  milestoneAcceptanceCriteria: readonly string[];
  objectives: readonly ProjectObjectiveDefinition[];
  tasks: readonly ProjectTaskDefinition[];
}>;

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

function inspectStrings(
  value: unknown,
  maximumItems: number,
  maximumText: number,
  shouldAllowEmpty = false,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, maximumItems);
  if (
    snapshot.status !== "ok" ||
    (!shouldAllowEmpty && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry, maximumText)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

function pathWithin(candidate: string, roots: readonly string[]) {
  const normalized = candidate.replaceAll("\\", "/").toUpperCase();
  return roots.some((rootValue) => {
    const root = rootValue
      .replaceAll("\\", "/")
      .replace(/\/+$/u, "")
      .toUpperCase();
    return normalized === root || normalized.startsWith(`${root}/`);
  });
}

/** Validate an untrusted Planner result as a bounded Project Runtime plan. */
export function inspectProjectRuntimeObjectivePlan(
  raw: unknown,
  request: ProjectRuntimeObjectiveRequest,
): ProjectRuntimeObjectivePlan | null {
  if (!inspectProjectRuntimeObjectiveRequest(request)) return null;
  const plan = snapshotPlainRecord(
    raw,
    new Set(["milestoneAcceptanceCriteria", "objectives", "tasks"] as const),
  );
  if (!plan) return null;
  const milestoneAcceptanceCriteria = inspectStrings(
    plan.milestoneAcceptanceCriteria,
    128,
    2_048,
  );
  const rawObjectives = snapshotPlainArray(plan.objectives, 128);
  const rawTasks = snapshotPlainArray(plan.tasks, 1024);
  if (
    !milestoneAcceptanceCriteria ||
    rawObjectives.status !== "ok" ||
    rawTasks.status !== "ok" ||
    rawObjectives.value.length === 0 ||
    rawTasks.value.length === 0
  )
    return null;
  const objectives: ProjectObjectiveDefinition[] = [];
  for (const rawObjective of rawObjectives.value) {
    const objective = snapshotPlainRecord(
      rawObjective,
      new Set(["id", "acceptanceCriteria"] as const),
    );
    if (!objective || !validId(objective.id)) return null;
    const acceptanceCriteria = inspectStrings(
      objective.acceptanceCriteria,
      128,
      2_048,
    );
    if (!acceptanceCriteria) return null;
    objectives.push(Object.freeze({ id: objective.id, acceptanceCriteria }));
  }
  const tasks: ProjectTaskDefinition[] = [];
  for (const rawTask of rawTasks.value) {
    const task = snapshotPlainRecord(
      rawTask,
      new Set([
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ] as const),
    );
    if (!task || !validId(task.id) || !validId(task.objectiveId)) return null;
    const dependencies = inspectStrings(task.dependencies, 128, 512, true);
    const allowedPaths = inspectStrings(task.allowedPaths, 128, 512);
    const conflictKeys = inspectStrings(task.conflictKeys, 128, 512, true);
    if (
      !dependencies ||
      !allowedPaths ||
      !conflictKeys ||
      !allowedPaths.every((candidate) =>
        pathWithin(candidate, request.allowedPaths),
      )
    )
      return null;
    tasks.push(
      Object.freeze({
        id: task.id,
        objectiveId: task.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      }),
    );
  }
  return Object.freeze({
    milestoneAcceptanceCriteria,
    objectives: Object.freeze(objectives),
    tasks: Object.freeze(tasks),
  });
}

/** Canonical public result envelope for one Project Runtime objective request. */
export function createProjectRuntimeObjectiveResult(
  request: ProjectRuntimeObjectiveRequest,
  options: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    queueId?: string | null;
    projection?: ReturnType<typeof projectProjectRuntimeState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
  }>,
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    status: options.status,
    reason: options.reason,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: options.queueId ?? null,
    projection: options.projection ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([
      ...(options.recoveryObligations ?? []),
    ]),
    effectState: options.effectState ?? ("no_effect" as const),
  });
}
