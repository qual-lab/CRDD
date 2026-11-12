/**
 * 公開Acceptance DecisionのSystem境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 公開入口→Coordinator→Domain単一State Writer／History→状態投影のAcceptance Decision全経路を検証する。
 * @trace PRL-ST-009
 * @level ST
 * @scope coordinator、orchestrator、runtime-data、repository-local-store
 * @boundary PRL-ST-009=System/E2E: 公開入口→Coordinator→Domain単一State Writer／History→状態投影
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type {
  CoordinatorAcceptanceDecision,
  CoordinatorState,
} from "../../../domain-model/src/index.ts";
import { executeCoordinatorPublicAcceptanceDecision } from "../../src/decision/acceptance.ts";
import { COORDINATOR_ACCEPTANCE_DECISION_CONTRACT } from "../../src/decision/request.ts";
import { executeCoordinatorPublicStateQuery } from "../../src/state/query.ts";
import { createCurrentCoordinatorPersistencePorts } from "../../src/state/transaction.ts";
import {
  createRepository,
  persistAcceptancePendingState,
} from "../fixtures/decision-state.ts";

/**
 * Acceptance Decision公開要求を構築する。
 *
 * @responsibility Objective／Milestoneのexact Identity、世代、根拠および認証Principalを同じ要求へ結合する。
 * @trace PRL-ST-009
 * @precondition stateは対象Projectの最新状態である。
 * @stimulus 対象と判断を指定する。
 * @observation Public Acceptance Decision Contract準拠要求を返す。
 * @oracle SourceはSPEC-000002に固定される。
 * @cleanup N/A: Plain Dataだけを構築する。
 * @boundary PRL-ST-009=Direct Boundary: coordinator Test Source→対象契約
 */
function decisionRequest(
  state: CoordinatorState,
  target: "objective" | "milestone",
  decision: CoordinatorAcceptanceDecision,
  suffix: string,
) {
  return Object.freeze({
    contract: COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
    decisionId: `decision-${state.projectId}-${suffix}`,
    blockerId: `blocker-${state.projectId}-${target}`,
    sourceSpecId: "SPEC-000002",
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    repositoryRevision: state.repositoryRevision,
    expectedGeneration: state.generation,
    target,
    targetId:
      target === "objective"
        ? (state.objectives[0]?.definition.id ?? "")
        : state.milestoneId,
    decision,
    criterionEvidenceIds: Object.freeze([
      target === "objective" ? "objective-criterion" : "milestone-criterion",
    ]),
    principalId: "operator-a",
  });
}

/**
 * Objective受入後のMilestone受入・差戻し・判断待ちを公開入口から耐久記録し、投影することを検証する。
 *
 * @responsibility PRL-ST-009の三判断分岐、非推定、Store一回性および読取り投影を同じSystem境界で判定する。
 * @trace PRL-ST-009
 * @precondition 三ProjectはTask完了済みだがObjective／Milestone未受入である。
 * @stimulus 各ProjectでObjectiveを受入後、Milestoneをaccept／return／waitへ分岐する。
 * @observation 公開結果、耐久Record、状態投影および重複拒否を観測する。
 * @oracle 各判断は一度だけ記録され、Projectionはaccepted／returned／integratingを区別する。
 * @cleanup Test終了時に自己生成RepositoryとそのState／Historyを回収する。
 * @boundary PRL-ST-009=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開入口からObjective受入後のMilestone三判断を一度だけ記録し投影する", (t) => {
  const repository = createRepository(t);
  for (const [decision, expectedMilestoneState] of [
    ["accept", "accepted"],
    ["return", "returned"],
    ["wait", "integrating"],
  ] as const) {
    const projectId = `project-${decision}`;
    const bindingId = `binding-${createHash("sha256")
      .update(repository.root)
      .digest("hex")
      .slice(0, 40)}`;
    let state = persistAcceptancePendingState(
      repository.root,
      bindingId,
      projectId,
      repository.revision,
    );
    const objectiveRequest = decisionRequest(
      state,
      "objective",
      "accept",
      "objective",
    );
    const accepted = executeCoordinatorPublicAcceptanceDecision(
      objectiveRequest,
      repository.root,
      Object.freeze({ principalId: "operator-a" }),
    );
    assert.equal(accepted.status, "completed", accepted.reason);
    const statePort = createCurrentCoordinatorPersistencePorts(
      repository.root,
      bindingId,
    ).state;
    const observed = statePort.readState(projectId);
    assert.equal(observed.status, "completed");
    assert.ok(observed.value);
    state = observed.value;
    assert.equal(state.objectives[0]?.state, "accepted");
    assert.equal(state.milestone.state, "integrating");

    const milestoneRequest = decisionRequest(
      state,
      "milestone",
      decision,
      `milestone-${decision}`,
    );
    const originalRename = fs.renameSync;
    const historyFault =
      decision === "wait"
        ? t.mock.method(fs, "renameSync", ((from, to) => {
            if (String(from).endsWith("history.pending.jsonl"))
              throw Object.assign(
                new Error("synthetic decision history failure"),
                { code: "EACCES" },
              );
            return Reflect.apply(originalRename, fs, [from, to]);
          }) as typeof originalRename)
        : null;
    let result: ReturnType<typeof executeCoordinatorPublicAcceptanceDecision>;
    try {
      result = executeCoordinatorPublicAcceptanceDecision(
        milestoneRequest,
        repository.root,
        Object.freeze({ principalId: "operator-a" }),
      );
    } finally {
      historyFault?.mock.restore();
    }
    assert.equal(result.status, "completed", result.reason);
    assert.ok("history" in result && "decision" in result);
    assert.ok(
      result.history &&
        typeof result.history === "object" &&
        "status" in result.history,
    );
    assert.ok(
      result.decision &&
        typeof result.decision === "object" &&
        "status" in result.decision,
    );
    assert.equal(
      result.history.status,
      decision === "wait" ? "unconfirmed" : "confirmed",
    );
    assert.equal(result.decision.status, "applied");
    const stateFile = path.join(
      repository.root,
      ".crdd",
      "domain-model",
      "state.json",
    );
    const beforeResend = fs.readFileSync(stateFile);
    const resent = executeCoordinatorPublicAcceptanceDecision(
      milestoneRequest,
      repository.root,
      Object.freeze({ principalId: "operator-a" }),
    );
    assert.equal(resent.status, "completed", JSON.stringify(resent));
    assert.ok("history" in resent);
    assert.ok(
      resent.history &&
        typeof resent.history === "object" &&
        "status" in resent.history,
    );
    assert.equal(resent.history.status, "confirmed");
    assert.deepEqual(fs.readFileSync(stateFile), beforeResend);

    const projection = executeCoordinatorPublicStateQuery(
      Object.freeze({
        requestId: `query-${decision}`,
        projectId,
        repositoryRevision: repository.revision,
      }),
      repository.root,
      Object.freeze({ principalId: "operator-a" }),
    );
    assert.equal(projection.status, "completed");
    assert.equal(projection.projection?.milestoneState, expectedMilestoneState);
  }
});
