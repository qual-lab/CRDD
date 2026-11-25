/**
 * coordinator:integration:task-platform-independenceの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-platform-independenceが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope project、runtime、platform、independence
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Coordinator Application Port→Core
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
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
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * 現行Coordinatorの全Sourceを発見し、責務別の閉集合照合へ渡す。
 * 純粋Fileの実行時閉包と型所有境界は別のOracleで検査する。
 *
 * @responsibility discoverCoordinatorModulesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus discoverCoordinatorModulesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function discoverCoordinatorModules(): readonly string[] {
  const sourceRoot = path.join(repositoryRoot, "40_Develop/coordinator/src");
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

const allModules = discoverCoordinatorModules();
// Folder名ではなく現行ArchitectureのFile責務を全数固定する。
const SOURCE_ROLES = {
  pure: ["lifecycle/validation.ts", "lifecycle/types.ts"],
  workflow: [
    "lifecycle/query.ts",
    "lifecycle/decision.ts",

    "lifecycle/execution.ts",
  ],
  adapter: ["lifecycle/workspace.ts", "lifecycle/selection.ts"],
  technicalExecution: [
    "lifecycle/authentication.ts",
    "lifecycle/environment.ts",
    "lifecycle/host.ts",
  ],
  runtimeCli: ["cli/command.ts"],
  entry: ["index.ts", "api.ts"],
} as const;
const SOURCE_PREFIX = "40_Develop/coordinator/src/";
const coreModules = SOURCE_ROLES.pure.map((file) => `${SOURCE_PREFIX}${file}`);

/**
 * 共有型と固定語彙を純粋な所有者に保つ。
 * @responsibility 技術実装への型依存、値ロードとWorkspace結果型の借用を拒否する。
 * @trace PRL-IT-012
 * @precondition Task共有型の現行Sourceを使用する。
 * @stimulus 外部技術Moduleへの型import、値import、Workspace結果型の借用。
 * @observation 依存検査結果と固定語彙の宣言元。
 * @oracle 語彙は型の所有者へ置き、技術Moduleへ依存しない。
 * @cleanup N/A: 同期の値検査のみ。
 * @boundary Task共有の純粋契約。
 */
