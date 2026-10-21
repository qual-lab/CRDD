/**
 * Host終端記録のcaller保存を同一Processで排他する。
 *
 * @responsibility Repositoryごとの短い保存区間をWindows named pipeへ結合する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { resolveRepositoryRuntimeDataPaths } from "../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  acquireHostTerminalCallerPipeLease,
  type InProcessPipeLease,
} from "../../../platform-access/src/index.ts";

/**
 * 検証済みRepositoryのcaller保存排他を取得する。
 *
 * @responsibility 取得・取消・後着通知・socket終端を同じProcessのOwnerへ接続する。
 * @trace ARCH-000008
 * @input 検証済みRepository capabilityと呼出し側の取消Signal。
 * @returns 取得結果、同期保持確認と一回のTransport解放結果。
 * @precondition Windowsで、Runtime Dataが同じRepository capabilityを解決できる。
 * @postcondition 失敗・取消後の保持を返さず、別Supervisorを作らない。
 * @effect Repository由来の固定named pipeをlistenし、接続は通信せず閉じる。
 * @failure 不正Root、非Windows、取得競合、期限または終了不明を成功にしない。
 * @invariant named pipeは排他だけであり、対象の非使用・削除Authorityを表さない。
 * @boundary Coordinatorと同じProcessが所有するWindows IPC境界。
 * @security 任意pipe名・Path・メッセージ・Providerを受け付けない。
 * @concurrency listening後の保存は同期区間に閉じ、await中の保持を保存許可にしない。
 */
export function acquireHostTerminalCallerLease(
  repository: VerifiedRepositoryRoot,
  signal: AbortSignal,
): InProcessPipeLease {
  const paths = resolveRepositoryRuntimeDataPaths(repository);
  if (process.platform !== "win32" || !paths)
    throw new Error("host_terminal_caller_lease_boundary_invalid");
  const hash = createHash("sha256")
    .update("crdd/host-terminal-caller-mutation/v1\0", "utf8")
    .update(paths.repositoryRoot.toLowerCase(), "utf8")
    .digest("hex");
  const pipe = `\\\\.\\pipe\\crdd-host-terminal-caller-${hash}`;
  return acquireHostTerminalCallerPipeLease(pipe, signal);
}
