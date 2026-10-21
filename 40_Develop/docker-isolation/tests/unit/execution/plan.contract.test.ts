/**
 * 共通Execution PlanのDocker技術構成断面を検証する。
 *
 * @packageDocumentation
 * @responsibility 固定隔離flag、payload搬送、Mount mode、入力拒否を純粋構築で反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 既存Execution Plan義務の技術構成断面。Task Router全体の成立は主張しない。
 * @boundary N/A: 純粋計画だけ。Process、Docker、Provider Effectは発行しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import vm from "node:vm";
import { types as utilTypes } from "node:util";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import {
  type DockerIsolationCommandInput,
  planDockerIsolationCommands,
  dockerIsolationCommandsMatch,
  prepareDockerNetworkPolicy,
  codexAdviceProviderInitRequired,
  projectDockerProxyConfiguration,
  createDockerAuthenticationEnvironment,
  projectDockerExecutionBoundary,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
  dockerIsolationResourceIdentityIsValid,
} from "../../../src/index.ts";

/**
 * 元commandの用途・順序・全argv差を拒否する。
 * @responsibility 上位から移管した一致検査の反証を固定する。
 * @trace ERB-UT-023
 * @precondition 既存の固定構成fixtureを使う。
 * @stimulus 正常集合、欠落、順序、用途、引数を一項目ずつ変える。
 * @observation 完全一致判定。
 * @oracle 正常だけtrue、各差と不正構成はfalse。
 * @cleanup N/A: 外部資源は生成しない。
 * @boundary 技術計画の局所境界。
 */
test("固定command照合は用途・順序・全argvの差を拒否する", () => {
  const input = inputFixture();
  const commands = planDockerIsolationCommands(input);
  assert.ok(commands);
  const first = commands[0];
  assert.ok(first);
  assert.equal(dockerIsolationCommandsMatch(input, commands), true);
  assert.equal(dockerIsolationCommandsMatch(input, commands.slice(1)), false);
  assert.equal(
    dockerIsolationCommandsMatch(input, [...commands].reverse()),
    false,
  );
  for (const replacement of [
    { ...first, purpose: "unknown" },
    { ...first, argv: [...first.argv, "--extra"] },
    {
      ...first,
      argv: first.argv.map((value, i) => (i === 0 ? "unknown" : value)),
    },
  ]) {
    assert.equal(
      dockerIsolationCommandsMatch(input, [replacement, ...commands.slice(1)]),
      false,
    );
  }
  assert.equal(
    dockerIsolationCommandsMatch(
      { ...input, ownershipLabel: "invalid" },
      commands,
    ),
    false,
  );
});

/**
 * 助言Imageのinit要否を方式とexact Imageの直積で確認する。
 * @responsibility 未知値や通常Taskへinit要求を広げない。
 * @trace ERB-UT-023
 * @precondition 現在と旧助言の固定Digest、Claudeと未知のDigestを用意する。
 * @stimulus 五方式と六Image値の全組合せを判定する。
 * @observation 各組合せの要求有無を取得する。
 * @oracle workbench_adviceかつ現在または旧助言Digestだけtrue。
 * @cleanup N/A: 純粋な値の照合だけで資源を作らない。
 * @boundary 技術要件の判定であり実Init観測や回収許可ではない。
 */
test("助言initは方式と二つのexact Imageだけに限定する", () => {
  const current =
    "sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e";
  const previous =
    "sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36";
  const claude =
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a";
  for (const mode of [
    "workbench_advice",
    "boolean_probe",
    "isolated_task",
    "unknown",
    "",
  ]) {
    for (const image of [
      current,
      previous,
      claude,
      `sha256:${"0".repeat(64)}`,
      "",
      null,
    ]) {
      assert.equal(
        codexAdviceProviderInitRequired(mode, image),
        mode === "workbench_advice" &&
          (image === current || image === previous),
      );
    }
  }
});

/**
 * 固定二領域をExecutor／Reviewerで同じ三本構成へ接続する。
 * @responsibility SourceのRW差だけを許し保護Mountを常にROにする。
 * @trace ERB-UT-023
 * @precondition 固定入力と自己所有placeholder Path。
 * @stimulus 二役割と不正Pathを計画する。
 * @observation create_providerのMount引数。
 * @oracle /workと二保護領域だけがあり、不正Pathはnull。
 * @cleanup N/A: 純粋計画。
 * @boundary 実Dockerの成立は別の限定試験。
 */
test("Workspace三本MountはSourceのRW差だけを許す", () => {
  for (const readOnly of [false, true]) {
    const workspace = {
      sourcePath: path.resolve("fixture-tree"),
      readOnly,
      protection: {
        gitSourcePath: path.resolve("mask-git"),
        internalSourcePath: path.resolve("mask-internal"),
      },
    };
    const input = { ...inputFixture(), workspace };
    const commands = planDockerIsolationCommands(input);
    assert.ok(commands);
    const args =
      commands.find((item) => item.purpose === "create_provider")?.argv ?? [];
    const mounts = args.filter((value) => value.includes("dst=/work"));
    assert.equal(mounts.length, 3);
    assert.equal(mounts[0]?.endsWith(",readonly"), readOnly);
    assert.ok(
      mounts[1]?.includes("dst=/work/.git,") && mounts[1].endsWith(",readonly"),
    );
    assert.ok(
      mounts[2]?.includes("dst=/work/.crdd,") &&
        mounts[2].endsWith(",readonly"),
    );
    assert.equal(
      planDockerIsolationCommands({
        ...input,
        workspace: {
          ...workspace,
          protection: { ...workspace.protection, gitSourcePath: "relative" },
        },
      }),
      null,
    );
  }
});

