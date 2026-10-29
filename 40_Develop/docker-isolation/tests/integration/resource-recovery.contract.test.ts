/**
 * 回復時の現在観測と資源処置Gateを検証する。
 *
 * @packageDocumentation
 * @responsibility 未発見・観測不能・構成差を回復成功や削除へ昇格しないことを反証する。
 * @trace ERB-IT-004
 * @trace PRL-IT-013
 * @level IT
 * @scope Runner結果→資源観測Gate。実Docker・回復記録の成立ではない。
 * @boundary Direct Boundary: 固定Runner結果→資源処置。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type DockerRecoveryCommandResult,
  discoverSubmittedDockerResource,
  observeSubmittedDockerResourceAbsent,
  recoverObservedDockerResource,
} from "../../src/cleanup/resource.ts";
import type { DockerResourceExpectation } from "../../src/index.ts";

/**
 * 不正用途・Identityは観測や削除の前に拒否する。
 *
 * @responsibility 未検査のfilterと非作成用途をDockerへ送らない。
 * @trace ERB-IT-004
 * @precondition Runnerの発行数を観測する。
 * @stimulus 未知・start・connect用途と不正Identityを要求する。
 * @observation false／nullとRunner要求0を確認する。
 * @oracle 全ての不正入力で観測・rm要求が発行されない。
 * @cleanup N/A: 模擬Runnerだけを使う。
 * @boundary 不正技術期待値→Effect前Gate。
 */
test("非作成用途と不正IdentityはDocker要求前に拒否する", () => {
  const base = networkExpectation();
  let calls = 0;
  /**
   * 不正な資源回収入力で発行された要求数を数える。
   * @responsibility 不正な資源回収入力で発行された要求数を数える。
   * @trace ERB-IT-004
   * @precondition 目的・名前・label・ID・digestの反例。
   * @stimulus 呼ばれた場合だけcallsを増やし固定結果を返す。
   * @observation runの到達回数。
   * @oracle 入力拒否時はcallsが0のままである。
   * @cleanup N/A: 実回収処理はない。
   * @boundary 回収Executorの有限代役。Docker操作0。
   */
  const run = () => {
    calls += 1;
    return commandResult();
  };
  for (const invalid of [
    { purpose: "unknown" },
    { purpose: "toString" },
    { purpose: "start_proxy" },
    { purpose: "connect_proxy_egress" },
    { expectedName: "foreign.*" },
    { ownershipLabel: "other=value" },
    { dockerId: "short" },
    { expectedImage: "unfixed" },
    { purpose: "create_provider" },
  ]) {
    const expectation = { ...base, ...invalid } as DockerResourceExpectation;
    assert.equal(recoverObservedDockerResource(run, expectation), false);
    assert.equal(discoverSubmittedDockerResource(run, expectation), null);
  }
  assert.equal(
    observeSubmittedDockerResourceAbsent(
      run,
      "network",
      "foreign.*",
      base.ownershipLabel,
    ),
    false,
  );
  assert.equal(calls, 0);
});

/**
 * 五用途の既存Network構成を維持する。
 *
 * @responsibility authのnoneとproxyの接続前後を未知構成と区別する。
 * @trace ERB-IT-004
 * @precondition 予定資源の明示不存在を模擬する。
 * @stimulus 用途別の正常構成と未知・重複・過長Networkを要求する。
 * @observation 正常では二要求、不正では要求0を確認する。
 * @oracle 既存の五作成用途を拒否せず未知構成を回収へ通さない。
 * @cleanup N/A: 模擬Runnerだけを使用する。
 * @boundary 技術期待値→観測前Gate。
 */
