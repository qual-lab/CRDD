/**
 * 判断記録の固定CRUD候補を検証する。
 * @packageDocumentation
 * @responsibility 判断と対象状態のexact比較・対象外保持・後日適用・閉鎖を反証する。
 * @trace PRL-UT-007
 * @trace PRL-UT-015
 * @level UT
 * @scope 合成Snapshotの判断要求・回答・適用・閉鎖・履歴候補。
 * @boundary 値操作だけ。実保存・現在認可・人間判断の真正性は別試験が所有する。
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  Blocker,
  DecisionAnswer,
  DecisionApplication,
  DecisionRequest,
} from "../../../src/decision/types.ts";
import {
  inspectDecision,
  inspectDecisionHistoryEvent,
  prepareDecisionAnswer,
  prepareDecisionApplication,
  prepareDecisionApplying,
  prepareDecisionClosing,
  prepareDecisionClosure,
  prepareDecisionCreation,
  prepareDecisionRecording,
  prepareDecisionRequest,
  prepareDecisionRetirement,
  prepareDecisionSubmission,
  projectDecisionHistory,
  validateDecisionCollections,
  validateDecisionRetirement,
  validateDecisionSnapshotTransition,
} from "../../../src/decision/validation.ts";
import type { Snapshot } from "../../../src/state/types.ts";
import { encodeStateValue } from "../../../src/state/value.ts";

/**
 * 判断モデルの検査を上位要求の検査から分離する。
 * @responsibility 保存用の符号化・履歴投影を上位に要求せず同じモデル条件を検査する。
 * @trace PRL-UT-015
 * @precondition 通常の要求候補が生成した判断を使う。
 * @stimulus 正常値、不正状態、getter・Proxyを渡す。
 * @observation 不変Snapshot又はnullとgetter呼出し零。
 * @oracle 値の受理を認可や保存済みとは扱わない。
 * @cleanup 外部資源なし。
 * @boundary 純粋モデル検査だけ。
 */
test("判断モデルの検査は上位要求に依存せず不正値を拒否する", () => {
  const created = prepareDecisionRequest(newDecisionFixture().request);
  assert.ok(created);
  const inspected = inspectDecision(created.decision);
  assert.deepEqual(inspected, created.decision);
  assert.ok(Object.isFrozen(inspected));
  assert.equal(
    inspectDecision({ ...created.decision, status: "unknown-state" }),
    null,
  );
  let reads = 0;
  const getter = Object.defineProperty({}, "decisionId", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("must not read");
    },
  });
  assert.equal(inspectDecision(getter), null);
  assert.equal(inspectDecision(new Proxy({}, {})), null);
  assert.equal(reads, 0);
});

import { decodeHistoryRows } from "../../../src/history/validation.ts";

import {
  PROJECT_SNAPSHOT_SCHEMA,
  queueIsClosed,
} from "../../../src/state/validation.ts";

