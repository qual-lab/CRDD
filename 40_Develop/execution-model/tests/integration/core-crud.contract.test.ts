/**
 * Coreだけの一般CRUDを同じ物理Writerへ接続する。
 * @packageDocumentation
 * @responsibility Coordinator・AI・Dockerなしで初期化・定義変更・CAS・認可を確認する。
 * @trace PRL-IT-012
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @level IT
 * @scope 自己生成Repositoryの新Schemaと、保存Source試験補助の独立性。
 * @boundary Domain公開API→実Filesystem・既存短期OS排他。準備共有はSource／VMだけ。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as domain from "../../src/index.ts";
import {
  encodeStateValue,
  hashExecutionStateContent,
} from "../../src/state/operations.ts";
import { EXECUTION_STATE_SCHEMA } from "../../src/state/validation.ts";
import { observeExecutionStorageRepository } from "../../src/storage/lock.ts";
import * as privatePublication from "../../src/storage/publication.ts";
import { ensurePhysicalExecutionDataArea } from "../../src/storage/store.ts";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as vm from "node:vm";
import {
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  type ExecutionModelAccess,
  initializeExecutionState,
  queryPlan,
  queryQueue,
  queryTasks,
  savePlan,
  updateTask,
  saveOperationStart,
  saveOperationCheckpoint,
  applyResourceEvent,
} from "../../src/index.ts";
import { decodeStateSnapshot } from "../../src/state/validation.ts";
import {
  decodeHostOperation,
  validHostOperationTransition,
} from "../../src/attempt/validation.ts";
import { acquireExecutionStateLock } from "../../src/storage/lock.ts";
import { readStableFileSnapshot } from "../../src/storage/store.ts";
import {
  createRepositoryTestDirectory,
  prepareFixtureRecovery,
} from "../support/repository-test-directory.ts";
import { createRuntimeStorageSourceFixture } from "../support/storage-source.ts";
import type {
  HostOperationAccess,
  HostOperationRecord,
} from "../../src/attempt/types.ts";

/**
 * Hostの初回出版と物理置換を保存Owner内で確認する。
 * @responsibility 同値再送、初回領域の再作成拒否、fresh Reader、別Root、同bytes置換とpendingを区別する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition 自己生成Git Rootと有限の合成Host観測を使用する。
 * @stimulus 実Writerと実Filesystemへ正負の初期化・更新を発行する。
 * @observation 本文、Hash、pending、排他解放と再入場。
 * @oracle 偽Owner・異なる実体・競合は無出版で停止する。
 * @cleanup 今回Rootだけを既存helperで清掃する。
 * @boundary 保存の試験。合成Host観測を実Host終了の証拠にしない。
 */