test("五用途の既存Network構成だけを観測へ搬送する", () => {
  const base = networkExpectation();
  const internal = `crdd-internal-${"3".repeat(16)}`;
  const egress = `crdd-egress-${"4".repeat(16)}`;
  const configurations: DockerResourceExpectation[] = [
    base,
    {
      ...base,
      purpose: "create_egress_network",
      expectedName: `crdd-egress-${"1".repeat(16)}`,
      shouldBeInternal: false,
    },
    ...(
      [
        "create_subscription_auth_probe",
        "create_provider",
        "create_proxy",
      ] as const
    ).map((purpose) => ({
      ...base,
      purpose,
      kind: "container" as const,
      expectedName: `crdd-${purpose === "create_subscription_auth_probe" ? "auth" : purpose === "create_provider" ? "codex" : "proxy"}-${"1".repeat(16)}`,
      expectedImage: `sha256:${"b".repeat(64)}`,
      shouldBeInternal: null,
      expectedNetworks:
        purpose === "create_subscription_auth_probe" ? ["none"] : [internal],
    })),
  ];
  configurations.push({
    ...(configurations[4] as DockerResourceExpectation),
    expectedNetworks: [egress, internal],
  });
  for (const expectation of configurations) {
    let calls = 0;
    assert.equal(
      recoverObservedDockerResource(() => {
        calls += 1;
        return commandResult();
      }, expectation),
      true,
    );
    assert.equal(calls, 2);
    for (const expectedNetworks of [
      ["unknown"],
      [internal, internal],
      [internal, egress, internal],
    ]) {
      calls = 0;
      assert.equal(
        recoverObservedDockerResource(
          () => {
            calls += 1;
            return commandResult();
          },
          { ...expectation, expectedNetworks },
        ),
        false,
      );
      assert.equal(calls, 0);
    }
  }
  let calls = 0;
  assert.equal(
    observeSubmittedDockerResourceAbsent(
      () => {
        calls += 1;
        return commandResult();
      },
      "network",
      `crdd-auth-${"1".repeat(16)}`,
      base.ownershipLabel,
    ),
    false,
  );
  assert.equal(calls, 0);
});

/**
 * 固定Networkの技術期待値を構築する。
 *
 * @responsibility Rootや回復Authorityを含まない一資源の期待値を作る。
 * @trace ERB-IT-004
 * @precondition 模擬Runnerの境界だけを検証する。
 * @stimulus 実ID形式、名前、Labelと固定Network条件を生成する。
 * @observation 技術期待値を返す。
 * @oracle 回復結果の採用・削除前の不一致を検出できる。
 * @cleanup N/A: 実Network・Filesystemを取得しない。
 * @boundary 模擬期待値→資源処置Gate。
 */
function networkExpectation(): DockerResourceExpectation {
  return {
    kind: "network",
    dockerId: "a".repeat(64),
    expectedName: `crdd-internal-${"1".repeat(16)}`,
    ownershipLabel: `crdd.coordinator.runtime=${"2".repeat(16)}`,
    expectedImage: null,
    shouldBeInternal: true,
    purpose: "create_internal_network",
    expectedNetworks: [],
    workspaceMounted: false,
    workspaceReadOnly: false,
    initRequired: false,
  };
}

/**
 * 模擬Runnerの正常終了を固定値で作る。
 *
 * @responsibility stdout以外の終了fieldを明示して観測不能と区別する。
 * @trace ERB-IT-004
 * @precondition 呼出し側が固定stdoutを選ぶ。
 * @stimulus 正常結果を組み立てる。
 * @observation status・signal・errorとstdoutを返す。
 * @oracle 空stdoutだけでは正常終了を推定しない。
 * @cleanup N/A: 値生成だけ。
 * @boundary 模擬Runner結果。
 */
function commandResult(stdout = ""): DockerRecoveryCommandResult {
  return { status: 0, signal: null, stdout, stderr: "", error: null };
}

/**
 * 未発見と観測不能の作成結果をunknownのまま保持する。
 *
 * @responsibility 名前の空集合を過去作成の未発行・回復成功へ読み替えない。
 * @trace ERB-IT-004
 * @precondition 二つのlist結果を空または失敗にする。
 * @stimulus 未解決作成の現在資源発見を要求する。
 * @observation nullと削除要求0を確認する。
 * @oracle 空・失敗の双方で実IDを捏造せず、rmを発行しない。
 * @cleanup N/A: 模擬Runnerだけを使用する。
 * @boundary Runnerの空・失敗結果→実ID発見Gate。
 */
