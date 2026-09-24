/**
 * CROS Context PackageとRuntime HandoffのSystem境界を検証する。
 *
 * @packageDocumentation
 * @responsibility provenance付き最小PackageとSource／Destination間の安全な再開を検証する。
 * @trace RFD-ST-010
 * @trace ERB-ST-013
 * @level ST
 * @scope cros、context-package、provenance、handoff、recovery
 * @boundary RFD-ST-010／ERB-ST-013=System/E2E。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createContextPackage,
  createHandoff,
  resumeHandoff,
} from "../../src/index.ts";

/**
 * 許可ScopeだけをPackage化し欠測・競合・制限を補完しないことを検証する。
 * @responsibility 複数Sourceのprovenance、Scopeおよび不完全状態をConsumer結果へ保持する。
 * @trace RFD-ST-010
 * @precondition 許可・Scope外・restricted・conflictingの項目を用意する。
 * @stimulus 目的限定Context Packageを生成してConsumer相当の読取りを行う。
 * @observation 項目、Source、Revision、Scope、状態および正本属性を観測する。
 * @oracle Scope外を含めず、制限値をnull、競合をconflictingのまま保ち、正本化しない。
 * @cleanup Packageは不変値として消費し外部Storeへ残さない。
 * @boundary RFD-ST-010=Related 2 Blocks: Projection→Package→Consumer。
 */
test("許可された最小Contextだけをprovenance付きでConsumerへ渡す", () => {
  const pack = createContextPackage(
    "pkg-1",
    "review",
    ["development"],
    [
      {
        key: "topic",
        value: "open",
        sourceId: "REPO-DEV",
        revision: "r1",
        scope: "development",
        state: "complete",
      },
      {
        key: "commercial",
        value: "secret",
        sourceId: "REPO-MGMT",
        revision: "r2",
        scope: "management",
        state: "complete",
      },
      {
        key: "restricted",
        value: "secret",
        sourceId: "REPO-DEV",
        revision: "r1",
        scope: "development",
        state: "restricted",
      },
      {
        key: "quality",
        value: null,
        sourceId: "REPO-DEV",
        revision: "r3",
        scope: "development",
        state: "conflicting",
      },
    ],
  );
  assert.deepEqual(
    pack.items.map((item) => item.key),
    ["topic", "restricted", "quality"],
  );
  assert.equal(pack.items[1]?.value, null);
  assert.equal(pack.items[1]?.sourceId, null);
  assert.equal(pack.items[2]?.state, "conflicting");
  assert.equal(pack.retainedAsSourceOfTruth, false);
});

/**
 * Runtime切断後も同じHandoff Identityで再開しAuthority差を拒否することを検証する。
 * @responsibility Source終了、Destination再開、拒否および二重実行0を一つのScenarioで相関する。
 * @trace ERB-ST-013
 * @precondition Source Runtimeが固定Contextとread AuthorityのHandoffを発行する。
 * @stimulus Destinationで正常再開し、別入力でAuthority追加を要求する。
 * @observation Source状態、Handoff Identity、Destination状態、理由およびEffectを観測する。
 * @oracle 正常時は同じIdentityで再開し、Authority追加はEffect 0、Sourceはinactiveのままとなる。
 * @cleanup Source二重実行0、拒否時Destination Effect 0を確認する。
 * @boundary ERB-ST-013=System/E2E: Source Runtime→Handoff→Destination Runtime。
 */
test("切断後に同じIdentityで再開しAuthority差をEffect前で拒否する", () => {
  const handoff = createHandoff(
    "handoff-system-1",
    "task-1",
    "PRJ-1",
    "revision-1",
    ["read"],
    { requirement: "REQ-1" },
  );
  const normal = resumeHandoff(handoff, {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "revision-1",
    authorities: ["read"],
    requiredContext: { requirement: "REQ-1" },
  });
  const expanded = resumeHandoff(handoff, {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "revision-1",
    authorities: ["read", "write"],
    requiredContext: { requirement: "REQ-1" },
  });
  const wrongRevision = resumeHandoff(handoff, {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "revision-2",
    authorities: ["read"],
    requiredContext: { requirement: "REQ-1" },
  });
  const wrongTask = resumeHandoff(handoff, {
    taskId: "task-2",
    projectId: "PRJ-1",
    revision: "revision-1",
    authorities: ["read"],
    requiredContext: { requirement: "REQ-1" },
  });
  const missingContext = resumeHandoff(handoff, {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "revision-1",
    authorities: ["read"],
    requiredContext: {},
  });
  assert.equal(handoff.sourceActive, false);
  assert.equal(normal.handoffId, handoff.handoffId);
  assert.equal(normal.status, "resumed");
  assert.equal(expanded.destinationEffectIssued, false);
  assert.equal(expanded.reason, "cros_handoff_authority_expansion");
  for (const rejected of [wrongRevision, wrongTask, missingContext]) {
    assert.equal(rejected.destinationEffectIssued, false);
    assert.equal(rejected.reason, "cros_handoff_context_mismatch");
  }
});
