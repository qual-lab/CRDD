import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

const testEntry = process.argv[1];
if (testEntry === undefined) throw new Error("checker_test_entry_missing");
const checkerRoot = path.dirname(path.resolve(testEntry));
const repositoryRoot = path.dirname(path.dirname(checkerRoot));
const checker = path.join(repositoryRoot, "template", "tools", "crdd-check.ts");
const faultInjector = pathToFileURL(
  path.join(checkerRoot, "fault-injector.ts"),
).href;
type CheckerFinding = Readonly<{
  severity: string;
  code: string;
  path: string;
  message: string;
}>;
type CheckerReport = Readonly<{
  findings: readonly CheckerFinding[];
  baseline_submodule: boolean;
  baseline_submodule_initialized: boolean | null;
  baseline_submodule_state: Readonly<Record<string, boolean | string | null>>;
  change_trace_layout: string;
  check_mode: string;
  discovery_exclusions: readonly string[];
  discovery_git_failure: string | null;
  discovery_source: string;
  executed_at: string;
  expanded_scope: readonly string[];
  gitlink_boundaries: readonly string[];
  gitlink_detection: string;
  global_checks: readonly string[];
  metrics: Readonly<Record<string, number>>;
  recognized_change_trace_paths: readonly string[];
  references: Readonly<{
    inbound: readonly Readonly<{ count: number; source: string }>[];
    outbound: readonly Readonly<{ count: number; target: string }>[];
  }> | null;
  repository_mode: string;
  unchecked: readonly string[];
}>;

test("品質固定構成は規則・公式文書・ひな型の番号付き名称と一致する", () => {
  const names = [
    "01_Quality_Center.md",
    "02_Quality_Strategy.md",
    "03_Verification_Design.md",
  ];
  const oldNames = names.map((name) => name.slice(3));
  const expectedEntries = [...names, "Verification_Results/"];
  const rule = fs
    .readFileSync(path.join(repositoryRoot, "16_Quality_Assurance.md"), "utf8")
    .split('<a id="42-fixed-quality-structure"></a>')[1]
    ?.split('<a id="43-no-empty-compliance"></a>')[0];
  assert.ok(rule, "quality_fixed_structure_section_missing");
  const entryRule = fs.readFileSync(
    path.join(repositoryRoot, "template/AGENTS.md"),
    "utf8",
  );
  const roots = ["07_Quality", "template/07_Quality"].map((relative) =>
    path.join(repositoryRoot, relative),
  );
  const check = (
    text: string,
    entry: string,
    directories: readonly (readonly string[])[],
  ): void => {
    const declaredEntries = Array.from(
      text.matchAll(/^[├└]── ([^\r\n]+)$/gm),
      (match) => match[1],
    );
    const responsibilities = Array.from(
      text.matchAll(/^\| \x60([^\x60]+)\x60 \|/gm),
      (match) => match[1],
    );
    assert.deepEqual(declaredEntries, expectedEntries);
    assert.deepEqual(responsibilities, expectedEntries);
    assert.equal(directories.length, 2);
    for (const entries of directories) {
      for (const name of names) assert.ok(entries.includes(name), name);
      for (const name of oldNames) assert.ok(!entries.includes(name), name);
      assert.ok(entries.includes("Verification_Results"));
    }
    for (const name of names) assert.ok(entry.includes(name), name);
  };
  check(
    rule,
    entryRule,
    roots.map((root) => fs.readdirSync(root)),
  );
  for (const root of roots) {
    for (const name of names) {
      assert.ok(fs.lstatSync(path.join(root, name)).isFile(), name);
    }
    assert.ok(
      fs.lstatSync(path.join(root, "Verification_Results")).isDirectory(),
    );
  }
  const completeEntries = [...names, "Verification_Results"];
  assert.throws(() =>
    check(
      rule.replace("01_Quality_Center.md", "Quality_Center.md"),
      entryRule,
      [completeEntries, completeEntries],
    ),
  );
  assert.throws(() =>
    check(rule, entryRule, [completeEntries, completeEntries.slice(1)]),
  );
  assert.throws(() =>
    check(rule, entryRule, [
      completeEntries,
      [...completeEntries, "Quality_Center.md"],
    ]),
  );
  assert.throws(() =>
    check(rule.replace("├── 01_", "├── 02_"), entryRule, [
      completeEntries,
      completeEntries,
    ]),
  );
  assert.throws(() =>
    check(
      rule.replace(/\| \x6001_Quality_Center.md\x60 \|/, "| wrong |"),
      entryRule,
      [completeEntries, completeEntries],
    ),
  );
  assert.throws(() =>
    check(
      rule,
      entryRule.replace("01_Quality_Center.md", "Quality_Center.md"),
      [completeEntries, completeEntries],
    ),
  );
});

test("checker packageのRepository検証はRepository rootを明示する", () => {
  const packageJson: unknown = JSON.parse(
    fs.readFileSync(path.join(checkerRoot, "package.json"), "utf8"),
  );
  assert.ok(
    packageJson !== null &&
      typeof packageJson === "object" &&
      !Array.isArray(packageJson),
  );
  const scripts = Object.getOwnPropertyDescriptor(
    packageJson,
    "scripts",
  )?.value;
  assert.ok(
    scripts !== null && typeof scripts === "object" && !Array.isArray(scripts),
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(scripts, "verify:repository")?.value,
    "node ./crdd-check.ts --root ../.. --json --summary",
  );
  assert.equal(path.resolve(checkerRoot, "../.."), repositoryRoot);
});

test("両private packageのLintはWarningを検査失敗にする", () => {
  for (const packageRoot of [
    checkerRoot,
    path.join(repositoryRoot, "40_Develop", "coordinator"),
  ]) {
    const packageJson: unknown = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    );
    const packageRecord = record(packageJson);
    const scripts = packageRecord && record(packageRecord.scripts);
    assert.equal(
      scripts?.lint,
      "biome lint ../.. --error-on-warnings",
      packageRoot,
    );
  }
});

test("Biomeは.crdd内の入れ子設定を探索せず両所有sourceを検査する", () => {
  const root = fixture();
  write(
    path.join(root, "biome.json"),
    fs.readFileSync(path.join(repositoryRoot, "biome.json"), "utf8"),
  );
  const sourcePaths = ["40_Develop/example.ts", "template/tools/example.ts"];
  for (const relativePath of sourcePaths) {
    write(path.join(root, relativePath), "export const VALUE = 1;\n");
  }
  for (const relativePath of [
    ".crdd/release-staging/old",
    ".crdd/dogfooding/temporary",
    "40_Develop/coordinator/.crdd/legacy",
  ]) {
    write(
      path.join(root, relativePath, "biome.json"),
      JSON.stringify({ root: true }),
    );
    write(path.join(root, relativePath, "broken.ts"), "invalid {{{");
  }
  const biome = path.join(checkerRoot, "node_modules/@biomejs/biome/bin/biome");
  const inspectLint = () =>
    spawnSync(process.execPath, [biome, "lint", ".", "--error-on-warnings"], {
      cwd: root,
      shell: false,
      encoding: "utf8",
      timeout: 30_000,
    });
  const clean = inspectLint();
  assert.equal(clean.status, 0, clean.stderr);
  for (const relativePath of sourcePaths) {
    write(path.join(root, relativePath), "debugger;\n");
    const rejected = inspectLint();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /noDebugger/);
    write(path.join(root, relativePath), "export const VALUE = 1;\n");
  }
});

test("Rust platform accessの開発入口は固定Cargo commandだけを使う", () => {
  const coordinatorRoot = path.join(
    repositoryRoot,
    "40_Develop",
    "coordinator",
  );
  const packageJson: unknown = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  );
  const packageRecord = record(packageJson);
  const scripts = packageRecord && record(packageRecord.scripts);
  assert.deepEqual(
    scripts &&
      Object.fromEntries(
        [
          "platform-access:build",
          "platform-access:coverage",
          "platform-access:format:check",
          "platform-access:lint",
          "platform-access:native-bootstrap-build",
          "platform-access:native-bootstrap-lint",
          "platform-access:native-bootstrap-pe",
          "platform-access:test",
          "platform-access:worker-build",
          "platform-access:worker-lint",
        ].map((name) => [name, scripts[name]]),
      ),
    {
      "platform-access:build":
        "npm run platform-access:worker-build && npm run platform-access:native-bootstrap-build",
      "platform-access:coverage":
        "node ./scripts/check-platform-access-coverage.ts",
      "platform-access:format:check":
        "cargo fmt --manifest-path ../platform-access/Cargo.toml --check",
      "platform-access:lint":
        "npm run platform-access:worker-lint && npm run platform-access:native-bootstrap-lint",
      "platform-access:native-bootstrap-build":
        "node ./scripts/build-native-bootstrap.ts",
      "platform-access:native-bootstrap-lint":
        "cargo +1.94.1-x86_64-pc-windows-msvc clippy --manifest-path ../platform-access/Cargo.toml --frozen --release --target x86_64-pc-windows-msvc --bin coordinator --features native-bootstrap-release -- -D warnings",
      "platform-access:native-bootstrap-pe":
        "node ./scripts/check-native-bootstrap-pe.ts",
      "platform-access:test":
        "cargo +1.94.1-x86_64-pc-windows-msvc test --manifest-path ../platform-access/Cargo.toml --frozen --all-features --target x86_64-pc-windows-msvc",
      "platform-access:worker-build":
        "cargo +1.94.1-x86_64-pc-windows-msvc build --manifest-path ../platform-access/Cargo.toml --frozen --release --target x86_64-pc-windows-msvc --bin crdd-platform-access",
      "platform-access:worker-lint":
        "cargo +1.94.1-x86_64-pc-windows-msvc clippy --manifest-path ../platform-access/Cargo.toml --frozen --target x86_64-pc-windows-msvc --bin crdd-platform-access -- -D warnings",
    },
  );
});
type CheckerRun = SpawnSyncReturns<string> & { report: CheckerReport };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Reflect.ownKeys(value)
          .filter((key) => typeof key === "string")
          .map((key) => [key, Reflect.get(value, key)]),
      )
    : null;
}

function reportString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string")
    throw new Error(`checker_report_${key}_invalid`);
  return candidate;
}

function reportBoolean(value: Record<string, unknown>, key: string): boolean {
  const candidate = value[key];
  if (typeof candidate !== "boolean")
    throw new Error(`checker_report_${key}_invalid`);
  return candidate;
}

function reportNullableBoolean(
  value: Record<string, unknown>,
  key: string,
): boolean | null {
  const candidate = value[key];
  if (candidate !== null && typeof candidate !== "boolean") {
    throw new Error(`checker_report_${key}_invalid`);
  }
  return candidate;
}

function reportNullableString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const candidate = value[key];
  if (candidate !== null && typeof candidate !== "string") {
    throw new Error(`checker_report_${key}_invalid`);
  }
  return candidate;
}

function reportStringArray(
  value: Record<string, unknown>,
  key: string,
): string[] {
  const candidate = value[key];
  if (
    !Array.isArray(candidate) ||
    candidate.some((item) => typeof item !== "string")
  ) {
    throw new Error(`checker_report_${key}_invalid`);
  }
  return candidate.map((item) => {
    if (typeof item !== "string")
      throw new Error(`checker_report_${key}_invalid`);
    return item;
  });
}

function reportNumberRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, number> {
  const candidate = record(value[key]);
  if (!candidate) throw new Error(`checker_report_${key}_invalid`);
  const result: Record<string, number> = {};
  for (const [name, entry] of Object.entries(candidate)) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      throw new Error(`checker_report_${key}_${name}_invalid`);
    }
    result[name] = entry;
  }
  return result;
}

function reportState(
  value: Record<string, unknown>,
  key: string,
): Record<string, boolean | string | null> {
  const candidate = record(value[key]);
  if (!candidate) throw new Error(`checker_report_${key}_invalid`);
  const result: Record<string, boolean | string | null> = {};
  for (const [name, entry] of Object.entries(candidate)) {
    if (
      entry !== null &&
      typeof entry !== "boolean" &&
      typeof entry !== "string"
    ) {
      throw new Error(`checker_report_${key}_${name}_invalid`);
    }
    result[name] = entry;
  }
  return result;
}

function reportFindings(value: Record<string, unknown>): CheckerFinding[] {
  const findings = value.findings;
  if (!Array.isArray(findings))
    throw new Error("checker_report_findings_invalid");
  return findings.map((finding) => {
    const item = record(finding);
    if (!item) throw new Error("checker_report_invalid_finding");
    return Object.freeze({
      severity: reportString(item, "severity"),
      code: reportString(item, "code"),
      path: reportString(item, "path"),
      message: reportString(item, "message"),
    });
  });
}

function reportReferences(
  value: Record<string, unknown>,
): CheckerReport["references"] {
  if (value.references === null) return null;
  const references = record(value.references);
  if (
    !references ||
    !Array.isArray(references.inbound) ||
    !Array.isArray(references.outbound)
  ) {
    throw new Error("checker_report_references_invalid");
  }
  const inboundReferences = references.inbound.map((entry) => {
    const item = record(entry);
    if (!item) throw new Error("checker_report_inbound_invalid");
    const count = item.count;
    if (typeof count !== "number" || !Number.isFinite(count)) {
      throw new Error("checker_report_inbound_count_invalid");
    }
    return Object.freeze({ count, source: reportString(item, "source") });
  });
  const outboundReferences = references.outbound.map((entry) => {
    const item = record(entry);
    if (!item) throw new Error("checker_report_outbound_invalid");
    const count = item.count;
    if (typeof count !== "number" || !Number.isFinite(count)) {
      throw new Error("checker_report_outbound_count_invalid");
    }
    return Object.freeze({ count, target: reportString(item, "target") });
  });
  return Object.freeze({
    inbound: inboundReferences,
    outbound: outboundReferences,
  });
}

function parseCheckerReport(source: string): CheckerReport {
  if (source === "") {
    return Object.freeze({
      findings: [],
      baseline_submodule: false,
      baseline_submodule_initialized: null,
      baseline_submodule_state: {},
      change_trace_layout: "",
      check_mode: "",
      discovery_exclusions: [],
      discovery_git_failure: null,
      discovery_source: "",
      executed_at: "",
      expanded_scope: [],
      gitlink_boundaries: [],
      gitlink_detection: "",
      global_checks: [],
      metrics: {},
      recognized_change_trace_paths: [],
      references: null,
      repository_mode: "",
      unchecked: [],
    });
  }
  const parsed: unknown = JSON.parse(source);
  const value = record(parsed);
  if (!value) throw new Error("checker_report_invalid");
  return Object.freeze({
    findings: reportFindings(value),
    baseline_submodule: reportBoolean(value, "baseline_submodule"),
    baseline_submodule_initialized: reportNullableBoolean(
      value,
      "baseline_submodule_initialized",
    ),
    baseline_submodule_state: reportState(value, "baseline_submodule_state"),
    change_trace_layout: reportString(value, "change_trace_layout"),
    check_mode: reportString(value, "check_mode"),
    discovery_exclusions: reportStringArray(value, "discovery_exclusions"),
    discovery_git_failure: reportNullableString(value, "discovery_git_failure"),
    discovery_source: reportString(value, "discovery_source"),
    executed_at: reportString(value, "executed_at"),
    expanded_scope: reportStringArray(value, "expanded_scope"),
    gitlink_boundaries: reportStringArray(value, "gitlink_boundaries"),
    gitlink_detection: reportString(value, "gitlink_detection"),
    global_checks: reportStringArray(value, "global_checks"),
    metrics: reportNumberRecord(value, "metrics"),
    recognized_change_trace_paths: reportStringArray(
      value,
      "recognized_change_trace_paths",
    ),
    references: reportReferences(value),
    repository_mode: reportString(value, "repository_mode"),
    unchecked: reportStringArray(value, "unchecked"),
  });
}

const fixtures: string[] = [];
// Repository-local TEMP must not turn a deliberately non-Git fixture into
// a subdirectory of the maintenance repository. Fixture-owned .git remains valid.
const previousGitCeiling = process.env.GIT_CEILING_DIRECTORIES;
process.env.GIT_CEILING_DIRECTORIES = path.resolve(os.tmpdir());
const requiredFolders = [
  "00_CRDD",
  "01_Discovery",
  "02_UX",
  "03_IA",
  "04_UI",
  "05_SPEC",
  "06_Architecture",
  "07_Quality",
  "19_Workflows",
  "40_Develop",
  "90_Release",
  "99_Roadmap",
];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-check-"));
  fixtures.push(root);
  return root;
}

after(() => {
  for (const root of fixtures) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (previousGitCeiling === undefined) {
    delete process.env.GIT_CEILING_DIRECTORIES;
  } else {
    process.env.GIT_CEILING_DIRECTORIES = previousGitCeiling;
  }
});

function makeStructure(root: string): void {
  for (const folder of requiredFolders) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
}

function write(file: string, content = ""): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function initializeGit(root: string): void {
  const initialized = spawnSync("git", ["init", "--quiet", root], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
}

function addGitlink(root: string, relativePath: string): void {
  const tree = spawnSync("git", ["-C", root, "mktree"], {
    encoding: "utf8",
    input: "",
  });
  assert.equal(tree.status, 0, tree.stderr);
  const commit = spawnSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit-tree",
      tree.stdout.trim(),
      "-m",
      "gitlink fixture",
    ],
    { encoding: "utf8" },
  );
  assert.equal(commit.status, 0, commit.stderr);
  const updated = spawnSync(
    "git",
    [
      "-C",
      root,
      "update-index",
      "--add",
      "--cacheinfo",
      "160000",
      commit.stdout.trim(),
      relativePath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(updated.status, 0, updated.stderr);
}

function runChecker(root: string, ...extraArguments: string[]): CheckerRun {
  const result = spawnSync(
    process.execPath,
    [checker, "--root", root, "--json", "--summary", ...extraArguments],
    { encoding: "utf8" },
  );
  return {
    ...result,
    report: parseCheckerReport(result.stdout),
  };
}

function runWithEnv(
  root: string,
  env: Readonly<Record<string, string>>,
  ...extraArguments: string[]
): CheckerRun {
  const result = spawnSync(
    process.execPath,
    [checker, "--root", root, "--json", "--summary", ...extraArguments],
    { encoding: "utf8", env: { ...process.env, ...env } },
  );
  return {
    ...result,
    report: parseCheckerReport(result.stdout),
  };
}

function runWithFault(
  root: string,
  fault: string,
  target: string,
  env: Readonly<Record<string, string>> = {},
  ...extraArguments: string[]
): CheckerRun {
  const nodeOptions = [process.env.NODE_OPTIONS, `--import=${faultInjector}`]
    .filter(Boolean)
    .join(" ");
  return runWithEnv(
    root,
    {
      ...env,
      NODE_OPTIONS: nodeOptions,
      CRDD_CHECK_FAULT: fault,
      CRDD_CHECK_FAULT_ROOT: root,
      CRDD_CHECK_FAULT_TARGET: target,
    },
    ...extraArguments,
  );
}

function runRaw(...checkerArguments: string[]) {
  return spawnSync(process.execPath, [checker, ...checkerArguments], {
    encoding: "utf8",
  });
}

test("公式リポジトリではREADMEと正本文書の版を比較する", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "README.md"), "Status: **v0.9.0**\n");
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "readme-version-mismatch",
    ),
  );
});

