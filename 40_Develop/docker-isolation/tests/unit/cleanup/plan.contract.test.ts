/**
 * 固定Execution PlanとDocker観測値の純粋構成照合を検証する。
 *
 * @packageDocumentation
 * @responsibility 通常清掃と回復が共有するIdentity・隔離条件を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 共通Execution Planの技術構成断面。実Docker・削除許可・不存在は確認しない。
 * @boundary N/A: 固定JSON値の照合だけ。
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { dockerAuthenticationResourceConfigurationMatches } from "../../../src/cleanup/plan.ts";
import {
  dockerResourceConfigurationMatches,
  planDockerRecoveryResourceExpectations,
  type DockerResourceExpectation,
} from "../../../src/index.ts";

/**
 * 三本Mountの観測と回収期待値を照合する。
 * @responsibility 保護領域の欠落、RW化、Source差を拒否する。
 * @trace ERB-UT-023
 * @precondition 元計画に二placeholder Sourceを固定する。
 * @stimulus 正常観測と一条件差を与える。
 * @observation 構成判定のboolean。
 * @oracle 二保護領域は元SourceのRO bindだけを受理する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 回収許可や実不存在は主張しない。
 */
test("Workspace保護Mountは欠落・RW・Source差を拒否する", () => {
  const { resource, expectation } = fixture();
  const protection = {
    gitSourcePath: path.resolve("mask-git"),
    internalSourcePath: path.resolve("mask-internal"),
  };
  const expected = {
    ...expectation,
    workspaceProtected: true,
    workspaceProtection: protection,
  };
  const masks = [
    {
      Type: "bind",
      Source: protection.gitSourcePath,
      Destination: "/work/.git",
      RW: false,
      Propagation: "rprivate",
    },
    {
      Type: "bind",
      Source: protection.internalSourcePath,
      Destination: "/work/.crdd",
      RW: false,
      Propagation: "rprivate",
    },
  ];
  const observed = { ...resource, Mounts: [...resource.Mounts, ...masks] };
  assert.equal(dockerResourceConfigurationMatches(observed, expected), true);
  for (const Mounts of [
    observed.Mounts.slice(0, -1),
    observed.Mounts.map((m) =>
      m.Destination === "/work/.git" ? { ...m, RW: true } : m,
    ),
    observed.Mounts.map((m) =>
      m.Destination === "/work/.crdd"
        ? { ...m, Source: path.resolve("different") }
        : m,
    ),
    [...observed.Mounts, masks[0]],
  ])
    assert.equal(
      dockerResourceConfigurationMatches({ ...resource, Mounts }, expected),
      false,
    );
});

/**
 * 現在回収の固定五用途と二候補を独立した完全期待値へ照合する。
 * @responsibility 上位から移した順序・全field・独立booleanと不変性を確認する。
 * @trace ERB-UT-023
 * @precondition 非秘密の名前・digestと三booleanだけを使用する。
 * @stimulus 三booleanの全組合せ、各入力の欠測・不正型と不正Identityを与える。
 * @observation 五用途の完全配列、入れ子freeze、入力の前後値とnull拒否。
 * @oracle 手書きの全期待値へ一致し、Proxyは内部のみ候補が先、認証はnone、NetworkにImageやflagなし。
 * @cleanup N/A: 純粋な値だけを使用する。
 * @boundary ERB-UT-023=Unit: 技術期待値planner。
 */