test("Host Windows: 初期化証拠とpending再入場は元Rootと本文に結合する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const directory = createRepositoryTestDirectory("host-publication-reentry-");
  t.after(directory.cleanup);
  const root = directory.path;
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
  const observed = observeExecutionStorageRepository({ directory: root });
  assert.ok(observed);
  const legacy = Reflect.apply(domain.initializeExecutionStore, undefined, [
    { repositoryRoot: root },
    "binding-a",
    () => assert.fail("legacy input must not prepare storage"),
  ]);
  assert.equal(legacy.status, "blocked");
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  assert.ok(ensurePhysicalExecutionDataArea(root, "tmp"));
  const repository = { ...observed, operationId: "OP-123456" };
  const management = Object.freeze({
    identity: Object.freeze({}),
    observeRepository: () => ({
      purpose: "execution" as const,
      root: { directory: root },
      operationId: repository.operationId,
      revalidate: repository.revalidate,
    }),
    verifyNotIssued: () => false,
  });
  const hostIntent = {
    kind: "host_operation",
    operationId: repository.operationId,
    recoveryId: `host-operation.${repository.operationId}`,
    purpose: "task",
    resources: null,
    createdAt: "2026-11-19T00:00:00.000Z",
    phase: "preparing",
    rootIdentity: null,
    childIdentities: {},
    cleanup: "not_requested",
  } as const;
  const hostAccess = {
    root: { directory: root },
    revalidate: () => observed.revalidate(),
  };
  const hostStart = { kind: "host_operation", value: hostIntent } as const;
  const first = {
    ...{
      repositoryBindingId: null,
      projects: [],
      managedExecutions: [],
      queueEntries: [],
      workspaces: [],
      leaseEvidence: [],
      leaseIntents: [],
      results: [],
      historyPending: [],
      decisions: [],
      blockers: [],
    },
    schema: EXECUTION_STATE_SCHEMA,
    revision: 1,
    previous: null,
    repositoryBinding: repository.repositoryBinding,
    operations: [hostIntent],
    unresolvedRecoveries: [],
  };
  const firstBytes = Buffer.from(`${encodeStateValue(first)}\n`);
  assert.equal(
    domain.readState(management, { scope: "operation" }).status,
    "blocked",
  );
  assert.equal(
    privatePublication.writeOwnedStateSnapshot({}, firstBytes)
      .filesystemEffectIssued,
    false,
  );
  const result = domain.saveOperationStart(hostAccess, hostStart);
  assert.equal(result.status, "completed", result.reason);
  assert.equal(result.startSaved, true);
  assert.equal(result.snapshotConfirmed, true);
  assert.equal(result.lockReleased, true);
  const area = ensurePhysicalExecutionDataArea(root, "execution-model");
  assert.ok(area, "state_root");
  assert.equal(
    domain.saveOperationStart(hostAccess, hostStart).status,
    "completed",
  );
  assert.equal(
    privatePublication.writeOwnedStateSnapshot({}, firstBytes)
      .filesystemEffectIssued,
    false,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    firstBytes,
  );
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  const readFirst = domain.readState(management, { scope: "operation" });
  assert.equal(readFirst.status, "completed");
  assert.equal(readFirst.lockReleased, true);
  assert.equal(readFirst.value?.snapshot.revision, 1);
  assert.equal(
    readFirst.value?.payloadSha256,
    hashExecutionStateContent(first),
  );
  assert.equal(domain.readState({}, { scope: "operation" }).status, "blocked");
  const recoveryRead = domain.readState(prepareFixtureRecovery(root), {
    scope: "recovery",
  });
  assert.equal(recoveryRead.status, "completed");
  assert.equal(recoveryRead.lockReleased, true);
  assert.deepEqual(recoveryRead.value, readFirst.value);
  for (const invalidRoot of [
    null,
    {},
    { directory: root },
    root,
    { repositoryRoot: root },
  ]) {
    const rejectedRoot = domain.readState(invalidRoot, { scope: "recovery" });
    assert.equal(rejectedRoot.status, "blocked");
    assert.equal(rejectedRoot.value, null);
  }
  const freshProcessRead = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "-e",
        `(async () => {
     const domain = await import(${JSON.stringify(new URL("../../src/index.ts", import.meta.url).href)});
     const root = process.argv[1];
     const { prepareFixtureRecovery } = await import(${JSON.stringify(new URL("../support/repository-test-directory.ts", import.meta.url).href)});
     const result = domain.readState(prepareFixtureRecovery(root), { scope: "recovery" });
     process.stdout.write(JSON.stringify({status: result.status, lockReleased: result.lockReleased, hash: result.value?.payloadSha256 ?? null}));
     })().catch(error => { console.error(error); process.exitCode = 1; });`,
        root,
      ],
      { windowsHide: true, encoding: "utf8", timeout: 30_000 },
    ),
  );
  assert.deepEqual(freshProcessRead, {
    status: "completed",
    lockReleased: true,
    hash: readFirst.value?.payloadSha256,
  });
  const otherRoot = path.join(root, "other-repository");
  fs.mkdirSync(otherRoot);
  execFileSync("git", ["init", "--quiet", otherRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      otherRoot,
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
      "other fixture",
    ],
    { windowsHide: true },
  );
  const otherArea = path.join(otherRoot, ".crdd", "execution-model");
  fs.mkdirSync(otherArea, { recursive: true });
  fs.writeFileSync(path.join(otherArea, "state.json"), firstBytes, {
    flag: "wx",
  });
  const foreignSnapshot = domain.readState(prepareFixtureRecovery(otherRoot), {
    scope: "recovery",
  });
  assert.equal(foreignSnapshot.status, "blocked");
  assert.equal(foreignSnapshot.value, null);
  assert.deepEqual(
    fs.readFileSync(path.join(otherArea, "state.json")),
    firstBytes,
  );
  const borrowedOtherRoot = observeExecutionStorageRepository({
    directory: otherRoot,
  });
  assert.ok(borrowedOtherRoot);
  assert.equal(borrowedOtherRoot.revalidate(), true);
  fs.renameSync(otherRoot, `${otherRoot}-previous`);
  fs.mkdirSync(otherRoot);
  execFileSync("git", ["init", "--quiet", otherRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      otherRoot,
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
      "replacement fixture",
    ],
    { windowsHide: true },
  );
  assert.equal(borrowedOtherRoot.revalidate(), false);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    firstBytes,
  );
  // 公開後に消えた現在状態を初回の空領域として再作成しない。
  fs.unlinkSync(path.join(area.directory, "state.json"));
  assert.equal(
    domain.readState(prepareFixtureRecovery(root), {
      scope: "recovery",
    }).status,
    "blocked",
  );
  assert.equal(fs.existsSync(path.join(area.directory, "state.json")), false);
  assert.equal(
    domain.readState(management, { scope: "operation" }).status,
    "blocked",
  );
  assert.equal(
    privatePublication.writeOwnedStateSnapshot(management, firstBytes)
      .filesystemEffectIssued,
    false,
  );
  assert.equal(
    domain.saveOperationStart(hostAccess, hostStart).status,
    "blocked",
  );
  fs.writeFileSync(path.join(area.directory, "state.json"), firstBytes, {
    flag: "wx",
  });
  const second = {
    ...first,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: hashExecutionStateContent(first),
    },
  };
  const secondBytes = Buffer.from(`${encodeStateValue(second)}\n`);
  // 同じ本文への実体差し替えを、公開前の再観測で拒否する。
  const originalFsync = fs.fsyncSync;
  let isReplaced = false;
  fs.fsyncSync = (fd) => {
    originalFsync(fd);
    // wx取得自身のfsyncではなく、pending作成後の出版区間に注入する。
    if (
      !isReplaced &&
      fs.existsSync(path.join(area.directory, "state.pending.json"))
    ) {
      isReplaced = true;
      const state = path.join(area.directory, "state.json");
      fs.renameSync(state, path.join(root, "replaced-state"));
      fs.writeFileSync(state, firstBytes, { flag: "wx" });
    }
  };
  try {
    const replacement = privatePublication.writeOwnedStateSnapshot(
      management,
      secondBytes,
    );
    assert.equal(replacement.status, "blocked");
    assert.equal(replacement.snapshotConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      firstBytes,
    );
  } finally {
    fs.fsyncSync = originalFsync;
  }
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.pending.json")),
    secondBytes,
  );
  fs.unlinkSync(path.join(area.directory, "state.pending.json"));
  fs.writeFileSync(
    path.join(area.directory, "state.pending.json"),
    secondBytes,
    { flag: "wx" },
  );
  assert.equal(
    privatePublication.writeOwnedStateSnapshot(management, secondBytes).status,
    "completed",
  );
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    secondBytes,
  );
  // 正規保存済みと同じpending残存は再適用せず短命物だけを回収する。
  fs.writeFileSync(
    path.join(area.directory, "state.pending.json"),
    secondBytes,
    { flag: "wx" },
  );
  assert.equal(
    privatePublication.writeOwnedStateSnapshot(management, secondBytes).status,
    "completed",
  );
  fs.writeFileSync(path.join(area.directory, "state.pending.json"), "invalid", {
    flag: "wx",
  });
  assert.equal(
    domain.readState(management, { scope: "operation" }).reason,
    "coordinator_state_reentry_required",
  );
  assert.equal(
    domain.readState(prepareFixtureRecovery(root), {
      scope: "recovery",
    }).reason,
    "coordinator_state_reentry_required",
  );
  const rejected = privatePublication.writeOwnedStateSnapshot(
    management,
    secondBytes,
  );
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.filesystemEffectIssued, false);
  assert.equal(
    fs.readFileSync(path.join(area.directory, "state.pending.json"), "utf8"),
    "invalid",
  );
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    secondBytes,
  );
  fs.unlinkSync(path.join(area.directory, "state.pending.json"));
  const hardlink = path.join(root, "state-hardlink");
  fs.linkSync(path.join(area.directory, "state.json"), hardlink);
  assert.equal(
    domain.readState(management, { scope: "operation" }).status,
    "blocked",
  );
  assert.equal(
    privatePublication.writeOwnedStateSnapshot(management, secondBytes)
      .filesystemEffectIssued,
    false,
  );
  fs.unlinkSync(hardlink);
});

/**
 * Host作成前Intentを空State経由にせず既存Writerへ一出版する。
 * @responsibility 現在認可、初回本文、Receipt更新、CASと保存不明時の参照を反証する。
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryと合成実体値だけを使用する。
 * @stimulus 初回・同値再送・stale・認可拒否とrename故障を与える。
 * @observation 実state/pending本文・改訂・元回復参照とHost Directory非作成。
 * @oracle 最初の本文からHost Intentを含み、不明時に開始成立へ昇格しない。
 * @cleanup 同期I/Oとmockを終え、既存helperで自己生成Rootだけを回収する。
 * @boundary 公開Operation受付→既存Lock/CAS/物理Writer。Host実作成・Dockerは対象外。
 */
