/**
 * 所有Browserの実行物解決・世代観測・終了確認を所有する。
 * @responsibility 所有Browserの実行物解決・世代観測・終了確認を所有する。
 * @trace ARCH-000003
 */
import { execFile, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { setTimeout as wait } from "node:timers/promises";
import type { BrowserCloseMode } from "./types.ts";

const BROWSER_PROCESS_TREE_GRACE_MILLISECONDS = 5_000;

const BROWSER_PROCESS_TREE_EXIT_TIMEOUT_MILLISECONDS = 30_000;

const execFileAsync = promisify(execFile);

/**
 * OS Processの親子関係を定義する。
 *
 * @responsibility 所有Browser Process Treeを辿るためのPID関係だけを保持する。
 * @trace ARCH-000003
 * @shape pidとparentPidの正整数で構成する。
 * @invariant Command line、実行Pathまたは利用者情報を含まない。
 * @boundary OS Process一覧とVisual検証器の型境界。
 * @security 公開結果へPIDを含めない。
 * @compatibility Windows CIMとPOSIX psの結果を同じ形へ正規化する。
 */
export type ProcessPair = Readonly<{
  pid: number;
  parentPid: number;
  identity: string;
  terminationIdentityVerified: boolean;
}>;

/**
 * 実Browser Zoom検証Processの所有境界で使用するOwnedProcessIdentityの構造を固定する。
 *
 * @responsibility 実Browser Zoom検証Processの所有境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type OwnedProcessIdentity = Readonly<{
  pid: number;
  identity: string;
  terminationIdentityVerified: boolean;
  depth: number;
}>;

/**
 * 残存所有Processの限定終了処理が利用する依存を定義する。
 *
 * @responsibility 現在Process観測と終了Signalを分離し、安全反例を実Effectなしで検証可能にする。
 * @trace ARCH-000003
 * @shape Process Snapshot Readerと単一PID Terminatorで構成する。
 * @invariant Production既定値はOS Process一覧とNode.js Process APIだけを使用する。
 * @boundary 世代Identity判定とOS Process Effectの境界。
 * @security 試験以外のConsumerへ任意Process選択Authorityを公開入口から提供しない。
 * @compatibility visual-preview package内の直接境界試験だけが差し替える。
 */
export type OwnedProcessTerminationDependencies = Readonly<{
  readCurrentProcesses: () => Promise<readonly ProcessPair[]>;
  terminateProcess: (pid: number) => void;
}>;

/**
 * 所有Process Treeの終了後観測結果を定義する。
 *
 * @responsibility 不存在確認の成否と観測所要時間を一つの結果として保持する。
 * @trace ARCH-000003
 * @shape confirmedとelapsedMillisecondsで構成する。
 * @invariant PID、Process PathまたはCommand Lineを含まない。
 * @boundary OS Process Table観測からVisual検証結果への境界。
 * @security Process Identityを公開結果へ複製しない。
 * @compatibility Browser cleanup診断の内部契約として扱う。
 */
type ProcessTreeExitObservation = Readonly<{
  confirmed: boolean;
  elapsedMilliseconds: number;
}>;

/**
 * 実行中Processの親子関係を取得する。
 *
 * @responsibility 所有Browser Process Treeの終了後観測に必要なPIDと親PIDだけを取得する。
 * @trace ARCH-000003
 * @input N/A: 現在のOS Process一覧を使用する。
 * @returns PIDと親PIDの組を返す。
 * @precondition WindowsではPowerShell、Linuxではprocfs、その他POSIXではpsが利用可能である。
 * @postcondition Command出力のPath、引数または秘密値を保持しない。
 * @effect Windowsまたはその他POSIXでは外部Commandを一回実行し、Linuxではprocfsを読取る。
 * @failure Process一覧を決定論的に取得できない場合はErrorを投げる。
 * @invariant PIDと親PID以外を結果へ含めない。
 * @boundary Node.js ProcessとOS Process観測境界。
 * @security Command line、実行Pathおよび利用者情報を取得しない。
 * @concurrency 取得時点のSnapshotとして扱い、後続で終了を再観測する。
 */
async function readProcessPairs(): Promise<readonly ProcessPair[]> {
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate | ConvertTo-Json -Compress",
      ],
      { windowsHide: true, timeout: 10_000 },
    );
    const parsed = JSON.parse(stdout) as
      | Readonly<{
          ProcessId?: unknown;
          ParentProcessId?: unknown;
          CreationDate?: unknown;
        }>
      | readonly Readonly<{
          ProcessId?: unknown;
          ParentProcessId?: unknown;
          CreationDate?: unknown;
        }>[];
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return Object.freeze(
      entries.flatMap((entry) => {
        const pid = Number(entry.ProcessId);
        const parentPid = Number(entry.ParentProcessId);
        const creationDate = entry.CreationDate;
        return Number.isInteger(pid) &&
          Number.isInteger(parentPid) &&
          typeof creationDate === "string" &&
          creationDate.length > 0
          ? [
              Object.freeze({
                pid,
                parentPid,
                identity: `${pid}:${creationDate}`,
                terminationIdentityVerified: true,
              }),
            ]
          : [];
      }),
    );
  }
  if (process.platform === "linux") {
    const entries = await readdir("/proc", { withFileTypes: true });
    const pairs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && /^\d+$/u.test(entry.name))
        .map(async (entry): Promise<ProcessPair | undefined> => {
          try {
            const stat = await readFile(`/proc/${entry.name}/stat`, "utf8");
            const firstSpace = stat.indexOf(" ");
            const closingParenthesis = stat.lastIndexOf(")");
            if (firstSpace < 1 || closingParenthesis < firstSpace)
              return undefined;
            const pid = Number(stat.slice(0, firstSpace));
            const fields = stat
              .slice(closingParenthesis + 2)
              .trim()
              .split(/\s+/u);
            const parentPid = Number(fields[1]);
            const startTime = fields[19];
            return Number.isInteger(pid) &&
              Number.isInteger(parentPid) &&
              typeof startTime === "string" &&
              /^\d+$/u.test(startTime)
              ? Object.freeze({
                  pid,
                  parentPid,
                  identity: `${pid}:${startTime}`,
                  terminationIdentityVerified: true,
                })
              : undefined;
          } catch (error) {
            if (
              error instanceof Error &&
              "code" in error &&
              (error.code === "ENOENT" || error.code === "ESRCH")
            )
              return undefined;
            throw error;
          }
        }),
    );
    return Object.freeze(
      pairs.filter((pair): pair is ProcessPair => pair !== undefined),
    );
  }
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid=,ppid="], {
    timeout: 10_000,
  });
  return Object.freeze(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim().split(/\s+/u).map(Number))
      .flatMap(([pid, parentPid]) =>
        Number.isInteger(pid) && Number.isInteger(parentPid)
          ? [
              Object.freeze({
                pid: pid as number,
                parentPid: parentPid as number,
                identity: String(pid),
                terminationIdentityVerified: false,
              }),
            ]
          : [],
      ),
  );
}

