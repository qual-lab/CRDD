/**
 * 合成Workspace試験の回復開始診断だけを有限に取得する。
 * @responsibility 元stderrの意味を変えず、固定診断を既存の安全な結果へ搬送する。
 * @trace ERB-IT-021
 * @security 生出力・任意本文は保持せず、別Taskの診断を受領しない。
 */
import type { Writable } from "node:stream";
import { inspectRecoveryStartFailureDiagnostic } from "../../coordinator/src/execution/result.ts";
import type { ProviderBoundaryDiagnosticNotice } from "../../coordinator/src/execution/observation.ts";

type Event = Extract<
  ProviderBoundaryDiagnosticNotice,
  { event: "coordinator_provider_recovery_start_failed" }
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
export function captureWorkspaceRecoveryDiagnostic(stream: Writable) {
  const original = stream.write;
  const events: Event[] = [];
  let status: Status = installed ? "collector_unavailable" : "captured";
  let active = !installed;
  let finished = false;
  const exact = (value: object, keys: string[]) =>
    Object.keys(value).sort().join("\0") === keys.sort().join("\0");
  const intercept = function (
    this: Writable,
    chunk: unknown,
    ...rest: unknown[]
  ) {
    if (typeof chunk === "string" && chunk.startsWith(marker)) {
      try {
        if (Buffer.byteLength(chunk, "utf8") > 4096 || events.length >= 16) {
          status = "overflow";
        } else {
          if (!chunk.endsWith("\n") || chunk.slice(0, -1).includes("\n"))
            throw new Error("frame");
          const value = JSON.parse(
            chunk.slice("[Coordinator lifecycle] ".length),
          );
          const diagnostic = inspectRecoveryStartFailureDiagnostic(
            value.diagnostic,
          );
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
            !["codex", "claude"].includes(value.provider) ||
            ![null, "executor", "reviewer"].includes(value.taskRole) ||
            typeof value.operationId !== "string" ||
            !/^OP-[0-9]{6,}$/u.test(value.operationId) ||
            ![0, 1].includes(value.taskAttempt) ||
            typeof value.recoveryCorrelationId !== "string" ||
            !/^operation-[a-f0-9-]{36}$/u.test(value.recoveryCorrelationId) ||
            !diagnostic
          )
            throw new Error("shape");
          const event = Object.freeze({ ...value, diagnostic }) as Event;
          if (
            events.some(
              (old) =>
                old.operationId === event.operationId &&
                old.provider === event.provider &&
                old.taskRole === event.taskRole &&
                old.taskAttempt === event.taskAttempt &&
                old.recoveryCorrelationId === event.recoveryCorrelationId,
            )
          )
            throw new Error("duplicate");
          events.push(event);
        }
      } catch {
        if (status !== "overflow") status = "invalid";
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
    }
  }
  return {
    available: active,
    finish(
      correlationId: string | null,
      recoveryIds: readonly string[],
      expectedFailure: boolean,
      identities: readonly RecoveryDiagnosticIdentity[] = [],
    ) {
      if (finished)
        return {
          captureStatus: "collector_unavailable" as Status,
          events: [],
          closed: false,
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
      return {
        captureStatus: status,
        events: status === "captured" || status === "task_only" ? matched : [],
        closed,
      };
    },
  };
}
