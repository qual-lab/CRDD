import assert from "node:assert/strict";
import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

const testEntry = process.argv[1];
if (testEntry === undefined) throw new Error("checker_test_entry_missing");
const checkerRoot = path.resolve(
  path.dirname(path.resolve(testEntry)),
  "../..",
);
const repositoryRoot = path.resolve(checkerRoot, "../..");
const checker = path.join(repositoryRoot, "template", "tools", "crdd-check.ts");
const faultInjector = pathToFileURL(
  path.join(checkerRoot, "fault-injector.ts"),
).href;

test("主要工程ひな型は工程責務と構造表現を維持する", () => {
  const phaseTemplates = [
    "template/01_Discovery/01_Product_Discovery.md",
    "template/02_UX/01_User_Experience.md",
    "template/03_IA/01_Information_Architecture.md",
    "template/04_UI/01_User_Interface.md",
    "template/05_SPEC/01_Behavior_Specification.md",
    "template/06_Architecture/01_Architecture.md",
  ];
  for (const relativePath of phaseTemplates) {
    const content = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    if (relativePath === "template/01_Discovery/01_Product_Discovery.md") {
      assert.ok(
        content.includes("```text"),
        `${relativePath}: visual structure`,
      );
      assert.ok(content.includes("|"), `${relativePath}: structured mapping`);
      assert.ok(content.includes("## 探索台帳"), relativePath);
      assert.ok(content.includes("## 要求台帳"), relativePath);
      assert.ok(content.includes("## 次工程への入口と戻り方"), relativePath);
    } else if (relativePath === "template/02_UX/01_User_Experience.md") {
      assert.ok(
        content.includes("```text"),
        `${relativePath}: visual structure`,
      );
      assert.ok(content.includes("|"), `${relativePath}: structured mapping`);
      assert.ok(
        content.includes("## 1. Product Experience Intent"),
        relativePath,
      );
      assert.ok(content.includes("## 2. UX成果台帳"), relativePath);
      assert.ok(content.includes("## 3. REQとUX成果のCoverage"), relativePath);
      assert.ok(content.includes("## 5. 詳細成果物への案内"), relativePath);
    } else {
      assert.ok(content.includes("文章形式を要求しない"), relativePath);
      assert.ok(content.includes("## 対象範囲と現在状態"), relativePath);
      assert.ok(content.includes("## 判断"), relativePath);
    }
  }

  const discoveryTemplate = fs.readFileSync(
    path.join(repositoryRoot, "template/01_Discovery/01_Product_Discovery.md"),
    "utf8",
  );
  for (const required of [
    "## 人間理解の確認",
    "| 発火判定と理由 |",
    "| 人間の確認または修正 |",
    "理解確認を要求採用の判断へ読み替えず",
  ])
    assert.ok(discoveryTemplate.includes(required), required);

  const uxRequirementTemplatePath =
    "template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md";
  const uxRequirementTemplate = fs.readFileSync(
    path.join(repositoryRoot, uxRequirementTemplatePath),
    "utf8",
  );
  for (const required of [
    "## 1. REQの一次分析",
    "解決したい問題",
    "UXとして必要",
    "## 2. 利用者・目標・成果",
    "Primary Persona",
    "Goal",
    "Outcome",
    "## 3. 利用者に起きる変化",
    "Before",
    "After",
    "## 4. UX成果への統合",
    "REQとUXは多対多を許容する",
    "| UX成果 | 処置 | 判断理由 | この要求が補う内容 |",
    "## 5. 重要な体験",
    "Critical",
    "Failure",
    "Quality",
    "### このREQのJourney",
    "### Service Blueprintの処置",
    "処置: `作成`／`非該当`",
    "### 横断Synthesisへの接続",
    "### このREQでの責任境界",
    "### 補足する品質",
    "## 6. 下流への引き渡し",
    "Discoveryへ戻す条件",
  ])
    assert.ok(
      uxRequirementTemplate.includes(required),
      `${uxRequirementTemplatePath}: ${required}`,
    );

  const phaseDiagramProfiles = new Map<string, readonly string[]>([
    [
      "template/01_Discovery/01_Product_Discovery.md",
      [
        "業務範囲／入出力（SIPOC）",
        "Actor別Process（Swimlane）",
        "Value Stream",
        "As-Is／To-Be",
      ],
    ],
    [
      "template/02_UX/01_User_Experience.md",
      ["利用者Journey", "重要場面・失敗／回復体験図", "Service Blueprint"],
    ],
    [
      "template/03_IA/01_Information_Architecture.md",
      [
        "オブジェクト／関係図",
        "情報階層図",
        "Navigation図",
        "可視性／状態概念図",
      ],
    ],
    [
      "template/04_UI/01_User_Interface.md",
      [
        "論理画面／領域構成図",
        "画面／操作Flow",
        "表示状態／Variant図",
        "主要Component関係図",
        "UI／SPEC対応図",
      ],
    ],
    [
      "template/05_SPEC/01_Behavior_Specification.md",
      [
        "Use Case／振る舞いFlow",
        "状態遷移表／状態遷移図",
        "Actor／System間Sequence図",
        "Error／Effect分岐図",
        "UI／SPEC対応図",
      ],
    ],
    [
      "template/06_Architecture/01_Architecture.md",
      [
        "全体／内部ブロック図",
        "状態遷移表／状態遷移図",
        "ブロック間シーケンス図",
        "クラス／型関係図",
        "データフロー図（DFD）",
        "エンティティ関係図（ER図）",
        "スキーマ責務図（Schema Responsibility Map）",
      ],
    ],
    [
      "template/07_Quality/03_Verification_Design.md",
      [
        "検証義務・試験Level／Boundary対応図",
        "状態・分岐・Block別Coverage図",
        "検証結果・判断接続図",
      ],
    ],
  ]);
  const dispositionHeader =
    "| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |";
  const dispositionValues = ["`作成`", "`既存参照`", "`非該当`", "`作成不能`"];
  for (const [relativePath, diagrams] of phaseDiagramProfiles) {
    const content = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    assert.ok(
      content.includes("## 基本図の処置"),
      `${relativePath}: diagram disposition missing`,
    );
    assert.ok(
      content.includes(dispositionHeader),
      `${relativePath}: complete disposition semantics missing`,
    );
    for (const disposition of dispositionValues)
      assert.ok(
        content.includes(disposition),
        `${relativePath}: ${disposition}`,
      );
    for (const diagram of diagrams)
      assert.ok(
        content.includes(`| ${diagram} |`),
        `${relativePath}: ${diagram}`,
      );
  }

  const architectureTemplate = fs.readFileSync(
    path.join(repositoryRoot, "template/06_Architecture/01_Architecture.md"),
    "utf8",
  );
  assert.ok(
    architectureTemplate.includes("## 基本図の処置"),
    "architecture_diagram_disposition_missing",
  );
  for (const diagram of [
    "全体／内部ブロック図",
    "状態遷移表／状態遷移図",
    "ブロック間シーケンス図",
    "クラス／型関係図",
    "データフロー図（DFD）",
    "エンティティ関係図（ER図）",
    "スキーマ責務図（Schema Responsibility Map）",
  ]) {
    assert.ok(
      architectureTemplate.includes(`| ${diagram} |`),
      `architecture_diagram_disposition_missing: ${diagram}`,
    );
  }

  const architectureRule = fs.readFileSync(
    path.join(repositoryRoot, "27_Architecture.md"),
    "utf8",
  );
  for (const requiredRule of [
    "**エンティティ関係図（ER図）**",
    "[ER1: Entity名]",
    "**スキーマ責務図（Schema Responsibility Map）**",
    "[SR1: 責務領域名]",
    "Canonical Owner",
    "Must Not Own",
    "単一Entity／Schema内でOwnerと利用側が一意な局所表現変更",
  ]) {
    assert.ok(
      architectureRule.includes(requiredRule),
      `schema_responsibility_rule_missing: ${requiredRule}`,
    );
  }

  const documentation = fs.readFileSync(
    path.join(repositoryRoot, "03_Documentation.md"),
    "utf8",
  );
  const structuredFirst = documentation
    .split('<a id="104-structured-first"></a>')[1]
    ?.split(/^<a id=/mu)[0];
  assert.ok(structuredFirst, "structured_first_section_missing");
  for (const lifecycle of [
    "Discovery",
    "UX",
    "IA",
    "UI",
    "UI／振る舞い仕様の対応",
    "SPEC",
    "Architecture",
    "Implementation",
    "Verification",
    "Quality",
    "Communication",
  ]) {
    assert.ok(structuredFirst.includes(lifecycle), lifecycle);
  }
});

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
  const expectedEntries = names;
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
      assert.ok(!entries.includes("Verification_Results"));
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
    assert.ok(!fs.existsSync(path.join(root, "Verification_Results")));
  }
  const completeEntries = [...names];
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

