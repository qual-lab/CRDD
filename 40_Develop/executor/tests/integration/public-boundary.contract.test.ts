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
import fs from "node:fs";
import { spawnSync } from "node:child_process";
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
  assert.match(publicSource, /\bAttemptRequest\b/);
  assert.doesNotMatch(publicSource, /\bRecoveryStartFailureDiagnostic\b/);
  const executionSource = fs.readFileSync(
    new URL("../../src/attempt/execute.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(executionSource, /reportPassiveBoundaryDiagnostic/);
  const functionPositions = [
    "export async function cancel(",
    "export function abandon(",
    "export function createExecutor(",
    "function prepareAttempt(",
  ].map((name) => executionSource.indexOf(name));
  assert.ok(
    functionPositions.every(
      (position, i) =>
        position >= 0 &&
        (i === 0 || position > (functionPositions[i - 1] ?? Infinity)),
    ),
  );
  for (const file of ["attempt/types.ts", "attempt/constants.ts"]) {
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
    /export type \{[^}]*\bExecutorCallbacks\b[^}]*\} from "\.\/attempt\/types\.ts"/,
  );
  assert.equal(
    fs.existsSync(new URL("../../src/result/", import.meta.url)),
    false,
  );
  assert.deepEqual(
    fs.readdirSync(new URL("../../src/attempt/", import.meta.url)).sort(),
    [
      "constants.ts",
      "execute.ts",
      "isolation.ts",
      "result.ts",
      "types.ts",
      "validation.ts",
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
    const isolation=await import(${JSON.stringify(new URL("../../src/attempt/isolation.ts", import.meta.url).href)});
    assert.equal('describeIsolationContract' in isolation,false);
    assert.equal('isPlanValid' in isolation,false);
    assert.equal('providerBoundaryConfiguration' in isolation,false);
    blockDomain=false; // 試験Hostの保存は上位fixtureが所有する。
    assert.deepEqual(Object.keys(api).sort(), [
      "createExecutor",
    ].sort());
    for(const name of ["inspectAttemptObservation", "normalizeTaskResult", "normalizeAdviceResult", "describeAdviceResultSchema",
      "consumeTaskRemediation", "hashAdviceCommand", "bindAdviceCommand",
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
 * @responsibility 有限Command代役と実Controller・DI sessionの正常・取消・不明を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 新品子ProcessでCoordinatorの解決を禁止する。
 * @stimulus 候補と本番Factory配線の各構成で正常、wait中取消、清掃不明、同期通知保存例外を実行する。
 * @observation 九purposeの順序、開始・wait・終了回数、元通知と終端相関。
 * @oracle 取消はjoinと清掃まで未完了、不明はexact回復参照保持、コピー・別Ownerは拒否。
 * @cleanup 全completionと子Process終了後、自己生成Rootを確認・通常削除して不存在を確認する。
 * @boundary 候補生涯・本番Factory配線・試験fixtureの排他とイベントcommit。本番Host/Home排他・保存、実Dockerは未検証。
 */
test("Executor単独の候補・本番Factory配線は四つの終了条件と元Ownerを維持する", () => {
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
