import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_DURATION_MS = 3_600_000;
const CONFIG_KEYS = new Set(["bindingSha256", "expiresAtMs", "tasks"]);
const TASK_KEYS = new Set(["scopeSha256", "executor", "reviewer"]);
const OBSERVATION_KEYS = new Set([
  "bindingSha256",
  "wallTimeMs",
  "monotonicTimeMs",
]);

type Provider = "codex" | "claude";
type Role = "executor" | "reviewer";
type StopReason =
  | "cancelled"
  | "expired"
  | "identity_mismatch"
  | "observation_invalid"
  | "cleanup_unknown";
type Refusal = StopReason | "task_unavailable" | "invocation_unavailable";
type ConstraintResult<T> =
  | Readonly<{ status: "recorded"; value: T }>
  | Readonly<{ status: "blocked"; reason: Refusal }>;
type Observation = Readonly<{
  bindingSha256: string;
  wallTimeMs: number;
  monotonicTimeMs: number;
}>;
type TaskState = {
  scopeSha256: string;
  executor: Provider;
  reviewer: Provider;
  token: object | null;
  settled: boolean;
  invocationCount: number;
  pendingCount: number;
};
type InvocationState = {
  task: TaskState;
  provider: Provider;
  role: Role;
  phase: "reserved" | "consumed" | "settled";
};

function parseObservation(raw: unknown): Observation | null {
  const record = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (
    !record ||
    typeof record.bindingSha256 !== "string" ||
    !HASH_PATTERN.test(record.bindingSha256) ||
    typeof record.wallTimeMs !== "number" ||
    !Number.isSafeInteger(record.wallTimeMs) ||
    record.wallTimeMs < 0 ||
    typeof record.monotonicTimeMs !== "number" ||
    !Number.isFinite(record.monotonicTimeMs) ||
    record.monotonicTimeMs < 0
  )
    return null;
  return Object.freeze({
    bindingSha256: record.bindingSha256,
    wallTimeMs: record.wallTimeMs,
    monotonicTimeMs: record.monotonicTimeMs,
  });
}

function refuse(reason: Refusal): ConstraintResult<never> {
  return Object.freeze({ status: "blocked", reason });
}

function record<T>(value: T): ConstraintResult<T> {
  return Object.freeze({ status: "recorded", value });
}

/**
 * I/O-free accounting only. This factory neither authenticates approval/identity
 * nor issues execution or cleanup authority. Observations must be supplied by
 * the eventual runtime-owned boundary, not by provider output or CLI JSON.
 */