test("Checker packageのLintはWarningを検査失敗にする", () => {
  const packageJson: unknown = JSON.parse(
    fs.readFileSync(path.join(checkerRoot, "package.json"), "utf8"),
  );
  const packageRecord = record(packageJson);
  const scripts = packageRecord && record(packageRecord.scripts);
  assert.equal(scripts?.lint, "biome lint ../.. --error-on-warnings");
});

test("CRDD所有packageの全回帰入口は静的検査後にだけ試験本体を開始する", () => {
  const packageRoots = [
    "artifact-signing",
    "checker",
    "coordinator",
    "execution-intelligence",
    "mcp",
    "project-runtime",
    "runtime-data",
    "version-control",
  ];
  for (const packageRoot of packageRoots) {
    const packageJson: unknown = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, "40_Develop", packageRoot, "package.json"),
        "utf8",
      ),
    );
    const packageRecord = record(packageJson);
    const scripts = packageRecord && record(packageRecord.scripts);
    assert.ok(scripts, packageRoot);
    const check = scripts.check;
    const regression = scripts.test;
    const testRun = scripts["test:run"];
    assert.ok(typeof check === "string", packageRoot);
    assert.deepEqual(
      check.split(" && ").slice(0, 3),
      ["npm run format:check", "npm run typecheck", "npm run lint"],
      packageRoot,
    );
    assert.ok(typeof testRun === "string", packageRoot);
    assert.equal(
      regression,
      packageRoot === "checker"
        ? "npm run check && npm run verify:repository && npm run test:run"
        : "npm run check && npm run test:run",
      packageRoot,
    );
  }
  const agentContract = fs.readFileSync(
    path.join(repositoryRoot, "AGENTS.md"),
    "utf8",
  );
  const checkIndex = agentContract.indexOf("最初に`npm run check`を成功させ");
  const restrictedIndex = agentContract.indexOf(
    "`npm run test:restricted-process`",
  );
  const windowsIndex = agentContract.indexOf("`npm run test:windows-process`");
  assert.ok(checkIndex >= 0, "AGENTS must require static checks first");
  assert.ok(
    restrictedIndex > checkIndex,
    "restricted tests must follow checks",
  );
  assert.ok(windowsIndex > restrictedIndex, "Windows tests must follow checks");
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
  "99_Roadmap",
];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-check-"));
  fixtures.push(root);
  return root;
}

