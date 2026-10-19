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
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { codexAdviceProviderInitRequired } from "../../../docker-isolation/src/index.ts";
import {
  planDockerRecoveryResourceExpectations,
  isDockerResourcePurpose,
} from "../../../docker-isolation/src/index.ts";
import { parseDockerTaskRecoveryId } from "../../src/state-storage/recovery-identity.ts";
import {
  parseHostRecoveryToken,
  validateHostRecoveryTransitionLineage,
} from "../../src/host-execution/recovery-record.ts";
import {
  coordinatorTaskResourcesAreSettled,
  coordinatorAuthenticationUnknownCanClose,
  coordinatorReleasedTaskCanObserveHostAbsence,
  prepareCoordinatorStateOperationSnapshot,
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  type CoordinatorStateOperation,
} from "../../src/state-storage/model.ts";
import {
  createDockerRestartRequestId,
  isDockerRestartCheckpointSettled,
} from "../../src/state-storage/restart-checkpoint.ts";
import {
  persistRuntimeOwnedDockerRestartCheckpoint,
  prepareRuntimeOwnedDockerRestart,
  releaseRuntimeOwnedDockerRestartPreparation,
  verifyRuntimeOwnedDockerRestartPreparation,
} from "../../src/task/recovery.ts";
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
    assert.equal(verifyRuntimeOwnedDockerRestartPreparation(value), false);
    assert.equal(
      persistRuntimeOwnedDockerRestartCheckpoint(value, {
        requestId: "a".repeat(64),
        scopeSha256: "b".repeat(64),
        request: "not_issued",
        cleanup: "not_required",
        result: null,
      }),
      false,
    );
    assert.equal(releaseRuntimeOwnedDockerRestartPreparation(value), false);
  }
  const result = prepareRuntimeOwnedDockerRestart("invalid", {});
  assert.equal(result.status, "blocked");
  assert.equal("capability" in result, false);
  assert.equal(result.cleanupConfirmed, true);
  if (result.status === "blocked")
    assert.equal(result.reason, "docker_restart_id_invalid");
});

