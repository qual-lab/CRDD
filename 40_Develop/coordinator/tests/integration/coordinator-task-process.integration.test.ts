import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderSafeHumanCommandReport } from "../../src/core/command-report.ts";
import { bindTaskCliCancellationSignals } from "../../src/core/task-cli-cancellation.ts";
import { createIsolatedCoordinatorTaskRuntimeCandidate } from "../../src/security/coordinator-task-runtime.ts";
import {
  cleanupOwnedOperationDirectoriesAsync,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  verifyOwnedOperationCleanupOutcome,
  verifyOwnedOperationManagementCapability,
} from "../../src/security/execution-environment.ts";
import { createTaskControllerCancellationFixture } from "../fixtures/task-controller-cancellation-fixture.ts";

// This is an isolated Task orchestration test, not a signed CLI, Docker,
// Provider, credential, consent or production Authority test. The real child
// owns file I/O and close; the injected adapters own only fixture contracts.
const CHILD_SOURCE = `
const fs = require('node:fs');
const [role, file, outcome] = process.argv.slice(1);
process.stdout.write('ready\\n');
process.stdin.once('data', () => {
  if (outcome === 'nonzero') process.exit(7);
  if (role === 'executor') fs.writeFileSync(file, 'TASK_PROCESS_OK\\n');
  else if (fs.readFileSync(file, 'utf8') !== 'TASK_PROCESS_OK\\n') process.exit(8);
  const result = role === 'executor'
    ? {status:'completed', changedPaths:['fixture.txt'], verificationCount:1}
    : {decision:'approved', findingCount:0};
  process.stdout.write(JSON.stringify(result) + '\\n');
  process.stdin.destroy();
});
`;

type Scenario =
  | "normal"
  | "nonzero"
  | "cancel"
  | "close_unknown"
  | "cleanup_refused";
type Dependencies = Parameters<
  typeof createIsolatedCoordinatorTaskRuntimeCandidate
