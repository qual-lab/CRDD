/**
 * 合成診断の説明文観測を、Providerなしで検査する。
 * @packageDocumentation
 * @trace ERB-IT-002
 * @level IT
 * @scope 元normalizerとの同値、表示の閉形式、専用子のModule接続と終了。
 * @boundary 合成JSONLと試験専用観測。実AI／Docker／認証を使わない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createTaskSummaryObservation } from "../../scripts/task-summary-observation.ts";
import { normalizeTaskResult } from "../../src/result/task.ts";
import { parseProviderResult } from "../../../ai-adapter/src/index.ts";
import { containsRecognizedSecretMaterial } from "../../../domain-model/src/index.ts";

const workload = {
  readPathCount: 1,
  allowedPathCount: 1,
  acceptanceCriterionCount: 1,
  remediationFindingCount: 0,
};
const raw = (summary: unknown) =>
  [
    {
      type: "item.completed",
      item: {
        type: "agent_message",
        text: JSON.stringify({
          status: "completed",
          summary,
          changedPaths: [],
          verification: [],
        }),
      },
    },
    { type: "turn.completed" },
  ]
    .map((value) => JSON.stringify(value))
    .join("\n");
const args = (summary: string) =>
  ["codex", "executor", "medium", raw(summary), workload] as const;
const report = (remediation = false) => {
  const events = Array.from({ length: remediation ? 4 : 2 }, (_, index) => ({
    provider: index % 2 === 0 ? "codex" : "claude",
    taskRole: index % 2 === 0 ? "executor" : "reviewer",
    taskAttempt: Math.floor(index / 2),
    operationId: "OP-123456",
    recoveryCorrelationId: "operation-synthetic",
    recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${String(index + 3).repeat(64)}`,
    cleanupConfirmed: true,
    processTreeTerminationObserved: true,
    containersAbsentObserved: true,
    networksAbsentObserved: true,
  }));
  return {
    instrumentedDiagnostic: true,
    sourceUnchanged: true,
    resources: { status: "verified" },
    fixtureRootsRemoved: true,
    fixtureCleanupFailures: [] as string[],
    fixtureRemovalGates: [
      {
        mode: "direct",
        eligible: true,
        reason: "fixture_closed_and_unreferenced",
      },
    ],
    results: [
      {
        mode: "direct",
        requestId: "request-synthetic",
        task: {
          requestId: "request-synthetic",
          cleanupConfirmed: true,
          recoveryIds: [],
        },
        closeConfirmed: true,
        runtimeClean: true,
        workspaceClean: true,
        stageDiagnostic: { events },
        boundaryDiagnostic: { events },
      },
    ],
  };
};

/** 元のreturn objectと例外を変えず、別role・検査失敗・異常順序で表示しない。
 * @trace ERB-IT-002
 * @boundary 合成値だけ。display代役へ渡った文字列はFileへ保存しない。
 */
