/**
 * 公式Desktop CLIの単発操作と共通wx排他を所有する。
 * @responsibility 停止契約、元CLI子のclose、Lock解放を別事実として扱う。
 * @trace ARCH-000008
 * @boundary Windowsの固定インストール先。Process群の不存在は観測しない。
 */
import path from "node:path";
import { acquireLock } from "../../../lock/src/index.ts";
import type { IsolationSettings } from "../docker-cli/environment.ts";
import { createDesktopCommandEnvironment } from "../docker-cli/environment.ts";
import {
  finishOwnedProcess,
  startOwnedWindowsProcess,
  type OwnedCommandHandle,
} from "../process/start.ts";
import type {
  DesktopCommandResult,
  DesktopOperations,
  DesktopAcquisition,
} from "./types.ts";
import {
  observeTrustedDesktopCli,
  verifyTrustedDesktopCliSnapshot,
} from "../docker-cli/trust.ts";

/** 非秘密の観測出力だけを受理する。不明・新形式を停止へ畳まない。 */
export function parseDesktopStatus(
  output: string,
): "running" | "stopped" | "unknown" {
  try {
    const value: unknown = JSON.parse(output);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return "unknown";
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length !== 1 || (keys[0] !== "Status" && keys[0] !== "status"))
      return "unknown";
    const status = record[keys[0]];
    return status === "running" || status === "stopped" ? status : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 既存の設定基点に一つのDesktop排他を取得する。基点を作成・探索しない。
 * @effect 固定docker-isolation.desktop.lockのみ。残存は自動削除しない。
 * @invariant 上位のcoordinator.docker-state.lockとは別Scopeで、取得順はstate→Desktop。
 */
export function acquireDesktopOperations(
  settings: IsolationSettings,
  signal: AbortSignal,
): DesktopAcquisition {
  const unavailable = { operations: null, cleanupConfirmed: true } as const;
  if (process.platform !== "win32" || signal.aborted || !settings.desktop)
    return unavailable;
  let cli: ReturnType<typeof observeTrustedDesktopCli>;
  try {
    cli = observeTrustedDesktopCli(settings);
  } catch {
    return unavailable;
  }
  const acquisition = acquireLock({
    directory: settings.desktop.userDataDirectory,
    name: "docker-isolation.desktop.lock",
    identity: "docker-desktop:shared",
  });
  if (acquisition.status !== "acquired")
    return {
      operations: null,
      cleanupConfirmed:
        acquisition.cleanupConfirmed && acquisition.descriptorClosed,
    };
  const lock = acquisition.lock;
  let ended = false;
  let cleanupConfirmed = true;
  let stopActive: (() => void) | null = null;
  let completion: Promise<DesktopCommandResult> | null = null;
  let release: Promise<boolean> | null = null;
  const verify = () => {
    try {
      if (ended || !cleanupConfirmed || signal.aborted || !lock.assertLive())
        return false;
      verifyTrustedDesktopCliSnapshot(cli);
      return true;
    } catch {
      return false;
    }
  };

  /** 固定三操作だけを元Process Ownerへ渡し、完了後のcloseまで確認する。 */
  async function execute(
    action: "status" | "stop" | "start",
  ): Promise<DesktopCommandResult> {
    const unissued: DesktopCommandResult = {
      issued: false,
      completed: false,
      cleanupConfirmed,
      status: "unknown",
    };
    if (completion || !verify()) return unissued;
    let issued: boolean | null = false;
    let completed = false;
    let status: DesktopCommandResult["status"] = "unknown";
    let handle: OwnedCommandHandle | null = null;
    let finalized = false;
    let termination: Promise<boolean> | null = null;
    let settleCancellation: (() => void) | null = null;
    const cancelled = new Promise<null>((resolve) => {
      settleCancellation = () => resolve(null);
    });
    const stopChild = () => {
      if (!handle) return;
      termination ??= handle.terminateAndWait(5_000).catch(() => false);
      void termination.then((closed) => {
        cleanupConfirmed &&= closed;
        settleCancellation?.();
      });
    };
    signal.addEventListener("abort", stopChild, { once: true });
    stopActive = stopChild;
    try {
      if (!verify()) return unissued;
      const argv =
        action === "status"
          ? ["desktop", "status", "--format", "json"]
          : action === "start"
            ? ["desktop", "start", "--detach"]
            : ["desktop", "stop", "--timeout", "30"];
      issued = null;
      handle = startOwnedWindowsProcess(
        cli.executablePath,
        argv,
        createDesktopCommandEnvironment(settings),
        null,
        {
          workingDirectory: path.win32.dirname(cli.executablePath),
          stdoutLimitBytes: 16_384,
          stderrLimitBytes: 16_384,
        },
      );
      if (signal.aborted) stopChild();
      const started = await handle.started(5_000);
      if (started) issued = true;
      const result = await Promise.race([
        handle.wait(action === "status" ? 5_000 : 35_000),
        cancelled,
      ]);
      finalized = true;
      const finished = termination
        ? { closed: await termination, result }
        : await finishOwnedProcess(handle, result);
      cleanupConfirmed &&= finished.closed;
      completed =
        !!result &&
        result.status === 0 &&
        result.signal === null &&
        !result.outputExceeded &&
        cleanupConfirmed &&
        verify();
      if (completed && action === "status")
        status = parseDesktopStatus(result?.stdout ?? "");
    } catch {
      completed = false;
      if (finalized) cleanupConfirmed = false;
    } finally {
      signal.removeEventListener("abort", stopChild);
      if (handle && !finalized && !termination) {
        try {
          cleanupConfirmed &&= (await finishOwnedProcess(handle, null)).closed;
        } catch {
          cleanupConfirmed = false;
        }
      } else if (termination) cleanupConfirmed &&= await termination;
      stopActive = null;
    }
    return {
      issued,
      completed: completed && cleanupConfirmed,
      cleanupConfirmed,
      status,
    };
  }

  const operations: DesktopOperations = Object.freeze({
    verify,
    command(action: "status" | "stop" | "start") {
      if (completion)
        return Promise.resolve({
          issued: false,
          completed: false,
          cleanupConfirmed,
          status: "unknown" as const,
        });
      completion = execute(action);
      return completion.finally(() => {
        completion = null;
      });
    },
    close() {
      if (release) return release;
      ended = true;
      release = (async () => {
        stopActive?.();
        if (completion) await completion.catch(() => {});
        // 元CLIの終了未確認では排他Fileを消さず、停止下の明示回復へ残す。
        if (!cleanupConfirmed) {
          try {
            lock.release(true);
          } catch {
            /* File保全失敗も成功へ変更しない。 */
          }
          return false;
        }
        let released = false;
        try {
          released = lock.release();
        } catch {
          released = false;
        }
        return cleanupConfirmed && released;
      })();
      return release;
    },
  });
  return { operations, cleanupConfirmed: true };
}