test("回収期待値は固定五用途・Proxy二候補と独立booleanを下位で所有する", () => {
  const names = {
    auth: "crdd-auth-0123456789abcdef",
    provider: "crdd-codex-0123456789abcdef",
    proxy: "crdd-proxy-0123456789abcdef",
    internal: "crdd-internal-0123456789abcdef",
    egress: "crdd-egress-0123456789abcdef",
  };
  const label = "crdd.coordinator.runtime=0123456789abcdef";
  const providerImage = `sha256:${"a".repeat(64)}`,
    proxyImage = `sha256:${"b".repeat(64)}`;
  const baseInput = {
    authenticationContainerName: names.auth,
    executionContainerName: names.provider,
    proxyContainerName: names.proxy,
    internalNetworkName: names.internal,
    egressNetworkName: names.egress,
    ownershipLabel: label,
    executionImageDigest: providerImage,
    proxyImageDigest: proxyImage,
    workspaceMounted: false,
    workspaceReadOnly: false,
    initRequired: false,
  };
  for (const workspaceMounted of [false, true])
    for (const workspaceReadOnly of [false, true])
      for (const initRequired of [false, true]) {
        const input = {
            ...baseInput,
            workspaceMounted,
            workspaceReadOnly,
            initRequired,
          },
          before = structuredClone(input);
        const proxy = {
          purpose: "create_proxy",
          kind: "container",
          expectedName: names.proxy,
          ownershipLabel: label,
          expectedImage: proxyImage,
          shouldBeInternal: null,
          expectedNetworks: [names.internal],
          workspaceMounted: false,
          workspaceReadOnly: false,
          initRequired: false,
        };
        const expected = [
          {
            purpose: "create_provider",
            expectations: [
              {
                purpose: "create_provider",
                kind: "container",
                expectedName: names.provider,
                ownershipLabel: label,
                expectedImage: providerImage,
                shouldBeInternal: null,
                expectedNetworks: [names.internal],
                workspaceMounted,
                workspaceReadOnly,
                initRequired,
              },
            ],
          },
          {
            purpose: "create_subscription_auth_probe",
            expectations: [
              {
                purpose: "create_subscription_auth_probe",
                kind: "container",
                expectedName: names.auth,
                ownershipLabel: label,
                expectedImage: providerImage,
                shouldBeInternal: null,
                expectedNetworks: ["none"],
                workspaceMounted: false,
                workspaceReadOnly: false,
                initRequired: false,
              },
            ],
          },
          {
            purpose: "create_proxy",
            expectations: [
              proxy,
              { ...proxy, expectedNetworks: [names.internal, names.egress] },
            ],
          },
          {
            purpose: "create_internal_network",
            expectations: [
              {
                purpose: "create_internal_network",
                kind: "network",
                expectedName: names.internal,
                ownershipLabel: label,
                expectedImage: null,
                shouldBeInternal: true,
                expectedNetworks: [],
                workspaceMounted: false,
                workspaceReadOnly: false,
                initRequired: false,
              },
            ],
          },
          {
            purpose: "create_egress_network",
            expectations: [
              {
                purpose: "create_egress_network",
                kind: "network",
                expectedName: names.egress,
                ownershipLabel: label,
                expectedImage: null,
                shouldBeInternal: false,
                expectedNetworks: [],
                workspaceMounted: false,
                workspaceReadOnly: false,
                initRequired: false,
              },
            ],
          },
        ];
        const plan = planDockerRecoveryResourceExpectations(input);
        assert.deepEqual(plan, expected);
        assert.deepEqual(input, before);
        assert.ok(Object.isFrozen(plan));
        assert.ok(plan);
        for (const entry of plan) {
          assert.ok(Object.isFrozen(entry));
          assert.ok(Object.isFrozen(entry.expectations));
          for (const expectation of entry.expectations) {
            assert.ok(Object.isFrozen(expectation));
            assert.ok(Object.isFrozen(expectation.expectedNetworks));
          }
        }
      }
  for (const key of Object.keys(baseInput))
    for (const invalid of [undefined, null, "invalid", 1]) {
      assert.equal(
        planDockerRecoveryResourceExpectations({
          ...baseInput,
          [key]: invalid,
        } as typeof baseInput),
        null,
        key,
      );
    }
  for (const invalid of [undefined, null, [], "invalid"])
    assert.equal(
      planDockerRecoveryResourceExpectations(
        invalid as unknown as typeof baseInput,
      ),
      null,
    );
  let getterCalls = 0,
    trapCalls = 0,
    coercionCalls = 0;
  const accessor = { ...baseInput };
  Object.defineProperty(accessor, "ownershipLabel", {
    get() {
      getterCalls++;
      return label;
    },
  });
  const proxyInput = new Proxy(baseInput, {
    get() {
      trapCalls++;
      throw new Error("must_not_read");
    },
    ownKeys() {
      trapCalls++;
      throw new Error("must_not_enumerate");
    },
  });
  const inherited = Object.create(baseInput);
  const coercingValue = {
    toString() {
      coercionCalls++;
      return label;
    },
  };
  for (const invalid of [
    accessor,
    proxyInput,
    inherited,
    { ...baseInput, extra: true },
    { ...baseInput, ownershipLabel: Object(label) },
    { ...baseInput, initRequired: Object(false) },
    { ...baseInput, ownershipLabel: coercingValue },
  ])
    assert.equal(
      planDockerRecoveryResourceExpectations(invalid as typeof baseInput),
      null,
    );
  assert.equal(getterCalls, 0);
  assert.equal(trapCalls, 0);
  assert.equal(coercionCalls, 0);
});

/**
 * 認証Probeの固定作成構成を正常と反例で照合する。
 * @responsibility Taskとは異なる認証Label・Home mount・実IDの条件を検証する。
 * @trace ERB-UT-023
 * @precondition 実Dockerではなく固定inspect値を使う。
 * @stimulus 元create操作に実ID・mount source・Cmd・Env・Networkの差を与える。
 * @observation 純粋判定の結果を得る。
 * @oracle 同名・同Labelでも別実IDや構成差は拒否する。
 * @cleanup N/A: 局所値だけを生成する。
 * @boundary ERB-UT-023=Unit: 認証技術構成の照合。
 */
