/**
 * Owner成果物原文ModelのBrowser境界を検証する。
 * @packageDocumentation
 * @responsibility 種別・出所・閉field・UTF8容量を反証する。
 * @trace EST-IT-002
 * @trace RFD-IT-024
 * @level IT
 * @scope 表示前Model検査。認可と実読取りはHTTP試験が担当する。
 * @boundary JSONとBrowser表示。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectWorkbenchClientModel } from "../../src/shared/view/validation.ts";

/**
 * 同じRepositoryの原文だけを閉Modelへ受理する。
 * @responsibility 余剰field・別種別・別出所・過大本文を拒否する。
 * @trace EST-IT-002
 * @trace RFD-IT-024
 * @precondition 元のReaderが検査した非秘密Model。
 * @stimulus 正規Modelのfieldと相関を一つずつ壊す。
 * @observation 受理または固定例外。
 * @oracle 正規原文は変更せず、欠測と不正を補完しない。
 * @cleanup N/A: メモリ内の値のみ。
 * @boundary HTTP成功やReaderの安全性をこの試験で証明しない。
 */
test("artifact Modelは出所・kind・原文容量を閉検査する", () => {
  const valid = {
    contract: "crdd/workbench/client-model/v1",
    view: "artifact",
    logoPath: "/assets/crdd-brand-icon.jpg",
    repositoryId: "repo.a",
    selectedRepositoryId: "repo.a",
    artifact: {
      kind: "change",
      identity: "CHG-000301",
      markdown: "# 原文\n<script>not executed</script>\n",
    },
  };
  assert.deepEqual(inspectWorkbenchClientModel(valid), valid);
  assert.equal(
    inspectWorkbenchClientModel({ ...valid, selectedRepositoryId: null }).view,
    "artifact",
  );
  for (const extra of [
    { root: "hidden" },
    { repositoryId: "" },
    { selectedRepositoryId: "repo.b" },
    { selectedRepositoryId: undefined },
  ])
    assert.throws(() => inspectWorkbenchClientModel({ ...valid, ...extra }));
  for (const extra of [
    { kind: "unknown" },
    { identity: "99_Roadmap/01_Roadmap.md" },
    { markdown: null },
    { root: "hidden" },
    { markdown: "あ".repeat(174763) },
  ])
    assert.throws(() =>
      inspectWorkbenchClientModel({
        ...valid,
        artifact: { ...valid.artifact, ...extra },
      }),
    );
  const owner = {
    ...valid,
    artifact: {
      kind: "owner",
      identity: "99_Roadmap/01_Roadmap.md",
      markdown: "# 原文",
    },
  };
  assert.deepEqual(inspectWorkbenchClientModel(owner), owner);
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
      inspectWorkbenchClientModel({
        ...owner,
        artifact: { ...owner.artifact, identity },
      }),
    );
});
