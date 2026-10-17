/**
 * 認証作成unknownを通常CLIから専用保存・終了へ接続する子Process本文。
 * @responsibility Docker読取りだけを代役にし、実Root・回収Owner・DI・Writer・Host・履歴を接続する。
 * @trace ERB-IT-014
 * @precondition 呼出し元が自己生成Repositoryと完成した再起動checkpointのexact IDを渡す。
 * @stimulus 五資源中authだけunknownの状態へ旧flagなしの実bin入口を実行する。
 * @observation 固定六読取り・二回不存在・専用保存一回と、元unknown／一次失敗の保全。
 * @oracle 模擬観測だけを専用実Writerへ渡し、一般Writerや最終結果だけで代替しない。
 * @cleanup 全spyをfinallyで復元し、実CLIが対象Host・短命configを回収する。親が試験Rootを所有する。
 * @boundary 実Daemon再起動・遅延create無害化・汎用unknown終了は対象外。
 */
export const currentAuthenticationRecoveryCliSource = `(async () => {
  const assert = (await import('node:assert/strict')).default;
  const fs = (await import('node:fs')).default;
  const path = (await import('node:path')).default;
  const cp = (await import('node:child_process')).default;
  const {syncBuiltinESMExports} = await import('node:module');
  const {mock} = await import('node:test');
  const {fileURLToPath} = await import('node:url');
  const id = process.argv[2];
  const cliUrl = ${JSON.stringify(new URL("../../bin/coordinator.ts", import.meta.url).href)};
  const cli = fileURLToPath(cliUrl);
  const statePath = path.join(process.cwd(),'.crdd','coordinator','state.json');
  const initialBytes = fs.readFileSync(statePath), initial = JSON.parse(initialBytes);
  const target = initial.operations.find(item => item.recoveryId === id);
  assert.ok(target && target.kind === 'docker_task');
  const identity = JSON.parse(target.identityJson);
  const expectedResources = ['create_egress_network','create_internal_network','create_provider','create_proxy','create_subscription_auth_probe'].map(purpose => ({purpose,request:purpose === 'create_subscription_auth_probe'?'unknown':'not_requested',dockerId:null,receiptSource:null,observation:'unobserved',absence:null}));
  assert.deepEqual(target.resources,expectedResources);
  assert.deepEqual(target.execution,{externalSend:'not_issued',ownerEffect:'disabled',providerStart:'not_started',sharedWrite:'not_issued',workspaceReusable:false});
  assert.equal(identity.consumer,'coordinator_cli');
  assert.equal(target.dockerRestart.request,'confirmed'); assert.equal(target.dockerRestart.cleanup,'confirmed');
  assert.deepEqual(target.dockerRestart.result,{status:'completed',reason:'docker_restart_settled',request:'confirmed',effectOutcomeUnknown:false});
  const dockerExe = 'C:\\\\Program Files\\\\Docker\\\\Docker\\\\resources\\\\bin\\\\docker.exe';
  const nativeExe = path.resolve(path.dirname(cli),'../../../template/tools/coordinator/windows-x64/crdd-platform-access.exe');
  const nativeModes = ['--host-recovery-namespace-initialize','--host-recovery-namespace-observe','--local-app-data-directory','--system-windows-directory','--host-terminal-save','--host-terminal-read','--host-terminal-known-file-save','--host-terminal-known-file-read','--host-terminal-observe','--host-terminal-known-file-observe'];
  const list = ['container','ls','--all','--no-trunc','--filter','name=^/'+identity.resources.auth+'$'];
  const name = [...list,'--format','{{.ID}}'];
  const labelled = [...list,'--filter','label='+identity.ownershipLabel,'--format','{{.ID}}'];
  const commands = [name,labelled,name,labelled,name,labelled];
  let calls = 0, trustCalls = 0, violations = 0, restartCalls = 0, removalCalls = 0;
  let factories = 0, discoveries = 0, rounds = 0, saves = 0;
  let config = null, configIdentity = null;
  let isolationMock, storeMock, lifecycleMock;
  const originalSpawn = cp.spawnSync;
  try {
    cp.spawnSync = function(executable,argv,options) {
      try {
        if(executable === nativeExe) {
          assert.equal(argv.length,1); assert.ok(nativeModes.includes(argv[0]));
          assert.equal(options.shell,false); assert.equal(options.windowsHide,true);
          return originalSpawn(executable,argv,options);
        }
        let stdout = '';
        const powershell = path.win32.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
        if(executable.toLowerCase() === powershell.toLowerCase()) {
          assert.equal(trustCalls++,0);
          const script = ["$ErrorActionPreference='Stop'", "$signature=Get-AuthenticodeSignature -LiteralPath '"+dockerExe+"'", "$certificate=$signature.SignerCertificate", "if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=Docker Inc(?:,|$)')){exit 2}", "Write-Output 'CRDD_DOCKER_AUTHENTICODE_OK'"].join(';');
          assert.deepEqual(argv,['-NoLogo','-NoProfile','-NonInteractive','-Command',script]);
          stdout = 'CRDD_DOCKER_AUTHENTICODE_OK\\r\\n';
        } else {
          assert.equal(executable,dockerExe);
          assert.deepEqual(argv.slice(0,3),['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config']);
          assert.equal(options.shell,false); assert.equal(options.windowsHide,true);
          assert.equal(options.timeout,10000); assert.equal(options.maxBuffer,1048576);
          if(argv[5] === 'rm') removalCalls++;
          assert.deepEqual(argv.slice(4),commands[calls]);
          if(config === null) {
            config = argv[3];
            assert.ok(!path.relative(identity.hostPaths.root,config).startsWith('..'));
            assert.ok(path.basename(config).startsWith('docker-recovery-config-'));
            const info = fs.lstatSync(config,{bigint:true});
            assert.ok(info.isDirectory() && !info.isSymbolicLink());
            configIdentity = [info.dev,info.ino,info.birthtimeNs].join(':');
          }
          assert.equal(argv[3],config);
          const info = fs.lstatSync(config,{bigint:true});
          assert.equal([info.dev,info.ino,info.birthtimeNs].join(':'),configIdentity);
          assert.deepEqual(fs.readdirSync(config),[]);
          assert.equal(saves,0);
          calls++;
        }
        return {pid:1,status:0,signal:null,stdout,stderr:'',output:[null,stdout,'']};
      } catch(error) { violations++; throw error; }
    };
    syncBuiltinESMExports();
    const isolationUrl = ${JSON.stringify(new URL("../../../docker-isolation/src/index.ts", import.meta.url).href)};
    const isolation = await import(isolationUrl);
    isolationMock = mock.module(isolationUrl,{namedExports:{...isolation,
      restartDockerRuntime: () => { restartCalls++; throw new Error('unexpected_restart'); },
      createDockerTaskRecoveryExecutor: (input) => {
        assert.equal(++factories,1);
        const created = isolation.createDockerTaskRecoveryExecutor(input);
        assert.equal(created.status,'ready');
        return {...created,executor:{...created.executor,
          discoverSubmitted: (expectation) => {
            assert.equal(expectation.purpose,'create_subscription_auth_probe');
            assert.equal(expectation.expectedName,identity.resources.auth);
            const found = created.executor.discoverSubmitted(expectation);
            assert.equal(found,null); assert.equal(++discoveries,1); return found;
          },
          observeAbsent: (...args) => {
            assert.deepEqual(args,['container',identity.resources.auth,identity.ownershipLabel]);
            assert.equal(calls,2+rounds*2); assert.equal(saves,0);
            const absent = created.executor.observeAbsent(...args);
            assert.equal(absent,true); rounds++; assert.ok(rounds <= 2); return absent;
          },
          recoverObserved: () => { removalCalls++; throw new Error('unexpected_resource_removal'); },
        }};
      },
    }});
    const storeUrl = ${JSON.stringify(new URL("../../src/state-storage/settlement-store.ts", import.meta.url).href)};
    const store = await import(storeUrl);
    const model = await import(${JSON.stringify(new URL("../../src/state-storage/model.ts", import.meta.url).href)});
    storeMock = mock.module(storeUrl,{namedExports:{...store,
      writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure: (...args) => {
        assert.equal(++saves,1); assert.equal(args[1],id); assert.equal(discoveries,1); assert.equal(rounds,2); assert.equal(calls,6);
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
        const auth = closed.resources.find(item => item.purpose === 'create_subscription_auth_probe');
        assert.equal(auth.request,'unknown'); assert.equal(auth.dockerId,null); assert.equal(auth.receiptSource,null); assert.equal(auth.observation,'absent');
        assert.equal(auth.absence.recoveryId,id); assert.equal(auth.absence.dockerId,null); assert.equal(auth.absence.plannedResourceName,identity.resources.auth);
        assert.deepEqual(closed.resources.filter(item => item.purpose !== 'create_subscription_auth_probe'),target.resources.filter(item => item.purpose !== 'create_subscription_auth_probe'));
        return result;
      },
    }});
    const lifecycle = await import(${JSON.stringify(new URL("../../src/task/recovery.ts?auth-unknown-cli-fixture", import.meta.url).href)});
    lifecycleMock = mock.module(${JSON.stringify(new URL("../../src/task/recovery.ts", import.meta.url).href)},{namedExports:{...lifecycle}});
    const vc = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
    const verified = vc.verifyRepositoryRoot(process.cwd()); assert.equal(verified.status,'completed'); assert.ok(verified.capability);
    const read = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
    assert.equal(read.status,'completed'); assert.equal(read.lockReleased,true); assert.deepEqual(read.value.snapshot,initial);
    process.argv = [process.execPath,cli,'doctor','--recover-isolation',id,'--json'];
    await import(cliUrl);
    assert.equal(process.exitCode,0);
    assert.equal(violations,0); assert.equal(restartCalls,0); assert.equal(removalCalls,0);
    assert.equal(factories,1); assert.equal(discoveries,1); assert.equal(rounds,2); assert.equal(saves,1); assert.equal(calls,6); assert.equal(trustCalls,1);
    assert.ok(config); assert.throws(() => fs.lstatSync(config),{code:'ENOENT'});
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
    lifecycleMock?.restore(); storeMock?.restore(); isolationMock?.restore();
    cp.spawnSync = originalSpawn; syncBuiltinESMExports();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });`;
