import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type InteractiveConsoleOperationOutcome,
  type InteractiveConsoleReadOutcome,
  type InteractiveConsoleTextWriteOutcome,
  readInteractiveConsoleLineOutcome,
  withInteractiveConsoleAsyncOutcome,
  writeInteractiveConsoleTextOutcome,
} from "../../src/core/interactive-console.ts";

const PROBE_VALUE = "123456";
const INPUT_TIMEOUT_MS = 60_000;
const TIMEOUT_SCENARIO_MS = 5_000;
const CANCEL_SCENARIO_MS = 1_000;

type ProbeScenario = "match" | "mismatch" | "timeout" | "cancel";
type ProbeStatus =
  | "matched"
  | "mismatched"
  | "timeout"
  | "cancelled"
  | "reader_failed"
  | "write_failed"
  | "cleanup_unknown"
  | "unavailable"
  | "operation_failed"
  | "invalid_arguments";
type ProbeHandles = Readonly<{ input: number; output: number }>;

export type TerminalInteractionProbeAdapter = Readonly<{
  withConsole: (
    operation: (handles: ProbeHandles) => Promise<ProbeStatus>,
  ) => Promise<InteractiveConsoleOperationOutcome<ProbeStatus>>;
  writeText: (
    descriptor: number,
    text: string,
  ) => Promise<InteractiveConsoleTextWriteOutcome>;
  readLine: (
    descriptor: number,
    signal: AbortSignal,
  ) => Promise<InteractiveConsoleReadOutcome>;
  scheduleAbort: (callback: () => void, milliseconds: number) => () => void;
}>;

function parseProbeScenario(argv: readonly string[]): ProbeScenario | null {
  if (argv.length !== 1) return null;
  const scenario = argv[0];
  return scenario === "match" ||
    scenario === "mismatch" ||
    scenario === "timeout" ||
    scenario === "cancel"
    ? scenario
    : null;
}

function describeProbeInput(scenario: ProbeScenario): string {
  if (scenario === "timeout")
    return "何も入力せず5秒お待ちください。入力待ちを終了します。";
  if (scenario === "cancel")
    return "何も入力せずお待ちください。1秒後に入力待ちを取り消します。";
  return scenario === "match"
    ? `固定の確認値 ${PROBE_VALUE} を入力してEnterを1回押してください: `
    : "次に進むために654321を入力してEnterを1回押してください: ";
}

function createProbeReport(
  scenario: ProbeScenario | null,
  status: ProbeStatus,
) {
  const expectedStatus =
    scenario === "match"
      ? "matched"
      : scenario === "mismatch"
        ? "mismatched"
        : scenario === "cancel"
          ? "cancelled"
          : "timeout";
  return Object.freeze({
    contract: "crdd-coordinator/terminal-interaction-probe",
    contractRevision: 1,
    scenario,
    status,
    scenarioMatched: scenario !== null && status === expectedStatus,
    cleanupConfirmed:
      status !== "cleanup_unknown" && status !== "operation_failed",
    // This fixture exercises terminal I/O only; it never issues execution consent.
    authorizationIssued: false,
    providerEffectIssued: false,
  });
}

export async function runTerminalInteractionProbeUsingAdapter(
  argv: readonly string[],
  adapter: TerminalInteractionProbeAdapter,
) {
  const scenario = parseProbeScenario(argv);
  if (scenario === null) return createProbeReport(null, "invalid_arguments");

  const outcome = await adapter.withConsole(async (handles) => {
    const notice = await adapter.writeText(
      handles.output,
      describeProbeInput(scenario),
    );
    if (notice.status !== "completed") return notice.status;

    const controller = new AbortController();
    let abortRequested = false;
    const cancelTimer = adapter.scheduleAbort(
      () => {
        abortRequested = true;
        controller.abort();
      },
      scenario === "cancel"
        ? CANCEL_SCENARIO_MS
        : scenario === "timeout"
          ? TIMEOUT_SCENARIO_MS
          : INPUT_TIMEOUT_MS,
    );
    let status: ProbeStatus;
    try {
      const read = await adapter.readLine(handles.input, controller.signal);
      // Never replace uncertain reader cleanup with an expected cancellation.
      status =
        read.status === "cleanup_unknown"
          ? "cleanup_unknown"
          : abortRequested &&
              (read.status === "cancelled" || read.status === "completed")
            ? scenario === "cancel"
              ? "cancelled"
              : "timeout"
            : read.status === "completed"
              ? read.line === null
                ? "reader_failed"
                : read.line === PROBE_VALUE
                  ? "matched"
                  : "mismatched"
              : read.status;
    } finally {
      cancelTimer();
    }
    if (status === "cleanup_unknown") return status;
    const separator = await adapter.writeText(handles.output, "\n");
    return separator.status === "completed" ? status : separator.status;
  });
  return createProbeReport(
    scenario,
    outcome.status === "completed"
      ? (outcome.value ?? "operation_failed")
      : outcome.status,
  );
}

export function runTerminalInteractionProbe(argv: readonly string[]) {
  return runTerminalInteractionProbeUsingAdapter(argv, {
    withConsole: withInteractiveConsoleAsyncOutcome,
    writeText: writeInteractiveConsoleTextOutcome,
    readLine: readInteractiveConsoleLineOutcome,
    scheduleAbort: (callback, milliseconds) => {
      const timer = setTimeout(callback, milliseconds);
      return () => clearTimeout(timer);
    },
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  // The invoking terminal owns window retention. Do not consume another Enter.
  const report = await runTerminalInteractionProbe(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.scenarioMatched ? 0 : 2;
}
