/**
 * 単発診断の実行結果とreadinessの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:doctorが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope doctor
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { observeExecutionCompletion } from "../../../src/lifecycle/environment.ts";

import {
  CHECK_STATUS,
  type DiagnosticCheck,
  discoverCommand,
  evaluateReadiness,
  isSupportedNodeRuntime,
  REQUIRED_CHECK_IDS,
  runDoctor,
} from "../../../src/lifecycle/environment.ts";
import { renderDoctorCommandFailure } from "../../../src/cli/command.ts";

/**
 * 同じProbeのReceipt・終了・回収・Host終端を共同成立条件として確認する。
 * @responsibility 実宣言の調停を有限代役で検証し、外部資源不存在の実測とは区別する。
 * @trace PRL-UT-014
 * @precondition Source解析は一回。各観点の記録・Owner・故障・呼出し列は独立。
 * @stimulus 正常、Receipt欠測／保存失敗、実ID差、終了不明、回収不明、取消、明示未発行。
 * @observation 実行結果・保存順序・Host清掃回数・回復参照。
 * @oracle 未確認を成功又は未発行に変換せず、保存確認後だけ清掃する。
 * @cleanup N/A: VM内のメモリ代役だけ。実AI・Docker・Filesystem変更なし。
 * @boundary 調停と有限代役の局所契約。EM WriterやDIの実境界は別試験。
 */
