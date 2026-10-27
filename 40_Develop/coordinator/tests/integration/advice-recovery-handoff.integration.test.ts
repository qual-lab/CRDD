/**
 * 助言結果のHost／Docker回復参照を初回Task保存へ搬送する。
 * @packageDocumentation
 * @responsibility 本番Task Sessionと実Writerで同じ参照の初回保存と終端不変条件を検証する。
 * @trace CPR-IT-004
 * @trace PRL-IT-013
 * @level IT
 * @scope 合成Repository、助言代役、実Task Sessionと既存保存。
 * @boundary 助言結果→本番Task受付→実Snapshot。AI／Docker／認証は使用しない。
 */
import { getAiModelCatalog } from "../../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test, { mock } from "node:test";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { selectionConfig } from "../fixtures/ai-selection.ts";
import { saveRepositoryAiSelection } from "../../../domain-model/src/index.ts";
import { readCoordinatorSnapshot } from "../../src/storage/state.ts";
import { updateCoordinatorSingleTask } from "../../src/task/queue.ts";
import { acquireCoordinatorSnapshotLease } from "../../src/execution/lease.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/validation.ts";

/**
 * 一回目の助言終了で取得済み参照を保存し、後から別参照を混入できないことを確認する。
 * @responsibility 本番execute分岐の参照投影とterminal guardを実Writerへ接続する。
 * @trace CPR-IT-004
 * @trace PRL-IT-013
 * @precondition Repository-localの新品Git領域と合成選定だけを使用する。
 * @stimulus 清掃不明の助言代役を一回実行し、同参照と別参照で終端を再保存する。
 * @observation 初回Snapshotの元参照と後続Writerの結果を照合する。
 * @oracle HostとDockerが初回に保存され、同参照は受理、別参照追加と別操作は拒否される。
 * @cleanup 自己生成Rootだけを削除し不存在を確認する。
 * @boundary CPR-IT-004=Direct Boundary: 本番Session→実Snapshot Writer。
 */
test("助言の初回終端はHostとDockerのexact参照を保持し後付け混入を拒否する", async (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  assert.equal(fs.realpathSync.native(parent), parent);
  const root = fs.mkdtempSync(path.join(parent, "advice-handoff-"));
  assert.equal(path.dirname(root), parent);
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  execFileSync("git", ["init", "--template=", "--initial-branch=main"], {
    cwd: root,
    windowsHide: true,
    stdio: "ignore",
  });
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n");
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "");
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "core.hooksPath=",
      "commit",
      "--allow-empty",
      "-m",
      "synthetic",
    ],
    { cwd: root, windowsHide: true, stdio: "ignore" },
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_required");
  const saved = saveRepositoryAiSelection(
    verified.capability,
    { expectedIdentity: null, config: selectionConfig() },
    () => true,
    getAiModelCatalog().catalog,
  );
  assert.equal(saved.status, "saved");
  const hostId = "host.synthetic-handoff";
  const dockerId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
  let calls = 0;
  const adviceUrl = new URL("../../src/execution/advice.ts", import.meta.url)
    .href;
  const advice = await import(adviceUrl);
  mock.module(adviceUrl, {
    namedExports: {
      ...advice,
      runRepositoryAdvice: async () => {
        calls++;
        return {
          result: { status: "unknown", reason: "synthetic_cleanup_unknown" },
          cleanupConfirmed: false,
          hostRecoveryId: hostId,
          dockerRecoveryId: dockerId,
        };
      },
    },
  });
  const { openTaskSession } = await import("../../src/task/requests.ts");
  const session = openTaskSession({
    rootCapability: verified.capability,
    projectId: "synthetic-project",
    principalId: "local-user",
    authorize: () => true,
  });
  const accepted = await session.start({
    mode: "read_only_advice",
    workType: null,
    prompt: "synthetic",
    contextReferences: ["PROJECT_CONTEXT.md"],
    allowedPaths: [],
    externalSendConfirmed: true,
    expectedNetworkPolicyHash: "a".repeat(64),
    workspaceId: null,
  });
  assert.equal(accepted.status, "accepted", JSON.stringify(accepted));
  assert.ok(accepted.requestId);
  const outcome = await session.wait(accepted.requestId);
  assert.equal(calls, 1);
  assert.deepEqual(outcome.recoveryIds, [hostId, dockerId]);
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const read = readCoordinatorSnapshot(root, binding);
  assert.equal(read.status, "completed");
  if (read.status !== "completed" || !read.value)
    throw Error("fixture_snapshot_required");
  const entry = read.value.queueEntries.find(
    (item) => item.queueId === accepted.requestId,
  );
  assert.ok(entry?.singleTask);
  assert.deepEqual(entry.singleTask.recoveryIds, [hostId, dockerId]);
  const lease = acquireCoordinatorSnapshotLease(
    root,
    binding,
    entry.projectId,
    entry.queueId,
    "project-operation",
  );
  assert.equal(lease.status, "completed", JSON.stringify(lease));
  if (lease.status !== "completed") throw Error("fixture_lease_required");
  try {
    const same = updateCoordinatorSingleTask(
      root,
      binding,
      entry.queueId,
      entry.generation,
      lease.value,
      entry.singleTask,
    );
    assert.equal(same.status, "completed", JSON.stringify(same));
    if (same.status !== "completed") throw Error("fixture_same_required");
    const other = updateCoordinatorSingleTask(
      root,
      binding,
      entry.queueId,
      same.value.generation,
      lease.value,
      {
        ...entry.singleTask,
        recoveryIds: [...entry.singleTask.recoveryIds, "host.other-operation"],
      },
    );
    assert.equal(other.status, "blocked");
    if (other.status === "blocked")
      assert.equal(
        other.reason,
        "orchestrator_single_task_terminal_identity_conflict",
      );
    assert.equal(
      updateCoordinatorSingleTask(
        root,
        binding,
        entry.queueId,
        same.value.generation,
        lease.value,
        { ...entry.singleTask, operationId: "operation-other" },
      ).status,
      "blocked",
    );
  } finally {
    assert.equal(lease.value.release().status, "completed");
  }
  // 未解決代役のcloseは実回収を発行するため呼ばず、試験所有Rootだけを回収する。
});
