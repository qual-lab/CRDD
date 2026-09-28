/**
 * Workbench Node RuntimeのBrowser依存閉包試験。
 *
 * @packageDocumentation
 * @responsibility Node入口から到達するTypeScript依存を列挙し、Browser React実装がServer Runtimeへ混入しないことを検証する。
 * @trace ERB-IT-021
 * @level IT
 * @scope workbench、node-runtime、browser-client、dependency-closure
 * @boundary ERB-IT-021=Direct Boundary: Workbench Node Entrypoint→Local TypeScript Dependency Graph
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const packageRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(packageRoot, "../..");

/**
 * Import／Export宣言がRuntime valueを搬送するか判定する。
 *
 * @responsibility type-only宣言を実行時依存へ数えず、default・namespace・value named importを識別する。
 * @trace ERB-IT-021
 * @input Import／Export宣言のmodule clause文字列を受け取る。
 * @returns Runtime value依存ならtrueを返す。
 * @precondition clauseは閉じた宣言Patternから抽出済みである。
 * @postcondition type-only named集合はfalse、star exportとvalue宣言はtrueになる。
 * @effect N/A: Syntax Treeだけを読む。
 * @failure N/A: 閉じたSyntax種別だけを処理する。
 * @invariant 型参照をNode Runtime依存へ昇格しない。
 * @boundary TypeScript宣言文字列とRuntime依存Graphの境界。
 * @security Source本文を試験結果へ出力しない。
 * @concurrency N/A: 同期純粋判定である。
 */
function carriesRuntimeValue(clause: string): boolean {
  const normalized = clause.trim();
  if (normalized.startsWith("type ")) return false;
  if (!normalized.startsWith("{")) return true;
  const body = normalized.replace(/^\{/u, "").replace(/\}$/u, "");
  return body
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .some((value) => !value.startsWith("type "));
}

/**
 * 一SourceのRuntime module参照を抽出する。
 *
 * @responsibility 静的Import、再Exportおよび文字列Literalのdynamic importを同じ参照集合へ閉じる。
 * @trace ERB-IT-021
 * @input TypeScript／TSX Source File Pathを受け取る。
 * @returns Runtime valueとして到達するmodule specifier集合を返す。
 * @precondition filePathはWorkbench package内の通常Sourceである。
 * @postcondition type-only宣言を含まず、同一specifierを重複しない。
 * @effect Source Fileを読取る。
 * @failure 非Literal dynamic importまたは閉じない宣言は試験を例外終了する。
 * @invariant dynamic importの非Literal入力を安全なLocal依存として推測しない。
 * @boundary Workbench SourceとDependency Graph試験の境界。
 * @security Source本文を返さない。
 * @concurrency N/A: 一Fileを同期読取りする。
 */
function runtimeSpecifiers(filePath: string): readonly string[] {
  const source = readFileSync(filePath, "utf8");
  const found = new Set<string>();
  const declarations =
    /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)\s+from\s+["']([^"']+)["']\s*;/gu;
  for (const match of source.matchAll(declarations))
    if (carriesRuntimeValue(match[1] ?? "")) found.add(match[2] ?? "");
  const sideEffects = /(?:^|\n)\s*import\s+["']([^"']+)["']\s*;/gu;
  for (const match of source.matchAll(sideEffects)) found.add(match[1] ?? "");
  const dynamicImports = [...source.matchAll(/\bimport\s*\(/gu)];
  const literalDynamicImports = [
    ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu),
  ];
  if (dynamicImports.length !== literalDynamicImports.length)
    throw new Error("workbench_dynamic_import_not_closed");
  for (const match of literalDynamicImports) found.add(match[1] ?? "");
  return Object.freeze([...found]);
}

/**
 * 相対module specifierを既存Source Pathへ解決する。
 *
 * @responsibility Node入口のLocal TypeScript依存だけを再帰対象へ変換する。
 * @trace ERB-IT-021
 * @input importerと相対module specifierを受け取る。
 * @returns 正規化済み絶対Source Pathを返す。
 * @precondition specifierは相対Pathで始まり、拡張子付きである。
 * @postcondition 解決Pathは現在Repository内に留まる。
 * @effect N/A: Path文字列だけを変換する。
 * @failure Package越境または拡張子なしを例外で拒否する。
 * @invariant Node built-inと外部packageをLocal Sourceへ推測しない。
 * @boundary Module SpecifierとFilesystem Source Identityの境界。
 * @security Repository Root越境を拒否する。
 * @concurrency N/A: 同期純粋変換である。
 */
function resolveLocalSource(importer: string, specifier: string): string {
  const resolved = path.resolve(path.dirname(importer), specifier);
  const relative = path.relative(repositoryRoot, resolved);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !/\.[cm]?[jt]sx?$/u.test(resolved)
  )
    throw new Error("workbench_local_runtime_dependency_invalid");
  return resolved;
}

/**
 * Node Server入口がBrowser React valueをRuntime依存に含めないことを検証する。
 *
 * @responsibility 純粋CSRの配布閉包をSource Graphで反証する。
 * @trace ERB-IT-021
 * @precondition Node入口とLocal TypeScript Sourceが現在のpackageに存在する。
 * @stimulus CLI入口からRuntime value import／exportを再帰走査する。
 * @observation 到達Source集合と外部module specifierを観測する。
 * @oracle Serverへ到達する一方、Client ModelとReact value依存へは到達しない。
 * @cleanup N/A: Sourceを読取るだけである。
 * @boundary ERB-IT-021=Direct Boundary: Workbench Node Entrypoint→Local TypeScript Dependency Graph
 */
test("Workbench Node RuntimeはBrowser React value依存へ到達しない", () => {
  const pending = [path.join(packageRoot, "bin", "workbench.ts")];
  const visited = new Set<string>();
  const external = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    assert.ok(current);
    if (visited.has(current)) continue;
    visited.add(current);
    for (const specifier of runtimeSpecifiers(current)) {
      if (specifier.startsWith(".")) {
        pending.push(resolveLocalSource(current, specifier));
      } else {
        external.add(specifier);
      }
    }
  }
  assert.ok(
    [...visited].some((value) => value.endsWith("workbench-server.ts")),
  );
  assert.equal(
    [...visited].some((value) => value.endsWith("workbench-client-model.ts")),
    false,
  );
  assert.equal(
    [...visited].some(
      (value) =>
        value.endsWith(".tsx") ||
        path.relative(packageRoot, value).split(path.sep).includes("client"),
    ),
    false,
  );
  assert.equal(
    [...external].some((specifier) => /^react(?:\/|$)/u.test(specifier)),
    false,
  );
});
