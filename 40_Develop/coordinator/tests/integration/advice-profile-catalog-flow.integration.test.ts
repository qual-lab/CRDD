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
import type { AdviceProviderOutcome } from "../../src/execution/advice.ts";
import assert from "node:assert/strict";
import { fixtureNetworkPolicy } from "../fixtures/network-policy.ts";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  defaultAiProfileCatalog,
  createRepositoryAiProfileCatalogStore,
} from "../../../ai-adapter/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { createRepositoryAdviceExecutor } from "../../src/execution/advice.ts";
import { createAdviceDispatch } from "../../src/execution/advice.ts";
import type { ProviderAdviceExecutionPlan } from "../../src/execution/preparation.ts";
import { createProviderAdviceAdapter } from "../../src/execution/advice.ts";
import { readRepositoryNetworkPolicies } from "../../src/index.ts";

const canonicalRepositoryRoot = path.resolve(
  import.meta.dirname,
  "../../../..",
);

/**
 * 公開助言入口のReader・取消・元回復参照を実接続で検査する。
 * @responsibility Root APIと実Context観測を接続し、用途固定Runtime構築・Host失敗分類を有限代役へ置換する。
 * @trace RCM-IT-005
 * @precondition 自己生成Git Repositoryと合成Context、固定Profileがある。
 * @stimulus 正常、欠測、Link、容量境界、取消、Runtime不明を新Processで実行する。
 * @observation 公開結果、Reader／Catalog／Runtime代役の呼出し数と計画、合成Host参照の投影を取得する。
 * @oracle 正常だけ一回実行し、拒否・取消は送信0。不明はcleanup未確認と元参照を保持する。
 * @cleanup 自己生成Repositoryを既存のtests Root内だけで回収する。
 * @boundary RCM-IT-005=Direct Boundary: Package Root→実Domain Reader／用途固定Runtime・Host分類代役。Operation／Home／Packet／Controllerの終端は既存別Suiteで確認する。
 */
