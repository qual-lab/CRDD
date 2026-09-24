/**
 * check-runtime-traceabilityに属する責務をまとめる。
 *
 * @responsibility readRegularRepositoryTextを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000018
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectCoordinatorRuntimeTraceability } from "../src/core/runtime-traceability.ts";

const MAXIMUM_TEXT_BYTES = 8 * 1024 * 1024;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const TRACE_PATH = "07_Quality/Registry/coordinator-runtime-traceability.json";

/**
 * Regular Repository Textを読み取る。
 *
 * @responsibility Regular Repository Textの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000018
 * @input repositoryRelativePath: string
 * @returns string | nullを返す。
 * @precondition 「repositoryRelativePath: string」がreadRegularRepositoryTextの入力契約を満たす。
 * @postcondition readRegularRepositoryTextの責務を完了した結果だけを返す。
 * @effect readRegularRepositoryTextはFilesystemの読取りまたは書込みを実行する。
 * @failure readRegularRepositoryTextは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRegularRepositoryTextは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readRegularRepositoryTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRegularRepositoryTextは共有非同期状態を持たない同期処理である。
 */
function readRegularRepositoryText(
  repositoryRelativePath: string,
): string | null {
  try {
    const segments = repositoryRelativePath.split("/");
    if (
      repositoryRelativePath.length === 0 ||
      repositoryRelativePath.includes("\\") ||
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      )
    ) {
      return null;
    }
    let current = repositoryRoot;
    for (const segment of segments) {
      current = path.join(current, segment);
      const stats = fs.lstatSync(current);
      if (stats.isSymbolicLink()) return null;
    }
    const resolved = fs.realpathSync.native(current);
    const relative = path.relative(repositoryRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const stats = fs.statSync(resolved);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAXIMUM_TEXT_BYTES)
      return null;
    return fs.readFileSync(resolved, "utf8");
  } catch {
    return null;
  }
}

const rawTrace = readRegularRepositoryText(TRACE_PATH);
let trace: unknown = null;
if (rawTrace !== null) {
  try {
    trace = JSON.parse(rawTrace);
  } catch {
    trace = null;
  }
}
const result = inspectCoordinatorRuntimeTraceability(
  trace,
  readRegularRepositoryText,
);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== "accepted") process.exitCode = 2;
