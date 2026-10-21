/**
 * Probe inspectの上位選択と下位技術投影を検証する。
 * @packageDocumentation
 * @responsibility 必須profile選択・三mountだけの搬送と照合拒否後の削除0を反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実上位本文と下位構成判定。下位操作・Host遷移は合成依存であり、実Docker削除は観測しない。
 * @boundary ERB-IT-004=Related 2 Blocks: 上位inspect／cleanup→DI構成判定。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  dockerProbeConfigurationMatches,
  describeDockerProbeConfiguration,
  type DockerProbeProfile,
  type DockerProbeConfigurationExpectation,
} from "../../../docker-isolation/src/index.ts";

/**
 * 同じ本番Fileの指定関数を依存差替え用に抽出する。
 * @responsibility 手書きの上位モデルではなく現行の投影本文を検査する。
 * @trace ERB-IT-004
 * @precondition 指定名はFile中に一回だけ現れる。
 * @stimulus 一意な関数宣言から次の文書Headerまでを読む。
 * @observation 型除去後の実本文。
 * @oracle 欠測・重複は試験自体を失敗させる。
 * @cleanup N/A: 読取りとメモリ値だけ。
 * @boundary Source本文とVM。実Host処置は行わない。
 */
function functionSource(source: string, name: string) {
  const marker = `function ${name}(`;
  assert.equal(source.split(marker).length, 2);
  const begin = source.indexOf(marker),
    nextHeader = source.indexOf("\n/**", begin),
    end = nextHeader >= 0 ? nextHeader : source.indexOf("\n}", begin) + 2;
  assert.ok(begin > 0 && end > begin);
  return stripTypeScriptTypes(source.slice(begin, end));
}

/**
 * 固定profileの構成投影・inspect・cleanupを同じVMへ接続する。
 * @responsibility 上位の責務を複製した別実装で置換しない。
 * @trace ERB-IT-004
 * @precondition 下位の純粋な固定構成投影を利用する。
 * @stimulus 必須profile、下位判定、私有参照の取下げを選ぶ。
 * @observation 技術投影、下位呼出し、私有参照登録、Host遷移と元入力。
 * @oracle 下位には3mountと値候補だけを渡し、拒否時は私有参照登録とHost遷移0。
 * @cleanup N/A: WeakMapとVMのみ。資源を作成しない。
 * @boundary 本番上位本文／本番下位判定と合成依存。
 */
