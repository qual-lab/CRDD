/**
 * 隔離Packageの現在Source配置と公開技術入口を確認する。
 *
 * @packageDocumentation
 * @responsibility 旧署名graphに依存せず上位への逆依存を検出する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 固定src配下のliteral import／exportと必要なRoot API。
 * @boundary unknown gateの前提配置。完全なTypeScript解析や敵対Sourceの安全証明ではない。
 */
import type {
  DockerEnvironmentRequest,
  DockerEnvironmentResult,
  ResourceTarget,
  ResourceInspection,
  ResourceCleanupResult,
  IsolationExecution,
} from "../../src/index.ts";
import { restartDockerEnvironment, cleanupIsolation } from "../../src/index.ts";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import type {
  DockerCommandSession,
  DockerIsolationRuntimeOptions,
} from "../../../executor/src/attempt/types.ts";
import { classifyDockerCommandExecution } from "../../src/execution/result.ts";

import type { DockerCommandExecutionClassification } from "../../src/execution/result.ts";
import { createDockerIsolationRuntime } from "../support/execution.ts";

const sourceRoot = path.resolve(import.meta.dirname, "../../src");
const platformAccessRoot = path.resolve(
  sourceRoot,
  "../../platform-access/src/index.ts",
);

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
  const options: DockerIsolationRuntimeOptions = {
    paths: { tmp: "synthetic", management: "synthetic" },
  };
  // @ts-expect-error 所在借用は必須。
  const missing: DockerIsolationRuntimeOptions = {};
  const extra: DockerIsolationRuntimeOptions = {
    ...options,
    // @ts-expect-error 生Process実装を本番構成へ注入しない。
    startProcess: () => null,
  };
  const runtime = createDockerIsolationRuntime(options);
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
  const namespace = await import("../../src/index.ts");
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

/**
 * 相手Packageを解決できない新品ProcessでDIとDomainの独立開始を確認する。
 * @responsibility 型だけでなく間接実行時依存と永続APIの再流入を反証する。
 * @trace ERB-IT-014
 * @precondition 子ProcessではModule読込みと純粋な回復ID解析だけを行う。
 * @stimulus DIではDomain／Coordinatorを、DomainではDIを解決拒否する。
 * @observation 終了値と固定marker。
 * @oracle 両公開Rootが開始でき、DIに記録保存APIがない。
 * @cleanup 子Processの正常close。生成物なし。
 * @boundary 実Docker・Native処置・保存・実AIは実行しない。
 */
test("DIとDomainは相互の実行時依存なしで公開Rootを開始する", () => {
  for (const owner of ["docker-isolation", "domain-model"]) {
    const target = path.resolve(sourceRoot, "../../", owner, "src/index.ts");
    const blocked =
      owner === "docker-isolation"
        ? ["domain-model", "coordinator"]
        : ["docker-isolation"];
    const code = `import { registerHooks } from 'node:module';
      const blocked=${JSON.stringify(blocked)};
      registerHooks({resolve(s,c,next){const r=next(s,c);if(blocked.some(name=>r.url.includes('/'+name+'/')))throw Error('owner_forbidden');return r;}});
      const api=await import(${JSON.stringify(pathToFileURL(target).href)});
      if(${JSON.stringify(owner)}==='docker-isolation'){
        if('writeDockerProbeRecoveryRecord' in api || 'loadDockerProbeRecoveryRecord' in api)throw Error('persistence_exposed');
        if(Object.hasOwn(api,'parseDockerTaskRecoveryId'))throw Error('business_parser_exposed');
      }
      console.log('OWNER_INDEPENDENT');`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", code],
      { encoding: "utf8", timeout: 15000, windowsHide: true },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "OWNER_INDEPENDENT");
  }
});