/**
 * Proxy包装の実構築と固定投影を同じ技術Ownerで照合する。
 * @responsibility 包装外decoy・欠測・重複と不正認証環境を拒否する。
 * @trace ERB-UT-023
 * @precondition 既存fixtureと固定plannerを使う。
 * @stimulus 正常、二envの欠測・重複・順序差、他purpose、payload、getter、認証名差。
 * @observation profile/token、null、getter回数、環境map。
 * @oracle create_proxy一件のexact包装だけを投影し、Provider相関は上位に残す。
 * @cleanup N/A: 純粋計算だけ。
 * @boundary 技術包装と意味相関。実行許可ではない。
 */
test("Proxy投影は固定包装だけを読み認証Home定数を下位へ閉じる", () => {
  const input = inputFixture();
  const commands = planDockerIsolationCommands(input);
  assert.ok(commands);
  const proxy = commands.find((command) => command.purpose === "create_proxy");
  assert.ok(proxy);
  const network = prepareDockerNetworkPolicy("codex", ["pypi.org"]);
  if (network.status !== "ready") assert.fail();
  const configured = planDockerIsolationCommands({
    ...input,
    proxy: { ...input.proxy, networkPolicy: network.policy },
  });
  assert.ok(configured);
  const projected = projectDockerProxyConfiguration(
    configured,
    input.proxyImageDigest,
  );
  assert.deepEqual(projected?.networkPolicy, network.policy);
  const configuredProxy = configured.find(
    (item) => item.purpose === "create_proxy",
  );
  assert.equal(configuredProxy?.argv.length, 24);
  assert.equal(
    projectDockerProxyConfiguration(
      configured.map((item) =>
        item.purpose === "create_proxy"
          ? {
              ...item,
              argv: item.argv.map((arg) =>
                arg.startsWith("CRDD_PROXY_NETWORK_POLICY=")
                  ? arg.replace(network.policy.policyHash, "a".repeat(64))
                  : arg,
              ),
            }
          : item,
      ),
      input.proxyImageDigest,
    ),
    null,
  );
  assert.equal(
    planDockerIsolationCommands({
      ...input,
      proxy: {
        ...input.proxy,
        networkPolicy: { ...network.policy, provider: "claude" },
      },
    }),
    null,
  );
  const provider = configured.find(
    (item) => item.purpose === "create_provider",
  );
  assert.ok(provider);
  const environment = provider.argv.flatMap((value, index) =>
    value === "--env" ? [provider.argv[index + 1] as string] : [],
  );
  for (const name of [
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "https_proxy",
    "http_proxy",
    "all_proxy",
    "no_proxy",
  ]) {
    const entries = environment.filter((entry) => entry.startsWith(`${name}=`));
    assert.equal(entries.length, 1, name);
    assert.equal(
      entries[0],
      `${name}=${name.toLowerCase() === "no_proxy" ? "" : `http://crdd:${input.proxy.token}@proxy:${input.proxy.port}`}`,
    );
  }
  assert.equal(
    planDockerIsolationCommands({
      ...input,
      execution: { ...input.execution, environment: { NO_PROXY: "*" } },
      proxy: { ...input.proxy, networkPolicy: network.policy },
    }),
    null,
  );
  assert.deepEqual(
    projectDockerProxyConfiguration(commands, input.proxyImageDigest),
    {
      profile: "codex",
      token: "7".repeat(64),
      networkPolicy: null,
    },
  );
  for (const argv of [
    proxy.argv.filter((_, index) => index !== 18),
    [
      ...proxy.argv.slice(0, -1),
      "--env",
      proxy.argv[18] as string,
      input.proxyImageDigest,
    ],
    [...proxy.argv, `CRDD_PROXY_AUTH=${"7".repeat(64)}`],
    proxy.argv.map((value, index) =>
      index === 18 ? "CRDD_PROXY_PROFILE=codex" : value,
    ),
    proxy.argv.map((value, index) =>
      index === 18 ? "CRDD_PROXY_AUTH=bad" : value,
    ),
    proxy.argv.map((value, index) => (index === 17 ? "--unknown" : value)),
    proxy.argv.map((value, index) =>
      index === 18
        ? (proxy.argv[20] as string)
        : index === 20
          ? (proxy.argv[18] as string)
          : value,
    ),
  ])
    assert.equal(
      projectDockerProxyConfiguration(
        [{ ...proxy, argv }],
        input.proxyImageDigest,
      ),
      null,
    );
  assert.equal(
    projectDockerProxyConfiguration([proxy, proxy], input.proxyImageDigest),
    null,
  );
  assert.equal(
    projectDockerProxyConfiguration(
      [{ ...proxy, purpose: "create_provider" }],
      input.proxyImageDigest,
    ),
    null,
  );
  assert.equal(
    projectDockerProxyConfiguration(commands, `sha256:${"c".repeat(64)}`),
    null,
  );
  const otherProfile = {
    ...proxy,
    argv: proxy.argv.map((value, index) =>
      index === 20 ? "CRDD_PROXY_PROFILE=claude" : value,
    ),
  };
  assert.equal(
    projectDockerProxyConfiguration([otherProfile], input.proxyImageDigest)
      ?.profile,
    "claude",
  );
  let getters = 0;
  for (const length of [32, 33]) {
    const profile = "a".repeat(length);
    const boundary: { purpose: string; argv: readonly string[] } = {
      ...proxy,
      argv: proxy.argv.map((value, index) =>
        index === 20 ? `CRDD_PROXY_PROFILE=${profile}` : value,
      ),
    };
    assert.equal(
      projectDockerProxyConfiguration([boundary], input.proxyImageDigest)
        ?.profile ?? null,
      length === 32 ? profile : null,
    );
  }
  const accessor = Object.defineProperty({ purpose: "create_proxy" }, "argv", {
    enumerable: true,
    get: () => {
      getters++;
      return proxy.argv;
    },
  });
  assert.equal(
    projectDockerProxyConfiguration([accessor], input.proxyImageDigest),
    null,
  );
  assert.equal(getters, 0);
  /**
   * imageの暗黙文字列化を同じOracleで反証する。
   * @responsibility null返却だけでgetter未評価を推定しない。
   * @trace ERB-UT-023
   * @precondition 実関数または型確認だけを除いた実本文変異を渡す。
   * @stimulus toString getterとProxyをimageへ与える。
   * @observation nullとgetter回数。
   * @oracle 両入力ともnull、getter0。
   * @cleanup N/A: メモリだけ。
   * @boundary imageの型確認と正規表現評価。
   */
  const verifyNoImageCoercion = (
    operation: typeof projectDockerProxyConfiguration,
  ) => {
    let reads = 0;
    const object = Object.defineProperty({}, "toString", {
      get: () => {
        reads++;
        return () => input.proxyImageDigest;
      },
    });
    const proxied = new Proxy(
      {},
      {
        get: () => {
          reads++;
          return () => input.proxyImageDigest;
        },
      },
    );
    for (const image of [object, proxied])
      assert.equal(operation([], image as unknown as string), null);
    assert.equal(reads, 0);
  };
  verifyNoImageCoercion(projectDockerProxyConfiguration);
  const source = fs.readFileSync(
    new URL("../../../src/execution/plan.ts", import.meta.url),
    "utf8",
  );
  const parts = [];
  for (const name of [
    "snapshotDockerBoundaryArray",
    "planProxyContainerArguments",
    "projectDockerProxyConfiguration",
  ]) {
    const declaration = `function ${name}(`;
    assert.equal(source.split(declaration).length, 2);
    const begin = source.indexOf(declaration);
    const end = source.indexOf("\n/**", begin);
    assert.ok(end > begin);
    parts.push(source.slice(begin, end));
  }
  const needle = 'typeof image !== "string" ||';
  const body = stripTypeScriptTypes(parts.join("\n"));
  assert.equal(body.split(needle).length, 2);
  const mutant = vm.runInNewContext(
    `${body.replace(needle, "")}\nprojectDockerProxyConfiguration`,
    {
      utilTypes,
      DIAGNOSTIC_COMMAND_LIMIT: 9,
    },
  ) as typeof projectDockerProxyConfiguration;
  assert.throws(() => verifyNoImageCoercion(mutant), { code: "ERR_ASSERTION" });
  assert.deepEqual(createDockerAuthenticationEnvironment("CODEX_HOME"), {
    CODEX_HOME: "/provider-home",
  });
  assert.deepEqual(createDockerAuthenticationEnvironment(null), {});
  for (const name of [
    "",
    "HOME",
    "TMPDIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "bad-name",
    "CODEX_HOME\0",
  ])
    assert.equal(createDockerAuthenticationEnvironment(name), null);
});

