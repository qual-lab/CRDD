/**
 * coordinator:integration:coordinator-task-processの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:coordinator-task-processが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope coordinator、task、process
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container / ERB-IT-002=Adjacent 1 Block: Controller→stdio・signal・close→資源Observer / ERB-IT-003=Direct Boundary: Host清掃Owner→実Filesystem。
 */

import assert from "node:assert/strict";
import { createHostCompletionFixture } from "../fixtures/docker-owned-process-test-support.ts";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";
import {
  getRepository,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { bindTaskCliCancellationSignals } from "../../src/cli/command.ts";
import { cancelCoordinatorTask } from "../../src/lifecycle/execution.ts";
import {
  captureOwnedOperationCleanupVerification,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  verifyOwnedOperationCleanupOutcome,
  verifyOwnedOperationManagementCapability,
} from "../../src/lifecycle/host.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import { createTaskControllerCancellationFixture } from "../fixtures/task-controller-cancellation-fixture.ts";
import {
  loadTaskRuntimeFixture,
  type TaskFixtureDependencies,
} from "../support/task-requests.ts";

const createTaskRuntimeFixture = await loadTaskRuntimeFixture();

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
type Dependencies = TaskFixtureDependencies;

/**
 * 各Process試験のHost保存先を自己生成Repositoryへ閉じる。
 * @responsibility 現行Host受付へ検証済みRootと現在性を渡す。
 * @trace ERB-IT-003
 * @boundary Git配置は有限fixture。実Git実行・AI・Dockerなし。
 */
function hostFixture() {
  const directory = createRepositoryTestDirectory("task-process-");
  const root = directory.path;
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "refs", "heads", "main"),
    `${"1".repeat(40)}\n`,
  );
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
  const repository = getRepository(root);
  assert.equal(repository.status, "completed");
  return {
    directory,
    input: {
      root: repository.capability,
      purpose: "task" as const,
      recordingCurrent: () =>
        resolveVerifiedRepositoryRoot(repository.capability) === root,
    },
  };
}