test("工程基本図の必須列または閉じた処置語彙の欠落を拒否する", () => {
  const sourcePath = path.join(
    repositoryRoot,
    "template/02_UX/01_User_Experience.md",
  );
  const original = fs.readFileSync(sourcePath, "utf8");
  const mutations = [
    original.replace("| 基本図 | 対象 | 目的 | 処置 |", "| 基本図 | 処置 |"),
    original.replace(
      /(\| 利用者Journey \|[^\n]*\| )`既存参照`( \|)/,
      "$1保留$2",
    ),
    original.replace(/^\| Service Blueprint \|.*\r?\n/m, ""),
  ];
  for (const mutated of mutations) {
    const root = fixture();
    fs.mkdirSync(path.join(root, "template", "02_UX"), { recursive: true });
    fs.writeFileSync(path.join(root, "01_Principles.md"), "# Principles\n");
    fs.writeFileSync(
      path.join(root, "template", "02_UX", "01_User_Experience.md"),
      mutated,
      "utf8",
    );
    const result = runChecker(root);
    assert.equal(result.report.repository_mode, "official");
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "phase_diagram_disposition_contract_invalid" &&
          finding.path === "template/02_UX/01_User_Experience.md",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("Discoveryひな型から人間理解の確認契約を除去できない", () => {
  const sourcePath = path.join(
    repositoryRoot,
    "template/01_Discovery/01_Product_Discovery.md",
  );
  const original = fs.readFileSync(sourcePath, "utf8");
  const root = fixture();
  fs.mkdirSync(path.join(root, "template", "01_Discovery"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "01_Principles.md"), "# Principles\n");
  fs.writeFileSync(
    path.join(root, "template", "01_Discovery", "01_Product_Discovery.md"),
    original.replace("## 人間理解の確認", "## 理解記録"),
    "utf8",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "phase_diagram_disposition_contract_invalid" &&
        finding.path === "template/01_Discovery/01_Product_Discovery.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX要求分析Directoryの全欠落を拒否する", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "01_Discovery"), { recursive: true });
  fs.mkdirSync(path.join(root, "02_UX"), { recursive: true });
  fs.writeFileSync(path.join(root, "01_Principles.md"), "# Principles\n");
  fs.writeFileSync(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n",
  );
  fs.writeFileSync(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  fs.rmSync(path.join(root, "02_UX", "Analysis"), {
    recursive: true,
    force: true,
  });
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-requirement-analysis-root-missing" &&
        finding.path === "02_UX/Analysis",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Discoveryひな型へ空の共通Evidence Rootを再導入できない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n",
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "template", "01_Discovery", "Evidence", ".gitkeep"),
    "",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "phase-repository-legacy-root-present" &&
        finding.path === "template/01_Discovery/Evidence",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UXひな型へ空の共通Evidence Rootを再導入できない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n",
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(path.join(root, "template", "02_UX", "Evidence", ".gitkeep"), "");
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "phase-repository-legacy-root-present" &&
        finding.path === "template/02_UX/Evidence",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UXを主な関係領域に持たない採用要求もUX分析から省略できない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | Quality、Maintenance |\n| `REQ-000003` | Runtime | EXP | 要求採用 | UX、Architecture |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000003](Analysis/REQ-000003/ux_analysis.md)\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000003", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000003`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| Milestone | `New → UX-000001` | 利用者が目的を委ねられる独立成果である。 | 受入条件による委任を補う。 |\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-requirement-analysis-coverage-mismatch" &&
        finding.path === "02_UX/01_User_Experience.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析は探索記録だけでなく同じREQのDefinitionを正式入力にする", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  write(
    path.join(
      root,
      "01_Discovery",
      "Definitions",
      "REQ-000001",
      "requirement.md",
    ),
    discoveryDefinition("REQ-000001", "EXP-000001", "固有A"),
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n探索元: [EXP-000001](../../../01_Discovery/Analysis/EXP-000001/exploration.md)\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-requirement-formal-input-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析は別REQのDefinitionを正式入力にできない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  write(
    path.join(
      root,
      "01_Discovery",
      "Definitions",
      "REQ-000001",
      "requirement.md",
    ),
    discoveryDefinition("REQ-000001", "EXP-000001", "固有A"),
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n分析対象: [REQ-000002 別要求](../../../01_Discovery/Definitions/REQ-000002/requirement.md)\n判断根拠: [EXP-000001 探索](../../../01_Discovery/Analysis/EXP-000001/exploration.md)\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-requirement-formal-input-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析は全CommonMark参照形式のSource Analysis参照でDefinitionを補完できない", () => {
  const variants = [
    "不足する意味は[過去の探索](../../../01_Discovery/Analysis/EXP-000001/exploration.md)から補う。",
    "不足する意味は[過去の探索](../../../01_Discovery/Analysis/EXP-000001/exploration.md#仮説)から補う。",
    "不足する意味は[過去の探索][src]から補う。\n\n[src]: ../../../01_Discovery/Analysis/EXP-000001/exploration.md",
    "不足する意味は[過去の探索][]から補う。\n\n[過去の探索]: ../../../01_Discovery/Analysis/EXP-000001/exploration.md",
    "不足する意味は[過去の探索]から補う。\n\n[過去の探索]: ../../../01_Discovery/Analysis/EXP-000001/exploration.md",
    "不足する意味は[^根拠]から補う。\n\n[^根拠]: ../../../01_Discovery/Analysis/EXP-000001/exploration.md",
  ];
  for (const supplementalLink of variants) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
    );
    write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
    write(
      path.join(
        root,
        "01_Discovery",
        "Definitions",
        "REQ-000001",
        "requirement.md",
      ),
      discoveryDefinition("REQ-000001", "EXP-000001", "固有A"),
    );
    write(
      path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
      `# Analysis\n\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n\n## 補足\n\n${supplementalLink}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ux-requirement-formal-input-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UX分析は正しいHeaderに任意参照形式の別REQ Definitionを追加できない", () => {
  const variants = [
    "補助入力: [別要求](../../../01_Discovery/Definitions/REQ-000002/requirement.md)",
    "補助入力: [別要求]\n\n[別要求]: ../../../01_Discovery/Definitions/REQ-000002/requirement.md",
    "補助入力: [^別要求]\n\n[^別要求]: ../../../01_Discovery/Definitions/REQ-000002/requirement.md",
  ];
  for (const supplementalLink of variants) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n| `REQ-000002` | B | EXP | 要求採用 | UX |\n",
    );
    write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
    for (const [id, marker] of [
      ["REQ-000001", "固有A"],
      ["REQ-000002", "固有B"],
    ])
      write(
        path.join(root, "01_Discovery", "Definitions", id, "requirement.md"),
        discoveryDefinition(id, "EXP-000001", marker),
      );
    write(
      path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
      `# Analysis\n\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n\n${supplementalLink}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ux-requirement-formal-input-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("独立したUX Definitionは同じGoalと重要体験の定型コピーを共有できない", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n| `UX-000002` B | `REQ-000001` |\n",
  );
  const sharedDefinitionBody =
    "\n## 利用者成果\n\n独立成果。\n\n## 利用者・状況・Goal\n\n| 項目 | 内容 |\n|---|---|\n| Primary Persona／Context | 利用者 |\n| Trigger／Situation | 開始時 |\n| Goal | 状態を理解する |\n| Outcome | 次へ進める |\n\n## 成立条件\n\n- 成立する。\n\n## 重要な体験と品質期待\n\n```text\n開始 → 理解 → 次へ\n```\n\n## 検証意図\n\n反証する。\n\n## 関係\n\n- Source REQ Analysis: REQ-000001\n";
  for (const id of ["UX-000001", "UX-000002"])
    write(
      path.join(root, "02_UX", "Definitions", id, "experience.md"),
      `# ${id}\n\n成果物種別: UX Definition\nUX ID: \`${id}\`\n${sharedDefinitionBody}`,
    );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-definition-semantic-boilerplate-duplicate",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("見出しだけ揃えた共通定型のDiscovery Definitionを要求固有の意味とみなさない", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n| `REQ-000002` | B | EXP | 要求採用 | UX |\n",
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  for (const id of ["REQ-000001", "REQ-000002"])
    write(
      path.join(root, "01_Discovery", "Definitions", id, "requirement.md"),
      discoveryDefinition(id, "EXP-000001", "全要求で同じ定型説明"),
    );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
        "discovery-requirement-definition-boilerplate-duplicate",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UXのSame判断は要求固有の理由を必要とする", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 同じ成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 同じ成果 | `Same → UX-000001` | 同じ。 | 補完。 |\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-requirement-analysis-relation-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UXのSame判断は固定ラベル列挙なしでも要求固有の十分な理由を受け付ける", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 同じ成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 同じ成果 | `Same → UX-000001` | 利用者が得る最終成果は既存UXと共通し、追加条件は独立したOutcomeではない。 | 要求固有の条件を補う。 |\n",
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) =>
        finding.code === "ux-requirement-analysis-relation-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX統合の理由付きNot ApplicableをRelation不正にしない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| UX成果なし | `Not Applicable` | 利用者のGoalまたはOutcomeを変更せず、既存体験の成立条件にも追加差分がない。 | Canonical UX成果へ追加する内容はない。 |\n\n### Service Blueprintの処置\n\n処置: `非該当`\n\n複数主体間のHandoffは体験成立条件ではないため作成せず、条件が変わった時に再評価する。\n\n### 横断Synthesisへの接続\n",
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) =>
        finding.code === "ux-requirement-analysis-relation-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Service Blueprintの作成と非該当を処置なしで済ませない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 成果 | `New → UX-000001` | 利用者成果を独立して変更し確認する必要がある。 | 要求固有の条件を補う。 |\n\n### Service Blueprintの処置\n\n共同Service Blueprintを参照する。\n\n### 横断Synthesisへの接続\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
          "ux-requirement-analysis-blueprint-disposition-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("作成するService Blueprintは主体・時間関係・完了情報・失敗時の判断を閉じる", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 成果 | `New → UX-000001` | 利用者成果を独立して変更し確認する必要がある。 | 要求固有の条件を補う。 |\n\n### Service Blueprintの処置\n\n処置: `作成`\n\n```text\n利用者 [接点] 結果\n  └─ 失敗時: 担当者へ戻す\n```\n\n### 横断Synthesisへの接続\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
          "ux-requirement-analysis-blueprint-disposition-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("作成するService Blueprintは完了時に返る情報を省略できない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 成果 | `New → UX-000001` | 利用者成果を独立して変更し確認する必要がある。 | 要求固有の条件を補う。 |\n\n### Service Blueprintの処置\n\n処置: `作成`\n\n```text\n[U: 利用者]\n  ▼\n[T: 入力]\n  ├─ 時間差: 同期確認\n  └─ 失敗時: 判断不能範囲を返す\n       ▼\n[R: 判断者]\n  └─ 次の行動: 入力を直す\n--- 可視境界 ---\n[S: 提供System]\n```\n\n### 横断Synthesisへの接続\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
          "ux-requirement-analysis-blueprint-disposition-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX台帳と要求分析のRelationが閉じていない状態を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000002` 台帳だけの成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 分析だけの成果 | `New → UX-000001` | 利用者の成果と失敗条件が独立しているため新規成果として確定する。 | 要求固有の条件を補う。 |\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-outcome-relation-closure-mismatch" &&
        finding.path === "02_UX/01_User_Experience.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX台帳と要求分析はID集合でなくREQとUXの組で閉じる", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n| `REQ-000002` | B | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n[REQ-000002](Analysis/REQ-000002/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n| `UX-000002` B | `REQ-000002` |\n",
  );
  for (const [req, ux] of [
    ["REQ-000001", "UX-000002"],
    ["REQ-000002", "UX-000001"],
  ])
    write(
      path.join(root, "02_UX", "Analysis", req, "ux_analysis.md"),
      `# Analysis\n\n要求: \`${req}\`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| Outcome | \`New → ${ux}\` | 独立して変更し確認する利用者成果として扱う。 | この要求の利用場面を補う。 |\n`,
    );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-outcome-relation-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Canonical UX台帳の同一ID二重定義を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n| `UX-000001` B | `REQ-000002` |\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "duplicate-stable-id-definition" &&
        finding.path.includes("02_UX/01_User_Experience.md"),
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Experience Mapと要求分析のJourney割当不一致を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| UX成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "03_Experience_Map.md"),
    "# Map\n\n| Journey | Primary Persona | 起点 | 望むOutcome | 関係する主なREQ |\n|---|---|---|---|---|\n| Projectの現在地を判断する | PM | 起点 | 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. UX成果への統合\n\n| UX成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| A | `New → UX-000001` | 独立して確認する利用者成果として扱う。 | この要求の利用場面を補う。 |\n\n- Journeyの横断統合先: [Runtimeを導入する](../../03_Experience_Map.md#runtimeを導入する)\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-journey-relation-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

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

function discoveryDefinition(
  requirementId: string,
  explorationId: string,
  marker: string,
): string {
  return `# ${requirementId} 要求\n\n成果物種別: Discovery Definition\n要求ID: \`${requirementId}\`\n\n## 要求\n\n${marker}として利用者が望む結果を得られる要求である。\n\n## 対象と利用状況\n\n${marker}の対象者が、判断に必要な情報を確認する具体的な状況を扱う。\n\n## 解く問題と望ましい変化\n\n${marker}により現在の問題を識別し、再現可能な望ましい状態へ変える。\n\n## 採用理由と比較\n\n${marker}では代替案との違いと、採用した理由および残る弱点を比較する。\n\n## 成立条件\n\n- ${marker}の正常結果を確認できる\n- ${marker}の不完全状態を正常へ丸めない\n- ${marker}を破る反証を拒否できる\n\n## 制約\n\n- ${marker}の決定権限を下流へ移さない\n- ${marker}の対象外を完成扱いしない\n\n## 検証意図\n\n${marker}の正常、境界、失敗を実際の観測結果で区別できることを確認する。\n\n## 工程引渡し\n\n| 引渡し先 | 失ってはならない意味 | 下流で決めること |\n|---|---|---|\n| UX | ${marker}の利用者、状況、問題、変化 | GoalとOutcome |\n| IA以降 | ${marker}の状態と制約 | 工程固有設計 |\n\n## 関係\n\n- Source Analysis: [${explorationId}](../../Analysis/${explorationId}/exploration.md)\n`;
}

function dispositionFixtureRoot(hasFixedEvidence = false): string {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "00_CRDD"), { recursive: true, force: true });
  write(path.join(root, "01_Principles.md"), "# Principles\n");
  fs.mkdirSync(path.join(root, "template"), { recursive: true });
  write(
    path.join(
      root,
      "90_Release",
      "Changes",
      "CHG-000065_Structured_First_Documentation.md",
    ),
    "# Change Trace\n",
  );
  write(
    path.join(
      root,
      "90_Release",
      "Changes",
      "CHG-000063_Runtime_Responsibility_Separation.md",
    ),
    "# Runtime Responsibility\n\n状態: `Signed Verification Pending`\n\n前の署名候補\n\n現在候補\n\n現行Gate: 再署名と影響E2E待ち\n",
  );
  write(
    path.join(root, "90_Release", "Changes", "README.md"),
    "# Changes\n\n| 項目 | 内容 |\n|---|---|\n| 現在状態の正本 | [品質の現在状態](../../07_Quality/01_Quality_Center.md) |\n| 過去本文の固定Identity | Git上の固定履歴 |\n\n## 目的から読む場所を選ぶ\n\n取得方法: `git --no-replace-objects show <ref>:<path>`\n",
  );
  write(
    path.join(root, "07_Quality", "01_Quality_Center.md"),
    "# Quality Center\n\n現在候補\n\n前の署名候補\n\n現在候補の技術Gate: 再署名待ち\n\nv0.20全体の残るGate: 再署名と影響E2E\n\n[検証結果](../99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md)\n",
  );
  write(
    path.join(
      root,
      "07_Quality",
      "Verification_Results",
      "2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md",
    ),
    "# Verification\n\n前候補。現在のGateはQuality Centerが所有する。\n\n現在候補は再署名と影響E2E待ち。\n",
  );
  write(
    path.join(root, "99_Roadmap", "01_Roadmap.md"),
    "# Roadmap\n\n| 作業 | 判断状態 | 対応状態 | 次の処置 |\n|---|---|---|---|\n| v0.20 Runtime責務分離 | Adopted | Signed Verification Pending | 再署名と影響E2E |\n",
  );
  write(
    path.join(root, "99_Roadmap", "02_Changes.md"),
    "# Changes\n\n| 項目 | 内容 |\n|---|---|\n| 現在状態の正本 | [品質の現在状態](../07_Quality/01_Quality_Center.md) |\n| 過去本文の固定Identity | Git上の固定履歴 |\n\n## 目的から読む場所を選ぶ\n\n取得方法: `git --no-replace-objects show <ref>:<path>`\n",
  );
  if (hasFixedEvidence) {
    write(
      path.join(root, "90_Release", "Changes", "Evidence", "fixed.md"),
      "# Fixed Evidence\n\n[当時の検証結果](../../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)\n",
    );
    write(
      path.join(root, "90_Release", "Changes", "Evidence", "fixed.json"),
      '{"observedPath":"90_Release/Changes/Evidence/fixed.md"}\n',
    );
  }
  initializeGit(root);
  const committed = spawnSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "add",
      ".",
    ],
    { encoding: "utf8" },
  );
  assert.equal(committed.status, 0, committed.stderr);
  const commit = spawnSync(
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
      "fixture",
    ],
    { encoding: "utf8" },
  );
  assert.equal(commit.status, 0, commit.stderr);
  const tag = spawnSync("git", ["-C", root, "tag", "v0.19.0"], {
    encoding: "utf8",
  });
  assert.equal(tag.status, 0, tag.stderr);
  write(
    path.join(root, "99_Roadmap", "Changes", "CHG-000063", "change.md"),
    `# Runtime Responsibility\n\n変更ID: CHG-000063\n\n### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n- [\`99_Roadmap/Changes/CHG-000063/change.md\`](./change.md)\n\n</details>\n\n${fs.readFileSync(
      path.join(
        root,
        "90_Release",
        "Changes",
        "CHG-000063_Runtime_Responsibility_Separation.md",
      ),
      "utf8",
    )}`,
  );
  write(
    path.join(root, "99_Roadmap", "Changes", "CHG-000065", "change.md"),
    "# Structured-first Documentation\n\n変更ID: CHG-000065\n\n### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n- [`99_Roadmap/Changes/CHG-000065/change.md`](./change.md)\n\n</details>\n",
  );
  write(
    path.join(
      root,
      "99_Roadmap",
      "Releases",
      "v0.20.0",
      "Evidence",
      "260906_v020-public-runtime-and-bounded-integration-verification.md",
    ),
    fs.readFileSync(
      path.join(
        root,
        "07_Quality",
        "Verification_Results",
        "2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md",
      ),
      "utf8",
    ),
  );
  if (hasFixedEvidence) {
    write(
      path.join(
        root,
        "99_Roadmap",
        "Changes",
        "CHG-000063",
        "Evidence",
        "260906_fixed.md",
      ),
      fs.readFileSync(
        path.join(root, "90_Release", "Changes", "Evidence", "fixed.md"),
        "utf8",
      ),
    );
    fs.copyFileSync(
      path.join(root, "90_Release", "Changes", "Evidence", "fixed.json"),
      path.join(
        root,
        "99_Roadmap",
        "Changes",
        "CHG-000063",
        "Evidence",
        "260906_fixed.json",
      ),
    );
  }
  fs.rmSync(path.join(root, "90_Release"), { recursive: true, force: true });
  fs.rmSync(path.join(root, "07_Quality", "Verification_Results"), {
    recursive: true,
    force: true,
  });
  const sourceCommit = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout.trim();
  const sourceTree = spawnSync(
    "git",
    ["-C", root, "show", "-s", "--format=%T", sourceCommit],
    { encoding: "utf8" },
  ).stdout.trim();
  const migratedEvidence = [
    {
      source:
        "07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md",
      target:
        "99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md",
    },
    ...(hasFixedEvidence
      ? [
          {
            source: "90_Release/Changes/Evidence/fixed.md",
            target: "99_Roadmap/Changes/CHG-000063/Evidence/260906_fixed.md",
          },
          {
            source: "90_Release/Changes/Evidence/fixed.json",
            target: "99_Roadmap/Changes/CHG-000063/Evidence/260906_fixed.json",
          },
        ]
      : []),
  ].map(({ source, target }) => {
    const targetBytes = fs.readFileSync(path.join(root, target));
    return {
      source,
      target,
      sourceSha256: createHash("sha256").update(targetBytes).digest("hex"),
      sourceBytes: targetBytes.length,
      targetSha256: createHash("sha256").update(targetBytes).digest("hex"),
      targetBytes: targetBytes.length,
      currentnessAtMigration: "fixed_history",
    };
  });
  write(
    path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000070",
      "Evidence",
      "260912-2142_migration-map.json",
    ),
    `${JSON.stringify(
      {
        contract: "crdd/work-lifecycle-migration-map",
        contractRevision: 1,
        sourceCommit,
        sourceTree,
        transformationContract: "fixed-history-byte-preserving-v3",
        status: "migrated",
        changes: 0,
        changeEvidence: hasFixedEvidence ? 2 : 0,
        verificationResults: 1,
        releases: ["v0.20.0"],
        totalMoves: migratedEvidence.length,
        entries: migratedEvidence,
      },
      null,
      2,
    )}\n`,
  );
  const stagedCurrentLayout = spawnSync("git", ["-C", root, "add", "-A"], {
    encoding: "utf8",
  });
  assert.equal(stagedCurrentLayout.status, 0, stagedCurrentLayout.stderr);
  return root;
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