/**
 * 現在の限定構文から読める依存先を配置契約へ照合する。
 *
 * @responsibility 上位・PA内部・未知bare依存を拒否し未評価のdynamic式を見逃さない。
 * @trace ERB-IT-004
 * @precondition fileは固定Sourceまたはメモリ内負例の所在である。
 * @stimulus literalのimport／再exportとdynamic importを読み取る。
 * @observation 不許可の依存先または非literal dynamicでassertionが失敗する。
 * @oracle Node builtin、同src内、PAの宣言済みRootだけを許可する。
 * @cleanup N/A: 読取りと文字列処理だけ。
 * @boundary 通常Source配置の回帰であり任意TypeScript構文の完全検査ではない。
 */
function assertDependencyBoundary(file: string, text: string) {
  // 既存Command結合が使う一つの技術記述型だけを許可し、値依存は許可しない。
  text = text.replace(
    /\bimport type\s*\{\s*ProviderAdvicePlan\s*\}\s*from\s*["']([^"']+)["'];/gu,
    (statement, specifier: string) =>
      path.resolve(path.dirname(file), specifier) ===
      path.resolve(sourceRoot, "../../ai-adapter/src/index.ts")
        ? ""
        : statement,
  );
  for (const match of text.matchAll(/\bimport\s*\(([^)]*)\)/gu)) {
    assert.match(
      match[1]?.trim() ?? "",
      /^(?:"[^"\\\r\n]*"|'[^'\\\r\n]*')$/u,
      "nonliteral_dynamic_import",
    );
  }
  for (const match of text.matchAll(
    /(?<![.\w])\b(?:from|import)\s*(?:\(\s*)?["']([^"'\r\n]+)["']/gu,
  )) {
    const specifier = match[1];
    assert.ok(specifier);
    if (isBuiltin(specifier)) continue;
    assert.ok(specifier.startsWith("."), `unknown_dependency:${specifier}`);
    const resolved = path.resolve(path.dirname(file), specifier);
    const relative = path.relative(sourceRoot, resolved);
    assert.ok(
      resolved === platformAccessRoot ||
        (relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)),
      `dependency_outside_owner:${specifier}`,
    );
  }
}

/**
 * 固定Source全数を同じ判定へ渡す。
 *
 * @responsibility 負例だけでなく現在の実Sourceへ配置契約を適用する。
 * @trace ERB-IT-004
 * @precondition 現在Checkoutのsrcを読める。
 * @stimulus Directoryを列挙し各TypeScriptファイルを読み取る。
 * @observation 全対象が同じ判定を通る。
 * @oracle linkやSourceなしを正常母集団としない。
 * @cleanup N/A: ファイル作成・Process起動なし。
 * @boundary 現行Source→限定依存検査。
 */
test("隔離Sourceは同Packageと宣言済みPackage RootとNode builtinだけを参照する", () => {
  const pending = [sourceRoot];
  let files = 0;
  while (pending.length) {
    const directory = pending.pop();
    assert.ok(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, file);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.isFile() && entry.name.endsWith(".ts")) {
        assertDependencyBoundary(file, fs.readFileSync(file, "utf8"));
        files += 1;
      }
    }
  }
  assert.ok(files > 0);
});

/**
 * 通常の依存構文と逆依存の反例を確認する。
 *
 * @responsibility type-onlyや再exportを名前だけで許可しない。
 * @trace ERB-IT-004
 * @precondition メモリ内Sourceだけを使う。
 * @stimulus 正常四形と上位・PA内部・未知module・非literalを渡す。
 * @observation 正常の受理と各反例の指定理由による拒否。
 * @oracle 全反例が例外を起こし現在Sourceへの判定と同じ関数を使用する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary import先の配置検査。実Moduleの安全性は主張しない。
 */