const source = fs.readFileSync(
  new URL("../../src/task/recovery.ts", import.meta.url),
  "utf8",
);
const start = source.indexOf("function restartScopeIncludes(");
const end = source.indexOf("type RecoveryRecord =", start);
assert.ok(start >= 0 && end > start);
const body = stripTypeScriptTypes(
  source
    .slice(start, end)
    .replaceAll("export function", "function")
    .replaceAll("export async function", "async function"),
);
const recoveryStart = source.indexOf("function assertCurrentRecoveryOwner(");
const recoveryEnd = source.indexOf(
  "function validProductionPlan(",
  recoveryStart,
);
assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);
const recoveryBody = stripTypeScriptTypes(
  source
    .slice(recoveryStart, recoveryEnd)
    .replaceAll("export function", "function")
    .replaceAll("export async function", "async function"),
);
const storeSource = fs.readFileSync(
  new URL("../../src/state-storage/settlement-store.ts", import.meta.url),
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
 * 初期Hostの再導出を実modelへ接続し、依存欠測による偽の拒否を検出する。
 * @responsibility 正常な初期切断の肯定を、例外を捕捉する上位の拒否と区別する。
 * @trace ERB-IT-014
 * @precondition 正規Identityを実prepareとdecoderで生成し、実private判定本文を使う。
 * @stimulus 未要求・確定未発行再起動、未確定値、他欄差、同ID参照と依存欠測を与える。
 * @observation 真偽、実依存の到達数、欠測時のReferenceError。
 * @oracle 正常だけtrue、欠測は同じ肯定Oracleを満たさない。
 * @cleanup N/A: メモリだけでDocker・Filesystem処置を行わない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収本文→実model再導出。
 */
test("初期Host再導出は実依存へ肯定到達し欠測を拒否成功と混同しない", () => {
  const binding = "c".repeat(64);
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
  const hostToken = `host.${hostRecord.rootName}.12345678-1234-4234-8234-123456789abc.${hostHash}`;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v1",
    operationNonce: "b".repeat(64),
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
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
    initialHostRecoveryId: hostToken,
    initialHostRecovery: {
      token: hostToken,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const bytes = prepareCoordinatorStateOperationSnapshot(
    null,
    `${JSON.stringify(identity)}\n`,
    binding,
  );
  assert.ok(bytes);
  const decoded = decodeCoordinatorStateSnapshot(bytes, binding);
  assert.ok(decoded);
  const initial = decoded.snapshot.operations[0];
  assert.ok(initial?.kind === "docker_task");
  const operation = {
    ...initial,
    phase: "settling" as const,
    execution: { ...initial.execution, ownerEffect: "disabled" as const },
  };
  const scopeSha256 = "e".repeat(64);
  const requestId = createDockerRestartRequestId(
    binding,
    initial.identitySha256,
    initial.recoveryId,
    scopeSha256,
  );
  assert.ok(requestId);
  const settled = {
    requestId,
    scopeSha256,
    request: "unknown",
    cleanup: "confirmed",
    result: {
      status: "blocked",
      reason: "docker_restart_cancelled",
      request: "not_issued",
      effectOutcomeUnknown: false,
    },
  };
  for (const omitted of [
    null,
    "isDockerRestartCheckpointSettled",
    "prepareCoordinatorStateOperationSnapshot",
    "decodeCoordinatorStateSnapshot",
  ] as const) {
    const calls = { restart: 0, prepare: 0, decode: 0 };
    const context = {
      encodeCoordinatorStateValue: (value: unknown) =>
        encodeCoordinatorStateValue(JSON.parse(JSON.stringify(value))),
      isDockerRestartCheckpointSettled: (value: unknown) => {
        calls.restart++;
        return isDockerRestartCheckpointSettled(
          JSON.parse(JSON.stringify(value)),
        );
      },
      prepareCoordinatorStateOperationSnapshot: (
        ...args: Parameters<typeof prepareCoordinatorStateOperationSnapshot>
      ) => {
        calls.prepare++;
        return prepareCoordinatorStateOperationSnapshot(...args);
      },
      decodeCoordinatorStateSnapshot: (
        ...args: Parameters<typeof decodeCoordinatorStateSnapshot>
      ) => {
        calls.decode++;
        return decodeCoordinatorStateSnapshot(...args);
      },
    };
    if (omitted) Reflect.deleteProperty(context, omitted);
    const invoke = runInNewContext(
      `${recoveryBody}\nisUnsubmittedInitialTaskHost`,
      context,
    );
    for (const dockerRestart of [null, settled]) {
      const candidate = { ...operation, dockerRestart };
      const snapshot = { ...decoded.snapshot, operations: [candidate] };
      /**
       * 準備の正常保存対照へ有限の成功値を渡す。
       * @responsibility 準備の正常保存対照へ有限の成功値を渡す。
       * @trace ERB-IT-014
       * @precondition 固定Ownerと準備観測fixture。
       * @stimulus 正常準備値を返して後続到達を記録する。
       * @observation 取得・保存・処置の順序と回数。
       * @oracle 拒否変異に対する正例が本番本文を通る。
       * @cleanup 模擬Lockは既存finallyで解放確認する。
       * @boundary 準備本文VM。実Dockerを操作しない。
       */
      const positive = () =>
        assert.equal(invoke(candidate, snapshot, hostToken, "host_only"), true);
      if (omitted) assert.throws(positive, { name: "ReferenceError" });
      else positive();
    }
    if (omitted) continue;
    assert.deepEqual(calls, { restart: 2, prepare: 2, decode: 2 });
    for (const dockerRestart of [
      { ...settled, result: null },
      { ...settled, cleanup: "unknown" },
      { ...settled, result: { ...settled.result, effectOutcomeUnknown: true } },
      { ...settled, result: { ...settled.result, request: "unknown" } },
    ])
      assert.equal(
        invoke(
          { ...operation, dockerRestart },
          decoded.snapshot,
          hostToken,
          "host_only",
        ),
        false,
      );
    assert.equal(
      invoke(
        { ...operation, lease: "released" },
        decoded.snapshot,
        hostToken,
        "host_only",
      ),
      false,
    );
    for (const key of ["unresolvedRecoveries", "pendingDeliveries"]) {
      assert.equal(
        invoke(
          operation,
          {
            ...decoded.snapshot,
            [key]: [{ recoveryId: operation.recoveryId }],
          },
          hostToken,
          "host_only",
        ),
        false,
      );
    }
    assert.equal(
      invoke(operation, decoded.snapshot, `${hostToken}x`, "host_only"),
      false,
    );
    assert.equal(
      invoke(
        operation,
        decoded.snapshot,
        hostToken,
        "docker_submission_started",
      ),
      false,
    );
  }
});
/**
 * 現準備の同じ本番本文を観測可能な境界へ結合する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 固定二操作・Rootと排他境界を構築する。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle 準備Map・検証・保存・解放は本番本文を実行する。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
function fixture(mode: "restart" | "recovery" = "restart") {
  const first = "a".repeat(64),
    second = "b".repeat(64);
  const token = `docker-task.${first}.${first}.${first}`;
  const secondToken = `docker-task.${second}.${second}.${second}`;
  const root = Object.freeze({});
  const acquired: string[] = [],
    released: string[] = [],
    events: string[] = [];
  const purposes = [
    "create_subscription_auth_probe",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "create_provider",
  ] as const;
  let reads = 0,
    writes = 0,
    hostTransitions = 0,
    rootValid = true,
    ownerLive = true,
    ownerThrows = false;
  let acquireFault: string | null = null,
    acquireNull: string | null = null,
    releaseFault: "false" | "throw" | null = null;
  let changeAtRead = false,
    writerFault = false,
    markerFault = false;
  let hostFault: "none" | "before" | "after" | "wrong_token" = "none";
  let writerFaultAt = 0;
  let planningCalls = 0;
  let cleanupRoot: "present" | "absent" | "unknown" = "present";
  let cleanupMarker: "present" | "absent" | "unknown" = "present";
  let cleanupFault: "none" | "blocked" | "throw" | "observation" = "none";
  let cleanupCalls = 0;
  let changeAtReadNumber = 0;
  let hostTransitionMarker:
    | "old"
    | "old_foreign"
    | "expected"
    | "unknown"
    | "foreign"
    | null = null;
  const hostTransitionRecords = new Map<
    string,
    { record: Record<string, unknown>; serialized: string }
  >();
  /**
   * exact回復対象の五資源を持つ操作記録を構成する。
   * @responsibility exact回復対象の五資源を持つ操作記録を構成する。
   * @trace ERB-IT-014
   * @precondition 固定recoveryId・operationId・nonce。
   * @stimulus 同じidから資源名と保存状態を組み立てる。
   * @observation 本番準備へ渡す現在操作本文。
   * @oracle 別操作の記録を同対象と扱わず元相関を検査する。
   * @cleanup N/A: 合成記録の構築のみ。
   * @boundary 現在stateの入力fixture。保存実体の証明ではない。
   */
  const operation = (recoveryId: string, id: string, nonce: string) => ({
    kind: "docker_task" as const,
    recoveryId,
    identitySha256: nonce,
    identityJson: JSON.stringify({
      operationId: id,
      initialHostRecoveryId: `host.crdd-coordinator-doctor-${id}.00000000-0000-0000-0000-00000000000${id === "a" ? "1" : "2"}.${nonce}`,
      hostPaths: { root: path.resolve(`crdd-coordinator-doctor-${id}`) },
      ownershipLabel: `crdd.coordinator.runtime=${id.repeat(16)}`,
      operationMode: "isolated_task",
      workspaceMountMode: "read_only",
      images: {
        provider: `sha256:${"1".repeat(64)}`,
        proxy: `sha256:${"2".repeat(64)}`,
      },
      resources: {
        auth: `crdd-auth-${id.repeat(16)}`,
        internal: `crdd-internal-${id.repeat(16)}`,
        egress: `crdd-egress-${id.repeat(16)}`,
        proxy: `crdd-proxy-${id.repeat(16)}`,
        provider: `crdd-claude-${id.repeat(16)}`,
      },
    }),
    phase: "executing",
    outcome: null,
    host: {
      currentToken: `host.crdd-coordinator-doctor-${id}.00000000-0000-0000-0000-00000000000${id === "a" ? "1" : "2"}.${nonce}`,
      pendingTransitionJson: null,
      cleanup: "not_requested",
    },
    lease: "held",
    execution: {
      ownerEffect: "active",
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    },
    resources: purposes.map(
      (
        purpose,
      ): Extract<
        CoordinatorStateOperation,
        { kind: "docker_task" }
      >["resources"][number] => ({
        purpose,
        request: "not_requested",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      }),
    ),
    primaryFailure: null,
    summarySha256: null,
    dockerRestart: null,
  });
  let snapshot = {
    revision: 1,
    operations: [
      operation(token, "a", first),
      operation(secondToken, "b", second),
    ],
  };
  const repository = {
    repositoryRoot: path.resolve("fixture-root"),
    repositoryBinding: "c".repeat(64),
    revalidate: () => rootValid,
  };
  const maps = new WeakMap();
  const generations = new WeakMap();
  /**
   * Owner喪失と解放失敗を段階別に注入するLockを返す。
   * @responsibility Owner喪失と解放失敗を段階別に注入するLockを返す。
   * @trace ERB-IT-014
   * @precondition 取得・live確認・解放の有限fault選択。
   * @stimulus 取得列を記録し選択点でfalse/nullまたは例外を返す。
   * @observation acquire/assertLive/releaseの到達列。
   * @oracle 失効後の処置0と同じLockの解放を親Oracleが確認する。
   * @cleanup 呼出し元が解放試行回数と結果を確認する。
   * @boundary Lock代役。OS排他成立の実証へ流用しない。
   */
  const lock = (id: string) => {
    acquired.push(id);
    if (acquireFault === id) throw new Error("private acquisition detail");
    if (acquireNull === id) return null;
    return {
      assertLive: () => {
        if (ownerThrows) throw new Error("private ownership detail");
        return ownerLive;
      },
      release: () => {
        released.push(id);
        if (releaseFault === "throw" && released.length === 1)
          throw new Error("private release detail");
        return !(releaseFault === "false" && released.length === 1);
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
    root,
    token,
    parseDockerTaskRecoveryId,
    parseHostRecoveryToken,
    // VM内の自己生成plain値は、実codecへ渡す前に同RealmのJSON値へ揃える。
    encodeCoordinatorStateValue: (value: unknown) =>
      encodeCoordinatorStateValue(JSON.parse(JSON.stringify(value))),
    createDockerRestartRequestId,
    isDockerRestartCheckpointSettled: (value: unknown) =>
      isDockerRestartCheckpointSettled(JSON.parse(JSON.stringify(value))),
    coordinatorTaskResourcesAreSettled: (
      value: Parameters<typeof coordinatorTaskResourcesAreSettled>[0],
    ) => coordinatorTaskResourcesAreSettled(JSON.parse(JSON.stringify(value))),
    coordinatorReleasedTaskCanObserveHostAbsence: (
      value: Parameters<typeof coordinatorReleasedTaskCanObserveHostAbsence>[0],
    ) =>
      coordinatorReleasedTaskCanObserveHostAbsence(
        JSON.parse(JSON.stringify(value)),
      ),
    coordinatorAuthenticationUnknownCanClose: (
      value: Parameters<typeof coordinatorAuthenticationUnknownCanClose>[0],
    ) =>
      coordinatorAuthenticationUnknownCanClose(
        JSON.parse(JSON.stringify(value)),
      ),
    prepareCoordinatorStateOperationSnapshot,
    decodeCoordinatorStateSnapshot,
    codexAdviceProviderInitRequired,
    planDockerRecoveryResourceExpectations: (
      input: Parameters<typeof planDockerRecoveryResourceExpectations>[0],
    ) => {
      planningCalls++;
      return planDockerRecoveryResourceExpectations(input);
    },
    isDockerResourcePurpose,
    canonical: (value: unknown) => `${JSON.stringify(value)}\n`,
    validateHostRecoveryTransitionLineage: (value: unknown, required: string) =>
      validateHostRecoveryTransitionLineage(
        JSON.parse(JSON.stringify(value)),
        required,
      ),
    expectedHostSuccessor: (token: string, nextState: string) => {
      const loaded = hostTransitionRecords.get(token);
      assert.ok(loaded);
      const parsed = parseHostRecoveryToken(token);
      const expectedRecord = { ...loaded.record, state: nextState };
      return {
        currentToken: token,
        expectedToken: `host.${parsed.rootName}.${parsed.nonce}.${createHash(
          "sha256",
        )
          .update(`${JSON.stringify(expectedRecord)}\n`)
          .digest("hex")}`,
        rootName: parsed.rootName,
        nonce: parsed.nonce,
        currentState: loaded.record.state,
        nextState,
        recordBefore: loaded.record,
      };
    },
    confirmOwnedDockerAbsenceForRecovery: (
      token: string,
      capability: object,
    ) => {
      hostTransitions++;
      events.push("host:confirm");
      const generation = generations.get(capability);
      assert.ok(generation?.held.assertLive());
      if (hostFault === "before")
        throw new Error("host transition unconfirmed");
      const loaded = hostTransitionRecords.get(token);
      assert.ok(loaded);
      assert.equal(loaded.record.state, "docker_submission_started");
      const parsed = parseHostRecoveryToken(token);
      const updatedRecord = {
        ...loaded.record,
        state: "docker_absent_confirmed",
      };
      const serialized = `${JSON.stringify(updatedRecord)}\n`;
      const updated = `host.${parsed.rootName}.${parsed.nonce}.${createHash("sha256").update(serialized).digest("hex")}`;
      hostTransitionRecords.delete(token);
      hostTransitionRecords.set(updated, { record: updatedRecord, serialized });
      if (hostFault === "after") throw new Error("host transition result lost");
      return hostFault === "wrong_token" ? token : updated;
    },
    normalizeDockerRestartScope: (values: string[]) =>
      Object.freeze([...new Set(values)].sort()),
    dockerRecoveryPreparations: maps,
    observeHostRecoveryCleanup: () => ({
      root: cleanupRoot,
      marker: cleanupMarker,
      markerPath: "fixture-marker",
    }),
    acquireHostOperationRecoveryGenerationByIdentity: (
      hostRoot: string,
      nonce: string,
    ) => {
      const held = lock(`host:${path.basename(hostRoot)}:${nonce}`);
      if (!held) return null;
      const capability = {};
      generations.set(capability, { hostRoot, nonce, held });
      return capability;
    },
    recoverOwnedOperationDirectories: () => {
      cleanupCalls++;
      events.push("host:cleanup");
      if (cleanupFault === "throw")
        throw new Error("private cleanup exception");
      if (cleanupFault === "blocked") return { status: "blocked" };
      cleanupRoot = cleanupFault === "observation" ? "unknown" : "absent";
      cleanupMarker = "absent";
      return { status: "recovered" };
    },
    prepareCoordinatorStateHostSnapshot: (
      before: Buffer,
      recoveryId: string,
      value: unknown,
    ) => {
      const prior = JSON.parse(before.toString());
      return Buffer.from(
        `${encodeCoordinatorStateValue({ ...prior, revision: prior.revision + 1, operations: prior.operations.map((item: { recoveryId: string }) => (item.recoveryId === recoveryId ? { ...item, host: JSON.parse(JSON.stringify(value)) } : item)) })}\n`,
      );
    },
    writeRuntimeOwnedCoordinatorRecoveredHostCleanup: (
      _repo: unknown,
      recoveryId: string,
      before: Buffer,
      live: () => boolean,
    ) => {
      const operation = snapshot.operations.find(
        (item) => item.recoveryId === recoveryId,
      );
      assert.ok(operation);
      return context.writeRuntimeOwnedCoordinatorRecoveryCheckpoint(
        _repo,
        recoveryId,
        before,
        "host",
        { ...operation.host, cleanup: "confirmed" },
        live,
      );
    },
    acquireHostOperationRecoveryGeneration: (
      hostToken: string,
      hostRoot: string,
    ) => {
      if (cleanupMarker !== "present") return null;
      const parsed = parseHostRecoveryToken(hostToken);
      const held = lock(`host:${parsed.rootName}:${parsed.nonce}`);
      if (!held) return null;
      const capability = {};
      generations.set(capability, { hostRoot, nonce: parsed.nonce, held });
      return capability;
    },
    verifyHostOperationRecoveryGeneration: (
      capability: object,
      hostRoot: string,
      nonce: string,
    ) => {
      const generation = generations.get(capability);
      if (
        !generation ||
        generation.hostRoot !== hostRoot ||
        generation.nonce !== nonce ||
        !generation.held.assertLive()
      )
        throw new Error("host generation unavailable");
    },
    releaseHostOperationRecoveryGeneration: (capability: object) => {
      const generation = generations.get(capability);
      if (!generation) return false;
      generations.delete(capability);
      return generation.held.release();
    },
    loadHostRecoveryRecordByToken: (hostToken: string, hostRoot: string) => {
      const parsed = parseHostRecoveryToken(hostToken);
      if (
        markerFault ||
        cleanupMarker !== "present" ||
        path.basename(hostRoot) !== parsed.rootName
      )
        throw new Error("marker mismatch");
      if (hostTransitionMarker !== null) {
        const loaded = hostTransitionRecords.get(hostToken);
        if (!loaded || hostTransitionMarker === "unknown")
          throw new Error("marker unavailable");
        return {
          parsed,
          ...loaded,
          serialized:
            hostTransitionMarker === "foreign" ||
            hostTransitionMarker === "old_foreign"
              ? `${loaded.serialized} `
              : loaded.serialized,
        };
      }
      return { parsed };
    },
    borrowRuntimeOwnedCoordinatorRecoveryRepository: (candidate: unknown) =>
      candidate === root && rootValid ? repository : null,
    readRuntimeOwnedCoordinatorRecoverySnapshot: () => {
      reads++;
      if ((changeAtRead && reads >= 2) || reads === changeAtReadNumber)
        snapshot = { ...snapshot, revision: snapshot.revision + 1 };
      return {
        status: rootValid ? "completed" : "blocked",
        lockReleased: true,
        value: rootValid
          ? {
              snapshot,
              payloadSha256: createHash("sha256")
                .update(`${encodeCoordinatorStateValue(snapshot)}\n`)
                .digest("hex"),
            }
          : null,
      };
    },
    acquireRuntimeOwnedHostOperationKernelLock: (name: string, nonce: string) =>
      lock(`host:${name}:${nonce}`),
    acquireRuntimeOwnedLogicalProviderHomeKernelLock: (home: string) =>
      lock(`home:${home}`),
    acquireRuntimeOwnedDockerRuntimeStateKernelLock: (binding: string) =>
      lock(`state:${binding}`),
    writeRuntimeOwnedCoordinatorRestartCheckpoint: (
      _repo: unknown,
      recoveryId: string,
      before: Buffer,
      checkpoint: unknown,
      live: () => boolean,
    ) => {
      writes++;
      assert.ok(live());
      assert.equal(
        before.toString(),
        `${encodeCoordinatorStateValue(snapshot)}\n`,
      );
      if (writerFault || writerFaultAt === writes)
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: false,
        };
      snapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        operations: snapshot.operations.map((op) =>
          op.recoveryId === recoveryId
            ? {
                ...op,
                dockerRestart: JSON.parse(JSON.stringify(checkpoint)) as null,
              }
            : op,
        ),
      };
      return {
        status: "completed",
        snapshotConfirmed: true,
        lockReleased: true,
        revision: snapshot.revision,
        payloadSha256: createHash("sha256")
          .update(`${encodeCoordinatorStateValue(snapshot)}\n`)
          .digest("hex"),
      };
    },
    writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
      _repo: unknown,
      recoveryId: string,
      before: Buffer,
      _kind: string,
      _value: unknown,
      live: () => boolean,
    ) => {
      writes++;
      const value = JSON.parse(JSON.stringify(_value));
      events.push(
        _kind === "resource"
          ? `save:resource:${value.purpose}:${value.request}`
          : `save:${_kind}`,
      );
      assert.ok(live());
      assert.equal(
        before.toString(),
        `${encodeCoordinatorStateValue(snapshot)}\n`,
      );
      if (writerFault || writerFaultAt === writes)
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: false,
        };
      snapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        operations: snapshot.operations.map((op) => {
          if (op.recoveryId !== recoveryId) return op;
          if (_kind === "host") return { ...op, host: value };
          if (_kind === "resource")
            return {
              ...op,
              resources: op.resources.map((resource) =>
                resource.purpose === value.purpose ? value : resource,
              ),
            };
          if (_kind === "cleanup")
            return {
              ...op,
              resources: op.resources.map((resource) => {
                const observed = value.find(
                  (item: { purpose: string }) =>
                    item.purpose === resource.purpose,
                );
                assert.ok(observed);
                if (observed.observation === "not_requested") return resource;
                return {
                  ...resource,
                  observation: observed.observation,
                  absence:
                    observed.observation === "absent"
                      ? {
                          recoveryId,
                          purpose: resource.purpose,
                          plannedResourceName: observed.plannedResourceName,
                          dockerId: resource.dockerId,
                          evidenceSha256: "e".repeat(64),
                        }
                      : null,
                };
              }),
            };
          return op;
        }),
      };
      return {
        status: "completed",
        snapshotConfirmed: true,
        lockReleased: true,
        revision: snapshot.revision,
        payloadSha256: createHash("sha256")
          .update(`${encodeCoordinatorStateValue(snapshot)}\n`)
          .digest("hex"),
      };
    },
    // 通常の準備は旧署名／配布資格へ到達してはいけない。
    verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => {
      throw new Error("legacy signing gate forbidden");
    },
  };
  const api = runInNewContext(
    (mode === "restart" ? body : recoveryBody) +
      (mode === "restart"
        ? "\n({prepare:prepareRuntimeOwnedDockerRestart,verify:verifyRuntimeOwnedDockerRestartPreparation,persist:persistRuntimeOwnedDockerRestartCheckpoint,release:releaseRuntimeOwnedDockerRestartPreparation,finalize:finalizeRuntimeOwnedDockerRestartPreparation})"
        : "\n({prepare:prepareRuntimeOwnedDockerTaskRecovery,persist:persistRuntimeOwnedDockerTaskRecoveryCheckpoint,release:releaseRuntimeOwnedDockerTaskRecoveryPreparation,recover:recoverRuntimeOwnedDockerTaskResources,expectations:currentDockerRecoveryResourceExpectations,confirmHost:confirmRuntimeOwnedDockerTaskHostAbsence,cleanupHost:cleanupRuntimeOwnedDockerTaskHost})"),
    context,
  );
  return {
    api,
    root,
    token,
    secondToken,
    acquired,
    released,
    events,
    repository,
    installHostTransition(
      marker: "old" | "old_foreign" | "expected" | "unknown" | "foreign",
      transition: "absence" | "begin" | "cancel" = "absence",
    ) {
      const operation = snapshot.operations[0];
      assert.ok(operation);
      const old = parseHostRecoveryToken(operation.host.currentToken);
      const recordBefore = {
        schema: "crdd-coordinator-host-recovery/v1",
        rootName: old.rootName,
        nonce: old.nonce,
        state:
          transition === "begin" ? "host_only" : "docker_submission_started",
      };
      const serialized = `${JSON.stringify(recordBefore)}\n`;
      const expectedRecord = {
        ...recordBefore,
        state:
          transition === "begin"
            ? "docker_submission_started"
            : transition === "cancel"
              ? "host_only"
              : "docker_absent_confirmed",
      };
      const expectedSerialized = `${JSON.stringify(expectedRecord)}\n`;
      const currentToken = `host.${old.rootName}.${old.nonce}.${createHash("sha256").update(serialized).digest("hex")}`;
      const expectedToken = `host.${old.rootName}.${old.nonce}.${createHash("sha256").update(expectedSerialized).digest("hex")}`;
      operation.host.currentToken = currentToken;
      operation.host.pendingTransitionJson =
        `${JSON.stringify({ currentToken, expectedToken, rootName: old.rootName, nonce: old.nonce, currentState: recordBefore.state, nextState: expectedRecord.state, recordBefore })}\n` as unknown as null;
      operation.execution.ownerEffect = "disabled";
      hostTransitionMarker = marker;
      const oldMarker = marker === "old" || marker === "old_foreign";
      hostTransitionRecords.set(oldMarker ? currentToken : expectedToken, {
        record: oldMarker ? recordBefore : expectedRecord,
        serialized: oldMarker ? serialized : expectedSerialized,
      });
      return { currentToken, expectedToken };
    },
    get snapshot() {
      return snapshot;
    },
    get writes() {
      return writes;
    },
    get planningCalls() {
      return planningCalls;
    },
    get cleanupCalls() {
      return cleanupCalls;
    },
    set cleanupFault(value: typeof cleanupFault) {
      cleanupFault = value;
    },
    set cleanupRoot(value: typeof cleanupRoot) {
      cleanupRoot = value;
    },
    set cleanupMarker(value: typeof cleanupMarker) {
      cleanupMarker = value;
    },
    get hostTransitions() {
      return hostTransitions;
    },
    set hostFault(value: typeof hostFault) {
      hostFault = value;
    },
    set writerFaultAt(value: number) {
      writerFaultAt = value;
    },
    set changeAtReadNumber(value: number) {
      changeAtReadNumber = value;
    },
    set rootValid(value: boolean) {
      rootValid = value;
    },
    set ownerLive(value: boolean) {
      ownerLive = value;
    },
    set ownerThrows(value: boolean) {
      ownerThrows = value;
    },
    set changeAtRead(value: boolean) {
      changeAtRead = value;
    },
    set writerFault(value: boolean) {
      writerFault = value;
    },
    set markerFault(value: boolean) {
      markerFault = value;
    },
    set releaseFault(value: typeof releaseFault) {
      releaseFault = value;
    },
    set acquireFault(value: string | null) {
      acquireFault = value;
    },
    set acquireNull(value: string | null) {
      acquireNull = value;
    },
  };
}