for (const label of ["Version", "Status"]) {
  for (const suffix of ["", " — 版の説明"]) {
    for (const version of ["v0.16.0", "v0.15.0"]) {
      test(`README先頭の版表示を照合する: ${label}/${version}/${suffix}`, () => {
        const root = currentChangelogFixture(
          ["- `migration_required: false`"],
          ["- `migration_required: false`"],
        );
        write(
          path.join(root, "README.md"),
          `# CRDD\n\n**Context Repository-Driven Development**\n\n\x60\x60\x60text\nVersion: **v9.0.0**\n\x60\x60\x60\n\n${label}: **${version}${suffix}**\n\n## 本文\nVersion: **v8.0.0**\n`,
        );
        const result = runChecker(root);
        const findings = result.report.findings.filter(
          (item) => item.code === "readme-version-mismatch",
        );
        assert.equal(findings.length, version === "v0.16.0" ? 0 : 1);
        if (version !== "v0.16.0") {
          assert.equal(
            findings[0].message,
            `README=${version}, canonical=v0.16.0`,
          );
        } else {
          assert.equal(
            result.status,
            0,
            JSON.stringify(result.report.findings),
          );
        }
      });
    }
  }
}

for (const body of [
  "## 本文\nVersion: **v9.0.0**",
  "本文の例です。\nStatus: **v9.0.0**",
  "```markdown\nVersion: **v9.0.0**\n```",
  "~~~markdown\nStatus: **v9.0.0**\n~~~",
  "```markdown\nVersion: **v9.0.0**",
]) {
  test(`README先頭にない版を本文やfenceから補完しない: ${body.split("\n")[0]}`, () => {
    const root = currentChangelogFixture(
      ["- `migration_required: false`"],
      ["- `migration_required: false`"],
    );
    write(path.join(root, "README.md"), `# CRDD\n\n${body}\n`);
    const result = runChecker(root);
    assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  });
}

test("READMEの太字でないVersion表示も現行版比較へ接続する", () => {
  const root = currentChangelogFixture(
    ["- `migration_required: false`"],
    ["- `migration_required: false`"],
  );
  write(path.join(root, "README.md"), "Version: v0.15.0\n");
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "readme-version-mismatch",
    ),
  );
});

function currentChangelogFixture(
  englishLines: readonly string[],
  japaneseLines: readonly string[],
) {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      ...englishLines,
      "### v0.15.0 — Prior",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.16.0 — 例",
      ...japaneseLines,
      "### v0.15.0 — 過去",
      "- `migration_required: false`",
    ].join("\n"),
  );
  return root;
}

test("公式CHANGELOGの現行移行注記に英日必須境界を要求する", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      "- `migration_required: true`",
      "- `change_classification: breaking`",
      "- Required: example",
      "- Conditional: example",
      "- Not required: example",
      "- Verification: example",
      "- Known limitation: example",
      "### v0.15.0 — Prior",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.16.0 — 例",
      "- `migration_required: true`",
      "- `change_classification: breaking`",
      "- 必須: 例",
      "- 条件付き: 例",
      "- 不要: 例",
      "- 復旧: 例",
      "- 延期時の既知リスク: 例",
      "- 検証: 例",
      "- 既知の制限: 例",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  const finding = result.report.findings.find(
    (item) => item.code === "migration-note-incomplete",
  );
  assert.ok(finding);
  assert.match(finding.message, /Rollback \/ recovery/);
  assert.match(finding.message, /Known risk if deferred/);
});

test("公式CHANGELOGの完全な英日移行注記を受け入れる", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      "- `migration_required: true`",
      "- `change_classification: breaking`",
      "- Required: example",
      "- Conditional: example",
      "- Not required: example",
      "- Rollback / recovery: example",
      "- Known risk if deferred: example",
      "- Verification: example",
      "- Known limitation: example",
      "## 日本語",
      "### v0.16.0 — 例",
      "- `migration_required: true`",
      "- `change_classification: breaking`",
      "- 必須: 例",
      "- 条件付き: 例",
      "- 不要: 例",
      "- 復旧: 例",
      "- 延期時の既知リスク: 例",
      "- 検証: 例",
      "- 既知の制限: 例",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some((item) =>
      [
        "current-changelog-release-missing",
        "migration-note-incomplete",
      ].includes(item.code),
    ),
    false,
  );
});

for (const body of [
  "## 本文\n```markdown\nVersion: v9.0.0\nStatus: Candidate\nReleased Baseline: v8.0.0\n```",
  "本文の例です。\nVersion: v9.0.0\nStatus: Candidate\nReleased Baseline: v8.0.0",
  "## 本文\nVersion: v9.0.0\nStatus: Candidate\nReleased Baseline: v8.0.0",
]) {
  test(`標準ヘッダーはStableと本文例を分離する: ${body.split("\n")[0]}/${body.split("\n")[1]}`, () => {
    const root = currentChangelogFixture(
      ["- `migration_required: false`"],
      ["- `migration_required: false`"],
    );
    write(path.join(root, "README.md"), "Status: **v0.16.0 Stable**\n");
    write(
      path.join(root, "01_Principles.md"),
      `<a id="principles"></a>\n\n# 原則\n\nVersion: v0.16.0\nStatus: Stable\nOwner: Team\n\n${body}\n`,
    );
    const result = runChecker(root);
    assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  });
}

for (const body of [
  "```markdown\nReleased Baseline: v0.16.0\n```",
  "本文の例です。\nReleased Baseline: v0.16.0",
  "## 本文\nReleased Baseline: v0.16.0",
]) {
  test(`標準ヘッダーのCandidate基準版を本文から補完しない: ${body.split("\n")[0]}`, () => {
    const root = fixture();
    makeStructure(path.join(root, "template"));
    write(
      path.join(root, "01_Principles.md"),
      `# 原則\n\nVersion: v0.17.0\nStatus: Candidate\n\n${body}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (item) => item.code === "candidate-released-baseline-mismatch",
      ),
    );
  });
}

test("標準ヘッダーにないVersionとStatusを本文から補完しない", () => {
  const root = currentChangelogFixture(
    ["- `migration_required: false`"],
    ["- `migration_required: false`"],
  );
  write(path.join(root, "README.md"), "Status: **v0.16.0 Stable**\n");
  write(
    path.join(root, "02_Example.md"),
    "# 例\n\nOwner: Team\n\n本文の例です。\nVersion: v9.0.0\nStatus: Candidate\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
});

for (const labelStyle of ["旧表現", "新表現"]) {
  for (const placement of ["本文", "欠落", "fence", "引用", "過去版"]) {
    test(`移行注記の閉じた同義表現: ${labelStyle}/${placement}`, () => {
      const englishMarkers = [
        labelStyle === "旧表現"
          ? "- Not required: example"
          : "- Not required for adopting projects: example",
      ];
      const japaneseMarkers =
        labelStyle === "旧表現"
          ? ["- 不要: 例", "- 復旧: 例", "- 既知の制限: 例"]
          : [
              "- 採用プロジェクトでは不要: 例",
              "- 切戻し／復旧: 例",
              "- 既知の限界: 例",
            ];
      const placeMarkers = (markers: readonly string[]): readonly string[] => {
        if (placement === "本文") return markers;
        if (placement === "fence") return ["```markdown", ...markers, "```"];
        if (placement === "引用") return markers.map((line) => `> ${line}`);
        return [];
      };
      const root = currentChangelogFixture(
        [
          "- `migration_required: true`",
          "- `change_classification: breaking`",
          "- Required: example",
          "- Conditional: example",
          "- Rollback / recovery: example",
          "- Known risk if deferred: example",
          "- Verification: example",
          "- Known limitation: example",
          ...placeMarkers(englishMarkers),
        ],
        [
          "- `migration_required: true`",
          "- `change_classification: breaking`",
          "- 必須: 例",
          "- 条件付き: 例",
          "- 延期時の既知リスク: 例",
          "- 検証: 例",
          ...placeMarkers(japaneseMarkers),
        ],
      );
      write(path.join(root, "README.md"), "Status: **v0.16.0 Stable**\n");
      if (placement === "過去版") {
        const changelogPath = path.join(root, "CHANGELOG.md");
        write(
          changelogPath,
          fs
            .readFileSync(changelogPath, "utf8")
            .replace(
              "### v0.15.0 — Prior",
              `### v0.15.0 — Prior\n${englishMarkers.join("\n")}`,
            )
            .replace(
              "### v0.15.0 — 過去",
              `### v0.15.0 — 過去\n${japaneseMarkers.join("\n")}`,
            ),
        );
      }
      const result = runChecker(root);
      const findings = result.report.findings.filter(
        (item) => item.code === "migration-note-incomplete",
      );
      if (placement === "本文") {
        assert.equal(result.status, 0, JSON.stringify(result.report.findings));
      } else {
        assert.equal(
          findings.length,
          2,
          JSON.stringify(result.report.findings),
        );
        assert.ok(findings.some((item) => /Not required/u.test(item.message)));
        assert.ok(
          findings.some((item) => /不要.*復旧.*既知の制限/u.test(item.message)),
        );
      }
    });
  }
}

for (const labelStyle of ["旧表現", "新表現"]) {
  const englishLabels = [
    "Required",
    "Conditional",
    labelStyle === "旧表現"
      ? "Not required"
      : "Not required for adopting projects",
    "Rollback / recovery",
    "Known risk if deferred",
    "Verification",
    "Known limitation",
  ];
  const japaneseLabels = [
    "必須",
    "条件付き",
    labelStyle === "旧表現" ? "不要" : "採用プロジェクトでは不要",
    labelStyle === "旧表現" ? "復旧" : "切戻し／復旧",
    "延期時の既知リスク",
    "検証",
    labelStyle === "旧表現" ? "既知の制限" : "既知の限界",
  ];
  for (const [language, labels] of Object.entries({
    English: englishLabels,
    日本語: japaneseLabels,
  })) {
    for (const label of labels) {
      test(`移行注記の説明を単独で要求する: ${labelStyle}/${language}/${label}`, () => {
        for (const explanation of ["", " \t　 ", " 説明あり"]) {
          const createLines = (
            entryLanguage: string,
            entryLabels: readonly string[],
          ) => [
            "- `migration_required: true`",
            "- `change_classification: breaking`",
            ...entryLabels.map(
              (entryLabel) =>
                `- ${entryLabel}:${entryLanguage === language && entryLabel === label ? explanation : " 説明あり"}`,
            ),
          ];
          const root = currentChangelogFixture(
            createLines("English", englishLabels),
            createLines("日本語", japaneseLabels),
          );
          const result = runChecker(root);
          const findings = result.report.findings.filter(
            (item) => item.code === "migration-note-incomplete",
          );
          if (explanation.trim() !== "") {
            assert.equal(
              result.status,
              0,
              JSON.stringify(result.report.findings),
            );
          } else {
            assert.equal(result.status, 1);
            assert.equal(
              findings.length,
              1,
              JSON.stringify(result.report.findings),
            );
            assert.ok(findings[0].message.startsWith(`${language}:`));
            const canonicalLabel =
              label === "Not required for adopting projects"
                ? "Not required"
                : label === "採用プロジェクトでは不要"
                  ? "不要"
                  : label === "切戻し／復旧"
                    ? "復旧"
                    : label === "既知の限界"
                      ? "既知の制限"
                      : label;
            assert.equal(
              findings[0].message,
              `${language}: v0.16.0 migration note is missing ${canonicalLabel}.`,
            );
          }
        }
      });
    }
  }
}

test("Candidate文書ではReleased BaselineのCHANGELOGを検査する", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(
    path.join(root, "01_Principles.md"),
    [
      "Version: v0.17.0",
      "Status: Candidate",
      "Released Baseline: v0.16.0",
    ].join("\n"),
  );
  write(path.join(root, "README.md"), "Status: **v0.17.0 Candidate**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      "- `migration_required: true`",
      "- `change_classification: breaking`",
      "- Required: example",
      "- Conditional: example",
      "- Not required: example",
      "- Rollback / recovery: example",
      "- Known risk if deferred: example",
      "- Verification: example",
      "- Known limitation: example",
      "## 日本語",
      "### v0.16.0 — 例",
      "- `migration_required: true`",
      "- `change_classification: breaking`",
      "- 必須: 例",
      "- 条件付き: 例",
      "- 不要: 例",
      "- 復旧: 例",
      "- 延期時の既知リスク: 例",
      "- 検証: 例",
      "- 既知の制限: 例",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some((item) =>
      [
        "candidate-released-baseline-mismatch",
        "current-changelog-release-missing",
      ].includes(item.code),
    ),
    false,
    `${JSON.stringify(result.report.findings)}\n${result.stderr}`,
  );
});

test("Candidate文書のReleased Baseline欠落を拒否する", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(
    path.join(root, "01_Principles.md"),
    "Version: v0.17.0\nStatus: Candidate\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "candidate-released-baseline-mismatch",
    ),
  );
});

for (const status of ["Draft", "Stable"]) {
  test(`${status}文書に残ったReleased Baselineを拒否する`, () => {
    const root = fixture();
    makeStructure(path.join(root, "template"));
    write(
      path.join(root, "01_Principles.md"),
      `Version: v0.17.0\nStatus: ${status}\nReleased Baseline: v0.16.0\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (item) => item.code === "released-baseline-outside-candidate",
      ),
    );
  });
}

test("公式CHANGELOGに日本語区分がない場合は現行リリース欠落を返す", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      "- `migration_required: false`",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "current-changelog-release-missing" &&
        /日本語/u.test(item.message),
    ),
  );
});

test("公式CHANGELOGの日本語区分に現行リリースがない場合は欠落を返す", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.15.0 — 例",
      "- `migration_required: false`",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "current-changelog-release-missing" &&
        /日本語/u.test(item.message),
    ),
  );
});

test("移行不要の現行英日リリースには移行注記区分を要求しない", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Example",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.16.0 — 例",
      "- `migration_required: false`",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some(
      (item) => item.code === "migration-note-incomplete",
    ),
    false,
  );
});

test("現行移行要否の欠落を判定不能として返す", () => {
  const root = currentChangelogFixture([], ["- `migration_required: false`"]);
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "migration-status-undetermined" &&
        /English/u.test(item.message),
    ),
  );
});

test("現行移行要否の不正値を判定不能として返す", () => {
  const root = currentChangelogFixture(
    ["- `migration_required: maybe`"],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "migration-status-undetermined",
    ),
  );
});

test("現行移行要否の同値重複を判定不能として返す", () => {
  const root = currentChangelogFixture(
    ["- `migration_required: false`", "- `migration_required: false`"],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "migration-status-undetermined",
    ),
  );
});

test("現行移行要否の競合宣言を判定不能として返す", () => {
  const root = currentChangelogFixture(
    ["- `migration_required: true`", "- `migration_required: false`"],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "migration-status-undetermined",
    ),
  );
});

test("現行英日移行要否の不一致を返す", () => {
  const root = currentChangelogFixture(
    ["- `migration_required: true`"],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "migration-status-mismatch",
    ),
  );
});

test("閉じたYAML fenceの現行移行宣言を受け入れる", () => {
  const englishCategories = [
    "- Required: example",
    "- Conditional: example",
    "- Not required: example",
    "- Rollback / recovery: example",
    "- Known risk if deferred: example",
    "- Verification: example",
    "- Known limitation: example",
  ];
  const japaneseCategories = [
    "- 必須: 例",
    "- 条件付き: 例",
    "- 不要: 例",
    "- 復旧: 例",
    "- 延期時の既知リスク: 例",
    "- 検証: 例",
    "- 既知の制限: 例",
  ];
  const root = currentChangelogFixture(
    [
      "```yaml",
      "migration_required: true # current",
      "change_classification: breaking",
      "```",
      ...englishCategories,
    ],
    [
      "```yml",
      "migration_required: true",
      "change_classification: breaking",
      "```",
      ...japaneseCategories,
    ],
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some((item) =>
      [
        "migration-status-undetermined",
        "migration-status-mismatch",
        "migration-note-incomplete",
      ].includes(item.code),
    ),
    false,
  );
});

test("説明文中の移行語を宣言として扱わない", () => {
  const root = currentChangelogFixture(
    ["This example says migration_required: false in prose."],
    ["本文の例に migration_required: false と書く。"],
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.filter(
      (item) => item.code === "migration-status-undetermined",
    ).length,
    2,
  );
});

test("非YAML fence内の移行宣言を判定データとして扱わない", () => {
  const root = currentChangelogFixture(
    ["```text", "- `migration_required: false`", "```"],
    ["```markdown", "- `migration_required: false`", "```"],
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.filter(
      (item) => item.code === "migration-status-undetermined",
    ).length,
    2,
  );
});

test("非YAML fence内の移行注記区分を成立根拠へ流用しない", () => {
  const fencedEnglishLines = [
    "```text",
    "- Required: example",
    "- Conditional: example",
    "- Not required: example",
    "- Rollback / recovery: example",
    "- Known risk if deferred: example",
    "- Verification: example",
    "- Known limitation: example",
    "```",
  ];
  const fencedJapaneseLines = [
    "```text",
    "- 必須: 例",
    "- 条件付き: 例",
    "- 不要: 例",
    "- 復旧: 例",
    "- 延期時の既知リスク: 例",
    "- 検証: 例",
    "- 既知の制限: 例",
    "```",
  ];
  const result = runChecker(
    currentChangelogFixture(
      [
        "- `migration_required: true`",
        "- `change_classification: breaking`",
        ...fencedEnglishLines,
      ],
      [
        "- `migration_required: true`",
        "- `change_classification: breaking`",
        ...fencedJapaneseLines,
      ],
    ),
  );
  assert.equal(
    result.report.findings.filter(
      (item) => item.code === "migration-note-incomplete",
    ).length,
    2,
  );
});