/** 新判断候補に必要な空Stateを作る。保存・認可は含まない。 */
function fixture() {
  const current: Snapshot = {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 7,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [],
    queueEntries: [],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  return { current };
}

/** 新判断候補だけを検査する。保存・認可・実際のQueue遷移は含まない。
 * @trace PRL-UT-015
 */
function newDecisionFixture() {
  const request: DecisionRequest = {
    decisionId: "decision-new",
    blockerId: "blocker-new",
    respondentPrincipalId: "local.email.user@example.test",
    kind: "continuation",
    queueId: "queue-a",
    question: "範囲を縮小して再計画しますか？",
    options: [
      { value: "resume", label: "再計画して継続" },
      { value: "cancel", label: "取り消す" },
    ],
    requestedAt: "2026-11-11T00:00:00.000Z",
    target: {
      projectId: "project-a",
      milestoneId: "milestone-a",
      kind: "milestone",
      id: "milestone-a",
      generation: 2,
      repositoryRevision: "b".repeat(40),
    },
  };
  const answer: DecisionAnswer = {
    principalId: "local.email.user@example.test",
    answeredAt: "2026-11-11T01:00:00.000Z",
    selectedOption: "resume",
    reason: "対象範囲を縮小するため",
    evidenceIds: ["evidence-a"],
  };
  const application: DecisionApplication = {
    applicationId: "application-a",
    appliedAt: answer.answeredAt,
    beforeGeneration: 2,
    afterGeneration: 3,
    previousState: "human_decision_required",
    nextState: "executing",
    blockerResolved: true,
  };
  return { request, answer, application };
}

/**
 * 判断の自由本文と根拠集合を旧上限で拒否しない。
 * @responsibility 要求・回答・履歴の同じ本文を全量保持する。
 * @trace PRL-UT-015
 * @precondition 有効な対象・回答主体と257件の一意な根拠を使う。
 * @stimulus 旧8,192／1,024文字を超える本文と大きな根拠集合を渡す。
 * @observation 候補・履歴・公開要求の全量と不正集合の拒否。
 * @oracle 正常値を受理し、重複根拠と不正選択肢は拒否する。
 * @cleanup N/A: メモリ内の値だけ。
 * @boundary Domain判断候補と公開要求の検査。
 */
test("判断本文と根拠集合は容量だけで拒否せず履歴へ保持する", () => {
  const fixture = newDecisionFixture();
  const request = {
    ...fixture.request,
    question: "q".repeat(8193),
    options: fixture.request.options.map((option) => ({
      ...option,
      label: "l".repeat(1025),
    })),
  };
  const created = prepareDecisionRequest(request);
  assert.ok(created);
  const answer = {
    ...fixture.answer,
    reason: "r".repeat(8193),
    evidenceIds: Array.from({ length: 257 }, (_, index) => `evidence-${index}`),
  };
  const answered = prepareDecisionAnswer(
    created.decision,
    answer,
    fixture.application,
    null,
  );
  assert.ok(answered);
  assert.equal(answered.decision.result?.answer.evidenceIds.length, 257);
  assert.equal(answered.decision.result?.answer.reason, answer.reason);
  const history = projectDecisionHistory(answered.decision);
  assert.ok(history && history.length > 0);
  assert.equal(
    history.every((event) => inspectDecisionHistoryEvent(event) !== null),
    true,
  );
  assert.equal(
    prepareDecisionAnswer(
      created.decision,
      { ...answer, evidenceIds: ["same", "same"] },
      fixture.application,
      null,
    ),
    null,
  );
});

/**
 * 拒否・保留後の再提案と問題単位の退役を確認する。
 * @responsibility 一問題N提案・一提案一回答と履歴保全、片側除去拒否を検証する。
 * @trace PRL-UT-015
 * @precondition Objectiveの成果確認待ちを値で構成する。
 * @stimulus return又はwait、再提案、accept、退役を順に候補化する。
 * @observation 全提案、現在参照、Blocker状態、履歴と元本文。
 * @oracle 拒否・保留はOpen、承認適用だけ解消、全履歴確定前には退役しない。
 * @cleanup N/A: 値操作だけ。
 */
test("同じBlockerへ拒否・保留後に再提案し承認適用後だけ全提案を退役する", () => {
  for (const selectedOption of ["return", "wait"] as const) {
    const { current } = fixture(),
      { request, answer } = newDecisionFixture();
    const { queueId: _queueId, ...common } = request as Extract<
      DecisionRequest,
      { kind: "continuation" }
    >;
    const proposal: DecisionRequest = {
      ...common,
      kind: "acceptance",
      target: { ...request.target, kind: "objective", id: "objective-a" },
      options: [
        { value: "accept", label: "受入" },
        { value: "return", label: "拒否" },
        { value: "wait", label: "保留" },
      ],
    };
    const source = {
      ...current,
      projects: [
        {
          projectId: "project-a",
          milestoneId: "milestone-a",
          repositoryRevision: request.target.repositoryRevision,
          generation: 2,
          decisionApplicationId: null,
          milestone: {
            id: "milestone-a",
            state: "executing",
            criterionEvidenceIds: [],
          },
          objectives: [
            {
              definition: {
                id: "objective-a",
                acceptanceCriteria: ["criterion"],
              },
              state: "integration_pending",
              criterionEvidenceIds: [],
            },
          ],
          tasks: [],
        },
      ] as unknown as Snapshot["projects"],
    };
    for (const reversed of [false, true]) {
      const firstProposal: DecisionRequest = reversed
        ? { ...proposal, decisionId: "evidence-b", blockerId: "evidence-b" }
        : proposal;
      const secondProposal: DecisionRequest = reversed
        ? proposal
        : { ...proposal, decisionId: "evidence-b", blockerId: "evidence-b" };
      const first: ReturnType<typeof prepareDecisionCreation<Snapshot>> =
        prepareDecisionCreation(source, firstProposal);
      if (first.status !== "completed" || !first.value.next)
        throw Error("fixture");
      const second: ReturnType<typeof prepareDecisionCreation<Snapshot>> =
        prepareDecisionCreation(first.value.next, secondProposal);
      if (second.status !== "completed" || !second.value.next)
        throw Error("fixture");
      const answerFor = (id: string): DecisionAnswer => ({
        ...answer,
        selectedOption: "accept",
        evidenceIds: [id === proposal.decisionId ? "evidence-a" : "evidence-b"],
      });
      const early: ReturnType<typeof prepareDecisionSubmission<Snapshot>> =
        prepareDecisionSubmission(
          second.value.next,
          firstProposal.decisionId,
          answerFor(firstProposal.decisionId),
          answer.answeredAt,
        );
      if (early.status !== "completed" || !early.value.next)
        throw Error("fixture");
      const last: ReturnType<typeof prepareDecisionSubmission<Snapshot>> =
        prepareDecisionSubmission(
          early.value.next,
          secondProposal.decisionId,
          answerFor(secondProposal.decisionId),
          answer.answeredAt,
        );
      if (last.status !== "completed" || !last.value.next)
        throw Error("fixture");
      assert.ok(
        last.value.next.decisions.every((d) => d.status === "answered"),
      );
      assert.ok(last.value.next.blockers.every((b) => b.status === "active"));
      assert.deepEqual(last.value.next.projects, source.projects);
      for (const decision of last.value.next.decisions)
        assert.deepEqual(
          decision.result?.answer,
          answerFor(decision.decisionId),
        );
      assert.equal(
        validateDecisionSnapshotTransition(early.value.next, last.value.next),
        true,
      );
    }
    if (selectedOption === "return") {
      const a = prepareDecisionCreation(source, proposal);
      if (a.status !== "completed" || !a.value.next) throw Error("fixture");
      const proposalB: DecisionRequest = {
        ...proposal,
        decisionId: "problem-b-proposal",
        blockerId: "problem-b",
      };
      const b = prepareDecisionCreation(a.value.next, proposalB);
      if (b.status !== "completed" || !b.value.next) throw Error("fixture");
      const approvedA = prepareDecisionSubmission(
        b.value.next,
        proposal.decisionId,
        { ...answer, selectedOption: "accept" },
        answer.answeredAt,
      );
      if (approvedA.status !== "completed" || !approvedA.value.next)
        throw Error("fixture");
      assert.equal(approvedA.value.value.status, "answered");
      const rejectedB = prepareDecisionSubmission(
        approvedA.value.next,
        proposalB.decisionId,
        { ...answer, selectedOption: "return" },
        answer.answeredAt,
      );
      if (rejectedB.status !== "completed" || !rejectedB.value.next)
        throw Error("fixture");
      const revised = {
        ...rejectedB.value.next,
        projects: rejectedB.value.next.projects.map((p) => ({
          ...p,
          objectives: p.objectives.map((o) => ({
            ...o,
            state: "integration_pending" as const,
          })),
        })),
      };
      const currentProject = revised.projects[0];
      assert.ok(currentProject);
      const freshB: DecisionRequest = {
        ...proposalB,
        decisionId: "problem-b-revised",
        target: { ...proposal.target, generation: currentProject.generation },
        requestedAt: "2026-11-11T02:00:00.000Z",
      };
      const waitingB = prepareDecisionRecording(
        revised,
        freshB,
        { ...answer, selectedOption: "accept", answeredAt: freshB.requestedAt },
        freshB.requestedAt,
      );
      if (waitingB.status !== "completed" || !waitingB.value.next)
        throw Error("fixture");
      assert.equal(waitingB.value.value.status, "answered");
      assert.equal(
        waitingB.value.next.projects[0]?.objectives[0]?.state,
        "integration_pending",
      );
      const freshA: DecisionRequest = {
        ...proposal,
        decisionId: "problem-a-revised",
        target: freshB.target,
        requestedAt: "2026-11-11T03:00:00.000Z",
      };
      const acceptedAll = prepareDecisionRecording(
        waitingB.value.next,
        freshA,
        { ...answer, selectedOption: "accept", answeredAt: freshA.requestedAt },
        freshA.requestedAt,
      );
      if (acceptedAll.status !== "completed" || !acceptedAll.value.next)
        throw Error("fixture");
      assert.equal(
        acceptedAll.value.next.projects[0]?.objectives[0]?.state,
        "accepted",
      );
      assert.equal(
        validateDecisionSnapshotTransition(
          waitingB.value.next,
          acceptedAll.value.next,
        ),
        true,
      );
      assert.deepEqual(
        acceptedAll.value.next.decisions.find(
          (d) => d.decisionId === proposal.decisionId,
        ),
        approvedA.value.value,
      );
      const terminal = prepareDecisionCreation(acceptedAll.value.next, {
        ...proposal,
        decisionId: "late",
        blockerId: "late",
        target: {
          ...proposal.target,
          generation: currentProject.generation + 1,
        },
      });
      assert.equal(terminal.status, "blocked");
    }
    const first = prepareDecisionRecording(
      source,
      proposal,
      { ...answer, selectedOption },
      answer.answeredAt,
    );
    assert.equal(first.status, "completed");
    if (first.status !== "completed" || !first.value.next)
      throw Error("fixture");
    assert.equal(first.value.next.blockers[0]?.status, "active");
    const old = encodeStateValue(first.value.value);
    // return後の再統合は用途Ownerの別遷移。ここでは再統合済みの現在値だけを合成する。
    const ready = {
      ...first.value.next,
      projects: first.value.next.projects.map((p) => ({
        ...p,
        objectives: p.objectives.map((o) => ({
          ...o,
          state: "integration_pending" as const,
        })),
      })),
    };
    const readyProject = ready.projects[0];
    assert.ok(readyProject);
    const nextProposal: DecisionRequest = {
      ...proposal,
      decisionId: "proposal-b",
      requestedAt: "2026-11-11T02:00:00.000Z",
      target: { ...proposal.target, generation: readyProject.generation },
    };
    assert.equal(
      prepareDecisionCreation(ready, {
        ...nextProposal,
        respondentPrincipalId: "other-user",
      }).status,
      "blocked",
    );
    assert.equal(
      prepareDecisionCreation(ready, {
        ...nextProposal,
        target: { ...nextProposal.target, id: "other" },
      }).status,
      "blocked",
    );
    const second = prepareDecisionCreation(ready, nextProposal);
    assert.equal(second.status, "completed");
    if (second.status !== "completed" || !second.value.next)
      throw Error("fixture");
    const pending = second.value.next;
    assert.equal(pending.blockers.length, 1);
    assert.equal(pending.decisions.length, 2);
    assert.equal(
      validateDecisionCollections(pending.decisions, pending.blockers, [
        "project-a",
      ]),
      true,
    );
    assert.equal(validateDecisionSnapshotTransition(ready, pending), true);
    assert.equal(
      prepareDecisionCreation(pending, {
        ...nextProposal,
        decisionId: "proposal-c",
      }).status,
      "blocked",
    );
    assert.equal(prepareDecisionCreation(pending, proposal).value?.next, null);
    assert.equal(
      prepareDecisionSubmission(
        pending,
        proposal.decisionId,
        { ...answer, selectedOption: "accept" },
        "2026-11-11T03:00:00.000Z",
      ).status,
      "blocked",
    );
    assert.equal(
      prepareDecisionClosing(
        pending,
        proposal.decisionId,
        "invalidated",
        "2026-11-11T03:00:00.000Z",
        "遅延",
      ).status,
      "blocked",
    );
    const accepted = prepareDecisionSubmission(
      pending,
      nextProposal.decisionId,
      {
        ...answer,
        selectedOption: "accept",
        answeredAt: "2026-11-11T03:00:00.000Z",
      },
      "2026-11-11T03:00:00.000Z",
    );
    assert.equal(accepted.status, "completed");
    if (accepted.status !== "completed" || !accepted.value.next)
      throw Error("fixture");
    const done = accepted.value.next;
    assert.equal(done.blockers[0]?.status, "resolved");
    assert.equal(
      prepareDecisionCreation(done, {
        ...nextProposal,
        decisionId: "proposal-after-resolution",
      }).status,
      "blocked",
    );
    assert.equal(encodeStateValue(done.decisions[0]), old);
    assert.equal(
      validateDecisionCollections(done.decisions, done.blockers, ["project-a"]),
      true,
    );
    for (const record of done.decisions) {
      const events = projectDecisionHistory(record);
      assert.ok(events);
      for (const event of events)
        assert.equal(event.blockerId, proposal.blockerId);
    }
    assert.equal(
      prepareDecisionRetirement(done, (d) =>
        d.decisionId === proposal.decisionId ? null : "recorded",
      ).status,
      "blocked",
    );
    const retired = prepareDecisionRetirement(done, () => "recorded");
    assert.equal(retired.status, "completed");
    if (retired.status !== "completed" || !retired.value.next)
      throw Error("fixture");
    assert.equal(retired.value.value, 2);
    assert.equal(retired.value.next.blockers.length, 0);
    assert.equal(validateDecisionRetirement(done, retired.value.next), true);
    const firstDecision = done.decisions[0];
    assert.ok(firstDecision);
    assert.equal(
      validateDecisionRetirement(done, {
        ...retired.value.next,
        decisions: [firstDecision],
      }),
      false,
    );
  }
});

/**
 * 無効化した提案を残したまま、同じ問題への明示中止でQueueを終了する。
 * @responsibility 中止と解消を区別し、遅延適用・未確定履歴・部分退役を拒否する。
 * @trace PRL-UT-015
 * @precondition 対象Taskがなく、Lease資源不存在の有限観測を使用する。
 * @stimulus 無効化、再提案、取消回答、Queue終了、全履歴確定を候補化する。
 * @observation Blockerのcancelledと全提案の保全、終了可否。
 * @oracle 元提案が未適用でも終了でき、Openや未解放Leaseなら終了できない。
 * @cleanup N/A: メモリだけ。
 */
test("無効化後の再提案を中止すると解消扱いにせず古い提案を保ってQueueを終了できる", () => {
  const { current } = fixture(),
    { request, answer } = newDecisionFixture();
  const source = {
    ...current,
    projects: [
      {
        projectId: "project-a",
        milestoneId: "milestone-a",
        generation: 2,
        repositoryRevision: request.target.repositoryRevision,
        decisionApplicationId: null,
        milestone: {
          id: "milestone-a",
          state: "human_decision_required",
          criterionEvidenceIds: [],
        },
        objectives: [],
        tasks: [],
      },
    ] as unknown as Snapshot["projects"],
    queueEntries: [
      {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: request.target.repositoryRevision,
        generation: 1,
        state: "human_decision_required",
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
      },
    ] as unknown as Snapshot["queueEntries"],
  };
  const created = prepareDecisionCreation(source, request);
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const closed = prepareDecisionClosing(
    created.value.next,
    request.decisionId,
    "invalidated",
    answer.answeredAt,
    "別案に変更",
  );
  if (closed.status !== "completed" || !closed.value.next)
    throw Error("fixture");
  const nextRequest: DecisionRequest = {
    ...request,
    decisionId: "proposal-b",
    requestedAt: "2026-11-11T02:00:00.000Z",
  };
  const proposed = prepareDecisionCreation(closed.value.next, nextRequest);
  if (proposed.status !== "completed" || !proposed.value.next)
    throw Error("fixture");
  assert.equal(
    prepareDecisionApplying(
      proposed.value.next,
      request.decisionId,
      nextRequest.requestedAt,
    ).status,
    "blocked",
  );
  const another = prepareDecisionCreation(proposed.value.next, {
    ...nextRequest,
    decisionId: "proposal-other-problem",
    blockerId: "blocker-other-problem",
  });
  if (another.status !== "completed" || !another.value.next)
    throw Error("fixture");
  const approvedFirst = prepareDecisionSubmission(
    another.value.next,
    nextRequest.decisionId,
    {
      ...answer,
      selectedOption: "resume",
      answeredAt: nextRequest.requestedAt,
    },
    nextRequest.requestedAt,
  );
  if (approvedFirst.status !== "completed" || !approvedFirst.value.next)
    throw Error("fixture");
  assert.equal(approvedFirst.value.value.status, "answered");
  assert.deepEqual(
    approvedFirst.value.next.projects,
    another.value.next.projects,
  );
  assert.deepEqual(
    approvedFirst.value.next.queueEntries,
    another.value.next.queueEntries,
  );
  assert.ok(
    approvedFirst.value.next.blockers.every((b) => b.status === "active"),
  );
  const firstAnswer = approvedFirst.value.value.result?.answer;
  const approvedBoth = prepareDecisionSubmission(
    approvedFirst.value.next,
    "proposal-other-problem",
    {
      ...answer,
      selectedOption: "resume",
      answeredAt: nextRequest.requestedAt,
    },
    nextRequest.requestedAt,
  );
  if (approvedBoth.status !== "completed" || !approvedBoth.value.next)
    throw Error("fixture");
  assert.equal(approvedBoth.value.next.projects[0]?.generation, 3);
  assert.equal(
    approvedBoth.value.next.queueEntries[0]?.state,
    "replan_required",
  );
  assert.ok(
    approvedBoth.value.next.blockers.every((b) => b.status === "resolved"),
  );
  assert.deepEqual(
    approvedBoth.value.next.decisions.find(
      (d) => d.decisionId === nextRequest.decisionId,
    )?.result?.answer,
    firstAnswer,
  );
  assert.equal(
    validateDecisionSnapshotTransition(
      approvedFirst.value.next,
      approvedBoth.value.next,
    ),
    true,
  );
  assert.equal(
    validateDecisionSnapshotTransition(approvedFirst.value.next, {
      ...approvedBoth.value.next,
      decisions: approvedBoth.value.next.decisions.map((d) =>
        d.decisionId === nextRequest.decisionId ? approvedFirst.value.value : d,
      ),
    }),
    false,
  );
  assert.equal(
    prepareDecisionSubmission(
      approvedFirst.value.next,
      nextRequest.decisionId,
      {
        ...answer,
        selectedOption: "resume",
        answeredAt: nextRequest.requestedAt,
      },
      nextRequest.requestedAt,
    ).value?.next,
    null,
  );
  const technical: Blocker = {
    blockerId: "input-pending",
    kind: "input",
    currentDecisionId: null,
    target: request.target,
    reason: "入力待ち",
    status: "active",
  };
  const otherMilestone: Blocker = {
    ...technical,
    blockerId: "input-other-milestone",
    target: {
      ...request.target,
      id: "milestone-other",
      milestoneId: "milestone-other",
    },
  };
  const alreadyResolved: Blocker = {
    ...technical,
    blockerId: "input-resolved",
    status: "resolved",
  };
  const combined = {
    ...another.value.next,
    blockers: [
      ...another.value.next.blockers,
      technical,
      otherMilestone,
      alreadyResolved,
    ],
  };
  const pendingTechnical = prepareDecisionSubmission(
    { ...combined, decisions: approvedFirst.value.next.decisions },
    "proposal-other-problem",
    {
      ...answer,
      selectedOption: "resume",
      answeredAt: nextRequest.requestedAt,
    },
    nextRequest.requestedAt,
  );
  assert.equal(pendingTechnical.status, "completed");
  if (pendingTechnical.status !== "completed" || !pendingTechnical.value.next)
    throw Error("fixture");
  assert.equal(pendingTechnical.value.value.status, "answered");
  const releasedTechnical = {
    ...pendingTechnical.value.next,
    blockers: pendingTechnical.value.next.blockers.map((b) =>
      b.blockerId === technical.blockerId
        ? { ...b, status: "resolved" as const }
        : b,
    ),
  };
  assert.equal(
    prepareDecisionApplying(
      releasedTechnical,
      nextRequest.decisionId,
      nextRequest.requestedAt,
    ).status,
    "completed",
  );
  assert.equal(
    validateDecisionCollections(combined.decisions, combined.blockers, [
      "project-a",
    ]),
    true,
  );
  const cancelled = prepareDecisionSubmission(
    combined,
    nextRequest.decisionId,
    {
      ...answer,
      selectedOption: "cancel",
      answeredAt: nextRequest.requestedAt,
    },
    nextRequest.requestedAt,
  );
  assert.equal(cancelled.status, "completed");
  if (cancelled.status !== "completed" || !cancelled.value.next)
    throw Error("fixture");
  const done = cancelled.value.next;
  assert.equal(done.blockers[0]?.status, "cancelled");
  assert.equal(
    cancelled.value.value.result?.status === "applied" &&
      cancelled.value.value.result.application.blockerResolved,
    false,
  );
  assert.equal(
    validateDecisionCollections(done.decisions, done.blockers, ["project-a"]),
    true,
  );
  assert.equal(validateDecisionSnapshotTransition(combined, done), true);
  for (const id of [
    request.blockerId,
    "blocker-other-problem",
    "input-pending",
  ]) {
    const blocker = done.blockers.find((b) => b.blockerId === id);
    assert.equal(blocker?.status, "cancelled");
    assert.equal(
      blocker?.status === "cancelled" && blocker.cancelledByDecisionId,
      nextRequest.decisionId,
    );
  }
  assert.deepEqual(
    done.blockers.find((b) => b.blockerId === otherMilestone.blockerId),
    otherMilestone,
  );
  assert.deepEqual(
    done.blockers.find((b) => b.blockerId === alreadyResolved.blockerId),
    alreadyResolved,
  );
  for (const cause of ["missing", "proposal-other-problem"])
    assert.equal(
      validateDecisionCollections(
        done.decisions,
        done.blockers.map((b) =>
          b.status === "cancelled" ? { ...b, cancelledByDecisionId: cause } : b,
        ),
        ["project-a"],
      ),
      false,
    );
  assert.equal(
    validateDecisionCollections(
      done.decisions.map((d) =>
        d.decisionId === nextRequest.decisionId &&
        d.result?.status === "applied"
          ? {
              ...d,
              result: {
                ...d.result,
                application: {
                  ...d.result.application,
                  nextState: "executing",
                },
              },
            }
          : d,
      ),
      done.blockers,
      ["project-a"],
    ),
    false,
  );
  assert.equal(
    validateDecisionSnapshotTransition(combined, {
      ...done,
      blockers: done.blockers.map((b) =>
        b.blockerId === technical.blockerId ? technical : b,
      ),
    }),
    false,
  );
  const owner = {
    schema: current.schema,
    leaseResourcesAbsent: () => true,
  } as unknown as Parameters<typeof queueIsClosed>[2];
  assert.equal(queueIsClosed(done, "queue-a", owner), true);
  assert.equal(
    queueIsClosed(
      {
        ...done,
        blockers: done.blockers.map((b) => ({
          ...b,
          status: "active" as const,
        })),
      },
      "queue-a",
      owner,
    ),
    false,
  );
  assert.equal(
    queueIsClosed(done, "queue-a", {
      ...owner,
      leaseResourcesAbsent: () => false,
    }),
    false,
  );
  const referencesFirst = prepareDecisionRetirement(done, () => "recorded");
  assert.equal(referencesFirst.status, "completed");
  if (referencesFirst.status !== "completed" || !referencesFirst.value.next)
    throw Error("fixture");
  assert.equal(referencesFirst.value.value, 1);
  assert.ok(
    referencesFirst.value.next.decisions.some(
      (d) => d.decisionId === nextRequest.decisionId,
    ),
  );
  assert.equal(
    validateDecisionRetirement(done, referencesFirst.value.next),
    true,
  );
  const unresolved = {
    ...done,
    projects: done.projects.map((p) => ({
      ...p,
      tasks: [
        { state: "failed", cleanupConfirmed: true, recoveryUnresolved: true },
      ] as unknown as typeof p.tasks,
    })),
  };
  assert.equal(queueIsClosed(unresolved, "queue-a", owner), false);
  assert.equal(
    validateDecisionRetirement(done, {
      ...done,
      projects: [],
      queueEntries: [],
      decisions: done.decisions.filter(
        (d) => d.blockerId !== request.blockerId,
      ),
      blockers: done.blockers.filter((b) => b.blockerId !== request.blockerId),
    }),
    false,
  );
  // 技術問題の実体・記録処置はそのOwnerが終えてから、人間判断グループを整理する。
  const unreferenced = {
    ...done,
    projects: [],
    queueEntries: [],
    blockers: done.blockers.filter((b) => b.kind === "human_decision"),
  };
  const retired = prepareDecisionRetirement(unreferenced, () => "recorded");
  assert.equal(retired.status, "completed");
  if (retired.status !== "completed" || !retired.value.next)
    throw Error("fixture");
  assert.equal(retired.value.value, 3);
  assert.equal(
    validateDecisionRetirement(unreferenced, retired.value.next),
    true,
  );
});

/**
 * 要求時の回答先を後から回答者や履歴本文で置換できないことを確認する。
 * @trace PRL-UT-015
 * @precondition 認可された回答先を持つ新判断要求を使う。
 * @stimulus 別主体・欠測した回答先・改ざん履歴を与える。
 * @observation 候補と独立履歴検査の拒否、元要求の不変を観測する。
 * @oracle 別主体の回答を記録せず、要求先欠測を補完しない。
 * @cleanup N/A: 値操作のみ。
 * @boundary Domainの値検査。本人認証の成立は主張しない。
 */
test("回答は要求時の回答先に限定し履歴にも同じ主体を保持する", () => {
  const { request, answer } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  const before = encodeStateValue(prepared);
  assert.equal(
    prepareDecisionAnswer(
      prepared.decision,
      { ...answer, principalId: "other-user" },
      null,
      "未適用",
    ),
    null,
  );
  const { respondentPrincipalId: _respondent, ...missing } = request;
  assert.equal(prepareDecisionRequest(missing as DecisionRequest), null);
  assert.equal(
    prepareDecisionRequest({ ...request, respondentPrincipalId: "" }),
    null,
  );
  const answered = prepareDecisionAnswer(
    prepared.decision,
    answer,
    null,
    "未適用",
  );
  assert.ok(answered);
  const events = projectDecisionHistory(answered.decision);
  assert.ok(events);
  for (const event of events) {
    assert.equal(event.respondentPrincipalId, answer.principalId);
    const { respondentPrincipalId: _id, ...incomplete } = event;
    assert.equal(inspectDecisionHistoryEvent(incomplete), null);
    if (event.kind === "decision_answered")
      assert.equal(
        inspectDecisionHistoryEvent({
          ...event,
          respondentPrincipalId: "other-user",
        }),
        null,
      );
  }
  assert.equal(encodeStateValue(prepared), before);
});

/**
 * 即時判断も既存の要求・回答候補から導出し、中間保存や片側更新を許可しない。
 * @trace PRL-UT-015
 * @precondition 現在のObjectiveが統合待ちである。
 * @stimulus 要求と回答を一括入力し、Projectだけを元へ戻す変異を与える。
 * @observation 最終候補の全区画、元値不変、遷移検査を確認する。
 * @oracle 不正回答では要求も残さず、任意の新規applied値を通さない。
 * @cleanup N/A: 値操作のみ。
 * @boundary 同一Stateの候補生成と再導出。
 */
test("即時の要求と回答も中間Stateなしで全区画を一候補へまとめる", () => {
  const { request, answer } = newDecisionFixture();
  const { current } = fixture();
  const source = {
    ...current,
    projects: [
      {
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: request.target.repositoryRevision,
        generation: 2,
        milestone: { id: "milestone-a", state: "executing" },
        objectives: [
          {
            definition: { id: "objective-a", acceptanceCriteria: ["根拠確認"] },
            state: "integration_pending",
          },
        ],
        tasks: [],
        decisionApplicationId: null,
      },
    ] as unknown as import("../../../src/state/types.ts").ProjectExecutionState[],
  };
  const acceptance: DecisionRequest = {
    decisionId: request.decisionId,
    blockerId: request.blockerId,
    respondentPrincipalId: request.respondentPrincipalId,
    question: request.question,
    requestedAt: request.requestedAt,
    kind: "acceptance",
    target: { ...request.target, kind: "objective", id: "objective-a" },
    options: [
      { value: "accept", label: "受入" },
      { value: "return", label: "差戻し" },
    ],
  };
  const before = encodeStateValue(source);
  const accepted = prepareDecisionRecording(
    source,
    acceptance,
    { ...answer, selectedOption: "accept" },
    answer.answeredAt,
  );
  assert.equal(accepted.status, "completed");
  if (accepted.status !== "completed" || !accepted.value.next)
    throw Error("candidate_missing");
  assert.equal(accepted.value.value.status, "applied");
  assert.equal(accepted.value.next.decisions.length, 1);
  assert.equal(
    validateDecisionSnapshotTransition(source, accepted.value.next),
    true,
  );
  assert.equal(
    validateDecisionSnapshotTransition(source, {
      ...accepted.value.next,
      projects: source.projects,
    }),
    false,
  );
  assert.equal(
    prepareDecisionRecording(
      source,
      acceptance,
      { ...answer, selectedOption: "accept", principalId: "other-user" },
      answer.answeredAt,
    ).status,
    "blocked",
  );
  const returned = prepareDecisionRecording(
    source,
    acceptance,
    { ...answer, selectedOption: "return", evidenceIds: [] },
    answer.answeredAt,
  );
  assert.equal(returned.status, "completed");
  if (returned.status === "completed") {
    assert.equal(returned.value.value.status, "answered");
    assert.deepEqual(returned.value.next?.projects, source.projects);
  }
  const evidencedReturn = prepareDecisionRecording(
    source,
    acceptance,
    {
      ...answer,
      selectedOption: "return",
      evidenceIds: ["return-evidence"],
    },
    answer.answeredAt,
  );
  assert.equal(evidencedReturn.status, "completed");
  if (evidencedReturn.status === "completed")
    assert.equal(evidencedReturn.value.value.status, "applied");
  const milestoneSource = {
    ...source,
    projects: source.projects.map((project) => ({
      ...project,
      milestone: {
        ...project.milestone,
        state: "integrating" as const,
        acceptanceCriteria: ["criterion"],
        criterionEvidenceIds: ["original-evidence"],
      },
      objectives: project.objectives.map((objective) => ({
        ...objective,
        state: "accepted" as const,
      })),
    })),
  };
  const milestoneReturn = prepareDecisionRecording(
    milestoneSource,
    {
      ...acceptance,
      target: { ...acceptance.target, kind: "milestone", id: "milestone-a" },
    },
    { ...answer, selectedOption: "return", evidenceIds: ["answer-evidence"] },
    answer.answeredAt,
  );
  assert.equal(milestoneReturn.status, "completed");
  if (milestoneReturn.status === "completed") {
    assert.equal(milestoneReturn.value.value.status, "applied");
    assert.deepEqual(milestoneReturn.value.value.result?.answer.evidenceIds, [
      "answer-evidence",
    ]);
    assert.deepEqual(
      milestoneReturn.value.next?.projects[0]?.milestone.criterionEvidenceIds,
      ["original-evidence"],
    );
  }
  assert.equal(encodeStateValue(source), before);
});

test("回答・適用・Queue・Blockerを一候補へ結合し片側更新と再適用を拒否する", () => {
  const { request, answer } = newDecisionFixture();
  const { current } = fixture();
  // 局所候補が参照する区画だけを構成する。全体codecの成立は別ITが確認する。
  const project = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "b".repeat(40),
    generation: 2,
    milestone: { id: "milestone-a", state: "human_decision_required" },
    objectives: [],
    tasks: [],
    decisionApplicationId: null,
  } as unknown as import("../../../src/state/types.ts").ProjectExecutionState;
  const source = {
    ...current,
    projects: [project],
    queueEntries: [
      {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: "b".repeat(40),
        requestHash: "a".repeat(64),
        scopeHash: "c".repeat(64),
        originLane: "interactive" as const,
        state: "human_decision_required" as const,
        generation: 4,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
      },
    ],
  };
  const created = prepareDecisionCreation(source, request);
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw Error("request_failed");
  const pending = created.value.next;
  assert.ok(pending);
  assert.equal(validateDecisionSnapshotTransition(source, pending), true);
  // 回答時のLease競合は回答を保持する。後日適用では現在の条件を再検査する。
  const contended = {
    ...pending,
    queueEntries: pending.queueEntries.map((q) => ({
      ...q,
      ownerGeneration: "other-owner",
    })),
  };
  const answered = prepareDecisionSubmission(
    contended,
    request.decisionId,
    answer,
    answer.answeredAt,
  );
  assert.equal(answered.status, "completed");
  if (answered.status !== "completed" || !answered.value.next)
    throw Error("answered_missing");
  assert.equal(answered.value.value.status, "answered");
  const waiting = {
    ...answered.value.next,
    queueEntries: pending.queueEntries,
  };
  const originalAnswer = answered.value.value.result?.answer;
  const replacement = prepareDecisionCreation(waiting, {
    ...request,
    decisionId: "proposal-replacing-unapplied",
    requestedAt: "2026-11-11T02:00:00.000Z",
  });
  assert.equal(replacement.status, "completed");
  if (replacement.status !== "completed" || !replacement.value.next)
    throw Error("fixture");
  assert.equal(
    prepareDecisionApplying(
      replacement.value.next,
      request.decisionId,
      "2026-11-11T03:00:00.000Z",
    ).reason,
    "decision_proposal_not_current",
  );
  assert.equal(
    prepareDecisionApplying(
      answered.value.next,
      request.decisionId,
      answer.answeredAt,
    ).status,
    "blocked",
  );
  assert.equal(
    prepareDecisionApplying(
      waiting,
      request.decisionId,
      "2036-11-12T00:00:00.000Z",
    ).status,
    "completed",
  );
  assert.equal(
    prepareDecisionApplying(
      {
        ...waiting,
        projects: waiting.projects.map((p) => ({
          ...p,
          generation: p.generation + 1,
        })),
      },
      request.decisionId,
      answer.answeredAt,
    ).status,
    "blocked",
  );
  assert.equal(
    prepareDecisionApplying(
      {
        ...waiting,
        leaseIntents: [
          {
            queueId: request.kind === "continuation" ? request.queueId : "",
          } as never,
        ],
      },
      request.decisionId,
      answer.answeredAt,
    ).status,
    "blocked",
  );
  const later = prepareDecisionApplying(
    waiting,
    request.decisionId,
    "2026-11-11T03:00:00.000Z",
  );
  assert.equal(later.status, "completed");
  if (later.status === "completed" && later.value.next) {
    assert.deepEqual(later.value.value.result?.answer, originalAnswer);
    assert.equal(
      validateDecisionSnapshotTransition(waiting, later.value.next),
      true,
    );
    assert.equal(
      prepareDecisionApplying(
        later.value.next,
        request.decisionId,
        "2026-11-11T04:00:00.000Z",
      ).value?.next,
      null,
    );
    assert.equal(
      prepareDecisionClosing(
        later.value.next,
        request.decisionId,
        "invalidated",
        answer.answeredAt,
        "中止",
      ).status,
      "blocked",
    );
  }
  const closed = prepareDecisionClosing(
    waiting,
    request.decisionId,
    "invalidated",
    "2026-11-11T02:00:00.000Z",
    "中止",
  );
  assert.equal(closed.status, "completed");
  if (closed.status === "completed" && closed.value.next) {
    assert.deepEqual(closed.value.value.result?.answer, originalAnswer);
    assert.equal(
      validateDecisionSnapshotTransition(waiting, closed.value.next),
      true,
    );
    assert.equal(
      prepareDecisionApplying(
        closed.value.next,
        request.decisionId,
        answer.answeredAt,
      ).status,
      "blocked",
    );
    assert.equal(
      prepareDecisionSubmission(
        closed.value.next,
        request.decisionId,
        answer,
        answer.answeredAt,
      ).status,
      "blocked",
    );
  }
  const applied = prepareDecisionSubmission(
    pending,
    request.decisionId,
    answer,
    "2026-11-11T02:00:00.000Z",
  );
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") throw Error("answer_failed");
  const next = applied.value.next;
  assert.ok(next);
  assert.equal(next.projects[0]?.generation, 3);
  assert.equal(next.queueEntries[0]?.generation, 6);
  assert.equal(next.queueEntries[0]?.state, "replan_required");
  assert.equal(next.blockers[0]?.status, "resolved");
  assert.equal(
    prepareDecisionRetirement(next, () => "recorded").value?.next,
    null,
  );
  const unreferenced = {
    ...next,
    projects: next.projects.map((item) => ({
      ...item,
      decisionApplicationId: null,
    })),
    queueEntries: [],
  };
  assert.equal(
    prepareDecisionRetirement(unreferenced, () => null).status,
    "blocked",
  );
  const retired = prepareDecisionRetirement(unreferenced, () => "recorded");
  assert.equal(retired.status, "completed");
  if (retired.status === "completed") {
    assert.ok(retired.value.next);
    assert.equal(retired.value.next.decisions.length, 0);
    assert.equal(retired.value.next.blockers.length, 0);
    assert.equal(
      validateDecisionRetirement(unreferenced, retired.value.next),
      true,
    );
    assert.equal(
      validateDecisionRetirement(unreferenced, {
        ...retired.value.next,
        blockers: unreferenced.blockers,
      }),
      false,
    );
  }
  const recorded = next.decisions[0]?.result;
  assert.equal(recorded?.answer.answeredAt, answer.answeredAt);
  assert.equal(recorded?.status, "applied");
  if (recorded?.status === "applied")
    assert.equal(recorded.application.appliedAt, "2026-11-11T02:00:00.000Z");
  assert.equal(
    validateDecisionCollections(next.decisions, next.blockers, ["project-a"]),
    true,
  );
  assert.equal(validateDecisionSnapshotTransition(pending, next), true);
  assert.equal(
    validateDecisionSnapshotTransition(pending, {
      ...next,
      queueEntries: pending.queueEntries,
    }),
    false,
  );
  assert.equal(
    validateDecisionSnapshotTransition(pending, {
      ...next,
      projects: pending.projects,
    }),
    false,
  );
  assert.equal(
    validateDecisionSnapshotTransition(pending, {
      ...next,
      blockers: pending.blockers,
    }),
    false,
  );
  assert.equal(
    validateDecisionSnapshotTransition(next, { ...next, decisions: [] }),
    false,
  );
  const replay = prepareDecisionSubmission(
    next,
    request.decisionId,
    answer,
    answer.answeredAt,
  );
  assert.equal(replay.status, "completed");
  if (replay.status === "completed") assert.equal(replay.value.next, null);
  assert.equal(
    prepareDecisionSubmission(
      next,
      request.decisionId,
      {
        ...answer,
        selectedOption: "cancel",
      },
      answer.answeredAt,
    ).status,
    "blocked",
  );
  const stale = prepareDecisionSubmission(
    { ...pending, projects: [{ ...project, generation: 3 }] },
    request.decisionId,
    answer,
    answer.answeredAt,
  );
  assert.equal(stale.status, "completed");
  if (stale.status === "completed") {
    assert.equal(stale.value.value.status, "answered");
    assert.equal(stale.value.next?.queueEntries, pending.queueEntries);
  }
  assert.equal(
    prepareDecisionSubmission(
      pending,
      request.decisionId,
      answer,
      "2036-11-12T00:00:00.000Z",
    ).reason,
    "decision_applied",
  );
  const { queueId: _queueId, ...acceptance } = request as Extract<
    DecisionRequest,
    { kind: "continuation" }
  >;
  const acceptanceRequest: DecisionRequest = {
    ...acceptance,
    kind: "acceptance",
    target: { ...request.target, kind: "objective", id: "objective-a" },
    options: [
      { value: "accept", label: "受入" },
      { value: "return", label: "差戻し" },
    ],
  };
  const acceptanceSource = {
    ...source,
    projects: [
      {
        ...project,
        objectives: [
          {
            definition: {
              id: "objective-a",
              acceptanceCriteria: ["criterion-a"],
            },
            state: "integration_pending" as const,
            criterionEvidenceIds: [],
          },
        ],
      },
    ],
  };
  const accepted = prepareDecisionCreation(acceptanceSource, acceptanceRequest);
  assert.equal(accepted.status, "completed");
  if (accepted.status !== "completed" || !accepted.value.next)
    throw Error("acceptance_fixture_failed");
  const acceptanceBefore = encodeStateValue(accepted.value.next);
  for (const selectedOption of ["accept", "return"] as const) {
    for (const evidenceIds of [null, "not-an-array", undefined]) {
      const invalid = {
        ...answer,
        selectedOption,
        evidenceIds,
      } as unknown as DecisionAnswer;
      assert.equal(
        prepareDecisionSubmission(
          accepted.value.next,
          request.decisionId,
          invalid,
          answer.answeredAt,
        ).reason,
        "decision_answer_invalid",
      );
      assert.equal(encodeStateValue(accepted.value.next), acceptanceBefore);
    }
  }
});

