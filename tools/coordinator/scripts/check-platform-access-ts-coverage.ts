import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAXIMUM_LCOV_BYTES = 32 * 1024 * 1024;
const MAXIMUM_COVERAGE_COUNT = 1_000_000;
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");

export const PLATFORM_ACCESS_TS_COVERAGE_SOURCES = Object.freeze([
  "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
  "tools/coordinator/scripts/release-staging-manifest.ts",
  "tools/coordinator/scripts/sign-release-manifest.ts",
  "tools/coordinator/src/core/doctor.ts",
  "tools/coordinator/src/security/platform-access-adapter.ts",
  "tools/coordinator/src/security/platform-access-release.ts",
  "tools/coordinator/src/security/platform-provisioner-manifest-loader.ts",
  "tools/coordinator/src/security/platform-provisioner-package-filesystem.ts",
  "tools/coordinator/src/security/platform-provisioner-release-identity.ts",
  "tools/coordinator/src/security/platform-provisioner-trust-core.ts",
  "tools/coordinator/src/security/platform-provisioner-windows-dacl.ts",
  "tools/coordinator/src/security/root-observation.ts",
  "tools/coordinator/src/security/runtime-activation-record.ts",
  "tools/coordinator/src/security/runtime-root-path-identity.ts",
]);

export const PLATFORM_ACCESS_TS_COVERAGE_TESTS = Object.freeze([
  "tools/coordinator/tests/doctor.contract.test.ts",
  "tools/coordinator/tests/platform-access-adapter.contract.test.ts",
  "tools/coordinator/tests/platform-access-release.contract.test.ts",
  "tools/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
  "tools/coordinator/tests/platform-provisioner-manifest-loader.contract.test.ts",
  "tools/coordinator/tests/platform-provisioner-package-filesystem.contract.test.ts",
  "tools/coordinator/tests/platform-provisioner-release-identity.contract.test.ts",
  "tools/coordinator/tests/platform-provisioner-trust-core.contract.test.ts",
  "tools/coordinator/tests/platform-provisioner-windows-dacl.contract.test.ts",
  "tools/coordinator/tests/root-observation.contract.test.ts",
  "tools/coordinator/tests/runtime-activation-record.contract.test.ts",
  "tools/coordinator/tests/runtime-root-path-identity.contract.test.ts",
  "tools/coordinator/tests/sign-release-manifest.contract.test.ts",
]);

export const PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS = Object.freeze([
  "--experimental-test-coverage",
  "--test",
  "--test-concurrency=1",
  "--experimental-test-isolation=none",
  "--test-reporter=lcov",
]);

type Counter = Readonly<{ covered: number; total: number }>;
type Branch = Readonly<{
  line: number;
  block: number;
  branch: number;
  taken: number | null;
}>;
type SourceCoverage = Readonly<{
  source: string;
  lines: Counter;
  functions: Counter;
  branches: Counter;
  uncoveredBranches: readonly Branch[];
}>;

