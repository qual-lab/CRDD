/**
 * 検査済みOwner投影と隔離Effect Gateの接続を検証する。
 *
 * @packageDocumentation
 * @responsibility 不正入力・Receipt不明・元結果照合・取消後再開始を技術境界で反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope Owner観測→固定Docker実行→資源終端。依存差替えの限定確認。
 * @boundary Direct Boundary: 現在Owner投影→Docker Effect Gate。実Dockerとは区別する。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { types as utilTypes } from "node:util";
import test, { mock } from "node:test";
import { createDockerIsolationRuntimeCandidate } from "../../src/execution/execute.ts";
import type {
  DockerIsolationRuntimePlan,
  DockerResourceReceipts,
} from "../../src/index.ts";
import {
  createDockerIsolationRuntime,
  planDockerIsolationCommands,
} from "../../src/index.ts";

/**
 * 移管した固定Seccomp Resolverの実物と全拒否条件を確認する。
 * @responsibility 同じArtifactの読取り順と差替え拒否を保持する。
 * @trace ERB-IT-004
 * @precondition 正常は固定実物、異常は同じ実関数本文とFilesystem代役を使う。
 * @stimulus file/link・容量・realpath・Hash・読取り例外・前後Identity差を一軸ずつ与える。
 * @observation 戻りPath/nullと読取り回数。
 * @oracle 全条件が一致する実物だけを返し、失敗はnullで書込み／Docker0。
 * @cleanup N/A: 固定実物は読取りだけ、VMはメモリだけ。
 * @boundary DI固定Artifactと呼出し元の期待Identity。
 */
test("Seccomp Resolverは同じ固定実物を読みlinkと前後差を拒否する", () => {
  const artifact = fileURLToPath(
    new URL("../../src/execution/codex-executor-seccomp.json", import.meta.url),
  );
  const bytes = fs.readFileSync(artifact);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const configuration = runtimeFixture().plan.configuration;
  const commands = planDockerIsolationCommands({
    ...configuration,
    execution: {
      ...configuration.execution,
      seccompProfile: { sha256: hash, bytes: bytes.length },
    },
  });
  assert.ok(commands);
  assert.ok(
    commands
      .find((command) => command.purpose === "create_provider")
      ?.argv.includes(`--security-opt=seccomp=${artifact}`),
  );
  const source = fs.readFileSync(
    new URL("../../src/execution/plan.ts", import.meta.url),
    "utf8",
  );
  const declaration = "function resolveFixedCodexExecutorSeccompProfile(";
  assert.equal(source.split(declaration).length, 2);
  const begin = source.indexOf(declaration);
  const end = source.indexOf("\n}\n", begin) + 3;
  assert.ok(end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export function", "function"),
  );
  for (const mode of [
    "normal",
    "file",
    "link",
    "bytes",
    "realpath",
    "read",
    "dev",
    "ino",
    "size",
    "mtimeNs",
    "hash",
  ]) {
    let stats = 0,
      reads = 0;
    const resolve = runInNewContext(
      `${body}\nresolveFixedCodexExecutorSeccompProfile`,
      {
        executorSeccompProfilePath: artifact,
        createHash,
        BigInt,
        fs: {
          lstatSync: (location: string) => {
            assert.equal(location, artifact);
            stats++;
            const metadata: Record<string, unknown> = {
              isFile: () => mode !== "file",
              isSymbolicLink: () => mode === "link",
              dev: 1n,
              ino: 2n,
              size: BigInt(bytes.length),
              mtimeNs: 3n,
            };
            if (mode === "bytes") metadata.size = 0n;
            if (stats === 2 && ["dev", "ino", "size", "mtimeNs"].includes(mode))
              metadata[mode] = 999999n;
            return metadata;
          },
          realpathSync: {
            native: () =>
              mode === "realpath" ? "different-artifact" : artifact,
          },
          readFileSync: () => {
            reads++;
            if (mode === "read") throw new Error("private-read-failure");
            return mode === "hash" ? Buffer.from("wrong") : bytes;
          },
        },
      },
    ) as (hash: string, size: number) => string | null;
    assert.equal(
      resolve(hash, bytes.length),
      mode === "normal" ? artifact : null,
      mode,
    );
    if (["file", "link", "bytes", "realpath"].includes(mode))
      assert.equal(reads, 0, mode);
    if (mode === "normal") {
      assert.equal(stats, 2);
      assert.equal(reads, 1);
    }
  }
});

/**
 * 実行後のArtifact欠測を所有資源回収の前提にしない。
 * @responsibility 元Contextがある清掃では新しいSeccomp観測を要求しない。
 * @trace ERB-IT-004
 * @precondition 固定実物のSeccomp計画で模擬Processを開始する。
 * @stimulus 次のSeccomp観測を失敗させ、新規開始拒否と元清掃を順に確認する。
 * @observation Artifact観測回数、清掃結果と同じRuntimeの結果照合を読む。
 * @oracle 新しい開始は拒否するが、既存のHandle終了と元資源の清掃は阻害しない。
 * @cleanup mockをfinallyで復元。実Docker・Process・書込みは生成しない。
 * @boundary 固定Artifactの鮮度検査と所有Contextの終端。
 */