test("Canonical案内文書の名称移行後に旧表題を残さない", () => {
  const root = dispositionFixtureRoot();
  const roadmapPath = path.join(root, "99_Roadmap", "01_Roadmap.md");
  write(
    roadmapPath,
    fs
      .readFileSync(roadmapPath, "utf8")
      .replace("# Roadmap", "# CRDD Product Roadmap"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "canonical-document-title-mismatch" &&
        finding.path === "99_Roadmap/01_Roadmap.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Work Lifecycle契約は旧Evidence集約Pathの再導入を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "07_Quality", "Verification_Results", "restored.md"),
    "# Restored legacy evidence\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "legacy-work-lifecycle-path-present" &&
        finding.path === "07_Quality/Verification_Results",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
});

test("Work Lifecycle契約は全Change aggregateの案内欠落を拒否する", () => {
  const root = dispositionFixtureRoot();
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "change-navigation-population-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
});

test("Change契約は影響ファイルの全数表示区画を要求する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "99_Roadmap", "Changes", "CHG-000065", "change.md"),
    "# Change\n\n変更ID: CHG-000065\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "change-impact-files-section-mismatch" &&
        finding.path === "99_Roadmap/Changes/CHG-000065/change.md",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
});

test("Change契約は代表ファイルだけを示す旧表示を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "99_Roadmap", "Changes", "CHG-000065", "change.md"),
    "# Change\n\n変更ID: CHG-000065\n\n### 影響ファイル\n\n<details>\n<summary>代表ファイルを表示</summary>\n\n- [`change.md`](./change.md)\n\n</details>\n\n### 主な反映ファイル\n",
  );
  const result = runChecker(root);
  for (const expectedCode of [
    "change-impact-files-contract-invalid",
    "legacy-change-impact-heading",
  ])
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === expectedCode &&
          finding.path === "99_Roadmap/Changes/CHG-000065/change.md",
      ),
      `${expectedCode}\n${result.stderr}\n${result.stdout}`,
    );
});

