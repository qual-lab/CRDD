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
import { spawnSync } from "node:child_process";
import { fork } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import test from "node:test";

/**
 * 明示起動前の計画と拒否は外部境界を開かない。
 * @responsibility import・describe・不正Provider・非TTYをEffect前に閉じる。
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
    await assert.rejects(api.runStandaloneProviderTrialCli(['--run','codex','fixture-12345678']));
    await assert.rejects(api.runStandaloneProviderTrialCli(['--run','codex','../bad']));
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
          const item={text:'A pending documentation task.',references:['synthetic-context']};const advice={contract:'crdd-coordinator/workbench-ai-advice-result',contractRevision:1,status:'completed',facts:[item],sharedAnalysis:[],additionalInferences:[],nextOptions:[item]};
          original={status:mode==='cancel'?'cancelled':'completed',reason:mode==='cancel'?'provider_operation_cancelled':null,cleanupConfirmed:released,resultSha256:'a'.repeat(64),resultBytes:10,normalizedResult:{adviceJson:mode==='bad_advice'?'{}':JSON.stringify(advice)}};return original;
        })()};},
        recordTerminal:value=>{if(value!==original||!value.cleanupConfirmed)return false;save('terminal_received');return true;}
      };
    }}});
    const api=await import(${JSON.stringify(url("../../scripts/verify-provider-real.ts"))});
    const repository=fileURLToPath(new URL('../../../',${JSON.stringify(url("../../scripts/verify-provider-real.ts"))}));
    for(mode of ['normal','cancel','changed','changed_release_unknown','home_unknown','unexpected_error','prestart_cancel','acquire_unknown','release_unknown','bad_advice']){
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
 * 親は同意・nonce・単一結果・close・記録を共同確認する。
 * @responsibility 受信だけの成功や同意不成立後のforkを拒否する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition Readerとforkは代役、Git Root読取りと新品確定JSONだけ実I/O。
 * @stimulus 正常、拒否、別nonce、重複結果、非零close、出力混入、close不明。
 * @observation fork回数、限定結果、Root保持と通常清掃。
 * @oracle 結果受領だけでは削除しない。取消は同じ子へ一回。
 * @cleanup 代役子しか存在しない自己生成Rootだけ内容確認後に回収する。
 * @boundary 実子のclose意味はNode契約と後続実境界で別確認する。
 */