test("fence外の有効宣言と非YAML例示を重複扱いしない", () => {
  const exampleLines = ["```", "- `migration_required: true`", "```"];
  const result = runChecker(
    currentChangelogFixture(
      ["- `migration_required: false`", ...exampleLines],
      ["- `migration_required: false`", ...exampleLines],
    ),
  );
  assert.equal(
    result.report.findings.some((item) =>
      ["migration-status-undetermined", "migration-status-mismatch"].includes(
        item.code,
      ),
    ),
    false,
  );
});

test("チルダと大文字YAML fenceの宣言を受け入れる", () => {
  const root = currentChangelogFixture(
    ["   ~~~YAML", "migration_required: false", "   ~~~"],
    ["~~~YML", "migration_required: false", "~~~~"],
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some(
      (item) => item.code === "migration-status-undetermined",
    ),
    false,
  );
});

test("長いbacktick fence内の短いbacktick列でfenceを閉じない", () => {
  const exampleLines = [
    "````text",
    "```",
    "- `migration_required: true`",
    "````",
  ];
  const result = runChecker(
    currentChangelogFixture(
      ["- `migration_required: false`", ...exampleLines],
      ["- `migration_required: false`", ...exampleLines],
    ),
  );
  assert.equal(
    result.report.findings.some(
      (item) => item.code === "migration-status-undetermined",
    ),
    false,
  );
});

test("閉じていない非YAML fence内の見出しや宣言を構造へ戻さない", () => {
  const root = currentChangelogFixture(
    ["```text", "- `migration_required: false`"],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "current-changelog-release-missing" &&
        /日本語/u.test(item.message),
    ),
  );
});

test("YAML fence内の言語見出しと現行Release見出しを構造として扱わない", () => {
  const root = currentChangelogFixture(
    [
      "```yaml",
      "## 日本語",
      "### v0.16.0 — fenced",
      "migration_required: false",
      "```",
      "- `migration_required: false`",
    ],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some(
      (item) => item.code === "current-changelog-release-missing",
    ),
    false,
  );
});

test("同じ言語区分の重複を一部採用せずエラーにする", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.16.0\n");
  write(path.join(root, "README.md"), "Status: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — First",
      "- `migration_required: false`",
      "## English",
      "### v0.16.0 — Second",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.16.0 — 一つ目",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.16.0 — 二つ目",
      "- `migration_required: false`",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "current-changelog-release-missing" &&
        /English.*found 2/u.test(item.message),
    ),
  );
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "current-changelog-release-missing" &&
        /日本語.*found 2/u.test(item.message),
    ),
  );
});

test("非YAML fence内の言語見出しと現行Release見出しを無視する", () => {
  const root = currentChangelogFixture(
    [
      "~~~markdown",
      "## English",
      "## 日本語",
      "### v0.16.0 — fenced",
      "- `migration_required: true`",
      "~~~",
      "- `migration_required: false`",
    ],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some(
      (item) => item.code === "current-changelog-release-missing",
    ),
    false,
  );
  assert.equal(
    result.report.findings.some(
      (item) => item.code === "migration-status-undetermined",
    ),
    false,
  );
});

test("現行リリース節の重複をエラーにする", () => {
  const root = currentChangelogFixture(
    [
      "- `migration_required: false`",
      "### v0.16.0 — Duplicate",
      "- `migration_required: false`",
    ],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "current-changelog-release-missing" &&
        /found 2/u.test(item.message),
    ),
  );
});

test("過去リリースの宣言を現行リリースへ流用しない", () => {
  const root = currentChangelogFixture([], []);
  const result = runChecker(root);
  assert.equal(
    result.report.findings.filter(
      (item) => item.code === "migration-status-undetermined",
    ).length,
    2,
  );
});

test("現行英日変更分類の不一致を返す", () => {
  const completeEnglishLines = [
    "- `migration_required: true`",
    "- `change_classification: breaking`",
    "- Required: example",
    "- Conditional: example",
    "- Not required: example",
    "- Rollback / recovery: example",
    "- Known risk if deferred: example",
    "- Verification: example",
    "- Known limitation: example",
  ];
  const completeJapaneseLines = [
    "- `migration_required: true`",
    "- `change_classification: normative`",
    "- 必須: 例",
    "- 条件付き: 例",
    "- 不要: 例",
    "- 復旧: 例",
    "- 延期時の既知リスク: 例",
    "- 検証: 例",
    "- 既知の制限: 例",
  ];
  const result = runChecker(
    currentChangelogFixture(completeEnglishLines, completeJapaneseLines),
  );
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "migration-status-mismatch",
    ),
  );
});

test("移行が必要な現行節の変更分類欠落を判定不能として返す", () => {
  const englishCategories = [
    "- `migration_required: true`",
    "- Required: example",
    "- Conditional: example",
    "- Not required: example",
    "- Rollback / recovery: example",
    "- Known risk if deferred: example",
    "- Verification: example",
    "- Known limitation: example",
  ];
  const japaneseCategories = [
    "- `migration_required: true`",
    "- `change_classification: breaking`",
    "- 必須: 例",
    "- 条件付き: 例",
    "- 不要: 例",
    "- 復旧: 例",
    "- 延期時の既知リスク: 例",
    "- 検証: 例",
    "- 既知の制限: 例",
  ];
  const result = runChecker(
    currentChangelogFixture(englishCategories, japaneseCategories),
  );
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "migration-status-undetermined" &&
        /change_classification/u.test(item.message),
    ),
  );
});

test("移行が必要な現行節の変更分類重複を判定不能として返す", () => {
  const englishCategories = [
    "- `migration_required: true`",
    "- `change_classification: breaking`",
    "- `change_classification: breaking`",
    "- Required: example",
    "- Conditional: example",
    "- Not required: example",
    "- Rollback / recovery: example",
    "- Known risk if deferred: example",
    "- Verification: example",
    "- Known limitation: example",
  ];
  const japaneseCategories = [
    "- `migration_required: true`",
    "- `change_classification: breaking`",
    "- 必須: 例",
    "- 条件付き: 例",
    "- 不要: 例",
    "- 復旧: 例",
    "- 延期時の既知リスク: 例",
    "- 検証: 例",
    "- 既知の制限: 例",
  ];
  const result = runChecker(
    currentChangelogFixture(englishCategories, japaneseCategories),
  );
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "migration-status-undetermined" &&
        /change_classification/u.test(item.message),
    ),
  );
});

test("閉じていないYAML宣言を判定不能として返す", () => {
  const root = currentChangelogFixture(
    ["```yaml", "migration_required: false"],
    ["- `migration_required: false`"],
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "migration-status-undetermined" &&
        /unclosed-yaml-fence/u.test(item.message),
    ),
  );
});

test("Git管理された公式リポジトリではbaseline状態を非該当として返す", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.11.4\n");
  write(path.join(root, "README.md"), "Status: v0.11.4\n");
  initializeGit(root);

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.repository_mode, "official");
  assert.equal(result.report.baseline_submodule, false);
  assert.equal(result.report.baseline_submodule_state.worktree_present, null);
});

test("採用先の製品READMEはCRDD基準版と比較しない", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "README.md"), "Status: **v9.9.9**\n");
  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.findings.length, 0);
});

test("採用先では公式CHANGELOG専用の移行宣言検査を発火しない", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.16.0\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.16.0 — Product",
      "```text",
      "- `migration_required: true`",
      "```",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some((item) =>
      [
        "current-changelog-release-missing",
        "migration-status-undetermined",
        "migration-status-mismatch",
        "migration-note-incomplete",
      ].includes(item.code),
    ),
    false,
  );
});

test("採用先のCRDD正本文書間の版不一致は検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "00_CRDD", "02_Terminology.md"), "Version: v0.9.0\n");
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "version-mismatch",
    ),
  );
});

test("安定コンテキストIDを含むファイル名を拒否する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "REQ-000001.md"), "# requirement\n");
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "stable-id-in-filename",
    ),
  );
});

test("範囲指定でも全体不変条件を確認し、部分確認を明示する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "Discovery.md"), "# Discovery\n");
  write(path.join(root, "02_UX", "UX.md"), "[missing](missing.md)\n");
  write(path.join(root, "03_IA", "SPEC-000001.md"), "# invalid filename\n");
  const result = runChecker(root, "--scope", "01_Discovery");
  assert.equal(result.report.check_mode, "scoped");
  assert.ok(result.report.unchecked.length > 0);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "stable-id-in-filename",
    ),
  );
  assert.ok(
    !result.report.findings.some((finding) => finding.code === "broken-link"),
  );
});

test("全体確認は実行情報と件数を返す", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "Discovery.md"), "# Discovery\n");
  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.check_mode, "full");
  assert.equal(result.report.discovery_source, "walk-fallback");
  assert.equal(result.report.baseline_submodule, false);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.ok(result.report.unchecked.length > 0);
  assert.match(result.report.executed_at, /^\d{4}-\d{2}-\d{2}T/u);
  assert.ok(result.report.metrics.markdown_files_checked >= 1);
});

test("明示された安定コンテキストID定義の重複を検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "id: REQ-000001\n");
  write(path.join(root, "01_Discovery", "B.md"), "## REQ-000001 Requirement\n");
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "duplicate-stable-id-definition",
    ),
  );
});

test("変更トレースの誤配置を検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "CHG-000001.md"), "# change\n");
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "change-trace-placement",
    ),
  );
});

test("90_Release配下でもChangesツリー外の変更トレースを拒否する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "product-a", "archive", "CHG-000001.md"),
    "# change\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "change-trace-placement",
    ),
  );
});

test("階層化した変更領域の変更トレースと近接根拠を機械確認できる", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "product-a", "Changes", "CHG-000001.md"),
    "# change\n",
  );
  write(
    path.join(
      root,
      "90_Release",
      "product-a",
      "Changes",
      "Evidence",
      "CHG-000001_Verification.md",
    ),
    "# evidence\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.change_trace_layout, "hierarchy-tolerant");
  assert.deepEqual(result.report.recognized_change_trace_paths, [
    "90_Release/**/Changes/**/CHG-*.md",
  ]);
  assert.ok(
    result.report.global_checks.includes(
      "Change Trace inspection-path recognition (not canonical placement validation)",
    ),
  );
});

function officialConsolidationLedgerFixture(): string {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.11.4\n");
  write(path.join(root, "README.md"), "Status: v0.11.4\n");
  write(
    path.join(root, "90_Release", "Changes", "CHG-000002_Canonical.md"),
    "# 変更トレース: Canonical\n\n変更ID: CHG-000002\n",
  );
  const oldPath = path.join(root, "90_Release", "Changes", "CHG-000001_Old.md");
  const oldContent = "# 変更トレース: Old\n\n変更ID: CHG-000001\n";
  write(oldPath, oldContent);
  initializeGit(root);
  assert.equal(
    spawnSync("git", ["-C", root, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "consolidation base fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  const commit = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout.trim();
  const tree = spawnSync(
    "git",
    ["-C", root, "show", "-s", "--format=%T", "HEAD"],
    {
      encoding: "utf8",
    },
  ).stdout.trim();
  const oldBytes = Buffer.from(oldContent, "utf8");
  const oldSha256 = createHash("sha256").update(oldBytes).digest("hex");
  fs.rmSync(oldPath);
  write(
    path.join(root, "90_Release", "Changes", "README.md"),
    [
      "# 未リリース変更トレース統合台帳",
      "",
      "<!-- crdd-change-trace-ledger-schema: 1 -->",
      "",
      `- 統合直前Commit: \`${commit}\``,
      `- 統合直前Tree: \`${tree}\``,
      "- 公式公開tag固定集合: 0件",
      "- 不変・非active歴史参照固定集合: 0 pair、0 source、0 target",
      "- 統合前の未リリースCHG: `CHG-000001`～`CHG-000002`の2件",
      "- 統合後: Canonical CHG 1件、統合済み旧ID 1件",
      "- Canonical CHG: `CHG-000002`",
      "",
      "## 公式公開tag固定集合",
      "",
      "| Tag | Ref Object Type | Ref Object OID | Peeled Commit OID | Peeled Tree OID |",
      "|---|---|---|---|---|",
      "",
      "## 不変・非active歴史参照固定集合",
      "",
      "| Source Evidence | Target Old Path |",
      "|---|---|",
      "",
      "## 統合済み旧ID",
      "",
      '<a id="consolidated-chg-000001"></a>',
      "",
      "### CHG-000001 → CHG-000002",
      "",
      "- 旧題名: fixture old",
      "- 旧Path: `90_Release/Changes/CHG-000001_Old.md`",
      "- 統合前判断: fixture",
      "- 変更分類: `non-breaking`",
      "- 移行／Release境界: fixture",
      "- Canonical CHG: [CHG-000002](CHG-000002_Canonical.md)",
      "- 統合理由: 同じ変更意図の途中段階",
      `- 固定原文: Commit \`${commit}\`、Tree \`${tree}\`、${oldBytes.length} byte、SHA-256 \`${oldSha256}\``,
      "- 関連Evidence: 専用Evidenceなし",
      "- 旧ID処置: 統合済み・永久欠番",
      "",
    ].join("\n"),
  );
  assert.equal(
    spawnSync("git", ["-C", root, "add", "-A"], { encoding: "utf8" }).status,
    0,
  );
  return root;
}

type ToolLayoutReference = {
  sourcePath: string;
  sourceSha256: string;
  targetPath: string;
  targetCommit: string;
  targetBlobOid: string;
  targetSha256: string;
  successorPath: string;
  anchor: string | null;
};

function toolLayoutHistoryFixture(hasOldAnchor = true) {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.11.4\n");
  write(path.join(root, "README.md"), "Status: v0.11.4\n");
  const sourcePath = "90_Release/Changes/Evidence/CHG-000017_Fixed.md";
  const sourceContent =
    "# fixed evidence\n\n[design](../../../tools/coordinator/architecture/README.md#old-anchor)\n[script](../../../tools/checker/example.ts)\n";
  const targets = [
    {
      targetPath: "tools/coordinator/architecture/README.md",
      content: hasOldAnchor
        ? '# old design\n\n<a id="old-anchor"></a>\n'
        : "# old design\n",
      successorPath: "06_Architecture/coordinator/01_Architecture.md",
      anchor: "old-anchor",
    },
    {
      targetPath: "tools/checker/example.ts",
      content: "export const VALUE = 1;\n",
      successorPath: "40_Develop/checker/example.ts",
      anchor: null,
    },
  ];
  write(path.join(root, sourcePath), sourceContent);
  for (const target of targets)
    write(path.join(root, target.targetPath), target.content);
  initializeGit(root);
  const git = (...args: string[]) => {
    const result = spawnSync("git", ["-C", root, ...args], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("config", "core.autocrlf", "false");
  git("add", ".");
  git(
    "-c",
    "user.name=CRDD Test",
    "-c",
    "user.email=crdd-test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixed evidence before relocation",
  );
  const commit = git("rev-parse", "HEAD");
  const sha256 = (text: string) =>
    createHash("sha256").update(text).digest("hex");
  const references: ToolLayoutReference[] = targets.map((target) => ({
    sourcePath,
    sourceSha256: sha256(sourceContent),
    targetPath: target.targetPath,
    targetCommit: commit,
    targetBlobOid: git("rev-parse", `${commit}:${target.targetPath}`),
    targetSha256: sha256(target.content),
    successorPath: target.successorPath,
    anchor: target.anchor,
  }));
  for (const target of targets) {
    fs.rmSync(path.join(root, target.targetPath));
    write(path.join(root, target.successorPath), target.content);
  }
  git("add", "-u", "--", "tools");
  const record = { schemaRevision: 1, evidenceCommit: commit, references };
  const ledgerPath = path.join(
    root,
    "90_Release/Changes/CHG-000017_Tools_Coding_Standards.md",
  );
  const save = () =>
    write(
      ledgerPath,
      `# 配置移行\n\n<!-- crdd-tool-layout-historical-references: 1 -->\n\x60\x60\x60json\n${JSON.stringify(record)}\n\x60\x60\x60\n`,
    );
  save();
  return {
    root,
    sourcePath,
    sourceContent,
    references,
    record,
    ledgerPath,
    git,
    save,
  };
}

test("配置移行の固定歴史参照はGit blobと旧anchorと非Markdown後継を照合する", () => {
  const state = toolLayoutHistoryFixture();
  const result = runChecker(state.root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(
    result.report.metrics.historical_references_identity_verified,
    2,
  );
  assert.equal(result.report.metrics.historical_references_active, 0);
  assert.equal(result.report.metrics.historical_references_indexed, 0);
});

test("配置移行の旧対象はindexだけに残っても拒否しstaged削除後に通す", () => {
  const state = toolLayoutHistoryFixture();
  const target = state.references[1];
  state.git(
    "update-index",
    "--add",
    "--cacheinfo",
    "100644",
    target.targetBlobOid,
    target.targetPath,
  );
  assert.equal(fs.existsSync(path.join(state.root, target.targetPath)), false);
  const blocked = runChecker(state.root);
  assert.equal(blocked.status, 1);
  assert.equal(blocked.report.metrics.historical_references_active, 0);
  assert.equal(blocked.report.metrics.historical_references_indexed, 1);
  assert.equal(
    blocked.report.metrics.historical_references_identity_verified,
    0,
  );
  assert.ok(
    blocked.report.findings.some(
      (finding) => finding.code === "invalid-tool-layout-historical-references",
    ),
  );
  state.git("add", "-u", "--", "tools");
  const completed = runChecker(state.root);
  assert.equal(completed.status, 0, JSON.stringify(completed.report.findings));
  assert.equal(completed.report.metrics.historical_references_indexed, 0);
  assert.equal(
    completed.report.metrics.historical_references_identity_verified,
    2,
  );
});

test("配置移行の旧対象がworktreeに再出現した場合はactiveとして観測する", () => {
  const state = toolLayoutHistoryFixture();
  write(
    path.join(state.root, state.references[1].targetPath),
    "export const VALUE = 2;\n",
  );
  const result = runChecker(state.root);
  assert.equal(result.status, 1);
  assert.equal(result.report.metrics.historical_references_active, 1);
  assert.equal(result.report.metrics.historical_references_indexed, 0);
  assert.equal(
    result.report.metrics.historical_references_identity_verified,
    0,
  );
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "invalid-tool-layout-historical-references",
    ),
  );
});

const layoutHistoryFailures: readonly [
  string,
  (state: ReturnType<typeof toolLayoutHistoryFixture>) => void,
][] = [
  [
    "原文変更",
    (state) =>
      write(
        path.join(state.root, state.sourcePath),
        `${state.sourceContent}\nchanged\n`,
      ),
  ],
  [
    "未知のsource-target組",
    (state) => {
      state.references[0].targetPath = "tools/checker/example.ts";
      state.references[0].anchor = "unknown";
    },
  ],
  [
    "存在しないGit commit",
    (state) => {
      state.record.evidenceCommit = "0".repeat(40);
    },
  ],
  [
    "target commit不足",
    (state) => {
      state.references[0].targetCommit = "0".repeat(40);
    },
  ],
  [
    "blob OID差",
    (state) => {
      state.references[0].targetBlobOid = state.references[1].targetBlobOid;
    },
  ],
  [
    "target hash差",
    (state) => {
      state.references[0].targetSha256 = "0".repeat(64);
    },
  ],
  [
    "source hash差",
    (state) => {
      state.references[0].sourceSha256 = "0".repeat(64);
    },
  ],
  [
    "後継欠落",
    (state) =>
      fs.rmSync(path.join(state.root, state.references[0].successorPath)),
  ],
  [
    "旧anchor差",
    (state) => {
      state.references[0].anchor = "absent-anchor";
    },
  ],
  [
    "重複登録",
    (state) => {
      state.references.push({ ...state.references[0] });
    },
  ],
  [
    "現行CHGへの例外拡張",
    (state) => {
      state.references[0].sourcePath =
        "90_Release/Changes/CHG-000017_Tools_Coding_Standards.md";
    },
  ],
  [
    "旧対象の再出現",
    (state) =>
      write(
        path.join(state.root, state.references[0].targetPath),
        "# old design\n",
      ),
  ],
];
for (const [label, mutate] of layoutHistoryFailures) {
  test(`配置移行の固定歴史参照は${label}を拒否する`, () => {
    const state = toolLayoutHistoryFixture();
    mutate(state);
    state.save();
    const result = runChecker(state.root);
    assert.equal(result.status, 1);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "invalid-tool-layout-historical-references",
      ),
      JSON.stringify(result.report.findings),
    );
    assert.equal(
      result.report.metrics.historical_references_identity_verified,
      0,
    );
  });
}

test("配置移行の固定歴史参照は後継のjunction境界を拒否する", () => {
  const state = toolLayoutHistoryFixture();
  const successorDirectory = path.join(
    state.root,
    "06_Architecture/coordinator",
  );
  const actualDirectory = path.join(state.root, "06_Architecture/actual");
  fs.renameSync(successorDirectory, actualDirectory);
  fs.symlinkSync(actualDirectory, successorDirectory, "junction");
  const result = runChecker(state.root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "invalid-tool-layout-historical-references",
    ),
  );
  assert.equal(
    result.report.metrics.historical_references_identity_verified,
    0,
  );
});

test("配置移行の台帳にない新しいリンクは通常のbroken-linkのまま", () => {
  const state = toolLayoutHistoryFixture();
  write(path.join(state.root, "current.md"), "[unknown](tools/missing.ts)\n");
  const result = runChecker(state.root);
  assert.equal(result.status, 1);
  assert.equal(
    result.report.metrics.historical_references_identity_verified,
    2,
  );
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "broken-link" && finding.path === "current.md",
    ),
  );
});