test("逆依存・PA内部参照・未知module・非literalの取りこぼしを拒否する", () => {
  const file = path.join(sourceRoot, "index.ts");
  for (const text of [
    'import fs from "node:fs";',
    'import type { Value } from "./execution/plan.ts";',
    'export { Value } from "../../platform-access/src/index.ts";',
    'import type { ProviderAdvicePlan } from "../../ai-adapter/src/index.ts";',
    'const selected = import("./execution/plan.ts");',
    'const marker = Buffer.from("CRDDDR06");',
  ])
    assert.doesNotThrow(() => assertDependencyBoundary(file, text));
  for (const owner of [
    "coordinator",
    "domain-model",
    "orchestrator",
    "ai-adapter",
    "workbench-server",
    "mcp-server",
  ]) {
    const target = `../../${owner}/src/index.ts`;
    for (const text of [
      `import type { Value } from "${target}";`,
      `export { Value } from "${target}";`,
      `const selected = import("${target}");`,
    ])
      assert.throws(
        () => assertDependencyBoundary(file, text),
        /dependency_outside_owner/u,
      );
  }
  for (const specifier of [
    "../../platform-access/src/process/environment.ts",
    "../../domain-model/src/attempt/validation.ts",
    "../../../../outside.ts",
  ])
    assert.throws(
      () =>
        assertDependencyBoundary(file, `import { Value } from "${specifier}";`),
      /dependency_outside_owner/u,
    );
  for (const specifier of ["node:not-a-real-module", "unknown-package"]) {
    assert.throws(
      () =>
        assertDependencyBoundary(file, `import { Value } from "${specifier}";`),
      /unknown_dependency/u,
    );
  }
  for (const expression of [
    "variable",
    '"./execution/" + variable',
    'condition ? "./execution/plan.ts" : variable',
    '("./execution/plan.ts")',
    '"./execution/plan.ts", { with: {} }',
    '"./execution/command\\u002dplan.ts"',
  ])
    assert.throws(
      () =>
        assertDependencyBoundary(
          file,
          `const selected = import(${expression});`,
        ),
      /nonliteral_dynamic_import/u,
    );
});

/**
 * 必要な技術入口がPackage Rootに実公開されていることを確認する。
 *
 * @responsibility Source中の同名文字列だけで公開成立としない。
 * @trace ERB-IT-004
 * @precondition 現行RootのES Moduleを読み込む。
 * @stimulus 上位が使う実行・認証・回収・attach入口を取得する。
 * @observation 各exportが実関数である。
 * @oracle API欠測を配置検査の成功で補完しない。
 * @cleanup N/A: 関数は呼び出さず外部Effectを発行しない。
 * @boundary 公開APIの存在だけで実Dockerの成立は主張しない。
 */
test("必要な隔離技術APIは公開し内部生成Primitiveは公開しない", async () => {
  const namespace = await import("../../src/index.ts");
  for (const name of [
    "prepareIsolation",
    "executeIsolation",
    "cleanupIsolation",
    "inspectIsolation",
    "describeIsolationConfiguration",
  ] as const)
    assert.equal(typeof namespace[name], "function", name);
  for (const name of [
    "createDockerIsolationRuntime",
    "createDockerAuthenticationRuntimeFactory",
    "createDockerProbeContainer",
    "runDockerProbeAsync",
    "runDockerProbeCancellation",
    "startDockerProbeResidue",
    "observeExpectedDockerResource",
    "discoverSubmittedDockerResource",
    "observeSubmittedDockerResourceAbsent",
    "startOwnedWindowsProcess",
    "createDockerIsolationRuntimeCandidate",
    "createDockerAuthenticationRuntimeUsing",
    "createDockerAuthenticationRuntime",
    "startDockerProbeAttachedProcess",
    "describeDockerProviderAssets",
    "describeDockerProviderExecutionLocations",
    "describeDockerProxyTopology",
    "prepareDockerNetworkPolicy",
    "startOwnedAttachTerminationFixture",
    "executeDockerProbeCommand",
    "planDockerProbeCommand",
    "classifyDockerProbeExecution",
    "classifyDockerProbeCancellation",
    "normalizeContainerCreation",
    "normalizeContainerAbsence",
    "cleanupResourceSet",
  ])
    assert.equal(Object.hasOwn(namespace, name), false, name);
});