test("Seccompの後発欠測は新規開始を拒否し元Contextの清掃を妨げない", async () => {
  const fixture = runtimeFixture();
  const artifact = new URL(
    "../../src/execution/codex-executor-seccomp.json",
    import.meta.url,
  );
  const bytes = fs.readFileSync(artifact);
  const plan = {
    ...fixture.plan,
    configuration: {
      ...fixture.plan.configuration,
      execution: {
        ...fixture.plan.configuration.execution,
        seccompProfile: {
          sha256: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.length,
        },
      },
    },
  };
  fixture.runtime.startCommand("create_provider", plan, fixture.owner);
  const original = fs.lstatSync;
  let observations = 0;
  const injected = mock.method(fs, "lstatSync", ((
    ...args: Parameters<typeof fs.lstatSync>
  ) => {
    if (String(args[0]).endsWith("codex-executor-seccomp.json")) {
      observations++;
      throw new Error("injected_seccomp_missing");
    }
    return Reflect.apply(original, fs, args);
  }) as typeof fs.lstatSync);
  try {
    assert.throws(
      () =>
        fixture.runtime.startCommand("create_provider", plan, fixture.owner),
      /docker_effect_command_not_owned/u,
    );
    assert.ok(observations >= 1);
    const beforeCleanup = observations;
    const cleaned = await fixture.runtime.cleanupOwnedResources(
      plan,
      fixture.recovery,
      fixture.owner,
    );
    assert.equal(cleaned.confirmed, true);
    assert.equal(observations, beforeCleanup);
    assert.deepEqual(
      fixture.runtime.verifyCleanupOutcome(
        cleaned,
        plan.identity,
        fixture.recovery,
        fixture.owner,
      ),
      cleaned.resourceObservations,
    );
  } finally {
    injected.mock.restore();
  }
});

/**
 * 入力descriptorの継承値を隔離realmで反証する。
 *
 * @responsibility accessorと欠測を継承dataで偽装しても受理しないことを確認する。
 * @trace ERB-IT-004
 * @precondition 実Factory本文をHostと分離したVMで評価する。
 * @observation 受理結果、任意観測の捕捉、getter実行回数。
 * @oracle 正規dataだけを受理し、旧in判定では同じ期待値が成立しない。
 * @cleanup VMだけを破棄しHostのprototype・Filesystem・Dockerは変更しない。
 * @boundary 公開Factoryの入力検査。実Host動作の証明ではない。
 * @stimulus 継承valueを持つdescriptorとown valueの正常対照を公開Factoryへ渡す。
 */
test("公開Factoryはdescriptorの継承valueを受理しない", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/execute.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export function createDockerIsolationRuntime(");
  const end = source.indexOf("\n}\n", start);
  assert.ok(start >= 0 && end > start);
  const body = source
    .slice(start, end + 3)
    .replace("export function", "function");
  const oldPredicate = 'Object.hasOwn(descriptors[key] ?? {}, "value")';
  assert.equal(body.split(oldPredicate).length, 2);
  const expected = [true, false, false, false, true, true, 0, 0];
  for (const mutant of [false, true]) {
    const candidate = mutant
      ? body.replace(oldPredicate, '("value" in (descriptors[key] ?? {}))')
      : body;
    const observed = runInNewContext(
      stripTypeScriptTypes(`${candidate}
        /**
         * Factoryのdescriptor検査に不要な借用Path処理を無作用にする。
         * @responsibility Factoryのdescriptor検査に不要な借用Path処理を無作用にする。
         * @trace ERB-IT-004
         * @precondition VM内だけで使う境界関数の代役。
         * @stimulus 呼び出されても値も資源も生成しない。
         * @observation Factory引数の受理・拒否。
         * @oracle descriptor反例の結果を外部処理に依存させない。
         * @cleanup N/A: 無作用関数だけ。
         * @boundary VM内の構成検査。実借用Workspaceを作らない。
         */
        const noop = () => {};
        let reads = 0;
        let inheritedCalls = 0;
        const good = { borrowPaths: noop };
        const accessor = Object.defineProperty({}, "borrowPaths", {
          get() { reads++; return noop; }, enumerable: true
        });
        const optionalAccessor = Object.defineProperty({ borrowPaths: noop }, "inspectReceipts", {
          get() { reads++; return noop; }, enumerable: true
        });
        const missing = {};
        Object.prototype.value = noop;
        Object.prototype.borrowPaths = { value: noop };
        Object.prototype.inspectReceipts = () => { inheritedCalls++; };
        let captured;
        /**
         * 公開Factoryが下位へ渡した構成を捕捉する。
         * @responsibility 公開Factoryが下位へ渡した構成を捕捉する。
         * @trace ERB-IT-004
         * @precondition VM内で下位Runtime生成だけを置換している。
         * @stimulus 受けた値をcapturedへ保存し同じ値を返す。
         * @observation capturedのfieldと入力相関。
         * @oracle 継承fieldが下位構成へ紛れないことを呼出し元が確認する。
         * @cleanup VM評価を終了して捕捉値を破棄する。
         * @boundary 下位Factoryの代役。Process作成0。
         */
        function createDockerIsolationRuntimeCandidate(value) { captured = value; return value; }
        /**
         * 公開Factoryの入力受理を真偽へ投影する。
         * @responsibility 公開Factoryの入力受理を真偽へ投影する。
         * @trace ERB-IT-004
         * @precondition VM内でFactoryと下位捕捉関数が結合済み。
         * @stimulus 対象値をFactoryへ渡し例外をfalseへ分類する。
         * @observation 正常対照trueと継承descriptor false。
         * @oracle 不正入力が例外なしで受理されれば試験を失敗させる。
         * @cleanup N/A: 局所の呼出し結果のみ。
         * @boundary Factory検査だけ。実Runtimeの起動を証明しない。
         */
        function accepted(value) {
          try { createDockerIsolationRuntime(value); return true; }
          catch { return false; }
        }
        const valid = accepted(good);
        const optionalOwn = Object.hasOwn(captured, "inspectReceipts");
        const optionalAbsent = captured.inspectReceipts === undefined;
        if (captured.inspectReceipts) captured.inspectReceipts({});
        [valid, accepted(accessor), accepted(optionalAccessor), accepted(missing), optionalOwn, optionalAbsent, reads, inheritedCalls];
      `),
      {
        utilTypes,
        process: { platform: "win32" },
        readCliSnapshot: () => {},
        acquireHomeLease: () => {
          throw new Error("home_lease_not_requested_by_descriptor_fixture");
        },
        verifyCliSnapshot: () => {},
        createDockerProcessEnvironment: () => {},
        createDockerCliConfig: () => {},
        verifyDockerCliConfig: () => {},
      },
    ) as unknown[];
    if (mutant) assert.throws(() => assert.deepEqual([...observed], expected));
    else assert.deepEqual([...observed], expected);
  }
});

