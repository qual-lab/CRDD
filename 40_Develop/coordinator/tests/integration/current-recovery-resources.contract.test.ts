/**
 * 現在回収Ownerと実DI Executorの固定Process要求を結合する。
 * @packageDocumentation
 * @responsibility ID保存・読戻し前の削除と観測不能の成功化を反証する。
 * @trace ERB-IT-014
 * @trace PRL-IT-005
 * @level IT
 * @scope 本番回収・Coordinator待機本文、公開Resource値操作、Writer応答と有限CLI・Process・Directory代役。実Writer／CASの検証は別の保存結合試験。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収Owner→Docker Isolation。
 */

import { canonicalJson } from "../support/contract-assertions.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { isDeepStrictEqual, types } from "node:util";
import { runInNewContext, runInThisContext } from "node:vm";
import { applyResourceEvent } from "../../../execution-model/src/index.ts";
import {
  snapshotJsonValue,
  snapshotPlainRecord,
} from "../../src/input/snapshot.ts";
import { createRecoveryFixture } from "../support/recovery.ts";

const source = fs.readFileSync(
  new URL("../../src/execution/recovery.ts", import.meta.url),
  "utf8",
);
const start = source.indexOf("function projectResourceTarget(");
assert.ok(start >= 0);

/**
 * 実行中の作成Intent／Receiptが入力捕捉を通ってからWriterへ届くことを確認する。
 * @responsibility 保存用codecを入力コピーに使わず、不正入力時のWriter到達を拒否する。
 * @trace ERB-IT-014
 * @precondition 本番通知本文と有限の現在Owner・Writer応答を使う。
 * @stimulus 正規通知、Getter・Proxy・toJSON・循環を作成前と応答後へ渡す。
 * @observation Writer回数、元入力との参照分離、固定event／keyと未知実行数。
 * @oracle 正規入力だけ一度到達し、不正入力はWriter0・未知実行0となる。
 * @cleanup 外部資源なし。
 * @boundary 通知搬送の論理試験。WriterやDockerの成立は示さない。
 */
