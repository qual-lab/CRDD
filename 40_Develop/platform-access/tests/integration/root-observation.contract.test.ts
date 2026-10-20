/**
 * Root／HomeのNative搬送と上位開発観測の順序を反証する。
 * @packageDocumentation
 * @responsibility 実本文を模擬Nativeへ接続し、前後確認・閉要求・Effectと拒否理由を確認する。
 * @trace AIT-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope Runtime State／Provider Homeの用途固定APIとBootstrap・開発観測。
 * @boundary Node実本文から模擬Native。実Rust・Docker・認証情報は使用しない。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  createProviderHomeObservationRequest,
  createRuntimeStateObservationRequest,
  evaluateProviderHomeObservationResponseCandidate,
  evaluateRuntimeStateObservationResponseCandidate,
} from "../../src/filesystem/protection.ts";

/**
 * 本番の二APIへ独立故障と前後確認の競合を入力する。
 * @responsibility 技術搬送の成功とAuthority発行を分離し、拒否順序と発行済み事実を維持する。
 * @trace AIT-IT-002
 * @trace ERB-IT-004
 * @precondition 本番の観測本文と既存Protocol構築・検査を利用する。
 * @stimulus 正常、入力・nonce拒否、開発確認拒否、Artifact・環境・Helper・応答の故障と各確認省略を与える。
 * @observation 呼出し順、回数、固定argv・I/O構成、結果とEffect。
 * @oracle 正常だけ候補。要求不正はReader前、後Reader拒否は応答不正より優先。変異は同じOracleで失敗する。
 * @cleanup N/A: memoryだけで実Process・Filesystemを変更しない。
 * @boundary 実TypeScript本文・既存Protocolから模擬Nativeへの限定結合。
 */
