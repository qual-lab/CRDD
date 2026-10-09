/**
 * Repository AI Profile CatalogからWorkbench助言Dispatchまでの統合契約試験。
 *
 * @packageDocumentation
 * @responsibility 空のRepository Store、既定Catalog revision 0、Profile解決およびCoordinator Dispatchを同じSnapshotで接続する。
 * @trace RCM-IT-005
 * @level IT
 * @scope ai-profile-catalog、repository-store、workbench-ai-advice
 * @boundary RCM-IT-005=Direct Boundary: Repository Catalog Store→Workbench AI Application→Advice Dispatch
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  createRepositoryAiProfileCatalogStore,
} from "../../../ai-adapter/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { createRepositoryWorkbenchAiRequests } from "../../src/workbench-ai/repository-composition.ts";
import { createWorkbenchAiAdviceDispatchRuntime } from "../../src/workbench-ai/advice-dispatch.ts";
import type { WorkbenchAiAdviceExecutionPlan } from "../../src/workbench-ai/advice-execution-plan.ts";
import { createWorkbenchAiProviderAdapter } from "../../src/workbench-ai/provider-adapter.ts";

const canonicalRepositoryRoot = path.resolve(
  import.meta.dirname,
  "../../../..",
);
const repositoryRoot = verifyRepositoryRoot(canonicalRepositoryRoot);
if (repositoryRoot.status !== "completed")
  throw new Error("coordinator_test_repository_root_invalid");

/**
 * 空Storeの既定Catalogをrevision 0のまま助言Dispatchへ搬送する。
 *
 * @responsibility 永続Snapshot未作成を不正Catalogや観測不能へ読み替えず、同じProfileとrevisionで実行入力を作る。
 * @trace RCM-IT-005
 * @precondition 隔離Git RepositoryにはProject Contextがあり、Catalog Snapshotは存在しない。
 * @stimulus Repository StoreをProduction Compositionへ渡し、PROFILE-100001で読取り助言を開始する。
 * @observation Store Snapshot、Dispatch入力、依頼結果および最初の採用結果を観測する。
 * @oracle revision 0がexactにDispatchされ、最初の採用だけがrevision 1を公開する。
 * @cleanup 隔離Repositoryを再帰削除する。
 * @boundary RCM-IT-005=Direct Boundary: Repository Catalog Store→Workbench AI Application→Advice Dispatch
 */
