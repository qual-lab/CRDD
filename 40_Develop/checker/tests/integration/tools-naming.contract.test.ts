/**
 * ツール群の成果物関係とChecker自身の契約を確認する。
 *
 * @packageDocumentation
 * @responsibility 台帳・ID・Owner・Path・既存公開接続を照合し、コード内部の規約は走査しない。
 * @trace RCM-IT-005
 * @trace RCM-IT-013
 * @trace RCM-IT-015
 * @level IT
 * @scope 成果物関係、ツール結合、Checker試験列挙
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
import assert from "node:assert/strict";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import test from "node:test";

import { fileURLToPath } from "node:url";

import {
  type RealitySymbolManifest,
  validateRealitySymbolManifest,
} from "../../../domain-model/src/index.ts";

import {
  assertExactCheckerTestPopulation,
  discoverCheckerTestFiles,
  requireCheckerTestFiles,
  type TestDiscoveryOperations,
} from "../support/test-discovery.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const repositoryRoot = path.resolve(checkerRoot, "../..");

const ARCHITECTURE_ID = /^ARCH-[0-9]{6}$/u;

const TEST_LEVEL_CODE = Object.freeze({
  unit: "UT",
  integration: "IT",
  system: "ST",
  acceptance: "UAT",
});

/**
 * collectCanonicalArchitectureIdsのTest準備責務を実行する。
 *
 * @responsibility collectCanonicalArchitectureIdsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectCanonicalArchitectureIdsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function collectCanonicalArchitectureIds(): ReadonlySet<string> {
  const definitionsRoot = path.join(
    repositoryRoot,
    "06_Architecture",
    "Definitions",
  );
  const identifiers = new Set<string>();
  for (const entry of fs.readdirSync(definitionsRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (!ARCHITECTURE_ID.test(entry.name)) continue;
    const definition = path.join(
      definitionsRoot,
      entry.name,
      "architecture_definition.md",
    );
    assert.equal(
      fs.existsSync(definition),
      true,
      `Architecture definition missing: ${entry.name}`,
    );
    identifiers.add(entry.name);
  }
  assert.ok(
    identifiers.size > 0,
    "Architecture definition population is empty",
  );
  return identifiers;
}

const canonicalArchitectureIds = collectCanonicalArchitectureIds();

/**
 * collectCanonicalQualityLocalItemsのTest準備責務を実行する。
 *
 * @responsibility collectCanonicalQualityLocalItemsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectCanonicalQualityLocalItemsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function collectCanonicalQualityLocalItems(): ReadonlyMap<string, string> {
  const definitionsRoot = path.join(
    repositoryRoot,
    "07_Quality",
    "Definitions",
  );
  const identifiers = new Map<string, string>();
  for (const entry of fs.readdirSync(definitionsRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const definitionPath = path.join(
      definitionsRoot,
      entry.name,
      "quality_definition.md",
    );
    if (!fs.existsSync(definitionPath)) continue;
    const source = fs.readFileSync(definitionPath, "utf8");
    for (const match of source.matchAll(
      /^\| `([A-Z]{3}-(?:UT|IT|ST|UAT)-[0-9]{3})` \|/gmu,
    )) {
      const localItemId = match[1];
      const existingOwner = identifiers.get(localItemId);
      assert.ok(
        existingOwner === undefined || existingOwner === entry.name,
        `Quality Local Item is declared by multiple definitions: ${localItemId}`,
      );
      identifiers.set(localItemId, entry.name);
    }
  }
  assert.ok(identifiers.size > 0, "Quality Local Item population is empty");
  return identifiers;
}

const canonicalQualityLocalItems = collectCanonicalQualityLocalItems();

type PublicIndexProfile = Readonly<{
  relativePath: string;
  exportedModules: readonly string[];
  namespaceExports?: Readonly<Record<string, string>>;
}>;

const PUBLIC_INDEX_PROFILES = Object.freeze<readonly PublicIndexProfile[]>([
  {
    relativePath: "40_Develop/docker-isolation/src/index.ts",
    exportedModules: [
      "./docker-cli/environment.ts",
      "./docker-desktop/types.ts",
      "./docker-desktop/restart.ts",
      "./docker-desktop/operations.ts",
      "./execution/types.ts",
      "./execution/result.ts",
      "./image/types.ts",
      "./cleanup/types.ts",
      "./execution/operations.ts",
      "./image/assets.ts",
    ],
  },
  {
    relativePath: "40_Develop/executor/src/index.ts",
    exportedModules: [
      "../../docker-isolation/src/index.ts",
      "./lifecycle/cleanup.ts",
      "./lifecycle/types.ts",
    ],
  },
  {
    relativePath: "40_Develop/ai-adapter/src/index.ts",
    exportedModules: [
      "./catalog/resolve.ts",
      "./provider/types.ts",
      "./provider/plan.ts",
      "./provider/result.ts",
      "./authentication/plan.ts",
      "./billing/policy.ts",
    ],
  },
  {
    relativePath: "40_Develop/workbench-server/src/index.ts",
    exportedModules: [
      "./server/connection/configuration.ts",
      "./server/credential/administration.ts",
      "./server/ai-selection/projection.ts",
      "./server/ai-request/types.ts",
      "./server/activity/observe.ts",
      "./server/owner-artifact/read.ts",
      "./server/project-plan/types.ts",
      "./server/quality/types.ts",
      "./server/start.ts",
      "./server/project/surface.ts",
    ],
  },
  {
    relativePath: "40_Develop/checker/src/index.ts",
    exportedModules: [
      "./cli/document.ts",
      "./cli/types.ts",
      "./report/types.ts",
      "./cli/semantic.ts",
      "./cli/test-catalog.ts",
    ],
  },
  {
    relativePath: "40_Develop/access-management/src/index.ts",
    exportedModules: [
      "./authorization/current.ts",
      "./authorization/management.ts",
      "./credential/authentication.ts",
      "./credential/crud.ts",
      "./credential/exchange.ts",
      "./credential/presentation.ts",
      "./credential/types.ts",
      "./initialization/connection.ts",
      "./initialization/execution.ts",
      "./initialization/root.ts",
      "./initialization/state.ts",
      "./permission/types.ts",
      "./repository/exposure.ts",
      "./repository/register.ts",
      "./repository/resolve.ts",
      "./repository/types.ts",
      "./role/assign.ts",
      "./role/types.ts",
      "./user/crud.ts",
      "./user/status.ts",
    ],
  },
  {
    relativePath: "40_Develop/coordinator/src/index.ts",
    exportedModules: ["./api.ts", "../../domain-model/src/index.ts"],
  },
  {
    relativePath: "40_Develop/domain-model/src/index.ts",
    exportedModules: [
      "./attempt/crud.ts",
      "./workspace/types.ts",
      "./workspace/validation.ts",
      "./ai-selection/types.ts",
      "./ai-selection/validation.ts",
      "./activity/federate-relations.ts",
      "./activity/operations.ts",
      "./activity/types.ts",
      "./artifact/anchors.ts",
      "./artifact/architecture-details.ts",
      "./artifact/architecture-relations.ts",
      "./artifact/architecture.ts",
      "./artifact/change.ts",
      "./artifact/checklist.ts",
      "./artifact/discovery.ts",
      "./artifact/document-header.ts",
      "./artifact/graph.ts",
      "./artifact/ia.ts",
      "./artifact/identity.ts",
      "./artifact/inspect.ts",
      "./artifact/links.ts",
      "./artifact/markdown.ts",
      "./artifact/parse-markdown.ts",
      "./artifact/phase-checklists.ts",
      "./artifact/phase-diagrams.ts",
      "./artifact/quality-analysis.ts",
      "./artifact/quality-definition.ts",
      "./artifact/quality-readiness.ts",
      "./artifact/quality-relations.ts",
      "./artifact/quality-state.ts",
      "./artifact/quality-templates.ts",
      "./artifact/release.ts",
      "./artifact/spec-correspondence.ts",
      "./artifact/spec-details.ts",
      "./artifact/spec.ts",
      "./artifact/types.ts",
      "./artifact/ui.ts",
      "./artifact/ux-handoff.ts",
      "./artifact/ux-inputs.ts",
      "./artifact/ux.ts",
      "./artifact/validate-schema.ts",
      "./artifact/verification-tables.ts",
      "./configuration/network-policy.ts",
      "./configuration/read-tool-config.ts",
      "./configuration/storage-paths.ts",
      "./configuration/types.ts",
      "./configuration/validate-declarations.ts",
      "./decision/types.ts",
      "./decision/validation.ts",
      "./identity/validation.ts",
      "./meeting/create-operations.ts",
      "./meeting/markdown.ts",
      "./meeting/types.ts",
      "./objective/types.ts",
      "./objective/validation.ts",
      "./outcome.ts",
      "./plain-data/secret-validation.ts",
      "./plain-data/snapshot.ts",
      "./plain-data/json.ts",
      "./project-context/candidate-decision.ts",
      "./project-context/inspect.ts",
      "./project-context/parse-context.ts",
      "./project-context/parse-quality.ts",
      "./project-context/parse-release.ts",
      "./project-context/portfolio.ts",
      "./project-context/read-context.ts",
      "./project-context/source-projection.ts",
      "./project-context/types.ts",
      "./quality-change-control/gate.ts",
      "./reality-traceability/catalog.ts",
      "./reality-traceability/discover.ts",
      "./reality-traceability/graph.ts",
      "./reality-traceability/manifest.ts",
      "./reality-traceability/validate-manifest.ts",
      "./repository/create-observer.ts",
      "./repository/observe-symbols.ts",
      "./repository/path.ts",
      "./repository/require-storage-area.ts",
      "./repository/resolve-storage-paths.ts",
      "./repository/types.ts",
      "./semantic/coverage.ts",
      "./semantic/ir.ts",
      "./semantic/publish.ts",
      "./semantic/relations.ts",
      "./storage/bounded-file-snapshot.ts",
      "./storage/ai-selection.ts",
      "./storage/state.ts",
      "./storage/committed-json.ts",
      "./storage/ensure-area.ts",
      "./storage/network-policy.ts",
      "./storage/root-and-lock.ts",
      "./storage/semantic-store.ts",
      "./storage/temporary-operation.ts",
      "./storage/types.ts",
      "./test-catalog/inspect.ts",
      "./test-catalog/plan.ts",
      "./task/types.ts",
      "./topic/create-operations.ts",
      "./topic/markdown.ts",
      "./topic/types.ts",
      "./attempt/lease.ts",
      "./attempt/repair-types.ts",
      "./attempt/repair-validation.ts",
      "./attempt/settlement.ts",
      "./attempt/types.ts",
      "./attempt/validation.ts",
      "./decision/crud.ts",
      "./state/codec.ts",
      "./state/crud.ts",
      "./state/history.ts",
      "./state/transition.ts",
      "./state/types.ts",
      "./state/validation.ts",
      "./storage/runtime-repository.ts",
      "./storage/runtime-store.ts",
      "./task/crud.ts",
      "./task/queue.ts",
      "./task/validation.ts",
      "./workspace/crud.ts",
      "./state/projection-types.ts",
      "./state/query.ts",
      "./state/projection.ts",
      "./state/activity.ts",
      "./objective/request.ts",
      "./decision/request.ts",
      "./workspace/result.ts",
      "./workspace/command.ts",
    ],
  },
  {
    relativePath: "40_Develop/execution-intelligence/src/index.ts",
    exportedModules: [
      "./record/event.ts",
      "./record/validation.ts",
      "./record/summary.ts",
      "./record/types.ts",
      "./evaluation/improvement-candidates.ts",
      "./record/recorder.ts",
      "./projection/execution.ts",
      "./projection/temporal.ts",
      "./evaluation/integrated-result.ts",
      "./storage/store.ts",
      "./storage/result.ts",
    ],
  },
  {
    relativePath: "40_Develop/mcp-server/src/index.ts",
    exportedModules: [
      "./transport/configuration.ts",
      "./tools/access-management.ts",
      "./tools/execution-status.ts",
      "./tools/task.ts",
      "./tools/workspace.ts",
      "./tools/project-context.ts",
      "./request/server.ts",
      "./request/authentication.ts",
      "./tools/topic-meeting.ts",
      "./request/validation.ts",
      "./transport/stdio.ts",
      "./transport/http.ts",
      "./transport/shutdown.ts",
      "./transport/types.ts",
      "./tools/runtime.ts",
    ],
  },
  {
    relativePath: "40_Develop/platform-access/src/index.ts",
    exportedModules: [
      "./artifact/identity.ts",
      "./filesystem/system-directory.ts",
      "./process/environment.ts",
      "./filesystem/root.ts",
      "./filesystem/protection.ts",
    ],
  },
  {
    relativePath: "40_Develop/lock/src/index.ts",
    exportedModules: ["./operations.ts", "./types.ts"],
  },
  {
    relativePath: "40_Develop/visual-preview/src/index.ts",
    exportedModules: [
      "./preview/server.ts",
      "./browser/types.ts",
      "./browser/verify.ts",
      "./browser/devtools.ts",
      "./browser/process.ts",
    ],
  },
  {
    relativePath: "40_Develop/version-control/src/index.ts",
    exportedModules: [
      "./repository/revision.ts",
      "./repository/changes.ts",
      "./repository/files.ts",
      "./repository/types.ts",
      "./repository/working-directory.ts",
      "./repository/commit.ts",
      "./repository/merge.ts",
      "./repository/reference.ts",
      "./repository/remote.ts",
      "./repository/discovery.ts",
      "./worktree/crud.ts",
      "./worktree/types.ts",
      "./repository/ignore.ts",
      "./repository/location.ts",
      "./repository/user.ts",
    ],
  },
]);

/**
 * exportedNamesのTest準備責務を実行する。
 *
 * @responsibility exportedNamesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exportedNamesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function exportedNames(relativePath: string): readonly string[] {
  const source = fs.readFileSync(path.join(checkerRoot, relativePath), "utf8");
  return [
    ...[
      ...source.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s*from/gu),
    ].flatMap((match) =>
      (match[1] ?? "")
        .split(",")
        .map((entry) => entry.trim().replace(/^type\s+/u, ""))
        .filter((entry) => entry.length > 0),
    ),
    ...[
      ...source.matchAll(
        /export\s+(?:type|interface|const|function|class)\s+([A-Za-z][A-Za-z0-9]*)/gu,
      ),
    ].map((match) => match[1] ?? ""),
  ].sort();
}

/**
 * Checker公開入口はArchitecture宣言済みSymbolだけを公開するを検証する。
 *
 * @responsibility Checker公開入口はArchitecture宣言済みSymbolだけを公開するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Checker公開入口はArchitecture宣言済みSymbolだけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("Checker公開入口はArchitecture宣言済みSymbolだけを公開する", () => {
  assert.deepEqual(exportedNames("src/index.ts"), [
    "CheckerFinding",
    "CheckerResult",
    "CheckerRunRequest",
    "runChecker",
    "runSemanticCoverage",
    "runTestCatalog",
  ]);
});

/**
 * 文書受付と工程別Repository観測の分離を検証する。
 * @responsibility 旧Profileの不存在、公開受付、観測Ownerと工程接続を全数確認する。
 * @trace RCM-IT-005
 * @precondition 実Sourceを読取りできる。
 * @stimulus 公開入口・CLI・Repository編成・工程観測の実体を読む。
 * @observation Import先、公開関数と工程呼出しを取得する。
 * @oracle 受付は文書意味・工程実装を持たず、Repository編成が専用Ownerへ接続する。
 * @cleanup N/A: 読取り専用。
 * @boundary RCM-IT-005=Direct Boundary: 試験→Checker公開・内部接続
 */
