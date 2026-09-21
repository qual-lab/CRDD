/**
 * test-catalogに属する責務をまとめる。
 *
 * @responsibility TestLevelを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000003
 */
import fs from "node:fs";
import path from "node:path";

export const testLevels = [
  "unit",
  "integration",
  "system",
  "acceptance",
  "performance",
  "longevity",
] as const;

/**
 * test-catalogで使用するTest Levelの値契約を定義する。
 *
 * @responsibility Test LevelのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape TestLevelが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TestLevelで宣言した値と責務の対応を維持する。
 * @boundary N/A: TestLevelの宣言は外部境界を開かない。
 * @security N/A: TestLevelはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TestLevelの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TestLevel = (typeof testLevels)[number];
export const testKinds = ["unit", "contract", "integration"] as const;
export const testEnvironments = [
  "fixed_system_runtime",
  "local_component_boundary",
  "node_process",
  "windows_rust_runtime",
] as const;
export const executionProfiles = [
  "restricted_process",
  "windows_process_control",
] as const;
export const integrationLifecycleProfiles = [
  "pure_component",
  "read_only_boundary",
  "transport_session",
  "durable_operation",
  "external_effect_operation",
] as const;

/**
 * test-catalogで使用するTest Catalog Entryの値契約を定義する。
 *
 * @responsibility Test Catalog EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape TestCatalogEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TestCatalogEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: TestCatalogEntryの宣言は外部境界を開かない。
 * @security N/A: TestCatalogEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TestCatalogEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TestCatalogEntry = Readonly<{
  id: string;
  owner:
    | "artifact-signing"
    | "checker"
    | "coordinator"
    | "crdd-domain-library"
    | "cros"
    | "execution-intelligence"
    | "mcp"
    | "official-asset-governance"
    | "project-operation"
    | "project-runtime"
    | "runtime-data"
    | "semantic-coverage"
    | "version-control"
    | "platform-access"
    | "verification-runner";
  path: string;
  level: TestLevel;
  kind: (typeof testKinds)[number];
  semanticTags: readonly string[];
  environment: (typeof testEnvironments)[number];
  executionProfiles?: readonly (typeof executionProfiles)[number][];
  externalProviderEffect: boolean;
  humanInput: boolean;
  postconditions: readonly string[];
  mandatoryByDefault: boolean;
}>;

/**
 * test-catalogで使用するTest Catalogの値契約を定義する。
 *
 * @responsibility Test CatalogのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape TestCatalogが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TestCatalogで宣言した値と責務の対応を維持する。
 * @boundary N/A: TestCatalogの宣言は外部境界を開かない。
 * @security N/A: TestCatalogはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TestCatalogの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TestCatalog = Readonly<{
  contract: "crdd/test-catalog";
  contractRevision: 10;
  levels: readonly TestLevel[];
  regressionIsSelection: true;
  resourceIntensiveLevels: readonly ["performance", "longevity"];
  runnerProfiles: Readonly<{
    "artifact-signing": "node_test";
    checker: "node_test";
    coordinator: "node_test";
    "crdd-domain-library": "node_test";
    cros: "node_test";
    "execution-intelligence": "node_test";
    mcp: "node_test";
    "official-asset-governance": "node_test";
    "project-operation": "node_test";
    "project-runtime": "node_test";
    "runtime-data": "node_test";
    "semantic-coverage": "node_test";
    "version-control": "node_test";
    "platform-access": "cargo_test";
    "verification-runner": "node_test";
  }>;
  integrationBlocks: readonly Readonly<{
    id: string;
    owner: TestCatalogEntry["owner"];
    architectureAnchor: string;
    responsibilities: readonly string[];
    externalBoundaries: readonly string[];
    lifecycleProfile: (typeof integrationLifecycleProfiles)[number];
    testIds: readonly string[];
    postconditions: readonly string[];
  }>[];
  integrationCorridors: readonly Readonly<{
    id: string;
    architectureAnchor: string;
    blockPath: readonly string[];
    testIds: readonly string[];
    postconditions: readonly string[];
  }>[];
  consumerBindings: readonly Readonly<{
    producerOwner: TestCatalogEntry["owner"];
    producerPaths: readonly string[];
    consumerOwner: TestCatalogEntry["owner"];
    consumerStatic: true;
    testIds: readonly string[];
  }>[];
  tests: readonly TestCatalogEntry[];
}>;

const RESOURCE_INTENSIVE_LEVELS = new Set<TestLevel>([
  "performance",
  "longevity",
]);
const RUNNER_SUPPORTED_OWNERS = new Set([
  "artifact-signing",
  "checker",
  "coordinator",
  "crdd-domain-library",
  "cros",
  "execution-intelligence",
  "mcp",
  "official-asset-governance",
  "project-operation",
  "project-runtime",
  "runtime-data",
  "semantic-coverage",
  "version-control",
  "platform-access",
  "verification-runner",
]);
const RUNNER_PROFILES = Object.freeze({
  "artifact-signing": "node_test",
  checker: "node_test",
  coordinator: "node_test",
  "crdd-domain-library": "node_test",
  cros: "node_test",
  "execution-intelligence": "node_test",
  mcp: "node_test",
  "official-asset-governance": "node_test",
  "project-operation": "node_test",
  "project-runtime": "node_test",
  "runtime-data": "node_test",
  "semantic-coverage": "node_test",
  "version-control": "node_test",
  "platform-access": "cargo_test",
  "verification-runner": "node_test",
});
const validExecutionProfiles = new Set(executionProfiles);
const validIntegrationLifecycleProfiles = new Set(integrationLifecycleProfiles);
const validTestKinds = new Set(testKinds);
const validTestEnvironments = new Set(testEnvironments);
const ROOT_KEYS = new Set([
  "contract",
  "contractRevision",
  "levels",
  "regressionIsSelection",
  "resourceIntensiveLevels",
  "runnerProfiles",
  "integrationBlocks",
  "integrationCorridors",
  "consumerBindings",
  "tests",
]);
const INTEGRATION_BLOCK_KEYS = new Set([
  "id",
  "owner",
  "architectureAnchor",
  "responsibilities",
  "externalBoundaries",
  "lifecycleProfile",
  "testIds",
  "postconditions",
]);
const INTEGRATION_CORRIDOR_KEYS = new Set([
  "id",
  "architectureAnchor",
  "blockPath",
  "testIds",
  "postconditions",
]);
const CONSUMER_BINDING_KEYS = new Set([
  "producerOwner",
  "producerPaths",
  "consumerOwner",
  "consumerStatic",
  "testIds",
]);
const ENTRY_KEYS = new Set([
  "id",
  "owner",
  "path",
  "level",
  "kind",
  "semanticTags",
  "environment",
  "executionProfiles",
  "externalProviderEffect",
  "humanInput",
  "postconditions",
  "mandatoryByDefault",
]);
const IGNORED_WALK_DIRECTORIES = new Set([".git", "node_modules", "target"]);
const WINDOWS_PROCESS_GATE_DECLARATION =
  /\btest\s*\(\s*[`"]Windows Process Gate:/u;

/**
 * ordinalを決定する。
 *
 * @responsibility ordinalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input left: string、right: string
 * @returns numberを返す。
 * @precondition 「left: string、right: string」がordinalの入力契約を満たす。
 * @postcondition ordinalの責務を完了した結果だけを返す。
 * @effect N/A: ordinalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ordinalは独自の失敗分岐を所有しない。
 * @invariant ordinalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ordinalはProcess内の同一Subsystemで完結する。
 * @security N/A: ordinalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ordinalは共有非同期状態を持たない同期処理である。
 */