test("summary観測は元結果を保全し、検査・順序・清掃の不成立を非表示へ閉じる", () => {
  for (const scenario of [
    "ok",
    "remediation",
    "control",
    "path",
    "secret",
    "oversize",
    "parse-throw",
    "screen-throw",
    "zero",
    "extra",
    "wrong-role",
    "two-tasks",
    "cleanup-unknown",
    "fixture-retained",
    "fixture-missing",
    "write-failed",
    "display-throw",
  ] as const) {
    let normalizations = 0;
    const returned = normalizeTaskResult(...args("synthetic"));
    const observer = createTaskSummaryObservation({
      normalize: () => {
        normalizations++;
        return returned;
      },
      parse:
        scenario === "parse-throw"
          ? () => {
              throw Error("PRIVATE");
            }
          : parseProviderResult,
      secret:
        scenario === "screen-throw"
          ? () => {
              throw Error("PRIVATE");
            }
          : containsRecognizedSecretMaterial,
    });
    const summary =
      scenario === "control"
        ? "text\nPRIVATE"
        : scenario === "path"
          ? "Look at C:\\PRIVATE\\file"
          : scenario === "secret"
            ? `api_key=sk-${"a".repeat(32)}`
            : scenario === "oversize"
              ? "あ".repeat(683)
              : "The tool was unavailable.";
    if (scenario !== "zero") {
      assert.equal(
        scenario === "wrong-role"
          ? observer.wrapped("claude", "reviewer", "medium", "{}", workload)
          : observer.wrapped(...args(summary)),
        returned,
      );
      assert.equal(
        observer.wrapped("claude", "reviewer", "medium", "{}", workload),
        returned,
      );
    }
    if (scenario === "extra")
      assert.equal(observer.wrapped(...args(summary)), returned);
    if (scenario === "remediation") {
      assert.equal(
        observer.wrapped(...args("SECOND_PRIVATE_SUMMARY")),
        returned,
      );
      assert.equal(
        observer.wrapped("claude", "reviewer", "medium", "{}", workload),
        returned,
      );
    }
    const outer = report(scenario === "remediation");
    const row = outer.results[0];
    assert.ok(row);
    if (scenario === "two-tasks") outer.results.push(row);
    if (scenario === "cleanup-unknown") row.closeConfirmed = false;
    if (scenario === "fixture-retained") {
      outer.fixtureRootsRemoved = false;
      outer.fixtureCleanupFailures = ["direct_fixture_removal_failed"];
      outer.fixtureRemovalGates = [
        {
          mode: "direct",
          eligible: false,
          reason: "fixture_cleanup_unconfirmed",
        },
      ];
    }
    if (scenario === "fixture-missing") outer.fixtureRemovalGates = [];
    const input =
      scenario === "write-failed"
        ? { ...outer, resultWriteFailure: "verification_result_write_failed" }
        : outer;
    const displayed: string[] = [];
    const result = observer.finish(input, (text) => {
      if (scenario === "display-throw") throw Error("PRIVATE");
      displayed.push(text);
    });
    const expectedDisplay = ["ok", "remediation", "fixture-retained"].includes(
      scenario,
    );
    assert.equal(result.displayed, expectedDisplay);
    assert.deepEqual(displayed, expectedDisplay ? [summary] : []);
    assert.equal(
      observer.finish(outer, () => {
        throw Error("second display");
      }).displayed,
      false,
    );
    assert.equal(
      normalizations,
      scenario === "zero"
        ? 0
        : scenario === "extra"
          ? 3
          : scenario === "remediation"
            ? 4
            : 2,
    );
  }
  const failure = {};
  const observer = createTaskSummaryObservation({
    normalize: () => {
      throw failure;
    },
    parse: parseProviderResult,
    secret: containsRecognizedSecretMaterial,
  });
  assert.throws(
    () => observer.wrapped(...args("synthetic")),
    (error) => error === failure,
  );
  assert.equal(
    observer.finish(report(), () => {
      throw Error("display forbidden");
    }).displayed,
    false,
  );
});

/** 新品子でconsumer import前に実Moduleを観測し、子終了を確認する。
 * @trace ERB-IT-002
 * @boundary 実Controllerと有限Command代役。実Docker・認証・Provider実行・File作成なし。
 */
