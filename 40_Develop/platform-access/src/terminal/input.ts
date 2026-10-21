/**
 * 固定確認コードReaderの起動と技術的な終了を所有する。
 * @responsibility 固定端末検査・用途固定子・取消と終了結果を接続する。同意は判断しない。
 * @trace ARCH-000008
 */
import type { ChildProcess } from "node:child_process";
import path from "node:path";
import tty from "node:tty";
import { fileURLToPath } from "node:url";
import { createInteractiveConsoleReaderEnvironment } from "../process/environment.ts";
import { spawnRuntimeLocalTypeScriptChild } from "../process/child.ts";
import {
  runInteractiveConsoleReaderLifecycle,
  type InteractiveConsoleReaderLifecycleOutcome,
} from "./reader-lifecycle.ts";

/**
 * 確認コード専用の固定子を起動し、取消・stdoutと子の終了を待つ。
 * @responsibility 端末の検査、固定子の起動と有界終了確認を所有する。
 * @trace ARCH-000008
 * @input inputDescriptor: 検査対象の端末descriptor。cancellationSignal: 取消通知。
 * @returns 技術的完了・取消・失敗・終了不明と確認コード。
 * @precondition コード生成・期待値一致と送信許可は上位が所有する。
 * @postcondition 子とstdoutの終了条件を満たした結果だけを返す。
 * @effect 固定Reader子を起動し、IPCと取消・終了を観測する。
 * @failure 観測不能を回収成功へ補完しない。
 * @invariant 期待値一致・同意・poisonは判断しない。
 * @boundary 現在TTYと固定Reader子のProcess境界。
 * @security 任意子・任意引数・任意環境を公開しない。
 * @concurrency 取消要求と終了確認を分離し、遅延通知で再完了しない。
 */
export function readConfirmationCodeOutcome(
  inputDescriptor: number,
  cancellationSignal: AbortSignal,
): Promise<InteractiveConsoleReaderLifecycleOutcome> {
  if (
    !Number.isSafeInteger(inputDescriptor) ||
    inputDescriptor < 0 ||
    cancellationSignal.aborted ||
    !tty.isatty(inputDescriptor)
  )
    return Promise.resolve(
      Object.freeze({
        status: cancellationSignal.aborted ? "cancelled" : "reader_failed",
        line: null,
      }) as InteractiveConsoleReaderLifecycleOutcome,
    );
  const environment = createInteractiveConsoleReaderEnvironment();
  if (!environment)
    return Promise.resolve(
      Object.freeze({
        status: "reader_failed",
        line: null,
      }) as InteractiveConsoleReaderLifecycleOutcome,
    );
  let child: ChildProcess;
  try {
    child = spawnRuntimeLocalTypeScriptChild("interactive_console_reader", [], {
      shell: false,
      detached: false,
      windowsHide: false,
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      env: environment,
      stdio: ["ignore", "pipe", "ignore", "ipc"],
    });
  } catch {
    return Promise.resolve(
      Object.freeze({
        status: "reader_failed",
        line: null,
      }) as InteractiveConsoleReaderLifecycleOutcome,
    );
  }
  return runInteractiveConsoleReaderLifecycle(
    Object.freeze({ inputDescriptor }),
    cancellationSignal,
    child,
    Object.freeze({ setTimeout, clearTimeout }),
  );
}
