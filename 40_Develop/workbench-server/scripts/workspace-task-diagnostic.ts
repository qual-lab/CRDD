/**
 * 合成Workspace試験の回復開始・候補検査診断を一つの取得器で有限に取得する。
 * @responsibility 元stderrの意味を変えず、固定診断を既存の安全な結果へ搬送する。
 * @trace ERB-IT-021
 * @security 生出力・任意本文は保持せず、別Taskの診断を受領しない。
 */
import type { Writable } from "node:stream";
import { parseUnambiguousJsonDocument } from "../../ai-adapter/src/index.ts";
import {
  inspectRecoveryStartFailureDiagnostic,
  inspectCandidateValidationFailureDiagnostic,
  inspectTaskStageDiagnostic,
} from "../../coordinator/src/execution/result.ts";
import type { ProviderBoundaryDiagnosticNotice } from "../../coordinator/src/execution/observation.ts";

type Event = Extract<
  ProviderBoundaryDiagnosticNotice,
  { event: "coordinator_provider_recovery_start_failed" }
>;
type CandidateEvent = Extract<
  ProviderBoundaryDiagnosticNotice,
  { event: "coordinator_task_candidate_validation_failed" }
>;
type StageEvent = Extract<
  ProviderBoundaryDiagnosticNotice,
  { event: "coordinator_task_stage_observed" }
>;
type Status =
  | "captured"
  | "task_only"
  | "missing"
  | "invalid"
  | "overflow"
  | "collector_unavailable";
let installed = false;
export type RecoveryDiagnosticIdentity = Readonly<{
  provider: "codex" | "claude";
  taskRole: "executor" | "reviewer" | null;
  taskAttempt: 0 | 1;
  operationId: string;
  recoveryCorrelationId: string | null;
  recoveryId: string;
}>;
const marker =
  '[Coordinator lifecycle] {"event":"coordinator_provider_recovery_start_failed"';