/**
 * 起点PIDを含む所有Process TreeのPID集合を固定する。
 *
 * @responsibility Browser終了前Snapshotから起点Processと全子孫を抽出する。
 * @trace ARCH-000003
 * @input rootPidに現在の検証操作が起動したBrowser PIDを受け取る。
 * @returns 起点PIDを含む重複のないPID一覧を返す。
 * @precondition rootPidは正の整数であり、同じ操作がspawnしたProcessである。
 * @postcondition 名前一致または実行Path一致で別Processを混入しない。
 * @effect OS Process一覧を読取る。
 * @failure Process一覧を取得できない場合はErrorを投げる。
 * @invariant 親子Relationだけで閉包を作る。
 * @boundary Browser所有ProcessとOS Process一覧の境界。
 * @security PIDを公開結果へ含めない。
 * @concurrency Snapshot後に新設された子孫はDevTools停止とProfile削除でも補完確認する。
 */
export async function collectOwnedProcessIds(
  rootPid: number,
): Promise<readonly OwnedProcessIdentity[]> {
  const pairs = await readProcessPairs();
  const depths = new Map<number, number>([[rootPid, 0]]);
  let hasChanged = true;
  while (hasChanged) {
    hasChanged = false;
    for (const pair of pairs) {
      const parentDepth = depths.get(pair.parentPid);
      if (parentDepth !== undefined && !depths.has(pair.pid)) {
        depths.set(pair.pid, parentDepth + 1);
        hasChanged = true;
      }
    }
  }
  return Object.freeze(
    pairs
      .filter((pair) => depths.has(pair.pid))
      .map((pair) =>
        Object.freeze({
          pid: pair.pid,
          identity: pair.identity,
          terminationIdentityVerified: pair.terminationIdentityVerified,
          depth: depths.get(pair.pid) as number,
        }),
      )
      .sort((left, right) => left.depth - right.depth || left.pid - right.pid),
  );
}

