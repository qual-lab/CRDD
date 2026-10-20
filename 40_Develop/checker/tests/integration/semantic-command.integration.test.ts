/**
 * Semanticの公開API・CLIと保存の接続を検証する。
 * @packageDocumentation
 * @responsibility 明示した合成Repositoryで表示・保存・拒否と結果搬送を確認する。
 * @trace PPR-IT-018
 * @trace RCM-IT-005
 * @level IT
 * @scope semantic、cli、publication
 * @boundary PPR-IT-018=Related 2 Blocks: Checker→Domain→Filesystem。 / RCM-IT-005=Direct Boundary: CLI→公開API。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import test from "node:test";
import { runSemanticCoverage } from "../../src/index.ts";

/**
 * 不正引数をRepository観測前に拒否する。
 * @responsibility 新しい公開入口の引数拒否とRoot未確認を区別する。
 * @trace RCM-IT-005
 * @precondition 存在しないRootと不正引数。
 * @stimulus 公開APIへ渡す。
 * @observation 出力と終了Code。
 * @oracle 引数不正64、Root未検証2で成果物を返さない。
 * @cleanup N/A: 作成なし。
 * @boundary Direct Boundary: 公開API→Root検証。
 */
test("Semantic公開入口は不正引数と未検証Rootを成功へ丸めない", () => {
  let out = "",
    err = "";
  const request = {
    cwd: process.cwd(),
    writeOutput: (s: string) => {
      out += s;
    },
    writeError: (s: string) => {
      err += s;
    },
  };
  assert.equal(
    runSemanticCoverage({ ...request, arguments: ["--unknown"] }).exitCode,
    64,
  );
  assert.equal(out, "");
  assert.match(err, /semantic_arguments_invalid/);
  err = "";
  assert.equal(
    runSemanticCoverage({
      ...request,
      arguments: [
        "--root",
        "missing-semantic-root",
        "--architecture",
        "sample=design.md",
      ],
    }).exitCode,
    2,
  );
  assert.equal(out, "");
  assert.match(err, /repository_root_unverified/);
  err = "";
  assert.equal(runSemanticCoverage({ ...request, arguments: [] }).exitCode, 64);
  assert.match(err, /semantic_architecture_required/);
  for (const value of ["sample", "=design.md", "sample=", "Sample=design.md"]) {
    assert.equal(
      runSemanticCoverage({ ...request, arguments: ["--architecture", value] })
        .exitCode,
      64,
    );
  }
});

/**
 * 合成入力を公開CLIから表示・保存し、失敗後も既存結果を保持する。
 * @responsibility Domain移管後も明示保存と一次診断の公開接続を検証する。
 * @trace PPR-IT-018
 * @precondition Repository-localな合成Git Repositoryと最小の可視表。
 * @stimulus 公開CLIで表示・保存・欠測・保存先不正を順に実行する。
 * @observation JSON、Exit Code、Snapshot、一時File。
 * @oracle 表示は書込まず、明示保存のみ成功、欠測1・保存失敗2を返す。
 * @cleanup この試験が作ったRootだけをfinallyで回収する。
 * @boundary Related 2 Blocks: 公開CLI→Domain→実Filesystem。
 */
