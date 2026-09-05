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
export type TestCatalogEntry = Readonly<{
  id: string;
  owner: "checker" | "coordinator" | "platform-access";
  path: string;
  level: TestLevel;
  kind: string;
  semanticTags: readonly string[];
  environment: string;
  executionProfiles?: readonly (
    | "restricted_process"
    | "windows_process_control"
  )[];
  externalProviderEffect: boolean;
  humanInput: boolean;
  postconditions: readonly string[];
  mandatoryByDefault: boolean;
}>;

export type TestCatalog = Readonly<{
  contract: "crdd/test-catalog";
  contractRevision: 2;
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
const EXECUTION_PROFILES = new Set([
  "restricted_process",
  "windows_process_control",
]);
const IGNORED_WALK_DIRECTORIES = new Set([".git", "node_modules", "target"]);

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

export function loadTestCatalog(catalogPath: string): TestCatalog {
  const parsed: unknown = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("test_catalog_not_object");
  if (!("tests" in parsed) || !Array.isArray(parsed.tests))
    throw new Error("test_catalog_tests_not_array");
  return parsed as TestCatalog;
}

export function inspectTestCatalog(
  repositoryRoot: string,
  catalog: TestCatalog,
): readonly string[] {
  const failures: string[] = [];
  if (catalog.contract !== "crdd/test-catalog") failures.push("contract");
  if (catalog.contractRevision !== 2) failures.push("contract_revision");
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

  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const entry of catalog.tests ?? []) {
    if (typeof entry !== "object" || entry === null) {
      failures.push("invalid_entry");
      continue;
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      failures.push("invalid_id");
      continue;
    }
    if (typeof entry.path !== "string" || entry.path.length === 0) {
      failures.push(`invalid_path:${entry.id}`);
      continue;
    }
    if (ids.has(entry.id)) failures.push(`duplicate_id:${entry.id}`);
    ids.add(entry.id);
    if (paths.has(entry.path.toLowerCase()))
      failures.push(`duplicate_path:${entry.path}`);
    paths.add(entry.path.toLowerCase());
    if (!isTestLevel(entry.level)) failures.push(`invalid_level:${entry.path}`);
    if (!RUNNER_SUPPORTED_OWNERS.has(entry.owner))
      failures.push(`unsupported_owner:${entry.path}`);
    const nodeLevel = expectedNodeLevel(entry.path);
    if (nodeLevel !== null && nodeLevel !== entry.level)
      failures.push(`directory_level_mismatch:${entry.path}`);
    if (!Array.isArray(entry.semanticTags) || entry.semanticTags.length === 0)
      failures.push(`missing_semantic_tags:${entry.path}`);
    if (
      entry.executionProfiles !== undefined &&
      (!Array.isArray(entry.executionProfiles) ||
        entry.executionProfiles.length === 0 ||
        new Set(entry.executionProfiles).size !==
          entry.executionProfiles.length ||
        entry.executionProfiles.some(
          (profile) => !EXECUTION_PROFILES.has(profile),
        ))
    )
      failures.push(`invalid_execution_profiles:${entry.path}`);
    if (
      !Array.isArray(entry.postconditions) ||
      entry.postconditions.length === 0
    )
      failures.push(`missing_postconditions:${entry.path}`);
    if (RESOURCE_INTENSIVE_LEVELS.has(entry.level) && entry.mandatoryByDefault)
      failures.push(`resource_intensive_default:${entry.path}`);
    if (!fs.existsSync(path.join(repositoryRoot, ...entry.path.split("/"))))
      failures.push(`registered_test_missing:${entry.path}`);
  }

  const actualPaths = discoverRepositoryTestFiles(repositoryRoot);
  const registeredPaths = [...catalog.tests.map((entry) => entry.path)].sort(
    ordinal,
  );
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

function tokens(value: string): Set<string> {
  const ignored = new Set([
    "src",
    "tests",
    "test",
    "contract",
    "integration",
    "unit",
    "develop",
    "coordinator",
    "checker",
    "security",
    "core",
    "platform",
    "access",
  ]);
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 3 && !ignored.has(token)),
  );
}

function ownerForPath(changedPath: string): TestCatalogEntry["owner"] | null {
  if (changedPath.startsWith("40_Develop/coordinator/")) return "coordinator";
  if (changedPath.startsWith("40_Develop/checker/")) return "checker";
  if (changedPath.startsWith("40_Develop/platform-access/"))
    return "platform-access";
  return null;
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
    const owner = ownerForPath(changedPath);
    if (owner === null) {
      for (const entry of eligibleEntries.filter(
        (candidate) => candidate.owner === "checker",
      ))
        selected.set(entry.path, entry);
      continue;
    }
    const ownerEntries = eligibleEntries.filter(
      (entry) => entry.owner === owner,
    );
    if (
      /\/(?:package\.json|Cargo\.(?:toml|lock)|tsconfig[^/]*\.json)$/u.test(
        changedPath,
      ) ||
      changedPath.includes("/runtime/") ||
      changedPath.includes("/bin/")
    ) {
      for (const entry of ownerEntries) selected.set(entry.path, entry);
      continue;
    }
    const changedTokens = tokens(changedPath);
    const matches = ownerEntries.filter((entry) =>
      entry.semanticTags.some((tag) => changedTokens.has(tag.toLowerCase())),
    );
    for (const entry of matches.length === 0 ? ownerEntries : matches)
      selected.set(entry.path, entry);
  }
  return [...selected.values()].sort((left, right) =>
    ordinal(left.path, right.path),
  );
}
