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
  isProjectContextManifestIdentityInvalid,
  isProjectContextProjectionInvalid,
} from "../../../src/index.ts";

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
  assert.equal(isProjectContextProjectionInvalid(source, true), false);
  const current = source.replaceAll("- [ ] ", "- [x] ");
  assert.equal(isProjectContextProjectionInvalid(current, false), false);
  assert.equal(isProjectContextProjectionInvalid(source, false), true);
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
    assert.equal(isProjectContextProjectionInvalid(invalid, true), true);
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
    isProjectContextManifestIdentityInvalid(source, manifest),
    false,
  );
  assert.equal(
    isProjectContextManifestIdentityInvalid(source, {
      ...manifest,
      schema: "old",
    }),
    true,
  );
  assert.equal(
    isProjectContextManifestIdentityInvalid(source, {
      ...manifest,
      projectId: "other",
    }),
    true,
  );
  assert.equal(
    isProjectContextManifestIdentityInvalid(
      `${source}Project ID: \`other\``,
      manifest,
    ),
    false,
  );
  assert.equal(
    isProjectContextManifestIdentityInvalid(
      source.replaceAll("`", ""),
      manifest,
    ),
    true,
  );
  assert.throws(
    () =>
      isProjectContextManifestIdentityInvalid(
        source,
        null as unknown as Record<string, unknown>,
      ),
    TypeError,
  );
});