function fixture(
  profileOverride: DockerProbeProfile | "legacy_recovery" | undefined,
  lower: boolean | "real" | "throw" | "invalid" = true,
  sourceOverride?: string,
) {
  const source =
    sourceOverride ??
    fs
      .readFileSync(
        new URL("../../src/execution/isolation-probe.ts", import.meta.url),
        "utf8",
      )
      .replace(/\r\n/g, "\n");
  const capability = {};
  const identity = {
    id: "a".repeat(64),
    probeId: "probe-123",
    ...(profileOverride === undefined ? {} : { profile: profileOverride }),
  };
  const identities = new WeakMap([[capability, identity]]);
  const mounts = {
    workspace: "fixed-workspace",
    providerHome: "fixed-home",
    tmp: "fixed-tmp",
    events: "private-events",
    projection: "private-projection",
    management: path.join("fixed-root", "management"),
  };
  const sources = describeDockerProbeConfiguration(
    "legacy_recovery",
    { id: identity.id, probeId: identity.probeId },
    {
      workspace: mounts.workspace,
      providerHome: mounts.providerHome,
      tmp: mounts.tmp,
    },
  ).sourceCandidates;
  assert.equal(sources.length, 6);
  const calls: string[] = [];
  const projections: DockerProbeConfigurationExpectation[] = [];
  const observation = Object.freeze({ runningConfirmed: false });
  const absences = new WeakMap<object, unknown>();
  const registrations: object[] = [];
  const nativeSet = absences.set.bind(absences);
  absences.set = (key, value) => {
    registrations.push(key);
    return nativeSet(key, value);
  };
  const hostTransitions: unknown[][] = [];
  const inspect = {
    Id: identity.id,
    Name: "/crdd-coordinator-probe-probe-123",
    Config: { Image: "wrong-fixed-image" },
  };
  const context = {
    Buffer,
    containerIdentities: identities,
    describeDockerProbeConfiguration: (
      profile: DockerProbeProfile | "legacy_recovery",
      selected: { id: string; probeId: string },
      selectedMounts: { workspace: string; providerHome: string; tmp: string },
    ) =>
      describeDockerProbeConfiguration(
        profile,
        structuredClone(selected),
        structuredClone(selectedMounts),
      ),
    path,
    absenceCapabilities: absences,
    dynamicLifecycleAbsences: new WeakMap(),
    transitionHostRecoveryState: (...args: unknown[]) => {
      hostTransitions.push(args);
      return "fixed-host-next";
    },
    inspectDockerProbeContainer: (
      _binding: unknown,
      expected: DockerProbeConfigurationExpectation,
    ) => {
      calls.push("inspect");
      projections.push(expected);
      if (lower === "throw") throw new Error("fixture_lower_failure");
      return (
        lower === "real"
          ? dockerProbeConfigurationMatches(inspect, expected)
          : lower
      )
        ? observation
        : null;
    },
    cleanupDockerProbeContainer: (
      _binding: unknown,
      expected: DockerProbeConfigurationExpectation,
    ) => {
      calls.push("cleanup");
      projections.push(expected);
      if (lower === "throw") throw new Error("fixture_lower_failure");
      const confirmed =
        lower === "real"
          ? dockerProbeConfigurationMatches(inspect, expected)
          : lower !== false;
      return {
        confirmed,
        reason: confirmed
          ? lower === "invalid"
            ? "invalid_reason"
            : "docker_probe_absence_confirmed"
          : "docker_container_identity_mismatch",
      };
    },
    observeDockerProbeContainerAbsence: () => {
      calls.push("absence");
      if (lower === "throw") throw new Error("fixture_lower_failure");
      return lower === false
        ? { status: "blocked", reason: "docker_probe_absence_unconfirmed" }
        : {
            status: "confirmed",
            reason:
              lower === "invalid"
                ? "invalid_reason"
                : "docker_probe_absence_confirmed",
          };
    },
  };
  const body =
    functionSource(source, "isObject") +
    functionSource(source, "inspectOwnedContainer") +
    functionSource(source, "cleanupOwnedContainer") +
    functionSource(source, "observeContainerAbsence") +
    functionSource(source, "confirmDockerAbsence");
  const runtime = runInNewContext(
    `(()=>{${body};return {inspect:inspectOwnedContainer,cleanup:cleanupOwnedContainer,observe:observeContainerAbsence,confirm:confirmDockerAbsence}})()`,
    context,
  ) as {
    inspect: (
      cli: object,
      capability: object,
      borrowedMounts: typeof mounts,
    ) => unknown;
    cleanup: (
      cli: object,
      capability: object,
      borrowedMounts: typeof mounts,
      host: string,
    ) => { confirmed: boolean; reason: string; absenceCapability?: object };
    observe: (
      cli: object,
      identity: object,
      host: string,
      root: string,
    ) => object | null;
    confirm: (
      host: string,
      mount: unknown,
      capability: unknown,
      expected: object,
    ) => { hostRecoveryId: string };
  };
  return {
    sources,
    capability,
    identity,
    identities,
    mounts,
    calls,
    projections,
    inspect,
    observation,
    registrations,
    hostTransitions,
    runtime,
    source,
  };
}

/**
 * 必須profileから候補と3mountだけを搬送する。
 * @responsibility 現行profileを単一候補へ限定し、legacyは明示値だけで選ぶ。
 * @trace ERB-IT-004
 * @precondition 下位の固定profile構成を使用する。
 * @stimulus 六profileと明示legacyを与え、欠測・空文字は拒否する。
 * @observation 実上位が渡したfieldと元入力不変。
 * @oracle legacyだけ固定六件、現行は一件。private3領域は非搬送。
 * @cleanup N/A: 局所値だけ。
 * @boundary 下位呼出しは投影観測の代役。実Filesystemは別Suite。
 */
