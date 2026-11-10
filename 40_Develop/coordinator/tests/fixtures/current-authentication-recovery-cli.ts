/**
 * 通常・認証unknownの回収CLI本文と、全子本文の固定Process境界を組み立てる。
 * @responsibility 実Dockerへ進まない既定拒否と合成応答を、実Root・Owner・DI・Writer・Host・履歴へ接続する。
 * @trace ERB-IT-014
 * @precondition 呼出し元が自己生成Repositoryとexact回復IDを渡し、認証再起動形では完了checkpointも準備する。
 * @stimulus 保存済み不存在、または五資源中authだけunknownの状態へ実bin入口を実行する。
 * @observation 通常async四応答、認証async五応答と同期四読取り・二回不存在・専用保存一回、一次失敗の保全。
 * @oracle 模擬観測だけを専用実Writerへ渡し、一般Writerや最終結果だけで代替しない。
 * @cleanup 全spyをfinallyで復元し、実CLIが対象Host・短命configを回収する。親が試験Rootを所有する。
 * @boundary 実Daemon再起動・遅延create無害化・汎用unknown終了は対象外。
 */
/** 全子本文で未知要求を拒否し、固定Native読取りと検証済みNode子だけを許可する。
 * @trace ERB-IT-014
 */
export const hostFixtureProcessBoundarySource = `
  const boundaryCp=(await import('node:child_process')).default;
  const {syncBuiltinESMExports:boundarySync}=await import('node:module');
  const boundaryOriginal=Object.fromEntries(['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'].map(key=>[key,boundaryCp[key]]));
  const boundaryRoot=process.cwd();
  const boundaryNative=${JSON.stringify(new URL("../../../../template/tools/coordinator/windows-x64/crdd-platform-access.exe", import.meta.url).pathname.replace(/^\//u, "").replaceAll("/", "\\"))};
  const boundaryViolations=[];
  function boundaryReject(){boundaryViolations.push('unexpected_process_request');throw new Error('host_fixture_process_denied');}
  for(const key of Object.keys(boundaryOriginal))boundaryCp[key]=boundaryReject;
  boundaryCp.spawnSync=function(executable,argv,options){
    try{
    if(executable===boundaryNative){
      assert.equal(argv.length,1);assert.equal(argv[0],'--system-windows-directory');
      assert.deepEqual({...options,cwd:path.resolve(options.cwd)},{env:{},cwd:path.resolve(path.dirname(boundaryNative),'../../../..'),shell:false,windowsHide:true,timeout:5000,maxBuffer:65548,encoding:'buffer'});
      return boundaryOriginal.spawnSync(executable,argv,options);
    }
    return boundaryReject();
    }catch{boundaryViolations.push('invalid_sync_request');throw new Error('host_fixture_process_denied');}
  };
  boundarySync();
  async function launchHostFixture(argv,input,timeout){
    try{
    assert.ok([60000,120000].includes(timeout));
    assert.equal(argv[0],argv.length===3?'--experimental-test-module-mocks':'-');
    if(argv.length===3){
      assert.equal(argv[1],'-');
      const cliSources=await import(${JSON.stringify(import.meta.url)});
      assert.ok([cliSources.currentRecoveryCliSource,cliSources.currentAuthenticationRecoveryCliSource].includes(input));
    }else{
      assert.equal(argv.length,5);assert.ok(['recover_cleanup','recover_history','recover_delivery'].includes(argv[2]));
      const own=await import(${JSON.stringify(new URL("./current-host-transition-worker.ts", import.meta.url).href)});
      assert.equal(input,own.currentHostTransitionWorkerSource);
    }
    const id=argv[argv.length===3?2:1];
    const state=JSON.parse(fs.readFileSync(path.join(boundaryRoot,'.crdd','domain-model','state.json')));
    const target=state.operations.find(operation=>operation.recoveryId===id);assert.ok(target);
    if(argv.length===5)assert.deepEqual(JSON.parse(argv[4]),target.resources);
    return boundaryOriginal.spawnSync(process.execPath,argv,{input,cwd:boundaryRoot,encoding:'utf8',timeout,windowsHide:true});
    }catch{throw new Error('host_fixture_child_rejected');}
  }
  function restoreHostFixtureProcesses(){Object.assign(boundaryCp,boundaryOriginal);boundarySync();assert.deepEqual(boundaryViolations,[]);}
`;