/**
 * Host清掃の保存・処置・再入場を本番Driverで評価する。
 * @responsibility 清掃成功後の保存失敗も同じ参照から保存だけ再試行できることを反証する。
 * @trace ERB-IT-014
 * @precondition 本番Driverへ合成のHost・状態I/Oだけを注入する。
 * @stimulus 正常、予定保存拒否、清掃拒否／例外／観測不明、最終保存拒否を与える。
 * @observation 保存順、Host削除数、固定元版、全他欄とfresh再入場。
 * @oracle 予定保存前の削除0、不明後の追加処置0、清掃後再入場の再削除0。
 * @cleanup 全準備を解放する。実Docker・Filesystem処置なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Host清掃Driver→合成Host／Writer。
 */
test("現在Host清掃は予定保存・物理回収・確定と保存だけの再入場を分離する", () => {
  for (const fault of [
    "none",
    "intent",
    "final",
    "blocked",
    "throw",
    "observation",
  ] as const) {
    const f = fixture("recovery");
    const transition = f.installHostTransition("expected");
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    operation.host.currentToken = transition.expectedToken;
    operation.host.pendingTransitionJson = null;
    const before = JSON.parse(JSON.stringify(f.snapshot.operations));
    if (fault === "intent") f.writerFaultAt = 1;
    else if (fault === "final") f.writerFaultAt = 2;
    else f.cleanupFault = fault;
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared");
    assert.equal(f.api.cleanupHost(prepared.capability), fault === "none");
    assert.equal(f.cleanupCalls, fault === "intent" ? 0 : 1);
    assert.equal(
      f.snapshot.operations[0]?.host.cleanup,
      fault === "none"
        ? "confirmed"
        : fault === "intent"
          ? "not_requested"
          : "pending",
    );
    assert.deepEqual(
      f.snapshot.operations,
      before.map((item: { host: object }, index: number) =>
        index === 0 ? { ...item, host: f.snapshot.operations[0]?.host } : item,
      ),
    );
    const writes = f.writes,
      calls = f.cleanupCalls;
    assert.equal(f.api.cleanupHost(prepared.capability), fault === "none");
    assert.equal(f.writes, writes);
    assert.equal(f.cleanupCalls, calls);
    f.api.release(prepared.capability);
    if (fault === "final" || fault === "none") {
      const fresh = f.api.prepare(f.token, f.root);
      assert.equal(fresh.status, "prepared");
      assert.equal(f.api.cleanupHost(fresh.capability), true);
      assert.equal(f.cleanupCalls, calls);
      assert.equal(f.writes, writes + (fault === "final" ? 1 : 0));
      assert.equal(f.snapshot.operations[0]?.host.cleanup, "confirmed");
      assert.equal(f.api.release(fresh.capability), true);
    }
  }
});

