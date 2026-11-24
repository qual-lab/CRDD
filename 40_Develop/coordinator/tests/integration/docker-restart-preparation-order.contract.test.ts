/**
 * 現在状態から再起動Scopeと既存準備Ownerを結合する。
 * @packageDocumentation
 * @responsibility 旧署名・phase記録へ依存せず、対象・元版・排他・保存相関を確認する。
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope 現在Snapshot、準備Map、全Scopeの排他順、要求checkpoint。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備本文→状態Reader／Writer・既存排他の観測境界。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { isDeepStrictEqual } from "node:util";
import { runInThisContext } from "node:vm";
import {
  parseDockerTaskRecoveryId,
  type ExecutionOperationRecord,
} from "../../../execution-model/src/index.ts";
import { createResourceBookFixture } from "../../../execution-model/tests/support/resource-operation.ts";
import {
  persistDockerRestartCheckpoint,
  prepareDockerRestart,
  releaseDockerRestartPreparation,
  verifyDockerRestartPreparation,
} from "../../src/lifecycle/environment.ts";
import { snapshotJsonValue } from "../../src/lifecycle/validation.ts";
import {
  canonicalJson,
  restartRequestIdFixture,
} from "../support/contract-assertions.ts";

type DockerRestartCheckpoint = NonNullable<
  ExecutionOperationRecord["dockerRestart"]
>;

/**
 * restart preparation rejects arbitrary capability and invalid task before publicationを検証する。
 *
 * @responsibility restart preparation rejects arbitrary capability and invalid task before publicationの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart preparation rejects arbitrary capability and invalid task before publicationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("restart preparation rejects arbitrary capability and invalid task before publication", () => {
  for (const value of [null, undefined, {}, "invalid", 0]) {
    assert.equal(verifyDockerRestartPreparation(value), false);
    assert.equal(
      persistDockerRestartCheckpoint(value, {
        requestId: "a".repeat(64),
        scopeSha256: "b".repeat(64),
        request: "not_issued",
        cleanup: "not_required",
        result: null,
      }),
      false,
    );
    assert.equal(releaseDockerRestartPreparation(value), false);
  }
  const result = prepareDockerRestart("invalid", {});
  assert.equal(result.status, "blocked");
  assert.equal("capability" in result, false);
  assert.equal(result.cleanupConfirmed, true);
  if (result.status === "blocked")
    assert.equal(result.reason, "docker_restart_id_invalid");
});

const source = fs.readFileSync(
  new URL("../../src/lifecycle/environment.ts", import.meta.url),
  "utf8",
);
const body = [
  "restartScopeIncludes",
  "prepareDockerRestart",
  "verifyDockerRestartPreparation",
  "persistDockerRestartCheckpoint",
  "releaseDockerRestartPreparation",
  "finalizeDockerRestartPreparation",
]
  .map((name) => sourceDeclaration(source, name))
  .join("\n");
/**
 * 再起動の現在Scopeと独立した資源・Host・排他を用意する。
 * @responsibility 不変Sourceだけを共有し、各条件のMap・Owner・保存候補は分離する。
 * @trace ERB-IT-014
 * @boundary 再起動準備と有限Reader・Lock・Writer。実Dockerは使用しない。
 */
