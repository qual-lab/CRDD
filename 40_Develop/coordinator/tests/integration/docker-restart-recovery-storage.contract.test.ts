/**
 * Docker再起動結果の後に、Task回復と実履歴を確定する。
 * @packageDocumentation
 * @responsibility 再起動の未発行・既知失敗の記録と、同じ対象の回復・終了を検証する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @level IT
 * @boundary 実Host・EM Writer・履歴。Executorの外部操作はすべて拒否する。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { after, before, mock } from "node:test";
import {
  type OperationRecord,
  readState,
  saveOperationStart,
} from "@qual-lab/crdd-execution-model";
import { getRepository } from "@qual-lab/crdd-version-control";
import { readStoredExecutionFixture } from "../../../execution-model/tests/fixtures/stored-execution.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  bindRepositoryOperation,
  borrowCoordinatorStateRepository,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  operationStartInput,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/lifecycle/host.ts";
import {
  prepareFixtureRecovery,
  useFixtureProviderHomeDirectory,
} from "../support/recovery-repository.ts";

let environment: typeof import("../../src/lifecycle/environment.ts");
let selection: typeof import("../fixtures/ai-selection.ts");
let attempts: string[] = [];
let restoreExecutor: (() => void) | undefined;

before(async () => {
  const forbidden = (operation: string) => () => {
    attempts.push(operation);
    throw Error("unexpected_restart_fixture_effect");
  };
  const substitute = mock.module(
    import.meta.resolve("@qual-lab/crdd-executor"),
    {
      namedExports: {
        cleanupResources: forbidden("cleanupResources"),
        createExecutor: forbidden("createExecutor"),
        inspectResources: forbidden("inspectResources"),
        restartDockerEnvironment: forbidden("restartDockerEnvironment"),
        startDockerEnvironment: forbidden("startDockerEnvironment"),
      },
    },
  );
  restoreExecutor = () => substitute.restore();
  environment = await import("../../src/lifecycle/environment.ts");
  selection = await import("../fixtures/ai-selection.ts");
});

after(() => restoreExecutor?.());

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
    attempts = [];
    t.after(() => assert.deepEqual(attempts, []));
    const {
      finalizeDockerRestartPreparation,
      persistDockerRestartCheckpoint,
      prepareDockerRestart,
      prepareRepositoryDockerOperationIdentity,
      recoverDockerTaskForCurrentConsumer,
      releaseDockerRestartPreparation,
    } = environment;
    const { executionSelection } = selection;
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
    useFixtureProviderHomeDirectory(
      t,
      root,
      environment.providerHomesDirectoryCandidate,
    );
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
    assert.ok(bindRepositoryOperation(management, root));
    const repository = borrowCoordinatorStateRepository(management);
    assert.ok(repository);
    const verified = getRepository(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const identity = prepareRepositoryDockerOperationIdentity(
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
      () => "b".repeat(64),
    );
    assert.ok(identity);
    const start = saveOperationStart(
      operationStartInput(management, () => null),
      identity.identityJson,
    );
    assert.equal(start.status, "completed");
    assert.ok(start.recoveryId);
    active = true;
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    active = false;
    const preparation = prepareDockerRestart(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(preparation.status, "prepared");
    assert.ok(preparation.capability);
    let released = false;
    try {
      const initialHosts = readState(
        prepareFixtureRecovery(verified.capability),
        {
          scope: "recovery",
        },
      ).value?.snapshot.operations.filter(
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
      for (const request of issuedFailure
        ? (["not_issued", "unknown", "issued"] as const)
        : (["not_issued", "unknown"] as const)) {
        const previous: ReturnType<typeof readState> = readState(
          prepareFixtureRecovery(verified.capability),
          { scope: "recovery" },
        );
        assert.equal(previous.status, "completed");
        assert.ok(previous.value);
        const previousSnapshot = readStoredExecutionFixture(
          root,
          previous.value.payloadSha256,
        );
        assert.equal(
          persistDockerRestartCheckpoint(preparation.capability, {
            requestId: preparation.requestId,
            scopeSha256: preparation.scopeSha256,
            request,
            cleanup: request === "not_issued" ? "not_required" : "pending",
            result: null,
          }),
          true,
        );
        const next: ReturnType<typeof readState> = readState(
          prepareFixtureRecovery(verified.capability),
          { scope: "recovery" },
        );
        assert.equal(next.status, "completed");
        assert.ok(next.value);
        assert.deepEqual(
          readStoredExecutionFixture(root, next.value.payloadSha256),
          {
            ...previousSnapshot,
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
          },
        );
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
        finalizeDockerRestartPreparation(preparation.capability, technical)
          .status,
        "blocked",
      );
      assert.deepEqual(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "state.json"),
        ),
        beforeRelease,
      );
      assert.equal(
        releaseDockerRestartPreparation(preparation.capability),
        true,
      );
      released = true;
      const finalized = finalizeDockerRestartPreparation(
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
        finalizeDockerRestartPreparation(preparation.capability, technical)
          .status,
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
        assert.equal(
          releaseDockerRestartPreparation(preparation.capability),
          true,
        );
    }
    const saved = readState(prepareFixtureRecovery(verified.capability), {
      scope: "recovery",
    });
    assert.equal(saved.status, "completed");
    assert.ok(saved.value);
    const checkpoint = saved.value.snapshot.operations.find(
      (
        x,
      ): x is import("@qual-lab/crdd-execution-model").ExecutionOperationRecord =>
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
    const repeated = prepareDockerRestart(
      start.recoveryId,
      verified.capability,
    );
    assert.equal(repeated.status, "prepared");
    assert.ok(repeated.capability);
    try {
      assert.equal(repeated.alreadyRequested, true);
      assert.equal(repeated.requestId, preparation.requestId);
      assert.equal(repeated.scopeSha256, preparation.scopeSha256);
      readStoredExecutionFixture(root, saved.value.payloadSha256);
    } finally {
      assert.equal(releaseDockerRestartPreparation(repeated.capability), true);
    }
    const result = await recoverDockerTaskForCurrentConsumer(
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
    const after = readState(prepareFixtureRecovery(verified.capability), {
      scope: "recovery",
    });
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
      Object.hasOwn(
        readStoredExecutionFixture(root, after.value.payloadSha256),
        "pendingDeliveries",
      ),
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
    assert.equal(summary.schema, "crdd-execution-model/operation-summary/v7");
    assert.deepEqual(summary.dockerRestart, checkpoint);
    assert.equal(summary.primaryFailure, null);
    assert.equal(summary.outcome.status, "blocked");
  });
}
