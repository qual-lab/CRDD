/**
 * 現在Host回収・履歴・配送の実保存を子Processで検証する固定試験本文。
 * @responsibility 自己生成Repositoryだけで中断・fresh再入場・非対象不変を観測する。
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @precondition 呼出し元が専用試験Rootとexact回復IDを渡す。
 * @stimulus 固定故障点を実Filesystem保存へ注入する。
 * restart二形はDI再起動結果を代役にし、公開保存組立てから別Process通常CLIへ接続する。auth形のDocker観測も代役で、実Daemon再起動は証明しない。
 * @observation 状態・履歴・短命物・Ownerと結果搬送を確認する。
 * @oracle 不正な交差形はEffect 0、正規再入場だけ同じIDを完了する。
 * @cleanup 呼出し元が生成Rootを所有し、本文は保持排他をfinallyで解放する。
 * @boundary ERB-IT-014=Related 2 Blocks: 子Process→Host／現在状態Writer。
 */
export const currentHostTransitionWorkerSource = `(async () => {
      const assert = (await import('node:assert/strict')).default;
      const fs = (await import('node:fs')).default;
      const path = (await import('node:path')).default;
      const { createHash } = await import('node:crypto');
      const authenticationUnknownRestart = process.argv[3] === 'restart_auth_cli_entry';
      const restartEntry = process.argv[3] === 'restart_cli_entry' || authenticationUnknownRestart;
      let restartCalls = 0, restartExpectedBytes = null, restartExpectedCheckpoint = null;
      if(restartEntry) {
        const isolationUrl = ${JSON.stringify(new URL("../../../docker-isolation/src/index.ts", import.meta.url).href)};
        const isolation = await import(isolationUrl);
        const {mock} = await import('node:test');
        mock.module(isolationUrl, {namedExports: {...isolation, restartDockerRuntime: async (input) => {
          assert.equal(++restartCalls, 1);
          assert.equal(input.signal.aborted, false);
          assert.equal(input.verifyBoundary(), true);
          const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
          const before = fs.readFileSync(statePath), snapshot = JSON.parse(before);
          const target = snapshot.operations.find(item => item.recoveryId === process.argv[2]);
          assert.ok(target && target.dockerRestart === null);
          const identities = snapshot.operations.map(item => {
            assert.equal(item.kind, 'docker_task');
            const parsed = item.recoveryId.split('.');
            return {recoveryId:item.recoveryId, identitySha256:item.identitySha256, home:parsed[1], host:runtimeDomain.parseHostRecoveryToken(item.host.currentToken)};
          }).sort((left,right) => left.recoveryId.localeCompare(right.recoveryId));
          assert.equal(identities.length, 2);
          const scopeSha256 = createHash('sha256').update(JSON.stringify({schema:'crdd-coordinator/docker-restart-scope/v1',repositoryBinding:snapshot.repositoryBinding,identities})).digest('hex');
          assert.equal(input.requestId, runtimeDomain.createDockerRestartRequestId(snapshot.repositoryBinding,target.identitySha256,target.recoveryId,scopeSha256));
          restartExpectedBytes = before;
          const initial = {requestId:input.requestId,scopeSha256,request:'not_issued',cleanup:'not_required',result:null};
          assert.equal(input.beforeRequest(), true);
          for(const checkpoint of [initial,{...initial,request:'unknown',cleanup:'pending'}]) {
            restartExpectedBytes = model.prepareCoordinatorStateRestartSnapshot(restartExpectedBytes,target.recoveryId,checkpoint,snapshot.repositoryBinding);
            assert.ok(restartExpectedBytes);
          }
          assert.deepEqual(fs.readFileSync(statePath), restartExpectedBytes);
          assert.equal(input.verifyBoundary(), true);
          input.onEvent({event:'request_accepted',requestId:input.requestId,request:'issued'});
          restartExpectedBytes = model.prepareCoordinatorStateRestartSnapshot(restartExpectedBytes,target.recoveryId,{...initial,request:'issued',cleanup:'pending'},snapshot.repositoryBinding);
          assert.ok(restartExpectedBytes); assert.deepEqual(fs.readFileSync(statePath), restartExpectedBytes);
          assert.equal(input.verifyBoundary(), true);
          const observation = {requestId:input.requestId,status:'completed',reason:'docker_restart_settled',request:'confirmed',primaryFailure:null,stopFailure:null,startFailure:null,cleanupFailure:null,cleanupConfirmed:true,restartCompleted:true,effectOutcomeUnknown:false,startupElapsedMs:1};
          input.onEvent({event:'settled',observation});
          restartExpectedCheckpoint = {...initial,request:'confirmed',cleanup:'pending'};
          restartExpectedBytes = model.prepareCoordinatorStateRestartSnapshot(restartExpectedBytes,target.recoveryId,restartExpectedCheckpoint,snapshot.repositoryBinding);
          assert.ok(restartExpectedBytes); assert.deepEqual(fs.readFileSync(statePath), restartExpectedBytes);
          assert.equal(input.verifyBoundary(), true);
          return {...observation,delivery:'confirmed'};
        }}});
      }
      const vc = await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
      const store = await import(${JSON.stringify(new URL("../../src/storage/state.ts", import.meta.url).href)});
      const model = await import(${JSON.stringify(new URL("../../../domain-model/src/index.ts", import.meta.url).href)});
      const runtimeDomain = await import(${JSON.stringify(new URL("../../../domain-model/src/index.ts", import.meta.url).href)});
      const historyValues = await import(${JSON.stringify(new URL("../../../domain-model/src/index.ts", import.meta.url).href)});
      const stateValues = await import(${JSON.stringify(new URL("../../src/state/validation.ts", import.meta.url).href)});
      const recovery = await import(${JSON.stringify(new URL("../../src/execution/recovery.ts", import.meta.url).href)});
      const host = await import(${JSON.stringify(new URL("../../src/execution/operation.ts", import.meta.url).href)});
      const record = await import(${JSON.stringify(new URL("../../src/execution/recovery.ts", import.meta.url).href)});
      const id = process.argv[2], verified = vc.verifyRepositoryRoot(process.cwd());
      assert.equal(verified.status, 'completed'); assert.ok(verified.capability);
      if(restartEntry) {
        const restart = await import(${JSON.stringify(new URL("../../src/execution/recovery.ts", import.meta.url).href)});
        const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
        const before = fs.readFileSync(statePath), snapshot = JSON.parse(before);
        const target = snapshot.operations.find(item => item.recoveryId === id);
        const unrequested = ['create_egress_network','create_internal_network','create_provider','create_proxy','create_subscription_auth_probe'].map(purpose => ({purpose,request:authenticationUnknownRestart && purpose === 'create_subscription_auth_probe'?'unknown':'not_requested',dockerId:null,receiptSource:null,observation:'unobserved',absence:null}));
        assert.deepEqual(target.resources,unrequested);
        const siblings = snapshot.operations.filter(item => item.recoveryId !== id);
        assert.equal(siblings.length,1);
        const siblingIdentity = JSON.parse(siblings[0].identityJson);
        const siblingRecord = record.loadHostRecoveryRecordByToken(siblings[0].host.currentToken,siblingIdentity.hostPaths.root);
        assert.equal(siblingRecord.marker,siblingIdentity.hostPaths.marker);
        const restartSiblingPhysical = [siblingIdentity.hostPaths.root,siblingIdentity.hostPaths.marker].map(file => {
          const info = fs.lstatSync(file,{bigint:true});
          return {file,dev:info.dev,ino:info.ino,birthtimeNs:info.birthtimeNs,bytes:info.isFile()?fs.readFileSync(file):null,children:info.isDirectory()?fs.readdirSync(file).sort():null};
        });
        /**
         * 再起動後かつCLI前の兄弟Host実体を再照合する。
         * @responsibility 途中で壊れて後から戻る状態を最終比較だけで見逃さない。
         * @trace ERB-IT-014
         * @precondition 兄弟exact一件を実markerへ結合済み。
         * @stimulus 初回完了後と二回目拒否後に同じ比較を呼ぶ。
         * @observation root／markerの実体・本文・直下集合。
         * @oracle 全field不変だけ受理する。
         * @cleanup N/A: 読取りだけ。
         * @boundary 既存自己生成兄弟Hostだけ。
         */
        function assertRestartSiblingPhysical() {
          for(const expected of restartSiblingPhysical) {
            const info = fs.lstatSync(expected.file,{bigint:true});
            assert.deepEqual({file:expected.file,dev:info.dev,ino:info.ino,birthtimeNs:info.birthtimeNs,bytes:info.isFile()?fs.readFileSync(expected.file):null,children:info.isDirectory()?fs.readdirSync(expected.file).sort():null},expected);
          }
        }
        const completed = await restart.restartRuntimeOwnedDockerForRecovery(id,new AbortController().signal,verified.capability);
        assert.equal(completed.status,'completed'); assert.equal(completed.reason,'docker_restart_settled');
        assert.equal(completed.cleanupConfirmed,true); assert.equal(completed.restartCompleted,true); assert.equal(completed.taskRecoveryCompleted,false); assert.equal(completed.recoveryId,id);
        assert.equal(restartCalls,1); assert.ok(restartExpectedCheckpoint);
        const finalCheckpoint = {...restartExpectedCheckpoint,cleanup:'confirmed',result:{status:'completed',reason:'docker_restart_settled',request:'confirmed',effectOutcomeUnknown:false}};
        restartExpectedBytes = model.prepareCoordinatorStateRestartSnapshot(restartExpectedBytes,id,finalCheckpoint,snapshot.repositoryBinding);
        assert.ok(restartExpectedBytes); assert.deepEqual(fs.readFileSync(statePath),restartExpectedBytes);
        const saved = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
        assert.equal(saved.status,'completed'); assert.equal(saved.lockReleased,true);
        assert.deepEqual(saved.value.snapshot.operations.find(item => item.recoveryId === id),{...target,dockerRestart:finalCheckpoint});
        assert.deepEqual(saved.value.snapshot.operations.filter(item => item.recoveryId !== id),snapshot.operations.filter(item => item.recoveryId !== id));
        assertRestartSiblingPhysical();
        const repeated = await restart.restartRuntimeOwnedDockerForRecovery(id,new AbortController().signal,verified.capability);
        assert.equal(repeated.status,'blocked'); assert.equal(repeated.reason,'docker_restart_existing_attempt_requires_recovery'); assert.equal(repeated.cleanupConfirmed,true);
        assert.equal(restartCalls,1); assert.deepEqual(fs.readFileSync(statePath),restartExpectedBytes);
        assertRestartSiblingPhysical();
        assert.deepEqual(JSON.parse(fs.readFileSync(statePath)).operations.find(item => item.recoveryId === id).resources,unrequested);
        const kernel = await import(${JSON.stringify(new URL("../../src/execution/kernel-lock.ts", import.meta.url).href)});
        const acquired = [];
        try {
          for(const item of snapshot.operations) {
            const hostIdentity = runtimeDomain.parseHostRecoveryToken(item.host.currentToken);
            const hostLock = kernel.acquireRuntimeOwnedHostOperationKernelLock(hostIdentity.rootName,hostIdentity.nonce); assert.ok(hostLock); acquired.push(hostLock);
            const homeLock = kernel.acquireRuntimeOwnedLogicalProviderHomeKernelLock(item.recoveryId.split('.')[1]); assert.ok(homeLock); acquired.push(homeLock);
          }
          const stateLock = kernel.acquireRuntimeOwnedDockerRuntimeStateKernelLock(snapshot.repositoryBinding); assert.ok(stateLock); acquired.push(stateLock);
          assert.ok(acquired.every(lock => lock.assertLive()));
        } finally { for(const lock of acquired.reverse()) assert.equal(lock.release(),true); }
        for(const file of ['state.pending.json','state.lock','history.pending.jsonl']) assert.throws(() => fs.lstatSync(path.join(path.dirname(statePath),file)),{code:'ENOENT'});
      }
      if(process.argv[3].startsWith('cli_entry_') || process.argv[3] === 'handoff_failure' || restartEntry) {
        const {spawnSync} = await import('node:child_process');
        const {fileURLToPath} = await import('node:url');
        const cli = fileURLToPath(${JSON.stringify(new URL("../../bin/coordinator.ts", import.meta.url).href)});
        const handoffFailure = process.argv[3] === 'handoff_failure';
        const before = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
        assert.equal(before.status, 'completed');
        const target = before.value.snapshot.operations.find(item => item.recoveryId === id);
        assert.ok(target && target.kind === 'docker_task');
        const identity = JSON.parse(target.identityJson);
        const durableConsumer = process.argv[3].startsWith('cli_entry_orchestrator');
        const identifiedProvider = process.argv[3] === 'cli_entry_orchestrator_identified';
        let resolvedId = id;
        if(durableConsumer) {
          assert.equal(identity.recoveryCorrelationId, 'upper-current-host');
          assert.notEqual(identity.recoveryCorrelationId, identity.operationId);
          const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
          const bytes = fs.readFileSync(statePath);
          const refused = recovery.resolveRuntimeOwnedDockerTaskCurrentCorrelations(['upper-current-host', 'explicit-absent'], {...verified.capability});
          assert.equal(refused.status, 'blocked');
          assert.deepEqual(refused.bindings, []); assert.deepEqual(refused.absentCorrelationIds, []);
          assert.deepEqual(fs.readFileSync(statePath), bytes);
          const resolved = recovery.resolveRuntimeOwnedDockerTaskCurrentCorrelations(['upper-current-host', 'explicit-absent'], verified.capability);
          assert.equal(resolved.status, 'completed'); assert.equal(resolved.lockReleased, true);
          assert.deepEqual(resolved.bindings, [{correlationId: 'upper-current-host', recoveryId: id}]);
          assert.deepEqual(resolved.absentCorrelationIds, ['explicit-absent']);
          assert.deepEqual(fs.readFileSync(statePath), bytes);
          for(const file of ['state.pending.json', 'state.lock', 'history.pending.jsonl']) assert.throws(() => fs.lstatSync(path.join(path.dirname(statePath), file)), {code: 'ENOENT'});
          resolvedId = resolved.bindings[0].recoveryId;
        }
        if(handoffFailure) {
          assert.equal(identity.consumer, 'coordinator_cli');
          assert.deepEqual(target.resources, ['create_egress_network', 'create_internal_network', 'create_provider', 'create_proxy', 'create_subscription_auth_probe'].map(purpose => ({purpose, request: 'not_requested', dockerId: null, receiptSource: null, observation: 'unobserved', absence: null})));
        }
        const prepared = handoffFailure ? recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability) : null;
        if(prepared) assert.equal(prepared.status, 'prepared');
        let failureReached = 0, handoffWrites = 0, handoffError = null;
        const originalWrite = process.stdout.write;
        try {
          if(handoffFailure) {
            process.stdout.write = function(...args) { handoffWrites++; return originalWrite.apply(this, args); };
            throw new Error('current_fixture_handoff_before_output');
          }
        } catch(error) {
          assert.equal(handoffFailure, true);
          assert.equal(error.message, 'current_fixture_handoff_before_output');
          failureReached++;
          handoffError = error;
        } finally {
        process.stdout.write = originalWrite;
        if(prepared) assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(prepared.capability), true);
        let report;
        if(identifiedProvider) {
          const cp = (await import('node:child_process')).default;
          const {syncBuiltinESMExports} = await import('node:module');
          const originalSpawn = cp.spawnSync;
          const dockerId = 'c'.repeat(64);
          const selected = target.resources.find(item => item.purpose === 'create_provider');
          assert.deepEqual(selected, {purpose:'create_provider', request:'identified', dockerId, receiptSource:'docker_create_result', observation:'present', absence:null});
          assert.ok(target.resources.filter(item => item.purpose !== 'create_provider').every(item => item.request === 'not_requested' && item.dockerId === null && item.receiptSource === null && item.absence === null && item.observation === 'unobserved'));
          assert.equal(identity.provider, 'claude'); assert.equal(identity.operationMode, 'isolated_task');
          const dockerExe = 'C:\\\\Program Files\\\\Docker\\\\Docker\\\\resources\\\\bin\\\\docker.exe';
          const nativeExe = path.resolve(path.dirname(cli), '../../../template/tools/coordinator/windows-x64/crdd-platform-access.exe');
          const nativeModes = ['--host-recovery-namespace-initialize','--host-recovery-namespace-observe','--local-app-data-directory','--system-windows-directory','--host-terminal-save','--host-terminal-read','--host-terminal-known-file-save','--host-terminal-known-file-read','--host-terminal-observe','--host-terminal-known-file-observe'];
          const expectedCommands = [
            ['container','ls','--all','--no-trunc','--filter','id='+dockerId,'--format','{{.ID}}'],
            ['container','inspect',dockerId],
            ['container','rm','--force',dockerId],
            ['container','ls','--all','--no-trunc','--filter','id='+dockerId,'--format','{{.ID}}'],
            ['container','ls','--all','--no-trunc','--filter','name=^/'+identity.resources.provider+'$','--format','{{.ID}}'],
          ];
          let calls = 0, trustCalls = 0, violation = false, config = null, configIdentity = null;
          cp.spawnSync = function(executable, argv, options) {
            try {
              if(executable === nativeExe) {
                assert.equal(argv.length, 1); assert.ok(nativeModes.includes(argv[0]));
                assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
                return originalSpawn(executable, argv, options);
              }
              let stdout = '';
              const powershell = path.win32.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
              if(executable.toLowerCase() === powershell.toLowerCase()) {
                assert.equal(trustCalls++, 0);
                const script = ["$ErrorActionPreference='Stop'", "$signature=Get-AuthenticodeSignature -LiteralPath '"+dockerExe+"'", "$certificate=$signature.SignerCertificate", "if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=Docker Inc(?:,|$)')){exit 2}", "Write-Output 'CRDD_DOCKER_AUTHENTICODE_OK'"].join(';');
                assert.deepEqual(argv, ['-NoLogo','-NoProfile','-NonInteractive','-Command',script]);
                stdout = 'CRDD_DOCKER_AUTHENTICODE_OK\\r\\n';
              } else {
                assert.equal(executable, dockerExe);
                assert.deepEqual(argv.slice(0,3), ['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config']);
                assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
                assert.equal(options.timeout, 10000); assert.equal(options.maxBuffer, 1048576);
                if(config === null) {
                  config = argv[3];
                  assert.ok(!path.relative(identity.hostPaths.root, config).startsWith('..'));
                  assert.ok(path.basename(config).startsWith('docker-recovery-config-'));
                  const info = fs.lstatSync(config, {bigint:true});
                  assert.ok(info.isDirectory() && !info.isSymbolicLink());
                  configIdentity = [info.dev,info.ino,info.birthtimeNs].join(':');
                }
                assert.equal(argv[3], config);
                const info = fs.lstatSync(config, {bigint:true});
                assert.equal([info.dev,info.ino,info.birthtimeNs].join(':'), configIdentity);
                assert.deepEqual(fs.readdirSync(config), []);
                assert.deepEqual(argv.slice(4), expectedCommands[calls]);
                if(calls === 0) stdout = dockerId+'\\n';
                if(calls === 1) stdout = JSON.stringify([{
                  Id:dockerId, Name:'/'+identity.resources.provider,
                  Config:{Labels:{'crdd.coordinator.runtime':identity.ownershipLabel.split('=')[1]}, Image:identity.images.provider, User:'65534:65534'},
                  HostConfig:{ReadonlyRootfs:true, Privileged:false, CapDrop:['ALL'], CapAdd:null, SecurityOpt:['no-new-privileges'], PidsLimit:64, Init:false},
                  NetworkSettings:{Networks:{[identity.resources.internal]:{}}},
                  Mounts:[{Type:'bind',Destination:'/provider-home',RW:true,Propagation:'rprivate'},{Type:'bind',Destination:'/tmp',RW:true,Propagation:'rprivate'},{Type:'bind',Destination:'/work',RW:identity.workspaceMountMode !== 'read_only',Propagation:'rprivate'}],
                }]);
                if(calls === 2) {
                  const fresh = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.crdd','coordinator','state.json')));
                  const freshResource = fresh.operations.find(item => item.recoveryId === resolvedId).resources.find(item => item.purpose === 'create_provider');
                  assert.equal(freshResource.request, 'identified'); assert.equal(freshResource.dockerId, dockerId);
                  stdout = dockerId+'\\n';
                }
                calls++;
              }
              return {pid:1,status:0,signal:null,stdout,stderr:'',output:[null,stdout,'']};
            } catch(error) { violation = true; throw error; }
          };
          syncBuiltinESMExports();
          try {
            report = await recovery.recoverRuntimeOwnedDockerTaskForCurrentConsumer(resolvedId, verified.capability, new AbortController().signal);
          } finally {
            cp.spawnSync = originalSpawn; syncBuiltinESMExports();
          }
          assert.equal(violation, false); assert.equal(calls, expectedCommands.length); assert.equal(trustCalls, 1);
          assert.ok(config); assert.throws(() => fs.lstatSync(config), {code:'ENOENT'});
          assert.equal(report.reason, 'docker_task_recovery_durable_acceptance_pending');
        } else {
          const authenticationSource = authenticationUnknownRestart ? (await import(${JSON.stringify(new URL("./current-authentication-recovery-cli.ts", import.meta.url).href)})).currentAuthenticationRecoveryCliSource : undefined;
          const child = spawnSync(process.execPath, authenticationUnknownRestart ? ['--experimental-test-module-mocks','-',resolvedId] : [cli, 'doctor', '--recover-isolation', resolvedId, '--json'], {input:authenticationSource,cwd: process.cwd(), encoding: 'utf8', timeout: restartEntry ? 120000 : 60000, windowsHide: true});
          assert.equal(child.error, undefined); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr);
          assert.ok(Number.isInteger(child.pid) && child.pid > 0); assert.notEqual(child.pid, process.pid);
          report = JSON.parse(child.stdout);
        }
        const durable = durableConsumer;
        assert.equal(report.contract, 'crdd-coordinator/current-task-recovery');
        assert.equal(report.status, durable ? 'awaiting_delivery' : 'recovered');
        assert.equal(report.recoveryId, id); assert.equal(report.taskRecoveryCompleted, !durable);
        assert.equal(report.operationRemovalConfirmed, !durable); assert.equal(report.operationRetained, durable);
        assert.equal(report.deliveryPending, durable);
        assert.equal(report.cleanupReason, null);
        if(!identifiedProvider) { assert.equal(report.cliCleanupConfirmed, true); assert.equal(report.cliCleanupReason, null); }
        assert.equal(report.dockerCleanupConfirmed, true); assert.equal(report.hostCleanupConfirmed, true);
        assert.equal(report.locksReleased, true); assert.equal(report.historyConfirmed, true);
        assert.deepEqual(Object.keys(report).sort(), ['contract','status','reason','recoveryId','dockerCleanupConfirmed','hostCleanupConfirmed','locksReleased','historyConfirmed','deliveryPending','operationRetained','operationRemovalConfirmed','taskRecoveryCompleted','cleanupReason',...(!identifiedProvider ? ['cliCleanupConfirmed','cliCleanupReason'] : [])].sort());
        if(durableConsumer) {
          const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
          const bytes = fs.readFileSync(statePath), state = JSON.parse(bytes);
          const retained = state.operations.find(item => item.recoveryId === resolvedId);
          assert.ok(retained);
          assert.equal(JSON.parse(retained.identityJson).consumer, 'orchestrator');
          assert.equal(JSON.parse(retained.identityJson).recoveryCorrelationId, 'upper-current-host');
          const deliveries = state.pendingDeliveries.filter(item => item.recoveryId === resolvedId);
          assert.equal(deliveries.length, 1); assert.equal(deliveries[0].acceptanceSha256, null);
          const resolved = recovery.resolveRuntimeOwnedDockerTaskCurrentCorrelations(['upper-current-host', 'explicit-absent'], verified.capability);
          assert.equal(resolved.status, 'completed'); assert.equal(resolved.lockReleased, true);
          assert.deepEqual(resolved.bindings, [{correlationId: 'upper-current-host', recoveryId: resolvedId}]);
          assert.deepEqual(resolved.absentCorrelationIds, ['explicit-absent']);
          assert.deepEqual(fs.readFileSync(statePath), bytes);
        }
        if(handoffFailure) {
          assert.equal(failureReached, 1); assert.equal(handoffWrites, 0);
          for(const file of [identity.hostPaths.root, identity.hostPaths.marker]) assert.throws(() => fs.lstatSync(file), {code: 'ENOENT'});
          for(const file of ['state.pending.json', 'state.lock', 'history.pending.jsonl']) assert.throws(() => fs.lstatSync(path.join(process.cwd(), '.crdd', 'coordinator', file)), {code: 'ENOENT'});
          const saved = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
          assert.equal(saved.status, 'completed');
          assert.deepEqual(saved.value.snapshot.operations, before.value.snapshot.operations.filter(item => item.recoveryId !== id));
          const history = historyValues.decodeCoordinatorHistoryRows(fs.readFileSync(path.join(process.cwd(), '.crdd', 'coordinator', 'history.jsonl')));
          assert.ok(history);
          const row = history.find(item => item.recoveryId === id); assert.ok(row);
          const summary = JSON.parse(row.line).summary;
          assert.deepEqual(summary.primaryFailure, target.primaryFailure);
          assert.deepEqual(summary.outcome, {...target.outcome, cleanupConfirmed: true});
          process.stderr.write('current_handoff_failure_recovered');
        }
        }
        if(handoffError) throw handoffError;
        process.stdout.write('current_host_storage_verified'); return;
      }
      if(process.argv[3] === 'recover_history' || process.argv[3] === 'recover_delivery') {
        const recoveringDelivery = process.argv[3] === 'recover_delivery';
        const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
        const hasTemporary = ['state.lock', 'state.pending.json', 'history.pending.jsonl'].some(name => fs.existsSync(path.join(path.dirname(statePath), name)));
        assert.equal(store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability).status, hasTemporary ? 'blocked' : 'completed');
        const observed = recoveringDelivery ? store.readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(verified.capability, id) : store.readRuntimeOwnedCoordinatorCurrentHistorySnapshot(verified.capability, id);
        assert.equal(observed.status, 'completed'); assert.ok(recoveringDelivery ? observed.currentDeliveryPublication : observed.currentHistoryPublication);
        const fixedState = fs.readFileSync(statePath);
        if(process.argv[4] === 'history_confirm_pending') {
          const historyPath = path.join(path.dirname(statePath), 'history.jsonl');
          const published = fs.readFileSync(historyPath);
          const pendingPath = path.join(path.dirname(statePath), 'state.pending.json'), markerPath = path.join(path.dirname(statePath), 'state.lock');
          const pendingBytes = fs.readFileSync(pendingPath), markerBytes = fs.readFileSync(markerPath);
          const row = JSON.parse(published.toString()), nonce = 'e'.repeat(64);
          row.summary.operationNonce = nonce; row.summary.operationId = 'OP-888888';
          row.summary.recoveryId = 'docker-task.'+id.split('.')[1]+'.'+nonce+'.'+row.summary.identitySha256;
          const otherLine = Buffer.from(stateValues.encodeRuntimeStateValue(row)+'\\n');
          assert.ok(historyValues.decodeCoordinatorHistoryRows(otherLine));
          for(const replacement of [null, otherLine]) {
            try {
              if(replacement === null) fs.unlinkSync(historyPath); else fs.writeFileSync(historyPath, replacement);
              assert.equal(store.readRuntimeOwnedCoordinatorCurrentHistorySnapshot(verified.capability, id).status, 'blocked');
              assert.equal(recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability).status, 'blocked');
              assert.deepEqual(fs.readFileSync(statePath), fixedState);
              assert.deepEqual(fs.readFileSync(pendingPath), pendingBytes); assert.deepEqual(fs.readFileSync(markerPath), markerBytes);
              if(replacement === null) assert.equal(fs.existsSync(historyPath), false); else assert.deepEqual(fs.readFileSync(historyPath), replacement);
            } finally { fs.writeFileSync(historyPath, published); }
          }
        }
        for(const name of ['state.pending.json', 'history.pending.jsonl', 'history.jsonl']) {
          const file = path.join(path.dirname(statePath), name);
          if(!fs.existsSync(file)) continue;
          const original = fs.readFileSync(file);
          try {
            fs.writeFileSync(file, 'invalid publication');
            assert.equal((recoveringDelivery ? store.readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(verified.capability, id) : store.readRuntimeOwnedCoordinatorCurrentHistorySnapshot(verified.capability, id)).status, 'blocked');
            assert.equal(recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability).status, 'blocked');
            assert.deepEqual(fs.readFileSync(statePath), fixedState);
          } finally { fs.writeFileSync(file, original); }
        }
        const unexpected = path.join(path.dirname(statePath), 'unexpected');
        try { fs.writeFileSync(unexpected, 'fixture'); assert.equal((recoveringDelivery ? store.readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(verified.capability, id) : store.readRuntimeOwnedCoordinatorCurrentHistorySnapshot(verified.capability, id)).status, 'blocked'); }
        finally { fs.unlinkSync(unexpected); }
        if(fs.existsSync(path.join(path.dirname(statePath), 'history.pending.jsonl'))) {
          const configRoot = path.join(process.cwd(), '.crdd', 'config'), configPath = path.join(configRoot, 'coordinator.json');
          assert.equal(fs.existsSync(configPath), false); fs.mkdirSync(configRoot, { recursive: true });
          try { fs.writeFileSync(configPath, JSON.stringify({ schemaRevision: 1, historyRetentionDays: 60 }));
            assert.equal(store.readRuntimeOwnedCoordinatorCurrentHistorySnapshot(verified.capability, id).status, 'blocked');
            assert.deepEqual(fs.readFileSync(statePath), fixedState);
          } finally { fs.unlinkSync(configPath); }
        }
        const prepared = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(prepared.status, 'prepared');
        assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(prepared.capability), true);
        assert.equal(recovery.finalizeRuntimeOwnedDockerTaskRecoveryPreparation(prepared.capability).snapshotConfirmed, true);
        const history = recovery.completeRuntimeOwnedDockerTaskRecoveryHistory(prepared.capability);
        assert.equal(history.status, 'completed', history.reason); assert.equal(history.historyConfirmed, true);
        if(recoveringDelivery) {
          const delivered = recovery.registerRuntimeOwnedDockerTaskRecoveryDelivery(prepared.capability);
          assert.equal(delivered.status, 'completed', delivered.reason); assert.equal(delivered.deliveryPending, true);
          assert.equal(recovery.registerRuntimeOwnedDockerTaskRecoveryDelivery(prepared.capability).filesystemEffectIssued, false);
          assert.equal(store.readRuntimeOwnedCoordinatorRecoveryResult(verified.capability, id).status, 'completed');
        }
        const after = fs.readFileSync(statePath), line = runtimeDomain.prepareCoordinatorStateHistoryLine(after, id, observed.value.snapshot.repositoryBinding);
        assert.ok(line); assert.deepEqual(fs.readFileSync(path.join(path.dirname(statePath), 'history.jsonl')), line);
        assert.equal(recovery.completeRuntimeOwnedDockerTaskRecoveryHistory(prepared.capability).filesystemEffectIssued, false);
        assert.deepEqual(fs.readFileSync(statePath), after);
        for(const name of ['state.lock', 'state.pending.json', 'history.pending.jsonl']) assert.throws(() => fs.lstatSync(path.join(path.dirname(statePath), name)), { code: 'ENOENT' });
        process.stdout.write('history_publication_recovered'); return;
      }
      if(process.argv[3] === 'recover_cleanup') {
        const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
        const pendingPath = path.join(path.dirname(statePath), 'state.pending.json');
        const lockPath = path.join(path.dirname(statePath), 'state.lock');
        assert.equal(store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability).status, 'blocked');
        const observed = store.readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(verified.capability, id);
        assert.equal(observed.status, 'completed'); assert.equal(observed.lockReleased, true);
        assert.ok(observed.hostCleanupPublication); assert.equal(observed.hostCleanupPublication.mode, process.argv[4]);
        const expected = Buffer.from(observed.hostCleanupPublication.candidate);
        const stateBefore = fs.readFileSync(statePath), lockBefore = fs.readFileSync(lockPath);
        const pendingBefore = fs.existsSync(pendingPath) ? fs.readFileSync(pendingPath) : null;
        fs.writeFileSync(pendingPath, process.argv[4] === 'C' ? expected : Buffer.from('invalid pending'));
        assert.equal(store.readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(verified.capability, id).status, 'blocked');
        assert.equal(recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability).status, 'blocked');
        assert.deepEqual(fs.readFileSync(statePath), stateBefore);
        if(pendingBefore) fs.writeFileSync(pendingPath, pendingBefore); else fs.unlinkSync(pendingPath);
        fs.writeFileSync(lockPath, 'invalid lock');
        assert.equal(store.readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot(verified.capability, id).status, 'blocked');
        fs.writeFileSync(lockPath, lockBefore);
        const prepared = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(prepared.status, 'prepared');
        try {
          assert.equal(recovery.persistRuntimeOwnedDockerTaskRecoveryCheckpoint(prepared.capability, 'host', {}), false);
          assert.equal(recovery.confirmRuntimeOwnedDockerTaskHostAbsence(prepared.capability), false);
          assert.equal(recovery.recoverRuntimeOwnedDockerTaskResources(prepared.capability, null).status, 'blocked');
          assert.equal((await recovery.executeRuntimeOwnedDockerTaskResourceRecovery(prepared.capability, () => { throw new Error('unrelated Docker operation forbidden'); })).status, 'blocked');
          assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(prepared.capability), true);
          const after = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
          assert.equal(after.status, 'completed'); assert.equal(after.lockReleased, true);
          assert.deepEqual(fs.readFileSync(statePath), expected);
          assert.throws(() => fs.lstatSync(pendingPath), { code: 'ENOENT' });
          assert.throws(() => fs.lstatSync(lockPath), { code: 'ENOENT' });
        } finally { assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(prepared.capability), true); }
        const open = fs.openSync, unlink = fs.unlinkSync;
        const activity = [];
        const fresh = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(fresh.status, 'prepared');
        try {
          fs.openSync = (file, ...args) => { if(file === lockPath || file === pendingPath) activity.push('open'); return open(file, ...args); };
          fs.unlinkSync = file => { if(file === lockPath || file === pendingPath) activity.push('unlink'); return unlink(file); };
          assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(fresh.capability), true);
          assert.deepEqual(activity, []); assert.deepEqual(fs.readFileSync(statePath), expected);
        } finally { fs.openSync = open; fs.unlinkSync = unlink; assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(fresh.capability), true); }
        process.stdout.write('cleanup_publication_recovered'); return;
      }
      if(process.argv[3] === 'driver' || process.argv[3].startsWith('completion_')) {
        const initial = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
        assert.equal(initial.status, 'completed'); assert.equal(initial.lockReleased, true); assert.ok(initial.value);
        const targets = initial.value.snapshot.operations.filter(item => item.recoveryId === id);
        assert.equal(targets.length, 1);
        const target = targets[0], identity = JSON.parse(target.identityJson);
        assert.equal(Object.getPrototypeOf(identity), Object.prototype);
        assert.match(identity.operationId, /^OP-[0-9]{6,}$/u);
        assert.equal(identity.operationNonce, id.split('.')[2]);
        assert.equal(createHash('sha256').update(target.identityJson).digest('hex'), target.identitySha256);
        assert.equal(target.identitySha256, id.split('.')[3]);
        const hostRoot = identity.hostPaths.root, hostMarker = identity.hostPaths.marker;
        assert.equal(typeof hostRoot, 'string'); assert.equal(typeof hostMarker, 'string');
        const fixtureArea = path.join(process.cwd(), '.crdd', 'tests');
        assert.equal(path.dirname(hostRoot), fixtureArea);
        assert.equal(path.basename(hostRoot), identity.initialHostRecovery.record.rootName);
        assert.equal(path.dirname(hostMarker), path.join(fixtureArea, 'crdd-coordinator-recovery-v1'));
        assert.equal(fs.lstatSync(hostRoot).isDirectory(), true);
        assert.equal(fs.lstatSync(hostMarker).isFile(), true);
        const result = await recovery.recoverRuntimeOwnedDockerTaskFromCurrentRepository(id, verified.capability);
        assert.equal(result.status, 'completed', result.reason);
        assert.equal(result.recoveryId, id); assert.equal(result.dockerCleanupConfirmed, true); assert.equal(result.hostCleanupConfirmed, true);
        assert.equal(result.locksReleased, true); assert.equal(result.historyConfirmed, true); assert.equal(result.deliveryPending, false);
        assert.equal(result.operationRetained, true); assert.equal(result.taskRecoveryCompleted, false); assert.ok(result.preparation);
        const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json'), before = fs.readFileSync(statePath);
        const historyPath = path.join(path.dirname(statePath), 'history.jsonl'), historyBefore = fs.readFileSync(historyPath);
        const protectedPaths = new Set([...['state.json', 'history.jsonl', 'state.pending.json', 'state.lock', 'history.pending.jsonl'].map(name => path.join(path.dirname(statePath), name)), hostRoot, hostMarker]);
        const originals = { openSync: fs.openSync, closeSync: fs.closeSync, writeFileSync: fs.writeFileSync, appendFileSync: fs.appendFileSync, writeSync: fs.writeSync, renameSync: fs.renameSync, unlinkSync: fs.unlinkSync, truncateSync: fs.truncateSync, mkdirSync: fs.mkdirSync, rmdirSync: fs.rmdirSync, rmSync: fs.rmSync };
        const descriptors = new Set(), writes = [];
        const isProtected = file => typeof file === 'string' && protectedPaths.has(path.resolve(file));
        try {
          fs.openSync = (file, flags, ...args) => {
            const writable = typeof flags === 'string' ? /[wa+]/u.test(flags) : (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) !== 0;
            if(isProtected(file) && writable) writes.push('open');
            const fd = originals.openSync(file, flags, ...args); if(isProtected(file)) descriptors.add(fd); return fd;
          };
          fs.closeSync = fd => { const result = originals.closeSync(fd); descriptors.delete(fd); return result; };
          for(const name of ['writeFileSync', 'appendFileSync', 'writeSync', 'truncateSync', 'mkdirSync', 'rmdirSync', 'rmSync']) fs[name] = (file, ...args) => { if(isProtected(file) || descriptors.has(file)) writes.push(name); return originals[name](file, ...args); };
          fs.renameSync = (from, to) => { if(isProtected(from) || isProtected(to)) writes.push('rename'); return originals.renameSync(from, to); };
          fs.unlinkSync = file => { if(isProtected(file)) writes.push('unlink'); return originals.unlinkSync(file); };
          // 同本文の再出版でも、この実Filesystem観測が拒否することを確認する。
          assert.throws(() => { fs.writeFileSync(statePath, before); assert.deepEqual(writes, []); }, { code: 'ERR_ASSERTION' });
          assert.ok(writes.includes('writeFileSync')); writes.length = 0;
          assert.throws(() => fs.lstatSync(hostRoot), { code: 'ENOENT' });
          assert.throws(() => fs.lstatSync(hostMarker), { code: 'ENOENT' });
          assert.equal(fs.lstatSync(path.dirname(hostMarker)).isDirectory(), true);
          try {
            assert.throws(() => { fs.writeFileSync(hostMarker, 'synthetic observer check', { flag: 'wx' }); fs.unlinkSync(hostMarker); assert.deepEqual(writes, []); }, { code: 'ERR_ASSERTION' });
            assert.ok(writes.includes('writeFileSync')); assert.ok(writes.includes('unlink'));
          } finally { if(fs.existsSync(hostMarker)) fs.unlinkSync(hostMarker); }
          assert.throws(() => fs.lstatSync(hostRoot), { code: 'ENOENT' });
          assert.throws(() => fs.lstatSync(hostMarker), { code: 'ENOENT' });
          writes.length = 0;
          const repeated = await recovery.recoverRuntimeOwnedDockerTaskFromCurrentRepository(id, verified.capability);
          assert.equal(repeated.status, 'completed', repeated.reason); assert.deepEqual(writes, []);
          assert.deepEqual(fs.readFileSync(statePath), before);
          assert.deepEqual(fs.readFileSync(historyPath), historyBefore);
          assert.throws(() => fs.lstatSync(hostRoot), { code: 'ENOENT' });
          assert.throws(() => fs.lstatSync(hostMarker), { code: 'ENOENT' });
        } finally { Object.assign(fs, originals); }
        for(const name of ['state.lock', 'state.pending.json', 'history.pending.jsonl']) assert.equal(fs.existsSync(path.join(path.dirname(statePath), name)), false);
        if(process.argv[3].startsWith('completion_')) {
          assert.equal(recovery.completeRuntimeOwnedDockerTaskTransientRecovery({}).filesystemEffectIssued, false);
          const rename = fs.renameSync, remove = fs.unlinkSync;
          let injected = false, completed;
          try {
            fs.renameSync = (from, to) => { if(process.argv[3] === 'completion_pending' && to === statePath && !injected) { injected = true; throw new Error('fixture completion before rename'); } return rename(from, to); };
            fs.unlinkSync = file => { if(process.argv[3] === 'completion_marker' && file === path.join(path.dirname(statePath), 'state.lock') && !injected) { injected = true; throw new Error('fixture completion marker'); } return remove(file); };
            completed = recovery.completeRuntimeOwnedDockerTaskTransientRecovery(result.preparation);
          } finally { fs.renameSync = rename; fs.unlinkSync = remove; }
          if(process.argv[3] === 'completion_pending') {
            assert.equal(injected, true); assert.equal(completed.status, 'blocked'); assert.equal(completed.operationRemovalConfirmed, false);
            assert.equal(recovery.completeRuntimeOwnedDockerTaskTransientRecovery(result.preparation).filesystemEffectIssued, false);
            assert.equal(store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability).status, 'blocked');
            assert.equal(store.readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(verified.capability, id).status, 'completed');
            const pendingPath = path.join(path.dirname(statePath), 'state.pending.json'), pendingBytes = fs.readFileSync(pendingPath), fixedCurrent = fs.readFileSync(statePath);
            try {
              for(const invalid of [fixedCurrent, Buffer.from('foreign pending')]) {
                fs.writeFileSync(pendingPath, invalid);
                assert.equal(store.readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(verified.capability, id).status, 'blocked');
                assert.equal(recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability).status, 'blocked');
                assert.deepEqual(fs.readFileSync(statePath), fixedCurrent); assert.deepEqual(fs.readFileSync(pendingPath), invalid);
              }
            } finally { fs.writeFileSync(pendingPath, pendingBytes); }
            const freshRecovery = await recovery.recoverRuntimeOwnedDockerTaskFromCurrentRepository(id, verified.capability);
            assert.equal(freshRecovery.status, 'completed', freshRecovery.reason);
            completed = recovery.completeRuntimeOwnedDockerTaskTransientRecovery(freshRecovery.preparation);
          } else if(process.argv[3] === 'completion_marker') {
            assert.equal(injected, true); assert.equal(completed.status, 'blocked'); assert.equal(completed.operationRemovalConfirmed, false);
            assert.equal(store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability).status, 'blocked');
            const cleanup = store.cleanupRuntimeOwnedCoordinatorStateMarker(verified.capability);
            assert.equal(cleanup.status, 'completed'); assert.equal(cleanup.markerRemoved, true);
            completed = null;
          }
          if(completed) { assert.equal(completed.status, 'completed', completed.reason); assert.equal(completed.operationRemovalConfirmed, true); assert.equal(completed.taskRecoveryCompleted, true); assert.equal(completed.lockReleased, true); }
          const current = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
          assert.equal(current.status, 'completed'); assert.equal(current.value.snapshot.operations.some(item => item.recoveryId === id), false);
          assert.deepEqual(fs.readFileSync(historyPath), historyBefore);
          assert.equal(recovery.completeRuntimeOwnedDockerTaskTransientRecovery(result.preparation).filesystemEffectIssued, false);
          for(const name of ['state.lock', 'state.pending.json', 'history.pending.jsonl']) assert.equal(fs.existsSync(path.join(path.dirname(statePath), name)), false);
        }
        process.stdout.write('current_host_storage_verified'); return;
      }
      const before = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
      assert.equal(before.status, 'completed'); assert.equal(before.lockReleased, true); assert.ok(before.value);
      const targets = before.value.snapshot.operations.filter(item => item.recoveryId === id);
      assert.equal(targets.length, 1);
      const operation = targets[0], identity = JSON.parse(operation.identityJson);
      const loaded = record.loadHostRecoveryRecordByToken(operation.host.currentToken, identity.hostPaths.root);
      const expectedBytes = JSON.stringify({ ...loaded.record, state: 'docker_absent_confirmed' })+'\\n';
      const expectedToken = 'host.'+loaded.parsed.rootName+'.'+loaded.parsed.nonce+'.'+createHash('sha256').update(expectedBytes).digest('hex');
      const intent = { currentToken: operation.host.currentToken, expectedToken, rootName: loaded.parsed.rootName, nonce: loaded.parsed.nonce, currentState: 'docker_submission_started', nextState: 'docker_absent_confirmed', recordBefore: loaded.record };
      const middle = { ...before.value.snapshot, revision: before.value.snapshot.revision+1, previous: { revision: before.value.snapshot.revision, payloadSha256: before.value.payloadSha256 }, operations: before.value.snapshot.operations.map(item => item.recoveryId === id ? { ...item, host: { ...item.host, pendingTransitionJson: JSON.stringify(intent)+'\\n' } } : item) };
      const middleBytes = Buffer.from(stateValues.encodeRuntimeStateValue(middle)+'\\n');
      const final = { ...middle, revision: middle.revision+1, previous: { revision: middle.revision, payloadSha256: createHash('sha256').update(middleBytes).digest('hex') }, operations: middle.operations.map(item => item.recoveryId === id ? { ...item, host: { ...item.host, currentToken: expectedToken, pendingTransitionJson: null } } : item) };
      const finalBytes = Buffer.from(stateValues.encodeRuntimeStateValue(final)+'\\n');
      const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json');
      const versions = [], rename = fs.renameSync, open = fs.openSync;
      const publicationFault = process.argv[3] === 'null_outcome' || process.argv[3].startsWith('history_') || process.argv[3].startsWith('delivery_') || process.argv[3] === 'workbench_transient' ? 'none' : process.argv[3];
      let injectCleanupFault = false, faultInjected = false;
      let capability = null, capabilityReleased = false;
      try {
        const prepared = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(prepared.status, 'prepared'); capability = prepared.capability;
        fs.openSync = (file, ...args) => { if(injectCleanupFault && !faultInjected && publicationFault === 'A' && versions.length === 3 && file === path.join(path.dirname(statePath), 'state.pending.json') && args[0] === 'wx') { faultInjected = true; throw new Error('injected before pending creation'); } return open(file, ...args); };
        fs.renameSync = (from, to) => {
          const fail = injectCleanupFault && !faultInjected && to === statePath && versions.length === 3;
          if(fail && publicationFault === 'B') { faultInjected = true; throw new Error('injected before publication'); }
          const result = rename(from, to); if(to === statePath) versions.push(fs.readFileSync(statePath));
          if(fail && publicationFault === 'C') { faultInjected = true; throw new Error('injected after publication'); }
          return result;
        };
        assert.equal(recovery.confirmRuntimeOwnedDockerTaskHostAbsence(capability), true);
        assert.equal(versions.length, 2); assert.deepEqual(versions[0], middleBytes); assert.deepEqual(versions[1], finalBytes);
        assert.deepEqual(fs.readFileSync(statePath), finalBytes);
        const after = store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability);
        assert.equal(after.status, 'completed'); assert.equal(after.lockReleased, true);
        assert.deepEqual(after.value.snapshot, final);
        assert.equal(after.value.payloadSha256, createHash('sha256').update(finalBytes).digest('hex'));
        assert.equal(record.loadHostRecoveryRecordByToken(expectedToken, identity.hostPaths.root).serialized, expectedBytes);
        assert.equal(recovery.confirmRuntimeOwnedDockerTaskHostAbsence(capability), true);
        assert.equal(versions.length, 2);
        assert.deepEqual(fs.readFileSync(statePath), finalBytes);
        assert.equal(fs.readFileSync(loaded.marker, 'utf8'), expectedBytes);
        assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true); capability = null;
        assert.equal(versions.length, 2);
        const fresh = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(fresh.status, 'prepared'); capability = fresh.capability;
        assert.equal(recovery.confirmRuntimeOwnedDockerTaskHostAbsence(capability), true);
        assert.equal(versions.length, 2);
        assert.deepEqual(fs.readFileSync(statePath), finalBytes);
        assert.equal(fs.readFileSync(loaded.marker, 'utf8'), expectedBytes);
        assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true); capability = null;
        assert.equal(versions.length, 2);
        const cleanupIntent = { ...final, revision: final.revision+1, previous: { revision: final.revision, payloadSha256: createHash('sha256').update(finalBytes).digest('hex') }, operations: final.operations.map(item => item.recoveryId === id ? { ...item, host: { ...item.host, cleanup: 'pending' } } : item) };
        const cleanupIntentBytes = Buffer.from(stateValues.encodeRuntimeStateValue(cleanupIntent)+'\\n');
        const cleanupFinal = { ...cleanupIntent, revision: cleanupIntent.revision+1, previous: { revision: cleanupIntent.revision, payloadSha256: createHash('sha256').update(cleanupIntentBytes).digest('hex') }, operations: cleanupIntent.operations.map(item => item.recoveryId === id ? { ...item, host: { ...item.host, cleanup: 'confirmed' } } : item) };
        const cleanupFinalBytes = Buffer.from(stateValues.encodeRuntimeStateValue(cleanupFinal)+'\\n');
        const cleanup = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(cleanup.status, 'prepared'); capability = cleanup.capability;
        injectCleanupFault = true;
        assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(capability), publicationFault === 'none');
        if(publicationFault !== 'none') {
          assert.equal(faultInjected, true);
          assert.deepEqual(fs.readFileSync(statePath), publicationFault === 'C' ? cleanupFinalBytes : cleanupIntentBytes);
          assert.equal(store.readRuntimeOwnedCoordinatorRecoverySnapshot(verified.capability).status, 'blocked');
          const heldVersions = versions.length;
          assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(capability), false); assert.equal(versions.length, heldVersions);
          assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true); capability = null;
          fs.renameSync = rename; fs.openSync = open;
          const { spawnSync } = await import('node:child_process');
          const script = (await import(${JSON.stringify(new URL("./current-host-transition-worker.ts", import.meta.url).href)})).currentHostTransitionWorkerSource; assert.ok(script);
          const child = spawnSync(process.execPath, ['-', id, 'recover_cleanup', publicationFault], { input: script, cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true });
          assert.equal(child.error, undefined); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, 'cleanup_publication_recovered');
          assert.deepEqual(fs.readFileSync(statePath), cleanupFinalBytes);
        } else {
        assert.equal(versions.length, 4); assert.deepEqual(versions[2], cleanupIntentBytes); assert.deepEqual(versions[3], cleanupFinalBytes);
        assert.throws(() => fs.lstatSync(identity.hostPaths.root), { code: 'ENOENT' });
        assert.throws(() => fs.lstatSync(loaded.marker), { code: 'ENOENT' });
        assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(capability), true);
        assert.equal(versions.length, 4);
        assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true); capability = null;
        const settledCleanup = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(settledCleanup.status, 'prepared'); capability = settledCleanup.capability;
        assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(capability), true);
        assert.equal(versions.length, 4);
        assert.deepEqual(fs.readFileSync(statePath), cleanupFinalBytes);
        assert.equal(recovery.finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability).snapshotConfirmed, false);
        assert.equal(versions.length, 4);
        assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true);
        capabilityReleased = true;
        assert.equal(versions.length, 4);
        fs.mkdirSync(identity.hostPaths.root);
        try {
          assert.equal(recovery.finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability).snapshotConfirmed, false);
          assert.equal(recovery.finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability).snapshotConfirmed, false);
          assert.equal(versions.length, 4);
          assert.deepEqual(fs.readFileSync(statePath), cleanupFinalBytes);
        } finally { fs.rmdirSync(identity.hostPaths.root); }
        const terminalOwner = recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability);
        assert.equal(terminalOwner.status, 'prepared'); capability = terminalOwner.capability; capabilityReleased = false;
        assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost(capability), true);
        assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true);
        capabilityReleased = true;
        assert.equal(versions.length, 4);
        const terminal = recovery.finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability);
        assert.equal(terminal.status, 'completed'); assert.equal(terminal.snapshotConfirmed, true); assert.equal(terminal.lockReleased, true);
        assert.equal(versions.length, 5);
        const terminalExpected = { ...cleanupFinal, revision: cleanupFinal.revision + 1, previous: { revision: cleanupFinal.revision, payloadSha256: createHash('sha256').update(cleanupFinalBytes).digest('hex') }, operations: cleanupFinal.operations.map(item => item.recoveryId !== id ? item : { ...item, phase: 'settling', lease: 'released', outcome: item.outcome === null ? { status: 'blocked', reason: 'docker_process_controller_execution_failed_closed', cleanupConfirmed: true } : { ...item.outcome, cleanupConfirmed: true } }) };
        assert.deepEqual(fs.readFileSync(statePath), Buffer.from(stateValues.encodeRuntimeStateValue(terminalExpected)+'\\n'));
        assert.equal(recovery.finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability).snapshotConfirmed, false);
        assert.equal(versions.length, 5);
        const historyFault = process.argv[3].startsWith('history_') ? process.argv[3] : null;
        if(historyFault) {
          const fixed = model.prepareCoordinatorStateHistorySnapshot(Buffer.from(stateValues.encodeRuntimeStateValue(terminalExpected)+'\\n'), id, new Date().toISOString(), false, terminalExpected.repositoryBinding);
          const line = runtimeDomain.prepareCoordinatorStateHistoryLine(fixed, id, terminalExpected.repositoryBinding);
          const row = JSON.parse(line.toString()), nonce = 'f'.repeat(64);
          row.occurredAt = new Date(Date.now()-45*86400000).toISOString(); row.summary.operationNonce = nonce;
          row.summary.recoveryId = 'docker-task.'+id.split('.')[1]+'.'+nonce+'.'+row.summary.identitySha256;
          row.summary.operationId = 'OP-999999';
          const oldLine = Buffer.from(stateValues.encodeRuntimeStateValue(row)+'\\n'); assert.ok(historyValues.decodeCoordinatorHistoryRows(oldLine));
          fs.writeFileSync(path.join(path.dirname(statePath), 'history.jsonl'), oldLine);
        }
        const historyRename = fs.renameSync; let historyInjected = false;
        fs.renameSync = (from, to) => {
          const statePublication = to === statePath, historyPublication = to === path.join(path.dirname(statePath), 'history.jsonl');
          const hit = !historyInjected && (
            ((historyFault === 'history_checkpoint_pending' || historyFault === 'history_checkpoint_published') && statePublication && versions.length === 5) ||
            ((historyFault === 'history_pending' || historyFault === 'history_published') && historyPublication) ||
            ((historyFault === 'history_confirm_pending' || historyFault === 'history_confirm_published') && statePublication && versions.length === 6));
          if(hit && historyFault.endsWith('_pending')) { historyInjected = true; throw new Error('injected before publication'); }
          const result = historyRename(from, to);
          if(hit) { historyInjected = true; throw new Error('injected after publication'); }
          return result;
        };
        let history;
        try { history = recovery.completeRuntimeOwnedDockerTaskRecoveryHistory(capability); } finally { fs.renameSync = historyRename; }
        if(historyFault) {
          assert.equal(historyInjected, true); assert.equal(history.status, 'blocked'); assert.equal(history.historyConfirmed, false);
          const beforeRetry = fs.readFileSync(statePath), beforeRetryVersions = versions.length;
          assert.equal(recovery.completeRuntimeOwnedDockerTaskRecoveryHistory(capability).status, 'blocked');
          assert.equal(versions.length, beforeRetryVersions); assert.deepEqual(fs.readFileSync(statePath), beforeRetry);
          const { spawnSync } = await import('node:child_process');
          const script = (await import(${JSON.stringify(new URL("./current-host-transition-worker.ts", import.meta.url).href)})).currentHostTransitionWorkerSource; assert.ok(script);
          const resumed = spawnSync(process.execPath, ['-', id, 'recover_history', historyFault], { input: script, cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true });
          assert.equal(resumed.error, undefined); assert.equal(resumed.signal, null); assert.equal(resumed.status, 0, resumed.stderr); assert.equal(resumed.stdout, 'history_publication_recovered');
        } else {
          assert.equal(history.status, 'completed', history.reason); assert.equal(history.historyConfirmed, true); assert.equal(history.lockReleased, true);
          assert.equal(versions.length, 7);
        }
        const historyState = model.decodeCoordinatorUnifiedSnapshot(fs.readFileSync(statePath), terminalExpected.repositoryBinding);
        assert.ok(historyState);
        const historyOperation = historyState.snapshot.operations.find(item => item.recoveryId === id);
        assert.ok(historyOperation.history.confirmed);
        const historyLine = runtimeDomain.prepareCoordinatorStateHistoryLine(fs.readFileSync(statePath), id, terminalExpected.repositoryBinding);
        assert.ok(historyLine); assert.deepEqual(fs.readFileSync(path.join(path.dirname(statePath), 'history.jsonl')), historyLine);
        const historyBefore = fs.readFileSync(statePath);
        if(!historyFault) { assert.equal(recovery.completeRuntimeOwnedDockerTaskRecoveryHistory(capability).historyConfirmed, true); assert.equal(versions.length, 7); }
        assert.deepEqual(fs.readFileSync(statePath), historyBefore);
        assert.deepEqual(fs.readFileSync(path.join(path.dirname(statePath), 'history.jsonl')), historyLine);
        if(!historyFault) {
          assert.equal(store.readRuntimeOwnedCoordinatorRecoveryResult(verified.capability, id).status, 'blocked');
          const deliveryFault = process.argv[3].startsWith('delivery_') ? process.argv[3] : null;
          const deliveryRename = fs.renameSync, deliveryUnlink = fs.unlinkSync; let deliveryInjected = false;
          fs.renameSync = (from, to) => {
            if(to === statePath && deliveryFault === 'delivery_pending') { deliveryInjected = true; throw new Error('delivery before publication'); }
            const value = deliveryRename(from, to);
            if(to === statePath && deliveryFault === 'delivery_published') { deliveryInjected = true; throw new Error('delivery after publication'); }
            return value;
          };
          fs.unlinkSync = file => {
            if(file === path.join(path.dirname(statePath), 'state.lock') && deliveryFault === 'delivery_marker') { deliveryInjected = true; throw new Error('delivery before marker cleanup'); }
            return deliveryUnlink(file);
          };
          let delivery;
          try { delivery = recovery.registerRuntimeOwnedDockerTaskRecoveryDelivery(capability); }
          finally { fs.renameSync = deliveryRename; fs.unlinkSync = deliveryUnlink; }
          if(deliveryFault && deliveryFault !== 'delivery_none') {
            assert.equal(deliveryInjected, true); assert.equal(delivery.status, 'blocked');
            const failureState = fs.readFileSync(statePath), failureVersions = versions.length;
            assert.equal(recovery.registerRuntimeOwnedDockerTaskRecoveryDelivery(capability).status, 'blocked');
            assert.deepEqual(fs.readFileSync(statePath), failureState); assert.equal(versions.length, failureVersions);
            const { spawnSync } = await import('node:child_process'), script = (await import(${JSON.stringify(new URL("./current-host-transition-worker.ts", import.meta.url).href)})).currentHostTransitionWorkerSource;
            const resumed = spawnSync(process.execPath, ['-', id, 'recover_delivery', deliveryFault], { input: script, cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true });
            assert.equal(resumed.error, undefined); assert.equal(resumed.status, 0, resumed.stderr); assert.equal(resumed.stdout, 'history_publication_recovered');
          } else {
            assert.equal(delivery.status, 'completed', delivery.reason);
            assert.equal(delivery.deliveryPending, deliveryFault !== null);
            assert.equal(delivery.filesystemEffectIssued, deliveryFault !== null);
            assert.equal(recovery.registerRuntimeOwnedDockerTaskRecoveryDelivery(capability).filesystemEffectIssued, false);
          }
          const delivered = model.decodeCoordinatorUnifiedSnapshot(fs.readFileSync(statePath), terminalExpected.repositoryBinding);
          assert.ok(delivered);
          assert.equal(delivered.snapshot.pendingDeliveries.filter(item => item.recoveryId === id).length, deliveryFault ? 1 : 0);
          assert.deepEqual(delivered.snapshot.operations, historyState.snapshot.operations);
          assert.deepEqual(fs.readFileSync(path.join(path.dirname(statePath), 'history.jsonl')), historyLine);
          assert.equal(store.readRuntimeOwnedCoordinatorRecoveryResult(verified.capability, id).status, deliveryFault ? 'completed' : 'blocked');
          if(deliveryFault === null) assert.deepEqual(fs.readFileSync(statePath), historyBefore);
          if(deliveryFault === 'delivery_none') {
            const pendingPath = path.join(path.dirname(statePath), 'state.pending.json'), markerPath = path.join(path.dirname(statePath), 'state.lock');
            const fixed = fs.readFileSync(statePath), fixedHistory = fs.readFileSync(path.join(path.dirname(statePath), 'history.jsonl'));
            const marker = Buffer.from(JSON.stringify({ schema: 'crdd-coordinator/state-lock/v1', repositoryBinding: terminalExpected.repositoryBinding })+'\\n');
            try {
              fs.writeFileSync(pendingPath, fixed); fs.writeFileSync(markerPath, marker);
              assert.equal(store.readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(verified.capability, id).status, 'blocked');
              assert.equal(recovery.prepareRuntimeOwnedDockerTaskRecovery(id, verified.capability).status, 'blocked');
              const { stripTypeScriptTypes } = await import('node:module');
              const storeUrl = ${JSON.stringify(new URL("../../src/storage/state.ts", import.meta.url).href)};
              const original = fs.readFileSync(new URL(storeUrl), 'utf8');
              const readerDisabled = original.replace('if (pending && candidate.equals(before))', 'if (false)');
              assert.notEqual(readerDisabled, original);
              const rebased = readerDisabled.replace(/from "([^"]+)"/g, (match, specifier) => specifier.startsWith('.') ? 'from '+JSON.stringify(new URL(specifier, storeUrl).href) : match);
              const instrumented = await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(rebased)).toString('base64'));
              assert.equal(instrumented.readRuntimeOwnedCoordinatorCurrentDeliverySnapshot(verified.capability, id).status, 'completed');
              const binding = await import(${JSON.stringify(new URL("../../src/execution/operation.ts", import.meta.url).href)});
              const repository = binding.borrowRuntimeOwnedCoordinatorRecoveryRepository(verified.capability); assert.ok(repository);
              const rejected = instrumented.registerRuntimeOwnedCoordinatorRecoveryResultDelivery({ ...repository, operationId: identity.operationId }, id, () => true);
              assert.equal(rejected.status, 'blocked'); assert.equal(rejected.filesystemEffectIssued, false);
              assert.deepEqual(fs.readFileSync(statePath), fixed); assert.deepEqual(fs.readFileSync(pendingPath), fixed); assert.deepEqual(fs.readFileSync(markerPath), marker);
              assert.deepEqual(fs.readFileSync(path.join(path.dirname(statePath), 'history.jsonl')), fixedHistory);
            } finally { fs.unlinkSync(pendingPath); fs.unlinkSync(markerPath); }
          }
        }
        capability = null;
        for(const file of ['state.pending.json', 'state.lock', 'history.pending.jsonl']) assert.throws(() => fs.lstatSync(path.join(path.dirname(statePath), file)), { code: 'ENOENT' });
        }
      } finally {
        fs.renameSync = rename; fs.openSync = open;
        if(capability && !capabilityReleased) assert.equal(recovery.releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability), true);
        const cleanupObserved = record.observeHostRecoveryCleanup(expectedToken, identity.hostPaths.root);
        if(cleanupObserved.root !== 'absent' || cleanupObserved.marker !== 'absent') {
        let token = expectedToken;
        try { record.loadHostRecoveryRecordByToken(token, identity.hostPaths.root); } catch { token = operation.host.currentToken; }
        const generation = host.acquireHostOperationRecoveryGeneration(token, identity.hostPaths.root);
        assert.ok(generation);
        try {
          if(token === operation.host.currentToken) token = host.confirmOwnedDockerAbsenceForRecovery(token, generation);
          assert.equal(token, expectedToken);
          assert.equal(host.recoverOwnedOperationDirectories(token, generation, identity.hostPaths.root).status, 'recovered');
          assert.throws(() => fs.lstatSync(identity.hostPaths.root), { code: 'ENOENT' });
          assert.throws(() => fs.lstatSync(loaded.marker), { code: 'ENOENT' });
        } finally { assert.equal(host.releaseHostOperationRecoveryGeneration(generation), true); }
        }
      }
      if(process.argv[3] === 'delivery_none') {
        const statePath = path.join(process.cwd(), '.crdd', 'coordinator', 'state.json'), before = fs.readFileSync(statePath);
        const refused = recovery.completeRuntimeOwnedDockerTaskTransientRecovery(capability);
        assert.equal(refused.status, 'blocked'); assert.equal(refused.filesystemEffectIssued, false);
        assert.deepEqual(fs.readFileSync(statePath), before);
        const observed = store.readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(verified.capability, id);
        assert.equal(observed.status, 'blocked');
      }
      process.stdout.write('current_host_storage_verified');
    })().catch(error => { console.error(error); process.exitCode = 1; });`;
