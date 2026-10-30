/**
 * 単段試験CLIを外部AI・Docker・実Homeなしで検査する。
 * @responsibility 純粋計画・Effect前拒否・子内の取消と限定清掃を反証する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope 合成Native／Lease／HostとRepository-local新品Rootだけ。
 * @boundary 実AI・認証・Worker終了の成立ではない。
 */
import assert from "node:assert/strict";
import { spawnSync, fork } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import test from "node:test";

/**
 * 固定Taskの構築と合成FileのOracleを外部実行なしで検査する。
 * @responsibility 両Provider三用途と未知File・内容差・実体差の保持を反証する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @effect 新品のRepository-local合成領域だけ。
 * @boundary Docker・Native・認証・外部AIは使用しない。
 */
test("固定Task試験は両Providerの計画と実Fileの相関を検査する", async () => {
  const api = await import("../../scripts/task-trial.ts");
  const parent = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  for (const provider of ["codex", "claude"] as const)
    for (const mode of ["edit", "review", "cancel"] as const) {
      const spec = api.describeTaskTrial(provider, mode);
      const root = fs.mkdtempSync(path.join(parent, "task-oracle-"));
      const home = {
        provider,
        providerHomeIdentityHash: "a".repeat(64),
        providerHomeProtectionHash: "b".repeat(64),
        localUserBindingHash: "c".repeat(64),
        stableLogicalHomeBindingHash: "d".repeat(64),
      };
      const plan = api.buildTaskTrialPlan(
        spec,
        root,
        home,
        "C:\\synthetic-home-not-used",
      );
      assert.equal(plan.operationMode, "isolated_task");
      assert.equal(plan.providerInput, spec.prompt);
      assert.equal(
        plan.workspaceMountMode,
        mode === "review" ? "read_only" : "read_write",
      );
      assert.equal(plan.taskRole, mode === "review" ? "reviewer" : "executor");
      const receipt = api.createTaskTrialFixture(root, mode);
      const source = path.join(root, "work", "source.txt");
      if (mode === "edit") fs.writeFileSync(source, api.TASK_TRIAL_TEXT);
      const normalized =
        mode === "review"
          ? { decision: "approved", findingCount: 0 }
          : { status: "completed", changedPaths: ["source.txt"] };
      if (mode !== "cancel")
        assert.equal(
          api.verifyTaskTrialResult(root, mode, receipt, normalized),
          true,
        );
      assert.equal(
        api.inspectTaskTrialFixture(root, mode, {
          ...receipt,
          rootIdentity: "0:0:0",
        }),
        false,
      );
      fs.writeFileSync(source, "partial");
      assert.equal(api.inspectTaskTrialFixture(root, mode, receipt), false);
      assert.equal(api.cleanupTaskTrialFixture(root, mode, receipt), false);
      fs.writeFileSync(
        source,
        mode === "cancel" ? "BASE\n" : api.TASK_TRIAL_TEXT,
      );
      const unknown = path.join(root, "work", "unknown.txt");
      fs.writeFileSync(unknown, "synthetic");
      assert.equal(api.cleanupTaskTrialFixture(root, mode, receipt), false);
      fs.unlinkSync(unknown);
      assert.equal(api.cleanupTaskTrialFixture(root, mode, receipt), true);
      fs.rmdirSync(root);
      assert.equal(fs.existsSync(root), false);
    }
});

/**
 * 明示起動前の計画と拒否は外部境界を開かない。
 * @responsibility import・describe・不正Provider・不正引数をEffect前に閉じる。
 * @trace ERB-IT-002
 * @precondition Node子内で外部Process／Native／Lockを禁止する。
 * @stimulus 両Provider計画と不正CLI。
 * @observation 固定Model・Image・Prompt、拒否と呼出し零。
 * @oracle Repo非mount・tools/session無効とexact選択を維持する。
 * @cleanup N/A: Root作成前に閉じる。
 * @boundary 計画取得だけで利用可能性を保証しない。
 */