test("上位Probe inspectとcleanupは現行候補と三mountだけを固定する", () => {
  const profiles = [
    "normal",
    "timeout",
    "output_limit",
    "invalid_output",
    "nonzero_exit",
    "cancellation",
  ] as const;
  const initial = fixture("legacy_recovery");
  /**
   * 同じ外側Oracleで選択済み候補を照合する。
   * @responsibility 合法別profile変異を本番catchの外で検出する。
   * @trace ERB-IT-004
   * @precondition 現行Sourceまたは一意な投影変異。
   * @stimulus 固定profileと任意の試験Source差替え。
   * @observation 既存構成期待と三Path。
   * @oracle profileに対応する独立した候補数・順序と一致する。
   * @cleanup N/A: VMメモリだけ。
   * @boundary 本番投影と外側assert。
   */
  const verify = (
    profile: DockerProbeProfile | "legacy_recovery",
    operation: "inspect" | "cleanup",
    sourceOverride?: string,
  ) => {
    const f = fixture(profile, true, sourceOverride);
    const before = {
      identity: structuredClone(f.identity),
      mounts: structuredClone(f.mounts),
    };
    if (operation === "inspect")
      assert.equal(
        JSON.stringify(f.runtime.inspect({}, f.capability, f.mounts)),
        JSON.stringify(f.observation),
      );
    else
      assert.equal(
        f.runtime.cleanup({}, f.capability, f.mounts, "fixed-host").confirmed,
        true,
      );
    assert.equal(f.projections.length, 1);
    const projection = f.projections[0];
    assert.ok(projection);
    assert.deepEqual(Object.keys(projection).sort(), [
      "id",
      "mounts",
      "probeId",
      "sourceCandidates",
    ]);
    assert.deepEqual(
      Array.from(projection.sourceCandidates),
      profile === "legacy_recovery"
        ? initial.sources
        : [initial.sources[profiles.indexOf(profile)]],
    );
    assert.deepEqual(
      { ...projection.mounts },
      {
        workspace: f.mounts.workspace,
        providerHome: f.mounts.providerHome,
        tmp: f.mounts.tmp,
      },
    );
    assert.deepEqual(f.identity, before.identity);
    assert.deepEqual(f.mounts, before.mounts);
    assert.deepEqual(f.calls, [operation]);
    assert.equal(f.registrations.length, operation === "cleanup" ? 1 : 0);
  };
  for (const operation of ["inspect", "cleanup"] as const) {
    for (const profile of ["legacy_recovery", ...profiles] as const)
      verify(profile, operation);
    const name =
      operation === "inspect"
        ? "inspectOwnedContainer"
        : "cleanupOwnedContainer";
    const begin = initial.source.indexOf(`function ${name}(`),
      end = initial.source.indexOf("\n/**", begin);
    const inspectBody = initial.source.slice(begin, end),
      needle = "describeDockerProbeConfiguration(\n      identity.profile,";
    assert.equal(inspectBody.split(needle).length, 2);
    for (const [selected, replacement] of [
      ["normal", "legacy_recovery"],
      ["legacy_recovery", "normal"],
    ] as const) {
      const mutant =
        initial.source.slice(0, begin) +
        inspectBody.replace(
          needle,
          `describeDockerProbeConfiguration(\n      "${replacement}",`,
        ) +
        initial.source.slice(end);
      assert.throws(() => verify(selected, operation, mutant), {
        code: "ERR_ASSERTION",
      });
    }
  }
  for (const invalid of [undefined, "", "unknown"]) {
    const f = fixture(invalid as DockerProbeProfile | undefined);
    assert.throws(
      () => f.runtime.inspect({}, f.capability, f.mounts),
      /docker_probe_profile_invalid/u,
    );
    assert.throws(
      () => f.runtime.cleanup({}, f.capability, f.mounts, "fixed-host"),
      /docker_probe_profile_invalid/u,
    );
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.registrations, []);
  }
});

/**
 * 旧record採用だけが明示legacy構成を私有Identityへ登録する。
 * @responsibility 欠測profileを通常実行の互換fallbackへしない。
 * @trace ERB-IT-004
 * @precondition 実回復関数・実inspect投影・私有Mapを接続する。
 * @stimulus 旧recordの実IDを読み取り下位構成拒否まで到達する。
 * @observation 登録profile、六候補、実ID、create／start非発行。
 * @oracle 明示legacy一件だけ登録し、下位拒否で回復を停止する。
 * @cleanup N/A: FS・Host・Docker処置は代役、実資源を作らない。
 * @boundary 旧record読取り→実上位構成投影。実回復成立の証明ではない。
 */
