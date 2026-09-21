/**
 * checker:integration:tools-namingの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility checker:integration:tools-namingが所有する検証責務を実行する。
 * @trace RCM-IT-005
 * @trace RCM-IT-013
 * @trace RCM-IT-015
 * @level IT
 * @scope tools、naming
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  type Expression,
  type Identifier,
  isArrayLiteralExpression,
  isArrowFunction,
  isAsExpression,
  isBinaryExpression,
  isBindingElement,
  isCallExpression,
  isClassDeclaration,
  isClassExpression,
  isElementAccessExpression,
  isExportAssignment,
  isExportDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isGetAccessorDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isNewExpression,
  isNonNullExpression,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isParameterDeclaration,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isRegularExpressionLiteral,
  isSatisfiesExpression,
  isSetAccessorDeclaration,
  isStringLiteral,
  isTaggedTemplateExpression,
  isTemplateExpression,
  isTemplateSpan,
  isTypeAliasDeclaration,
  isVariableDeclaration,
  type Node,
  NodeFlags,
  type SourceFile,
  SyntaxKind,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import {
  API,
  type Checker,
  type Project,
  SymbolFlags,
  type Type,
  TypeFlags,
} from "typescript/unstable/sync";
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
const QUALITY_LOCAL_ITEM_ID = /^[A-Z]{3}-(?:UT|IT|ST|UAT)-[0-9]{3}$/u;
const TEST_LEVEL_CODE = Object.freeze({
  unit: "UT",
  integration: "IT",
  system: "ST",
  acceptance: "UAT",
});
const REQUIRED_EXECUTABLE_HEADER_TAGS = Object.freeze([
  "input",
  "returns",
  "precondition",
  "postcondition",
  "effect",
  "failure",
  "invariant",
  "boundary",
  "security",
  "concurrency",
]);
const REQUIRED_TYPE_HEADER_TAGS = Object.freeze([
  "shape",
  "invariant",
  "boundary",
  "security",
  "compatibility",
]);
const REQUIRED_CLASS_HEADER_TAGS = Object.freeze([
  "construction",
  "lifecycle",
  "effect",
  "failure",
  "invariant",
  "boundary",
  "security",
  "concurrency",
]);

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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
const pathInspectionRoots = Object.freeze([
  path.join(repositoryRoot, "40_Develop"),
  path.join(repositoryRoot, "template", "tools"),
]);
const sourceOwnershipRoots = Object.freeze([
  path.join(repositoryRoot, "40_Develop", "artifact-signing"),
  path.join(repositoryRoot, "40_Develop", "checker"),
  path.join(repositoryRoot, "40_Develop", "coordinator"),
  path.join(repositoryRoot, "40_Develop", "crdd-domain-library"),
  path.join(repositoryRoot, "40_Develop", "execution-intelligence"),
  path.join(repositoryRoot, "40_Develop", "mcp"),
  path.join(repositoryRoot, "40_Develop", "project-runtime"),
  path.join(repositoryRoot, "40_Develop", "runtime-data"),
  path.join(repositoryRoot, "40_Develop", "semantic-coverage"),
  path.join(repositoryRoot, "40_Develop", "verification-runner"),
  path.join(repositoryRoot, "40_Develop", "version-control"),
  path.join(repositoryRoot, "template", "tools"),
]);
type PublicIndexProfile = Readonly<{
  relativePath: string;
  expectedTrace: string;
  requiredTags: readonly string[];
  exportedModules: readonly string[];
  namespaceExports?: Readonly<Record<string, string>>;
}>;
const PUBLIC_INDEX_PROFILES = Object.freeze<readonly PublicIndexProfile[]>([
  {
    relativePath: "40_Develop/artifact-signing/src/index.ts",
    expectedTrace: "ARCH-000014",
    requiredTags: ["boundary", "security"],
    exportedModules: [
      "./private-key-signing.ts",
      "./signature-result.ts",
      "./terminal-secret-input.ts",
    ],
  },
  {
    relativePath: "40_Develop/checker/src/index.ts",
    expectedTrace: "ARCH-000001",
    requiredTags: ["boundary"],
    exportedModules: [
      "./application/checker-command.ts",
      "./findings/finding-model.ts",
    ],
  },
  {
    relativePath: "40_Develop/coordinator/src/index.ts",
    expectedTrace: "ARCH-000004",
    requiredTags: ["boundary", "effect", "security"],
    exportedModules: [
      "./composition/project-runtime-public-adapter.ts",
      "./core/node-runtime-version.ts",
    ],
  },
  {
    relativePath: "40_Develop/crdd-domain-library/src/index.ts",
    expectedTrace: "ARCH-000008",
    requiredTags: ["boundary"],
    exportedModules: [
      "./artifact/index.ts",
      "./outcome.ts",
      "./quality-change-control/index.ts",
      "./reality-traceability/index.ts",
      "./repository-observation/index.ts",
    ],
    namespaceExports: {
      artifact: "./artifact/index.ts",
      qualityChangeControl: "./quality-change-control/index.ts",
      realityTraceability: "./reality-traceability/index.ts",
      repositoryObservation: "./repository-observation/index.ts",
    },
  },
  {
    relativePath: "40_Develop/crdd-domain-library/src/artifact/index.ts",
    expectedTrace: "ARCH-000008",
    requiredTags: [],
    exportedModules: [
      "./artifact-graph.ts",
      "./artifact-model.ts",
      "./markdown-artifact-parser.ts",
      "./schema-validator.ts",
    ],
  },
  {
    relativePath:
      "40_Develop/crdd-domain-library/src/quality-change-control/index.ts",
    expectedTrace: "ARCH-000003",
    requiredTags: ["boundary", "security"],
    exportedModules: ["./quality-gate.ts"],
  },
  {
    relativePath:
      "40_Develop/crdd-domain-library/src/reality-traceability/index.ts",
    expectedTrace: "ARCH-000008",
    requiredTags: [],
    exportedModules: [
      "./symbol-discovery.ts",
      "./symbol-graph.ts",
      "./symbol-manifest-model.ts",
      "./symbol-manifest-validator.ts",
    ],
  },
  {
    relativePath:
      "40_Develop/crdd-domain-library/src/repository-observation/index.ts",
    expectedTrace: "ARCH-000008",
    requiredTags: ["boundary"],
    exportedModules: ["./reality-symbol-repository-observer.ts"],
  },
  {
    relativePath: "40_Develop/execution-intelligence/src/index.ts",
    expectedTrace: "ARCH-000007",
    requiredTags: ["boundary", "effect"],
    exportedModules: [
      "./application/execution-intelligence-recorder.ts",
      "./application/execution-record-projection.ts",
      "./application/record-projection.ts",
      "./core/bounded-integrated-result-evaluation.ts",
      "./core/execution-intelligence.ts",
      "./core/temporal-provenance.ts",
      "./store/execution-intelligence-store.ts",
      "./store/verified-repository-root.ts",
    ],
  },
  {
    relativePath: "40_Develop/mcp/src/index.ts",
    expectedTrace: "ARCH-000012",
    requiredTags: ["boundary", "concurrency", "effect", "security"],
    exportedModules: [
      "./adapters/project-runtime-adapter.ts",
      "./protocol/project-runtime-protocol.ts",
      "./transports/process-signal-shutdown.ts",
      "./transports/stdio-transport.ts",
      "./transports/streamable-http-transport.ts",
    ],
  },
  {
    relativePath: "40_Develop/project-runtime/src/index.ts",
    expectedTrace: "ARCH-000004",
    requiredTags: ["boundary", "concurrency", "effect", "security"],
    exportedModules: [
      "./application/project-runtime-execution.ts",
      "./application/project-runtime-human-decision.ts",
      "./application/project-runtime-integration.ts",
      "./application/project-runtime-objective-application.ts",
      "./application/project-runtime-objective-intake.ts",
      "./application/project-runtime-replanning.ts",
      "./application/project-runtime-state-query.ts",
      "./core/project-runtime-queue.ts",
      "./core/project-runtime-state.ts",
      "./ports/candidate-port.ts",
      "./ports/clock-identity-port.ts",
      "./ports/decision-capability-port.ts",
      "./ports/decision-port.ts",
      "./ports/execution-authorization-port.ts",
      "./ports/execution-observation-port.ts",
      "./ports/execution-port.ts",
      "./ports/integration-record-port.ts",
      "./ports/lease-port.ts",
      "./ports/platform-contract.ts",
      "./ports/port-result.ts",
      "./ports/process-safety-port.ts",
      "./ports/state-port.ts",
      "./ports/task-recovery-port.ts",
      "./public-contract/decision-request.ts",
      "./public-contract/integration-result.ts",
      "./public-contract/objective-request.ts",
      "./public-contract/project-state-query.ts",
      "./public-contract/runtime-result.ts",
    ],
  },
  {
    relativePath: "40_Develop/runtime-data/src/index.ts",
    expectedTrace: "ARCH-000011",
    requiredTags: ["boundary", "concurrency", "effect"],
    exportedModules: [
      "./core/runtime-data-contract.ts",
      "./platform/runtime-data-path-resolver.ts",
      "./store/temporary-operation-store.ts",
    ],
  },
  {
    relativePath: "40_Develop/semantic-coverage/src/index.ts",
    expectedTrace: "ARCH-000008",
    requiredTags: ["boundary", "concurrency", "effect", "security"],
    exportedModules: [
      "./application/semantic-bundle.ts",
      "./application/semantic-coverage.ts",
      "./compilation/index.ts",
      "./coverage/index.ts",
      "./infrastructure/filesystem-semantic-bundle-publisher.ts",
    ],
  },
  {
    relativePath: "40_Develop/verification-runner/src/index.ts",
    expectedTrace: "ARCH-000003",
    requiredTags: ["boundary", "effect"],
    exportedModules: ["./application/regression-runner.ts"],
  },
  {
    relativePath: "40_Develop/version-control/src/index.ts",
    expectedTrace: "ARCH-000002",
    requiredTags: ["boundary", "effect"],
    exportedModules: [
      "./fixed-revision.ts",
      "./fixed-snapshot.ts",
      "./git/checker-repository-observation-adapter.ts",
      "./git/fixed-revision-adapter.ts",
      "./git/fixed-snapshot-adapter.ts",
      "./git/local-change-set-adapter.ts",
      "./git/repository-layout-adapter.ts",
      "./git/repository-local-ignore-adapter.ts",
      "./local-change-set.ts",
      "./repository-local-ignore.ts",
      "./repository-location.ts",
      "./repository-revision.ts",
    ],
  },
  {
    relativePath: "40_Develop/version-control/src/checker-observation/index.ts",
    expectedTrace: "ARCH-000002",
    requiredTags: ["boundary"],
    exportedModules: ["../git/checker-repository-observation-adapter.ts"],
  },
  {
    relativePath: "40_Develop/version-control/src/repository-identity/index.ts",
    expectedTrace: "ARCH-000002",
    requiredTags: ["boundary"],
    exportedModules: ["../repository-location.ts"],
  },
]);
const projectConfigs = Object.freeze([
  path.join(checkerRoot, "tsconfig.json"),
  path.join(checkerRoot, "template-tools-tsconfig.json"),
  path.join(repositoryRoot, "40_Develop", "artifact-signing", "tsconfig.json"),
  path.join(
    repositoryRoot,
    "40_Develop",
    "coordinator",
    "tsconfig.strict.json",
  ),
  path.join(repositoryRoot, "40_Develop", "coordinator", "tsconfig.tests.json"),
  path.join(
    repositoryRoot,
    "40_Develop",
    "execution-intelligence",
    "tsconfig.json",
  ),
  path.join(repositoryRoot, "40_Develop", "project-runtime", "tsconfig.json"),
  path.join(repositoryRoot, "40_Develop", "runtime-data", "tsconfig.json"),
  path.join(repositoryRoot, "40_Develop", "mcp", "tsconfig.json"),
  path.join(
    repositoryRoot,
    "40_Develop",
    "crdd-domain-library",
    "tsconfig.json",
  ),
  path.join(repositoryRoot, "40_Develop", "semantic-coverage", "tsconfig.json"),
  path.join(
    repositoryRoot,
    "40_Develop",
    "verification-runner",
    "tsconfig.json",
  ),
  path.join(repositoryRoot, "40_Develop", "version-control", "tsconfig.json"),
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("Checker公開入口はArchitecture宣言済みSymbolだけを公開する", () => {
  assert.deepEqual(exportedNames("src/index.ts"), [
    "CheckerFinding",
    "CheckerResult",
    "CheckerRunRequest",
    "runChecker",
  ]);
});

/**
 * Checker公開Use Caseは工程別検査を所有せず現行Profileへ委譲するを検証する。
 *
 * @responsibility Checker公開Use Caseは工程別検査を所有せず現行Profileへ委譲するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Checker公開Use Caseは工程別検査を所有せず現行Profileへ委譲するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("Checker公開Use Caseは工程別検査を所有せず現行Profileへ委譲する", () => {
  const applicationSource = fs.readFileSync(
    path.join(checkerRoot, "src", "application", "checker-command.ts"),
    "utf8",
  );
  const profileSource = fs.readFileSync(
    path.join(checkerRoot, "src", "profiles", "current-profile.ts"),
    "utf8",
  );
  assert.match(
    applicationSource,
    /from "\.\.\/profiles\/current-profile\.ts"/u,
  );
  assert.match(
    applicationSource,
    /return runCurrentProfileChecker\(request\)/u,
  );
  assert.doesNotMatch(applicationSource, /function check[A-Z]/u);
  for (const check of [
    "checkWorkLifecycleNavigation",
    "checkUxRequirementAnalysis",
    "checkIaReconstruction",
    "checkUiReconstruction",
    "checkSpecReconstruction",
    "checkArchitectureReconstruction",
    "checkQualityReconstruction",
  ])
    assert.match(profileSource, new RegExp(`function ${check}\\(`, "u"));
});
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/u;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const BOOLEAN_AUXILIARY_PREFIXES = new Set([
  "is",
  "has",
  "can",
  "should",
  "did",
  "does",
  "was",
  "were",
  "will",
]);
const SUBJECT_BOOLEAN_SUFFIXES = new Set([
  "Active",
  "Allowed",
  "Available",
  "Complete",
  "Completed",
  "Confirmed",
  "Created",
  "Eligible",
  "Exceeded",
  "Executed",
  "Failed",
  "Issued",
  "Present",
  "Absent",
  "Recorded",
  "Released",
  "Removed",
  "Requested",
  "Required",
  "Settled",
  "Spawned",
  "Started",
  "Submitted",
  "Terminated",
  "Transferred",
  "Exists",
  "Fails",
  "Match",
  "Matches",
  "Throw",
  "Performed",
]);
const STANDALONE_BOOLEAN_NAMES = new Set([
  "released",
  "closed",
  "submitted",
  "present",
  "settled",
  "exceeded",
  "confirmed",
  "terminated",
  "exists",
]);
const PLURAL_NAME =
  /(?:s|Children|Criteria|Evidence|Indices|Inventory|Vertices|People|Media|Data)$/u;
const TECHNICAL_VECTOR_NAME = /^argv$/u;
const STANDALONE_COLLECTIVE_NAME = /^evidence$/u;
const TEST_FILE =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(unit|contract|integration|boundary|golden|current)\.test\.ts$/u;
const TYPESCRIPT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/u;
const AMBIGUOUS_SOURCE_FILE = /(?:^|-)(?:utils?|helper|common|manager)\.ts$/u;
const BARE_TYPES_SOURCE_FILE = /^types\.ts$/u;
const RUST_FILE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.rs$/u;
const MARKDOWN_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
const JSON_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u;
const PYTHON_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.py$/u;
const TEXT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/u;
const NATIVE_EXECUTABLE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.exe$/u;
const POLICY_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+\.\d+\.\d+\.policy$/u;
const DOCKERFILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.Dockerfile$/u;
const RESERVED_FILE_NAMES = new Set([
  ".gitignore",
  "Cargo.lock",
  "Cargo.toml",
  "README.md",
  "main.rs",
  "package-lock.json",
  "package.json",
  "rust-toolchain.toml",
  "tsconfig.json",
  "tsconfig.strict.json",
  "tsconfig.tests.json",
]);
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
const PROHIBITED_SOURCE_DIRECTORY_NAMES = new Set([
  "common",
  "helpers",
  "internal",
  "utils",
]);
const FIXED_GLOBAL_INTRINSICS = new Set(["Date"]);
const FIXED_GLOBAL_CALLS = new Set(["BigInt", "Symbol"]);
const FIXED_GLOBAL_OBJECTS = new Set(["JSON", "Object", "String"]);
const TYPED_ARRAY_INTRINSICS = new Set([
  "BigInt64Array",
  "BigUint64Array",
  "Buffer",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
]);

type NamingViolation = Readonly<{
  column: number;
  file: string;
  kind: string;
  line: number;
  name: string;
  rule: string;
}>;

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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
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
      assert.match(entry.name, KEBAB_CASE, `folder name: ${target}`);
      assertSourceDirectoryPath(target);
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
 * @boundary RCM-IT-013=Direct Boundary: Domain Library→Consumer Source Graph
 */
