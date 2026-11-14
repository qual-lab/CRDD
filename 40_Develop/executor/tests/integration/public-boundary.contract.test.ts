/**
 * Coordinatorを読み込めない環境で単段Executorの公開境界を確認する。
 * @packageDocumentation
 * @responsibility 独立ロード・有限代役上の単段生涯と私有Ownerの非公開を検査する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope Source、新品子Processと自己生成のRepository-local試験領域。Docker・AI・既存保存領域は利用しない。
 * @boundary Executor公開RootとCoordinatorの依存方向。
 */
import type { DockerCommandExecutionClassification } from "../../../docker-isolation/src/execution/result.ts";
import { classifyDockerCommandExecution } from "../../../docker-isolation/src/execution/result.ts";
import type { DockerCommandSession } from "../../../docker-isolation/tests/support/session.ts";
import { createDockerIsolationRuntime } from "../support/isolation-execution.ts";

const ISOLATION_SETTINGS = Object.freeze({
  windowsDirectory: "C:\\Windows",
  userHomeDirectory: "C:\\Users\\test",
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { verifyStandaloneProviderAttempt } from "../../scripts/verify-provider-attempt.ts";

/**
 * 技術試験領域の失敗観測はモデル保存例外へ依存しない。
 * @responsibility 上位Module解決禁止の下で全失敗情報とEffect前停止を確認する。
 * @trace ERB-IT-002
 * @precondition 新品NodeでEM／Coordinatorの読込みと書込み／Process起動を拒否する。
 * @stimulus ready、null、Effect不明のblocked結果を渡す。
 * @observation readyの同参照、標準Errorのcause、拒否されたEffect回数。
 * @oracle 元結果の全fieldとexact回復参照を保持し、Effectを発行しない。
 * @cleanup 子Process終了のみ。Filesystem上の試験物は作らない。
 * @boundary 技術補助と単独検証入口の読込み。モデル記録／CLI搬送は別の接続検証で確認する。
 */
test("試験領域の技術補助はEMなしで全失敗観測を保持する", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import cp from 'node:child_process';
      import {registerHooks,syncBuiltinESMExports} from 'node:module';
      registerHooks({resolve(s,c,n){const r=n(s,c);
        if(['/execution-model/','/coordinator/'].some(part=>r.url.includes(part)))throw Error('upper_owner_forbidden');
        return r;
      }});
      let effects=0;
      const forbidden=()=>{effects++;throw Error('effect_forbidden');};
      for(const name of ['writeFileSync','mkdirSync','mkdtempSync','rmSync','unlinkSync'])fs[name]=forbidden;
      for(const name of ['spawn','spawnSync','fork','exec','execSync','execFile','execFileSync'])cp[name]=forbidden;
      syncBuiltinESMExports();
      const api=await import(${JSON.stringify(new URL("../../scripts/runtime-data.ts", import.meta.url).href)});
      await import(${JSON.stringify(new URL("../../scripts/verify-provider-attempt.ts", import.meta.url).href)});
      await import(${JSON.stringify(new URL("../../scripts/verify-provider-home.ts", import.meta.url).href)});
      const ready=Object.freeze({status:'ready',repositoryRoot:'not-used',directory:'not-used'});
      assert.equal(api.requireReadyRepositoryRuntimeDataArea(ready,'invalid'),ready);
      assert.throws(()=>api.requireReadyRepositoryRuntimeDataArea(null,'invalid'),{message:'invalid'});
      const failure=Object.freeze({status:'blocked',reason:'repository_runtime_data_ignore_registration_blocked',
        effectIssued:true,effectStateUnknown:true,effectConfirmation:'unknown',cleanupConfirmed:false,
        retryAllowed:false,recoveryReference:'runtime-data.fixture-exact-reference',repositoryPathReported:false});
      assert.throws(()=>api.requireReadyRepositoryRuntimeDataArea(failure,'invalid'),error=>{
        assert.equal(error.constructor,Error);
        assert.equal(error.message,failure.reason);
        assert.equal(error.cause,failure);
        assert.deepEqual(error.cause,failure);
        return true;
      });
      assert.equal(effects,0);
      `,
    ],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

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
  const publicSource = fs.readFileSync(
    new URL("../../src/index.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(publicSource, /\b(?:AttemptPlan|AttemptReference)\b/);
  assert.match(publicSource, /\bExecutorRequest\b/);
  const publicTypes = [
    ...publicSource.matchAll(/export type\s*\{([^}]+)\}/g),
  ].flatMap((match) => (match[1] ?? "").split(",").map((name) => name.trim()));
  for (const removed of [
    "DockerRuntimeRepairInput",
    "DockerRuntimeRepairResult",
    "DockerRuntimeRestartInput",
    "DockerRuntimeRestartResult",
    "RepairInput",
    "RepairResult",
    "RestartInput",
    "RestartResult",
    "CancelInput",
  ])
    assert.equal(publicTypes.includes(removed), false, removed);
  for (const retained of [
    "DockerEnvironmentRestartEvent",
    "DockerEnvironmentResult",
    "RecordProjection",
    "AttemptCancelInput",
    "CancelArguments",
  ])
    assert.equal(publicTypes.includes(retained), true, retained);
  assert.doesNotMatch(publicSource, /\bRecoveryStartFailureDiagnostic\b/);
  const executionSource = fs.readFileSync(
    new URL("../../src/lifecycle/attempt.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(executionSource, /reportPassiveBoundaryDiagnostic/);
  const functionPositions = [
    "export async function cancel(",
    "export function abandon(",
    "export function createAttemptExecutor(",
    "function prepareAttempt(",
  ].map((name) => executionSource.indexOf(name));
  assert.ok(
    functionPositions.every(
      (position, i) =>
        position >= 0 &&
        (i === 0 || position > (functionPositions[i - 1] ?? Infinity)),
    ),
  );
  for (const file of ["lifecycle/types.ts", "lifecycle/attempt.ts"]) {
    const source = fs.readFileSync(
      new URL(`../../src/${file}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /RecoveryStartFailureDiagnostic|RECOVERY_START_FAILURE_STAGES|coordinator_provider_recovery_start_failed/,
    );
  }
  assert.equal(
    fs.existsSync(new URL("../../src/attempt/preparation.ts", import.meta.url)),
    false,
  );
  assert.match(
    publicSource,
    /export type \{[^}]*\bExecutorCallbacks\b[^}]*\} from "\.\/lifecycle\/types\.ts"/,
  );
  assert.equal(
    fs.existsSync(new URL("../../src/result/", import.meta.url)),
    false,
  );
  assert.deepEqual(
    fs.readdirSync(new URL("../../src/lifecycle/", import.meta.url)).sort(),
    [
      "attempt.ts",
      "authentication.ts",
      "cleanup.ts",
      "execute.ts",
      "probe.ts",
      "types.ts",
    ],
  );
  assert.doesNotMatch(
    publicSource,
    /\b(?:AdviceInput|TaskInput|AdvicePacket|TaskPacket|AdviceResultItem)\b/,
  );
  const root = new URL("../../src/index.ts", import.meta.url).href;
  const verification = new URL(
    "../../scripts/verify-provider-attempt.ts",
    import.meta.url,
  ).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    let blockDomain=true;
    registerHooks({resolve(s,c,n){
      const resolved=n(s,c);
      if(resolved.url.includes('/coordinator/'))throw Error('coordinator_unavailable');
      if(blockDomain&&['domain','document','execution','configuration'].some(name=>resolved.url.includes('/'+name+'-model/')))throw Error('domain_unavailable');
      return resolved;
    }});
    const api=await import(${JSON.stringify(root)});
    const isolation=await import(${JSON.stringify(new URL("../../src/lifecycle/attempt.ts", import.meta.url).href)});
    assert.equal('describeIsolationContract' in isolation,false);
    assert.equal('isPlanValid' in isolation,false);
    assert.equal('providerBoundaryConfiguration' in isolation,false);
    assert.deepEqual(Object.keys(api).sort(), [
      "createExecutor",
      "inspectDockerEnvironment",
      "restartDockerEnvironment",
      "inspectResources",
      "cleanupResources",
    ].sort());
    for(const name of ["inspectAttemptObservation", "normalizeTaskResult", "normalizeAdviceResult", "describeAdviceResultSchema",
      "consumeTaskRemediation", "hashAdviceCommand", "bindAdviceCommand", "prepareAdviceCommand", "PreparedAdviceCommand",
      "createProviderExecutor", "ProviderExecutorHost", "ownDataValue",
      "buildProviderDockerExecutionPlan", "prepareAttempt", "validatePlan", "planIdentity",
      "resolveIsolationCommandInput", "isAttemptPlanValid", "createConfigurationNotice", "PURPOSES", "SETUP_COMMAND_FAILURE_REASONS",
      "ATTEMPT_OBSERVATION_KEYS", "ADVICE_INPUT_CONTRACT", "ADVICE_INPUT_CONTRACT_REVISION",
      "captureAllowedReferences", "inspectAttemptSelection", "parseModelSelection", "copyPlainDataRecord", "readOwnDataProperty", "ATTEMPT_COMPLETION_REASONS",
      "ADVICE_RESULT_CONTRACT", "ADVICE_RESULT_CONTRACT_REVISION"])
      assert.equal(name in api,false,name);
    for(const name of ['createProviderObservationOwner','createProviderAttemptRuntime','registerSubmission','registerTerminal'])
      assert.equal(name in api,false,name);
    let calls=0;
    const dependencies=new Proxy({}, {get(){return ()=>{calls++;throw Error('unexpected_effect');};}});
    const testing=await import(${JSON.stringify(new URL("../../scripts/executor-test.ts", import.meta.url).href)});
    const runtime=testing.createExecutorTestCandidate(dependencies);
    assert.equal(runtime.start(null,null).status,'blocked');
    assert.equal((await runtime.cancel(null,null)).status,'blocked');
    assert.equal(calls,0);
    for (const name of ['verifyProviderSubmissionNotice','verifyUnissuedNotice','borrowTerminalObservations'])
      assert.equal(name in runtime,false,name);
    // 名前付き領域APIの依存Sourceを先にロードし、以下ではTool自体のimport Effectを検査する。
    await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
    await import(${JSON.stringify(new URL("../../scripts/runtime-data.ts", import.meta.url).href)});
    const {default:fs}=await import('node:fs');
    const {default:childProcess}=await import('node:child_process');
    const {syncBuiltinESMExports}=await import('node:module');
    const {fileURLToPath}=await import('node:url');
    let effects=0;
    const originalOpen=fs.openSync,originalClose=fs.closeSync,loaderDescriptors=new Set();
    fs.openSync=(name,flags,...rest)=>{
      const sourceName=name instanceof URL?fileURLToPath(name):name;
      if(sourceName===fileURLToPath(${JSON.stringify(verification)})&&(flags==='r'||flags===0)){
        const descriptor=originalOpen(name,flags,...rest);loaderDescriptors.add(descriptor);return descriptor;
      }
      effects++;throw Error('import_effect_forbidden');
    };
    fs.closeSync=descriptor=>{
      if(loaderDescriptors.delete(descriptor))return originalClose(descriptor);
      effects++;throw Error('import_effect_forbidden');
    };
    for(const [object,methods] of [[fs,['writeFileSync','mkdirSync','mkdtempSync','rmSync','unlinkSync']],
      [childProcess,['spawn','spawnSync','execFile','execFileSync','fork']]])
      for(const method of methods)object[method]=()=>{effects++;throw Error('import_effect_forbidden');};
    syncBuiltinESMExports();
    const verification=await import(${JSON.stringify(verification)});
    assert.equal(typeof verification.verifyStandaloneProviderAttempt,'function');
    assert.equal(effects,0);
    assert.equal(loaderDescriptors.size,0);
    registerHooks({load(url,context,next){
      const loaded=next(url,context);
      if(url.startsWith(${JSON.stringify(verification)}+'?mutation=')){
        const method=new URL(url).searchParams.get('mutation');
        assert.ok(['openSync','unlinkSync'].includes(method));
        return {...loaded,source:String(loaded.source)+'\\nfs.'+method+'("not-accessed","wx");'};
      }
      return loaded;
    }});
    for(const method of ['openSync','unlinkSync'])
      await assert.rejects(import(${JSON.stringify(verification)}+'?mutation='+method),/import_effect_forbidden/);
    assert.equal(effects,2);
    assert.equal(loaderDescriptors.size,0);
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
 * @responsibility 局所候補Oracleの正常・取消・不明を確認し、本番Factoryの成立根拠と区別する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 新品子ProcessでCoordinatorの解決を禁止する。
 * @stimulus 局所候補で正常、wait中取消、清掃不明、同期通知保存例外を実行する。
 * @observation 九purposeの順序、開始・wait・終了回数、元通知と終端相関。
 * @oracle 取消はjoinと清掃まで未完了、不明はexact回復参照保持。一回消費・別管理参照の取消拒否・終了後取消拒否を確認する。
 * @cleanup 全completionと子Process終了後、自己生成Rootを確認・通常削除して不存在を確認する。
 * @boundary 候補生涯・試験fixtureの排他とイベントcommit。本番Host/Home排他・保存、実Dockerは未検証。
 */
