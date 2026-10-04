/**
 * 共有境界の初期化搬送と停止時の部分結果を局所確認する。
 *
 * @packageDocumentation
 * @responsibility 署名拒否、mode相関、部分作成と不明を同じ本体で反証する。
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定frameと署名境界の局所搬送。実署名・実OS作成は別の未確認条件。
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
  type initializeHostRecoveryNamespaceWindows,
} from "../../src/security/host-recovery-namespace-windows-adapter.ts";
import { assertRuntimeSourceDeclaredGraphBoundaryForVerification } from "../../src/security/platform-provisioner-package-filesystem.ts";

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
  reuse = false,
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
            reuse ? 0 : 1,
            reuse ? 0 : 1,
            1,
            1,
            1,
            reuse ? 0 : 1,
            reuse ? 0 : 1,
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
 * @precondition 独立frame、署名・OS・Processなし。
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
 * 実本体の署名停止、二要求と部分作成を局所依存で確認する。
 *
 * @responsibility 未署名fallbackと搬送不明のEffect 0誤認を検出する。
 * @trace ERB-IT-003
 * @precondition 現Source本体を読み、外部依存だけを非Authority memory実装へ置換する。
 * @stimulus 署名拒否、別親、正常作成・再利用、部分作成、transport不明、close不明を与える。
 * @observation 発行回数、mode、独立期待値、状態、元理由、Effect三値。
 * @oracle 署名拒否は0回、正常2回、停止で後続禁止。不明はnull、部分receiptは保持する。
 * @cleanup N/A: 実Process、Filesystem変更、Provider要求は発行しない。
 * @boundary 本番Adapter本体→局所署名・Process観測代替。署名E2Eではない。
 */
test("共有初期化Adapterは署名拒否と部分処置を同じ本体で保持する", () => {
  const source = readFileSync(
    new URL(
      "../../src/security/host-recovery-namespace-windows-adapter.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const start = source.indexOf(
    "export function initializeHostRecoveryNamespaceWindows(",
  );
  assertRuntimeSourceDeclaredGraphBoundaryForVerification(
    "src/security/host-recovery-namespace-windows-adapter.ts",
    source,
  );
  for (const changed of [
    source.replace("shell: false", "shell: true"),
    source.replace("--host-recovery-namespace-initialize", "--other-mode"),
  ]) {
    assert.notEqual(changed, source);
    assert.throws(() =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        "src/security/host-recovery-namespace-windows-adapter.ts",
        changed,
      ),
    );
  }
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(
    source.slice(start).replace(/^export /u, ""),
  );
  const parent = "C:\\fixture\\temporary-parent";
  const artifact = Object.freeze({ sha256: "synthetic" });
  for (const scenario of [
    "unsigned",
    "different_parent",
    "capture_blocked",
    "created",
    "reused",
    "partial",
    "transport",
    "malformed",
    "false_success_reason",
  ]) {
    const launches: string[] = [];
    const execute = runInNewContext(`(${body})`, {
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
      createWindowsHostTerminalHelperEnvironment: () => ({
        TEMP: parent,
        TMP: parent,
      }),
      verifyBundledCoordinatorPackageFromFixedManifestCandidate: () =>
        scenario === "unsigned"
          ? { status: "blocked" }
          : {
              status: "candidate",
              runtimeOwnedReleaseTrustConfirmed: true,
              runtimeExecutionIdentityRuntimeOwned: true,
              crddDistributionConfirmed: true,
              platformAccessArtifact: artifact,
            },
      observePlatformAccessReleaseArtifactCandidate: () => ({
        status: "candidate",
        artifact,
      }),
      beginPlatformAccessArtifactSigningObservation: () => ({
        token: {},
        artifact,
      }),
      verifyPlatformAccessArtifactSigningObservation: () => true,
      spawnSync: (
        _file: string,
        argv: readonly string[],
        options: { input: Buffer },
      ) => {
        assert.equal(argv.length, 1);
        launches.push(argv[0] ?? "");
        const initialize = launches.length === 2;
        assert.equal(options.input.length, initialize ? 98 : 42);
        assert.equal(
          options.input.subarray(0, 8).toString("ascii"),
          initialize ? "CRDDNI01" : "CRDDNC01",
        );
        if (initialize) {
          assert.equal(options.input.readUInt32LE(50), 3);
          assert.deepEqual(options.input.subarray(66), Buffer.alloc(32, 8));
        }
        const nonce = options.input.subarray(10, 42);
        if (initialize && scenario === "transport")
          return {
            pid: 1,
            error: new Error("fixture"),
            signal: null,
            status: null,
            stdout: Buffer.alloc(0),
            stderr: Buffer.alloc(0),
          };
        const blocked =
          (!initialize && scenario === "capture_blocked") ||
          (initialize &&
            ["partial", "false_success_reason"].includes(scenario));
        const stdout =
          initialize && scenario === "malformed"
            ? Buffer.from("invalid")
            : responseFrame(
                nonce,
                blocked ? 0 : initialize ? 2 : 1,
                scenario === "false_success_reason" && initialize
                  ? "terminal_namespace_initialized"
                  : undefined,
                scenario === "reused",
              );
        if (!initialize && blocked) {
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
          status: blocked ? 2 : 0,
          stdout,
          stderr: Buffer.alloc(0),
        };
      },
    }) as typeof initializeHostRecoveryNamespaceWindows;
    const result = execute(
      scenario === "different_parent" ? "C:\\other" : parent,
    );
    assert.equal(
      launches.length,
      ["unsigned", "different_parent"].includes(scenario)
        ? 0
        : scenario === "capture_blocked"
          ? 1
          : 2,
    );
    assert.equal(
      result.status,
      ["created", "reused"].includes(scenario) ? "initialized" : "blocked",
    );
    assert.equal(
      result.filesystemEffectIssued,
      ["transport", "malformed"].includes(scenario)
        ? null
        : ["created", "partial", "false_success_reason"].includes(scenario),
    );
    if (scenario === "partial") {
      assert.equal(result.initialization?.children[0]?.createIssued, true);
      assert.equal(result.initialization?.children[0]?.created, null);
    }
  }
});

