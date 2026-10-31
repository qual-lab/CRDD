/**
 * 診断・回収APIの本番本文へ有限のDI代役を接続する試験入口。
 * @packageDocumentation
 * @responsibility 製品公開APIに注入点を追加せず保存側の結合試験を支援する。
 * @trace ERB-IT-014
 * @boundary scripts/tests専用。実Docker・Filesystem書込み・新Authorityを持たない。
 */
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { types as utilTypes } from "node:util";
import * as isolation from "../../docker-isolation/src/index.ts";

/**
 * 実関数本文のDI接続だけを代役化する。
 * @responsibility 上位の保存順序を実Executorコードと結合して検査する。
 * @trace ERB-IT-014
 * @input create: 試験が所有する有限のDI生成代役。
 * @returns 本番と同じ同期診断・回収API。
 * @effect 固定Sourceの読取りとメモリ内のコード実行だけ。
 * @failure 本文の読取り・型除去・評価失敗は試験へ返す。
 * @invariant 本番Rootの公開契約や実行権限を変更しない。
 */
export function createAttemptRecoveryTestApi(
  create: (
    input: Readonly<{
      managementDirectory: string;
      assertOwner: () => boolean;
    }>,
  ) => unknown,
): typeof import("../src/attempt/recovery.ts") {
  const source = readFileSync(
    new URL("../src/attempt/recovery.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?from\s*["'][^"']+["'];?\s*/gm, "")
    .replace(/^export /gm, "");
  return runInNewContext(
    `${body}; ({ inspectAttemptResources, cleanupAttemptResources })`,
    {
      ...isolation,
      utilTypes,
      createDockerTaskRecoveryExecutor: create,
    },
  );
}
