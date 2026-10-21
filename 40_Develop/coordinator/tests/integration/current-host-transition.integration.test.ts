/**
 * 現在回収OwnerのHost遷移と実状態保存を別Processで接続する。
 * @packageDocumentation
 * @responsibility 実marker・Kernel排他・遷移／清掃の保存確定と再入場の不変性を確認する。
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope 自己生成Repository、実Hostと現在state。identified／auth unknown条件のDocker読取り・Authenticode応答、restart二形のDI再起動結果を模擬し、実Docker／Provider要求は行わない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収Driver→Host／現在状態Writer。
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  borrowOwnedHostRecoverySnapshot,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../../src/execution/operation.ts";
import { loadHostRecoveryRecordByToken } from "../../src/execution/host-recovery-record.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedCoordinatorStateRepository,
} from "../../src/execution/repository-binding.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  encodeCoordinatorStateValue,
} from "../../src/storage/model.ts";
import {
  beginRuntimeOwnedCoordinatorHostSubmission,
  checkpointRuntimeOwnedCoordinatorLifecycle,
  checkpointRuntimeOwnedCoordinatorResource,
  prepareRuntimeOwnedCoordinatorStateInitialization,
  readRuntimeOwnedCoordinatorStateSnapshot,
  saveRuntimeOwnedCoordinatorOperationStart,
  writeRuntimeOwnedCoordinatorStateSnapshot,
} from "../../src/storage/settlement-store.ts";
import { currentHostTransitionWorkerSource } from "../fixtures/current-host-transition-worker.ts";

/**
 * 実Hostを現在Repositoryへ結合して非秘密の試験Identityを構成する。
 * @responsibility Fixtureでも実Ownerと実Root／markerの相関を使用する。
 * @trace ERB-IT-014
 * @precondition ownedは同じ自己生成Repositoryのtests領域にある。
 * @stimulus 実Host、Repository Rootと独立した二操作のnonceを渡す。
 * @observation 元Owner、Repository結合とHost snapshotを返す。
 * @oracle HashやPathだけでOwnerを代用せず、実binding APIだけを使う。
 * @cleanup 返却Ownerの解放と物理清掃はCaseが所有する。
 * @boundary ERB-IT-014=Related 2 Blocks: Fixture→実Host／Repository結合。
 */
function fixtureOperation(
  owned: ReturnType<typeof createOwnedOperationDirectories>,
  root: string,
) {
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  assert.ok(bindRuntimeOwnedRepositoryOperation(management, root));
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(repository);
  const host = borrowOwnedHostRecoverySnapshot(management).snapshot;
  const nonce = randomBytes(32).toString("hex"),
    suffix = nonce.slice(0, 16);
  return {
    management,
    repository,
    identity: {
      schema: "crdd-coordinator/operation-identity/v1",
      operationNonce: nonce,
      provider: "claude",
      consumer: "coordinator_cli",
      operationId: repository.operationId,
      grantRef: "PHMGRANT-FIXTURE",
      profileId: "PROFILE-123456",
      stableLogicalHomeBindingHash: randomBytes(32).toString("hex"),
      providerHomeIdentityHash: "8".repeat(64),
      providerHomeProtectionHash: "9".repeat(64),
      localUserBindingHash: "6".repeat(64),
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
      resources: {
        auth: `crdd-auth-${suffix}`,
        provider: `crdd-claude-${suffix}`,
        proxy: `crdd-proxy-${suffix}`,
        internal: `crdd-internal-${suffix}`,
        egress: `crdd-egress-${suffix}`,
      },
      images: {
        provider: `sha256:${"a".repeat(64)}`,
        proxy: `sha256:${"b".repeat(64)}`,
      },
      operationMode: "isolated_task",
      workspaceMountMode: "read_only",
      initialHostRecoveryId: host.token,
      initialHostRecovery: host,
      hostPaths: {
        root: owned.root,
        marker: loadHostRecoveryRecordByToken(host.token, owned.root).marker,
      },
    },
  };
}

