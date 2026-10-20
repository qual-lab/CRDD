/**
 * 隔離Packageの現在Source配置と公開技術入口を確認する。
 *
 * @packageDocumentation
 * @responsibility 旧署名graphに依存せず上位への逆依存を検出する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 固定src配下のliteral import／exportと必要なRoot API。
 * @boundary unknown gateの前提配置。完全なTypeScript解析や敵対Sourceの安全証明ではない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import test from "node:test";
import {
  createDockerTaskRecoveryExecutor,
  createDockerIsolationRuntime,
  createDockerAuthenticationRuntimeFactory,
  startDockerProbeAttachedProcess,
} from "../../src/index.ts";

const sourceRoot = path.resolve(import.meta.dirname, "../../src");
const platformAccessRoot = path.resolve(
  sourceRoot,
  "../../platform-access/src/index.ts",
);

/**
 * 現在の限定構文から読める依存先を配置契約へ照合する。
 *
 * @responsibility 上位・PA内部・未知bare依存を拒否し未評価のdynamic式を見逃さない。
 * @trace ERB-IT-004
 * @precondition fileは固定Sourceまたはメモリ内負例の所在である。
 * @stimulus literalのimport／再exportとdynamic importを読み取る。
 * @observation 不許可の依存先または非literal dynamicでassertionが失敗する。
 * @oracle Node builtin、同src内、PAのRoot一件だけを許可する。
 * @cleanup N/A: 読取りと文字列処理だけ。
 * @boundary 通常Source配置の回帰であり任意TypeScript構文の完全検査ではない。
 */
function assertDependencyBoundary(file: string, text: string) {
  for (const match of text.matchAll(/\bimport\s*\(([^)]*)\)/gu)) {
    assert.match(
      match[1]?.trim() ?? "",
      /^(?:"[^"\\\r\n]*"|'[^'\\\r\n]*')$/u,
      "nonliteral_dynamic_import",
    );
  }
  for (const match of text.matchAll(
    /(?<![.\w])\b(?:from|import)\s*(?:\(\s*)?["']([^"'\r\n]+)["']/gu,
  )) {
    const specifier = match[1];
    assert.ok(specifier);
    if (isBuiltin(specifier)) continue;
    assert.ok(specifier.startsWith("."), `unknown_dependency:${specifier}`);
    const resolved = path.resolve(path.dirname(file), specifier);
    const relative = path.relative(sourceRoot, resolved);
    assert.ok(
      resolved === platformAccessRoot ||
        (relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)),
      `dependency_outside_owner:${specifier}`,
    );
  }
}

/**
 * 固定Source全数を同じ判定へ渡す。
 *
 * @responsibility 負例だけでなく現在の実Sourceへ配置契約を適用する。
 * @trace ERB-IT-004
 * @precondition 現在Checkoutのsrcを読める。
 * @stimulus Directoryを列挙し各TypeScriptファイルを読み取る。
 * @observation 全対象が同じ判定を通る。
 * @oracle linkやSourceなしを正常母集団としない。
 * @cleanup N/A: ファイル作成・Process起動なし。
 * @boundary 現行Source→限定依存検査。
 */
test("隔離Sourceは同PackageとPlatform Access RootとNode builtinだけを参照する", () => {
  const pending = [sourceRoot];
  let files = 0;
  while (pending.length) {
    const directory = pending.pop();
    assert.ok(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, file);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.isFile() && entry.name.endsWith(".ts")) {
        assertDependencyBoundary(file, fs.readFileSync(file, "utf8"));
        files += 1;
      }
    }
  }
  assert.ok(files > 0);
});

/**
 * 通常の依存構文と逆依存の反例を確認する。
 *
 * @responsibility type-onlyや再exportを名前だけで許可しない。
 * @trace ERB-IT-004
 * @precondition メモリ内Sourceだけを使う。
 * @stimulus 正常四形と上位・PA内部・未知module・非literalを渡す。
 * @observation 正常の受理と各反例の指定理由による拒否。
 * @oracle 全反例が例外を起こし現在Sourceへの判定と同じ関数を使用する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary import先の配置検査。実Moduleの安全性は主張しない。
 */
test("逆依存・PA内部参照・未知module・非literalの取りこぼしを拒否する", () => {
  const file = path.join(sourceRoot, "index.ts");
  for (const text of [
    'import fs from "node:fs";',
    'import type { Value } from "./execution/plan.ts";',
    'export { Value } from "../../platform-access/src/index.ts";',
    'const selected = import("./execution/plan.ts");',
    'const marker = Buffer.from("CRDDDR06");',
  ])
    assert.doesNotThrow(() => assertDependencyBoundary(file, text));
  for (const owner of [
    "coordinator",
    "orchestrator",
    "ai-adapter",
    "workbench-server",
    "mcp-server",
    "domain-model",
  ]) {
    const target = `../../${owner}/src/index.ts`;
    for (const text of [
      `import type { Value } from "${target}";`,
      `export { Value } from "${target}";`,
      `const selected = import("${target}");`,
    ])
      assert.throws(
        () => assertDependencyBoundary(file, text),
        /dependency_outside_owner/u,
      );
  }
  for (const specifier of [
    "../../platform-access/src/process/environment.ts",
    "../../../../outside.ts",
  ])
    assert.throws(
      () =>
        assertDependencyBoundary(file, `import { Value } from "${specifier}";`),
      /dependency_outside_owner/u,
    );
  for (const specifier of ["node:not-a-real-module", "unknown-package"]) {
    assert.throws(
      () =>
        assertDependencyBoundary(file, `import { Value } from "${specifier}";`),
      /unknown_dependency/u,
    );
  }
  for (const expression of [
    "variable",
    '"./execution/" + variable',
    'condition ? "./execution/plan.ts" : variable',
    '("./execution/plan.ts")',
    '"./execution/plan.ts", { with: {} }',
    '"./execution/command\\u002dplan.ts"',
  ])
    assert.throws(
      () =>
        assertDependencyBoundary(
          file,
          `const selected = import(${expression});`,
        ),
      /nonliteral_dynamic_import/u,
    );
});

/**
 * 必要な技術入口がPackage Rootに実公開されていることを確認する。
 *
 * @responsibility Source中の同名文字列だけで公開成立としない。
 * @trace ERB-IT-004
 * @precondition 現行RootのES Moduleを読み込む。
 * @stimulus 上位が使う実行・認証・回収・attach入口を取得する。
 * @observation 各exportが実関数である。
 * @oracle API欠測を配置検査の成功で補完しない。
 * @cleanup N/A: 関数は呼び出さず外部Effectを発行しない。
 * @boundary 公開APIの存在だけで実Dockerの成立は主張しない。
 */
test("必要な隔離技術APIは公開し内部生成Primitiveは公開しない", async () => {
  for (const [name, entry] of Object.entries({
    createDockerTaskRecoveryExecutor,
    createDockerIsolationRuntime,
    createDockerAuthenticationRuntimeFactory,
    startDockerProbeAttachedProcess,
  }))
    assert.equal(typeof entry, "function", name);
  const namespace = await import("../../src/index.ts");
  for (const name of [
    "recoverObservedDockerResource",
    "discoverSubmittedDockerResource",
    "observeSubmittedDockerResourceAbsent",
    "startOwnedWindowsProcess",
    "createDockerIsolationRuntimeCandidate",
    "createDockerAuthenticationRuntimeUsing",
    "createDockerAuthenticationRuntime",
  ])
    assert.equal(Object.hasOwn(namespace, name), false, name);
});
