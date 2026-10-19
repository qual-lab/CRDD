/**
 * 修復終了後の回収・保持照合を固定技術境界へ接続して検証する。
 * @packageDocumentation
 * @responsibility 元Scope・終了条件・現在確認を回収と保持照合へ接続する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 実本文・実decoderと模擬Artifact／KnownFolder／factory。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: 固定composition→技術factory。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { types } from "node:util";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  dockerRuntimeRepairCheckpointIsSettled,
} from "../../src/desktop/repair-checkpoint.ts";

/**
 * 正常三用途と一軸拒否を同じ元checkpointへ適用する。
 * @responsibility 新Native Session取得や保存代役を真正保存と誤認しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 実composition本文・実decoder、全I/Oは模擬。
 * @stimulus 元Scope差、終了欠測、意図拒否、待機後失効、部分回収。
 * @observation factory材料、Driver件数、現在callback、元値全文。
 * @oracle 正常は固定一用途だけ。前提拒否はDriver0、部分結果を保全する。
 * @cleanup N/A: 実Filesystem・Repair Native・Docker・Provider要求0。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: compositionと模擬技術境界。
 */
test("修復回収compositionは元Scopeと保存後の現在許可だけを使用する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/desktop/repair-runtime.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf("export type DockerRuntimeRepairDisposalInput");
  assert.ok(begin > 0);
  const body = stripTypeScriptTypes(
    source.slice(begin).replace(/^export /gmu, ""),
  );
  const purposes = ["primary", "failed", "auxiliary"] as const;
  const raw = {
    actions: Object.fromEntries(
      [
        "stop_runtime",
        "terminate_runtime",
        "stop_backend",
        "retain_runtime",
        "start_runtime",
        "stop_failed_runtime",
        "retain_failed_runtime",
        "retain_auxiliary_runtime",
        "restart_runtime",
      ].map((name) => [
        name,
        { intent: "saved", request: "not_issued", result: "not_required" },
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
  assert.ok(decode(raw));
  for (const scenario of [
    "normal",
    "scope",
    "h",
    "nonce",
    "artifact_missing",
    "artifact_changed",
    "artifact_after_wait",
    "local_missing",
    "local_changed",
    "factory_missing",
    "cleanup",
    "host",
    "engine",
    "not_settled",
    "cancel_before",
    "cancel_during",
    "owner_false",
    "owner_throw",
    "owner_promise",
    "owner_reject",
    "owner_after_wait",
    "partial",
    "driver_throw",
    "absent",
  ]) {
    for (const purpose of scenario === "normal"
      ? purposes
      : (["primary"] as const)) {
      const controller = new AbortController();
      if (scenario === "cancel_before") controller.abort();
      const checkpoint = structuredClone(raw);
      if (scenario === "cleanup") checkpoint.cleanup = "unknown";
      if (scenario === "host") checkpoint.hostSafety = "unknown";
      if (scenario === "engine") checkpoint.engine = "unknown";
      if (scenario === "not_settled")
        checkpoint.actions.restart_runtime = {
          intent: "saved",
          request: "unknown",
          result: "unknown",
        };
      assert.ok(decode(checkpoint), scenario);
      const before = JSON.stringify(checkpoint);
      let driver = 0,
        acquired = 0,
        calls = 0,
        allowed = true,
        artifactCurrent = true;
      const run = runInNewContext(
        `${body}; disposeDockerRuntimeRepairDirectory`,
        {
          Object,
          Buffer,
          Promise,
          AbortSignal,
          types,
          decode,
          dockerRuntimeRepairCheckpointIsSettled,
          dockerDesktopDistributionRoot: "fixed-distribution",
          beginPlatformAccessArtifactObservation: (root: string) => {
            assert.equal(root, "fixed-distribution");
            return scenario === "artifact_missing"
              ? null
              : {
                  token: {},
                  artifact: {
                    sha256:
                      scenario === "artifact_changed"
                        ? "e".repeat(64)
                        : "d".repeat(64),
                  },
                };
          },
          verifyPlatformAccessArtifactObservation: () =>
            scenario !== "artifact_changed" && artifactCurrent,
          observeWindowsLocalAppDataDirectory: () =>
            scenario === "local_missing"
              ? null
              : scenario === "local_changed"
                ? "changed-local"
                : "fixed-local",
          acquireRuntimeOwnedDockerDesktopRepairNativeHelper: () => {
            acquired++;
            throw new Error("must_not_acquire");
          },
          createDockerDesktopRepairDirectoryAccess: (
            local: string,
            nonce: string,
            owner: string,
            artifact: string,
          ) => {
            if (scenario === "factory_missing") return null;
            const matched =
              local === "fixed-local" &&
              nonce === "a".repeat(64) &&
              owner === "b".repeat(64) &&
              artifact === "d".repeat(64);
            return {
              scopeSha256: matched ? "c".repeat(64) : "f".repeat(64),
              dispose: async (
                actualPurpose: string,
                expected: unknown,
                boundary: () => boolean,
              ) => {
                driver++;
                assert.equal(
                  actualPurpose,
                  purpose === "primary" ? "initial" : purpose,
                );
                assert.deepEqual(expected, raw.directories[purpose]?.expected);
                await Promise.resolve();
                if (scenario === "cancel_during") controller.abort();
                if (scenario === "owner_after_wait") allowed = false;
                if (scenario === "artifact_after_wait") artifactCurrent = false;
                if (scenario === "driver_throw")
                  throw new Error("fixture_after_handoff");
                return boundary()
                  ? {
                      request: scenario === "absent" ? "not_issued" : "issued",
                      absence:
                        scenario === "partial" ? "unknown" : "confirmed_absent",
                    }
                  : { request: "not_issued", absence: "unknown" };
              },
            };
          },
        },
      ) as (value: unknown) => Promise<unknown>;
      const result = await run({
        operationNonce: (scenario === "nonce" ? "e" : "a").repeat(64),
        ownerBindingSha256: (scenario === "h" ? "e" : "b").repeat(64),
        scopeSha256: (scenario === "scope" ? "e" : "c").repeat(64),
        checkpoint,
        purpose,
        signal: controller.signal,
        canIssueEffect: () => {
          calls++;
          if (scenario === "owner_throw") throw new Error("fixture_owner");
          if (scenario === "owner_promise") return Promise.resolve(true);
          if (scenario === "owner_reject")
            return Promise.reject(new Error("fixture_owner"));
          return scenario !== "owner_false" && allowed;
        },
      });
      const reached = [
        "normal",
        "cancel_during",
        "owner_after_wait",
        "partial",
        "artifact_after_wait",
        "driver_throw",
        "absent",
      ].includes(scenario);
      const settled = ["normal", "absent"].includes(scenario);
      assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        {
          request:
            scenario === "driver_throw"
              ? "unknown"
              : ["normal", "partial"].includes(scenario)
                ? "issued"
                : "not_issued",
          absence: settled ? "confirmed_absent" : "unknown",
        },
        scenario,
      );
      assert.equal(driver, reached ? 1 : 0, scenario);
      assert.equal(acquired, 0, scenario);
      assert.equal(JSON.stringify(checkpoint), before, scenario);
      if (scenario === "normal") assert.ok(calls >= 3);
    }
  }
});

/**
 * 固定保持先の二読取りを元checkpointと照合する。
 * @responsibility 元保持物の消失と元から対象なしを混同しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 実本文・実decoder、Artifact／KnownFolder／Directoryだけ模擬。
 * @stimulus 実体・用途・処置tuple・二読取り・現在確認の一軸差。
 * @observation 固定六読取り、全三用途の独立期待、凍結と入力不変。
 * @oracle 共同成立時だけ全体receipt。不明・差は全体null、追加処置0。
 * @cleanup N/A: 実Filesystem・Native・Docker要求0。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: 固定読取り→模擬技術factory。
 */
test("保持照合は三固定対象の二読取りだけを返す", async () => {
  const source = fs.readFileSync(
    new URL("../../src/desktop/repair-runtime.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function observeDockerRuntimeRepairRetention",
  );
  assert.ok(begin > 0);
  const body = stripTypeScriptTypes(
    source.slice(begin).replace(/^export /gmu, ""),
  );
  const purposes = ["primary", "failed", "auxiliary"] as const;
  const identities = {
    primary: { dev: "1", ino: "2", birthtimeNs: "3" },
    failed: { dev: "1", ino: "4", birthtimeNs: "3" },
    auxiliary: { dev: "1", ino: "5", birthtimeNs: "3" },
  };
  for (const scenario of [
    "normal",
    "source_present",
    "absent_null",
    "absent_expected",
    "saved_absent",
    "scope",
    "nonce",
    "owner_binding",
    "artifact_binding",
    "local",
    "artifact_missing",
    "cancel_before",
    "owner_false",
    "owner_throw",
    "owner_promise",
    "owner_reject",
    "not_settled",
    "present_not_required",
    "present_not_saved",
    "absent_unknown",
    "fresh_absent",
    "fresh_unknown",
    "fresh_null",
    "fresh_other",
    "swapped",
    "second_absent",
    "second_unknown",
    "second_other",
    "null_present",
    "last_target",
    "scope_after",
    "artifact_after",
    "owner_after",
    "cancel_after",
    "purpose_mutant",
    "expected_null_mutant",
    "final_owner",
    "final_artifact",
    "final_scope",
    "final_cancel",
    "final_owner_mutant",
    "final_artifact_mutant",
    "final_scope_mutant",
    "final_cancel_mutant",
  ]) {
    const absent = [
      "absent_null",
      "absent_expected",
      "saved_absent",
      "null_present",
      "expected_null_mutant",
      "absent_unknown",
    ].includes(scenario);
    const checkpoint = {
      actions: Object.fromEntries(
        [
          "stop_runtime",
          "terminate_runtime",
          "stop_backend",
          "retain_runtime",
          "start_runtime",
          "stop_failed_runtime",
          "retain_failed_runtime",
          "retain_auxiliary_runtime",
          "restart_runtime",
        ].map((name) => [
          name,
          name.startsWith("retain_")
            ? { intent: "saved", request: "issued", result: "confirmed" }
            : {
                intent: "not_saved",
                request: "not_issued",
                result: "not_required",
              },
        ]),
      ),
      directories: Object.fromEntries(
        purposes.map((purpose) => [
          purpose,
          {
            expected: identities[purpose] as typeof identities.primary | null,
            source: {
              state: "absent",
              identity: null as typeof identities.primary | null,
            },
            retained: {
              state: "present",
              identity: identities[purpose] as typeof identities.primary | null,
            },
          },
        ]),
      ),
      engine: "ready",
      stale: "retained",
      hostSafety: "safe",
      cleanup: "confirmed",
      cleanupFailure: null,
    };
    if (absent) {
      checkpoint.actions.retain_failed_runtime = {
        intent: scenario === "saved_absent" ? "saved" : "not_saved",
        request: "not_issued",
        result: "not_required",
      };
      checkpoint.directories.failed = {
        expected: scenario === "absent_null" ? null : identities.failed,
        source: { state: "present", identity: identities.failed },
        retained: { state: "absent", identity: null },
      };
      if (scenario === "absent_null")
        checkpoint.directories.failed.source = {
          state: "absent",
          identity: null,
        };
    }
    if (scenario === "not_settled" || scenario === "absent_unknown")
      checkpoint.actions.restart_runtime = {
        intent: "saved",
        request: "unknown",
        result: "unknown",
      };
    if (scenario === "present_not_required" || scenario === "present_not_saved")
      checkpoint.actions.retain_runtime = {
        intent: scenario === "present_not_saved" ? "not_saved" : "saved",
        request: "not_issued",
        result: "not_required",
      };
    assert.ok(decode(checkpoint), scenario);
    const before = JSON.stringify(checkpoint);
    assert.equal(Object.isFrozen(checkpoint), false);
    for (const pair of Object.values(checkpoint.directories)) {
      if (pair.expected) assert.equal(Object.isFrozen(pair.expected), false);
      if (pair.retained.identity)
        assert.equal(Object.isFrozen(pair.retained.identity), false);
    }
    const controller = new AbortController();
    if (scenario === "cancel_before") controller.abort();
    let allowed = true,
      artifact = true,
      scope = true,
      reads = 0,
      native = 0,
      effects = 0;
    const calls: string[] = [];
    let candidateBody = body;
    if (scenario === "purpose_mutant") {
      const needle = 'purpose === "primary" ? "initial" : purpose';
      assert.ok(candidateBody.includes(needle));
      candidateBody = candidateBody.replace(
        needle,
        'purpose === "primary" ? "failed" : purpose',
      );
    }
    if (scenario === "expected_null_mutant") {
      const needle = 'pair.retained.state !== "absent"';
      assert.ok(candidateBody.includes(needle));
      candidateBody = candidateBody.replace(
        needle,
        `${needle} || pair.expected !== null`,
      );
    }
    if (scenario.startsWith("final_") && scenario.endsWith("_mutant")) {
      const key = scenario.split("_")[1] as
        | "owner"
        | "artifact"
        | "scope"
        | "cancel";
      const guards = {
        owner: "!confirmRepair(fields.canObserve)",
        artifact: "!verifyPlatformAccessArtifactObservation(artifact.token)",
        scope: "!access.verify()",
        cancel: "signal.aborted",
      };
      const start = candidateBody.indexOf("const observed = access.observe(");
      const end = candidateBody.indexOf(
        'if (pair.retained.state === "present")',
        start,
      );
      assert.ok(start > 0 && end > start);
      const post = candidateBody.slice(start, end);
      assert.equal(post.split(guards[key]).length - 1, 1);
      candidateBody =
        candidateBody.slice(0, start) +
        post.replace(guards[key], "false") +
        candidateBody.slice(end);
    }
    const run = runInNewContext(
      `${candidateBody}; observeDockerRuntimeRepairRetention`,
      {
        Object,
        Buffer,
        Promise,
        AbortSignal,
        types,
        decode,
        dockerRuntimeRepairCheckpointIsSettled,
        dockerDesktopDistributionRoot: "fixed-distribution",
        beginPlatformAccessArtifactObservation: () =>
          scenario === "artifact_missing"
            ? null
            : { artifact: { sha256: "d".repeat(64) }, token: {} },
        verifyPlatformAccessArtifactObservation: () => artifact,
        observeWindowsLocalAppDataDirectory: () =>
          scenario === "local" ? null : "fixed-local",
        acquireRuntimeOwnedDockerDesktopRepairNativeHelper: () => {
          native++;
          throw new Error("unexpected_native");
        },
        createDockerDesktopRepairDirectoryAccess: (
          _local: string,
          nonce: string,
          owner: string,
          hash: string,
        ) => ({
          scopeSha256:
            nonce === "a".repeat(64) &&
            owner === "b".repeat(64) &&
            hash === "d".repeat(64) &&
            scenario !== "artifact_binding"
              ? "c".repeat(64)
              : "e".repeat(64),
          verify: () => scope,
          dispose: () => {
            effects++;
            throw new Error("unexpected_dispose");
          },
          observe: (purpose: "initial" | "failed" | "auxiliary") => {
            reads++;
            calls.push(purpose);
            const key = purpose === "initial" ? "primary" : purpose;
            const retained = structuredClone(
              checkpoint.directories[key]?.retained,
            );
            assert.ok(retained);
            if (retained.state === "absent")
              retained.state = "confirmed_absent";
            if (
              [
                "fresh_absent",
                "fresh_unknown",
                "fresh_other",
                "fresh_null",
                "swapped",
              ].includes(scenario) ||
              (reads > 3 &&
                ["second_absent", "second_unknown", "second_other"].includes(
                  scenario,
                )) ||
              (scenario === "last_target" && reads === 6)
            ) {
              if (scenario === "fresh_null") return null;
              if (scenario.endsWith("absent")) {
                retained.state = "confirmed_absent";
                retained.identity = null;
              } else if (scenario.endsWith("other") || scenario === "swapped")
                retained.identity =
                  identities[key === "primary" ? "failed" : "primary"];
              else {
                retained.state = "unknown";
                retained.identity = null;
              }
            }
            if (scenario === "null_present" && key === "failed") {
              retained.state = "present";
              retained.identity = identities.failed;
            }
            if (scenario === "scope_after") scope = false;
            if (scenario === "artifact_after") artifact = false;
            if (scenario === "owner_after") allowed = false;
            if (scenario === "cancel_after") controller.abort();
            if (reads === 6 && scenario.startsWith("final_")) {
              if (scenario.startsWith("final_scope")) scope = false;
              if (scenario.startsWith("final_artifact")) artifact = false;
              if (scenario.startsWith("final_owner")) allowed = false;
              if (scenario.startsWith("final_cancel")) controller.abort();
            }
            return {
              source: {
                state: "present",
                identity: { dev: "9", ino: "9", birthtimeNs: "9" },
              },
              retained,
            };
          },
        }),
      },
    ) as (value: unknown) => unknown;
    const result = run({
      operationNonce: (scenario === "nonce" ? "e" : "a").repeat(64),
      ownerBindingSha256: (scenario === "owner_binding" ? "e" : "b").repeat(64),
      scopeSha256: (scenario === "scope" ? "e" : "c").repeat(64),
      checkpoint,
      signal: controller.signal,
      canObserve: () => {
        if (scenario === "owner_throw") throw new Error("fixture_owner");
        if (scenario === "owner_promise") return Promise.resolve(true);
        if (scenario === "owner_reject")
          return Promise.reject(new Error("fixture_owner"));
        return scenario !== "owner_false" && allowed;
      },
    });
    const positive = [
      "normal",
      "source_present",
      "absent_null",
      "absent_expected",
      "saved_absent",
    ].includes(scenario);
    const expected = {
      primary: identities.primary,
      failed: absent ? null : identities.failed,
      auxiliary: identities.auxiliary,
    };
    if (positive) {
      assert.deepEqual(JSON.parse(JSON.stringify(result)), expected, scenario);
      assert.deepEqual(calls, [
        "initial",
        "failed",
        "auxiliary",
        "initial",
        "failed",
        "auxiliary",
      ]);
      assert.equal(Object.isFrozen(result), true);
      assert.ok(result && typeof result === "object");
      for (const purpose of purposes) {
        const returned = (result as Record<string, unknown>)[purpose];
        const input = checkpoint.directories[purpose];
        assert.ok(input);
        if (returned) {
          assert.notStrictEqual(returned, input.expected);
          assert.notStrictEqual(returned, input.retained.identity);
        }
        if (input.expected)
          assert.equal(Object.isFrozen(input.expected), false);
        if (input.retained.identity)
          assert.equal(Object.isFrozen(input.retained.identity), false);
      }
      for (const identity of Object.values(result))
        if (identity) assert.equal(Object.isFrozen(identity), true);
    } else {
      if (scenario.startsWith("final_") && scenario.endsWith("_mutant")) {
        assert.throws(() => assert.equal(result, null, scenario));
        assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
      } else assert.equal(result, null, scenario);
      if (scenario.endsWith("mutant") && !scenario.startsWith("final_"))
        assert.throws(() => assert.deepEqual(result, expected));
    }
    if (scenario.startsWith("final_")) assert.equal(reads, 6, scenario);
    assert.equal(native, 0);
    assert.equal(effects, 0);
    assert.equal(JSON.stringify(checkpoint), before);
    assert.ok(reads <= 6);
    await Promise.resolve();
  }
});
