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
      assert.ok(content.includes("## Checklist"), relativePath);
      assert.ok(content.includes("- [ ] "), relativePath);
    } else if (relativePath === "template/02_UX/01_User_Experience.md") {
      assert.ok(
        content.includes("```text"),
        `${relativePath}: visual structure`,
      );
      assert.ok(content.includes("|"), `${relativePath}: structured mapping`);
      assert.ok(
        content.includes("## 1. 製品全体で目指す利用体験"),
        relativePath,
      );
      assert.ok(content.includes("## 2. UX成果台帳"), relativePath);
      assert.ok(content.includes("## 3. 要求とUX成果の網羅状況"), relativePath);
      assert.ok(content.includes("## 5. 詳細成果物への案内"), relativePath);
    } else if (
      relativePath === "template/03_IA/01_Information_Architecture.md"
    ) {
      assert.ok(
        content.includes("```text"),
        `${relativePath}: visual structure`,
      );
      assert.ok(content.includes("|"), `${relativePath}: structured mapping`);
      assert.ok(content.includes("## 1. 何を分かりやすくするか"), relativePath);
      assert.ok(content.includes("## 2. 入力と網羅状況"), relativePath);
      assert.ok(content.includes("## 3. IA定義台帳"), relativePath);
      assert.ok(content.includes("## 5. 基本図の処置"), relativePath);
    } else if (
      relativePath === "template/05_SPEC/01_Behavior_Specification.md"
    ) {
      assert.ok(
        content.includes("```text"),
        `${relativePath}: visual structure`,
      );
      assert.ok(content.includes("|"), `${relativePath}: structured mapping`);
      assert.ok(content.includes("## 1. SPEC工程で解くこと"), relativePath);
      assert.ok(content.includes("## 2. 入力と網羅状況"), relativePath);
      assert.ok(content.includes("## 3. SPEC定義台帳"), relativePath);
      assert.ok(content.includes("## 5. 基本図の処置"), relativePath);
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

  const phaseOwnedArtifactTypes = new Map<string, string>([
    [
      "template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md",
      "成果物種別: Discovery分析",
    ],
    [
      "template/01_Discovery/Definitions/REQ-XXXXXX/requirement.md",
      "成果物種別: Discovery定義",
    ],
    ["template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md", "成果物種別: UX分析"],
    [
      "template/02_UX/Definitions/UX-XXXXXX/ux_definition.md",
      "成果物種別: UX定義",
    ],
    ["template/03_IA/Analysis/UX-XXXXXX/ia_analysis.md", "成果物種別: IA分析"],
    [
      "template/03_IA/Definitions/IA-XXXXXX/ia_definition.md",
      "成果物種別: IA定義",
    ],
    [
      "template/06_Architecture/Analysis/UI-XXXXXX/architecture_analysis.md",
      "成果物種別: Architecture分析（UI観点）",
    ],
    [
      "template/06_Architecture/Analysis/SPEC-XXXXXX/architecture_analysis.md",
      "成果物種別: Architecture分析（SPEC観点）",
    ],
    [
      "template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md",
      "成果物種別: Architecture定義",
    ],
  ]);
  for (const [relativePath, expectedType] of phaseOwnedArtifactTypes) {
    const content = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    assert.ok(
      content.includes(expectedType),
      `${relativePath}: ${expectedType}`,
    );
  }

  const uxRequirementTemplatePath =
    "template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md";
  const uxRequirementTemplate = fs.readFileSync(
    path.join(repositoryRoot, uxRequirementTemplatePath),
    "utf8",
  );
  for (const required of [
    "## 1. 要求の一次分析",
    "解決したい問題",
    "人の体験として扱う",
    "## 2. 利用者・目標・成果",
    "主な想定利用者",
    "目的",
    "得られる結果",
    "## 3. 利用者に起きる変化",
    "変更前",
    "変更後",
    "## 4. 利用者成果への統合",
    "要求とUXは多対多を許容する",
    "| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |",
    "### Same判断の比較",
    "| 担い手 |",
    "| 利用のきっかけ |",
    "| 得られる結果 |",
    "| 避ける失敗 |",
    "## 5. 重要な体験",
    "重要場面",
    "失敗",
    "守る品質",
    "### この要求での利用の流れ",
    "### サービス提供の流れの処置",
    "処置: `作成`／`非該当`",
    "### 製品全体の整理への接続",
    "### この要求での責任境界",
    "### 補足する品質",
    "## 6. 下流への引き渡し",
    "### 妥当性確認と未確認事項",
    "現在判定:",
    "確認事項:",
    "判断者:",
    "未確認時の影響:",
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
        "担い手別の仕事の流れ（Swimlane）",
        "価値が届くまでの流れ",
        "現状／変更後",
      ],
    ],
    [
      "template/02_UX/01_User_Experience.md",
      ["利用の流れ", "重要場面・失敗／回復体験図", "サービス提供の流れ"],
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
      /^## (?:[0-9]+\.\s+)?基本図の処置$/mu.test(content),
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
    "品質保証（Quality）",
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
    "04_Quality_Integration.md",
    "05_Current_Implementation_Reality_Audit.md",
  ];
  const directoryNames = ["Analysis", "Definitions"];
  const oldNames = names.map((name) => name.slice(3));
  const expectedEntries = [...names, "Analysis/", "Definitions/", "Registry/"];
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
      for (const name of directoryNames)
        assert.ok(entries.includes(name), name);
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
    for (const name of directoryNames) {
      assert.ok(fs.lstatSync(path.join(root, name)).isDirectory(), name);
    }
    assert.ok(!fs.existsSync(path.join(root, "Verification_Results")));
  }
  const completeEntries = [...names, ...directoryNames];
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
    original.replace(/(\| 利用の流れ \|[^\n]*\| )`既存参照`( \|)/, "$1保留$2"),
    original.replace(/^\| サービス提供の流れ \|.*\r?\n/m, ""),
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