test("Host Intentは既存Writerの最初の一出版から記録し保存不明を開始成功にしない", async (t) => {
  for (const fault of ["none", "rename", "unlock"] as const)
    await t.test(fault, (sub) => {
      const directory = createRepositoryTestDirectory(
        "host-intent-publication-",
      );
      sub.after(directory.cleanup);
      const root = directory.path;
      fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(root, ".git", "info"));
      fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
      fs.writeFileSync(
        path.join(root, ".git", "config"),
        "[core]\nrepositoryformatversion = 0\nbare = false\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "refs", "heads", "main"),
        `${"1".repeat(40)}\n`,
      );
      let allowed = false;
      const access: HostOperationAccess = {
        root: { directory: root },
        revalidate: (operation, target) => {
          assert.equal(operation, "operation.record");
          assert.deepEqual(target, { operationId: "OP-123456" });
          return allowed;
        },
      };
      const operation = {
        kind: "host_operation",
        operationId: "OP-123456",
        recoveryId: "host-operation.OP-123456",
        purpose: "advice",
        resources: null,
        createdAt: "2026-11-19T00:00:00.000Z",
        phase: "preparing",
        rootIdentity: null,
        childIdentities: {},
        cleanup: "not_requested",
      } as const;
      const stateFile = path.join(
        root,
        ".crdd",
        "execution-model",
        "state.json",
      );
      const pendingFile = path.join(
        path.dirname(stateFile),
        "state.pending.json",
      );
      const request = { kind: "host_operation", value: operation } as const;
      Object.defineProperty(access, "principalId", {
        get() {
          throw Error("host_record_must_not_resolve_principal");
        },
      });
      const denied = saveOperationStart(access, request);
      assert.equal(denied.startSaved, false);
      assert.equal(fs.existsSync(stateFile), false);
      allowed = true;
      let publications = 0;
      const rename = fs.renameSync;
      const observer = sub.mock.method(fs, "renameSync", ((
        ...args: Parameters<typeof fs.renameSync>
      ) => {
        if (String(args[1]) === stateFile) {
          publications++;
          const candidate = JSON.parse(
            fs.readFileSync(String(args[0]), "utf8"),
          );
          assert.deepEqual(candidate.operations, [operation]);
          assert.equal(candidate.revision, 1);
          if (fault === "rename")
            throw Object.assign(new Error("synthetic"), { code: "EIO" });
        }
        return rename(...args);
      }) as typeof fs.renameSync);
      const remove = fs.rmSync;
      const unlockObserver =
        fault === "unlock"
          ? sub.mock.method(
              fs,
              "rmSync",
              (file: fs.PathLike, options?: fs.RmOptions) => {
                if (
                  String(file) ===
                  path.join(root, ".crdd", "lock", "execution-model.state.lock")
                )
                  throw Object.assign(new Error("synthetic release failure"), {
                    code: "EIO",
                  });
                return remove(file, options);
              },
            )
          : null;
      const started = saveOperationStart(access, request);
      observer.mock.restore();
      unlockObserver?.mock.restore();
      assert.equal(started.recoveryId, operation.recoveryId);
      assert.equal(started.lockReleased, fault !== "unlock");
      assert.equal(publications, 1);
      assert.equal(
        fs.existsSync(path.join(root, ".crdd", "coordinator")),
        false,
      );
      if (fault === "unlock") {
        assert.equal(started.startSaved, false);
        assert.equal(started.snapshotConfirmed, true);
        assert.equal(started.filesystemEffectIssued, true);
        assert.equal(
          started.reason,
          "coordinator_state_lock_release_unconfirmed",
        );
        assert.deepEqual(
          JSON.parse(fs.readFileSync(stateFile, "utf8")).operations,
          [operation],
        );
        const before = fs.readFileSync(stateFile);
        const retry = saveOperationStart(access, request);
        assert.equal(retry.startSaved, false);
        assert.equal(retry.recoveryId, operation.recoveryId);
        assert.deepEqual(fs.readFileSync(stateFile), before);
        return;
      }
      if (fault === "rename") {
        assert.equal(started.startSaved, false);
        assert.equal(started.filesystemEffectIssued, true);
        assert.equal(fs.existsSync(stateFile), false);
        const pending = fs.readFileSync(pendingFile);
        assert.deepEqual(JSON.parse(pending.toString()).operations, [
          operation,
        ]);
        const retry = saveOperationStart(access, request);
        assert.equal(retry.startSaved, false);
        assert.equal(retry.recoveryId, operation.recoveryId);
        assert.deepEqual(fs.readFileSync(pendingFile), pending);
        return;
      }
      assert.equal(started.startSaved, true, JSON.stringify(started));
      const initial = fs.readFileSync(stateFile);
      assert.equal(saveOperationStart(access, request).startSaved, true);
      assert.deepEqual(fs.readFileSync(stateFile), initial);
      const next = {
        ...operation,
        rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
      };
      const checkpoint = {
        kind: "host_operation",
        value: {
          operation: next,
          expectedVersion: {
            revision: started.revision,
            payloadSha256: started.payloadSha256,
          },
        },
      } as const;
      const saved = saveOperationCheckpoint(
        access,
        operation.recoveryId,
        checkpoint,
      );
      assert.equal(
        saved.snapshotConfirmed && saved.lockReleased,
        true,
        JSON.stringify(saved),
      );
      const current = fs.readFileSync(stateFile);
      assert.deepEqual(JSON.parse(current.toString()).operations, [next]);
      const noVersion = saveOperationCheckpoint(access, operation.recoveryId, {
        kind: "host_operation",
        value: { operation, expectedVersion: null },
      });
      assert.equal(noVersion.snapshotConfirmed, false);
      const missing = {
        ...operation,
        operationId: "OP-654321",
        recoveryId: "host-operation.OP-654321",
      };
      const noStart = saveOperationCheckpoint(
        { ...access, revalidate: () => true },
        missing.recoveryId,
        {
          kind: "host_operation",
          value: {
            operation: missing,
            expectedVersion: {
              revision: saved.revision,
              payloadSha256: saved.payloadSha256,
            },
          },
        },
      );
      assert.equal(noStart.snapshotConfirmed, false);
      assert.deepEqual(fs.readFileSync(stateFile), current);
      const stale = saveOperationCheckpoint(
        access,
        operation.recoveryId,
        checkpoint,
      );
      assert.equal(stale.snapshotConfirmed, false);
      assert.deepEqual(fs.readFileSync(stateFile), current);
      allowed = false;
      const rejected = saveOperationCheckpoint(access, operation.recoveryId, {
        kind: "host_operation",
        value: {
          operation: { ...next, cleanup: "pending" },
          expectedVersion: {
            revision: saved.revision,
            payloadSha256: saved.payloadSha256,
          },
        },
      });
      assert.equal(rejected.snapshotConfirmed, false);
      assert.deepEqual(fs.readFileSync(stateFile), current);
      allowed = true;
      const openedState = new Set<number>();
      let completedReads = 0;
      const originalOpen = fs.openSync;
      const originalClose = fs.closeSync;
      const openObserver = sub.mock.method(fs, "openSync", ((
        ...args: Parameters<typeof fs.openSync>
      ) => {
        const descriptor = Reflect.apply(originalOpen, fs, args);
        if (String(args[0]) === stateFile) openedState.add(descriptor);
        return descriptor;
      }) as typeof fs.openSync);
      const closeObserver = sub.mock.method(
        fs,
        "closeSync",
        (descriptor: number) => {
          originalClose(descriptor);
          if (openedState.delete(descriptor)) {
            completedReads++;
            allowed = false;
          }
        },
      );
      let lostAfterRead: ReturnType<typeof saveOperationCheckpoint>;
      try {
        lostAfterRead = saveOperationCheckpoint(access, operation.recoveryId, {
          kind: "host_operation",
          value: {
            operation: { ...next, cleanup: "pending" },
            expectedVersion: {
              revision: saved.revision,
              payloadSha256: saved.payloadSha256,
            },
          },
        });
      } finally {
        openObserver.mock.restore();
        closeObserver.mock.restore();
        allowed = true;
      }
      assert.ok(completedReads > 0);
      assert.equal(lostAfterRead.snapshotConfirmed, false);
      assert.equal(lostAfterRead.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), current);
      const probe = {
        ...operation,
        operationId: "OP-234567",
        recoveryId: "host-operation.OP-234567",
        purpose: "isolation_probe",
      } as const;
      const probeAccess: HostOperationAccess = {
        root: { directory: root },
        revalidate: (kind, target) =>
          allowed &&
          kind === "operation.record" &&
          target.operationId === probe.operationId,
      };
      const probeStarted = saveOperationStart(probeAccess, {
        kind: "host_operation",
        value: probe,
      });
      assert.equal(probeStarted.startSaved, true, JSON.stringify(probeStarted));
      const snapshot = {
        resources: [
          {
            key: "probe",
            identity: {
              kind: "container",
              dockerId: null,
              name: "probe",
              ownershipLabel: "probe=fixture",
            },
            request: "not_issued",
            configuration: {
              image: "fixture",
              command: null,
              environmentNames: null,
              mounts: null,
              networks: null,
              internal: null,
            },
          },
        ],
      };
      const cleanup = {
        cleanupOrder: ["probe"],
        setupTimeoutMs: 10000,
        unreceiptedAbsence: "retain",
        verifyLabelAbsence: true,
      };
      const resources = applyResourceEvent(null, {
        event: "submission",
        key: "probe",
        snapshot,
        cleanup,
      });
      assert.ok(resources);
      const active = {
        ...probe,
        phase: "active",
        rootIdentity: next.rootIdentity,
        childIdentities: Object.fromEntries(
          [
            "workspace",
            "providerHome",
            "tmp",
            "events",
            "projection",
            "management",
          ].map((key) => [key, next.rootIdentity]),
        ),
        resources,
      } as const;
      const captured = decodeHostOperation(active);
      assert.ok(captured?.resources);
      assert.notEqual(captured.resources, resources);
      assert.equal(
        Object.isFrozen(captured.resources.snapshot.resources),
        true,
      );
      assert.equal(
        Object.isFrozen(captured.resources.snapshot.resources[0]?.identity),
        true,
      );
      assert.equal(decodeHostOperation({ ...active, purpose: "advice" }), null);
      assert.equal(
        decodeHostOperation({ ...active, phase: "preparing" }),
        null,
      );
      assert.equal(
        decodeHostOperation({
          ...active,
          resources: {
            ...resources,
            cleanup: { ...resources.cleanup, unreceiptedAbsence: "observe" },
          },
        }),
        null,
      );
      let getters = 0;
      const getterBook = Object.defineProperty({ ...resources }, "snapshot", {
        enumerable: true,
        get() {
          getters++;
          return resources.snapshot;
        },
      });
      assert.equal(
        decodeHostOperation({ ...active, resources: getterBook }),
        null,
      );
      assert.equal(getters, 0);
      const uncertain: HostOperationRecord = {
        ...active,
        resources: {
          ...resources,
          snapshot: {
            resources: resources.snapshot.resources.map((item) => ({
              ...item,
              request: "unknown",
            })),
          },
        },
      };
      const notIssued = {
        ...uncertain,
        resources: {
          ...resources,
          snapshot: resources.snapshot,
          checkpoints: resources.checkpoints.map((item) => ({
            ...item,
            submission: "not_issued",
          })),
        },
      };
      assert.equal(validHostOperationTransition(active, notIssued), true);
      assert.equal(
        validHostOperationTransition(notIssued, {
          ...notIssued,
          phase: "terminal",
          cleanup: "confirmed",
        }),
        true,
      );
      const receipt = {
        ...active,
        resources: applyResourceEvent(uncertain.resources, {
          event: "receipt",
          key: "probe",
          cleanup,
          snapshot: {
            resources: [
              {
                ...snapshot.resources[0],
                request: "issued",
                identity: {
                  ...snapshot.resources[0]?.identity,
                  dockerId: "a".repeat(64),
                },
              },
            ],
          },
        }),
      };
      assert.ok(receipt.resources);
      const rediscovered = {
        ...receipt,
        resources: {
          ...receipt.resources,
          checkpoints: receipt.resources.checkpoints.map((item) => ({
            ...item,
            receiptSource: "docker_observation",
          })),
        },
      };
      assert.equal(decodeHostOperation(rediscovered), null);
      const terminal = {
        ...receipt,
        phase: "terminal",
        cleanup: "confirmed",
        resources: {
          ...receipt.resources,
          checkpoints: receipt.resources.checkpoints.map((item) => ({
            ...item,
            observation: "absent",
            absenceEvidenceSha256: "b".repeat(64),
          })),
        },
      };
      let version = {
        revision: probeStarted.revision,
        payloadSha256: probeStarted.payloadSha256,
      };
      for (const [value, confirmed] of [
        [active, true],
        [uncertain, true],
        [notIssued, false],
        [{ ...active, phase: "terminal", cleanup: "confirmed" }, false],
        [receipt, true],
        [rediscovered, false],
        [active, false],
        [{ ...receipt, resources: null }, false],
        [terminal, true],
      ] as const) {
        const before = fs.readFileSync(stateFile);
        const result = saveOperationCheckpoint(probeAccess, probe.recoveryId, {
          kind: "host_operation",
          value: { operation: value, expectedVersion: version },
        });
        assert.equal(
          result.snapshotConfirmed,
          confirmed,
          JSON.stringify(result),
        );
        if (confirmed)
          version = {
            revision: result.revision,
            payloadSha256: result.payloadSha256,
          };
        else assert.deepEqual(fs.readFileSync(stateFile), before);
      }
      const finalState = JSON.parse(fs.readFileSync(stateFile, "utf8")) as {
        operations: HostOperationRecord[];
      };
      const originals = finalState.operations.filter(
        (item) => item.recoveryId === operation.recoveryId,
      );
      assert.equal(originals.length, 1);
      assert.deepEqual(originals[0], next);
      assert.equal(
        fs.existsSync(path.join(root, ".crdd", "coordinator")),
        false,
      );
    });
});

