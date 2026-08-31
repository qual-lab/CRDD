import { spawn } from "node:child_process";
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
  let closed = false;
  let terminationRequested = false;
  let isTerminationHelperClosed = true;
  let terminationHelperCompletion: Promise<void> | null = null;
  // A spawn error is an execution result, not proof that all stdio closed.
  const closeCompletion = new Promise<void>((resolve) => {
    child.once("close", () => {
      closed = true;
      resolve();
    });
  });
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
  const completion = new Promise<CommandExecution>((resolve) => {
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
          outputExceeded: exceeded,
        }),
      );
    };
    child.once("error", () => settle(null, null));
    child.once("close", (status, signal) => settle(status, signal));
    const failTransport = () => {
      settle(null, null);
    };
    // Own error/close before touching streams: EMFILE/ENFILE may return a
    // ChildProcess without stdio, then emit error on the next tick.
    try {
      child.stdout?.on("error", failTransport);
      child.stderr?.on("error", failTransport);
      child.stdin?.on("error", failTransport);
      child.stdout?.on("data", (chunk) => append(chunk, true));
      child.stderr?.on("data", (chunk) => append(chunk, false));
      if (!child.stdout || !child.stderr || (stdin !== null && !child.stdin)) {
        failTransport();
      } else if (stdin !== null) {
        child.stdin?.end(stdin, "utf8");
      }
    } catch {
      failTransport();
    }
  });

  async function terminateAndWait(graceMs: number) {
    if (!closed && !terminationRequested) {
      terminationRequested = true;
      const pid = child.pid;
      if (typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0) {
        try {
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
          isTerminationHelperClosed = false;
          terminationHelperCompletion = new Promise<void>((resolve) => {
            killer.once("error", () => undefined);
            killer.once("close", () => {
              isTerminationHelperClosed = true;
              resolve();
            });
          });
        } catch {
          // Failure to launch the killer neither proves nor disproves that
          // the owned child closed; retain ownership and observe its close.
        }
      }
    }
    await bounded(
      Promise.all([closeCompletion, terminationHelperCompletion]).then(
        () => undefined,
      ),
      graceMs,
      undefined,
    );
    return closed && isTerminationHelperClosed;
  }

  return Object.freeze({
    wait: (timeoutMs: number) => bounded(completion, timeoutMs, null),
    terminateAndWait,
    closed: () => closed && isTerminationHelperClosed,
  });
}
