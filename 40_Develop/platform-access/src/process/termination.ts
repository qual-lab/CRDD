/**
 * 所有子ProcessのWindows tree終端補助を用途固定で開始する。
 * @responsibility 固定taskkillの開始・結果・closeを所有し、元子やDocker全体の清掃とは分ける。
 * @trace ARCH-000008
 */
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { createInteractiveConsoleReaderEnvironment } from "./environment.ts";

/**
 * 終端補助Processの観測結果。
 * @responsibility 終了値とsignal、出力超過を個別に保持する。
 * @trace ARCH-000008
 * @shape status、signal、stdout、stderr、outputExceeded。
 * @invariant 要求発行やerrorを正常終了へ読み替えない。
 * @boundary 固定Windows補助Processの観測。
 * @security 元子の終了やDocker資源不存在を保証しない。
 * @compatibility Consumerは元子のcloseを別に確認する。
 */
export type ChildTreeTerminationResult = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;

/**
 * 同じ終端補助子を有界待機・清掃するHandle。
 * @responsibility 補助子の開始、結果、清掃、closeを独立して観測する。
 * @trace ARCH-000008
 * @shape started、wait、terminateAndWait、closed。
 * @invariant wait期限切れはcloseや成功を意味しない。
 * @boundary Windows固定Process操作とConsumer。
 * @security 任意実行物・引数・環境を入力に取らない。
 * @compatibility Handleは元子の所有権を引き取らない。
 */
export type ChildTreeTerminationHandle = Readonly<{
  started: (timeoutMs: number) => Promise<boolean>;
  wait: (timeoutMs: number) => Promise<ChildTreeTerminationResult | null>;
  terminateAndWait: (timeoutMs: number) => Promise<boolean>;
  closed: () => boolean;
}>;

/**
 * 待機期限と元Promiseの完了を競合させる。
 * @responsibility 呼出しごとのtimerを必ず解放する。
 * @trace ARCH-000008
 * @input pending: 元完了、timeoutMs: 非負期限、fallback: 期限結果。
 * @returns 元結果または期限結果。
 * @precondition pendingの所有者が資源清掃を別に行う。
 * @postcondition この待機のtimerを保持しない。
 * @effect 局所timerだけを作成・解放する。
 * @failure 不正期限は待機せずfallback。
 * @invariant 期限結果から外部完了を推定しない。
 * @boundary 同一Process内の待機。
 * @security N/A: Authorityを発行しない。
 * @concurrency 複数待機は元Promiseを共有しtimerは個別所有する。
 */
function bounded<T>(pending: Promise<T>, timeoutMs: number, fallback: T) {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 2_147_483_647
  )
    return Promise.resolve(fallback);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    pending,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * 呼出し元が所有する生存子のtree終端補助を開始する。
 * @responsibility OS由来の固定実行物・最小環境だけでtaskkillを開始し補助子をjoin可能にする。
 * @trace ARCH-000008
 * @input child: 呼出し元が開始・所有しているChildProcess。
 * @returns 補助子Handle、または開始前拒否のnull。
 * @precondition Windows、正のPID、元子未終了、OS所在観測成立。
 * @postcondition 補助子のerrorとcloseを別に所有する。
 * @effect 固定taskkill /PID /T /Fを一度開始する。元子のtreeへ終了要求を出す。
 * @failure 不正入力・元子終了・観測不能・同期spawn例外はnull、非zeroやerrorは非成功結果。
 * @invariant 直前に元子未終了と観測したPIDだけへ固定要求を出し、補助closeを元子closeへ代用しない。観測からOS受理までのPID再利用防止は保証しない。
 * @boundary 固定Windows Process操作。Docker・Provider・永続Stateは扱わない。
 * @security 親環境・任意実行物・任意PID入力・共有Registryを使わない。
 * @concurrency Consumerが同じ元子の終端要求を一度に制限し、返却Handleで補助子をjoinする。
 */
export function startWindowsChildTreeTermination(
  child: ChildProcess,
): ChildTreeTerminationHandle | null {
  if (
    process.platform !== "win32" ||
    !(child instanceof ChildProcess) ||
    !Number.isSafeInteger(child.pid) ||
    Number(child.pid) <= 0 ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return null;
  const environment: Readonly<Record<string, string>> | null =
    createInteractiveConsoleReaderEnvironment("win32");
  if (!environment?.SystemRoot) return null;
  if (child.exitCode !== null || child.signalCode !== null) return null;
  let helper: ChildProcess;
  try {
    helper = spawn(
      path.win32.join(environment.SystemRoot, "System32", "taskkill.exe"),
      ["/PID", String(child.pid), "/T", "/F"],
      {
        shell: false,
        windowsHide: true,
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    return null;
  }
  let isClosed = false;
  let terminationRequested = false;
  let outputExceeded = false;
  let stdoutBytes = 0;
  let stderrBytes = 0;
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let settleStart!: (value: boolean) => void;
  let settleResult!: (value: ChildTreeTerminationResult) => void;
  let settleClose!: () => void;
  const start = new Promise<boolean>((resolve) => {
    settleStart = resolve;
  });
  const result = new Promise<ChildTreeTerminationResult>((resolve) => {
    settleResult = resolve;
  });
  const close = new Promise<void>((resolve) => {
    settleClose = resolve;
  });
  const snapshot = (status: number | null, signal: NodeJS.Signals | null) =>
    Object.freeze({
      status,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      outputExceeded,
    });
  const stopHelper = () => {
    if (isClosed || terminationRequested) return;
    terminationRequested = true;
    try {
      helper.kill();
    } catch {
      /* close remains unconfirmed. */
    }
  };
  helper.once("spawn", () =>
    settleStart(Number.isSafeInteger(helper.pid) && Number(helper.pid) > 0),
  );
  helper.once("error", () => {
    settleStart(false);
    settleResult(snapshot(null, null));
  });
  helper.once("close", (status, signal) => {
    isClosed = true;
    settleStart(false);
    settleResult(snapshot(status, signal));
    settleClose();
  });
  const append = (chunk: Buffer | string, isStdout: boolean) => {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (isStdout) stdoutBytes += value.length;
    else stderrBytes += value.length;
    if (stdoutBytes > 64 * 1024 || stderrBytes > 64 * 1024) {
      outputExceeded = true;
      stopHelper();
      return;
    }
    (isStdout ? stdout : stderr).push(value);
  };
  const transportFailed = () => {
    settleResult(snapshot(null, null));
    stopHelper();
  };
  helper.stdout?.on("error", transportFailed);
  helper.stderr?.on("error", transportFailed);
  helper.stdout?.on("data", (chunk) => append(chunk, true));
  helper.stderr?.on("data", (chunk) => append(chunk, false));
  if (!helper.stdout || !helper.stderr) transportFailed();
  return Object.freeze({
    started: (timeoutMs: number) => bounded(start, timeoutMs, false),
    wait: (timeoutMs: number) =>
      bounded<ChildTreeTerminationResult | null>(result, timeoutMs, null),
    terminateAndWait: async (timeoutMs: number) => {
      stopHelper();
      await bounded(close, timeoutMs, undefined);
      return isClosed;
    },
    closed: () => isClosed,
  });
}