test("Checker文書受付は工程別Repository観測へ接続し旧Profileを持たない", () => {
  const index = fs.readFileSync(path.join(checkerRoot, "src/index.ts"), "utf8");
  const command = fs.readFileSync(
    path.join(checkerRoot, "src/cli/document.ts"),
    "utf8",
  );
  const repository = fs.readFileSync(
    path.join(checkerRoot, "src/repository/document.ts"),
    "utf8",
  );
  assert.match(index, /from "\.\/cli\/document\.ts"/u);
  assert.match(command, /inspectDocumentRepository\(/u);
  assert.doesNotMatch(
    command,
    /function check[A-Z]|inspectQualityDefinition|inspectUiDefinition/u,
  );
  assert.equal(
    fs.existsSync(path.join(checkerRoot, "src/profiles/current.ts")),
    false,
  );
  for (const [module, name] of [
    ["project-context", "inspectProjectContextRepository"],
    ["work-lifecycle", "inspectWorkLifecycleRepository"],
    ["discovery-ux", "inspectDiscoveryUxRepository"],
    ["ia", "inspectIaRepository"],
    ["ui", "inspectUiRepository"],
    ["spec", "inspectSpecRepository"],
    ["architecture", "inspectArchitectureRepository"],
    ["quality", "inspectQualityRepository"],
  ]) {
    const source = fs.readFileSync(
      path.join(checkerRoot, "src/repository", `${module}.ts`),
      "utf8",
    );
    assert.match(source, new RegExp(`export function ${name}\\(`, "u"));
    assert.match(repository, new RegExp(`${name}\\(`, "u"));
  }
});

const RETIRED_CHECKER_MJS = `crdd${"_"}check.mjs`;

const RETIRED_CHECKER_TS = `crdd${"_"}check.ts`;

const RETIRED_CHECKER_TEST_TS = `crdd${"_"}check.test.ts`;

const RETIRED_FAULT_INJECTOR = `crdd${"_"}check_fault_injector`;

const RETIRED_THREAT_MODEL = `THREAT${"_"}MODEL.md`;

const RETIRED_REFERENCE_LITERALS = Object.freeze([
  RETIRED_CHECKER_MJS,
  RETIRED_CHECKER_TS,
  RETIRED_CHECKER_TEST_TS,
  RETIRED_FAULT_INJECTOR,
  RETIRED_THREAT_MODEL,
]);

const HISTORICAL_CHANGE_REFERENCE =
  /^99_Roadmap\/Changes\/CHG-\d{6}\/change\.md$/u;

const REFERENCE_FILE_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".ts",
  ".yaml",
  ".yml",
]);

