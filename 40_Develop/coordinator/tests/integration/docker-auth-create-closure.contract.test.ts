/**
 * 手動認証create実証の親統括とProducer通知・保存相関を検査する。
 * @packageDocumentation
 * @responsibility 親の入口・再起動・発見・削除前読戻し・回収・二回不存在・Root清掃の論理接続を反証する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @level IT
 * @scope 統括本文の単独故障・変異、標準bridgeの構成・段階比較、値相関・実入口拒否と清掃前実体。
 * @boundary 合成統括は実codec／Owner／Native／Docker／再起動を証明しない。実Filesystem処置は自己生成試験Rootだけ。
 */
import type {
  CoordinatorStateSnapshot,
  CoordinatorStateTaskOperation,
} from "../../../domain-model/src/index.ts";
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { createDockerRestartMachineForVerification } from "../../../docker-isolation/src/docker-desktop/restart-state.ts";
import { classifyDockerEngineResult } from "../../../docker-isolation/src/docker-desktop/engine.ts";
import { fileURLToPath } from "node:url";

import {
  captureAuthCreateCleanupTree,
  projectAuthCreateDefaultBridge,
  selectAuthCreateTarget,
  verifyAuthCreateProducer,
} from "../fixtures/docker-auth-create-closure-verifier.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import { simulateAuthCreateClosure } from "../fixtures/docker-auth-create-closure-simulation.ts";

/**
 * 手動試験器の起動診断搬送を確認する。
 * @responsibility stop診断との入替えや欠落を拒否する。
 * @trace ERB-IT-014
 * @precondition 実統括本文と合成境界だけを使う。
 * @stimulus 起動前拒否を返す。
 * @observation 公開diagnosticと要求数。
 * @oracle startFailureだけを搬送し、自動再試行と削除を行わない。
 * @cleanup VM内の代役だけを復元する。
 * @boundary 手動統括から固定診断への搬送。
 */
test("認証create試験器は起動診断を停止診断と分離する", async () => {
  const result = await simulateAuthCreateClosure("restart_start_blocked");
  assert.equal(result.hits, 1);
  assert.equal(result.restartCalls, 1);
  assert.equal(result.rawRm, 0);
  const report = result.reports[0];
  assert.ok(report);
  const diagnostic = report.diagnostic as Record<string, unknown>;
  assert.equal(report.status, "blocked");
  assert.equal(report.automaticRetryIssued, false);
  assert.equal(diagnostic.restartStopFailure, null);
  assert.equal(diagnostic.restartStartFailure, "client_processes_unconfirmed");
});

/**
 * 標準bridgeの実ID・既知構成・未使用を共同確認する。
 * @responsibility 名前だけの例外や欠測・未知shapeを非対象資源の保全根拠にしない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition JSON相当の値だけを使い実Dockerへ接続しない。
 * @stimulus 正規構成、一覧との相関差、各固定条件・型・欠測・未知fieldを変える。
 * @observation 投影全fieldと拒否例外。
 * @oracle Id／Createdだけを除外し、その他の全fieldを比較材料へ保持する。
 * @cleanup N/A: 値だけを構築する。
 * @boundary 手動試験の純粋投影。実Networkの現在状態や所有権は証明しない。
 */
test("認証createの標準bridge投影は実ID相関と全構成を要求する", () => {
  const id = "3".repeat(64);
  const bridge: Record<string, unknown> = {
    Name: "bridge",
    Id: id,
    Created: "2026-10-17T00:00:00Z",
    Scope: "local",
    Driver: "bridge",
    EnableIPv4: true,
    EnableIPv6: false,
    IPAM: {
      Driver: "default",
      Options: null,
      Config: [{ Subnet: "172.17.0.0/16", Gateway: "172.17.0.1" }],
    },
    Internal: false,
    Attachable: false,
    Ingress: false,
    ConfigOnly: false,
    ConfigFrom: { Network: "" },
    Options: { "com.docker.network.bridge.default_bridge": "true" },
    Labels: {},
    Containers: {},
    Status: {},
  };
  const projected = projectAuthCreateDefaultBridge([{ id, value: bridge }]);
  assert.equal(projected.id, id);
  assert.deepEqual(
    Object.keys(projected.configuration).sort(),
    Object.keys(bridge)
      .filter((key) => key !== "Id" && key !== "Created")
      .sort(),
  );
  const recreated = {
    ...bridge,
    Id: "5".repeat(64),
    Created: "2026-10-17T01:00:00Z",
  };
  assert.deepEqual(
    projectAuthCreateDefaultBridge([{ id: recreated.Id, value: recreated }])
      .configuration,
    projected.configuration,
  );
  assert.throws(() => projectAuthCreateDefaultBridge([]));
  assert.throws(() =>
    projectAuthCreateDefaultBridge([
      { id, value: bridge },
      { id, value: bridge },
    ]),
  );
  assert.throws(() =>
    projectAuthCreateDefaultBridge([{ id: "6".repeat(64), value: bridge }]),
  );
  assert.throws(() =>
    projectAuthCreateDefaultBridge([
      { id, value: bridge },
      { id: "6".repeat(64), value: { ...bridge, Id: "6".repeat(64) } },
    ]),
  );
  for (const [key, value] of [
    ["Name", "custom"],
    ["Driver", "other"],
    ["Scope", "swarm"],
    ["Created", "invalid"],
    ["EnableIPv4", null],
    ["EnableIPv6", "false"],
    ["Internal", true],
    ["Attachable", true],
    ["Ingress", true],
    ["ConfigOnly", true],
    ["ConfigFrom", {}],
    ["Options", {}],
    ["Options", { "com.docker.network.bridge.default_bridge": "false" }],
    [
      "Options",
      { "com.docker.network.bridge.default_bridge": "true", invalid: 1 },
    ],
    ["Labels", { invalid: 1 }],
    ["Containers", { occupied: {} }],
    ["IPAM", { Driver: "default", Options: null, Config: [] }],
    ["Status", []],
    ["Unknown", true],
  ] as const) {
    const candidate = { ...structuredClone(bridge), [key]: value };
    assert.throws(
      () => projectAuthCreateDefaultBridge([{ id, value: candidate }]),
      key,
    );
  }
  for (const key of Object.keys(bridge)) {
    const candidate = structuredClone(bridge);
    delete candidate[key];
    assert.throws(
      () => projectAuthCreateDefaultBridge([{ id, value: candidate }]),
      key,
    );
  }
});

/**
 * 標準bridgeのID例外を固定Producer成立後と再起動完了後の各一地点へ限定する。
 * @responsibility Producer前・後続処理・独自Networkの変化を許容しない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実統括本文と固定CLI代役を使う。
 * @stimulus 同構成ID差、段階外ID差、構成差、独自Network差と比較省略の変異。
 * @observation 実ID指定inspect数、再起動／回収到達、完了表示。
 * @oracle 固定Producer成立後と正規再起動後の同構成だけ成功し、各枠は一回に限定する。
 * @cleanup 実本文finallyで代役を解除する。実資源は取得しない。
 * @boundary 合成境界であり実Docker試験の合格へ流用しない。
 */
