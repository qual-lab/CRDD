/**
 * check-project-runtime-design-traceabilityに属する責務をまとめる。
 *
 * @responsibility readRepositoryTextを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProjectRuntimeDesignTraceability } from "../src/core/project-runtime-design-traceability.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const TRACE_PATH =
  "07_Quality/Registry/project-runtime-design-traceability.json";

/**
 * Repository Textを読み取る。
 *
 * @responsibility Repository Textの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000002
 * @input repositoryRelativePath: string
 * @returns string | nullを返す。
 * @precondition 「repositoryRelativePath: string」がreadRepositoryTextの入力契約を満たす。
 * @postcondition readRepositoryTextの責務を完了した結果だけを返す。
 * @effect readRepositoryTextはFilesystemの読取りまたは書込みを実行する。
 * @failure readRepositoryTextは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRepositoryTextは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readRepositoryTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRepositoryTextは共有非同期状態を持たない同期処理である。
 */
function readRepositoryText(repositoryRelativePath: string): string | null {
  try {
    const target = path.join(
      repositoryRoot,
      ...repositoryRelativePath.split("/"),
    );
    const relative = path.relative(repositoryRoot, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const stats = fs.lstatSync(target);
    if (!stats.isFile() || stats.isSymbolicLink()) return null;
    return fs.readFileSync(target, "utf8");
  } catch {
    return null;
  }
}

let trace: unknown = null;
const source = readRepositoryText(TRACE_PATH);
if (source !== null) {
  try {
    trace = JSON.parse(source);
  } catch {
    trace = null;
  }
}
const result = inspectProjectRuntimeDesignTraceability(
  trace,
  readRepositoryText,
);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== "accepted") process.exitCode = 2;
