/**
 * 実回収Owner本文・実Domain候補・共通DIを有限外部境界で結合する。
 * @responsibility 旧5資源Projection／Receipt Adapterを使わず保存前削除を反証する。
 * @trace ERB-IT-014
 * @level IT
 * @scope メモリ内保存と既存有限CLI代役。実Docker・AI・保持物を操作しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInThisContext } from "node:vm";
import type { TestContext } from "node:test";
import { createIsolationFixture } from "../../../docker-isolation/tests/support/isolation.ts";
import { createResourceOperationFixture } from "../../../domain-model/tests/support/resource-operation.ts";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import {
  applyCoordinatorResourceEvent,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateCleanupSnapshot,
  coordinatorTaskResourcesAreSettled,
  coordinatorAuthenticationUnknownCanClose,
  type CoordinatorResourceBook,
} from "../../../domain-model/src/index.ts";
import type {
  ResourceTarget,
  IsolationCallbacks,
} from "../../../docker-isolation/src/index.ts";
import { getIsolationSettings } from "../../src/execution/configuration.ts";

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
  let book: CoordinatorResourceBook | null = null;
  for (const item of prepared.resources.resources) {
    book = applyCoordinatorResourceEvent(book, {
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
      book = applyCoordinatorResourceEvent(book, {
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
  const initial = decodeRuntimeDomainSnapshot(base.bytes, base.binding);
  assert.ok(initial);
  const task = initial.snapshot.operations[0];
  assert.ok(task?.kind === "docker_task");
  let bytes: Buffer = Buffer.from(
    `${encodeRuntimeStateValue({
      ...initial.snapshot,
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
    const value = decodeRuntimeDomainSnapshot(bytes, base.binding);
    assert.ok(value);
    return value;
  };
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
    runInThisContext(`(deps)=>{const {Buffer,encodeRuntimeStateValue,decodeRuntimeDomainSnapshot,dockerRecoveryPreparations,assertCurrentRecoveryOwner,readRuntimeOwnedCoordinatorRecoverySnapshot,writeRuntimeOwnedCoordinatorRecoveryCheckpoint,borrowHostRecoveryManagementDirectory,coordinatorTaskResourcesAreSettled,coordinatorAuthenticationUnknownCanClose,coordinatorReleasedTaskCanObserveHostAbsence}=deps;
 ${names.map((n) => sourceDeclaration(source, n)).join("\n")}
 return {run:recoverRuntimeOwnedDockerTaskResources,target:projectResourceTarget};}`)(
      {
        Buffer,
        encodeRuntimeStateValue,
        decodeRuntimeDomainSnapshot: decodeRuntimeDomainSnapshot,
        dockerRecoveryPreparations: new Map([[capability, record]]),
        assertCurrentRecoveryOwner: (owner: unknown) =>
          owner === capability && live,
        readRuntimeOwnedCoordinatorRecoverySnapshot: () => ({
          status: "completed",
          lockReleased: readerReleased,
          value:
            staleReadback && writeCount
              ? decodeRuntimeDomainSnapshot(previous, base.binding)
              : read(),
        }),
        writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
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
          const candidate =
            kind === "resource"
              ? prepareCoordinatorStateResourceSnapshot(
                  bytes,
                  id,
                  value,
                  base.binding,
                )
              : prepareCoordinatorStateCleanupSnapshot(
                  bytes,
                  id,
                  value,
                  base.binding,
                );
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
        borrowHostRecoveryManagementDirectory: () => {
          borrowCount++;
          return {
            directory: f.request.managementDirectory,
            assertCurrent: () => borrowLive,
          };
        },
        coordinatorTaskResourcesAreSettled,
        coordinatorAuthenticationUnknownCanClose,
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
    setBook(value: CoordinatorResourceBook | null) {
      const current = read();
      const op = current.snapshot.operations[0];
      assert.ok(op?.kind === "docker_task");
      bytes = Buffer.from(
        `${encodeRuntimeStateValue({
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
