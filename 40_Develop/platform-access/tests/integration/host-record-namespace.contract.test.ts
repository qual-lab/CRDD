/**
 * 共有境界の初期化搬送と停止時の部分結果を局所確認する。
 *
 * @packageDocumentation
 * @responsibility Native出所拒否、mode相関、部分作成と不明を同じ本体で反証する。
 * @trace AIT-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定frameとNative出所境界の局所搬送。実Native・実OS作成は別の未確認条件。
 * @boundary Native搬送Adapterを非Authorityのmemory依存で確認する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  decodeHostRecoveryNamespaceResponse,
  type initializeWindowsHostRecordNamespace,
} from "../../src/host-record/namespace.ts";

/**
 * 独立offsetから正常・部分処置の試験応答を作る。
 *
 * @responsibility production encoderを使わず相関Oracleを構築する。
 * @trace ERB-IT-003
 * @precondition memory fixtureだけを扱う。
 * @stimulus statusとnonce、任意の停止理由を与える。
 * @observation 固定header、実体、二receiptとclose列。
 * @oracle Native設計の配置へ一致する。実OS観測の証明ではない。
 * @cleanup N/A: 局所Bufferのみ。
 * @boundary 独立fixture→production decoder。
 */
function responseFrame(
  nonce: Buffer,
  status: number,
  reason?: string,
  shouldReuse = false,
) {
  const text =
    reason ??
    (status === 1
      ? "terminal_namespace_parent_observed"
      : status === 2
        ? "terminal_namespace_initialized"
        : "terminal_namespace_create_unconfirmed");
  const frame = Buffer.alloc(59);
  frame.write("CRDDNR01", 0, "ascii");
  frame.writeUInt16LE(1, 8);
  nonce.copy(frame, 10);
  frame[42] = status;
  frame[43] = text.length;
  frame[45] = status === 2 ? 7 : 1;
  frame[46] = 1;
  frame[47] = 2;
  frame[48] = status === 2 ? 3 : 1;
  frame.set(
    status === 1
      ? [0, 0, 2, 0, 2, 0, 0, 2, 0, 2]
      : status === 2
        ? [
            1,
            shouldReuse ? 0 : 1,
            shouldReuse ? 0 : 1,
            1,
            1,
            1,
            shouldReuse ? 0 : 1,
            shouldReuse ? 0 : 1,
            1,
            1,
          ]
        : [1, 1, 2, 0, 2, 0, 0, 2, 0, 2],
    49,
  );
  const ids = Buffer.alloc(status === 2 ? 72 : 24);
  for (let index = 0; index < ids.length / 24; index += 1) {
    [1, 2, index + 3, 4, 5, 0x10].forEach((value, field) => {
      ids.writeUInt32LE(value, index * 24 + field * 4);
    });
  }
  return Buffer.concat([
    frame,
    Buffer.from(text, "ascii"),
    Buffer.alloc(32, 8),
    ids,
    Buffer.alloc(status === 2 ? 5 : 3, 1),
  ]);
}

/**
 * 閉形式の余剰・相関・値不正と終了不足を拒否する。
 *
 * @responsibility 観測成功を作成成功、部分処置を未発行へ畳まない。
 * @trace ERB-IT-003
 * @precondition 独立frame、出所照合・OS・Processなし。
 * @stimulus nonce、revision、mode、余剰、close、属性、receipt、非ASCIIを破損する。
 * @observation decoderのnull、statusと部分receipt。
 * @oracle 全反例を拒否し、停止のcreated=nullを保持する。
 * @cleanup N/A: 局所memoryのみ。
 * @boundary frame→production decoder。
 */