/**
 * 上位から環境選択を渡せない公開契約を確認する。
 *
 * @responsibility OS値・getter持込みを観測callbackやEffectの前に拒否する。
 * @trace ERB-IT-004
 * @precondition 公開Factoryへ模擬の用途限定観測を渡す。
 * @stimulus platformの値またはgetterを追加した入力を渡す。
 * @observation 拒否、getter読取り0、観測呼出し0を確認する。
 * @oracle 公開型にplatformが存在せず、上位指定を下位の環境選択へ採用しない。
 * @cleanup N/A: 実資源を取得しない。
 * @boundary 上位入力→下位公開Factory。
 */
test("公開Factoryは上位のOS指定とgetterを受け付けない", () => {
  let calls = 0;
  let getterReads = 0;
  /**
   * 禁止入力後の観測開始を検出する。
   *
   * @responsibility 入力拒否より先に既存Ownerを呼ばないことを確認する。
   * @trace ERB-IT-004
   * @precondition OS指定を含む入力である。
   * @stimulus 観測が誤って呼ばれた時に例外を返す。
   * @observation 呼出し数を増やす。
   * @oracle 呼出し数0をCase側で確認する。
   * @cleanup N/A: 模擬値だけ。
   * @boundary 禁止入力と観測開始の順序。
   */
  function forbiddenObservation(): never {
    calls += 1;
    throw new Error("unexpected observation");
  }
  const base = {
    borrowPaths: forbiddenObservation,
    readCli: forbiddenObservation,
    verifyCli: forbiddenObservation,
    environment: forbiddenObservation,
  };
  const accessor = Object.defineProperty({ ...base }, "platform", {
    get: () => {
      getterReads += 1;
      return "linux";
    },
  });
  for (const invalid of [{ ...base, platform: "linux" }, accessor])
    assert.throws(
      () => createDockerIsolationRuntime(invalid),
      /docker_isolation_platform_input_forbidden/u,
    );
  const platformIsPublic: "platform" extends keyof Parameters<
    typeof createDockerIsolationRuntime
  >[0]
    ? true
    : false = false;
  assert.equal(platformIsPublic, false);
  assert.equal(calls, 0);
  assert.equal(getterReads, 0);
  const permitted = { borrowPaths: forbiddenObservation };
  for (const key of [
    "readCli",
    "verifyCli",
    "environment",
    "unknown",
    "borrowPaths",
    "inspectReceipts",
  ]) {
    const input = Object.defineProperty({ ...permitted }, key, {
      get: () => {
        getterReads += 1;
        throw new Error("forbidden getter");
      },
    });
    assert.throws(
      () => createDockerIsolationRuntime(input),
      /docker_isolation_runtime_input_invalid/u,
    );
  }
  let traps = 0;
  const proxy = new Proxy(permitted, {
    ownKeys: () => {
      traps += 1;
      throw new Error("forbidden trap");
    },
  });
  assert.throws(
    () => createDockerIsolationRuntime(proxy),
    /docker_isolation_runtime_input_invalid/u,
  );
  for (const key of [
    "readCli",
    "verifyCli",
    "environment",
    "startProcess",
    "createConfig",
    "unknown",
  ])
    assert.throws(
      () =>
        createDockerIsolationRuntime({
          ...permitted,
          [key]: forbiddenObservation,
        }),
      /docker_isolation_runtime_input_invalid/u,
    );
  const internalKeysArePublic: {
    [Key in
      | "readCli"
      | "verifyCli"
      | "environment"]: Key extends keyof Parameters<
      typeof createDockerIsolationRuntime
    >[0]
      ? true
      : false;
  } = { readCli: false, verifyCli: false, environment: false };
  assert.deepEqual(internalKeysArePublic, {
    readCli: false,
    verifyCli: false,
    environment: false,
  });
  assert.equal(traps, 0);
  assert.equal(getterReads, 0);
  const publicRuntime = createDockerIsolationRuntime(permitted);
  assert.deepEqual(Object.keys(publicRuntime).sort(), [
    "acquireHomeLease",
    "cleanupOwnedResources",
    "startCommand",
    "startExecution",
    "verifyCleanupOutcome",
  ]);
  assert.equal(calls, 0);
});

