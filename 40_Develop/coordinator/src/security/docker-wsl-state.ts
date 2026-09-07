export type WslListCompletion = Readonly<{
  status: number | null;
  signal: string | null;
  error?: unknown;
  stdout: Uint8Array;
  stderr: Uint8Array;
}>;

export type DockerWslState = "stopped" | "running" | "unknown";

function parseDistributionList(
  result: WslListCompletion,
): readonly string[] | null {
  if (
    result.status !== 0 ||
    result.signal !== null ||
    result.error != null ||
    !(result.stdout instanceof Uint8Array) ||
    !(result.stderr instanceof Uint8Array) ||
    result.stderr.byteLength !== 0 ||
    result.stdout.byteLength > 65_536
  )
    return null;
  const bytes = result.stdout;
  if (bytes.byteLength === 0) return [];
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || bytes.includes(0);
  if (isUtf16 && bytes.byteLength % 2 !== 0) return null;
  try {
    const text = new TextDecoder(isUtf16 ? "utf-16le" : "utf-8", {
      fatal: true,
    }).decode(bytes);
    const lines = text.replace(/\r\n/gu, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (
      lines.length === 0 ||
      lines.some((line) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(line))
    )
      return null;
    const foldedNames = lines.map((line) => line.toLowerCase());
    return new Set(foldedNames).size === foldedNames.length ? foldedNames : null;
  } catch {
    return null;
  }
}

/** This is a point-in-time list observation, not a restart completion proof. */
export function observeDockerWslState(
  registeredResult: WslListCompletion,
  runningResult: WslListCompletion,
): DockerWslState {
  const registeredNames = parseDistributionList(registeredResult);
  const runningNames = parseDistributionList(runningResult);
  if (
    !registeredNames ||
    !runningNames ||
    !registeredNames.includes("docker-desktop") ||
    runningNames.some((name) => !registeredNames.includes(name))
  )
    return "unknown";
  return runningNames.includes("docker-desktop") ? "running" : "stopped";
}