test("単段CLI親は同意・IPC・終了・清掃を分離する", () => {
  const url = (value: string) => new URL(value, import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,randomUUID} from 'node:crypto';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {mock} from 'node:test';
    const platform=await import(${JSON.stringify(url("../../../platform-access/src/index.ts"))});const domain=await import(${JSON.stringify(url("../../../domain-model/src/index.ts"))});
    let mode='normal',challenge=null,forks=0,cancelCount=0,output=[],gitCalls=0,beforeWait=null;
    Object.defineProperty(process.stdin,'isTTY',{value:true,configurable:true});Object.defineProperty(process.stdout,'isTTY',{value:true,configurable:true});
    mock.method(process.stdout,'write',function(value,...rest){const text=String(value);const found=/この端末に ([0-9]{6})/.exec(text);if(found)challenge=found[1];if(text.startsWith('{'))output.push(JSON.parse(text));const callback=rest.find(v=>typeof v==='function');if(callback)callback(null);return true;});
    mock.module(${JSON.stringify(url("../../../platform-access/src/index.ts"))},{namedExports:{...platform,
      readConfirmationCodeOutcome:async()=>({status:'completed',line:mode==='consent_mismatch'?'wrong':challenge}),
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
          const recoveryId='docker-task.'+'d'.repeat(64)+'.'+createHash('sha256').update(root).digest('hex')+'.'+'f'.repeat(64);
          const resources=['create_provider','create_proxy','create_subscription_auth_probe','create_internal_network','create_egress_network'].map((purpose,index)=>({purpose,plannedResourceName:'crdd-'+['codex','proxy','auth','internal','egress'][index]+'-'+'a'.repeat(16),dockerId:String(index+1).repeat(64),observation:'absent'}));
          const diagnostic={primaryFailure:null,providerProcessStartedObserved:true,processTreeTerminationObserved:true,containersAbsentObserved:true,networksAbsentObserved:true,cleanupConfirmed:true};
          const records=[{kind:'recovery_opened'},{kind:'recovery_handoff'},...resources.flatMap(r=>[{kind:'submission_planned',purpose:r.purpose,plannedResourceName:r.plannedResourceName,ownershipLabel:'crdd.coordinator.runtime='+'a'.repeat(16)},{kind:'receipt_recorded',purpose:r.purpose,dockerId:r.dockerId}]),...['absence_observed','home_release_requested','home_released','mount_recorded','recovery_closed','execution_settled','terminal_received'].map(kind=>({kind}))];
          if(mode==='bad_planned_name')records.find(v=>v.kind==='submission_planned'&&v.purpose==='create_subscription_auth_probe').plannedResourceName='crdd-auth-'+'b'.repeat(16);
          if(mode==='mixed_label')records[2].ownershipLabel='crdd.coordinator.runtime='+'b'.repeat(16);
          if(mode==='duplicate_purpose')records.splice(3,0,{...records[2]});
          if(mode==='bad_provider_name')records[2].plannedResourceName='crdd-codex-'+'c'.repeat(16);
          if(mode==='bad_absence_name')resources[0].plannedResourceName='crdd-codex-'+'c'.repeat(16);
          for(const [i,record] of records.entries()){const kind=record.kind,name='event-'+String(i+1).padStart(3,'0')+'.json';domain.writeCommittedJson(root,name,name,{...record,recordedAt:new Date().toISOString(),operationId:'OP-123456',provider:input.provider,recoveryId,sequence:i+1,...(kind==='absence_observed'?{resources}:{}),...(kind==='execution_settled'?diagnostic:{}),...(kind==='terminal_received'?{status:'completed',reason:null,resultSha256:'a'.repeat(64),resultBytes:10}:{})});}
          const result={status:'completed',reason:null,recoveryId,cleanupConfirmed:true,releaseConfirmed:true,terminalSaved:true,nativeCleanupConfirmed:true,adviceConfirmed:true,resultSha256:'a'.repeat(64),resultBytes:10,diagnostic};
          if(mode==='failed_diag')Object.assign(result,{status:'blocked',reason:'docker_process_controller_cleanup_unconfirmed',cleanupConfirmed:false,releaseConfirmed:false,terminalSaved:false,adviceConfirmed:false,resultSha256:null,resultBytes:0,diagnostic:{...diagnostic,cleanupConfirmed:false,primaryFailure:{purpose:'create_subscription_auth_probe',stage:'command_wait',reason:'docker_process_controller_execution_failed_closed',exceptionCode:null,commandHandleObtained:true,responseObserved:false,receiptRecorded:false,commandObservation:null}}});
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
    for(mode of ['consent_mismatch','normal','wrong_nonce','duplicate_result','nonzero_close','stdout','close_unknown','disconnected_no_close','cancel_completed','result_lost','late_close','missing_recovery','ack_late','ack_error','ack_missing','failed_diag','raw_diag','bad_planned_name','mixed_label','duplicate_purpose','bad_provider_name','bad_absence_name']){
      forks=0;cancelCount=0;gitCalls=0;output=[];root=null;challenge=null;timeoutDelay=null;beforeWait=null;
      const code=await api.runStandaloneProviderTrialCli(['--run','codex','fixture-'+randomUUID()]);const result=output.at(-1);
      const success=['normal','ack_late'].includes(mode);
      assert.equal(code,success?0:2,mode);assert.equal(forks,mode==='consent_mismatch'?0:1,mode);
      if(mode==='consent_mismatch'){assert.equal(result.effectIssued,false);assert.equal(gitCalls,0);assert.equal(root,null);continue;}
      assert.equal(gitCalls,1);
      assert.equal(result.fixtureCleanupConfirmed,success,mode);assert.ok(timeoutDelay>10000);
      if(mode==='failed_diag'){assert.equal(result.result.diagnostic.primaryFailure.stage,'command_wait');assert.equal(result.result.diagnostic.cleanupConfirmed,false);}
      if(mode==='raw_diag'){assert.equal(result.result,null);assert.equal(JSON.stringify(result).includes('forbidden'),false);}
      if(success)assert.equal(fs.existsSync(root),false);else{
        assert.equal(fs.existsSync(root),true);assert.equal(result.fixtureRoot,root);assert.equal(result.retentionRecordConfirmed,!['close_unknown','disconnected_no_close'].includes(mode));
        assert.equal(result.recoveryId,'docker-task.'+'d'.repeat(64)+'.'+createHash('sha256').update(root).digest('hex')+'.'+'f'.repeat(64));
        if(['close_unknown','disconnected_no_close'].includes(mode)){assert.equal(result.childCloseObserved,false);assert.deepEqual(fs.readdirSync(root).sort().map(name=>[name,fs.lstatSync(path.join(root,name)).isFile()?fs.readFileSync(path.join(root,name)).toString('base64'):null]),beforeWait);}
        assert.equal(fs.lstatSync(root).isSymbolicLink(),false);for(const name of fs.readdirSync(root)){const p=path.join(root,name),s=fs.lstatSync(p);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory())assert.equal(fs.readdirSync(p).length,0);else{assert.equal(s.isFile(),true);assert.equal(s.nlink,1);assert.match(name,/^(event-[0-9]{3}|outcome)\\.json(?:\\.crdd-commit\\.json)?$/);}}
        fs.rmSync(root,{recursive:true});assert.equal(fs.existsSync(root),false);
      }
      if(['wrong_nonce','duplicate_result','close_unknown','cancel_completed','late_close','missing_recovery'].includes(mode))assert.equal(cancelCount,1,mode);
    }
  `,
    ],
    { encoding: "utf8", timeout: 30000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
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
  for (const mode of ["bad_spec", "cancel_before_run"]) {
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
    const child = fork(script, ["--worker", nonce], {
      env,
      execArgv: [],
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
        if (mode === "cancel_before_run") child.send({ kind: "cancel", nonce });
        child.send({
          kind: "run",
          nonce,
          provider: "codex",
          runId,
          specHash: "0".repeat(64),
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
