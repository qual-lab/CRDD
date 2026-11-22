/**
 * Workbenchの既存起動設定をCRDD Server共通Readerへ接続する。
 * @responsibility 接続種別を固定し、既存の設定Fileと失敗契約を維持する。
 * @trace ARCH-000012
 */
import {
  inspectServerPublicOrigin,
  readServerConnectionConfiguration,
} from "../index.ts";

/** 起動時の公開Originを検査する。 @trace ARCH-000012 */
export function inspectWorkbenchPublicOrigin(
  value: string | undefined,
): URL | null {
  return inspectServerPublicOrigin(value, "workbench");
}

/** 明示CROS起動時に既存の非秘密設定を一回読む。 @trace ARCH-000012 */
export function readWorkbenchServerConfiguration(workingDirectory: string) {
  return readServerConnectionConfiguration(workingDirectory, "workbench");
}