/**
 * PIDが現在も存在するかを副作用なく確認する。
 *
 * @responsibility 所有Process Treeの終了後不存在をPID単位で観測する。
 * @trace ARCH-000003
 * @input pidに観測対象Process IDを受け取る。
 * @returns Processが存在すればtrue、存在しなければfalseを返す。
 * @precondition pidはcollectOwnedProcessIdsが返した正の整数である。
 * @postcondition 対象Processへ終了Signalを送らない。
 * @effect Signal 0によるOS Process存在確認だけを行う。
 * @failure 権限拒否は存在として扱い、不存在へ丸めない。
 * @invariant PIDをLogまたは公開結果へ出さない。
 * @boundary Node.js Process APIとOS Process Tableの境界。
 * @security 別Processを変更しない。
 * @concurrency 観測直後のPID再利用RiskをProfileとDevTools不存在確認で補う。
 */
function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      error.code === "ESRCH"
    );
  }
}

/**
 * 所有Process Treeの全PIDが終了するまで限定時間再観測する。
 *
 * @responsibility Browser親子Processの終了後0件を明示的に確認する。
 * @trace ARCH-000003
 * @input processIdsに終了前に固定した所有Process PID一覧を受け取る。
 * @returns 全PID不存在の確認結果と観測所要時間を返す。
 * @precondition processIdsは同じBrowser操作から導出されている。
 * @postcondition Processへ変更Signalを発行しない。
 * @effect OS Process存在確認を最大30秒間再実行する。
 * @failure 観測不能はconfirmed=falseとして成功へ畳まない。
 * @invariant 名前一致の別Browserを対象にしない。
 * @boundary Browser Process Treeの終了後観測境界。
 * @security PIDを外部へ公開しない。
 * @concurrency 全PIDが同じ観測回で不存在になるまで成功にしない。
 */
async function waitForProcessTreeExit(
  processIds: readonly OwnedProcessIdentity[],
  timeoutMilliseconds: number,
): Promise<ProcessTreeExitObservation> {
  const startedAt = Date.now();
  const createObservation = (confirmed: boolean): ProcessTreeExitObservation =>
    Object.freeze({
      confirmed,
      elapsedMilliseconds: Math.max(0, Date.now() - startedAt),
    });
  const deadline = startedAt + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (
      processIds.every((processIdentity) => !processExists(processIdentity.pid))
    )
      return createObservation(true);
    const currentIdentities = new Set(
      (await readProcessPairs()).map((processPair) => processPair.identity),
    );
    if (
      processIds.every(
        (processIdentity) => !currentIdentities.has(processIdentity.identity),
      )
    )
      return createObservation(true);
    await wait(500);
  }
  const currentIdentities = new Set(
    (await readProcessPairs()).map((processPair) => processPair.identity),
  );
  return createObservation(
    processIds.every(
      (processIdentity) => !currentIdentities.has(processIdentity.identity),
    ),
  );
}

