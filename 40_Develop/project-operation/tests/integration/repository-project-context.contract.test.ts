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
import { parseRepositoryProjectContextMarkdown } from "../../src/index.ts";

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