/**
 * collectFilesのTest準備責務を実行する。
 *
 * @responsibility collectFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      assertGeneratedTargetDirectory(path.join(root, entry.name));
      continue;
    }
    const target = path.join(root, entry.name);
    if (isPlatformAccessTarget(target)) {
      assertGeneratedTargetDirectory(target);
      continue;
    }
    if (entry.isDirectory()) {
      assert.equal(
        entry.isSymbolicLink(),
        false,
        `symbolic directory: ${target}`,
      );
      files.push(...collectFiles(target));
      continue;
    }
    assert.ok(entry.isFile(), `unsupported filesystem entry: ${target}`);
    files.push(target);
  }
  return files;
}

/**
 * CRDD Domain LibraryからChecker／CLIへの逆依存がないことを検証する。
 *
 * @responsibility Domain LibraryのSource Graphを観測し、上位Consumerへの禁止依存を検出する。
 * @trace RCM-IT-013
 * @precondition CRDD Domain Libraryのsrc配下がRepository内に存在する。
 * @stimulus 全TypeScript Sourceの静的import／export-from／dynamic importを列挙する。
 * @observation Checker、CLI入口またはtemplate/toolsを参照するModule指定子を記録する。
 * @oracle Domain Libraryから上位Consumerへ向かう禁止依存が0件である。
 * @cleanup N/A: Repository Sourceを読取り専用で観測する。
 * @boundary RCM-IT-013=Direct Boundary: checker Test Source→対象契約
 */