/**
 * 技術包装集約の前後で全九argvを固定hashへ照合する。
 * @responsibility Provider二種・Workspace三形・Init／対話二値の24構成を保持する。
 * @trace ERB-UT-023
 * @precondition 移管前に同じ人工入力で取得した固定SHA256を使う。
 * @stimulus 24構成の九操作を構築する。
 * @observation 順序付きJSON全文のSHA256と計画数。
 * @oracle 個別flagだけでなくpayload・順序・全argvが前候補と一致する。
 * @cleanup N/A: 値だけ。
 * @boundary N/A: 純粋計画。
 */
test("Proxy包装集約は24構成の九argv全文を変更しない", () => {
  const plans = [];
  for (const profile of ["codex", "claude"])
    for (const workspace of [
      null,
      { sourcePath: "C:\\crdd\\workspace", readOnly: true },
      { sourcePath: "C:\\crdd\\workspace", readOnly: false },
    ])
      for (const initRequired of [false, true])
        for (const interactive of [false, true]) {
          const input = inputFixture();
          const plan = planDockerIsolationCommands({
            ...input,
            homeSourcePath: "C:\\crdd\\home",
            temporarySourcePath: "C:\\crdd\\tmp",
            workspace,
            proxy: {
              ...input.proxy,
              profile,
              extendedProxyEnvironment: profile === "codex",
            },
            execution: { ...input.execution, initRequired, interactive },
          });
          assert.ok(plan);
          plans.push(plan);
        }
  assert.equal(plans.length, 24);
  assert.equal(
    createHash("sha256").update(JSON.stringify(plans)).digest("hex"),
    "036f75bfd667da709b6b7af63f3f441685b67a051956e26dd8e87e3d3370a0cf",
  );
});

