/**
 * 各保存Ownerの局所I/OとConsumer閉包を検証する。
 *
 * @packageDocumentation
 * @responsibility Root非公開、固定所在、失敗情報の搬送と対象外処置の拒否を確認する。
 * @trace RDL-IT-001
 * @level IT
 * @scope execution-model、保存Owner、consumer-closure、repository-root
 * @boundary 保存Sourceと利用側の静的閉包。実保存・回復の成立は別の実体試験で確認する。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const RESOLVER_PATH =
  "40_Develop/execution-model/src/repository/resolve-storage-paths.ts";
const RUNTIME_STORAGE_OWNERS = new Set([
  "40_Develop/execution-model/src/storage/runtime-store.ts",
  // CurrentState wxの固定所在だけを所有する。任意Consumerのraw Root利用は認めない。
  "40_Develop/execution-model/src/storage/runtime-kernel-lock.ts",
  "40_Develop/configuration-model/src/ai-selection/crud.ts",
  "40_Develop/configuration-model/src/network-policy/crud.ts",
  RESOLVER_PATH,
  "40_Develop/execution-model/src/repository/require-storage-area.ts",
  "40_Develop/execution-model/src/repository/types.ts",
  "40_Develop/configuration-model/src/manifest/crud.ts",
  "40_Develop/configuration-model/src/manifest/validation.ts",
  "40_Develop/configuration-model/src/history/crud.ts",
  "40_Develop/configuration-model/src/manifest/types.ts",
  "40_Develop/execution-model/src/storage/ensure-area.ts",
  "40_Develop/execution-model/src/storage/temporary-operation.ts",
  "40_Develop/execution-model/src/storage/initialization.ts",
  "40_Develop/execution-model/src/storage/runtime-result.ts",
  "40_Develop/coordinator/src/configuration/runtime-data.ts",
  "40_Develop/executor/scripts/runtime-data.ts",
  "40_Develop/workbench-server/scripts/runtime-data.ts",
]);
const runtimePublicEntries = [
  "40_Develop/document-model/src/index.ts",
  "40_Develop/execution-model/src/index.ts",
  "40_Develop/configuration-model/src/index.ts",
];
const CONSUMER_SURFACE_PATTERN =
  /^(?:40_Develop\/[^/]+\/(?:src|scripts|bin)\/|template\/tools\/)/u;
const SOURCE_EXTENSIONS = new Set([".ts", ".mjs", ".cjs"]);
const rawResolverSymbols = [
  "resolveRepositoryRuntimeDataPathsFromValidatedRoot",
  "resolveRepositoryRuntimeDataPathsForInternalUse",
];
const PROTECTED_SIGNING_SYMBOL =
  "resolveBundledRepositoryRuntimeDataPathsForProtectedSigning";
const expectedProtectedSigningConsumers: readonly string[] = [];
const expectedAreaConsumers = [
  "40_Develop/coordinator/scripts/measure-development-providers.ts",
  "40_Develop/coordinator/scripts/prepare-codex-image.ts",
  "40_Develop/coordinator/scripts/verification-result-record.ts",
  "40_Develop/coordinator/src/execution/intelligence.ts",
  "40_Develop/coordinator/src/execution/lease.ts",
  "40_Develop/executor/scripts/verify-provider-attempt.ts",
  "40_Develop/executor/scripts/verify-provider-home.ts",
  "40_Develop/executor/scripts/verify-provider-real.ts",
] as const;
const PUBLIC_COORDINATOR_BOUNDARIES = [
  "40_Develop/coordinator/src/objective/composition.ts",
  "40_Develop/coordinator/src/decision/acceptance.ts",
  "40_Develop/coordinator/src/decision/lifecycle.ts",
  "40_Develop/coordinator/src/state/query.ts",
] as const;
const COORDINATOR_BLOCKED_PROJECTION =
  "40_Develop/coordinator/src/state/result.ts";
const coordinatorStoreFactoryNames = [
  "createCurrentCoordinatorPersistencePorts",
] as const;
const EXECUTION_INTELLIGENCE_CONSUMER =
  "40_Develop/coordinator/src/execution/intelligence.ts";
const blockedMeaningFields = [
  "effectIssued",
  "effectStateUnknown",
  "cleanupConfirmed",
  "retryAllowed",
  "recoveryReference",
] as const;
const SEMANTIC_ROOT_LITERAL_OWNERS = new Set([
  RESOLVER_PATH,
  "40_Develop/execution-model/src/storage/runtime-kernel-lock.ts",
  "40_Develop/coordinator/scripts/task-real-provider-contract.ts",
  "40_Develop/execution-model/src/storage/ensure-area.ts",
  "40_Develop/configuration-model/src/storage/store.ts",
  "40_Develop/configuration-model/src/storage/lock.ts",
  "40_Develop/coordinator/src/configuration/runtime-data.ts",
  "40_Develop/executor/scripts/runtime-data.ts",
  "40_Develop/workbench-server/scripts/runtime-data.ts",
  "40_Develop/workbench-server/src/server/connection/configuration-area.ts",
  "40_Develop/mcp-server/src/transport/configuration-area.ts",
  "40_Develop/visual-preview/src/browser/temporary.ts",
]);
const ALLOWED_TOP_LEVEL_AREAS = new Set([
  "config",
  "domain-model",
  "execution-intelligence",
  "candidates",
  "workspaces",
  "release",
  "communication",
  "tests",
  "tmp",
]);
const retiredTopLevelAreas = [
  "coordinator",
  "orchestrator",
  "dogfooding",
  "native-fixture",
  "release-staging",
  "test-fixtures",
  "test-tmp",
  "verification-results",
  "verification",
] as const;
const privateStorageExports = [
  ...rawResolverSymbols,
  PROTECTED_SIGNING_SYMBOL,
  "resolveRepositoryRuntimeDataPaths",
  "resolveRepositoryRuntimeDataPathsFromWorkingDirectory",
  "observeRepositoryRuntimeDataArea",
  "requireReadyRepositoryRuntimeDataArea",
  "ensureRepositoryRuntimeDataArea",
  "ensureRepositoryRuntimeDataAreaFromWorkingDirectory",
  "createCoordinatorRuntimeDataArea",
  "checkRepositoryRuntimeDataProtectionDirectory",
  "resolveCrosRuntimeRoots",
  "CrosRootInput",
  "RepositoryRuntimeArea",
  "RepositoryRuntimeDataAreaObservation",
  "RepositoryRootCapability",
  "readStableFileSnapshot",
  "StableFileIdentity",
  "sameStableFileIdentity",
  "createFilesystemStoreRoot",
  "FilesystemStoreRoot",
  "resolveFilesystemStorePath",
  "withFilesystemStoreLock",
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
function violations(sources: SourceSet): string[] {
  const findings: string[] = [];
  for (const [item, source] of sources) {
    if (!CONSUMER_SURFACE_PATTERN.test(item)) continue;
    const hasRawRootOwnership = RUNTIME_STORAGE_OWNERS.has(item);
    const hasDirectRootConstruction =
      /path\.(?:join|resolve)\([^)]{0,240}?["']\.crdd["']/u.test(source) ||
      /["']\.["']\s*\+\s*["']crdd["']/u.test(source) ||
      /["']\.["']\s*,\s*["']crdd["']/u.test(source);
    if (!SEMANTIC_ROOT_LITERAL_OWNERS.has(item) && hasDirectRootConstruction)
      findings.push(`raw-root:${item}`);
    // Topic探索の固定除外式はPath構築ではない。同Fileの他のliteralは免除しない。
    const rootLiteralSource =
      item === "40_Develop/document-model/src/storage/topic-meeting-store.ts"
        ? source.replace(
            /\[\s*"\.git",\s*"\.crdd",\s*"node_modules"\s*\]\.includes\(entry\.name\)/u,
            "repositoryExplorationExclusion",
          )
        : source;
    if (
      !SEMANTIC_ROOT_LITERAL_OWNERS.has(item) &&
      /["'](?:\.crdd|crdd)["']/u.test(rootLiteralSource)
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
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?resolveRepositoryRuntimeDataPaths(?:ForInternalUse)?\s*\(/gu,
      ),
    ].flatMap((match) => (match[1] ? [match[1]] : []));
    const areas = [
      ...source.matchAll(
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?ensureRepositoryRuntimeDataArea\s*\(/gu,
      ),
    ].flatMap((match) => (match[1] ? [match[1]] : []));
    const properties =
      "config|orchestrator|coordinator|domainModel|executionIntelligence|verification|candidates|workspaces|release|communication|tests|temporary";
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
      !RUNTIME_STORAGE_OWNERS.has(item) &&
      rawResolverSymbols.some((symbol) => source.includes(symbol))
    )
      findings.push(`internal-resolver:${item}`);

    for (const area of retiredTopLevelAreas)
      if (source.includes(`.crdd/${area}`))
        findings.push(`retired-area:${area}:${item}`);

    for (const match of source.matchAll(/["'`]\.crdd\/([^/"'`]+)/gu)) {
      const area = match[1];
      if (area !== undefined && !ALLOWED_TOP_LEVEL_AREAS.has(area))
        findings.push(`unregistered-area:${area}:${item}`);
    }
    for (const match of source.matchAll(
      /path\.(?:join|resolve)\([^)]*?["']\.crdd["']\s*,\s*["']([^"']+)["']/gu,
    )) {
      const area = match[1];
      if (area !== undefined && !ALLOWED_TOP_LEVEL_AREAS.has(area))
        findings.push(`unregistered-area:${area}:${item}`);
    }
  }

  const actualSigningConsumers = [...sources]
    .filter(
      ([item, source]) =>
        CONSUMER_SURFACE_PATTERN.test(item) &&
        !RUNTIME_STORAGE_OWNERS.has(item) &&
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

  for (const entry of runtimePublicEntries)
    if (!sources.has(entry)) findings.push(`public-entry-absent:${entry}`);
  const publicIndex = runtimePublicEntries
    .map((item) => sources.get(item) ?? "")
    .join("\n");
  if (
    privateStorageExports.some((symbol) =>
      new RegExp(`\\b${symbol}\\b`, "u").test(publicIndex),
    )
  )
    findings.push("internal-resolver-exported");

  const actualAreaConsumers = [...sources]
    .filter(
      ([item, source]) =>
        !RUNTIME_STORAGE_OWNERS.has(item) &&
        !runtimePublicEntries.includes(item) &&
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
    const doesPreserveBlockedResult =
      item === EXECUTION_INTELLIGENCE_CONSUMER
        ? source.includes("requireReadyRepositoryRuntimeDataArea") &&
          source.includes("observeRepositoryRuntimeDataArea") &&
          source.includes("RepositoryRuntimeDataAreaBlockedError") &&
          source.includes("cause.recoveryReference") &&
          source.includes("reportExecutionRecordingUnavailable") &&
          blockedMeaningFields.every((field) => source.includes(field))
        : source.includes("requireReadyRepositoryRuntimeDataArea") ||
          blockedMeaningFields.every((field) => source.includes(field));
    if (!doesPreserveBlockedResult)
      findings.push(`runtime-area-blocked-result:${item}`);
  }
  const boundarySources = PUBLIC_COORDINATOR_BOUNDARIES.map(
    (file) => sources.get(file) ?? "",
  );
  const coordinatorBoundary = boundarySources.join("\n");
  const blockedProjection = sources.get(COORDINATOR_BLOCKED_PROJECTION) ?? "";
  if (
    !boundarySources.every(
      (source) =>
        source.includes("RepositoryRuntimeDataAreaBlockedError") &&
        source.includes("coordinatorDataBoundaryBlocked"),
    ) ||
    !coordinatorStoreFactoryNames.every((symbol) =>
      coordinatorBoundary.includes(symbol),
    ) ||
    !blockedMeaningFields.every((field) =>
      blockedProjection.includes(
        field === "recoveryReference" ? "recoveryIds" : field,
      ),
    )
  )
    findings.push("orchestrator-area-final-boundary");
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("本番保存Consumerは各Ownerの固定所在と失敗搬送を維持する", () => {
  const sources = consumerSources();
  assert.deepEqual(violations(sources), []);
  for (const field of blockedMeaningFields) {
    const withoutProjection = new Map(sources);
    const projected = field === "recoveryReference" ? "recoveryIds" : field;
    withoutProjection.set(
      COORDINATOR_BLOCKED_PROJECTION,
      (sources.get(COORDINATOR_BLOCKED_PROJECTION) ?? "").replaceAll(
        projected,
        "missingProjection",
      ),
    );
    assert.ok(
      violations(withoutProjection).includes(
        "orchestrator-area-final-boundary",
      ),
      field,
    );
    const withoutRecording = new Map(sources);
    withoutRecording.set(
      EXECUTION_INTELLIGENCE_CONSUMER,
      (sources.get(EXECUTION_INTELLIGENCE_CONSUMER) ?? "").replaceAll(
        field,
        "missingProjection",
      ),
    );
    assert.ok(
      violations(withoutRecording).includes(
        `runtime-area-blocked-result:${EXECUTION_INTELLIGENCE_CONSUMER}`,
      ),
      field,
    );
  }
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("新規Componentのraw Root構築と名前付きPathの親再解釈を拒否する", () => {
  const sources = consumerSources();
  const workspaceOwner = "40_Develop/version-control/src/worktree/crud.ts";
  assert.ok(sources.has(workspaceOwner));
  sources.set(
    workspaceOwner,
    `${sources.get(workspaceOwner)}\nconst unrelated = path.join(root, ".crdd", "other");`,
  );
  assert.ok(violations(sources).includes(`raw-root:${workspaceOwner}`));
  assert.ok(violations(sources).includes(`root-literal:${workspaceOwner}`));
  const upper = "40_Develop/coordinator/src/workspace/commands.ts";
  sources.set(
    upper,
    `${sources.get(upper)}\nconst duplicated = path.join(root, ".crdd", "workspaces");`,
  );
  assert.ok(violations(sources).includes(`raw-root:${upper}`));
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
  sources.set(
    "40_Develop/future-tool/src/consumer.ts",
    [
      "const paths = resolveRepositoryRuntimeDataPaths(capability);",
      "const parent = path.dirname(paths.domainModel);",
    ].join("\n"),
  );
  assert.ok(
    violations(sources).includes(
      "named-parent:40_Develop/future-tool/src/consumer.ts",
    ),
  );
  const topicSource =
    "40_Develop/document-model/src/storage/topic-meeting-store.ts";
  sources.set(
    topicSource,
    `${sources.get(topicSource)}\nconst forbiddenRoot = ".crdd";`,
  );
  assert.ok(violations(sources).includes(`root-literal:${topicSource}`));
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("3Rootの内部保存公開と予定外の保護署名Consumerを拒否する", () => {
  const sources = consumerSources();
  for (const entry of runtimePublicEntries) {
    for (const symbol of privateStorageExports) {
      const withInternalExport = new Map(sources);
      withInternalExport.set(
        entry,
        `export { ${symbol} } from "./private.ts";\n`,
      );
      assert.ok(
        violations(withInternalExport).includes("internal-resolver-exported"),
        `${entry}:${symbol}`,
      );
    }
    const withoutEntry = new Map(sources);
    withoutEntry.delete(entry);
    assert.ok(
      violations(withoutEntry).includes(`public-entry-absent:${entry}`),
    );
  }
  sources.set(
    "40_Develop/future-tool/scripts/sign.ts",
    `${PROTECTED_SIGNING_SYMBOL}();\n`,
  );
  const publicEntry = runtimePublicEntries[0];
  assert.ok(publicEntry);
  sources.set(
    publicEntry,
    'export { resolveRepositoryRuntimeDataPathsForInternalUse } from "./private.ts";\n',
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
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
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
  for (const area of ["coordinator", "orchestrator"]) {
    const retired = new Map(sources);
    retired.set(
      "template/tools/future-tool.ts",
      `const retired = ".crdd/${area}/state.json";`,
    );
    assert.ok(
      violations(retired).includes(
        `retired-area:${area}:template/tools/future-tool.ts`,
      ),
    );
  }
  const owned = new Map(sources);
  owned.set(
    RESOLVER_PATH,
    `${sources.get(RESOLVER_PATH)}\nconst unknown = path.join(repositoryRoot, ".crdd", "future-cache");`,
  );
  assert.ok(
    violations(owned).includes(
      `unregistered-area:future-cache:${RESOLVER_PATH}`,
    ),
  );
});
