/** EI単一履歴の保持区間だけを既存共通wx排他へ接続する。自動回復しない。 */
import { acquireLock } from "../../../lock/src/index.ts";
export function acquireHistoryLock(directory: string) {
  return acquireLock({
    directory,
    name: "history.lock",
    identity: "execution-intelligence:history",
  });
}
