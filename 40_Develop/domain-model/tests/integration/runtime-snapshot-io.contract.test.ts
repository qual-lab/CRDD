/**
 * 共通Snapshotの物理読取り・保存失敗をDomain自身で反証する。
 * @packageDocumentation
 * @responsibility pending・marker・観測不能・境界置換の保存保証を所有する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
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
import { types as utilTypes } from "node:util";
import { runInNewContext, runInThisContext } from "node:vm";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  type CoordinatorState,
  type CoordinatorStateTaskOperation,
  coordinatorTaskResourcesAreSettled,
  decodeRuntimeDomainSnapshot as decodeCoordinatorStateSnapshot,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  isDockerRestartCheckpointSettled,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorUnifiedTaskSnapshot,
  projectCoordinatorTaskSnapshot,
  readCoordinatorCurrentState,
  requireReadyRepositoryRuntimeDataArea,
  saveCoordinatorManagedProject,
} from "../../src/index.ts";
import { acquireRuntimeOwnedCoordinatorStateKernelLock as acquireRuntimeOwnedProjectStateKernelLock } from "../../src/storage/runtime-kernel-lock.ts";
import {
  leaseIdentity,
  leaseAcquisitionRecoveryId,
} from "../../src/state/validation.ts";
import { acquireCoordinatorSnapshotPilotLock } from "../../src/storage/runtime-lock.ts";
import {
  describeCoordinatorDurableFoundation,
  initializeCoordinatorSnapshot as initializeSnapshot,
  readCoordinatorSnapshot,
  writeCoordinatorSnapshot,
  writeCoordinatorSnapshotState,
} from "../../src/storage/runtime-store.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { sourceDeclaration } from "../support/source-declaration.ts";
import * as domain from "../../src/index.ts";
import * as privateStore from "../../src/storage/runtime-store.ts";
import { observeRuntimeStorageRepository } from "../../src/storage/runtime-repository.ts";
import { createRuntimeStorageSourceFixture } from "../support/runtime-storage-source.ts";

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
  const area = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "current_admission_test",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "current-admission-"));
  let releaseResult = true;
  let releaseThrows = false;
  let live = true;
  let acquisitions = 0;
  let releases = 0;
  let afterAbsent: (() => void) | null = null;
  let areaFailure: ReturnType<typeof domain.ensureRepositoryRuntimeDataArea> =
    null;
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
    const verified = verifyRepositoryRoot(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const binding = observeRuntimeStorageRepository(verified.capability);
    assert.ok(binding);
    const store = createRuntimeStorageSourceFixture(undefined, {
      ensureRepositoryRuntimeDataArea: (
        ...args: Parameters<typeof domain.ensureRepositoryRuntimeDataArea>
      ) => {
        if (areaThrows) throw new Error("fixture_partial_area_creation");
        return areaFailure ?? domain.ensureRepositoryRuntimeDataArea(...args);
      },
      createCoordinatorRuntimeDataArea: (
        ...args: Parameters<typeof domain.createCoordinatorRuntimeDataArea>
      ) => {
        areaCreations++;
        return domain.createCoordinatorRuntimeDataArea(...args);
      },
      observeRepositoryRuntimeDataArea: (
        ...args: Parameters<typeof domain.observeRepositoryRuntimeDataArea>
      ) => {
        const value = domain.observeRepositoryRuntimeDataArea(...args);
        if (value.status === "not_observed" && afterAbsent) {
          const hook = afterAbsent;
          afterAbsent = null;
          hook();
        }
        return value;
      },
      acquireRuntimeOwnedCoordinatorStateKernelLock: () => {
        acquisitions++;
        return {
          assertLive: () => live,
          release: () => {
            releases++;
            if (releaseThrows) throw new Error("fixture_release");
            return releaseResult;
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
        taskStore.initializeCoordinatorSnapshot(
          verified.capability,
          "binding-a",
        );
      } catch (error) {
        failure = error;
      }
      assert.ok(
        failure instanceof domain.RepositoryRuntimeDataAreaBlockedError,
      );
      assert.equal(releases, beforeReleases + 1);
      assert.equal(areaCreations, 0);
      assert.equal(
        fs.existsSync(path.join(root, ".crdd", "coordinator")),
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
    const exceptional = taskStore.initializeCoordinatorSnapshot(
      verified.capability,
      "binding-a",
    );
    assert.equal(exceptional.status, "blocked");
    assert.equal(exceptional.manualRecoveryRequired, true);
    assert.equal(releases, beforeExceptionalRelease + 1);
    assert.equal(areaCreations, 0);
    areaThrows = false;
    const inspect = (directory: string) => {
      const observed = verifyRepositoryRoot(directory);
      return store.readRuntimeOwnedCoordinatorAdmissionSnapshot(
        observed.status === "completed" ? observed.capability : null,
      );
    };
    const current = path.join(root, ".crdd", "coordinator");
    assert.equal(
      store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability)
        .status,
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
    const headBeforeAbsence = fs.readFileSync(path.join(root, ".git", "HEAD"));
    try {
      afterAbsent = () =>
        fs.writeFileSync(
          path.join(root, ".git", "HEAD"),
          "ref: refs/heads/unborn-fixture\n",
        );
      assert.equal(inspect(root).status, "blocked");
      assert.equal(afterAbsent, null);
      assert.equal(fs.existsSync(current), false);
    } finally {
      afterAbsent = null;
      fs.writeFileSync(path.join(root, ".git", "HEAD"), headBeforeAbsence);
    }
    afterAbsent = () => fs.mkdirSync(current, { recursive: true });
    assert.equal(inspect(root).status, "blocked");
    assert.equal(afterAbsent, null);
    assert.equal(inspect(root).status, "blocked");
    assert.deepEqual(fs.readdirSync(current), []);
    const file = path.join(current, "state.json");
    const bytes = Buffer.from(
      `${encodeRuntimeStateValue({
        schema: COORDINATOR_STATE_SCHEMA,
        revision: 1,
        previous: null,
        repositoryBinding: binding.repositoryBinding,
        repositoryBindingId: null,
        intakeEpoch: null,
        intakeBindings: [],
        projects: [],
        managedExecutions: [],
        workspaces: [],
        queueEntries: [],
        leaseEvidence: [],
        leaseIntents: [],
        results: [],
        historyPending: [],
        acceptanceDecisions: [],
        decisionRecoveries: [],
        operations: [],
        unresolvedRecoveries: [],
        pendingDeliveries: [],
        resultReceipts: [],
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
    const head = path.join(root, ".git", "HEAD");
    const originalHead = fs.readFileSync(head);
    try {
      fs.writeFileSync(head, "ref: refs/heads/unborn-fixture\n");
      assert.equal(inspect(root).status, "blocked");
    } finally {
      fs.writeFileSync(head, originalHead);
    }
    assert.equal(inspect(root).status, "completed");
    assert.equal(acquisitions, releases);
    assert.deepEqual(fs.readdirSync(current), ["state.json"]);
    assert.deepEqual(fs.readFileSync(file), bytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const emptyTaskSections = {
  repositoryBindingId: null,
  intakeEpoch: null,
  projects: [],
  managedExecutions: [],
  queueEntries: [],
  workspaces: [],
  intakeBindings: [],
  leaseEvidence: [],
  leaseIntents: [],
  results: [],
  historyPending: [],
  acceptanceDecisions: [],
  decisionRecoveries: [],
  resultReceipts: [],
};

/**
 * 保存の実行観測依存をDomainの有限Repository観測へ限定する。
 * @responsibility 移管前のController値依存禁止を新しい保存Ownerで維持する。
 * @trace ERB-IT-004
 * @precondition 現行保存Sourceだけを読む。
 * @stimulus 型消去後のimportを照合する。
 * @observation 禁止依存と有限観測Moduleへの直接接続。
 * @oracle Controllerへ依存せずruntime-repositoryへ接続する。
 * @cleanup 読取りだけで資源なし。
 * @boundary Domain保存OwnerのSource境界。Host・Dockerは実行しない。
 */
test("保存観測はControllerに依存せず有限Repository観測へ接続する", () => {
  const runtime = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/storage/runtime-store.ts", import.meta.url),
      "utf8",
    ),
  );
  assert.doesNotMatch(runtime, /from\s+["'][^"']*controller\.ts["']/);
  assert.match(runtime, /from\s+["'][^"']*runtime-repository\.ts["']/);
});

const storeSource = fs.readFileSync(
  new URL("../../src/storage/runtime-store.ts", import.meta.url),
  "utf8",
);
const storeStart = storeSource.indexOf(
  "export function writeRuntimeOwnedCoordinatorRecoveryCheckpoint(",
);
const storeEnd = storeSource.indexOf("\n/**", storeStart);
assert.ok(storeStart >= 0 && storeEnd > storeStart);
const storeBody = stripTypeScriptTypes(
  storeSource
    .slice(storeStart, storeEnd)
    .replace("export function", "function"),
);
const cleanupStoreStart = storeSource.indexOf(
  "export function writeRuntimeOwnedCoordinatorRecoveredHostCleanup(",
);
const cleanupStoreEnd = storeSource.indexOf("\n/**", cleanupStoreStart);
assert.ok(cleanupStoreStart >= 0 && cleanupStoreEnd > cleanupStoreStart);
const cleanupStoreBody = stripTypeScriptTypes(
  storeSource
    .slice(cleanupStoreStart, cleanupStoreEnd)
    .replace("export function", "function"),
);
/**
 * 保存guardの入力値だけを組み立てる。
 * @responsibility Host処置やcodecの成立とは区別した有限Writer反例を提供する。
 * @trace ERB-IT-014
 * @returns 同一操作・五用途の未要求値と固定Host遷移。
 * @boundary 値だけ。Host実体・技術実行・公開Capabilityは生成しない。
 */
