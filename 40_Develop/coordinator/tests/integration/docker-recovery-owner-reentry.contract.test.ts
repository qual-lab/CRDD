/**
 * 本番Ownerの途中失敗後の進行保持を確認する。
 * @packageDocumentation
 * @responsibility 下位境界を模擬し、本番入口の元結果保持と処置再発行禁止を検証する。
 * @trace ERB-IT-003
 * @level IT
 * @scope 本番OwnerのProcess内再入場。実Docker・実Host処置の成立は主張しない。
 * @boundary ERB-IT-003=Owner→保存・Host境界の模擬接続。
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import * as controller from "../../src/docker-execution/process-controller.ts";
import * as locks from "../../src/host-execution/kernel-lock.ts";
import * as hostRuntime from "../../src/host-execution/operation-workspace-lifecycle.ts";
import * as homes from "../../src/provider/home-windows-adapter.ts";
import * as repository from "../../src/repository-operation/binding.ts";
import * as stateModel from "../../src/state-storage/model.ts";
import * as stateRuntime from "../../src/state-storage/settlement-store.ts";
import * as development from "../../src/task/development-measurement-session.ts";

/**
 * 本番開始から復帰・清掃・終了の同じOwner再入場を検証する。
 * @responsibility 下位保存失敗後の元入力保持と処置の二重発行を反証する。
 * @trace ERB-IT-003
 * @precondition 下位Host・保存・Home境界は明示的に模擬する。
 * @stimulus 本番入口へ固定計画を渡し、後続保存の停止と同Owner再入場を順に発生させる。
 * @observation 復帰・Lease解放・Capability発行・token消費回数、元object同一性と停止結果field。
 * @oracle 復帰と消費は各一回、未確認token返却なし、元object保持、別入力と清掃開始後completeを拒否する。
 * @cleanup finallyでModule mockを逆順復元する。実Docker・Host・Filesystem資源は作成しない。
 * @boundary 本番Owner公開入口と模擬下位境界。
 */
