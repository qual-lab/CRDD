import fs from "node:fs";
import path from "node:path";
import { inspectNativeRuntimeTrace } from "../src/security/native-runtime-trace.ts";

const MAXIMUM_EVENT_BYTES = 128 * 1024 * 1024;
const MAXIMUM_STATISTICS_BYTES = 1024 * 1024;
const ARGUMENT_KEYS = Object.freeze([
  "--events",
  "--trace-stats",
  "--target-process",
  "--control-process",
  "--expected-image",
  "--system32",
]);

function parseCliArguments(argumentsValues: readonly string[]) {
  if (argumentsValues.length !== ARGUMENT_KEYS.length * 2) return null;
  const values = new Map<string, string>();
  for (let offset = 0; offset < argumentsValues.length; offset += 2) {
    const key = argumentsValues[offset];
    const value = argumentsValues[offset + 1];
    if (!key || !value || !ARGUMENT_KEYS.includes(key) || values.has(key)) {
      return null;
    }
    values.set(key, value);
  }
  return values.size === ARGUMENT_KEYS.length ? values : null;
}

function readRegularTraceFile(tracePath: string, maximumBytes: number): string {
  const stats = fs.lstatSync(tracePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error("native_runtime_trace_events_not_regular_file");
  }
  const resolvedPath = fs.realpathSync.native(tracePath);
  const resolvedStats = fs.statSync(resolvedPath);
  if (resolvedStats.size <= 0 || resolvedStats.size > maximumBytes) {
    throw new Error("native_runtime_trace_events_size_invalid");
  }
  return fs.readFileSync(resolvedPath, "utf8");
}

const values = parseCliArguments(process.argv.slice(2));
if (!values) throw new Error("native_runtime_trace_arguments_invalid");
const eventsPath = values.get("--events");
const traceStatisticsPath = values.get("--trace-stats");
const targetProcessName = values.get("--target-process");
const networkControlProcessName = values.get("--control-process");
const expectedTargetImage = values.get("--expected-image");
const windowsSystem32Directory = values.get("--system32");
if (
  !eventsPath ||
  !traceStatisticsPath ||
  !targetProcessName ||
  !networkControlProcessName ||
  !expectedTargetImage ||
  !windowsSystem32Directory ||
  !path.isAbsolute(eventsPath) ||
  !path.isAbsolute(traceStatisticsPath)
) {
  throw new Error("native_runtime_trace_arguments_invalid");
}

const result = inspectNativeRuntimeTrace(
  readRegularTraceFile(eventsPath, MAXIMUM_EVENT_BYTES),
  readRegularTraceFile(traceStatisticsPath, MAXIMUM_STATISTICS_BYTES),
  {
    targetProcessName,
    networkControlProcessName,
    expectedTargetImage,
    windowsSystem32Directory,
  },
);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== "accepted") process.exitCode = 2;