test("Probeは同じReceiptと終了・回収・Host保存が揃うまで成功しない", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const declarations = [
    "isolationProbeBlocked",
    "dynamicFakeLifecycleBlocked",
    "projectProbeExecutionFacts",
    "finishPreSubmissionCleanup",
    "normalizeFailure",
    "isolationProbeErrorMessage",
    "ownString",
    "isolationProbeOwnValue",
    "isolationProbeIsObject",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const build = () =>
    runInNewContext(
      `
    ${declarations}
    async function exercise(scenario) {
      const calls = [], recoveryId = "host-operation.OP-123456", id = "a".repeat(64);
      const unissued = scenario.startsWith("not_issued");
      let saved = null;
      const snapshot = { resources: [{ key: "probe", request: "not_issued", identity: { dockerId: null } }] };
      const receipt = { resources: [{ key: "probe", request: "issued", identity: { dockerId: id } }] };
      const target = resources => ({ managementDirectory: "management", resources,
        previouslyAbsent: [], unreceiptedAbsence: "retain" });
      const randomUUID = () => "probe-id";
      const getOwnedHostRecoveryId = () => recoveryId;
      const createOwnedMountCapability = () => ({});
      const createOwnedOperationContextCapability = () => ({});
      const createOwnedOperationManagementCapability = () => ({});
      const verifyOwnedMountCapability = () => ({ management: "management", workspace: "workspace", providerHome: "home", tmp: "tmp" });
      const readOwnedHostOperation = () => ({ record: { resources: saved }, payloadSha256: "b".repeat(64) });
      const applyResourceEvent = (previous, event) => {
        calls.push(event.event);
        if (scenario === "receipt_save_failure" && event.event === "receipt") return null;
        return { snapshot: event.snapshot ?? previous.snapshot,
          checkpoints: [{ submission: event.event === "not_issued" ? "not_issued" : "intent_saved",
            observation: "unobserved", receiptSource: event.event === "receipt" ? "docker_create_result" : null }] };
      };
      const recordOwnedHostResources = (_management, next) => { saved = next; calls.push("save"); };
      const applyResourceCleanup = (previous, next) => {
        calls.push("absence");
        assert.equal(previous.checkpoints[0].receiptSource, "docker_create_result");
        assert.equal(previous.snapshot.resources[0].identity.dockerId, next.resources[0].identity.dockerId);
        return { ...previous, snapshot: next, checkpoints: [{ ...previous.checkpoints[0], observation: "absent" }] };
      };
      const cleanupOwnedOperationDirectories = () => { calls.push("host_cleanup"); };
      const getIsolationSettings = () => ({});
      const createExecutor = request => ({
        cancel: async () => ({ status: "accepted" }),
        start(input) {
          const completion = (async () => {
            let failed = false;
            input.callbacks.onCommandSubmitting("create_isolation_probe", target(snapshot));
            if (!unissued) calls.push("effect");
            if (!unissued && scenario !== "receipt_missing") {
              try { input.callbacks.onResourceCreated(scenario === "receipt_mismatch" ? "wrong" : id, target(receipt)); }
              catch { failed = true; }
            }
            return {
              reason: "probe_ok", creationAttempted: !unissued,
              containerId: unissued ? null : id,
              resourceSnapshot: scenario === "not_issued_snapshot_missing" ? null :
                scenario === "not_issued_request_unknown" ? { resources: [{ ...snapshot.resources[0], request: "unknown" }] } :
                scenario === "not_issued_id_present" ? { resources: [{ ...snapshot.resources[0], identity: { dockerId: id } }] } :
                unissued ? snapshot : receipt,
              facts: { isolation: { status: "confirmed", reason: "probe_ok" },
                lifecycleStatus: "candidate", lifecycleReason: "candidate", elapsedMs: 5,
                stdoutBytes: 1, stderrBytes: 0, exitCode: 0, signal: null, timedOut: false },
              cancelled: scenario === "cancelled",
              processCompletionConfirmed: !["process_unknown", "not_issued_process_unknown"].includes(scenario),
              cleanupConfirmed: !["cleanup_unknown", "not_issued_cleanup_unknown"].includes(scenario) && !failed,
            };
          })();
          return { status: "started", completion };
        },
      });
      const execute = ${sourceDeclaration(source, "runDockerIsolationProbe")};
      const result = await execute({}, new AbortController().signal);
      return JSON.stringify({ result, calls, saved });
    }
    exercise;
  `,
      { assert, AbortController, observeExecutionCompletion },
    ) as (scenario: string) => Promise<string>;
  for (const scenario of [
    "normal",
    "receipt_missing",
    "receipt_mismatch",
    "receipt_save_failure",
    "cleanup_unknown",
    "process_unknown",
    "cancelled",
    "not_issued",
    "not_issued_snapshot_missing",
    "not_issued_request_unknown",
    "not_issued_id_present",
    "not_issued_process_unknown",
    "not_issued_cleanup_unknown",
  ]) {
    const { result, calls, saved } = JSON.parse(await build()(scenario));
    if (scenario === "normal") {
      assert.equal(result.status, "confirmed");
      assert.equal(result.fakeProviderLifecycle.status, "verified");
      assert.equal(result.hostCleanupCompleted, true);
      assert.equal(result.recoveryId, null);
    } else if (scenario === "cancelled" || scenario === "not_issued") {
      assert.equal(result.status, "blocked");
      assert.equal(result.hostCleanupCompleted, true);
      assert.equal(result.recoveryId, null);
      if (scenario === "not_issued") {
        assert.equal(calls.includes("effect"), false);
        assert.equal(saved.checkpoints[0].submission, "not_issued");
      }
    } else {
      assert.equal(result.status, "blocked");
      assert.equal(result.hostCleanupCompleted, false);
      assert.equal(result.retainOperationDirectories, true);
      assert.equal(result.recoveryId, "host-operation.OP-123456");
      assert.equal(calls.includes("host_cleanup"), false);
      if (scenario.startsWith("not_issued_")) {
        assert.equal(calls.includes("not_issued"), false);
        assert.equal(calls.includes("effect"), false);
      }
    }
    assert.ok(
      calls.indexOf("save") < calls.indexOf("effect") ||
        !calls.includes("effect"),
    );
    if (calls.includes("host_cleanup"))
      assert.equal(calls.at(-1), "host_cleanup");
  }
});

/**
 * Probe回復で保存済み不存在と同じRootの現在観測を共同確認する。
 * @responsibility 削除後の再入場と観測不能、終了不明、解放不明の区別を固定する。
 * @trace PRL-UT-014
 * @precondition 実宣言を一回抽出し、各観点の資源記録と故障を独立させる。
 * @stimulus Rootの存在三値、資源未解決、保存失敗、Process終了不明、Lock解放不明。
 * @observation DI借用・回収・EM保存・Host清掃・解放の呼出し列と元参照。
 * @oracle 不存在記録とRoot不存在が揃う場合だけDI借用を省略し、不明では清掃しない。
 * @cleanup N/A: メモリ代役だけ。
 * @boundary 回復調停の局所契約。実Dockerと実Lockは使用しない。
 */