/**
 * createDeferredのTest準備責務を実行する。
 *
 * @responsibility createDeferredがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createDeferredを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/**
 * createProcessHarnessのTest準備責務を実行する。
 *
 * @responsibility createProcessHarnessがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createProcessHarnessを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
function createProcessHarness(
  scenario: Scenario,
  controllerCleanupConfirmed?: boolean,
) {
  const host = hostFixture();
  const owned = createOwnedOperationDirectories(host.input);
  assert.ok(owned.directories);
  const directories = owned.directories;
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const operationId =
    verifyOwnedOperationManagementCapability(managementCapability).operationId;
  const hostRecoveryId = getOwnedHostRecoveryId(owned);
  const file = path.join(directories.workspace, "fixture.txt");
  const marker = path.join(directories.management, "unsettled-fixture.txt");
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
  let cleanupCount = 0;
  let isPoisoned = false;
  /**
   * capabilityのTest準備責務を実行する。
   *
   * @responsibility capabilityがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus capabilityを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
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
  /**
   * issueのTest準備責務を実行する。
   *
   * @responsibility issueがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus issueを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
  const issue = () => {
    const controlCapability = capability();
    controls.add(controlCapability);
    const useCapability = capability();
    controlsByUse.set(useCapability, controlCapability);
    return {
      status: "issued",
      controlCapability,
      useCapability,
      taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    };
  };
  /**
   * revokeのTest準備責務を実行する。
   *
   * @responsibility revokeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus revokeを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
  const revoke = (control: object) => {
    assert.equal(controls.delete(control), true);
    return { status: "revoked" };
  };
  /**
   * consumeのTest準備責務を実行する。
   *
   * @responsibility consumeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus consumeを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
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
    completeHostOperation: createHostCompletionFixture({
      cleanup: async (target) => {
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
        if (scenario === "cleanup_refused")
          throw Error("fixture_host_cleanup_unconfirmed");
        const outcome = await cleanupOwnedOperationDirectories(target);
        assert.equal(
          verifyOwnedOperationCleanupOutcome(outcome, target),
          "completed",
        );
        assert.equal(verifyOwnedOperationCleanupOutcome(outcome, {}), null);
        assert.equal(
          verifyOwnedOperationCleanupOutcome(
            Object.freeze({ kind: "owned_operation_cleanup_outcome" }),
            target,
          ),
          null,
        );
        return outcome;
      },
      classify: verifyOwnedOperationCleanupOutcome,
      prepare: controllerFixture?.prepareHostBoundary,
      finish: controllerFixture?.finishHostBoundary,
    }),
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
      return { status: "materialized", borrowed: true };
    },
    prepareReviewerWorkspace: () => {
      candidateEffectCount += 1;
      assert.equal(fs.readFileSync(file, "utf8"), "TASK_PROCESS_OK\n");
      return {
        status: "projected",
        candidateSnapshotId: "1".repeat(64),
        projectionHash: "3".repeat(64),
        workspaceReview: true,
        withheldFileCount: 0,
        totalBytes: 0,
        files: [],
      };
    },
    preflightSelections: () => ({ status: "matched" }),
    observeProviderHome: (provider) => ({
      status: "candidate",
      providerHome: {
        provider,
        providerHomeSourcePath: "C:/synthetic/provider-home/" + provider,
        providerHomeIdentityHash: "a".repeat(64),
        stableLogicalHomeBindingHash: "d".repeat(64),
      },
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
    prepareDockerRecoveryState: () => ({
      status: "available",
      reason: "coordinator_current_admission_available",
      lockReleased: true,
    }),
    reportSelectionNotice: () => {},
    issueTaskPacket: (_management, _binding, _provider, role) => {
      const issued = issue();
      assignments.set(issued.useCapability, role);
      return issued;
    },
    revokeTaskPacket: revoke,
    startProcess: (_provider, input, registerRecoveryHandoff) => {
      assert.equal(input.purpose, "task");
      if (input.purpose !== "task") throw Error("fixture_purpose_invalid");
      const role = assignments.get(input.packetCapability as object);
      assert.ok(role);
      assert.equal(input.packetRef, "TASKPKT-00112233445566778899AABBCCDDEEFF");
      assert.equal(input.providerHome.provider, _provider);
      consume(input.packetCapability as object);
      const management = input.managementCapability as object;
      if (controllerFixture)
        return controllerFixture.startProcess(
          controllerFixture.plan,
          management,
          registerRecoveryHandoff,
        );
      const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${(role === "executor" ? "c" : "d").repeat(64)}`;
      const recoveryCapability = capability();
      assert.equal(
        registerRecoveryHandoff(recoveryCapability, recoveryId),
        true,
      );
      if (scenario === "close_unknown") fs.writeFileSync(marker, "fixture");
      const child = spawn(
        process.execPath,
        ["-e", CHILD_SOURCE, role, file, scenario],
        {
          cwd: directories.workspace,
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
            recoveryFinalizationCapability: recoveryCapability,
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
  };
  return {
    runtime: createTaskRuntimeFixture(dependencies),
    owned,
    marker,
    directories,
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
        await cleanupOwnedOperationDirectories(owned);
      assert.equal(fs.existsSync(owned.root), false);
      host.directory.cleanup();
    },
  };
}

/**
 * 真正なHost清掃結果を元操作だけへ結合する。
 * @responsibility 別操作の真正結果と偽造結果を清掃確認として拒否する。
 * @trace ERB-IT-003
 * @precondition 自己生成した二操作だけを使用する。
 * @stimulus 両操作を実清掃し、同じ結果を同一・別対象へ照合する。
 * @observation 結果分類、操作Owner失効、作業領域不存在を確認する。
 * @oracle 同じ対象だけcompletedとなり、別対象と偽造結果はnullとなる。
 * @cleanup 未清掃の自己生成操作だけを登録hookで閉じる。
 * @boundary ERB-IT-003=Direct Boundary: Host清掃Owner→真正結果と実Filesystem。
 */
test("Host清掃結果はOwner失効後も元操作だけへ結合する", async (t) => {
  const host = hostFixture();
  const first = createOwnedOperationDirectories(host.input);
  const second = createOwnedOperationDirectories(host.input);
  t.after(async () => {
    for (const owned of [first, second])
      if (fs.existsSync(owned.root))
        await cleanupOwnedOperationDirectories(owned);
    host.directory.cleanup();
  });
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(first),
    createOwnedMountCapability(first),
  );
  const verifyCleanup = captureOwnedOperationCleanupVerification(management);
  assert.ok(verifyCleanup);
  assert.equal(verifyCleanup({}), null);
  const recoveryId = getOwnedHostRecoveryId(first);
  assert.match(recoveryId, /^host-operation\.OP-[0-9]{6,}$/u);
  const lockFile = path.join(
    host.directory.path,
    ".crdd",
    "lock",
    `coordinator.host-operation.${recoveryId.slice("host-operation.".length)}.lock`,
  );
  assert.equal(fs.existsSync(lockFile), true);
  const firstOutcome = await cleanupOwnedOperationDirectories(first);
  const secondOutcome = await cleanupOwnedOperationDirectories(second);
  assert.equal(fs.existsSync(first.root), false);
  assert.equal(fs.existsSync(lockFile), false);
  assert.equal(fs.existsSync(second.root), false);
  assert.throws(() => verifyOwnedOperationManagementCapability(management));
  assert.equal(captureOwnedOperationCleanupVerification(management), null);
  assert.equal(verifyCleanup(firstOutcome), "completed");
  assert.equal(verifyCleanup(secondOutcome), null);
  assert.equal(
    verifyOwnedOperationCleanupOutcome(firstOutcome, first),
    "completed",
  );
  assert.equal(
    verifyOwnedOperationCleanupOutcome(secondOutcome, second),
    "completed",
  );
  assert.equal(verifyOwnedOperationCleanupOutcome(firstOutcome, second), null);
  assert.equal(verifyOwnedOperationCleanupOutcome(secondOutcome, first), null);
  assert.equal(
    verifyOwnedOperationCleanupOutcome({ ...firstOutcome }, first),
    null,
  );
});