/**
 * 引渡し前例外の省略を、実Workerと同じ捕捉Oracleで拒否する。
 * @responsibility 例外未発生でもfinallyに到達できる反例を区別する。
 * @trace PRL-IT-013
 * @precondition 実Workerの固定try／catchと捕捉件数Oracleを一意に抽出する。
 * @stimulus 固定throwだけを省略したメモリ変異を与える。
 * @observation 正例の捕捉成功と変異の断言失敗を確認する。
 * @oracle throw省略は同じ捕捉件数Oracleを満たさない。
 * @cleanup N/A: メモリ内の評価だけで実資源を生成しない。
 * @boundary N/A: 物理回収は別の実Host正例が所有する。
 */
test("引渡し前失敗: throw省略を同じ捕捉Oracleで拒否する", () => {
  const start = currentHostTransitionWorkerSource.indexOf(
    "let failureReached = 0",
  );
  const end = currentHostTransitionWorkerSource.indexOf("} finally {", start);
  assert.ok(start >= 0 && end > start);
  const block = `${currentHostTransitionWorkerSource.slice(start, end)}}`;
  const fixedThrow =
    "throw new Error('current_fixture_handoff_before_output');";
  assert.equal(block.split(fixedThrow).length, 2);
  const oracle =
    "assert.equal(failureReached, 1); assert.equal(handoffWrites, 0);";
  assert.equal(currentHostTransitionWorkerSource.split(oracle).length, 2);
  const context = {
    assert,
    handoffFailure: true,
    process: { stdout: { write: () => true } },
  };
  runInNewContext(`(() => {${block}\n${oracle}})()`, context);
  assert.throws(
    () =>
      runInNewContext(
        `(() => {${block.replace(fixedThrow, "")}\n${oracle}})()`,
        context,
      ),
    { code: "ERR_ASSERTION" },
  );
});

/**
 * 再起動直後の兄弟実体比較を、本文差と比較省略で反証する。
 * @responsibility 最終CLI結果だけで中間時点の保全を推定しない。
 * @trace ERB-IT-014
 * @precondition 実Workerの比較関数と二呼出し位置を一意に抽出する。
 * @stimulus marker本文だけを変更し、比較assert省略も与える。
 * @observation 同じ実比較本文の成功・断言失敗とCLI前の二回到達位置。
 * @oracle 正常だけ成功し、変更本文は比較省略時だけ検出できなくなる。
 * @cleanup N/A: VM内のFile観測代役だけで物理変更なし。
 * @boundary 比較Oracleの局所反証。実Host保全は別のHost試験が所有する。
 */