test("CRDD Domain LibraryはCheckerとCLIへ逆依存しない", () => {
  const domainSourceRoot = path.join(
    repositoryRoot,
    "40_Develop",
    "domain-model",
    "src",
  );
  const forbiddenDependencies: string[] = [];
  for (const file of collectFiles(domainSourceRoot).filter((candidate) =>
    candidate.endsWith(".ts"),
  )) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /(?:from\s+|import\s*\()(["'])([^"']+)\1/gu,
    )) {
      const moduleSpecifier = match[2] ?? "";
      if (
        moduleSpecifier.includes("/checker/") ||
        moduleSpecifier.includes("template/tools") ||
        moduleSpecifier.endsWith("/bin/checker.ts")
      )
        forbiddenDependencies.push(
          `${path.relative(repositoryRoot, file)} -> ${moduleSpecifier}`,
        );
    }
  }
  assert.deepEqual(forbiddenDependencies, []);
});

/**
 * assertPublicIndexContractのTest準備責務を実行する。
 *
 * @responsibility assertPublicIndexContractがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertPublicIndexContractを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function assertPublicIndexContract(
  file: string,
  profile: PublicIndexProfile,
): void {
  const source = fs.readFileSync(file, "utf8");
  const exportDeclarations = [
    ...source.matchAll(
      /export\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s+as\s+[A-Za-z][A-Za-z0-9]*)\s+from\s+["']([^"']+)["']/gu,
    ),
  ];
  const exportedModulePaths = exportDeclarations.map((match) => match[1] ?? "");
  assert.deepEqual(
    [...new Set(exportedModulePaths)].sort(),
    [...profile.exportedModules].sort(),
    `public export module allowlist: ${file}`,
  );
  const namespaceExports = [
    ...source.matchAll(
      /^export\s+\*\s+as\s+([A-Za-z][A-Za-z0-9]*)\s+from\s+["']([^"']+)["']/gmu,
    ),
  ].map((match) => [match[1] ?? "", match[2] ?? ""] as const);
  assert.deepEqual(
    Object.fromEntries(namespaceExports),
    profile.namespaceExports ?? {},
    `namespace export contract: ${file}`,
  );
}

/**
 * isPlatformAccessTargetのTest準備責務を実行する。
 *
 * @responsibility isPlatformAccessTargetがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isPlatformAccessTargetを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function isPlatformAccessTarget(target: string): boolean {
  return (
    target ===
    path.join(repositoryRoot, "40_Develop", "platform-access", "target")
  );
}

/**
 * assertGeneratedTargetDirectoryのTest準備責務を実行する。
 *
 * @responsibility assertGeneratedTargetDirectoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertGeneratedTargetDirectoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function assertGeneratedTargetDirectory(target: string): void {
  const metadata = fs.lstatSync(target);
  assert.equal(metadata.isSymbolicLink(), false, `symbolic target: ${target}`);
  assert.equal(metadata.isDirectory(), true, `non-directory target: ${target}`);
}

/**
 * collectReferenceFilesのTest準備責務を実行する。
 *
 * @responsibility collectReferenceFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectReferenceFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function collectReferenceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "Evidence" ||
      (root === repositoryRoot && entry.name === ".crdd")
    )
      continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      assert.equal(
        entry.isSymbolicLink(),
        false,
        `symbolic reference directory: ${target}`,
      );
      files.push(...collectReferenceFiles(target));
      continue;
    }
    if (!entry.isFile() || entry.name === "CHANGELOG.md") continue;
    if (REFERENCE_FILE_EXTENSIONS.has(path.extname(entry.name)))
      files.push(target);
  }
  return files;
}

/**
 * countLiteralのTest準備責務を実行する。
 *
 * @responsibility countLiteralがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus countLiteralを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function countLiteral(source: string, literal: string): number {
  let count = 0;
  let offset = source.indexOf(literal);
  while (offset !== -1) {
    count += 1;
    offset += literal.length;
    offset = source.indexOf(literal, offset);
  }
  return count;
}

/**
 * collectRetiredReferenceCountsのTest準備責務を実行する。
 *
 * @responsibility collectRetiredReferenceCountsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectRetiredReferenceCountsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function collectRetiredReferenceCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of collectReferenceFiles(repositoryRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const relativeFile = path
      .relative(repositoryRoot, file)
      .replaceAll(path.sep, "/");
    for (const literal of RETIRED_REFERENCE_LITERALS) {
      const count = countLiteral(source, literal);
      if (count > 0) counts.set(`${relativeFile}|${literal}`, count);
    }
  }
  return counts;
}

/**
 * isContainedPathのTest準備責務を実行する。
 *
 * @responsibility isContainedPathがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isContainedPathを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function isContainedPath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * resolveOwnedFileのTest準備責務を実行する。
 *
 * @responsibility resolveOwnedFileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolveOwnedFileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
function resolveOwnedFile(
  file: string,
  ownershipRoots: readonly string[],
): string {
  const stats = fs.lstatSync(file);
  assert.equal(stats.isSymbolicLink(), false, `symbolic source: ${file}`);
  assert.equal(stats.isFile(), true, `non-file source: ${file}`);
  const resolved = fs.realpathSync.native(file);
  assert.equal(
    resolved.endsWith(".d.ts"),
    false,
    `declaration source: ${resolved}`,
  );
  assert.equal(resolved.includes(`${path.sep}node_modules${path.sep}`), false);
  assert.ok(
    ownershipRoots.some((root) =>
      isContainedPath(resolved, fs.realpathSync.native(root)),
    ),
    `source outside owned roots: ${resolved}`,
  );
  return resolved;
}

/**
 * Package所有の検証済みManifestと検証Toolのexact Sourceを取得する。
 * @responsibility ManifestとTool Pathの実在・所有範囲・登録の一意性を検証する。
 * @trace RCM-IT-005
 * @precondition 指定Rootは現Package又は自己生成した局所fixtureである。
 * @stimulus 各symbol.jsonを既存Domain Validatorへ渡し、Toolの通常File実体を照合する。
 * @observation 検証済みManifestと同Package内の重複しないTool実Path。
 * @oracle 無効Manifest、別Packageへのalias、同Tool Pathの異種又は重複登録は拒否する。
 * @cleanup N/A: 読取りだけでSourceやManifestを変更しない。
 * @boundary RCM-IT-005=Direct Boundary: ManifestとFilesystem→登録実体・所有範囲の照合。
 */