/**
 * 旧領域の残置から新しい空状態を作らない。
 * @responsibility 移行の未知と新規Repositoryをmetadata境界で区別する。
 * @trace PRL-IT-012
 * @precondition 既存helperが所有する合成Rootのみ。
 * @stimulus 旧Directory・File・link・観測不能を用意して同じ公開初期化を呼ぶ。
 * @observation 公開拒否、旧内容の保全、新領域とstateの不存在。
 * @oracle 処置前の不明は作成零。出版中の後発出現はunknownとpendingを保持し、再入場で上書きしない。
 * @cleanup mockを復元し、自己生成Rootだけを既存helperで回収する。
 * @boundary 公開Core APIと実Filesystem。過去保持物は使わない。
 */
test("保存先切替は旧領域の存在と観測不能を空初期化へ変換しない", async (t) => {
  const scenarios = [
    "directory",
    "file",
    "link",
    "unobservable",
    "parent_changed",
    "appears_before_publish",
    "absent",
  ];
  for (const kind of scenarios)
    await t.test(`domain-model: ${kind}`, () => {
      const directory = createRepositoryTestDirectory("runtime-area-switch-");
      try {
        const root = directory.path;
        fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
          recursive: true,
        });
        fs.mkdirSync(path.join(root, ".git", "info"));
        fs.writeFileSync(
          path.join(root, ".git", "info", "exclude"),
          ".crdd/\n",
        );
        fs.writeFileSync(
          path.join(root, ".git", "config"),
          "[core]\nrepositoryformatversion = 0\nbare = false\n",
        );
        fs.writeFileSync(
          path.join(root, ".git", "HEAD"),
          "ref: refs/heads/main\n",
        );
        fs.writeFileSync(
          path.join(root, ".git", "refs", "heads", "main"),
          `${"1".repeat(40)}\n`,
        );
        fs.mkdirSync(path.join(root, ".crdd"));
        const legacy = path.join(root, ".crdd", "domain-model");
        const current = path.join(root, ".crdd", "execution-model");
        const coordinator = path.join(root, ".crdd", "coordinator");
        const coordinatorState = path.join(coordinator, "state.json");
        if (kind === "absent") {
          fs.mkdirSync(coordinator);
          fs.writeFileSync(coordinatorState, "synthetic old coordinator state");
        }
        if (kind === "directory") fs.mkdirSync(legacy);
        if (kind === "file") fs.writeFileSync(legacy, "synthetic old state");
        if (kind === "link") {
          const target = path.join(root, "synthetic-old-target");
          fs.mkdirSync(target);
          fs.symlinkSync(target, legacy, "junction");
        }
        const access: ExecutionModelAccess = {
          root: { directory: root },
          principalId: "synthetic",
          revalidate: () => true,
        };
        const request = {
          projectId: "project",
          milestoneId: "milestone",
          expectedAbsence: true,
        } as const;
        const original = fs.lstatSync;
        let mock: ReturnType<typeof t.mock.method> | undefined;
        let legacyObserved = false;
        if (kind === "unobservable" || kind === "parent_changed")
          mock = t.mock.method(fs, "lstatSync", ((
            ...args: Parameters<typeof fs.lstatSync>
          ) => {
            if (String(args[0]) === legacy) {
              legacyObserved = true;
              throw Object.assign(new Error("synthetic"), {
                code: kind === "unobservable" ? "EACCES" : "ENOENT",
              });
            }
            const observed = original(...args);
            if (
              kind === "parent_changed" &&
              legacyObserved &&
              String(args[0]) === path.join(root, ".crdd") &&
              typeof observed?.ino === "bigint"
            ) {
              const changed = Object.create(observed);
              Object.defineProperty(changed, "ino", {
                value: observed.ino + 1n,
              });
              return changed;
            }
            return observed;
          }) as typeof fs.lstatSync);
        const originalOpen = fs.openSync;
        let pendingOpens = 0;
        const openMock = ["appears_before_publish", "parent_changed"].includes(
          kind,
        )
          ? t.mock.method(fs, "openSync", ((
              ...args: Parameters<typeof fs.openSync>
            ) => {
              if (
                String(args[0]) === path.join(current, "state.pending.json") &&
                args[1] === "wx"
              ) {
                pendingOpens++;
                if (kind === "appears_before_publish" && !fs.existsSync(legacy))
                  fs.mkdirSync(legacy);
              }
              return originalOpen(...args);
            }) as typeof fs.openSync)
          : undefined;
        let result: ReturnType<typeof initializeExecutionState>;
        try {
          result = initializeExecutionState(access, request);
        } finally {
          mock?.mock.restore();
          openMock?.mock.restore();
        }
        if (kind === "appears_before_publish") {
          assert.equal(result.status, "unknown", JSON.stringify(result));
          assert.equal(result.reason, "publication_unconfirmed");
          assert.equal(fs.existsSync(path.join(current, "state.json")), false);
          assert.equal(fs.existsSync(legacy), true);
          const markerFile = path.join(current, "state.lock");
          const pendingFile = path.join(current, "state.pending.json");
          const pending = fs.readFileSync(pendingFile);
          const pendingValue = JSON.parse(pending.toString("utf8"));
          assert.ok(
            decodeStateSnapshot(pending, pendingValue.repositoryBinding),
          );
          const repeated = initializeExecutionState(access, request);
          assert.notEqual(repeated.status, "saved");
          assert.equal(fs.existsSync(markerFile), false);
          assert.deepEqual(fs.readFileSync(pendingFile), pending);
          assert.equal(fs.existsSync(path.join(current, "state.json")), false);
        } else if (kind !== "absent") {
          if (kind === "parent_changed") {
            assert.equal(pendingOpens, 0);
            for (const name of [
              "state.json",
              "state.pending.json",
              "state.lock",
            ])
              assert.equal(fs.existsSync(path.join(current, name)), false);
          }
          assert.equal(result.status, "blocked", JSON.stringify(result));
          if (kind === "parent_changed") {
            assert.equal(result.reason, "state_unavailable");
          }
          assert.equal(fs.existsSync(current), false);
          if (kind === "file")
            assert.equal(
              fs.readFileSync(legacy, "utf8"),
              "synthetic old state",
            );
        } else {
          assert.equal(result.status, "saved", JSON.stringify(result));
          assert.equal(fs.existsSync(path.join(current, "state.json")), true);
          assert.deepEqual(fs.readdirSync(coordinator), ["state.json"]);
          assert.equal(
            fs.readFileSync(coordinatorState, "utf8"),
            "synthetic old coordinator state",
          );
          fs.mkdirSync(legacy);
          const bytes = fs.readFileSync(path.join(current, "state.json"));
          assert.notEqual(
            queryPlan(access, {
              projectId: request.projectId,
              milestoneId: request.milestoneId,
            }).status,
            "blocked",
          );
          assert.equal(
            initializeExecutionState(access, request).status,
            "blocked",
          );
          assert.deepEqual(
            fs.readFileSync(path.join(current, "state.json")),
            bytes,
          );
        }
      } finally {
        directory.cleanup();
      }
    });
});