function fixture() {
  const first = "a".repeat(64),
    second = "b".repeat(64);
  const token = `docker-task.${first}.${first}.${first}`;
  const secondToken = `docker-task.${second}.${second}.${second}`;
  const root = Object.freeze({});
  const acquired: string[] = [],
    released: string[] = [],
    events: string[] = [];
  let reads = 0,
    writes = 0,
    rootValid = true,
    ownerLive = true;
  let changeAtRead = false,
    writerFault = false;
  let acquireFault: string | null = null,
    releaseFault: "false" | "throw" | null = null;
  let initializationFailure: { id: string; descriptorClosed: boolean } | null =
    null;
  const operation = (
    recoveryId: string,
    operationId: string,
    nonce: string,
  ) => ({
    kind: "docker_task" as const,
    recoveryId,
    identitySha256: nonce,
    identityJson: JSON.stringify({ operationId }),
    phase: "executing",
    outcome: null,
    lease: "held",
    execution: {
      ownerEffect: "active",
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    },
    resources: createResourceBookFixture(
      `crdd.coordinator.runtime=${nonce.slice(0, 16)}`,
    ),
    primaryFailure: null,
    summarySha256: null,
    dockerRestart: null as DockerRestartCheckpoint | null,
  });
  const tasks = [
    operation(token, "OP-123456", first),
    operation(secondToken, "OP-123457", second),
  ];
  const hosts = tasks.map((value) => ({
    kind: "host_operation" as const,
    operationId: JSON.parse(value.identityJson).operationId as string,
    cleanup: "not_requested",
  }));
  let snapshot = { revision: 1, operations: [...tasks, ...hosts] };
  const settledBooks = new WeakSet(tasks.map((value) => value.resources));
  const repository = Object.defineProperty(
    {
      repositoryRoot: path.resolve("fixture-root"),
      repositoryBinding: "c".repeat(64),
      revalidate: () => rootValid,
    },
    "root",
    { value: root },
  );
  const maps = new WeakMap();
  const acquire = (id: string) => {
    acquired.push(id);
    if (initializationFailure?.id === id)
      return {
        status: "blocked",
        reason: "lock_initialization_failed",
        cleanupConfirmed: false,
        descriptorClosed: initializationFailure.descriptorClosed,
      };
    if (acquireFault === id) throw Error("private acquisition detail");
    return {
      status: "acquired",
      lock: {
        assertLive: () => ownerLive,
        release: () => {
          released.push(id);
          if (releaseFault === "throw" && released.length === 1)
            throw Error("private release detail");
          return !(releaseFault === "false" && released.length === 1);
        },
      },
    };
  };
  const context = {
    Buffer,
    path,
    Object,
    Error,
    Map,
    createHash,
    snapshotJsonValue,
    isDeepStrictEqual,
    parseDockerTaskRecoveryId,
    dockerRecoveryPreparations: maps,
    normalizeDockerRestartScope: (values: string[]) =>
      Object.freeze([...new Set(values)].sort()),
    borrowCoordinatorRecoveryRepository: (candidate: unknown) =>
      candidate === root && rootValid ? repository : null,
    providerHomesDirectoryCandidate: () => path.resolve("ProviderHomes"),
    poisonExecutionProcessAfterCleanupUnknown: () =>
      events.push("process-poisoned"),
    acquireHostOperationLock: (candidate: unknown, id: string) => {
      assert.equal(candidate, root);
      return acquire(`host:${id}`);
    },
    acquireProviderHomeLock: (home: string) => acquire(`home:${home}`),
    recoveryStorageInput: (root: unknown) => root,
    readState: (
      _root: unknown,
      envelope: {
        scope: string;
        input?: { kind: string; recoveryId: string; scopeSha256: string };
      },
    ) => {
      assert.equal(envelope.scope, "recovery");
      reads++;
      if (changeAtRead && reads >= 2)
        snapshot = { ...snapshot, revision: snapshot.revision + 1 };
      const request = envelope.input;
      const selected =
        request?.kind === "restart_preparation"
          ? snapshot.operations.find(
              (value) =>
                value.kind === "docker_task" &&
                value.recoveryId === request.recoveryId,
            )
          : undefined;
      const target = selected?.kind === "docker_task" ? selected : null;
      const requestId =
        target && request
          ? restartRequestIdFixture(
              repository.repositoryBinding,
              target.identitySha256,
              target.recoveryId,
              request.scopeSha256,
            )
          : null;
      const prior = target?.dockerRestart;
      return {
        status: rootValid ? "completed" : "blocked",
        lockReleased: true,
        ...(request?.kind === "restart_preparation"
          ? {
              restartPreparation:
                target &&
                requestId &&
                (!prior ||
                  (prior.requestId === requestId &&
                    prior.scopeSha256 === request.scopeSha256))
                  ? {
                      operation: target,
                      requestId,
                      scopeSha256: request.scopeSha256,
                    }
                  : null,
            }
          : {}),
        value: rootValid
          ? {
              snapshot,
              operationStates: snapshot.operations.map((value) =>
                value.kind === "docker_task"
                  ? {
                      kind: value.kind,
                      operation: value,
                      resourcesSettled: settledBooks.has(value.resources),
                      restartSettled: value.dockerRestart === null,
                      authenticationClosureAllowed: false,
                    }
                  : { kind: value.kind, operation: value },
              ),
              sourceText: `${canonicalJson(snapshot)}\n`,
              payloadSha256: createHash("sha256")
                .update(`${canonicalJson(snapshot)}\n`)
                .digest("hex"),
            }
          : null,
      };
    },
    saveRecoveryCheckpoint: (
      _repository: unknown,
      id: string,
      before: Buffer,
      request: { kind: string; value: unknown; assertOwner: () => boolean },
    ) => {
      assert.equal(request.kind, "restart");
      assert.equal(request.assertOwner(), true);
      assert.equal(before.toString(), `${canonicalJson(snapshot)}\n`);
      writes++;
      if (writerFault)
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: false,
        };
      const checkpoint = JSON.parse(
        JSON.stringify(request.value),
      ) as DockerRestartCheckpoint;
      snapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        operations: snapshot.operations.map((value) =>
          value.kind === "docker_task" && value.recoveryId === id
            ? { ...value, dockerRestart: checkpoint }
            : value,
        ),
      };
      return {
        status: "completed",
        snapshotConfirmed: true,
        lockReleased: true,
        revision: snapshot.revision,
        payloadSha256: createHash("sha256")
          .update(`${canonicalJson(snapshot)}\n`)
          .digest("hex"),
      };
    },
  };
  const api = runInThisContext(
    `(dependencies)=>{const {${Object.keys(context).join(",")}}=dependencies;\n${body}\nreturn {prepare:prepareDockerRestart,verify:verifyDockerRestartPreparation,persist:persistDockerRestartCheckpoint,release:releaseDockerRestartPreparation,finalize:finalizeDockerRestartPreparation};}`,
  )(context);
  return {
    api,
    root,
    token,
    secondToken,
    acquired,
    released,
    events,
    repository,
    hosts,
    get snapshot() {
      return snapshot;
    },
    get writes() {
      return writes;
    },
    set rootValid(value: boolean) {
      rootValid = value;
    },
    set ownerLive(value: boolean) {
      ownerLive = value;
    },
    set changeAtRead(value: boolean) {
      changeAtRead = value;
    },
    set writerFault(value: boolean) {
      writerFault = value;
    },
    set releaseFault(value: typeof releaseFault) {
      releaseFault = value;
    },
    set initializationFailure(value: typeof initializationFailure) {
      initializationFailure = value;
    },
    set acquireFault(value: string | null) {
      acquireFault = value;
    },
  };
}