/**
 * 未対応環境の内部選択をEffect前に止める。
 *
 * @responsibility 未実装Linuxの模擬選択を対応済みとして動かさない。
 * @trace ERB-IT-004
 * @precondition 同Package内部の試験候補だけに環境差を与える。
 * @stimulus 未対応環境で開始を依頼する。
 * @observation 未対応理由とconfig作成・Process開始0を確認する。
 * @oracle 未検証backend／コマンドへfallbackしない。
 * @cleanup N/A: 模擬候補は実資源を作らない。
 * @boundary 下位内部の環境選択→技術Effect前停止。
 */
test("未対応環境はconfig作成とProcess開始の前に止まる", () => {
  const fixture = runtimeFixture("linux");
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        "create_provider",
        fixture.plan,
        fixture.owner,
      ),
    /docker_effect_platform_unsupported/u,
  );
  assert.deepEqual(fixture.counts(), {
    starts: 0,
    created: 0,
    removed: 0,
    closed: false,
  });
});

/**
 * 固定技術計画と観測・実行primitiveの局所Fixtureを作る。
 *
 * @responsibility 実資源を作らずGateの発行数と元Handleの終端を観測可能にする。
 * @trace ERB-IT-004
 * @precondition 本番Ownerや実Dockerの成功根拠として使用しない。
 * @stimulus 固定Owner、計画、Receipt、閉じるHandleを構築する。
 * @observation 起動数、config作成／削除数、Handle終了、清掃結果を返す。
 * @oracle 観測不能を未要求・不存在へ変換する反例を判定できる。
 * @cleanup N/A: 実Process・Directory・Docker資源を取得しない。
 * @boundary 模擬Owner投影→技術Gate。実境界は別に確認する。
 */
function runtimeFixture(platform = "win32") {
  const owner = Object.freeze({});
  const recovery = Object.freeze({});
  const plan: DockerIsolationRuntimePlan = {
    identity: "a".repeat(64),
    stdin: "fixed input",
    configuration: {
      authenticationContainerName: `crdd-auth-${"1".repeat(16)}`,
      executionContainerName: `crdd-codex-${"2".repeat(16)}`,
      proxyContainerName: `crdd-proxy-${"3".repeat(16)}`,
      internalNetworkName: `crdd-internal-${"4".repeat(16)}`,
      egressNetworkName: `crdd-egress-${"5".repeat(16)}`,
      ownershipLabel: `crdd.coordinator.runtime=${"6".repeat(16)}`,
      executionImageDigest: `sha256:${"a".repeat(64)}`,
      proxyImageDigest: `sha256:${"b".repeat(64)}`,
      homeSourcePath: path.resolve("fixture-home"),
      temporarySourcePath: path.resolve("fixture-tmp"),
      workspace: null,
      authentication: { argv: ["auth", "status"], environment: {} },
      execution: {
        argv: ["exec"],
        environment: {},
        interactive: true,
        initRequired: false,
        seccompProfile: null,
      },
      proxy: {
        profile: "codex",
        token: "7".repeat(64),
        port: 8080,
        extendedProxyEnvironment: true,
      },
    },
  };
  let closed = false;
  let starts = 0;
  let created = 0;
  let removed = 0;
  const invocations: Array<
    Readonly<{
      executable: string;
      argv: readonly string[];
      environment: Readonly<Record<string, string>>;
      stdin: string | null;
    }>
  > = [];
  let receipts: DockerResourceReceipts | null = {
    create_provider: { submitted: false, dockerId: null },
    create_proxy: { submitted: false, dockerId: null },
    create_subscription_auth_probe: { submitted: false, dockerId: null },
    create_internal_network: { submitted: false, dockerId: null },
    create_egress_network: { submitted: false, dockerId: null },
  };
  const runtime = createDockerIsolationRuntimeCandidate({
    platform,
    borrowPaths: (candidate) => {
      assert.equal(candidate, owner);
      return {
        tmp: plan.configuration.temporarySourcePath,
        management: path.resolve("fixture-management"),
      };
    },
    readCli: () =>
      Object.freeze({ hash: "fixed", executablePath: "fixed-docker.exe" }),
    verifyCli: (snapshot) => {
      assert.equal(snapshot.hash, "fixed");
    },
    environment: () => Object.freeze({ SystemRoot: "fixed" }),
    createConfig: (management) => {
      created += 1;
      return {
        directory: path.join(management, "docker-cli-config"),
        identity: "fixed",
      };
    },
    verifyConfig: (_directory, identity) => {
      assert.equal(identity, "fixed");
    },
    configEntries: () => [],
    removeConfig: () => {
      removed += 1;
    },
    startProcess: (executable, argv, environment, stdin) => {
      starts += 1;
      invocations.push(Object.freeze({ executable, argv, environment, stdin }));
      return {
        started: async () => true,
        wait: async () => ({
          status: 0,
          signal: null,
          stdout: "",
          stderr: "",
          outputExceeded: false,
        }),
        terminateAndWait: async () => {
          closed = true;
          return true;
        },
        closed: () => closed,
      };
    },
    inspectReceipts: (candidate) => {
      assert.equal(candidate, recovery);
      return receipts;
    },
  });
  return {
    runtime,
    owner,
    recovery,
    plan,
    counts: () => ({ starts, created, removed, closed }),
    setReceipts: (value: DockerResourceReceipts | null) => {
      receipts = value;
    },
    initialReceipts: receipts,
    invocations,
  };
}

