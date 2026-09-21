import { spawn } from "node:child_process";
import { createWindowsDockerCliEnvironment } from "../core/windows-child-environment.ts";

const TASKKILL_EXECUTABLE = "C:\\Windows\\System32\\taskkill.exe";
export const STDOUT_LIMIT_BYTES = 1_048_576;
export const STDERR_LIMIT_BYTES = 262_144;

/**
 * CommandExecutionが扱う値の構造を表す。
 *
 * @responsibility CommandExecutionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape CommandExecutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandExecutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandExecutionの宣言は外部境界を開かない。
 * @security CommandExecutionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandExecutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CommandExecution = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;
/**
 * CommandHandleが扱う値の構造を表す。
 *
 * @responsibility CommandHandleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape CommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandHandleの宣言は外部境界を開かない。
 * @security CommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CommandHandle = Readonly<{
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;
/**
 * OwnedCommandHandleが扱う値の構造を表す。
 *
 * @responsibility OwnedCommandHandleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape OwnedCommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedCommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedCommandHandleの宣言は外部境界を開かない。
 * @security OwnedCommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedCommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedCommandHandle = CommandHandle &
  Readonly<{
    started: (timeoutMs: number) => Promise<boolean>;
    closed: () => boolean;
  }>;

/**
 * createDockerProcessEnvironmentの処理を実行する。
 *
 * @responsibility createDockerProcessEnvironmentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createDockerProcessEnvironmentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateDockerProcessEnvironmentの入力契約を満たす。
 * @postcondition createDockerProcessEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createDockerProcessEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDockerProcessEnvironmentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDockerProcessEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createDockerProcessEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerProcessEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createDockerProcessEnvironment() {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_effect_environment_unavailable");
  return environment;
}

/**
 * Starts the fixed Windows process-tree termination helper under the same
 *
 * @responsibility startOwnedWindowsProcessTreeTerminationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input pid: number
 * @returns startOwnedWindowsProcessTreeTerminationの計算結果を返す。
 * @precondition 「pid: number」がstartOwnedWindowsProcessTreeTerminationの入力契約を満たす。
 * @postcondition startOwnedWindowsProcessTreeTerminationの責務を完了した結果だけを返す。
 * @effect startOwnedWindowsProcessTreeTerminationは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: startOwnedWindowsProcessTreeTerminationは独自の失敗分岐を所有しない。
 * @invariant startOwnedWindowsProcessTreeTerminationは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startOwnedWindowsProcessTreeTerminationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startOwnedWindowsProcessTreeTerminationは共有非同期状態を持たない同期処理である。
 */
export function startOwnedWindowsProcessTreeTermination(pid: number) {
  if (process.platform !== "win32" || !Number.isSafeInteger(pid) || pid <= 0)
    return null;
  return startOwnedProcess(
    TASKKILL_EXECUTABLE,
    ["/PID", String(pid), "/T", "/F"],
    createDockerProcessEnvironment(),
    null,
  );
}

/**
 * boundedの処理を実行する。
 *
 * @responsibility boundedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input promise: Promise<T>、timeoutMs: number、fallback: T
 * @returns boundedの計算結果を返す。
 * @precondition 「promise: Promise<T>、timeoutMs: number、fallback: T」がboundedの入力契約を満たす。
 * @postcondition boundedの責務を完了した結果だけを返す。
 * @effect N/A: boundedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: boundedは独自の失敗分岐を所有しない。
 * @invariant boundedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security boundedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency boundedは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * startOwnedProcessの処理を実行する。
 *
 * @responsibility startOwnedProcessに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input executable: string、argv: readonly string[]、environment: Readonly<Record<string, string>>、stdin: string | null
 * @returns OwnedCommandHandleを返す。
 * @precondition 「executable: string、argv: readonly string[]、environment: Readonly<Record<string, string>>、stdin: string | null」がstartOwnedProcessの入力契約を満たす。
 * @postcondition startOwnedProcessの責務を完了した結果だけを返す。
 * @effect startOwnedProcessは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure startOwnedProcessは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startOwnedProcessは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startOwnedProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency startOwnedProcessは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
  const startCompletion = new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (isValue: boolean) => {
      if (settled) return;
      settled = true;
      resolve(isValue);
    };
    child.once("spawn", () => {
      settle(
        Number.isSafeInteger(child.pid) &&
          Number(child.pid) > 0 &&
          child.stdout !== null &&
          child.stderr !== null &&
          (stdin === null || child.stdin !== null),
      );
    });
    child.once("error", () => settle(false));
    if (!child.stdout || !child.stderr || (stdin !== null && !child.stdin))
      settle(false);
  });
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

  /**
   * terminateAndWaitの処理を実行する。
   *
   * @responsibility terminateAndWaitに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000008
   * @input graceMs: number
   * @returns terminateAndWaitの計算結果を返す。
   * @precondition 「graceMs: number」がterminateAndWaitの入力契約を満たす。
   * @postcondition terminateAndWaitの責務を完了した結果だけを返す。
   * @effect terminateAndWaitは外部ProcessまたはRuntime境界の操作を呼び出す。
   * @failure terminateAndWaitは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant terminateAndWaitは宣言した境界以外へEffectを拡張しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security terminateAndWaitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency terminateAndWaitは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
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
    started: (timeoutMs: number) => bounded(startCompletion, timeoutMs, false),
    wait: (timeoutMs: number) => bounded(completion, timeoutMs, null),
    terminateAndWait,
    closed: () => closed && isTerminationHelperClosed,
  });
}