test("未発見・観測不能は作成成功や削除へ補完しない", () => {
  const expectation = networkExpectation();
  for (const result of [
    commandResult(),
    { ...commandResult(), status: null, error: new Error("fixed") },
  ]) {
    const calls: readonly string[][] = [];
    const mutable = calls as string[][];
    assert.equal(
      discoverSubmittedDockerResource((argv) => {
        mutable.push([...argv]);
        return result;
      }, expectation),
      null,
    );
    assert.ok(mutable.every((argv) => !argv.includes("rm")));
  }
});

/**
 * 名前とLabelの差を単一資源の採用へ丸めない。
 *
 * @responsibility 二経路の実ID一致を採用前に要求する。
 * @trace ERB-IT-004
 * @precondition 名だけと名／Labelのlistが別IDを返す。
 * @stimulus 同じ予定資源の発見を要求する。
 * @observation nullと二listだけの発行を確認する。
 * @oracle inspect・削除へ進まない。
 * @cleanup N/A: 実資源を作成しない。
 * @boundary 不一致Runner値→採用Gate。
 */
test("名とLabelのID差ではinspect・削除へ進まない", () => {
  let calls = 0;
  const result = discoverSubmittedDockerResource(
    () => commandResult((calls++ === 0 ? "a" : "b").repeat(64)),
    networkExpectation(),
  );
  assert.equal(result, null);
  assert.equal(calls, 2);
});

/**
 * 構成確認済みIDの発見を削除・完了と分離する。
 *
 * @responsibility 未解決作成の発見は観測だけに限定する。
 * @trace ERB-IT-004
 * @precondition 両listとinspectが同じ固定Networkを返す。
 * @stimulus 資源発見を要求する。
 * @observation 実ID、構成確認とrmなしを読む。
 * @oracle 同じIDだけを返し、削除と全回復完了を発行しない。
 * @cleanup N/A: 模擬Runnerだけを使う。
 * @boundary list／inspect→限定実ID発見。
 */
test("構成確認済みIDを発見しても削除は発行しない", () => {
  const expectation = networkExpectation();
  const calls: string[][] = [];
  const result = discoverSubmittedDockerResource((argv) => {
    calls.push([...argv]);
    return commandResult(
      argv.includes("inspect")
        ? JSON.stringify([
            {
              Id: expectation.dockerId,
              Name: expectation.expectedName,
              Labels: { "crdd.coordinator.runtime": "2".repeat(16) },
              Driver: "bridge",
              Scope: "local",
              Internal: true,
            },
          ])
        : expectation.dockerId,
    );
  }, expectation);
  assert.equal(result, expectation.dockerId);
  assert.ok(calls.some((argv) => argv.includes("inspect")));
  assert.ok(calls.every((argv) => !argv.includes("rm")));
});

/**
 * 不存在判定を正常観測と厳密に結合する。
 *
 * @responsibility 空stdoutでも失敗を不存在へ変換しない。
 * @trace ERB-IT-004
 * @precondition list正常空と、同じ空stdoutの失敗を区別する。
 * @stimulus 予定名／Label不存在と実ID回復を要求する。
 * @observation true／falseと削除発行0を読む。
 * @oracle 正常空だけを受理し、Signal・error・stderrで停止する。
 * @cleanup N/A: 実資源を取得しない。
 * @boundary 終了fieldと空stdout→不存在Gate。
 */
