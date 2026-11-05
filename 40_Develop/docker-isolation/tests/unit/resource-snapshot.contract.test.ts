/**
 * 元Receiptの最小照合と非秘密の構成投影を検証する。
 * @packageDocumentation
 * @responsibility 構成差と別対象を区別し、秘密値を返却しないことを反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope JSON inspect値とRepository内の新品ポインタFile。実Docker・Processは使用しない。
 * @trace ERB-UT-023
 * @boundary 識別・構成投影と元Filesystem実体。実Dockerの成立を主張しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observeDockerProtectedMountIdentity } from "../../src/docker-cli/config.ts";
import test from "node:test";
import {
  dockerResourceConfigurationMatches,
  dockerResourceExpectationIsValid,
} from "../../src/cleanup/validation.ts";
import type { DockerResourceExpectation } from "../../src/cleanup/types.ts";
import { captureIsolationCleanupRequest } from "../../src/execution/preparation.ts";

import {
  dockerResourceIdentityMatches,
  snapshotObservedDockerResource,
  observeExpectedDockerResource,
} from "../../src/cleanup/resource.ts";

const EXPECTED = Object.freeze({
  kind: "container" as const,
  dockerId: "a".repeat(64),
  expectedName: "crdd-codex-0123456789abcdef",
  ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
});

/** 単一inspectの正対照を独立に構築する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
function observed() {
  return {
    Id: EXPECTED.dockerId,
    Name: `/${EXPECTED.expectedName}`,
    Config: {
      Image: `sha256:${"b".repeat(64)}`,
      Labels: { "crdd.coordinator.runtime": "0123456789abcdef" },
      Cmd: ["run", "sensitive-command-value"],
      Env: ["TOKEN=sensitive-environment-value"],
    },
    Mounts: [
      { Source: "C:\\repository\\work", Destination: "/work", RW: true },
    ],
    NetworkSettings: { Networks: { "crdd-internal-0123456789abcdef": {} } },
  };
}

/** 構成差を元対象の識別不一致へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("元Receipt照合はID・名前・所有Labelを比較し構成差を無視する", () => {
  const value = { ...observed(), NetworkSettings: { Networks: {} } };
  value.Config.Image = "changed";
  value.Config.Cmd = ["changed"];
  value.Mounts = [];
  assert.equal(dockerResourceIdentityMatches(value, EXPECTED), true);
  for (const replacement of [
    { ...value, Id: "c".repeat(64) },
    { ...value, Name: "/same-name-replacement" },
    { ...value, Config: { Labels: { "crdd.coordinator.runtime": "foreign" } } },
    { ...value, Config: null },
    null,
    [],
  ])
    assert.equal(dockerResourceIdentityMatches(replacement, EXPECTED), false);
  assert.equal(
    dockerResourceIdentityMatches(value, { ...EXPECTED, kind: "network" }),
    false,
  );
});

/** 環境値やCommand引数を返却しない。診断構成は識別値と別に返す。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("ResourceSnapshotは非秘密構成だけを不変値として返す", () => {
  const value = observed();
  const snapshot = snapshotObservedDockerResource(value, "provider", EXPECTED);
  assert.ok(snapshot);
  const resource = snapshot.resources[0];
  assert.ok(resource);
  assert.equal(resource.identity.dockerId, EXPECTED.dockerId);
  assert.equal(resource.configuration.image, value.Config.Image);
  assert.deepEqual(resource.configuration.environmentNames, ["TOKEN"]);
  assert.deepEqual(resource.configuration.command, [
    "<redacted>",
    "<redacted>",
  ]);
  assert.deepEqual(resource.configuration.mounts, [
    { source: "C:\\repository\\work", target: "/work", readOnly: false },
  ]);
  assert.equal(JSON.stringify(snapshot).includes("sensitive-"), false);
  const mount = value.Mounts[0];
  assert.ok(mount);
  mount.Source = "changed";
  assert.equal(
    resource.configuration.mounts?.[0]?.source,
    "C:\\repository\\work",
  );
  assert.equal(Object.isFrozen(snapshot.resources), true);
  assert.equal(Object.isFrozen(resource.configuration), true);
  assert.equal(Object.isFrozen(resource.configuration.mounts?.[0]), true);
});

/** 観測しなかった構成を空集合・既定値へ補完しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("ResourceSnapshotは構成欠測と空の構成を区別する", () => {
  const snapshot = snapshotObservedDockerResource(
    {
      Id: EXPECTED.dockerId,
      Name: `/${EXPECTED.expectedName}`,
      Config: { Labels: observed().Config.Labels },
    },
    "provider",
    EXPECTED,
  );
  assert.ok(snapshot);
  const configuration = snapshot.resources[0]?.configuration;
  assert.ok(configuration);
  for (const value of Object.values(configuration)) assert.equal(value, null);
  assert.equal(
    snapshotObservedDockerResource(
      { ...observed(), Id: "c".repeat(64) },
      "provider",
      EXPECTED,
    ),
    null,
  );
});

/** Networkでも元ID・元名・元Labelを識別条件にする。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("Network SnapshotはInternalを診断値として返し削除Identityにしない", () => {
  const identity = {
    ...EXPECTED,
    kind: "network" as const,
    expectedName: "crdd-internal-0123456789abcdef",
  };
  const value = {
    Id: identity.dockerId,
    Name: identity.expectedName,
    Labels: observed().Config.Labels,
    Internal: false,
  };
  assert.equal(dockerResourceIdentityMatches(value, identity), true);
  assert.equal(
    snapshotObservedDockerResource(value, "network", identity)?.resources[0]
      ?.configuration.internal,
    false,
  );
  assert.equal(
    dockerResourceIdentityMatches({ ...value, Labels: {} }, identity),
    false,
  );
});

/** 不正要素の除外で空構成を捏造せず、field全体を不明として返す。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("Snapshotは不正な構成配列をnullへ閉じ、有効な空配列と区別する", () => {
  for (const value of [
    {
      ...observed(),
      Config: { ...observed().Config, Cmd: [null], Env: [null] },
      Mounts: [{}],
    },
    {
      ...observed(),
      Config: {
        ...observed().Config,
        Cmd: ["valid", null],
        Env: ["TOKEN=value", "invalid"],
      },
      Mounts: [...observed().Mounts, null],
    },
  ]) {
    const configuration = snapshotObservedDockerResource(
      value,
      "provider",
      EXPECTED,
    )?.resources[0]?.configuration;
    assert.ok(configuration);
    assert.equal(configuration.command, null);
    assert.equal(configuration.environmentNames, null);
    assert.equal(configuration.mounts, null);
  }
  const configuration = snapshotObservedDockerResource(
    {
      ...observed(),
      Config: { ...observed().Config, Cmd: [], Env: [] },
      Mounts: [],
    },
    "provider",
    EXPECTED,
  )?.resources[0]?.configuration;
  assert.ok(configuration);
  assert.deepEqual(configuration.command, []);
  assert.deepEqual(configuration.environmentNames, []);
  assert.deepEqual(configuration.mounts, []);
});

/**
 * 保護MountのポインタFileとDirectoryを混同しない。
 * @responsibility 実Filesystemの型・内容差を同一実体として受理しない。
 * @trace ERB-UT-023
 * @precondition Repository内に新品の専用試験Directoryを作る。
 * @stimulus File内容を変え、同PathをDirectoryへ置換する。
 * @observation 元File、内容変更後、Directory置換後の実体相関。
 * @oracle 三相関は異なり、元Fileの相関が後発実体を承認しない。
 * @cleanup 作成したFile／Directoryだけを個別に除去する。
 * @boundary ERB-UT-023=Direct Boundary: 元実体観測とFilesystem metadata。
 */
