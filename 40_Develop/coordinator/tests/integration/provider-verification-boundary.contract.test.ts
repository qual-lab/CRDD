/**
 * Executorと上位の保存・検証接続を確認する。
 * @responsibility 単段Hostの構成と検証ToolのSource・Symbol接続を照合する。
 * @trace ERB-IT-004
 * @level IT
 * @boundary Sourceの読取りのみ。実AI・Docker・保存物は操作しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
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
  const root = new URL("../../../executor/src/", import.meta.url);
  for (const entry of fs.readdirSync(root, { recursive: true })) {
    if (!String(entry).endsWith(".ts")) continue;
    const source = fs.readFileSync(
      new URL(String(entry).replaceAll("\\", "/"), root),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /(?:from\s*|import\s*\()["'][^"']*(?:coordinator|domain-model|document-model|execution-model|configuration-model)\//,
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
  // 旧settlement Adapterは退役済み。元の終了観測を所有するoperationを確認する。
  for (const name of ["persistence", "operation", "recovery", "controller"]) {
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
      ...source.matchAll(
        /["'](\.\.\/\.\.\/executor\/tests\/support\/[^"']+)["']/gu,
      ),
    ].map((match) => match[1]);
    assert.deepEqual(
      fixtureImports,
      name === "verify-provider-real"
        ? [
            "../../executor/tests/support/task-trial.ts",
            "../../executor/tests/support/task-trial.ts",
          ]
        : [],
    );
    assert.doesNotMatch(
      source.replaceAll(
        "../../executor/tests/support/task-trial.ts",
        "fixed-task-fixture",
      ),
      /tests\/support/,
    );
  }
  const fixture = fs.readFileSync(
    new URL("../../../executor/tests/support/task-trial.ts", import.meta.url),
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
    new URL(
      "../../../executor/scripts/verify-provider-attempt.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    candidate,
    /production_factory|createExecutorLifecycleTestRuntime/,
  );
  const testAdapter = fs.readFileSync(
    new URL("../../../executor/scripts/executor-test.ts", import.meta.url),
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
  for (const pkg of ["executor", "docker-isolation", "coordinator"]) {
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
