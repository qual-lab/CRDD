/**
 * 共通Snapshotの物理読取り・保存失敗をDomain自身で反証する。
 * @packageDocumentation
 * @responsibility pending・marker・観測不能・境界置換の保存保証を所有する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @trace PRL-IT-014
 * @trace ERB-IT-004
 * @trace ERB-IT-014
 * @level IT
 * @scope 自己生成Repositoryと同一Processの故障注入。
 * @boundary Domain保存Ownerと実Filesystem。AI・Docker・過去保持物は使用しない。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { types } from "node:util";
import { runInNewContext } from "node:vm";
import {
  areTaskResourcesSettled,
  readOperationHost,
  isDockerRestartCheckpointSettled,
} from "../../src/attempt/validation.ts";
import * as privateDecisionCrud from "../../src/decision/crud.ts";
import type { DecisionAnswer } from "../../src/decision/types.ts";
import * as privateHistoryCrud from "../../src/history/crud.ts";
import * as domain from "../../src/index.ts";
import {
  type OperationResources,
  type ProjectExecutionState,
  readProjectExecutionState,
} from "../../src/index.ts";
import * as privateStateCrud from "../../src/composition/crud.ts";
import {
  initializeExecutionStore as initializeSnapshot,
  writeSnapshot,
  writeSnapshotState,
} from "../../src/composition/crud.ts";
import {
  encodeStateValue,
  hashExecutionStateContent,
  isPlainRecord,
  isSha256Hex,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  snapshotStateRecord,
} from "../../src/composition/validation.ts";
import {
  decodeStateSnapshot,
  EXECUTION_STATE_SCHEMA,
  prepareUnifiedTaskSnapshot,
  projectTaskSnapshot,
  validateUnifiedTransition,
} from "../../src/composition/transition.ts";
import {
  acquireExecutionStateLock,
  acquireSnapshotPilotLock,
  observeExecutionStorageRepository,
} from "../../src/storage/lock.ts";
import * as areaInitialization from "../../src/storage/store.ts";
import * as areaObservation from "../../src/storage/store.ts";
import * as privateStorageStore from "../../src/storage/store.ts";
import {
  describeDurableFoundation,
  ensurePhysicalExecutionDataArea,
  ExecutionStorageBlockedError,
  readSnapshot,
} from "../../src/storage/store.ts";
import { prepareQueueRecoverySettlement } from "../../src/task/crud.ts";
import { initialExecutionInput } from "../fixtures/execution-plan.ts";
import {
  createRepositoryTestDirectory,
  prepareFixtureRecovery,
} from "../support/repository-test-directory.ts";
import {
  createResourceBookFixture,
  createResourceOperationFixture,
} from "../support/resource-operation.ts";
import { createRuntimeStorageSourceFixture } from "../support/storage-source.ts";
import { sourceDeclaration } from "../support/source-declaration.ts";

/** 候補作成が元版を再利用しても、Writerは遅れて現れた差分を拒否する。 @trace PRL-IT-005 */
test("snapshot production: reused state still requires exact current bytes and no pending history", (t) => {
  for (const fault of ["current-bytes", "pending-history"] as const) {
    const { root, state: project } = fixture(t);
    const cap = { directory: root };
    assert.equal(
      domain.initializeExecutionStore(cap, "binding-a").status,
      "completed",
    );
    assert.equal(
      domain.createQueue(cap, "binding-a", {
        kind: "scheduled",
        input: [
          {
            queueId: "queue-a",
            projectId: "project-a",
            milestoneId: "milestone-a",
            requestHash: "b".repeat(64),
            originLane: "interactive",
            repositoryRevision: "a".repeat(40),
            scopeHash: "c".repeat(64),
          },
          initialExecutionInput(project),
        ],
      }).status,
      "completed",
    );
    const directory = path.join(root, ".crdd", "execution-model");
    const state = path.join(directory, "state.json");
    const pendingState = path.join(directory, "state.pending.json");
    const pendingHistory = path.join(directory, "history.pending.jsonl");
    const before = fs.readFileSync(state);
    const raw = JSON.parse(before.toString("utf8"));
    const changed = Buffer.from(
      `${encodeStateValue({ ...raw, repositoryBindingId: "different-binding" })}\n`,
    );
    assert.ok(decodeStateSnapshot(changed, raw.repositoryBinding));
    const retainedHistory = "unconfirmed history\n";
    let reads = 0;
    let pendingStateOpens = 0;
    let injected = false;
    const open = fs.openSync;
    const list = fs.readdirSync;
    const track = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof open>) => {
        if (args[0] === state) reads++;
        if (args[0] === pendingState) pendingStateOpens++;
        return open(...args);
      },
    );
    const inject = t.mock.method(
      fs,
      "readdirSync",
      (...args: Parameters<typeof list>) => {
        // Reader内では変更せず、候補を受け取った物理Writerの一覧取得で差を出す。
        if (
          !injected &&
          args[0] === directory &&
          new Error().stack?.includes("commitStateSnapshotOwned")
        ) {
          assert.equal(reads, 2, "候補組立て用の本文再読を行わない");
          injected = true;
          if (fault === "current-bytes") fs.writeFileSync(state, changed);
          else fs.writeFileSync(pendingHistory, retainedHistory);
        }
        return list(...args);
      },
    );
    try {
      const reserved = domain.acquireLease(cap, "binding-a", {
        kind: "intent",
        input: [
          "project-a",
          "queue-a",
          "project-operation",
          { ownerGeneration: "owner-a", ownerProcessId: process.pid },
          {
            resourcesAbsent: () => true,
            observeRoot: () => ({
              repositoryRoot: root,
              rootIdentity: "f".repeat(64),
            }),
            markIntentSaveRequested: () => {},
          },
        ],
      });
      assert.equal(reserved.status, "blocked", fault);
      assert.equal(injected, true, fault);
      assert.equal(pendingStateOpens, 0, fault);
    } finally {
      inject.mock.restore();
      track.mock.restore();
    }
    assert.deepEqual(
      fs.readFileSync(state),
      fault === "current-bytes" ? changed : before,
    );
    assert.equal(fs.existsSync(pendingState), false);
    if (fault === "pending-history")
      assert.equal(fs.readFileSync(pendingHistory, "utf8"), retainedHistory);
  }
});

/**
 * 閉Queueの履歴一回性とProject参照による採用証拠の保持を確認する。
 * @responsibility 未解決参照を退役せず、古い受付を新Project作成へ昇格しない。
 * @trace PRL-IT-012
 * @precondition 自己所有Rootと合成の終了State・技術観測。実Lease終了の保証ではない。
 * @stimulus 二Projectの参照・採用記録、閉Queueの二回退役、旧受付とMilestone変更。
 * @observation 全区画、履歴行数、拒否時bytesと回復参照。
 * @oracle 参照中の二結果と証拠を保全し、閉Queue履歴は一行だけ確定する。
 * @cleanup fixtureの終了hookが今回Rootだけを回収する。
 * @boundary EMの保存・保持・履歴と受付照合。
 */
test("snapshot production: retire closed queue and reject old intake", (t) => {
  const { root, state } = fixture(t);
  const cap = { directory: root };
  assert.equal(
    domain.initializeExecutionStore(cap, "binding-a").status,
    "completed",
  );
  const closed: ProjectExecutionState = {
    ...state,
    milestone: {
      ...state.milestone,
      state: "cancelled",
      criterionEvidenceIds: ["receipt-a"],
    },
    objectives: state.objectives.map((item) => ({
      ...item,
      state: "cancelled",
    })),
    tasks: state.tasks.map((item) => ({
      ...item,
      state: "cancelled",
      cleanupConfirmed: true,
      startPhase: "settled",
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
    })),
  };
  const base = readSnapshot({ directory: root }, "binding-a").value;
  assert.ok(base);
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      encodeStateValue({
        ...base,
        snapshotRevision: base.snapshotRevision + 1,
        projects: [closed],
      }),
      base.snapshotRevision,
    ).status,
    "completed",
  );
  const input = {
    queueId: "canonical",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive" as const,
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  assert.equal(
    domain.createQueue(cap, "binding-a", { kind: "scheduled", input: [input] })
      .status,
    "completed",
  );
  assert.equal(
    domain.updateQueue(cap, "binding-a", {
      kind: "operation",
      input: [
        "canonical",
        1,
        {
          state: "cancelled",
          leasePresent: false,
          leaseIsNull: true,
          resumeCondition: null,
          resultReference: null,
        },
        {
          borrowActiveLease: () => undefined,
          isActiveLeaseObserved: () => false,
        },
      ],
    }).status,
    "completed",
  );
  for (const projectId of ["project-a", "project-b"]) {
    if (projectId === "project-b") {
      const before = readSnapshot({ directory: root }, "binding-a").value;
      assert.ok(before);
      assert.equal(
        writeSnapshot(
          { directory: root },
          "binding-a",
          encodeStateValue({
            ...before,
            snapshotRevision: before.snapshotRevision + 1,
            projects: [
              ...before.projects,
              {
                ...closed,
                projectId,
                milestone: {
                  ...closed.milestone,
                  criterionEvidenceIds: ["receipt-b"],
                },
              },
            ],
          }),
          before.snapshotRevision,
        ).status,
        "completed",
      );
    }
    // 別Projectの結果IDが退役Queue IDと一致しても、Queue所属が違えば退役しない。
    const identities =
      projectId === "project-a" ? ["receipt-a"] : ["receipt-b", input.queueId];
    for (const identity of identities) {
      assert.equal(
        domain.saveIntegrationRecord(
          cap,
          "binding-a",
          {
            repositoryBindingId: "binding-a",
            projectId,
            milestoneId: "milestone-a",
            queueId: projectId === "project-a" ? "canonical" : "adoption-b",
          },
          {
            kind: "adoption",
            identity,
            value: {
              recordKind: "workspace-candidate",
              operationId: identity,
              candidateCommit: "b".repeat(40),
              mergeCommit: "c".repeat(40),
              target: {
                targetBranch: "main",
                expectedTargetHead: "a".repeat(40),
              },
              disposition: "adopted",
              primaryFailure: null,
            },
          },
        ).status,
        "completed",
      );
    }
  }
  const queued = readSnapshot({ directory: root }, "binding-a").value;
  assert.ok(queued);
  const file = path.join(root, ".crdd/execution-model/state.json"),
    before = fs.readFileSync(file, "utf8");
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      encodeStateValue({
        ...queued,
        snapshotRevision: queued.snapshotRevision + 1,
        projects: queued.projects.map((item) =>
          item.projectId === closed.projectId
            ? {
                ...closed,
                generation: closed.generation + 1,
                milestone: { ...closed.milestone, id: "milestone-new" },
              }
            : item,
        ),
      }),
      queued.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(file, "utf8"), before);
  const history = {
    root: cap,
    historyRetentionDays: 30,
    revalidate: () => true,
  };
  assert.equal(
    domain.retireStateRecords(history, "binding-a", Date.now()).value,
    1,
  );
  const snapshot = readSnapshot({ directory: root }, "binding-a").value;
  assert.equal(snapshot?.schemaRevision, 9);
  assert.equal(snapshot?.queueEntries.length, 1);
  assert.equal(snapshot?.queueEntries[0]?.historySettled, true);
  assert.equal(snapshot?.projects.length, 2);
  assert.equal(snapshot?.results.length, 3);
  assert.ok(
    snapshot?.results.some(
      (record) =>
        record.projectId === "project-b" && record.identity === input.queueId,
    ),
  );
  assert.deepEqual(snapshot?.leaseEvidence, []);
  assert.equal(snapshot?.historyPending.length, 0);
  assert.equal(
    domain.retireStateRecords(history, "binding-a", Date.now()).value,
    0,
  );
  assert.equal(
    domain.createQueue(cap, "binding-a", { kind: "scheduled", input: [input] })
      .status,
    "completed",
  );
  const stale = {
    operation: "resume" as const,
    queueId: "queue-new",
    requestHash: "d".repeat(64),
    projectId: "project-new",
    milestoneId: "milestone-new",
  };
  const staleWrite = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    {
      kind: "task_start",
      projectId: "project-new",
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    },
    0,
    stale,
  );
  assert.equal(staleWrite.status, "blocked");
  assert.equal(staleWrite.reason, "coordinator_queue_identity_conflict");
  assert.equal(staleWrite.manualRecoveryRequired, false);
  assert.equal(staleWrite.recoveryId, null);
  assert.equal(
    readSnapshot({ directory: root }, "binding-a").value?.projects.some(
      (item) => item.projectId === "project-new",
    ),
    false,
  );
  const rows = fs
    .readFileSync(
      path.join(root, ".crdd/execution-model/history.jsonl"),
      "utf8",
    )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    rows.filter((row) => row.summary?.record?.id === "canonical").length,
    1,
  );
});

/**
 * 破損本文とProject構造の不正をEMの保存Readerで拒否する。
 *
 * @responsibility 本文・意味の読取り失敗を回復必要な停止として返し、元bytesを保全する。
 * @trace PRL-IT-012
 * @precondition 今回Rootで初回QueueとProjectを正規受付し、保存結果の同値を確認する。
 * @stimulus 空の本文とProjectの必須field欠測を注入し公開Readerから取得する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: Execution Model→実Snapshot保存
 */
test("PR-D-A-01 rejects corrupt or semantically invalid durable state", (t) => {
  const { root, state } = fixture(t);
  const cap = { directory: root };
  assert.equal(
    domain.initializeExecutionStore(cap, "binding-a").status,
    "completed",
  );
  assert.equal(
    domain.createQueue(cap, "binding-a", {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: state.projectId,
          milestoneId: state.milestoneId,
          requestHash: "b".repeat(64),
          originLane: "scheduled",
          repositoryRevision: state.repositoryRevision,
          scopeHash: "c".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  assert.deepEqual(
    domain.readProjectExecutionState(cap, "binding-a", state.projectId).value,
    state,
  );
  const record = path.join(root, ".crdd", "execution-model", "state.json");
  const original = JSON.parse(fs.readFileSync(record, "utf8")) as Record<
    string,
    unknown
  >;
  fs.writeFileSync(record, "{}\n", "utf8");
  const corruptBytes = fs.readFileSync(record);
  const read = domain.readProjectExecutionState(cap, "binding-a", "project-a");
  assert.equal(read.status, "blocked");
  assert.equal(read.reason, "coordinator_state_read_unconfirmed");
  assert.equal(read.manualRecoveryRequired, true);
  assert.deepEqual(fs.readFileSync(record), corruptBytes);

  const rewritten = { ...original };
  const payload = rewritten as { projects: unknown[] };
  payload.projects[0] = {
    contract: "crdd-execution-model/project-state/v3",
  };
  fs.writeFileSync(record, `${encodeStateValue(rewritten)}\n`, "utf8");
  const invalidBytes = fs.readFileSync(record);
  assert.equal(
    domain.readProjectExecutionState(cap, "binding-a", "project-a").reason,
    "coordinator_state_read_unconfirmed",
  );
  assert.deepEqual(fs.readFileSync(record), invalidBytes);
});

/**
 * Task状態と実行Identityの不可能な組合せを拒否する。
 *
 * @responsibility Operation欠測・実行phase不整合を成功や不存在へ畳まず元bytesを保全する。
 * @trace PRL-IT-012
 * @precondition 各反例は独立した今回Rootへ正常な初回QueueとProjectを保存する。
 * @stimulus running／handoffのOperation欠測とreadyの実行phase不整合を注入する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: Execution Model→実Snapshot保存
 */
test("PR-D-A-01 rejects impossible Task state and identity tuples", (t) => {
  const cases = [
    {
      name: "running-without-operation",
      mutate(task: Record<string, unknown>) {
        task.state = "running";
        task.startPhase = "running";
        task.attemptId = "attempt-a";
        task.operationId = null;
        task.authorityBindingId = "authority-a";
      },
    },
    {
      name: "handoff-without-operation",
      mutate(task: Record<string, unknown>) {
        task.state = "starting";
        task.startPhase = "handoff_prepared";
        task.attemptId = "attempt-a";
        task.operationId = null;
        task.authorityBindingId = "authority-a";
      },
    },
    {
      name: "ready-with-running-phase",
      mutate(task: Record<string, unknown>) {
        task.state = "ready";
        task.startPhase = "running";
        task.attemptId = null;
        task.operationId = null;
        task.authorityBindingId = null;
      },
    },
  ] as const;

  for (const item of cases) {
    const { root, state } = fixture(t);
    const cap = { directory: root };
    assert.equal(
      domain.initializeExecutionStore(cap, "binding-a").status,
      "completed",
    );
    assert.equal(
      domain.createQueue(cap, "binding-a", {
        kind: "scheduled",
        input: [
          {
            queueId: "queue-a",
            projectId: state.projectId,
            milestoneId: state.milestoneId,
            requestHash: "b".repeat(64),
            originLane: "scheduled",
            repositoryRevision: state.repositoryRevision,
            scopeHash: "c".repeat(64),
          },
          initialExecutionInput(state),
        ],
      }).status,
      "completed",
    );
    assert.deepEqual(
      domain.readProjectExecutionState(cap, "binding-a", state.projectId).value,
      state,
    );
    const location = path.join(root, ".crdd", "execution-model", "state.json");
    const envelope = JSON.parse(fs.readFileSync(location, "utf8")) as {
      projects: { tasks: Record<string, unknown>[] }[];
      contentHash: string;
    };
    const task = envelope.projects[0]?.tasks[0];
    if (!task) throw new Error("fixture_task_missing");
    item.mutate(task);
    fs.writeFileSync(location, `${encodeStateValue(envelope)}\n`, "utf8");

    const invalidBytes = fs.readFileSync(location);
    const observed = domain.readProjectExecutionState(
      cap,
      "binding-a",
      "project-a",
    );
    assert.equal(observed.status, "blocked", item.name);
    assert.equal(
      observed.reason,
      "coordinator_state_read_unconfirmed",
      item.name,
    );
    assert.equal(observed.manualRecoveryRequired, true, item.name);
    assert.deepEqual(fs.readFileSync(location), invalidBytes, item.name);
  }
});

/**
 * 現行保存Envelopeの破損と未確定pendingを拒否する。
 *
 * @responsibility 固定された現在保存形式を満たさない入力を停止し、既存bytesを保全する。
 * @trace PRL-IT-012
 * @precondition 初回QueueとProjectが正規受付から単一state.jsonへ保存済みである。
 * @stimulus 必須欄欠落・未知欄・不正Schema・Hash破損・不正改訂番号・未確定pendingを注入する。
 * @observation Readerの結果と現在File、pendingのbytesを取得する。
 * @oracle 全反例をblockedとして返し、不正入力を修復や成功へ畳まず保存を変更しない。
 * @cleanup fixture hookが自己所有Rootを清掃する。
 * @boundary 現行Snapshot ReaderとRepository-local保存境界。
 */
test("PR-D-A-01 現行Envelope破損と未確定pendingを拒否して保全する", (t) => {
  for (const mode of [
    "extra-field",
    "missing-base",
    "unknown-schema",
    "negative-revision",
    "invalid-hash",
    "pending-residue",
  ] as const) {
    const { root, state } = fixture(t);
    const cap = { directory: root };
    assert.equal(
      domain.initializeExecutionStore(cap, "binding-a").status,
      "completed",
    );
    assert.equal(
      domain.createQueue(cap, "binding-a", {
        kind: "scheduled",
        input: [
          {
            queueId: "queue-a",
            projectId: state.projectId,
            milestoneId: state.milestoneId,
            requestHash: "b".repeat(64),
            originLane: "scheduled",
            repositoryRevision: state.repositoryRevision,
            scopeHash: "c".repeat(64),
          },
          initialExecutionInput(state),
        ],
      }).status,
      "completed",
    );
    assert.deepEqual(
      domain.readProjectExecutionState(cap, "binding-a", state.projectId).value,
      state,
    );
    const directory = path.join(root, ".crdd", "execution-model");
    const location = path.join(directory, "state.json");
    const pending = path.join(directory, "state.pending.json");
    const envelope = JSON.parse(fs.readFileSync(location, "utf8"));
    if (mode === "extra-field") envelope.unexpected = true;
    else if (mode === "missing-base") delete envelope.previous;
    else if (mode === "unknown-schema") envelope.schema = "unknown";
    else if (mode === "negative-revision") envelope.revision = -1;
    else if (mode === "invalid-hash")
      envelope.previous.payloadSha256 = "invalid";
    else fs.writeFileSync(pending, "unconfirmed", "utf8");
    if (mode !== "pending-residue")
      fs.writeFileSync(location, `${encodeStateValue(envelope)}\n`, "utf8");
    const before = fs.readFileSync(location);
    const pendingBefore =
      mode === "pending-residue" ? fs.readFileSync(pending) : null;
    const names = fs.readdirSync(directory).sort();
    const observed = domain.readProjectExecutionState(
      cap,
      "binding-a",
      "project-a",
    );
    assert.equal(observed.status, "blocked", mode);
    assert.equal(observed.manualRecoveryRequired, true, mode);
    assert.deepEqual(fs.readFileSync(location), before, mode);
    assert.deepEqual(fs.readdirSync(directory).sort(), names, mode);
    if (pendingBefore)
      assert.deepEqual(fs.readFileSync(pending), pendingBefore, mode);
  }
});

/**
 * 資源再保存の元pairとOwner確認を完成保存入口へ接続する。
 * @responsibility 統合で元候補比較や保存前停止を省略しない。
 * @trace ERB-IT-014
 * @precondition 実Sourceの受付と有限のReader／Writer。
 * @stimulus Owner三位置の拒否・例外、元pair差、分類拒否を与える。
 * @observation Reader引数、Owner回数、Writer要求とEffect回数、元byte。
 * @oracle 正例だけ同候補を保存し、不一致と失効はEffect0。
 * @cleanup VM内の有限依存だけを破棄する。
 * @boundary 保存接続の局所反証。実保存成立は別試験。
 */
test("資源再保存は元pairの一致とOwner三位置を同じ受付で保持する", () => {
  const body = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../src/attempt/crud.ts", import.meta.url),
        "utf8",
      ),
      "saveRecoveryCheckpoint",
    ),
  ).replaceAll("export function", "function");
  const before = Buffer.from("before"),
    candidate = Buffer.from("candidate");
  const mutable = Buffer.from(candidate);
  const captured = privateStorageStore.captureResourcePublication(
    before,
    mutable,
  );
  mutable.fill(0);
  assert.equal(
    captured.matchesCandidate(
      privateStorageStore.captureStateVersionEvidence("candidate"),
    ),
    true,
  );
  assert.equal(
    captured.matchesCandidate(
      privateStorageStore.captureStateVersionEvidence("before"),
    ),
    false,
  );
  assert.equal(captured.matchesCandidate("candidate"), false);
  assert.equal(
    captured.matches(
      privateStorageStore.captureResourcePublication(before, candidate),
    ),
    true,
  );
  assert.equal(captured.matches({ before, candidate }), false);
  assert.equal(
    captured.matches(Object.create(Object.getPrototypeOf(captured))),
    false,
  );
  let traps = 0;
  const rejectProxyTrap = () => {
    traps++;
    throw Error("publication proxy must not run");
  };
  const proxied = new Proxy(captured, {
    get: rejectProxyTrap,
    getPrototypeOf: rejectProxyTrap,
    ownKeys: rejectProxyTrap,
  });
  assert.equal(captured.matches(proxied), false);
  assert.equal(Reflect.get(captured, "read"), undefined);
  for (const mode of [
    "valid",
    "owner1",
    "owner2",
    "owner3",
    "throw1",
    "throw2",
    "throw3",
    "before_changed",
    "candidate_changed",
    "classification",
    "reader_unknown",
    "forged_pair",
    "forged_prototype",
    "proxied_pair",
  ] as const) {
    let owners = 0,
      classifications = 0,
      reads = 0,
      writes = 0,
      effects = 0;
    const repository = {
      repositoryBinding: "binding",
      operationId: "operation",
      revalidate: (days?: number) => {
        assert.equal(days, 7);
        return true;
      },
    };
    const execute = runInNewContext(`${body}; saveRecoveryCheckpoint`, {
      Buffer,
      snapshotStateRecord,
      readResourcePublicationBytes:
        privateStorageStore.readResourcePublicationBytes,
      readStateVersionEvidence: privateStorageStore.readStateVersionEvidence,
      classifyResourcePublication: (...args: unknown[]) => {
        classifications++;
        assert.deepEqual(args, [before, candidate, "exact", "binding"]);
        return mode !== "classification";
      },
      readStateSnapshot: (...args: unknown[]) => {
        reads++;
        assert.deepEqual(args, [
          repository,
          null,
          null,
          null,
          "docker_task",
          "docker_task",
          false,
          "exact",
        ]);
        return {
          status: mode === "reader_unknown" ? "blocked" : "completed",
          lockReleased: mode !== "reader_unknown",
          resourcePublication: privateStorageStore.captureResourcePublication(
            mode === "before_changed" ? Buffer.from("other") : before,
            mode === "candidate_changed" ? Buffer.from("other") : candidate,
          ),
        };
      },
      writeStateSnapshot: (
        _owner: unknown,
        target: { revalidate: (days: number) => boolean } | null,
        bytes: unknown,
      ) => {
        if (target) {
          writes++;
          assert.deepEqual(bytes, candidate);
          if (target.revalidate(7)) {
            effects++;
            return {
              status: "completed",
              snapshotConfirmed: true,
              lockReleased: true,
              filesystemEffectIssued: true,
            };
          }
        }
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
          filesystemEffectIssued: false,
        };
      },
    });
    const result = execute(repository, "exact", null, {
      kind: "resource_publication",
      publication:
        mode === "forged_pair"
          ? { before, candidate }
          : mode === "forged_prototype"
            ? Object.create(Object.getPrototypeOf(captured))
            : mode === "proxied_pair"
              ? proxied
              : captured,
      assertOwner: () => {
        owners++;
        if (mode === `throw${owners}`) throw Error("synthetic");
        return mode !== `owner${owners}`;
      },
    });
    assert.equal(effects, mode === "valid" ? 1 : 0, mode);
    assert.equal(result.snapshotConfirmed, mode === "valid", mode);
    if (["forged_pair", "forged_prototype", "proxied_pair"].includes(mode)) {
      assert.equal(result.status, "blocked", mode);
      assert.equal(result.filesystemEffectIssued, false, mode);
      assert.deepEqual(
        { owners, classifications, reads, writes, traps },
        {
          owners: 0,
          classifications: 0,
          reads: 0,
          writes: 0,
          traps: 0,
        },
        mode,
      );
      continue;
    }
    assert.equal(
      reads,
      ["owner1", "throw1", "classification"].includes(mode) ? 0 : 1,
      mode,
    );
    assert.equal(
      writes,
      ["valid", "owner3", "throw3"].includes(mode) ? 1 : 0,
      mode,
    );
    assert.equal(
      owners,
      mode === "valid" || mode.endsWith("3") ? 3 : mode.endsWith("2") ? 2 : 1,
      mode,
    );
    assert.equal(before.toString(), "before");
    assert.equal(candidate.toString(), "candidate");
  }
});

