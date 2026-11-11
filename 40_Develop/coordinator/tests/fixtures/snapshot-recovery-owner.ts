/**
 * 現在の認証unknown回収を、共通DIと実Domain Writerへ接続する独立Process試験。
 * @responsibility 有限Docker端だけを代役にし、二段不存在・保存・削除前読戻しを反証する。
 * @trace ERB-IT-014
 * @boundary Host Windows試験からだけ起動する。実Docker・Provider要求は発行しない。
 */

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { mock } from "node:test";
import { runInThisContext } from "node:vm";
import type {
  IsolationCallbacks,
  ResourceSnapshot,
  ResourceTarget,
} from "../../../docker-isolation/src/index.ts";
import { createIsolationFixture } from "../../../docker-isolation/tests/support/isolation.ts";
import type { CoordinatorResourceBook } from "../../../domain-model/src/index.ts";
import {
  type CoordinatorStateOperation,
  coordinatorAuthenticationUnknownCanClose,
  coordinatorTaskResourcesAreSettled,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  readRuntimeOwnedCoordinatorRecoverySnapshot,
  writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure,
  writeRuntimeOwnedCoordinatorRecoveryCheckpoint,
} from "../../../domain-model/src/index.ts";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { getRepository } from "../../../version-control/src/index.ts";

const [root, operationId, recoveryId, scenario] = process.argv.slice(2);
assert.ok(root && operationId && recoveryId && scenario);
const permitted = new Set([
  "normal",
  "known_id",
  "known_id_mutant",
  "first_absence_unknown",
  "second_absence_unknown",
  "first_owner_lost",
  "second_owner_lost",
  "writer_refused",
  "writer_throw",
  "readback_mismatch",
  "release_unknown",
  "saved_reentry",
  "inner_close_failed",
  "outer_close_failed",
]);
assert.ok(permitted.has(scenario));
const repositoryRoot = fs.realpathSync(root);
const testsRoot = fs.realpathSync(
  path.resolve(import.meta.dirname, "../../../../.crdd/tests"),
);
const relative = path.relative(testsRoot, repositoryRoot);
assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
const verified = getRepository(repositoryRoot);
assert.equal(verified.status, "completed");
assert.ok(verified.capability);
// CoordinatorがDIを読み込む前に、外部CLI端の有限代役を接続する。
const f = await createIsolationFixture({ mock });
// 設定OwnerがDI Rootを読む前に、CLI・環境の有限境界を接続する。
const { getIsolationSettings } = await import(
  "../../src/execution/configuration.ts"
);
const { borrowRuntimeOwnedCoordinatorRecoveryRepository } = await import(
  "../../src/execution/operation.ts"
);
const observed = borrowRuntimeOwnedCoordinatorRecoveryRepository(
  verified.capability,
);
assert.ok(observed);
const repository = { ...observed, operationId };
const stateFile = path.join(
  repositoryRoot,
  ".crdd",
  "domain-model",
  "state.json",
);
const before: Buffer = fs.readFileSync(stateFile);
const initial = decodeRuntimeDomainSnapshot(
  before,
  repository.repositoryBinding,
);
assert.ok(initial);
const operation = initial.snapshot.operations.find(
  (op) => op.kind === "docker_task" && op.recoveryId === recoveryId,
);
assert.ok(operation?.kind === "docker_task" && operation.resources);
assert.equal(JSON.parse(operation.identityJson).operationId, operationId);
const original = operation.resources;
const auth = original.snapshot.resources.find(
  (r) => r.key === "create_subscription_auth_probe",
);
assert.ok(auth?.identity.kind === "container");
const management = path.join(
  repositoryRoot,
  ".crdd",
  "tests",
  `snapshot-recovery-${scenario}`,
);
assert.equal(
  fs.realpathSync(path.dirname(management)),
  path.dirname(management),
);
fs.mkdirSync(management);
const container = f.request.resources[0];
assert.ok(container?.kind === "container");
f.useRequest(
  {
    ...f.request,
    managementDirectory: management,
    resources: [
      {
        ...container,
        key: auth.key,
        name: auth.identity.name,
        ownershipLabel: auth.identity.ownershipLabel,
      },
    ],
    steps: f.request.steps.map((step) => ({ ...step, resource: auth.key })),
    cleanupOrder: [auth.key],
  },
  "codex",
);
const prepared = f.api.prepareIsolation(f.request, getIsolationSettings());
assert.ok(prepared);
const created = await f.api.executeIsolation(prepared).completion;
assert.equal(created.cleanup.confirmed, true);
const actualId = created.resources.resources[0]?.identity.dockerId;
assert.ok(actualId);
f.ids.clear();
if (scenario === "known_id" || scenario === "known_id_mutant")
  f.ids.add(actualId);