function collectVerifiedSymbolManifests(
  subsystemRoots: readonly string[],
): Readonly<{
  manifests: ReadonlyMap<string, RealitySymbolManifest>;
  verificationToolPaths: ReadonlySet<string>;
}> {
  const manifests = new Map<string, RealitySymbolManifest>();
  const verificationToolPaths = new Set<string>();
  for (const subsystemRoot of subsystemRoots) {
    const subsystem = path.basename(subsystemRoot);
    const rootStats = fs.lstatSync(subsystemRoot);
    assert.ok(rootStats.isDirectory() && !rootStats.isSymbolicLink());
    const realRoot = fs.realpathSync.native(subsystemRoot);
    assert.equal(realRoot, path.resolve(subsystemRoot), "aliased Package Root");
    const manifestPath = path.join(subsystemRoot, "symbol.json");
    const realManifestPath = resolveOwnedFile(manifestPath, subsystemRoots);
    assert.ok(isContainedPath(realManifestPath, realRoot));
    assert.equal(realManifestPath, manifestPath, "aliased Manifest Path");
    const outcome = validateRealitySymbolManifest(
      JSON.parse(fs.readFileSync(realManifestPath, "utf8")),
      `${subsystem}/symbol.json`,
    );
    assert.equal(outcome.status, "complete", `invalid Manifest: ${subsystem}`);
    assert.ok(outcome.result);
    assert.equal(outcome.issues.length, 0);
    assert.equal(outcome.result.subsystem, subsystem);
    manifests.set(subsystem, outcome.result);
    for (const symbol of outcome.result.symbols) {
      for (const id of symbol.archIds ?? [])
        assert.ok(
          canonicalArchitectureIds.has(id),
          "Unknown Architecture relation: " + id,
        );
      if (symbol.kind !== "verification-tool") continue;
      assert.equal(
        outcome.result.symbols.filter(
          (candidate) => candidate.path === symbol.path,
        ).length,
        1,
        `Tool Path must have one classification: ${symbol.path}`,
      );
      const toolPath = path.join(realRoot, symbol.path);
      const realToolPath = resolveOwnedFile(toolPath, subsystemRoots);
      assert.ok(
        isContainedPath(realToolPath, realRoot),
        "Tool outside Package",
      );
      assert.equal(realToolPath, toolPath, "aliased Tool Path");
      assert.equal(verificationToolPaths.has(realToolPath), false);
      verificationToolPaths.add(realToolPath);
    }
  }
  return { manifests, verificationToolPaths };
}