test("空stdoutでも失敗・Signal・stderrを不存在にしない", () => {
  const expectation = networkExpectation();
  assert.equal(
    observeSubmittedDockerResourceAbsent(
      () => commandResult(),
      expectation.kind,
      expectation.expectedName,
      expectation.ownershipLabel,
    ),
    true,
  );
  for (const result of [
    { ...commandResult(), status: 1 },
    { ...commandResult(), signal: "SIGTERM" },
    { ...commandResult(), stderr: "fixed" },
    { ...commandResult(), error: new Error("fixed") },
  ]) {
    assert.equal(
      observeSubmittedDockerResourceAbsent(
        () => result,
        expectation.kind,
        expectation.expectedName,
        expectation.ownershipLabel,
      ),
      false,
    );
    assert.equal(
      recoverObservedDockerResource(() => result, expectation),
      false,
    );
  }
});

/**
 * dockerResultのTest準備責務を実行する。
 *
 * @responsibility dockerResultがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus dockerResultを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
function dockerResult(stdout = "") {
  return Object.freeze({
    status: 0,
    signal: null,
    stdout,
    stderr: "",
    error: null,
  });
}

/**
 * exactContainerRunnerのTest準備責務を実行する。
 *
 * @responsibility exactContainerRunnerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exactContainerRunnerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
function exactContainerRunner(overrides: Record<string, unknown> = {}) {
  let exists = true;
  let removeCount = 0;
  const dockerId = "a".repeat(64);
  const inspected = Object.freeze({
    Id: dockerId,
    Name: "/crdd-codex-0123456789abcdef",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"b".repeat(64)}`,
      Labels: Object.freeze({ "crdd.coordinator.runtime": "0123456789abcdef" }),
    }),
    HostConfig: Object.freeze({
      Init: null,
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 0,
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze({
        "crdd-internal-0123456789abcdef": Object.freeze({}),
      }),
    }),
    Mounts: Object.freeze([
      Object.freeze({
        Type: "bind",
        Destination: "/provider-home",
        RW: true,
        Propagation: "rprivate",
      }),
      Object.freeze({
        Type: "bind",
        Destination: "/tmp",
        RW: true,
        Propagation: "rprivate",
      }),
      Object.freeze({
        Type: "bind",
        Destination: "/work",
        RW: true,
        Propagation: "rprivate",
      }),
    ]),
    ...overrides,
  });
  return Object.freeze({
    dockerId,
    removeCount: () => removeCount,
    runDockerCommand(argv: readonly string[]) {
      if (argv[1] === "inspect")
        return dockerResult(JSON.stringify([inspected]));
      if (argv[1] === "rm") {
        exists = false;
        removeCount += 1;
        return dockerResult();
      }
      if (argv.includes(`id=${dockerId}`))
        return dockerResult(exists ? `${dockerId}\n` : "");
      if (
        argv.some(
          (value) => value.startsWith("name=") || value.startsWith("label="),
        )
      )
        return dockerResult(exists ? `${dockerId}\n` : "");
      return Object.freeze({
        status: 1,
        signal: null,
        stdout: "",
        stderr: "unexpected",
        error: null,
      });
    },
  });
}

/**
 * exactProxyRunnerのTest準備責務を実行する。
 *
 * @responsibility exactProxyRunnerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exactProxyRunnerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
function exactProxyRunner(networkNames: readonly string[]) {
  return exactContainerRunner({
    Name: "/crdd-proxy-0123456789abcdef",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"b".repeat(64)}`,
      Labels: Object.freeze({
        "crdd.coordinator.runtime": "0123456789abcdef",
      }),
    }),
    HostConfig: Object.freeze({
      Init: null,
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 0,
      Tmpfs: Object.freeze({
        "/tmp": "rw,noexec,nosuid,size=16777216",
      }),
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze(
        Object.fromEntries(
          networkNames.map((networkName) => [networkName, Object.freeze({})]),
        ),
      ),
    }),
    Mounts: Object.freeze([]),
  });
}

/**
 * exactAuthRunnerのTest準備責務を実行する。
 *
 * @responsibility exactAuthRunnerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exactAuthRunnerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
function exactAuthRunner(networkNames: readonly string[] = ["none"]) {
  return exactContainerRunner({
    Name: "/crdd-auth-0123456789abcdef",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"a".repeat(64)}`,
      Labels: Object.freeze({
        "crdd.coordinator.runtime": "0123456789abcdef",
      }),
    }),
    HostConfig: Object.freeze({
      Init: null,
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 0,
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze(
        Object.fromEntries(
          networkNames.map((networkName) => [networkName, Object.freeze({})]),
        ),
      ),
    }),
    Mounts: Object.freeze([
      Object.freeze({
        Type: "bind",
        Destination: "/provider-home",
        RW: false,
        Propagation: "rprivate",
      }),
    ]),
  });
}

/**
 * Docker資源回収はexact IDと全構成一致だけを削除するを検証する。
 *
 * @responsibility Docker資源回収はexact IDと全構成一致だけを削除するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はexact IDと全構成一致だけを削除するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はexact IDと全構成一致だけを削除する", () => {
  const fixture = exactContainerRunner();
  assert.equal(
    recoverObservedDockerResource(fixture.runDockerCommand, {
      kind: "container",
      dockerId: fixture.dockerId,
      expectedName: "crdd-codex-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: `sha256:${"b".repeat(64)}`,
      shouldBeInternal: null,
      purpose: "create_provider",
      expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
      workspaceMounted: true,
      workspaceReadOnly: false,
      initRequired: false,
    }),
    true,
  );
  assert.equal(fixture.removeCount(), 1);
});

/**
 * Docker資源回収はreplacement構成を削除せずEvidenceを保持するを検証する。
 *
 * @responsibility Docker資源回収はreplacement構成を削除せずEvidenceを保持するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はreplacement構成を削除せずEvidenceを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はreplacement構成を削除せずEvidenceを保持する", () => {
  const fixture = exactContainerRunner({ Name: "/replacement" });
  assert.equal(
    recoverObservedDockerResource(fixture.runDockerCommand, {
      kind: "container",
      dockerId: fixture.dockerId,
      expectedName: "crdd-codex-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: `sha256:${"b".repeat(64)}`,
      shouldBeInternal: null,
      purpose: "create_provider",
      expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
      workspaceMounted: true,
      workspaceReadOnly: false,
      initRequired: false,
    }),
    false,
  );
  assert.equal(fixture.removeCount(), 0);
});

/**
 * init必須と非必須をexact Recoveryの構成検査で区別する。
 *
 * @responsibility init欠落、誤った型と対象外へのinit混入で削除を発行しないことを確認する。
 * @trace PRL-IT-013
 * @precondition 固定inspect形の合成応答と通常／専用Imageを使用する。
 * @stimulus fresh Recoveryが同じexact IDを再検査する。
 * @observation 判定と削除発行件数を取得する。
 * @oracle init必須構成はtrueだけ、init非必須構成は未記載／null／falseだけを受理する。
 * @cleanup N/A: 合成Docker runnerは実資源を作らない。
 * @boundary PRL-IT-013=Related 2 Blocks: 技術期待値→exact構成検査
 */
