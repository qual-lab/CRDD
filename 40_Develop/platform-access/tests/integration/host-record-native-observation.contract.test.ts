/**
 * Host Native搬送の出所・実体照合と部分結果を検証する。
 * @packageDocumentation
 * @responsibility PA内部の技術境界を模擬し、上位Sessionの意味と分離する。
 * @trace AIT-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope 固定Native起動本文の前後確認・取消・部分結果。
 * @boundary PA実装本文とmemory代役。実Process・Docker・Providerは使わない。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * Host記録と対象観測の出所前後照合を実本文で反証する。
 *
 * @responsibility 通常Bootstrap観測の欠測・実体差、開発再借用、取消と記録Effectの不明を区別する。
 * @trace AIT-IT-002
 * @trace ERB-IT-004
 * @precondition 現Sourceの二private実行本文と非Authorityのmemory依存だけを使う。
 * @stimulus 二クラスのsave/read/observeに出所・実体・token・搬送・取消の故障を注入する。
 * @observation 発行・decoder回数、終了、参照、記録Effect、出所情報を取得する。
 * @oracle 前提拒否はspawn0、post拒否はdecode0、saveは不明を保持。各比較を外した変異は専用反例で誤成功する。
 * @cleanup N/A: 実Process・Filesystem・Docker・Providerは操作しない。
 * @boundary 本番Adapter本文と模擬Native依存。実Native Protocol・ACL・E2Eは未証明。
 */
