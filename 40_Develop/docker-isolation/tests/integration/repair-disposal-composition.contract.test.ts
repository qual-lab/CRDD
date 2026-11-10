/**
 * 修復後の観測・廃棄を実compositionと実codecで確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 公式CLI・Native・実Filesystemは使用せず、固定Directory処理だけ模擬する。
 * @boundary 実compositionから固定Directory factoryへの接続。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { types } from "node:util";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  decodeDockerRuntimeRepairCheckpoint,
  dockerRuntimeRepairCheckpointIsSettled,
} from "../../../domain-model/src/index.ts";

const source = stripTypeScriptTypes(
  fs.readFileSync(
    new URL("../../src/docker-desktop/repair-session.ts", import.meta.url),
    "utf8",
  ),
)
  .replace(/^import[\s\S]*?;\r?\n/gmu, "")
  .replace(/^export /gmu, "");
const purposes = ["primary", "failed", "auxiliary"] as const;
const raw = {
  actions: Object.fromEntries(
    [
      "stop_runtime",
      "stop_backend",
      "retain_runtime",
      "start_runtime",
      "stop_failed_runtime",
      "retain_failed_runtime",
      "retain_auxiliary_runtime",
      "restart_runtime",
    ].map((name) => [
      name,
      {
        intent: "saved",
        request: name.startsWith("retain_") ? "issued" : "not_issued",
        result: name.startsWith("retain_") ? "confirmed" : "not_required",
      },
    ]),
  ),
  directories: Object.fromEntries(
    purposes.map((purpose, index) => {
      const identity = { dev: "1", ino: String(index + 2), birthtimeNs: "3" };
      return [
        purpose,
        {
          expected: identity,
          source: { state: "absent", identity: null },
          retained: { state: "present", identity },
        },
      ];
    }),
  ),
  engine: "ready",
  stale: "retained",
  hostSafety: "safe",
  cleanup: "confirmed",
  cleanupFailure: null,
};

/** 失効、取消、異なる実体、部分処置を全体成功へ補完しない。実Docker要求0。 */
for (const scenario of [
  "normal",
  "factory",
  "cleanup",
  "host",
  "engine",
  "unsettled",
  "cancel",
  "denied",
  "throw",
  "promise",
  "reject",
  "changed",
  "second_unknown",
  "partial",
  "driver_throw",
  "after_cancel",
  "after_denied",
  "after_changed",
  "legacy",
]) {
  test("修復後の固定対象観測・廃棄: " + scenario, async () => {
    assert.ok(decodeDockerRuntimeRepairCheckpoint(raw));
    const controller = new AbortController();
    let allowed = true,
      current = true,
      reads = 0,
      disposals = 0;
    const checkpoint = structuredClone(raw);
    if (scenario === "cleanup") checkpoint.cleanup = "unknown";
    if (scenario === "host") checkpoint.hostSafety = "unknown";
    if (scenario === "engine") checkpoint.engine = "unknown";
    if (scenario === "unsettled")
      checkpoint.actions.restart_runtime = {
        intent: "saved",
        request: "unknown",
        result: "unknown",
      };
    if (scenario === "cancel") controller.abort();
    const confirm = () => {
      if (scenario === "throw") throw new Error("denied");
      if (scenario === "promise") return Promise.resolve(true);
      if (scenario === "reject") return Promise.reject(new Error("denied"));
      return scenario !== "denied" && allowed;
    };
    const functions = runInNewContext(
      source +
        "; ({ inspect: observeRepairDirectories, cleanup: cleanupRepairDirectory })",
      {
        types,
        AbortSignal,
        Object,
        Promise,
        captureIsolationSettings: (settings: unknown) => settings,
        decodeRepairCheckpoint: decodeDockerRuntimeRepairCheckpoint,
        isRepairCheckpointSettled: dockerRuntimeRepairCheckpointIsSettled,
        createDockerDesktopRepairDirectoryAccess(local: string, nonce: string) {
          assert.equal(local, "fixed-local");
          assert.equal(nonce, "a".repeat(64));
          if (scenario === "factory") return null;
          return {
            verify: () => scenario !== "changed" && current,
            observe(purpose: string) {
              reads++;
              const key = purpose === "initial" ? "primary" : purpose;
              const expected = raw.directories[key]?.expected;
              if (scenario === "second_unknown" && reads > 3) return null;
              return {
                source: { state: "confirmed_absent", identity: null },
                retained: { state: "present", identity: expected },
              };
            },
            async dispose(
              _purpose: string,
              _expected: unknown,
              boundary: () => boolean,
            ) {
              disposals++;
              await Promise.resolve();
              if (scenario === "after_cancel") controller.abort();
              if (scenario === "after_denied") allowed = false;
              if (scenario === "after_changed") current = false;
              if (scenario === "driver_throw") throw new Error("partial");
              return {
                request: "issued",
                absence:
                  boundary() && scenario !== "partial"
                    ? "confirmed_absent"
                    : "unknown",
              };
            },
          };
        },
      },
    ) as {
      inspect(input: unknown, settings: unknown): unknown;
      cleanup(
        input: unknown,
        settings: unknown,
      ): Promise<{ request: string; absence: string }>;
    };
    const input = {
      operationNonce: "a".repeat(64),
      checkpoint,
      signal: controller.signal,
      ...(scenario === "legacy" ? { ownerBindingSha256: "b".repeat(64) } : {}),
    };
    const settings = { desktop: { userDataDirectory: "fixed-local" } };
    const before = JSON.stringify(checkpoint);
    const inspection = functions.inspect(
      { ...input, canObserve: confirm },
      settings,
    );
    const blocked = [
      "factory",
      "cleanup",
      "host",
      "engine",
      "unsettled",
      "cancel",
      "denied",
      "throw",
      "promise",
      "reject",
      "changed",
      "legacy",
    ].includes(scenario);
    assert.equal(
      inspection !== null,
      !blocked && scenario !== "second_unknown",
    );
    const cleanup = await functions.cleanup(
      { ...input, purpose: "primary", canIssueEffect: confirm },
      settings,
    );
    assert.equal(disposals, blocked && scenario !== "changed" ? 0 : 1);
    assert.equal(
      cleanup.absence === "confirmed_absent",
      !blocked &&
        ![
          "partial",
          "driver_throw",
          "after_cancel",
          "after_denied",
          "after_changed",
        ].includes(scenario),
    );
    if (scenario === "driver_throw") assert.equal(cleanup.request, "unknown");
    assert.equal(JSON.stringify(checkpoint), before);
  });
}