/**
 * Docker包装と内側payloadの診断境界を反証する。
 * @responsibility 内側の同名flag・digestから外側設定を捏造しないことを検証する。
 * @trace ERB-UT-023
 * @precondition 固定plannerと非秘密の人工引数を使う。
 * @stimulus 正常・欠測・重複・不正shapeを投影へ渡す。
 * @observation 三構成値、凍結payload、不正入力のnullとgetter呼出数。
 * @oracle 外側だけを判定し、payloadは再解釈せず全文保持する。
 * @cleanup N/A: 純粋計算だけ。
 * @boundary N/A: ProcessやDockerを起動しない。
 */
test("Docker境界診断は包装だけを読みpayloadのflag・同digestを解釈しない", () => {
  const input = inputFixture();
  const digest = input.executionImageDigest;
  const payload = [
    "exec",
    "--read-only",
    "--user=65534:65534",
    "--workdir=/work",
    digest,
    "create",
  ];
  for (const workspace of [
    null,
    { sourcePath: path.resolve("workspace"), readOnly: false },
    { sourcePath: path.resolve("workspace"), readOnly: true },
  ]) {
    const commands = planDockerIsolationCommands({
      ...input,
      workspace,
      execution: { ...input.execution, argv: payload },
    });
    const actual = projectDockerExecutionBoundary(commands, digest);
    assert.ok(actual);
    assert.equal(actual.rootFilesystemReadOnlyConfigured, true);
    assert.equal(actual.nonRootUserConfigured, true);
    assert.equal(actual.workdirConfigured, true);
    assert.deepEqual(actual.payloadArgv, payload);
    assert.notEqual(actual.payloadArgv, payload);
    assert.ok(Object.isFrozen(actual.payloadArgv));
  }
  const command = {
    purpose: "create_provider",
    argv: ["create", digest, ...payload],
  };
  assert.deepEqual(projectDockerExecutionBoundary([command], digest), {
    rootFilesystemReadOnlyConfigured: false,
    nonRootUserConfigured: false,
    workdirConfigured: false,
    payloadArgv: payload,
  });
  for (const argv of [
    [
      "create",
      "--user",
      "65534:65534",
      "--workdir",
      "/work",
      "--read-only",
      digest,
      "exec",
    ],
    [
      "create",
      "--user=65534:65534",
      "--workdir=/work",
      "--read-only",
      digest,
      "exec",
    ],
  ]) {
    const result = projectDockerExecutionBoundary(
      [{ purpose: "create_provider", argv }],
      digest,
    );
    assert.ok(result);
    assert.equal(result.nonRootUserConfigured, true);
    assert.equal(result.workdirConfigured, true);
  }
  for (const invalid of [
    [],
    [command, command],
    [{ purpose: "create_provider", argv: ["create", "--unknown", digest] }],
    [{ purpose: "create_provider", argv: ["create", "--user"] }],
    [
      {
        purpose: "create_provider",
        argv: ["create", "--network", "--read-only", digest],
      },
    ],
    [
      {
        purpose: "create_provider",
        argv: ["create", "--user", "--workdir=/work", digest],
      },
    ],
    [
      {
        purpose: "create_provider",
        argv: ["create", "--mount", "--security-opt=no-new-privileges", digest],
      },
    ],
    [
      {
        purpose: "create_provider",
        argv: ["create", "--read-only", "--read-only", digest],
      },
    ],
    [{ purpose: "create_provider", argv: ["create", "wrong-image", digest] }],
    [{ purpose: "create_provider", argv: ["create", 12, digest] }],
    new Proxy([command], {}),
    null,
  ])
    assert.equal(projectDockerExecutionBoundary(invalid, digest), null);
  let reads = 0;
  const accessor = Object.defineProperty(
    { purpose: "create_provider" },
    "argv",
    {
      enumerable: true,
      get() {
        reads += 1;
        return command.argv;
      },
    },
  );
  assert.equal(projectDockerExecutionBoundary([accessor], digest), null);
  assert.equal(reads, 0);
  assert.equal(projectDockerExecutionBoundary([command], "wrong"), null);
});

/**
 * 上位とplannerが共有する資源文法の閉じた判定を反証する。
 * @responsibility 八項目の型・文法と五名全組合せの重複拒否を確認する。
 * @trace ERB-UT-023
 * @precondition 同じfixtureから非秘密の八項目だけを投影する。
 * @stimulus 二Provider、各fieldの不正型・欠測・形式差と全十重複を与える。
 * @observation validatorのboolと実plannerの受理／nullを確認する。
 * @oracle 文法不正は拒否し、正常boolをAuthorityとして使わず上位意味照合を維持する。
 * @cleanup N/A: 値検査のみ、実資源なし。
 * @boundary 上位Identity投影とDI文法。
 */