function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * repository Pathを決定する。
 *
 * @responsibility repository Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input root: string、absolutePath: string
 * @returns stringを返す。
 * @precondition 「root: string、absolutePath: string」がrepositoryPathの入力契約を満たす。
 * @postcondition repositoryPathの責務を完了した結果だけを返す。
 * @effect N/A: repositoryPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: repositoryPathは独自の失敗分岐を所有しない。
 * @invariant repositoryPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: repositoryPathはProcess内の同一Subsystemで完結する。
 * @security N/A: repositoryPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: repositoryPathは共有非同期状態を持たない同期処理である。
 */
function repositoryPath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

/**
 * walk Filesを決定する。
 *
 * @responsibility walk Filesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input root: string、directory: string
 * @returns string[]を返す。
 * @precondition 「root: string、directory: string」がwalkFilesの入力契約を満たす。
 * @postcondition walkFilesの責務を完了した結果だけを返す。
 * @effect walkFilesはFilesystemの読取りまたは書込みを実行する。
 * @failure walkFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant walkFilesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: walkFilesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: walkFilesは共有非同期状態を持たない同期処理である。
 */
function walkFiles(root: string, directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const discoveredFiles: string[] = [];
  for (const name of fs.readdirSync(directory).sort(ordinal)) {
    if (IGNORED_WALK_DIRECTORIES.has(name)) continue;
    const target = path.join(directory, name);
    const metadata = fs.lstatSync(target);
    if (metadata.isSymbolicLink())
      throw new Error(
        `test_catalog_symbolic_path:${repositoryPath(root, target)}`,
      );
    if (metadata.isDirectory())
      discoveredFiles.push(...walkFiles(root, target));
    else if (metadata.isFile()) discoveredFiles.push(target);
  }
  return discoveredFiles;
}

/**
 * Repository Test Filesを探索する。
 *
 * @responsibility Repository Test Filesの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000003
 * @input repositoryRoot: string
 * @returns string[]を返す。
 * @precondition 「repositoryRoot: string」がdiscoverRepositoryTestFilesの入力契約を満たす。
 * @postcondition discoverRepositoryTestFilesの責務を完了した結果だけを返す。
 * @effect discoverRepositoryTestFilesはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: discoverRepositoryTestFilesは独自の失敗分岐を所有しない。
 * @invariant discoverRepositoryTestFilesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: discoverRepositoryTestFilesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: discoverRepositoryTestFilesは共有非同期状態を持たない同期処理である。
 */
export function discoverRepositoryTestFiles(repositoryRoot: string): string[] {
  const nodeTests = [
    "artifact-signing",
    "checker",
    "coordinator",
    "crdd-domain-library",
    "cros",
    "execution-intelligence",
    "mcp",
    "official-asset-governance",
    "project-operation",
    "project-runtime",
    "runtime-data",
    "semantic-coverage",
    "version-control",
    "verification-runner",
  ].flatMap((owner) =>
    walkFiles(
      repositoryRoot,
      path.join(repositoryRoot, "40_Develop", owner, "tests"),
    )
      .filter((file) => file.endsWith(".test.ts"))
      .map((file) => repositoryPath(repositoryRoot, file)),
  );
  const rustTests = walkFiles(
    repositoryRoot,
    path.join(repositoryRoot, "40_Develop", "platform-access"),
  )
    .filter((file) => file.endsWith(".rs"))
    .filter((file) =>
      /#\[(?:tokio::)?test\]/u.test(fs.readFileSync(file, "utf8")),
    )
    .map((file) => repositoryPath(repositoryRoot, file));
  return [...nodeTests, ...rustTests].sort(ordinal);
}

/**
 * Test Levelかを判定する。
 *
 * @responsibility Test Levelの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns value is TestLevelを返す。
 * @precondition 「value: unknown」がisTestLevelの入力契約を満たす。
 * @postcondition isTestLevelの責務を完了した結果だけを返す。
 * @effect N/A: isTestLevelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isTestLevelは独自の失敗分岐を所有しない。
 * @invariant isTestLevelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isTestLevelはProcess内の同一Subsystemで完結する。
 * @security N/A: isTestLevelはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isTestLevelは共有非同期状態を持たない同期処理である。
 */