test("init必須と非必須をexact Recoveryの構成検査で区別する", () => {
  const seed = JSON.parse(
    exactContainerRunner().runDockerCommand(["docker", "inspect"]).stdout,
  )[0];
  for (const isAdvice of [false, true]) {
    const image = isAdvice
      ? `sha256:${"c".repeat(64)}`
      : `sha256:${"b".repeat(64)}`;
    for (const init of [null, false, true, undefined, "false", 1]) {
      const isExpected = isAdvice
        ? init === true
        : init === undefined || init === null || init === false;
      const fixture = exactContainerRunner({
        Config: { ...seed.Config, Image: image },
        HostConfig: { ...seed.HostConfig, Init: init },
        Mounts: isAdvice
          ? seed.Mounts.filter(
              (mount: { Destination: string }) => mount.Destination !== "/work",
            )
          : seed.Mounts,
      });
      assert.equal(
        recoverObservedDockerResource(fixture.runDockerCommand, {
          kind: "container",
          dockerId: fixture.dockerId,
          expectedName: "crdd-codex-0123456789abcdef",
          ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
          expectedImage: image,
          shouldBeInternal: null,
          purpose: "create_provider",
          expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
          workspaceMounted: !isAdvice,
          workspaceReadOnly: false,
          initRequired: isAdvice,
        }),
        isExpected,
      );
      assert.equal(fixture.removeCount(), isExpected ? 1 : 0);
    }
  }
});