/**
 * 両不存在へのfresh再入場を固定Identityと既知終端へ限定する。
 * @responsibility 部分残存・観測不能・未要求・確定と実体の矛盾からOwnerを発行しない。
 * @trace ERB-IT-014
 * @precondition 本番準備へ合成三値観測を注入する。
 * @stimulus pending／unknown／confirmed、Root／marker、Ownerと資源の各境界を与える。
 * @observation 準備結果、取得・Writer・削除数。
 * @oracle 正当な両不存在だけを取得し、confirmedはWriter0、不正は取得前停止。
 * @cleanup 正当な準備だけを解放する。実資源なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Owner準備→Host三値観測。
 */
test("現在Host清掃の不存在再入場は部分残存と不明を採用しない", () => {
  for (const fault of [
    "pending",
    "unknown",
    "confirmed",
    "unrequested",
    "root_present",
    "root_unknown",
    "marker_unknown",
    "confirmed_present",
    "active",
    "resource",
    "marker_path",
  ] as const) {
    const f = fixture("recovery");
    const transition = f.installHostTransition("expected");
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    operation.host.currentToken = transition.expectedToken;
    operation.host.pendingTransitionJson = null;
    operation.host.cleanup = (
      fault === "unknown"
        ? "unknown"
        : fault.startsWith("confirmed")
          ? "confirmed"
          : fault === "unrequested"
            ? "not_requested"
            : "pending"
    ) as typeof operation.host.cleanup;
    f.cleanupRoot =
      fault === "root_present" || fault === "confirmed_present"
        ? "present"
        : fault === "root_unknown"
          ? "unknown"
          : "absent";
    f.cleanupMarker =
      fault === "marker_unknown"
        ? "unknown"
        : fault === "confirmed_present"
          ? "present"
          : "absent";
    if (fault === "active") operation.execution.ownerEffect = "active";
    if (fault === "resource")
      operation.resources = operation.resources.map((resource, index) =>
        index === 0 ? { ...resource, request: "unknown" } : resource,
      );
    if (fault === "marker_path") {
      const identity = JSON.parse(operation.identityJson);
      identity.hostPaths.marker = "different-marker";
      operation.identityJson = JSON.stringify(identity);
    }
    const ready = ["pending", "unknown", "confirmed"].includes(fault);
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, ready ? "prepared" : "blocked", fault);
    if (ready) {
      assert.equal(f.api.cleanupHost(prepared.capability), true);
      assert.equal(f.writes, fault === "confirmed" ? 0 : 1);
      assert.equal(f.api.release(prepared.capability), true);
    } else assert.equal(f.acquired.length, 0, fault);
    assert.equal(f.cleanupCalls, 0);
  }
});

