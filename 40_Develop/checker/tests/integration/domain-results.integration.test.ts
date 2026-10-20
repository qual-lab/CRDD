/**
 * Domainの実結果を本番の検査・公開結果へ接続する。
 *
 * @packageDocumentation
 * @responsibility Schema不正・Graph部分成立・実Source欠測を診断と既存終了値へ搬送することを確認する。
 * @trace RCM-IT-011
 * @level IT
 * @scope domain-results、pipeline、public-entry
 * @boundary RCM-IT-011=Related 2 Blocks: Domainの実Producer→Checker検査・公開API→合成Repository。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  type ArtifactSchema,
  inspectArtifactSources,
  buildArtifactGraph,
  observeRealitySymbolRepository,
  parseMarkdownArtifact,
  validateArtifactSchema,
} from "../../../domain-model/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { runChecker, runSemanticCoverage } from "../../src/index.ts";
import { mapArtifactDomainIssueToCheckerFinding } from "../../src/report/convert.ts";
import { mapRealityDomainIssueToCheckerFinding } from "../../src/report/reality.ts";
import { mapSemanticDomainIssueToDiagnostic } from "../../src/report/semantic.ts";

/**
 * Repository内の専用Git試験領域を構築して回収する。
 *
 * @responsibility この呼出しが作ったexact Rootだけを試験へ渡し、終了後の不存在を確認する。
 * @trace RCM-IT-011
 * @precondition 実CRDD Repository内の試験Fileから起動する。
 * @stimulus 合成Rootを作成しcallbackを同期実行する。
 * @observation callbackのassertionとRoot不存在を確認する。
 * @oracle 正常・例外のどちらも自己生成Root以外を変更しない。
 * @cleanup finallyで自己生成Rootを削除し不存在を確認する。
 * @boundary RCM-IT-011=Direct Boundary: 試験→Git初期化・Filesystem。
 */
function withRepository(runOperation: (root: string) => void): void {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "domain-results-"));
  try {
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    for (const folder of [
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
    ])
      fs.mkdirSync(path.join(root, folder));
    runOperation(root);
  } finally {
    assert.equal(path.dirname(root), parent);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  }
}

/**
 * Schemaの不正とGraphの部分成立をDomain検査と本番変換へ接続する。
 *
 * @responsibility 実Producerのstatus・result・Issueと本番診断を対応付ける。
 * @trace RCM-IT-011
 * @precondition 同じIDを持つ二Sourceと必須Section欠落を用意する。
 * @stimulus Domain公開ProducerとDomain検査と本番変換へ同じ入力を渡す。
 * @observation invalid／partial、結果有無、診断全fieldと利用可能なGraphを取得する。
 * @oracle 不正Schemaの診断と部分Graphの診断を保持し、Graph自体を結果に保持する。
 * @cleanup N/A: Process内の不変入力だけを使う。
 * @boundary RCM-IT-011=Direct Boundary: Domain公開Producer→Domain検査と本番変換。
 */
test("実Schema不正とGraph部分成立はDomain検査と本番変換の診断へ届く", () => {
  const sources = ["one.md", "two.md"].map((path) => ({
    path,
    content: "# REQ-000001\n要求ID: REQ-000001\n",
  }));
  const artifacts = sources.map(parseMarkdownArtifact);
  const schema: ArtifactSchema = {
    id: "fixed",
    matches: () => true,
    requiredSections: ["Checklist"],
  };
  const schemaResults = artifacts.map((artifact) =>
    validateArtifactSchema(artifact, schema),
  );
  assert.ok(
    schemaResults.every(
      ({ status, result }) => status === "invalid" && result === null,
    ),
  );
  const graph = buildArtifactGraph({ artifacts });
  assert.equal(graph.status, "partial");
  assert.notEqual(graph.result, null);
  const result = inspectArtifactSources({ sources, schemas: [schema] });
  assert.deepEqual(
    result.issues.map(mapArtifactDomainIssueToCheckerFinding),
    [...schemaResults.flatMap(({ issues }) => issues), ...graph.issues].map(
      mapArtifactDomainIssueToCheckerFinding,
    ),
  );
  assert.deepEqual(
    result.issues
      .map(mapArtifactDomainIssueToCheckerFinding)
      .map(({ code }) => code),
    [
      "artifact-schema-section-missing",
      "artifact-schema-section-missing",
      "artifact-canonical-id-duplicate",
    ],
  );
  assert.deepEqual(result.graph, graph.result);
  assert.equal(result.artifacts.length, 2);
  assert.deepEqual(
    inspectArtifactSources({ sources: sources.slice(0, 1), schemas: [] })
      .issues,
    [],
  );
});

/**
 * 本番の三診断変換が未知kindを拒否することを確認する。
 *
 * @responsibility Domainで構造上許可する未知kindを表示境界が正常診断へ丸めないことを確認する。
 * @trace RCM-IT-011
 * @precondition 中立fieldを持つ未知kindを用意する。
 * @stimulus Artifact・Reality・Semanticの本番変換へ渡す。
 * @observation 各変換の固定例外を取得する。
 * @oracle 三変換すべてが未知kindを拒否する。
 * @cleanup N/A: Process内の不変入力だけを使う。
 * @boundary RCM-IT-011=Direct Boundary: 中立Issue→本番診断変換。
 */