/**
 * 複数操作の全Scopeを決定的順序で取得し逆順に解放する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 二つのHomeとHostを持つ現在操作を準備する。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle Host→Homeの四排他、保存0、逆順全解放。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("現在Scopeの複数Ownerは決定的順序で取得し逆順解放する", () => {
  const f = fixture(),
    prepared = f.api.prepare(f.token, f.root);
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.alreadyRequested, false);
  assert.equal(f.acquired.length, 4);
  assert.ok(f.acquired.slice(0, 2).every((id) => id.startsWith("host:")));
  assert.ok(f.acquired.slice(2).every((id) => id.startsWith("home:")));
  assert.equal(f.writes, 0);
  assert.equal(f.api.verify(prepared.capability), true);
  assert.equal(f.api.verify({ ...prepared.capability }), false);
  assert.equal(f.api.release(prepared.capability), true);
  assert.deepEqual(f.released, [...f.acquired].reverse());
  assert.equal(f.api.verify(prepared.capability), false);
  assert.equal(f.api.release(prepared.capability), false);
});
/**
 * Root単独の不一致と対象欠落を外部要求前に拒否する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 未確認Rootまたは別回復参照を指定する。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 準備拒否・排他取得0・保存0、旧資格へ到達しない。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("不正Rootと別対象は現在準備の取得前に止まる", () => {
  for (const fault of ["root", "target", "invalid"]) {
    const f = fixture();
    const result = f.api.prepare(
      fault === "target"
        ? `docker-task.${"d".repeat(64)}.${"d".repeat(64)}.${"d".repeat(64)}`
        : fault === "invalid"
          ? "invalid"
          : f.token,
      fault === "root" ? {} : f.root,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      fault === "target"
        ? "docker_restart_scope_conflict"
        : fault === "invalid"
          ? "docker_restart_id_invalid"
          : "docker_restart_root_unverified",
    );
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(f.acquired.length, 0);
    assert.equal(f.writes, 0);
  }
});

/**
 * 途中の排他取得失敗でも成功取得済み資源を全て逆順解放する。
 * @responsibility 取得試行と保持成功を区別し、一次失敗を解放結果で消さない。
 * @trace ERB-IT-014
 * @precondition 合成排他のみ、同じ本番準備本文を使用する。
 * @stimulus 後段Host／Home取得をthrowにし、既取得解放をfalse／throwへ変える。
 * @observation 成功取得済みIdentity、全解放順、保存件数と二つの失敗分類。
 * @oracle 失敗した取得自体は解放せず、既取得のみ逆順全解放、保存0、固定一次理由とcleanup分離。
 * @cleanup 合成境界のみ。実Host・Docker・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 準備Owner→排他取得・解放。
 */
