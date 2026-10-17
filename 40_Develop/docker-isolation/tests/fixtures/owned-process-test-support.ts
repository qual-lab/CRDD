/**
 * 所有Process Treeの生成と清掃を試験へ提供する。
 *
 * @packageDocumentation
 * @responsibility 固定WorkerとRepository内試験領域を作り、Process終端と残存回収を確認する。
 * @trace ERB-IT-002
 * @level IT
 * @scope 所有Processの開始・取消・終端
 * @boundary Node子Process→固定Worker。Docker Daemonや実Providerを起動するFixtureではない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startOwnedWindowsProcess } from "../../src/execution/owned-windows-process.ts";
import type { OwnedCommandHandle } from "../../src/index.ts";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * 下位Process Ownerを試験専用の起動記述へ結合する。
 * @responsibility 実装内部primitiveの任意起動を製品公開APIへ残さない。
 * @trace ERB-IT-002
 * @precondition 自己生成Workerまたは模擬Builtinだけを対象にする。
 * @stimulus 固定試験の実行物・引数・環境・stdinを渡す。
 * @observation 元Handleのcloseとtree終端。
 * @oracle 本番と同じProcess Ownerを通る。
 * @cleanup 利用試験が元Handleと自己生成Rootを回収する。
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
 * @responsibility OS終端補助へSystemRootだけを渡し親環境を複製しない。
 * @trace ERB-IT-002
 * @precondition Windows実試験ではSystemRootが設定されている。
 * @stimulus 現在のSystemRootを一値だけ取得する。
 * @observation 最小環境の凍結値。
 * @oracle 他の親環境値を含まない。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary ITの固定WorkerとWindows終端補助。
 */
export function createOwnedProcessTestEnvironment() {
  const systemRoot = process.env.SystemRoot;
  assert.ok(systemRoot);
  return Object.freeze({ SystemRoot: systemRoot });
}

/**
 * 現在Repositoryに自己生成Process試験Directoryを作る。
 * @responsibility 試験一時物をRepository-local Rootに限定する。
 * @trace ERB-IT-002
 * @precondition 現在Rootとtests Rootが通常Directoryである。
 * @stimulus tests直下へ固有Directoryを作る。
 * @observation 作成実体のPath。
 * @oracle Root外・リンク実体を受理しない。
 * @cleanup disposeで不存在を確認し、空の所有Namespaceだけを回収する。
 * @boundary Repository内の試験Filesystem。
 */
function createOwnedProcessTestDirectory() {
  const parent = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.lstatSync(parent).isSymbolicLink(), false);
  const directory = fs.mkdtempSync(path.join(parent, "owned-process-"));
  assert.equal(
    fs.realpathSync.native(directory).toLowerCase(),
    path.resolve(directory).toLowerCase(),
  );
  return Object.freeze({
    directory,
    releaseNamespace() {
      assert.equal(fs.existsSync(directory), false);
    },
  });
}

export const ownedProcessWorker = fileURLToPath(
  new URL("./owned-process-worker.ts", import.meta.url),
);

/**
 * 元試験Processの存在を観測する。
 * @responsibility ESRCHだけを不存在として扱う。
 * @trace ERB-IT-002
 * @precondition 自己生成試験Workerだけを対象とする。
 * @stimulus 元の試験条件を渡す。
 * @observation 存在・終了または固定Fixtureを返す。
 * @oracle ESRCHだけを不存在として扱う。
 * @cleanup Fixtureのdisposeが元Handleと試験Directoryを回収する。
 * @boundary 所有Processの固定IT Fixture。
 */
export function isProcessPresent(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

/**
 * 固定Workerの観測条件を上限付きで待つ。
 * @responsibility 期限超過を成功にしない。
 * @trace ERB-IT-002
 * @precondition 自己生成試験Workerだけを対象とする。
 * @stimulus 元の試験条件を渡す。
 * @observation 存在・終了または固定Fixtureを返す。
 * @oracle 期限超過を成功にしない。
 * @cleanup Fixtureのdisposeが元Handleと試験Directoryを回収する。
 * @boundary 所有Processの固定IT Fixture。
 */
export async function waitForCondition(condition: () => boolean) {
  const deadline = Date.now() + 5_000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "fixed worker observation timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * 自己生成Workerと子孫の試験状態を構成する。
 * @responsibility 元Handleと観測PIDの終端確認後だけRootを回収する。
 * @trace ERB-IT-002
 * @precondition 自己生成試験Workerだけを対象とする。
 * @stimulus 元の試験条件を渡す。
 * @observation 存在・終了または固定Fixtureを返す。
 * @oracle 元Handleと観測PIDの終端確認後だけRootを回収する。
 * @cleanup Fixtureのdisposeが元Handleと試験Directoryを回収する。
 * @boundary 所有Processの固定IT Fixture。
 */
export function createOwnedProcessTreeFixture() {
  const temporaryDirectory = createOwnedProcessTestDirectory();
  const { directory } = temporaryDirectory;
  const readinessPath = path.join(directory, "ready.json");
  let handle: OwnedCommandHandle | null = null;
  let observedPids: number[] = [];
  return {
    start() {
      assert.equal(handle, null);
      handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, "tree", readinessPath],
        createOwnedProcessTestEnvironment(),
        null,
      );
      return handle;
    },
    async ready() {
      await waitForCondition(() => {
        if (!fs.existsSync(readinessPath)) return false;
        try {
          const pids: unknown = JSON.parse(
            fs.readFileSync(readinessPath, "utf8"),
          );
          if (
            !Array.isArray(pids) ||
            pids.length !== 2 ||
            !pids.every((pid) => Number.isSafeInteger(pid) && pid > 0)
          )
            return false;
          observedPids = pids;
          return true;
        } catch {
          return false;
        }
      });
      assert.ok(observedPids.every(isProcessPresent));
      return [...observedPids];
    },
    assertAbsent() {
      assert.equal(observedPids.length, 2);
      assert.ok(observedPids.every((pid) => !isProcessPresent(pid)));
      assert.equal(handle?.closed(), true);
    },
    async dispose() {
      if (handle) assert.equal(await handle.terminateAndWait(5_000), true);
      if (observedPids.length > 0) {
        await waitForCondition(() =>
          observedPids.every((pid) => !isProcessPresent(pid)),
        );
      }
      const directoryMetadata = fs.lstatSync(directory);
      assert.ok(
        directoryMetadata.isDirectory() && !directoryMetadata.isSymbolicLink(),
      );
      fs.rmSync(directory, { recursive: true });
      assert.equal(fs.existsSync(directory), false);
      temporaryDirectory.releaseNamespace();
    },
  };
}
