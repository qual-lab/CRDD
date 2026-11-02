/**
 * 固定Probeの非同期attach・取消・期限・終端joinを確認する。
 * @responsibility 生出力を保存せず、既存判定への搬送とHandle終了条件を反証する。
 * @trace ARCH-000008
 * @level IT
 * @scope 実DI本文と有限Process代役。Docker・外部AIを使わない。
 * @boundary DI実行Owner→所有attach Handle。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { classifyDockerProbeExecution } from "../support/probe-result.ts";

/**
 * 実関数の待機と終了処置を同じ有限Handleで検査する。
 * @responsibility 取消要求・実行分類・close成立を分ける。
 * @trace ARCH-000008
 * @precondition 現行Sourceの二関数だけをVMへ抽出する。
 * @stimulus 通常、出力超過、期限、重複取消、終了不明、結果拒否。
 * @observation attach数、終端数、取消Listener、元分類。
 * @oracle 期限や上限の一次理由を保持し、join不明を成功にしない。
 * @cleanup 有限HandleをjoinしTimer・Listenerを解除する。外部資源なし。
 * @boundary 実非同期制御と合成Process結果。
 */
test("非同期Probeは元失敗と取消を保持し所有attachをjoinする", async () => {
  const source = fs.readFileSync(
    new URL("../support/probe.ts", import.meta.url),
    "utf8",
  );
  const declarations = ["awaitProbeObservation", "runDockerProbeAsync"]
    .map((name) => {
      const start = source.indexOf(`async function ${name}`),
        end = source.indexOf("\n}", start);
      assert.ok(start > 0 && end > start);
      return stripTypeScriptTypes(source.slice(start, end + 2));
    })
    .join("\n");
  const binding = Object.freeze({});
  const containerId = "a".repeat(64);
  for (const mode of [
    "normal",
    "output",
    "timeout",
    "cancel",
    "preabort",
    "close",
    "reject",
  ]) {
    const controller = new AbortController();
    let starts = 0,
      terminations = 0,
      joined: Promise<object | null> | null = null;
    let resolve: (value: object) => void = () => undefined;
    const execution = {
      status: 7,
      signal: null,
      stdout: "",
      stderr: "",
      outputExceeded: mode === "output",
    };
    const pending = new Promise<object>((done) => {
      resolve = done;
    });
    const run = runInNewContext(`${declarations};runDockerProbeAsync`, {
      setTimeout,
      clearTimeout,
      performance,
      classifyDockerProbeExecution,
      profileSpecification: () => ({ timeoutMs: 10 }),
      startDockerProbeAttachedProcess: (
        actualBinding: unknown,
        actualId: string,
        prefix: string,
      ) => {
        assert.equal(actualBinding, binding);
        assert.equal(actualId, containerId);
        assert.equal(prefix, "{");
        starts++;
        if (mode === "cancel")
          queueMicrotask(() => {
            controller.abort();
            controller.abort();
          });
        return {
          completion:
            mode === "timeout" || mode === "cancel"
              ? pending
              : mode === "reject"
                ? Promise.reject(Error("fixture-rejection"))
                : Promise.resolve(execution),
          terminateAndWait: () => {
            if (!joined) {
              terminations++;
              resolve(execution);
              joined = Promise.resolve(mode === "close" ? null : execution);
            }
            return joined;
          },
          isClosed: () => mode !== "close",
        };
      },
    });
    if (mode === "preabort") controller.abort();
    const promise = run(binding, "normal", containerId, controller.signal);
    if (mode === "preabort" || mode === "reject") {
      await assert.rejects(promise);
      assert.equal(starts, mode === "preabort" ? 0 : 1);
      assert.equal(terminations, mode === "preabort" ? 0 : 1);
    } else {
      const result = await promise;
      assert.equal(starts, 1);
      assert.equal(terminations, 1);
      assert.equal(result.processCompletionConfirmed, mode !== "close");
      assert.equal(result.cancelled, mode === "cancel");
      if (mode === "output")
        assert.equal(
          result.facts.isolation.reason,
          "docker_isolation_probe_output_too_large",
        );
      if (mode === "timeout")
        assert.equal(
          result.facts.isolation.reason,
          "docker_isolation_probe_timeout",
        );
    }
    const before = terminations;
    controller.abort();
    await Promise.resolve();
    assert.equal(terminations, before);
  }
});
