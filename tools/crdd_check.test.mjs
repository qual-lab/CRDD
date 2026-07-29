import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";

const checker = path.resolve("template/tools/crdd_check.mjs");
const faultInjector = path.resolve("tools/crdd_check_fault_injector.cjs");
const fixtures = [];
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
});

function makeStructure(root) {
  for (const folder of requiredFolders) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
}

function write(file, content = "") {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function run(root, ...extra) {
  const result = spawnSync(
    process.execPath,
    [checker, "--root", root, "--json", "--summary", ...extra],
    { encoding: "utf8" },
  );
  return {
    ...result,
    report: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

function runWithEnv(root, env, ...extra) {
  const result = spawnSync(
    process.execPath,
    [checker, "--root", root, "--json", "--summary", ...extra],
    { encoding: "utf8", env: { ...process.env, ...env } },
  );
  return {
    ...result,
    report: result.stdout ? JSON.parse(result.stdout) : null,
  };
}

function runWithFault(root, fault, target, env = {}, ...extra) {
  const nodeOptions = [
    process.env.NODE_OPTIONS,
    `--require=${faultInjector}`,
  ].filter(Boolean).join(" ");
  return runWithEnv(
    root,
    {
      ...env,
      NODE_OPTIONS: nodeOptions,
      CRDD_CHECK_FAULT: fault,
      CRDD_CHECK_FAULT_ROOT: root,
      CRDD_CHECK_FAULT_TARGET: target,
    },
    ...extra,
  );
}

function runRaw(...arguments_) {
  return spawnSync(process.execPath, [checker, ...arguments_], {
    encoding: "utf8",
  });
}

test("公式リポジトリではREADMEと正本文書の版を比較する", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "README.md"), "Status: **v0.9.0**\n");
  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "readme-version-mismatch",
    ),
  );
});

test("採用先の製品READMEはCRDD基準版と比較しない", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "README.md"), "Status: **v9.9.9**\n");
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.findings.length, 0);
});

test("採用先のCRDD正本文書間の版不一致は検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "00_CRDD", "02_Terminology.md"), "Version: v0.9.0\n");
  const result = run(root);
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
  const result = run(root);
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
  const result = run(root, "--scope", "01_Discovery");
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
  const result = run(root);
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
  const result = run(root);
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
  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "change-trace-placement",
    ),
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
  const result = run(root);
  assert.equal(result.status, 0, JSON.stringify(result.report?.findings));
  assert.equal(result.report.findings.length, 0);
});

test("参照関係を重複回数付きで集約する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[B](B.md)\n[B2](B.md)\n");
  write(path.join(root, "01_Discovery", "B.md"), "[A](A.md)\n");
  const result = run(
    root,
    "--references",
    "01_Discovery/B.md",
  );
  assert.equal(result.status, 0);
  assert.equal(result.report.references.inbound[0].count, 2);
  assert.equal(result.report.references.outbound[0].target, "01_Discovery/A.md");
});

test("分岐網羅率の分母・分子・割合の不整合を検出する", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "07_Quality", "Quality_Center.md"),
    [
      "| 対象 | 到達分岐数（分子） | 対象分岐数（分母） | 実測率 |",
      "|---|---:|---:|---:|",
      "| app | 8 | 10 | 70% |",
    ].join("\n"),
  );
  const result = run(root);
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
  for (const arguments_ of [
    ["--root", path.join(os.tmpdir(), "missing-crdd-root")],
    ["--root", file],
    ["--root", "--json"],
    ["--unknown"],
  ]) {
    const result = runRaw(...arguments_);
    assert.equal(result.status, 2, arguments_.join(" "));
  }
});