test("Host Native実行は署名なしの出所前後照合と部分結果を保持する", () => {
  const source = readFileSync(
    new URL("../../src/host-record/record.ts", import.meta.url),
    "utf8",
  );
  const artifact = Object.freeze({
    relativePath: "fixed/native.exe",
    target: "windows",
    protocolRevision: 3,
    rustToolchain: "fixed",
    byteLength: 1,
    sha256: "fixed",
  });
  for (const mode of ["save", "read", "observe"] as const) {
    const functionName =
      mode === "observe"
        ? "executeTerminalObservationRequest"
        : "executeHostTerminalRecordRequest";
    const start = source.indexOf(`function ${functionName}<`);
    const end = source.indexOf("\n/**", start);
    assert.ok(start >= 0 && end > start);
    const body = stripTypeScriptTypes(source.slice(start, end));
    for (const recordClass of ["eleven", "known_file"] as const) {
      for (const scenario of [
        "normal",
        "initial_missing",
        "initial_throw",
        "initial_artifact",
        "begin_missing",
        "pre_token_false",
        "pre_token_throw",
        "post_token_false",
        "post_token_throw",
        "post_direct_artifact",
        "transport",
        "exit_mismatch",
        "dev_initial",
        "dev_verification",
        "dev_final",
        "dev_normal",
        ...(mode === "observe"
          ? []
          : ["cancel_before", "cancel_at_environment", "cancel_after"]),
      ]) {
        const mutation =
          scenario === "post_token_false" || scenario === "pre_token_false"
            ? {
                pattern:
                  /!verifyPlatformAccessArtifactObservation\(artifactObservation\.token\)/gu,
                replacement:
                  "(verifyPlatformAccessArtifactObservation(artifactObservation.token), false)",
              }
            : scenario === "post_direct_artifact"
              ? {
                  pattern:
                    /JSON\.stringify\(before\.artifact\)\s*!==\s*JSON\.stringify\(after\.artifact\)/u,
                  replacement: "false",
                }
              : null;
        for (const isMutant of mutation ? [false, true] : [false]) {
          const label = `${mode}/${recordClass}/${scenario}/mutant=${isMutant}`;
          const selectedBody =
            isMutant && mutation
              ? body.replace(mutation.pattern, mutation.replacement)
              : body;
          if (isMutant) assert.notEqual(selectedBody, body, label);
          let launches = 0;
          let provenanceCalls = 0;
          let artifactCalls = 0;
          let borrowCalls = 0;
          let decodeCalls = 0;
          let tokenCalls = 0;
          const request = Object.freeze({});
          const contexts = new WeakMap([
            [request, { reference: "fixture-reference", bytesBase64: "AA==" }],
          ]);
          const controller = new AbortController();
          if (scenario === "cancel_before") controller.abort();
          const development = scenario.startsWith("dev_");
          /**
           * 技術Readerの前後拒否を注入する。
           * @responsibility 実Sessionの判断を再実装せず、PAへ渡る観測値だけを制御する。
           * @trace ERB-IT-004
           * @precondition memory上の固定Artifactと故障Case。
           * @stimulus 呼出し回数に応じて固定値またはnullを返す。
           * @observation borrowCallsと実行結果。
           * @oracle 最初または最後のReader拒否を成功へ補完しない。
           * @cleanup N/A: memory値のみ。
           * @boundary PA入力Readerの代役。上位Session・実Nativeは操作しない。
           */
          const readDevelopmentSource = () => {
            borrowCalls += 1;
            return scenario === "dev_initial" ||
              (scenario === "dev_final" && borrowCalls === 2)
              ? null
              : {
                  distributionRoot: "fixed-distribution",
                  expectedArtifact:
                    scenario === "dev_verification" ? null : artifact,
                };
          };
          const execute = runInNewContext(`(${selectedBody})`, {
            Buffer,
            Object,
            JSON,
            path,
            process: { platform: "win32" },
            bundledDistributionRoot: "fixed-distribution",
            PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: "fixed/native.exe",
            MAX_SAVE_RESPONSE_BYTES: 2048,
            MAX_RESPONSE_BYTES: 4096,
            inspectPlatformAccessNativeGitProvenanceCandidate: () => {
              provenanceCalls += 1;
              throw new Error("runtime_must_not_read_git_provenance");
            },
            beginPlatformAccessBootstrapObservation: () => {
              if (scenario === "initial_throw") throw new Error("bootstrap");
              return ["initial_missing", "begin_missing"].includes(scenario)
                ? null
                : { artifact, token: {} };
            },
            observePlatformAccessArtifactCandidate: () => {
              artifactCalls += 1;
              return {
                status: "candidate",
                artifact:
                  (scenario === "initial_artifact" && artifactCalls === 1) ||
                  (scenario === "post_direct_artifact" && artifactCalls === 2)
                    ? { ...artifact, sha256: "changed" }
                    : artifact,
              };
            },
            beginPlatformAccessArtifactObservation: () =>
              scenario === "begin_missing" ? null : { artifact, token: {} },
            verifyPlatformAccessArtifactObservation: () => {
              tokenCalls += 1;
              const stage = tokenCalls === 1 ? "pre" : "post";
              if (scenario === `${stage}_token_throw`)
                throw new Error("fixture");
              return scenario !== `${stage}_token_false`;
            },
            createWindowsHostTerminalHelperEnvironment: () => {
              if (scenario === "cancel_at_environment") controller.abort();
              return {};
            },
            spawnSync: (
              _file: string,
              argv: string[],
              options: { shell: boolean; timeout: number; input: Buffer },
            ) => {
              launches += 1;
              assert.equal(options.shell, false, label);
              assert.equal(options.timeout, 5000, label);
              assert.deepEqual(
                Array.from(argv),
                [
                  `--host-terminal-${recordClass === "known_file" ? "known-file-" : ""}${mode}`,
                ],
                label,
              );
              if (scenario === "cancel_after") controller.abort();
              return {
                pid: 1,
                status:
                  scenario === "transport"
                    ? null
                    : scenario === "exit_mismatch"
                      ? 2
                      : 0,
                signal: null,
                ...(scenario === "transport"
                  ? { error: new Error("fixture") }
                  : {}),
                stdout: Buffer.alloc(0),
                stderr: Buffer.alloc(0),
              };
            },
          }) as (...args: unknown[]) => Record<string, unknown>;
          /**
           * 拒否時に出力Decoderへ到達しないことを計数する。
           * @responsibility 拒否時に出力Decoderへ到達しないことを計数する。
           * @trace AIT-IT-002
           * @trace ERB-IT-004
           * @precondition 保存・観測結果の有限Decoder代役。
           * @stimulus 呼出し時だけdecodeCallsを増やし固定phaseを返す。
           * @observation decodeCallsと開始拒否結果。
           * @oracle 出力読取り前の拒否ではDecoder呼出し0。
           * @cleanup N/A: 計数と返却値のみ。
           * @boundary Native起動境界の代役。実Native処置は行わない。
           */
          const decode = () => {
            decodeCalls += 1;
            return {
              status: mode === "save" ? "saved" : "observed",
              recordEffectIssued: mode === "save",
              observation: { phase: 3 },
            };
          };
          const result =
            mode === "observe"
              ? execute(
                  request,
                  development ? readDevelopmentSource : undefined,
                  recordClass,
                  contexts,
                  decode,
                )
              : execute(
                  request,
                  mode,
                  controller.signal,
                  development ? readDevelopmentSource : undefined,
                  contexts,
                  decode,
                  decode,
                  `--host-terminal-${recordClass === "known_file" ? "known-file-" : ""}${mode}`,
                );
          const succeeds =
            isMutant || scenario === "normal" || scenario === "dev_normal";
          assert.equal(
            result.status,
            succeeds
              ? mode === "observe"
                ? "observed"
                : "completed"
              : "blocked",
            label,
          );
          const noLaunch =
            !isMutant &&
            (scenario.startsWith("initial_") ||
              scenario.startsWith("pre_token_") ||
              scenario === "begin_missing" ||
              scenario === "dev_initial" ||
              scenario === "dev_verification" ||
              scenario === "cancel_before" ||
              scenario === "cancel_at_environment");
          assert.equal(launches, noLaunch ? 0 : 1, label);
          assert.equal(
            result.helperExitConfirmed,
            launches === 1 && scenario !== "transport",
            label,
          );
          if (mode !== "observe") {
            assert.equal(result.reference, "fixture-reference", label);
            assert.equal(
              result.recordEffectIssued,
              mode === "read" || noLaunch
                ? false
                : succeeds || scenario === "cancel_after"
                  ? true
                  : null,
              label,
            );
          } else assert.equal(result.filesystemEffectIssued, false, label);
          assert.equal(
            decodeCalls,
            succeeds ||
              scenario === "exit_mismatch" ||
              scenario === "cancel_after"
              ? 1
              : 0,
            label,
          );
          assert.equal(provenanceCalls, 0, label);
          if (scenario === "dev_verification")
            assert.equal(
              result.reason,
              "host_terminal_artifact_bootstrap_unavailable",
            );
          if (scenario === "initial_missing")
            assert.equal(
              result.reason,
              "host_terminal_artifact_bootstrap_unavailable",
            );
          if (scenario === "cancel_before")
            assert.equal(provenanceCalls, 0, label);
          if (mode === "observe" && succeeds) {
            assert.equal(Object.isFrozen(result.nativeProvenance), true, label);
            const metadata = result.nativeProvenance as {
              artifact: object;
              repositoryRevision: object | null;
            };
            assert.equal(Object.isFrozen(metadata.artifact), true, label);
            assert.equal(
              metadata.repositoryRevision === null ||
                Object.isFrozen(metadata.repositoryRevision),
              true,
              label,
            );
          }
        }
      }
    }
  }
});
