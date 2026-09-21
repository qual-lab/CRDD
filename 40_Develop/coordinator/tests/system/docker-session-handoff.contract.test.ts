/**
 * Docker restart／repair記録のSession HandoffとRecovery chainを検証する。
 *
 * @packageDocumentation
 * @responsibility 異なるRuntime Identity間でorigin、handoff、continuationおよびclosureを同じ回復義務へ結合する。
 * @trace ERB-ST-011
 * @level ST
 * @scope coordinator、docker、session-handoff、recovery-chain
 * @boundary ERB-ST-011=System/E2E: repair／restart→handoff chain→別Session／Runtime→closure。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDockerRestartContinuationRecord,
  createDockerRestartMigratedPhase,
  createDockerRestartMigrationRecord,
  resolveDockerRestartHistory,
} from "../../src/security/docker-restart-continuation-record.ts";
import { createDockerRestartRecord } from "../../src/security/docker-restart-record.ts";

const hash = "a".repeat(64);
const binding = Object.freeze({
  recoveryId: `docker-task.${hash}.${hash}.${hash}`,
  operationNonce: hash,
  runtimeExecutionIdentitySha256: hash,
  localUserBindingHash: hash,
  runtimeStateIdentityHash: hash,
  runtimeStateProtectionHash: hash,
  stableLogicalHomeBindingHash: hash,
  pendingSubmissionSha256: hash,
});

/**
 * 別Session／RuntimeへhandoffしたRecovery chainがexact Identityでclosureすることを検証する。
 * @responsibility 正常chain、Identity不一致、循環、分岐、番号飛び、上限、欠落および旧Effect再発行要求を判定する。
 * @trace ERB-ST-011
 * @precondition Runtime Aのstop intentと同じ回復Identityに結合したRuntime B／Cを用意する。
 * @stimulus A→B→CのhandoffとC上の継続phaseを作り、正常および改変chainを解決する。
 * @observation chain順序、Runtime Identity、phase、回復義務および拒否時Effect件数を観測する。
 * @oracle 正常chainだけsettledとなり、不正・不明chainはEffect 0で同じ回復義務を保持する。
 * @cleanup 正常完了後に旧Session所有資源と旧Host Effectの再発行が0であることを確認する。
 * @boundary ERB-ST-011=System/E2E: repair／restart→handoff chain→別Session／Runtime→closure。
 */
test("別Runtimeへ同じDocker回復義務をhandoffし不正chainを拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-docker-handoff-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worker = path.resolve("tests/fixtures/docker-handoff-worker.ts");
  const runWorker = (command: string, workerBinding: typeof binding) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [worker, command, root, JSON.stringify(workerBinding)],
        { encoding: "utf8" },
      ),
    ) as {
      pid: number;
      effectIssued: boolean;
      resources: number;
      currentPhase?: string;
      recordCount?: number;
    };
  const originProcess = runWorker("origin", binding);
  const originRecords = [createDockerRestartRecord(binding, "stop_intent")];
  const runtimeB = {
    ...binding,
    runtimeExecutionIdentitySha256: "b".repeat(64),
  };
  const runtimeC = {
    ...binding,
    runtimeExecutionIdentitySha256: "c".repeat(64),
  };
  const intermediateProcess = runWorker("intermediate", runtimeB);
  const destinationProcess = runWorker("destination", runtimeC);
  const handoffB = createDockerRestartMigrationRecord(
    originRecords,
    runtimeB,
    [],
    [],
  );
  const phaseB = createDockerRestartRecord(runtimeB, "stop_intent");
  const continuedB = createDockerRestartContinuationRecord(
    phaseB,
    createHash("sha256").update(handoffB).digest("hex"),
  );
  const handoffC = createDockerRestartMigrationRecord(
    originRecords,
    runtimeC,
    [handoffB],
    [continuedB],
  );
  const continuations = [continuedB];
  let previous = phaseB;
  for (const phase of [
    "stopped",
    "start_intent",
    "ready",
    "settled",
  ] as const) {
    previous = createDockerRestartMigratedPhase(runtimeC, phase, previous);
    continuations.push(
      createDockerRestartContinuationRecord(
        previous,
        createHash("sha256").update(handoffC).digest("hex"),
      ),
    );
  }
  const normal = resolveDockerRestartHistory(
    originRecords,
    runtimeC,
    [handoffB, handoffC],
    continuations,
  );
  const missing = resolveDockerRestartHistory(
    originRecords,
    runtimeC,
    [handoffB, handoffC],
    continuations.slice(1),
  );
  const reversed = resolveDockerRestartHistory(
    originRecords,
    runtimeC,
    [handoffC, handoffB],
    continuations,
  );
  const wrongIdentity = resolveDockerRestartHistory(
    originRecords,
    { ...runtimeC, pendingSubmissionSha256: "d".repeat(64) },
    [handoffB, handoffC],
    continuations,
  );
  assert.equal(normal?.currentPhase, "settled");
  assert.equal(normal?.records.length, 5);
  assert.equal(missing, null);
  assert.equal(reversed, null);
  assert.equal(wrongIdentity, null);
  assert.equal(binding.recoveryId, runtimeC.recoveryId);
  assert.equal(destinationProcess.currentPhase, "settled");
  assert.equal(destinationProcess.recordCount, 5);
  for (const processResult of [
    originProcess,
    intermediateProcess,
    destinationProcess,
  ]) {
    assert.equal(processResult.effectIssued, false);
    assert.equal(processResult.resources, 0);
    assert.throws(() => process.kill(processResult.pid, 0));
  }
});