const verifiedSymbolSources = collectVerifiedSymbolManifests(
  fs
    .readdirSync(path.join(repositoryRoot, "40_Develop"), {
      withFileTypes: true,
    })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => path.join(repositoryRoot, "40_Develop", entry.name))
    .filter((root) => fs.existsSync(path.join(root, "symbol.json"))),
);

/**
 * 40_Develop配下のREADMEを拒否し、説明の正本分離を維持するを検証する。
 *
 * @responsibility 40_Develop配下のREADMEを拒否し、説明の正本分離を維持するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 40_Develop配下のREADMEを拒否し、説明の正本分離を維持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("40_Develop配下のREADMEを拒否し、説明の正本分離を維持する", () => {
  assert.deepEqual(
    collectFiles(path.join(repositoryRoot, "40_Develop")).filter(
      (file) => path.basename(file) === "README.md",
    ),
    [],
  );
  assert.ok(fs.lstatSync(path.join(repositoryRoot, "README.md")).isFile());
});

/**
 * 公開index全体の母集団と各契約を確認する。
 * @responsibility 個別Packageの成功をRepository全体へ拡張しない。
 * @trace RCM-IT-005
 * @precondition 現行Sourceと既存の公開契約を読む。
 * @stimulus 全公開入口と敵対fixtureを検査する。
 * @observation 母集団、ヘッダー、公開Moduleを比較する。
 * @oracle 既存の全数契約と反例が成立する。
 * @cleanup 作成したfixtureだけを終了する。
 * @boundary Source検査であり外部Effectの成立証明ではない。
 */
test("宣言済みTSツールの公開Module間接続は既存契約に一致する", () => {
  for (const profile of PUBLIC_INDEX_PROFILES)
    assertPublicIndexContract(
      path.join(repositoryRoot, ...profile.relativePath.split("/")),
      profile,
    );
});

/**
 * 各Tool packageの再生成可能な依存DirectoryをGit対象から除外するを検証する。
 *
 * @responsibility 各Tool packageの再生成可能な依存DirectoryをGit対象から除外するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 各Tool packageの再生成可能な依存DirectoryをGit対象から除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("各Tool packageの再生成可能な依存DirectoryをGit対象から除外する", () => {
  const ignoreRules = fs
    .readFileSync(path.join(repositoryRoot, ".gitignore"), "utf8")
    .split(/\r?\n/u);
  assert.ok(
    ignoreRules.includes("**/node_modules/"),
    "Repository Rootの.gitignoreは全階層のnode_modulesを除外する",
  );
});