test("適用先では無関係なtemplateフォルダより00_CRDDを優先する", () => {
  const root = fixture();
  makeStructure(root);
  fs.mkdirSync(path.join(root, "template"), { recursive: true });
  write(path.join(root, "00_CRDD", "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "README.md"), "Status: **v9.9.9**\n");
  const result = run(root);
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
  const result = run(root);
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
  write(path.join(root, "01_Discovery", "A.md"), "[outside](../../outside.md)\n");
  const result = run(root);
  assert.equal(result.status, 0);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "outside-root-link",
    ),
  );
  assert.ok(result.report.unchecked.some((item) => item.includes("Outside-root")));
});

test("Git無視ファイルを除外し未追跡・非無視ファイルを確認する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, ".gitignore"), "node_modules/\n");
  write(path.join(root, "node_modules", "README.md"), "[broken](missing.md)\n");
  write(path.join(root, "01_Discovery", "Work.md"), "[broken](missing.md)\n");
  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  const result = run(root);
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
  const result = run(root);
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
  const result = run(root);
  assert.equal(result.report.findings.length, 0);
});

test("旧JSON配列と非JSONサマリーの互換性を維持する", () => {
  const root = fixture();
  makeStructure(root);
  const legacy = runRaw("--root", root, "--json");
  assert.ok(Array.isArray(JSON.parse(legacy.stdout)));
  const summary = runRaw("--root", root, "--scope", "01_Discovery", "--summary");
  assert.match(summary.stdout, /Executed=/u);
  assert.match(summary.stdout, /Unchecked=/u);
});

test("不正なURIエンコードを例外にせず警告する", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "[bad](%ZZ.md)\n");
  const result = run(root);
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
  const result = run(root);
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

  const notRepository = run(root);
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

  const result = run(root);
  assert.equal(result.report.discovery_git_failure, "list-failed");
  assert.doesNotMatch(result.stdout, /index file|fatal:/iu);
});

test("00_CRDDサブモジュールへのリンクを誤検知せず境界を報告する", () => {
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
    [
      "Version: v0.10.0",
      '<a id="baseline-rule"></a>',
      "## Baseline Rule",
    ].join("\n"),
  );
  write(
    path.join(root, "README.md"),
    "[Rule](00_CRDD/01_Principles.md#baseline-rule)\n",
  );

  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.metrics.anchors_checked, 1);
  assert.equal(
    result.report.findings.some(
      (finding) => finding.code === "excluded-local-link",
    ),
    false,
  );
  assert.ok(
    result.report.unchecked.some((item) =>
      item.includes("baseline submodule contents"),
    ),
  );

  const references = run(root, "--references", "00_CRDD/01_Principles.md");
  assert.equal(references.status, 0);
  assert.equal(references.report.references.inbound[0].source, "README.md");

  const invalidScope = runRaw(
    "--root",
    root,
    "--scope",
    "00_CRDD",
    "--json",
    "--summary",
  );
  assert.equal(invalidScope.status, 2);
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

  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.report.repository_mode, "adopter");
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_initialized, false);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-not-initialized",
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

  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 0);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "symbolic-link-target",
    ),
  );
  assert.ok(
    result.report.unchecked.some((item) =>
      item.includes("Symbolic link"),
    ),
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
    [
      "Version: v0.10.0",
      '<a id="actual-submodule-rule"></a>',
      "## Rule",
    ].join("\n"),
  );
  write(
    path.join(source, "template", "tools", "crdd_check.mjs"),
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
    "crdd_check.mjs",
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
  assert.equal(report.metrics.anchors_checked, 1);
  assert.equal(report.metrics.errors, 0);
  assert.equal(report.metrics.warnings, 0);
});

test("構造上の欠落・旧配置・予約領域・中央集約をまとめて検出する", () => {
  const root = fixture();
  makeStructure(root);
  fs.rmSync(path.join(root, "02_UX"), { recursive: true });
  fs.mkdirSync(path.join(root, "08_Quality"), { recursive: true });
  fs.mkdirSync(path.join(root, "09_Project_Extension"), { recursive: true });
  fs.mkdirSync(path.join(root, "Evidence"), { recursive: true });
  write(path.join(root, "40_Develop", "Management.md"), "# management\n");

  const result = run(root);
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

  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
  assert.equal(result.report.metrics.errors, 0);
});