/** 認証unknownの合成観測から、専用実Writer・通常CLI・終了までを接続する。
 * @trace ERB-IT-014
 */
export const currentAuthenticationRecoveryCliSource = `(async () => {
  const assert = (await import('node:assert/strict')).default;
  const fs = (await import('node:fs')).default;
  const path = (await import('node:path')).default;
  ${hostFixtureProcessBoundarySource}
  try {
  const cp = (await import('node:child_process')).default;
  const {syncBuiltinESMExports} = await import('node:module');
  const {PassThrough} = await import('node:stream');
  const {mock} = await import('node:test');
  const {fileURLToPath} = await import('node:url');
  const id = process.argv[2];
  const cliUrl = ${JSON.stringify(new URL("../../bin/coordinator.ts", import.meta.url).href)};
  const cli = fileURLToPath(cliUrl);
  const statePath = path.join(process.cwd(),'.crdd',"domain-model",'state.json');
  const initialBytes = fs.readFileSync(statePath), initial = JSON.parse(initialBytes);
  const target = initial.operations.find(item => item.recoveryId === id);
  assert.ok(target && target.kind === 'docker_task');
  const identity = JSON.parse(target.identityJson);
  assert.deepEqual(target.resources.snapshot.resources.map(r=>r.key).sort(),['create_egress_network','create_internal_network','create_provider','create_proxy','create_subscription_auth_probe']);
          for(const resource of target.resources.snapshot.resources){
            const auth=resource.key==='create_subscription_auth_probe';
            assert.equal(resource.request,auth?'unknown':'not_issued');
            assert.equal(resource.identity.dockerId,null);
            const checkpoint=target.resources.checkpoints.find(c=>c.key===resource.key);
            assert.equal(checkpoint.submission,auth?'intent_saved':'none');
            assert.equal(checkpoint.receiptSource,null);assert.equal(checkpoint.observation,'unobserved');assert.equal(checkpoint.absenceEvidenceSha256,null);
          }
  const authResource=target.resources.snapshot.resources.find(item=>item.key==='create_subscription_auth_probe');assert.ok(authResource);
  assert.equal(authResource.identity.dockerId,null);
  assert.equal(target.resources.checkpoints.find(c=>c.key===authResource.key).submission,'intent_saved');
  assert.ok(target.resources.checkpoints.every(c=>c.receiptSource===null && c.observation==='unobserved' && c.absenceEvidenceSha256===null));
  assert.deepEqual(target.execution,{externalSend:'not_issued',ownerEffect:'disabled',providerStart:'not_started',sharedWrite:'not_issued',workspaceReusable:false});
  assert.equal(identity.consumer,'coordinator_cli');
  assert.equal(target.dockerRestart.request,'confirmed'); assert.equal(target.dockerRestart.cleanup,'confirmed');
  assert.deepEqual(target.dockerRestart.result,{status:'completed',reason:'docker_restart_settled',request:'confirmed',effectOutcomeUnknown:false});
  const dockerExe = 'C:\\\\Program Files\\\\Docker\\\\Docker\\\\resources\\\\bin\\\\docker.exe';
  const nativeExe = path.resolve(path.dirname(cli),'../../../template/tools/coordinator/windows-x64/crdd-platform-access.exe');
  const nativeModes = ['--system-windows-directory'];
  const list = ['container','ls','--all','--no-trunc','--filter','name=^/'+authResource.identity.name+'$'];
  const name = [...list,'--format','{{.ID}}'];
  const labelled = [...list,'--filter','label='+identity.ownershipLabel,'--format','{{.ID}}'];
  const commands = [name,labelled,name,labelled];
  const asyncCommands = [['version','--format','{{.Server.Os}}'],name,labelled,['container','inspect',authResource.identity.name],['container','ls','--all','--no-trunc','--filter','label='+identity.ownershipLabel,'--format','{{.ID}}']];
  let calls = 0, trustCalls = 0, violations = 0, restartCalls = 0, removalCalls = 0;
  const failureSites=[];
  let asyncCalls = 0, asyncConfig = null, asyncConfigIdentity = null;
  let factories = 0, discoveries = 0, rounds = 0, saves = 0;
  let config = null, configIdentity = null;
  let recoveryMock, restartMock, storeMock, lifecycleMock, executorMock;
  let technicalObservation=null;
  const checkpointResults=[];
  const originalSpawn = cp.spawnSync;
  const originalAsyncSpawn = cp.spawn;
  const syntheticChildren = [];
  try {
    const classify = function(channel,executable,argv,options) {
      try {
        if(executable === nativeExe) {
          assert.equal(channel,'sync');
          assert.equal(argv.length,1); assert.ok(nativeModes.includes(argv[0]));
          assert.deepEqual({...options,cwd:path.resolve(options.cwd)},{env:{},cwd:path.resolve(path.dirname(nativeExe),'../../../..'),shell:false,windowsHide:true,timeout:5000,maxBuffer:65548,encoding:'buffer'});
          return originalSpawn(executable,argv,options);
        }
        let stdout = '', stderr = '', status = 0;
        const powershell = path.win32.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
        if(executable.toLowerCase() === powershell.toLowerCase()) {
          assert.equal(channel,'sync');
          assert.ok(trustCalls++ < 2);
          const script = ["$ErrorActionPreference='Stop'", "$signature=Get-AuthenticodeSignature -LiteralPath '"+dockerExe+"'", "$certificate=$signature.SignerCertificate", "if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=Docker Inc(?:,|$)')){exit 2}", "Write-Output 'CRDD_DOCKER_AUTHENTICODE_OK'"].join(';');
          assert.deepEqual(argv,['-NoLogo','-NoProfile','-NonInteractive','-Command',script]);
          stdout = 'CRDD_DOCKER_AUTHENTICODE_OK\\r\\n';
        } else {
          assert.equal(executable,dockerExe);
          assert.deepEqual(argv.slice(0,3),['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config']);
          assert.equal(options.shell,false); assert.equal(options.windowsHide,true);
          if(argv[5] === 'rm') removalCalls++;
          const asynchronous = channel === 'async';
          if(!asynchronous) assert.equal(options.stdio,undefined);
          assert.deepEqual(argv.slice(4),asynchronous?asyncCommands[asyncCalls]:commands[calls]);
          const directory = argv[3];
          const relative=path.relative(identity.hostPaths.root,directory);
          assert.ok(relative && !path.isAbsolute(relative) && relative!=='..' && !relative.startsWith('..'+path.sep));
          const info = fs.lstatSync(directory,{bigint:true});
          assert.ok(info.isDirectory() && !info.isSymbolicLink());
          const physical = [info.dev,info.ino,info.birthtimeNs].join(':');
          assert.deepEqual(fs.readdirSync(directory),[]);
          assert.equal(saves,0);
          if(asynchronous) {
            assert.deepEqual(options.stdio,['ignore','pipe','pipe']);
            assert.equal(options.cwd,path.win32.join(process.env.SystemRoot,'System32'));
            assert.equal(options.timeout,undefined); assert.equal(options.maxBuffer,undefined);
            for(const key of ['DOCKER_HOST','DOCKER_CONTEXT']) assert.equal(options.env[key],undefined);
            for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY']) assert.equal(options.env[key],'');
            assert.equal(path.basename(directory),'docker-cli-config');
            if(asyncConfig === null){asyncConfig=directory;asyncConfigIdentity=physical;}
            assert.equal(directory,asyncConfig);assert.equal(physical,asyncConfigIdentity);
            if(asyncCalls===0) stdout='linux\\n';
            if(asyncCalls===3){status=1;stderr='Error response from daemon: No such container: '+authResource.identity.name+'\\n';}
            asyncCalls++;
          } else {
            assert.equal(options.timeout,10000); assert.equal(options.maxBuffer,1048576);
            assert.ok(path.basename(directory).startsWith('docker-recovery-config-'));
            if(config === null){config=directory;configIdentity=physical;}
            assert.equal(directory,config);assert.equal(physical,configIdentity);
            calls++;
          }
        }
        return {pid:1,status,signal:null,stdout,stderr,output:[null,stdout,stderr]};
      } catch(error) { violations++;const failure={channel,index:channel==='async'?asyncCalls:calls,site:/stdin.?:([0-9]+):([0-9]+)/u.exec(error.stack??'')?.slice(1)??null};failureSites.push(failure);throw new Error('host_fixture_classifier_rejected:'+JSON.stringify(failure)); }
    };
    cp.spawnSync = function(executable,argv,options) { return classify('sync',executable,argv,options); };
    cp.spawn = function(executable,argv,options) {
      const reply = classify('async',executable,argv,options);
      const child = Object.assign(new cp.ChildProcess(),{pid:1234,stdin:null,stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>{throw new Error('fixture_termination_forbidden');}});
      const item = {child,spawn:0,exit:0,close:0,done:null};
      item.done = new Promise(resolve=>child.once('close',resolve));
      syntheticChildren.push(item);
      queueMicrotask(()=>{item.spawn++;child.emit('spawn');child.stdout.end(reply.stdout);child.stderr.end(reply.stderr);setImmediate(()=>{child.exitCode=reply.status;child.signalCode=reply.signal;item.exit++;child.emit('exit',reply.status,reply.signal);item.close++;child.emit('close',reply.status,reply.signal);});});
      return child;
    };
    syncBuiltinESMExports();
    const restartUrl = ${JSON.stringify(new URL("../../../docker-isolation/src/docker-desktop/restart.ts", import.meta.url).href)};
    const restartOperations = await import(restartUrl);
    restartMock = mock.module(restartUrl,{namedExports:{...restartOperations,
      restartDesktop: () => { restartCalls++; throw new Error('unexpected_restart'); },
    }});
    const recoveryUrl = ${JSON.stringify(new URL("../../../docker-isolation/src/cleanup/execute.ts", import.meta.url).href)};
    const recoveryOperations = await import(recoveryUrl);
    recoveryMock = mock.module(recoveryUrl,{namedExports:{...recoveryOperations,
      createTrustedDockerRecoveryExecutor: (settings,input) => {
        assert.equal(++factories,1);
        const created = recoveryOperations.createTrustedDockerRecoveryExecutor(settings,input);
        assert.equal(created.status,'ready');
        return {...created,executor:{...created.executor,
          discoverSubmitted: (expectation) => {
            assert.deepEqual(expectation,{kind:'container',expectedName:authResource.identity.name,ownershipLabel:identity.ownershipLabel});
            const found = created.executor.discoverSubmitted(expectation);
            assert.equal(found,null); discoveries++; throw new Error('unexpected_discovery_after_absence');
          },
          observeAbsent: (...args) => {
            assert.deepEqual(args,['container',authResource.identity.name,identity.ownershipLabel]);
            assert.equal(calls,rounds*2); assert.equal(saves,0);
            const absent = created.executor.observeAbsent(...args);
            assert.equal(absent,true); rounds++; assert.ok(rounds <= 2); return absent;
          },
          recoverObserved: () => { removalCalls++; throw new Error('unexpected_resource_removal'); },
        }};
      },
    }});
    const executorUrl=${JSON.stringify(new URL("../../../executor/src/index.ts", import.meta.url).href)};
    const executor=await import(executorUrl);
    executorMock=mock.module(executorUrl,{namedExports:{...executor,cleanupResources:(...args)=>{
      technicalObservation={stage:'constructing'};
      let execution;
      try{execution=executor.cleanupResources(...args);}catch(error){technicalObservation={stage:'construction_failed',site:/[.]ts:([0-9]+):([0-9]+)/u.exec(error.stack??'')?.slice(1)??null};throw new Error('fixture_cleanup_construction_failed');}
      technicalObservation={stage:'pending'};
      void execution.completion.then(value=>{
        const keys=new Set(target.resources.snapshot.resources.map(resource=>resource.key));
        const observations=value.cleanup.observations;
        if(keys.size!==5||!Array.isArray(observations)||new Set(observations.map(item=>item.key)).size!==observations.length||observations.some(item=>!keys.has(item.key)||!['not_requested','absent','unknown'].includes(item.observation)))throw new Error('fixture_observer_invalid');
        technicalObservation={stage:'completed',failureReason:value.failure?.reason??null,notification:value.failure?.notification??null,processTerminationConfirmed:value.processTerminationConfirmed,cleanupConfirmed:value.cleanup.confirmed,configCleanupConfirmed:value.cleanup.configCleanupConfirmed,observations:observations.map(({key,observation})=>({key,observation}))};
      },()=>{technicalObservation={stage:'completion_rejected'};}).catch(()=>{technicalObservation={stage:'observer_failed'};});
      return execution;
    }}});
    const storeUrl = ${JSON.stringify(new URL("../../../domain-model/src/index.ts", import.meta.url).href)};
    const store = await import(storeUrl);
    const model = await import(${JSON.stringify(new URL("../../../domain-model/src/index.ts", import.meta.url).href)});
    storeMock = mock.module(storeUrl,{namedExports:{...store,
      writeRuntimeOwnedCoordinatorRecoveryCheckpoint:(...args)=>{
        const value=store.writeRuntimeOwnedCoordinatorRecoveryCheckpoint(...args);
        checkpointResults.push({kind:args[3],status:value.status,reason:value.reason??null,confirmed:value.snapshotConfirmed,released:value.lockReleased});
        return value;
      },
      writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure: (...args) => {
        assert.equal(++saves,1); assert.equal(args[1],id); assert.equal(discoveries,0); assert.equal(rounds,2); assert.equal(calls,commands.length);
        assert.deepEqual(args[3],[{round:1,name:'absent',name_label:'absent'},{round:2,name:'absent',name_label:'absent'}]);
        assert.deepEqual(fs.readFileSync(statePath),args[2]);
        const before = JSON.parse(args[2]), operation = before.operations.find(item => item.recoveryId === id);
        assert.deepEqual({...operation,resources:target.resources},target);
        const candidate = model.prepareCoordinatorAuthenticationUnknownClosureSnapshot(args[2],id,args[3],initial.repositoryBinding); assert.ok(candidate);
        const result = store.writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(...args);
        assert.equal(result.status,'completed'); assert.equal(result.snapshotConfirmed,true); assert.equal(result.lockReleased,true);
        assert.deepEqual(fs.readFileSync(statePath),candidate);
        const read = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
        assert.equal(read.status,'completed'); assert.equal(read.lockReleased,true);
        assert.deepEqual(read.value.snapshot,JSON.parse(candidate));
        const saved = JSON.parse(candidate), closed = saved.operations.find(item => item.recoveryId === id);
        assert.deepEqual({...closed,resources:operation.resources},operation);
        assert.deepEqual(saved.operations.filter(item => item.recoveryId !== id),initial.operations.filter(item => item.recoveryId !== id));
        const auth=closed.resources.snapshot.resources.find(item=>item.key==='create_subscription_auth_probe');
        assert.equal(auth.request,'unknown');
        const checkpoint=closed.resources.checkpoints.find(item=>item.key===auth.key);
        assert.equal(auth.request,authResource.request);assert.equal(auth.identity.dockerId,null);
        assert.equal(checkpoint.submission,'intent_saved');assert.equal(checkpoint.receiptSource,null);assert.equal(checkpoint.observation,'absent');
        assert.match(checkpoint.absenceEvidenceSha256,/^[a-f0-9]{64}$/);
        assert.deepEqual(closed.resources.snapshot,operation.resources.snapshot);
        assert.deepEqual(closed.resources.checkpoints.filter(item=>item.key!==auth.key),target.resources.checkpoints.filter(item=>item.key!==auth.key));
        return result;
      },
    }});
    const lifecycle = await import(${JSON.stringify(new URL("../../src/execution/recovery.ts?auth-unknown-cli-fixture", import.meta.url).href)});
    lifecycleMock = mock.module(${JSON.stringify(new URL("../../src/execution/recovery.ts", import.meta.url).href)},{namedExports:{...lifecycle}});
    const vc = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
    const verified = vc.getRepository(process.cwd()); assert.equal(verified.status,'completed'); assert.ok(verified.capability);
    const read = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
    assert.equal(read.status,'completed'); assert.equal(read.lockReleased,true); assert.deepEqual(read.value.snapshot,initial);
    process.argv = [process.execPath,cli,'recovery','resume',id,'--json'];
    await import(cliUrl);
    assert.equal(process.exitCode,0,JSON.stringify({factories,discoveries,rounds,saves,calls,asyncCalls,trustCalls,violations,failureSites,technicalObservation,checkpointResults,children:syntheticChildren.map(item=>[item.spawn,item.exit,item.close])}));
    assert.equal(violations,0); assert.equal(restartCalls,0); assert.equal(removalCalls,0);
    assert.equal(factories,1); assert.equal(discoveries,0); assert.equal(rounds,2); assert.equal(saves,1); assert.equal(calls,commands.length); assert.equal(asyncCalls,asyncCommands.length); assert.equal(trustCalls,2);
    assert.equal(checkpointResults.filter(value=>value.kind==='cleanup').length,0);
    assert.ok(config); assert.throws(() => fs.lstatSync(config),{code:'ENOENT'});
    assert.ok(asyncConfig); assert.throws(() => fs.lstatSync(asyncConfig),{code:'ENOENT'});
    for(const file of [identity.hostPaths.root,identity.hostPaths.marker,...['state.pending.json','state.lock','history.pending.jsonl'].map(file => path.join(path.dirname(statePath),file))]) assert.throws(() => fs.lstatSync(file),{code:'ENOENT'});
    const final = JSON.parse(fs.readFileSync(statePath));
    assert.equal(final.operations.some(item => item.recoveryId === id),false);
    assert.deepEqual(final.operations,initial.operations.filter(item => item.recoveryId !== id));
    const rows = fs.readFileSync(path.join(path.dirname(statePath),'history.jsonl'),'utf8').trim().split('\\n').map(line => JSON.parse(line));
    const history = rows.filter(row => row.summary.recoveryId === id); assert.equal(history.length,1);
    assert.deepEqual(history[0].summary.primaryFailure,target.primaryFailure);
    assert.deepEqual(history[0].summary.execution,target.execution);
    assert.deepEqual(history[0].summary.outcome,{...target.outcome,cleanupConfirmed:true});
  } finally {
    lifecycleMock?.restore(); storeMock?.restore();executorMock?.restore(); recoveryMock?.restore(); restartMock?.restore();
    cp.spawnSync = originalSpawn; cp.spawn = originalAsyncSpawn; syncBuiltinESMExports();
    await Promise.all(syntheticChildren.map(item=>item.done));
    for(const item of syntheticChildren){assert.deepEqual([item.spawn,item.exit,item.close],[1,1,1]);assert.equal(item.child.stdout.readableEnded,true);assert.equal(item.child.stderr.readableEnded,true);item.child.stdout.destroy();item.child.stderr.destroy();}
  }
  } finally { restoreHostFixtureProcesses(); }
})().catch(error => { console.error(error); process.exitCode = 1; });`;

