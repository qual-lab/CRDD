/**
 * 所有する単一Processの開始・終了確認を試験へ提供する。
 *
 * @packageDocumentation
 * @responsibility 固定Workerを元のProcess Ownerへ接続し、単一Processの終端を確認する。
 * @trace ERB-IT-002
 * @level IT
 * @scope 所有Processの開始・取消・終端
 * @boundary Node子Process→固定Worker。Docker Daemonや実Providerを起動するFixtureではない。
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { startOwnedWindowsProcess } from "../../src/process/start.ts";

/**
 * 下位Process Ownerを試験専用の起動記述へ結合する。
 * @responsibility 実装内部primitiveの任意起動を製品公開APIへ残さない。
 * @trace ERB-IT-002
 * @precondition 自己生成Workerまたは模擬Builtinだけを対象にする。
 * @stimulus 固定試験の実行物・引数・環境・stdinを渡す。
 * @observation 元Handleの停止要求とclose。
 * @oracle 本番と同じProcess Ownerを通る。
 * @cleanup 利用試験が元Handleを終了確認する。試験Directoryは作らない。
 * @boundary ERB-IT-002=Integration: 下位内部Process所有の試験。
 */
export function startOwnedProcess(
  executable: string,
  argv: readonly string[],
  environment: Readonly<Record<string, string>>,
  stdin: string | null,
) {
  return startOwnedWindowsProcess(executable, argv, environment, stdin);
}

/**
 * 固定Process試験に必要な最小Windows環境を作る。
 * @responsibility 固定WorkerへSystemRootだけを渡し親環境を複製しない。
 * @trace ERB-IT-002
 * @precondition Windows実試験ではSystemRootが設定されている。
 * @stimulus 現在のSystemRootを一値だけ取得する。
 * @observation 最小環境の凍結値。
 * @oracle 他の親環境値を含まない。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary ITの固定WorkerとNode.js標準Process起動。
 */
export function createOwnedProcessTestEnvironment() {
  const systemRoot = process.env.SystemRoot;
  assert.ok(systemRoot);
  return Object.freeze({ SystemRoot: systemRoot });
}

export const ownedProcessWorker = fileURLToPath(
  new URL("./owned-process-worker.ts", import.meta.url),
);

/**
 * 固定Workerの観測条件を上限付きで待つ。
 * @responsibility 期限超過を成功にしない。
 * @trace ERB-IT-002
 * @precondition 自己生成試験Workerだけを対象とする。
 * @stimulus 元の試験条件を渡す。
 * @observation 存在・終了または固定Fixtureを返す。
 * @oracle 期限超過を成功にしない。
 * @cleanup 利用試験が元Handleを終了確認する。
 * @boundary 所有Processの固定IT Fixture。
 */
export async function waitForCondition(condition: () => boolean) {
  const deadline = Date.now() + 5_000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "fixed worker observation timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