test("認証createのbridge ID差はProducer成立後と再起動完了後だけ受理する", async () => {
  for (const fault of [
    "normal",
    "bridge_restart",
    "bridge_after_producer_change",
    "bridge_producer_then_restart",
  ]) {
    const result = await simulateAuthCreateClosure(fault);
    assert.equal(result.reports[0]?.status, "completed");
    assert.equal(result.networkInspectCalls, 10);
    assert.equal(result.restartCalls, 1);
    assert.equal(result.rootPresent, false);
  }
  for (const [fault, stage, restarts] of [
    ["bridge_before_restart_change", "producer", 0],
    ["bridge_producer_config_change", "restart", 0],
    ["custom_network_producer_change", "restart", 0],
    ["bridge_config_change", "recover", 1],
    ["bridge_post_restart_change", "absence", 1],
    ["custom_network_change", "recover", 1],
    ["bridge_inspect_failure", "prepare", 0],
  ] as const) {
    const result = await simulateAuthCreateClosure(fault);
    assert.equal(result.reports[0]?.status, "blocked", fault);
    assert.equal(result.reports[0]?.stage, stage, fault);
    assert.equal(result.restartCalls, restarts, fault);
    assert.equal(result.rootPresent, true, fault);
    assert.ok(result.hits > 0, fault);
  }
  const early = await simulateAuthCreateClosure(
    "normal",
    "early_bridge_acceptance",
  );
  assert.equal(early.reports[0]?.status, "blocked");
  assert.equal(early.restartCalls, 0);
  for (const mutation of [
    "repeat_producer_bridge_acceptance",
    "repeat_restart_bridge_acceptance",
    "early_producer_bridge_acceptance",
  ]) {
    const repeated = await simulateAuthCreateClosure("normal", mutation);
    assert.equal(repeated.reports[0]?.status, "blocked", mutation);
  }
  const changedAfterCapture = await simulateAuthCreateClosure(
    "bridge_after_producer_recapture_change",
    "probe_producer_bridge_stability",
  );
  assert.equal(changedAfterCapture.reports[0]?.status, "blocked");
  assert.equal(changedAfterCapture.restartCalls, 0);
  assert.ok(changedAfterCapture.hits > 0);
  for (const [fault, mutation] of [
    ["bridge_before_restart_change", "omit_bridge_identity_guard"],
    ["bridge_config_change", "omit_bridge_configuration_guard"],
    ["custom_network_change", "exclude_all_networks"],
  ] as const) {
    const result = await simulateAuthCreateClosure(fault, mutation);
    assert.throws(
      () => assert.equal(result.reports[0]?.status, "blocked"),
      mutation,
    );
  }
});

/**
 * 手動監視spyを本番の稼働Container読取りへ接続する。
 * @responsibility 正規の無config観測を試験自身で拒否せず、未知要求も許可しない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実spy・実query本文とMachineを使い、CLI／Sessionだけを代役化する。
 * @stimulus 正規一覧、非空・例外、未知argv、旧spyと広い許可の変異。
 * @observation 原spawnへの要求、options同一性、query結果と模擬停止到達。
 * @oracle 正規だけ一回透過し、旧spyはfalse／処置0、未知要求は委譲0。
 * @cleanup MachineのSessionを解放する。実Process／Dockerは起動しない。
 * @boundary 手動spy→実query→再起動Machineの論理接続。
 */
