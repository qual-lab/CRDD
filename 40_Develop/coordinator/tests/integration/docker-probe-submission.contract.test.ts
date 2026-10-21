/**
 * Probeの二保存とDI作成要求の順序を検証する。
 * @packageDocumentation
 * @responsibility 保存拒否・作成unknownから開始へ進まない上位接続を反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実上位関数本文とDI／Hostの代役。実Docker・耐久保存は実行しない。
 * @boundary ERB-IT-004=Related 2 Blocks: Coordinator保存順序→DI作成。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 一意な本番関数の本文を型除去して取得する。
 * @responsibility 上位投影・入口を別の手書き実装へ置換しない。
 * @trace ERB-IT-004
 * @precondition 対象名はSource内に一回だけ現れる。
 * @stimulus 関数開始から次のHeaderまでを抽出する。
 * @observation 実本文の実行用文字列。
 * @oracle 欠測・重複は試験準備時に失敗する。
 * @cleanup N/A: 読取りとメモリだけ。
 * @boundary 本番Sourceと検証VM。
 */
function probeFunctionSource(source: string, name: string) {
  const marker = `function ${name}(`;
  assert.equal(source.split(marker).length, 2);
  const declaration = source.indexOf(marker);
  const begin =
    source.slice(declaration - 6, declaration) === "async "
      ? declaration - 6
      : declaration;
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin > 0 && end > begin);
  return stripTypeScriptTypes(source.slice(begin, end));
}

/**
 * 実上位本文の保存拒否とunknownを要求列で確認する。
 * @responsibility 手書きモデルでなく現在の実行関数を検査する。
 * @trace ERB-IT-004
 * @precondition 対象関数名がSource中で一意である。
 * @stimulus Engine拒否、二保存の各失敗、rollback失敗、作成unknown、正常を与える。
 * @observation 保存・作成・開始・回収の順序と既発生事実。
 * @oracle 実ID保存後だけstartし、既知IDの補償回収とunknown保持を混同しない。
 * @cleanup N/A: VMと局所値のみ。
 * @boundary Coordinator実本文と合成依存。実Writer・実Dockerの証明ではない。
 */