test("IA分析は全UX定義を一件ずつ覆う", () => {
  const root = iaReconstructionFixtureRoot();
  fs.rmSync(path.join(root, "03_IA", "Analysis", "UX-000001"), {
    recursive: true,
    force: true,
  });
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ia-analysis-coverage-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA分析は同じUX定義を正式入力にする", () => {
  const root = iaReconstructionFixtureRoot();
  const analysisPath = path.join(
    root,
    "03_IA",
    "Analysis",
    "UX-000001",
    "ia_analysis.md",
  );
  const analysis = fs.readFileSync(analysisPath, "utf8");
  write(
    analysisPath,
    analysis.replaceAll(
      "UX-000001/ux_definition.md",
      "UX-000002/ux_definition.md",
    ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ia-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA分析の実ひな型を埋めた成果物を受理する", () => {
  const root = iaReconstructionFixtureRoot();
  const template = fs.readFileSync(
    path.join(
      repositoryRoot,
      "template",
      "03_IA",
      "Analysis",
      "UX-XXXXXX",
      "ia_analysis.md",
    ),
    "utf8",
  );
  const filled = template
    .replaceAll("UX-XXXXXX", "UX-000001")
    .replace("[分析名]", "試験用")
    .replace("[このUXの利用者]", "試験利用者")
    .replace("[このUXが必要になる場面]", "判断する時")
    .replace("[利用者が達成したいこと]", "対象を理解する")
    .replace("[利用者に起きる変化]", "次の行動を選べる")
    .replace("[誤認や判断が生じる重要な時点]", "判断する直前")
    .replace("[このUXで防ぐ失敗]", "不明を正常と誤認する")
    .replace("[利用者成果を守る品質]", "根拠を失わない")
    .replaceAll("[object A]", "対象")
    .replaceAll("[object B]", "根拠")
    .replace("[利用者がこの情報を見分ける理由]", "判断対象")
    .replace("[同じものと別のものを区別する条件]", "安定IDで識別する")
    .replace("[object Aとの関係、所属、情報源または時点]", "対象と情報源へ結ぶ")
    .replace(
      "| IA-XXXXXX | [分析で見つけたObject] | [Canonical候補] | Same／Rename／Merge／Split | [意味を維持して統合・分離する理由] |",
      "| IA-000001 | 対象 | 対象 | Same | 同じ意味を保持する |\n| IA-000001 | 根拠 | 根拠 | Same | 同じ意味を保持する |",
    )
    .replace(
      "[New／Same、接続するIA-ID、判断理由、未確認事項を記す。]",
      "[IA-000001](../../Definitions/IA-000001/ia_definition.md)へ接続する。",
    )
    .replace(
      "ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。\n\n",
      "",
    )
    .replaceAll("- [ ] ", "- [x] ");
  write(
    path.join(root, "03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
    filled,
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) => finding.code === "ia-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA分析の縮小見出しと三列契約の欠落を拒否する", () => {
  for (const mutate of [
    (value: string) =>
      value.replace("## 3. 状態・可視性・導線・責任", "## 3. 可視性と責任"),
    (value: string) =>
      value.replace(
        "| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |",
        "| 情報Object | 分析結果 |",
      ),
    (value: string) => value.replace(/^\| 守る品質 \|.*\r?\n/mu, ""),
  ]) {
    const root = iaReconstructionFixtureRoot();
    const analysisPath = path.join(
      root,
      "03_IA",
      "Analysis",
      "UX-000001",
      "ia_analysis.md",
    );
    write(analysisPath, mutate(fs.readFileSync(analysisPath, "utf8")));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ia-analysis-contract-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IA正本は成果物別の可視で評価済みChecklistを必要とする", () => {
  const cases: Array<[string, string]> = [
    [
      path.join("03_IA", "01_Information_Architecture.md"),
      "ia-artifact-checklist-invalid",
    ],
    [
      path.join("03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
      "ia-analysis-contract-invalid",
    ],
    [
      path.join("03_IA", "Definitions", "IA-000001", "ia_definition.md"),
      "ia-definition-contract-invalid",
    ],
  ];
  for (const [relativePath, findingCode] of cases) {
    const root = iaReconstructionFixtureRoot();
    const artifactPath = path.join(root, relativePath);
    write(
      artifactPath,
      fs
        .readFileSync(artifactPath, "utf8")
        .replace(/\n## Checklist[\s\S]*$/u, ""),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) => finding.code === findingCode),
      `${relativePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IAひな型は未評価の正確なChecklist項目集合を持つ", () => {
  for (const mutate of [
    (value: string) => value.replace("- [ ] StateとVisibilityを定義した\n", ""),
    (value: string) =>
      value.replace(
        "- [ ] StateとVisibilityを定義した",
        "- [x] StateとVisibilityを定義した",
      ),
  ]) {
    const root = iaReconstructionFixtureRoot();
    const templatePath = path.join(
      root,
      "template",
      "03_IA",
      "Definitions",
      "IA-XXXXXX",
      "ia_definition.md",
    );
    write(templatePath, mutate(fs.readFileSync(templatePath, "utf8")));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ia-template-checklist-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IAの後続関係表へArchitectureその他の直接Handoffを追加できない", () => {
  for (const relativePath of [
    path.join("03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
    path.join("03_IA", "Definitions", "IA-000001", "ia_definition.md"),
  ]) {
    const root = iaReconstructionFixtureRoot();
    const artifactPath = path.join(root, relativePath);
    write(
      artifactPath,
      fs
        .readFileSync(artifactPath, "utf8")
        .replace(
          "| Quality Analysis / IA（伴走） | 成立条件を保持する |",
          "| Quality Analysis / IA（伴走） | 成立条件を保持する |\n| Architecture | Componentへ直接渡す |",
        ),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) =>
        [
          "ia-analysis-contract-invalid",
          "ia-definition-contract-invalid",
        ].includes(finding.code),
      ),
      `${relativePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IA横断投影は全Canonical IA IDを一件ずつ処置する", () => {
  for (const replacement of [
    "",
    "| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 重複 |\n| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 重複 |",
  ]) {
    const root = iaReconstructionFixtureRoot();
    const artifactPath = path.join(
      root,
      "03_IA",
      "02_Object_and_Relation_Model.md",
    );
    write(
      artifactPath,
      fs
        .readFileSync(artifactPath, "utf8")
        .replace(
          "| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 試験用の横断投影へ接続 |",
          replacement,
        ),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ia-cross-projection-coverage-mismatch",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IA分析Objectは全件を一意に処置する", () => {
  for (const mutate of [
    (value: string) =>
      value.replace(
        "| IA-000001 | 根拠 | 根拠 | Same | 同じ意味を保持する |\n",
        "",
      ),
    (value: string) =>
      value.replace(
        "| IA-000001 | 根拠 | 根拠 | Same | 同じ意味を保持する |",
        "| IA-000001 | 根拠 | 根拠 | Same | 同じ意味を保持する |\n| IA-000001 | 根拠 | 根拠 | Same | 重複処置 |",
      ),
    (value: string) => value.replace("| Same | 同じ意味", "| New | 同じ意味"),
    (value: string) =>
      value.replace(
        "| IA-000001 | 根拠 | 根拠 | Same | 同じ意味を保持する |",
        "| IA-000001 | 根拠 | 根拠 | Not Applicable | 対象外と誤記する |",
      ),
  ]) {
    const root = iaReconstructionFixtureRoot();
    const analysisPath = path.join(
      root,
      "03_IA",
      "Analysis",
      "UX-000001",
      "ia_analysis.md",
    );
    write(analysisPath, mutate(fs.readFileSync(analysisPath, "utf8")));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ia-analysis-contract-invalid" ||
          finding.code === "ia-object-mapping-closure-mismatch",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IA定義Mappingは実在する分析ObjectとCanonical Objectだけを使う", () => {
  for (const mutate of [
    (value: string) => value.replace("UX-000001: 根拠", "UX-000001: 偽Object"),
    (value: string) =>
      value.replace(
        "| 根拠 | 判断を支える情報 | 対象と情報源へ結ぶ |",
        "| 根拠 | 判断を支える情報 | 対象と情報源へ結ぶ |\n| 追加対象 | Mappingのない対象 | 識別不能 |",
      ),
    (value: string) => value.replace("| Same | 同じ意味", "| New | 同じ意味"),
    (value: string) => value.replace("[O: 根拠]", "[O: 偽Object]"),
    (value: string) =>
      value.replace(
        "| UX-000001: 根拠 | 対象と情報源へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。関係を維持する |\n",
        "",
      ),
    (value: string) =>
      value.replace(
        "| UX-000001: 根拠 | 対象と情報源へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。関係を維持する |",
        "| UX-000001: 根拠 | 対象と情報源へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。関係を維持する |\n| UX-000001: 根拠 | 対象と情報源へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。重複行 |",
      ),
    (value: string) =>
      value.replace(
        "| UX-000001: 根拠 | 対象と情報源へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。関係を維持する |",
        "| UX-000001: 根拠 | 別の対象へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。関係を維持する |",
      ),
    (value: string) =>
      value.replace("[O: 対象] --支えられる--> [O: 根拠]", "[O: 対象]"),
  ]) {
    const root = iaReconstructionFixtureRoot();
    const definitionPath = path.join(
      root,
      "03_IA",
      "Definitions",
      "IA-000001",
      "ia_definition.md",
    );
    write(definitionPath, mutate(fs.readFileSync(definitionPath, "utf8")));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ia-definition-contract-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("REQ表示をDiscovery分析へ偽装接続できない", () => {
  const root = iaReconstructionFixtureRoot();
  write(
    path.join(root, "06_Architecture", "sample.md"),
    "# Sample\n\n要求: [`REQ-000001`](../01_Discovery/Analysis/EXP-000001/exploration.md)\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "discovery-identity-link-owner-mismatch" &&
        finding.path === "06_Architecture/sample.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA台帳とIA定義Directoryは同じ集合を持つ", () => {
  const root = iaReconstructionFixtureRoot();
  const indexPath = path.join(root, "03_IA", "01_Information_Architecture.md");
  write(indexPath, "# IA\n");
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ia-definition-index-coverage-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA分析の処置とIA定義の情報源はUXとIAの組で閉じる", () => {
  const root = iaReconstructionFixtureRoot();
  const indexPath = path.join(root, "03_IA", "01_Information_Architecture.md");
  write(
    indexPath,
    `${fs.readFileSync(indexPath, "utf8")}| [IA-000002](Definitions/IA-000002/ia_definition.md) | 追加情報 | UX-000001 |\n`,
  );
  write(
    path.join(root, "03_IA", "Definitions", "IA-000002", "ia_definition.md"),
    iaDefinition("IA-000002", "UX-000001"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ia-analysis-definition-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA台帳の入力UXも分析処置と定義情報源へ完全一致する", () => {
  const root = iaReconstructionFixtureRoot();
  const indexPath = path.join(root, "03_IA", "01_Information_Architecture.md");
  write(
    indexPath,
    fs
      .readFileSync(indexPath, "utf8")
      .replace("| UX-000001 |", "| UX-000002 |"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ia-analysis-definition-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA関係は分析処置節と定義情報源節の外へ移せない", () => {
  for (const target of ["analysis", "definition"] as const) {
    const root = iaReconstructionFixtureRoot();
    const filePath =
      target === "analysis"
        ? path.join(root, "03_IA", "Analysis", "UX-000001", "ia_analysis.md")
        : path.join(
            root,
            "03_IA",
            "Definitions",
            "IA-000001",
            "ia_definition.md",
          );
    const source = fs.readFileSync(filePath, "utf8");
    const moved =
      target === "analysis"
        ? source.replace(
            "## 5. IA処置\n\n[IA-000001](../../Definitions/IA-000001/ia_definition.md)へ接続する。",
            "[IA-000001](../../Definitions/IA-000001/ia_definition.md)\n\n## 5. IA処置\n\n処置先を本文外へ移した。",
          )
        : source.replace(
            "## 情報源\n\n- [UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)",
            "- [UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)\n\n## 情報源\n\n情報源を本文外へ移した。",
          );
    write(filePath, moved);
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ia-analysis-definition-closure-mismatch",
      ),
      `${target}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("IA関係の重複行または対象節の重複を拒否する", () => {
  for (const mutate of [
    (root: string) => {
      const indexPath = path.join(
        root,
        "03_IA",
        "01_Information_Architecture.md",
      );
      const source = fs.readFileSync(indexPath, "utf8");
      const row = source
        .split(/\r?\n/u)
        .find((line) => line.startsWith("| [IA-000001]"));
      write(indexPath, `${source}${row}\n`);
    },
    (root: string) => {
      const analysisPath = path.join(
        root,
        "03_IA",
        "Analysis",
        "UX-000001",
        "ia_analysis.md",
      );
      write(
        analysisPath,
        `${fs.readFileSync(analysisPath, "utf8")}\n## 5. IA処置\n\n[IA-000001](../../Definitions/IA-000001/ia_definition.md)へ接続する。\n`,
      );
    },
    (root: string) => {
      const definitionPath = path.join(
        root,
        "03_IA",
        "Definitions",
        "IA-000001",
        "ia_definition.md",
      );
      write(
        definitionPath,
        `${fs.readFileSync(definitionPath, "utf8")}\n## 情報源\n\n- [UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)\n`,
      );
    },
  ]) {
    const root = iaReconstructionFixtureRoot();
    mutate(root);
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ia-analysis-definition-closure-mismatch",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("非表示Markdownだけに置かれたIA台帳・処置・情報源を拒否する", () => {
  const cases: Array<{
    file: (root: string) => string;
    canonical: string;
    replacement: string;
    hide: (value: string) => string;
  }> = [
    {
      file: (root) =>
        path.join(root, "03_IA", "01_Information_Architecture.md"),
      canonical:
        "| [IA-000001](Definitions/IA-000001/ia_definition.md) | 試験用情報 | UX-000001 |",
      replacement: "台帳関係は表示されない例だけに置く。",
      hide: (value) => `\n\`\`\`text\n${value}\n\`\`\`\n`,
    },
    {
      file: (root) =>
        path.join(root, "03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
      canonical:
        "## 5. IA処置\n\n[IA-000001](../../Definitions/IA-000001/ia_definition.md)へ接続する。",
      replacement: "## 5. 処置記録\n\n正式な処置節はない。",
      hide: (value) => `\n~~~text\n${value}\n~~~\n`,
    },
    {
      file: (root) =>
        path.join(
          root,
          "03_IA",
          "Definitions",
          "IA-000001",
          "ia_definition.md",
        ),
      canonical:
        "## 情報源\n\n- [UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)",
      replacement: "## 参考記録\n\n正式な情報源節はない。",
      hide: (value) => `\n<!--\n${value}\n-->\n`,
    },
  ];

  for (const item of cases) {
    const root = iaReconstructionFixtureRoot();
    const filePath = item.file(root);
    const source = fs.readFileSync(filePath, "utf8");
    write(
      filePath,
      source.replace(item.canonical, item.replacement) +
        item.hide(item.canonical),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) =>
        [
          "ia-definition-index-coverage-mismatch",
          "ia-analysis-contract-invalid",
          "ia-definition-contract-invalid",
          "ia-analysis-definition-closure-mismatch",
        ].includes(finding.code),
      ),
      `${filePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("表示されるIA構造が正しければ非表示の偽構造を関係として数えない", () => {
  const root = iaReconstructionFixtureRoot();
  const indexPath = path.join(root, "03_IA", "01_Information_Architecture.md");
  const analysisPath = path.join(
    root,
    "03_IA",
    "Analysis",
    "UX-000001",
    "ia_analysis.md",
  );
  const definitionPath = path.join(
    root,
    "03_IA",
    "Definitions",
    "IA-000001",
    "ia_definition.md",
  );
  write(
    indexPath,
    `${fs.readFileSync(indexPath, "utf8")}\n\`\`\`text\n| [IA-000001](Definitions/IA-000001/ia_definition.md) | 重複 | UX-000001 |\n\`\`\`\n`,
  );
  write(
    analysisPath,
    `${fs.readFileSync(analysisPath, "utf8")}\n~~~text\n## 5. IA処置\n\n[IA-000002](../../Definitions/IA-000002/ia_definition.md)へ接続する。\n~~~\n`,
  );
  write(
    definitionPath,
    `${fs.readFileSync(definitionPath, "utf8")}\n<!--\n## 情報源\n\n- [UX-000002のIA分析](../../Analysis/UX-000002/ia_analysis.md)\n-->\n`,
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some((finding) =>
      [
        "ia-definition-index-coverage-mismatch",
        "ia-analysis-contract-invalid",
        "ia-definition-contract-invalid",
        "ia-analysis-definition-closure-mismatch",
      ].includes(finding.code),
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("未閉鎖HTMLコメントだけに置かれたIA構造を成立根拠にしない", () => {
  const cases = [
    {
      file: (root: string) =>
        path.join(root, "03_IA", "01_Information_Architecture.md"),
      canonical:
        "| [IA-000001](Definitions/IA-000001/ia_definition.md) | 試験用情報 | UX-000001 |",
      replacement: "台帳関係は未閉鎖コメント内だけに置く。",
    },
    {
      file: (root: string) =>
        path.join(root, "03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
      canonical:
        "## 5. IA処置\n\n[IA-000001](../../Definitions/IA-000001/ia_definition.md)へ接続する。",
      replacement: "## 5. 処置記録\n\n正式な処置節はない。",
    },
    {
      file: (root: string) =>
        path.join(
          root,
          "03_IA",
          "Definitions",
          "IA-000001",
          "ia_definition.md",
        ),
      canonical:
        "## 情報源\n\n- [UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)",
      replacement: "## 参考記録\n\n正式な情報源節はない。",
    },
  ];

  for (const item of cases) {
    const root = iaReconstructionFixtureRoot();
    const filePath = item.file(root);
    const source = fs.readFileSync(filePath, "utf8");
    write(
      filePath,
      `${source.replace(item.canonical, item.replacement)}\n<!--\n${item.canonical}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) =>
        [
          "ia-definition-index-coverage-mismatch",
          "ia-analysis-contract-invalid",
          "ia-definition-contract-invalid",
          "ia-analysis-definition-closure-mismatch",
        ].includes(finding.code),
      ),
      `${filePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("コメントとコードフェンスの入れ子は後続の正式IA構造を隠さない", () => {
  for (const prefix of [
    "<!--\n```text\n~~~text\n-->\n",
    "```text\n<!--\n~~~text\n```\n",
    "~~~text\n<!--\n```text\n~~~\n",
  ]) {
    const root = iaReconstructionFixtureRoot();
    for (const filePath of [
      path.join(root, "03_IA", "01_Information_Architecture.md"),
      path.join(root, "03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
      path.join(root, "03_IA", "Definitions", "IA-000001", "ia_definition.md"),
    ])
      write(filePath, prefix + fs.readFileSync(filePath, "utf8"));

    const result = runChecker(root);
    assert.ok(
      !result.report.findings.some((finding) =>
        [
          "ia-definition-index-coverage-mismatch",
          "ia-analysis-contract-invalid",
          "ia-definition-contract-invalid",
          "ia-analysis-definition-closure-mismatch",
        ].includes(finding.code),
      ),
      `${prefix}\n${result.stdout}\n${result.stderr}`,
    );
  }
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

test("Discovery分析は工程と役割を識別できる成果物種別を宣言する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n",
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "Analysis", "EXP-000001", "exploration.md"),
    "# 探索\n\n成果物種別: 探索記録\n\n探索ID: `EXP-000001`\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "discovery-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Discovery正本は可視で評価済みのChecklistを必要とする", () => {
  for (const checklist of [
    "<!--\n## Checklist\n\n- [x] 本文を確認した。\n-->",
    "## Checklist\n\n- [ ] 本文を確認した。",
    "## Checklist\n\n- 確認した。",
  ]) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
    );
    write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
    fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
    const analysisPath = path.join(
      root,
      "01_Discovery",
      "Analysis",
      "EXP-000001",
      "exploration.md",
    );
    write(
      analysisPath,
      `# 探索\n\n成果物種別: Discovery分析\n探索ID: \`EXP-000001\`\n\n${checklist}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "discovery-checklist-contract-invalid" &&
          finding.path === "01_Discovery/Analysis/EXP-000001/exploration.md",
      ),
      `${checklist}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("Discovery正本は理由付きのOPEN・FAIL・N/Aを受け付ける", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    `# Discovery\n\n${evaluatedChecklist(
      discoveryRootChecklistTestItems,
      new Map([
        [1, ["OPEN", "人間確認を待っている"]],
        [2, ["FAIL", "関係の根拠が不足している"]],
        [4, ["N/A", "基本図の対象が存在しない"]],
      ]),
    )}\n`,
  );
  write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) =>
        finding.code === "discovery-checklist-contract-invalid" &&
        finding.path === "01_Discovery/01_Product_Discovery.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Discovery Checklistは末尾と成果物種別固有の項目集合を必要とする", () => {
  const invalidChecklists = [
    `${evaluatedChecklist(discoveryExplorationChecklistTestItems)}\n\n## 補足\n\nChecklist後の本文。`,
    `${evaluatedChecklist(discoveryExplorationChecklistTestItems)}\n\nChecklist後の通常段落。`,
    `${evaluatedChecklist(discoveryExplorationChecklistTestItems)}\n\n### 小見出し\n\n補足。`,
    `${evaluatedChecklist(discoveryExplorationChecklistTestItems)}\n\n> Checklist後の引用。`,
    `${evaluatedChecklist(discoveryExplorationChecklistTestItems)}\n\n| 項目 | 値 |\n|---|---|\n| 補足 | 不可 |`,
    evaluatedChecklist(discoveryRootChecklistTestItems),
    "## Checklist\n\n- [x] 要求定義を確認した。",
  ];
  for (const checklist of invalidChecklists) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
    );
    write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
    fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
    const analysisPath = path.join(
      root,
      "01_Discovery",
      "Analysis",
      "EXP-000001",
      "exploration.md",
    );
    write(
      analysisPath,
      `# 探索\n\n成果物種別: Discovery分析\n探索ID: \`EXP-000001\`\n\n${checklist}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "discovery-checklist-contract-invalid" &&
          finding.path === "01_Discovery/Analysis/EXP-000001/exploration.md",
      ),
      `${checklist}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("Discoveryひな型のChecklist項目を後続Sectionへ移せない", () => {
  for (const heading of [
    "## 補足",
    "### 小見出し",
    "   ## 字下げした補足",
    "  ### 字下げした小見出し",
    "補足\n---",
  ]) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
    );
    write(path.join(root, "02_UX", "01_User_Experience.md"), "# UX\n");
    fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
    const templatePath = path.join(
      root,
      "template",
      "01_Discovery",
      "Analysis",
      "EXP-XXXXXX",
      "exploration.md",
    );
    const template = fs.readFileSync(
      path.join(
        repositoryRoot,
        "template",
        "01_Discovery",
        "Analysis",
        "EXP-XXXXXX",
        "exploration.md",
      ),
      "utf8",
    );
    write(
      templatePath,
      template.replace("\n- [ ] 情報源", `\n${heading}\n\n- [ ] 情報源`),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "discovery-checklist-template-invalid" &&
          finding.path ===
            "template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md",
      ),
      `${heading}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UX正本は成果物別の可視で評価済みのChecklistを必要とする", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    `# UX\n\n${evaluatedChecklist(uxIndexChecklistTestItems)}\n`,
  );
  const analysisPath = path.join(
    root,
    "02_UX",
    "Analysis",
    "REQ-000001",
    "ux_analysis.md",
  );
  write(
    analysisPath,
    `# UX分析\n\n成果物種別: UX分析\n\n## Checklist\n\n- [ ] 未評価のまま残した\n`,
  );
  const definitionPath = path.join(
    root,
    "02_UX",
    "Definitions",
    "UX-000001",
    "ux_definition.md",
  );
  write(
    definitionPath,
    `# UX定義\n\n成果物種別: UX定義\nUX ID: \`UX-000001\`\n状態: Canonical\n\n${evaluatedChecklist(uxDefinitionChecklistTestItems)}\n\nChecklist後の本文。\n`,
  );
  const result = runChecker(root);
  for (const expectedPath of [
    "02_UX/Analysis/REQ-000001/ux_analysis.md",
    "02_UX/Definitions/UX-000001/ux_definition.md",
  ])
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ux-checklist-contract-invalid" &&
          finding.path === expectedPath,
      ),
      `${expectedPath}\n${result.stdout}\n${result.stderr}`,
    );
});

test("UX Checklistは末尾と成果物種別固有の項目集合を必要とする", () => {
  for (const invalidChecklist of [
    evaluatedChecklist(uxIndexChecklistTestItems),
    `${evaluatedChecklist(uxAnalysisChecklistTestItems)}\n\n## 補足\n\n後続本文。`,
    `${evaluatedChecklist(uxAnalysisChecklistTestItems)}\n\n> 後続の引用。`,
    "## Checklist\n\n- [x] UXを確認した",
  ]) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
    );
    write(
      path.join(root, "02_UX", "01_User_Experience.md"),
      `# UX\n\n${evaluatedChecklist(uxIndexChecklistTestItems)}\n`,
    );
    write(
      path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
      `# UX分析\n\n成果物種別: UX分析\n\n${invalidChecklist}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ux-checklist-contract-invalid" &&
          finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
      ),
      `${invalidChecklist}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UXひな型のChecklist項目を後続Sectionへ移せない", () => {
  for (const heading of ["## 補足", "   ### 字下げ", "補足\n---"]) {
    const root = dispositionFixtureRoot();
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
    );
    write(
      path.join(root, "02_UX", "01_User_Experience.md"),
      `# UX\n\n${evaluatedChecklist(uxIndexChecklistTestItems)}\n`,
    );
    fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
    const templatePath = path.join(
      root,
      "template",
      "02_UX",
      "Analysis",
      "REQ-XXXXXX",
      "ux_analysis.md",
    );
    const template = fs.readFileSync(
      path.join(
        repositoryRoot,
        "template",
        "02_UX",
        "Analysis",
        "REQ-XXXXXX",
        "ux_analysis.md",
      ),
      "utf8",
    );
    write(
      templatePath,
      template.replace("\n- [ ] 同じREQ", `\n${heading}\n\n- [ ] 同じREQ`),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ux-checklist-template-invalid" &&
          finding.path === "template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md",
      ),
      `${heading}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UXの正本投影と七つのひな型を欠落させられない", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    `# UX\n\n${evaluatedChecklist(uxIndexChecklistTestItems)}\n`,
  );

  const result = runChecker(root);
  for (const expectedPath of [
    "02_UX/02_Personas.md",
    "02_UX/03_Experience_Map.md",
    "02_UX/04_Service_Blueprint.md",
    "02_UX/05_Quality_Expectations.md",
  ])
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ux-canonical-projection-missing" &&
          finding.path === expectedPath,
      ),
      `${expectedPath}\n${result.stdout}\n${result.stderr}`,
    );

  for (const expectedPath of [
    "template/02_UX/01_User_Experience.md",
    "template/02_UX/02_Personas.md",
    "template/02_UX/03_Experience_Map.md",
    "template/02_UX/04_Service_Blueprint.md",
    "template/02_UX/05_Quality_Expectations.md",
    "template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md",
    "template/02_UX/Definitions/UX-XXXXXX/ux_definition.md",
  ])
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ux-template-missing" &&
          finding.path === expectedPath,
      ),
      `${expectedPath}\n${result.stdout}\n${result.stderr}`,
    );
});

test("横断UX成果物は全UX IDを重複なく投影する", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    `# UX\n\n| UX ID | 元の要求 |\n|---|---|\n| \`UX-000001\` | \`REQ-000001\` |\n| \`UX-000002\` | \`REQ-000002\` |\n\n${evaluatedChecklist(uxIndexChecklistTestItems)}\n`,
  );
  write(
    path.join(root, "02_UX", "02_Personas.md"),
    "# Personas\n\n## 3. UX成果との対応\n\n| UX ID | 対応 |\n|---|---|\n| [UX-000001](Definitions/UX-000001/ux_definition.md) | 対応 |\n| [UX-000001](Definitions/UX-000001/ux_definition.md) | 重複 |\n",
  );

  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-cross-cutting-projection-incomplete" &&
        finding.path === "02_UX/02_Personas.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UXからIAを飛び越える旧Handoffを再導入できない", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    `# UX\n\nIA／UI／SPEC／Verificationへ直接Handoffする。\n\n${evaluatedChecklist(uxIndexChecklistTestItems)}\n`,
  );

  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ux-direct-downstream-handoff-reintroduced" &&
        finding.path === "02_UX/01_User_Experience.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UXの正規Handoffへ言い換えた直接接続を追加できない", () => {
  for (const [relativePath, insertionPoint] of [
    ["02_UX/01_User_Experience.md", "| IAへの正式な引き渡し |"],
    [
      "02_UX/Analysis/REQ-000001/ux_analysis.md",
      "| SPEC（後続Contract Relation） |",
    ],
    [
      "02_UX/Definitions/UX-000001/ux_definition.md",
      "| SPEC（後続Contract Relation） |",
    ],
  ] as const) {
    const root = dispositionFixtureRoot();
    fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
    write(
      path.join(root, "01_Discovery", "01_Product_Discovery.md"),
      `# Discovery\n\n${evaluatedChecklist(discoveryRootChecklistTestItems)}\n`,
    );
    write(
      path.join(root, "02_UX", "01_User_Experience.md"),
      fs.readFileSync(
        path.join(repositoryRoot, "02_UX", "01_User_Experience.md"),
        "utf8",
      ),
    );
    const sourcePath = path.join(repositoryRoot, relativePath);
    const targetPath = path.join(root, relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    const line = source
      .split(/\r?\n/u)
      .find((candidate) => candidate.startsWith(insertionPoint));
    assert.ok(line, `${relativePath}: insertion point`);
    const invalidHandoff =
      relativePath === "02_UX/01_User_Experience.md"
        ? "| Developmentへの直接引き渡し | IAを経由せず実装へ渡す |"
        : "| Architecture（直接Handoff） | UI／SPECを経由せず設計へ渡す |";
    write(targetPath, source.replace(line, `${line}\n${invalidHandoff}`));

    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "ux-direct-downstream-handoff-reintroduced" &&
          finding.path === relativePath,
      ),
      `${relativePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
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
    "# Analysis\n\n要求: `REQ-000003`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| Milestone | `New → UX-000001` | 利用者が目的を委ねられる独立成果である。 | 受入条件による委任を補う。 |\n",
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

test("UX分析の正式入力Headerは可視本文のHeader自身へ結合する", () => {
  const invalidVariants = [
    "<!-- 分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md) -->\n\n参考: [同じ要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)",
    "```text\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n```\n\n参考: [同じ要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)",
    "~~~text\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n~~~\n\n参考: [同じ要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)",
  ];
  for (const body of invalidVariants) {
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
      `# Analysis\n\n${body}\n`,
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "ux-requirement-formal-input-invalid",
      ),
      `${body}\n${result.stdout}\n${result.stderr}`,
    );
  }

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
    "# Analysis\n\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n\n<!-- 分析対象: [REQ-000001 重複例](../../../01_Discovery/Definitions/REQ-000001/requirement.md) -->\n\n```text\n分析対象: [REQ-000001 重複例](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n```\n",
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
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
    '不足する意味は<a href="../../../01_Discovery/Analysis/EXP-000001/exploration.md">過去の探索</a>から補う。',
    "不足する意味は`../../../01_Discovery/Analysis/EXP-000001/exploration.md`から補う。",
    "不足する意味は ../../../01_Discovery/Analysis/EXP-000001/exploration.md から補う。",
    "不足する意味は ./../../../01_Discovery/Analysis/EXP-000001/exploration.md から補う。",
    "不足する意味は 01_Discovery/Analysis/EXP-000001/exploration.md から補う。",
    '<a href="../../../../outside/requirement.md">ルート外入力</a>',
    "<a href=../../../01_Discovery/Analysis/EXP-000001/exploration.md>過去の探索</a>",
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration%ZZ.md">不正符号化入力</a>',
    "不足する意味は 01_Discovery/Analysis/EXP-INVALID/exploration.md から補う。",
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration%252emd">二重符号化入力</a>',
    '<a href="..&sol;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md">entity化した探索入力</a>',
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration&#46;md">数値entity化した探索入力</a>',
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration&#999999999999;md">範囲外entity入力</a>',
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration&#xD800;md">surrogate entity入力</a>',
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration&solmd">不完全entity入力</a>',
    "[entity化inline](..&sol;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md)",
    "[未知entity inline](../../../01&bogus;_Discovery/Analysis/EXP-000001/exploration.md)",
    "[未知entity full][src]\n\n[src]: ../../../01_Discovery&bogus;/Analysis/EXP-000001/exploration.md",
    "[未知entity collapsed][]\n\n[未知entity collapsed]: ../../../01_Discovery/&bogus;Analysis/EXP-000001/exploration.md",
    "[未知entity shortcut]\n\n[未知entity shortcut]: ../../../01_Discovery/Analysis&bogus;/EXP-000001/exploration.md",
    "[^未知entity]\n\n[^未知entity]: ../../../01_Discovery/Analysis/EXP-000001/exploration&bogus;.md",
    "[複合未知entity inline](../../../01&u;Discovery&v;Analysis&sol;EXP-000001&sol;exploration&period;md)",
    "[複合未知entity full][multi]\n\n[multi]: ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md",
    "[複合未知entity collapsed][]\n\n[複合未知entity collapsed]: ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md",
    "[複合未知entity shortcut]\n\n[複合未知entity shortcut]: ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md",
    "[^複合未知entity]\n\n[^複合未知entity]: ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md",
    '<a href="../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md">複合未知entity HTML</a>',
    "<a href=../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md>複合未知entity非引用HTML</a>",
    "不足する意味は ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md から補う。",
    "不足する意味は ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md\\&literal; から補う。",
    "不足する意味は \\&literal;../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md から補う。",
    "不足する意味は ../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration&x;.md\\&literal; から補う。",
    "不足する意味は \\&sol;note:../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md から補う。",
    "不足する意味は \\&sol;,..&sol;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md から補う。",
    "不足する意味は \\&bsol;note:../../../01&u;Discovery&v;Definitions&w;REQ-000002/requirement.md から補う。",
    "不足する意味は \\&sol;&#58;../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md から補う。",
    "不足する意味は \\&bsol;&colon;../../../01&u;Discovery&v;Analysis&w;EXP-000001/exploration.md から補う。",
    "不足する意味は ..&sol;..&sol;..&sol;&#48;&#49;&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md から補う。",
    "不足する意味は ..&sol;..&sol;..&sol;&#x30;&#x31;&lowbar;Discovery&sol;Definitions&sol;REQ-000002&sol;requirement&period;md から補う。",
    "不足する意味は ..&sol;..&sol;..&sol;0&#49;&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md から補う。",
    '<a href="../../../01_Discovery/Analysis/EXP-000001/exploration&bogus;.md>閉じていないHTML入力',
    "<a href=../../../01_Discovery/Analysis/EXP-000001/exploration&bogus;.md>未知entity非引用HTML</a>",
    "不足する意味は ..&sol;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md から補う。",
    "不足する意味は ../../../01_Discovery/Analysis/EXP-000001/exploration%252e&sol;md から補う。",
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
      `${supplementalLink}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UX分析の例示内にある探索Pathは正式入力へ昇格しない", () => {
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
    "# Analysis\n\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n\n<!-- ../../../01_Discovery/Analysis/EXP-000001/exploration.md -->\n\n```text\n../../../01_Discovery/Analysis/EXP-000001/exploration.md\n```\n\n~~~text\n01_Discovery/Analysis/EXP-000001/exploration.md\n~~~\n\n\\[例示](../../../01_Discovery/Analysis/EXP-000001/exploration.md)\n\n\\../../../01_Discovery/Analysis/EXP-000001/exploration.md\n\n\\..&sol;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md\n\n..\\&sol;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md\n\n..\\&sol;&#47;..&sol;..&sol;01&lowbar;Discovery&sol;Analysis&sol;EXP-000001&sol;exploration&period;md\n",
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) => finding.code === "ux-requirement-formal-input-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析の通常本文にあるentity付き一般語をPathと誤認しない", () => {
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
    "# Analysis\n\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n\nDiscovery&amp;UX、Analysis&Design、Analysis&copy;、REQ-000001&REQ-000002は通常の説明であり、Pathではない。\n",
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) => finding.code === "ux-requirement-formal-input-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析は絶対PathのSource Analysis参照でDefinitionを補完できない", () => {
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
  const sourceAnalysisPath = path.join(
    root,
    "01_Discovery",
    "Analysis",
    "EXP-000001",
    "exploration.md",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    `# Analysis\n\n分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)\n\n補助入力: ${sourceAnalysisPath}\n`,
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-requirement-formal-input-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析は正しいHeaderに任意参照形式の別REQ Definitionを追加できない", () => {
  const variants = [
    "補助入力: [別要求](../../../01_Discovery/Definitions/REQ-000002/requirement.md)",
    "補助入力: [別要求]\n\n[別要求]: ../../../01_Discovery/Definitions/REQ-000002/requirement.md",
    "補助入力: [^別要求]\n\n[^別要求]: ../../../01_Discovery/Definitions/REQ-000002/requirement.md",
    '補助入力: <a href="../../../01_Discovery/Definitions/REQ-000002/requirement.md">別要求</a>',
    "補助入力: `../../../01_Discovery/Definitions/REQ-000002/requirement.md`",
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

test("CheckerはUX定義の意味重複を機械的な不正と断定しない", () => {
  const root = dispositionFixtureRoot();
  fs.mkdirSync(path.join(root, "02_UX", "Analysis"), { recursive: true });
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n| `UX-000002` B | `REQ-000001` |\n",
  );
  const sharedDefinitionBody =
    "\n## 利用者成果\n\n独立成果。\n\n## 利用者・状況・目的\n\n| 項目 | 内容 |\n|---|---|\n| 主な想定利用者／利用状況 | 利用者 |\n| 利用のきっかけ／場面 | 開始時 |\n| 目的 | 状態を理解する |\n| 得られる結果 | 次へ進める |\n\n## 成立条件\n\n- 成立する。\n\n## 重要な体験と品質期待\n\n```text\n開始 → 理解 → 次へ\n```\n\n## 検証意図\n\n反証する。\n\n## 関係\n\n- Source REQ Analysis: REQ-000001\n";
  for (const id of ["UX-000001", "UX-000002"])
    write(
      path.join(root, "02_UX", "Definitions", id, "ux_definition.md"),
      `# ${id}\n\n成果物種別: UX定義\nUX ID: \`${id}\`\n${sharedDefinitionBody}`,
    );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some(
      (finding) =>
        finding.code === "ux-definition-semantic-boilerplate-duplicate",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX定義はCanonicalまたはSuperseded以外の翻訳状態を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Definitions", "UX-000001", "ux_definition.md"),
    "# UX-000001\n\n成果物種別: UX定義\nUX ID: `UX-000001`\n状態: 現行正本\n\n## 利用者成果\n\n成果。\n\n## 成立条件\n\n- 成立する。\n\n## 検証意図\n\n反証する。\n\n## 関係\n\n- 元の要求分析: REQ-000001\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# UX分析\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX定義は状態Headerの重複を拒否する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Definitions", "UX-000001", "ux_definition.md"),
    "# UX-000001\n\n成果物種別: UX定義\nUX ID: `UX-000001`\n状態: Canonical\n状態: 現行正本\n\n## 利用者成果\n\n成果。\n\n## 成立条件\n\n- 成立する。\n\n## 検証意図\n\n反証する。\n\n## 関係\n\n- 元の要求分析: REQ-000001\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# UX分析\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("CheckerはDiscovery定義の意味重複を機械的な不正と断定しない", () => {
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
    !result.report.findings.some(
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
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 同じ成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 同じ成果 | `Same → UX-000001` | 同じ。 | 補完。 |\n",
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

test("UXのSame判断は4軸比較を揃えた構造を受け付ける", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 同じ成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n```text\nREQ-000001\n   └─ Same → UX-000001 同じ成果\n```\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 同じ成果 | `Same → UX-000001` | 4軸比較を参照。 | 要求固有の条件を補う。 |\n\n### Same判断の比較\n\n#### 同じ成果\n\n比較対象: `UX-000001`\n\n| 比較軸 | 既存UX | 現在の要求 | 差と統合判断 |\n|---|---|---|---|\n| 担い手 | 運用者 | 運用者 | 同じ担い手 |\n| 利用のきっかけ | 状態確認時 | 状態確認時 | 同じ場面 |\n| 得られる結果 | 判断できる | 判断できる | 同じ成果 |\n| 避ける失敗 | 誤認する | 誤認する | 同じ失敗 |\n\n統合理由: 4軸に独立した差がない。\n",
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

test("UX統合図と正式関係表のNewとSameは完全一致する", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n## 4. 利用者成果への統合\n\n```text\nREQ-000001\n   ├─ Same → UX-000001 同じ成果\n   └─ New  → UX-000002 残存した成果\n```\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 同じ成果 | `Same → UX-000001` | 4軸比較を参照。 | 条件を補う。 |\n\n#### 同じ成果\n\n比較対象: `UX-000001`\n\n| 比較軸 | 既存UX | 現在の要求 | 差と統合判断 |\n|---|---|---|---|\n| 担い手 | 運用者 | 運用者 | 同じ |\n| 利用のきっかけ | 開始時 | 開始時 | 同じ |\n| 得られる結果 | 判断できる | 判断できる | 同じ |\n| 避ける失敗 | 誤認 | 誤認 | 同じ |\n\n統合理由: 同じ成果である。\n",
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

test("UX分析の責任境界表は正式な三列見出しを一件だけ持つ", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n### この要求での責任境界\n\n| 担い手 | 運用者 | 越えてはならない境界 |\n|---|---|---|\n| 運用者 | 判断する | 推測しない |\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
          "ux-requirement-analysis-responsibility-header-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX分析は責任境界節または責任表を重複できない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | A | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n### この要求での責任境界\n\n| 担い手 | この要求で担うこと | 越えてはならない境界 |\n|---|---|---|\n| 運用者 | 判断する | 推測しない |\n\n| Actor | Responsibility | Boundary |\n|---|---|---|\n| System | 提供する | 越えない |\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
          "ux-requirement-analysis-responsibility-header-invalid" &&
        finding.path === "02_UX/Analysis/REQ-000001/ux_analysis.md",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX統合の理由付きNot ApplicableをRelation不正にしない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| UX成果なし | `Not Applicable` | 利用者のGoalまたはOutcomeを変更せず、既存体験の成立条件にも追加差分がない。 | Canonical UX成果へ追加する内容はない。 |\n\n### サービス提供の流れの処置\n\n処置: `非該当`\n\n複数主体間のHandoffは体験成立条件ではないため作成せず、条件が変わった時に再評価する。\n\n### 製品全体の整理への接続\n",
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

test("サービス提供の流れの作成と非該当を処置なしで済ませない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 成果 | `New → UX-000001` | 利用者成果を独立して変更し確認する必要がある。 | 要求固有の条件を補う。 |\n\n### サービス提供の流れの処置\n\n共同サービス提供の流れを参照する。\n\n### 製品全体の整理への接続\n",
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

test("作成するサービス提供の流れは主体・時間関係・完了情報・失敗時の判断を閉じる", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 成果 | `New → UX-000001` | 利用者成果を独立して変更し確認する必要がある。 | 要求固有の条件を補う。 |\n\n### サービス提供の流れの処置\n\n処置: `作成`\n\n```text\n利用者 [接点] 結果\n  └─ 失敗時: 担当者へ戻す\n```\n\n### 製品全体の整理への接続\n",
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

test("作成するサービス提供の流れは完了時に返る情報を省略できない", () => {
  const root = dispositionFixtureRoot();
  write(
    path.join(root, "01_Discovery", "01_Product_Discovery.md"),
    "# Discovery\n\n| 要求 | 要約 | 探索元 | Discovery判断 | 主な関係領域 |\n|---|---|---|---|---|\n| `REQ-000001` | Checker | EXP | 要求採用 | UX |\n",
  );
  write(
    path.join(root, "02_UX", "01_User_Experience.md"),
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 成果 | `New → UX-000001` | 利用者成果を独立して変更し確認する必要がある。 | 要求固有の条件を補う。 |\n\n### サービス提供の流れの処置\n\n処置: `作成`\n\n```text\n【利用者・責任者】利用者\n  ▼\n【利用者接点】入力\n  ├─ 時間差: 同期確認\n  └─ 失敗時: 判断不能範囲を返す\n       ▼\n【回復・判断する人】判断者\n  └─ 次の行動: 入力を直す\n--- 可視境界 ---\n【提供側】提供システム\n```\n\n### 製品全体の整理への接続\n",
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
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000002` 台帳だけの成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 分析だけの成果 | `New → UX-000001` | 利用者の成果と失敗条件が独立しているため新規成果として確定する。 | 要求固有の条件を補う。 |\n",
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
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n[REQ-000002](Analysis/REQ-000002/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n| `UX-000002` B | `REQ-000002` |\n",
  );
  for (const [req, ux] of [
    ["REQ-000001", "UX-000002"],
    ["REQ-000002", "UX-000001"],
  ])
    write(
      path.join(root, "02_UX", "Analysis", req, "ux_analysis.md"),
      `# Analysis\n\n要求: \`${req}\`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| 得られる結果 | \`New → ${ux}\` | 独立して変更し確認する利用者成果として扱う。 | この要求の利用場面を補う。 |\n`,
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
    "# UX\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n| `UX-000001` B | `REQ-000002` |\n",
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
    "# UX\n\n[REQ-000001](Analysis/REQ-000001/ux_analysis.md)\n\n| 利用者成果 | Discovery要求候補 |\n|---|---|\n| `UX-000001` A | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "03_Experience_Map.md"),
    "# Map\n\n| Journey | 主な想定利用者 | 起点 | 望むOutcome | 関係する主なREQ |\n|---|---|---|---|---|\n| Projectの現在地を判断する | PM | 起点 | 成果 | `REQ-000001` |\n",
  );
  write(
    path.join(root, "02_UX", "Analysis", "REQ-000001", "ux_analysis.md"),
    "# Analysis\n\n要求: `REQ-000001`\n\n## 4. 利用者成果への統合\n\n| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |\n|---|---|---|---|\n| A | `New → UX-000001` | 独立して確認する利用者成果として扱う。 | この要求の利用場面を補う。 |\n\n- 利用の流れの統合先: [Runtimeを導入する](../../03_Experience_Map.md#runtimeを導入する)\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ux-journey-relation-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UI分析は全UX定義と全IA定義の構造・入力・関係を別々に閉じる", () => {
  const root = uiReconstructionFixtureRoot();
  const valid = runChecker(root);
  assert.ok(
    !valid.report.findings.some((finding) => finding.code.startsWith("ui-")),
    `${valid.stdout}\n${valid.stderr}`,
  );

  fs.rmSync(path.join(root, "04_UI", "Analysis", "UX-000001"), {
    recursive: true,
    force: true,
  });
  const missing = runChecker(root);
  assert.ok(
    missing.report.findings.some(
      (finding) => finding.code === "ui-ux-analysis-coverage-mismatch",
    ),
    `${missing.stdout}\n${missing.stderr}`,
  );
});

test("UI分析・定義とひな型は成果物別の可視Checklistを必要とする", () => {
  const root = uiReconstructionFixtureRoot();
  for (const [relativePath, expectedCode] of [
    [
      "04_UI/Analysis/UX-000001/ui_analysis.md",
      "ui-analysis-checklist-invalid",
    ],
    [
      "04_UI/Definitions/UI-000001/ui_definition.md",
      "ui-definition-checklist-invalid",
    ],
    [
      "template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md",
      "ui-template-checklist-invalid",
    ],
  ] as const) {
    const file = path.join(root, relativePath);
    write(
      file,
      fs.readFileSync(file, "utf8").replace("## Checklist", "## 確認メモ"),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === expectedCode && finding.path === relativePath,
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UIからSPECへの引き渡しは可視Checklistを必要とする", () => {
  const root = uiReconstructionFixtureRoot();
  const relativePath = "04_UI/05_UI_SPEC_Handoff.md";
  const file = path.join(root, relativePath);
  write(
    file,
    fs.readFileSync(file, "utf8").replace("## Checklist", "## 確認メモ"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "ui-spec-handoff-checklist-invalid" &&
        finding.path === relativePath,
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UX観点のUI分析はIAまたはREQを正式入力へ追加できない", () => {
  const root = uiReconstructionFixtureRoot();
  const analysisPath = path.join(
    root,
    "04_UI",
    "Analysis",
    "UX-000001",
    "ui_analysis.md",
  );
  write(
    analysisPath,
    fs
      .readFileSync(analysisPath, "utf8")
      .replace("- UX定義:", "- 要求: REQ-000001\n- UX定義:"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-ux-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA観点のUI分析はUXまたはREQを正式入力へ追加できない", () => {
  const root = uiReconstructionFixtureRoot();
  const analysisPath = path.join(
    root,
    "04_UI",
    "Analysis",
    "IA-000001",
    "ui_analysis.md",
  );
  write(
    analysisPath,
    fs
      .readFileSync(analysisPath, "utf8")
      .replace(
        "- IA定義:",
        "- 要求: REQ-000001\n- UX定義: UX-000001\n- IA定義:",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-ia-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("IA観点のUI分析が欠けると全数再構築を満たさない", () => {
  const root = uiReconstructionFixtureRoot();
  fs.rmSync(path.join(root, "04_UI", "Analysis", "IA-000001"), {
    recursive: true,
    force: true,
  });
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-ia-analysis-coverage-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UI定義はUX観点とIA観点の両方を統合する", () => {
  const root = uiReconstructionFixtureRoot();
  const definitionPath = path.join(
    root,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    definitionPath,
    fs
      .readFileSync(definitionPath, "utf8")
      .replace("## IA観点の分析結果", "## IA入力（誤った見出し）"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UI台帳・分析・定義のUXとIA対応は完全一致する", () => {
  const root = uiReconstructionFixtureRoot();
  const definitionPath = path.join(
    root,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    definitionPath,
    fs.readFileSync(definitionPath, "utf8").replace("IA-000001", "IA-000002"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-analysis-definition-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("SPEC分析はUX観点とIA観点を分けて全入力を閉じる", () => {
  const root = specReconstructionFixtureRoot();
  const valid = runChecker(root);
  assert.ok(
    !valid.report.findings.some((finding) => finding.code.startsWith("spec-")),
    `${valid.stdout}\n${valid.stderr}`,
  );
  fs.rmSync(path.join(root, "05_SPEC", "Analysis", "UX-000001"), {
    recursive: true,
    force: true,
  });
  const missing = runChecker(root);
  assert.ok(
    missing.report.findings.some(
      (finding) => finding.code === "spec-ux-analysis-coverage-mismatch",
    ),
    `${missing.stdout}\n${missing.stderr}`,
  );
});

test("SPEC分析・定義とひな型は成果物別の可視Checklistを必要とする", () => {
  const root = specReconstructionFixtureRoot();
  for (const [relativePath, expectedCode] of [
    [
      "05_SPEC/Analysis/UX-000001/spec_analysis.md",
      "spec-analysis-checklist-invalid",
    ],
    [
      "05_SPEC/Definitions/SPEC-000001/spec_definition.md",
      "spec-definition-checklist-invalid",
    ],
    [
      "template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md",
      "spec-template-checklist-invalid",
    ],
  ] as const) {
    const file = path.join(root, relativePath);
    write(
      file,
      fs.readFileSync(file, "utf8").replace("## Checklist", "## 確認メモ"),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === expectedCode && finding.path === relativePath,
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UIとSPECの対応レビューは可視Checklistと全対応閉包を必要とする", () => {
  const checklistRoot = specReconstructionFixtureRoot();
  const relativePath = "05_SPEC/06_UI_SPEC_Correspondence.md";
  const checklistFile = path.join(checklistRoot, relativePath);
  write(
    checklistFile,
    fs
      .readFileSync(checklistFile, "utf8")
      .replace("## Checklist", "## 確認メモ"),
  );
  const checklistResult = runChecker(checklistRoot);
  assert.ok(
    checklistResult.report.findings.some(
      (finding) =>
        finding.code === "ui-spec-correspondence-checklist-invalid" &&
        finding.path === relativePath,
    ),
    `${checklistResult.stdout}\n${checklistResult.stderr}`,
  );

  const closureRoot = specReconstructionFixtureRoot();
  const closureFile = path.join(closureRoot, relativePath);
  write(
    closureFile,
    fs
      .readFileSync(closureFile, "utf8")
      .replace(
        /^\| \[UI-000001\]\(\.\.\/04_UI\/Definitions\/UI-000001\/ui_definition\.md\).*$/mu,
        "",
      ),
  );
  const closureResult = runChecker(closureRoot);
  assert.ok(
    closureResult.report.findings.some(
      (finding) => finding.code === "ui-spec-correspondence-closure-mismatch",
    ),
    `${closureResult.stdout}\n${closureResult.stderr}`,
  );

  const evidenceRoot = specReconstructionFixtureRoot();
  const evidenceFile = path.join(evidenceRoot, relativePath);
  write(
    evidenceFile,
    fs
      .readFileSync(evidenceFile, "utf8")
      .replace(
        "[UI](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差)",
        "UI根拠なし",
      ),
  );
  const evidenceResult = runChecker(evidenceRoot);
  assert.ok(
    evidenceResult.report.findings.some(
      (finding) => finding.code === "ui-spec-correspondence-evidence-invalid",
    ),
    `${evidenceResult.stdout}\n${evidenceResult.stderr}`,
  );
});

test("UI定義は正式入力と分析根拠を同じ集合で保持する", () => {
  const root = uiReconstructionFixtureRoot();
  const file = path.join(
    root,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "- 正式入力: [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md)",
        "",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("SPEC定義は正式入力・分析根拠・対応UI受入条件を同じ集合で保持する", () => {
  for (const mutation of [
    [
      "- 正式入力: [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md)",
      "",
    ],
    [
      "| 対応UI | [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)の操作と結果が一致する |",
      "| 対応UI | 記載なし |",
    ],
  ] as const) {
    const root = specReconstructionFixtureRoot();
    const file = path.join(
      root,
      "05_SPEC",
      "Definitions",
      "SPEC-000001",
      "spec_definition.md",
    );
    write(
      file,
      fs.readFileSync(file, "utf8").replace(mutation[0], mutation[1]),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "spec-definition-contract-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("SPEC RootのCoverage件数は現行集合と一致する", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(root, "05_SPEC", "01_Behavior_Specification.md");
  write(
    file,
    fs.readFileSync(file, "utf8").replace("| UX定義 | 1 |", "| UX定義 | 2 |"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-root-coverage-count-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UI／SPEC対応Evidenceは共有集合・両側Anchor・固定改訂版を必要とする", () => {
  const mutations = [
    ["UX-000001／IA-000001 | Shared", "UX-000001 | Shared"],
    ["UI／SPEC Definition集合 SHA-256:", "曖昧な対象改訂版:"],
    [
      "[SPEC](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果)",
      "SPEC根拠なし",
    ],
    [
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）「対象と条件を固定して検査結果を返す」／対応: 検査結果をUIの区別状態へ表示する",
      "UI-000001の表示状態をSPEC-000001の振る舞い状態へ対応付ける",
    ],
    [
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）",
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC補足（SPEC-000001）",
    ],
    [
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）",
      "UI事実（UI-000002）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）",
    ],
    [
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）「対象と条件を固定して検査結果を返す」／対応: 検査結果をUIの区別状態へ表示する",
      "UI事実（UI-000001）「試験用Interface」／SPEC事実（SPEC-000001）「試験用」／対応: 題名だけで一致を主張する",
    ],
    [
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）「対象と条件を固定して検査結果を返す」／対応: 検査結果をUIの区別状態へ表示する",
      "UI事実（UI-000001）「検査前と不備ありを区別する…」／SPEC事実（SPEC-000001）「対象と条件を固定して検査結果を返す」／対応: 省略した事実で一致を主張する",
    ],
  ] as const;
  for (const mutation of mutations) {
    const root = specReconstructionFixtureRoot();
    const file = path.join(root, "05_SPEC", "06_UI_SPEC_Correspondence.md");
    write(
      file,
      fs.readFileSync(file, "utf8").replace(mutation[0], mutation[1]),
    );
    const result = runChecker(root);
    const expectedCode = mutation[0].includes("SHA-256")
      ? "ui-spec-correspondence-revision-invalid"
      : "ui-spec-correspondence-evidence-invalid";
    assert.ok(
      result.report.findings.some((finding) => finding.code === expectedCode),
      `${result.stdout}\n${result.stderr}`,
    );
  }

  const staleRoot = specReconstructionFixtureRoot();
  const staleDefinition = path.join(
    staleRoot,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    staleDefinition,
    `${fs.readFileSync(staleDefinition, "utf8")}\n\n対象改訂後の未反映変更。\n`,
  );
  const staleResult = runChecker(staleRoot);
  assert.ok(
    staleResult.report.findings.some(
      (finding) => finding.code === "ui-spec-correspondence-revision-invalid",
    ),
    `${staleResult.stdout}\n${staleResult.stderr}`,
  );
});

test("UX観点のSPEC分析はIAまたはREQを正式入力へ追加できない", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "05_SPEC",
    "Analysis",
    "UX-000001",
    "spec_analysis.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "- UX定義:",
        "- 要求: REQ-000001\n- IA定義: IA-000001\n- UX定義:",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-ux-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("SPEC台帳・分析・定義の入力関係は完全一致する", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "05_SPEC",
    "Definitions",
    "SPEC-000001",
    "spec_definition.md",
  );
  write(
    file,
    fs.readFileSync(file, "utf8").replaceAll("IA-000001", "IA-000002"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-analysis-definition-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("UIとSPECのpairs_with関係は双方と台帳で完全一致する", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    file,
    fs.readFileSync(file, "utf8").replace("SPEC-000001", "SPEC-000002"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "ui-spec-pair-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture分析はUIとSPECを分けて全入力を閉じる", () => {
  const root = architectureReconstructionFixtureRoot();
  const valid = runChecker(root);
  assert.ok(
    !valid.report.findings.some((finding) =>
      finding.code.startsWith("architecture-"),
    ),
    `${valid.stdout}\n${valid.stderr}`,
  );
  fs.rmSync(path.join(root, "06_Architecture", "Analysis", "UI-000001"), {
    recursive: true,
    force: true,
  });
  const missing = runChecker(root);
  assert.ok(
    missing.report.findings.some(
      (finding) => finding.code === "architecture-analysis-missing",
    ),
    `${missing.stdout}\n${missing.stderr}`,
  );
});

test("Architecture横断モデルは責務・境界・流れ・故障・配置をQualityへ引き渡す", () => {
  let root = architectureReconstructionFixtureRoot();
  const valid = runChecker(root);
  assert.ok(
    !valid.report.findings.some((finding) =>
      finding.code.startsWith("architecture-cross-model-"),
    ),
    `${valid.stdout}\n${valid.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  fs.rmSync(
    path.join(
      root,
      "06_Architecture",
      "05_Failure_Recovery_and_Resilience_Model.md",
    ),
  );
  const missing = runChecker(root);
  assert.ok(
    missing.report.findings.some(
      (finding) => finding.code === "architecture-cross-model-missing",
    ),
    `${missing.stdout}\n${missing.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const indexPath = path.join(root, "06_Architecture", "01_Architecture.md");
  write(
    indexPath,
    fs
      .readFileSync(indexPath, "utf8")
      .replace(/\n## Architecture横断モデル[\s\S]*$/u, ""),
  );
  const missingSection = runChecker(root);
  assert.ok(
    missingSection.report.findings.some(
      (finding) => finding.code === "architecture-cross-model-section-missing",
    ),
    `${missingSection.stdout}\n${missingSection.stderr}`,
  );

  const componentMutations = [
    [
      "Definitions/ARCH-000001/architecture_definition.md",
      "Definitions/ARCH-999999/architecture_definition.md",
    ],
    ["Definitions/ARCH-000001/architecture_definition.md", ""],
    [
      "[定義名](Definitions/ARCH-000001/architecture_definition.md)",
      "[定義名](Definitions/ARCH-000001/architecture_definition.md)<br>[重複](Definitions/ARCH-000001/architecture_definition.md)",
    ],
    [
      "| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと | 主要Port |",
      "| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 主要Port |",
    ],
  ] as const;
  for (const [before, after] of componentMutations) {
    root = architectureReconstructionFixtureRoot();
    const componentPath = path.join(
      root,
      "06_Architecture",
      "02_Component_and_Responsibility_Model.md",
    );
    write(
      componentPath,
      fs.readFileSync(componentPath, "utf8").replace(before, after),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code ===
            "architecture-component-definition-coverage-mismatch" ||
          finding.code === "architecture-cross-model-contract-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }

  for (const [file, marker] of [
    [
      "02_Component_and_Responsibility_Model.md",
      "| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと | 主要Port |",
    ],
    [
      "03_Boundary_and_Interface_Model.md",
      "| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |",
    ],
    [
      "04_Runtime_and_Data_Flow_Model.md",
      "| 対象 | 必須の相関 | 禁止する畳み込み |",
    ],
    [
      "05_Failure_Recovery_and_Resilience_Model.md",
      "| 故障領域 | 対象Component | 守る対象 | 即時処置 | 回復／終了条件 |",
    ],
    [
      "06_Deployment_and_Execution_Model.md",
      "| 論理単位 | 主なResource | 並行性の境界 | 終了条件 |",
    ],
  ] as const) {
    root = architectureReconstructionFixtureRoot();
    const modelPath = path.join(root, "06_Architecture", file);
    const source = fs.readFileSync(modelPath, "utf8");
    write(modelPath, `${source.replace(marker, "")}\n## 別の節\n\n${marker}\n`);
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "architecture-cross-model-contract-invalid",
      ),
      `${file}\n${result.stdout}\n${result.stderr}`,
    );
  }

  root = architectureReconstructionFixtureRoot();
  const flowPath = path.join(
    root,
    "06_Architecture",
    "04_Runtime_and_Data_Flow_Model.md",
  );
  write(
    flowPath,
    "# Model\n\n## 2. 主要データフロー\n\n## 3. 横断状態遷移\n\n## 4. 概念Entity関係\n\n## 6. Qualityへの引渡し\n",
  );
  const empty = runChecker(root);
  assert.ok(
    empty.report.findings.some(
      (finding) => finding.code === "architecture-cross-model-contract-invalid",
    ),
    `${empty.stdout}\n${empty.stderr}`,
  );
});

test("Architecture詳細設計はARCH-IDとの多対多Relationと適用判断を閉じる", () => {
  let root = architectureReconstructionFixtureRoot();
  const valid = runChecker(root);
  assert.ok(
    !valid.report.findings.some((finding) =>
      finding.code.startsWith("architecture-detail-"),
    ),
    `${valid.stdout}\n${valid.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  fs.rmSync(
    path.join(
      root,
      "06_Architecture",
      "Details",
      "sample",
      "01_Architecture.md",
    ),
  );
  const missing = runChecker(root);
  assert.ok(
    missing.report.findings.some(
      (finding) => finding.code === "architecture-detail-document-missing",
    ),
    `${missing.stdout}\n${missing.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const detailPath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    detailPath,
    fs
      .readFileSync(detailPath, "utf8")
      .replace(
        "| Component Model | Required | 責務を分ける | [§1](#1-component-model) |",
        "| Component Model | Optional | | |",
      ),
  );
  const invalidApplicability = runChecker(root);
  assert.ok(
    invalidApplicability.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${invalidApplicability.stdout}\n${invalidApplicability.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const incompleteDetailPath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    incompleteDetailPath,
    fs
      .readFileSync(incompleteDetailPath, "utf8")
      .replace(
        "| Security Boundary | Required | Authorityを分ける | [§9](#9-security-boundary) |\n",
        "",
      ),
  );
  const incompleteApplicability = runChecker(root);
  assert.ok(
    incompleteApplicability.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${incompleteApplicability.stdout}\n${incompleteApplicability.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const weakQualityPath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    weakQualityPath,
    fs
      .readFileSync(weakQualityPath, "utf8")
      .replace(
        "| sample | Core | 根拠付き結果 | 欠測補完 | result | Effect 0 | なし |",
        "境界を検証する。",
      ),
  );
  const weakQuality = runChecker(root);
  assert.ok(
    weakQuality.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${weakQuality.stdout}\n${weakQuality.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const duplicatePath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    duplicatePath,
    fs
      .readFileSync(duplicatePath, "utf8")
      .replace(
        "| Interface Model | Required | 契約を分ける | [§2](#2-interface-model) |",
        "| Component Model | Required | 契約を分ける | [§2](#2-interface-model) |",
      ),
  );
  const duplicateApplicability = runChecker(root);
  assert.ok(
    duplicateApplicability.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${duplicateApplicability.stdout}\n${duplicateApplicability.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const reverseMapPath = path.join(
    root,
    "06_Architecture",
    "07_Detail_Architecture_Map.md",
  );
  write(
    reverseMapPath,
    fs
      .readFileSync(reverseMapPath, "utf8")
      .replace(
        "| ARCH-000001 | [試験責務](Definitions/ARCH-000001/architecture_definition.md) | sample |",
        "| ARCH-000001 | [試験責務](Definitions/ARCH-000001/architecture_definition.md) | other |",
      ),
  );
  const reverseMismatch = runChecker(root);
  assert.ok(
    reverseMismatch.report.findings.some(
      (finding) =>
        finding.code === "architecture-detail-relation-closure-mismatch",
    ),
    `${reverseMismatch.stdout}\n${reverseMismatch.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const readyRootPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  write(
    readyRootPath,
    fs
      .readFileSync(readyRootPath, "utf8")
      .replace("Status: Candidate", "Status: Architecture Ready"),
  );
  const readyDetailPath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    readyDetailPath,
    fs
      .readFileSync(readyDetailPath, "utf8")
      .replace(
        "| Resource Lifecycle | PASS | Run単位で回収する |",
        "| Resource Lifecycle | OPEN | 回収方式が未確定 |",
      ),
  );
  const readyWithOpen = runChecker(root);
  assert.ok(
    readyWithOpen.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${readyWithOpen.stdout}\n${readyWithOpen.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const readyWithoutCoveredRootPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  write(
    readyWithoutCoveredRootPath,
    fs
      .readFileSync(readyWithoutCoveredRootPath, "utf8")
      .replace("Status: Candidate", "Status: Architecture Ready"),
  );
  const partialOnlyDetailPath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    partialOnlyDetailPath,
    fs
      .readFileSync(partialOnlyDetailPath, "utf8")
      .replace("| Covered |", "| Partial |"),
  );
  const readyWithoutCoveredOwner = runChecker(root);
  assert.ok(
    readyWithoutCoveredOwner.report.findings.some(
      (finding) => finding.code === "architecture-detail-covered-owner-missing",
    ),
    `${readyWithoutCoveredOwner.stdout}\n${readyWithoutCoveredOwner.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const fakeAnchorPath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    fakeAnchorPath,
    fs
      .readFileSync(fakeAnchorPath, "utf8")
      .replace("[§1](#1-component-model)", "[§1](#missing-model)"),
  );
  const fakeAnchor = runChecker(root);
  assert.ok(
    fakeAnchor.report.findings.some(
      (finding) => finding.code === "broken-anchor",
    ),
    `${fakeAnchor.stdout}\n${fakeAnchor.stderr}`,
  );

  root = architectureReconstructionFixtureRoot();
  const mapPath = path.join(
    root,
    "06_Architecture",
    "07_Detail_Architecture_Map.md",
  );
  write(
    mapPath,
    fs
      .readFileSync(mapPath, "utf8")
      .replace(
        "| [sample](Details/sample/01_Architecture.md) | ARCH-000001 |",
        "| [sample](Details/sample/01_Architecture.md) | ARCH-999999 |",
      ),
  );
  const relationMismatch = runChecker(root);
  assert.ok(
    relationMismatch.report.findings.some(
      (finding) =>
        finding.code === "architecture-detail-relation-closure-mismatch",
    ),
    `${relationMismatch.stdout}\n${relationMismatch.stderr}`,
  );
});

test("Architecture成果物は責務別の可視Checklistを必要とする", () => {
  for (const relativePath of [
    "06_Architecture/Analysis/UI-000001/architecture_analysis.md",
    "06_Architecture/Analysis/SPEC-000001/architecture_analysis.md",
    "06_Architecture/Definitions/ARCH-000001/architecture_definition.md",
    "06_Architecture/Details/sample/01_Architecture.md",
  ]) {
    const root = architectureReconstructionFixtureRoot();
    const target = path.join(root, relativePath);
    write(
      target,
      fs
        .readFileSync(target, "utf8")
        .replace(/^## Checklist\s*$[\s\S]*$/mu, ""),
    );
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) =>
        finding.code.startsWith("architecture-"),
      ),
      `${relativePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("Architecture詳細設計は8種類のEngineering Concernを全数評価する", () => {
  const root = architectureReconstructionFixtureRoot();
  const target = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    target,
    fs
      .readFileSync(target, "utf8")
      .replace(/^\| Observability \|.*\r?\n/mu, ""),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture詳細設計のConcern根拠は実在節へ接続する", () => {
  const root = architectureReconstructionFixtureRoot();
  const target = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    target,
    fs
      .readFileSync(target, "utf8")
      .replace("[§2](#2-interface-model)", "後で追加する"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "architecture-detail-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture候補は理由付きOPEN／FAILを保持でき、Readyでは拒否する", () => {
  const cases = [
    [
      "06_Architecture/Analysis/UI-000001/architecture_analysis.md",
      "architecture-analysis-contract-invalid",
    ],
    [
      "06_Architecture/Analysis/SPEC-000001/architecture_analysis.md",
      "architecture-analysis-contract-invalid",
    ],
    [
      "06_Architecture/Definitions/ARCH-000001/architecture_definition.md",
      "architecture-definition-contract-invalid",
    ],
    [
      "06_Architecture/Details/sample/01_Architecture.md",
      "architecture-detail-contract-invalid",
    ],
  ] as const;
  for (const [relativePath, expectedCode] of cases) {
    for (const result of ["OPEN", "FAIL"] as const) {
      const root = architectureReconstructionFixtureRoot();
      const target = path.join(root, relativePath);
      const source = fs.readFileSync(target, "utf8");
      write(
        target,
        source.replace(
          /^- \[x\] (?<item>.+)$/mu,
          `- ${result}: 再レビュー待ち — $<item>`,
        ),
      );
      const candidate = runChecker(root);
      assert.ok(
        !candidate.report.findings.some(
          (finding) => finding.code === expectedCode,
        ),
        `${result} ${relativePath}\n${candidate.stdout}\n${candidate.stderr}`,
      );
      const indexPath = path.join(
        root,
        "06_Architecture",
        "01_Architecture.md",
      );
      write(
        indexPath,
        fs
          .readFileSync(indexPath, "utf8")
          .replace("Status: Candidate", "Status: Architecture Ready"),
      );
      const ready = runChecker(root);
      assert.ok(
        ready.report.findings.some((finding) => finding.code === expectedCode),
        `${result} ${relativePath}\n${ready.stdout}\n${ready.stderr}`,
      );
    }
  }
});

test("Architecture分析の9観点表は完全な3列・閉じた判定語彙・根拠を要求する", () => {
  const mutations = [
    (source: string) => source.replace(/^\| Responsibility \|.*\r?\n/mu, ""),
    (source: string) =>
      source.replace(
        "| Responsibility | 評価済み | 試験Coreが所有する |",
        "| Responsibility | 未判定 | 試験Coreが所有する |",
      ),
    (source: string) =>
      source.replace(
        "| Responsibility | 評価済み | 試験Coreが所有する |",
        "| Responsibility | 評価済み |  |",
      ),
    (source: string) =>
      source.replace(
        "| Responsibility | 評価済み | 試験Coreが所有する |",
        "| Responsibility | 評価済み | 試験Coreが所有する | 余分 |",
      ),
  ];
  for (const mutate of mutations) {
    const root = architectureReconstructionFixtureRoot();
    const target = path.join(
      root,
      "06_Architecture/Analysis/UI-000001/architecture_analysis.md",
    );
    write(target, mutate(fs.readFileSync(target, "utf8")));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) => finding.code === "architecture-analysis-contract-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("Architecture定義の未確認表は入力集合と完全一致する5列を要求する", () => {
  const mutations = [
    (source: string) =>
      source.replace(
        "| SPEC-000001 | なし | 不要 | 解消済み | 上流契約変更時 |\n",
        "",
      ),
    (source: string) =>
      source.replace(
        "| SPEC-000001 | なし | 不要 | 解消済み | 上流契約変更時 |",
        "| SPEC-999999 | なし | 不要 | 解消済み | 上流契約変更時 |",
      ),
    (source: string) =>
      source.replace(
        "| SPEC-000001 | なし | 不要 | 解消済み | 上流契約変更時 |",
        "| SPEC-000001 |  | 不要 | 解消済み | 上流契約変更時 |",
      ),
    (source: string) =>
      source.replace(
        "| SPEC-000001 | なし | 不要 | 解消済み | 上流契約変更時 |",
        "| SPEC-000001 | なし | 不要 | 解消済み | 上流契約変更時 | 余分 |",
      ),
  ];
  for (const mutate of mutations) {
    const root = architectureReconstructionFixtureRoot();
    const target = path.join(
      root,
      "06_Architecture/Definitions/ARCH-000001/architecture_definition.md",
    );
    write(target, mutate(fs.readFileSync(target, "utf8")));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === "architecture-definition-contract-invalid",
      ),
      `${result.stdout}\n${result.stderr}`,
    );
  }
});

test("Architecture詳細設計のConcern OPEN／FAILは候補で保持しReadyで拒否する", () => {
  for (const decision of ["OPEN", "FAIL"] as const) {
    const root = architectureReconstructionFixtureRoot();
    const target = path.join(
      root,
      "06_Architecture/Details/sample/01_Architecture.md",
    );
    write(
      target,
      fs
        .readFileSync(target, "utf8")
        .replace(
          "| Concurrency | N/A | 共有状態がない |",
          `| Concurrency | ${decision} | 理由付きで未解決 |`,
        ),
    );
    const candidate = runChecker(root);
    assert.ok(
      !candidate.report.findings.some(
        (finding) => finding.code === "architecture-detail-contract-invalid",
      ),
      `${decision}\n${candidate.stdout}\n${candidate.stderr}`,
    );
    const indexPath = path.join(root, "06_Architecture/01_Architecture.md");
    write(
      indexPath,
      fs
        .readFileSync(indexPath, "utf8")
        .replace("Status: Candidate", "Status: Architecture Ready"),
    );
    const ready = runChecker(root);
    assert.ok(
      ready.report.findings.some(
        (finding) => finding.code === "architecture-detail-contract-invalid",
      ),
      `${decision}\n${ready.stdout}\n${ready.stderr}`,
    );
  }
});

test("Architecture分析・定義・詳細設計の意味構造欠落を拒否する", () => {
  const mutations = [
    [
      "06_Architecture/Analysis/UI-000001/architecture_analysis.md",
      /^\| Human Input \|.*\r?\n/mu,
      "architecture-analysis-contract-invalid",
    ],
    [
      "06_Architecture/Definitions/ARCH-000001/architecture_definition.md",
      /^### 未確認事項・人間判断・戻り条件\s*$[\s\S]*?(?=^## 9\.)/mu,
      "architecture-definition-contract-invalid",
    ],
    [
      "06_Architecture/Details/sample/01_Architecture.md",
      /^- `PASS`:.*\r?\n/mu,
      "architecture-detail-contract-invalid",
    ],
  ] as const;
  for (const [relativePath, removal, expectedCode] of mutations) {
    const root = architectureReconstructionFixtureRoot();
    const target = path.join(root, relativePath);
    write(target, fs.readFileSync(target, "utf8").replace(removal, ""));
    const result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) => finding.code === expectedCode),
      `${relativePath}\n${result.stdout}\n${result.stderr}`,
    );
  }
});

test("UI観点のArchitecture分析はSPECや上流工程を正式入力にできない", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(
    root,
    "06_Architecture",
    "Analysis",
    "UI-000001",
    "architecture_analysis.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace("- UI定義:", "- SPEC: 05_SPEC\n- 要求: 01_Discovery\n- UI定義:"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "architecture-analysis-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture台帳・分析・定義の責務関係は完全一致する", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(
    root,
    "06_Architecture",
    "Definitions",
    "ARCH-000001",
    "architecture_definition.md",
  );
  write(
    file,
    fs.readFileSync(file, "utf8").replaceAll("SPEC-000001", "SPEC-000002"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "architecture-analysis-definition-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture台帳の入力関係も分析・定義と完全一致する", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(root, "06_Architecture", "01_Architecture.md");
  write(
    file,
    fs.readFileSync(file, "utf8").replace("SPEC-000001 |", "SPEC-000002 |"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "architecture-registry-relation-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture定義は責務・入力別契約・品質・移行の構造を自己完結して持つ", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(
    root,
    "06_Architecture",
    "Definitions",
    "ARCH-000001",
    "architecture_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "| 入力 | State Owner | Authority | Effect／非該当 |",
        "| 入力 | 状態 | 権限 | 作用 |",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "architecture-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture定義の説明用placeholderを完成契約として受理しない", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(
    root,
    "06_Architecture",
    "Definitions",
    "ARCH-000001",
    "architecture_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "利用者へ根拠付き状態を返し、表示と状態更新を分離する。\n\n| 観点 | 契約 |",
        "責務。\n\n| 観点 | 契約 |",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "architecture-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Architecture入力関係はCanonical入力節の外へ移しても成立しない", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(
    root,
    "06_Architecture",
    "Definitions",
    "ARCH-000001",
    "architecture_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "[UI-000001](../../Analysis/UI-000001/architecture_analysis.md)",
        "正式なUI入力は次の照合節に記録する。",
      )
      .replace(
        "正式入力は第2節と第3節の分析であり、現行実装は能力比較だけに使う。",
        "正式入力は第2節と第3節の分析である。参考: [UI-000001](../../Analysis/UI-000001/architecture_analysis.md)",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "architecture-definition-contract-invalid" ||
        finding.code === "architecture-analysis-definition-closure-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("同じ入力とArchitecture責務の重複関係を拒否する", () => {
  const root = architectureReconstructionFixtureRoot();
  const file = path.join(
    root,
    "06_Architecture",
    "Definitions",
    "ARCH-000001",
    "architecture_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "[UI-000001](../../Analysis/UI-000001/architecture_analysis.md)",
        "[UI-000001](../../Analysis/UI-000001/architecture_analysis.md)\n\n[UI-000001](../../Analysis/UI-000001/architecture_analysis.md)",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "architecture-relation-duplicate",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("Canonical定義に対応しない余分なArchitecture分析を拒否する", () => {
  const root = architectureReconstructionFixtureRoot();
  write(
    path.join(
      root,
      "06_Architecture",
      "Analysis",
      "UI-999999",
      "architecture_analysis.md",
    ),
    "# 余分な分析\n",
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "architecture-analysis-directory-coverage-mismatch",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("SPEC処置の重複関係を拒否する", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "05_SPEC",
    "Analysis",
    "UX-000001",
    "spec_analysis.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "| [SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md) | New | 独立契約 |",
        "| [SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md) | New | 独立契約 |\n| [SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md) | Same | 重複 |",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-analysis-relation-duplicate",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("対応UI節外のリンクをpairs_withとして数えない", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "05_SPEC",
    "Definitions",
    "SPEC-000001",
    "spec_definition.md",
  );
  write(
    file,
    fs.readFileSync(file, "utf8").replace("- pairs_with:", "- 参考UI:"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("直接UIなしは理由・運用Feedback・人間確認を必須にする", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "05_SPEC",
    "Definitions",
    "SPEC-000001",
    "spec_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace(
        "- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)",
        "- pairs_with: Not Applicable",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("理由付きの直接UIなし契約を受理する", () => {
  const root = specReconstructionFixtureRoot();
  const definition = path.join(
    root,
    "05_SPEC",
    "Definitions",
    "SPEC-000001",
    "spec_definition.md",
  );
  write(
    definition,
    fs
      .readFileSync(definition, "utf8")
      .replace(
        "- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)",
        "- pairs_with: Not Applicable\n- 理由: 背景処理である\n- 運用Feedback: 構造化結果で確認する\n- 人間確認: 試験責任者が確認済み",
      ),
  );
  const index = path.join(root, "05_SPEC", "01_Behavior_Specification.md");
  write(
    index,
    fs
      .readFileSync(index, "utf8")
      .replace("| UI-000001 |", "| Not Applicable |"),
  );
  const ui = path.join(
    root,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    ui,
    fs
      .readFileSync(ui, "utf8")
      .replace(
        "- pairs_with: [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)",
        "- 直接SPECなし: この試験では背景処理として扱う",
      ),
  );
  const result = runChecker(root);
  assert.ok(
    !result.report.findings.some((finding) => finding.code.startsWith("spec-")),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("直接UIありとなしの同時宣言を拒否する", () => {
  const root = specReconstructionFixtureRoot();
  const file = path.join(
    root,
    "05_SPEC",
    "Definitions",
    "SPEC-000001",
    "spec_definition.md",
  );
  write(
    file,
    fs
      .readFileSync(file, "utf8")
      .replace("- pairs_with:", "- pairs_with: Not Applicable、"),
  );
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-definition-contract-invalid",
    ),
    `${result.stdout}\n${result.stderr}`,
  );
});

test("SPEC工程直下の共通Evidence箱を拒否する", () => {
  const root = specReconstructionFixtureRoot();
  write(path.join(root, "05_SPEC", "Evidence", ".gitkeep"));
  const result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "spec-shared-evidence-root-forbidden",
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

const discoveryRootChecklistTestItems = [
  "すべての探索記録と採用要求を台帳から一意に辿れる。",
  "採用済みの判断、探索中の候補、保留、棄却および未確認事項を区別した。",
  "複数探索の関係、競合または合流候補を、個別記録の第二の正本を作らず示した。",
  "Version別の作業予定や未完了TaskをDiscoveryの判断として複製していない。",
  "基本図を現行図、既存参照、理由付き非該当または作成不能として処置した。",
  "UXその他へ渡す現在の判断、保持条件およびDiscoveryへ戻す条件が分かる。",
  "人間理解の確認が必要な探索について、理解確認と要求採用を区別した。",
  "補足情報や台帳が個別探索・要求定義の第二の正本になっていない。",
];

const discoveryExplorationChecklistTestItems = [
  "情報源と、情報源から確認できる範囲を示した。",
  "確認できた事実と、そこから導いた解釈・仮説を区別した。",
  "解決策ではなく、本質的な問題を説明した。",
  "技術名称を除いても、誰が何に困っているか理解できる。",
  "影響を受ける人または判断する人を特定した。",
  "どのような変化を期待するか説明した。",
  "原因と解決に関する仮説を、事実として扱っていない。",
  "未確認事項と不確実性を明示した。",
  "人間による確認または判断が必要かを評価した。",
  "情報不足をAIの推測だけで補っていない。",
  "失敗、リスク、制約および対象外を評価した。",
  "採用、不採用、保留を区別した。",
  "次工程が保持すべき問題、変化および条件を示した。",
  "情報不足時にDiscoveryへ戻す条件を示した。",
  "因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。",
  "補足分析へ必須情報を退避していない。",
];

const discoveryRequirementChecklistTestItems = [
  "要求だけを読んでも、必要な変化を理解できる。",
  "探索元と採用判断を一意に辿れる。",
  "対象、利用状況、問題および望ましい変化を説明した。",
  "特定の画面、実装または技術方式へ不要に固定していない。",
  "要求として採用した理由と主要な代替を示した。",
  "正常時の成立条件を判定可能な形で示した。",
  "不完全・異常・境界時にも守る条件を示した。",
  "成立主張を破る反証条件を示した。",
  "失敗、リスクおよび制約を評価した。",
  "対象外を明示した。",
  "未確認事項と人間確認の必要性を評価した。",
  "情報不足をAIの推測だけで補っていない。",
  "検証意図を、具体的な試験項目を先取りせず説明した。",
  "UXが探索記録を直接読まず、この定義だけから分析を開始できる。",
  "下流工程の結論をDiscoveryへ逆輸入していない。",
  "補足分析へ必須情報を退避していない。",
];

const uxIndexChecklistTestItems = [
  "誰の何をなぜ良くする製品かを冒頭から短時間で理解できる",
  "全REQに個別分析とUX処置があり全UX定義へ到達できる",
  "UX成果と入力REQの関係および網羅状況を説明できる",
  "個別分析と横断合成の詳細を複製せず関係と現在状態を示した",
  "想定利用者、利用の流れ、提供責務および品質期待の横断成果物へ到達できる",
  "未確認事項、戻り先および工程移行判断を区別した",
  "IAへの正式な引き渡しを明示した",
  "Quality Analysis / UXへの伴走入力を明示した",
  "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
  "基本図を作成、既存参照、非該当または作成不能として理由付きで処置した",
  "横断成果物が個別Definitionの第二の正本になっていない",
  "補足へ台帳、網羅状況または必須の引き渡しを退避していない",
];

const uxAnalysisChecklistTestItems = [
  "同じREQのDiscovery定義を正式入力として一意に特定した",
  "REQの問題、望ましい変化、制約および未確認事項を保持した",
  "REQにない意味をAIの推測だけで追加していない",
  "利用者、判断する人および関係する利用者を必要な範囲で特定した",
  "利用場面と前後の状況を特定した",
  "現在の体験、困りごとまたは回避方法を説明した",
  "目的を解決策の操作ではなく利用者の目的として表現した",
  "利用前後の仕事、理解、判断または行動の変化を説明した",
  "得られる結果を独立した利用者成果として定義した",
  "重要場面を評価した",
  "避ける失敗を評価した",
  "体験品質への期待を評価した",
  "人間による評価または確認が必要な事項を評価した",
  "IA、UI、SPECまたはArchitectureの結論を先取りしていない",
  "New、SameまたはNot Applicableを利用者成果の同一性から判断した",
  "統合判断の理由を追跡できる",
  "未確認事項と影響を明示した",
  "IAへの正式な引き渡しを明示した",
  "Quality Analysis / UXへの伴走入力を明示した",
  "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
  "DiscoveryまたはUXへ戻す条件を明示した",
  "補足分析へ必須情報を退避していない",
];

const uxDefinitionChecklistTestItems = [
  "UX IDと表題から独立した利用者成果を識別できる",
  "定義単独で利用者、利用場面および前後の状況を理解できる",
  "利用者の目的を理解できる",
  "得られる結果をUI操作ではなく独立した利用者成果として表現した",
  "利用前後の変化を必要な範囲で説明した",
  "成立条件を観察可能な意味で説明した",
  "重要場面を処置した",
  "重要な失敗を処置した",
  "体験品質への期待と必要性を処置した",
  "必要な情報をIAへ引き渡せる",
  "UXが所有する責任と下流へ残す判断を区別した",
  "制約と対象外を保持した",
  "未確認事項と影響を明示した",
  "人間による評価または確認の必要性を評価した",
  "検証意図を具体的なTest Caseへ先取りせず定義した",
  "IAへの正式な引き渡しを明示した",
  "Quality Analysis / UXへの伴走入力を明示した",
  "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
  "IAがUX Analysisを読み直さずDefinitionから開始できる",
  "下流成果物、Architectureまたは現行実装をUXへ逆輸入していない",
  "DiscoveryまたはUX分析へ戻す条件を明示した",
  "補足定義へ必須情報を退避していない",
];

function evaluatedChecklist(
  items: readonly string[],
  overrides: ReadonlyMap<number, readonly [string, string]> = new Map(),
): string {
  const lines = items.map((item, index) => {
    const override = overrides.get(index);
    return override
      ? `- ${override[0]}: ${override[1]} — ${item}`
      : `- [x] ${item}`;
  });
  return `## Checklist\n\n${lines.join("\n")}`;
}

function checklistItemsFromTemplate(relativePath: string): string[] {
  return fs
    .readFileSync(path.join(repositoryRoot, relativePath), "utf8")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const item = /^- \[ \] (?<text>\S.*)$/u.exec(line)?.groups?.text;
      return item ? [item] : [];
    });
}

function discoveryDefinition(
  requirementId: string,
  explorationId: string,
  marker: string,
): string {
  return `# ${requirementId} 要求\n\n成果物種別: Discovery定義\n要求ID: \`${requirementId}\`\n\n## 要求\n\n${marker}として利用者が望む結果を得られる要求である。\n\n## 対象と利用状況\n\n${marker}の対象者が、判断に必要な情報を確認する具体的な状況を扱う。\n\n## 解く問題と望ましい変化\n\n${marker}により現在の問題を識別し、再現可能な望ましい状態へ変える。\n\n## 採用理由と比較\n\n${marker}では代替案との違いと、採用した理由および残る弱点を比較する。\n\n## 成立条件\n\n- ${marker}の正常結果を確認できる\n- ${marker}の不完全状態を正常へ丸めない\n- ${marker}を破る反証を拒否できる\n\n## 制約\n\n- ${marker}の決定権限を下流へ移さない\n- ${marker}の対象外を完成扱いしない\n\n## 検証意図\n\n${marker}の正常、境界、失敗を実際の観測結果で区別できることを確認する。\n\n## 工程引渡し\n\n| 引渡し先 | 失ってはならない意味 | 下流で決めること |\n|---|---|---|\n| UX | ${marker}の利用者、状況、問題、変化 | 目的と得られる結果 |\n| IA以降 | ${marker}の状態と制約 | 工程固有設計 |\n\n## 関係\n\n- 元の探索記録: [${explorationId}](../../Analysis/${explorationId}/exploration.md)\n\n${evaluatedChecklist(discoveryRequirementChecklistTestItems)}\n`;
}

function iaAnalysis(uxId: string, iaId: string): string {
  return `# IA分析: 試験用\n\n成果物種別: IA分析\n分析対象: [${uxId}](../../../02_UX/Definitions/${uxId}/ux_definition.md)\n状態: 分析済み\n\n## 1. UXから受け取る意味\n\n| 観点 | この分析で受け取る内容 |\n|---|---|\n| 利用者 | 試験利用者 |\n| 場面 | 判断する時 |\n| 目的 | 対象を理解する |\n| 得たい結果 | 次の行動を選べる |\n| 重要場面 | 判断する直前 |\n| 避ける失敗 | 不明を正常と誤認する |\n| 守る品質 | 根拠を失わない |\n\n## 2. 情報候補と関係\n\n| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |\n|---|---|---|\n| 対象 | 判断対象 | 安定IDで識別する |\n| 根拠 | 判断を支える情報 | 対象と情報源へ結ぶ |\n\n\`\`\`text\n[O: 対象]\n   └─ 支えられる → [O: 根拠]\n\`\`\`\n\n図中の\`[O:]\`は情報Objectだけを表す。\n\n### Canonical化候補\n\n| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |\n|---|---|---|---|---|\n| ${iaId} | 対象 | 対象 | Same | 同じ意味を保持する |\n| ${iaId} | 根拠 | 根拠 | Same | 同じ意味を保持する |\n\n## 3. 状態・可視性・導線・責任\n\n| 観点 | 分析結果 |\n|---|---|\n| 状態 | 未確認と確認済みを分ける |\n| 可視性 | 判断時に示す |\n| 導線 | 対象から根拠へ進む |\n| 責任 | 試験情報管理者が対象と根拠の同一性を保つ |\n| 時間的な意味 | 現在と不明を分ける |\n| 情報の優先度 | 判断対象を先に示す |\n| 情報のまとまり | 対象と根拠をまとめる |\n| 判断権限 | 試験承認者が意味と状態を確定し、利用者が次の行動を選ぶ |\n| 重要な失敗 | 不明を正常と誤認する |\n| 制約・対象外 | UIと実装を決めない |\n| 人間判断 | UXから継承する判断だけを保持する |\n| IAへ戻す条件 | 情報契約が不足した時 |\n| 検証意図 | 対象と根拠を区別できること |\n\n### 未確認事項と判断\n\n| 区分 | 内容 |\n|---|---|\n| UXから継承する確認事項 | 利用者が理解できるか |\n| 判断者 | 代表利用者 |\n| 現在判定 | 後続確認が必要 |\n| 未確認時の影響 | 定量条件を確定しない |\n| IAで追加した未確認事項 | なし |\n| IA固有の追加人間判断 | なし |\n\n## 4. 現実照合の参考情報（正式入力ではない）\n\nこの節は後続のReality Auditへ引き継ぐ参考情報であり、IA Candidateを導く正式入力ではない。\n\nなし。\n\n## 5. IA処置\n\n[${iaId}](../../Definitions/${iaId}/ia_definition.md)へ接続する。\n\n## 6. 後続工程が保持する意味\n\n| 接続先 | 保持する意味 |\n|---|---|\n| UI（UX＋IAの正式入力） | 情報の優先度を保持する |\n| SPEC（UX＋IAの正式入力） | 識別と状態を保持する |\n| Quality Analysis / IA（伴走） | 成立条件を保持する |\n\nArchitectureやSourceへ直接引き渡さない。\n\n## 7. 補足分析\n\nなし。\n\n${evaluatedChecklist(checklistItemsFromTemplate("template/03_IA/Analysis/UX-XXXXXX/ia_analysis.md"))}\n`;
}

function iaDefinition(iaId: string, uxId: string): string {
  return `# ${iaId} 試験用情報\n\n成果物種別: IA定義\nIA ID: \`${iaId}\`\n\n## 意味と利用者成果\n\n利用者が情報を見分けられる。\n\n## 対象・識別・関係\n\n### 分析ObjectからCanonical Objectへの対応\n\n| Source Analysis Object | Canonical Object | 処置 | 判断理由 |\n|---|---|---|---|\n| ${uxId}: 対象 | 対象 | Same | 同じ意味を保持する |\n\n対象と関係を定義する。\n\n## 状態・可視性・時間的な意味\n\n状態と時間差を区別する。\n\n## 情報の優先度・まとまり・見つけ方・責任\n\n対象から根拠へ進める。\n\n### 責任と判断権限\n\n| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |\n|---|---|---|\n| ${uxId} | 試験情報管理者が対象と根拠を正確に保つ | 試験承認者が意味と状態を確定し、利用者が次の行動を決める |\n\n## 失敗・制約・未確認事項\n\n不明を正常へ丸めず、実装を先取りしない。\n\n## 検証意図\n\n| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |\n|---|---|---|---|\n| ${uxId} | 判断前 | 誤認 | 根拠を示す |\n\n### 人間判断・未確認事項・戻り条件\n\n| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |\n|---|---|---|---|---|\n| ${uxId} | 理解できるか | 代表利用者 | 後続確認が必要 | 定量条件を確定しない |\n\n## 後続工程との関係\n\n| 接続先 | 保持する意味 |\n|---|---|\n| UI（UX＋IAの正式入力） | 情報の優先度を保持する |\n| SPEC（UX＋IAの正式入力） | 識別と状態を保持する |\n| Quality Analysis / IA（伴走） | 成立条件を保持する |\n\n## 情報源\n\n- [${uxId}のIA分析](../../Analysis/${uxId}/ia_analysis.md)\n\n## 補足分析\n\nなし。\n\n${evaluatedChecklist(checklistItemsFromTemplate("template/03_IA/Definitions/IA-XXXXXX/ia_definition.md"))}\n`;
}

function iaCrossArtifact(title: string, checklistTemplatePath: string): string {
  return `# ${title}\n\n## 4. IA定義への適用\n\n| IA定義 | 処置 | 横断投影での扱い |\n|---|---|---|\n| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 試験用の横断投影へ接続 |\n\n${evaluatedChecklist(checklistItemsFromTemplate(checklistTemplatePath))}\n`;
}

function iaReconstructionFixtureRoot(): string {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "00_CRDD"), { recursive: true, force: true });
  write(path.join(root, "01_Principles.md"), "# Principles\n");
  write(
    path.join(root, "02_UX", "Definitions", "UX-000001", "ux_definition.md"),
    "# UX-000001 試験用利用者成果\n",
  );
  write(
    path.join(root, "03_IA", "01_Information_Architecture.md"),
    `# IA\n\n| IA | 利用者が見分ける情報 | 主な入力UX |\n|---|---|---|\n| [IA-000001](Definitions/IA-000001/ia_definition.md) | 試験用情報 | UX-000001 |\n\n${evaluatedChecklist(checklistItemsFromTemplate("template/03_IA/01_Information_Architecture.md"))}\n`,
  );
  write(
    path.join(root, "03_IA", "02_Object_and_Relation_Model.md"),
    iaCrossArtifact(
      "情報オブジェクトと関係",
      "template/03_IA/02_Object_and_Relation_Model.md",
    ),
  );
  write(
    path.join(root, "03_IA", "03_Information_Structure_and_Navigation.md"),
    iaCrossArtifact(
      "情報のまとまりと導線",
      "template/03_IA/03_Information_Structure_and_Navigation.md",
    ),
  );
  write(
    path.join(root, "03_IA", "04_State_Visibility_and_Responsibility.md"),
    iaCrossArtifact(
      "状態・可視性・責任",
      "template/03_IA/04_State_Visibility_and_Responsibility.md",
    ),
  );
  write(
    path.join(root, "03_IA", "Analysis", "UX-000001", "ia_analysis.md"),
    iaAnalysis("UX-000001", "IA-000001").replace(
      "### 未確認事項と判断",
      "ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。\n\n### 未確認事項と判断",
    ),
  );
  write(
    path.join(root, "03_IA", "Definitions", "IA-000001", "ia_definition.md"),
    iaDefinition("IA-000001", "UX-000001")
      .replace(
        "## 失敗・制約・未確認事項",
        "ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。\n\n## 失敗・制約・未確認事項",
      )
      .replace(
        "| UX-000001: 対象 | 対象 | Same | 同じ意味を保持する |",
        "| UX-000001: 対象 | 対象 | Same | 同じ意味を保持する |\n| UX-000001: 根拠 | 根拠 | Same | 判断を支える情報を保持する |",
      )
      .replace(
        "対象と関係を定義する。",
        "### Identity／Relationの変換\n\n| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |\n|---|---|---|---|---|\n| UX-000001: 対象 | 安定IDで識別する | 対象 | 安定IDで識別する | Same。識別条件を維持する |\n| UX-000001: 根拠 | 対象と情報源へ結ぶ | 根拠 | 対象と情報源へ結ぶ | Same。関係を維持する |\n\n| 対象 | 利用者にとっての意味 | 識別・関係 |\n|---|---|---|\n| 対象 | 判断する対象 | 安定IDで識別する |\n| 根拠 | 判断を支える情報 | 対象と情報源へ結ぶ |\n\n```text\n[O: 対象] --支えられる--> [O: 根拠]\n```",
      ),
  );
  for (const relativePath of [
    "template/03_IA/01_Information_Architecture.md",
    "template/03_IA/02_Object_and_Relation_Model.md",
    "template/03_IA/03_Information_Structure_and_Navigation.md",
    "template/03_IA/04_State_Visibility_and_Responsibility.md",
    "template/03_IA/Analysis/UX-XXXXXX/ia_analysis.md",
    "template/03_IA/Definitions/IA-XXXXXX/ia_definition.md",
  ])
    write(
      path.join(root, relativePath),
      fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
    );
  return root;
}

function completedChecklist(relativePath: string): string {
  const source = fs.readFileSync(
    path.join(repositoryRoot, relativePath),
    "utf8",
  );
  const checklist = source.match(/^## Checklist\s*$[\s\S]*$/mu)?.[0] ?? "";
  const lines = checklist
    .split(/\r?\n/u)
    .filter((line) => line === "## Checklist" || line.startsWith("- [ ] "))
    .map((line) => line.replace("- [ ] ", "- [x] "));
  return `${lines.join("\n")}\n`;
}

function uxViewUiAnalysis(uxId: string, uiId: string): string {
  return `# ${uxId}のUI分析\n\n成果物種別: UI分析（UX観点）\n分析単位: \`${uxId}\`\n状態: Candidate\n\n## 1. 正式入力\n\n- UX定義: [${uxId} 試験用](../../../02_UX/Definitions/${uxId}/ux_definition.md)\n\n## 2. UIへ引き継ぐ利用者成果\n\n利用者が対象を理解する。\n\n## 3. 必要な認識・操作・Feedback\n\n対象、操作、Feedbackを示す。\n\n## 4. 状況による体験差\n\nこのUXに必要な状況だけを区別する。\n\n## 5. UI処置\n\n- [${uiId} 試験用](../../Definitions/${uiId}/ui_definition.md) — \`New\`。独立した利用者成果として扱う。\n\n## 6. IA観点との統合時に確認すること\n\n情報構造と利用者成果が矛盾しないことを確認する。\n\n${completedChecklist("template/04_UI/Analysis/UX-XXXXXX/ui_analysis.md")}`;
}

function iaViewUiAnalysis(iaId: string, uiId: string): string {
  return `# ${iaId}のUI分析\n\n成果物種別: UI分析（IA観点）\n分析単位: \`${iaId}\`\n状態: Candidate\n\n## 1. 正式入力\n\n- IA定義: [${iaId} 試験用](../../../03_IA/Definitions/${iaId}/ia_definition.md)\n\n## 2. UIへ引き継ぐ情報構造\n\n対象、状態、関係を示す。\n\n## 3. 表示の優先順位とNavigation\n\n対象、状態、根拠の順に示す。\n\n## 4. 表示差と開示境界\n\n通常、停止、結果不明を区別する。\n\n## 5. UI処置\n\n- [${uiId} 試験用](../../Definitions/${uiId}/ui_definition.md) — \`New\`。独立した情報構造として扱う。\n\n## 6. UX観点との統合時に確認すること\n\n情報構造と利用者成果が矛盾しないことを確認する。\n\n${completedChecklist("template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md")}`;
}

function uiDefinition(uiId: string, uxId: string, iaId: string): string {
  return `# ${uiId} 試験用Interface\n\n成果物種別: UI定義\nUI ID: \`${uiId}\`\n状態: Candidate\n\n## 利用者成果\n\n対象を理解できる。\n\n## UX観点の分析結果\n\n| UX分析 | このUIで保持する利用者成果 |\n|---|---|\n| [${uxId}](../../Analysis/${uxId}/ui_analysis.md) | 対象を理解する |\n\n## IA観点の分析結果\n\n| IA分析 | このUIで保持する情報構造 |\n|---|---|\n| [${iaId}](../../Analysis/${iaId}/ui_analysis.md) | 対象と状態を見分ける |\n\n## 両観点の統合判断\n\n利用者成果を情報構造によって判断可能にする。\n\n## 表示面と情報の優先順位\n\n対象、状態、根拠、行動の順に示す。\n\n## 操作とFeedback\n\n主要操作と結果を示す。\n\n## 状態と表示差\n\n通常と停止を区別する。\n\n## 視覚表現とアクセシビリティ\n\n色以外でも区別する。\n\n## 制約\n\n正本を複製しない。\n\n## UI／SPEC対応レビューへ渡す項目\n\n同じUXとIAについて、UIの観測点とSPEC側の未確定事項を渡す。\n\n## 正式入力と変換根拠\n\n- 正式入力: [${uxId}](../../../02_UX/Definitions/${uxId}/ux_definition.md)\n- 正式入力: [${iaId}](../../../03_IA/Definitions/${iaId}/ia_definition.md)\n\n以下は正式入力をUIの責務へ変換した根拠であり、正式入力そのものではない。\n\n- [${uxId}のUI分析](../../Analysis/${uxId}/ui_analysis.md)\n- [${iaId}のUI分析](../../Analysis/${iaId}/ui_analysis.md)\n\n${completedChecklist("template/04_UI/Definitions/UI-XXXXXX/ui_definition.md")}`;
}

function uiReconstructionFixtureRoot(): string {
  const root = iaReconstructionFixtureRoot();
  write(
    path.join(root, "04_UI", "01_User_Interface.md"),
    "# UI\n\n| UI | 利用者が使うInterface契約 | 主な入力UX | 主な入力IA |\n|---|---|---|---|\n| [UI-000001](Definitions/UI-000001/ui_definition.md) | 試験用 | UX-000001 | IA-000001 |\n",
  );
  write(
    path.join(root, "04_UI", "Analysis", "UX-000001", "ui_analysis.md"),
    uxViewUiAnalysis("UX-000001", "UI-000001"),
  );
  write(
    path.join(root, "04_UI", "Analysis", "IA-000001", "ui_analysis.md"),
    iaViewUiAnalysis("IA-000001", "UI-000001"),
  );
  write(
    path.join(root, "04_UI", "Definitions", "UI-000001", "ui_definition.md"),
    uiDefinition("UI-000001", "UX-000001", "IA-000001"),
  );
  write(
    path.join(root, "04_UI", "05_UI_SPEC_Handoff.md"),
    `# UIとSPECの引き渡し\n\nUI側の責任境界を示す。\n\n${completedChecklist("template/04_UI/05_UI_SPEC_Handoff.md")}`,
  );
  write(
    path.join(
      root,
      "template",
      "04_UI",
      "Analysis",
      "IA-XXXXXX",
      "ui_analysis.md",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md",
      ),
      "utf8",
    ),
  );
  write(
    path.join(
      root,
      "template",
      "04_UI",
      "Analysis",
      "UX-XXXXXX",
      "ui_analysis.md",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/04_UI/Analysis/UX-XXXXXX/ui_analysis.md",
      ),
      "utf8",
    ),
  );
  write(
    path.join(
      root,
      "template",
      "04_UI",
      "Definitions",
      "UI-XXXXXX",
      "ui_definition.md",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/04_UI/Definitions/UI-XXXXXX/ui_definition.md",
      ),
      "utf8",
    ),
  );
  for (const relativePath of [
    "template/04_UI/01_User_Interface.md",
    "template/04_UI/02_Surface_and_Region_Model.md",
    "template/04_UI/03_Interaction_and_State_Model.md",
    "template/04_UI/04_Visual_and_Accessibility_Direction.md",
    "template/04_UI/05_UI_SPEC_Handoff.md",
  ])
    write(
      path.join(root, relativePath),
      fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
    );
  return root;
}

function specReconstructionFixtureRoot(): string {
  const root = uiReconstructionFixtureRoot();
  const uxAnalysis = `# UX-000001のSPEC分析\n\n成果物種別: SPEC分析（UX観点）\n分析単位: \`UX-000001\`\n\n## 1. 正式入力\n\n- UX定義: [UX-000001 試験用](../../../02_UX/Definitions/UX-000001/ux_definition.md)\n\n## 2. 振る舞いへ引き継ぐ利用者成果\n\n成果を示す。\n\n## 3. 観測可能にする契機・結果・失敗\n\n結果を示す。\n\n## 4. 受入条件と適用範囲\n\n適用範囲を示す。\n\n## 5. SPEC処置\n\n| SPEC候補 | 処置 | 判断理由 |\n|---|---|---|\n| [SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md) | New | 独立契約 |\n\n## 6. IA観点との統合時に確認すること\n\n情報構造と統合する。\n\n\n${completedChecklist("template/05_SPEC/Analysis/UX-XXXXXX/spec_analysis.md")}`;
  const iaAnalysis = `# IA-000001のSPEC分析\n\n成果物種別: SPEC分析（IA観点）\n分析単位: \`IA-000001\`\n\n## 1. 正式入力\n\n- IA定義: [IA-000001 試験用](../../../03_IA/Definitions/IA-000001/ia_definition.md)\n\n## 2. 利用場面ごとに保持する意味\n\n利用場面を示す。\n\n## 3. 対象・識別・関係\n\n情報を示す。\n\n## 4. 状態・可視性・時間的意味\n\n状態を示す。\n\n## 5. 導線・責任・失敗時の保持\n\n保持を示す。\n\n## 6. SPEC処置\n\n| SPEC候補 | 処置 | 判断理由 |\n|---|---|---|\n| [SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md) | New | 独立契約 |\n\n## 7. UX観点との統合時に確認すること\n\n利用者成果と統合する。\n\n\n${completedChecklist("template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md")}`;
  const definition = `# SPEC-000001 試験用\n\n成果物種別: SPEC定義\nSPEC ID: \`SPEC-000001\`\n\n## 振る舞いの目的\n\n目的。\n\n## UX観点の分析結果\n\n[UX-000001](../../Analysis/UX-000001/spec_analysis.md)\n\n## IA観点の分析結果\n\n[IA-000001](../../Analysis/IA-000001/spec_analysis.md)\n\n## 両観点の統合判断\n\n統合する。\n\n## 契機・事前条件・Authority\n\n条件。\n\n## 振る舞い・状態・結果\n\n結果。\n\n## 失敗・回復・副作用\n\n失敗。\n\n## 受入条件と検証義務\n\n| 観点 | 受入条件 |\n|---|---|\n| 対応UI | [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)の操作と結果が一致する |\n\n## 対応するUI\n\n- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)\n\n## 制約\n\n制約。\n\n## 正式入力と変換根拠\n\n- 正式入力: [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md)\n- 正式入力: [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md)\n\n以下は正式入力をSPECの責務へ変換した根拠であり、正式入力そのものではない。\n\n- [UX-000001のSPEC分析](../../Analysis/UX-000001/spec_analysis.md)\n- [IA-000001のSPEC分析](../../Analysis/IA-000001/spec_analysis.md)\n\n${completedChecklist("template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md")}`;
  write(
    path.join(root, "05_SPEC", "01_Behavior_Specification.md"),
    "# SPEC\n\n| 入力／成果 | 件数 | 現在の処置 |\n|---|---:|---|\n| UX定義 | 1 | 全件分析 |\n| IA定義 | 1 | 全件分析 |\n| SPEC分析 | 2 | 観点別 |\n| SPEC定義 | 1 | 統合 |\n| UI定義 | 1 | 対応 |\n\n| SPEC | 観測可能な振る舞い契約 | 主な入力UX | 主な入力IA | 対応UI |\n|---|---|---|---|---|\n| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | 試験用 | UX-000001 | IA-000001 | UI-000001 |\n",
  );
  write(
    path.join(root, "05_SPEC", "Analysis", "UX-000001", "spec_analysis.md"),
    uxAnalysis,
  );
  write(
    path.join(root, "05_SPEC", "Analysis", "IA-000001", "spec_analysis.md"),
    iaAnalysis,
  );
  write(
    path.join(
      root,
      "05_SPEC",
      "Definitions",
      "SPEC-000001",
      "spec_definition.md",
    ),
    definition,
  );
  write(
    path.join(root, "05_SPEC", "06_UI_SPEC_Correspondence.md"),
    `# UI／SPEC対応\n\n## 1. レビュー対象\n\n| 項目 | 対象 |\n|---|---|\n| 対象改訂版 | UI／SPEC Definition集合 SHA-256: \`__FINGERPRINT__\` |\n\n| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |\n|---|---|---|---|---|---|---|---|\n| [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | UX-000001／IA-000001 | Shared | 8観点の組別Evidenceを確認 | 作成者確認済み | Gapなし | [組別Evidence](#ui-000001spec-000001) |\n\n### UI-000001／SPEC-000001\n\n| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |\n|---|---|---|---|---|\n| State | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差) | [SPEC](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果) | 一致 | UI-000001の表示状態をSPEC-000001の振る舞い状態へ対応付ける |\n| Trigger | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC](Definitions/SPEC-000001/spec_definition.md#契機事前条件authority) | 一致 | UI-000001の操作をSPEC-000001の契機と事前条件へ対応付ける |\n| Result | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC](Definitions/SPEC-000001/spec_definition.md#振る舞い状態結果) | 一致 | SPEC-000001の結果をUI-000001のFeedbackとして示す |\n| Failure | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#操作とfeedback) | [SPEC](Definitions/SPEC-000001/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000001の失敗をUI-000001で成功へ丸めない |\n| Recovery | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#状態と表示差) | [SPEC](Definitions/SPEC-000001/spec_definition.md#失敗回復副作用) | 一致 | SPEC-000001の戻り先をUI-000001の次の行動へ対応付ける |\n| Authority | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#制約) | [SPEC](Definitions/SPEC-000001/spec_definition.md#契機事前条件authority) | 一致 | UI-000001の操作をSPEC-000001のAuthority内に限定する |\n| Visibility | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#表示面と情報の優先順位) | [SPEC](Definitions/SPEC-000001/spec_definition.md#受入条件と検証義務) | 一致 | SPEC-000001の不足をUI-000001が隠さず示す |\n| Constraint | [UI](../04_UI/Definitions/UI-000001/ui_definition.md#制約) | [SPEC](Definitions/SPEC-000001/spec_definition.md#制約) | 一致 | UI-000001とSPEC-000001で上流制約を弱めない |\n\n${completedChecklist("template/05_SPEC/06_UI_SPEC_Correspondence.md")}`,
  );
  const correspondenceFixture = path.join(
    root,
    "05_SPEC",
    "06_UI_SPEC_Correspondence.md",
  );
  let concreteCorrespondence = fs.readFileSync(correspondenceFixture, "utf8");
  for (const [genericReason, concreteReason] of [
    [
      "UI-000001の表示状態をSPEC-000001の振る舞い状態へ対応付ける",
      "UI事実（UI-000001）「検査前と不備ありを区別する」／SPEC事実（SPEC-000001）「対象と条件を固定して検査結果を返す」／対応: 検査結果をUIの区別状態へ表示する",
    ],
    [
      "UI-000001の操作をSPEC-000001の契機と事前条件へ対応付ける",
      "UI事実（UI-000001）「検査を実行する」／SPEC事実（SPEC-000001）「対象と条件が揃った時に検査する」／対応: 事前条件成立後だけUI操作を発火する",
    ],
    [
      "SPEC-000001の結果をUI-000001のFeedbackとして示す",
      "UI事実（UI-000001）「同じ入力へ同じ指摘を返す」／SPEC事実（SPEC-000001）「同一入力で同じ検査結果を返す」／対応: SPEC結果を判断可能なFeedbackとして示す",
    ],
    [
      "SPEC-000001の失敗をUI-000001で成功へ丸めない",
      "UI事実（UI-000001）「検査不能を正常と表示しない」／SPEC事実（SPEC-000001）「入力不備や検査不能を成功へ畳まない」／対応: 失敗を成功へ丸めず示す",
    ],
    [
      "SPEC-000001の戻り先をUI-000001の次の行動へ対応付ける",
      "UI事実（UI-000001）「指摘から所有成果物へ戻れる」／SPEC事実（SPEC-000001）「失敗理由と安全な戻り先を返す」／対応: 戻り先をUIの次の行動へ接続する",
    ],
    [
      "UI-000001の操作をSPEC-000001のAuthority内に限定する",
      "UI事実（UI-000001）「UIに修正採用権限を持たせない」／SPEC事実（SPEC-000001）「検査実行者へ意味判断の権限を発行しない」／対応: 操作をSPECのAuthority内に限定する",
    ],
    [
      "SPEC-000001の不足をUI-000001が隠さず示す",
      "UI事実（UI-000001）「検査対象と指摘理由を表示する」／SPEC事実（SPEC-000001）「不明を正常や完了へ丸めない」／対応: 不足をUIで隠さず示す",
    ],
    [
      "UI-000001とSPEC-000001で上流制約を弱めない",
      "UI事実（UI-000001）「表示都合で状態や根拠を弱めない」／SPEC事実（SPEC-000001）「APIや実装技術を確定しない」／対応: 両契約を保持し実装方式を拡張しない",
    ],
  ] as const)
    concreteCorrespondence = concreteCorrespondence.replace(
      genericReason,
      concreteReason,
    );
  write(correspondenceFixture, concreteCorrespondence);
  const uiFile = path.join(
    root,
    "04_UI",
    "Definitions",
    "UI-000001",
    "ui_definition.md",
  );
  write(
    uiFile,
    fs
      .readFileSync(uiFile, "utf8")
      .replace(
        "## 正式入力と変換根拠",
        "## 対応するSPEC\n\n- pairs_with: [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)\n\n## 正式入力と変換根拠",
      ),
  );
  const fingerprintInputs = [
    ["04_UI/Definitions/UI-000001/ui_definition.md", uiFile],
    [
      "05_SPEC/Definitions/SPEC-000001/spec_definition.md",
      path.join(
        root,
        "05_SPEC",
        "Definitions",
        "SPEC-000001",
        "spec_definition.md",
      ),
    ],
  ].map(
    ([relativePath, absolutePath]) =>
      `${relativePath}\n${fs.readFileSync(absolutePath, "utf8")}`,
  );
  const fixtureFingerprint = createHash("sha256")
    .update(fingerprintInputs.join("\n\u0000\n"), "utf8")
    .digest("hex");
  const correspondenceFile = path.join(
    root,
    "05_SPEC",
    "06_UI_SPEC_Correspondence.md",
  );
  write(
    correspondenceFile,
    fs
      .readFileSync(correspondenceFile, "utf8")
      .replace("__FINGERPRINT__", fixtureFingerprint),
  );
  write(
    path.join(
      root,
      "template",
      "05_SPEC",
      "Analysis",
      "UX-XXXXXX",
      "spec_analysis.md",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/05_SPEC/Analysis/UX-XXXXXX/spec_analysis.md",
      ),
      "utf8",
    ),
  );
  write(
    path.join(
      root,
      "template",
      "05_SPEC",
      "Analysis",
      "IA-XXXXXX",
      "spec_analysis.md",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md",
      ),
      "utf8",
    ),
  );
  write(
    path.join(
      root,
      "template",
      "05_SPEC",
      "Definitions",
      "SPEC-XXXXXX",
      "spec_definition.md",
    ),
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md",
      ),
      "utf8",
    ),
  );
  for (const relativePath of [
    "template/05_SPEC/01_Behavior_Specification.md",
    "template/05_SPEC/02_Use_Case_and_Behavior_Flow.md",
    "template/05_SPEC/03_State_Transition_Model.md",
    "template/05_SPEC/04_Actor_System_Sequence.md",
    "template/05_SPEC/05_Error_Effect_and_Recovery.md",
    "template/05_SPEC/06_UI_SPEC_Correspondence.md",
  ])
    write(
      path.join(root, relativePath),
      fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
    );
  return root;
}

function architectureReconstructionFixtureRoot(): string {
  const root = specReconstructionFixtureRoot();
  const architectureLensEvaluation = `### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み | 試験Coreが所有する |
| Boundary／Component／Interface | 評価済み | 利用側と状態Sourceを分ける |
| Data／State Ownership | 評価済み | 試験Coreが状態を所有する |
| Failure／Recovery | 評価済み | 欠測を補完せず安全に返す |
| Security／Trust | 評価済み | 閲覧Authorityだけを受け付ける |
| Quality Constraint | 評価済み | 不完全性を保持する |
| Human Input | なし | Architecture固有の人間判断はない |
| Open／Gap | なし | 上流へ戻す未解決事項はない |
| Verification Intent | 評価済み | 状態差とEffect 0を反証する |

Human Inputの判断者は不要である。再評価契機は上流契約が変わった時である。
`;
  const withArchitectureAnalysisContracts = (source: string) =>
    source.replace(
      "\n\n## 4. Architecture処置",
      `\n\n${architectureLensEvaluation}\n## 4. Architecture処置`,
    );
  const withArchitectureDefinitionContracts = (source: string) =>
    source
      .replace(
        "| 入力 | 保護する失敗境界 | 検証可能性 |",
        "| 入力 | 保護する失敗境界 | 検証意図 |",
      )
      .replace(
        "\n## 9. 互換性・移行・成立済み能力",
        `\n### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000001 | なし | 不要 | 解消済み | 上流契約変更時 |
| SPEC-000001 | なし | 不要 | 解消済み | 上流契約変更時 |

Architecture固有の追加人間判断はない。入力契約が変わる場合はUI／SPEC工程へ戻す。

## 9. 互換性・移行・成立済み能力`,
      );
  const uiAnalysis = `# UI-000001のArchitecture分析\n\n成果物種別: Architecture分析（UI観点）\n分析単位: \`UI-000001\`\n\n## 1. 正式入力\n\n- UI定義: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)\n\n## 2. Architectureへ引き継ぐUI契約\n\n利用者が結果と不完全性を区別し、安全な次の行動を選べること。\n\n## 3. Architecture観点の分析\n\n状態Owner、Authority、Effect、失敗境界を分ける。\n\n## 4. Architecture処置\n\n| 定義 | 処置 | 理由 |\n|---|---|---|\n| [試験責務](../../Definitions/ARCH-000001/architecture_definition.md) | New | 利用者向け状態を独立して成立させる責務 |\n\n## 5. SPEC観点との統合時に確認すること\n\n状態差と結果契約を照合する。\n\n${evaluatedChecklist(checklistItemsFromTemplate("template/06_Architecture/Analysis/UI-XXXXXX/architecture_analysis.md"))}\n`;
  const specAnalysis = `# SPEC-000001のArchitecture分析\n\n成果物種別: Architecture分析（SPEC観点）\n分析単位: \`SPEC-000001\`\n\n## 1. 正式入力\n\n- SPEC定義: [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)\n\n## 2. Architectureへ引き継ぐSPEC契約\n\n契機、事前条件、Authority、結果、副作用、検証義務を保持する。\n\n## 3. Architecture観点の分析\n\n状態Owner、Authority、Effect、失敗境界を分ける。\n\n## 4. Architecture処置\n\n| 定義 | 処置 | 理由 |\n|---|---|---|\n| [試験責務](../../Definitions/ARCH-000001/architecture_definition.md) | New | 振る舞い契約を独立して成立させる責務 |\n\n## 5. UI観点との統合時に確認すること\n\n結果契約と利用者が認識する状態差を照合する。\n\n${evaluatedChecklist(checklistItemsFromTemplate("template/06_Architecture/Analysis/SPEC-XXXXXX/architecture_analysis.md"))}\n`;
  const definition = `# 試験責務のArchitecture定義\n\n成果物種別: Architecture定義\nArchitecture ID: \`ARCH-000001\`\n\n## 1. 責務と境界\n\n利用者へ根拠付き状態を返し、表示と状態更新を分離する。\n\n| 観点 | 契約 |\n|---|---|\n| 状態Owner | 試験Core |\n| 所有する責務 | 状態の読取りと根拠付き結果 |\n| 所有しない責務 | UI表示と外部Effect |\n| 主な外部境界 | 状態Sourceと利用側 |\n\n## 2. UI観点の入力\n\n[UI-000001](../../Analysis/UI-000001/architecture_analysis.md)\n\n## 3. SPEC観点の入力\n\n[SPEC-000001](../../Analysis/SPEC-000001/architecture_analysis.md)\n\n## 4. 両観点の統合判断\n\n| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |\n|---|---|---|---|---|---|---|\n| UI-000001 | UI | 試験Core | Authorityを発行しない | 表示だけ | 不完全性を隠さない | 確認→判断 |\n| SPEC-000001 | SPEC | 試験Core | 閲覧Authority | 読取りだけ | 欠測を補完しない | 要求→読取り→結果 |\n\n## 5. 構造と依存方向\n\n\`\`\`text\n[利用側] -> [試験Core] -> [状態Source]\n\`\`\`\n\n## 6. データ・状態・Interface\n\n| 入力 | State Owner | Authority | Effect／非該当 |\n|---|---|---|---|\n| UI-000001 | 試験Core | なし | 表示だけ |\n| SPEC-000001 | 試験Core | 閲覧 | 読取りだけ |\n\n## 7. 失敗・回復・観測\n\n欠測と観測不能を分け、入力固有の失敗理由を返す。\n\n## 8. 品質・保護・運用\n\n| 入力 | 保護する失敗境界 | 検証可能性 |\n|---|---|---|\n| UI-000001 | 不完全性の隠蔽 | 状態差を確認 |\n| SPEC-000001 | 欠測の補完 | Effect 0を確認 |\n\n## 9. 互換性・移行・成立済み能力\n\n| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |\n|---|---|---|---|---|---|\n| 基準版なし | なし | 試験Core | 新規 | 未作成 | 実装待ち |\n\n## 10. 実装と検証への引き渡し\n\n入力ごとのAuthority、Effect、失敗理由および終了状態を理由別に反証する。\n\n## 11. 情報源と現行照合\n\n正式入力は第2節と第3節の分析であり、現行実装は能力比較だけに使う。\n`;
  const definitionWithChecklist = `${withArchitectureDefinitionContracts(definition)}\n${evaluatedChecklist(checklistItemsFromTemplate("template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md"))}\n`;
  write(
    path.join(root, "06_Architecture", "01_Architecture.md"),
    "# Architecture\n\nStatus: Candidate\n\n## Architecture定義台帳\n\n| Architecture定義 | 責務 | UI入力 | SPEC入力 |\n|---|---|---|---|\n| [試験責務](Definitions/ARCH-000001/architecture_definition.md) | 試験 | UI-000001 | SPEC-000001 |\n\n## Architecture横断モデル\n\n| 成果物 |\n|---|\n| [Component](02_Component_and_Responsibility_Model.md) |\n| [Boundary](03_Boundary_and_Interface_Model.md) |\n| [Flow](04_Runtime_and_Data_Flow_Model.md) |\n| [Failure](05_Failure_Recovery_and_Resilience_Model.md) |\n| [Deployment](06_Deployment_and_Execution_Model.md) |\n",
  );
  write(
    path.join(
      root,
      "06_Architecture",
      "Analysis",
      "UI-000001",
      "architecture_analysis.md",
    ),
    withArchitectureAnalysisContracts(uiAnalysis),
  );
  write(
    path.join(
      root,
      "06_Architecture",
      "Analysis",
      "SPEC-000001",
      "architecture_analysis.md",
    ),
    withArchitectureAnalysisContracts(specAnalysis),
  );
  write(
    path.join(
      root,
      "06_Architecture",
      "Definitions",
      "ARCH-000001",
      "architecture_definition.md",
    ),
    definitionWithChecklist,
  );
  write(
    path.join(root, "06_Architecture", "07_Detail_Architecture_Map.md"),
    "# Detail Map\n\n成果物種別: Architecture詳細設計の統合投影\n\n## 2. 詳細設計領域\n\n| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |\n|---|---|---|---|\n| [sample](Details/sample/01_Architecture.md) | ARCH-000001 | 試験責務 | Candidate |\n\n## 3. Architecture定義の閉包\n\n| Architecture定義 | 基本設計 | 接続する詳細設計領域 |\n|---|---|---|\n| ARCH-000001 | [試験責務](Definitions/ARCH-000001/architecture_definition.md) | sample |\n\n## 4. Qualityへの引渡し\n\n検証対象を渡す。\n\n## 5. Reality Audit境界\n\n実装は後から照合する。\n",
  );
  write(
    path.join(
      root,
      "06_Architecture",
      "Details",
      "sample",
      "01_Architecture.md",
    ),
    "# Sample Detail\n\n成果物種別: Architecture詳細設計\n詳細設計領域: sample\n状態: Candidate\n\n## 基本設計との関係\n\n| Architecture定義 | この領域が具体化する責務 | Relation状態 |\n|---|---|---|\n| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | 試験責務 | Covered |\n\n## 詳細成果物の適用判断\n\n| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |\n|---|---|---|---|\n| Component Model | Required | 責務を分ける | [§1](#1-component-model) |\n| Interface Model | Required | 契約を分ける | [§2](#2-interface-model) |\n| Data Flow | Required | Dataを追跡する | [§3](#3-data-flow) |\n| State Model | Required | 状態を分ける | [§4](#4-state-model) |\n| Sequence | Required | 順序を固定する | [§5](#5-sequence) |\n| Failure／Recovery | Required | 失敗を分ける | [§6](#6-failurerecovery) |\n| Deployment | N/A | Process配置を持たない | [§7](#7-deployment) |\n| Observability | Required | 結果を観測する | [§8](#8-observability) |\n| Security Boundary | Required | Authorityを分ける | [§9](#9-security-boundary) |\n\n## Engineering Concern評価\n\n| Concern | Result | Rationale | Evidence／Related ID |\n|---|---|---|---|\n| Concurrency | N/A | 共有状態がない | [§1](#1-component-model) |\n| Timing | N/A | 時間制約がない | [§5](#5-sequence) |\n| Resource Lifecycle | PASS | Run単位で回収する | [§4](#4-state-model) |\n| External Boundary | PASS | 境界を分ける | [§2](#2-interface-model) |\n| Failure／Recovery | PASS | 失敗を返す | [§6](#6-failurerecovery) |\n\n## Qualityへの引渡し\n\n| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |\n|---|---|---|---|---|---|---|\n| sample | Core | 根拠付き結果 | 欠測補完 | result | Effect 0 | なし |\n\n## 現行実装との照合\n\n実装は後から照合する。\n\n## 1. Component Model\n\nCore。\n\n## 2. Interface Model\n\n契約。\n\n## 3. Data Flow\n\nFlow。\n\n## 4. State Model\n\nState。\n\n## 5. Sequence\n\nSequence。\n\n## 6. Failure／Recovery\n\nFailure。\n\n## 7. Deployment\n\nN/A。\n\n## 8. Observability\n\nObservation。\n\n## 9. Security Boundary\n\nBoundary。\n",
  );
  const detailFixturePath = path.join(
    root,
    "06_Architecture",
    "Details",
    "sample",
    "01_Architecture.md",
  );
  write(
    detailFixturePath,
    `${fs
      .readFileSync(detailFixturePath, "utf8")
      .replace(
        "| Failure／Recovery | PASS | 失敗を返す | [§6](#6-failurerecovery) |",
        "| State／Consistency | PASS | 状態と整合条件を分ける | [§4](#4-state-model) |\n| Failure／Recovery | PASS | 失敗を返す | [§6](#6-failurerecovery) |\n| Observability | PASS | 結果を相関して観測する | [§8](#8-observability) |\n| Security／Trust | PASS | AuthorityとTrustを分ける | [§9](#9-security-boundary) |",
      )
      .replace(
        "\n## Qualityへの引渡し",
        "\n結果語彙は次の意味に限定する。\n\n- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。\n- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。\n- `OPEN`: 未解決の設計事項が残る状態。\n- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。\n\n## Qualityへの引渡し",
      )}\n${evaluatedChecklist(checklistItemsFromTemplate("template/06_Architecture/Details/area/01_Architecture.md"))}\n`,
  );
  for (const model of [
    "02_Component_and_Responsibility_Model.md",
    "03_Boundary_and_Interface_Model.md",
    "04_Runtime_and_Data_Flow_Model.md",
    "05_Failure_Recovery_and_Resilience_Model.md",
    "06_Deployment_and_Execution_Model.md",
  ]) {
    const source = fs
      .readFileSync(
        path.join(repositoryRoot, "template", "06_Architecture", model),
        "utf8",
      )
      .replaceAll("Definitions/ARCH-XXXXXX/", "Definitions/ARCH-000001/");
    write(path.join(root, "06_Architecture", model), source);
  }
  for (const relativePath of [
    "template/06_Architecture/Analysis/UI-XXXXXX/architecture_analysis.md",
    "template/06_Architecture/Analysis/SPEC-XXXXXX/architecture_analysis.md",
    "template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md",
    "template/06_Architecture/07_Detail_Architecture_Map.md",
    "template/06_Architecture/Details/area/01_Architecture.md",
  ])
    write(
      path.join(root, relativePath),
      fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
    );
  return root;
}

test("Architecture Readyは全Canonical IDのQuality Mappingと検証定義の閉包を要求する", () => {
  const root = architectureReconstructionFixtureRoot();
  const architectureIndexPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  write(
    architectureIndexPath,
    fs
      .readFileSync(architectureIndexPath, "utf8")
      .replace("Status: Candidate", "Status: Architecture Ready"),
  );
  for (const relativeDirectory of [
    "07_Quality/Definitions/QA-000001",
    "07_Quality/Registry",
    "template/07_Quality/Analysis/PHASE",
    "template/07_Quality/Definitions/QA-XXXXXX",
  ])
    fs.mkdirSync(path.join(root, relativeDirectory), { recursive: true });
  const requiredQualityFiles = [
    "01_Quality_Center.md",
    "02_Quality_Strategy.md",
    "03_Verification_Design.md",
    "04_Quality_Integration.md",
    "05_Current_Implementation_Reality_Audit.md",
  ];
  const requiredTemplateQualityFiles = [
    ...requiredQualityFiles,
    "99_Verification_Result_Format.md",
  ];
  for (const fileName of requiredQualityFiles)
    if (fileName !== "04_Quality_Integration.md")
      write(path.join(root, "07_Quality", fileName), `# ${fileName}\n`);
  for (const fileName of requiredTemplateQualityFiles)
    write(
      path.join(root, "template", "07_Quality", fileName),
      `# ${fileName}\n`,
    );
  for (const fileName of [
    "test-catalog.json",
    "coordinator-runtime-traceability.json",
    "project-runtime-design-traceability.json",
  ])
    write(path.join(root, "07_Quality", "Registry", fileName), "{}\n");
  const mappingPath = path.join(
    root,
    "07_Quality",
    "04_Quality_Integration.md",
  );
  const mapping = `# Quality Analysis

## 3. 全件Mapping

| Source ID | 検証すべき意味 | 検証義務 | 検証目標 | Level | Type | 処置状態 |
|---|---|---|---|---|---|---|
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | 体験 | 保証 | [sample](../../Definitions/QA-000001/quality_definition.md) | ST／UAT | Experience | Mapped |
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | 情報 | 保証 | [sample](../../Definitions/QA-000001/quality_definition.md) | IT／ST | Information | Mapped |
| [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md) | UI | 保証 | [sample](../../Definitions/QA-000001/quality_definition.md) | IT／ST | Interface | Mapped |
| [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md) | 振る舞い | 保証 | [sample](../../Definitions/QA-000001/quality_definition.md) | UT／IT | Behavior | Mapped |
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | 構造 | 保証 | [sample](../../Definitions/QA-000001/quality_definition.md) | IT／ST | Architecture | Mapped |

## 4. 統合

### 4.0. Source固有条件と検証項目の関係

| Source ID | 検証目標 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 体験を保証する | ST／UAT | \`SAMPLE-10\`、\`SAMPLE-11\` |
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 情報を保証する | IT／ST | \`SAMPLE-01\`、\`SAMPLE-10\` |
| [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | UIを保証する | IT／ST | \`SAMPLE-01\`、\`SAMPLE-10\` |
| [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 振る舞いを保証する | UT／IT | \`SAMPLE-12\`、\`SAMPLE-01\` |
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 構造を保証する | IT／ST | \`SAMPLE-01\`、\`SAMPLE-10\` |

### 4.1. Architecture横断モデルの処置

| 検証目標 | [Component](../../../06_Architecture/02_Component_and_Responsibility_Model.md) | [Boundary](../../../06_Architecture/03_Boundary_and_Interface_Model.md) | [Flow](../../../06_Architecture/04_Runtime_and_Data_Flow_Model.md) | [Failure](../../../06_Architecture/05_Failure_Recovery_and_Resilience_Model.md) | [Deployment](../../../06_Architecture/06_Deployment_and_Execution_Model.md) |
|---|---|---|---|---|---|
| sample | Required | Required | Required | Required | N/A: 配置差なし |

### 4.2. Architecture詳細設計領域の処置

| 詳細設計領域 | 接続する検証目標 | 成立条件 |
|---|---|---|
| [sample](../../../06_Architecture/Details/sample/01_Architecture.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 境界を確認する |

### 4.3. 検証項目の閉包

| 検証目標 | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| [sample](../../Definitions/QA-000001/quality_definition.md) | \`SAMPLE-01\`、\`SAMPLE-10\`、\`SAMPLE-11\`、\`SAMPLE-12\` | §3の全入力 | §4.1と§4.2 |
`;
  const writeQualityMapping = function writeQualityMappingFixture(
    mappingValue: string,
  ) {
    const summaryBlock =
      mappingValue.match(
        /^## 3\. 全件Mapping\s*$([\s\S]*?)(?=^## 4\.)/mu,
      )?.[1] ?? "";
    const summaryRows = summaryBlock
      .split(/\r?\n/u)
      .filter((line: string) =>
        /^\|\s*\[(?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6}\]\(/u.test(line),
      );
    const relationBlock =
      mappingValue.match(
        /^### 4\.0\. Source固有条件と検証項目の関係\s*$([\s\S]*?)(?=^### 4\.1\.)/mu,
      )?.[1] ?? "";
    const relationRows = relationBlock
      .split(/\r?\n/u)
      .filter((line: string) =>
        /^\|\s*\[(?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6}\]\(/u.test(line),
      );
    for (const prefix of ["REQ", "UX", "IA", "UI", "SPEC", "ARCH"]) {
      const phasePath = path.join(
        root,
        "07_Quality",
        "Analysis",
        prefix,
        "quality_analysis.md",
      );
      const phaseSummaries = summaryRows.filter((line: string) =>
        line.startsWith(`| [${prefix}-`),
      );
      const phaseRelations = relationRows.filter((line: string) =>
        line.startsWith(`| [${prefix}-`),
      );
      write(
        phasePath,
        [
          `# ${prefix} Quality Analysis`,
          "",
          "## 2. 全件処置",
          "",
          "| Source ID | 成功の意味 | 検証義務 | 統合先の検証目標 | 試験段階 | 試験種別 | 処置状態 |",
          "|---|---|---|---|---|---|---|",
          ...phaseSummaries,
          "",
          "## 3. 検証目標への統合",
          "",
          "| Source ID | 検証目標 | 保持する固有条件 | 試験段階 | 対応Local Item |",
          "|---|---|---|---|---|",
          ...phaseRelations,
          "",
          "## 4. 未解決事項",
          "",
          "なし",
          "",
        ].join("\n"),
      );
    }
    const cross =
      mappingValue.match(
        /^### 4\.1\. Architecture横断モデルの処置\s*$([\s\S]*?)(?=^### 4\.2\.)/mu,
      )?.[1] ?? "";
    const detail =
      mappingValue.match(
        /^### 4\.2\. Architecture詳細設計領域の処置\s*$([\s\S]*?)(?=^### 4\.3\.)/mu,
      )?.[1] ?? "";
    const local =
      mappingValue.match(
        /^### 4\.3\. 検証項目の閉包\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
      )?.[1] ?? "";
    const integration = [
      "# Quality Integration",
      "",
      "## 1. 統合の責務",
      "",
      "## 2. Architecture横断モデルの処置",
      cross,
      "## 3. Architecture詳細設計領域の処置",
      detail,
      "## 4. 検証項目の閉包",
      local,
    ]
      .join("\n")
      .replaceAll("../../../06_Architecture/", "../06_Architecture/")
      .replaceAll("../../Definitions/", "Definitions/");
    write(mappingPath, integration);
  };

  writeQualityMapping(mapping);
  const definitionPath = path.join(
    root,
    "07_Quality",
    "Definitions",
    "QA-000001",
    "quality_definition.md",
  );
  const definition = `# QA-000001 Verification

成果物種別: Quality定義
Quality ID: \`QA-000001\`
主な試験段階: Unit／Integration／System／User Acceptance

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | 体験を保証する | ST／UAT | \`SAMPLE-10\`、\`SAMPLE-11\` |
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | 情報を保証する | IT／ST | \`SAMPLE-01\`、\`SAMPLE-10\` |
| [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md) | UIを保証する | IT／ST | \`SAMPLE-01\`、\`SAMPLE-10\` |
| [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md) | 振る舞いを保証する | UT／IT | \`SAMPLE-12\`、\`SAMPLE-01\` |
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | 構造を保証する | IT／ST | \`SAMPLE-01\`、\`SAMPLE-10\` |

### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [sample](../../../06_Architecture/Details/sample/01_Architecture.md) | 境界を確認する |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
|---|---|---|---|---|
| UT | Required | 最小責務 | N/A | 局所判定を確認する |
| IT | Required | 境界 | Direct Boundary | 直接境界を確認する |
| ST | Required | System | System/E2E | 上位経路を確認する |
| UAT | Required | 利用者受入 | User Acceptance | 利用者判断を確認する |

## 3. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
|---|---|---|---|---|---|---|---|---|---|---|
| \`SAMPLE-01\` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |
| \`SAMPLE-10\` | 正常 | ST | Scenario | Entry→System | System/E2E | 有効な経路 | 実行する | 完成結果を確認する | 未解消状態なし | Automated |
| \`SAMPLE-11\` | 利用者判断 | UAT | Acceptance | Result→User | User Acceptance | 完成結果 | 判断する | 意味を理解できる | 未解消状態なし | Manual |
| \`SAMPLE-12\` | 境界 | UT | Contract | Core | N/A | 入力値 | 判定する | 局所結果を確認する | 外部Effect 0 | Automated |
## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更影響で既存項目を選ぶ | Changeの通常検証範囲 | 未選択範囲を明示する |
| PT | N/A | 性能条件なし | N/A | 未実行をPassにしない |
| LT | N/A | 長時間条件なし | N/A | 未実行をPassにしない |

`;
  write(definitionPath, definition);

  let result = runChecker(root);
  assert.ok(
    !result.report.findings.some((finding) =>
      finding.code.startsWith("quality-"),
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  for (const [relativePath, expectedCode] of [
    [
      "07_Quality/05_Current_Implementation_Reality_Audit.md",
      "quality-current-profile-file-missing",
    ],
    [
      "template/07_Quality/99_Verification_Result_Format.md",
      "quality-current-profile-file-missing",
    ],
    [
      "07_Quality/Registry/test-catalog.json",
      "quality-current-profile-registry-missing",
    ],
  ] as const) {
    const targetPath = path.join(root, relativePath);
    const original = fs.readFileSync(targetPath, "utf8");
    fs.rmSync(targetPath);
    result = runChecker(root);
    assert.ok(
      result.report.findings.some((finding) => finding.code === expectedCode),
      `${relativePath}\n${result.stderr}\n${result.stdout}`,
    );
    write(targetPath, original);
  }
  const legacyQualityPath = path.join(
    root,
    "07_Quality",
    "04_Test_Catalog.json",
  );
  write(legacyQualityPath, "{}\n");
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-legacy-layout-reintroduced",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
  fs.rmSync(legacyQualityPath);

  writeQualityMapping(
    mapping.replace(
      "[sample](../../Definitions/QA-000001/quality_definition.md) | ST／UAT | Experience",
      "[sample](../../Definitions/QA-000001/quality_definition.md) | ST | Experience",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-source-test-level-decomposition-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
      "| 体験を保証する | ST | `SAMPLE-10`、`SAMPLE-11` |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
        "quality-definition-source-test-level-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
      "| 体験を保証する | ST／UAT | `SAMPLE-10` |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-source-test-level-coverage-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
      "| 体験を保証する | ST／UAT | `SAMPLE-11` |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-source-test-level-coverage-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
      "| 体験を保証する | ST／UAT | `SAMPLE-01`、`SAMPLE-12` |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-source-test-level-coverage-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      /^\| \[UX-000001\].*\| \[sample\].*\| 体験を保証する \| ST／UAT \| `SAMPLE-10`、`SAMPLE-11` \|\r?\n/mu,
      "",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-source-goal-relation-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
      "| 別表現の体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |\n| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-source-relation-duplicate",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11` |",
      "| 体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-99` |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-source-local-relation-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(definitionPath, definition);
  writeQualityMapping(
    mapping.replace(
      "体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11`",
      "体験の別条件 | ST／UAT | `SAMPLE-10`、`SAMPLE-11`",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-source-condition-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "体験を保証する | ST／UAT | `SAMPLE-10`、`SAMPLE-11`",
      "体験の別条件 | ST／UAT | `SAMPLE-10`、`SAMPLE-11`",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-source-condition-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | | Automated |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-verification-item-axis-missing",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-verification-item-axis-missing",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated／ST |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-verification-item-execution-mode-invalid",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
      "| `SAMPLE-01` | 正常 | Component | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-verification-item-test-level-invalid",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(
    definitionPath,
    definition.replace(
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Direct Boundary | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
      "| `SAMPLE-01` | 正常 | IT | Contract | Adapter→Core | Full Stack | 有効な入力 | 入力する | 結果を確認する | 未解消状態なし | Automated |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
        "quality-verification-item-external-boundary-stage-invalid",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(
    definitionPath,
    definition.replace(
      "| UAT | Required | 利用者受入 | User Acceptance | 利用者判断を確認する |\n",
      "",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-test-level-applicability-incomplete",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(
    definitionPath,
    definition.replace(
      "| IT | Required | 境界 | Direct Boundary | 直接境界を確認する |",
      "| IT | N/A | 外部境界なし | N/A | 外部境界を持たない |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-test-level-applicability-conflict",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(
    definitionPath,
    definition.replace(
      "| IT | Required | 境界 | Direct Boundary | 直接境界を確認する |",
      "| IT | Required | 境界 | N/A | 直接境界を確認する |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-test-level-applicability-conflict",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "主な試験段階: Unit／Integration／System／User Acceptance",
      "主な試験段階: Unit／Integration／System",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-primary-test-level-summary-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(definitionPath, definition.replace(/^\| LT \|.*\r?\n/mu, ""));
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code ===
        "quality-additional-test-type-applicability-incomplete",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(
    definitionPath,
    definition.replace(
      "| PT | N/A | 性能条件なし | N/A | 未実行をPassにしない |",
      "| PT | Conditional | 性能条件がある場合 | Changeの通常検証範囲 | 未実行をPassにしない |",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-expensive-test-authorization-invalid",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(
    definitionPath,
    definition.replace("Quality ID: `QA-000001`", "Quality ID: `QA-999999`"),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-definition-identity-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(definitionPath, definition);
  fs.rmSync(
    path.join(root, "07_Quality", "Analysis", "REQ", "quality_analysis.md"),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-canonical-mapping-missing",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
  writeQualityMapping(mapping);

  const secondDefinitionPath = path.join(
    root,
    "07_Quality",
    "Definitions",
    "QA-000002",
    "quality_definition.md",
  );
  const secondDefinition = `# QA-000002 Verification Two

成果物種別: Quality定義
Quality ID: \`QA-000002\`
主な試験段階: System／User Acceptance

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | 第二の体験条件を保証する | ST／UAT | \`SAMPLE-02\`、\`SAMPLE-03\` |

### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [sample](../../../06_Architecture/Details/sample/01_Architecture.md) | 第二の境界を確認する |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
|---|---|---|---|---|
| UT | Conditional | 最小責務 | N/A | 局所判定を独立実装する場合に確認する |
| IT | Conditional | 境界 | Adjacent 1 Block | 隣接境界を実装する場合に確認する |
| ST | Required | System | System/E2E | 上位経路を確認する |
| UAT | Required | 利用者受入 | User Acceptance | 利用者判断を確認する |

## 3. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
|---|---|---|---|---|---|---|---|---|---|---|
| \`SAMPLE-02\` | 正常 | ST | Scenario | Entry→Consumer | System/E2E | 第二の入力 | 入力する | 第二の結果を確認する | 未解消状態なし | Automated |
| \`SAMPLE-03\` | 利用者判断 | UAT | Acceptance | Result→User | User Acceptance | 第二の結果 | 判断する | 意味を理解できる | 未解消状態なし | Manual |
## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更影響で既存項目を選ぶ | Changeの通常検証範囲 | 未選択範囲を明示する |
| PT | N/A | 性能条件なし | N/A | 未実行をPassにしない |
| LT | N/A | 長時間条件なし | N/A | 未実行をPassにしない |

`;
  write(secondDefinitionPath, secondDefinition);
  const mappingTwoGoals = mapping
    .replace(
      "[sample](../../Definitions/QA-000001/quality_definition.md) | ST／UAT",
      "[sample](../../Definitions/QA-000001/quality_definition.md)、[sample two](../../Definitions/QA-000002/quality_definition.md) | ST／UAT",
    )
    .replace(
      "| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 情報を保証する | IT／ST | `SAMPLE-01`、`SAMPLE-10` |",
      "| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | [sample two](../../Definitions/QA-000002/quality_definition.md) | 第二の体験条件を保証する | ST／UAT | `SAMPLE-02`、`SAMPLE-03` |\n| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | [sample](../../Definitions/QA-000001/quality_definition.md) | 情報を保証する | IT／ST | `SAMPLE-01`、`SAMPLE-10` |",
    )
    .replace(
      "| sample | Required | Required | Required | Required | N/A: 配置差なし |",
      "| sample | Required | Required | Required | Required | N/A: 配置差なし |\n| sample two | Required | Required | Required | Required | N/A: 配置差なし |",
    )
    .replace(
      "[sample](../../Definitions/QA-000001/quality_definition.md) | 境界を確認する",
      "[sample](../../Definitions/QA-000001/quality_definition.md)、[sample two](../../Definitions/QA-000002/quality_definition.md) | 境界を確認する",
    )
    .replace(
      "| [sample](../../Definitions/QA-000001/quality_definition.md) | `SAMPLE-01`、`SAMPLE-10`、`SAMPLE-11`、`SAMPLE-12` | §3の全入力 | §4.1と§4.2 |",
      "| [sample](../../Definitions/QA-000001/quality_definition.md) | `SAMPLE-01`、`SAMPLE-10`、`SAMPLE-11`、`SAMPLE-12` | §3の全入力 | §4.1と§4.2 |\n| [sample two](../../Definitions/QA-000002/quality_definition.md) | `SAMPLE-02`、`SAMPLE-03` | §3の全入力 | §4.1と§4.2 |",
    );
  writeQualityMapping(mappingTwoGoals);
  write(definitionPath, definition);
  result = runChecker(root);
  assert.ok(
    !result.report.findings.some((finding) =>
      finding.code.startsWith("quality-"),
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mappingTwoGoals
      .replace(
        "| [sample](../../Definitions/QA-000001/quality_definition.md) | `SAMPLE-01`、`SAMPLE-10`、`SAMPLE-11`、`SAMPLE-12` | §3の全入力 | §4.1と§4.2 |",
        "| [sample](../../Definitions/QA-000001/quality_definition.md) | `SAMPLE-02`、`SAMPLE-10`、`SAMPLE-11`、`SAMPLE-12` | §3の全入力 | §4.1と§4.2 |",
      )
      .replace(
        "| [sample two](../../Definitions/QA-000002/quality_definition.md) | `SAMPLE-02`、`SAMPLE-03` | §3の全入力 | §4.1と§4.2 |",
        "| [sample two](../../Definitions/QA-000002/quality_definition.md) | `SAMPLE-01`、`SAMPLE-03` | §3の全入力 | §4.1と§4.2 |",
      ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-goal-local-relation-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
  fs.rmSync(path.dirname(secondDefinitionPath), { recursive: true });

  writeQualityMapping(mapping.replace("N/A: 配置差なし", "N/A"));
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-cross-model-disposition-invalid",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    definitionPath,
    definition.replace(
      "| [sample](../../../06_Architecture/Details/sample/01_Architecture.md) | 境界を確認する |\n",
      "",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-detail-goal-relation-closure-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(definitionPath, definition);

  writeQualityMapping(
    mapping
      .replace(/^\| \[UX-000001\].*\r?\n/mu, "")
      .replace("## 4. 統合", "REQ-999999\n\n## 4. 統合"),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-canonical-mapping-coverage-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  const firstMappingRow = mapping.match(/^\| \[UX-000001\].*$/mu)?.[0];
  assert.ok(firstMappingRow);
  writeQualityMapping(
    mapping.replace(firstMappingRow, `${firstMappingRow}\n${firstMappingRow}`),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-canonical-mapping-duplicate-row",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  fs.rmSync(definitionPath);
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-definition-missing",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  write(definitionPath, definition);
  writeQualityMapping(
    mapping.replace(
      "../../../06_Architecture/02_Component_and_Responsibility_Model.md",
      "../../../06_Architecture/03_Boundary_and_Interface_Model.md",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-architecture-cross-model-coverage-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(
    mapping.replace(
      "../../../06_Architecture/Details/sample/01_Architecture.md",
      "../../../06_Architecture/Details/unknown/01_Architecture.md",
    ),
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "quality-architecture-detail-coverage-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  writeQualityMapping(mapping);
  write(
    path.join(
      root,
      "07_Quality",
      "Definitions",
      "QA-999999",
      "quality_definition.md",
    ),
    "# Orphan\n\n## 1. 試験段階と外部境界の適用\n\n| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |\n|---|---|---|---|---|\n| UT | Required | 最小責務 | N/A | 局所判定を確認する |\n| IT | N/A | 外部境界なし | N/A | 外部境界を持たない |\n| ST | N/A | System対象なし | N/A | 上位経路を持たない |\n| UAT | N/A | 利用者受入なし | N/A | 利用者判断を含まない |\n\n## 2. 検証項目\n\n| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |\n|---|---|---|---|---|---|---|---|---|---|---|\n| `ORPHAN-01` | 正常 | UT | Functional | 局所責務 | N/A | 入力あり | 入力する | 結果を確認する | 未解消状態なし | Automated |\n",
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-definition-set-mismatch",
    ),
    `${result.stderr}\n${result.stdout}`,
  );

  fs.rmSync(
    path.dirname(
      path.join(
        root,
        "07_Quality",
        "Definitions",
        "QA-999999",
        "quality_definition.md",
      ),
    ),
    {
      recursive: true,
    },
  );
  write(
    definitionPath,
    "# Verification\n\n## 1. 試験段階と外部境界の適用\n\n| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |\n|---|---|---|---|---|\n| UT | Required | 最小責務 | N/A | 局所判定を確認する |\n| IT | N/A | 外部境界なし | N/A | 外部境界を持たない |\n| ST | N/A | System対象なし | N/A | 上位経路を持たない |\n| UAT | N/A | 利用者受入なし | N/A | 利用者判断を含まない |\n\n## 2. 検証項目\n\n| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |\n|---|---|---|---|---|---|---|---|---|---|---|\n| `SAMPLE-01` | 正常 | UT | Functional | 局所責務 | N/A | 入力あり | 入力する | 結果を確認する | 未解消状態なし | Automated |\n| `SAMPLE-01` | 異常 | UT | Functional | 局所責務 | N/A | 壊れた入力 | 壊す | 拒否する | Effect 0 | Automated |\n",
  );
  result = runChecker(root);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "quality-local-verification-id-duplicate",
    ),
    `${result.stderr}\n${result.stdout}`,
  );
});

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
        assert.ok(
          fs
            .lstatSync(path.join(repositoryRoot, "07_Quality", "Registry"))
            .isDirectory(),
          "Registry",
        );
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
    "# UX\n\n| 利用者成果 |\n|---|\n| UX-000001@2 |\n",
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