function isTestLevel(value: unknown): value is TestLevel {
  return typeof value === "string" && testLevels.includes(value as TestLevel);
}

/**
 * expected Node Levelを決定する。
 *
 * @responsibility expected Node Levelの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input entryPath: string
 * @returns string | nullを返す。
 * @precondition 「entryPath: string」がexpectedNodeLevelの入力契約を満たす。
 * @postcondition expectedNodeLevelの責務を完了した結果だけを返す。
 * @effect N/A: expectedNodeLevelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedNodeLevelは独自の失敗分岐を所有しない。
 * @invariant expectedNodeLevelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedNodeLevelはProcess内の同一Subsystemで完結する。
 * @security N/A: expectedNodeLevelはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: expectedNodeLevelは共有非同期状態を持たない同期処理である。
 */
function expectedNodeLevel(entryPath: string): string | null {
  return (
    /^40_Develop\/(?:artifact-signing|checker|coordinator|crdd-domain-library|cros|execution-intelligence|mcp|official-asset-governance|project-operation|project-runtime|runtime-data|semantic-coverage|verification-runner|version-control)\/tests\/([^/]+)\//u.exec(
      entryPath,
    )?.[1] ?? null
  );
}

/**
 * Test Catalogを読み込む。
 *
 * @responsibility Test Catalogの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000003
 * @input catalogPath: string
 * @returns unknownを返す。
 * @precondition 「catalogPath: string」がloadTestCatalogの入力契約を満たす。
 * @postcondition loadTestCatalogの責務を完了した結果だけを返す。
 * @effect loadTestCatalogはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: loadTestCatalogは独自の失敗分岐を所有しない。
 * @invariant loadTestCatalogは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: loadTestCatalogはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: loadTestCatalogは共有非同期状態を持たない同期処理である。
 */
export function loadTestCatalog(catalogPath: string): unknown {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8")) as unknown;
}

/**
 * 記録かを判定する。
 *
 * @responsibility 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Exact Keysを観測する。
 *
 * @responsibility Exact Keysの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000003
 * @input value: Record<string, unknown>、expected: ReadonlySet<string>、prefix: string、optional: ReadonlySet<string>
 * @returns string[]を返す。
 * @precondition 「value: Record<string, unknown>、expected: ReadonlySet<string>、prefix: string、optional: ReadonlySet<string>」がinspectExactKeysの入力契約を満たす。
 * @postcondition inspectExactKeysの責務を完了した結果だけを返す。
 * @effect N/A: inspectExactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectExactKeysは独自の失敗分岐を所有しない。
 * @invariant inspectExactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectExactKeysはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectExactKeysはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectExactKeysは共有非同期状態を持たない同期処理である。
 */
function inspectExactKeys(
  value: Record<string, unknown>,
  expected: ReadonlySet<string>,
  prefix: string,
  optional: ReadonlySet<string> = new Set(),
): string[] {
  const failures: string[] = [];
  for (const key of Object.keys(value))
    if (!expected.has(key)) failures.push(`${prefix}_unknown_key:${key}`);
  for (const key of expected)
    if (!(key in value) && !optional.has(key))
      failures.push(`${prefix}_missing_key:${key}`);
  return failures;
}

/**
 * Non Empty Unique String Arrayかを判定する。
 *
 * @responsibility Non Empty Unique String Arrayの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns value is string[]を返す。
 * @precondition 「value: unknown」がisNonEmptyUniqueStringArrayの入力契約を満たす。
 * @postcondition isNonEmptyUniqueStringArrayの責務を完了した結果だけを返す。
 * @effect N/A: isNonEmptyUniqueStringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isNonEmptyUniqueStringArrayは独自の失敗分岐を所有しない。
 * @invariant isNonEmptyUniqueStringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isNonEmptyUniqueStringArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: isNonEmptyUniqueStringArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isNonEmptyUniqueStringArrayは共有非同期状態を持たない同期処理である。
 */
function isNonEmptyUniqueStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(value).size === value.length
  );
}

/**
 * Safe Repository Pathかを判定する。
 *
 * @responsibility Safe Repository Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input value: string
 * @returns booleanを返す。
 * @precondition 「value: string」がisSafeRepositoryPathの入力契約を満たす。
 * @postcondition isSafeRepositoryPathの責務を完了した結果だけを返す。
 * @effect N/A: isSafeRepositoryPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSafeRepositoryPathは独自の失敗分岐を所有しない。
 * @invariant isSafeRepositoryPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSafeRepositoryPathはProcess内の同一Subsystemで完結する。
 * @security N/A: isSafeRepositoryPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSafeRepositoryPathは共有非同期状態を持たない同期処理である。
 */
function isSafeRepositoryPath(value: string): boolean {
  return (
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    value
      .split("/")
      .every(
        (segment) => segment !== "" && segment !== "." && segment !== "..",
      ) &&
    path.posix.normalize(value) === value
  );
}

/**
 * markdown Heading Anchor Existsを決定する。
 *
 * @responsibility markdown Heading Anchor Existsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input repositoryRoot: string、architectureAnchor: string
 * @returns booleanを返す。
 * @precondition 「repositoryRoot: string、architectureAnchor: string」がmarkdownHeadingAnchorExistsの入力契約を満たす。
 * @postcondition markdownHeadingAnchorExistsの責務を完了した結果だけを返す。
 * @effect markdownHeadingAnchorExistsはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: markdownHeadingAnchorExistsは独自の失敗分岐を所有しない。
 * @invariant markdownHeadingAnchorExistsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: markdownHeadingAnchorExistsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: markdownHeadingAnchorExistsは共有非同期状態を持たない同期処理である。
 */