test("共有初期化frameはmode・実体・個別終了を共同検証する", () => {
  const nonce = Buffer.alloc(32, 7);
  const captured = responseFrame(nonce, 1);
  const initialized = responseFrame(nonce, 2);
  assert.equal(
    decodeHostRecoveryNamespaceResponse(captured, nonce.toString("hex"), false)
      ?.status,
    "observed",
  );
  assert.equal(
    decodeHostRecoveryNamespaceResponse(
      initialized,
      nonce.toString("hex"),
      true,
    )?.status,
    "initialized",
  );
  assert.equal(
    decodeHostRecoveryNamespaceResponse(captured, nonce.toString("hex"), true),
    null,
  );
  assert.equal(
    decodeHostRecoveryNamespaceResponse(
      initialized,
      nonce.toString("hex"),
      false,
    ),
    null,
  );
  for (const offset of [
    8,
    10,
    42,
    46,
    47,
    48,
    50,
    51,
    52,
    53,
    initialized.length - 1,
  ]) {
    const broken = Buffer.from(initialized);
    broken[offset] = 255;
    assert.equal(
      decodeHostRecoveryNamespaceResponse(broken, nonce.toString("hex"), true),
      null,
    );
  }
  const highAscii = Buffer.from(initialized);
  highAscii[59] = 0xf4;
  assert.equal(
    decodeHostRecoveryNamespaceResponse(highAscii, nonce.toString("hex"), true),
    null,
  );
  const unclosed = Buffer.from(initialized);
  unclosed[unclosed.length - 1] = 0;
  assert.equal(
    decodeHostRecoveryNamespaceResponse(unclosed, nonce.toString("hex"), true),
    null,
  );
  assert.equal(
    decodeHostRecoveryNamespaceResponse(
      Buffer.concat([initialized, Buffer.from([0])]),
      nonce.toString("hex"),
      true,
    ),
    null,
  );
  const partial = decodeHostRecoveryNamespaceResponse(
    responseFrame(nonce, 0),
    nonce.toString("hex"),
    true,
  );
  assert.equal(partial?.status, "blocked");
  assert.equal(partial?.children[0]?.createIssued, true);
  assert.equal(partial?.children[0]?.created, null);
});

/**
 * 実本体の出所停止、二要求と部分作成を局所依存で確認する。
 *
 * @responsibility 出所未照合fallbackと搬送不明のEffect 0誤認を検出する。
 * @trace ERB-IT-003
 * @trace AIT-IT-002
 * @precondition 現Source本体を読み、外部依存だけを非Authority memory実装へ置換する。
 * @stimulus 出所・改訂・実体・tokenの各前後拒否、別親、正常・部分作成、transport不明を与える。
 * @observation 発行回数、mode、独立期待値、状態、元理由、Effect三値。
 * @oracle 初期拒否0回、正常2回、前後拒否は発生点まで。不明はnull、部分receiptは保持する。
 * @cleanup N/A: 実Process、Filesystem変更、Provider要求は発行しない。
 * @boundary 本番Adapter本体→局所出所・Process観測代替。実Native E2Eではない。
 */
