/**
 * 下位取消事実と上位二保存・私有相関・最終判定の接続を検証する。
 * @packageDocumentation
 * @responsibility 部分成立や別対象を公開verifiedへ昇格しない。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実上位本文と実absence照合、DIとHost技術処置の代役。
 * @boundary ERB-IT-004=Related 2 Blocks: DI閉facts→Coordinator最終公開結果。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { classifyDockerProbeCancellation } from "../../../docker-isolation/src/index.ts";

/**
 * 一意な本番関数を取得して検証VMへ接続する。
 * @responsibility 公開判定と私有相関の処理を代役へ置換しない。
 * @trace ERB-IT-004
 * @precondition 宣言名は一意。
 * @stimulus 宣言から次のHeaderまで型除去する。
 * @observation 実関数本文。
 * @oracle 欠測・重複は準備失敗。
 * @cleanup N/A: メモリだけ。
 * @boundary 本番Sourceと検証VM。
 */
function cancellationProjectionFunction(source: string, name: string) {
  const declaration = source.includes(`async function ${name}(`)
    ? `async function ${name}(`
    : `function ${name}(`;
  assert.equal(source.split(declaration).length, 2);
  const begin = source.indexOf(declaration),
    end = source.indexOf("\n/**", begin);
  assert.ok(end > begin);
  return stripTypeScriptTypes(source.slice(begin, end));
}

/**
 * 取消候補の一条件ずつと実対象相関を公開結果まで確認する。
 * @responsibility 二保存前のrunと隔離部分成立の誤昇格を拒否する。
 * @trace ERB-IT-004
 * @precondition 実取消本体・初期結果・例外分類・absence私有照合を同VMで使用する。
 * @stimulus 全成立、候補／post／attach／Host欠測、cleanup失敗、別実ID、保存失敗。
 * @observation 要求順、下位入力、同期読取り、公開field、absence参照消費。
 * @oracle 全成立だけverified、元失敗→join不明→cleanupの理由順と同ID保持を確認する。
 * @cleanup N/A: 実資源を作らず私有MapはVMと共に破棄する。
 * @boundary 本番上位とDI／Host代役。実回収の根拠ではない。
 */