/**
 * 実RuntimeのSession入口を同じ私有清掃Ownerへ接続する。
 * @responsibility 下位Sessionの接続を、単独Kernelの模擬清掃成功と区別して確認する。
 * @trace ERB-IT-004
 * @precondition 実Runtime候補と明示未要求Receiptを使用し、OS操作は模擬する。
 * @stimulus 最初の同期Gateを拒否してSessionの元完了を待つ。
 * @observation Process要求数、失敗段階、元清掃結果と同Runtimeの照合結果。
 * @oracle 起動0、清掃確認、元結果の受理、複製結果と異なるOwnerの拒否が成立する。
 * @cleanup 同じSessionの清掃で閉じる。実Docker・Filesystemは使用しない。
 * @boundary 実Runtime→実Session→私有清掃記録。実Dockerの証明ではない。
 */
test("実RuntimeのSessionは同Ownerの元清掃結果だけを搬送する", async () => {
  const fixture = runtimeFixture();
  const failures: unknown[] = [];
  const session = fixture.runtime.startExecution(
    fixture.plan,
    fixture.recovery,
    fixture.owner,
    {
      onCommandSubmitting: () => {
        throw new Error("notification_failed");
      },
      onCommandNotIssued: () => {},
      onExecutionSubmitting: () => {},
      onResourceCreated: () => {},
      onCommandObserved: () => {},
      onCommandCompleted: () => {},
      onExecutionStarted: () => {
        assert.fail("provider_start_unexpected");
      },
      onFailure: (failure) => {
        failures.push(failure);
      },
    },
  );
  assert.equal(fixture.counts().starts, 0);
  const result = await session.completion;
  assert.equal(result.failure?.gate, "onCommandSubmitting");
  assert.equal(result.notificationDeliveryConfirmed, false);
  assert.equal(failures.length, 0);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(result.processTreeTerminationConfirmed, true);
  assert.equal(result.callbackRegistrationReleased, true);
  assert.equal(fixture.counts().starts, 0);
  assert.deepEqual(
    fixture.runtime.verifyCleanupOutcome(
      result.cleanup,
      fixture.plan.identity,
      fixture.recovery,
      fixture.owner,
    ),
    result.resourceObservations,
  );
  for (const [cleanup, owner] of [
    [{ ...result.cleanup }, fixture.owner],
    [result.cleanup, Object.freeze({})],
  ] as const) {
    assert.equal(
      fixture.runtime.verifyCleanupOutcome(
        cleanup,
        fixture.plan.identity,
        fixture.recovery,
        owner,
      ),
      null,
    );
  }
});

/**
 * 正常stdinを固定CLI・Engine・元設定へ結合する。
 * @responsibility 本文をargvへ混入せず対話startだけへ渡す。
 * @trace ERB-IT-004
 * @precondition 固定技術Planと模擬Processを使用する。
 * @stimulus 認証createと実行startを順に発行する。
 * @observation CLI、Engine、config、environment、stdin。
 * @oracle 同じconfigを使い本文は対話startのstdinだけに存在する。
 * @cleanup 模擬Handleをjoinする。
 * @boundary 技術Planと下位Process構成。
 */
test("正常本文は固定CLIと同じconfigの対話stdinだけへ渡る", async () => {
  const fixture = runtimeFixture();
  const first = fixture.runtime.startCommand(
    "create_subscription_auth_probe",
    fixture.plan,
    fixture.owner,
  );
  await first.wait(10);
  const second = fixture.runtime.startCommand(
    "start_provider_attached",
    fixture.plan,
    fixture.owner,
  );
  await second.wait(10);
  assert.equal(fixture.invocations.length, 2);
  for (const invocation of fixture.invocations) {
    assert.equal(
      invocation.executable,
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    );
    assert.deepEqual(invocation.argv.slice(0, 4), [
      "--host",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "--config",
      path.resolve("fixture-management", "docker-cli-config"),
    ]);
    assert.equal(Object.getPrototypeOf(invocation.environment), null);
    assert.deepEqual(Object.entries(invocation.environment), [
      ["SystemRoot", "fixed"],
    ]);
    assert.equal(invocation.argv.includes(fixture.plan.stdin ?? ""), false);
  }
  assert.equal(fixture.invocations[0]?.stdin, null);
  assert.equal(fixture.invocations[1]?.stdin, fixture.plan.stdin);
  assert.deepEqual(fixture.invocations[1]?.argv.slice(-4), [
    "start",
    "--attach",
    "--interactive",
    fixture.plan.configuration.executionContainerName,
  ]);
  assert.equal(fixture.counts().created, 1);
});

/**
 * 同じOwnerへ渡した技術Planの差替えを拒否する。
 * @responsibility 上位意味のidentityと技術構成の両方を元Contextへ結合する。
 * @trace ERB-IT-004
 * @precondition 元Contextを作成済み。
 * @stimulus identity、stdin、実行構成を個別に変更する。
 * @observation plan_replacedと追加要求0。
 * @oracle 同じOwnerから元計画以外を再開しない。
 * @cleanup 元の模擬Handleをjoinする。
 * @boundary 現在Ownerと元技術Context。
 */
