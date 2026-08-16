import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(checkerRoot, "../..");
const inspectedRoots = Object.freeze([
  path.join(repositoryRoot, "tools"),
  path.join(repositoryRoot, "template", "tools"),
]);
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/u;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const TEST_FILE =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(unit|contract|integration|boundary|golden|current)\.test\.ts$/u;
const TYPESCRIPT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/u;
const MARKDOWN_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
const RESERVED_FILE_NAMES = new Set([
  ".gitignore",
  "README.md",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "tsconfig.strict.json",
  "tsconfig.tests.json",
]);
const FORBIDDEN_BARE_IDENTIFIERS = new Set([
  "common",
  "data",
  "doThing",
  "execute",
  "helper",
  "info",
  "manager",
  "misc",
  "run",
  "util",
]);

function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      assert.match(entry.name, KEBAB_CASE, `folder name: ${target}`);
      files.push(...collectFiles(target));
      continue;
    }
    assert.ok(entry.isFile(), `unsupported filesystem entry: ${target}`);
    files.push(target);
  }
  return files;
}

function assertFileName(file: string): void {
  const name = path.basename(file);
  if (RESERVED_FILE_NAMES.has(name)) return;
  if (name.endsWith(".test.ts")) {
    assert.match(name, TEST_FILE, `test filename: ${file}`);
    return;
  }
  if (name.endsWith(".ts")) {
    assert.match(name, TYPESCRIPT_FILE, `TypeScript filename: ${file}`);
    return;
  }
  if (name.endsWith(".md")) {
    assert.match(name, MARKDOWN_FILE, `Markdown filename: ${file}`);
    return;
  }
  assert.fail(`unrecognized filename without an owned convention: ${file}`);
}

function assertSourceIdentifiers(file: string): void {
  if (!file.endsWith(".ts")) return;
  const source = fs.readFileSync(file, "utf8");
  const typeDeclarations = source.matchAll(
    /^\s*(?:export\s+)?(?:class|interface|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gmu,
  );
  for (const match of typeDeclarations) {
    assert.match(match[1] ?? "", PASCAL_CASE, `type identifier: ${file}`);
  }

  const functionDeclarations = source.matchAll(
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gmu,
  );
  for (const match of functionDeclarations) {
    const name = match[1] ?? "";
    assert.match(name, CAMEL_CASE, `function identifier: ${file}`);
    assert.equal(
      FORBIDDEN_BARE_IDENTIFIERS.has(name),
      false,
      `forbidden bare function identifier ${name}: ${file}`,
    );
  }

  const variableDeclarations = source.matchAll(
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gmu,
  );
  for (const match of variableDeclarations) {
    const name = match[1] ?? "";
    assert.ok(
      CAMEL_CASE.test(name) || UPPER_SNAKE_CASE.test(name),
      `variable identifier ${name}: ${file}`,
    );
    assert.equal(
      FORBIDDEN_BARE_IDENTIFIERS.has(name),
      false,
      `forbidden bare variable identifier ${name}: ${file}`,
    );
  }

  const booleanBindings = source.matchAll(
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*boolean)?\s*=\s*(?:true|false)\b/gmu,
  );
  for (const match of booleanBindings) {
    assert.match(
      match[1] ?? "",
      /^(?:is|has|can|should)[A-Z][A-Za-z0-9]*$/u,
      `Boolean binding: ${file}`,
    );
  }

  const arrayBindings = source.matchAll(
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=\n]+)?=\s*\[/gmu,
  );
  for (const match of arrayBindings) {
    assert.match(
      match[1] ?? "",
      /(?:s|children|indices|vertices)$/u,
      `Array binding must describe plural contents: ${file}`,
    );
  }
}

test("toolsのPathとsource identifierは内部コーディング規約へ一致する", () => {
  const files = inspectedRoots.flatMap(collectFiles);
  for (const file of files) {
    assertFileName(file);
    assertSourceIdentifiers(file);
  }
});

test("旧checker Pathは現行Treeに残らない", () => {
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "tools", "checker", "crdd_check.ts"),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "template", "tools", "crdd_check.ts"),
    ),
    false,
  );
});