/** 保存済み不存在の固定四応答。実Processへのfallbackは持たない。
 * @trace ERB-IT-014
 */
export const savedAbsenceProcessProfileSource = `(async()=>{
  const cp=boundaryCp;
  const {PassThrough}=await import('node:stream');
  const children=[];
    const id=process.argv[2];
    const state=JSON.parse(fs.readFileSync(path.join(process.cwd(),'.crdd','domain-model','state.json')));
    const target=state.operations.find(operation=>operation.recoveryId===id);assert.ok(target);
    const identity=JSON.parse(target.identityJson);
    const requested=target.resources.snapshot.resources.filter(resource=>resource.request!=='not_issued');
    assert.equal(requested.length,1);
    const resource=requested[0];assert.match(resource.identity.dockerId,/^[a-f0-9]{64}$/);
    assert.equal(target.resources.checkpoints.find(checkpoint=>checkpoint.key===resource.key).observation,'absent');
    const commands=[['version','--format','{{.Server.Os}}'],['container','ls','--all','--no-trunc','--filter','id='+resource.identity.dockerId,'--format','{{.ID}}'],['container','ls','--all','--no-trunc','--filter','name=^/'+resource.identity.name+'$','--format','{{.ID}}'],['container','ls','--all','--no-trunc','--filter','label='+identity.ownershipLabel,'--format','{{.ID}}']];
    const dockerExe='C:\\\\Program Files\\\\Docker\\\\Docker\\\\resources\\\\bin\\\\docker.exe';
    const normalSync=cp.spawnSync;let calls=0,trustCalls=0,config=null,configIdentity=null;const profileViolations=[];
    cp.spawnSync=function(executable,argv,options){
      try{
      const powershell=path.win32.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
      if(executable.toLowerCase()!==powershell.toLowerCase())return normalSync(executable,argv,options);
      const script=["$ErrorActionPreference='Stop'", "$signature=Get-AuthenticodeSignature -LiteralPath '"+dockerExe+"'", "$certificate=$signature.SignerCertificate", "if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=Docker Inc(?:,|$)')){exit 2}", "Write-Output 'CRDD_DOCKER_AUTHENTICODE_OK'"].join(';');
      assert.equal(trustCalls++,0);assert.deepEqual(argv,['-NoLogo','-NoProfile','-NonInteractive','-Command',script]);
      return {pid:1,status:0,signal:null,stdout:'CRDD_DOCKER_AUTHENTICODE_OK\\r\\n',stderr:'',output:[null,'CRDD_DOCKER_AUTHENTICODE_OK\\r\\n','']};
      }catch(error){const failure={channel:'sync',index:calls,site:/stdin.?:([0-9]+):([0-9]+)/u.exec(error.stack??'')?.slice(1)??null};profileViolations.push(failure);throw new Error('host_fixture_classifier_rejected:'+JSON.stringify(failure));}
    };
    cp.spawn=function(executable,argv,options){
      try{
      assert.equal(executable,dockerExe);assert.deepEqual(argv.slice(0,3),['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config']);assert.deepEqual(argv.slice(4),commands[calls]);
      assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert.deepEqual(options.stdio,['ignore','pipe','pipe']);assert.equal(options.cwd,path.win32.join(process.env.SystemRoot,'System32'));assert.equal(options.timeout,undefined);assert.equal(options.maxBuffer,undefined);
      for(const key of ['DOCKER_HOST','DOCKER_CONTEXT'])assert.equal(options.env[key],undefined);
      for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY'])assert.equal(options.env[key],'');
      const directory=argv[3],relative=path.relative(identity.hostPaths.root,directory);assert.ok(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));assert.equal(path.basename(directory),'docker-cli-config');
      const info=fs.lstatSync(directory,{bigint:true});assert.ok(info.isDirectory()&&!info.isSymbolicLink());assert.deepEqual(fs.readdirSync(directory),[]);const physical=[info.dev,info.ino,info.birthtimeNs].join(':');
      if(config===null){config=directory;configIdentity=physical;}assert.equal(directory,config);assert.equal(physical,configIdentity);
      const stdout=calls++===0?'linux\\n':'';
      const child=Object.assign(new cp.ChildProcess(),{pid:1234,stdin:null,stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>{throw Error('fixture_termination_forbidden');}});
      const item={child,events:[],done:null};item.done=new Promise(resolve=>child.once('close',resolve));children.push(item);
      queueMicrotask(()=>{item.events.push('spawn');child.emit('spawn');child.stdout.end(stdout);child.stderr.end('');setImmediate(()=>{child.exitCode=0;child.signalCode=null;item.events.push('exit');child.emit('exit',0,null);item.events.push('close');child.emit('close',0,null);});});return child;
      }catch(error){const failure={channel:'async',index:calls,site:/stdin.?:([0-9]+):([0-9]+)/u.exec(error.stack??'')?.slice(1)??null};profileViolations.push(failure);throw new Error('host_fixture_classifier_rejected:'+JSON.stringify(failure));}
    };
    boundarySync();
    return {assertComplete(){assert.deepEqual(profileViolations,[]);assert.equal(calls,commands.length);assert.equal(trustCalls,1);assert.ok(config);assert.throws(()=>fs.lstatSync(config),{code:'ENOENT'});},async settle(){await Promise.all(children.map(item=>item.done));for(const item of children){assert.deepEqual(item.events,['spawn','exit','close']);assert.equal(item.child.stdout.readableEnded,true);assert.equal(item.child.stderr.readableEnded,true);item.child.stdout.destroy();item.child.stderr.destroy();}}};
})()`;

/** 通常の保存済み不存在を実CLIへ搬送する。
 * @trace ERB-IT-014
 */
export const currentRecoveryCliSource = `(async()=>{
  const assert=(await import('node:assert/strict')).default;
  const fs=(await import('node:fs')).default;
  const path=(await import('node:path')).default;
  ${hostFixtureProcessBoundarySource}
  let profile;
  try{
    profile=await ${savedAbsenceProcessProfileSource};
    const id=process.argv[2];
    const cliUrl=${JSON.stringify(new URL("../../bin/coordinator.ts", import.meta.url).href)};
    process.argv=[process.execPath,(await import('node:url')).fileURLToPath(cliUrl),'recovery','resume',id,'--json'];
    await import(cliUrl);
    assert.equal(process.exitCode,0);profile.assertComplete();
  }finally{try{await profile?.settle();}finally{restoreHostFixtureProcesses();}}
})().catch(error=>{console.error(error);process.exitCode=1;});`;