test("判断履歴は元の質問・回答者・理由・状態変化を安定IDで再構成する", () => {
  const { request, answer, application } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  const waiting = prepareDecisionAnswer(
    prepared.decision,
    answer,
    null,
    "再評価待ち",
  );
  assert.ok(waiting);
  const applied = prepareDecisionApplication(waiting.decision, application);
  assert.ok(applied);
  const events = projectDecisionHistory(applied.decision);
  assert.ok(events);
  assert.deepEqual(
    events.map((event) => event.eventId),
    ["decision-new:requested", "decision-new:answered", "decision-new:applied"],
  );
  assert.deepEqual(events, projectDecisionHistory(applied.decision));
  for (const event of events)
    assert.deepEqual(inspectDecisionHistoryEvent(event), event);
  const lines = events
    .map(
      (event) =>
        `${encodeStateValue({
          schema: "crdd-coordinator/history-row/v2",
          occurredAt: event.occurredAt,
          summary: {
            schema: "crdd-coordinator/decision-event/v1",
            record: event,
          },
        })}\n`,
    )
    .join("");
  assert.equal(decodeHistoryRows(Buffer.from(lines))?.length, 3);
  assert.equal(decodeHistoryRows(Buffer.from(lines + lines)), null);
  assert.equal(decodeHistoryRows(Buffer.from(`${lines}{partial`)), null);
  assert.equal(
    inspectDecisionHistoryEvent({ ...events[0], unknown: true }),
    null,
  );
  assert.equal(events[0]?.question, request.question);
  assert.deepEqual(events[0]?.options, request.options);
  assert.ok(events[0]);
  assert.equal("answer" in events[0], false);
  assert.equal(events[1]?.kind, "decision_answered");
  if (events[1]?.kind === "decision_answered") {
    assert.equal(events[1].answer.reason, answer.reason);
    assert.equal(events[1].answer.principalId, answer.principalId);
    assert.equal("application" in events[1], false);
  }
  assert.equal(events[2]?.kind, "decision_applied");
  if (events[2]?.kind === "decision_applied")
    assert.equal(events[2].application.nextState, "executing");
  assert.equal(prepareDecisionApplication(applied.decision, application), null);
});