// No OS Ctrl+C delivery or real Docker resource claims: the registered CLI
// callback traverses Task + Controller + the production-owned Node process tree.
for (const cleanupConfirmed of [true, false]) {
  /**
   * Host Windows: Task→Controller→共有Processの取消結合: Docker回収模擬=${cleanupConfirmed}を検証する。
   *
   * @responsibility Host Windows: Task→Controller→共有Processの取消結合: Docker回収模擬=${cleanupConfirmed}の合否判定を所有する。
   * @trace ERB-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Host Windows: Task→Controller→共有Processの取消結合: Docker回収模擬=${cleanupConfirmed}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-002=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`Host Windows: Task→Controller→共有Processの取消結合: Docker回収模擬=${cleanupConfirmed}`, {
    skip: process.platform !== "win32",
  }, async (t) => {
    const harness = createProcessHarness("cancel", cleanupConfirmed);
    t.after(() => harness.dispose());
    await t.test(
      "準備済みの資源でTaskの終了を確認する",
      { timeout: 20_000 },
      async (t) => {
        const controller = harness.controllerFixture;
        assert.ok(controller);
        assert.equal(controller.productionAuthority, false);
        const initialListenerCounts = [
          process.listenerCount("SIGINT"),
          process.listenerCount("SIGTERM"),
        ];
        const started = harness.runtime.start(
          {
            taskExecutionSelections: taskExecutionSelections("claude"),
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
          harness.directories.workspace,
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
              `Task completed before cancellation: ${JSON.stringify(result)}; controller events: ${JSON.stringify(controller.events)}`,
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
        assert.deepEqual(
          await harness.runtime.cancel(started.controlCapability),
          {
            status: "blocked",
            reason: "coordinator_task_control_invalid",
          },
        );
        assert.equal(binding.unbind().status, "released");
        assert.deepEqual(
          [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")],
          initialListenerCounts,
        );
      },
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
  /**
   * Taskと実子Process・Host領域の結合: ${scenario}を検証する。
   *
   * @responsibility Taskと実子Process・Host領域の結合: ${scenario}の合否判定を所有する。
   * @trace ERB-IT-001
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Taskと実子Process・Host領域の結合: ${scenario}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`Taskと実子Process・Host領域の結合: ${scenario}`, {}, async (t) => {
    const harness = createProcessHarness(scenario);
    t.after(() => harness.dispose());
    await t.test(
      "準備済みの資源でTaskの終了を確認する",
      { timeout: 20_000 },
      async (t) => {
        const signalCounts = [
          process.listenerCount("SIGINT"),
          process.listenerCount("SIGTERM"),
        ];
        const started = harness.runtime.start(
          {
            taskExecutionSelections: taskExecutionSelections("claude"),
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
          harness.directories.workspace,
        );
        const binding = bindTaskCliCancellationSignals(() =>
          harness.runtime.cancel(started.controlCapability),
        );
        t.after(() => binding.unbind());
        assert.equal(binding.status, "bound");
        assert.equal(
          (await cancelCoordinatorTask(started.controlCapability)).status,
          "blocked",
        );
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
        assert.deepEqual(
          await harness.runtime.cancel(started.controlCapability),
          {
            status: "blocked",
            reason: "coordinator_task_control_invalid",
          },
        );
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
        assert.equal(
          harness.cleanupCount(),
          scenario === "close_unknown" ? 0 : 1,
        );
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
        const report = JSON.parse(json);
        assert.equal(
          report.status,
          scenario === "normal" ? "completed" : "blocked",
        );
        assert.equal(report.cleanupConfirmed, !isRecoveryRequired);
        assert.equal(report.manualRecoveryRequired, isRecoveryRequired);
        if (isRecoveryRequired) {
          assert.equal(report.hostRecoveryId, harness.hostRecoveryId);
        }
      },
    );
  });
}