test("Probe回復は削除後再入場を閉じ、不明と解放失敗を成功にしない", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "recoverDockerIsolationProbe");
  const exercise = runInNewContext(
    `
    async function exercise(scenario) {
      const calls = [], id = "host-operation.OP-123456", generation = {};
      let resources = { cleanup: { unreceiptedAbsence: "retain" },
        snapshot: { resources: [{ key: "probe", identity: { dockerId: "a".repeat(64) } }] },
        checkpoints: [{ key: "probe", submission: "intent_saved",
          receiptSource: scenario === "receipt_unknown" ? null : "docker_create_result",
          observation: scenario.startsWith("settled_") || scenario === "release_unknown" ? "absent" : "unobserved" }] };
      const acquireHostOperationRecoveryGeneration = () => { calls.push("acquire"); return generation; };
      const readHostRecoveryOperation = actual => {
        assert.equal(actual, generation);
        return { record: { purpose: "isolation_probe", resources }, payloadSha256: "b".repeat(64) };
      };
      const observeHostRecoveryRoot = () => scenario === "settled_absent" || scenario === "release_unknown" ? "absent" :
        scenario === "settled_unknown" ? "unknown" : "present";
      const borrowHostRecoveryManagementDirectory = () => {
        calls.push("borrow");
        return scenario === "settled_unknown" ? null : { directory: "management", assertCurrent: () => true };
      };
      const cleanupResources = (target, _settings, callbacks) => {
        calls.push("di_cleanup");
        assert.equal(target.unreceiptedAbsence, "retain");
        return { cancel: async () => ({}), completion: (async () => {
          callbacks.onCleanupSubmitting();
          callbacks.onResourcesClosed(resources.snapshot, [{ key: "probe", observation: "absent" }]);
          return { processTerminationConfirmed: scenario !== "process_unknown", cleanup: { confirmed: true } };
        })() };
      };
      const applyResourceCleanup = previous => ({ ...previous,
        checkpoints: previous.checkpoints.map(c => ({ ...c, observation: "absent" })) });
      const recordHostRecoveryResources = (_generation, next) => {
        calls.push("save");
        if (scenario === "save_failure") throw Error("save_failure");
        resources = next;
      };
      const getIsolationSettings = () => ({});
      const recoverOwnedOperationDirectories = (recoveryId, actual) => {
        assert.equal(recoveryId, id); assert.equal(actual, generation);
        assert.equal(resources.checkpoints[0].observation, "absent");
        calls.push("host_cleanup");
        return { status: "recovered", reason: "host_cleanup_recovered", recoveryId: null };
      };
      const releaseHostOperationRecoveryGeneration = () => { calls.push("release"); return scenario !== "release_unknown"; };
      const normalizeFailure = error => error.message;
      const run = ${body};
      const result = await run(id, {}, () => true, new AbortController().signal);
      return JSON.stringify({ result, calls });
    }
    exercise;
  `,
    { assert, AbortController },
  ) as (scenario: string) => Promise<string>;
  for (const scenario of [
    "settled_absent",
    "settled_present",
    "settled_unknown",
    "receipt_unknown",
    "process_unknown",
    "save_failure",
    "release_unknown",
  ]) {
    const { result, calls } = JSON.parse(await exercise(scenario));
    const success =
      scenario === "settled_absent" || scenario === "settled_present";
    assert.equal(result.hostCleanupCompleted, success);
    assert.equal(result.status, success ? "recovered" : "blocked");
    assert.equal(
      result.recoveryId,
      success ? null : "host-operation.OP-123456",
    );
    assert.equal(calls.at(-1), "release");
    if (scenario === "settled_absent" || scenario === "release_unknown") {
      assert.equal(calls.includes("borrow"), false);
      assert.equal(calls.includes("di_cleanup"), false);
    } else if (scenario === "settled_present") {
      assert.equal(calls.includes("di_cleanup"), true);
      assert.ok(calls.indexOf("save") < calls.indexOf("host_cleanup"));
    } else {
      assert.equal(calls.includes("host_cleanup"), false);
    }
  }
});

