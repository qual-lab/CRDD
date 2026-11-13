/**
 * 明示受入の公開入口と同Owner保存を検証する。
 * @packageDocumentation
 * @responsibility 対象・世代・主体・一回適用を実Stateで確認する。
 * @trace PRL-IT-008
 * @level IT
 * @scope coordinator、domain-model、version-control
 * @boundary PRL-IT-008=Adjacent Blocks: 公開受入→State Writer→History
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { executeCoordinatorPublicAcceptanceDecision } from "../../src/decision/acceptance.ts";
import { COORDINATOR_ACCEPTANCE_DECISION_CONTRACT } from "../../src/decision/request.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/validation.ts";
import {
  createRepository,
  persistAcceptancePendingState,
} from "../fixtures/decision-state.ts";

/**
 * 公開受入の入力捕捉をRoot照会前に反証する。
 * @responsibility 未信頼要求の未知実行を認証済み主体からも許可しない。
 * @trace PRL-IT-008
 * @precondition 正規Principalだけを与え、Repositoryは作らない。
 * @stimulus Getter・Proxy・toJSON・循環要求を渡す。
 * @observation 入力拒否理由・記録未生成・Filesystem／未知実行到達数。
 * @oracle Root未確認の理由ではなく入力不正として停止し、Effectを発行しない。
 * @cleanup 外部資源なし。
 * @boundary 公開入口の入力検査。保存成立を示さない。
 */
test("公開受入の不正要求はRootの取得前に入力拒否する", (t) => {
  const read = t.mock.method(fs, "readFileSync", () => {
    throw new Error("unexpected_file_read");
  });
  const write = t.mock.method(fs, "writeFileSync", () => {
    throw new Error("unexpected_file_write");
  });
  const realpath = t.mock.method(fs.realpathSync, "native", () => {
    throw new Error("unexpected_root_lookup");
  });
  let traps = 0;
  const getter = Object.defineProperty({}, "target", {
    get() {
      traps++;
      return "objective";
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        traps++;
        return [];
      },
    },
  );
  const toJSON = {
    toJSON() {
      traps++;
      return {};
    },
  };
  const cycle: unknown[] = [];
  cycle.push(cycle);
  for (const input of [getter, proxy, toJSON, cycle]) {
    const result = executeCoordinatorPublicAcceptanceDecision(
      input,
      path.resolve(import.meta.dirname, "uncreated-input-boundary"),
      { principalId: "operator-a" },
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "orchestrator_acceptance_decision_request_invalid",
    );
    assert.ok("recordId" in result);
    assert.equal(result.recordId, null);
    assert.equal(result.cleanupConfirmed, true);
  }
  assert.equal(traps, 0);
  assert.equal(read.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(realpath.mock.callCount(), 0);
});

/**
 * 現在の対象への明示回答だけが一度適用されることを確認する。
 * @trace PRL-IT-008
 * @precondition 自己生成RepositoryにTask完了状態を保存済み。
 * @stimulus 対象・主体・世代・根拠の負例と正例を公開入口へ渡す。
 * @observation State bytes、判断結果、同一再送を確認する。
 * @oracle 負例Effect 0、正例一回適用、異なる回答を拒否する。
 * @cleanup 自己生成RepositoryをTest hookで回収する。
 */
test("公開受入は対象・世代・主体・根拠を検査し同一回答を一回だけ適用する", (t) => {
  const { root, revision } = createRepository(t);
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const state = persistAcceptancePendingState(
    root,
    binding,
    "acceptance",
    revision,
  );
  const input = {
    contract: COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
    decisionId: "acceptance-objective",
    blockerId: "blocker-acceptance-objective",
    sourceSpecId: "SPEC-000002",
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    repositoryRevision: revision,
    expectedGeneration: state.generation,
    target: "objective",
    targetId: "objective-acceptance",
    decision: "accept",
    criterionEvidenceIds: ["objective-criterion"],
    principalId: "operator-a",
  };
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  const readHistory = () => {
    try {
      return fs.readFileSync(
        path.join(root, ".crdd", "domain-model", "history.jsonl"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };
  const before = fs.readFileSync(file, "utf8");
  const beforeHistory = readHistory();
  for (const changes of [
    { sourceSpecId: "SPEC-999999" },
    { sourceSpecId: "SPEC-000006" },
    { sourceSpecId: "SPEC-000007" },
    { targetId: "different" },
    { expectedGeneration: state.generation - 1 },
    { repositoryRevision: "b".repeat(40) },
    { principalId: "operator-b" },
  ]) {
    const result = executeCoordinatorPublicAcceptanceDecision(
      { ...input, ...changes },
      root,
      { principalId: "operator-a" },
    );
    assert.equal(result.status, "blocked");
    assert.equal(fs.readFileSync(file, "utf8"), before);
    assert.deepEqual(readHistory(), beforeHistory);
  }
  assert.equal(
    executeCoordinatorPublicAcceptanceDecision(input, root).status,
    "blocked",
  );
  const held = executeCoordinatorPublicAcceptanceDecision(
    { ...input, decisionId: "proposal-held", decision: "wait" },
    root,
    { principalId: "operator-a" },
  );
  assert.equal(held.status, "completed", held.reason);
  const heldSnapshot = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(heldSnapshot.blockers[0].status, "active");
  const heldRecord = JSON.stringify(heldSnapshot.decisions[0]);
  const accepted = executeCoordinatorPublicAcceptanceDecision(input, root, {
    principalId: "operator-a",
  });
  assert.equal(accepted.status, "completed", accepted.reason);
  const after = fs.readFileSync(file, "utf8");
  const snapshot = JSON.parse(after);
  assert.equal(snapshot.blockers.length, 1);
  assert.equal(snapshot.decisions.length, 2);
  assert.equal(snapshot.blockers[0].status, "resolved");
  assert.equal(snapshot.blockers[0].currentDecisionId, input.decisionId);
  assert.equal(JSON.stringify(snapshot.decisions[0]), heldRecord);
  const late = executeCoordinatorPublicAcceptanceDecision(
    {
      ...input,
      decisionId: "late-proposal",
      blockerId: "late-blocker",
      decision: "wait",
      expectedGeneration: snapshot.projects.find(
        (p: { projectId: string }) => p.projectId === input.projectId,
      ).generation,
    },
    root,
    { principalId: "operator-a" },
  );
  assert.equal(late.status, "blocked");
  assert.equal(fs.readFileSync(file, "utf8"), after);
  const afterHistory = readHistory();
  const replay = executeCoordinatorPublicAcceptanceDecision(input, root, {
    principalId: "operator-a",
  });
  assert.equal(replay.status, "completed", replay.reason);
  assert.equal(fs.readFileSync(file, "utf8"), after);
  assert.deepEqual(readHistory(), afterHistory);
  for (const difference of [
    { decision: "return" },
    { criterionEvidenceIds: ["different-evidence"] },
  ]) {
    const conflict = executeCoordinatorPublicAcceptanceDecision(
      { ...input, ...difference },
      root,
      { principalId: "operator-a" },
    );
    assert.equal(conflict.status, "blocked");
    assert.equal(fs.readFileSync(file, "utf8"), after);
    assert.deepEqual(readHistory(), afterHistory);
  }
});
