/**
 * 合成Probeの公開入口・保存順序・取消・回収を有限DIで確認する。
 * @responsibility 技術結果と上位保存を混同せず、失敗後の余計なEffectを反証する。
 * @trace ARCH-000008
 * @level UT
 * @scope 実AI・Docker・Filesystem処置は実行しない。
 * @boundary 既存createExecutor→固定Probe→DI代役。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import fs from "node:fs";
import { types } from "node:util";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import * as original from "../../../docker-isolation/src/index.ts";

/**
 * 有限DIに対し通常・不明・保存拒否・取消を同じ本体へ与える。
 * @responsibility 実IDの保持と補償清掃を直接観測する。
 * @trace ARCH-000008
 * @precondition DI Moduleだけを置換し公開入口を使う。
 * @stimulus Intent／Receipt失敗、作成不明、終了不明、取消、所在変更。
 * @observation 実行順、元実ID、清掃回数、completion。
 * @oracle 保存失敗の次Startは0、既知実IDだけ清掃、不明を成功へ畳まない。
 * @cleanup mock解除と有限Promiseの確定。外部資源なし。
 * @boundary 公開Factoryと技術Lifecycle。
 */
test("固定Probeは既存入口で保存順序・取消・実ID回収を維持する", async () => {
  const id = "a".repeat(64);
  const probeId = "12345678-1234-4234-8234-123456789abc";
  const binding = Object.freeze({});
  const paths = Object.freeze({
    workspace: "workspace",
    providerHome: "home",
    tmp: "tmp",
  });
  const expected = original.describeDockerProbeConfiguration(
    "normal",
    { id, probeId },
    paths,
  );
  const correlationFailures: string[] = [];
  const check = (label: string, actual: unknown, expected: unknown) => {
    try {
      if (label === "binding") assert.equal(actual, expected);
      else
        assert.deepEqual(
          JSON.parse(JSON.stringify(actual)),
          JSON.parse(JSON.stringify(expected)),
        );
    } catch (error) {
      correlationFailures.push(label);
      throw error;
    }
  };
  const events: string[] = [];
  let mode = "normal",
    changed = false;
  let cancel: () => void = () => undefined;
  const facts = original.classifyDockerProbeExecution(
    { status: 7, stdout: "", stderr: "", signal: null },
    1,
  );
  const dependencies = {
    ...original,
    createDockerProbeRuntimeBinding: (read: () => string) => {
      assert.equal(read(), "management");
      return binding;
    },
    observeDockerProbeEngine: (actual: unknown) => {
      assert.equal(actual, binding);
      return mode !== "engine";
    },
    createDockerProbeContainer: (
      actual: unknown,
      profile: string,
      selectedId: string,
      mounts: unknown,
    ) => {
      check("binding", actual, binding);
      check("profile", profile, "normal");
      check("probe", selectedId, probeId);
      check("mount", mounts, paths);
      events.push("create");
      return mode === "unknown"
        ? { status: "blocked" }
        : { status: "confirmed", id };
    },
    describeDockerProbeConfiguration: (
      profile: "normal",
      identity: { id: string; probeId: string },
      mounts: unknown,
    ) => {
      check("profile", profile, "normal");
      check("identity", identity, { id, probeId });
      check("mount", mounts, paths);
      return original.describeDockerProbeConfiguration(
        profile,
        JSON.parse(JSON.stringify(identity)),
        JSON.parse(JSON.stringify(mounts)),
      );
    },
    inspectDockerProbeContainer: (actual: unknown, configuration: unknown) => {
      check("binding", actual, binding);
      check("configuration", configuration, expected);
      events.push("inspect");
      return mode !== "inspect";
    },
    runDockerProbeAsync: async (
      actualBinding: unknown,
      profile: string,
      actual: string,
      signal: AbortSignal,
    ) => {
      check("binding", actualBinding, binding);
      check("profile", profile, "normal");
      check("id", actual, id);
      events.push("run");
      if (mode === "cancel") {
        cancel();
        cancel();
      }
      if (mode === "changed") changed = true;
      return {
        facts,
        cancelled: signal.aborted,
        processCompletionConfirmed: mode !== "close",
      };
    },
    cleanupDockerProbeContainer: (
      actualBinding: unknown,
      configuration: unknown,
    ) => {
      check("binding", actualBinding, binding);
      check("configuration", configuration, expected);
      events.push("cleanup");
      return {
        confirmed: mode !== "cleanup",
        reason: "docker_probe_cleanup_failed",
      };
    },
  };
  const lower = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    { namedExports: dependencies },
  );
  try {
    const { createExecutor } = await import("../../src/index.ts");
    for (mode of [
      "normal",
      "intent",
      "receipt",
      "promise",
      "unknown",
      "engine",
      "inspect",
      "close",
      "cleanup",
      "cancel",
      "changed",
    ]) {
      events.length = 0;
      changed = false;
      const executor = createExecutor(
        {
          kind: "isolation_probe",
          probeId: "12345678-1234-4234-8234-123456789abc",
        },
        {
          readMounts: () => ({
            management: "management",
            workspace: changed ? "other" : "workspace",
            providerHome: "home",
            tmp: "tmp",
          }),
        },
      );
      assert.ok(executor);
      cancel = () => executor.cancel();
      const start = executor.start({
        onSubmitting: () => {
          events.push("intent");
          if (mode === "intent") throw Error("save");
        },
        onCreated: () => {
          events.push("receipt");
          if (mode === "receipt") throw Error("save");
          if (mode === "promise")
            return Promise.reject(Error("reject")) as never;
        },
      });
      const result = await start.completion;
      assert.throws(() => executor.start(), /already_started/u);
      if (["receipt", "promise", "inspect"].includes(mode))
        assert.deepEqual(
          events,
          mode === "inspect"
            ? ["intent", "create", "receipt", "inspect", "cleanup"]
            : ["intent", "create", "receipt", "cleanup"],
        );
      if (mode === "intent") assert.deepEqual(events, ["intent"]);
      if (mode === "unknown") {
        assert.equal(result.containerId, null);
        assert.equal(result.cleanupConfirmed, false);
        assert.deepEqual(events, ["intent", "create"]);
      }
      if (["close", "changed"].includes(mode)) {
        assert.equal(events.includes("cleanup"), false);
        assert.equal(result.cleanupConfirmed, false);
      }
      if (mode === "cleanup") assert.equal(result.cleanupConfirmed, false);
      if (mode === "cancel") {
        assert.equal(result.cancelled, true);
        assert.equal(result.cleanupConfirmed, true);
      }
      if (mode === "normal")
        assert.deepEqual(events, [
          "intent",
          "create",
          "receipt",
          "inspect",
          "run",
          "cleanup",
        ]);
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(correlationFailures, []);
    mode = "normal";
    changed = false;
    const source = fs.readFileSync(
      new URL("../../src/probe/execute.ts", import.meta.url),
      "utf8",
    );
    const declaration = sourceDeclaration(source, "createIsolationProbe");
    const helpers =
      sourceDeclaration(source, "captureMounts") +
      "\n" +
      sourceDeclaration(source, "notify");
    const baseline = runInNewContext(
      `${helpers}\n${declaration};createIsolationProbe`,
      { ...dependencies, types, AbortController },
    );
    const baselineExecutor = baseline(
      { kind: "isolation_probe", probeId },
      { readMounts: () => ({ management: "management", ...paths }) },
    );
    const baselineResult = await baselineExecutor.start().completion;
    assert.equal(baselineResult.facts, facts);
    assert.equal(baselineResult.cleanupConfirmed, true);
    assert.deepEqual(correlationFailures, []);
    const variants = [
      [
        "binding",
        "createDockerProbeContainer(cli, profile, probeId, {",
        "createDockerProbeContainer({}, profile, probeId, {",
      ],
      [
        "profile",
        "createDockerProbeContainer(cli, profile, probeId, {",
        "createDockerProbeContainer(cli, 'timeout', probeId, {",
      ],
      [
        "probe",
        "createDockerProbeContainer(cli, profile, probeId, {",
        "createDockerProbeContainer(cli, profile, 'other', {",
      ],
      ["mount", "workspace: mounts.workspace,", "workspace: 'other',"],
      [
        "id",
        "containerId,\n              controller.signal",
        "'b'.repeat(64),\n              controller.signal",
      ],
    ];
    for (const [label, needle, replacement] of variants) {
      assert.ok(label && needle && replacement);
      assert.ok(declaration.includes(needle), label);
      const failuresBefore: number = correlationFailures.length;
      const create = runInNewContext(
        `${helpers}\n${declaration.replace(needle, replacement)};createIsolationProbe`,
        { ...dependencies, types, AbortController },
      );
      const candidate = create(
        { kind: "isolation_probe", probeId },
        { readMounts: () => ({ management: "management", ...paths }) },
      );
      assert.ok(candidate);
      const result = await candidate.start().completion;
      assert.equal(correlationFailures.at(-1), label);
      assert.equal(correlationFailures.length, failuresBefore + 1);
      assert.ok(
        result.facts !== facts || result.cleanupConfirmed !== true,
        label,
      );
    }
  } finally {
    lower.restore();
  }
});