test("資源作成通知の入力捕捉拒否はIntentとReceiptのWriterへ到達しない", () => {
  const names = [
    "markRuntimeOwnedDockerResourceSubmission",
    "recordRuntimeOwnedDockerResourceReceipt",
  ];
  const body = names
    .map((name) => {
      const begin = source.indexOf(`export function ${name}(`);
      const end = source.indexOf("\n/**", begin);
      assert.ok(begin >= 0 && end > begin);
      return stripTypeScriptTypes(
        source.slice(begin, end).replace("export function", "function"),
      );
    })
    .join("\n");
  for (const name of names) {
    let calls = 0,
      traps = 0;
    const capability = {},
      management = {};
    const received: Record<string, unknown>[] = [];
    const api = runInNewContext(`${body}; ({ ${names.join(",")} })`, {
      snapshotJsonValue,
      isDeepStrictEqual,
      CREATE_PURPOSES: new Set(["create_provider"]),
      durableRecord: (input: unknown) =>
        input === capability
          ? { managementCapability: management, recoveryId: "exact" }
          : null,
      saveOperationCheckpoint: (
        owner: unknown,
        recoveryId: unknown,
        request: { kind: string; value: Record<string, unknown> },
      ) => {
        assert.equal(owner, management);
        assert.equal(recoveryId, "exact");
        assert.equal(request.kind, "resource");
        received.push(request.value);
        calls++;
        return {
          status: "completed",
          snapshotConfirmed: true,
          lockReleased: true,
        };
      },
    }) as Record<string, (...args: unknown[]) => boolean>;
    const invoke = api[name];
    assert.ok(invoke);
    const nested = { resources: [] };
    assert.equal(
      invoke(capability, "create_provider", {
        snapshot: nested,
        event: "foreign",
        key: "foreign",
      }),
      true,
    );
    assert.equal(calls, 1);
    assert.equal(
      received[0]?.event,
      name === names[0] ? "submission" : "receipt",
    );
    assert.equal(received[0]?.key, "create_provider");
    assert.deepEqual(received[0]?.snapshot, nested);
    assert.notEqual(received[0]?.snapshot, nested);
    const getter = Object.defineProperty({}, "snapshot", {
      get() {
        traps++;
        return {};
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
    for (const input of [getter, proxy, toJSON, cycle])
      assert.equal(invoke(capability, "create_provider", input), false);
    assert.equal(calls, 1);
    assert.equal(traps, 0);
  }
});

/**
 * 退役処理と既存checkpoint本文を結合し、保存候補と読戻し境界を反証する。
 * @responsibility 旧Ownerの退役と資源清掃・Process終了の主張を混同しない。
 * @trace ERB-IT-014
 * @precondition 実Owner確認・退役・checkpoint本文とメモリWriterを使う。
 * @stimulus active／unknown、既退役、偽造、各排他・元版・保存・読戻しの失敗。
 * @observation Writer候補、Owner確認、元版、保存後本文と停止field。
 * @oracle 対象phaseとownerEffect以外は維持し、不明後の再入場はWriter0。
 * @cleanup N/A: 実Filesystem・Docker・Processを作成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 回収Owner→既存checkpoint Writer。
 */
test("現在回収退役: 元版・三排他・保存読戻しと非対象保持", () => {
  const ownerStart = source.indexOf("function assertCurrentRecoveryOwner(");
  const ownerEnd = source.indexOf(
    "function resolveCurrentRecoveryHostToken(",
    ownerStart,
  );
  const checkpointStart = source.indexOf(
    "export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(",
  );
  const checkpointEnd = source.indexOf(
    "export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(",
    checkpointStart,
  );
  assert.ok(
    ownerStart >= 0 && ownerEnd > ownerStart && checkpointEnd > checkpointStart,
  );
  const actualBody = stripTypeScriptTypes(
    `${source.slice(ownerStart, ownerEnd)}\n${source.slice(checkpointStart, checkpointEnd)}`.replaceAll(
      "export function",
      "function",
    ),
  );
  for (const scenario of [
    "active",
    "unknown",
    "disabled",
    "absent_disabled",
    "late_phase",
    "forged",
    "copy",
    "root",
    "marker",
    "lock_0",
    "lock_1",
    "lock_2",
    "lock_throw",
    "changed",
    "read_unlock",
    "writer_false",
    "writer_throw",
    "writer_unlock",
    "readback_revision",
    "readback_hash",
    "readback_throw",
    "completion_disabled",
    "completion_changed",
    "completion_blocked",
    "completion_null",
    "completion_unlock",
    "completion_throw",
    "completion_active",
    "history_disabled",
    "history_blocked",
    "history_null",
    "history_changed",
    "history_unlock",
    "history_throw",
    "history_active",
    "history_owner_lost",
    "history_host_present",
    "history_publication",
    "history_normal_unlock",
    "history_normal_throw",
  ]) {
    const operation = {
      kind: "docker_task",
      recoveryId: "exact",
      phase: scenario === "late_phase" ? "awaiting_delivery" : "executing",
      execution: {
        ownerEffect:
          scenario.includes("disabled") ||
          (scenario.startsWith("history_") && scenario !== "history_active") ||
          (scenario.startsWith("completion_") &&
            scenario !== "completion_active")
            ? "disabled"
            : scenario === "unknown"
              ? "unknown"
              : "active",
        providerStart: "not_started",
        providerSend: "not_issued",
        sharedWrite: "not_issued",
        workspaceReusable: false,
      },
      lease: "held",
      primaryFailure: { stage: "create", reason: "first" },
      outcome: null,
      summarySha256: null,
      resources: [{ request: "unknown" }],
      host: { cleanup: "pending" },
      dockerRestart: null,
      history: { status: "pending" },
    };
    const original = {
      revision: 7,
      operations: [operation, { recoveryId: "other", untouched: [1, 2, 3] }],
    };
    let saved = structuredClone(original);
    const before = Buffer.from(`${JSON.stringify(original)}\n`);
    const capability = {},
      root = {};
    let ownerLive = true;
    const record = {
      kind: "recovery",
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      completionPending: scenario.startsWith("completion_"),
      hostCleanup:
        scenario === "absent_disabled" ||
        scenario.startsWith("completion_") ||
        (scenario.startsWith("history_") && scenario !== "history_host_present")
          ? "absent"
          : "present",
      hostCleanupPublication: scenario === "history_publication" ? {} : null,
      hostToken: "token",
      hostRoot: "host",
      hostNonce: "nonce",
      hostGeneration: {},
      rootCapability: root,
      recoveryId: "exact",
      before,
      repository: { revalidate: () => scenario !== "root" && ownerLive },
      locks: [0, 1, 2].map((i) => ({
        assertLive() {
          if (scenario === "lock_throw") throw new Error("lock");
          return scenario !== `lock_${i}`;
        },
      })),
    };
    let writes = 0,
      reads = 0,
      completionReads = 0,
      historyReads = 0;
    const retire = runInNewContext(
      `${actualBody}; retireRuntimeOwnedDockerTaskExecutionOwner`,
      {
        Buffer,
        Object,
        JSON,
        historyRepositoryInput: (input: unknown) => ({
          root: input,
          historyRetentionDays: 30,
          revalidate: () => true,
        }),
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        snapshotJsonValue,
        isDeepStrictEqual,
        canonicalJson: JSON.stringify,
        verifyHostOperationRecoveryGeneration() {
          if (scenario === "marker") throw new Error("marker");
        },
        loadHostRecoveryRecordByToken: () => ({ parsed: { nonce: "nonce" } }),
        observeHostRecoveryCleanup: () => ({
          root: "absent",
          marker: "absent",
        }),
        readRecoveryState(
          receivedRoot: unknown,
          request: { kind: string; recoveryId?: unknown } = { kind: "current" },
        ) {
          const receivedId = request.recoveryId;
          if (request.kind === "execution_completion") {
            assert.equal(record.completionPending, true);
            assert.equal(receivedRoot, root);
            assert.equal(receivedId, record.recoveryId);
            completionReads++;
            if (scenario === "completion_throw")
              throw new Error("completion read");
            const snapshot = structuredClone(saved);
            if (scenario === "completion_changed") snapshot.revision++;
            return {
              status:
                scenario === "completion_blocked" ? "blocked" : "completed",
              lockReleased: scenario !== "completion_unlock",
              value:
                scenario === "completion_null"
                  ? null
                  : {
                      snapshot,
                      sourceText: `${JSON.stringify(snapshot)}\n`,
                      payloadSha256: "saved",
                    },
            };
          }
          if (request.kind === "execution_history") {
            assert.equal((receivedRoot as { root: unknown }).root, root);
            assert.equal(receivedId, record.recoveryId);
            historyReads++;
            if (scenario === "history_throw")
              throw new Error("history read failed");
            const snapshot = structuredClone(saved);
            if (scenario === "history_changed") snapshot.revision++;
            if (scenario === "history_owner_lost") ownerLive = false;
            return {
              status: scenario === "history_blocked" ? "blocked" : "completed",
              lockReleased: scenario !== "history_unlock",
              value:
                scenario === "history_null"
                  ? null
                  : {
                      snapshot,
                      sourceText: `${JSON.stringify(snapshot)}\n`,
                      payloadSha256: "saved",
                    },
            };
          }
          assert.equal(record.completionPending, false);
          assert.equal(receivedRoot, root);
          reads++;
          if (scenario.startsWith("history_")) {
            if (scenario === "history_normal_throw")
              throw new Error("normal read failed");
            return {
              status: "blocked",
              lockReleased: scenario !== "history_normal_unlock",
              value: null,
            };
          }
          if (reads > 1 && scenario === "readback_throw")
            throw new Error("readback");
          const snapshot = structuredClone(saved);
          if (
            scenario === "changed" ||
            (reads > 1 && scenario === "readback_revision")
          )
            snapshot.revision++;
          return {
            status: "completed",
            lockReleased: scenario !== "read_unlock",
            value: {
              snapshot,
              sourceText: `${JSON.stringify(snapshot)}\n`,
              payloadSha256:
                reads > 1 && scenario === "readback_hash" ? "changed" : "saved",
            },
          };
        },

        saveRecoveryCheckpoint: (
          repository: unknown,
          recoveryId: string,
          before: Buffer,
          request: Parameters<
            typeof import("../../../execution-model/src/index.ts").saveRecoveryCheckpoint
          >[3],
        ) => {
          switch (request.kind) {
            default:
              if (!("value" in request))
                throw new Error("unexpected recovery kind");
              return Reflect.apply(
                (
                  repository: unknown,
                  recoveryId: string,
                  prior: Buffer,
                  kind: string,
                  candidate: Record<string, unknown>,
                  owner: () => boolean,
                ) => {
                  writes++;
                  assert.equal(repository, record.repository);
                  assert.equal(recoveryId, "exact");
                  assert.equal(kind, "lifecycle");
                  assert.ok(prior.equals(before));
                  assert.equal(owner(), true);
                  const expected = {
                    phase: "settling",
                    lease: operation.lease,
                    execution: {
                      ...operation.execution,
                      ownerEffect: "disabled",
                    },
                    primaryFailure: operation.primaryFailure,
                    outcome: null,
                    summarySha256: null,
                  };
                  assert.deepEqual(
                    JSON.parse(JSON.stringify(candidate)),
                    expected,
                  );
                  if (scenario === "writer_throw") throw new Error("writer");
                  saved = {
                    ...saved,
                    revision: 8,
                    operations: [
                      {
                        ...operation,
                        ...JSON.parse(JSON.stringify(candidate)),
                      },
                      original.operations[1],
                    ],
                  } as typeof saved;
                  return {
                    status:
                      scenario === "writer_false" ? "blocked" : "completed",
                    snapshotConfirmed: true,
                    lockReleased: scenario !== "writer_unlock",
                    revision: 8,
                    payloadSha256: "saved",
                  };
                },
                undefined,
                [
                  repository,
                  recoveryId,
                  before,
                  request.kind,
                  request.value,
                  request.assertOwner,
                ],
              );
          }
        },
      },
    ) as (key: unknown) => boolean;
    const success = [
      "active",
      "unknown",
      "disabled",
      "absent_disabled",
      "completion_disabled",
      "history_disabled",
    ].includes(scenario);
    assert.equal(
      retire(
        scenario === "forged"
          ? {}
          : scenario === "copy"
            ? { ...capability }
            : capability,
      ),
      success,
      scenario,
    );
    const writeExpected = [
      "active",
      "unknown",
      "writer_false",
      "writer_throw",
      "writer_unlock",
      "readback_revision",
      "readback_hash",
      "readback_throw",
    ].includes(scenario);
    assert.equal(writes, writeExpected ? 1 : 0, scenario);
    if (record.completionPending) {
      assert.equal(reads, 0, scenario);
      assert.equal(completionReads, 1, scenario);
      assert.equal(writes, 0, scenario);
      assert.equal(
        record.cleanupUnknown,
        scenario === "completion_unlock",
        scenario,
      );
      assert.deepEqual(saved, original);
    } else assert.equal(completionReads, 0, scenario);
    assert.equal(
      historyReads,
      scenario.startsWith("history_") &&
        ![
          "history_host_present",
          "history_publication",
          "history_normal_unlock",
          "history_normal_throw",
        ].includes(scenario)
        ? 1
        : 0,
      scenario,
    );
    if (scenario.startsWith("history_")) {
      assert.equal(writes, 0, scenario);
      assert.deepEqual(saved, original, scenario);
      assert.equal(
        record.cleanupUnknown,
        ["history_unlock", "history_normal_unlock"].includes(scenario),
        scenario,
      );
    }
    if (["active", "unknown"].includes(scenario)) {
      const expected = structuredClone(original);
      expected.revision = 8;
      expected.operations[0] = {
        ...operation,
        phase: "settling",
        execution: { ...operation.execution, ownerEffect: "disabled" },
      };
      assert.deepEqual(saved, expected);
      assert.ok(
        record.before.equals(Buffer.from(`${JSON.stringify(expected)}\n`)),
      );
    }
    if (writeExpected && !success) {
      assert.equal(record.persistenceFailed, true, scenario);
      assert.equal(retire(capability), false, scenario);
      assert.equal(writes, 1, scenario);
    }
  }
});

/**
 * 回収Ownerの外側排他解放を、終端保存前の独立した事実として確認する。
 * @responsibility 全逆順解放、一回性と過去不明の保持を本番本文で反証する。
 * @trace ERB-IT-014
 * @precondition メモリ内のOwnerと模擬排他だけを使用する。
 * @stimulus 正常、false、例外、過去不明、偽造、別種別と再入場を渡す。
 * @observation 各releaseの順序・回数、Ownerの閉鎖と確認field、元本文。
 * @oracle 全解放成功かつ過去不明なしの場合だけ確認し、終了保存は発行しない。
 * @cleanup N/A: 外部資源・Process・ファイルを作成しない。
 * @boundary ERB-IT-014=Direct Boundary: 本番解放関数と既存Owner Map。
 */
test("現在回収排他: 全逆順・一回性・不明保持を終端処理から分離する", () => {
  const releaseStart = source.indexOf(
    "export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(",
  );
  assert.ok(releaseStart >= 0 && start > releaseStart);
  const releaseBody = stripTypeScriptTypes(
    source.slice(releaseStart, start).replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "false",
    "throw",
    "past_unknown",
    "reentrant",
  ]) {
    const capability = Object.freeze({});
    const calls: number[] = [];
    const before = Buffer.from("unchanged-current-state");
    const record = {
      kind: "recovery",
      closed: false,
      cleanupUnknown: scenario === "past_unknown",
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
      before,
      locks: [0, 1, 2].map((index) => ({
        release() {
          calls.push(index);
          assert.equal(record.closed, true);
          assert.equal(record.releaseAttempted, true);
          assert.equal(record.releaseConfirmed, false);
          if (scenario === "reentrant")
            assert.equal(release(capability), false);
          if (index === 1 && scenario === "throw") throw new Error("synthetic");
          return index !== 1 || scenario !== "false";
        },
      })),
    };
    const map = new WeakMap<object, typeof record>([[capability, record]]);
    const release = runInNewContext(
      `${releaseBody}; releaseRuntimeOwnedDockerTaskRecoveryPreparation`,
      { dockerRecoveryPreparations: map },
    ) as (value: unknown) => boolean;
    for (const invalid of [null, undefined, 0, "owner", {}, { ...capability }])
      assert.equal(release(invalid), false);
    assert.deepEqual(calls, []);
    const confirmed = scenario === "normal" || scenario === "reentrant";
    assert.equal(release(capability), confirmed, scenario);
    assert.deepEqual(calls, [2, 1, 0], scenario);
    assert.equal(record.releaseConfirmed, confirmed, scenario);
    assert.equal(record.cleanupUnknown, !confirmed, scenario);
    assert.equal(record.finalizationAttempted, false);
    assert.equal(record.before, before);
    assert.equal(before.toString(), "unchanged-current-state");
    assert.equal(release(capability), false);
    assert.deepEqual(calls, [2, 1, 0]);
    const restartKey = Object.freeze({});
    const restart = { ...record, kind: "restart", closed: false };
    map.set(restartKey, restart);
    assert.equal(release(restartKey), false);
    assert.equal(restart.closed, false);
    assert.deepEqual(calls, [2, 1, 0]);
  }
});

/**
 * 回収終了保存の一回性と解放前・不明時のWriter非発行を確認する。
 * @responsibility 解放済みOwnerが固定Writer以外へ復活しない条件を反証する。
 * @trace ERB-IT-014
 * @precondition メモリ内のOwnerと模擬Writerだけを使用する。
 * @stimulus 各前提欠測、正常、保存失敗・例外と同Owner再入場を渡す。
 * @observation Writer回数、Owner確認closureの有効期間と終了試行field。
 * @oracle 全前提成立時だけ一回発行し、返却後はclosureも失効する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-IT-014=Direct Boundary: 本番finalizer→模擬Writer。
 */
test("現在回収終端: 解放確認・一回性・Writer借用の短命性", () => {
  const finalizerStart = source.indexOf(
    "export function finalizeRuntimeOwnedDockerTaskRecoveryPreparation(",
  );
  assert.ok(finalizerStart >= 0 && start > finalizerStart);
  const finalizerBody = stripTypeScriptTypes(
    source
      .slice(finalizerStart, start)
      .replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "write_failed",
    "write_throw",
    "open",
    "unattempted",
    "unconfirmed",
    "retried",
    "persistence_failed",
    "cleanup_unknown",
    "host_present",
    "host_publication",
    "wrong_kind",
    "root_changed",
    "root_present",
    "marker_present",
    "root_unknown",
    "marker_unknown",
    "observe_throw",
    "late_root_present",
    "late_marker_present",
    "late_root_unknown",
    "late_marker_unknown",
  ]) {
    const capability = Object.freeze({});
    const record = {
      kind: scenario === "wrong_kind" ? "restart" : "recovery",
      closed: scenario !== "open",
      releaseAttempted: scenario !== "unattempted",
      releaseConfirmed: scenario !== "unconfirmed",
      finalizationAttempted: scenario === "retried",
      persistenceFailed: scenario === "persistence_failed",
      cleanupUnknown: scenario === "cleanup_unknown",
      hostCleanup: scenario === "host_present" ? "present" : "absent",
      hostCleanupPublication: scenario === "host_publication" ? {} : null,
      repository: { revalidate: () => scenario !== "root_changed" },
      recoveryId: "exact-recovery",
      snapshot: { operations: [] },
      hostToken: "fixed-token",
      hostRoot: "fixed-root",
      before: Buffer.from("fixed-before"),
    };
    let writes = 0;
    let physicalWrites = 0,
      observations = 0;
    let borrowed: (() => boolean) | null = null;
    const finalize = runInNewContext(
      `${finalizerBody}; finalizeRuntimeOwnedDockerTaskRecoveryPreparation`,
      {
        withHistoryRetention() {
          assert.fail("履歴なし終了で保持設定を読まない");
        },
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        observeHostRecoveryCleanup(token: string, root: string) {
          assert.equal(token, record.hostToken);
          assert.equal(root, record.hostRoot);
          observations++;
          if (scenario === "observe_throw")
            throw new Error("synthetic observation");
          const fault =
            scenario.startsWith("late_") && observations === 1
              ? "normal"
              : scenario.replace("late_", "");
          return {
            root:
              fault === "root_present"
                ? "present"
                : fault === "root_unknown"
                  ? "unknown"
                  : "absent",
            marker:
              fault === "marker_present"
                ? "present"
                : fault === "marker_unknown"
                  ? "unknown"
                  : "absent",
          };
        },
        saveRecoveryCheckpoint: (
          repository: unknown,
          recoveryId: string,
          before: Buffer,
          request: Parameters<
            typeof import("../../../execution-model/src/index.ts").saveRecoveryCheckpoint
          >[3],
        ) => {
          switch (request.kind) {
            case "terminal":
              return Reflect.apply(
                (
                  repository: unknown,
                  recoveryId: string,
                  before: Buffer,
                  assertOwner: () => boolean,
                ) => {
                  writes++;
                  assert.equal(repository, record.repository);
                  assert.equal(recoveryId, record.recoveryId);
                  assert.equal(before, record.before);
                  assert.equal(record.finalizationAttempted, true);
                  borrowed = assertOwner;
                  if (scenario === "write_throw") throw new Error("synthetic");
                  if (!assertOwner() || !assertOwner())
                    return {
                      status: "blocked",
                      snapshotConfirmed: false,
                      lockReleased: true,
                    };
                  physicalWrites++;
                  return {
                    status:
                      scenario === "write_failed" || !assertOwner()
                        ? "blocked"
                        : "completed",
                    snapshotConfirmed:
                      scenario !== "write_failed" && assertOwner(),
                    lockReleased: true,
                  };
                },
                undefined,
                [repository, recoveryId, before, request.assertOwner],
              );
            default:
              throw new Error("unexpected checkpoint " + request.kind);
          }
        },
      },
    ) as (value: unknown) => { status: string; snapshotConfirmed: boolean };
    for (const invalid of [null, undefined, {}, { ...capability }])
      assert.equal(finalize(invalid).snapshotConfirmed, false);
    const attempted = [
      "normal",
      "write_failed",
      "write_throw",
      "root_changed",
      "root_present",
      "marker_present",
      "root_unknown",
      "marker_unknown",
      "observe_throw",
      "late_root_present",
      "late_marker_present",
      "late_root_unknown",
      "late_marker_unknown",
    ].includes(scenario);
    const result = finalize(capability);
    assert.equal(result.snapshotConfirmed, scenario === "normal", scenario);
    if (attempted)
      assert.equal(record.persistenceFailed, scenario !== "normal", scenario);
    assert.equal(writes, attempted ? 1 : 0, scenario);
    assert.equal(
      physicalWrites,
      scenario === "normal" || scenario === "write_failed" ? 1 : 0,
      scenario,
    );
    if (scenario.startsWith("late_")) assert.equal(observations, 2, scenario);
    if (borrowed !== null) assert.equal((borrowed as () => boolean)(), false);
    assert.equal(finalize(capability).snapshotConfirmed, false);
    assert.equal(writes, attempted ? 1 : 0);
    assert.equal(record.before.toString(), "fixed-before");
  }
});

/**
 * 未確認履歴からの終端再入場だけ保持設定を搬送する。
 * @responsibility 設定欠測・途中変更の拒否と非履歴終了の読取り0を反証する。
 * @trace ERB-IT-014
 * @precondition 本番finalizerと設定接続本文、有限の保存・設定観測を使う。
 * @stimulus exact未確認履歴、確認済み、他操作、履歴なしと設定不正・変更を渡す。
 * @observation 設定読取り回数、Writer入力と再検証結果、元版本文。
 * @oracle exact未確認履歴だけ現在設定を搬送し、不正・変更なら成功にしない。
 * @cleanup N/A: 実File・Processを作成しない。
 * @boundary 設定搬送の論理確認。実pending再入場はHost結合試験が所有する。
 */
test("現在回収終端: 未確認履歴だけ保持設定を搬送する", () => {
  const begin = source.indexOf(
    "export function finalizeRuntimeOwnedDockerTaskRecoveryPreparation(",
  );
  const finalizer = stripTypeScriptTypes(
    source.slice(begin, start).replaceAll("export function", "function"),
  );
  const persistence = fs.readFileSync(
    new URL("../../src/execution/persistence.ts", import.meta.url),
    "utf8",
  );
  const connection = stripTypeScriptTypes(
    persistence
      .slice(
        persistence.indexOf("export function historyRepositoryInput"),
        persistence.indexOf(
          "export function verifyRuntimePersistenceRepository",
        ),
      )
      .replaceAll("export function", "function"),
  );
  for (const scenario of [
    "pending",
    "invalid",
    "changed",
    "confirmed",
    "other",
    "none",
  ]) {
    const capability = {},
      root = {};
    const before = Buffer.from("fixed-before");
    const record = {
      kind: "recovery",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: true,
      finalizationAttempted: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null,
      recoveryId: "exact-recovery",
      rootCapability: root,
      repository: { revalidate: () => true },
      before,
      snapshot: {
        operations: [
          {
            kind: "docker_task",
            recoveryId:
              scenario === "other" ? "other-recovery" : "exact-recovery",
            history:
              scenario === "none"
                ? null
                : { confirmed: scenario === "confirmed" },
          },
        ],
      },
    };
    let reads = 0,
      writes = 0;
    const pending = ["pending", "invalid", "changed"].includes(scenario);
    const finalize = runInNewContext(
      `${connection}; ${finalizer}; finalizeRuntimeOwnedDockerTaskRecoveryPreparation`,
      {
        Buffer,
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        readCoordinatorConfig(received: unknown) {
          assert.equal(received, root);
          reads++;
          return scenario === "invalid"
            ? { status: "blocked" }
            : {
                status: "ready",
                config: {
                  historyRetentionDays:
                    scenario === "changed" && reads > 1 ? 31 : 30,
                },
              };
        },
        observeHostRecoveryCleanup: () => ({
          root: "absent",
          marker: "absent",
        }),
        saveRecoveryCheckpoint(
          repository: {
            historyRetentionDays?: number | null;
            revalidate(expected?: number): boolean;
          },
          id: string,
          original: Buffer,
          request: { kind: string; assertOwner(): boolean },
        ) {
          writes++;
          assert.equal(id, record.recoveryId);
          assert.equal(original, before);
          assert.equal(request.kind, "terminal");
          assert.equal(request.assertOwner(), true);
          let confirmed = true;
          if (pending) {
            assert.equal(
              repository.historyRetentionDays,
              scenario === "invalid" ? null : 30,
            );
            confirmed =
              repository.historyRetentionDays === 30 &&
              repository.revalidate(30);
          } else {
            assert.equal(repository, record.repository);
            assert.equal(reads, 0);
          }
          return {
            status: confirmed ? "completed" : "blocked",
            snapshotConfirmed: confirmed,
            lockReleased: true,
          };
        },
      },
    );
    assert.equal(
      finalize(capability).snapshotConfirmed,
      !["invalid", "changed"].includes(scenario),
      scenario,
    );
    assert.equal(writes, 1);
    assert.equal(reads, pending ? (scenario === "invalid" ? 1 : 2) : 0);
    assert.equal(record.before, before);
    assert.equal(before.toString(), "fixed-before");
  }
});

/**
 * 解放済みOwnerの履歴接続を二段以内へ限定する。
 * @responsibility 中間保存失敗後の再発行と返却後のOwner借用を反証する。
 * @trace ERB-IT-014
 * @precondition 本番Wrapper本文と模擬履歴Driverだけを使用する。
 * @stimulus 初期・既確認、各段失敗／例外、排他不明、Host再出現と未収束を渡す。
 * @observation 呼出し回数、Effect累積、sticky拒否と借用失効。
 * @oracle 最大二段、失敗後同Owner再発行0、全体Task・配送完成を主張しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary ERB-IT-014=Direct Boundary: 私有回収Map→履歴Driver。
 */
test("現在回収履歴: 有界二段・失敗後停止・Effect保持", () => {
  const historyStart = source.indexOf(
    "export function completeRuntimeOwnedDockerTaskRecoveryHistory(",
  );
  assert.ok(historyStart >= 0 && historyStart < start);
  const historyBody = stripTypeScriptTypes(
    source
      .slice(historyStart, start)
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  for (const scenario of [
    "normal",
    "already_confirmed",
    "first_failed",
    "second_failed",
    "second_throw",
    "lock_unknown",
    "host_present",
    "unsettled",
    "unreleased",
  ]) {
    const capability = Object.freeze({});
    const record = {
      kind: "recovery",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: scenario !== "unreleased",
      finalizationAttempted: true,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null,
      repository: { revalidate: () => true },
      recoveryId: "exact",
      hostToken: "token",
      hostRoot: "root",
    };
    let calls = 0;
    const borrowed: (() => boolean)[] = [];
    const complete = runInNewContext(
      `${historyBody}; completeRuntimeOwnedDockerTaskRecoveryHistory`,
      {
        withHistoryRetention: (repository: object) => ({
          ...repository,
          historyRetentionDays: 30,
        }),
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        observeHostRecoveryCleanup(token: string, root: string) {
          assert.equal(token, "token");
          assert.equal(root, "root");
          return {
            root: scenario === "host_present" ? "present" : "absent",
            marker: "absent",
          };
        },
        advanceOwnedRecoveryHistory(
          repository: unknown,
          recoveryId: string,
          owner: () => boolean,
        ) {
          calls++;
          borrowed.push(owner);
          assert.deepEqual(
            { ...(repository as object) },
            {
              ...record.repository,
              historyRetentionDays: 30,
            },
          );
          assert.equal(recoveryId, "exact");
          if (scenario === "second_throw" && calls === 2)
            throw new Error("synthetic");
          const failed =
            !owner() ||
            scenario === "first_failed" ||
            scenario === "lock_unknown" ||
            (scenario === "second_failed" && calls === 2);
          return {
            status: failed ? "blocked" : "completed",
            snapshotConfirmed: !failed,
            lockReleased: scenario !== "lock_unknown",
            historyConfirmed:
              !failed &&
              scenario !== "unsettled" &&
              (scenario === "already_confirmed" || calls === 2),
            filesystemEffectIssued: !failed && scenario !== "already_confirmed",
          };
        },
      },
    ) as (capability: unknown) => {
      status: string;
      historyConfirmed: boolean;
      filesystemEffectIssued: boolean;
    };
    assert.equal(complete({}).status, "blocked");
    assert.equal(calls, 0);
    const result = complete(capability);
    const completed = scenario === "normal" || scenario === "already_confirmed";
    assert.equal(
      result.historyConfirmed,
      completed,
      `${scenario}: ${JSON.stringify(result)}`,
    );
    assert.equal(result.status, completed ? "completed" : "blocked", scenario);
    assert.equal(
      calls,
      scenario === "unreleased"
        ? 0
        : ["normal", "second_failed", "second_throw", "unsettled"].includes(
              scenario,
            )
          ? 2
          : 1,
      scenario,
    );
    assert.equal(
      result.filesystemEffectIssued,
      ["normal", "second_failed", "second_throw", "unsettled"].includes(
        scenario,
      ),
      scenario,
    );
    for (const owner of borrowed) assert.equal(owner(), false);
    if (!completed) {
      const beforeCalls = calls;
      assert.equal(complete(capability).status, "blocked");
      assert.equal(calls, beforeCalls);
    }
    assert.equal(record.cleanupUnknown, scenario === "lock_unknown");
  }
});

/**
 * 認証不明終了の保存と保持版の更新を同じ観測へ結合する。
 * @responsibility 保存または読戻し未確認で旧資源証拠を進めない。
 * @trace ERB-IT-014
 * @precondition 本番回収本文と有限の保存・技術通知代役を使う。
 * @stimulus 保存拒否、古い読戻し、版・Hash差、解放不明と正常を与える。
 * @observation 元本文・保持Snapshot・停止状態と回収結果。
 * @oracle 全確認後だけ同じ新Snapshotと本文を採用し、未確認時は両方を保持する。
 * @cleanup 外部資源なし。
 * @boundary 論理接続の反証であり、実Docker・認証・Filesystem成立は示さない。
 */
test("認証不明終了後の保持版は保存とfresh読戻しの共同確認後だけ更新する", async () => {
  const begin = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskResources(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export async function", "async function"),
  );
  for (const fault of [
    "none",
    "save",
    "read",
    "stale",
    "revision",
    "hash",
    "unlock",
  ]) {
    const key = {},
      root = {};
    let snapshot = {
      revision: 1,
      operations: [
        {
          kind: "docker_task",
          recoveryId: "exact",
          resources: {
            checkpoints: [
              { submission: "intent_saved", observation: "unobserved" },
            ],
          },
        },
      ],
    };
    const beforeSnapshot = snapshot;
    const record = {
      kind: "recovery",
      rootCapability: root,
      recoveryId: "exact",
      hostToken: "host",
      hostGeneration: {},
      hostCleanupPublication: null,
      repository: {},
      before: Buffer.from(`${JSON.stringify(snapshot)}\n`),
      snapshot,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
    };
    const before = Buffer.from(record.before);
    let saves = 0;
    const run = runInNewContext(
      `${body}; recoverRuntimeOwnedDockerTaskResources`,
      {
        Buffer,
        Object,
        Error,
        dockerRecoveryPreparations: new WeakMap([[key, record]]),
        assertCurrentRecoveryOwner: (received: unknown) => received === key,
        snapshotJsonValue,
        isDeepStrictEqual,
        canonicalJson: JSON.stringify,
        readRecoveryState: (received: unknown) => {
          assert.equal(received, root);
          return {
            status: saves && fault === "read" ? "blocked" : "completed",
            lockReleased: !(saves && fault === "unlock"),
            value: {
              sourceText: `${JSON.stringify(saves && fault === "stale" ? beforeSnapshot : saves && fault === "revision" ? { ...snapshot, revision: 3 } : snapshot)}\n`,
              snapshot:
                saves && fault === "stale"
                  ? beforeSnapshot
                  : saves && fault === "revision"
                    ? { ...snapshot, revision: 3 }
                    : snapshot,
              payloadSha256: saves && fault === "hash" ? "wrong" : "saved-hash",
            },
          };
        },
        borrowHostRecoveryManagementDirectory: () => ({
          directory: "fixture",
          assertCurrent: () => true,
        }),
        areTaskResourcesSettled: () => false,
        canCloseUnknownAuthentication: () => true,
        projectResourceTarget: () => ({
          resources: { resources: [{ key: "create_subscription_auth_probe" }] },
        }),
        saveUnknownAuthenticationClosureStage: (
          _repository: unknown,
          id: string,
          bytes: Buffer,
          rounds: unknown,
          assertOwner: () => boolean,
        ) => {
          assert.equal(id, "exact");
          assert.deepEqual(bytes, before);
          assert.equal(assertOwner(), true);
          assert.equal(
            JSON.stringify(rounds),
            JSON.stringify([
              { round: 1, name: "absent", name_label: "absent" },
              { round: 2, name: "absent", name_label: "absent" },
            ]),
          );
          saves++;
          if (fault === "save")
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          const previousOperation = snapshot.operations[0];
          assert.ok(previousOperation);
          snapshot = {
            ...snapshot,
            revision: 2,
            operations: [
              {
                ...previousOperation,
                resources: {
                  checkpoints: [
                    { submission: "intent_saved", observation: "absent" },
                  ],
                },
              },
            ],
          };
          return {
            status: "completed",
            snapshotConfirmed: true,
            lockReleased: true,
            revision: 2,
            payloadSha256: "saved-hash",
          };
        },
      },
    ) as (
      owner: unknown,
      cleanup: unknown,
      inspect: unknown,
    ) => Promise<{ status: string }>;
    const result = await run(
      key,
      (
        _target: unknown,
        callbacks: {
          onResourcesClosed: (snapshot: unknown, observations: unknown) => void;
        },
      ) => ({
        cancel: async () => false,
        completion: Promise.resolve().then(() => {
          callbacks.onResourcesClosed({}, []);
          return {
            cleanup: { configCleanupConfirmed: true, confirmed: false },
            processTerminationConfirmed: true,
            failure: { reason: "docker_task_recovery_resource_unconfirmed" },
          };
        }),
      }),
      () => ({
        status: "completed",
        configCleanupConfirmed: true,
        resources: [
          {
            key: "create_subscription_auth_probe",
            absenceObservations: ["absent", "absent"],
          },
        ],
      }),
    );
    assert.equal(saves, 1, fault);
    assert.equal(
      result.status,
      fault === "none" ? "completed" : "blocked",
      fault,
    );
    if (fault === "none") {
      assert.equal(record.snapshot, snapshot);
      assert.equal(
        record.snapshot.operations[0]?.resources.checkpoints[0]?.observation,
        "absent",
      );
      assert.deepEqual(
        record.before,
        Buffer.from(`${JSON.stringify(snapshot)}\n`),
      );
    } else {
      assert.equal(record.snapshot, beforeSnapshot, fault);
      assert.deepEqual(record.before, before, fault);
      assert.equal(record.persistenceFailed, true, fault);
    }
  }
});

/**
 * 既に不存在のHostを未要求欄から確認保存する順序を反証する。
 * @responsibility pending保存前後の拒否と物理処置0を確認する。
 * @trace ERB-IT-014
 * @precondition 本番清掃関数本文とメモリ内の保存Owner代役を使う。
 * @stimulus pending保存失敗・例外、保存後Owner失効、正常の四形。
 * @observation pending／confirmed順序、本文、物理処置要求数。
 * @oracle pending成功とfresh Owner確認なしにconfirmedへ進まず、Host物理処置は0。
 * @cleanup N/A: VM内だけで実資源を作らない。
 * @boundary 現在回収Owner→既存Host checkpoint／清掃確定Writer。
 */
test("既Host不存在: 未要求からpendingを経て確認し物理処置しない", () => {
  const start = source.indexOf(
    "export function cleanupRuntimeOwnedDockerTaskHost(",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end)).replace(
    "export function",
    "function",
  );
  for (const scenario of [
    "normal",
    "pending_failed",
    "pending_throw",
    "owner_lost_after_pending",
  ]) {
    const capability = Object.freeze({});
    const initial = {
      kind: "docker_task",
      recoveryId: "exact",
      host: {
        currentToken: "token",
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      execution: { ownerEffect: "disabled" },
    };
    let snapshot: { revision: number; operations: [typeof initial] } = {
      revision: 1,
      operations: [initial],
    };
    /**
     * 合成Snapshotを比較用JSON本文へ符号化する。
     * @responsibility 合成Snapshotを比較用JSON本文へ符号化する。
     * @trace ERB-IT-014
     * @precondition 同試験の閉じたsnapshot。
     * @stimulus JSON.stringifyを適用する。
     * @observation 固定JSON文字列。
     * @oracle 差替え前後の本文一致を同じ符号化で検査する。
     * @cleanup N/A: 文字列生成のみ。
     * @boundary VMfixtureの期待byte生成で実保存なし。
     */
    const encode = (value: unknown) => JSON.stringify(value);
    /**
     * Snapshotの保存形式byteを再構成する。
     * @responsibility Snapshotの保存形式byteを再構成する。
     * @trace ERB-IT-014
     * @precondition 同じsnapshotとJSON符号化関数。
     * @stimulus JSON末尾に改行を加えてBufferにする。
     * @observation 比較対象の全文byte。
     * @oracle 拒否時の本文変化を部分field比較で見落とさない。
     * @cleanup N/A: Bufferだけを生成する。
     * @boundary 局所保存byte比較。実File作成なし。
     */
    const bytes = () => Buffer.from(`${encode(snapshot)}\n`);
    const record = {
      kind: "recovery",
      hostCleanup: "absent",
      hostCleanupPublication: null,
      recoveryId: "exact",
      hostToken: "token",
      repository: { repositoryBinding: "binding" },
      before: bytes(),
      persistenceFailed: false,
      cleanupUnknown: false,
    };
    const stages: string[] = [];
    let physical = 0;
    const environment = {
      Buffer,
      dockerRecoveryPreparations: new WeakMap([[capability, record]]),
      snapshotJsonValue,
      isDeepStrictEqual,
      canonicalJson: encode,
      areTaskResourcesSettled: () => true,
      assertCurrentRecoveryOwner: () =>
        !(scenario === "owner_lost_after_pending" && stages.length > 0),
      readRecoveryState: () => ({
        status: "completed",
        lockReleased: true,
        value: {
          snapshot,
          sourceText: `${encode(snapshot)}\n`,
          payloadSha256: `hash-${snapshot.revision}`,
        },
      }),
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint: (
        _key: unknown,
        kind: string,
        value: (typeof snapshot.operations)[0]["host"],
      ) => {
        assert.equal(kind, "host");
        assert.equal(value.cleanup, "pending");
        stages.push("pending");
        if (scenario === "pending_throw")
          throw new Error("fixture_pending_failure");
        if (scenario === "pending_failed") return false;
        snapshot = {
          revision: snapshot.revision + 1,
          operations: [{ ...snapshot.operations[0], host: value }],
        };
        record.before = bytes();
        return true;
      },
      saveRecoveryCheckpoint: (
        repository: unknown,
        recoveryId: string,
        before: Buffer,
        request: Parameters<
          typeof import("../../../execution-model/src/index.ts").saveRecoveryCheckpoint
        >[3],
      ) => {
        switch (request.kind) {
          case "host_cleanup":
            return Reflect.apply(
              (
                _repository: unknown,
                _id: unknown,
                _before: unknown,
                owner: () => boolean,
              ) => {
                assert.equal(owner(), true);
                assert.equal(snapshot.operations[0].host.cleanup, "pending");
                stages.push("confirmed");
                snapshot = {
                  revision: snapshot.revision + 1,
                  operations: [
                    {
                      ...snapshot.operations[0],
                      host: {
                        ...snapshot.operations[0].host,
                        cleanup: "confirmed",
                      },
                    },
                  ],
                };
                return {
                  status: "completed",
                  snapshotConfirmed: true,
                  lockReleased: true,
                  revision: snapshot.revision,
                  payloadSha256: `hash-${snapshot.revision}`,
                };
              },
              undefined,
              [
                repository,
                recoveryId,
                before,
                request.assertAbsentOwner,
                request.publication,
              ],
            );
          default:
            throw new Error("unexpected checkpoint " + request.kind);
        }
      },
      recoverOwnedOperationDirectories: () => {
        physical++;
        throw new Error("unexpected_host_effect");
      },
      loadHostRecoveryRecordByToken: () => {
        physical++;
        throw new Error("unexpected_host_load");
      },
    };
    const cleanup = runInNewContext(
      `${body}; cleanupRuntimeOwnedDockerTaskHost`,
      environment,
    );
    assert.equal(cleanup(capability), scenario === "normal", scenario);
    assert.deepEqual(
      stages,
      scenario === "normal" ? ["pending", "confirmed"] : ["pending"],
      scenario,
    );
    assert.equal(physical, 0, scenario);
    if (scenario !== "normal")
      assert.notEqual(snapshot.operations[0].host.cleanup, "confirmed");
  }
});

/**
 * 既Host不存在で使用できるcheckpointを既存host pendingだけに限定する。
 * @responsibility 資源・結果の書換えと未終端操作への保存を拒否する。
 * @trace ERB-IT-014
 * @precondition 本番checkpoint本文とメモリReader／Writerを使用する。
 * @stimulus 正常なpending、別token、別field、別kind、非終端操作を渡す。
 * @observation 保存要求数、Owner確認、保存後の停止状態。
 * @oracle 完全一致するhost pending以外の保存要求は0。
 * @cleanup N/A: VM内で実資源を作らない。
 * @boundary 回収Owner→既存checkpoint Writer。
 */
test("既Host不存在checkpoint: 同じHostのpendingだけを保存する", () => {
  const start = source.indexOf(
    "export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end)).replace(
    "export function",
    "function",
  );
  for (const scenario of [
    "normal",
    "token",
    "extra",
    "resource",
    "unsettled",
    "already_pending",
    "owner",
    "writer_failed",
    "readback_failed",
    "readback_stale",
    "readback_unlock",
    "readback_sha",
    "readback_version",
    "getter",
    "proxy",
  ]) {
    const host = {
      currentToken: "token",
      pendingTransitionJson: null,
      cleanup: scenario === "already_pending" ? "pending" : "not_requested",
    };
    const snapshot = {
      revision: 1,
      operations: [{ kind: "docker_task", recoveryId: "exact", host }],
    };
    const capability = {};
    const record = {
      kind: "recovery",
      hostCleanup: "absent",
      hostCleanupPublication: null,
      recoveryId: "exact",
      hostToken: "token",
      repository: { repositoryBinding: "binding" },
      before: Buffer.from(JSON.stringify(snapshot)),
      snapshot: structuredClone(snapshot),
      persistenceFailed: false,
      cleanupUnknown: false,
    };
    const before = Buffer.from(record.before);
    const beforeSnapshot = record.snapshot;
    let writes = 0;
    const persist = runInThisContext(
      `(environment) => { const { Buffer, dockerRecoveryPreparations, snapshotJsonValue, isDeepStrictEqual, canonicalJson, assertCurrentRecoveryOwner, coordinatorReleasedTaskCanObserveHostAbsence, saveRecoveryCheckpoint, readRecoveryState } = environment; ${body}; return persistRuntimeOwnedDockerTaskRecoveryCheckpoint; }`,
    )({
      Buffer,
      dockerRecoveryPreparations: new WeakMap([[capability, record]]),
      snapshotJsonValue,
      isDeepStrictEqual,
      canonicalJson: (value: unknown) =>
        canonicalJson(JSON.parse(JSON.stringify(value))),
      assertCurrentRecoveryOwner: () => scenario !== "owner",
      coordinatorReleasedTaskCanObserveHostAbsence: () =>
        scenario !== "unsettled",
      saveRecoveryCheckpoint: (
        repository: unknown,
        recoveryId: string,
        before: Buffer,
        request: Parameters<
          typeof import("../../../execution-model/src/index.ts").saveRecoveryCheckpoint
        >[3],
      ) => {
        switch (request.kind) {
          default:
            if (!("value" in request))
              throw new Error("unexpected recovery kind");
            return Reflect.apply(
              (
                _repository: unknown,
                _id: unknown,
                _before: unknown,
                _kind: unknown,
                value: typeof host,
                owner: () => boolean,
              ) => {
                assert.equal(owner(), true);
                writes++;
                snapshot.revision++;
                const operation = snapshot.operations[0];
                assert.ok(operation);
                operation.host = value;
                return {
                  status:
                    scenario === "writer_failed" ? "blocked" : "completed",
                  snapshotConfirmed: true,
                  lockReleased: true,
                  revision: snapshot.revision,
                  payloadSha256: "hash",
                };
              },
              undefined,
              [
                repository,
                recoveryId,
                before,
                request.kind,
                request.value,
                request.assertOwner,
              ],
            );
        }
      },
      readRecoveryState: () => ({
        status: scenario === "readback_failed" ? "blocked" : "completed",
        lockReleased: scenario !== "readback_unlock",
        value: {
          sourceText: `${canonicalJson(scenario === "readback_stale" ? beforeSnapshot : scenario === "readback_version" ? { ...snapshot, revision: snapshot.revision + 1 } : snapshot)}\n`,
          snapshot:
            scenario === "readback_stale"
              ? beforeSnapshot
              : scenario === "readback_version"
                ? { ...snapshot, revision: snapshot.revision + 1 }
                : snapshot,
          payloadSha256:
            scenario === "readback_sha" ? "different-hash" : "hash",
        },
      }),
    });
    const value = {
      ...host,
      cleanup: "pending",
      ...(scenario === "token" ? { currentToken: "other" } : {}),
      ...(scenario === "extra" ? { other: true } : {}),
    };
    let traps = 0;
    if (scenario === "getter")
      Object.defineProperty(value, "unexpected", {
        get() {
          traps++;
          return "forbidden";
        },
      });
    const input =
      scenario === "proxy"
        ? new Proxy(value, {
            ownKeys() {
              traps++;
              return [];
            },
          })
        : value;
    assert.equal(
      persist(capability, scenario === "resource" ? "resource" : "host", input),
      scenario === "normal",
      scenario,
    );
    assert.equal(traps, 0, scenario);
    if (scenario === "normal") {
      assert.equal(record.snapshot, snapshot);
      assert.deepEqual(
        record.before,
        Buffer.from(`${canonicalJson(snapshot)}\n`),
      );
      assert.equal(record.snapshot.operations[0]?.host.cleanup, "pending");
    } else {
      assert.equal(record.snapshot, beforeSnapshot, scenario);
      assert.deepEqual(record.before, before, scenario);
    }
    assert.equal(
      writes,
      scenario === "normal" ||
        scenario === "writer_failed" ||
        scenario.startsWith("readback_")
        ? 1
        : 0,
      scenario,
    );
  }
});

/**
 * 現在Rootの回収組立てを、固定段階と全解放の順序で反証する。
 * @responsibility 一次失敗・取消・既回収を後続処置やTask完了へ丸めない。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と既存下位APIの固定模擬を使用する。
 * @stimulus 各段階の停止／例外、解放false／例外、六つの取消点、既Host不存在を渡す。
 * @observation 呼出し順序、解放回数、確認field、元参照と内部準備キー。
 * @oracle 失敗後の次段0、取得後は全解放一回、元失敗と解放失敗を独立保持する。
 * @cleanup N/A: 外部ProcessやFilesystem資源を作らない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収組立て→技術／保存Owner。
 */
test("現在回収組立て: 順序・一次失敗・段階間取消", async () => {
  const begin = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskFromCurrentRepository(",
  );
  const finish = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskResources(",
    begin,
  );
  assert.ok(begin >= 0 && finish > begin);
  const driverBody = stripTypeScriptTypes(
    source
      .slice(begin, finish)
      .replaceAll("export async function", "async function")
      .replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "already_absent",
    "host_publication",
    "invalid_id",
    "invalid_signal",
    "proxy_signal",
    "undefined_signal",
    "pre_cancel",
    "prepare_failed",
    "retirement_failed",
    "retirement_cancelled",
    "resources_failed",
    "resources_throw",
    "absence_failed",
    "host_failed",
    "release_false",
    "release_throw",
    "resources_failed_release_false",
    "terminal_failed",
    "terminal_throw",
    "terminal_unlock_failed",
    "history_failed",
    "history_throw",
    "history_unlock_failed",
    "delivery_failed",
    "delivery_throw",
    "delivery_unlock_failed",
    "delivery_unconfirmed_pending",
    "durable_delivery",
    "cancel_1",
    "cancel_2",
    "cancel_3",
    "cancel_4",
    "cancel_5",
    "cancel_6",
  ]) {
    const capability = Object.freeze({}),
      root = Object.freeze({});
    const record = {
      kind: "recovery",
      hostCleanup: ["already_absent", "host_publication"].includes(scenario)
        ? "absent"
        : "present",
      hostCleanupPublication: scenario === "host_publication" ? {} : null,
      before: Buffer.from("current"),
      snapshot: {
        operations: [
          {
            kind: "docker_task",
            recoveryId: "exact",
            host: {
              cleanup: scenario === "already_absent" ? "confirmed" : "pending",
            },
          },
        ],
      },
      repository: { repositoryBinding: "binding" },
      recoveryId: "exact",
      persistenceFailed: false,
    };
    const events: string[] = [];
    const retirementEvents: string[] = [];
    let retired = false;
    let retirementYieldPending = false;
    const controller = new AbortController();
    let proxyTraps = 0;
    const proxySignal = new Proxy(controller.signal, {
      get() {
        proxyTraps++;
        throw new Error("forbidden signal get");
      },
      getPrototypeOf() {
        proxyTraps++;
        throw new Error("forbidden signal prototype");
      },
      set() {
        proxyTraps++;
        throw new Error("forbidden signal set");
      },
      has() {
        proxyTraps++;
        throw new Error("forbidden signal has");
      },
    });
    let yields = 0;
    if (scenario === "pre_cancel") controller.abort();
    const driver = runInNewContext(
      `${driverBody}; recoverRuntimeOwnedDockerTaskFromCurrentRepository`,
      {
        AbortSignal,
        types,
        Object,
        Buffer,
        parseDockerTaskRecoveryId: (token: unknown) =>
          token === "invalid" ? null : { token: "exact" },
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        prepareRuntimeOwnedDockerTaskRecovery(
          token: string,
          receivedRoot: unknown,
        ) {
          events.push("prepare");
          assert.equal(token, "exact");
          assert.equal(receivedRoot, root);
          return scenario === "prepare_failed"
            ? {
                status: "blocked",
                reason: "fixture_prepare_failed",
                cleanupConfirmed: false,
              }
            : { status: "prepared", capability };
        },
        async setImmediate() {
          if (retirementYieldPending) {
            retirementYieldPending = false;
            retirementEvents.push("yield_after_retirement");
            if (scenario === "retirement_cancelled") controller.abort();
            return;
          }
          events.push("yield");
          yields++;
          if (scenario === `cancel_${yields}`) controller.abort();
        },
        retireRuntimeOwnedDockerTaskExecutionOwner(key: unknown) {
          assert.equal(key, capability);
          assert.deepEqual(events, ["prepare", "yield"]);
          retirementEvents.push("retire");
          retired = scenario !== "retirement_failed";
          retirementYieldPending = retired;
          return retired;
        },
        executeRuntimeOwnedDockerTaskResourceRecovery(key: unknown) {
          assert.equal(retired, true);
          assert.deepEqual(retirementEvents, [
            "retire",
            "yield_after_retirement",
          ]);
          events.push("resources");
          assert.equal(key, capability);
          if (scenario === "resources_throw")
            throw new Error("fixture_resources_throw");
          const completed = !scenario.startsWith("resources_failed");
          return {
            status: completed ? "completed" : "blocked",
            reason: "fixture_resources_failed",
            dockerCleanupConfirmed: completed,
            configCleanupConfirmed: true,
          };
        },
        confirmRuntimeOwnedDockerTaskHostAbsence(key: unknown) {
          events.push("absence");
          assert.equal(key, capability);
          return scenario !== "absence_failed";
        },
        cleanupRuntimeOwnedDockerTaskHost(key: unknown) {
          events.push("host");
          assert.equal(key, capability);
          return scenario !== "host_failed";
        },
        releaseRuntimeOwnedDockerTaskRecoveryPreparation(key: unknown) {
          events.push("release");
          assert.equal(key, capability);
          if (scenario === "release_throw")
            throw new Error("fixture_release_throw");
          return !["release_false", "resources_failed_release_false"].includes(
            scenario,
          );
        },
        finalizeRuntimeOwnedDockerTaskRecoveryPreparation(key: unknown) {
          events.push("terminal");
          assert.equal(key, capability);
          if (scenario === "terminal_throw") throw new Error("fixture");
          return {
            status: scenario === "terminal_failed" ? "blocked" : "completed",
            snapshotConfirmed: scenario !== "terminal_failed",
            lockReleased: scenario !== "terminal_unlock_failed",
          };
        },
        completeRuntimeOwnedDockerTaskRecoveryHistory(key: unknown) {
          events.push("history");
          assert.equal(key, capability);
          if (scenario === "history_throw") throw new Error("fixture");
          return {
            status: scenario === "history_failed" ? "blocked" : "completed",
            historyConfirmed: scenario !== "history_failed",
            lockReleased: scenario !== "history_unlock_failed",
            reason: "fixture_history_failed",
          };
        },
        registerRuntimeOwnedDockerTaskRecoveryDelivery(key: unknown) {
          events.push("delivery");
          assert.equal(key, capability);
          if (scenario === "delivery_throw") throw new Error("fixture");
          return {
            status: scenario === "delivery_failed" ? "blocked" : "completed",
            snapshotConfirmed: ![
              "delivery_failed",
              "delivery_unconfirmed_pending",
            ].includes(scenario),
            lockReleased: scenario !== "delivery_unlock_failed",
            deliveryPending: [
              "durable_delivery",
              "delivery_unlock_failed",
              "delivery_unconfirmed_pending",
            ].includes(scenario),
            reason: "fixture_delivery_failed",
          };
        },
        safeRecoveryReason: (error: Error, fallback: string) =>
          error.message || fallback,
      },
    ) as (
      token: unknown,
      root: unknown,
      signal?: AbortSignal,
    ) => Promise<{
      status: string;
      reason: string;
      recoveryId: string | null;
      cleanupReason: string | null;
      operationRetained: boolean;
      taskRecoveryCompleted: boolean;
      historyConfirmed: boolean;
      dockerCleanupConfirmed: boolean;
      hostCleanupConfirmed: boolean;
      locksReleased: boolean;
      deliveryPending: boolean;
      preparation: unknown;
    }>;
    const result = await driver(
      scenario === "invalid_id" ? "invalid" : "exact",
      root,
      scenario === "invalid_signal"
        ? ({} as AbortSignal)
        : scenario === "proxy_signal"
          ? proxySignal
          : scenario === "undefined_signal"
            ? undefined
            : controller.signal,
    );
    const successful = [
      "normal",
      "already_absent",
      "host_publication",
      "undefined_signal",
      "durable_delivery",
    ].includes(scenario);
    assert.equal(result.status, successful ? "completed" : "blocked", scenario);
    assert.equal(result.operationRetained, true);
    assert.equal(result.taskRecoveryCompleted, false);
    assert.equal(result.preparation, successful ? capability : null, scenario);
    assert.equal(
      result.recoveryId,
      scenario === "invalid_id" ? null : "exact",
      scenario,
    );
    const acquired = ![
      "invalid_id",
      "invalid_signal",
      "proxy_signal",
      "pre_cancel",
      "prepare_failed",
    ].includes(scenario);
    assert.equal(
      events.filter((event) => event === "release").length,
      acquired ? 1 : 0,
      scenario,
    );
    for (const phase of ["terminal", "history", "delivery"])
      if (events.includes(phase))
        assert.ok(events.indexOf("release") < events.indexOf(phase), scenario);
    if (scenario === "normal")
      assert.deepEqual(events, [
        "prepare",
        "yield",
        "resources",
        "yield",
        "absence",
        "yield",
        "host",
        "release",
        "yield",
        "terminal",
        "yield",
        "history",
        "yield",
        "delivery",
      ]);
    if (scenario === "already_absent") {
      assert.equal(events.includes("resources"), false);
      assert.equal(events.includes("absence"), false);
      assert.equal(events.includes("host"), false);
    }
    if (scenario === "host_publication") {
      assert.equal(events.includes("resources"), false);
      assert.equal(events.includes("absence"), false);
      assert.equal(events.includes("host"), true);
    }
    if (scenario.startsWith("resources_failed")) {
      assert.equal(result.reason, "fixture_resources_failed");
      assert.equal(events.includes("host"), false);
      assert.equal(events.includes("terminal"), false);
    }
    if (scenario === "resources_failed_release_false")
      assert.equal(
        result.cleanupReason,
        "docker_task_recovery_release_unconfirmed",
      );
    if (scenario.startsWith("cancel_") || scenario === "pre_cancel")
      assert.equal(result.reason, "docker_task_recovery_cancelled");
    if (["delivery_failed", "delivery_throw", "cancel_6"].includes(scenario))
      assert.equal(result.historyConfirmed, true);
    if (!acquired)
      assert.equal(
        events.some((event) => event !== "prepare"),
        false,
      );
    assert.equal(proxyTraps, 0, scenario);
    // 各行は「理由、exact呼出し列、Docker、Host、解放、履歴、配送待ち」。
    const completeEvents =
      "prepare yield resources yield absence yield host release yield terminal yield history yield delivery";
    const matrix: Record<
      string,
      readonly [string, string, boolean, boolean, boolean, boolean, boolean]
    > = {
      normal: [
        "docker_task_recovery_runtime_state_settled",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      undefined_signal: [
        "docker_task_recovery_runtime_state_settled",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      durable_delivery: [
        "docker_task_recovery_runtime_state_settled",
        completeEvents,
        true,
        true,
        true,
        true,
        true,
      ],
      already_absent: [
        "docker_task_recovery_runtime_state_settled",
        "prepare yield yield release yield terminal yield history yield delivery",
        true,
        true,
        true,
        true,
        false,
      ],
      host_publication: [
        "docker_task_recovery_runtime_state_settled",
        "prepare yield yield host release yield terminal yield history yield delivery",
        true,
        true,
        true,
        true,
        false,
      ],
      invalid_id: [
        "docker_task_recovery_id_invalid",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      invalid_signal: [
        "docker_task_recovery_cancellation_invalid",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      proxy_signal: [
        "docker_task_recovery_cancellation_invalid",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      pre_cancel: [
        "docker_task_recovery_cancelled",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      prepare_failed: [
        "fixture_prepare_failed",
        "prepare",
        false,
        false,
        false,
        false,
        false,
      ],
      retirement_failed: [
        "docker_task_recovery_owner_retirement_unconfirmed",
        "prepare yield release",
        false,
        false,
        true,
        false,
        false,
      ],
      retirement_cancelled: [
        "docker_task_recovery_cancelled",
        "prepare yield release",
        false,
        false,
        true,
        false,
        false,
      ],
      resources_failed: [
        "fixture_resources_failed",
        "prepare yield resources release",
        false,
        false,
        true,
        false,
        false,
      ],
      resources_throw: [
        "fixture_resources_throw",
        "prepare yield resources release",
        false,
        false,
        true,
        false,
        false,
      ],
      absence_failed: [
        "docker_task_recovery_host_absence_unconfirmed",
        "prepare yield resources yield absence release",
        true,
        false,
        true,
        false,
        false,
      ],
      host_failed: [
        "docker_task_recovery_host_cleanup_unconfirmed",
        "prepare yield resources yield absence yield host release",
        true,
        false,
        true,
        false,
        false,
      ],
      release_false: [
        "docker_task_recovery_release_unconfirmed",
        "prepare yield resources yield absence yield host release",
        true,
        true,
        false,
        false,
        false,
      ],
      release_throw: [
        "docker_task_recovery_release_unconfirmed",
        "prepare yield resources yield absence yield host release",
        true,
        true,
        false,
        false,
        false,
      ],
      resources_failed_release_false: [
        "fixture_resources_failed",
        "prepare yield resources release",
        false,
        false,
        false,
        false,
        false,
      ],
      terminal_failed: [
        "docker_task_recovery_terminal_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal",
        true,
        true,
        true,
        false,
        false,
      ],
      terminal_throw: [
        "docker_task_recovery_terminal_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal",
        true,
        true,
        true,
        false,
        false,
      ],
      terminal_unlock_failed: [
        "docker_task_recovery_terminal_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal",
        true,
        true,
        false,
        false,
        false,
      ],
      history_failed: [
        "fixture_history_failed",
        "prepare yield resources yield absence yield host release yield terminal yield history",
        true,
        true,
        true,
        false,
        false,
      ],
      history_throw: [
        "docker_task_recovery_history_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal yield history",
        true,
        true,
        true,
        false,
        false,
      ],
      history_unlock_failed: [
        "fixture_history_failed",
        "prepare yield resources yield absence yield host release yield terminal yield history",
        true,
        true,
        false,
        true,
        false,
      ],
      delivery_failed: [
        "fixture_delivery_failed",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      delivery_throw: [
        "docker_task_recovery_delivery_unconfirmed",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      delivery_unlock_failed: [
        "fixture_delivery_failed",
        completeEvents,
        true,
        true,
        false,
        true,
        true,
      ],
      delivery_unconfirmed_pending: [
        "fixture_delivery_failed",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      cancel_1: [
        "docker_task_recovery_cancelled",
        "prepare yield release",
        false,
        false,
        true,
        false,
        false,
      ],
      cancel_2: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield release",
        true,
        false,
        true,
        false,
        false,
      ],
      cancel_3: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield release",
        true,
        false,
        true,
        false,
        false,
      ],
      cancel_4: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield host release yield",
        true,
        true,
        true,
        false,
        false,
      ],
      cancel_5: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield host release yield terminal yield",
        true,
        true,
        true,
        false,
        false,
      ],
      cancel_6: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield host release yield terminal yield history yield",
        true,
        true,
        true,
        true,
        false,
      ],
    };
    const row = matrix[scenario];
    assert.ok(row, scenario);
    const expectedEvents = row[1] === "" ? [] : row[1].split(" ");
    const expectedResult = {
      status: successful ? "completed" : "blocked",
      reason: row[0],
      recoveryId: scenario === "invalid_id" ? null : "exact",
      dockerCleanupConfirmed: row[2],
      hostCleanupConfirmed: row[3],
      locksReleased: row[4],
      historyConfirmed: row[5],
      deliveryPending: row[6],
      operationRetained: true,
      taskRecoveryCompleted: false,
      cleanupReason: row[4] ? null : "docker_task_recovery_release_unconfirmed",
      preparation: successful ? capability : null,
    };
    assert.deepEqual(events, expectedEvents, scenario);
    assert.deepEqual({ ...result }, expectedResult, scenario);
    // Oracle自体が、余分な後段呼出しと確認済みfactの欠落を拒否することも固定する。
    assert.throws(() =>
      assert.deepEqual([...events, "unexpected_effect"], expectedEvents),
    );
    for (const field of [
      "dockerCleanupConfirmed",
      "hostCleanupConfirmed",
      "locksReleased",
      "historyConfirmed",
      "deliveryPending",
    ] as const)
      if (expectedResult[field])
        assert.throws(() =>
          assert.deepEqual({ ...result, [field]: false }, expectedResult),
        );
  }
});

/**
 * 現在相関解決の全数観測と明示不存在の境界を反証する。
 * @responsibility 未観測・曖昧・別consumerをabsenceへ畳まない。
 * @trace ERB-IT-014
 * @precondition 本番Resolver本文と固定現在Readerを使う。
 * @stimulus 正常、重複、欠測、旧内部ID、getter／Proxyを渡す。
 * @observation matched／absence全数、読取り回数とtrap数。
 * @oracle 完全観測だけを上位相関へ対応し、旧内部IDへfallbackしない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Reader→上位相関解決。
 */
test("現在相関Resolverは完全観測と上位相関だけを使う", () => {
  const begin = source.indexOf(
    "export function resolveRuntimeOwnedDockerTaskCurrentCorrelations(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "no_fallback",
    "missing_correlation",
    "wrong_consumer",
    "duplicate_correlation",
    "duplicate_recovery",
    "blocked",
    "unlock",
    "null",
    "throw",
    "input_duplicate",
    "input_invalid",
    "input_getter",
    "input_proxy",
    "wrong_root",
  ]) {
    const root = Object.freeze({});
    let reads = 0,
      traps = 0;
    const operations = [
      {
        kind: "docker_task",
        recoveryId: "exact",
        identityJson: JSON.stringify({
          consumer: "orchestrator",
          recoveryCorrelationId: "upper-a",
          operationId: "internal-different",
        }),
      },
    ];
    const operation = operations[0];
    assert.ok(operation);
    if (scenario === "no_fallback")
      operation.identityJson = JSON.stringify({
        consumer: "coordinator_cli",
        operationId: "upper-a",
      });
    if (scenario === "missing_correlation")
      operation.identityJson = JSON.stringify({
        consumer: "orchestrator",
        operationId: "upper-a",
      });
    if (scenario === "wrong_consumer")
      operation.identityJson = JSON.stringify({
        consumer: "workbench",
        recoveryCorrelationId: "upper-a",
      });
    if (scenario === "duplicate_correlation")
      operations.push({ ...operation, recoveryId: "other" });
    if (scenario === "duplicate_recovery")
      operations.push({
        kind: "docker_task",
        recoveryId: "exact",
        identityJson: JSON.stringify({
          consumer: "orchestrator",
          recoveryCorrelationId: "absent",
        }),
      });
    let input: unknown = ["upper-a", "absent"];
    if (scenario === "input_duplicate") input = ["upper-a", "upper-a"];
    if (scenario === "input_invalid") input = ["bad id"];
    if (scenario === "input_getter")
      Object.defineProperty(input, "0", {
        get() {
          traps++;
          throw new Error("fixture");
        },
      });
    if (scenario === "input_proxy")
      input = new Proxy(input as object, {
        get() {
          traps++;
          throw new Error("fixture");
        },
      });
    const run = runInNewContext(
      `${body}; resolveRuntimeOwnedDockerTaskCurrentCorrelations`,
      {
        Object,
        Array,
        Map,
        Set,
        JSON,
        types,
        readRecoveryState(received: unknown) {
          reads++;
          if (scenario === "throw") throw new Error("secret");
          return {
            status:
              scenario === "blocked" || received !== root
                ? "blocked"
                : "completed",
            lockReleased: scenario !== "unlock",
            value: scenario === "null" ? null : { snapshot: { operations } },
          };
        },
      },
    ) as (
      ids: unknown,
      root: unknown,
    ) => {
      status: string;
      lockReleased: boolean;
      bindings: unknown[];
      absentCorrelationIds: unknown[];
    };
    const result = run(input, scenario === "wrong_root" ? {} : root);
    assert.equal(
      result.status,
      ["normal", "no_fallback"].includes(scenario) ? "completed" : "blocked",
      scenario,
    );
    assert.equal(traps, 0, scenario);
    assert.equal(reads, scenario.startsWith("input_") ? 0 : 1, scenario);
    if (result.status === "completed") {
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.bindings)),
        scenario === "normal"
          ? [{ correlationId: "upper-a", recoveryId: "exact" }]
          : [],
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.absentCorrelationIds)),
        scenario === "normal" ? ["absent"] : ["upper-a", "absent"],
      );
    } else {
      assert.equal(result.bindings.length, 0);
      assert.equal(result.absentCorrelationIds.length, 0);
    }
    if (scenario === "unlock") assert.equal(result.lockReleased, false);
  }
});