function recoveryWriterValues() {
  const binding = "a".repeat(64);
  const nonce = "b".repeat(64);
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token =
    "host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc." +
    hostHash;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v2",
    operationNonce: nonce,
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "low",
      purpose: "task",
      catalogIdentity:
        "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
      configIdentity:
        "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
      role: "executor",
      workType: null,
      source: "explicit",
    },
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const identityJson = `${JSON.stringify(identity)}\n`;
  const identitySha256 = createHash("sha256")
    .update(identityJson)
    .digest("hex");
  const recoveryId =
    "docker-task." +
    identity.stableLogicalHomeBindingHash +
    "." +
    nonce +
    "." +
    identitySha256;

  const prepared = prepareCoordinatorStateOperationSnapshot(
    null,
    identityJson,
    binding,
  );
  assert.ok(prepared);
  const preparedState = decodeCoordinatorStateSnapshot(prepared, binding);
  assert.ok(preparedState);
  const initialOperation = preparedState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(initialOperation);
  assert.equal(initialOperation.kind, "docker_task");
  const operation = {
    ...initialOperation,
    host: { ...initialOperation.host },
    execution: { ...initialOperation.execution },
    resources: initialOperation.resources.map((resource) => ({ ...resource })),
  };
  const snapshot = { ...preparedState.snapshot, operations: [operation] };
  return {
    token: recoveryId,
    snapshot,
    repository: {
      operationId: identity.operationId,
      repositoryBinding: binding,
      revalidate: () => true,
    },
    installHostTransition() {
      const rootName = hostRecord.rootName;
      const nonce = "12345678-1234-4234-8234-123456789abc";
      const recordBefore = {
        ...hostRecord,
        state: "docker_submission_started",
      };
      const expectedRecord = {
        ...recordBefore,
        state: "docker_absent_confirmed",
      };
      const hash = (value: unknown) =>
        createHash("sha256")
          .update(JSON.stringify(value) + "\n")
          .digest("hex");
      const currentToken = ["host", rootName, nonce, hash(recordBefore)].join(
        ".",
      );
      const expectedToken = [
        "host",
        rootName,
        nonce,
        hash(expectedRecord),
      ].join(".");
      operation.host.currentToken = currentToken;
      operation.host.pendingTransitionJson = (JSON.stringify({
        currentToken,
        expectedToken,
        rootName,
        nonce,
        currentState: recordBefore.state,
        nextState: expectedRecord.state,
        recordBefore,
      }) + "\n") as unknown as null;
      operation.execution.ownerEffect = "disabled";
      assert.ok(
        decodeRuntimeDomainSnapshot(
          Buffer.from(encodeRuntimeStateValue(snapshot) + "\n"),
          binding,
        ),
      );
      return { currentToken, expectedToken };
    },
  };
}

/**
 * 固定Writer本文が保存済みHost意図以外のtoken変更を拒否する。
 * @responsibility 元版・同操作・既知終了とpending解除を保存要求前に照合する。
 * @trace ERB-IT-014
 * @precondition 本番Writer本文と模擬Reader／候補生成／物理Writerを使う。
 * @stimulus exact後続、意図欠落、別遷移、別token、Owner／資源不明、清掃変更と古い元版を与える。
 * @observation 候補生成数、物理保存要求数と返却status。
 * @oracle exactのHost token確定だけ候補・保存各一回、それ以外は両方0。
 * @cleanup 合成境界だけ。実Storage CAS・Docker・Host処置は対象外。
 * @boundary ERB-IT-014=Related 2 Blocks: 固定途中Writer→候補生成／物理保存。
 */
test("現在回収Writerは保存済みHost後続tokenと不変欄を共同確認する", () => {
  for (const fault of [
    "none",
    "no_intent",
    "other_token",
    "other_transition",
    "owner",
    "resource",
    "cleanup",
    "pending",
    "before",
  ] as const) {
    const f = recoveryWriterValues();
    const tokens = f.installHostTransition();
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    const before = Buffer.from(`${encodeRuntimeStateValue(f.snapshot)}\n`);
    const update = {
      ...operation.host,
      currentToken: tokens.expectedToken,
      pendingTransitionJson: null as string | null,
    };
    if (fault === "no_intent") operation.host.pendingTransitionJson = null;
    if (fault === "other_token")
      update.currentToken = tokens.currentToken.replace(/.$/u, "0");
    if (fault === "other_transition") {
      const intent = JSON.parse(
        operation.host.pendingTransitionJson as unknown as string,
      );
      intent.nextState = "host_only";
      operation.host.pendingTransitionJson = JSON.stringify(
        intent,
      ) as unknown as null;
    }
    if (fault === "owner") operation.execution.ownerEffect = "active";
    if (fault === "resource") {
      const resource = operation.resources[0];
      assert.ok(resource);
      operation.resources[0] = { ...resource, request: "unknown" };
    }
    if (fault === "cleanup") update.cleanup = "confirmed";
    if (fault === "pending")
      update.pendingTransitionJson = operation.host.pendingTransitionJson;
    let prepares = 0,
      writes = 0;
    const invoke = runInNewContext(
      `${storeBody}\nwriteRuntimeOwnedCoordinatorRecoveryCheckpoint`,
      {
        Buffer,
        coordinatorTaskResourcesAreSettled: (
          value: Parameters<typeof coordinatorTaskResourcesAreSettled>[0],
        ) =>
          coordinatorTaskResourcesAreSettled(JSON.parse(JSON.stringify(value))),
        encodeRuntimeStateValue,
        readCoordinatorStateSnapshot: () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot: f.snapshot },
        }),
        prepareCoordinatorStateHostSnapshot: () => {
          prepares++;
          return Buffer.from("fixed candidate");
        },
        writeCoordinatorStateSnapshot: (
          _owner: unknown,
          repository: { revalidate: () => boolean } | null,
        ) => {
          if (repository === null) return { status: "blocked" };
          assert.equal(repository.revalidate(), true);
          writes++;
          return { status: "completed" };
        },
      },
    );
    // 故障別の現在本文へ結合し、before故障だけ旧本文を渡す。
    const currentBefore =
      fault === "before"
        ? Buffer.concat([before, Buffer.from(" ")])
        : Buffer.from(`${encodeRuntimeStateValue(f.snapshot)}\n`);
    const result = invoke(
      f.repository,
      f.token,
      currentBefore,
      "host",
      update,
      () => true,
    );
    assert.equal(
      result.status,
      fault === "none" ? "completed" : "blocked",
      fault,
    );
    assert.equal(prepares, fault === "none" ? 1 : 0, fault);
    assert.equal(writes, fault === "none" ? 1 : 0, fault);
  }
});

/**
 * Host清掃確定Writerの固定一欄とOwnerを確認する。
 * @responsibility 汎用checkpointを緩めず、正当な清掃後Ownerだけを既存Writerへ搬送する。
 * @trace ERB-IT-014
 * @precondition 本番Writer本文と合成Reader／物理Writerを使用する。
 * @stimulus 正常と元版差・Owner差・遷移残存・未終端資源・失効を与える。
 * @observation 純粋candidateと物理Writerの到達数、固定Host欄。
 * @oracle 正常だけpendingからconfirmed、拒否時candidate／Writer0。
 * @cleanup N/A: 合成I/Oだけで実資源なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 清掃終端Writer→Reader／物理保存。
 */
