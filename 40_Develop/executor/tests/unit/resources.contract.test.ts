/**
 * Attempt入力の事前拒否と共通資源APIの薄い搬送を確認する。
 * @responsibility 入力・Promise・不明値の保持と未知kindの処置0を反証する。
 * @trace ERB-IT-014
 * @level UT
 * @scope DIを有限代役へ置換。実Docker・AI・Filesystem処置は行わない。
 * @boundary DIの実体確認は既存DI試験が所有し、本試験は入口の配線だけを扱う。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createAttemptRecoveryTestApi } from "../../scripts/attempt-recovery-test.ts";
import type { ResourceTarget as AttemptResourceTarget } from "../../src/attempt/types.ts";

import type {
  DockerRuntimeDirectoryCleanupResult,
  DockerRuntimeDirectoryInspectionInput,
  DockerRuntimeRepairDisposalInput,
  DockerRuntimeRepairInput,
  DockerRuntimeRepairResult,
} from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import type {
  DockerRuntimeRepairCheckpoint,
  DockerRuntimeRepairRetentionTargets,
} from "../../../docker-isolation/src/docker-desktop/types.ts";
import type { ResourceTarget } from "../../src/index.ts";

/**
 * 未要求・限定観測でも対象集合全体の入力拒否を維持する。
 * @responsibility 選択前の入力検査と技術接続未取得を確認する。
 * @trace ERB-IT-014
 * @precondition 本番回収本文と有限DI接続代役を使用する。
 * @stimulus 正常未要求と、選択外資源の不正prefixを渡す。
 * @observation completed又はblocked、DI接続取得数。
 * @oracle 正常未要求のみcompleted。不正はblocked、取得0。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary 上位投影からExecutor入力検査まで。
 */
test("未要求と限定認証観測も選択外の不正入力を技術要求前に拒否する", async () => {
  let calls = 0;
  const api = createAttemptRecoveryTestApi(() => {
    calls++;
    throw Error("must_not_acquire");
  });
  const projection = {
    authContainerName: "crdd-auth-0123456789abcdef",
    providerContainerName: "crdd-codex-0123456789abcdef",
    proxyContainerName: "crdd-proxy-0123456789abcdef",
    internalNetworkName: "crdd-internal-0123456789abcdef",
    egressNetworkName: "crdd-egress-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
  };
  const receipts = Object.fromEntries(
    [
      "create_provider",
      "create_subscription_auth_probe",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ].map((key) => [key, { submitted: false, dockerId: null }]),
  );
  const target = {
    kind: "resource_set",
    operationId: "OP-123456",
    recoveryId: "exact-recovery",
    projection,
    receipts,
    managementDirectory: null,
  };
  const normal = api.inspectResources(
    target as unknown as AttemptResourceTarget,
  );
  assert.equal(normal.status, "completed");
  assert.equal(
    (await api.cleanupResources(target as unknown as AttemptResourceTarget))
      .status,
    "completed",
  );
  for (const submitted of [false, true]) {
    const invalid = {
      ...target,
      projection: {
        ...projection,
        egressNetworkName: projection.authContainerName,
      },
      receipts: {
        ...receipts,
        create_subscription_auth_probe: { submitted, dockerId: null },
      },
    };
    assert.equal(
      api.inspectResources(
        invalid as unknown as AttemptResourceTarget,
        "create_subscription_auth_probe",
      ).status,
      "blocked",
    );
    assert.equal(
      (await api.cleanupResources(invalid as unknown as AttemptResourceTarget))
        .status,
      "blocked",
    );
  }
  assert.equal(calls, 0);
});

/**
 * 固定Directoryの観測・回収と環境操作の薄い接続を検証する。
 * @responsibility 実在する下位操作へ元入力を渡す。
 * @trace ERB-IT-014
 * @precondition DIを有限代役へ置換する。
 * @stimulus 正常・取消・不明を与える。
 * @observation 元入力とPromise、処置数。
 * @oracle 元契約を変更せず、範囲外の要求を発行しない。
 * @cleanup Module代役を解除する。
 * @boundary Executor公開入口からDIへの接続。
 */