test("資源Identityの八項目と五名重複は同じDI文法で拒否する", () => {
  const input = inputFixture();
  const identity = {
    authenticationContainerName: input.authenticationContainerName,
    executionContainerName: input.executionContainerName,
    proxyContainerName: input.proxyContainerName,
    internalNetworkName: input.internalNetworkName,
    egressNetworkName: input.egressNetworkName,
    ownershipLabel: input.ownershipLabel,
    executionImageDigest: input.executionImageDigest,
    proxyImageDigest: input.proxyImageDigest,
  };
  for (const provider of ["codex", "claude"]) {
    const candidate = {
      ...identity,
      executionContainerName: `crdd-${provider}-${"a".repeat(16)}`,
    };
    assert.equal(dockerIsolationResourceIdentityIsValid(candidate), true);
    assert.ok(planDockerIsolationCommands({ ...input, ...candidate }));
  }
  for (const key of Object.keys(identity)) {
    for (const value of [undefined, null, 1, "", "invalid", {}]) {
      const candidate = { ...identity, [key]: value };
      assert.equal(
        dockerIsolationResourceIdentityIsValid(candidate),
        false,
        key,
      );
      assert.equal(
        planDockerIsolationCommands({ ...input, ...candidate }),
        null,
        key,
      );
    }
  }
  const names = [
    "authenticationContainerName",
    "executionContainerName",
    "proxyContainerName",
    "internalNetworkName",
    "egressNetworkName",
  ] as const;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const left = names[i];
      const right = names[j];
      assert.ok(left && right);
      const candidate = { ...identity, [left]: identity[right] };
      assert.equal(dockerIsolationResourceIdentityIsValid(candidate), false);
      assert.equal(
        planDockerIsolationCommands({ ...input, ...candidate }),
        null,
      );
    }
  }
});

/**
 * 現plannerの最大構成と診断入力の上限を照合する。
 * @responsibility 有効最大形を受理し各上限超過だけを拒否する。
 * @trace ERB-UT-023
 * @precondition 最大64環境変数・256payload・全optional構成を使う。
 * @stimulus 実planner最大形とcommands／argvの各＋1を投影する。
 * @observation 9command・428argvの実測値と受理／null。
 * @oracle descriptor全走査前の上限が固定producerを切詰めない。
 * @cleanup N/A: 実資源なし。
 * @boundary N/A: 値の計画と診断のみ。
 */
test("診断上限は現planner最大9command・428argvを受け各＋1を拒否する", () => {
  const input = inputFixture();
  const commands = planDockerIsolationCommands({
    ...input,
    workspace: { sourcePath: path.resolve("workspace"), readOnly: true },
    execution: {
      ...input.execution,
      argv: Array(256).fill("payload"),
      environment: Object.fromEntries(
        Array.from({ length: 64 }, (_, index) => [`TEST_${index}`, "value"]),
      ),
      initRequired: true,
      interactive: true,
      seccompProfile: {
        sha256:
          "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
        bytes: 16_703,
      },
    },
    proxy: {
      ...input.proxy,
      extendedProxyEnvironment: true,
      networkPolicy: (() => {
        const result = prepareDockerNetworkPolicy("codex", []);
        if (result.status !== "ready") throw new Error("fixture");
        return result.policy;
      })(),
    },
  });
  assert.ok(commands);
  assert.equal(commands.length, 9);
  const command = commands.find((item) => item.purpose === "create_provider");
  assert.ok(command);
  assert.equal(command.argv.length, 428);
  assert.equal(
    projectDockerExecutionBoundary(commands, input.executionImageDigest)
      ?.payloadArgv.length,
    256,
  );
  assert.equal(
    projectDockerExecutionBoundary(
      [...commands, { purpose: "extra", argv: [] }],
      input.executionImageDigest,
    ),
    null,
  );
  assert.equal(
    projectDockerExecutionBoundary(
      [{ ...command, argv: [...command.argv, "extra"] }],
      input.executionImageDigest,
    ),
    null,
  );
});

/**
 * Seccompの入力は固定実物の期待Identityだけを受ける。
 * @responsibility 任意Path、欠測と不正IdentityをDocker要求前の計画で拒否する。
 * @trace ERB-UT-023
 * @precondition 通常fixtureと固定配布物のHash・容量を使う。
 * @stimulus 正常、Hash／容量差、欠測、旧Path fieldを与える。
 * @observation nullまたは固定Seccomp option一個を観測する。
 * @oracle 適用外nullは受理し、指定時の不明を適用外へ補完しない。
 * @cleanup N/A: 固定Artifact読取りのみ、Docker要求なし。
 * @boundary DI技術計画と固定Artifact。
 */