export function createDevelopmentMeasurementConstraints(
  raw: unknown,
  initialObservation: unknown,
) {
  const config = snapshotPlainRecord(raw, CONFIG_KEYS);
  const initial = parseObservation(initialObservation);
  const taskSnapshots = snapshotPlainArray(config?.tasks, 2);
  if (
    !config ||
    !initial ||
    config.bindingSha256 !== initial.bindingSha256 ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs) ||
    config.expiresAtMs <= initial.wallTimeMs ||
    config.expiresAtMs - initial.wallTimeMs > MAX_DURATION_MS ||
    taskSnapshots.status !== "ok" ||
    taskSnapshots.value.length !== 2
  )
    return null;

  const tasks: TaskState[] = [];
  for (const rawTask of taskSnapshots.value) {
    const task = snapshotPlainRecord(rawTask, TASK_KEYS);
    if (
      !task ||
      typeof task.scopeSha256 !== "string" ||
      !HASH_PATTERN.test(task.scopeSha256) ||
      (task.executor !== "codex" && task.executor !== "claude") ||
      (task.reviewer !== "codex" && task.reviewer !== "claude") ||
      task.executor === task.reviewer ||
      tasks.some(
        (existing) =>
          existing.scopeSha256 === task.scopeSha256 ||
          existing.executor === task.executor,
      )
    )
      return null;
    tasks.push({
      scopeSha256: task.scopeSha256,
      executor: task.executor,
      reviewer: task.reviewer,
      token: null,
      settled: false,
      invocationCount: 0,
      pendingCount: 0,
    });
  }

  const expiresAtMs = config.expiresAtMs;
  const durationMs = expiresAtMs - initial.wallTimeMs;
  const bindingSha256 = initial.bindingSha256;
  const initialMonotonicTimeMs = initial.monotonicTimeMs;
  const taskTokens = new WeakMap<object, TaskState>();
  const invocationTokens = new WeakMap<object, InvocationState>();
  let activeTask: TaskState | null = null;
  let stopReason: StopReason | null = null;
  let lastObservation = initial;
  let invocationCount = 0;

  function checkObservation(rawObservation: unknown): StopReason | null {
    if (stopReason) return stopReason;
    const observation = parseObservation(rawObservation);
    if (
      !observation ||
      observation.wallTimeMs < lastObservation.wallTimeMs ||
      observation.monotonicTimeMs < lastObservation.monotonicTimeMs
    ) {
      stopReason = "observation_invalid";
    } else if (observation.bindingSha256 !== bindingSha256) {
      stopReason = "identity_mismatch";
    } else {
      lastObservation = observation;
      if (
        observation.wallTimeMs >= expiresAtMs ||
        observation.monotonicTimeMs - initialMonotonicTimeMs >= durationMs
      )
        stopReason = "expired";
    }
    return stopReason;
  }

  return Object.freeze({
    productionAuthorityConferred: false as const,
    reserveTask(scopeSha256: string, observation: unknown) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const task = tasks.find((entry) => entry.scopeSha256 === scopeSha256);
      if (!task || task.token || activeTask) return refuse("task_unavailable");
      const token = Object.freeze({});
      task.token = token;
      taskTokens.set(token, task);
      activeTask = task;
      return record(token);
    },
    reserveInvocation(
      taskToken: object,
      provider: Provider,
      role: Role,
      observation: unknown,
    ) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const task = taskTokens.get(taskToken);
      if (
        !task ||
        task !== activeTask ||
        task.settled ||
        task.pendingCount !== 0 ||
        (role !== "executor" && role !== "reviewer") ||
        task[role] !== provider ||
        task.invocationCount >= 4 ||
        invocationCount >= 8
      )
        return refuse("invocation_unavailable");
      const token = Object.freeze({});
      invocationTokens.set(token, { task, provider, role, phase: "reserved" });
      task.invocationCount += 1;
      task.pendingCount += 1;
      invocationCount += 1;
      return record(token);
    },
    consumeInvocation(
      invocationToken: object,
      taskToken: object,
      provider: Provider,
      role: Role,
      observation: unknown,
    ) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const invocation = invocationTokens.get(invocationToken);
      if (
        invocation?.phase !== "reserved" ||
        invocation.task !== activeTask ||
        invocation.task !== taskTokens.get(taskToken) ||
        invocation.provider !== provider ||
        invocation.role !== role
      )
        return refuse("invocation_unavailable");
      invocation.phase = "consumed";
      return record(null);
    },
    // Settlement records that the caller finished its existing lifecycle; it
    // does not prove resource absence, perform cleanup, or refund a reservation.
    settleInvocation(invocationToken: object) {
      const invocation = invocationTokens.get(invocationToken);
      if (!invocation || invocation.phase === "settled")
        return refuse("invocation_unavailable");
      invocation.phase = "settled";
      invocation.task.pendingCount -= 1;
      return record(null);
    },
    settleTask(taskToken: object, outcome: "finished" | "cleanup_unknown") {
      const task = taskTokens.get(taskToken);
      if (
        !task ||
        task !== activeTask ||
        task.settled ||
        (outcome !== "finished" && outcome !== "cleanup_unknown") ||
        (outcome === "finished" && task.pendingCount !== 0)
      )
        return refuse("task_unavailable");
      if (outcome === "cleanup_unknown" && !stopReason)
        stopReason = "cleanup_unknown";
      task.settled = true;
      activeTask = null;
      return record(null);
    },
    cancel() {
      stopReason ??= "cancelled";
    },
    inspect() {
      return Object.freeze({
        productionAuthorityConferred: false as const,
        invocationCount,
        reservedTaskCount: tasks.filter((task) => task.token !== null).length,
        settledTaskCount: tasks.filter((task) => task.settled).length,
        stopReason,
      });
    },
  });
}
