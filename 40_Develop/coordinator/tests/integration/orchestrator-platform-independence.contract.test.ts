/**
 * coordinator:integration:orchestrator-platform-independenceの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:orchestrator-platform-independenceが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope project、runtime、platform、independence
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Orchestrator Application Port→Core
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { API } from "typescript/unstable/sync";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import {
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isNamedExports,
  isNamedImports,
  isStringLiteral,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * 現行Orchestratorの全Sourceを発見し、責務別の閉集合照合へ渡す。
 * 純粋Fileの実行時閉包と型所有境界は別のOracleで検査する。
 *
 * @responsibility discoverOrchestratorModulesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus discoverOrchestratorModulesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function discoverOrchestratorModules(): readonly string[] {
  const sourceRoot = path.join(repositoryRoot, "40_Develop/orchestrator/src");
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

const ALLOWED_NODE_BUILTINS = new Map([
  ["node:crypto", new Set(["createHash"])],
  ["node:util", new Set(["types"])],
]);

const FORBIDDEN_SOURCE_PATTERNS = Object.freeze([
  /process\.platform/u,
  /node:child_process/u,
  /node:fs/u,
  /node:os/u,
  /node:path/u,
  /node:module/u,
  /\bDate\.now\s*\(/u,
  /\bnew\s+Date\s*\(\s*\)/u,
  /\bMath\.random\s*\(/u,
  /\brandom(?:Bytes|UUID)\b/u,
  /\b(?:setTimeout|setInterval|setImmediate)\s*\(/u,
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
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function normalize(relativePath: string): string {
  return relativePath.replaceAll("\\", "/");
}

const allModules = discoverOrchestratorModules();
// Folder名ではなく現行ArchitectureのFile責務を全数固定する。
const SOURCE_ROLES = {
  pure: [
    "activity/cursor.ts",
    "activity/types.ts",
    "activity/validate.ts",
    "candidate/integration-result.ts",
    "candidate/operations.ts",
    "candidate/record-writer.ts",
    "decision/acceptance-authority.ts",
    "decision/acceptance-record.ts",
    "decision/authority-adapter.ts",
    "decision/capability.ts",
    "decision/records.ts",
    "decision/recovery-record.ts",
    "decision/request.ts",
    "identity/clock-and-hash.ts",
    "identity/repository-binding.ts",
    "input/plain-data-snapshot.ts",
    "input/repository-relative-path.ts",
    "lease/controller.ts",
    "objective/request.ts",
    "operation-result-contract.ts",
    "operation-result.ts",
    "platform/contract.ts",
    "process/safety-contract.ts",
    "queue/types.ts",
    "state/persistence.ts",
    "state/query-contract.ts",
    "state/transitions.ts",
    "storage/types.ts",
    "storage/validate-result-record.ts",
    "task/executor.ts",
    "task/observer.ts",
    "task/recovery.ts",
    "task/single-task-record.ts",
  ],
  workflow: [
    "activity/read.ts",
    "candidate/adopt.ts",
    "candidate/integrate.ts",
    "decision/lifecycle.ts",
    "decision/record-acceptance.ts",
    "objective/execute.ts",
    "objective/plan.ts",
    "objective/replan.ts",
    "state/query.ts",
    "task/dispatch.ts",
    "task/settle-docker-recovery.ts",
    "workspace/record.ts",
  ],
  adapter: [
    "candidate/integration-adapter.ts",
    "cli/command.ts",
    "decision/capability-adapter.ts",
    "identity/observe-principal.ts",
    "objective/intake-dependencies.ts",
    "operation-composition.ts",
    "platform/windows-adapter.ts",
    "task/execute-attempt.ts",
    "task/host-adapter.ts",
    "task/intelligence-adapter.ts",
    "task/recovery-adapter.ts",
    "task/request-composition.ts",
    "task/requests.ts",
    "workspace/commands.ts",
    "workspace/operations.ts",
  ],
  storage: [
    "storage/current-state.ts",
    "storage/history.ts",
    "storage/protected-decision.ts",
  ],
  entry: ["index.ts"],
} as const;
const SOURCE_PREFIX = "40_Develop/orchestrator/src/";
const coreModules = SOURCE_ROLES.pure.map((file) => `${SOURCE_PREFIX}${file}`);

/**
 * File責務表を現Source集合へ完全一致で照合する。
 * @responsibility 未分類・重複・純粋集合の欠測を検出する。
 * @trace PRL-IT-012
 * @precondition PathはRepository相対の実Source一覧から得る。
 * @stimulus 責務表と発見集合を比較する。
 * @observation 全Pathの重複と集合差を取得する。
 * @oracle 一File一分類、全数一致、純粋集合非空。
 * @cleanup N/A: 値だけを比較する。
 * @boundary 試験内のSource分類。
 */