test("共有初期化Adapterは出所拒否と部分処置を同じ本体で保持する", () => {
  const source = readFileSync(
    new URL("../../src/host-record/namespace.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function initializeWindowsHostRecordNamespace(",
  );
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(
    source.slice(start).replace(/^export /u, ""),
  );
  const parent = "C:\\fixture\\temporary-parent";
  const artifact = Object.freeze({ sha256: "synthetic" });
  for (const scenario of [
    "bootstrap_null_1",
    "bootstrap_throw_1",
    "different_parent",
    "capture_blocked",
    "created",
    "reused",
    "partial",
    "transport",
    "malformed",
    "false_success_reason",
    ...[1, 2, 3, 4].flatMap((step) =>
      ["false", "throw"].map((kind) => `token_${kind}_${step}`),
    ),
    ...[1, 2, 3].map((step) => `artifact_mismatch_${step}`),
    "begin_missing",
  ]) {
    const launches: string[] = [];
    const token = Object.freeze({});
    const environment = Object.freeze({ TEMP: parent, TMP: parent });
    let provenanceCalls = 0;
    let artifactCalls = 0;
    let beginCalls = 0;
    let tokenCalls = 0;
    const fault = /^(bootstrap|token|artifact)_([^_]+)_(\d+)$/u.exec(scenario);
    const faultStep = Number(fault?.[3] ?? 0);
    const dependencies = {
      Buffer,
      Date,
      JSON,
      Object,
      process: { platform: "win32" },
      path,
      distributionRoot: "C:\\fixture\\distribution",
      RESPONSE_LIMIT: 1024,
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: "fixed/native.exe",
      randomBytes: () => Buffer.alloc(32, 7),
      decodeHostRecoveryNamespaceResponse,
      createWindowsHostTerminalHelperEnvironment: () => environment,
      inspectPlatformAccessNativeGitProvenanceCandidate: () => {
        provenanceCalls += 1;
        throw new Error("normal_runtime_must_not_read_git_provenance");
      },
      observePlatformAccessArtifactCandidate: () => {
        artifactCalls += 1;
        return {
          status: "candidate",
          artifact:
            scenario === `artifact_mismatch_${artifactCalls}`
              ? { sha256: "different" }
              : artifact,
        };
      },
      beginPlatformAccessBootstrapObservation: () => {
        beginCalls += 1;
        if (scenario === "bootstrap_throw_1") throw new Error("bootstrap");
        return ["begin_missing", "bootstrap_null_1"].includes(scenario)
          ? null
          : { token, artifact };
      },
      verifyPlatformAccessArtifactObservation: (value: object) => {
        assert.equal(value, token);
        tokenCalls += 1;
        if (scenario === `token_throw_${tokenCalls}`)
          throw new Error("fixture token");
        return scenario !== `token_false_${tokenCalls}`;
      },
      spawnSync: (
        file: string,
        argv: readonly string[],
        options: {
          input: Buffer;
          env: object;
          shell: boolean;
          windowsHide: boolean;
          timeout: number;
          maxBuffer: number;
          encoding: string;
        },
      ) => {
        assert.equal(
          file,
          path.join("C:\\fixture\\distribution", "fixed", "native.exe"),
        );
        assert.equal(options.env, environment);
        assert.equal(options.shell, false);
        assert.equal(options.windowsHide, true);
        assert.equal(options.timeout, 5000);
        assert.equal(options.maxBuffer, 1025);
        assert.equal(options.encoding, "buffer");
        assert.equal(argv.length, 1);
        assert.equal(
          argv[0],
          launches.length === 0
            ? "--host-recovery-namespace-observe"
            : "--host-recovery-namespace-initialize",
        );
        launches.push(argv[0] ?? "");
        const shouldInitialize = launches.length === 2;
        assert.equal(options.input.length, shouldInitialize ? 98 : 42);
        assert.equal(
          options.input.subarray(0, 8).toString("ascii"),
          shouldInitialize ? "CRDDNI01" : "CRDDNC01",
        );
        if (shouldInitialize) {
          assert.equal(options.input.readUInt32LE(50), 3);
          assert.deepEqual(options.input.subarray(66), Buffer.alloc(32, 8));
        }
        const nonce = options.input.subarray(10, 42);
        if (shouldInitialize && scenario === "transport")
          return {
            pid: 1,
            error: new Error("fixture"),
            signal: null,
            status: null,
            stdout: Buffer.alloc(0),
            stderr: Buffer.alloc(0),
          };
        const isBlocked =
          (!shouldInitialize && scenario === "capture_blocked") ||
          (shouldInitialize &&
            ["partial", "false_success_reason"].includes(scenario));
        const stdout =
          shouldInitialize && scenario === "malformed"
            ? Buffer.from("invalid")
            : responseFrame(
                nonce,
                isBlocked ? 0 : shouldInitialize ? 2 : 1,
                scenario === "false_success_reason" && shouldInitialize
                  ? "terminal_namespace_initialized"
                  : undefined,
                scenario === "reused",
              );
        if (!shouldInitialize && isBlocked) {
          const captured = responseFrame(
            nonce,
            1,
            "terminal_namespace_observation_failed",
          );
          captured[42] = 0;
          return {
            pid: 1,
            signal: null,
            status: 2,
            stdout: captured,
            stderr: Buffer.alloc(0),
          };
        }
        return {
          pid: 1,
          signal: null,
          status: isBlocked ? 2 : 0,
          stdout,
          stderr: Buffer.alloc(0),
        };
      },
    };
    const executeAdapter = runInNewContext(
      `(${body})`,
      dependencies,
    ) as typeof initializeWindowsHostRecordNamespace;
    const result = executeAdapter(
      scenario === "different_parent" ? "C:\\other" : parent,
    );
    const expectedFaultLaunches =
      fault?.[1] === "bootstrap"
        ? 0
        : fault?.[1] === "token"
          ? Math.floor(faultStep / 2)
          : fault?.[1] === "artifact"
            ? faultStep - 1
            : null;
    assert.equal(
      launches.length,
      expectedFaultLaunches ??
        (["begin_missing", "different_parent"].includes(scenario)
          ? 0
          : scenario === "capture_blocked"
            ? 1
            : 2),
      scenario,
    );
    assert.equal(
      result.status,
      ["created", "reused"].includes(scenario) ? "initialized" : "blocked",
    );
    assert.equal(
      result.filesystemEffectIssued,
      expectedFaultLaunches !== null
        ? expectedFaultLaunches === 2
          ? null
          : false
        : ["transport", "malformed"].includes(scenario)
          ? null
          : ["created", "partial", "false_success_reason"].includes(scenario),
      scenario,
    );
    assert.equal(result.processEffectIssued, launches.length > 0, scenario);
    assert.equal(
      result.helperExitConfirmed,
      launches.length > 0 && scenario !== "transport",
      scenario,
    );
    if (expectedFaultLaunches !== null) {
      assert.equal(result.initialization, null, scenario);
      const hasParent = fault?.[1] !== "bootstrap" && faultStep >= 3;
      assert.equal(result.parentObservation !== null, hasParent, scenario);
      assert.equal(
        result.artifactVerifiedBeforeAndAfter,
        hasParent && launches.length === 1,
        scenario,
      );
    }
    if (["created", "reused"].includes(scenario)) {
      assert.deepEqual(
        [
          provenanceCalls,
          artifactCalls,
          beginCalls,
          tokenCalls,
          launches.length,
        ],
        [0, 3, 1, 4, 2],
      );
      assert.equal(result.artifactVerifiedBeforeAndAfter, true);
    }
    if (scenario === "different_parent")
      assert.deepEqual(
        [provenanceCalls, artifactCalls, beginCalls, tokenCalls],
        [0, 0, 0, 0],
      );
    if (scenario === "partial") {
      assert.equal(result.initialization?.children[0]?.createIssued, true);
      assert.equal(result.initialization?.children[0]?.created, null);
    }
    if (scenario === "created") {
      for (const mutated of [
        body.replace("shell: false", "shell: true"),
        body.replace("--host-recovery-namespace-initialize", "--other-mode"),
        body.replace(
          "beginPlatformAccessBootstrapObservation(distributionRoot)",
          "null",
        ),
      ]) {
        assert.notEqual(mutated, body);
        launches.length = 0;
        artifactCalls = 0;
        beginCalls = 0;
        tokenCalls = 0;
        const executeMutant = runInNewContext(
          `(${mutated})`,
          dependencies,
        ) as typeof initializeWindowsHostRecordNamespace;
        assert.throws(
          () => assert.equal(executeMutant(parent).status, "initialized"),
          { name: "AssertionError" },
        );
      }
    }
    assert.equal(provenanceCalls, 0, scenario);
    const mutation = ["token_false_3", "token_false_4"].includes(scenario)
      ? [
          "!verifyPlatformAccessArtifactObservation(artifactObservation.token)",
          "(verifyPlatformAccessArtifactObservation(artifactObservation.token), false)",
        ]
      : null;
    if (mutation) {
      const mutated = body.replaceAll(
        mutation[0] as string,
        mutation[1] as string,
      );
      assert.notEqual(mutated, body, scenario);
      launches.length = 0;
      provenanceCalls = 0;
      artifactCalls = 0;
      beginCalls = 0;
      tokenCalls = 0;
      const executeMutant = runInNewContext(
        `(${mutated})`,
        dependencies,
      ) as typeof initializeWindowsHostRecordNamespace;
      assert.equal(
        executeMutant(parent).status,
        "initialized",
        `専用反例が検査欠落を検出する: ${scenario}`,
      );
      assert.equal(launches.length, 2, scenario);
    }
  }
});