test("認証Probeは実IDと元createの構成全体を照合する", () => {
  const id = "a".repeat(64);
  const image = `sha256:${"b".repeat(64)}`;
  const name = `crdd-auth-${"1".repeat(16)}`;
  const source = "C:/owned/ProviderHomes/claude";
  const label = "2".repeat(16);
  const command = Object.freeze({
    purpose: "create_probe",
    interactive: false,
    argv: [
      "create",
      "--name",
      name,
      "--label",
      `crdd.coordinator.authentication=${label}`,
      "--network=none",
      "--env",
      "HOME=/provider-home",
      "--mount",
      `type=bind,src=${source},dst=/provider-home,readonly`,
      image,
      "claude",
      "auth",
      "status",
    ],
  });
  const resource = {
    Id: id,
    Name: `/${name}`,
    Config: {
      Image: image,
      User: "65534:65534",
      Labels: { "crdd.coordinator.authentication": label },
      Entrypoint: ["claude"],
      WorkingDir: "/work",
      Env: ["HOME=/provider-home"],
      Cmd: ["claude", "auth", "status"],
    },
    HostConfig: {
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: ["ALL"],
      CapAdd: null,
      SecurityOpt: ["no-new-privileges"],
      PidsLimit: 0,
      Init: false,
      NetworkMode: "none",
      Tmpfs: null,
    },
    NetworkSettings: { Networks: { none: {} } },
    Mounts: [
      {
        Type: "bind",
        Source: source,
        Destination: "/provider-home",
        RW: false,
        Propagation: "rprivate",
      },
    ],
  };
  const metadata = { Entrypoint: ["claude"], WorkingDir: "/work", Env: [] };
  assert.equal(
    dockerAuthenticationResourceConfigurationMatches(
      resource,
      command,
      id,
      false,
      metadata,
    ),
    true,
  );
  for (const invalid of [
    { ...resource, Id: "c".repeat(64) },
    { ...resource, Config: { ...resource.Config, Cmd: ["other"] } },
    { ...resource, Config: { ...resource.Config, Env: [] } },
    {
      ...resource,
      Config: {
        ...resource.Config,
        Env: [...resource.Config.Env, "HOME=/foreign"],
      },
    },
    {
      ...resource,
      Config: {
        ...resource.Config,
        Env: [...resource.Config.Env, "EXTRA=unexpected"],
      },
    },
    { ...resource, Config: { ...resource.Config, Entrypoint: ["other"] } },
    { ...resource, Config: { ...resource.Config, WorkingDir: "/foreign" } },
    { ...resource, HostConfig: { ...resource.HostConfig, Privileged: true } },
    { ...resource, Mounts: [{ ...resource.Mounts[0], Source: "C:/foreign" }] },
    { ...resource, NetworkSettings: { Networks: { bridge: {} } } },
    { ...resource, Mounts: [...resource.Mounts, resource.Mounts[0]] },
  ])
    assert.equal(
      dockerAuthenticationResourceConfigurationMatches(
        invalid,
        command,
        id,
        false,
        metadata,
      ),
      false,
    );
});

/**
 * 固定隔離構成と同じDocker wire値を作る。
 *
 * @responsibility 実IDと構成を別々に変更できる試験入力を構築する。
 * @trace ERB-UT-023
 * @precondition Containerの純粋照合だけを対象とする。
 * @stimulus 固定Id、Label、Image、Network、MountとHostConfigを組み立てる。
 * @observation 期待値と観測値を返す。
 * @oracle 一条件の欠落・差替えでtrueが返る反例を検出できる。
 * @cleanup N/A: Filesystem・Process・Docker資源を取得しない。
 * @boundary N/A: JSON値の構築。
 */
function fixture() {
  const expectation: DockerResourceExpectation = {
    kind: "container",
    dockerId: "a".repeat(64),
    expectedName: `crdd-codex-${"1".repeat(16)}`,
    ownershipLabel: `crdd.coordinator.runtime=${"2".repeat(16)}`,
    expectedImage: `sha256:${"b".repeat(64)}`,
    shouldBeInternal: null,
    purpose: "create_provider",
    expectedNetworks: [`crdd-internal-${"3".repeat(16)}`],
    workspaceMounted: true,
    workspaceReadOnly: true,
    initRequired: true,
  };
  const resource = {
    Id: expectation.dockerId,
    Name: `/${expectation.expectedName}`,
    Config: {
      Labels: { "crdd.coordinator.runtime": "2".repeat(16) },
      Image: expectation.expectedImage,
      User: "65534:65534",
    },
    HostConfig: {
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: ["ALL"],
      CapAdd: null,
      SecurityOpt: ["no-new-privileges"],
      PidsLimit: 0,
      Init: true,
    },
    NetworkSettings: {
      Networks: { [expectation.expectedNetworks[0] as string]: {} },
    },
    Mounts: [
      {
        Type: "bind",
        Destination: "/provider-home",
        RW: true,
        Propagation: "rprivate",
      },
      { Type: "bind", Destination: "/tmp", RW: true, Propagation: "rprivate" },
      {
        Type: "bind",
        Destination: "/work",
        RW: false,
        Propagation: "rprivate",
      },
    ],
  };
  return { expectation, resource };
}