/**
 * Proxyと認証Probeの省略可能Initをexact Recoveryで照合する。
 *
 * @responsibility 実障害で残った二用途の構成解釈と拒否時の削除0を検証する。
 * @trace PRL-IT-013
 * @precondition 各用途の隔離条件を満たす合成inspect応答を使う。
 * @stimulus Init未記載／null／false／true／不正型を同じexact資源へ与える。
 * @observation 回収判定と削除回数を読む。
 * @oracle 未指定またはfalseだけを受理し、他のIdentity不一致は引き続き拒否する。
 * @cleanup N/A: 合成Docker runnerであり実資源を作らない。
 * @boundary PRL-IT-013=Related 2 Blocks: 技術期待値→Docker inspect
 */
test("Proxyと認証Probeの省略可能Initをexact Recoveryで照合する", () => {
  for (const purpose of [
    "create_proxy",
    "create_subscription_auth_probe",
  ] as const) {
    const networks =
      purpose === "create_proxy"
        ? ["crdd-internal-0123456789abcdef", "crdd-egress-0123456789abcdef"]
        : ["none"];
    const seed = JSON.parse(
      (purpose === "create_proxy"
        ? exactProxyRunner(networks)
        : exactAuthRunner(networks)
      ).runDockerCommand(["container", "inspect"]).stdout,
    )[0];
    for (const init of [undefined, null, false, true, "false", 1]) {
      for (const hasWrongIdentity of [false, true]) {
        const configuration = structuredClone(seed);
        if (init === undefined) delete configuration.HostConfig.Init;
        else configuration.HostConfig.Init = init;
        if (hasWrongIdentity)
          configuration.Config.Labels["crdd.coordinator.runtime"] = "f".repeat(
            16,
          );
        const fixture = exactContainerRunner(configuration);
        const isExpected =
          !hasWrongIdentity &&
          (init === undefined || init === null || init === false);
        assert.equal(
          recoverObservedDockerResource(fixture.runDockerCommand, {
            kind: "container",
            dockerId: fixture.dockerId,
            expectedName: seed.Name.slice(1),
            ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
            expectedImage: seed.Config.Image,
            shouldBeInternal: null,
            purpose: purpose,
            expectedNetworks: networks,
            workspaceMounted: false,
            workspaceReadOnly: false,
            initRequired: false,
          }),
          isExpected,
        );
        assert.equal(fixture.removeCount(), isExpected ? 1 : 0);
      }
    }
  }
});

