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
 */
const CORE_MODULES = Object.freeze([
  "40_Develop/coordinator/src/security/mcp-project-runtime-adapter.ts",
  "40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts",
  "40_Develop/project-runtime/src/index.ts",
  "40_Develop/project-runtime/src/core/project-runtime-state.ts",
  "40_Develop/project-runtime/src/ports/platform-contract.ts",
]);

const ALLOWED_SHARED_MODULES = Object.freeze([
  "40_Develop/coordinator/src/security/plain-data-snapshot.ts",
  "40_Develop/coordinator/src/security/project-runtime-integration-result.ts",
  "40_Develop/coordinator/src/security/project-runtime-objective-request.ts",
]);

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

function normalize(relativePath: string): string {
  return relativePath.replaceAll("\\", "/");
}

function readRuntimeSource(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

/**
 * Parse import specifiers and reconcile the parse count against a raw token
 * count. Any `from "…"` or bare `import "…"` occurrence the parser did not
 * capture (a second import on one line, a comment-prefixed import, an
 * unexpected spelling) makes the scan inconsistent, so unparseable intake
 * syntax fails closed instead of passing unscanned.
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

test("Project Runtime CoreのimportはPlatform非依存の閉集合に一致する", () => {
  const allowedModules = new Set([...CORE_MODULES, ...ALLOWED_SHARED_MODULES]);
  const allowedBuiltins = new Set(ALLOWED_NODE_BUILTINS);
  const visitedModules = new Set<string>();
  const pendingModules = [...CORE_MODULES];
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

test("Project Runtime CoreはOS固有tokenとOS Path実値を含まない", () => {
  for (const moduleRelativePath of [
    ...CORE_MODULES,
    ...ALLOWED_SHARED_MODULES,
  ]) {
    const source = readRuntimeSource(moduleRelativePath);
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS)
      assert.equal(
        pattern.test(source),
        false,
        `${moduleRelativePath} matches forbidden pattern ${pattern}`,
      );
  }
});

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

test("Windows AdapterはCore閉集合の外にあり、CoreはAdapterを参照しない", () => {
  const windowsAdapterPath =
    "40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts";
  assert.ok(
    fs.existsSync(path.join(repositoryRoot, windowsAdapterPath)),
    "windows adapter module must exist",
  );
  for (const moduleRelativePath of CORE_MODULES) {
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
