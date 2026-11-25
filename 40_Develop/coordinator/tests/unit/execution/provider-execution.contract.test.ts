/**
 * Workbench助言Production RuntimeのLifecycle契約を検証する。
 *
 * @packageDocumentation
 * @responsibility Identity伝播、Provider Effect、取消、Host／Docker cleanupおよび助言公開順序を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Coordinator RuntimeとFake Docker／Host境界。
 */
import assert from "node:assert/strict";
import { createHostCompletionFixture } from "../../fixtures/docker-owned-process-test-support.ts";
import type {
  HostCompletionTarget,
  PreparationInput,
} from "../../../src/lifecycle/types.ts";
import { getEventListeners } from "node:events";
import { setImmediate } from "node:timers/promises";
import type {
  ExecutorCallbacks,
  StartInput,
  AttemptCancelInput,
} from "@qual-lab/crdd-executor";

import test from "node:test";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { attemptPlan } from "../../../../executor/tests/fixtures/attempt-plan.ts";
import { poisonExecutionProcessAfterCleanupUnknown } from "../../../src/lifecycle/host.ts";

import { executionSelection } from "../../fixtures/ai-selection.ts";
import {
  capturePreparationInput,
  createPreparationFailure,
  prepareProviderAdviceInput,
} from "../../../src/lifecycle/selection.ts";
import { runRepositoryAdvice } from "../../../src/lifecycle/execution.ts";
import { registerDockerHandoff } from "../../../src/lifecycle/host.ts";
import {
  loadAdviceRuntimeFixture,
  loadOperationFailureFixture,
  type TestAdviceDependencies,
} from "../../support/task-requests.ts";
import { types, isDeepStrictEqual } from "node:util";
import { createResourceOperationFixture } from "../../../../execution-model/tests/support/resource-operation.ts";
import { snapshotPlainRecord } from "../../../src/lifecycle/validation.ts";
import { parseDockerTaskRecoveryId } from "@qual-lab/crdd-execution-model";
import { snapshotReadyRecovery } from "../../../src/lifecycle/validation.ts";

const { executeProviderAdvice, classifyProviderAdviceHostFailure } =
  await loadAdviceRuntimeFixture();

// EMの用途固定読取りへ切替後も、各反例は元Ownerとscopeを検査する。
const operationReadFixtureSource = `
const operationStateInput = identity => ({identity});
const readState = (input, request) => {
  if (request.scope !== "operation" || Object.keys(request).length !== 1)
    throw Error("fixture_operation_read_scope");
  return readFixtureOperation(input.identity);
};
`;

const recoverySource = fs.readFileSync(
  new URL("../../../src/lifecycle/environment.ts", import.meta.url),
  "utf8",
);

/**
 * 同一Hostで受け取った組を置換せず、別試行の組だけを追加する。
 * @responsibility Taskと助言が使う回復登録の同一性条件を検証する。
 * @trace ERB-UT-023
 * @precondition Host進捗は空であり、両試行の合成回復参照がある。
 * @stimulus 不正、片側の重複、両側の重複、別試行の組を順に登録する。
 * @observation 登録の成否と最初の組の同一参照。
 * @oracle 拒否は元の組を変更せず、別試行の組だけを追加する。
 * @cleanup メモリ内のみ。
 * @boundary 下位の登録通知と同じHostの進捗。
 */