/** 同Processで一つだけ取得し、Owner終了後に元のwriteへ復元する。 */
export function captureWorkspaceTaskDiagnostic(stream: Writable) {
  const original = stream.write;
  const events: Event[] = [];
  const candidateEvents: CandidateEvent[] = [];
  const stageEvents: StageEvent[] = [];
  let status: Status = installed ? "collector_unavailable" : "captured";
  let candidateStatus: Status | "task_history_only" = status;
  let stageStatus: Status | "task_history_only" = status;
  let active = !installed;
  let finished = false;
  const exact = (value: object, keys: string[]) =>
    Object.keys(value).sort().join("\0") === keys.sort().join("\0");
  const intercept = function (
    this: Writable,
    chunk: unknown,
    ...rest: unknown[]
  ) {
    const isStage =
      typeof chunk === "string" &&
      chunk.startsWith(
        '[Coordinator lifecycle] {"event":"coordinator_task_stage_observed"',
      );
    const isCandidate =
      typeof chunk === "string" &&
      chunk.startsWith(
        '[Coordinator lifecycle] {"event":"coordinator_task_candidate_validation_failed"',
      );
    if (
      typeof chunk === "string" &&
      (chunk.startsWith(marker) || isCandidate || isStage)
    ) {
      try {
        if (
          Buffer.byteLength(chunk, "utf8") > 4096 ||
          events.length + candidateEvents.length + stageEvents.length >= 16
        ) {
          if (isStage) stageStatus = "overflow";
          else if (isCandidate) candidateStatus = "overflow";
          else status = "overflow";
        } else {
          if (!chunk.endsWith("\n") || chunk.slice(0, -1).includes("\n"))
            throw new Error("frame");
          const parsed = parseUnambiguousJsonDocument(
            chunk.slice("[Coordinator lifecycle] ".length),
          );
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            throw new Error("shape");
          const value = parsed as Record<string, unknown>;
          if (
            value.event !==
            (isStage
              ? "coordinator_task_stage_observed"
              : isCandidate
                ? "coordinator_task_candidate_validation_failed"
                : "coordinator_provider_recovery_start_failed")
          )
            throw new Error("event");
          const diagnostic = isStage
            ? inspectTaskStageDiagnostic(value.diagnostic)
            : isCandidate
              ? inspectCandidateValidationFailureDiagnostic(value.diagnostic)
              : inspectRecoveryStartFailureDiagnostic(value.diagnostic);
          if (
            !exact(value, [
              "event",
              "provider",
              "taskRole",
              "operationId",
              "taskAttempt",
              "recoveryCorrelationId",
              "diagnostic",
            ]) ||
            !["codex", "claude"].includes(value.provider as string) ||
            ![null, "executor", "reviewer"].includes(
              value.taskRole as string | null,
            ) ||
            (isCandidate && value.taskRole !== "executor") ||
            (isStage &&
              (!diagnostic ||
                !("taskRole" in diagnostic) ||
                diagnostic.taskRole !== value.taskRole)) ||
            typeof value.operationId !== "string" ||
            !/^OP-[0-9]{6,}$/u.test(value.operationId) ||
            ![0, 1].includes(value.taskAttempt as number) ||
            typeof value.recoveryCorrelationId !== "string" ||
            !/^operation-[a-f0-9-]{36}$/u.test(value.recoveryCorrelationId) ||
            !diagnostic
          )
            throw new Error("shape");
          const event = Object.freeze({ ...value, diagnostic }) as
            | Event
            | CandidateEvent
            | StageEvent;
          if (
            (isStage
              ? stageEvents
              : isCandidate
                ? candidateEvents
                : events
            ).some(
              (old) =>
                old.operationId === event.operationId &&
                old.provider === event.provider &&
                old.taskRole === event.taskRole &&
                old.taskAttempt === event.taskAttempt &&
                old.recoveryCorrelationId === event.recoveryCorrelationId,
            )
          )
            throw new Error("duplicate");
          if (isStage) stageEvents.push(event as StageEvent);
          else if (isCandidate) candidateEvents.push(event as CandidateEvent);
          else events.push(event as Event);
        }
      } catch {
        if (isStage) {
          if (stageStatus !== "overflow") stageStatus = "invalid";
        } else if (isCandidate) {
          if (candidateStatus !== "overflow") candidateStatus = "invalid";
        } else if (status !== "overflow") status = "invalid";
      }
    }
    return Reflect.apply(original, this, [chunk, ...rest]);
  } as typeof stream.write;
  if (active) {
    try {
      stream.write = intercept;
      installed = true;
    } catch {
      active = false;
      status = "collector_unavailable";
      candidateStatus = "collector_unavailable";
      stageStatus = "collector_unavailable";
    }
  }
  return {
    available: active,
    finish(
      correlationId: string | null,
      recoveryIds: readonly string[],
      expectedFailure: boolean,
      identities: readonly RecoveryDiagnosticIdentity[] = [],
      expectedCandidateFailure = false,
      historyIdentities: readonly Readonly<{
        operationId: string;
        recoveryCorrelationId: string | null;
        recoveryId: string;
      }>[] = [],
      expectedStages = false,
    ) {
      if (finished)
        return {
          captureStatus: "collector_unavailable" as Status,
          events: [],
          closed: false,
          candidateValidation: {
            captureStatus: "collector_unavailable",
            events: [],
            closed: false,
          },
          stages: {
            captureStatus: "collector_unavailable",
            events: [],
            closed: false,
          },
        };
      finished = true;
      let closed = !active;
      if (active) {
        closed = stream.write === intercept;
        if (closed) {
          try {
            stream.write = original;
            closed = stream.write === original;
            if (!closed) status = "invalid";
          } catch {
            closed = false;
            status = "invalid";
          }
        } else status = "invalid";
        if (closed && stream.write === original) installed = false;
        active = false;
      }
      if (!closed) candidateStatus = "invalid";
      if (!closed) stageStatus = "invalid";
      let taskOnly = false;
      const matched = events.filter((event) => {
        if (
          (event.taskRole === "executor" && event.provider !== "codex") ||
          (event.taskRole === "reviewer" && event.provider !== "claude")
        )
          return false;
        const related = identities.filter(
          (identity) => identity.recoveryId === event.diagnostic.recoveryId,
        );
        if (related.length)
          return (
            related.length === 1 &&
            related[0]?.provider === event.provider &&
            related[0]?.taskRole === event.taskRole &&
            related[0]?.taskAttempt === event.taskAttempt &&
            related[0]?.operationId === event.operationId &&
            related[0]?.recoveryCorrelationId === event.recoveryCorrelationId &&
            event.recoveryCorrelationId === correlationId &&
            recoveryIds.includes(event.diagnostic.recoveryId as string)
          );
        taskOnly = true;
        return (
          event.recoveryCorrelationId === correlationId &&
          (event.diagnostic.recoveryId === null ||
            recoveryIds.includes(event.diagnostic.recoveryId))
        );
      });
      if (matched.length !== events.length && status === "captured")
        status = "invalid";
      if (!events.length && expectedFailure && status === "captured")
        status = "missing";
      if (matched.length && taskOnly && status === "captured")
        status = "task_only";
      let historyOnly = false;
      const matchedCandidates = candidateEvents.filter((event) => {
        if (
          event.provider !== "codex" ||
          event.taskRole !== "executor" ||
          event.recoveryCorrelationId !== correlationId
        )
          return false;
        const related = identities.filter(
          (i) =>
            i.operationId === event.operationId &&
            i.provider === event.provider &&
            i.taskRole === event.taskRole &&
            i.taskAttempt === event.taskAttempt,
        );
        if (related.length)
          return (
            related.length === 1 &&
            related[0]?.recoveryCorrelationId === correlationId
          );
        const history = historyIdentities.filter(
          (i) =>
            i.operationId === event.operationId &&
            i.recoveryCorrelationId === correlationId,
        );
        if (
          !history.length ||
          history.some(
            (i) => typeof i.recoveryId !== "string" || !i.recoveryId.length,
          ) ||
          new Set(history.map((i) => i.recoveryId)).size !== history.length
        )
          return false;
        historyOnly = true;
        return true;
      });
      if (
        matchedCandidates.length !== candidateEvents.length &&
        candidateStatus === "captured"
      )
        candidateStatus = "invalid";
      if (
        !candidateEvents.length &&
        expectedCandidateFailure &&
        candidateStatus === "captured"
      )
        candidateStatus = "missing";
      if (
        matchedCandidates.length &&
        historyOnly &&
        candidateStatus === "captured"
      )
        candidateStatus = "task_history_only";
      let stageHistoryOnly = false;
      const matchedStages = stageEvents.filter((event) => {
        if (
          event.recoveryCorrelationId !== correlationId ||
          (event.taskRole === "executor"
            ? event.provider !== "codex"
            : event.provider !== "claude")
        )
          return false;
        const related = identities.filter(
          (i) =>
            i.operationId === event.operationId &&
            i.provider === event.provider &&
            i.taskRole === event.taskRole &&
            i.taskAttempt === event.taskAttempt,
        );
        if (related.length)
          return (
            related.length === 1 &&
            related[0]?.recoveryCorrelationId === correlationId
          );
        const history = historyIdentities.filter(
          (i) =>
            i.operationId === event.operationId &&
            i.recoveryCorrelationId === correlationId,
        );
        if (
          !history.length ||
          history.some((i) => !i.recoveryId) ||
          new Set(history.map((i) => i.recoveryId)).size !== history.length
        )
          return false;
        stageHistoryOnly = true;
        return true;
      });
      if (
        matchedStages.length !== stageEvents.length &&
        stageStatus === "captured"
      )
        stageStatus = "invalid";
      if (
        matchedStages.length &&
        stageHistoryOnly &&
        stageStatus === "captured"
      )
        stageStatus = "task_history_only";
      if (
        expectedStages &&
        (stageStatus === "captured" || stageStatus === "task_history_only")
      ) {
        const sequence = matchedStages
          .map((e) => `${e.taskRole}:${e.taskAttempt}`)
          .join(",");
        if (
          sequence !== "executor:0,reviewer:0" &&
          sequence !== "executor:0,reviewer:0,executor:1,reviewer:1"
        )
          stageStatus = "missing";
      }
      return {
        captureStatus: status,
        events: status === "captured" || status === "task_only" ? matched : [],
        closed,
        stages: {
          captureStatus: stageStatus,
          events:
            stageStatus === "captured" || stageStatus === "task_history_only"
              ? matchedStages
              : [],
          closed,
        },
        candidateValidation: {
          captureStatus: candidateStatus,
          events:
            candidateStatus === "captured" ||
            candidateStatus === "task_history_only"
              ? matchedCandidates
              : [],
          closed,
        },
      };
    },
  };
}
