/**
 * 保存後Probe実行の搬送と私有lifecycle評価を検証する。
 * @packageDocumentation
 * @responsibility 閉factsの保持・消費と公開成功への昇格条件を反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実上位本文と実私有Map、DI・Host技術操作の代役。
 * @boundary ERB-IT-004=Related 2 Blocks: DI完了事実→Coordinator私有最終評価。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

/**
 * 完了評価に使う一意な本番関数本文を取得する。
 * @responsibility 私有候補登録・消費を手書き代役へ置換しない。
 * @trace ERB-IT-004
 * @precondition 関数名はSource中で一意。
 * @stimulus 現Sourceの宣言から次のHeaderまでを抽出する。
 * @observation 型除去済み実本文。
 * @oracle 欠測・重複を準備失敗にする。
 * @cleanup N/A: 読取りとメモリだけ。
 * @boundary 本番Sourceと検証VM。
 */
function completionFunctionSource(source: string, name: string) {
  const marker = `function ${name}(`;
  assert.equal(source.split(marker).length, 2);
  const begin = source.indexOf(marker),
    end = source.indexOf("\n/**", begin);
  assert.ok(begin > 0 && end > begin);
  return stripTypeScriptTypes(source.slice(begin, end));
}

/**
 * 全実行profileの相関と候補登録から最終消費までを反証する。
 * @responsibility 隔離肯定だけを公開成功へ転用しない。
 * @trace ERB-IT-004
 * @precondition 実投影・私有登録・最終評価の全関数を同VMへ接続する。
 * @stimulus 通常＋四故障のprofile、合法な別profile／実ID、lifecycleだけblockedのfacts。
 * @observation run入力、候補全文、最終公開結果、私有参照の消費。
 * @oracle 別対象変異を相関Oracleで拒否し、lifecycle blockedは回収後も公開blocked。
 * @cleanup N/A: 私有MapとVMだけ。Process・Filesystemを作らない。
 * @boundary 実上位関数とDI／Host技術代役。実資源回収の成立ではない。
 */