f.calls.length = 0;
const owner = {},
  record = {
    kind: "recovery",
    rootCapability: verified.capability,
    repository,
    recoveryId,
    before,
    closed: false,
    persistenceFailed: false,
    cleanupUnknown: false,
    hostCleanup: "present",
    hostCleanupPublication: null,
    hostToken: "fixture-host",
    hostGeneration: "fixture-generation",
  };
let live = true,
  queries = 0,
  rounds = 0,
  closureWrites = 0,
  removals = 0,
  oracleHits = 0,
  mismatches = 0;
const events: string[] = [];
const source = fs.readFileSync(
  new URL("../../src/execution/recovery.ts", import.meta.url),
  "utf8",
);
const names = [
  "projectResourceTarget",
  "persistRuntimeOwnedDockerTaskRecoveryCheckpoint",
  "recoverRuntimeOwnedDockerTaskResources",
];
const body = names.map((name) => sourceDeclaration(source, name)).join("\n");
const needle = '{ event: "identified", key, snapshot, cleanup: book.cleanup }';
assert.equal(body.split(needle).length - 1, 1);
const mutant = body.replace(
  needle,
  '{ event: "identified", key, snapshot: { resources: snapshot.resources.map(r => r.key === key ? {...r, identity: {...r.identity, dockerId: "e".repeat(64)}} : r) }, cleanup: book.cleanup }',
);
assert.notEqual(body, mutant);
const read = () =>
  readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
const currentSnapshot = read();
assert.equal(currentSnapshot.status, "completed", currentSnapshot.reason);
assert.ok(currentSnapshot.value);
assert.ok(
  Buffer.from(
    `${encodeRuntimeStateValue(currentSnapshot.value.snapshot)}\n`,
  ).equals(before),
  "fixture_snapshot_must_match_driver_input",
);
const driver =
  runInThisContext(`(dependencies)=>{const {Buffer,encodeRuntimeStateValue,decodeRuntimeDomainSnapshot,dockerRecoveryPreparations,borrowHostRecoveryManagementDirectory,coordinatorTaskResourcesAreSettled,coordinatorAuthenticationUnknownCanClose,coordinatorReleasedTaskCanObserveHostAbsence,assertCurrentRecoveryOwner,readRuntimeOwnedCoordinatorRecoverySnapshot,writeRuntimeOwnedCoordinatorRecoveryCheckpoint,writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure}=dependencies;
${scenario === "known_id_mutant" ? mutant : body}
return recoverRuntimeOwnedDockerTaskResources;}`)({
    Buffer,
    encodeRuntimeStateValue,
    decodeRuntimeDomainSnapshot: decodeRuntimeDomainSnapshot,
    dockerRecoveryPreparations: new WeakMap([[owner, record]]),
    borrowHostRecoveryManagementDirectory: () => ({
      directory: management,
      assertCurrent: () => live,
    }),
    coordinatorTaskResourcesAreSettled,
    coordinatorAuthenticationUnknownCanClose,
    coordinatorReleasedTaskCanObserveHostAbsence: () => false,
    assertCurrentRecoveryOwner: () => {
      events.push("owner");
      return live;
    },
    readRuntimeOwnedCoordinatorRecoverySnapshot: () => {
      events.push("read");
      const value = read();
      return scenario === "readback_mismatch" && closureWrites && value.value
        ? {
            ...value,
            value: {
              ...value.value,
              snapshot: {
                ...value.value.snapshot,
                revision: value.value.snapshot.revision + 1,
              },
            },
          }
        : value;
    },
    writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
      ...args: Parameters<typeof writeRuntimeOwnedCoordinatorRecoveryCheckpoint>
    ) => {
      events.push(`write:${args[3]}`);
      return writeRuntimeOwnedCoordinatorRecoveryCheckpoint(...args);
    },
    writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure: (
      ...args: Parameters<
        typeof writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure
      >
    ) => {
      closureWrites++;
      events.push("write:closure");
      if (scenario === "writer_throw") throw Error("synthetic_closure_failure");
      if (scenario === "writer_refused")
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
        };
      const result = writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
        ...args,
      );
      return scenario === "release_unknown"
        ? { ...result, lockReleased: false }
        : result;
    },
  });