/**
 * 明示無効化と撤去済み期限契約を区別する。
 * @responsibility 時間経過を閉鎖理由にせず、既存回答と履歴の保全を検証する。
 * @trace PRL-UT-015
 */
test("明示無効化は既存回答を保持し、旧期限閉鎖は受け付けない", () => {
  const { request, answer } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  assert.equal(
    inspectDecisionHistoryEvent({
      ...projectDecisionHistory(prepared.decision)?.[0],
      kind: "decision_expired",
      eventId: `${request.decisionId}:expired`,
      reason: "旧期限",
    }),
    null,
  );
  assert.equal(
    prepareDecisionClosure(
      prepared.decision,
      "expired" as never,
      answer.answeredAt,
      "期限切れ",
    ),
    null,
  );
  const answered = prepareDecisionAnswer(
    prepared.decision,
    answer,
    null,
    "他の阻害条件が残る",
  );
  assert.ok(answered);
  const invalidated = prepareDecisionClosure(
    answered.decision,
    "invalidated",
    answer.answeredAt,
    "対象変更",
  );
  assert.ok(invalidated);
  assert.equal(invalidated.result?.answer.reason, answer.reason);
  assert.deepEqual(
    projectDecisionHistory(invalidated)?.map((event) => event.kind),
    ["decision_requested", "decision_answered", "decision_invalidated"],
  );
  assert.equal(
    prepareDecisionClosure(
      answered.decision,
      "expired" as never,
      "2036-11-12T00:00:00.000Z",
      "期限切れ",
    ),
    null,
  );
  assert.equal(
    prepareDecisionClosure(
      invalidated,
      "invalidated",
      answer.answeredAt,
      "再度",
    ),
    null,
  );
});