test("共通公開助言入口はContext境界・取消・回収不明を一回実行へ結合する", async () => {
  const testsRoot = path.join(canonicalRepositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testsRoot, "advice-public-entry-"));
  try {
    execFileSync("git", ["init", "--initial-branch=main"], {
      cwd: fixture,
      stdio: "ignore",
      windowsHide: true,
    });
    const moduleUrl = (relative: string) =>
      pathToFileURL(path.join(canonicalRepositoryRoot, relative)).href;
    const script = `
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { verifyRepositoryRoot } from ${JSON.stringify(moduleUrl("40_Develop/version-control/src/index.ts"))};
import { defaultAiProfileCatalog } from ${JSON.stringify(moduleUrl("40_Develop/ai-adapter/src/index.ts"))};
import { fixtureNetworkPolicy } from ${JSON.stringify(moduleUrl("40_Develop/coordinator/tests/fixtures/network-policy.ts"))};
const fixture = ${JSON.stringify(fixture)};
const scenario = process.argv[1];
const target = path.join(fixture, "PROJECT_CONTEXT.md");
fs.writeFileSync(target, scenario === "limit" ? "x".repeat(65536) : scenario === "over" ? "x".repeat(65537) : "# Project Context\\n合成情報\\n");
if (scenario === "missing") fs.unlinkSync(target);
if (scenario === "link") { fs.renameSync(target, path.join(fixture, "context.md")); fs.symlinkSync(path.join(fixture,"context.md"), target, "file"); }
const controller = new AbortController();
let reads = 0, catalogs = 0, calls = 0;
const domainUrl = ${JSON.stringify(moduleUrl("40_Develop/domain-model/src/index.ts"))};
const domain = await import(domainUrl);
mock.module(domainUrl, { namedExports: { ...domain, createFilesystemRepositoryObservationPort: (...args) => {
  const observer = domain.createFilesystemRepositoryObservationPort(...args);
  return { ...observer, observeFile: reference => { reads++; assert.equal(reference, "PROJECT_CONTEXT.md"); const result = observer.observeFile(reference); if (scenario === "cancel_after_read") controller.abort(); return result; } };
} } });
const host = "host.synthetic-exact-reference";
globalThis.adviceFixture = {
  runtime: () => async (plan, signal) => {
    calls++; assert.equal(signal, controller.signal); assert.equal(plan.repositoryMounted,false); assert.equal(plan.workspaceMounted,false); assert.equal(plan.provider,"codex");
    if (scenario === "runtime_throw") throw new Error("synthetic");
    if (scenario === "cleanup_unknown") return { status:"blocked",reason:"synthetic_cleanup_unknown",adviceJson:null,providerEffectIssued:true,cleanupConfirmed:false };
    return {status:"completed",reason:null,adviceJson:JSON.stringify({contract:"crdd-coordinator/workbench-ai-advice-result",contractRevision:1,status:"completed",facts:[{text:"合成",references:["PROJECT_CONTEXT.md"]}],sharedAnalysis:[],additionalInferences:[],nextOptions:[]}),providerEffectIssued:true,cleanupConfirmed:true};
  },
  failure: value => value && !value.cleanupConfirmed ? {cleanupConfirmed:false,manualRecoveryRequired:true,hostRecoveryId:host} : null,
};
const adviceUrl = ${JSON.stringify(moduleUrl("40_Develop/coordinator/src/execution/advice.ts"))};
let adviceSource = stripTypeScriptTypes(fs.readFileSync(new URL(adviceUrl), "utf8"));
for (const [original, replacement] of [
  ["createRuntimeOwnedProviderAdviceRuntime(root, observation)", "globalThis.adviceFixture.runtime(root, observation)"],
  ["classifyProviderAdviceHostFailure(observed)", "globalThis.adviceFixture.failure(observed)"],
]) {
  assert.equal(adviceSource.split(original).length, 2);
  adviceSource = adviceSource.replace(original, replacement);
}
adviceSource = adviceSource.replace(/from "(\\.[^"]+)"/g, (_, specifier) => "from " + JSON.stringify(new URL(specifier, adviceUrl).href));
const adviceFixture = await import("data:text/javascript;base64," + Buffer.from(adviceSource).toString("base64"));
mock.module(adviceUrl, { namedExports: adviceFixture });
const { runRepositoryAdvice } = await import(${JSON.stringify(moduleUrl("40_Develop/coordinator/src/index.ts"))});
const verified = verifyRepositoryRoot(fixture); assert.equal(verified.status,"completed");
const profiles = {snapshot:()=>{catalogs++;if(scenario === "cancel_after_catalog")controller.abort();return {status:"read",error:null,value:{revision:0,catalog:defaultAiProfileCatalog}}},adopt:()=>{throw new Error("not_used")}};
if(scenario === "cancel_before")controller.abort();
const response=await runRepositoryAdvice(verified.capability,profiles,{mode:"read_only_advice",profileId:"PROFILE-100001",prompt:"合成状態を説明",contextReferences:["PROJECT_CONTEXT.md"],allowedPaths:[],externalSendConfirmed:true,expectedNetworkPolicyHash:fixtureNetworkPolicy("codex").policyHash},controller.signal);
const success=scenario === "normal" || scenario === "limit";
assert.equal(response.result.status,success?"completed":scenario === "cleanup_unknown" || scenario === "runtime_throw" ? "unknown":"blocked");
assert.equal(calls,success || scenario === "cleanup_unknown" || scenario === "runtime_throw" ? 1:0);
if(scenario === "cancel_before"){assert.equal(reads,0);assert.equal(catalogs,0)}
if(scenario === "cancel_after_read")assert.equal(catalogs,0);
assert.equal(response.cleanupConfirmed,scenario !== "cleanup_unknown" && scenario !== "runtime_throw");
assert.equal(response.hostRecoveryId,scenario === "cleanup_unknown"?host:null);
assert.equal(Object.hasOwn(response,"rawOutput"),false);
process.stdout.write("verified");
`;
    for (const scenario of [
      "normal",
      "limit",
      "over",
      "missing",
      "link",
      "cancel_before",
      "cancel_after_read",
      "cancel_after_catalog",
      "cleanup_unknown",
      "runtime_throw",
    ]) {
      await rm(path.join(fixture, "PROJECT_CONTEXT.md"), { force: true });
      const output = execFileSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--input-type=module",
          "-e",
          script,
          scenario,
        ],
        {
          cwd: fixture,
          encoding: "utf8",
          windowsHide: true,
          timeout: 15_000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      assert.equal(output, "verified", scenario);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
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
    assert.equal(adapter.store.snapshot().value?.revision, 0);
    const observedPlans: ProviderAdviceExecutionPlan[] = [];
    const application = createRepositoryAdviceExecutor(
      verified.capability,
      adapter.store,
      createAdviceDispatch(
        createProviderAdviceAdapter(async (plan) => {
          const executors: Record<
            "codex" | "claude",
            (
              plan: ProviderAdviceExecutionPlan,
            ) => Promise<AdviceProviderOutcome>
          > = {
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
          };
          const outcome = await executors[plan.provider](plan);
          if (
            outcome.status === "completed" &&
            typeof outcome.rawOutput === "string"
          )
            return {
              status: "completed" as const,
              reason: null,
              adviceJson: outcome.rawOutput,
              providerEffectIssued: true as const,
              cleanupConfirmed: true as const,
            };
          return {
            status: "blocked" as const,
            reason: outcome.reason ?? "fixture_blocked",
            adviceJson: null,
            providerEffectIssued: outcome.providerEffectIssued,
            cleanupConfirmed: outcome.cleanupConfirmed,
          };
        }),
      ),
    );

    const snapshot = await application(
      {
        mode: "read_only_advice",
        profileId: "PROFILE-100001",
        prompt: "現在状態を確認する",
        contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
        allowedPaths: Object.freeze([]),
        expectedNetworkPolicyHash: fixtureNetworkPolicy("codex").policyHash,
        externalSendConfirmed: true,
      },
      new AbortController().signal,
    );
    assert.equal(snapshot.status, "completed", JSON.stringify(snapshot));
    assert.equal(observedPlans.length, 1);
    const observedPlan = observedPlans[0];
    assert.ok(observedPlan);
    assert.equal(observedPlan.catalogRevision, 0);
    assert.equal(observedPlan.profileId, "PROFILE-100001");
    assert.equal(
      observedPlan.exactModelId,
      defaultAiProfileCatalog.profiles.find(
        (profile) => profile.profileId === "PROFILE-100001",
      )?.exactModelId,
    );

    const confirmedRequest = {
      mode: "read_only_advice" as const,
      profileId: "PROFILE-100001",
      prompt: "現在状態を確認する",
      contextReferences: ["PROJECT_CONTEXT.md"],
      allowedPaths: [],
      externalSendConfirmed: true,
      expectedNetworkPolicyHash: fixtureNetworkPolicy("codex").policyHash,
    };
    for (const hash of [
      "",
      "wrong",
      fixtureNetworkPolicy("claude").policyHash,
    ]) {
      const refused = await application(
        { ...confirmedRequest, expectedNetworkPolicyHash: hash },
        new AbortController().signal,
      );
      assert.equal(refused.reason, "coordinator_ai_network_policy_changed");
      assert.equal(observedPlans.length, 1);
    }
    const networkFile = path.join(
      fixture,
      ".crdd",
      "config",
      "network-policy.json",
    );
    await mkdir(path.dirname(networkFile), { recursive: true });
    await writeFile(
      networkFile,
      JSON.stringify({ version: 1, allowedHosts: ["pypi.org"] }),
    );
    assert.equal(
      (await application(confirmedRequest, new AbortController().signal))
        .reason,
      "coordinator_ai_network_policy_changed",
    );
    assert.equal(observedPlans.length, 1);
    const next = readRepositoryNetworkPolicies(verified.capability);
    if (next.status !== "ready") assert.fail();
    assert.equal(
      (
        await application(
          {
            ...confirmedRequest,
            expectedNetworkPolicyHash: next.policies.codex.policyHash,
          },
          new AbortController().signal,
        )
      ).status,
      "completed",
    );
    assert.equal(observedPlans.length, 2);
    assert.ok(
      observedPlan.providerCommand.networkPolicy?.allowedHosts.includes(
        "registry.npmjs.org",
      ),
    );
    assert.equal(
      observedPlans[1]?.providerCommand.networkPolicy?.allowedHosts.includes(
        "registry.npmjs.org",
      ),
      false,
    );
    await writeFile(networkFile, "invalid");
    assert.equal(
      (
        await application(
          {
            ...confirmedRequest,
            expectedNetworkPolicyHash: next.policies.codex.policyHash,
          },
          new AbortController().signal,
        )
      ).reason,
      "coordinator_ai_network_policy_changed",
    );
    assert.equal(observedPlans.length, 2);

    const adopted = adapter.store.adopt({
      expectedRevision: 0,
      candidate: defaultAiProfileCatalog,
    });
    assert.equal(adopted.status, "adopted", JSON.stringify(adopted));
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
        catalog: defaultAiProfileCatalog,
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
    const dispatch = createAdviceDispatch(
      createProviderAdviceAdapter(async (plan) => {
        const executors: Record<
          "codex" | "claude",
          (plan: ProviderAdviceExecutionPlan) => Promise<AdviceProviderOutcome>
        > = {
          codex: async () => {
            executorCalls += 1;
            throw new Error("unreachable");
          },
          claude: async () => {
            executorCalls += 1;
            throw new Error("unreachable");
          },
        };
        const outcome = await executors[plan.provider](plan);
        if (
          outcome.status === "completed" &&
          typeof outcome.rawOutput === "string"
        )
          return {
            status: "completed" as const,
            reason: null,
            adviceJson: outcome.rawOutput,
            providerEffectIssued: true as const,
            cleanupConfirmed: true as const,
          };
        return {
          status: "blocked" as const,
          reason: outcome.reason ?? "fixture_blocked",
          adviceJson: null,
          providerEffectIssued: outcome.providerEffectIssued,
          cleanupConfirmed: outcome.cleanupConfirmed,
        };
      }),
    );
    const application = createRepositoryAdviceExecutor(
      verified.capability,
      adapter.store,
      dispatch,
    );
    const snapshot = await application(
      {
        mode: "read_only_advice",
        profileId: "PROFILE-100001",
        prompt: "現在状態を確認する",
        contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
        allowedPaths: Object.freeze([]),
        expectedNetworkPolicyHash: fixtureNetworkPolicy("codex").policyHash,
        externalSendConfirmed: true,
      },
      new AbortController().signal,
    );
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
    const dispatch = createAdviceDispatch(
      createProviderAdviceAdapter(async (plan) => {
        const executors: Record<
          "codex" | "claude",
          (plan: ProviderAdviceExecutionPlan) => Promise<AdviceProviderOutcome>
        > = {
          codex: async () => {
            executorCalls += 1;
            throw new Error("unreachable");
          },
          claude: async () => {
            executorCalls += 1;
            throw new Error("unreachable");
          },
        };
        const outcome = await executors[plan.provider](plan);
        if (
          outcome.status === "completed" &&
          typeof outcome.rawOutput === "string"
        )
          return {
            status: "completed" as const,
            reason: null,
            adviceJson: outcome.rawOutput,
            providerEffectIssued: true as const,
            cleanupConfirmed: true as const,
          };
        return {
          status: "blocked" as const,
          reason: outcome.reason ?? "fixture_blocked",
          adviceJson: null,
          providerEffectIssued: outcome.providerEffectIssued,
          cleanupConfirmed: outcome.cleanupConfirmed,
        };
      }),
    );
    const application = createRepositoryAdviceExecutor(
      verified.capability,
      adapter.store,
      dispatch,
    );
    const snapshot = await application(
      {
        mode: "read_only_advice",
        profileId: "PROFILE-100001",
        prompt: "現在状態を確認する",
        contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
        allowedPaths: Object.freeze([]),
        expectedNetworkPolicyHash: fixtureNetworkPolicy("codex").policyHash,
        externalSendConfirmed: true,
      },
      new AbortController().signal,
    );
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
