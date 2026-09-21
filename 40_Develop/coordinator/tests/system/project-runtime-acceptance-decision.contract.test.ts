/**
 * 公開Acceptance DecisionのSystem境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 公開入口→Project Runtime→耐久Decision Store→状態投影のAcceptance Decision全経路を検証する。
 * @trace PRL-ST-009
 * @level ST
 * @scope coordinator、project-runtime、runtime-data、repository-local-store
 * @boundary PRL-ST-009=System/E2E: 公開入口→Project Runtime→Acceptance Decision Store→状態投影
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createProjectRuntimeState,
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT,
  reserveProjectTaskStart,
  settleProjectTask,
  type ProjectRuntimeAcceptanceDecision,
  type ProjectRuntimeState,
} from "../../../project-runtime/src/index.ts";
import {
  executeProjectRuntimePublicAcceptanceDecision,
  executeProjectRuntimePublicStateQuery,
} from "../../src/composition/project-runtime-composition-root.ts";
import { createProjectRuntimePersistencePorts } from "../../src/security/project-runtime-durable-foundation.ts";
import { createProjectRuntimeWindowsDecisionStoreTestingAdapter } from "../../src/security/project-runtime-windows-decision-store.ts";

/**
 * Git管理された固定Repositoryを構築する。
 *
 * @responsibility System Testが使用する検証可能なRepository RootとRevisionを決定論的に作成する。
 * @trace PRL-ST-009
 * @precondition Git CLIを利用できる。
 * @stimulus 一つの追跡FileをCommitする。
 * @observation Repository RootとHEAD Revisionを返す。
 * @oracle RootがGit RepositoryでRevisionが40桁Hashとなる。
 * @cleanup 呼出し側のTest hookがRootを再帰削除する。
 * @boundary PRL-ST-009=System/E2E: Git Repository→Public Runtime Root検証
 */
function createRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-acceptance-st-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    ["-C", root, "config", "user.email", "test@example.invalid"],
    { windowsHide: true },
  );
  execFileSync("git", ["-C", root, "config", "user.name", "CRDD Test"], {
    windowsHide: true,
  });
  fs.writeFileSync(
    path.join(root, "README.md"),
    "acceptance fixture\n",
    "utf8",
  );
  execFileSync("git", ["-C", root, "add", "README.md"], {
    windowsHide: true,
  });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"], {
    windowsHide: true,
  });
  const revision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  return Object.freeze({ root, revision });
}

/**
 * Task完了後かつObjective受入前の状態を全世代耐久化する。
 *
 * @responsibility 下位Task完了と上位Acceptance Decisionを分離したSystem Test前提状態を作る。
 * @trace PRL-ST-009
 * @precondition RootとBindingが検証済みで、同じProject IDの状態が存在しない。
 * @stimulus State Machineを作成、予約、Handoff、開始、完了へ進め、各世代を書き込む。
 * @observation 最終状態はObjective=`integration_pending`、Milestone=`executing`となる。
 * @oracle Task完了だけでObjective／Milestoneがacceptedにならない。
 * @cleanup Repository Root削除によりRuntime Dataも削除する。
 * @boundary PRL-ST-009=System/E2E: Project Runtime State Machine→Repository-local State Store
 */
