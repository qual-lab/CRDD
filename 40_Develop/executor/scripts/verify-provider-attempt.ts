/**
 * Executor単独の非AI検証を明示実行する。
 * @packageDocumentation
 * @responsibility 新品子Processの候補生涯・本番Factory配線と試験fixtureの終了を検査する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary 試験専用。実Docker・認証・外部AI・本番Host保存は利用しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 同じ有限検証をCLIとITから実行する。
 * @responsibility Coordinator抜きの単段検証入口を一実体へまとめる。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @input N/A: 外部入力・依存注入を受けない。
 * @returns 正常時だけ復帰する。
 * @precondition NodeのModule mock機能を使用できる。
 * @postcondition 全completionと子Process終了を確認する。
 * @effect 明示呼出し時だけGit Root読取りと新品Node子Process・専用試験領域を作る。import時は外部Effectなし。
 * @failure 期限・Oracle・子終了の不成立は例外で停止する。
 * @invariant 製品APIと本番DIを変更しない。
 * @boundary 非AIの試験候補とModule代役。
 * @security Provider認証・実Docker・生出力保存を使用しない。
 * @concurrency 既存十五秒期限内で有限検証を直列実行する。
 */
export function verifyStandaloneProviderAttempt() {
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const git = spawnSync(
    "git",
    ["-C", repository, "rev-parse", "--show-toplevel"],
    {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    },
  );
  assert.equal(git.error, undefined);
  assert.equal(git.status, 0);
  assert.equal(
    fs.realpathSync(git.stdout.trim()).toLowerCase(),
    repository.toLowerCase(),
  );
  const parent = path.join(repository, ".crdd", "tests");
  for (const directory of [path.dirname(parent), parent]) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(
      fs.realpathSync(directory).toLowerCase(),
      directory.toLowerCase(),
    );
  }
  const fixtureRoot = fs.mkdtempSync(path.join(parent, "executor-standalone-"));
  const fixtureIdentity = fs.statSync(fixtureRoot, { bigint: true });
  const root = new URL("../src/index.ts", import.meta.url).href;
  const isolationRoot = new URL(
    "../../docker-isolation/src/index.ts",
    import.meta.url,
  ).href;
  const domainRoot = new URL("../../domain-model/src/index.ts", import.meta.url)
    .href;
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    import {registerHooks} from 'node:module';
    import {mock} from 'node:test';
    import childProcess from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    let externalProcessCalls=0;
    for(const method of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])
      childProcess[method]=()=>{externalProcessCalls++;throw Error('external_process_forbidden');};
    syncBuiltinESMExports();
    let coordinatorResolutions=0;
    registerHooks({resolve(s,c,n){
      const resolved=n(s,c);
      if(resolved.url.includes('/coordinator/')){
        coordinatorResolutions++;
        throw Error('coordinator_unavailable');
      }
      return resolved;
    }});
    const isolation=await import(${JSON.stringify(isolationRoot)});
    const {hashExecutionSelection,writeCommittedJson,readCommittedJson}=await import(${JSON.stringify(domainRoot)});
    const fixtureRoot=${JSON.stringify(fixtureRoot)};
    let currentFixture=null,factoryCalls=0,forbiddenCalls=0;
    mock.module(${JSON.stringify(isolationRoot)}, {namedExports:{...isolation,
      createDockerIsolationRuntime:(input)=>{
        factoryCalls++;
        const fixture=currentFixture;
        assert.deepEqual(Object.keys(input).sort(),['borrowPaths','inspectReceipts']);
        assert.equal(input.borrowPaths,fixture.host.borrowPaths);
        assert.equal(input.inspectReceipts,fixture.host.inspectReceipts);
        const cleanupResults=new WeakMap();
        const cleanup=async()=>{
          const result=await fixture.deps.cleanupOwnedResources();
          fixture.cleanupResult=result;
          cleanupResults.set(result,true);return result;
        };
        const verify=(result,identity,recovery,management)=>{
          fixture.verifications++;
          if(identity!==executionInput.planIdentity(fixture.plan)||recovery!==fixture.recovery||management!==fixture.management)return null;
          return cleanupResults.has(result)?result.resourceObservations:null;
        };
        fixture.verifyCleanup=verify;
        return {
          startCommand:()=>{throw Error('unexpected_primitive_call');},
          startExecution:(projected,recovery,management,hooks)=>{
            fixture.starts++;
            assert.equal(projected.identity,executionInput.planIdentity(fixture.plan));
            assert.deepEqual(projected.configuration,executionInput.resolveIsolationCommandInput(fixture.plan,fixture.tmp));
            assert.equal(projected.stdin,fixture.plan.providerInput);
            assert.equal(recovery,fixture.recovery);assert.equal(management,fixture.management);
            return isolation.startDockerCommandSessionCandidate(purposes,{
              startCommand:purpose=>fixture.deps.startCommand({purpose}),
              cleanup,verifyCleanup:result=>verify(result,projected.identity,recovery,management)
            },hooks);
          },
          cleanupOwnedResources:()=>{throw Error('unexpected_duplicate_cleanup');},
          verifyCleanupOutcome:verify
        };
      }
    }});
    const api=await import(${JSON.stringify(root)});
    const executionInput=await import(${JSON.stringify(new URL("../src/attempt/isolation.ts", import.meta.url).href)});
    const preparationInput=await import(${JSON.stringify(new URL("../src/attempt/preparation.ts", import.meta.url).href)});
    const testing=await import(${JSON.stringify(new URL("./executor-test.ts", import.meta.url).href)});
    const create=testing.createExecutorTestCandidate;
    const purposes=[
      'create_subscription_auth_probe','start_subscription_auth_probe_attached',
      'create_internal_network','create_egress_network','create_proxy',
      'connect_proxy_egress','create_provider','start_proxy','start_provider_attached'
    ];
    for(const provider of ['codex','claude']){
    for(const mode of ['candidate','production_factory']){
    for(const scenario of ['normal','cancel','cleanup_unknown','submission_throw']){
      const directory=path.join(fixtureRoot,provider+'-'+mode+'-'+scenario);
      fs.mkdirSync(directory);
      const lock=path.join(directory,'fixture.lock');
      const descriptor=fs.openSync(lock,'wx');
      fs.writeFileSync(descriptor,'executor-standalone-fixture');
      assert.throws(()=>fs.openSync(lock,'wx'),{code:'EEXIST'});
      let lockHeld=true,sequence=0;
      const snapshot=()=>fs.readdirSync(directory).sort().map(name=>[name,fs.readFileSync(path.join(directory,name)).toString('base64')]);
      const management={},prepared={},mount={},authority={},recovery={};
      const recoveryId='docker-task.'+'d'.repeat(64)+'.'+'e'.repeat(64)+'.'+'f'.repeat(64);
      const commit=(kind,owner=management,gate=()=>true)=>{
        if(!lockHeld||owner!==management||gate()!==true)return false;
        const name='event-'+String(++sequence).padStart(3,'0')+'.json';
        const value={kind,operationId:'OP-123456',recoveryId,sequence,provider};
        const written=writeCommittedJson(directory,name,name,value);
        const read=readCommittedJson(written.target,name);
        assert.equal(read.hash,written.hash);
        assert.equal(read.identityText,written.identityText);
        assert.deepEqual(read.value,value);
        return true;
      };
      const filesBefore=snapshot();
      assert.equal(commit('rejected',{},()=>true),false);
      assert.equal(commit('rejected',management,()=>false),false);
      assert.throws(()=>commit('rejected',management,()=>{throw Error('synthetic_gate_throw');}));
      assert.deepEqual(snapshot(),filesBefore);
      assert.equal(fs.readFileSync(lock,'utf8'),'executor-standalone-fixture');
      const suffix='0101010101010101';
      let plan={
        provider,consumer:'coordinator_cli',operationId:'OP-123456',
        grantRef:'PHMGRANT-123456',selectionRecordId:'MODELSEL-12345678',taskAttempt:0,
        executionSelection:{provider,modelIdentifier:provider==='codex'?'gpt-5.5':'opus',identifierKind:provider==='codex'?'exact':'alias',
          reasoningEffort:'low',purpose:'task',catalogIdentity:'a'.repeat(64),
          configIdentity:'b'.repeat(64),role:'executor',workType:null,source:'explicit'},
        activeMountCapability:mount,authorityUseCapability:authority,
        providerHomeSourcePath:'C:\\synthetic-not-accessed\\home',
        providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:'b'.repeat(64),
        localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64),
        authContainerName:'crdd-auth-'+suffix,providerContainerName:'crdd-'+provider+'-'+suffix,
        proxyContainerName:'crdd-proxy-'+suffix,internalNetworkName:'crdd-internal-'+suffix,
        egressNetworkName:'crdd-egress-'+suffix,ownershipLabel:'crdd.coordinator.runtime='+suffix,
        providerImageDigest:'sha256:'+'1'.repeat(64),proxyImageDigest:'sha256:'+'2'.repeat(64),
        subscriptionOffering:provider==='codex'?'chatgpt_subscription_oauth':'claude_max',selectedModel:provider==='codex'?'gpt-5.5':'opus',selectedEffort:'low',
        operationMode:'boolean_probe',taskRole:null,taskPacketRef:null,taskPacketHash:null,
        providerInput:null,workspaceSourcePath:null,workspaceMountMode:null,networkPolicy:null,
        commands:purposes.map(purpose=>({purpose,argv:[purpose]}))
      };
      const fullSelection=plan.executionSelection;
      const selectionHash=hashExecutionSelection(fullSelection);
      plan={...plan,selectionHash,executionSelection:{provider:fullSelection.provider,modelIdentifier:fullSelection.modelIdentifier,identifierKind:fullSelection.identifierKind,reasoningEffort:fullSelection.reasoningEffort,purpose:fullSelection.purpose,role:fullSelection.role}};
      const tmp='C:/synthetic-not-accessed/tmp';
      if(mode==='production_factory'){
        const built=preparationInput.buildProviderDockerExecutionPlan(provider,
          {randomBytes:size=>Buffer.alloc(size,1)},
          {operationId:plan.operationId,mounts:{workspace:'C:/synthetic-not-accessed/work',tmp}},
          {grant:{...plan},activeMountCapability:mount},
          {selectionRecordId:plan.selectionRecordId,operationId:plan.operationId,executorProvider:provider,
            executionSelection:plan.executionSelection,selectionHash:plan.selectionHash,
            taskAttempt:0,model:plan.selectedModel,effort:'low',selectionNotice:'synthetic'},
          'C:/synthetic-not-accessed/home',0,0,null,null,null,'coordinator_cli');
        assert.ok(built);
        plan=Object.freeze({...built,authorityUseCapability:authority});
        assert.ok(executionInput.resolveValidatedPlan(plan,tmp));
      }
      const resources=[
        ['create_egress_network',plan.egressNetworkName],
        ['create_internal_network',plan.internalNetworkName],
        ['create_provider',plan.providerContainerName],
        ['create_proxy',plan.proxyContainerName],
        ['create_subscription_auth_probe',plan.authContainerName]
      ].map(([purpose,plannedResourceName])=>Object.freeze({purpose,plannedResourceName,
        dockerId:null,observation:'absent'}));
      const calls=[],events=[],notices=[];
      let terminal=null,terminalResult=null;
      let consumed=false,cleanups=0,mounts=0,finalizations=0;
      const providerWaiting=Promise.withResolvers();
      const providerWait=Promise.withResolvers();
      const cleanupEntered=Promise.withResolvers();
      const cleanupWait=Promise.withResolvers();
      const deps={
        effectExecutorAvailable:true,
        verifyRevision:()=>({revisionCurrent:true}),
        consumePreparedPlan:(p,m)=>{
          if(p!==prepared||m!==management||consumed)return null;
          consumed=true;return plan;
        },
        consumeProviderAuthority:(a,mt,m)=>{
          assert.equal(a,authority);assert.equal(mt,mount);assert.equal(m,management);
          return {operationId:plan.operationId,provider:plan.provider,
            providerHomeMountGrantRef:plan.grantRef,runtimeAuthorityIssued:true,providerEffectAllowed:true};
        },
        beginRecovery:()=>{
          assert.equal(commit('recovery_opened'),true);
          return {status:'ready',recoveryId,recoveryCapability:recovery};
        },
        verifyRecoveryBinding:(r,id,m,h)=>r===recovery&&id===recoveryId&&m===management&&h==='d'.repeat(64),
        startCommand:(command)=>{
          const count={purpose:command.purpose,started:0,wait:0,terminated:0};calls.push(count);
          return {
            started:async()=>{count.started++;return true;},
            wait:async()=>{
              count.wait++;
              if(command.purpose==='start_provider_attached'&&scenario==='cancel'){
                providerWaiting.resolve();await providerWait.promise;events.push('wait_returned');
              }
              return {status:0,signal:null,stderr:'',outputExceeded:false,stdout:
                command.purpose==='start_subscription_auth_probe_attached'
                  ?(provider==='codex'?'Logged in using ChatGPT':JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',
                    forcedLoginMethod:'claudeai',subscriptionType:'max'}))
                  :command.purpose==='start_provider_attached'
                    ?(provider==='codex'?JSON.stringify({status:true}):JSON.stringify({type:'result',subtype:'success',is_error:false,
                      num_turns:2,total_cost_usd:0,structured_output:{status:true}})+'\\n'):''};
            },
            terminateAndWait:async()=>{
              count.terminated++;events.push('terminated');providerWait.resolve();return true;
            }
          };
        },
        cleanupOwnedResources:async()=>{
          cleanups++;events.push('cleanup_entered');cleanupEntered.resolve();
          if(scenario==='cancel')await cleanupWait.promise;
          events.push('cleanup_returned');
          return {confirmed:scenario!=='cleanup_unknown',processTreeTerminated:true,
            containersAbsent:scenario!=='cleanup_unknown',networksAbsent:scenario!=='cleanup_unknown',
            resourceObservations:scenario==='cleanup_unknown'?null:resources};
        },
        completeMount:()=>{assert.equal(commit('mount_closed'),true);mounts++;return {status:'completed'};},
        completeRecovery:()=>{assert.equal(commit('recovery_closed'),true);finalizations++;return {status:'completed',recoveryFinalizationCapability:{}};},
        recordDockerAbsence:(_r,observed)=>{assert.equal(observed,resources);return commit('absence_observed');},
        recordMountCompletion:()=>commit('mount_recorded'),
        markResourceSubmission:()=>commit('submission_planned'),
        recordResourceReceipt:()=>commit('receipt_recorded'),
        recordProviderSubmission:(r)=>{
          assert.equal(r,recovery);notices.push(r);
          if(scenario==='submission_throw')throw Error('synthetic_submission_failure');
          return commit('provider_submission');
        },
        recordTerminalObservation:(r,result,observation)=>{
          assert.equal(r,recovery);assert.equal(observation.operationId,plan.operationId);
          assert.equal(observation.recoveryId,recoveryId);assert.equal(terminal,null);
          terminal=observation;terminalResult=result;
        }

      };
      const unavailable=()=>{forbiddenCalls++;throw Error('host_primitive_forbidden');};
      const host={...deps,borrowPaths:m=>{
        assert.equal(m,management);return {tmp};
      },inspectReceipts:unavailable,startCommand:unavailable,startExecution:unavailable,
        cleanupOwnedResources:unavailable,verifyCleanupOutcome:unavailable};
      currentFixture={deps,host,plan,tmp,recovery,management,starts:0,verifications:0};
      const callsBefore=factoryCalls;
      let activated=false,completedNotices=0;
      const options={...host,
        verifyOperationMount:(m,mt)=>{assert.equal(m,management);assert.equal(mt,mount);return {operationId:plan.operationId,mounts:{workspace:"C:/synthetic-not-accessed/work",tmp}};},
        activateMount:()=>{if(activated)return {status:"blocked",grant:null,activeMountCapability:null};activated=true;return {status:"activated",grant:{...plan},activeMountCapability:mount};},
        borrowMountSource:()=>"C:/synthetic-not-accessed/home",wallNow:()=>0,monotonicNow:()=>0,randomBytes:size=>Buffer.alloc(size,1),
        consumeModelSelection:()=>{if(consumed)return null;consumed=true;return {selectionRecordId:plan.selectionRecordId,operationId:plan.operationId,executorProvider:provider,executionSelection:plan.executionSelection,selectionHash:plan.selectionHash,taskAttempt:0,model:plan.selectedModel,effort:"low",selectionNotice:"synthetic"};},
        issueProviderAuthority:()=>({status:"issued",useCapability:authority,controlCapability:{},operationId:plan.operationId,provider,providerHomeMountGrantRef:plan.grantRef,runtimeAuthorityIssued:true}),
        revokeProviderAuthority:()=>({status:"revoked"}),
        onCompleted:result=>{completedNotices++;assert.equal(result,terminalResult??result);if(scenario==="submission_throw")throw Error("synthetic_observer");},
      };
      const runtime=mode==="candidate"?create(deps):api.createExecutor(options);
      assert.equal(factoryCalls-callsBefore,mode==="candidate"?0:1);
      if(mode==="candidate")assert.equal(runtime.productionAuthority,false);
      const input={purpose:"probe",managementCapability:management,mountCapability:mount,mountAuthorizationCapability:{},selectionUseCapability:{},recoveryCorrelationId:null,consumer:"coordinator_cli"};
      const handoff=(r,id)=>{assert.equal(r,recovery);assert.equal(id,recoveryId);events.push("handoff");return true;};
      const started=mode==="candidate"?runtime.start(prepared,management,handoff):runtime.start(provider,input,handoff);
      assert.equal(started.status,'started',scenario);
      assert.equal((mode==='candidate'?runtime.start(prepared,management):runtime.start(provider,input,handoff)).status,'blocked');
      let settled=false;
      const completion=started.completion.then(result=>{settled=true;return result;});
      if(scenario==='cancel'){
        await providerWaiting.promise;
        assert.equal((await runtime.cancel(started.controlCapability,{})).status,'blocked');
        const cancelling=runtime.cancel(started.controlCapability,management);
        await cleanupEntered.promise;
        assert.equal(settled,false);
        assert.equal(calls.at(-1).terminated,1);
        assert.ok(events.indexOf('terminated')<events.indexOf('wait_returned'));
        assert.ok(events.indexOf('wait_returned')<events.indexOf('cleanup_entered'));
        cleanupWait.resolve();
        const cancelled=await cancelling;
        assert.equal(cancelled.status,'requested');
        assert.equal(cancelled.reason,'provider_cancellation_requested');
        assert.equal(cancelled.cancellationRequested,true);
        assert.equal(cancelled.processTerminationObserved,true);
      }
      const result=await completion;
      assert.equal(cleanups,1);
      assert.equal(events[0],'handoff');
      const expected=scenario==='submission_throw'?purposes.slice(0,-1):purposes;
      assert.deepEqual(calls.map(c=>c.purpose),expected);
      for(const call of calls){
        assert.equal(call.started,call.purpose==='start_provider_attached'?1:0,call.purpose);
        assert.equal(call.wait,1,call.purpose);
      }
      assert.equal(calls.reduce((n,c)=>n+c.terminated,0),scenario==='cancel'?1:0);
      assert.equal(result.status,scenario==='normal'?'completed':scenario==='cancel'?'cancelled':'blocked',provider+':'+mode+':'+scenario+':'+result.reason);
      assert.equal(result.cleanupConfirmed,scenario!=='cleanup_unknown');
      assert.equal(result.manualRecoveryRequired,scenario==='cleanup_unknown');
      assert.equal(result.recoveryId,scenario==='cleanup_unknown'?recoveryId:null);
      assert.equal(mounts,scenario==='cleanup_unknown'?0:1);
      assert.equal(finalizations,mounts);
      assert.equal(notices.length,1);
      if(scenario==='normal'){
        assert.match(result.resultSha256,/^[a-f0-9]{64}$/);
        assert.ok(result.resultBytes>0);
      } else assert.equal(result.resultSha256,null);
      if(scenario==='cleanup_unknown')
        assert.equal(result.reason,'docker_process_controller_cleanup_unconfirmed');
      if(scenario==='submission_throw')
        assert.equal(result.reason,'docker_process_controller_execution_failed_closed');
      if(scenario==='cleanup_unknown')assert.equal(terminal,null);
      else {
        assert.ok(terminal,scenario);assert.equal(terminal.resources,resources);
        assert.equal(terminalResult,result);
        assert.equal(commit('terminal_received'),true);
      }
      for(const name of ['verifyProviderSubmissionNotice','verifyUnissuedNotice','borrowTerminalObservations'])
        assert.equal(name in runtime,false,name);
      if(mode==='production_factory'){
        assert.equal(completedNotices,1);
        assert.equal(runtime.verifyCleanupOutcome,undefined);
        assert.equal(currentFixture.starts,1);
        assert.ok(currentFixture.verifications>0);
        const original=currentFixture.cleanupResult;
        assert.ok(original);
        assert.equal(currentFixture.verifyCleanup(original,executionInput.planIdentity(plan),recovery,management),scenario==='cleanup_unknown'?null:resources);
        assert.equal(currentFixture.verifyCleanup({...original},executionInput.planIdentity(plan),recovery,management),null);
        assert.equal(currentFixture.verifyCleanup(original,executionInput.planIdentity(plan),{},management),null);
        assert.equal(currentFixture.verifyCleanup(original,executionInput.planIdentity(plan),recovery,{}),null);
        assert.equal(currentFixture.verifyCleanup({},executionInput.planIdentity(plan),recovery,management),null);
      }
      const count=calls.length;
      providerWait.resolve();cleanupWait.resolve();await Promise.resolve();
      assert.equal(calls.length,count);
      assert.equal((await runtime.cancel(started.controlCapability,management)).status,'blocked');
      fs.closeSync(descriptor);fs.unlinkSync(lock);lockHeld=false;
      const released=fs.openSync(lock,'wx');fs.closeSync(released);fs.unlinkSync(lock);
      const afterRelease=snapshot();
      assert.equal(commit('after_release'),false);
      assert.deepEqual(snapshot(),afterRelease);
      assert.ok(sequence>0);
    }
    }
    }
    assert.equal(factoryCalls,8);
    assert.equal(forbiddenCalls,0);
    assert.equal(externalProcessCalls,0);
    assert.equal(coordinatorResolutions,0);
  `;
  let childClosed = false;
  let primaryFailure: unknown = null;
  try {
    const child = spawnSync(
      process.execPath,
      ["--experimental-test-module-mocks", "--input-type=module", "-e", script],
      {
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
      },
    );
    childClosed =
      child.error === undefined &&
      child.signal === null &&
      child.status !== null;
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
  } catch (error) {
    primaryFailure = error;
  }
  let cleanupFailure: unknown = null;
  try {
    if (!childClosed)
      throw new Error(`executor_test_child_unconfirmed: ${fixtureRoot}`);
    assert.equal(
      fs.realpathSync(fixtureRoot).toLowerCase(),
      fixtureRoot.toLowerCase(),
    );
    assert.equal(path.dirname(fixtureRoot).toLowerCase(), parent.toLowerCase());
    const currentIdentity = fs.statSync(fixtureRoot, { bigint: true });
    assert.equal(currentIdentity.dev, fixtureIdentity.dev);
    assert.equal(currentIdentity.ino, fixtureIdentity.ino);
    assert.equal(currentIdentity.birthtimeNs, fixtureIdentity.birthtimeNs);
    for (const entry of fs.readdirSync(fixtureRoot)) {
      assert.match(
        entry,
        /^(codex|claude)-(candidate|production_factory)-(normal|cancel|cleanup_unknown|submission_throw)$/,
      );
      const directory = path.join(fixtureRoot, entry);
      assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
      for (const name of fs.readdirSync(directory)) {
        assert.match(
          name,
          /^(fixture\.lock|event-[0-9]{3}\.json(?:\.crdd-commit\.json)?)$/,
        );
        const file = path.join(directory, name);
        const stat = fs.lstatSync(file);
        assert.equal(stat.isFile(), true);
        assert.equal(stat.isSymbolicLink(), false);
        assert.equal(stat.nlink, 1);
        if (name === "fixture.lock")
          assert.equal(
            fs.readFileSync(file, "utf8"),
            "executor-standalone-fixture",
          );
        else {
          assert.ok(fs.statSync(file).size <= 4096);
          const value = JSON.parse(fs.readFileSync(file, "utf8"));
          if (name.endsWith(".crdd-commit.json")) {
            assert.equal(
              value.schema,
              "crdd-coordinator-durable-json-commit/v1",
            );
            assert.equal(
              value.logicalKey,
              name.replace(/\.crdd-commit\.json$/u, ""),
            );
          } else {
            assert.equal(value.operationId, "OP-123456");
            assert.equal(value.provider, entry.split("-")[0]);
            assert.equal(
              value.recoveryId,
              `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
            );
            assert.ok(
              [
                "recovery_opened",
                "mount_closed",
                "recovery_closed",
                "absence_observed",
                "mount_recorded",
                "submission_planned",
                "receipt_recorded",
                "provider_submission",
                "terminal_received",
              ].includes(value.kind),
            );
          }
        }
      }
    }
    fs.rmSync(fixtureRoot, { recursive: true });
    assert.equal(fs.existsSync(fixtureRoot), false);
  } catch (error) {
    cleanupFailure = new Error(
      `executor_test_cleanup_unconfirmed: ${fixtureRoot}`,
      { cause: error },
    );
  }
  if (primaryFailure !== null && cleanupFailure !== null)
    throw new AggregateError(
      [primaryFailure, cleanupFailure],
      "executor_test_failed_and_cleanup_unconfirmed",
      { cause: primaryFailure },
    );
  if (primaryFailure !== null) throw primaryFailure;
  if (cleanupFailure !== null) throw cleanupFailure;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    2,
    "standalone_non_ai_accepts_no_arguments",
  );
  verifyStandaloneProviderAttempt();
  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      scope: "standalone_non_ai",
      externalAiIssued: false,
      dockerIssued: false,
    })}\n`,
  );
}
