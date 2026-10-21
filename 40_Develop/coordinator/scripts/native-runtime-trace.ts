/**
 * native-runtime-traceに属する責務をまとめる。
 *
 * @responsibility NativeRuntimeTraceBlockedReasonを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import path from "node:path";

const PROCESS_NAME = /^[a-z0-9][a-z0-9-]*\.exe$/u;
const LOST_BUFFERS = /^Total # Lost Buffers\s*:\s*(\d+)\s*$/gmu;
const LOST_EVENTS = /^Total # Lost Events\s*:\s*(\d+)\s*$/gmu;
const NETWORK_EVENT = /^(?:Microsoft-Windows-TCPIP\/|\s*(?:Tcp|Udp)Ip)/u;

/**
 * native-runtime-traceで使用するNative Runtime Trace Blocked Reasonの値契約を定義する。
 *
 * @responsibility Native Runtime Trace Blocked ReasonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape NativeRuntimeTraceBlockedReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant NativeRuntimeTraceBlockedReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: NativeRuntimeTraceBlockedReasonの宣言は外部境界を開かない。
 * @security NativeRuntimeTraceBlockedReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility NativeRuntimeTraceBlockedReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type NativeRuntimeTraceBlockedReason =
  | "input_invalid"
  | "trace_summary_invalid"
  | "trace_events_lost"
  | "target_process_population_invalid"
  | "target_process_completion_invalid"
  | "target_module_population_invalid"
  | "target_image_invalid"
  | "target_module_origin_invalid"
  | "target_network_effect_observed"
  | "network_control_population_invalid"
  | "network_control_effect_unobserved"
  | "network_control_scope_invalid";

/**
 * native-runtime-traceで使用するNative Runtime Trace Optionsの値契約を定義する。
 *
 * @responsibility Native Runtime Trace OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape NativeRuntimeTraceOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant NativeRuntimeTraceOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: NativeRuntimeTraceOptionsの宣言は外部境界を開かない。
 * @security NativeRuntimeTraceOptionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility NativeRuntimeTraceOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type NativeRuntimeTraceOptions = Readonly<{
  targetProcessName: string;
  networkControlProcessName: string;
  expectedTargetImage: string;
  windowsSystem32Directory: string;
}>;

/**
 * native-runtime-traceを停止結果として構築する。
 *
 * @responsibility native-runtime-traceの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: NativeRuntimeTraceBlockedReason
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: NativeRuntimeTraceBlockedReason」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: NativeRuntimeTraceBlockedReason) {
  return Object.freeze({ status: "blocked" as const, reason });
}

/**
 * escape Regular Expressionを決定する。
 *
 * @responsibility escape Regular Expressionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns stringを返す。
 * @precondition 「value: string」がescapeRegularExpressionの入力契約を満たす。
 * @postcondition escapeRegularExpressionの責務を完了した結果だけを返す。
 * @effect N/A: escapeRegularExpressionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: escapeRegularExpressionは独自の失敗分岐を所有しない。
 * @invariant escapeRegularExpressionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: escapeRegularExpressionはProcess内の同一Subsystemで完結する。
 * @security escapeRegularExpressionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: escapeRegularExpressionは共有非同期状態を持たない同期処理である。
 */
function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * canonical Windows Pathを決定する。
 *
 * @responsibility canonical Windows Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns stringを返す。
 * @precondition 「value: string」がcanonicalWindowsPathの入力契約を満たす。
 * @postcondition canonicalWindowsPathの責務を完了した結果だけを返す。
 * @effect N/A: canonicalWindowsPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalWindowsPathは独自の失敗分岐を所有しない。
 * @invariant canonicalWindowsPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalWindowsPathはProcess内の同一Subsystemで完結する。
 * @security canonicalWindowsPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalWindowsPathは共有非同期状態を持たない同期処理である。
 */
function canonicalWindowsPath(value: string): string {
  return path.win32.normalize(value).toLowerCase();
}

/**
 * Exact Loopback Addressかを判定する。
 *
 * @responsibility Exact Loopback Addressの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input address: string
 * @returns booleanを返す。
 * @precondition 「address: string」がisExactLoopbackAddressの入力契約を満たす。
 * @postcondition isExactLoopbackAddressの責務を完了した結果だけを返す。
 * @effect N/A: isExactLoopbackAddressは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExactLoopbackAddressは独自の失敗分岐を所有しない。
 * @invariant isExactLoopbackAddressは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExactLoopbackAddressはProcess内の同一Subsystemで完結する。
 * @security isExactLoopbackAddressはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isExactLoopbackAddressは共有非同期状態を持たない同期処理である。
 */
function isExactLoopbackAddress(address: string): boolean {
  const canonical = address.toLowerCase();
  if (canonical === "[::1]" || canonical.startsWith("[::1]:")) return true;

  const host = canonical.split(":", 1)[0];
  if (!host) return false;
  const octets = host.split(".").map((octet) => Number.parseInt(octet, 10));
  return (
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    ) &&
    octets[0] === 127 &&
    octets[1] === 0 &&
    octets[2] === 0 &&
    octets[3] === 1
  );
}