function markdownHeadingAnchorExists(
  repositoryRoot: string,
  architectureAnchor: string,
): boolean {
  const [repositoryRelativePath, fragment, ...extraFragments] =
    architectureAnchor.split("#");
  if (
    extraFragments.length > 0 ||
    !repositoryRelativePath ||
    !fragment ||
    !isSafeRepositoryPath(repositoryRelativePath)
  )
    return false;
  const absolutePath = path.join(
    repositoryRoot,
    ...repositoryRelativePath.split("/"),
  );
  if (!fs.existsSync(absolutePath) || !fs.lstatSync(absolutePath).isFile())
    return false;
  return fs
    .readFileSync(absolutePath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => /^#{1,6}\s+/u.test(line))
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/u, "")
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s+/gu, "-"),
    )
    .includes(fragment);
}

/**
 * Test Catalogを観測する。
 *
 * @responsibility Test Catalogの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000003
 * @input repositoryRoot: string、candidate: unknown
 * @returns readonly string[]を返す。
 * @precondition 「repositoryRoot: string、candidate: unknown」がinspectTestCatalogの入力契約を満たす。
 * @postcondition inspectTestCatalogの責務を完了した結果だけを返す。
 * @effect inspectTestCatalogはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: inspectTestCatalogは独自の失敗分岐を所有しない。
 * @invariant inspectTestCatalogは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectTestCatalogはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectTestCatalogは共有非同期状態を持たない同期処理である。
 */