test("CRDD Domain LibraryはCheckerとCLIへ逆依存しない", () => {
  const domainSourceRoot = path.join(
    repositoryRoot,
    "40_Develop",
    "crdd-domain-library",
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
        moduleSpecifier.endsWith("/bin/crdd-check.ts")
      )
        forbiddenDependencies.push(
          `${path.relative(repositoryRoot, file)} -> ${moduleSpecifier}`,
        );
    }
  }
  assert.deepEqual(forbiddenDependencies, []);
});

/**
 * collectPublicIndexFilesのTest準備責務を実行する。
 *
 * @responsibility collectPublicIndexFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectPublicIndexFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function collectPublicIndexFiles(): readonly string[] {
  return PUBLIC_INDEX_PROFILES.map((profile) =>
    path.join(repositoryRoot, ...profile.relativePath.split("/")),
  );
}

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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function assertPublicIndexContract(
  file: string,
  profile: PublicIndexProfile,
): void {
  const source = fs.readFileSync(file, "utf8");
  const header = source.match(/^\/\*\*[\s\S]*?\*\//u)?.[0] ?? "";
  assert.match(
    header,
    /@packageDocumentation\b/u,
    `package documentation: ${file}`,
  );
  assert.match(
    header,
    /@responsibility\s+\S/u,
    `package responsibility: ${file}`,
  );
  const traceValues = [
    ...header.matchAll(/^\s*\*\s+@trace\s+(\S(?:.*\S)?)\s*$/gmu),
  ].map((match) => match[1] ?? "");
  assert.deepEqual(
    traceValues,
    [profile.expectedTrace],
    `package trace contract: ${file}`,
  );
  for (const requiredTag of profile.requiredTags)
    assert.match(
      header,
      new RegExp(`@${requiredTag}\\s+\\S`, "u"),
      `package ${requiredTag}: ${file}`,
    );
  assert.doesNotMatch(
    source,
    /^export\s+\*\s+from\s+/gmu,
    `public index must use an explicit export allowlist: ${file}`,
  );
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
 * assertSourceDirectoryPathのTest準備責務を実行する。
 *
 * @responsibility assertSourceDirectoryPathがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertSourceDirectoryPathを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function assertSourceDirectoryPath(directory: string): void {
  const relativePath = path.relative(
    path.join(repositoryRoot, "40_Develop"),
    directory,
  );
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  )
    return;
  const segments = relativePath.split(path.sep);
  const sourceIndex = segments.indexOf("src");
  if (sourceIndex < 1) return;
  const sourceDepth = segments.length - sourceIndex - 1;
  assert.ok(
    sourceDepth <= 2,
    `source directory depth exceeds two levels: ${directory}`,
  );
  assert.equal(
    PROHIBITED_SOURCE_DIRECTORY_NAMES.has(segments.at(-1) ?? ""),
    false,
    `source directory must express a responsibility: ${directory}`,
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * assertFileNameのTest準備責務を実行する。
 *
 * @responsibility assertFileNameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertFileNameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function assertFileName(file: string): void {
  const name = path.basename(file);
  const relativeToDevelop = path.relative(
    path.join(repositoryRoot, "40_Develop"),
    file,
  );
  if (
    name === "README.md" &&
    relativeToDevelop !== "" &&
    !relativeToDevelop.startsWith(`..${path.sep}`) &&
    relativeToDevelop !== ".." &&
    !path.isAbsolute(relativeToDevelop)
  ) {
    assert.fail(
      `40_Develop must not contain README.md; move design to 06_Architecture and repeatable operations to 19_Workflows: ${file}`,
    );
  }
  if (RESERVED_FILE_NAMES.has(name)) return;
  if (name.endsWith(".test.ts")) {
    assert.match(name, TEST_FILE, `test filename: ${file}`);
    return;
  }
  if (name.endsWith(".ts")) {
    assert.match(name, TYPESCRIPT_FILE, `TypeScript filename: ${file}`);
    assert.doesNotMatch(
      name,
      AMBIGUOUS_SOURCE_FILE,
      `TypeScript filename must express its owned responsibility: ${file}`,
    );
    assert.doesNotMatch(
      name,
      BARE_TYPES_SOURCE_FILE,
      `TypeScript type collection must include its responsibility: ${file}`,
    );
    return;
  }
  if (name.endsWith(".rs")) {
    assert.match(name, RUST_FILE, `Rust filename: ${file}`);
    return;
  }
  if (name.endsWith(".md")) {
    assert.match(name, MARKDOWN_FILE, `Markdown filename: ${file}`);
    return;
  }
  if (name.endsWith(".json")) {
    assert.match(name, JSON_FILE, `JSON filename: ${file}`);
    return;
  }
  if (name.endsWith(".py")) {
    assert.match(name, PYTHON_FILE, `Python filename: ${file}`);
    return;
  }
  if (name.endsWith(".txt")) {
    assert.match(name, TEXT_FILE, `text filename: ${file}`);
    return;
  }
  if (name.endsWith(".exe")) {
    assert.match(
      name,
      NATIVE_EXECUTABLE_FILE,
      `native executable filename: ${file}`,
    );
    return;
  }
  if (name.endsWith(".policy")) {
    assert.match(name, POLICY_FILE, `policy filename: ${file}`);
    return;
  }
  if (name.endsWith(".Dockerfile")) {
    assert.match(name, DOCKERFILE, `Dockerfile name: ${file}`);
    return;
  }
  assert.fail(`unrecognized filename without an owned convention: ${file}`);
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isContainedPath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * resolveOwnedSourceのTest準備責務を実行する。
 *
 * @responsibility resolveOwnedSourceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolveOwnedSourceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function resolveOwnedSource(file: string): string {
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
    sourceOwnershipRoots.some((root) =>
      isContainedPath(resolved, fs.realpathSync.native(root)),
    ),
    `source outside owned roots: ${resolved}`,
  );
  return resolved;
}

/**
 * isOwnedProgramFileのTest準備責務を実行する。
 *
 * @responsibility isOwnedProgramFileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isOwnedProgramFileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isOwnedProgramFile(
  file: string,
  ownershipRoots: readonly string[] = sourceOwnershipRoots,
): boolean {
  return (
    !file.endsWith(".d.ts") &&
    !file.includes(`${path.sep}node_modules${path.sep}`) &&
    ownershipRoots.some((root) => isContainedPath(file, root))
  );
}

/**
 * isNullishのTest準備責務を実行する。
 *
 * @responsibility isNullishがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isNullishを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isNullish(type: Type): boolean {
  return Boolean(type.flags & (TypeFlags.Null | TypeFlags.Undefined));
}

/**
 * isAllowedBooleanNameのTest準備責務を実行する。
 *
 * @responsibility isAllowedBooleanNameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isAllowedBooleanNameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isAllowedBooleanName(name: string): boolean {
  if (STANDALONE_BOOLEAN_NAMES.has(name)) return true;
  if (!CAMEL_CASE.test(name)) return false;
  for (const prefix of BOOLEAN_AUXILIARY_PREFIXES) {
    const nextCharacter = name[prefix.length];
    if (
      name.startsWith(prefix) &&
      nextCharacter !== undefined &&
      /[A-Z]/u.test(nextCharacter)
    )
      return true;
  }
  for (const suffix of SUBJECT_BOOLEAN_SUFFIXES) {
    if (name.length > suffix.length && name.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * nonNullishTypesのTest準備責務を実行する。
 *
 * @responsibility nonNullishTypesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus nonNullishTypesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function nonNullishTypes(type: Type): readonly Type[] {
  const types = type.isUnionType() ? type.getTypes() : [type];
  return types.filter((candidateType) => !isNullish(candidateType));
}

/**
 * isBooleanTypeのTest準備責務を実行する。
 *
 * @responsibility isBooleanTypeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isBooleanTypeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isBooleanType(type: Type): boolean {
  const types = nonNullishTypes(type);
  return (
    types.length > 0 &&
    types.every((candidateType) =>
      Boolean(
        candidateType.flags & (TypeFlags.Boolean | TypeFlags.BooleanLiteral),
      ),
    )
  );
}

/**
 * isArrayTypeのTest準備責務を実行する。
 *
 * @responsibility isArrayTypeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isArrayTypeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isArrayType(
  type: Type,
  checker: Checker,
  activeTypeIds = new Set<number>(),
): boolean {
  const types = nonNullishTypes(type);
  if (types.length === 0) return false;
  return types.every((candidateType) => {
    if (activeTypeIds.has(candidateType.id)) {
      throw new Error(`cyclic array type classification: ${candidateType.id}`);
    }
    if (candidateType.flags & TypeFlags.TypeParameter) {
      const constraint = checker.getBaseConstraintOfType(candidateType);
      if (!constraint || constraint.isErrorType()) return false;
      const nextTypeIds = new Set(activeTypeIds).add(candidateType.id);
      return isArrayType(constraint, checker, nextTypeIds);
    }
    return (
      !checker.isTupleType(candidateType) && checker.isArrayType(candidateType)
    );
  });
}

/**
 * isFunctionInitializerのTest準備責務を実行する。
 *
 * @responsibility isFunctionInitializerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isFunctionInitializerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isFunctionInitializer(initializer: Expression | undefined): boolean {
  return Boolean(
    initializer &&
      (isArrowFunction(initializer) ||
        isFunctionExpression(initializer) ||
        isClassExpression(initializer)),
  );
}

type FixedInitializerContext = Readonly<{
  activeSymbolIds: ReadonlySet<number>;
  checker: Checker;
  ownershipRoots: readonly string[];
  sourceFile: SourceFile;
}>;

/**
 * declarationSourcePathのTest準備責務を実行する。
 *
 * @responsibility declarationSourcePathがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus declarationSourcePathを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function declarationSourcePath(
  identifier: Identifier,
  checker: Checker,
): string | null {
  const locatedSymbol = checker.getSymbolAtLocation(identifier);
  const symbol = locatedSymbol
    ? locatedSymbol.flags & SymbolFlags.Alias
      ? checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol
    : undefined;
  const declaration =
    symbol?.valueDeclaration?.resolve() ?? symbol?.declarations[0]?.resolve();
  return declaration
    ? path.normalize(declaration.getSourceFile().fileName)
    : null;
}

/**
 * isGlobalIntrinsicのTest準備責務を実行する。
 *
 * @responsibility isGlobalIntrinsicがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isGlobalIntrinsicを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isGlobalIntrinsic(
  identifier: Identifier,
  checker: Checker,
  allowedNames: ReadonlySet<string>,
): boolean {
  if (!allowedNames.has(identifier.text)) return false;
  const symbol = checker.getSymbolAtLocation(identifier);
  if (!symbol) return false;
  const sourcePath = declarationSourcePath(identifier, checker);
  return sourcePath === null || sourcePath.endsWith(".d.ts");
}

/**
 * isImportedCreateHashのTest準備責務を実行する。
 *
 * @responsibility isImportedCreateHashがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isImportedCreateHashを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isImportedCreateHash(
  identifier: Identifier,
  checker: Checker,
): boolean {
  if (identifier.text !== "createHash") return false;
  const sourcePath = declarationSourcePath(identifier, checker);
  return Boolean(
    sourcePath?.includes(`${path.sep}@types${path.sep}node${path.sep}`) &&
      sourcePath.endsWith(`${path.sep}crypto.d.ts`),
  );
}

/**
 * isTypedArrayPrototypeSnapshotのTest準備責務を実行する。
 *
 * @responsibility isTypedArrayPrototypeSnapshotがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isTypedArrayPrototypeSnapshotを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isTypedArrayPrototypeSnapshot(
  expression: Expression,
  checker: Checker,
): boolean {
  if (
    !isCallExpression(expression) ||
    expression.arguments.length !== 1 ||
    !isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== "getPrototypeOf" ||
    !isIdentifier(expression.expression.expression) ||
    !isGlobalIntrinsic(
      expression.expression.expression,
      checker,
      FIXED_GLOBAL_OBJECTS,
    )
  )
    return false;
  const prototype = expression.arguments[0];
  if (
    !isPropertyAccessExpression(prototype) ||
    prototype.name.text !== "prototype" ||
    !isIdentifier(prototype.expression) ||
    !TYPED_ARRAY_INTRINSICS.has(prototype.expression.text)
  )
    return false;
  const sourcePath = declarationSourcePath(prototype.expression, checker);
  return Boolean(sourcePath?.endsWith(".d.ts"));
}

/**
 * isGlobalPropertyAccessのTest準備責務を実行する。
 *
 * @responsibility isGlobalPropertyAccessがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isGlobalPropertyAccessを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isGlobalPropertyAccess(
  expression: Expression,
  objectName: string,
  propertyName: string,
  checker: Checker,
): boolean {
  return (
    isPropertyAccessExpression(expression) &&
    expression.name.text === propertyName &&
    isIdentifier(expression.expression) &&
    expression.expression.text === objectName &&
    isGlobalIntrinsic(expression.expression, checker, FIXED_GLOBAL_OBJECTS)
  );
}

/**
 * isFixedAggregateMemberのTest準備責務を実行する。
 *
 * @responsibility isFixedAggregateMemberがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isFixedAggregateMemberを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isFixedAggregateMember(
  initializer: Expression | undefined,
  context: FixedInitializerContext,
): boolean {
  if (!initializer) return false;
  if (
    isParenthesizedExpression(initializer) ||
    isAsExpression(initializer) ||
    isSatisfiesExpression(initializer) ||
    isNonNullExpression(initializer)
  ) {
    return isFixedAggregateMember(initializer.expression, context);
  }
  if (isArrayLiteralExpression(initializer)) {
    return initializer.elements.every(
      (element) =>
        element.kind !== SyntaxKind.SpreadElement &&
        isFixedAggregateMember(element, context),
    );
  }
  if (isObjectLiteralExpression(initializer)) {
    return initializer.properties.every(
      (property) =>
        isPropertyAssignment(property) &&
        !property.name.getText().startsWith("[") &&
        isFixedAggregateMember(property.initializer, context),
    );
  }
  return isFixedInitializer(initializer, context);
}

/**
 * resolvedSymbolIdのTest準備責務を実行する。
 *
 * @responsibility resolvedSymbolIdがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolvedSymbolIdを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function resolvedSymbolId(
  identifier: Identifier,
  checker: Checker,
): number | null {
  const locatedSymbol = checker.getSymbolAtLocation(identifier);
  if (!locatedSymbol) return null;
  const symbol =
    locatedSymbol.flags & SymbolFlags.Alias
      ? checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol;
  return symbol?.id ?? null;
}

/**
 * isNonEscapingDirectAggregateのTest準備責務を実行する。
 *
 * @responsibility isNonEscapingDirectAggregateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isNonEscapingDirectAggregateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isNonEscapingDirectAggregate(
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  if (
    !declaration.initializer ||
    (!isArrayLiteralExpression(declaration.initializer) &&
      !isObjectLiteralExpression(declaration.initializer)) ||
    !isIdentifier(declaration.name)
  ) {
    return false;
  }
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  if (
    variableStatement?.kind !== SyntaxKind.VariableStatement ||
    /^export\s/u.test(variableStatement.getText(declaration.getSourceFile()))
  ) {
    return false;
  }
  const symbolId = resolvedSymbolId(declaration.name, checker);
  if (symbolId === null) return false;
  let isNonEscaping = true;
  const visit = (node: Node): void => {
    if (!isNonEscaping) return;
    if (isIdentifier(node) && resolvedSymbolId(node, checker) === symbolId) {
      if (node === declaration.name) return;
      if (node.parent?.kind === SyntaxKind.VoidExpression) return;
      if (isSafeDirectAggregateRead(node, declaration, checker)) return;
      isNonEscaping = false;
      return;
    }
    node.forEachChild(visit);
  };
  declaration.getSourceFile().forEachChild(visit);
  return isNonEscaping;
}

/**
 * directAggregateSeedのTest準備責務を実行する。
 *
 * @responsibility directAggregateSeedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus directAggregateSeedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function directAggregateSeed(
  expression: Expression | undefined,
  context: FixedInitializerContext,
): Expression | null {
  if (!expression) return null;
  if (
    isParenthesizedExpression(expression) ||
    isAsExpression(expression) ||
    isSatisfiesExpression(expression) ||
    isNonNullExpression(expression)
  ) {
    return directAggregateSeed(expression.expression, context);
  }
  if (
    isArrayLiteralExpression(expression) ||
    isObjectLiteralExpression(expression)
  ) {
    return isFixedAggregateMember(expression, context) ? expression : null;
  }
  const frozenSeed = fixedFreezeSeed(expression, context);
  if (frozenSeed) return frozenSeed;
  return null;
}

/**
 * fixedFreezeSeedのTest準備責務を実行する。
 *
 * @responsibility fixedFreezeSeedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixedFreezeSeedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function fixedFreezeSeed(
  expression: Expression,
  context: FixedInitializerContext,
): Expression | null {
  if (
    !isCallExpression(expression) ||
    !isGlobalPropertyAccess(
      expression.expression,
      "Object",
      "freeze",
      context.checker,
    ) ||
    expression.arguments.length !== 1
  ) {
    return null;
  }
  let argument = expression.arguments[0];
  while (
    argument &&
    (isParenthesizedExpression(argument) ||
      isAsExpression(argument) ||
      isSatisfiesExpression(argument) ||
      isNonNullExpression(argument))
  ) {
    argument = argument.expression;
  }
  if (
    !argument ||
    (!isArrayLiteralExpression(argument) &&
      !isObjectLiteralExpression(argument))
  ) {
    return null;
  }
  return isFixedAggregateMember(argument, context) ? argument : null;
}

/**
 * literalPropertyNameのTest準備責務を実行する。
 *
 * @responsibility literalPropertyNameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus literalPropertyNameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function literalPropertyName(node: Node): string | null {
  if (isIdentifier(node) || isStringLiteral(node)) return node.text;
  if (node.kind === SyntaxKind.NumericLiteral) return node.getText();
  return null;
}

/**
 * canonicalArrayIndexのTest準備責務を実行する。
 *
 * @responsibility canonicalArrayIndexがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus canonicalArrayIndexを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function canonicalArrayIndex(node: Expression | undefined): number | null {
  if (!node) return null;
  const text =
    node.kind === SyntaxKind.NumericLiteral
      ? node.getText()
      : isStringLiteral(node)
        ? node.text
        : null;
  if (text === null || !/^(?:0|[1-9][0-9]*)$/u.test(text)) return null;
  const index = Number(text);
  return Number.isSafeInteger(index) ? index : null;
}

/**
 * primitiveReadTypeのTest準備責務を実行する。
 *
 * @responsibility primitiveReadTypeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus primitiveReadTypeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function primitiveReadType(type: Type): boolean {
  const types = type.isUnionType() ? type.getTypes() : [type];
  const allowedFlags =
    TypeFlags.Boolean |
    TypeFlags.BooleanLiteral |
    TypeFlags.String |
    TypeFlags.StringLiteral |
    TypeFlags.Number |
    TypeFlags.NumberLiteral |
    TypeFlags.BigInt |
    TypeFlags.BigIntLiteral;
  return (
    types.length > 0 &&
    types.every(
      (candidateType) =>
        !candidateType.isErrorType() &&
        !(
          candidateType.flags &
          (TypeFlags.Any |
            TypeFlags.Unknown |
            TypeFlags.Never |
            TypeFlags.Null |
            TypeFlags.Undefined |
            TypeFlags.TypeParameter)
        ) &&
        Boolean(candidateType.flags & allowedFlags),
    )
  );
}

/**
 * isSafeAggregateReadBinaryOperatorのTest準備責務を実行する。
 *
 * @responsibility isSafeAggregateReadBinaryOperatorがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isSafeAggregateReadBinaryOperatorを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isSafeAggregateReadBinaryOperator(kind: SyntaxKind): boolean {
  switch (kind) {
    case SyntaxKind.AmpersandAmpersandToken:
    case SyntaxKind.AmpersandToken:
    case SyntaxKind.AsteriskAsteriskToken:
    case SyntaxKind.AsteriskToken:
    case SyntaxKind.BarBarToken:
    case SyntaxKind.BarToken:
    case SyntaxKind.CaretToken:
    case SyntaxKind.EqualsEqualsEqualsToken:
    case SyntaxKind.EqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsToken:
    case SyntaxKind.GreaterThanEqualsToken:
    case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanToken:
    case SyntaxKind.LessThanEqualsToken:
    case SyntaxKind.LessThanLessThanToken:
    case SyntaxKind.LessThanToken:
    case SyntaxKind.MinusToken:
    case SyntaxKind.PercentToken:
    case SyntaxKind.PlusToken:
    case SyntaxKind.QuestionQuestionToken:
    case SyntaxKind.SlashToken:
      return true;
    default:
      return false;
  }
}

/**
 * isExportedVariableDeclarationのTest準備責務を実行する。
 *
 * @responsibility isExportedVariableDeclarationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isExportedVariableDeclarationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isExportedVariableDeclaration(
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  if (!isIdentifier(declaration.name)) return true;
  const variableStatement = declaration.parent?.parent;
  if (variableStatement?.kind === SyntaxKind.VariableStatement) {
    let hasExportModifier = false;
    variableStatement.forEachChild((child) => {
      if (child.kind === SyntaxKind.ExportKeyword) hasExportModifier = true;
    });
    if (hasExportModifier) return true;
  }
  const declarationSymbolId = resolvedSymbolId(declaration.name, checker);
  if (declarationSymbolId === null) return true;
  let isExported = false;
  let hasUnresolvedExport = false;
  for (const statement of declaration.getSourceFile().statements) {
    if (!isExportDeclaration(statement) && !isExportAssignment(statement))
      continue;
    const visit = (node: Node): void => {
      if (isExported) return;
      if (isIdentifier(node)) {
        const exportSymbolId = resolvedSymbolId(node, checker);
        if (exportSymbolId === null) hasUnresolvedExport = true;
        if (exportSymbolId === declarationSymbolId) isExported = true;
      }
      node.forEachChild(visit);
    };
    statement.forEachChild(visit);
  }
  return isExported || hasUnresolvedExport;
}

/**
 * aggregateReadUsageNodeのTest準備責務を実行する。
 *
 * @responsibility aggregateReadUsageNodeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus aggregateReadUsageNodeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function aggregateReadUsageNode(accessNode: Node): Node | null {
  let usageNode = accessNode;
  const visitedNodes = new Set<Node>();
  while (usageNode.parent) {
    if (visitedNodes.has(usageNode)) return null;
    visitedNodes.add(usageNode);
    const parent = usageNode.parent;
    if (
      (isParenthesizedExpression(parent) ||
        isAsExpression(parent) ||
        isSatisfiesExpression(parent) ||
        isNonNullExpression(parent)) &&
      parent.expression === usageNode
    ) {
      usageNode = parent;
      continue;
    }
    if (
      isBinaryExpression(parent) &&
      (parent.left === usageNode || parent.right === usageNode) &&
      isSafeAggregateReadBinaryOperator(parent.operatorToken.kind)
    ) {
      usageNode = parent;
      continue;
    }
    if (
      isTemplateSpan(parent) &&
      parent.expression === usageNode &&
      isTemplateExpression(parent.parent)
    ) {
      usageNode = parent.parent;
      continue;
    }
    break;
  }
  return usageNode;
}

/**
 * isAllowedAggregateReadContextのTest準備責務を実行する。
 *
 * @responsibility isAllowedAggregateReadContextがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isAllowedAggregateReadContextを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isAllowedAggregateReadContext(
  accessNode: Node,
  checker: Checker,
): boolean {
  const usageNode = aggregateReadUsageNode(accessNode);
  if (!usageNode) return false;
  const parent = usageNode.parent;
  if (!parent) return false;
  if (parent.kind === SyntaxKind.VoidExpression) return true;
  return (
    isVariableDeclaration(parent) &&
    isIdentifier(parent.name) &&
    parent.initializer === usageNode &&
    !isExportedVariableDeclaration(parent, checker)
  );
}

/**
 * isSafeDirectAggregateReadのTest準備責務を実行する。
 *
 * @responsibility isSafeDirectAggregateReadがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isSafeDirectAggregateReadを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isSafeDirectAggregateRead(
  identifier: Identifier,
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  type Segment = Readonly<
    | { kind: "property"; name: string }
    | { argument: Expression | undefined; kind: "index" }
  >;
  const segments: Segment[] = [];
  let accessNode: Node = identifier;
  while (accessNode.parent) {
    const parent = accessNode.parent;
    if (
      isPropertyAccessExpression(parent) &&
      parent.expression === accessNode
    ) {
      if (parent.questionDotToken) return false;
      segments.push({ kind: "property", name: parent.name.text });
      accessNode = parent;
      continue;
    }
    if (isElementAccessExpression(parent) && parent.expression === accessNode) {
      if (parent.questionDotToken) return false;
      segments.push({ argument: parent.argumentExpression, kind: "index" });
      accessNode = parent;
      continue;
    }
    break;
  }
  const accessType = checker.getTypeAtLocation(accessNode);
  if (
    segments.length === 0 ||
    !accessType ||
    !primitiveReadType(accessType) ||
    !isAllowedAggregateReadContext(accessNode, checker)
  )
    return false;
  const context: FixedInitializerContext = {
    activeSymbolIds: new Set(),
    checker,
    ownershipRoots: sourceOwnershipRoots,
    sourceFile: declaration.getSourceFile(),
  };
  const initialSeed = directAggregateSeed(declaration.initializer, context);
  if (!initialSeed) return false;
  let current: Expression = initialSeed;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) return false;
    if (isArrayLiteralExpression(current)) {
      if (
        segment.kind === "property" &&
        segment.name === "length" &&
        index === segments.length - 1
      ) {
        return true;
      }
      if (segment.kind !== "index") return false;
      const elementIndex = canonicalArrayIndex(segment.argument);
      const element: Expression | undefined =
        elementIndex === null ? undefined : current.elements[elementIndex];
      if (!element || element.kind === SyntaxKind.SpreadElement) return false;
      current = element;
    } else if (isObjectLiteralExpression(current)) {
      if (segment.kind !== "property" && segment.kind !== "index") return false;
      const key =
        segment.kind === "property"
          ? segment.name
          : segment.argument &&
              (isStringLiteral(segment.argument) ||
                segment.argument.kind === SyntaxKind.NumericLiteral)
            ? literalPropertyName(segment.argument)
            : null;
      if (!key || ["__proto__", "constructor", "prototype"].includes(key))
        return false;
      let matchingValue: Expression | null = null;
      let matchingCount = 0;
      for (const property of current.properties) {
        if (
          isPropertyAssignment(property) &&
          literalPropertyName(property.name) === key
        ) {
          matchingValue = property.initializer;
          matchingCount += 1;
        }
      }
      if (matchingCount !== 1 || !matchingValue) return false;
      current = matchingValue;
    } else {
      return false;
    }
    if (index < segments.length - 1) {
      const nestedSeed = directAggregateSeed(current, context);
      if (!nestedSeed) return false;
      current = nestedSeed;
    }
  }
  return isFixedInitializer(current, context);
}

/**
 * isFixedModuleConstantReferenceのTest準備責務を実行する。
 *
 * @responsibility isFixedModuleConstantReferenceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isFixedModuleConstantReferenceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isFixedModuleConstantReference(
  identifier: Identifier,
  context: FixedInitializerContext,
): boolean {
  const locatedSymbol = context.checker.getSymbolAtLocation(identifier);
  const symbol = locatedSymbol
    ? locatedSymbol.flags & SymbolFlags.Alias
      ? context.checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol
    : undefined;
  if (!symbol || context.activeSymbolIds.has(symbol.id)) return false;
  const declaration =
    symbol.valueDeclaration?.resolve() ?? symbol.declarations[0]?.resolve();
  if (!declaration || !isVariableDeclaration(declaration)) {
    return isGlobalIntrinsic(
      identifier,
      context.checker,
      FIXED_GLOBAL_INTRINSICS,
    );
  }
  const declarationSource = declaration.getSourceFile();
  const normalizedDeclarationSource = path.normalize(
    declarationSource.fileName,
  );
  if (!isOwnedProgramFile(normalizedDeclarationSource, context.ownershipRoots))
    return isGlobalIntrinsic(
      identifier,
      context.checker,
      FIXED_GLOBAL_INTRINSICS,
    );
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  if (
    declarationList.kind !== SyntaxKind.VariableDeclarationList ||
    !(declarationList.flags & NodeFlags.Const) ||
    variableStatement?.kind !== SyntaxKind.VariableStatement ||
    variableStatement.parent?.kind !== SyntaxKind.SourceFile ||
    isFunctionInitializer(declaration.initializer)
  ) {
    return false;
  }
  const referenceContext = {
    ...context,
    activeSymbolIds: new Set(context.activeSymbolIds).add(symbol.id),
    sourceFile: declarationSource,
  };
  const declarationInitializer = declaration.initializer;
  if (
    declarationInitializer &&
    (isArrayLiteralExpression(declarationInitializer) ||
      isObjectLiteralExpression(declarationInitializer))
  ) {
    return (
      isNonEscapingDirectAggregate(declaration, context.checker) &&
      isFixedAggregateMember(declarationInitializer, referenceContext)
    );
  }
  return isFixedInitializer(declaration.initializer, referenceContext);
}

/**
 * isOwnedFixedAggregateAccessのTest準備責務を実行する。
 *
 * @responsibility isOwnedFixedAggregateAccessがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isOwnedFixedAggregateAccessを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isOwnedFixedAggregateAccess(
  initializer: Expression,
  context: FixedInitializerContext,
): boolean {
  let root: Expression = initializer;
  while (isPropertyAccessExpression(root) || isElementAccessExpression(root)) {
    root = root.expression;
  }
  if (!isIdentifier(root)) return false;
  const locatedSymbol = context.checker.getSymbolAtLocation(root);
  const symbol = locatedSymbol
    ? locatedSymbol.flags & SymbolFlags.Alias
      ? context.checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol
    : undefined;
  const declaration =
    symbol?.valueDeclaration?.resolve() ?? symbol?.declarations[0]?.resolve();
  return Boolean(
    declaration &&
      isVariableDeclaration(declaration) &&
      directAggregateSeed(declaration.initializer, context) &&
      isSafeDirectAggregateRead(root, declaration, context.checker) &&
      isFixedModuleConstantReference(root, context),
  );
}

/**
 * isFixedCreateHashDigestのTest準備責務を実行する。
 *
 * @responsibility isFixedCreateHashDigestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isFixedCreateHashDigestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isFixedCreateHashDigest(
  initializer: Expression,
  context: FixedInitializerContext,
): boolean {
  if (!isCallExpression(initializer) || initializer.arguments.length !== 1)
    return false;
  const digestAccess = initializer.expression;
  if (
    !isPropertyAccessExpression(digestAccess) ||
    digestAccess.name.text !== "digest" ||
    !isFixedInitializer(initializer.arguments[0], context)
  )
    return false;
  const updateCall = digestAccess.expression;
  if (!isCallExpression(updateCall) || updateCall.arguments.length !== 1)
    return false;
  const updateAccess = updateCall.expression;
  if (
    !isPropertyAccessExpression(updateAccess) ||
    updateAccess.name.text !== "update" ||
    !isFixedInitializer(updateCall.arguments[0], context)
  )
    return false;
  const createCall = updateAccess.expression;
  return (
    isCallExpression(createCall) &&
    createCall.arguments.length === 1 &&
    isIdentifier(createCall.expression) &&
    isImportedCreateHash(createCall.expression, context.checker) &&
    isFixedInitializer(createCall.arguments[0], context)
  );
}

/**
 * isFixedInitializerのTest準備責務を実行する。
 *
 * @responsibility isFixedInitializerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isFixedInitializerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isFixedInitializer(
  initializer: Expression | undefined,
  context: FixedInitializerContext,
): boolean {
  if (!initializer) return false;
  if (
    initializer.kind === SyntaxKind.TrueKeyword ||
    initializer.kind === SyntaxKind.FalseKeyword ||
    initializer.kind === SyntaxKind.NullKeyword ||
    initializer.kind === SyntaxKind.NumericLiteral ||
    initializer.kind === SyntaxKind.BigIntLiteral ||
    isStringLiteral(initializer) ||
    isNoSubstitutionTemplateLiteral(initializer) ||
    isRegularExpressionLiteral(initializer)
  ) {
    return true;
  }
  if (
    isParenthesizedExpression(initializer) ||
    isAsExpression(initializer) ||
    isSatisfiesExpression(initializer) ||
    isNonNullExpression(initializer)
  ) {
    return isFixedInitializer(initializer.expression, context);
  }
  if (isIdentifier(initializer))
    return isFixedModuleConstantReference(initializer, context);
  if (isPropertyAccessExpression(initializer)) {
    if (
      initializer.getText() === "Date.now" ||
      initializer.getText() === "Date.prototype.toISOString"
    ) {
      const root =
        initializer.getText() === "Date.now"
          ? initializer.expression
          : isPropertyAccessExpression(initializer.expression)
            ? initializer.expression.expression
            : initializer.expression;
      return (
        isIdentifier(root) &&
        isGlobalIntrinsic(root, context.checker, FIXED_GLOBAL_INTRINSICS)
      );
    }
    if (
      initializer.name.text === "get" &&
      isCallExpression(initializer.expression) &&
      initializer.expression.arguments.length === 2 &&
      isGlobalPropertyAccess(
        initializer.expression.expression,
        "Object",
        "getOwnPropertyDescriptor",
        context.checker,
      )
    ) {
      return (
        isTypedArrayPrototypeSnapshot(
          initializer.expression.arguments[0],
          context.checker,
        ) && isFixedInitializer(initializer.expression.arguments[1], context)
      );
    }
    if (isOwnedFixedAggregateAccess(initializer, context)) return true;
    return false;
  }
  if (isElementAccessExpression(initializer))
    return isOwnedFixedAggregateAccess(initializer, context);
  if (isBinaryExpression(initializer)) {
    return (
      isFixedInitializer(initializer.left, context) &&
      isFixedInitializer(initializer.right, context)
    );
  }
  if (isTaggedTemplateExpression(initializer)) {
    return (
      isGlobalPropertyAccess(
        initializer.tag,
        "String",
        "raw",
        context.checker,
      ) &&
      (isNoSubstitutionTemplateLiteral(initializer.template) ||
        (isTemplateExpression(initializer.template) &&
          initializer.template.templateSpans.every((span) =>
            isFixedInitializer(span.expression, context),
          )))
    );
  }
  if (isTemplateExpression(initializer)) {
    return initializer.templateSpans.every((span) =>
      isFixedInitializer(span.expression, context),
    );
  }
  if (isNewExpression(initializer)) {
    return (
      isIdentifier(initializer.expression) &&
      isGlobalIntrinsic(
        initializer.expression,
        context.checker,
        new Set(["Set"]),
      ) &&
      initializer.arguments?.length === 1 &&
      isArrayLiteralExpression(initializer.arguments[0]) &&
      isFixedAggregateMember(initializer.arguments[0], context)
    );
  }
  if (isCallExpression(initializer)) {
    const callee = initializer.expression.getText();
    if (fixedFreezeSeed(initializer, context)) return true;
    if (
      isIdentifier(initializer.expression) &&
      isGlobalIntrinsic(
        initializer.expression,
        context.checker,
        FIXED_GLOBAL_CALLS,
      )
    ) {
      return (
        initializer.arguments.length <= 1 &&
        initializer.arguments.every((argument) =>
          isFixedInitializer(argument, context),
        )
      );
    }
    if (
      isGlobalPropertyAccess(
        initializer.expression,
        "JSON",
        "stringify",
        context.checker,
      )
    ) {
      return (
        initializer.arguments.length === 1 &&
        isFixedAggregateMember(initializer.arguments[0], context)
      );
    }
    if (callee.endsWith(".digest"))
      return isFixedCreateHashDigest(initializer, context);
  }
  return false;
}

/**
 * isModuleConstantのTest準備責務を実行する。
 *
 * @responsibility isModuleConstantがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isModuleConstantを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isModuleConstant(
  declaration: VariableDeclaration,
  checker: Checker,
  ownershipRoots: readonly string[] = sourceOwnershipRoots,
): boolean {
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  const isModuleScopeConst = Boolean(
    declarationList &&
      declarationList.kind === SyntaxKind.VariableDeclarationList &&
      declarationList.flags & NodeFlags.Const &&
      variableStatement?.kind === SyntaxKind.VariableStatement &&
      variableStatement.parent?.kind === SyntaxKind.SourceFile &&
      !isFunctionInitializer(declaration.initializer),
  );
  if (!isModuleScopeConst || !declaration.initializer) return false;
  const context = {
    activeSymbolIds: new Set<number>(),
    checker,
    ownershipRoots,
    sourceFile: declaration.getSourceFile(),
  };
  if (
    isArrayLiteralExpression(declaration.initializer) ||
    isObjectLiteralExpression(declaration.initializer)
  ) {
    return (
      isNonEscapingDirectAggregate(declaration, checker) &&
      isFixedAggregateMember(declaration.initializer, context)
    );
  }
  return isFixedInitializer(declaration.initializer, context);
}

/**
 * identifierLocationのTest準備責務を実行する。
 *
 * @responsibility identifierLocationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus identifierLocationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function identifierLocation(
  identifier: Identifier,
  kind: string,
  rule: string,
): NamingViolation {
  const sourceFile = identifier.getSourceFile();
  const location = sourceFile.getLineAndCharacterOfPosition(
    identifier.getStart(sourceFile),
  );
  return {
    column: location.character + 1,
    file: fs.realpathSync.native(sourceFile.fileName),
    kind,
    line: location.line + 1,
    name: identifier.text,
    rule,
  };
}

/**
 * isUnusedUnderscoreParameterのTest準備責務を実行する。
 *
 * @responsibility isUnusedUnderscoreParameterがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isUnusedUnderscoreParameterを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isUnusedUnderscoreParameter(
  identifier: Identifier,
  kind: string,
  checker: Checker,
): boolean {
  if (kind !== "parameter" || !/^_[a-z][A-Za-z0-9]*$/u.test(identifier.text))
    return false;
  const symbolId = resolvedSymbolId(identifier, checker);
  if (symbolId === null) return false;
  let referenceCount = 0;
  const visit = (node: Node): void => {
    if (isIdentifier(node) && resolvedSymbolId(node, checker) === symbolId)
      referenceCount += 1;
    node.forEachChild(visit);
  };
  visit(identifier.getSourceFile());
  return referenceCount === 1;
}

/**
 * inspectIdentifierのTest準備責務を実行する。
 *
 * @responsibility inspectIdentifierがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectIdentifierを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function inspectIdentifier(
  identifier: Identifier,
  kind: string,
  checker: Checker,
  isConstant: boolean,
): NamingViolation[] {
  const name = identifier.text;
  const violations: NamingViolation[] = [];
  if (isUnusedUnderscoreParameter(identifier, kind, checker)) return violations;
  if (FORBIDDEN_BARE_IDENTIFIERS.has(name)) {
    violations.push(
      identifierLocation(identifier, kind, "forbidden-bare-name"),
    );
  }
  if (isConstant) {
    if (!UPPER_SNAKE_CASE.test(name)) {
      violations.push(
        identifierLocation(identifier, kind, "true-constant-upper-snake-case"),
      );
    }
    return violations;
  }
  const type = checker.getTypeAtLocation(identifier);
  if (!type || type.isErrorType()) {
    violations.push(
      identifierLocation(identifier, kind, "type-classification-required"),
    );
    return violations;
  }
  if (isBooleanType(type)) {
    if (!isAllowedBooleanName(name)) {
      violations.push(identifierLocation(identifier, kind, "boolean-prefix"));
    }
    return violations;
  }
  if (isArrayType(type, checker)) {
    if (
      !CAMEL_CASE.test(name) ||
      (!PLURAL_NAME.test(name) &&
        !TECHNICAL_VECTOR_NAME.test(name) &&
        !STANDALONE_COLLECTIVE_NAME.test(name))
    ) {
      violations.push(
        identifierLocation(identifier, kind, "array-plural-camel-case"),
      );
    }
    return violations;
  }
  if (!CAMEL_CASE.test(name)) {
    violations.push(identifierLocation(identifier, kind, "camel-case"));
  }
  return violations;
}

/**
 * inspectBindingNameのTest準備責務を実行する。
 *
 * @responsibility inspectBindingNameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectBindingNameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function inspectBindingName(
  name: Node | undefined,
  kind: string,
  checker: Checker,
  isConstant = false,
): NamingViolation[] {
  if (!name) return [];
  if (isIdentifier(name))
    return inspectIdentifier(name, kind, checker, isConstant);
  const violations: NamingViolation[] = [];
  name.forEachChild((child) => {
    if (isBindingElement(child))
      violations.push(...inspectBindingName(child.name, "binding", checker));
  });
  return violations;
}

/**
 * isImplementationSourceFileのTest準備責務を実行する。
 *
 * @responsibility isImplementationSourceFileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isImplementationSourceFileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function isImplementationSourceFile(sourceFile: SourceFile): boolean {
  const normalized = path.normalize(sourceFile.fileName);
  const segments = normalized.split(path.sep);
  if (segments.includes("tests") || normalized.endsWith(".test.ts"))
    return false;
  return (
    segments.includes("src") ||
    segments.includes("bin") ||
    segments.includes("scripts") ||
    isContainedPath(normalized, path.join(repositoryRoot, "template", "tools"))
  );
}

/**
 * Production File Headerを検査する。
 *
 * @responsibility Production FileがFile単位の責務と実在Architectureを先頭で明示することを検査する。
 * @trace RCM-IT-005
 * @precondition Source Fileが検証済みRepository内のProduction母集団に属する。
 * @stimulus Production Fileの先頭Headerを解析する。
 * @observation Summary、責務、Architecture Traceの欠落または不正を取得する。
 * @oracle 実在ArchitectureへのFile Headerが完全な場合だけ違反0になる。
 * @cleanup N/A: Source FileおよびRepositoryを変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Production Source→Architecture Definition
 */
