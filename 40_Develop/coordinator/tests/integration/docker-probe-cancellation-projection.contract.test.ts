/**
 * Probe通知の同期保存と、取消・回収を誤って成功にしない接続を検証する。
 * @packageDocumentation
 * @responsibility 現行の通知二段階、実ID、終端観測と公開結果の相関を確認する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実試験Callerの関数本文と、DI・保存・物理処置の有限代役。
 * @boundary メモリ内の接続確認。実Docker・実AIは使わない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { classifyDockerProbeCancellation } from "../../../docker-isolation/tests/support/probe-result.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";

const source = fs.readFileSync(
  new URL("../support/probe-verification.ts", import.meta.url),
  "utf8",
);
const helpers = [
  "isolationProbeIsObject",
  "isolationProbeOwnValue",
  "ownString",
  "isolationProbeErrorMessage",
  "cancellationBlocked",
  "normalizeCancellationFailure",
  "normalizeFailure",
  "createProbeRecording",
  "saveProbeAbsence",
]
  .map((name) => sourceDeclaration(source, name))
  .join("\n");

const scenarioKinds = [
  "success",
  "candidate-blocked",
  "post-missing",
  "attach-missing",
  "host-missing",
  "cleanup-failed",
  "wrong-absence-id",
  "run-throw",
  "save-id-failed",
  "save-submission-failed",
  "compound",
  "compound-cleanup",
  "start-failed",
] as const;
type Scenario = (typeof scenarioKinds)[number];
type Result = Readonly<{
  status: string;
  reason: string;
  recoveryId: string | null;
  containerAbsenceVerified?: boolean;
  hostCleanupVerified?: boolean;
  retainOperationDirectories?: boolean;
  attachProcessTerminationObserved?: boolean;
  cancellationAcknowledged?: boolean;
  processTerminationObserved?: boolean;
  graceElapsedMs?: number | null;
  diagnosticDockerContainerEffectIssued: boolean;
  containerRunning?: boolean;
  runtimeAuthorityIssued: boolean;
  operationCapabilityIssued: boolean;
  realProviderReadiness: boolean;
}>;

/**
 * 旧Registryではなく現行通知を起点に同じIDで保存・起動・回収を試験する。
 * @trace ERB-IT-004
 * @precondition 実Caller本文と合成されたDI通知のみを使う。
 * @stimulus 各段階で単発の故障、対象差又は部分完了を注入する。
 * @oracle 記録された順序と元の対象が一致した場合だけ成功を許す。
 * @cleanup メモリだけを使う。
 * @boundary DI代役の内側では実資源を生成しない。
 */