test("範囲指定を直接の参照元と参照先へ広げる", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[UX](../02_UX/B.md)\n",
  );
  write(path.join(root, "02_UX", "B.md"), "# UX\n");
  write(
    path.join(root, "03_IA", "C.md"),
    "[Discovery](../01_Discovery/A.md)\n",
  );

  const result = run(root, "--scope", "01_Discovery");
  assert.equal(result.status, 0);
  assert.deepEqual(
    new Set(result.report.expanded_scope),
    new Set([
      "01_Discovery/A.md",
      "02_UX/B.md",
      "03_IA/C.md",
    ]),
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

  const result = run(root);
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

  const result = run(root);
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
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[missing](missing.md)\n",
  );
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

  const result = run(root);
  assert.equal(result.status, 1);
  const codes = new Set(result.report.findings.map((finding) => finding.code));
  assert.ok(codes.has("invalid-document-root"));
  assert.ok(codes.has("invalid-structure-entry"));
});

test("a regular file at the official template root is reported without traversal", () => {
  const root = fixture();
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  write(path.join(root, "template"), "not a directory\n");

  const result = run(root);
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

  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "invalid-structure-entry" &&
        finding.path === "02_UX",
    ),
  );
});

test("fallback recognizes a safe real submodule gitdir file", () => {
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
  write(
    path.join(root, "00_CRDD", "01_Principles.md"),
    "Version: v0.10.0\n",
  );

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 0);
  assert.equal(result.report.baseline_submodule, true);
  assert.equal(result.report.baseline_submodule_initialized, true);
  assert.equal(result.report.discovery_source, "walk-fallback");
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
  assert.equal(result.report.baseline_submodule_initialized, false);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-not-initialized",
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
  assert.equal(result.report.baseline_submodule_initialized, false);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "baseline-submodule-not-initialized",
    ),
  );
});

test("a generic repository does not require the CRDD template structure", () => {
  const root = fixture();

  const result = run(root);
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

  const result = run(root);
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
  write(
    path.join(root, "01_Discovery", "B.md"),
    "# 日本語／見出し（例）\n",
  );

  const result = run(root);
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

  const result = run(root);
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

  const result = run(root);
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

  const result = run(root);
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

  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 8);
});

test("duplicate heading suffixes avoid anchors generated by another heading", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[third](B.md#foo-2)\n",
  );
  write(
    path.join(root, "01_Discovery", "B.md"),
    ["# Foo", "# Foo-1", "# Foo"].join("\n"),
  );

  const result = run(root);
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

  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.report.metrics.anchors_checked, 1);
});

test("fallback recognizes a non-linked git metadata directory", () => {
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
  assert.equal(result.status, 0);
  assert.equal(result.report.baseline_submodule_initialized, true);
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
  assert.equal(result.report.baseline_submodule_initialized, false);
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
  assert.equal(result.report.baseline_submodule_initialized, false);
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

  const result = runWithFault(
    root,
    "lstat-error",
    target,
    { PATH: noGitPath },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injected metadata failure/u);
});