/**
 * 通常入口向け回復組立ての固定consumerと公開結果を反証する。
 * @responsibility 技術結果の部分成立・配送方式差・終了不明を完了表示へ昇格しない。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と技術Driver／終了処理の固定模擬を使う。
 * @stimulus 技術field欠測、三consumer、未知consumer、保存失敗を渡す。
 * @observation 終了処理回数と公開結果の全fieldを観測する。
 * @oracle 共同成立した固定transientだけ一回終了し、durableは受領待ちを保持する。
 * @cleanup N/A: メモリ内だけで外部資源を生成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 技術Driver→用途別終了→公開診断。
 */
test("現在回復の公開組立て: 固定consumer・共同成立・内部値非公開", async () => {
  const begin = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskForCurrentConsumer(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export async function", "async function"),
  );
  for (const scenario of [
    "cli",
    "workbench",
    "orchestrator",
    "unknown_consumer",
    "wrong_delivery",
    "missing_owner",
    "wrong_id",
    "wrong_kind",
    "decoy",
    "dockerCleanupConfirmed",
    "hostCleanupConfirmed",
    "locksReleased",
    "historyConfirmed",
    "cleanupReason",
    "technical_blocked",
    "completion_blocked",
    "snapshotConfirmed",
    "lockReleased",
    "operationRemovalConfirmed",
    "taskRecoveryCompleted",
    "completion_throw",
  ]) {
    const key = Object.freeze({});
    const technical = {
      status: "completed",
      reason: "technical_ready",
      recoveryId: "exact",
      preparation: key,
      dockerCleanupConfirmed: true,
      hostCleanupConfirmed: true,
      locksReleased: true,
      historyConfirmed: true,
      cleanupReason: null as string | null,
      deliveryPending:
        scenario === "orchestrator" || scenario === "wrong_delivery",
      secret: "must_not_escape",
    };
    if (
      [
        "dockerCleanupConfirmed",
        "hostCleanupConfirmed",
        "locksReleased",
        "historyConfirmed",
      ].includes(scenario)
    )
      Object.assign(technical, { [scenario]: false });
    if (scenario === "cleanupReason")
      technical.cleanupReason = "release_unknown";
    if (scenario === "technical_blocked") technical.status = "blocked";
    const consumer =
      scenario === "orchestrator"
        ? "orchestrator"
        : scenario === "workbench"
          ? "workbench"
          : scenario === "unknown_consumer"
            ? "unknown"
            : "coordinator_cli";
    let calls = 0;
    const owner = {
      kind: "recovery",
      before: Buffer.from("before"),
      repository: { repositoryBinding: "binding" },
      snapshot: {
        operations: [
          {
            kind: "docker_task",
            recoveryId: "exact",
            identityJson: JSON.stringify({ consumer }),
          },
        ],
      },
    };
    const targetOperation = owner.snapshot.operations[0];
    assert.ok(targetOperation);
    if (scenario === "wrong_id") targetOperation.recoveryId = "other";
    if (scenario === "wrong_kind") targetOperation.kind = "runtime_repair";
    if (scenario === "decoy")
      owner.snapshot.operations.unshift({
        kind: "docker_task",
        recoveryId: "other",
        identityJson: JSON.stringify({ consumer: "orchestrator" }),
      });
    const run = runInNewContext(
      `${body}; recoverRuntimeOwnedDockerTaskForCurrentConsumer`,
      {
        Object,
        JSON,
        recoverRuntimeOwnedDockerTaskFromCurrentRepository: async () =>
          technical,
        dockerRecoveryPreparations: new WeakMap(
          scenario === "missing_owner" ? [] : [[key, owner]],
        ),
        getConsumerCompletionPolicy: (value: string) =>
          value === "orchestrator"
            ? "durable"
            : ["coordinator_cli", "workbench"].includes(value)
              ? "transient"
              : null,
        completeRuntimeOwnedDockerTaskTransientRecovery(received: unknown) {
          assert.equal(received, key);
          calls++;
          if (scenario === "completion_throw") throw new Error("secret");
          return {
            status: scenario === "completion_blocked" ? "blocked" : "completed",
            reason: "completion_stopped",
            snapshotConfirmed: scenario !== "snapshotConfirmed",
            lockReleased: scenario !== "lockReleased",
            operationRemovalConfirmed: scenario !== "operationRemovalConfirmed",
            taskRecoveryCompleted: scenario !== "taskRecoveryCompleted",
          };
        },
      },
    ) as () => Promise<Record<string, unknown>>;
    const result = await run();
    const normal = ["cli", "workbench", "decoy"].includes(scenario);
    assert.equal(
      result.status,
      normal
        ? "recovered"
        : scenario === "orchestrator"
          ? "awaiting_delivery"
          : "blocked",
      scenario,
    );
    assert.equal(result.taskRecoveryCompleted, normal, scenario);
    assert.equal(
      calls,
      normal ||
        scenario.startsWith("completion_") ||
        [
          "snapshotConfirmed",
          "lockReleased",
          "operationRemovalConfirmed",
          "taskRecoveryCompleted",
        ].includes(scenario)
        ? 1
        : 0,
      scenario,
    );
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        "contract",
        "status",
        "reason",
        "recoveryId",
        "dockerCleanupConfirmed",
        "hostCleanupConfirmed",
        "locksReleased",
        "historyConfirmed",
        "deliveryPending",
        "operationRetained",
        "operationRemovalConfirmed",
        "taskRecoveryCompleted",
        "cleanupReason",
      ].sort(),
      scenario,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /must_not_escape|preparation|secret|before/,
    );
    if (scenario === "lockReleased")
      assert.equal(
        result.cleanupReason,
        "docker_task_recovery_release_unconfirmed",
      );
  }
});

