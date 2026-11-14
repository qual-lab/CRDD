/**
 * 継続判断の要求・回答・閉鎖と同Owner保存を検証する。
 * @packageDocumentation
 * @responsibility 認証主体・Queue・State・Historyを実保存で結合する。
 * @trace PRL-IT-005、PRL-IT-014
 * @level IT
 * @scope coordinator、domain-model、version-control
 * @boundary PRL-IT-014=Adjacent Blocks: 公開判断→State Writer→History
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { type ExecutionStateSnapshot, readDecision } from "../../../execution-model/src/index.ts";
import { executeCoordinatorPublicDecision } from "../../src/decision/lifecycle.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { readCurrentCoordinatorState } from "../../src/state/query.ts";
import { createCurrentCoordinatorPersistencePorts } from "../../src/state/transaction.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/validation.ts";
import {
  createRepository,
  persistAcceptancePendingState,
} from "../fixtures/decision-state.ts";

/**
 * 回答から再計画／取消へ一度だけ進むことを確認する。
 * @trace PRL-IT-005、PRL-IT-014
 * @precondition Task失敗、Lease解放済みQueueを持つ。
 * @stimulus 要求、別主体、再送、履歴故障、回答を公開入口へ渡す。
 * @observation State bytes、Queue、回答・履歴を確認する。
 * @oracle AI再送0、履歴再入場でState保存0。
 * @cleanup 自己生成RepositoryをTest hookで回収する。
 */