export function inspectTestCatalog(
  repositoryRoot: string,
  candidate: unknown,
): readonly string[] {
  const failures: string[] = [];
  if (!isRecord(candidate)) return ["test_catalog_not_object"];
  failures.push(...inspectExactKeys(candidate, ROOT_KEYS, "root"));
  if (!Array.isArray(candidate.tests)) {
    failures.push("test_catalog_tests_not_array");
    return [...new Set(failures)].sort(ordinal);
  }
  const catalog = candidate as unknown as TestCatalog;
  if (catalog.contract !== "crdd/test-catalog") failures.push("contract");
  if (catalog.contractRevision !== 10) failures.push("contract_revision");
  if (catalog.regressionIsSelection !== true)
    failures.push("regression_selection_contract");
  if (JSON.stringify(catalog.levels) !== JSON.stringify(testLevels))
    failures.push("level_population");
  if (
    JSON.stringify(catalog.resourceIntensiveLevels) !==
    JSON.stringify(["performance", "longevity"])
  )
    failures.push("resource_intensive_level_population");
  if (
    JSON.stringify(catalog.runnerProfiles) !== JSON.stringify(RUNNER_PROFILES)
  )
    failures.push("runner_profile_population");
  if (!isRecord(candidate.runnerProfiles))
    failures.push("runner_profiles_not_object");
  if (!Array.isArray(candidate.consumerBindings))
    failures.push("consumer_bindings_not_array");
  if (!Array.isArray(candidate.integrationBlocks))
    failures.push("integration_blocks_not_array");
  if (!Array.isArray(candidate.integrationCorridors))
    failures.push("integration_corridors_not_array");

  const ids = new Set<string>();
  const paths = new Set<string>();
  const validPaths: string[] = [];
  for (const [index, rawEntry] of candidate.tests.entries()) {
    if (!isRecord(rawEntry)) {
      failures.push(`invalid_entry:${index}`);
      continue;
    }
    failures.push(
      ...inspectExactKeys(
        rawEntry,
        ENTRY_KEYS,
        `entry_${index}`,
        new Set(["executionProfiles"]),
      ),
    );
    const entry = rawEntry as unknown as TestCatalogEntry;
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      failures.push(`invalid_id:${index}`);
      continue;
    }
    if (typeof entry.path !== "string" || !isSafeRepositoryPath(entry.path)) {
      failures.push(`invalid_path:${entry.id}`);
      continue;
    }
    validPaths.push(entry.path);
    if (ids.has(entry.id)) failures.push(`duplicate_id:${entry.id}`);
    ids.add(entry.id);
    if (paths.has(entry.path.toLowerCase()))
      failures.push(`duplicate_path:${entry.path}`);
    paths.add(entry.path.toLowerCase());
    if (!isTestLevel(entry.level)) failures.push(`invalid_level:${entry.path}`);
    if (!RUNNER_SUPPORTED_OWNERS.has(entry.owner))
      failures.push(`unsupported_owner:${entry.path}`);
    if (!validTestKinds.has(entry.kind))
      failures.push(`invalid_kind:${entry.path}`);
    if (!validTestEnvironments.has(entry.environment))
      failures.push(`invalid_environment:${entry.path}`);
    const nodeLevel = expectedNodeLevel(entry.path);
    if (nodeLevel !== null && nodeLevel !== entry.level)
      failures.push(`directory_level_mismatch:${entry.path}`);
    if (!isNonEmptyUniqueStringArray(entry.semanticTags))
      failures.push(`invalid_semantic_tags:${entry.path}`);
    if (
      entry.executionProfiles !== undefined &&
      (!Array.isArray(entry.executionProfiles) ||
        entry.executionProfiles.length === 0 ||
        new Set(entry.executionProfiles).size !==
          entry.executionProfiles.length ||
        entry.executionProfiles.some(
          (profile) =>
            typeof profile !== "string" ||
            !validExecutionProfiles.has(
              profile as (typeof executionProfiles)[number],
            ),
        ))
    )
      failures.push(`invalid_execution_profiles:${entry.path}`);
    if (!isNonEmptyUniqueStringArray(entry.postconditions))
      failures.push(`invalid_postconditions:${entry.path}`);
    if (typeof entry.externalProviderEffect !== "boolean")
      failures.push(`invalid_external_provider_effect:${entry.path}`);
    if (typeof entry.humanInput !== "boolean")
      failures.push(`invalid_human_input:${entry.path}`);
    if (typeof entry.mandatoryByDefault !== "boolean")
      failures.push(`invalid_mandatory_by_default:${entry.path}`);
    if (RESOURCE_INTENSIVE_LEVELS.has(entry.level) && entry.mandatoryByDefault)
      failures.push(`resource_intensive_default:${entry.path}`);
    if (!fs.existsSync(path.join(repositoryRoot, ...entry.path.split("/"))))
      failures.push(`registered_test_missing:${entry.path}`);
  }

  const actualPaths = discoverRepositoryTestFiles(repositoryRoot);
  const registeredPaths = validPaths.sort(ordinal);
  const actualSet = new Set(actualPaths.map((entry) => entry.toLowerCase()));
  const registeredSet = new Set(
    registeredPaths.map((entry) => entry.toLowerCase()),
  );
  for (const entry of actualPaths)
    if (!registeredSet.has(entry.toLowerCase()))
      failures.push(`unregistered_test:${entry}`);
  for (const entry of registeredPaths)
    if (!actualSet.has(entry.toLowerCase()))
      failures.push(`nonexistent_catalog_entry:${entry}`);

  const ownerEdges = new Set<string>();
  const bindings = Array.isArray(candidate.consumerBindings)
    ? candidate.consumerBindings
    : [];
  for (const [index, rawBinding] of bindings.entries()) {
    if (!isRecord(rawBinding)) {
      failures.push(`invalid_consumer_binding:${index}`);
      continue;
    }
    failures.push(
      ...inspectExactKeys(
        rawBinding,
        CONSUMER_BINDING_KEYS,
        `consumer_binding_${index}`,
      ),
    );
    const binding =
      rawBinding as unknown as TestCatalog["consumerBindings"][number];
    if (
      !RUNNER_SUPPORTED_OWNERS.has(binding.producerOwner) ||
      !RUNNER_SUPPORTED_OWNERS.has(binding.consumerOwner) ||
      binding.producerOwner === binding.consumerOwner
    )
      failures.push(`invalid_consumer_owner:${index}`);
    if (binding.consumerStatic !== true)
      failures.push(`consumer_static_missing:${index}`);
    if (
      !isNonEmptyUniqueStringArray(binding.producerPaths) ||
      binding.producerPaths.some(
        (entry) =>
          !isSafeRepositoryPath(entry) ||
          !entry.startsWith(`40_Develop/${binding.producerOwner}/`),
      )
    )
      failures.push(`invalid_consumer_producer_paths:${index}`);
    if (!isNonEmptyUniqueStringArray(binding.testIds))
      failures.push(`invalid_consumer_test_ids:${index}`);
    else
      for (const testId of binding.testIds) {
        const entry = catalog.tests.find(
          (candidateEntry) => candidateEntry.id === testId,
        );
        if (!entry) failures.push(`consumer_test_missing:${testId}`);
        else if (entry.owner !== binding.consumerOwner)
          failures.push(`consumer_test_owner_mismatch:${testId}`);
      }
    const edge = `${binding.producerOwner}->${binding.consumerOwner}`;
    const reverse = `${binding.consumerOwner}->${binding.producerOwner}`;
    if (ownerEdges.has(reverse)) failures.push(`consumer_cycle:${edge}`);
    ownerEdges.add(edge);
  }

  const blockIds = new Set<string>();
  const blockOwners = new Set<TestCatalogEntry["owner"]>();
  const blocks = Array.isArray(candidate.integrationBlocks)
    ? candidate.integrationBlocks
    : [];
  for (const [index, rawBlock] of blocks.entries()) {
    if (!isRecord(rawBlock)) {
      failures.push(`invalid_integration_block:${index}`);
      continue;
    }
    failures.push(
      ...inspectExactKeys(
        rawBlock,
        INTEGRATION_BLOCK_KEYS,
        `integration_block_${index}`,
      ),
    );
    const block =
      rawBlock as unknown as TestCatalog["integrationBlocks"][number];
    if (typeof block.id !== "string" || block.id.length === 0) {
      failures.push(`invalid_integration_block_id:${index}`);
      continue;
    }
    if (blockIds.has(block.id))
      failures.push(`duplicate_integration_block_id:${block.id}`);
    blockIds.add(block.id);
    if (!RUNNER_SUPPORTED_OWNERS.has(block.owner))
      failures.push(`invalid_integration_block_owner:${block.id}`);
    else blockOwners.add(block.owner);
    if (
      typeof block.architectureAnchor !== "string" ||
      !markdownHeadingAnchorExists(repositoryRoot, block.architectureAnchor)
    )
      failures.push(`invalid_integration_block_architecture:${block.id}`);
    if (!isNonEmptyUniqueStringArray(block.responsibilities))
      failures.push(`invalid_integration_block_responsibilities:${block.id}`);
    if (!isNonEmptyUniqueStringArray(block.externalBoundaries))
      failures.push(`invalid_integration_block_boundaries:${block.id}`);
    if (!validIntegrationLifecycleProfiles.has(block.lifecycleProfile))
      failures.push(`invalid_integration_block_lifecycle:${block.id}`);
    if (!isNonEmptyUniqueStringArray(block.postconditions))
      failures.push(`invalid_integration_block_postconditions:${block.id}`);
    if (!isNonEmptyUniqueStringArray(block.testIds))
      failures.push(`invalid_integration_block_tests:${block.id}`);
    else {
      let hasIntegrationTest = false;
      for (const testId of block.testIds) {
        const entry = catalog.tests.find(
          (candidateEntry) => candidateEntry.id === testId,
        );
        if (!entry)
          failures.push(`integration_block_test_missing:${block.id}:${testId}`);
        else if (entry.level === "integration") hasIntegrationTest = true;
      }
      if (!hasIntegrationTest)
        failures.push(`integration_block_integration_test_missing:${block.id}`);
    }
  }
  for (const owner of RUNNER_SUPPORTED_OWNERS)
    if (!blockOwners.has(owner as TestCatalogEntry["owner"]))
      failures.push(`integration_block_owner_missing:${owner}`);

  const corridorIds = new Set<string>();
  const corridorBlocks = new Set<string>();
  const corridors = Array.isArray(candidate.integrationCorridors)
    ? candidate.integrationCorridors
    : [];
  for (const [index, rawCorridor] of corridors.entries()) {
    if (!isRecord(rawCorridor)) {
      failures.push(`invalid_integration_corridor:${index}`);
      continue;
    }
    failures.push(
      ...inspectExactKeys(
        rawCorridor,
        INTEGRATION_CORRIDOR_KEYS,
        `integration_corridor_${index}`,
      ),
    );
    const corridor =
      rawCorridor as unknown as TestCatalog["integrationCorridors"][number];
    if (typeof corridor.id !== "string" || corridor.id.length === 0) {
      failures.push(`invalid_integration_corridor_id:${index}`);
      continue;
    }
    if (corridorIds.has(corridor.id))
      failures.push(`duplicate_integration_corridor_id:${corridor.id}`);
    corridorIds.add(corridor.id);
    if (
      typeof corridor.architectureAnchor !== "string" ||
      !markdownHeadingAnchorExists(repositoryRoot, corridor.architectureAnchor)
    )
      failures.push(`invalid_integration_corridor_architecture:${corridor.id}`);
    if (
      !isNonEmptyUniqueStringArray(corridor.blockPath) ||
      corridor.blockPath.length < 2 ||
      corridor.blockPath.length > 3
    )
      failures.push(`invalid_integration_corridor_path:${corridor.id}`);
    else
      for (const blockId of corridor.blockPath) {
        corridorBlocks.add(blockId);
        if (!blockIds.has(blockId))
          failures.push(
            `integration_corridor_block_missing:${corridor.id}:${blockId}`,
          );
      }
    if (!isNonEmptyUniqueStringArray(corridor.postconditions))
      failures.push(
        `invalid_integration_corridor_postconditions:${corridor.id}`,
      );
    if (!isNonEmptyUniqueStringArray(corridor.testIds))
      failures.push(`invalid_integration_corridor_tests:${corridor.id}`);
    else {
      let hasIntegrationTest = false;
      for (const testId of corridor.testIds) {
        const entry = catalog.tests.find(
          (candidateEntry) => candidateEntry.id === testId,
        );
        if (!entry)
          failures.push(
            `integration_corridor_test_missing:${corridor.id}:${testId}`,
          );
        else if (entry.level === "integration") hasIntegrationTest = true;
      }
      if (!hasIntegrationTest)
        failures.push(
          `integration_corridor_integration_test_missing:${corridor.id}`,
        );
    }
  }
  for (const blockId of blockIds)
    if (!corridorBlocks.has(blockId))
      failures.push(`integration_corridor_block_uncovered:${blockId}`);

  const windowsGatePaths = actualPaths
    .filter((entry) => entry.endsWith(".test.ts"))
    .filter((entry) =>
      fs
        .readFileSync(path.join(repositoryRoot, ...entry.split("/")), "utf8")
        .match(WINDOWS_PROCESS_GATE_DECLARATION),
    );
  const windowsProfileEntries = candidate.tests
    .filter(isRecord)
    .map((entry) => entry as unknown as TestCatalogEntry)
    .filter(
      (entry) =>
        typeof entry.path === "string" &&
        Array.isArray(entry.executionProfiles) &&
        entry.executionProfiles.includes("windows_process_control"),
    );
  const windowsProfilePaths = windowsProfileEntries.map((entry) => entry.path);
  const windowsGateSet = new Set(
    windowsGatePaths.map((entry) => entry.toLowerCase()),
  );
  const windowsProfileSet = new Set(
    windowsProfilePaths.map((entry) => entry.toLowerCase()),
  );
  for (const entry of windowsGatePaths)
    if (!windowsProfileSet.has(entry.toLowerCase()))
      failures.push(`windows_process_profile_missing:${entry}`);
  for (const entry of windowsProfileEntries) {
    if (!windowsGateSet.has(entry.path.toLowerCase()))
      failures.push(`windows_process_profile_unexpected:${entry.path}`);
    if (!entry.executionProfiles?.includes("restricted_process"))
      failures.push(`windows_process_restricted_profile_missing:${entry.path}`);
  }
  return [...new Set(failures)].sort(ordinal);
}