test("配置移行は参照組が一致してもGit版に存在しないanchorを拒否する", () => {
  const state = toolLayoutHistoryFixture(false);
  const result = runChecker(state.root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "invalid-tool-layout-historical-references" &&
        finding.message ===
          "Reference pair or historical anchor does not match.",
    ),
  );
  assert.equal(
    result.report.metrics.historical_references_identity_verified,
    0,
  );
});

for (const mode of ["generic", "adopter"] as const) {
  test(`配置移行の公式台帳を${mode}へコピーしても歴史例外を発火しない`, () => {
    const state = toolLayoutHistoryFixture();
    if (mode === "generic")
      fs.rmSync(path.join(state.root, "01_Principles.md"));
    else fs.mkdirSync(path.join(state.root, "00_CRDD"));
    const result = runChecker(state.root);
    assert.equal(result.report.repository_mode, mode);
    assert.equal(
      result.report.metrics.historical_references_identity_verified,
      0,
    );
    assert.equal(
      result.report.findings.filter(
        (finding) =>
          finding.code === "broken-link" && finding.path === state.sourcePath,
      ).length,
      2,
    );
  });
}

function officialVirtualResolutionFixture(): string {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.11.4\n");
  write(path.join(root, "README.md"), "Status: v0.11.4\n");
  write(
    path.join(
      root,
      "90_Release",
      "Changes",
      "CHG-000015_Coordinator_Runtime_1_0.md",
    ),
    "# 変更トレース: Canonical\n\n変更ID: CHG-000015\n",
  );
  const oldRecords: Array<
    Readonly<{ id: string; path: string; content: string }>
  > = [];
  for (let numericId = 16; numericId <= 35; numericId += 1) {
    const id = `CHG-${numericId.toString().padStart(6, "0")}`;
    const relativePath =
      id === "CHG-000035"
        ? "90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md"
        : `90_Release/Changes/${id}_Old.md`;
    const content = `# 変更トレース: ${id}\n\n変更ID: ${id}\n`;
    write(path.join(root, ...relativePath.split("/")), content);
    oldRecords.push({ id, path: relativePath, content });
  }
  write(
    path.join(root, "90_Release", "Changes", "Evidence", "fixed.md"),
    "[fixed](../CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md)\n",
  );
  initializeGit(root);
  assert.equal(
    spawnSync("git", ["-C", root, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "locator base fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  const commit = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout.trim();
  const tree = spawnSync(
    "git",
    ["-C", root, "show", "-s", "--format=%T", "HEAD"],
    {
      encoding: "utf8",
    },
  ).stdout.trim();
  for (const record of oldRecords)
    fs.rmSync(path.join(root, ...record.path.split("/")));
  const ledgerLines = [
    "# 未リリース変更トレース統合台帳",
    "",
    "<!-- crdd-change-trace-ledger-schema: 1 -->",
    "",
    `- 統合直前Commit: \`${commit}\``,
    `- 統合直前Tree: \`${tree}\``,
    "- 公式公開tag固定集合: 0件",
    "- 不変・非active歴史参照固定集合: 1 pair、1 source、1 target",
    "- 統合前の未リリースCHG: `CHG-000015`～`CHG-000035`の21件",
    "- 統合後: Canonical CHG 1件、統合済み旧ID 20件",
    "- Canonical CHG: `CHG-000015`",
    "",
    "## 公式公開tag固定集合",
    "",
    "| Tag | Ref Object Type | Ref Object OID | Peeled Commit OID | Peeled Tree OID |",
    "|---|---|---|---|---|",
    "",
    "## 統合済み旧ID",
    "",
  ];
  for (const record of oldRecords) {
    const bytes = Buffer.from(record.content, "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    ledgerLines.push(
      `<a id="consolidated-${record.id.toLocaleLowerCase("en-US")}"></a>`,
      "",
      `### ${record.id} → CHG-000015`,
      "",
      `- 旧題名: fixture ${record.id}`,
      `- 旧Path: \`${record.path}\``,
      "- 統合前判断: fixture",
      "- 変更分類: `non-breaking`",
      "- 移行／Release境界: fixture",
      "- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)",
      "- 統合理由: locator fixture",
      `- 固定原文: Commit \`${commit}\`、Tree \`${tree}\`、${bytes.length} byte、SHA-256 \`${sha256}\``,
      record.id === "CHG-000035"
        ? "- 関連Evidence: [fixed.md](Evidence/fixed.md)"
        : "- 関連Evidence: 専用Evidenceなし",
      "- 旧ID処置: 統合済み・永久欠番",
      "",
    );
  }
  ledgerLines.push(
    "## 不変・非active歴史参照固定集合",
    "",
    "| Source Evidence | Target Old Path |",
    "|---|---|",
    "| `90_Release/Changes/Evidence/fixed.md` | `90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md` |",
    "",
  );
  write(
    path.join(root, "90_Release", "Changes", "README.md"),
    ledgerLines.join("\n"),
  );
  assert.equal(
    spawnSync("git", ["-C", root, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "virtual resolution candidate fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  assert.equal(
    spawnSync("git", ["-C", root, "tag", "fixture-v0.18.0"], {
      encoding: "utf8",
    }).status,
    0,
  );
  return root;
}

test("公式統合台帳は旧IDをCanonicalと固定原文へ一意に予約する", () => {
  const root = officialConsolidationLedgerFixture();
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.ok(
    result.report.global_checks.includes(
      "unreleased Change Trace consolidation ledger identity and reservation",
    ),
  );
});

test("公式統合台帳はGit object、内容Identity、祖先性とGit取得失敗をfail closedにする", () => {
  const cases: ReadonlyArray<
    readonly [string, (root: string, ledger: string) => string, string]
  > = [
    [
      "missing commit",
      (_root, ledger) =>
        ledger.replace(/Commit `[^`]+`/u, `Commit \`${"0".repeat(40)}\``),
      "invalid-consolidated-change-trace-commit",
    ],
    [
      "non-commit object",
      (root, ledger) => {
        const blob = spawnSync(
          "git",
          [
            "-C",
            root,
            "rev-parse",
            "HEAD:90_Release/Changes/CHG-000001_Old.md",
          ],
          { encoding: "utf8" },
        ).stdout.trim();
        return ledger.replace(/Commit `[^`]+`/u, `Commit \`${blob}\``);
      },
      "invalid-consolidated-change-trace-commit",
    ],
    [
      "wrong tree",
      (_root, ledger) =>
        ledger.replace(/Tree `[^`]+`/u, `Tree \`${"0".repeat(40)}\``),
      "consolidated-change-trace-tree-mismatch",
    ],
    [
      "missing blob",
      (_root, ledger) =>
        ledger.replace("CHG-000001_Old.md", "CHG-000001_Missing.md"),
      "invalid-consolidated-change-trace-blob",
    ],
    [
      "wrong byte count",
      (_root, ledger) =>
        ledger.replace(
          /、([1-9][0-9]*) byte、/u,
          (_match, bytes: string) =>
            `、${Number.parseInt(bytes, 10) + 1} byte、`,
        ),
      "consolidated-change-trace-content-mismatch",
    ],
    [
      "wrong sha256",
      (_root, ledger) =>
        ledger.replace(/SHA-256 `[^`]+`/u, `SHA-256 \`${"0".repeat(64)}\``),
      "consolidated-change-trace-content-mismatch",
    ],
    [
      "non-ancestor commit",
      (root, ledger) => {
        const tree = ledger.match(/Tree `([0-9a-f]{40})`/u)?.[1] ?? "";
        const orphan = spawnSync(
          "git",
          ["-C", root, "commit-tree", tree, "-m", "orphan fixture"],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              GIT_AUTHOR_NAME: "CRDD Test",
              GIT_AUTHOR_EMAIL: "crdd-test@example.invalid",
              GIT_COMMITTER_NAME: "CRDD Test",
              GIT_COMMITTER_EMAIL: "crdd-test@example.invalid",
            },
          },
        ).stdout.trim();
        return ledger.replace(/Commit `[^`]+`/u, `Commit \`${orphan}\``);
      },
      "consolidated-change-trace-base-not-ancestor",
    ],
  ];

  for (const [label, mutate, expectedCode] of cases) {
    const root = officialConsolidationLedgerFixture();
    const ledgerPath = path.join(root, "90_Release", "Changes", "README.md");
    fs.writeFileSync(
      ledgerPath,
      mutate(root, fs.readFileSync(ledgerPath, "utf8")),
      "utf8",
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) => finding.code === expectedCode),
      `${label}: ${JSON.stringify(result.report.findings)}`,
    );
  }

  const gitUnavailableRoot = officialConsolidationLedgerFixture();
  const emptyPath = path.join(gitUnavailableRoot, "empty-path");
  fs.mkdirSync(emptyPath);
  const gitUnavailable = runWithEnv(gitUnavailableRoot, { PATH: emptyPath });
  assert.ok(
    gitUnavailable.report.findings.some(
      (finding) =>
        finding.code === "invalid-consolidated-change-trace-commit" ||
        finding.code === "change-trace-tag-inspection-failed",
    ),
  );

  const shallowRoot = officialConsolidationLedgerFixture();
  const shallowHead = spawnSync(
    "git",
    ["-C", shallowRoot, "rev-parse", "HEAD"],
    {
      encoding: "utf8",
    },
  ).stdout.trim();
  fs.writeFileSync(
    path.join(shallowRoot, ".git", "shallow"),
    `${shallowHead}\n`,
  );
  const shallowResult = runChecker(shallowRoot);
  assert.ok(
    shallowResult.report.findings.some(
      (finding) =>
        finding.code === "change-trace-ledger-git-snapshot-unavailable",
    ),
  );

  const nonFileLedgerRoot = officialConsolidationLedgerFixture();
  const nonFileLedger = path.join(
    nonFileLedgerRoot,
    "90_Release",
    "Changes",
    "README.md",
  );
  fs.rmSync(nonFileLedger);
  fs.mkdirSync(nonFileLedger);
  const nonFileLedgerResult = runChecker(nonFileLedgerRoot);
  assert.ok(
    nonFileLedgerResult.report.findings.some(
      (finding) =>
        finding.code === "invalid-change-trace-consolidation-ledger-file",
    ),
  );
});

test("統合直前baseは一意なCommitと実Treeへ固定し全旧entryで共有する", () => {
  const cases: ReadonlyArray<readonly [string, (ledger: string) => string]> = [
    [
      "duplicate base",
      (ledger) =>
        ledger.replace(
          /^- 統合直前Commit: (`[0-9a-f]{40}`)$/mu,
          "- 統合直前Commit: $1\n- 統合直前Commit: $1",
        ),
    ],
    [
      "wrong base tree",
      (ledger) =>
        ledger.replace(
          /^- 統合直前Tree: `[0-9a-f]{40}`$/mu,
          `- 統合直前Tree: \`${"0".repeat(40)}\``,
        ),
    ],
    [
      "entry base divergence",
      (ledger) =>
        ledger.replace(
          /(- 固定原文: Commit )`[0-9a-f]{40}`/u,
          `$1\`${"0".repeat(40)}\``,
        ),
    ],
  ];
  for (const [label, mutate] of cases) {
    const root = officialConsolidationLedgerFixture();
    const ledgerPath = path.join(root, "90_Release", "Changes", "README.md");
    fs.writeFileSync(
      ledgerPath,
      mutate(fs.readFileSync(ledgerPath, "utf8")),
      "utf8",
    );
    const result = runChecker(root);
    assert.equal(result.status, 1, label);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "invalid-change-trace-integration-base" ||
          finding.code === "change-trace-entry-base-mismatch",
      ),
      `${label}: ${JSON.stringify(result.report.findings)}`,
    );
  }
});

test("公式統合台帳は未リリースID集合の欠落と重複を拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  const ledger = path.join(root, "90_Release", "Changes", "README.md");
  fs.writeFileSync(
    ledger,
    fs
      .readFileSync(ledger, "utf8")
      .replace(
        "Canonical CHG 1件、統合済み旧ID 1件",
        "Canonical CHG 2件、統合済み旧ID 0件",
      )
      .replace(
        "Canonical CHG: `CHG-000002`",
        "Canonical CHG: `CHG-000001`、`CHG-000002`",
      ),
    "utf8",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "invalid-change-trace-consolidation-set-arithmetic" ||
        finding.code === "consolidated-id-declared-canonical",
    ),
  );
});

test("将来の公式公開tagも統合済み旧Pathへの到達を拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  write(
    path.join(root, "90_Release", "Changes", "CHG-000001_Old.md"),
    "# 変更トレース: Published old\n\n変更ID: CHG-000001\n",
  );
  assert.equal(
    spawnSync("git", ["-C", root, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "published fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  assert.equal(
    spawnSync("git", ["-C", root, "tag", "v0.1.0"], {
      encoding: "utf8",
    }).status,
    0,
  );
  fs.rmSync(path.join(root, "90_Release", "Changes", "CHG-000001_Old.md"));
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "released-change-trace-consolidated",
    ),
    `${JSON.stringify(result.report.findings)}\n${result.stderr}`,
  );
});

test("将来の公式公開tagは旧Pathへ到達しなければ自己参照なしで許容する", () => {
  const root = officialVirtualResolutionFixture();
  assert.equal(
    spawnSync("git", ["-C", root, "tag", "v0.18.0"], {
      encoding: "utf8",
    }).status,
    0,
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
});

test("将来の公式公開tagはcommitへpeelできなければ拒否する", () => {
  const root = officialVirtualResolutionFixture();
  const blob = spawnSync(
    "git",
    ["-C", root, "rev-parse", "HEAD:90_Release/Changes/README.md"],
    { encoding: "utf8" },
  ).stdout.trim();
  assert.equal(
    spawnSync("git", ["-C", root, "update-ref", "refs/tags/v0.18.0", blob], {
      encoding: "utf8",
    }).status,
    0,
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "official-published-tag-not-commit",
    ),
  );
});

test("固定Evidenceの欠落旧Pathは物理stubなしで統合台帳から解決する", () => {
  const root = officialVirtualResolutionFixture();
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.historical_references_observed, 1);
  assert.equal(
    result.report.metrics.historical_references_identity_verified,
    1,
  );
  assert.equal(result.report.metrics.historical_references_active, 0);
});

test("不変歴史参照は新規または改変Evidenceへ拡張しない", () => {
  const newEvidenceRoot = officialVirtualResolutionFixture();
  write(
    path.join(newEvidenceRoot, "90_Release", "Changes", "Evidence", "new.md"),
    "[new](../CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md)\n",
  );
  const newEvidenceResult = runChecker(newEvidenceRoot);
  assert.equal(newEvidenceResult.status, 1);
  assert.ok(
    newEvidenceResult.report.findings.some(
      (finding) =>
        finding.code === "broken-link" && finding.path.endsWith("new.md"),
    ),
  );

  const changedEvidenceRoot = officialVirtualResolutionFixture();
  const fixedEvidence = path.join(
    changedEvidenceRoot,
    "90_Release",
    "Changes",
    "Evidence",
    "fixed.md",
  );
  fs.appendFileSync(fixedEvidence, "changed\n", "utf8");
  const changedEvidenceResult = runChecker(changedEvidenceRoot);
  assert.equal(changedEvidenceResult.status, 1);
  assert.ok(
    changedEvidenceResult.report.findings.some(
      (finding) => finding.code === "historical-reference-identity-mismatch",
    ),
  );
  assert.equal(
    changedEvidenceResult.report.metrics
      .historical_references_identity_verified,
    0,
  );
  assert.equal(
    changedEvidenceResult.report.metrics.historical_references_observed,
    1,
  );
});