test("Task共有型はWorkspace結果と固定語彙を所有し技術Moduleへ依存しない", () => {
  const module = `${SOURCE_PREFIX}lifecycle/types.ts`;
  const source = readRuntimeSource(module);
  assert.match(source, /export type WorkspaceResult = Readonly</u);
  for (const name of [
    "COORDINATOR_EXECUTION_CONTRACT",
    "COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT",
    "RECOVERY_START_FAILURE_STAGES",
  ]) {
    assert.match(source, new RegExp(`export const ${name}\\s*=`, "u"));
  }
  assert.doesNotThrow(() =>
    assertPureImportEdges(module, { isConsistent: true, edges: [] }),
  );
  for (const edge of [
    {
      specifier: "../execution/result.ts",
      typeOnly: true,
      names: ["COORDINATOR_EXECUTION_CONTRACT"],
    },
    {
      specifier: "../execution/../execution/result.ts",
      typeOnly: true,
      names: ["UnapprovedExecutionType"],
    },
    {
      specifier: "../execution/controller.ts",
      typeOnly: true,
      names: ["Operation"],
    },
    {
      specifier: "../execution/recovery.ts",
      typeOnly: true,
      names: ["ProviderExecutionRecording"],
    },
    {
      specifier: "./selection.ts",
      typeOnly: true,
      names: ["resolveTaskExecutionSelections"],
    },
    {
      specifier: "./execution.ts",
      typeOnly: true,
      names: ["UnapprovedContract"],
    },
    {
      specifier: "./validation.ts",
      typeOnly: true,
      names: ["WorkspaceResult"],
    },
    {
      specifier: "../../../execution-model/src/index.ts",
      typeOnly: true,
      names: ["WorkspaceResult"],
    },
    { specifier: "./validation.ts", typeOnly: false, names: ["validIdentity"] },
  ])
    assert.throws(
      () =>
        assertPureImportEdges(module, { isConsistent: true, edges: [edge] }),
      /private type dependency/u,
    );
  assert.throws(
    () =>
      assertPureImportEdges(`${SOURCE_PREFIX}lifecycle/validation.ts`, {
        isConsistent: true,
        edges: [
          {
            specifier: "../execution/result.ts",
            typeOnly: true,
            names: ["COORDINATOR_EXECUTION_CONTRACT"],
          },
        ],
      }),
    /private type dependency/u,
  );
});

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
  if (module === `${SOURCE_PREFIX}lifecycle/types.ts`) {
    assert.ok(
      scan.edges.every(
        (edge) => edge.typeOnly && !edge.names.includes("WorkspaceResult"),
      ),
      "private type dependency",
    );
  }
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
          (/^40_Develop\/(?!coordinator\/)[^/]+\/src\/index\.ts$/u.test(
            resolved,
          ) &&
            fs.existsSync(path.join(repositoryRoot, resolved))),
        `private type dependency: ${module} -> ${specifier} (${names.join(", ")})`,
      );
    } else if (
      module === `${SOURCE_PREFIX}lifecycle/validation.ts` &&
      specifier === "../../../configuration-model/src/index.ts" &&
      resolved === "40_Develop/configuration-model/src/index.ts" &&
      names.length === 1 &&
      names[0] === "inspectAiSelectionChoice"
    ) {
      // 単発入力のモデル選択値だけを同期検査し、設定の読取り・保存は参照しない。
    } else if (
      specifier === "../../../execution-model/src/index.ts" &&
      resolved === "40_Develop/execution-model/src/index.ts" &&
      names.length > 0 &&
      names.every((name) => {
        const allowed: Readonly<Record<string, readonly string[]>> = {
          "lifecycle/validation.ts": [
            "dockerProcessControllerPublicCompletionReasons",
            "inspectExecutionPlan",
            "PROJECT_STATE_CONTRACT",
            "OBJECTIVE_STATES",
            "parseDockerTaskRecoveryId",
            "TASK_STATES",
          ],
        };
        return (
          allowed[module.slice(SOURCE_PREFIX.length)]?.includes(name) === true
        );
      })
    ) {
      // 通常データの同期的な値検査だけを共有し、Package全体は許可しない。
    } else
      assert.ok(
        coreModules.includes(resolved),
        `outside pure runtime closure: ${module} -> ${specifier}`,
      );
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
 * Coordinator CoreのimportはPlatform非依存の閉集合に一致するを検証する。
 *
 * @responsibility Coordinator CoreのimportはPlatform非依存の閉集合に一致するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Coordinator CoreのimportはPlatform非依存の閉集合に一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Coordinator CoreのimportはPlatform非依存の閉集合に一致する", () => {
  const boundaryErrorEdge = {
    specifier: "./host.ts",
    typeOnly: true,
    names: ["RepositoryDataBlockedError"],
  };
  for (const [module, edge] of [
    [
      `${SOURCE_PREFIX}lifecycle/validation.ts`,
      { ...boundaryErrorEdge, typeOnly: false },
    ],
    [
      `${SOURCE_PREFIX}lifecycle/validation.ts`,
      { ...boundaryErrorEdge, names: ["observeArea"] },
    ],
    [`${SOURCE_PREFIX}lifecycle/validation.ts`, boundaryErrorEdge],
  ] as const) {
    assert.throws(() =>
      assertPureImportEdges(module, {
        isConsistent: true,
        edges: [{ ...edge, names: [...edge.names] }],
      }),
    );
  }
  const snapshotEdge = {
    specifier: "../../../execution-model/src/index.ts",
    typeOnly: false,
    names: ["inspectExecutionPlan"],
  };
  assert.doesNotThrow(() =>
    assertPureImportEdges(`${SOURCE_PREFIX}lifecycle/validation.ts`, {
      isConsistent: true,
      edges: [snapshotEdge],
    }),
  );
  for (const names of [
    [],
    ["writeState"],
    [...snapshotEdge.names, "writeState"],
  ])
    assert.throws(
      () =>
        assertPureImportEdges(`${SOURCE_PREFIX}lifecycle/validation.ts`, {
          isConsistent: true,
          edges: [{ ...snapshotEdge, names }],
        }),
      /outside pure runtime closure/u,
    );
  const choiceEdge = {
    specifier: "../../../configuration-model/src/index.ts",
    typeOnly: false,
    names: ["inspectAiSelectionChoice"],
  };
  assert.doesNotThrow(() =>
    assertPureImportEdges(`${SOURCE_PREFIX}lifecycle/validation.ts`, {
      isConsistent: true,
      edges: [choiceEdge],
    }),
  );
  assert.throws(
    () =>
      assertPureImportEdges(`${SOURCE_PREFIX}lifecycle/validation.ts`, {
        isConsistent: true,
        edges: [
          { ...choiceEdge, names: [...choiceEdge.names, "readNetworkPolicy"] },
        ],
      }),
    /outside pure runtime closure/u,
  );
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
  const root = path.join(repositoryRoot, "40_Develop/coordinator");
  const config = path
    .join(root, ".crdd-pure-oracle.json")
    .replaceAll("\\", "/");
  const configText = JSON.stringify({
    extends: "./tsconfig.strict.json",
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
      const graph = new Map<string, string[]>();
      const modulePaths = new Set(
        allModules.map((file) => normalize(path.resolve(repositoryRoot, file))),
      );
      const retiredSymbols =
        /\b(?:startDevelopmentObjectiveTask|cancelDevelopmentObjectiveTask|developmentObjectiveCancellations|uniqueStrings|isSupportedAuthorityRootAbsolutePath|verifyOwnedOperationContextCapability|describeCoordinatorObjectiveIntakeContract|poisonExecutionProcessAfterInteractiveCleanupUnknown|isExecutionProcessEffectDraining|beginExecutionProcessEffectDrain|endExecutionProcessEffectDrain|isExecutionProcessEffectBlocked|planProviderLifecycle|syntheticFakeObservationInternal|evaluateSyntheticFakeProviderObservationCandidate|localAuthorityCanonicalJson|bindTaskCliCancellationSignalsForTesting|startDevelopmentCoordinatorTask|DevelopmentOperationContext|createDevelopmentExecutionTiming|createDevelopmentMeasurementConstraints|projectDevelopmentTaskResultAfterOuterCleanup|coordinator_task_development_[A-Za-z0-9_]+)\b/u;
      for (const reason of [
        "coordinator_task_development_invocation_not_authorized",
        "coordinator_task_development_invocation_settlement_invalid",
        "coordinator_task_development_permission_expired",
        "coordinator_task_development_permission_required",
      ]) {
        assert.throws(() =>
          assert.doesNotMatch(
            `export const reason = "${reason}";`,
            retiredSymbols,
          ),
        );
      }
      for (const file of allModules) {
        const absolute = normalize(path.resolve(repositoryRoot, file));
        const body = fs.readFileSync(absolute, "utf8");
        assert.doesNotMatch(body, retiredSymbols, file);
        const source = project.program.getSourceFile(absolute);
        assert.ok(source);
        const scan = importSpecifierScan(source);
        assert.equal(scan.isConsistent, true, file);
        graph.set(
          absolute,
          scan.edges
            .filter((edge) => !edge.typeOnly && edge.specifier.startsWith("."))
            .map((edge) =>
              normalize(path.resolve(path.dirname(absolute), edge.specifier)),
            )
            .filter((target) => modulePaths.has(target)),
        );
      }
      const lifecycle = normalize(
        path.join(repositoryRoot, SOURCE_PREFIX, "lifecycle/execution.ts"),
      );
      const recovery = normalize(
        path.join(repositoryRoot, SOURCE_PREFIX, "lifecycle/environment.ts"),
      );
      assert.ok(graph.get(lifecycle)?.includes(recovery));
      assert.equal(graph.get(recovery)?.includes(lifecycle), false);
      /** 型専用辺を除いた既存Source間の循環を拒否し、同じ走査を合成反例でも確認する。 */
      const assertAcyclic = (edges: ReadonlyMap<string, readonly string[]>) => {
        const visited = new Set<string>();
        const active: string[] = [];
        const visit = (file: string) => {
          assert.equal(
            active.includes(file),
            false,
            `runtime cycle: ${[...active, file].join(" -> ")}`,
          );
          if (visited.has(file)) return;
          active.push(file);
          for (const target of edges.get(file) ?? []) visit(target);
          active.pop();
          visited.add(file);
        };
        for (const file of edges.keys()) visit(file);
      };
      assertAcyclic(graph);
      assert.throws(
        () =>
          assertAcyclic(
            new Map([
              ["a", ["b"]],
              ["b", ["a"]],
            ]),
          ),
        /runtime cycle/u,
      );
      assert.throws(
        () => assertAcyclic(new Map([["a", ["a"]]])),
        /runtime cycle/u,
      );
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});