/**
 * 本番作成入口の保護検証順序と失敗移送を同じ本体で確認する。
 *
 * @responsibility 署名拒否後のRoot作成と、下位負例の早期拒否への置換を防ぐ。
 * @trace ERB-IT-003
 * @precondition 現本体Sourceと非Authority依存のみ。実共有領域を使用しない。
 * @stimulus Windows正常・初期化停止・親不正・下位失敗と非Windowsを与える。
 * @observation 初期化→生成の順序、opaque失敗分類、渡した親。
 * @oracle Windows停止は生成0・清掃未確認・IDなし。非Windowsは既存primitiveだけ。
 * @cleanup N/A: 実OS Effectなし。
 * @boundary 通常作成Owner→署名初期化Adapter／下位primitiveの局所接続。
 */
test("通常producerはWindows保護検証をRoot・marker生成より先に行う", () => {
  const source = readFileSync(
    new URL(
      "../../src/security/coordinator-operation-creation-internal.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    source,
    /createDirectories: createProtectedRuntimeOwnedOperationDirectories,/u,
  );
  const start = source.indexOf(
    "function createProtectedRuntimeOwnedOperationDirectories(",
  );
  const end = source.indexOf("const productionDependencies:", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  for (const scenario of [
    "normal",
    "blocked",
    "bad_parent",
    "primitive_failure",
    "non_windows",
  ]) {
    const events: string[] = [];
    const root = Object.freeze({ fixture: "owned" });
    const primitiveFailure = new Error("fixture_root_creation_failed");
    let classification: {
      cleanupConfirmed: boolean;
      hostRecoveryId: string | null;
    } | null = null;
    const execute = runInNewContext(`(${body})`, {
      process: { platform: scenario === "non_windows" ? "linux" : "win32" },
      fs: {
        realpathSync: () => "C:\\fixture\\parent",
        lstatSync: () => ({
          isDirectory: () => scenario !== "bad_parent",
          isSymbolicLink: () => false,
        }),
      },
      os: { tmpdir: () => "C:\\fixture\\parent" },
      initializeHostRecoveryNamespaceWindows: (parent: string) => {
        events.push("initialize");
        assert.equal(parent, "C:\\fixture\\parent");
        return { status: scenario === "blocked" ? "blocked" : "initialized" };
      },
      createOwnedOperationDirectories: (parent?: string) => {
        events.push("create");
        assert.equal(
          parent,
          scenario === "non_windows" ? undefined : "C:\\fixture\\parent",
        );
        if (scenario === "primitive_failure") throw primitiveFailure;
        return root;
      },
      fail: (
        cause: unknown,
        cleanupConfirmed: boolean,
        hostRecoveryId: string | null,
      ) => {
        classification = { cleanupConfirmed, hostRecoveryId };
        throw cause;
      },
    }) as () => unknown;
    if (["blocked", "bad_parent", "primitive_failure"].includes(scenario)) {
      assert.throws(execute);
      if (scenario === "primitive_failure") {
        assert.equal(classification, null);
      } else {
        assert.deepEqual(classification, {
          cleanupConfirmed: scenario === "bad_parent",
          hostRecoveryId: null,
        });
      }
    } else {
      assert.equal(execute(), root);
    }
    assert.deepEqual(
      events,
      scenario === "bad_parent"
        ? []
        : scenario === "blocked"
          ? ["initialize"]
          : scenario === "non_windows"
            ? ["create"]
            : ["initialize", "create"],
    );
  }
});
