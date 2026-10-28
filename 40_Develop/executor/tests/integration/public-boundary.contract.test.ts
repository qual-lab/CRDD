/**
 * Coordinatorを読み込めない環境で単段Executorの公開境界を確認する。
 * @packageDocumentation
 * @responsibility 独立ロード・有限代役上の単段生涯と私有Ownerの非公開を検査する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope Sourceと新品子Processのメモリだけ。Docker・AI・保存領域は利用しない。
 * @boundary Executor公開RootとCoordinatorの依存方向。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

/**
 * 利用側の単段接続を同じSource Oracleで照合する。
 * @responsibility 元Sourceと旧Path変異へ同じexact参照条件を適用する。
 * @trace ERB-IT-004
 * @precondition Source本文だけを受け取る。
 * @stimulus provider-executor参照と旧Ownerからの移管操作importを調べる。
 * @observation 正常通過又はAssertionError。
 * @oracle 固定Ownerへのexact一参照を要求し、旧Ownerで代用しない。
 * @cleanup N/A: 同期の文字列検査のみ。
 * @boundary Source配線だけ。実資源や実行Authorityを証明しない。
 */
function assertProviderExecutorConsumer(source: string, name: string) {
  assert.equal(
    [...source.matchAll(/from\s+["']\.\/provider-executor\.ts["']/g)].length,
    1,
    name,
  );
  for (const match of source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*["']\.\/(?:observation|controller)\.ts["']/g,
  )) {
    assert.doesNotMatch(
      match[1] ?? "",
      /verifyRuntimeOwnedDocker(?:ProviderSubmissionNotice|UnissuedNotice|CleanupOutcome)|borrowRuntimeOwnedDockerTerminalObservations/,
      name,
    );
  }
}

/**
 * 独立ロードと拒否経路の境界を反証する。
 * @responsibility Coordinator抜きのRootロードと私有状態の非公開を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 現在のSourceとNodeだけを使用する。
 * @stimulus Coordinator解決を拒否し、無効な準備参照を候補Runtimeへ渡す。
 * @observation 子Process終了値、公開名、開始・取消結果と依存呼出し数。
 * @oracle 生の依存を呼ばずblockedとなり、Map・任意実装Factoryを公開しない。
 * @cleanup 子Processの同期終了を確認する。外部試験物は生成しない。
 * @boundary 独立Libraryの公開Root。正常実行の成立は別の有限Controller結合試験で確認する。
 */
test("ExecutorはCoordinator非存在でロードでき、不正な開始をEffectなしで拒否する", () => {
  const root = new URL("../../src/index.ts", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    registerHooks({resolve(s,c,n){
      const resolved=n(s,c);
      if(resolved.url.includes('/coordinator/'))throw Error('coordinator_unavailable');
      return resolved;
    }});
    const api=await import(${JSON.stringify(root)});
    for(const name of ['createProviderObservationOwner','createProviderAttemptRuntime','registerSubmission','registerTerminal'])
      assert.equal(name in api,false,name);
    let calls=0;
    const dependencies=new Proxy({}, {get(){return ()=>{calls++;throw Error('unexpected_effect');};}});
    const runtime=api.createIsolatedDockerProcessControllerCandidate(dependencies);
    assert.equal(runtime.start(null,null).status,'blocked');
    assert.equal((await runtime.cancel(null,null)).status,'blocked');
    assert.equal(calls,0);
    assert.equal(runtime.borrowTerminalObservations({}, {}, 'op', 'recovery'),null);
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

/**
 * Coordinatorなしの単段開始から終了相関までを反証する。
 * @responsibility 有限Command代役と実Controller・DI sessionの正常・取消・不明を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 新品子ProcessでCoordinatorの解決を禁止する。
 * @stimulus 候補と本番Factory配線の各構成で正常、wait中取消、清掃不明、同期通知保存例外を実行する。
 * @observation 九purposeの順序、開始・wait・終了回数、元通知と終端相関。
 * @oracle 取消はjoinと清掃まで未完了、不明はexact回復参照保持、コピー・別Ownerは拒否。
 * @cleanup 全completionを待ち、子Processの期限内終了を確認する。外部試験物なし。
 * @boundary 候補の生涯と本番Factoryの配線。DI RuntimeをModule代役にし、実Docker・Process不存在、耐久保存は未検証。
 */
test("Executor単独の候補・本番Factory配線は四つの終了条件と元Ownerを維持する", () => {
  const root = new URL("../../src/index.ts", import.meta.url).href;
  const isolationRoot = new URL(
    "../../../docker-isolation/src/index.ts",
    import.meta.url,
  ).href;
  const domainRoot = new URL(
    "../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const script = `
    import assert from 'node:assert/strict';
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
    const {hashExecutionSelection}=await import(${JSON.stringify(domainRoot)});
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
          assert.equal(identity,api.planIdentity(fixture.plan));
          assert.equal(recovery,fixture.recovery);
          assert.equal(management,fixture.management);
          return cleanupResults.has(result)?result.resourceObservations:null;
        };
        return {
          startCommand:()=>{throw Error('unexpected_primitive_call');},
          startExecution:(projected,recovery,management,hooks)=>{
            fixture.starts++;
            assert.equal(projected.identity,api.planIdentity(fixture.plan));
            assert.deepEqual(projected.configuration,api.resolveIsolationCommandInput(fixture.plan,fixture.tmp));
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
    const create=api.createIsolatedDockerProcessControllerCandidate;
    const purposes=[
      'create_subscription_auth_probe','start_subscription_auth_probe_attached',
      'create_internal_network','create_egress_network','create_proxy',
      'connect_proxy_egress','create_provider','start_proxy','start_provider_attached'
    ];
    const terminals=[];
    for(const mode of ['candidate','production_factory']){
    for(const scenario of ['normal','cancel','cleanup_unknown','submission_throw']){
      const management={},prepared={},mount={},authority={},recovery={};
      const recoveryId='docker-task.'+'d'.repeat(64)+'.'+'e'.repeat(64)+'.'+'f'.repeat(64);
      const suffix='0101010101010101';
      let plan={
        provider:'claude',consumer:'coordinator_cli',operationId:'OP-123456',
        grantRef:'PHMGRANT-123456',selectionRecordId:'MODELSEL-12345678',taskAttempt:0,
        executionSelection:{provider:'claude',modelIdentifier:'opus',identifierKind:'alias',
          reasoningEffort:'low',purpose:'task',catalogIdentity:'a'.repeat(64),
          configIdentity:'b'.repeat(64),role:'executor',workType:null,source:'explicit'},
        activeMountCapability:mount,authorityUseCapability:authority,
        providerHomeSourcePath:'C:\\synthetic-not-accessed\\home',
        providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:'b'.repeat(64),
        localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64),
        authContainerName:'crdd-auth-'+suffix,providerContainerName:'crdd-claude-'+suffix,
        proxyContainerName:'crdd-proxy-'+suffix,internalNetworkName:'crdd-internal-'+suffix,
        egressNetworkName:'crdd-egress-'+suffix,ownershipLabel:'crdd.coordinator.runtime='+suffix,
        providerImageDigest:'sha256:'+'1'.repeat(64),proxyImageDigest:'sha256:'+'2'.repeat(64),
        subscriptionOffering:'claude_max',selectedModel:'opus',selectedEffort:'low',
        operationMode:'boolean_probe',taskRole:null,taskPacketRef:null,taskPacketHash:null,
        providerInput:null,workspaceSourcePath:null,workspaceMountMode:null,networkPolicy:null,
        commands:purposes.map(purpose=>({purpose,argv:[purpose]}))
      };
      const tmp='C:/synthetic-not-accessed/tmp';
      if(mode==='production_factory'){
        const built=api.buildProviderDockerExecutionPlan('claude',
          {randomBytes:size=>Buffer.alloc(size,1)},
          {operationId:plan.operationId,createdAt:'2026-10-28T00:00:00.000Z',mounts:{
            workspace:'C:/synthetic-not-accessed/work',providerHome:'C:/synthetic-not-accessed/home',
            tmp,events:'C:/synthetic-not-accessed/events',projection:'C:/synthetic-not-accessed/projection',
            management:'C:/synthetic-not-accessed/management'}},
          {grant:{...plan},activeMountCapability:mount},
          {selectionRecordId:plan.selectionRecordId,operationId:plan.operationId,executorProvider:'claude',
            executionSelection:plan.executionSelection,selectionHash:hashExecutionSelection(plan.executionSelection),
            taskAttempt:0,model:'opus',effort:'low',speedMode:'normal',selectionNotice:'synthetic'},
          'C:/synthetic-not-accessed/home',0,0,null,null,null,'coordinator_cli');
        assert.ok(built);
        plan=Object.freeze({...built,authorityUseCapability:authority});
        assert.equal(api.validatePlan(plan,tmp),true);
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
        beginRecovery:()=>({status:'ready',recoveryId,recoveryCapability:recovery}),
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
                  ?JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',
                    forcedLoginMethod:'claudeai',subscriptionType:'max'})
                  :command.purpose==='start_provider_attached'
                    ?JSON.stringify({type:'result',subtype:'success',is_error:false,
                      num_turns:2,total_cost_usd:0,structured_output:{status:true}})+'\\n':''};
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
        completeMount:()=>{mounts++;return {status:'completed'};},
        completeRecovery:()=>{finalizations++;return {status:'completed',recoveryFinalizationCapability:{}};},
        recordDockerAbsence:(_r,observed)=>{assert.equal(observed,resources);return true;},
        recordMountCompletion:()=>true,
        markResourceSubmission:()=>true,
        recordResourceReceipt:()=>true,
        recordProviderSubmission:(r,notice)=>{
          assert.equal(r,recovery);notices.push(notice);
          assert.equal(runtime.verifyProviderSubmissionNotice(notice,recovery,management,plan.operationId,recoveryId),true);
          assert.equal(runtime.verifyProviderSubmissionNotice({...notice},recovery,management,plan.operationId,recoveryId),false);
          assert.equal(runtime.verifyProviderSubmissionNotice(notice,{},management,plan.operationId,recoveryId),false);
          assert.equal(runtime.verifyProviderSubmissionNotice(notice,recovery,{},plan.operationId,recoveryId),false);
          if(scenario==='submission_throw')throw Error('synthetic_submission_failure');
          return true;
        }
      };
      const unavailable=()=>{forbiddenCalls++;throw Error('host_primitive_forbidden');};
      const host={...deps,borrowPaths:m=>{
        assert.equal(m,management);return {tmp};
      },inspectReceipts:unavailable,startCommand:unavailable,startExecution:unavailable,
        cleanupOwnedResources:unavailable,verifyCleanupOutcome:unavailable};
      currentFixture={deps,host,plan,tmp,recovery,management,starts:0,verifications:0};
      const callsBefore=factoryCalls;
      const runtime=mode==='candidate'?create(deps):api.createProviderExecutor(host);
      assert.equal(factoryCalls-callsBefore,mode==='candidate'?0:1);
      if(mode==='candidate')assert.equal(runtime.productionAuthority,false);
      const started=runtime.start(prepared,management,(r,id)=>{
        assert.equal(r,recovery);assert.equal(id,recoveryId);events.push('handoff');return true;
      });
      assert.equal(started.status,'started',scenario);
      assert.equal(runtime.start(prepared,management).status,'blocked');
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
      assert.equal(result.status,scenario==='normal'?'completed':scenario==='cancel'?'cancelled':'blocked');
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
      for(const notice of notices)
        assert.equal(runtime.verifyProviderSubmissionNotice(notice,recovery,management,plan.operationId,recoveryId),false);
      const terminal=runtime.borrowTerminalObservations(result,management,plan.operationId,recoveryId);
      if(scenario==='cleanup_unknown')assert.equal(terminal,null);
      else {assert.ok(terminal,scenario);assert.equal(terminal.resources,resources);}
      for(const [r,m,op,id] of [[{...result},management,plan.operationId,recoveryId],
        [result,{},plan.operationId,recoveryId],[result,management,'OP-654321',recoveryId],
        [result,management,plan.operationId,'other']])
        assert.equal(runtime.borrowTerminalObservations(r,m,op,id),null);
      assert.equal(create(deps).borrowTerminalObservations(result,management,plan.operationId,recoveryId),null);
      for(const previous of terminals)
        assert.equal(runtime.borrowTerminalObservations(previous.result,previous.management,plan.operationId,recoveryId),null);
      terminals.push({result,management});
      if(mode==='production_factory'){
        assert.equal(currentFixture.starts,1);
        assert.ok(currentFixture.verifications>0);
        const original=currentFixture.cleanupResult;
        assert.ok(original);
        assert.equal(runtime.verifyCleanupOutcome(original,plan,recovery,management),scenario==='cleanup_unknown'?null:resources);
        assert.equal(runtime.verifyCleanupOutcome({...original},plan,recovery,management),null);
        assert.equal(runtime.verifyCleanupOutcome(original,plan,{},management),null);
        assert.equal(runtime.verifyCleanupOutcome(original,plan,recovery,{}),null);
        assert.equal(runtime.verifyCleanupOutcome({},plan,recovery,management),null);
      }
      const count=calls.length;
      providerWait.resolve();cleanupWait.resolve();await Promise.resolve();
      assert.equal(calls.length,count);
      assert.equal((await runtime.cancel(started.controlCapability,management)).status,'blocked');
    }
    }
    assert.equal(factoryCalls,4);
    assert.equal(forbiddenCalls,0);
    assert.equal(externalProcessCalls,0);
    assert.equal(coordinatorResolutions,0);
  `;
  const child = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

/**
 * 本番SourceのOwner境界を検査する。
 * @responsibility 逆依存・二重観測Owner・生状態の公開を防ぐ。
 * @trace ERB-IT-004
 * @precondition Sourceだけを読む。
 * @stimulus Executor閉包とCoordinatorの保存三利用側を照合する。
 * @observation import経路と固定Factoryの生成箇所。
 * @oracle Coordinator逆依存なし、Host側Factory一回、照合三利用側は同じ接続先。
 * @cleanup N/A: Source読取りのみ。
 * @boundary Source依存の契約。動的資源不存在の証明には使わない。
 */
test("観測MapはExecutor内に閉じ、保存三利用側は一つの本番Executorを照合する", () => {
  const root = new URL("../../src/", import.meta.url);
  for (const entry of fs.readdirSync(root, { recursive: true })) {
    if (!String(entry).endsWith(".ts")) continue;
    const source = fs.readFileSync(
      new URL(String(entry).replaceAll("\\", "/"), root),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /(?:from\s*|import\s*\()["'][^"']*coordinator\//,
    );
  }
  const coordinator = new URL(
    "../../../coordinator/src/execution/",
    import.meta.url,
  );
  const composition = fs.readFileSync(
    new URL("provider-executor.ts", coordinator),
    "utf8",
  );
  assert.equal(
    [...composition.matchAll(/createProviderExecutor\(/g)].length,
    1,
  );
  for (const name of ["persistence", "settlement", "recovery", "controller"]) {
    const source = fs.readFileSync(new URL(`${name}.ts`, coordinator), "utf8");
    assertProviderExecutorConsumer(source, name);
    for (const old of ["observation", "controller"]) {
      const mutation = source.replace("./provider-executor.ts", `./${old}.ts`);
      assert.throws(() =>
        assertProviderExecutorConsumer(mutation, `${name}:${old}`),
      );
    }
    assert.doesNotMatch(source, /createProviderObservationOwner/);
  }
  for (const old of ["observation", "controller"]) {
    const source = fs.readFileSync(new URL(`${old}.ts`, coordinator), "utf8");
    for (const symbol of [
      "verifyRuntimeOwnedDockerProviderSubmissionNotice",
      "verifyRuntimeOwnedDockerUnissuedNotice",
      "borrowRuntimeOwnedDockerTerminalObservations",
      "verifyRuntimeOwnedDockerCleanupOutcome",
    ]) {
      assert.doesNotMatch(
        source,
        new RegExp(`export (?:function|const) ${symbol}\\b`),
      );
    }
  }
});