const originalPush = f.calls.push.bind(f.calls);
f.calls.push = (...items: string[][]): number => {
  for (const argv of items)
    if (argv.includes("rm")) {
      oracleHits++;
      const value: CoordinatorStateOperation | undefined =
        read().value?.snapshot.operations.find(
          (op) => op.kind === "docker_task" && op.recoveryId === recoveryId,
        );
      assert.ok(value?.kind === "docker_task" && value.resources);
      const saved: ResourceSnapshot["resources"][number] | undefined =
        value.resources.snapshot.resources.find((r) => r.key === auth.key);
      const checkpoint:
        | CoordinatorResourceBook["checkpoints"][number]
        | undefined = value.resources.checkpoints.find(
        (c) => c.key === auth.key,
      );
      if (saved?.identity.dockerId !== actualId) mismatches++;
      assert.equal(
        saved?.identity.dockerId,
        actualId,
        "削除前に同じ発見実IDを実Writerへ保存する",
      );
      assert.equal(checkpoint?.receiptSource, "runtime_reconciliation");
      removals++;
      events.push("remove");
    }
  return originalPush(...items);
};
// 追加不存在の同期CLI端だけを有限化する。未知要求は実CLIへ委譲しない。
const originalSpawnSync = childProcess.spawnSync;
const spawn = mock.method(
  childProcess,
  "spawnSync",
  (executable: unknown, input: unknown, options: unknown) => {
    if (
      executable !==
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    ) {
      assert.ok(Array.isArray(input));
      assert.ok(options && typeof options === "object");
      assert.equal((options as { shell?: unknown }).shell, false);
      assert.equal(executable, "git");
      assert.equal(input[0], "-C");
      assert.equal(input[1], repositoryRoot);
      assert.equal(input[2], "rev-parse");
      // Domain/VCが元々行う固定読取りだけを元の境界へ戻す。
      return Reflect.apply(originalSpawnSync, childProcess, [
        executable,
        input,
        options,
      ]);
    }
    assert.equal(
      executable,
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    );
    assert.ok(Array.isArray(input));
    const argv = input.slice(4);
    assert.equal(argv[0], "container");
    assert.equal(argv[1], "ls");
    assert.ok(argv.includes("--filter"));
    assert.ok(argv.some((v) => String(v).includes(auth.identity.name)));
    queries++;
    const round = Math.ceil(queries / 2);
    const failed =
      (scenario === "first_absence_unknown" && round === 1) ||
      (scenario === "second_absence_unknown" && round === 2);
    if (queries % 2 === 0 || failed) {
      events.push(`round:${round}`);
    }
    if (
      (scenario === "first_owner_lost" && round === 1 && queries % 2 === 0) ||
      (scenario === "second_owner_lost" && round === 2 && queries % 2 === 0)
    )
      live = false;
    return {
      status: failed ? 1 : 0,
      signal: null,
      stdout: "",
      stderr: "",
      error: undefined,
    };
  },
);
syncBuiltinESMExports();
const realRmdir = fs.rmdirSync;
mock.method(
  fs,
  "rmdirSync",
  (directory: fs.PathLike, ...options: unknown[]) => {
    if (path.basename(String(directory)).startsWith("docker-recovery-config-"))
      events.push("close:inner");
    if (String(directory) === path.join(management, "docker-cli-config"))
      events.push("close:outer");
    if (
      path.basename(String(directory)).startsWith("docker-recovery-config-") &&
      scenario === "inner_close_failed"
    )
      throw Error("synthetic_inner_close_failed");
    if (
      String(directory) === path.join(management, "docker-cli-config") &&
      scenario === "outer_close_failed"
    )
      throw Error("synthetic_outer_close_failed");
    return Reflect.apply(realRmdir, fs, [directory, ...options]);
  },
);
try {
  const { inspectIsolation } = await import(
    "../../../docker-isolation/src/cleanup/resources.ts"
  );
  const result = await driver(
    owner,
    (target: ResourceTarget<"snapshot">, callbacks: IsolationCallbacks) =>
      f.api.cleanupIsolation(target, getIsolationSettings(), callbacks),
    (
      target: ResourceTarget<"snapshot">,
      options?: Readonly<{
        signal?: AbortSignal;
        stopOnUnknownAbsence?: boolean;
      }>,
    ) => {
      const inspection = inspectIsolation(
        target,
        getIsolationSettings(),
        options,
      );
      events.push(`inspect:${inspection.status}:${inspection.reason}`);
      // 発見用の追加CLI照会を、不存在確認のround数へ混入させない。
      rounds =
        inspection.resources.find((resource) => resource.key === auth.key)
          ?.absenceObservations.length ?? 0;
      return inspection;
    },
  );
  const completed = ["normal", "known_id", "saved_reentry"].includes(scenario);
  assert.equal(result.recoveryId, recoveryId);
  assert.equal(
    result.status,
    completed ? "completed" : "blocked",
    JSON.stringify({ scenario, result, events }),
  );
  assert.equal(
    result.dockerCleanupConfirmed,
    completed || scenario === "outer_close_failed",
  );
  assert.equal(record.hostCleanup, "present");
  const inner = events.indexOf("close:inner"),
    outer = events.indexOf("close:outer");
  const expectsInner = !["known_id", "known_id_mutant"].includes(scenario);
  assert.equal(
    events.filter((e) => e === "close:inner").length,
    expectsInner ? 1 : 0,
  );
  assert.equal(events.filter((e) => e === "close:outer").length, 1);
  if (expectsInner)
    assert.ok(inner >= 0 && outer > inner, "内側・外側の両closeを順に試す");
  assert.equal(removals, scenario === "known_id" ? 1 : 0);
  assert.equal(
    oracleHits,
    ["known_id", "known_id_mutant"].includes(scenario) ? 1 : 0,
  );
  assert.equal(mismatches, scenario === "known_id_mutant" ? 1 : 0);
  const shouldSave = [
    "normal",
    "writer_refused",
    "writer_throw",
    "readback_mismatch",
    "release_unknown",
    "saved_reentry",
    "outer_close_failed",
  ].includes(scenario);
  assert.equal(closureWrites, shouldSave ? 1 : 0);
  assert.equal(
    rounds,
    ["known_id", "known_id_mutant"].includes(scenario)
      ? 0
      : scenario === "first_absence_unknown"
        ? 1
        : 2,
  );
  if (shouldSave) {
    const write = events.indexOf("write:closure"),
      second = events.indexOf("round:2");
    assert.ok(second >= 0 && write > second);
    assert.ok(inner > second && inner < write && outer > write);
    assert.ok(events.slice(second + 1, write).includes("owner"));
    assert.ok(events.slice(second + 1, write).includes("read"));
  }
  if (scenario === "saved_reentry")
    assert.equal(events.includes("write:cleanup"), false);
  if (scenario.endsWith("close_failed")) {
    const callCount = f.calls.length,
      closeCount = events.filter((e) => e.startsWith("close:")).length,
      writeCount = closureWrites;
    assert.equal(
      (
        await driver(
          owner,
          (target: ResourceTarget<"snapshot">, callbacks: IsolationCallbacks) =>
            f.api.cleanupIsolation(target, getIsolationSettings(), callbacks),
          (
            target: ResourceTarget<"snapshot">,
            options?: Readonly<{
              signal?: AbortSignal;
              stopOnUnknownAbsence?: boolean;
            }>,
          ) => inspectIsolation(target, getIsolationSettings(), options),
        )
      ).status,
      "blocked",
    );
    assert.equal(f.calls.length, callCount);
    assert.equal(closureWrites, writeCount);
    assert.equal(
      events.filter((e) => e.startsWith("close:")).length,
      closeCount,
    );
  }
  const persisted = read().value?.snapshot.operations.find(
    (op) => op.kind === "docker_task" && op.recoveryId === recoveryId,
  );
  assert.ok(persisted?.kind === "docker_task" && persisted.resources);
  assert.deepEqual({ ...persisted, resources: original }, operation);
  assert.deepEqual(persisted.resources.cleanup, original.cleanup);
  for (const resource of persisted.resources.snapshot.resources) {
    const previous = original.snapshot.resources.find(
      (r) => r.key === resource.key,
    );
    assert.ok(previous);
    if (resource.key !== auth.key) {
      assert.deepEqual(resource, previous);
      continue;
    }
    assert.equal(resource.identity.kind, previous.identity.kind);
    assert.equal(resource.identity.name, previous.identity.name);
    assert.equal(
      resource.identity.ownershipLabel,
      previous.identity.ownershipLabel,
    );
    const checkpoint:
      | CoordinatorResourceBook["checkpoints"][number]
      | undefined = persisted.resources.checkpoints.find(
      (c) => c.key === resource.key,
    );
    assert.ok(checkpoint);
    if (scenario === "known_id" || scenario === "known_id_mutant") {
      assert.equal(
        resource.identity.dockerId,
        scenario === "known_id" ? actualId : "e".repeat(64),
      );
      // 発見Receiptは実IDを確定するが、過去の作成要求unknownを改変しない。
      assert.equal(resource.request, "unknown");
      assert.equal(checkpoint.receiptSource, "runtime_reconciliation");
      assert.equal(
        checkpoint.observation,
        scenario === "known_id" ? "absent" : "present",
      );
    } else {
      assert.equal(resource.identity.dockerId, null);
      assert.equal(resource.request, "unknown");
      assert.equal(checkpoint.receiptSource, null);
      const savedAbsence = [
        "normal",
        "readback_mismatch",
        "release_unknown",
        "saved_reentry",
        "outer_close_failed",
      ].includes(scenario);
      const previousCheckpoint = original.checkpoints.find(
        (c) => c.key === resource.key,
      );
      assert.ok(previousCheckpoint);
      // 二段不存在の保存前に停止した場合、観測済みという新事実を捏造しない。
      assert.equal(
        checkpoint.observation,
        savedAbsence ? "absent" : previousCheckpoint.observation,
      );
      if (!savedAbsence) assert.deepEqual(checkpoint, previousCheckpoint);
      assert.deepEqual(
        {
          ...checkpoint,
          observation: previousCheckpoint.observation,
          absenceEvidenceSha256: previousCheckpoint.absenceEvidenceSha256,
        },
        previousCheckpoint,
      );
    }
  }
  for (const c of persisted.resources.checkpoints)
    if (c.key !== auth.key)
      assert.deepEqual(
        c,
        original.checkpoints.find((prior) => prior.key === c.key),
      );
  process.stdout.write(
    JSON.stringify({
      scenario,
      completed,
      recoveryId,
      rounds,
      closureWrites,
      removals,
      oracleHits,
      mismatches,
    }) + "\n",
  );
} finally {
  spawn.mock.restore();
  syncBuiltinESMExports();
  mock.restoreAll();
  syncBuiltinESMExports();
  // 自分が作った技術管理領域だけ。有限Docker状態であり実資源は存在しない。
  const relativeManagement = path.relative(
    path.join(repositoryRoot, ".crdd", "tests"),
    management,
  );
  assert.equal(relativeManagement, `snapshot-recovery-${scenario}`);
  fs.rmSync(management, { recursive: true, force: false });
}