test("RootとHomeはtokenを返さずNative確認と開発Readerの順序を閉じる", () => {
  const source = readFileSync(
    new URL("../../src/filesystem/root.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("const HELPER_TIMEOUT_MS");
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(
    source.slice(start).replace(/^export /gmu, ""),
  );
  const cases = [
    "normal",
    "development",
    "unsupported",
    "input",
    "nonce",
    "bootstrap",
    "borrow-first",
    "expected",
    "artifact-before",
    "environment",
    "verify-before",
    "helper",
    "verify-after",
    "artifact-after",
    "borrow-after",
    "response",
    "borrow-response",
    "throw-first",
    "throw-after",
  ];
  /**
   * 二用途の本番本文へ同じ故障集合を適用する。
   * @responsibility 変異も同じ観測順・結果条件で判定する。
   * @trace AIT-IT-002
   * @trace ERB-IT-004
   * @precondition selectedBodyは実本文または確認箇所だけを変えた本文。
   * @stimulus 二用途と全故障を直列実行する。
   * @observation 返却値・模擬要求・イベント順。
   * @oracle 正常と独立故障の期待結果がすべて一致する。
   * @cleanup N/A: 局所VMだけを使用する。
   * @boundary 本番本文から模擬Native。
   */
  const oracle = (selectedBody: string) => {
    for (const home of [false, true])
      for (const fault of cases) {
        const events: string[] = [];
        const token = Object.freeze({});
        const artifact = Object.freeze({
          relativePath:
            "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
          target: "x86_64-pc-windows-msvc",
          protocolRevision: 3,
          rustToolchain: "1.94.1",
          byteLength: 100,
          sha256: "1".repeat(64),
        });
        let borrows = 0,
          verifies = 0,
          observations = 0,
          spawns = 0;
        const readDevelopment =
          fault === "development" ||
          fault.startsWith("borrow") ||
          fault.startsWith("throw") ||
          fault === "expected" ||
          fault === "nonce";
        /**
         * 上位の開発観測を初回と後確認で返す。
         * @responsibility Readerの拒否・例外・期待値欠落を別々に再現する。
         * @trace AIT-IT-002
         * @trace ERB-IT-004
         * @precondition この故障条件の呼出し数は0。
         * @stimulus 本番の決めた位置で同期呼出しを受ける。
         * @observation 呼出し数・順序と返却値。
         * @oracle 指定条件だけnullまたは例外となる。
         * @cleanup N/A: memoryの返却値だけ。
         * @boundary 上位開発観測の模擬Reader。
         */
        const callback = () => {
          borrows++;
          events.push(`borrow${borrows}`);
          if (
            fault === "throw-first" ||
            (fault === "throw-after" && borrows === 2)
          )
            throw new Error("borrow_fixture");
          if (
            fault === "borrow-first" ||
            ((fault === "borrow-after" || fault === "borrow-response") &&
              borrows === 2)
          )
            return null;
          return {
            distributionRoot: "C:\\fixed",
            expectedArtifact: fault === "expected" ? null : artifact,
          };
        };
        const context = {
          Buffer,
          path,
          bundledDistributionRoot: "C:\\fixed",
          HELPER_TIMEOUT_MS: undefined,
          process: { platform: fault === "unsupported" ? "linux" : "win32" },
          PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: artifact.relativePath,
          PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES: 182,
          createRuntimeStateObservationRequest: (
            root: unknown,
            initialize: unknown,
          ) =>
            fault === "nonce"
              ? createRuntimeStateObservationRequest(root, initialize, () => {
                  throw new Error("nonce_fixture");
                })
              : createRuntimeStateObservationRequest(root, initialize),
          createProviderHomeObservationRequest: (
            provider: unknown,
            root: unknown,
          ) =>
            fault === "nonce"
              ? createProviderHomeObservationRequest(provider, root, () => {
                  throw new Error("nonce_fixture");
                })
              : createProviderHomeObservationRequest(provider, root),
          evaluateRuntimeStateObservationResponseCandidate,
          evaluateProviderHomeObservationResponseCandidate,
          beginPlatformAccessBootstrapObservation: () => {
            events.push("begin");
            return fault === "bootstrap" ? null : { token, artifact };
          },
          beginPlatformAccessArtifactObservation: () => {
            events.push("begin");
            return { token, artifact };
          },
          observePlatformAccessArtifactCandidate: () => {
            events.push("artifact");
            observations++;
            return {
              status: "candidate",
              artifact:
                fault === "artifact-before" ||
                (fault === "artifact-after" && observations === 2)
                  ? { ...artifact, sha256: "9".repeat(64) }
                  : artifact,
            };
          },
          createWindowsNativeHelperEnvironment: () =>
            fault === "environment" ? null : Object.freeze({}),
          verifyPlatformAccessArtifactObservation: (value: unknown) => {
            assert.equal(value, token);
            verifies++;
            events.push(`verify${verifies}`);
            return !(
              (fault === "verify-before" && verifies === 1) ||
              (fault === "verify-after" && verifies === 2)
            );
          },
          spawnSync: (
            executable: string,
            argv: string[],
            options: {
              input: Buffer;
              shell: boolean;
              timeout: number;
              maxBuffer: number;
              env: object;
            },
          ) => {
            spawns++;
            events.push("spawn");
            assert.equal(
              executable,
              path.join("C:\\fixed", ...artifact.relativePath.split("/")),
            );
            assert.deepEqual(Array.from(argv), []);
            assert.equal(options.shell, false);
            assert.equal(options.timeout, 5000);
            assert.equal(options.maxBuffer, 183);
            assert.deepEqual(Object.keys(options.env), []);
            assert.equal(options.input.length, 76);
            const response = Buffer.alloc(182);
            response.write("CRDDHO02");
            response.writeUInt16LE(3, 8);
            response[10] = options.input[10] ?? 0;
            response[11] = 1;
            options.input.copy(response, 12, 12, 44);
            response.writeUInt16LE(100, 44);
            response.writeUInt32LE(0x83, 46);
            response.writeUInt32LE(0x1ff, 50);
            for (let index = 0; index < 4; index++)
              response.fill(index + 1, 54 + index * 32, 86 + index * 32);
            if (fault === "response" || fault === "borrow-response")
              response[0] = 0;
            return {
              pid: 123,
              status: fault === "helper" ? 2 : 0,
              signal: null,
              stdout: response,
              stderr: Buffer.alloc(0),
            };
          },
        };
        const api = runInNewContext(
          `${selectedBody}; ({observeWindowsRuntimeState,observeWindowsProviderHome})`,
          context,
        ) as {
          observeWindowsRuntimeState: (
            ...args: unknown[]
          ) => Record<string, unknown>;
          observeWindowsProviderHome: (
            ...args: unknown[]
          ) => Record<string, unknown>;
        };
        /**
         * 選択した用途の公開観測関数を呼ぶ。
         * @responsibility RootとHomeへ対応する入力・Readerを渡す。
         * @trace AIT-IT-002
         * @trace ERB-IT-004
         * @precondition VMへ本番関数と模擬I/Oを接続済み。
         * @stimulus 一回だけ観測を要求する。
         * @observation 型付き結果またはReader例外。
         * @oracle 呼出し元が故障条件ごとの期待結果を判定する。
         * @cleanup N/A: 実Processを使用しない。
         * @boundary 本番観測APIの局所搬送。
         */
        const invoke = () =>
          home
            ? api.observeWindowsProviderHome(
                "codex",
                fault === "input" ? null : "C:\\home",
                readDevelopment ? callback : undefined,
              )
            : api.observeWindowsRuntimeState(
                "C:\\state",
                fault === "input" ? "invalid" : true,
                readDevelopment ? callback : undefined,
              );
        if (fault.startsWith("throw")) {
          assert.throws(invoke, /borrow_fixture/u);
          continue;
        }
        const result = invoke();
        const accepted = fault === "normal" || fault === "development";
        assert.equal(
          result.status,
          accepted ? "candidate" : "blocked",
          `${home}/${fault}`,
        );
        if (accepted) {
          assert.equal(result.processEffectIssued, true);
          assert.equal(result.helperExitConfirmed, true);
          assert.equal(borrows, readDevelopment ? 2 : 0);
          assert.deepEqual(
            events,
            readDevelopment
              ? [
                  "borrow1",
                  "artifact",
                  "begin",
                  "verify1",
                  "spawn",
                  "verify2",
                  "artifact",
                  "borrow2",
                ]
              : [
                  "begin",
                  "artifact",
                  "verify1",
                  "spawn",
                  "verify2",
                  "artifact",
                ],
          );
        }
        const reason: Record<string, string> = {
          unsupported: "platform_unsupported",
          input: home ? "provider_invalid" : "root_invalid",
          nonce: home ? "provider_invalid" : "root_invalid",
          bootstrap: "artifact_bootstrap_unavailable",
          "borrow-first": "development_context_invalid",
          expected: "artifact_bootstrap_unavailable",
          "artifact-before": "artifact_not_verified",
          environment: "environment_unavailable",
          "verify-before": "artifact_changed",
          helper: "helper_failed",
          "verify-after": "artifact_changed",
          "artifact-after": "artifact_changed",
          "borrow-after": "artifact_changed",
          response: "response_invalid",
          "borrow-response": "artifact_changed",
        };
        if (!accepted)
          assert.equal(result.reason, reason[fault], `${home}/${fault}`);
        assert.equal(result.processEffectIssued, spawns === 1);
        assert.equal(result.filesystemEffectIssued, !home && spawns === 1);
        if (fault === "input" || fault === "nonce" || fault === "unsupported")
          assert.equal(borrows, 0);
        if (fault === "borrow-first" || fault === "expected")
          assert.equal(borrows, 1);
        for (const key of [
          "token",
          "response",
          "absolutePath",
          "rootCapability",
          "observationCapability",
        ])
          assert.equal(key in result, false);
      }
  };
  oracle(body);
  const gate =
    "!verifyPlatformAccessArtifactObservation(artifactObservation.token)";
  assert.equal(body.split(gate).length, 3);
  for (const mutated of [
    body.replace(
      "beginPlatformAccessBootstrapObservation(distributionRoot)",
      "null",
    ),
    body.replace(gate, "false"),
    body.replaceAll(gate, "false"),
    body.replace("shell: false", "shell: true"),
    body.replace(
      "spawnSync(selectedExecutable, [],",
      'spawnSync(selectedExecutable, ["--other"],',
    ),
  ]) {
    assert.notEqual(mutated, body);
    assert.throws(() => oracle(mutated), { name: "AssertionError" });
  }
});