function count(raw: string, label: string) {
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) {
    throw new Error(`invalid ${label}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAXIMUM_COVERAGE_COUNT) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

function positiveCount(raw: string, label: string) {
  const value = count(raw, label);
  if (value < 1) throw new Error(`invalid ${label}`);
  return value;
}

function oneValue(lines: readonly string[], prefix: string) {
  const values = lines.filter((line) => line.startsWith(prefix));
  if (values.length !== 1) throw new Error(`invalid ${prefix} count`);
  return count(values[0]?.slice(prefix.length) ?? "", prefix);
}

function normalizeSource(raw: string) {
  if (raw.length === 0 || raw.includes("\0") || path.isAbsolute(raw)) {
    throw new Error("invalid LCOV source");
  }
  const normalized = raw.replaceAll("\\", "/");
  const resolved = path.resolve(repositoryRoot, ...normalized.split("/"));
  const relative = path
    .relative(repositoryRoot, resolved)
    .replaceAll("\\", "/");
  if (
    relative !== normalized ||
    relative.startsWith("../") ||
    !PLATFORM_ACCESS_TS_COVERAGE_SOURCES.includes(relative)
  ) {
    throw new Error("unexpected LCOV source");
  }
  return relative;
}

function branchRecords(lines: readonly string[]) {
  const identities = new Set<string>();
  const branches: Branch[] = [];
  for (const line of lines) {
    if (!line.startsWith("BRDA:")) continue;
    const fields = line.slice(5).split(",");
    if (fields.length !== 4) throw new Error("invalid BRDA");
    const branch = Object.freeze({
      line: positiveCount(fields[0] ?? "", "BRDA line"),
      block: count(fields[1] ?? "", "BRDA block"),
      branch: count(fields[2] ?? "", "BRDA branch"),
      taken: fields[3] === "-" ? null : count(fields[3] ?? "", "BRDA taken"),
    });
    const identity = `${branch.line}:${branch.block}:${branch.branch}`;
    if (identities.has(identity)) throw new Error("duplicate BRDA");
    identities.add(identity);
    branches.push(branch);
  }
  return branches;
}

function validateLineRecords(
  lines: readonly string[],
  expectedTotal: number,
  expectedCovered: number,
) {
  const lineNumbers = new Set<number>();
  let covered = 0;
  let total = 0;
  for (const line of lines) {
    if (!line.startsWith("DA:")) continue;
    const fields = line.slice(3).split(",");
    if (fields.length !== 2) throw new Error("invalid DA");
    const lineNumber = positiveCount(fields[0] ?? "", "DA line");
    if (lineNumbers.has(lineNumber)) throw new Error("duplicate DA");
    lineNumbers.add(lineNumber);
    const executions = count(fields[1] ?? "", "DA executions");
    total += 1;
    if (executions > 0) covered += 1;
  }
  if (total !== expectedTotal || covered !== expectedCovered) {
    throw new Error("inconsistent DA summary");
  }
}

function validateFunctionRecords(
  lines: readonly string[],
  expectedTotal: number,
  expectedCovered: number,
) {
  const definitions = new Map<string, number>();
  const executions = new Map<string, number>();
  for (const line of lines) {
    if (line.startsWith("FN:")) {
      const separator = line.indexOf(",", 3);
      if (separator < 0) throw new Error("invalid FN");
      const lineNumber = positiveCount(line.slice(3, separator), "FN line");
      const name = line.slice(separator + 1);
      if (name.length === 0 || definitions.has(name)) {
        throw new Error("duplicate FN");
      }
      definitions.set(name, lineNumber);
    }
    if (line.startsWith("FNDA:")) {
      const separator = line.indexOf(",", 5);
      if (separator < 0) throw new Error("invalid FNDA");
      const executionCount = count(line.slice(5, separator), "FNDA executions");
      const name = line.slice(separator + 1);
      if (name.length === 0 || executions.has(name)) {
        throw new Error("duplicate FNDA");
      }
      executions.set(name, executionCount);
    }
  }
  if (
    definitions.size !== expectedTotal ||
    executions.size !== expectedTotal ||
    [...definitions.keys()].some((name) => !executions.has(name)) ||
    [...executions.keys()].some((name) => !definitions.has(name)) ||
    [...executions.values()].filter((value) => value > 0).length !==
      expectedCovered
  ) {
    throw new Error("inconsistent function records");
  }
}

const allowedLcovTags = Object.freeze(
  new Set([
    "TN",
    "SF",
    "FN",
    "FNDA",
    "DA",
    "BRDA",
    "LF",
    "LH",
    "FNF",
    "FNH",
    "BRF",
    "BRH",
  ]),
);

function lcovRecords(raw: string) {
  const records: string[][] = [];
  let currentLines: string[] = [];
  const lines = raw.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line === "end_of_record") {
      if (currentLines.length === 0) throw new Error("duplicate end_of_record");
      records.push(currentLines);
      currentLines = [];
      continue;
    }
    if (
      line.length === 0 &&
      index === lines.length - 1 &&
      currentLines.length === 0
    ) {
      continue;
    }
    if (line.length === 0) throw new Error("invalid empty LCOV line");
    const separator = line.indexOf(":");
    const tag = separator < 0 ? "" : line.slice(0, separator);
    if (!allowedLcovTags.has(tag)) throw new Error("unknown LCOV record");
    currentLines.push(line);
  }
  if (currentLines.length !== 0) throw new Error("missing end_of_record");
  return records;
}

export function parsePlatformAccessTsCoverageLcov(raw: unknown) {
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_LCOV_BYTES
  ) {
    throw new Error("invalid LCOV input");
  }
  const records = lcovRecords(raw);
  const sources = new Map<string, SourceCoverage>();
  for (const lines of records) {
    const testNames = lines.filter((line) => line.startsWith("TN:"));
    if (testNames.length > 1 || testNames.some((line) => line !== "TN:")) {
      throw new Error("invalid TN count");
    }
    const sourceLines = lines.filter((line) => line.startsWith("SF:"));
    if (sourceLines.length !== 1) throw new Error("invalid SF count");
    const source = normalizeSource(sourceLines[0]?.slice(3) ?? "");
    if (sources.has(source)) throw new Error("duplicate SF");
    const lineTotals = Object.freeze({
      covered: oneValue(lines, "LH:"),
      total: oneValue(lines, "LF:"),
    });
    const functionTotals = Object.freeze({
      covered: oneValue(lines, "FNH:"),
      total: oneValue(lines, "FNF:"),
    });
    const branchTotals = Object.freeze({
      covered: oneValue(lines, "BRH:"),
      total: oneValue(lines, "BRF:"),
    });
    if (
      lineTotals.covered > lineTotals.total ||
      functionTotals.covered > functionTotals.total ||
      branchTotals.covered > branchTotals.total
    ) {
      throw new Error("invalid LCOV summary");
    }
    validateLineRecords(lines, lineTotals.total, lineTotals.covered);
    validateFunctionRecords(
      lines,
      functionTotals.total,
      functionTotals.covered,
    );
    const branches = branchRecords(lines);
    if (
      branches.length !== branchTotals.total ||
      branches.filter((branch) => (branch.taken ?? 0) > 0).length !==
        branchTotals.covered
    ) {
      throw new Error("inconsistent branch summary");
    }
    sources.set(
      source,
      Object.freeze({
        source,
        lines: lineTotals,
        functions: functionTotals,
        branches: branchTotals,
        uncoveredBranches: Object.freeze(
          branches.filter((branch) => (branch.taken ?? 0) === 0),
        ),
      }),
    );
  }
  if (
    sources.size !== PLATFORM_ACCESS_TS_COVERAGE_SOURCES.length ||
    PLATFORM_ACCESS_TS_COVERAGE_SOURCES.some((source) => !sources.has(source))
  ) {
    throw new Error("LCOV source population mismatch");
  }
  const orderedSources = PLATFORM_ACCESS_TS_COVERAGE_SOURCES.map((source) => {
    const value = sources.get(source);
    if (!value) throw new Error("LCOV source population mismatch");
    return value;
  });
  const total = (key: "lines" | "functions" | "branches") =>
    Object.freeze(
      orderedSources.reduce(
        (result, source) => ({
          covered: result.covered + source[key].covered,
          total: result.total + source[key].total,
        }),
        { covered: 0, total: 0 },
      ),
    );
  return Object.freeze({
    sources: Object.freeze(orderedSources),
    totals: Object.freeze({
      lines: total("lines"),
      functions: total("functions"),
      branches: total("branches"),
    }),
  });
}

function fixedEnvironment() {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    const value = process.env[name];
    if (value) environment[name] = value;
  }
  return environment;
}

export function inspectPlatformAccessTsCoverage() {
  const rootMetadata = fs.lstatSync(repositoryRoot);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.isSymbolicLink() ||
    fs.realpathSync.native(repositoryRoot) !== repositoryRoot
  ) {
    throw new Error("coverage repository root invalid");
  }
  const result = spawnSync(
    process.execPath,
    [
      ...PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS,
      ...PLATFORM_ACCESS_TS_COVERAGE_SOURCES.map(
        (source) => `--test-coverage-include=${source}`,
      ),
      ...PLATFORM_ACCESS_TS_COVERAGE_TESTS,
    ],
    {
      cwd: repositoryRoot,
      env: fixedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 60_000,
      maxBuffer: MAXIMUM_LCOV_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string" ||
    result.stderr.length !== 0
  ) {
    throw new Error("TypeScript coverage command failed");
  }
  return parsePlatformAccessTsCoverageLcov(result.stdout);
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    `${JSON.stringify(inspectPlatformAccessTsCoverage(), null, 2)}\n`,
  );
}
