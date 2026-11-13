/**
 * coordinator:integration:task-design-traceabilityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-design-traceabilityが所有する検証責務を実行する。
 * @trace AIT-IT-008
 * @level IT
 * @scope project、runtime、design、traceability
 * @boundary AIT-IT-008=Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectCoordinatorDesignTraceability } from "../../scripts/task-design-traceability.ts";

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
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function currentTrace(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        "07_Quality/Registry/coordinator-task-design-traceability.json",
      ),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

describe("Orchestrator design traceability", () => {
  /**
   * 新判断モデルの安全条件を個別に壊し、旧Protocolで代用できないことを確認する。
   * @trace AIT-IT-008
   * @precondition 現行設計は正しい。
   * @stimulus 回答先・履歴・保存境界・同一CAS・終端条件・認可を一軸ずつ変異する。
   * @observation 対象条件ごとの拒否理由。
   * @oracle 各欠落を独立に拒否し、検査を外しただけの移行にしない。
   * @cleanup N/A: 値と文書の読取りのみ。
   */
  it("判断の回答先・履歴・同一CASと閉鎖条件の欠落を拒否する", () => {
    const cases = [
      [
        "persistentRecords",
        "REC-HUMAN-DECISION",
        "requiredMeaning",
        ["exact_target_generation_revision"],
        "REC-HUMAN-DECISION:continuation_lifecycle_missing",
      ],
      [
        "resources",
        "RES-PENDING-DECISION",
        "storageBoundary",
        "host_root",
        "RES-PENDING-DECISION:state_contract_invalid",
      ],
      [
        "actionBindings",
        "BIND-QUEUE-DECISION-ACCEPTED-REPLAN",
        "standaloneAllowed",
        true,
        "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN:decision_atomic_application_invalid",
      ],
      [
        "actionBindings",
        "BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE",
        "transactionId",
        "separate",
        "TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE:decision_atomic_application_invalid",
      ],
      [
        "actionBindings",
        "BIND-DECISION-PENDING-APPLIED",
        "authorityIds",
        ["AUTH-MILESTONE"],
        "TRANS-DECISION-PENDING-APPLIED:decision_state_protocol_invalid",
      ],
    ] as const;
    for (const [group, id, key, value, expected] of cases) {
      const trace = currentTrace(),
        entries = trace[group] as Record<string, unknown>[];
      const item = entries.find((x) => x.id === id);
      assert.ok(item);
      item[key] = value;
      const result = inspectCoordinatorDesignTraceability(
        trace,
        repositoryReader,
      );
      assert.equal(result.status, "blocked", id);
      if (result.status === "blocked")
        assert.ok(result.issues.includes(expected), JSON.stringify(result));
    }
    const trace = currentTrace(),
      machines = trace.stateMachines as Record<string, unknown>[];
    const decision = machines.find((x) => x.id === "SM-DECISION");
    assert.ok(decision);
    const transitions = decision.transitions as Record<string, unknown>[];
    const closed = transitions.find(
      (x) => x.id === "TRANS-DECISION-INVALIDATED",
    );
    assert.ok(closed);
    closed.from = ["pending", "answered", "applied"];
    const result = inspectCoordinatorDesignTraceability(
      trace,
      repositoryReader,
    );
    assert.equal(result.status, "blocked");
    if (result.status === "blocked")
      assert.ok(
        result.issues.includes(
          "TRANS-DECISION-INVALIDATED:decision_state_protocol_invalid",
        ),
      );
  });
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
   */
  it("Interfaceから失敗注入・実装段階・検証までを閉じる", () => {
    assert.deepEqual(
      inspectCoordinatorDesignTraceability(currentTrace(), repositoryReader),
      {
        status: "accepted",
        interfaces: 9,
        persistentRecords: 7,
        resources: 11,
        locks: 4,
        authorities: 7,
        effects: 7,
        stateMachines: 5,
        transitions: 40,
        actionBindings: 40,
        invariants: 27,
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
    const result = inspectCoordinatorDesignTraceability(
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
   */
  it("部分実装へ接続済みのInterfaceをplanned表示へ戻せない", () => {
    const trace = structuredClone(currentTrace());
    const interfaces = trace.interfaces as Record<string, unknown>[];
    const decision = interfaces.find((entry) => entry.id === "IF-DECISION");
    assert.ok(decision);
    decision.status = "planned";
    const result = inspectCoordinatorDesignTraceability(
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
    const result = inspectCoordinatorDesignTraceability(trace, reader);
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
    const result = inspectCoordinatorDesignTraceability(
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
    const result = inspectCoordinatorDesignTraceability(
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
    const result = inspectCoordinatorDesignTraceability(
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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
    const result = inspectCoordinatorDesignTraceability(
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
   * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
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

    const result = inspectCoordinatorDesignTraceability(
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
});