/**
 * 回復phaseの有限保存を単一Writerと直後再送へ接続する。
 * @trace PRL-IT-005
 * @precondition 今回Rootの開始前終端と非Dockerの合成回復義務を使う。
 * @stimulus start・settle・別ID再送・Cleanup未確認のretryを実保存へ渡す。
 * @observation 保存bytes、世代、義務phaseとLock解放。
 * @oracle 拒否と同一再送はbytes不変であり、処置済みをCleanup確認へ読み替えない。
 * @cleanup fixtureの終了hookで今回Rootだけを回収する。
 * @boundary EM完成保存と実Filesystem。実AI・Dockerなし。
 */
test("回復phaseの有限保存は同一再送とCleanup未確認の停止を維持する", (t) => {
  const { root, state } = fixture(t);
  const cap = { directory: root };
  assert.equal(
    domain.initializeExecutionStore(cap, "binding-a").status,
    "completed",
  );
  assert.equal(
    domain.createQueue(cap, "binding-a", {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: state.projectId,
          milestoneId: state.milestoneId,
          requestHash: "a".repeat(64),
          originLane: "interactive",
          repositoryRevision: state.repositoryRevision,
          scopeHash: "b".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  assert.deepEqual(
    domain.readProjectExecutionState(cap, "binding-a", state.projectId).value,
    state,
  );
  const reservation = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    {
      kind: "task_start",
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    },
    state.generation,
  );
  assert.equal(reservation.status, "completed");
  if (reservation.status !== "completed")
    throw Error("fixture_reservation_failed");
  const handoff = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    {
      kind: "task_handoff",
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
    },
    reservation.value.generation,
  );
  assert.equal(handoff.status, "completed");
  if (handoff.status !== "completed") throw Error("fixture_handoff_failed");
  const recoveryId =
    "execution-process.11111111-1111-4111-8111-111111111111.restart-" +
    "a".repeat(40);
  const terminal = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    {
      kind: "task_settle_before_effect",
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryUnresolved: false,
      recoveryObligations: [
        { kind: "execution_process", recoveryId, phase: "required" },
      ],
    },
    handoff.value.generation,
  );
  assert.equal(terminal.status, "completed", terminal.reason);
  if (terminal.status !== "completed") throw Error("fixture_terminal_failed");
  let current = terminal.value;
  const file = path.join(root, ".crdd/execution-model/state.json");
  for (const kind of ["task_recovery_start", "task_recovery_settle"] as const) {
    const command = {
      kind,
      projectId: state.projectId,
      taskId: "task-a",
      recoveryKind: "execution_process" as const,
      recoveryId,
    };
    const generation = current.generation;
    const saved = domain.saveProjectExecutionState(
      cap,
      "binding-a",
      command,
      generation,
    );
    assert.equal(saved.status, "completed", saved.reason);
    if (saved.status !== "completed") throw Error("fixture_saved_failed");
    assert.equal(saved.value.generation, generation + 1);
    assert.equal(
      saved.value.tasks[0]?.recoveryObligations[0]?.phase,
      kind === "task_recovery_start" ? "recovering" : "settled",
    );
    const bytes = fs.readFileSync(file);
    assert.equal(
      domain.saveProjectExecutionState(cap, "binding-a", command, generation)
        .status,
      "completed",
    );
    assert.equal(
      domain.saveProjectExecutionState(
        cap,
        "binding-a",
        { ...command, recoveryId: "other" },
        generation,
      ).status,
      "blocked",
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
    current = saved.value;
  }
  const bytes = fs.readFileSync(file);
  assert.equal(
    domain.saveProjectExecutionState(
      cap,
      "binding-a",
      {
        kind: "task_recovery_retry",
        projectId: state.projectId,
        taskIds: ["task-a"],
      },
      current.generation,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), bytes);
});

/**
 * 終了観測の公開単独入口を同じ回復Readerへ結合する。
 * @responsibility 相関IDと読取り・排他結果の共同成立を保つ。
 * @trace PRL-IT-005
 * @precondition 実Sourceの受付本文と有限Reader結果。
 * @stimulus 相関入力不正、観測失敗、解放不明、相関不成立を与える。
 * @observation 元引数、Root観測回数、最終field、元診断の同一性。
 * @oracle 正例だけ終了確認true。不正入力はRoot観測0、他の診断は保持する。
 * @cleanup メモリ内の依存を破棄する。
 * @boundary Readerの局所接続。実履歴の検査は実保存試験で確認する。
 */
test("終了観測は同じReaderで相関と排他終了を共同確認する", () => {
  const body = stripTypeScriptTypes(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../src/composition/crud.ts", import.meta.url),
        "utf8",
      ),
      "readRecoveryState",
    ),
  ).replace("export function", "function");
  const repository = {};
  let roots = 0,
    reads = 0;
  let reply = {
    status: "completed",
    reason: "same",
    lockReleased: true,
    operationCompletionConfirmed: true,
    value: { diagnostic: "preserved" },
  };
  const execute = new Function(
    "snapshotStateRecord",
    "readStateSnapshot",
    "observeExecutionRecoveryRepository",
    "parseDockerTaskRecoveryId",
    `${body}; return readRecoveryState;`,
  )(
    snapshotStateRecord,
    (actual: unknown, ...args: unknown[]) => {
      if (actual === null)
        return {
          status: "blocked",
          reason: "invalid",
          lockReleased: true,
          operationCompletionConfirmed: false,
          value: null,
        };
      assert.strictEqual(actual, repository);
      reads++;
      assert.deepEqual(args, [
        null,
        null,
        null,
        "docker_task",
        "docker_task",
        false,
        null,
        { recoveryId: "exact", correlationId: "operation-a" },
      ]);
      return reply;
    },
    () => {
      roots++;
      return repository;
    },
    (id: unknown) => id === "exact",
  );
  const request = {
    kind: "completion",
    recoveryId: "exact",
    correlationId: "operation-a",
  };
  for (const [status, released, confirmed] of [
    ["completed", true, true],
    ["completed", false, true],
    ["completed", true, false],
    ["blocked", true, false],
  ] as const) {
    reply = {
      ...reply,
      status,
      lockReleased: released,
      operationCompletionConfirmed: confirmed,
    };
    const result = execute({}, request);
    assert.equal(
      result.operationCompletionConfirmed,
      status === "completed" && released && confirmed,
    );
    assert.equal(result.reason, reply.reason);
    assert.strictEqual(result.value, reply.value);
  }
  assert.equal(roots, 4);
  assert.equal(reads, 4);
  let getters = 0;
  for (const invalid of [
    { ...request, recoveryId: "other" },
    { ...request, correlationId: "" },
    { ...request, extra: true },
    { kind: "completion", recoveryId: "exact" },
    { kind: "current", recoveryId: "exact", correlationId: "operation-a" },
    {
      kind: "completion",
      recoveryId: "exact",
      get correlationId() {
        getters++;
        return "operation-a";
      },
    },
  ])
    assert.equal(execute({}, invalid).operationCompletionConfirmed, false);
  assert.equal(roots, 4);
  assert.equal(reads, 4);
  assert.equal(getters, 0);
});

/**
 * State複合取得の固定範囲と単一読取りを確認する。
 * @responsibility 返却型だけでなく実fieldの限定と対象不正の無Effect拒否を検証する。
 * @trace PRL-IT-005
 * @precondition 既知Snapshotの有限代役を使い、実保存の成立とは区別する。
 * @stimulus 三入口、不正Root、不存在、読取り又は解放不明を与える。
 * @observation 元Reader呼出し数、返却field、元失敗の同一性。
 * @oracle 技術区画を返さず、不明を不存在へ畳まず、範囲の既定補完をしない。
 * @cleanup N/A: Source読取りとメモリ値だけ。
 * @boundary Stateの公開取得本文と既存保存Readerの有限返却契約。
 */
test("複合State取得は固定範囲だけを一回のReaderから返す", () => {
  const crud = fs.readFileSync(
    new URL("../../src/composition/crud.ts", import.meta.url),
    "utf8",
  );
  const source = [
    "readStateView",
    "readQueueState",
    "readExecutionState",
    "readWorkspaceState",
  ]
    .map((name) => stripTypeScriptTypes(sourceDeclaration(crud, name)))
    .join("\n");
  const root = {};
  const snapshot = {
    projects: [{ projectId: "project-a" }],
    queueEntries: [{ queueId: "queue-a" }],
    schemaRevision: 7,
    results: [{ id: "result-a" }],
    workspaces: [{ workspaceId: "workspace-a" }],
    snapshotRevision: 7,
    operations: [{ host: "INTERNAL_ONLY" }],
    leaseIntents: ["INTERNAL_ONLY"],
  };
  let reads = 0;
  const readModes: unknown[] = [];
  const candidate = Object.freeze({ projectId: "project-a", candidates: [] });
  let reply: unknown = {
    status: "completed",
    reason: "fixture_read",
    value: snapshot,
  };
  const read = new Function(
    "readSnapshot",
    "blocked",
    "completed",
    "observeTaskStartCandidates",
    `${source}; return { queue: readQueueState, execution: readExecutionState, workspace: readWorkspaceState };`,
  )(
    (actualRoot: unknown, binding: string, mode?: unknown) => {
      assert.strictEqual(actualRoot, root);
      assert.equal(binding, "binding-a");
      reads++;
      readModes.push(mode);
      return reply;
    },
    (reason: string) => ({ status: "blocked", reason, value: null }),
    (reason: string, value: unknown) => ({
      status: "completed",
      reason,
      value,
    }),
    (project: unknown) => {
      assert.strictEqual(project, snapshot.projects[0]);
      return candidate;
    },
  );
  for (const [scope, keys] of [
    ["queue", ["queueEntries", "leaseIntents"]],
    [
      "execution",
      ["projects", "queueEntries", "schemaRevision", "taskStartCandidates"],
    ],
    [
      "workspace",
      ["projects", "queueEntries", "results", "workspaces", "snapshotRevision"],
    ],
  ] as const) {
    const before = reads;
    const actual = read[scope](root, "binding-a");
    assert.equal(reads, before + 1);
    assert.equal(readModes.at(-1), undefined);
    assert.equal(actual.status, "completed");
    assert.deepEqual(Object.keys(actual.value).sort(), [...keys].sort());
    for (const key of keys) {
      if (key === "taskStartCandidates") {
        assert.equal(actual.value[key].length, 1);
        assert.strictEqual(actual.value[key][0], candidate);
        assert.ok(Object.isFrozen(actual.value[key]));
      } else assert.strictEqual(actual.value[key], snapshot[key]);
    }
  }
  const beforeInvalid = reads;
  for (const scope of ["queue", "execution", "workspace"] as const) {
    for (const invalid of [null, undefined, "legacy-root"]) {
      assert.equal(
        read[scope](invalid, "binding-a").reason,
        "coordinator_repository_root_invalid",
      );
    }
  }
  assert.equal(reads, beforeInvalid);
  reply = { status: "completed", reason: "absent", value: null };
  assert.deepEqual(read.execution(root, "binding-a"), reply);
  reply = {
    status: "blocked",
    reason: "lock_release_unconfirmed",
    value: null,
    recoveryId: "exact-fixture",
  };
  assert.strictEqual(read.workspace(root, "binding-a"), reply);
});

/**
 * 既存保存Readerへ三つの複合取得を接続する。
 * @responsibility 実Repositoryの不存在・同版取得・破損拒否を確認する。
 * @trace PRL-IT-005
 * @precondition 今回のCaseが生成するRepositoryだけを使う。
 * @stimulus 初期化前、初期化後、自己生成本文の破損後に三範囲を読む。
 * @observation field集合、改訂、保存結果とLock Fileの残存。
 * @oracle 拒否を空集合にせず、通常の固定投影は技術区画や生Snapshotを含まない。
 * @cleanup fixtureの既存hookが今回のRootだけを確認・回収する。
 * @boundary EM公開Readerと実Filesystem・共通Lock。
 */
test("複合State取得は実保存の不存在・同版・破損を区別する", (t) => {
  const { root } = fixture(t);
  const readers = [
    domain.readQueueState,
    domain.readExecutionState,
    domain.readWorkspaceState,
  ];
  for (const read of readers) {
    const empty = read({ directory: root }, "binding-a");
    assert.equal(empty.status, "completed");
    assert.equal(empty.value, null);
  }
  assert.equal(
    domain.initializeExecutionStore({ directory: root }, "binding-a").status,
    "completed",
  );
  const execution = domain.readExecutionState({ directory: root }, "binding-a");
  const workspace = domain.readWorkspaceState({ directory: root }, "binding-a");
  const queue = domain.readQueueState({ directory: root }, "binding-a");
  assert.equal(execution.status, "completed");
  assert.equal(workspace.status, "completed");
  assert.ok(execution.value && workspace.value);
  assert.equal(queue.status, "completed");
  assert.deepEqual(queue.value?.queueEntries, execution.value.queueEntries);
  assert.deepEqual(Object.keys(execution.value).sort(), [
    "projects",
    "queueEntries",
    "schemaRevision",
    "taskStartCandidates",
  ]);
  assert.deepEqual(Object.keys(workspace.value).sort(), [
    "projects",
    "queueEntries",
    "results",
    "snapshotRevision",
    "workspaces",
  ]);
  assert.deepEqual(execution.value.projects, workspace.value.projects);
  assert.deepEqual(execution.value.queueEntries, workspace.value.queueEntries);
  assert.equal(workspace.value.snapshotRevision, 1);
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const marker = path.join(
    root,
    ".crdd",
    "execution-model",
    "state.pending.json",
  );
  fs.writeFileSync(marker, fs.readFileSync(file));
  try {
    for (const read of readers)
      assert.equal(read({ directory: root }, "binding-a").status, "blocked");
  } finally {
    fs.rmSync(marker);
  }
  fs.writeFileSync(file, "invalid fixture");
  for (const read of readers) {
    const rejected = read({ directory: root }, "binding-a");
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.value, null);
    assert.equal(fs.readFileSync(file, "utf8"), "invalid fixture");
  }
});

/**
 * 現在Readerの初回・部分保存・排他終了と故障結果を検証する。
 * @responsibility 私有Reader・初期化と短期Ownerの故障を同じ保存Ownerで確認する。
 * @trace PRL-IT-013
 * @trace ERB-IT-014
 * @precondition 自己生成Git Repositoryだけを利用する。
 * @stimulus 不在、空領域、正規本文、不正本文、pending、未知物、Root差、境界出現と排他故障。
 * @observation 実Reader結果、Root引数、排他回数、本文とDirectory残存。
 * @oracle 通常Readerは不在拒否、専用入場だけ厳密不存在を許し、全故障は拒否する。
 * @cleanup 全mockを復元し自己生成Rootだけを回収する。
 * @boundary 実Filesystemと模擬Kernel排他。Docker・Provider要求は0。
 */
test("現在Readerは初期不存在・作成失敗・途中置換と解放不明を区別する", async () => {
  const ownedDirectory = createRepositoryTestDirectory(
    "current-admission-tests-",
  );
  const area = { directory: ownedDirectory.path };
  const root = fs.mkdtempSync(path.join(area.directory, "current-admission-"));
  let releaseResult = true;
  let releaseThrows = false;
  let live = true;
  let acquisitions = 0;
  let releases = 0;
  let afterAbsent: (() => void) | null = null;
  let areaFailure:
    | ConstructorParameters<typeof ExecutionStorageBlockedError>[0]
    | null = null;
  let areaCreations = 0;
  let areaThrows = false;
  try {
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { windowsHide: true },
    );
    const binding = observeExecutionStorageRepository({ directory: root });
    assert.ok(binding);
    const store = createRuntimeStorageSourceFixture(undefined, {
      ensurePhysicalExecutionDataArea: (
        ...args: Parameters<
          typeof areaInitialization.ensurePhysicalExecutionDataArea
        >
      ) => {
        if (areaThrows) throw new Error("fixture_partial_area_creation");
        return areaInitialization.ensurePhysicalExecutionDataArea(...args);
      },
      createExecutionDataArea: (
        ...args: Parameters<typeof areaInitialization.createExecutionDataArea>
      ) => {
        areaCreations++;
        return areaInitialization.createExecutionDataArea(...args);
      },
      observePhysicalExecutionDataArea: (
        ...args: Parameters<
          typeof areaObservation.observePhysicalExecutionDataArea
        >
      ) => {
        const value = areaObservation.observePhysicalExecutionDataArea(...args);
        if (value.status === "not_observed" && afterAbsent) {
          const hook = afterAbsent;
          afterAbsent = null;
          hook();
        }
        return value;
      },
      acquireExecutionStateLock: () => {
        acquisitions++;
        return {
          status: "acquired",
          lock: {
            assertLive: () => live,
            release: () => {
              releases++;
              if (releaseThrows) throw new Error("fixture_release");
              return releaseResult;
            },
          },
        };
      },
    });
    const taskStore = store;
    for (const fault of [
      "no_effect",
      "unknown",
      "cleanup_failed",
      "owner_release",
    ]) {
      const unknown = fault === "unknown";
      const cleanup = fault !== "cleanup_failed";
      areaFailure = {
        status: "blocked",
        reason: "repository_runtime_data_ignore_registration_blocked",
        effectIssued: unknown || !cleanup,
        effectStateUnknown: unknown,
        effectConfirmation: unknown ? "unknown" : "not_issued",
        cleanupConfirmed: cleanup,
        retryAllowed: !unknown && cleanup,
        recoveryReference: unknown ? "repository-local-ignore.exact" : null,
        repositoryPathReported: false,
      };
      releaseResult = fault !== "owner_release";
      const beforeReleases = releases;
      let failure: unknown;
      try {
        taskStore.initializeExecutionStore(
          { directory: root },
          "binding-a",
          () => {
            if (areaFailure)
              throw new ExecutionStorageBlockedError(areaFailure);
            return true;
          },
        );
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof domain.ExecutionStorageBlockedError);
      assert.equal(releases, beforeReleases + 1);
      assert.equal(areaCreations, 0);
      assert.equal(
        fs.existsSync(path.join(root, ".crdd", "execution-model")),
        false,
      );
      assert.equal(
        failure.cause,
        releaseResult
          ? undefined
          : "coordinator_snapshot_lock_release_unconfirmed",
      );
      const projected = failure;
      assert.equal(projected.reason, areaFailure.reason);
      assert.equal(projected.effectIssued, areaFailure.effectIssued);
      assert.equal(projected.effectStateUnknown, unknown);
      assert.equal(projected.cleanupConfirmed, cleanup);
      assert.equal(projected.retryAllowed, !unknown && cleanup);
      assert.deepEqual(
        projected.recoveryReference,
        unknown ? "repository-local-ignore.exact" : null,
      );
    }
    areaFailure = null;
    releaseResult = true;
    areaThrows = true;
    const beforeExceptionalRelease = releases;
    const exceptional = taskStore.initializeExecutionStore(
      { directory: root },
      "binding-a",
    );
    assert.equal(exceptional.status, "blocked");
    assert.equal(exceptional.manualRecoveryRequired, true);
    assert.equal(releases, beforeExceptionalRelease + 1);
    assert.equal(areaCreations, 0);
    areaThrows = false;
    let callerCurrent = true;
    const inspect = (directory: string) =>
      store.readState(
        prepareFixtureRecovery(directory, () => callerCurrent),
        { scope: "recovery", input: { kind: "admission" } },
      );
    const current = path.join(root, ".crdd", "execution-model");
    assert.equal(
      store.readState(prepareFixtureRecovery(root), {
        scope: "recovery",
      }).status,
      "blocked",
    );
    const absent = inspect(root);
    assert.equal(absent.status, "blocked");
    assert.equal(absent.reason, "coordinator_state_uninitialized");
    assert.equal(absent.lockReleased, true);
    assert.equal(fs.existsSync(current), false);
    for (const fault of ["release_false", "release_throw", "not_live"]) {
      releaseResult = fault !== "release_false";
      releaseThrows = fault === "release_throw";
      live = fault !== "not_live";
      const failed = inspect(root);
      assert.equal(failed.status, "blocked");
      assert.equal(failed.lockReleased, fault === "not_live");
      assert.equal(failed.value, null);
      assert.equal(fs.existsSync(current), false);
    }
    releaseResult = true;
    releaseThrows = false;
    live = true;
    const assertRefused = (value: ReturnType<typeof inspect>) => {
      assert.equal(value.status, "blocked");
      assert.equal(value.reason, "coordinator_state_read_unconfirmed");
      assert.equal(value.lockReleased, true);
      assert.equal(value.value, null);
    };
    const releaseBeforeLoss = releases;
    let invalidations = 0;
    afterAbsent = () => {
      live = false;
      invalidations++;
    };
    assertRefused(inspect(root));
    assert.equal(invalidations, 1);
    assert.equal(afterAbsent, null);
    assert.equal(releases, releaseBeforeLoss + 1);
    assert.equal(fs.existsSync(current), false);
    live = true;
    try {
      afterAbsent = () => {
        callerCurrent = false;
      };
      assert.equal(inspect(root).status, "blocked");
      assert.equal(afterAbsent, null);
      assert.equal(fs.existsSync(current), false);
    } finally {
      afterAbsent = null;
      callerCurrent = true;
    }
    afterAbsent = () => fs.mkdirSync(current, { recursive: true });
    assert.equal(inspect(root).status, "blocked");
    assert.equal(afterAbsent, null);
    assert.equal(inspect(root).status, "blocked");
    assert.deepEqual(fs.readdirSync(current), []);
    const file = path.join(current, "state.json");
    const bytes = Buffer.from(
      `${encodeStateValue({
        schema: EXECUTION_STATE_SCHEMA,
        revision: 1,
        previous: null,
        repositoryBinding: binding.repositoryBinding,
        repositoryBindingId: null,
        projects: [],
        managedExecutions: [],
        workspaces: [],
        queueEntries: [],
        leaseEvidence: [],
        leaseIntents: [],
        results: [],
        historyPending: [],
        decisions: [],
        blockers: [],
        operations: [],
        unresolvedRecoveries: [],
      })}\n`,
    );
    fs.writeFileSync(file, bytes);
    assert.equal(inspect(root).status, "completed");
    for (const name of [
      "state.pending.json",
      "state.lock",
      "history.pending.jsonl",
      "unknown.json",
    ]) {
      const injected = path.join(current, name);
      fs.writeFileSync(injected, "foreign", { flag: "wx" });
      try {
        assert.equal(inspect(root).status, "blocked");
        assert.deepEqual(fs.readFileSync(file), bytes);
        assert.equal(fs.readFileSync(injected, "utf8"), "foreign");
      } finally {
        fs.unlinkSync(injected);
      }
    }
    fs.writeFileSync(file, "invalid");
    assert.equal(inspect(root).status, "blocked");
    assert.equal(fs.readFileSync(file, "utf8"), "invalid");
    fs.writeFileSync(file, bytes);
    assert.equal(inspect(path.join(root, "missing")).status, "blocked");
    try {
      callerCurrent = false;
      assert.equal(inspect(root).status, "blocked");
    } finally {
      callerCurrent = true;
    }
    assert.equal(inspect(root).status, "completed");
    assert.equal(acquisitions, releases);
    assert.deepEqual(fs.readdirSync(current), ["state.json"]);
    assert.deepEqual(fs.readFileSync(file), bytes);
    let existingPreparationCalls = 0;
    const prepared = taskStore.initializeExecutionStore(
      { directory: root },
      "binding-a",
      () => {
        existingPreparationCalls++;
        return true;
      },
    );
    assert.equal(prepared.status, "completed");
    assert.equal(existingPreparationCalls, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    ownedDirectory.cleanup();
  }
});

