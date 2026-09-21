/**
 * CROSのlocal同等性、AI入口解決およびHandoff境界を検証する。
 *
 * @packageDocumentation
 * @responsibility CROS可用性と入口差がCanonical契約を変えず、HandoffがIdentityとAuthorityを保つことを検証する。
 * @trace RFD-IT-009
 * @trace RFD-IT-011
 * @trace ERB-IT-010
 * @level IT
 * @scope cros、local-equivalence、ai-entry、handoff
 * @boundary 各Local Itemの直接境界をTest Case単位で定義する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createHandoff,
  executeRepositoryLocalOperation,
  resolveAiOperatingPlan,
  resumeHandoff,
} from "../../src/index.ts";

/**
 * CROS三状態でRepository-local操作の意味が変わらないことを検証する。
 * @responsibility 未設定・停止・利用可能の結果ContractとRepository結果を比較する。
 * @trace RFD-IT-009
 * @precondition 同じ操作Identity、現在値および更新値を用意する。
 * @stimulus 三つのCROS状態で同じ操作を実行する。
 * @observation Contract、結果および外部Effectを観測する。
 * @oracle Repository結果は一致し、CROS／Repository外Effectは0となる。
 * @cleanup N/A: 不変値だけを使用する。
 * @boundary RFD-IT-009=Related 2 Blocks: Local入口→任意CROS→Repository契約。
 */
test("CROSの状態にかかわらずRepository-local操作を同じ意味で実行する", () => {
  const results = (["unconfigured", "stopped", "available"] as const).map(
    (state) =>
      executeRepositoryLocalOperation(state, "update-topic", "old", "new"),
  );
  assert.deepEqual(
    results.map(({ contract, repositoryResult }) => ({
      contract,
      repositoryResult,
    })),
    [
      { contract: "crdd/repository-local-operation", repositoryResult: "new" },
      { contract: "crdd/repository-local-operation", repositoryResult: "new" },
      { contract: "crdd/repository-local-operation", repositoryResult: "new" },
    ],
  );
  assert.ok(
    results.every(
      (result) =>
        !result.crosEffectIssued && !result.outsideRepositoryEffectIssued,
    ),
  );
});

/**
 * 複数AI入口が同じCanonical Sourceと共通計画へ到達することを検証する。
 * @responsibility 入口固有差をConstraintへ限定しCanonical規範を再定義しない。
 * @trace RFD-IT-011
 * @precondition 同じSource Revisionと共通計画、異なる入口制約を用意する。
 * @stimulus Chat入口とCoding入口から計画を解決する。
 * @observation Source、Revision、共通Step、制約およびEffectを比較する。
 * @oracle Canonical Relationと共通Stepは一致し、差はentryConstraintsだけに現れる。
 * @cleanup N/A: 読取り値だけを使用する。
 * @boundary RFD-IT-011=Related 2 Blocks: AI入口→Canonical Source→行動計画。
 */
test("AI入口固有差を制約へ限定し同じCanonical Sourceへ到達する", () => {
  const chat = resolveAiOperatingPlan(
    "chat",
    "AGENTS.md",
    "rev-21",
    ["read", "plan"],
    ["no-write"],
  );
  const coding = resolveAiOperatingPlan(
    "coding",
    "AGENTS.md",
    "rev-21",
    ["read", "plan"],
    ["workspace-write"],
  );
  assert.deepEqual(chat.commonSteps, coding.commonSteps);
  assert.equal(chat.sourceId, coding.sourceId);
  assert.equal(chat.revision, coding.revision);
  assert.notDeepEqual(chat.entryConstraints, coding.entryConstraints);
  assert.equal(chat.canonicalSourceEffectIssued, false);
});

/**
 * HandoffがIdentityを保持し不一致・Authority拡大をEffect前で拒否することを検証する。
 * @responsibility SourceとDestinationのTask、Project、Revision、ContextおよびAuthorityを相関する。
 * @trace ERB-IT-010
 * @precondition 固定Handoffと正常・Revision不一致・Authority追加のDestinationを用意する。
 * @stimulus 各DestinationからHandoffへ再入場する。
 * @observation handoffId、理由およびDestination Effectを観測する。
 * @oracle 正常だけが同じIdentityでresumed、不一致とAuthority追加はEffect 0となる。
 * @cleanup N/A: Source RecordはsourceActive=falseで資源を所有しない。
 * @boundary ERB-IT-010=Related 2 Blocks: Source Runtime→Handoff→Destination Runtime。
 */
test("HandoffのIdentityを保持し不一致とAuthority拡大を拒否する", () => {
  const handoff = createHandoff(
    "handoff-1",
    "task-1",
    "PRJ-1",
    "rev-1",
    ["read"],
    { requirement: "REQ-1" },
  );
  const base = {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "rev-1",
    authorities: ["read"],
    requiredContext: { requirement: "REQ-1" },
  };
  assert.equal(resumeHandoff(handoff, base).status, "resumed");
  assert.equal(
    resumeHandoff(handoff, { ...base, revision: "rev-2" })
      .destinationEffectIssued,
    false,
  );
  assert.equal(
    resumeHandoff(handoff, { ...base, authorities: ["read", "write"] }).reason,
    "cros_handoff_authority_expansion",
  );
  assert.equal(handoff.sourceActive, false);
});