test("継続要求から再計画待ち又は取消へ一回適用し履歴だけを再入場できる", (t) => {
  const { root, revision } = createRepository(t);
  const binding = deriveCoordinatorRepositoryBindingId(root);
  for (const selectedOption of ["resume", "cancel"] as const) {
    const projectId = `continuation-${selectedOption}`;
    const state = persistAcceptancePendingState(
      root,
      binding,
      projectId,
      revision,
      "failed",
    );
    const common = {
      decisionId: `decision-${projectId}`,
      projectId,
      milestoneId: state.milestoneId,
      generation: state.generation,
      repositoryRevision: revision,
    };
    const request = {
      ...common,
      operation: "request",
      blockerId: `blocker-${projectId}`,
      queueId: `queue-${projectId}`,
      question: "この作業を継続しますか",
      allowedOptions: ["resume", "cancel"],
    };
    const auth = { principalId: "operator-a" };
    const requested = executeCoordinatorPublicDecision(request, root, auth);
    assert.equal(requested.status, "completed", requested.reason);
    assert.equal(requested.decision?.status, "pending");
    const file = path.join(root, ".crdd", "domain-model", "state.json");
    const pending = fs.readFileSync(file, "utf8");
    assert.equal(
      executeCoordinatorPublicDecision(request, root, auth).status,
      "completed",
    );
    assert.equal(fs.readFileSync(file, "utf8"), pending);
    const answer = { ...common, operation: "answer", selectedOption };
    for (const [input, principal] of [
      [answer, "operator-b"],
      [{ ...answer, generation: state.generation + 1 }, "operator-a"],
      [{ ...answer, continuationCapability: "old-token" }, "operator-a"],
    ] as const) {
      assert.equal(
        executeCoordinatorPublicDecision(input, root, {
          principalId: principal,
        }).status,
        "blocked",
      );
      assert.equal(fs.readFileSync(file, "utf8"), pending);
    }
    let finalAnswer = answer;
    let firstAnswer: unknown;
    if (selectedOption === "resume") {
      const other = executeCoordinatorPublicDecision(
        {
          ...request,
          decisionId: "second-approval",
          blockerId: "second-blocker",
        },
        root,
        auth,
      );
      assert.equal(other.status, "completed", other.reason);
      const first = executeCoordinatorPublicDecision(answer, root, auth);
      assert.equal(first.status, "blocked");
      assert.equal(first.decision?.status, "answered");
      firstAnswer = first.decision?.result?.answer;
      const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.equal(
        snapshot.queueEntries.find(
          (q: { queueId: string }) => q.queueId === request.queueId,
        ).state,
        "human_decision_required",
      );
      assert.equal(
        snapshot.projects.find(
          (p: { projectId: string }) => p.projectId === projectId,
        ).generation,
        state.generation,
      );
      const read = readDecision(
        verifyRuntimePersistenceRepository(root),
        binding,
        request.decisionId,
      );
      assert.equal(read.status, "completed");
      if (read.status === "completed")
        assert.deepEqual(read.value, first.decision);
      const blockers = (snapshot as ExecutionStateSnapshot).blockers.filter(
        (b) =>
          b.target.projectId === projectId &&
          b.target.milestoneId === state.milestoneId,
      );
      assert.equal(blockers.length, 2);
      assert.ok(blockers.every((b) => b.status === "active"));
      finalAnswer = { ...answer, decisionId: "second-approval" };
    }
    const rename = fs.renameSync;
    const fault = t.mock.method(fs, "renameSync", ((from, to) => {
      if (String(from).endsWith("history.pending.jsonl"))
        throw Object.assign(new Error("synthetic history failure"), {
          code: "EACCES",
        });
      return Reflect.apply(rename, fs, [from, to]);
    }) as typeof rename);
    let result: ReturnType<typeof executeCoordinatorPublicDecision>;
    try {
      result = executeCoordinatorPublicDecision(finalAnswer, root, auth);
    } finally {
      fault.mock.restore();
    }
    assert.equal(result.decision?.status, "applied", result.reason);
    assert.equal(result.history?.status, "unconfirmed");
    const saved = fs.readFileSync(file, "utf8");
    const replay = executeCoordinatorPublicDecision(finalAnswer, root, auth);
    assert.equal(replay.status, "completed", replay.reason);
    assert.equal(replay.history?.status, "confirmed");
    assert.deepEqual(replay.decision, result.decision);
    assert.equal(fs.readFileSync(file, "utf8"), saved);
    const snapshot = JSON.parse(saved);
    if (selectedOption === "resume") {
      assert.deepEqual(
        snapshot.decisions.find(
          (d: { decisionId: string }) => d.decisionId === common.decisionId,
        ).result.answer,
        firstAnswer,
      );
      assert.ok(
        snapshot.blockers.every(
          (b: { status: string }) => b.status === "resolved",
        ),
      );
    }
    const queue = snapshot.queueEntries.find(
      (x: { queueId: string }) => x.queueId === request.queueId,
    );
    assert.equal(
      queue.state,
      selectedOption === "resume" ? "replan_required" : "cancelled",
    );
    assert.equal(queue.ownerGeneration, null);
    const observed = readCurrentCoordinatorState(root, binding, projectId);
    assert.ok(observed.value);
    assert.equal(observed.value.generation, state.generation + 1);
    assert.equal(
      executeCoordinatorPublicDecision(
        {
          ...common,
          operation: "close",
          status: "invalidated",
          reason: "too late",
        },
        root,
        auth,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), saved);
  }
});

/**
 * 閉鎖がQueueやBlockerを勝手に解消しないことを確認する。
 * @trace PRL-IT-014
 * @precondition pendingの継続判断を保存する。
 * @stimulus 無効化と同一再送、閉鎖後回答を要求する。
 * @observation 終端判断・Queue・Blocker・State bytes。
 * @oracle 回答・適用を拒否し待機解除を発行しない。
 * @cleanup 自己生成RepositoryをTest hookで回収する。
 */