test("取消事実は二保存・同対象absence・全終了条件を満たしてだけ公開verifiedになる", async () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/isolation-probe.ts", import.meta.url),
    "utf8",
  );
  const helpers = [
    "isObject",
    "ownValue",
    "ownString",
    "errorMessage",
    "cancellationBlocked",
    "normalizeCancellationFailure",
    "confirmDockerAbsence",
    "runDynamicFakeProviderCancellationVerification",
  ]
    .map((name) => cancellationProjectionFunction(source, name))
    .join("\n");
  const id = "a".repeat(64),
    probeId = "probe-123";
  const mounts = {
    workspace: path.resolve("fixture/workspace"),
    providerHome: path.resolve("fixture/home"),
    tmp: path.resolve("fixture/tmp"),
    management: path.resolve("fixture/management"),
  };
  const exact = classifyDockerProbeCancellation(
    {
      status: 42,
      signal: null,
      stdout:
        '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}\n{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}\n',
      stderr: "",
    },
    11,
    true,
  );
  const scenarios = [
    "success",
    "candidate-blocked",
    "post-missing",
    "attach-missing",
    "host-missing",
    "cleanup-failed",
    "wrong-absence-id",
    "run-throw",
    "save-id-failed",
    "compound",
    "compound-cleanup",
  ];
  /**
   * 上位の一条件と複合理由を独立した公開結果へ照合する。
   * @responsibility 製品内部catchの外で変異を検出する。
   * @trace ERB-IT-004
   * @precondition 本番本文または一意変異を渡す。
   * @stimulus 単独・複合故障。
   * @observation 公開結果全文と私有absence。
   * @oracle 固定期待からだけ合否判定する。
   * @cleanup N/A: VMのメモリだけ。
   * @boundary 本番上位と外側assert。
   */
  const verify = async (scenario: string, bodies = helpers) => {
    const compound = scenario.startsWith("compound");
    const calls: string[] = [];
    const cli = {},
      mountCapability = {},
      environment = { FIXED: "fixture" };
    const absences = new WeakMap<object, object>(),
      identities = new WeakMap<object, object>();
    let absenceRef: object | null = null;
    const captured: object[] = [];
    const bindings: unknown[] = [];
    let factoryCalls = 0;
    const run = runInNewContext(
      `(()=>{${bodies};return runDynamicFakeProviderCancellationVerification;})()`,
      {
        Object,
        Reflect,
        Error,
        Set,
        path,
        randomUUID: () => probeId,
        containerIdentities: identities,
        absenceCapabilities: absences,
        dynamicLifecycleAbsences: new WeakMap(),
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
        verifyOwnedMountCapability: (value: unknown) => {
          assert.equal(value, mountCapability);
          return mounts;
        },
        observeDockerProbeEngine: (binding: unknown) => {
          bindings.push(binding);
          calls.push("engine");
          return true;
        },
        beginDockerSubmission: () => {
          calls.push("begin");
          return "host-submitted";
        },
        writeDockerProbeRecoveryRecord: (
          _mounts: unknown,
          actualProbe: string,
          _nonce: string,
          host: string,
          actualId: string | null,
        ) => {
          assert.equal(actualProbe, probeId);
          assert.equal(host, "host-submitted");
          calls.push(actualId === null ? "save-null" : "save-id");
          if (actualId !== null) {
            assert.equal(actualId, id);
            if (scenario === "save-id-failed") throw new Error("fixture");
          }
          return actualId === null ? "before-id" : "after-id";
        },
        runDockerProbeCancellation: async (
          binding: { verifyCli: () => string; environment: () => object },
          identity: object,
          read: () => object,
        ) => {
          bindings.push(binding);
          calls.push("run");
          captured.push({
            identity: JSON.parse(JSON.stringify(identity)),
            mounts: JSON.parse(JSON.stringify(read())),
            cli: binding.verifyCli(),
            environment: binding.environment(),
          });
          if (scenario === "run-throw")
            throw new Error("owned_operation_mount_replaced");
          if (compound)
            return {
              observation: {
                status: "blocked",
                reason:
                  "dynamic_fake_provider_cancellation_acknowledgement_invalid",
                cancellationRequested: true,
                cancellationSignalRequested: "SIGTERM",
                readyObserved: false,
                cancellationAcknowledged: false,
                processTerminationObserved: false,
                graceElapsedMs: 30,
                stdoutBytes: 0,
                stderrBytes: 0,
                exitCode: null,
                signal: null,
              },
              status: "blocked",
              reason:
                "dynamic_fake_provider_attach_process_termination_unconfirmed",
              primaryFailure:
                "dynamic_fake_provider_cancellation_acknowledgement_invalid",
              postRunMountVerified: false,
              attachProcessTerminationObserved: false,
              attachProcessTerminationRequestCount: 1,
            };
          return {
            observation: {
              ...exact,
              status:
                scenario === "candidate-blocked" ? "blocked" : "candidate",
            },
            status: scenario === "candidate-blocked" ? "blocked" : "candidate",
            reason:
              scenario === "attach-missing"
                ? "dynamic_fake_provider_attach_process_termination_unconfirmed"
                : scenario === "candidate-blocked"
                  ? "dynamic_fake_provider_cancellation_acknowledgement_invalid"
                  : exact.reason,
            postRunMountVerified: scenario !== "post-missing",
            attachProcessTerminationObserved: scenario !== "attach-missing",
            attachProcessTerminationRequestCount: 0,
          };
        },
        cleanupOwnedContainer: (
          _cli: { environment: () => object },
          capability: object,
          _mounts: object,
          host: string,
        ) => {
          calls.push("cleanup");
          bindings.push(_cli);
          assert.equal(_cli, cli);
          assert.equal(_cli.environment(), environment);
          assert.equal(host, "host-submitted");
          assert.deepEqual(
            JSON.parse(JSON.stringify(identities.get(capability))),
            { id, probeId, profile: "cancellation" },
          );
          if (scenario === "cleanup-failed" || scenario === "compound-cleanup")
            return {
              confirmed: false,
              reason: "docker_container_cleanup_failed",
            };
          absenceRef = {};
          absences.set(absenceRef, {
            hostRecoveryId: host,
            probeId,
            containerId: scenario === "wrong-absence-id" ? "b".repeat(64) : id,
            rootName: path.basename(path.dirname(mounts.management)),
            cli,
          });
          return { confirmed: true, absenceCapability: absenceRef };
        },
        transitionHostRecoveryState: (
          host: string,
          from: string,
          to: string,
          capability: object,
          root: string,
        ) => {
          calls.push("absence");
          assert.equal(host, "host-submitted");
          assert.equal(from, "docker_submission_started");
          assert.equal(to, "docker_absent_confirmed");
          assert.equal(capability, mountCapability);
          assert.equal(root, path.dirname(mounts.management));
          return "host-confirmed";
        },
        recoverOwnedOperationDirectories: (host: string) => {
          calls.push("host-cleanup");
          assert.equal(host, "host-confirmed");
          return {
            status: scenario === "host-missing" ? "blocked" : "recovered",
            reason: "host_operation_cleanup_failed",
          };
        },
        createDockerProbeContainer: (binding: unknown) => {
          bindings.push(binding);
          calls.push("create");
          return { status: "confirmed", id };
        },
      },
    ) as (owned: object) => Promise<{
      status: string;
      reason: string;
      recoveryId: string | null;
      cleanup: string;
      graceElapsedMs: number | null;
      attachProcessTerminationObserved: boolean;
      runtimeAuthorityIssued: boolean;
      operationCapabilityIssued: boolean;
      realProviderReadiness: boolean;
      cancellationAcknowledged: boolean;
      processTerminationObserved: boolean;
    }>;
    const result = await run({});
    assert.equal(factoryCalls, 1);
    for (const binding of bindings) assert.equal(binding, cli);
    assert.deepEqual(calls.slice(0, 5), [
      "engine",
      "begin",
      "save-null",
      "create",
      "save-id",
    ]);
    assert.equal(
      result.status,
      scenario === "success" ? "verified" : "blocked",
      scenario,
    );
    assert.equal(captured.length, scenario === "save-id-failed" ? 0 : 1);
    if (captured.length)
      assert.deepEqual(captured, [
        {
          identity: { id, probeId },
          mounts: {
            workspace: mounts.workspace,
            providerHome: mounts.providerHome,
            tmp: mounts.tmp,
          },
          cli: "fixed-cli",
          environment,
        },
      ]);
    if (scenario === "success") {
      assert.deepEqual(calls, [
        "engine",
        "begin",
        "save-null",
        "create",
        "save-id",
        "run",
        "cleanup",
        "absence",
        "host-cleanup",
      ]);
      assert.equal(
        result.reason,
        "dynamic_fake_provider_cancellation_verified",
      );
      assert.equal(result.graceElapsedMs, 11);
      assert.equal(result.recoveryId, null);
    }
    if (scenario === "post-missing") {
      assert.equal(result.status, "blocked");
      assert.equal(result.runtimeAuthorityIssued, false);
      assert.equal(result.operationCapabilityIssued, false);
      assert.equal(result.realProviderReadiness, false);
      assert.equal(result.cancellationAcknowledged, true);
      assert.equal(result.processTerminationObserved, true);
      assert.equal(result.attachProcessTerminationObserved, true);
    }
    if (scenario === "attach-missing")
      assert.equal(
        result.reason,
        "dynamic_fake_provider_attach_process_termination_unconfirmed",
      );
    if (scenario === "cleanup-failed") {
      assert.equal(result.reason, "docker_container_cleanup_failed");
      assert.equal(result.recoveryId, "after-id");
    }
    if (scenario === "wrong-absence-id") {
      assert.equal(result.reason, "docker_probe_cleanup_failed");
      assert.equal(calls.includes("host-cleanup"), false);
    }
    if (scenario === "run-throw") {
      assert.equal(result.reason, "owned_operation_mount_replaced");
      assert.equal(result.attachProcessTerminationObserved, false);
    }
    if (compound) {
      const cleanupFailed = scenario === "compound-cleanup";
      assert.deepEqual(JSON.parse(JSON.stringify(result)), {
        status: "blocked",
        reason: cleanupFailed
          ? "docker_container_cleanup_failed"
          : "dynamic_fake_provider_attach_process_termination_unconfirmed",
        cancellationRequested: true,
        cancellationSignalRequested: "SIGTERM",
        readyObserved: false,
        cancellationAcknowledged: false,
        processTerminationObserved: false,
        attachProcessTerminationObserved: false,
        attachProcessTerminationRequestCount: 1,
        containerAbsenceVerified: !cleanupFailed,
        hostCleanupVerified: !cleanupFailed,
        graceElapsedMs: 30,
        stdoutBytes: 0,
        stderrBytes: 0,
        exitCode: null,
        signal: null,
        retainOperationDirectories: cleanupFailed,
        recoveryId: cleanupFailed ? "after-id" : null,
        manualRecoveryRequired: cleanupFailed,
        cleanup: cleanupFailed ? "unconfirmed" : "confirmed",
        diagnosticDockerContainerEffectIssued: true,
        diagnosticFilesystemEffectIssued: true,
        providerNetworkEffectIssued: false,
        runtimeAuthorityIssued: false,
        operationCapabilityIssued: false,
        realProviderReadiness: false,
      });
      assert.equal(calls.includes("cleanup"), true);
    }
    if (absenceRef)
      assert.equal(absences.has(absenceRef), scenario === "wrong-absence-id");
  };
  for (const scenario of scenarios) await verify(scenario);
  const needle = "reason: facts.reason,";
  assert.equal(helpers.split(needle).length, 2);
  await assert.rejects(
    () =>
      verify(
        "compound",
        helpers.replace(
          needle,
          "reason: facts.primaryFailure ?? facts.reason,",
        ),
      ),
    { code: "ERR_ASSERTION" },
  );
});