/**
 * 保存の実行観測依存をDomainの有限Repository観測へ限定する。
 * @responsibility 移管前のController値依存禁止を新しい保存Ownerで維持する。
 * @trace ERB-IT-004
 * @precondition 現行保存Sourceだけを読む。
 * @stimulus 型消去後のimportを照合する。
 * @observation 禁止依存と有限観測Moduleへの直接接続。
 * @oracle Controllerへ依存せずstorage/lockへ接続する。
 * @cleanup 読取りだけで資源なし。
 * @boundary Domain保存OwnerのSource境界。Host・Dockerは実行しない。
 */
test("保存観測はControllerに依存せず有限Repository観測へ接続する", () => {
  const runtime = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/composition/crud.ts", import.meta.url),
      "utf8",
    ),
  );
  assert.doesNotMatch(runtime, /from\s+["'][^"']*controller\.ts["']/);
  assert.match(runtime, /from\s+["'][^"']*storage\/lock\.ts["']/);
  const publication = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/storage/store.ts", import.meta.url),
      "utf8",
    ),
  );
  assert.doesNotMatch(publication, /from\s+["'][^"']*controller\.ts["']/);
  assert.match(publication, /from\s+["']\.\/lock\.ts["']/);
});

/**
 * 同じ保存対象へ二つの用途が同じ資源名を割り当てることを拒否する。
 * @responsibility 保存入力のIdentity整合をDIの公開検査へ依存せず保証する。
 * @trace ERB-IT-014
 * @precondition 正常な合成Operationの保存入力。
 * @stimulus 五資源の各用途へ別用途と同じ名前を与える。
 * @observation Snapshot候補の受理又はnull。
 * @oracle 元入力だけ受理し、全重複を物理保存前に拒否する。
 * @cleanup N/A: 値の検査のみ。実Filesystem・Process・Dockerなし。
 * @boundary Domainの保存候補生成。保存の実成立を意味しない。
 */
test("保存Snapshotはkeyと同種資源名の重複を候補生成前に拒否する", () => {
  const fixture = createResourceOperationFixture();
  const book = createResourceBookFixture(fixture.ownershipLabel, "planned", [
    "container_a",
    "container_b",
  ]);
  const first = book.snapshot.resources[0],
    second = book.snapshot.resources[1];
  assert.ok(first && second);
  assert.ok(
    prepareStateResourceSnapshot(
      fixture.bytes,
      fixture.recoveryId,
      {
        event: "submission",
        key: first.key,
        snapshot: book.snapshot,
        cleanup: book.cleanup,
      },
      fixture.binding,
    ),
  );
  for (const mode of ["key", "name"] as const) {
    const invalid: OperationResources["snapshot"] = {
      resources: [
        first,
        {
          ...second,
          key: mode === "key" ? first.key : second.key,
          identity: mode === "name" ? { ...first.identity } : second.identity,
        },
      ],
    };
    assert.equal(
      prepareStateResourceSnapshot(
        fixture.bytes,
        fixture.recoveryId,
        {
          event: "submission",
          key: first.key,
          snapshot: invalid,
          cleanup: book.cleanup,
        },
        fixture.binding,
      ),
      null,
      mode,
    );
  }
});

/**
 * 初期不存在の再観測後も短期Ownerの生存を要求する。
 * @responsibility 二度目の生存確認省略を初期化可能へ補完しない。
 * @trace ERB-IT-014
 * @precondition 実Readerの固定分岐と有限の同期観測を使う。
 * @stimulus Owner失効とassertLive省略変異を与える。
 * @observation 固定失敗理由。
 * @oracle 原版はread_unconfirmed、変異だけuninitializedとなり拒否Oracleを破る。
 * @cleanup 値だけで外部資源なし。
 * @boundary Domain Reader分岐だけ。実Filesystem/Hostの成立は別Case。
 */
test("初期不存在Readerは排他取得後のOwner失効を補完しない", () => {
  const readerSource = fs.readFileSync(
    new URL("../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const absenceGuard = readerSource.indexOf(
    "      allowUninitialized &&\n      !metadataOnly &&",
  );
  assert.ok(absenceGuard > 0);
  const branchStart = readerSource.lastIndexOf("    if (", absenceGuard);
  const branchEnd = readerSource.indexOf(
    '    if (\n      initial.status !== "ready"',
    branchStart,
  );
  assert.ok(branchStart > 0 && branchEnd > branchStart);
  const branch = readerSource.slice(branchStart, branchEnd);
  assert.equal(branch.split("lock.assertLive()").length, 2);

  for (const [candidate, mutated] of [
    [branch, false],
    [branch.replace("lock.assertLive()", "true"), true],
  ] as const) {
    const reason = runInNewContext(
      `let reason = "coordinator_state_read_unconfirmed"; try {${candidate}} catch {} reason;`,
      {
        allowUninitialized: true,
        initial: { status: "not_observed" },
        metadataOnly: false,
        assertExecutionStateInitializationBoundary: () => undefined,
        observePhysicalExecutionDataArea: () => ({ status: "not_observed" }),
        repository: { repositoryRoot: "/fixture", revalidate: () => true },
        lock: { assertLive: () => false },
      },
    );

    assert.equal(
      reason,
      mutated
        ? "coordinator_state_uninitialized"
        : "coordinator_state_read_unconfirmed",
    );
  }
});

/**
 * 保存の区画間不変条件を生WriterのOwner内で反証する。
 * @responsibility 受付・Queue・Lease・結果・二世代判断とpendingの不正更新を拒否する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @precondition 今回の自己生成Git Rootと現行Schemaだけを使用する。
 * @stimulus 有限APIで正規値を保存後、私有Writerへ不正候補を与える。
 * @observation 元本文とpending本文、拒否結果を比較する。
 * @oracle 元世代・履歴・対象外区画を保持し不正候補を出版しない。
 * @cleanup 今回のRootだけを既存hookで回収する。
 * @boundary 保存の反例。有限の合成Lease観測を実Host終了・実Lease取得と扱わない。
 */
test("Host Windows: 保存区画の不正更新と二世代欠落を出版しない", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const cap = { directory: root };
  assert.equal(
    domain.initializeExecutionStore(cap, "binding-a").status,
    "completed",
  );
  const queue = domain.createQueue(cap, "binding-a", {
    kind: "scheduled",
    input: [
      {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: "b".repeat(64),
        originLane: "scheduled",
        repositoryRevision: "a".repeat(40),
        scopeHash: "c".repeat(64),
      },
      initialExecutionInput(state),
    ],
  });
  assert.equal(queue.status, "completed");
  if (queue.status !== "completed") throw Error("fixture_queue_invalid");
  const initial = readSnapshot({ directory: root }, "binding-a").value;
  assert.ok(initial);
  const queueId = "queue-a";
  const intent = {
    projectId: "project-a",
    queueId,
    kind: "project-operation" as const,
    ownerGeneration: "owner-a",
    ownerProcessId: process.pid,
    recoveryId: leaseAcquisitionRecoveryId(
      "binding-a",
      "project-a",
      queueId,
      "project-operation",
    ),
    phase: "acquisition_reserved" as const,
    physicalIdentity: null,
  };
  const identity = leaseIdentity(
    "binding-a",
    "project-a",
    queueId,
    "project-operation",
  );
  let rejectedCallbacks = 0;
  const invalidOwner = {
    get ownerGeneration(): string {
      rejectedCallbacks++;
      throw Error("must_not_read_owner_getter");
    },
    ownerProcessId: process.pid,
  };
  for (const owner of [
    invalidOwner,
    { ownerGeneration: "owner-a", ownerProcessId: 0 },
    { ownerGeneration: "owner-a", ownerProcessId: process.pid, extra: true },
  ]) {
    const rejected = domain.acquireLease(cap, "binding-a", {
      kind: "intent",
      input: [
        "project-a",
        queueId,
        "project-operation",
        owner,
        {
          resourcesAbsent: () => {
            rejectedCallbacks++;
            return true;
          },
          observeRoot: () => {
            rejectedCallbacks++;
            throw Error("must_not_observe");
          },
          markIntentSaveRequested: () => {
            rejectedCallbacks++;
          },
        },
      ],
    });
    assert.equal(rejected.status, "blocked");
  }
  assert.equal(rejectedCallbacks, 0);
  const reservationCalls: string[] = [];
  const reserved = domain.acquireLease(cap, "binding-a", {
    kind: "intent",
    input: [
      "project-a",
      queueId,
      "project-operation",
      {
        ownerGeneration: intent.ownerGeneration,
        ownerProcessId: intent.ownerProcessId,
      },
      {
        resourcesAbsent: (observedRoot, observedIdentity) => {
          assert.equal(observedRoot, root);
          assert.equal(observedIdentity, identity);
          reservationCalls.push("absent");
          return true;
        },
        observeRoot: () => {
          reservationCalls.push("root");
          return {
            repositoryRoot: root,
            rootIdentity: "f".repeat(64),
          };
        },
        markIntentSaveRequested: (recoveryId) => {
          assert.equal(recoveryId, intent.recoveryId);
          reservationCalls.push("mark");
        },
      },
    ],
  });
  assert.equal(reserved.status, "completed", JSON.stringify(reserved));
  assert.equal(reserved.value?.identity, identity);
  assert.deepEqual(reserved.value?.intent, intent);
  assert.deepEqual(reservationCalls, ["absent", "root", "mark"]);
  const current = path.join(root, ".crdd", "execution-model", "state.json");
  const leaseSnapshot = readSnapshot({ directory: root }, "binding-a").value;
  assert.ok(leaseSnapshot);
  {
    const bytes = fs.readFileSync(current, "utf8");
    const content = {
      kind: "project-operation",
      queueId,
      ownerGeneration: intent.ownerGeneration,
      ownerProcessId: intent.ownerProcessId,
      disposition: "acquisition_unknown_closed",
    };
    const skipped = {
      ...leaseSnapshot,
      snapshotRevision: leaseSnapshot.snapshotRevision + 1,
      leaseIntents: [],
      leaseEvidence: [
        {
          schema: "crdd-execution-model/storage-envelope/v2",
          schemaRevision: 1,
          recordKind: "lease-evidence",
          repositoryBindingId: "binding-a",
          projectId: "project-a",
          createdGeneration: 1,
          updatedGeneration: 2,
          contentHash: createHash("sha256")
            .update(JSON.stringify(content))
            .digest("hex"),
          content,
        },
      ],
    };
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify(skipped),
        leaseSnapshot.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), bytes);
    const pendingPath = path.join(
      root,
      ".crdd",
      "execution-model",
      "state.pending.json",
    );
    const pendingBytes = `${JSON.stringify({
      payload: skipped,
      contentHash: createHash("sha256")
        .update(JSON.stringify(skipped))
        .digest("hex"),
      baseRevision: leaseSnapshot.snapshotRevision,
      baseHash: createHash("sha256").update(bytes).digest("hex"),
    })}\n`;
    fs.writeFileSync(pendingPath, pendingBytes);
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify(skipped),
        leaseSnapshot.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), bytes);
    assert.equal(fs.readFileSync(pendingPath, "utf8"), pendingBytes);
    // 自己所有の不正入力fixtureだけを戻し、正規経路の反証を続ける。
    fs.unlinkSync(pendingPath);
  }

  const resultValue = {
    status: "completed",
    candidateReference: "candidate-a",
  };
  assert.equal(
    domain.saveIntegrationRecord(
      cap,
      "binding-a",
      {
        repositoryBindingId: "binding-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        queueId,
      },
      { kind: "integration", identity: "result-a", value: resultValue },
    ).status,
    "completed",
  );
  const payload = readSnapshot({ directory: root }, "binding-a").value;
  assert.ok(payload);
  const rootHash = payload.repositoryRootHash;
  const before = fs.readFileSync(current, "utf8");
  const next = { ...payload, snapshotRevision: payload.snapshotRevision + 1 };
  for (const invalid of [
    {
      ...next,
      intakeBindings: [],
    },
    { ...next, results: [] },
    { ...next, leaseIntents: [] },
    {
      ...next,
      leaseIntents: payload.leaseIntents.map((item) => ({
        ...item,
        ownerProcessId: item.ownerProcessId + 1,
      })),
    },
    { ...next, projects: [{ ...state, generation: state.generation + 2 }] },
    {
      ...next,
      queueEntries: [
        { ...queue.value, generation: 2, scopeHash: "d".repeat(64) },
      ],
    },
    {
      ...next,
      leaseIntents: [{ ...payload.leaseIntents[0], recoveryId: "different" }],
    },
  ]) {
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify(invalid),
        payload.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), before);
    const pendingPath = path.join(
      root,
      ".crdd",
      "execution-model",
      "state.pending.json",
    );
    const pending: string = `${JSON.stringify({ payload: invalid, contentHash: createHash("sha256").update(JSON.stringify(invalid)).digest("hex"), baseRevision: payload.snapshotRevision, baseHash: createHash("sha256").update(before).digest("hex") })}\n`;
    fs.writeFileSync(pendingPath, pending);
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify(next),
        payload.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(current, "utf8"), before);
    assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);
    fs.unlinkSync(pendingPath);
  }
  const pendingPayload = { ...next, repositoryRootHash: rootHash };
  const pending = `${JSON.stringify({ payload: pendingPayload, contentHash: createHash("sha256").update(JSON.stringify(pendingPayload)).digest("hex"), baseRevision: payload.snapshotRevision, baseHash: "0".repeat(64) })}\n`;
  const pendingPath = path.join(
    root,
    ".crdd",
    "execution-model",
    "state.pending.json",
  );
  fs.writeFileSync(pendingPath, pending);
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      JSON.stringify(next),
      payload.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);

  fs.unlinkSync(pendingPath);
  const file = current;
  const observed = readSnapshot({ directory: root }, "binding-a");
  assert.ok(observed.value);
  for (const malformed of [
    {
      ...observed.value,
      decisions: [{}],
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
    {
      ...observed.value,
      blockers: [{}],
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
    {
      ...observed.value,
      acceptanceDecisions: [],
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
    {
      ...observed.value,
      decisionRecoveries: [],
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
    {
      ...observed.value,
      schema: "unknown",
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
  ]) {
    const unchanged = fs.readFileSync(file, "utf8");
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify(malformed),
        observed.value.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), unchanged);
  }
});

const MAX_RECORD_BYTES = 16 * 1024 * 1024;
/**
 * 新Snapshotは旧形式を補完せず拒否する。
 * @responsibility 新しい現在集合の欠落を暗黙初期化にしない。
 * @trace PRL-IT-013
 * @precondition 新品の実Store。
 * @stimulus 旧schemaとworkspaces欠落の保存要求。
 * @observation 拒否と元Snapshot。
 * @oracle 改訂・現在値不変。
 * @cleanup fixtureのafter。
 * @boundary 実Snapshot codec／Writer。
 */
test("Host Windows: 旧SnapshotとWorkspace集合欠落を補完しない", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  assert.equal(initializeExecutionStore(root, "binding-a").status, "completed");
  assert.equal(
    domain.createQueue({ directory: root }, "binding-a", {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: state.projectId,
          milestoneId: state.milestoneId,
          requestHash: "b".repeat(64),
          originLane: "interactive",
          repositoryRevision: state.repositoryRevision,
          scopeHash: "c".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  const f = {
    root,
    binding: "binding-a",
    snapshot: () => {
      const read = readSnapshot({ directory: root }, "binding-a");
      assert.equal(read.status, "completed");
      assert.ok(read.value);
      return read.value;
    },
  };

  const before = f.snapshot();
  const old = {
    ...before,
    schema: "crdd-coordinator/snapshot/v2",
    schemaRevision: 2,
    snapshotRevision: before.snapshotRevision + 1,
  };
  assert.equal(
    writeSnapshot(
      { directory: f.root },
      f.binding,
      JSON.stringify(old),
      before.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.deepEqual(f.snapshot(), before);
  const { workspaces: _removed, ...missing } = before;
  assert.equal(
    writeSnapshot(
      { directory: f.root },
      f.binding,
      JSON.stringify({
        ...missing,
        snapshotRevision: before.snapshotRevision + 1,
      }),
      before.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.deepEqual(f.snapshot(), before);
});

/**
 * 現在状態と同じ途中保存本文を通常照会で成功扱いしない。
 * @responsibility 退役した配送専用Readerではなく現行の公開照会を検証する。
 * @trace PRL-IT-005
 * @precondition 今回の合成Repositoryに有効な初期状態を保存する。
 * @stimulus 現在状態と同じ本文を途中保存位置に置く。
 * @observation 照会結果と両方の本文。
 * @oracle 解決前は値なしで拒否し、本文を変更しない。
 * @cleanup fixtureの終了hookが今回のRootだけを回収する。
 * @boundary EM公開Readerと実Filesystem・共通Lock。
 */
test("現在Stateと同一の途中保存を通常照会で成功扱いしない", (t) => {
  const { root } = fixture(t);
  assert.equal(
    domain.initializeExecutionStore({ directory: root }, "binding-a").status,
    "completed",
  );
  const state = path.join(root, ".crdd", "execution-model", "state.json");
  const committed = fs.readFileSync(state);
  const pending = path.join(path.dirname(state), "state.pending.json");
  fs.writeFileSync(pending, committed, { flag: "wx" });

  const result = domain.readExecutionState({ directory: root }, "binding-a");
  assert.equal(result.status, "blocked");
  assert.equal(result.value, null);
  assert.deepEqual(fs.readFileSync(state), committed);
  assert.deepEqual(fs.readFileSync(pending), committed);
});

import { prepareStateResourceSnapshot } from "../../src/composition/transition.ts";

/**
 * 初回計画の拒否をStore作成前に閉じ、ProjectとQueueを同じ保存へ組み込む。
 * @responsibility 旧State受付なし・入力hook非実行・generation 1と初期値同等を反証する。
 * @trace PRL-IT-005
 * @precondition 今回の合成Gitだけを使用する。
 * @stimulus 不正Owner・上限・循環・旧State・getter・Proxyと有効な有限初期化入力。
 * @observation 拒否時のstate.json不存在と成功後のProject・Queue。
 * @oracle 不正入力で保存0、有効入力は元の初期値を一組保存する。
 * @cleanup fixtureの終了hookで今回Rootだけを回収する。
 * @boundary EM公開createQueueと実Filesystem。AI・Dockerなし。
 */
test("初回Queue受付は不正入力でStoreを作らず初期値をEMで確定する", (t) => {
  const { root, state } = fixture(t);
  const initialization = initialExecutionInput(state);
  const queue = {
    queueId: "initial-request",
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    repositoryRevision: state.repositoryRevision,
    requestHash: "a".repeat(64),
    scopeHash: "b".repeat(64),
    originLane: "scheduled" as const,
  };
  let preparationCalls = 0;
  const prepare = () => {
    preparationCalls++;
    return true;
  };
  const request = (input: unknown) =>
    domain.createQueue(
      { directory: root },
      "binding-a",
      {
        kind: "scheduled",
        input: [queue, input as domain.ProjectExecutionInitialization],
      },
      prepare,
    );
  let hooks = 0;
  const accessor = {
    ...initialization,
    get ownerGeneration() {
      hooks++;
      return "owner";
    },
  };
  const proxy = new Proxy(initialization, {
    ownKeys() {
      hooks++;
      return Reflect.ownKeys(initialization);
    },
  });
  const firstTask = initialization.tasks[0];
  assert.ok(firstTask);
  const statePath = path.join(root, ".crdd", "execution-model", "state.json");
  for (const input of [
    state,
    accessor,
    proxy,
    { ...initialization, ownerGeneration: "" },
    { ...initialization, maximumConcurrency: 0 },
    { ...initialization, maximumConcurrency: 6 },
    { ...initialization, projectId: "other-project" },
    {
      ...initialization,
      tasks: [{ ...firstTask, dependencies: [firstTask.id] }],
    },
    {
      ...initialization,
      tasks: [{ ...firstTask, allowedPaths: ["../outside"] }],
    },
  ]) {
    assert.equal(request(input).status, "blocked");
    assert.equal(fs.existsSync(statePath), false);
    assert.equal(fs.existsSync(path.dirname(statePath)), false);
  }
  assert.equal(hooks, 0);
  for (const invalidQueue of [
    { ...queue, queueId: "" },
    { ...queue, queueId: "../outside" },
    { ...queue, requestHash: "invalid" },
    { ...queue, scopeHash: "invalid" },
    { ...queue, originLane: "unknown" },
    { ...queue, workspaceId: "../outside" },
    { ...queue, workspaceId: 1 },
    { ...queue, unknown: true },
  ]) {
    const isolated = fixture(t);
    const rejected = domain.createQueue(
      { directory: isolated.root },
      "binding-a",
      {
        kind: "scheduled",
        input: [invalidQueue as domain.QueueEnqueueInput, initialization],
      },
      prepare,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(
      fs.existsSync(path.join(isolated.root, ".crdd", "execution-model")),
      false,
    );
    assert.equal(
      fs.existsSync(
        path.join(isolated.root, ".crdd", "execution-model", "state.json"),
      ),
      false,
    );
  }
  assert.equal(preparationCalls, 0);
  const accepted = request(initialization);
  assert.equal(accepted.status, "completed", accepted.reason);
  assert.equal(preparationCalls, 1);
  const observed = readProjectExecutionState(
    { directory: root },
    "binding-a",
    state.projectId,
  );
  assert.equal(observed.status, "completed", observed.reason);
  if (observed.status !== "completed") throw Error("fixture_state_unavailable");
  assert.deepEqual(observed.value, state);
  const snapshot = readSnapshot({ directory: root }, "binding-a");
  assert.equal(snapshot.value?.projects.length, 1);
  assert.equal(snapshot.value?.queueEntries.length, 1);
  assert.equal(snapshot.value?.projects[0]?.generation, 1);
  const bytes = fs.readFileSync(statePath, "utf8");
  assert.equal(request(state).status, "blocked");
  assert.equal(preparationCalls, 1);
  assert.equal(fs.readFileSync(statePath, "utf8"), bytes);
  for (const legacy of [state, JSON.stringify(state)]) {
    const refused: ReturnType<typeof domain.saveProjectExecutionState> =
      Reflect.apply(domain.saveProjectExecutionState, undefined, [
        { directory: root },
        "binding-a",
        legacy,
        state.generation,
      ]);
    assert.equal(refused.status, "blocked");
    if (refused.status !== "blocked") throw Error("legacy_state_was_accepted");
    assert.equal(refused.reason, "coordinator_snapshot_input_invalid");
    assert.equal(refused.manualRecoveryRequired, false);
    assert.deepEqual(fs.readFileSync(statePath, "utf8"), bytes);
  }
  assert.equal(observed.taskStartCandidates?.projectId, state.projectId);
  assert.equal(observed.taskStartCandidates?.generation, state.generation);
  assert.deepEqual(observed.taskStartCandidates?.taskIds, [firstTask.id]);
  const command = {
    kind: "task_start" as const,
    projectId: state.projectId,
    taskId: firstTask.id,
    attemptId: "attempt-a",
    authorityBindingId: "authority-a",
  };
  const reserve = (generation: number, input = command) =>
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      input,
      generation,
    );
  for (const [generation, input, reason] of [
    [
      state.generation + 1,
      command,
      "coordinator_generation_or_identity_mismatch",
    ],
    [
      state.generation,
      { ...command, taskId: "missing" },
      "coordinator_task_not_schedulable",
    ],
  ] as const) {
    const rejected = reserve(generation, input);
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.reason, reason);
    assert.equal(Object.hasOwn(rejected, "taskStartCandidates"), false);
    assert.equal(fs.readFileSync(statePath, "utf8"), bytes);
  }
  const reserved = reserve(state.generation);
  assert.equal(reserved.status, "completed", reserved.reason);
  if (reserved.status !== "completed")
    throw Error("fixture_reservation_failed");
  assert.equal(reserved.value.generation, state.generation + 1);
  assert.equal(reserved.value.tasks[0]?.startPhase, "reserved");
  assert.equal(
    reserved.taskStartCandidates.generation,
    reserved.value.generation,
  );
  assert.deepEqual(reserved.taskStartCandidates.taskIds, []);
  const reservedBytes = fs.readFileSync(statePath, "utf8");
  const replay = reserve(state.generation);
  assert.equal(replay.status, "completed", replay.reason);
  if (replay.status !== "completed")
    throw Error("fixture_reservation_replay_failed");
  assert.equal(replay.value.generation, reserved.value.generation);
  assert.equal(fs.readFileSync(statePath, "utf8"), reservedBytes);
  assert.equal(
    reserve(state.generation, { ...command, attemptId: "other-attempt" })
      .status,
    "blocked",
  );
  assert.equal(
    reserve(state.generation, {
      ...command,
      authorityBindingId: "other-authority",
    }).status,
    "blocked",
  );
  const wrongRequest = domain.saveProjectExecutionState(
    { directory: root },
    "binding-a",
    command,
    state.generation,
    {
      operation: "start",
      queueId: queue.queueId,
      projectId: queue.projectId,
      milestoneId: queue.milestoneId,
      requestHash: "c".repeat(64),
    },
  );
  assert.equal(wrongRequest.status, "blocked");
  assert.equal(
    reserve(reserved.value.generation).reason,
    "coordinator_task_not_schedulable",
  );
  assert.equal(fs.readFileSync(statePath, "utf8"), reservedBytes);
  const handed = domain.saveProjectExecutionState(
    { directory: root },
    "binding-a",
    {
      kind: "task_handoff",
      projectId: state.projectId,
      taskId: firstTask.id,
      attemptId: command.attemptId,
      operationId: "operation-a",
    },
    reserved.value.generation,
  );
  assert.equal(handed.status, "completed", handed.reason);
  if (handed.status !== "completed") throw Error("fixture_handoff_failed");
  const handedBytes = fs.readFileSync(statePath, "utf8");
  const handoff = {
    kind: "task_handoff" as const,
    projectId: state.projectId,
    taskId: firstTask.id,
    attemptId: command.attemptId,
    operationId: "operation-a",
  };
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      handoff,
      reserved.value.generation,
    ).status,
    "completed",
  );
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      { ...handoff, operationId: "other-operation" },
      reserved.value.generation,
    ).status,
    "blocked",
  );
  assert.equal(reserve(reserved.value.generation).status, "blocked");
  assert.equal(fs.readFileSync(statePath, "utf8"), handedBytes);
  const start = { ...handoff, kind: "task_started" as const };
  const started = domain.saveProjectExecutionState(
    { directory: root },
    "binding-a",
    start,
    handed.value.generation,
  );
  assert.equal(started.status, "completed", started.reason);
  if (started.status !== "completed") throw Error("fixture_started_failed");
  const runningBytes = fs.readFileSync(statePath, "utf8");
  assert.equal(started.value.tasks[0]?.state, "running");
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      start,
      handed.value.generation,
    ).status,
    "completed",
  );
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      handoff,
      reserved.value.generation,
    ).status,
    "blocked",
  );
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      { ...start, attemptId: "other" },
      handed.value.generation,
    ).status,
    "blocked",
  );
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      start,
      started.value.generation,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(statePath, "utf8"), runningBytes);
  const terminal = {
    ...handoff,
    kind: "task_settle" as const,
    authorityBindingId: "authority-a",
    outcome: "completed" as const,
    cleanupConfirmed: true,
    recoveryObligations: [],
    recoveryUnresolved: false,
    resultUnresolved: false,
    candidateId: null,
  };
  const terminalSaved = domain.saveProjectExecutionState(
    { directory: root },
    "binding-a",
    terminal,
    started.value.generation,
  );
  assert.equal(terminalSaved.status, "completed", terminalSaved.reason);
  const terminalBytes = fs.readFileSync(statePath, "utf8");
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      terminal,
      started.value.generation,
    ).status,
    "completed",
  );
  assert.equal(
    domain.saveProjectExecutionState(
      { directory: root },
      "binding-a",
      { ...terminal, resultUnresolved: true },
      started.value.generation,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(statePath, "utf8"), terminalBytes);
});