/**
 * 正常終了後も残る所有Browser子Processだけへ終了を要求する。
 *
 * @responsibility Windowsで親Process終了が子Process Tree回収を保証しない場合の限定Fallbackを所有する。
 * @trace ARCH-000003
 * @input processIdsにBrowser開始後に固定した所有Process Identity一覧を受け取る。
 * @returns 同じIdentityを再確認して終了要求を発行したProcess数を返す。
 * @precondition processIdsは同じBrowser操作から親子Relationで導出されている。
 * @postcondition 一致した残存Processにだけ一回ずつ終了要求を発行する。
 * @effect 現在のProcess一覧を再観測し、Identity一致したProcessへSIGTERMを送る。
 * @failure Process一覧を観測できない、または一致Processへの終了要求に失敗した場合はErrorを投げる。
 * @invariant PID一致だけでは操作せず、生成時刻を含むIdentity一致を必須とする。
 * @boundary Browser所有Process TreeとOS Process APIの境界。
 * @security 別操作、通常Profileまたは利用者所有Browserを終了しない。
 * @concurrency 子孫から親の順に処置し、処置直前のIdentity Snapshotだけを使用する。
 */
export async function terminateRemainingOwnedBrowserProcesses(
  processIds: readonly OwnedProcessIdentity[],
  dependencies: OwnedProcessTerminationDependencies = Object.freeze({
    readCurrentProcesses: readProcessPairs,
    terminateProcess: (pid) => process.kill(pid, "SIGTERM"),
  }),
): Promise<number> {
  const currentProcessesByIdentity = new Map(
    (await dependencies.readCurrentProcesses()).map((processPair) => [
      processPair.identity,
      processPair,
    ]),
  );
  const remainingProcesses = [...processIds]
    .sort((left, right) => right.depth - left.depth || right.pid - left.pid)
    .flatMap((processIdentity) => {
      const currentProcess = currentProcessesByIdentity.get(
        processIdentity.identity,
      );
      return currentProcess === undefined
        ? []
        : [{ captured: processIdentity, current: currentProcess }];
    });
  if (
    remainingProcesses.some(
      ({ captured, current }) =>
        !captured.terminationIdentityVerified ||
        !current.terminationIdentityVerified,
    )
  )
    throw new Error("visual_zoom_owned_process_identity_unverified");
  let terminationRequestCount = 0;
  for (const { current } of remainingProcesses) {
    try {
      dependencies.terminateProcess(current.pid);
      terminationRequestCount += 1;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH")
        continue;
      throw error;
    }
  }
  return terminationRequestCount;
}

/**
 * 所有Browser Process Treeの終了処理結果を定義する。
 *
 * @responsibility 正常終了受理、実終了経路、限定Fallback、最終不存在および途中Errorを分離する。
 * @trace ARCH-000003
 * @shape 終了観測値と全段cleanup後に集約したErrorで構成する。
 * @invariant 一段の失敗で後続cleanupを省略しない。
 * @boundary Browser正常終了要求、OS Process操作および呼出し側の結果判定境界。
 * @security PID、Process PathまたはCommand Lineを公開結果へ含めない。
 * @compatibility visual-preview内部試験から直接反証できる安定契約として扱う。
 */
export type OwnedBrowserProcessCleanupResult = Readonly<{
  normalCloseAccepted: boolean;
  closeMode: BrowserCloseMode;
  descendantTerminationRequired: boolean;
  processTreeExitConfirmed: boolean;
  processTreeExitObservationElapsedMilliseconds: number;
  shutdownElapsedMilliseconds: number;
  cleanupErrors: readonly unknown[];
}>;