test("Probe二保存はcreate前とstart前をそれぞれ停止できる", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/isolation-probe.ts", import.meta.url),
    "utf8",
  );
  const marker = "function runDockerIsolationScenario(";
  assert.equal(source.split(marker).length, 2);
  const begin = source.indexOf(marker);
  const body = stripTypeScriptTypes(
    source.slice(begin, source.indexOf("\n/**", begin)),
  );
  const projectionBody = [
    "isObject",
    "ownValue",
    "ownString",
    "errorMessage",
    "normalizeFailure",
    "dynamicFakeLifecycleBlocked",
    "blocked",
    "normalizeDockerProbeFailure",
    "normalizeHostCleanupResult",
  ]
    .map((name) => probeFunctionSource(source, name))
    .join("\n");
  const projection = runInNewContext(
    `(()=>{${projectionBody};return {blocked,normalizeDockerProbeFailure,normalizeHostCleanupResult,dynamicFakeLifecycleBlocked};})()`,
  ) as {
    blocked: (reason: string, ...args: unknown[]) => Record<string, unknown>;
    normalizeDockerProbeFailure: (
      ...args: unknown[]
    ) => Record<string, unknown>;
    normalizeHostCleanupResult: (...args: unknown[]) => Record<string, unknown>;
    dynamicFakeLifecycleBlocked: (reason: string) => Record<string, unknown>;
  };
  const id = "a".repeat(64);
  for (const scenario of [
    "engine",
    "save-null",
    "rollback",
    "unknown",
    "save-id",
    "normal",
  ] as const) {
    const calls: string[] = [];
    const owned = {};
    const mounts = {
      workspace: "workspace",
      providerHome: "home",
      tmp: "tmp",
      management: path.join("root", "management"),
    };
    const blocked = projection.blocked;
    const failureSnapshots: Record<string, unknown>[] = [];
    const run = runInNewContext(
      `(()=>{${body};return runDockerIsolationScenario;})()`,
      {
        Object,
        path,
        performance,
        randomUUID: () => "probe",
        blocked,
        getOwnedHostRecoveryId: () => "host",
        createDockerProbeRuntimeBinding: (readManagement: () => unknown) => {
          assert.equal(readManagement(), mounts.management);
          return {};
        },
        createOwnedMountCapability: () => ({}),
        verifyOwnedMountCapability: () => mounts,
        observeDockerProbeEngine: () => {
          calls.push("engine");
          return scenario !== "engine";
        },
        beginDockerSubmission: () => {
          calls.push("begin");
          return "host-submitted";
        },
        writeDockerProbeRecoveryRecord: (...args: unknown[]) => {
          const stage = args[4] === null ? "save-null" : "save-id";
          calls.push(stage);
          if (
            scenario === stage ||
            (scenario === "rollback" && stage === "save-null")
          )
            throw new Error(stage);
          if (stage === "save-id") assert.equal(args[4], id);
          return stage === "save-null"
            ? "recovery-before-id"
            : "recovery-with-id";
        },
        cancelDockerSubmissionBeforeCreate: () => {
          calls.push("rollback");
          if (scenario === "rollback") throw new Error("rollback");
          return "host";
        },
        createDockerProbeContainer: (_binding: unknown, profile: unknown) => {
          calls.push("create");
          assert.equal(profile, "normal");
          return scenario === "unknown"
            ? { status: "blocked", reason: "docker_container_identity_unknown" }
            : { status: "confirmed", id };
        },
        containerIdentities: new WeakMap(),
        inspectOwnedContainer: () => {
          calls.push("inspect");
          return {};
        },
        runDockerProbeToCompletion: (
          _binding: unknown,
          profile: unknown,
          containerId: unknown,
        ) => {
          calls.push("run");
          assert.equal(profile, "normal");
          assert.equal(containerId, id);
          return { isolation: { status: "confirmed", reason: "fixed-result" } };
        },
        dynamicFakeLifecycleBlocked: projection.dynamicFakeLifecycleBlocked,
        createDynamicFakeProviderLifecycleCapability: () => ({}),
        normalizeDockerProbeFailure: (
          error: Error,
          probeId: string,
          context: { recoveryId: string | null },
        ) => {
          const result = projection.normalizeDockerProbeFailure(
            error,
            probeId,
            context,
          );
          failureSnapshots.push(JSON.parse(JSON.stringify(result)));
          return result;
        },
        cleanupOwnedContainer: () => {
          calls.push("cleanup");
          return { confirmed: true, absenceCapability: {} };
        },
        confirmDockerAbsence: () => {
          calls.push("absence");
          return {
            hostRecoveryId: "host-clean",
            lifecycleAbsenceCapability: {},
          };
        },
        finishHostRecovery: (_host: unknown, result: object) => {
          calls.push("host-cleanup");
          return {
            result: projection.normalizeHostCleanupResult(
              { status: "recovered", reason: "host-clean" },
              "host-clean",
              result,
            ),
            lifecycleHostCleanupCapability: {},
          };
        },
        createDynamicFakeProviderFinalizationCapability: () => ({}),
        finalizeDynamicFakeProviderLifecycle: () => ({ status: "verified" }),
        invalidateDynamicFakeProviderLifecycle: () => undefined,
        finishPreSubmissionCleanup: (
          _owned: unknown,
          _host: unknown,
          result: object,
        ) => {
          calls.push("pre-cleanup");
          return result;
        },
      },
    ) as (
      owned: unknown,
      scenario: null,
    ) => {
      status: string;
      reason: string;
      recoveryId: string | null;
      fakeProviderLifecycle: { diagnosticDockerContainerEffectIssued: boolean };
    };
    const result = run(owned, null);
    const expected =
      scenario === "engine"
        ? ["engine", "pre-cleanup"]
        : scenario === "save-null"
          ? ["engine", "begin", "save-null", "rollback", "pre-cleanup"]
          : scenario === "rollback"
            ? ["engine", "begin", "save-null", "rollback"]
            : scenario === "unknown"
              ? ["engine", "begin", "save-null", "create"]
              : scenario === "save-id"
                ? [
                    "engine",
                    "begin",
                    "save-null",
                    "create",
                    "save-id",
                    "cleanup",
                    "absence",
                    "host-cleanup",
                  ]
                : [
                    "engine",
                    "begin",
                    "save-null",
                    "create",
                    "save-id",
                    "inspect",
                    "run",
                    "cleanup",
                    "absence",
                    "host-cleanup",
                  ];
    assert.deepEqual(calls, expected, scenario);
    assert.equal(
      result.status,
      scenario === "normal" ? "confirmed" : "blocked",
    );
    assert.equal(
      result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued,
      ["unknown", "save-id", "normal"].includes(scenario),
    );
    if (scenario === "rollback") {
      assert.equal(result.reason, "docker_submission_rollback_failed");
      assert.equal(
        (result as unknown as Record<string, unknown>).manualRecoveryRequired,
        true,
      );
    }
    if (scenario === "unknown" || scenario === "save-id") {
      const unknown = scenario === "unknown";
      const reason = unknown
        ? "docker_container_identity_unknown"
        : "docker_isolation_probe_failed";
      if (!unknown)
        assert.equal(failureSnapshots[0]?.recoveryId, "recovery-before-id");
      assert.deepEqual(JSON.parse(JSON.stringify(result)), {
        status: "blocked",
        reason,
        probeId: "probe",
        retainOperationDirectories: unknown,
        hostCleanupCompleted: !unknown,
        recoveryId: unknown ? "recovery-before-id" : null,
        manualRecoveryRequired: false,
        cleanup: unknown ? "unconfirmed" : "confirmed",
        fakeProviderLifecycle: {
          status: "blocked",
          reason,
          provenance: "repository_owned_docker_fake_provider",
          fakeProviderStartAttempted: false,
          fakeProviderExecuted: false,
          resultNormalizationVerified: false,
          containerAbsenceVerified: false,
          processTreeAbsenceVerified: false,
          hostCleanupVerified: false,
          elapsedMs: null,
          stdoutBytes: 0,
          stderrBytes: 0,
          exitCode: null,
          signal: null,
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
      });
    }
  }
});