test("単段CLIの計画・Effect前拒否を確認する", () => {
  const entry = new URL(
    "../../scripts/verify-provider-real.ts",
    import.meta.url,
  ).href;
  const platform = new URL(
    "../../../platform-access/src/index.ts",
    import.meta.url,
  ).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';import cp from 'node:child_process';
    import {mock} from 'node:test';import {syncBuiltinESMExports,registerHooks} from 'node:module';
    registerHooks({resolve(s,c,n){const r=n(s,c);if(r.url.includes('/coordinator/'))throw Error('coordinator_forbidden');return r;}});
    for(const name of ['spawn','spawnSync','fork','exec','execSync','execFile','execFileSync'])cp[name]=()=>{throw Error('external_process_forbidden');};syncBuiltinESMExports();
    const platform=await import(${JSON.stringify(platform)});let calls=0;
    const forbidden=()=>{calls++;throw Error('platform_forbidden');};
    mock.module(${JSON.stringify(platform)},{namedExports:{...platform,observeWindowsProviderHome:forbidden,acquireNamedPipeKernelLock:forbidden,readConfirmationCodeOutcome:forbidden}});
    const api=await import(${JSON.stringify(entry)});
    for(const provider of ['codex','claude']){const spec=api.describeStandaloneProviderTrial(provider);assert.equal(spec.model,provider==='codex'?'gpt-6.1-sol':'claude-opus-5-5');assert.equal(spec.effort,'medium');assert.equal(spec.maximumProviderRequests,1);assert.equal(spec.repositoryMounted,false);assert.equal(spec.workspaceMounted,false);assert.equal(spec.toolsAllowed,false);assert.equal(spec.sessionPersistenceAllowed,false);assert.match(spec.providerImageDigest,/^sha256:[a-f0-9]{64}$/);}
    assert.throws(()=>api.describeStandaloneProviderTrial('other'));
    await assert.rejects(api.runStandaloneProviderTrialCli(['--run','other','fixture-12345678']));
    await assert.rejects(api.runStandaloneProviderTrialCli(['--run','codex','../bad']));

    await assert.rejects(api.runStandaloneProviderTrialCli(['--run','codex','fixture-12345678','unknown']));
    assert.equal(calls,0);
  `,
    ],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

/**
 * 正式Schema・合成指示・実Envelope解析と内容検査を接続する。
 * @responsibility 手組みの正規化結果で本番解析を迂回しない。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition Home観測・NamedPipe Lease・DI物理処置と清掃観測を有限代役化する。Host・Executor・Parser・Normalizerは実体。
 * @stimulus 両Provider正常、Schema・Identity・項目・参照違反、Transport不成立とCodex重複Key。
 * @observation 固定PromptとSchema、一次理由、技術終端・意味結果、正規化Receipt。
 * @oracle 意味拒否を技術成功へ丸めず、詳細な固定理由だけを返す。
 * @cleanup 代役資源のみの新品Rootを内容・非link確認後に回収する。
 * @boundary 実AIがSchemaへ準拠する証明ではない。生本文は耐久化しない。
 */
test("単段CLIは正式Schemaから実Envelopeと内容検査まで照合する", () => {
  const url = (value: string) => new URL(value, import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID,createHash} from 'node:crypto';
    import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {mock} from 'node:test';
    for(const name of ['spawn','spawnSync','fork','exec','execSync','execFile','execFileSync'])cp[name]=()=>{throw Error('external_process_forbidden');};syncBuiltinESMExports();
    const di=await import(${JSON.stringify(url("../../../docker-isolation/src/index.ts"))});
    const platform=await import(${JSON.stringify(url("../../../platform-access/src/index.ts"))});
    const domain=await import(${JSON.stringify(url("../../../domain-model/src/index.ts"))});
    let fixture=null,live=false,releases=0;
    process.env.LOCALAPPDATA='C:/synthetic-home-not-read'.replaceAll('/',String.fromCharCode(92));
    mock.module(${JSON.stringify(url("../../../platform-access/src/index.ts"))},{namedExports:{...platform,
      observeWindowsProviderHome:provider=>({status:'candidate',provider,processEffectIssued:true,helperExitConfirmed:true,artifactVerifiedBeforeAndAfter:true,filesystemEffectIssued:false,providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:'b'.repeat(64),localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64)}),
      acquireNamedPipeKernelLock:()=>{live=true;return {assertLive:()=>live,release:()=>{releases++;live=false;return true;}};}
    }});
    const purposes=['create_subscription_auth_probe','start_subscription_auth_probe_attached','create_internal_network','create_egress_network','create_proxy','connect_proxy_egress','create_provider','start_proxy','start_provider_attached'];
    mock.module(${JSON.stringify(url("../../../docker-isolation/src/index.ts"))},{namedExports:{...di,
      createDockerIsolationRuntime:({borrowPaths,inspectReceipts})=>{
        let cleanupResult=null,owner=null,recovery=null;
        return {startCommand:()=>{throw Error('primitive_forbidden');},cleanupOwnedResources:()=>{throw Error('duplicate_cleanup');},
          startExecution:(p,r,m,hooks)=>{
            owner=m;recovery=r;assert.equal(p.stdin,fixture.prompt);if(fixture.trialMode==='advice'){assert.ok(p.stdin.includes(JSON.stringify(fixture.schema)));assert.ok(p.stdin.includes('Allowed references: ["synthetic-context"]'));}
            return di.startDockerCommandSessionCandidate(purposes,{
              startCommand:purpose=>({started:async()=>{if(purpose==='start_provider_attached'&&fixture.mode==='task_cancel_duplicate')queueMicrotask(()=>hooks.onExecutionStarted());return true;},wait:async()=>{if(purpose==='start_provider_attached'){if(fixture.mode.startsWith('task_cancel'))await new Promise(r=>fixture.cancelReady=r);if(fixture.mode==='task_edit')fs.writeFileSync(path.join(fixture.root,'work','source.txt'),'EDITED_OK\\n');}return {status:0,signal:null,stderr:'',outputExceeded:false,stdout:
                purpose.startsWith('create_')?String(purposes.indexOf(purpose)+1).repeat(64)+'\\n':
                purpose==='start_subscription_auth_probe_attached'?(fixture.provider==='codex'?'Logged in using ChatGPT\\n':JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',forcedLoginMethod:'claudeai',subscriptionType:'max'})):
                purpose==='start_provider_attached'?fixture.output:''};},terminateAndWait:async()=>{fixture.cancelReady?.();return true;}}),
              cleanup:async()=>{
                assert.equal(live,true);const receipts=inspectReceipts(r),c=p.configuration;assert.ok(receipts);
                const names={create_provider:c.executionContainerName,create_proxy:c.proxyContainerName,create_subscription_auth_probe:c.authenticationContainerName,create_internal_network:c.internalNetworkName,create_egress_network:c.egressNetworkName};
                const resources=Object.entries(names).map(([purpose,plannedResourceName])=>({purpose,plannedResourceName,dockerId:receipts[purpose].dockerId,observation:receipts[purpose].submitted?'absent':'not_requested'}));
                cleanupResult={confirmed:true,processTreeTerminated:true,containersAbsent:true,networksAbsent:true,resourceObservations:resources};return cleanupResult;
              },verifyCleanup:v=>v===cleanupResult?cleanupResult.resourceObservations:null
            },hooks);
          },verifyCleanupOutcome:(v,id,r,m)=>v===cleanupResult&&r===recovery&&m===owner?cleanupResult.resourceObservations:null
        };
      }
    }});
    const api=await import(${JSON.stringify(url("../../scripts/verify-provider-real.ts"))});
    const executor=await import(${JSON.stringify(url("../../src/index.ts"))});
    const repository=fileURLToPath(new URL('../../../',${JSON.stringify(url("../../scripts/verify-provider-real.ts"))}));
    const schema=(await import(${JSON.stringify(url("../../../ai-adapter/src/index.ts"))})).describeAdviceResultSchema();
    for(const provider of ['codex','claude'])for(const mode of ['normal','extra','missing','contract','revision','status','empty','item','reference','transport',...(provider==='codex'?['duplicate']:[]),'task_edit','task_review',...(provider==='codex'?['task_review_command']:[]),'task_cancel','task_cancel_duplicate']){
      const trialMode=mode==='task_edit'?'edit':mode.startsWith('task_review')?'review':mode.startsWith('task_cancel')?'cancel':'advice';
      const spec=api.describeStandaloneProviderTrial(provider,trialMode);if(trialMode==='advice')assert.ok(spec.prompt.includes(JSON.stringify(schema)));assert.equal(createHash('sha256').update(spec.prompt).digest('hex'),spec.promptSha256);
      const item={text:'A pending documentation task.',references:['synthetic-context']};
      const value=trialMode==='review'?{decision:'approved',summary:'synthetic review',findings:[]}:trialMode!=='advice'?{status:'completed',summary:'synthetic edit',changedPaths:['source.txt'],verification:['exact content']}: {status:schema.properties.status.const,facts:[item],sharedAnalysis:[],additionalInferences:[],nextOptions:[item]};
      if(mode==='extra')value.extra=true;if(mode==='missing')delete value.facts;if(mode==='contract')value.contract='wrong';if(mode==='revision')value.contractRevision=99;if(mode==='status')value.status='blocked';if(mode==='empty'){value.facts=[];value.nextOptions=[];}if(mode==='item')value.facts=[{text:'A pending documentation task.'}];if(mode==='reference')value.facts=[{...item,references:['outside-projection']}];
      const raw=mode==='duplicate'?JSON.stringify(value).replace('"status":','"status":"wrong","status":'):JSON.stringify(value);
      const output=provider==='codex'?[...(mode==='task_review_command'?[JSON.stringify({type:'item.started',item:{id:'synthetic-command',type:'command_execution'}})]:[]),JSON.stringify({type:'item.completed',item:{id:'fixture',type:'agent_message',text:raw}}),...(mode==='transport'?[]:[JSON.stringify({type:'turn.completed'})])].join('\\n')+'\\n':JSON.stringify({type:'result',subtype:mode==='transport'?'error':'success',is_error:false,num_turns:1,total_cost_usd:0,...(trialMode==='review'?{result:JSON.stringify(value)}:{structured_output:value})});
      fixture={provider,prompt:spec.prompt,schema,output,mode,trialMode};releases=0;live=false;
      const runId='fixture-'+randomUUID(),root=path.join(repository,'.crdd','tests','executor-real-'+provider+'-'+runId);
      fixture.root=path.join(repository,'.crdd','tests','executor-real-'+provider+'-'+runId);
      const result=await api.runStandaloneProviderTrial(provider,runId,new AbortController().signal,async()=>{},async()=>{},trialMode);
      const reason=mode==='normal'?null:mode==='transport'?'workbench_ai_'+provider+'_completion_invalid':['extra','missing','duplicate','contract','revision'].includes(mode)?'workbench_ai_advice_result_schema_invalid':mode==='status'?'workbench_ai_advice_result_identity_invalid':'workbench_ai_advice_result_items_invalid';
      assert.equal(result.reason,mode==='task_cancel_duplicate'?'trial_cancellation_unconfirmed':mode==='task_cancel'?'provider_operation_cancelled':trialMode!=='advice'?null:reason,provider+':'+mode);assert.equal(result.status,mode==='task_cancel_duplicate'?'blocked':mode==='task_cancel'?'cancelled':mode==='normal'||trialMode!=='advice'?'completed':'blocked');assert.equal(result.contentConfirmed,!mode.startsWith('task_cancel')&&(mode==='normal'||trialMode!=='advice'));assert.equal(result.cleanupConfirmed,true);assert.equal(result.releaseConfirmed,true);assert.equal(result.terminalSaved,true);assert.equal(releases,1);assert.equal(live,false);
      assert.equal(result.diagnostic.primaryFailure===null,mode==='normal'||trialMode!=='advice');assert.equal(result.diagnostic.providerProcessStartedObserved,true);if(mode==='task_review_command')assert.equal(result.reviewToolObservation.commandExecutionStartedCount,1);
      const records=fs.readdirSync(root).filter(n=>/^event-[0-9]{3}\\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')));
      assert.equal(records.filter(v=>v.kind==='receipt_recorded').length,5);for(const v of records){assert.equal(v.recoveryId,result.recoveryId);assert.equal(Object.hasOwn(v,'adviceJson'),false);assert.equal(Object.hasOwn(v,'normalizedResult'),false);assert.equal(Object.hasOwn(v,'stdout'),false);}
      const terminal=records.find(v=>v.kind==='terminal_received');assert.equal(terminal.status,mode.startsWith('task_cancel')?'cancelled':mode==='normal'||trialMode!=='advice'?'completed':'blocked');
      if(trialMode!=='advice'){const st=fs.statSync(root,{bigint:true});assert.equal(api.cleanupStandaloneTrialRoot(root,[st.dev,st.ino,st.birthtimeNs].map(String).join(':'),result,trialMode),mode!=='task_cancel_duplicate',JSON.stringify({provider,mode,result,terminal}));if(mode!=='task_cancel_duplicate')continue;const taskApi=await import(${JSON.stringify(url("../../scripts/task-trial.ts"))});assert.equal(taskApi.cleanupTaskTrialFixture(root,trialMode,result.fixtureReceipt),true);}
      assert.equal(fs.lstatSync(root).isSymbolicLink(),false);for(const name of fs.readdirSync(root)){const p=path.join(root,name),s=fs.lstatSync(p);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory()){assert.ok(['tmp','management'].includes(name));assert.equal(fs.readdirSync(p).length,0);}else{assert.equal(s.isFile(),true);assert.equal(s.nlink,1);assert.match(name,/^event-[0-9]{3}\\.json(?:\\.crdd-commit\\.json)?$/);}}
      fs.rmSync(root,{recursive:true});assert.equal(fs.existsSync(root),false);
    }
  `,
    ],
    { encoding: "utf8", timeout: 60000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

/**
 * 子内の元Host接続と失敗時Root保持を代役で確認する。
 * @responsibility 再観測・固定計画・一回開始・取消join・終端後清掃を分離する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition Native・Lease・試験Hostは有限代役、確定JSONだけ実I/O。
 * @stimulus 正常・取消・Home差替え・取得／解放不明・不正助言。
 * @observation 二観測、start／release回数、exact回復参照、Root有無。
 * @oracle 不明時は清掃しない。正常時だけ元記録と空用途Directoryを回収。
 * @cleanup 実資源がすべて代役である自己生成Rootのみ確認後に回収。
 * @boundary Host単体のITと組み合わせる限定根拠。実OS検証ではない。
 */
test("単段CLI子の固定計画・取消・保持を確認する", () => {
  const url = (value: string) => new URL(value, import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
    import {mock} from 'node:test';import {registerHooks,syncBuiltinESMExports} from 'node:module';import cp from 'node:child_process';
    registerHooks({resolve(s,c,n){const r=n(s,c);if(r.url.includes('/coordinator/'))throw Error('coordinator_forbidden');return r;}});
    for(const name of ['spawn','spawnSync','fork','exec','execSync','execFile','execFileSync'])cp[name]=()=>{throw Error('external_process_forbidden');};syncBuiltinESMExports();
    const platform=await import(${JSON.stringify(url("../../../platform-access/src/index.ts"))});
    const domain=await import(${JSON.stringify(url("../../../domain-model/src/index.ts"))});
    let mode='normal',observations=0,acquisitions=0,releases=0,starts=0,cancels=0,live=false,controller=null;
    process.env.LOCALAPPDATA='C:/synthetic-home-not-read'.replaceAll('/',String.fromCharCode(92));
    mock.module(${JSON.stringify(url("../../../platform-access/src/index.ts"))},{namedExports:{...platform,
      observeWindowsProviderHome:(provider)=>{observations++;if(mode==='unexpected_error')throw Error('private external error');return {status:mode==='home_unknown'?'blocked':'candidate',provider,processEffectIssued:true,helperExitConfirmed:mode!=='home_unknown',artifactVerifiedBeforeAndAfter:true,filesystemEffectIssued:false,providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:observations===2&&['changed','changed_release_unknown'].includes(mode)?'e'.repeat(64):'b'.repeat(64),localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64)};},
      acquireNamedPipeKernelLock:()=>{acquisitions++;if(mode==='acquire_unknown')return null;live=true;return {assertLive:()=>live,release:()=>{releases++;if(['release_unknown','changed_release_unknown'].includes(mode))return false;live=false;return true;}};}
    }});
    mock.module(${JSON.stringify(url("../../scripts/provider-attempt-host.ts"))},{namedExports:{createStandaloneProviderAttemptHost:(root,plan,lease)=>{
      assert.equal(plan.operationMode,'workbench_advice');assert.equal(plan.workspaceSourcePath,null);assert.equal(plan.executionSelection.role,'advice');assert.equal(plan.executionSelection.purpose,'advice');
      const recoveryId='docker-task.'+'d'.repeat(64)+'.'+createHash('sha256').update(root).digest('hex')+'.'+'f'.repeat(64);let sequence=0,original=null;const wait=Promise.withResolvers();
      const names={create_provider:plan.providerContainerName,create_proxy:plan.proxyContainerName,create_subscription_auth_probe:plan.authContainerName,create_internal_network:plan.internalNetworkName,create_egress_network:plan.egressNetworkName};
      const resources=Object.entries(names).map(([purpose,plannedResourceName],i)=>({purpose,plannedResourceName,dockerId:String(i+1).repeat(64),observation:'absent'}));
      const diagnostic={primaryFailure:null,providerProcessStartedObserved:true,processTreeTerminationObserved:true,containersAbsentObserved:true,networksAbsentObserved:true,cleanupConfirmed:true};
      const save=(kind,fields={})=>{const name='event-'+String(++sequence).padStart(3,'0')+'.json';const value={kind,recordedAt:new Date().toISOString(),operationId:plan.operationId,provider:plan.provider,recoveryId,sequence,...fields,...(kind==='absence_observed'?{resources}:{}),...(kind==='execution_settled'?diagnostic:{}),...(kind==='terminal_received'?{status:'completed',reason:null,resultSha256:'a'.repeat(64),resultBytes:10}:{})};domain.writeCommittedJson(root,name,name,value);};
      return {recoveryId,readDiagnostic:()=>diagnostic,management:{},runtime:{cancel:async()=>{cancels++;wait.resolve();return {status:'requested'};}},
        start:()=>{starts++;save('recovery_opened');save('recovery_handoff');for(const r of resources){save('submission_planned',{purpose:r.purpose,plannedResourceName:r.plannedResourceName,ownershipLabel:plan.ownershipLabel});save('receipt_recorded',{purpose:r.purpose,dockerId:r.dockerId});}return {status:'started',controlCapability:{},completion:(async()=>{
          if(mode==='cancel'){controller.abort();await wait.promise;}
          assert.equal(lease.assertLive(),true);save('absence_observed');const released=lease.release();if(released){save('home_released');save('recovery_closed');save('execution_settled');}
          const item={text:'A pending documentation task.',references:['synthetic-context']};const advice={status:'completed',facts:[item],sharedAnalysis:[],additionalInferences:[],nextOptions:[item]};
          original={status:mode==='cancel'?'cancelled':mode==='execution_and_bad_advice'?'blocked':'completed',reason:mode==='cancel'?'provider_operation_cancelled':mode==='execution_and_bad_advice'?'provider_subscription_auth_not_confirmed':null,cleanupConfirmed:released,resultSha256:'a'.repeat(64),resultBytes:10,normalizedResult:['bad_advice','terminal_and_bad_advice','execution_and_bad_advice'].includes(mode)?{status:'completed',facts:[]}:{...advice,reason:null}};return original;
        })()};},
        recordTerminal:value=>{if(value!==original||!value.cleanupConfirmed||mode==='terminal_and_bad_advice')return false;save('terminal_received');return true;}
      };
    }}});
    const api=await import(${JSON.stringify(url("../../scripts/verify-provider-real.ts"))});
    const repository=fileURLToPath(new URL('../../../',${JSON.stringify(url("../../scripts/verify-provider-real.ts"))}));
    for(mode of ['normal','cancel','changed','changed_release_unknown','home_unknown','unexpected_error','prestart_cancel','acquire_unknown','release_unknown','bad_advice','terminal_and_bad_advice','execution_and_bad_advice']){
      observations=0;acquisitions=0;releases=0;starts=0;cancels=0;live=false;controller=new AbortController();
      const runId='fixture-'+randomUUID();const provider=mode==='normal'?'codex':'claude';const root=path.join(repository,'.crdd','tests','executor-real-'+provider+'-'+runId);
      const result=await api.runStandaloneProviderTrial(provider,runId,controller.signal,async()=>{},async()=>{if(mode==='prestart_cancel')controller.abort();});
      const stat=fs.statSync(root,{bigint:true});const identity=[stat.dev,stat.ino,stat.birthtimeNs].map(String).join(':');
      assert.equal(result.status,mode==='normal'?'completed':['cancel','prestart_cancel'].includes(mode)?'cancelled':'blocked',mode);
      assert.equal(starts,['changed','changed_release_unknown','home_unknown','unexpected_error','prestart_cancel','acquire_unknown'].includes(mode)?0:1,mode);
      assert.equal(observations,['acquire_unknown','home_unknown','unexpected_error'].includes(mode)?1:2,mode);assert.equal(acquisitions,['home_unknown','unexpected_error'].includes(mode)?0:1);
      assert.equal(releases,['acquire_unknown','home_unknown','unexpected_error'].includes(mode)?0:1,mode);assert.equal(cancels,mode==='cancel'?1:0);
      const reasons={changed:'trial_home_changed_or_unconfirmed',changed_release_unknown:'trial_home_changed_or_unconfirmed',home_unknown:'trial_home_unconfirmed',unexpected_error:'trial_failed_closed',prestart_cancel:'trial_cancelled_or_lease_lost_before_start',acquire_unknown:'trial_lease_acquisition_unknown'};
      if(mode in reasons)assert.equal(result.reason,reasons[mode],mode);
      if(mode==='bad_advice')assert.equal(result.reason,'workbench_ai_advice_result_schema_invalid');
      if(mode==='terminal_and_bad_advice')assert.equal(result.reason,'trial_terminal_or_advice_unconfirmed');
      if(mode==='execution_and_bad_advice')assert.equal(result.reason,'provider_subscription_auth_not_confirmed');
      const cleaned=api.cleanupStandaloneTrialRoot(root,identity,result);assert.equal(cleaned,mode==='normal',mode);
      if(!cleaned){assert.equal(fs.existsSync(root),true);for(const name of fs.readdirSync(root)){const p=path.join(root,name),s=fs.lstatSync(p);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory())assert.equal(fs.readdirSync(p).length,0);else{assert.equal(s.isFile(),true);assert.equal(s.nlink,1);assert.match(name,/^event-[0-9]{3}\\.json(?:\\.crdd-commit\\.json)?$/);}}fs.rmSync(root,{recursive:true});assert.equal(fs.existsSync(root),false);}
    }
  `,
    ],
    { encoding: "utf8", timeout: 25000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

/**
 * 親はnonce・単一結果・close・記録を共同確認する。
 * @responsibility 受信だけの成功を拒否し、端末入力なしで明示実行する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 確認Readerは禁止代役、forkは代役、Git Root読取りと新品確定JSONだけ実I/O。
 * @stimulus 正常、拒否、別nonce、重複結果、非零close、出力混入、close不明。
 * @observation fork回数、限定結果、Root保持と通常清掃。
 * @oracle 結果受領だけでは削除しない。取消は同じ子へ一回。
 * @cleanup 代役子しか存在しない自己生成Rootだけ内容確認後に回収する。
 * @boundary 実子のclose意味はNode契約と後続実境界で別確認する。
 */
test("単段CLI親は端末入力なしでIPC・終了・清掃を分離する", () => {
  const url = (value: string) => new URL(value, import.meta.url).href;
  for (const group of [
    "protocol",
    "fixture",
    "temporary",
    "temporary-tree",
    "codex-temporary",
  ] as const) {
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "--input-type=module",
        "-e",
        `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,randomUUID} from 'node:crypto';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {mock} from 'node:test';
    const platform=await import(${JSON.stringify(url("../../../platform-access/src/index.ts"))});const domain=await import(${JSON.stringify(url("../../../domain-model/src/index.ts"))});
    const awaitTaskApi=await import(${JSON.stringify(url("../../scripts/task-trial.ts"))});
    let mode='normal',forks=0,cancelCount=0,output=[],gitCalls=0,beforeWait=null;
    Object.defineProperty(process.stdin,'isTTY',{value:false,configurable:true});Object.defineProperty(process.stdout,'isTTY',{value:false,configurable:true});
    mock.method(process.stdout,'write',function(value,...rest){const text=String(value);assert.equal(/この端末に|入力してください/.test(text),false);if(text.startsWith('{'))output.push(JSON.parse(text));const callback=rest.find(v=>typeof v==='function');if(callback)callback(null);return true;});
    mock.module(${JSON.stringify(url("../../../platform-access/src/index.ts"))},{namedExports:{...platform,
      readConfirmationCodeOutcome:async()=>{throw Error('console_input_forbidden');},
      observeWindowsProviderHome:()=>{throw Error('native_forbidden');},acquireNamedPipeKernelLock:()=>{throw Error('lock_forbidden');}
    }});
    const repository=fileURLToPath(new URL('../../../',${JSON.stringify(url("../../scripts/verify-provider-real.ts"))}));let root=null;
    const actualTimeout=globalThis.setTimeout;let timeoutDelay=null;
    mock.method(globalThis,'setTimeout',(fn,ms,...args)=>{timeoutDelay=Math.max(timeoutDelay??0,ms);return actualTimeout(fn,['close_unknown','disconnected_no_close','late_close','ack_missing'].includes(mode)?(ms>10000?10:mode==='late_close'?100:10):ms,...args);});
    const realSpawn=cp.spawnSync;mock.method(cp,'spawnSync',(...args)=>{gitCalls++;assert.equal(args[0],'git');return realSpawn(...args);});
    mock.method(cp,'fork',(file,args,options)=>{
      forks++;assert.equal(args[0],'--worker');assert.match(args[1],/^[a-f0-9]{64}$/);assert.deepEqual(Object.keys(options.env).sort().filter(k=>!['SystemRoot','WINDIR','LOCALAPPDATA','USERPROFILE'].includes(k)),[]);
      const emitter=new EventEmitter();emitter.connected=true;emitter.stdout=new PassThrough();emitter.stderr=new PassThrough();emitter.unref=()=>{};emitter.disconnect=()=>{assert.equal(emitter.connected,true);emitter.connected=false;emitter.emit('disconnect');};let input=null,finish=null;
      emitter.send=(message,callback)=>{
        if(message.kind==='run'){
          input=message;assert.equal(message.nonce,args[1]);root=path.join(repository,'.crdd','tests','executor-real-'+input.provider+'-'+input.runId);fs.mkdirSync(root);fs.mkdirSync(path.join(root,'tmp'));fs.mkdirSync(path.join(root,'management'));
          queueMicrotask(()=>emitter.emit('message',{kind:'root',nonce:message.nonce}));
        }else if(message.kind==='cancel'){cancelCount++;}
        else if(message.kind==='root_ack'){
          assert.equal(message.nonce,input.nonce);
          if(mode.startsWith('preparation_failed')){beforeWait=[];emitter.emit('message',{kind:'result',nonce:input.nonce,result:{mode:input.mode,fixtureReceipt:null,cancellationConfirmed:false,reviewToolObservation:null,status:'blocked',reason:mode==='preparation_failed_null'?null:mode==='preparation_failed_unknown'?'synthetic_internal_failure':'trial_lease_acquisition_unknown',recoveryId:null,cleanupConfirmed:false,releaseConfirmed:false,terminalSaved:false,nativeCleanupConfirmed:true,contentConfirmed:false,resultSha256:null,resultBytes:0,diagnostic:null}});emitter.connected=false;emitter.emit('close',0,null);return true;}
          const recoveryId='docker-task.'+'d'.repeat(64)+'.'+createHash('sha256').update(root).digest('hex')+'.'+'f'.repeat(64);
          const taskApi=awaitTaskApi;const fixtureReceipt=input.mode==='advice'?null:taskApi.createTaskTrialFixture(root,input.mode);if(fixtureReceipt&&input.mode==='edit')fs.writeFileSync(path.join(root,'work','source.txt'),taskApi.TASK_TRIAL_TEXT);
          const resources=['create_provider','create_proxy','create_subscription_auth_probe','create_internal_network','create_egress_network'].map((purpose,index)=>({purpose,plannedResourceName:'crdd-'+[input.provider,'proxy','auth','internal','egress'][index]+'-'+'a'.repeat(16),dockerId:String(index+1).repeat(64),observation:'absent'}));
          if(mode.startsWith('tmp_')){const p=path.join(root,'tmp',mode==='tmp_unknown'?'unexpected':'claude-65534');if(mode==='tmp_file')fs.writeFileSync(p,'synthetic');else{fs.mkdirSync(p);if(mode==='tmp_nonempty')fs.writeFileSync(path.join(p,'keep.txt'),'synthetic');if(mode.startsWith('tmp_tree')){fs.mkdirSync(path.join(p,'nested'));fs.mkdirSync(path.join(p,'empty'));fs.writeFileSync(path.join(p,'nested','runtime.bin'),'runtime data');}}}
          if(mode.startsWith('codex_tmp_')){const base=path.join(root,'tmp');if(mode!=='codex_tmp_none'){const p=path.join(base,mode==='codex_tmp_daemon'?'codex-daemon-65534':'codex-bwrap-synthetic-mount-targets-65534');fs.mkdirSync(p);if(!['codex_tmp_daemon','codex_tmp_empty'].includes(mode))fs.writeFileSync(path.join(p,'lock'),mode==='codex_tmp_nonzero'?'unsafe':'');if(mode==='codex_tmp_both')fs.mkdirSync(path.join(base,'codex-daemon-65534'));if(mode==='codex_tmp_extra')fs.writeFileSync(path.join(p,'extra'),'unsafe');}}
          const diagnostic={primaryFailure:null,providerProcessStartedObserved:true,processTreeTerminationObserved:true,containersAbsentObserved:true,networksAbsentObserved:true,cleanupConfirmed:true};
          const records=[{kind:'recovery_opened'},{kind:'recovery_handoff'},...resources.flatMap(r=>[{kind:'submission_planned',purpose:r.purpose,plannedResourceName:r.plannedResourceName,ownershipLabel:'crdd.coordinator.runtime='+'a'.repeat(16)},{kind:'receipt_recorded',purpose:r.purpose,dockerId:r.dockerId}]),...['absence_observed','home_release_requested','home_released','mount_recorded','recovery_closed','execution_settled','terminal_received'].map(kind=>({kind}))];
          if(mode==='bad_planned_name')records.find(v=>v.kind==='submission_planned'&&v.purpose==='create_subscription_auth_probe').plannedResourceName='crdd-auth-'+'b'.repeat(16);
          if(mode==='mixed_label')records[2].ownershipLabel='crdd.coordinator.runtime='+'b'.repeat(16);
          if(mode==='duplicate_purpose')records.splice(3,0,{...records[2]});
          if(mode==='bad_provider_name')records[2].plannedResourceName='crdd-codex-'+'c'.repeat(16);
          if(mode==='bad_absence_name')resources[0].plannedResourceName='crdd-codex-'+'c'.repeat(16);
          for(const [i,record] of records.entries()){const kind=record.kind,name='event-'+String(i+1).padStart(3,'0')+'.json';domain.writeCommittedJson(root,name,name,{...record,recordedAt:new Date().toISOString(),operationId:'OP-123456',provider:input.provider,recoveryId,sequence:i+1,...(kind==='absence_observed'?{resources}:{}),...(kind==='execution_settled'?diagnostic:{}),...(kind==='terminal_received'?{status:input.mode==='cancel'?'cancelled':'completed',reason:input.mode==='cancel'?'provider_operation_cancelled':null,resultSha256:input.mode==='cancel'?null:'a'.repeat(64),resultBytes:input.mode==='cancel'?0:10}:{})});}
          const result={mode:input.mode,fixtureReceipt,cancellationConfirmed:input.mode==='cancel',reviewToolObservation:null,status:input.mode==='cancel'?'cancelled':'completed',reason:input.mode==='cancel'?'provider_operation_cancelled':null,recoveryId,cleanupConfirmed:true,releaseConfirmed:true,terminalSaved:true,nativeCleanupConfirmed:true,contentConfirmed:input.mode!=='cancel',resultSha256:input.mode==='cancel'?null:'a'.repeat(64),resultBytes:input.mode==='cancel'?0:10,diagnostic};
          if(mode==='task_cancel_completed')result.status='completed';if(mode==='task_review_cancelled')result.status='cancelled';if(mode==='task_cancel_partial')fs.writeFileSync(path.join(root,'work','source.txt'),'partial');if(mode==='task_wrong_mode')result.mode='advice';
          if(mode==='failed_diag')Object.assign(result,{status:'blocked',reason:'docker_process_controller_cleanup_unconfirmed',cleanupConfirmed:false,releaseConfirmed:false,terminalSaved:false,contentConfirmed:false,resultSha256:null,resultBytes:0,diagnostic:{...diagnostic,cleanupConfirmed:false,primaryFailure:{purpose:'create_subscription_auth_probe',stage:'command_wait',reason:'docker_process_controller_execution_failed_closed',exceptionCode:null,commandHandleObtained:true,responseObserved:false,receiptRecorded:false,commandObservation:null}}});
          if(mode==='raw_diag')result.diagnostic={...diagnostic,rawOutput:'forbidden'};
          finish=()=>{
            beforeWait=fs.readdirSync(root).sort().map(name=>[name,fs.lstatSync(path.join(root,name)).isFile()?fs.readFileSync(path.join(root,name)).toString('base64'):null]);
            if(mode==='close_unknown')return;
            if(mode==='disconnected_no_close'){emitter.connected=false;return;}
            if(mode==='cancel_completed')process.emit('SIGINT');
            const message={kind:'result',nonce:mode==='wrong_nonce'?'0'.repeat(64):input.nonce,result};
            if(mode!=='result_lost')emitter.emit('message',message);if(mode==='duplicate_result')emitter.emit('message',message);
            const close=()=>{assert.equal(fs.existsSync(path.join(root,'outcome.json')),false);if(mode==='stdout')emitter.stdout.write('S'.repeat(100000));emitter.stderr.write('E'.repeat(100000));emitter.stdout.end();emitter.stderr.end();emitter.connected=false;emitter.emit('close',mode==='nonzero_close'?2:0,null);};
            if(mode==='late_close')actualTimeout(close,20);else close();
          };
          if(mode==='missing_recovery')queueMicrotask(()=>finish());else queueMicrotask(()=>emitter.emit('message',{kind:'recovery',nonce:input.nonce,recoveryId}));
        }else if(message.kind==='recovery_ack'){
          assert.equal(message.nonce,input.nonce);queueMicrotask(()=>finish());
          if(['ack_late','ack_error','ack_missing'].includes(mode)){if(mode!=='ack_missing')actualTimeout(()=>callback(mode==='ack_error'?Error('synthetic'):null),5);return true;}
        }
        if(callback)callback(null);return true;
      };
      queueMicrotask(()=>emitter.emit('spawn'));return emitter;
    });syncBuiltinESMExports();
    const api=await import(${JSON.stringify(url("../../scripts/verify-provider-real.ts"))});
    const originalLstat=fs.lstatSync,originalRmdir=fs.rmdirSync,originalRealpath=fs.realpathSync,originalOpen=fs.opendirSync,originalUnlink=fs.unlinkSync;let temporaryReads=0,ancestorReads=0,childRemovals=0,leafReads=0,inventoryReads=0,temporaryEffects=0,rootInventoryReads=0;
    mock.method(fs,'unlinkSync',(p,...args)=>{if(root&&String(p).startsWith(path.join(root,'tmp')+path.sep))temporaryEffects++;if(mode==='tmp_tree_remove_failure'&&String(p).endsWith('runtime.bin'))throw Error('synthetic_unlink_failure');return originalUnlink(p,...args);});
    mock.method(fs,'realpathSync',(p,...args)=>mode==='tmp_tree_realpath'&&String(p).endsWith('runtime.bin')?path.join(root,'outside'):originalRealpath(p,...args));
    mock.method(fs,'opendirSync',(p,...args)=>{if(mode==='tmp_tree_root_inventory'&&String(p)===root&&++rootInventoryReads===2)fs.writeFileSync(path.join(root,'late-entry.txt'),'synthetic late entry');if(mode==='tmp_tree_read_failure'&&String(p).endsWith('nested'))throw Error('synthetic_read_failure');if(mode==='tmp_tree_limit'&&String(p).endsWith('nested')){let count=0;return {readSync:()=>++count<=10001?{name:'entry-'+count}:null,closeSync:()=>{}};}const directory=originalOpen(p,...args);if(mode==='tmp_tree_inventory'&&String(p).endsWith('claude-65534')&&++inventoryReads>1){let added=false;const read=directory.readSync.bind(directory);directory.readSync=()=>{const entry=read();if(entry)return entry;if(!added){added=true;return {name:'late-entry'};}return null;};}return directory;});
    mock.method(fs,'rmdirSync',(p,...args)=>{if(root&&String(p).startsWith(path.join(root,'tmp')+path.sep))temporaryEffects++;if(String(p).endsWith(path.join('tmp','claude-65534')))childRemovals++;return originalRmdir(p,...args);});
    mock.method(fs,'lstatSync',(p,options)=>{const s=originalLstat(p,options);if(String(p).endsWith('runtime.bin')){const leaf={...s,isFile:()=>s.isFile(),isDirectory:()=>s.isDirectory(),isSymbolicLink:()=>s.isSymbolicLink()};if(mode==='tmp_tree_link')return {...leaf,isSymbolicLink:()=>true};if(mode==='tmp_tree_special')return {...leaf,isDirectory:()=>false,isFile:()=>false};if(mode==='tmp_tree_nlink')return {...leaf,nlink:options?.bigint?2n:2};if(options?.bigint&&++leafReads>1){if(mode==='tmp_tree_changed')return {...leaf,ino:s.ino+1n};if(mode==='tmp_tree_size')return {...leaf,size:s.size+1n};if(mode==='tmp_tree_mtime')return {...leaf,mtimeNs:s.mtimeNs+1n};}}if(String(p).endsWith(path.join('codex-bwrap-synthetic-mount-targets-65534','lock'))){if(mode==='codex_tmp_link')return {...s,isFile:()=>true,isSymbolicLink:()=>true};if(mode==='codex_tmp_nlink')return {...s,nlink:options?.bigint?2n:2,isFile:()=>true,isSymbolicLink:()=>false};}if(String(p)===path.join(root??'','tmp')&&options?.bigint&&++ancestorReads>1){if(mode==='tmp_parent_link')return {...s,isDirectory:()=>true,isSymbolicLink:()=>true};if(mode==='tmp_parent_changed')return {...s,ino:s.ino+1n,isDirectory:()=>true,isSymbolicLink:()=>false};}if(String(p).endsWith(path.join('tmp','claude-65534'))){if(mode==='tmp_link')return {...s,isDirectory:()=>true,isSymbolicLink:()=>true};if(mode==='tmp_changed'&&options?.bigint&&++temporaryReads>1)return {...s,ino:s.ino+1n,isDirectory:()=>true,isSymbolicLink:()=>false};}return s;});
    for(mode of ['normal','wrong_nonce','duplicate_result','nonzero_close','stdout','close_unknown','disconnected_no_close','cancel_completed','result_lost','late_close','missing_recovery','ack_late','ack_error','ack_missing','failed_diag','raw_diag','bad_planned_name','mixed_label','duplicate_purpose','bad_provider_name','bad_absence_name','tmp_empty','tmp_codex','tmp_unknown','tmp_file','tmp_nonempty','tmp_link','tmp_changed','tmp_parent_link','tmp_parent_changed','tmp_tree','tmp_tree_link','tmp_tree_nlink','tmp_tree_special','tmp_tree_realpath','tmp_tree_read_failure','tmp_tree_limit','tmp_tree_changed','tmp_tree_size','tmp_tree_mtime','tmp_tree_inventory','tmp_tree_remove_failure','tmp_tree_root_inventory','task_edit','task_review','task_cancel','task_cancel_completed','task_review_cancelled','task_cancel_partial','task_wrong_mode','codex_tmp_none','codex_tmp_daemon','codex_tmp_empty','codex_tmp_lock','codex_tmp_both','codex_tmp_nonzero','codex_tmp_extra','codex_tmp_link','codex_tmp_nlink','preparation_failed','preparation_failed_null','preparation_failed_unknown'].filter(value=>${JSON.stringify(group)}==='temporary'?/^tmp_/.test(value)&&!value.startsWith('tmp_tree'):${JSON.stringify(group)}==='temporary-tree'?value.startsWith('tmp_tree'):${JSON.stringify(group)}==='codex-temporary'?value.startsWith('codex_tmp_'):${JSON.stringify(group)}==='fixture'?/^(task_|preparation_)/.test(value):!/^(tmp_|codex_tmp_|task_|preparation_)/.test(value))){
      forks=0;cancelCount=0;gitCalls=0;output=[];root=null;timeoutDelay=null;beforeWait=null;
      temporaryReads=0;ancestorReads=0;childRemovals=0;leafReads=0;inventoryReads=0;temporaryEffects=0;rootInventoryReads=0;
      const trialMode=mode.startsWith('preparation_failed')||mode.startsWith('codex_tmp_')?'edit':mode.startsWith('task_')?(mode.includes('cancel')&&!mode.includes('review')?'cancel':mode.includes('review')?'review':'edit'):'advice';
      const code=await api.runStandaloneProviderTrialCli(['--run',(mode.startsWith('tmp_')&&mode!=='tmp_codex')||trialMode==='review'?'claude':'codex','fixture-'+randomUUID(),trialMode]);const result=output.at(-1);
      const success=['normal','ack_late','tmp_empty','tmp_codex','tmp_unknown','tmp_file','tmp_nonempty','tmp_tree','task_edit','task_review','task_cancel','codex_tmp_none','codex_tmp_daemon','codex_tmp_empty','codex_tmp_lock','codex_tmp_both','codex_tmp_nonzero','codex_tmp_extra'].includes(mode);
      assert.equal(code,success?0:2,mode);assert.equal(forks,1,mode);
      assert.equal(gitCalls,1);
      assert.equal(result.fixtureCleanupConfirmed,success,mode);assert.ok(timeoutDelay>10000);
      if(mode==='failed_diag'){assert.equal(result.result.diagnostic.primaryFailure.stage,'command_wait');assert.equal(result.result.diagnostic.cleanupConfirmed,false);}
      if(mode==='raw_diag'){assert.equal(result.result,null);assert.equal(JSON.stringify(result).includes('forbidden'),false);}
      if(success)assert.equal(fs.existsSync(root),false);else{
        if(mode.startsWith('tmp_')){assert.equal(childRemovals,0,mode);if(mode==='tmp_tree_remove_failure'){assert.ok(temporaryEffects>0,mode);assert.equal(fs.existsSync(path.join(root,'tmp','claude-65534','empty')),false);assert.equal(fs.existsSync(path.join(root,'tmp','claude-65534','nested','runtime.bin')),true);}else assert.equal(temporaryEffects,0,mode);for(const [name,bytes] of beforeWait){if(bytes!==null)assert.equal(fs.readFileSync(path.join(root,name)).toString('base64'),bytes,mode+':'+name);}}
        assert.equal(fs.existsSync(root),true);assert.equal(result.fixtureRoot,root);assert.equal(result.retentionRecordConfirmed,!['close_unknown','disconnected_no_close'].includes(mode));
        if(mode.startsWith('preparation_failed')){assert.equal(result.recoveryId,null);if(mode==='preparation_failed')assert.equal(result.result.reason,'trial_lease_acquisition_unknown');else assert.equal(result.result,null);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'outcome.json'),'utf8')).protocolFailure,mode!=='preparation_failed');}else assert.equal(result.recoveryId,'docker-task.'+'d'.repeat(64)+'.'+createHash('sha256').update(root).digest('hex')+'.'+'f'.repeat(64));
        if(['close_unknown','disconnected_no_close'].includes(mode)){assert.equal(result.childCloseObserved,false);assert.deepEqual(fs.readdirSync(root).sort().map(name=>[name,fs.lstatSync(path.join(root,name)).isFile()?fs.readFileSync(path.join(root,name)).toString('base64'):null]),beforeWait);}
        if(mode.startsWith('task_')||mode.startsWith('codex_tmp_')){const work=path.join(root,'work');assert.equal(fs.lstatSync(work).isSymbolicLink(),false);for(const n of ['source.txt'])fs.unlinkSync(path.join(work,n));fs.rmdirSync(path.join(work,'.git'));fs.rmdirSync(path.join(work,'.crdd'));fs.rmdirSync(work);}
        if(mode.startsWith('codex_tmp_')){for(const child of fs.readdirSync(path.join(root,'tmp'))){const target=path.join(root,'tmp',child);assert.equal(originalLstat(target).isSymbolicLink(),false);for(const name of fs.readdirSync(target)){assert.ok(['lock','extra'].includes(name));fs.unlinkSync(path.join(target,name));}originalRmdir(target);}}
        if(mode==='tmp_tree_root_inventory'){assert.equal(fs.readFileSync(path.join(root,'late-entry.txt'),'utf8'),'synthetic late entry');originalUnlink(path.join(root,'late-entry.txt'));}
        assert.equal(fs.lstatSync(root).isSymbolicLink(),false);for(const name of fs.readdirSync(root)){const p=path.join(root,name),s=fs.lstatSync(p);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory()){const children=fs.readdirSync(p);assert.equal(children.length,name==='tmp'&&mode.startsWith('tmp_')?1:0);if(children.length){const q=path.join(p,children[0]),stat=originalLstat(q);assert.equal(stat.isSymbolicLink(),false);assert.equal(stat.isDirectory(),mode!=='tmp_file');if(mode==='tmp_nonempty')assert.equal(fs.readFileSync(path.join(q,'keep.txt'),'utf8'),'synthetic');}}else{assert.equal(s.isFile(),true);assert.equal(s.nlink,1);assert.match(name,/^(event-[0-9]{3}|outcome)\\.json(?:\\.crdd-commit\\.json)?$/);}}
        fs.rmSync(root,{recursive:true});assert.equal(fs.existsSync(root),false);
      }
      if(['wrong_nonce','duplicate_result','close_unknown','cancel_completed','late_close','missing_recovery'].includes(mode))assert.equal(cancelCount,1,mode);
    }
  `,
      ],
      { encoding: "utf8", timeout: 30000, windowsHide: true },
    );
    assert.equal(child.error, undefined, `synthetic_group:${group}`);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
  }
});

/**
 * 先行hookは動的実装の静的Coordinator importも評価前に拒否する。
 * @responsibility 正常・変異を同じloader Oracleで比較する。
 * @trace ERB-IT-002
 * @precondition 新品Node子とメモリ内Source変異だけ。
 * @stimulus Host実装へのCoordinator static import一件を追加。
 * @observation 拒否理由とCoordinator load回数。
 * @oracle 正常importは成功、変異はCoordinator評価前に拒否。
 * @cleanup N/A: File編集・Root生成なし。
 * @boundary 構造独立だけ。実AIの保証ではない。
 */
test("単段CLIの先行hookは静的依存変異を拒否する", () => {
  const entry = new URL(
    "../../scripts/verify-provider-real.ts",
    import.meta.url,
  ).href;
  const host = new URL(
    "../../scripts/provider-attempt-host.ts",
    import.meta.url,
  ).href;
  const coordinator = new URL(
    "../../../coordinator/src/index.ts",
    import.meta.url,
  ).href;
  for (const mutate of [false, true]) {
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
      let loads=0;
      registerHooks({load(url,c,n){if(url.includes('/coordinator/'))loads++;const value=n(url,c);if(${mutate}&&url===${JSON.stringify(host)})return {...value,source:'import '+JSON.stringify(${JSON.stringify(coordinator)})+';\\n'+value.source};return value;}});
      let failed=false;try{await import(${JSON.stringify(entry)});}catch(error){failed=true;assert.equal(error.message,'trial_coordinator_forbidden');}
      assert.equal(failed,${mutate});assert.equal(loads,0);
    `,
      ],
      { encoding: "utf8", timeout: 15000, windowsHide: true },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
  }
});