/**
 * 新Schemaの一般CRUDが同じReader・Writerへ本番接続していることを確認する。
 * @responsibility 型付き公開API・参照拒否・CAS・解放・状態区画の非捏造を検証する。
 * @trace PRL-IT-012
 * @precondition 新しい合成Gitだけを使う。
 * @stimulus 初期化、Plan保存、個別追加・更新・削除、失効と再送を行う。
 * @observation 公開結果と実際の単一state.json。
 * @oracle 管理実行・Operation・Selectionを作らず、競合・逆依存を拒否する。
 * @cleanup exactな自己生成Rootを既存helperで確認後削除する。
 * @boundary 外部AI・Docker・過去保持物は使用しない。
 */
test("Coreだけで初期化・一般CRUD・現在認可とCASを同じ実Storeへ接続する", (t) => {
  const directory = createRepositoryTestDirectory("runtime-core-crud-");
  t.after(directory.cleanup);
  const root = directory.path;
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "refs", "heads", "main"),
    `${"1".repeat(40)}\n`,
  );
  let allowed = true;
  let checks = 0;
  const access: ExecutionModelAccess = {
    root: { directory: root },
    principalId: "principal-a",
    revalidate: () => {
      checks++;
      return allowed;
    },
  };
  const target = { projectId: "project-a", milestoneId: "milestone-a" };
  const initialized = initializeExecutionState(access, {
    ...target,
    expectedAbsence: true,
  });
  assert.equal(initialized.status, "saved", JSON.stringify(initialized));
  if (initialized.status !== "saved") return;
  assert.equal(
    initializeExecutionState(access, { ...target, expectedAbsence: true })
      .status,
    "blocked",
  );
  const plan = {
    milestoneAcceptanceCriteria: ["全体確認"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["確認"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/code.ts"],
        conflictKeys: [],
      },
    ],
  };
  const request = {
    ...target,
    expected: initialized.version,
    expectedDefinitionHash: null,
    definition: plan,
  };
  assert.deepEqual(savePlan(access, request), {
    status: "blocked",
    value: null,
    reason: "state_unavailable",
  });
  const saved = savePlan(
    { ...access, initialSourceRevision: "1".repeat(40) },
    request,
  );
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  if (saved.status !== "saved") return;
  const queue = queryQueue(access, target);
  assert.equal(queue.status, "available", JSON.stringify(queue));
  if (queue.status === "available") assert.deepEqual(queue.value, []);
  assert.equal(
    savePlan(access, {
      ...target,
      expected: initialized.version,
      expectedDefinitionHash: null,
      definition: plan,
    }).status,
    "conflict",
  );
  const observed = queryPlan(access, target);
  assert.equal(observed.status, "available");
  if (observed.status !== "available") return;
  assert.deepEqual(observed.value.definition, plan);
  const objective = createObjective(access, {
    ...target,
    expected: saved.version,
    definition: { id: "objective-b", acceptanceCriteria: ["追加確認"] },
  });
  assert.equal(objective.status, "saved", JSON.stringify(objective));
  if (objective.status !== "saved") return;
  assert.equal(
    deleteObjective(access, {
      ...target,
      expected: objective.version,
      objectiveId: "objective-a",
      expectedDefinitionHash: "0".repeat(64),
    }).status,
    "conflict",
  );
  const tasks = queryTasks(access, target);
  assert.equal(tasks.status, "available");
  if (tasks.status !== "available") return;
  const original = tasks.value[0];
  assert.ok(original);
  const added = createTask(access, {
    ...target,
    expected: objective.version,
    definition: {
      id: "task-b",
      objectiveId: "objective-b",
      dependencies: ["task-a"],
      allowedPaths: ["tests/test.ts"],
      conflictKeys: [],
    },
  });
  assert.equal(added.status, "saved", JSON.stringify(added));
  if (added.status !== "saved") return;
  assert.equal(
    deleteTask(access, {
      ...target,
      expected: added.version,
      taskId: "task-a",
      expectedDefinitionHash: original.definitionHash,
    }).status,
    "blocked",
  );
  const changed = updateTask(access, {
    ...target,
    expected: added.version,
    taskId: "task-b",
    expectedDefinitionHash: added.value.definitionHash,
    definition: { ...added.value.definition, dependencies: [] },
  });
  assert.equal(changed.status, "saved", JSON.stringify(changed));
  if (changed.status !== "saved") return;
  const removed = deleteTask(access, {
    ...target,
    expected: changed.version,
    taskId: "task-b",
    expectedDefinitionHash: changed.value.definitionHash,
  });
  assert.equal(removed.status, "saved", JSON.stringify(removed));
  const file = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(file);
  const state = JSON.parse(before.toString("utf8"));
  assert.equal(state.schema, "crdd-execution-model/state/v9");
  for (const key of ["managedExecutions", "operations", "unresolvedRecoveries"])
    assert.deepEqual(state[key], []);
  for (const key of ["pendingDeliveries", "resultReceipts"])
    assert.equal(Object.hasOwn(state, key), false);
  assert.equal(checks > 10, true);
  allowed = false;
  assert.deepEqual(queryPlan(access, target), {
    status: "blocked",
    value: null,
    reason: "not_authorized",
  });
  assert.equal(
    savePlan(access, {
      ...target,
      expected: observed.version,
      expectedDefinitionHash: observed.value.definitionHash,
      definition: plan,
    }).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), before);
  allowed = true;
  const legacy = Buffer.from(
    `${JSON.stringify({
      ...state,
      schema: "crdd-execution-model/state/v7",
    })}\n`,
  );
  fs.writeFileSync(file, legacy);
  let preparationCalls = 0;
  assert.equal(queryPlan(access, target).status, "unknown");
  assert.notEqual(
    initializeExecutionState(
      access,
      { ...target, expectedAbsence: true },
      () => {
        preparationCalls++;
        return true;
      },
    ).status,
    "saved",
  );
  assert.equal(preparationCalls, 0);
  assert.deepEqual(fs.readFileSync(file), legacy);
  assert.equal(
    fs.existsSync(path.join(path.dirname(file), "state.pending.json")),
    false,
  );
});
/**
 * 保存途中失敗を自己生成実Storeで反証する。
 * @responsibility 共通pending再入場・出版後不明・解放不明と認可失効を区別する。
 * @trace PRL-IT-012
 * @precondition 一つずつ独立した新SchemaのRepositoryだけを使う。
 * @stimulus 同じSource閉包へrename・読戻し・解放・認可の限定故障を注入する。
 * @observation 公開結果、元版・次版byte、pendingと履歴の保全。
 * @oracle 不明を成功へ丸めず、同じpendingだけが既存再入場で確定する。
 * @cleanup 既存helperで今回Rootだけを確認後清掃する。
 * @boundary 実Filesystem・既存Kernel排他。外部AI・Dockerなし。
 */