/**
 * 自己生成Rootを既存の真正参照検査へ渡す。
 * @trace PRL-IT-005
 * @precondition 今回のfixtureだけを使う。
 * @stimulus VCのRoot確認後に初期化する。
 * @observation 保存結果。
 * @oracle 生Pathは製品公開APIへ渡さない。
 * @cleanup 呼出しCaseのhookで終了確認後清掃する。
 * @boundary 試験準備。
 */
function initializeExecutionStore(root: string, binding: string) {
  return initializeSnapshot({ directory: root }, binding);
}

/**
 * 開始前終端を既存Writerの一保存・再送・解放へ接続する。
 * @trace PRL-IT-005
 * @precondition 各outcomeは独立した今回Rootと実保存を使う。
 * @stimulus 三結果、外部resultFacts注入、同一及び異内容の再送を与える。
 * @observation 保存bytes・世代、TaskとObjective／Milestone、Operation区画。
 * @oracle 同じ内部結果事実だけを使い、再送はbytes不変、不一致は保全停止する。
 * @cleanup 既存fixtureの同一実体確認付き終了hook。
 * @boundary 新品Git Repositoryと既存単一Writer。実AI・Dockerなし。
 */
test("開始前終端の有限保存は内部結果事実と三結果の再送を維持する", async (t) => {
  for (const outcome of ["failed", "cancelled", "recovery_required"] as const)
    await t.test(outcome, (subtest) => {
      const { root, state } = fixture(subtest);
      const cap = { directory: root };
      assert.equal(
        domain.initializeExecutionStore(cap, "binding-a").status,
        "completed",
      );
      assert.equal(
        domain.createQueue(cap, "binding-a", {
          kind: "scheduled",
          input: [
            {
              queueId: "queue-a",
              projectId: state.projectId,
              milestoneId: state.milestoneId,
              requestHash: "a".repeat(64),
              originLane: "interactive",
              repositoryRevision: state.repositoryRevision,
              scopeHash: "b".repeat(64),
            },
            initialExecutionInput(state),
          ],
        }).status,
        "completed",
      );
      assert.deepEqual(
        domain.readProjectExecutionState(cap, "binding-a", state.projectId)
          .value,
        state,
      );
      const reserved = domain.saveProjectExecutionState(
        cap,
        "binding-a",
        {
          kind: "task_start",
          projectId: state.projectId,
          taskId: "task-a",
          attemptId: "attempt-a",
          authorityBindingId: "authority-a",
        },
        state.generation,
      );
      assert.equal(reserved.status, "completed");
      if (reserved.status !== "completed")
        throw Error("fixture_reservation_failed");
      const prepared = domain.saveProjectExecutionState(
        cap,
        "binding-a",
        {
          kind: "task_handoff",
          projectId: state.projectId,
          taskId: "task-a",
          attemptId: "attempt-a",
          operationId: "operation-a",
        },
        reserved.value.generation,
      );
      assert.equal(prepared.status, "completed");
      if (prepared.status !== "completed")
        throw Error("fixture_handoff_failed");
      const command = {
        kind: "task_settle_before_effect" as const,
        projectId: state.projectId,
        taskId: "task-a",
        attemptId: "attempt-a",
        operationId: "operation-a",
        authorityBindingId: "authority-a",
        outcome,
        cleanupConfirmed: outcome !== "recovery_required",
        recoveryObligations: [],
        recoveryUnresolved: outcome === "recovery_required",
      };
      const file = path.join(root, ".crdd/execution-model/state.json");
      const before = fs.readFileSync(file);
      assert.equal(
        Reflect.apply(domain.saveProjectExecutionState, undefined, [
          cap,
          "binding-a",
          command,
          prepared.value.generation,
          undefined,
          [
            {
              taskId: "task-a",
              attemptId: "attempt-a",
              operationId: "operation-a",
              recoveryUnresolved: false,
            },
          ],
        ]).status,
        "blocked",
      );
      assert.deepEqual(fs.readFileSync(file), before);
      const saved = domain.saveProjectExecutionState(
        cap,
        "binding-a",
        command,
        prepared.value.generation,
      );
      assert.equal(saved.status, "completed", saved.reason);
      if (saved.status !== "completed")
        throw Error("fixture_settlement_failed");
      assert.equal(saved.value.tasks[0]?.state, outcome);
      assert.equal(saved.value.generation, prepared.value.generation + 1);
      const bytes = fs.readFileSync(file);
      const replay = domain.saveProjectExecutionState(
        cap,
        "binding-a",
        command,
        prepared.value.generation,
      );
      assert.equal(replay.status, "completed", replay.reason);
      assert.equal(
        domain.saveProjectExecutionState(
          cap,
          "binding-a",
          { ...command, authorityBindingId: "other" },
          prepared.value.generation,
        ).status,
        "blocked",
      );
      assert.equal(
        domain.saveProjectExecutionState(
          cap,
          "binding-a",
          command,
          saved.value.generation,
        ).status,
        "blocked",
      );
      assert.deepEqual(fs.readFileSync(file), bytes);
      assert.equal(JSON.parse(bytes.toString()).operations.length, 0);
    });
});

/**
 * 保存試験の既知の合成管理Projectを返す。
 * @responsibility 実行OwnerやProviderを生成せずcodecの入力値だけを作る。
 * @trace PRL-IT-005
 * @precondition 自己生成Repositoryを使用する。
 * @stimulus 新規Gitと固定の初期値を用意する。
 * @observation exact Rootと合成状態。
 * @oracle 全Taskは未開始でEffect・Authority・Recoveryを捏造しない。
 * @cleanup helperの終了hookが今回Rootだけを確認後清掃する。
 * @boundary 試験fixture。
 */