test("統合台帳の孤立fieldと重複fieldは歴史参照を許可しない", () => {
  for (const mutate of [
    (ledger: string) =>
      ledger.replace(
        "<!-- crdd-change-trace-ledger-schema: 1 -->",
        "<!-- crdd-change-trace-ledger-schema: 1 -->\n- 旧Path: `90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md`",
      ),
    (ledger: string) =>
      ledger.replace(
        "- 旧題名: fixture CHG-000016",
        "- 旧題名: fixture CHG-000016\n- 旧題名: duplicate",
      ),
  ]) {
    const root = officialVirtualResolutionFixture();
    const ledger = path.join(root, "90_Release", "Changes", "README.md");
    fs.writeFileSync(ledger, mutate(fs.readFileSync(ledger, "utf8")), "utf8");
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.equal(
      result.report.metrics.historical_references_identity_verified,
      0,
    );
    assert.equal(result.report.metrics.historical_references_observed, 1);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "orphan-change-trace-ledger-old-path" ||
          finding.code === "invalid-change-trace-ledger-entry-schema",
      ),
      JSON.stringify(result.report.findings),
    );
  }
});

test("統合済み旧Pathへの物理stub再導入を拒否する", () => {
  const root = officialVirtualResolutionFixture();
  write(
    path.join(
      root,
      "90_Release",
      "Changes",
      "CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md",
    ),
    "# compatibility stub\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.metrics.historical_references_observed, 1);
  assert.equal(result.report.metrics.historical_references_active, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "physical-consolidated-change-trace-path",
    ),
  );
});

test("統合済み旧Pathのdirectory・symlink・index再出現をmetricsから隠さない", () => {
  const oldRelative =
    "90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md";
  for (const kind of ["directory", "junction"] as const) {
    const root = officialVirtualResolutionFixture();
    const oldPath = path.join(root, ...oldRelative.split("/"));
    if (kind === "directory") {
      fs.mkdirSync(oldPath);
    } else {
      const junctionTarget = path.join(root, "junction-target");
      fs.mkdirSync(junctionTarget);
      fs.symlinkSync(junctionTarget, oldPath, "junction");
    }
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.equal(result.report.metrics.historical_references_observed, 1);
    assert.equal(result.report.metrics.historical_references_active, 1);
    assert.equal(
      result.report.metrics.historical_references_identity_verified,
      0,
    );
  }

  const indexRoot = officialVirtualResolutionFixture();
  const indexedOldPath = path.join(indexRoot, ...oldRelative.split("/"));
  write(indexedOldPath, "# indexed old path\n");
  assert.equal(
    spawnSync("git", ["-C", indexRoot, "add", oldRelative], {
      encoding: "utf8",
    }).status,
    0,
  );
  fs.rmSync(indexedOldPath);
  const indexResult = runChecker(indexRoot);
  assert.equal(indexResult.status, 1);
  assert.equal(indexResult.report.metrics.historical_references_observed, 1);
  assert.equal(indexResult.report.metrics.historical_references_active, 0);
  assert.equal(indexResult.report.metrics.historical_references_indexed, 1);
  assert.equal(
    indexResult.report.metrics.historical_references_identity_verified,
    0,
  );
  assert.ok(
    indexResult.report.findings.some(
      (finding) => finding.code === "indexed-consolidated-change-trace-id",
    ),
  );
});

test("非公式local tagは公開tag固定集合へ混入させない", () => {
  const root = officialConsolidationLedgerFixture();
  assert.equal(
    spawnSync("git", ["-C", root, "tag", "scratch-local"], {
      encoding: "utf8",
    }).status,
    0,
  );
  const commitResult = runChecker(root);
  assert.equal(
    commitResult.status,
    0,
    JSON.stringify(commitResult.report.findings),
  );

  const blob = spawnSync(
    "git",
    ["-C", root, "rev-parse", "HEAD:90_Release/Changes/CHG-000001_Old.md"],
    { encoding: "utf8" },
  ).stdout.trim();
  assert.equal(
    spawnSync(
      "git",
      ["-C", root, "update-ref", "refs/tags/scratch-blob", blob],
      { encoding: "utf8" },
    ).status,
    0,
  );
  const blobResult = runChecker(root);
  assert.equal(
    blobResult.status,
    0,
    JSON.stringify(blobResult.report.findings),
  );
});

test("統合台帳の機械所有tableは余分・重複rowを拒否する", () => {
  for (const extra of [
    "  | malformed |",
    "malformed | value",
    "| Tag | Ref Object Type | Ref Object OID | Peeled Commit OID | Peeled Tree OID |\n|---|---|---|---|---|",
    "```text\n| malformed |\n```",
  ]) {
    const tagRoot = officialConsolidationLedgerFixture();
    const tagLedger = path.join(tagRoot, "90_Release", "Changes", "README.md");
    fs.writeFileSync(
      tagLedger,
      fs
        .readFileSync(tagLedger, "utf8")
        .replace("|---|---|---|---|---|", `|---|---|---|---|---|\n${extra}`),
      "utf8",
    );
    const tagResult = runChecker(tagRoot);
    assert.ok(
      tagResult.report.findings.some(
        (finding) =>
          finding.code === "invalid-published-tag-inventory-table-schema",
      ),
      `${extra}: ${JSON.stringify(tagResult.report.findings)}`,
    );
  }

  const historicalRoot = officialVirtualResolutionFixture();
  const historicalLedger = path.join(
    historicalRoot,
    "90_Release",
    "Changes",
    "README.md",
  );
  const historicalRow =
    "| `90_Release/Changes/Evidence/fixed.md` | `90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md` |";
  fs.writeFileSync(
    historicalLedger,
    fs
      .readFileSync(historicalLedger, "utf8")
      .replace(historicalRow, `${historicalRow}\n${historicalRow}`),
    "utf8",
  );
  const historicalResult = runChecker(historicalRoot);
  assert.ok(
    historicalResult.report.findings.some(
      (finding) =>
        finding.code === "invalid-historical-reference-table-schema" ||
        finding.code === "invalid-historical-reference-set",
    ),
  );

  const releasedRoot = officialConsolidationLedgerFixture();
  const releasedLedger = path.join(
    releasedRoot,
    "90_Release",
    "Changes",
    "README.md",
  );
  fs.writeFileSync(
    releasedLedger,
    fs
      .readFileSync(releasedLedger, "utf8")
      .replace(
        "## 統合済み旧ID",
        [
          "- 公開済み固定履歴: `CHG-000003`～`CHG-000003`の1件。公開tag到達性を確認",
          "",
          "## 公開済み固定履歴",
          "",
          "| CHG | Path | 固定Commit | byte | SHA-256 |",
          "|---|---|---|---:|---|",
          "| malformed |",
          "",
          "## 統合済み旧ID",
        ].join("\n"),
      ),
    "utf8",
  );
  const releasedResult = runChecker(releasedRoot);
  assert.ok(
    releasedResult.report.findings.some(
      (finding) =>
        finding.code === "invalid-released-change-trace-table-schema",
    ),
  );

  const entryRoot = officialConsolidationLedgerFixture();
  const entryLedger = path.join(
    entryRoot,
    "90_Release",
    "Changes",
    "README.md",
  );
  fs.writeFileSync(
    entryLedger,
    fs.readFileSync(entryLedger, "utf8").replace("- 旧題名:", "  - 旧題名:"),
    "utf8",
  );
  const entryResult = runChecker(entryRoot);
  assert.ok(
    entryResult.report.findings.some(
      (finding) => finding.code === "invalid-change-trace-ledger-entry-schema",
    ),
  );
});

test("統合済み旧IDは別suffixかつID宣言なしでも再利用を拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  write(
    path.join(root, "90_Release", "Changes", "CHG-000001_Alternate.md"),
    "# no Change ID declaration\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "physical-consolidated-change-trace-id" &&
        finding.path.endsWith("CHG-000001_Alternate.md"),
    ),
  );
});

test("固定公開tag inventoryの欠落または移動を拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  const ledger = path.join(root, "90_Release", "Changes", "README.md");
  const head = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout.trim();
  const tree = spawnSync(
    "git",
    ["-C", root, "show", "-s", "--format=%T", head],
    {
      encoding: "utf8",
    },
  ).stdout.trim();
  fs.writeFileSync(
    ledger,
    fs
      .readFileSync(ledger, "utf8")
      .replace("- 公式公開tag固定集合: 0件", "- 公式公開tag固定集合: 1件")
      .replace(
        "- 不変・非active歴史参照固定集合:",
        `| Tag | Ref Object Type | Ref Object OID | Peeled Commit OID | Peeled Tree OID |\n|---|---|---|---|---|\n| \`v9.9.9\` | \`commit\` | \`${head}\` | \`${head}\` | \`${tree}\` |\n\n- 不変・非active歴史参照固定集合:`,
      ),
    "utf8",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "published-tag-inventory-mismatch",
    ),
  );
});

test("公式統合台帳は公開済みCHGの固定Identity差を拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  const releasedPath = path.join(
    root,
    "90_Release",
    "Changes",
    "CHG-000003_Released.md",
  );
  const releasedContent = "# 変更トレース: Released\n\n変更ID: CHG-000003\n";
  write(releasedPath, releasedContent);
  const releasedBytes = Buffer.from(releasedContent, "utf8");
  const releasedSha256 = createHash("sha256")
    .update(releasedBytes)
    .digest("hex");
  const ledger = path.join(root, "90_Release", "Changes", "README.md");
  fs.writeFileSync(
    ledger,
    fs
      .readFileSync(ledger, "utf8")
      .replace(
        "- 統合前の未リリースCHG:",
        [
          "- 公開済み固定履歴: `CHG-000003`～`CHG-000003`の1件。公開tag到達性を確認",
          "",
          "## 公開済み固定履歴",
          "",
          "| CHG | Path | 固定Commit | byte | SHA-256 |",
          "|---|---|---|---:|---|",
          `| \`CHG-000003\` | \`90_Release/Changes/CHG-000003_Released.md\` | \`1111111111111111111111111111111111111111\` | ${releasedBytes.length} | \`${releasedSha256}\` |`,
          "",
          "- 統合前の未リリースCHG:",
        ].join("\n"),
      ),
    "utf8",
  );
  assert.equal(
    spawnSync("git", ["-C", root, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "released identity fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  assert.equal(
    spawnSync("git", ["-C", root, "tag", "v0.2.0"], {
      encoding: "utf8",
    }).status,
    0,
  );
  const releasedCommit = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout.trim();
  const releasedTree = spawnSync(
    "git",
    ["-C", root, "show", "-s", "--format=%T", releasedCommit],
    { encoding: "utf8" },
  ).stdout.trim();
  const replaceReleasedFixedCommit = (content: string, commit: string) =>
    content.replace(
      /^(\| `CHG-000003` \| `90_Release\/Changes\/CHG-000003_Released\.md` \| )`[0-9a-f]{40}`( \| [1-9][0-9]* \| `[0-9a-f]{64}` \|)$/mu,
      `$1\`${commit}\`$2`,
    );
  const withFixedPublishedTag = fs
    .readFileSync(ledger, "utf8")
    .replace("- 公式公開tag固定集合: 0件", "- 公式公開tag固定集合: 1件")
    .replace(
      "|---|---|---|---|---|",
      `|---|---|---|---|---|\n| \`v0.2.0\` | \`commit\` | \`${releasedCommit}\` | \`${releasedCommit}\` | \`${releasedTree}\` |`,
    );
  fs.writeFileSync(
    ledger,
    replaceReleasedFixedCommit(withFixedPublishedTag, releasedTree),
    "utf8",
  );
  const treeObjectResult = runChecker(root);
  assert.equal(treeObjectResult.status, 1);
  assert.ok(
    treeObjectResult.report.findings.some(
      (finding) =>
        finding.code === "invalid-released-change-trace-fixed-commit",
    ),
    `${JSON.stringify(treeObjectResult.report.findings)}\n${treeObjectResult.stderr}`,
  );
  const orphanCommit = spawnSync(
    "git",
    ["-C", root, "commit-tree", releasedTree, "-m", "orphan published fixture"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "CRDD Test",
        GIT_AUTHOR_EMAIL: "crdd-test@example.invalid",
        GIT_COMMITTER_NAME: "CRDD Test",
        GIT_COMMITTER_EMAIL: "crdd-test@example.invalid",
      },
    },
  ).stdout.trim();
  fs.writeFileSync(
    ledger,
    replaceReleasedFixedCommit(fs.readFileSync(ledger, "utf8"), orphanCommit),
    "utf8",
  );
  const orphanResult = runChecker(root);
  assert.equal(orphanResult.status, 1);
  assert.ok(
    orphanResult.report.findings.some(
      (finding) =>
        finding.code === "invalid-released-change-trace-fixed-commit",
    ),
  );
  fs.writeFileSync(
    ledger,
    replaceReleasedFixedCommit(fs.readFileSync(ledger, "utf8"), releasedCommit),
    "utf8",
  );
  assert.equal(
    spawnSync("git", ["-C", root, "add", ledger], { encoding: "utf8" }).status,
    0,
  );
  write(releasedPath, `${releasedContent}\nchanged\n`);
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "released-change-trace-content-changed",
    ),
  );
});

function releasedNavigationFixture() {
  const root = officialConsolidationLedgerFixture();
  const git = (...args: string[]) => {
    const result = spawnSync("git", ["-C", root, ...args], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("config", "core.autocrlf", "false");
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "navigation fixture",
    );
  };
  const sourcePath = "90_Release/Changes/CHG-000003_Released.md";
  const before = "[`tools/checker/example.ts`](../../tools/checker/example.ts)";
  const after = before.replaceAll("tools/checker/", "40_Develop/checker/");
  const oldText = `# 変更トレース: Released\n\n変更ID: CHG-000003\n\n当時の判断は維持。現在の案内: ${before}\nもう一つの案内: ${before}\n`;
  const expectedText = oldText.replaceAll(before, after);
  write(path.join(root, sourcePath), oldText);
  write(
    path.join(root, "tools/checker/example.ts"),
    "export const VALUE = 1;\n",
  );
  commit();
  git("tag", "v0.2.0");
  const fixedCommit = git("rev-parse", "HEAD");
  const fixedTree = git("show", "-s", "--format=%T", fixedCommit);
  const sourceSha256 = createHash("sha256").update(oldText).digest("hex");
  const ledgerPath = path.join(root, "90_Release/Changes/README.md");
  let ledgerText = fs.readFileSync(ledgerPath, "utf8");
  ledgerText = ledgerText
    .replace("- 公式公開tag固定集合: 0件", "- 公式公開tag固定集合: 1件")
    .replace(
      "|---|---|---|---|---|",
      `|---|---|---|---|---|\n| \`v0.2.0\` | \`commit\` | \`${fixedCommit}\` | \`${fixedCommit}\` | \`${fixedTree}\` |`,
    );
  ledgerText = ledgerText.replace(
    "- 統合前の未リリースCHG:",
    [
      "- 公開済み固定履歴: `CHG-000003`～`CHG-000003`の1件。公開tag到達性を確認",
      "",
      "## 公開済み固定履歴",
      "",
      "| CHG | Path | 固定Commit | byte | SHA-256 |",
      "|---|---|---|---:|---|",
      `| \`CHG-000003\` | \`${sourcePath}\` | \`${fixedCommit}\` | ${Buffer.byteLength(oldText)} | \`${sourceSha256}\` |`,
      "",
      "- 統合前の未リリースCHG:",
    ].join("\n"),
  );
  write(ledgerPath, ledgerText);
  git("add", "90_Release/Changes/README.md");
  fs.rmSync(path.join(root, "tools/checker/example.ts"));
  write(
    path.join(root, "40_Develop/checker/example.ts"),
    "export const VALUE = 1;\n",
  );
  write(path.join(root, sourcePath), expectedText);
  const record = {
    schemaRevision: 1,
    sources: [
      { sourcePath, sourceSha256, replacements: [{ before, after, count: 2 }] },
    ],
  };
  const recordPath = path.join(
    root,
    "90_Release/Changes/CHG-000017_Tools_Coding_Standards.md",
  );
  const save = () =>
    write(
      recordPath,
      `# 現行案内移行\n\n<!-- crdd-released-navigation-migration: 1 -->\n\x60\x60\x60json\n${JSON.stringify(record)}\n\x60\x60\x60\n`,
    );
  save();
  return {
    root,
    sourcePath,
    oldText,
    expectedText,
    record,
    recordPath,
    save,
    commit,
  };
}

test("公開済み案内の限定移行はHEAD旧版とcommit後新版を厳密に検証する", () => {
  const state = releasedNavigationFixture();
  const beforeCommit = runChecker(state.root);
  assert.equal(
    beforeCommit.status,
    0,
    JSON.stringify(beforeCommit.report.findings),
  );
  assert.equal(
    beforeCommit.report.metrics.historical_references_identity_verified,
    0,
  );
  state.commit();
  const afterCommit = runChecker(state.root);
  assert.equal(
    afterCommit.status,
    0,
    JSON.stringify(afterCommit.report.findings),
  );
  write(
    path.join(state.root, state.sourcePath),
    state.expectedText.replaceAll("\n", "\r\n"),
  );
  const checkout = runChecker(state.root);
  assert.equal(checkout.status, 0, JSON.stringify(checkout.report.findings));
  write(
    path.join(state.root, state.sourcePath),
    `${state.expectedText}本文の未承認変更\n`,
  );
  const changed = runChecker(state.root);
  assert.equal(changed.status, 1);
  assert.ok(
    changed.report.findings.some(
      (finding) => finding.code === "released-change-trace-content-changed",
    ),
  );
});