test("Change契約は影響ファイルへ重複分類の親子階層を作らない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "99_Roadmap", "Changes", "CHG-000065", "change.md"),
    "# Change\n\n変更ID: CHG-000065\n\n### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n- 構造変更A\n  - [`change.md`](./change.md)\n\n</details>\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "change-impact-files-contract-invalid" &&
        finding.path === "99_Roadmap/Changes/CHG-000065/change.md",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
});

test("Work Lifecycle契約はRelease Evidenceの案内欠落を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(path.join(root, "99_Roadmap", "03_Releases.md"), "# Releases\n");
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "release-evidence-navigation-incomplete",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
});

test("Change記録とWork Lifecycle Evidenceの通常リンク切れを検出する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "99_Roadmap", "Changes", "CHG-000070", "change.md"),
    "# Change\n\n[固定時点の参照](../../old-location.md)\n",
  );
  write(
    path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000070",
      "Evidence",
      "260913_audit.md",
    ),
    "# Evidence\n\n[固定時点の参照](../../../old-evidence.md)\n",
  );
  const result = runChecker(root);
  for (const expectedPath of [
    "99_Roadmap/Changes/CHG-000070/change.md",
    "99_Roadmap/Changes/CHG-000070/Evidence/260913_audit.md",
  ])
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "broken-link" && finding.path === expectedPath,
      ),
      `${expectedPath}\n${JSON.stringify(result.report.findings)}`,
    );
});