test("Seccompは固定Identityで計画し旧Pathと欠測を拒否する", () => {
  const input = inputFixture();
  const identity = {
    sha256: "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
    bytes: 16_703,
  };
  const planned = planDockerIsolationCommands({
    ...input,
    execution: { ...input.execution, seccompProfile: identity },
  });
  assert.ok(planned);
  assert.equal(
    planned
      .flatMap((command) => command.argv)
      .filter((value) => value.startsWith("--security-opt=seccomp=")).length,
    1,
  );
  for (const seccompProfile of [
    { ...identity, sha256: "0".repeat(64) },
    { ...identity, bytes: identity.bytes + 1 },
    { ...identity, bytes: -1 },
    undefined,
  ]) {
    assert.equal(
      planDockerIsolationCommands({
        ...input,
        execution: { ...input.execution, seccompProfile },
      } as DockerIsolationCommandInput),
      null,
    );
  }
  const legacy = {
    ...input,
    execution: {
      ...input.execution,
      seccompProfilePath: path.resolve("arbitrary.json"),
    },
  };
  assert.equal(planDockerIsolationCommands(legacy), null);
  assert.ok(planDockerIsolationCommands(input));
});

/**
 * 実本文のdescriptor検査を隔離Realm内の継承汚染で反証する。
 * @responsibility Hostを汚染せずown必須keyとown valueの拒否を検査する。
 * @trace ERB-UT-023
 * @precondition 同期純粋helperの実Sourceを型除去し、VM内だけで汚染する。
 * @stimulus 正常・accessor・欠測keyを通常版とown-value省略変異へ渡す。
 * @observation 受理、拒否、getter0と変異検出。
 * @oracle 通常版だけが不正形を拒否し、変異版は同じ負対照を破る。
 * @cleanup VM参照を呼出し終了で解放。Host prototype変更なし。
 * @boundary N/A: 実Docker・Process・保存処理は使わない。
 */
test("診断descriptorは隔離VMの継承value・継承必須keyを受理しない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/plan.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function snapshotDockerBoundaryArray(");
  const end = source.indexOf("export type DockerIsolationResourceNames");
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end)).replace(
    "export function projectDockerExecutionBoundary",
    "function projectDockerExecutionBoundary",
  );
  const probe = `
    const digest = "sha256:" + "a".repeat(64);
    const good = {purpose: "create_provider", argv: ["create", "--read-only", digest]};
    let reads = 0;
    const accessor = Object.defineProperty({purpose: "create_provider"}, "argv", {enumerable: true, get() {reads++; return good.argv;}});
    const indexAccessor = Object.defineProperty([], "0", {enumerable: true, get() {reads++; return good;}});
    const purposeAccessor = Object.defineProperty({argv: good.argv}, "purpose", {enumerable: true, get() {reads++; return "create_provider";}});
    const normal = projectDockerExecutionBoundary([good], digest)?.rootFilesystemReadOnlyConfigured === true;
    Object.prototype.value = good.argv;
    const accessorRejected = projectDockerExecutionBoundary([accessor], digest) === null;
    Object.prototype.value = good;
    const indexRejected = projectDockerExecutionBoundary(indexAccessor, digest) === null;
    Object.prototype.value = "create_provider";
    const purposeRejected = projectDockerExecutionBoundary([purposeAccessor], digest) === null;
    delete Object.prototype.value;
    Object.prototype.purpose = {value: "create_provider"};
    Object.prototype.argv = {value: good.argv};
    const missingRejected = projectDockerExecutionBoundary([{extraA: 1, extraB: 2}], digest) === null;
    const missingPurposeRejected = projectDockerExecutionBoundary([{argv: good.argv, extra: 1}], digest) === null;
    const missingArgvRejected = projectDockerExecutionBoundary([{purpose: "create_provider", extra: 1}], digest) === null;
    const sparse = [];
    sparse.length = 1;
    sparse.extra = true;
    Object.defineProperty(Object.prototype, "0", {configurable: true, get() {reads++; return {value: good};}});
    const sparseRejected = projectDockerExecutionBoundary(sparse, digest) === null;
    delete Object.prototype["0"];
    JSON.stringify({normal, accessorRejected, indexRejected, purposeRejected, missingRejected, missingPurposeRejected, missingArgvRejected, sparseRejected, reads});`;
  const prelude =
    "const DIAGNOSTIC_COMMAND_LIMIT = 9; const DIAGNOSTIC_CREATE_ARGUMENT_LIMIT = 428;";
  const actual = JSON.parse(
    vm.runInNewContext(
      prelude + body + probe,
      { utilTypes },
      { timeout: 1000 },
    ),
  );
  assert.deepEqual(actual, {
    normal: true,
    accessorRejected: true,
    indexRejected: true,
    purposeRejected: true,
    missingRejected: true,
    missingPurposeRejected: true,
    missingArgvRejected: true,
    sparseRejected: true,
    reads: 0,
  });
  for (const [name, field] of [
    ["descriptor", "indexRejected"],
    ["purpose", "purposeRejected"],
    ["args", "accessorRejected"],
  ] as const) {
    const mutant = body.replaceAll(
      `Object.hasOwn(${name}, "value")`,
      `"value" in ${name}`,
    );
    assert.notEqual(mutant, body);
    const mutated = JSON.parse(
      vm.runInNewContext(
        prelude + mutant + probe,
        { utilTypes },
        { timeout: 1000 },
      ),
    );
    assert.equal(mutated.normal, true);
    assert.equal(mutated[field], false);
    assert.equal(mutated.reads, 0);
  }
  const lookupMutant = body.replace(
    /Object\.getOwnPropertyDescriptor\(\s*value,\s*String\(index\),?\s*\)/u,
    "Object.getOwnPropertyDescriptors(value)[String(index)]",
  );
  assert.notEqual(lookupMutant, body);
  const lookedUp = JSON.parse(
    vm.runInNewContext(
      prelude + lookupMutant + probe,
      { utilTypes },
      { timeout: 1000 },
    ),
  );
  assert.equal(lookedUp.normal, true);
  assert.equal(lookedUp.sparseRejected, true);
  assert.equal(lookedUp.reads, 1);
});