test("後段取得失敗は成功済み排他だけを逆順に全解放する", () => {
  for (const failed of ["host:OP-123457", `home:${"a".repeat(64)}`]) {
    for (const cleanup of [null, "false", "throw"] as const) {
      const f = fixture();
      f.acquireFault = failed;
      f.releaseFault = cleanup;
      const result = f.api.prepare(f.token, f.root);
      assert.equal(
        result.primaryFailure,
        "docker_restart_preparation_unconfirmed",
      );
      assert.equal(
        result.cleanupFailure,
        cleanup === null ? null : "docker_restart_cleanup_unconfirmed",
      );
      assert.equal(result.cleanupConfirmed, cleanup === null);
      assert.deepEqual(f.released, f.acquired.slice(0, -1).reverse());
      assert.equal(f.acquired.at(-1), failed);
      assert.equal(f.writes, 0);
    }
  }
});

/**
 * 全外側排他の解放後だけ同要求の終端保存を一度発行する。
 * @responsibility 技術完了と外側cleanup・保存確認を分離する。
 * @trace ERB-IT-014
 * @precondition 同じ準備Mapと合成Writer、pendingまでの同要求保存を用意する。
 * @stimulus 正常、解放false／throw、最後のWriter拒否と再finalizeを試みる。
 * @observation 解放順、Writer件数、保存checkpointと再試行拒否。
 * @oracle 解放前completed0、解放不明はunknown／blocked、最後の保存拒否はpendingを保持し二回目Writer0。
 * @cleanup 合成境界のみ。実Docker・FilesystemへのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 解放済み同Owner→終端Writer。
 */