/**
 * process Start Idsを決定する。
 *
 * @responsibility process Start Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input lines: readonly string[]、processName: string
 * @returns processStartIdsの計算結果を返す。
 * @precondition 「lines: readonly string[]、processName: string」がprocessStartIdsの入力契約を満たす。
 * @postcondition processStartIdsの責務を完了した結果だけを返す。
 * @effect N/A: processStartIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: processStartIdsは独自の失敗分岐を所有しない。
 * @invariant processStartIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: processStartIdsはProcess内の同一Subsystemで完結する。
 * @security processStartIdsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: processStartIdsは共有非同期状態を持たない同期処理である。
 */
function processStartIds(lines: readonly string[], processName: string) {
  const pattern = new RegExp(
    `^\\s*P-Start,\\s*\\d+,\\s*${escapeRegularExpression(processName)} \\(\\s*(\\d+)\\),`,
    "u",
  );
  return lines.flatMap((line) => {
    const match = pattern.exec(line);
    return match?.[1] ? [Number.parseInt(match[1], 10)] : [];
  });
}

/**
 * Exact Process Endが存在するかを判定する。
 *
 * @responsibility Exact Process Endの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input lines: readonly string[]、processName: string、processId: number
 * @returns booleanを返す。
 * @precondition 「lines: readonly string[]、processName: string、processId: number」がhasExactProcessEndの入力契約を満たす。
 * @postcondition hasExactProcessEndの責務を完了した結果だけを返す。
 * @effect N/A: hasExactProcessEndは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasExactProcessEndは独自の失敗分岐を所有しない。
 * @invariant hasExactProcessEndは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasExactProcessEndはProcess内の同一Subsystemで完結する。
 * @security hasExactProcessEndはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasExactProcessEndは共有非同期状態を持たない同期処理である。
 */
function hasExactProcessEnd(
  lines: readonly string[],
  processName: string,
  processId: number,
): boolean {
  const token = `${processName} (${processId})`;
  return (
    lines.filter((line) => /^\s*P-End,/u.test(line) && line.includes(token))
      .length === 1
  );
}

/**
 * image Pathsを決定する。
 *
 * @responsibility image Pathsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input lines: readonly string[]、processName: string、processId: number
 * @returns imagePathsの計算結果を返す。
 * @precondition 「lines: readonly string[]、processName: string、processId: number」がimagePathsの入力契約を満たす。
 * @postcondition imagePathsの責務を完了した結果だけを返す。
 * @effect N/A: imagePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: imagePathsは独自の失敗分岐を所有しない。
 * @invariant imagePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: imagePathsはProcess内の同一Subsystemで完結する。
 * @security imagePathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: imagePathsは共有非同期状態を持たない同期処理である。
 */
function imagePaths(
  lines: readonly string[],
  processName: string,
  processId: number,
) {
  const token = `${processName} (${processId})`;
  const images = new Map<string, string>();
  for (const line of lines) {
    if (!/^\s*I-Start,/u.test(line) || !line.includes(token)) continue;
    const match = /"([A-Za-z]:\\[^"]+)"/u.exec(line);
    if (!match?.[1]) return null;
    const imagePath = path.win32.normalize(match[1]);
    images.set(canonicalWindowsPath(imagePath), imagePath);
  }
  return [...images.values()].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

/**
 * network Event Linesを決定する。
 *
 * @responsibility network Event Linesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input lines: readonly string[]、processName: string、processId: number
 * @returns readonly string[]を返す。
 * @precondition 「lines: readonly string[]、processName: string、processId: number」がnetworkEventLinesの入力契約を満たす。
 * @postcondition networkEventLinesの責務を完了した結果だけを返す。
 * @effect N/A: networkEventLinesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: networkEventLinesは独自の失敗分岐を所有しない。
 * @invariant networkEventLinesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: networkEventLinesはProcess内の同一Subsystemで完結する。
 * @security networkEventLinesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: networkEventLinesは共有非同期状態を持たない同期処理である。
 */
function networkEventLines(
  lines: readonly string[],
  processName: string,
  processId: number,
): readonly string[] {
  const token = `${processName} (${processId})`;
  return lines.filter(
    (line) => NETWORK_EVENT.test(line) && line.includes(token),
  );
}

/**
 * Native Runtime Traceを観測する。
 *
 * @responsibility Native Runtime Traceの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rawEvents: unknown、rawTraceStatistics: unknown、options: NativeRuntimeTraceOptions
 * @returns inspectNativeRuntimeTraceの計算結果を返す。
 * @precondition 「rawEvents: unknown、rawTraceStatistics: unknown、options: NativeRuntimeTraceOptions」がinspectNativeRuntimeTraceの入力契約を満たす。
 * @postcondition inspectNativeRuntimeTraceの責務を完了した結果だけを返す。
 * @effect N/A: inspectNativeRuntimeTraceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectNativeRuntimeTraceは独自の失敗分岐を所有しない。
 * @invariant inspectNativeRuntimeTraceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectNativeRuntimeTraceはProcess内の同一Subsystemで完結する。
 * @security inspectNativeRuntimeTraceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectNativeRuntimeTraceは共有非同期状態を持たない同期処理である。
 */