/**
 * test-catalogで使用するResource Intensive Test Authorityの値契約を定義する。
 *
 * @responsibility Resource Intensive Test AuthorityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape ResourceIntensiveTestAuthorityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ResourceIntensiveTestAuthorityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ResourceIntensiveTestAuthorityの宣言は外部境界を開かない。
 * @security N/A: ResourceIntensiveTestAuthorityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ResourceIntensiveTestAuthorityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ResourceIntensiveTestAuthority = Readonly<{
  authorized: boolean;
  purpose: string | null;
  environment: string | null;
  maximumDurationMinutes: number | null;
  maximumInvocations: number | null;
  maximumCredits: number | null;
  cleanup: string | null;
  stopCondition: string | null;
}>;

/**
 * Resource Intensive Test Authorityを観測する。
 *
 * @responsibility Resource Intensive Test Authorityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000003
 * @input levels: ReadonlySet<TestLevel>、authority: ResourceIntensiveTestAuthority
 * @returns readonly string[]を返す。
 * @precondition 「levels: ReadonlySet<TestLevel>、authority: ResourceIntensiveTestAuthority」がinspectResourceIntensiveTestAuthorityの入力契約を満たす。
 * @postcondition inspectResourceIntensiveTestAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: inspectResourceIntensiveTestAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectResourceIntensiveTestAuthorityは独自の失敗分岐を所有しない。
 * @invariant inspectResourceIntensiveTestAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectResourceIntensiveTestAuthorityはProcess内の同一Subsystemで完結する。
 * @security inspectResourceIntensiveTestAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectResourceIntensiveTestAuthorityは共有非同期状態を持たない同期処理である。
 */
