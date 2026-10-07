/**
 * project-operation:test:repository-project-contextの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 固定Project Context Markdownを同じ五場面のRead Modelへ変換できることを検証する。
 * @trace PPR-IT-019
 * @level IT
 * @scope project-operation、project-context、consumer-reader
 * @boundary PPR-IT-019=Direct Boundary: PROJECT_CONTEXT.md→Project Operation Reader→Consumer Read Model
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  parseRepositoryProjectContextMarkdown,
  parseRepositoryQualityProjectionMarkdown,
  parseRepositoryReleaseProjectionMarkdown,
} from "../../src/project-context/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 現行Project ContextからIdentityと五場面を同じ意味で取得できることを検証する。
 *
 * @responsibility 人間向けMarkdownとConsumer Readerの固定構造同値性を判定する。
 * @trace PPR-IT-019
 * @precondition Repository Rootに現行PROJECT_CONTEXT.mdが存在する。
 * @stimulus 現行MarkdownをReaderへ入力する。
 * @observation Identity、場面順、先行要約、列名および行を観測する。
 * @oracle 三Identityと五場面を取得し、Link URLや独自Identityを結果へ追加しない。
 * @cleanup N/A: 読取りだけであり資源を保持しない。
 * @boundary PPR-IT-019=Direct Boundary: project-operation Test Source→対象契約
 */
test("現行Project Contextを五場面のRead Modelへ変換する", async () => {
  const markdown = await readFile(
    path.join(repositoryRoot, "PROJECT_CONTEXT.md"),
    "utf8",
  );
  const context = parseRepositoryProjectContextMarkdown(markdown);

  assert.deepEqual(
    {
      projectId: context.projectId,
      repositoryId: context.repositoryId,
      repositoryRole: context.repositoryRole,
    },
    {
      projectId: "qual-lab.crdd",
      repositoryId: "qual-lab.crdd-standard",
      repositoryRole: "crdd-standard",
    },
  );
  assert.deepEqual(
    context.scenes.map((scene) => scene.key),
    ["current", "risk", "decision", "reason", "next"],
  );
  assert.ok(context.scenes.every((scene) => scene.table.rows.length > 0));
  const currentSection = markdown.split("## 1. 今どうなっているか")[1];
  const currentSummary = currentSection
    ?.split("### 結論")[1]
    ?.trimStart()
    .split(/\r?\n\r?\n/u)[0];
  assert.ok(currentSummary, "現行場面の先行要約が存在する");
  assert.equal(
    context.scenes[0]?.summary,
    currentSummary
      .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
      .replace(/`([^`]+)`/gu, "$1"),
  );
  assert.doesNotMatch(JSON.stringify(context), /\.\.\//u);
});

/**
 * 不完全なProject Contextを推測補完せず拒否することを検証する。
 *
 * @responsibility Identity、場面または表の欠落を部分成功へ畳まない判定を所有する。
 * @trace PPR-IT-019
 * @precondition 固定契約の一部だけを持つMarkdownを用意する。
 * @stimulus Readerへ必須場面が欠けた本文を入力する。
 * @observation Error reasonを観測する。
 * @oracle 五場面を推測生成せずproject_context_scene_invalidで拒否する。
 * @cleanup N/A: 読取りだけであり資源を保持しない。
 * @boundary PPR-IT-019=Direct Boundary: project-operation Test Source→対象契約
 */
test("五場面が欠けたProject Contextを推測補完しない", () => {
  assert.throws(
    () =>
      parseRepositoryProjectContextMarkdown(`# Project Context

Project ID: \`project\`
Repository ID: \`repository\`
Repository Role: \`development\`

## 1. 今どうなっているか

| 項目 | 状態 |
|---|---|
| Current | complete |
`),
    /project_context_scene_invalid/u,
  );
});

/**
 * 現行Release ProjectionからPlanの固定項目を取得できることを検証する。
 *
 * @responsibility Release ProjectionとConsumer Readerの構造同値性を判定する。
 * @trace PPR-IT-019
 * @precondition Repository Rootに現行99_Roadmap/03_Releases.mdが存在する。
 * @stimulus 現行MarkdownをRelease Projection Readerへ入力する。
 * @observation Baseline、対象Version、期限、Risk、Scope、依存および判断を観測する。
 * @oracle v0.21.0からv0.22.0への現在計画を取得し、正本URLや推測値を追加しない。
 * @cleanup N/A: 読取りだけであり資源を保持しない。
 * @boundary PPR-IT-019=Direct Boundary: project-operation Test Source→対象契約
 */