test("旧record採用だけが明示legacy profileで固定六候補を照合する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/isolation-probe.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.split('profile: "legacy_recovery",').length, 2);
  const body =
    functionSource(source, "recoverDockerIsolationProbe") +
    functionSource(source, "inspectOwnedContainer");
  const nonce = "123e4567-e89b-42d3-a456-426614174000",
    rootName = `crdd-coordinator-doctor-${nonce}`;
  const root = path.resolve(".crdd/tests", rootName),
    id = "a".repeat(64),
    probeId = "old-probe";
  const mounts = {
    workspace: path.join(root, "workspace"),
    providerHome: path.join(root, "provider-home"),
    tmp: path.join(root, "tmp"),
    management: path.join(root, "management"),
  };
  const registered: object[] = [],
    observed: object[] = [];
  const identities = new WeakMap<object, object>();
  const set = identities.set.bind(identities);
  identities.set = (key, value) => {
    registered.push(JSON.parse(JSON.stringify(value)));
    return set(key, value);
  };
  const cli = {};
  let factoryCalls = 0;
  const bindings: unknown[] = [];
  const recover = runInNewContext(
    `(()=>{${body};return recoverDockerIsolationProbe;})()`,
    {
      Object,
      path,
      fs: { realpathSync: (value: string) => value },
      parseDockerProbeRecoveryToken: () => ({ rootName }),
      acquireHostOperationRecoveryGenerationByIdentity: () => ({}),
      releaseHostOperationRecoveryGeneration: () => true,
      loadDockerProbeRecoveryRecord: () => ({
        record: {
          hostRecoveryId: "host",
          container: { id },
          probeId,
          rootName,
        },
        parsed: { rootName },
        root,
        children: mounts,
      }),
      parseHostRecoveryToken: () => ({ rootName, nonce }),
      createDockerProbeRuntimeBinding: (readManagement: () => unknown) => {
        factoryCalls++;
        assert.equal(readManagement(), mounts.management);
        return Object.assign(cli, {
          verifyCli: () => {
            return "fixed-cli";
          },
          environment: () => ({}),
        });
      },
      observeContainerAbsence: (_cli: unknown, identity: object) => {
        bindings.push(_cli);
        observed.push(JSON.parse(JSON.stringify(identity)));
        return null;
      },
      requireDockerProbeRecoveryMounts: () => mounts,
      containerIdentities: identities,
      describeDockerProbeConfiguration: (
        profile: DockerProbeProfile | "legacy_recovery",
        identity: { id: string; probeId: string },
        selectedMounts: {
          workspace: string;
          providerHome: string;
          tmp: string;
        },
      ) =>
        describeDockerProbeConfiguration(
          profile,
          structuredClone(identity),
          structuredClone(selectedMounts),
        ),
      inspectDockerProbeContainer: (
        _binding: unknown,
        expected: DockerProbeConfigurationExpectation,
      ) => {
        bindings.push(_binding);
        assert.equal(expected.id, id);
        assert.equal(expected.probeId, probeId);
        assert.equal(expected.sourceCandidates.length, 6);
        return null;
      },
      normalizeFailure: () => "unexpected_failure",
    },
  ) as (token: string, root: string) => { status: string; reason: string };
  assert.deepEqual(JSON.parse(JSON.stringify(recover("old-token", root))), {
    status: "blocked",
    reason: "docker_recovery_container_mismatch",
    recoveryId: "old-token",
  });
  assert.deepEqual(registered, [{ id, probeId, profile: "legacy_recovery" }]);
  assert.equal(factoryCalls, 1);
  assert.equal(bindings.length, 2);
  for (const binding of bindings) assert.equal(binding, cli);
  assert.deepEqual(observed, registered);
});

/**
 * 下位構成拒否と私有参照喪失の後に削除を発行しない。
 * @responsibility 判定falseを受理へ丸めず既存cleanup拒否へ接続する。
 * @trace ERB-IT-004
 * @precondition inspectは不正Imageの独立値であり真正DI判定へ渡す。
 * @stimulus 実下位falseと私有capability取下げを別条件で与える。
 * @observation 上位結果、inspect／remove件数。
 * @oracle 構成拒否ではinspect1/remove0、私有参照なしでは全Docker要求0。
 * @cleanup N/A: 実資源なし。
 * @boundary Host世代Ownerの実失効・実回収はこの試験の証明範囲外。
 */