export function inspectResourceIntensiveTestAuthority(
  levels: ReadonlySet<TestLevel>,
  authority: ResourceIntensiveTestAuthority,
): readonly string[] {
  if (!levels.has("performance") && !levels.has("longevity")) return [];
  const failures: string[] = [];
  if (!authority.authorized) failures.push("authorization_missing");
  if (!authority.purpose) failures.push("purpose_missing");
  if (!authority.environment) failures.push("environment_missing");
  if (
    authority.maximumDurationMinutes === null ||
    authority.maximumDurationMinutes <= 0
  )
    failures.push("duration_cap_missing");
  if (
    authority.maximumInvocations === null ||
    !Number.isInteger(authority.maximumInvocations) ||
    authority.maximumInvocations <= 0
  )
    failures.push("invocation_cap_missing");
  if (authority.maximumCredits === null || authority.maximumCredits < 0)
    failures.push("credit_cap_missing");
  if (!authority.cleanup) failures.push("cleanup_missing");
  if (!authority.stopCondition) failures.push("stop_condition_missing");
  return failures;
}

/**
 * owner For Pathを決定する。
 *
 * @responsibility owner For Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input changedPath: string
 * @returns TestCatalogEntry["owner"] | nullを返す。
 * @precondition 「changedPath: string」がownerForPathの入力契約を満たす。
 * @postcondition ownerForPathの責務を完了した結果だけを返す。
 * @effect N/A: ownerForPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownerForPathは独自の失敗分岐を所有しない。
 * @invariant ownerForPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownerForPathはProcess内の同一Subsystemで完結する。
 * @security N/A: ownerForPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownerForPathは共有非同期状態を持たない同期処理である。
 */
function ownerForPath(changedPath: string): TestCatalogEntry["owner"] | null {
  if (changedPath.startsWith("40_Develop/artifact-signing/"))
    return "artifact-signing";
  if (changedPath.startsWith("40_Develop/coordinator/")) return "coordinator";
  if (changedPath.startsWith("40_Develop/checker/")) return "checker";
  if (changedPath.startsWith("40_Develop/verification-runner/"))
    return "verification-runner";
  if (changedPath.startsWith("40_Develop/crdd-domain-library/"))
    return "crdd-domain-library";
  if (changedPath.startsWith("40_Develop/cros/")) return "cros";
  if (changedPath.startsWith("40_Develop/execution-intelligence/"))
    return "execution-intelligence";
  if (changedPath.startsWith("40_Develop/mcp/")) return "mcp";
  if (changedPath.startsWith("40_Develop/official-asset-governance/"))
    return "official-asset-governance";
  if (changedPath.startsWith("40_Develop/project-operation/"))
    return "project-operation";
  if (changedPath.startsWith("40_Develop/project-runtime/"))
    return "project-runtime";
  if (changedPath.startsWith("40_Develop/runtime-data/")) return "runtime-data";
  if (changedPath.startsWith("40_Develop/semantic-coverage/"))
    return "semantic-coverage";
  if (changedPath.startsWith("40_Develop/version-control/"))
    return "version-control";
  if (changedPath.startsWith("40_Develop/platform-access/"))
    return "platform-access";
  return null;
}

/**
 * Documentation Pathかを判定する。
 *
 * @responsibility Documentation Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input changedPath: string
 * @returns booleanを返す。
 * @precondition 「changedPath: string」がisDocumentationPathの入力契約を満たす。
 * @postcondition isDocumentationPathの責務を完了した結果だけを返す。
 * @effect N/A: isDocumentationPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDocumentationPathは独自の失敗分岐を所有しない。
 * @invariant isDocumentationPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDocumentationPathはProcess内の同一Subsystemで完結する。
 * @security N/A: isDocumentationPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDocumentationPathは共有非同期状態を持たない同期処理である。
 */
function isDocumentationPath(changedPath: string): boolean {
  return changedPath.toLowerCase().endsWith(".md");
}

/**
 * Shared Runtime Pathかを判定する。
 *
 * @responsibility Shared Runtime Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input changedPath: string
 * @returns booleanを返す。
 * @precondition 「changedPath: string」がisSharedRuntimePathの入力契約を満たす。
 * @postcondition isSharedRuntimePathの責務を完了した結果だけを返す。
 * @effect N/A: isSharedRuntimePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSharedRuntimePathは独自の失敗分岐を所有しない。
 * @invariant isSharedRuntimePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSharedRuntimePathはProcess内の同一Subsystemで完結する。
 * @security N/A: isSharedRuntimePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSharedRuntimePathは共有非同期状態を持たない同期処理である。
 */
function isSharedRuntimePath(changedPath: string): boolean {
  return (
    changedPath === "07_Quality/Registry/test-catalog.json" ||
    changedPath === "biome.json" ||
    changedPath === ".node-version" ||
    changedPath === ".nvmrc"
  );
}

/**
 * applicable Consumer Bindingsを決定する。
 *
 * @responsibility applicable Consumer Bindingsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input catalog: TestCatalog、changedPath: string、producerOwner: TestCatalogEntry["owner"]
 * @returns applicableConsumerBindingsの計算結果を返す。
 * @precondition 「catalog: TestCatalog、changedPath: string、producerOwner: TestCatalogEntry["owner"]」がapplicableConsumerBindingsの入力契約を満たす。
 * @postcondition applicableConsumerBindingsの責務を完了した結果だけを返す。
 * @effect N/A: applicableConsumerBindingsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: applicableConsumerBindingsは独自の失敗分岐を所有しない。
 * @invariant applicableConsumerBindingsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: applicableConsumerBindingsはProcess内の同一Subsystemで完結する。
 * @security N/A: applicableConsumerBindingsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: applicableConsumerBindingsは共有非同期状態を持たない同期処理である。
 */