/**
 * 固定した技術構成の試験入力を用意する。
 *
 * @responsibility 本番SecretやHost実体を使わない純粋入力を構築する。
 * @trace ERB-UT-023
 * @precondition 試験は構成断面だけを対象とする。
 * @stimulus 固定名、digest、payload、所在文字列を組み立てる。
 * @observation planDockerIsolationCommandsの返却値を取得する。
 * @oracle 同じ固定入力から隔離flagと操作順序を照合できる。
 * @cleanup N/A: ファイル・Process・Docker資源を作成しない。
 * @boundary N/A: 同一Process内の値構築。
 */
function inputFixture(): DockerIsolationCommandInput {
  return {
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
      argv: ["exec", "--privileged"],
      environment: { CODEX_HOME: "/provider-home" },
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
  };
}

/**
 * 固定権限制限とWorkspace条件の有限な組合せを検証する。
 *
 * @responsibility 技術構成を役割・Providerの意味から独立して固定する。
 * @trace ERB-UT-023
 * @precondition Workspaceなし／読取り／書込み、Initと対話の全組合せを用いる。
 * @stimulus 各入力から九コマンドを構築する。
 * @observation 操作順序、制限flag、Mount modeとImage以後のpayloadを読む。
 * @oracle 権限制限が全Containerにあり、WorkspaceとInit／対話だけが期待どおり変わる。
 * @cleanup N/A: 純粋計画で外部資源を取得しない。
 * @boundary N/A: 外部境界の成立は別のIT／実Docker確認へ残す。
 */
test("閉じた九操作で隔離制限とWorkspace／Init／対話条件を固定する", () => {
  for (const workspace of [null, true, false]) {
    for (const initRequired of [false, true]) {
      for (const interactive of [false, true]) {
        const input = inputFixture();
        const commands = planDockerIsolationCommands({
          ...input,
          workspace:
            workspace === null
              ? null
              : {
                  sourcePath: path.resolve("fixture-work"),
                  readOnly: workspace,
                },
          execution: { ...input.execution, initRequired, interactive },
        });
        assert.ok(commands);
        assert.equal(commands.length, 9);
        for (const index of [0, 4, 6]) {
          const argv = commands[index]?.argv;
          assert.ok(argv);
          for (const flag of [
            "--read-only",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--user=65534:65534",
            "--pull=never",
          ]) {
            assert.ok(argv.includes(flag));
          }
        }
        const execution = commands[6]?.argv;
        assert.ok(execution);
        assert.equal(execution.includes("--init"), initRequired);
        assert.equal(execution.includes("--interactive"), interactive);
        assert.deepEqual(
          execution.slice(execution.indexOf(input.executionImageDigest) + 1),
          input.execution.argv,
        );
        assert.ok(
          !execution
            .slice(0, execution.indexOf(input.executionImageDigest))
            .includes("--privileged"),
        );
        const workMount = execution.find((value) =>
          value.includes("dst=/work,"),
        );
        assert.equal(workMount !== undefined, workspace !== null);
        if (workMount) assert.equal(workMount.endsWith(",readonly"), workspace);
      }
    }
  }
});

/**
 * 不正所在・資源・payloadによる計画構築を拒否する。
 *
 * @responsibility Docker構成に影響する不正値をEffect発行前に停止する。
 * @trace ERB-UT-023
 * @precondition 各反例は正常入力の一条件だけを変更する。
 * @stimulus 不正入力で構築を要求する。
 * @observation null結果を確認する。
 * @oracle 既定値への置換や部分計画を返さない。
 * @cleanup N/A: 値の構築だけで実資源は取得しない。
 * @boundary N/A: 純粋拒否を実Effect 0の実測へ一般化しない。
 */
test("不正資源・所在・Proxy・payloadは部分計画へ補完しない", () => {
  const input = inputFixture();
  const invalid: readonly DockerIsolationCommandInput[] = [
    { ...input, authenticationContainerName: "foreign" },
    { ...input, proxyContainerName: input.executionContainerName },
    { ...input, executionImageDigest: "latest" },
    { ...input, homeSourcePath: "relative" },
    { ...input, temporarySourcePath: `${input.temporarySourcePath},extra` },
    { ...input, proxy: { ...input.proxy, port: 0 } },
    { ...input, proxy: { ...input.proxy, token: "invalid" } },
    { ...input, execution: { ...input.execution, argv: ["x\0y"] } },
    {
      ...input,
      execution: { ...input.execution, argv: ["x".repeat(128 * 1024)] },
    },
    {
      ...input,
      execution: {
        ...input.execution,
        environment: { HTTPS_PROXY: "foreign" },
      },
    },
  ];
  for (const candidate of invalid)
    assert.equal(planDockerIsolationCommands(candidate), null);
});

