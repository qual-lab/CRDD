/**
 * 実回収Owner本文・公開Resource値操作・共通DIを有限外部境界で結合する。
 * @responsibility 旧5資源Projection／Receipt Adapterを使わず保存前削除を反証する。
 * @trace ERB-IT-014
 * @level IT
 * @scope メモリWriter応答代役と既存有限CLI代役。実Writer・CASの試験とは区別し、実Docker・AI・保持物を操作しない。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import type { TestContext } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { runInThisContext } from "node:vm";
import type {
  IsolationCallbacks,
  ResourceTarget,
} from "../../../docker-isolation/src/index.ts";
import { createIsolationFixture } from "../../../docker-isolation/tests/support/isolation.ts";
import {
  applyResourceEvent,
  type ExecutionStateSnapshot,
  type OperationResources,
} from "../../../execution-model/src/index.ts";
import { createResourceOperationFixture } from "../../../execution-model/tests/support/resource-operation.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { getIsolationSettings } from "../../src/execution/configuration.ts";
import { canonicalJson } from "./contract-assertions.ts";

export async function createRecoveryFixture(
  t: TestContext,
  missingId = false,
  resourceSet = false,
) {
  const f = await createIsolationFixture(t, resourceSet),
    base = createResourceOperationFixture();
  const prepared = f.api.prepareIsolation(f.request, getIsolationSettings());
  assert.ok(prepared);
  const technical = await f.api.executeIsolation(prepared).completion;
  assert.equal(technical.cleanup.confirmed, true);
  const cleanup = {
    cleanupOrder: f.request.cleanupOrder,
    setupTimeoutMs: f.request.setupTimeoutMs,
    unreceiptedAbsence: f.request.unreceiptedAbsence,
    verifyLabelAbsence: f.request.verifyLabelAbsence,
  };
  let book: OperationResources | null = null;
  for (const item of prepared.resources.resources) {
    book = applyResourceEvent(book, {
      event: "submission",
      key: item.key,
      snapshot: book?.snapshot ?? prepared.resources,
      cleanup,
    });
    assert.ok(book);
    if (!missingId) {
      const receipt = technical.resources.resources.find(
        (r) => r.key === item.key,
      );
      assert.ok(receipt);
      const snapshot = {
        resources: book.snapshot.resources.map((r) =>
          r.key === item.key ? receipt : r,
        ),
      };
      book = applyResourceEvent(book, {
        event: "receipt",
        key: item.key,
        snapshot,
        cleanup,
      });
      assert.ok(book);
    }
  }
  for (const item of technical.resources.resources) {
    assert.ok(item.identity.dockerId);
    f.ids.add(item.identity.dockerId);
  }
  const initial = JSON.parse(base.bytes.toString("utf8"));
  const task = base.operation;
  assert.ok(task?.kind === "docker_task");
  let bytes: Buffer = Buffer.from(
    `${canonicalJson({
      ...initial,
      operations: [
        {
          ...task,
          phase: "settling",
          resources: book,
          execution: { ...task.execution, ownerEffect: "disabled" },
        },
      ],
    })}\n`,
  );
  const read = () => {
    const snapshot = JSON.parse(
      bytes.toString("utf8"),
    ) as ExecutionStateSnapshot;
    return {
      snapshot,
      // この有限fixtureは再起動なし。回収通知の前後という既知の段階だけを投影する。
      operationStates: snapshot.operations.map((operation) => {
        assert.equal(operation.kind, "docker_task");
        if (operation.kind !== "docker_task")
          throw Error("fixture_operation_kind");
        assert.equal(operation.dockerRestart, null);
        return {
          kind: "docker_task" as const,
          operation,
          resourcesSettled:
            operation.resources?.checkpoints.every(
              (resource) => resource.observation === "absent",
            ) === true,
          restartSettled: true,
          authenticationClosureAllowed: false,
        };
      }),
      payloadSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceText: bytes.toString("utf8"),
    };
  };
  const initialObserved = read();
  const capability = {},
    root = {},
    repository = { repositoryBinding: base.binding, revalidate: () => live };
  let live = true,
    borrowLive = true,
    writeRejected = false,
    readerReleased = true,
    staleReadback = false,
    loseAfterWrite = false;
  let previous: Buffer = bytes,
    writeCount = 0,
    borrowCount = 0;
  const events: string[] = [];
  const record = {
    kind: "recovery",
    closed: false,
    persistenceFailed: false,
    cleanupUnknown: false,
    hostCleanup: "present",
    hostCleanupPublication: null,
    rootCapability: root,
    repository,
    recoveryId: base.recoveryId,
    before: bytes,
    snapshot: initialObserved.snapshot,
    operationStates: initialObserved.operationStates,
    hostToken: "host-token",
    hostGeneration: "host-generation",
  };
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const names = [
    "projectResourceTarget",
    "persistRuntimeOwnedDockerTaskRecoveryCheckpoint",
    "recoverRuntimeOwnedDockerTaskResources",
  ];
  const api =
    runInThisContext(`(deps)=>{const {Buffer,canonicalJson,snapshotJsonValue,isDeepStrictEqual,dockerRecoveryPreparations,assertCurrentRecoveryOwner,readRecoveryState,saveRecoveryCheckpoint,borrowHostRecoveryManagementDirectory,coordinatorReleasedTaskCanObserveHostAbsence}=deps;
 ${names.map((n) => sourceDeclaration(source, n)).join("\n")}
 return {run:recoverRuntimeOwnedDockerTaskResources,target:projectResourceTarget};}`)(
      {
        Buffer,
        snapshotJsonValue,
        isDeepStrictEqual,
        canonicalJson,
        dockerRecoveryPreparations: new Map([[capability, record]]),
        assertCurrentRecoveryOwner: (owner: unknown) =>
          owner === capability && live,
        readRecoveryState: () => ({
          status: "completed",
          lockReleased: readerReleased,
          value:
            staleReadback && writeCount
              ? {
                  snapshot: JSON.parse(previous.toString("utf8")),
                  payloadSha256: createHash("sha256")
                    .update(previous)
                    .digest("hex"),
                  sourceText: previous.toString("utf8"),
                }
              : read(),
        }),
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
                  id: string,
                  before: Buffer,
                  kind: string,
                  value: unknown,
                  owner: () => boolean,
                ) => {
                  events.push(`save:${kind}`);
                  if (!owner() || writeRejected || !before.equals(bytes))
                    return {
                      status: "blocked",
                      snapshotConfirmed: false,
                      lockReleased: true,
                    };
                  const current = read(),
                    operation = current.snapshot.operations.find(
                      (item) =>
                        item.kind === "docker_task" && item.recoveryId === id,
                    );
                  assert.ok(operation?.kind === "docker_task");
                  assert.equal(operation.phase, "settling");
                  assert.equal(operation.outcome, null);
                  let resources: OperationResources | null;
                  if (kind === "resource")
                    resources = applyResourceEvent(operation.resources, value);
                  else {
                    assert.equal(kind, "cleanup");
                    const payload = JSON.parse(canonicalJson(value));
                    assert.deepEqual(Object.keys(payload).sort(), [
                      "observations",
                      "snapshot",
                    ]);
                    assert.ok(operation.resources);
                    resources = applyResourceCleanup(
                      operation.resources,
                      payload.snapshot,
                      payload.observations,
                      {
                        recoveryId: id,
                        previousPayloadSha256: current.payloadSha256,
                      },
                    );
                  }
                  // 公開更新操作が元記録との遷移を検査済み。不成立はnullのまま保存しない。
                  const candidate = resources
                    ? Buffer.from(
                        `${canonicalJson({
                          ...current.snapshot,
                          revision: current.snapshot.revision + 1,
                          previous: {
                            revision: current.snapshot.revision,
                            payloadSha256: current.payloadSha256,
                          },
                          operations: current.snapshot.operations.map((item) =>
                            item.recoveryId === id
                              ? { ...item, resources }
                              : item,
                          ),
                        })}\n`,
                      )
                    : null;
                  if (!candidate)
                    return {
                      status: "blocked",
                      snapshotConfirmed: false,
                      lockReleased: true,
                    };
                  previous = bytes;
                  bytes = candidate;
                  writeCount++;
                  if (loseAfterWrite) live = false;
                  const next = read();
                  return {
                    status: "completed",
                    snapshotConfirmed: true,
                    lockReleased: true,
                    revision: next.snapshot.revision,
                    payloadSha256: next.payloadSha256,
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
        borrowHostRecoveryManagementDirectory: () => {
          borrowCount++;
          return {
            directory: f.request.managementDirectory,
            assertCurrent: () => borrowLive,
          };
        },
        coordinatorReleasedTaskCanObserveHostAbsence: () => false,
      },
    ) as {
      run(
        owner: unknown,
        cleanup: (
          target: ResourceTarget<"snapshot">,
          callbacks: IsolationCallbacks,
        ) => ReturnType<typeof f.api.cleanupIsolation>,
        inspect: () => never,
        signal?: AbortSignal,
      ): Promise<{
        status: string;
        recoveryId: string | null;
        dockerCleanupConfirmed: boolean;
        configCleanupConfirmed: boolean;
        reason: string;
      }>;
    };
  return {
    f,
    events,
    record,
    get writes() {
      return writeCount;
    },
    get borrows() {
      return borrowCount;
    },
    get state() {
      return read();
    },
    set writeRejected(value: boolean) {
      writeRejected = value;
    },
    set readerReleased(value: boolean) {
      readerReleased = value;
    },
    set staleReadback(value: boolean) {
      staleReadback = value;
    },
    set loseAfterWrite(value: boolean) {
      loseAfterWrite = value;
    },
    set live(value: boolean) {
      live = value;
    },
    set borrowLive(value: boolean) {
      borrowLive = value;
    },
    setBook(value: OperationResources | null) {
      const current = read();
      const op = current.snapshot.operations[0];
      assert.ok(op?.kind === "docker_task");
      bytes = Buffer.from(
        `${canonicalJson({
          ...current.snapshot,
          operations: [
            {
              ...op,
              resources: value,
              outcome: value
                ? op.outcome
                : {
                    status: "blocked",
                    reason: "docker_process_controller_execution_failed_closed",
                    cleanupConfirmed: true,
                  },
            },
          ],
        })}\n`,
      );
      record.before = bytes;
      record.snapshot = read().snapshot;
    },
    run: (signal?: AbortSignal) =>
      api.run(
        capability,
        (target, callbacks) =>
          f.api.cleanupIsolation(target, getIsolationSettings(), callbacks),
        () => {
          throw Error("unexpected_inspection");
        },
        signal,
      ),
  };
}

import { applyResourceCleanup } from "../../../execution-model/src/index.ts";
import { snapshotJsonValue } from "../../src/input/snapshot.ts";