test("履歴投影は状態と回答の矛盾や未知fieldを正規化して受理しない", () => {
  const { request, answer, application } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  const applied = prepareDecisionAnswer(
    prepared.decision,
    answer,
    application,
    null,
  );
  assert.ok(applied);
  assert.equal(
    projectDecisionHistory({ ...applied.decision, status: "pending" } as never),
    null,
  );
  assert.equal(
    projectDecisionHistory({ ...prepared.decision, unknown: true } as never),
    null,
  );
});

test("後適用と閉鎖は壊れた元判断を例外なしで拒否する", () => {
  const { request, answer, application } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  const answered = prepareDecisionAnswer(
    prepared.decision,
    answer,
    null,
    "再評価待ち",
  );
  assert.ok(answered);
  for (const invalid of [
    { ...answered.decision, result: null },
    { ...answered.decision, result: {} },
    {
      ...answered.decision,
      result: { answer, status: "applied", application },
    },
    {
      ...answered.decision,
      result: { answer, status: "unapplied", reason: "" },
    },
    { ...prepared.decision, question: "" },
    { ...prepared.decision, target: null },
    { ...prepared.decision, unknown: true },
    {
      ...prepared.decision,
      result: { answer, status: "unapplied", reason: "矛盾" },
    },
  ]) {
    assert.equal(
      prepareDecisionApplication(invalid as never, application),
      null,
    );
    assert.equal(
      prepareDecisionClosure(
        invalid as never,
        "invalidated",
        answer.answeredAt,
        "対象変更",
      ),
      null,
    );
  }
});