/**
 * 構築済みargvを元payloadの変更から分離する。
 *
 * @responsibility Effect前照合で使う計画値の不変性を確認する。
 * @trace ERB-UT-023
 * @precondition 入力argvだけを後から変更する。
 * @stimulus 構築後に入力配列へ別要素を追加する。
 * @observation 元の構築結果の末尾、Objectと配列のfreezeを読む。
 * @oracle 返却結果に後発要素がなく、全操作とargvが不変である。
 * @cleanup N/A: Process内の値だけを使用する。
 * @boundary N/A: 値の不変性は実資源Identityの証明ではない。
 */
test("元payloadの後発変更を凍結した計画へ搬送しない", () => {
  const argv = ["exec"];
  const input = inputFixture();
  const commands = planDockerIsolationCommands({
    ...input,
    execution: { ...input.execution, argv },
  });
  assert.ok(commands);
  argv.push("late");
  assert.ok(Object.isFrozen(commands));
  for (const command of commands) {
    assert.ok(Object.isFrozen(command));
    assert.ok(Object.isFrozen(command.argv));
    assert.ok(!command.argv.includes("late"));
  }
});

/**
 * 共通資源名と乱数検査が既存境界を二namespaceで維持することを確認する。
 *
 * @responsibility 有限実行namespace、実行Identity形式、63文字上限とBuffer取得長を反証する。
 * @trace ERB-UT-023
 * @precondition 実Docker・外部AIを使わず固定値を共通準備処理へ渡す。
 * @stimulus 二namespaceの正常値、不正Identity、名前長境界と乱数型・長さ違反を与える。
 * @observation 返却資源名、null、例外および乱数取得回数。
 * @oracle 既存prefixと上限を維持し、不正取得を補完しない。
 * @cleanup N/A: 局所値だけで実資源やStoreを作成しない。
 * @boundary N/A: Process内の値生成だけを確認する。
 */
test("共通Docker資源名は実行Identity形式・63文字境界と乱数長を維持する", () => {
  for (const executionNamespace of ["codex", "claude"] as const) {
    const names = createDockerIsolationResourceNames(
      executionNamespace,
      "a".repeat(64),
      "b".repeat(16),
    );
    assert.deepEqual(names, {
      internalNetworkName: `crdd-internal-${"b".repeat(16)}`,
      egressNetworkName: `crdd-egress-${"b".repeat(16)}`,
      proxyContainerName: `crdd-proxy-${"b".repeat(16)}`,
      authContainerName: `crdd-auth-${"b".repeat(16)}`,
      providerContainerName: `crdd-${executionNamespace}-${"a".repeat(16)}`,
      ownershipLabel: `crdd.coordinator.runtime=${"b".repeat(16)}`,
    });
    for (const executionIdentityHash of [
      "",
      "a".repeat(63),
      "a".repeat(65),
      "A".repeat(64),
      "g".repeat(64),
    ])
      assert.equal(
        createDockerIsolationResourceNames(
          executionNamespace,
          executionIdentityHash,
          "b".repeat(16),
        ),
        null,
      );
    const maximumSuffix = 63 - "crdd-internal-".length;
    assert.equal(
      createDockerIsolationResourceNames(
        executionNamespace,
        "a".repeat(64),
        "b".repeat(maximumSuffix),
      )?.internalNetworkName.length,
      63,
    );
    assert.equal(
      createDockerIsolationResourceNames(
        executionNamespace,
        "a".repeat(64),
        "b".repeat(maximumSuffix + 1),
      ),
      null,
    );
  }
  for (const namespace of ["", "CODEX", "other", "claude ", "codex;"]) {
    assert.equal(
      createDockerIsolationResourceNames(
        namespace,
        "a".repeat(64),
        "b".repeat(16),
      ),
      null,
    );
  }
  for (const bytes of [8, 32]) {
    for (const delta of [-1, 1]) {
      assert.equal(
        createDockerIsolationRandomHex(
          { randomBytes: () => Buffer.alloc(bytes + delta) },
          bytes,
        ),
        null,
      );
    }
    const failure = new Error("exact_random_failure");
    assert.throws(
      () =>
        createDockerIsolationRandomHex(
          {
            randomBytes: () => {
              throw failure;
            },
          },
          bytes,
        ),
      (error: unknown) => error === failure,
    );
  }
  let calls = 0;
  const state = {
    randomBytes: (size: number) => {
      calls += 1;
      return Buffer.alloc(size, 0xab);
    },
  };
  assert.equal(createDockerIsolationRandomHex(state, 8), "ab".repeat(8));
  assert.equal(createDockerIsolationRandomHex(state, 32), "ab".repeat(32));
  assert.equal(calls, 2);
  assert.equal(
    createDockerIsolationRandomHex({ randomBytes: () => Buffer.alloc(7) }, 8),
    null,
  );
  assert.equal(
    createDockerIsolationRandomHex(
      { randomBytes: () => new Uint8Array(8) as unknown as Buffer },
      8,
    ),
    null,
  );
  assert.throws(
    () =>
      createDockerIsolationRandomHex(
        {
          randomBytes: () => {
            throw new Error("fixed_random_failure");
          },
        },
        8,
      ),
    /fixed_random_failure/u,
  );
});