/**
 * Docker資源回収はreceipt前crashの二軸不存在をsettlement証明にしないを検証する。
 *
 * @responsibility Docker資源回収はreceipt前crashの二軸不存在をsettlement証明にしないの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はreceipt前crashの二軸不存在をsettlement証明にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はreceipt前crashの二軸不存在をsettlement証明にしない", () => {
  const observedCalls: string[][] = [];
  const result = discoverSubmittedDockerResource(
    (argv) => {
      observedCalls.push([...argv]);
      return dockerResult();
    },
    {
      kind: "container",
      expectedName: "crdd-auth-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: `sha256:${"b".repeat(64)}`,
      shouldBeInternal: null,
      purpose: "create_subscription_auth_probe",
      expectedNetworks: Object.freeze(["none"]),
      workspaceMounted: false,
      workspaceReadOnly: false,
      initRequired: false,
    },
  );
  assert.equal(result, null);
  assert.equal(observedCalls.length, 2);
  assert.equal(
    observedCalls[0]?.includes("name=^/crdd-auth-0123456789abcdef$"),
    true,
  );
  assert.equal(
    observedCalls[1]?.includes(
      "label=crdd.coordinator.runtime=0123456789abcdef",
    ),
    true,
  );
});

/**
 * Docker資源回収はreceipt前crashの同一owned resourceを削除前にexact IDへ固定するを検証する。
 *
 * @responsibility Docker資源回収はreceipt前crashの同一owned resourceを削除前にexact IDへ固定するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はreceipt前crashの同一owned resourceを削除前にexact IDへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はreceipt前crashの同一owned resourceを削除前にexact IDへ固定する", () => {
  const fixture = exactContainerRunner();
  assert.equal(
    discoverSubmittedDockerResource(fixture.runDockerCommand, {
      kind: "container",
      expectedName: "crdd-codex-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: `sha256:${"b".repeat(64)}`,
      shouldBeInternal: null,
      purpose: "create_provider",
      expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
      workspaceMounted: true,
      workspaceReadOnly: false,
      initRequired: false,
    }),
    fixture.dockerId,
  );
  assert.equal(fixture.removeCount(), 0);
});

/**
 * Docker資源回収はauth probeのDocker none network表現だけを受理するを検証する。
 *
 * @responsibility Docker資源回収はauth probeのDocker none network表現だけを受理するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はauth probeのDocker none network表現だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はauth probeのDocker none network表現だけを受理する", () => {
  const accepted = exactAuthRunner();
  assert.equal(
    discoverSubmittedDockerResource(accepted.runDockerCommand, {
      kind: "container",
      expectedName: "crdd-auth-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: `sha256:${"a".repeat(64)}`,
      shouldBeInternal: null,
      purpose: "create_subscription_auth_probe",
      expectedNetworks: Object.freeze(["none"]),
      workspaceMounted: false,
      workspaceReadOnly: false,
      initRequired: false,
    }),
    accepted.dockerId,
  );
  assert.equal(accepted.removeCount(), 0);

  for (const networks of [[], ["foreign"], ["none", "foreign"]] as const) {
    const rejected = exactAuthRunner(networks);
    assert.equal(
      discoverSubmittedDockerResource(rejected.runDockerCommand, {
        kind: "container",
        expectedName: "crdd-auth-0123456789abcdef",
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
        expectedImage: `sha256:${"a".repeat(64)}`,
        shouldBeInternal: null,
        purpose: "create_subscription_auth_probe",
        expectedNetworks: Object.freeze(["none"]),
        workspaceMounted: false,
        workspaceReadOnly: false,
        initRequired: false,
      }),
      null,
    );
    assert.equal(rejected.removeCount(), 0);
  }
});

/**
 * Docker資源回収はreceipt前proxyのinternal-only構成を削除前にexact IDへ固定するを検証する。
 *
 * @responsibility Docker資源回収はreceipt前proxyのinternal-only構成を削除前にexact IDへ固定するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はreceipt前proxyのinternal-only構成を削除前にexact IDへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はreceipt前proxyのinternal-only構成を削除前にexact IDへ固定する", () => {
  const internal = "crdd-internal-0123456789abcdef";
  const fixture = exactProxyRunner([internal]);
  assert.equal(
    discoverSubmittedDockerResource(fixture.runDockerCommand, {
      kind: "container",
      expectedName: "crdd-proxy-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: `sha256:${"b".repeat(64)}`,
      shouldBeInternal: null,
      purpose: "create_proxy",
      expectedNetworks: Object.freeze([internal]),
      workspaceMounted: false,
      workspaceReadOnly: false,
      initRequired: false,
    }),
    fixture.dockerId,
  );
  assert.equal(fixture.removeCount(), 0);
});

/**
 * Docker資源回収はreceipt前crashのforeign／ambiguous resourceを採用しないを検証する。
 *
 * @responsibility Docker資源回収はreceipt前crashのforeign／ambiguous resourceを採用しないの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はreceipt前crashのforeign／ambiguous resourceを採用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はreceipt前crashのforeign／ambiguous resourceを採用しない", () => {
  const dockerId = "a".repeat(64);
  for (const [named, owned] of [
    [`${dockerId}\n`, ""],
    ["", `${dockerId}\n`],
    [`${dockerId}\n`, `${"b".repeat(64)}\n`],
    [`${dockerId}\n${"b".repeat(64)}\n`, `${dockerId}\n`],
  ] as const) {
    assert.equal(
      discoverSubmittedDockerResource(
        (argv) =>
          dockerResult(
            argv.some((value) => value.startsWith("label=")) ? owned : named,
          ),
        {
          kind: "container",
          expectedName: "crdd-codex-0123456789abcdef",
          ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
          expectedImage: `sha256:${"b".repeat(64)}`,
          shouldBeInternal: null,
          purpose: "create_provider",
          expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
          workspaceMounted: true,
          workspaceReadOnly: false,
          initRequired: false,
        },
      ),
      null,
    );
  }
});

/**
 * Docker資源回収は発見IDがinspect前に消えた場合も完了へ進めないを検証する。
 *
 * @responsibility Docker資源回収は発見IDがinspect前に消えた場合も完了へ進めないの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収は発見IDがinspect前に消えた場合も完了へ進めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収は発見IDがinspect前に消えた場合も完了へ進めない", () => {
  const dockerId = "a".repeat(64);
  let callCount = 0;
  assert.equal(
    discoverSubmittedDockerResource(
      () => {
        callCount += 1;
        return dockerResult(callCount <= 2 ? `${dockerId}\n` : "");
      },
      {
        kind: "container",
        expectedName: "crdd-codex-0123456789abcdef",
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
        expectedImage: `sha256:${"b".repeat(64)}`,
        shouldBeInternal: null,
        purpose: "create_provider",
        expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
        workspaceMounted: true,
        workspaceReadOnly: false,
        initRequired: false,
      },
    ),
    null,
  );
  assert.equal(callCount, 3);
});

/**
 * Docker資源回収はreceipt前照会の失敗・signal・stderr・不正IDを処置0へ閉じるを検証する。
 *
 * @responsibility Docker資源回収はreceipt前照会の失敗・signal・stderr・不正IDを処置0へ閉じるの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker資源回収はreceipt前照会の失敗・signal・stderr・不正IDを処置0へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: docker-isolation Test Source→資源観測・回収
 */