test("Probe完了の閉factsは全profileで相関され実私有評価だけで公開される", () => {
  const source = fs.readFileSync(
    new URL("../../src/diagnostics/isolation-probe.ts", import.meta.url),
    "utf8",
  );
  const helpers = [
    "isObject",
    "ownValue",
    "ownString",
    "errorMessage",
    "normalizeFailure",
    "dynamicFakeLifecycleBlocked",
    "blocked",
    "normalizeDockerProbeFailure",
    "normalizeHostCleanupResult",
    "projectProbeExecutionFacts",
    "createDynamicFakeProviderLifecycleCapability",
    "createDynamicFakeProviderFinalizationCapability",
    "invalidateDynamicFakeProviderLifecycle",
    "evaluateDynamicFakeProviderFinalization",
    "finalizeDynamicFakeProviderLifecycle",
  ]
    .map((name) => completionFunctionSource(source, name))
    .join("\n");
  const original = completionFunctionSource(
    source,
    "runDockerIsolationScenario",
  );
  const runBegin = original.indexOf(
    "const facts = runDockerProbeToCompletion(",
  );
  const runEnd =
    original.indexOf("\n          );", runBegin) + "\n          );".length;
  assert.ok(runBegin > 0 && runEnd > runBegin);
  const runCall = original.slice(runBegin, runEnd);
  const id = "a".repeat(64);
  for (const selected of [
    null,
    "timeout",
    "output_limit",
    "invalid_output",
    "nonzero_exit",
  ] as const) {
    const variants: [string, string, boolean][] = [
      ["baseline", original, false],
    ];
    if (selected === null) {
      variants.push(["lifecycle-blocked", original, true]);
      for (const [name, needle, replacement] of [
        ["profile", 'scenario ?? "normal"', '"timeout"'],
        ["id", "identity.id", '"b".repeat(64)'],
      ]) {
        assert.ok(name && needle && replacement);
        assert.equal(runCall.split(needle).length, 2);
        variants.push([
          name,
          original.slice(0, runBegin) +
            runCall.replace(needle, replacement) +
            original.slice(runEnd),
          false,
        ]);
      }
    }
    for (const [variant, body, lifecycleBlocked] of variants) {
      const cli = {},
        mountCapability = {};
      const environment = Object.freeze({ FIXED: "fixture" });
      const mounts = {
        workspace: "workspace",
        providerHome: "home",
        tmp: "tmp",
        management: path.join("root", "management"),
      };
      const pending = new WeakMap<object, Record<string, unknown>>();
      const observations: { key: object; value: Record<string, unknown> }[] =
        [];
      const pendingSet = pending.set.bind(pending);
      pending.set = (key, value) => {
        observations.push({ key, value });
        return pendingSet(key, value);
      };
      const finalizations = new WeakMap<object, unknown>(),
        absences = new WeakMap<object, unknown>(),
        cleanups = new WeakMap<object, unknown>();
      const absenceKeys: object[] = [],
        cleanupKeys: object[] = [],
        finalizationKeys: object[] = [];
      const finalizationSet = finalizations.set.bind(finalizations);
      finalizations.set = (key, value) => {
        finalizationKeys.push(key);
        return finalizationSet(key, value);
      };
      const captures: object[] = [],
        cliInputs: unknown[] = [];
      const identities = new WeakMap<object, object>();
      const identityObservations: object[] = [];
      const registerIdentity = identities.set.bind(identities);
      identities.set = (key, value) => {
        identityObservations.push(JSON.parse(JSON.stringify(value)));
        return registerIdentity(key, value);
      };
      const facts = Object.freeze({
        isolation: Object.freeze({
          status: "confirmed",
          reason: "docker_fake_provider_isolation_confirmed",
        }),
        lifecycleStatus: lifecycleBlocked ? "blocked" : "candidate",
        lifecycleReason: lifecycleBlocked
          ? "dynamic_fake_provider_execution_envelope_invalid"
          : "dynamic_fake_provider_result_observed",
        elapsedMs: 17,
        stdoutBytes: 111,
        stderrBytes: 13,
        exitCode: 0,
        signal: lifecycleBlocked ? "SIGTERM" : null,
        timedOut: false,
      });
      const bindings: unknown[] = [];
      let factoryCalls = 0;
      const run = runInNewContext(
        `(()=>{${helpers};${body};return runDockerIsolationScenario;})()`,
        {
          Object,
          path,
          pendingDynamicLifecycleObservations: pending,
          dynamicLifecycleFinalizations: finalizations,
          dynamicLifecycleAbsences: absences,
          dynamicLifecycleHostCleanups: cleanups,
          randomUUID: () => "probe-123",
          getOwnedHostRecoveryId: () => "host",
          createDockerProbeRuntimeBinding: (readManagement: () => unknown) => {
            factoryCalls++;
            assert.equal(readManagement(), mounts.management);
            return Object.assign(cli, {
              verifyCli: () => {
                return "fixed-cli";
              },
              environment: () => environment,
            });
          },
          createOwnedMountCapability: () => mountCapability,
          verifyOwnedMountCapability: () => mounts,
          observeDockerProbeEngine: (binding: unknown) => {
            bindings.push(binding);
            return true;
          },
          beginDockerSubmission: () => "host-submitted",
          writeDockerProbeRecoveryRecord: () => "recovery-id",
          createDockerProbeContainer: (binding: unknown) => {
            bindings.push(binding);
            return { status: "confirmed", id };
          },
          containerIdentities: identities,
          inspectOwnedContainer: (binding: unknown) => {
            bindings.push(binding);
            return {};
          },
          runDockerProbeToCompletion: (
            binding: { verifyCli: () => string; environment: () => object },
            profile: unknown,
            actualId: unknown,
          ) => {
            bindings.push(binding);
            cliInputs.push(binding);
            captures.push({
              profile,
              id: actualId,
              cli: binding.verifyCli(),
              environment: binding.environment(),
            });
            return facts;
          },
          cleanupOwnedContainer: (binding: unknown) => {
            bindings.push(binding);
            return {
              confirmed: true,
              absenceCapability: {},
            };
          },
          confirmDockerAbsence: () => {
            const key = {};
            absenceKeys.push(key);
            absences.set(key, {
              probeId: "probe-123",
              containerId: id,
              initialHostRecoveryId: "host-submitted",
              confirmedHostRecoveryId: "host-clean",
            });
            return {
              hostRecoveryId: "host-clean",
              lifecycleAbsenceCapability: key,
            };
          },
          finishHostRecovery: (
            _host: unknown,
            result: object,
            _probe: unknown,
            absenceCapability: object,
          ) => {
            const key = {};
            cleanupKeys.push(key);
            cleanups.set(key, {
              probeId: "probe-123",
              confirmedHostRecoveryId: "host-clean",
              absenceCapability,
            });
            return {
              result: { ...result, hostCleanupCompleted: true },
              lifecycleHostCleanupCapability: key,
            };
          },
        },
      ) as (
        owned: object,
        selected: string | null,
      ) => {
        status: string;
        reason: string;
        fakeProviderLifecycle: Record<string, unknown>;
      };
      const result = run({}, selected);
      assert.equal(factoryCalls, 1);
      assert.equal(bindings.length, 5);
      for (const binding of bindings) assert.equal(binding, cli);
      assert.deepEqual(identityObservations, [
        { id, probeId: "probe-123", profile: selected ?? "normal" },
      ]);
      assert.equal(captures.length, 1);
      assert.deepEqual(cliInputs, [cli]);
      const expected = [
        { profile: selected ?? "normal", id, cli: "fixed-cli", environment },
      ];
      if (variant === "profile" || variant === "id")
        assert.throws(() => assert.deepEqual(captures, expected), {
          code: "ERR_ASSERTION",
        });
      else assert.deepEqual(captures, expected);
      assert.equal(observations.length, 1);
      assert.deepEqual(
        JSON.parse(JSON.stringify(observations[0]?.value.observation)),
        {
          status: lifecycleBlocked ? "blocked" : "candidate",
          reason: facts.lifecycleReason,
          provenance: "repository_owned_docker_fake_provider",
          fakeProviderStartAttempted: true,
          fakeProviderExecuted: false,
          resultNormalizationVerified: false,
          containerAbsenceVerified: false,
          processTreeAbsenceVerified: false,
          hostCleanupVerified: false,
          elapsedMs: 17,
          stdoutBytes: 111,
          stderrBytes: 13,
          exitCode: 0,
          signal: lifecycleBlocked ? "SIGTERM" : null,
          timedOut: false,
          cancellationRequested: false,
          cancellationObservation: "not_implemented",
          diagnosticDockerContainerEffectIssued: true,
          diagnosticFilesystemEffectIssued: true,
          providerNetworkEffectIssued: false,
          runtimeAuthorityIssued: false,
          operationCapabilityIssued: false,
          realProviderReadiness: false,
        },
      );
      assert.equal(result.status, lifecycleBlocked ? "blocked" : "confirmed");
      assert.equal(
        result.fakeProviderLifecycle.status,
        lifecycleBlocked ? "blocked" : "verified",
      );
      if (lifecycleBlocked)
        assert.equal(
          result.reason,
          "dynamic_fake_provider_finalization_incomplete",
        );
      assert.equal(result.fakeProviderLifecycle.stdoutBytes, 111);
      assert.equal(result.fakeProviderLifecycle.signal, facts.signal);
      assert.equal(pending.has(observations[0]?.key ?? {}), false);
      for (const key of finalizationKeys)
        assert.equal(finalizations.has(key), false);
      for (const key of absenceKeys) assert.equal(absences.has(key), false);
      for (const key of cleanupKeys) assert.equal(cleanups.has(key), false);
    }
  }
});