test("現行Release ProjectionをProject Plan Read Modelへ変換する", async () => {
  const markdown = await readFile(
    path.join(repositoryRoot, "99_Roadmap", "03_Releases.md"),
    "utf8",
  );
  const projection = parseRepositoryReleaseProjectionMarkdown(markdown);

  assert.deepEqual(
    {
      publishedBaseline: projection.publishedBaseline,
      targetVersion: projection.targetVersion,
      targetReleaseDate: projection.targetReleaseDate,
      scheduleRisk: projection.scheduleRisk,
    },
    {
      publishedBaseline: "v0.21.0",
      targetVersion: "v0.22.0",
      targetReleaseDate: "2026-10-03",
      scheduleRisk: "高い",
    },
  );
  assert.deepEqual(
    projection.scope.map((item) => item.stage),
    ["Group B", "Group C", "Group D", "Release Gate"],
  );
  assert.deepEqual(
    projection.dependencies.map((item) => item.item),
    ["工程依存", "現在人間判断", "後続判断"],
  );
  assert.doesNotMatch(JSON.stringify(projection), /\.\.\//u);
});

/**
 * Release Projectionの必須項目欠落を推測補完せず拒否することを検証する。
 *
 * @responsibility 期限またはRisk欠落を暗黙の未設定へ畳まない判定を所有する。
 * @trace PPR-IT-019
 * @precondition 固定三表を持つが日程リスク行が欠けたMarkdownを用意する。
 * @stimulus Release Projection Readerへ不完全な本文を入力する。
 * @observation Error reasonを観測する。
 * @oracle Riskを推測せずrelease_projection_value_missingで拒否する。
 * @cleanup N/A: 読取りだけであり資源を保持しない。
 * @boundary PPR-IT-019=Direct Boundary: project-operation Test Source→対象契約
 */
test("必須項目が欠けたRelease Projectionを推測補完しない", () => {
  assert.throws(
    () =>
      parseRepositoryReleaseProjectionMarkdown(`# CRDD Releases

## 1. 現在状態

| 項目 | 現在値 | 正本 |
|---|---|---|
| 公開済みBaseline | v0.21.0 | owner |
| 次の対象 | v0.22.0 | owner |
| 目標リリース日 | 未設定 | owner |
| 現在の作業状態 | In Progress | owner |
| リリース判断 | 未実施 | owner |

## 2. 現在Scope

| 段階 | 範囲 | 現在状態 | 正本 |
|---|---|---|---|
| Group B | Scope | Planned | owner |

## 3. 依存と判断

| 項目 | 現在状態 | 次の処置／判断 |
|---|---|---|
| 工程依存 | N/A: 依存なし | 継続 |
`),
    /release_projection_value_missing/u,
  );
});

/**
 * 現行Quality CenterをCurrent Quality Read Modelへ変換するを検証する。
 *
 * @responsibility 現行Quality CenterをCurrent Quality Read Modelへ変換するを検証するの検証責務を所有する。
 * @trace PPR-IT-019
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 現行Quality CenterをCurrent Quality Read Modelへ変換するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary PPR-IT-019=Direct Boundary: project-operation Test Source→対象契約
 */
test("現行Quality CenterをCurrent Quality Read Modelへ変換する", async () => {
  const markdown = await readFile(
    path.join(repositoryRoot, "07_Quality", "01_Quality_Center.md"),
    "utf8",
  );
  const projection = parseRepositoryQualityProjectionMarkdown(markdown);

  for (const [label, value] of [
    ["全体状態", projection.overallState],
    ["現在対象", projection.target],
    ["観測済み", projection.observed],
    ["未観測", projection.unobserved],
    ["既知Gap", projection.knownGap],
    ["次Gate", projection.nextGate],
    ["現在人間判断", projection.humanDecision],
  ]) {
    assert.ok(value && value.length > 0);
    assert.ok(markdown.includes(`| ${label} | ${value} |`));
  }
});

/**
 * 固定品質Projectionの全fieldと欠測拒否を検証する。
 *
 * @responsibility 現在文書の可変な状態文に依存せず、固定Schemaの意味と欠測拒否を検証する。
 * @trace PPR-IT-019
 * @precondition 七項目を持つ固定Markdownと、一項目だけ欠いた反証を用意する。
 * @stimulus 固定Markdownと欠測MarkdownをReaderへ渡す。
 * @observation Read Modelの全fieldと欠測Errorを取得する。
 * @oracle 全fieldが固定値と一致し、欠測は推測せず拒否される。
 * @cleanup N/A: 文字列だけを扱い、外部資源を作成しない。
 * @boundary PPR-IT-019=Direct Boundary: 固定Quality Projection→Consumer Read Model。
 */
test("品質Projectionの固定Schemaを読み取り欠測を拒否する", () => {
  const markdown = `## Current Quality Projection

| 項目 | 現在値 | 根拠・次の処置 |
|---|---|---|
| 全体状態 | 検証中 | 固定根拠 |
| 現在対象 | v0.22.0 | 固定根拠 |
| 観測済み | 2 / 3 | 固定根拠 |
| 未観測 | 1 / 3 | 固定根拠 |
| 既知Gap | 人間評価待ち | 固定根拠 |
| 次Gate | 評価結果を確認 | 固定根拠 |
| 現在人間判断 | 残る一件の評価 | 固定根拠 |
`;
  const projection = parseRepositoryQualityProjectionMarkdown(markdown);
  assert.deepEqual(
    [
      projection.overallState,
      projection.target,
      projection.observed,
      projection.unobserved,
      projection.knownGap,
      projection.nextGate,
      projection.humanDecision,
    ],
    [
      "検証中",
      "v0.22.0",
      "2 / 3",
      "1 / 3",
      "人間評価待ち",
      "評価結果を確認",
      "残る一件の評価",
    ],
  );
  assert.equal(
    Object.values(projection.rationale).every((value) => value === "固定根拠"),
    true,
  );
  assert.throws(
    () =>
      parseRepositoryQualityProjectionMarkdown(
        markdown.replace("| 既知Gap | 人間評価待ち | 固定根拠 |\n", ""),
      ),
    /quality_projection_value_missing/u,
  );
});
