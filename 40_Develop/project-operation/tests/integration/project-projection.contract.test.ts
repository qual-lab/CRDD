/**
 * Project Operationの部分状態投影を境界間で検証する。
 *
 * @packageDocumentation
 * @responsibility 複数Sourceの完全・欠測・制限・古い・競合・不明状態を一つのProject Viewへ安全に投影することを検証する。
 * @trace PPR-IT-002
 * @level IT
 * @scope project-operation、project-projection、partial-state、restricted-disclosure
 * @boundary PPR-IT-002=Direct Boundary: Source Reader→Project Management Projection。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { projectProjectOperationSources } from "../../src/index.ts";

/**
 * 不完全状態を正常へ畳まず、制限Sourceの詳細を公開しないことを検証する。
 *
 * @responsibility 六状態を同じProjectionへ搬送し、全体状態と項目別開示条件を相関して確認する。
 * @trace PPR-IT-002
 * @precondition 完全、欠測、制限、古い、競合および不明のSource観測を用意する。
 * @stimulus Source集合をProject Management Projectionへ渡す。
 * @observation 全体状態、項目順、個別状態および公開されたSource情報を観測する。
 * @oracle 全体はpartial、各状態は保持され、restrictedのSource、Revision、時点および値はnullとなる。
 * @cleanup N/A: 不変値だけを使用し外部資源を作成しない。
 * @boundary PPR-IT-002=Direct Boundary: Source Reader→Project Management Projection。
 */
test("不完全状態を保持し制限Sourceの詳細を公開しない", () => {
  const projection = projectProjectOperationSources("PRJ-001", "current", [
    {
      fieldId: "release",
      state: "complete",
      sourceId: "release-source",
      sourceRevision: "rev-1",
      observedAt: "2026-09-22T10:00:00.000Z",
      value: "v0.21.0",
    },
    {
      fieldId: "commercial",
      state: "restricted",
      sourceId: "mgmt-repo",
      value: "secret",
    },
    { fieldId: "topic", state: "missing" },
    {
      fieldId: "meeting",
      state: "stale",
      sourceId: "meeting-source",
      sourceRevision: "rev-2",
    },
    { fieldId: "quality", state: "conflicting", sourceId: "quality-source" },
    { fieldId: "roadmap", state: "unknown" },
  ]);

  assert.equal(projection.status, "partial");
  assert.deepEqual(
    projection.items.map((item) => item.state),
    ["complete", "restricted", "missing", "stale", "conflicting", "unknown"],
  );
  assert.deepEqual(projection.items[1], {
    fieldId: "commercial",
    state: "restricted",
    sourceId: null,
    sourceRevision: null,
    observedAt: null,
    value: null,
  });
  assert.equal(projection.items[0]?.sourceId, "release-source");
  assert.equal(projection.items[3]?.state, "stale");
});
