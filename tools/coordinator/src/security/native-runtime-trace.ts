import path from "node:path";

const PROCESS_NAME = /^[a-z0-9][a-z0-9-]*\.exe$/u;
const LOST_BUFFERS = /^Total # Lost Buffers\s*:\s*(\d+)\s*$/gmu;
const LOST_EVENTS = /^Total # Lost Events\s*:\s*(\d+)\s*$/gmu;
const NETWORK_EVENT = /^(?:Microsoft-Windows-TCPIP\/|\s*(?:Tcp|Udp)Ip)/u;

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

type NativeRuntimeTraceOptions = Readonly<{
  targetProcessName: string;
  networkControlProcessName: string;
  expectedTargetImage: string;
  windowsSystem32Directory: string;
}>;

function blocked(reason: NativeRuntimeTraceBlockedReason) {
  return Object.freeze({ status: "blocked" as const, reason });
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function canonicalWindowsPath(value: string): string {
  return path.win32.normalize(value).toLowerCase();
}

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