test("明示無効化は判断を閉じるだけでBlockerとQueueを保持する", (t) => {
  const { root, revision } = createRepository(t),
    binding = deriveCoordinatorRepositoryBindingId(root);
  const state = persistAcceptancePendingState(
    root,
    binding,
    "closing",
    revision,
    "failed",
  );
  const common = {
    decisionId: "closing",
    projectId: "closing",
    milestoneId: state.milestoneId,
    generation: state.generation,
    repositoryRevision: revision,
  };
  const auth = { principalId: "operator-a" };
  const withHistoryFailure = (input: unknown) => {
    const rename = fs.renameSync;
    const fault = t.mock.method(fs, "renameSync", ((from, to) => {
      if (String(from).endsWith("history.pending.jsonl"))
        throw Object.assign(new Error("synthetic history failure"), {
          code: "EACCES",
        });
      return Reflect.apply(rename, fs, [from, to]);
    }) as typeof rename);
    try {
      return executeCoordinatorPublicDecision(input, root, auth);
    } finally {
      fault.mock.restore();
    }
  };
  const request = {
    ...common,
    operation: "request",
    blockerId: "blocker-closing",
    queueId: "queue-closing",
    question: "継続しますか",
    allowedOptions: ["resume"],
  };
  const requested = withHistoryFailure(request);
  assert.equal(requested.status, "completed", requested.reason);
  assert.equal(requested.history?.status, "unconfirmed");
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  const pending = fs.readFileSync(file, "utf8");
  const reentered = executeCoordinatorPublicDecision(request, root, auth);
  assert.equal(reentered.history?.status, "confirmed", reentered.reason);
  assert.deepEqual(reentered.decision, requested.decision);
  assert.equal(fs.readFileSync(file, "utf8"), pending);
  const close = {
    ...common,
    operation: "close",
    status: "invalidated",
    reason: "対象を中止した",
  };
  const result = withHistoryFailure(close);
  assert.equal(result.history?.status, "unconfirmed");
  assert.equal(result.status, "completed", result.reason);
  assert.equal(result.decision?.status, "invalidated");
  const saved = fs.readFileSync(file, "utf8");
  const closedReplay = executeCoordinatorPublicDecision(close, root, auth);
  assert.equal(closedReplay.status, "completed", closedReplay.reason);
  assert.equal(closedReplay.history?.status, "confirmed");
  assert.deepEqual(closedReplay.decision, result.decision);
  for (const operation of [
    { operation: "answer", selectedOption: "resume" },
    { operation: "apply" },
  ])
    assert.equal(
      executeCoordinatorPublicDecision({ ...common, ...operation }, root, auth)
        .status,
      "blocked",
    );
  assert.equal(fs.readFileSync(file, "utf8"), saved);
  const snapshot = JSON.parse(saved);
  assert.equal(snapshot.blockers[0].status, "active");
  assert.equal(snapshot.queueEntries[0].state, "human_decision_required");
  const nextRequest = {
    ...request,
    decisionId: "closing-next",
    allowedOptions: ["resume", "cancel"],
  };
  const wrongPrincipal = executeCoordinatorPublicDecision(nextRequest, root, {
    principalId: "operator-b",
  });
  assert.equal(wrongPrincipal.status, "blocked");
  assert.equal(fs.readFileSync(file, "utf8"), saved);
  const next = executeCoordinatorPublicDecision(nextRequest, root, auth);
  assert.equal(next.status, "completed", next.reason);
  const otherProblem = executeCoordinatorPublicDecision(
    {
      ...nextRequest,
      decisionId: "other-problem-proposal",
      blockerId: "blocker-other-problem",
      question: "別の未解決問題",
    },
    root,
    auth,
  );
  assert.equal(otherProblem.status, "completed", otherProblem.reason);
  const cancelled = executeCoordinatorPublicDecision(
    {
      ...common,
      decisionId: nextRequest.decisionId,
      operation: "answer",
      selectedOption: "cancel",
    },
    root,
    auth,
  );
  assert.equal(cancelled.status, "completed", cancelled.reason);
  assert.equal(
    cancelled.decision?.result?.status === "applied" &&
      cancelled.decision.result.application.blockerResolved,
    false,
  );
  const after = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(after.blockers.length, 2);
  assert.equal(after.decisions.length, 3);
  assert.deepEqual(after.decisions[0], snapshot.decisions[0]);
  assert.equal(after.blockers[0].status, "cancelled");
  assert.equal(after.blockers[1].status, "cancelled");
  assert.equal(after.blockers[1].cancelledByDecisionId, nextRequest.decisionId);
  assert.equal(after.decisions[2].status, "pending");
  const read = readDecision(
    verifyRuntimePersistenceRepository(root),
    binding,
    "other-problem-proposal",
  );
  assert.equal(read.status, "completed");
  if (read.status === "completed") assert.equal(read.value?.status, "pending");
  assert.equal(
    (after as ExecutionStateSnapshot).blockers.find(
      (b) => b.blockerId === "blocker-other-problem",
    )?.status,
    "cancelled",
  );
  assert.equal(after.queueEntries[0].state, "cancelled");
  const history = fs.readFileSync(
    path.join(root, ".crdd", "domain-model", "history.jsonl"),
    "utf8",
  );
  assert.ok(history.includes('"blockerId":"blocker-closing"'));
});

