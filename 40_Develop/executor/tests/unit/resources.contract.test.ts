/**
 * 共通資源APIの固定Directory分岐と環境修復の薄い搬送を確認する。
 * @responsibility 入力・Promise・不明値の保持と未知kindの処置0を反証する。
 * @trace ERB-IT-014
 * @level UT
 * @scope DIを有限代役へ置換。実Docker・AI・Filesystem処置は行わない。
 * @boundary DIの実体確認は既存DI試験が所有し、本試験は入口の配線だけを扱う。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type {
  DockerRuntimeDirectoryCleanupResult,
  DockerRuntimeDirectoryInspectionInput,
  DockerRuntimeRepairCheckpoint,
  DockerRuntimeRepairDisposalInput,
  DockerRuntimeRepairInput,
  DockerRuntimeRepairResult,
  DockerRuntimeRepairRetentionTargets,
} from "../../../docker-isolation/src/index.ts";
import type { AttemptRecoveryTarget } from "../../src/index.ts";

/**
 * 対象別の同期性と元値を同じ代役上で照合する。
 * @responsibility 通信・保存・保持判断を作らず既存DI入力だけを搬送する。
 * @trace ERB-IT-014
 * @precondition DIを実Moduleのimport前に置換する。
 * @stimulus 観測null、三値要求・二値不存在、取消、Reject、不正kind。
 * @observation 元入力、Promise、結果、呼出し数。
 * @oracle 変換・補完・Directory以外からの削除要求は0。
 * @cleanup mock解除。実資源は作成しない。
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
        createDockerProbeRuntimeBinding: unexpected,
        inspectDockerContainer: unexpected,
        observeDockerContainerAbsence: unexpected,
        cleanupDockerContainer: unexpected,
        createDockerTaskRecoveryExecutor: unexpected,
        planDockerRecoveryResourceExpectations: unexpected,
        codexAdviceProviderInitRequired: unexpected,
        observeDockerRuntimeRepairRetention: (input: unknown) => {
          calls.push(input);
          return targets;
        },
        disposeDockerRuntimeRepairDirectory: (input: unknown) => {
          calls.push(input);
          return cleanup;
        },
        observeDockerRuntimeBackendState: unexpected,
        observeDockerRuntimeEngine: unexpected,
        restartDockerRuntime: unexpected,
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
    const { restartDockerEnvironment } = await import(
      "../../src/environment/execute.ts"
    );
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
      } as unknown as AttemptRecoveryTarget;
      assert.equal(inspectResources(bad).status, "blocked");
      assert.equal(cleanupResources(bad).status, "blocked");
    }
    const proxy = new Proxy({} as AttemptRecoveryTarget, { get: unexpected });
    assert.throws(() => inspectResources(proxy), /resource_target_invalid/);
    assert.throws(() => cleanupResources(proxy), /resource_target_invalid/);
    assert.equal(calls.length, before);
  } finally {
    lower.restore();
  }
});