test("summary観測は新品子Processの正式consumerへ接続する", () => {
  const entry = fileURLToPath(
    new URL(
      "../../../workbench-server/scripts/verify-workspace-summary.ts",
      import.meta.url,
    ),
  );
  for (const argv of [[], ["--external-send-and-summary-confirmed"]]) {
    const rejected = spawnSync(process.execPath, [entry, ...argv], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 4096,
    });
    assert.equal(rejected.error, undefined);
    assert.equal(rejected.signal, null);
    assert.equal(rejected.status, 64);
    assert.equal(rejected.stdout, "");
  }
  const helper = new URL(
    "../../scripts/task-summary-observation.ts",
    import.meta.url,
  ).href;
  const consumer = new URL("../../src/index.ts", import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    const {installTaskSummaryObservation}=await import(${JSON.stringify(helper)});
    const observer=installTaskSummaryObservation();
    try { const module=await import(${JSON.stringify(consumer)});
      const purposes=['create_subscription_auth_probe','start_subscription_auth_probe_attached','create_internal_network','create_egress_network','create_proxy','connect_proxy_egress','create_provider','start_proxy','start_provider_attached'];
      for (const provider of ['codex','claude']) {
        const role=provider==='codex'?'executor':'reviewer';
        const management={}, prepared={}, mount={}, authority={}, recovery={};
        const recoveryId='docker-task.'+'d'.repeat(64)+'.'+'e'.repeat(64)+'.'+'f'.repeat(64);
        const suffix='0101010101010101';
        const plan={provider,consumer:'coordinator_cli',operationId:'OP-123456',
          grantRef:'PHMGRANT-123456',selectionRecordId:'MODELSEL-12345678',taskAttempt:0,
          executionSelection:{provider,modelIdentifier:provider==='codex'?'gpt-6.1-sol':'opus',identifierKind:provider==='codex'?'exact':'alias',reasoningEffort:'medium',purpose:'task',role:provider==='codex'?'executor':'independent_reviewer'},selectionHash:'e'.repeat(64),
          activeMountCapability:mount,authorityUseCapability:authority,
          providerHomeSourcePath:'C:/synthetic-not-accessed/home',providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:'b'.repeat(64),localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64),
          authContainerName:'crdd-auth-'+suffix,providerContainerName:'crdd-'+provider+'-'+suffix,proxyContainerName:'crdd-proxy-'+suffix,internalNetworkName:'crdd-internal-'+suffix,egressNetworkName:'crdd-egress-'+suffix,ownershipLabel:'crdd.coordinator.runtime='+suffix,
          providerImageDigest:'sha256:'+'1'.repeat(64),proxyImageDigest:'sha256:'+'2'.repeat(64),subscriptionOffering:provider==='codex'?'chatgpt_subscription_oauth':'claude_max',selectedModel:provider==='codex'?'gpt-6.1-sol':'opus',selectedEffort:'medium',
          operationMode:'isolated_task',taskRole:role,taskPacketRef:'TASKPKT-'+'A'.repeat(32),taskPacketHash:'a'.repeat(64),providerInput:'synthetic',workspaceSourcePath:'C:/synthetic-not-accessed/work',workspaceMountMode:role==='executor'?'read_write':'read_only',networkPolicy:null,taskWorkload:${JSON.stringify(workload)},commands:purposes.map(purpose=>({purpose,argv:[purpose]}))};
        const resources=[['create_egress_network',plan.egressNetworkName],['create_internal_network',plan.internalNetworkName],['create_provider',plan.providerContainerName],['create_proxy',plan.proxyContainerName],['create_subscription_auth_probe',plan.authContainerName]].map(([purpose,plannedResourceName])=>({purpose,plannedResourceName,dockerId:null,observation:'absent'}));
        const output=provider==='codex'?${JSON.stringify(raw("synthetic"))}:JSON.stringify({type:'result',subtype:'success',is_error:false,num_turns:1,total_cost_usd:0,result:JSON.stringify({decision:'approved',summary:'synthetic',findings:[]})});
        const calls=[];let cleanups=0;
        const runtime=module.createExecutorTestCandidate({
          effectExecutorAvailable:true,verifyRevision:()=>true,consumePreparedPlan:(p,m)=>p===prepared&&m===management?plan:null,
          consumeProviderAuthority:()=>({operationId:plan.operationId,provider,providerHomeMountGrantRef:plan.grantRef,runtimeAuthorityIssued:true,providerEffectAllowed:true}),
          beginRecovery:()=>({status:'ready',recoveryId,recoveryCapability:recovery}),verifyRecoveryBinding:()=>true,
          startCommand:command=>{calls.push(command.purpose);return {started:async()=>true,wait:async()=>({status:0,signal:null,stderr:command.purpose==='start_subscription_auth_probe_attached'&&provider==='codex'?'Logged in using ChatGPT':'',outputExceeded:false,stdout:command.purpose==='start_provider_attached'?output:command.purpose==='start_subscription_auth_probe_attached'&&provider==='claude'?JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',forcedLoginMethod:'claudeai',subscriptionType:'max'}):''}),terminateAndWait:async()=>true};},
          cleanupOwnedResources:async()=>{cleanups++;return {confirmed:true,processTreeTerminated:true,containersAbsent:true,networksAbsent:true,resourceObservations:resources};},
          completeMount:()=>({status:'completed'}),completeRecovery:()=>({status:'completed',recoveryFinalizationCapability:{}}),recordDockerAbsence:()=>true,recordMountCompletion:()=>true,markResourceSubmission:()=>true,recordResourceReceipt:()=>true,recordProviderSubmission:()=>true
        });
        const started=runtime.start(prepared,management);
        assert.equal(started.status,'started',provider);
        const result=await started.completion;
        assert.equal(result.status,'completed',JSON.stringify(result));
        assert.equal(result.cleanupConfirmed,true);assert.equal(cleanups,1);assert.deepEqual(calls,purposes);
      }
      const seen=[];
      assert.equal(observer.finish(${JSON.stringify(report())},text=>seen.push(text)).displayed,true);
      assert.deepEqual(seen,['synthetic']);
    } finally {observer.close();}
    console.log('SUMMARY_CONNECTION_OK');
  `,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15_000, maxBuffer: 4096 },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "SUMMARY_CONNECTION_OK");
});