/**
 * 上位の技術終端判定と非同期前後照合を本番本文で反証する。
 * @responsibility 部分診断と待機中変更から上位保存・ACKへ進めない。
 * @trace ERB-IT-014
 * @trace PRL-IT-005
 * @precondition 本番Objectiveの値判定と現在境界callbackだけを使う。
 * @stimulus 各共同field差、旧形式、getter／Proxy、取消・世代・Queue差を渡す。
 * @observation 判定値とtrap数を観測する。
 * @oracle 正規耐久待ちと同じ現在境界だけを受理する。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 下位診断→上位の技術settled条件。
 */
test("Orchestrator回復はexact耐久待ちと待機後の同じ境界を要求する", () => {
  const source = fs.readFileSync(
    new URL("../../src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function exactRecoveryCompleted(");
  const end = source.indexOf("\n/**", start);
  const check = runInNewContext(
    `${stripTypeScriptTypes(source.slice(start, end))}; exactRecoveryCompleted`,
    { snapshotPlainRecord, Set, Array },
  ) as (value: unknown, kind: string, id: string) => boolean;
  const base = {
    contract: "crdd-coordinator/current-task-recovery",
    status: "awaiting_delivery",
    reason: "docker_task_recovery_durable_acceptance_pending",
    recoveryId: "exact",
    dockerCleanupConfirmed: true,
    hostCleanupConfirmed: true,
    locksReleased: true,
    historyConfirmed: true,
    deliveryPending: true,
    operationRetained: true,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: null,
  };
  assert.equal(check(base, "docker", "exact"), true);
  for (const key of Object.keys(base)) {
    const original = base[key as keyof typeof base];
    const value =
      typeof original === "boolean"
        ? !original
        : original === null
          ? "unknown"
          : "wrong";
    assert.equal(
      check({ ...base, [key]: value }, "docker", "exact"),
      false,
      key,
    );
    const absent: Record<string, unknown> = { ...base };
    delete absent[key];
    assert.equal(check(absent, "docker", "exact"), false, key);
  }
  assert.equal(check(base, "docker", "other"), false);
  assert.equal(
    check({ status: "recovered", recoveryId: null }, "docker", "exact"),
    false,
  );
  assert.equal(
    check(
      { status: "recovered", recoveryId: null },
      "runtime_process",
      "exact",
    ),
    true,
  );
  let traps = 0;
  const getter = { ...base };
  Object.defineProperty(getter, "status", {
    enumerable: true,
    get() {
      traps++;
      throw new Error("fixture");
    },
  });
  assert.equal(check(getter, "docker", "exact"), false);
  assert.equal(
    check(
      new Proxy(base, {
        get() {
          traps++;
          throw new Error("fixture");
        },
      }),
      "docker",
      "exact",
    ),
    false,
  );
  assert.equal(traps, 0);
  const boundaryStart = source.indexOf(
    "    const readCurrentRecoveryState = (",
  );
  const boundaryEnd = source.indexOf("    if (unresolvedTasks", boundaryStart);
  assert.ok(boundaryStart >= 0 && boundaryEnd > boundaryStart);
  const body = stripTypeScriptTypes(source.slice(boundaryStart, boundaryEnd));
  for (const scenario of [
    "normal",
    "cancel",
    "process",
    "state",
    "queue",
    "state_blocked",
    "queue_blocked",
    "null",
    "throw",
  ]) {
    const state = {
      generation: 5,
      tasks: [{ recoveryId: "exact", phase: "recovering" }],
    };
    const queue = {
      queueId: "queue",
      generation: 4,
      state: "recovery_required",
      resultReference: "same",
    };
    const current = runInNewContext(`${body}; readCurrentRecoveryState`, {
      JSON,
      isDeepStrictEqual,
      cancellationSignal: { aborted: scenario === "cancel" },
      recoveryProcess: "owner",
      recoveryQueue: queue,
      recoveryState: state,
      request: { projectId: "project" },
      queueId: "queue",
      dependencies: {
        processSafety: {
          getProcessInstanceIdentity: () =>
            scenario === "process" ? "other" : "owner",
        },
      },
      persistence: {
        state: {
          readState: () => {
            if (scenario === "throw") throw new Error("fixture");
            return {
              status: scenario === "state_blocked" ? "blocked" : "completed",
              value:
                scenario === "null"
                  ? null
                  : scenario === "state"
                    ? { ...state, generation: 6 }
                    : state,
            };
          },
          readQueue: () => ({
            status: scenario === "queue_blocked" ? "blocked" : "completed",
            value:
              scenario === "queue"
                ? { ...queue, resultReference: "other" }
                : queue,
          }),
        },
      },
    }) as () => unknown;
    assert.deepEqual(current(), scenario === "normal" ? state : null, scenario);
  }
});

/**
 * 耐久受領の準備読取り直前ガードを本番配置と抽出実行で反証する。
 * @responsibility callback定義だけでなく処置直前の停止が有効であることを確認する。
 * @trace PRL-IT-005
 * @precondition 本番の各try／catch blockをそのまま抽出する。
 * @stimulus 現在境界不成立と、当該ガードだけを無効化した負対照を渡す。
 * @observation 下位処置回数・模擬保存状態・拒否結果。
 * @oracle 原文は処置0、負対照は同じOracleが拒否する。
 * @cleanup N/A: メモリ内だけでProduction Sourceを変更しない。
 * @boundary PRL-IT-005=Related 2 Blocks: 上位受領前ガード→結果読取り。解除はTask保存の原子受領試験で確認する。
 */
test("耐久受領準備のガード負対照は処置ゼロOracleに拒否される", () => {
  const source = fs.readFileSync(
    new URL("../../src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("finalizeDockerAcknowledgement("), false);
  const start = source.indexOf("let acknowledgementResult: unknown;");
  const end = source.indexOf(
    "const acknowledged = snapshotPlainRecord(",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const original = source.slice(start, end);
  const guard = "if (!readCurrentRecoveryState())";
  assert.equal(original.split(guard).length, 2);
  assert.ok(
    original.indexOf(guard) <
      original.indexOf("taskRecovery.acknowledgeDocker("),
  );
  for (const bypass of [false, true]) {
    let reads = 0;
    const text = bypass ? original.replace(guard, "if (false)") : original;
    const result = runInNewContext(
      `${stripTypeScriptTypes(text)}; acknowledgementResult`,
      {
        Object,
        readCurrentRecoveryState: () => null,
        request: { projectId: "project", milestoneId: "milestone" },
        recoveryState: { generation: 3 },
        item: { taskId: "task", recoveryId: "exact" },
        settledTask: { attemptId: "attempt", operationId: "operation" },
        taskRecovery: {
          acknowledgeDocker: () => {
            reads++;
            return { status: "completed" };
          },
        },
      },
    );
    if (bypass) assert.throws(() => assert.equal(reads, 0));
    else {
      assert.equal(reads, 0);
      assert.equal(result, null);
    }
  }
});

/**
 * transient終了接続を真正な技術Ownerと一回の保存へ限定する。
 * @responsibility 不正Owner・再試行・Root／Host不明からの操作除去を拒否する。
 * @trace ERB-IT-014
 * @precondition 本番終了接続本文と既存私有Map・保存Ownerの固定模擬を使う。
 * @stimulus 各準備条件欠落、保存失敗／例外、Root／Host不明と借用再使用を渡す。
 * @observation 保存回数、終了確認、sticky失敗、借用callback失効。
 * @oracle 有効Ownerの一回だけ保存を試行し、表示・受領値を要求しない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 技術回収Owner→終了保存Owner。
 */
test("現在transient終了: genuine Owner・一回性・借用失効", () => {
  const start = source.indexOf(
    "export function completeRuntimeOwnedDockerTaskTransientRecovery(",
  );
  const end = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskResources(",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "pending_reentry",
    "closed",
    "releaseAttempted",
    "releaseConfirmed",
    "finalizationAttempted",
    "completionAttempted",
    "persistenceFailed",
    "cleanupUnknown",
    "host",
    "publication",
    "root",
    "host_present",
    "host_unknown",
    "save_failed",
    "save_unlock_failed",
    "save_throw",
    "reader_unlock_failed",
    "reader_rejected",
    "reader_throw",
    "reader_owner_expired",
    "reader_publication_missing",
  ] as const) {
    const key = Object.freeze({}),
      root = Object.freeze({});
    const record = {
      kind: "recovery",
      rootCapability: root,
      recoveryId: "exact",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: true,
      finalizationAttempted: scenario !== "pending_reentry",
      completionPending: scenario === "pending_reentry",
      completionAttempted: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null as object | null,
      hostToken: "host",
      hostRoot: "root",
      repository: { revalidate: () => scenario !== "root" },
    };
    if (
      [
        "closed",
        "releaseAttempted",
        "releaseConfirmed",
        "finalizationAttempted",
      ].includes(scenario)
    )
      Object.assign(record, { [scenario]: false });
    if (
      ["completionAttempted", "persistenceFailed", "cleanupUnknown"].includes(
        scenario,
      )
    )
      Object.assign(record, { [scenario]: true });
    if (scenario === "host") record.hostCleanup = "unknown";
    if (scenario === "publication") record.hostCleanupPublication = {};
    let calls = 0,
      borrowed: (() => boolean) | null = null;
    const complete = runInNewContext(
      `${body}; completeRuntimeOwnedDockerTaskTransientRecovery`,
      {
        Object,
        dockerRecoveryPreparations: new WeakMap([[key, record]]),
        observeHostRecoveryCleanup: () => ({
          root:
            scenario === "host_present"
              ? "present"
              : scenario === "host_unknown"
                ? "unknown"
                : "absent",
          marker: "absent",
        }),
        completeRecovery(
          receivedRoot: unknown,
          id: string,
          owner: () => boolean,
        ) {
          calls++;
          assert.equal(receivedRoot, root);
          assert.equal(id, "exact");
          borrowed = owner;
          if (scenario === "save_throw") throw new Error("fixture");
          if (scenario.startsWith("reader_"))
            return {
              status: "blocked",
              reason: [
                "reader_throw",
                "reader_owner_expired",
                "reader_publication_missing",
              ].includes(scenario)
                ? "coordinator_state_input_invalid"
                : "fixture_reader_unconfirmed",
              snapshotConfirmed: false,
              lockReleased: scenario !== "reader_unlock_failed",
              filesystemEffectIssued: false,
            };
          const confirmed = owner() && scenario !== "save_failed";
          return {
            status: confirmed ? "completed" : "blocked",
            reason: "fixture",
            snapshotConfirmed: confirmed,
            lockReleased: scenario !== "save_unlock_failed",
            filesystemEffectIssued: confirmed,
          };
        },
      },
    ) as (capability: unknown) => {
      status: string;
      operationRemovalConfirmed: boolean;
      taskRecoveryCompleted: boolean;
      filesystemEffectIssued: boolean;
      lockReleased: boolean;
      cleanupReason?: string | null;
      reason: string;
    };
    assert.equal(complete({}).filesystemEffectIssued, false);
    const result = complete(key);
    const expected = ["normal", "pending_reentry"].includes(scenario);
    assert.equal(result.status, expected ? "completed" : "blocked", scenario);
    assert.equal(result.operationRemovalConfirmed, expected, scenario);
    assert.equal(result.taskRecoveryCompleted, expected, scenario);
    const attempted = [
      "normal",
      "pending_reentry",
      "root",
      "host_present",
      "host_unknown",
      "save_failed",
      "save_unlock_failed",
      "save_throw",
      "reader_unlock_failed",
      "reader_rejected",
      "reader_throw",
      "reader_owner_expired",
      "reader_publication_missing",
    ].includes(scenario);
    assert.equal(calls, attempted ? 1 : 0, scenario);
    if (borrowed) assert.equal((borrowed as () => boolean)(), false, scenario);
    const count = calls;
    assert.equal(complete(key).filesystemEffectIssued, false, scenario);
    assert.equal(calls, count, scenario);
    if (attempted && !expected)
      assert.equal(record.persistenceFailed, true, scenario);
    if (scenario.startsWith("reader_")) {
      const unknown = scenario === "reader_unlock_failed";
      assert.equal(result.lockReleased, !unknown, scenario);
      assert.equal(record.cleanupUnknown, unknown, scenario);
      assert.equal(
        result.cleanupReason,
        unknown ? "docker_task_recovery_release_unconfirmed" : null,
        scenario,
      );
      assert.equal(
        result.reason,
        [
          "reader_throw",
          "reader_owner_expired",
          "reader_publication_missing",
        ].includes(scenario)
          ? "coordinator_state_input_invalid"
          : "fixture_reader_unconfirmed",
        scenario,
      );
      assert.equal(result.filesystemEffectIssued, false, scenario);
    }
  }
});

/**
 * 元Snapshot・必須保存・共通DI Cleanupを一つの本番経路で反証する。
 * @responsibility 旧Projection Adapterや偽ID補完を使用しない。
 * @trace ERB-IT-014
 * @boundary 実保存候補と有限CLIだけ。実Docker・AI・保持物の操作なし。
 */
test("Snapshot回収は既知Receiptと発見Receiptを同じDomain保存へ接続する", async (t) => {
  for (const missing of [false, true])
    await t.test(String(missing), async (t) => {
      const f = await createRecoveryFixture(t, missing);
      const result = await f.run();
      assert.equal(result.status, "completed", JSON.stringify(result));
      assert.equal(f.f.ids.size, 0);
      assert.ok(f.writes > 0);
      const operation = f.state.snapshot.operations[0];
      assert.ok(operation?.kind === "docker_task" && operation.resources);
      assert.ok(
        operation.resources.checkpoints.every(
          (c) => c.receiptSource !== null && c.observation === "absent",
        ),
      );
      if (missing) assert.equal(f.events[0], "save:resource");
    });
});

test("Snapshot部分回収後の別Owner再入場は保存済み不存在を再削除しない", async (t) => {
  const first = await createRecoveryFixture(t, false, true);
  let removals = 0;
  first.f.waitGate = async (argv) => {
    if (argv.includes("rm") && ++removals === 2)
      throw Error("synthetic_cleanup_response_lost");
  };
  const result = await first.run();
  assert.equal(result.status, "blocked");
  const operation = first.state.snapshot.operations[0];
  assert.ok(operation?.kind === "docker_task" && operation.resources);
  const book = operation.resources;
  const confirmed = book.checkpoints.find((c) => c.key === "container");
  assert.equal(confirmed?.observation, "absent");
  assert.ok(confirmed.absenceEvidenceSha256);
  t.mock.restoreAll();
  const next = await createRecoveryFixture(t, false, true);
  next.setBook(book);
  next.f.ids.clear();
  for (const id of first.f.ids) next.f.ids.add(id);
  const before = next.f.calls.length;
  const reentered = await next.run();
  assert.equal(reentered.status, "completed", JSON.stringify(reentered));
  assert.equal(
    next.f.calls
      .slice(before)
      .some((argv) => argv.includes("rm") && argv.includes("a".repeat(64))),
    false,
  );
  const after = next.state.snapshot.operations[0];
  assert.ok(after?.kind === "docker_task" && after.resources);
  assert.equal(
    after.resources.checkpoints.find((c) => c.key === "container")
      ?.absenceEvidenceSha256,
    confirmed.absenceEvidenceSha256,
  );
});

test("Snapshot発見IDの保存拒否・読戻し差・Owner喪失では削除しない", async (t) => {
  for (const mode of [
    "save",
    "readback",
    "owner",
    "reader_unlock",
    "borrow",
    "expired",
  ] as const)
    await t.test(mode, async (t) => {
      const f = await createRecoveryFixture(t, true),
        calls = f.f.calls.length;
      if (mode === "save") f.writeRejected = true;
      if (mode === "readback") f.staleReadback = true;
      if (mode === "owner") f.loseAfterWrite = true;
      if (mode === "reader_unlock") f.readerReleased = false;
      if (mode === "borrow") f.borrowLive = false;
      if (mode === "expired") f.live = false;
      const result = await f.run();
      assert.equal(result.status, "blocked");
      assert.ok(result.recoveryId);
      assert.equal(f.f.ids.size, 1);
      assert.equal(
        f.f.calls.slice(calls).some((argv) => argv.includes("rm")),
        false,
      );
      assert.equal(f.record.persistenceFailed, true);
    });
});

test("Snapshot回収は構成不足とProcess取消を物理成功へ丸めない", async (t) => {
  for (const mode of ["config", "identity", "cancel"] as const)
    await t.test(mode, async (t) => {
      const f = await createRecoveryFixture(t);
      const controller = new AbortController();
      if (mode === "config") f.f.configObservation = "EACCES";
      if (mode === "identity") f.f.inspectName = "foreign";
      if (mode === "cancel") controller.abort();
      const result = await f.run(controller.signal);
      assert.equal(result.status, "blocked");
      if (mode === "config") assert.equal(result.configCleanupConfirmed, false);
      else assert.equal(f.f.ids.size, 1);
    });
});

test("初回Intent前と正式未発行の回収はDI・Host借用を発行しない", async (t) => {
  for (const mode of ["initial", "not_issued"] as const)
    await t.test(mode, async (t) => {
      const f = await createRecoveryFixture(t, true);
      f.f.ids.clear();
      if (mode === "initial") f.setBook(null);
      else {
        const op = f.state.snapshot.operations[0];
        assert.ok(op?.kind === "docker_task" && op.resources);
        const next = applyResourceEvent(op.resources, {
          event: "not_issued",
          key: op.resources.checkpoints[0]?.key,
        });
        assert.ok(next);
        f.setBook(next);
      }
      const calls = f.f.calls.length;
      const result = await f.run();
      assert.equal(result.status, "completed", JSON.stringify(result));
      assert.equal(f.borrows, 0);
      assert.equal(f.f.calls.length, calls);
    });
});
/**
 * 現在回収の配送借用を同じOwnerの同期処理へ限定する。
 * @responsibility 偽キー・未解放・Host再出現と保存不明の再発行を反証する。
 * @trace ERB-IT-014
 * @precondition 本番Wrapper本文と模擬配送Writerを使う。
 * @stimulus 正常、Host present、Lock不明、保存失敗、例外、未解放を渡す。
 * @observation 呼出し回数、借用終了、sticky拒否とEffect搬送。
 * @oracle 一回の同期借用だけを認め、不明後の同Owner再発行は0。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-IT-014=Direct Boundary: 私有回収Owner→配送Writer。
 */
test("現在回収配送: 同Owner・失敗停止・借用失効", () => {
  const begin = source.indexOf(
    "export function registerRuntimeOwnedDockerTaskRecoveryDelivery(",
  );
  const end = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskResources(",
    begin,
  );
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source
      .slice(begin, end)
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  for (const scenario of [
    "normal",
    "host_present",
    "lock_unknown",
    "failed",
    "throw",
    "unreleased",
  ]) {
    const capability = Object.freeze({});
    const record = {
      kind: "recovery",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: scenario !== "unreleased",
      finalizationAttempted: true,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null,
      repository: { revalidate: () => true },
      recoveryId: "exact",
      hostToken: "token",
      hostRoot: "root",
    };
    const borrowed: Array<() => boolean> = [];
    let calls = 0;
    const register = runInNewContext(
      `${body}; registerRuntimeOwnedDockerTaskRecoveryDelivery`,
      {
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        observeHostRecoveryCleanup: () => ({
          root: scenario === "host_present" ? "present" : "absent",
          marker: "absent",
        }),
        registerOwnedRecoveryResultDelivery(
          repository: unknown,
          id: string,
          owner: () => boolean,
        ) {
          calls++;
          borrowed.push(owner);
          assert.equal(repository, record.repository);
          assert.equal(id, "exact");
          if (scenario === "throw") throw new Error("fixture");
          const confirmed = owner() && scenario === "normal";
          return {
            status: confirmed ? "completed" : "blocked",
            snapshotConfirmed: confirmed,
            lockReleased: scenario !== "lock_unknown",
            filesystemEffectIssued: scenario === "failed",
            deliveryPending: confirmed,
          };
        },
      },
    ) as (key: unknown) => { status: string; filesystemEffectIssued: boolean };
    assert.equal(register({}).status, "blocked");
    assert.equal(calls, 0);
    const result = register(capability);
    assert.equal(
      result.status,
      scenario === "normal" ? "completed" : "blocked",
      scenario,
    );
    assert.equal(
      result.filesystemEffectIssued,
      scenario === "failed",
      scenario,
    );
    for (const owner of borrowed) assert.equal(owner(), false);
    if (scenario !== "normal") {
      const prior = calls;
      assert.equal(register(capability).status, "blocked");
      assert.equal(calls, prior);
    }
    assert.equal(record.cleanupUnknown, scenario === "lock_unknown");
  }
});