test("共通資源APIは固定DI入力と対象別の同期性を保持する", async () => {
  const calls: unknown[] = [];
  let targets: DockerRuntimeRepairRetentionTargets | null = null;
  let cleanup: Promise<DockerRuntimeDirectoryCleanupResult> = Promise.resolve({
    request: "not_issued",
    absence: "unknown",
  });
  const repairResult: DockerRuntimeRepairResult = Object.freeze({
    preparation: "boundary_unavailable",
    machine: null,
    lifecycle: null,
    checkpoint: null,
    finalCheckpointConfirmed: false,
    ownerBindingSha256: null,
    scopeSha256: null,
  });
  const repaired = Promise.resolve(repairResult);
  const unexpected = () => {
    throw Error("unexpected_attempt_operation");
  };
  const original = await import("../../../docker-isolation/src/index.ts");
  const lower = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...original,
        createDockerTaskRecoveryExecutor: unexpected,
        planDockerRecoveryResourceExpectations: unexpected,
        codexAdviceProviderInitRequired: unexpected,
        inspectIsolation: (target: { kind: string; input: unknown }) => {
          assert.equal(target.kind, "docker_runtime_directory");
          calls.push(target.input);
          return targets;
        },
        cleanupIsolation: (target: { kind: string; input: unknown }) => {
          assert.equal(target.kind, "docker_runtime_directory");
          calls.push(target.input);
          return cleanup;
        },
        observeDockerRuntimeBackendState: unexpected,
        observeDockerRuntimeEngine: unexpected,
        restartDockerRuntime: unexpected,
        restartDockerEnvironment: (request: {
          mode: string;
          input: unknown;
        }) => {
          assert.equal(request.mode, "repair");
          calls.push(request.input);
          return repaired;
        },
        runDockerRuntimeRepairSession: (input: unknown) => {
          calls.push(input);
          return repaired;
        },
      },
    },
  );
  try {
    const { inspectResources, cleanupResources } = await import(
      "../../src/lifecycle/cleanup.ts"
    );
    const { restartDockerEnvironment } = await import("../../src/index.ts");
    const controller = new AbortController();
    const checkpoint: DockerRuntimeRepairCheckpoint = {
      actions: Object.fromEntries(
        [
          "stop_runtime",
          "terminate_runtime",
          "stop_backend",
          "retain_runtime",
          "start_runtime",
          "stop_failed_runtime",
          "retain_failed_runtime",
          "retain_auxiliary_runtime",
          "restart_runtime",
        ].map((key) => [
          key,
          { intent: "not_saved", request: "not_issued", result: "unobserved" },
        ]),
      ) as DockerRuntimeRepairCheckpoint["actions"],
      directories: {
        primary: {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
        failed: {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
        auxiliary: {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
      },
      engine: "unobserved",
      stale: "unknown",
      hostSafety: "unknown",
      cleanup: "not_requested",
      cleanupFailure: null,
    };
    const inspect: DockerRuntimeDirectoryInspectionInput = Object.freeze({
      operationNonce: "a".repeat(64),
      ownerBindingSha256: "b".repeat(64),
      scopeSha256: "c".repeat(64),
      checkpoint,
      signal: controller.signal,
      canObserve: () => false,
    });
    assert.equal(
      inspectResources({ kind: "docker_runtime_directory", input: inspect }),
      null,
    );
    assert.equal(calls.at(-1), inspect);
    targets = Object.freeze({ primary: null, failed: null, auxiliary: null });
    assert.equal(
      inspectResources({ kind: "docker_runtime_directory", input: inspect }),
      targets,
    );
    const disposal: DockerRuntimeRepairDisposalInput = Object.freeze({
      operationNonce: inspect.operationNonce,
      ownerBindingSha256: inspect.ownerBindingSha256,
      scopeSha256: inspect.scopeSha256,
      checkpoint,
      purpose: "primary",
      signal: controller.signal,
      canIssueEffect: () => false,
    });
    for (const request of ["not_issued", "issued", "unknown"] as const) {
      for (const absence of ["confirmed_absent", "unknown"] as const) {
        const result = Object.freeze({ request, absence });
        cleanup = Promise.resolve(result);
        assert.equal(
          cleanupResources({
            kind: "docker_runtime_directory",
            input: disposal,
          }),
          cleanup,
        );
        assert.equal(calls.at(-1), disposal);
        assert.equal(await cleanup, result);
      }
    }
    controller.abort();
    assert.equal(
      cleanupResources({ kind: "docker_runtime_directory", input: disposal }),
      cleanup,
    );
    const failed = new Error("synthetic_lower_rejection");
    cleanup = Promise.reject(failed);
    await assert.rejects(
      cleanupResources({ kind: "docker_runtime_directory", input: disposal }),
      (error) => error === failed,
    );
    const request: DockerRuntimeRepairInput = Object.freeze({
      operationNonce: inspect.operationNonce,
      signal: controller.signal,
      resume: null,
      canIssueEffect: () => false,
      onPrepared: unexpected,
      onCheckpoint: unexpected,
    });
    assert.equal(
      restartDockerEnvironment({ mode: "repair", input: request }),
      repaired,
    );
    assert.equal(calls.at(-1), request);
    assert.equal(await repaired, repairResult);
    const before = calls.length;
    for (const kind of ["unknown", undefined]) {
      const bad = {
        kind,
        operationId: "o",
        recoveryId: "r",
      } as unknown as AttemptResourceTarget;
      assert.equal(inspectResources(bad).status, "blocked");
      assert.equal((await cleanupResources(bad)).status, "blocked");
    }
    const proxy = new Proxy({} as ResourceTarget, { get: unexpected });
    assert.throws(() => inspectResources(proxy), /resource_target_invalid/);
    assert.throws(() => cleanupResources(proxy), /resource_target_invalid/);
    assert.equal(calls.length, before);
  } finally {
    lower.restore();
  }
});