test("一般CRUDは既存Writerの失敗・再入場・解放不明をそのまま返す", async (t) => {
  for (const mode of [
    "rename_before",
    "rename_after",
    "readback",
    "release",
    "authorization",
  ] as const) {
    await t.test(mode, (t) => {
      const directory = createRepositoryTestDirectory("runtime-core-failure-");
      t.after(directory.cleanup);
      const root = directory.path;
      fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(root, ".git", "info"));
      fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
      fs.writeFileSync(
        path.join(root, ".git", "config"),
        "[core]\nrepositoryformatversion = 0\nbare = false\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "refs", "heads", "main"),
        `${"1".repeat(40)}\n`,
      );
      let allowed = true;
      const access: ExecutionModelAccess = {
        root: { directory: root },
        principalId: "principal-a",
        initialSourceRevision: "1".repeat(40),
        revalidate: () => allowed,
      };
      const target = { projectId: "project-a", milestoneId: "milestone-a" };
      const initial = initializeExecutionState(access, {
        ...target,
        expectedAbsence: true,
      });
      assert.equal(initial.status, "saved");
      if (initial.status !== "saved") return;
      const plan = {
        milestoneAcceptanceCriteria: ["全体確認"],
        objectives: [{ id: "objective-a", acceptanceCriteria: ["確認"] }],
        tasks: [
          {
            id: "task-a",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["src/code.ts"],
            conflictKeys: [],
          },
        ],
      };
      const file = path.join(root, ".crdd", "execution-model", "state.json");
      const before = fs.readFileSync(file);
      const pending = path.join(
        root,
        ".crdd",
        "execution-model",
        "state.pending.json",
      );
      let injected = 0,
        renamed = false;
      const hostFs = {
        ...fs,
        renameSync: (from: fs.PathLike, to: fs.PathLike) => {
          if (String(to) === file) {
            if (mode === "rename_before") {
              injected++;
              throw Error("synthetic_rename_before");
            }
            fs.renameSync(from, to);
            renamed = true;
            if (mode === "rename_after") {
              injected++;
              throw Error("synthetic_rename_after");
            }
          } else fs.renameSync(from, to);
        },
        openSync: ((...args: Parameters<typeof fs.openSync>) => {
          if (mode === "authorization" && String(args[0]) === pending) {
            injected++;
            allowed = false;
          }
          return fs.openSync(...args);
        }) as typeof fs.openSync,
      };
      const fixture = createRuntimeStorageSourceFixture(undefined, {
        fs: hostFs,
        readStableFileSnapshot: (
          ...args: Parameters<typeof readStableFileSnapshot>
        ) => {
          if (mode === "readback" && renamed && String(args[0]) === file) {
            injected++;
            throw Error("synthetic_readback");
          }
          return readStableFileSnapshot(...args);
        },
        acquireExecutionStateLock: (
          ...args: Parameters<typeof acquireExecutionStateLock>
        ) => {
          const lock = acquireExecutionStateLock(...args);
          if (lock.status !== "acquired" || mode !== "release") return lock;
          return {
            ...lock,
            lock: {
              ...lock.lock,
              release: () => {
                injected++;
                assert.equal(lock.lock.release(), true);
                return false;
              },
            },
          };
        },
      });
      const request = {
        ...target,
        expected: initial.version,
        expectedDefinitionHash: null,
        definition: plan,
      };
      const result = fixture.savePlan(access, request);
      assert.equal(injected > 0, true);
      assert.equal(result.status, "unknown", JSON.stringify(result));
      if (result.status !== "unknown") return;
      assert.deepEqual(result.recoveryReferences, []);
      assert.equal(
        result.publication,
        mode === "release" ? "confirmed" : "unconfirmed",
      );
      if (mode === "rename_before" || mode === "authorization")
        assert.deepEqual(fs.readFileSync(file), before);
      else assert.notDeepEqual(fs.readFileSync(file), before);
      if (mode === "release") {
        assert.equal(result.reason, "lock_release_unconfirmed");
        assert.equal(queryPlan(access, target).status, "available");
      }
      if (mode === "rename_before") {
        assert.equal(fs.existsSync(pending), true);
        const pendingBytes = fs.readFileSync(pending);
        const resumed = savePlan(access, request);
        assert.equal(resumed.status, "saved", JSON.stringify(resumed));
        assert.deepEqual(fs.readFileSync(file), pendingBytes);
        assert.equal(fs.existsSync(pending), false);
      }
      if (mode === "authorization")
        assert.equal(queryPlan(access, target).status, "blocked");
    });
  }
});