const releasedNavigationFailures: readonly [
  string,
  (state: ReturnType<typeof releasedNavigationFixture>) => void,
][] = [
  [
    "本文変更",
    (state) =>
      write(
        path.join(state.root, state.sourcePath),
        `${state.expectedText}changed\n`,
      ),
  ],
  [
    "0件",
    (state) => {
      state.record.sources[0].replacements[0].count = 0;
    },
  ],
  [
    "置換過不足",
    (state) => {
      state.record.sources[0].replacements[0].count = 1;
    },
  ],
  [
    "未知source",
    (state) => {
      state.record.sources[0].sourcePath =
        "90_Release/Changes/CHG-000004_Unknown.md";
    },
  ],
  [
    "固定hash差",
    (state) => {
      state.record.sources[0].sourceSha256 = "0".repeat(64);
    },
  ],
  [
    "任意本文置換",
    (state) => {
      state.record.sources[0].replacements[0].before = "当時の判断";
    },
  ],
  [
    "重複source",
    (state) => {
      state.record.sources.push(state.record.sources[0]);
    },
  ],
  [
    "後継欠落",
    (state) =>
      fs.rmSync(path.join(state.root, "40_Develop/checker/example.ts")),
  ],
  [
    "後継junction",
    (state) => {
      fs.renameSync(
        path.join(state.root, "40_Develop/checker"),
        path.join(state.root, "40_Develop/actual"),
      );
      fs.symlinkSync(
        path.join(state.root, "40_Develop/actual"),
        path.join(state.root, "40_Develop/checker"),
        "junction",
      );
    },
  ],
];
for (const [label, mutate] of releasedNavigationFailures) {
  test(`公開済み案内の限定移行は${label}を拒否する`, () => {
    const state = releasedNavigationFixture();
    mutate(state);
    state.save();
    const result = runChecker(state.root);
    assert.equal(result.status, 1);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "invalid-released-navigation-migration" ||
          finding.code === "released-change-trace-content-changed",
      ),
      JSON.stringify(result.report.findings),
    );
  });
}

test("公開済み案内の移行記録がなければ従来の全文不変を要求する", () => {
  const state = releasedNavigationFixture();
  fs.rmSync(state.recordPath);
  const result = runChecker(state.root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "released-change-trace-content-changed",
    ),
  );
});

for (const kind of ["record", "source"] as const) {
  test(`公開済み案内の${kind}がjunctionなら本文読取り前に拒否する`, () => {
    const state = releasedNavigationFixture();
    const target =
      kind === "record"
        ? state.recordPath
        : path.join(state.root, state.sourcePath);
    const actualDirectory = path.join(state.root, `unsafe-${kind}`);
    fs.mkdirSync(actualDirectory);
    fs.rmSync(target);
    fs.symlinkSync(actualDirectory, target, "junction");
    // 読取りを試みれば例外となる。構造化結果まで返ることと境界違反を確認する。
    const result = runWithFault(state.root, "read-file-error", target);
    assert.equal(result.status, 1);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "invalid-released-navigation-migration" ||
          finding.code === "missing-released-change-trace-file",
      ),
      JSON.stringify(result.report.findings),
    );
  });
}

test("公式統合台帳に記録した旧IDの再利用を拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  write(
    path.join(root, "90_Release", "Changes", "CHG-000001_Reused.md"),
    "# 変更トレース: Reused\n\n変更ID: CHG-000001\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "reused-consolidated-change-trace-id",
    ),
  );
});

test("公式統合台帳は欠落Canonicalと不完全な固定Identityを拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  const ledger = path.join(root, "90_Release", "Changes", "README.md");
  fs.writeFileSync(
    ledger,
    fs
      .readFileSync(ledger, "utf8")
      .replaceAll("CHG-000002", "CHG-000003")
      .replace(/、[1-9][0-9]* byte、/u, "、0 byte、"),
    "utf8",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "missing-canonical-change-trace-id",
    ),
  );
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "invalid-consolidated-change-trace-identity",
    ),
  );
});

test("公式統合台帳は重複旧IDと統合cycleを拒否する", () => {
  const root = officialConsolidationLedgerFixture();
  const ledger = path.join(root, "90_Release", "Changes", "README.md");
  const entry = fs.readFileSync(ledger, "utf8").split("\n").slice(2).join("\n");
  fs.appendFileSync(ledger, entry, "utf8");
  fs.appendFileSync(
    ledger,
    [
      '<a id="consolidated-chg-000004"></a>',
      "",
      "### CHG-000004 → CHG-000001",
      "",
      "- 旧Path: `90_Release/Changes/CHG-000004_Old.md`",
      "- Canonical CHG: [CHG-000001](CHG-000001_Canonical.md)",
      "- 統合理由: cycle fixture",
      "- 固定原文: Commit `1111111111111111111111111111111111111111`、Tree `2222222222222222222222222222222222222222`、1 byte、SHA-256 `3333333333333333333333333333333333333333333333333333333333333333`",
      "- 関連Evidence: 専用Evidenceなし",
      "- 旧ID処置: 統合済み・永久欠番",
      "",
    ].join("\n"),
    "utf8",
  );
  write(
    path.join(root, "90_Release", "Changes", "CHG-000001_Canonical.md"),
    "# 変更トレース: Old canonical\n\n変更ID: CHG-000001\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "duplicate-consolidated-change-trace-id",
    ),
  );
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "cyclic-change-trace-consolidation",
    ),
  );
});

test("深いEvidence階層のMarkdownも内容を検査する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(
      root,
      "90_Release",
      "product-a",
      "Changes",
      "Evidence",
      "review",
      "screens",
      "Result.md",
    ),
    "[missing](Missing.md)\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "broken-link" && finding.path.endsWith("Result.md"),
    ),
  );
});

test("Changes配下へ入れ子にした変更トレース定義を検査できる", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(
      root,
      "90_Release",
      "product-a",
      "Changes",
      "archive",
      "CHG-000001.md",
    ),
    "# change\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
});

test("二段以上の階層にある変更トレースを検査できる", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(
      root,
      "90_Release",
      "group-a",
      "product-a",
      "Changes",
      "CHG-000001.md",
    ),
    "# change\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
});

test("Evidence配下のCHG名ファイルを変更トレース定義と誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  const evidenceFiles = [
    [
      "CHG-000001_Interview.md",
      "# 変更トレース検証結果\n\nChange ID: CHG-000001\n状態（Status）: Verified\n",
    ],
    ["CHG-000002_Review.md", "# 変更トレース レビュー\n\n変更ID: CHG-000002\n"],
    [
      "CHG-000003_Verification.md",
      "# Change Trace verification result\n\nChange ID: CHG-000003\n",
    ],
  ];
  for (const [name, content] of evidenceFiles) {
    write(
      path.join(root, "01_Discovery", "Evidence", "interviews", name),
      content,
    );
  }
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
});

test("Evidence配下へ誤配置した変更トレース本文を検出する", () => {
  const root = fixture();
  makeStructure(root);
  const definitions = [
    ["CHG-000001_Heading.md", "# Change Trace\n\nChange ID: CHG-000001\n"],
    [
      "CHG-000002_Localized.md",
      "# 変更トレース（Change Trace）: example\n\n変更ID: CHG-000002\n",
    ],
  ];
  for (const [name, content] of definitions) {
    write(
      path.join(root, "90_Release", "product-a", "Changes", "Evidence", name),
      content,
    );
  }
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(
    result.report.findings.filter(
      (finding) => finding.code === "change-trace-placement",
    ).length,
    2,
  );
});

test("公式リポジトリ自身の変更トレースを正規配置として扱う", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.11.0\n");
  write(path.join(root, "README.md"), "Status: v0.11.0\n");
  write(
    path.join(root, "90_Release", "Changes", "CHG-000001.md"),
    "# change\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report?.findings));
  assert.equal(result.report.findings.length, 0);
});

test("公式リポジトリの配布ひな型変更トレースを正規配置として扱う", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.11.0\n");
  write(path.join(root, "README.md"), "Status: v0.11.0\n");
  write(
    path.join(root, "90_Release", "Changes", "CHG-XXXXXX_Official.md"),
    "# official change\n",
  );
  write(
    path.join(
      root,
      "template",
      "90_Release",
      "Changes",
      "CHG-XXXXXX_Template.md",
    ),
    "# change template\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report?.findings));
  assert.equal(result.report.findings.length, 0);
});

test("参照関係を重複回数付きで集約する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[B](B.md)\n[B2](B.md)\n");
  write(path.join(root, "01_Discovery", "B.md"), "[A](A.md)\n");
  const result = runChecker(root, "--references", "01_Discovery/B.md");
  assert.equal(result.status, 0);
  const references = result.report.references;
  assert.ok(references);
  assert.equal(references.inbound[0].count, 2);
  assert.equal(references.outbound[0].target, "01_Discovery/A.md");
});

test("分岐網羅率の分母・分子・割合の不整合を検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "07_Quality", "01_Quality_Center.md"),
    [
      "| 対象 | 到達分岐数（分子） | 対象分岐数（分母） | 実測率 |",
      "|---|---:|---:|---:|",
      "| app | 8 | 10 | 70% |",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "branch-coverage-percentage",
    ),
  );
});

test("不正なCLI入力を終了コード2で拒否する", () => {
  const file = path.join(fixture(), "root.txt");
  write(file, "not a directory");
  for (const checkerArguments of [
    ["--root", path.join(os.tmpdir(), "missing-crdd-root")],
    ["--root", file],
    ["--root", "--json"],
    ["--unknown"],
  ]) {
    const result = runRaw(...checkerArguments);
    assert.equal(result.status, 2, checkerArguments.join(" "));
  }
});

test("適用先では無関係なtemplateフォルダより00_CRDDを優先する", () => {
  const root = fixture();
  makeStructure(root);
  fs.mkdirSync(path.join(root, "template"), { recursive: true });
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "README.md"), "Status: **v9.9.9**\n");
  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.repository_mode, "adopter");
});

test("同一ファイル内の安定コンテキストID重複定義を検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "Requirements.md"),
    "## REQ-000001 First\n\nid: REQ-000001\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "duplicate-stable-id-definition",
    ),
  );
});

test("ルート外リンクを読み取らず未確認として返す", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[outside](../../outside.md)\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "outside-root-link",
    ),
  );
  assert.ok(
    result.report.unchecked.some((item) => item.includes("Outside-root")),
  );
});

test("Git無視ファイルを除外し未追跡・非無視ファイルを確認する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, ".gitignore"), "node_modules/\n");
  write(path.join(root, "node_modules", "README.md"), "[broken](missing.md)\n");
  write(path.join(root, "01_Discovery", "Work.md"), "[broken](missing.md)\n");
  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  const result = runChecker(root);
  assert.equal(result.report.discovery_source, "git");
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "broken-link" &&
        finding.path === "01_Discovery/Work.md",
    ),
  );
  assert.ok(
    !result.report.findings.some((finding) =>
      finding.path.includes("node_modules"),
    ),
  );
});

test("英語の分岐網羅率と不正な測定値を検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "07_Quality", "Quality.md"),
    [
      "| Target | Covered Branches (Numerator) | Total Branches (Denominator) | Measured Rate |",
      "|---|---:|---:|---:|",
      "| app | -1 | 0 | 120% |",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "branch-coverage-range",
    ),
  );
});

test("コードフェンス内の疑似リンクと表を検査しない", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "Example.md"),
    [
      "```markdown",
      "[broken](missing.md)",
      "| Target | Covered Branches (Numerator) | Total Branches (Denominator) | Measured Rate |",
      "|---|---:|---:|---:|",
      "| app | -1 | 0 | 120% |",
      "```",
    ].join("\n"),
  );
  const result = runChecker(root);
  assert.equal(result.report.findings.length, 0);
});

test("旧JSON配列と非JSONサマリーの互換性を維持する", () => {
  const root = fixture();
  makeStructure(root);
  const legacy = runRaw("--root", root, "--json");
  assert.ok(Array.isArray(JSON.parse(legacy.stdout)));
  const summary = runRaw(
    "--root",
    root,
    "--scope",
    "01_Discovery",
    "--summary",
  );
  assert.match(summary.stdout, /Executed=/u);
  assert.match(summary.stdout, /Unchecked=/u);
});

test("不正なURIエンコードを例外にせず警告する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[bad](%ZZ.md)\n");
  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "malformed-link-encoding",
    ),
  );
});

test("存在しない参照マップ対象を終了コード2で拒否する", () => {
  const root = fixture();
  makeStructure(root);
  const result = runRaw(
    "--root",
    root,
    "--references",
    "missing.md",
    "--json",
    "--summary",
  );
  assert.equal(result.status, 2);
});

test("リポジトリ内のディレクトリリンクを検査対象外と誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "README.md"), "[Discovery](01_Discovery/)\n");
  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "excluded-local-link",
    ),
    false,
  );
});

test("Git未導入と非Git対象のフォールバック理由を区別する", () => {
  const root = fixture();
  makeStructure(root);

  const notRepository = runChecker(root);
  assert.equal(notRepository.report.discovery_git_failure, "not-repository");

  const noGitPath = fixture();
  const notInstalled = runWithEnv(root, { PATH: noGitPath });
  assert.equal(notInstalled.report.discovery_git_failure, "not-installed");
});

test("Git一覧取得失敗を生の標準エラーなしで分類する", () => {
  const root = fixture();
  makeStructure(root);
  const initialized = spawnSync("git", ["init", "--quiet", root], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0);
  write(path.join(root, ".git", "index"), "invalid-index");

  const result = runChecker(root);
  assert.equal(result.report.discovery_git_failure, "list-failed");
  assert.doesNotMatch(result.stdout, /index file|fatal:/iu);
});

test("gitlinkでない入れ子Gitリポジトリをサブモジュールと誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  assert.equal(
    spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync("git", ["init", "--quiet", path.join(root, "00_CRDD")], {
      encoding: "utf8",
    }).status,
    0,
  );
  write(
    path.join(root, "00_CRDD", "01_Principles.md"),
    ["Version: v0.10.0", '<a id="baseline-rule"></a>', "## Baseline Rule"].join(
      "\n",
    ),
  );
  write(
    path.join(root, "README.md"),
    "[Rule](00_CRDD/01_Principles.md#baseline-rule)\n",
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.baseline_submodule, false);
  assert.equal(result.report.baseline_submodule_state.declared, null);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, null);
  assert.equal(result.report.metrics.anchors_checked, 0);
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "excluded-local-link",
    ),
    true,
  );
  assert.equal(
    result.report.unchecked.some((item) =>
      item.includes("baseline submodule contents"),
    ),
    false,
  );

  const references = runChecker(
    root,
    "--references",
    "00_CRDD/01_Principles.md",
  );
  assert.equal(references.status, 2);

  const scope = runRaw(
    "--root",
    root,
    "--scope",
    "00_CRDD",
    "--json",
    "--summary",
  );
  assert.equal(scope.status, 0, scope.stderr);
});

test("未初期化の00_CRDDサブモジュールを成功扱いしない", () => {
  const root = fixture();
  for (const folder of requiredFolders.filter((name) => name !== "00_CRDD")) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  assert.equal(
    spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" }).status,
    0,
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.repository_mode, "adopter");
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.equal(result.report.baseline_submodule_state.declared, true);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, false);
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-not-initialized",
    ),
    false,
  );
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-gitlink-missing",
    ),
  );
});

test("00_CRDDのgitlinkとgitmodules宣言を別々に検証する", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  addGitlink(root, "00_CRDD");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_state.declared, false);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, true);
  assert.ok(result.report.baseline_submodule_state.gitlink_oid);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
  );
});

test("worktreeと宣言がなくても親indexの00_CRDD gitlinkを検出する", () => {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "00_CRDD"), { recursive: true });
  initializeGit(root);
  addGitlink(root, "00_CRDD");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.repository_mode, "adopter");
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_initialized, false);
  assert.equal(result.report.baseline_submodule_state.declared, false);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, true);
  assert.equal(result.report.baseline_submodule_state.worktree_present, false);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
  );
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-not-initialized",
    ),
  );
});

test("gitlink位置の通常ディレクトリから親GitのHEADを読まない", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  addGitlink(root, "00_CRDD");
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      '\tpath = "00_CRDD"',
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.equal(result.report.baseline_submodule_state.declared, true);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, true);
  assert.equal(result.report.baseline_submodule_state.worktree_present, true);
  assert.equal(result.report.baseline_submodule_state.gitdir_accessible, false);
  assert.equal(result.report.baseline_submodule_state.head_readable, false);
  assert.equal(result.report.baseline_submodule_state.head_oid, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-revision-mismatch",
    ),
    false,
  );
});

test("submodule節外のpathをgitmodules宣言と誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  addGitlink(root, "00_CRDD");
  write(
    path.join(root, ".gitmodules"),
    ["[core]", "\tpath = 00_CRDD"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_state.declared, false);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
  );
});

test("gitmodulesのコメント開始をGit自身の解釈で判定する", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  addGitlink(root, "00_CRDD");
  write(
    path.join(root, ".gitmodules"),
    ['[submodule "00_CRDD"]', "\tpath = 00_CRDD#comment"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_state.declared, true);
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
    false,
  );
});

test("gitmodulesの引用値に続く文字を切り捨てない", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  addGitlink(root, "00_CRDD");
  write(
    path.join(root, ".gitmodules"),
    ['[submodule "00_CRDD"]', '\tpath = "00_CRDD"garbage'].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_state.declared, false);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
  );
});

test("gitmodulesの空値・不正な引用符・行末コメントを安全に解釈する", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "empty"]',
      '\tpath = ""',
      '[submodule "malformed"]',
      '\tpath = "00_CRDD',
      '[submodule "component"]',
      "\tpath = 40_Develop/component # local component",
      '[submodule "escaped-comment"]',
      "\tpath = 40_Develop/component\\#literal",
      '[submodule "trailing-escape"]',
      "\tpath = 40_Develop/trailing\\",
      '[submodule "invalid-escape"]',
      "\tpath = 40_Develop/invalid\\q",
    ].join("\n"),
  );
  write(
    path.join(root, "README.md"),
    "[component](40_Develop/component/README.md)\n",
  );

  const result = runWithFault(root, "git-stage-failed", root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_state.declared, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.deepEqual(result.report.gitlink_boundaries, [
    "40_Develop/component",
    "40_Develop/component#literal",
  ]);
});

test("gitmodules宣言だけの通常ディレクトリをgitlinkと誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.11.4\n");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_state.declared, true);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, false);
  assert.equal(result.report.baseline_submodule_state.worktree_present, true);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-gitlink-missing",
    ),
  );
});