/**
 * Coordinator CoreはOS固有tokenとOS Path実値を含まないを検証する。
 *
 * @responsibility Coordinator CoreはOS固有tokenとOS Path実値を含まないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Coordinator CoreはOS固有tokenとOS Path実値を含まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Coordinator CoreはOS固有tokenとOS Path実値を含まない", () => {
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
    'import { snapshotPlainRecord } from "../../../execution-model/src/index.ts";',
    'import type { T } from "../../src/execution/task.ts";',
    'import type { Repository } from "../../../version-control/src/index.ts";',
    'import { getRepository } from "../../../version-control/src/index.ts";',
    'import { randomUUID as random } from "node:crypto";',
    'import { readCurrentCoordinatorState } from "../storage/state.ts";',
    'import { queryCoordinatorState } from "./query.ts";',
    'import type { WorkspaceResult } from "./types.ts";',
    'import type { T } from "../storage/state.ts";',
    'import type { Stats } from "node:fs";',
    'import type { T } from "../index.ts";',
    'import {} from "../storage/state.ts";',
    'export {} from "../storage/state.ts";',
    'import { type T } from "../storage/state.ts";',
    'export { type T } from "../storage/state.ts";',
    'export type { Repository } from "../../../version-control/src/index.ts";',
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
          /**
           * 変異した依存辺を純粋状態Moduleの境界へ照合する。
           * @responsibility 変異した依存辺を純粋状態Moduleの境界へ照合する。
           * @trace PRL-IT-012
           * @precondition 状態投影Ownerのscanと有限変異。
           * @stimulus 既存assertPureImportEdgesを同じ対象へ実行する。
           * @observation 禁止依存に対応する固定診断。
           * @oracle 型だけを含む禁止辺も拒否し正常対照は通る。
           * @cleanup N/A: Source解析とメモリ変異だけ。
           * @boundary 静的Import境界。実ModuleのEffectは起動しない。
           */
          const check = () =>
            assertPureImportEdges(
              `${SOURCE_PREFIX}lifecycle/validation.ts`,
              scan,
            );
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
test("OS観測の実処理は純粋なCoreの外にあり退役PAを参照しない", () => {
  const environment = `${SOURCE_PREFIX}lifecycle/environment.ts`;
  const host = `${SOURCE_PREFIX}lifecycle/host.ts`;
  for (const owner of [environment, host]) {
    assert.equal(coreModules.includes(owner), false);
    assert.doesNotMatch(readRuntimeSource(owner), /platform-access\/src\//u);
  }
  for (const file of coreModules)
    assert.doesNotMatch(
      readRuntimeSource(file),
      /windows-platform-(?:adapter|observation)/u,
    );
  assert.equal(
    /process\.platform/u.test(
      readRuntimeSource("40_Develop/coordinator/src/lifecycle/execution.ts"),
    ),
    false,
  );
  assert.match(
    readRuntimeSource("40_Develop/coordinator/src/lifecycle/host.ts"),
    /process\.kill\(ownerProcessId, 0\)/u,
  );
  assert.match(
    readRuntimeSource("40_Develop/coordinator/src/lifecycle/host.ts"),
    /process\.platform === "win32"/u,
  );
});