test("Docker資源回収はreceipt前照会の失敗・signal・stderr・不正IDを処置0へ閉じる", () => {
  const cases = [
    dockerResult("not-a-docker-id\n"),
    dockerResult(`${"a".repeat(64)}\n${"b".repeat(64)}\n`),
    Object.freeze({
      status: 1,
      signal: null,
      stdout: "",
      stderr: "",
      error: null,
    }),
    Object.freeze({
      status: 0,
      signal: "SIGTERM" as const,
      stdout: "",
      stderr: "",
      error: null,
    }),
    Object.freeze({
      status: 0,
      signal: null,
      stdout: "",
      stderr: "docker unavailable",
      error: null,
    }),
    Object.freeze({
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: new Error("spawn failed"),
    }),
  ];
  for (const result of cases) {
    let callCount = 0;
    assert.equal(
      discoverSubmittedDockerResource(
        () => {
          callCount += 1;
          return result;
        },
        {
          kind: "container",
          expectedName: "crdd-codex-0123456789abcdef",
          ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
          expectedImage: `sha256:${"b".repeat(64)}`,
          shouldBeInternal: null,
          purpose: "create_provider",
          expectedNetworks: Object.freeze(["crdd-internal-0123456789abcdef"]),
          workspaceMounted: true,
          workspaceReadOnly: false,
          initRequired: false,
        },
      ),
      null,
    );
    assert.ok(callCount >= 1 && callCount <= 2);
  }
});