test("新判断は質問・表示・回答理由・適用を一候補へ保持する", () => {
  const { request, answer, application } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  assert.equal(prepared.blocker.kind, "human_decision");
  assert.equal(prepared.blocker.status, "active");
  const result = prepareDecisionAnswer(
    prepared.decision,
    answer,
    application,
    null,
  );
  assert.ok(result);
  assert.equal(result.decision.status, "applied");
  assert.deepEqual(result.decision.result, {
    answer,
    status: "applied",
    application,
  });
  assert.equal(result.decision.question, request.question);
  assert.deepEqual(result.decision.options, request.options);
  assert.notEqual(result.decision.target, request.target);
  assert.notEqual(result.decision.result?.answer, answer);
  assert.equal(prepared.decision.status, "pending");
});

test("適用できない回答も理由と共に保持しBlockerを解消しない", () => {
  const { request, answer } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  const result = prepareDecisionAnswer(
    prepared.decision,
    answer,
    null,
    "対象状態が変更された",
  );
  assert.ok(result);
  assert.equal(result.decision.status, "answered");
  assert.equal(result.blockerResolved, false);
  assert.deepEqual(result.decision.result, {
    answer,
    status: "unapplied",
    reason: "対象状態が変更された",
  });
  assert.equal(
    prepareDecisionAnswer(prepared.decision, answer, null, null),
    null,
  );
  assert.equal(
    prepareDecisionAnswer(result.decision, answer, null, "再回答"),
    null,
  );
});

