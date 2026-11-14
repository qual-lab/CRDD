/**
 * 公開Executorと共通DIを通る単独Hostの保存・排他終了を検証する。
 * @responsibility 外部操作の端だけを有限化し、Intent・Receipt・終端の順序を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @boundary 実Docker・実AI・Native・過去保持物は使用しない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

/** 製品入口の正常・取消・保存拒否・観測不明を同じ有限DIで反証する。 @trace ERB-IT-004 */
test("単独Hostは公開Executorで実行し必要な保存とHome終了を接続する", () => {
  const url = (value: string) => new URL(value, import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
    import {fileURLToPath} from 'node:url';import {mock} from 'node:test';
    const {createIsolationFixture}=await import(${JSON.stringify(url("../../../docker-isolation/tests/support/isolation.ts"))});
    const f=await createIsolationFixture({mock});
    const di=await import(${JSON.stringify(url("../../../docker-isolation/src/index.ts"))});
    const {captureIsolationRequest}=await import(${JSON.stringify(url("../../../docker-isolation/src/execution/preparation.ts"))});
    const platform=await import(${JSON.stringify(url("../../../executor/scripts/provider-home.ts"))});
    const domain=await import(${JSON.stringify(url("../../../execution-model/src/index.ts"))});
    const report=await import(${JSON.stringify(url("../../../executor/scripts/report.ts"))});
    let mode='normal',live=false,releases=0,observations=0,failKind=null,activeHost=null,activeStarted=null,cancelPromise=null;
    mock.module(${JSON.stringify(url("../../../docker-isolation/src/index.ts"))},{namedExports:{...di,
      prepareIsolation:(request,settings)=>{f.useRequest(captureIsolationRequest(request),'claude');return f.api.prepareIsolation(request,settings);},
      executeIsolation:f.api.executeIsolation,
    }});
    mock.module(${JSON.stringify(url("../../../executor/scripts/provider-home.ts"))},{namedExports:{...platform,

      observeProviderHome:provider=>{assert.equal(live,true);observations++;if(mode==='lease_lost_observation')live=false;return {status:mode==='home_unavailable'?'blocked':'candidate',provider,processEffectIssued:false,filesystemEffectIssued:false,providerHomeIdentityHash:(mode==='home_changed'?'e':'a').repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64)};},
    }});
    mock.module(${JSON.stringify(new URL("../../../lock/src/index.ts", import.meta.url).href)}, {namedExports:{...await import(${JSON.stringify(new URL("../../../lock/src/index.ts", import.meta.url).href)}), acquireLock:()=>{if(mode==='lock_denied')return {status:'blocked',reason:'lock_exists',reference:null,cleanupConfirmed:true,descriptorClosed:true};live=true;return {status:'acquired',lock:{assertLive:()=>{if(mode==='lease_assert_throw')throw Error('synthetic');return live;},release:()=>{releases++;if(mode==='release_throw')throw Error('synthetic');if(mode==='release_false'||!live)return false;live=false;return true;}}};}}});
    mock.module(${JSON.stringify(url("../../../executor/scripts/report.ts"))},{namedExports:{...report,
      writeReport:(d,n,k,v)=>{if(v.kind===failKind)throw Error('synthetic_save_refusal');if(v.kind==='provider_submission'&&mode==='lease_lost_provider')live=false;if(v.kind==='execution_settled'&&mode==='cancel_diagnostic')cancelPromise=activeHost.runtime.cancel({controlCapability:activeStarted.controlCapability,managementCapability:activeHost.management});if(v.kind==='provider_submission'&&mode==='cancel_notice')queueMicrotask(()=>{cancelPromise=activeHost.runtime.cancel({controlCapability:activeStarted.controlCapability,managementCapability:activeHost.management});});return report.writeReport(d,n,k,v);},
      readReport:(...args)=>{if(mode==='read_after_write')throw Error('synthetic_read_refusal');return report.readReport(...args);}
    }});
    const {createStandaloneProviderAttemptHost}=await import(${JSON.stringify(url("../../scripts/provider-attempt-host.ts"))});
    const repository=fileURLToPath(new URL('../../../',${JSON.stringify(url("../../scripts/provider-attempt-host.ts"))}));
    const parent=path.join(repository,'.crdd','tests');
    for(mode of ['normal','receipt_crlf','receipt_bare','receipt_invalid_short','receipt_invalid_multiple','receipt_invalid_embedded','receipt_invalid_character','receipt_invalid_uppercase','receipt_invalid_empty','cancel','process_unknown','cleanup_unknown','home_changed','home_unavailable','lock_denied','release_false','release_throw','lease_lost_observation','lease_lost_provider','lease_assert_throw','cancel_notice','cancel_diagnostic','recovery_opened','read_after_write','submission_planned','receipt_recorded','provider_submission','absence_observed','terminal_received','execution_settled']){
      live=false;releases=0;observations=0;failKind=mode;cancelPromise=null;f.calls.length=0;f.processTermination=true;f.pendingRun=false;
      const root=fs.mkdtempSync(path.join(parent,'executor-host-contract-'));
      const identity=fs.statSync(root,{bigint:true});
      const request={kind:'attempt',purpose:'probe',target:{operationId:'OP-123456',grantRef:'PHMGRANT-123456',provider:'claude',workspaceSourcePath:path.join(root,'work'),temporarySourcePath:path.join(root,'tmp'),providerHomeSourcePath:'C:\\\\fixture\\\\home',providerHomeIdentityHash:'a'.repeat(64),stableLogicalHomeBindingHash:'d'.repeat(64),activeMountCapability:{}},selection:{provider:'claude',modelIdentifier:'opus',identifierKind:'alias',reasoningEffort:'low',purpose:'task'}};
      const waiting=Promise.withResolvers();let cancelRelease=null,gateUsed=false;
      f.waitGate=async argv=>{if(!gateUsed&&argv[0]==='start'&&argv.includes('--attach')&&argv.at(-1)===String(f.request.resources.findIndex(r=>r.key==='create_provider')+1).repeat(64)&&['cancel','process_unknown'].includes(mode)){gateUsed=true;waiting.resolve();await new Promise(resolve=>cancelRelease=resolve);}};
      f.terminationFilter=argv=>!(mode==='process_unknown'&&argv[0]==='start'&&argv.at(-1)==='2'.repeat(64));
      f.observationFilter=(argv,result)=>{
        if(argv[0]==='create'&&mode.startsWith('receipt_invalid_'))return {...result,stdout:({receipt_invalid_short:'a'.repeat(63),receipt_invalid_multiple:'a'.repeat(64)+'\\n'+'b'.repeat(64),receipt_invalid_embedded:'a'.repeat(32)+'\\n'+'b'.repeat(32),receipt_invalid_character:'g'.repeat(64),receipt_invalid_uppercase:'A'.repeat(64),receipt_invalid_empty:' \\r\\n'})[mode]};
        if((argv[0]==='create'||argv[0]==='network'&&argv[1]==='create')&&mode==='receipt_crlf')return {...result,stdout:result.stdout+'\\r\\n'};
        if(!gateUsed&&argv[0]==='start'&&argv.includes('--attach')&&argv.at(-1)===String(f.request.resources.findIndex(r=>r.key==='create_provider')+1).repeat(64))return {...result,stdout:JSON.stringify({type:'result',subtype:'success',is_error:false,num_turns:1,total_cost_usd:0,structured_output:{status:true}})+'\\n'};
        if(argv.includes('inspect')&&mode==='cleanup_unknown')return null;
        return result;
      };
      const host=createStandaloneProviderAttemptHost(root,request);activeHost=host;
      for(const name of ['work','tmp','management'])fs.mkdirSync(path.join(root,name));
      let result=null,started=null;
      if(['recovery_opened','read_after_write'].includes(mode)){assert.throws(()=>host.start());assert.equal(releases,0);assert.equal(f.calls.length,0);}
      else{
        started=host.start();activeStarted=started;
        if(mode==='lock_denied'){assert.equal(started.status,'blocked');assert.equal(observations,0);assert.equal(releases,0);}
        else{
          assert.equal(started.status,'started',mode);
          if(['cancel','process_unknown'].includes(mode)){
            await waiting.promise;if(mode==='process_unknown')f.processTermination=false;
            const cancelling=host.runtime.cancel({controlCapability:started.controlCapability,managementCapability:host.management});
            cancelRelease();await cancelling;
          }
          result=await started.completion;if(cancelPromise)await cancelPromise;
          if(mode==='terminal_received')assert.throws(()=>host.recordTerminal(result));
          else{
            const expected=mode.startsWith('receipt_invalid_')||['normal','receipt_crlf','receipt_bare','cancel','cancel_notice','cancel_diagnostic','provider_submission','execution_settled'].includes(mode);
            assert.equal(host.recordTerminal(result),expected,mode+':'+JSON.stringify(result));
          }
          assert.equal(host.recordTerminal({...result}),false);assert.equal(host.recordTerminal(result),false);
          if(['normal','receipt_crlf','receipt_bare'].includes(mode))assert.equal(result.status,'completed',mode);
          if(mode==='cancel'||mode==='cancel_notice'||mode==='cancel_diagnostic')assert.equal(result.status,'cancelled');
          if(['home_changed','home_unavailable','submission_planned','lease_lost_observation','lease_assert_throw'].includes(mode))assert.equal(f.calls.some(a=>a[0]==='create'||a[0]==='network'&&a[1]==='create'),false,mode);
          if(mode==='cancel_diagnostic'){assert.equal(result.cancellationRequested,true);assert.equal(result.normalizedResult,null);assert.equal(result.resultSha256,null);assert.equal(result.resultBytes,0);}
          if(mode==='lease_lost_provider'||mode==='cancel_notice')assert.equal(f.calls.some(a=>a[0]==='start'&&a.at(-1)==='2'.repeat(64)),false,mode);
          if(['process_unknown','cleanup_unknown'].includes(mode)){assert.equal(result.cleanupConfirmed,false);assert.equal(host.releaseConfirmed,false);}
          if(['release_false','release_throw','lease_lost_observation','lease_lost_provider'].includes(mode)){assert.equal(host.releaseConfirmed,false);assert.equal(releases,1);}
        }
      }
      const records=fs.readdirSync(root).filter(n=>/^event-[0-9]{3}\\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8')));
      for(const record of records){assert.equal(record.recoveryId,host.recoveryId);assert.equal(record.operationId,request.target.operationId);for(const key of ['stdout','stderr','normalizedResult','providerHomeSourcePath'])assert.equal(Object.hasOwn(record,key),false);}
      if(['normal','receipt_crlf','receipt_bare'].includes(mode)){assert.equal(records.filter(r=>r.kind==='receipt_recorded').length,5);const kinds=records.map(r=>r.kind);assert.ok(kinds.indexOf('home_released')<kinds.indexOf('absence_observed'));assert.ok(kinds.indexOf('absence_observed')<kinds.indexOf('recovery_closed'));assert.equal(kinds.at(-1),'terminal_received');}
      if(mode.startsWith('receipt_invalid_')){const receipts=records.filter(r=>r.kind==='receipt_recorded');assert.ok(receipts.length>0);assert.ok(receipts.every(r=>r.resources.checkpoints.every(c=>c.receiptSource!=='docker_create_result')));}
      assert.equal(fs.lstatSync(root).isSymbolicLink(),false);assert.equal(fs.statSync(root,{bigint:true}).ino,identity.ino);
      for(const name of fs.readdirSync(root)){const entry=path.join(root,name),stat=fs.lstatSync(entry);assert.equal(stat.isSymbolicLink(),false);if(stat.isDirectory())assert.equal(fs.readdirSync(entry).length,0);else{assert.equal(stat.nlink,1);assert.match(name,/^event-[0-9]{3}\\.json(?:\\.crdd-commit\\.json)?$/);}}
      fs.rmSync(root,{recursive:true});assert.equal(fs.existsSync(root),false);
    }
  `,
    ],
    { encoding: "utf8", timeout: 55_000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});
