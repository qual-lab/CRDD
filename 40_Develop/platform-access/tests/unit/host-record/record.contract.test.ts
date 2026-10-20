/**
 * Host記録の固定Native Protocolと部分結果を検証する。
 * @packageDocumentation
 * @responsibility request相関・receipt・終了値・不明Effectの技術反証を所有する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 技術投影とmemory搬送。実OS・上位判断は対象外。
 * @boundary 本番の技術処理と合成入力。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  readHostRecordProjection,
  type HostTerminalWindowsIdentity,
} from "../../../src/host-record/record.ts";
import {
  createHostTerminalCurrentObservationRequest,
  createHostTerminalObservationRequest as native_createHostTerminalObservationRequest,
  createHostTerminalReadRequest as native_createHostTerminalReadRequest,
  createHostTerminalSaveRequest as native_createHostTerminalSaveRequest,
  createHostTerminalTargetObservationRequest,
  createKnownFileHostTerminalCurrentObservationRequest,
  createKnownFileHostTerminalReadRequest as native_createKnownFileHostTerminalReadRequest,
  createKnownFileHostTerminalSaveRequest as native_createKnownFileHostTerminalSaveRequest,
  createKnownFileHostTerminalTargetObservationRequest,
  evaluateHostTerminalObservationResponse,
  evaluateHostTerminalReadResponse,
  evaluateHostTerminalSaveResponse,
  evaluateKnownFileHostTerminalObservationResponse,
  evaluateKnownFileHostTerminalReadResponse,
  evaluateKnownFileHostTerminalSaveResponse,
  type HostTerminalObservationRequest,
  type HostTerminalReadRequest,
  type HostTerminalSaveRequest,
  observeHostTerminalWindowsCandidate,
  observeHostTerminalWindowsTarget,
  observeKnownFileHostTerminalWindowsCandidate,
  observeKnownFileHostTerminalWindowsTarget,
  readHostTerminalWindowsRecord,
  readKnownFileHostTerminalWindowsRecord,
  saveHostTerminalWindowsRecord,
  saveKnownFileHostTerminalWindowsRecord,
} from "../../../src/host-record/record.ts";

/**
 * encodeFixtureRecordの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function encodeFixtureRecord<T>(value: T) {
  const serialized = JSON.stringify(value);
  return {
    intent: value,
    serialized,
    sha256: createHash("sha256").update(serialized).digest("hex"),
  };
}
/**
 * projectFixtureの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function projectFixture(value: unknown) {
  try {
    if (!value || typeof value !== "object") return null;
    const intent = value as ReturnType<typeof fixture>;
    const encoded = encodeFixtureRecord(intent);
    return {
      serialized: encoded.serialized,
      sha256: encoded.sha256,
      reference: intent.reference,
      selectedUserSha256: intent.bindings.selectedUserSha256,
      target: intent.target,
    };
  } catch {
    return null;
  }
}
/**
 * createHostTerminalObservationRequestの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function createHostTerminalObservationRequest(value: unknown) {
  return native_createHostTerminalObservationRequest(projectFixture(value));
}

/**
 * createHostTerminalSaveRequestの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function createHostTerminalSaveRequest(value: unknown) {
  return native_createHostTerminalSaveRequest(projectFixture(value));
}

/**
 * createHostTerminalReadRequestの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function createHostTerminalReadRequest(value: unknown) {
  return native_createHostTerminalReadRequest(projectFixture(value));
}

/**
 * createKnownFileHostTerminalSaveRequestの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function createKnownFileHostTerminalSaveRequest(value: unknown) {
  return native_createKnownFileHostTerminalSaveRequest(projectFixture(value));
}

/**
 * createKnownFileHostTerminalReadRequestの技術fixtureを構成する。
 * @responsibility Native検出と上位意味の検査を分離して入力を作る。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使う。
 * @stimulus 試験値を渡す。
 * @observation 所有値とHashを得る。
 * @oracle 呼出し元Caseで判定する。
 * @cleanup N/A: memoryだけ。
 * @boundary 試験の技術投影。上位codecや実Nativeの証明ではない。
 */
function createKnownFileHostTerminalReadRequest(value: unknown) {
  return native_createKnownFileHostTerminalReadRequest(projectFixture(value));
}
/**
 * 区別可能な局所Win32 Identityを作る。
 *
 * @responsibility 実観測と混同しない整数fixtureを生成する。
 * @trace PRL-UT-006
 * @precondition 呼出し側がfixtureのindexを指定する。
 * @stimulus indexを識別fieldへ配置し、属性は独立した固定値を持たせる。
 * @observation 返却した不変値。
 * @oracle fileIndexLowだけが指定indexに対応する。
 * @cleanup N/A: memory値だけを作る。
 * @boundary N/A: Win32 APIは呼ばない。
 */
function identity(index: number): HostTerminalWindowsIdentity {
  return Object.freeze({
    volumeSerial: 1,
    fileIndexHigh: 0,
    fileIndexLow: index,
    creationTimeHigh: 1,
    creationTimeLow: 2,
    attributes: index === 5 ? 0x80 : 0x10,
  });
}

/**
 * 二回確認OwnerがKnown要求・偽参照・未検証実行物を初回前に拒否する。
 *
 * @responsibility 要求形状だけからNative起動や二回目確認へ進まないことを確認する。
 * @trace PRL-UT-006
 * @precondition codecの正常fixtureと私有Current要求がmemory内に存在する。
 * @stimulus Known要求、Currentのclone、無効開発Contextを二回確認入口へ渡す。
 * @observation 両観測、停止理由、ProcessとFilesystemのEffect。
 * @oracle Known／cloneは要求不正、無効Contextは既存Adapterで停止し、二回目とEffectは0。
 * @cleanup N/A: Native・OS・Filesystemの資源を取得しない。
 * @boundary 初回処置前の拒否のみ。二回の実OS正常確認はこのCaseの対象外。
 */
test("Host候補の二回確認は私有Current要求と検証済み実行Contextを必要とする", () => {
  const known = createHostTerminalObservationRequest(fixture());
  const current = createHostTerminalCurrentObservationRequest({
    rootName: "crdd-coordinator-doctor-fixture",
    markerName: `host-${"e".repeat(64)}.json`,
  });
  assert.ok(known);
  assert.ok(current);
  const cancelled = new AbortController();
  cancelled.abort();
  const cancelledResult = observeHostTerminalWindowsCandidate(
    current,
    () => null,
    cancelled.signal,
  );
  assert.equal(cancelledResult.status, "blocked");
  assert.equal(cancelledResult.reason, "host_terminal_candidate_cancelled");
  assert.equal(cancelledResult.currentObservation, null);
  assert.equal(cancelledResult.knownObservation, null);
  assert.equal(cancelledResult.processEffectIssued, false);
  assert.equal(cancelledResult.helperExitConfirmed, true);
  for (const request of [known, Object.freeze({ ...current })]) {
    const result = observeHostTerminalWindowsCandidate(request);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "host_terminal_current_request_required");
    assert.equal(result.currentObservation, null);
    assert.equal(result.knownObservation, null);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.cleanupAuthorized, false);
  }
  const result = observeHostTerminalWindowsCandidate(current, () => null);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    process.platform === "win32"
      ? "host_terminal_development_context_invalid"
      : "host_terminal_platform_unsupported",
  );
  assert.equal(result.currentObservation, null);
  assert.equal(result.knownObservation, null);
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.cleanupAuthorized, false);
});

/**
 * 完全snapshotの正常fixtureを作る。
 *
 * @responsibility 全対象と固定producerを毎回独立して準備する。
 * @trace PRL-UT-006
 * @precondition N/A: 外部入力を必要としない。
 * @stimulus 固定値と十一の異なるIdentityを構成する。
 * @observation 完全intent候補。
 * @oracle Path、秘密、処置済みまたはAuthority fieldがない。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary N/A: 実Authority、実snapshotまたは参照発行ではない。
 */
function fixture() {
  return {
    contract: "crdd-coordinator/host-terminal-intent",
    contractRevision: 2,
    reference: "host-terminal.11111111-2222-4333-8444-555555555555",
    producer: {
      kind: "owned_cleanup",
      originalReferenceSha256: "a".repeat(64),
    },
    bindings: {
      runtimeSha256: "b".repeat(64),
      repositorySha256: "c".repeat(64),
      selectedUserSha256: "d".repeat(64),
    },
    target: {
      parentIdentity: identity(1),
      recoveryDirectoryIdentity: identity(2),
      terminalDirectoryIdentity: identity(3),
      root: { name: "crdd-coordinator-doctor-fixture", identity: identity(4) },
      marker: {
        name: `host-${"e".repeat(64)}.json`,
        identity: identity(5),
        sha256: "f".repeat(64),
      },
      children: {
        workspace: identity(6),
        "provider-home": identity(7),
        tmp: identity(8),
        events: identity(9),
        projection: identity(10),
        management: identity(11),
      },
    },
    cleanupOrder: ["root_absence", "marker_absence", "lease_terminal"],
  };
}

/**
 * 十二実体の新クラスを合成値だけで構成する。
 *
 * @responsibility 固定fileの期待条件と人間保守producerを試験する。
 * @trace PRL-UT-006
 * @precondition 既存十一実体fixtureが独立したmemory値として作られる。
 * @stimulus 合成UUID、対応markerと十二番目のfile実体を追加する。
 * @observation 新改訂版のintent候補。
 * @oracle 旧bytes、実Root、観測結果または削除承認を流用しない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary 純粋codec fixture。実ファイルのリンク数・内容を観測しない。
 */