/**
 * 期限を持たなくても要求・回答・適用の日時順序を維持する。
 * @responsibility 旧期限境界とは独立した主体・選択肢・世代検査を検証する。
 * @trace PRL-UT-015
 */
test("時間順序・未知選択・異種選択・不整合世代を拒否する", () => {
  const { request, answer, application } = newDecisionFixture();
  const prepared = prepareDecisionRequest(request);
  assert.ok(prepared);
  for (const invalid of [
    { ...answer, answeredAt: "2026-11-10T00:00:00.000Z" },
    { ...answer, selectedOption: "accept" as const },
    { ...answer, principalId: "" },
    { ...answer, evidenceIds: ["same", "same"] },
  ])
    assert.equal(
      prepareDecisionAnswer(prepared.decision, invalid, application, null),
      null,
    );
  for (const invalid of [
    { ...application, beforeGeneration: 1 },
    { ...application, afterGeneration: 4 },
    { ...application, appliedAt: request.requestedAt },
  ])
    assert.equal(
      prepareDecisionAnswer(prepared.decision, answer, invalid, null),
      null,
    );
});

test("保留の適用は同世代・同状態のままBlockerを保持する", () => {
  const { request, answer, application } = newDecisionFixture();
  const { queueId: _queueId, ...acceptanceRequest } = request as Extract<
    DecisionRequest,
    { kind: "continuation" }
  >;
  const prepared = prepareDecisionRequest({
    ...acceptanceRequest,
    kind: "acceptance",
    options: [{ value: "wait", label: "保留する" }],
  });
  assert.ok(prepared);
  const waiting = {
    ...application,
    afterGeneration: application.beforeGeneration,
    nextState: application.previousState,
    blockerResolved: false,
  };
  const reply = { ...answer, selectedOption: "wait" as const };
  const result = prepareDecisionAnswer(prepared.decision, reply, waiting, null);
  assert.ok(result);
  assert.equal(result.decision.status, "applied");
  assert.equal(result.blockerResolved, false);
  assert.equal(
    prepareDecisionAnswer(
      prepared.decision,
      reply,
      { ...waiting, blockerResolved: true },
      null,
    ),
    null,
  );
});