test("固定履歴本文の旧リンクを移行表から解決し本文変更を要求しない", () => {
  const root = dispositionFixtureRoot(true);
  const result = runChecker(root);
  assert.equal(
    result.report.findings.some(
      (finding) =>
        finding.path ===
          "99_Roadmap/Changes/CHG-000063/Evidence/260906_fixed.md" &&
        finding.code === "broken-link",
    ),
    false,
    JSON.stringify(result.report.findings),
  );
});

test("固定履歴本文が移行表のHashから変化した場合は拒否する", () => {
  const root = dispositionFixtureRoot(true);
  fs.appendFileSync(
    path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000063",
      "Evidence",
      "260906_fixed.md",
    ),
    "改変\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "fixed-history-content-mismatch" &&
        finding.path ===
          "99_Roadmap/Changes/CHG-000063/Evidence/260906_fixed.md",
    ),
    JSON.stringify(result.report.findings),
  );
});

test("移行表の重複・Root外Path・不正Hashを拒否する", () => {
  const firstEntry = (manifest: {
    entries: Array<Record<string, unknown>>;
  }): Record<string, unknown> => {
    const [entry] = manifest.entries;
    assert.ok(entry);
    return entry;
  };
  const mutations = [
    (manifest: { entries: Array<Record<string, unknown>> }) => {
      manifest.entries.push({ ...firstEntry(manifest) });
    },
    (manifest: { entries: Array<Record<string, unknown>> }) => {
      firstEntry(manifest).source = "../outside.md";
    },
    (manifest: { entries: Array<Record<string, unknown>> }) => {
      firstEntry(manifest).targetSha256 = "not-a-sha256";
    },
  ];
  for (const mutate of mutations) {
    const root = dispositionFixtureRoot();
    const manifestPath = path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000070",
      "Evidence",
      "260912-2142_migration-map.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      entries: Array<Record<string, unknown>>;
    };
    mutate(manifest);
    write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "fixed-history-migration-map-invalid",
      ),
      JSON.stringify(result.report.findings),
    );
  }
});

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