test("保護.gitの通常Fileは捕捉でき内容差・型差を区別する", () => {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "di-protected-file-"));
  assert.equal(path.dirname(root), parent);
  const file = path.join(root, "git-reference");
  try {
    fs.writeFileSync(file, "gitdir: synthetic\n", { flag: "wx" });
    const first = observeDockerProtectedMountIdentity(file);
    fs.writeFileSync(file, "gitdir: synthetic-changed\n");
    assert.notEqual(observeDockerProtectedMountIdentity(file), first);
    fs.unlinkSync(file);
    fs.mkdirSync(file);
    assert.notEqual(observeDockerProtectedMountIdentity(file), first);
  } finally {
    if (fs.existsSync(file)) {
      const info = fs.lstatSync(file);
      if (info.isDirectory() && !info.isSymbolicLink()) fs.rmdirSync(file);
      else if (info.isFile() && !info.isSymbolicLink()) fs.unlinkSync(file);
    }
    fs.rmdirSync(root);
  }
});

/**
 * 同じinspectの同期collectorで誤Promiseを未処理Rejectにしない。
 * @responsibility 同期通知の完了と返却値違反を技術観測から区別する。
 * @trace ERB-UT-023
 * @precondition Network一覧とinspectはメモリ内の有限値だけを返す。
 * @stimulus 正常void、同期throw、非同期Reject、非void返値を渡す。
 * @observation inspect回数、返却Snapshot、拒否と後着Reject。
 * @oracle 正常だけ一回のinspectから観測を返し、誤返値を同期拒否してRejectを消費する。
 * @cleanup 局所Promiseをjoinする。外部資源は作らない。
 * @boundary ERB-UT-023=Direct Boundary: inspect値と同期collector。
 */
