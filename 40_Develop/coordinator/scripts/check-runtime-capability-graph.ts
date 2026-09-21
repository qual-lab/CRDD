/**
 * check-runtime-capability-graphに属する責務をまとめる。
 *
 * @responsibility collectTypeScriptSourcesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";

import { assertVerificationToolCapabilityGraphForVerification } from "../src/security/platform-provisioner-package-filesystem.ts";

const scriptsRoot = path.resolve(import.meta.dirname);
const sources: Record<string, string> = {};

/**
 * Type Script Sourcesを収集する。
 *
 * @responsibility Type Script Sourcesの収集範囲、重複排除、欠落時の結果境界を所有する。
 * @trace ARCH-000004
 * @input root: string、relativeRoot: string
 * @returns N/A: collectTypeScriptSourcesは戻り値を返さない。
 * @precondition 「root: string、relativeRoot: string」がcollectTypeScriptSourcesの入力契約を満たす。
 * @postcondition collectTypeScriptSourcesの責務を完了して呼出し元へ制御を戻す。
 * @effect collectTypeScriptSourcesはFilesystemの読取りまたは書込みを実行する。
 * @failure collectTypeScriptSourcesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant collectTypeScriptSourcesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security collectTypeScriptSourcesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: collectTypeScriptSourcesは共有非同期状態を持たない同期処理である。
 */
function collectTypeScriptSources(root: string, relativeRoot: string) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error("runtime_capability_graph_script_link_forbidden");
    const relativePath = `${relativeRoot}/${entry.name}`;
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectTypeScriptSources(absolutePath, relativePath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    sources[relativePath.replaceAll("\\", "/")] = fs.readFileSync(
      absolutePath,
      "utf8",
    );
  }
}

collectTypeScriptSources(scriptsRoot, "scripts");

assertVerificationToolCapabilityGraphForVerification(Object.freeze(sources));
process.stdout.write(
  `${JSON.stringify({ status: "accepted", sourceCount: Object.keys(sources).length, externalProcessCallCount: 6 })}\n`,
);