test("認証create親のspyは実停止判定の固定読取りを透過する", async () => {
  const verifier = fs.readFileSync(
    new URL(
      "../fixtures/docker-auth-create-closure-verifier.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const begin = verifier.indexOf("cp.spawnSync = ((...args: unknown[]) => {");
  const finish = verifier.indexOf(") as typeof cp.spawnSync;", begin);
  assert.ok(begin > 0 && finish > begin);
  const spySource = stripTypeScriptTypes(
    verifier.slice(begin, finish + ") as typeof cp.spawnSync;".length),
  );
  const branchStart = spySource.indexOf('if (argv[2] === "container")');
  const branchEnd = spySource.indexOf(
    "assert.deepEqual(argv.slice(0, 3)",
    branchStart,
  );
  assert.ok(branchStart > 0 && branchEnd > branchStart);
  const machineSource = fs.readFileSync(
    new URL(
      "../../../docker-isolation/src/docker-desktop/restart-state.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const queryStart = machineSource.indexOf("function queryContainersAbsent()");
  const queryEnd = machineSource.indexOf("\n/**", queryStart);
  assert.ok(queryStart > 0 && queryEnd > queryStart);
  const querySource = stripTypeScriptTypes(
    machineSource.slice(queryStart, queryEnd),
  );
  const endpoint = "npipe:////./pipe/dockerDesktopLinuxEngine";
  const executable = "trusted-fixture-docker";
  const fixed = [
    "--host",
    endpoint,
    "container",
    "ls",
    "--quiet",
    "--no-trunc",
  ];
  for (const variant of [
    "original",
    "old_spy",
    "broad_spy",
    "options_replaced",
  ]) {
    const body =
      variant === "original" || variant === "options_replaced"
        ? variant === "options_replaced"
          ? spySource.replace(
              "Reflect.apply(originalSpawnSync, cp, args)",
              "Reflect.apply(originalSpawnSync, cp, [args[0], args[1], {}])",
            )
          : spySource
        : spySource.slice(0, branchStart) +
          (variant === "broad_spy"
            ? 'if (argv[2] === "container") return Reflect.apply(originalSpawnSync, cp, args);\n'
            : "") +
          spySource.slice(branchEnd);
    for (const reply of ["empty", "nonempty", "throw"]) {
      let delegated = 0,
        queryCalls = 0,
        stopCalls = 0;
      const cp: Record<string, unknown> = {};
      const trust = { executablePath: executable };
      let receivedOptions: unknown;
      let optionsFailures = 0;
      const environment = {};
      const originalSpawnSync = (
        _exe: unknown,
        _argv: unknown,
        options: unknown,
      ) => {
        delegated++;
        try {
          assert.equal(options, receivedOptions);
          const actual = options as Record<string, unknown>;
          assert.equal(actual.env, environment);
          assert.equal(actual.shell, false);
          assert.equal(actual.windowsHide, true);
          assert.equal(actual.timeout, 5_000);
          assert.equal(actual.maxBuffer, 16_384);
          assert.equal(actual.encoding, "utf8");
        } catch (error) {
          optionsFailures++;
          throw error;
        }
        if (reply === "throw") throw new Error("read_failed");
        return {
          status: 0,
          signal: null,
          stdout: reply === "empty" ? "" : "running\n",
          stderr: "",
        };
      };
      const { spy, query } = runInNewContext(
        `(()=>{${body};const spawnSync=(...args)=>{captureOptions(args[2]);return cp.spawnSync(...args);};${querySource};return {spy:cp.spawnSync,query:queryContainersAbsent};})()`,
        {
          assert,
          cp,
          trust,
          endpoint,
          Reflect,
          originalSpawnSync,
          observeTrustedDockerCli: () => trust,
          createDockerCliEnvironment: () => environment,
          captureOptions: (options: unknown) => {
            receivedOptions = options;
          },
          verifyTrustedDockerCliSnapshot: () => executable,
        },
      ) as { spy: (...args: unknown[]) => unknown; query: () => boolean };
      const machine = createDockerRestartMachineForVerification({
        session: {
          assertLive: () => true,
          verifyArtifacts: async () => "verified",
          inspectClientProcesses: async () => "absent",
          inspectProcesses: async () => "verified",
          stopDesktop: async () => {
            stopCalls++;
            return "not_issued";
          },
          terminateProcesses: async () => "terminated",
          launchDesktop: async () => "started",
          release: async () => ({
            cleanup: "confirmed",
            protocol: "completed",
          }),
          abort: async () => ({
            cleanup: "confirmed",
            protocol: "not_applicable",
          }),
          failureDetected: new Promise<void>(() => {}),
          onFailureDetected: () => () => {},
        },
        observeBackend: () => "running",
        observeEngine: () => "ready",
        containersAbsent: () => {
          queryCalls++;
          return query();
        },
        now: Date.now,
        wait: async () => {},
      });
      assert.equal(await machine.stop(), "unknown");
      assert.equal(queryCalls, 1);
      assert.equal(delegated, variant === "old_spy" ? 0 : 1);
      assert.equal(optionsFailures, variant === "options_replaced" ? 1 : 0);
      assert.equal(
        stopCalls,
        variant !== "old_spy" &&
          variant !== "options_replaced" &&
          reply === "empty"
          ? 1
          : 0,
      );
      await machine.release();
      for (const invalid of [
        fixed.slice(0, -1),
        [...fixed, "--all"],
        ["--host", "other", ...fixed.slice(2)],
      ]) {
        const before: number = delegated;
        receivedOptions = {
          env: environment,
          shell: false,
          windowsHide: true,
          timeout: 5_000,
          maxBuffer: 16_384,
          encoding: "utf8",
        };
        if (variant === "broad_spy" && reply !== "throw") {
          spy(executable, invalid, receivedOptions);
          assert.throws(() => assert.equal(delegated, before));
        } else {
          assert.throws(() => spy(executable, invalid, receivedOptions));
          assert.equal(
            delegated,
            variant === "broad_spy" ? before + 1 : before,
          );
        }
      }
    }
  }
});

/**
 * Engine観測と一覧観測を同じ試験監視・停止Machineへ接続する。
 * @responsibility 停止前の正規読取りを試験監視で拒否する自己干渉を検出する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実spy・Engine観測本文・classifier・一覧本文・Machineを使用する。
 * @stimulus 正常、壊れたJSON、CLI例外、非0、Native不在、許可省略・広域許可・options差替え。
 * @observation 要求数、options参照、模擬停止到達、Machine結果。
 * @oracle 正規二要求だけを透過し、観測不明と矛盾した現在状態は停止要求0。
 * @cleanup Sessionを解放する。実Process・Dockerは使用しない。
 * @boundary CLI・pipe・Native・WSLは代役であり実再起動の証明ではない。
 */
test("認証create親はEngineと一覧の実読取りを同じ停止境界へ搬送する", async () => {
  const verifier = fs.readFileSync(
    new URL(
      "../fixtures/docker-auth-create-closure-verifier.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const start = verifier.indexOf("cp.spawnSync = ((...args: unknown[]) => {");
  const end = verifier.indexOf(") as typeof cp.spawnSync;", start);
  assert.ok(start > 0 && end > start);
  const source = stripTypeScriptTypes(
    verifier.slice(start, end + ") as typeof cp.spawnSync;".length),
  );
  const engineText = fs.readFileSync(
    new URL(
      "../../../docker-isolation/src/docker-desktop/engine.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const engineStart = engineText.indexOf(
    "export function observeDockerRuntimeEngine()",
  );
  const engineEnd = engineText.indexOf("\n/**", engineStart);
  assert.ok(engineStart > 0 && engineEnd > engineStart);
  const engineSource = stripTypeScriptTypes(
    engineText.slice(engineStart, engineEnd),
  ).replace("export function", "function");
  const machineText = fs.readFileSync(
    new URL(
      "../../../docker-isolation/src/docker-desktop/restart-state.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const queryStart = machineText.indexOf("function queryContainersAbsent()");
  const queryEnd = machineText.indexOf("\n/**", queryStart);
  assert.ok(queryStart > 0 && queryEnd > queryStart);
  const querySource = stripTypeScriptTypes(
    machineText.slice(queryStart, queryEnd),
  );
  const endpoint = "npipe:////./pipe/dockerDesktopLinuxEngine";
  const executable = "trusted-fixture-docker";
  const versionStart = source.indexOf('if (argv[2] === "version")');
  const versionEnd = source.indexOf(
    "assert.deepEqual(argv.slice(0, 3)",
    versionStart,
  );
  assert.ok(versionStart > 0 && versionEnd > versionStart);
  for (const variant of [
    "original",
    "omit_version",
    "broad_version",
    "replace_options",
  ]) {
    const body =
      variant === "omit_version"
        ? source.slice(0, versionStart) + source.slice(versionEnd)
        : variant === "broad_version"
          ? source.slice(0, versionStart) +
            'if(argv[2]==="version") return Reflect.apply(originalSpawnSync,cp,args);\n' +
            source.slice(versionEnd)
          : variant === "replace_options"
            ? source.replaceAll(
                "Reflect.apply(originalSpawnSync, cp, args)",
                "Reflect.apply(originalSpawnSync, cp, [args[0],args[1],{}])",
              )
            : source;
    for (const response of [
      "ready",
      "invalid_json",
      "throw",
      "nonzero",
      "native_absent",
    ]) {
      let versionCalls = 0,
        listCalls = 0,
        stops = 0,
        optionsFailures = 0;
      let receivedOptions: unknown;
      const env = {};
      const cp: Record<string, unknown> = {};
      const originalSpawnSync = (
        _exe: unknown,
        argv: string[],
        options: unknown,
      ) => {
        if (argv[2] === "version") versionCalls++;
        else listCalls++;
        try {
          assert.equal(options, receivedOptions);
          const actual = options as Record<string, unknown>;
          assert.equal(actual.env, env);
          for (const [key, value] of Object.entries({
            shell: false,
            windowsHide: true,
            timeout: 5_000,
            maxBuffer: 16_384,
            encoding: "utf8",
          }))
            assert.equal(actual[key], value);
        } catch (error) {
          optionsFailures++;
          throw error;
        }
        if (argv[2] !== "version")
          return { status: 0, signal: null, stdout: "", stderr: "" };
        if (response === "throw") throw new Error("fixture_cli_failure");
        return {
          pid: 123,
          status: response === "nonzero" || stops > 0 ? 1 : 0,
          signal: null,
          stdout:
            response === "nonzero"
              ? "invalid_failure_output"
              : stops > 0
                ? ""
                : response === "invalid_json"
                  ? "{"
                  : JSON.stringify({
                      Os: "linux",
                      Version: "29.8.1",
                      ApiVersion: "1.50",
                      Arch: "amd64",
                    }),
          stderr: "",
        };
      };
      const runtime = runInNewContext(
        `(()=>{${body};const spawnSync=(...args)=>{captureOptions(args[2]);return cp.spawnSync(...args);};${engineSource};${querySource};return {engine:observeDockerRuntimeEngine,query:queryContainersAbsent,spy:cp.spawnSync};})()`,
        {
          assert,
          cp,
          endpoint,
          Reflect,
          originalSpawnSync,
          trust: { executablePath: executable },
          process: { platform: "win32" },
          observeTrustedDockerCli: () => ({ executablePath: executable }),
          createDockerCliEnvironment: () => env,
          verifyTrustedDockerCliSnapshot: () => executable,
          captureOptions: (options: unknown) => {
            receivedOptions = options;
          },
          classifyDockerEngineResult,
          observeDockerEnginePipe: () => ({
            state: "absent",
            cleanup: "confirmed",
          }),
        },
      ) as {
        engine: () => ReturnType<typeof classifyDockerEngineResult>;
        query: () => boolean;
        spy: (...args: unknown[]) => unknown;
      };
      const machine = createDockerRestartMachineForVerification({
        session: {
          assertLive: () => true,
          verifyArtifacts: async () => "verified",
          inspectClientProcesses: async () => "absent",
          inspectProcesses: async () =>
            response === "native_absent" || stops > 0 ? "absent" : "verified",
          stopDesktop: async () => {
            stops++;
            return "command_completed";
          },
          terminateProcesses: async () => "terminated",
          launchDesktop: async () => "started",
          release: async () => ({
            cleanup: "confirmed",
            protocol: "completed",
          }),
          abort: async () => ({
            cleanup: "confirmed",
            protocol: "not_applicable",
          }),
          failureDetected: new Promise<void>(() => {}),
          onFailureDetected: () => () => {},
        },
        observeBackend: () =>
          response === "native_absent" || stops > 0 ? "stopped" : "running",
        observeEngine: runtime.engine,
        containersAbsent: runtime.query,
        now: Date.now,
        wait: async () => {},
      });
      const result = await machine.stop();
      const accepted =
        (variant === "original" || variant === "broad_version") &&
        response === "ready";
      assert.equal(result, accepted ? "stopped" : "unknown");
      assert.equal(stops, accepted ? 1 : 0);
      assert.equal(optionsFailures, variant === "replace_options" ? 1 : 0);
      assert.equal(
        versionCalls,
        variant === "omit_version"
          ? 0
          : accepted ||
              (response === "native_absent" && variant !== "replace_options")
            ? 2
            : 1,
      );
      assert.equal(
        listCalls,
        accepted ||
          (response === "native_absent" &&
            variant !== "omit_version" &&
            variant !== "replace_options")
          ? 1
          : 0,
      );
      await machine.release();
      const before = versionCalls;
      receivedOptions = {
        env,
        shell: false,
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 16384,
        encoding: "utf8",
      };
      const invalid = [
        "--host",
        endpoint,
        "version",
        "--format",
        "{{json .Server}}",
        "--extra",
      ];
      if (variant === "broad_version" && response !== "throw") {
        runtime.spy(executable, invalid, receivedOptions);
        assert.throws(() => assert.equal(versionCalls, before));
      } else {
        assert.throws(() => runtime.spy(executable, invalid, receivedOptions));
        assert.equal(
          versionCalls,
          variant === "broad_version" ? before + 1 : before,
        );
      }
    }
  }
});

/**
 * 不存在modeの故障点より後の処置を独立counterで拒否する。
 * @responsibility blocked表示だけで準備削除・保存の過剰Effectを見逃さない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 合成統括の一回分の結果と固定faultを受ける。
 * @stimulus 準備前、準備失敗、観測失敗、専用保存失敗を分類する。
 * @observation raw rm、成功、回復、round、保存、Root処置の各counter。
 * @oracle 失敗点に応じた上限と、完了・Root削除0を共同で要求する。
 * @cleanup N/A: 値検査だけ。
 * @boundary 合成統括の停止Oracle。実Dockerは操作しない。
 */
function assertAbsentModeStopped(
  result: Awaited<ReturnType<typeof simulateAuthCreateClosure>>,
  fault: string,
) {
  assert.equal(result.rootDeletes, 0, fault);
  assert.equal(result.reports[0]?.status === "completed", false, fault);
  const rounds = result.events.filter(
    (value) => value === "observe_absent",
  ).length;
  const saves = result.events.filter(
    (value) => value === "closure_save",
  ).length;
  if (
    [
      "no_flag",
      "restart_blocked",
      "positive_configuration",
      "positive_after_restart",
    ].includes(fault)
  ) {
    assert.equal(result.rawRm, 0, fault);
    assert.equal(result.recoveryCalls, 0, fault);
    assert.equal(rounds, 0, fault);
    assert.equal(saves, 0, fault);
  } else {
    assert.equal(result.rawRm, 1, fault);
    assert.equal(result.rawRmSuccess, fault === "rm_failed" ? 0 : 1, fault);
    if (fault === "rm_failed" || fault.startsWith("preparation_state_")) {
      assert.equal(result.recoveryCalls, 0, fault);
      assert.equal(rounds, 0, fault);
      assert.equal(saves, 0, fault);
    } else if (fault.startsWith("round_")) {
      assert.equal(rounds, fault.endsWith("_2") ? 2 : 1, fault);
      assert.equal(saves, 0, fault);
    } else {
      assert.equal(rounds, 2, fault);
      assert.equal(saves, 1, fault);
    }
  }
}

/**
 * 現在不存在modeの準備回収と製品回復を分離する。
 * @responsibility 既知IDの準備削除を製品のunknown回復成功へ偽装しない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 外部境界は新品のVM代役で、実Daemonを使わない。
 * @stimulus 明示追加modeと再起動・構成・準備回収・二round・専用保存の単独故障。
 * @observation 準備rm、製品rm、専用保存と終了の到達を別々に取得する。
 * @oracle 正常時だけ準備rm1・製品rm0・二round・専用保存1、故障時は未完了を保持する。
 * @cleanup VM登録・Listener・名前付きbindingを既存finallyが解放する。
 * @boundary 手動統括の論理接続。実Owner・保存・Dockerの根拠ではない。
 */
test("認証create親の不存在modeは準備回収と製品終了を分離する", async () => {
  for (const kind of [
    "both",
    "added",
    "removed",
    "invalid",
    "sparse",
    "non_array",
    "missing",
    "limit",
    "overflow",
    "expected_invalid",
    "expected_sparse",
    "expected_overflow",
    "iterator",
    "second_iterator",
    "accessor",
    "inherited_descriptor",
  ]) {
    const observed = await simulateAuthCreateClosure(
      `diagnostic_network_${kind}`,
    );
    assert.equal(observed.hits, 1, kind);
    assert.equal(observed.restartCalls, 0, kind);
    assert.equal(observed.rawRm, 0, kind);
    assert.equal(observed.exitCode, 2, kind);
    const report = observed.reports[0];
    assert.ok(report);
    assert.equal(report.status, "blocked", kind);
    assert.equal(report.automaticRetryIssued, false, kind);
    const diagnostic = report.diagnostic as Record<string, unknown>;
    assert.equal(diagnostic.failureClass, "assertion", kind);
    assert.equal(observed.diagnosticIteratorCalls, 0, kind);
    if (kind === "inherited_descriptor")
      assert.equal(observed.inheritedDescriptorHits, 1, kind);
    if (kind === "accessor" || kind === "inherited_descriptor")
      // AssertionErrorの整形と既存baseline比較が各一回。追加診断はgetterを呼ばない。
      assert.equal(observed.diagnosticAccessorCalls, 2, kind);
    if (
      [
        "both",
        "added",
        "removed",
        "limit",
        "iterator",
        "second_iterator",
      ].includes(kind)
    ) {
      assert.deepEqual(diagnostic.baselineDifference, ["networks"], kind);
      assert.deepEqual(
        diagnostic.networkSetDifference,
        {
          addedIds:
            kind === "removed"
              ? []
              : kind === "limit"
                ? Array.from({ length: 128 }, (_, i) =>
                    i.toString(16).padStart(64, "0"),
                  )
                : ["b".repeat(64)],
          removedIds:
            kind === "added" || kind === "limit" ? [] : ["c".repeat(64)],
        },
        kind,
      );
    } else {
      assert.equal(
        Object.hasOwn(diagnostic, "networkSetDifference"),
        false,
        kind,
      );
      if (kind !== "missing" && kind !== "non_array")
        assert.deepEqual(diagnostic.baselineDifference, ["networks"], kind);
    }
    assert.equal(
      JSON.stringify(report).includes("fixture-private-identity"),
      false,
      kind,
    );
  }
  const inherited = await simulateAuthCreateClosure(
    "diagnostic_baseline_inherited",
  );
  assert.equal(inherited.hits, 1);
  assert.equal(inherited.restartCalls, 0);
  assert.equal(inherited.rawRm, 0);
  const inheritedReport = inherited.reports[0];
  assert.ok(inheritedReport);
  assert.equal(
    (inheritedReport.diagnostic as Record<string, unknown>).baselineDifference,
    undefined,
  );
  for (const field of ["containers", "networks", "volumes", "images"]) {
    const diagnosed = await simulateAuthCreateClosure(
      `diagnostic_baseline_${field}`,
    );
    assert.equal(diagnosed.hits, 1);
    assert.equal(diagnosed.restartCalls, 0);
    assert.equal(diagnosed.rawRm, 0);
    const diagnostic = diagnosed.reports[0]?.diagnostic as Record<
      string,
      unknown
    >;
    assert.deepEqual(diagnostic.baselineDifference, [field]);
    assert.equal(
      JSON.stringify(diagnosed.reports).includes("fixture-private-identity"),
      false,
    );
  }
  for (const fault of [
    "normal",
    "no_flag",
    "restart_blocked",
    "positive_configuration",
    "positive_after_restart",
    "rm_failed",
    "round_unknown_1",
    "round_unknown_2",
    "round_throw_1",
    "round_throw_2",
    "closure_save_failed",
    "closure_save_unconfirmed",
    "preparation_state_identity",
    "preparation_state_bytes",
    "round_omitted",
  ]) {
    const result = await simulateAuthCreateClosure(fault, "none", true);
    if (fault === "normal") {
      assert.equal(result.escaped, undefined);
      assert.equal(result.hits, 0);
      assert.equal(result.rootPresent, false);
      const report = result.reports[0];
      assert.equal(report?.status, "completed");
      assert.equal(report?.mode, "absent_auth");
      assert.equal(report?.preparationRmRequests, 1);
      assert.equal(report?.preparationRmSuccesses, 1);
      assert.equal(report?.recoverObservedCalls, 0);
      assert.equal(report?.rmRequests, 0);
      assert.equal(report?.absenceRounds, 2);
      assert.equal(report?.closureSaves, 1);
      assert.equal(
        result.events.filter((value) => value === "closure_save").length,
        1,
      );
    } else {
      assert.equal(result.hits, 1, fault);
      assertAbsentModeStopped(result, fault);
      assert.equal(result.rootDeletes, 0, fault);
      assert.equal(result.reports[0]?.status === "completed", false, fault);
      assert.equal(
        result.reports[0]?.diagnostic &&
          (result.reports[0].diagnostic as Record<string, unknown>).rmRequests,
        fault === "no_flag" ? undefined : 0,
        fault,
      );
      if (
        [
          "no_flag",
          "restart_blocked",
          "positive_configuration",
          "positive_after_restart",
          "rm_failed",
        ].includes(fault)
      )
        assert.equal(result.recoveryCalls, 0, fault);
    }
  }
  for (const [fault, mutation] of [
    ["positive_configuration", "omit_positive_configuration"],
    ["preparation_state_identity", "omit_preparation_preservation"],
    ["preparation_state_bytes", "omit_preparation_preservation"],
    ["closure_save_unconfirmed", "omit_closure_confirmation"],
    ["round_omitted", "omit_round_count"],
  ]) {
    assert.ok(fault && mutation);
    const result = await simulateAuthCreateClosure(fault, mutation, true);
    assert.throws(() => assertAbsentModeStopped(result, fault));
  }
});

/**
 * 親の値照合だけに使う固定相関を構築する。
 * @responsibility 合成値のcodec未検証と、親が判定するfieldを区別する。
 * @trace PRL-IT-013
 * @precondition N/A: 実RootやRuntimeを使用しない。
 * @stimulus packetと対象操作の同一相関を組み立てる。
 * @observation 子終端・資源・Image・Hashの固定値。
 * @oracle 呼出し元が一軸破壊と正常対照を比較する。
 * @cleanup N/A: 全値はメモリだけ。
 * @boundary 親統括の純粋な相関検査。実保存・実Process終端は未検証。
 */
function producerFacts() {
  const image =
    "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
  const bytes = Buffer.from("fixed current state bytes\n");
  const operation = {
    kind: "docker_task",
    recoveryId: "fixture-exact-recovery-id",
    identityJson: JSON.stringify({
      images: { provider: image },
      resources: { auth: "crdd-auth-0123456789abcdef" },
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      workspaceMountMode: null,
    }),
    execution: {
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    },
    resources: [
      {
        purpose: "create_subscription_auth_probe",
        request: "unknown",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      },
      { purpose: "create_provider", request: "not_requested" },
    ],
  } as unknown as CoordinatorStateTaskOperation;
  const snapshot = {
    operations: [operation],
  } as unknown as CoordinatorStateSnapshot;
  const packet = {
    pid: 91,
    recoveryId: operation.recoveryId,
    phase: "auth_create_unknown",
    hostStarts: 1,
    receiptRegistered: false,
    providerStarted: false,
    containerName: "crdd-auth-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    image,
    dockerId: "1".repeat(64),
    createCli: {
      pid: 92,
      status: 0,
      signal: null,
      stdoutBytes: 65,
      stderrBytes: 0,
    },
    stateSha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const child: SpawnSyncReturns<string> = {
    pid: 91,
    status: 1,
    signal: null,
    stdout: JSON.stringify(packet),
    stderr: "",
    output: ["", JSON.stringify(packet), ""],
  };
  return { snapshot, operation, bytes, packet, child };
}

/**
 * 親の統括実本文が全spyを通って一回だけ完了する。
 * @responsibility 単独成功値で統括を迂回した偽成功を拒否する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 毎回新品の合成境界を使い、実Docker／実保存へ接続しない。
 * @stimulus 実本文の正常経路を明示入口から最終Root不存在まで評価する。
 * @observation module順、処置列、最下位rm、named binding復元、単一完了報告。
 * @oracle restart／発見／回収／rm各一回と、Root削除後だけの完了を要求する。
 * @cleanup 実本文finallyが代役登録・binding・Listenerを解放する。
 * @boundary 統括の論理結合だけ。実Owner／codec／Nativeは既存試験の別根拠。
 */
test("認証create親の実統括本文は全spy経由で一回だけ完了する", async () => {
  const result = await simulateAuthCreateClosure("normal");
  assert.equal(result.escaped, undefined);
  assert.equal(result.hits, 0);
  assert.equal(result.producerCalls, 1);
  assert.equal(result.restartCalls, 1);
  assert.equal(result.recoveryCalls, 1);
  assert.equal(result.rawRm, 1);
  assert.equal(result.rawRmSuccess, 1);
  assert.equal(result.rootDeletes, 1);
  assert.equal(result.rootPresent, false);
  assert.equal(result.baselineReads, 5);
  assert.equal(result.absenceReads, 6);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0]?.status, "completed");
  const expectedReport = {
    contract: "crdd-coordinator/auth-create-closure-verification",
    status: "completed",
    recoveryId: "fixture-exact-id",
    restartCalls: 1,
    recoverObservedCalls: 1,
    rmRequests: 1,
    rmSuccesses: 1,
    absenceSamples: 2,
    verificationCompleted: true,
    rootCleanupConfirmed: true,
    providerRequestIssued: false,
    preexistingPersistentDataDeleted: false,
    genericUnknownClosureVerified: false,
  };
  assert.deepEqual(result.reports[0], expectedReport);
  for (const [field, value] of Object.entries(expectedReport)) {
    const changed = {
      ...expectedReport,
      [field]: typeof value === "boolean" ? !value : "changed",
    };
    assert.throws(() => assert.deepEqual(changed, expectedReport));
  }
  assert.equal(result.manifestCompletions, 2);
  assert.equal(result.networkInspectCalls, 10);
  assert.equal(result.configReads, 45);
  assert.deepEqual(result.boundaryCalls, {
    gitCalls: 2,
    rootVerifications: 2,
    rootResolutions: 46,
    domainEnsures: 1,
    domainRequires: 1,
    trustObservations: 1,
    trustVerifications: 44,
    environmentCreations: 1,
  });
  assert.deepEqual(result.events, [
    "producer",
    "restart",
    "consumer",
    "discover",
    "recover_observed",
    "rm",
    "interval",
    "root_delete",
    "report",
  ]);
});

/**
 * 親の各段階で単独故障を発生させ、後続処置と誤完了を拒否する。
 * @responsibility 故障到達を確認し、手前の別拒否を成功と数えない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 毎scenarioで全代役・signal・登録表・named bindingを新規生成する。
 * @stimulus 入口、baseline各時点、Producer、再起動、発見・保存・rm、不存在各軸と清掃を独立に破る。
 * @observation 到達一回、発行数、同ID、停止stage、未完了報告と保持の可能性。
 * @oracle 証明前IDはnull、証明後同IDを保持し、既発生Effectを巻き戻さず後続を止める。
 * @cleanup 実本文finallyの復元を各scenarioで確認し、実FS／Dockerへ接続しない。
 * @boundary 親の統括論理だけ。実Runtimeの終端保証は共同根拠へ分離する。
 */
test("認証create親の実統括本文は単独故障で後続処置と完了表示を止める", async () => {
  const scenarios = [
    ...["no_flag", "non_windows", "existing_root", "area_alias"].map(
      (fault) => ({
        fault,
        stage: null,
        producer: 0,
        restart: 0,
        recovery: 0,
        rm: 0,
        id: false,
      }),
    ),
    ...[
      "image_missing",
      "initial_cancel",
      "baseline_1",
      "diagnostic_non_error",
      "diagnostic_throwing_error",
      "diagnostic_own_frame",
      "diagnostic_foreign_frame",
      "diagnostic_message_url",
    ].map((fault) => ({
      fault,
      stage: "prepare",
      producer: 0,
      restart: 0,
      recovery: 0,
      rm: 0,
      id: false,
    })),
    {
      fault: "baseline_2",
      stage: "producer",
      producer: 0,
      restart: 0,
      recovery: 0,
      rm: 0,
      id: false,
    },
    {
      fault: "baseline_difference_2",
      stage: "producer",
      producer: 0,
      restart: 0,
      recovery: 0,
      rm: 0,
      id: false,
    },
    ...[
      "producer_timeout",
      "packet_missing",
      "packet_id",
      "reader_unknown",
      "reader_release",
    ].map((fault) => ({
      fault,
      stage: "producer",
      producer: 1,
      restart: 0,
      recovery: 0,
      rm: 0,
      id: !fault.startsWith("reader_"),
    })),
    ...["producer_cancel", "baseline_3", "baseline_difference_3"].map(
      (fault) => ({
        fault,
        stage: "restart",
        producer: 1,
        restart: 0,
        recovery: 0,
        rm: 0,
        id: true,
      }),
    ),
    ...[
      "restart_throw",
      "restart_blocked",
      "restart_save_refused",
      "restart_event_save",
      "restart_readback",
      "restart_notification_missing",
      "restart_checkpoint",
      ...[
        "restartCompleted",
        "cleanupConfirmed",
        "primaryFailure",
        "cleanupFailure",
      ].map((field) => `restart_field_${field}`),
    ].map((fault) => ({
      fault,
      stage: "restart",
      producer: 1,
      restart: 1,
      recovery: 0,
      rm: 0,
      id: true,
    })),
    ...[
      "positive_after_restart",
      "positive_configuration",
      "restart_cancel",
      "baseline_4",
      "baseline_difference_4",
      "recovery_cancel",
    ].map((fault) => ({
      fault,
      stage: "recover",
      producer: 1,
      restart: 1,
      recovery: 0,
      rm: 0,
      id: true,
    })),
    ...[
      "discovery_id",
      "discovery_duplicate",
      "identified_missing",
      "recover_rejected",
      "rm_missing",
      "rm_different_id",
      "rm_failed",
      "rm_duplicate",
      "rm_reader_unknown",
      "rm_reader_release",
    ].map((fault) => ({
      fault,
      stage: "recover",
      producer: 1,
      restart: 1,
      recovery: 1,
      rm: ["rm_failed", "rm_duplicate"].includes(fault) ? 1 : 0,
      id: true,
    })),
    ...[
      "taskRecoveryCompleted",
      "dockerCleanupConfirmed",
      "hostCleanupConfirmed",
      "locksReleased",
      "historyConfirmed",
    ].map((field) => ({
      fault: `recovery_field_${field}`,
      stage: "recover",
      producer: 1,
      restart: 1,
      recovery: 1,
      rm: 1,
      id: true,
    })),
    ...[
      "absence_1",
      "absence_2",
      "absence_3",
      "absence_4",
      "absence_5",
      "absence_6",
      "baseline_5",
      "baseline_difference_5",
      "state_retained",
      "host_retained",
      "final_reader_unknown",
    ].map((fault) => ({
      fault,
      stage: "absence",
      producer: 1,
      restart: 1,
      recovery: 1,
      rm: 1,
      id: true,
    })),
    ...[
      "root_manifest",
      "root_manifest_change",
      "root_identity",
      "root_delete_throw",
      "root_post_delete_unknown",
      "cleanup_cancel",
    ].map((fault) => ({
      fault,
      stage: "root_cleanup",
      producer: 1,
      restart: 1,
      recovery: 1,
      rm: 1,
      id: true,
    })),
  ];
  assert.equal(
    new Set(scenarios.map((value) => value.fault)).size,
    scenarios.length,
  );
  for (const expected of scenarios) {
    const result = await simulateAuthCreateClosure(expected.fault);
    assert.equal(result.hits, 1, expected.fault);
    assert.equal(result.producerCalls, expected.producer, expected.fault);
    assert.equal(result.restartCalls, expected.restart, expected.fault);
    assert.equal(result.recoveryCalls, expected.recovery, expected.fault);
    assert.equal(result.rawRm, expected.rm, expected.fault);
    if (expected.stage === null) {
      assert.ok(result.escaped, expected.fault);
      assert.equal(result.reports.length, 0);
    } else {
      assert.equal(result.escaped, undefined, expected.fault);
      assert.equal(result.exitCode, 2, expected.fault);
      assert.equal(result.reports.length, 1, expected.fault);
      const report = result.reports[0];
      assert.equal(report?.status, "blocked", expected.fault);
      assert.equal(report?.stage, expected.stage, expected.fault);
      assert.equal(
        report?.recoveryId,
        expected.id ? "fixture-exact-id" : null,
        expected.fault,
      );
      assert.equal(report?.rootCleanupConfirmed, false, expected.fault);
      assert.equal(
        report?.verificationCompleted,
        expected.stage === "root_cleanup",
        expected.fault,
      );
      assert.equal("rootRetained" in (report ?? {}), false);
      assert.deepEqual(
        report,
        {
          contract: "crdd-coordinator/auth-create-closure-verification",
          status: "blocked",
          stage: expected.stage,
          recoveryId: expected.id ? "fixture-exact-id" : null,
          verificationCompleted: expected.stage === "root_cleanup",
          rootCleanupConfirmed: false,
          rootMayRemain: true,
          containerMayRemain:
            expected.stage !== "root_cleanup" && expected.stage !== "prepare",
          automaticRetryIssued: false,
          diagnostic: {
            failureClass: [
              "diagnostic_non_error",
              "diagnostic_throwing_error",
            ].includes(expected.fault)
              ? "unknown"
              : [
                    "diagnostic_own_frame",
                    "diagnostic_foreign_frame",
                    "diagnostic_message_url",
                    "packet_missing",
                    "restart_throw",
                    "restart_save_refused",
                    "restart_event_save",
                    "root_delete_throw",
                  ].includes(expected.fault)
                ? "exception"
                : "assertion",
            failureCode:
              expected.fault === "diagnostic_own_frame"
                ? "ERR_INVALID_ARG_VALUE"
                : [
                      "diagnostic_non_error",
                      "diagnostic_throwing_error",
                      "diagnostic_foreign_frame",
                      "diagnostic_message_url",
                      "packet_missing",
                      "restart_throw",
                      "restart_save_refused",
                      "restart_event_save",
                      "root_delete_throw",
                    ].includes(expected.fault)
                  ? null
                  : "ERR_ASSERTION",
            failureLine: expected.fault === "diagnostic_own_frame" ? 991 : null,
            restartStopFailure:
              expected.fault === "restart_blocked"
                ? "engine_unconfirmed"
                : null,
            restartStartFailure: null,
            restartResultClass:
              expected.restart === 0 ||
              [
                "restart_throw",
                "restart_save_refused",
                "restart_event_save",
                "restart_readback",
              ].includes(expected.fault)
                ? "not_observed"
                : expected.fault === "restart_blocked"
                  ? "blocked"
                  : "completed",
            restartCalls: expected.restart,
            recoverObservedCalls:
              expected.recovery === 1 &&
              ![
                "discovery_id",
                "discovery_duplicate",
                "identified_missing",
              ].includes(expected.fault)
                ? 1
                : 0,
            rmRequests: expected.fault === "rm_duplicate" ? 2 : expected.rm,
            rmSuccesses: expected.fault === "rm_failed" ? 0 : expected.rm,
            ...(expected.fault.startsWith("baseline_difference_")
              ? { baselineDifference: ["containers"] }
              : {}),
          },
        },
        expected.fault,
      );
      assert.equal(
        JSON.stringify(report).includes("fixture-secret-not-for-report"),
        false,
      );
      assert.equal(JSON.stringify(report).includes("private/foreign"), false);
      if (expected.fault === "root_manifest_change")
        assert.equal(result.manifestCompletions, 2);
    }
    const attemptedCleanup = [
      "root_delete_throw",
      "root_post_delete_unknown",
    ].includes(expected.fault);
    assert.equal(result.rootDeletes, attemptedCleanup ? 1 : 0, expected.fault);
    assert.equal(
      result.rootPresent,
      expected.fault !== "root_post_delete_unknown" &&
        (expected.stage !== null || expected.fault === "existing_root"),
      expected.fault,
    );
    assert.equal(
      result.reports.some((report) => report.status === "completed"),
      false,
      expected.fault,
    );
  }
});

/**
 * import／named binding／削除前確認の省略を同じ統括Oracleで検出する。
 * @responsibility 代役がspyを迂回した偽成功を正常対照へ昇格しない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 正常Source本文の肯定対照が成立している。
 * @stimulus import先変更・named binding接続省略・二つのidentified確認省略を単独適用する。
 * @observation 完了報告の差、実rm到達と保存前拒否。
 * @oracle 接続省略は正常完了Oracleを破り、確認省略はidentified欠測時の後続0 Oracleを破る。
 * @cleanup 変異はメモリ内本文だけで、Sourceを変更しない。
 * @boundary 統括反証の感度だけ。実Effectの故障注入ではない。
 */
test("認証create親の統括Oracleは接続・削除前確認の省略を検出する", async () => {
  for (const mutation of [
    "detach_named_binding",
    "wrong_lifecycle_import",
    "boundary_root",
    "boundary_capability",
    "boundary_git",
    "boundary_config",
  ]) {
    const changed = await simulateAuthCreateClosure("normal", mutation);
    assert.throws(() => assert.equal(changed.reports[0]?.status, "completed"));
  }
  const changed = await simulateAuthCreateClosure(
    "identified_missing",
    "omit_identified_guards",
  );
  assert.equal(changed.hits, 1);
  assert.equal(changed.rawRm, 1);
  assert.equal(changed.reports[0]?.status, "completed");
  assert.throws(() => assert.equal(changed.rawRm, 0));
  for (let index = 1; index <= 4; index++) {
    const changed = await simulateAuthCreateClosure(
      `baseline_difference_${index + 1}`,
      `omit_baseline_${index}`,
    );
    assert.equal(changed.hits, 1);
    assert.equal(changed.reports[0]?.status, "completed");
    assert.throws(() => assert.equal(changed.reports[0]?.status, "blocked"));
  }
  const manifestChanged = await simulateAuthCreateClosure(
    "root_manifest_change",
    "omit_manifest_comparison",
  );
  assert.equal(manifestChanged.manifestCompletions, 2);
  assert.equal(manifestChanged.reports[0]?.status, "completed");
  assert.throws(() => assert.equal(manifestChanged.rootDeletes, 0));
});

/**
 * Producer通知が現在保存と共同一致する場合だけIDを採用する。
 * @responsibility 単独成功fieldやpacketだけによる先行を拒否する。
 * @trace PRL-IT-013
 * @precondition 合成値の正常対照を使う。Runtime Authorityは発行しない。
 * @stimulus 終端・通知・相関・保存・作成結果の各軸を一つずつ破る。
 * @observation 例外による拒否と元入力の不変。
 * @oracle 全反例を拒否し、同じ元対照だけを受理する。
 * @cleanup N/A: メモリだけ。
 * @boundary 親の純粋検査。実createや回収の根拠にはしない。
 */
test("認証create親は終端・packet・現在保存の不一致を拒否する", () => {
  const base = producerFacts();
  assert.equal(selectAuthCreateTarget(base.snapshot), base.operation);
  assert.equal(
    verifyAuthCreateProducer(base.child, base.operation, base.bytes),
    "1".repeat(64),
  );
  for (const patch of [
    { error: new Error("timeout") },
    { signal: "SIGTERM" as const },
    { status: 0 },
    { stdout: "" },
    { stdout: "invalid json" },
    { pid: 93 },
  ])
    assert.throws(() =>
      verifyAuthCreateProducer(
        { ...base.child, ...patch },
        base.operation,
        base.bytes,
      ),
    );
  for (const patch of [
    { pid: 93 },
    { recoveryId: "other" },
    { phase: "producer" },
    { hostStarts: 0 },
    { receiptRegistered: true },
    { providerStarted: true },
    { containerName: "other" },
    { ownershipLabel: "other" },
    { image: "other" },
    { dockerId: "short" },
    { stateSha256: "0".repeat(64) },
    ...[
      { pid: 0 },
      { status: 1 },
      { signal: "SIGTERM" },
      { stderrBytes: 1 },
      { stdoutBytes: 0 },
    ].map((value) => ({ createCli: { ...base.packet.createCli, ...value } })),
  ])
    assert.throws(() =>
      verifyAuthCreateProducer(
        { ...base.child, stdout: JSON.stringify({ ...base.packet, ...patch }) },
        base.operation,
        base.bytes,
      ),
    );
  for (const resourcePatch of [
    { request: "intent_saved" },
    { dockerId: "1".repeat(64) },
    { receiptSource: "runtime_reconciliation" },
    { observation: "present" },
  ]) {
    const changed = {
      ...base.operation,
      resources: [
        { ...base.operation.resources[0], ...resourcePatch },
        ...base.operation.resources.slice(1),
      ],
    } as CoordinatorStateTaskOperation;
    assert.throws(() =>
      verifyAuthCreateProducer(base.child, changed, base.bytes),
    );
  }
  assert.throws(() =>
    verifyAuthCreateProducer(
      base.child,
      base.operation,
      Buffer.from("different"),
    ),
  );
  assert.equal(
    verifyAuthCreateProducer(base.child, base.operation, base.bytes),
    "1".repeat(64),
  );
});

/**
 * 通知欠測の診断でも現在対象を推測しない。
 * @responsibility 一意性・未開始・固定Image・書込み境界を共同条件にする。
 * @trace PRL-IT-013
 * @precondition 合成Snapshotは親の選択条件だけを確認する。
 * @stimulus 対象なし・重複・開始済み・送信済み・共有書込み・Image差を与える。
 * @observation 一意な元操作の返却または拒否。
 * @oracle 条件欠測を正常・不存在へ畳まない。
 * @cleanup N/A: メモリだけ。
 * @boundary 現在保存の値から診断参照への選択。処置Authorityではない。
 */
test("認証create親は現在対象の一意性と未開始を要求する", () => {
  const { snapshot, operation } = producerFacts();
  for (const operations of [[], [operation, operation]])
    assert.throws(() => selectAuthCreateTarget({ ...snapshot, operations }));
  for (const execution of [
    { providerStart: "unknown" },
    { externalSend: "issued" },
    { sharedWrite: "unknown" },
  ])
    assert.throws(() =>
      selectAuthCreateTarget({
        ...snapshot,
        operations: [
          {
            ...operation,
            execution: { ...operation.execution, ...execution },
          } as CoordinatorStateTaskOperation,
        ],
      }),
    );
  const identity = JSON.parse(operation.identityJson);
  for (const patch of [
    { images: { provider: "other" } },
    { workspaceMountMode: "read_write" },
  ])
    assert.throws(() =>
      selectAuthCreateTarget({
        ...snapshot,
        operations: [
          {
            ...operation,
            identityJson: JSON.stringify({ ...identity, ...patch }),
          },
        ],
      }),
    );
  assert.equal(selectAuthCreateTarget(snapshot), operation);
});

/**
 * 明示実行引数のない手動入口は専用Root作成前に停止する。
 * @responsibility 通常importと直接CLI起動を実Processで区別する。
 * @trace PRL-IT-013
 * @precondition 専用実証Rootの有無と、存在時のmanifestを基準観測する。
 * @stimulus 引数なしで固定fixtureを起動する。
 * @observation 子終端・非0結果・stdout空とRootの不存在または既存manifest不変。
 * @oracle 起動拒否後もRootを新設せず、保持中の実証Rootも変更しない。
 * @cleanup N/A: Root作成前拒否。子は同期終端確認する。
 * @boundary 実Node起動だけでDocker要求は許可しない。
 */
test("認証create手動親は承認引数なしでRoot作成前に拒否する", () => {
  const verifier = fileURLToPath(
    new URL(
      "../fixtures/docker-auth-create-closure-verifier.ts",
      import.meta.url,
    ),
  );
  const root = fileURLToPath(
    new URL("../../../../.crdd/tests/auth-create-closure", import.meta.url),
  );
  const before = fs.existsSync(root)
    ? captureAuthCreateCleanupTree(root)
    : null;
  const result = spawnSync(process.execPath, [verifier], {
    cwd: path.dirname(verifier),
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /execute-approved/u);
  if (before) assert.deepEqual(captureAuthCreateCleanupTree(root), before);
  else assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
});

/**
 * 親の最終清掃観測は未知物・link・置換を拒否する。
 * @responsibility 自己生成Rootだけで清掃前の実Filesystem反証を確認する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition Repository-localの新品試験Rootと三つの既知Directoryを使用する。
 * @stimulus 未知top-level、junction、同本文別実体、本文変更、上限超過を独立に与える。
 * @observation 二走査manifestの一致／差と拒否。
 * @oracle 正常時だけ一致し、異常を同じ清掃前Oracleが拒否する。
 * @cleanup 作成したjunctionを先に解除し、自己生成Rootだけを削除・不存在確認する。
 * @boundary 実Filesystemだけ。原子的差替え防止・実Docker・全統括は未検証。
 */
test("Host Windows: 認証create親の清掃前manifestは未知物・junction・同本文別実体を拒否する", () => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "auth_create_cleanup_test",
  );
  const root = fs.mkdtempSync(
    path.join(area.directory, "auth-create-cleanup-"),
  );
  const junction = path.join(root, "docker-config");
  let junctionCreated = false;
  try {
    for (const name of [".git", ".crdd", "docker-config"])
      fs.mkdirSync(path.join(root, name));
    const file = path.join(root, ".git", "HEAD");
    fs.writeFileSync(file, "fixture");
    const before = captureAuthCreateCleanupTree(root);
    assert.deepEqual(captureAuthCreateCleanupTree(root), before);
    const unexpected = path.join(root, "unexpected");
    fs.writeFileSync(unexpected, "fixture");
    assert.throws(() => captureAuthCreateCleanupTree(root));
    fs.unlinkSync(unexpected);
    fs.writeFileSync(file, "changed");
    assert.throws(() =>
      assert.deepEqual(captureAuthCreateCleanupTree(root), before),
    );
    fs.writeFileSync(file, "fixture");
    assert.deepEqual(captureAuthCreateCleanupTree(root), before);
    const replaced = `${file}.old`;
    fs.renameSync(file, replaced);
    fs.writeFileSync(file, "fixture", { flag: "wx" });
    fs.unlinkSync(replaced);
    assert.throws(() =>
      assert.deepEqual(captureAuthCreateCleanupTree(root), before),
    );
    const huge = path.join(root, ".git", "oversized");
    fs.writeFileSync(huge, "");
    fs.truncateSync(huge, 17 * 1024 * 1024);
    assert.throws(() => captureAuthCreateCleanupTree(root));
    fs.unlinkSync(huge);
    fs.rmdirSync(junction);
    fs.symlinkSync(path.join(root, ".git"), junction, "junction");
    junctionCreated = true;
    assert.throws(() => captureAuthCreateCleanupTree(root));
    fs.unlinkSync(junction);
    junctionCreated = false;
    fs.mkdirSync(junction);
    assert.doesNotThrow(() => captureAuthCreateCleanupTree(root));
  } finally {
    if (junctionCreated) fs.unlinkSync(junction);
    assert.equal(path.dirname(root), area.directory);
    assert.equal(fs.realpathSync(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
  }
});