/**
 * Node基準は24.12.0以上だけを受理するを検証する。
 *
 * @responsibility Node基準は24.12.0以上だけを受理するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Node基準は24.12.0以上だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Node基準は24.12.0以上だけを受理する", () => {
  for (const version of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedNodeRuntime(version), true);
  }
  for (const version of ["24.11.9", "23.99.0", "v24.12.0", "bad"]) {
    assert.equal(isSupportedNodeRuntime(version), false);
  }
});

/**
 * 全必須checkがconfirmedの場合だけpure集約はReadyを返すを検証する。
 *
 * @responsibility 全必須checkがconfirmedの場合だけpure集約はReadyを返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全必須checkがconfirmedの場合だけpure集約はReadyを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("全必須checkがconfirmedの場合だけpure集約はReadyを返す", () => {
  const checks: DiagnosticCheck[] = REQUIRED_CHECK_IDS.map((id) => ({
    id,
    status: "confirmed",
    reason: null,
    followUp: null,
  }));
  assert.deepEqual(evaluateReadiness(checks), {
    status: "ready",
    blockers: [],
  });
});

/**
 * 欠落、重複、未知および不正なcheckをfail closedにするを検証する。
 *
 * @responsibility 欠落、重複、未知および不正なcheckをfail closedにするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 欠落、重複、未知および不正なcheckをfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("欠落、重複、未知および不正なcheckをfail closedにする", () => {
  const baseItems: DiagnosticCheck[] = REQUIRED_CHECK_IDS.map((id) => ({
    id,
    status: "confirmed",
    reason: null,
    followUp: null,
  }));
  assert.equal(evaluateReadiness(baseItems.slice(1)).status, "blocked");
  assert.equal(
    evaluateReadiness([...baseItems, baseItems[0]]).status,
    "blocked",
  );
  assert.equal(
    evaluateReadiness([
      ...baseItems,
      { id: "unknown", status: "confirmed", reason: null },
    ]).status,
    "blocked",
  );
  assert.deepEqual(CHECK_STATUS, [
    "confirmed",
    "blocked",
    "not_implemented",
    "unknown",
  ]);
});

/**
 * passive discoveryは候補名を実行せず絶対Pathを公開しないを検証する。
 *
 * @responsibility passive discoveryは候補名を実行せず絶対Pathを公開しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus passive discoveryは候補名を実行せず絶対Pathを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("passive discoveryは候補名を実行せず絶対Pathを公開しない", () => {
  const result = discoverCommand("definitely-not-a-provider-command");
  assert.equal(result.located, false);
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.formats, []);
});

/**
 * doctor optionsは余分field、accessorおよびProxyを処置前に拒否するを検証する。
 *
 * @responsibility doctor optionsは余分field、accessorおよびProxyを処置前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus doctor optionsは余分field、accessorおよびProxyを処置前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("doctor optionsは余分field、accessorおよびProxyを処置前に拒否する", async () => {
  await assert.rejects(
    () =>
      runDoctor({
        activeIsolation: false,
        cwd: process.cwd(),
        runtimeRootRequest: null,
      }),
    /doctor_options_invalid/u,
  );
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "cwd", {
    enumerable: true,
    get() {
      throw new Error("must_not_read");
    },
  });
  await assert.rejects(() => runDoctor(accessor), /doctor_options_invalid/u);
  await assert.rejects(
    () => runDoctor(new Proxy({}, { ownKeys: () => [] })),
    /doctor_options_invalid/u,
  );
});

/**
 * 受動診断はHost資源を取得せず、明示隔離だけ既存の実行経路へ渡す。
 * @responsibility 実runDoctor宣言の分岐と例外搬送を有限代役で反証する。
 * @trace PRL-UT-014
 * @precondition 下位観測とHost producerはメモリ上の代役へ固定する。
 * @stimulus 省略・受動・観測例外・明示隔離・初期化例外を与える。
 * @observation 作成・Probe・清掃回数、元Signal、結果と元例外。
 * @oracle 受動は作成・清掃0、隔離だけ一度作成し同じSignalでProbeを待つ。
 * @cleanup N/A: 実Process・Directoryを生成しない。
 * @boundary 実宣言から用途固定の下位呼出し。
 */