/**
 * fresh回収Ownerの部分取得失敗でも取得済み排他を全逆順解放する。
 * @responsibility Host世代を二重取得せず、一次失敗と解放不明を区別する。
 * @trace ERB-IT-014
 * @precondition 本番準備本文へ排他・Reader境界だけを注入する。
 * @stimulus Host／Home／Runtime取得失敗、元版差と解放false／例外を与える。
 * @observation 取得・解放のexact順序、固定拒否と清掃確認。
 * @oracle 成功取得済み全排他を逆順処置し、後続解放を省略しない。
 * @cleanup N/A: 合成境界のみ。実排他・Docker・Filesystemへの処置なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番回収Owner→排他Adapter故障。
 */
test("現在回収Ownerは部分取得と解放不明を共同保持する", () => {
  const baseline = fixture("recovery");
  const prepared = baseline.api.prepare(baseline.token, baseline.root);
  assert.equal(prepared.status, "prepared");
  assert.equal(baseline.acquired.length, 3);
  assert.equal(baseline.api.release(prepared.capability), true);
  assert.deepEqual(baseline.released, [...baseline.acquired].reverse());
  for (const id of baseline.acquired) {
    for (const mode of ["null", "throw"] as const) {
      const f = fixture("recovery");
      if (mode === "throw") f.acquireFault = id;
      else f.acquireNull = id;
      const refused = f.api.prepare(f.token, f.root);
      assert.equal(refused.status, "blocked");
      assert.equal(refused.cleanupConfirmed, false);
      assert.deepEqual(f.released, f.acquired.slice(0, -1).reverse());
      assert.equal(f.writes, 0);
    }
  }
  for (const fault of ["false", "throw"] as const) {
    const f = fixture("recovery");
    f.changeAtRead = true;
    f.releaseFault = fault;
    const refused = f.api.prepare(f.token, f.root);
    assert.equal(refused.status, "blocked");
    assert.equal(refused.reason, "docker_task_recovery_boundary_changed");
    assert.equal(refused.cleanupConfirmed, false);
    assert.deepEqual(f.released, [...f.acquired].reverse());
  }
});

/**
 * 保存済みHost意図と実markerの二状態だけをfresh Ownerへ結合する。
 * @responsibility 旧tokenと予定tokenの採用条件、未知状態の取得前停止を反証する。
 * @trace ERB-IT-014
 * @precondition 本番準備本文、実lineage検証と模擬Reader・排他を使う。
 * @stimulus old／expected marker、本文差、欠測、active Owner、unknown資源、正式なbegin／cancel pending、元版変化を与える。
 * @observation 取得数、保持token、Writer 0と取得済み排他の全解放。
 * @oracle exact二状態だけprepared、その他は同じ回復参照で停止しHost処置・保存を行わない。
 * @cleanup 合成境界のみ。Docker・Host実処置は発行しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Owner準備→Host記録／排他／Reader。
 */
test("現在回収Ownerは保存済みHost予定tokenだけを再入場へ採用する", () => {
  for (const marker of ["old", "expected"] as const) {
    const f = fixture("recovery");
    const tokens = f.installHostTransition(marker);
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared", marker);
    assert.equal(f.acquired.length, 3);
    assert.equal(operation.host.currentToken, tokens.currentToken);
    assert.equal(f.writes, 0);
    assert.equal(
      f.api.persist(prepared.capability, "lifecycle", {
        phase: operation.phase,
        lease: operation.lease,
        execution: operation.execution,
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      }),
      true,
    );
    assert.equal(f.api.release(prepared.capability), true);
    assert.deepEqual(f.released, [...f.acquired].reverse());
  }
  for (const fault of [
    "unknown",
    "foreign",
    "old_foreign",
    "pending_begin",
    "pending_cancel",
    "owner_active",
    "resource_unknown",
    "lineage",
    "revision",
  ] as const) {
    const f = fixture("recovery");
    f.installHostTransition(
      fault === "unknown" || fault === "foreign" || fault === "old_foreign"
        ? fault
        : fault === "pending_begin" || fault === "pending_cancel"
          ? "old"
          : "expected",
      fault === "pending_begin"
        ? "begin"
        : fault === "pending_cancel"
          ? "cancel"
          : "absence",
    );
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    if (fault === "owner_active") operation.execution.ownerEffect = "active";
    if (fault === "resource_unknown") {
      const resource = operation.resources[0];
      assert.ok(resource);
      operation.resources[0] = {
        ...resource,
        request: "unknown",
      };
    }
    if (fault === "lineage") {
      const pending = JSON.parse(
        operation.host.pendingTransitionJson as unknown as string,
      );
      pending.expectedToken = pending.currentToken;
      operation.host.pendingTransitionJson =
        `${JSON.stringify(pending)}\n` as unknown as null;
    }
    if (fault === "revision") f.changeAtRead = true;
    const refused = f.api.prepare(f.token, f.root);
    assert.equal(refused.status, "blocked", fault);
    assert.equal(refused.recoveryId, f.token);
    assert.equal(f.writes, 0);
    if (fault !== "revision") assert.equal(f.acquired.length, 0, fault);
    assert.deepEqual(f.released, [...f.acquired].reverse(), fault);
  }
});

/**
 * Host遷移の意図・実処置・保存確定を同じ現在Ownerへ接続する。
 * @responsibility 四状態の再入場と返却・保存不明後の追加処置0を反証する。
 * @trace ERB-IT-014
 * @precondition 本番回収本文・実lineage、模擬Host／Writer／排他だけを使用する。
 * @stimulus pendingなし、旧marker、予定marker、確定後再入場、前後例外、処置直前元版差、保存拒否と汎用保存による先行token更新を与える。
 * @observation 保存と処置の順序・件数、Host欄、他操作／一次失敗／結果、保持排他の解放。
 * @oracle 意図読戻し後だけ一度遷移し、予定markerでは再遷移せず、失敗後の同Owner再処置は0。
 * @cleanup 合成境界だけ。実Docker・Filesystem処置は発行しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収Owner→Host遷移／現在Writer。
 */
