/**
 * coordinator:integration:project-runtime-design-traceabilityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-design-traceabilityが所有する検証責務を実行する。
 * @trace AIT-IT-008
 * @level IT
 * @scope project、runtime、design、traceability
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectProjectRuntimeDesignTraceability } from "../../src/core/project-runtime-design-traceability.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

/**
 * repositoryReaderのTest準備責務を実行する。
 *
 * @responsibility repositoryReaderがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus repositoryReaderを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
function repositoryReader(repositoryRelativePath: string): string | null {
  try {
    return fs.readFileSync(
      path.join(repositoryRoot, ...repositoryRelativePath.split("/")),
      "utf8",
    );
  } catch {
    return null;
  }
}

/**
 * currentTraceのTest準備責務を実行する。
 *
 * @responsibility currentTraceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus currentTraceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
function currentTrace(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "07_Quality/Registry/project-runtime-design-traceability.json",
      ),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

describe("Project Runtime design traceability", () => {
  /**
   * Interfaceから失敗注入・実装段階・検証までを閉じるを検証する。
   *
   * @responsibility Interfaceから失敗注入・実装段階・検証までを閉じるの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Interfaceから失敗注入・実装段階・検証までを閉じるの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("Interfaceから失敗注入・実装段階・検証までを閉じる", () => {
    assert.deepEqual(
      inspectProjectRuntimeDesignTraceability(currentTrace(), repositoryReader),
      {
        status: "accepted",
        interfaces: 9,
        persistentRecords: 10,
        resources: 14,
        locks: 4,
        authorities: 7,
        effects: 9,
        stateMachines: 7,
        transitions: 54,
        actionBindings: 54,
        invariants: 32,
        failureInjections: 16,
        implementationBindings: 9,
        verificationBindings: 23,
      },
    );
  });

  /**
   * 孤立Interface、未知遷移、詳細設計の検証接続との不一致を一括拒否するを検証する。
   *
   * @responsibility 孤立Interface、未知遷移、詳細設計の検証接続との不一致を一括拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 孤立Interface、未知遷移、詳細設計の検証接続との不一致を一括拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("孤立Interface、未知遷移、詳細設計の検証接続との不一致を一括拒否する", () => {
    const trace = structuredClone(currentTrace());
    const interfaces = trace.interfaces as Record<string, unknown>[];
    interfaces.push({
      id: "IF-ORPHAN",
      owner: "nobody",
      status: "planned",
      implementationStage: "never",
    });
    const failures = trace.failureInjections as Record<string, unknown>[];
    failures[0] = {
      ...failures[0],
      transitionIds: ["TRANS-NOT-FOUND"],
    };
    const verifications = trace.verificationBindings as Record<
      string,
      unknown
    >[];
    verifications.push({
      id: "PR-A-99",
      kind: "abnormal",
      status: "planned",
      testPaths: [],
    });
    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(result.issues.includes("interface_unbound:IF-ORPHAN"));
      assert.ok(result.issues.includes("design_document_id_missing:IF-ORPHAN"));
      assert.ok(
        result.issues.includes(
          "FAIL-QUEUE-WRITE:transitionIds_unknown:TRANS-NOT-FOUND",
        ),
      );
      assert.ok(
        result.issues.includes("verification_document_id_missing:PR-A-99"),
      );
    }
  });

  /**
   * 部分実装へ接続済みのInterfaceをplanned表示へ戻せないを検証する。
   *
   * @responsibility 部分実装へ接続済みのInterfaceをplanned表示へ戻せないの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 部分実装へ接続済みのInterfaceをplanned表示へ戻せないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("部分実装へ接続済みのInterfaceをplanned表示へ戻せない", () => {
    const trace = structuredClone(currentTrace());
    const interfaces = trace.interfaces as Record<string, unknown>[];
    const decision = interfaces.find((entry) => entry.id === "IF-DECISION");
    assert.ok(decision);
    decision.status = "planned";
    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked")
      assert.ok(
        result.issues.includes(
          "IMPL-MCP-ADAPTER-CANDIDATE:partial_implementation_interface_still_planned:IF-DECISION",
        ),
      );
  });

  /**
   * 人間向け正本だけにある設計・検証IDを双方向で拒否するを検証する。
   *
   * @responsibility 人間向け正本だけにある設計・検証IDを双方向で拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 人間向け正本だけにある設計・検証IDを双方向で拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("人間向け正本だけにある設計・検証IDを双方向で拒否する", () => {
    const trace = currentTrace();
    const designPath = String(trace.designDocument);
    const reader = (repositoryRelativePath: string): string | null => {
      const source = repositoryReader(repositoryRelativePath);
      if (source === null) return null;
      if (repositoryRelativePath === designPath)
        return `${source}\n| \`FAIL-HUMAN-ONLY\` | 人間向け文書だけの試験ID |\n| PR-A-99 | 異常 | 人間向け文書だけの検証ID | 拒否 |`;
      return source;
    };
    const result = inspectProjectRuntimeDesignTraceability(trace, reader);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes("human_design_id_unmapped:FAIL-HUMAN-ONLY"),
      );
      assert.ok(
        result.issues.includes("human_verification_id_unmapped:PR-A-99"),
      );
    }
  });

  /**
   * 状態・資源・不変条件・実在Pathの参照切れを拒否するを検証する。
   *
   * @responsibility 状態・資源・不変条件・実在Pathの参照切れを拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 状態・資源・不変条件・実在Pathの参照切れを拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("状態・資源・不変条件・実在Pathの参照切れを拒否する", () => {
    const trace = structuredClone(currentTrace());
    const machines = trace.stateMachines as Record<string, unknown>[];
    const transitions = machines[0]?.transitions as Record<string, unknown>[];
    transitions[0] = {
      ...transitions[0],
      from: ["missing_state"],
      resourceIds: ["RES-NOT-FOUND"],
      invariantIds: ["INV-NOT-FOUND"],
    };
    const implementations = trace.implementationBindings as Record<
      string,
      unknown
    >[];
    implementations[0] = {
      ...implementations[0],
      paths: ["40_Develop/coordinator/src/missing.ts"],
    };
    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "TRANS-TASK-PLAN-WAIT:from_unknown:missing_state",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-TASK-PLAN-WAIT:resourceIds_unknown:RES-NOT-FOUND",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-TASK-PLAN-WAIT:invariantIds_unknown:INV-NOT-FOUND",
        ),
      );
      assert.ok(
        result.issues.includes(
          "IMPL-PROJECT-STATE-CANDIDATE:path_unavailable:40_Develop/coordinator/src/missing.ts",
        ),
      );
    }
  });

  /**
   * 遷移とLock・Authority・Effectの対応切れを一括拒否するを検証する。
   *
   * @responsibility 遷移とLock・Authority・Effectの対応切れを一括拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 遷移とLock・Authority・Effectの対応切れを一括拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("遷移とLock・Authority・Effectの対応切れを一括拒否する", () => {
    const trace = structuredClone(currentTrace());
    const bindings = trace.actionBindings as Record<string, unknown>[];
    bindings[0] = {
      ...bindings[0],
      transitionIds: [],
      lockIds: ["LOCK-NOT-FOUND"],
      authorityIds: ["AUTH-NOT-FOUND"],
      effectIds: ["EFFECT-NOT-FOUND"],
    };
    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "BIND-TASK-PLAN-WAIT:lockIds_unknown:LOCK-NOT-FOUND",
        ),
      );
      assert.ok(
        result.issues.includes(
          "BIND-TASK-PLAN-WAIT:authorityIds_unknown:AUTH-NOT-FOUND",
        ),
      );
      assert.ok(
        result.issues.includes(
          "BIND-TASK-PLAN-WAIT:effectIds_unknown:EFFECT-NOT-FOUND",
        ),
      );
      assert.ok(
        result.issues.includes(
          "transition_action_unbound:TRANS-TASK-PLAN-WAIT",
        ),
      );
    }
  });

  /**
   * 異質な遷移の和集合化とRecord時間関係の逆転を拒否するを検証する。
   *
   * @responsibility 異質な遷移の和集合化とRecord時間関係の逆転を拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 異質な遷移の和集合化とRecord時間関係の逆転を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("異質な遷移の和集合化とRecord時間関係の逆転を拒否する", () => {
    const trace = structuredClone(currentTrace());
    const bindings = trace.actionBindings as Record<string, unknown>[];
    bindings[0] = {
      ...bindings[0],
      transitionIds: ["TRANS-TASK-PLAN-WAIT", "TRANS-TASK-ACTIVE-CANCELLED"],
    };
    bindings[1] = {
      ...bindings[1],
      transitionIds: ["TRANS-TASK-ACTIVE-CANCELLED"],
    };
    const records = trace.persistentRecords as Record<string, unknown>[];
    const taskAttempt = records.find((item) => item.id === "REC-TASK-ATTEMPT");
    const projectState = records.find(
      (item) => item.id === "REC-PROJECT-STATE",
    );
    const adoption = records.find((item) => item.id === "REC-ADOPTION");
    assert.ok(taskAttempt);
    assert.ok(projectState);
    assert.ok(adoption);
    taskAttempt.durabilityRelation = "after_effect_receipt";
    projectState.durabilityRelation = "after_effect_result";
    adoption.durabilityRelation = "before_effect_intent";
    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "BIND-TASK-PLAN-WAIT:action_binding_shape_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "transition_action_overbound:TRANS-TASK-ACTIVE-CANCELLED",
        ),
      );
      assert.ok(
        result.issues.includes("REC-TASK-ATTEMPT:durability_relation_invalid"),
      );
      assert.ok(
        result.issues.includes("REC-PROJECT-STATE:durability_relation_invalid"),
      );
      assert.ok(
        result.issues.includes("REC-ADOPTION:durability_relation_invalid"),
      );
    }
  });

  /**
   * 未解決Recoveryからの通常復帰とEffect種別の混入を拒否するを検証する。
   *
   * @responsibility 未解決Recoveryからの通常復帰とEffect種別の混入を拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 未解決Recoveryからの通常復帰とEffect種別の混入を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("未解決Recoveryからの通常復帰とEffect種別の混入を拒否する", () => {
    const trace = structuredClone(currentTrace());
    const machines = trace.stateMachines as Record<string, unknown>[];
    const queue = machines.find((item) => item.id === "SM-QUEUE");
    assert.ok(queue);
    const transitions = queue.transitions as Record<string, unknown>[];
    const enqueue = transitions.find(
      (item) => item.id === "TRANS-QUEUE-ENQUEUE-LEASE",
    );
    assert.ok(enqueue);
    enqueue.from = ["queued", "recovery_required"];
    const bindings = trace.actionBindings as Record<string, unknown>[];
    const normal = bindings.find((item) => item.id === "BIND-TASK-PLAN-WAIT");
    const cancelled = bindings.find(
      (item) => item.id === "BIND-TASK-ACTIVE-CANCELLED",
    );
    assert.ok(normal);
    assert.ok(cancelled);
    normal.effectIds = ["EFFECT-PROJECT-STATE", "EFFECT-RECOVERY"];
    cancelled.effectIds = ["EFFECT-PROJECT-STATE"];
    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "TRANS-QUEUE-ENQUEUE-LEASE:recovery_resume_without_settlement",
        ),
      );
      assert.ok(
        result.issues.includes(
          "BIND-TASK-PLAN-WAIT:recovery_effect_applicability_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "BIND-TASK-ACTIVE-CANCELLED:cancellation_effect_missing",
        ),
      );
    }
  });

  /**
   * 遷移IDの名称ではなく状態構造からRecovery・取消・採用Effectを判定するを検証する。
   *
   * @responsibility 遷移IDの名称ではなく状態構造からRecovery・取消・採用Effectを判定するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 遷移IDの名称ではなく状態構造からRecovery・取消・採用Effectを判定するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("遷移IDの名称ではなく状態構造からRecovery・取消・採用Effectを判定する", () => {
    const trace = structuredClone(currentTrace());
    const machines = trace.stateMachines as Record<string, unknown>[];
    const milestone = machines.find((item) => item.id === "SM-MILESTONE");
    assert.ok(milestone);
    const transitions = milestone.transitions as Record<string, unknown>[];
    const recovery = transitions.find(
      (item) => item.id === "TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE",
    );
    assert.ok(recovery);
    recovery.id = "TRANS-MILESTONE-RESUME";
    recovery.to = "integrating";

    const bindings = trace.actionBindings as Record<string, unknown>[];
    const recoveryBinding = bindings.find(
      (item) => item.id === "BIND-MILESTONE-RECOVERY-SETTLED-EXECUTE",
    );
    const cancellationBinding = bindings.find(
      (item) => item.id === "BIND-TASK-ACTIVE-CANCELLED",
    );
    const normalBinding = bindings.find(
      (item) => item.id === "BIND-TASK-PLAN-WAIT",
    );
    assert.ok(recoveryBinding);
    assert.ok(cancellationBinding);
    assert.ok(normalBinding);
    recoveryBinding.transitionIds = ["TRANS-MILESTONE-RESUME"];
    cancellationBinding.id = "BIND-TASK-STOP";
    cancellationBinding.effectIds = ["EFFECT-PROJECT-STATE"];
    normalBinding.id = "BIND-NORMAL-RECOVERY-SETTLED-NAME";
    normalBinding.effectIds = ["EFFECT-PROJECT-STATE", "EFFECT-RECOVERY"];

    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "TRANS-MILESTONE-RESUME:recovery_resume_without_settlement",
        ),
      );
      assert.ok(
        result.issues.includes("BIND-TASK-STOP:cancellation_effect_missing"),
      );
      assert.ok(
        result.issues.includes(
          "BIND-NORMAL-RECOVERY-SETTLED-NAME:recovery_effect_applicability_invalid",
        ),
      );
    }
  });

  /**
   * 判断待ちからの再開とDecision lifecycleのAuthority迂回を拒否するを検証する。
   *
   * @responsibility 判断待ちからの再開とDecision lifecycleのAuthority迂回を拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 判断待ちからの再開とDecision lifecycleのAuthority迂回を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("判断待ちからの再開とDecision lifecycleのAuthority迂回を拒否する", () => {
    const trace = structuredClone(currentTrace());
    const machines = trace.stateMachines as Record<string, unknown>[];
    const milestone = machines.find((item) => item.id === "SM-MILESTONE");
    assert.ok(milestone);
    const milestoneTransitions = milestone.transitions as Record<
      string,
      unknown
    >[];
    const resume = milestoneTransitions.find(
      (item) => item.id === "TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE",
    );
    assert.ok(resume);
    resume.resourceIds = ["RES-PROJECT-OPERATION-LEASE"];
    resume.invariantIds = ["INV-REVALIDATE-AFTER-WAIT"];

    const bindings = trace.actionBindings as Record<string, unknown>[];
    const resumeBinding = bindings.find(
      (item) => item.id === "BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE",
    );
    const acceptedBinding = bindings.find(
      (item) => item.id === "BIND-DECISION-PENDING-ACCEPTED",
    );
    const staleBinding = bindings.find(
      (item) => item.id === "BIND-DECISION-PENDING-STALE",
    );
    assert.ok(resumeBinding);
    assert.ok(acceptedBinding);
    assert.ok(staleBinding);
    resumeBinding.authorityIds = ["AUTH-MILESTONE"];
    acceptedBinding.authorityIds = ["AUTH-MILESTONE"];
    staleBinding.authorityIds = ["AUTH-HUMAN-DECISION"];

    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE:decision_resume_without_receipt",
        ),
      );
      assert.ok(
        result.issues.includes(
          "BIND-DECISION-PENDING-ACCEPTED:decision_acceptance_authority_missing",
        ),
      );
      assert.ok(
        result.issues.includes(
          "BIND-DECISION-PENDING-STALE:decision_lifecycle_authority_invalid",
        ),
      );
    }
  });

  /**
   * 判断適用の原子性と継続Capability lifecycleの欠落を拒否するを検証する。
   *
   * @responsibility 判断適用の原子性と継続Capability lifecycleの欠落を拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 判断適用の原子性と継続Capability lifecycleの欠落を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("判断適用の原子性と継続Capability lifecycleの欠落を拒否する", () => {
    const trace = structuredClone(currentTrace());
    const bindings = trace.actionBindings as Record<string, unknown>[];
    const milestoneProjection = bindings.find(
      (item) => item.id === "BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE",
    );
    const queueLease = bindings.find(
      (item) => item.id === "BIND-QUEUE-DECISION-ACCEPTED-REPLAN",
    );
    assert.ok(milestoneProjection);
    assert.ok(queueLease);
    milestoneProjection.transactionId = "separate_milestone_update";
    milestoneProjection.standaloneAllowed = true;
    queueLease.authorityIds = ["AUTH-MILESTONE", "AUTH-HUMAN-DECISION"];

    const records = trace.persistentRecords as Record<string, unknown>[];
    const decisionRecord = records.find(
      (item) => item.id === "REC-HUMAN-DECISION",
    );
    assert.ok(decisionRecord);
    decisionRecord.requiredMeaning = ["decision_lifecycle_state"];
    const continuationRecord = records.find(
      (item) => item.id === "REC-DECISION-CONTINUATION",
    );
    assert.ok(continuationRecord);
    continuationRecord.requiredMeaning = [];

    const resources = trace.resources as Record<string, unknown>[];
    const continuationResource = resources.find(
      (item) => item.id === "RES-DECISION-CONTINUATION",
    );
    assert.ok(continuationResource);
    continuationResource.applicationProtocol = [];

    const machines = trace.stateMachines as Record<string, unknown>[];
    const queue = machines.find((item) => item.id === "SM-QUEUE");
    assert.ok(queue);
    const queueTransitions = queue.transitions as Record<string, unknown>[];
    const decisionLease = queueTransitions.find(
      (item) => item.id === "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN",
    );
    assert.ok(decisionLease);
    decisionLease.invariantIds = ["INV-REVALIDATE-AFTER-WAIT"];

    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE:decision_atomic_application_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN:decision_post_commit_replan_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "REC-HUMAN-DECISION:continuation_lifecycle_missing",
        ),
      );
      assert.ok(
        result.issues.includes(
          "REC-DECISION-CONTINUATION:protected_lifecycle_missing",
        ),
      );
      assert.ok(
        result.issues.includes(
          "RES-DECISION-CONTINUATION:protection_contract_invalid",
        ),
      );
    }
  });

  /**
   * 保護Record protocolの段階欠落・順序逆転・Queue観測欠落を拒否するを検証する。
   *
   * @responsibility 保護Record protocolの段階欠落・順序逆転・Queue観測欠落を拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 保護Record protocolの段階欠落・順序逆転・Queue観測欠落を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("保護Record protocolの段階欠落・順序逆転・Queue観測欠落を拒否する", () => {
    const trace = structuredClone(currentTrace());
    const resources = trace.resources as Record<string, unknown>[];
    const continuationResource = resources.find(
      (item) => item.id === "RES-DECISION-CONTINUATION",
    );
    assert.ok(continuationResource);
    const protocols = continuationResource.applicationProtocol as string[];
    continuationResource.applicationProtocol = [protocols[1], protocols[0]];

    const bindings = trace.actionBindings as Record<string, unknown>[];
    const finalize = bindings.find(
      (item) => item.id === "BIND-CONTINUATION-PREPARED-FINALIZED",
    );
    const preparedInvalidation = bindings.find(
      (item) => item.id === "BIND-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED",
    );
    const recoveryFinalize = bindings.find(
      (item) => item.id === "BIND-CONTINUATION-RECOVERY-FINALIZED",
    );
    const protectedUnknownRecovery = bindings.find(
      (item) => item.id === "BIND-DECISION-RECOVERY-ABSENT-REQUIRED",
    );
    assert.ok(finalize);
    assert.ok(preparedInvalidation);
    assert.ok(recoveryFinalize);
    assert.ok(protectedUnknownRecovery);
    finalize.effectIds = ["EFFECT-DECISION-STATE"];
    preparedInvalidation.protocolStage = "invalidate_without_readback";
    recoveryFinalize.authorityIds = ["AUTH-MILESTONE"];
    protectedUnknownRecovery.effectIds = ["EFFECT-DECISION-CONTINUATION"];

    const machines = trace.stateMachines as Record<string, unknown>[];
    const queue = machines.find((item) => item.id === "SM-QUEUE");
    const continuation = machines.find(
      (item) => item.id === "SM-DECISION-CONTINUATION",
    );
    assert.ok(queue);
    assert.ok(continuation);
    const queueTransitions = queue.transitions as Record<string, unknown>[];
    const decisionLease = queueTransitions.find(
      (item) => item.id === "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN",
    );
    assert.ok(decisionLease);
    decisionLease.resourceIds = (decisionLease.resourceIds as string[]).filter(
      (id) => id !== "RES-DECISION-CONTINUATION",
    );
    const continuationTransitions = continuation.transitions as Record<
      string,
      unknown
    >[];
    const preparedInvalidationTransition = continuationTransitions.find(
      (item) => item.id === "TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED",
    );
    const recoveryFinalizeTransition = continuationTransitions.find(
      (item) => item.id === "TRANS-CONTINUATION-RECOVERY-FINALIZED",
    );
    assert.ok(preparedInvalidationTransition);
    assert.ok(recoveryFinalizeTransition);
    preparedInvalidationTransition.resourceIds = ["RES-DECISION-CONTINUATION"];
    recoveryFinalizeTransition.to = "invalidated";

    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "RES-DECISION-CONTINUATION:protection_contract_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-CONTINUATION-PREPARED-FINALIZED:decision_continuation_protocol_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED:decision_continuation_protocol_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-CONTINUATION-RECOVERY-FINALIZED:decision_continuation_protocol_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-DECISION-RECOVERY-ABSENT-REQUIRED:decision_recovery_intent_protocol_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN:decision_post_commit_replan_invalid",
        ),
      );
    }
  });

  /**
   * 保護Root観測不能時の独立Recovery Store欠落と架空遷移を拒否するを検証する。
   *
   * @responsibility 保護Root観測不能時の独立Recovery Store欠落と架空遷移を拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 保護Root観測不能時の独立Recovery Store欠落と架空遷移を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("保護Root観測不能時の独立Recovery Store欠落と架空遷移を拒否する", () => {
    const trace = structuredClone(currentTrace());
    const records = trace.persistentRecords as Record<string, unknown>[];
    trace.persistentRecords = records.filter(
      (item) => item.id !== "REC-DECISION-RECOVERY-INTENT",
    );

    const resources = trace.resources as Record<string, unknown>[];
    const recoveryResource = resources.find(
      (item) => item.id === "RES-DECISION-RECOVERY-INTENT",
    );
    assert.ok(recoveryResource);
    recoveryResource.unavailableDisposition = "assume_recovery_required";

    const machines = trace.stateMachines as Record<string, unknown>[];
    const recoveryMachine = machines.find(
      (item) => item.id === "SM-DECISION-RECOVERY-INTENT",
    );
    assert.ok(recoveryMachine);
    const recoveryTransitions = recoveryMachine.transitions as Record<
      string,
      unknown
    >[];
    const protectedUnknown = recoveryTransitions.find(
      (item) => item.id === "TRANS-DECISION-RECOVERY-ABSENT-REQUIRED",
    );
    assert.ok(protectedUnknown);
    protectedUnknown.resourceIds = ["RES-DECISION-CONTINUATION"];

    const result = inspectProjectRuntimeDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.ok(
        result.issues.includes(
          "REC-DECISION-RECOVERY-INTENT:lifecycle_missing",
        ),
      );
      assert.ok(
        result.issues.includes(
          "RES-DECISION-RECOVERY-INTENT:protection_contract_invalid",
        ),
      );
      assert.ok(
        result.issues.includes(
          "TRANS-DECISION-RECOVERY-ABSENT-REQUIRED:decision_recovery_intent_protocol_invalid",
        ),
      );
    }
  });

  /**
   * 回復意図の三者照合と継続Record先行収束の欠落を個別に拒否するを検証する。
   *
   * @responsibility 回復意図の三者照合と継続Record先行収束の欠落を個別に拒否するの合否判定を所有する。
   * @trace AIT-IT-008
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 回復意図の三者照合と継続Record先行収束の欠落を個別に拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
   */
  it("回復意図の三者照合と継続Record先行収束の欠落を個別に拒否する", () => {
    const cases: Array<{
      name: string;
      mutate: (trace: Record<string, unknown>) => void;
      issue: string;
    }> = [
      {
        name: "settlement invariant missing",
        mutate: (trace) => {
          const machines = trace.stateMachines as Record<string, unknown>[];
          const recoveryMachine = machines.find(
            (item) => item.id === "SM-DECISION-RECOVERY-INTENT",
          );
          assert.ok(recoveryMachine);
          const transitions = recoveryMachine.transitions as Record<
            string,
            unknown
          >[];
          const settlement = transitions.find(
            (item) => item.id === "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED",
          );
          assert.ok(settlement);
          settlement.invariantIds = (
            settlement.invariantIds as string[]
          ).filter((id) => id !== "INV-DECISION-RECOVERY-SETTLEMENT");
        },
        issue:
          "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED:decision_recovery_intent_protocol_invalid",
      },
      {
        name: "fresh join resource missing",
        mutate: (trace) => {
          const bindings = trace.actionBindings as Record<string, unknown>[];
          const settlement = bindings.find(
            (item) => item.id === "BIND-DECISION-RECOVERY-REQUIRED-SETTLED",
          );
          assert.ok(settlement);
          settlement.freshJoinResourceIds = [
            "RES-DECISION-RECOVERY-INTENT",
            "RES-DECISION-CONTINUATION",
          ];
        },
        issue:
          "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED:decision_recovery_intent_protocol_invalid",
      },
      {
        name: "intent settles before continuation",
        mutate: (trace) => {
          const bindings = trace.actionBindings as Record<string, unknown>[];
          const settlement = bindings.find(
            (item) => item.id === "BIND-DECISION-RECOVERY-REQUIRED-SETTLED",
          );
          assert.ok(settlement);
          settlement.continuationSettlementReadbackBeforeIntent = false;
          settlement.intentSettlementReadbackLast = false;
        },
        issue:
          "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED:decision_recovery_intent_protocol_invalid",
      },
      {
        name: "absent and expired safe outcomes missing",
        mutate: (trace) => {
          const bindings = trace.actionBindings as Record<string, unknown>[];
          const settlement = bindings.find(
            (item) => item.id === "BIND-DECISION-RECOVERY-REQUIRED-SETTLED",
          );
          assert.ok(settlement);
          settlement.allowedContinuationSettlementStates = [
            "finalized",
            "invalidated",
          ];
          settlement.safeSettlementOutcomes = [
            "record_finalized_matching_new",
            "record_invalidated_verified_old_unapplied",
          ];
        },
        issue:
          "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED:decision_recovery_intent_protocol_invalid",
      },
      {
        name: "project unknown updates recovery store implicitly",
        mutate: (trace) => {
          const bindings = trace.actionBindings as Record<string, unknown>[];
          const projectUnknown = bindings.find(
            (item) => item.id === "BIND-CONTINUATION-PROJECT-UNKNOWN-RECOVERY",
          );
          assert.ok(projectUnknown);
          projectUnknown.effectIds = [
            "EFFECT-DECISION-RECOVERY-INTENT",
            "EFFECT-DECISION-CONTINUATION",
          ];
        },
        issue:
          "TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY:decision_continuation_protocol_invalid",
      },
    ];

    for (const testCase of cases) {
      const trace = structuredClone(currentTrace());
      testCase.mutate(trace);
      const result = inspectProjectRuntimeDesignTraceability(
        trace,
        repositoryReader,
      );
      assert.equal(result.status, "blocked", testCase.name);
      if (result.status === "blocked")
        assert.ok(result.issues.includes(testCase.issue), testCase.name);
    }
  });
});