/**
 * Checker試験の実行集合はnested配置を含む所有集合と完全一致するを検証する。
 *
 * @responsibility Checker試験の実行集合はnested配置を含む所有集合と完全一致するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Checker試験の実行集合はnested配置を含む所有集合と完全一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("Checker試験の実行集合はnested配置を含む所有集合と完全一致する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-checker-test-discovery-"),
  );
  try {
    const nestedRoot = path.join(temporaryRoot, "nested-subject");
    const dependencyRoot = path.join(temporaryRoot, "node_modules");
    fs.mkdirSync(nestedRoot);
    fs.mkdirSync(dependencyRoot);
    const directTest = path.join(temporaryRoot, "alpha.contract.test.ts");
    const nestedTest = path.join(nestedRoot, "beta.unit.test.ts");
    fs.writeFileSync(directTest, "", "utf8");
    fs.writeFileSync(nestedTest, "", "utf8");
    fs.writeFileSync(
      path.join(temporaryRoot, "ordinary-source.ts"),
      "",
      "utf8",
    );
    fs.writeFileSync(
      path.join(dependencyRoot, "ignored.contract.test.ts"),
      "",
      "utf8",
    );

    const discoveredTests = discoverCheckerTestFiles(temporaryRoot);
    assert.deepEqual(discoveredTests, [
      fs.realpathSync.native(directTest),
      fs.realpathSync.native(nestedTest),
    ]);
    assertExactCheckerTestPopulation(discoveredTests, discoveredTests);
    assert.strictEqual(
      requireCheckerTestFiles(discoveredTests),
      discoveredTests,
    );
    assert.throws(
      () =>
        assertExactCheckerTestPopulation(discoveredTests, [
          directTest,
          nestedTest,
          path.join(temporaryRoot, "missing.contract.test.ts"),
        ]),
      /missing from runner/u,
    );
    assert.throws(
      () => assertExactCheckerTestPopulation(discoveredTests, [directTest]),
      /missing from project/u,
    );
    assert.throws(
      () =>
        assertExactCheckerTestPopulation(
          [directTest, directTest.toUpperCase()],
          [directTest],
        ),
      /duplicate or case-colliding/u,
    );

    const emptyRoot = path.join(temporaryRoot, "empty-root");
    fs.mkdirSync(emptyRoot);
    const emptyTests = discoverCheckerTestFiles(emptyRoot);
    assert.deepEqual(emptyTests, []);
    assert.throws(() => requireCheckerTestFiles(emptyTests), /not found/u);

    const junctionTarget = path.join(temporaryRoot, "junction-target");
    fs.mkdirSync(junctionTarget);
    fs.symlinkSync(
      junctionTarget,
      path.join(temporaryRoot, "linked-tests"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(() => discoverCheckerTestFiles(temporaryRoot), /symbolic/u);
    fs.rmSync(path.join(temporaryRoot, "linked-tests"));

    const unsupportedEntry = path.join(temporaryRoot, "unsupported-entry");
    fs.writeFileSync(unsupportedEntry, "", "utf8");
    const unknownEntryOperations: TestDiscoveryOperations = {
      inspectPath: (target) =>
        target === unsupportedEntry
          ? {
              isDirectory: () => false,
              isFile: () => false,
              isSymbolicLink: () => false,
            }
          : fs.lstatSync(target),
      listNames: (target) => fs.readdirSync(target),
      resolvePath: (target) => fs.realpathSync.native(target),
    };
    assert.throws(
      () => discoverCheckerTestFiles(temporaryRoot, unknownEntryOperations),
      /Unsupported Checker test entry/u,
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

/**
 * 旧checker実体は現行Treeに残らないを検証する。
 *
 * @responsibility 旧checker実体は現行Treeに残らないの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧checker実体は現行Treeに残らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("旧checker実体は現行Treeに残らない", () => {
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "40_Develop", "checker", RETIRED_CHECKER_TS),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "template", "tools", RETIRED_CHECKER_TS),
    ),
    false,
  );
});

/**
 * 廃止済みPathの参照は固定履歴と移行説明にだけ残るを検証する。
 *
 * @responsibility 廃止済みPathの参照は固定履歴と移行説明にだけ残るの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 廃止済みPathの参照は固定履歴と移行説明にだけ残るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("廃止済みPathの参照は固定履歴と移行説明にだけ残る", () => {
  const actualReferenceCounts = [...collectRetiredReferenceCounts()];
  assert.equal(
    actualReferenceCounts.some(([key]) => key.startsWith(".crdd/")),
    false,
    "repository-local runtime state must not enter the canonical reference population",
  );
  for (const [key, count] of actualReferenceCounts) {
    const separator = key.lastIndexOf("|");
    const file = key.slice(0, separator);
    assert.ok(
      file === "README.md" || HISTORICAL_CHANGE_REFERENCE.test(file),
      `retired reference outside history or migration explanation: ${key}`,
    );
    assert.ok(count > 0, `invalid retired reference count: ${key}`);
  }
});

/**
 * 登録された試験・検証ToolとQuality義務の成果物関係を照合する。
 *
 * @responsibility Catalog、Symbol Manifest、QA定義のID・Owner・Path・段階と参照集合を照合する。
 * @trace RCM-IT-005
 * @precondition Test Catalog、Quality Definitionおよび各Subsystemのsymbol.jsonが読取り可能である。
 * @stimulus 登録済み試験と検証Toolの台帳・定義・実在Pathを照合する。
 * @observation 登録件数、ID、段階、QA関係、verifiesとPathの解決結果。
 * @oracle 同じOwner・実在Pathで一意に登録され、Local ItemとQA・試験段階が一致する。コード内部や実行成功は証明しない。
 * @cleanup N/A: 読取り専用検査でありRepositoryを変更しない。
 * @boundary RCM-IT-005=Direct Boundary: checker Test Source→対象契約
 */
