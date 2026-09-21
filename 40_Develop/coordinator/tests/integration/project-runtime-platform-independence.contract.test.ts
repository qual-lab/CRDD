/**
 * coordinator:integration:project-runtime-platform-independenceの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-platform-independenceが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope project、runtime、platform、independence
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * Project Runtime Core population for the responsibility-separation stage.
 * Core depends only on IF-PLATFORM and IF-TRANSPORT contracts; the machine
 * check below rejects any transitive import that leaves this closed set or
 * reaches an OS-specific module (01_Architecture.md 14.9, PR-A-07 companion).
 *
 * @responsibility discoverProjectRuntimeModulesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus discoverProjectRuntimeModulesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
function discoverProjectRuntimeModules(): readonly string[] {
  const sourceRoot = path.join(
    repositoryRoot,
    "40_Develop/project-runtime/src",
  );
  const modules: string[] = [];
  const pendingDirectories = [sourceRoot];
  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    assert.ok(directory !== undefined);
    const metadata = fs.lstatSync(directory);
    assert.equal(metadata.isSymbolicLink(), false, directory);
    assert.equal(metadata.isDirectory(), true, directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, absolutePath);
      if (entry.isDirectory()) pendingDirectories.push(absolutePath);
      else if (entry.isFile() && entry.name.endsWith(".ts"))
        modules.push(normalize(path.relative(repositoryRoot, absolutePath)));
    }
  }
  return Object.freeze(modules.sort());
}

const ALLOWED_NODE_BUILTINS = Object.freeze(["node:crypto", "node:util"]);

const FORBIDDEN_SOURCE_PATTERNS = Object.freeze([
  /process\.platform/u,
  /node:child_process/u,
  /node:fs/u,
  /node:os/u,
  /node:path/u,
  /node:module/u,
  /[A-Za-z]:\\\\/u,
  /\\\\\\\\\./u,
  // Import forms the specifier scan below cannot resolve must not exist in
  // the core closure at all: dynamic import, require, and any single-quote /
  // backtick specifier (with or without "from").
  /import\s*\(/u,
  /require\s*\(/u,
  /from\s*'/u,
  /from\s*`/u,
  /import\s*'/u,
  /import\s*`/u,
] as const);

/**
 * normalizeのTest準備責務を実行する。
 *
 * @responsibility normalizeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus normalizeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
function normalize(relativePath: string): string {
  return relativePath.replaceAll("\\", "/");
}

const coreModules = discoverProjectRuntimeModules();

/**
 * readRuntimeSourceのTest準備責務を実行する。
 *
 * @responsibility readRuntimeSourceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus readRuntimeSourceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
function readRuntimeSource(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

/**
 * Parse import specifiers and reconcile the parse count against a raw token
 * count. Any `from "…"` or bare `import "…"` occurrence the parser did not
 * capture (a second import on one line, a comment-prefixed import, an
 * unexpected spelling) makes the scan inconsistent, so unparseable intake
 * syntax fails closed instead of passing unscanned.
 *
 * @responsibility importSpecifierScanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus importSpecifierScanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
function importSpecifierScan(source: string): Readonly<{
  specifiers: readonly string[];
  isConsistent: boolean;
}> {
  const specifiers: string[] = [];
  let parsedFromImports = 0;
  let parsedBareImports = 0;
  const importPattern =
    /(?:^|\n)\s*(?:import|export)[^"'`;]*?from\s+"([^"]+)"|(?:^|\n)\s*import\s+"([^"]+)"/gu;
  for (const match of source.matchAll(importPattern)) {
    const fromSpecifier = match[1];
    const bareSpecifier = match[2];
    if (typeof fromSpecifier === "string") {
      specifiers.push(fromSpecifier);
      parsedFromImports += 1;
    } else if (typeof bareSpecifier === "string") {
      specifiers.push(bareSpecifier);
      parsedBareImports += 1;
    }
  }
  const fromTokens = source.match(/\bfrom\s*"/gu)?.length ?? 0;
  const bareTokens = source.match(/(?<![.\w])import\s*"/gu)?.length ?? 0;
  return Object.freeze({
    specifiers: Object.freeze(specifiers),
    isConsistent:
      parsedFromImports === fromTokens && parsedBareImports === bareTokens,
  });
}

/**
 * Project Runtime CoreのimportはPlatform非依存の閉集合に一致するを検証する。
 *
 * @responsibility Project Runtime CoreのimportはPlatform非依存の閉集合に一致するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Project Runtime CoreのimportはPlatform非依存の閉集合に一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
test("Project Runtime CoreのimportはPlatform非依存の閉集合に一致する", () => {
  const allowedModules = new Set(coreModules);
  const allowedBuiltins = new Set(ALLOWED_NODE_BUILTINS);
  const visitedModules = new Set<string>();
  const pendingModules = [...coreModules];
  while (pendingModules.length > 0) {
    const moduleRelativePath = pendingModules.pop();
    if (moduleRelativePath === undefined) break;
    if (visitedModules.has(moduleRelativePath)) continue;
    visitedModules.add(moduleRelativePath);
    const source = readRuntimeSource(moduleRelativePath);
    const scan = importSpecifierScan(source);
    assert.ok(
      scan.isConsistent,
      `${moduleRelativePath} contains import syntax the specifier scan cannot resolve`,
    );
    for (const specifier of scan.specifiers) {
      if (specifier.startsWith("node:")) {
        assert.ok(
          allowedBuiltins.has(specifier),
          `${moduleRelativePath} imports forbidden builtin ${specifier}`,
        );
        continue;
      }
      assert.ok(
        specifier.startsWith("./") || specifier.startsWith("../"),
        `${moduleRelativePath} imports non-relative module ${specifier}`,
      );
      const resolved = normalize(
        path.relative(
          repositoryRoot,
          path.resolve(
            repositoryRoot,
            path.dirname(moduleRelativePath),
            specifier,
          ),
        ),
      );
      assert.ok(
        allowedModules.has(resolved),
        `${moduleRelativePath} imports ${resolved} outside the platform-free core closure`,
      );
      pendingModules.push(resolved);
    }
  }
  assert.deepEqual(
    [...visitedModules].sort(),
    [...allowedModules].sort(),
    "core closure must match the declared platform-free population exactly",
  );
});

/**
 * Project Runtime CoreはOS固有tokenとOS Path実値を含まないを検証する。
 *
 * @responsibility Project Runtime CoreはOS固有tokenとOS Path実値を含まないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Project Runtime CoreはOS固有tokenとOS Path実値を含まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
test("Project Runtime CoreはOS固有tokenとOS Path実値を含まない", () => {
  for (const moduleRelativePath of coreModules) {
    const source = readRuntimeSource(moduleRelativePath);
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS)
      assert.equal(
        pattern.test(source),
        false,
        `${moduleRelativePath} matches forbidden pattern ${pattern}`,
      );
  }
});

/**
 * import走査は解釈できない取り込み構文をFail Closedで検出するを検証する。
 *
 * @responsibility import走査は解釈できない取り込み構文をFail Closedで検出するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus import走査は解釈できない取り込み構文をFail Closedで検出するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
test("import走査は解釈できない取り込み構文をFail Closedで検出する", () => {
  const evasionForms = [
    'import a from "./x.ts"; import b from "./evil.ts";',
    'import a from "./x.ts"; export { y } from "./evil.ts";',
    '/* comment */ import b from "./evil.ts";',
    'import"./evil.ts";',
  ];
  for (const evasionForm of evasionForms)
    assert.equal(
      importSpecifierScan(evasionForm).isConsistent,
      false,
      evasionForm,
    );
  assert.equal(
    importSpecifierScan('import { a } from "./x.ts";\nimport "./y.ts";\n')
      .isConsistent,
    true,
  );
});

/**
 * Windows AdapterはCore閉集合の外にあり、CoreはAdapterを参照しないを検証する。
 *
 * @responsibility Windows AdapterはCore閉集合の外にあり、CoreはAdapterを参照しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows AdapterはCore閉集合の外にあり、CoreはAdapterを参照しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
test("Windows AdapterはCore閉集合の外にあり、CoreはAdapterを参照しない", () => {
  const windowsAdapterPath =
    "40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts";
  assert.ok(
    fs.existsSync(path.join(repositoryRoot, windowsAdapterPath)),
    "windows adapter module must exist",
  );
  for (const moduleRelativePath of coreModules) {
    const source = readRuntimeSource(moduleRelativePath);
    assert.equal(
      source.includes("project-runtime-windows-platform-adapter"),
      false,
      `${moduleRelativePath} must not reference the windows adapter`,
    );
  }
  const windowsAdapterSource = readRuntimeSource(windowsAdapterPath);
  assert.equal(/process\.platform/u.test(windowsAdapterSource), true);
});