/**
 * 初回出版の失敗を成功や真正不存在へ丸めない。
 * @responsibility 初期化も同じpending・読戻し・解放契約を使うことを確認する。
 * @trace PRL-IT-012
 * @precondition 自己生成Repositoryに現在状態が存在しない。
 * @stimulus 初回renameの前と後に一度だけ故障を注入する。
 * @observation unknown、pending又は確定本文と次の公開読取り。
 * @oracle 初期化成功を返さず、残った正本・未確定候補を削除しない。
 * @cleanup 今回Rootだけを既存helperで確認後削除する。
 * @boundary AI・Dockerなしの実Filesystem。
 */
test("初期化途中の出版不明を保持し二重初期化を拒否する", async (t) => {
  for (const after of [false, true])
    await t.test(after ? "rename後" : "rename前", (t) => {
      const directory = createRepositoryTestDirectory(
        "runtime-core-initialize-",
      );
      t.after(directory.cleanup);
      const root = directory.path;
      fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(root, ".git", "info"));
      fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
      fs.writeFileSync(
        path.join(root, ".git", "config"),
        "[core]\nrepositoryformatversion = 0\nbare = false\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "refs", "heads", "main"),
        `${"1".repeat(40)}\n`,
      );
      const access: ExecutionModelAccess = {
        root: { directory: root },
        principalId: "test-principal",
        revalidate: () => true,
      };
      const file = path.join(root, ".crdd", "execution-model", "state.json");
      let injected = 0;
      const fixture = createRuntimeStorageSourceFixture(undefined, {
        fs: {
          ...fs,
          renameSync: (from: fs.PathLike, to: fs.PathLike) => {
            if (String(to) !== file) return fs.renameSync(from, to);
            injected++;
            if (after) fs.renameSync(from, to);
            throw Error("synthetic_initial_publication_failure");
          },
        },
      });
      const request = {
        projectId: "project-a",
        milestoneId: "milestone-a",
        expectedAbsence: true,
      } as const;
      const result = fixture.initializeExecutionState(access, request);
      assert.equal(injected, 1, JSON.stringify(result));
      assert.equal(result.status, "unknown", JSON.stringify(result));
      assert.equal(fs.existsSync(file), after);
      assert.equal(
        fs.existsSync(
          path.join(root, ".crdd", "execution-model", "state.pending.json"),
        ),
        !after,
      );
      assert.notEqual(
        initializeExecutionState(access, request).status,
        "saved",
      );
    });
});
/**
 * 共有する未束縛コードと、毎回独立する保存fixtureを反証する。
 * @responsibility 準備一回をMap・依存値・故障状態の共有へ拡張しない。
 * @trace ERB-IT-014
 * @precondition 新しい補助Moduleを一度だけ読込み、実保存を発行しない。
 * @stimulus 同署名の値差、引数名差、内部関数差、変異交互、例外とgetter。
 * @observation 固定Source読取り・VM生成回数、実際に生成したWeakMapと返却値。
 * @oracle 通常コードだけ再利用し、Map・Ownerキーと故障注入は相互に混入しない。
 * @cleanup mockを終了時に復元する。保存領域・子Processは作成しない。
 * @boundary 試験補助と実Source評価。実CAS・清掃成立は別の保存試験が所有する。
 */