test("本番Ownerは復帰・清掃予定・終了保存の失敗から同じ元入力で再入場する", async () => {
  const management = Object.freeze({});
  const context = Object.freeze({});
  const cleanup = Object.freeze({});
  const mount = Object.freeze({});
  const completion = Object.freeze({});
  const hash = "a".repeat(64);
  const plan = Object.freeze({
    provider: "codex" as const,
    consumer: "workbench" as const,
    operationId: "OP-123456",
    grantRef: "PHMGRANT-ABCDEF",
    profileId: "PROFILE-123456",
    providerHomeIdentityHash: hash,
    providerHomeProtectionHash: hash,
    localUserBindingHash: hash,
    stableLogicalHomeBindingHash: hash,
    authContainerName: `crdd-auth-${"a".repeat(16)}`,
    providerContainerName: `crdd-codex-${"a".repeat(16)}`,
    proxyContainerName: `crdd-proxy-${"a".repeat(16)}`,
    internalNetworkName: `crdd-internal-${"a".repeat(16)}`,
    egressNetworkName: `crdd-egress-${"a".repeat(16)}`,
    ownershipLabel: `crdd.coordinator.runtime=${"a".repeat(16)}`,
    providerImageDigest: `sha256:${hash}`,
    proxyImageDigest: `sha256:${hash}`,
    operationMode: "workbench_advice" as const,
    workspaceMountMode: null,
  });
  let operations: Array<Record<string, unknown>> = [];
  let hostState = "host_only";
  let restoreCalls = 0;
  let releaseCalls = 0;
  let capabilityCalls = 0;
  let consumeCalls = 0;
  let lifecycleFails = true;
  let pendingFails = true;
  let driverFails = true;
  let startSaveFails = false;
  let contextFails = false;
  let hostBeginFails = false;
  let isReleaseSucceeds = true;
  let startCalls = 0;
  let fixedInputs: unknown[] | null = null;
  let fixedCandidate: unknown = null;
  const providerNotice = Object.freeze({});
  let savedLifecycle: unknown = null;
  let lifecycleConfirmed = true;
  let lifecycleLockReleased = true;
  let isProjectDelivery = false;
  let resultReadLockReleased = true;
  let acceptanceConfirmed = true;
  let acceptanceLockReleased = true;
  let upperAcceptancePresent = false;
  let deliveryCompletionFails = false;
  let acceptanceCalls = 0;
  let deliveryCompletionCalls = 0;
  let acceptanceReaderCalls = 0;
  let boundReader: unknown = null;
  const projectResult = Object.freeze({
    repositoryBinding: hash,
    operationId: "upper-operation",
    recoveryId: "exact-id",
    resultId: "b".repeat(64),
    consumer: "orchestrator",
  });
  /**
   * 上位受領の有無を切り替え、Reader呼出し数を観測する。
   *
   * @responsibility 受領済みのfixtureだけを返し、未受領時はnullを返す。
   * @trace ERB-IT-003
   * @precondition upperAcceptancePresentと固定projectResultを用意する。
   * @stimulus 同じ終了OwnerへReaderを渡し受領有無を切り替える。
   * @observation acceptanceReaderCallsとprojectResultまたはnullを取得する。
   * @oracle 未受領を受領済みと扱わず元結果だけで終了処理が進む。
   * @cleanup finallyでModule差替えを復元する。外部資源は生成しない。
   * @boundary 本番終了Ownerと模擬上位受領ReaderのProcess内境界。
   */
  const projectReader = () => {
    acceptanceReaderCalls++;
    return upperAcceptancePresent ? projectResult : null;
  };
  const mocks = [
    mock.module(
      new URL(
        "../../src/docker-execution/process-controller.ts",
        import.meta.url,
      ).href,
      {
        namedExports: {
          ...controller,
          verifyRuntimeOwnedDockerProviderSubmissionNotice: (
            notice: unknown,
            _capability: unknown,
            owner: unknown,
            operationId: unknown,
            recoveryId: unknown,
          ) =>
            notice === providerNotice &&
            owner === management &&
            operationId === plan.operationId &&
            recoveryId === "exact-id",
        },
      },
    ),
    mock.module(
      new URL("../../src/state-storage/model.ts", import.meta.url).href,
      {
        namedExports: {
          ...stateModel,
          prepareCoordinatorStateOperationSnapshot: (
            _before: unknown,
            identityJson: string,
          ) =>
            Buffer.from(
              JSON.stringify({
                operations: [{ recoveryId: "exact-id", identityJson }],
              }),
            ),
          decodeCoordinatorStateSnapshot: (bytes: Buffer) => ({
            snapshot: JSON.parse(bytes.toString("utf8")),
          }),
          prepareCoordinatorStateHostSnapshot: () =>
            Buffer.from("pending-candidate"),
        },
      },
    ),
    mock.module(
      new URL(
        "../../src/task/development-measurement-session.ts",
        import.meta.url,
      ).href,
      {
        namedExports: {
          ...development,
          inspectRuntimeOwnedDevelopmentOperationContext: () => null,
        },
      },
    ),
    mock.module(
      new URL("../../src/provider/home-windows-adapter.ts", import.meta.url)
        .href,
      {
        namedExports: {
          ...homes,
          inspectRuntimeOwnedWindowsProviderHomeCandidate: () => ({
            status: "candidate",
            observationCapability: {},
          }),
          consumeRuntimeOwnedProviderHomeObservationCapability: () => plan,
        },
      },
    ),
    mock.module(
      new URL("../../src/host-execution/kernel-lock.ts", import.meta.url).href,
      {
        namedExports: {
          ...locks,
          acquireRuntimeOwnedLogicalProviderHomeKernelLock: () => ({
            release: () => {
              releaseCalls++;
              return isReleaseSucceeds;
            },
          }),
        },
      },
    ),
    mock.module(
      new URL("../../src/repository-operation/binding.ts", import.meta.url)
        .href,
      {
        namedExports: {
          ...repository,
          borrowRuntimeOwnedCoordinatorStateRepository: () => ({
            operationId: plan.operationId,
            repositoryBinding: hash,
            revalidate: () => true,
          }),
        },
      },
    ),
    mock.module(
      new URL(
        "../../src/host-execution/operation-workspace-lifecycle.ts",
        import.meta.url,
      ).href,
      {
        namedExports: {
          ...hostRuntime,
          verifyOwnedOperationManagementCapability: () => ({
            operationId: plan.operationId,
          }),
          borrowOwnedHostRecoverySnapshot: () => ({
            snapshot: { token: "host-token", record: { state: hostState } },
            hostPaths: {},
          }),
          issueOwnedHostCleanupCapability: () => {
            capabilityCalls++;
            return {};
          },
          consumeOwnedHostRecoveryIdForCleanup: () => {
            consumeCalls++;
            return "host-token";
          },
        },
      },
    ),
    mock.module(
      new URL("../../src/state-storage/settlement-store.ts", import.meta.url)
        .href,
      {
        namedExports: {
          ...stateRuntime,
          readRuntimeOwnedCoordinatorStateSnapshot: () => ({
            status: "completed",
            lockReleased: true,
            value: { snapshot: { operations } },
          }),
          saveRuntimeOwnedCoordinatorOperationStart: (
            _management: unknown,
            identityJson: string,
          ) => {
            operations = [
              {
                recoveryId: "exact-id",
                identityJson,
                phase: "executing",
                lease: "held",
                execution: {
                  providerStart: "not_started",
                  externalSend: "not_issued",
                  sharedWrite: "not_issued",
                  ownerEffect: "active",
                  workspaceReusable: false,
                },
                primaryFailure: null,
                outcome: null,
                summarySha256: null,
                host: {
                  currentToken: "host-token",
                  pendingTransitionJson: null,
                  cleanup: "not_requested",
                },
              },
            ];
            return {
              status: startSaveFails ? "blocked" : "completed",
              reason: startSaveFails ? "start_save_failed" : "saved",
              snapshotConfirmed: !startSaveFails,
              lockReleased: true,
              recoveryId: "exact-id",
            };
          },
          prepareRuntimeOwnedCoordinatorSettlement: () =>
            contextFails ? null : context,
          readRuntimeOwnedCoordinatorSettlementResult: (
            receivedContext: unknown,
            consumer: unknown,
          ) => {
            assert.equal(receivedContext, context);
            assert.equal(consumer, "orchestrator");
            return {
              status: "completed",
              lockReleased: resultReadLockReleased,
              value: projectResult,
            };
          },
          bindRuntimeOwnedCoordinatorProjectAcceptanceReader: (
            receivedContext: unknown,
            recoveryId: unknown,
            reader: unknown,
          ) => {
            assert.equal(receivedContext, context);
            assert.equal(recoveryId, "exact-id");
            if (
              reader !== projectReader ||
              (boundReader && boundReader !== reader)
            )
              return false;
            boundReader = reader;
            return true;
          },
          acceptRuntimeOwnedCoordinatorProjectResult: (
            receivedContext: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            assert.equal(receivedContext, context);
            assert.equal(host, cleanup);
            assert.equal(docker, completion);
            acceptanceCalls++;
            return {
              status: projectReader() ? "completed" : "blocked",
              snapshotConfirmed: acceptanceConfirmed,
              lockReleased: acceptanceLockReleased,
              filesystemEffectIssued: true,
            };
          },
          completeRuntimeOwnedCoordinatorSettlement: (
            receivedContext: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            assert.equal(receivedContext, context);
            assert.equal(host, cleanup);
            assert.equal(docker, completion);
            deliveryCompletionCalls++;
            const confirmed =
              !deliveryCompletionFails && projectReader() !== null;
            return {
              status: confirmed ? "completed" : "blocked",
              snapshotConfirmed: confirmed,
              lockReleased: true,
              filesystemEffectIssued: true,
            };
          },
          beginRuntimeOwnedCoordinatorHostSubmission: () => {
            startCalls++;
            if (hostBeginFails)
              return {
                status: "blocked",
                reason: "host_begin_save_failed",
                hostTransitionConfirmed: false,
              };
            hostState = "docker_submission_started";
            return { status: "completed", hostTransitionConfirmed: true };
          },
          completeRuntimeOwnedCoordinatorHostSubmission: () => {
            restoreCalls++;
            hostState = "host_only";
            return { status: "completed", hostTransitionConfirmed: true };
          },
          checkpointRuntimeOwnedCoordinatorLifecycle: (
            _owner: unknown,
            _recoveryId: unknown,
            value: unknown,
          ) => {
            savedLifecycle = value;
            return lifecycleFails
              ? {
                  status: "blocked",
                  snapshotConfirmed: false,
                  lockReleased: true,
                }
              : {
                  status: "completed",
                  snapshotConfirmed: lifecycleConfirmed,
                  lockReleased: lifecycleLockReleased,
                };
          },
          writeRuntimeOwnedCoordinatorStateSnapshot: (
            _management: unknown,
            candidate: unknown,
          ) => {
            if (fixedCandidate) assert.equal(candidate, fixedCandidate);
            fixedCandidate = candidate;
            if (pendingFails)
              return {
                status: "blocked",
                snapshotConfirmed: false,
                lockReleased: true,
              };
            assert.ok(operations[0]);
            operations[0].host = {
              currentToken: "host-token",
              pendingTransitionJson: null,
              cleanup: "pending",
            };
            operations[0].lease = "released";
            return {
              status: "completed",
              snapshotConfirmed: true,
              lockReleased: true,
            };
          },
          captureRuntimeOwnedCoordinatorSettlementInputs: (
            _context: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            if (fixedInputs)
              return fixedInputs[0] === host && fixedInputs[1] === docker;
            if (host !== cleanup || docker !== completion) return false;
            fixedInputs = [host, docker];
            return true;
          },
          settleRuntimeOwnedCoordinatorResult: (
            _context: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            assert.equal(host, cleanup);
            assert.equal(docker, completion);
            return {
              status: driverFails ? "blocked" : "completed",
              filesystemEffectIssued: true,
              deliveryPending: isProjectDelivery,
            };
          },
        },
      },
    ),
  ];
  try {
    const runtimeUrl = new URL(
      "../../src/docker-execution/recovery-lifecycle.ts",
      import.meta.url,
    );
    runtimeUrl.search = "?owner-reentry";
    const runtime = (await import(
      runtimeUrl.href
    )) as typeof import("../../src/docker-execution/recovery-lifecycle.ts");
    const begun = runtime.beginRuntimeOwnedDockerRecovery(plan, management);
    assert.ok(begun && "recoveryCapability" in begun);
    const capability = begun.recoveryCapability;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission({}, providerNotice),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability, {}),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    lifecycleFails = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      true,
    );
    assert.deepEqual(savedLifecycle, {
      phase: "executing",
      lease: "held",
      execution: {
        providerStart: "unknown",
        externalSend: "unknown",
        sharedWrite: "unknown",
        ownerEffect: "active",
        workspaceReusable: false,
      },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
    });
    lifecycleConfirmed = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    lifecycleConfirmed = true;
    lifecycleLockReleased = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    lifecycleLockReleased = true;
    assert.ok(operations[0]);
    operations[0].execution = {
      providerStart: "started",
      externalSend: "issued",
      sharedWrite: "possible",
      ownerEffect: "active",
      workspaceReusable: false,
    };
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      true,
    );
    assert.deepEqual(
      (savedLifecycle as { execution: unknown }).execution,
      operations[0].execution,
    );
    operations[0].summarySha256 = hash;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    operations[0].summarySha256 = null;
    operations[0].phase = "settled";
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    operations[0].phase = "executing";
    lifecycleFails = true;
    assert.equal(
      runtime.recordRuntimeOwnedNormalMountCompletion(capability, mount),
      true,
    );
    const raw = { plan, cleanupOutcome: cleanup, mountCompletion: mount };
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(restoreCalls, 1);
    lifecycleFails = false;
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, {
        ...raw,
        cleanupOutcome: {},
      }).status,
      "blocked",
    );
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "completed",
    );
    assert.equal(restoreCalls, 1);
    assert.equal(releaseCalls, 1);
    assert.equal(capabilityCalls, 1);
    assert.ok(operations[0]);
    operations[0].lease = "released";
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(capability),
      null,
    );
    assert.equal(consumeCalls, 1);
    pendingFails = false;
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(capability),
      "host-token",
    );
    assert.equal(consumeCalls, 1);
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(capabilityCalls, 1);
    assert.equal(
      runtime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
        hostCleanupOutcome: cleanup,
        dockerCompletion: completion,
      }),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
        hostCleanupOutcome: {},
        dockerCompletion: completion,
      }),
      false,
    );
    const stopped = runtime.finalizeRuntimeOwnedDockerRecovery(capability);
    assert.equal(stopped.status, "blocked");
    assert.ok("filesystemEffectIssued" in stopped);
    assert.equal(stopped.filesystemEffectIssued, true);
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(capability).status,
      "blocked",
    );
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        capability,
        projectReader,
      ).status,
      "blocked",
    );
    driverFails = false;
    assert.equal(
      runtime.finalizeRuntimeOwnedDockerRecovery(capability).status,
      "completed",
    );
    operations = [];
    hostState = "host_only";
    fixedInputs = null;
    fixedCandidate = null;
    isProjectDelivery = true;
    const projectPlan = { ...plan, consumer: "orchestrator" as const };
    const projectBegun = runtime.beginRuntimeOwnedDockerRecovery(
      projectPlan,
      management,
    );
    assert.ok(projectBegun && "recoveryCapability" in projectBegun);
    const projectCapability = projectBegun.recoveryCapability;
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(projectCapability).status,
      "blocked",
    );
    assert.equal(
      runtime.recordRuntimeOwnedNormalMountCompletion(projectCapability, mount),
      true,
    );
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(
        projectCapability,
        management,
        {
          plan: projectPlan,
          cleanupOutcome: cleanup,
          mountCompletion: mount,
        },
      ).status,
      "completed",
    );
    assert.ok(operations[0]);
    operations[0].lease = "released";
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(projectCapability),
      "host-token",
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerHostCleanupReceipt(projectCapability, {
        hostCleanupOutcome: cleanup,
        dockerCompletion: completion,
      }),
      true,
    );
    for (const fake of [{}, { ...projectCapability }, "exact-id"])
      assert.equal(
        runtime.readRuntimeOwnedDockerProjectResult(fake).status,
        "blocked",
      );
    resultReadLockReleased = false;
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(projectCapability).value,
      null,
    );
    resultReadLockReleased = true;
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(projectCapability).value,
      projectResult,
    );
    for (const reader of [null, {}, () => projectResult])
      assert.equal(
        runtime.completeRuntimeOwnedDockerProjectResultDelivery(
          projectCapability,
          reader,
        ).status,
        "blocked",
      );
    assert.equal(acceptanceCalls, 0);
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        projectCapability,
        projectReader,
      ).status,
      "blocked",
    );
    assert.equal(deliveryCompletionCalls, 0);
    upperAcceptancePresent = true;
    for (const missing of ["confirmation", "lock"]) {
      acceptanceConfirmed = missing !== "confirmation";
      acceptanceLockReleased = missing !== "lock";
      const unconfirmed =
        runtime.completeRuntimeOwnedDockerProjectResultDelivery(
          projectCapability,
          projectReader,
        );
      assert.equal(unconfirmed.status, "blocked");
      assert.equal(unconfirmed.filesystemEffectIssued, true);
      assert.equal(deliveryCompletionCalls, 0);
    }
    acceptanceConfirmed = true;
    acceptanceLockReleased = true;
    deliveryCompletionFails = true;
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        projectCapability,
        projectReader,
      ).status,
      "blocked",
    );
    const acceptedCalls = acceptanceCalls;
    deliveryCompletionFails = false;
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        projectCapability,
        projectReader,
      ).status,
      "completed",
    );
    assert.equal(acceptanceCalls, acceptedCalls);
    const completedCalls = deliveryCompletionCalls;
    const readsBeforeReplay = acceptanceReaderCalls;
    upperAcceptancePresent = false;
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        projectCapability,
        projectReader,
      ).status,
      "blocked",
    );
    assert.equal(deliveryCompletionCalls, completedCalls + 1);
    assert.equal(acceptanceReaderCalls, readsBeforeReplay + 1);
    assert.equal(acceptanceCalls, acceptedCalls);
    upperAcceptancePresent = true;
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        projectCapability,
        projectReader,
      ).status,
      "completed",
    );
    assert.equal(
      runtime.completeRuntimeOwnedDockerProjectResultDelivery(
        projectCapability,
        () => projectResult,
      ).status,
      "blocked",
    );
    isProjectDelivery = false;
    for (const failure of ["save", "context", "host"]) {
      operations = [];
      hostState = "host_only";
      startSaveFails = failure === "save";
      contextFails = failure === "context";
      hostBeginFails = failure === "host";
      isReleaseSucceeds = false;
      const startsBefore = startCalls;
      const failed = runtime.beginRuntimeOwnedDockerRecovery(plan, management);
      assert.ok(failed && "recoveryCapability" in failed);
      assert.equal(failed.status, "blocked");
      assert.equal(failed.recoveryId, "exact-id");
      const expectedStarts = startsBefore + (failure === "host" ? 1 : 0);
      assert.equal(startCalls, expectedStarts);
      if (failure === "host")
        assert.equal(failed.reason, "host_begin_save_failed");
      const failedCapability = failed.recoveryCapability;
      const stoppedResult = Object.freeze({ status: "blocked" });
      const failureReason = failed.reason;
      assert.equal(
        runtime.bindRuntimeOwnedDockerInitializationFailure(
          failedCapability,
          "exact-id",
          management,
          hash,
          failureReason,
          stoppedResult,
        ),
        true,
      );
      for (const [owner, reference, coordinatorManager, home, reason] of [
        [{}, "exact-id", management, hash, failureReason],
        [failedCapability, "other-id", management, hash, failureReason],
        [failedCapability, "exact-id", {}, hash, failureReason],
        [
          failedCapability,
          "exact-id",
          management,
          "b".repeat(64),
          failureReason,
        ],
        [failedCapability, "exact-id", management, hash, "other_failure"],
        [stoppedResult, "exact-id", management, hash, failureReason],
      ]) {
        assert.equal(
          runtime.bindRuntimeOwnedDockerInitializationFailure(
            owner,
            reference,
            coordinatorManager,
            home,
            reason,
            null,
          ),
          false,
        );
      }
      assert.equal(
        runtime.abandonRuntimeOwnedDockerRecovery(stoppedResult),
        false,
      );
      assert.equal(
        runtime.markRuntimeOwnedDockerResourceSubmission(
          stoppedResult,
          "create_provider",
        ),
        false,
      );
      assert.equal(
        runtime.verifyRuntimeOwnedDockerRecoveryBinding(
          failedCapability,
          "exact-id",
          management,
          hash,
        ),
        false,
      );
      assert.equal(
        runtime.markRuntimeOwnedDockerResourceSubmission(
          failedCapability,
          "create_provider",
        ),
        false,
      );
      assert.equal(
        runtime.completeRuntimeOwnedDockerRecovery(
          failedCapability,
          management,
          raw,
        ).status,
        "blocked",
      );
      assert.equal(
        runtime.abandonRuntimeOwnedDockerRecovery(failedCapability),
        false,
      );
      isReleaseSucceeds = true;
      assert.equal(
        runtime.abandonRuntimeOwnedDockerRecovery(failedCapability),
        true,
      );
      assert.equal(startCalls, expectedStarts);
    }
  } finally {
    for (const fixture of mocks.reverse()) fixture.restore();
  }
});