function fixture(t: test.TestContext) {
  const directory = createRepositoryTestDirectory("runtime-snapshot-io-");
  t.after(directory.cleanup);
  const state = {
    contract: "crdd-execution-model/project-state/v3",
    taskExecutionSelections: {
      executor: {
        provider: "codex",
        modelIdentifier: "gpt-5.5",
        identifierKind: "exact",
        reasoningEffort: "medium",
        purpose: "task",
        catalogIdentity:
          "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
        configIdentity:
          "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
        role: "executor",
        workType: null,
        source: "role_default",
      },
      reviewer: {
        provider: "claude",
        modelIdentifier: "opus",
        identifierKind: "alias",
        reasoningEffort: "high",
        purpose: "task",
        catalogIdentity:
          "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
        configIdentity:
          "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
        role: "independent_reviewer",
        workType: null,
        source: "role_default",
      },
    },
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    generation: 1,
    ownerGeneration: "owner-a",
    decisionApplicationId: null,
    maximumConcurrency: 2,
    milestone: {
      id: "milestone-a",
      acceptanceCriteria: ["accepted"],
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives: [
      {
        definition: {
          id: "objective-a",
          acceptanceCriteria: ["done"],
        },
        state: "planned",
        criterionEvidenceIds: [],
      },
    ],
    tasks: [
      {
        definition: {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["src/a.ts"],
          conflictKeys: [],
        },
        state: "ready",
        attemptId: null,
        operationId: null,
        authorityBindingId: null,
        startPhase: "none",
        cleanupConfirmed: false,
        recoveryObligations: [],
        recoveryUnresolved: false,
        candidateId: null,
        retryCount: 0,
        supersededBy: null,
      },
    ],
  } as ProjectExecutionState;
  return { root: directory.path, state };
}

/**
 * 判断の一回保存と履歴の故障・再入場・退役を確認する。
 * @responsibility Stateと履歴の結果分離、時間経過後の再入場、入力の非評価を反証する。
 * @trace PRL-IT-014
 * @precondition 自己生成Repositoryと現行Writerだけを使用する。
 * @stimulus getter／Proxy要求、回答、履歴rename故障、2日後再送、不正履歴、退役・再発行、旧Schemaを与える。
 * @observation State改訂・判断・対象状態・Blocker、履歴・pendingと結果、getter評価数。
 * @oracle 回答は一改訂。時間経過後の再送はState保存0で元履歴候補を確定し、不正履歴と早過ぎる退役を保全停止する。
 * @cleanup fixtureの同一実体限定cleanupを実行する。
 * @boundary 実Filesystemと共通wx。AI・Docker・旧記録は使わない。
 */
test("Decision State: 回答と対象状態を一回保存し同一再送では保存しない", (t) => {
  const { root, state } = fixture(t);
  const nativeNow = Date.now;
  let clockOffset = 0;
  const dayMs = 86_400_000;
  t.mock.method(Date, "now", () => nativeNow() + clockOffset);
  let answeredAt = new Date().toISOString();
  const requestedAt = new Date(Date.parse(answeredAt) - 60_000).toISOString();
  const repository = { directory: root };
  const historyRepository = {
    root: repository,
    historyRetentionDays: 30,
    revalidate: () => true,
  };
  assert.equal(
    domain.initializeExecutionStore(repository, "binding-a").status,
    "completed",
  );
  assert.equal(
    domain.createQueue(repository, "binding-a", {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: state.projectId,
          milestoneId: state.milestoneId,
          requestHash: "b".repeat(64),
          originLane: "interactive",
          repositoryRevision: state.repositoryRevision,
          scopeHash: "c".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  let pendingState = state;
  for (const command of [
    {
      kind: "task_start" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    },
    {
      kind: "task_handoff" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
    },
    {
      kind: "task_started" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
    },
    {
      kind: "task_settle" as const,
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
      outcome: "completed" as const,
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
      resultUnresolved: false,
    },
  ]) {
    const saved = domain.saveProjectExecutionState(
      repository,
      "binding-a",
      command,
      pendingState.generation,
    );
    assert.equal(saved.status, "completed", saved.reason);
    if (saved.status !== "completed")
      throw Error("fixture_task_transition_failed");
    pendingState = saved.value;
  }
  let request: import("../../src/decision/types.ts").DecisionRequest = {
    decisionId: "decision-a",
    blockerId: "blocker-a",
    respondentPrincipalId: "operator-a",
    kind: "acceptance",
    target: {
      projectId: state.projectId,
      milestoneId: state.milestoneId,
      kind: "objective",
      id: "objective-a",
      generation: pendingState.generation,
      repositoryRevision: state.repositoryRevision,
    },
    question: "Objectiveの成果を受け入れますか？",
    options: [{ value: "accept", label: "根拠を確認して受入" }],
    requestedAt,
  };
  const pristineState = fs.readFileSync(
    path.join(root, ".crdd", "execution-model", "state.json"),
  );
  let evaluated = 0;
  const accessorRequest = { ...request };
  Object.defineProperty(accessorRequest, "decisionId", {
    enumerable: true,
    get() {
      evaluated += 1;
      throw Error("getter_must_not_run");
    },
  });
  const proxyRequest = new Proxy(request, {
    get() {
      evaluated += 1;
      throw Error("proxy_must_not_run");
    },
  });
  for (const invalid of [accessorRequest, proxyRequest]) {
    const rejected = privateDecisionCrud.requestDecision(
      historyRepository,
      "binding-a",
      invalid,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.reason, "decision_input_invalid");
    assert.deepEqual(
      fs.readFileSync(
        path.join(root, ".crdd", "execution-model", "state.json"),
      ),
      pristineState,
    );
    assert.throws(
      () =>
        fs.lstatSync(
          path.join(root, ".crdd", "execution-model", "history.jsonl"),
        ),
      { code: "ENOENT" },
    );
  }
  assert.equal(evaluated, 0);
  const held = domain.recordDecision(
    historyRepository,
    "binding-a",
    {
      ...request,
      decisionId: "proposal-held",
      requestedAt: new Date(Date.parse(answeredAt) - 120_000).toISOString(),
      options: [{ value: "wait", label: "保留" }],
    },
    {
      principalId: "operator-a",
      answeredAt: new Date(Date.parse(answeredAt) - 90_000).toISOString(),
      selectedOption: "wait",
      reason: "次の案を確認する",
      evidenceIds: [],
    },
  );
  assert.equal(held.status, "completed", JSON.stringify(held));
  answeredAt = new Date().toISOString();
  request = { ...request, requestedAt: answeredAt };
  const requested = privateDecisionCrud.requestDecision(
    historyRepository,
    "binding-a",
    request,
  );
  assert.equal(requested.status, "completed", JSON.stringify(requested));
  if (requested.status === "completed")
    assert.equal(requested.value.history.status, "confirmed");
  const before = privateStorageStore.readSnapshot(repository, "binding-a");
  assert.equal(before.status, "completed");
  if (before.status !== "completed" || !before.value)
    throw Error("before_invalid");
  const starting: ProjectExecutionState = {
    ...pendingState,
    generation: pendingState.generation + 1,
    tasks: pendingState.tasks.map((task) => ({
      ...task,
      state: "starting",
      startPhase: "reserved",
      attemptId: "attempt-new",
      authorityBindingId: "authority-new",
      operationId: null,
    })),
  };
  const sourceWithBlocker = fs.readFileSync(
    path.join(root, ".crdd", "execution-model", "state.json"),
  );
  const physicalBinding = JSON.parse(
    sourceWithBlocker.toString("utf8"),
  ).repositoryBinding;
  assert.equal(
    prepareUnifiedTaskSnapshot(
      sourceWithBlocker,
      starting,
      pendingState.generation,
      physicalBinding,
    ),
    null,
  );
  const decodedSource = decodeStateSnapshot(sourceWithBlocker, physicalBinding);
  assert.ok(decodedSource);
  const recoveringQueue: domain.ProjectQueueEntry = {
    historySettled: false,
    queueId: "queue-recovering",
    projectId: pendingState.projectId,
    milestoneId: pendingState.milestoneId,
    requestHash: "a".repeat(64),
    originLane: "interactive",
    repositoryRevision: pendingState.repositoryRevision,
    scopeHash: "b".repeat(64),
    state: "recovery_required",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: "exact_recovery",
    resultReference: "recovery-a",
    workspaceId: null,
  };
  const recoverySource = {
    ...decodedSource.snapshot,
    queueEntries: [recoveringQueue],
  };
  const recoveryBytes = Buffer.from(`${encodeStateValue(recoverySource)}\n`);
  assert.ok(decodeStateSnapshot(recoveryBytes, physicalBinding));
  const settlement = prepareQueueRecoverySettlement(
    {
      ...before.value,
      queueEntries: recoverySource.queueEntries,
    },
    recoveringQueue.queueId,
    recoveringQueue.generation,
    "recovery-a",
  );
  if (settlement.status !== "completed") throw Error("recovery_fixture");
  const settledSource = {
    ...recoverySource,
    revision: recoverySource.revision + 1,
    previous: {
      revision: recoverySource.revision,
      payloadSha256: hashExecutionStateContent(recoverySource),
    },
    queueEntries: [settlement.value.value],
  };
  const settledBytes = Buffer.from(`${encodeStateValue(settledSource)}\n`);
  assert.equal(
    validateUnifiedTransition(recoveryBytes, settledBytes, physicalBinding),
    true,
  );
  for (const change of [
    { generation: recoveringQueue.generation + 2 },
    { resultReference: "recovery-other" },
  ])
    assert.equal(
      validateUnifiedTransition(
        recoveryBytes,
        Buffer.from(
          `${encodeStateValue({
            ...settledSource,
            queueEntries: [{ ...settlement.value.value, ...change }],
          })}\n`,
        ),
        physicalBinding,
      ),
      false,
    );
  assert.equal(
    validateUnifiedTransition(
      settledBytes,
      Buffer.from(
        `${encodeStateValue({
          ...settledSource,
          revision: settledSource.revision + 1,
          previous: {
            revision: settledSource.revision,
            payloadSha256: hashExecutionStateContent(settledSource),
          },
          queueEntries: [
            {
              ...settlement.value.value,
              generation: settlement.value.value.generation + 1,
              state: "leased",
              ownerGeneration: "owner-blocked",
            },
          ],
        })}\n`,
      ),
      physicalBinding,
    ),
    false,
  );
  const unblockedSource = Buffer.from(
    `${encodeStateValue({
      ...decodedSource.snapshot,
      decisions: [],
      blockers: [],
    })}\n`,
  );
  assert.ok(
    prepareUnifiedTaskSnapshot(
      unblockedSource,
      starting,
      pendingState.generation,
      physicalBinding,
    ),
  );
  const answer: import("../../src/decision/types.ts").DecisionAnswer = {
    principalId: "operator-a",
    answeredAt,
    selectedOption: "accept",
    reason: "根拠を確認した",
    evidenceIds: ["evidence-a"],
  };
  const directory = path.join(root, ".crdd", "execution-model");
  const historyFile = path.join(directory, "history.jsonl");
  const historyPending = path.join(directory, "history.pending.jsonl");
  const originalState = fs.readFileSync(path.join(directory, "state.json"));
  const originalHistory = fs.readFileSync(historyFile);
  const wrongRespondent = privateDecisionCrud.answerDecision(
    historyRepository,
    "binding-a",
    request.decisionId,
    {
      ...answer,
      principalId: "operator-b",
    },
  );
  assert.equal(wrongRespondent.status, "blocked");
  assert.deepEqual(
    fs.readFileSync(path.join(directory, "state.json")),
    originalState,
  );
  assert.deepEqual(fs.readFileSync(historyFile), originalHistory);
  // 保持期限直前の非保護行を用意する。判断の再入場では削らず、後の保守で期限整理する。
  const legacyAt = new Date(nativeNow() - 29 * dayMs).toISOString();
  const legacyLine = `${encodeStateValue({
    schema: "crdd-execution-model/history-row/v3",
    occurredAt: legacyAt,
    summary: {
      schema: "crdd-coordinator/task-summary/v1",
      record: {
        id: "legacy-task",
        occurredAt: legacyAt,
        outcome: "completed",
        primaryFailure: null,
        cleanup: "not_required",
      },
    },
  })}\n`;
  fs.writeFileSync(
    historyFile,
    Buffer.concat([Buffer.from(legacyLine), fs.readFileSync(historyFile)]),
  );
  let injected = 0;
  const rename = fs.renameSync;
  const historyFault = t.mock.method(fs, "renameSync", ((from, to) => {
    if (String(from) === historyPending) {
      injected += 1;
      throw Object.assign(new Error("synthetic history publication failure"), {
        code: "EACCES",
      });
    }
    return Reflect.apply(rename, fs, [from, to]);
  }) as typeof rename);
  let result: ReturnType<typeof privateDecisionCrud.answerDecision>;
  try {
    result = privateDecisionCrud.answerDecision(
      historyRepository,
      "binding-a",
      request.decisionId,
      answer,
    );
  } finally {
    historyFault.mock.restore();
  }
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(injected, 1);
  if (result.status === "completed") {
    assert.equal(result.value.decision.status, "applied");
    assert.equal(result.value.history.status, "unconfirmed");
  }
  const stateAfterFailure = fs.readFileSync(path.join(directory, "state.json"));
  const pendingBeforeResume = fs.readFileSync(historyPending);
  clockOffset = 2 * dayMs;
  assert.equal(
    privateStorageStore.readSnapshot(repository, "binding-a").status,
    "blocked",
  );
  const resumed = privateDecisionCrud.answerDecision(
    historyRepository,
    "binding-a",
    request.decisionId,
    answer,
  );
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  if (resumed.status === "completed")
    assert.equal(resumed.value.history.status, "confirmed");
  assert.deepEqual(
    fs.readFileSync(path.join(directory, "state.json")),
    stateAfterFailure,
  );
  assert.deepEqual(fs.readFileSync(historyFile), pendingBeforeResume);
  assert.equal(fs.existsSync(historyPending), false);
  const after = privateStorageStore.readSnapshot(repository, "binding-a");
  assert.equal(after.status, "completed");
  if (after.status !== "completed" || !after.value)
    throw Error("after_invalid");
  assert.equal(after.value.snapshotRevision, before.value.snapshotRevision + 1);
  assert.equal(after.value.decisions[0]?.status, "applied");
  assert.equal(after.value.blockers[0]?.status, "resolved");
  assert.equal(after.value.projects[0]?.objectives[0]?.state, "accepted");
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const bytes = fs.readFileSync(file);
  const history = fs.readFileSync(historyFile);
  const allEvents = history
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter(
      (row) => row.summary.schema === "crdd-coordinator/decision-event/v1",
    )
    .map((row) => row.summary.record);
  assert.equal(allEvents.length, 6);
  assert.ok(allEvents.every((event) => event.blockerId === request.blockerId));
  const events = allEvents.filter(
    (event) => event.decisionId === request.decisionId,
  );
  assert.deepEqual(
    events.map((event) => event.eventId),
    ["decision-a:requested", "decision-a:answered", "decision-a:applied"],
  );
  assert.equal(events[1].answer.reason, answer.reason);
  assert.equal(events[2].application.nextState, "accepted");
  assert.equal(
    privateDecisionCrud.answerDecision(
      historyRepository,
      "binding-a",
      request.decisionId,
      answer,
    ).status,
    "completed",
  );
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.deepEqual(fs.readFileSync(historyFile), history);
  assert.equal(
    privateDecisionCrud.answerDecision(
      historyRepository,
      "binding-a",
      request.decisionId,
      {
        ...answer,
        selectedOption: "return",
      },
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), bytes);
  const missingOldProposal = Buffer.from(
    `${history
      .toString("utf8")
      .split("\n")
      .filter((line) => line && !line.includes('"decisionId":"proposal-held"'))
      .join("\n")}\n`,
  );
  fs.writeFileSync(historyFile, missingOldProposal);
  const partialRetirement = privateStateCrud.writeSnapshot(
    repository,
    "binding-a",
    encodeStateValue({
      ...after.value,
      snapshotRevision: after.value.snapshotRevision + 1,
      decisions: [],
      blockers: [],
    }),
    after.value.snapshotRevision,
  );
  assert.equal(partialRetirement.status, "blocked");
  assert.deepEqual(fs.readFileSync(file), bytes);
  fs.writeFileSync(historyFile, history);
  for (const invalidHistory of [
    Buffer.concat([history, Buffer.from("{partial")]),
    Buffer.from(
      `${history
        .toString("utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line);
          if (
            row.summary.schema === "crdd-coordinator/decision-event/v1" &&
            row.summary.record.kind === "decision_requested"
          )
            row.summary.record.question = "同じIDの別の質問";
          return encodeStateValue(row);
        })
        .join("\n")}\n`,
    ),
  ]) {
    fs.writeFileSync(historyFile, invalidHistory);
    const stopped = privateDecisionCrud.answerDecision(
      historyRepository,
      "binding-a",
      request.decisionId,
      answer,
    );
    assert.equal(stopped.status, "completed");
    if (stopped.status === "completed")
      assert.equal(stopped.value.history.status, "unconfirmed");
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.deepEqual(fs.readFileSync(historyFile), invalidHistory);
    const retirement = privateStateCrud.writeSnapshot(
      repository,
      "binding-a",
      encodeStateValue({
        ...after.value,
        snapshotRevision: after.value.snapshotRevision + 1,
        decisions: [],
        blockers: [],
      }),
      after.value.snapshotRevision,
    );
    assert.equal(retirement.status, "blocked");
    assert.deepEqual(fs.readFileSync(file), bytes);
  }
  fs.writeFileSync(historyFile, history);
  const old = {
    ...JSON.parse(bytes.toString("utf8")),
    schema: "crdd-domain/runtime-state/v2",
  };
  delete old.decisions;
  delete old.blockers;
  assert.equal(
    decodeStateSnapshot(
      Buffer.from(`${encodeStateValue(old)}\n`),
      old.repositoryBinding,
    ),
    null,
  );
  const retired = privateHistoryCrud.retireStateRecords(
    historyRepository,
    "binding-a",
  );
  assert.equal(retired.status, "completed", JSON.stringify(retired));
  if (retired.status === "completed") assert.equal(retired.value, 2);
  const final = privateStorageStore.readSnapshot(repository, "binding-a");
  assert.equal(final.status, "completed");
  if (final.status === "completed") {
    assert.equal(final.value?.decisions.length, 0);
    assert.equal(final.value?.blockers.length, 0);
    assert.equal(final.value?.projects[0]?.objectives[0]?.state, "accepted");
  }
  const retainedHistory = Buffer.from(
    `${history
      .toString("utf8")
      .split("\n")
      .filter(
        (line) =>
          line &&
          JSON.parse(line).summary.schema ===
            "crdd-coordinator/decision-event/v1",
      )
      .join("\n")}\n`,
  );
  assert.deepEqual(fs.readFileSync(historyFile), retainedHistory);
  const retiredStateBytes = fs.readFileSync(file);
  const reissued = privateDecisionCrud.requestDecision(
    historyRepository,
    "binding-a",
    {
      ...request,
      target: { ...request.target, generation: pendingState.generation + 1 },
    },
  );
  assert.equal(reissued.status, "blocked");
  assert.equal(reissued.reason, "decision_identity_retired");
  assert.deepEqual(fs.readFileSync(file), retiredStateBytes);
  const reopened = privateDecisionCrud.requestDecision(
    historyRepository,
    "binding-a",
    {
      ...request,
      decisionId: "new-proposal-for-retired-blocker",
      target: { ...request.target, generation: pendingState.generation + 1 },
    },
  );
  assert.equal(reopened.status, "blocked");
  assert.equal(reopened.reason, "decision_blocker_retired");
  assert.deepEqual(fs.readFileSync(file), retiredStateBytes);
  if (resumed.status !== "completed") throw Error("original_applied_missing");
  const retiredReplay = domain.recordDecision(
    historyRepository,
    "binding-a",
    request,
    answer,
    resumed.value.decision,
  );
  assert.equal(retiredReplay.status, "blocked");
  assert.equal(retiredReplay.reason, "decision_replay_state_changed");
  assert.deepEqual(fs.readFileSync(file), retiredStateBytes);
  assert.deepEqual(fs.readFileSync(historyFile), retainedHistory);

  const inlineTime = new Date().toISOString();
  const inlineRequest: domain.DecisionRequest = {
    ...request,
    decisionId: "decision-inline",
    blockerId: "blocker-inline",
    target: {
      ...request.target,
      kind: "milestone",
      id: state.milestoneId,
      generation: pendingState.generation + 1,
    },
    requestedAt: inlineTime,
    options: [{ value: "wait", label: "保留する" }],
  };
  const inlineAnswer: DecisionAnswer = {
    ...answer,
    answeredAt: inlineTime,
    selectedOption: "wait",
    evidenceIds: [],
  };
  const inlineBefore = privateStorageStore.readSnapshot(
    repository,
    "binding-a",
  );
  assert.equal(inlineBefore.status, "completed");
  const inlineFault = t.mock.method(fs, "renameSync", ((from, to) => {
    if (String(from) === historyPending)
      throw Object.assign(new Error("synthetic inline history failure"), {
        code: "EACCES",
      });
    return Reflect.apply(rename, fs, [from, to]);
  }) as typeof rename);
  let inline: ReturnType<typeof domain.recordDecision>;
  try {
    inline = domain.recordDecision(
      historyRepository,
      "binding-a",
      inlineRequest,
      inlineAnswer,
    );
  } finally {
    inlineFault.mock.restore();
  }
  assert.equal(inline.status, "completed", JSON.stringify(inline));
  if (inline.status === "completed") {
    assert.equal(inline.value.decision.status, "applied");
    assert.equal(inline.value.history.status, "unconfirmed");
  }
  const inlineState = fs.readFileSync(file);
  const observedInline = domain.readDecision(
    repository,
    "binding-a",
    inlineRequest.decisionId,
  );
  if (observedInline.status !== "completed" || !observedInline.value)
    throw Error("inline_observation_missing");
  const originalInlinePending = fs.readFileSync(historyPending);
  for (const wrongExpected of [
    { ...observedInline.value, question: "別の本文" },
    { ...inlineRequest, status: "pending" as const, result: null },
  ]) {
    const deniedReplay = domain.recordDecision(
      historyRepository,
      "binding-a",
      inlineRequest,
      inlineAnswer,
      wrongExpected,
    );
    assert.equal(deniedReplay.status, "blocked");
    assert.equal(deniedReplay.reason, "decision_replay_state_changed");
    assert.deepEqual(fs.readFileSync(file), inlineState);
    assert.deepEqual(fs.readFileSync(historyPending), originalInlinePending);
  }
  const wrongReplayAnswer = domain.recordDecision(
    historyRepository,
    "binding-a",
    inlineRequest,
    {
      ...inlineAnswer,
      selectedOption: "accept",
      evidenceIds: ["different-evidence"],
    },
    observedInline.value,
  );
  assert.equal(wrongReplayAnswer.status, "blocked");
  assert.equal(wrongReplayAnswer.reason, "decision_replay_state_changed");
  assert.deepEqual(fs.readFileSync(file), inlineState);
  assert.deepEqual(fs.readFileSync(historyPending), originalInlinePending);
  const inlineResumed = domain.recordDecision(
    historyRepository,
    "binding-a",
    inlineRequest,
    inlineAnswer,
    observedInline.value,
  );
  assert.equal(
    inlineResumed.status,
    "completed",
    JSON.stringify(inlineResumed),
  );
  if (inlineResumed.status === "completed")
    assert.equal(inlineResumed.value.history.status, "confirmed");
  assert.deepEqual(fs.readFileSync(file), inlineState);
  const inlineAfter = privateStorageStore.readSnapshot(repository, "binding-a");
  if (
    inlineBefore.status !== "completed" ||
    inlineAfter.status !== "completed" ||
    !inlineBefore.value ||
    !inlineAfter.value
  )
    throw Error("inline_state_unknown");
  assert.equal(
    inlineAfter.value.snapshotRevision,
    inlineBefore.value.snapshotRevision + 1,
  );
  assert.equal("acceptanceDecisions" in inlineAfter.value, false);
  assert.equal(
    domain.readDecision(repository, "binding-a", "decision-inline").status,
    "completed",
  );
  const decisionRead = domain.readDecision(
    repository,
    "binding-a",
    "decision-inline",
  );
  assert.equal(decisionRead.status, "completed", JSON.stringify(decisionRead));
  if (decisionRead.status === "completed")
    assert.equal(decisionRead.value?.decisionId, "decision-inline");
  assert.equal(inlineAfter.value.blockers[0]?.blockerId, "blocker-inline");
  assert.equal(inlineAfter.value.blockers[0]?.status, "active");
  const deniedRead = domain.queryQueue(
    { root: repository, principalId: "operator-b", revalidate: () => false },
    { projectId: state.projectId, milestoneId: state.milestoneId },
  );
  assert.equal(deniedRead.status, "blocked");
});

/**
 * pendingの作成/観測/置換故障を現在値と区別する。
 * @responsibility marker差戻しに依存せず未確定物を保全する。
 * @trace ERB-IT-014
 * @precondition 自己生成Rootを既存Writerで初期化する。
 * @stimulus open/部分作成/観測不能/同名置換/既存pending/履歴割込み/現在値観測不能。
 * @observation 注入発火、現在値全文、pending/履歴残存、Reader結果。
 * @oracle 未実施と未確定を区別し、対象外や別実体を回収しない。
 * @cleanup 既存fixture cleanupだけを使用する。
 * @boundary 実Filesystemと本番Writer。AI/Dockerなし。
 */
test("Task保存のpending故障は現在値と未確定物を保全する", async (t) => {
  for (const mode of [
    "normal",
    "open",
    "partial",
    "create_fsync",
    "unobservable",
    "replaced",
    "existing",
    "history_late",
    "current_unobservable",
    "history_before_rename",
    "same_bytes_replaced_before_rename",
    "readback_not_requested",
    "published_unobservable",
    "same_bytes_replaced_after_rename",
  ] as const)
    await t.test(mode, (t) => {
      const { root, state } = fixture(t);
      assert.equal(
        initializeExecutionStore(root, "binding-a").status,
        "completed",
      );
      assert.equal(
        domain.createQueue({ directory: root }, "binding-a", {
          kind: "scheduled",
          input: [
            {
              queueId: "queue-a",
              projectId: state.projectId,
              milestoneId: state.milestoneId,
              requestHash: "b".repeat(64),
              originLane: "interactive",
              repositoryRevision: state.repositoryRevision,
              scopeHash: "c".repeat(64),
            },
            initialExecutionInput(state),
          ],
        }).status,
        "completed",
      );
      const command = {
        kind: "task_start" as const,
        projectId: state.projectId,
        taskId: "task-a",
        attemptId: "attempt-a",
        authorityBindingId: "authority-a",
      };
      const directory = path.join(root, ".crdd", "execution-model"),
        current = path.join(directory, "state.json"),
        pending = path.join(directory, "state.pending.json"),
        history = path.join(directory, "history.pending.jsonl");
      const before = fs.readFileSync(current);
      const retainedCurrent = path.join(root, "original-current");
      if (mode === "existing") fs.writeFileSync(pending, "foreign");
      const open = fs.openSync,
        lstat = fs.lstatSync,
        rename = fs.renameSync,
        sync = fs.fsyncSync;
      let injected = false,
        replaced = false,
        renamed = false,
        postRenameOpens = 0,
        pendingSyncs = 0,
        finalCurrentRead = false,
        lateFault = false,
        observationFaults = 0;
      const opening = t.mock.method(fs, "openSync", ((
        ...args: Parameters<typeof open>
      ) => {
        if (
          renamed &&
          args[0] === current &&
          args[1] === fs.constants.O_RDONLY
        ) {
          postRenameOpens++;
          if (mode === "readback_not_requested")
            throw Object.assign(new Error("final_read_unknown"), {
              code: "EACCES",
            });
        }
        if (
          (mode === "same_bytes_replaced_before_rename" ||
            mode === "history_before_rename") &&
          pendingSyncs === 1 &&
          args[0] === current
        )
          finalCurrentRead = true;
        if (String(args[0]) === pending && args[1] === "wx") {
          injected = true;
          if (mode === "partial") fs.writeFileSync(pending, "{");
          if (mode === "history_late")
            fs.writeFileSync(history, "foreign-history");
          if (["open", "partial", "history_late"].includes(mode))
            throw Object.assign(new Error("pending_open"), { code: "EACCES" });
        }
        return Reflect.apply(open, fs, args);
      }) as typeof open);
      const observing = t.mock.method(fs, "lstatSync", ((
        ...args: Parameters<typeof lstat>
      ) => {
        if (
          (mode === "same_bytes_replaced_after_rename" ||
            mode === "published_unobservable") &&
          renamed &&
          !lateFault &&
          args[0] === current
        ) {
          lateFault = true;
          if (mode === "published_unobservable")
            throw Object.assign(new Error("published_stat_unknown"), {
              code: "EACCES",
            });
          rename(current, retainedCurrent);
          fs.writeFileSync(current, fs.readFileSync(retainedCurrent));
        }
        if (
          (mode === "same_bytes_replaced_before_rename" ||
            mode === "history_before_rename") &&
          finalCurrentRead &&
          !lateFault &&
          args[0] === root
        ) {
          const stack = new Error().stack;
          if (
            stack?.includes("assertBoundary") &&
            !stack.includes("readExecutionStateFile")
          ) {
            lateFault = true;
            if (mode === "history_before_rename")
              fs.writeFileSync(history, "foreign-history");
            else {
              fs.renameSync(current, retainedCurrent);
              fs.writeFileSync(current, before);
            }
          }
        }
        if (
          injected &&
          ((mode === "unobservable" && String(args[0]) === pending) ||
            (mode === "current_unobservable" && String(args[0]) === current))
        ) {
          observationFaults++;
          throw Object.assign(new Error("read_unknown"), { code: "EACCES" });
        }
        return Reflect.apply(lstat, fs, args);
      }) as typeof lstat);
      const publishing = t.mock.method(
        fs,
        "renameSync",
        (...args: Parameters<typeof rename>) => {
          rename(...args);
          if (args[0] === pending && args[1] === current) renamed = true;
        },
      );
      const syncing = t.mock.method(fs, "fsyncSync", (fd: number) => {
        if (injected) pendingSyncs++;
        if (mode === "create_fsync" && pendingSyncs === 1)
          throw Object.assign(new Error("pending_fsync"), { code: "EIO" });
        sync(fd);
        if (mode === "replaced" && injected && !replaced) {
          replaced = true;
          fs.renameSync(pending, path.join(root, "original-pending"));
          fs.writeFileSync(pending, "foreign");
        }
      });
      let saved: ReturnType<typeof writeSnapshotState>;
      try {
        saved = writeSnapshotState(
          { directory: root },
          "binding-a",
          command,
          state.generation,
        );
      } finally {
        publishing.mock.restore();
        opening.mock.restore();
        observing.mock.restore();
        syncing.mock.restore();
      }
      assert.equal(injected, mode !== "existing");
      if (mode === "normal" || mode === "readback_not_requested") {
        assert.equal(saved.status, "completed", saved.reason);
        assert.equal(pendingSyncs, 1);
        assert.equal(renamed, true);
        assert.equal(postRenameOpens, 0);
        assert.notDeepEqual(fs.readFileSync(current), before);
        assert.equal(fs.existsSync(pending), false);
        return;
      }
      if (
        mode === "published_unobservable" ||
        mode === "same_bytes_replaced_after_rename"
      ) {
        assert.equal(saved.status, "blocked");
        assert.equal(renamed, true);
        assert.equal(postRenameOpens, 0);
        assert.equal(lateFault, true);
        assert.notDeepEqual(fs.readFileSync(current), before);
        assert.equal(fs.existsSync(pending), false);
        if (mode === "same_bytes_replaced_after_rename") {
          assert.deepEqual(
            fs.readFileSync(current),
            fs.readFileSync(retainedCurrent),
          );
        }
        return;
      }
      if (mode === "create_fsync") assert.equal(pendingSyncs, 1);
      assert.equal(replaced, mode === "replaced");
      assert.equal(
        lateFault,
        mode === "history_before_rename" ||
          mode === "same_bytes_replaced_before_rename",
      );
      assert.equal(
        observationFaults,
        ["unobservable", "current_unobservable"].includes(mode) ? 1 : 0,
      );
      assert.equal(saved.status, "blocked");
      assert.deepEqual(fs.readFileSync(current), before);
      assert.equal(fs.existsSync(path.join(directory, "state.lock")), false);
      assert.equal(
        fs.existsSync(pending),
        !["open", "history_late"].includes(mode),
      );
      assert.equal(
        fs.existsSync(history),
        mode === "history_late" || mode === "history_before_rename",
      );
      if (mode === "history_before_rename")
        assert.equal(fs.readFileSync(history, "utf8"), "foreign-history");
      if (mode === "same_bytes_replaced_before_rename")
        assert.deepEqual(fs.readFileSync(retainedCurrent), before);
      assert.equal(
        readSnapshot({ directory: root }, "binding-a").status,
        mode === "open" ? "completed" : "blocked",
      );
      if (mode === "partial")
        assert.equal(fs.readFileSync(pending, "utf8"), "{");
      if (mode === "replaced" || mode === "existing")
        assert.equal(fs.readFileSync(pending, "utf8"), "foreign");
      if (mode === "open")
        assert.equal(
          writeSnapshotState(
            { directory: root },
            "binding-a",
            command,
            state.generation,
          ).status,
          "completed",
        );
    });
});

/**
 * 名前付き保存領域の真正不存在を読取りだけで返す。
 * @responsibility 現行Snapshot Readerが初期化Effectを発行しないことを判定する。
 * @trace PRL-IT-005
 * @precondition Git Rootだけがある自己所有fixtureを用いる。
 * @stimulus 現行Snapshotを読む。
 * @observation 結果とRoot内容、Git exclude bytesを取得する。
 * @oracle 真正不存在を返しDirectoryやIgnore設定を変更しない。
 * @cleanup fixture hookが所有Rootを清掃する。
 * @boundary Repository Runtime Data Owner→foundation Reader。
 */
test("名前付き保存領域の不存在はwx所在だけを準備しDomain状態を初期化しない", (t) => {
  const { root } = fixture(t);
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  const rootNames = fs.readdirSync(root);
  const excludePath = path.join(root, ".git", "info", "exclude");
  const excludeBytes = fs.readFileSync(excludePath);
  const snapshot = readSnapshot({ directory: root }, "binding-a");
  assert.equal(snapshot.status, "completed");
  assert.equal(snapshot.value, null);
  assert.deepEqual(
    fs.readdirSync(root).filter((name) => name !== ".crdd"),
    rootNames.filter((name) => name !== ".crdd"),
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model")),
    false,
  );
  assert.deepEqual(fs.readFileSync(excludePath), excludeBytes);
});

/**
 * 名前付きareaの観測不能を空入力へ変換しない。
 * @responsibility Owner blockedをReaderの停止結果へ接続する。
 * @trace PRL-IT-005
 * @precondition 正常な新版Snapshotがある自己所有fixtureを用いる。
 * @stimulus orchestrator areaのlstatへEACCESを注入する。
 * @observation 現行Readerの状態と既存記録bytesを取得する。
 * @oracle 空入力/absent成功ではなくblockedとなり現在記録不変。
 * @cleanup 注入関数を復元しfixture hookで清掃する。
 * @boundary Runtime Data Ownerの観測障害→foundation Reader。
 */
test("名前付きareaの観測不能は現行Snapshot Readerを停止する", (t) => {
  const { root } = fixture(t);
  assert.equal(initializeExecutionStore(root, "binding-a").status, "completed");
  const runtime = path.join(root, ".crdd", "execution-model");
  const location = path.join(runtime, "state.json");
  const beforeBytes = fs.readFileSync(location);
  const original = fs.lstatSync;
  Reflect.set(fs, "lstatSync", ((target: fs.PathLike, ...args: unknown[]) => {
    if (String(target) === runtime)
      throw Object.assign(new Error("injected_area_observation_failure"), {
        code: "EACCES",
      });
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  try {
    assert.equal(
      readSnapshot({ directory: root }, "binding-a").status,
      "blocked",
    );
  } finally {
    Reflect.set(fs, "lstatSync", original);
  }
  assert.deepEqual(fs.readFileSync(location), beforeBytes);
});

/**
 * 空areaでも読取り途中の置換を現在境界の成立へ丸めない。
 * @responsibility 開始と終了の不透明Identityを同じReader結果へ結ぶ。
 * @trace PRL-IT-005
 * @precondition 正規の空orchestrator areaがある。
 * @stimulus 最初の子Path観測時にareaを別物理Directoryへ置換する。
 * @observation Reader結果、新旧areaの内容、置換実行を取得する。
 * @oracle 完全な空入力でもblockedとなりReaderの書込みは0。
 * @cleanup 注入関数を復元しfixture内の新旧areaを清掃する。
 * @boundary Runtime Data境界置換→現行Snapshot Reader。
 */
test("名前付き空areaの途中置換はSnapshot Readerを停止する", (t) => {
  const { root } = fixture(t);
  const area = ensurePhysicalExecutionDataArea(root, "execution-model");
  assert.ok(area);
  const runtime = area.directory;
  const prior = path.join(root, "prior-runtime-area");
  const childPath = path.join(runtime, "state.json");
  const original = fs.lstatSync;
  let wasAreaReplaced = false;
  Reflect.set(fs, "lstatSync", ((target: fs.PathLike, ...args: unknown[]) => {
    if (String(target) === childPath && !wasAreaReplaced) {
      wasAreaReplaced = true;
      fs.renameSync(runtime, prior);
      fs.mkdirSync(runtime);
    }
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  try {
    const result = readSnapshot({ directory: root }, "binding-a");
    assert.equal(wasAreaReplaced, true);
    assert.equal(result.status, "blocked");
  } finally {
    Reflect.set(fs, "lstatSync", original);
  }
  assert.deepEqual(fs.readdirSync(runtime), []);
  assert.deepEqual(fs.readdirSync(prior), []);
});

/**
 * 保存排他の不正入力と非Windows境界を確認する。
 *
 * @responsibility 不正HashでWorkerを開始しない拒否条件を確認する。
 * @trace PRL-IT-005
 * @precondition 不正値を入力する。非Windows分岐はその実行環境で確認する。
 * @stimulus 不正Hashと非Windows時の正規Hashを低水準入口へ渡す。
 * @observation nullの非取得結果を観測する。
 * @oracle 不正入力と非Windowsでは取得handleを返さない。
 * @cleanup N/A: 拒否入力はWorkerを取得しない。
 * @boundary PRL-IT-005=Direct Boundary: 入力→Windows排他入口。
 */
test("Snapshot排他は不正Hashと未確定Rootを取得前に拒否する", () => {
  for (const value of [
    null,
    undefined,
    "",
    "a".repeat(63),
    "A".repeat(64),
    1,
  ]) {
    assert.equal(acquireExecutionStateLock(value, "").status, "blocked");
  }
  if (process.platform !== "win32") {
    assert.equal(
      acquireExecutionStateLock("a".repeat(64), "").status,
      "blocked",
    );
  }
});

/**
 * describes the durable foundation without claiming the upper Runtime completeを検証する。
 *
 * @responsibility describes the durable foundation without claiming the upper Runtime completeの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus describes the durable foundation without claiming the upper Runtime completeの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: execution-model Test Source→対象契約
 */
test("describes the durable foundation without claiming the upper Runtime complete", () => {
  const contract = describeDurableFoundation();
  assert.deepEqual(contract, {
    contract: "crdd-execution-model/storage-envelope/v2",
    recordStrategy: "single_current_snapshot_with_pending_atomic_replace",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    taskManagementCapabilityComplete: false,
  });
});

/**
 * 最新の空Snapshotを明示作成してから、試験開始状態を通常更新で配置する。
 * @responsibility 非空の旧初回Envelopeを使わず、新しい初期化・改訂条件を守る。
 * @trace PRL-IT-005
 * @input root: 自己所有Repository、payload: 試験用のTask表示値。
 * @returns 通常更新の保存結果。
 * @precondition rootはこのCaseが作成した未使用の合成Repositoryである。
 * @stimulus 空の改訂1を初期化し、payloadを改訂2として保存する。
 * @observation 初期化と通常更新の正式な保存結果を取得する。
 * @oracle 既存Writerの初回条件とCAS改訂条件を満たす。
 * @effect 自己所有fixture内の現在状態だけを作成・更新する。
 * @cleanup 呼出しCaseが自己所有Rootを終了後に回収する。
 * @boundary PRL-IT-005=Direct Boundary: 合成Task状態と正式保存Writer。
 */
function seedSnapshot(
  root: string,
  payload: Record<string, unknown> & { snapshotRevision: number },
) {
  const empty = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      Array.isArray(value) ? [] : value,
    ]),
  );
  empty.snapshotRevision = 1;
  assert.equal(
    writeSnapshot({ directory: root }, "binding-a", JSON.stringify(empty), 0)
      .status,
    "completed",
  );
  payload.snapshotRevision = 2;
  return writeSnapshot(
    { directory: root },
    "binding-a",
    JSON.stringify(payload),
    1,
  );
}

/**
 * 最新の物理Snapshotを試験用のTask表示へ投影する。
 * @responsibility pending本文を旧Envelopeとして解釈せず、現行codecで検証する。
 * @trace PRL-IT-005
 * @input root: 自己所有Repository、bytes: 現行physical本文。
 * @returns 同じRootの検証済みTask表示値。
 * @precondition rootとbytesは同じCaseが所有する現行形式である。
 * @stimulus 短期排他からRoot Identityを得て現行codecと投影へ渡す。
 * @observation 排他取得・解放とdecode／投影結果をassertする。
 * @oracle 同じRootに相関するTask表示だけが返る。
 * @effect 短期排他の取得・解放だけ。保存・旧形式変換は行わない。
 * @cleanup 排他をdecode前に解放し、Root清掃は呼出しCaseが行う。
 * @boundary PRL-IT-005=Direct Boundary: 物理Snapshot codecとTask投影。
 */
function taskView(root: string, bytes: string) {
  const held = acquireSnapshotPilotLock({ directory: root });
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("fixture_owner_invalid");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const decoded = decodeStateSnapshot(
    Buffer.from(bytes),
    JSON.parse(bytes).repositoryBinding,
  );
  assert.ok(decoded);
  const view = projectTaskSnapshot(decoded, rootHash);
  assert.ok(view);
  return view;
}

/**
 * 統合保存の読取りと真正不存在を確認する。
 * @responsibility 未確定保存・破損・観測不能を正常値へ畳まない。
 * @trace PRL-IT-005
 * @precondition 自己所有の独立Repositoryを使う。
 * @stimulus 不存在、保存後、pending、結合差、aliasと親の観測失敗を与える。
 * @observation 読取り値、停止結果、元bytesと保存領域の不存在を確認する。
 * @oracle 読取りで保存先を作らず、不明時は記録を保全する。
 * @cleanup mockを戻し自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 統合保存→内部読取り。
 */
test("Host Windows: 統合Snapshot読取りは不存在と未確定を区別する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const empty = readSnapshot({ directory: root }, "binding-a");
  assert.equal(empty.status, "completed");
  assert.equal(empty.value, null);
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model")),
    false,
  );
  for (const generation of [-1, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      writeSnapshotState(
        { directory: root },
        "binding-a",
        {
          kind: "task_start",
          projectId: state.projectId,
          taskId: "task-a",
          attemptId: "attempt-a",
          authorityBindingId: "authority-a",
        },
        generation,
      ).status,
      "blocked",
    );
  }
  assert.equal(
    Reflect.apply(writeSnapshotState, undefined, [root, "binding-a", "{", 0])
      .status,
    "blocked",
  );
  assert.equal(
    writeSnapshotState(
      { directory: root },
      "binding-a",
      {
        kind: "task_start",
        projectId: state.projectId,
        taskId: "task-a",
        attemptId: "attempt-a",
        authorityBindingId: "authority-a",
      },
      0,
    ).status,
    "blocked",
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model")),
    false,
  );
  const held = acquireSnapshotPilotLock({ directory: root });
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-execution-model/project-snapshot/v9",
    schemaRevision: 9,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  assert.equal(seedSnapshot(root, payload).status, "completed");
  assert.deepEqual(
    readSnapshot({ directory: root }, "binding-a").value,
    payload,
  );
  const directory = path.join(root, ".crdd", "execution-model");
  const current = path.join(directory, "state.json");
  const before = fs.readFileSync(current, "utf8");
  assert.equal(
    readSnapshot({ directory: root }, "binding-b").status,
    "blocked",
  );
  const retiredPayload = {
    ...Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          key !== "acceptanceDecisions" && key !== "decisionRecoveries",
      ),
    ),
    schema: "crdd-coordinator/snapshot/v1",
    schemaRevision: 1,
  };
  const retiredBytes = JSON.stringify({
    payload: retiredPayload,
    contentHash: createHash("sha256")
      .update(JSON.stringify(retiredPayload))
      .digest("hex"),
    baseRevision: 0,
    baseHash: null,
  });
  fs.writeFileSync(current, retiredBytes);
  assert.equal(
    readSnapshot({ directory: root }, "binding-a").status,
    "blocked",
  );
  assert.equal(initializeExecutionStore(root, "binding-a").status, "blocked");
  assert.equal(fs.readFileSync(current, "utf8"), retiredBytes);
  fs.writeFileSync(current, before);
  const pending = path.join(directory, "state.pending.json");
  fs.writeFileSync(pending, "{");
  assert.equal(
    readSnapshot({ directory: root }, "binding-a").status,
    "blocked",
  );
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.equal(fs.readFileSync(current, "utf8"), before);
  fs.unlinkSync(pending);
  const alias = path.join(directory, "alias.json");
  fs.linkSync(current, alias);
  assert.equal(
    readSnapshot({ directory: root }, "binding-a").status,
    "blocked",
  );
  fs.unlinkSync(alias);
  fs.writeFileSync(current, "{");
  assert.equal(
    readSnapshot({ directory: root }, "binding-a").status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), "{");
  fs.writeFileSync(current, before);
  for (const code of ["EACCES", "ENOENT"]) {
    const original = fs.lstatSync;
    let calls = 0;
    const mocked = t.mock.method(
      fs,
      "lstatSync",
      (...args: Parameters<typeof original>) => {
        if (
          String(args[0]) === path.join(root, ".crdd") &&
          ++calls === (code === "ENOENT" ? 2 : 1)
        )
          throw Object.assign(new Error("injected_parent_observation"), {
            code,
          });
        return Reflect.apply(original, fs, args);
      },
    );
    try {
      assert.equal(
        readSnapshot({ directory: root }, "binding-a").status,
        "blocked",
      );
      assert.ok(calls > 0);
    } finally {
      mocked.mock.restore();
    }
    assert.equal(fs.readFileSync(current, "utf8"), before);
  }
});

/**
 * 統合Snapshotの固定候補保存と再入場を確認する。
 * @responsibility 旧Writerを切替せず保存CASと途中再開を反証する。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryと本番生成したState値を使う。
 * @stimulus 正常保存、同候補再送、世代競合、rename失敗と再入場を実行する。
 * @observation state.json本文、固定pending、改訂番号を確認する。
 * @oracle 同候補は一重確定し、競合は上書きせず中断候補を保持する。
 * @cleanup mockを復元して自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: Snapshot保存→Windows Filesystem。
 */
test("Host Windows: 統合Snapshotは固定pendingから一重確定する", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const held = acquireSnapshotPilotLock({ directory: root });
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-execution-model/project-snapshot/v9",
    schemaRevision: 9,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  const current = path.join(root, ".crdd", "execution-model", "state.json");
  const pending = path.join(
    root,
    ".crdd",
    "execution-model",
    "state.pending.json",
  );
  assert.equal(seedSnapshot(root, payload).status, "completed");
  const first = fs.readFileSync(current, "utf8");
  assert.deepEqual(
    readSnapshot({ directory: root }, "binding-a").value,
    payload,
  );
  assert.equal(fs.existsSync(pending), false);
  assert.equal(
    writeSnapshot({ directory: root }, "binding-a", JSON.stringify(payload), 1)
      .status,
    "completed",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  const conflict = { ...payload, intakeEpoch: "epoch-conflict" };
  assert.equal(
    writeSnapshot({ directory: root }, "binding-a", JSON.stringify(conflict), 0)
      .status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  const next = {
    ...payload,
    snapshotRevision: payload.snapshotRevision + 1,
    projects: [{ ...state, generation: 2 }],
  };
  const rename = t.mock.method(fs, "renameSync", () => {
    throw new Error("injected_rename_failure");
  });
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      JSON.stringify(next),
      payload.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  assert.ok(fs.existsSync(pending));
  const savedPending = fs.readFileSync(pending, "utf8");
  assert.deepEqual(taskView(root, savedPending), next);
  rename.mock.restore();
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      JSON.stringify(next),
      payload.snapshotRevision,
    ).status,
    "completed",
  );
  assert.equal(fs.readFileSync(current, "utf8"), savedPending);
  assert.equal(fs.existsSync(pending), false);
  fs.writeFileSync(pending, savedPending);
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      JSON.stringify(next),
      payload.snapshotRevision,
    ).status,
    "completed",
  );
  assert.equal(fs.existsSync(pending), false);
  fs.writeFileSync(pending, "{");
  assert.equal(
    writeSnapshot(
      { directory: root },
      "binding-a",
      JSON.stringify({ ...next, snapshotRevision: 3 }),
      2,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.equal(fs.readFileSync(current, "utf8"), savedPending);
});

/**
 * 部分形式や未知区画を保存前に拒否する。
 * @responsibility 不完全なSnapshotをstate.jsonとして成立させない。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryを使用する。
 * @stimulus 部分codec、Root差、区画欠落、未知区画を入力する。
 * @observation 保存File不存在を確認する。
 * @oracle 不正入力は現在値を作らない。
 * @cleanup 自己所有fixtureを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 入力検証→Snapshot保存。
 */
test("Host Windows: 統合Snapshotは部分形式と結合不明を保存しない", {
  skip: process.platform !== "win32",
}, (t) => {
  const { root, state } = fixture(t);
  const held = acquireSnapshotPilotLock({ directory: root });
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-execution-model/project-snapshot/v9",
    schemaRevision: 9,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  for (const invalid of [
    { ...payload, repositoryRootHash: "0".repeat(64) },
    {
      ...payload,
      schema: "crdd-coordinator/snapshot/v1",
      schemaRevision: 1,
    },
    { ...payload, results: undefined },
    { ...payload, extra: true },
    {
      ...payload,
      schema: "crdd-coordinator/state-queue-snapshot-pilot/v1",
    },
  ]) {
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify(invalid),
        0,
      ).status,
      "blocked",
    );
    assert.equal(
      fs.existsSync(path.join(root, ".crdd", "execution-model", "state.json")),
      false,
    );
  }
  const other = fixture(t);
  const otherRuntime = path.join(other.root, ".crdd");
  assert.equal(path.dirname(otherRuntime), fs.realpathSync.native(other.root));
  assert.equal(fs.existsSync(otherRuntime), false);
  const original = fs.realpathSync.native;
  let hasChangedAfterAcquisition = false;
  const mocked = t.mock.method(
    fs.realpathSync,
    "native",
    (...args: Parameters<typeof original>) => {
      const stack = new Error("root_observation").stack ?? "";
      if (
        String(args[0]) === root &&
        stack.includes("writeSnapshot") &&
        !stack.includes("acquireSnapshotPilotLock")
      ) {
        hasChangedAfterAcquisition = true;
        return other.root;
      }
      return Reflect.apply(original, fs.realpathSync, args);
    },
  );
  try {
    assert.equal(
      writeSnapshot(
        { directory: root },
        "binding-a",
        JSON.stringify({ ...payload, projects: [] }),
        0,
      ).status,
      "blocked",
    );
    assert.equal(hasChangedAfterAcquisition, true);
  } finally {
    mocked.mock.restore();
  }
  assert.equal(fs.existsSync(otherRuntime), false);
  for (const name of ["state.json", "state.pending.json", "state.lock"])
    assert.equal(
      fs.existsSync(path.join(root, ".crdd", "execution-model", name)),
      false,
    );
});

