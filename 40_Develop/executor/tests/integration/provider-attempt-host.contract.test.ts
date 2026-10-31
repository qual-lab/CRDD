/**
 * 単独試験Hostの保存・元参照・排他生涯を実Homeなしで検査する。
 * @responsibility 下位だけを代役化し、実確定JSONと元終端の接続を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope 新品Root、実Writer、合成Lease、合成Docker session。
 * @boundary 実認証・OS Lock・Docker・AIの成立とは区別する。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

/**
 * 保存拒否・清掃不明・排他喪失を成功化しない。
 * @responsibility 準備一回消費、同期記録、取消join、元結果の相関を維持する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition Process・資源・Leaseだけを代役化した独立子Process。
 * @stimulus 正常・取消・清掃不明・排他喪失・解放拒否／例外・保存失敗。
 * @observation 生存・release回数、元result、実保存列と読戻し。
 * @oracle Effect前保存、技術清掃後の一回解放、元終端だけの保存。
 * @cleanup 代役資源しかない自己生成Fileを内容・Identity・非link確認後に削除する。
 * @boundary 実Worker終了・Host喪失回復・実AIは未確認。
 */
test("単独Hostは元試行の保存と排他終了を接続する", () => {
  const url = (value: string) => new URL(value, import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
    import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';
    import {mock} from 'node:test';import {registerHooks,syncBuiltinESMExports} from 'node:module';
    import cp from 'node:child_process';
    registerHooks({resolve(s,c,n){const r=n(s,c);if(r.url.includes('/coordinator/'))throw Error('coordinator_forbidden');return r;}});
    for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[name]=()=>{throw Error('external_process_forbidden');};
    syncBuiltinESMExports();
    const di=await import(${JSON.stringify(url("../../../docker-isolation/src/index.ts"))});
    const domain=await import(${JSON.stringify(url("../../../domain-model/src/index.ts"))});
    let fixture=null;
    mock.module(${JSON.stringify(url("../../../domain-model/src/index.ts"))},{namedExports:{...domain,
      writeCommittedJson:(d,n,k,v)=>{if(v.kind==='execution_settled')fixture.diagnosticWrites++;if(fixture?.failKind===v.kind)throw Error('synthetic_save_refusal');return domain.writeCommittedJson(d,n,k,v);},
      readCommittedJson:(file,key)=>{if(fixture?.mode==='read_after_write')throw Error('synthetic_read_refusal');return domain.readCommittedJson(file,key);}
    }});
    const purposes=['create_subscription_auth_probe','start_subscription_auth_probe_attached','create_internal_network','create_egress_network','create_proxy','connect_proxy_egress','create_provider','start_proxy','start_provider_attached'];
    mock.module(${JSON.stringify(url("../../../docker-isolation/src/index.ts"))},{namedExports:{...di,
      createDockerIsolationRuntime:({borrowPaths,inspectReceipts})=>{
        const f=fixture;let cleanupResult=null,owner=null,recovery=null;
        return {
          startCommand:()=>{throw Error('primitive_forbidden');},cleanupOwnedResources:()=>{throw Error('duplicate_cleanup');},
          startExecution:(p,r,m,hooks)=>{
            f.starts++;owner=m;recovery=r;assert.equal(f.live,true);
            assert.equal(borrowPaths(m).tmp,path.join(f.root,'tmp'));
            return di.startDockerCommandSessionCandidate(purposes,{
              startCommand:purpose=>({started:async()=>true,wait:async()=>{
                assert.equal(f.live,true);f.commands.push(purpose);
                if(purpose==='create_subscription_auth_probe'&&f.mode==='auth_wait_unknown')return null;
                if(purpose==='start_provider_attached'&&f.mode==='cancel'){f.waiting.resolve();await f.wait.promise;}
                const id=String(purposes.indexOf(purpose)+1).repeat(64);
                const invalid={receipt_invalid_short:id.slice(1)+'\\n',receipt_invalid_multiple:id+'\\n'+id+'\\n',receipt_invalid_embedded:id.slice(0,32)+'\\n'+id.slice(32),receipt_invalid_character:'g'.repeat(64)+'\\n',receipt_invalid_uppercase:'A'.repeat(64)+'\\n',receipt_invalid_empty:' \\r\\n'};
                const createOutput=f.mode in invalid?invalid[f.mode]:id+(f.mode==='receipt_bare'?'':f.mode==='receipt_crlf'?'\\r\\n':'\\n');
                return {status:0,signal:null,stderr:'',outputExceeded:false,stdout:
                  purpose.startsWith('create_')?createOutput:
                  purpose==='start_subscription_auth_probe_attached'?JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',forcedLoginMethod:'claudeai',subscriptionType:'max'}):
                  purpose==='start_provider_attached'?JSON.stringify({type:'result',subtype:'success',is_error:false,num_turns:1,total_cost_usd:0,structured_output:{status:true}})+'\\n':''};
              },terminateAndWait:async()=>{f.wait.resolve();return true;}}),
              cleanup:async()=>{
                assert.equal(f.live,true);const receipts=inspectReceipts(r);assert.ok(receipts);f.cleanup=true;
                const names={create_provider:f.plan.providerContainerName,create_proxy:f.plan.proxyContainerName,create_subscription_auth_probe:f.plan.authContainerName,create_internal_network:f.plan.internalNetworkName,create_egress_network:f.plan.egressNetworkName};
                f.resources=Object.entries(names).map(([purpose,plannedResourceName])=>({purpose,plannedResourceName,dockerId:receipts[purpose].dockerId,observation:receipts[purpose].submitted?'absent':'not_requested'}));
                const unknown=['cleanup_unknown','auth_wait_unknown'].includes(f.mode)||f.mode.startsWith('receipt_invalid_');cleanupResult={confirmed:!unknown,processTreeTerminated:true,containersAbsent:!unknown,networksAbsent:!unknown,resourceObservations:unknown?null:f.resources};return cleanupResult;
              },verifyCleanup:value=>value===cleanupResult?cleanupResult.resourceObservations:null
            },hooks);
          },
          verifyCleanupOutcome:(v,id,r,m)=>v===cleanupResult&&r===recovery&&m===owner?cleanupResult.resourceObservations:null
        };
      }
    }});
    const api=await import(${JSON.stringify(url("../../src/index.ts"))});
    const {prepareAttempt}=await import(${JSON.stringify(url("../../src/attempt/execute.ts"))});
    const preparationInput={prepare:prepareAttempt};
    const {createStandaloneProviderAttemptHost}=await import(${JSON.stringify(url("../../scripts/provider-attempt-host.ts"))});
    const repository=fileURLToPath(new URL('../../../',${JSON.stringify(url("../../scripts/provider-attempt-host.ts"))}));
    const parent=path.join(repository,'.crdd','tests');assert.equal(fs.lstatSync(parent).isSymbolicLink(),false);
    const root=fs.mkdtempSync(path.join(parent,'executor-host-contract-'));const identity=fs.statSync(root,{bigint:true});
    for(const mode of ['normal','receipt_bare','receipt_crlf','receipt_invalid_short','receipt_invalid_multiple','receipt_invalid_embedded','receipt_invalid_character','receipt_invalid_uppercase','receipt_invalid_empty','cancel','cleanup_unknown','auth_wait_unknown','lease_lost','release_false','release_throw','recovery_opened','read_after_write','provider_submission','absence_observed','terminal_received','execution_settled']){
      const invalidReceipt=mode.startsWith('receipt_invalid_');
      const directory=path.join(root,mode);fs.mkdirSync(directory);const authority={},mount={};
      const selection={provider:'claude',modelIdentifier:'opus',identifierKind:'alias',reasoningEffort:'low',purpose:'task',catalogIdentity:'a'.repeat(64),configIdentity:'b'.repeat(64),role:'executor',workType:null,source:'explicit'};
      const technicalSelection={provider:selection.provider,modelIdentifier:selection.modelIdentifier,identifierKind:selection.identifierKind,reasoningEffort:selection.reasoningEffort,purpose:selection.purpose};
      const built=preparationInput.prepare(
{randomBytes},
{ ...({purpose:'probe'}), target: {operationId:'OP-123456',workspaceSourcePath:path.join(directory,'work'),temporarySourcePath:path.join(directory,'tmp'),providerHomeSourcePath:'C:/synthetic-not-accessed/home',grantRef:'PHMGRANT-123456',provider:'claude',providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:'b'.repeat(64),localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64),activeMountCapability:mount}, selection: technicalSelection }
);
      assert.ok(built);const plan=Object.freeze({...built,authorityUseCapability:authority});
      const f={root:directory,plan,mode,failKind:mode,live:true,releaseCount:0,diagnosticWrites:0,starts:0,cleanup:false,commands:[],resources:null,waiting:Promise.withResolvers(),wait:Promise.withResolvers()};fixture=f;
      const host=createStandaloneProviderAttemptHost(directory,plan,{assertLive:()=>f.live,release:()=>{
        f.releaseCount++;assert.equal(f.cleanup||f.starts===0,true);if(mode==='release_throw')throw Error('synthetic_release');if(mode==='release_false')return false;f.live=false;return true;
      }});
      if(mode==='lease_lost')f.live=false;
      const started=host.start();
      if(mode==='lease_lost'||mode==='recovery_opened'||mode==='read_after_write'){
        assert.equal(started.status,'blocked');assert.equal(f.starts,0);assert.equal(f.releaseCount,mode==='lease_lost'?0:1);
        if(mode!=='lease_lost'){assert.equal(started.recoveryId,host.recoveryId);assert.equal(f.live,false);assert.equal(fs.existsSync(directory),true);}
        if(mode==='read_after_write')assert.equal(fs.readdirSync(directory).length,2);
      }else{
        assert.equal(started.status,'started',mode);
        if(mode==='cancel'){await f.waiting.promise;await host.runtime.cancel(started.controlCapability,host.management);}
        const result=await started.completion;
        const released=!invalidReceipt&&!['cleanup_unknown','auth_wait_unknown','release_false','release_throw'].includes(mode);
        const accepted=released&&mode!=='absence_observed';
        assert.equal(f.releaseCount,invalidReceipt||['cleanup_unknown','auth_wait_unknown'].includes(mode)?0:1,mode);assert.equal(f.live,!released,mode);
        const diagnostic=host.readDiagnostic();assert.ok(diagnostic);assert.equal(diagnostic.cleanupConfirmed,result.cleanupConfirmed);
        if(mode==='auth_wait_unknown'){assert.equal(diagnostic.primaryFailure.purpose,'create_subscription_auth_probe');assert.equal(diagnostic.primaryFailure.responseObserved,false);assert.equal(diagnostic.primaryFailure.receiptRecorded,false);assert.equal(diagnostic.primaryFailure.commandHandleObtained,true);}
        if(invalidReceipt){assert.equal(result.recoveryId,host.recoveryId);assert.equal(diagnostic.primaryFailure.stage,'resource_receipt_record');assert.equal(diagnostic.primaryFailure.reason,'docker_resource_receipt_unavailable');assert.equal(diagnostic.primaryFailure.responseObserved,true);assert.equal(diagnostic.primaryFailure.receiptRecorded,false);assert.deepEqual(f.commands,['create_subscription_auth_probe']);}
        const terminal=host.readTerminal();
        if(terminal)assert.equal(terminal.homeLeaseReleased,released,mode);
        if(mode==='terminal_received')assert.throws(()=>host.recordTerminal(result));else assert.equal(host.recordTerminal(result),accepted,mode);
        assert.equal(host.recordTerminal(result),false);
        assert.equal(host.recordTerminal({...result}),false);
        assert.equal((await host.runtime.cancel(started.controlCapability,{})).status,'blocked');
        if(['normal','receipt_bare','receipt_crlf'].includes(mode))assert.equal(result.status,'completed');if(mode==='cancel')assert.equal(result.status,'cancelled');
        if(!released)assert.equal(result.manualRecoveryRequired,true);
      }
      const records=fs.readdirSync(directory).filter(n=>!n.endsWith('.crdd-commit.json')).map(n=>JSON.parse(fs.readFileSync(path.join(directory,n),'utf8')));
      if(f.starts){assert.equal(records[0].kind,'recovery_opened');assert.equal(records[1].kind,'recovery_handoff');}
      for(const value of records){assert.equal(value.recoveryId,host.recoveryId);assert.equal(value.operationId,plan.operationId);assert.equal(value.provider,'claude');for(const key of ['providerHomeSourcePath','providerHomeIdentityHash','providerHomeProtectionHash','localUserBindingHash','stableLogicalHomeBindingHash','normalizedResult'])assert.equal(Object.hasOwn(value,key),false);}
      if(mode==='normal'){const kinds=records.map(v=>v.kind);assert.ok(kinds.indexOf('home_released')<kinds.indexOf('absence_observed'));assert.ok(kinds.indexOf('absence_observed')<kinds.indexOf('recovery_closed'));assert.equal(kinds.at(-1),'terminal_received');}
      for(const value of records.filter(v=>v.kind==='submission_planned')){assert.equal(value.plannedResourceName,({create_provider:plan.providerContainerName,create_proxy:plan.proxyContainerName,create_subscription_auth_probe:plan.authContainerName,create_internal_network:plan.internalNetworkName,create_egress_network:plan.egressNetworkName})[value.purpose]);assert.equal(value.ownershipLabel,plan.ownershipLabel);}
      for(const value of records.filter(v=>v.kind==='receipt_recorded')){assert.match(value.dockerId,/^[a-f0-9]{64}$/);assert.equal(value.dockerId.length,64);}
      if(['normal','receipt_bare','receipt_crlf'].includes(mode))assert.equal(records.filter(v=>v.kind==='receipt_recorded').length,5);
      if(invalidReceipt)assert.equal(records.some(v=>v.kind==='receipt_recorded'),false);
      if(invalidReceipt||['cleanup_unknown','auth_wait_unknown','absence_observed','release_false','release_throw'].includes(mode)){assert.equal(records.some(v=>v.kind==='execution_settled'),false);assert.equal(f.diagnosticWrites,0);}
      if(mode==='execution_settled'){assert.ok(host.readDiagnostic());assert.equal(records.some(v=>v.kind==='execution_settled'),false);}
      // All resources are synthetic: this is not cleanup of an unknown OS lease.
      for(const name of fs.readdirSync(directory)){assert.match(name,/^event-[0-9]{3}\\.json(?:\\.crdd-commit\\.json)?$/);const stat=fs.lstatSync(path.join(directory,name));assert.equal(stat.isFile(),true);assert.equal(stat.isSymbolicLink(),false);assert.equal(stat.nlink,1);}
      fs.rmSync(directory,{recursive:true});assert.equal(fs.existsSync(directory),false);
    }
    assert.equal(fs.lstatSync(root).isSymbolicLink(),false);assert.equal(fs.statSync(root,{bigint:true}).ino,identity.ino);fs.rmdirSync(root);assert.equal(fs.existsSync(root),false);
  `,
    ],
    { encoding: "utf8", timeout: 40_000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});