/**
 * Browser終了直前の所有Treeを固定し、正常終了と限定Fallbackを順に実行する。
 *
 * @responsibility 終了直前に生成済みの全子孫を世代Identity付きで固定し、全cleanup段をbest effortで完了する。
 * @trace ARCH-000003
 * @input childに本操作が起動したBrowser、requestNormalCloseにBrowser固有の正常終了要求を受け取る。
 * @returns 終了経路、Fallback有無、最終不存在および全段実行後のError一覧を返す。
 * @precondition childは利用者の通常Browserではなく本検証操作専用Processである。
 * @postcondition Snapshot、正常終了、親Process停止、残存子孫処置および最終観測を可能な範囲ですべて試行する。
 * @effect exactな世代Identityを確認できた所有Processだけへ必要時に終了Signalを送る。
 * @failure Identity観測不能、停止失敗または最終残存をcleanupErrorsとfalse観測で返す。
 * @invariant 名前、PathまたはPIDだけで操作対象を広げない。
 * @boundary DevTools Browser.close、Node.js ChildProcessおよびOS Process Treeの終了境界。
 * @security Identityを確認できないPlatformではFallback Effect 0で失敗する。
 * @concurrency 終了要求直前のSnapshotを使用し、各cleanup段のErrorを集約して後続段を継続する。
 */