/**
 * 実Node子のIPC受付拒否とcloseをEffect前に確認する。
 * @responsibility 代役forkの検査を実Process終了の証明へ流用しない。
 * @trace ERB-IT-004
 * @precondition 無効な計画Hash又は開始前取消だけを送る。
 * @stimulus IPC親から固定二つの拒否要求。
 * @observation 同じ子のclose、出力零、試験Root不存在。
 * @oracle Native・Home・Docker・AIへ到達せず終了値2。
 * @cleanup 正常closeを確認する。十秒未終了は自身のNode子だけ終了し試験不合格。
 * @boundary 実IPC拒否経路だけ。実Provider成功は未確認。
 */
test("単段CLIの実IPC子は不正計画と開始前取消を拒否する", async () => {
  const script = fileURLToPath(
    new URL("../../scripts/verify-provider-real.ts", import.meta.url),
  );
  const repository = fileURLToPath(
    new URL(
      "../../../",
      new URL("../../scripts/verify-provider-real.ts", import.meta.url),
    ),
  );
  const reviewDescriptor = spawnSync(
    process.execPath,
    [script, "--describe", "codex", "review"],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(reviewDescriptor.status, 0);
  const reviewSpecHash = createHash("sha256")
    .update(JSON.stringify(JSON.parse(reviewDescriptor.stdout)))
    .digest("hex");
  for (const mode of [
    "bad_spec",
    "cancel_before_run",
    "review_bad_spec",
    "review_cancel_before_run",
  ]) {
    const nonce = randomBytes(32).toString("hex");
    const runId = `fixture-${nonce.slice(0, 32)}`;
    const root = path.join(
      repository,
      ".crdd",
      "tests",
      `executor-real-codex-${runId}`,
    );
    assert.equal(fs.existsSync(root), false);
    const env: Record<string, string> = {};
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    const execArgv: string[] = [];
    const child = fork(script, ["--worker", nonce], {
      env,
      execArgv,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let bytes = 0,
      timedOut = false;
    child.stdout?.on("data", (chunk) => {
      bytes += chunk.length;
    });
    child.stderr?.on("data", () => {});
    const result = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 10000);
      child.once("error", reject);
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
      child.once("spawn", () => {
        if (mode === "cancel_before_run" || mode === "review_cancel_before_run")
          child.send({ kind: "cancel", nonce });
        child.send({
          kind: "run",
          nonce,
          provider: "codex",
          runId,
          specHash:
            mode === "review_cancel_before_run"
              ? reviewSpecHash
              : "0".repeat(64),
          mode: mode.startsWith("review_") ? "review" : "advice",
        });
      });
    });
    assert.equal(timedOut, false);
    assert.equal(result.signal, null);
    assert.equal(result.code, 2);
    assert.equal(bytes, 0);
    assert.equal(fs.existsSync(root), false);
  }
});