test("再起動後の兄弟Host比較は本文変更と比較省略を区別する", () => {
  const start = currentHostTransitionWorkerSource.indexOf(
    "function assertRestartSiblingPhysical() {",
  );
  const end = currentHostTransitionWorkerSource.indexOf(
    "        const completed =",
    start,
  );
  assert.ok(start > 0 && end > start);
  const body = currentHostTransitionWorkerSource.slice(start, end);
  const beforeCli = currentHostTransitionWorkerSource.indexOf(
    "      if(process.argv[3].startsWith('cli_entry_')",
  );
  const calls = [
    ...currentHostTransitionWorkerSource.matchAll(
      / {8}assertRestartSiblingPhysical\(\);/gu,
    ),
  ].map((match) => match.index);
  assert.equal(calls.length, 2);
  assert.ok(calls[0] !== undefined && calls[1] !== undefined);
  assert.ok(calls[0] > end && calls[1] > calls[0] && calls[1] < beforeCli);
  const orderOracle = `const calls = [...source.matchAll(/ {8}assertRestartSiblingPhysical\\(\\);/gu)].map(match => match.index);
    assert.equal(calls.length,2);
    const steps = [source.indexOf("assert.equal(completed.status,'completed');"),calls[0],source.indexOf('const repeated = await restart.restartRuntimeOwnedDockerForRecovery('),source.indexOf("assert.equal(repeated.status,'blocked');"),calls[1],source.indexOf("      if(process.argv[3].startsWith('cli_entry_')")];
    assert.ok(steps.every((position,index) => Number.isInteger(position) && position >= 0 && (index === 0 || position > steps[index-1])));`;
  runInNewContext(orderOracle, {
    assert,
    source: currentHostTransitionWorkerSource,
  });
  const comparison = "        assertRestartSiblingPhysical();";
  const moved = currentHostTransitionWorkerSource
    .replace(comparison, "")
    .replace(comparison, `${comparison}\n${comparison}`);
  assert.throws(() => runInNewContext(orderOracle, { assert, source: moved }), {
    code: "ERR_ASSERTION",
  });
  const assertion = body.match(/ {12}assert\.deepEqual\([^\n]+/u)?.[0];
  assert.ok(assertion);
  for (const changed of [false, true]) {
    const context = {
      assert,
      Buffer,
      fs: {
        lstatSync: () => ({
          dev: 1n,
          ino: 2n,
          birthtimeNs: 3n,
          isFile: () => true,
          isDirectory: () => false,
        }),
        readFileSync: () => Buffer.from(changed ? "after" : "before"),
      },
    };
    const source = `(() => {const restartSiblingPhysical = [{file:'marker',dev:1n,ino:2n,birthtimeNs:3n,bytes:Buffer.from('before'),children:null}];\n${body}\nassertRestartSiblingPhysical();})();`;
    if (changed)
      assert.throws(() => runInNewContext(source, context), {
        code: "ERR_ASSERTION",
      });
    else runInNewContext(source, context);
    runInNewContext(source.replace(assertion, ""), context);
  }
});

/**
 * 実意図保存・Host遷移・token確定を同じ実Snapshotへ接続する。
 * @responsibility 遷移・Host清掃各二版と解放後終端一版の完全期待値、元結果保持、再処置0と全自己生成物清掃を確認する。
 * @trace ERB-IT-014
 * @precondition Windows実Kernel排他と自己生成Git Repositoryだけを使う。
 * @stimulus 正規開始・disabled Ownerの新回収、同cap再実行とfresh settled再入場、結果引渡し前の失敗を行う。
 * 再起動結果の代役を使う条件では公開組立ての保存後に別Process通常CLIへ接続する。auth形は模擬二回不存在と専用実Writerを通す。実再起動は対象外。
 * @observation 遷移・清掃各二回のstate公開本文、改訂／元版Hash、実marker、他操作と元結果。
 * @oracle 親子の独立予定tokenと全本文が一致し、遷移・清掃は各保存二回、終端は全解放後一回だけ。既存結果・一次失敗は保持し、結果欠測は固定blockedとする。
 * @cleanup 子が全準備を解放後にexact Hostを回収し、親は不存在確認後だけ試験Repositoryを削除する。
 * @boundary ERB-IT-014=Related 2 Blocks: 別Process現在回収→実Host／状態Writer。実Docker・競合CAS・pending旧／予定再入場は対象外。
 */
for (const publicationFault of [
  "none",
  "null_outcome",
  "A",
  "B",
  "C",
  "history_checkpoint_pending",
  "history_checkpoint_published",
  "history_pending",
  "history_published",
  "history_confirm_pending",
  "history_confirm_published",
  "delivery_none",
  "delivery_pending",
  "delivery_published",
  "delivery_marker",
  "workbench_transient",
  "driver",
  "completion_cli",
  "completion_workbench",
  "completion_pending",
  "completion_marker",
  "cli_entry_cli",
  "cli_entry_workbench",
  "cli_entry_orchestrator",
  "cli_entry_orchestrator_identified",
  "handoff_failure",
  "restart_cli_entry",
  "restart_auth_cli_entry",
] as const) {
  /**
   * 実意図保存・Host遷移・token確定を同じ実Snapshotへ接続する。
   * @responsibility 遷移・Host清掃各二版と解放後終端一版の完全期待値、元結果保持、再処置0と全自己生成物清掃を確認する。
   * @trace ERB-IT-014
   * @precondition Windows実Kernel排他と自己生成Git Repositoryだけを使う。
   * @stimulus 正規開始・disabled Ownerの新回収、同cap再実行とfresh settled再入場、結果引渡し前の失敗を行う。
   * 再起動結果の代役を使う条件では公開組立ての保存後に別Process通常CLIへ接続する。auth形は模擬二回不存在と専用実Writerを通す。実再起動は対象外。
   * @observation 遷移・清掃各二回のstate公開本文、改訂／元版Hash、実marker、他操作と元結果。
   * @oracle 親子の独立予定tokenと全本文が一致し、遷移・清掃は各保存二回、終端は全解放後一回だけ。既存結果・一次失敗は保持し、結果欠測は固定blockedとする。
   * @cleanup 子が全準備を解放後にexact Hostを回収し、親は不存在確認後だけ試験Repositoryを削除する。
   * @boundary ERB-IT-014=Related 2 Blocks: 別Process現在回収→実Host／状態Writer。実Docker・競合CAS・pending旧／予定再入場は対象外。
   */
  test(`Host Windows: 現在Host遷移と清掃の実保存・出版再入場 ${publicationFault}`, async (t) => {
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "host_transition_test",
    );
    const root = fs.mkdtempSync(
      path.join(area.directory, "current-host-transition-"),
    );
    let otherOwned: ReturnType<typeof createOwnedOperationDirectories> | null =
      null;
    let targetOwned: ReturnType<typeof createOwnedOperationDirectories> | null =
      null;
    let targetManagement: object | null = null;
    let abandoned = false,
      targetStarted = false,
      cleanupConfirmed = false;
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
      const hosts = requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests"),
        "host_fixture",
      );
      otherOwned = createOwnedOperationDirectories(hosts.directory);
      targetOwned = createOwnedOperationDirectories(hosts.directory);
      const other = fixtureOperation(otherOwned, root),
        target = fixtureOperation(targetOwned, root);
      const otherPhysical = [
        other.identity.hostPaths.root,
        other.identity.hostPaths.marker,
      ].map((file) => {
        const info = fs.lstatSync(file, { bigint: true });
        return {
          file,
          dev: info.dev,
          ino: info.ino,
          birthtimeNs: info.birthtimeNs,
          bytes: info.isFile() ? fs.readFileSync(file) : null,
          children: info.isDirectory() ? fs.readdirSync(file).sort() : null,
        };
      });
      if (
        publicationFault.startsWith("delivery_") ||
        publicationFault.startsWith("cli_entry_orchestrator")
      )
        target.identity.consumer = "orchestrator";
      if (publicationFault.startsWith("cli_entry_orchestrator"))
        Object.assign(target.identity, {
          recoveryCorrelationId: "upper-current-host",
        });
      if (
        publicationFault === "workbench_transient" ||
        publicationFault === "completion_workbench" ||
        publicationFault === "cli_entry_workbench"
      )
        target.identity.consumer = "workbench";
      targetManagement = target.management;
      const initial = Buffer.from(
        `${encodeCoordinatorStateValue({ schema: COORDINATOR_STATE_SCHEMA, revision: 1, previous: null, repositoryBinding: target.repository.repositoryBinding, operations: [], unresolvedRecoveries: [], pendingDeliveries: [] })}\n`,
      );
      assert.equal(
        prepareRuntimeOwnedCoordinatorStateInitialization(
          target.management,
          initial,
        ).status,
        "prepared",
      );
      assert.equal(
        writeRuntimeOwnedCoordinatorStateSnapshot(target.management, initial)
          .status,
        "completed",
      );
      assert.equal(
        saveRuntimeOwnedCoordinatorOperationStart(
          other.management,
          `${JSON.stringify(other.identity)}\n`,
        ).status,
        "completed",
      );
      const started = saveRuntimeOwnedCoordinatorOperationStart(
        target.management,
        `${JSON.stringify(target.identity)}\n`,
      );
      assert.equal(started.status, "completed");
      assert.ok(started.recoveryId);
      assert.equal(
        await activateOwnedHostOperationGenerationLock(target.management),
        "activated",
      );
      const submission = beginRuntimeOwnedCoordinatorHostSubmission(
        target.management,
        started.recoveryId,
      );
      assert.equal(submission.status, "completed");
      assert.equal(submission.hostTransitionConfirmed, true);
      targetStarted = true;
      const current = readRuntimeOwnedCoordinatorStateSnapshot(
        target.management,
      );
      const operation = current.value?.snapshot.operations.find(
        (item) => item.recoveryId === started.recoveryId,
      );
      assert.ok(operation && operation.kind === "docker_task");
      if (
        publicationFault === "cli_entry_orchestrator_identified" ||
        publicationFault === "restart_auth_cli_entry"
      ) {
        const resource = operation.resources.find(
          (item) =>
            item.purpose ===
            (publicationFault === "restart_auth_cli_entry"
              ? "create_subscription_auth_probe"
              : "create_provider"),
        );
        assert.ok(resource);
        const statePath = path.join(root, ".crdd", "coordinator", "state.json");
        const requests =
          publicationFault === "restart_auth_cli_entry"
            ? (["intent_saved", "unknown"] as const)
            : (["intent_saved", "issued", "identified"] as const);
        for (const request of requests) {
          const previous = fs.readFileSync(statePath);
          const previousSnapshot = JSON.parse(previous.toString());
          const saved = checkpointRuntimeOwnedCoordinatorResource(
            target.management,
            started.recoveryId,
            {
              ...resource,
              request,
              dockerId: request === "identified" ? "c".repeat(64) : null,
              receiptSource:
                request === "identified" ? "docker_create_result" : null,
              observation: request === "identified" ? "present" : "unobserved",
            },
          );
          assert.equal(saved.status, "completed");
          assert.equal(saved.snapshotConfirmed, true);
          assert.equal(saved.lockReleased, true);
          const next = JSON.parse(fs.readFileSync(statePath, "utf8"));
          assert.equal(next.revision, previousSnapshot.revision + 1);
          assert.deepEqual(next.previous, {
            revision: previousSnapshot.revision,
            payloadSha256: createHash("sha256").update(previous).digest("hex"),
          });
          assert.deepEqual(
            next.operations.filter(
              (item: { recoveryId: string }) =>
                item.recoveryId !== started.recoveryId,
            ),
            previousSnapshot.operations.filter(
              (item: { recoveryId: string }) =>
                item.recoveryId !== started.recoveryId,
            ),
          );
        }
      }
      const disabled = checkpointRuntimeOwnedCoordinatorLifecycle(
        target.management,
        started.recoveryId,
        {
          phase: "settling",
          lease: operation.lease,
          execution: { ...operation.execution, ownerEffect: "disabled" },
          primaryFailure:
            publicationFault === "null_outcome"
              ? null
              : {
                  purpose: "create_subscription_auth_probe",
                  stage: "command_wait",
                  reason: "provider_result_invalid",
                  exceptionCode: null,
                  commandHandleObtained: true,
                  responseObserved: false,
                  receiptRecorded: false,
                },
          outcome:
            publicationFault === "null_outcome"
              ? null
              : {
                  status: "blocked",
                  reason: "provider_result_invalid",
                  cleanupConfirmed: false,
                },
          summarySha256: null,
        },
      );
      assert.equal(disabled.status, "completed");
      const before = readRuntimeOwnedCoordinatorStateSnapshot(
        target.management,
      );
      assert.equal(before.status, "completed");
      assert.ok(before.value);
      const beforeOperation = before.value.snapshot.operations.find(
        (item) => item.recoveryId === started.recoveryId,
      );
      assert.ok(beforeOperation && beforeOperation.kind === "docker_task");
      assert.equal(beforeOperation.execution.ownerEffect, "disabled");
      assert.equal(
        beforeOperation.outcome?.status,
        publicationFault === "null_outcome" ? undefined : "blocked",
      );
      const hostBefore = loadHostRecoveryRecordByToken(
        beforeOperation.host.currentToken,
        targetOwned.root,
      );
      const expectedMarker = `${JSON.stringify({ ...hostBefore.record, state: "docker_absent_confirmed" })}\n`;
      const expectedToken = `host.${hostBefore.parsed.rootName}.${hostBefore.parsed.nonce}.${createHash("sha256").update(expectedMarker).digest("hex")}`;
      assert.equal(
        await abandonOwnedHostOperationGenerationLock(target.management),
        true,
      );
      abandoned = true;
      const child = spawnSync(
        process.execPath,
        [
          ...(publicationFault.startsWith("restart_")
            ? ["--experimental-test-module-mocks"]
            : []),
          "-",
          started.recoveryId,
          publicationFault,
        ],
        {
          input: currentHostTransitionWorkerSource,
          cwd: root,
          encoding: "utf8",
          timeout:
            publicationFault === "restart_cli_entry" ||
            publicationFault === "restart_auth_cli_entry"
              ? 180_000
              : 90_000,
          windowsHide: true,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.ok(child.pid > 0);
      assert.notEqual(child.pid, process.pid);
      if (publicationFault === "handoff_failure") {
        assert.notEqual(child.status, 0);
        assert.equal(child.stdout, "");
        assert.match(
          child.stderr,
          /Error: current_fixture_handoff_before_output/u,
        );
        assert.equal(
          child.stderr.match(/current_handoff_failure_recovered/gu)?.length,
          1,
        );
      } else {
        assert.equal(child.status, 0, child.stderr);
        assert.equal(child.stdout, "current_host_storage_verified");
      }
      const targetRoot = targetOwned.root;
      assert.throws(() => fs.lstatSync(targetRoot), { code: "ENOENT" });
      assert.throws(() => fs.lstatSync(hostBefore.marker), { code: "ENOENT" });
      cleanupConfirmed = true;
      for (const expected of otherPhysical) {
        const info = fs.lstatSync(expected.file, { bigint: true });
        assert.deepEqual(
          {
            file: expected.file,
            dev: info.dev,
            ino: info.ino,
            birthtimeNs: info.birthtimeNs,
            bytes: info.isFile() ? fs.readFileSync(expected.file) : null,
            children: info.isDirectory()
              ? fs.readdirSync(expected.file).sort()
              : null,
          },
          expected,
        );
      }
      for (const file of [
        "state.pending.json",
        "state.lock",
        "history.pending.jsonl",
      ])
        assert.throws(
          () => fs.lstatSync(path.join(root, ".crdd", "coordinator", file)),
          { code: "ENOENT" },
        );
      const finalState = JSON.parse(
        fs.readFileSync(
          path.join(root, ".crdd", "coordinator", "state.json"),
          "utf8",
        ),
      );
      const finalOperation = finalState.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === started.recoveryId,
      );
      assert.deepEqual(
        finalState.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== started.recoveryId,
        ),
        before.value.snapshot.operations.filter(
          (item) => item.recoveryId !== started.recoveryId,
        ),
      );
      if (
        publicationFault.startsWith("completion_") ||
        publicationFault === "handoff_failure" ||
        publicationFault === "cli_entry_cli" ||
        publicationFault === "cli_entry_workbench" ||
        publicationFault.startsWith("restart_")
      ) {
        assert.equal(finalOperation, undefined);
        assert.equal(
          finalState.revision,
          before.value.snapshot.revision +
            (publicationFault === "restart_auth_cli_entry"
              ? 15
              : publicationFault === "restart_cli_entry"
                ? 14
                : 9),
        );
        const rows = fs
          .readFileSync(
            path.join(root, ".crdd", "coordinator", "history.jsonl"),
            "utf8",
          )
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const targetRows = rows.filter(
          (item) => item.summary.recoveryId === started.recoveryId,
        );
        assert.equal(targetRows.length, 1);
        const row = targetRows[0];
        assert.ok(row);
        assert.deepEqual(
          row.summary.primaryFailure,
          beforeOperation.primaryFailure,
        );
        assert.deepEqual(row.summary.outcome, {
          ...beforeOperation.outcome,
          cleanupConfirmed: true,
        });
        return;
      }
      assert.ok(finalOperation);
      assert.equal(finalOperation.host.currentToken, expectedToken);
      const terminalSaved =
        publicationFault === "none" ||
        publicationFault === "null_outcome" ||
        publicationFault.startsWith("history_") ||
        publicationFault.startsWith("delivery_") ||
        publicationFault === "workbench_transient" ||
        publicationFault === "driver" ||
        publicationFault.startsWith("cli_entry_orchestrator");
      assert.equal(
        finalState.revision,
        before.value.snapshot.revision +
          (publicationFault.startsWith("cli_entry_orchestrator")
            ? 9
            : publicationFault.startsWith("delivery_") ||
                publicationFault === "driver"
              ? 8
              : terminalSaved
                ? 7
                : 4),
      );
      assert.equal(finalOperation.host.pendingTransitionJson, null);
      if (publicationFault.startsWith("cli_entry_orchestrator")) {
        const deliveries = finalState.pendingDeliveries.filter(
          (item: { operationNonce: string }) =>
            item.operationNonce === target.identity.operationNonce,
        );
        assert.equal(deliveries.length, 1);
        assert.equal(deliveries[0].consumer, "orchestrator");
        assert.equal(deliveries[0].recoveryId, started.recoveryId);
        assert.equal(deliveries[0].acceptanceSha256, null);
        assert.equal(
          JSON.parse(finalOperation.identityJson).recoveryCorrelationId,
          "upper-current-host",
        );
        if (publicationFault === "cli_entry_orchestrator_identified") {
          const recoveredResource = finalOperation.resources.find(
            (item: { purpose: string }) => item.purpose === "create_provider",
          );
          assert.equal(recoveredResource.request, "identified");
          assert.equal(recoveredResource.dockerId, "c".repeat(64));
          assert.equal(recoveredResource.observation, "absent");
          assert.equal(
            recoveredResource.absence.recoveryId,
            started.recoveryId,
          );
          assert.equal(recoveredResource.absence.dockerId, "c".repeat(64));
        }
      }
      assert.equal(finalOperation.host.cleanup, "confirmed");
      assert.equal(finalOperation.phase, "settling");
      assert.equal(
        finalOperation.lease,
        terminalSaved ? "released" : beforeOperation.lease,
      );
      assert.deepEqual(
        finalOperation.primaryFailure,
        beforeOperation.primaryFailure,
      );
      assert.deepEqual(
        finalOperation.outcome,
        terminalSaved
          ? beforeOperation.outcome === null
            ? {
                status: "blocked",
                reason: "docker_process_controller_execution_failed_closed",
                cleanupConfirmed: true,
              }
            : { ...beforeOperation.outcome, cleanupConfirmed: true }
          : beforeOperation.outcome,
      );
    } finally {
      if (targetManagement && !abandoned)
        assert.equal(
          await abandonOwnedHostOperationGenerationLock(targetManagement),
          true,
        );
      if (otherOwned) cleanupOwnedOperationDirectories(otherOwned);
      if (targetOwned && !targetStarted) {
        cleanupOwnedOperationDirectories(targetOwned);
        cleanupConfirmed = true;
      }
      if (!targetOwned || cleanupConfirmed) {
        assert.equal(path.dirname(root), area.directory);
        fs.rmSync(root, { recursive: true });
        assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
        if (fs.readdirSync(area.directory).length === 0)
          fs.rmdirSync(area.directory);
      } else
        t.diagnostic("Host試験の清掃未確認。自己生成Repositoryを保持する。");
    }
  });
}