test("Test Catalog・Symbol・Quality Local Itemの成果物関係を照合する", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, "07_Quality", "Registry", "test-catalog.json"),
      "utf8",
    ),
  ) as {
    readonly tests: readonly {
      readonly id: string;
      readonly owner: string;
      readonly level: keyof typeof TEST_LEVEL_CODE;
      readonly path: string;
      readonly humanInput: boolean;
    }[];
  };
  assert.ok(catalog.tests.length > 0, "Test Catalog population is empty");
  const manifests = verifiedSymbolSources.manifests;
  const headerTargets = catalog.tests.map((entry) => ({
    ...entry,
    verificationTool: false,
  }));
  for (const [owner, manifest] of manifests) {
    for (const symbol of manifest.symbols) {
      if (symbol.kind !== "verification-tool") continue;
      assert.ok(Array.isArray(symbol.localTestIds));
      const levels = new Set(
        symbol.localTestIds.map((id) => String(id).split("-")[1]),
      );
      assert.equal(
        levels.size,
        1,
        `Tool relation level must be exact: ${symbol.symbolId}`,
      );
      const level = Object.entries(TEST_LEVEL_CODE).find(([, code]) =>
        levels.has(code),
      )?.[0];
      assert.ok(level, `Tool relation level missing: ${symbol.symbolId}`);
      assert.equal(typeof symbol.path, "string");
      headerTargets.push({
        id: String(symbol.symbolId),
        owner,
        level: level as keyof typeof TEST_LEVEL_CODE,
        path: `40_Develop/${owner}/${symbol.path}`,
        humanInput: false,
        verificationTool: true,
      });
    }
  }
  for (const catalogTest of headerTargets) {
    const expectedLevel = TEST_LEVEL_CODE[catalogTest.level];
    assert.ok(expectedLevel, `Unsupported test level: ${catalogTest.id}`);
    const manifest = manifests.get(catalogTest.owner);
    assert.ok(manifest, `Verified Manifest missing: ${catalogTest.owner}`);
    const relativePath = catalogTest.path.replace(
      `40_Develop/${catalogTest.owner}/`,
      "",
    );
    const symbols = manifest.symbols.filter(
      (symbol) =>
        symbol.kind ===
          (catalogTest.verificationTool ? "verification-tool" : "test-suite") &&
        symbol.path === relativePath,
    );
    resolveOwnedFile(path.join(repositoryRoot, catalogTest.path), [
      path.join(repositoryRoot, "40_Develop", catalogTest.owner),
    ]);
    // 人間操作だけの未接続計画を実装済み試験へ昇格しない。登録済みなら通常どおり照合する。
    if (catalogTest.humanInput && symbols.length === 0) {
      continue;
    }
    assert.equal(
      symbols.length,
      1,
      `Test Symbol must be exact: ${catalogTest.id}`,
    );
    const localTestIds = symbols[0]?.localTestIds;
    assert.ok(
      Array.isArray(localTestIds),
      `Test Symbol localTestIds missing: ${catalogTest.id}`,
    );
    assert.ok(
      localTestIds.length > 0,
      `Test Symbol Local Item missing: ${catalogTest.id}`,
    );
    const normalizedLocalTestIds = [
      ...new Set(localTestIds.map(String)),
    ].sort();
    assert.equal(
      localTestIds.length,
      normalizedLocalTestIds.length,
      `Test Symbol Local Items must be unique: ${catalogTest.id}`,
    );
    const qaIds = [
      ...new Set(
        normalizedLocalTestIds.map((localTestId) => {
          assert.equal(
            localTestId.split("-")[1],
            expectedLevel,
            `Test Symbol level mismatch: ${catalogTest.id}`,
          );
          const qaId = canonicalQualityLocalItems.get(localTestId);
          assert.ok(
            qaId,
            `Test Symbol Local Item not found: ${catalogTest.id}`,
          );
          return qaId;
        }),
      ),
    ].sort();
    assert.deepEqual(
      [...(symbols[0]?.qaIds ?? [])].sort(),
      qaIds,
      `Test Symbol QA relation mismatch: ${catalogTest.id}`,
    );
    assert.ok(
      Array.isArray(symbols[0]?.verifies) &&
        (catalogTest.verificationTool ||
        symbols[0].verificationTarget === "environment"
          ? symbols[0].verifies.length === 0
          : symbols[0].verifies.length > 0),
      `Test Symbol implementation relation missing: ${catalogTest.id}`,
    );
  }
});

/**
 * 検証Toolの台帳は言語を解析せず、関係と用途限定Pathを検査する。
 * @responsibility 言語の追加をSource parserの追加へ結び付けず、製品実装との混在は拒否する。
 * @trace RCM-IT-015
 * @precondition QA関係だけを持つ合成Manifestを使用する。
 * @stimulus TS・Rust・PythonのTool Path、製品srcと越境Pathを渡す。
 * @observation Manifestのcomplete／invalid。
 * @oracle 既知言語一覧に依存せずTool関係を受理し、禁止Path・ARCH混在を拒否する。
 * @cleanup N/A: 合成値だけでファイル作成・実行なし。
 * @boundary RCM-IT-015=Direct Boundary: Manifest入力からDomainの構造検査。
 */
test("検証Toolの成果物関係は言語非依存で禁止Pathと関係混在を拒否する", () => {
  const tool = {
    symbolId: "fixture.tool",
    kind: "verification-tool",
    path: "scripts/tool.py",
    qaIds: ["QA-000006"],
    localTestIds: ["ERB-UT-023"],
    verifies: [],
  };
  const inspect = (symbol: unknown) =>
    validateRealitySymbolManifest(
      {
        contract: "crdd/reality-symbol-manifest",
        contractRevision: 1,
        subsystem: "fixture",
        symbols: [symbol],
      },
      "fixture/symbol.json",
    );
  for (const extension of ["ts", "rs", "py"])
    assert.equal(
      inspect({ ...tool, path: `scripts/tool.${extension}` }).status,
      "complete",
    );
  for (const symbol of [
    { ...tool, path: "src/tool.py" },
    { ...tool, path: "scripts/../tool.py" },
    { ...tool, archIds: ["ARCH-000008"] },
    { ...tool, verifies: ["fixture.source"] },
  ])
    assert.equal(inspect(symbol).status, "invalid");
});