test("a structure root removed during inspection becomes a structured finding", () => {
  const root = fixture();
  makeStructure(path.join(root, "template"));
  write(path.join(root, "01_Principles.md"), "Version: v0.10.0\n");
  const target = path.join(root, "template");

  const result = runWithFault(
    root,
    "lstat-missing-after-first",
    target,
  );
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

  const result = runWithFault(
    root,
    "lstat-special",
    target,
    { PATH: noGitPath },
  );
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, false);
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

  const result = runWithFault(
    root,
    "git-list-custom",
    root,
    {
      CRDD_CHECK_FAULT_GIT_LIST_JSON: JSON.stringify([
        "01_Discovery/A.md",
        "Linked/Secret.md",
        "Missing.md",
        "../outside.md",
      ]),
    },
  );
  assert.equal(result.status, 0);
  assert.ok(
    result.report.discovery_exclusions.includes(
      "Symbolic links and junctions",
    ),
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

  const result = runWithFault(
    root,
    "relative-outside",
    target,
    { PATH: noGitPath },
  );
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
  write(
    path.join(root, "00_CRDD", ".git"),
    "gitdir: ../Metadata/00_CRDD\n",
  );
  fs.mkdirSync(path.join(outside, "00_CRDD"), { recursive: true });
  fs.symlinkSync(
    outside,
    path.join(root, "Metadata"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = runWithEnv(root, { PATH: noGitPath });
  assert.equal(result.status, 1);
  assert.equal(result.report.baseline_submodule_initialized, false);
});

test("empty heading anchors are ignored", () => {
  const root = fixture();
  makeStructure(root);
  write(path.join(root, "01_Discovery", "A.md"), "# !!!\n");
  write(
    path.join(root, "01_Discovery", "B.md"),
    "[empty](A.md#empty)\n",
  );

  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.findings.some(
      (finding) => finding.code === "broken-anchor",
    ),
  );
});

test("finding order falls back to the message when other keys are equal", () => {
  const root = fixture();
  makeStructure(root);
  write(
    path.join(root, "01_Discovery", "A.md"),
    ["[first](%ZA.md)", "[second](%ZB.md)"].join("\n"),
  );

  const result = run(root);
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

  const result = runWithFault(
    root,
    "lstat-missing-after-first",
    root,
    { PATH: noGitPath },
  );
  assert.equal(result.status, 1);
  assert.equal(result.report.metrics.files_discovered, 0);
  assert.ok(
    result.report.findings.some(
      (finding) =>
        finding.code === "discovery-directory-missing" &&
        finding.path === ".",
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
    [
      "# A",
      "[external](https://example.invalid)",
      "[local](B.md)",
    ].join("\n"),
  );
  write(path.join(root, "01_Discovery", "B.md"), "# B\n");

  const result = run(root, "--references", "01_Discovery/A.md");
  assert.equal(result.status, 0);
  assert.equal(result.report.references.outbound.length, 1);
  assert.equal(result.report.references.outbound[0].target, "01_Discovery/B.md");
});

test("fallback reports a nested directory that disappears before recursion", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const target = path.join(root, "01_Discovery");

  const result = runWithFault(
    root,
    "lstat-missing",
    target,
    { PATH: noGitPath },
  );
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

    const result = runWithFault(
      root,
      fault,
      target,
      { PATH: noGitPath },
    );
    assert.equal(result.status, 1, fault);
    assert.ok(result.report, `${fault}: ${result.stderr}`);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === expectedCode &&
          finding.path === "Nested",
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

    const result = runWithFault(
      root,
      "readdir-error",
      target,
      {
        PATH: noGitPath,
        CRDD_CHECK_FAULT_ERROR_CODE: errorCode,
      },
    );
    assert.equal(result.status, 1, errorCode);
    assert.ok(
      result.report.findings.some(
        (finding) =>
          finding.code === expectedCode &&
          finding.path === "01_Discovery",
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

  const result = runWithFault(
    root,
    "lstat-missing-after-first",
    target,
    { PATH: noGitPath },
  );
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
  write(
    path.join(root, "01_Discovery", "A.md"),
    "[B](B.md)\n",
  );
  write(path.join(root, "01_Discovery", "B.md"), "# B\n");

  const result = run(root, "--references", "01_Discovery");
  assert.equal(result.status, 0);
  assert.equal(result.report.references.outbound.length, 1);
  assert.equal(result.report.references.inbound.length, 1);
});

test("child-process fault injection records a directory replacement", () => {
  const root = fixture();
  const noGitPath = fixture();
  makeStructure(root);
  const target = path.join(root, "Nested");
  fs.mkdirSync(target, { recursive: true });

  const result = runWithFault(
    root,
    "lstat-replaced-after-read",
    target,
    { PATH: noGitPath },
  );
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