/**
 * 現行Snapshotの保存候補が占める正確なByte数を計算する。
 *
 * @responsibility 基準Snapshotと更新するProjectから保存候補を再構成し、容量境界の試験入力を決定論的に作る。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus storedEnvelopeBytesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function storedEnvelopeBytes(state: ProjectExecutionState, baseJson: string) {
  const slim: ProjectExecutionState = {
    ...state,
    milestone: {
      ...state.milestone,
      acceptanceCriteria: state.milestone.acceptanceCriteria.map(
        (_criterion, index) => `criterion-${index}`,
      ),
    },
    tasks: state.tasks.map((task) => ({
      ...task,
      definition: {
        ...task.definition,
        allowedPaths: task.definition.allowedPaths.map(
          (_allowedPath, index) => `path-${index}`,
        ),
      },
    })),
  };
  const bytes = prepareUnifiedTaskSnapshot(
    Buffer.from(baseJson),
    slim,
    0,
    JSON.parse(baseJson).repositoryBinding,
  );
  assert.ok(bytes);
  return (
    bytes.length +
    Buffer.byteLength(encodeStateValue(state)) -
    Buffer.byteLength(encodeStateValue(slim))
  );
}

/**
 * stateWithStoredBytesのTest準備責務を実行する。
 *
 * @responsibility stateWithStoredBytesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateWithStoredBytesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function stateWithStoredBytes(
  template: ProjectExecutionState,
  targetBytes: number,
  baseJson: string,
): ProjectExecutionState {
  const pathValue = (index: number) =>
    `${"p".repeat(508)}${String(index).padStart(4, "0")}`;
  const mutable = structuredClone(template) as unknown as {
    milestone: { acceptanceCriteria: string[] };
    tasks: Array<{
      definition: {
        id: string;
        objectiveId: string;
        dependencies: string[];
        allowedPaths: string[];
        conflictKeys: string[];
      };
    }>;
  } & Omit<ProjectExecutionState, "milestone" | "tasks">;
  mutable.milestone.acceptanceCriteria = ["a", "b"];
  mutable.tasks = Array.from({ length: 1024 }, (_unused, index) => ({
    ...structuredClone(template.tasks[0]),
    definition: {
      id: `task-${index}`,
      objectiveId: "objective-a",
      dependencies: [],
      allowedPaths: Array.from({ length: 28 }, (_path, index) =>
        pathValue(index),
      ),
      conflictKeys: [],
    },
  }));
  let remaining =
    targetBytes -
    storedEnvelopeBytes(mutable as unknown as ProjectExecutionState, baseJson);
  if (remaining < 0) throw new Error("record_boundary_fixture_too_large");
  const wholePaths = Math.floor(remaining / 515);
  for (let index = 0; index < wholePaths; index += 1) {
    const task = mutable.tasks[index % mutable.tasks.length];
    if (!task || task.definition.allowedPaths.length >= 128)
      throw new Error("record_boundary_fixture_capacity_exhausted");
    task.definition.allowedPaths.push(
      pathValue(task.definition.allowedPaths.length),
    );
  }
  remaining =
    targetBytes -
    storedEnvelopeBytes(mutable as unknown as ProjectExecutionState, baseJson);
  const firstGrowth = Math.min(remaining, 511);
  mutable.milestone.acceptanceCriteria[0] = "a".repeat(1 + firstGrowth);
  remaining -= firstGrowth;
  mutable.milestone.acceptanceCriteria[1] = "b".repeat(1 + remaining);
  const result = mutable as unknown as ProjectExecutionState;
  assert.equal(storedEnvelopeBytes(result, baseJson), targetBytes);
  return result;
}

function stateDirectory(root: string) {
  return path.join(root, ".crdd", "execution-model", "state", "project-a");
}

/**
 * PR-D-A-01 accepts valid records across the former byte boundaryを検証する。
 *
 * @responsibility PR-D-A-01 accepts valid records across the former byte boundaryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 accepts valid records across the former byte boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: execution-model Test Source→対象契約
 */
test("PR-D-A-01 accepts valid records across the former byte boundary", (t) => {
  for (const snapshotBytes of [
    MAX_RECORD_BYTES - 1,
    MAX_RECORD_BYTES,
    MAX_RECORD_BYTES + 1,
  ]) {
    const { root, state } = fixture(t);
    assert.equal(
      initializeExecutionStore(root, "binding-a").status,
      "completed",
    );
    const location = path.join(root, ".crdd", "execution-model", "state.json");
    const baseJson = fs.readFileSync(location, "utf8");
    const probe = stateWithStoredBytes(state, MAX_RECORD_BYTES, baseJson);
    const dtoOverhead =
      Buffer.byteLength(JSON.stringify(probe)) - MAX_RECORD_BYTES;
    const view = readSnapshot({ directory: root }, "binding-a").value;
    assert.ok(view);
    const viewOverhead =
      Buffer.byteLength(
        encodeStateValue({
          ...view,
          snapshotRevision: view.snapshotRevision + 1,
          projects: [probe],
        }),
      ) - Buffer.byteLength(JSON.stringify(probe));
    const inputBytes = snapshotBytes - viewOverhead;
    const boundary = stateWithStoredBytes(
      state,
      inputBytes - dtoOverhead,
      baseJson,
    );
    assert.equal(Buffer.byteLength(JSON.stringify(boundary)), inputBytes);
    const written = writeSnapshot(
      { directory: root },
      "binding-a",
      encodeStateValue({
        ...view,
        snapshotRevision: view.snapshotRevision + 1,
        projects: [boundary],
      }),
      view.snapshotRevision,
    );
    assert.equal(written.status, "completed", JSON.stringify(written));
    assert.equal(fs.statSync(location).size, inputBytes - dtoOverhead);
    assert.equal(
      readProjectExecutionState({ directory: root }, "binding-a", "project-a")
        .status,
      "completed",
    );
    assert.equal(fs.existsSync(stateDirectory(root)), false);
  }
  const { root, state } = fixture(t);
  assert.equal(initializeExecutionStore(root, "binding-a").status, "completed");
  const baseJson = fs.readFileSync(
    path.join(root, ".crdd", "execution-model", "state.json"),
    "utf8",
  );
  const binding = JSON.parse(baseJson).repositoryBinding as string;
  for (const physicalBytes of [
    MAX_RECORD_BYTES - 1,
    MAX_RECORD_BYTES,
    MAX_RECORD_BYTES + 1,
  ]) {
    const input = stateWithStoredBytes(state, physicalBytes, baseJson);
    const encoded = prepareUnifiedTaskSnapshot(
      Buffer.from(baseJson),
      input,
      0,
      binding,
    );
    assert.ok(encoded);
    assert.equal(encoded.length, physicalBytes);
    assert.ok(decodeStateSnapshot(encoded, binding));
  }
});

/**
 * 修復wrapperと排他内guardの対象外拒否を本番本文で反証する。
 * @responsibility codecの拒否に依存せず各guardを除去した負対照を確認する。
 * @trace ERB-IT-014
 * @precondition 実Sourceの一意区間、メモリSnapshotと受理codec代役。
 * @stimulus Task・別修復・未解決参照の変更と除去、参照追加・並べ替えを加える。
 * @observation 下位Writer要求counter、guard後継続counter、元本文不変。
 * @oracle 元guardは0、当該guard無効化時だけ1へ進む。
 * @cleanup N/A: VM内だけで実Writer・Kernel・Filesystemは使わない。
 * @boundary ERB-IT-014=Direct Boundary: 本番修復scope guardの分離Oracle。
 */