test("新要求は未知field・種類混同・accessor・Proxyを受け付けない", () => {
  const { request } = newDecisionFixture();
  for (const oldField of ["expiresAt", "lifetimeMs"])
    assert.equal(
      prepareDecisionRequest({ ...request, [oldField]: null }),
      null,
    );
  assert.equal(
    prepareDecisionRequest({ ...request, extra: true } as DecisionRequest),
    null,
  );
  assert.equal(
    prepareDecisionRequest({
      ...request,
      decisionId: null,
    } as unknown as DecisionRequest),
    null,
  );
  assert.equal(
    prepareDecisionRequest({
      ...request,
      options: [{ value: "accept", label: "受入" }],
    } as unknown as DecisionRequest),
    null,
  );
  let observed = false;
  const accessor = { ...request };
  Object.defineProperty(accessor, "question", {
    get() {
      observed = true;
      throw new Error("getter");
    },
    enumerable: true,
  });
  assert.equal(prepareDecisionRequest(accessor), null);
  const proxy = new Proxy(request, {
    get() {
      observed = true;
      throw new Error("proxy");
    },
  });
  assert.equal(prepareDecisionRequest(proxy), null);
  assert.equal(observed, false);
});

/**
 * 蓄積した判断集合を件数だけで不正にしない。
 * @responsibility 旧4,096件超の正常集合と相関破損の拒否を区別する。
 * @trace PRL-UT-015
 * @precondition 自己生成した独立の提案とBlockerを使用する。
 * @stimulus 4,097件の正常集合と末尾参照の欠測を渡す。
 * @observation 正常集合の受理と不正集合の拒否。
 * @oracle 件数では拒否せず、参照整合は維持する。
 * @cleanup N/A: メモリ内のみ。
 */
test("判断とBlockerは旧4,096件を超えても相関が正しければ受理する", () => {
  const { request } = newDecisionFixture();
  const prepared = Array.from({ length: 4097 }, (_, index) =>
    prepareDecisionRequest({
      ...request,
      decisionId: `decision-${index}`,
      blockerId: `blocker-${index}`,
    }),
  );
  const decisions = prepared.map((item) => {
    assert.ok(item);
    return item.decision;
  });
  const blockers = prepared.map((item) => {
    assert.ok(item);
    return item.blocker;
  });
  assert.equal(
    validateDecisionCollections(decisions, blockers, ["project-a"]),
    true,
  );
  assert.equal(
    validateDecisionCollections(decisions, blockers.slice(0, -1), [
      "project-a",
    ]),
    false,
  );
});