test("現在Host清掃Writerは固定元版・既知終端と保持中Ownerだけを受理する", () => {
  for (const fault of [
    "none",
    "before",
    "owner",
    "cleanup",
    "pending",
    "active",
    "resource",
    "reader",
    "live",
  ] as const) {
    const f = recoveryWriterValues(),
      operation = f.snapshot.operations[0];
    assert.ok(operation);
    operation.host.cleanup = "pending" as typeof operation.host.cleanup;
    operation.execution.ownerEffect = "disabled";
    assert.ok(
      decodeRuntimeDomainSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(f.snapshot)}\n`),
        f.repository.repositoryBinding,
      ),
    );
    if (fault === "cleanup") operation.host.cleanup = "not_requested";
    if (fault === "pending")
      operation.host.pendingTransitionJson = "{}" as unknown as null;
    if (fault === "active") operation.execution.ownerEffect = "active";
    if (fault === "resource")
      operation.resources = operation.resources.map((resource, index) =>
        index === 0 ? { ...resource, request: "unknown" } : resource,
      );
    const before = Buffer.from(`${encodeRuntimeStateValue(f.snapshot)}\n`);
    let candidates = 0,
      writes = 0;
    const invoke = runInNewContext(
      `${cleanupStoreBody}\nwriteRuntimeOwnedCoordinatorRecoveredHostCleanup`,
      {
        Buffer,
        coordinatorTaskResourcesAreSettled: (
          value: Parameters<typeof coordinatorTaskResourcesAreSettled>[0],
        ) =>
          coordinatorTaskResourcesAreSettled(JSON.parse(JSON.stringify(value))),
        encodeRuntimeStateValue,
        readCoordinatorStateSnapshot: () => ({
          status: "completed",
          lockReleased: fault !== "reader",
          value: { snapshot: f.snapshot },
        }),
        prepareCoordinatorStateHostSnapshot: (
          _before: Buffer,
          id: string,
          host: unknown,
        ) => {
          candidates++;
          assert.equal(id, f.token);
          assert.deepEqual(JSON.parse(JSON.stringify(host)), {
            ...operation.host,
            cleanup: "confirmed",
          });
          return Buffer.from("fixed cleanup candidate");
        },
        writeCoordinatorStateSnapshot: (
          _owner: unknown,
          repository: { revalidate: () => boolean } | null,
        ) => {
          if (!repository) return { status: "blocked" };
          assert.equal(repository.revalidate(), true);
          writes++;
          return { status: "completed" };
        },
      },
    );
    const result = invoke(
      {
        ...f.repository,
        operationId: fault === "owner" ? "other" : f.repository.operationId,
      },
      f.token,
      fault === "before" ? Buffer.concat([before, Buffer.from(" ")]) : before,
      () => fault !== "live",
    );
    assert.equal(
      result.status,
      fault === "none" ? "completed" : "blocked",
      fault,
    );
    assert.equal(candidates, fault === "none" ? 1 : 0, fault);
    assert.equal(writes, fault === "none" ? 1 : 0, fault);
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
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const branchStart = readerSource.indexOf(
    '    if (allowUninitialized && initial.status === "not_observed") {',
  );
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
        verified: { capability: {} },
        observeRepositoryRuntimeDataArea: () => ({ status: "not_observed" }),
        repository: { revalidate: () => true },
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
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  const cap = verified.capability;
  assert.equal(
    domain.initializeCoordinatorSnapshot(cap, "binding-a").status,
    "completed",
  );
  assert.equal(
    domain.saveCoordinatorManagedProject(cap, "binding-a", state, 0).status,
    "completed",
  );
  const initial = readCoordinatorSnapshot(root, "binding-a").value;
  assert.ok(initial);
  const queue = domain.createCoordinatorQueueEntry(
    cap,
    "binding-a",
    initial.intakeEpoch,
    {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: "b".repeat(64),
      originLane: "scheduled",
      repositoryRevision: "a".repeat(40),
      scopeHash: "c".repeat(64),
    },
  );
  assert.equal(queue.status, "completed");
  if (queue.status !== "completed") throw Error("fixture_queue_invalid");
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
  const reserved = domain.reserveCoordinatorLeaseAcquisition(
    cap,
    "binding-a",
    "binding-a",
    "project-a",
    queueId,
    "project-operation",
    identity,
    intent,
    {
      resourcesAbsent: () => true,
      observeRoot: () => ({
        repositoryRoot: root,
        rootIdentity: "f".repeat(64),
      }),
      markIntentSaveRequested: () => {},
    },
  );
  assert.equal(reserved.status, "completed", JSON.stringify(reserved));
  const current = path.join(root, ".crdd", "coordinator", "state.json");
  const leaseSnapshot = readCoordinatorSnapshot(root, "binding-a").value;
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
          schema: "crdd-coordinator/orchestrator-durable-foundation/v1",
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
      writeCoordinatorSnapshot(
        root,
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
      "coordinator",
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
      writeCoordinatorSnapshot(
        root,
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
    domain.saveCoordinatorIntegrationRecord(
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
  const payload = readCoordinatorSnapshot(root, "binding-a").value;
  assert.ok(payload);
  const rootHash = payload.repositoryRootHash;
  const before = fs.readFileSync(current, "utf8");
  const next = { ...payload, snapshotRevision: payload.snapshotRevision + 1 };
  for (const invalid of [
    {
      ...next,
      intakeBindings: [{ queueId: "queue-a", epoch: "different-epoch" }],
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
      writeCoordinatorSnapshot(
        root,
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
      "coordinator",
      "state.pending.json",
    );
    const pending: string = `${JSON.stringify({ payload: invalid, contentHash: createHash("sha256").update(JSON.stringify(invalid)).digest("hex"), baseRevision: payload.snapshotRevision, baseHash: createHash("sha256").update(before).digest("hex") })}\n`;
    fs.writeFileSync(pendingPath, pending);
    assert.equal(
      writeCoordinatorSnapshot(
        root,
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
    "coordinator",
    "state.pending.json",
  );
  fs.writeFileSync(pendingPath, pending);
  assert.equal(
    writeCoordinatorSnapshot(
      root,
      "binding-a",
      JSON.stringify(next),
      payload.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), before);
  assert.equal(fs.readFileSync(pendingPath, "utf8"), pending);

  fs.unlinkSync(pendingPath);
  const decision: domain.CoordinatorAcceptanceDecisionRecord = {
    recordId: "decision-a",
    decisionId: "authority-a",
    sourceSpecId: "SPEC-000002",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    expectedGeneration: 1,
    target: "objective",
    targetId: "objective-a",
    decision: "accept",
    criterionEvidenceIds: ["evidence-a"],
    principalId: "principal-a",
    disposition: "prepared",
    newGeneration: null,
  };

  assert.equal(
    domain.createCoordinatorAcceptanceDecision(
      cap,
      "binding-a",
      "binding-a",
      decision,
    ).status,
    "completed",
  );
  const finalized = {
    ...decision,
    disposition: "finalized" as const,
    newGeneration: 2,
  };
  assert.equal(
    domain.finalizeCoordinatorAcceptanceDecision(
      cap,
      "binding-a",
      "binding-a",
      decision,
      finalized,
    ).status,
    "completed",
  );
  const recovery: domain.CoordinatorDecisionRecoveryIntent = {
    recoveryId: "recovery-a",
    recordId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 1,
    newGeneration: 2,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  };

  assert.equal(
    domain.createCoordinatorDecisionRecovery(cap, "binding-a", recovery).status,
    "completed",
  );
  const settled = { ...recovery, disposition: "settled" as const };
  assert.equal(
    domain.updateCoordinatorDecisionRecovery(
      cap,
      "binding-a",
      recovery,
      settled,
    ).status,
    "completed",
  );
  const file = current;
  const observed = readCoordinatorSnapshot(root, "binding-a");
  assert.ok(observed.value);
  for (const malformed of [
    {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      acceptanceDecisions: observed.value.acceptanceDecisions.filter(
        (item) => item.generation === 2,
      ),
    },
    {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      decisionRecoveries: [
        { generation: 2, value: { ...settled, secret: "forbidden" } },
      ],
    },
    {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      decisionRecoveries: [{ generation: 2, snapshot: settled }],
    },
    {
      ...observed.value,
      snapshotRevision: observed.value.snapshotRevision + 1,
      decisionRecoveries: [
        { generation: 2, value: settled },
        { generation: 2, value: settled },
      ],
    },
    {
      ...observed.value,
      schema: "unknown",
      snapshotRevision: observed.value.snapshotRevision + 1,
    },
  ]) {
    const unchanged = fs.readFileSync(file, "utf8");
    assert.equal(
      writeCoordinatorSnapshot(
        root,
        "binding-a",
        JSON.stringify(malformed),
        observed.value.snapshotRevision,
      ).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(file, "utf8"), unchanged);
  }
});

/**
 * 通常初期化の一回証拠と物理置換を保存Owner内で確認する。
 * @responsibility 初期化再使用、fresh Reader、別Root、同bytes置換とpendingを区別する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition 自己生成Git Rootと有限の合成Host観測を使用する。
 * @stimulus 実Writerと実Filesystemへ正負の初期化・更新を発行する。
 * @observation 本文、Hash、pending、marker、排他解放と再入場。
 * @oracle 偽Owner・異なる実体・競合は無出版で停止する。
 * @cleanup 今回Rootだけを既存helperで清掃する。
 * @boundary 保存の試験。合成Host観測を実Host終了の証拠にしない。
 */
test("Host Windows: 初期化証拠とpending再入場は元Rootと本文に結合する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const { root } = fixture(t);
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
  const verifiedRoot = verifyRepositoryRoot(root);
  assert.equal(verifiedRoot.status, "completed");
  if (verifiedRoot.status !== "completed") throw Error("fixture_root_invalid");
  const observed = observeRuntimeStorageRepository(verifiedRoot.capability);
  assert.ok(observed);
  domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tmp"),
    "initialization_fixture",
  );
  const repository = { ...observed, operationId: "OP-123456" };
  const management = Object.freeze({
    identity: Object.freeze({}),
    observeRepository: () => ({
      purpose: "execution" as const,
      root: verifiedRoot.capability,
      operationId: repository.operationId,
      revalidate: repository.revalidate,
    }),
    verifyNotIssued: () => false,
  });
  const first = {
    ...emptyTaskSections,
    schema: domain.COORDINATOR_STATE_SCHEMA,
    revision: 1,
    previous: null,
    repositoryBinding: repository.repositoryBinding,
    operations: [],
    unresolvedRecoveries: [],
    pendingDeliveries: [],
  };
  const firstBytes = Buffer.from(`${encodeRuntimeStateValue(first)}\n`);
  assert.equal(
    privateStore.readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    privateStore.prepareRuntimeOwnedCoordinatorStateInitialization(
      management,
      firstBytes,
    ).status,
    "prepared",
  );
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "coordinator"),
    "state_root",
  );
  assert.equal(
    privateStore.prepareRuntimeOwnedCoordinatorStateInitialization(
      management,
      firstBytes,
    ).status,
    "blocked",
  );
  assert.equal(
    privateStore.writeRuntimeOwnedCoordinatorStateSnapshot({}, firstBytes)
      .filesystemEffectIssued,
    false,
  );
  const result = privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
    management,
    firstBytes,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.snapshotConfirmed, true);
  assert.equal(result.lockReleased, true);
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  const readFirst =
    privateStore.readRuntimeOwnedCoordinatorStateSnapshot(management);
  assert.equal(readFirst.status, "completed");
  assert.equal(readFirst.lockReleased, true);
  assert.equal(readFirst.value?.snapshot.revision, 1);
  assert.equal(
    readFirst.value?.payloadSha256,
    domain.hashRuntimeStateContent(first),
  );
  assert.equal(
    privateStore.readRuntimeOwnedCoordinatorStateSnapshot({}).status,
    "blocked",
  );
  const recoveryRead = domain.readRuntimeOwnedCoordinatorRecoverySnapshot(
    verifiedRoot.capability,
  );
  assert.equal(recoveryRead.status, "completed");
  assert.equal(recoveryRead.lockReleased, true);
  assert.deepEqual(recoveryRead.value, readFirst.value);
  for (const invalidRoot of [null, {}, { ...verifiedRoot.capability }, root]) {
    const rejectedRoot =
      domain.readRuntimeOwnedCoordinatorRecoverySnapshot(invalidRoot);
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
     const { verifyRepositoryRoot } = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
     const domain = await import(${JSON.stringify(new URL("../../src/index.ts", import.meta.url).href)});
     const root = verifyRepositoryRoot(process.argv[1]);
     const result = domain.readRuntimeOwnedCoordinatorRecoverySnapshot(root.capability);
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
  const verifiedOtherRoot = verifyRepositoryRoot(otherRoot);
  assert.ok(verifiedOtherRoot.capability);
  const otherArea = path.join(otherRoot, ".crdd", "coordinator");
  fs.mkdirSync(otherArea, { recursive: true });
  fs.writeFileSync(path.join(otherArea, "state.json"), firstBytes, {
    flag: "wx",
  });
  const foreignSnapshot = domain.readRuntimeOwnedCoordinatorRecoverySnapshot(
    verifiedOtherRoot.capability,
  );
  assert.equal(foreignSnapshot.status, "blocked");
  assert.equal(foreignSnapshot.value, null);
  assert.deepEqual(
    fs.readFileSync(path.join(otherArea, "state.json")),
    firstBytes,
  );
  const borrowedOtherRoot = observeRuntimeStorageRepository(
    verifiedOtherRoot.capability,
  );
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
    domain.readRuntimeOwnedCoordinatorRecoverySnapshot(verifiedRoot.capability)
      .status,
    "blocked",
  );
  assert.equal(fs.existsSync(path.join(area.directory, "state.json")), false);
  assert.equal(
    privateStore.readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
      management,
      firstBytes,
    ).filesystemEffectIssued,
    false,
  );
  assert.equal(
    privateStore.prepareRuntimeOwnedCoordinatorStateInitialization(
      management,
      firstBytes,
    ).status,
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
      payloadSha256: domain.hashRuntimeStateContent(first),
    },
  };
  const secondBytes = Buffer.from(`${encodeRuntimeStateValue(second)}\n`);
  // 同じ本文への実体差し替えを、公開前の再観測で拒否する。
  const originalFsync = fs.fsyncSync;
  let isReplaced = false;
  fs.fsyncSync = (fd) => {
    originalFsync(fd);
    if (!isReplaced) {
      isReplaced = true;
      const state = path.join(area.directory, "state.json");
      fs.renameSync(state, path.join(root, "replaced-state"));
      fs.writeFileSync(state, firstBytes, { flag: "wx" });
    }
  };
  try {
    const replacement = privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
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
  fs.unlinkSync(path.join(area.directory, "state.lock"));
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
    privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
      management,
      secondBytes,
    ).status,
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
    privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
      management,
      secondBytes,
    ).status,
    "completed",
  );
  fs.writeFileSync(path.join(area.directory, "state.pending.json"), "invalid", {
    flag: "wx",
  });
  assert.equal(
    privateStore.readRuntimeOwnedCoordinatorStateSnapshot(management).reason,
    "coordinator_state_reentry_required",
  );
  assert.equal(
    domain.readRuntimeOwnedCoordinatorRecoverySnapshot(verifiedRoot.capability)
      .reason,
    "coordinator_state_reentry_required",
  );
  const rejected = privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
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
    privateStore.readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "blocked",
  );
  assert.equal(
    privateStore.writeRuntimeOwnedCoordinatorStateSnapshot(
      management,
      secondBytes,
    ).filesystemEffectIssued,
    false,
  );
  fs.unlinkSync(hardlink);
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
  assert.equal(
    initializeCoordinatorSnapshot(root, "binding-a").status,
    "completed",
  );
  assert.equal(
    writeCoordinatorSnapshotState(root, "binding-a", JSON.stringify(state), 0)
      .status,
    "completed",
  );
  const f = {
    root,
    binding: "binding-a",
    snapshot: () => {
      const read = readCoordinatorSnapshot(root, "binding-a");
      assert.equal(read.status, "completed");
      assert.ok(read.value);
      return read.value;
    },
  };

  const before = f.snapshot();
  const old = {
    ...before,
    schema: "crdd-coordinator/orchestrator-snapshot/v2",
    schemaRevision: 2,
    snapshotRevision: before.snapshotRevision + 1,
  };
  assert.equal(
    writeCoordinatorSnapshot(
      f.root,
      f.binding,
      JSON.stringify(old),
      before.snapshotRevision,
    ).status,
    "blocked",
  );
  assert.deepEqual(f.snapshot(), before);
  const { workspaces: _removed, ...missing } = before;
  assert.equal(
    writeCoordinatorSnapshot(
      f.root,
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
 * 確定版と同一の配送pendingをReaderが受理しない条件を反証する。
 * @responsibility 私有Reader条件の変異はDomain保存Owner内に閉じる。
 * @trace PRL-IT-005
 * @precondition 本番Sourceの対象条件を一意に抽出する。
 * @stimulus pending有無と元版／候補一致を組み合わせ、条件省略も比較する。
 * @observation 固定エラーと未拒否を区別する。
 * @oracle pendingかつ同一版だけが拒否され、条件省略はこのOracleを破る。
 * @cleanup N/A: 局所VMのみ。
 * @boundary 保存Readerの条件反証。実Filesystemの保証は別Caseが担う。
 */
test("配送Readerは確定版と同一のpendingを拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const guards = [
    ...source.matchAll(
      /if \(pending && candidate\.equals\(before\)\)\s*throw new Error\("current_delivery_already_published_pending"\);/gu,
    ),
  ];
  assert.equal(guards.length, 1);
  const guard = guards[0]?.[0];
  assert.ok(guard);
  const before = Buffer.from("fixed-publication");
  for (const pending of [null, { bytes: before }]) {
    for (const candidate of [
      Buffer.from(before),
      Buffer.from("different-publication"),
    ]) {
      const scope = { pending, candidate, before };
      if (pending && candidate.equals(before)) {
        assert.throws(
          () => runInNewContext(guard, scope),
          /current_delivery_already_published_pending/u,
        );
        assert.doesNotThrow(() =>
          runInNewContext(
            guard.replace("pending && candidate.equals(before)", "false"),
            scope,
          ),
        );
      } else assert.doesNotThrow(() => runInNewContext(guard, scope));
    }
  }
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
function initializeCoordinatorSnapshot(root: string, binding: string) {
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  return initializeSnapshot(verified.capability, binding);
}

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
  execFileSync("git", ["init", "--quiet", directory.path], {
    windowsHide: true,
  });
  const state = {
    contract: "crdd-coordinator/project-state/v2",
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
        resultAcceptances: [],
        recoveryUnresolved: false,
        candidateId: null,
        retryCount: 0,
        supersededBy: null,
      },
    ],
  } as CoordinatorState;
  return { root: directory.path, state };
}

/**
 * Task保存のpending作成前失敗と部分作成・観測不能を区別する。
 * @responsibility 今回作ったmarkerだけの回収と元本文保全を確認する。
 * @trace PRL-IT-005
 * @precondition 自己生成Repositoryに初期化済みの現行Snapshot。
 * @stimulus pendingのopen失敗、部分作成、観測不能、marker置換、既存marker、履歴pendingの後発出現を注入する。
 * @observation 保存結果、元本文、pendingとmarkerの実在、通常Readerと同候補再保存。
 * @oracle 新規markerかつpending不存在だけ回収し、他の残存は保持して停止する。
 * @cleanup 注入を復元し、自己生成fixtureだけを終了hookで回収する。
 * @boundary 実Filesystemと本番Writer。Docker・外部AI・既存保持物は使わない。
 */
test("Task保存のpending作成前失敗は自分のmarkerだけ回収する", async (t) => {
  for (const mode of [
    "open",
    "partial",
    "unobservable",
    "replaced",
    "existing",
    "history_late",
    "history_unobservable",
  ] as const) {
    await t.test(mode, (t) => {
      const { root, state } = fixture(t);
      assert.equal(
        initializeCoordinatorSnapshot(root, "binding-a").status,
        "completed",
      );
      const directory = path.join(root, ".crdd", "coordinator");
      const current = path.join(directory, "state.json");
      const pending = path.join(directory, "state.pending.json");
      const marker = path.join(directory, "state.lock");
      const historyPending = path.join(directory, "history.pending.jsonl");
      const before = fs.readFileSync(current);
      const markerBytes = `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: JSON.parse(before.toString()).repositoryBinding })}\n`;
      if (mode === "existing") fs.writeFileSync(marker, markerBytes);
      const open = fs.openSync;
      const lstat = fs.lstatSync;
      const unlink = fs.unlinkSync;
      let injected = false;
      let historyReads = 0;
      let markerUnlinks = 0;
      const unlinkMock = t.mock.method(
        fs,
        "unlinkSync",
        (target: fs.PathLike) => {
          if (String(target) === marker) markerUnlinks += 1;
          return unlink(target);
        },
      );
      const openMock = t.mock.method(fs, "openSync", ((
        ...args: Parameters<typeof open>
      ) => {
        if (String(args[0]) === pending && args[1] === "wx") {
          injected = true;
          if (mode === "partial") fs.writeFileSync(pending, "{");
          if (mode === "replaced") {
            fs.renameSync(marker, path.join(directory, "prior-marker"));
            fs.writeFileSync(marker, markerBytes);
          }
          throw Object.assign(new Error("synthetic pending open failure"), {
            code: "EACCES",
          });
        }
        return Reflect.apply(open, fs, args);
      }) as typeof open);
      const lstatMock = t.mock.method(fs, "lstatSync", ((
        ...args: Parameters<typeof lstat>
      ) => {
        if (mode === "unobservable" && injected && String(args[0]) === pending)
          throw Object.assign(
            new Error("synthetic pending observation failure"),
            { code: "EACCES" },
          );
        if (injected && String(args[0]) === historyPending) {
          historyReads += 1;
          if (mode === "history_unobservable")
            throw Object.assign(
              new Error("synthetic history observation failure"),
              { code: "EACCES" },
            );
          if (mode === "history_late" && historyReads === 2)
            fs.writeFileSync(historyPending, "{synthetic-history-pending\n");
        }
        return Reflect.apply(lstat, fs, args);
      }) as typeof lstat);
      let saved: ReturnType<typeof writeCoordinatorSnapshotState>;
      try {
        saved = writeCoordinatorSnapshotState(
          root,
          "binding-a",
          JSON.stringify(state),
          0,
        );
      } finally {
        openMock.mock.restore();
        lstatMock.mock.restore();
        unlinkMock.mock.restore();
      }
      assert.equal(injected, true);
      assert.equal(saved.status, "blocked");
      assert.deepEqual(fs.readFileSync(current), before);
      assert.equal(fs.existsSync(marker), mode !== "open");
      assert.equal(fs.existsSync(pending), mode === "partial");
      assert.equal(markerUnlinks, mode === "open" ? 1 : 0);
      assert.equal(fs.existsSync(historyPending), mode === "history_late");
      if (mode === "open") {
        assert.equal(
          readCoordinatorSnapshot(root, "binding-a").status,
          "completed",
        );
        assert.equal(
          writeCoordinatorSnapshotState(
            root,
            "binding-a",
            JSON.stringify(state),
            0,
          ).status,
          "completed",
        );
      } else {
        assert.equal(
          readCoordinatorSnapshot(root, "binding-a").status,
          "blocked",
        );
        assert.equal(fs.readFileSync(marker, "utf8"), markerBytes);
      }
    });
  }
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
test("名前付き保存領域の不存在はReader初期化Effectを発行しない", (t) => {
  const { root } = fixture(t);
  const rootNames = fs.readdirSync(root);
  const excludePath = path.join(root, ".git", "info", "exclude");
  const excludeBytes = fs.readFileSync(excludePath);
  const snapshot = readCoordinatorSnapshot(root, "binding-a");
  assert.equal(snapshot.status, "completed");
  assert.equal(snapshot.value, null);
  assert.deepEqual(fs.readdirSync(root), rootNames);
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
  assert.equal(
    initializeCoordinatorSnapshot(root, "binding-a").status,
    "completed",
  );
  const runtime = path.join(root, ".crdd", "coordinator");
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
    assert.equal(readCoordinatorSnapshot(root, "binding-a").status, "blocked");
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
  const runtime = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "coordinator"),
    "fixture_area_invalid",
  ).directory;
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
    const result = readCoordinatorSnapshot(root, "binding-a");
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
test("Snapshot排他は不正Hashと非Windowsを取得前に拒否する", () => {
  for (const value of [
    null,
    undefined,
    "",
    "a".repeat(63),
    "A".repeat(64),
    1,
  ]) {
    assert.equal(acquireRuntimeOwnedProjectStateKernelLock(value), null);
  }
  if (process.platform !== "win32") {
    assert.equal(
      acquireRuntimeOwnedProjectStateKernelLock("a".repeat(64)),
      null,
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
 * @boundary PRL-IT-012=Direct Boundary: domain-model Test Source→対象契約
 */
test("describes the durable foundation without claiming the upper Runtime complete", () => {
  const contract = describeCoordinatorDurableFoundation();
  assert.deepEqual(contract, {
    contract: "crdd-coordinator/orchestrator-durable-foundation/v1",
    recordStrategy:
      "single_current_snapshot_with_pending_atomic_replace_and_exact_readback",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    adoptionLease: "separate_exclusive_lock_with_no_stale_takeover",
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
    writeCoordinatorSnapshot(root, "binding-a", JSON.stringify(empty), 0)
      .status,
    "completed",
  );
  payload.snapshotRevision = 2;
  return writeCoordinatorSnapshot(
    root,
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
  const held = acquireCoordinatorSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("fixture_owner_invalid");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const decoded = decodeRuntimeDomainSnapshot(
    Buffer.from(bytes),
    JSON.parse(bytes).repositoryBinding,
  );
  assert.ok(decoded);
  const view = projectCoordinatorTaskSnapshot(decoded, rootHash);
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
  const empty = readCoordinatorSnapshot(root, "binding-a");
  assert.equal(empty.status, "completed");
  assert.equal(empty.value, null);
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  for (const generation of [-1, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      writeCoordinatorSnapshotState(
        root,
        "binding-a",
        JSON.stringify(state),
        generation,
      ).status,
      "blocked",
    );
  }
  assert.equal(
    writeCoordinatorSnapshotState(root, "binding-a", "{", 0).status,
    "blocked",
  );
  assert.equal(
    writeCoordinatorSnapshotState(root, "binding-a", JSON.stringify(state), 0)
      .status,
    "blocked",
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  const held = acquireCoordinatorSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-snapshot/v5",
    schemaRevision: 5,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  assert.equal(seedSnapshot(root, payload).status, "completed");
  assert.deepEqual(readCoordinatorSnapshot(root, "binding-a").value, payload);
  const directory = path.join(root, ".crdd", "coordinator");
  const current = path.join(directory, "state.json");
  const before = fs.readFileSync(current, "utf8");
  assert.equal(readCoordinatorSnapshot(root, "binding-b").status, "blocked");
  const retiredPayload = {
    ...Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          key !== "acceptanceDecisions" && key !== "decisionRecoveries",
      ),
    ),
    schema: "crdd-coordinator/orchestrator-snapshot/v1",
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
  assert.equal(readCoordinatorSnapshot(root, "binding-a").status, "blocked");
  assert.equal(
    initializeCoordinatorSnapshot(root, "binding-a").status,
    "blocked",
  );
  assert.equal(fs.readFileSync(current, "utf8"), retiredBytes);
  fs.writeFileSync(current, before);
  const pending = path.join(directory, "state.pending.json");
  fs.writeFileSync(pending, "{");
  assert.equal(readCoordinatorSnapshot(root, "binding-a").status, "blocked");
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.equal(fs.readFileSync(current, "utf8"), before);
  fs.unlinkSync(pending);
  const alias = path.join(directory, "alias.json");
  fs.linkSync(current, alias);
  assert.equal(readCoordinatorSnapshot(root, "binding-a").status, "blocked");
  fs.unlinkSync(alias);
  fs.writeFileSync(current, "{");
  assert.equal(readCoordinatorSnapshot(root, "binding-a").status, "blocked");
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
        readCoordinatorSnapshot(root, "binding-a").status,
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
  const held = acquireCoordinatorSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-snapshot/v5",
    schemaRevision: 5,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const current = path.join(root, ".crdd", "coordinator", "state.json");
  const pending = path.join(root, ".crdd", "coordinator", "state.pending.json");
  assert.equal(seedSnapshot(root, payload).status, "completed");
  const first = fs.readFileSync(current, "utf8");
  assert.deepEqual(readCoordinatorSnapshot(root, "binding-a").value, payload);
  assert.equal(fs.existsSync(pending), false);
  assert.equal(
    writeCoordinatorSnapshot(root, "binding-a", JSON.stringify(payload), 1)
      .status,
    "completed",
  );
  assert.equal(fs.readFileSync(current, "utf8"), first);
  const conflict = { ...payload, intakeEpoch: "epoch-conflict" };
  assert.equal(
    writeCoordinatorSnapshot(root, "binding-a", JSON.stringify(conflict), 0)
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
    writeCoordinatorSnapshot(
      root,
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
    writeCoordinatorSnapshot(
      root,
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
    writeCoordinatorSnapshot(
      root,
      "binding-a",
      JSON.stringify(next),
      payload.snapshotRevision,
    ).status,
    "completed",
  );
  assert.equal(fs.existsSync(pending), false);
  fs.writeFileSync(pending, "{");
  assert.equal(
    writeCoordinatorSnapshot(
      root,
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
  const held = acquireCoordinatorSnapshotPilotLock(root);
  assert.equal(held.status, "completed");
  if (held.status !== "completed") throw new Error("lock_fixture_failed");
  const rootHash = held.value.repositoryRootHash;
  assert.equal(held.value.release(), true);
  const payload = {
    schema: "crdd-coordinator/project-snapshot/v5",
    schemaRevision: 5,
    workspaces: [],
    repositoryRootHash: rootHash,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [state],
    queueEntries: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  for (const invalid of [
    { ...payload, repositoryRootHash: "0".repeat(64) },
    {
      ...payload,
      schema: "crdd-coordinator/orchestrator-snapshot/v1",
      schemaRevision: 1,
    },
    { ...payload, results: undefined },
    { ...payload, extra: true },
    {
      ...payload,
      schema: "crdd-coordinator/orchestrator-state-queue-snapshot-pilot/v1",
    },
  ]) {
    assert.equal(
      writeCoordinatorSnapshot(root, "binding-a", JSON.stringify(invalid), 0)
        .status,
      "blocked",
    );
    assert.equal(
      fs.existsSync(path.join(root, ".crdd", "coordinator", "state.json")),
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
        stack.includes("writeCoordinatorSnapshot") &&
        !stack.includes("acquireCoordinatorSnapshotPilotLock")
      ) {
        hasChangedAfterAcquisition = true;
        return other.root;
      }
      return Reflect.apply(original, fs.realpathSync, args);
    },
  );
  try {
    assert.equal(
      writeCoordinatorSnapshot(
        root,
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
      fs.existsSync(path.join(root, ".crdd", "coordinator", name)),
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
function storedEnvelopeBytes(state: CoordinatorState, baseJson: string) {
  const slim: CoordinatorState = {
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
  const bytes = prepareCoordinatorUnifiedTaskSnapshot(
    Buffer.from(baseJson),
    slim,
    0,
    JSON.parse(baseJson).repositoryBinding,
  );
  assert.ok(bytes);
  return (
    bytes.length +
    Buffer.byteLength(encodeRuntimeStateValue(state)) -
    Buffer.byteLength(encodeRuntimeStateValue(slim))
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
  template: CoordinatorState,
  targetBytes: number,
  baseJson: string,
): CoordinatorState {
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
  } & Omit<CoordinatorState, "milestone" | "tasks">;
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
    storedEnvelopeBytes(mutable as unknown as CoordinatorState, baseJson);
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
    storedEnvelopeBytes(mutable as unknown as CoordinatorState, baseJson);
  const firstGrowth = Math.min(remaining, 511);
  mutable.milestone.acceptanceCriteria[0] = "a".repeat(1 + firstGrowth);
  remaining -= firstGrowth;
  mutable.milestone.acceptanceCriteria[1] = "b".repeat(1 + remaining);
  const result = mutable as unknown as CoordinatorState;
  assert.equal(storedEnvelopeBytes(result, baseJson), targetBytes);
  return result;
}

function stateDirectory(root: string) {
  return path.join(root, ".crdd", "coordinator", "state", "project-a");
}

/**
 * PR-D-A-01 enforces the exact stored-record byte boundaryを検証する。
 *
 * @responsibility PR-D-A-01 enforces the exact stored-record byte boundaryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-D-A-01 enforces the exact stored-record byte boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: domain-model Test Source→対象契約
 */
test("PR-D-A-01 enforces the exact stored-record byte boundary", (t) => {
  for (const snapshotBytes of [
    MAX_RECORD_BYTES - 1,
    MAX_RECORD_BYTES,
    MAX_RECORD_BYTES + 1,
  ]) {
    const { root, state } = fixture(t);
    assert.equal(
      initializeCoordinatorSnapshot(root, "binding-a").status,
      "completed",
    );
    const location = path.join(root, ".crdd", "coordinator", "state.json");
    const baseJson = fs.readFileSync(location, "utf8");
    const repository = verifyRepositoryRoot(root);
    assert.equal(repository.status, "completed");
    if (repository.status !== "completed") throw Error("fixture_root_invalid");
    const probe = stateWithStoredBytes(state, MAX_RECORD_BYTES, baseJson);
    const dtoOverhead =
      Buffer.byteLength(JSON.stringify(probe)) - MAX_RECORD_BYTES;
    const view = readCoordinatorSnapshot(root, "binding-a").value;
    assert.ok(view);
    const viewOverhead =
      Buffer.byteLength(
        encodeRuntimeStateValue({
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
    const written = saveCoordinatorManagedProject(
      repository.capability,
      "binding-a",
      boundary,
      0,
    );
    if (snapshotBytes > MAX_RECORD_BYTES) {
      assert.equal(written.status, "blocked");
      assert.equal(written.reason, "orchestrator_snapshot_input_invalid");
      assert.equal(written.manualRecoveryRequired, false);
      assert.equal(fs.readFileSync(location, "utf8"), baseJson);
      assert.equal(
        fs.existsSync(
          path.join(root, ".crdd", "coordinator", "state.pending.json"),
        ),
        false,
      );
      assert.equal(
        readCoordinatorCurrentState(
          repository.capability,
          "binding-a",
          "project-a",
        ).value,
        null,
      );
    } else {
      assert.equal(written.status, "completed", JSON.stringify(written));
      assert.equal(fs.statSync(location).size, inputBytes - dtoOverhead);
      assert.equal(
        readCoordinatorCurrentState(
          repository.capability,
          "binding-a",
          "project-a",
        ).status,
        "completed",
      );
      assert.equal(fs.existsSync(stateDirectory(root)), false);
    }
  }
  const { root, state } = fixture(t);
  assert.equal(
    initializeCoordinatorSnapshot(root, "binding-a").status,
    "completed",
  );
  const baseJson = fs.readFileSync(
    path.join(root, ".crdd", "coordinator", "state.json"),
    "utf8",
  );
  const binding = JSON.parse(baseJson).repositoryBinding as string;
  for (const physicalBytes of [
    MAX_RECORD_BYTES - 1,
    MAX_RECORD_BYTES,
    MAX_RECORD_BYTES + 1,
  ]) {
    const input = stateWithStoredBytes(state, physicalBytes, baseJson);
    const encoded = prepareCoordinatorUnifiedTaskSnapshot(
      Buffer.from(baseJson),
      input,
      0,
      binding,
    );
    if (physicalBytes > MAX_RECORD_BYTES) assert.equal(encoded, null);
    else {
      assert.ok(encoded);
      assert.equal(encoded.length, physicalBytes);
      assert.ok(decodeRuntimeDomainSnapshot(encoded, binding));
    }
  }
});

/**
 * Host準備保存のReader・Writer間相関を保存Owner内で反証する。
 * @responsibility 現在本文一致、元Owner・読取り解放・fresh検査を維持する。
 * @trace PRL-IT-005
 * @precondition 正常codecで確認した合成値だけを使う。
 * @stimulus 本番の固定保存関数へReaderと物理Writerの境界だけを注入する。
 * @observation 保存回数、固定拒否、同値再入場、解放flag。
 * @oracle 別Owner・元版差・Reader後失効・解放不明では保存しない。
 * @cleanup N/A: メモリ内の固定模擬だけ。
 * @boundary 保存wrapperの論理試験。実HostやDockerを使用しない。
 */
test("Host準備保存は元OwnerとReader完了を再確認する", () => {
  const binding = "a".repeat(64);
  const nonce = "b".repeat(64);
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token =
    "host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc." +
    hostHash;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v2",
    operationNonce: nonce,
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "low",
      purpose: "task",
      catalogIdentity:
        "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
      configIdentity:
        "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
      role: "executor",
      workType: null,
      source: "explicit",
    },
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const identityJson = `${JSON.stringify(identity)}\n`;
  const identitySha256 = createHash("sha256")
    .update(identityJson)
    .digest("hex");
  const recoveryId =
    "docker-task." +
    identity.stableLogicalHomeBindingHash +
    "." +
    nonce +
    "." +
    identitySha256;

  const prepared = prepareCoordinatorStateOperationSnapshot(
    null,
    identityJson,
    binding,
  );
  assert.ok(prepared);
  const preparedState = decodeCoordinatorStateSnapshot(prepared, binding);
  assert.ok(preparedState);
  const initialOperation = preparedState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(initialOperation);
  const releasedOperation: CoordinatorStateTaskOperation = {
    ...initialOperation,
    lease: "released",
    execution: {
      ...initialOperation.execution,
      ownerEffect: "disabled",
      workspaceReusable: false,
    },
    resources: initialOperation.resources.map((item) => ({
      ...item,
      request: "identified",
      dockerId: "d".repeat(64),
      receiptSource: "docker_create_result",
      observation: "absent",
    })),
  };
  const hostPreparationBefore = Buffer.from(
    `${encodeRuntimeStateValue({
      ...preparedState.snapshot,
      operations: [
        {
          ...releasedOperation,
          resources: initialOperation.resources,
          execution: {
            ...releasedOperation.execution,
            providerStart: "not_started",
            externalSend: "not_issued",
            sharedWrite: "not_issued",
          },
        },
      ],
    })}\n`,
  );
  assert.ok(decodeCoordinatorStateSnapshot(hostPreparationBefore, binding));
  const hostPreparationCandidate = prepareCoordinatorStateHostSnapshot(
    hostPreparationBefore,
    recoveryId,
    { ...releasedOperation.host, cleanup: "pending" },
    binding,
  );
  assert.ok(hostPreparationCandidate);
  let hostPreparationCurrent: Buffer = hostPreparationBefore;
  let hostPreparationWrites = 0;
  let hostPreparationOwnerLive = true;
  let hostPreparationReadLockReleased = true;
  let hostPreparationLoseOwnerAfterRead = false;
  const hostPreparationOwner = Object.freeze({});
  const saveHostPreparation = runInThisContext(
    `(scope) => { const { encodeRuntimeStateValue, decodeCoordinatorStateSnapshot, prepareCoordinatorStateHostSnapshot, borrowRuntimeOwnedCoordinatorStateRepository, readCoordinatorStateSnapshot, writeCoordinatorStateSnapshot } = scope; ${sourceDeclaration(fs.readFileSync(new URL("../../src/storage/runtime-store.ts", import.meta.url), "utf8"), "saveRuntimeOwnedCoordinatorHostCleanupPreparation")}\nreturn saveRuntimeOwnedCoordinatorHostCleanupPreparation; }`,
  )({
    Buffer,
    Object,
    JSON,
    encodeRuntimeStateValue,
    decodeCoordinatorStateSnapshot,
    prepareCoordinatorStateHostSnapshot,
    borrowRuntimeOwnedCoordinatorStateRepository: (owner: unknown) =>
      owner === hostPreparationOwner && hostPreparationOwnerLive
        ? {
            repositoryBinding: binding,
            operationId: identity.operationId,
            revalidate: () => hostPreparationOwnerLive,
          }
        : null,
    readCoordinatorStateSnapshot: () => {
      if (hostPreparationLoseOwnerAfterRead) hostPreparationOwnerLive = false;
      return {
        status: "completed",
        reason: "observed",
        lockReleased: hostPreparationReadLockReleased,
        value: decodeCoordinatorStateSnapshot(hostPreparationCurrent, binding),
      };
    },
    writeCoordinatorStateSnapshot: (
      owner: unknown,
      repository: { revalidate: () => boolean },
      candidate: Buffer,
      settlement: unknown,
    ) => {
      assert.equal(owner, hostPreparationOwner);
      assert.equal(settlement, null);
      assert.ok(candidate.equals(hostPreparationCandidate));
      if (!repository.revalidate())
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
        };
      hostPreparationWrites++;
      hostPreparationCurrent = Buffer.from(candidate);
      return {
        status: "completed",
        snapshotConfirmed: true,
        lockReleased: true,
      };
    },
  }) as (
    owner: unknown,
    id: string,
    before: unknown,
  ) => {
    status: string;
    snapshotConfirmed: boolean;
    lockReleased: boolean;
    filesystemEffectIssued?: boolean;
  };
  assert.equal(
    saveHostPreparation(hostPreparationOwner, recoveryId, hostPreparationBefore)
      .status,
    "completed",
  );
  assert.equal(hostPreparationWrites, 1);
  const confirmedHostPreparation = decodeCoordinatorStateSnapshot(
    hostPreparationCandidate,
    binding,
  );
  assert.ok(confirmedHostPreparation);
  assert.deepEqual(
    saveHostPreparation(
      hostPreparationOwner,
      recoveryId,
      hostPreparationBefore,
    ),
    {
      status: "completed",
      reason: "coordinator_state_snapshot_confirmed",
      revision: confirmedHostPreparation.snapshot.revision,
      payloadSha256: confirmedHostPreparation.payloadSha256,
      recoveryIds: [recoveryId],
      filesystemEffectIssued: false,
      snapshotConfirmed: true,
      lockReleased: true,
    },
  );
  assert.equal(hostPreparationWrites, 1, "同じ確定版の再入場は保存しない");
  for (const [owner, id, before] of [
    [{}, recoveryId, hostPreparationBefore],
    [hostPreparationOwner, "other-recovery", hostPreparationBefore],
    [hostPreparationOwner, recoveryId, prepared],
    [hostPreparationOwner, recoveryId, hostPreparationCandidate],
  ] as const)
    assert.equal(saveHostPreparation(owner, id, before).status, "blocked");
  hostPreparationCurrent = prepared;
  assert.equal(
    saveHostPreparation(hostPreparationOwner, recoveryId, hostPreparationBefore)
      .status,
    "blocked",
  );
  hostPreparationCurrent = hostPreparationBefore;
  hostPreparationLoseOwnerAfterRead = true;
  assert.equal(
    saveHostPreparation(hostPreparationOwner, recoveryId, hostPreparationBefore)
      .status,
    "blocked",
  );
  hostPreparationLoseOwnerAfterRead = false;
  hostPreparationOwnerLive = true;
  hostPreparationReadLockReleased = false;
  assert.equal(
    saveHostPreparation(hostPreparationOwner, recoveryId, hostPreparationBefore)
      .lockReleased,
    false,
  );
  hostPreparationOwnerLive = false;
  assert.equal(
    saveHostPreparation(hostPreparationOwner, recoveryId, hostPreparationBefore)
      .status,
    "blocked",
  );
  assert.equal(
    hostPreparationWrites,
    1,
    "不正元版・別操作・別Owner・解放不明は保存しない",
  );
});

/**
 * 修復wrapperと排他内guardの対象外拒否を本番本文で反証する。
 * @responsibility codecの拒否に依存せず各guardを除去した負対照を確認する。
 * @trace ERB-IT-014
 * @precondition 実Sourceの一意区間、メモリSnapshotと受理codec代役。
 * @stimulus Task・別修復・未解決参照・配送の変更と除去を加える。
 * @observation 下位Writer要求counter、guard後継続counter、元本文不変。
 * @oracle 元guardは0、当該guard無効化時だけ1へ進む。
 * @cleanup N/A: VM内だけで実Writer・Kernel・Filesystemは使わない。
 * @boundary ERB-IT-014=Direct Boundary: 本番修復scope guardの分離Oracle。
 */
test("修復Writerの二重scope guardは他操作と参照の変更・除去を拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf(
    "export function writeRuntimeOwnedCoordinatorRepairSnapshot(",
  );
  const end = text.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const dispatchStart = text.indexOf("function validateRepairWriteCandidate(");
  const dispatch = stripTypeScriptTypes(
    text.slice(dispatchStart, text.indexOf("\n/**", dispatchStart)),
  );
  assert.ok(dispatchStart > 0);
  const wrapper = stripTypeScriptTypes(text.slice(start, end)).replace(
    "export function",
    "function",
  );
  const guardStart = wrapper.indexOf("      encodeRuntimeStateValue(");
  const guardEnd = wrapper.indexOf(
    "      !validateRepairWriteCandidate(",
    guardStart,
  );
  assert.ok(guardStart > 0 && guardEnd > guardStart);
  const wrapperMutant = wrapper.slice(0, guardStart) + wrapper.slice(guardEnd);
  const writer = text.indexOf("function commitCoordinatorStateSnapshotOwned(");
  const boundaryStart = text.indexOf("    if (currentRepair) {", writer);
  const boundaryEnd = text.indexOf(
    "    let completionConfirmed",
    boundaryStart,
  );
  assert.ok(boundaryStart > writer && boundaryEnd > boundaryStart);
  const boundary = stripTypeScriptTypes(text.slice(boundaryStart, boundaryEnd));
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
    kind: "runtime_repair",
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
      { kind: "runtime_repair", recoveryId: "other", value: 0 },
    ],
    unresolvedRecoveries: [{ value: 0 }],
    pendingDeliveries: [{ value: 0 }],
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
    "delivery_changed",
    "delivery_removed",
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
    if (scenario === "delivery_changed") after.pendingDeliveries[0].value = 1;
    if (scenario === "delivery_removed") after.pendingDeliveries = [];
    const beforeBytes = Buffer.from(original),
      bytes = Buffer.from(JSON.stringify(after));
    for (const mutated of [false, true]) {
      let requests = 0;
      const evaluateWrapper = runInNewContext(
        `${dispatch}\n${mutated ? wrapperMutant : wrapper}; writeRuntimeOwnedCoordinatorRepairSnapshot`,
        {
          Buffer,
          types: utilTypes,
          settlements: new WeakMap(),
          initializations: new WeakMap(),
          borrowRuntimeOwnedCoordinatorRecoveryRepository: () => repository,
          decodeCoordinatorStateSnapshot: (value: Buffer) => ({
            snapshot: JSON.parse(value.toString("utf8")),
          }),
          validateCoordinatorStateTransition: () => true,
          encodeRuntimeStateValue: JSON.stringify,
          writeCoordinatorStateSnapshot: (_owner: unknown, root: unknown) => {
            if (root) requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
        },
      );
      evaluateWrapper(
        {},
        "target",
        beforeBytes,
        bytes,
        () => true,
        "checkpoint",
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
            encodeRuntimeStateValue: JSON.stringify,
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
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf(
    "export function writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(",
  );
  const end = text.indexOf("\nconst settlements =", start);
  assert.ok(start > 0 && end > start);
  const wrapper = stripTypeScriptTypes(text.slice(start, end)).replace(
    "export function",
    "function",
  );
  const guardStart = wrapper.indexOf("    if (\n      beforeTasks");
  const guardEnd = wrapper.indexOf("    const binding =", guardStart);
  assert.ok(guardStart > 0 && guardEnd > guardStart);
  const wrapperMutant = wrapper.slice(0, guardStart) + wrapper.slice(guardEnd);
  const innerStart = text.indexOf("    if (currentAuthenticationClosure) {");
  const innerEnd = text.indexOf("    } else if (", innerStart);
  assert.ok(innerStart > 0 && innerEnd > innerStart);
  const inner = stripTypeScriptTypes(
    `${text.slice(innerStart, innerEnd)}\n    }`,
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
        `${mutant ? wrapperMutant : wrapper}; writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure`,
        {
          Buffer,
          types: utilTypes,
          settlements: new WeakMap(),
          encodeRuntimeStateValue: JSON.stringify,
          decodeCoordinatorStateSnapshot: (value: Buffer) => ({
            snapshot: JSON.parse(value.toString()),
          }),
          prepareCoordinatorAuthenticationUnknownClosureSnapshot: () => bytes,
          writeCoordinatorStateSnapshot: (_owner: unknown, root: unknown) => {
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
            prepareCoordinatorAuthenticationUnknownClosureSnapshot: () => bytes,
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
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "tests",
  );
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
    if (fs.readdirSync(area.directory).length === 0)
      fs.rmdirSync(area.directory);
  });
  const text = fs.readFileSync(
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf(
    "export function writeRuntimeOwnedCoordinatorRepairSnapshot(",
  );
  const body = stripTypeScriptTypes(
    text.slice(start, text.indexOf("\n/**", start)),
  ).replace("export function", "function");
  const dispatchStart = text.indexOf("function validateRepairWriteCandidate(");
  const dispatch = stripTypeScriptTypes(
    text.slice(dispatchStart, text.indexOf("\n/**", dispatchStart)),
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
          kind: "runtime_repair",
          recoveryId: "target",
          identityJson: '{"operationId":"OP-123456"}',
          summarySha256: null,
          history: null,
        },
      ],
      unresolvedRecoveries: [],
      pendingDeliveries: [],
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
        `${dispatch}\n${source}; writeRuntimeOwnedCoordinatorRepairSnapshot`,
        {
          Buffer,
          Object,
          Promise,
          types: utilTypes,
          settlements: new WeakMap(),
          initializations: new WeakMap(),
          borrowRuntimeOwnedCoordinatorRecoveryRepository: () => ({
            repositoryRoot: root,
            repositoryBinding: "a".repeat(64),
            revalidate: () => true,
          }),
          decodeCoordinatorStateSnapshot: () => ({ snapshot: candidate }),
          validateCoordinatorStateTransition: () => true,
          encodeRuntimeStateValue: JSON.stringify,
          prepareCoordinatorStateInitialization: () => {
            if (create && mode !== "init_rejected") fs.mkdirSync(directory);
            return {
              status: mode.startsWith("init_") ? "blocked" : "prepared",
              effectIssued: mode !== "init_rejected",
              lockReleased: true,
            };
          },
          writeCoordinatorStateSnapshot: (
            _owner: unknown,
            repository: unknown,
          ) => {
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
        null,
        Buffer.from(JSON.stringify(candidate)),
        () => true,
        "checkpoint",
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
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const functionStart = text.indexOf(
    "function commitCoordinatorStateSnapshotOwned(",
  );
  const normalStart = text.indexOf(
    "    const previousOperations = new Map(",
    functionStart,
  );
  const normalEnd = text.indexOf(
    "      for (const resource of operation.resources)",
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
  const publication = text.indexOf('create("state.lock", marker)', normalEnd);
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
    kind: "runtime_repair",
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
              encodeRuntimeStateValue: JSON.stringify,
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
    new URL("../../src/storage/runtime-store.ts", import.meta.url),
    "utf8",
  );
  const writerStart = storeSource.indexOf(
    "export function writeRuntimeOwnedCoordinatorRecoveryTerminal(",
  );
  const writerEnd = storeSource.indexOf(
    "export function writeRuntimeOwnedCoordinatorRecoveryCheckpoint(",
    writerStart,
  );
  assert.ok(writerStart >= 0 && writerEnd > writerStart);
  const writerBody = stripTypeScriptTypes(
    storeSource
      .slice(writerStart, writerEnd)
      .replaceAll("export function", "function"),
  );
  const mutantBody = writerBody
    .replaceAll(
      "writeRuntimeOwnedCoordinatorRecoveryTerminal",
      "mutatedRecoveryTerminal",
    )
    .replace(
      "!isDockerRestartCheckpointSettled(operation.dockerRestart)",
      "false",
    );
  assert.notEqual(
    mutantBody,
    writerBody.replaceAll(
      "writeRuntimeOwnedCoordinatorRecoveryTerminal",
      "mutatedRecoveryTerminal",
    ),
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
    "operation_changed",
    "missing",
    "host_pending",
    "transition_pending",
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
    const operation = {
      kind: "docker_task",
      identityJson: JSON.stringify({
        operationId: scenario === "operation_changed" ? "other" : "OP-1",
      }),
      recoveryId: "exact-recovery",
      phase: scenario === "awaiting" ? "awaiting_delivery" : "settling",
      host: {
        cleanup: scenario === "host_pending" ? "pending" : "confirmed",
        pendingTransitionJson:
          scenario === "transition_pending" ? "pending" : null,
      },
      execution: {
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
      resources: purposes.map((purpose) => {
        const state = scenario.startsWith(`${purpose}:`)
          ? scenario.slice(purpose.length + 1)
          : "not_requested";
        return {
          purpose,
          request:
            state === "present"
              ? "identified"
              : state === "unidentified_absent"
                ? "unknown"
                : state,
          observation:
            state === "unidentified_absent"
              ? "absent"
              : state === "present"
                ? "present"
                : "unobserved",
        };
      }),
    };
    const snapshot = { operations: scenario === "missing" ? [] : [operation] };
    const before = Buffer.from(`${JSON.stringify(snapshot)}\n`);
    let candidates = 0,
      writes = 0,
      ownerChecks = 0;
    const repository = {
      operationId: "OP-1",
      repositoryBinding: "fixed",
      revalidate: () => true,
    };
    const writer = runInNewContext(
      `${writerBody}; ${mutantBody}; writeRuntimeOwnedCoordinatorRecoveryTerminal.mutant = mutatedRecoveryTerminal; writeRuntimeOwnedCoordinatorRecoveryTerminal`,
      {
        Buffer,
        isDockerRestartCheckpointSettled,
        coordinatorTaskResourcesAreSettled,
        encodeRuntimeStateValue: JSON.stringify,
        readCoordinatorStateSnapshot: () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot },
        }),
        prepareCoordinatorStateLifecycleSnapshot(
          bytes: Buffer,
          recoveryId: string,
          lifecycle: unknown,
          binding: string,
        ) {
          candidates++;
          assert.deepEqual(bytes, before);
          assert.equal(recoveryId, "exact-recovery");
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
        writeCoordinatorStateSnapshot(
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
      bytes: Buffer,
      owner: () => boolean,
    ) => { snapshotConfirmed: boolean }) & {
      mutant: (...args: unknown[]) => { snapshotConfirmed: boolean };
    };
    const result = writer(
      repository,
      "exact-recovery",
      scenario === "before_changed" ? Buffer.from("different") : before,
      () => ++ownerChecks === 1 || scenario !== "owner_changed",
    );
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
    assert.equal(before.toString(), `${JSON.stringify(snapshot)}\n`);
    if (
      [
        "restart:confirmed:confirmed:null",
        "restart_unissued_effect_unknown",
      ].includes(scenario)
    ) {
      assert.equal(
        writer.mutant(repository, "exact-recovery", before, () => true)
          .snapshotConfirmed,
        true,
      );
      assert.equal(candidates, 1);
      assert.equal(writes, 1);
    }
  }
});