test("元Context取得後のidentity・本文・技術構成差替えを拒否する", async () => {
  const fixture = runtimeFixture();
  await fixture.runtime
    .startCommand("create_provider", fixture.plan, fixture.owner)
    .wait(10);
  for (const changed of [
    { ...fixture.plan, identity: "b".repeat(64) },
    { ...fixture.plan, stdin: "different input" },
    {
      ...fixture.plan,
      configuration: {
        ...fixture.plan.configuration,
        execution: {
          ...fixture.plan.configuration.execution,
          initRequired: true,
        },
      },
    },
  ]) {
    assert.throws(
      () =>
        fixture.runtime.startCommand(
          "start_provider_attached",
          changed,
          fixture.owner,
        ),
      /docker_effect_plan_replaced/u,
    );
    assert.equal(fixture.counts().starts, 1);
  }
});

/**
 * 各資源のReceipt欠測を未要求へ変換しない。
 * @responsibility 五fieldの閉集合と処置前停止を確認する。
 * @trace ERB-IT-004
 * @precondition 各Receiptは模擬値だけである。
 * @stimulus 各purposeのfieldを一つずつ欠測させる。
 * @observation 清掃結果、要求件数、config保持。
 * @oracle 観測不明、要求0、config削除0、後発開始拒否。
 * @cleanup N/A: 実資源を取得しない。
 * @boundary 下位Receipt契約と技術清掃。
 */
test("五purposeのReceipt欠測を未要求に補完しない", async () => {
  for (const purpose of Object.keys(runtimeFixture().initialReceipts)) {
    const fixture = runtimeFixture();
    const incomplete = { ...fixture.initialReceipts } as Record<
      string,
      unknown
    >;
    delete incomplete[purpose];
    fixture.setReceipts(incomplete as DockerResourceReceipts);
    const result = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recovery,
      fixture.owner,
    );
    assert.equal(result.confirmed, false);
    assert.equal(result.containersAbsent, false);
    assert.equal(result.networksAbsent, false);
    assert.equal(result.resourceObservations, null);
    assert.equal(fixture.counts().starts, 0);
    assert.equal(fixture.counts().removed, 0);
    assert.throws(
      () =>
        fixture.runtime.startCommand(
          "create_provider",
          fixture.plan,
          fixture.owner,
        ),
      /docker_effect_attempt_stopped/u,
    );
  }
});

/**
 * 各purposeの作成結果不明を保持する。
 * @responsibility 発行済みID不明と明示未要求を区別する。
 * @trace ERB-IT-004
 * @precondition 他の四purposeは明示未要求。
 * @stimulus 一purposeをsubmitted=true、ID=nullへ変更する。
 * @observation 元清掃結果、config、後発開始。
 * @oracle unknownを保持し、成功根拠と再開始を拒否する。
 * @cleanup N/A: 実資源なし。
 * @boundary 作成Receiptと現在清掃結果。
 */
test("五purposeの発行済みID不明を不存在へ丸めない", async () => {
  for (const purpose of Object.keys(runtimeFixture().initialReceipts)) {
    const fixture = runtimeFixture();
    fixture.setReceipts({
      ...fixture.initialReceipts,
      [purpose]: { submitted: true, dockerId: null },
    });
    const result = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recovery,
      fixture.owner,
    );
    assert.equal(result.processTreeTerminated, true);
    assert.equal(result.confirmed, false);
    assert.equal(
      result.resourceObservations?.find((entry) => entry.purpose === purpose)
        ?.observation,
      "unknown",
    );
    assert.equal(
      fixture.runtime.verifyCleanupOutcome(
        result,
        fixture.plan.identity,
        fixture.recovery,
        fixture.owner,
      ),
      null,
    );
    assert.equal(fixture.counts().starts, 0);
    assert.equal(fixture.counts().removed, 0);
    assert.throws(
      () =>
        fixture.runtime.startCommand(
          "create_provider",
          fixture.plan,
          fixture.owner,
        ),
      /docker_effect_attempt_stopped/u,
    );
  }
});

/**
 * 元結果のRecoveryとRuntime所属を確認する。
 * @responsibility 別の回復Owner・Runtimeへ成功根拠を移譲しない。
 * @trace ERB-IT-004
 * @precondition 五資源は全て明示未要求。
 * @stimulus 同じ元結果を別Recoveryと別Runtimeへ渡す。
 * @observation 真正な観測またはnull。
 * @oracle 元Recovery・元Runtimeだけが観測を返す。
 * @cleanup N/A: 模擬値だけ。
 * @boundary 清掃結果objectと所有相関。
 */
test("元清掃結果を別Recoveryと別Runtimeへ移譲できない", async () => {
  const fixture = runtimeFixture();
  const result = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recovery,
    fixture.owner,
  );
  assert.equal(result.confirmed, true);
  assert.equal(
    fixture.runtime.verifyCleanupOutcome(
      result,
      fixture.plan.identity,
      {},
      fixture.owner,
    ),
    null,
  );
  assert.equal(
    runtimeFixture().runtime.verifyCleanupOutcome(
      result,
      fixture.plan.identity,
      fixture.recovery,
      fixture.owner,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.verifyCleanupOutcome(
      result,
      fixture.plan.identity,
      fixture.recovery,
      fixture.owner,
    ),
    result.resourceObservations,
  );
});