function probeFixture(
  scenario: Scenario,
  entry: string,
  body = sourceDeclaration(source, entry),
) {
  const calls: string[] = [];
  const id = "a".repeat(64),
    otherId = "b".repeat(64);
  const probeId = "probe-123";
  const recoveryId = "host-operation.OP-123456";
  const owner = {},
    mount = {},
    context = {},
    management = {},
    cli = {};
  const yes = Object.freeze({ id, probeId });
  const mounts = Object.freeze({
    workspace: path.resolve("fixture/workspace"),
    providerHome: path.resolve("fixture/home"),
    tmp: path.resolve("fixture/tmp"),
    management: path.resolve("fixture/management"),
  });
  const snapshot = (dockerId: string | null) => ({
    resources: [{ key: "probe", identity: { dockerId } }],
  });
  const target = (dockerId: string | null) => ({
    managementDirectory: mounts.management,
    unreceiptedAbsence: "retain",
    resources: snapshot(dockerId),
    previouslyAbsent: [],
  });
  let book: { snapshot: ReturnType<typeof snapshot> } | null = null;
  let cleaned = false;
  const checkTarget = (
    binding: unknown,
    identity: unknown,
    actualMounts: unknown,
  ) => {
    assert.equal(binding, cli);
    assert.deepEqual(JSON.parse(JSON.stringify(identity)), yes);
    assert.equal(actualMounts, mounts);
  };
  const run = runInNewContext(helpers + "\n" + body + "\n" + entry, {
    Error,
    randomUUID: () => probeId,
    getOwnedHostRecoveryId: (value: unknown) => {
      assert.equal(value, owner);
      return recoveryId;
    },
    createOwnedMountCapability: (value: unknown) => {
      assert.equal(value, owner);
      return mount;
    },
    createOwnedOperationContextCapability: (value: unknown) => {
      assert.equal(value, owner);
      return context;
    },
    createOwnedOperationManagementCapability: (
      actualContext: unknown,
      actualMount: unknown,
    ) => {
      assert.equal(actualContext, context);
      assert.equal(actualMount, mount);
      return management;
    },
    verifyOwnedMountCapability: (value: unknown) => {
      assert.equal(value, mount);
      return mounts;
    },
    createDockerProbeRuntimeBinding: (dir: unknown, actual: unknown) => {
      assert.equal(dir, mounts.management);
      assert.equal(actual, mounts);
      return cli;
    },
    observeDockerProbeEngine: (binding: unknown) => {
      assert.equal(binding, cli);
      calls.push("engine");
      return true;
    },
    createDockerProbeContainer: (
      binding: unknown,
      profile: string,
      actualProbeId: string,
      actualMounts: unknown,
      notices: {
        managementDirectory: string;
        onSubmitting: (value: object) => void;
        onCreated: (id: string, value: object) => void;
      },
    ) => {
      assert.equal(binding, cli);
      assert.equal(profile, "cancellation");
      assert.equal(actualProbeId, probeId);
      assert.equal(actualMounts, mounts);
      assert.equal(notices.managementDirectory, mounts.management);
      notices.onSubmitting(target(null));
      calls.push("create");
      notices.onCreated(id, target(id));
      return { status: "confirmed", id };
    },
    readOwnedHostOperation: (value: unknown) => {
      assert.equal(value, management);
      return {
        record: {
          resources:
            cleaned && scenario === "wrong-absence-id"
              ? { snapshot: snapshot(otherId) }
              : book,
        },
        payloadSha256: "state-hash",
      };
    },
    applyResourceEvent: (
      actual: unknown,
      event: {
        event: string;
        key: string;
        snapshot: ReturnType<typeof snapshot>;
        cleanup: { unreceiptedAbsence: string };
      },
    ) => {
      assert.equal(actual, book);
      assert.equal(event.key, "probe");
      assert.equal(event.cleanup.unreceiptedAbsence, "retain");
      if (event.event === "submission") {
        calls.push("save-submission");
        assert.deepEqual(event.snapshot, snapshot(null));
        if (scenario === "save-submission-failed") return null;
      } else {
        assert.equal(event.event, "receipt");
        calls.push("save-receipt");
        assert.deepEqual(event.snapshot, snapshot(id));
        if (scenario === "save-id-failed") return null;
      }
      return { snapshot: event.snapshot };
    },
    recordOwnedHostResources: (
      value: unknown,
      next: NonNullable<typeof book>,
    ) => {
      assert.equal(value, management);
      book = next;
      calls.push("persist");
    },
    applyResourceCleanup: (
      value: unknown,
      actual: unknown,
      observations: unknown,
      correlation: unknown,
    ) => {
      assert.equal(value, book);
      assert.equal(actual, book?.snapshot);
      assert.deepEqual(JSON.parse(JSON.stringify(observations)), [
        { key: "probe", observation: "absent" },
      ]);
      assert.deepEqual(JSON.parse(JSON.stringify(correlation)), {
        recoveryId,
        previousPayloadSha256: "state-hash",
      });
      calls.push("save-absence");
      return { snapshot: actual };
    },
    runDockerProbeCancellation: async (
      ...args: [unknown, unknown, unknown]
    ) => {
      checkTarget(...args);
      calls.push("run");
      if (scenario === "run-throw")
        throw Error("owned_operation_mount_replaced");
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
      const compound =
        scenario === "compound" || scenario === "compound-cleanup";
      const blocked = scenario === "candidate-blocked" || compound;
      return {
        observation: exact,
        status: blocked ? "blocked" : "candidate",
        reason: blocked
          ? "dynamic_fake_provider_cancellation_acknowledgement_invalid"
          : exact.reason,
        postRunMountVerified: scenario !== "post-missing" && !compound,
        attachProcessTerminationObserved:
          scenario !== "attach-missing" && !compound,
        attachProcessTerminationRequestCount: 0,
      };
    },
    describeDockerProbeConfiguration: (
      profile: string,
      identity: unknown,
      actualMounts: unknown,
    ) => {
      assert.equal(profile, "cancellation");
      checkTarget(cli, identity, actualMounts);
      return yes;
    },
    cleanupDockerContainer: (binding: unknown, configuration: unknown) => {
      assert.equal(binding, cli);
      assert.equal(configuration, yes);
      calls.push("cleanup");
      if (scenario === "cleanup-failed" || scenario === "compound-cleanup")
        return { confirmed: false };
      cleaned = true;
      return { confirmed: true, reason: "docker_probe_absence_confirmed" };
    },
    cleanupOwnedOperationDirectories: (value: unknown) => {
      assert.equal(value, owner);
      calls.push("host-cleanup");
      if (scenario === "host-missing")
        throw Error("synthetic host cleanup failure");
    },
    startDockerProbeResidue: (...args: [unknown, unknown, unknown]) => {
      checkTarget(...args);
      calls.push("start");
      if (scenario === "start-failed") throw Error("synthetic start failure");
    },
  }) as (value: object) => Result | Promise<Result>;
  return { calls, recoveryId, run: () => run(owner) };
}

const recorded = [
  "engine",
  "save-submission",
  "persist",
  "create",
  "save-receipt",
  "persist",
];
const released = ["run", "cleanup", "save-absence", "persist", "host-cleanup"];

