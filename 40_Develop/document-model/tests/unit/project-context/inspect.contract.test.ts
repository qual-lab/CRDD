/**
 * Project Contextの本文検査を所有Folderに対応して検証する。
 *
 * @packageDocumentation
 * @responsibility 五場面・Identity・ChecklistとManifest比較の既存受理集合を固定する。
 * @trace RCM-UT-014
 * @level UT
 * @scope project-context、inspection
 * @boundary RCM-UT-014=N/A: 読取り済み本文と比較値の純粋検査。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  inspectDocumentRelations,
  parseRepositoryProjectContextMarkdown,
} from "../../../src/index.ts";

/**
 * 参照を本文の出現順と出典付きで返し、診断と区別する。
 * @trace RCM-UT-014
 * @stimulus 本文・コード・コメント・参考形式・外部参照を混ぜる。
 * @oracle Artifactの従来の解析対象を削らず、一覧候補には本文の相対リンクだけを返す。
 */
test("Project Contextは共通Artifactから本文リンクと出典節を得る", () => {
  const markdown = [
    "[前文](intro.md)",
    "## 品質",
    "[品質](quality/main.md#current)",
    "<!--",
    "## コメントの節",
    "[非表示](comment.md)",
    "-->",
    "```markdown",
    "## コード例",
    "[例](example.md)",
    "```",
    "`[値](code.md)` [実際の参照](second.md)",
    "### 補足",
    "[外部](https://example.test/out.md) [越境](../out.md)",
    "[定義参照][q]",
    "[q]: reference.md",
    "## 次",
    "[再掲](quality/main.md)",
  ].join("\r\n");
  const parsed = parseRepositoryProjectContextMarkdown(markdown);
  assert.equal(parsed.status, "invalid");
  assert.deepEqual(parsed.artifactReferences, [
    { relativePath: "intro.md", sourceSection: null },
    { relativePath: "quality/main.md", sourceSection: "品質" },
    { relativePath: "second.md", sourceSection: "品質" },
    { relativePath: "quality/main.md", sourceSection: "次" },
  ]);
  assert.deepEqual(
    parsed.artifact.links
      .filter((link) =>
        ["comment.md", "code.md", "reference.md"].includes(link.target),
      )
      .map(({ target, location }) => [target, location.line]),
    [
      ["comment.md", 6],
      ["code.md", 12],
      ["reference.md", 15],
      ["reference.md", 15],
    ],
  );
});

/**
 * コメント内のフェンスで後続の本文参照を失わないことを確認する。
 * @trace RCM-UT-014
 * @oracle コメント後のリンクと出典行を返し、Checker用の既存リンク集合は変えない。
 */
test("コメント内のフェンスは後続の本文を隠さない", () => {
  const parsed = parseRepositoryProjectContextMarkdown(
    ["<!--", "```", "-->", "## 本文", "[`表示名`](visible.md)"].join("\n"),
  );
  assert.deepEqual(parsed.artifactReferences, [
    { relativePath: "visible.md", sourceSection: "本文" },
  ]);
  assert.equal(parsed.artifact.bodyInlineLinks[0]?.location.line, 5);
  assert.equal(
    parsed.artifact.links.some(({ target }) => target === "visible.md"),
    false,
  );
});

/**
 * 固定構造の肯定・否定・境界を検証する。
 *
 * @responsibility 見出し重複・順序・Identity空欄とTemplate別Checklistを確認する。
 * @trace RCM-UT-014
 * @precondition 正式Templateの本文を文字列で用意する。
 * @stimulus 一項目ずつ変更して検査する。
 * @observation 不一致の真偽値を取得する。
 * @oracle 元Templateと対応済み本文だけがfalseで、欠落・重複・順序違反はtrue。
 * @cleanup N/A: Fileを変更しない。
 * @boundary RCM-UT-014=N/A: 本文文字列だけを入力する。
 */
test("Project Context本文は既存の五場面とIdentity・Checklistを要求する", () => {
  const source = fs.readFileSync(
    new URL("../../../../../template/PROJECT_CONTEXT.md", import.meta.url),
    "utf8",
  );
  assert.equal(
    parseRepositoryProjectContextMarkdown(source, {
      mode: "template",
    }).issues.some(
      (issue) =>
        issue.kind === "artifact.project-context.projection-contract-invalid",
    ),
    false,
  );
  const current = source.replaceAll("- [ ] ", "- [x] ");
  assert.equal(
    parseRepositoryProjectContextMarkdown(current, {
      mode: "evaluated",
    }).issues.some(
      (issue) =>
        issue.kind === "artifact.project-context.projection-contract-invalid",
    ),
    false,
  );
  assert.equal(
    parseRepositoryProjectContextMarkdown(source, {
      mode: "evaluated",
    }).issues.some(
      (issue) =>
        issue.kind === "artifact.project-context.projection-contract-invalid",
    ),
    true,
  );
  for (const invalid of [
    "",
    source.replace("## 2. 何が危ない、または止まっているか", ""),
    `${source}\n## 1. 今どうなっているか`,
    source.replace(/^Project ID: .*$/mu, "Project ID: "),
    source.replace(
      "- [ ] Project ID、Repository IDおよびRepository Roleを評価した。",
      "",
    ),
    source.replace(
      "## 1. 今どうなっているか",
      "## 2. 何が危ない、または止まっているか",
    ),
  ])
    assert.equal(
      parseRepositoryProjectContextMarkdown(invalid, {
        mode: "template",
      }).issues.some(
        (issue) =>
          issue.kind === "artifact.project-context.projection-contract-invalid",
      ),
      true,
    );
});

/**
 * Manifest比較の従来境界を検証する。
 *
 * @responsibility Backtick内のIdentity比較とSchema、重複の先頭採用を維持する。
 * @trace RCM-UT-014
 * @precondition v2 Manifestと三Identityの本文を用意する。
 * @stimulus Schema・値・本文を変える。
 * @observation 不一致booleanと入力契約外の例外を確認する。
 * @oracle 完全一致だけfalse、nullは元の例外として伝播する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-014=N/A: 局所値の比較。
 */
test("Project Context Identityはv2 Manifestと既存規則で比較する", () => {
  const source =
    "Project ID: `p`\nRepository ID: `r`\nRepository Role: `dev`\n";
  const manifest = {
    schema: "crdd/repository-manifest/v2",
    projectId: "p",
    repositoryId: "r",
    repositoryRole: "dev",
  };
  assert.equal(
    inspectDocumentRelations({
      kind: "project_context_identity",
      context: parseRepositoryProjectContextMarkdown(source),
      manifest: manifest,
    }).length > 0,
    false,
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "project_context_identity",
      context: parseRepositoryProjectContextMarkdown(source),
      manifest: {
        ...manifest,
        schema: "old",
      },
    }).length > 0,
    true,
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "project_context_identity",
      context: parseRepositoryProjectContextMarkdown(source),
      manifest: {
        ...manifest,
        projectId: "other",
      },
    }).length > 0,
    true,
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "project_context_identity",
      context: parseRepositoryProjectContextMarkdown(
        `${source}Project ID: \`other\``,
      ),
      manifest: manifest,
    }).length > 0,
    false,
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "project_context_identity",
      context: parseRepositoryProjectContextMarkdown(
        source.replaceAll("`", ""),
      ),
      manifest: manifest,
    }).length > 0,
    true,
  );
  assert.throws(
    () =>
      inspectDocumentRelations({
        kind: "project_context_identity",
        context: parseRepositoryProjectContextMarkdown(source),
        manifest: null as unknown as Record<string, unknown>,
      }).length > 0,
    TypeError,
  );
});
