/**
 * EIの履歴保存区間を共通wx排他へ接続する。
 * @responsibility 固定Lock名・Identityを所有し、取得・所有確認・解放は共通Lockへ委ねる。
 * @trace ARCH-000018
 */
import { acquireLock } from "../../../lock/src/index.ts";
/** 既存Directoryで一度取得する。既存File・初期化残存は奪取せず、取得結果を縮約しない。 */
export function acquireHistoryLock(directory: string) {
  return acquireLock({
    directory,
    name: "history.lock",
    identity: "execution-intelligence:history",
  });
}