test("資源観測collectorは同期throw・非同期Reject・非void返値を捕捉する", async () => {
  const expected = {
    kind: "network" as const,
    dockerId: "a".repeat(64),
    expectedName: "crdd-internal-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    expectedImage: null,
    shouldBeInternal: true,
    expectedNetworks: [],
    initRequired: false,
    key: "create_internal_network" as const,
    expectedUser: null,
    tmpfsBytes: null,
    expectedMounts: [],
  };
  for (const mode of ["normal", "throw", "reject", "value"] as const) {
    let inspections = 0,
      captured: unknown = null;
    const run = (argv: readonly string[]) => {
      const inspecting = argv.includes("inspect");
      if (inspecting) inspections++;
      return {
        status: 0,
        signal: null,
        error: null,
        stderr: "",
        stdout: inspecting
          ? JSON.stringify([
              {
                Id: expected.dockerId,
                Name: expected.expectedName,
                Labels: { "crdd.coordinator.runtime": "0123456789abcdef" },
                Driver: "bridge",
                Scope: "local",
                Internal: true,
              },
            ])
          : expected.dockerId,
      };
    };
    const options = {
      onObserved: ((snapshot: unknown) => {
        captured = snapshot;
        if (mode === "throw") throw Error("collector_failed");
        if (mode === "reject") return Promise.reject(Error("collector_failed"));
        if (mode === "value") return true;
      }) as () => void,
    };
    if (mode === "normal")
      assert.equal(observeExpectedDockerResource(run, expected, options), true);
    else
      assert.throws(() =>
        observeExpectedDockerResource(run, expected, options),
      );
    assert.equal(inspections, 1);
    assert.ok(captured);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
});

/**
 * 明示技術構成と新しいLabelを用途によらず完全照合する。
 * @responsibility 旧固定Purposeを使わず全防御と元相関を検証する。
 * @trace ERB-UT-023
 * @precondition 非秘密の合成inspectと技術期待値だけを使用する。
 * @stimulus 単独field差、余分Mount・Network、別Label、key交換を与える。
 * @observation 判定と共通入力捕捉の拒否。
 * @oracle 正常だけ受理し、全不一致と別資源結合を拒否する。
 * @cleanup N/A: 値検査だけ。実Docker・AI・Filesystem書込みなし。
 * @boundary ID欠測時の発見と削除直前が利用する共通構成検査。
 */
test("技術構成は新用途Labelを受理し全不一致と別key結合を拒否する", () => {
  const expected: DockerResourceExpectation = {
    key: "utility",
    kind: "container",
    dockerId: "a".repeat(64),
    expectedName: "crdd-utility-0123456789abcdef",
    ownershipLabel: "crdd.utility=0123456789abcdef",
    expectedImage: "sha256:" + "b".repeat(64),
    shouldBeInternal: null,
    expectedNetworks: ["none"],
    expectedUser: "65534:65534",
    expectedMounts: [
      {
        destination: "/work/.git",
        readWrite: false,
        source: path.resolve("fixed-mask"),
      },
    ],
    initRequired: true,
    tmpfsBytes: 16777216,
  };
  const value = {
    Id: expected.dockerId,
    Name: "/" + expected.expectedName,
    Config: {
      Image: expected.expectedImage,
      User: expected.expectedUser,
      Labels: { "crdd.utility": "0123456789abcdef" },
    },
    HostConfig: {
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: ["ALL"],
      CapAdd: null,
      SecurityOpt: ["no-new-privileges"],
      Init: true,
      Tmpfs: { "/tmp": "rw,noexec,nosuid,size=16777216" },
    },
    NetworkSettings: { Networks: { none: {} } },
    Mounts: [
      {
        Type: "bind",
        Source: path.resolve("fixed-mask"),
        Destination: "/work/.git",
        RW: false,
        Propagation: "rprivate",
      },
    ],
  };
  assert.equal(dockerResourceExpectationIsValid(expected), true);
  assert.equal(dockerResourceConfigurationMatches(value, expected), true);
  for (const changed of [
    { ...value, Id: "c".repeat(64) },
    { ...value, Name: "/crdd-other" },
    {
      ...value,
      Config: { ...value.Config, Image: "sha256:" + "c".repeat(64) },
    },
    { ...value, Config: { ...value.Config, User: "0:0" } },
    {
      ...value,
      Config: { ...value.Config, Labels: { "crdd.other": "0123456789abcdef" } },
    },
    {
      ...value,
      Config: {
        ...value.Config,
        Labels: { "crdd.utility": "ffffffffffffffff" },
      },
    },
    ...[
      { ReadonlyRootfs: false },
      { Privileged: true },
      { CapDrop: [] },
      { CapAdd: ["ALL"] },
      { SecurityOpt: [] },
      { Init: false },
      { Tmpfs: { "/tmp": "rw,size=16777216" } },
    ].map((change) => ({
      ...value,
      HostConfig: { ...value.HostConfig, ...change },
    })),
    { ...value, NetworkSettings: { Networks: { none: {}, "crdd-extra": {} } } },
    { ...value, Mounts: [...value.Mounts, value.Mounts[0]] },
    ...[
      { Source: path.resolve("other-mask") },
      { RW: true },
      { Propagation: "rshared" },
      { Destination: "/other" },
    ].map((change) => ({
      ...value,
      Mounts: [{ ...value.Mounts[0], ...change }],
    })),
  ])
    assert.equal(dockerResourceConfigurationMatches(changed, expected), false);
  const resources = snapshotObservedDockerResource(value, "utility", expected);
  assert.ok(resources);
  const { dockerId: _id, ...configuration } = expected;
  const input = {
    managementDirectory: path.resolve("synthetic-management"),
    resources,
    cleanupOrder: ["utility"],
    setupTimeoutMs: 1000,
    unreceiptedAbsence: "retain" as const,
    verifyLabelAbsence: false,
    previouslyAbsent: [],
  };
  assert.ok(captureIsolationCleanupRequest(input));
  assert.throws(() =>
    captureIsolationCleanupRequest({ ...input, discovery: [] } as never),
  );
  assert.equal(
    dockerResourceExpectationIsValid({
      ...configuration,
      purpose: "legacy",
    } as never),
    false,
  );
});