test("同じ回復ID・制御参照の再登録を拒否し別試行だけ追加する", () => {
  const target: Pick<HostCompletionTarget, "dockerHandoffs"> = {
    dockerHandoffs: [],
  };
  const first = Object.freeze({});
  const second = Object.freeze({});
  const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const otherId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"d".repeat(64)}`;
  assert.equal(registerDockerHandoff(target, first, id), true);
  const original = target.dockerHandoffs[0];
  assert.ok(original);
  for (const [capability, recoveryId] of [
    [null, otherId],
    [() => {}, otherId],
    [second, "invalid"],
    [first, id],
    [first, otherId],
    [second, id],
  ] as const) {
    assert.equal(registerDockerHandoff(target, capability, recoveryId), false);
    assert.equal(target.dockerHandoffs.length, 1);
    assert.equal(target.dockerHandoffs[0], original);
    assert.equal(original.capability, first);
    assert.equal(original.recoveryId, id);
    assert.equal(original.state, "active");
  }
  assert.equal(registerDockerHandoff(target, second, otherId), true);
  assert.equal(target.dockerHandoffs.length, 2);
  assert.equal(target.dockerHandoffs[0], original);
  assert.equal(target.dockerHandoffs[1]?.capability, second);
  assert.equal(target.dockerHandoffs[1]?.recoveryId, otherId);
});

/**
 * 失敗終結で元の回復参照と保持終了の結果を区別する。
 * @responsibility TaskとAdviceで共用する保持終了の順序と回復参照の保存を検証する。
 * @trace ERB-UT-023
 * @precondition ケースごとに独立した所有参照と進捗を作る。
 * @stimulus 保持終了の成功、未確認、例外と、清掃済みHostを与える。
 * @observation 同じ管理参照、呼出し順、終了前後の引渡し状態。
 * @oracle 成功分だけをabandonedとし、例外でも未清掃Hostの世代Lock解放を試みる。
 * @cleanup N/A: メモリ上の値だけ。
 * @boundary 本番の保持終了とExecutor／Host Lockの代役。
 */
test("共通の失敗終結は回復参照を残し、保持終了の確認だけを記録する", async () => {
  const build = new Function(
    "abandonAttemptRecovery",
    "abandonOwnedHostOperationGenerationLock",
    `${sourceDeclaration(recoverySource, "retainHostOperation")}; return retainHostOperation;`,
  );
  for (const scenario of ["unconfirmed", "throw", "host_cleaned"] as const) {
    const management = {};
    const handoffs: HostCompletionTarget["dockerHandoffs"] = [
      { capability: {}, recoveryId: "final", state: "finalized" },
      { capability: {}, recoveryId: "released", state: "abandoned" },
      { capability: {}, recoveryId: "settled-now", state: "finalizable" },
      { capability: {}, recoveryId: "unresolved", state: "active" },
    ];
    const target: HostCompletionTarget = {
      ownedOperation: {},
      managementCapability: management,
      hostRecoveryId: "HOST",
      hostCleanupCompleted: scenario === "host_cleaned",
      dockerHandoffs: handoffs,
    };
    const calls: string[] = [];
    const failure = Error("abandon_unconfirmed");
    const retain = build(
      (capability: object, owner: unknown) => {
        assert.strictEqual(owner, management);
        const handoff = handoffs.find((item) => item.capability === capability);
        assert.ok(handoff);
        calls.push(handoff.recoveryId);
        if (handoff.recoveryId === "settled-now") return true;
        if (scenario === "throw") throw failure;
        return false;
      },
      async (owner: unknown) => {
        assert.strictEqual(owner, management);
        calls.push("host-lock");
        return true;
      },
    ) as (target: HostCompletionTarget) => Promise<void>;
    if (scenario === "throw")
      await assert.rejects(retain(target), (error) => error === failure);
    else await retain(target);
    assert.deepEqual(calls, [
      "settled-now",
      "unresolved",
      ...(scenario === "host_cleaned" ? [] : ["host-lock"]),
    ]);
    assert.deepEqual(
      handoffs.map((item) => [item.recoveryId, item.state]),
      [
        ["final", "finalized"],
        ["released", "abandoned"],
        ["settled-now", "abandoned"],
        ["unresolved", "active"],
      ],
    );
    assert.equal(target.hostRecoveryId, "HOST");
    assert.equal(target.hostCleanupCompleted, scenario === "host_cleaned");
  }
});

/**
 * 共通Host終結の実宣言で全件Gateと清掃・成功分退役の順を反証する。
 * @responsibility Caller代役と別に、本番完成操作の全対象照合・再入場を検証する。
 * @trace ERB-UT-023
 * @precondition 条件ごとにMap・元Owner・結果・進捗を独立生成する。
 * @stimulus 欠測・重複・別Host／結果・未解放・清掃不明・途中保存失敗を与える。
 * @observation 清掃回数、元結果同一性、待機前進捗、再読取り・再保存数。
 * @oracle 全件成立前は清掃0、清掃は1回、成功分は即退役し再入場で再保存しない。
 * @cleanup N/A: 実Filesystem・Docker・AIは使わない。
 * @boundary 本番完成操作の制御と有限のEM／Host／Writer。
 */
test("共通Host終結は全件照合後に一清掃し、部分成功を戻さず再入場する", async () => {
  const build = new Function(
    "durableRecord",
    "readFixtureOperation",
    "getOwnedHostRecoveryId",
    "cleanupOwnedOperationDirectories",
    "verifyOwnedOperationCleanupOutcome",
    "finishDockerRecovery",
    "setImmediate",
    "readOwnedHostOperation",
    operationReadFixtureSource +
      `${sourceDeclaration(recoverySource, "canPrepareDockerHostCleanup")}\n${sourceDeclaration(recoverySource, "completeHostOperation")};return completeHostOperation;`,
  );
  for (const fault of [
    "none",
    "empty",
    "omitted",
    "all_omitted",
    "duplicate_capability",
    "duplicate_id",
    "duplicate_saved_id",
    "reader_unknown",
    "reader_lock_unknown",
    "fresh_host_foreign",
    "fresh_host_inactive",
    "host_version_changed",
    "foreign_host",
    "foreign_result",
    "resource_unknown",
    "lease_unknown",
    "terminal_missing",
    "cleanup_unknown",
    "cleanup_throw",
    "second_save",
    "retired_notification_not_called",
  ] as const) {
    const management = {},
      owned = {},
      outcome = {};
    const target: HostCompletionTarget = {
      ownedOperation: owned,
      managementCapability: management,
      hostRecoveryId: "HOST",
      hostCleanupCompleted: false,
      dockerHandoffs: [],
    };
    const records = new Map<
      object,
      {
        completedPlan: object;
        homeLeaseReleased: boolean;
        terminalObservation: object | null;
        managementCapability: object;
        operationId: string;
        recoveryId: string;
        dockerCompletion: object;
        hostCleanupOutcome?: unknown;
      }
    >();
    for (let i = 0; i < (fault === "empty" ? 0 : 2); i++) {
      const capability = {},
        dockerCompletion = { i };
      target.dockerHandoffs.push({
        capability,
        recoveryId: `R${i}`,
        state: "finalizable",
        dockerCompletion,
      });
      records.set(capability, {
        completedPlan: {},
        homeLeaseReleased: true,
        terminalObservation: {},
        managementCapability: management,
        operationId: "OP",
        recoveryId: `R${i}`,
        dockerCompletion,
      });
    }
    const operations = [...records.values()].map((record) => ({
      kind: "docker_task",
      recoveryId: record.recoveryId,
      identityJson: JSON.stringify({ operationId: "OP" }),
      phase: "settling",
      lease: "released",
      execution: { ownerEffect: "disabled" },
    }));
    if (fault === "omitted") target.dockerHandoffs.pop();
    if (fault === "all_omitted") target.dockerHandoffs.splice(0);
    if (fault === "duplicate_saved_id") {
      const [first, second] = operations;
      assert.ok(first && second);
      second.recoveryId = first.recoveryId;
    }
    if (fault === "duplicate_capability" || fault === "duplicate_id") {
      const first = target.dockerHandoffs[0];
      assert.ok(first);
      if (fault === "duplicate_capability")
        target.dockerHandoffs.push({ ...first, recoveryId: "NEW" });
      else {
        const capability = {};
        const original = records.get(first.capability);
        assert.ok(original);
        records.set(capability, { ...original });
        target.dockerHandoffs.push({ ...first, capability });
      }
    }
    if (fault === "foreign_host" || fault === "terminal_missing") {
      const first = records.values().next().value;
      assert.ok(first);
      if (fault === "foreign_host") first.operationId = "OTHER";
      else first.terminalObservation = null;
    }
    if (fault === "foreign_result") {
      const first = target.dockerHandoffs[0];
      assert.ok(first);
      first.dockerCompletion = {};
    }
    if (fault === "lease_unknown") {
      const first = operations[0];
      assert.ok(first);
      first.lease = "unknown";
    }
    let reads = 0,
      hostReads = 0,
      cleanups = 0,
      writes = 0,
      notifications = 0,
      rejected = false;
    const complete = build(
      (cap: object) => records.get(cap),
      () => {
        reads++;
        if (fault === "empty")
          throw Error("unbound_host_must_not_borrow_stage");
        return {
          status: fault === "reader_unknown" ? "unknown" : "completed",
          lockReleased: fault !== "reader_lock_unknown",
          value: {
            payloadSha256: "same",
            snapshot: {
              operations: [
                {
                  kind: "host_operation",
                  operationId: "OP",
                  recoveryId: "HOST",
                  phase: "active",
                },
                ...operations,
              ],
            },
            operationStates: operations.map((operation) => ({
              kind: "docker_task",
              operation,
              resourcesSettled: fault !== "resource_unknown",
              restartSettled: true,
            })),
          },
        };
      },
      (value: unknown) => {
        assert.equal(value, owned);
        return "HOST";
      },
      (value: unknown) => {
        assert.equal(value, owned);
        cleanups++;
        if (fault === "cleanup_throw") throw Error("cleanup");
        return outcome;
      },
      (value: unknown) =>
        value === outcome && fault !== "cleanup_unknown" ? "completed" : null,
      (
        cap: object,
        input: { hostCleanupOutcome: unknown; dockerCompletion: unknown },
      ) => {
        assert.equal(target.hostCleanupCompleted, true);
        assert.equal(target.ownedOperation, null);
        assert.equal(target.hostRecoveryId, null);
        assert.equal(input.hostCleanupOutcome, outcome);
        assert.equal(
          input.dockerCompletion,
          records.get(cap)?.dockerCompletion,
        );
        assert.equal(notifications, 0);
        writes++;
        if (fault === "second_save" && writes === 2 && !rejected) {
          rejected = true;
          return { status: "blocked", stage: "receipt" };
        }
        records.delete(cap);
        return { status: "completed", stage: "finalization" };
      },
      setImmediate,
      () => {
        hostReads++;
        return {
          payloadSha256: fault === "host_version_changed" ? "changed" : "same",
          record: {
            kind: "host_operation",
            operationId: fault === "fresh_host_foreign" ? "OTHER" : "OP",
            recoveryId: "HOST",
            phase: fault === "fresh_host_inactive" ? "terminal" : "active",
          },
          snapshot: {
            operations: [
              {
                kind: "host_operation",
                operationId: "OP",
                recoveryId: "HOST",
                phase: "active",
              },
              ...operations,
            ],
          },
        };
      },
    );
    const result = await (fault === "retired_notification_not_called"
      ? Reflect.apply(complete, undefined, [
          target,
          () => {
            notifications++;
            throw Error("retired_callback_invoked");
          },
        ])
      : complete(target));
    assert.equal(notifications, 0, fault);
    if (["none", "empty", "retired_notification_not_called"].includes(fault)) {
      assert.equal(result.status, "completed", fault);
      assert.equal(cleanups, 1);
      assert.equal(writes, fault === "empty" ? 0 : 2);
      assert.equal(reads, fault === "empty" ? 0 : 1);
      assert.equal(hostReads, 1);
      assert.ok(
        target.dockerHandoffs.every((handoff) => handoff.state === "finalized"),
      );
    } else if (fault === "second_save") {
      assert.equal(result.status, "blocked");
      assert.equal(result.recoveryId, "R1");
      assert.equal(target.dockerHandoffs[0]?.state, "finalized");
      assert.equal(target.dockerHandoffs[1]?.state, "finalizable");
      const resumed = await complete(target);
      assert.equal(resumed.status, "completed");
      assert.equal(cleanups, 1);
      assert.equal(reads, 1);
      assert.equal(hostReads, 1);
      assert.equal(writes, 3);
    } else {
      assert.equal(result.status, "blocked", fault);
      assert.equal(writes, 0);
      assert.equal(cleanups, fault.startsWith("cleanup_") ? 1 : 0);
      assert.equal(target.hostCleanupCompleted, false);
      if (fault === "duplicate_capability" || fault === "duplicate_id")
        assert.equal(reads, 0);
      if (fault === "duplicate_saved_id") {
        assert.equal(reads, 1);
        assert.equal(hostReads, 0);
      }
      if (fault.startsWith("fresh_host_") || fault === "host_version_changed") {
        assert.equal(result.stage, "intent");
        assert.equal(result.recoveryId, "R0");
        assert.equal(hostReads, 1);
      }
    }
  }
});

/**
 * Provider開始通知の保存結果と既知Effect保持を確認する。
 * @responsibility 旧Host代役から現行通知の検証義務だけを継承する。
 * @trace ERB-UT-023
 * @precondition 条件ごとに独立したOwner・実行値・Writerを使う。
 * @stimulus 通知前と既知通知後、保存拒否・未確認・解放不明を与える。
 * @oracle 正式な三確認だけをtrueとし、既知Effectをunknownへ戻さない。
 * @cleanup N/A: メモリのみ。
 * @boundary 本番通知本文と有限Reader／Writer。
 */
test("Provider開始通知は保存三確認と既知Effectを保持する", () => {
  const create = new Function(
    "durableRecord",
    "readFixtureOperation",
    "saveOperationCheckpoint",
    operationReadFixtureSource +
      `${sourceDeclaration(recoverySource, "recordDockerProviderSubmission")}; return recordDockerProviderSubmission;`,
  );
  for (const known of [false, true])
    for (const fault of [
      "none",
      "status",
      "snapshot",
      "unlock",
      "phase",
      "summary",
    ]) {
      const capability = {},
        management = {};
      const execution = {
        providerStart: known ? "started" : "not_started",
        externalSend: known ? "issued" : "not_issued",
        sharedWrite: known ? "possible" : "not_issued",
        ownerEffect: "active",
        workspaceReusable: false,
      };
      const operation = {
        kind: "docker_task",
        recoveryId: "exact",
        phase: fault === "phase" ? "settling" : "executing",
        lease: "held",
        execution,
        primaryFailure: null,
        outcome: null,
        summarySha256: fault === "summary" ? "a".repeat(64) : null,
      };
      let writes = 0;
      const record = create(
        (value: unknown) =>
          value === capability
            ? { managementCapability: management, recoveryId: "exact" }
            : null,
        () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot: { operations: [operation] } },
        }),
        (
          owner: { identity: unknown },
          id: string,
          request: { kind: string; value: { execution: unknown } },
        ) => {
          assert.equal(owner.identity, management);
          assert.equal(id, "exact");
          assert.equal(request.kind, "lifecycle");
          writes++;
          assert.deepEqual(
            request.value.execution,
            known
              ? execution
              : {
                  ...execution,
                  providerStart: "unknown",
                  externalSend: "unknown",
                  sharedWrite: "unknown",
                },
          );
          return {
            status: fault === "status" ? "blocked" : "completed",
            snapshotConfirmed: fault !== "snapshot",
            lockReleased: fault !== "unlock",
          };
        },
      );
      const before = JSON.stringify(operation);
      assert.equal(record(capability), fault === "none");
      const expectedWrites = fault === "phase" || fault === "summary" ? 0 : 1;
      assert.equal(writes, expectedWrites);
      assert.equal(record({}), false);
      assert.equal(writes, expectedWrites);
      assert.equal(JSON.stringify(operation), before);
    }
});

/**
 * 正常終了準備の元版と元計画への再入場を確認する。
 * @responsibility 保存不明を計画固定成功へ補完しない。
 * @trace ERB-UT-023
 * @precondition 現行の五資源名と独立Owner・現在版を使う。
 * @stimulus 元版差・別Owner・不正な計画・保存三確認の失敗後に元計画を再送する。
 * @oracle 拒否時はcompletedPlanを確定せず、成功後は同じ計画参照だけを再受理する。
 * @cleanup N/A: メモリのみ。
 * @boundary 本番正常終了準備と有限下位境界。
 */
test("正常終了準備は元版・元計画と保存三確認へ再入場する", () => {
  const create = new Function(
    "durableRecord",
    "HEX64",
    "types",
    "readFixtureOperation",
    "readOwnedHostOperation",
    "isDeepStrictEqual",
    "saveOperationCheckpoint",
    sourceDeclaration(recoverySource, "validProductionPlan") +
      operationReadFixtureSource +
      `${sourceDeclaration(recoverySource, "completeDockerRecovery")}; return completeDockerRecovery;`,
  );
  for (const fault of [
    "revision",
    "hash",
    "management",
    "invalid_plan",
    "home",
    "resources",
    "status",
    "snapshot",
    "unlock",
    "writer_throw",
    "operation",
    "attempt",
    "book_missing",
    "key_missing",
    "key_duplicate",
    "key_unknown",
    "name_changed",
    ...Object.keys(executionSelection("executor")).map(
      (key) => `selection:${key}`,
    ),
  ]) {
    const capability = {},
      management = {};
    const plan = {
      operationId: "OP-123456",
      taskAttempt: 0,
      executionSelection: executionSelection("executor"),
      provider: "codex",
      consumer: "workbench",
      stableLogicalHomeBindingHash: "a".repeat(64),
      providerHomeIdentityHash: "b".repeat(64),
      ownershipLabel: "label",
      operationMode: "workbench_advice",
      authContainerName: "auth",
      providerContainerName: "provider",
      proxyContainerName: "proxy",
      internalNetworkName: "internal",
      egressNetworkName: "egress",
      providerImageDigest: "provider-image",
      proxyImageDigest: "proxy-image",
      workspaceMountMode: null,
    };
    const operation = {
      kind: "docker_task",
      recoveryId: "exact",
      identityJson: JSON.stringify(plan),
      phase: "executing",
      lease: "held",
      execution: { ownerEffect: "active" },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      resources: {
        snapshot: {
          resources: [
            ["create_subscription_auth_probe", "auth"],
            ["create_provider", "provider"],
            ["create_proxy", "proxy"],
            ["create_internal_network", "internal"],
            ["create_egress_network", "egress"],
          ].map(([key, name]) => ({
            key,
            identity: { name },
            configuration: { image: "observed-image-changed" },
          })),
        },
      },
    };
    const record: {
      managementCapability: object;
      recoveryId: string;
      operationId: string;
      cleanupCheckpoint: { revision: number; payloadSha256: string };
      homeLeaseReleased: boolean;
      completedPlan?: object;
    } = {
      managementCapability: management,
      recoveryId: "exact",
      operationId: plan.operationId,
      cleanupCheckpoint: { revision: 1, payloadSha256: "hash" },
      homeLeaseReleased: true,
    };
    let activeFault = fault,
      writes = 0;
    const complete = create(
      (value: unknown) => (value === capability ? record : null),
      /^[0-9a-f]{64}$/u,
      types,
      () => {
        const resources = operation.resources.snapshot.resources;
        const observedOperation = {
          ...operation,
          resources:
            activeFault === "book_missing"
              ? null
              : {
                  ...operation.resources,
                  snapshot: {
                    resources:
                      activeFault === "key_missing"
                        ? resources.slice(1)
                        : activeFault === "key_duplicate"
                          ? [...resources, resources[0]]
                          : resources.map((item, index) =>
                              index !== 0
                                ? item
                                : activeFault === "key_unknown"
                                  ? { ...item, key: "foreign" }
                                  : activeFault === "name_changed"
                                    ? { ...item, identity: { name: "foreign" } }
                                    : item,
                            ),
                  },
                },
        };
        return {
          status: "completed",
          lockReleased: true,
          value: {
            snapshot: {
              revision: activeFault === "revision" ? 2 : 1,
              operations: [observedOperation],
            },
            payloadSha256: activeFault === "hash" ? "changed" : "hash",
            operationStates: [
              {
                kind: "docker_task",
                operation: observedOperation,
                resourcesSettled: activeFault !== "resources",
              },
            ],
          },
        };
      },
      () => ({ record: { operationId: plan.operationId, phase: "active" } }),
      isDeepStrictEqual,
      (input: { identity: unknown }) => {
        assert.strictEqual(input.identity, management);
        writes++;
        if (activeFault === "writer_throw")
          throw Error("unpublished write failure");
        return {
          status: activeFault === "status" ? "blocked" : "completed",
          snapshotConfirmed: activeFault !== "snapshot",
          lockReleased: activeFault !== "unlock",
        };
      },
    );
    record.homeLeaseReleased = fault !== "home";
    const requestedPlan =
      fault === "invalid_plan"
        ? { ...plan, providerImageDigest: null }
        : fault === "operation"
          ? { ...plan, operationId: "OP-999999" }
          : fault === "attempt"
            ? { ...plan, taskAttempt: 1 }
            : fault.startsWith("selection:")
              ? {
                  ...plan,
                  executionSelection: {
                    ...plan.executionSelection,
                    [fault.slice("selection:".length)]: "different",
                  },
                }
              : plan;
    const rejected = complete(
      capability,
      fault === "management" ? {} : management,
      requestedPlan,
    );
    assert.equal(rejected.status, "blocked", fault);
    assert.equal(record.completedPlan, undefined, fault);
    assert.equal(
      writes,
      ["status", "snapshot", "unlock", "writer_throw"].includes(fault) ? 1 : 0,
      fault,
    );
    activeFault = "none";
    record.homeLeaseReleased = true;
    assert.equal(
      complete(capability, management, plan).status,
      "completed",
      fault,
    );
    assert.equal(record.completedPlan, plan);
    const count = writes;
    assert.equal(
      complete(capability, management, { ...plan }).status,
      "blocked",
    );
    assert.equal(complete(capability, management, plan).status, "completed");
    assert.equal(writes, count);
  }
});

/**
 * 正常終了完成操作の保存失敗後の再試行と確定後の失効を確認する。
 * @responsibility 失敗Effectを消さず、一回の確定後は元Ownerを再使用させない。
 * @trace ERB-UT-023
 * @precondition 現行終端本文と独立した私有Mapを使う。
 * @stimulus blocked→completed→再送、偽Ownerを渡す。
 * @oracle 非受理・受理未完・確定の三回だけ保存し、結果差替えと以後の再送は保存0で拒否する。
 * @cleanup N/A: メモリのみ。
 * @boundary 正常終了保存の制御と有限Writer。
 */
test("正常終了保存は失敗Effectを保持して再試行し確定後に失効する", () => {
  const capability = {},
    hostCleanupOutcome = {},
    record = {
      hostCleanupOutcome: undefined as unknown,
      dockerCompletion: {},
      settlementContext: {},
      terminalObservation: {},
    };
  const records = new WeakMap([[capability, record]]);
  let writes = 0;
  const rejected = {
      status: "blocked",
      inputAccepted: false,
      filesystemEffectIssued: true,
    },
    failed = {
      status: "blocked",
      inputAccepted: true,
      filesystemEffectIssued: true,
    },
    saved = {
      status: "completed",
      inputAccepted: true,
      filesystemEffectIssued: true,
    };
  const finalize = new Function(
    "durableRecord",
    "durableRecords",
    "completeOperation",
    "snapshotPlainRecord",
    `${sourceDeclaration(recoverySource, "finishDockerRecovery")}; return finishDockerRecovery;`,
  )(
    (value: object) => records.get(value),
    records,
    (context: unknown, cleanup: unknown, result: unknown) => {
      assert.equal(context, record.settlementContext);
      assert.equal(cleanup, hostCleanupOutcome);
      assert.equal(result, record.dockerCompletion);
      writes++;
      return writes === 1 ? rejected : writes === 2 ? failed : saved;
    },
    snapshotPlainRecord,
  );
  const completion = Object.freeze({
    hostCleanupOutcome,
    dockerCompletion: record.dockerCompletion,
  });
  assert.equal(finalize({}, completion).status, "blocked");
  assert.equal(writes, 0);
  const unaccepted = finalize(capability, completion);
  assert.equal(unaccepted.stage, "receipt");
  assert.equal(unaccepted.inputAccepted, false);
  assert.equal(unaccepted.filesystemEffectIssued, true);
  assert.equal(record.hostCleanupOutcome, undefined);
  const pending = finalize(capability, completion);
  assert.equal(pending.status, "blocked");
  assert.equal(pending.filesystemEffectIssued, true);
  assert.equal(record.hostCleanupOutcome, hostCleanupOutcome);
  assert.equal(
    finalize(capability, { ...completion, dockerCompletion: {} }).status,
    "blocked",
  );
  assert.equal(
    finalize(capability, { ...completion, hostCleanupOutcome: {} }).status,
    "blocked",
  );
  assert.equal(writes, 2);
  assert.equal(finalize(capability, completion).status, "completed");
  assert.equal(finalize(capability, completion).status, "blocked");
  assert.equal(writes, 3);
});

/**
 * 初期化失敗の診断結合とHome解放後の放棄を区別する。
 * @responsibility exact相関の拒否と未解決記録の保持を確認する。
 * @trace ERB-UT-023
 * @precondition 条件ごとに独立した失敗OwnerとMapを使う。
 * @stimulus 別Capability・参照・管理Owner・Home・理由、Home未解放／解放を渡す。
 * @oracle 診断別名から実行成功を作らず、放棄で未解決の保存状態を消さない。
 * @cleanup N/A: メモリのみ。
 * @boundary 初期化失敗の私有相関と放棄結果。
 */
test("初期化失敗はexact相関だけを結合しHome解放後も記録を保持する", () => {
  for (const fault of [
    "none",
    "capability",
    "reference",
    "management",
    "home",
    "reason",
    "ready",
  ]) {
    const capability = {},
      management = {},
      alias = {};
    const record = {
      capability,
      managementCapability: management,
      recoveryId: "exact",
      stableLogicalHomeBindingHash: "home",
      initializationFailure: "failure",
      initializationReady: fault === "ready",
      homeLeaseReleased: false,
    };
    const records = new WeakMap([[capability, record]]);
    const api = new Function(
      "durableRecords",
      operationReadFixtureSource +
        `${sourceDeclaration(recoverySource, "durableRecord")}\n${sourceDeclaration(recoverySource, "bindDockerInitializationFailure")}\n${sourceDeclaration(recoverySource, "abandonDockerRecovery")}\n${sourceDeclaration(recoverySource, "verifyDockerRecoveryBinding")};return {bind:bindDockerInitializationFailure,abandon:abandonDockerRecovery,verify:verifyDockerRecoveryBinding};`,
    )(records);
    assert.equal(
      api.bind(
        fault === "capability" ? {} : capability,
        fault === "reference" ? "foreign" : "exact",
        fault === "management" ? {} : management,
        fault === "home" ? "foreign" : "home",
        fault === "reason" ? "foreign" : "failure",
        alias,
      ),
      fault === "none",
    );
    assert.equal(records.has(alias), fault === "none");
    assert.equal(api.abandon({}), false);
    assert.equal(api.abandon(capability), false);
    const before = JSON.stringify(record);
    record.homeLeaseReleased = true;
    assert.equal(
      api.bind(alias, "exact", management, "home", "failure", {}),
      false,
    );
    assert.equal(api.abandon(alias), false);
    assert.equal(api.verify(alias, "exact", management, "home"), false);
    assert.equal(api.abandon(capability), true);
    assert.equal(records.get(capability), record);
    assert.equal(record.initializationFailure, "failure");
    assert.equal(
      JSON.stringify({ ...record, homeLeaseReleased: false }),
      before,
    );
  }
});

/**
 * 不存在観測の保存確認とfresh読戻しを共同確認する。
 * @responsibility 保存不明を清掃Checkpointへ固定せず、確認済みの再送を拒否する。
 * @trace ERB-UT-023
 * @precondition 条件ごとのOwner・Writer結果・Readerを使う。
 * @stimulus 保存拒否／未確認／解放不明、読戻し不明／別版／別Hashを与える。
 * @oracle 全確認後だけ元版を固定し、二度目のWriter0とする。
 * @cleanup N/A: メモリのみ。
 * @boundary 本番不存在受付と有限保存／読戻し。
 */
test("不存在観測は保存とfresh読戻しの共同確認後だけ一度固定する", () => {
  for (const fault of [
    "status",
    "snapshot",
    "unlock",
    "read_status",
    "read_unlock",
    "revision",
    "hash",
  ]) {
    const capability = {},
      management = {};
    const observations: unknown[] = [];
    const record: {
      capability: object;
      initializationReady: boolean;
      managementCapability: object;
      recoveryId: string;
      cleanupCheckpoint?: object;
    } = {
      capability,
      initializationReady: true,
      managementCapability: management,
      recoveryId: "exact",
    };
    const records = new WeakMap([[capability, record]]);
    let activeFault = fault,
      writes = 0;
    const invoke = new Function(
      "durableRecords",
      "saveOperationCheckpoint",
      "readFixtureOperation",
      operationReadFixtureSource +
        `${sourceDeclaration(recoverySource, "durableRecord")}\n${sourceDeclaration(recoverySource, "recordDockerAbsence")};return recordDockerAbsence;`,
    )(
      records,
      (
        owner: { identity: unknown },
        id: string,
        request: { kind: string; value: unknown },
      ) => {
        assert.equal(owner.identity, management);
        assert.equal(id, "exact");
        assert.equal(request.kind, "cleanup");
        assert.equal(request.value, observations);
        writes++;
        return {
          status: activeFault === "status" ? "blocked" : "completed",
          snapshotConfirmed: activeFault !== "snapshot",
          lockReleased: activeFault !== "unlock",
          revision: 1,
          payloadSha256: "hash",
        };
      },
      () => ({
        status: activeFault === "read_status" ? "blocked" : "completed",
        lockReleased: activeFault !== "read_unlock",
        value: {
          snapshot: { revision: activeFault === "revision" ? 2 : 1 },
          payloadSha256: activeFault === "hash" ? "foreign" : "hash",
        },
      }),
    );
    assert.equal(invoke(capability, observations), false, fault);
    assert.equal(record.cleanupCheckpoint, undefined, fault);
    activeFault = "none";
    assert.equal(invoke(capability, observations), true);
    assert.deepEqual(record.cleanupCheckpoint, {
      revision: 1,
      payloadSha256: "hash",
    });
    const count = writes;
    assert.equal(invoke(capability, observations), false);
    assert.equal(writes, count);
  }
});

/**
 * 実Executorの未開始理由をCoordinatorの既存記録要求へ搬送する。
 * @responsibility Writerへ渡す元理由・段階・参照と、拒否時の保存非到達を確認する。
 * @trace ERB-UT-023
 * @precondition 実Coordinator宣言と自己生成した現行Stateだけを使う。
 * @stimulus 四つの未開始理由、既開始Control、別Owner／参照、Effectありと未知理由を与える。
 * @observation 要求の全fieldとWriter到達回数。EM内部の候補生成はEM自身の試験が確認する。
 * @oracle 既知の未開始結果だけを記録要求へ送り、Home解放・Host回収・最終成功を先書きしない。
 * @cleanup メモリのみ。
 * @boundary Coordinatorの記録要求。実保存・Filesystem・Docker・AIは使用しない。
 */
test("未開始拒否の四理由は元段階と参照を保って記録要求へ渡る", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const createRecorder = new Function(
    "durableRecord",
    "readFixtureOperation",
    "saveOperationCheckpoint",
    operationReadFixtureSource +
      String(sourceDeclaration(source, "recordUnstartedAttempt")) +
      "\nreturn recordUnstartedAttempt;",
  );
  for (const reason of [
    "docker_process_controller_plan_invalid",
    "docker_process_controller_recovery_unavailable",
    "docker_process_controller_home_lock_initialization_failed",
    "docker_process_controller_home_lock_descriptor_close_unconfirmed",
  ]) {
    const fixture = createResourceOperationFixture();
    const before = Buffer.from(fixture.bytes);
    const snapshot = JSON.parse(fixture.bytes.toString("utf8"));
    const capability = {},
      management = {},
      control = {};
    const owner: {
      managementCapability: object;
      recoveryId: string;
      executorControl?: object;
    } = {
      managementCapability: management,
      recoveryId: fixture.recoveryId,
    };
    let writes = 0,
      reads = 0,
      captured: unknown = null;
    const record = createRecorder(
      (value: unknown) => (value === capability ? owner : null),
      (value: unknown) => {
        assert.strictEqual(value, management);
        reads++;
        return { status: "completed", lockReleased: true, value: { snapshot } };
      },
      (
        value: { identity: unknown },
        id: unknown,
        checkpoint: { kind: string; value: unknown },
      ) => {
        assert.strictEqual(value.identity, management);
        assert.equal(id, fixture.recoveryId);
        assert.equal(checkpoint.kind, "lifecycle");
        captured = checkpoint.value;
        writes++;
        return {
          status: "completed",
          snapshotConfirmed: true,
          lockReleased: true,
        };
      },
    );
    const result = {
      status: "blocked",
      reason,
      recoveryId: fixture.recoveryId,
      dockerEffectStarted: false,
      providerRequestStarted: false,
    };
    assert.equal(record(capability, management, result), true);
    assert.deepEqual(captured, {
      phase: "executing",
      lease: "held",
      execution: { ...fixture.operation.execution, ownerEffect: "disabled" },
      primaryFailure: {
        purpose: null,
        stage:
          reason === "docker_process_controller_plan_invalid"
            ? "plan_validation"
            : "home_lock",
        reason,
        exceptionCode: null,
        commandHandleObtained: false,
        responseObserved: false,
        receiptRecorded: false,
      },
      outcome: null,
      summarySha256: null,
    });
    assert.equal(writes, 1);
    for (const mutation of [
      { ...result, reason: "unknown" },
      { ...result, status: "started" },
      { ...result, recoveryId: fixture.recoveryId + "x" },
      { ...result, dockerEffectStarted: true },
      { ...result, providerRequestStarted: true },
    ])
      assert.equal(record(capability, management, mutation), false);
    assert.equal(record({}, management, result), false);
    assert.equal(record(capability, {}, result), false);
    owner.executorControl = control;
    assert.equal(record(capability, management, result), false);
    assert.equal(reads, 1);
    assert.equal(writes, 1);
    assert.deepEqual(fixture.bytes, before);
    assert.deepEqual(snapshot, JSON.parse(before.toString("utf8")));
  }
});

const selection = executionSelection("advice");
const prepared = prepareProviderAdviceInput(
  Object.freeze({
    additionalHosts: Object.freeze([]),
    providerPrompt: "固定投影だけを根拠に説明する",
    allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
  }),
  selection,
);
if (!prepared) throw new Error("test_execution_plan_required");
const plan = prepared;
const dockerRecoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

/**
 * Controller引渡し後の失敗から初回結果へexact参照を保持する。
 * @responsibility Host清掃だけによるDocker回収完了の誤認と参照上書きを反証する。
 * @trace ERB-UT-023
 * @precondition 外部資源を作らない既存の合成Runtime依存を使用する。
 * @stimulus 同期例外、取消、完了失敗、清掃不明、二重引渡しとfinalize失敗を与える。
 * @observation 私有分類のexact参照、Host清掃、取消と公開JSONを照合する。
 * @oracle finalize前の失敗は同じIDを保持し、正常finalizeだけ参照を解放する。
 * @cleanup N/A: メモリ内の代役だけを使う。
 * @boundary ERB-UT-023=Direct Boundary: Controller引渡し→助言Runtime初回結果。
 */
test("助言は引渡し済みDocker参照を初回失敗まで保持し正式終了後だけ解放する", async () => {
  for (const scenario of [
    "normal",
    "throw",
    "blocked",
    "cancel",
    "completion_throw",
    "cleanup_unknown",
    "finalize_failed",
    "duplicate",
    "different",
    "missing",
    "invalid",
  ]) {
    const current = fixture();
    const abort = new AbortController();
    const dependencies: TestAdviceDependencies = {
      ...current.dependencies,
      startProcess(
        ...args: Parameters<TestAdviceDependencies["startProcess"]>
      ) {
        const register = args[2] as (
          capability: unknown,
          id: unknown,
        ) => boolean;
        if (scenario === "missing")
          return {
            status: "started",
            controlCapability: {},
            completion: Promise.resolve({}),
          };
        if (scenario === "invalid") {
          assert.equal(register({}, "invalid"), false);
          assert.equal(register({}, dockerRecoveryId), false);
          return { status: "blocked", reason: "synthetic_invalid_handoff" };
        }
        const started = current.dependencies.startProcess(...args) as {
          completion: Promise<Record<string, unknown>>;
        };
        if (scenario === "throw") throw Error("synthetic_after_handoff");
        if (scenario === "blocked")
          return { status: "blocked", reason: "synthetic_start_blocked" };
        if (scenario === "duplicate" || scenario === "different") {
          assert.equal(
            register(
              {},
              scenario === "duplicate"
                ? dockerRecoveryId
                : dockerRecoveryId.replace(/1/g, "4"),
            ),
            false,
          );
        }
        return {
          ...started,
          completion: started.completion.then((completed) => {
            if (scenario === "completion_throw")
              throw Error("synthetic_completion");
            if (scenario === "cancel") abort.abort();
            return scenario === "cleanup_unknown" || scenario === "cancel"
              ? { ...completed, cleanupConfirmed: false }
              : completed;
          }),
        };
      },
      completeHostOperation:
        scenario === "finalize_failed"
          ? createHostCompletionFixture({
              cleanup: current.cleanupBoundary,
              classify: current.classifyBoundary,
              finish: () => ({ status: "blocked", stage: "finalization" }),
            })
          : current.dependencies.completeHostOperation,
    } as unknown as TestAdviceDependencies;
    const result = await executeProviderAdvice(
      dependencies,
      plan,
      abort.signal,
    );
    const classification = classifyProviderAdviceHostFailure(result);
    if (scenario === "normal") {
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(classification, null);
    } else if (scenario === "missing" || scenario === "invalid") {
      assert.equal(result.status, "blocked");
      assert.equal(classification?.dockerRecoveryId, null);
    } else {
      assert.equal(result.status, "blocked", scenario);
      assert.equal(result.cleanupConfirmed, false, scenario);
      assert.equal(
        classification?.dockerRecoveryId,
        dockerRecoveryId,
        scenario,
      );
      assert.equal(
        classification?.hostRecoveryId,
        scenario === "finalize_failed" ? null : "HOST-RECOVERY",
        scenario,
      );
      if (scenario === "throw" || scenario === "blocked")
        assert.equal(
          current.calls.includes("cleanup-operation"),
          false,
          scenario,
        );
    }
    assert.equal(JSON.stringify(result).includes(dockerRecoveryId), false);
    assert.equal(classifyProviderAdviceHostFailure({ ...result }), null);
  }
});

/**
 * fixture用の試験入力または観測処理を提供する。
 *
 * @responsibility fixture用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus fixtureの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(
  overrides: Partial<TestAdviceDependencies> = {},
  options: Readonly<{
    selectionPreflightMismatch?: boolean;
    selectionPreflightUnavailable?: boolean;
    packetIssueInvalid?: boolean;
    packetRevokeOutcome?: "false" | "unknown" | "throw";
    recoveryAbandonOutcome?: "false" | "unknown" | "throw";
    startAfterHandoffThrows?: boolean;
    poisonNotificationThrows?: boolean;
    hostCleanup?: "completed" | "unknown" | "throw";
  }> = {},
) {
  const owned = Object.freeze({});
  const mountCapability = Object.freeze({});
  const managementCapability = Object.freeze({});
  const packetOwner = Object.freeze({});
  const packetUse = Object.freeze({});
  const processControl = Object.freeze({});
  const recoveryCapability = Object.freeze({});
  const calls: string[] = [];
  /** 有限Host境界。実Filesystemは操作しない。 @trace ERB-UT-023 */
  const cleanupBoundary = (_owned: object) => {
    calls.push("cleanup-operation");
    if (options.hostCleanup === "throw")
      throw Error("fixture_host_cleanup_failed");
    return Object.freeze({ status: "completed" as const });
  };
  /** 清掃の不明を成功へ補完しない。 @trace ERB-UT-023 */
  const classifyBoundary = () =>
    options.hostCleanup === "unknown" ? null : ("completed" as const);
  const runtimeObservation = {
    providerHomeCount: 0,
  };
  const adviceJson = JSON.stringify({
    status: "completed",
    facts: [],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  });
  const dependencies = Object.freeze({
    createOperation: async () => {
      calls.push("create-operation");
      return Object.freeze({
        owned,
        mountCapability,
        managementCapability,
        operationId: "OP-123456",
        hostRecoveryId: "HOST-RECOVERY",
      });
    },
    bindRepository: () => {
      calls.push("bind-repository");
      return Object.freeze({ operationId: "OP-123456" });
    },
    observeProviderHome: () => {
      calls.push("observe-provider-home");
      runtimeObservation.providerHomeCount++;
      return Object.freeze({
        status: "candidate" as const,
        provider: plan.executionSelection.provider,
        providerHome: Object.freeze({
          provider: plan.executionSelection.provider,
          providerHomeSourcePath: "C:\\provider-home",
          providerHomeIdentityHash: "a".repeat(64),
          stableLogicalHomeBindingHash: "b".repeat(64),
        }),
      });
    },
    preflightSelections: (_management: unknown, request: unknown) => {
      calls.push("preflight-selections");
      const record = request as Readonly<Record<string, unknown>>;
      assert.deepEqual(record, {
        operationId: "OP-123456",
        executionSelections: [plan.executionSelection],
      });
      if (
        options.selectionPreflightUnavailable ||
        options.selectionPreflightMismatch
      )
        return Object.freeze({
          status: "blocked" as const,
          reason: "provider_unavailable",
        });
      return Object.freeze({ status: "matched" as const });
    },
    issuePacket: (
      input: Readonly<Record<string, unknown>>,
      selected: unknown,
    ) => {
      calls.push("issue-packet");
      assert.equal(input.taskHash, plan.taskHash);
      assert.equal(input.projectionHash, plan.projectionHash);
      assert.equal(selected, plan.executionSelection);
      assert.equal(Object.hasOwn(input, "executionSelection"), false);
      return Object.freeze({
        status: options.packetIssueInvalid
          ? ("blocked" as const)
          : ("issued" as const),
        ownerCapability: packetOwner,
        useCapability: packetUse,
        packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
      });
    },
    revokePacket: () => {
      calls.push("revoke-packet");
      if (options.packetRevokeOutcome === "throw")
        throw Error("fixture_packet_revoke_failed");
      return options.packetRevokeOutcome === "unknown"
        ? undefined
        : options.packetRevokeOutcome === "false"
          ? false
          : true;
    },
    startProcess: (
      _provider: "codex" | "claude",
      input: PreparationInput,
      register: unknown,
    ) => {
      assert.strictEqual(input.managementCapability, managementCapability);
      assert.equal(input.purpose, "advice");
      if (input.purpose !== "advice") throw Error("fixture_purpose_invalid");
      assert.equal(
        input.packetRef,
        "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
      );
      assert.equal(input.taskAttempt, 0);
      assert.equal(
        input.providerHome.provider,
        plan.executionSelection.provider,
      );
      assert.equal(Object.hasOwn(input, "selectionUseCapability"), false);
      assert.equal(Object.hasOwn(input, "mountAuthorizationCapability"), false);
      calls.push("start-process");
      calls.push("register-recovery");
      assert.equal(
        (register as (capability: unknown, id: string) => boolean)(
          recoveryCapability,
          dockerRecoveryId,
        ),
        true,
      );
      if (options.startAfterHandoffThrows)
        throw Error("fixture_start_after_handoff_failed");
      return Object.freeze({
        status: "started" as const,
        dockerEffectStarted: true,
        controlCapability: processControl,
        completion: Promise.resolve(
          Object.freeze({
            status: "completed" as const,
            reason: "provider_operation_completed",
            cleanupConfirmed: true,
            recoveryFinalizationCapability: recoveryCapability,
            normalizedResult: Object.freeze({
              ...JSON.parse(adviceJson),
              reason: null,
            }),
          }),
        ),
      });
    },
    cancelProcess: async () => Object.freeze({ status: "cancelled" as const }),
    completeHostOperation: createHostCompletionFixture({
      cleanup: cleanupBoundary,
      classify: classifyBoundary,
      prepare: () => {
        calls.push("prepare-docker-host-cleanup");
        return "HOST-RECOVERY";
      },
      finish: () => {
        calls.push("record-docker-host-cleanup");
        calls.push("finalize-docker-recovery");
        return Object.freeze({ status: "completed" as const });
      },
    }),
    abandonDockerRecovery: () => {
      calls.push("abandon-docker-recovery");
      if (options.recoveryAbandonOutcome === "throw")
        throw Error("fixture_recovery_abandon_failed");
      return options.recoveryAbandonOutcome === "unknown"
        ? undefined
        : options.recoveryAbandonOutcome === "false"
          ? false
          : true;
    },
    abandonOperation: async () => {
      calls.push("abandon-operation");
      return Object.freeze({ status: "retained" });
    },
    poisonAfterCleanupUnknown: () => {
      calls.push("poison");
      if (options.poisonNotificationThrows)
        throw Error("fixture_poison_notification_failed");
    },
    ...overrides,
  }) as unknown as TestAdviceDependencies;
  return Object.freeze({
    dependencies,
    cleanupBoundary,
    classifyBoundary,
    calls,
    adviceJson,
    runtimeObservation,
  });
}

/**
 * 助言終了へ元結果を搬送し、Host Protocol失敗を成功へ変更しない。
 *
 * @responsibility Host清掃分類と元結果搬送の共同条件を検証する。
 * @trace ERB-UT-023
 * @precondition 固定助言と同じRuntimeの模擬Controller・Host結果を使用する。
 * @stimulus 清掃成功、Protocol失敗の清掃確認、分類不能を順に実行する。
 * @observation 記録callbackの引数同一性、呼出し数、公開結果を取得する。
 * @oracle 成功分類だけ元結果を搬送し、Protocol失敗はblocked、分類不能は記録0。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary 助言Ownerと模擬Host／Controllerの終了境界。
 */
test("助言終了は元結果を搬送しProtocol失敗と分類不能を成功へ変更しない", async () => {
  for (const classification of [
    "completed",
    "protocol_failure_cleanup_confirmed",
    null,
  ] as const) {
    const current = fixture();
    let dockerCompletion: unknown;
    let hostCleanupOutcome: unknown;
    let receipts = 0;
    const dependencies: TestAdviceDependencies = {
      ...current.dependencies,
      startProcess(...args) {
        const started = current.dependencies.startProcess(...args);
        const completion = (
          started as { completion: Promise<unknown> }
        ).completion.then((result) => {
          dockerCompletion = result;
          return result;
        });
        return Object.freeze({ ...started, completion }) as typeof started;
      },
      completeHostOperation: createHostCompletionFixture({
        cleanup(owned) {
          hostCleanupOutcome = current.cleanupBoundary(owned);
          return hostCleanupOutcome;
        },
        classify: () => classification,
        finish(_capability, completion) {
          receipts += 1;
          assert.equal(Object.isFrozen(completion), true);
          assert.equal(completion.hostCleanupOutcome, hostCleanupOutcome);
          assert.equal(completion.dockerCompletion, dockerCompletion);
          current.calls.push("finalize-docker-recovery");
          return Object.freeze({
            status: "completed",
            stage: "finalization",
            inputAccepted: true,
            revision: null,
            payloadSha256: null,
            recoveryIds: [],
            reason: "operation_completed",
            snapshotConfirmed: true,
            lockReleased: true,
            filesystemEffectIssued: false,
            recoveryId: dockerRecoveryId,
          });
        },
      }),
    };
    const result = await executeProviderAdvice(
      dependencies,
      plan,
      new AbortController().signal,
    );
    assert.equal(
      result.status,
      classification === "completed" ? "completed" : "blocked",
    );
    assert.equal(receipts, classification === null ? 0 : 1);
    assert.equal(
      current.calls.includes("finalize-docker-recovery"),
      classification !== null,
    );
    if (classification === "protocol_failure_cleanup_confirmed") {
      assert.equal(result.reason, "workbench_ai_advice_host_generation_lost");
      assert.equal(result.cleanupConfirmed, true);
    }
  }
});

/**
 * 署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返すを検証する。
 *
 * @responsibility 署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名資格なしで実行しHost／Docker cleanup完了後にだけ助言JSONを返す", async () => {
  const current = fixture();
  let lowerCompletion: unknown;
  const result = await executeProviderAdvice(
    {
      ...current.dependencies,
      startProcess: (...args) => {
        const started = current.dependencies.startProcess(...args);
        if (started.status !== "started") return started;
        return {
          ...started,
          completion: started.completion.then((result) => {
            lowerCompletion = result;
            return result;
          }),
        };
      },
      completeHostOperation: (target, notify) => {
        assert.ok(lowerCompletion);
        assert.equal(target.dockerHandoffs.length, 1);
        assert.equal(target.dockerHandoffs[0]?.state, "finalizable");
        assert.strictEqual(
          target.dockerHandoffs[0]?.dockerCompletion,
          lowerCompletion,
        );
        return current.dependencies.completeHostOperation(target, notify);
      },
    },
    plan,
    new AbortController().signal,
  );
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    advice: Object.freeze({ ...JSON.parse(current.adviceJson), reason: null }),
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
  assert.deepEqual(current.calls, [
    "create-operation",
    "bind-repository",
    "preflight-selections",
    "observe-provider-home",
    "issue-packet",
    "start-process",
    "register-recovery",
    "prepare-docker-host-cleanup",
    "cleanup-operation",
    "record-docker-host-cleanup",
    "finalize-docker-recovery",
  ]);
});

/**
 * Production要求の完全選定を直接準備入力へ接続することを検証する。
 *
 * @responsibility Workbenchが生成した完全選定を実Selection Runtimeへ渡し、完全選定の搬送まで同じLifecycleで成立することを確認する。
 * @trace ERB-UT-023
 * @precondition Workbench Production Runtimeの他境界は決定論的fixtureとし、Selection境界だけを実Runtimeへ接続する。
 * @stimulus 明示Codex Profileを持つWorkbench助言を実行する。
 * @observation Production要求、Selection発行一回、同Grant消費とProvider Effectを観測する。
 * @oracle 完全選定をProvider準備へ直接搬送して助言が完了する。
 * @cleanup Workbench LifecycleがOperationとProvider資源を清掃し、Selection Authorityは失効または消費済みになる。
 * @boundary ERB-UT-023=Direct Boundary: Workbench Production Runtime→Delegation 入力選定→Provider準備
 */
test("Production要求を実Selection Runtimeへ直接接続できる", async () => {
  const current = fixture();
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.deepEqual(result, {
    status: "completed",
    reason: null,
    advice: Object.freeze({ ...JSON.parse(current.adviceJson), reason: null }),
    providerEffectIssued: true,
    cleanupConfirmed: true,
  });
  assert.equal(current.runtimeObservation.providerHomeCount, 1);
});

/**
 * Home準備前の非発行判定が不成立なら資源許可へ進まない。
 * @responsibility Provider可用性不成立をGrant発行の代用にせず早期拒否する。
 * @trace ERB-UT-023
 * @precondition 局所preflightだけをblockedへ差し替える。
 * @stimulus 通常の固定助言計画を実行する。
 * @observation Home観測、Selection発行、Mount消費、Provider EffectとOperation清掃。
 * @oracle Home観測・Grant発行・Provider Effectは0、取得済みOperationだけ清掃する。
 * @cleanup メモリ内代役のOperation清掃を確認する。
 * @boundary 助言の非発行preflightとHome準備。
 */
test("助言の非発行preflight拒否はHome観測とProvider要求より前に停止する", async () => {
  const current = fixture({}, { selectionPreflightUnavailable: true });
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_selection_unavailable");
  assert.equal(current.runtimeObservation.providerHomeCount, 0);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
  assert.equal(result.cleanupConfirmed, true);
});

/**
 * Repository結合が不成立なら選定観測とProvider Effectへ進まないことを検証する。
 *
 * @responsibility Workbench助言Operationを元Repository Identityへ結合できない状態をFail Closedにする。
 * @trace ERB-UT-023
 * @precondition Operation生成は成立するがRepository結合だけが不成立である。
 * @stimulus Workbench助言Production Runtimeを実行する。
 * @observation 結果理由、Selection、Mount、Packet、Process、Provider EffectおよびOperation cleanupを観測する。
 * @oracle Repository結合固有理由でblockedとなり、後続Authority・Effect 0、Operation cleanup 1になる。
 * @cleanup Operation cleanupが完了し、Process外資源を残さない。
 * @boundary ERB-UT-023=Direct Boundary: Repository Identity→選定適合の現在観測
 */
test("Repository結合が不成立なら選定観測とProvider Effectへ進まない", async () => {
  const current = fixture({ bindRepository: () => null });
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_repository_binding_unavailable",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(current.calls.includes("observe-provider-home"), false);
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
});

/**
 * 作成済みOperationの保存拒否をProvider前で止める。
 * @responsibility 作成・保存・実開始の三境界を混同しない。
 * @trace ERB-UT-023
 * @precondition 外部資源を持たない固定依存を用いる。
 * @stimulus 保存callbackの拒否とHost清掃の成立・不明を組み合わせる。
 * @observation callbackの実ID、Provider開始0、清掃回数と元Host参照。
 * @oracle 保存前Provider0、清掃不明でも同exact参照を保持する。
 * @cleanup 偽依存だけでProcess外資源0。
 * @boundary Operation作成通知と上位Writer。
 */
test("RO Operation参照の保存拒否はProvider前で停止しHost回収結果を残す", async () => {
  for (const mode of ["completed", "unknown", "throw"] as const) {
    const cleanup = mode === "completed";
    let notified = 0;
    let observed: HostCompletionTarget | undefined;
    const current = fixture(
      {
        observeOperation: async (operation) => {
          notified++;
          assert.deepEqual(operation, {
            operationId: "OP-123456",
            hostRecoveryId: "HOST-RECOVERY",
          });
          throw Error("fixture_operation_save_failed");
        },
      },
      { hostCleanup: mode },
    );
    const result = await executeProviderAdvice(
      {
        ...current.dependencies,
        completeHostOperation: async (target, notify) => {
          observed = target;
          assert.equal(target.dockerHandoffs.length, 0);
          return current.dependencies.completeHostOperation(target, notify);
        },
      },
      plan,
      new AbortController().signal,
    );
    assert.equal(notified, 1);
    assert.equal(
      result.reason,
      "workbench_ai_advice_operation_save_unconfirmed",
    );
    assert.equal(result.providerEffectIssued, false);
    assert.equal(current.calls.includes("start-process"), false);
    assert.equal(
      current.calls.filter((call) => call === "cleanup-operation").length,
      1,
    );
    assert.equal(result.cleanupConfirmed, cleanup);
    assert.ok(observed);
    assert.equal(observed.hostCleanupCompleted, cleanup);
    assert.equal(observed.hostRecoveryId, cleanup ? null : "HOST-RECOVERY");
    assert.equal(observed.ownedOperation === null, cleanup);
    assert.equal(
      classifyProviderAdviceHostFailure(result)?.hostRecoveryId,
      cleanup ? null : "HOST-RECOVERY",
    );
  }
});

/**
 * preflightの完全選定が固定計画と異なる場合はProvider Effectを発行しない。
 *
 * @responsibility 短命Selection発行時の固定計画との差をProvider Effect前に拒否する。
 * @trace ERB-UT-023
 * @precondition Repository結合、非発行preflight、Provider Home再観測およびMount Grant消費は成立する。
 * @stimulus 唯一Selectionの完全選定を固定計画から変更してWorkbench助言Runtimeを実行する。
 * @observation 一回のSelection、その失効、Packet、Process、Effectおよびcleanupを観測する。
 * @oracle Selection不成立理由でblockedとなり、唯一Selectionを失効してProvider Effect 0で閉じる。
 * @cleanup Operation cleanupが完了し、Process外資源を残さない。
 * @boundary ERB-UT-023=Direct Boundary: Mount完了→Effect直前Selection発行
 */
test("preflightの完全選定が固定計画と異なる場合はProvider Effectを発行しない", async () => {
  const current = fixture({}, { selectionPreflightMismatch: true });
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_selection_unavailable");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(current.calls.includes("issue-packet"), false);
  assert.equal(current.calls.includes("start-process"), false);
  assert.equal(
    current.calls.filter((call) => call === "cleanup-operation").length,
    1,
  );
});

/**
 * Host cleanup不成立後は助言を公開せず回復状態を保持するを検証する。
 *
 * @responsibility Host cleanup不成立後は助言を公開せず回復状態を保持するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Host cleanup不成立後は助言を公開せず回復状態を保持するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host cleanup不成立後は助言を公開せず回復状態を保持する", async () => {
  const current = fixture({
    completeHostOperation: async (target) =>
      Object.freeze({
        status: "blocked",
        stage: "intent",
        recoveryId: target.dockerHandoffs[0]?.recoveryId ?? null,
        hostCleanup: null,
        error: undefined,
      }),
  });
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_host_cleanup_intent_unconfirmed",
  );
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.advice, null);
});

/**
 * 助言のPacket失効結果を他の終了処理と分けて保持する。
 * @responsibility 拒否・未知値・例外を成功にせず、後続失効とHost処置を継続する。
 * @trace ERB-UT-023
 * @precondition Packet受付が不成立の局所fixtureを使う。
 * @stimulus 各失効の成功・拒否・未知値・例外とpoison通知例外を与える。
 * @observation 失効回数、一次理由、私有Host参照、清掃・保持とpoison。
 * @oracle 成功だけをcleanとし、Packet例外でも後続失効と元結果登録を行う。
 * @cleanup メモリ内の終了処理。実資源を生成しない。
 * @boundary 助言catchと未消費Authority・Hostの終了。
 */
test("助言のPacket失効拒否・未知値・例外でも後続処置と元結果を保持する", async () => {
  for (const target of ["packet"] as const) {
    for (const outcome of [
      "success",
      "rejected",
      "unknown",
      "throw",
    ] as const) {
      for (const poisonNotificationThrows of [false, true]) {
        const confirmed = outcome === "success";
        const current = fixture(
          {},
          {
            packetIssueInvalid: true,
            ...(!confirmed
              ? {
                  packetRevokeOutcome:
                    outcome === "rejected" ? ("false" as const) : outcome,
                }
              : {}),
            poisonNotificationThrows,
          },
        );
        const result = await executeProviderAdvice(
          current.dependencies,
          plan,
          new AbortController().signal,
        );
        assert.equal(
          result.reason,
          "workbench_ai_advice_runtime_packet_unavailable",
        );
        assert.equal(result.cleanupConfirmed, confirmed);
        assert.equal(result.providerEffectIssued, false);
        const failure = classifyProviderAdviceHostFailure(result);
        assert.equal(failure?.manualRecoveryRequired, !confirmed);
        assert.equal(failure?.hostRecoveryId, null);
        assert.equal(failure?.dockerRecoveryId, null);
        for (const [call, count] of [
          ["revoke-packet", target === "packet" ? 1 : 0],
          ["cleanup-operation", 1],
          ["abandon-operation", 0],
          ["poison", confirmed ? 0 : 1],
        ] as const)
          assert.equal(
            current.calls.filter((x) => x === call).length,
            count,
            call,
          );
        assert.equal(current.calls.includes("start-process"), false);
      }
    }
  }
});

/**
 * 回復放棄不明でも元Docker参照とHost保持を継続する。
 * @responsibility Packet失効例外と回復放棄例外を独立して捕捉する。
 * @trace ERB-UT-023
 * @precondition 開始境界がexact Docker参照を引き渡してから失敗する。
 * @stimulus 失効例外と回復放棄の成功・拒否・未知値・例外を組み合わせる。
 * @observation 各処置の回数、一次理由と元Host・Docker参照。
 * @oracle 全処置を一回試み、poison通知例外でも元結果と参照を保持する。
 * @cleanup 模擬の保持処理。実Docker・Processを作らない。
 * @boundary 助言の開始失敗と失効・回復引渡し・結果登録。
 */
test("助言は失効例外と回復放棄不明でも元Docker参照とHost保持を失わない", async () => {
  for (const outcome of ["success", "false", "unknown", "throw"] as const) {
    for (const poisonNotificationThrows of [false, true]) {
      const current = fixture(
        {},
        {
          startAfterHandoffThrows: true,
          packetRevokeOutcome: "throw",
          ...(outcome === "success" ? {} : { recoveryAbandonOutcome: outcome }),
          poisonNotificationThrows,
        },
      );
      const result = await executeProviderAdvice(
        current.dependencies,
        plan,
        new AbortController().signal,
      );
      assert.equal(result.reason, "workbench_ai_advice_runtime_failed_closed");
      assert.equal(result.cleanupConfirmed, false);
      assert.deepEqual(classifyProviderAdviceHostFailure(result), {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        hostRecoveryId: "HOST-RECOVERY",
        dockerRecoveryId,
      });
      for (const call of [
        "revoke-packet",
        "abandon-docker-recovery",
        "abandon-operation",
        "poison",
      ])
        assert.equal(current.calls.filter((x) => x === call).length, 1, call);
      assert.equal(current.calls.includes("cleanup-operation"), false);
      assert.equal(current.calls.includes("finalize-docker-recovery"), false);
    }
  }
});

/**
 * 所有Operation作成の固定された失敗分類を実際の状態機械から取得する。
 *
 * @responsibility 清掃確認済みと未確認を同じ作成失敗の反例として用意する。
 * @trace ERB-UT-023
 * @precondition メモリ内の偽所有対象と固定参照だけを使う。
 * @stimulus 現Directory producerの私有失敗分類へ指定した清掃結果を渡す。
 * @observation 作成境界が投げた元のError Objectを保持する。
 * @oracle 下位の私有分類が対象の清掃確認とexact参照を保持する。
 * @cleanup N/A: Filesystem、Dockerまたは子Processを操作しない。
 * @boundary ERB-UT-023=Direct Boundary: Operation作成分類→助言Runtime。
 */
function initializationFailure(
  operation: Awaited<
    ReturnType<typeof loadOperationFailureFixture>
  >["operation"],
  cleanupConfirmed: boolean,
): unknown {
  try {
    operation.throwOwnedOperationDirectoryCreationFailure(
      Error("fixture_failure"),
      {
        cleanupConfirmed,
        manualRecoveryRequired: !cleanupConfirmed,
        hostRecoveryId: cleanupConfirmed
          ? null
          : "exact-host-reference-fixture",
      },
    );
  } catch (error) {
    return error;
  }
  throw Error("fixture_failure_required");
}

/**
 * 初期化失敗の既知清掃分類とexact参照を初回結果まで保持する。
 *
 * @responsibility operation未返却を未清掃と読み替えず、元分類と公開境界を確認する。
 * @trace ERB-UT-023
 * @precondition 固定した作成失敗、偽依存および有効な助言計画を用いる。
 * @stimulus 清掃確認済みと未確認の作成失敗で助言Runtimeを実行する。
 * @observation 初回結果、私有分類、poison呼出し、JSONおよびProvider開始を確認する。
 * @oracle 清掃trueは維持し参照null、falseはexact参照保持。両方ともProvider開始0。
 * @cleanup N/A: 全依存はProcess内の偽実装である。
 * @boundary ERB-UT-023=Direct Boundary: 作成失敗分類→初回Runtime結果。
 */
test("初期化失敗の清掃分類と取得済み参照を初回結果まで保持する", async () => {
  const { operation, advice } = await loadOperationFailureFixture();
  for (const confirmed of [true, false]) {
    const failure = initializationFailure(operation, confirmed);
    const current = fixture({
      createOperation: async () => {
        throw failure;
      },
    });
    const result = await advice.executeProviderAdvice(
      current.dependencies,
      plan,
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, confirmed);
    assert.equal(result.providerEffectIssued, false);
    assert.deepEqual(advice.classifyProviderAdviceHostFailure(result), {
      cleanupConfirmed: confirmed,
      manualRecoveryRequired: !confirmed,
      hostRecoveryId: confirmed ? null : "exact-host-reference-fixture",
      dockerRecoveryId: null,
    });
    assert.equal(current.calls.includes("start-process"), false);
    assert.equal(current.calls.includes("poison"), !confirmed);
    assert.equal(
      JSON.stringify(result).includes("exact-host-reference"),
      false,
    );
    assert.equal(classifyProviderAdviceHostFailure({ ...result }), null);
  }
});

/**
 * 分類のない作成例外を清掃確認や回復参照へ補完しない。
 *
 * @responsibility operation未取得とHost不存在を区別し、未知失敗を停止状態に保持する。
 * @trace ERB-UT-023
 * @precondition 元作成分類を持たない固定例外を用いる。
 * @stimulus createOperationが未知例外を投げる。
 * @observation cleanup、私有参照、poisonおよびProvider開始を確認する。
 * @oracle cleanup=false、manual=true、参照null。Provider開始0でpoisonを要求する。
 * @cleanup N/A: Process外資源を取得しない。
 * @boundary ERB-UT-023=Direct Boundary: 未分類例外→Runtime停止結果。
 */
test("未知の初期化失敗は不存在へ畳まない", async () => {
  const current = fixture({
    createOperation: async () => {
      throw new Error("fixture_unknown_creation");
    },
  });
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.deepEqual(classifyProviderAdviceHostFailure(result), {
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    hostRecoveryId: null,
    dockerRecoveryId: null,
  });
  assert.equal(current.calls.includes("poison"), true);
  assert.equal(current.calls.includes("start-process"), false);
});

/**
 * 現作成失敗の清掃分類と元参照を非公開のまま搬送する。
 *
 * @responsibility 消滅したactivation／readinessを再現せず、元Errorと初回結果の非開示を反証する。
 * @trace ERB-UT-023
 * @precondition 現Directory producerの私有分類を使用し、全OS依存をメモリ内へ閉じる。
 * @stimulus 清掃確認済みと記録不明の二分類を与える。
 * @observation 初回結果、exact参照、元清掃分類、Provider開始および公開JSONを確認する。
 * @oracle 元分類を維持し、未確認だけ私有の元参照を保持する。Provider開始0。
 * @cleanup N/A: 偽Operationだけを用い、Filesystem、Lock、Dockerまたは子Processを取得しない。
 * @boundary ERB-UT-023=Direct Boundary: 本番初期化状態機械→助言Runtime初回結果。
 */
test("作成失敗の元Errorと公開結果へ回復参照を列挙しない", async () => {
  const { operation, advice } = await loadOperationFailureFixture();
  for (const confirmed of [true, false]) {
    const failure = initializationFailure(operation, confirmed);
    assert.ok(failure instanceof Error);
    assert.equal(Object.keys(failure).includes("hostFailure"), false);
    assert.equal(
      JSON.stringify(failure).includes("exact-host-reference"),
      false,
    );
    assert.equal(
      JSON.stringify({ ...failure }).includes("exact-host-reference"),
      false,
    );
    const current = fixture({
      createOperation: async () => {
        throw failure;
      },
    });
    const result = await advice.executeProviderAdvice(
      current.dependencies,
      plan,
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, confirmed);
    assert.deepEqual(advice.classifyProviderAdviceHostFailure(result), {
      cleanupConfirmed: confirmed,
      manualRecoveryRequired: !confirmed,
      hostRecoveryId: confirmed ? null : "exact-host-reference-fixture",
      dockerRecoveryId: null,
    });
    assert.equal(current.calls.includes("start-process"), false);
    assert.equal(
      JSON.stringify(result).includes("exact-host-reference"),
      false,
    );
    assert.equal(advice.classifyProviderAdviceHostFailure({ ...result }), null);
  }
});

/**
 * 無効なRepository資格から本番助言Operationを作成しない。
 * @responsibility 正式受付がRootを補完せず、PathやAuthorityを公開しないことを確認する。
 * @trace ERB-UT-023
 * @precondition 本番Root資格でない固定Objectと合成要求を使う。
 * @stimulus 取消前と取消済みの両方で同じ無効Rootから助言を要求する。
 * @observation 受付結果と開始通知の有無。
 * @oracle 投影不能として停止し、実行開始や回復参照を返さない。
 * @cleanup 局所値のみ。Operationを作成しない。
 * @boundary ERB-UT-023=Unit: 本番助言の正式受付。
 */
test("本番助言は無効Rootを補完せず開始通知を出さない", async () => {
  const root = Object.freeze({}) as Parameters<typeof runRepositoryAdvice>[0];
  let started = 0;
  for (const cancelled of [false, true]) {
    const controller = new AbortController();
    if (cancelled) controller.abort();
    const response = await runRepositoryAdvice(
      root,
      {
        mode: "read_only_advice",
        executionSelection: plan.executionSelection,
        prompt: "合成要求",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: [],
      },
      controller.signal,
      {
        observeStarted: () => {
          started++;
        },
      },
    );
    assert.equal(response.result.status, "blocked");
    assert.equal(
      response.result.reason,
      "coordinator_ai_advice_projection_unavailable",
    );
    assert.equal(response.cleanupConfirmed, true);
    assert.equal(response.hostRecoveryId, null);
    assert.equal(response.dockerRecoveryId, null);
    assert.equal(started, 0);
  }
});

/**
 * 署名資格を受け取らず開始前取消を処理する。
 * @responsibility Operation・Home・Providerを一つも開始しない。
 * @trace ERB-UT-023
 * @precondition 依存は局所fixtureで、Signalは開始前に取消済み。
 * @stimulus 二引数の助言Runtimeへ取消Signalを渡す。
 * @observation cancelled理由、Effect非発行、依存call空。
 * @oracle 署名Gateの撤去が取消確認を省略しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-UT-023=Unit: 助言の開始境界。
 */
test("署名資格なしでも開始前取消は全依存を呼ばない", async () => {
  const current = fixture();
  const controller = new AbortController();
  controller.abort();
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    controller.signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "workbench_ai_advice_cancelled_before_runtime_effect",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(current.calls, []);
});

/**
 * 上位の追加情報を評価せず技術fieldだけを搬送する。
 * @responsibility Plan投影と上位準備入口の非迂回を固定する。
 * @trace ERB-UT-023
 * @precondition Sourceと合成値だけを使用する。
 * @stimulus 未知のaccessorと管理情報を準備記録へ追加する。
 * @observation exact key集合、元の参照、accessor呼出し数。
 * @oracle 上位情報は非搬送、accessorは0回、技術値は同じ参照。
 * @cleanup N/A: 外部資源なし。
 */
test("技術Planの往復を廃止し上位は同じ試行専用Executorを開始する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const startSource = sourceDeclaration(source, "startDockerProcessController");
  const recorded = sourceDeclaration(source, "startRecordedAttempt");
  const hostStart = sourceDeclaration(source, "startHostAttempt");
  assert.doesNotMatch(source, /projectExecutionPlan|\.prepare\(state,/);
  assert.match(
    startSource,
    /startHostAttempt\(\s*plan,\s*management,\s*handoff,/u,
  );
  assert.doesNotMatch(source, /ExecutionRecordOperations/);
  assert.match(
    hostStart,
    /startRecordedAttempt\(\s*plan,\s*managementCapability,/u,
  );
  assert.match(recorded, /const executor = plan\.executor;/u);
  assert.match(
    recorded,
    /executor\.start\(\{\s*managementCapability: management,\s*reference: recovery,\s*callbacks,\s*\}\)/,
  );
  assert.doesNotMatch(recorded, /executor\.start\(plan,/);
});

/**
 * 消費した準備が実行開始前に拒否された経路を閉じる。
 * @responsibility 同じ実行計画とOperation参照を開始・記録へ接続する。
 * @trace ERB-UT-023
 * @precondition 同一Ownerの合成参照と有限の開始代役だけ。
 * @stimulus 入力拒否、準備中の元管理参照の変更、開始拒否と正常開始後の送信通知再送。
 * @observation 開始回数と拒否結果、別Planの記録前拒否。
 * @oracle 同じ計画・管理参照で開始を一度呼び、任意記録も一回だけ開始する。
 * @cleanup N/A: Docker・実Home・Fileを使用しない。
 */
test("準備計画の開始と計測は元選定と同じExecutor・Operation相関を保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declarations = [
    "blockedAttemptStart",
    "beginAttemptRecording",
    "startDockerProcessController",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  for (const mode of [
    "provider_invalid",
    "input_invalid",
    "probe_rejected",
    "preparation_refused",
    "throws",
    "refused",
    "started",
  ]) {
    const management = {};
    const technical = attemptPlan();
    const owned = {
      ...technical,
      executionSelection: selection,
      taskAttempt: 0,
      consumer: "workbench",
      executor: {},
    };
    let starts = 0;
    let captures = 0;
    let preparationCalls = 0;
    let getterCalls = 0;
    const recording = {};
    const recordings: object[] = [];
    const technicalResult = {};
    const recordingOrder: string[] = [];
    const noop = () => {
      throw Error("unexpected_effect");
    };
    const input = {
      ...(mode === "probe_rejected"
        ? {
            purpose: "probe",
            executionSelection: executionSelection("independent_reviewer"),
          }
        : {
            purpose: "task",
            packetCapability: {},
            packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
          }),
      managementCapability: management,
      mountCapability: {},
      providerHome: {
        provider: "claude",
        providerHomeSourcePath: "synthetic",
        providerHomeIdentityHash: "a".repeat(64),
        stableLogicalHomeBindingHash: "b".repeat(64),
      },
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "workbench",
    };
    if (mode === "input_invalid")
      Object.defineProperty(input, "managementCapability", {
        get() {
          getterCalls++;
          return management;
        },
      });
    let captured: PreparationInput | null = null;
    const bindings: Record<string, unknown> = {
      capturePreparationInput: (supplied: unknown) => {
        captures++;
        assert.strictEqual(supplied, input);
        captured = capturePreparationInput(supplied);
        return captured;
      },
      createPreparationFailure,
      prepareProviderAttempt: (provider: unknown, supplied: unknown) => {
        preparationCalls++;
        assert.equal(provider, "claude");
        assert.ok(captured);
        assert.strictEqual(supplied, captured);
        assert.strictEqual(captured.managementCapability, management);
        input.managementCapability = {};
        if (mode === "preparation_refused")
          return {
            status: "blocked",
            reason: "synthetic_preparation_refused",
          };
        return {
          status: "prepared",
          plan: owned,
        };
      },
    };
    Object.assign(bindings, {
      borrowCoordinatorStateRepository: (candidate: unknown) => {
        assert.strictEqual(candidate, management);
        return { repositoryRoot: "fixture" };
      },
      getRepository: () => ({ status: "completed", capability: {} }),
      beginProviderExecutionRecording: (
        _repository: unknown,
        operationId: unknown,
        provider: unknown,
        _metadata: unknown,
        suppliedSelection: unknown,
      ) => {
        assert.equal(operationId, owned.operationId);
        assert.equal(provider, owned.provider);
        assert.strictEqual(suppliedSelection, owned.executionSelection);
        recordingOrder.push("begin");
        return recording;
      },
      captureProviderExecutionCompletion: (entry: unknown, result: unknown) => {
        assert.equal(entry, recording);
        assert.equal(result, technicalResult);
        recordingOrder.push("observed");
      },
      startHostAttempt: (
        supplied: typeof owned,
        candidate: unknown,
        _handoff: unknown,
        _report: unknown,
        observeSubmission: () => void,
      ) => {
        starts++;
        assert.strictEqual(supplied, owned);
        assert.strictEqual(candidate, management);
        if (mode === "throws") throw Error("start_failed");
        if (mode === "started") {
          assert.deepEqual(recordings, []);
          observeSubmission();
          observeSubmission();
          assert.deepEqual(recordings, [recording]);
          return {
            status: "started",
            completion: Promise.resolve(technicalResult),
          };
        }
        return {
          status: "blocked",
          reason: "synthetic",
          cleanupConfirmed: false,
          recoveryId: null,
          manualRecoveryRequired: true,
        };
      },
      process: { stderr: {} },
      createLifecycleNoticeReporter: () => noop,
    });
    const start = runInNewContext(
      `${declarations}\nstartDockerProcessController`,
      bindings,
    );
    const result = start(
      mode === "provider_invalid" ? "invalid" : "claude",
      input,
      () => true,
      undefined,
      {},
      recordings,
    );
    assert.equal(result.status, mode === "started" ? "started" : "blocked");
    const preparationFailed =
      mode === "provider_invalid" ||
      mode === "input_invalid" ||
      mode === "probe_rejected" ||
      mode === "preparation_refused";
    assert.equal(result.preparationFailed, preparationFailed);
    for (const field of ["selectionNotice", "selectedModel", "selectedEffort"])
      assert.equal(Object.hasOwn(result, field), false, field);
    if (mode === "started") {
      assert.equal(await result.completion, technicalResult);
      assert.deepEqual(recordingOrder, ["begin", "observed"]);
      assert.deepEqual(recordings, [recording]);
    } else {
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      if (mode !== "refused") {
        assert.equal(result.dockerEffectStarted, false);
        assert.equal(result.recoveryId, null);
        assert.equal(
          result.reason,
          mode === "provider_invalid"
            ? "docker_process_controller_plan_invalid"
            : mode === "input_invalid" || mode === "probe_rejected"
              ? "claude_docker_runtime_input_mode_ambiguous"
              : mode === "preparation_refused"
                ? "synthetic_preparation_refused"
                : "docker_process_controller_start_failed_closed",
        );
      }
      assert.deepEqual(recordings, []);
    }
    assert.equal(starts, preparationFailed ? 0 : 1);
    assert.equal(captures, mode === "provider_invalid" ? 0 : 1);
    assert.equal(
      preparationCalls,
      mode === "preparation_refused" || !preparationFailed ? 1 : 0,
    );
    assert.equal(getterCalls, 0);
  }
});

/**
 * 起動前の各照合を実装順に通過した試行だけを開始する。
 * @trace ERB-UT-023
 * @precondition 合成計画と有限の記録・実行代役を使う。
 * @stimulus 改訂拒否、別Home、回復引渡し拒否、正常を与える。
 * @observation 照合・放棄・開始の順と元計画、元管理参照、元回復ID。
 * @oracle 不一致時に開始せず、正常時は元Executorを一度使う。
 * @cleanup N/A: メモリ内の値だけ。
 * @boundary Coordinator開始本体から回復記録・Executorへの接続。
 */
test("起動は元計画の改訂と回復引渡しの後にだけ行う", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const body = [
    "startHostAttempt",
    "settleInvalidRecoveryStart",
    "blockedAttemptStart",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  for (const [mode, expected] of [
    ["revision", ["revision"]],
    ["home", ["revision", "begin", "abandon"]],
    ["binding", ["revision", "begin", "verify", "abandon"]],
    ["handoff", ["revision", "begin", "verify", "handoff", "abandon"]],
    ["ready", ["revision", "begin", "verify", "handoff", "start"]],
  ] as const) {
    const events: string[] = [];
    const executor = Object.freeze({});
    const plan = Object.freeze({
      executor,
      stableLogicalHomeBindingHash: "1".repeat(64),
    });
    const management = Object.freeze({});
    const recoveryCapability = Object.freeze({});
    const recoveryId =
      mode === "home"
        ? dockerRecoveryId.replace("1".repeat(64), "f".repeat(64))
        : dockerRecoveryId;
    const recovery = Object.freeze({
      status: "ready",
      recoveryCapability,
      recoveryId,
    });
    const bindings = {
      verifyRepositoryOperation(candidate: unknown) {
        events.push("revision");
        assert.strictEqual(candidate, management);
        return mode !== "revision";
      },
      beginDockerRecovery(supplied: unknown, candidate: unknown) {
        events.push("begin");
        assert.strictEqual(supplied, plan);
        assert.strictEqual(candidate, management);
        return recovery;
      },
      verifyDockerRecoveryBinding(
        capability: unknown,
        id: unknown,
        candidate: unknown,
        homeHash: unknown,
      ) {
        events.push("verify");
        assert.strictEqual(capability, recoveryCapability);
        assert.equal(id, recoveryId);
        assert.strictEqual(candidate, management);
        assert.equal(homeHash, plan.stableLogicalHomeBindingHash);
        return mode !== "binding";
      },
      abandonDockerRecovery(capability: unknown) {
        events.push("abandon");
        assert.strictEqual(capability, recoveryCapability);
      },
    };
    const start = runInNewContext(`${body}\nstartHostAttempt`, {
      ...bindings,
      parseDockerTaskRecoveryId,
      snapshotReadyRecovery,
      startRecordedAttempt: (
        supplied: typeof plan,
        candidate: unknown,
        reference: typeof recovery,
      ) => {
        events.push("start");
        assert.strictEqual(supplied.executor, executor);
        assert.strictEqual(supplied, plan);
        assert.strictEqual(candidate, management);
        assert.strictEqual(reference.recoveryCapability, recoveryCapability);
        assert.equal(reference.recoveryId, recoveryId);
        return { status: "started" };
      },
    });
    const result = start(
      plan,
      management,
      (capability: unknown, id: unknown) => {
        events.push("handoff");
        assert.strictEqual(capability, recoveryCapability);
        assert.equal(id, recoveryId);
        return mode !== "handoff";
      },
      () => undefined,
      () => undefined,
    );
    assert.deepEqual(events, expected);
    assert.equal(result.status, mode === "ready" ? "started" : "blocked");
    if (mode !== "ready") {
      assert.equal(result.preparationFailed, false);
      assert.equal(result.dockerEffectStarted, false);
      assert.equal(result.cleanupConfirmed, mode === "revision");
      assert.equal(result.manualRecoveryRequired, mode !== "revision");
    }
    if (mode === "home" || mode === "binding" || mode === "handoff") {
      assert.equal(result.recoveryId, recoveryId);
    }
  }
});

/**
 * 助言の取消を共通の完了観測へ接続し、登録前取消も失わない。
 * @responsibility 元Control／managementの配送と元completionのjoinを確認する。
 * @trace ERB-UT-023
 * @precondition 各Caseが独立したSignal・完了Promise・Host代役を持つ。
 * @stimulus 開始内同期取消、待機中取消、取消throw／rejectと完了rejectの単独・交差、正常完了。
 * @observation 配送先と回数、Listener数、早期返却とHost清掃、元回復参照。
 * @oracle 取消応答が失敗しても完了前に返さず、終端後の取消配送とListenerは0。
 * @cleanup 全completionを解決し、実資源は作らない。
 * @boundary 実助言本文と共通観測。技術実行は有限代役。
 */
test("Advice取消は開始内の取消と応答失敗でも元completionを待つ", async () => {
  for (const scenario of [
    "normal",
    "during_start",
    "running",
    "cancel_throw",
    "cancel_reject",
    "completion_reject",
    "running_completion_reject",
    "cancel_throw_completion_reject",
    "cancel_reject_completion_reject",
  ]) {
    const controller = new AbortController();
    const base = fixture();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let expectedControl: object | null = null;
    let expectedManagement: object | null = null;
    let cancellations = 0,
      returned = false;
    const dependencies: TestAdviceDependencies = {
      ...base.dependencies,
      startProcess: (...args) => {
        const started = base.dependencies.startProcess(...args);
        assert.equal(started.status, "started");
        if (started.status !== "started") throw Error("fixture_start_refused");
        expectedControl = started.controlCapability;
        assert.ok(
          args[1].managementCapability &&
            typeof args[1].managementCapability === "object",
        );
        expectedManagement = args[1].managementCapability;
        if (scenario === "during_start") controller.abort();
        return {
          ...started,
          completion: gate.then(() => {
            if (scenario.endsWith("completion_reject"))
              throw Error("fixture_completion_rejected");
            return started.completion;
          }),
        };
      },
      cancelProcess: (control, management) => {
        assert.equal(control, expectedControl);
        assert.equal(management, expectedManagement);
        cancellations++;
        if (scenario.startsWith("cancel_throw"))
          throw Error("fixture_cancel_threw");
        if (scenario.startsWith("cancel_reject"))
          return Promise.reject(Error("fixture_cancel_rejected"));
        return base.dependencies.cancelProcess(control, management);
      },
    };
    const pending = executeProviderAdvice(
      dependencies,
      plan,
      controller.signal,
    ).then((result) => {
      returned = true;
      return result;
    });
    await setImmediate();
    assert.ok(expectedControl);
    assert.equal(getEventListeners(controller.signal, "abort").length, 1);
    if (!["normal", "during_start", "completion_reject"].includes(scenario))
      controller.abort();
    await setImmediate();
    assert.equal(
      cancellations,
      ["normal", "completion_reject"].includes(scenario) ? 0 : 1,
    );
    assert.equal(returned, false);
    assert.equal(base.calls.includes("cleanup-operation"), false);
    assert.ok(release);
    release();
    const result = await pending;
    assert.equal(
      result.status,
      scenario === "normal" ? "completed" : "blocked",
    );
    if (scenario.endsWith("completion_reject")) {
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(base.calls.includes("cleanup-operation"), false);
      const failure = classifyProviderAdviceHostFailure(result);
      assert.equal(failure?.hostRecoveryId, "HOST-RECOVERY");
      assert.equal(failure?.dockerRecoveryId, dockerRecoveryId);
    } else {
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(base.calls.includes("cleanup-operation"), true);
    }
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    assert.equal(cancellations, scenario === "normal" ? 0 : 1);
    const before = cancellations;
    controller.abort();
    controller.signal.dispatchEvent(new Event("abort"));
    assert.equal(cancellations, before);
  }
});

/**
 * 本番の必要通知と、上位の終端保存の待機・拒否を固定する。
 * @responsibility Executorの技術結果からTaskの耐久受理を独立させる。
 * @trace ERB-IT-004
 * @precondition 本番wrapperの実宣言だけを抽出し下位を有限代役化する。
 * @stimulus 終端保存の非同期成功・拒否・throwとHome取得前拒否を渡す。
 * @observation completionの未確定、元ID、Task結果と解放事実。
 * @oracle 保存拒否を成功へせず、技術的なHome解放を取り消さない。
 * @cleanup 全ての保留を解放し同じcompletionを待つ。
 * @boundary 保存呼出しの接続だけ。実Docker・実保存は操作しない。
 */
test("本番通知一式と終端保存を上位Ownerが保持し、拒否時は同じ参照へ閉じる", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(source, "startRecordedAttempt");
  const blockedStart = sourceDeclaration(source, "blockedAttemptStart");
  const required = [
    "onCommandSubmitting",
    "onCommandNotIssued",
    "onProviderSubmitting",
    "onResourceCreated",
    "onStarted",
    "onCleanupCompleted",
  ];
  const verify = (text: string) => {
    for (const name of required)
      assert.equal(
        [...text.matchAll(new RegExp(`\\b${name}:`, "g"))].length,
        1,
        name,
      );
  };
  verify(declaration);
  for (const name of required)
    assert.throws(() =>
      verify(declaration.replace(`${name}:`, `removed_${name}:`)),
    );
  const bind = (bindings: Record<string, unknown>) =>
    runInNewContext(`${declaration}\n${blockedStart}\nstartRecordedAttempt`, {
      Object,
      Error,
      types,
      bindExecutorAttempt: () => true,
      ...bindings,
    });
  // 必須通知は同じ回復参照へ記録し、同期成功以外は後続へ進ませない。
  const preparation = Object.freeze({
    snapshot: {},
    cleanup: {},
  }) as Parameters<
    NonNullable<ExecutorCallbacks<"attempt">["onCommandSubmitting"]>
  >[1];
  const purpose = "create_provider";
  const notifications = [
    [
      "recordDockerResourceEvent",
      [purpose, preparation, "submission"],
      (callbacks: ExecutorCallbacks<"attempt">) =>
        callbacks.onCommandSubmitting?.(purpose, preparation),
    ],
    [
      "recordDockerResourceNotIssued",
      [purpose],
      (callbacks: ExecutorCallbacks<"attempt">) =>
        callbacks.onCommandNotIssued?.(purpose, preparation),
    ],
    [
      "recordDockerProviderSubmission",
      [],
      (callbacks: ExecutorCallbacks<"attempt">) =>
        callbacks.onProviderSubmitting?.(),
    ],
    [
      "recordDockerResourceEvent",
      [purpose, preparation, "identified"],
      (callbacks: ExecutorCallbacks<"attempt">) =>
        callbacks.onResourceIdentified?.(purpose, preparation),
    ],
    [
      "recordDockerResourceEvent",
      [purpose, preparation, "receipt"],
      (callbacks: ExecutorCallbacks<"attempt">) =>
        callbacks.onResourceCreated?.(purpose, "synthetic-id", preparation),
    ],
  ] as const;
  for (const [writer, expected, notify] of notifications) {
    for (const outcome of [true, false, "throw", "reject"] as const) {
      const recoveryCapability = Object.freeze({});
      let submissions = 0;
      const refused = { status: "blocked" };
      const executor = {
        start: ({ callbacks }: StartInput<"attempt">) => {
          assert.ok(callbacks);
          const submit = () => notify(callbacks);
          if (outcome === true) assert.equal(submit(), undefined);
          else
            assert.throws(
              submit,
              /record_unconfirmed|synthetic_submission_failure/u,
            );
          return refused;
        },
      };
      let observedSubmissions = 0;
      const run = bind({
        [writer]: (reference: unknown, ...args: unknown[]) => {
          submissions++;
          assert.strictEqual(reference, recoveryCapability);
          assert.equal(args.length, expected.length);
          for (const [index, item] of expected.entries())
            assert.strictEqual(args[index], item);
          if (outcome === "throw") throw Error("synthetic_submission_failure");
          if (outcome === "reject")
            return Promise.reject(Error("synthetic_submission_failure"));
          return outcome;
        },
      });
      assert.equal(
        run(
          { executor },
          {},
          { recoveryCapability },
          () => undefined,
          () => {
            assert.equal(submissions, 1);
            observedSubmissions++;
          },
        ),
        refused,
      );
      assert.equal(
        observedSubmissions,
        writer === "recordDockerProviderSubmission" && outcome === true ? 1 : 0,
      );
      assert.equal(submissions, 1);
    }
  }
  for (const mode of [
    "resolve",
    "revision_changed",
    "cleanup_unconfirmed",
    "cleanup_and_revision_unconfirmed",
    "reject",
    "throw",
    "recovery_binding_refused",
    "start_refused_false",
    "start_refused_throw",
  ]) {
    const plan = attemptPlan(),
      management = {},
      reference = {
        status: "ready",
        recoveryId: "exact-recovery",
        recoveryCapability: {},
      };
    let resolveTerminal!: () => void, rejectTerminal!: (error: Error) => void;
    const terminalPromise = new Promise<void>((resolve, reject) => {
      resolveTerminal = resolve;
      rejectTerminal = reject;
    });
    const terminal = {
      promise: terminalPromise,
      resolve: resolveTerminal,
      reject: rejectTerminal,
    };
    let entered = false,
      settled = false,
      unstarted = 0,
      starts = 0;
    let saved: unknown = null;
    const revisionChanged =
      mode === "revision_changed" ||
      mode === "cleanup_and_revision_unconfirmed";
    const cleanupUnconfirmed =
      mode === "cleanup_unconfirmed" ||
      mode === "cleanup_and_revision_unconfirmed";
    const executionObservation = Object.freeze({ kind: "execution" });
    const turnObservation = Object.freeze({ kind: "turn" });
    const raw = {
      status: "completed",
      reason: "provider_operation_completed",
      cleanupConfirmed: !cleanupUnconfirmed,
      homeLeaseReleased: true,
      manualRecoveryRequired: cleanupUnconfirmed,
      recoveryId: reference.recoveryId,
      normalizedResult: { status: true },
      resultBytes: 1,
      resultSha256: "synthetic",
      reviewFindings: ["synthetic"],
      providerExecutionObservation: executionObservation,
      providerTurnObservation: turnObservation,
    };
    const observation = {
      operationId: plan.operationId,
      recoveryId: reference.recoveryId,
      resourceSnapshot: { resources: [] },
      resources: [],
      primaryFailure: null,
      processTreeTerminationConfirmed: true,
      containersAbsent: true,
      networksAbsent: !cleanupUnconfirmed,
      homeLeaseReleased: true,
    };
    const blocked = {
      status: "blocked",
      reason: "docker_process_controller_recovery_unavailable",
      recoveryId: reference.recoveryId,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    };
    const executor = {
      start: ({
        managementCapability,
        reference: supplied,
        callbacks,
      }: StartInput<"attempt">) => {
        assert.strictEqual(managementCapability, management);
        assert.strictEqual(supplied, reference);
        assert.ok(callbacks);
        starts++;
        if (mode.startsWith("start_refused")) return blocked;
        callbacks.onCleanupCompleted?.(observation);
        return { status: "started", completion: Promise.resolve(raw) };
      },
    };
    const run = bind({
      bindExecutorAttempt: () => mode !== "recovery_binding_refused",
      verifyRepositoryOperation: (supplied: unknown) => {
        assert.strictEqual(supplied, management);
        return !revisionChanged;
      },
      recordAttemptCleanup: (input: {
        plan: unknown;
        managementCapability: unknown;
        recoveryCapability: unknown;
      }) => {
        assert.strictEqual(input.plan, owned);
        assert.strictEqual(input.managementCapability, management);
        assert.strictEqual(
          input.recoveryCapability,
          reference.recoveryCapability,
        );
        return {
          homeLeaseReleased: true,
          recoveryCompleted: true,
          recoveryFinalizationCapability: {},
        };
      },
      recordUnstartedAttempt: () => {
        unstarted++;
        if (mode.endsWith("throw")) throw Error("synthetic");
        return false;
      },
      recordDockerTerminalObservation: async (
        supplied: unknown,
        value: unknown,
      ) => {
        assert.strictEqual(supplied, reference.recoveryCapability);
        entered = true;
        saved = value;
        if (mode === "throw") throw Error("synthetic");
        await terminal.promise;
      },
    });
    const owned = { ...plan, executor };
    const result = run(
      owned,
      management,
      reference,
      () => undefined,
      () => undefined,
    );
    if (mode === "recovery_binding_refused") {
      assert.equal(starts, 0);
      assert.equal(unstarted, 1);
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        "docker_process_controller_recovery_unavailable",
      );
      assert.equal(result.preparationFailed, false);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(result.recoveryId, reference.recoveryId);
      continue;
    }
    assert.equal(starts, 1);
    if (mode.startsWith("start_refused")) {
      assert.equal(result, blocked);
      assert.equal(unstarted, 1);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(result.recoveryId, reference.recoveryId);
      continue;
    }
    const pending = result.completion.then((value: unknown) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(entered, true);
    if (mode !== "throw") assert.equal(settled, false);
    if (mode === "reject") terminal.reject(Error("synthetic"));
    else terminal.resolve();
    const completed = (await pending) as Record<string, unknown>;
    assert.equal(completed.homeLeaseReleased, true);
    assert.equal(completed.cleanupConfirmed, !cleanupUnconfirmed);
    assert.equal(
      completed.providerExecutionObservation,
      cleanupUnconfirmed ? null : executionObservation,
    );
    assert.equal(
      completed.providerTurnObservation,
      cleanupUnconfirmed ? null : turnObservation,
    );
    if (mode === "resolve" || revisionChanged || cleanupUnconfirmed) {
      assert.equal(completed, saved);
      assert.equal(
        completed.status,
        mode === "resolve" ? "completed" : "blocked",
      );
      assert.equal(
        completed.reason,
        revisionChanged
          ? "repository_revision_changed"
          : cleanupUnconfirmed
            ? "docker_process_controller_cleanup_unconfirmed"
            : raw.reason,
      );
      assert.equal(
        completed.recoveryId,
        cleanupUnconfirmed ? reference.recoveryId : null,
      );
      assert.equal(completed.manualRecoveryRequired, cleanupUnconfirmed);
    } else {
      assert.equal(completed.status, "blocked");
      assert.equal(
        completed.reason,
        "docker_process_controller_execution_failed_closed",
      );
      assert.equal(completed.recoveryId, reference.recoveryId);
      assert.equal(completed.manualRecoveryRequired, true);
      assert.equal(completed.recoveryCompleted, false);
      assert.equal(completed.recoveryFinalizationCapability, null);
    }
    assert.equal(
      completed.normalizedResult,
      mode === "resolve" ? raw.normalizedResult : null,
    );
    assert.equal(
      completed.resultSha256,
      mode === "resolve" ? raw.resultSha256 : null,
    );
    assert.equal(
      completed.resultBytes,
      mode === "resolve" ? raw.resultBytes : 0,
    );
    assert.equal(
      completed.reviewFindings,
      mode === "resolve" ? raw.reviewFindings : null,
    );
  }
});

/**
 * 保存先結合後のControl結合拒否を、元試行の取消とjoinへ閉じる。
 * @responsibility 開始済みPromiseを捨てず同じ回復参照のblockedへ収束する。
 * @trace ERB-UT-023
 * @precondition 本番startRecordedAttempt宣言と有限Executor・保存代役だけを使用する。
 * @stimulus 記録結合成功、開始成功、その後のControl結合だけを拒否する。
 * @observation 元Controlへの取消一回、下位Promise保留中の上位未確定、元IDと解放事実。
 * @oracle 下位完了を待ち、同ID・manualRecoveryRequiredのblockedを返す。
 * @cleanup 合成Promiseをsettleしてjoinする。外部資源を作らない。
 */
test("Control結合失敗でも同じExecutorを一回取り消し元completionをjoinする", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const management = {},
    capability = {},
    control = {};
  const reference = {
    recoveryCapability: capability,
    recoveryId: "exact-recovery",
  };
  const raw = {
    status: "completed",
    reason: "provider_operation_completed",
    cleanupConfirmed: true,
    homeLeaseReleased: true,
    normalizedResult: { status: true },
  };
  let finish!: (value: typeof raw) => void;
  const completion = new Promise<typeof raw>((resolve) => {
    finish = resolve;
  });
  const started = {
    status: "started",
    controlCapability: control,
    recoveryId: reference.recoveryId,
    completion,
  };
  let bindings = 0,
    cancellations = 0;
  let callbacks!: ExecutorCallbacks<"attempt">;
  const executor = {
    start: ({
      managementCapability,
      reference: supplied,
      callbacks: notices,
    }: StartInput<"attempt">) => {
      assert.strictEqual(managementCapability, management);
      assert.strictEqual(supplied, reference);
      assert.ok(notices);
      callbacks = notices;
      return started;
    },
    cancel: async ({
      controlCapability,
      managementCapability,
    }: AttemptCancelInput) => {
      assert.strictEqual(controlCapability, control);
      assert.strictEqual(managementCapability, management);
      cancellations++;
      return { status: "requested" };
    },
  };
  const run = runInNewContext(
    sourceDeclaration(source, "startRecordedAttempt") +
      "\nstartRecordedAttempt",
    {
      Object,
      Error,
      types,
      recordAttemptCleanup: () => ({
        homeLeaseReleased: true,
        recoveryCompleted: false,
        recoveryFinalizationCapability: null,
      }),
      bindExecutorAttempt: (
        supplied: unknown,
        owner: unknown,
        candidate: unknown,
        start: unknown,
      ) => {
        assert.strictEqual(supplied, capability);
        assert.strictEqual(owner, management);
        assert.strictEqual(candidate, executor);
        bindings++;
        if (bindings === 1) {
          assert.equal(start, undefined);
          return true;
        }
        assert.strictEqual(start, started);
        return false;
      },
    },
  );
  const plan = attemptPlan();
  const result = run(
    { ...plan, executor },
    management,
    reference,
    () => undefined,
    () => undefined,
  );
  assert.equal(result.status, "started");
  let settled = false;
  const pending = result.completion.then((value: unknown) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(cancellations, 1);
  assert.equal(bindings, 2);
  const observation = {
    operationId: plan.operationId,
    recoveryId: reference.recoveryId,
    resourceSnapshot: { resources: [] },
    resources: [],
    primaryFailure: null,
    processTreeTerminationConfirmed: true,
    containersAbsent: true,
    networksAbsent: true,
    homeLeaseReleased: true,
  };
  await callbacks.onResourcesClosed?.(observation);
  await callbacks.onCleanupCompleted?.(observation);
  finish(raw);
  const terminal = await pending;
  assert.equal(terminal.status, "blocked");
  assert.equal(
    terminal.reason,
    "docker_process_controller_execution_failed_closed",
  );
  assert.equal(terminal.recoveryId, reference.recoveryId);
  assert.equal(terminal.manualRecoveryRequired, true);
  assert.equal(terminal.homeLeaseReleased, true);
  assert.equal(terminal.normalizedResult, null);
  assert.equal(cancellations, 1);
});

/**
 * 回収不明で停止したProcessから新しい助言を開始しない。
 * @responsibility 旧署名拒否とProcess再起動要求を区別する。
 * @trace ERB-UT-023
 * @precondition このファイルの最終Caseで現在Processを停止状態にする。
 * @stimulus 既存process safety Ownerをpoisonし二引数のRuntimeを呼ぶ。
 * @observation 再起動要求理由、Effect非発行、依存call空。
 * @oracle 署名資格なしでも既存の新Effect抑止を維持する。
 * @cleanup 試験Runnerがこのファイル専用Processを終了する。Poison解除APIは作らない。
 * @boundary ERB-UT-023=Unit: Process safety→助言開始。
 */
test("Process回収不明は署名拒否でなく再起動要求として停止する", async () => {
  const current = fixture();
  poisonExecutionProcessAfterCleanupUnknown();
  const result = await executeProviderAdvice(
    current.dependencies,
    plan,
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_advice_process_restart_required");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(current.calls, []);
});