test("本番の三診断変換は未知Issueを成功へ丸めない", () => {
  const issue = {
    kind: "future.issue",
    targetIdentity: "fixture",
    location: { path: "item.md" },
    reason: "future",
    details: {},
  };
  for (const [convert, reason] of [
    [
      mapArtifactDomainIssueToCheckerFinding,
      "unknown_artifact_domain_issue:future.issue",
    ],
    [
      mapRealityDomainIssueToCheckerFinding,
      "unknown_reality_domain_issue:future.issue",
    ],
    [
      mapSemanticDomainIssueToDiagnostic,
      "unknown_semantic_domain_issue:future.issue",
    ],
  ] as const)
    assert.throws(() => convert(issue), { message: reason });
});

/**
 * 文書不備とSemantic欠測が公開結果へ届くことを確認する。
 *
 * @responsibility Root APIで実入力を検査し、診断あり1と実行不能2を区別する。
 * @trace RCM-IT-011
 * @precondition 専用Git Rootと欠落参照を持つ合成文書を使う。
 * @stimulus 文書とSemanticの公開APIを表示専用で呼ぶ。
 * @observation 診断JSON・終了値・元文書と生成物の有無を取得する。
 * @oracle 文書不備1、Semantic欠測1、Root不正2を返しSnapshotを書かない。
 * @cleanup 専用RootはwithRepositoryが回収する。
 * @boundary RCM-IT-011=Related 2 Blocks: 公開API→本番検査→実Filesystem。
 */
test("文書不備とSemantic欠測は公開診断・終了値に届く", () => {
  withRepository((root) => {
    const source = "# Sample\n\n[missing](missing.md)\n";
    fs.writeFileSync(path.join(root, "sample.md"), source);
    let output = "";
    let error = "";
    const request = {
      arguments: ["--root", root, "--json", "--summary"],
      cwd: root,
      writeOutput: (value: string) => {
        output += value;
      },
      writeError: (value: string) => {
        error += value;
      },
    };
    assert.equal(runChecker(request).exitCode, 1);
    assert.equal(error, "");
    const report = JSON.parse(output);
    assert.ok(
      report.findings.some(
        (finding: { code: string }) => finding.code === "broken-link",
      ),
    );
    assert.ok(report.metrics.errors > 0);
    output = "";
    assert.equal(
      runSemanticCoverage({ ...request, arguments: ["--root", root] }).exitCode,
      1,
    );
    assert.equal(output, "");
    assert.ok(
      JSON.parse(error).findings.some(
        (finding: { code: string }) =>
          finding.code === "semantic-source-unobservable",
      ),
    );
    error = "";
    assert.equal(
      runSemanticCoverage({
        ...request,
        arguments: ["--root", path.join(root, "absent")],
      }).exitCode,
      2,
    );
    assert.match(error, /repository_root_unverified/u);
    assert.equal(fs.readFileSync(path.join(root, "sample.md"), "utf8"), source);
    assert.equal(
      fs.existsSync(path.join(root, "07_Quality", "Registry")),
      false,
    );
  });
});

/**
 * 実Source欠測がReality観測から公開文書診断へ届くことを確認する。
 *
 * @responsibility 合成Manifestの宣言だけを実測・成功とせず、実観測不能を本番Ruleで保持する。
 * @trace RCM-IT-011
 * @precondition 公式形態の専用RootにSourceが存在しないManifestを置く。
 * @stimulus Domainの実観測と文書公開APIを呼ぶ。
 * @observation 中立Issue、公開診断全field、終了値、Source不存在を取得する。
 * @oracle 同じ欠測の診断を公開し終了1、Sourceを自動生成しない。
 * @cleanup 専用RootはwithRepositoryが回収する。
 * @boundary RCM-IT-011=Related 2 Blocks: 実観測→Domain Issue→本番Rule→公開API。
 */
test("Realityの実Source欠測は公開診断と終了1へ届く", () => {
  withRepository((root) => {
    for (const folder of [
      "template",
      "06_Architecture/Definitions",
      "07_Quality/Definitions",
      "40_Develop/sample",
    ])
      fs.mkdirSync(path.join(root, folder), { recursive: true });
    fs.writeFileSync(path.join(root, "01_Principles.md"), "# Synthetic\n");
    fs.writeFileSync(
      path.join(root, "40_Develop/sample/symbol.json"),
      JSON.stringify({
        contract: "crdd/reality-symbol-manifest",
        contractRevision: 1,
        subsystem: "sample",
        symbols: [
          {
            symbolId: "sample.entry",
            kind: "file",
            path: "src/missing.ts",
            archIds: ["ARCH-000001"],
          },
        ],
      }),
    );
    const verified = verifyRepositoryRoot(root);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed")
      throw new Error("fixture_root_unverified");
    const observed = observeRealitySymbolRepository(verified.capability);
    const issue = observed.domainIssues.find(
      ({ kind }) => kind === "discovery.symbol.source-unobservable",
    );
    assert.ok(issue);
    const converted = mapRealityDomainIssueToCheckerFinding(issue);
    let output = "";
    let error = "";
    assert.equal(
      runChecker({
        arguments: ["--root", root, "--json", "--summary"],
        cwd: root,
        writeOutput: (value) => {
          output += value;
        },
        writeError: (value) => {
          error += value;
        },
      }).exitCode,
      1,
    );
    assert.equal(error, "");
    const report = JSON.parse(output);
    assert.equal(report.repository_mode, "official");
    assert.ok(
      report.findings.some(
        (finding: unknown) =>
          JSON.stringify(finding) ===
          JSON.stringify({ severity: "error", ...converted }),
      ),
    );
    assert.equal(
      fs.existsSync(path.join(root, "40_Develop/sample/src/missing.ts")),
      false,
    );
  });
});