test("Executorの局所候補Oracleは四つの終了条件と元Ownerを維持する", () => {
  verifyStandaloneProviderAttempt();
});

/**
 * 型だけの公開追加と元の入力拒否・分類を照合する。
 * @responsibility 構成の必須／任意と、未観測結果のkey不在を保持する。
 * @trace ERB-IT-004
 * @precondition 外部操作は開始しない。
 * @stimulus 正常構成、欠測、余剰、Proxyと期限超過を渡す。
 * @observation 型負例、既存例外と分類のexact key。
 * @oracle 型の明示化はRuntime公開・拒否規則を変更しない。
 * @cleanup N/A: Factory構成と純粋判定のみ。
 */
test("隔離の明示契約は必須構成と未観測分類を保持する", async () => {
  type RuntimeOptions = Parameters<typeof createDockerIsolationRuntime>[0];
  const options: RuntimeOptions = {
    settings: ISOLATION_SETTINGS,
    paths: { tmp: "synthetic", management: "synthetic" },
  };
  // @ts-expect-error 所在借用は必須。
  const missing: RuntimeOptions = {};
  const extra: RuntimeOptions = {
    ...options,
    // @ts-expect-error 生Process実装を本番構成へ注入しない。
    startProcess: () => null,
  };
  const runtime = createDockerIsolationRuntime(options);
  const normalRelease: Extract<
    ReturnType<typeof runtime.acquireHomeLease>,
    { status: "acquired" }
  >["lock"]["release"] = () => true;
  assert.equal(normalRelease(), true);
  // @ts-expect-error Homeの解放契約からLock File保持を指示できない。
  normalRelease(true);
  assert.deepEqual(
    Object.keys(runtime).sort(),
    [
      "acquireHomeLease",
      "startCommand",
      "startExecution",
      "cleanupOwnedResources",
      "verifyCleanupOutcome",
    ].sort(),
  );
  assert.throws(() => createDockerIsolationRuntime(missing), /input_invalid/);
  assert.throws(() => createDockerIsolationRuntime(extra), /input_invalid/);
  assert.throws(
    () => createDockerIsolationRuntime(new Proxy(options, {})),
    /input_invalid/,
  );
  const deadline: DockerCommandExecutionClassification =
    classifyDockerCommandExecution(null);
  assert.deepEqual(deadline, { category: "deadline_exceeded" });
  assert.deepEqual(
    classifyDockerCommandExecution({
      status: 0,
      signal: null,
      stdout: "x",
      stderr: "",
      outputExceeded: false,
    }),
    { category: "completed", stdoutBytes: 1, stderrBytes: 0 },
  );
  const session: DockerCommandSession = {
    cancel: async () => ({
      cancellationRequested: true,
      processTerminationObserved: false,
    }),
    completion: new Promise(() => {}),
  };
  // @ts-expect-error 試験表示は通常Sessionの契約に含めない。
  const candidateFlag = session.productionAuthority;
  assert.equal(Object.hasOwn(session, "productionAuthority"), false);
  const namespace = await import("../../../docker-isolation/src/index.ts");
  for (const name of [
    "DockerIsolationRuntimeOptions",
    "DockerIsolationRuntime",
    "DockerCommandSession",
    "DockerCommandSessionResult",
    "DockerCommandExecutionClassification",
    "DockerProcessExitStatusClass",
  ])
    assert.equal(Object.hasOwn(namespace, name), false, name);
  void candidateFlag;
});
