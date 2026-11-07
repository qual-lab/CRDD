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
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { verifyStandaloneProviderAttempt } from "../../scripts/verify-provider-attempt.ts";

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
      if(blockDomain&&resolved.url.includes('/domain-model/'))throw Error('domain_unavailable');
      return resolved;
    }});
    const api=await import(${JSON.stringify(root)});
    const isolation=await import(${JSON.stringify(new URL("../../src/lifecycle/attempt.ts", import.meta.url).href)});
    assert.equal('describeIsolationContract' in isolation,false);
    assert.equal('isPlanValid' in isolation,false);
    assert.equal('providerBoundaryConfiguration' in isolation,false);
    blockDomain=false; // 試験Hostの保存は上位fixtureが所有する。
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
    await import(${JSON.stringify(new URL("../../../domain-model/src/index.ts", import.meta.url).href)});
    await import(${JSON.stringify(new URL("../../../version-control/src/index.ts", import.meta.url).href)});
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
 * 本番SourceのOwner境界を検査する。
 * @responsibility 逆依存・二重観測Owner・生状態の公開を防ぐ。
 * @trace ERB-IT-004
 * @precondition Sourceだけを読む。
 * @stimulus Executor閉包とCoordinatorの保存三利用側を照合する。
 * @observation import経路と固定Factoryの生成箇所。
 * @oracle Coordinator逆依存なし、Host側Factory一回、保存利用側からExecutor逆照会なし。
 * @cleanup N/A: Source読取りのみ。
 * @boundary Source依存の契約。動的資源不存在の証明には使わない。
 */
test("固定Host接続は一つであり保存利用側はExecutorへ逆照会しない", () => {
  const root = new URL("../../src/", import.meta.url);
  for (const entry of fs.readdirSync(root, { recursive: true })) {
    if (!String(entry).endsWith(".ts")) continue;
    const source = fs.readFileSync(
      new URL(String(entry).replaceAll("\\", "/"), root),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /(?:from\s*|import\s*\()["'][^"']*(?:coordinator|domain-model)\//,
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
  assert.equal([...composition.matchAll(/createExecutor\(/g)].length, 1);
  const coordinatorSource = new URL(
    "../../../coordinator/src/",
    import.meta.url,
  );
  for (const file of fs.readdirSync(coordinatorSource, { recursive: true })) {
    if (typeof file !== "string" || !file.endsWith(".ts")) continue;
    const source = fs.readFileSync(
      new URL(file.replaceAll("\\", "/"), coordinatorSource),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /(?:from\s*|import\s*\()["'][^"']*executor\/src\/(?!index\.ts["'])/,
      file,
    );
  }
  for (const name of ["persistence", "settlement", "recovery", "controller"]) {
    const source = fs.readFileSync(new URL(`${name}.ts`, coordinator), "utf8");
    if (name === "controller") assertProviderExecutorConsumer(source, name);
    else
      assert.doesNotMatch(source, /from\s+["'][^"']*provider-executor\.ts["']/);
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
/** 実AI用Toolは製品公開入口だけを実行経路とし、管理情報は現存Sourceへ接続する。 @trace ERB-IT-004 */
test("実試験ToolとSymbol管理情報は現行Sourceへ接続する", () => {
  for (const name of ["verify-provider-real", "provider-attempt-host"]) {
    const source = fs.readFileSync(
      new URL("../../scripts/" + name + ".ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /executor-test|createDockerIsolationRuntime|startDockerCommandSessionCandidate/,
    );
    const fixtureImports = [
      ...source.matchAll(/["'](\.\.\/tests\/support\/[^"']+)["']/gu),
    ].map((match) => match[1]);
    assert.deepEqual(
      fixtureImports,
      name === "verify-provider-real"
        ? ["../tests/support/task-trial.ts", "../tests/support/task-trial.ts"]
        : [],
    );
    assert.doesNotMatch(
      source.replaceAll("../tests/support/task-trial.ts", "fixed-task-fixture"),
      /tests\/support/,
    );
  }
  const fixture = fs.readFileSync(
    new URL("../support/task-trial.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    fixture,
    /executor-test|mock\.|registerHooks|createExecutor|createDockerIsolationRuntime|startDockerCommandSessionCandidate/,
  );
  assert.deepEqual(
    [...fixture.matchAll(/from ["']([^"']+)["']/gu)].map((match) => match[1]),
    [
      "node:crypto",
      "node:fs",
      "node:path",
      "../../../ai-adapter/src/index.ts",
      "../../../docker-isolation/src/index.ts",
      "../../src/index.ts",
    ],
  );
  const candidate = fs.readFileSync(
    new URL("../../scripts/verify-provider-attempt.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    candidate,
    /production_factory|createExecutorLifecycleTestRuntime/,
  );
  const testAdapter = fs.readFileSync(
    new URL("../../scripts/executor-test.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    testAdapter,
    /export function createExecutorLifecycleTestRuntime/,
  );
  const host = fs.readFileSync(
    new URL("../../scripts/provider-attempt-host.ts", import.meta.url),
    "utf8",
  );
  assert.match(host, /createExecutor\(request,/);
  assert.doesNotMatch(host, /acquireLock/);
  for (const pkg of ["executor", "docker-isolation"]) {
    const root = new URL("../../../" + pkg + "/", import.meta.url);
    const manifest = JSON.parse(
      fs.readFileSync(new URL("symbol.json", root), "utf8"),
    ) as { symbols: { symbolId: string; path: string }[] };
    const ids = new Set<string>();
    for (const symbol of manifest.symbols) {
      assert.equal(ids.has(symbol.symbolId), false, symbol.symbolId);
      ids.add(symbol.symbolId);
      assert.equal(
        fs.statSync(new URL(symbol.path, root)).isFile(),
        true,
        pkg + ":" + symbol.symbolId,
      );
    }
  }
});
