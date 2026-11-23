/**
 * Coordinator最新現在状態の実Filesystem保存を自己生成Repositoryで確認する。
 * @packageDocumentation
 * @responsibility 固定配置、pending再入場、拒否時の保全とOwner失効を検証する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @level IT
 * @scope Coordinator現在状態、fresh回収Owner、Host清掃後保存、Repository-local Filesystem。
 * @boundary ERB-IT-003=Direct Boundary: 現在状態Writer→Repository-local Filesystem。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在準備Owner・Kernel排他→現在状態Writer／Filesystem。
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyResourceCleanup,
  applyResourceEvent,
  completeOperation,
  completeRecovery,
  type ExecutionOperationRecord,
  type OperationRecord,
  type OperationResources,
  readState,
  saveOperationCheckpoint,
  saveOperationStart,
  saveRecoveryCheckpoint,
  saveRecoveryHistory,
} from "../../../execution-model/src/index.ts";
import { createResourceBookFixture } from "../../../execution-model/tests/support/resource-operation.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  historyRepositoryInput,
  requireReadyRepositoryExecutionDataArea,
  withHistoryRetention,
} from "../../src/lifecycle/host.ts";
import {
  providerHomesDirectoryCandidate,
  runtimeStateDirectoryCandidate,
} from "../../src/lifecycle/environment.ts";
import { acquireProviderHomeLock } from "../../src/lifecycle/host.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  readOwnedHostOperation,
  acquireHostOperationRecoveryGeneration,
  releaseHostOperationRecoveryGeneration,
  recoverOwnedOperationDirectories,
  operationStartInput,
  operationStateInput,
} from "../../src/lifecycle/host.ts";
import {
  finalizeRuntimeOwnedDockerRestartPreparation,
  persistRuntimeOwnedDockerRestartCheckpoint,
  persistRuntimeOwnedDockerTaskRecoveryCheckpoint,
  prepareRuntimeOwnedDockerRestart,
  prepareRuntimeOwnedDockerTaskRecovery,
  prepareRuntimeOwnedRepositoryDockerOperationIdentity,
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  recoverRuntimeOwnedDockerTaskFromCurrentRepository,
  releaseRuntimeOwnedDockerRestartPreparation,
  releaseRuntimeOwnedDockerTaskRecoveryPreparation,
  verifyRuntimeOwnedDockerRestartPreparation,
} from "../../src/lifecycle/environment.ts";
import { executionSelection } from "../fixtures/ai-selection.ts";
import {
  canonicalJson,
  restartRequestIdFixture,
} from "../support/contract-assertions.ts";

/**
 * Host試験の共有Home・Runtime State親を今回の新品Rootへ限定する。
 * @responsibility 実ユーザーの設定・保持物に依存せず、同じ所在から排他を導出する。
 * @trace ERB-IT-014
 * @precondition rootは現在Caseが作成した専用Repositoryである。
 * @stimulus 所在取得元を自己所有Rootに設定し、既存の候補所在だけを作成する。
 * @observation 既存Home排他と回復準備の結果をCaseが検証する。
 * @oracle 実Homeの有無を試験前提にしない。
 * @cleanup 元設定を復元し、Caseの既存hookがRoot全体を回収する。
 * @boundary 試験Process内の設定と自己所有Filesystemのみ。
 */
function useFixtureRuntimeDirectories(t: TestContext, root: string) {
  const previous = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = root;
  t.after(() => {
    if (previous === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous;
  });
  for (const directory of [
    providerHomesDirectoryCandidate(),
    runtimeStateDirectoryCandidate(),
  ]) {
    assert.ok(directory);
    const relative = path.relative(root, directory);
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    fs.mkdirSync(directory, { recursive: true });
  }
}

const RESOURCE_KEYS = [
  "create_egress_network",
  "create_internal_network",
  "create_provider",
  "create_proxy",
  "create_subscription_auth_probe",
] as const;
const emptyTaskSections = {
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
};

/** 自己生成の未発行断面だけを正規Lifecycleで閉じ、Host清掃へ渡す。
 * @trace ERB-IT-003
 * @precondition 外部Effectを発行していないfixtureの同じ管理Owner。
 * @oracle 未要求資源以外は拒否し、保存の三確認を要求する。
 */
function closeUnissuedFixtureOperations(management: object) {
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(repository);
  const current = readState(operationStateInput(management), {
    scope: "operation",
  });
  assert.equal(current.status, "completed");
  assert.ok(current.value);
  for (const operation of current.value.snapshot.operations) {
    if (
      operation.kind !== "docker_task" ||
      JSON.parse(operation.identityJson).operationId !== repository.operationId
    )
      continue;
    assert.ok(
      operation.resources === null ||
        operation.resources.snapshot.resources.every(
          (resource) => resource.request === "not_issued",
        ),
    );
    const saved = saveOperationCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      {
        kind: "lifecycle",
        value: {
          phase: "settling",
          lease: "released",
          execution: { ...operation.execution, ownerEffect: "disabled" },
          primaryFailure: operation.primaryFailure,
          outcome: operation.outcome,
          summarySha256: operation.summarySha256,
        },
      },
    );
    assert.equal(saved.status, "completed", saved.reason);
    assert.equal(saved.snapshotConfirmed, true);
    assert.equal(saved.lockReleased, true);
  }
}

/**
 * 固定二File保存と同じ更新の再入場、保全停止を確認する。
 * @responsibility 自己生成Repositoryで実保存・現在回収Owner・拒否境界を観測する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition Windowsの実効排他とRepository内試験領域だけを使う。
 * @stimulus 初回・次版・pending再入場、不一致・hardlink・Owner失効、実CLIの単一Host／Probe・重複・別Repository・旧token拒否と、実準備Map／Kernel排他／Writerで再起動要求の全保存段階を処置する。技術完了入力は合成としNative／Docker要求を発行しない。
 * @observation 本文、pendingとlock不存在、拒否結果、再起動欄とReader／Writer境界の排他・Owner再確認。
 * @oracle 同じ更新だけ成功し、別pendingや不正入力を上書きしない。再起動保存の拒否は本文不変・Host要求0とし、排他終了不明を保持する。
 * @cleanup 所有操作を閉じ、自己生成した子Repositoryだけを削除する。
 * @boundary ERB-IT-003=Direct Boundary: Writer→実FilesystemとOS排他。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在準備Owner・Kernel排他→現在状態Writer／Filesystem。
 */