function stableReleaseClosureFixture() {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  for (const name of ["01_Principles.md", "02_Terminology.md"]) {
    write(
      path.join(root, name),
      `# 正本\n\nVersion: v0.17.0\nStatus: Stable\nOwner: Team\n`,
    );
  }
  write(path.join(root, "README.md"), "Version: **v0.17.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    [
      "## English",
      "### v0.17.0 — 2026-09-12",
      "- `migration_required: false`",
      "## 日本語",
      "### v0.17.0 — 2026-09-12",
      "- `migration_required: false`",
    ].join("\n"),
  );
  return root;
}

test("Stable最終候補に残った現行MarkdownのCandidate表示を拒否する", () => {
  const root = stableReleaseClosureFixture();
  write(
    path.join(root, "06_Architecture", "01_Architecture.md"),
    "# 設計\n\n状態: Candidate（v0.17.0、Released Baseline: v0.16.0）\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "stable-release-candidate-residue",
    ),
    JSON.stringify(result.report),
  );
});

test("Stable最終候補のREADME版と英日Release見出しを相関検査する", () => {
  const root = stableReleaseClosureFixture();
  write(path.join(root, "README.md"), "Version: **v0.16.0**\n");
  write(
    path.join(root, "CHANGELOG.md"),
    "## English\n### v0.17.0 — 2026-09-12\n- `migration_required: false`\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "stable-release-readme-version-mismatch",
    ),
    JSON.stringify(result.report),
  );
  assert.ok(
    result.report.findings.some(
      (item) =>
        item.code === "stable-release-changelog-bilingual-closure-mismatch",
    ),
  );
});