test("修復Writerの二重scope guardは他操作と参照の変更・除去を拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf("export function saveRepairRecord(");
  const end = text.length;
  assert.ok(start > 0 && end > start);
  const validationSource = fs.readFileSync(
    new URL("../../src/composition/transition.ts", import.meta.url),
    "utf8",
  );
  const dispatchStart = validationSource.indexOf(
    "export function validateRepairWriteCandidate(",
  );
  const dispatch = stripTypeScriptTypes(
    validationSource
      .slice(dispatchStart, validationSource.indexOf("\n/**", dispatchStart))
      .replaceAll("export function", "function"),
  );
  assert.ok(dispatchStart > 0);
  const wrapper = stripTypeScriptTypes(text.slice(start, end)).replace(
    "export function",
    "function",
  );
  const guardStart = wrapper.indexOf(
    "      encodeStateValue(\n        previous?.snapshot.operations.filter(",
  );
  const guardEnd = wrapper.indexOf(
    "      !validateRepairWriteCandidate(",
    guardStart,
  );
  assert.ok(guardStart > 0 && guardEnd > guardStart);
  const wrapperMutant = wrapper.slice(0, guardStart) + wrapper.slice(guardEnd);
  const writerText = fs.readFileSync(
    new URL("../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const writer = writerText.indexOf("function commitStateSnapshotOwned(");
  const boundaryStart = writerText.indexOf("    if (currentRepair) {", writer);
  const boundaryEnd = writerText.indexOf(
    "    let completionConfirmed",
    boundaryStart,
  );
  assert.ok(boundaryStart > writer && boundaryEnd > boundaryStart);
  const boundary = stripTypeScriptTypes(
    writerText.slice(boundaryStart, boundaryEnd),
  );
  const boundaryMutant = boundary.replace(
    'throw new Error("repair_writer_scope_invalid");',
    "void 0;",
  );
  assert.notEqual(boundaryMutant, boundary);
  const repository = {
    repositoryRoot: "root",
    repositoryBinding: "a".repeat(64),
    operationId: "OP-123456",
    revalidate: () => true,
  };
  const target = {
    kind: "docker_repair",
    recoveryId: "target",
    identityJson: '{"operationId":"OP-123456"}',
    checkpoint: 0,
    summarySha256: null,
    history: null,
  };
  const before = {
    operations: [
      target,
      { kind: "docker_task", recoveryId: "task", value: 0 },
      { kind: "docker_repair", recoveryId: "other", value: 0 },
    ],
    unresolvedRecoveries: [{ value: 0 }, { value: 1 }],
  };
  const original = JSON.stringify(before);
  for (const scenario of [
    "preserved",
    "task_changed",
    "task_removed",
    "repair_changed",
    "repair_removed",
    "recovery_changed",
    "recovery_removed",
    "recovery_added",
    "recovery_reordered",
  ]) {
    const after = JSON.parse(original);
    after.operations[0].checkpoint = 1;
    if (scenario === "task_changed") after.operations[1].value = 1;
    if (scenario === "task_removed") after.operations.splice(1, 1);
    if (scenario === "repair_changed") after.operations[2].value = 1;
    if (scenario === "repair_removed") after.operations.splice(2, 1);
    if (scenario === "recovery_changed")
      after.unresolvedRecoveries[0].value = 1;
    if (scenario === "recovery_removed") after.unresolvedRecoveries = [];
    if (scenario === "recovery_added")
      after.unresolvedRecoveries.push({ value: 2 });
    if (scenario === "recovery_reordered") after.unresolvedRecoveries.reverse();
    const beforeBytes = Buffer.from(original),
      bytes = Buffer.from(JSON.stringify(after));
    for (const mutated of [false, true]) {
      let requests = 0;
      const evaluateWrapper = runInNewContext(
        `${dispatch}\n${mutated ? wrapperMutant : wrapper}; saveRepairRecord`,
        {
          Buffer,
          snapshotStateRecord,
          isPlainRecord,
          isSha256Hex,
          types: types,
          publishRecoveryState: () => {
            requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
          settlements: new WeakMap(),
          initializations: new WeakMap(),
          observeExecutionRecoveryRepository: () => repository,
          decodeStateSnapshot: (value: Buffer) => ({
            snapshot: JSON.parse(value.toString("utf8")),
            payloadSha256: "b".repeat(64),
          }),
          readStateSnapshot: () => ({
            status: "completed",
            lockReleased: true,
            value: {
              snapshot: { ...before, revision: 1 },
              payloadSha256: "b".repeat(64),
            },
          }),
          prepareStateRepairCheckpointSnapshot: () => bytes,
          validateStateTransition: () => true,
          encodeStateValue: JSON.stringify,
          writeStateSnapshot: (_owner: unknown, root: unknown) => {
            if (root) requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
        },
      );
      evaluateWrapper(
        {},
        "target",
        {
          expected: { revision: 1, payloadSha256: "b".repeat(64) },
          change: { kind: "checkpoint", update: {} },
        },
        () => true,
      );
      assert.equal(requests, scenario === "preserved" || mutated ? 1 : 0);
      let continuations = 0;
      /**
       * 現在Owner境界の実本文と変異を同じVMで評価する。
       * @responsibility 現在Owner境界の実本文と変異を同じVMで評価する。
       * @trace ERB-IT-014
       * @precondition 現repair記録と固定状態byte・Owner確認。
       * @stimulus 対象境界をVMへ結合し継続到達を数える。
       * @observation 拒否結果、継続回数と保存本文。
       * @oracle Owner喪失や元版差では後続処置0・本文不変。
       * @cleanup VMの有限代役を評価後に破棄する。
       * @boundary 実Sourceの境界断面。実Host・Docker操作なし。
       */
      const evaluateBoundary = () =>
        runInNewContext(
          `(function(){${mutated ? boundaryMutant : boundary}; proceed();})()`,
          {
            corePublication: undefined,
            hostPublication: undefined,
            currentRepair: {
              repository,
              recoveryId: "target",
              before: beforeBytes,
              candidate: bytes,
              assertOwner: () => true,
            },
            repository,
            candidate: { snapshot: after },
            current: { snapshot: before },
            currentBytes: beforeBytes,
            bytes,
            encodeStateValue: JSON.stringify,
            proceed: () => continuations++,
          },
        );
      if (scenario === "preserved" || mutated)
        assert.doesNotThrow(evaluateBoundary);
      else assert.throws(evaluateBoundary, /repair_writer_scope_invalid/u);
      assert.equal(continuations, scenario === "preserved" || mutated ? 1 : 0);
      if (scenario !== "preserved" && mutated) {
        assert.throws(() => assert.equal(requests, 0));
        assert.throws(() => assert.equal(continuations, 0));
      }
      assert.equal(JSON.stringify(before), original);
    }
  }
});

/**
 * 認証限定終了の保存Owner取り違えを外側と排他内で独立に拒否する。
 * @responsibility 本番guardを抽出し、対象相関の省略変異を同じOracleで検出する。
 * @trace ERB-IT-014
 * @precondition 自己生成メモリ値と実Source本文だけを使う。
 * @stimulus 同Repositoryの別操作、重複対象、候補Identity差、Owner失効を与える。
 * @observation 下位Writer到達数と排他内guard後の継続数、元byte不変。
 * @oracle 正例だけ各一回。各guard省略変異は誤継続として検出する。
 * @cleanup N/A: VMだけで実Kernel・Filesystem・Dockerは使わない。
 * @boundary ERB-IT-014=Direct Boundary: 専用Writerの対象相関。物理保存の証明ではない。
 */
test("認証限定Writerの二重対象相関は別操作Ownerを拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/composition/crud.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf("export function saveAuthenticationClosure(");
  const end = text.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const wrapper = stripTypeScriptTypes(text.slice(start, end)).replace(
    "export function",
    "function",
  );
  const guardStart = wrapper.indexOf("    if (\n      beforeTasks");
  const guardEnd = wrapper.indexOf(
    "    return publishRecoveryState(",
    guardStart,
  );
  assert.ok(guardStart > 0 && guardEnd > guardStart);
  const wrapperMutant = wrapper.slice(0, guardStart) + wrapper.slice(guardEnd);
  const writerText = fs.readFileSync(
    new URL("../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const innerStart = writerText.indexOf(
    "    if (currentAuthenticationClosure) {",
  );
  const innerEnd = writerText.indexOf("    } else if (", innerStart);
  assert.ok(innerStart > 0 && innerEnd > innerStart);
  const inner = stripTypeScriptTypes(
    `${writerText.slice(innerStart, innerEnd)}\n    }`,
  );
  const innerGuardStart = inner.indexOf("      if (");
  const innerGuardEnd = inner.indexOf(
    '        throw new Error("authentication_closure_context");',
    innerGuardStart,
  );
  assert.ok(innerGuardStart > 0 && innerGuardEnd > innerGuardStart);
  const innerMutant =
    inner.slice(0, innerGuardStart) +
    inner.slice(
      innerGuardEnd +
        '        throw new Error("authentication_closure_context");'.length,
    );
  const repository = {
    repositoryRoot: "fixed-root",
    repositoryBinding: "a".repeat(64),
    operationId: "OP-A",
    revalidate: () => true,
  };
  for (const scenario of [
    "valid",
    "other_owner",
    "duplicate_before",
    "duplicate_candidate",
    "identity_changed",
    "owner_lost",
  ]) {
    const target = {
      kind: "docker_task",
      recoveryId: "exact",
      identityJson: JSON.stringify({
        operationId: scenario === "other_owner" ? "OP-B" : "OP-A",
      }),
    };
    const other = {
      kind: "docker_task",
      recoveryId: "other",
      identityJson: '{"operationId":"OP-B"}',
    };
    const before = {
      operations: [
        target,
        other,
        ...(scenario === "duplicate_before" ? [target] : []),
      ],
    };
    const after = JSON.parse(JSON.stringify(before));
    if (scenario === "duplicate_before") after.operations.pop();
    if (scenario === "duplicate_candidate") after.operations.push(target);
    if (scenario === "identity_changed")
      after.operations[0].identityJson =
        '{"operationId":"OP-A","different":true}';
    const beforeBytes = Buffer.from(JSON.stringify(before));
    const bytes = Buffer.from(JSON.stringify(after));
    for (const mutant of [false, true]) {
      let requests = 0;
      const evaluateWrapper = runInNewContext(
        `${mutant ? wrapperMutant : wrapper}; saveAuthenticationClosure`,
        {
          Buffer,
          types: types,
          publishRecoveryState: () => {
            requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
          settlements: new WeakMap(),
          encodeStateValue: JSON.stringify,
          decodeStateSnapshot: (value: Buffer) => ({
            snapshot: JSON.parse(value.toString()),
          }),
          prepareAuthenticationUnknownClosureSnapshot: () => bytes,
          writeStateSnapshot: (_owner: unknown, root: unknown) => {
            if (root) requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
        },
      );
      evaluateWrapper(
        repository,
        "exact",
        beforeBytes,
        [],
        () => scenario !== "owner_lost",
      );
      assert.equal(
        requests,
        scenario === "valid" || (mutant && scenario !== "owner_lost") ? 1 : 0,
        `${scenario}: wrapper`,
      );
      let continuations = 0;
      /**
       * authunknownの内側再入場境界を局所評価する。
       * @responsibility authunknownの内側再入場境界を局所評価する。
       * @trace ERB-IT-014
       * @precondition 固定current/Ownerとauthunknown記録。
       * @stimulus 内側本文へ同じbindingと故障を渡す。
       * @observation 継続回数、blockedと元記録。
       * @oracle Owner失効・current差を既知不存在へ丸めない。
       * @cleanup N/A: メモリ上のVM評価のみ。
       * @boundary auth再入場のSource断面。実回復成功ではない。
       */
      const evaluateInner = () =>
        runInNewContext(
          `(function(){${mutant ? innerMutant : inner}; proceed();})()`,
          {
            currentAuthenticationClosure: {
              repository,
              recoveryId: "exact",
              before: beforeBytes,
              candidate: bytes,
              observations: [],
              assertOwner: () => scenario !== "owner_lost",
            },
            current: { snapshot: before },
            candidate: { snapshot: after },
            currentBytes: beforeBytes,
            bytes,
            repository,
            prepareAuthenticationUnknownClosureSnapshot: () => bytes,
            proceed: () => continuations++,
          },
        );
      if (scenario === "valid" || mutant) assert.doesNotThrow(evaluateInner);
      else assert.throws(evaluateInner, /authentication_closure_context/u);
      assert.equal(continuations, scenario === "valid" || mutant ? 1 : 0);
      if (mutant && scenario !== "valid" && scenario !== "owner_lost") {
        assert.throws(() => assert.equal(requests, 0));
        assert.throws(() => assert.equal(continuations, 0));
      }
      assert.equal(beforeBytes.toString(), JSON.stringify(before));
    }
  }
});

/**
 * 初期化後の保存拒否・例外で既発行Effectを失わない。
 * @responsibility 本番wrapper本文の集約を保存本体・Kernelの成立と分ける。
 * @trace ERB-IT-014
 * @precondition 所有試験Directory、実wrapper本文と依存代役。
 * @stimulus 初期化拒否・部分作成・成功後Writer拒否／例外を与える。
 * @observation 実作成物、返却Effect、保存未確定と下位要求counter。
 * @oracle 初期化のEffectは後続結果とORし、保存成功へ補完しない。
 * @cleanup 所有子だけを境界確認して削除し不存在を確認する。
 * @boundary ERB-IT-014=Direct Boundary: wrapperのEffect集約。実Kernelは別Host Case。
 */
test("修復Writer wrapperは初期化Effectを後続拒否・例外から保全する", (t) => {
  const ownedDirectory = createRepositoryTestDirectory("repair-writer-tests-");
  const area = { directory: ownedDirectory.path };
  const root = fs.mkdtempSync(
    path.join(area.directory, "repair-writer-wrapper-"),
  );
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.ok(
      root.startsWith(`${area.directory}${path.sep}repair-writer-wrapper-`),
    );
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
    ownedDirectory.cleanup();
  });
  const text = fs.readFileSync(
    new URL("../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  const publicationSource = fs.readFileSync(
    new URL("../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    sourceDeclaration(publicationSource, "publishRecoveryState") +
      "\n" +
      sourceDeclaration(text, "saveRepairRecord"),
  ).replaceAll("export function", "function");
  const validationSource = fs.readFileSync(
    new URL("../../src/composition/transition.ts", import.meta.url),
    "utf8",
  );
  const dispatchStart = validationSource.indexOf(
    "export function validateRepairWriteCandidate(",
  );
  const dispatch = sourceDeclaration(
    validationSource,
    "validateRepairWriteCandidate",
  );
  assert.ok(dispatchStart > 0);
  const mutant = body.replace(
    /initializationEffectIssued\s*\|\|\s*saved.filesystemEffectIssued/u,
    "saved.filesystemEffectIssued",
  );
  assert.notEqual(mutant, body);
  for (const mode of [
    "init_rejected",
    "init_partial",
    "writer_lock",
    "writer_owner",
    "writer_throw",
  ]) {
    const directory = path.join(root, mode);
    let calls = 0;
    const candidate = {
      operations: [
        {
          kind: "docker_repair",
          recoveryId: "target",
          identityJson: '{"operationId":"OP-123456"}',
          summarySha256: null,
          history: null,
        },
      ],
      unresolvedRecoveries: [],
    };
    /**
     * 回復Writer断面へ固定Repo・state・Capabilityを結合する。
     * @responsibility 回復Writer断面へ固定Repo・state・Capabilityを結合する。
     * @trace ERB-IT-014
     * @precondition 抽出Sourceとcreate代役。
     * @stimulus 実Writer本文をVMで生成し入力を渡す。
     * @observation 保存要求・返却理由・参照相関。
     * @oracle scopeとOwnerの差を保存成功へ変換しない。
     * @cleanup VM用代役を破棄し実記録を書き換えない。
     * @boundary Writerの局所境界。実Filesystem変更なし。
     */
    const evaluate = (source: string, create: boolean) => {
      const wrapper = runInNewContext(
        `${dispatch}\n${source}; saveRepairRecord`,
        {
          Buffer,
          Object,
          Promise,
          types: types,
          snapshotStateRecord,
          isSha256Hex,
          settlements: new WeakMap(),
          initializations: new WeakMap(),
          observeExecutionRecoveryRepository: () => ({
            repositoryRoot: root,
            repositoryBinding: "a".repeat(64),
            revalidate: () => true,
          }),
          decodeStateSnapshot: () => ({ snapshot: candidate }),
          prepareStateRepairSnapshot: () =>
            Buffer.from(JSON.stringify(candidate)),
          validateStateTransition: () => true,
          encodeStateValue: JSON.stringify,
          prepareStateInitialization: () => {
            if (create && mode !== "init_rejected") fs.mkdirSync(directory);
            return {
              status: mode.startsWith("init_") ? "blocked" : "prepared",
              effectIssued: mode !== "init_rejected",
              lockReleased: true,
            };
          },
          writeStateSnapshot: (_owner: unknown, repository: unknown) => {
            if (!repository)
              return {
                status: "blocked",
                reason: "coordinator_state_input_invalid",
                snapshotConfirmed: false,
                filesystemEffectIssued: false,
                lockReleased: true,
              };
            calls++;
            if (mode === "writer_throw") throw new Error("synthetic");
            return {
              status: "blocked",
              reason:
                mode === "writer_lock"
                  ? "coordinator_state_lock_unavailable"
                  : "coordinator_state_storage_unconfirmed",
              snapshotConfirmed: false,
              filesystemEffectIssued: false,
              lockReleased: mode !== "writer_lock",
            };
          },
        },
      );
      return wrapper(
        {},
        "target",
        {
          expected: null,
          change: {
            kind: "create",
            identityJson: '{"operationId":"OP-123456"}',
          },
        },
        () => true,
      );
    };
    const result = evaluate(body, true);
    assert.equal(result.status, "blocked");
    assert.equal(result.snapshotConfirmed, false);
    assert.equal(result.filesystemEffectIssued, mode !== "init_rejected");
    assert.equal(fs.existsSync(directory), mode !== "init_rejected");
    assert.equal(calls, mode.startsWith("init_") ? 0 : 1);
    if (mode.startsWith("init_"))
      assert.equal(
        result.reason,
        "coordinator_state_initialization_unconfirmed",
      );
    if (mode === "writer_lock") {
      assert.equal(result.reason, "coordinator_state_lock_unavailable");
      assert.equal(result.lockReleased, false);
      const changed = evaluate(mutant, false);
      assert.throws(() => assert.equal(changed.filesystemEffectIssued, true));
    }
  }
});

/**
 * Task Writer内の修復保全guardを本番区間から直接反証する。
 * @responsibility 純粋codecの成功を実Writer側の拒否確認へ流用しない。
 * @trace ERB-IT-014
 * @precondition 本番Writerの一意なguard区間とメモリ内Snapshot。
 * @stimulus Repair新規・変更・除去、Task更新とguard除去変異を与える。
 * @observation guard通過後の保存継続counterと入力全文不変。
 * @oracle 不正候補は継続0、正対照は1。各guard除去は同じOracleを破る。
 * @cleanup N/A: VM内だけで実FileやKernelは使わない。
 * @boundary ERB-IT-014=Direct Boundary: Task Writerの対象外Repair保全guard。
 */
test("Task Writerの修復保全guardは新規・変更・除去を拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const functionStart = text.indexOf("function commitStateSnapshotOwned(");
  const normalStart = text.indexOf(
    "    const previousOperations = new Map(",
    functionStart,
  );
  const normalEnd = text.indexOf(
    "      for (const resource of operation.resources?.checkpoints ?? []) {",
    normalStart,
  );
  const settlementStart = text.indexOf(
    "      for (const previous of current.snapshot.operations) {",
    functionStart,
  );
  const settlementEnd = text.indexOf(
    "        const next = candidate.snapshot.operations.find(",
    settlementStart,
  );
  const publication = text.indexOf(
    'create("state.pending.json", bytes)',
    normalEnd,
  );
  assert.ok(
    functionStart >= 0 &&
      normalStart > functionStart &&
      normalEnd > normalStart,
  );
  assert.ok(
    settlementStart > functionStart &&
      settlementEnd > settlementStart &&
      settlementEnd < normalStart,
  );
  assert.ok(publication > normalEnd, "guardは保存開始より前に置く");
  const intervals = [
    {
      body: `${text.slice(normalStart, normalEnd)}\n}`,
      reason: "repair_writer_unconnected",
    },
    {
      body: `${text.slice(settlementStart, settlementEnd)}\n}`,
      reason: "repair_state_changed_by_task_settlement",
    },
  ];
  const repair = {
    kind: "docker_repair",
    recoveryId: "repair",
    checkpoint: null,
  };
  const task = {
    kind: "docker_task",
    recoveryId: "task",
    phase: "executing",
    identityJson: '{"operationId":"OP-123456"}',
  };
  for (const [index, interval] of intervals.entries()) {
    const throwAt = interval.body.indexOf(
      `throw new Error("${interval.reason}")`,
    );
    const guardAt = interval.body.lastIndexOf("if (", throwAt);
    const guardEnd = interval.body.indexOf(";", throwAt) + 1;
    assert.ok(throwAt >= 0 && guardAt >= 0 && guardEnd > throwAt);
    const mutant =
      interval.body.slice(0, guardAt) + interval.body.slice(guardEnd);
    assert.notEqual(mutant, interval.body);
    const cases =
      index === 0
        ? ["new", "changed", "preserved"]
        : ["removed", "changed", "preserved"];
    for (const scenario of cases) {
      const before = {
        operations: scenario === "new" ? [task] : [task, repair],
      };
      const changedTask = { ...task, phase: "settling" };
      const after = {
        operations:
          scenario === "removed"
            ? [changedTask]
            : [
                changedTask,
                {
                  ...repair,
                  ...(scenario === "changed" ? { checkpoint: {} } : {}),
                },
              ],
      };
      const original = JSON.stringify({ before, after });
      for (const mutated of [false, true]) {
        let continuations = 0;
        /**
         * 回復の観測間隔境界をSource変異付きで検査する。
         * @responsibility 回復の観測間隔境界をSource変異付きで検査する。
         * @trace ERB-IT-014
         * @precondition 同じ保存byteとOwner確認の有限値。
         * @stimulus 実interval本文または変異をVMで評価する。
         * @observation 継続到達と状態byte。
         * @oracle 観測間の失効・版差で処置を止める。
         * @cleanup N/A: 実TimerやI/Oは生成しない。
         * @boundary 観測順序の局所Source評価。
         */
        const evaluate = () =>
          runInNewContext(
            `(function(){${stripTypeScriptTypes(mutated ? mutant : interval.body)}; proceed();})()`,
            {
              current: { snapshot: before },
              candidate: { snapshot: after },
              currentRepair: null,
              repairHistoryScopeConfirmed: false,
              currentHistory: null,
              encodeStateValue: JSON.stringify,
              proceed: () => {
                continuations++;
              },
            },
          );
        if (scenario === "preserved" || mutated) assert.doesNotThrow(evaluate);
        else assert.throws(evaluate, new RegExp(interval.reason));
        assert.equal(
          continuations,
          scenario === "preserved" || mutated ? 1 : 0,
        );
        if (scenario !== "preserved" && mutated)
          assert.throws(
            () => assert.equal(continuations, 0),
            "guard除去は拒否Oracleを破る",
          );
        assert.equal(JSON.stringify({ before, after }), original);
      }
    }
  }
});

/**
 * 終端Writerの候補生成を固定前提と元結果へ限定する。
 * @responsibility 不明資源・Host・Ownerと元版差で保存候補を発行しないことを反証する。
 * @trace ERB-IT-014
 * @precondition 本番Writer本文と模擬Reader／候補生成／物理Writerだけを使う。
 * @stimulus 五資源の各未終了形、HostとOwner欠測、既存三結果と結果欠測を渡す。
 * @observation 候補生成と物理保存回数、固定lifecycle値、Writer中の再確認。
 * @oracle 全前提成立時だけ結果・一次失敗を保持したsettling候補を保存する。
 * @cleanup N/A: 外部資源を作成しない。実Filesystem保存は別のHost試験が所有する。
 * @boundary ERB-IT-014=Direct Boundary: 本番固定Writerの前提検査。
 */
test("現在回収終端Writer: 五資源・Host・元版の拒否と結果保持", () => {
  const purposes = [
    "create_egress_network",
    "create_internal_network",
    "create_provider",
    "create_proxy",
    "create_subscription_auth_probe",
  ] as const;
  const storeSource = fs.readFileSync(
    new URL("../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  const writerBody = stripTypeScriptTypes(
    sourceDeclaration(storeSource, "saveRecoveryCheckpoint").replaceAll(
      "export function",
      "function",
    ),
  );
  const mutantBody = writerBody
    .replaceAll("saveRecoveryCheckpoint", "mutatedRecoveryTerminal")
    .replace(
      "!isDockerRestartCheckpointSettled(operation.dockerRestart)",
      "false",
    );
  assert.notEqual(
    mutantBody,
    writerBody.replaceAll("saveRecoveryCheckpoint", "mutatedRecoveryTerminal"),
  );
  const restartCases = ["not_issued", "unknown", "issued", "confirmed"].flatMap(
    (request) =>
      ["not_required", "pending", "confirmed", "unknown"].flatMap((cleanup) =>
        ["null", "completed", "blocked"].map(
          (result) => `restart:${request}:${cleanup}:${result}`,
        ),
      ),
  );
  for (const scenario of [
    "null",
    "blocked",
    "completed",
    "cancelled",
    "before_changed",
    "forged_before",
    "forged_before_prototype",
    "proxied_before",
    "operation_changed",
    "missing",
    "host_pending",
    "host_missing",
    "host_foreign",
    "owner_active",
    "awaiting",
    "restart_unknown",
    "restart_unissued_final",
    "restart_unissued_effect_unknown",
    "owner_changed",
    ...restartCases,
    ...purposes.flatMap((purpose) =>
      [
        "unknown",
        "issued",
        "intent_saved",
        "unidentified_absent",
        "present",
      ].map((value) => `${purpose}:${value}`),
    ),
  ]) {
    const existing =
      scenario === "completed"
        ? {
            status: "completed",
            reason: "provider_operation_completed",
            cleanupConfirmed: false,
          }
        : scenario === "cancelled"
          ? {
              status: "cancelled",
              reason: "provider_operation_cancelled",
              cleanupConfirmed: false,
            }
          : scenario === "blocked"
            ? {
                status: "blocked",
                reason: "provider_result_invalid",
                cleanupConfirmed: false,
              }
            : null;
    const fixture = createResourceOperationFixture();
    const host = JSON.parse(fixture.bytes.toString("utf8")).operations.find(
      (item: { kind: string }) => item.kind === "host_operation",
    );
    assert.ok(host);
    const operation = {
      ...fixture.operation,
      kind: "docker_task",
      identityJson: JSON.stringify({
        ...fixture.identity,
        operationId:
          scenario === "operation_changed"
            ? "OP-654321"
            : fixture.identity.operationId,
      }),
      recoveryId: fixture.recoveryId,
      phase: scenario === "awaiting" ? "terminal" : "settling",
      lease: "released",
      execution: {
        ...fixture.operation.execution,
        ownerEffect: scenario === "owner_active" ? "active" : "disabled",
        externalSend: "issued",
      },
      primaryFailure: existing === null ? null : { reason: "original_failure" },
      outcome: existing,
      summarySha256: null,
      dockerRestart: scenario.startsWith("restart_unissued_")
        ? {
            requestId: "a".repeat(64),
            scopeSha256: "b".repeat(64),
            request: "unknown",
            cleanup: "confirmed",
            result: {
              status: "blocked",
              reason: "docker_restart_stop_unconfirmed",
              request: "not_issued",
              effectOutcomeUnknown:
                scenario === "restart_unissued_effect_unknown",
            },
          }
        : scenario.startsWith("restart:")
          ? {
              requestId: "a".repeat(64),
              scopeSha256: "b".repeat(64),
              request: scenario.split(":")[1],
              cleanup: scenario.split(":")[2],
              result:
                scenario.split(":")[3] === "null"
                  ? null
                  : {
                      status: scenario.split(":")[3],
                      reason: "fixed_result",
                      request: scenario.split(":")[1],
                      effectOutcomeUnknown: ![
                        "not_issued",
                        "confirmed",
                      ].includes(scenario.split(":")[1] ?? ""),
                    },
            }
          : scenario === "restart_unknown"
            ? { request: "unknown", cleanup: "pending", result: null }
            : null,
      resources: {
        ...createResourceBookFixture("crdd.owner=fixture", "planned", purposes),
        snapshot: {
          resources: createResourceBookFixture(
            "crdd.owner=fixture",
            "planned",
            purposes,
          ).snapshot.resources.map((r) => {
            if (!scenario.startsWith(`${r.key}:`)) return r;
            return {
              ...r,
              request: scenario.endsWith(":present")
                ? ("issued" as const)
                : ("unknown" as const),
              identity: {
                ...r.identity,
                dockerId: scenario.endsWith(":present") ? "d".repeat(64) : null,
              },
            };
          }),
        },
        checkpoints: purposes.map((key) => {
          const state = scenario.startsWith(`${key}:`)
            ? scenario.slice(key.length + 1)
            : "none";
          return {
            key,
            submission: state === "none" ? "none" : "intent_saved",
            receiptSource: state === "present" ? "docker_create_result" : null,
            observation:
              state === "unidentified_absent"
                ? "absent"
                : state === "present"
                  ? "present"
                  : "unobserved",
            absenceEvidenceSha256:
              state === "unidentified_absent" ? "e".repeat(64) : null,
          };
        }),
      },
    };
    assert.equal(
      domain.validateResourceBook(operation.resources),
      true,
      scenario,
    );
    const snapshot = {
      operations: [
        ...(scenario === "host_missing"
          ? []
          : [
              {
                ...host,
                operationId:
                  scenario === "host_foreign" ? "OP-654321" : host.operationId,
                phase: scenario === "host_pending" ? "active" : "terminal",
                cleanup: scenario === "host_pending" ? "pending" : "confirmed",
              },
            ]),
        ...(scenario === "missing" ? [] : [operation]),
      ],
    };
    const before = Buffer.from(`${JSON.stringify(snapshot)}\n`);
    let candidates = 0,
      writes = 0,
      ownerChecks = 0;
    const repository = {
      operationId: fixture.identity.operationId,
      repositoryBinding: "fixed",
      revalidate: () => true,
    };
    const writer = runInNewContext(
      `${writerBody}; ${mutantBody}; saveRecoveryCheckpoint.mutant = mutatedRecoveryTerminal; saveRecoveryCheckpoint`,
      {
        snapshotStateRecord,
        readStateVersionEvidence: privateStorageStore.readStateVersionEvidence,
        Buffer,
        isDockerRestartCheckpointSettled,
        areTaskResourcesSettled,
        readOperationHost,
        encodeStateValue: JSON.stringify,
        readStateSnapshot: () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot },
        }),
        prepareStateLifecycleSnapshot(
          bytes: Buffer,
          recoveryId: string,
          lifecycle: unknown,
          binding: string,
        ) {
          candidates++;
          assert.deepEqual(bytes, before);
          assert.equal(recoveryId, fixture.recoveryId);
          assert.equal(binding, "fixed");
          assert.deepEqual(JSON.parse(JSON.stringify(lifecycle)), {
            phase: "settling",
            lease: "released",
            execution: operation.execution,
            primaryFailure: operation.primaryFailure,
            outcome:
              existing === null
                ? {
                    status: "blocked",
                    reason: "docker_process_controller_execution_failed_closed",
                    cleanupConfirmed: true,
                  }
                : { ...existing, cleanupConfirmed: true },
            summarySha256: null,
          });
          return Buffer.from("fixed-candidate");
        },
        writeStateSnapshot(
          _management: unknown,
          bound: { revalidate: () => boolean } | null,
          candidate: Buffer | null,
        ) {
          if (candidate === null)
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          writes++;
          assert.equal(bound?.revalidate(), true);
          assert.equal(candidate.toString(), "fixed-candidate");
          return {
            status: "completed",
            snapshotConfirmed: true,
            lockReleased: true,
          };
        },
      },
    ) as ((
      repo: unknown,
      recoveryId: string,
      evidence: unknown,
      request: import("../../src/attempt/types.ts").RecoveryCheckpointRequest,
    ) => { snapshotConfirmed: boolean }) & {
      mutant: (...args: unknown[]) => { snapshotConfirmed: boolean };
    };
    const issued = privateStorageStore.captureStateVersionEvidence(
      scenario === "before_changed" ? "different" : before.toString("utf8"),
    );
    let traps = 0;
    const beforeEvidence =
      scenario === "forged_before"
        ? before
        : scenario === "forged_before_prototype"
          ? Object.create(Object.getPrototypeOf(issued))
          : scenario === "proxied_before"
            ? new Proxy(issued, {
                get() {
                  traps++;
                  throw new Error("must_not_observe_version_evidence_proxy");
                },
                getPrototypeOf() {
                  traps++;
                  throw new Error("must_not_observe_version_evidence_proxy");
                },
              })
            : issued;
    const result = writer(repository, fixture.recoveryId, beforeEvidence, {
      kind: "terminal",
      assertOwner: () => ++ownerChecks === 1 || scenario !== "owner_changed",
    });
    const accepted = [
      "null",
      "blocked",
      "completed",
      "cancelled",
      "restart:not_issued:not_required:null",
      "restart:confirmed:confirmed:completed",
      "restart:confirmed:confirmed:blocked",
      "restart_unissued_final",
    ].includes(scenario);
    assert.equal(result.snapshotConfirmed, accepted, scenario);
    assert.equal(candidates, accepted ? 1 : 0, scenario);
    assert.equal(writes, accepted ? 1 : 0, scenario);
    assert.equal(traps, 0, scenario);
    assert.equal(before.toString(), `${JSON.stringify(snapshot)}\n`);
    if (
      [
        "restart:confirmed:confirmed:null",
        "restart_unissued_effect_unknown",
      ].includes(scenario)
    ) {
      assert.equal(
        writer.mutant(
          repository,
          fixture.recoveryId,
          privateStorageStore.captureStateVersionEvidence(
            before.toString("utf8"),
          ),
          {
            kind: "terminal",
            assertOwner: () => true,
          },
        ).snapshotConfirmed,
        true,
      );
      assert.equal(candidates, 1);
      assert.equal(writes, 1);
    }
  }
});

/**
 * 全履歴Queryの不在・不正・実体変化と解放不明を区別する。
 * @responsibility 通常Readerに履歴I/Oを足さず、指定Queryだけ全件の安定性を検査する。
 * @trace ERB-IT-014
 * @precondition 自己生成Git Rootと公開初期化のStateだけを使う。
 * @stimulus 無関係な複数行、末尾破損、重複、pending、Link、I/O・置換と解放不明を与える。
 * @observation 公開結果、全行、凍結、Lock解放、元Stateと履歴。
 * @oracle 正規全件又は確認済み不在だけ成功し、失敗時のhistoryRowsはnull。
 * @cleanup fixtureが今回のRootだけを回収し、故障注入は各子で復元する。
 * @boundary 実Filesystem・Git・wx。Link種別・nlinkはメタデータ故障注入、解放不明は既存保存Source fixtureで模擬する。
 */
test("全履歴Readerは全件検査・明示不存在・実体変化・解放不明を区別する", async (t) => {
  const { root } = fixture(t);
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const cap = root;
  assert.equal(
    domain.readState(prepareFixtureRecovery(cap), {
      scope: "recovery",
      input: { kind: "history" },
    }).value,
    null,
  );
  assert.equal(
    domain.initializeExecutionStore({ directory: root }, "binding-a").status,
    "completed",
  );
  const area = path.join(root, ".crdd", "execution-model"),
    file = path.join(area, "history.jsonl");
  const stateFile = path.join(area, "state.json");
  const initialized = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const state = Buffer.from(
    `${encodeStateValue({
      ...initialized,
      projects: [
        {
          contract: "crdd-domain/project-state/v1",
          projectId: "project-source",
          milestoneId: "milestone-source",
          repositoryRevision: "a".repeat(40),
          generation: 1,
          decisionApplicationId: null,
          milestone: {
            id: "milestone-source",
            acceptanceCriteria: ['保存原文 "引用" \\ 終端'],
            state: "planned",
            criterionEvidenceIds: [],
          },
          objectives: [],
          tasks: [],
        },
      ],
    })}\n`,
    "utf8",
  );
  fs.writeFileSync(stateFile, state);
  const absent = domain.readState(prepareFixtureRecovery(cap), {
    scope: "recovery",
    input: { kind: "history" },
  });
  assert.equal(absent.status, "completed", absent.reason);
  assert.equal(absent.lockReleased, true);
  assert.ok(absent.value);
  assert.equal(Object.isFrozen(absent.value), true);
  assert.deepEqual(fs.readFileSync(stateFile), state);
  assert.equal(state.toString("utf8").endsWith("\n"), true);
  assert.equal(state.toString("utf8").includes("保存原文"), true);
  assert.equal(
    createHash("sha256").update(state).digest("hex"),
    absent.value.payloadSha256,
  );
  assert.deepEqual(absent.historyRows, []);
  assert.equal(Object.isFrozen(absent.historyRows), true);
  assert.equal(
    domain.readState(prepareFixtureRecovery(cap), { scope: "recovery" })
      .historyRows,
    null,
  );
  const lines = ["history-first", "unrelated-history"].map(
    (id) =>
      `${encodeStateValue({
        schema: "crdd-execution-model/history-row/v3",
        occurredAt: "2026-11-01T00:00:00.000Z",
        summary: {
          schema: "crdd-coordinator/task-summary/v1",
          record: {
            id,
            occurredAt: "2026-11-01T00:00:00.000Z",
            outcome: "completed",
            primaryFailure: null,
            cleanup: "confirmed",
          },
        },
      })}\n`,
  );
  const valid = Buffer.from(lines.join(""));
  const firstLine = lines[0];
  assert.ok(firstLine);
  fs.writeFileSync(file, valid);
  const complete = domain.readState(prepareFixtureRecovery(cap), {
    scope: "recovery",
    input: { kind: "history" },
  });
  assert.equal(complete.status, "completed", complete.reason);
  assert.equal(complete.lockReleased, true);
  assert.ok(complete.value);
  assert.equal(
    complete.value.versionEvidence.matches(absent.value.versionEvidence),
    true,
  );
  assert.deepEqual(
    complete.historyRows?.map((row) => row.recoveryId),
    ["task-history.history-first", "task-history.unrelated-history"],
  );
  assert.deepEqual(
    complete.historyRows?.map((row) => row.line),
    lines,
  );
  assert.ok(complete.historyRows?.every((row) => Object.isFrozen(row)));
  assert.equal(Object.isFrozen(complete.historyRows), true);
  let historyOpens = 0;
  const open = fs.openSync;
  const observe = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof fs.openSync>) => {
      if (String(args[0]) === file) historyOpens++;
      return Reflect.apply(open, fs, args);
    },
  );
  assert.equal(
    domain.readState(prepareFixtureRecovery(cap), { scope: "recovery" }).status,
    "completed",
  );
  assert.equal(historyOpens, 0);
  observe.mock.restore();
  for (const mode of [
    "tail",
    "unterminated",
    "duplicate",
    "zero",
    "utf8",
    "pending",
    "directory",
    "junction",
    "hardlink",
    "io",
    "swap",
    "disappearance",
    "appearance",
  ]) {
    await t.test(mode, (t) => {
      fs.writeFileSync(file, valid);
      const pending = path.join(area, "history.pending.jsonl");
      const alias = path.join(root, `history-${mode}`);
      if (mode === "tail") fs.appendFileSync(file, "{}\n");
      if (mode === "unterminated")
        fs.writeFileSync(file, valid.subarray(0, valid.length - 1));
      if (mode === "duplicate") fs.writeFileSync(file, firstLine + firstLine);
      if (mode === "zero") fs.writeFileSync(file, "");
      if (mode === "utf8")
        fs.appendFileSync(file, Buffer.from([0xc3, 0x28, 10]));
      if (mode === "pending") fs.writeFileSync(pending, valid);
      if (mode === "directory") {
        fs.unlinkSync(file);
        fs.mkdirSync(file);
      }
      if (mode === "junction" || mode === "hardlink") {
        const lstat = fs.lstatSync;
        t.mock.method(
          fs,
          "lstatSync",
          (...args: Parameters<typeof fs.lstatSync>) => {
            const observed = Reflect.apply(lstat, fs, args);
            if (String(args[0]) !== file) return observed;
            assert.ok(observed);
            return Object.defineProperties(
              Object.create(observed),
              mode === "junction"
                ? { isSymbolicLink: { value: () => true } }
                : { nlink: { value: 2 } },
            );
          },
        );
      }
      if (mode === "io")
        t.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof fs.openSync>) => {
            if (String(args[0]) === file && args[1] === fs.constants.O_RDONLY)
              throw new Error("injected_history_read");
            return Reflect.apply(open, fs, args);
          },
        );
      if (mode === "swap" || mode === "disappearance") {
        let descriptor: number | null = null;
        t.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof fs.openSync>) => {
            const result = Reflect.apply(open, fs, args);
            if (String(args[0]) === file) descriptor = result;
            return result;
          },
        );
        const read = fs.readSync;
        t.mock.method(
          fs,
          "readSync",
          (...args: Parameters<typeof fs.readSync>) => {
            const count = Reflect.apply(read, fs, args);
            if (args[0] === descriptor && count === 0) {
              descriptor = null;
              fs.renameSync(file, alias);
              if (mode === "swap") fs.writeFileSync(file, valid);
            }
            return count;
          },
        );
      }
      if (mode === "appearance") {
        fs.unlinkSync(file);
        const readdir = fs.readdirSync;
        let appeared = false;
        t.mock.method(
          fs,
          "readdirSync",
          (...args: Parameters<typeof fs.readdirSync>) => {
            const names = Reflect.apply(readdir, fs, args);
            if (String(args[0]) === area && !appeared) {
              appeared = true;
              fs.writeFileSync(file, valid);
            }
            return names;
          },
        );
      }
      const read = domain.readState(prepareFixtureRecovery(cap), {
        scope: "recovery",
        input: { kind: "history" },
      });
      assert.equal(read.status, "blocked", mode);
      assert.equal(read.historyRows, null, mode);
      assert.equal(read.value, null, mode);
      assert.equal(read.lockReleased, true, mode);
      assert.deepEqual(fs.readFileSync(path.join(area, "state.json")), state);
      t.mock.restoreAll();
      if (mode === "pending") fs.unlinkSync(pending);
      if (mode === "directory") fs.rmdirSync(file);
      else if (mode !== "disappearance") fs.unlinkSync(file);
      if (mode === "swap" || mode === "disappearance") fs.unlinkSync(alias);
    });
  }
  fs.writeFileSync(file, valid);
  const unknown = createRuntimeStorageSourceFixture((source) => source, {
    acquireExecutionStateLock: () => ({
      status: "acquired",
      lock: { assertLive: () => true, release: () => false },
    }),
  }).readState(prepareFixtureRecovery(cap), {
    scope: "recovery",
    input: { kind: "history" },
  });
  assert.equal(unknown.status, "blocked");
  assert.equal(unknown.lockReleased, false);
  assert.equal(unknown.historyRows, null);
  assert.equal(unknown.value, null);
  assert.deepEqual(fs.readFileSync(file), valid);
  assert.equal(
    domain.readState(prepareFixtureRecovery(cap), {
      scope: "recovery",
      input: {
        kind: "history",
        recoveryId: "foreign",
      } as never,
    }).status,
    "blocked",
  );
});