test("空のRepository Catalogをrevision 0から助言Dispatchと初回採用へ接続する", async () => {
  const testsRoot = path.join(canonicalRepositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(
    path.join(testsRoot, "workbench-ai-catalog-flow-"),
  );
  try {
    execFileSync("git", ["init", "--initial-branch=main"], {
      cwd: fixture,
      windowsHide: true,
      stdio: "ignore",
    });
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      "# Project Context\n\n現在状態を確認する。\n",
      "utf8",
    );
    const verified = verifyRepositoryRoot(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(adapter.status, "ready");
    assert.ok(adapter.store);
    assert.equal(adapter.store.snapshot().revision, 0);
    const observedPlans: WorkbenchAiAdviceExecutionPlan[] = [];
    const completed = Object.freeze({
      status: "completed" as const,
      reason: null,
      facts: Object.freeze([
        Object.freeze({
          text: "現在状態",
          references: Object.freeze(["PROJECT_CONTEXT.md#project-context"]),
        }),
      ]),
      sharedAnalysis: Object.freeze([
        Object.freeze({
          text: "共有済み分析",
          references: Object.freeze(["PROJECT_CONTEXT.md#project-context"]),
        }),
      ]),
      additionalInferences: Object.freeze([
        Object.freeze({
          text: "追加推論",
          references: Object.freeze(["PROJECT_CONTEXT.md#project-context"]),
        }),
      ]),
      nextOptions: Object.freeze([
        Object.freeze({
          text: "次の選択肢",
          references: Object.freeze(["PROJECT_CONTEXT.md#project-context"]),
        }),
      ]),
      candidate: null,
    });
    const application = createRepositoryWorkbenchAiRequests(
      verified.capability,
      adapter.store,
      createWorkbenchAiAdviceDispatchRuntime(
        createWorkbenchAiProviderAdapter({
          codex: async (executionPlan) => {
            observedPlans.push(executionPlan);
            return Object.freeze({
              status: "completed" as const,
              reason: null,
              rawOutput: JSON.stringify({
                contract: "crdd-coordinator/workbench-ai-advice-result",
                contractRevision: 1,
                status: "completed",
                facts: [
                  {
                    text: "現在状態",
                    references: ["PROJECT_CONTEXT.md"],
                  },
                ],
                sharedAnalysis: [],
                additionalInferences: [],
                nextOptions: [],
              }),
              providerEffectIssued: true,
              cleanupConfirmed: true,
            });
          },
          claude: async () => {
            throw new Error("unexpected_claude_executor");
          },
        }),
      ),
      async () => completed,
    );

    const started = await application.start({
      mode: "read_only_advice",
      profileId: "PROFILE-100001",
      prompt: "現在状態を確認する",
      contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
      allowedPaths: Object.freeze([]),
      externalSendConfirmed: true,
    });
    assert.equal(started.status, "accepted");
    assert.ok(started.requestId);
    let snapshot = await application.observe(started.requestId as string);
    for (
      let attempt = 0;
      attempt < 100 && snapshot.status === "running";
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      snapshot = await application.observe(started.requestId as string);
    }
    assert.equal(snapshot.status, "completed", JSON.stringify(snapshot));
    assert.equal(observedPlans.length, 1);
    const observedPlan = observedPlans[0];
    assert.ok(observedPlan);
    assert.equal(observedPlan.catalogRevision, 0);
    assert.equal(observedPlan.profileId, "PROFILE-100001");
    assert.equal(
      observedPlan.exactModelId,
      DEFAULT_AI_PROFILE_CATALOG.profiles.find(
        (profile) => profile.profileId === "PROFILE-100001",
      )?.exactModelId,
    );

    const adopted = adapter.store.adopt({
      expectedRevision: 0,
      candidate: DEFAULT_AI_PROFILE_CATALOG,
    });
    assert.equal(adopted.status, "adopted");
    if (adopted.status === "adopted")
      assert.equal(adopted.snapshot.revision, 1);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 不連続な耐久Snapshotを既定Catalog revision 0へ補正しない。
 *
 * @responsibility 実File Storeの観測例外をProduction Compositionが理由付きblockedへ変換し、Provider Effectを発行しないことを検証する。
 * @trace RCM-IT-005
 * @precondition 隔離Git RepositoryのCatalog StoreにRevision 2だけが存在する。
 * @stimulus 実Storeと実Dispatch／Provider Adapterを接続して読取り助言を開始する。
 * @observation Application結果とFake Executor呼出し回数を観測する。
 * @oracle Snapshot観測不能としてblockedになり、Executor呼出し0である。
 * @cleanup 隔離Repositoryを再帰削除する。
 * @boundary RCM-IT-005=Direct Boundary: Broken Repository Catalog Store→Workbench AI Application→Provider Effect
 */
test("不連続なRepository Catalogをrevision 0へ補正せずEffect前に拒否する", async () => {
  const testsRoot = path.join(canonicalRepositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(
    path.join(testsRoot, "workbench-ai-catalog-broken-"),
  );
  try {
    execFileSync("git", ["init", "--initial-branch=main"], {
      cwd: fixture,
      windowsHide: true,
      stdio: "ignore",
    });
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      "# Project Context\n\n現在状態を確認する。\n",
      "utf8",
    );
    const catalogDirectory = path.join(
      fixture,
      ".crdd",
      "config",
      "ai-profile-catalog",
    );
    await mkdir(catalogDirectory, { recursive: true });
    await writeFile(
      path.join(catalogDirectory, "catalog-0000000002.json"),
      `${JSON.stringify({
        contract: "crdd/ai-profile-catalog-snapshot",
        contractRevision: 1,
        revision: 2,
        catalog: DEFAULT_AI_PROFILE_CATALOG,
      })}\n`,
      "utf8",
    );
    const verified = verifyRepositoryRoot(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(adapter.status, "ready");
    assert.ok(adapter.store);
    let executorCalls = 0;
    const dispatch = createWorkbenchAiAdviceDispatchRuntime(
      createWorkbenchAiProviderAdapter({
        codex: async () => {
          executorCalls += 1;
          throw new Error("unreachable");
        },
        claude: async () => {
          executorCalls += 1;
          throw new Error("unreachable");
        },
      }),
    );
    const application = createRepositoryWorkbenchAiRequests(
      verified.capability,
      adapter.store,
      dispatch,
      async () => {
        throw new Error("unexpected_change_candidate");
      },
    );
    const started = await application.start({
      mode: "read_only_advice",
      profileId: "PROFILE-100001",
      prompt: "現在状態を確認する",
      contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
      allowedPaths: Object.freeze([]),
      externalSendConfirmed: true,
    });
    assert.equal(started.status, "accepted");
    assert.ok(started.requestId);
    let snapshot = await application.observe(started.requestId as string);
    for (
      let attempt = 0;
      attempt < 100 && snapshot.status === "running";
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      snapshot = await application.observe(started.requestId as string);
    }
    assert.equal(snapshot.status, "blocked", JSON.stringify(snapshot));
    assert.equal(
      snapshot.reason,
      "coordinator_ai_profile_snapshot_unavailable",
    );
    assert.equal(executorCalls, 0);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 連続Revision 1の破損Snapshotを既定Catalog revision 0へ補正しない。
 *
 * @responsibility Envelope／Schema破損をRevision不連続と独立に反証し、Provider Effectを発行しないことを検証する。
 * @trace RCM-IT-005
 * @precondition 隔離Git RepositoryのCatalog Storeに連続Revision 1の不正Envelopeが存在する。
 * @stimulus 実Storeと実Dispatch／Provider Adapterを接続して読取り助言を開始する。
 * @observation Application結果とFake Executor呼出し回数を観測する。
 * @oracle Snapshot破損による観測不能としてblockedになり、Executor呼出し0である。
 * @cleanup 隔離Repositoryを再帰削除する。
 * @boundary RCM-IT-005=Direct Boundary: Corrupt Repository Catalog Store→Workbench AI Application→Provider Effect
 */
test("連続Revisionの破損Repository Catalogをrevision 0へ補正せずEffect前に拒否する", async () => {
  const testsRoot = path.join(canonicalRepositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(
    path.join(testsRoot, "workbench-ai-catalog-corrupt-"),
  );
  try {
    execFileSync("git", ["init", "--initial-branch=main"], {
      cwd: fixture,
      windowsHide: true,
      stdio: "ignore",
    });
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      "# Project Context\n\n現在状態を確認する。\n",
      "utf8",
    );
    const catalogDirectory = path.join(
      fixture,
      ".crdd",
      "config",
      "ai-profile-catalog",
    );
    await mkdir(catalogDirectory, { recursive: true });
    await writeFile(
      path.join(catalogDirectory, "catalog-0000000001.json"),
      "{}\n",
      "utf8",
    );
    const verified = verifyRepositoryRoot(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(adapter.status, "ready");
    assert.ok(adapter.store);
    let executorCalls = 0;
    const dispatch = createWorkbenchAiAdviceDispatchRuntime(
      createWorkbenchAiProviderAdapter({
        codex: async () => {
          executorCalls += 1;
          throw new Error("unreachable");
        },
        claude: async () => {
          executorCalls += 1;
          throw new Error("unreachable");
        },
      }),
    );
    const application = createRepositoryWorkbenchAiRequests(
      verified.capability,
      adapter.store,
      dispatch,
      async () => {
        throw new Error("unexpected_change_candidate");
      },
    );
    const started = await application.start({
      mode: "read_only_advice",
      profileId: "PROFILE-100001",
      prompt: "現在状態を確認する",
      contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
      allowedPaths: Object.freeze([]),
      externalSendConfirmed: true,
    });
    assert.equal(started.status, "accepted");
    assert.ok(started.requestId);
    let snapshot = await application.observe(started.requestId as string);
    for (
      let attempt = 0;
      attempt < 100 && snapshot.status === "running";
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      snapshot = await application.observe(started.requestId as string);
    }
    assert.equal(snapshot.status, "blocked", JSON.stringify(snapshot));
    assert.equal(
      snapshot.reason,
      "coordinator_ai_profile_snapshot_unavailable",
    );
    assert.equal(executorCalls, 0);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