function assertSourcePopulation(
  roles: Readonly<Record<string, readonly string[]>>,
  actual: readonly string[],
) {
  assert.ok((roles.pure?.length ?? 0) > 0, "pure population empty");
  const classified = Object.values(roles)
    .flat()
    .map((file) => `${SOURCE_PREFIX}${file}`);
  assert.equal(
    new Set(classified).size,
    classified.length,
    "duplicate responsibility",
  );
  assert.deepEqual(
    [...classified].sort(),
    [...actual].sort(),
    "unclassified or missing source",
  );
  return classified;
}

/**
 * 純粋Fileの実行時依存と型所有境界を検査する。
 * @responsibility 保存・Adapter・外部Rootを実行時閉包へ混入させない。
 * @trace PRL-IT-012
 * @precondition ASTで型専用と実行時の辺を分離済みである。
 * @stimulus 各辺の参照先と組込みsymbolを照合する。
 * @observation 不正辺を理由付きassertionで拒否する。
 * @oracle 実行時辺は純粋集合内、型は所属内または実在する公開Rootだけ。
 * @cleanup N/A: 新規資源を取得しない。
 * @boundary Repository Sourceと型所有の検査。
 */
function assertPureImportEdges(
  module: string,
  scan: ReturnType<typeof importSpecifierScan>,
) {
  assert.ok(scan.isConsistent, "unresolved import syntax");
  for (const { specifier, typeOnly, names } of scan.edges) {
    if (specifier.startsWith("node:")) {
      assert.ok(
        names.length > 0 &&
          names.every((name) =>
            ALLOWED_NODE_BUILTINS.get(specifier)?.has(name),
          ),
        "forbidden builtin",
      );
      continue;
    }
    assert.ok(
      specifier.startsWith("./") || specifier.startsWith("../"),
      "non-relative dependency",
    );
    const resolved = normalize(
      path.relative(
        repositoryRoot,
        path.resolve(repositoryRoot, path.dirname(module), specifier),
      ),
    );
    if (typeOnly) {
      assert.ok(
        coreModules.includes(resolved) ||
          (/^40_Develop\/(?!orchestrator\/)[^/]+\/src\/index\.ts$/u.test(
            resolved,
          ) &&
            fs.existsSync(path.join(repositoryRoot, resolved))),
        "private type dependency",
      );
    } else
      assert.ok(coreModules.includes(resolved), "outside pure runtime closure");
  }
}

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
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function readRuntimeSource(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

/**
 * ASTから型専用と実行時の依存辺を別々に抽出する。
 * 混在宣言の個別type、型import式、再exportを区別し、
 * 非literal動的import・require・ImportEqualsは検査不能として拒否する。
 *
 * @responsibility importSpecifierScanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus importSpecifierScanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function importSpecifierScan(source: SourceFile) {
  const edges: { specifier: string; typeOnly: boolean; names: string[] }[] = [];
  let isConsistent = true;
  const pending: Node[] = [source];
  while (pending.length) {
    const node = pending.pop();
    assert.ok(node);
    node.forEachChild((child) => {
      pending.push(child);
    });
    if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (!clause) edges.push({ specifier, typeOnly: false, names: [] });
      else {
        if (clause.name)
          edges.push({
            specifier,
            typeOnly: clause.phaseModifier === SyntaxKind.TypeKeyword,
            names: ["default"],
          });
        const bindings = clause.namedBindings;
        if (bindings && isNamedImports(bindings)) {
          if (
            !clause.name &&
            bindings.elements.every((binding) => binding.isTypeOnly) &&
            clause.phaseModifier !== SyntaxKind.TypeKeyword
          )
            edges.push({ specifier, typeOnly: false, names: [] });
          if (
            bindings.elements.length === 0 &&
            clause.phaseModifier === SyntaxKind.TypeKeyword
          )
            edges.push({ specifier, typeOnly: true, names: [] });
          for (const binding of bindings.elements)
            edges.push({
              specifier,
              typeOnly:
                clause.phaseModifier === SyntaxKind.TypeKeyword ||
                binding.isTypeOnly,
              names: [binding.propertyName?.text ?? binding.name.text],
            });
        } else if (bindings)
          edges.push({
            specifier,
            typeOnly: clause.phaseModifier === SyntaxKind.TypeKeyword,
            names: ["*"],
          });
      }
    } else if (
      isExportDeclaration(node) &&
      node.moduleSpecifier &&
      isStringLiteral(node.moduleSpecifier)
    ) {
      if (node.exportClause && isNamedExports(node.exportClause)) {
        if (
          node.exportClause.elements.every((binding) => binding.isTypeOnly) &&
          !node.isTypeOnly
        )
          edges.push({
            specifier: node.moduleSpecifier.text,
            typeOnly: false,
            names: [],
          });
        if (node.exportClause.elements.length === 0 && node.isTypeOnly)
          edges.push({
            specifier: node.moduleSpecifier.text,
            typeOnly: true,
            names: [],
          });
        for (const binding of node.exportClause.elements)
          edges.push({
            specifier: node.moduleSpecifier.text,
            typeOnly: node.isTypeOnly || binding.isTypeOnly,
            names: [binding.propertyName?.text ?? binding.name.text],
          });
      } else
        edges.push({
          specifier: node.moduleSpecifier.text,
          typeOnly: node.isTypeOnly,
          names: ["*"],
        });
    } else if (isImportTypeNode(node)) {
      if (
        isLiteralTypeNode(node.argument) &&
        isStringLiteral(node.argument.literal)
      )
        edges.push({
          specifier: node.argument.literal.text,
          typeOnly: true,
          names: [],
        });
      else isConsistent = false;
    } else if (isCallExpression(node)) {
      if (node.expression.kind === SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        if (argument && isStringLiteral(argument))
          edges.push({ specifier: argument.text, typeOnly: false, names: [] });
        else isConsistent = false;
      } else if (
        isIdentifier(node.expression) &&
        node.expression.text === "require"
      )
        isConsistent = false;
    } else if (node.kind === SyntaxKind.ImportEqualsDeclaration)
      isConsistent = false;
  }
  return { edges, isConsistent };
}

/**
 * Orchestrator CoreのimportはPlatform非依存の閉集合に一致するを検証する。
 *
 * @responsibility Orchestrator CoreのimportはPlatform非依存の閉集合に一致するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Orchestrator CoreのimportはPlatform非依存の閉集合に一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Orchestrator CoreのimportはPlatform非依存の閉集合に一致する", () => {
  assertSourcePopulation(SOURCE_ROLES, allModules);
  assert.throws(
    () =>
      assertSourcePopulation(SOURCE_ROLES, [
        ...allModules,
        `${SOURCE_PREFIX}unexpected.ts`,
      ]),
    /unclassified or missing source/u,
  );
  assert.throws(
    () =>
      assertSourcePopulation(
        { ...SOURCE_ROLES, entry: ["index.ts", "index.ts"] },
        allModules,
      ),
    /duplicate responsibility/u,
  );
  assert.throws(
    () => assertSourcePopulation({ ...SOURCE_ROLES, pure: [] }, allModules),
    /pure population empty/u,
  );
  const root = path.join(repositoryRoot, "40_Develop/orchestrator");
  const config = path
    .join(root, ".crdd-pure-oracle.json")
    .replaceAll("\\", "/");
  const configText = JSON.stringify({
    extends: "./tsconfig.json",
    files: allModules.map((file) =>
      path.join(repositoryRoot, file).replaceAll("\\", "/"),
    ),
    include: [],
  });
  const api = new API({
    cwd: root,
    fs: {
      readFile: (file) => (file === config ? configText : undefined),
      fileExists: (file) => (file === config ? true : undefined),
      realpath: (file) => (file === config ? file : undefined),
    },
  });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [config] });
    try {
      const project = snapshot.getProject(config);
      assert.ok(project);
      for (const moduleRelativePath of coreModules) {
        const source = project.program.getSourceFile(
          path.join(repositoryRoot, moduleRelativePath).replaceAll("\\", "/"),
        );
        assert.ok(source);
        assert.equal(
          project.program.getSyntacticDiagnostics(source.fileName).length,
          0,
        );
        const scan = importSpecifierScan(source);
        assertPureImportEdges(moduleRelativePath, scan);
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});

/**
 * Orchestrator CoreはOS固有tokenとOS Path実値を含まないを検証する。
 *
 * @responsibility Orchestrator CoreはOS固有tokenとOS Path実値を含まないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Orchestrator CoreはOS固有tokenとOS Path実値を含まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Orchestrator CoreはOS固有tokenとOS Path実値を含まない", () => {
  for (const moduleRelativePath of coreModules) {
    const source = readRuntimeSource(moduleRelativePath);
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS)
      assert.equal(
        pattern.test(source),
        false,
        `${moduleRelativePath} matches forbidden pattern ${pattern}`,
      );
  }
  for (const mutation of [
    "Date.now()",
    "new Date()",
    "Math.random()",
    "randomUUID()",
    "setTimeout(callback, 1)",
    "process.platform",
  ])
    assert.equal(
      FORBIDDEN_SOURCE_PATTERNS.some((pattern) => pattern.test(mutation)),
      true,
      mutation,
    );
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
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("import走査は解釈できない取り込み構文をFail Closedで検出する", () => {
  const root = path.join(repositoryRoot, "40_Develop/coordinator");
  const config = path
    .join(root, ".crdd-import-oracle.json")
    .replaceAll("\\", "/");
  const examples = [
    'import type { A } from "./type.ts"; import { b, type C } from "./mixed.ts"; export type { D } from "./export.ts"; type T = import("./type-expression.ts").T; import "./effect.ts";',
    "void import(target);",
    'const x = require("./module.ts");',
    'import x = require("./module.ts");',
    'import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";',
    'import type { T } from "../../../coordinator/src/task/execution.ts";',
    'import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";',
    'import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";',
    'import { randomUUID as random } from "node:crypto";',
    'import { readCurrentOrchestratorState } from "../storage/current-state.ts";',
    'import { queryOrchestratorState } from "./query.ts";',
    'import { snapshotPlainRecord } from "../input/plain-data-snapshot.ts";',
    'import type { T } from "../storage/current-state.ts";',
    'import type { Stats } from "node:fs";',
    'import type { T } from "../index.ts";',
    'import {} from "../storage/current-state.ts";',
    'export {} from "../storage/current-state.ts";',
    'import { type T } from "../storage/current-state.ts";',
    'export { type T } from "../storage/current-state.ts";',
    'export type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";',
  ];
  const files = examples.map((_, index) =>
    path.join(root, `.crdd-import-${index}.ts`).replaceAll("\\", "/"),
  );
  const virtual: Record<string, string> = {
    [config]: JSON.stringify({
      files,
      compilerOptions: { noLib: true, noResolve: true, noEmit: true },
    }),
  };
  for (const [index, file] of files.entries())
    virtual[file] = examples[index] ?? "";
  const api = new API({ cwd: root, fs: createVirtualFileSystem(virtual) });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [config] });
    try {
      const project = snapshot.getProject(config);
      assert.ok(project);
      for (const [index, file] of files.entries()) {
        const source = project.program.getSourceFile(file);
        assert.ok(source);
        assert.equal(project.program.getSyntacticDiagnostics(file).length, 0);
        const scan = importSpecifierScan(source);
        assert.equal(scan.isConsistent, index === 0 || index >= 4);
        if (index === 0)
          assert.deepEqual(
            scan.edges
              .map((edge) => [edge.specifier, edge.typeOnly, edge.names])
              .sort(),
            [
              ["./type.ts", true, ["A"]],
              ["./mixed.ts", false, ["b"]],
              ["./mixed.ts", true, ["C"]],
              ["./export.ts", true, ["D"]],
              ["./type-expression.ts", true, []],
              ["./effect.ts", false, []],
            ].sort(),
          );
        if (index >= 4) {
          const expected = [
            "outside pure runtime closure",
            "private type dependency",
            null,
            "outside pure runtime closure",
            "forbidden builtin",
            "outside pure runtime closure",
            "outside pure runtime closure",
            null,
            "private type dependency",
            "forbidden builtin",
            "private type dependency",
            "outside pure runtime closure",
            "outside pure runtime closure",
            "outside pure runtime closure",
            "outside pure runtime closure",
            null,
          ][index - 4];
          const check = () =>
            assertPureImportEdges(`${SOURCE_PREFIX}state/transitions.ts`, scan);
          if (expected === null) check();
          else {
            assert.ok(expected);
            assert.throws(
              check,
              (error) =>
                error instanceof assert.AssertionError &&
                error.message.includes(expected),
            );
          }
        }
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
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
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows AdapterはCore閉集合の外にあり、CoreはAdapterを参照しない", () => {
  const windowsAdapterPath =
    "40_Develop/orchestrator/src/platform/windows-adapter.ts";
  assert.ok(
    fs.existsSync(path.join(repositoryRoot, windowsAdapterPath)),
    "windows adapter module must exist",
  );
  for (const moduleRelativePath of coreModules) {
    const source = readRuntimeSource(moduleRelativePath);
    assert.equal(
      /windows-platform-(?:adapter|observation)/u.test(source),
      false,
      `${moduleRelativePath} must not reference the windows adapter`,
    );
  }
  const windowsAdapterSource = readRuntimeSource(windowsAdapterPath);
  assert.equal(
    windowsAdapterSource.includes(
      'from "../../../coordinator/src/host-execution/windows-platform-observation.ts"',
    ),
    true,
  );
  assert.equal(/process\.platform/u.test(windowsAdapterSource), false);
  assert.equal(
    /process\.platform/u.test(
      readRuntimeSource(
        "40_Develop/coordinator/src/host-execution/windows-platform-observation.ts",
      ),
    ),
    true,
  );
});
