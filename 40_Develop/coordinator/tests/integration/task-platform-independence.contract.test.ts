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
  pure: [
    "state/projection.ts",
    "state/types.ts",
    "decision/types.ts",
    "decision/request.ts",
    "state/persistence.ts",
    "state/create.ts",
    "state/validation.ts",
    "decision/transition.ts",
    "objective/request.ts",
    "objective/types.ts",
    "objective/plan.ts",
    "state/result.ts",
    "task/types.ts",
    "state/request.ts",
    "task/scheduling.ts",
    "task/lifecycle.ts",
    "task/acceptance.ts",
    "task/recovery.ts",
    "selection/validation.ts",
  ],
  workflow: [
    "state/retirement.ts",
    "state/observation.ts",
    "decision/lifecycle.ts",
    "decision/acceptance.ts",
    "objective/execute.ts",
    "objective/replan.ts",
    "state/query.ts",
    "task/dispatch.ts",
    "workspace/record.ts",
  ],
  adapter: [
    "state/transaction.ts",
    "task/queue.ts",
    "objective/composition.ts",
    "task/requests.ts",
    "workspace/commands.ts",
    "workspace/operations.ts",
    "selection/resolve.ts",
    "state/initialize.ts",
  ],
  storage: [
    "storage/state.ts",
    "storage/history.ts",
    "storage/lock.ts",
    "storage/decision.ts",
  ],
  technicalExecution: [
    "execution/lease.ts",
    "execution/controller.ts",
    "execution/authority.ts",
    "execution/operation.ts",
    "execution/result.ts",
    "execution/recovery.ts",
    "execution/observation.ts",
    "execution/diagnostics.ts",
    "execution/preparation.ts",
    "execution/advice.ts",
    "execution/request.ts",
    "execution/settlement.ts",
    "execution/validation.ts",
    "execution/kernel-lock.ts",
    "execution/process-safety-state.ts",
  ],
  runtimeCli: [
    "cli/command.ts",
    "cli/options.ts",
    "cli/request.ts",
    "cli/authentication.ts",
    "cli/doctor.ts",
    "cli/recovery-report.ts",
    "cli/cancellation.ts",
  ],
  technicalStorage: [],
  externalSendDecision: [
    "decision/external-send-consent.ts",
    "decision/external-send-grant.ts",
    "decision/external-send-policy.ts",
  ],
  entry: ["index.ts", "api.ts"],
} as const;
const SOURCE_PREFIX = "40_Develop/coordinator/src/";
const coreModules = SOURCE_ROLES.pure.map((file) => `${SOURCE_PREFIX}${file}`);

/**
 * 統合後のExecution値契約だけを型専用辺として許可する。
 * @responsibility 技術実装や別Symbolを純粋な実行時閉包へ混入させない。
 * @trace PRL-IT-012
 * @precondition Task実行型の実Pathと明示した型Symbol。
 * @stimulus 正しい型専用辺、値import、別Symbolを検査する。
 * @observation 依存検査の受理又は拒否。
 * @oracle 指定型だけ受理し、値importと別型は従来の閉包規則で拒否する。
 * @cleanup N/A: 局所データの同期検査のみ。
 * @boundary 同Package内TaskとExecutionの型依存。
 */
test("Taskの純粋契約はExecutionの指定型だけを型専用で参照する", () => {
  const module = `${SOURCE_PREFIX}task/types.ts`;
  const contracts = {
    specifier: "./dispatch.ts",
    typeOnly: true,
    names: [
      "COORDINATOR_EXECUTION_CONTRACT",
      "COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT",
    ],
  };
  const workspace = {
    specifier: "../execution/result.ts",
    typeOnly: true,
    names: ["CoordinatorWorkspaceResult"],
  };
  const scan = (edges: (typeof workspace)[]) => ({ isConsistent: true, edges });
  assert.doesNotThrow(() =>
    assertPureImportEdges(module, scan([contracts, workspace])),
  );
  for (const edges of [
    [contracts],
    [contracts, workspace, workspace],
    [contracts, { ...workspace, typeOnly: false }],
    [contracts, { ...workspace, names: ["UnapprovedExecutionType"] }],
    [
      contracts,
      { ...workspace, specifier: "../execution/../execution/result.ts" },
    ],
  ])
    assert.throws(
      () => assertPureImportEdges(module, scan(edges)),
      /private type dependency/u,
    );
});

