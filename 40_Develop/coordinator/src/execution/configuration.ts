/**
 * Coordinator起動時のHost所在をDIのオンメモリ設定へ固定する。
 * @responsibility 環境変数を読むOwnerを上位へ限定する。
 * @trace ARCH-000008
 * @boundary 値は起動元の設定であり、Windows APIによる独立証明ではない。
 */
import os from "node:os";
import {
  type IsolationSettings,
  initializeIsolation,
} from "../../../docker-isolation/src/index.ts";

const isolationSettings = (() => {
  try {
    return initializeIsolation({
      windowsDirectory: process.env.SystemRoot ?? "",
      userHomeDirectory: os.userInfo().homedir,
    });
  } catch {
    return null;
  }
})();

/** 初期化不成立時はDocker要求を発行せず停止する。操作中の再取得はしない。 */
export function getIsolationSettings(): IsolationSettings {
  if (!isolationSettings) throw Error("isolation_settings_unavailable");
  return isolationSettings;
}