function persistAcceptancePendingState(
  root: string,
  repositoryBindingId: string,
  projectId: string,
  revision: string,
) {
  const state = createProjectRuntimeState({
    projectId,
    milestoneId: `milestone-${projectId}`,
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["milestone-criterion"],
    objectives: [
      {
        id: `objective-${projectId}`,
        acceptanceCriteria: ["objective-criterion"],
      },
    ],
    tasks: [
      {
        id: `task-${projectId}`,
        objectiveId: `objective-${projectId}`,
        dependencies: [],
        allowedPaths: ["README.md"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: `owner-${projectId}`,
  });
  assert.ok(state.state);
  const port = createProjectRuntimePersistencePorts(
    root,
    repositoryBindingId,
  ).state;
  let current: ProjectRuntimeState = state.state;
  assert.equal(port.writeState(current, 0).status, "completed");
  const transitions = [
    () =>
      reserveProjectTaskStart(
        current,
        current.generation,
        `task-${projectId}`,
        `attempt-${projectId}`,
        `authority-${projectId}`,
      ),
    () =>
      prepareProjectTaskHandoff(
        current,
        current.generation,
        `task-${projectId}`,
        `attempt-${projectId}`,
        `operation-${projectId}`,
      ),
    () =>
      observeProjectTaskStarted(
        current,
        current.generation,
        `task-${projectId}`,
        `attempt-${projectId}`,
        `operation-${projectId}`,
      ),
    () =>
      settleProjectTask(current, current.generation, {
        taskId: `task-${projectId}`,
        attemptId: `attempt-${projectId}`,
        operationId: `operation-${projectId}`,
        authorityBindingId: `authority-${projectId}`,
        outcome: "completed",
        cleanupConfirmed: true,
        recoveryObligations: [],
        recoveryUnresolved: false,
      }),
  ];
  for (const transition of transitions) {
    const next = transition();
    assert.ok(next.state);
    assert.equal(
      port.writeState(next.state, current.generation).status,
      "completed",
    );
    current = next.state;
  }
  assert.equal(current.objectives[0]?.state, "integration_pending");
  assert.equal(current.milestone.state, "executing");
  return current;
}

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
 * @boundary PRL-ST-009=System/E2E: Public Request→Acceptance Decision入口
 */
function decisionRequest(
  state: ProjectRuntimeState,
  target: "objective" | "milestone",
  decision: ProjectRuntimeAcceptanceDecision,
  suffix: string,
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT,
    decisionId: `decision-${state.projectId}-${suffix}`,
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
 * @cleanup Test終了時にRepositoryとDecision Store fixtureを削除する。
 * @boundary PRL-ST-009=System/E2E: 公開入口→Project Runtime→Acceptance Decision Store→状態投影
 */
test("公開入口からObjective受入後のMilestone三判断を一度だけ記録し投影する", (t) => {
  const repository = createRepository();
  t.after(() => fs.rmSync(repository.root, { recursive: true, force: true }));
  const decisionRoot = path.join(repository.root, ".authenticated-principal");
  fs.mkdirSync(decisionRoot);
  const authenticationStore =
    createProjectRuntimeWindowsDecisionStoreTestingAdapter(decisionRoot);
  /**
   * System試験用の認証済みPrincipalを返す。
   *
   * @responsibility Acceptance Decision公開入口へ固定Principalを決定論的に供給する。
   * @trace PRL-ST-009
   * @precondition Test Fixtureがoperator-aを判断主体として使用する。
   * @stimulus 公開入口から認証Callbackを呼び出す。
   * @observation completed状態とPrincipal IDを返す。
   * @oracle Principal IDがoperator-aで固定される。
   * @cleanup N/A: 外部資源または状態を作成しない。
   * @boundary PRL-ST-009=System/E2E: 公開入口→認証Callback
   */
  const authenticate = () =>
    Object.freeze({ status: "completed" as const, principalId: "operator-a" });
  /**
   * 状態照会用の認証済みPrincipalとDecision Storeを返す。
   *
   * @responsibility 状態投影へ同じPrincipalと耐久Storeを決定論的に供給する。
   * @trace PRL-ST-009
   * @precondition Test Fixtureが作成したauthenticationStoreを保持している。
   * @stimulus 状態照会公開入口から認証Callbackを呼び出す。
   * @observation completed状態、Principal IDおよびStoreを返す。
   * @oracle 判断記録と状態投影が同じStoreを参照する。
   * @cleanup N/A: Storeのcleanupは親Test Caseが所有する。
   * @boundary PRL-ST-009=System/E2E: 状態照会公開入口→認証Callback→Decision Store
   */
  const openStateQueryAuthentication = () =>
    Object.freeze({
      status: "completed" as const,
      principalId: "operator-a",
      store: authenticationStore,
    });

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
    const accepted = executeProjectRuntimePublicAcceptanceDecision(
      authenticate,
      objectiveRequest,
      repository.root,
      Object.freeze({ principalId: "operator-a" }),
    );
    assert.equal(accepted.status, "completed", accepted.reason);
    const statePort = createProjectRuntimePersistencePorts(
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
    const result = executeProjectRuntimePublicAcceptanceDecision(
      authenticate,
      milestoneRequest,
      repository.root,
      Object.freeze({ principalId: "operator-a" }),
    );
    assert.equal(result.status, "completed", result.reason);
    assert.equal(
      executeProjectRuntimePublicAcceptanceDecision(
        authenticate,
        milestoneRequest,
        repository.root,
        Object.freeze({ principalId: "operator-a" }),
      ).reason,
      "project_runtime_acceptance_decision_duplicate",
    );

    const projection = executeProjectRuntimePublicStateQuery(
      openStateQueryAuthentication,
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