test("解放済みOwnerは同要求の終端だけを一度確定する", () => {
  for (const fault of ["normal", "false", "throw", "storage"] as const) {
    const f = fixture(),
      p = f.api.prepare(f.token, f.root);
    const initial = {
      requestId: p.requestId,
      scopeSha256: p.scopeSha256,
      request: "not_issued",
      cleanup: "not_required",
      result: null,
    };
    assert.equal(f.api.persist(p.capability, initial), true);
    assert.equal(
      f.api.persist(p.capability, {
        ...initial,
        request: "unknown",
        cleanup: "pending",
      }),
      true,
    );
    assert.equal(
      f.api.persist(p.capability, {
        ...initial,
        request: "confirmed",
        cleanup: "pending",
      }),
      true,
    );
    const technical = {
      requestId: p.requestId,
      status: "completed",
      reason: "docker_restart_settled",
      request: "confirmed",
      primaryFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: true,
      restartCompleted: true,
      effectOutcomeUnknown: false,
      startupElapsedMs: 1,
      delivery: "confirmed",
    };
    const writes = f.writes;
    assert.equal(f.api.finalize(p.capability, technical).status, "blocked");
    assert.equal(f.writes, writes);
    if (fault === "false" || fault === "throw") f.releaseFault = fault;
    f.api.release(p.capability);
    assert.deepEqual(f.released, [...f.acquired].reverse());
    if (fault === "storage") f.writerFault = true;
    const finalized = f.api.finalize(p.capability, technical);
    const target = f.snapshot.operations[0];
    assert.ok(target?.kind === "docker_task");
    const checkpoint = target.dockerRestart as unknown as {
      cleanup: string;
      result: { status: string } | null;
    };
    if (fault === "storage") {
      assert.equal(finalized.status, "blocked");
      assert.equal(checkpoint.cleanup, "pending");
      assert.equal(checkpoint.result, null);
    } else {
      assert.equal(
        finalized.status,
        "completed",
        `${fault}: ${JSON.stringify(finalized)}; writes=${f.writes}`,
      );
      assert.equal(
        checkpoint.cleanup,
        fault === "normal" ? "confirmed" : "unknown",
      );
      assert.equal(
        checkpoint.result?.status,
        fault === "normal" ? "completed" : "blocked",
      );
    }
    const after = f.writes;
    assert.equal(f.api.finalize(p.capability, technical).status, "blocked");
    assert.equal(f.writes, after);
  }
});
/**
 * 清掃済み配送待ちの別操作を実行Scopeに混入しない。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 二番目を全資源終端・Lease解放・Owner失効へする。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 対象Host／Homeだけ取得し、別配送記録を変更しない。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("清掃済み別操作は再起動Scopeの完全一致を妨げない", () => {
  const f = fixture(),
    closed = f.snapshot.operations[1];
  assert.ok(closed?.kind === "docker_task");
  Object.assign(closed, {
    phase: "terminal",
    outcome: { cleanupConfirmed: true },
    lease: "released",
  });
  const closedHost = f.hosts[1];
  assert.ok(closedHost);
  closedHost.cleanup = "confirmed";
  closed.execution.ownerEffect = "disabled";
  const before = JSON.stringify(closed);
  const prepared = f.api.prepare(f.token, f.root);
  assert.equal(prepared.status, "prepared");
  assert.equal(f.acquired.length, 2);
  assert.equal(JSON.stringify(closed), before);
  assert.equal(f.api.release(prepared.capability), true);
});
/**
 * 準備中の元版変化と解放不明を別々に保持する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 再読取り時に改訂を変え、一つの解放をfalseにする。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 最初のboundary_changedを保持し、cleanup不明でも全逆順解放・保存0。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("元版変化後の解放falseでも一次失敗と全解放を保持する", () => {
  const f = fixture();
  f.changeAtRead = true;
  f.releaseFault = "false";
  const result = f.api.prepare(f.token, f.root);
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, "docker_restart_boundary_changed");
  assert.equal(result.cleanupFailure, "docker_restart_cleanup_unconfirmed");
  assert.equal(result.reason, "docker_restart_cleanup_unconfirmed");
  assert.deepEqual(f.released, [...f.acquired].reverse());
  assert.equal(f.writes, 0);
});
/**
 * 準備中の元版変化と解放不明を別々に保持する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 再読取り時に改訂を変え、一つの解放をthrowにする。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 最初のboundary_changedを保持し、cleanup不明でも全逆順解放・保存0。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("元版変化後の解放throwでも一次失敗と全解放を保持する", () => {
  const f = fixture();
  f.changeAtRead = true;
  f.releaseFault = "throw";
  const result = f.api.prepare(f.token, f.root);
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, "docker_restart_boundary_changed");
  assert.equal(result.cleanupFailure, "docker_restart_cleanup_unconfirmed");
  assert.equal(result.reason, "docker_restart_cleanup_unconfirmed");
  assert.deepEqual(f.released, [...f.acquired].reverse());
  assert.equal(f.writes, 0);
});

/**
 * 現在排他失効と元版差替えから処置許可を作らない。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 準備後にOwnerを失効させ、またはfresh読取りを変更する。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 検証false・保存0、コピーCapabilityも拒否。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("準備後の失効と元版差替えは保存前に拒否する", () => {
  for (const fault of ["owner", "revision"]) {
    const f = fixture(),
      prepared = f.api.prepare(f.token, f.root);
    if (fault === "owner") f.ownerLive = false;
    else f.changeAtRead = true;
    assert.equal(f.api.verify(prepared.capability), false);
    assert.equal(f.writes, 0);
    f.api.release(prepared.capability);
  }
});
/**
 * 同じ要求の保存だけを準備Ownerへ結合する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 初期・unknownを保存し、別要求、保存不明後の再保存を試みる。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 対象slotだけ更新、別操作不変、保存不明後のWriter追加0。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("要求保存は同じ対象slotだけ更新し不明後に再発行しない", () => {
  const f = fixture(),
    prepared = f.api.prepare(f.token, f.root);
  const otherBefore = JSON.stringify(f.snapshot.operations[1]);
  const value = {
    requestId: prepared.requestId,
    scopeSha256: prepared.scopeSha256,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  };
  assert.equal(f.api.persist({ ...prepared.capability }, value), false);
  assert.equal(f.writes, 0);
  assert.equal(
    f.api.persist(prepared.capability, { ...value, requestId: "f".repeat(64) }),
    false,
  );
  assert.equal(f.writes, 0);
  assert.equal(f.api.persist(prepared.capability, value), true);
  assert.equal(JSON.stringify(f.snapshot.operations[1]), otherBefore);
  f.writerFault = true;
  assert.equal(
    f.api.persist(prepared.capability, {
      ...value,
      request: "unknown",
      cleanup: "pending",
    }),
    false,
  );
  const writes = f.writes;
  assert.equal(f.api.persist(prepared.capability, value), false);
  assert.equal(f.writes, writes);
  f.api.release(prepared.capability);
});

/** 後段の新規Lock残存を先行Lockの解放成功で消さない。 @trace ERB-IT-014 */
test("再起動準備の後段初期化失敗は先行解放と未回収・Process停止を分離する", () => {
  for (const descriptorClosed of [true, false]) {
    const f = fixture();
    f.initializationFailure = {
      id: `home:${"b".repeat(64)}`,
      descriptorClosed,
    };
    const result = f.api.prepare(f.token, f.root);
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(
      result.primaryFailure,
      "docker_restart_home_lock_initialization_failed",
    );
    assert.deepEqual(f.released, [...f.acquired.slice(0, -1)].reverse());
    assert.equal(f.events.includes("process-poisoned"), !descriptorClosed);
    assert.equal(f.writes, 0);
  }
});