test("Doctorは受動の成功・失敗でHost資源を作らず明示隔離だけ取得する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "runDoctor");
  for (const scenario of [
    "default",
    "passive",
    "observation_failure",
    "active",
    "active_retained",
    "active_cancelled",
    "creation_failure",
  ] as const) {
    const calls: string[] = [];
    const failure = new Error(scenario);
    const controller = new AbortController();
    if (scenario === "active_cancelled") controller.abort();
    const signal = controller.signal;
    const owned = { root: "private-root", directories: {} };
    const execute = runInNewContext(`(${body})`, {
      process,
      normalizeDoctorOptions: (
        options: { activeIsolation?: boolean } = {},
      ) => ({
        activeIsolation: options.activeIsolation ?? false,
        cwd: "fixture",
      }),
      getRepositoryFromWorkingDirectory: () => ({
        status: "completed",
        capability: {},
      }),
      resolveVerifiedRepositoryRoot: () => "fixture-root",
      createRuntimeOwnedCoordinatorOperation: () => {
        calls.push("create");
        if (scenario === "creation_failure") throw failure;
        return { owned };
      },
      projectDoctorOperationCreationFailure: (error: unknown) => {
        throw error;
      },
      cleanupOwnedOperationDirectories: () => {
        calls.push("cleanup");
      },
      credentialEnvironmentNamesPresent: () => [],
      probeGitRepository: () => {
        if (scenario === "observation_failure") throw failure;
        return { gitAvailable: true, identityAvailable: true };
      },
      discoverCommand: () => ({ located: false }),
      runDockerIsolationProbe: async (
        actualOwned: unknown,
        actualSignal: unknown,
      ) => {
        assert.equal(actualOwned, owned);
        assert.equal(actualSignal, signal);
        calls.push("probe");
        const retained = scenario === "active_retained";
        return {
          status: retained ? "blocked" : "confirmed",
          reason: "fixture",
          hostCleanupCompleted: !retained,
          recoveryId: retained ? "fixture-exact-recovery" : null,
          manualRecoveryRequired: retained,
        };
      },
      isSupportedNodeRuntime: () => true,
      check: (id: string, status: string, reason: string | null) => ({
        id,
        status,
        reason,
      }),
      providerChecks: () => [],
      evaluateReadiness: (checks: readonly DiagnosticCheck[]) =>
        evaluateReadiness(Array.from(checks)),
      describeFilesystemPolicy: () => ({}),
      reportableFilesystemPolicy: () => ({ fixture: true }),
      describeProviderLifecycleContract: () => ({}),
      describeIsolationConfiguration: () => ({ proxy: {} }),
      DOCKER_ISOLATION_PROFILE: "fixture",
    }) as (
      options: unknown,
      signal: AbortSignal,
    ) => Promise<{
      reportVersion: number;
      filesystem: { policy: unknown };
      recovery: {
        required: boolean;
        recoveryId?: string;
        manualRecoveryRequired?: boolean;
      };
      blockers: readonly { id: string | null; reason: string }[];
    }>;
    const options =
      scenario === "default"
        ? undefined
        : {
            activeIsolation:
              scenario === "active" ||
              scenario === "active_retained" ||
              scenario === "active_cancelled" ||
              scenario === "creation_failure",
          };
    if (scenario === "observation_failure" || scenario === "creation_failure") {
      await assert.rejects(
        () => execute(options, signal),
        (error) => error === failure,
      );
      assert.deepEqual(
        calls,
        scenario === "creation_failure" ? ["create"] : [],
      );
    } else {
      const result = await execute(options, signal);
      assert.equal(result.reportVersion, 17);
      assert.equal(result.recovery.required, scenario === "active_retained");
      if (
        scenario === "active" ||
        scenario === "active_retained" ||
        scenario === "active_cancelled"
      ) {
        assert.deepEqual(calls, ["create", "probe"]);
        assert.notEqual(result.filesystem.policy, null);
        if (scenario === "active_retained") {
          assert.equal(result.recovery.recoveryId, "fixture-exact-recovery");
          assert.equal(result.recovery.manualRecoveryRequired, true);
        }
      } else {
        assert.deepEqual(calls, []);
        assert.equal(result.filesystem.policy, null);
        assert.deepEqual(result.blockers[0], {
          id: "operation.directories",
          reason: "owned_operation_directories_not_requested",
        });
      }
    }
  }
});