test("保存Source準備: 不変コードだけを共有し各fixtureと変異を独立させる", async (t) => {
  let compilations = 0;
  let sourceReads = 0;
  const originalRead = fs.readFileSync;
  const files = new Set(
    [
      "storage/store.ts",
      "storage/lock.ts",
      "state/crud.ts",
      "state/lease.ts",
      "storage/publication.ts",
      "attempt/crud.ts",
      "decision/crud.ts",
      "history/crud.ts",
      "objective/crud.ts",
      "task/crud.ts",
      "workspace/crud.ts",
    ].map((file) => new URL("../../src/" + file, import.meta.url).href),
  );
  t.mock.method(
    fs,
    "readFileSync",
    (...args: Parameters<typeof fs.readFileSync>) => {
      if (args[0] instanceof URL && files.has(args[0].href)) sourceReads++;
      return originalRead(...args);
    },
  );
  t.mock.module("node:vm", {
    namedExports: {
      runInThisContext: (...args: Parameters<typeof vm.runInThisContext>) => {
        compilations++;
        return vm.runInThisContext(...args);
      },
    },
  });
  const moduleUrl = new URL(
    "../support/storage-source.ts?preparation-sharing",
    import.meta.url,
  ).href;
  const { createRuntimeStorageSourceFixture } = (await import(
    moduleUrl
  )) as typeof import("../support/storage-source.ts");
  const mapsA: WeakMap<object, unknown>[] = [];
  const mapsB: WeakMap<object, unknown>[] = [];
  const observeMaps = (maps: WeakMap<object, unknown>[]) =>
    function (this: object) {
      assert.ok(this, "WeakMapをnewで生成する経路だけを観測する");
      const map = new WeakMap<object, unknown>();
      maps.push(map);
      return map;
    };
  const first = createRuntimeStorageSourceFixture(undefined, {
    WeakMap: observeMaps(mapsA),
  });
  const second = createRuntimeStorageSourceFixture(undefined, {
    WeakMap: observeMaps(mapsB),
  });
  assert.equal(sourceReads, 11);
  assert.equal(compilations, 1, "同署名の未束縛factoryだけを再利用する");
  assert.ok(mapsA.length >= 3);
  assert.equal(mapsA.length, mapsB.length);
  const ownerA = Object.freeze({ owner: "a" });
  const ownerB = Object.freeze({ owner: "b" });
  mapsA.forEach((map, index) => {
    const other = mapsB[index];
    assert.ok(other);
    assert.notEqual(map, other);
    map.set(ownerA, "a");
    other.set(ownerB, "b");
    assert.equal(other.has(ownerA), false);
    assert.equal(map.has(ownerB), false);
  });
  assert.notEqual(first.readState, second.readState);

  const outcome = { status: "blocked", reason: "fixture_only" };
  const a = createRuntimeStorageSourceFixture(undefined, {
    writeStateSnapshot: () => outcome,
  });
  const b = createRuntimeStorageSourceFixture(undefined, {
    writeStateSnapshot: () => null,
  });
  assert.equal(compilations, 2);
  assert.equal(Reflect.apply(a.writeStateSnapshot, null, []), outcome);
  assert.equal(Reflect.apply(b.writeStateSnapshot, null, []), null);
  createRuntimeStorageSourceFixture(undefined, {
    writeStateSnapshot: () => outcome,
    extraDependency: 1,
  });
  assert.equal(compilations, 3, "未知依存名も署名へ含む");
  createRuntimeStorageSourceFixture(undefined, {
    writeStateSnapshot: () => null,
    extraDependency: 2,
  });
  assert.equal(compilations, 3);

  let transforms = 0;
  const transform = (value: string) => {
    transforms++;
    // 変異本文は元の例外class除去前に受け取る。
    assert.ok(value.includes("class ExecutionStorageBlockedError"));
    return value + "\nwriteStateSnapshot = () => " + transforms + ";\n";
  };
  const mutantA = createRuntimeStorageSourceFixture(transform);
  const normalA = createRuntimeStorageSourceFixture();
  const mutantB = createRuntimeStorageSourceFixture(transform);
  const normalB = createRuntimeStorageSourceFixture();
  assert.equal(transforms, 2);
  assert.equal(compilations, 6);
  assert.equal(Reflect.apply(mutantA.writeStateSnapshot, null, []), 1);
  assert.equal(Reflect.apply(mutantB.writeStateSnapshot, null, []), 2);
  assert.notEqual(normalA.writeStateSnapshot, mutantA.writeStateSnapshot);
  assert.notEqual(normalB.writeStateSnapshot, mutantB.writeStateSnapshot);
  const expected = new Error("transform_failed");
  assert.throws(
    () =>
      createRuntimeStorageSourceFixture(() => {
        throw expected;
      }),
    (error) => error === expected,
  );
  assert.throws(
    () => createRuntimeStorageSourceFixture((source) => source + "\n("),
    SyntaxError,
  );
  assert.throws(
    () =>
      createRuntimeStorageSourceFixture(
        (source) => source + "\nthrow new Error('evaluation_failed');",
      ),
    /evaluation_failed/u,
  );
  const before = compilations;
  createRuntimeStorageSourceFixture();
  assert.equal(compilations, before, "変異失敗後も通常factoryは使える");

  const order: string[] = [];
  const getterOverride = Object.defineProperty({}, "writeStateSnapshot", {
    enumerable: true,
    get() {
      order.push("get");
      return () => outcome;
    },
  });
  const withGetter = createRuntimeStorageSourceFixture(
    undefined,
    getterOverride,
  );
  assert.deepEqual(
    order,
    ["get", "get"],
    "依存捕捉→内部関数差替えの二回を維持する",
  );
  assert.equal(Reflect.apply(withGetter.writeStateSnapshot, null, []), outcome);
  const getterFailure = new Error("dependency_failed");
  assert.throws(
    () =>
      createRuntimeStorageSourceFixture(
        undefined,
        Object.defineProperty({}, "randomUUID", {
          enumerable: true,
          get() {
            throw getterFailure;
          },
        }),
      ),
    (error) => error === getterFailure,
  );
  createRuntimeStorageSourceFixture();
  const evaluationFailure = new Error("normal_evaluation_failed");
  const beforeFailedFactory = compilations;
  assert.throws(
    () =>
      createRuntimeStorageSourceFixture(undefined, {
        WeakMap: function (this: object) {
          assert.ok(this);
          throw evaluationFailure;
        },
        failedFactorySignature: true,
      }),
    (error) => error === evaluationFailure,
  );
  assert.equal(compilations, beforeFailedFactory + 1);
  createRuntimeStorageSourceFixture(undefined, {
    WeakMap: observeMaps([]),
    failedFactorySignature: true,
  });
  assert.equal(
    compilations,
    beforeFailedFactory + 2,
    "初回評価失敗のfactoryは保持しない",
  );
  createRuntimeStorageSourceFixture(undefined, {
    WeakMap: observeMaps([]),
    failedFactorySignature: true,
  });
  assert.equal(compilations, beforeFailedFactory + 2);
  assert.equal(
    sourceReads,
    11,
    "変異と故障を挟んでも不変Sourceは再読取りしない",
  );
});
