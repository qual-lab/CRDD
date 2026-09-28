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

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  parseRepositoryProjectContextMarkdown,
  parseRepositoryQualityProjectionMarkdown,
  parseRepositoryReleaseProjectionMarkdown,
} from "../../src/index.ts";

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
 * @boundary PPR-IT-019=Direct Boundary: PROJECT_CONTEXT.md→Project Operation Reader→Consumer Read Model
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
  assert.match(context.scenes[0]?.summary ?? "", /v0\.21\.0/u);
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
 * @boundary PPR-IT-019=Direct Boundary: PROJECT_CONTEXT.md→Project Operation Reader→Consumer Read Model
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
 * @boundary PPR-IT-019=Direct Boundary: Release Projection Markdown→Project Operation Reader→Consumer Read Model
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
 * @boundary PPR-IT-019=Direct Boundary: Release Projection Markdown→Project Operation Reader→Consumer Read Model
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

/** Current Quality Projectionを現在品質のRead Modelへ変換する。 */
test("現行Quality CenterをCurrent Quality Read Modelへ変換する", async () => {
  const markdown = await readFile(
    path.join(repositoryRoot, "07_Quality", "01_Quality_Center.md"),
    "utf8",
  );
  const projection = parseRepositoryQualityProjectionMarkdown(markdown);

  assert.equal(projection.target, "v0.22.0");
  assert.equal(projection.observed, "11 / 39");
  assert.equal(projection.unobserved, "28 / 39");
  assert.match(projection.knownGap, /Reality Audit/u);
  assert.match(projection.nextGate, /Blocking Finding 0/u);
});
