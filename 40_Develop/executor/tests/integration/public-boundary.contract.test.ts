/**
 * Coordinatorを読み込めない環境で単段Executorの公開境界を確認する。
 * @packageDocumentation
 * @responsibility 独立ロード・不正開始の無Effect拒否と私有Ownerの非公開を検査する。
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
