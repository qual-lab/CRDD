/**
 * 固定合成Probeの出力と終了値を評価する。
 * @responsibility Probeの合否をExecutorで解釈し、DIへ用途の意味を持ち込まない。
 * @trace ARCH-000008
 */
import type { CommandObservation } from "../../../docker-isolation/src/index.ts";
import type { IsolationProbeFacts } from "./types.ts";
const PROBE_MARKER = "crdd-coordinator-isolation-v1";
type ProbeExecutionObservation = Partial<
  Pick<CommandObservation, "signal" | "status" | "stderr" | "stdout">
> &
  Readonly<{ error?: Error }>;

/** JSON出力の閉じたfield集合を検査する。 */
function isProbeJsonRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/**
 * 診断の完了観測を既存の隔離判定と実行事実へ分類する。
 * @responsibility 生出力を返さず、判定理由・計測・終了値を保持する。
 * @trace ARCH-000008
 * @input execution: 元のProcess観測、elapsedMs: 同じ呼出しの実測値。
 * @returns 隔離判定と後続lifecycle評価に必要な閉事実。
 * @precondition 本番ではDIの所有要求から得た観測を使う。
 * @postcondition 値分類を資源不存在やHost清掃へ昇格しない。
 * @effect N/A: 純粋分類だけ。
 * @failure 期限・容量・不正JSON・非0・Signal・時間不正を区別する。
 * @invariant 既存の理由優先順と30秒の計測評価上限を維持する。
 * @boundary 捕捉出力と上位への最小事実。
 * @security stdout／stderr本文と例外本文を返さない。
 * @concurrency 同期分類だけ。
 */
export function classifyIsolationProbeExecution(
  execution: ProbeExecutionObservation,
  elapsedMs: number,
): IsolationProbeFacts {
  const code =
    execution.error && typeof execution.error === "object"
      ? Object.getOwnPropertyDescriptor(execution.error, "code")?.value
      : undefined;
  const timedOut = code === "ETIMEDOUT";
  const outputExceeded = code === "ENOBUFS";
  const stdoutBytes =
    typeof execution.stdout === "string"
      ? Buffer.byteLength(execution.stdout, "utf8")
      : 0;
  const stderrBytes =
    typeof execution.stderr === "string"
      ? Buffer.byteLength(execution.stderr, "utf8")
      : 0;
  let reason: string;
  let confirmed = false;
  if (timedOut) reason = "docker_isolation_probe_timeout";
  else if (outputExceeded) reason = "docker_isolation_probe_output_too_large";
  else if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string"
  )
    reason = "docker_isolation_probe_failed";
  else if (stdoutBytes > 64 * 1024)
    reason = "docker_isolation_probe_output_too_large";
  else {
    try {
      const parsed: unknown = JSON.parse(execution.stdout.trim());
      const record = isProbeJsonRecord(parsed, [
        "marker",
        "allowed_writes",
        "runtime_paths_absent",
        "credential_names_absent",
        "network_blocked",
        "home_isolated",
        "tmp_isolated",
      ])
        ? parsed
        : null;
      const writes =
        record &&
        isProbeJsonRecord(record.allowed_writes, [
          "workspace",
          "provider-home",
          "tmp",
        ])
          ? record.allowed_writes
          : null;
      confirmed =
        record?.marker === PROBE_MARKER &&
        writes?.workspace === true &&
        writes?.["provider-home"] === true &&
        writes?.tmp === true &&
        record.runtime_paths_absent === true &&
        record.credential_names_absent === true &&
        record.network_blocked === true &&
        record.home_isolated === true &&
        record.tmp_isolated === true;
      reason = confirmed
        ? "docker_fake_provider_isolation_confirmed"
        : "docker_isolation_probe_assertion_failed";
    } catch {
      reason = "docker_isolation_probe_invalid_output";
    }
  }
  const validElapsed =
    Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 30_000;
  const exactEnvelope =
    !execution.error &&
    execution.status === 0 &&
    (execution.signal === null || execution.signal === undefined) &&
    typeof execution.stdout === "string" &&
    typeof execution.stderr === "string" &&
    stdoutBytes <= 64 * 1024 &&
    stderrBytes <= 64 * 1024;
  return Object.freeze({
    isolation: Object.freeze({
      status: confirmed ? ("confirmed" as const) : ("blocked" as const),
      reason,
    }),
    lifecycleStatus:
      validElapsed && exactEnvelope && confirmed
        ? ("candidate" as const)
        : ("blocked" as const),
    lifecycleReason: timedOut
      ? "dynamic_fake_provider_deadline_exceeded"
      : outputExceeded
        ? "dynamic_fake_provider_output_limit_exceeded"
        : !validElapsed
          ? "dynamic_fake_provider_elapsed_invalid"
          : !exactEnvelope
            ? "dynamic_fake_provider_execution_envelope_invalid"
            : confirmed
              ? "dynamic_fake_provider_result_observed"
              : reason,
    elapsedMs: validElapsed ? elapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
    timedOut,
  });
}