export async function closeOwnedBrowserProcessTree(
  child: ChildProcess,
  requestNormalClose: () => Promise<void>,
): Promise<OwnedBrowserProcessCleanupResult> {
  const startedAt = Date.now();
  const cleanupErrors: unknown[] = [];
  let ownedProcessIds: readonly OwnedProcessIdentity[] = [];
  let isNormalCloseAccepted = false;
  let closeMode: BrowserCloseMode = "unknown";
  let descendantTerminationRequired = false;
  let processTreeExitConfirmed = false;
  let processTreeExitObservationElapsedMilliseconds = 0;
  try {
    if (child.pid === undefined)
      throw new Error("visual_zoom_browser_pid_unavailable");
    ownedProcessIds = await collectOwnedProcessIds(child.pid);
    if (ownedProcessIds.length === 0)
      throw new Error("visual_zoom_owned_process_tree_unobserved");
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await requestNormalClose();
    isNormalCloseAccepted = true;
  } catch {
    isNormalCloseAccepted = false;
  }
  try {
    closeMode = await stopOwnedBrowser(child);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (ownedProcessIds.length > 0) {
    try {
      const gracefulObservation = await waitForProcessTreeExit(
        ownedProcessIds,
        BROWSER_PROCESS_TREE_GRACE_MILLISECONDS,
      );
      processTreeExitObservationElapsedMilliseconds +=
        gracefulObservation.elapsedMilliseconds;
      processTreeExitConfirmed = gracefulObservation.confirmed;
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (!processTreeExitConfirmed) {
      try {
        descendantTerminationRequired =
          (await terminateRemainingOwnedBrowserProcesses(ownedProcessIds)) > 0;
      } catch (error) {
        cleanupErrors.push(error);
      }
      try {
        const finalObservation = await waitForProcessTreeExit(
          ownedProcessIds,
          BROWSER_PROCESS_TREE_EXIT_TIMEOUT_MILLISECONDS,
        );
        processTreeExitObservationElapsedMilliseconds +=
          finalObservation.elapsedMilliseconds;
        processTreeExitConfirmed = finalObservation.confirmed;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  return Object.freeze({
    normalCloseAccepted: isNormalCloseAccepted,
    closeMode,
    descendantTerminationRequired,
    processTreeExitConfirmed,
    processTreeExitObservationElapsedMilliseconds,
    shutdownElapsedMilliseconds: Math.max(0, Date.now() - startedAt),
    cleanupErrors: Object.freeze([...cleanupErrors]),
  });
}

/**
 * 対応済みChrome実行Fileを解決する。
 *
 * @responsibility 明示PathまたはWindowsの既知配置からChromeだけを選ぶ。
 * @trace ARCH-000003
 * @input explicitPathに任意の利用者指定Pathを受け取る。
 * @returns 存在するChrome実行FileのAbsolute Pathを返す。
 * @precondition 明示Pathを使う場合は現在Host上の通常Fileである。
 * @postcondition Browserを起動せずPathだけを返す。
 * @effect Filesystem上の存在を観測する。
 * @failure 対応済みChromeが見つからなければErrorを投げる。
 * @invariant Edge等を暗黙Fallbackとして使用しない。
 * @boundary Host FilesystemとBrowser Adapterの境界。
 * @security 解決したAbsolute Pathを公開結果へ含めない。
 * @concurrency N/A: 起動前の同期観測である。
 */
export function resolveChromeExecutable(explicitPath?: string): string {
  const candidates = [
    explicitPath,
    process.env.PROGRAMFILES === undefined
      ? undefined
      : path.join(
          process.env.PROGRAMFILES,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
    process.env["PROGRAMFILES(X86)"] === undefined
      ? undefined
      : path.join(
          process.env["PROGRAMFILES(X86)"],
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
    process.env.LOCALAPPDATA === undefined
      ? undefined
      : path.join(
          process.env.LOCALAPPDATA,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
  ];
  const resolved = candidates.find(
    (candidate): candidate is string =>
      candidate !== undefined && existsSync(candidate),
  );
  if (resolved === undefined) throw new Error("visual_zoom_chrome_unavailable");
  return resolved;
}

/**
 * Browser Processを終了し、完了を確認する。
 *
 * @responsibility 当該検証操作が起動したProcessだけを回収する。
 * @trace ARCH-000003
 * @input childに検証器が所有するBrowser Processを受け取る。
 * @returns 実際に成立した終了経路を返す。
 * @precondition childは現在の検証操作がspawnしたProcessである。
 * @postcondition Processが終了している。
 * @effect まずSignalなしで5秒待ち、必要時だけSIGTERM、さらに必要時だけSIGKILLを要求する。
 * @failure 最終期限後も終了を観測できなければunknownを返す。
 * @invariant 名前一致で別Browser Processを終了しない。
 * @boundary Node.js Child Process境界。
 * @security 所有していないProcessへ操作しない。
 * @concurrency exitとtimeoutの競合を一回の完了へ畳む。
 */
export async function stopOwnedBrowser(
  child: ChildProcess,
): Promise<BrowserCloseMode> {
  if (child.exitCode !== null || child.signalCode !== null) return "normal";
  if (await waitForChildExit(child, 5_000)) return "normal";
  child.kill("SIGTERM");
  if (await waitForChildExit(child, 5_000)) return "sigterm";
  child.kill("SIGKILL");
  if (await waitForChildExit(child, 5_000)) return "sigkill";
  return "unknown";
}

/**
 * Child Processを変更せず有限時間だけ終了観測する。
 *
 * @responsibility 正常終了待機と強制終了Signal発行を分離する。
 * @trace ARCH-000003
 * @input childに所有Process、timeoutMillisecondsに観測期限を受け取る。
 * @returns 期限内に終了を観測すればtrue、残存または観測不能ならfalseを返す。
 * @precondition childは現在の検証操作がspawnしたProcessである。
 * @postcondition この関数自身はProcessへSignalを送らない。
 * @effect exit EventまたはTimerを一度だけ待つ。
 * @failure Event未着でも終了状態を再確認し、残存をfalseへ返す。
 * @invariant ListenerとTimerを完了時に解放する。
 * @boundary Node.js Child Process終了通知の観測境界。
 * @security 所有していないProcessを参照しない。
 * @concurrency exitとtimeoutの先着一件だけを採用する。
 */
async function waitForChildExit(
  child: ChildProcess,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await new Promise((resolve) => {
    let isSettled = false;
    const settle = (hasExited: boolean): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      child.off("exit", onExit);
      resolve(hasExited);
    };
    const onExit = (): void => settle(true);
    const timeout = setTimeout(
      () => settle(child.exitCode !== null || child.signalCode !== null),
      timeoutMilliseconds,
    );
    child.once("exit", onExit);
  });
}