function applicableConsumerBindings(
  catalog: TestCatalog,
  changedPath: string,
  producerOwner: TestCatalogEntry["owner"],
) {
  const ownerBindings = catalog.consumerBindings.filter(
    (binding) => binding.producerOwner === producerOwner,
  );
  const matchedBindings = ownerBindings.filter((binding) =>
    binding.producerPaths.some(
      (producerPath) =>
        changedPath === producerPath ||
        changedPath.startsWith(
          producerPath.endsWith("/") ? producerPath : `${producerPath}/`,
        ),
    ),
  );
  return matchedBindings.length > 0 ? matchedBindings : ownerBindings;
}

/**
 * Regression Static Ownersを選択する。
 *
 * @responsibility Regression Static Ownersの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000003
 * @input catalog: TestCatalog、changedPaths: readonly string[]、selectedEntries: readonly TestCatalogEntry[]
 * @returns readonly TestCatalogEntry["owner"][]を返す。
 * @precondition 「catalog: TestCatalog、changedPaths: readonly string[]、selectedEntries: readonly TestCatalogEntry[]」がselectRegressionStaticOwnersの入力契約を満たす。
 * @postcondition selectRegressionStaticOwnersの責務を完了した結果だけを返す。
 * @effect N/A: selectRegressionStaticOwnersは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectRegressionStaticOwnersは独自の失敗分岐を所有しない。
 * @invariant selectRegressionStaticOwnersは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectRegressionStaticOwnersはProcess内の同一Subsystemで完結する。
 * @security N/A: selectRegressionStaticOwnersはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: selectRegressionStaticOwnersは共有非同期状態を持たない同期処理である。
 */
export function selectRegressionStaticOwners(
  catalog: TestCatalog,
  changedPaths: readonly string[],
  selectedEntries: readonly TestCatalogEntry[],
): readonly TestCatalogEntry["owner"][] {
  const owners = new Set(selectedEntries.map((entry) => entry.owner));
  for (const rawPath of changedPaths) {
    const changedPath = rawPath.replaceAll("\\", "/").replace(/^\.\//u, "");
    const direct = catalog.tests.find(
      (entry) => entry.path.toLowerCase() === changedPath.toLowerCase(),
    );
    if (direct !== undefined) {
      owners.add(direct.owner);
      continue;
    }
    if (isDocumentationPath(changedPath)) {
      owners.add("checker");
      continue;
    }
    if (
      isSharedRuntimePath(changedPath) ||
      ownerForPath(changedPath) === null
    ) {
      for (const entry of catalog.tests) owners.add(entry.owner);
      continue;
    }
    const owner = ownerForPath(changedPath);
    if (owner === null) continue;
    owners.add(owner);
    for (const binding of applicableConsumerBindings(
      catalog,
      changedPath,
      owner,
    ))
      if (binding.consumerStatic) owners.add(binding.consumerOwner);
  }
  return [...owners].sort(ordinal);
}

/**
 * Regression Testsを選択する。
 *
 * @responsibility Regression Testsの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000003
 * @input catalog: TestCatalog、changedPaths: readonly string[]、levels: ReadonlySet<TestLevel>
 * @returns readonly TestCatalogEntry[]を返す。
 * @precondition 「catalog: TestCatalog、changedPaths: readonly string[]、levels: ReadonlySet<TestLevel>」がselectRegressionTestsの入力契約を満たす。
 * @postcondition selectRegressionTestsの責務を完了した結果だけを返す。
 * @effect N/A: selectRegressionTestsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectRegressionTestsは独自の失敗分岐を所有しない。
 * @invariant selectRegressionTestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectRegressionTestsはProcess内の同一Subsystemで完結する。
 * @security N/A: selectRegressionTestsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: selectRegressionTestsは共有非同期状態を持たない同期処理である。
 */
export function selectRegressionTests(
  catalog: TestCatalog,
  changedPaths: readonly string[],
  levels: ReadonlySet<TestLevel> = new Set<TestLevel>([
    "unit",
    "integration",
    "system",
  ]),
): readonly TestCatalogEntry[] {
  const eligibleEntries = catalog.tests.filter((entry) =>
    levels.has(entry.level),
  );
  if (changedPaths.length === 0) return [];
  const selected = new Map<string, TestCatalogEntry>();

  for (const rawPath of changedPaths) {
    const changedPath = rawPath.replaceAll("\\", "/").replace(/^\.\//u, "");
    const direct = eligibleEntries.find(
      (entry) => entry.path.toLowerCase() === changedPath.toLowerCase(),
    );
    if (direct !== undefined) {
      selected.set(direct.path, direct);
      continue;
    }
    if (isSharedRuntimePath(changedPath)) {
      for (const entry of eligibleEntries) selected.set(entry.path, entry);
      continue;
    }
    if (isDocumentationPath(changedPath)) {
      for (const entry of eligibleEntries)
        if (entry.owner === "checker") selected.set(entry.path, entry);
      continue;
    }
    const owner = ownerForPath(changedPath);
    if (owner === null) {
      for (const entry of eligibleEntries) selected.set(entry.path, entry);
      continue;
    }
    const ownerEntries = eligibleEntries.filter(
      (entry) => entry.owner === owner,
    );
    for (const entry of ownerEntries) selected.set(entry.path, entry);
    for (const binding of applicableConsumerBindings(
      catalog,
      changedPath,
      owner,
    ))
      for (const testId of binding.testIds) {
        const consumerTest = eligibleEntries.find(
          (entry) => entry.id === testId,
        );
        if (consumerTest !== undefined)
          selected.set(consumerTest.path, consumerTest);
      }
  }
  return [...selected.values()].sort((left, right) =>
    ordinal(left.path, right.path),
  );
}
