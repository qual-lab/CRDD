/**
 * runtime-data:integration:consumer-closureの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:integration:consumer-closureが所有する検証責務を実行する。
 * @trace RDL-IT-001
 * @level IT
 * @scope runtime-data、consumer-closure、repository-root、signing
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const RESOLVER_PATH =
  "40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts";
const CONSUMER_SURFACE_PATTERN =
  /^(?:40_Develop\/[^/]+\/(?:src|scripts|bin)\/|template\/tools\/)/u;
const SOURCE_EXTENSIONS = new Set([".ts", ".mjs", ".cjs"]);
const rawResolverSymbols = [
  "resolveRepositoryRuntimeDataPathsFromValidatedRoot",
  "resolveRepositoryRuntimeDataPathsForInternalUse",
];
const PROTECTED_SIGNING_SYMBOL =
  "resolveBundledRepositoryRuntimeDataPathsForProtectedSigning";
const expectedProtectedSigningConsumers = [
  "40_Develop/coordinator/scripts/sign-release-manifest.ts",
];
const expectedAreaConsumers = [
  "40_Develop/coordinator/scripts/measure-development-providers.ts",
  "40_Develop/coordinator/scripts/prepare-release-candidate.ts",
  "40_Develop/coordinator/src/core/verification-result-record.ts",
  "40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts",
  "40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts",
  "40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts",
  "40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts",
] as const;
const PUBLIC_PROJECT_RUNTIME_BOUNDARY =
  "40_Develop/coordinator/src/composition/project-runtime-composition-root.ts";
const PROJECT_RUNTIME_STORE_CONSUMERS = new Set([
  "40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts",
  "40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts",
]);
const EXECUTION_INTELLIGENCE_CONSUMER =
  "40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts";
const blockedMeaningFields = [
  "effectIssued",
  "effectStateUnknown",
  "cleanupConfirmed",
  "retryAllowed",
  "recoveryReference",
] as const;
const SEMANTIC_ROOT_LITERAL_OWNERS = new Set([
  RESOLVER_PATH,
  "40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts",
  "40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts",
]);
const ALLOWED_TOP_LEVEL_AREAS = new Set([
  "config",
  "project-runtime",
  "execution",
  "verification",
  "candidates",
  "release",
  "communication",
  "tests",
  "tmp",
]);
const retiredTopLevelAreas = [
  "dogfooding",
  "native-fixture",
  "release-staging",
  "test-fixtures",
  "test-tmp",
  "verification-results",
] as const;

type SourceSet = ReadonlyMap<string, string>;

/**
 * walkのTest準備責務を実行する。
 *
 * @responsibility walkがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus walkを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const discoveredFiles: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) discoveredFiles.push(...walk(item));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name)))
      discoveredFiles.push(item);
  }
  return discoveredFiles;
}

/**
 * consumerSourcesのTest準備責務を実行する。
 *
 * @responsibility consumerSourcesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus consumerSourcesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
function consumerSources(): Map<string, string> {
  const result = new Map<string, string>();
  const developRoot = path.join(repositoryRoot, "40_Develop");
  for (const component of fs.readdirSync(developRoot, {
    withFileTypes: true,
  })) {
    if (!component.isDirectory()) continue;
    for (const area of ["src", "scripts", "bin"])
      for (const file of walk(path.join(developRoot, component.name, area))) {
        const relativePath = path
          .relative(repositoryRoot, file)
          .split(path.sep)
          .join("/");
        result.set(
          relativePath,
          fs.readFileSync(file, "utf8").replaceAll("\\", "/"),
        );
      }
  }
  for (const file of walk(path.join(repositoryRoot, "template", "tools"))) {
    const relativePath = path
      .relative(repositoryRoot, file)
      .split(path.sep)
      .join("/");
    result.set(
      relativePath,
      fs.readFileSync(file, "utf8").replaceAll("\\", "/"),
    );
  }
  return result;
}

/**
 * violationsのTest準備責務を実行する。
 *
 * @responsibility violationsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus violationsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
function violations(sources: SourceSet): string[] {
  const findings: string[] = [];
  for (const [item, source] of sources) {
    if (!CONSUMER_SURFACE_PATTERN.test(item)) continue;
    const hasRawRootOwnership =
      item.startsWith("40_Develop/runtime-data/src/") ||
      item === "40_Develop/coordinator/scripts/sign-release-manifest.ts";
    const hasDirectRootConstruction =
      /path\.(?:join|resolve)\([^)]{0,240}?["']\.crdd["']/u.test(source) ||
      /["']\.["']\s*\+\s*["']crdd["']/u.test(source) ||
      /["']\.["']\s*,\s*["']crdd["']/u.test(source);
    if (item !== RESOLVER_PATH && hasDirectRootConstruction)
      findings.push(`raw-root:${item}`);
    if (
      !SEMANTIC_ROOT_LITERAL_OWNERS.has(item) &&
      /["'](?:\.crdd|crdd)["']/u.test(source)
    )
      findings.push(`root-literal:${item}`);
    if (
      !hasRawRootOwnership &&
      /resolveRepositoryRuntimeDataPaths/u.test(source) &&
      /\.\s*root\b/u.test(source)
    )
      findings.push(`raw-root-value:${item}`);

    const pathSets = [
      ...source.matchAll(
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?resolveRepositoryRuntimeDataPaths\s*\(/gu,
      ),
    ].flatMap((match) => (match[1] ? [match[1]] : []));
    const areas = [
      ...source.matchAll(
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?ensureRepositoryRuntimeDataArea\s*\(/gu,
      ),
    ].flatMap((match) => (match[1] ? [match[1]] : []));
    const properties =
      "config|projectRuntime|execution|verification|candidates|release|communication|tests|temporary";
    if (
      pathSets.some((name) =>
        new RegExp(
          `path\\.dirname\\(\\s*${name}\\.(?:${properties})\\s*\\)`,
          "u",
        ).test(source),
      ) ||
      areas.some((name) =>
        new RegExp(`path\\.dirname\\(\\s*${name}\\.directory\\s*\\)`, "u").test(
          source,
        ),
      )
    )
      findings.push(`named-parent:${item}`);

    if (
      !item.startsWith("40_Develop/runtime-data/src/") &&
      rawResolverSymbols.some((symbol) => source.includes(symbol))
    )
      findings.push(`internal-resolver:${item}`);

    for (const area of retiredTopLevelAreas)
      if (source.includes(`.crdd/${area}`))
        findings.push(`retired-area:${area}:${item}`);

    for (const match of source.matchAll(/["']\.crdd\/([^/"']+)/gu)) {
      const area = match[1];
      if (area !== undefined && !ALLOWED_TOP_LEVEL_AREAS.has(area))
        findings.push(`unregistered-area:${area}:${item}`);
    }
  }

  const actualSigningConsumers = [...sources]
    .filter(
      ([item, source]) =>
        CONSUMER_SURFACE_PATTERN.test(item) &&
        !item.startsWith("40_Develop/runtime-data/src/") &&
        source.includes(PROTECTED_SIGNING_SYMBOL),
    )
    .map(([item]) => item)
    .sort();
  if (
    actualSigningConsumers.join("\n") !==
    expectedProtectedSigningConsumers.join("\n")
  )
    findings.push(
      `protected-signing-consumers:${actualSigningConsumers.join(",") || "none"}`,
    );

  const publicIndex = sources.get("40_Develop/runtime-data/src/index.ts") ?? "";
  if (
    [...rawResolverSymbols, PROTECTED_SIGNING_SYMBOL].some((symbol) =>
      publicIndex.includes(symbol),
    )
  )
    findings.push("internal-resolver-exported");

  const actualAreaConsumers = [...sources]
    .filter(
      ([item, source]) =>
        !item.startsWith("40_Develop/runtime-data/src/") &&
        /ensureRepositoryRuntimeDataArea(?:FromWorkingDirectory)?/u.test(
          source,
        ),
    )
    .map(([item]) => item)
    .sort();
  if (actualAreaConsumers.join("\n") !== expectedAreaConsumers.join("\n"))
    findings.push(`runtime-area-consumers:${actualAreaConsumers.join(",")}`);
  for (const item of actualAreaConsumers) {
    const source = sources.get(item) ?? "";
    const doesPreserveBlockedResult = PROJECT_RUNTIME_STORE_CONSUMERS.has(item)
      ? source.includes("requireReadyRepositoryRuntimeDataArea")
      : item === EXECUTION_INTELLIGENCE_CONSUMER
        ? source.includes("readExecutionIntelligenceWithRuntimeDataArea") &&
          source.includes("RepositoryRuntimeDataAreaBlockedError") &&
          source.includes(
            "isEffectStateUnknown || !cleanupConfirmed || recoveryReference !== null",
          ) &&
          blockedMeaningFields.every((field) => source.includes(field))
        : blockedMeaningFields.every((field) => source.includes(field));
    if (!doesPreserveBlockedResult)
      findings.push(`runtime-area-blocked-result:${item}`);
  }
  const projectRuntimeBoundary =
    sources.get(PUBLIC_PROJECT_RUNTIME_BOUNDARY) ?? "";
  if (
    !projectRuntimeBoundary.includes("RepositoryRuntimeDataAreaBlockedError") ||
    !projectRuntimeBoundary.includes("projectRuntimeDataBoundaryBlocked") ||
    ![...PROJECT_RUNTIME_STORE_CONSUMERS].every((item) => {
      const symbol = item.includes("decision-recovery")
        ? "createProjectRuntimeDecisionRecoveryStore"
        : "createProjectRuntimePersistencePorts";
      return projectRuntimeBoundary.includes(symbol);
    }) ||
    !blockedMeaningFields.every((field) =>
      projectRuntimeBoundary.includes(
        field === "recoveryReference" ? "recoveryIds" : field,
      ),
    )
  )
    findings.push("project-runtime-area-final-boundary");
  return findings.sort();
}

/**
 * 本番Runtime Data Consumer集合は公開された名前付き境界だけを使うを検証する。
 *
 * @responsibility 本番Runtime Data Consumer集合は公開された名前付き境界だけを使うの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 本番Runtime Data Consumer集合は公開された名前付き境界だけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("本番Runtime Data Consumer集合は公開された名前付き境界だけを使う", () => {
  assert.deepEqual(violations(consumerSources()), []);
});

/**
 * 新規Componentのraw Root構築と名前付きPathの親再解釈を拒否するを検証する。
 *
 * @responsibility 新規Componentのraw Root構築と名前付きPathの親再解釈を拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 新規Componentのraw Root構築と名前付きPathの親再解釈を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("新規Componentのraw Root構築と名前付きPathの親再解釈を拒否する", () => {
  const sources = consumerSources();
  sources.set(
    "40_Develop/future-tool/src/consumer.ts",
    [
      'import path from "node:path";',
      'const direct = path.join(repositoryRoot, ".crdd", "future");',
      "const paths = resolveRepositoryRuntimeDataPaths(capability);",
      "const parent = path.dirname(paths.config);",
    ].join("\n"),
  );
  const findings = violations(sources);
  assert.ok(
    findings.includes("raw-root:40_Develop/future-tool/src/consumer.ts"),
  );
  assert.ok(
    findings.includes("named-parent:40_Develop/future-tool/src/consumer.ts"),
  );
});

/**
 * 内部Resolverの公開と予定外の保護署名Consumerを拒否するを検証する。
 *
 * @responsibility 内部Resolverの公開と予定外の保護署名Consumerを拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 内部Resolverの公開と予定外の保護署名Consumerを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("内部Resolverの公開と予定外の保護署名Consumerを拒否する", () => {
  const sources = consumerSources();
  sources.set(
    "40_Develop/runtime-data/src/index.ts",
    'export { resolveRepositoryRuntimeDataPathsForInternalUse } from "./platform/runtime-data-path-resolver.ts";\n',
  );
  sources.set(
    "40_Develop/future-tool/scripts/sign.ts",
    `${PROTECTED_SIGNING_SYMBOL}();\n`,
  );
  const findings = violations(sources);
  assert.ok(findings.includes("internal-resolver-exported"));
  assert.ok(
    findings.some((finding) =>
      finding.startsWith("protected-signing-consumers:"),
    ),
  );
});

/**
 * 配布Toolを含む利用側で旧Area名と未登録Top-level Areaを拒否するを検証する。
 *
 * @responsibility 配布Toolを含む利用側で旧Area名と未登録Top-level Areaを拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布Toolを含む利用側で旧Area名と未登録Top-level Areaを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("配布Toolを含む利用側で旧Area名と未登録Top-level Areaを拒否する", () => {
  const sources = consumerSources();
  sources.set(
    "template/tools/future-tool.ts",
    [
      'const retired = ".crdd/test-tmp/run";',
      'const unknown = ".crdd/future-cache/item";',
    ].join("\n"),
  );
  const findings = violations(sources);
  assert.ok(
    findings.includes("retired-area:test-tmp:template/tools/future-tool.ts"),
  );
  assert.ok(
    findings.includes(
      "unregistered-area:future-cache:template/tools/future-tool.ts",
    ),
  );
});