test("Semantic公開CLIは表示と明示保存を分け失敗後のSnapshotを保持する", () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const parent = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "semantic-command-"));
  try {
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    fs.mkdirSync(path.join(root, "40_Develop"));
    fs.mkdirSync(
      path.join(root, "06_Architecture", "Definitions", "ARCH-000008"),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        root,
        "06_Architecture",
        "Definitions",
        "ARCH-000008",
        "architecture_definition.md",
      ),
      "# ARCH-000008\n",
    );
    for (const [area, name] of [
      ["billing", "design.md"],
      ["shipping", "design.md"],
    ]) {
      const dir = path.join(root, "06_Architecture", "Details", area as string);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, name as string),
        [
          "# 合成",
          "## 機械生成する意味要素",
          "| Semantic Key | 種別 | 要求する意味 | Architecture定義 | 検証要否 | 根拠節 | N/A理由 |",
          "|---|---|---|---|---|---|---|",
          `| \`${area}.synthetic\` | \`component\` | 合成値 | \`ARCH-000008\` | \`N/A\` | \`## 根拠\` | 合成入力 |`,
          "",
          "## 根拠",
          "合成。",
        ].join("\n"),
      );
    }
    for (const id of ["000001"]) {
      const dir = path.join(root, "07_Quality", "Definitions", `QA-${id}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "quality_definition.md"),
        "# 合成\n## Semantic Coverage Pilot\n| Local ID | Semantic Key |\n|---|---|\n",
      );
    }
    const registry = path.join(root, "07_Quality", "Registry");
    fs.mkdirSync(registry);
    const target = path.join(registry, "semantic-coverage-pilot.json");
    const inputs = [
      "--architecture",
      "billing=06_Architecture/Details/billing/design.md",
      "--architecture",
      "shipping=06_Architecture/Details/shipping/design.md",
      "--quality",
      "07_Quality/Definitions/QA-000001/quality_definition.md",
    ];
    const cli = path.join(
      repositoryRoot,
      "40_Develop",
      "checker",
      "bin",
      "checker.ts",
    );
    const view = spawnSync(
      process.execPath,
      [cli, "--semantic", "--root", root, ...inputs],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(view.status, 0, view.stderr);
    assert.equal(JSON.parse(view.stdout).semanticIrs.length, 2);
    assert.equal(fs.existsSync(target), false);
    for (const qualityPath of ["missing-quality.md", "../outside-quality.md"]) {
      const missingQuality = spawnSync(
        process.execPath,
        [
          cli,
          "--semantic",
          "--root",
          root,
          ...inputs,
          "--quality",
          qualityPath,
          "--write",
        ],
        { encoding: "utf8", windowsHide: true },
      );
      assert.equal(missingQuality.status, 1, missingQuality.stderr);
      assert.ok(
        JSON.parse(missingQuality.stderr).findings.some(
          (finding: { code: string }) =>
            finding.code === "semantic-source-unobservable",
        ),
      );
      assert.equal(fs.existsSync(target), false);
    }
    let outputError = "";
    assert.equal(
      runSemanticCoverage({
        cwd: root,
        arguments: ["--root", root, ...inputs],
        writeOutput: () => {
          throw new Error("synthetic output failure");
        },
        writeError: (value) => {
          outputError += value;
        },
      }).exitCode,
      2,
    );
    assert.equal(outputError, "semantic_coverage_output_failed\n");
    assert.equal(fs.existsSync(target), false);
    const write = spawnSync(
      process.execPath,
      [cli, "--semantic", "--root", root, ...inputs, "--write"],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(write.status, 0, write.stderr);
    assert.equal(JSON.parse(write.stdout).status, "created");
    const snapshot = fs.readFileSync(target, "utf8");
    assert.equal(
      JSON.parse(snapshot).contract,
      "crdd/semantic-coverage-pilot-bundle",
    );
    const source = path.join(
      root,
      "06_Architecture",
      "Details",
      "billing",
      "design.md",
    );
    const saved = fs.readFileSync(source, "utf8");
    fs.writeFileSync(source, "# 欠測\n");
    const invalid = spawnSync(
      process.execPath,
      [cli, "--semantic", "--root", root, ...inputs, "--write"],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(invalid.status, 1);
    assert.ok(JSON.parse(invalid.stderr).findings.length);
    assert.equal(fs.readFileSync(target, "utf8"), snapshot);
    fs.writeFileSync(source, saved);
    fs.unlinkSync(target);
    fs.mkdirSync(target);
    const failure = spawnSync(
      process.execPath,
      [cli, "--semantic", "--root", root, ...inputs, "--write"],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(failure.status, 2);
    assert.match(failure.stderr, /semantic_coverage_publication_failed/);
    assert.equal(fs.statSync(target).isDirectory(), true);
    assert.deepEqual(fs.readdirSync(registry), [
      "semantic-coverage-pilot.json",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  }
});