test("下位inspect拒否と私有参照喪失は上位削除を止める", () => {
  const f = fixture("legacy_recovery", "real");
  assert.equal(
    f.runtime.cleanup({}, f.capability, f.mounts, "fixed-host").reason,
    "docker_container_identity_mismatch",
  );
  assert.deepEqual(f.calls, ["cleanup"]);
  assert.deepEqual(f.registrations, []);
  const missing = fixture("legacy_recovery");
  missing.identities.delete(missing.capability);
  assert.equal(
    missing.runtime.cleanup(
      {},
      missing.capability,
      missing.mounts,
      "fixed-host",
    ).reason,
    "docker_container_identity_unknown",
  );
  assert.deepEqual(missing.calls, []);
  assert.deepEqual(missing.registrations, []);
});

/**
 * 下位の同じ同期返却だけから既存Host相関を発行する。
 * @responsibility 下位失敗や私有参照欠測をHost遷移へ昇格しない。
 * @trace ERB-IT-004
 * @precondition 本番の上位本文と既存Mapだけを同じVMへ接続する。
 * @stimulus 成功、blocked、例外、不正理由、別相関、Capabilityコピーを与える。
 * @observation Map登録数、Host遷移数、同一参照の消費。
 * @oracle 同期成功後に元のID／Host／Root／CLIだけ登録し、exact確認後に一回消費する。
 * @cleanup N/A: VMとMapのみ。実Host・Docker資源なし。
 * @boundary 上位本番本文と下位の代役。実Host世代失効の証明ではない。
 */
test("Probeの下位失敗はHost相関を発行せず成功参照はexact一回だけ消費する", () => {
  for (const lower of [false, "throw", "invalid"] as const) {
    const f = fixture("legacy_recovery", lower);
    if (lower === "throw")
      assert.throws(
        () => f.runtime.cleanup({}, f.capability, f.mounts, "fixed-host"),
        /fixture_lower_failure/u,
      );
    else
      assert.equal(
        f.runtime.cleanup({}, f.capability, f.mounts, "fixed-host").confirmed,
        false,
      );
    assert.deepEqual(f.registrations, []);
    assert.deepEqual(f.hostTransitions, []);
    if (lower === "throw")
      assert.throws(
        () => f.runtime.observe({}, f.identity, "fixed-host", "fixed-root"),
        /fixture_lower_failure/u,
      );
    else
      assert.equal(
        f.runtime.observe({}, f.identity, "fixed-host", "fixed-root"),
        null,
      );
    assert.deepEqual(f.registrations, []);
  }
  const f = fixture("legacy_recovery");
  const cli = {};
  const cleaned = f.runtime.cleanup(cli, f.capability, f.mounts, "fixed-host");
  assert.equal(cleaned.confirmed, true);
  assert.ok(cleaned.absenceCapability);
  assert.equal(f.registrations.length, 1);
  const expected = {
    probeId: f.identity.probeId,
    id: f.identity.id,
    rootName: "fixed-root",
    cli,
    root: "fixed-root",
  };
  for (const key of ["probeId", "id", "rootName", "cli"] as const)
    assert.throws(
      () =>
        f.runtime.confirm("fixed-host", null, cleaned.absenceCapability, {
          ...expected,
          [key]: key === "cli" ? {} : "wrong",
        }),
      /docker_absence_capability_required/u,
    );
  assert.throws(
    () =>
      f.runtime.confirm(
        "other-host",
        null,
        cleaned.absenceCapability,
        expected,
      ),
    /docker_absence_capability_required/u,
  );
  assert.throws(
    () =>
      f.runtime.confirm(
        "fixed-host",
        null,
        { ...cleaned.absenceCapability },
        expected,
      ),
    /docker_absence_capability_required/u,
  );
  assert.deepEqual(f.hostTransitions, []);
  assert.equal(
    f.runtime.confirm("fixed-host", null, cleaned.absenceCapability, expected)
      .hostRecoveryId,
    "fixed-host-next",
  );
  assert.equal(f.hostTransitions.length, 1);
  assert.throws(
    () =>
      f.runtime.confirm(
        "fixed-host",
        null,
        cleaned.absenceCapability,
        expected,
      ),
    /docker_absence_capability_required/u,
  );
});
