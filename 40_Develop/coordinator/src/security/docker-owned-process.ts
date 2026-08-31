import { spawn, type ChildProcess } from "node:child_process";
import { createWindowsDockerCliEnvironment } from "../core/windows-child-environment.ts";

const TASKKILL_EXECUTABLE = "C:\\Windows\\System32\\taskkill.exe";
export const STDOUT_LIMIT_BYTES = 1_048_576;
export const STDERR_LIMIT_BYTES = 262_144;

export type CommandExecution = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;
export type CommandHandle = Readonly<{
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;
export type OwnedCommandHandle = CommandHandle &
  Readonly<{ closed: () => boolean }>;

export function createDockerProcessEnvironment() {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_effect_environment_unavailable");
  return environment;
}

function buffersToExecution(
  child: ChildProcess,
  stdoutChunks: Buffer[],
  stderrChunks: Buffer[],
  outputExceeded: () => boolean,
) {
  return new Promise<CommandExecution>((resolve) => {
    let settled = false;
    const settle = (status: number | null, signal: string | null) => {
      if (settled) return;
      settled = true;
      resolve(
        Object.freeze({
          status,
          signal,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          outputExceeded: outputExceeded(),
        }),
      );
    };
    child.once("error", () => settle(null, null));
    child.once("close", (status, signal) => settle(status, signal));
  });
}

function bounded<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function startOwnedProcess(
  executable: string,
  argv: readonly string[],
  environment: Readonly<Record<string, string>>,
  stdin: string | null,
): OwnedCommandHandle {
  const child = spawn(executable, [...argv], {
    windowsHide: true,
    shell: false,
    env: environment,
    stdio: [stdin === null ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let exceeded = false;
  let transportFailed = false;
  let closed = false;
  let terminationRequested = false;
  if (!child.stdout || !child.stderr)
    throw new Error("docker_effect_stdio_unavailable");
  if (stdin !== null) {
    if (!child.stdin) throw new Error("docker_effect_stdin_unavailable");
    child.stdin.once("error", () => {
      transportFailed = true;
    });
    child.stdin.end(stdin, "utf8");
  }
  const append = (chunk: Buffer | string, isStdout: boolean) => {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (isStdout) stdoutBytes += value.byteLength;
    else stderrBytes += value.byteLength;
    if (stdoutBytes > STDOUT_LIMIT_BYTES || stderrBytes > STDERR_LIMIT_BYTES) {
      exceeded = true;
      void terminateAndWait(5_000);
      return;
    }
    (isStdout ? stdoutChunks : stderrChunks).push(value);
  };
  child.stdout.on("data", (chunk) => append(chunk, true));
  child.stderr.on("data", (chunk) => append(chunk, false));
  child.once("close", () => {
    closed = true;
  });
  const completion = buffersToExecution(
    child,
    stdoutChunks,
    stderrChunks,
    () => exceeded || transportFailed,
  );

  async function terminateAndWait(graceMs: number) {
    if (!closed && !terminationRequested) {
      terminationRequested = true;
      const pid = child.pid;
      if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0)
        return false;
      const killer = spawn(
        TASKKILL_EXECUTABLE,
        ["/PID", String(pid), "/T", "/F"],
        {
          windowsHide: true,
          shell: false,
          env: createDockerProcessEnvironment(),
          stdio: "ignore",
        },
      );
      await bounded(
        new Promise<void>((resolve) => {
          killer.once("error", () => resolve());
          killer.once("close", () => resolve());
        }),
        graceMs,
        undefined,
      );
    }
    await bounded(completion, graceMs, null);
    return closed;
  }

  return Object.freeze({
    wait: (timeoutMs: number) => bounded(completion, timeoutMs, null),
    terminateAndWait,
    closed: () => closed,
  });
}