/**
 * 全条件成立と単独・複合の欠測を、取消結果へ結び付ける。
 * @trace ERB-IT-004
 * @oracle 終端不明・実ID不一致・作成後のReceipt保存失敗ではHostを清掃しない。作成前の保存失敗ではDockerへ要求せず、自己所有Hostだけを清掃する。
 */
test("取消事実は二保存・同対象absence・全終了条件を満たしてだけ公開verifiedになる", async () => {
  const expected = {
    success: released,
    "candidate-blocked": released,
    "post-missing": released,
    "attach-missing": ["run"],
    "host-missing": released,
    "cleanup-failed": ["run", "cleanup"],
    "wrong-absence-id": ["run", "cleanup"],
    "run-throw": ["run"],
    compound: ["run"],
    "compound-cleanup": ["run"],
  } as const;
  for (const [scenario, tail] of Object.entries(expected)) {
    const f = probeFixture(
      scenario as Scenario,
      "runDynamicFakeProviderCancellationVerification",
    );
    const result = await f.run();
    assert.deepEqual(f.calls, [...recorded, ...tail], scenario);
    assert.equal(
      result.status,
      scenario === "success" ? "verified" : "blocked",
      scenario,
    );
    const clean = tail === released && scenario !== "host-missing";
    assert.equal(result.recoveryId, clean ? null : f.recoveryId, scenario);
    assert.equal(result.hostCleanupVerified, clean, scenario);
    assert.equal(result.containerAbsenceVerified, clean, scenario);
    assert.equal(result.retainOperationDirectories, !clean, scenario);
    assert.equal(result.runtimeAuthorityIssued, false);
    assert.equal(result.operationCapabilityIssued, false);
    assert.equal(result.realProviderReadiness, false);
    if (scenario === "success") {
      assert.equal(
        result.reason,
        "dynamic_fake_provider_cancellation_verified",
      );
      assert.equal(result.graceElapsedMs, 11);
      assert.equal(result.cancellationAcknowledged, true);
      assert.equal(result.processTerminationObserved, true);
    }
    if (
      scenario === "attach-missing" ||
      scenario === "compound" ||
      scenario === "compound-cleanup"
    )
      assert.equal(result.attachProcessTerminationObserved, false);
    if (scenario === "candidate-blocked")
      assert.equal(
        result.reason,
        "dynamic_fake_provider_cancellation_acknowledgement_invalid",
      );
    if (scenario === "run-throw")
      assert.equal(result.reason, "owned_operation_mount_replaced");
  }
  for (const [scenario, calls, effect] of [
    [
      "save-submission-failed",
      ["engine", "save-submission", "host-cleanup"],
      false,
    ],
    ["save-id-failed", recorded.slice(0, -1), true],
  ] as const) {
    const f = probeFixture(
      scenario,
      "runDynamicFakeProviderCancellationVerification",
    );
    const result = await f.run();
    assert.deepEqual(f.calls, calls);
    assert.equal(result.status, "blocked");
    assert.equal(result.diagnosticDockerContainerEffectIssued, effect);
    assert.equal(result.recoveryId, effect ? f.recoveryId : null);
  }
});

/**
 * 保守試験用の稼働残存を、二保存後の同じ対象に限って開始する。
 * @trace ERB-IT-004
 * @oracle 保存拒否で起動せず、開始失敗では元の回復参照を保持する。
 */
test("稼働残存の上位Callerは二保存後の同対象を下位へ渡してreadyを返す", async () => {
  const entry = "createDynamicFakeProviderRecoverableResidue";
  for (const [scenario, calls, effect] of [
    ["success", [...recorded, "start"], true],
    [
      "save-submission-failed",
      ["engine", "save-submission", "host-cleanup"],
      false,
    ],
    ["save-id-failed", recorded.slice(0, -1), true],
    ["start-failed", [...recorded, "start"], true],
  ] as const) {
    const f = probeFixture(scenario, entry);
    const result = await f.run();
    assert.deepEqual(f.calls, calls);
    assert.equal(result.status, scenario === "success" ? "ready" : "blocked");
    assert.equal(result.containerRunning, scenario === "success");
    assert.equal(result.diagnosticDockerContainerEffectIssued, effect);
    assert.equal(result.recoveryId, effect ? f.recoveryId : null);
  }
  const body = sourceDeclaration(source, entry);
  for (const [needle, replacement] of [
    ["{ id: created.id, probeId }", "{ id: 'wrong', probeId }"],
    ["recording.current(),", "{ tmp: 'other' },"],
  ] as const) {
    // 別実IDを渡す変異はreadyを成立させない。mountの等価性も代役入口で固定する。
    assert.equal(body.split(needle).length, 2);
    const f = probeFixture("success", entry, body.replace(needle, replacement));
    assert.equal((await f.run()).status, "blocked");
  }
});