/**
 * 不正技術入力でconfig・Processを取得しないことを確認する。
 *
 * @responsibility Effect Gateの拒否を開始前の発行件数へ接続する。
 * @trace ERB-IT-004
 * @precondition 正常Fixtureのstdinだけを不正にする。
 * @stimulus 過大stdinで開始を要求する。
 * @observation 例外、config／Process発行数を読む。
 * @oracle plan_invalidで拒否し、発行0である。
 * @cleanup N/A: 拒否までに実資源を作らない。
 * @boundary 模擬Observer→実装Gate。実Dockerの非発行を直接実測した主張ではない。
 */
test("不正stdinはconfig作成とProcess開始の前に拒否する", () => {
  const fixture = runtimeFixture();
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        "create_provider",
        { ...fixture.plan, stdin: "x".repeat(128 * 1024 + 1) },
        fixture.owner,
      ),
    /docker_effect_plan_invalid/u,
  );
  assert.deepEqual(fixture.counts(), {
    starts: 0,
    created: 0,
    removed: 0,
    closed: false,
  });
});

/**
 * Receiptの観測不能を清掃成功へ補完しないことを確認する。
 *
 * @responsibility Handle終端と資源観測を独立した結果として返す。
 * @trace ERB-IT-004
 * @precondition 所有Handleを開始し、Receipt読取りを不明にする。
 * @stimulus 同じOwnerで清掃を要求する。
 * @observation Process終端、清掃未確認、config保持と後発開始拒否を読む。
 * @oracle Processが閉じても資源不存在は不明、config削除0、追加開始0である。
 * @cleanup N/A: 模擬値だけで実資源を取得しない。
 * @boundary 模擬保存Owner→技術清掃と再開始Gate。
 */
test("Receipt不明ではHandleを終端しても資源清掃成功にしない", async () => {
  const fixture = runtimeFixture();
  fixture.runtime.startCommand("create_provider", fixture.plan, fixture.owner);
  fixture.setReceipts(null);
  const result = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recovery,
    fixture.owner,
  );
  assert.equal(result.processTreeTerminated, true);
  assert.equal(result.confirmed, false);
  assert.equal(result.resourceObservations, null);
  assert.deepEqual(fixture.counts(), {
    starts: 1,
    created: 1,
    removed: 0,
    closed: true,
  });
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        "create_provider",
        fixture.plan,
        fixture.owner,
      ),
    /docker_effect_attempt_stopped/u,
  );
});

/**
 * 明示未要求の終端を元結果とだけ照合する。
 *
 * @responsibility 未要求と不明を区別し、コピー・別計画の成功値を拒否する。
 * @trace ERB-IT-004
 * @precondition 保存Ownerが五資源を明示未要求として観測する。
 * @stimulus 同じ計画で清掃し、元結果とコピーを照合する。
 * @observation 五観測、config削除、元結果の受理とコピーの拒否を読む。
 * @oracle 明示未要求だけを保持し、元結果・Owner・相関が一致した場合だけ観測を返す。
 * @cleanup N/A: 模擬値の清掃で実資源を作らない。
 * @boundary 保存Ownerの明示値→下位元結果→結果Consumer。
 */