function inspectProductionFileHeader(
  sourceFile: SourceFile,
): NamingViolation[] {
  if (!isImplementationSourceFile(sourceFile)) return [];
  const header =
    sourceFile.text.match(
      /^\uFEFF?(?:#![^\r\n]*(?:\r?\n))?\s*\/\*\*[\s\S]*?\*\//u,
    )?.[0] ?? "";
  const fileName = path.basename(sourceFile.fileName);
  const violation = (rule: string): NamingViolation => ({
    column: 1,
    file: fs.realpathSync.native(sourceFile.fileName),
    kind: "file",
    line: 1,
    name: fileName,
    rule,
  });
  const summary = header
    .replace(/^\uFEFF?(?:#![^\r\n]*(?:\r?\n))?\s*\/\*\*\s*/u, "")
    .replace(/\*\/\s*$/u, "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
    .find((line) => line.length > 0 && !line.startsWith("@"));
  const violations: NamingViolation[] = [];
  if (!summary) violations.push(violation("file-header-summary-missing"));
  if (responsibilityHeaderTagValue(header, "responsibility") === null)
    violations.push(violation("file-header-responsibility-missing"));
  const traceValues = [
    ...header.matchAll(/^\s*\*\s+@trace\s+(\S(?:.*\S)?)\s*$/gmu),
  ].map((match) => match[1] ?? "");
  if (traceValues.length === 0)
    violations.push(violation("file-header-architecture-trace-missing"));
  for (const traceValue of traceValues) {
    if (!ARCHITECTURE_ID.test(traceValue)) {
      violations.push(
        violation("file-header-architecture-trace-format-invalid"),
      );
      continue;
    }
    if (!canonicalArchitectureIds.has(traceValue))
      violations.push(violation("file-header-architecture-trace-not-found"));
  }
  return violations;
}

/**
 * responsibilityHeaderTagValueのTest準備責務を実行する。
 *
 * @responsibility responsibilityHeaderTagValueがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus responsibilityHeaderTagValueを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function responsibilityHeaderTagValue(
  header: string,
  tag: string,
): string | null {
  const match = new RegExp(
    `^\\s*\\*\\s+@${tag}\\s+(\\S(?:.*\\S)?)\\s*$`,
    "mu",
  ).exec(header);
  return match?.[1] ?? null;
}

/**
 * inspectResponsibilityHeaderのTest準備責務を実行する。
 *
 * @responsibility inspectResponsibilityHeaderがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectResponsibilityHeaderを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function inspectResponsibilityHeader(
  node: Node,
  name: Identifier,
  declarationKind: string,
): NamingViolation[] {
  const sourceFile = node.getSourceFile();
  if (!isImplementationSourceFile(sourceFile)) return [];
  const leadingText = sourceFile.text.slice(
    node.getFullStart(),
    node.getStart(sourceFile),
  );
  const header = leadingText.match(/\/\*\*[\s\S]*?\*\/\s*$/u)?.[0] ?? "";
  const summary = header
    .replace(/^\/\*\*\s*/u, "")
    .replace(/\*\/\s*$/u, "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
    .find((line) => line.length > 0 && !line.startsWith("@"));
  const violations: NamingViolation[] = [];
  if (!summary)
    violations.push(
      identifierLocation(
        name,
        declarationKind,
        "responsibility-header-summary-missing",
      ),
    );
  const responsibility = responsibilityHeaderTagValue(header, "responsibility");
  if (responsibility === null)
    violations.push(
      identifierLocation(
        name,
        declarationKind,
        "responsibility-header-tag-missing",
      ),
    );
  const cyclicSummaries = new Set([
    `${name.text}の処理を実行する。`,
    `${name.text}が扱う値の構造を表す。`,
  ]);
  const cyclicResponsibilities = new Set([
    `${name.text}に対応する入力処理と結果生成を所有する。`,
    `${name.text}に必要な値と制約を一つの型契約として保持する。`,
  ]);
  if (summary && cyclicSummaries.has(summary))
    violations.push(
      identifierLocation(
        name,
        declarationKind,
        "responsibility-header-summary-cyclic",
      ),
    );
  if (responsibility && cyclicResponsibilities.has(responsibility))
    violations.push(
      identifierLocation(
        name,
        declarationKind,
        "responsibility-header-tag-cyclic",
      ),
    );
  const requiredTags =
    declarationKind === "type"
      ? REQUIRED_TYPE_HEADER_TAGS
      : declarationKind === "class"
        ? REQUIRED_CLASS_HEADER_TAGS
        : REQUIRED_EXECUTABLE_HEADER_TAGS;
  for (const requiredTag of requiredTags) {
    const tagValue = responsibilityHeaderTagValue(header, requiredTag);
    if (tagValue === null) {
      violations.push(
        identifierLocation(
          name,
          declarationKind,
          `responsibility-header-${requiredTag}-missing`,
        ),
      );
      continue;
    }
    if (/^N\/A\b/u.test(tagValue) && !/^N\/A:\s+\S/u.test(tagValue))
      violations.push(
        identifierLocation(
          name,
          declarationKind,
          `responsibility-header-${requiredTag}-na-reason-missing`,
        ),
      );
  }
  const traceValues = [
    ...header.matchAll(/^\s*\*\s+@trace\s+(\S(?:.*\S)?)\s*$/gmu),
  ].map((match) => match[1] ?? "");
  if (traceValues.length === 0) {
    violations.push(
      identifierLocation(name, declarationKind, "architecture-trace-missing"),
    );
  }
  for (const traceValue of traceValues) {
    if (!ARCHITECTURE_ID.test(traceValue)) {
      violations.push(
        identifierLocation(
          name,
          declarationKind,
          "architecture-trace-format-invalid",
        ),
      );
      continue;
    }
    if (!canonicalArchitectureIds.has(traceValue))
      violations.push(
        identifierLocation(
          name,
          declarationKind,
          "architecture-trace-not-found",
        ),
      );
  }
  return violations;
}

/**
 * inspectSourceFileのTest準備責務を実行する。
 *
 * @responsibility inspectSourceFileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectSourceFileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function inspectSourceFile(
  sourceFile: SourceFile,
  checker: Checker,
  ownershipRoots: readonly string[] = sourceOwnershipRoots,
): NamingViolation[] {
  const violations: NamingViolation[] = [
    ...inspectProductionFileHeader(sourceFile),
  ];
  const visit = (node: Node): void => {
    if (isInterfaceDeclaration(node) || isTypeAliasDeclaration(node)) {
      if (node.name) {
        if (!PASCAL_CASE.test(node.name.text)) {
          violations.push(identifierLocation(node.name, "type", "pascal-case"));
        }
        violations.push(
          ...inspectResponsibilityHeader(node, node.name, "type"),
        );
      }
    } else if (isClassDeclaration(node) || isClassExpression(node)) {
      if (node.name) {
        if (!PASCAL_CASE.test(node.name.text))
          violations.push(
            identifierLocation(node.name, "class", "pascal-case"),
          );
        violations.push(
          ...inspectResponsibilityHeader(node, node.name, "class"),
        );
      }
    } else if (isFunctionDeclaration(node) || isFunctionExpression(node)) {
      if (node.name) {
        if (!CAMEL_CASE.test(node.name.text)) {
          violations.push(
            identifierLocation(node.name, "function", "camel-case"),
          );
        }
        if (FORBIDDEN_BARE_IDENTIFIERS.has(node.name.text)) {
          violations.push(
            identifierLocation(node.name, "function", "forbidden-bare-name"),
          );
        }
        violations.push(
          ...inspectResponsibilityHeader(node, node.name, "function"),
        );
      }
    } else if (
      (isMethodDeclaration(node) ||
        isGetAccessorDeclaration(node) ||
        isSetAccessorDeclaration(node)) &&
      isIdentifier(node.name)
    ) {
      const isExternalOverride = node.modifiers?.some(
        (modifier) => modifier.kind === SyntaxKind.OverrideKeyword,
      );
      if (isExternalOverride) {
        node.forEachChild(visit);
        return;
      }
      const declarationKind = isMethodDeclaration(node)
        ? "method"
        : isGetAccessorDeclaration(node)
          ? "getter"
          : "setter";
      if (!CAMEL_CASE.test(node.name.text)) {
        violations.push(
          identifierLocation(node.name, declarationKind, "camel-case"),
        );
      }
      if (FORBIDDEN_BARE_IDENTIFIERS.has(node.name.text)) {
        violations.push(
          identifierLocation(node.name, declarationKind, "forbidden-bare-name"),
        );
      }
      violations.push(
        ...inspectResponsibilityHeader(node, node.name, declarationKind),
      );
    } else if (isVariableDeclaration(node)) {
      violations.push(
        ...inspectBindingName(
          node.name,
          "variable",
          checker,
          isModuleConstant(node, checker, ownershipRoots),
        ),
      );
    } else if (isParameterDeclaration(node)) {
      violations.push(...inspectBindingName(node.name, "parameter", checker));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return violations;
}

/**
 * collectOwnedProjectsのTest準備責務を実行する。
 *
 * @responsibility collectOwnedProjectsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectOwnedProjectsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function collectOwnedProjects(
  api: API,
  configs: readonly string[],
): {
  projects: readonly Project[];
  snapshot: ReturnType<API["updateSnapshot"]>;
} {
  for (const config of configs)
    assert.equal(fs.existsSync(config), true, config);
  const snapshot = api.updateSnapshot({ openProjects: [...configs] });
  const discoveredProjects = snapshot.getProjects();
  assert.equal(
    discoveredProjects.length,
    configs.length,
    "all TypeScript projects must load",
  );
  const projectsByConfig = new Map(
    discoveredProjects.map((project) => [
      path.normalize(project.configFileName).toLowerCase(),
      project,
    ]),
  );
  const projects = configs.map((config) => {
    const project = projectsByConfig.get(path.normalize(config).toLowerCase());
    assert.ok(project, `TypeScript project unavailable: ${config}`);
    return project;
  });
  return { projects, snapshot };
}

/**
 * inspectProjectsのTest準備責務を実行する。
 *
 * @responsibility inspectProjectsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectProjectsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function inspectProjects(projects: readonly Project[]): {
  sourceFiles: ReadonlyMap<string, SourceFile>;
  violations: readonly NamingViolation[];
} {
  const sourceFiles = new Map<string, SourceFile>();
  const checkers = new Map<string, Checker>();
  for (const project of projects) {
    for (const file of project.program.getSourceFileNames()) {
      const normalizedFile = path.normalize(file);
      if (!isOwnedProgramFile(normalizedFile)) continue;
      const resolvedFile = resolveOwnedSource(normalizedFile);
      const sourceFile = project.program.getSourceFile(file);
      assert.ok(sourceFile, `source unavailable: ${file}`);
      sourceFiles.set(resolvedFile, sourceFile);
      checkers.set(resolvedFile, project.checker);
    }
  }
  const violations = [...sourceFiles.entries()].flatMap(
    ([file, sourceFile]) => {
      const checker = checkers.get(file);
      assert.ok(checker, `checker unavailable: ${file}`);
      return inspectSourceFile(sourceFile, checker);
    },
  );
  return { sourceFiles, violations };
}

/**
 * collectOwnedTypeScriptPathsのTest準備責務を実行する。
 *
 * @responsibility collectOwnedTypeScriptPathsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectOwnedTypeScriptPathsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function collectOwnedTypeScriptPaths(files: readonly string[]): Set<string> {
  return new Set(
    files
      .filter(
        (file) =>
          file.endsWith(".ts") &&
          !file.endsWith(".d.ts") &&
          isOwnedProgramFile(file),
      )
      .map(resolveOwnedSource),
  );
}

/**
 * collectOwnedRustPathsのTest準備責務を実行する。
 *
 * @responsibility collectOwnedRustPathsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus collectOwnedRustPathsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function collectOwnedRustPaths(files: readonly string[]): Set<string> {
  return new Set(
    files
      .filter((file) => file.endsWith(".rs"))
      .map((file) => fs.realpathSync.native(file)),
  );
}

/**
 * Rust Production FileとNamed Symbolの責務Headerを検査する。
 *
 * @responsibility TypeScript AST検査から漏れていたprivate Rust crateを、同じArchitecture Trace契約へ接続する。
 * @trace RCM-IT-005
 * @precondition rustSourceFileは検証済みRepository内の実Fileである。
 * @stimulus Rustdoc module Headerと宣言直前のRustdocを解析する。
 * @observation Summary、固定tag、N/A理由およびArchitecture Traceの違反を取得する。
 * @oracle 全Production Rust FileとNamed Symbolが宣言種別に応じたHeaderを持つ場合だけ違反0になる。
 * @cleanup N/A: Rust sourceとRepositoryを変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Rust Production Source→Architecture Definition
 */
function inspectRustProductionHeaders(
  rustSourceFile: string,
): NamingViolation[] {
  const normalized = path.normalize(rustSourceFile);
  if (
    normalized.includes(`${path.sep}tests${path.sep}`) ||
    (!normalized.includes(`${path.sep}src${path.sep}`) &&
      path.basename(normalized) !== "build.rs")
  ) {
    return [];
  }
  const text = fs.readFileSync(normalized, "utf8");
  const lines = text.split(/\r?\n/u);
  const violations: NamingViolation[] = [];
  const violation = (
    line: number,
    kind: string,
    name: string,
    rule: string,
  ): NamingViolation => ({
    column: 1,
    file: fs.realpathSync.native(normalized),
    kind,
    line,
    name,
    rule,
  });
  const moduleDocumentationLines = lines
    .filter((line, index) => index < 20 && /^\s*\/\/!/u.test(line))
    .map((line) => line.replace(/^\s*\/\/!\s?/u, ""));
  const moduleSummary = moduleDocumentationLines.find(
    (line) => line.trim().length > 0 && !line.trim().startsWith("@"),
  );
  if (!moduleSummary)
    violations.push(
      violation(
        1,
        "rust-file",
        path.basename(normalized),
        "file-header-summary-missing",
      ),
    );
  const inspectRustTags = (
    documentationLines: readonly string[],
    requiredTags: readonly string[],
    line: number,
    kind: string,
    name: string,
  ): void => {
    for (const tag of requiredTags) {
      const values = documentationLines
        .map(
          (entry) =>
            new RegExp(`^\\s*@${tag}\\s+(\\S(?:.*\\S)?)\\s*$`, "u").exec(
              entry,
            )?.[1],
        )
        .filter((value): value is string => Boolean(value));
      if (values.length === 0) {
        violations.push(
          violation(line, kind, name, `responsibility-header-${tag}-missing`),
        );
        continue;
      }
      for (const value of values) {
        if (/^N\/A\b/u.test(value) && !/^N\/A:\s+\S/u.test(value))
          violations.push(
            violation(
              line,
              kind,
              name,
              `responsibility-header-${tag}-na-reason-missing`,
            ),
          );
        if (tag === "trace") {
          if (!ARCHITECTURE_ID.test(value))
            violations.push(
              violation(line, kind, name, "architecture-trace-format-invalid"),
            );
          else if (!canonicalArchitectureIds.has(value))
            violations.push(
              violation(line, kind, name, "architecture-trace-not-found"),
            );
        }
      }
    }
  };
  inspectRustTags(
    moduleDocumentationLines,
    ["responsibility", "trace"],
    1,
    "rust-file",
    path.basename(normalized),
  );
  const declaration =
    /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:(?:unsafe|async)\s+)*(fn|struct|enum|trait|type)\s+([A-Za-z_][A-Za-z0-9_]*)/u;
  let isTestModulePending = false;
  let testModuleDepth = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index] ?? "";
    if (/^\s*#\[cfg\(test\)\]\s*$/u.test(lineText)) {
      isTestModulePending = true;
      continue;
    }
    if (
      isTestModulePending &&
      /^\s*mod\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/u.test(lineText)
    ) {
      testModuleDepth = 1;
      isTestModulePending = false;
      continue;
    }
    if (testModuleDepth > 0) {
      testModuleDepth += (lineText.match(/\{/gu) ?? []).length;
      testModuleDepth -= (lineText.match(/\}/gu) ?? []).length;
      continue;
    }
    isTestModulePending = false;
    const match = declaration.exec(lineText);
    if (!match) continue;
    const declarationType = match[1] ?? "";
    const name = match[2] ?? "";
    let cursor = index - 1;
    while (cursor >= 0 && /^\s*#\[/u.test(lines[cursor] ?? "")) cursor -= 1;
    const documentationLines: string[] = [];
    while (cursor >= 0 && /^\s*\/\//u.test(lines[cursor] ?? "")) {
      documentationLines.unshift(
        (lines[cursor] ?? "").replace(/^\s*\/\/\/\s?/u, ""),
      );
      cursor -= 1;
    }
    const summary = documentationLines.find(
      (entry) => entry.trim().length > 0 && !entry.trim().startsWith("@"),
    );
    const kind = declarationType === "fn" ? "rust-function" : "rust-type";
    if (!summary)
      violations.push(
        violation(
          index + 1,
          kind,
          name,
          "responsibility-header-summary-missing",
        ),
      );
    inspectRustTags(
      documentationLines,
      declarationType === "fn"
        ? ["responsibility", "trace", ...REQUIRED_EXECUTABLE_HEADER_TAGS]
        : ["responsibility", "trace", ...REQUIRED_TYPE_HEADER_TAGS],
      index + 1,
      kind,
      name,
    );
  }
  return violations;
}

/**
 * formatViolationsのTest準備責務を実行する。
 *
 * @responsibility formatViolationsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus formatViolationsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function formatViolations(violations: readonly NamingViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${path.relative(repositoryRoot, violation.file)}:${violation.line}:${violation.column} ${violation.kind} ${violation.name} ${violation.rule}`,
    )
    .join("\n");
}

/**
 * 内部実装のPathと型付きsource identifierは内部コーディング規約へ一致するを検証する。
 *
 * @responsibility 内部実装のPathと型付きsource identifierは内部コーディング規約へ一致するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 内部実装のPathと型付きsource identifierは内部コーディング規約へ一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("内部実装のPathと型付きsource identifierは内部コーディング規約へ一致する", () => {
  const files = pathInspectionRoots.flatMap(collectFiles);
  for (const file of files) assertFileName(file);
  const codingStandards = fs.lstatSync(
    path.join(repositoryRoot, "06_Architecture", "99_Coding_Standards.md"),
  );
  assert.ok(codingStandards.isFile() && !codingStandards.isSymbolicLink());
  const api = new API({ cwd: checkerRoot });
  try {
    const { projects, snapshot } = collectOwnedProjects(api, projectConfigs);
    try {
      const checkerFiles = projects[0]?.program
        .getSourceFileNames()
        .filter(
          (file) =>
            isOwnedProgramFile(file) &&
            (isContainedPath(
              file,
              path.join(repositoryRoot, "40_Develop", "checker"),
            ) ||
              isContainedPath(
                file,
                path.join(repositoryRoot, "template", "tools"),
              )),
        );
      assert.ok(checkerFiles, "checker TypeScript project must be available");
      const projectCheckerTests =
        checkerFiles
          ?.filter(
            (file) =>
              file.endsWith(".test.ts") && isContainedPath(file, checkerRoot),
          )
          .map(resolveOwnedSource) ?? [];
      assertExactCheckerTestPopulation(
        discoverCheckerTestFiles(checkerRoot),
        projectCheckerTests,
      );
      const { sourceFiles, violations } = inspectProjects(projects);
      const pathSourceFiles = collectOwnedTypeScriptPaths(files);
      assert.ok(
        pathSourceFiles.size > 0,
        "owned TypeScript population is empty",
      );
      assert.deepEqual(
        [...sourceFiles.keys()].sort(),
        [...pathSourceFiles].sort(),
        "every owned TypeScript Path must belong to an inspected project and vice versa",
      );
      const rustSourceFiles = collectOwnedRustPaths(files);
      assert.ok(rustSourceFiles.size > 0, "owned Rust population is empty");
      const rustSourceRoots = [
        path.join(repositoryRoot, "40_Develop", "platform-access", "src"),
        path.join(repositoryRoot, "40_Develop", "platform-access", "tests"),
      ];
      const rustBuildScript = path.join(
        repositoryRoot,
        "40_Develop",
        "platform-access",
        "build.rs",
      );
      const rustHeaderViolations: NamingViolation[] = [];
      for (const rustSourceFile of rustSourceFiles) {
        assert.ok(
          rustSourceFile === rustBuildScript ||
            rustSourceRoots.some((root) =>
              isContainedPath(rustSourceFile, root),
            ),
          `Rust source outside private platform-access crate: ${rustSourceFile}`,
        );
        rustHeaderViolations.push(
          ...inspectRustProductionHeaders(rustSourceFile),
        );
      }
      const allViolations = [...violations, ...rustHeaderViolations];
      assert.equal(allViolations.length, 0, formatViolations(allViolations));
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});

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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("40_Develop配下のREADMEを拒否し、説明の正本分離を維持する", () => {
  assert.throws(
    () =>
      assertFileName(
        path.join(repositoryRoot, "40_Develop", "example", "README.md"),
      ),
    /40_Develop must not contain README\.md/u,
  );
  assert.doesNotThrow(() =>
    assertFileName(path.join(repositoryRoot, "README.md")),
  );
});

/**
 * Source Fileは曖昧な責務名と裸のtypesを使用しないを検証する。
 *
 * @responsibility Source Fileは曖昧な責務名と裸のtypesを使用しないの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Source Fileは曖昧な責務名と裸のtypesを使用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("Source Fileは曖昧な責務名と裸のtypesを使用しない", () => {
  for (const validName of [
    "runtime-state-model.ts",
    "provider-types.ts",
    "runtime-state-store.ts",
    "provider-selection-policy.ts",
    "git-adapter.ts",
    "runtime-context-factory.ts",
    "checker-pipeline.ts",
    "semantic-coverage.ts",
  ])
    assert.doesNotThrow(() =>
      assertFileName(
        path.join(repositoryRoot, "40_Develop", "sample", "src", validName),
      ),
    );
  for (const invalidName of [
    "types.ts",
    "runtime-utils.ts",
    "runtime-helper.ts",
    "runtime-common.ts",
    "runtime-manager.ts",
  ])
    assert.throws(
      () =>
        assertFileName(
          path.join(repositoryRoot, "40_Develop", "sample", "src", invalidName),
        ),
      /must express its owned responsibility|must include its responsibility/u,
    );
});

/**
 * Production Named Symbolは責務Headerと実在ARCH-IDへ接続するを検証する。
 *
 * @responsibility Production Named Symbolは責務Headerと実在ARCH-IDへ接続するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Production Named Symbolは責務Headerと実在ARCH-IDへ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("Production Named Symbolは責務Headerと実在ARCH-IDへ接続する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-header-"),
  );
  try {
    const sourceRoot = path.join(temporaryRoot, "src");
    fs.mkdirSync(sourceRoot);
    const sourcePath = path.join(sourceRoot, "production-header.ts");
    const configPath = path.join(temporaryRoot, "tsconfig.json");
    const completeHeader = (
      summary: string,
      responsibility: string,
      trace: string,
      omittedTag?: string,
      overrides: Readonly<Record<string, string>> = {},
    ): string[] => {
      const tags: Readonly<Record<string, string>> = {
        responsibility,
        trace,
        input: "N/A: 引数を持たない。",
        returns: "N/A: 戻り値を持たない。",
        precondition: "N/A: 呼出し前提を持たない。",
        postcondition: "呼出し後も共有状態を変更しない。",
        effect: "N/A: 局所計算だけを行う。",
        failure: "N/A: 区別して返す失敗を持たない。",
        invariant: "Repository状態を変更しない。",
        boundary: "N/A: 外部境界を持たない。",
        security: "N/A: Authorityまたは秘密を扱わない。",
        concurrency: "N/A: 同期局所処理である。",
        ...overrides,
      };
      return [
        "/**",
        ...(summary.length > 0 ? [` * ${summary}`, " *"] : []),
        ...["responsibility", "trace", ...REQUIRED_EXECUTABLE_HEADER_TAGS]
          .filter((tag) => tag !== omittedTag)
          .map((tag) => ` * @${tag} ${tags[tag]}`),
        " */",
      ];
    };
    fs.writeFileSync(
      sourcePath,
      [
        "/**",
        " * Production Header検査fixtureをまとめる。",
        " *",
        " * @responsibility Production Named Symbol Headerの正例と反例を同じFileで提供する。",
        " * @trace ARCH-000001",
        " */",
        ...completeHeader(
          "有効な責務を表す。",
          "有効なProduction責務を所有する。",
          "ARCH-000001",
        ),
        "function validResponsibility(): void {}",
        ...completeHeader("", "Summaryを欠く。", "ARCH-000001"),
        "function missingSummary(): void {}",
        ...completeHeader(
          "Responsibility tagを欠く。",
          "削除される値。",
          "ARCH-000001",
          "responsibility",
        ),
        "function missingResponsibility(): void {}",
        ...completeHeader(
          "Traceを欠く。",
          "Architecture接続を欠く。",
          "ARCH-000001",
          "trace",
        ),
        "function missingTrace(): void {}",
        ...completeHeader(
          "Trace形式が不正である。",
          "Architecture ID以外を使用する。",
          "artifact-signing.signature-component",
        ),
        "function invalidTrace(): void {}",
        ...completeHeader(
          "未定義のArchitectureへ接続する。",
          "存在しないArchitecture IDを使用する。",
          "ARCH-999999",
        ),
        "function unknownTrace(): void {}",
        ...completeHeader(
          "理由のないN/Aを使用する。",
          "非該当理由の形式を検証する。",
          "ARCH-000001",
          undefined,
          { effect: "N/A" },
        ),
        "function invalidNotApplicableReason(): void {}",
        ...completeHeader(
          "cyclicResponsibilityの処理を実行する。",
          "cyclicResponsibilityに対応する入力処理と結果生成を所有する。",
          "ARCH-000001",
        ),
        "function cyclicResponsibility(): void {}",
        "/**",
        " * 有効な型契約を表す。",
        " *",
        " * @responsibility 値の構造と制約を所有する。",
        " * @trace ARCH-000001",
        " * @shape value Propertyを持つ。",
        " * @invariant valueを省略しない。",
        " * @boundary N/A: Process内の値契約である。",
        " * @security N/A: Authorityまたは秘密を扱わない。",
        " * @compatibility value Propertyを互換境界として維持する。",
        " */",
        "interface ValidTypeContract { readonly value: string }",
        "/**",
        " * 互換性評価を欠く型契約を表す。",
        " *",
        " * @responsibility 値の構造と制約を所有する。",
        " * @trace ARCH-000001",
        " * @shape value Propertyを持つ。",
        " * @invariant valueを省略しない。",
        " * @boundary N/A: Process内の値契約である。",
        " * @security N/A: Authorityまたは秘密を扱わない。",
        " */",
        "type MissingTypeCompatibility = Readonly<{ value: string }> ;",
        "/**",
        " * 有効な状態所有境界を表す。",
        " *",
        " * @responsibility InstanceのLifecycleを所有する。",
        " * @trace ARCH-000001",
        " * @construction 初期値なしで生成する。",
        " * @lifecycle 生成から破棄まで共有資源を持たない。",
        " * @effect N/A: 外部または共有Effectを発行しない。",
        " * @failure N/A: 生成時失敗を持たない。",
        " * @invariant 共有状態を保持しない。",
        " * @boundary N/A: Process内で完結する。",
        " * @security N/A: Authorityまたは秘密を扱わない。",
        " * @concurrency N/A: 共有非同期状態を持たない。",
        " */",
        "class ValidStateOwner {}",
        "void validResponsibility;",
        "void missingSummary;",
        "void missingResponsibility;",
        "void missingTrace;",
        "void invalidTrace;",
        "void unknownTrace;",
        "void invalidNotApplicableReason;",
        "void cyclicResponsibility;",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          target: "ESNext",
        },
        files: [sourcePath],
      }),
      "utf8",
    );
    const api = new API({ cwd: checkerRoot });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [configPath] });
      try {
        const project = snapshot.getProjects()[0];
        assert.ok(project);
        const sourceFile = project.program.getSourceFile(sourcePath);
        assert.ok(sourceFile);
        const violations = inspectSourceFile(sourceFile, project.checker, [
          temporaryRoot,
        ]);
        assert.deepEqual(
          violations.filter((violation) => violation.kind === "file"),
          [],
        );
        const rulesByName = new Map<string, string[]>();
        for (const violation of violations) {
          const rules = rulesByName.get(violation.name) ?? [];
          rules.push(violation.rule);
          rulesByName.set(violation.name, rules);
        }
        assert.deepEqual(rulesByName.get("validResponsibility") ?? [], []);
        assert.deepEqual(rulesByName.get("missingSummary"), [
          "responsibility-header-summary-missing",
        ]);
        assert.deepEqual(rulesByName.get("missingResponsibility"), [
          "responsibility-header-tag-missing",
        ]);
        assert.deepEqual(rulesByName.get("missingTrace"), [
          "architecture-trace-missing",
        ]);
        assert.deepEqual(rulesByName.get("invalidTrace"), [
          "architecture-trace-format-invalid",
        ]);
        assert.deepEqual(rulesByName.get("unknownTrace"), [
          "architecture-trace-not-found",
        ]);
        assert.deepEqual(rulesByName.get("invalidNotApplicableReason"), [
          "responsibility-header-effect-na-reason-missing",
        ]);
        assert.deepEqual(rulesByName.get("cyclicResponsibility"), [
          "responsibility-header-summary-cyclic",
          "responsibility-header-tag-cyclic",
        ]);
        assert.deepEqual(rulesByName.get("ValidTypeContract") ?? [], []);
        assert.deepEqual(rulesByName.get("MissingTypeCompatibility"), [
          "responsibility-header-compatibility-missing",
        ]);
        assert.deepEqual(rulesByName.get("ValidStateOwner") ?? [], []);
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

/**
 * 公開indexは設計由来の説明と明示的なExport Allowlistを持つを検証する。
 *
 * @responsibility 公開indexは設計由来の説明と明示的なExport Allowlistを持つの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開indexは設計由来の説明と明示的なExport Allowlistを持つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("公開indexは設計由来の説明と明示的なExport Allowlistを持つ", () => {
  const publicIndexes = collectPublicIndexFiles()
    .map((file) =>
      path.relative(repositoryRoot, file).replaceAll(path.sep, "/"),
    )
    .sort();
  const declaredIndexes = PUBLIC_INDEX_PROFILES.map(
    (profile) => profile.relativePath,
  ).sort();
  assert.deepEqual(publicIndexes, declaredIndexes, "public index population");
  for (const profile of PUBLIC_INDEX_PROFILES)
    assertPublicIndexContract(
      path.join(repositoryRoot, ...profile.relativePath.split("/")),
      profile,
    );

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-index-"));
  try {
    const invalidIndex = path.join(temporaryRoot, "index.ts");
    fs.writeFileSync(
      invalidIndex,
      `/**\n * Public boundary.\n * @packageDocumentation\n * @responsibility Example boundary.\n * @trace ARCH-000001\n */\nexport * from "./implementation.ts";\n`,
      "utf8",
    );
    assert.throws(
      () =>
        assertPublicIndexContract(invalidIndex, {
          relativePath: "index.ts",
          expectedTrace: "ARCH-000001",
          requiredTags: [],
          exportedModules: ["./implementation.ts"],
        }),
      /explicit export allowlist/u,
    );
    fs.writeFileSync(
      invalidIndex,
      'export { value } from "./value.ts";\n',
      "utf8",
    );
    assert.throws(
      () =>
        assertPublicIndexContract(invalidIndex, {
          relativePath: "index.ts",
          expectedTrace: "ARCH-000001",
          requiredTags: [],
          exportedModules: ["./value.ts"],
        }),
      /package documentation/u,
    );
    fs.writeFileSync(
      invalidIndex,
      `/**\n * Boundary.\n * @packageDocumentation\n * @responsibility Boundary.\n * @trace ARCH-999999\n */\nexport { value } from "./value.ts";\n`,
      "utf8",
    );
    assert.throws(
      () =>
        assertPublicIndexContract(invalidIndex, {
          relativePath: "index.ts",
          expectedTrace: "ARCH-000001",
          requiredTags: [],
          exportedModules: ["./value.ts"],
        }),
      /package trace/u,
    );
    for (const invalidTrace of [
      "ARCH-000001-extra",
      "ARCH-000001 ARCH-999999",
    ]) {
      fs.writeFileSync(
        invalidIndex,
        `/**\n * Boundary.\n * @packageDocumentation\n * @responsibility Boundary.\n * @trace ${invalidTrace}\n */\nexport { value } from "./value.ts";\n`,
        "utf8",
      );
      assert.throws(
        () =>
          assertPublicIndexContract(invalidIndex, {
            relativePath: "index.ts",
            expectedTrace: "ARCH-000001",
            requiredTags: [],
            exportedModules: ["./value.ts"],
          }),
        /package trace contract/u,
      );
    }
    fs.writeFileSync(
      invalidIndex,
      `/**\n * Boundary.\n * @packageDocumentation\n * @responsibility Boundary.\n * @trace ARCH-000001\n */\nexport { value } from "./security/private.ts";\n`,
      "utf8",
    );
    assert.throws(
      () =>
        assertPublicIndexContract(invalidIndex, {
          relativePath: "index.ts",
          expectedTrace: "ARCH-000001",
          requiredTags: [],
          exportedModules: ["./value.ts"],
        }),
      /public export module allowlist/u,
    );
    fs.writeFileSync(
      invalidIndex,
      `/**\n * Boundary.\n * @packageDocumentation\n * @responsibility Boundary.\n * @trace ARCH-000001\n */\nexport * as hidden from "./hidden.ts";\n`,
      "utf8",
    );
    assert.throws(
      () =>
        assertPublicIndexContract(invalidIndex, {
          relativePath: "index.ts",
          expectedTrace: "ARCH-000001",
          requiredTags: [],
          exportedModules: ["./hidden.ts"],
          namespaceExports: { hidden: "./expected.ts" },
        }),
      /namespace export contract/u,
    );
    fs.writeFileSync(
      invalidIndex,
      `/**\n * Boundary.\n * @packageDocumentation\n * @responsibility Boundary.\n * @trace ARCH-000001\n */\nexport { value } from "./value.ts";\n`,
      "utf8",
    );
    assert.throws(
      () =>
        assertPublicIndexContract(invalidIndex, {
          relativePath: "index.ts",
          expectedTrace: "ARCH-000001",
          requiredTags: ["effect"],
          exportedModules: ["./value.ts"],
        }),
      /package effect/u,
    );
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

/**
 * src配下は責務名を使い二階層以内に保つを検証する。
 *
 * @responsibility src配下は責務名を使い二階層以内に保つの合否判定を所有する。
 * @trace RCM-IT-015
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus src配下は責務名を使い二階層以内に保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-015=Direct Boundary: Package Source→Repository Layout Contract
 */
test("src配下は責務名を使い二階層以内に保つ", () => {
  assert.doesNotThrow(() =>
    assertSourceDirectoryPath(
      path.join(
        repositoryRoot,
        "40_Develop",
        "sample",
        "src",
        "capability",
        "detail",
      ),
    ),
  );
  assert.throws(
    () =>
      assertSourceDirectoryPath(
        path.join(
          repositoryRoot,
          "40_Develop",
          "sample",
          "src",
          "capability",
          "detail",
          "nested",
        ),
      ),
    /source directory depth exceeds two levels/u,
  );
  assert.throws(
    () =>
      assertSourceDirectoryPath(
        path.join(repositoryRoot, "40_Develop", "sample", "src", "internal"),
      ),
    /source directory must express a responsibility/u,
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * Boolean predicateの文法は正本化した三つの閉集合だけを許可するを検証する。
 *
 * @responsibility Boolean predicateの文法は正本化した三つの閉集合だけを許可するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Boolean predicateの文法は正本化した三つの閉集合だけを許可するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("Boolean predicateの文法は正本化した三つの閉集合だけを許可する", () => {
  for (const prefix of BOOLEAN_AUXILIARY_PREFIXES)
    assert.equal(isAllowedBooleanName(`${prefix}Ready`), true, prefix);
  for (const suffix of SUBJECT_BOOLEAN_SUFFIXES)
    assert.equal(isAllowedBooleanName(`subject${suffix}`), true, suffix);
  for (const standaloneName of STANDALONE_BOOLEAN_NAMES)
    assert.equal(isAllowedBooleanName(standaloneName), true, standaloneName);
  for (const invalidName of [
    "is",
    "isready",
    "subjectUnknown",
    "subjectcompleted",
    "subjectCompletedd",
    "Released",
    "release",
  ])
    assert.equal(isAllowedBooleanName(invalidName), false, invalidName);
});

/**
 * Path classifierは不正folderと不正fileを別々に拒否するを検証する。
 *
 * @responsibility Path classifierは不正folderと不正fileを別々に拒否するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Path classifierは不正folderと不正fileを別々に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("Path classifierは不正folderと不正fileを別々に拒否する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-tools-path-naming-"),
  );
  try {
    const invalidFolderRoot = path.join(temporaryRoot, "tools");
    const invalidFolder = path.join(invalidFolderRoot, "bad_name");
    fs.mkdirSync(invalidFolder, { recursive: true });
    fs.writeFileSync(path.join(invalidFolder, "valid-file.ts"), "", "utf8");
    assert.throws(
      () => collectFiles(invalidFolderRoot),
      /folder name/u,
      "an invalid folder must not be hidden by a valid child filename",
    );

    const invalidFileRoot = path.join(temporaryRoot, "template-tools");
    const validFolder = path.join(invalidFileRoot, "valid-folder");
    fs.mkdirSync(validFolder, { recursive: true });
    fs.writeFileSync(path.join(validFolder, "bad_name.ts"), "", "utf8");
    const invalidFiles = collectFiles(invalidFileRoot);
    assert.equal(invalidFiles.length, 1);
    assert.throws(
      () => assertFileName(invalidFiles[0]),
      /TypeScript filename/u,
      "an invalid filename must be checked independently of its folder",
    );

    const siblingPackageRoot = path.join(temporaryRoot, "sibling-package");
    fs.mkdirSync(siblingPackageRoot);
    fs.writeFileSync(
      path.join(siblingPackageRoot, "owned-module.ts"),
      "export {};\n",
      "utf8",
    );
    assert.deepEqual(
      collectFiles(siblingPackageRoot).map((file) => path.basename(file)),
      ["owned-module.ts"],
      "an unknown sibling package must still use the shared Path classifier",
    );

    for (const validArtifactName of [
      "provider-settings.json",
      "provider-egress-proxy.py",
      "general-task-verification.txt",
      "crdd-platform-access.exe",
      "windows-docker-desktop-4.41.2.policy",
      "provider-egress-proxy.Dockerfile",
    ]) {
      assert.doesNotThrow(
        () => assertFileName(path.join(validFolder, validArtifactName)),
        `owned non-TypeScript artifact must follow its shared convention: ${validArtifactName}`,
      );
    }
    for (const [invalidArtifactName, expectedRule] of [
      ["provider_settings.json", /JSON filename/u],
      ["provider_egress_proxy.py", /Python filename/u],
      ["general_task_verification.txt", /text filename/u],
      ["crdd_platform_access.exe", /native executable filename/u],
      ["windows_docker_desktop.policy", /policy filename/u],
      ["provider_egress_proxy.Dockerfile", /Dockerfile name/u],
    ] as const) {
      assert.throws(
        () => assertFileName(path.join(validFolder, invalidArtifactName)),
        expectedRule,
        `invalid non-TypeScript artifact must fail its owned convention: ${invalidArtifactName}`,
      );
    }

    const generatedTarget = path.join(temporaryRoot, "target");
    fs.mkdirSync(generatedTarget);
    assert.doesNotThrow(() => assertGeneratedTargetDirectory(generatedTarget));
    fs.rmSync(generatedTarget, { recursive: true });
    fs.writeFileSync(generatedTarget, "not a directory", "utf8");
    assert.throws(
      () => assertGeneratedTargetDirectory(generatedTarget),
      /non-directory target/u,
    );
    fs.rmSync(generatedTarget);
    const junctionTarget = path.join(temporaryRoot, "target-junction");
    const junctionDestination = path.join(temporaryRoot, "target-destination");
    fs.mkdirSync(junctionDestination);
    fs.symlinkSync(junctionDestination, junctionTarget, "junction");
    assert.throws(
      () => assertGeneratedTargetDirectory(junctionTarget),
      /symbolic target/u,
    );
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

/**
 * 型付き命名classifierは構文境界の正負例を同じ規則で判定するを検証する。
 *
 * @responsibility 型付き命名classifierは構文境界の正負例を同じ規則で判定するの合否判定を所有する。
 * @trace RCM-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 型付き命名classifierは構文境界の正負例を同じ規則で判定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("型付き命名classifierは構文境界の正負例を同じ規則で判定する", () => {
  const temporaryParent = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "checker-naming",
  );
  fs.mkdirSync(temporaryParent, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(temporaryParent, "naming-fixture-"),
  );
  try {
    fs.writeFileSync(
      path.join(temporaryRoot, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    const fixtureFile = path.join(temporaryRoot, "fixture.ts");
    const shadowFixtureFile = path.join(temporaryRoot, "shadow-fixture.ts");
    const configFile = path.join(temporaryRoot, "tsconfig.json");
    const fixtureTypesRoot = path.join(
      temporaryRoot,
      "node_modules",
      "@types",
      "node",
    );
    fs.mkdirSync(fixtureTypesRoot, { recursive: true });
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "index.d.ts"),
      [
        '/// <reference path="crypto.d.ts" />',
        '/// <reference path="path.d.ts" />',
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "package.json"),
      JSON.stringify({
        name: "@types/node",
        version: "0.0.0",
        types: "index.d.ts",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "crypto.d.ts"),
      [
        'declare module "node:crypto" {',
        '  interface Hash { update(value: string): Hash; digest(encoding: "hex"): string; }',
        '  export function createHash(algorithm: "sha256"): Hash;',
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "path.d.ts"),
      [
        'declare module "node:path" {',
        "  const path: { resolve(value: string): string };",
        "  export default path;",
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      fixtureFile,
      [
        'import path from "node:path";',
        'import { createHash } from "node:crypto";',
        "const MAX_ITEMS = 3;",
        "const FIXED_PATTERN = /fixed/u;",
        'const FIXED_SET = new Set(["fixed"]);',
        "const FIXED_TEMPLATE = String.raw`fixed`;",
        "const INTRINSIC_DATE = Date;",
        "const INTRINSIC_DATE_NOW = Date.now;",
        "const INTRINSIC_DATE_TO_ISO = Date.prototype.toISOString;",
        "const DATE_PARSE = Date.parse;",
        "const DATE_PROTOTYPE = Date.prototype;",
        'const DIRECT_FIXED_ITEMS = ["fixed"];',
        'const DIRECT_FIXED_PROFILE = { mode: "fixed" };',
        "const DIRECT_FIXED_LENGTH = DIRECT_FIXED_ITEMS.length;",
        "const DIRECT_FIXED_FIRST = DIRECT_FIXED_ITEMS[0];",
        "const DIRECT_FIXED_MODE = DIRECT_FIXED_PROFILE.mode;",
        'const HAS_DIRECT_FIXED_MODE = DIRECT_FIXED_PROFILE.mode === "fixed";',
        "const DIRECT_FIXED_TEMPLATE = `" +
          "$" +
          "{DIRECT_FIXED_PROFILE.mode}" +
          "`;",
        "const NESTED_BINARY_PROFILE = { count: 1 };",
        "const NESTED_BINARY_TOTAL = NESTED_BINARY_PROFILE.count + 1 + 1;",
        "const TEMPLATE_BINARY_PROFILE = { count: 1 };",
        "const TEMPLATE_BINARY_TEXT = `" +
          "$" +
          "{TEMPLATE_BINARY_PROFILE.count + 1}" +
          "`;",
        "const VOID_BINARY_PROFILE = { count: 1 };",
        "void (VOID_BINARY_PROFILE.count + 1);",
        'const VOID_TEMPLATE_PROFILE = { mode: "fixed" };',
        "void `" + "$" + "{VOID_TEMPLATE_PROFILE.mode}" + "`;",
        'const DIRECT_NESTED_PROFILE = { nested: { mode: "fixed" } };',
        "const DIRECT_NESTED_MODE = DIRECT_NESTED_PROFILE.nested.mode;",
        'const FROZEN_PROFILE = Object.freeze({ mode: "fixed" });',
        "const FROZEN_MODE = FROZEN_PROFILE.mode;",
        "const FROZEN_DATE = Object.freeze(Date);",
        "const FROZEN_DATE_PARSE = FROZEN_DATE.parse;",
        "const FROZEN_DATE_ALIAS = Object.freeze(INTRINSIC_DATE);",
        "const FROZEN_ALIAS_PROTOTYPE = FROZEN_DATE_ALIAS.prototype;",
        'const FROZEN_PRIMITIVE = Object.freeze("fixed");',
        'const ownedFreezeSource = { mode: "fixed" };',
        "const FROZEN_OWNED = Object.freeze(ownedFreezeSource);",
        "const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(",
        "  Object.getPrototypeOf(Uint8Array.prototype),",
        '  "byteLength",',
        ")?.get;",
        'const FIXED_DIGEST = createHash("sha256").update("fixed").digest("hex");',
        "function validLocals(): void {",
        "  const isReady: boolean | undefined = true;",
        "  const candidatePaths: readonly string[] = [];",
        "  void isReady; void candidatePaths;",
        "}",
        "type Names = readonly string[];",
        "function aliasArrays(candidateNames: Names | null): void { void candidateNames; }",
        "function genericArrays<T extends readonly string[]>(candidateItems: T): void { void candidateItems; }",
        "function unconstrainedGeneric<T>(value: T): void { void value; }",
        "function nonArrays(tupleItem: readonly [string, number], bytes: Uint8Array, valueSet: Set<string>, valueMap: Map<string, string>): void {",
        "  void tupleItem; void bytes; void valueSet; void valueMap;",
        "}",
        "const predicate = (shouldContinue: boolean): boolean => shouldContinue;",
        "const { enabled: hasFeature } = { enabled: true };",
        "function acceptedPredicates(generationReleased: boolean, configurationMatches: boolean, didOperationThrow: boolean): void {",
        "  void generationReleased; void configurationMatches; void didOperationThrow;",
        "}",
        "function invalidPredicates(highCostSelection: boolean, internal: boolean, sameHome: boolean): void {",
        "  void highCostSelection; void internal; void sameHome;",
        "}",
        "function acceptedCollections(argv: readonly string[], acceptanceCriteria: readonly string[], evidence: readonly string[], currentInventory: readonly string[]): void {",
        "  void argv; void acceptanceCriteria; void evidence; void currentInventory;",
        "}",
        "function invalidCollections(actual: readonly string[], before: readonly string[]): void { void actual; void before; }",
        "function unusedParameter(_unusedProvider: string): void {}",
        "function usedUnderscoreParameter(_usedProvider: string): void { void _usedProvider; }",
        'const _localVariable = "invalid";',
        "void _localVariable;",
        "function inspectValues(values: string[]): boolean { return values.length > 0; }",
        "class ValidClass extends ExternalBase {",
        "  override methodName(): void {}",
        "  override BAD_OVERRIDE(): void {}",
        '  get statusValue(): string { return "ok"; }',
        "  set statusValue(value: string) { void value; }",
        "}",
        "const validFunctionExpression = function inspectFixture(): void {};",
        "const validClassExpression = class FixtureClass {};",
        'const runtimePath = path.resolve(".");',
        "const runtimeSnapshot = { path: runtimePath };",
        'const resourceHandle = createHash("sha256");',
        "const weakCache = new WeakMap<object, object>();",
        'const MUTATED_ITEMS = ["fixed"];',
        'MUTATED_ITEMS.push("changed");',
        'const NESTED_MUTATED_PROFILE = { values: ["fixed"] };',
        'NESTED_MUTATED_PROFILE.values.push("changed");',
        'const ALIASED_ITEMS = ["fixed"];',
        "const aliasItems = ALIASED_ITEMS;",
        "function consumeItems(candidateItems: readonly string[]): void { void candidateItems; }",
        'const ESCAPED_ITEMS = ["fixed"];',
        "consumeItems(ESCAPED_ITEMS);",
        'const CONSTRUCTOR_PROFILE = { mode: "fixed" };',
        "const constructorName = CONSTRUCTOR_PROFILE.constructor.name;",
        'const METHOD_PROFILE = { label: "fixed" };',
        "const methodLength = METHOD_PROFILE.toString.length;",
        'const OUT_OF_RANGE_ITEMS = ["fixed"];',
        "const outOfRangeItem = OUT_OF_RANGE_ITEMS[1];",
        'const DYNAMIC_KEY = "mode";',
        'const DYNAMIC_PROFILE = { mode: "fixed" };',
        "const dynamicMode = DYNAMIC_PROFILE[DYNAMIC_KEY];",
        'const NESTED_ESCAPE_PROFILE = { nested: { mode: "fixed" } };',
        "const nestedProfile = NESTED_ESCAPE_PROFILE.nested;",
        'const WRITE_PROFILE = { mode: "fixed" };',
        'WRITE_PROFILE.mode = "changed";',
        "const COMPOUND_PROFILE = { count: 1 };",
        "COMPOUND_PROFILE.count += 1;",
        "const LOGICAL_PROFILE = { enabled: true };",
        "LOGICAL_PROFILE.enabled &&= false;",
        "const UPDATE_PROFILE = { count: 1 };",
        "UPDATE_PROFILE.count++;",
        'const DELETE_PROFILE = { mode: "fixed" };',
        "delete DELETE_PROFILE.mode;",
        'const WRITE_ITEMS = ["fixed"];',
        'WRITE_ITEMS[0] = "changed";',
        'const LENGTH_ITEMS = ["fixed"];',
        "LENGTH_ITEMS.length = 0;",
        'const WRAPPED_WRITE_PROFILE = { mode: "fixed" };',
        '(WRAPPED_WRITE_PROFILE.mode) = "changed";',
        "function consumeMode(mode: string): void { void mode; }",
        'const CALL_PROFILE = { mode: "fixed" };',
        "consumeMode(CALL_PROFILE.mode);",
        "class ModeBox { constructor(mode: string) { void mode; } }",
        'const NEW_PROFILE = { mode: "fixed" };',
        "new ModeBox(NEW_PROFILE.mode);",
        'const RETURN_PROFILE = { mode: "fixed" };',
        "function returnMode(): string { return RETURN_PROFILE.mode; }",
        'const ARROW_PROFILE = { mode: "fixed" };',
        "const readMode = (): string => ARROW_PROFILE.mode;",
        'const EXPORT_PROFILE = { mode: "fixed" };',
        "export const exportedMode = EXPORT_PROFILE.mode;",
        "const NESTED_CALL_PROFILE = { count: 1 };",
        "consumeMode(String(NESTED_CALL_PROFILE.count + 1));",
        'const NESTED_NEW_PROFILE = { mode: "fixed" };',
        "new ModeBox(`" + "$" + "{NESTED_NEW_PROFILE.mode}" + "`);",
        "const NESTED_RETURN_PROFILE = { count: 1 };",
        "function returnNestedCount(): number { return NESTED_RETURN_PROFILE.count + 1; }",
        'const NESTED_ARROW_PROFILE = { mode: "fixed" };',
        "const readNestedMode = (): string => `" +
          "$" +
          "{NESTED_ARROW_PROFILE.mode}" +
          "`;",
        "const NESTED_EXPORT_PROFILE = { count: 1 };",
        "export const exportedCount = NESTED_EXPORT_PROFILE.count + 1;",
        "const SPECIFIER_EXPORT_PROFILE = { count: 1 };",
        "const exportedCountBySpecifier = SPECIFIER_EXPORT_PROFILE.count + 1;",
        "export { exportedCountBySpecifier };",
        'function modeTag(strings: TemplateStringsArray): string { return strings[0] ?? ""; }',
        'const TAGGED_TEMPLATE_PROFILE = { mode: "fixed" };',
        "modeTag`" + "$" + "{TAGGED_TEMPLATE_PROFILE.mode}" + "`;",
        "const CONDITIONAL_PROFILE = { enabled: true };",
        'const conditionalMode = CONDITIONAL_PROFILE.enabled ? "yes" : "no";',
        "const COMMA_PROFILE = { count: 1 };",
        "const commaMode = (COMMA_PROFILE.count, 1);",
        'const DESTRUCTURE_PROFILE = { mode: "fixed" };',
        "const [destructuredMode] = DESTRUCTURE_PROFILE.mode;",
        "const YIELD_PROFILE = { count: 1 };",
        "function* yieldCount(): Generator<number> { yield YIELD_PROFILE.count + 1; }",
        "function invalidLocals(): void {",
        "  const invalidBoolean: boolean = true;",
        "  const invalidArray: string[] = [];",
        "  void invalidBoolean; void invalidArray;",
        "}",
        "const invalidConstant = /fixed/u;",
        "function invalidFunction(condition: boolean): boolean { return condition; }",
        "function invalidNullableArray(nullableItem: readonly string[] | null): void { void nullableItem; }",
        "function invalidGenericArray<T extends readonly string[]>(genericItem: T): void { void genericItem; }",
        "const invalidNamedFunction = function BadFunction(): void {};",
        "const invalidNamedClass = class badClass {};",
        "class InvalidMembers {",
        "  BadMethod(): void {}",
        '  get BadGetter(): string { return "bad"; }',
        "  set BadSetter(value: string) { void value; }",
        "}",
        "const RUNTIME_PATH = runtimePath;",
        "const RUNTIME_FREEZE = Object.freeze(runtimeSnapshot);",
        "const FROZEN_RESOURCE = Object.freeze(resourceHandle);",
        'const RESOURCE_HANDLE = createHash("sha256");',
        "const WEAK_CACHE = new WeakMap<object, object>();",
        "const CYCLE_A = CYCLE_B;",
        "const CYCLE_B = CYCLE_A;",
        "interface ExternalShape { enabled: boolean; values: string[]; BAD_PROPERTY: boolean; }",
        "function inspectExternalShape(): void {",
        "  const externalShape: ExternalShape = { enabled: true, values: [], BAD_PROPERTY: true };",
        "  void externalShape;",
        "}",
        "void FIXED_PATTERN; void FIXED_SET; void FIXED_TEMPLATE; void INTRINSIC_DATE;",
        "void INTRINSIC_DATE_NOW; void INTRINSIC_DATE_TO_ISO; void DATE_PARSE; void DATE_PROTOTYPE;",
        "void DIRECT_FIXED_ITEMS; void DIRECT_FIXED_PROFILE; void TYPED_ARRAY_BYTE_LENGTH;",
        "void DIRECT_FIXED_LENGTH; void DIRECT_FIXED_FIRST; void DIRECT_FIXED_MODE;",
        "void HAS_DIRECT_FIXED_MODE; void DIRECT_FIXED_TEMPLATE;",
        "void NESTED_BINARY_PROFILE; void NESTED_BINARY_TOTAL; void TEMPLATE_BINARY_PROFILE; void TEMPLATE_BINARY_TEXT;",
        "void VOID_BINARY_PROFILE; void VOID_TEMPLATE_PROFILE;",
        "void DIRECT_NESTED_PROFILE; void DIRECT_NESTED_MODE; void FROZEN_PROFILE; void FROZEN_MODE;",
        "void FROZEN_DATE; void FROZEN_DATE_PARSE; void FROZEN_DATE_ALIAS; void FROZEN_ALIAS_PROTOTYPE;",
        "void FIXED_DIGEST; void validFunctionExpression; void validClassExpression;",
        "void resourceHandle; void weakCache; void aliasItems; void invalidNamedFunction; void invalidNamedClass;",
        "void MUTATED_ITEMS; void NESTED_MUTATED_PROFILE; void ALIASED_ITEMS; void ESCAPED_ITEMS;",
        "void CONSTRUCTOR_PROFILE; void constructorName; void METHOD_PROFILE; void methodLength;",
        "void OUT_OF_RANGE_ITEMS; void outOfRangeItem; void DYNAMIC_KEY; void DYNAMIC_PROFILE; void dynamicMode;",
        "void NESTED_ESCAPE_PROFILE; void nestedProfile;",
        "void FROZEN_PRIMITIVE; void ownedFreezeSource; void FROZEN_OWNED;",
        "void RUNTIME_PATH; void RUNTIME_FREEZE; void FROZEN_RESOURCE; void RESOURCE_HANDLE; void WEAK_CACHE;",
        "void WRITE_PROFILE; void COMPOUND_PROFILE; void LOGICAL_PROFILE; void UPDATE_PROFILE; void DELETE_PROFILE;",
        "void WRITE_ITEMS; void LENGTH_ITEMS; void WRAPPED_WRITE_PROFILE; void CALL_PROFILE; void NEW_PROFILE;",
        "void RETURN_PROFILE; void ARROW_PROFILE; void readMode; void EXPORT_PROFILE; void exportedMode; void ModeBox;",
        "void NESTED_CALL_PROFILE; void NESTED_NEW_PROFILE; void NESTED_RETURN_PROFILE; void NESTED_ARROW_PROFILE;",
        "void NESTED_EXPORT_PROFILE; void SPECIFIER_EXPORT_PROFILE; void exportedCountBySpecifier;",
        "void TAGGED_TEMPLATE_PROFILE; void CONDITIONAL_PROFILE; void conditionalMode; void COMMA_PROFILE; void commaMode;",
        "void DESTRUCTURE_PROFILE; void destructuredMode; void YIELD_PROFILE; void yieldCount; void readNestedMode;",
        "void CYCLE_A; void CYCLE_B; void ValidClass; void InvalidMembers;",
      ].join("\n"),
      "utf8",
    );
    const externalFixtureFile = path.join(temporaryRoot, "external.d.ts");
    fs.writeFileSync(
      externalFixtureFile,
      "declare class ExternalBase { methodName(): void; BAD_OVERRIDE(): void; }\n",
      "utf8",
    );
    fs.writeFileSync(
      shadowFixtureFile,
      [
        "export {};",
        "const Date = { now: 1 };",
        "const SHADOWED_DATE = Date;",
        "const Object = { freeze<T>(value: T): T { return value; } };",
        "const SHADOWED_FREEZE = Object.freeze({ fixed: true });",
        "function createHash(): { update(): { digest(): string } } {",
        '  return { update: () => ({ digest: () => "fake" }) };',
        "}",
        "const SHADOWED_HASH = createHash().update().digest();",
        "void SHADOWED_DATE; void SHADOWED_FREEZE; void SHADOWED_HASH;",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          target: "ESNext",
          typeRoots: [path.join(temporaryRoot, "node_modules", "@types")],
          types: ["node"],
        },
        files: [fixtureFile, shadowFixtureFile, externalFixtureFile],
      }),
      "utf8",
    );
    const api = new API({ cwd: checkerRoot });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [configFile] });
      try {
        const project = snapshot.getProjects()[0];
        assert.ok(project);
        const fixtureSource = project.program.getSourceFile(fixtureFile);
        const shadowSource = project.program.getSourceFile(shadowFixtureFile);
        assert.ok(fixtureSource);
        assert.ok(shadowSource);
        const violations = [
          ...inspectSourceFile(fixtureSource, project.checker, [temporaryRoot]),
          ...inspectSourceFile(shadowSource, project.checker, [temporaryRoot]),
        ];
        const keyForViolation = (violation: NamingViolation): string =>
          `${path.basename(violation.file)}:${violation.line}:${violation.column}|${violation.kind}|${violation.name}|${violation.rule}`;
        const expectedKey = (
          sourcePath: string,
          name: string,
          kind: string,
          rule: string,
        ): string => {
          const sourceLines = fs
            .readFileSync(sourcePath, "utf8")
            .split(/\r?\n/u);
          const identifierPattern = new RegExp(`\\b${name}\\b`, "u");
          const declarationPattern = new RegExp(
            `\\b(?:const|let|var)\\s+${name}\\b`,
            "u",
          );
          const lineIndex = sourceLines.findIndex((line) =>
            kind === "variable"
              ? declarationPattern.test(line)
              : identifierPattern.test(line),
          );
          assert.notEqual(lineIndex, -1, `fixture identifier missing: ${name}`);
          const column = sourceLines[lineIndex]?.indexOf(name) ?? -1;
          assert.notEqual(
            column,
            -1,
            `fixture identifier column missing: ${name}`,
          );
          return `${path.basename(sourcePath)}:${lineIndex + 1}:${column + 1}|${kind}|${name}|${rule}`;
        };
        const actualViolationKeys = violations.map(keyForViolation).sort();
        const expectedViolationKeys = [
          expectedKey(fixtureFile, "DATE_PARSE", "variable", "camel-case"),
          expectedKey(fixtureFile, "DATE_PROTOTYPE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "FROZEN_DATE_PARSE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "FROZEN_ALIAS_PROTOTYPE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "FROZEN_DATE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "FROZEN_DATE_ALIAS",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "FROZEN_PRIMITIVE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "FROZEN_OWNED", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "MUTATED_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_MUTATED_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "ALIASED_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "ESCAPED_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "CONSTRUCTOR_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "METHOD_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "OUT_OF_RANGE_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(fixtureFile, "DYNAMIC_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "NESTED_ESCAPE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "WRITE_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "COMPOUND_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "LOGICAL_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "UPDATE_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "DELETE_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "WRITE_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "LENGTH_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "WRAPPED_WRITE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "CALL_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "NEW_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "RETURN_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "ARROW_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "EXPORT_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "NESTED_CALL_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_NEW_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_RETURN_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_ARROW_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_EXPORT_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "SPECIFIER_EXPORT_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "TAGGED_TEMPLATE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "CONDITIONAL_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "COMMA_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "DESTRUCTURE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "YIELD_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "invalidBoolean",
            "variable",
            "boolean-prefix",
          ),
          expectedKey(
            fixtureFile,
            "invalidArray",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "highCostSelection",
            "parameter",
            "boolean-prefix",
          ),
          expectedKey(fixtureFile, "internal", "parameter", "boolean-prefix"),
          expectedKey(fixtureFile, "sameHome", "parameter", "boolean-prefix"),
          expectedKey(
            fixtureFile,
            "actual",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "before",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(fixtureFile, "_usedProvider", "parameter", "camel-case"),
          expectedKey(
            fixtureFile,
            "_localVariable",
            "variable",
            "true-constant-upper-snake-case",
          ),
          expectedKey(
            fixtureFile,
            "invalidConstant",
            "variable",
            "true-constant-upper-snake-case",
          ),
          expectedKey(fixtureFile, "condition", "parameter", "boolean-prefix"),
          expectedKey(
            fixtureFile,
            "nullableItem",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "genericItem",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(fixtureFile, "BadFunction", "function", "camel-case"),
          expectedKey(fixtureFile, "badClass", "class", "pascal-case"),
          expectedKey(fixtureFile, "BadMethod", "method", "camel-case"),
          expectedKey(fixtureFile, "BadGetter", "getter", "camel-case"),
          expectedKey(fixtureFile, "BadSetter", "setter", "camel-case"),
          expectedKey(fixtureFile, "RUNTIME_PATH", "variable", "camel-case"),
          expectedKey(fixtureFile, "RUNTIME_FREEZE", "variable", "camel-case"),
          expectedKey(fixtureFile, "FROZEN_RESOURCE", "variable", "camel-case"),
          expectedKey(fixtureFile, "RESOURCE_HANDLE", "variable", "camel-case"),
          expectedKey(fixtureFile, "WEAK_CACHE", "variable", "camel-case"),
          expectedKey(fixtureFile, "CYCLE_A", "variable", "camel-case"),
          expectedKey(fixtureFile, "CYCLE_B", "variable", "camel-case"),
          expectedKey(shadowFixtureFile, "Date", "variable", "camel-case"),
          expectedKey(
            shadowFixtureFile,
            "SHADOWED_DATE",
            "variable",
            "camel-case",
          ),
          expectedKey(shadowFixtureFile, "Object", "variable", "camel-case"),
          expectedKey(
            shadowFixtureFile,
            "SHADOWED_FREEZE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            shadowFixtureFile,
            "SHADOWED_HASH",
            "variable",
            "camel-case",
          ),
        ].sort();
        assert.deepEqual(
          actualViolationKeys,
          expectedViolationKeys,
          formatViolations(violations),
        );
        const positiveNames = [
          "candidatePaths",
          "candidateNames",
          "candidateItems",
          "value",
          "tupleItem",
          "bytes",
          "valueSet",
          "valueMap",
          "generationReleased",
          "configurationMatches",
          "didOperationThrow",
          "argv",
          "acceptanceCriteria",
          "evidence",
          "currentInventory",
          "_unusedProvider",
          "enabled",
          "values",
          "FIXED_PATTERN",
          "FIXED_SET",
          "FIXED_TEMPLATE",
          "INTRINSIC_DATE",
          "INTRINSIC_DATE_NOW",
          "INTRINSIC_DATE_TO_ISO",
          "DIRECT_FIXED_ITEMS",
          "DIRECT_FIXED_PROFILE",
          "DIRECT_FIXED_LENGTH",
          "DIRECT_FIXED_FIRST",
          "DIRECT_FIXED_MODE",
          "HAS_DIRECT_FIXED_MODE",
          "DIRECT_FIXED_TEMPLATE",
          "NESTED_BINARY_PROFILE",
          "NESTED_BINARY_TOTAL",
          "TEMPLATE_BINARY_PROFILE",
          "TEMPLATE_BINARY_TEXT",
          "VOID_BINARY_PROFILE",
          "VOID_TEMPLATE_PROFILE",
          "DIRECT_NESTED_PROFILE",
          "DIRECT_NESTED_MODE",
          "FROZEN_PROFILE",
          "FROZEN_MODE",
          "TYPED_ARRAY_BYTE_LENGTH",
          "FIXED_DIGEST",
          "runtimePath",
          "runtimeSnapshot",
          "resourceHandle",
          "ownedFreezeSource",
          "weakCache",
          "constructorName",
          "methodLength",
          "outOfRangeItem",
          "DYNAMIC_KEY",
          "dynamicMode",
          "nestedProfile",
          "inspectFixture",
          "FixtureClass",
          "methodName",
          "statusValue",
          "BAD_OVERRIDE",
          "BAD_PROPERTY",
        ];
        for (const positiveName of positiveNames) {
          assert.equal(
            violations.some((violation) => violation.name === positiveName),
            false,
            `unexpected fixture violation: ${positiveName}\n${formatViolations(violations)}`,
          );
        }
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
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
 * Test Headerから指定tagの値を取得する。
 *
 * @responsibility Test Source Contractが要求するtagを一意に読み取る。
 * @trace RCM-IT-005
 * @precondition HeaderはTSDocまたはRustdocの連続した文字列である。
 * @stimulus tag名を指定してHeaderを解析する。
 * @observation 最初に一致したtag値または未検出を返す。
 * @oracle 完全なtag名にだけ一致し、値を欠く行を受理しない。
 * @cleanup N/A: Repositoryまたは外部資源を変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function testHeaderTagValue(header: string, tag: string): string | null {
  const match = new RegExp(
    `^\\s*(?:\\*|///)\\s+@${tag}\\s+(\\S(?:.*\\S)?)\\s*$`,
    "mu",
  ).exec(header);
  return match?.[1] ?? null;
}

/**
 * Test Headerから指定tagの全値を取得する。
 *
 * @responsibility Test FileとTest Helperが持つ複数Local Item Relationを順序に依存せず取得する。
 * @trace RCM-IT-005
 * @precondition HeaderはTSDocまたはRustdocの連続した文字列である。
 * @stimulus tag名を指定してHeader全体を解析する。
 * @observation 完全なtag名に一致する非空値を重複なく返す。
 * @oracle 同じ値の重複をRelation追加として数えず、安定した出現順を保つ。
 * @cleanup N/A: Repositoryまたは外部資源を変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function testHeaderTagValues(header: string, tag: string): readonly string[] {
  const pattern = new RegExp(
    `^\\s*(?:\\*|///)\\s+@${tag}\\s+(\\S(?:.*\\S)?)\\s*$`,
    "gmu",
  );
  return [
    ...new Set(
      [...header.matchAll(pattern)]
        .map((match) => match[1] ?? "")
        .filter(Boolean),
    ),
  ];
}

/**
 * Test Case直前の可視Headerを取得する。
 *
 * @responsibility Test Caseと直前Headerの局所対応を保持して解析する。
 * @trace RCM-IT-005
 * @precondition Sourceは行単位へ分割済みで、indexはTest宣言行を指す。
 * @stimulus Test宣言の直前から空行を越えてHeader終端を探索する。
 * @observation TSDocまたはRustdoc Header文字列を返す。
 * @oracle 無関係なCodeまたは通常Commentを越えてHeaderを結合しない。
 * @cleanup N/A: 入力配列を変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function testHeaderBefore(lines: readonly string[], index: number): string {
  let cursor = index - 1;
  while (cursor >= 0 && lines[cursor]?.trim() === "") cursor -= 1;
  if (cursor < 0) return "";
  if (lines[cursor]?.trim() === "*/") {
    const end = cursor;
    while (cursor >= 0 && !lines[cursor]?.includes("/**")) cursor -= 1;
    return cursor >= 0 ? lines.slice(cursor, end + 1).join("\n") : "";
  }
  if (lines[cursor]?.trim().startsWith("///")) {
    const end = cursor;
    while (cursor >= 0 && lines[cursor]?.trim().startsWith("///")) cursor -= 1;
    return lines.slice(cursor + 1, end + 1).join("\n");
  }
  return "";
}

/**
 * Test Headerの固定SchemaとTraceを検証する。
 *
 * @responsibility Test File、Test CaseおよびHelperのHeader必須項目を同じ規則で検査する。
 * @trace RCM-IT-005
 * @precondition Header種別と期待するLocal Itemおよび試験段階が確定している。
 * @stimulus Headerを解析し、必須tag、N/A理由、Trace実在および段階を照合する。
 * @observation 欠落、不正形式、未知Traceまたは段階不一致をassertionとして取得する。
 * @oracle 全固定tagが非空で、Traceが実在し、期待段階と一致する。
 * @cleanup N/A: Repositoryまたは外部資源を変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
function assertTestHeader(
  header: string,
  requiredTags: readonly string[],
  allowedLocalItemIds: readonly string[],
  expectedLevel: string,
  location: string,
  traceCardinality: "exact-one" | "one-or-more",
): readonly string[] {
  assert.notEqual(header, "", `Test Header missing: ${location}`);
  const summary = header
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:\/\*\*|\*\/?|\/{3})\s?/u, "").trim())
    .find((line) => line.length > 0 && !line.startsWith("@"));
  assert.ok(summary, `Test Header summary missing: ${location}`);
  for (const tag of requiredTags) {
    const value = testHeaderTagValue(header, tag);
    assert.notEqual(value, null, `Test Header @${tag} missing: ${location}`);
    if (value?.startsWith("N/A"))
      assert.match(
        value,
        /^N\/A:\s+\S/u,
        `Test Header @${tag} N/A reason missing: ${location}`,
      );
  }
  const traces = testHeaderTagValues(header, "trace");
  assert.ok(traces.length > 0, `Test Header @trace missing: ${location}`);
  if (traceCardinality === "exact-one")
    assert.equal(
      traces.length,
      1,
      `Test Case must own one Local Item: ${location}`,
    );
  for (const trace of traces) {
    assert.match(
      trace,
      QUALITY_LOCAL_ITEM_ID,
      `Test Header trace format invalid: ${location}`,
    );
    assert.equal(
      canonicalQualityLocalItems.has(trace),
      true,
      `Test Header trace not found: ${location}`,
    );
    assert.equal(
      trace.split("-")[1],
      expectedLevel,
      `Test Header level mismatch: ${location}`,
    );
    assert.equal(
      allowedLocalItemIds.includes(trace),
      true,
      `Test Header trace is outside Test Symbol relation: ${location}: ${trace}`,
    );
  }
  return traces;
}

/**
 * 全Test SourceをQuality Local Itemへ一意に接続するを検証する。
 *
 * @responsibility Test Catalog、Source Header、Symbol RelationおよびQuality Local Itemの全数整合を検証する。
 * @trace RCM-IT-005
 * @precondition Test Catalog、Quality Definitionおよび各Subsystemのsymbol.jsonが読取り可能である。
 * @stimulus 登録済みTest Sourceを全件走査してHeaderとRelationを照合する。
 * @observation Catalog件数、Test宣言、Header tag、Trace、段階およびSymbol Relationを取得する。
 * @oracle Test FileはCase／HelperのLocal Item和集合へ接続し、個別Test Caseは一つ、Named Helperは一つ以上の同段階Local Itemを持つ。
 * @cleanup N/A: 読取り専用検査でありRepositoryを変更しない。
 * @boundary RCM-IT-005=Direct Boundary: Producer→Consumer
 */
test("全Test SourceをQuality Local Itemへ責務単位で接続する", () => {
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
    }[];
  };
  assert.ok(catalog.tests.length > 0, "Test Catalog population is empty");
  const manifests = new Map<
    string,
    { readonly symbols: readonly Record<string, unknown>[] }
  >();
  for (const catalogTest of catalog.tests) {
    const expectedLevel = TEST_LEVEL_CODE[catalogTest.level];
    assert.ok(expectedLevel, `Unsupported test level: ${catalogTest.id}`);
    const manifest =
      manifests.get(catalogTest.owner) ??
      (JSON.parse(
        fs.readFileSync(
          path.join(
            repositoryRoot,
            "40_Develop",
            catalogTest.owner,
            "symbol.json",
          ),
          "utf8",
        ),
      ) as { readonly symbols: readonly Record<string, unknown>[] });
    manifests.set(catalogTest.owner, manifest);
    const relativePath = catalogTest.path.replace(
      `40_Develop/${catalogTest.owner}/`,
      "",
    );
    const symbols = manifest.symbols.filter(
      (symbol) => symbol.kind === "test-suite" && symbol.path === relativePath,
    );
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
    assert.deepEqual(
      localTestIds,
      normalizedLocalTestIds,
      `Test Symbol Local Items must be unique and sorted: ${catalogTest.id}`,
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
      symbols[0]?.qaIds,
      qaIds,
      `Test Symbol QA relation mismatch: ${catalogTest.id}`,
    );
    assert.ok(
      Array.isArray(symbols[0]?.verifies) && symbols[0].verifies.length > 0,
      `Test Symbol implementation relation missing: ${catalogTest.id}`,
    );

    const source = fs.readFileSync(
      path.join(repositoryRoot, catalogTest.path),
      "utf8",
    );
    const lines = source.split(/\r?\n/u);
    if (catalogTest.path.endsWith(".ts")) {
      const fileHeader = source.match(/^\/\*\*[\s\S]*?\*\//u)?.[0] ?? "";
      const fileTraces = assertTestHeader(
        fileHeader,
        [
          "packageDocumentation",
          "responsibility",
          "trace",
          "level",
          "scope",
          "boundary",
        ],
        normalizedLocalTestIds,
        expectedLevel,
        `${catalogTest.path}:file`,
        "one-or-more",
      );
      assert.deepEqual(
        [...fileTraces].sort(),
        normalizedLocalTestIds,
        `Test File trace set must equal Test Symbol relation: ${catalogTest.id}`,
      );
      const usedLocalItemIds = new Set<string>();
      for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index]?.trim() ?? "";
        const isTestCase = /^(?:test|it)(?:\.\w+)?\s*\(/u.test(trimmed);
        const isNamedHelper =
          /^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\b/u.test(
            trimmed,
          ) ||
          /^(?:export\s+)?const\s+[A-Za-z_$][\w$]*[^=]*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/u.test(
            trimmed,
          );
        if (!isTestCase && !isNamedHelper) continue;
        const traces = assertTestHeader(
          testHeaderBefore(lines, index),
          [
            "responsibility",
            "trace",
            "precondition",
            "stimulus",
            "observation",
            "oracle",
            "cleanup",
            "boundary",
          ],
          normalizedLocalTestIds,
          expectedLevel,
          `${catalogTest.path}:${index + 1}`,
          isTestCase ? "exact-one" : "one-or-more",
        );
        for (const trace of traces) usedLocalItemIds.add(trace);
      }
      assert.deepEqual(
        [...usedLocalItemIds].sort(),
        normalizedLocalTestIds,
        `Test Symbol relation must be used by a Case or Helper: ${catalogTest.id}`,
      );
    } else if (catalogTest.path.endsWith(".rs")) {
      const usedLocalItemIds = new Set<string>();
      for (let index = 0; index < lines.length; index += 1) {
        if (!/^\s*#\[(?:tokio::)?test\]\s*$/u.test(lines[index] ?? ""))
          continue;
        const traces = assertTestHeader(
          testHeaderBefore(lines, index),
          [
            "responsibility",
            "trace",
            "precondition",
            "stimulus",
            "observation",
            "oracle",
            "cleanup",
            "boundary",
          ],
          normalizedLocalTestIds,
          expectedLevel,
          `${catalogTest.path}:${index + 1}`,
          "exact-one",
        );
        for (const trace of traces) usedLocalItemIds.add(trace);
      }
      assert.deepEqual(
        [...usedLocalItemIds].sort(),
        normalizedLocalTestIds,
        `Test Symbol relation must be used by a Rust Test Case: ${catalogTest.id}`,
      );
    } else {
      assert.fail(`Unsupported test source: ${catalogTest.path}`);
    }
  }
});