test("Host Windows: Coordinator現在状態の保存とpending再入場", async (t) => {
  assert.equal(process.platform, "win32");
  const tests = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "test_root",
  );
  const root = fs.mkdtempSync(path.join(tests.directory, "coordinator-state-"));
  useFixtureRuntimeDirectories(t, root);
  let owned: ReturnType<typeof createOwnedOperationDirectories> | null = null;
  let isCleaned = false;
  t.after(() => {
    if (owned && !isCleaned) cleanupOwnedOperationDirectories(owned);
    fs.rmSync(root, { recursive: true });
    if (fs.readdirSync(tests.directory).length === 0)
      fs.rmdirSync(tests.directory);
  });
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
  owned = createOwnedOperationDirectories({
    root:
      getRepository(root).capability ??
      assert.fail("fixture_repository_missing"),
    purpose: "task",
    recordingCurrent: () => true,
  });
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  const binding = bindRuntimeOwnedRepositoryOperation(management, root);
  assert.ok(binding);
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(repository);
  const verifiedRoot = getRepository(root);
  assert.equal(verifiedRoot.status, "completed");
  assert.ok(verifiedRoot.capability);
  const initialHostState = readState(verifiedRoot.capability, {
    scope: "recovery",
  });
  assert.equal(initialHostState.status, "completed");
  assert.ok(initialHostState.value);
  const first = initialHostState.value.snapshot;
  const area = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      root,
      "execution-model",
    ),
    "state_root",
  );
  const second = {
    ...first,
    revision: first.revision + 1,
    previous: {
      revision: first.revision,
      payloadSha256: createHash("sha256")
        .update(`${canonicalJson(first)}\n`, "utf8")
        .digest("hex"),
    },
  };
  const secondBytes = Buffer.from(`${canonicalJson(second)}\n`);
  // 純粋な保存反例はDomainへ移管済み。Host結合Caseには同じ改訂2の合成元版を置く。
  // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
  fs.writeFileSync(path.join(area.directory, "state.json"), secondBytes);
  const readFirst = readState(operationStateInput(management), {
    scope: "operation",
  });
  assert.equal(readFirst.status, "completed");
  assert.equal(readFirst.lockReleased, true);
  assert.equal(
    readFirst.value?.payloadSha256,
    createHash("sha256")
      .update(`${canonicalJson(second)}\n`, "utf8")
      .digest("hex"),
  );
  assert.deepEqual(
    readState(verifiedRoot.capability, { scope: "recovery" }).value,
    readFirst.value,
  );
  const identity = {
    schema: "crdd-coordinator/operation-identity/v6",
    operationNonce: "b".repeat(64),
    provider: "claude",
    consumer: "orchestrator",
    operationId: repository.operationId,
    recoveryCorrelationId: "task-operation-a",
    executionSelection: executionSelection("executor", {
      provider: "claude",
      model: "opus",
      effort: "low",
    }),
    taskAttempt: 0 as const,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    repositoryBinding: repository.repositoryBinding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
  };
  const resourceFrame = createResourceBookFixture(
    identity.ownershipLabel,
    "planned",
    RESOURCE_KEYS,
  );
  const resourceName = (key: string) => {
    const resource = resourceFrame.snapshot.resources.find(
      (r) => r.key === key,
    );
    assert.ok(resource);
    return resource.identity.name;
  };
  const operationStarted = saveOperationStart(
    operationStartInput(management, () => null),
    `${JSON.stringify(identity)}\n`,
  );
  assert.equal(operationStarted.status, "completed", operationStarted.reason);
  assert.equal(
    operationStarted.startSaved &&
      operationStarted.snapshotConfirmed &&
      operationStarted.lockReleased,
    true,
  );
  const operationBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  const startedState = JSON.parse(operationBytes.toString("utf8"));
  assert.equal(startedState.revision, second.revision + 1);
  assert.deepEqual(startedState.previous, {
    revision: second.revision,
    payloadSha256: createHash("sha256").update(secondBytes).digest("hex"),
  });
  assert.deepEqual(
    {
      ...startedState,
      revision: second.revision,
      previous: second.previous,
      operations: first.operations,
    },
    second,
  );
  assert.equal(startedState.operations.length, first.operations.length + 1);
  assert.equal(
    startedState.operations.find(
      (item: { kind: string }) => item.kind === "docker_task",
    ).recoveryId,
    operationStarted.recoveryId,
  );
  assert.equal(
    startedState.operations.find(
      (item: { kind: string }) => item.kind === "docker_task",
    ).identityJson,
    `${JSON.stringify(identity)}\n`,
  );
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  // CLI自身と実Readerを使い、処置境界だけを無Effectの観測へ置き換える。
  const cliBase = JSON.parse(secondBytes.toString("utf8"));
  const fixtureHost = readOwnedHostOperation(management).record;
  const cliHost = {
    ...fixtureHost,
    operationId: "OP-999999",
    recoveryId: "host-operation.OP-999999",
  };
  const token = cliHost.recoveryId;
  const singleCliBytes = Buffer.from(
    canonicalJson({
      ...cliBase,
      operations: [...cliBase.operations, cliHost],
    }) + "\n",
  );
  const duplicateCliBytes = Buffer.from(
    canonicalJson({
      ...cliBase,
      operations: [...cliBase.operations, cliHost, cliHost],
    }) + "\n",
  );
  const probeCliBytes = Buffer.from(
    canonicalJson({
      ...cliBase,
      operations: [
        ...cliBase.operations,
        { ...cliHost, purpose: "isolation_probe" },
      ],
    }) + "\n",
  );
  const probeToken = token;
  const cliRoot = path.join(root, ".crdd", "operations", cliHost.operationId);
  const cliModule = new URL("../../bin/coordinator.ts", import.meta.url).href;
  const hostModule = new URL("../../src/lifecycle/host.ts", import.meta.url)
    .href;
  const probeModule = new URL(
    "../../src/lifecycle/environment.ts",
    import.meta.url,
  ).href;
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
  for (const [bytes, recoveryId, expectedKind, workingDirectory = root] of [
    [singleCliBytes, token, "host"],
    [probeCliBytes, probeToken, "probe"],
    [secondBytes, token, null],
    [duplicateCliBytes, token, null],
    [singleCliBytes, "host-operation.OP-888888", null],
    [singleCliBytes, "host.retired-token", null],
    [singleCliBytes, token, null, otherRoot],
  ] as const) {
    const cliState = path.join(
      workingDirectory,
      ".crdd",
      "execution-model",
      "state.json",
    );
    if (workingDirectory === otherRoot)
      fs.mkdirSync(path.dirname(cliState), { recursive: true });
    fs.writeFileSync(cliState, bytes);
    const valid: ReturnType<typeof readState> = readState(
      verifiedRoot.capability,
      { scope: "recovery" },
    );
    assert.equal(
      valid.status,
      bytes === duplicateCliBytes ? "blocked" : "completed",
    );
    assert.equal(valid.lockReleased, true);
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "-e",
        `(async()=>{
         const { mock } = await import("node:test");
         const { createHash } = await import("node:crypto");
         const path=await import("node:path");
         const calls = [];
         // CLIを評価する前にHostとProbeの処置だけを有限代役へ結合する。
         const vc = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
         const store = await import(${JSON.stringify(new URL("../../../execution-model/src/index.ts", import.meta.url).href)});
         const verified = vc.getRepository(process.cwd());
         const before = store.readState(verified.capability,{scope:"recovery"});
         const host = await import(${JSON.stringify(hostModule)});
         const probe = await import(${JSON.stringify(probeModule)});
         /**
          * 回復CLIの配送先とRootのHashを記録して処置を拒否する。
          * @responsibility 回復CLIの配送先とRootのHashを記録して処置を拒否する。
          * @trace ERB-IT-003
          * @trace ERB-IT-014
          * @precondition 子Process内の回復先を有限代役へ置換済み。
          * @stimulus kind・id・rootを受け取り観測packetを返す。
          * @observation kind、元回復ID、RootのHashとfixture_no_effect理由。
          * @oracle CLIが同じ対象を一回配送し実処置へ進まない。
          * @cleanup 所有子をCaseが終了待機して自己生成Rootを回収する。
          * @boundary 実CLI子と回復代役。HostやDockerの回収成功は主張しない。
          */
         const observe = (kind, id) => {
           const root=path.join(vc.resolveVerifiedRepositoryRoot(verified.capability),".crdd","operations",id.slice("host-operation.".length));
           calls.push({kind, id, rootHash:createHash("sha256").update(root).digest("hex")});
           return {status:"blocked",reason:"fixture_no_effect",recoveryId:id,hostCleanupCompleted:false};
         };
         await mock.module(${JSON.stringify(hostModule)}, {namedExports:{...host,
           recoverOwnedOperationDirectories:(id, generation)=>{if(!generation)throw Error("fixture_generation_missing");return observe("host",id);}}});
         await mock.module(${JSON.stringify(probeModule)}, {namedExports:{...probe,
           recoverDockerIsolationProbe:(id,capability)=>{if(vc.resolveVerifiedRepositoryRoot(capability)!==process.cwd())throw Error("fixture_root_mismatch");return observe("probe",id);}}});
         process.argv=[process.execPath,"coordinator","recovery","resume",${JSON.stringify(recoveryId)},"--json"];
         await import(${JSON.stringify(cliModule)});
         const cliExitCode=process.exitCode;
         process.stdout.write("\\nCLI_ROOT_OBSERVATION="+JSON.stringify({calls,cliExitCode,readerStatus:before.status,readerReason:before.reason,readerReleased:before.lockReleased})+"\\n");
         process.exitCode=0;
         })().catch(error=>{console.error(error);process.exitCode=1;});`,
      ],
      {
        cwd: workingDirectory,
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.includes(root), false);
    assert.equal(child.stderr.includes(root), false);
    const observation = JSON.parse(
      child.stdout.split("CLI_ROOT_OBSERVATION=")[1]?.trim() ?? "null",
    );
    assert.ok(observation);
    assert.equal(observation.cliExitCode, 2);
    assert.deepEqual(
      observation.calls,
      expectedKind === null
        ? []
        : [
            {
              kind: expectedKind,
              id: recoveryId,
              rootHash: createHash("sha256").update(cliRoot).digest("hex"),
            },
          ],
      child.stdout,
    );
    if (expectedKind === null)
      assert.ok(
        child.stdout.includes(
          "coordinator_recovery_current_operation_unconfirmed",
        ),
      );
    assert.deepEqual(fs.readFileSync(cliState), bytes);
  }
  fs.writeFileSync(path.join(area.directory, "state.json"), secondBytes);
  const recoveryOwned = createOwnedOperationDirectories({
    root:
      getRepository(root).capability ??
      assert.fail("fixture_repository_missing"),
    purpose: "task",
    recordingCurrent: () => true,
  });
  const recoveryManagement = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(recoveryOwned),
    createOwnedMountCapability(recoveryOwned),
  );
  const recoveryHostBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  let recoveryPreparation: object | null = null;
  let recoveryOwnerAbandoned = false;
  try {
    assert.ok(bindRuntimeOwnedRepositoryOperation(recoveryManagement, root));
    const recoveryRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(recoveryManagement);
    assert.ok(recoveryRepository);
    const recoveryIdentity = {
      ...identity,
      operationId: recoveryRepository.operationId,
      operationNonce: "2".repeat(64),
      stableLogicalHomeBindingHash: "1".repeat(64),
    };
    const recoveryStarted = saveOperationStart(
      operationStartInput(recoveryManagement, () => null),
      `${JSON.stringify(recoveryIdentity)}\n`,
    );
    assert.equal(recoveryStarted.status, "completed", recoveryStarted.reason);
    assert.ok(recoveryStarted.recoveryId);
    const initialRecoveryBytes = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    const activeHost = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(activeHost.status, "blocked");
    assert.equal(
      activeHost.reason,
      "docker_task_recovery_host_active_or_unknown",
    );
    assert.equal(activeHost.cleanupConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      initialRecoveryBytes,
    );
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(recoveryManagement),
      true,
    );
    recoveryOwnerAbandoned = true;
    const activeHomeAcquisition = acquireProviderHomeLock(
      "1".repeat(64),
      providerHomesDirectoryCandidate(),
    );
    assert.ok(activeHomeAcquisition.status === "acquired");
    const activeHome = activeHomeAcquisition.lock;
    assert.ok(activeHome);
    try {
      const refusedHome = prepareRuntimeOwnedDockerTaskRecovery(
        recoveryStarted.recoveryId,
        verifiedRoot.capability,
      );
      assert.equal(refusedHome.status, "blocked");
      assert.equal(
        refusedHome.reason,
        "docker_task_recovery_home_active_or_unknown",
      );
      assert.equal(refusedHome.cleanupConfirmed, false);
    } finally {
      assert.equal(activeHome.release(), true);
    }
    // 実Driverの最初の待機後に退役を実保存し、次の待機中に取消する。
    // Dockerへ到達させず、実Kernel排他・Writer・読戻しと解放を確認する。
    for (const ownerEffect of ["active", "unknown"] as const) {
      const fixture = JSON.parse(initialRecoveryBytes.toString("utf8"));
      const oldOperation = fixture.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === recoveryStarted.recoveryId,
      );
      assert.ok(oldOperation);
      oldOperation.execution.ownerEffect = ownerEffect;
      const fixtureBytes = Buffer.from(`${canonicalJson(fixture)}\n`);
      fs.writeFileSync(path.join(area.directory, "state.json"), fixtureBytes);
      const prior: ReturnType<typeof readState> = readState(
        verifiedRoot.capability,
        { scope: "recovery" },
      );
      assert.equal(prior.status, "completed");
      assert.ok(prior.value);
      const cancellation = new AbortController();
      const recovering = recoverRuntimeOwnedDockerTaskFromCurrentRepository(
        recoveryStarted.recoveryId,
        verifiedRoot.capability,
        cancellation.signal,
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      cancellation.abort();
      const cancelled = await recovering;
      assert.equal(cancelled.reason, "docker_task_recovery_cancelled");
      assert.equal(cancelled.dockerCleanupConfirmed, false);
      assert.equal(cancelled.hostCleanupConfirmed, false);
      assert.equal(cancelled.locksReleased, true);
      const actual: ReturnType<typeof readState> = readState(
        verifiedRoot.capability,
        { scope: "recovery" },
      );
      assert.equal(actual.status, "completed");
      assert.ok(actual.value);
      const expected = JSON.parse(canonicalJson(prior.value.snapshot));
      expected.revision++;
      expected.previous = {
        revision: prior.value.snapshot.revision,
        payloadSha256: prior.value.payloadSha256,
      };
      const retired = expected.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === recoveryStarted.recoveryId,
      );
      retired.phase = "settling";
      retired.execution.ownerEffect = "disabled";
      assert.deepEqual(actual.value.snapshot, expected);
      assert.equal(
        actual.value.payloadSha256,
        createHash("sha256")
          .update(`${canonicalJson(expected)}\n`, "utf8")
          .digest("hex"),
      );
    }
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      initialRecoveryBytes,
    );
    // 実保存中断と同じ資源Receipt pairをfresh回収Ownerへ接続する。
    const resourceStart = readState(operationStateInput(management), {
      scope: "operation",
    }).value;
    assert.ok(resourceStart);
    const resourceOperation = resourceStart.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" &&
        item.recoveryId === recoveryStarted.recoveryId,
    );
    assert.ok(resourceOperation);
    assert.equal(resourceOperation.resources, null);
    const providerResource = {
      key: "create_provider",
      snapshot: resourceFrame.snapshot,
      cleanup: resourceFrame.cleanup,
    };
    const submitted = applyResourceEvent(resourceOperation.resources, {
      ...providerResource,
      event: "submission",
    });
    assert.ok(submitted);
    const receiptBefore = Buffer.from(
      `${canonicalJson({
        ...resourceStart.snapshot,
        revision: resourceStart.snapshot.revision + 1,
        previous: {
          revision: resourceStart.snapshot.revision,
          payloadSha256: resourceStart.payloadSha256,
        },
        operations: resourceStart.snapshot.operations.map((item) =>
          item.recoveryId === recoveryStarted.recoveryId
            ? { ...item, resources: submitted }
            : item,
        ),
      })}\n`,
    );
    const received = applyResourceEvent(submitted, {
      ...providerResource,
      event: "receipt",
      snapshot: {
        resources: providerResource.snapshot.resources.map((r) =>
          r.key === providerResource.key
            ? {
                ...r,
                request: "issued",
                identity: { ...r.identity, dockerId: "d".repeat(64) },
              }
            : r,
        ),
      },
    });
    assert.ok(received);
    const submittedState = {
      snapshot: JSON.parse(
        Buffer.from(
          receiptBefore ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      payloadSha256: createHash("sha256")
        .update(receiptBefore ?? assert.fail("missing_fixture_bytes"))
        .digest("hex"),
      sourceText: Buffer.from(
        receiptBefore ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    };
    assert.ok(submittedState);
    const receiptPending = Buffer.from(
      `${canonicalJson({
        ...submittedState.snapshot,
        revision: submittedState.snapshot.revision + 1,
        previous: {
          revision: submittedState.snapshot.revision,
          payloadSha256: submittedState.payloadSha256,
        },
        operations: submittedState.snapshot.operations.map((item) =>
          item.recoveryId === recoveryStarted.recoveryId
            ? { ...item, resources: received }
            : item,
        ),
      })}\n`,
    );
    // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
    fs.writeFileSync(path.join(area.directory, "state.json"), receiptBefore);
    fs.writeFileSync(
      path.join(area.directory, "state.pending.json"),
      receiptPending,
      { flag: "wx" },
    );
    assert.equal(
      readState(verifiedRoot.capability, { scope: "recovery" }).reason,
      "coordinator_state_reentry_required",
    );
    const markerPath = path.join(area.directory, "state.lock");
    const recoveryBinding = borrowRuntimeOwnedCoordinatorRecoveryRepository(
      verifiedRoot.capability,
    );
    assert.ok(recoveryBinding);
    for (const failAt of [1, 2, 3]) {
      for (const shouldThrow of [false, true]) {
        let ownerChecks = 0;
        const rejectedReceipt: ReturnType<typeof saveRecoveryCheckpoint> =
          saveRecoveryCheckpoint(
            { ...recoveryBinding, operationId: recoveryRepository.operationId },
            recoveryStarted.recoveryId,
            null,
            {
              kind: "resource_publication",
              publication: { before: receiptBefore, candidate: receiptPending },
              assertOwner: () => {
                ownerChecks++;
                if (ownerChecks !== failAt) return true;
                if (shouldThrow) throw new Error("fixture_owner_lost");
                return false;
              },
            },
          );
        assert.equal(ownerChecks, failAt);
        assert.equal(rejectedReceipt.status, "blocked");
        assert.equal(rejectedReceipt.filesystemEffectIssued, false);
        assert.equal(rejectedReceipt.snapshotConfirmed, false);
        assert.deepEqual(
          fs.readFileSync(path.join(area.directory, "state.json")),
          receiptBefore,
        );
        assert.deepEqual(
          fs.readFileSync(path.join(area.directory, "state.pending.json")),
          receiptPending,
        );
      }
    }
    for (const badMarker of [
      Buffer.alloc(0),
      Buffer.from("different-marker"),
    ]) {
      fs.writeFileSync(markerPath, badMarker);
      assert.equal(
        readState(verifiedRoot.capability, {
          scope: "recovery",
          input: {
            kind: "resource_publication" as const,
            recoveryId: recoveryStarted.recoveryId,
          },
        }).status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        receiptBefore,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.pending.json")),
        receiptPending,
      );
      assert.deepEqual(fs.readFileSync(markerPath), badMarker);
      fs.unlinkSync(markerPath);
    }
    // 読取り直後の候補差替えは元pairと一致せず、Writerへ渡らない。
    for (const fileName of ["state.json", "state.pending.json"] as const) {
      let checks = 0;
      const rejectedReceipt: ReturnType<typeof saveRecoveryCheckpoint> =
        saveRecoveryCheckpoint(
          { ...recoveryBinding, operationId: recoveryRepository.operationId },
          recoveryStarted.recoveryId,
          null,
          {
            kind: "resource_publication",
            publication: { before: receiptBefore, candidate: receiptPending },
            assertOwner: () => {
              checks++;
              if (checks === 1)
                fs.writeFileSync(
                  path.join(area.directory, fileName),
                  "fixture_changed",
                );
              return true;
            },
          },
        );
      assert.equal(rejectedReceipt.status, "blocked");
      assert.equal(rejectedReceipt.filesystemEffectIssued, false);
      assert.equal(
        fs.readFileSync(path.join(area.directory, fileName), "utf8"),
        "fixture_changed",
      );
      fs.writeFileSync(
        path.join(area.directory, fileName),
        fileName === "state.json" ? receiptBefore : receiptPending,
      );
    }
    const receiptReentry = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(receiptReentry.status, "prepared");
    assert.ok(receiptReentry.capability);
    try {
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        receiptPending,
      );
      assert.equal(
        fs.existsSync(path.join(area.directory, "state.pending.json")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(area.directory, "state.lock")),
        false,
      );
    } finally {
      assert.equal(
        releaseRuntimeOwnedDockerTaskRecoveryPreparation(
          receiptReentry.capability,
        ),
        true,
      );
    }
    // 以下の既存反証は元fixtureから開始する。実製品記録は変更しない。
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      initialRecoveryBytes,
    );
    const preparedRecovery = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(preparedRecovery.status, "prepared");
    assert.ok(preparedRecovery.capability);
    recoveryPreparation = preparedRecovery.capability;
    assert.equal(
      verifyRuntimeOwnedDockerRestartPreparation(recoveryPreparation),
      false,
    );
    assert.equal(
      releaseRuntimeOwnedDockerRestartPreparation(recoveryPreparation),
      false,
    );
    const recoveryCurrent = readState(verifiedRoot.capability, {
      scope: "recovery",
    });
    assert.ok(recoveryCurrent.value);
    const recoveryOperation = recoveryCurrent.value.snapshot.operations.find(
      (value) => value.recoveryId === recoveryStarted.recoveryId,
    );
    assert.ok(recoveryOperation && recoveryOperation.kind === "docker_task");
    const lifecycleValue = {
      phase: "settling",
      lease: recoveryOperation.lease,
      execution: { ...recoveryOperation.execution, ownerEffect: "disabled" },
      primaryFailure: recoveryOperation.primaryFailure,
      outcome: recoveryOperation.outcome,
      summarySha256: recoveryOperation.summarySha256,
    };
    const firstRecoveryResource = resourceFrame.snapshot.resources[0];
    assert.ok(firstRecoveryResource);
    const intendedResource = {
      event: "submission",
      key: firstRecoveryResource.key,
      snapshot: resourceFrame.snapshot,
      cleanup: resourceFrame.cleanup,
    };
    const intendedResources = applyResourceEvent(
      recoveryOperation.resources,
      intendedResource,
    );
    assert.ok(intendedResources);
    const cleanupPayload = {
      snapshot: {
        resources: intendedResources.snapshot.resources.map((r) =>
          r.key === firstRecoveryResource.key
            ? { ...r, request: "unknown" as const }
            : r,
        ),
      },
      observations: intendedResources.checkpoints.map((c) => ({
        key: c.key,
        observation:
          c.key === firstRecoveryResource.key ? "unknown" : "not_requested",
      })),
    };
    const cleanupResources = applyResourceCleanup(
      intendedResources,
      cleanupPayload.snapshot,
      cleanupPayload.observations,
      {
        recoveryId: recoveryStarted.recoveryId,
        previousPayloadSha256: "e".repeat(64),
      },
    );
    assert.ok(cleanupResources);
    const expectedResourceOperation = {
      ...recoveryOperation,
      resources: intendedResources,
    };
    const expectedCleanupOperation = {
      ...expectedResourceOperation,
      resources: cleanupResources,
    };
    for (const [kind, value, expectedOperation] of [
      ["resource", intendedResource, expectedResourceOperation],
      ["cleanup", cleanupPayload, expectedCleanupOperation],
    ] as const) {
      const beforeFixed: ReturnType<typeof readState> = readState(
        verifiedRoot.capability,
        { scope: "recovery" },
      );
      assert.equal(beforeFixed.status, "completed");
      assert.equal(beforeFixed.lockReleased, true);
      assert.ok(beforeFixed.value);
      assert.equal(
        persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
          recoveryPreparation,
          kind,
          value,
        ),
        true,
      );
      const afterFixed: ReturnType<typeof readState> = readState(
        verifiedRoot.capability,
        { scope: "recovery" },
      );
      assert.equal(afterFixed.status, "completed");
      assert.equal(afterFixed.lockReleased, true);
      assert.ok(afterFixed.value);
      assert.equal(
        afterFixed.value.snapshot.revision,
        beforeFixed.value.snapshot.revision + 1,
      );
      assert.deepEqual(afterFixed.value.snapshot.previous, {
        revision: beforeFixed.value.snapshot.revision,
        payloadSha256: beforeFixed.value.payloadSha256,
      });
      assert.equal(
        afterFixed.value.payloadSha256,
        createHash("sha256")
          .update(fs.readFileSync(path.join(area.directory, "state.json")))
          .digest("hex"),
      );
      assert.equal(
        afterFixed.value.snapshot.schema,
        beforeFixed.value.snapshot.schema,
      );
      assert.equal(
        afterFixed.value.snapshot.repositoryBinding,
        beforeFixed.value.snapshot.repositoryBinding,
      );
      assert.deepEqual(
        afterFixed.value.snapshot.operations,
        beforeFixed.value.snapshot.operations.map(
          (operation): OperationRecord =>
            operation.recoveryId === recoveryStarted.recoveryId
              ? expectedOperation
              : operation,
        ),
      );
      assert.equal(
        Object.hasOwn(afterFixed.value.snapshot, "pendingDeliveries"),
        false,
      );
      assert.equal(
        Object.hasOwn(beforeFixed.value.snapshot, "pendingDeliveries"),
        false,
      );
      assert.deepEqual(
        afterFixed.value.snapshot.unresolvedRecoveries,
        beforeFixed.value.snapshot.unresolvedRecoveries,
      );
    }
    const beforeLifecycle = readState(verifiedRoot.capability, {
      scope: "recovery",
    });
    assert.ok(beforeLifecycle.value);
    for (const invalid of [null, {}, { ...recoveryPreparation }]) {
      assert.equal(
        persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
          invalid,
          "lifecycle",
          lifecycleValue,
        ),
        false,
      );
      assert.equal(
        releaseRuntimeOwnedDockerTaskRecoveryPreparation(invalid),
        false,
      );
    }
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "lifecycle",
        lifecycleValue,
      ),
      true,
    );
    const afterRecovery = readState(verifiedRoot.capability, {
      scope: "recovery",
    });
    assert.equal(afterRecovery.status, "completed");
    assert.ok(afterRecovery.value);
    assert.equal(
      afterRecovery.value.snapshot.revision,
      beforeLifecycle.value.snapshot.revision + 1,
    );
    assert.equal(afterRecovery.lockReleased, true);
    assert.deepEqual(afterRecovery.value.snapshot.previous, {
      revision: beforeLifecycle.value.snapshot.revision,
      payloadSha256: beforeLifecycle.value.payloadSha256,
    });
    assert.equal(
      afterRecovery.value.payloadSha256,
      createHash("sha256")
        .update(fs.readFileSync(path.join(area.directory, "state.json")))
        .digest("hex"),
    );
    assert.equal(
      afterRecovery.value.snapshot.schema,
      beforeLifecycle.value.snapshot.schema,
    );
    assert.equal(
      afterRecovery.value.snapshot.repositoryBinding,
      beforeLifecycle.value.snapshot.repositoryBinding,
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.operations,
      beforeLifecycle.value.snapshot.operations.map((operation) =>
        operation.recoveryId === recoveryStarted.recoveryId
          ? { ...expectedCleanupOperation, ...lifecycleValue }
          : operation,
      ),
    );
    assert.equal(
      Object.hasOwn(afterRecovery.value.snapshot, "pendingDeliveries"),
      false,
    );
    assert.equal(
      Object.hasOwn(beforeLifecycle.value.snapshot, "pendingDeliveries"),
      false,
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.unresolvedRecoveries,
      beforeLifecycle.value.snapshot.unresolvedRecoveries,
    );
    const otherBefore = recoveryCurrent.value.snapshot.operations.filter(
      (value) => value.recoveryId !== recoveryStarted.recoveryId,
    );
    assert.deepEqual(
      afterRecovery.value.snapshot.operations.filter(
        (value) => value.recoveryId !== recoveryStarted.recoveryId,
      ),
      otherBefore,
    );
    const savedRecoveryBytes = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    // Lease解放を、この途中Ownerで偽装できない。
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "lifecycle",
        { ...lifecycleValue, lease: "released" },
      ),
      false,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      savedRecoveryBytes,
    );
    assert.equal(
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(recoveryPreparation),
      true,
    );
    assert.equal(
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(recoveryPreparation),
      false,
    );
    assert.equal(
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        recoveryPreparation,
        "lifecycle",
        lifecycleValue,
      ),
      false,
    );
    recoveryPreparation = null;
    const reentered = prepareRuntimeOwnedDockerTaskRecovery(
      recoveryStarted.recoveryId,
      verifiedRoot.capability,
    );
    assert.equal(reentered.status, "prepared");
    assert.ok(reentered.capability);
    assert.equal(
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(reentered.capability),
      true,
    );
  } finally {
    if (recoveryPreparation)
      releaseRuntimeOwnedDockerTaskRecoveryPreparation(recoveryPreparation);
    if (!recoveryOwnerAbandoned)
      await abandonOwnedHostOperationGenerationLock(recoveryManagement);
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      recoveryHostBytes,
    );
    const cleanupGeneration = acquireHostOperationRecoveryGeneration(
      verifiedRoot.capability,
      recoveryOwned.hostRecoveryId,
      () => true,
    );
    assert.ok(cleanupGeneration);
    try {
      assert.equal(
        recoverOwnedOperationDirectories(
          recoveryOwned.hostRecoveryId,
          cleanupGeneration,
        ).status,
        "recovered",
      );
    } finally {
      assert.equal(
        releaseHostOperationRecoveryGeneration(cleanupGeneration),
        true,
      );
    }
    assert.equal(fs.existsSync(recoveryOwned.root), false);
    fs.writeFileSync(path.join(area.directory, "state.json"), secondBytes);
  }
  const started = saveOperationStart(
    operationStartInput(management, (result, id, ref) =>
      terminalObservation(result, id, ref),
    ),
    `${JSON.stringify(identity)}\n`,
  );
  assert.equal(started.status, "completed");
  assert.equal(started.snapshotConfirmed, true);
  assert.equal(started.lockReleased, true);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    operationBytes,
  );
  const legacyIdentity = { ...identity } as Record<string, unknown>;
  delete legacyIdentity.consumer;
  const legacyState = JSON.parse(operationBytes.toString("utf8"));
  const legacyJson = `${JSON.stringify(legacyIdentity)}\n`;
  const legacyHash = createHash("sha256").update(legacyJson).digest("hex");
  legacyState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identityJson = legacyJson;
  legacyState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identitySha256 = legacyHash;
  legacyState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).recoveryId =
    `docker-task.${identity.stableLogicalHomeBindingHash}.${identity.operationNonce}.${legacyHash}`;
  const legacyBytes = Buffer.from(`${canonicalJson(legacyState)}\n`);
  for (const fixtureName of ["state.json", "state.pending.json"]) {
    const fixturePath = path.join(area.directory, fixtureName);
    fs.writeFileSync(fixturePath, legacyBytes);
    try {
      const refusedLegacy = saveOperationStart(
        operationStartInput(management, () => null),
        `${JSON.stringify(identity)}\n`,
      );
      assert.equal(refusedLegacy.status, "blocked");
      assert.deepEqual(fs.readFileSync(fixturePath), legacyBytes);
    } finally {
      if (fixtureName === "state.json")
        fs.writeFileSync(fixturePath, operationBytes);
      else fs.unlinkSync(fixturePath);
    }
  }
  const duplicatedStart = saveOperationStart(
    operationStartInput(management, () => null),
    `${JSON.stringify(identity)}\n`,
  );
  assert.equal(duplicatedStart.status, "blocked");
  assert.equal(duplicatedStart.filesystemEffectIssued, false);
  assert.equal(duplicatedStart.recoveryId, started.recoveryId);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    operationBytes,
  );
  const beforeCheckpoint = readState(operationStateInput(management), {
    scope: "operation",
  });
  assert.ok(beforeCheckpoint.value);
  const restartOperation = beforeCheckpoint.value.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(restartOperation);
  const restartScope = "e".repeat(64);
  const restartRequest = {
    requestId: restartRequestIdFixture(
      repository.repositoryBinding,
      restartOperation.identitySha256,
      restartOperation.recoveryId,
      restartScope,
    ),
    scopeSha256: restartScope,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  };
  // 保存値だけを刺激する。Host再起動・Scope承認の実証には使用しない。
  const restartBeforeBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  try {
    for (const [owner, reference, value] of [
      [{}, restartOperation.recoveryId, restartRequest],
      [management, "wrong-recovery", restartRequest],
      [
        management,
        restartOperation.recoveryId,
        { ...restartRequest, requestId: "f".repeat(64) },
      ],
    ]) {
      const refused = saveOperationCheckpoint(
        operationStateInput(owner),
        reference,
        {
          kind: "restart",
          value: value,
        },
      );
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        restartBeforeBytes,
      );
    }
    // 同じ実Ownerの保存接続だけを確認する。fresh Host排他の取得証明ではない。
    for (const [target, before, live] of [
      [repository, restartBeforeBytes, () => false],
      [
        repository,
        restartBeforeBytes,
        () => {
          throw new Error("private owner failure");
        },
      ],
      [
        { ...repository, operationId: "wrong-operation" },
        restartBeforeBytes,
        () => true,
      ],
      [repository, Buffer.from("stale"), () => true],
    ] as const) {
      const refused: ReturnType<typeof saveRecoveryCheckpoint> =
        saveRecoveryCheckpoint(target, restartOperation.recoveryId, before, {
          kind: "restart",
          value: restartRequest,
          assertOwner: live,
        });
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        restartBeforeBytes,
      );
    }
    for (const failure of ["false", "throw"] as const) {
      let ownerChecks = 0;
      const refused: ReturnType<typeof saveRecoveryCheckpoint> =
        saveRecoveryCheckpoint(
          repository,
          restartOperation.recoveryId,
          restartBeforeBytes,
          {
            kind: "restart",
            value: restartRequest,
            assertOwner: () => {
              if (++ownerChecks <= 2) return true;
              if (failure === "throw")
                throw new Error("private late owner failure");
              return false;
            },
          },
        );
      assert.ok(ownerChecks > 2);
      assert.equal(refused.status, "blocked");
      assert.equal(refused.filesystemEffectIssued, false);
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        restartBeforeBytes,
      );
    }
    let successfulOwnerChecks = 0;
    const saved = saveRecoveryCheckpoint(
      repository,
      restartOperation.recoveryId,
      restartBeforeBytes,
      {
        kind: "restart",
        value: restartRequest,
        assertOwner: () => {
          successfulOwnerChecks++;
          return repository.revalidate();
        },
      },
    );
    assert.ok(successfulOwnerChecks > 2);
    assert.equal(saved.status, "completed");
    assert.equal(saved.snapshotConfirmed, true);
    assert.equal(saved.lockReleased, true);
    assert.deepEqual(
      readState(operationStateInput(management), {
        scope: "operation",
      }).value?.snapshot.operations.find((item) => item.kind === "docker_task")
        ?.dockerRestart,
      restartRequest,
    );
    const pendingRestart = {
      ...restartRequest,
      request: "unknown",
      cleanup: "pending",
    };
    assert.equal(
      saveOperationCheckpoint(
        operationStateInput(management),
        restartOperation.recoveryId,
        {
          kind: "restart",
          value: pendingRestart,
        },
      ).status,
      "completed",
    );
    const blockedRestart = {
      ...pendingRestart,
      result: {
        status: "blocked",
        reason: "docker_restart_test_cancelled",
        request: "unknown",
        effectOutcomeUnknown: true,
      },
    };
    assert.equal(
      saveOperationCheckpoint(
        operationStateInput(management),
        restartOperation.recoveryId,
        {
          kind: "restart",
          value: blockedRestart,
        },
      ).status,
      "completed",
    );
    assert.equal(
      saveOperationCheckpoint(
        operationStateInput(management),
        restartOperation.recoveryId,
        {
          kind: "restart",
          value: {
            ...blockedRestart,
            cleanup: "confirmed",
          },
        },
      ).status,
      "completed",
    );
    const restartAfter = readState(operationStateInput(management), {
      scope: "operation",
    });
    assert.deepEqual(
      restartAfter.value?.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      ),
      {
        ...restartOperation,
        dockerRestart: { ...blockedRestart, cleanup: "confirmed" },
      },
    );
    const restartRefusalBefore = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    const restartRefusal = saveOperationCheckpoint(
      operationStateInput(management),
      restartOperation.recoveryId,
      { kind: "restart", value: restartRequest },
    );
    assert.equal(restartRefusal.status, "blocked");
    assert.equal(restartRefusal.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      restartRefusalBefore,
    );
    assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  } finally {
    // 次の独立した故障注入へ、自己生成fixtureの元版を明示的に戻す。
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      restartBeforeBytes,
    );
  }
  const operation = beforeCheckpoint.value.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(operation && operation.kind === "docker_task");
  assert.equal(
    readState(operationStateInput(management), {
      scope: "operation",
    }).value?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === operation.recoveryId,
    )?.resources ?? null,
    null,
    "初回Snapshot未受領は不存在ではない",
  );
  assert.equal(
    readState(operationStateInput({}), {
      scope: "operation",
    }).value?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === operation.recoveryId,
    )?.resources ?? null,
    null,
  );
  assert.equal(
    readState(operationStateInput(management), {
      scope: "operation",
    }).value?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === "other-recovery",
    )?.resources ?? null,
    null,
  );
  const resource = {
    event: "submission",
    key: "create_provider",
    snapshot: resourceFrame.snapshot,
    cleanup: resourceFrame.cleanup,
  };
  const readerInitialBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  try {
    assert.equal(
      saveRecoveryCheckpoint(
        operationStateInput(management),
        operation.recoveryId,
        null,
        { kind: "resource_not_issued", purpose: resource.key },
      ).filesystemEffectIssued,
      false,
    );
    const saved = saveOperationCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      {
        kind: "resource",
        value: resource,
      },
    );
    assert.equal(saved.status, "completed");
    const intentBytes = fs.readFileSync(
      path.join(area.directory, "state.json"),
    );
    for (const [owner, id, key] of [
      [{}, operation.recoveryId, resource.key],
      [management, "other", resource.key],
      [management, operation.recoveryId, "unknown"],
    ]) {
      assert.equal(
        saveRecoveryCheckpoint(operationStateInput(owner), id, null, {
          kind: "resource_not_issued",
          purpose: key,
        }).filesystemEffectIssued,
        false,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(area.directory, "state.json")),
        intentBytes,
      );
    }
    assert.equal(
      saveOperationCheckpoint(
        operationStateInput(management),
        operation.recoveryId,
        {
          kind: "resource",
          value: {
            event: "not_issued",
            key: resource.key,
          },
        },
      ).filesystemEffectIssued,
      false,
      "通常入口では専用未発行許可を代替しない",
    );
    const notIssued = saveRecoveryCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      null,
      { kind: "resource_not_issued", purpose: resource.key },
    );
    assert.equal(notIssued.status, "completed");
    const book =
      readState(operationStateInput(management), {
        scope: "operation",
      }).value?.snapshot.operations.find(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" &&
          item.recoveryId === operation.recoveryId,
      )?.resources ?? null;
    assert.ok(book);
    assert.equal(
      book.checkpoints.find((c) => c.key === resource.key)?.submission,
      "not_issued",
    );
    assert.equal(
      book.snapshot.resources.find((r) => r.key === resource.key)?.identity
        .dockerId,
      null,
    );
    assert.equal(
      saveOperationCheckpoint(
        operationStateInput(management),
        operation.recoveryId,
        {
          kind: "resource",
          value: resource,
        },
      ).filesystemEffectIssued,
      false,
    );
  } finally {
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      readerInitialBytes,
    );
  }
  const intentSaved = saveOperationCheckpoint(
    operationStateInput(management),
    operation.recoveryId,
    {
      kind: "resource",
      value: {
        ...resource,
        snapshot: {
          resources: resource.snapshot.resources.map((r) =>
            r.key === resource.key ? { ...r, request: "unknown" } : r,
          ),
        },
      },
    },
  );
  assert.equal(intentSaved.status, "completed");
  assert.equal(intentSaved.snapshotConfirmed, true);
  assert.equal(intentSaved.lockReleased, true);
  const checkpoint = readState(operationStateInput(management), {
    scope: "operation",
  });
  const checkpointOperation = checkpoint.value?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(
    checkpoint.value &&
      checkpointOperation?.kind === "docker_task" &&
      checkpointOperation.resources,
  );
  assert.equal(
    checkpointOperation.resources.checkpoints.find(
      (c) => c.key === resource.key,
    )?.submission,
    "intent_saved",
  );
  assert.equal(
    checkpointOperation.resources.snapshot.resources.find(
      (r) => r.key === resource.key,
    )?.request,
    "unknown",
  );
  const resourceReaderBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  try {
    for (const selected of RESOURCE_KEYS)
      for (const state of [
        "none",
        "intent_saved",
        "not_issued",
        "receipt",
      ] as const) {
        const planned = createResourceBookFixture(
          identity.ownershipLabel,
          "planned",
          RESOURCE_KEYS,
        );
        const book: OperationResources = {
          ...planned,
          snapshot: {
            resources: planned.snapshot.resources.map((r) =>
              r.key === selected
                ? {
                    ...r,
                    request:
                      state === "receipt"
                        ? "issued"
                        : state === "intent_saved"
                          ? "unknown"
                          : "not_issued",
                    identity: {
                      ...r.identity,
                      dockerId: state === "receipt" ? "a".repeat(64) : null,
                    },
                  }
                : r,
            ),
          },
          checkpoints: planned.checkpoints.map((c) =>
            c.key === selected
              ? {
                  ...c,
                  submission: state === "receipt" ? "intent_saved" : state,
                  receiptSource:
                    state === "receipt" ? "docker_create_result" : null,
                }
              : c,
          ),
        };
        fs.writeFileSync(
          path.join(area.directory, "state.json"),
          `${canonicalJson({
            ...checkpoint.value.snapshot,
            operations: checkpoint.value.snapshot.operations.map((item) =>
              item.recoveryId === checkpointOperation.recoveryId
                ? { ...checkpointOperation, resources: book }
                : item,
            ),
          })}\n`,
        );
        assert.deepEqual(
          readState(operationStateInput(management), {
            scope: "operation",
          }).value?.snapshot.operations.find(
            (item): item is ExecutionOperationRecord =>
              item.kind === "docker_task" &&
              item.recoveryId === operation.recoveryId,
          )?.resources ?? null,
          book,
        );
      }
    const original = checkpointOperation.resources;
    for (const invalid of [
      {
        ...original,
        snapshot: { resources: original.snapshot.resources.slice(1) },
      },
      {
        ...original,
        checkpoints: original.checkpoints.map((c, i) =>
          i === 1 ? original.checkpoints[0] : c,
        ),
      },
      {
        ...original,
        snapshot: {
          resources: original.snapshot.resources.map((r, i) =>
            i === 0
              ? { ...r, identity: { ...r.identity, dockerId: "invalid" } }
              : r,
          ),
        },
      },
    ]) {
      fs.writeFileSync(
        path.join(area.directory, "state.json"),
        `${canonicalJson({
          ...checkpoint.value.snapshot,
          operations: checkpoint.value.snapshot.operations.map((item) =>
            item.recoveryId === checkpointOperation.recoveryId
              ? { ...checkpointOperation, resources: invalid }
              : item,
          ),
        })}\n`,
      );
      assert.equal(
        readState(operationStateInput(management), {
          scope: "operation",
        }).value?.snapshot.operations.find(
          (item): item is ExecutionOperationRecord =>
            item.kind === "docker_task" &&
            item.recoveryId === operation.recoveryId,
        )?.resources ?? null,
        null,
      );
    }
  } finally {
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      resourceReaderBytes,
    );
  }
  const cleanupObservations = checkpointOperation.resources.checkpoints.map(
    (c) => ({
      key: c.key,
      observation:
        c.submission === "intent_saved" ? "unknown" : "not_requested",
    }),
  );
  const cleanupSaved = saveOperationCheckpoint(
    operationStateInput(management),
    operation.recoveryId,
    {
      kind: "cleanup",
      value: {
        snapshot: checkpointOperation.resources.snapshot,
        observations: cleanupObservations,
      },
    },
  );
  assert.equal(cleanupSaved.status, "completed");
  assert.equal(cleanupSaved.snapshotConfirmed, true);
  assert.equal(cleanupSaved.lockReleased, true);
  const afterCleanup = readState(operationStateInput(management), {
    scope: "operation",
  });
  assert.equal(
    afterCleanup.value?.snapshot.revision,
    checkpoint.value.snapshot.revision + 1,
  );
  const afterHost = afterCleanup;
  const lifecycle = {
    phase: "settling",
    lease: operation.lease,
    execution: {
      ...operation.execution,
      providerStart: "unknown",
      externalSend: "unknown",
      sharedWrite: "unknown",
      ownerEffect: "unknown",
    },
    primaryFailure: {
      purpose: "create_provider",
      stage: "command_wait",
      reason: "provider_result_invalid",
      exceptionCode: null,
      commandObservation: { exitCode: 1, stdoutBytes: 12, stderrBytes: 7 },
      commandHandleObtained: true,
      responseObserved: true,
      receiptRecorded: false,
    },
    outcome: {
      status: "blocked",
      reason: "provider_result_invalid",
      cleanupConfirmed: false,
    },
    summarySha256: null,
  };
  const savedLifecycle = saveOperationCheckpoint(
    operationStateInput(management),
    operation.recoveryId,
    { kind: "lifecycle", value: lifecycle },
  );
  assert.equal(savedLifecycle.status, "completed");
  assert.equal(savedLifecycle.snapshotConfirmed, true);
  assert.equal(savedLifecycle.lockReleased, true);
  const afterLifecycle = readState(operationStateInput(management), {
    scope: "operation",
  });
  assert.equal(
    afterLifecycle.value?.snapshot.revision,
    (afterHost.value?.snapshot.revision ?? 0) + 1,
  );
  assert.deepEqual(
    afterLifecycle.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.primaryFailure,
    lifecycle.primaryFailure,
  );
  assert.deepEqual(
    afterLifecycle.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
    afterHost.value?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
  );
  assert.deepEqual(
    afterLifecycle.value?.snapshot.operations.filter(
      (item) => item.kind === "host_operation",
    ),
    afterHost.value?.snapshot.operations.filter(
      (item) => item.kind === "host_operation",
    ),
  );
  const references = {
    recovery: {
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      reason: "provider_result_invalid",
      obligations: ["docker_resources"],
    },
    deliveries: [
      {
        operationNonce: identity.operationNonce,
        recoveryId: operation.recoveryId,
        resultId: "b".repeat(64),
        consumer: "orchestrator",
        acceptanceSha256: null as string | null,
      },
    ],
  };
  const acceptedReferences = {
    ...references,
    deliveries: references.deliveries.map((item) => ({
      ...item,
      acceptanceSha256: "c".repeat(64),
    })),
  };
  const beforeReferenceUpdates = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  for (const value of [references, acceptedReferences]) {
    const savedReferences = saveOperationCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      { kind: "references", value: value },
    );
    assert.equal(savedReferences.status, "blocked");
    assert.equal(savedReferences.snapshotConfirmed, false);
    assert.equal(savedReferences.filesystemEffectIssued, false);
    assert.equal(savedReferences.lockReleased, true);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      beforeReferenceUpdates,
    );
  }
  const savedRecoveryOnly = saveOperationCheckpoint(
    operationStateInput(management),
    operation.recoveryId,
    {
      kind: "references",
      value: { recovery: references.recovery },
    },
  );
  assert.equal(savedRecoveryOnly.status, "completed", savedRecoveryOnly.reason);
  assert.equal(savedRecoveryOnly.snapshotConfirmed, true);
  assert.equal(savedRecoveryOnly.lockReleased, true);
  const afterReferences = readState(operationStateInput(management), {
    scope: "operation",
  });
  assert.equal(
    afterReferences.value?.snapshot.revision,
    (afterLifecycle.value?.snapshot.revision ?? 0) + 1,
  );
  assert.equal(
    Object.hasOwn(afterReferences.value.snapshot, "pendingDeliveries"),
    false,
  );
  assert.deepEqual(
    afterReferences.value?.snapshot.operations,
    afterLifecycle.value?.snapshot.operations,
  );
  const checkpointBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  for (const [owner, ref, update] of [
    [{}, operation.recoveryId, resource],
    [management, `${operation.recoveryId}0`, resource],
    [management, operation.recoveryId, resource],
  ]) {
    const rejectedCheckpoint = saveOperationCheckpoint(
      operationStateInput(owner),
      ref,
      {
        kind: "resource",
        value: update,
      },
    );
    assert.equal(rejectedCheckpoint.status, "blocked");
    assert.equal(rejectedCheckpoint.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  for (const invalidValues of [
    null,
    cleanupObservations.slice(1),
    cleanupObservations.map((item) => ({ ...item, observation: "absent" })),
  ]) {
    const rejected = saveOperationCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      {
        kind: "cleanup",
        value: invalidValues,
      },
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  for (const invalid of [
    { ...lifecycle, primaryFailure: null },
    { ...lifecycle, execution: operation.execution },
    { phase: "settling" },
    { ...lifecycle, recoveryId: operation.recoveryId },
  ]) {
    const rejected = saveOperationCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      {
        kind: "lifecycle",
        value: invalid,
      },
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  for (const invalid of [
    { recovery: null, deliveries: [] },
    references,
    {
      ...acceptedReferences,
      deliveries: acceptedReferences.deliveries.map((item) => ({
        ...item,
        resultId: "d".repeat(64),
      })),
    },
  ]) {
    const rejected = saveOperationCheckpoint(
      operationStateInput(management),
      operation.recoveryId,
      {
        kind: "references",
        value: invalid,
      },
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      checkpointBytes,
    );
  }
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  const simulatedCompletion = Object.freeze({
    fixture: "docker-terminal",
    status: "blocked",
    reason: "provider_result_invalid",
    cleanupConfirmed: true,
  });
  const transientRecoveryIds = new Set<string>();
  const terminalObservation = (result: unknown, id: unknown, ref: unknown) => {
    if (
      result !== simulatedCompletion ||
      id !== repository.operationId ||
      (ref !== operation.recoveryId &&
        (typeof ref !== "string" || !transientRecoveryIds.has(ref)))
    )
      return null;
    return Object.freeze({
      // この正常終端fixtureはSnapshot受領も外部要求もない元版を使う。
      resourceSnapshot: null,
      resources: resourceFrame.checkpoints.map((item) => ({
        key: item.key,
        observation: "not_requested",
      })),
      homeLeaseReleased: true,
      recoveryCompleted: true,
      primaryFailure: lifecycle.primaryFailure,
    });
  };

  // 開始時に元Ownerへ固定した同じ終端Contextを使用する。
  fs.writeFileSync(path.join(area.directory, "state.json"), operationBytes);
  const settlement = started.completionContext;
  assert.ok(settlement);
  closeUnissuedFixtureOperations(management);
  const cleanupOutcome = await cleanupOwnedOperationDirectories(owned);
  isCleaned = true;
  const settled = completeOperation(
    settlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(settled.status, "completed", settled.reason);
  assert.equal(settled.snapshotConfirmed, true);
  assert.equal(settled.lockReleased, true);
  assert.equal(Object.hasOwn(settled, "deliveryPending"), false);
  const settledRead = readState(verifiedRoot.capability, {
    scope: "recovery",
    input: {
      kind: "history",
    },
  });
  assert.equal(settledRead.status, "completed");
  assert.equal(settledRead.lockReleased, true);
  const settledOperation = settledRead.value?.snapshot.operations.find(
    (item) => item.recoveryId === operation.recoveryId,
  );
  assert.equal(settledOperation, undefined);
  assert.equal(settledRead.historyRows?.[0]?.recoveryId, operation.recoveryId);
  assert.equal(
    Object.hasOwn(settledRead.value.snapshot, "pendingDeliveries"),
    false,
  );
  const historyFile = path.join(area.directory, "history.jsonl");
  assert.equal(settledRead.historyRows?.length, 1);
  assert.equal(
    readState(operationStateInput(management), { scope: "operation" }).status,
    "blocked",
  );
  const settledAgain = completeOperation(
    settlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(settledAgain.status, "completed");
  assert.equal(settledAgain.snapshotConfirmed, true);
  assert.equal(settledAgain.lockReleased, true);
  assert.equal(Object.hasOwn(settledAgain, "deliveryPending"), false);
  assert.deepEqual(
    readState(verifiedRoot.capability, { scope: "recovery" }).value,
    settledRead.value,
  );
  fs.unlinkSync(historyFile);
  // 終端観測の区間を閉じてから、同じOwnerの清掃証拠を別区間で差し替える。
  // 初回開始は空Snapshotを別保存せず、同じ操作を含む初版を確定する。
  const freshRoot = path.join(root, "fresh-start");
  execFileSync("git", ["init", "--quiet", freshRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      freshRoot,
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
  let freshValidBytes: Buffer | null = null;
  let freshManagementForCleanup: object | null = null;
  const freshOwned = createOwnedOperationDirectories({
    root:
      getRepository(freshRoot).capability ??
      assert.fail("fixture_repository_missing"),
    purpose: "task",
    recordingCurrent: () => true,
  });
  try {
    const freshManagement = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(freshOwned),
      createOwnedMountCapability(freshOwned),
    );
    freshManagementForCleanup = freshManagement;
    assert.ok(bindRuntimeOwnedRepositoryOperation(freshManagement, freshRoot));
    const freshRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(freshManagement);
    assert.ok(freshRepository);
    const startPlan = {
      provider: "claude" as const,
      consumer: "orchestrator" as const,
      operationId: freshRepository.operationId,
      executionSelection: identity.executionSelection,
      taskAttempt: identity.taskAttempt,
      stableLogicalHomeBindingHash: identity.stableLogicalHomeBindingHash,
      providerHomeIdentityHash: identity.providerHomeIdentityHash,
      authContainerName: resourceName("create_subscription_auth_probe"),
      providerContainerName: resourceName("create_provider"),
      proxyContainerName: resourceName("create_proxy"),
      internalNetworkName: resourceName("create_internal_network"),
      egressNetworkName: resourceName("create_egress_network"),
      ownershipLabel: identity.ownershipLabel,
      providerImageDigest: `sha256:${"a".repeat(64)}`,
      proxyImageDigest: `sha256:${"b".repeat(64)}`,
      operationMode: "isolated_task" as const,
      workspaceMountMode: "read_write" as const,
    };
    const freshIdentity = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      startPlan,
      freshManagement,
      "b".repeat(64),
      "orchestrator",
    );
    assert.ok(freshIdentity);
    const freshIdentityValue = JSON.parse(freshIdentity);
    assert.equal(freshIdentityValue.consumer, startPlan.consumer);
    assert.equal(
      freshIdentityValue.operationId,
      readOwnedHostOperation(freshManagement).record.operationId,
    );
    assert.equal(
      path.relative(freshRoot, freshOwned.root).startsWith(".."),
      false,
    );
    assert.equal(
      freshIdentityValue.repositoryBinding,
      freshRepository.repositoryBinding,
    );
    assert.equal(
      Object.hasOwn(freshIdentityValue, "runtimeStateBinding"),
      false,
    );
    assert.equal(
      Object.hasOwn(freshIdentityValue, "initialHostRecoveryId"),
      false,
    );
    assert.equal(Object.hasOwn(freshIdentityValue, "hostPaths"), false);
    for (const [plan, owner, nonce] of [
      [startPlan, null, "b".repeat(64)],
      [startPlan, { ...freshManagement }, "b".repeat(64)],
      [
        { ...startPlan, operationId: "OP-999999" },
        freshManagement,
        "b".repeat(64),
      ],
      [startPlan, freshManagement, "invalid"],
      ...[
        "authContainerName",
        "providerContainerName",
        "proxyContainerName",
        "internalNetworkName",
        "egressNetworkName",
        "ownershipLabel",
        "providerImageDigest",
        "proxyImageDigest",
      ].map(
        (key) =>
          [
            // この境界は所在文字列の欠測を拒否し、Docker構成の検査はDIが所有する。
            { ...startPlan, [key]: null },
            freshManagement,
            "b".repeat(64),
          ] as const,
      ),
      [
        {
          ...startPlan,
          executionSelection: {
            ...startPlan.executionSelection,
            provider: "codex" as const,
          },
        },
        freshManagement,
        "b".repeat(64),
      ],
    ] as const) {
      assert.equal(
        prepareRuntimeOwnedRepositoryDockerOperationIdentity(
          plan,
          owner,
          nonce,
          "orchestrator",
        ),
        null,
      );
    }
    // Identity構築は値の搬送だけを行い、資源Labelの形式は保存受付で拒否する。
    const invalidLabelIdentity =
      prepareRuntimeOwnedRepositoryDockerOperationIdentity(
        { ...startPlan, ownershipLabel: "invalid" },
        freshManagement,
        "b".repeat(64),
        "orchestrator",
      );
    assert.ok(invalidLabelIdentity);
    const beforeInvalidLabel = readState(operationStateInput(freshManagement), {
      scope: "operation",
    });
    assert.equal(beforeInvalidLabel.status, "completed");
    const invalidLabelStart = saveOperationStart(
      operationStartInput(freshManagement, () => null),
      invalidLabelIdentity,
    );
    assert.equal(invalidLabelStart.status, "blocked");
    assert.equal(invalidLabelStart.filesystemEffectIssued, false);
    assert.deepEqual(
      readState(operationStateInput(freshManagement), { scope: "operation" }),
      beforeInvalidLabel,
    );
    for (const consumer of [
      undefined,
      null,
      "unknown",
      "coordinator_cli",
      "workbench",
    ]) {
      assert.equal(
        prepareRuntimeOwnedRepositoryDockerOperationIdentity(
          startPlan,
          freshManagement,
          "b".repeat(64),
          consumer,
        ),
        null,
      );
    }
    for (const consumer of [
      undefined,
      null,
      "unknown",
      "coordinator_cli",
      "workbench",
    ]) {
      assert.equal(
        prepareRuntimeOwnedRepositoryDockerOperationIdentity(
          { ...startPlan, consumer } as never,
          freshManagement,
          "b".repeat(64),
          "orchestrator",
        ),
        null,
      );
    }
    const freshBeforeStart = readState(operationStateInput(freshManagement), {
      scope: "operation",
    }).value;
    assert.ok(freshBeforeStart);
    const freshStarted = saveOperationStart(
      operationStartInput(freshManagement, () => null),
      freshIdentity,
    );
    assert.equal(freshStarted.status, "completed", freshStarted.reason);
    assert.equal(
      freshStarted.snapshotConfirmed,
      true,
      JSON.stringify(freshStarted),
    );
    assert.equal(freshStarted.lockReleased, true, JSON.stringify(freshStarted));
    assert.ok(freshStarted.recoveryId);
    const freshArea = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        freshRoot,
        "execution-model",
      ),
      "fresh_state_root",
    );
    const freshStateFile = path.join(freshArea.directory, "state.json");
    freshValidBytes = fs.readFileSync(freshStateFile);
    const freshState = JSON.parse(freshValidBytes.toString("utf8"));
    assert.deepEqual(freshState, {
      ...freshBeforeStart.snapshot,
      revision: freshBeforeStart.snapshot.revision + 1,
      previous: {
        revision: freshBeforeStart.snapshot.revision,
        payloadSha256: freshBeforeStart.payloadSha256,
      },
      operations: [
        ...freshBeforeStart.snapshot.operations,
        {
          kind: "docker_task",
          dockerRestart: null,
          identityJson: freshIdentity,
          identitySha256: createHash("sha256")
            .update(freshIdentity)
            .digest("hex"),
          recoveryId: freshStarted.recoveryId,
          phase: "executing",
          resources: null,
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
          history: null,
        },
      ],
      unresolvedRecoveries: [],
    });
    assert.equal(
      readState(operationStateInput(freshManagement), { scope: "operation" })
        .value?.snapshot.revision,
      freshBeforeStart.snapshot.revision + 1,
    );
    assert.deepEqual(fs.readdirSync(freshArea.directory), ["state.json"]);
    // Identityに技術資源を復元せず、現在の公開通知保存で同じFrameを登録する。
    for (const resource of resourceFrame.snapshot.resources) {
      assert.equal(
        resource.identity.ownershipLabel,
        freshIdentityValue.ownershipLabel,
      );
      assert.equal(resource.identity.dockerId, null);
      assert.equal(resource.request, "not_issued");
      const submitted = saveOperationCheckpoint(
        operationStateInput(freshManagement),
        freshStarted.recoveryId,
        {
          kind: "resource",
          value: {
            event: "submission",
            key: resource.key,
            snapshot: resourceFrame.snapshot,
            cleanup: resourceFrame.cleanup,
          },
        },
      );
      assert.equal(submitted.status, "completed");
      assert.equal(submitted.snapshotConfirmed, true);
      assert.equal(submitted.lockReleased, true);
    }
    fs.writeFileSync(freshStateFile, "invalid-state");
    const unreadableStarted = saveOperationStart(
      operationStartInput(freshManagement, () => null),
      `${JSON.stringify({ ...identity, operationId: freshRepository.operationId, repositoryBinding: freshRepository.repositoryBinding, operationNonce: "e".repeat(64) })}\n`,
    );
    assert.equal(unreadableStarted.status, "blocked");
    assert.equal(unreadableStarted.filesystemEffectIssued, false);
    assert.equal(unreadableStarted.snapshotConfirmed, false);
    assert.ok(unreadableStarted.recoveryId);
    assert.equal(fs.readFileSync(freshStateFile, "utf8"), "invalid-state");
    assert.deepEqual(fs.readdirSync(freshArea.directory), ["state.json"]);
  } finally {
    if (freshValidBytes)
      fs.writeFileSync(
        path.join(freshRoot, ".crdd", "execution-model", "state.json"),
        freshValidBytes,
      );
    // 全Effectが代役のこの区間だけ、正常な未発行断面を復元して閉じる。
    closeUnissuedFixtureOperations(
      freshManagementForCleanup ?? assert.fail("fixture_management_missing"),
    );
    cleanupOwnedOperationDirectories(freshOwned);
  }
  const failedRoot = path.join(root, "failed-start");
  execFileSync("git", ["init", "--quiet", failedRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      failedRoot,
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
  const failedOwned = createOwnedOperationDirectories({
    root:
      getRepository(failedRoot).capability ??
      assert.fail("fixture_repository_missing"),
    purpose: "task",
    recordingCurrent: () => true,
  });
  const originalFailedRename = fs.renameSync;
  const failedArea = path.join(failedRoot, ".crdd", "execution-model");
  const failedStateFile = path.join(failedArea, "state.json");
  const failedHostBytes = fs.readFileSync(failedStateFile);
  let failedPendingBytes: Buffer | null = null;
  let isWriterRefused = false;
  try {
    const failedManagement = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(failedOwned),
      createOwnedMountCapability(failedOwned),
    );
    assert.ok(
      bindRuntimeOwnedRepositoryOperation(failedManagement, failedRoot),
    );
    const failedRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(failedManagement);
    assert.ok(failedRepository);
    const failedIdentity = `${JSON.stringify({ ...identity, operationId: failedRepository.operationId, repositoryBinding: failedRepository.repositoryBinding })}\n`;
    fs.renameSync = new Proxy(originalFailedRename, {
      apply: (fn, receiver, args) => {
        if (args[1] === failedStateFile) {
          isWriterRefused = true;
          failedPendingBytes = fs.readFileSync(String(args[0]));
          throw Object.assign(Error("fixture_publication_refused"), {
            code: "EIO",
          });
        }
        return Reflect.apply(fn, receiver, args);
      },
    });
    const failedStart = saveOperationStart(
      operationStartInput(failedManagement, () => null),
      failedIdentity,
    );
    assert.equal(isWriterRefused, true);
    assert.equal(failedStart.status, "blocked");
    assert.equal(failedStart.snapshotConfirmed, false);
    assert.equal(failedStart.filesystemEffectIssued, true);
    assert.equal(failedStart.lockReleased, true);
    assert.ok(failedStart.recoveryId);
    assert.deepEqual(fs.readFileSync(failedStateFile), failedHostBytes);
    const observedPending: unknown = failedPendingBytes;
    assert.ok(Buffer.isBuffer(observedPending));
    const pending = JSON.parse(observedPending.toString("utf8"));
    const before = JSON.parse(failedHostBytes.toString("utf8"));
    assert.equal(pending.revision, before.revision + 1);
    assert.deepEqual(pending.previous, {
      revision: before.revision,
      payloadSha256: createHash("sha256").update(failedHostBytes).digest("hex"),
    });
    assert.deepEqual(
      pending.operations.filter(
        (item: { kind: string }) => item.kind === "host_operation",
      ),
      before.operations,
    );
    assert.equal(
      pending.operations.find(
        (item: { kind: string }) => item.kind === "docker_task",
      )?.identityJson,
      failedIdentity,
    );
  } finally {
    fs.renameSync = originalFailedRename;
    if (failedPendingBytes) {
      const pendingFile = path.join(failedArea, "state.pending.json");
      assert.deepEqual(fs.readFileSync(pendingFile), failedPendingBytes);
      fs.unlinkSync(pendingFile);
    }
    // この故障区間はDocker未発行。元のHost-only断面を戻して試験物だけを閉じる。
    fs.writeFileSync(failedStateFile, failedHostBytes);
    cleanupOwnedOperationDirectories(failedOwned);
  }
  assert.deepEqual(fs.readdirSync(failedArea), ["state.json"]);
});

/**
 * 保存済み上位受理の同期Readerを固定されたTask結合で確認する。
 * @responsibility 上位Readerの戻り値を模擬し、受理本文・世代・Attempt照合を検証する。
 * @trace ERB-IT-003
 * @precondition 上位保存結果だけを模擬し、DockerやProviderを起動しない。
 * @stimulus 新形式ACK、後続世代、別Task、旧形式、読取り失敗を与える。
 * @observation 固定された読取り引数、返却本文、null拒否、入力の非変更。
 * @oracle 保存確認済みの同じAttemptの十一項目だけを返す。
 * @cleanup 試験スコープのModule mockを復元する。
 * @boundary ERB-IT-003=Direct Boundary: 上位保存Reader→終端受理Reader。
 */
/**
 * 確定未発行と発行済み既知失敗の再起動結果を実保存からTask終了へ接続する。
 * @responsibility 過去unknownを保持し、実Host清掃・履歴・transient操作除去を一つの入口で確認する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition 自己生成Repository、未要求五資源、真正OwnerとWindows実排他を使う。
 * @stimulus 段階checkpoint、Owner解放、未発行／発行済み失敗の合成DI結果を実finalizeへ渡し公開回収を一回呼ぶ。
 * @observation 実Reader全文・Hash、Host／marker不存在、履歴一件、操作除去、再要求禁止。
 * @oracle 再起動blockedを維持したままTask回収だけが成立し、Docker実行を必要としない。
 * @cleanup 自己生成Rootだけを回収し不存在を確認する。
 * @boundary 実Writer／Kernel／Host／履歴。DI技術結果は合成で実再起動を証明しない。
 */
for (const issuedFailure of [false, true]) {
  /**
   * 確定未発行と発行済み既知失敗の再起動結果を実保存からTask終了へ接続する。
   * @responsibility 過去unknownを保持し、実Host清掃・履歴・transient操作除去を一つの入口で確認する。
   * @trace ERB-IT-003
   * @trace ERB-IT-014
   * @precondition 自己生成Repository、未要求五資源、真正OwnerとWindows実排他を使う。
   * @stimulus 段階checkpoint、Owner解放、未発行／発行済み失敗の合成DI結果を実finalizeへ渡し公開回収を一回呼ぶ。
   * @observation 実Reader全文・Hash、Host／marker不存在、履歴一件、操作除去、再要求禁止。
   * @oracle 再起動blockedを維持したままTask回収だけが成立し、Docker実行を必要としない。
   * @cleanup 自己生成Rootだけを回収し不存在を確認する。
   * @boundary 実Writer／Kernel／Host／履歴。DI技術結果は合成で実再起動を証明しない。
   */
  test(`Host Windows: 再起動${issuedFailure ? "発行済み既知失敗" : "未発行の確定結果"}を実履歴とTask終了へ接続する`, async (t) => {
    const restartReason = issuedFailure
      ? "docker_restart_start_unconfirmed"
      : "docker_restart_stop_unconfirmed";
    assert.equal(process.platform, "win32");
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "restart_unissued_test",
    );
    const root = fs.mkdtempSync(path.join(area.directory, "restart-unissued-"));
    useFixtureRuntimeDirectories(t, root);
    let owned: ReturnType<typeof createOwnedOperationDirectories> | null = null;
    let active = false;
    let management: object | null = null;
    t.after(async () => {
      if (active && management)
        await abandonOwnedHostOperationGenerationLock(management);
      if (owned && fs.existsSync(owned.root))
        cleanupOwnedOperationDirectories(owned);
      assert.equal(fs.realpathSync(root), root);
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(fs.existsSync(root), false);
    });
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
    owned = createOwnedOperationDirectories({
      root:
        getRepository(root).capability ??
        assert.fail("fixture_repository_missing"),
      purpose: "task",
      recordingCurrent: () => true,
    });
    management = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(owned),
      createOwnedMountCapability(owned),
    );
    assert.ok(bindRuntimeOwnedRepositoryOperation(management, root));
    const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
    assert.ok(repository);
    const verified = getRepository(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const identity = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      {
        provider: "claude",
        consumer: "workbench",
        operationId: repository.operationId,
        executionSelection: executionSelection("executor", {
          provider: "claude",
          model: "opus",
          effort: "low",
        }),
        taskAttempt: 0 as const,
        stableLogicalHomeBindingHash: "c".repeat(64),
        providerHomeIdentityHash: "8".repeat(64),
        authContainerName: "crdd-auth-0123456789abcdef",
        providerContainerName: "crdd-claude-0123456789abcdef",
        proxyContainerName: "crdd-proxy-0123456789abcdef",
        internalNetworkName: "crdd-internal-0123456789abcdef",
        egressNetworkName: "crdd-egress-0123456789abcdef",
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
        providerImageDigest: `sha256:${"a".repeat(64)}`,
        proxyImageDigest: `sha256:${"b".repeat(64)}`,
        operationMode: "workbench_advice",
        workspaceMountMode: null,
      },
      management,
      "b".repeat(64),
      "workbench",
    );
    assert.ok(identity);
    const start = saveOperationStart(
      operationStartInput(management, () => null),
      identity,
    );
    assert.equal(start.status, "completed");
    assert.ok(start.recoveryId);
    active = true;
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    active = false;
    const preparation = prepareRuntimeOwnedDockerRestart(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(preparation.status, "prepared");
    assert.ok(preparation.capability);
    const initialHosts = readState(verified.capability, {
      scope: "recovery",
    }).value?.snapshot.operations.filter(
      (item) => item.kind === "host_operation",
    );
    assert.ok(initialHosts);
    const technical = {
      requestId: preparation.requestId,
      status: "blocked" as const,
      reason: restartReason,
      request: issuedFailure ? ("issued" as const) : ("not_issued" as const),
      primaryFailure: restartReason,
      stopFailure: null,
      startFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: true,
      restartCompleted: false,
      effectOutcomeUnknown: false,
      startupElapsedMs: null,
      delivery: "confirmed" as const,
    };
    let released = false;
    try {
      for (const request of issuedFailure
        ? (["not_issued", "unknown", "issued"] as const)
        : (["not_issued", "unknown"] as const)) {
        const previous: ReturnType<typeof readState> = readState(
          verified.capability,
          { scope: "recovery" },
        );
        assert.equal(previous.status, "completed");
        assert.ok(previous.value);
        assert.equal(
          persistRuntimeOwnedDockerRestartCheckpoint(preparation.capability, {
            requestId: preparation.requestId,
            scopeSha256: preparation.scopeSha256,
            request,
            cleanup: request === "not_issued" ? "not_required" : "pending",
            result: null,
          }),
          true,
        );
        const next: ReturnType<typeof readState> = readState(
          verified.capability,
          { scope: "recovery" },
        );
        assert.equal(next.status, "completed");
        assert.ok(next.value);
        assert.deepEqual(next.value.snapshot, {
          ...previous.value.snapshot,
          revision: previous.value.snapshot.revision + 1,
          previous: {
            revision: previous.value.snapshot.revision,
            payloadSha256: previous.value.payloadSha256,
          },
          operations: previous.value.snapshot.operations.map(
            (item): OperationRecord =>
              item.kind === "docker_task" &&
              item.recoveryId === start.recoveryId
                ? {
                    ...item,
                    dockerRestart: {
                      requestId: preparation.requestId,
                      scopeSha256: preparation.scopeSha256,
                      request,
                      cleanup:
                        request === "not_issued" ? "not_required" : "pending",
                      result: null,
                    },
                  }
                : item,
          ),
        });
        assert.deepEqual(
          next.value.snapshot.operations.filter(
            (item) => item.kind === "host_operation",
          ),
          initialHosts,
        );
      }
      const beforeRelease = fs.readFileSync(
        path.join(root, ".crdd", "execution-model", "state.json"),
      );
      assert.equal(
        finalizeRuntimeOwnedDockerRestartPreparation(
          preparation.capability,
          technical,
        ).status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
        ),
        beforeRelease,
      );
      assert.equal(
        releaseRuntimeOwnedDockerRestartPreparation(preparation.capability),
        true,
      );
      released = true;
      const finalized = finalizeRuntimeOwnedDockerRestartPreparation(
        preparation.capability,
        technical,
      );
      assert.equal(finalized.status, "completed");
      assert.equal(finalized.snapshotConfirmed, true);
      assert.equal(finalized.lockReleased, true);
      assert.equal(finalized.cleanupConfirmed, true);
      const terminalBytes = fs.readFileSync(
        path.join(root, ".crdd", "execution-model", "state.json"),
      );
      assert.equal(
        finalizeRuntimeOwnedDockerRestartPreparation(
          preparation.capability,
          technical,
        ).status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
        ),
        terminalBytes,
      );
    } finally {
      if (!released)
        releaseRuntimeOwnedDockerRestartPreparation(preparation.capability);
    }
    const saved = readState(verified.capability, { scope: "recovery" });
    assert.equal(saved.status, "completed");
    assert.ok(saved.value);
    const checkpoint = saved.value.snapshot.operations.find(
      (
        x,
      ): x is import("../../../execution-model/src/index.ts").ExecutionOperationRecord =>
        x.kind === "docker_task" && x.recoveryId === start.recoveryId,
    )?.dockerRestart;
    assert.deepEqual(checkpoint, {
      requestId: preparation.requestId,
      scopeSha256: preparation.scopeSha256,
      request: issuedFailure ? "issued" : "unknown",
      cleanup: "confirmed",
      result: {
        status: "blocked",
        reason: restartReason,
        request: issuedFailure ? "issued" : "not_issued",
        effectOutcomeUnknown: false,
      },
    });
    const repeated = prepareRuntimeOwnedDockerRestart(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(repeated.status, "prepared");
    assert.ok(repeated.capability);
    try {
      assert.equal(repeated.alreadyRequested, true);
      assert.equal(repeated.requestId, preparation.requestId);
      assert.equal(repeated.scopeSha256, preparation.scopeSha256);
      assert.deepEqual(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
        ),
        Buffer.from(saved.value.sourceText, "utf8"),
      );
    } finally {
      assert.equal(
        releaseRuntimeOwnedDockerRestartPreparation(repeated.capability),
        true,
      );
    }
    const result = await recoverRuntimeOwnedDockerTaskForCurrentConsumer(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(result.status, "recovered", result.reason);
    assert.equal(result.taskRecoveryCompleted, true);
    assert.equal(result.historyConfirmed, true);
    assert.equal(result.operationRemovalConfirmed, true);
    assert.equal(result.dockerCleanupConfirmed, true);
    assert.equal(result.hostCleanupConfirmed, true);
    assert.equal(result.locksReleased, true);
    assert.equal(fs.existsSync(owned.root), false);
    const after = readState(verified.capability, { scope: "recovery" });
    assert.equal(after.status, "completed");
    assert.equal(after.lockReleased, true);
    assert.ok(after.value);
    const endedHost = after.value.snapshot.operations.find(
      (item) => item.kind === "host_operation",
    );
    assert.ok(endedHost);
    assert.equal(endedHost.phase, "terminal");
    assert.equal(endedHost.cleanup, "confirmed");
    assert.deepEqual(after.value.snapshot.operations, [endedHost]);
    assert.deepEqual(after.value.snapshot.unresolvedRecoveries, []);
    assert.equal(
      Object.hasOwn(after.value.snapshot, "pendingDeliveries"),
      false,
    );
    const rows = fs
      .readFileSync(
        path.join(root, ".crdd", "execution-model", "history.jsonl"),
        "utf8",
      )
      .trim()
      .split("\n");
    assert.equal(rows.length, 1);
    const summary = JSON.parse(rows[0] ?? "").summary;
    assert.equal(summary.schema, "crdd-execution-model/operation-summary/v6");
    assert.deepEqual(summary.dockerRestart, checkpoint);
    assert.equal(summary.primaryFailure, null);
    assert.equal(summary.outcome.status, "blocked");
  });
}

/**
 * 専用auth不存在の候補を実Root・既存Kernel・固定File保存へ結合する。
 * @responsibility 模擬した過去観測を実保存の成立と区別し、CAS・Owner拒否と読戻しを確認する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition Repository-localの自己生成Git Rootと合成したcodec合法状態だけを使う。
 * @stimulus 別operationId、Owner失効、元版差、rename故障と再入場後、本番Driver本文の観測順と保存停止を確認する。
 * @observation state全文、revision、Hash、短命File不存在、Kernel排他解放と実履歴・transient終了出版。
 * @oracle 拒否時の本文不変、成功時のauth以外全文不変とunknown維持。
 * @cleanup 自作Rootだけを回収し不存在を確認する。
 * @boundary 実Root／Kernel／Filesystemと本番Driver本文・履歴／終了出版。Owner生存・Host終了値・Docker観測・再起動結果・Driver Readerは代役で実Daemon／公開Consumerの証明ではない。
 */
for (const consumer of ["workbench", "coordinator_cli"] as const) {
  /**
   * 専用auth不存在の候補を実Root・既存Kernel・固定File保存へ結合する。
   * @responsibility 模擬した過去観測を実保存の成立と区別し、CAS・Owner拒否と読戻しを確認する。
   * @trace ERB-IT-003
   * @trace ERB-IT-014
   * @precondition Repository-localの自己生成Git Rootと合成したcodec合法状態だけを使う。
   * @stimulus 別operationId、Owner失効、元版差、rename故障と再入場後、本番Driver本文の観測順と保存停止を確認する。
   * @observation state全文、revision、Hash、短命File不存在、Kernel排他解放と実履歴・transient終了出版。
   * @oracle 拒否時の本文不変、成功時のauth以外全文不変とunknown維持。
   * @cleanup 自作Rootだけを回収し不存在を確認する。
   * @boundary 実Root／Kernel／Filesystemと本番Driver本文・履歴／終了出版。Owner生存・Host終了値・Docker観測・再起動結果・Driver Readerは代役で実Daemon／公開Consumerの証明ではない。
   */
  test(`Host Windows: 認証unknownの専用Writerを実保存へ接続する ${consumer}`, async (t) => {
    assert.equal(process.platform, "win32");
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "authentication_closure_store",
    );
    const root = fs.mkdtempSync(
      path.join(area.directory, "auth-closure-store-"),
    );
    let genericOwned: ReturnType<
      typeof createOwnedOperationDirectories
    > | null = null;
    t.after(() => {
      if (genericOwned && fs.existsSync(genericOwned.root)) {
        cleanupOwnedOperationDirectories(genericOwned);
        assert.equal(fs.existsSync(genericOwned.root), false);
      }
      assert.equal(fs.realpathSync(root), root);
      assert.equal(path.dirname(root), area.directory);
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(fs.existsSync(root), false);
    });
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
    const verified = getRepository(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const borrowed = borrowRuntimeOwnedCoordinatorRecoveryRepository(
      verified.capability,
    );
    assert.ok(borrowed);
    genericOwned = createOwnedOperationDirectories({
      root:
        getRepository(root).capability ??
        assert.fail("fixture_repository_missing"),
      purpose: "task",
      recordingCurrent: () => true,
    });
    const genericManagement = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(genericOwned),
      createOwnedMountCapability(genericOwned),
    );
    assert.ok(bindRuntimeOwnedRepositoryOperation(genericManagement, root));
    const genericRepository =
      borrowRuntimeOwnedCoordinatorStateRepository(genericManagement);
    assert.ok(genericRepository);
    assert.equal(
      genericRepository.repositoryBinding,
      borrowed.repositoryBinding,
    );
    const repository = {
      ...borrowed,
      root: verified.capability,
      operationId: genericRepository.operationId,
    };
    const hostRecord = readOwnedHostOperation(genericManagement).record;
    const identityJson = `${JSON.stringify({
      schema: "crdd-coordinator/operation-identity/v6",
      operationNonce: "b".repeat(64),
      provider: "claude",
      consumer,
      operationId: repository.operationId,
      recoveryCorrelationId: "task-operation-a",
      executionSelection: executionSelection("executor", {
        provider: "claude",
        model: "opus",
        effort: "low",
      }),
      taskAttempt: 0 as const,
      stableLogicalHomeBindingHash: "c".repeat(64),
      providerHomeIdentityHash: "8".repeat(64),
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      operationMode: "workbench_advice",
      workspaceMountMode: null,
    })}\n`;
    const identitySha256 = createHash("sha256")
      .update(identityJson)
      .digest("hex");
    const recoveryId = `docker-task.${"c".repeat(64)}.${"b".repeat(64)}.${identitySha256}`;
    const requestId = restartRequestIdFixture(
      repository.repositoryBinding,
      identitySha256,
      recoveryId,
      "f".repeat(64),
    );
    assert.ok(requestId);
    const snapshot = {
      ...emptyTaskSections,
      schema: "crdd-execution-model/state/v7",
      revision: 1,
      previous: null,
      repositoryBinding: repository.repositoryBinding,
      operations: [
        hostRecord,
        {
          kind: "docker_task",
          identityJson,
          identitySha256,
          recoveryId,
          phase: "settling",
          resources: (() => {
            const book = createResourceBookFixture(
              "crdd.coordinator.runtime=0123456789abcdef",
              "planned",
              RESOURCE_KEYS,
            );
            return {
              ...book,
              snapshot: {
                resources: book.snapshot.resources.map((r) => ({
                  ...r,
                  identity: {
                    ...r.identity,
                    name: r.identity.name.replaceAll("_", "-"),
                  },
                  request:
                    r.key === "create_subscription_auth_probe"
                      ? ("unknown" as const)
                      : r.request,
                })),
              },
              checkpoints: book.checkpoints.map((c) =>
                c.key === "create_subscription_auth_probe"
                  ? { ...c, submission: "intent_saved" }
                  : c,
              ),
            };
          })(),
          lease: "held",
          execution: {
            providerStart: "not_started",
            externalSend: "not_issued",
            sharedWrite: "not_issued",
            ownerEffect: "disabled",
            workspaceReusable: false,
          },
          dockerRestart: {
            requestId,
            scopeSha256: "f".repeat(64),
            request: "confirmed",
            cleanup: "confirmed",
            result: {
              status: "completed",
              reason: "docker_restart_settled",
              request: "confirmed",
              effectOutcomeUnknown: false,
            },
          },
          primaryFailure: null,
          outcome: null,
          summarySha256: null,
          history: null,
        },
      ],
      unresolvedRecoveries: [],
    };
    const before = Buffer.from(`${canonicalJson(snapshot)}\n`);
    const decodedBefore = {
      snapshot: JSON.parse(
        Buffer.from(before ?? assert.fail("missing_fixture_bytes")).toString(
          "utf8",
        ),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      payloadSha256: createHash("sha256")
        .update(before ?? assert.fail("missing_fixture_bytes"))
        .digest("hex"),
      sourceText: Buffer.from(
        before ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    };
    assert.ok(decodedBefore);
    const directory = path.join(root, ".crdd", "execution-model");
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, "state.json");
    fs.writeFileSync(file, before);
    const intake = readState(verified.capability, { scope: "recovery" });
    assert.equal(intake.status, "completed", intake.reason);
    assert.equal(intake.lockReleased, true);
    const observations = [
      { round: 1, name: "absent", name_label: "absent" },
      { round: 2, name: "absent", name_label: "absent" },
    ];
    let candidate: Buffer | null = null;
    for (const refusal of [
      "other_owner",
      "owner_lost",
      "stale_before",
    ] as const) {
      const result = saveRecoveryCheckpoint(
        refusal === "other_owner"
          ? { ...repository, operationId: "OP-654321" }
          : repository,
        recoveryId,
        refusal === "stale_before"
          ? Buffer.concat([before, Buffer.from("\n")])
          : before,
        {
          kind: "authentication_unknown_closure",
          observations: observations,
          assertOwner: () => refusal !== "owner_lost",
        },
      );
      assert.equal(result.status, "blocked", refusal);
      assert.equal(result.snapshotConfirmed, false, refusal);
      assert.equal(result.filesystemEffectIssued, false, refusal);
      assert.equal(result.lockReleased, true, refusal);
      assert.ok(fs.readFileSync(file).equals(before), refusal);
      assert.deepEqual(fs.readdirSync(directory), ["state.json"], refusal);
    }
    const originalRename = fs.renameSync;
    let interrupted = 0;
    const renameFailure = t.mock.method(
      fs,
      "renameSync",
      (from: fs.PathLike, to: fs.PathLike) => {
        if (
          String(from) === path.join(directory, "state.pending.json") &&
          String(to) === file
        ) {
          interrupted++;
          throw new Error(
            "synthetic_authentication_closure_publication_failure",
          );
        }
        return originalRename(from, to);
      },
    );
    try {
      const failed = saveRecoveryCheckpoint(repository, recoveryId, before, {
        kind: "authentication_unknown_closure",
        observations: observations,
        assertOwner: () => true,
      });
      assert.equal(interrupted, 1, JSON.stringify(failed));
      assert.equal(failed.status, "blocked");
      assert.equal(failed.snapshotConfirmed, false);
      assert.equal(failed.filesystemEffectIssued, true);
      assert.equal(failed.lockReleased, true);
      assert.ok(fs.readFileSync(file).equals(before));
      candidate = fs.readFileSync(path.join(directory, "state.pending.json"));
      const pending = {
        snapshot: JSON.parse(
          Buffer.from(
            candidate ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      };
      assert.ok(pending);
      assert.equal(
        pending.snapshot.revision,
        decodedBefore.snapshot.revision + 1,
      );
      assert.deepEqual(pending.snapshot.previous, {
        revision: decodedBefore.snapshot.revision,
        payloadSha256: decodedBefore.payloadSha256,
      });
    } finally {
      renameFailure.mock.restore();
    }
    assert.ok(candidate);
    const saved = saveRecoveryCheckpoint(repository, recoveryId, before, {
      kind: "authentication_unknown_closure",
      observations: observations,
      assertOwner: () => true,
    });
    assert.equal(saved.status, "completed", saved.reason);
    assert.equal(saved.snapshotConfirmed, true);
    assert.equal(saved.filesystemEffectIssued, true);
    assert.equal(saved.lockReleased, true);
    assert.ok(fs.readFileSync(file).equals(candidate));
    const read = readState(verified.capability, { scope: "recovery" });
    assert.equal(read.status, "completed");
    assert.equal(read.lockReleased, true);
    assert.ok(read.value);
    assert.equal(read.value.snapshot.revision, 2);
    assert.deepEqual(read.value.snapshot.previous, {
      revision: 1,
      payloadSha256: decodedBefore.payloadSha256,
    });
    const operation = read.value.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
    assert.ok(operation?.kind === "docker_task");
    assert.ok(
      read.value.operationStates.some(
        (state) =>
          state.kind === "docker_task" &&
          state.operation === operation &&
          state.resourcesSettled,
      ),
    );
    assert.deepEqual(
      {
        ...operation,
        resources: snapshot.operations.find(
          (item) => item.kind === "docker_task",
        )?.resources,
      },
      snapshot.operations.find((item) => item.kind === "docker_task"),
    );
    /**
     * 保存後資源の許可差分だけを独立比較する。
     * @responsibility authの観測差分で他資源の変更を隠さない。
     * @trace ERB-IT-003
     * @trace ERB-IT-014
     * @precondition 正常fixtureの元五資源を閉包から使う。
     * @stimulus 実読戻し資源またはその単独変更コピーを受ける。
     * @observation purpose順序・全文とauthのunknown／null／null。
     * @oracle auth observation／absence以外の差はassertion失敗になる。
     * @cleanup N/A: メモリ比較だけ。
     * @boundary 物理読戻しの資源別保全Oracle。
     */
    const assertPreservedResources = (
      resources: ExecutionOperationRecord["resources"],
    ) => {
      const originals = snapshot.operations.find(
        (item) => item.kind === "docker_task",
      )?.resources;
      assert.ok(originals);
      assert.ok(resources);
      assert.deepEqual(resources.snapshot, originals.snapshot);
      assert.deepEqual(resources.cleanup, originals.cleanup);
      assert.deepEqual(
        resources.checkpoints.map((c) => ({
          ...c,
          ...(c.key === "create_subscription_auth_probe"
            ? { observation: "unobserved", absenceEvidenceSha256: null }
            : {}),
        })),
        originals.checkpoints,
      );
    };
    assertPreservedResources(operation.resources);
    for (const purpose of [
      "create_internal_network",
      "create_subscription_auth_probe",
    ] as const) {
      assert.ok(operation.resources);
      const changed = {
        ...operation.resources,
        snapshot: {
          resources: operation.resources.snapshot.resources.map((r) =>
            r.key === purpose
              ? { ...r, identity: { ...r.identity, dockerId: "0".repeat(64) } }
              : r,
          ),
        },
      };

      assert.throws(() => assertPreservedResources(changed));
    }
    assert.equal(
      operation.resources?.snapshot.resources.find(
        (resource) => resource.key === "create_subscription_auth_probe",
      )?.request,
      "unknown",
    );
    assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
    requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(root, "tests"),
      "authentication_child_fixture",
    );
    for (const scenario of [
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
    ] as const) {
      fs.writeFileSync(file, scenario === "saved_reentry" ? candidate : before);
      const child = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          fileURLToPath(
            new URL("../fixtures/snapshot-recovery-owner.ts", import.meta.url),
          ),
          root,
          repository.operationId,
          recoveryId,
          scenario,
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        },
      );
      assert.equal(child.error, undefined, scenario);
      assert.equal(child.signal, null, scenario);
      assert.equal(child.status, 0, `${scenario}: ${child.stderr}`);
      const result = JSON.parse(child.stdout);
      assert.equal(result.scenario, scenario);
      assert.equal(result.recoveryId, recoveryId);
      assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
    }
    const last = readState(verified.capability, { scope: "recovery" }).value;
    const lastOperation = last?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
    assert.ok(last && lastOperation?.kind === "docker_task");
    const terminalTask: ExecutionOperationRecord = {
      ...lastOperation,
      lease: "released",
      outcome: {
        status: "blocked",
        reason: "docker_setup_create_subscription_auth_probe_failed",
        cleanupConfirmed: true,
      },
    };
    const beforeHostCleanup = Buffer.from(
      canonicalJson({
        ...last.snapshot,
        operations: last.snapshot.operations.map((item) =>
          item.recoveryId === recoveryId ? terminalTask : item,
        ),
      }) + "\n",
    );
    fs.writeFileSync(file, beforeHostCleanup);
    assert.ok(genericOwned);
    cleanupOwnedOperationDirectories(genericOwned);
    const cleanedRoot = genericOwned.root;
    assert.throws(() => fs.lstatSync(cleanedRoot), { code: "ENOENT" });
    genericOwned = null;
    const terminalRead = readState(verified.capability, { scope: "recovery" });
    assert.equal(terminalRead.status, "completed");
    assert.ok(terminalRead.value);
    const terminalBytes = Buffer.from(terminalRead.value.sourceText, "utf8");
    const terminalHost = terminalRead.value.snapshot.operations.find(
      (item) => item.kind === "host_operation",
    );
    assert.deepEqual(terminalHost, {
      ...hostRecord,
      phase: "terminal",
      cleanup: "confirmed",
    });
    // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
    const corruptTask: ExecutionOperationRecord = {
      ...terminalTask,
      resources: terminalTask.resources && {
        ...terminalTask.resources,
        checkpoints: terminalTask.resources.checkpoints.map((c) =>
          c.key === "create_subscription_auth_probe"
            ? { ...c, absenceEvidenceSha256: "0".repeat(64) }
            : c,
        ),
      },
    };
    const corruptBytes = Buffer.from(
      `${canonicalJson({ ...terminalRead.value.snapshot, operations: terminalRead.value.snapshot.operations.map((item) => (item.recoveryId === recoveryId ? corruptTask : item)) })}\n`,
    );
    // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
    fs.writeFileSync(file, corruptBytes);
    const refusedHistory = readState(
      historyRepositoryInput(verified.capability),
      {
        scope: "recovery",
        input: { kind: "execution_history", recoveryId: recoveryId },
      },
    );
    assert.equal(refusedHistory.status, "blocked");
    assert.equal(refusedHistory.lockReleased, true);
    assert.ok(fs.readFileSync(file).equals(corruptBytes));
    assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
    fs.writeFileSync(file, terminalBytes);
    const historyStart = readState(
      historyRepositoryInput(verified.capability),
      {
        scope: "recovery",
        input: { kind: "execution_history", recoveryId: recoveryId },
      },
    );
    assert.equal(historyStart.status, "completed", historyStart.reason);
    assert.equal(historyStart.lockReleased, true);
    assert.ok(historyStart.currentHistoryPublication);
    const advanced = saveRecoveryHistory(
      {
        ...repository,
        ...withHistoryRetention(repository, verified.capability),
      },
      recoveryId,
      () => true,
      "docker_task",
    );
    assert.equal(advanced.status, "completed", advanced.reason);
    assert.equal(advanced.snapshotConfirmed, true);
    assert.equal(advanced.lockReleased, true);
    assert.equal(advanced.historyConfirmed, true);
    const completionReady = readState(verified.capability, {
      scope: "recovery",
      input: {
        kind: "execution_completion",
        recoveryId: recoveryId,
      },
    });
    assert.equal(completionReady.status, "completed", completionReady.reason);
    assert.equal(completionReady.lockReleased, true);
    const finished = completeRecovery(
      verified.capability,
      recoveryId,
      () => true,
      "docker_task",
    );
    assert.equal(finished.status, "completed", finished.reason);
    assert.equal(finished.snapshotConfirmed, true);
    assert.equal(finished.lockReleased, true);
    const finishedSnapshot = readState(verified.capability, {
      scope: "recovery",
    });
    assert.equal(finishedSnapshot.status, "completed");
    assert.equal(finishedSnapshot.lockReleased, true);
    assert.ok(finishedSnapshot.value);
    assert.deepEqual(finishedSnapshot.value.snapshot.operations, [
      terminalHost,
    ]);
    assert.equal(
      Object.hasOwn(finishedSnapshot.value.snapshot, "pendingDeliveries"),
      false,
    );
    assert.deepEqual(finishedSnapshot.value.snapshot.unresolvedRecoveries, []);
    const historyRows = fs
      .readFileSync(path.join(directory, "history.jsonl"), "utf8")
      .trim()
      .split("\n");
    assert.equal(historyRows.length, 1);
    const historyRow = JSON.parse(historyRows[0] ?? "null");
    assert.equal(historyRow.summary.recoveryId, recoveryId);
    assert.equal(historyRow.summary.outcome.status, "blocked");
    assert.equal(
      historyRow.summary.schema,
      "crdd-execution-model/operation-summary/v6",
    );
    assert.equal(Object.hasOwn(historyRow.summary, "consumer"), false);
    assert.equal(
      readState(verified.capability, {
        scope: "recovery",
        input: {
          kind: "completion",
          recoveryId: recoveryId,
          correlationId: "task-operation-a",
        },
      }).operationCompletionConfirmed,
      true,
    );
    assert.equal(
      readState(verified.capability, {
        scope: "recovery",
        input: {
          kind: "completion",
          recoveryId: recoveryId,
          correlationId: "another-operation",
        },
      }).operationCompletionConfirmed,
      false,
    );
    const historyFile = path.join(directory, "history.jsonl");
    const originalHistory = fs.readFileSync(historyFile);
    for (const mutation of [
      "consumer",
      "correlation",
      "legacy",
      "duplicate",
      "missing",
      "restart_null",
      "restart_pending",
      "restart_unknown_shape",
    ] as const) {
      const row = structuredClone(historyRow);
      if (mutation === "consumer")
        row.summary.consumer =
          consumer === "workbench" ? "coordinator_cli" : "workbench";
      if (mutation === "correlation")
        row.summary.recoveryCorrelationId = "other";
      if (mutation === "legacy") {
        row.summary.schema = "crdd-coordinator/operation-summary/v2";
        delete row.summary.consumer;
        delete row.summary.recoveryCorrelationId;
      }
      if (mutation === "restart_null") row.summary.dockerRestart = null;
      if (mutation === "restart_pending")
        row.summary.dockerRestart = {
          request: "issued",
          cleanup: "unknown",
          result: null,
        };
      if (mutation === "restart_unknown_shape")
        row.summary.dockerRestart = { unexpected: true };
      const line = `${canonicalJson(row)}\n`;
      fs.writeFileSync(
        historyFile,
        mutation === "missing"
          ? ""
          : mutation === "duplicate"
            ? line + line
            : line,
      );
      const beforeInspection = fs.readFileSync(
        path.join(directory, "state.json"),
      );
      const history: ReturnType<typeof readState> = readState(
        verified.capability,
        {
          scope: "recovery",
          input: {
            kind: "history",
          },
        },
      );
      assert.equal(history.lockReleased, true, mutation);
      if (
        mutation.startsWith("restart_") ||
        ["consumer", "legacy", "duplicate", "missing"].includes(mutation)
      ) {
        assert.equal(history.status, "blocked", mutation);
        assert.equal(history.historyRows, null, mutation);
      } else {
        assert.equal(history.status, "completed", mutation);
        assert.equal(history.historyRows?.length, 1, mutation);
        assert.equal(history.historyRows?.[0]?.line, line, mutation);
      }
      assert.equal(
        readState(verified.capability, {
          scope: "recovery",
          input: {
            kind: "completion",
            recoveryId: recoveryId,
            correlationId: "task-operation-a",
          },
        }).operationCompletionConfirmed,
        false,
        mutation,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(directory, "state.json")),
        beforeInspection,
        mutation,
      );
      assert.deepEqual(
        fs.readdirSync(directory).sort(),
        ["history.jsonl", "state.json"],
        mutation,
      );
    }
    fs.writeFileSync(historyFile, originalHistory);
    assert.equal(
      historyRow.summary.outcome.reason,
      "docker_setup_create_subscription_auth_probe_failed",
    );
    assert.deepEqual(fs.readdirSync(directory).sort(), [
      "history.jsonl",
      "state.json",
    ]);
  });
}