/**
 * Task共有型は二つの固定Contractだけを型専用で参照する。
 * @responsibility 実行Moduleの値ロードと未承認Symbolの混入を拒否する。
 * @trace PRL-IT-012
 * @precondition 共有型と実行組立ての確定したOwnerを用いる。
 * @stimulus 正しい二型参照と値・欠測・追加・重複・別Ownerを与える。
 * @observation 純粋依存検査の受理又は拒否を観測する。
 * @oracle exactな二つの型参照だけが受理される。
 * @cleanup N/A: 同期的な局所データ検査のみ。
 * @boundary Task共有型と実行組立ての型専用依存。
 */
test("Task共有型のContract参照は二定数の型専用辺だけを許可する", () => {
  const module = `${SOURCE_PREFIX}task/types.ts`;
  const names = [
    "COORDINATOR_EXECUTION_CONTRACT",
    "COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT",
  ] as const;
  const workspace = {
    specifier: "../execution/result.ts",
    typeOnly: true,
    names: ["CoordinatorWorkspaceResult"],
  };
  const scan = (
    typeOnly: boolean,
    symbols: readonly string[],
    specifier = "./dispatch.ts",
  ) => ({
    isConsistent: true,
    edges: [workspace, { specifier, typeOnly, names: [...symbols] }],
  });
  assert.doesNotThrow(() => assertPureImportEdges(module, scan(true, names)));
  assert.throws(
    () => assertPureImportEdges(module, scan(false, names)),
    /private type dependency/u,
  );
  assert.throws(
    () => assertPureImportEdges(module, { isConsistent: true, edges: [] }),
    /private type dependency/u,
  );
  assert.throws(
    () =>
      assertPureImportEdges(module, { isConsistent: true, edges: [workspace] }),
    /private type dependency/u,
  );
  assert.throws(
    () =>
      assertPureImportEdges(module, scan(true, names, "../task/dispatch.ts")),
    /private type dependency/u,
  );
  for (const symbols of [
    [],
    [names[0]],
    [names[0], names[0]],
    [...names, "COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION"],
    [names[0], "UnapprovedContract"],
  ])
    assert.throws(
      () => assertPureImportEdges(module, scan(true, symbols)),
      /private type dependency/u,
    );
  assert.throws(
    () =>
      assertPureImportEdges(
        `${SOURCE_PREFIX}task/recovery.ts`,
        scan(true, names),
      ),
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
  if (module === `${SOURCE_PREFIX}task/types.ts`) {
    const contractEdges = scan.edges.filter(
      (edge) => edge.specifier === "./dispatch.ts",
    );
    const workspaceEdges = scan.edges.filter(
      (edge) => edge.specifier === "../execution/result.ts",
    );
    const names = contractEdges.flatMap((edge) => edge.names);
    const workspaceNames = workspaceEdges.flatMap((edge) => edge.names);
    assert.ok(
      contractEdges.every((edge) => edge.typeOnly) &&
        names.length === 2 &&
        new Set(names).size === 2 &&
        names.includes("COORDINATOR_EXECUTION_CONTRACT") &&
        names.includes("COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT") &&
        workspaceEdges.every((edge) => edge.typeOnly) &&
        workspaceNames.length === 1 &&
        workspaceNames[0] === "CoordinatorWorkspaceResult",
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
          (module === `${SOURCE_PREFIX}objective/types.ts` &&
            specifier === "../selection/resolve.ts" &&
            resolved === `${SOURCE_PREFIX}selection/resolve.ts` &&
            names.length === 1 &&
            names[0] === "resolveTaskExecutionSelections") ||
          (module === `${SOURCE_PREFIX}objective/types.ts` &&
            specifier === "../execution/controller.ts" &&
            names.length === 1 &&
            names.every((name) =>
              [
                "startRuntimeOwnedCoordinatorTask",
                "cancelRuntimeOwnedCoordinatorTask",
                "captureRuntimeOwnedCoordinatorTaskResultDelivery",
              ].includes(name),
            )) ||
          (module === `${SOURCE_PREFIX}objective/types.ts` &&
            specifier === "../storage/decision.ts" &&
            names.length === 1 &&
            names[0] === "openRuntimeOwnedWindowsProjectDecisionStore") ||
          (module === `${SOURCE_PREFIX}objective/types.ts` &&
            specifier === "../task/dispatch.ts" &&
            names.length === 1 &&
            names[0] === "recordCoordinatorExecutionEvent") ||
          (module === `${SOURCE_PREFIX}task/types.ts` &&
            specifier === "../execution/result.ts" &&
            resolved === `${SOURCE_PREFIX}execution/result.ts` &&
            names.length === 1 &&
            names[0] === "CoordinatorWorkspaceResult") ||
          (module === `${SOURCE_PREFIX}task/types.ts` &&
            specifier === "./dispatch.ts" &&
            resolved === `${SOURCE_PREFIX}task/dispatch.ts` &&
            names.length > 0 &&
            names.every(
              (name) =>
                name === "COORDINATOR_EXECUTION_CONTRACT" ||
                name === "COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT",
            )) ||
          (/^40_Develop\/(?!coordinator\/)[^/]+\/src\/index\.ts$/u.test(
            resolved,
          ) &&
            fs.existsSync(path.join(repositoryRoot, resolved))),
        `private type dependency: ${module} -> ${specifier} (${names.join(", ")})`,
      );
    } else if (
      specifier === "../../../domain-model/src/index.ts" &&
      resolved === "40_Develop/domain-model/src/index.ts" &&
      names.length > 0 &&
      names.every((name) => {
        const allowed: Readonly<Record<string, readonly string[]>> = {
          "state/projection.ts": [
            "COORDINATOR_STATE_CONTRACT",
            "CoordinatorState",
            "ProjectTaskState",
            "inspectTaskExecutionSelections",
            "snapshotRuntimeStateArray",
            "snapshotRuntimeStateRecord",
          ],
          "state/types.ts": [
            "CoordinatorState",
            "ProjectMilestoneState",
            "ProjectObjectiveState",
            "ProjectTaskState",
          ],
          "decision/types.ts": [
            "CoordinatorAcceptanceDecision",
            "CoordinatorAcceptanceDecisionRecord",
            "CoordinatorAcceptanceTarget",
            "CoordinatorDecisionRecord",
            "CoordinatorDecisionRecoveryIntent",
          ],
          "decision/request.ts": [
            "CoordinatorAcceptanceDecision",
            "CoordinatorAcceptanceTarget",
            "snapshotRuntimeStateRecord",
          ],
          "state/persistence.ts": [
            "CoordinatorLeaseKind",
            "CoordinatorState",
            "ProjectQueueEntry",
            "ProjectQueueState",
          ],
          "state/create.ts": [
            "ProjectObjectiveDefinition",
            "ProjectTaskDefinition",
            "TaskExecutionSelections",
            "inspectTaskExecutionSelections",
          ],
          "state/validation.ts": [
            "COORDINATOR_STATE_CONTRACT",
            "normalizeRepositoryRelativePath",
          ],
          "decision/transition.ts": [
            "CoordinatorAcceptanceDecisionInput",
            "CoordinatorState",
          ],
          "objective/request.ts": [
            "AiSelectionChoice",
            "CallerTaskInput",
            "CoordinatorObjectivePlan",
            "inspectCallerTaskInputs",
            "inspectExecutionPlan",
            "normalizeRepositoryRelativePath",
            "snapshotRuntimeStateArray",
            "snapshotRuntimeStateRecord",
          ],
          "objective/types.ts": [
            "CoordinatorObjectivePlan",
            "CoordinatorState",
            "ProjectTaskDefinition",
          ],
          "objective/plan.ts": [
            "CoordinatorObjectivePlan",
            "inspectExecutionPlan",
          ],
          "state/result.ts": ["RepositoryRuntimeDataAreaBlockedError"],
          "task/types.ts": ["ProjectTaskRecoveryKind"],
          "state/request.ts": ["snapshotRuntimeStateRecord"],
          "task/scheduling.ts": ["CoordinatorState", "ProjectTaskRecord"],
          "task/lifecycle.ts": [
            "CoordinatorState",
            "ProjectMilestoneState",
            "ProjectTaskDefinition",
            "ProjectTaskRecord",
            "ProjectTaskRecoveryKind",
            "ProjectTaskRecoveryObligation",
            "ProjectTaskState",
          ],
          "task/acceptance.ts": [
            "CoordinatorState",
            "ProjectDockerRecoveryAcknowledgement",
            "ProjectResultAcceptance",
            "decodeProjectResultAcceptance",
          ],
          "task/recovery.ts": ["CoordinatorState", "ProjectTaskRecoveryKind"],
          "selection/validation.ts": [
            "AiSelectionChoice",
            "inspectExecutionSelection",
            "snapshotPlainRecord",
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
  const selectionEdge = {
    specifier: "../selection/resolve.ts",
    typeOnly: true,
    names: ["resolveTaskExecutionSelections"],
  };
  assert.doesNotThrow(() =>
    assertPureImportEdges(`${SOURCE_PREFIX}objective/types.ts`, {
      isConsistent: true,
      edges: [selectionEdge],
    }),
  );
  for (const edge of [
    { ...selectionEdge, names: [] },
    { ...selectionEdge, names: ["unapprovedSelection"] },
    { ...selectionEdge, names: [...selectionEdge.names, "extra"] },
  ])
    assert.throws(
      () =>
        assertPureImportEdges(`${SOURCE_PREFIX}objective/types.ts`, {
          isConsistent: true,
          edges: [edge],
        }),
      /private type dependency/u,
    );
  assert.throws(
    () =>
      assertPureImportEdges(`${SOURCE_PREFIX}objective/types.ts`, {
        isConsistent: true,
        edges: [{ ...selectionEdge, typeOnly: false }],
      }),
    /outside pure runtime closure/u,
  );
  const snapshotEdge = {
    specifier: "../../../domain-model/src/index.ts",
    typeOnly: false,
    names: ["snapshotPlainRecord"],
  };
  assert.doesNotThrow(() =>
    assertPureImportEdges(`${SOURCE_PREFIX}selection/validation.ts`, {
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
        assertPureImportEdges(`${SOURCE_PREFIX}selection/validation.ts`, {
          isConsistent: true,
          edges: [{ ...snapshotEdge, names }],
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
    'import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";',
    'import type { T } from "../../src/execution/task.ts";',
    'import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";',
    'import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";',
    'import { randomUUID as random } from "node:crypto";',
    'import { readCurrentCoordinatorState } from "../storage/state.ts";',
    'import { queryCoordinatorState } from "./query.ts";',
    'import { snapshotPlainRecord } from "./validation.ts";',
    'import type { T } from "../storage/state.ts";',
    'import type { Stats } from "node:fs";',
    'import type { T } from "../index.ts";',
    'import {} from "../storage/state.ts";',
    'export {} from "../storage/state.ts";',
    'import { type T } from "../storage/state.ts";',
    'export { type T } from "../storage/state.ts";',
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
          /**
           * 変異した依存辺を純粋状態Moduleの境界へ照合する。
           * @responsibility 変異した依存辺を純粋状態Moduleの境界へ照合する。
           * @trace PRL-IT-012
           * @precondition state/validationのscanと有限変異。
           * @stimulus 既存assertPureImportEdgesを同じ対象へ実行する。
           * @observation 禁止依存に対応する固定診断。
           * @oracle 型だけを含む禁止辺も拒否し正常対照は通る。
           * @cleanup N/A: Source解析とメモリ変異だけ。
           * @boundary 静的Import境界。実ModuleのEffectは起動しない。
           */
          const check = () =>
            assertPureImportEdges(`${SOURCE_PREFIX}state/validation.ts`, scan);
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
    "40_Develop/coordinator/src/execution/diagnostics.ts";
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
      'from "../../../platform-access/src/index.ts"',
    ),
    true,
  );
  const adapterNames = new Set([
    "createCoordinatorWindowsPlatformAdapter",
    "deriveChildEnvironment",
    "resolveRepositoryRoot",
  ]);
  const config = path
    .join(repositoryRoot, ".adapter-observation.json")
    .replaceAll("\\", "/");
  const file = path
    .join(repositoryRoot, windowsAdapterPath)
    .replaceAll("\\", "/");
  const api = new API({
    cwd: repositoryRoot,
    fs: createVirtualFileSystem({
      [config]: JSON.stringify({
        files: [file],
        compilerOptions: { noLib: true, noResolve: true },
      }),
      [file]: windowsAdapterSource,
    }),
  });
  const snapshot = api.updateSnapshot({ openProjects: [config] });
  try {
    const source = snapshot.getProject(config)?.program.getSourceFile(file);
    assert.ok(source);
    const adapters = source.statements.filter(
      (statement) =>
        statement.kind === SyntaxKind.FunctionDeclaration &&
        "name" in statement &&
        adapterNames.has((statement.name as { text: string }).text),
    );
    assert.equal(adapters.length, adapterNames.size);
    for (const adapter of adapters)
      assert.doesNotMatch(adapter.getText(), /process\.platform/u);
  } finally {
    snapshot.dispose();
    api.close();
  }
  assert.equal(
    /process\.platform/u.test(
      readRuntimeSource(
        "40_Develop/platform-access/src/process/observation.ts",
      ),
    ),
    true,
  );
});