test("親indexのmodeを読めない場合はgitlink欠落と断定しない", () => {
  const source = fixture();
  initializeGit(source);
  write(path.join(source, "01_Principles.md"), "Version: v0.11.4\n");
  assert.equal(
    spawnSync("git", ["-C", source, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        source,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  const root = fixture();
  for (const folder of requiredFolders.filter((name) => name !== "00_CRDD")) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  initializeGit(root);
  const added = spawnSync(
    "git",
    [
      "-c",
      "protocol.file.allow=always",
      "-C",
      root,
      "submodule",
      "add",
      "--quiet",
      source,
      "00_CRDD",
    ],
    { encoding: "utf8" },
  );
  assert.equal(added.status, 0, added.stderr);

  const result = runWithFault(root, "git-stage-failed", root);
  assert.equal(result.status, 1);
  assert.equal(result.report.gitlink_detection, "unavailable");
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-gitlink-missing",
    ),
    false,
  );
});

test("競合中のgitlinkを確定Revisionとして扱わない", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );

  const result = runWithFault(root, "git-list-custom", root, {
    CRDD_CHECK_FAULT_GIT_LIST_JSON: JSON.stringify([]),
    CRDD_CHECK_FAULT_GIT_STAGE_JSON: JSON.stringify([
      "160000 1111111111111111111111111111111111111111 2\t00_CRDD",
      "160000 2222222222222222222222222222222222222222 3\t00_CRDD",
    ]),
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.gitlink_detection, "git-index-conflicted");
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, null);
  assert.equal(result.report.baseline_submodule_state.gitlink_conflicted, true);
  assert.equal(result.report.baseline_submodule_state.gitlink_oid, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-gitlink-missing",
    ),
    false,
  );
});

test("gitmodulesを検証できない場合は宣言欠落と断定しない", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    ['[submodule "00_CRDD"]', "\tpath = 00_CRDD"].join("\n"),
  );

  const result = runWithFault(root, "git-list-custom", root, {
    CRDD_CHECK_FAULT_GIT_LIST_JSON: JSON.stringify([]),
    CRDD_CHECK_FAULT_GIT_STAGE_JSON: JSON.stringify([
      "160000 1111111111111111111111111111111111111111 0\t00_CRDD",
    ]),
    CRDD_CHECK_FAULT_GIT_CONFIG_FAILED: "1",
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_state.declared, null);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, true);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
    false,
  );
});

test("git configの不正な出力をsubmodule宣言として採用しない", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    ['[submodule "00_CRDD"]', "\tpath = 00_CRDD"].join("\n"),
  );

  const result = runWithFault(root, "git-list-custom", root, {
    CRDD_CHECK_FAULT_GIT_LIST_JSON: JSON.stringify([]),
    CRDD_CHECK_FAULT_GIT_STAGE_JSON: JSON.stringify([
      "160000 1111111111111111111111111111111111111111 0\t00_CRDD",
    ]),
    CRDD_CHECK_FAULT_GIT_CONFIG_OUTPUT:
      "submodule.00_CRDD.path-without-value-separator",
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_state.declared, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-declaration-missing",
    ),
    false,
  );
});

test("未初期化gitlink配下へのリンクを破損リンクと誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  addGitlink(root, "40_Develop/component");
  write(
    path.join(root, "README.md"),
    "[component](40_Develop/component/README.md)\n",
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.gitlink_detection, "git-index");
  assert.deepEqual(result.report.gitlink_boundaries, ["40_Develop/component"]);
  assert.equal(result.report.metrics.gitlinks_observed, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "gitlink-target-unchecked",
    ),
  );
  assert.equal(
    result.report.findings.some((finding) => finding.code === "broken-link"),
    false,
  );
  assert.ok(
    result.report.unchecked.some((item) =>
      item.includes("Gitlink target not inspected"),
    ),
  );

  const scoped = runRaw(
    "--root",
    root,
    "--scope",
    "40_Develop/component",
    "--json",
    "--summary",
  );
  assert.equal(scoped.status, 2);
  assert.match(scoped.stderr, /Gitlink submodule/u);

  const references = runRaw(
    "--root",
    root,
    "--references",
    "40_Develop/component/README.md",
    "--json",
    "--summary",
  );
  assert.equal(references.status, 2);
  assert.match(references.stderr, /Gitlink submodule/u);
});

test("index modeを読めなくても宣言済みsubmodule境界を破損リンクにしない", () => {
  const root = fixture();
  makeStructure(root);
  initializeGit(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "component"]',
      '\tpath = "40_Develop/component"',
      "\turl = https://example.invalid/component.git",
    ].join("\n"),
  );
  write(
    path.join(root, "README.md"),
    "[component](40_Develop/component/README.md)\n",
  );

  const result = runWithFault(root, "git-stage-failed", root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.gitlink_detection, "unavailable");
  assert.deepEqual(result.report.gitlink_boundaries, ["40_Develop/component"]);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "gitlink-target-unchecked",
    ),
  );
  assert.equal(
    result.report.findings.some((finding) => finding.code === "broken-link"),
    false,
  );
});

test("必須領域自体が未初期化gitlinkでも欠落と誤認しない", () => {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "40_Develop"), { recursive: true });
  initializeGit(root);
  addGitlink(root, "40_Develop");

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(
    result.report.findings.some(
      (finding) =>
        finding.code === "missing-crdd-folder" &&
        finding.message === "40_Develop",
    ),
    false,
  );
  assert.ok(
    result.report.unchecked.some((item) =>
      item.includes("Required structure entry is an uninitialized Gitlink"),
    ),
  );
});

test("シンボリックリンク経由のルート外参照を読み取らない", () => {
  const root = fixture();
  const outside = fixture();
  makeStructure(root);
  write(
    path.join(outside, "Secret.md"),
    ['<a id="outside-secret"></a>', "outside"].join("\n"),
  );
  const linkedDirectory = path.join(root, "Linked");
  fs.symlinkSync(
    outside,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  write(
    path.join(root, "README.md"),
    "[Secret](Linked/Secret.md#outside-secret)\n",
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 0);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "symbolic-link-target",
    ),
  );
  assert.ok(
    result.report.unchecked.some((item) => item.includes("Symbolic link")),
  );

  const scope = runRaw(
    "--root",
    root,
    "--scope",
    "Linked",
    "--json",
    "--summary",
  );
  assert.equal(scope.status, 2);
  const references = runRaw(
    "--root",
    root,
    "--references",
    "Linked/Secret.md",
    "--json",
    "--summary",
  );
  assert.equal(references.status, 2);
});

test("実物のGitサブモジュール内チェッカーから適用先を確認する", () => {
  const source = fixture();
  write(
    path.join(source, "01_Principles.md"),
    ["Version: v0.10.0", '<a id="actual-submodule-rule"></a>', "## Rule"].join(
      "\n",
    ),
  );
  write(
    path.join(source, "template", "tools", "crdd-check.ts"),
    fs.readFileSync(checker, "utf8"),
  );
  assert.equal(
    spawnSync("git", ["init", "--quiet", source], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync("git", ["-C", source, "add", "."], { encoding: "utf8" }).status,
    0,
  );
  assert.equal(
    spawnSync(
      "git",
      [
        "-C",
        source,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=crdd-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );

  const root = fixture();
  for (const folder of requiredFolders.filter((name) => name !== "00_CRDD")) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  assert.equal(
    spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" }).status,
    0,
  );
  const added = spawnSync(
    "git",
    [
      "-c",
      "protocol.file.allow=always",
      "-C",
      root,
      "submodule",
      "add",
      "--quiet",
      source,
      "00_CRDD",
    ],
    { encoding: "utf8" },
  );
  assert.equal(added.status, 0, added.stderr);
  write(
    path.join(root, "README.md"),
    "[Rule](00_CRDD/01_Principles.md#actual-submodule-rule)\n",
  );

  const installedChecker = path.join(
    root,
    "00_CRDD",
    "template",
    "tools",
    "crdd-check.ts",
  );
  const checked = spawnSync(
    process.execPath,
    [installedChecker, "--root", root, "--json", "--summary"],
    { encoding: "utf8" },
  );
  assert.equal(checked.status, 0, checked.stderr);
  const report = JSON.parse(checked.stdout);
  assert.equal(report.repository_mode, "adopter");
  assert.equal(report.baseline_submodule, true);
  assert.equal(report.baseline_submodule_initialized, true);
  assert.equal(report.baseline_submodule_state.declared, true);
  assert.equal(report.baseline_submodule_state.gitlink_indexed, true);
  assert.equal(report.baseline_submodule_state.worktree_present, true);
  assert.equal(report.baseline_submodule_state.gitdir_accessible, true);
  assert.equal(report.baseline_submodule_state.head_readable, true);
  assert.equal(report.baseline_submodule_state.head_matches_gitlink, true);
  assert.equal(
    report.baseline_submodule_state.head_oid,
    report.baseline_submodule_state.gitlink_oid,
  );
  assert.equal(report.metrics.anchors_checked, 1);
  assert.equal(report.metrics.errors, 0);
  assert.equal(report.metrics.warnings, 0);

  const baselineScope = runRaw(
    "--root",
    root,
    "--scope",
    "00_CRDD",
    "--json",
    "--summary",
  );
  assert.equal(baselineScope.status, 2);
  assert.match(baselineScope.stderr, /adopted CRDD baseline submodule/u);

  const baselineReferences = runChecker(
    root,
    "--references",
    "00_CRDD/01_Principles.md",
  );
  assert.equal(baselineReferences.status, 0, baselineReferences.stderr);
  const references = baselineReferences.report.references;
  assert.ok(references);
  assert.equal(references.inbound[0].source, "README.md");

  if (process.platform === "win32") {
    const caseChanged = runWithFault(
      root,
      "baseline-root-case-changed",
      path.join(root, "00_CRDD"),
    );
    assert.equal(caseChanged.status, 0, caseChanged.stderr);
    assert.equal(
      caseChanged.report.baseline_submodule_state.gitdir_accessible,
      true,
    );
    assert.equal(
      caseChanged.report.baseline_submodule_state.head_matches_gitlink,
      true,
    );
  }

  const unverified = runWithFault(
    root,
    "baseline-head-failed",
    path.join(root, "00_CRDD"),
  );
  assert.equal(unverified.status, 1);
  assert.equal(
    unverified.report.baseline_submodule_state.worktree_present,
    true,
  );
  assert.equal(
    unverified.report.baseline_submodule_state.gitdir_accessible,
    true,
  );
  assert.equal(unverified.report.baseline_submodule_state.head_readable, false);
  assert.ok(
    unverified.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(
    unverified.report.findings.some(
      (finding) => finding.code === "baseline-submodule-not-initialized",
    ),
    false,
  );

  write(path.join(root, "00_CRDD", "Mismatch.md"), "# mismatch\n");
  assert.equal(
    spawnSync("git", ["-C", path.join(root, "00_CRDD"), "add", "."], {
      encoding: "utf8",
    }).status,
    0,
  );
  const advanced = spawnSync(
    "git",
    [
      "-C",
      path.join(root, "00_CRDD"),
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "advance submodule",
    ],
    { encoding: "utf8" },
  );
  assert.equal(advanced.status, 0, advanced.stderr);
  const mismatched = runChecker(root);
  assert.equal(mismatched.status, 1);
  assert.equal(mismatched.report.baseline_submodule_initialized, true);
  assert.equal(
    mismatched.report.baseline_submodule_state.head_matches_gitlink,
    false,
  );
  assert.ok(
    mismatched.report.findings.some(
      (finding) => finding.code === "baseline-submodule-revision-mismatch",
    ),
  );
});

test("構造上の欠落・旧配置・予約領域・中央集約をまとめて検出する", () => {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "02_UX"), { recursive: true });
  fs.mkdirSync(path.join(root, "08_Quality"), { recursive: true });
  fs.mkdirSync(path.join(root, "09_Project_Extension"), { recursive: true });
  fs.mkdirSync(path.join(root, "Evidence"), { recursive: true });
  write(path.join(root, "40_Develop", "Management.md"), "# management\n");

  const result = runChecker(root);
  const codes = new Set(result.report.findings.map((finding) => finding.code));
  for (const code of [
    "missing-crdd-folder",
    "legacy-crdd-folder",
    "reserved-crdd-folder",
    "develop-markdown",
    "central-root-folder",
  ]) {
    assert.ok(codes.has(code), code);
  }
});

test("外部リンクと山括弧リンクと公式ひな型の正本読替えを扱う", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(
    path.join(root, "01_Principles.md"),
    [
      "Version: v0.10.0",
      '<a id="canonical-rule"></a>',
      "## Canonical Rule",
    ].join("\n"),
  );
  write(
    path.join(root, "template", "01_Discovery", "Links.md"),
    [
      "[Canonical](<../00_CRDD/01_Principles.md#canonical-rule>)",
      "[External](https://example.com)",
      "[Mail](mailto:test@example.invalid)",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
  assert.equal(result.report.metrics.errors, 0);
});

test("範囲指定を直接の参照元と参照先へ広げる", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[UX](../02_UX/B.md)\n");
  write(path.join(root, "02_UX", "B.md"), "# UX\n");
  write(
    path.join(root, "03_IA", "C.md"),
    "[Discovery](../01_Discovery/A.md)\n",
  );

  const result = runChecker(root, "--scope", "01_Discovery");
  assert.equal(result.status, 0);
  assert.deepEqual(
    new Set(result.report.expanded_scope),
    new Set(["01_Discovery/A.md", "02_UX/B.md", "03_IA/C.md"]),
  );
});

test("正本文書ルートのジャンクションを拒否する", () => {
  const root = fixture();
  const outside = fixture();
  for (const folder of requiredFolders.filter((name) => name !== "00_CRDD")) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  write(path.join(outside, "01_Principles.md"), "Version: v0.10.0\n");
  fs.symlinkSync(
    outside,
    path.join(root, "00_CRDD"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  const codes = new Set(result.report.findings.map((finding) => finding.code));
  assert.ok(codes.has("symbolic-document-root"));
  assert.ok(codes.has("symbolic-structure-entry"));
  assert.equal(result.report.metrics.versioned_documents_checked, 0);
});

test("範囲指定のルート外と存在しない対象を拒否する", () => {
  const root = fixture();
  makeStructure(root);
  for (const scope of ["../outside", "missing"]) {
    const result = runRaw(
      "--root",
      root,
      "--scope",
      scope,
      "--json",
      "--summary",
    );
    assert.equal(result.status, 2, scope);
  }
});

test("参照マップのルート外とGit対象外ファイルを拒否する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, ".gitignore"), "Ignored.md\n");
  write(path.join(root, "Ignored.md"), "# ignored\n");
  assert.equal(
    spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" }).status,
    0,
  );
  for (const reference of ["../outside.md", "Ignored.md"]) {
    const result = runRaw(
      "--root",
      root,
      "--references",
      reference,
      "--json",
      "--summary",
    );
    assert.equal(result.status, 2, reference);
  }
});

test("公式ひな型ルートのジャンクションを拒否する", () => {
  const root = fixture();
  const outside = fixture();
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  fs.mkdirSync(path.join(outside, "00_CRDD"), { recursive: true });
  fs.symlinkSync(
    outside,
    path.join(root, "template"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.repository_mode, "official");
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "symbolic-structure-root",
    ),
  );
});

test("非JSON出力に指摘と参照マップを表示する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[missing](missing.md)\n");
  const result = runRaw(
    "--root",
    root,
    "--references",
    "01_Discovery/A.md",
    "--summary",
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /BROKEN-LINK/iu);
  assert.match(result.stdout, /"target": "01_Discovery\/A.md"/u);
});

test("checker root must be a real directory rather than a junction", () => {
  const realRoot = fixture();
  const holder = fixture();
  makeStructure(realRoot);
  write(path.join(realRoot, "Secret.md"), "must not be scanned\n");
  const linkedRoot = path.join(holder, "linked-root");
  fs.symlinkSync(
    realRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runRaw("--root", linkedRoot, "--json", "--summary");
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stdout, /Secret\.md/u);
});

test("a regular file at 00_CRDD is reported without traversal", () => {
  const root = fixture();
  for (const folder of requiredFolders.filter((name) => name !== "00_CRDD")) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  write(path.join(root, "00_CRDD"), "not a directory\n");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  const codes = new Set(result.report.findings.map((finding) => finding.code));
  assert.ok(codes.has("invalid-document-root"));
  assert.ok(codes.has("invalid-structure-entry"));
});

test("a regular file at the official template root is reported without traversal", () => {
  const root = fixture();
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "template"), "not a directory\n");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.repository_mode, "official");
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "invalid-structure-root",
    ),
  );
});

test("a required CRDD structure entry must be a directory", () => {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "02_UX"), { recursive: true });
  write(path.join(root, "02_UX"), "not a directory\n");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "invalid-structure-entry" && finding.path === "02_UX",
    ),
  );
});

test("fallbackではgitdirが読めても親indexのgitlinkを検証済みにしない", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  fs.mkdirSync(path.join(root, ".git", "modules", "00_CRDD"), {
    recursive: true,
  });
  write(
    path.join(root, "00_CRDD", ".git"),
    "gitdir: ../.git/modules/00_CRDD\n",
  );
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, null);
  assert.equal(result.report.baseline_submodule_state.gitdir_accessible, true);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
  assert.equal(result.report.discovery_source, "walk-fallback");
});

test("gitmodulesを読めないfallbackは例外終了せず未確認にする", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const gitmodules = path.join(root, ".gitmodules");
  write(gitmodules, ['[submodule "00_CRDD"]', "\tpath = 00_CRDD"].join("\n"));

  const result = runWithFault(root, "read-file-error", gitmodules, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.discovery_source, "walk-fallback");
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.equal(result.report.baseline_submodule_state.declared, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
});

test("fallback rejects an invalid submodule gitdir file", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  write(path.join(root, "00_CRDD", ".git"), "invalid marker\n");

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
});