test("明示未要求の終端は元結果と同じOwner・計画へだけ結合する", async () => {
  const fixture = runtimeFixture();
  const result = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recovery,
    fixture.owner,
  );
  assert.equal(result.confirmed, true);
  assert.equal(result.resourceObservations?.length, 5);
  assert.ok(
    result.resourceObservations?.every(
      (entry) => entry.observation === "not_requested",
    ),
  );
  assert.equal(fixture.counts().removed, 1);
  assert.deepEqual(
    fixture.runtime.verifyCleanupOutcome(
      result,
      fixture.plan.identity,
      fixture.recovery,
      fixture.owner,
    ),
    result.resourceObservations,
  );
  assert.equal(
    fixture.runtime.verifyCleanupOutcome(
      { ...result },
      fixture.plan.identity,
      fixture.recovery,
      fixture.owner,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.verifyCleanupOutcome(
      result,
      "b".repeat(64),
      fixture.recovery,
      fixture.owner,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.verifyCleanupOutcome(
      result,
      fixture.plan.identity,
      fixture.recovery,
      Object.freeze({}),
    ),
    null,
  );
});

/**
 * 本番Factory実本文から実技術Runtimeへの固定接続を確認する。
 * @responsibility 上位の技術依存なしでCLI・環境・Processが同じ下位へ結合することを反証する。
 * @trace ERB-IT-004
 * @precondition 公開Factory本文と実Candidateを使い最下位だけを局所値へ差替える。
 * @stimulus 正常、CLI観測／再確認失敗、環境不明と短期cleanupを与える。
 * @observation 要求列、元snapshot、固定argv、理由、既取得config回収を読む。
 * @oracle 正常順序を保ち、不明時に新Processを発行せず元理由を保持する。
 * @cleanup 模擬Handleを終端し実Filesystem・Docker・外部AIは使わない。
 * @boundary 公開Factory実本文→実Candidate→模擬OS。実Host成立とは別。
 */
test("公開Factory本体は固定CLI・環境を実Candidateへ結合する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/execute.ts", import.meta.url),
    "utf8",
  );
  const bodies = [
    "readCliSnapshot",
    "verifyCliSnapshot",
    "createDockerIsolationRuntime",
  ]
    .map((name) => {
      const marker =
        name === "createDockerIsolationRuntime"
          ? `export function ${name}(`
          : `function ${name}(`;
      const start = source.indexOf(marker);
      assert.ok(start >= 0);
      const end = source.indexOf("\n}\n", start);
      assert.ok(end > start);
      return source
        .slice(start, end + 3)
        .replace("export function", "function");
    })
    .join("\n");
  for (const mode of [
    "normal",
    "observe",
    "verify",
    "environment",
    "cleanup",
  ] as const) {
    const fixture = runtimeFixture();
    const events: string[] = [];
    const snapshot = Object.freeze({ identity: "fixed" });
    const environmentFailure = new Error("fixed_environment_failure");
    let activeMode: string = mode;
    let starts = 0;
    let removed = 0;
    let created = 0;
    const invocations: Array<{
      argv: readonly string[];
      environment: Readonly<Record<string, string>>;
    }> = [];
    const factory = runInNewContext(
      stripTypeScriptTypes(`${bodies}\ncreateDockerIsolationRuntime;`),
      {
        Object,
        Reflect,
        Error,
        utilTypes,
        process: { platform: "win32" },
        observeTrustedDockerCli: () => {
          events.push("observe");
          if (activeMode === "observe") throw new Error("raw observation");
          return snapshot;
        },
        verifyTrustedDockerCliSnapshot: (value: unknown) => {
          events.push("verify");
          assert.strictEqual(value, snapshot);
          if (activeMode === "verify") throw new Error("raw replacement");
        },
        createDockerProcessEnvironment: () => {
          events.push("environment");
          if (activeMode === "environment") throw environmentFailure;
          return { SystemRoot: "fixed" };
        },
        createDockerCliConfig: () => {
          events.push("config");
          created += 1;
          return {
            directory: path.resolve("fixture-management", "docker-cli-config"),
            identity: "fixed",
          };
        },
        verifyDockerCliConfig: () => {
          events.push("verify-config");
        },
        fs: {
          readdirSync: () => [],
          rmdirSync: () => {
            removed += 1;
          },
        },
        createDockerIsolationRuntimeCandidate,
        acquireHomeLease: () => {
          throw new Error("home_lease_not_requested_by_command_fixture");
        },
        startOwnedWindowsProcess: (
          _executable: string,
          argv: readonly string[],
          environment: Readonly<Record<string, string>>,
        ) => {
          events.push("start");
          starts += 1;
          invocations.push({ argv, environment });
          let closed = false;
          return {
            started: async () => true,
            wait: async () => {
              closed = true;
              return {
                status: 0,
                signal: null,
                stdout: "[]",
                stderr: "",
                outputExceeded: false,
              };
            },
            terminateAndWait: async () => {
              closed = true;
              return true;
            },
            closed: () => closed,
          };
        },
      },
    ) as typeof createDockerIsolationRuntime;
    const receipts = { ...fixture.initialReceipts };
    const runtime = factory({
      borrowPaths: (owner) => {
        assert.strictEqual(owner, fixture.owner);
        return {
          tmp: fixture.plan.configuration.temporarySourcePath,
          management: path.resolve("fixture-management"),
        };
      },
      inspectReceipts: () => receipts,
    });
    if (mode === "observe" || mode === "verify" || mode === "environment") {
      assert.throws(
        () =>
          runtime.startCommand(
            "start_provider_attached",
            fixture.plan,
            fixture.owner,
          ),
        (error: unknown) =>
          mode === "environment"
            ? error === environmentFailure
            : error instanceof Error &&
              error.message ===
                (mode === "observe"
                  ? "docker_effect_cli_untrusted"
                  : "docker_effect_cli_replaced"),
      );
      assert.equal(starts, 0);
      assert.equal(created, mode === "verify" ? 1 : 0);
      activeMode = "normal";
      if (created) {
        const cleanup = await runtime.cleanupOwnedResources(
          fixture.plan,
          fixture.recovery,
          fixture.owner,
        );
        assert.equal(cleanup.confirmed, true);
        assert.equal(removed, 1);
      }
      continue;
    }
    const handle = runtime.startCommand(
      "start_provider_attached",
      fixture.plan,
      fixture.owner,
    );
    await handle.wait(10);
    assert.deepEqual(events.slice(0, 6), [
      "environment",
      "observe",
      "config",
      "verify",
      "verify-config",
      "start",
    ]);
    assert.deepEqual(invocations[0]?.argv.slice(0, 4), [
      "--host",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "--config",
      path.resolve("fixture-management", "docker-cli-config"),
    ]);
    assert.deepEqual(Object.entries(invocations[0]?.environment ?? {}), [
      ["SystemRoot", "fixed"],
    ]);
    if (mode === "cleanup") {
      receipts.create_subscription_auth_probe = {
        submitted: true,
        dockerId: "a".repeat(64),
      };
      events.length = 0;
    }
    const cleanup = await runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recovery,
      fixture.owner,
    );
    assert.equal(cleanup.confirmed, mode === "normal");
    if (mode === "normal") assert.equal(removed, 1);
    else {
      assert.ok(starts > 1);
      const start = events.indexOf("start");
      assert.deepEqual(events.slice(start - 3, start + 1), [
        "environment",
        "verify",
        "verify-config",
        "start",
      ]);
    }
  }
});