export function inspectNativeRuntimeTrace(
  rawEvents: unknown,
  rawTraceStatistics: unknown,
  options: NativeRuntimeTraceOptions,
) {
  if (
    typeof rawEvents !== "string" ||
    rawEvents.length === 0 ||
    rawEvents.length > 128 * 1024 * 1024 ||
    typeof rawTraceStatistics !== "string" ||
    rawTraceStatistics.length === 0 ||
    rawTraceStatistics.length > 1024 * 1024 ||
    !PROCESS_NAME.test(options.targetProcessName) ||
    !PROCESS_NAME.test(options.networkControlProcessName) ||
    options.targetProcessName === options.networkControlProcessName ||
    !path.win32.isAbsolute(options.expectedTargetImage) ||
    !path.win32.isAbsolute(options.windowsSystem32Directory)
  ) {
    return blocked("input_invalid");
  }

  const lostBufferMatches = [...rawTraceStatistics.matchAll(LOST_BUFFERS)];
  const lostEventMatches = [...rawTraceStatistics.matchAll(LOST_EVENTS)];
  if (
    lostBufferMatches.length !== 1 ||
    lostEventMatches.length !== 1 ||
    !lostBufferMatches[0]?.[1] ||
    !lostEventMatches[0]?.[1]
  ) {
    return blocked("trace_summary_invalid");
  }
  const lostBuffers = Number.parseInt(lostBufferMatches[0][1], 10);
  const lostEvents = Number.parseInt(lostEventMatches[0][1], 10);
  if (lostEvents !== 0 || lostBuffers !== 0) {
    return blocked("trace_events_lost");
  }

  const lines = rawEvents.split(/\r?\n/u);
  const targetProcessIds = processStartIds(lines, options.targetProcessName);
  if (targetProcessIds.length !== 1 || targetProcessIds[0] === undefined) {
    return blocked("target_process_population_invalid");
  }
  const targetProcessId = targetProcessIds[0];
  if (!hasExactProcessEnd(lines, options.targetProcessName, targetProcessId)) {
    return blocked("target_process_completion_invalid");
  }

  const modules = imagePaths(lines, options.targetProcessName, targetProcessId);
  if (!modules || modules.length === 0) {
    return blocked("target_module_population_invalid");
  }
  const expectedTargetImage = canonicalWindowsPath(options.expectedTargetImage);
  if (
    modules.filter(
      (modulePath) => canonicalWindowsPath(modulePath) === expectedTargetImage,
    ).length !== 1
  ) {
    return blocked("target_image_invalid");
  }
  const system32Prefix = `${canonicalWindowsPath(
    options.windowsSystem32Directory,
  )}\\`;
  if (
    modules.some((modulePath) => {
      const canonicalModule = canonicalWindowsPath(modulePath);
      return (
        canonicalModule !== expectedTargetImage &&
        !canonicalModule.startsWith(system32Prefix)
      );
    })
  ) {
    return blocked("target_module_origin_invalid");
  }

  const targetNetworkEvents = networkEventLines(
    lines,
    options.targetProcessName,
    targetProcessId,
  );
  if (targetNetworkEvents.length !== 0) {
    return blocked("target_network_effect_observed");
  }

  const controlProcessIds = processStartIds(
    lines,
    options.networkControlProcessName,
  );
  if (controlProcessIds.length !== 1 || controlProcessIds[0] === undefined) {
    return blocked("network_control_population_invalid");
  }
  const controlProcessId = controlProcessIds[0];
  if (
    !hasExactProcessEnd(
      lines,
      options.networkControlProcessName,
      controlProcessId,
    )
  ) {
    return blocked("network_control_population_invalid");
  }
  const controlNetworkEvents = networkEventLines(
    lines,
    options.networkControlProcessName,
    controlProcessId,
  );
  if (controlNetworkEvents.length === 0) {
    return blocked("network_control_effect_unobserved");
  }
  const controlAddresses = controlNetworkEvents.flatMap((line) => [
    ...(line.match(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/gu) ?? []),
    ...(line.match(/\[[0-9a-f:]+\](?::\d+)?/giu) ?? []),
  ]);
  if (
    controlAddresses.length === 0 ||
    controlAddresses.some((address) => !isExactLoopbackAddress(address))
  ) {
    return blocked("network_control_scope_invalid");
  }

  return Object.freeze({
    status: "accepted" as const,
    trace: Object.freeze({ lostEvents, lostBuffers }),
    target: Object.freeze({
      processName: options.targetProcessName,
      processId: targetProcessId,
      completed: true,
      modules: Object.freeze(modules),
      moduleCount: modules.length,
      networkEventCount: targetNetworkEvents.length,
    }),
    networkControl: Object.freeze({
      processName: options.networkControlProcessName,
      processId: controlProcessId,
      networkEventCount: controlNetworkEvents.length,
    }),
  });
}