test("fallback rejects a linked submodule git marker", () => {
  const root = fixture();
  const outside = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  fs.mkdirSync(path.join(outside, "gitdir"), { recursive: true });
  fs.symlinkSync(
    path.join(outside, "gitdir"),
    path.join(root, "00_CRDD", ".git"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
});

test("a generic repository does not require the CRDD template structure", () => {
  const root = fixture();

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.repository_mode, "generic");
  assert.equal(result.report.findings.length, 0);
});

test("duplicate headings use the same suffixes as GitHub anchors", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[second](B.md#same-heading-1)\n",
  );
  write(
    path.join(root, "01_Discovery", "B.md"),
    ["# Same heading", "# Same heading"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
});

test("heading anchors remove Japanese punctuation without removing Japanese text", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[target](B.md#日本語見出し例)\n",
  );
  write(path.join(root, "01_Discovery", "B.md"), "# 日本語／見出し（例）\n");

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
});

test("heading anchors preserve consecutive, leading, and trailing hyphens", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    [
      "[spaces](B.md#alpha--beta)",
      "[emoji](B.md#-emoji)",
      "[trailing](B.md#emoji-)",
    ].join("\n"),
  );
  write(
    path.join(root, "01_Discovery", "B.md"),
    ["# Alpha  Beta", "# 😄 emoji", "# emoji 😄"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 3);
});

test("heading anchors use rendered Markdown text", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[target](B.md#thisll-be-a-helpful-section-about-the-greek-letter-θ)\n",
  );
  write(
    path.join(root, "01_Discovery", "B.md"),
    "## This'll be a _Helpful_ Section About the Greek Letter Θ!\n",
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
});

test("heading anchors preserve literal underscores outside emphasis", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    [
      "[plain](B.md#snake_case_value)",
      "[double](B.md#foo__bar__baz)",
      "[escaped](B.md#_literal_)",
      "[nested](B.md#foo_bar)",
      "[code](B.md#code_value)",
      "[opaque](B.md#tag_value)",
      "[spaced](B.md#spaced_code)",
      "[ticks](B.md#codeinner_value)",
      "[unmatched emphasis](B.md#unmatched_)",
      "[unmatched opener](B.md#_foo)",
      "[unmatched code](B.md#unmatched)",
      "[punctuation middle](B.md#aa_bb_cc)",
      "[punctuation after](B.md#foo_bar_)",
      "[punctuation before](B.md#_foo_bar)",
      "[astral](B.md#𐐨_foo_𐐨)",
      "[strong](B.md#helpful)",
      "[parentheses](B.md#helpful-1)",
      "[whitespace](B.md#_-helpful_)",
      "[FEFF non-whitespace](B.md#feff-_foo_bar)",
      "[NBSP whitespace](B.md#nbsp-foobar)",
    ].join("\n"),
  );
  write(
    path.join(root, "01_Discovery", "B.md"),
    [
      "# snake_case_value",
      "# foo__bar__baz",
      String.raw`# \_literal\_`,
      "# _foo_bar_",
      "# `code_value`",
      "# ``<tag>_value``",
      "# ` spaced_code `",
      "# ``code`inner_value``",
      "# unmatched_",
      "# _foo",
      "# `unmatched",
      '# aa_"bb"_cc',
      "# foo_!bar_",
      "# _foo!_bar",
      "# 𐐀_foo_𐐀",
      "# __Helpful__",
      "# (_Helpful_)",
      "# _ Helpful_",
      "# FEFF _foo_\uFEFFbar",
      "# NBSP _foo_\u00A0bar",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 20);
});

test("heading anchors use visible labels from common inline Markdown", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    [
      "[link](B.md#link-label)",
      "[image](B.md#image-label)",
      "[reference](B.md#reference-label)",
      "[html](B.md#html-label)",
      "[strike](B.md#removed-label)",
      "[open label](B.md#open)",
      "[no target](B.md#labelplain)",
      "[open target](B.md#labelopen)",
    ].join("\n"),
  );
  write(
    path.join(root, "01_Discovery", "B.md"),
    [
      "# [Link label](A.md)",
      "# ![Image label](image.png)",
      "# [Reference label][reference]",
      "# <span>HTML label</span>",
      "# ~~Removed~~ label",
      "# [open",
      "# [label]plain",
      "# [label](open",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 8);
});

test("duplicate heading suffixes avoid anchors generated by another heading", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[third](B.md#foo-2)\n");
  write(
    path.join(root, "01_Discovery", "B.md"),
    ["# Foo", "# Foo-1", "# Foo"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
});

test("an anchor-only Markdown link resolves to its source file", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    ["# Local heading", "[local](#local-heading)"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
});

test("fallbackではGit metadataディレクトリだけで初期化済みにしない", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  fs.mkdirSync(path.join(root, "00_CRDD", ".git"), { recursive: true });

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
  assert.equal(result.report.baseline_submodule_state.gitlink_indexed, null);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-unverified",
    ),
  );
});

test("fallback rejects a gitdir reference outside the target root", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  write(path.join(root, "00_CRDD", ".git"), "gitdir: ../../outside\n");

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
});

test("fallback rejects a gitdir reference that is not a directory", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  write(
    path.join(root, "00_CRDD", ".git"),
    "gitdir: ../.git/modules/00_CRDD\n",
  );
  write(path.join(root, ".git", "modules", "00_CRDD"), "not a directory\n");

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
});

test("clean non-JSON summary output does not require a reference map", () => {
  const root = fixture();
  makeStructure(root);

  const result = runRaw("--root", root, "--summary");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CRDD check: 0 error\(s\), 0 warning\(s\)/u);
  assert.match(result.stdout, /Repository=adopter/u);
});

test("unexpected filesystem metadata failures are not treated as missing files", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  const target = path.join(root, "00_CRDD", ".git");

  const result = runWithFault(root, "lstat-error", target, { PATH: noGitPath });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injected metadata failure/u);
});

test("a structure root removed during inspection becomes a structured finding", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  const target = path.join(root, "template");

  const result = runWithFault(root, "lstat-missing-after-first", target);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "missing-structure-root",
    ),
  );
});

test("a special filesystem object cannot initialize a fallback baseline", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  const target = path.join(root, "00_CRDD", ".git");

  const result = runWithFault(root, "lstat-special", target, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
});

test("a special filesystem object is not accepted as a reference target", () => {
  const root = fixture();
  makeStructure(root);
  const target = path.join(root, "01_Discovery", "A.md");
  write(target, "# A\n");

  const result = runWithFault(
    root,
    "stat-special",
    target,
    {},
    "--references",
    "01_Discovery/A.md",
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /is not a file or directory/u);
});

test("Git repository discovery failures use the explicit fallback reason", () => {
  for (const fault of ["git-root-failed", "git-root-failed-no-stderr"]) {
    const root = fixture();
    makeStructure(root);
    const result = runWithFault(root, fault, root);
    assert.equal(result.status, 0, fault);
    assert.equal(
      result.report.discovery_git_failure,
      "repository-check-failed",
      fault,
    );
  }
});

test("Git file discovery rejects outside, missing, and linked entries", () => {
  const root = fixture();
  const outside = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "# A\n");
  write(path.join(outside, "Secret.md"), "# Secret\n");
  fs.symlinkSync(
    outside,
    path.join(root, "Linked"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runWithFault(root, "git-list-custom", root, {
    CRDD_CHECK_FAULT_GIT_LIST_JSON: JSON.stringify([
      "01_Discovery/A.md",
      "Linked/Secret.md",
      "Missing.md",
      "../outside.md",
    ]),
    CRDD_CHECK_FAULT_GIT_STAGE_JSON: JSON.stringify([
      "malformed-stage-entry",
      "160000 1111111111111111111111111111111111111111 0\t../outside-submodule",
    ]),
  });
  assert.equal(result.status, 0);
  assert.equal(result.report.gitlink_detection, "unavailable");
  assert.ok(
    result.report.discovery_exclusions.includes("Symbolic links and junctions"),
  );
  assert.ok(
    result.report.unchecked.some((item) =>
      item.includes("Symbolic link excluded: Linked/Secret.md"),
    ),
  );
});

test("symbolic-boundary helper fails closed when a target resolves outside", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const target = path.join(root, ".gitmodules");
  write(
    target,
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );

  const result = runWithFault(root, "relative-outside", target, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule, true);
});

test("fallback rejects a gitdir directory reached through a junction", () => {
  const root = fixture();
  const outside = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  write(
    path.join(root, ".gitmodules"),
    [
      '[submodule "00_CRDD"]',
      "\tpath = 00_CRDD",
      "\turl = https://example.invalid/CRDD.git",
    ].join("\n"),
  );
  write(path.join(root, "00_CRDD", ".git"), "gitdir: ../Metadata/00_CRDD\n");
  fs.mkdirSync(path.join(outside, "00_CRDD"), { recursive: true });
  fs.symlinkSync(
    outside,
    path.join(root, "Metadata"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, null);
});

test("empty heading anchors are ignored", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "# !!!\n");
  write(path.join(root, "01_Discovery", "B.md"), "[empty](A.md#empty)\n");

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some((finding) => finding.code === "broken-anchor"),
  );
});

test("finding order falls back to the message when other keys are equal", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    ["[first](%ZA.md)", "[second](%ZB.md)"].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0);
  assert.equal(
    result.report.findings.filter(
      (finding) => finding.code === "malformed-link-encoding",
    ).length,
    2,
  );
});

test("clean Git summary renders a null discovery failure as none", () => {
  const root = fixture();
  makeStructure(root);
  assert.equal(
    spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" }).status,
    0,
  );

  const result = runRaw("--root", root, "--summary");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /git_failure=none/u);
});

test("fallback fails closed when the root disappears before directory walking", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);

  const result = runWithFault(root, "lstat-missing-after-first", root, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.equal(result.report.metrics.files_discovered, 0);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "discovery-directory-missing" && finding.path === ".",
    ),
  );
  assert.ok(
    result.report.unchecked.some((item) =>
      item.includes("Fallback discovery unavailable: .:"),
    ),
  );
});

test("reference maps omit external links", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    ["# A", "[external](https://example.invalid)", "[local](B.md)"].join("\n"),
  );
  write(path.join(root, "01_Discovery", "B.md"), "# B\n");

  const result = runChecker(root, "--references", "01_Discovery/A.md");
  assert.equal(result.status, 0);
  const references = result.report.references;
  assert.ok(references);
  assert.equal(references.outbound.length, 1);
  assert.equal(references.outbound[0].target, "01_Discovery/B.md");
});

test("fallback reports a nested directory that disappears before recursion", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const target = path.join(root, "01_Discovery");

  const result = runWithFault(root, "lstat-missing", target, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "discovery-directory-missing" &&
        finding.path === "01_Discovery",
    ),
  );
  assert.ok(
    result.report.unchecked.some((item) => item.includes("01_Discovery")),
  );
});

test("fallback distinguishes nested metadata, type, and link races", () => {
  const cases = [
    ["lstat-error", "discovery-directory-metadata-failed"],
    ["lstat-special", "discovery-directory-invalid"],
    ["lstat-symbolic", "discovery-directory-symbolic"],
  ];
  for (const [fault, expectedCode] of cases) {
    const root = fixture();
    const noGitPath = fixture();
    makeStructure(root);
    const target = path.join(root, "Nested");
    fs.mkdirSync(target, { recursive: true });

    const result = runWithFault(root, fault, target, { PATH: noGitPath });
    assert.equal(result.status, 1, fault);
    assert.ok(result.report, `${fault}: ${result.stderr}`);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === expectedCode && finding.path === "Nested",
      ),
      fault,
    );
    assert.ok(
      result.report.unchecked.some((item) => item.includes("Nested")),
      fault,
    );
  }
});

test("fallback distinguishes directory-list failures", () => {
  const cases = [
    ["ENOENT", "discovery-directory-missing"],
    ["ENOTDIR", "discovery-directory-invalid"],
    ["EACCES", "discovery-directory-list-failed"],
  ];
  for (const [errorCode, expectedCode] of cases) {
    const root = fixture();
    const noGitPath = fixture();
    makeStructure(root);
    const target = path.join(root, "01_Discovery");

    const result = runWithFault(root, "readdir-error", target, {
      PATH: noGitPath,
      CRDD_CHECK_FAULT_ERROR_CODE: errorCode,
    });
    assert.equal(result.status, 1, errorCode);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === expectedCode && finding.path === "01_Discovery",
      ),
      errorCode,
    );
  }
});

test("fallback rejects a directory removed after its entries are read", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const target = path.join(root, "Nested");
  fs.mkdirSync(target, { recursive: true });

  const result = runWithFault(root, "lstat-missing-after-first", target, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "discovery-directory-missing" &&
        finding.path === "Nested",
    ),
  );
});

test("reference maps aggregate links for a directory target", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[B](B.md)\n");
  write(path.join(root, "01_Discovery", "B.md"), "# B\n");

  const result = runChecker(root, "--references", "01_Discovery");
  assert.equal(result.status, 0);
  const references = result.report.references;
  assert.ok(references);
  assert.equal(references.outbound.length, 1);
  assert.equal(references.inbound.length, 1);
});

test("child-process fault injection records a directory replacement", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const target = path.join(root, "Nested");
  fs.mkdirSync(target, { recursive: true });

  const result = runWithFault(root, "lstat-replaced-after-read", target, {
    PATH: noGitPath,
  });
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.severity === "error" &&
        finding.code === "discovery-directory-replaced" &&
        finding.path === "Nested",
    ),
  );
  assert.ok(
    result.report.unchecked.some(
      (item) =>
        item.startsWith("Fallback discovery unavailable:") &&
        item.includes("Nested"),
    ),
  );
});

test("recognizable remediation tables validate a resolved row", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# 是正対象一覧",
      "",
      "| 対象 | 処置進捗 | 阻害状態 | 解消判定 | 受入条件 | 判定方法 | 根拠 | 独立再レビュー | 現在状態への反映 |",
      "|---|---|---|---|---|---|---|---|---|",
      "| A | Self-checked | None | Resolved | 表示される | 画面確認 | Result.md | reviewer: Pass | Current.md |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.remediation_rows_checked, 1);
});

test("recognizable remediation tables reject fixed and premature resolution", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# Remediation Target Inventory",
      "",
      "| Target | Remediation Progress | Blocker State | Resolution | Acceptance | Oracle | Evidence | Independent Review |",
      "|---|---|---|---|---|---|---|---|",
      "| A | fixed | None | Resolved | TBD | - | | 未確認 |",
      "",
      "| Target | Remediation Progress | Blocker State | Resolution | Acceptance | Oracle | Evidence | Independent Review | Current Projection |",
      "|---|---|---|---|---|---|---|---|---|",
      "| B | Applied | None | Resolved | observed | comparison | Result.md | reviewer: Pass |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ambiguous-remediation-state",
    ),
  );
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "remediation-progress-value",
    ),
  );
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "premature-remediation-resolution",
    ),
  );
});

test("recognizable remediation tables require restart information for blockers", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# 是正対象一覧",
      "",
      "| 対象 | 処置進捗 | 阻害状態 | 解消判定 | 阻害理由 | 必要事項 | 担当責任者 | 再開条件 |",
      "|---|---|---|---|---|---|---|---|",
      "| A | Applied | Blocked | Open | 人間判断待ち | 判断 | - | 未定 |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "incomplete-remediation-blocker",
    ),
  );
});

test("remediation tables support outer-pipe-free GFM and pipes inside cells", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# 是正対象一覧",
      "",
      "   対象 | 処置進捗 | 阻害状態 | 解消判定 | 受入条件 | 判定方法 | 根拠 | 独立再レビュー | 現在状態への反映",
      "   ---|---|---|---|---|---|---|---|---",
      "   A | Self-checked | None | Resolved | 表示 \\| 非表示 | `left|right`を比較 | Result.md | reviewer: Pass | Current.md",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.remediation_rows_checked, 1);
});

test("remediation tables report a missing state axis", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# 是正対象一覧",
      "",
      "| 対象 | 処置進捗 | 解消判定 | 受入条件 |",
      "|---|---|---|---|",
      "| A | Applied | Open | 表示される |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "remediation-state-columns-missing",
    ),
  );
});

test("resolved remediation rejects inconsistent progress and blocker axes", () => {
  const root = fixture();
  makeStructure(root);
  const closure =
    "| observed | comparison | Result.md | reviewer: Pass | Current.md |";
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# Remediation Target Inventory",
      "",
      "| Target | Remediation Progress | Blocker State | Resolution | Acceptance | Oracle | Evidence | Independent Review | Current Projection |",
      "|---|---|---|---|---|---|---|---|---|",
      `| A | Identified | None | Resolved ${closure}`,
      `| B | Planned | None | Resolved ${closure}`,
      `| C | Applied | None | Resolved ${closure}`,
      `| D | Self-checked | Blocked | Resolved ${closure}`,
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.equal(
    result.report.findings.filter(
      (finding) => finding.code === "inconsistent-remediation-state",
    ).length,
    4,
  );
});

test("generic review tables are not treated as remediation tables", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "Review.md"),
    [
      "# Review Summary",
      "",
      "| Resolution | Independent Review |",
      "|---|---|",
      "| Accepted | reviewer: Pass |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.remediation_rows_checked, 0);
});

test("generic tables with two short state aliases are not remediation tables", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "Review.md"),
    [
      "# Review",
      "",
      "| Item | Blocker State | Resolution |",
      "|---|---|---|",
      "| X | None | Accepted |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.remediation_rows_checked, 0);
});

test("explicit remediation context detects a missing state axis without auxiliary columns", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# Remediation Target Inventory",
      "",
      "| Remediation Target | Remediation Progress | Resolution |",
      "|---|---|---|",
      "| A | Applied | Open |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 1);
  const finding = result.report.findings.find(
    (item) => item.code === "remediation-state-columns-missing",
  );
  assert.ok(finding);
  assert.match(finding.message, /阻害状態/u);
});

test("canonical English remediation headers are recognized", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "90_Release", "Changes", "Remediation.md"),
    [
      "# Remediation Target Inventory",
      "",
      "| Target | Remediation Progress | Remediation Blocker State | Remediation Resolution Verdict | Acceptance | Oracle | Evidence | Independent Review | Current Projection |",
      "|---|---|---|---|---|---|---|---|---|",
      "| A | Self-checked | None | Resolved | observed | comparison | Result.md | reviewer: Pass | Current.md |",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.remediation_rows_checked, 1);
});

test("branch coverage tables use one parser for GFM headers and rows", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "07_Quality", "Coverage.md"),
    [
      "# Coverage",
      "",
      "   `Target|Variant` | Covered Branches (Numerator) | Total Branches (Denominator) | Measured Rate",
      "   ---|---|---|---",
      "   A \\| B | 3 | 4 | 75%",
    ].join("\n"),
  );

  const result = runChecker(root);
  assert.equal(result.status, 0, JSON.stringify(result.report.findings));
  assert.equal(result.report.metrics.numeric_rows_checked, 1);
});
