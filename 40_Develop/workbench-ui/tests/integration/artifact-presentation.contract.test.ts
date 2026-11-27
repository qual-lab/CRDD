/**
 * Owner成果物原文ModelのBrowser境界を検証する。
 * @packageDocumentation
 * @responsibility 種別・出所・閉fieldと原文全量保持を反証する。
 * @trace EST-IT-002
 * @trace RFD-IT-024
 * @level IT
 * @scope 表示前Model検査。認可と実読取りはHTTP試験が担当する。
 * @boundary JSONとBrowser表示。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateArtifactResource,
  validateViewResponse,
} from "../../src/api/response.ts";

/** 純粋な成果物応答から表示と戻り先を構成し、出所や種類の差では描画しない。 @trace EST-IT-002 */
test("成果物のREST応答は選択対象と一致した場合だけ画面モデルになる", () => {
  const resource = {
    repositoryId: "repo.a",
    scope: "shared",
    kind: "change",
    identity: "CHG-000301",
    markdown: "# 原文",
  };
  const read = (value: unknown) =>
    validateArtifactResource(value, "repo.a", "change", "CHG-000301");
  assert.equal(read(resource).selectedRepositoryId, "repo.a");
  assert.equal(
    read({ ...resource, scope: "single" }).selectedRepositoryId,
    null,
  );
  for (const mismatch of [
    { repositoryId: "repo.b" },
    { kind: "owner" },
    { identity: "CHG-000302" },
    { scope: "unknown" },
    { contract: "crdd/workbench/view/v1" },
  ])
    assert.throws(() => read({ ...resource, ...mismatch }));
});

/**
 * 同じRepositoryの原文だけを閉Modelへ受理する。
 * @responsibility 余剰field・別種別・別出所を拒否し、本文容量だけでは拒否しない。
 * @trace EST-IT-002
 * @trace RFD-IT-024
 * @precondition 元のReaderが検査した非秘密Model。
 * @stimulus 正規Modelのfieldと相関を一つずつ壊す。
 * @observation 受理または固定例外。
 * @oracle 正規原文は変更せず、欠測と不正を補完しない。
 * @cleanup N/A: メモリ内の値のみ。
 * @boundary HTTP成功やReaderの安全性をこの試験で証明しない。
 */
test("artifact Modelは出所・kindを検査し原文を容量で拒否しない", () => {
  const valid = {
    contract: "crdd/workbench/view/v1",
    view: "artifact",
    repositoryId: "repo.a",
    selectedRepositoryId: "repo.a",
    artifact: {
      kind: "change",
      identity: "CHG-000301",
      markdown: "# 原文\n<script>not executed</script>\n",
    },
  };
  assert.deepEqual(validateViewResponse(valid), valid);
  assert.equal(
    validateViewResponse({ ...valid, selectedRepositoryId: null }).view,
    "artifact",
  );
  for (const extra of [
    { root: "hidden" },
    { repositoryId: "" },
    { selectedRepositoryId: "repo.b" },
    { selectedRepositoryId: undefined },
  ])
    assert.throws(() => validateViewResponse({ ...valid, ...extra }));
  for (const extra of [
    { kind: "unknown" },
    { identity: "99_Roadmap/01_Roadmap.md" },
    { markdown: null },
    { root: "hidden" },
  ])
    assert.throws(() =>
      validateViewResponse({
        ...valid,
        artifact: { ...valid.artifact, ...extra },
      }),
    );
  const largeMarkdown = "あ".repeat(174763);
  const large = validateViewResponse({
    ...valid,
    artifact: { ...valid.artifact, markdown: largeMarkdown },
  });
  assert.equal(large.view, "artifact");
  if (large.view === "artifact")
    assert.equal(large.artifact.markdown, largeMarkdown);
  const owner = {
    ...valid,
    artifact: {
      kind: "owner",
      identity: "99_Roadmap/01_Roadmap.md",
      markdown: "# 原文",
    },
  };
  assert.deepEqual(validateViewResponse(owner), owner);
  for (const identity of [
    "../outside.md",
    "/outside.md",
    "C:\\outside.md",
    "https://example.invalid/a.md",
    "a//b.md",
    "a\0b.md",
    "a.txt",
    "",
  ])
    assert.throws(() =>
      validateViewResponse({
        ...owner,
        artifact: { ...owner.artifact, identity },
      }),
    );
});
