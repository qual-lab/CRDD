/**
 * check-native-runtime-traceに属する責務をまとめる。
 *
 * @responsibility parseCliArgumentsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
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

/**
 * Cli Argumentsを構造化値へ解析する。
 *
 * @responsibility Cli Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input argumentsValues: readonly string[]
 * @returns parseCliArgumentsの計算結果を返す。
 * @precondition 「argumentsValues: readonly string[]」がparseCliArgumentsの入力契約を満たす。
 * @postcondition parseCliArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseCliArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseCliArgumentsは独自の失敗分岐を所有しない。
 * @invariant parseCliArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseCliArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseCliArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseCliArgumentsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Regular Trace Fileを読み取る。
 *
 * @responsibility Regular Trace Fileの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input tracePath: string、maximumBytes: number
 * @returns stringを返す。
 * @precondition 「tracePath: string、maximumBytes: number」がreadRegularTraceFileの入力契約を満たす。
 * @postcondition readRegularTraceFileの責務を完了した結果だけを返す。
 * @effect readRegularTraceFileはFilesystemの読取りまたは書込みを実行する。
 * @failure readRegularTraceFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRegularTraceFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readRegularTraceFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRegularTraceFileは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Native Trace From Argumentsを検証する。
 *
 * @responsibility Native Trace From Argumentsの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: verifyNativeTraceFromArgumentsは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifyNativeTraceFromArgumentsの入力契約を満たす。
 * @postcondition verifyNativeTraceFromArgumentsの責務を完了して呼出し元へ制御を戻す。
 * @effect verifyNativeTraceFromArgumentsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure verifyNativeTraceFromArgumentsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyNativeTraceFromArgumentsは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: verifyNativeTraceFromArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyNativeTraceFromArgumentsは共有非同期状態を持たない同期処理である。
 */
function verifyNativeTraceFromArguments() {
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
}

try {
  verifyNativeTraceFromArguments();
} catch (error) {
  const knownReasons = [
    "native_runtime_trace_arguments_invalid",
    "native_runtime_trace_events_not_regular_file",
    "native_runtime_trace_events_size_invalid",
  ];
  const reason =
    error instanceof Error && knownReasons.includes(error.message)
      ? error.message
      : "native_runtime_trace_file_unavailable";
  process.stderr.write(`${reason}\n`);
  process.exitCode = 1;
}