test("現在Host不存在遷移は意図保存とexact token確定を一操作にする", () => {
  {
    const f = fixture("recovery");
    const tokens = f.installHostTransition("old");
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    const before = encodeCoordinatorStateValue(f.snapshot);
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared");
    assert.equal(
      f.api.persist(prepared.capability, "host", {
        ...operation.host,
        currentToken: tokens.expectedToken,
        pendingTransitionJson: null,
      }),
      false,
      "generic Writer must not bypass Host observation",
    );
    assert.equal(f.writes, 0);
    assert.equal(encodeCoordinatorStateValue(f.snapshot), before);
    assert.equal(f.api.confirmHost(prepared.capability), false);
    assert.equal(f.hostTransitions, 0);
    assert.equal(f.api.release(prepared.capability), true);
    const fresh = f.api.prepare(f.token, f.root);
    assert.equal(
      fresh.status,
      "prepared",
      "rejected generic update must preserve old marker",
    );
    assert.equal(f.api.confirmHost(fresh.capability), true);
    assert.equal(f.hostTransitions, 1);
    assert.equal(f.api.release(fresh.capability), true);
  }
  for (const state of [
    "new",
    "pending_old",
    "pending_expected",
    "settled",
  ] as const) {
    const f = fixture("recovery");
    const tokens = f.installHostTransition(
      state === "pending_expected" || state === "settled" ? "expected" : "old",
    );
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    if (state === "new" || state === "settled")
      operation.host.pendingTransitionJson = null;
    if (state === "settled") operation.host.currentToken = tokens.expectedToken;
    operation.primaryFailure = {
      purpose: "create_subscription_auth_probe",
      stage: "command_wait",
      reason: "provider_result_invalid",
      exceptionCode: null,
      commandHandleObtained: true,
      responseObserved: false,
      receiptRecorded: false,
    } as unknown as null;
    operation.outcome = {
      status: "blocked",
      reason: "provider_result_invalid",
      cleanupConfirmed: false,
    } as unknown as null;
    const before = JSON.parse(JSON.stringify(f.snapshot.operations));
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared", state);
    assert.equal(f.api.confirmHost(prepared.capability), true, state);
    const after = f.snapshot.operations[0];
    assert.ok(after);
    assert.deepEqual(
      JSON.parse(JSON.stringify(after)),
      {
        ...before[0],
        host: {
          ...before[0].host,
          currentToken: tokens.expectedToken,
          pendingTransitionJson: null,
        },
      },
      state,
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(f.snapshot.operations[1])),
      before[1],
    );
    assert.equal(
      f.hostTransitions,
      state === "new" || state === "pending_old" ? 1 : 0,
    );
    assert.equal(f.writes, state === "new" ? 2 : state === "settled" ? 0 : 1);
    assert.deepEqual(
      f.events,
      state === "new"
        ? ["save:host", "host:confirm", "save:host"]
        : state === "pending_old"
          ? ["host:confirm", "save:host"]
          : state === "pending_expected"
            ? ["save:host"]
            : [],
    );
    const writes = f.writes,
      transitions = f.hostTransitions;
    assert.equal(f.api.confirmHost(prepared.capability), true);
    assert.equal(f.writes, writes);
    assert.equal(f.hostTransitions, transitions);
    assert.equal(f.api.release(prepared.capability), true);
  }
  for (const fault of [
    "revision_before_effect",
    "intent_write",
    "final_write",
    "before",
    "after",
    "wrong_token",
  ] as const) {
    const f = fixture("recovery");
    f.installHostTransition("old");
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    operation.host.pendingTransitionJson = null;
    if (fault === "revision_before_effect") f.changeAtReadNumber = 5;
    else if (fault === "intent_write") f.writerFaultAt = 1;
    else if (fault === "final_write") f.writerFaultAt = 2;
    else f.hostFault = fault;
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared");
    assert.equal(f.api.confirmHost(prepared.capability), false, fault);
    const writes = f.writes,
      transitions = f.hostTransitions;
    assert.equal(
      transitions,
      fault === "intent_write" || fault === "revision_before_effect" ? 0 : 1,
    );
    assert.equal(f.api.confirmHost(prepared.capability), false);
    assert.equal(f.writes, writes);
    assert.equal(f.hostTransitions, transitions);
    assert.equal(
      f.snapshot.operations[0]?.host.pendingTransitionJson !== null,
      fault !== "intent_write",
    );
    assert.equal(
      f.api.release(prepared.capability),
      fault !== "intent_write" && fault !== "final_write",
    );
    assert.deepEqual(f.released, [...f.acquired].reverse());
    if (fault === "after" || fault === "wrong_token") {
      f.hostFault = "none";
      const fresh = f.api.prepare(f.token, f.root);
      assert.equal(fresh.status, "prepared");
      assert.equal(f.api.confirmHost(fresh.capability), true);
      assert.equal(
        f.hostTransitions,
        transitions,
        "fresh Owner must not repeat settled transition",
      );
      assert.equal(f.api.release(fresh.capability), true);
    }
  }
});

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
    const f = fixture("recovery");
    const tokens = f.installHostTransition("old");
    const operation = f.snapshot.operations[0];
    assert.ok(operation);
    const before = Buffer.from(`${encodeCoordinatorStateValue(f.snapshot)}\n`);
    const update = {
      ...operation.host,
      currentToken: tokens.expectedToken,
      pendingTransitionJson: null,
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
        encodeCoordinatorStateValue,
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
        : Buffer.from(`${encodeCoordinatorStateValue(f.snapshot)}\n`);
    const result = invoke(
      { ...f.repository, operationId: "a" },
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
    const f = fixture("recovery"),
      operation = f.snapshot.operations[0];
    assert.ok(operation);
    operation.host.cleanup = "pending" as typeof operation.host.cleanup;
    operation.execution.ownerEffect = "disabled";
    if (fault === "cleanup") operation.host.cleanup = "not_requested";
    if (fault === "pending")
      operation.host.pendingTransitionJson = "{}" as unknown as null;
    if (fault === "active") operation.execution.ownerEffect = "active";
    if (fault === "resource")
      operation.resources = operation.resources.map((resource, index) =>
        index === 0 ? { ...resource, request: "unknown" } : resource,
      );
    const before = Buffer.from(`${encodeCoordinatorStateValue(f.snapshot)}\n`);
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
        encodeCoordinatorStateValue,
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
      { ...f.repository, operationId: fault === "owner" ? "other" : "a" },
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
 * 現在資源との一意な結合を下位技術計画より先に評価する。
 * @responsibility 欠測・重複・未知用途から部分回収計画を生成しない。
 * @trace ERB-IT-014
 * @precondition 本番wrapperと実DI純粋planner、合成現在Stateを使用する。
 * @stimulus 五用途の欠測、重複、未知用途を与える。
 * @observation 固定例外、下位planner件数、Writerと処置event。
 * @oracle 不正な全ケースでplanner／Writer／処置0。
 * @cleanup N/A: 値境界だけで実資源なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在資源の結合→下位技術計画。
 */
test("現在資源の欠測・重複・未知用途は技術計画前に拒否する", () => {
  for (const fault of ["missing", "duplicate", "unknown"] as const) {
    const f = fixture("recovery"),
      operation = f.snapshot.operations[0];
    assert.ok(operation);
    const first = operation.resources[0];
    assert.ok(first);
    operation.resources =
      fault === "missing"
        ? operation.resources.slice(1)
        : operation.resources.map((resource, index) =>
            index === 4
              ? ({
                  ...resource,
                  purpose:
                    fault === "duplicate" ? first.purpose : "unknown_purpose",
                } as unknown as typeof resource)
              : resource,
          );
    assert.throws(
      () => f.api.expectations(operation),
      /docker_task_recovery_resource_missing/u,
    );
    assert.equal(f.planningCalls, 0);
    assert.equal(f.writes, 0);
    assert.deepEqual(f.events, []);
  }
});

/**
 * 未要求・確定未発行を下位要求なしで保持する。
 * @responsibility 保存された要求区分をDocker処置許可へ昇格しない。
 * @trace ERB-IT-014
 * @precondition 本番回収本文と合成Writer、固定五資源を使用する。
 * @stimulus 五資源をnot_requestedまたはnot_issuedにする。
 * @observation DI呼出し、保存順と全操作の前後値。
 * @oracle DI呼出し0、資源値不変、Host・Lease・結果・別操作不変。
 * @cleanup 合成排他を全解放。実Docker・Filesystemへの処置なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番回収→保存・DI差替え境界。
 */
test("現在資源回収は未要求と確定未発行でDIを呼ばない", () => {
  for (const request of ["not_requested", "not_issued"] as const) {
    const f = fixture("recovery");
    const target = f.snapshot.operations[0];
    assert.ok(target);
    target.resources = target.resources.map((resource) => ({
      ...resource,
      request,
    }));
    const before = JSON.stringify(f.snapshot.operations);
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared");
    try {
      const result = f.api.recover(prepared.capability, {
        discoverSubmitted: () => {
          throw new Error("discovery forbidden");
        },
        recoverObserved: () => {
          throw new Error("deletion forbidden");
        },
      });
      assert.equal(result.status, "completed");
      assert.equal(result.dockerCleanupConfirmed, true);
      assert.equal(result.recoveryId, f.token);
      assert.deepEqual(f.events, ["save:cleanup"]);
      assert.equal(JSON.stringify(f.snapshot.operations), before);
    } finally {
      assert.equal(f.api.release(prepared.capability), true);
    }
  }
});

/**
 * 発見と削除の間に同IDの保存・読戻しを要求する。
 * @responsibility 処置前unknownと発見済みIDの確定順を確認する。
 * @trace ERB-IT-014
 * @precondition 本番回収本文と合成DI、固定五資源を使用する。
 * @stimulus providerだけintent_savedにし発見IDと不存在を返す。
 * @observation 保存・発見・削除のexact順、各要求時の現在値。
 * @oracle unknown保存→発見→identified保存→同ID削除→cleanup保存。対象外不変。
 * @cleanup 合成排他を全解放。実Docker・Filesystemへの処置なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番回収→Writer→DI差替え境界。
 */
test("現在資源回収は意図をunknown保存し発見ID確定後だけ削除する", () => {
  const f = fixture("recovery");
  const target = f.snapshot.operations[0];
  assert.ok(target);
  target.resources = target.resources.map((resource) =>
    resource.purpose === "create_provider"
      ? { ...resource, request: "intent_saved" }
      : resource,
  );
  const before = structuredClone(f.snapshot.operations);
  const prepared = f.api.prepare(f.token, f.root);
  const dockerId = "3".repeat(64);
  assert.equal(prepared.status, "prepared");
  try {
    const result = f.api.recover(prepared.capability, {
      discoverSubmitted: (expectation: {
        purpose: string;
        expectedName: string;
      }) => {
        assert.equal(expectation.purpose, "create_provider");
        assert.equal(expectation.expectedName, "crdd-claude-aaaaaaaaaaaaaaaa");
        assert.equal(
          f.snapshot.operations[0]?.resources.find(
            (resource) => resource.purpose === expectation.purpose,
          )?.request,
          "unknown",
        );
        f.events.push("discover:provider");
        return dockerId;
      },
      recoverObserved: (
        expectation: { purpose: string; dockerId: string },
        options: { assertBeforeRemoval: () => boolean },
      ) => {
        assert.equal(expectation.purpose, "create_provider");
        assert.equal(expectation.dockerId, dockerId);
        const saved = f.snapshot.operations[0]?.resources.find(
          (resource) => resource.purpose === expectation.purpose,
        );
        assert.equal(saved?.request, "identified");
        assert.equal(saved?.dockerId, dockerId);
        assert.equal(saved?.receiptSource, "runtime_reconciliation");
        assert.equal(options.assertBeforeRemoval(), true);
        f.events.push("recover:provider");
        return true;
      },
    });
    assert.equal(result.status, "completed");
    assert.deepEqual(f.events, [
      "save:resource:create_provider:unknown",
      "discover:provider",
      "save:resource:create_provider:identified",
      "recover:provider",
      "save:cleanup",
    ]);
    const expected = before.map((operation, index) =>
      index === 0
        ? {
            ...operation,
            resources: operation.resources.map((resource) =>
              resource.purpose === "create_provider"
                ? {
                    ...resource,
                    request: "identified",
                    dockerId,
                    receiptSource: "runtime_reconciliation",
                    observation: "absent",
                    absence: {
                      recoveryId: f.token,
                      purpose: resource.purpose,
                      plannedResourceName: "crdd-claude-aaaaaaaaaaaaaaaa",
                      dockerId,
                      evidenceSha256: "e".repeat(64),
                    },
                  }
                : resource,
            ),
          }
        : operation,
    );
    assert.deepEqual(f.snapshot.operations, expected);
  } finally {
    assert.equal(f.api.release(prepared.capability), true);
  }
});

/**
 * 構成既知IDとProxy接続前後の二候補を同じ保存へ結合する。
 * @responsibility Container先行順と閉じた構成照合を保持する。
 * @trace ERB-IT-014
 * @precondition 五資源の識別済みIDを合成状態へ用意する。
 * @stimulus Proxyの一候補だけ拒否し、二候補目で不存在を確認する。
 * @observation DI順、各ID・Image・Network・Mount条件と保存順。
 * @oracle 発見0、provider/auth/proxy二候補/internal/egressのexact順、他状態不変。
 * @cleanup 合成排他を全解放。実Docker・Filesystemへの処置なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 固定期待値→DI差替え→cleanup Writer。
 */
test("現在資源回収は既知IDとContainer先行順とProxy二候補を保持する", () => {
  const f = fixture("recovery");
  const target = f.snapshot.operations[0];
  assert.ok(target);
  target.resources = target.resources.map((resource, index) => ({
    ...resource,
    request: "identified",
    dockerId: String(index + 1).repeat(64),
    receiptSource: "docker_create_result",
    observation: "present",
  }));
  const before = structuredClone(f.snapshot.operations);
  const prepared = f.api.prepare(f.token, f.root);
  const observed: unknown[] = [];
  try {
    const result = f.api.recover(prepared.capability, {
      discoverSubmitted: () => {
        throw new Error("known ID discovery forbidden");
      },
      recoverObserved: (
        expectation: Record<string, unknown>,
        options: { assertBeforeRemoval: () => boolean },
      ) => {
        assert.equal(options.assertBeforeRemoval(), true);
        observed.push(JSON.parse(JSON.stringify(expectation)));
        f.events.push(`recover:${expectation.purpose}`);
        return (
          expectation.purpose !== "create_proxy" ||
          (expectation.expectedNetworks as string[]).length === 2
        );
      },
    });
    assert.equal(result.status, "completed");
    const names = {
      create_provider: "claude",
      create_subscription_auth_probe: "auth",
      create_proxy: "proxy",
      create_internal_network: "internal",
      create_egress_network: "egress",
    } as const;
    const order = [
      "create_provider",
      "create_subscription_auth_probe",
      "create_proxy",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ] as const;
    const expected = order.map((purpose, index) => {
      const resource = before[0]?.resources.find(
        (item) => item.purpose === purpose,
      );
      assert.ok(resource);
      const network =
        purpose === "create_internal_network" ||
        purpose === "create_egress_network";
      return {
        purpose,
        kind: network ? "network" : "container",
        expectedName: `crdd-${names[purpose]}-aaaaaaaaaaaaaaaa`,
        ownershipLabel: "crdd.coordinator.runtime=aaaaaaaaaaaaaaaa",
        expectedImage: network
          ? null
          : `sha256:${(purpose === "create_proxy" ? "2" : "1").repeat(64)}`,
        shouldBeInternal: network
          ? purpose === "create_internal_network"
          : null,
        expectedNetworks: network
          ? []
          : purpose === "create_subscription_auth_probe"
            ? ["none"]
            : index === 3
              ? [
                  "crdd-internal-aaaaaaaaaaaaaaaa",
                  "crdd-egress-aaaaaaaaaaaaaaaa",
                ]
              : ["crdd-internal-aaaaaaaaaaaaaaaa"],
        workspaceMounted: purpose === "create_provider",
        workspaceReadOnly: purpose === "create_provider",
        initRequired: false,
        dockerId: resource.dockerId,
      };
    });
    assert.deepEqual(observed, expected);
    assert.deepEqual(f.events, [
      ...order.map((purpose) => `recover:${purpose}`),
      "save:cleanup",
    ]);
    assert.deepEqual(f.snapshot.operations[1], before[1]);
    assert.deepEqual(f.snapshot.operations[0]?.host, before[0]?.host);
    assert.equal(f.snapshot.operations[0]?.lease, before[0]?.lease);
    assert.equal(f.snapshot.operations[0]?.outcome, before[0]?.outcome);
    assert.ok(
      f.snapshot.operations[0]?.resources.every(
        (resource) => resource.observation === "absent",
      ),
    );
  } finally {
    assert.equal(f.api.release(prepared.capability), true);
  }
});

/**
 * 保存拒否・失効・未発見では新しい削除や完了を生成しない。
 * @responsibility 失敗後の追加処置0とunknown保持を確認する。
 * @trace ERB-IT-014
 * @precondition 本番Ownerと合成Writer／DIだけを使用する。
 * @stimulus unknown保存拒否、identified保存拒否、発見後失効とnullを返す。
 * @observation 保存・発見・削除回数、同Context再呼出しと状態。
 * @oracle 保存拒否・失効後削除0、未発見は非完了。Host／Lease／別操作を保持する。
 * @cleanup 合成排他を解放。実Docker・Filesystemへの処置なし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番回収→故障Writer／DI差替え。
 */
test("現在資源回収は保存拒否と失効と未発見で削除を止める", () => {
  for (const fault of [
    "intent_save",
    "identified_save",
    "owner",
    "owner_before_remove",
    "null",
  ] as const) {
    const f = fixture("recovery");
    const target = f.snapshot.operations[0];
    assert.ok(target);
    target.resources = target.resources.map((resource) =>
      resource.purpose === "create_provider"
        ? { ...resource, request: "intent_saved" }
        : resource,
    );
    const before = structuredClone(f.snapshot.operations);
    const prepared = f.api.prepare(f.token, f.root);
    if (fault === "intent_save") f.writerFault = true;
    let discoveries = 0,
      deletions = 0;
    const operations = {
      discoverSubmitted: () => {
        discoveries++;
        if (fault === "identified_save") f.writerFault = true;
        if (fault === "owner") f.ownerLive = false;
        return fault === "null" ? null : "3".repeat(64);
      },
      recoverObserved: (
        _expectation: unknown,
        options: { assertBeforeRemoval: () => boolean },
      ) => {
        if (fault === "owner_before_remove") f.ownerLive = false;
        assert.equal(options.assertBeforeRemoval(), true);
        deletions++;
        return true;
      },
    };
    try {
      const result = f.api.recover(prepared.capability, operations);
      assert.equal(result.status, "blocked");
      assert.equal(result.dockerCleanupConfirmed, false);
      assert.equal(result.recoveryId, f.token);
      assert.equal(discoveries, fault === "intent_save" ? 0 : 1);
      assert.equal(deletions, 0);
      assert.deepEqual(f.snapshot.operations[1], before[1]);
      assert.deepEqual(f.snapshot.operations[0]?.host, before[0]?.host);
      assert.equal(f.snapshot.operations[0]?.lease, before[0]?.lease);
      assert.equal(f.snapshot.operations[0]?.outcome, before[0]?.outcome);
      if (fault === "null") {
        const resource = f.snapshot.operations[0]?.resources.find(
          (item) => item.purpose === "create_provider",
        );
        assert.equal(resource?.request, "unknown");
        assert.equal(resource?.observation, "unknown");
        assert.equal(resource?.dockerId, null);
      } else {
        const writes = f.writes;
        f.writerFault = false;
        f.ownerLive = true;
        assert.equal(
          f.api.recover(prepared.capability, operations).status,
          "blocked",
        );
        assert.equal(f.writes, writes);
        assert.equal(deletions, 0);
        assert.equal(discoveries, fault === "intent_save" ? 0 : 1);
      }
    } finally {
      f.ownerLive = true;
      assert.equal(f.api.release(prepared.capability), fault === "null");
      assert.deepEqual(f.released, [...f.acquired].reverse());
    }
  }
});

/**
 * marker・Owner失効と保存不明後は同じContextのWriterを再発行しない。
 * @responsibility Reader成功や後着の回復でsticky失効を消さない。
 * @trace ERB-IT-014
 * @precondition 本番の私有MapとOwner本文を合成境界で実行する。
 * @stimulus marker差、保持失効、保存解放不明、Contextコピーと再使用を与える。
 * @observation Writer件数、保存返却、全解放と二度目使用拒否。
 * @oracle marker／Owner差は保存0、Writer不明は一回だけで、復元後も追加保存0。
 * @cleanup 全取得済み合成排他を解放する。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番回収Owner→Writer／marker故障。
 */
test("現在回収Ownerはmarker差と保存不明後の追加Writerを拒否する", () => {
  for (const fault of ["marker", "owner", "owner_throw", "writer"] as const) {
    const f = fixture("recovery");
    const prepared = f.api.prepare(f.token, f.root);
    assert.equal(prepared.status, "prepared");
    assert.equal(
      f.api.persist({ ...prepared.capability }, "lifecycle", {}),
      false,
    );
    if (fault === "marker") f.markerFault = true;
    if (fault === "owner") f.ownerLive = false;
    if (fault === "owner_throw") f.ownerThrows = true;
    if (fault === "writer") f.writerFault = true;
    assert.equal(f.api.persist(prepared.capability, "lifecycle", {}), false);
    const writes = f.writes;
    assert.equal(writes, fault === "writer" ? 1 : 0);
    f.markerFault = false;
    f.ownerLive = true;
    f.ownerThrows = false;
    f.writerFault = false;
    assert.equal(f.api.persist(prepared.capability, "lifecycle", {}), false);
    assert.equal(f.writes, writes);
    assert.equal(f.api.release(prepared.capability), fault === "marker");
    assert.deepEqual(f.released, [...f.acquired].reverse());
    assert.equal(f.api.release(prepared.capability), false);
  }
});
/**
 * 複数操作の全Scopeを決定的順序で取得し逆順に解放する。
 * @responsibility 現準備Ownerの対象・元版・排他・失敗相関を反証する。
 * @trace ERB-IT-014
 * @precondition 実準備本文と合成の外部観測境界を使用する。
 * @stimulus 二つのHomeとHostを持つ現在操作を準備する。
 * @observation 取得・解放の各Identity、Writer件数と固定結果。
 * @oracle Host→Home→Runtimeの五排他、保存0、逆順全解放。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("現在Scopeの複数Ownerは決定的順序で取得し逆順解放する", () => {
  const f = fixture(),
    prepared = f.api.prepare(f.token, f.root);
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.alreadyRequested, false);
  assert.equal(f.acquired.length, 5);
  assert.ok(f.acquired.slice(0, 2).every((id) => id.startsWith("host:")));
  assert.ok(f.acquired.slice(2, 4).every((id) => id.startsWith("home:")));
  assert.ok(f.acquired[4]?.startsWith("state:"));
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
 * @stimulus 後段Host／Home／Runtime取得をthrowにし、既取得解放をfalse／throwへ変える。
 * @observation 成功取得済みIdentity、全解放順、保存件数と二つの失敗分類。
 * @oracle 失敗した取得自体は解放せず、既取得のみ逆順全解放、保存0、固定一次理由とcleanup分離。
 * @cleanup 合成境界のみ。実Host・Docker・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 準備Owner→排他取得・解放。
 */
test("後段取得失敗は成功済み排他だけを逆順に全解放する", () => {
  for (const failed of [
    "host:crdd-coordinator-doctor-b:00000000-0000-0000-0000-000000000002",
    `home:${"a".repeat(64)}`,
    `state:${"c".repeat(64)}`,
  ]) {
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
    const checkpoint = f.snapshot.operations[0]?.dockerRestart as unknown as {
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
 * @oracle 対象Host／HomeとRuntimeだけ取得し、別配送記録を変更しない。
 * @cleanup 合成境界のみ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番準備→状態・排他Adapter。
 */
test("清掃済み別操作は再起動Scopeの完全一致を妨げない", () => {
  const f = fixture(),
    closed = f.snapshot.operations[1];
  assert.ok(closed);
  Object.assign(closed, {
    phase: "awaiting_delivery",
    outcome: { cleanupConfirmed: true },
    lease: "released",
  });
  closed.host.cleanup = "confirmed";
  closed.execution.ownerEffect = "disabled";
  const before = JSON.stringify(closed);
  const prepared = f.api.prepare(f.token, f.root);
  assert.equal(prepared.status, "prepared");
  assert.equal(f.acquired.length, 3);
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