/**
 * 終了保存の再入場は通常拒否を用途限定Readerへ渡すだけにする。
 * @trace ERB-IT-014
 * @precondition 本番受付本文と有限Reader/Writerを使用する。
 * @stimulus 通常/関連Task/終了pending、別理由拒否、未解放、Owner失効、用途限定拒否。
 * @observation Reader配送、Owner確認、保持結果、保存回数。
 * @oracle 再入場理由だけ次Readerへ進み、用途限定拒否後は保存0。関連Task保持は従来どおり。
 * @cleanup N/A: VM内の局所値のみ。
 * @boundary 受付の配送反証。保存物の検査は実Reader/Filesystem試験で確認する。
 */
test("終了再入場は再入場理由だけを既存の用途限定Readerへ接続する", () => {
  const text = fs.readFileSync(
    new URL("../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    sourceDeclaration(text, "completeRecovery"),
  );
  for (const mode of [
    "normal",
    "related",
    "pending",
    "other_failure",
    "lock_unknown",
    "owner_lost",
    "missing_value",
    "legacy_marker",
    "unknown_file",
    "foreign_pending",
    "history_pending",
    "related_pending",
  ]) {
    const id = "recovery",
      line = Buffer.from("history"),
      before = Buffer.from("before"),
      candidate = Buffer.from("candidate");
    const target = {
      kind: "docker_task",
      recoveryId: id,
      identityJson: JSON.stringify({ operationId: "operation-a" }),
      history: { confirmed: true },
    };
    const snapshot = {
      managedExecutions:
        mode === "related"
          ? [
              {
                tasks: [
                  { settlement: { kind: "operations", recoveryIds: [id] } },
                ],
              },
            ]
          : [],
      operations: [target],
      unresolvedRecoveries: [],
      revision: 1,
    };
    let ordinary = 0,
      scoped = 0,
      writes = 0,
      owners = 0;
    const blocked = {
      status: "blocked",
      reason: "scoped_rejected",
      lockReleased: true,
      value: null,
      currentCompletionPublication: null,
    };
    const normal = ["normal", "related", "missing_value"].includes(mode);
    const result = runInNewContext(
      body + "; completeRecovery(root,id,assertOwner,'docker_task')",
      {
        Buffer,
        root: {},
        id,
        assertOwner: () => {
          owners++;
          return mode !== "owner_lost" || owners !== 2;
        },
        writeStateSnapshot: () => ({
          status: "blocked",
          reason: "refused",
          lockReleased: true,
          snapshotConfirmed: false,
          filesystemEffectIssued: false,
        }),
        observeExecutionRecoveryRepository: () => ({
          repositoryRoot: "root",
          repositoryBinding: "binding",
        }),
        readStateSnapshot: (...args: unknown[]) => {
          ordinary++;
          assert.equal(args[11], true);
          return {
            status: normal ? "completed" : "blocked",
            reason:
              mode === "other_failure"
                ? "io_unknown"
                : normal
                  ? "observed"
                  : "coordinator_state_reentry_required",
            lockReleased: mode !== "lock_unknown",
            value:
              normal && mode !== "missing_value"
                ? { snapshot, payloadSha256: "hash" }
                : null,
            historyRows: [{ recoveryId: id, line: line.toString() }],
          };
        },
        readRecoveryState: (
          _root: unknown,
          request: { kind: string; recoveryId: string },
        ) => {
          scoped++;
          assert.equal(request.kind, "execution_completion");
          assert.equal(request.recoveryId, id);
          return mode === "normal" || mode === "pending"
            ? {
                status: "completed",
                lockReleased: true,
                value: { snapshot },
                currentCompletionPublication: {
                  before,
                  candidate,
                  historyFile: null,
                },
              }
            : blocked;
        },
        projectTaskSettlement: () => ({ cleanupConfirmed: true }),
        prepareStateHistoryLine: () => line,
        encodeStateValue: () => JSON.stringify(snapshot),
        publishRecoveryState: (input: {
          kind: string;
          before: Buffer;
          candidate: Buffer;
          operationKind: string;
        }) => {
          writes++;
          assert.equal(input.kind, "current_completion");
          assert.equal(input.operationKind, "docker_task");
          assert.deepEqual(input.before, before);
          assert.deepEqual(input.candidate, candidate);
          return {
            status: "completed",
            snapshotConfirmed: true,
            lockReleased: true,
            filesystemEffectIssued: true,
          };
        },
      },
    );
    assert.equal(ordinary, 1, mode);
    const accepted = mode === "normal" || mode === "pending";
    assert.equal(writes, accepted ? 1 : 0, mode);
    assert.equal(
      result.status,
      accepted || mode === "related" ? "completed" : "blocked",
      mode,
    );
    assert.equal(result.operationRetained === true, mode === "related", mode);
    const early = [
      "related",
      "other_failure",
      "lock_unknown",
      "owner_lost",
      "missing_value",
    ].includes(mode);
    assert.equal(scoped, early ? 0 : 1, mode);
  }
});

/**
 * Owner喪失の有限保存で明示不存在と古い世代を区別する。
 * @trace PRL-IT-005
 * @precondition 今回Rootの初期状態とhandoff済みTaskだけを準備する。
 * @stimulus 欠測集合、別Operation、明示不存在、遷移後の再要求を与える。
 * @observation 保存bytes・世代と元Task相関、再要求拒否時の不変性。
 * @oracle 欠測を不存在へせず、既存の世代・全活動集合の拒否を維持する。
 * @cleanup fixture終了hookで今回Rootだけを回収する。
 * @boundary EM公開保存と実Filesystem。AI・Dockerなし。
 */
test("Owner喪失の有限保存は明示不存在だけをreadyへ戻す", (t) => {
  const { root, state } = fixture(t);
  const cap = { directory: root };
  assert.equal(
    domain.initializeExecutionStore(cap, "binding-a").status,
    "completed",
  );
  assert.equal(
    domain.createQueue(cap, "binding-a", {
      kind: "scheduled",
      input: [
        {
          queueId: "queue-a",
          projectId: state.projectId,
          milestoneId: state.milestoneId,
          requestHash: "a".repeat(64),
          originLane: "interactive",
          repositoryRevision: state.repositoryRevision,
          scopeHash: "b".repeat(64),
        },
        initialExecutionInput(state),
      ],
    }).status,
    "completed",
  );
  assert.deepEqual(
    domain.readProjectExecutionState(cap, "binding-a", state.projectId).value,
    state,
  );
  const reserved = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    {
      kind: "task_start",
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      authorityBindingId: "authority-a",
    },
    state.generation,
  );
  assert.equal(reserved.status, "completed");
  if (reserved.status !== "completed")
    throw Error("fixture_reservation_failed");
  const prepared = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    {
      kind: "task_handoff",
      projectId: state.projectId,
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
    },
    reserved.value.generation,
  );
  assert.equal(prepared.status, "completed");
  if (prepared.status !== "completed") throw Error("fixture_handoff_failed");
  const command = {
    kind: "task_owner_loss" as const,
    projectId: state.projectId,
    bindings: [
      {
        operationId: "operation-a",
        status: "verified_absent" as const,
        recoveryId: null,
      },
    ],
  };
  const file = path.join(root, ".crdd/execution-model/state.json");
  const before = fs.readFileSync(file);
  for (const bindings of [
    [],
    [{ ...command.bindings[0], operationId: "other" }],
  ])
    assert.equal(
      domain.saveProjectExecutionState(
        cap,
        "binding-a",
        { ...command, bindings } as typeof command,
        prepared.value.generation,
      ).status,
      "blocked",
    );
  assert.deepEqual(fs.readFileSync(file), before);
  const saved = domain.saveProjectExecutionState(
    cap,
    "binding-a",
    command,
    prepared.value.generation,
  );
  assert.equal(saved.status, "completed");
  if (saved.status !== "completed") throw Error("fixture_owner_loss_failed");
  assert.equal(saved.value.generation, prepared.value.generation + 1);
  assert.equal(saved.value.tasks[0]?.state, "ready");
  assert.equal(saved.value.tasks[0]?.operationId, null);
  assert.deepEqual(saved.taskUpdateTaskIds, ["task-a"]);
  const bytes = fs.readFileSync(file);
  assert.equal(
    domain.saveProjectExecutionState(
      cap,
      "binding-a",
      command,
      prepared.value.generation,
    ).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), bytes);
});