test("Stable最終候補では全CRDD正本の版と状態を閉包検査する", () => {
  const root = stableReleaseClosureFixture();
  write(
    path.join(root, "02_Terminology.md"),
    "# 正本\n\nVersion: v0.17.0\nStatus: Draft\nOwner: Team\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "stable-release-canonical-status-mismatch",
    ),
    JSON.stringify(result.report),
  );
});

test("Change Traceは公式tag前にReleasedを名乗らず引渡し可能状態を保持する", () => {
  const root = stableReleaseClosureFixture();
  const changePath = path.join(
    root,
    "99_Roadmap",
    "Changes",
    "CHG-000001",
    "change.md",
  );
  write(
    changePath,
    "# Change\n\n状態: `Released`\n対象版: `v0.17.0`\nリリース: `v0.17.0`（2026-09-12）\n",
  );
  const premature = runChecker(root);
  assert.ok(
    premature.report.findings.some(
      (item) => item.code === "stable-release-change-trace-premature-release",
    ),
    JSON.stringify(premature.report),
  );

  write(
    changePath,
    "# Change\n\n状態: `Ready for Release Handoff`\n対象版: `v0.17.0`\n収載対象: `v0.17.0`\n",
  );
  const ready = runChecker(root);
  assert.equal(
    ready.report.findings.some((item) =>
      [
        "stable-release-change-trace-not-ready",
        "stable-release-change-trace-premature-release",
      ].includes(item.code),
    ),
    false,
    JSON.stringify(ready.report),
  );
});

test("既存の公式tagが現在HEAD以外を指すStable状態を拒否する", () => {
  const root = stableReleaseClosureFixture();
  initializeGit(root);
  const commit = (message: string) => {
    const added = spawnSync("git", ["-C", root, "add", "."], {
      encoding: "utf8",
    });
    assert.equal(added.status, 0, added.stderr);
    const committed = spawnSync(
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
        message,
      ],
      { encoding: "utf8" },
    );
    assert.equal(committed.status, 0, committed.stderr);
  };
  commit("release candidate");
  const tagged = spawnSync("git", ["-C", root, "tag", "v0.17.0"], {
    encoding: "utf8",
  });
  assert.equal(tagged.status, 0, tagged.stderr);
  write(path.join(root, "post-tag.md"), "# post tag change\n");
  commit("post tag change");

  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (item) => item.code === "stable-release-tag-identity-mismatch",
    ),
    JSON.stringify(result.report),
  );
});

test("次版Candidateは公開済み基準版のtag不一致や候補残存として扱わない", () => {
  const root = stableReleaseClosureFixture();
  initializeGit(root);
  const commit = (message: string) => {
    const added = spawnSync("git", ["-C", root, "add", "."], {
      encoding: "utf8",
    });
    assert.equal(added.status, 0, added.stderr);
    const committed = spawnSync(
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
        message,
      ],
      { encoding: "utf8" },
    );
    assert.equal(committed.status, 0, committed.stderr);
  };
  commit("v0.17.0 release");
  const tagged = spawnSync("git", ["-C", root, "tag", "v0.17.0"], {
    encoding: "utf8",
  });
  assert.equal(tagged.status, 0, tagged.stderr);
  write(
    path.join(root, "06_Architecture", "01_Architecture.md"),
    "# 設計\n\n状態: Candidate（v0.18.0、Released Baseline: v0.17.0）\n",
  );
  commit("start v0.18.0");

  const result = runChecker(root);
  assert.equal(
    result.report.findings.some((item) =>
      [
        "stable-release-candidate-residue",
        "stable-release-tag-identity-mismatch",
      ].includes(item.code),
    ),
    false,
    JSON.stringify(result.report),
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

test("安定コンテキストIDへ手動改訂番号を結合した表記を拒否する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n| UX成果 |\n|---|\n| UX-000001@2 |\n",
  );
  const result = runChecker(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "stable-id-manual-revision",
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
  write(
    path.join(
      source,
      "template",
      "tools",
      "internal",
      "version-control-runtime.ts",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template",
        "tools",
        "internal",
        "version-control-runtime.ts",
      ),
      "utf8",
    ),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
    path.join(root, "07_Quality", "Remediation.md"),
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