/**
 * 回答時の短命なLease競合が解消された後、元回答を変えず明示適用する。
 * @trace PRL-IT-014
 * @precondition pending判断の対象世代は不変。
 * @stimulus 実Lease取得中に回答し、解放後にapplyを要求する。
 * @observation 未適用理由・元回答・State改訂・履歴故障再入場。
 * @oracle 競合中適用0、解放後一回CAS、履歴再送のState保存0。
 * @cleanup Leaseをfinallyで解放し自己生成Repositoryを回収する。
 */
test("Lease競合で保持した回答を解放後に明示適用し履歴だけ再入場する", (t) => {
  const { root, revision } = createRepository(t),
    binding = deriveCoordinatorRepositoryBindingId(root);
  const state = persistAcceptancePendingState(
    root,
    binding,
    "later",
    revision,
    "failed",
  );
  const common = {
    decisionId: "later",
    projectId: "later",
    milestoneId: state.milestoneId,
    generation: state.generation,
    repositoryRevision: revision,
  };
  const auth = { principalId: "operator-a" };
  const requested = executeCoordinatorPublicDecision(
    {
      ...common,
      operation: "request",
      blockerId: "blocker-later",
      queueId: "queue-later",
      question: "継続しますか",
      allowedOptions: ["resume"],
    },
    root,
    auth,
  );
  assert.equal(requested.status, "completed", requested.reason);
  const ports = createCurrentCoordinatorPersistencePorts(root, binding);
  const acquired = ports.lease.acquire(
    "later",
    "queue-later",
    "project-operation",
  );
  assert.equal(acquired.status, "completed", acquired.reason);
  assert.ok(acquired.value);
  let answered: ReturnType<typeof executeCoordinatorPublicDecision>;
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  try {
    answered = executeCoordinatorPublicDecision(
      {
        ...common,
        operation: "answer",
        selectedOption: "resume",
        comment: "継続を依頼",
      },
      root,
      auth,
    );
    assert.equal(answered.decision?.status, "answered", answered.reason);
    assert.equal(answered.decision?.result?.status, "unapplied");
    const saved = fs.readFileSync(file, "utf8");
    assert.equal(
      executeCoordinatorPublicDecision(
        { ...common, operation: "apply" },
        root,
        auth,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), saved);
  } finally {
    assert.equal(acquired.value.release().status, "completed");
  }
  const rename = fs.renameSync;
  const fault = t.mock.method(fs, "renameSync", ((from, to) => {
    if (String(from).endsWith("history.pending.jsonl"))
      throw Object.assign(new Error("history failure"), { code: "EACCES" });
    return Reflect.apply(rename, fs, [from, to]);
  }) as typeof rename);
  let result: ReturnType<typeof executeCoordinatorPublicDecision>;
  try {
    result = executeCoordinatorPublicDecision(
      { ...common, operation: "apply" },
      root,
      auth,
    );
  } finally {
    fault.mock.restore();
  }
  assert.equal(result.decision?.status, "applied", result.reason);
  assert.equal(result.history?.status, "unconfirmed");
  assert.deepEqual(
    result.decision?.result?.answer,
    answered.decision?.result?.answer,
  );
  const saved = fs.readFileSync(file, "utf8");
  const replay = executeCoordinatorPublicDecision(
    { ...common, operation: "apply" },
    root,
    auth,
  );
  assert.equal(replay.history?.status, "confirmed", replay.reason);
  assert.deepEqual(replay.decision, result.decision);
  assert.equal(fs.readFileSync(file, "utf8"), saved);
});