/**
 * Doctor診断失敗は理由コードだけを公開するを検証する。
 *
 * @responsibility Doctor診断失敗は理由コードだけを公開するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Doctor診断失敗は理由コードだけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Doctor診断失敗は理由コードだけを公開する", () => {
  const rendered = renderDoctorCommandFailure(
    new Error("provider_discovery_failed"),
  );
  assert.equal(rendered.exitCode, 2);
  assert.deepEqual(JSON.parse(rendered.json), {
    status: "blocked",
    reason: "provider_discovery_failed",
  });
  assert.equal(rendered.human.includes("provider_discovery_failed"), true);
});

/**
 * 診断の元ErrorとCLI表示が同じ私有分類を共有する。
 * @responsibility 移管によるWeakMap複製・元回復参照欠落を検出する。
 * @trace PRL-UT-014
 * @precondition 新しいNode子で実宣言の共有閉包を作り、作成失敗分類だけを模擬する。
 * @stimulus 元失敗を診断へ渡し、投影ErrorをCLIで表示する。
 * @observation JSON・人向け表示とコピーErrorの分類。
 * @oracle 元Errorだけにexact回復参照を保持し、原因本文を出力しない。
 * @cleanup spawnSyncが同じ子の終了を待つ。外部資源は取得しない。
 * @boundary PRL-UT-014=Related 2 Blocks: 診断失敗の実宣言→実CLI表示。集約Moduleの初期化検査ではない。
 */
test("診断とCLI表示は元Errorの回復参照を共有しコピーを拒否する", () => {
  const diagnostics = new URL(
    "../../../src/lifecycle/environment.ts",
    import.meta.url,
  ).href;
  const source = fs.readFileSync(new URL(diagnostics), "utf8");
  const declarations = [
    "doctorOperationInitializationFailures",
    "classifyDoctorOperationInitializationFailure",
    "throwDoctorOperationInitializationFailure",
    "projectDoctorOperationCreationFailure",
  ]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const report = new URL("../../../src/cli/command.ts", import.meta.url).href;
  const parentCoverage = process.env.NODE_V8_COVERAGE;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
import assert from "node:assert/strict";
import { mock } from "node:test";
const original = new Error("private failure detail");
const recoveryId = "host-operation.OP-123456";
/**
 * 元Errorだけを合成の回復参照へ結合する。
 * @responsibility Error本文のコピーから回復参照を再発行しない有限代役を作る。
 * @trace PRL-UT-014
 * @precondition originalとrecoveryIdはこの子Processだけが所有する。
 * @stimulus 元Error又は同文の別Errorを渡す。
 * @observation strict identity一致時だけ回復結果を返す。
 * @oracle 元Errorの回復参照がCLIへ伝わり、コピーには公開されない。
 * @cleanup 子Process終了で局所値を破棄する。
 * @boundary PRL-UT-014=Direct Boundary: 診断とCLI結果投影の有限代役。
 */
const classifyOwnedCoordinatorOperationCreationFailure = error => error === original
  ? { cleanupConfirmed: false, hostRecoveryId: recoveryId } : null;
${declarations}
const actualDiagnostics = await import(${JSON.stringify(diagnostics)});
mock.module(${JSON.stringify(diagnostics)}, { namedExports: {
  ...actualDiagnostics,
  classifyDoctorOperationInitializationFailure,
  projectDoctorOperationCreationFailure,
} });
const report = await import(${JSON.stringify(report)});
let projected;
try { projectDoctorOperationCreationFailure(original); }
catch (error) { projected = error; }
assert.ok(projected instanceof Error);
const rendered = report.renderDoctorCommandFailure(projected);
assert.deepEqual(JSON.parse(rendered.json), { status: "blocked",
  reason: "doctor_operation_initialization_cleanup_unknown",
  manualRecoveryRequired: true, hostRecoveryId: recoveryId });
assert.ok(rendered.human.includes(recoveryId));
assert.equal(rendered.json.includes(original.message), false);
const copy = report.renderDoctorCommandFailure(new Error(projected.message));
assert.equal(Object.hasOwn(JSON.parse(copy.json), "hostRecoveryId"), false);
`,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      // 模擬Moduleの評価を製品Sourceの計測には混ぜない。
      env: { ...process.env, NODE_V8_COVERAGE: "" },
    },
  );
  assert.equal(process.env.NODE_V8_COVERAGE, parentCoverage);
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
});