/**
 * Identityだけでなく隔離条件の全一致を要求する。
 *
 * @responsibility 正常構成と各一条件の反例を同じ判定で確認する。
 * @trace ERB-UT-023
 * @precondition 正常Fixtureから一条件ずつ差替える。
 * @stimulus 同じ期待値で正常・不正観測値を照合する。
 * @observation 構成判定のtrue／falseを取得する。
 * @oracle Id、Name、Image、User、rootfs、privileged、cap、Init、Mountの不一致は拒否する。PID上限は要求しない。
 * @cleanup N/A: 値だけを照合する。
 * @boundary N/A: trueは実所有・削除許可の証明ではない。
 */
test("Identityと隔離構成のいずれかの差を受理しない", () => {
  const { resource, expectation } = fixture();
  assert.equal(dockerResourceConfigurationMatches(resource, expectation), true);
  for (const PidsLimit of [undefined, null, 0, -1, 64, 256])
    assert.equal(
      dockerResourceConfigurationMatches(
        { ...resource, HostConfig: { ...resource.HostConfig, PidsLimit } },
        expectation,
      ),
      true,
    );
  const invalid: readonly unknown[] = [
    null,
    [],
    { ...resource, Id: "c".repeat(64) },
    { ...resource, Name: "/foreign" },
    { ...resource, Config: { ...resource.Config, Image: "latest" } },
    { ...resource, Config: { ...resource.Config, User: "0:0" } },
    { ...resource, Config: { ...resource.Config, Labels: {} } },
    {
      ...resource,
      HostConfig: { ...resource.HostConfig, ReadonlyRootfs: false },
    },
    { ...resource, HostConfig: { ...resource.HostConfig, Privileged: true } },
    { ...resource, HostConfig: { ...resource.HostConfig, CapDrop: [] } },
    {
      ...resource,
      HostConfig: { ...resource.HostConfig, CapAdd: ["SYS_ADMIN"] },
    },
    { ...resource, HostConfig: { ...resource.HostConfig, SecurityOpt: [] } },
    { ...resource, HostConfig: { ...resource.HostConfig, Init: false } },
    {
      ...resource,
      Mounts: resource.Mounts.filter((mount) => mount.Destination !== "/work"),
    },
    {
      ...resource,
      Mounts: resource.Mounts.map((mount) => ({ ...mount, RW: true })),
    },
    {
      ...resource,
      Mounts: resource.Mounts.map((mount) => ({
        ...mount,
        Propagation: "shared",
      })),
    },
    { ...resource, NetworkSettings: { Networks: { foreign: {} } } },
  ];
  for (const value of invalid)
    assert.equal(dockerResourceConfigurationMatches(value, expectation), false);
});

/**
 * Network資源のIdentity、internal条件、bridge／localを照合する。
 *
 * @responsibility Container以外も同じ実ID・Label原則で評価する。
 * @trace ERB-UT-023
 * @precondition 固定internal Network観測を用いる。
 * @stimulus 正常値、internal差、Driver差、Scope差を照合する。
 * @observation true／falseの構成判定を読む。
 * @oracle 全一致だけを受理し、別種類のNetworkを拒否する。
 * @cleanup N/A: 実Networkを作成しない。
 * @boundary N/A: 純粋値の照合。
 */
test("Networkの実ID・Label・内部構成・Driver・Scopeを固定する", () => {
  const { expectation } = fixture();
  const expected = {
    ...expectation,
    kind: "network" as const,
    expectedName: `crdd-internal-${"3".repeat(16)}`,
    purpose: "create_internal_network" as const,
    expectedNetworks: [],
    expectedImage: null,
    shouldBeInternal: true,
  };
  const value = {
    Id: expectation.dockerId,
    Name: expected.expectedName,
    Labels: { "crdd.coordinator.runtime": "2".repeat(16) },
    Driver: "bridge",
    Scope: "local",
    Internal: true,
  };
  assert.equal(dockerResourceConfigurationMatches(value, expected), true);
  for (const invalid of [
    { ...value, Internal: false },
    { ...value, Driver: "host" },
    { ...value, Scope: "swarm" },
  ]) {
    assert.equal(dockerResourceConfigurationMatches(invalid, expected), false);
  }
});
