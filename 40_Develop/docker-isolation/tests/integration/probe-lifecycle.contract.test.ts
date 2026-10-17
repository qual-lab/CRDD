/**
 * 固定Probeの取消と稼働残存の技術順序を検証する。
 * @packageDocumentation
 * @responsibility 現在性失効・待機失敗・join不明を実技術本文で反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope DI本番本文とProcess／Dockerの代役。実Dockerは使用しない。
 * @boundary ERB-IT-004=Related 2 Blocks: 上位現在性読取り→DI技術実行。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { types as utilTypes } from "node:util";
import { classifyDockerProbeCancellation } from "../../src/index.ts";

/**
 * 一意な本番関数を宣言から行頭の閉じ括弧まで取得する。
 * @responsibility 技術順序と失敗処置を試験で再実装しない。
 * @trace ERB-IT-004
 * @precondition 指定名は本番Source内で一意。
 * @stimulus 実宣言から同じ字下げの閉じ括弧まで型除去する。
 * @observation 本番関数本文。
 * @oracle 欠落・重複を準備失敗にする。
 * @cleanup N/A: 読取りとメモリだけ。
 * @boundary 実Sourceと検証VM。
 */
function probeLifecycleFunction(source: string, name: string) {
  const declaration = source.includes(`async function ${name}`)
    ? `async function ${name}`
    : `function ${name}`;
  assert.equal(source.split(declaration).length, 2);
  const begin = source.indexOf(declaration);
  const end = source.indexOf("\n}", begin) + 2;
  assert.ok(end > begin);
  return stripTypeScriptTypes(source.slice(begin, end));
}

/**
 * 三地点失効・有界待機・終端と稼働開始の要求列を確認する。
 * @responsibility 失効後前進0と取得済みHandle joinを同じ呼出しで検証する。
 * @trace ERB-IT-004
 * @precondition 実捕捉・待機・理由分類・実行関数を同VMへ接続する。
 * @stimulus 正常、三地点のthrow／Path差、観測不明、期限、overflow、join不明。
 * @observation 要求全列・対象ID・期限・一次失敗・最終理由・実終端要求数。
 * @oracle 取消成功には全条件が必要、失敗後のjoinだけは継続し、残存成功はremove0。
 * @cleanup メモリTimerを全解除。Process・File・Dockerを作らない。
 * @boundary DI本番技術群と固定代役。実資源回収の根拠ではない。
 */