/**
 * 固定Probeの公開記述が移管前の技術値を維持することを確認する。
 * @responsibility Image正本の再利用と公開利用側の互換性を独立期待値で照合する。
 * @trace ERB-IT-004
 * @precondition 公開Rootの純粋記述だけを使用する。
 * @stimulus 合成相関IDを渡す。
 * @observation Image・名前・Label・Engine・profileと旧型公開の不在を読む。
 * @oracle 固定期待値と一致し、旧試験型を製品Rootに残さない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary 実Docker・AIを呼び出さない。
 */
test("固定Probe記述は共通Image正本へ移しても公開値を維持する", async () => {
  const { describeIsolationConfiguration } = await import("../../src/index.ts");
  assert.deepEqual(describeIsolationConfiguration(), {
    image:
      "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
    engine: "docker_desktop_linux_named_pipe",
    runtimeProfile: {
      backend: "docker_desktop_linux",
      endpoint: "local_named_pipe",
      dockerCliTrust:
        "fixed_path_valid_windows_authenticode_docker_inc_and_operation_snapshot",
      imagePinnedByDigest: true,
      networkMode: "none",
    },
  });
  const source = fs.readFileSync(path.join(sourceRoot, "index.ts"), "utf8");
  assert.doesNotMatch(source, /\bDockerIsolationRuntime(?:Plan)?\b/u);
});

/**
 * 共通公開型の相関と、対象ごとの同期性を型の反例で固定する。
 * @responsibility Unionでmode/inputを交差させず、観測入力を廃棄へ流用しない。
 * @trace ERB-IT-004
 * @precondition 共通Root型だけから三資源と二環境modeを構成する。
 * @stimulus 正例とts-expect-errorによる用途違いの代入を型検査する。
 * @observation 型検査成功、負例の拒否と関数値の存在。
 * @oracle 元Promise・同期Container結果・Snapshot Handleの相関を保持する。
 * @cleanup N/A: 検査関数は呼ばず実操作を発行しない。
 * @boundary 型契約のみ。実Dockerの成功を主張しない。
 */
test("共通公開型はmode・資源・操作と戻り値の対応を維持する", () => {
  const verify = (
    restart: DockerEnvironmentRequest<"restart">,
    repair: DockerEnvironmentRequest<"repair">,
    directory: ResourceTarget<"directory", "inspect">,
    disposal: ResourceTarget<"directory", "cleanup">,
    container: ResourceTarget<"container">,
    snapshot: ResourceTarget<"snapshot">,
  ) => {
    const selected: DockerEnvironmentRequest = repair;
    // @ts-expect-error restartへrepair入力を混ぜない。
    const mixed: DockerEnvironmentRequest = {
      mode: "restart",
      input: repair.input,
    };
    // @ts-expect-error 未知modeの契約はない。
    const unknown: DockerEnvironmentRequest<"unknown"> = restart;
    // @ts-expect-error 観測用Directory入力は廃棄許可を持たない。
    const wrongDisposal: ResourceTarget<"directory", "cleanup"> = directory;
    // @ts-expect-error Container入力をSnapshot入力にしない。
    const wrongSnapshot: ResourceTarget<"snapshot"> = container;
    const restarted: Promise<DockerEnvironmentResult<"restart">> =
      restartDockerEnvironment(restart);
    const repaired: Promise<DockerEnvironmentResult<"repair">> =
      restartDockerEnvironment(repair);
    const disposed: Promise<ResourceCleanupResult<"directory">> =
      cleanupIsolation(disposal);
    const cleaned: ResourceCleanupResult<"container"> =
      cleanupIsolation(container);
    const running: IsolationExecution = cleanupIsolation(snapshot);
    const observed: ResourceInspection<"directory"> = null;
    // @ts-expect-error Container回収を非同期結果と偽らない。
    const wrongPromise: Promise<ResourceCleanupResult<"container">> =
      cleanupIsolation(container);
    void [
      selected,
      mixed,
      unknown,
      wrongDisposal,
      wrongSnapshot,
      restarted,
      repaired,
      disposed,
      cleaned,
      running,
      observed,
      wrongPromise,
    ];
  };
  assert.equal(typeof verify, "function");
});