/**
 * 稼働残存の実Callerを二保存からreadyまで接続する。
 * @responsibility 正常到達と別合法対象変異の検出を同じ外側Oracleへ閉じる。
 * @trace ERB-IT-004
 * @precondition 実残存作成本文・失敗分類・私有Identity Mapを使用する。
 * @stimulus 正常、保存失敗、開始失敗、呼出し内だけの別ID／Path。
 * @observation 全要求順、下位入力と公開ready／blocked。
 * @oracle 保存失敗ならstart0、正常は同ID・三Path・Bindingで一回開始し回収0。
 * @cleanup N/A: 実Docker・Fileを作らない。
 * @boundary 上位残存作成→DI技術群代役。
 */
test("稼働残存の上位Callerは二保存後の同対象を下位へ渡してreadyを返す", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/isolation-probe.ts", import.meta.url),
    "utf8",
  );
  const helpers = [
    "isObject",
    "ownValue",
    "ownString",
    "errorMessage",
    "normalizeFailure",
  ]
    .map((name) => cancellationProjectionFunction(source, name))
    .join("\n");
  const body = cancellationProjectionFunction(
    source,
    "createDynamicFakeProviderRecoverableResidue",
  );
  const id = "a".repeat(64),
    probeId = "residue-123";
  const mounts = {
    workspace: path.resolve("fixture/workspace"),
    providerHome: path.resolve("fixture/home"),
    tmp: path.resolve("fixture/tmp"),
    management: path.resolve("fixture/management"),
  };
  const cli = {},
    mountCapability = {},
    environment = { FIXED: "fixture" };
  /**
   * 一つの保存・開始状態を本番Callerで確認する。
   * @responsibility 搬送assertは本番catchの外へ置く。
   * @trace ERB-IT-004
   * @precondition 実本文または一意な変異だけを実行する。
   * @stimulus 正常／保存・開始失敗。
   * @observation 全要求列と対象・環境。
   * @oracle 固定期待に一致する場合だけ通す。
   * @cleanup N/A: VMメモリだけ。
   * @boundary 上位Callerと外側Oracle。
   */
  const verify = (scenario: string, actualBody = body) => {
    const calls: string[] = [],
      captured: object[] = [];
    const identities = new WeakMap<object, object>();
    const registrations: object[] = [];
    const register = identities.set.bind(identities);
    identities.set = (key, value) => {
      registrations.push(JSON.parse(JSON.stringify(value)));
      return register(key, value);
    };
    const bindings: unknown[] = [];
    let factoryCalls = 0;
    const run = runInNewContext(
      `(()=>{${helpers};${actualBody};return createDynamicFakeProviderRecoverableResidue;})()`,
      {
        Object,
        Error,
        Set,
        path,
        randomUUID: () => probeId,
        containerIdentities: identities,
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
        verifyOwnedMountCapability: (actual: unknown) => {
          assert.equal(actual, mountCapability);
          return mounts;
        },
        observeDockerProbeEngine: (binding: unknown) => {
          bindings.push(binding);
          calls.push("engine");
          return true;
        },
        beginDockerSubmission: () => {
          calls.push("begin");
          return "host-submitted";
        },
        writeDockerProbeRecoveryRecord: (
          _mounts: unknown,
          actualProbe: string,
          _nonce: string,
          host: string,
          actualId: string | null,
        ) => {
          assert.equal(actualProbe, probeId);
          assert.equal(host, "host-submitted");
          calls.push(actualId === null ? "save-null" : "save-id");
          if (
            (actualId === null && scenario === "save-null") ||
            (actualId !== null && scenario === "save-id")
          )
            throw new Error("fixture");
          if (actualId !== null) assert.equal(actualId, id);
          return actualId === null ? "before-id" : "after-id";
        },
        createDockerProbeContainer: (binding: unknown) => {
          bindings.push(binding);
          calls.push("create");
          return { status: "confirmed", id };
        },
        startDockerProbeResidue: (
          binding: { verifyCli: () => string; environment: () => object },
          identity: object,
          read: () => object,
        ) => {
          bindings.push(binding);
          calls.push("start");
          captured.push({
            identity: JSON.parse(JSON.stringify(identity)),
            mounts: JSON.parse(JSON.stringify(read())),
            cli: binding.verifyCli(),
            environment: binding.environment(),
          });
          if (scenario === "start-failed")
            throw new Error("dynamic_fake_provider_recoverable_start_failed");
          return { runningConfirmed: true };
        },
        cleanupOwnedOperationDirectories: () => {
          calls.push("cleanup");
        },
      },
    ) as (owned: object) => {
      status: string;
      reason: string;
      recoveryId: string | null;
      containerRunning: boolean;
    };
    const result = run({});
    assert.equal(factoryCalls, 1);
    for (const binding of bindings) assert.equal(binding, cli);
    assert.deepEqual(
      registrations,
      scenario === "save-null"
        ? []
        : [{ id, probeId, profile: "cancellation" }],
    );
    const expected =
      scenario === "save-null"
        ? ["engine", "begin", "save-null"]
        : scenario === "save-id"
          ? ["engine", "begin", "save-null", "create", "save-id"]
          : ["engine", "begin", "save-null", "create", "save-id", "start"];
    assert.deepEqual(calls, expected);
    assert.equal(result.status, scenario === "normal" ? "ready" : "blocked");
    if (scenario === "normal" || scenario === "start-failed")
      assert.deepEqual(captured, [
        {
          identity: { id, probeId },
          mounts: {
            workspace: mounts.workspace,
            providerHome: mounts.providerHome,
            tmp: mounts.tmp,
          },
          cli: "fixed-cli",
          environment,
        },
      ]);
    if (scenario === "normal") {
      assert.equal(result.containerRunning, true);
      assert.equal(result.recoveryId, "after-id");
      assert.equal(
        result.reason,
        "dynamic_fake_provider_recoverable_residue_ready",
      );
    } else {
      assert.equal(result.containerRunning, false);
      assert.equal(
        result.reason,
        "dynamic_fake_provider_recoverable_residue_failed",
      );
    }
  };
  for (const scenario of ["normal", "save-null", "save-id", "start-failed"])
    verify(scenario);
  for (const [needle, replacement] of [
    ["{ id: identity.id, probeId },", `{ id: "${"b".repeat(64)}", probeId },`],
    ["tmp: current.tmp,", 'tmp: path.resolve("other/tmp"),'],
  ]) {
    assert.ok(needle && replacement);
    assert.equal(body.split(needle).length, 2);
    assert.throws(() => verify("normal", body.replace(needle, replacement)), {
      code: "ERR_ASSERTION",
    });
  }
});