test("Probe取消は三地点の失効と元失敗を保持し同じHandleを必ずjoinする", async () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/probe-runtime.ts", import.meta.url),
    "utf8",
  );
  const helpers = [
    "captureCurrentProbeMounts",
    "awaitProbeObservation",
    "probeCancellationFailure",
    "runDockerProbeCancellation",
    "startDockerProbeResidue",
  ]
    .map((name) => probeLifecycleFunction(source, name))
    .join("\n");
  const fixedSource = source.match(
    /const CANCELLATION_SOURCE = (`[\s\S]*?`);/u,
  )?.[1];
  assert.ok(fixedSource);
  const id = "a".repeat(64),
    probeId = "probe-123";
  const mounts = {
    workspace: "C:/fixture/workspace",
    providerHome: "C:/fixture/home",
    tmp: "C:/fixture/tmp",
  };
  const exact = {
    status: 42,
    signal: null,
    stdout:
      '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}\n{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}\n',
    stderr: "",
    outputExceeded: false,
  };
  const scenarios = [
    "normal",
    "ready-false",
    "ready-timeout",
    "completion-timeout",
    "overflow",
    "signal-failed",
    "join-null",
    "join-throw",
    "close-false",
    "ready-false+join-throw",
    "completion-timeout+join-throw",
    "overflow+join-throw",
    "throw-2+join-throw",
    "missing-1",
    "accessor-1",
    "proxy-1",
    ...[1, 2, 3].flatMap((step) => [
      `throw-${step}`,
      ...(step === 1 ? [] : [`path-${step}`]),
      `promise-${step}`,
      `inspect-${step}`,
    ]),
  ];
  /**
   * 一つの故障の要求列と独立理由期待を確認する。
   * @responsibility 内部catchに飲まれない外側Oracleを共有する。
   * @trace ERB-IT-004
   * @precondition 実本文または一意な反証変異を渡す。
   * @stimulus labelの単独・複合故障。
   * @observation 一次理由・最終理由と要求列。
   * @oracle 期待値は固定した故障意味からだけ選ぶ。
   * @cleanup メモリTimerを解除する。
   * @boundary 本番本文VMと外側assert。
   */
  const verify = async (label: string, bodies = helpers) => {
    const scenario = label.split("+")[0] ?? label;
    const joinThrows = label.includes("join-throw");
    const calls: string[] = [];
    const timers = new Map<number, () => void>();
    let timerId = 0,
      mountReads = 0,
      inspections = 0,
      joinCalls = 0,
      terminationRequests = scenario === "overflow" ? 1 : 0,
      clock = 100;
    let completionSettled = ![
      "ready-false",
      "ready-timeout",
      "completion-timeout",
    ].includes(scenario);
    let lateReady: (value: boolean) => void = () => undefined;
    let lateCompletion: (value: typeof exact) => void = () => undefined;
    const ready =
      scenario === "ready-timeout"
        ? new Promise<boolean>((resolve) => {
            lateReady = resolve;
          })
        : Promise.resolve(scenario !== "ready-false");
    const completion =
      scenario === "completion-timeout"
        ? new Promise<typeof exact>((resolve) => {
            lateCompletion = resolve;
          })
        : Promise.resolve({
            ...exact,
            outputExceeded: scenario === "overflow",
          });
    const controller = {
      ready,
      completion,
      terminateAndWait: async () => {
        calls.push("join");
        joinCalls++;
        if (!completionSettled && terminationRequests === 0)
          terminationRequests++;
        completionSettled = true;
        clock += 19;
        if (joinThrows) throw new Error("private-detail");
        return scenario === "join-null" ? null : exact;
      },
      isClosed: () => scenario !== "close-false",
      getTerminationRequestCount: () => terminationRequests,
    };
    const binding = {
      verifyCli: () => "fixed-cli",
      environment: () => ({ FIXED: "fixture" }),
    };
    const api = runInNewContext(
      `(()=>{const CANCELLATION_SOURCE=${fixedSource};${bodies};return {cancel:runDockerProbeCancellation,residue:startDockerProbeResidue};})()`,
      {
        Object,
        Reflect,
        Number,
        Error,
        Promise,
        Buffer,
        Set,
        utilTypes,
        classifyDockerProbeCancellation,
        performance: { now: () => clock },
        setTimeout: (callback: () => void, timeout: number) => {
          assert.equal(timeout, 5_000);
          const key = ++timerId;
          timers.set(key, callback);
          if (
            scenario === "ready-timeout" ||
            (scenario === "completion-timeout" && key === 2)
          )
            queueMicrotask(callback);
          return key;
        },
        clearTimeout: (key: number) => {
          assert.equal(timers.delete(key), true);
        },
        inspectDockerProbeContainer: (
          actualBinding: unknown,
          expected: {
            id: string;
            probeId: string;
            mounts: object;
            sourceCandidates: string[];
          },
        ) => {
          assert.equal(actualBinding, binding);
          assert.equal(expected.id, id);
          assert.equal(expected.probeId, probeId);
          assert.deepEqual(JSON.parse(JSON.stringify(expected.mounts)), mounts);
          assert.equal(expected.sourceCandidates.length, 1);
          assert.match(
            expected.sourceCandidates[0] ?? "",
            /signal.signal\(signal.SIGTERM/u,
          );
          inspections++;
          calls.push(`inspect-${inspections}`);
          return scenario === `inspect-${inspections}`
            ? null
            : { runningConfirmed: true };
        },
        startDockerProbeAttachedProcess: (
          actualBinding: unknown,
          actualId: string,
          prefix: string,
        ) => {
          assert.equal(actualBinding, binding);
          assert.equal(actualId, id);
          assert.equal(prefix, `${exact.stdout.split("\n")[0]}\n`);
          calls.push("attach");
          return controller;
        },
        executeDockerProbeCommand: (
          actualBinding: unknown,
          command: unknown,
          timeout: number,
        ) => {
          assert.equal(actualBinding, binding);
          assert.deepEqual(JSON.parse(JSON.stringify(command)), {
            purpose: "terminate",
            containerId: id,
          });
          assert.equal(timeout, 5_000);
          calls.push("SIGTERM");
          clock += 11;
          return {
            status: scenario === "signal-failed" ? 1 : 0,
            stdout: "",
            stderr: "",
          };
        },
      },
    ) as {
      cancel: (
        binding: object,
        identity: object,
        read: () => unknown,
      ) => Promise<{
        status: string;
        reason: string;
        primaryFailure: string | null;
        postRunMountVerified: boolean;
        attachProcessTerminationObserved: boolean;
        attachProcessTerminationRequestCount: number;
        observation: {
          graceElapsedMs: number | null;
          cancellationRequested: boolean;
        };
      }>;
    };
    const result = await api.cancel(binding, { id, probeId }, () => {
      mountReads++;
      calls.push(`mount-${mountReads}`);
      if (scenario === `throw-${mountReads}`)
        throw new Error("owned_operation_mount_replaced");
      if (scenario === `path-${mountReads}`)
        return { ...mounts, tmp: "C:/other/tmp" };
      if (scenario === `promise-${mountReads}`) return Promise.resolve(mounts);
      if (scenario === "missing-1") return {};
      if (scenario === "proxy-1")
        return new Proxy(mounts, {
          get: () => {
            throw new Error("getter_must_not_run");
          },
        });
      if (scenario === "accessor-1")
        return Object.defineProperty({ ...mounts }, "tmp", {
          get: () => {
            throw new Error("getter_must_not_run");
          },
        });
      return { ...mounts };
    });
    assert.equal(timers.size, 0, scenario);
    const beforeReady = ["mount-1", "inspect-1", "attach"];
    const beforeSignal = [...beforeReady, "mount-2", "inspect-2"];
    const afterSignal = [...beforeSignal, "SIGTERM"];
    const full = [...afterSignal, "mount-3", "inspect-3", "join"];
    const expectedCalls = /^(throw|promise|missing|accessor|proxy)-1$/u.test(
      scenario,
    )
      ? ["mount-1"]
      : scenario === "inspect-1"
        ? ["mount-1", "inspect-1"]
        : scenario.startsWith("ready-")
          ? [...beforeReady, "join", "join"]
          : /^(throw|path|promise)-2$/u.test(scenario)
            ? [...beforeReady, "mount-2", "join"]
            : scenario === "inspect-2"
              ? [...beforeSignal, "join"]
              : ["overflow", "completion-timeout"].includes(scenario)
                ? [...afterSignal, "join", "join"]
                : scenario === "signal-failed"
                  ? [...afterSignal, "join"]
                  : /^(throw|path|promise)-3$/u.test(scenario)
                    ? [...afterSignal, "mount-3", "join"]
                    : full;
    assert.deepEqual(calls, expectedCalls, scenario);
    assert.equal(
      result.attachProcessTerminationRequestCount,
      terminationRequests,
      scenario,
    );
    const expectedPrimary = [
      "normal",
      "join-null",
      "join-throw",
      "close-false",
    ].includes(scenario)
      ? null
      : /^(throw|path|promise|missing|accessor|proxy)-/u.test(scenario)
        ? "owned_operation_mount_replaced"
        : scenario === "inspect-1"
          ? "docker_container_security_profile_mismatch"
          : scenario === "inspect-2" || scenario.startsWith("ready-")
            ? "dynamic_fake_provider_cancellation_ready_unconfirmed"
            : scenario === "inspect-3"
              ? "owned_operation_mount_replaced"
              : scenario === "completion-timeout"
                ? "dynamic_fake_provider_cancellation_acknowledgement_invalid"
                : "dynamic_fake_provider_cancellation_verification_failed";
    const expectedReason =
      joinThrows || ["join-null", "close-false"].includes(scenario)
        ? "dynamic_fake_provider_attach_process_termination_unconfirmed"
        : (expectedPrimary ?? "dynamic_fake_provider_cancellation_candidate");
    assert.equal(result.primaryFailure, expectedPrimary, label);
    assert.equal(result.reason, expectedReason, label);
    if (scenario === "normal") {
      assert.deepEqual(calls, [
        "mount-1",
        "inspect-1",
        "attach",
        "mount-2",
        "inspect-2",
        "SIGTERM",
        "mount-3",
        "inspect-3",
        "join",
      ]);
      assert.equal(result.status, "candidate");
      assert.equal(result.primaryFailure, null);
      assert.equal(result.postRunMountVerified, true);
      assert.equal(result.observation.graceElapsedMs, 11);
      assert.equal(terminationRequests, 0);
    } else {
      assert.equal(result.status, "blocked", scenario);
      if (/^(throw|promise|inspect)-1$/u.test(scenario)) {
        assert.equal(calls.includes("attach"), false);
        assert.equal(joinCalls, 0);
      }
      if (
        /^(throw|path|promise|inspect)-2$/u.test(scenario) ||
        scenario.startsWith("ready-")
      ) {
        assert.equal(calls.includes("SIGTERM"), false);
        assert.ok(joinCalls > 0);
      }
      if (["join-null", "join-throw", "close-false"].includes(scenario))
        assert.equal(
          result.reason,
          "dynamic_fake_provider_attach_process_termination_unconfirmed",
        );
      if (scenario === "signal-failed")
        assert.equal(
          result.primaryFailure,
          "dynamic_fake_provider_cancellation_verification_failed",
        );
      if (scenario === "completion-timeout") {
        assert.equal(terminationRequests, 1);
        assert.equal(joinCalls, 2);
        assert.equal(result.observation.graceElapsedMs, 30);
      }
    }
    const snapshot = JSON.stringify(result);
    lateReady(true);
    lateCompletion(exact);
    await Promise.resolve();
    assert.equal(JSON.stringify(result), snapshot);
  };
  for (const scenario of scenarios) await verify(scenario);
  const primaryNeedle = "primaryFailure = probeCancellationFailure(error);";
  const finalNeedle =
    'reason = "dynamic_fake_provider_attach_process_termination_unconfirmed";';
  assert.equal(helpers.split(primaryNeedle).length, 2);
  assert.equal(helpers.split(finalNeedle).length, 2);
  await assert.rejects(
    () =>
      verify(
        "throw-2",
        helpers.replace(
          primaryNeedle,
          'primaryFailure = "dynamic_fake_provider_cancellation_verification_failed";',
        ),
      ),
    { code: "ERR_ASSERTION" },
  );
  await assert.rejects(
    () =>
      verify(
        "ready-false+join-throw",
        helpers.replace(finalNeedle, "reason = primaryFailure ?? reason;"),
      ),
    { code: "ERR_ASSERTION" },
  );
});