function knownFixture() {
  const base = fixture();
  const nonce = "11111111-2222-4333-8444-555555555555";
  return {
    ...base,
    contractRevision: 3,
    resourceClass: "known_fixture_host_only_v1",
    producer: {
      kind: "human_orphan_cleanup",
      selectionSnapshotSha256: "a".repeat(64),
      originalReferenceUnknownReason: "original_reference_unconfirmed",
    },
    target: {
      ...base.target,
      root: { ...base.target.root, name: `crdd-coordinator-doctor-${nonce}` },
      marker: {
        ...base.target.marker,
        name: `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
      },
      knownFile: {
        parent: "workspace",
        name: "fixture.txt",
        identity: { ...identity(12), attributes: 0x80 },
        byteLength: 7,
        sha256:
          "be9351741a8155d01fd028d158546f1005e73ceeb0bb2d093335feac4144e450",
        linkCount: 1,
      },
    },
    cleanupOrder: [
      "file_absence",
      "root_absence",
      "marker_absence",
      "lease_terminal",
    ],
  };
}

/**
 * 二時点照合の本番bodyを全field差と部分失敗で反証する。
 *
 * @responsibility namespace一致だけで十二対象・file条件一致を発行させない。
 * @trace PRL-UT-006
 * @precondition Source bodyと独立snapshotをmemoryだけで扱う。Native返却だけ合成する。
 * @stimulus 全Identity六field、利用者・marker・file三値差、拒否、取消、構成失敗と観測例外。
 * @observation 両観測、呼出数、同じ初回値と停止理由・Process不明。
 * @oracle 全一致だけ成功し、初回後停止は一回、二回目失敗でも初回値を保持する。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary 実bodyの合成返却試験。実Native正常搬送・非使用は対象外。
 */
test("Host候補の共同照合は全十二fieldと部分失敗を保持する", () => {
  const packageManifest = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(Object.keys(packageManifest.exports).sort(), ["."]);
  const packageIndex = readFileSync(
    new URL("../../../src/index.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    packageIndex,
    /terminal-windows-adapter|evaluate(?:KnownFile)?HostTerminal|observe(?:KnownFile)?HostTerminalWindowsTarget/u,
  );
  const source = readFileSync(
    new URL("../../../src/host-record/record.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function observeTerminalWindowsCandidate<");
  const next = source.indexOf("\n/**", start);
  const end = next === -1 ? source.length : next;
  assert.ok(start >= 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const keys = [
    "volumeSerial",
    "fileIndexHigh",
    "fileIndexLow",
    "creationTimeLow",
    "creationTimeHigh",
    "attributes",
  ] as const;
  const evaluate = runInNewContext(`(${body})`, { identityKeys: keys }) as (
    ...args: unknown[]
  ) => ReturnType<typeof observeKnownFileHostTerminalWindowsCandidate>;
  for (const hasKnownFile of [false, true]) {
    for (const developmentContext of [undefined, Object.freeze({})]) {
      const candidate = knownFixture();
      const snapshot = {
        identities: Array.from(
          { length: hasKnownFile ? 12 : 11 },
          (_entry, index) => ({
            ...identity(index + 1),
            ...(index === 11 ? { attributes: 0x80 } : {}),
          }),
        ),
        selectedUserSha256: candidate.bindings.selectedUserSha256,
        markerSha256: candidate.target.marker.sha256,
        ...(hasKnownFile
          ? {
              knownFile: {
                byteLength: 7,
                linkCount: 1,
                sha256: candidate.target.knownFile.sha256,
              },
            }
          : {}),
      };
      const changedSnapshots = [];
      for (let i = 0; i < snapshot.identities.length; i += 1) {
        for (const key of keys) {
          const copy = structuredClone(snapshot);
          const changedIdentity = copy.identities[i];
          assert.ok(changedIdentity);
          changedIdentity[key] += 1;
          changedSnapshots.push(copy);
        }
      }
      for (const key of ["selectedUserSha256", "markerSha256"] as const) {
        const copy = structuredClone(snapshot);
        copy[key] = "0".repeat(64);
        changedSnapshots.push(copy);
      }
      if (hasKnownFile) {
        for (const key of ["byteLength", "linkCount", "sha256"] as const) {
          const copy = structuredClone(snapshot);
          assert.ok(copy.knownFile);
          if (key === "sha256") copy.knownFile.sha256 = "0".repeat(64);
          else copy.knownFile[key] += 1;
          changedSnapshots.push(copy);
        }
      }
      for (const [scenario, nextSnapshot] of [
        ["normal", snapshot],
        ...changedSnapshots.map(
          (value) => ["changedSnapshots", value] as const,
        ),
        ...[
          "current_failed",
          "known_failed",
          "current_unclosed",
          "known_unclosed",
          "current_cancelled",
          "known_cancelled",
          "factory_cancelled",
          "factory_null",
          "current_throw",
          "known_throw",
          "forged",
          "source_revision",
          "source_artifact",
          ...[
            "relativePath",
            "target",
            "protocolRevision",
            "rustToolchain",
            "byteLength",
          ].map((field) => `source_artifact_${field}`),
          "source_kind",
          "source_missing",
        ].map((value) => [value, snapshot] as const),
      ] as const) {
        let signal = new AbortController();
        const request = Object.freeze({ nonceHex: "01".repeat(32) });
        const nextRequest = Object.freeze({ nonceHex: "02".repeat(32) });
        const contexts = new WeakMap();
        if (scenario !== "forged")
          contexts.set(request, {
            namespace: null,
            selectedUser: null,
            rootName: candidate.target.root.name,
            markerName: candidate.target.marker.name,
          });
        let calls = 0;
        let firstReceipt: unknown = null;
        const invocation = [
          request,
          developmentContext,
          signal.signal,
          contexts,
          (actual: unknown) => {
            calls += 1;
            assert.equal(actual, calls === 1 ? request : nextRequest);
            if (scenario === (calls === 1 ? "current_throw" : "known_throw"))
              throw new Error("private_error");
            if (
              scenario ===
              (calls === 1 ? "current_cancelled" : "known_cancelled")
            )
              signal.abort();
            const receipt = { snapshot: calls === 1 ? snapshot : nextSnapshot };
            if (calls === 1) firstReceipt = receipt;
            const isFailed =
              scenario === (calls === 1 ? "current_failed" : "known_failed");
            return {
              status: isFailed ? "blocked" : "observed",
              reason: "fixture_observation",
              observation: receipt,
              executionSourceKind:
                scenario === "source_kind" && calls === 2
                  ? "different"
                  : developmentContext === undefined
                    ? "fixed_bootstrap_native_artifact"
                    : "fixed_development_candidate",
              nativeProvenance:
                scenario === "source_missing" && calls === 2
                  ? undefined
                  : {
                      repositoryRevision:
                        scenario === "source_revision" && calls === 2
                          ? { revisionIdentity: "unconfirmed" }
                          : null,
                      artifact: {
                        relativePath:
                          scenario === "source_artifact_relativePath" &&
                          calls === 2
                            ? "other.exe"
                            : "native.exe",
                        target:
                          scenario === "source_artifact_target" && calls === 2
                            ? "other"
                            : "windows",
                        protocolRevision:
                          scenario === "source_artifact_protocolRevision" &&
                          calls === 2
                            ? 4
                            : 3,
                        rustToolchain:
                          scenario === "source_artifact_rustToolchain" &&
                          calls === 2
                            ? "other"
                            : "fixed",
                        byteLength:
                          scenario === "source_artifact_byteLength" &&
                          calls === 2
                            ? 2
                            : 1,
                        sha256:
                          scenario === "source_artifact" && calls === 2
                            ? "different"
                            : "fixed",
                      },
                    },
              processEffectIssued: true,
              helperExitConfirmed:
                scenario !==
                (calls === 1 ? "current_unclosed" : "known_unclosed"),
              filesystemEffectIssued: false,
              runtimeAuthorityIssued: false,
              cleanupAuthorized: false,
            };
          },
          (value: Record<string, unknown>) => {
            assert.equal(value.rootName, candidate.target.root.name);
            assert.equal(value.markerName, candidate.target.marker.name);
            assert.equal(value.selectedUserSha256, snapshot.selectedUserSha256);
            assert.equal(
              JSON.stringify(value.namespace),
              JSON.stringify(snapshot.identities.slice(0, 3)),
            );
            if (scenario === "factory_cancelled") signal.abort();
            return scenario === "factory_null" ? null : nextRequest;
          },
          hasKnownFile,
        ];
        const result = evaluate(...invocation);
        for (const key of [
          "nativeProvenance",
          "executionSourceKind",
          "artifactVerifiedBeforeAndAfter",
        ]) {
          assert.equal(key in result, false, `${scenario}: ${key}`);
        }
        assert.equal(
          result.status,
          scenario === "normal" ? "observed" : "blocked",
          scenario,
        );
        if (scenario === "forged") assert.equal(calls, 0);
        else if (
          [
            "current_failed",
            "current_unclosed",
            "current_cancelled",
            "current_throw",
            "factory_null",
            "factory_cancelled",
          ].includes(scenario)
        )
          assert.equal(calls, 1, scenario);
        else assert.equal(calls, 2, scenario);
        assert.equal(result.currentObservation, firstReceipt);
        if (
          [
            "current_failed",
            "current_cancelled",
            "factory_null",
            "factory_cancelled",
          ].includes(scenario)
        ) {
          const leaked = body.replaceAll(
            "currentObservation: current.observation,",
            "...current, currentObservation: current.observation,",
          );
          assert.notEqual(leaked, body);
          calls = 0;
          signal = new AbortController();
          invocation[2] = signal.signal;
          const evaluateLeak = runInNewContext(`(${leaked})`, {
            identityKeys: keys,
          }) as typeof evaluate;
          assert.equal(
            "nativeProvenance" in evaluateLeak(...invocation),
            true,
            scenario,
          );
        }
        assert.equal(result.filesystemEffectIssued, false);
        assert.equal(result.runtimeAuthorityIssued, false);
        assert.equal(result.cleanupAuthorized, false);
        if (scenario.endsWith("throw")) {
          assert.equal(result.processEffectIssued, null);
          assert.equal(result.helperExitConfirmed, false);
        }
        if (scenario.startsWith("source_") && result.status === "blocked") {
          const mutated = body.replace("sourceMatches &&", "true &&");
          assert.notEqual(mutated, body);
          calls = 0;
          const evaluateMutant = runInNewContext(`(${mutated})`, {
            identityKeys: keys,
          }) as typeof evaluate;
          assert.equal(
            evaluateMutant(...invocation).status,
            "observed",
            scenario,
          );
        }
      }
    }
  }
});

/**
 * 専用候補入口の旧新混用と取消を実factoryで拒否する。
 *
 * @responsibility 私有登録の形状一致を専用Currentの証明にしない。
 * @trace PRL-UT-006
 * @precondition 固定新intentと無効Context。Nativeを起動しない。
 * @stimulus 旧要求、専用namespace-Known、clone、取消済みCurrentと正常形状を渡す。
 * @observation 二観測・Process Effect・停止理由。
 * @oracle 未登録とKnownを処置前拒否し、無効ContextでNative Effect 0。
 * @cleanup N/A: OS資源を取得しない。
 * @boundary 前提拒否だけ。正常なNative搬送の結果ではない。
 */
test("Host既知file候補は専用Currentだけを要求する", () => {
  const value = knownFixture();
  const current = createKnownFileHostTerminalCurrentObservationRequest({
    rootName: value.target.root.name,
    markerName: value.target.marker.name,
  });
  const old = createHostTerminalCurrentObservationRequest({
    rootName: value.target.root.name,
    markerName: value.target.marker.name,
  });
  const known = createKnownFileHostTerminalTargetObservationRequest({
    rootName: value.target.root.name,
    markerName: value.target.marker.name,
    namespace: [
      value.target.parentIdentity,
      value.target.recoveryDirectoryIdentity,
      value.target.terminalDirectoryIdentity,
    ],
    selectedUserSha256: value.bindings.selectedUserSha256,
  });
  assert.ok(current && old && known);
  for (const request of [old, known, { ...current }]) {
    const result = observeKnownFileHostTerminalWindowsCandidate(
      request,
      () => null,
    );
    assert.equal(result.reason, "host_terminal_current_request_required");
    assert.equal(result.processEffectIssued, false);
  }
  const cancelled = new AbortController();
  cancelled.abort();
  const stopped = observeKnownFileHostTerminalWindowsCandidate(
    current,
    () => null,
    cancelled.signal,
  );
  assert.equal(stopped.reason, "host_terminal_candidate_cancelled");
  assert.equal(stopped.helperExitConfirmed, true);
  const result = observeKnownFileHostTerminalWindowsCandidate(
    current,
    () => null,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.knownObservation, null);
});

/**
 * 正常Native応答の合成bytesを構成する。
 *
 * @responsibility 固定Protocolのoffsetと十一実体を現在factoryのnonceへ結ぶ。
 * @trace PRL-UT-006
 * @precondition 完全intentから作成した要求参照。
 * @stimulus 正常応答を所定の順序で符号化する。
 * @observation 応答bytesとSnapshot開始offset。
 * @oracle 現在parserが受理でき、個別fieldの反証へ使える。
 * @cleanup N/A: memory fixtureだけ。実Native観測ではない。
 * @boundary Native応答形式の局所代替。
 */
function terminalObservationResponse(request: HostTerminalObservationRequest) {
  const reason = "terminal_target_observed";
  const offset = 53 + reason.length + 14;
  const bytes = Buffer.alloc(offset + 328);
  bytes.write("CRDDHR02", 0, "ascii");
  bytes.writeUInt16LE(2, 8);
  Buffer.from(request.nonceHex, "hex").copy(bytes, 10);
  Buffer.from([1, 0, reason.length, 0, 255, 8, 2, 4, 2, 4, 8]).copy(bytes, 42);
  bytes.write(reason, 53, "ascii");
  bytes.fill(1, 53 + reason.length, offset);
  for (let index = 0; index < 11; index++) {
    const values = [1, 0, index + 1, 2, 1, index === 4 ? 0x80 : 0x10];
    values.forEach((value, field) => {
      bytes.writeUInt32LE(value, offset + index * 24 + field * 4);
    });
  }
  Buffer.from("d".repeat(64), "hex").copy(bytes, offset + 264);
  Buffer.from("f".repeat(64), "hex").copy(bytes, offset + 296);
  return { bytes, offset };
}

/**
 * 十二実体の独立合成応答を構成する。
 *
 * @responsibility fileを含む392bytesと九closeを専用要求のnonceへ結合する。
 * @trace PRL-UT-006
 * @precondition 専用factoryから得た私有要求参照。
 * @stimulus 全十二実体、固定file値、利用者とmarker Hashを固定順でencodeする。
 * @observation 完全frameとpayload開始位置。
 * @oracle 専用decoderだけが受理し、各不正fieldへ変更できる。
 * @cleanup N/A: memoryだけ。
 * @boundary Native応答の局所代替。実観測・終了は主張しない。
 */
function knownFileTerminalObservationResponse(
  request: HostTerminalObservationRequest,
) {
  const reason = "terminal_target_observed";
  const offset = 53 + reason.length + 15;
  const bytes = Buffer.alloc(offset + 392);
  bytes.write("CRDDKR03", 0, "ascii");
  bytes.writeUInt16LE(3, 8);
  Buffer.from(request.nonceHex, "hex").copy(bytes, 10);
  Buffer.from([1, 0, reason.length, 0, 255, 9, 2, 4, 2, 4, 9]).copy(bytes, 42);
  bytes.write(reason, 53, "ascii");
  bytes.fill(1, 53 + reason.length, offset);
  for (let index = 0; index < 12; index++) {
    [1, 0, index + 1, 2, 1, [4, 11].includes(index) ? 0x80 : 0x10].forEach(
      (value, field) => {
        bytes.writeUInt32LE(value, offset + index * 24 + field * 4);
      },
    );
  }
  Buffer.from("d".repeat(64), "hex").copy(bytes, offset + 288);
  Buffer.from("f".repeat(64), "hex").copy(bytes, offset + 320);
  bytes.writeUInt32LE(7, offset + 352);
  bytes.writeUInt32LE(1, offset + 356);
  Buffer.from(knownFixture().target.knownFile.sha256, "hex").copy(
    bytes,
    offset + 360,
  );
  return { bytes, offset };
}

/**
 * 専用Current／namespace-Knownを旧要求と区別する。
 *
 * @responsibility 十二実体と固定fileを保持し、三namespaceだけの期待値を全Knownにしない。
 * @trace PRL-UT-006
 * @precondition 独立した新旧の要求と合成frame。
 * @stimulus 正常二種類、clone、旧magic／要求、期待値差を与える。
 * @observation 全十二field、expectationKind、私有登録と相互拒否。
 * @oracle 新要求だけ受理し、namespace_knownとcurrentを区別、旧入口へはnull。
 * @cleanup N/A: 値解析だけ。
 * @boundary 専用Codec。実Nativeや非使用は対象外。
 */
test("Host既知file専用搬送は十二実体を保持し旧要求と混用しない", () => {
  const base = fixture();
  const names = {
    rootName: base.target.root.name,
    markerName: base.target.marker.name,
  };
  const current = createKnownFileHostTerminalCurrentObservationRequest(names);
  const known = createKnownFileHostTerminalTargetObservationRequest({
    ...names,
    namespace: [identity(1), identity(2), identity(3)],
    selectedUserSha256: base.bindings.selectedUserSha256,
  });
  const old = createHostTerminalCurrentObservationRequest(names);
  assert.ok(current);
  assert.ok(known);
  assert.ok(old);
  for (const request of [current, known]) {
    const sample = knownFileTerminalObservationResponse(request);
    const result = evaluateKnownFileHostTerminalObservationResponse(
      sample.bytes,
      request,
    );
    assert.equal(result?.status, "observed");
    assert.equal(
      result?.expectationKind,
      request === current ? "current" : "namespace_known",
    );
    assert.equal(result?.snapshot?.identities.length, 12);
    assert.equal(result?.snapshot?.identities[11]?.fileIndexLow, 12);
    assert.deepEqual(result?.snapshot?.knownFile, {
      byteLength: 7,
      linkCount: 1,
      sha256: knownFixture().target.knownFile.sha256,
    });
    assert.equal(result?.snapshot?.markerSha256, "f".repeat(64));
    assert.equal(Object.isFrozen(result?.snapshot?.knownFile), true);
    assert.equal(
      evaluateHostTerminalObservationResponse(sample.bytes, request),
      null,
    );
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(sample.bytes, {
        ...request,
      }),
      null,
    );
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(
        terminalObservationResponse(request).bytes,
        request,
      ),
      null,
    );
    const foreign = Buffer.from(sample.bytes);
    Buffer.from(old.nonceHex, "hex").copy(foreign, 10);
    assert.equal(evaluateHostTerminalObservationResponse(foreign, old), null);
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(foreign, old),
      null,
    );
    const rejected = observeKnownFileHostTerminalWindowsTarget(old, () => null);
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.processEffectIssued, false);
  }
  const mismatched = knownFileTerminalObservationResponse(known);
  mismatched.bytes.writeUInt32LE(999, mismatched.offset + 8);
  assert.equal(
    evaluateKnownFileHostTerminalObservationResponse(mismatched.bytes, known),
    null,
  );
  assert.equal(
    createKnownFileHostTerminalCurrentObservationRequest({
      ...names,
      path: "C:/outside",
    }),
    null,
  );
  assert.equal(
    createKnownFileHostTerminalTargetObservationRequest({
      ...names,
      namespace: [identity(1), identity(1), identity(3)],
      selectedUserSha256: "d".repeat(64),
    }),
    null,
  );
});

/**
 * 専用frameの全成功相関と十二番目の反例を検証する。
 *
 * @responsibility 欠落、余剰、file値、alias、終了不明を成功へ畳まない。
 * @trace PRL-UT-006
 * @precondition 合成した正常専用frame。
 * @stimulus nonce、revision、file値、全既存位置とのalias、各終了群、型を改変する。
 * @observation 専用decoderのnullと変更されない正常結果。
 * @oracle 全不正値を拒否し、位置11の部分失敗はSnapshotなしで保持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 専用frame検査。実OS終了を主張しない。
 */
test("Host十二実体frameはfile固定値と九対象・外側終了を共同確認する", () => {
  const request = createKnownFileHostTerminalCurrentObservationRequest({
    rootName: "crdd-coordinator-doctor-fixture",
    markerName: `host-${"a".repeat(64)}.json`,
  });
  assert.ok(request);
  const sample = knownFileTerminalObservationResponse(request);
  for (const position of [
    8,
    10,
    42,
    43,
    46,
    47,
    48,
    49,
    50,
    51,
    52,
    sample.offset + 352,
    sample.offset + 356,
    sample.offset + 360,
  ]) {
    const changed = Buffer.from(sample.bytes);
    const value = changed[position];
    assert.ok(value !== undefined);
    changed[position] = value ^ 0xff;
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(changed, request),
      null,
      `position ${position}`,
    );
  }
  for (const position of [
    53 + "terminal_target_observed".length,
    sample.offset - 9 - 4,
    sample.offset - 1,
  ]) {
    const changed = Buffer.from(sample.bytes);
    changed[position] = 0;
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(changed, request),
      null,
    );
  }
  for (let position = 0; position < 11; position++) {
    const changed = Buffer.from(sample.bytes);
    changed.copyWithin(
      sample.offset + 11 * 24,
      sample.offset + position * 24,
      sample.offset + position * 24 + 12,
    );
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(changed, request),
      null,
    );
  }
  for (const attributes of [0x10, 0x480]) {
    const changed = Buffer.from(sample.bytes);
    changed.writeUInt32LE(attributes, sample.offset + 11 * 24 + 20);
    assert.equal(
      evaluateKnownFileHostTerminalObservationResponse(changed, request),
      null,
    );
  }
  assert.equal(
    evaluateKnownFileHostTerminalObservationResponse(
      sample.bytes.subarray(0, -1),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateKnownFileHostTerminalObservationResponse(
      Buffer.concat([sample.bytes, Buffer.from([0])]),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateKnownFileHostTerminalObservationResponse(
      new Proxy(sample.bytes, {}),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateKnownFileHostTerminalObservationResponse(
      Buffer.from(new SharedArrayBuffer(sample.bytes.length)),
      request,
    ),
    null,
  );
  const reason = "terminal_known_file_read_failed";
  const failed = Buffer.alloc(53 + reason.length + 9);
  failed.write("CRDDKR03");
  failed.writeUInt16LE(3, 8);
  Buffer.from(request.nonceHex, "hex").copy(failed, 10);
  Buffer.from([0, 4, reason.length, 0, 11, 9, 0, 0, 0, 0, 9]).copy(failed, 42);
  failed.write(reason, 53);
  failed.fill(1, 53 + reason.length);
  failed[failed.length - 1] = 0;
  const partial = evaluateKnownFileHostTerminalObservationResponse(
    failed,
    request,
  );
  assert.equal(partial?.status, "blocked");
  assert.equal(partial?.snapshot, null);
  assert.equal(partial?.position, 11);
  assert.equal(partial?.targetCloses[8], false);
});

/**
 * 対象未試行の独立した読戻し応答を構成する。
 *
 * @responsibility 現在記録と外側取得/closeを対象観測成功へ変換しない。
 * @trace PRL-UT-006
 * @precondition 私有読戻し要求と固定state。
 * @stimulus Prepared/Publishedのframe、nonce、現在file Identityを固定順で書く。
 * @observation 完全bytesと外側/Identity offset。
 * @oracle production decoderの正負検証に使う。実OS観測は主張しない。
 * @cleanup N/A: 所有memoryのみ。
 * @boundary Native読戻しframeの局所代替。
 */
function terminalReadResponse(
  request: HostTerminalReadRequest,
  state = 2,
  recordClass: "eleven" | "known_file" = "eleven",
) {
  const outerReason = "terminal_target_not_attempted";
  const outer = Buffer.alloc(53 + outerReason.length + 6);
  outer.write(recordClass === "eleven" ? "CRDDHR02" : "CRDDKR03", 0, "ascii");
  outer.writeUInt16LE(recordClass === "eleven" ? 2 : 3, 8);
  Buffer.from(request.nonceHex, "hex").copy(outer, 10);
  Buffer.from([0, 2, outerReason.length, 0, 255, 0, 2, 4, 2, 4, 0]).copy(
    outer,
    42,
  );
  outer.write(outerReason, 53, "ascii");
  outer.fill(1, 53 + outerReason.length);
  const reason = "terminal_record_observed";
  const observationOffset = 55 + request.reference.length + reason.length;
  const identityOffset = observationOffset + outer.length;
  const bytes = Buffer.alloc(identityOffset + 24);
  bytes.write(recordClass === "eleven" ? "CRDDHB01" : "CRDDKB03", 0, "ascii");
  bytes.writeUInt16LE(recordClass === "eleven" ? 2 : 3, 8);
  Buffer.from(request.nonceHex, "hex").copy(bytes, 10);
  Buffer.from([1, state, 50, reason.length, 0]).copy(bytes, 42);
  bytes.writeUInt16LE(outer.length, 47);
  Buffer.from([1, 1, 1, 1, 1, 1]).copy(bytes, 49);
  bytes.write(request.reference, 55, "ascii");
  bytes.write(reason, 105, "ascii");
  outer.copy(bytes, observationOffset);
  [1, 0, 99, 2, 1, 0x80].forEach((value, index) => {
    bytes.writeUInt32LE(value, identityOffset + index * 4);
  });
  return { bytes, observationOffset, identityOffset };
}

/**
 * 読戻しの現在stateと部分終了を同参照で保持する。
 *
 * @responsibility Root/marker未試行を非使用や不存在へ畳まない。
 * @trace PRL-UT-006
 * @precondition 私有要求と独立合成frame。実OSは取得しない。
 * @stimulus 正常二state、現在Identity差、reader/外側終了不明と不正frameを解析する。
 * @observation observed/blocked/null、現在Identity、元理由、個別close。
 * @oracle 共同成立だけobserved、部分結果は保持、不正成功・相関は拒否。
 * @cleanup N/A: memoryのみ。
 * @boundary 読戻しProtocolの局所確認。実Native正常接続は別。
 */
test("Host記録読戻しは対象未試行と現在記録を区別する", () => {
  const request = createHostTerminalReadRequest(fixture());
  assert.ok(request);
  for (const state of [1, 2]) {
    const sample = terminalReadResponse(request, state);
    const result = evaluateHostTerminalReadResponse(sample.bytes, request);
    assert.equal(result?.status, "observed");
    assert.equal(result.state, state === 1 ? "prepared" : "published");
    assert.equal(result.observation.snapshot, null);
    assert.equal(result.observation.targetAcquired, 0);
    assert.equal(result.recordIdentity?.fileIndexLow, 99);
    assert.equal(result.generationAcquired, true);
    assert.equal(result.generationClose, true);
    sample.bytes.writeUInt32LE(100, sample.identityOffset + 8);
    assert.equal(
      evaluateHostTerminalReadResponse(sample.bytes, request)?.recordIdentity
        ?.fileIndexLow,
      100,
    );
  }
  const sample = terminalReadResponse(request);
  for (const position of [
    0,
    8,
    10,
    42,
    43,
    44,
    45,
    46,
    49,
    50,
    51,
    52,
    53,
    54,
    55,
    sample.identityOffset + 20,
    sample.observationOffset + 43,
    sample.observationOffset + 48,
    sample.identityOffset - 1,
  ]) {
    const changed = Buffer.from(sample.bytes);
    changed[position] = (changed[position] ?? 0) ^ 0xff;
    assert.equal(
      evaluateHostTerminalReadResponse(changed, request),
      null,
      `offset ${position}`,
    );
  }
  assert.equal(
    evaluateHostTerminalReadResponse(
      Buffer.concat([sample.bytes, Buffer.from([0])]),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateHostTerminalReadResponse(sample.bytes, { ...request }),
    null,
  );
  const partial = Buffer.from(sample.bytes);
  partial[42] = 0;
  partial[52] = 0;
  const result = evaluateHostTerminalReadResponse(partial, request);
  assert.equal(result?.status, "blocked");
  assert.equal(result.state, "published");
  assert.equal(result.readerClose, false);
  assert.equal(result.recordIdentity?.fileIndexLow, 99);
  assert.equal(result.reason, "terminal_record_observed");
  const oldRevision = Buffer.from(sample.bytes);
  oldRevision.writeUInt16LE(1, 8);
  assert.equal(evaluateHostTerminalReadResponse(oldRevision, request), null);
  const generationPartial = Buffer.from(sample.bytes);
  generationPartial[42] = 0;
  generationPartial[54] = 0;
  const partialResult = evaluateHostTerminalReadResponse(
    generationPartial,
    request,
  );
  assert.equal(partialResult?.status, "blocked");
  assert.equal(partialResult.state, "published");
  assert.equal(partialResult.recordIdentity?.fileIndexLow, 99);
  assert.equal(partialResult.generationAcquired, true);
  assert.equal(partialResult.generationClose, false);
  generationPartial[42] = 1;
  assert.equal(
    evaluateHostTerminalReadResponse(generationPartial, request),
    null,
  );
  generationPartial[42] = 0;
  generationPartial[53] = 0;
  generationPartial[54] = 1;
  assert.equal(
    evaluateHostTerminalReadResponse(generationPartial, request),
    null,
  );
  generationPartial[54] = 2;
  assert.equal(
    evaluateHostTerminalReadResponse(generationPartial, request),
    null,
  );
  const generationNotAcquired = Buffer.from(
    generationPartial.subarray(0, sample.identityOffset),
  );
  generationNotAcquired[43] = 0;
  generationNotAcquired[49] = 0;
  generationNotAcquired[50] = 0;
  generationNotAcquired[51] = 0;
  generationNotAcquired[52] = 2;
  assert.equal(
    evaluateHostTerminalReadResponse(generationNotAcquired, request)
      ?.generationClose,
    null,
  );
  assert.equal(
    evaluateHostTerminalReadResponse(generationNotAcquired, request)
      ?.generationAcquired,
    false,
  );
  assert.equal(
    readHostTerminalWindowsRecord({ ...request }, new AbortController().signal)
      .processEffectIssued,
    false,
  );
  const aborted = new AbortController();
  aborted.abort();
  assert.equal(
    readHostTerminalWindowsRecord(request, aborted.signal).processEffectIssued,
    false,
  );
  assert.equal(
    saveHostTerminalWindowsRecord(request, new AbortController().signal)
      .processEffectIssued,
    false,
  );
  assert.equal(
    readHostTerminalWindowsRecord(
      request,
      new AbortController().signal,
      () => null,
    ).recordEffectIssued,
    false,
  );
});

/**
 * 保存応答の局所fixtureを現在nonceと同参照へ結ぶ。
 *
 * @responsibility 二つの応答と部分receiptを閉形式で構成する。
 * @trace PRL-UT-006
 * @precondition 完全intentの私有保存要求がmemory内に存在する。
 * @stimulus 正常保存または部分保存の元理由と52bytes receiptをencodeする。
 * @observation 応答bytes、観測位置とreceipt位置。
 * @oracle production parserの共同成立・反証に使える。実保存は主張しない。
 * @cleanup N/A: OS資源を取得しない。
 * @boundary 保存frameの局所代替。
 */
function terminalSaveResponse(
  request: HostTerminalSaveRequest,
  hasSavedRecord = true,
  recordClass: "eleven" | "known_file" = "eleven",
) {
  const reason = hasSavedRecord
    ? "terminal_record_saved"
    : "terminal_capacity_release_unknown";
  const observed =
    recordClass === "eleven"
      ? terminalObservationResponse(request)
      : knownFileTerminalObservationResponse(request);
  const observationOffset = 52 + request.reference.length + reason.length;
  const receiptOffset = observationOffset + observed.bytes.length;
  const bytes = Buffer.alloc(receiptOffset + 52);
  bytes.write(recordClass === "eleven" ? "CRDDHW01" : "CRDDKW03", 0, "ascii");
  bytes.writeUInt16LE(recordClass === "eleven" ? 1 : 3, 8);
  Buffer.from(request.nonceHex, "hex").copy(bytes, 10);
  bytes[42] = hasSavedRecord ? 1 : 0;
  bytes[43] = request.reference.length;
  bytes[44] = reason.length;
  bytes.writeUInt16LE(observed.bytes.length, 49);
  bytes[51] = 1;
  bytes.write(request.reference, 52, "ascii");
  bytes.write(reason, 52 + request.reference.length, "ascii");
  observed.bytes.copy(bytes, observationOffset);
  const receipt = bytes.subarray(receiptOffset);
  receipt.fill(1, 0, 5);
  receipt[9] = hasSavedRecord ? 1 : 0;
  receipt[10] = 1;
  receipt[11] = 1;
  receipt[25] = 1;
  receipt[27] = 2;
  receipt.fill(1, 37, 45);
  receipt.fill(1, 49);
  return {
    bytes,
    observationOffset,
    snapshotOffset: observationOffset + observed.offset,
    receiptOffset,
  };
}

/**
 * 保存共同成立と部分保存を同参照で区別する。
 *
 * @responsibility nonce・参照・Known全体・容量/記録/全closeの不正成功を検出する。
 * @trace PRL-UT-006
 * @precondition 私有保存要求と正常／部分保存の合成応答。
 * @stimulus 正常と部分結果、各相関fieldの改変、欠落・余剰・偽要求を与える。
 * @observation saved/blocked/null、同参照、元理由と全receipt。
 * @oracle 正常だけsaved。部分公開とclose失敗はblockedでreceiptを保持する。
 * @cleanup N/A: memoryだけ。Native、Docker、Root操作0。
 * @boundary 専用保存搬送の局所代替。実Filesystem保存を証明しない。
 */
test("Host保存応答は全Known対象と部分receiptの共同成立だけ受理する", () => {
  const request = createHostTerminalSaveRequest(fixture());
  assert.ok(request);
  const encoded = terminalSaveResponse(request);
  const result = evaluateHostTerminalSaveResponse(encoded.bytes, request);
  assert.equal(result?.status, "saved");
  assert.equal(result.reference, fixture().reference);
  assert.equal(result.recordEffectIssued, true);
  assert.equal(result.receipt?.length, 52);
  const partial = evaluateHostTerminalSaveResponse(
    terminalSaveResponse(request, false).bytes,
    request,
  );
  assert.equal(partial?.status, "blocked");
  assert.equal(partial.recordEffectIssued, true);
  assert.equal(partial.reasons[0], "terminal_capacity_release_unknown");
  assert.equal(partial.receipt?.[9], 0);
  for (const position of [
    0,
    8,
    10,
    43,
    49,
    51,
    52,
    encoded.snapshotOffset + 3 * 24 + 8,
    encoded.snapshotOffset + 296,
    encoded.receiptOffset + 9,
    encoded.receiptOffset + 25,
    encoded.receiptOffset + 43,
    encoded.receiptOffset + 51,
  ]) {
    const changed = Buffer.from(encoded.bytes);
    changed[position] = (changed[position] ?? 0) ^ 0xff;
    assert.equal(
      evaluateHostTerminalSaveResponse(changed, request),
      null,
      `offset ${position}`,
    );
  }
  assert.equal(
    evaluateHostTerminalSaveResponse(
      Buffer.concat([encoded.bytes, Buffer.from([0])]),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateHostTerminalSaveResponse(encoded.bytes.subarray(0, -1), request),
    null,
  );
  assert.equal(
    evaluateHostTerminalSaveResponse(encoded.bytes, { ...request }),
    null,
  );
  assert.equal(
    evaluateHostTerminalSaveResponse(new Proxy(encoded.bytes, {}), request),
    null,
  );
});

/**
 * 保存要求の不正・取消・未検証実行Contextを起動前に止める。
 *
 * @responsibility factoryや形状から実保存・清掃許可を発行しない。
 * @trace PRL-UT-006
 * @precondition 正常fixtureの私有要求と取消Signal。
 * @stimulus clone、取消済み要求、無効開発Contextと不正intentを渡す。
 * @observation 同参照、停止理由、Process/記録EffectとNative結果。
 * @oracle 起動・記録Effect 0、Native結果なし。既知参照は保持する。
 * @cleanup N/A: NativeやFilesystemを取得しない。
 * @boundary 処置前拒否だけ。署名実行・実保存は対象外。
 */
test("Host保存Adapterは偽参照・取消・未検証ContextでEffect 0を保持する", () => {
  const request = createHostTerminalSaveRequest(fixture());
  assert.ok(request);
  assert.equal(createHostTerminalSaveRequest(null), null);
  const cancelled = new AbortController();
  cancelled.abort();
  for (const result of [
    saveHostTerminalWindowsRecord({ ...request }, new AbortController().signal),
    saveHostTerminalWindowsRecord(request, cancelled.signal),
    saveHostTerminalWindowsRecord(
      request,
      new AbortController().signal,
      () => null,
    ),
  ]) {
    assert.equal(result.status, "blocked");
    assert.equal(result.nativeSave, null);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.recordEffectIssued, false);
    assert.equal(result.cleanupAuthorized, false);
    assert.equal(result.runtimeAuthorityIssued, false);
  }
});

/**
 * 応答とexitの不一致でも同参照の部分結果を失わないことを確認する。
 *
 * @responsibility 本番接続関数の終了相関とEffect分類を、合成Worker結果で反証する。
 * @trace PRL-UT-006
 * @precondition 現Sourceの同じ私有関数を型除去してVMへ渡し、Native起動だけを代替する。
 * @stimulus 保存・読戻しの正常frame、部分frame、不正frameと一致／不一致exitを与える。
 * @observation status、同参照、部分receipt、Process終了確認と記録Effect。
 * @oracle 相関不成立はblocked。正常decode済み結果は保持し、保存Effectはnull、読取りEffectはfalse。
 * @cleanup N/A: 実Process、Native、Filesystem書込みは発行しない。
 * @boundary 合成した搬送境界であり、実署名Runtimeと実保存は証明しない。
 */
test("Host記録Adapterはexit不一致の部分receiptを保持して停止する", () => {
  const source = readFileSync(
    new URL("../../../src/host-record/record.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function executeHostTerminalRecordRequest<");
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  assert.equal(
    source.indexOf("function executeHostTerminalRecordRequest<", start + 1),
    -1,
  );
  const functionSource = stripTypeScriptTypes(source.slice(start, end));
  for (const recordClass of ["eleven", "known_file"] as const) {
    const candidate = recordClass === "eleven" ? fixture() : knownFixture();
    const createSave =
      recordClass === "eleven"
        ? createHostTerminalSaveRequest
        : createKnownFileHostTerminalSaveRequest;
    const createRead =
      recordClass === "eleven"
        ? createHostTerminalReadRequest
        : createKnownFileHostTerminalReadRequest;
    const decodeSave =
      recordClass === "eleven"
        ? evaluateHostTerminalSaveResponse
        : evaluateKnownFileHostTerminalSaveResponse;
    const decodeRead =
      recordClass === "eleven"
        ? evaluateHostTerminalReadResponse
        : evaluateKnownFileHostTerminalReadResponse;
    for (const mode of ["save", "read"] as const) {
      const request =
        mode === "save" ? createSave(candidate) : createRead(candidate);
      assert.ok(request);
      const full =
        mode === "save"
          ? terminalSaveResponse(
              request as HostTerminalSaveRequest,
              true,
              recordClass,
            ).bytes
          : terminalReadResponse(
              request as HostTerminalReadRequest,
              2,
              recordClass,
            ).bytes;
      const cases = [
        { output: full, exit: 0, correlated: true },
        { output: full, exit: 2, correlated: false },
        { output: Buffer.from([0]), exit: 2, correlated: false },
        ...(mode === "save"
          ? [
              {
                output: terminalSaveResponse(
                  request as HostTerminalSaveRequest,
                  false,
                  recordClass,
                ).bytes,
                exit: 2,
                correlated: true,
              },
              {
                output: terminalSaveResponse(
                  request as HostTerminalSaveRequest,
                  false,
                  recordClass,
                ).bytes,
                exit: 0,
                correlated: false,
              },
            ]
          : []),
      ];
      for (const item of cases) {
        const context = new WeakMap([
          [request, { reference: request.reference, bytesBase64: "AA==" }],
        ]);
        const artifact = Object.freeze({ fixture: "verified" });
        let launches = 0;
        const executeRecordRequest = runInNewContext(`(${functionSource})`, {
          Buffer,
          path,
          process: { platform: "win32" },
          saveRequestContexts: context,
          readRequestContexts: context,
          bundledDistributionRoot: "synthetic-fixed-distribution",
          PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: "synthetic.exe",
          MAX_SAVE_RESPONSE_BYTES: 2048,
          inspectPlatformAccessNativeGitProvenanceCandidate: () => ({
            artifact,
            repositoryRevision: Object.freeze({ revisionIdentity: "fixture" }),
          }),
          observePlatformAccessArtifactCandidate: () => ({
            status: "candidate",
            artifact,
          }),
          beginPlatformAccessArtifactObservation: () => ({
            token: "fixture",
            artifact,
          }),
          beginPlatformAccessBootstrapObservation: () => ({
            token: "fixture",
            artifact,
          }),
          verifyPlatformAccessArtifactObservation: () => true,
          createWindowsHostTerminalHelperEnvironment: () => ({}),
          evaluateHostTerminalSaveResponse,
          evaluateHostTerminalReadResponse,
          spawnSync: (_executable: unknown, args: readonly string[]) => {
            assert.deepEqual(Array.from(args), [
              `--host-terminal-${recordClass === "known_file" ? "known-file-" : ""}${mode}`,
            ]);
            launches += 1;
            return {
              pid: 1,
              error: undefined,
              signal: null,
              status: item.exit,
              stderr: Buffer.alloc(0),
              stdout: item.output,
            };
          },
        }) as (...args: unknown[]) => {
          status: string;
          reason: string;
          reference: string | null;
          helperExitConfirmed: boolean;
          recordEffectIssued: boolean | null;
          runtimeAuthorityIssued: boolean;
          cleanupAuthorized: boolean;
          nativeSave: ReturnType<typeof evaluateHostTerminalSaveResponse>;
          nativeRead: ReturnType<typeof evaluateHostTerminalReadResponse>;
        };
        const result = executeRecordRequest(
          request,
          mode,
          new AbortController().signal,
          undefined,
          context,
          decodeSave,
          decodeRead,
          `--host-terminal-${recordClass === "known_file" ? "known-file-" : ""}${mode}`,
        );
        const decoded:
          | ReturnType<typeof evaluateHostTerminalSaveResponse>
          | ReturnType<typeof evaluateHostTerminalReadResponse>
          | ReturnType<typeof evaluateKnownFileHostTerminalSaveResponse>
          | ReturnType<typeof evaluateKnownFileHostTerminalReadResponse> =
          mode === "save"
            ? decodeSave(item.output, request as HostTerminalSaveRequest)
            : decodeRead(item.output, request as HostTerminalReadRequest);
        assert.equal(launches, 1);
        assert.equal(result.reference, request.reference);
        assert.equal(result.helperExitConfirmed, true);
        assert.equal(
          result.status,
          item.correlated && decoded?.status !== "blocked"
            ? "completed"
            : "blocked",
        );
        assert.deepEqual(
          mode === "save" ? result.nativeSave : result.nativeRead,
          decoded,
        );
        assert.equal(
          result.recordEffectIssued,
          mode === "read" ? false : item.correlated ? true : null,
        );
        assert.equal(result.runtimeAuthorityIssued, false);
        assert.equal(result.cleanupAuthorized, false);
        if (!item.correlated)
          assert.equal(result.reason, `host_terminal_${mode}_response_invalid`);
      }
    }
  }
});

/**
 * 十二実体の完全保存要求を正規文書から再構成して確認する。
 *
 * @responsibility 専用frameの十二Identity・file条件・同参照・本文Hashの欠落を検出する。
 * @trace PRL-UT-006
 * @precondition 現factory Sourceと独立した正規intentをmemoryだけで扱う。
 * @stimulus nonce登録だけを代替し、現factoryから出た全bytesを独立offsetで確認する。
 * @observation header471、上限8847、全十二六fieldと完全本文。
 * @oracle Native契約の固定配置と正規codec結果へ全fieldが一致する。
 * @cleanup N/A: Native、Filesystem、Processを発行しない。
 * @boundary Sourceをそのまま実行するmemory搬送確認。実OS保存は別義務。
 */
test("Host既知file保存要求は十二実体と完全本文を専用配置へ保持する", () => {
  const source = readFileSync(
    new URL("../../../src/host-record/record.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function createTerminalRecordSaveRequest(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  const observations = new WeakMap();
  const knownObservations = new WeakMap();
  const saves = new WeakMap();
  const knownSaves = new WeakMap();
  const factory = runInNewContext(
    `(${stripTypeScriptTypes(source.slice(start, end))})`,
    {
      Buffer,
      identityKeys: [
        "volumeSerial",
        "fileIndexHigh",
        "fileIndexLow",
        "creationTimeLow",
        "creationTimeHigh",
        "attributes",
      ],
      readHostRecordProjection,
      requestContexts: observations,
      knownFileRequestContexts: knownObservations,
      saveRequestContexts: saves,
      knownFileSaveRequestContexts: knownSaves,
      createTerminalTargetObservationRequest: (
        _value: unknown,
        recordClass: string,
      ) => {
        const request = Object.freeze({ nonceHex: "01".repeat(32) });
        (recordClass === "eleven" ? observations : knownObservations).set(
          request,
          request,
        );
        return request;
      },
    },
  ) as (...args: unknown[]) => HostTerminalSaveRequest | null;
  for (const recordClass of ["eleven", "known_file"] as const) {
    const candidate = recordClass === "eleven" ? fixture() : knownFixture();
    const encoded =
      recordClass === "eleven"
        ? encodeFixtureRecord(candidate)
        : encodeFixtureRecord(candidate);
    const request = factory(projectFixture(candidate), recordClass);
    assert.ok(request);
    const context = (recordClass === "eleven" ? saves : knownSaves).get(
      request,
    );
    assert.ok(context);
    const bytes = Buffer.from(context.bytesBase64, "base64");
    const header = recordClass === "eleven" ? 407 : 471;
    const user = recordClass === "eleven" ? 311 : 335;
    const expectedIds = [
      candidate.target.parentIdentity,
      candidate.target.recoveryDirectoryIdentity,
      candidate.target.terminalDirectoryIdentity,
      candidate.target.root.identity,
      candidate.target.marker.identity,
      ...Object.values(candidate.target.children),
      ...("knownFile" in candidate.target
        ? [candidate.target.knownFile.identity]
        : []),
    ];
    assert.equal(
      bytes.subarray(0, 8).toString("ascii"),
      recordClass === "eleven" ? "CRDDHS01" : "CRDDKS03",
    );
    assert.equal(bytes.readUInt16LE(8), recordClass === "eleven" ? 1 : 3);
    assert.equal(bytes.subarray(10, 42).toString("hex"), request.nonceHex);
    assert.equal(bytes[42], 50);
    const rootLength = Buffer.byteLength(encoded.intent.target.root.name);
    const markerLength = Buffer.byteLength(encoded.intent.target.marker.name);
    assert.equal(bytes[43], rootLength);
    assert.equal(bytes[44], markerLength);
    if (recordClass === "known_file") assert.equal(rootLength, 60);
    assert.equal(bytes.readUInt16LE(45), Buffer.byteLength(encoded.serialized));
    assert.ok(bytes.length <= (recordClass === "eleven" ? 8841 : 8847));
    assert.equal(expectedIds.length, recordClass === "eleven" ? 11 : 12);
    expectedIds.forEach((id, index) => {
      [
        "volumeSerial",
        "fileIndexHigh",
        "fileIndexLow",
        "creationTimeLow",
        "creationTimeHigh",
        "attributes",
      ].forEach((key, field) => {
        assert.equal(
          bytes.readUInt32LE(47 + 24 * index + 4 * field),
          id[key as keyof HostTerminalWindowsIdentity],
        );
      });
    });
    assert.equal(
      bytes.subarray(user, user + 32).toString("hex"),
      encoded.intent.bindings.selectedUserSha256,
    );
    assert.equal(
      bytes.subarray(user + 32, user + 64).toString("hex"),
      encoded.intent.target.marker.sha256,
    );
    if (recordClass === "known_file") {
      assert.equal(bytes.readUInt32LE(399), 7);
      assert.equal(bytes.readUInt32LE(403), 1);
      assert.equal(
        bytes.subarray(407, 439).toString("hex"),
        knownFixture().target.knownFile.sha256,
      );
    }
    assert.equal(
      bytes.subarray(header - 32, header).toString("hex"),
      encoded.sha256,
    );
    assert.equal(
      bytes.subarray(header, header + 50).toString("ascii"),
      encoded.intent.reference,
    );
    assert.equal(
      bytes.subarray(header + 50, header + 50 + rootLength).toString("ascii"),
      encoded.intent.target.root.name,
    );
    assert.equal(
      bytes
        .subarray(
          header + 50 + rootLength,
          header + 50 + rootLength + markerLength,
        )
        .toString("ascii"),
      encoded.intent.target.marker.name,
    );
    assert.equal(
      bytes.subarray(header + 50 + rootLength + markerLength).toString("utf8"),
      encoded.serialized,
    );
  }
});

/**
 * 十二実体保存の全Known fieldと部分結果を反証する。
 *
 * @responsibility file欠落、新旧混用、偽要求と不正成功を拒否する。
 * @trace PRL-UT-006
 * @precondition 専用private factoryと独立した合成正常応答。
 * @stimulus 十二Identity・利用者・marker・file条件の全byte、切断と混用を与える。
 * @observation saved／blocked／null、file値、receiptと同参照。
 * @oracle 正常だけsaved、部分保存は保持、全Known差と切断はnull。
 * @cleanup N/A: memoryのみ。実RootやNativeを起動しない。
 * @boundary 専用保存decoder。実保存・非使用は証明しない。
 */
test("Host既知file保存応答は十二Knownと部分receiptを保持する", () => {
  const request = createKnownFileHostTerminalSaveRequest(knownFixture());
  const old = createHostTerminalSaveRequest(fixture());
  const read = createKnownFileHostTerminalReadRequest(knownFixture());
  assert.ok(request && old && read);
  assert.equal(createKnownFileHostTerminalSaveRequest(fixture()), null);
  assert.equal(createKnownFileHostTerminalReadRequest(fixture()), null);
  const sample = terminalSaveResponse(request, true, "known_file");
  const result = evaluateKnownFileHostTerminalSaveResponse(
    sample.bytes,
    request,
  );
  assert.equal(result?.status, "saved");
  assert.equal(result.reference, request.reference);
  assert.equal(result.recordEffectIssued, true);
  assert.equal(result.observation.snapshot?.identities.length, 12);
  assert.deepEqual(result.observation.snapshot?.knownFile, {
    byteLength: 7,
    linkCount: 1,
    sha256: knownFixture().target.knownFile.sha256,
  });
  assert.equal(Object.isFrozen(result.observation.snapshot?.knownFile), true);
  for (let field = 0; field < 392; field++) {
    const changed = Buffer.from(sample.bytes);
    const position = sample.snapshotOffset + field;
    changed[position] = (changed[position] ?? 0) ^ 1;
    assert.equal(
      evaluateKnownFileHostTerminalSaveResponse(changed, request),
      null,
      `Known byte ${field}`,
    );
  }
  for (let size = 0; size < sample.bytes.length; size++)
    assert.equal(
      evaluateKnownFileHostTerminalSaveResponse(
        sample.bytes.subarray(0, size),
        request,
      ),
      null,
      `truncated ${size}`,
    );
  assert.equal(
    evaluateKnownFileHostTerminalSaveResponse(
      Buffer.concat([sample.bytes, Buffer.from([0])]),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateKnownFileHostTerminalSaveResponse(sample.bytes, { ...request }),
    null,
  );
  assert.equal(
    evaluateKnownFileHostTerminalSaveResponse(sample.bytes, old),
    null,
  );
  assert.equal(
    evaluateKnownFileHostTerminalSaveResponse(sample.bytes, read),
    null,
  );
  assert.equal(evaluateHostTerminalSaveResponse(sample.bytes, request), null);
  const oldFrame = terminalSaveResponse(request).bytes;
  assert.equal(
    evaluateKnownFileHostTerminalSaveResponse(oldFrame, request),
    null,
  );
  const innerOld = Buffer.from(sample.bytes);
  innerOld.write("CRDDHR02", sample.observationOffset, "ascii");
  assert.equal(
    evaluateKnownFileHostTerminalSaveResponse(innerOld, request),
    null,
  );
  const partial = evaluateKnownFileHostTerminalSaveResponse(
    terminalSaveResponse(request, false, "known_file").bytes,
    request,
  );
  assert.equal(partial?.status, "blocked");
  assert.equal(partial.reference, request.reference);
  assert.equal(partial.recordEffectIssued, true);
  assert.equal(partial.reasons[0], "terminal_capacity_release_unknown");
  assert.equal(partial.observation.snapshot?.identities.length, 12);
  const controller = new AbortController();
  controller.abort();
  const stopped = saveKnownFileHostTerminalWindowsRecord(
    request,
    controller.signal,
  );
  assert.equal(stopped.reference, request.reference);
  assert.equal(stopped.processEffectIssued, false);
  assert.equal(stopped.recordEffectIssued, false);
  assert.equal(
    saveHostTerminalWindowsRecord(request, controller.signal).reference,
    null,
  );
  assert.equal(
    saveKnownFileHostTerminalWindowsRecord(old, controller.signal).reference,
    null,
  );
});

/**
 * 専用読戻しの対象未試行と現在記録を区別する。
 *
 * @responsibility Root／file再取得を要求せず、新旧要求・応答混用を拒否する。
 * @trace PRL-UT-006
 * @precondition 専用private読戻し要求と独立した合成応答。
 * @stimulus 二state、reader終了不明、切断、偽要求・旧frame・対象取得を与える。
 * @observation observed／blocked／null、同参照、個別closeと対象取得0。
 * @oracle 共同成立のみobserved、部分結果は保持、混用・不正成功はnull。
 * @cleanup N/A: memoryだけ。対象・記録・Process変更0。
 * @boundary Reader搬送の局所確認。実OS読戻しは別義務。
 */
test("Host既知file読戻しは対象未試行と同参照を保持する", () => {
  const request = createKnownFileHostTerminalReadRequest(knownFixture());
  const old = createHostTerminalReadRequest(fixture());
  const save = createKnownFileHostTerminalSaveRequest(knownFixture());
  assert.ok(request && old && save);
  for (const state of [1, 2]) {
    const sample = terminalReadResponse(request, state, "known_file");
    const result = evaluateKnownFileHostTerminalReadResponse(
      sample.bytes,
      request,
    );
    assert.equal(result?.status, "observed");
    assert.equal(result.reference, request.reference);
    assert.equal(result.state, state === 1 ? "prepared" : "published");
    assert.equal(result.observation.snapshot, null);
    assert.equal(result.observation.targetAcquired, 0);
    assert.equal(result.observation.targetCloses.length, 0);
    assert.equal(result.observation.expectationKind, "namespace_known");
    const partial = Buffer.from(sample.bytes);
    partial[42] = 0;
    partial[52] = 0;
    const blocked = evaluateKnownFileHostTerminalReadResponse(partial, request);
    assert.equal(blocked?.status, "blocked");
    assert.equal(blocked.readerClose, false);
    assert.equal(blocked.recordIdentity?.fileIndexLow, 99);
    assert.equal(blocked.reference, request.reference);
    partial[42] = 1;
    assert.equal(
      evaluateKnownFileHostTerminalReadResponse(partial, request),
      null,
    );
    for (let size = 0; size < sample.bytes.length; size++)
      assert.equal(
        evaluateKnownFileHostTerminalReadResponse(
          sample.bytes.subarray(0, size),
          request,
        ),
        null,
      );
    assert.equal(
      evaluateKnownFileHostTerminalReadResponse(sample.bytes, { ...request }),
      null,
    );
    assert.equal(
      evaluateKnownFileHostTerminalReadResponse(sample.bytes, old),
      null,
    );
    assert.equal(
      evaluateKnownFileHostTerminalReadResponse(sample.bytes, save),
      null,
    );
    assert.equal(evaluateHostTerminalReadResponse(sample.bytes, request), null);
    assert.equal(
      evaluateKnownFileHostTerminalReadResponse(
        terminalReadResponse(request, state).bytes,
        request,
      ),
      null,
    );
    const innerOld = Buffer.from(sample.bytes);
    innerOld.write("CRDDHR02", sample.observationOffset, "ascii");
    assert.equal(
      evaluateKnownFileHostTerminalReadResponse(innerOld, request),
      null,
    );
  }
  const controller = new AbortController();
  controller.abort();
  const stopped = readKnownFileHostTerminalWindowsRecord(
    request,
    controller.signal,
  );
  assert.equal(stopped.reference, request.reference);
  assert.equal(stopped.processEffectIssued, false);
  assert.equal(stopped.recordEffectIssued, false);
  assert.equal(
    readHostTerminalWindowsRecord(request, controller.signal).reference,
    null,
  );
  assert.equal(
    readKnownFileHostTerminalWindowsRecord(old, controller.signal).reference,
    null,
  );
  assert.equal(
    readKnownFileHostTerminalWindowsRecord(save, controller.signal).reference,
    null,
  );
});

/**
 * 対象の未取得Identityを要求せず、初回確認を開始できることを検証する。
 *
 * @responsibility 対象確認と完全intent作成の循環をなくし、期待値を不変に保持する。
 * @trace PRL-UT-006
 * @precondition 保存境界三Identity、利用者と固定対象名だけを持つ局所値。
 * @stimulus 要求作成後に元値を変更し、欠落・alias・Accessorの反例を与える。
 * @observation 要求の受理、正常応答解析、元値変更後の結果とGetter回数。
 * @oracle 完全intentなしでも受理し、元値変更は反映せず、不正値は実行なしで拒否する。
 * @cleanup N/A: 私有要求と合成応答だけを扱い、OS資源を生成しない。
 * @boundary 初回要求の局所確認。期待値の実由来と実回復は証明しない。
 */
test("Host対象の初回要求は完全intentなしで期待値を固定する", () => {
  const base = fixture();
  const input = {
    rootName: base.target.root.name,
    markerName: base.target.marker.name,
    namespace: [
      { ...base.target.parentIdentity },
      { ...base.target.recoveryDirectoryIdentity },
      { ...base.target.terminalDirectoryIdentity },
    ],
    selectedUserSha256: base.bindings.selectedUserSha256,
  };
  const request = createHostTerminalTargetObservationRequest(input);
  assert.ok(request);
  assert.equal(Object.isFrozen(request), true);
  const response = terminalObservationResponse(request);
  const firstIdentity = input.namespace[0];
  assert.ok(firstIdentity);
  firstIdentity.fileIndexLow = 999;
  input.selectedUserSha256 = "a".repeat(64);
  assert.equal(
    evaluateHostTerminalObservationResponse(response.bytes, request)?.status,
    "observed",
  );
  assert.equal(createHostTerminalObservationRequest(input), null);
  const valid = {
    ...input,
    namespace: [identity(1), identity(2), identity(3)],
  };
  for (const invalid of [
    { ...valid, selectedUserSha256: "0".repeat(64) },
    { ...valid, rootName: "../outside" },
    { ...valid, namespace: [identity(1), identity(1), identity(3)] },
    { ...valid, namespace: [identity(1), identity(2)] },
    { ...valid, namespace: [identity(1), identity(2), identity(5)] },
    { ...valid, path: "C:\\outside" },
    { ...valid, selectedUserSha256: undefined },
  ])
    assert.equal(createHostTerminalTargetObservationRequest(invalid), null);
  let executed = 0;
  const accessor = Object.defineProperty({ ...valid }, "rootName", {
    enumerable: true,
    get: () => {
      executed += 1;
      return valid.rootName;
    },
  });
  const proxy = new Proxy(valid, {
    ownKeys: () => {
      executed += 1;
      return [];
    },
  });
  assert.equal(createHostTerminalTargetObservationRequest(accessor), null);
  assert.equal(createHostTerminalTargetObservationRequest(proxy), null);
  assert.equal(executed, 0);
});

/**
 * 初回Currentと保持した期待値によるKnown照合を区別する。
 *
 * @responsibility 初回結果から過去の連続性を生成せず、別呼出しの比較を要求する。
 * @trace PRL-UT-006
 * @precondition 固定二名と同じ対象の合成Native応答。
 * @stimulus Currentを解析し、その三実体と利用者を別Known要求に保持して差分を与える。
 * @observation 要求種別、Snapshot、Known不一致拒否と不正入力拒否。
 * @oracle CurrentだけではKnownにならず、別要求の相関・実体一致だけがKnownとなる。
 * @cleanup N/A: 合成bytesだけ。Native、実Root、保護変更、削除を行わない。
 * @boundary 要求種別と応答解析の局所試験。実OS二ACL確認は別の実境界義務。
 */
test("Host対象Current取得は別呼出しのKnown照合と区別される", () => {
  const base = fixture();
  const names = {
    rootName: base.target.root.name,
    markerName: base.target.marker.name,
  };
  const current = createHostTerminalCurrentObservationRequest(names);
  assert.ok(current);
  const first = terminalObservationResponse(current);
  const captured = evaluateHostTerminalObservationResponse(
    first.bytes,
    current,
  );
  assert.equal(captured?.expectationKind, "current");
  assert.ok(captured.snapshot);
  const known = createHostTerminalTargetObservationRequest({
    ...names,
    namespace: captured.snapshot.identities.slice(0, 3),
    selectedUserSha256: captured.snapshot.selectedUserSha256,
  });
  assert.ok(known);
  const second = terminalObservationResponse(known);
  assert.equal(
    evaluateHostTerminalObservationResponse(second.bytes, known)
      ?.expectationKind,
    "known",
  );
  second.bytes.writeUInt32LE(99, second.offset + 8);
  assert.equal(
    evaluateHostTerminalObservationResponse(second.bytes, known),
    null,
  );
  first.bytes.fill(0, first.offset + 264, first.offset + 296);
  assert.equal(
    evaluateHostTerminalObservationResponse(first.bytes, current),
    null,
  );
  assert.equal(
    createHostTerminalCurrentObservationRequest({
      ...names,
      path: "C:\\outside",
    }),
    null,
  );
  assert.equal(
    createHostTerminalCurrentObservationRequest({ rootName: names.rootName }),
    null,
  );
});

/**
 * Native成功の共同条件を満たす応答だけを受理する。
 *
 * @responsibility nonce、実体、boolean、取得/終了対応の取り違えを検出する。
 * @trace PRL-UT-006
 * @precondition 現在のfactory/parserと合成応答。実OSを呼ばない。
 * @stimulus 正常応答と一条件ずつ変更した反例を解析する。
 * @observation observed、null、返却した十一Identity。
 * @oracle 全条件一致のみobserved。型・相異・独立期待値・利用者・終了の差は拒否。
 * @cleanup N/A: bytesと私有WeakMapだけ。Root、Docker、Provider操作0。
 * @boundary Protocol局所確認。実child終了と配布実体は別の確認対象。
 */
test("Host対象Native応答は独立期待値と全closeへ相関した成功だけ受理する", () => {
  const request = createHostTerminalObservationRequest(fixture());
  assert.ok(request);
  const { bytes, offset } = terminalObservationResponse(request);
  const observed = evaluateHostTerminalObservationResponse(bytes, request);
  assert.equal(observed?.status, "observed");
  assert.equal(observed.snapshot?.identities.length, 11);
  assert.equal(observed.snapshot?.identities[0]?.creationTimeLow, 2);
  assert.equal(observed.snapshot?.identities[0]?.creationTimeHigh, 1);
  for (const position of [
    0,
    8,
    10,
    42,
    43,
    46,
    47,
    50,
    51,
    52,
    53 + 23,
    offset,
    offset + 264,
  ]) {
    const changed = Buffer.from(bytes);
    changed.writeUInt8(changed.readUInt8(position) ^ 0xff, position);
    assert.equal(
      evaluateHostTerminalObservationResponse(changed, request),
      null,
      `offset ${position}`,
    );
  }
  const falseClose = Buffer.from(bytes);
  falseClose[53 + 23] = 0;
  assert.equal(
    evaluateHostTerminalObservationResponse(falseClose, request),
    null,
  );
  const duplicate = Buffer.from(bytes);
  bytes.copy(duplicate, offset + 24, offset, offset + 12);
  assert.equal(
    evaluateHostTerminalObservationResponse(duplicate, request),
    null,
  );
  const wrongType = Buffer.from(bytes);
  wrongType.writeUInt32LE(0x80, offset + 20);
  assert.equal(
    evaluateHostTerminalObservationResponse(wrongType, request),
    null,
  );
  assert.equal(
    evaluateHostTerminalObservationResponse(
      Buffer.concat([bytes, Buffer.from([0])]),
      request,
    ),
    null,
  );
  assert.equal(
    evaluateHostTerminalObservationResponse(bytes.subarray(0, -1), request),
    null,
  );
  assert.equal(
    evaluateHostTerminalObservationResponse(
      bytes,
      Object.freeze({ nonceHex: request.nonceHex }),
    ),
    null,
  );
  let reads = 0;
  const getterInput = Buffer.from(bytes);
  Object.defineProperty(getterInput, "buffer", {
    get() {
      reads++;
      throw new Error("must_not_execute");
    },
  });
  assert.equal(
    evaluateHostTerminalObservationResponse(getterInput, request)?.status,
    "observed",
  );
  assert.equal(reads, 0);
  assert.equal(
    evaluateHostTerminalObservationResponse(new Proxy(bytes, {}), request),
    null,
  );
  assert.equal(
    evaluateHostTerminalObservationResponse(
      Buffer.from(new SharedArrayBuffer(bytes.length)),
      request,
    ),
    null,
  );
});

/**
 * 元観測が成功でもclose不明を失敗として保持する。
 *
 * @responsibility 元理由なしと部分取得の意味を搬送で失わない。
 * @trace PRL-UT-006
 * @precondition 合成応答と現在のfactory/parser。
 * @stimulus Snapshotなしの外側close不明と部分取得失敗を渡す。
 * @observation blocked、null Snapshot、取得数、元理由と各close。
 * @oracle close不明で成功値を出さず、元観測失敗を捏造しない。部分数を保持する。
 * @cleanup N/A: memory値だけ。
 * @boundary Native失敗応答の局所代替。実OS close故障ではない。
 */
test("Host対象Native応答は外側close不明と部分取得を成功に畳まない", () => {
  const request = createHostTerminalObservationRequest(fixture());
  assert.ok(request);
  const { bytes } = terminalObservationResponse(request);
  const reason = "terminal_directory_close_unknown";
  const failed = Buffer.alloc(53 + reason.length + 14);
  bytes.copy(failed, 0, 0, 53);
  failed[42] = 0;
  failed[43] = 4;
  failed[44] = reason.length;
  failed.write(reason, 53);
  failed.fill(1, 53 + reason.length);
  failed[53 + reason.length + 2] = 0;
  const observed = evaluateHostTerminalObservationResponse(failed, request);
  assert.equal(observed?.status, "blocked");
  assert.equal(observed.snapshot, null);
  assert.equal(observed.operationReason, null);
  assert.equal(observed.directoryCloses[0], false);
  const partial = Buffer.alloc(53 + reason.length * 2 + 8);
  failed.copy(partial, 0, 0, 53);
  partial[43] = 3;
  partial[45] = reason.length;
  partial[47] = 2;
  partial[52] = 2;
  partial.write(reason, 53);
  partial.write(reason, 53 + reason.length);
  partial.fill(1, 53 + reason.length * 2);
  const result = evaluateHostTerminalObservationResponse(partial, request);
  assert.equal(result?.targetAcquired, 2);
  assert.equal(result.operationReason, reason);
});

/**
 * 不正intentではWorkerを起動せず停止する。
 *
 * @responsibility 入力拒否をProcess開始前へ接続する。
 * @trace PRL-UT-006
 * @precondition production Adapterへnull intentを渡す。
 * @stimulus 用途限定入口を直接呼ぶ。
 * @observation 停止結果とProcess/Filesystem Effect。
 * @oracle 停止し、Process開始・Filesystem変更・清掃許可・Authorityはfalse。
 * @cleanup N/A: 対象もWorkerも作らない。
 * @boundary 不正入力はNative起動前で停止する。
 */
test("Host対象Native Adapterは不正intentでEffect 0を保持する", () => {
  assert.equal(createHostTerminalObservationRequest(null), null);
  const result = observeHostTerminalWindowsTarget(null);
  assert.equal(result.status, "blocked");
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.cleanupAuthorized, false);
  assert.equal(result.runtimeAuthorityIssued, false);
});

/**
 * 技術投影の実体aliasと既知File属性を拒否する。
 * @responsibility 上位codecの移管前と同じOS実体条件をNative要求前に保持する。
 * @trace PRL-UT-006
 * @precondition 合成の十一・十二実体fixture。
 * @stimulus 同一実体の重複、Directory／Reparse属性を既知Fileへ指定する。
 * @observation 要求factoryのnullと正常要求。
 * @oracle 本文Hashが一致しても技術条件の不正は拒否する。
 * @cleanup N/A: memoryだけ。
 * @boundary 技術投影→要求構築。実OS・上位判断は行わない。
 */
test("Host技術投影は実体aliasと既知Fileの不正属性を拒否する", () => {
  const base = fixture();
  assert.ok(createHostTerminalSaveRequest(base));
  assert.equal(
    createHostTerminalSaveRequest({
      ...base,
      target: {
        ...base.target,
        children: {
          ...base.target.children,
          tmp: base.target.children.workspace,
        },
      },
    }),
    null,
  );
  const known = knownFixture();
  for (const attributes of [0x10, 0x400]) {
    assert.equal(
      createKnownFileHostTerminalSaveRequest({
        ...known,
        target: {
          ...known.target,
          knownFile: {
            ...known.target.knownFile,
            identity: { ...known.target.knownFile.identity, attributes },
          },
        },
      }),
      null,
    );
  }
});
