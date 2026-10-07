/**
 * Coordinator現在状態の固定encodingと相関を検証する。
 * @responsibility 保存内容検査を実資源の回収証明と分離して反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope coordinator-state-model
 * @boundary PRL-UT-006=Direct Boundary: メモリ内の保存本文。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  COORDINATOR_STATE_SCHEMA,
  coordinatorStateContentHash,
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  validateCoordinatorStateTransition,
} from "../../src/security/coordinator-state-model.ts";

const binding = "a".repeat(64);
const empty = {
  schema: COORDINATOR_STATE_SCHEMA,
  revision: 1,
  previous: null,
  repositoryBinding: binding,
  operations: [],
  unresolvedRecoveries: [],
  pendingDeliveries: [],
};

/**
 * 正規本文と改訂相関、Repository結合を検証する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: 正規本文、改訂、結合と空集合", () => {
  const text = `${encodeCoordinatorStateValue(empty)}\n`;
  const result = decodeCoordinatorStateSnapshot(Buffer.from(text), binding);
  assert.ok(result);
  assert.equal(result.payloadSha256, coordinatorStateContentHash(empty));
  assert.ok(Object.isFrozen(result.snapshot.operations));
  for (const invalid of [
    { ...empty, repositoryBinding: "b".repeat(64) },
    { ...empty, revision: 0 },
    { ...empty, revision: 2 },
    { ...empty, unknown: true },
    { ...empty, pendingDeliveries: [{ operationNonce: binding }] },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(`${JSON.stringify(empty)}\n`),
      binding,
    ),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(text.replace('"revision":1', '"revision":1,"revision":1')),
      binding,
    ),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(Buffer.from([0xff]), binding),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(Buffer.from(text), "wrong"),
    null,
  );
});

/**
 * getterやProxyを実行せず不正JSON値を拒否する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: hostile値と配列順", () => {
  let invoked = false;
  const hostile = Object.defineProperty({}, "value", {
    get() {
      invoked = true;
      return 1;
    },
  });
  assert.throws(() => encodeCoordinatorStateValue(hostile));
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        invoked = true;
        return [];
      },
    },
  );
  assert.throws(() => encodeCoordinatorStateValue(proxy));
  assert.equal(invoked, false);
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(empty)}\n`);
  const proxyBytes = new Proxy(bytes, {
    get() {
      invoked = true;
      throw new Error("trap");
    },
  });
  assert.equal(decodeCoordinatorStateSnapshot(proxyBytes, binding), null);
  Object.defineProperty(bytes, "length", {
    get() {
      invoked = true;
      throw new Error("getter");
    },
  });
  assert.ok(decodeCoordinatorStateSnapshot(bytes, binding));
  assert.equal(invoked, false);
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(`${encodeCoordinatorStateValue(empty)}\n`),
      ]),
      binding,
    ),
    null,
  );
  assert.equal(
    encodeCoordinatorStateValue({ z: [2, 1], a: 0 }),
    '{"a":0,"z":[2,1]}',
  );
  assert.throws(() => encodeCoordinatorStateValue(new Array(2)));
  assert.throws(() => encodeCoordinatorStateValue(Number.NaN));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => encodeCoordinatorStateValue(cycle));
});

/**
 * 操作のexact参照とHost証明本文、unknown観測を保持する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: 固定Identity、資源とHost証明の相関", () => {
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
    schema: "crdd-coordinator-task-docker-recovery/v1",
    operationNonce: nonce,
    provider: "claude",
    operationId: "OP-123456",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    runtimeStateBinding: {
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash: "6".repeat(64),
      runtimeStateBindingHash: "7".repeat(64),
    },
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
  const successor = { ...hostRecord, state: "docker_submission_started" };
  const expectedToken =
    token.slice(0, -64) +
    createHash("sha256")
      .update(`${JSON.stringify(successor)}\n`)
      .digest("hex");
  const transition = {
    currentToken: token,
    expectedToken,
    rootName: hostRecord.rootName,
    nonce: "12345678-1234-4234-8234-123456789abc",
    currentState: "host_only",
    nextState: "docker_submission_started",
    recordBefore: hostRecord,
  };
  const operation = {
    identityJson,
    identitySha256,
    recoveryId,
    phase: "settling",
    resources: [
      "create_egress_network",
      "create_internal_network",
      "create_provider",
      "create_proxy",
      "create_subscription_auth_probe",
    ].map((purpose) => ({
      purpose,
      request: purpose === "create_provider" ? "identified" : "not_requested",
      dockerId: purpose === "create_provider" ? "d".repeat(64) : null,
      receiptSource:
        purpose === "create_provider" ? "docker_create_result" : null,
      observation: "unknown",
      absence: null,
    })),
    host: {
      currentToken: token,
      pendingTransitionJson: `${JSON.stringify(transition)}\n`,
      cleanup: "unknown",
    },
    lease: "unknown",
    execution: {
      providerStart: "unknown",
      externalSend: "unknown",
      sharedWrite: "unknown",
      ownerEffect: "unknown",
      workspaceReusable: false,
    },
    primaryFailure: null,
    outcome: null,
    summarySha256: null,
  };
  const snapshot = { ...empty, operations: [operation] };
  for (const [currentState, nextState] of [
    ["host_only", "docker_active"],
    ["docker_absent_confirmed", "docker_submission_started"],
    ["host_only", "docker_absent_confirmed"],
  ]) {
    const before = { ...hostRecord, state: currentState };
    const after = { ...before, state: nextState };
    const invalidTransition = {
      ...transition,
      currentState,
      nextState,
      recordBefore: before,
      currentToken:
        token.slice(0, -64) +
        createHash("sha256")
          .update(`${JSON.stringify(before)}\n`)
          .digest("hex"),
      expectedToken:
        token.slice(0, -64) +
        createHash("sha256")
          .update(`${JSON.stringify(after)}\n`)
          .digest("hex"),
    };
    const invalid = {
      ...snapshot,
      operations: [
        {
          ...operation,
          host: {
            ...operation.host,
            currentToken: invalidTransition.currentToken,
            pendingTransitionJson: `${JSON.stringify(invalidTransition)}\n`,
          },
        },
      ],
    };
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  }
  const accepted = decodeCoordinatorStateSnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(snapshot)}\n`),
    binding,
  );
  assert.ok(accepted);
  assert.equal(accepted.snapshot.operations[0]?.identityJson, identityJson);
  assert.equal(
    accepted.snapshot.operations[0]?.resources[2]?.dockerId,
    "d".repeat(64),
  );
  for (const replacement of [
    { ...operation, recoveryId: `${recoveryId.slice(0, -1)}0` },
    {
      ...operation,
      identityJson: `${encodeCoordinatorStateValue(identity)}\n`,
    },
    { ...operation, resources: [...operation.resources].reverse() },
    {
      ...operation,
      host: {
        ...operation.host,
        pendingTransitionJson: `${encodeCoordinatorStateValue(transition)}\n`,
      },
    },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(
          `${encodeCoordinatorStateValue({
            ...snapshot,
            operations: [replacement],
          })}\n`,
        ),
        binding,
      ),
      null,
    );
  const orphan = {
    ...snapshot,
    unresolvedRecoveries: [
      {
        operationNonce: "f".repeat(64),
        recoveryId,
        reason: "provider_result_invalid",
        obligations: ["docker_resources"],
      },
    ],
  };
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(`${encodeCoordinatorStateValue(orphan)}\n`),
      binding,
    ),
    null,
  );
  const currentBytes = Buffer.from(
    `${encodeCoordinatorStateValue(snapshot)}\n`,
  );
  const next = {
    ...snapshot,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: coordinatorStateContentHash(snapshot),
    },
  };
  assert.equal(
    validateCoordinatorStateTransition(
      currentBytes,
      Buffer.from(`${encodeCoordinatorStateValue(next)}\n`),
      binding,
    ),
    true,
  );
  for (const invalid of [
    { ...next, previous: { ...next.previous, payloadSha256: "f".repeat(64) } },
    { ...next, operations: [] },
    {
      ...next,
      operations: [
        {
          ...operation,
          resources: operation.resources.map((resource) =>
            resource.purpose === "create_provider"
              ? { ...resource, dockerId: "e".repeat(64) }
              : resource,
          ),
        },
      ],
    },
    {
      ...next,
      operations: [
        {
          ...operation,
          resources: operation.resources.map((resource) =>
            resource.purpose === "create_provider"
              ? {
                  ...resource,
                  request: "unknown",
                  dockerId: null,
                  receiptSource: null,
                }
              : resource,
          ),
        },
      ],
    },
    { ...next, operations: [{ ...operation, phase: "executing" }] },
    {
      ...next,
      operations: [
        {
          ...operation,
          host: { ...operation.host, pendingTransitionJson: null },
        },
      ],
    },
  ])
    assert.equal(
      validateCoordinatorStateTransition(
        currentBytes,
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
  const failure = {
    purpose: "create_provider",
    stage: "command_wait",
    reason: "provider_result_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const stopped = {
    ...snapshot,
    operations: [
      {
        ...operation,
        primaryFailure: failure,
        outcome: {
          status: "blocked",
          reason: "provider_result_invalid",
          cleanupConfirmed: false,
        },
        summarySha256: "e".repeat(64),
      },
    ],
    unresolvedRecoveries: [
      {
        operationNonce: nonce,
        recoveryId,
        reason: "provider_result_invalid",
        obligations: ["docker_resources"],
      },
    ],
    pendingDeliveries: [
      {
        operationNonce: nonce,
        recoveryId,
        resultId: "e".repeat(64),
        consumer: "coordinator_cli",
        acceptanceSha256: "f".repeat(64),
      },
    ],
  };
  const stoppedBytes = Buffer.from(`${encodeCoordinatorStateValue(stopped)}\n`);
  const stoppedNext = {
    ...stopped,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: coordinatorStateContentHash(stopped),
    },
  };
  assert.equal(
    validateCoordinatorStateTransition(
      stoppedBytes,
      Buffer.from(
        `${encodeCoordinatorStateValue({ ...stoppedNext, operations: [{ ...stopped.operations[0], outcome: { ...stopped.operations[0]?.outcome, cleanupConfirmed: true } }] })}\n`,
      ),
      binding,
    ),
    true,
  );
  for (const invalid of [
    ...(
      [
        ["providerStart", "not_started"],
        ["externalSend", "not_issued"],
        ["sharedWrite", "not_issued"],
        ["ownerEffect", "active"],
      ] as const
    ).map(([field, value]) => ({
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations[0],
          execution: { ...operation.execution, [field]: value },
        },
      ],
    })),
    { ...stoppedNext, unresolvedRecoveries: [] },
    { ...stoppedNext, pendingDeliveries: [] },
    {
      ...stoppedNext,
      pendingDeliveries: [
        { ...stopped.pendingDeliveries[0], resultId: "a".repeat(64) },
      ],
    },
    {
      ...stoppedNext,
      pendingDeliveries: [
        { ...stopped.pendingDeliveries[0], acceptanceSha256: null },
      ],
    },
    {
      ...stoppedNext,
      operations: [{ ...stopped.operations[0], primaryFailure: null }],
    },
    {
      ...stoppedNext,
      operations: [{ ...stopped.operations[0], summarySha256: null }],
    },
    {
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations[0],
          outcome: {
            status: "completed",
            reason: "provider_operation_completed",
            cleanupConfirmed: true,
          },
        },
      ],
    },
  ])
    assert.equal(
      validateCoordinatorStateTransition(
        stoppedBytes,
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
});
