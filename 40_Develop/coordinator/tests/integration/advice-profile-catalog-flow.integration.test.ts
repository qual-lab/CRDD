/**
 * RepositoryのAI選択設定から固定助言実行までを検証する。
 *
 * @packageDocumentation
 * @responsibility 新形式の設定保存・選定と、Context読取り・一回配送・取消・失敗を接続する。
 * @trace RCM-IT-005
 * @level IT
 * @scope ai-profile-catalog、repository-store、workbench-ai-advice
 * @boundary RCM-IT-005=Direct Boundary: Repository Catalog Store→Workbench AI Application→Advice Dispatch
 */
import assert from "node:assert/strict";
import { fixtureNetworkPolicy } from "../fixtures/network-policy.ts";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { existsSync } from "node:fs";
import { selectionConfig } from "../fixtures/ai-selection.ts";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "../../src/storage/ai-selection.ts";
import { resolveExecutionSelection } from "../../src/selection/resolve.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { createRepositoryAdviceExecutor } from "../../src/execution/advice.ts";
import { createAdviceDispatch } from "../../src/execution/advice.ts";
import type { ProviderAdviceExecutionPlan } from "../../src/execution/preparation.ts";
import { createProviderAdviceAdapter } from "../../src/execution/advice.ts";

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
    /**
     * 試験Processのimport先を本体Rootへ結合する。
     * @responsibility 固定した相対Sourceだけを検証済みRootのfile URLへ変換する。
     * @trace RCM-IT-005
     * @precondition 呼出し側の固定合成値又は既存Sourceを使用する。
     * @stimulus 引数を同じ正規codec又は固定Rootへ接続する。
     * @observation 呼出し元が照合する値と相関。
     * @oracle 元値・拒否条件を補完又は緩和しない。
     * @cleanup 局所値のみ。物理試験物は呼出しCaseが回収する。
     * @boundary 既存契約の試験内接続。実AI・Dockerを実行しない。
     */
    const moduleUrl = (relative: string) =>
      pathToFileURL(path.join(canonicalRepositoryRoot, relative)).href;
    const script = `
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { verifyRepositoryRoot } from ${JSON.stringify(moduleUrl("40_Develop/version-control/src/index.ts"))};
import { executionSelection } from ${JSON.stringify(moduleUrl("40_Develop/coordinator/tests/fixtures/ai-selection.ts"))};
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
if(scenario === "cancel_before")controller.abort();
const response=await runRepositoryAdvice(verified.capability,{mode:"read_only_advice",executionSelection:executionSelection("advice"),prompt:"合成状態を説明",contextReferences:["PROJECT_CONTEXT.md"],allowedPaths:[],externalSendConfirmed:true,expectedNetworkPolicyHash:fixtureNetworkPolicy("codex").policyHash},controller.signal);
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

/**
 * 新設定の保存・選定・助言配送を同じRepositoryで接続する。
 * @responsibility 空設定の既定補完をせず、受付後の設定変更を実行へ反映しない。
 * @trace RCM-IT-005
 * @precondition 自己生成Git Repositoryと合成Contextだけ。
 * @stimulus 設定を保存し一回選定後、設定を書き換えて元選定で配送する。
 * @observation 設定Identity、計画の完全選定、ModelとEffortを確認する。
 * @oracle 新設定は更新されても実行計画は受付時の値を保持する。
 * @cleanup 自己生成Rootだけを回収して不存在確認。
 * @boundary RCM-IT-005=Direct Boundary: 実設定Store→選定→助言Adapter代役。
 */
test("Repository設定の更新後も受付時の完全選定だけを助言へ搬送する", async () => {
  const parent = path.join(canonicalRepositoryRoot, ".crdd", "tests");
  const fixture = await mkdtemp(path.join(parent, "advice-selection-flow-"));
  assert.equal(path.dirname(fixture), parent);
  try {
    execFileSync("git", ["init", "--template=", "--initial-branch=main"], {
      cwd: fixture,
      windowsHide: true,
      stdio: "ignore",
    });
    await mkdir(path.join(fixture, ".git", "info"), { recursive: true });
    await writeFile(
      path.join(fixture, ".git", "info", "exclude"),
      ".crdd/\n",
      "utf8",
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      "# Project Context\n\n合成情報\n",
      "utf8",
    );
    const root = verifyRepositoryRoot(fixture);
    assert.equal(root.status, "completed");
    if (root.status !== "completed") throw Error("root_invalid");
    assert.equal(readRepositoryAiSelection(root.capability).status, "missing");
    const saved = saveRepositoryAiSelection(
      root.capability,
      { expectedIdentity: null, config: selectionConfig() },
      () => true,
    );
    assert.equal(saved.status, "saved", JSON.stringify(saved));
    if (saved.status !== "saved") throw Error("save_failed");
    const selected = resolveExecutionSelection(saved.snapshot.config, {
      role: "advice",
      workType: null,
    });
    assert.equal(selected.status, "resolved");
    if (selected.status !== "resolved") throw Error("selection_failed");
    const base = selectionConfig();
    const next = {
      ...base,
      roleDefaults: {
        ...base.roleDefaults,
        advice: { ...base.roleDefaults.advice, effort: "low" },
      },
    };
    const changed = saveRepositoryAiSelection(
      root.capability,
      { expectedIdentity: saved.snapshot.identity, config: next },
      () => true,
    );
    assert.equal(changed.status, "saved");
    if (changed.status !== "saved") throw Error("change_failed");
    assert.notEqual(changed.snapshot.identity, saved.snapshot.identity);
    const plans: ProviderAdviceExecutionPlan[] = [];
    const dispatch = createAdviceDispatch(
      createProviderAdviceAdapter(async (plan) => {
        plans.push(plan);
        return {
          status: "completed",
          reason: null,
          adviceJson: JSON.stringify({
            contract: "crdd-coordinator/workbench-ai-advice-result",
            contractRevision: 1,
            status: "completed",
            facts: [{ text: "合成", references: ["PROJECT_CONTEXT.md"] }],
            sharedAnalysis: [],
            additionalInferences: [],
            nextOptions: [],
          }),
          providerEffectIssued: true,
          cleanupConfirmed: true,
        };
      }),
    );
    const application = createRepositoryAdviceExecutor(
      root.capability,
      dispatch,
    );
    const result = await application(
      {
        mode: "read_only_advice",
        executionSelection: selected.value,
        prompt: "合成情報を説明",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: [],
        externalSendConfirmed: true,
        expectedNetworkPolicyHash: fixtureNetworkPolicy(selected.value.provider)
          .policyHash,
      },
      new AbortController().signal,
    );
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.equal(plans.length, 1);
    assert.deepEqual(plans[0]?.executionSelection, selected.value);
    assert.equal(plans[0]?.reasoningEffort, "medium");
    assert.equal(
      plans[0]?.executionSelection.configIdentity,
      saved.snapshot.identity,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
    assert.equal(existsSync(fixture), false);
  }
});

/**
 * 旧設定と不正設定を新規選定で補完しない。
 * @responsibility 旧Profileや壊れたJSONを空設定・別Modelの成功へ変換しない。
 * @trace RCM-IT-005
 * @precondition 自己生成Repositoryへ不正設定だけを置く。
 * @stimulus 新形式ReaderとResolverを呼ぶ。
 * @observation 読取り拒否と選定拒否を確認する。
 * @oracle 観測不能はmissingではなくblockedとなる。
 * @cleanup 自己生成Rootだけを回収し不存在確認。
 * @boundary RCM-IT-005=Direct Boundary: 実Filesystem→設定Reader。
 */
test("旧Profile設定と破損設定を既定Modelへ補正しない", async () => {
  const parent = path.join(canonicalRepositoryRoot, ".crdd", "tests");
  const fixture = await mkdtemp(path.join(parent, "advice-selection-invalid-"));
  assert.equal(path.dirname(fixture), parent);
  try {
    execFileSync("git", ["init", "--template=", "--initial-branch=main"], {
      cwd: fixture,
      windowsHide: true,
      stdio: "ignore",
    });
    const root = verifyRepositoryRoot(fixture);
    assert.equal(root.status, "completed");
    if (root.status !== "completed") throw Error("root_invalid");
    await mkdir(path.join(fixture, ".crdd", "config"), { recursive: true });
    for (const body of ['{"profiles":[]}', '{"contract":"crdd/ai-selection"']) {
      await writeFile(
        path.join(fixture, ".crdd", "config", "ai-selection.json"),
        body,
        "utf8",
      );
      const read = readRepositoryAiSelection(root.capability);
      assert.equal(read.status, "blocked");
      assert.equal(read.snapshot, null);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
    assert.equal(existsSync(fixture), false);
  }
});