/**
 * 全作成Callerのprofileと対象相関を到達点で確認する。
 * @responsibility 作成以降の成功を代役で捏造せず入力搬送だけを反証する。
 * @trace ERB-IT-004
 * @precondition 三入口の実本文と固定bindingを使用する。
 * @stimulus 通常・四故障・取消・残存と合法な一軸搬送変異を与える。
 * @observation create到達時のprofile、Probe名、三Path、CLI／環境。
 * @oracle 全Callerが同じ相関を搬送し、変異だけが同じ比較で不一致になる。
 * @cleanup N/A: メモリ内VMだけ。createはunknown代役で停止する。
 * @boundary 上位実本文→DI作成代役。実取消全体は未確認。
 */
test("全Probe作成Callerはprofile・Probe名・三Path・bindingを一致させる", async () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/isolation-probe.ts", import.meta.url),
    "utf8",
  );
  const mounts = {
    workspace: path.resolve("fixture-workspace"),
    providerHome: path.resolve("fixture-home"),
    tmp: path.resolve("fixture-tmp"),
    management: path.resolve("fixture-management"),
  };
  const cli = {};
  const environment = Object.freeze({ FIXED: "fixture" });
  const expectedMounts = {
    workspace: mounts.workspace,
    providerHome: mounts.providerHome,
    tmp: mounts.tmp,
  };
  const routes = [
    ["runDockerIsolationScenario", null, "normal"],
    ...["timeout", "output_limit", "invalid_output", "nonzero_exit"].map(
      (profile) => ["runDockerIsolationScenario", profile, profile] as const,
    ),
    ["runDynamicFakeProviderCancellationVerification", null, "cancellation"],
    ["createDynamicFakeProviderRecoverableResidue", null, "cancellation"],
  ] as const;
  for (const [name, selected, profile] of routes) {
    const originalBody = probeFunctionSource(source, name);
    const variants: [string, string][] = [["baseline", originalBody]];
    if (name === "runDockerIsolationScenario" && selected === null) {
      const callBegin = originalBody.indexOf(
        "const normalizedCreation = createDockerProbeContainer(",
      );
      const callEnd =
        originalBody.indexOf("\n      );", callBegin) + "\n      );".length;
      assert.ok(callBegin > 0 && callEnd > callBegin);
      const createCall = originalBody.slice(callBegin, callEnd);
      for (const [key, needle, replacement] of [
        ["binding", "        creationCli,", "        { ...creationCli },"],
        ["profile", 'scenario ?? "normal"', '"cancellation"'],
        [
          "probe",
          'scenario ?? "normal",\n        probeId,',
          'scenario ?? "normal",\n        "other-probe",',
        ],
        [
          "mount",
          "workspace: mounts.workspace",
          'workspace: path.resolve("other-workspace")',
        ],
      ]) {
        assert.ok(key && needle && replacement);
        assert.equal(createCall.split(needle).length, 2);
        variants.push([
          key,
          originalBody.slice(0, callBegin) +
            createCall.replace(needle, replacement) +
            originalBody.slice(callEnd),
        ]);
      }
    }
    for (const [variant, body] of variants) {
      const captured: object[] = [];
      const bindings: unknown[] = [];
      let factoryCalls = 0;
      /**
       * Probe失敗を固定理由付きの閉じたblocked値へする。
       * @responsibility Probe失敗を固定理由付きの閉じたblocked値へする。
       * @trace ERB-IT-004
       * @precondition 故障点に対応する有限reason。
       * @stimulus 空のProbe lifecycleを伴うblocked値を返す。
       * @observation 返却reasonと上位の停止結果。
       * @oracle 呼出し元がreasonを保持しProbe成功へ変換しない。
       * @cleanup N/A: メモリ上の結果構築だけ。
       * @boundary Probe Consumerの故障代役。Providerを起動しない。
       */
      const blocked = (reason: string) => ({
        status: "blocked",
        reason,
        fakeProviderLifecycle: {},
      });
      const run = runInNewContext(`(()=>{${body};return ${name};})()`, {
        Object,
        path,
        performance,
        randomUUID: () => "probe-123",
        blocked,
        cancellationBlocked: blocked,
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
        createOwnedMountCapability: () => ({}),
        verifyOwnedMountCapability: () => mounts,
        observeDockerProbeEngine: (binding: unknown) => {
          bindings.push(binding);
          return true;
        },
        beginDockerSubmission: () => "host-submitted",
        writeDockerProbeRecoveryRecord: () => "recovery-before-id",
        createDockerProbeContainer: (
          binding: { verifyCli: () => string; environment: () => object },
          selectedProfile: unknown,
          probeId: unknown,
          actualMounts: unknown,
        ) => {
          bindings.push(binding);
          captured.push({
            profile: selectedProfile,
            probeId,
            mounts: JSON.parse(JSON.stringify(actualMounts)),
            cli: binding.verifyCli(),
            environment: binding.environment(),
          });
          return {
            status: "blocked",
            reason: "docker_container_identity_unknown",
          };
        },
        normalizeDockerProbeFailure: () =>
          blocked("docker_container_identity_unknown"),
        normalizeCancellationFailure: () => "docker_container_identity_unknown",
        normalizeFailure: () => "docker_container_identity_unknown",
        invalidateDynamicFakeProviderLifecycle: () => undefined,
      }) as (owned: object, selected: unknown) => unknown;
      await run({}, selected);
      assert.equal(factoryCalls, 1);
      assert.equal(bindings.length, 2);
      assert.equal(bindings[0], cli);
      if (variant === "binding")
        assert.throws(() => assert.equal(bindings[1], cli));
      else assert.equal(bindings[1], cli);
      assert.equal(captured.length, 1, `${name}:${variant}`);
      const expected = [
        {
          profile,
          probeId: "probe-123",
          mounts: expectedMounts,
          cli: "fixed-cli",
          environment,
        },
      ];
      if (variant === "baseline" || variant === "binding")
        assert.deepEqual(captured, expected, name);
      else
        assert.throws(() => assert.deepEqual(captured, expected), {
          code: "ERR_ASSERTION",
        });
    }
  }
});