/**
 * 意図的な稼働残存は同対象の観測だけで成立させる。
 * @responsibility start失敗・観測不明・Path失効をreadyへ昇格しない。
 * @trace ERB-IT-004
 * @precondition 本番の捕捉関数と残存開始関数を使用する。
 * @stimulus 正常、前後の構成不明、開始非0・例外、二回目Path差・throw。
 * @observation 全要求列・実ID・10秒・callback回数。
 * @oracle 正常は二観測とstart一回、失敗後に追加start／removeなし。
 * @cleanup N/A: メモリだけで実資源を作らない。
 * @boundary DI残存開始と固定Docker代役。
 */
test("稼働残存は保存後fresh確認から同実IDを一回開始し回収しない", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/probe-runtime.ts", import.meta.url),
    "utf8",
  );
  const bodies = ["captureCurrentProbeMounts", "startDockerProbeResidue"]
    .map((name) => probeLifecycleFunction(source, name))
    .join("\n");
  const fixedSource = source.match(
    /const CANCELLATION_SOURCE = (`[\s\S]*?`);/u,
  )?.[1];
  assert.ok(fixedSource);
  const id = "b".repeat(64),
    probeId = "residue-123";
  const mounts = {
    workspace: "C:/fixture/workspace",
    providerHome: "C:/fixture/home",
    tmp: "C:/fixture/tmp",
  };
  for (const scenario of [
    "normal",
    "before-unknown",
    "after-unknown",
    "not-running",
    "start-failed",
    "start-throw",
    "path-changed",
    "owner-lost",
  ]) {
    const calls: string[] = [];
    let reads = 0,
      observations = 0;
    const binding = {};
    const start = runInNewContext(
      `(()=>{const CANCELLATION_SOURCE=${fixedSource};${bodies};return startDockerProbeResidue;})()`,
      {
        Object,
        Reflect,
        Error,
        utilTypes,
        inspectDockerProbeContainer: (
          actual: object,
          expected: {
            id: string;
            probeId: string;
            mounts: object;
            sourceCandidates: string[];
          },
        ) => {
          assert.equal(actual, binding);
          assert.equal(expected.id, id);
          assert.equal(expected.probeId, probeId);
          assert.deepEqual(JSON.parse(JSON.stringify(expected.mounts)), mounts);
          assert.equal(expected.sourceCandidates.length, 1);
          assert.match(expected.sourceCandidates[0] ?? "", /sys.exit\(42\)/u);
          observations++;
          calls.push(`inspect-${observations}`);
          if (
            (scenario === "before-unknown" && observations === 1) ||
            (scenario === "after-unknown" && observations === 2)
          )
            return null;
          return { runningConfirmed: scenario !== "not-running" };
        },
        executeDockerProbeCommand: (
          actual: object,
          command: unknown,
          timeout: number,
        ) => {
          assert.equal(actual, binding);
          assert.deepEqual(JSON.parse(JSON.stringify(command)), {
            purpose: "start",
            containerId: id,
          });
          assert.equal(timeout, 10_000);
          calls.push("start");
          if (scenario === "start-throw") throw new Error("fixture");
          return { status: scenario === "start-failed" ? 1 : 0 };
        },
      },
    ) as (
      binding: object,
      identity: object,
      read: () => object,
    ) => { runningConfirmed: boolean };
    const run = () =>
      start(binding, { id, probeId }, () => {
        reads++;
        calls.push(`mount-${reads}`);
        if (reads === 2 && scenario === "owner-lost")
          throw new Error("owned_operation_mount_replaced");
        return {
          ...mounts,
          tmp:
            reads === 2 && scenario === "path-changed"
              ? "C:/other/tmp"
              : mounts.tmp,
        };
      });
    if (scenario === "normal") {
      assert.equal(run().runningConfirmed, true);
      assert.deepEqual(calls, [
        "mount-1",
        "inspect-1",
        "start",
        "mount-2",
        "inspect-2",
      ]);
    } else {
      assert.throws(run);
      assert.equal(
        calls.filter((call) => call === "start").length,
        scenario === "before-unknown" ? 0 : 1,
      );
      if (scenario.startsWith("start-")) assert.equal(reads, 1);
      if (scenario === "path-changed" || scenario === "owner-lost")
        assert.equal(observations, 1);
    }
  }
});