>[0];

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function createProcessHarness(
  scenario: Scenario,
  controllerCleanupConfirmed?: boolean,
) {
  const owned = createOwnedOperationDirectories();
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const operationId =
    verifyOwnedOperationManagementCapability(managementCapability).operationId;
  const hostRecoveryId = getOwnedHostRecoveryId(owned);
  const file = path.join(owned.directories.workspace, "fixture.txt");
  const marker = path.join(
    owned.directories.management,
    "active-docker-task-v1.json",
  );
  const states: string[] = [];
  const childProcesses: ChildProcess[] = [];
  const closedPids = new Set<number>();
  const controls = new Set<object>();
  const controlsByUse = new WeakMap<object, object>();
  const assignments = new WeakMap<object, "executor" | "reviewer">();
  const processControls = new WeakMap<
    object,
    { child: ChildProcess; closed: Promise<void> }
  >();
  const firstReady = createDeferred<void>();
  let activeRole: "executor" | "reviewer" = "executor";
  let cleanupCount = 0;
  let isPoisoned = false;
  const capability = () => Object.freeze({});
  const controllerFixture =
    controllerCleanupConfirmed === undefined
      ? null
      : createTaskControllerCancellationFixture(
          operationId,
          managementCapability,
          hostRecoveryId,
          controllerCleanupConfirmed,
        );
  let candidateEffectCount = 0;
  const issue = () => {
    const controlCapability = capability();
    controls.add(controlCapability);
    const useCapability = capability();
    controlsByUse.set(useCapability, controlCapability);
    return { status: "issued", controlCapability, useCapability };
  };
  const revoke = (control: object) => {
    assert.equal(controls.delete(control), true);
    return { status: "revoked" };
  };
  const consume = (use: object) => {
    const control = controlsByUse.get(use);
    assert.ok(control);
    revoke(control);
    controlsByUse.delete(use);
  };
  const dependencies: Dependencies = {
    observeLifecycleState: (state) => states.push(state),
    inspectRepository: () => ({
      status: "candidate",
      objectFormat: "sha1",
      runtimeSupported: true,
    }),
    createOperation: () => ({
      owned,
      mountCapability,
      managementCapability,
      operationId,
      hostRecoveryId,
    }),
    classifyOperationCreationFailure: () => null,
    cleanupOperation: async (target) => {
      assert.equal(target, owned);
      if (controllerFixture?.processStarted()) {
        controllerFixture.processes.assertAbsent();
        controllerFixture.events.push("host-cleanup");
      }
      assert.equal(
        childProcesses.length,
        closedPids.size,
        "Host cleanup must follow actual child close",
      );
      cleanupCount += 1;
      return cleanupOwnedOperationDirectoriesAsync(target);
    },
    classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
    abandonOperation: async () => "released",
    isProcessPoisoned: () => isPoisoned,
    poisonProcessAfterCleanupUnknown: () => {
      isPoisoned = true;
    },
    bindRepository: () => ({
      repositoryBound: true,
      repositoryBindingCapability: capability(),
    }),
    materializeWorkspace: () => {
      fs.writeFileSync(file, "BEFORE\n");
      return { status: "materialized", workspaceCapability: capability() };
    },
    preflightSlate: () => ({
      status: "candidate",
      executorProvider: "claude",
      reviewerProvider: "codex",
      reviewerIndependence: "provider_independent",
      providerEffectAllowed: false,
    }),
    issueSelection: (_management, request) => ({
      ...issue(),
      executorProvider: request.role === "executor" ? "claude" : "codex",
      profileId:
        request.role === "executor" ? "PROFILE-200001" : "PROFILE-100003",
      selectionNotice: "isolated-process-test",
    }),
    revokeSelection: revoke,
    observeProviderHome: () => ({
      status: "candidate",
      observationCapability: capability(),
    }),
    issueMountGrant: issue,
    consumeMountGrant: (use) => {
      consume(use);
      return { status: "consumed", mountAuthorizationCapability: capability() };
    },
    revokeMountGrant: revoke,
    authorizeExternalSend: () => ({
      status: "issued",
      capability: capability(),
      authorizationMode: "reused_initial_consent",
    }),
    resolveExternalSendPolicy: () => ({
      status: "resolved",
      capability: capability(),
      candidatePersistenceAllowed: true,
      candidateRetentionHours: 24,
      informationClassification: "public",
      candidatePhysicalDeletion:
        "next_safe_runtime_entry_after_expiry_or_explicit_discard",
    }),
    prepareCandidateStore: () => ({ status: "completed" }),
    prepareDockerRecoveryState: () => ({
      status: "completed",
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
      dockerRecoveryId: null,
      dockerRecoveryIds: [],
      activeStableLogicalHomeBindingHashes: [],
    }),
    reportSelectionNotice: () => true,
    reportExternalSendNotice: () => true,
    issueTaskPacket: (_management, _binding, _provider, role) => {
      const issued = issue();
      assignments.set(issued.useCapability, role);
      return issued;
    },
    revokeTaskPacket: revoke,
    prepareProvider: (
      _provider,
      _management,
      _mount,
      _authorization,
      selection,
      packet,
    ) => {
      const role = assignments.get(packet);
      assert.ok(role);
      consume(selection);
      consume(packet);
      activeRole = role;
      return {
        status: "prepared",
        preparedCapability:
          controllerFixture?.preparedCapability ?? capability(),
        selectionNotice: "isolated-process-test",
      };
    },
    startProcess: (
      prepared,
      management,
      registerRecoveryHandoff,
      restriction,
    ) => {
      if (controllerFixture)
        return controllerFixture.startProcess(
          prepared,
          management,
          registerRecoveryHandoff,
          restriction,
        );
      const role = activeRole;
      const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${(role === "executor" ? "c" : "d").repeat(64)}`;
      assert.equal(registerRecoveryHandoff(capability(), recoveryId), true);
      if (scenario === "close_unknown") fs.writeFileSync(marker, "fixture");
      const child = spawn(
        process.execPath,
        ["-e", CHILD_SOURCE, role, file, scenario],
        {
          cwd: owned.directories.workspace,
          env: { PATH: "", SystemRoot: process.env.SystemRoot ?? "" },
          shell: false,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      childProcesses.push(child);
      const closed = createDeferred<void>();
      const completion = createDeferred<Record<string, unknown>>();
      let stdout = "";
      let stderr = "";
      let isReady = false;
      child.on("error", completion.reject);
      child.stderr.on("data", (bytes: Buffer) => {
        stderr += bytes.toString("utf8");
      });
      child.stdout.on("data", (bytes: Buffer) => {
        stdout += bytes.toString("utf8");
        if (!isReady && stdout.startsWith("ready\n")) {
          isReady = true;
          firstReady.resolve();
          if (scenario !== "cancel" && scenario !== "close_unknown")
            child.stdin.end("continue\n");
        }
      });
      child.once("close", (code) => {
        if (child.pid) closedPids.add(child.pid);
        closed.resolve();
        try {
          assert.equal(stderr, "");
          if (scenario === "cleanup_refused" && role === "reviewer")
            fs.writeFileSync(marker, "fixture");
          completion.resolve({
            status: code === 0 ? "completed" : "blocked",
            reason: code === 0 ? "completed" : "provider_process_exit_nonzero",
            cleanupConfirmed: scenario !== "close_unknown",
            manualRecoveryRequired: scenario === "close_unknown",
            recoveryId: scenario === "close_unknown" ? recoveryId : null,
            normalizedResult:
              code === 0 ? JSON.parse(stdout.slice("ready\n".length)) : null,
          });
        } catch (error) {
          completion.reject(error);
        }
      });
      const controlCapability = capability();
      processControls.set(controlCapability, { child, closed: closed.promise });
      return {
        status: "started",
        reason: "started",
        controlCapability,
        recoveryId,
        completion: completion.promise,
      };
    },
    cancelProcess: async (control, management) => {
      if (controllerFixture)
        return controllerFixture.cancelProcess(control, management);
      const processControl = processControls.get(control);
      assert.ok(processControl);
      processControl.child.kill();
      await processControl.closed;
      return {
        status: "requested",
        reason:
          scenario === "close_unknown"
            ? "provider_cancellation_grace_exceeded"
            : "provider_cancellation_requested",
        cancellationRequested: true,
        processTerminationObserved: scenario !== "close_unknown",
      };
    },
    captureCandidate: () => {
      candidateEffectCount += 1;
      assert.equal(fs.readFileSync(file, "utf8"), "TASK_PROCESS_OK\n");
      return {
        status: "candidate",
        candidateCapability: capability(),
        changedPaths: ["fixture.txt"],
      };
    },
    verifyCandidate: () => {
      assert.equal(fs.readFileSync(file, "utf8"), "TASK_PROCESS_OK\n");
      return {
        status: "verified",
        baseCommit: "1".repeat(40),
        baseTree: "2".repeat(40),
        patchHash: "3".repeat(64),
        contentManifestHash: "4".repeat(64),
        allowedPathsHash: "5".repeat(64),
        changedPaths: ["fixture.txt"],
      };
    },
    persistCandidate: () => {
      candidateEffectCount += 1;
      return {
        status: "staged",
        candidateRecoveryId: `candidate-recovery.${"6".repeat(64)}.${"7".repeat(64)}`,
      };
    },
    discardCandidate: () => ({ status: "discarded" }),
    publishCandidate: () => {
      candidateEffectCount += 1;
      return {
        status: "published",
        candidateId: `candidate.${"6".repeat(64)}.${"7".repeat(64)}`,
        expiresAtMs: 1_800_000_000_000,
      };
    },
    ...(controllerFixture
      ? {
          prepareDockerHostCleanup: controllerFixture.prepareDockerHostCleanup,
          recordDockerHostCleanupReceipt:
            controllerFixture.recordDockerHostCleanupReceipt,
          finalizeDockerRecovery: controllerFixture.finalizeDockerRecovery,
        }
      : {}),
  };
  return {
    runtime: createIsolatedCoordinatorTaskRuntimeCandidate(dependencies),
    owned,
    marker,
    hostRecoveryId,
    states,
    childProcesses,
    closedPids,
    controls,
    controllerFixture,
    candidateEffectCount: () => candidateEffectCount,
    firstReady: firstReady.promise,
    cleanupCount: () => cleanupCount,
    async dispose() {
      if (controllerFixture) await controllerFixture.processes.dispose();
      for (const child of childProcesses)
        if (child.exitCode === null && child.signalCode === null) {
          const closed = new Promise<void>((resolve) =>
            child.once("close", () => resolve()),
          );
          child.kill();
          await closed;
        }
      if (fs.existsSync(marker)) fs.unlinkSync(marker);
      if (fs.existsSync(owned.root))
        await cleanupOwnedOperationDirectoriesAsync(owned);
      assert.equal(fs.existsSync(owned.root), false);
    },
  };
}

// No OS Ctrl+C delivery or real Docker resource claims: the registered CLI
// callback traverses Task + Controller + the production-owned Node process tree.
for (const cleanupConfirmed of [true, false]) {
  test(`Windows Process Gate: Task→Controller→共有Processの取消結合: Docker回収模擬=${cleanupConfirmed}`, {
    skip: process.platform !== "win32",
    timeout: 20_000,
  }, async (t) => {
    const harness = createProcessHarness("cancel", cleanupConfirmed);
    t.after(() => harness.dispose());
    const controller = harness.controllerFixture;
    assert.ok(controller);
    assert.equal(controller.productionAuthority, false);
    const initialListenerCounts = [
      process.listenerCount("SIGINT"),
      process.listenerCount("SIGTERM"),
    ];
    const started = harness.runtime.start(
      {
        frontProvider: "codex",
        requestedExecutorProvider: "auto",
        objective: "Update the bounded fixture.",
        acceptanceCriteria: ["The fixture contains the expected value."],
        allowedPaths: ["fixture.txt"],
        readPaths: ["fixture.txt"],
        workClass: "bounded_implementation",
        planState: "complete",
        risk: "low",
        difficulty: "low",
        decisionImpact: "limited",
        isLocalCandidateOnly: true,
        hasUnresolvedDirection: false,
        requiresCrossContextAlignment: false,
      },
      harness.owned.directories.workspace,
      new Date().toISOString(),
    );
    const binding = bindTaskCliCancellationSignals(() =>
      harness.runtime.cancel(started.controlCapability),
    );
    t.after(() => binding.unbind());
    assert.equal(binding.status, "bound");
    await Promise.race([
      controller.processes.ready(),
      started.completion.then((result) => {
        throw new Error(
          `Task completed before cancellation: ${JSON.stringify(result)}`,
        );
      }),
    ]);
    binding.listener();
    binding.listener();
    const receipt = await binding.cancellation.observedPromise();
    assert.deepEqual(receipt, {
      status: "requested",
      reason: "provider_cancellation_requested",
      cancellationRequested: true,
      processTerminationObserved: true,
    });
    const result = await started.completion;
    controller.processes.assertAbsent();
    assert.equal(binding.cancellation.observerCount(), 1);
    assert.equal(controller.terminationCount(), 1);
    assert.deepEqual(controller.projectionCounts(), [1, 1]);
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, cleanupConfirmed);
    assert.equal(result.manualRecoveryRequired, !cleanupConfirmed);
    assert.equal(harness.candidateEffectCount(), 0);
    assert.equal(harness.controls.size, 0);
    assert.equal(harness.cleanupCount(), cleanupConfirmed ? 1 : 0);
    assert.equal(fs.existsSync(harness.owned.root), !cleanupConfirmed);
    assert.equal(result.candidateId ?? null, null);
    if (cleanupConfirmed) {
      assert.deepEqual(controller.events, [
        "process-start",
        "process-absence-observed",
        "docker-cleanup",
        "docker-absence",
        "mount-complete",
        "mount-receipt",
        "recovery-finalizable",
        "host-intent",
        "host-cleanup",
        "host-receipt",
        "docker-finalize",
      ]);
      assert.equal(result.hostRecoveryId, null);
      assert.deepEqual(result.dockerRecoveryIds, []);
    } else {
      assert.deepEqual(controller.events, [
        "process-start",
        "process-absence-observed",
        "docker-cleanup",
      ]);
      assert.equal(result.hostRecoveryId, harness.hostRecoveryId);
      assert.deepEqual(result.dockerRecoveryIds, [controller.recoveryId]);
    }
    await controller.assertControllerExpired();
    assert.deepEqual(await harness.runtime.cancel(started.controlCapability), {
      status: "blocked",
      reason: "coordinator_task_control_invalid",
    });
    assert.equal(binding.unbind().status, "released");
    assert.deepEqual(
      [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")],
      initialListenerCounts,
    );
  });
}

for (const scenario of [
  "normal",
  "nonzero",
  "cancel",
  "close_unknown",
  "cleanup_refused",
] as const) {
  test(`Taskと実子Process・Host領域の結合: ${scenario}`, {
    timeout: 20_000,
  }, async (t) => {
    const harness = createProcessHarness(scenario);
    t.after(() => harness.dispose());
    const signalCounts = [
      process.listenerCount("SIGINT"),
      process.listenerCount("SIGTERM"),
    ];
    const started = harness.runtime.start(
      {
        frontProvider: "codex",
        requestedExecutorProvider: "auto",
        objective: "Update the bounded fixture.",
        acceptanceCriteria: ["The fixture contains the expected value."],
        allowedPaths: ["fixture.txt"],
        readPaths: ["fixture.txt"],
        workClass: "bounded_implementation",
        planState: "complete",
        risk: "low",
        difficulty: "low",
        decisionImpact: "limited",
        isLocalCandidateOnly: true,
        hasUnresolvedDirection: false,
        requiresCrossContextAlignment: false,
      },
      harness.owned.directories.workspace,
      new Date().toISOString(),
    );
    const binding = bindTaskCliCancellationSignals(() =>
      harness.runtime.cancel(started.controlCapability),
    );
    t.after(() => binding.unbind());
    assert.equal(binding.status, "bound");
    assert.equal(harness.runtime.productionAuthority, false);
    if (scenario === "cancel" || scenario === "close_unknown") {
      await Promise.race([
        harness.firstReady,
        started.completion.then((result) => {
          throw new Error(
            `Task ended before child readiness: ${JSON.stringify(result)}`,
          );
        }),
      ]);
      // Invoke the same bound handler; do not send an OS signal to the test runner.
      binding.listener();
      binding.listener();
      await binding.cancellation.observedPromise();
      assert.equal(binding.cancellation.observerCount(), 1);
    }
    const result = await started.completion;
    assert.equal(binding.unbind().status, "released");
    assert.deepEqual(
      [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")],
      signalCounts,
    );
    assert.equal(harness.childProcesses.length, harness.closedPids.size);
    assert.equal(harness.controls.size, 0, JSON.stringify(result));
    assert.deepEqual(await harness.runtime.cancel(started.controlCapability), {
      status: "blocked",
      reason: "coordinator_task_control_invalid",
    });
    const isRecoveryRequired =
      scenario === "cleanup_refused" || scenario === "close_unknown";
    assert.equal(
      result.status,
      scenario === "normal" ? "completed" : "blocked",
      JSON.stringify(result),
    );
    assert.equal(
      result.manualRecoveryRequired,
      isRecoveryRequired,
      JSON.stringify(result),
    );
    assert.equal(result.cleanupConfirmed, !isRecoveryRequired);
    assert.equal(
      harness.states.at(-1),
      isRecoveryRequired
        ? "STATE-RECOVERY-REQUIRED"
        : scenario === "normal"
          ? "STATE-RESULT-PUBLISHED"
          : "STATE-BLOCKED-CLEAN",
    );
    assert.equal(harness.cleanupCount(), scenario === "close_unknown" ? 0 : 1);
    assert.equal(fs.existsSync(harness.owned.root), isRecoveryRequired);
    if (isRecoveryRequired)
      assert.equal(result.hostRecoveryId, harness.hostRecoveryId);
    if (scenario === "cleanup_refused")
      assert.equal(fs.existsSync(harness.marker), true);
    if (scenario === "close_unknown") {
      assert.equal(fs.existsSync(harness.marker), true);
      assert.deepEqual(result.dockerRecoveryIds, [
        `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
      ]);
    }
    if (scenario === "nonzero")
      assert.equal(result.reason, "provider_process_exit_nonzero");
    assert.equal(
      harness.childProcesses.length,
      scenario === "normal" || scenario === "cleanup_refused" ? 2 : 1,
    );
    const json = JSON.stringify({ command: "task", ...result });
    assert.equal(json.includes(harness.owned.root), false);
    assert.equal(json.includes("TASK_PROCESS_OK"), false);
    const human = renderSafeHumanCommandReport({ command: "task", ...result });
    assert.match(human, scenario === "normal" ? /処理完了/u : /停止/u);
    assert.match(
      human,
      isRecoveryRequired ? /資源回収: 未確認/u : /資源回収: 確認済み/u,
    );
    assert.match(
      human,
      isRecoveryRequired
        ? /手動回復の必要性: あり/u
        : /手動回復の必要性: なし/u,
    );
    assert.equal(human.includes(harness.owned.root), false);
    assert.equal(human.includes("TASK_PROCESS_OK"), false);
    if (isRecoveryRequired) {
      assert.ok(human.includes(harness.hostRecoveryId));
      assert.doesNotMatch(human, /coordinator candidate export/u);
    }
  });
}
