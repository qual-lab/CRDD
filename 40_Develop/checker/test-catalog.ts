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

export type TestCatalogEntry = Readonly<{
  id: string;
  owner: "checker" | "coordinator" | "platform-access";
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

export type TestCatalog = Readonly<{
  contract: "crdd/test-catalog";
  contractRevision: 3;
  levels: readonly TestLevel[];
  regressionIsSelection: true;
  resourceIntensiveLevels: readonly ["performance", "longevity"];
  runnerProfiles: Readonly<{
    checker: "node_test";
    coordinator: "node_test";
    "platform-access": "cargo_test";
  }>;
  tests: readonly TestCatalogEntry[];
}>;

const RESOURCE_INTENSIVE_LEVELS = new Set<TestLevel>([
  "performance",
  "longevity",
]);
const RUNNER_SUPPORTED_OWNERS = new Set([
  "checker",
  "coordinator",
  "platform-access",
]);
const RUNNER_PROFILES = Object.freeze({
  checker: "node_test",
  coordinator: "node_test",
  "platform-access": "cargo_test",
});
const validExecutionProfiles = new Set(executionProfiles);
const validTestKinds = new Set(testKinds);
const validTestEnvironments = new Set(testEnvironments);
const ROOT_KEYS = new Set([
  "contract",
  "contractRevision",
  "levels",
  "regressionIsSelection",
  "resourceIntensiveLevels",
  "runnerProfiles",
  "tests",
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

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function repositoryPath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

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

export function discoverRepositoryTestFiles(repositoryRoot: string): string[] {
  const nodeTests = ["checker", "coordinator"].flatMap((owner) =>
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

function isTestLevel(value: unknown): value is TestLevel {
  return typeof value === "string" && testLevels.includes(value as TestLevel);
}

function expectedNodeLevel(entryPath: string): string | null {
  return (
    /^40_Develop\/(?:checker|coordinator)\/tests\/([^/]+)\//u.exec(
      entryPath,
    )?.[1] ?? null
  );
}

export function loadTestCatalog(catalogPath: string): unknown {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function isNonEmptyUniqueStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0) &&
    new Set(value).size === value.length
  );
}

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
  if (catalog.contractRevision !== 3) failures.push("contract_revision");
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

function ownerForPath(changedPath: string): TestCatalogEntry["owner"] | null {
  if (changedPath.startsWith("40_Develop/coordinator/")) return "coordinator";
  if (changedPath.startsWith("40_Develop/checker/")) return "checker";
  if (changedPath.startsWith("40_Develop/platform-access/"))
    return "platform-access";
  return null;
}

function isDocumentationPath(changedPath: string): boolean {
  return changedPath.toLowerCase().endsWith(".md");
}

function isSharedRuntimePath(changedPath: string): boolean {
  return (
    changedPath === "07_Quality/04_Test_Catalog.json" ||
    changedPath === "biome.json" ||
    changedPath === ".node-version" ||
    changedPath === ".nvmrc"
  );
}

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
  }
  return [...selected.values()].sort((left, right) =>
    ordinal(left.path, right.path),
  );
}
