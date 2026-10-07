/**
 * Host終端intentの閉Schemaと正規bytesを検証する。
 *
 * @packageDocumentation
 * @responsibility 形状受理を保護・保存・非使用・清掃の証明へ昇格させない。
 * @trace PRL-UT-006
 * @level UT
 * @scope 完全snapshotの内部codec。実Native、Filesystem、本番callerは対象外。
 * @boundary N/A: 外部資源を作らない純粋codec試験。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { compileFunction, runInNewContext } from "node:vm";
import { hostOperationGenerationBindingHash } from "../../src/host-runtime/candidate-store-kernel-lock.ts";
import type { HostTerminalCheckpointPreparation } from "../../src/host-runtime/host-terminal-caller-checkpoint.ts";
import {
  decodeHostTerminalIntent,
  decodeKnownFixtureHostTerminalIntent,
  encodeHostTerminalIntent,
  encodeKnownFixtureHostTerminalIntent,
  type HostTerminalWindowsIdentity,
  resolveHostTerminalLegacyGeneration,
} from "../../src/host-runtime/host-terminal-record.ts";
import {
  createHostTerminalCurrentObservationRequest,
  createHostTerminalObservationRequest,
  createHostTerminalReadRequest,
  createHostTerminalSaveRequest,
  createHostTerminalTargetObservationRequest,
  createKnownFileHostTerminalCurrentObservationRequest,
  createKnownFileHostTerminalReadRequest,
  createKnownFileHostTerminalSaveRequest,
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
} from "../../src/host-runtime/host-terminal-windows-adapter.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/plain-data/index.ts";

/**
 * 限定保守と既存の世代排他が同じ結合値を使うことを確認する。
 *
 * @responsibility 名の対応検査とLock取得・非使用証明を混同せず、旧形式を無改変で扱う。
 * @trace PRL-UT-006
 * @precondition 合成したUUIDと対応markerだけをmemory上で扱う。
 * @stimulus 正常な対応、別UUID、UUID形式不正、Path、異なるmarker、未知型を与える。
 * @observation nonce、Hash、既存Ownerとの一致と拒否結果。
 * @oracle 正常値のHashだけが既存hostOperationGenerationBindingHashと一致し、全不正値はnull。
 * @cleanup N/A: OS Lock、Process、Filesystemを取得しない。
 * @boundary 純値検査であり、実対象の由来・非使用・清掃は証明しない。
 */
test("Host旧世代の固定名は既存排他と同じHashへ結合する", () => {
  const nonce = "79465013-6315-4316-a452-df0c427bf800";
  const rootName = `crdd-coordinator-doctor-${nonce}`;
  const markerName = `host-${createHash("sha256").update(nonce).digest("hex")}.json`;
  const result = resolveHostTerminalLegacyGeneration(rootName, markerName);
  assert.ok(result);
  assert.equal(result.nonce, nonce);
  assert.equal(
    result.bindingSha256,
    hostOperationGenerationBindingHash(rootName, nonce),
  );
  assert.equal(Object.isFrozen(result), true);
  for (const [root, marker] of [
    [rootName, `host-${"a".repeat(64)}.json`],
    [rootName.replace("79465013", "89465013"), markerName],
    [rootName.replace("4316", "1316"), markerName],
    [rootName.toUpperCase(), markerName],
    [`../${rootName}`, markerName],
    [rootName, `../${markerName}`],
    ["crdd-coordinator-doctor-fixture", markerName],
    [null, markerName],
    [rootName, null],
    [{ toString: () => rootName }, markerName],
  ]) {
    assert.equal(resolveHostTerminalLegacyGeneration(root, marker), null);
  }
});

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
 * Host専用環境が作成Ownerと同じ親候補だけを搬送することを確認する。
 *
 * @responsibility 空TMP／TEMP、自由Path、別場所fallbackと一般環境の変更を防ぐ。
 * @trace PRL-UT-006
 * @precondition 現Sourceの環境構成bodyを純値・合成metadataへ接続する。
 * @stimulus 正常、基礎環境欠落、相対・UNC・NUL、metadataとrealpath失敗、型・reparse差を与える。
 * @observation TMP／TEMP、他fieldの不変性、nullと依存呼出回数。
 * @oracle 正常だけ同じcanonical親を両fieldへ設定し、全不正例はfallbackなしでnull。
 * @cleanup N/A: memory上の依存だけ。実Filesystemを変更しない。
 * @boundary 本番関数bodyのUT。Win32所在・ACL・元対象親の実照合は別ITへ残す。
 */
test("Host専用環境はcanonical親を両一時fieldへ結び不明を補完しない", () => {
  const source = readFileSync(
    new URL(
      "../../src/host-runtime/windows-child-environment.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const start = source.indexOf(
    "export function createWindowsHostTerminalHelperEnvironment(",
  );
  assert.ok(start > 0);
  const end = source.indexOf("\n/**", start);
  assert.ok(end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replace(/^export /u, ""),
  );
  const base = Object.freeze({
    TMP: "",
    TEMP: "",
    USERPROFILE: "C:\\Users\\fixture",
    ALL_PROXY: "",
  });
  for (const scenario of [
    "normal",
    "base_missing",
    "relative",
    "unc",
    "nul",
    "root",
    "candidate_file",
    "candidate_reparse",
    "metadata_throw",
    "realpath_throw",
    "canonical_unc",
    "canonical_root",
    "canonical_relative",
    "parent_file",
    "parent_reparse",
  ]) {
    let calls = 0;
    const candidate =
      scenario === "relative"
        ? "relative"
        : scenario === "unc"
          ? "\\\\server\\temp"
          : scenario === "nul"
            ? "C:\\tmp\0"
            : scenario === "root"
              ? "C:\\"
              : "C:\\temp-candidate";
    const canonical =
      scenario === "canonical_unc"
        ? "\\\\server\\temp"
        : scenario === "canonical_root"
          ? "C:\\"
          : scenario === "canonical_relative"
            ? "relative"
            : "C:\\canonical-temp";
    const evaluate = runInNewContext(`(${body})`, {
      createWindowsNativeHelperEnvironment: () =>
        scenario === "base_missing" ? null : base,
      os: {
        tmpdir: () => {
          calls += 1;
          return candidate;
        },
      },
      path,
      fs: {
        realpathSync: () => {
          if (scenario === "realpath_throw")
            throw new Error("fixture_realpath_unknown");
          return canonical;
        },
        lstatSync: (value: string) => {
          if (scenario === "metadata_throw")
            throw new Error("fixture_metadata_unknown");
          const isCandidate = value === candidate;
          return {
            isDirectory: () =>
              scenario !== (isCandidate ? "candidate_file" : "parent_file"),
            isSymbolicLink: () =>
              scenario ===
              (isCandidate ? "candidate_reparse" : "parent_reparse"),
          };
        },
      },
    }) as () => Readonly<Record<string, string>> | null;
    const actual = evaluate();
    if (scenario === "normal") {
      assert.ok(actual);
      assert.equal(actual.TMP, canonical);
      assert.equal(actual.TEMP, canonical);
      assert.equal(actual.USERPROFILE, base.USERPROFILE);
      assert.equal(actual.ALL_PROXY, base.ALL_PROXY);
      assert.equal(Object.isFrozen(actual), true);
    } else assert.equal(actual, null, scenario);
    assert.equal(calls, scenario === "base_missing" ? 0 : 1);
    assert.equal(base.TMP, "");
    assert.equal(base.TEMP, "");
  }
});

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
    0,
    {},
    cancelled.signal,
  );
  assert.equal(cancelledResult.status, "blocked");
  assert.equal(cancelledResult.reason, "host_terminal_candidate_cancelled");
  assert.equal(cancelledResult.currentObservation, null);
  assert.equal(cancelledResult.knownObservation, null);
  assert.equal(cancelledResult.processEffectIssued, false);
  assert.equal(cancelledResult.helperExitConfirmed, true);
  for (const request of [known, Object.freeze({ ...current })]) {
    const result = observeHostTerminalWindowsCandidate(request, 0);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "host_terminal_current_request_required");
    assert.equal(result.currentObservation, null);
    assert.equal(result.knownObservation, null);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.cleanupAuthorized, false);
  }
  const result = observeHostTerminalWindowsCandidate(current, 0, {});
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
  const source = readFileSync(
    new URL(
      "../../src/host-runtime/host-terminal-windows-adapter.ts",
      import.meta.url,
    ),
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
      ...changedSnapshots.map((value) => ["changedSnapshots", value] as const),
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
      ].map((value) => [value, snapshot] as const),
    ] as const) {
      const signal = new AbortController();
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
      const result = evaluate(
        request,
        0,
        {},
        signal.signal,
        contexts,
        (actual: unknown) => {
          calls += 1;
          assert.equal(actual, calls === 1 ? request : nextRequest);
          if (scenario === (calls === 1 ? "current_throw" : "known_throw"))
            throw new Error("private_error");
          if (
            scenario === (calls === 1 ? "current_cancelled" : "known_cancelled")
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
      );
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
      assert.equal(result.filesystemEffectIssued, false);
      assert.equal(result.runtimeAuthorityIssued, false);
      assert.equal(result.cleanupAuthorized, false);
      if (scenario.endsWith("throw")) {
        assert.equal(result.processEffectIssued, null);
        assert.equal(result.helperExitConfirmed, false);
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
    const result = observeKnownFileHostTerminalWindowsCandidate(request, 0, {});
    assert.equal(result.reason, "host_terminal_current_request_required");
    assert.equal(result.processEffectIssued, false);
  }
  const cancelled = new AbortController();
  cancelled.abort();
  const stopped = observeKnownFileHostTerminalWindowsCandidate(
    current,
    0,
    {},
    cancelled.signal,
  );
  assert.equal(stopped.reason, "host_terminal_candidate_cancelled");
  assert.equal(stopped.helperExitConfirmed, true);
  const result = observeKnownFileHostTerminalWindowsCandidate(current, 0, {});
  assert.equal(result.status, "blocked");
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.knownObservation, null);
});

/**
 * 観測から完全intentへの本番準備bodyを同参照・部分Effectで確認する。
 *
 * @responsibility 旧選択Hashを保持し、新file条件と保存後失敗を欠落させない。
 * @trace PRL-UT-006
 * @precondition 現Sourceを同じJS realmでcompileし、観測と保存だけを合成する。
 * @stimulus 旧新正常、全選択field差、拒否、取消、観測・保存例外を与える。
 * @observation codecに入る全値、正規bytes、選択Hash、保存呼出数、同参照と既知・不明Effect。
 * @oracle 専用codecの完全文書だけを保存し、失敗後の参照・receiptを保持する。
 * @cleanup N/A: OS・Filesystem・Processを発行しない。
 * @boundary 実bodyと実codec、合成観測・保存。正常Native接続は対象外。
 */
test("Host記録準備は旧新選択Hashと保存後の同参照を保持する", async () => {
  const source = readFileSync(
    new URL(
      "../../src/host-runtime/host-terminal-caller-checkpoint.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const start = source.indexOf(
    "async function prepareTerminalRecoveryCheckpoint<",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  const prepare = compileFunction(
    `return (${stripTypeScriptTypes(source.slice(start, end))});`,
    [
      "snapshotPlainRecord",
      "REFERENCE",
      "resolveHostTerminalLegacyGeneration",
      "resolveRepositoryRuntimeDataPaths",
      "createHash",
    ],
  )(
    snapshotPlainRecord,
    /^host-terminal\.[a-f0-9-]{36}$/u,
    resolveHostTerminalLegacyGeneration,
    () => ({}),
    createHash,
  ) as (...args: unknown[]) => Promise<HostTerminalCheckpointPreparation>;
  for (const hasFile of [false, true]) {
    const value = knownFixture();
    const snapshot = {
      identities: Array.from(
        { length: hasFile ? 12 : 11 },
        (_entry, index) => ({
          ...identity(index + 1),
          ...(index === 11 ? { attributes: 0x80 } : {}),
        }),
      ),
      selectedUserSha256: value.bindings.selectedUserSha256,
      markerSha256: value.target.marker.sha256,
      ...(hasFile
        ? {
            knownFile: {
              byteLength: 7,
              linkCount: 1,
              sha256: value.target.knownFile.sha256,
            },
          }
        : {}),
    };
    const input = {
      reference: value.reference,
      rootName: value.target.root.name,
      markerName: value.target.marker.name,
      bindings: value.bindings,
    };
    const receipt = Object.freeze({
      status: "saved",
      reason: "saved",
      reference: value.reference,
      administrativeEffectIssued: true,
      recordEffectIssued: true,
      handlesCloseConfirmed: true,
      leaseCloseConfirmed: true,
      runtimeDataBlock: null,
    });
    let baselineHash: string | null = null;
    const variants: Array<{
      scenario: string;
      snapshot: typeof snapshot;
      input: typeof input;
    }> = [];
    for (let index = 0; index < snapshot.identities.length; index += 1) {
      for (const key of [
        "volumeSerial",
        "fileIndexHigh",
        "fileIndexLow",
        "creationTimeHigh",
        "creationTimeLow",
        "attributes",
      ] as const) {
        const copy = structuredClone(snapshot);
        const item = copy.identities[index];
        assert.ok(item);
        item[key] += key === "attributes" ? 1 : 2;
        variants.push({ scenario: "hash_change", snapshot: copy, input });
      }
    }
    variants.push({
      scenario: "hash_change",
      snapshot: { ...snapshot, markerSha256: "1".repeat(64) },
      input,
    });
    for (const key of ["runtimeSha256", "repositorySha256"] as const)
      variants.push({
        scenario: "hash_change",
        snapshot,
        input: {
          ...input,
          bindings: { ...input.bindings, [key]: "2".repeat(64) },
        },
      });
    variants.push({
      scenario: "hash_change",
      snapshot: { ...snapshot, selectedUserSha256: "3".repeat(64) },
      input: {
        ...input,
        bindings: { ...input.bindings, selectedUserSha256: "3".repeat(64) },
      },
    });
    const nonce = "99999999-2222-4333-8444-555555555555";
    variants.push({
      scenario: "hash_change",
      snapshot,
      input: {
        ...input,
        rootName: `crdd-coordinator-doctor-${nonce}`,
        markerName: `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
      },
    });
    variants.push({
      scenario: "reference_only",
      snapshot,
      input: { ...input, reference: `host-terminal.${nonce}` },
    });
    if (hasFile) {
      for (const key of ["byteLength", "linkCount", "sha256"] as const) {
        const copy = structuredClone(snapshot);
        assert.ok(copy.knownFile);
        if (key === "sha256") copy.knownFile.sha256 = "4".repeat(64);
        else copy.knownFile[key] += 1;
        variants.push({ scenario: "hash_change", snapshot: copy, input });
      }
    }
    for (const variant of [
      ...[
        "normal",
        "observation_failed",
        "observation_throw",
        "after_observation_cancelled",
        "before_cancelled",
        "save_failed",
        "save_throw",
        "after_save_cancelled",
        "encode_cancelled",
        "user_mismatch",
      ].map((scenario) => ({ scenario, snapshot, input })),
      ...variants,
    ]) {
      const signal = new AbortController();
      if (variant.scenario === "before_cancelled") signal.abort();
      let saveCalls = 0;
      let captured: unknown = null;
      let observationCalls = 0;
      const result = await prepare(
        {},
        variant.input,
        0,
        signal.signal,
        {},
        () => ({ nonceHex: "01".repeat(32) }),
        () => {
          observationCalls += 1;
          if (variant.scenario === "observation_throw")
            throw new Error("private_observer");
          if (variant.scenario === "after_observation_cancelled")
            signal.abort();
          return {
            status:
              variant.scenario === "observation_failed"
                ? "blocked"
                : "observed",
            reason: "fixture_observation",
            knownObservation: {
              snapshot:
                variant.scenario === "user_mismatch"
                  ? { ...variant.snapshot, selectedUserSha256: "5".repeat(64) }
                  : variant.snapshot,
            },
            processEffectIssued: true,
            helperExitConfirmed: true,
          };
        },
        (candidate: unknown) => {
          captured = candidate;
          if (variant.scenario === "encode_cancelled") signal.abort();
          return hasFile
            ? encodeKnownFixtureHostTerminalIntent(candidate)
            : encodeHostTerminalIntent(candidate);
        },
        async (_repository: unknown, intent: unknown, bindings: unknown) => {
          saveCalls += 1;
          assert.equal(
            JSON.stringify(bindings),
            JSON.stringify(variant.input.bindings),
          );
          assert.ok(
            intent && typeof intent === "object" && "reference" in intent,
          );
          assert.equal(intent.reference, variant.input.reference);
          if (variant.scenario === "save_throw")
            throw new Error("private_save");
          if (variant.scenario === "after_save_cancelled") signal.abort();
          return {
            ...receipt,
            reference: variant.input.reference,
            status: variant.scenario === "save_failed" ? "blocked" : "saved",
          };
        },
        hasFile,
      );
      assert.equal(result.reference, variant.input.reference);
      assert.equal(result.runtimeAuthorityIssued, false);
      assert.equal(result.cleanupAuthorized, false);
      if (captured) {
        const record = captured as ReturnType<typeof knownFixture>;
        const fields: unknown[] = [
          variant.input.rootName,
          variant.input.markerName,
          variant.snapshot.identities.map((item) => [
            item.volumeSerial,
            item.fileIndexHigh,
            item.fileIndexLow,
            item.creationTimeHigh,
            item.creationTimeLow,
            item.attributes,
          ]),
          variant.snapshot.markerSha256,
          variant.input.bindings.runtimeSha256,
          variant.input.bindings.repositorySha256,
          variant.input.bindings.selectedUserSha256,
        ];
        if (hasFile) {
          assert.ok(variant.snapshot.knownFile);
          fields.push([
            variant.snapshot.knownFile.byteLength,
            variant.snapshot.knownFile.linkCount,
            variant.snapshot.knownFile.sha256,
          ]);
        }
        const expectedHash = createHash("sha256")
          .update(
            hasFile
              ? "crdd/host-terminal-known-file-selection/v1\0"
              : "crdd/host-terminal-selection/v1\0",
          )
          .update(JSON.stringify(fields))
          .digest("hex");
        assert.equal(record.producer.selectionSnapshotSha256, expectedHash);
        if (variant.scenario === "normal") baselineHash = expectedHash;
        if (variant.scenario === "hash_change")
          assert.notEqual(expectedHash, baselineHash);
        if (variant.scenario === "reference_only")
          assert.equal(expectedHash, baselineHash);
      }
      if (["normal", "reference_only"].includes(variant.scenario)) {
        assert.equal(result.status, "prepared");
        assert.equal(saveCalls, 1);
        assert.ok(result.intent);
        assert.equal(result.intent.intent.contractRevision, hasFile ? 3 : 2);
      } else if (variant.scenario !== "hash_change") {
        assert.equal(result.status, "blocked", variant.scenario);
      }
      if (variant.scenario === "save_throw") {
        assert.equal(result.recordEffectIssued, null);
        assert.equal(result.administrativeEffectIssued, null);
      } else if (
        ["save_failed", "after_save_cancelled"].includes(variant.scenario)
      ) {
        assert.equal(result.recordEffectIssued, true);
        assert.ok(result.checkpoint);
      } else if (
        variant.scenario !== "hash_change" &&
        !["normal", "reference_only"].includes(variant.scenario)
      ) {
        assert.equal(saveCalls, 0);
        assert.equal(result.recordEffectIssued, false);
      }
      if (variant.scenario === "before_cancelled")
        assert.equal(observationCalls, 0);
      if (variant.scenario === "observation_throw")
        assert.equal(result.processEffectIssued, null);
    }
  }
});

/**
 * 新クラスの正規文書と既存入口への拒否を確認する。
 *
 * @responsibility 十二実体を旧十一実体の保存要求へ変換させない。
 * @trace PRL-UT-006
 * @precondition 新旧の独立した合成snapshot。
 * @stimulus round tripと双方のencode／decode、既存Native要求factoryへ渡す。
 * @observation 正規bytes、全実体、Hash、改訂版拒否と入力不変。
 * @oracle 新クラスだけが専用codecを通り、旧観測・保存・読戻しfactoryはnull。
 * @cleanup N/A: factoryの拒否だけでNativeやFilesystemを起動しない。
 * @boundary memoryの搬送検査。実保護・保存・処置は未接続。
 */
test("Host既知fileの十二実体は専用改訂版で保持し旧入口へ渡さない", () => {
  const candidate = knownFixture();
  const before = JSON.stringify(candidate);
  const encoded = encodeKnownFixtureHostTerminalIntent(candidate);
  assert.deepEqual(
    decodeKnownFixtureHostTerminalIntent(Buffer.from(encoded.serialized)),
    encoded,
  );
  assert.equal(encoded.intent.target.knownFile.identity.fileIndexLow, 12);
  assert.equal(Object.isFrozen(encoded.intent.target.knownFile.identity), true);
  assert.equal(
    encoded.sha256,
    createHash("sha256").update(encoded.serialized).digest("hex"),
  );
  assert.equal(JSON.stringify(candidate), before);
  const old = encodeHostTerminalIntent(fixture());
  assert.deepEqual(decodeHostTerminalIntent(Buffer.from(old.serialized)), old);
  assert.throws(() => encodeHostTerminalIntent(candidate));
  assert.throws(() =>
    decodeHostTerminalIntent(Buffer.from(encoded.serialized)),
  );
  assert.throws(() => encodeKnownFixtureHostTerminalIntent(fixture()));
  assert.throws(() =>
    decodeKnownFixtureHostTerminalIntent(Buffer.from(old.serialized)),
  );
  assert.equal(createHostTerminalObservationRequest(candidate), null);
  assert.equal(createHostTerminalSaveRequest(candidate), null);
  assert.equal(createHostTerminalReadRequest(candidate), null);
});

/**
 * 新クラスの限定条件と十二番目の実体aliasを反証する。
 *
 * @responsibility 固定fileから任意の非空清掃へ範囲が広がらないことを確認する。
 * @trace PRL-UT-006
 * @precondition 十二の異なる合成Identityと固定期待条件。
 * @stimulus file条件、producer、順序、名の対応と十一位置へのaliasを改変する。
 * @observation 全改変入力の例外拒否。
 * @oracle 欠落・観測不明・別条件や同実体を新クラスの正規文書にしない。
 * @cleanup N/A: 局所値だけで外部資源を扱わない。
 * @boundary 期待値検査であり、実非使用またはAuthority検査ではない。
 */
test("Host既知fileは固定条件・世代対応・十二実体の相異を必要とする", () => {
  const candidate = knownFixture();
  for (const [key, value] of [
    ["parent", "tmp"],
    ["name", "other.txt"],
    ["name", "../fixture.txt"],
    ["byteLength", 0],
    ["byteLength", 8],
    ["byteLength", "7"],
    ["sha256", "a".repeat(64)],
    ["linkCount", 0],
    ["linkCount", 2],
    ["linkCount", "unknown"],
  ]) {
    assert.throws(() =>
      encodeKnownFixtureHostTerminalIntent({
        ...candidate,
        target: {
          ...candidate.target,
          knownFile: { ...candidate.target.knownFile, [String(key)]: value },
        },
      }),
    );
  }
  for (const identityValue of [
    candidate.target.parentIdentity,
    candidate.target.recoveryDirectoryIdentity,
    candidate.target.terminalDirectoryIdentity,
    candidate.target.root.identity,
    candidate.target.marker.identity,
    ...Object.values(candidate.target.children),
  ]) {
    assert.throws(
      () =>
        encodeKnownFixtureHostTerminalIntent({
          ...candidate,
          target: {
            ...candidate.target,
            knownFile: {
              ...candidate.target.knownFile,
              identity: { ...identityValue, attributes: 0x80 },
            },
          },
        }),
      /host_terminal_identity_alias/u,
    );
  }
  for (const attributes of [0x10, 0x400, 0x410]) {
    assert.throws(() =>
      encodeKnownFixtureHostTerminalIntent({
        ...candidate,
        target: {
          ...candidate.target,
          knownFile: {
            ...candidate.target.knownFile,
            identity: { ...candidate.target.knownFile.identity, attributes },
          },
        },
      }),
    );
  }
  for (const input of [
    { ...candidate, producer: fixture().producer },
    { ...candidate, resourceClass: "empty_host_only_v1" },
    { ...candidate, cleanupOrder: fixture().cleanupOrder },
    {
      ...candidate,
      target: { ...candidate.target, root: fixture().target.root },
    },
    {
      ...candidate,
      target: { ...candidate.target, marker: fixture().target.marker },
    },
    { ...candidate, target: { ...candidate.target, unknownEntry: true } },
  ])
    assert.throws(() => encodeKnownFixtureHostTerminalIntent(input));
});

/**
 * 新クラスの不正objectと非正規bytesを拒否する。
 *
 * @responsibility Getter／Proxyや別表現から正規文書を暗黙生成しない。
 * @trace PRL-UT-006
 * @precondition 正規な合成文書と独立した改変入力。
 * @stimulus nested Accessor、Proxy、未知field、空白・BOM・重複key・指数表現を与える。
 * @observation 拒否とGetter／Proxy trap未実行。
 * @oracle 全不正入力が例外になり、共有memoryも文書として受理しない。
 * @cleanup N/A: memory入力だけを使用する。
 * @boundary byteの正規形だけ。Nativeや公開Recoveryを呼ばない。
 */
test("Host既知fileは不正構造と非正規bytesを受理しない", () => {
  const candidate = knownFixture();
  let hits = 0;
  const file = { ...candidate.target.knownFile };
  Object.defineProperty(file, "linkCount", {
    enumerable: true,
    get: () => {
      hits += 1;
      throw new Error("must_not_run");
    },
  });
  const proxy = new Proxy(candidate, {
    ownKeys: () => {
      hits += 1;
      throw new Error("must_not_run");
    },
  });
  for (const input of [
    proxy,
    Object.create(candidate),
    { ...candidate, extra: true },
    { ...candidate, target: { ...candidate.target, knownFile: file } },
  ])
    assert.throws(() => encodeKnownFixtureHostTerminalIntent(input));
  assert.equal(hits, 0);
  const encoded = encodeKnownFixtureHostTerminalIntent(candidate);
  for (const text of [
    ` ${encoded.serialized}`,
    `${encoded.serialized}\n`,
    `\uFEFF${encoded.serialized}`,
    encoded.serialized.replace(
      '"contractRevision":3',
      '"contractRevision":3,"contractRevision":3',
    ),
    encoded.serialized.replace('"byteLength":7', '"byteLength":7e0'),
  ])
    assert.throws(() =>
      decodeKnownFixtureHostTerminalIntent(Buffer.from(text)),
    );
  assert.throws(() =>
    decodeKnownFixtureHostTerminalIntent(
      new Uint8Array(new SharedArrayBuffer(16)),
    ),
  );
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
    const rejected = observeKnownFileHostTerminalWindowsTarget(old, 0, {});
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
    readHostTerminalWindowsRecord(
      { ...request },
      new Date().toISOString(),
      new AbortController().signal,
    ).processEffectIssued,
    false,
  );
  const aborted = new AbortController();
  aborted.abort();
  assert.equal(
    readHostTerminalWindowsRecord(
      request,
      new Date().toISOString(),
      aborted.signal,
    ).processEffectIssued,
    false,
  );
  assert.equal(
    saveHostTerminalWindowsRecord(
      request,
      new Date().toISOString(),
      new AbortController().signal,
    ).processEffectIssued,
    false,
  );
  assert.equal(
    readHostTerminalWindowsRecord(
      request,
      new Date().toISOString(),
      new AbortController().signal,
      {},
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
    saveHostTerminalWindowsRecord(
      { ...request },
      new Date().toISOString(),
      new AbortController().signal,
    ),
    saveHostTerminalWindowsRecord(
      request,
      new Date().toISOString(),
      cancelled.signal,
    ),
    saveHostTerminalWindowsRecord(
      request,
      new Date().toISOString(),
      new AbortController().signal,
      {},
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
    new URL(
      "../../src/host-runtime/host-terminal-windows-adapter.ts",
      import.meta.url,
    ),
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
          verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => ({
            status: "candidate",
            runtimeOwnedReleaseTrustConfirmed: true,
            runtimeExecutionIdentityRuntimeOwned: true,
            crddDistributionConfirmed: true,
            platformAccessArtifact: artifact,
          }),
          observePlatformAccessReleaseArtifactCandidate: () => ({
            status: "candidate",
            artifact,
          }),
          beginPlatformAccessArtifactSigningObservation: () => ({
            token: "fixture",
            artifact,
          }),
          verifyPlatformAccessArtifactSigningObservation: () => true,
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
          "synthetic-evaluation",
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
    new URL(
      "../../src/host-runtime/host-terminal-windows-adapter.ts",
      import.meta.url,
    ),
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
      encodeHostTerminalIntent,
      encodeKnownFixtureHostTerminalIntent,
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
        ? encodeHostTerminalIntent(candidate)
        : encodeKnownFixtureHostTerminalIntent(candidate);
    const request = factory(candidate, recordClass);
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
    null,
    controller.signal,
  );
  assert.equal(stopped.reference, request.reference);
  assert.equal(stopped.processEffectIssued, false);
  assert.equal(stopped.recordEffectIssued, false);
  assert.equal(
    saveHostTerminalWindowsRecord(request, null, controller.signal).reference,
    null,
  );
  assert.equal(
    saveKnownFileHostTerminalWindowsRecord(old, null, controller.signal)
      .reference,
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
    null,
    controller.signal,
  );
  assert.equal(stopped.reference, request.reference);
  assert.equal(stopped.processEffectIssued, false);
  assert.equal(stopped.recordEffectIssued, false);
  assert.equal(
    readHostTerminalWindowsRecord(request, null, controller.signal).reference,
    null,
  );
  assert.equal(
    readKnownFileHostTerminalWindowsRecord(old, null, controller.signal)
      .reference,
    null,
  );
  assert.equal(
    readKnownFileHostTerminalWindowsRecord(save, null, controller.signal)
      .reference,
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
  const result = observeHostTerminalWindowsTarget(
    null,
    new Date().toISOString(),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.cleanupAuthorized, false);
  assert.equal(result.runtimeAuthorityIssued, false);
});

/**
 * 両producerの正規搬送と不変性を確認する。
 *
 * @responsibility 正常なbyte往復とHashを確認し、実Recoveryの主張を生成しない。
 * @trace PRL-UT-006
 * @precondition 完全fixtureと保守producerへ置換したfixture。
 * @stimulus encode、decode、入力変更とkey順変更を行う。
 * @observation 固定bytes、Hash、nested値の不変性。
 * @oracle 両producerが正規往復し、入力変更後も結果は不変で同値key順も同じbytes。
 * @cleanup N/A: memory値だけを扱う。
 * @boundary N/A: 保存、保護、非使用、Authorityは未検証。
 */
test("Host終端intentは両producerを不変の正規bytesへ往復する", () => {
  const input = fixture();
  const encoded = encodeHostTerminalIntent(input);
  assert.deepEqual(
    decodeHostTerminalIntent(Buffer.from(encoded.serialized)),
    encoded,
  );
  assert.equal(
    encoded.sha256,
    createHash("sha256").update(encoded.serialized, "utf8").digest("hex"),
  );
  assert.ok(Buffer.byteLength(encoded.serialized) <= 8_192);
  assert.equal(encoded.serialized.includes("\n"), false);
  assert.equal(
    encoded.serialized.startsWith(
      '{"contract":"crdd-coordinator/host-terminal-intent","contractRevision":2,"reference":',
    ),
    true,
  );
  assert.deepEqual(Object.keys(encoded.intent.target.children), [
    "workspace",
    "provider-home",
    "tmp",
    "events",
    "projection",
    "management",
  ]);
  assert.equal(Object.isFrozen(encoded.intent), true);
  assert.equal(Object.isFrozen(encoded.intent.target.children.workspace), true);
  assert.equal(Object.isFrozen(encoded.intent.cleanupOrder), true);
  input.producer.originalReferenceSha256 = "0".repeat(64);
  input.cleanupOrder.reverse();
  assert.equal(
    encoded.intent.producer.kind === "owned_cleanup" &&
      encoded.intent.producer.originalReferenceSha256,
    "a".repeat(64),
  );
  assert.equal(encoded.intent.cleanupOrder[0], "root_absence");
  const reversed = Object.fromEntries(Object.entries(fixture()).reverse());
  assert.equal(
    encodeHostTerminalIntent(reversed).serialized,
    encoded.serialized,
  );
  const maintenance = encodeHostTerminalIntent({
    ...fixture(),
    producer: {
      kind: "human_orphan_cleanup",
      selectionSnapshotSha256: "a".repeat(64),
      originalReferenceUnknownReason: "original_reference_unconfirmed",
    },
  });
  assert.deepEqual(
    decodeHostTerminalIntent(Buffer.from(maintenance.serialized)),
    maintenance,
  );
  assert.equal(maintenance.intent.reference, encoded.intent.reference);
  assert.equal(Object.hasOwn(maintenance.intent, "authorityConferred"), false);
  assert.equal(Object.hasOwn(maintenance.intent, "cleanupConfirmed"), false);
});

/**
 * 全十一対象の属性が正規bytesとHashに保持されることを確認する。
 *
 * @responsibility 属性欠落を既定値や現在観測で補完する経路を拒否する。
 * @trace PRL-UT-006
 * @precondition revision 2の完全fixtureと十一の異なる実体位置。
 * @stimulus 各位置の属性を個別に変更し、encode／decode後に削除・旧Revisionを与える。
 * @observation 正規intent、bytes Hashと固定拒否理由。
 * @oracle 全位置で属性を無損失に往復し、属性差でHashが変わり、欠落とRevision 1は拒否する。
 * @cleanup N/A: 局所値だけで保存やHost資源を取得しない。
 * @boundary codecであり、属性の実由来・適否や清掃Authorityは証明しない。
 */
test("Host終端intentは十一対象の属性を欠落なく搬送する", () => {
  const baseline = encodeHostTerminalIntent(fixture());
  for (let position = 0; position < 11; position += 1) {
    const input = structuredClone(fixture());
    const identities = [
      input.target.parentIdentity,
      input.target.recoveryDirectoryIdentity,
      input.target.terminalDirectoryIdentity,
      input.target.root.identity,
      input.target.marker.identity,
      ...Object.values(input.target.children),
    ];
    const selected = identities[position];
    assert.ok(selected);
    const mutable = selected as unknown as Record<string, unknown>;
    mutable.attributes = 0x8000_0000 + position;
    const encoded = encodeHostTerminalIntent(input);
    assert.deepEqual(encoded.intent, input);
    assert.notEqual(encoded.sha256, baseline.sha256);
    assert.deepEqual(
      decodeHostTerminalIntent(Buffer.from(encoded.serialized)),
      encoded,
    );
    delete mutable.attributes;
    assert.throws(
      () => encodeHostTerminalIntent(input),
      /host_terminal_shape_invalid/u,
    );
  }
  const legacy = { ...fixture(), contractRevision: 1 };
  assert.throws(
    () => decodeHostTerminalIntent(Buffer.from(JSON.stringify(legacy))),
    /host_terminal_contract_invalid/u,
  );
});

/**
 * 閉集合の全fieldを欠落・未知値へ変えて拒否を確認する。
 *
 * @responsibility 初期化途中、自由Path、producer混在を完全snapshotへ補完しない。
 * @trace PRL-UT-006
 * @precondition 正常fixtureとfield母集団。
 * @stimulus 各fieldを削除し、未知field・producer・順序を与える。
 * @observation 固定エラー。
 * @oracle 全て拒否し、欠落Identityや参照を生成しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary N/A: 形状検査だけ。
 */
test("Host終端intentは各閉集合の欠落・未知fieldを拒否する", () => {
  const base = fixture();
  const groups = [
    base,
    base.bindings,
    base.target,
    base.target.root,
    base.target.marker,
    base.target.children,
    base.target.children.workspace,
    base.producer,
  ];
  for (const group of groups) {
    for (const key of Object.keys(group)) {
      const changed = structuredClone(base);
      const replacements = [
        changed,
        changed.bindings,
        changed.target,
        changed.target.root,
        changed.target.marker,
        changed.target.children,
        changed.target.children.workspace,
        changed.producer,
      ];
      const selected = replacements[groups.indexOf(group)] as Record<
        string,
        unknown
      >;
      delete selected[key];
      assert.throws(() => encodeHostTerminalIntent(changed), /host_terminal_/u);
    }
    const changed = structuredClone(base);
    const replacements = [
      changed,
      changed.bindings,
      changed.target,
      changed.target.root,
      changed.target.marker,
      changed.target.children,
      changed.target.children.workspace,
      changed.producer,
    ];
    const selected = replacements[groups.indexOf(group)] as Record<
      string,
      unknown
    >;
    selected.path = "C:\\arbitrary";
    assert.throws(() => encodeHostTerminalIntent(changed), /host_terminal_/u);
  }
  for (const producer of [
    {
      kind: "owned_cleanup",
      originalReferenceSha256: "a".repeat(64),
      selectionSnapshotSha256: "b".repeat(64),
    },
    {
      kind: "human_orphan_cleanup",
      selectionSnapshotSha256: "a".repeat(64),
      originalReferenceUnknownReason: "guessed",
    },
    { kind: "human_orphan_cleanup", originalReferenceSha256: "a".repeat(64) },
    { kind: "unknown", originalReferenceSha256: "a".repeat(64) },
  ])
    assert.throws(
      () => encodeHostTerminalIntent({ ...base, producer }),
      /host_terminal_producer_invalid/u,
    );
  const maintenance = {
    kind: "human_orphan_cleanup",
    selectionSnapshotSha256: "a".repeat(64),
    originalReferenceUnknownReason: "original_reference_unconfirmed",
  };
  for (const key of Object.keys(maintenance)) {
    const producer: Record<string, unknown> = { ...maintenance };
    delete producer[key];
    assert.throws(
      () => encodeHostTerminalIntent({ ...base, producer }),
      /host_terminal_producer_invalid/u,
    );
  }
  assert.throws(
    () =>
      encodeHostTerminalIntent({
        ...base,
        producer: { ...maintenance, originalReferenceSha256: "b".repeat(64) },
      }),
    /host_terminal_producer_invalid/u,
  );
  assert.throws(
    () =>
      encodeHostTerminalIntent({
        ...base,
        cleanupOrder: [...base.cleanupOrder].reverse(),
      }),
    /host_terminal_order_invalid/u,
  );
  assert.throws(
    () =>
      encodeHostTerminalIntent({
        ...base,
        cleanupOrder: [...base.cleanupOrder, "success"],
      }),
    /host_terminal_order_invalid/u,
  );
  assert.throws(
    () => encodeHostTerminalIntent({ ...base, contractRevision: 1 }),
    /host_terminal_contract_invalid/u,
  );
});

/**
 * 各scalarとIdentity aliasの境界を確認する。
 *
 * @responsibility 数値の非正規値、自由Path、誤った参照・Hashを拒否する。
 * @trace PRL-UT-006
 * @precondition 独立した正常fixture。
 * @stimulus 属性を含む六u32全fieldの境界、不正名と同じfile indexを与える。
 * @observation 受理／拒否と固定理由。
 * @oracle u32両端を受理し、範囲外・非整数・負のゼロ・aliasは拒否する。
 * @cleanup N/A: memoryだけを扱う。
 * @boundary N/A: Native IDとNode IDの変換は行わない。
 */
test("Host終端intentは整数境界と名前・参照・Hashを限定する", () => {
  for (const key of Object.keys(identity(1))) {
    for (const number of [-0, -1, 0x1_0000_0000, 0.5, NaN, Infinity, "1"]) {
      const base = fixture();
      base.target.root.identity = {
        ...identity(4),
        [key]: number,
      } as HostTerminalWindowsIdentity;
      assert.throws(
        () => encodeHostTerminalIntent(base),
        /host_terminal_identity_invalid/u,
      );
    }
    for (const number of [0, 0xffff_ffff]) {
      const base = fixture();
      base.target.root.identity = { ...identity(4), [key]: number };
      assert.doesNotThrow(() => encodeHostTerminalIntent(base));
    }
  }
  const alias = fixture();
  alias.target.children.tmp = {
    ...alias.target.children.workspace,
    creationTimeLow: 999,
  };
  assert.throws(
    () => encodeHostTerminalIntent(alias),
    /host_terminal_identity_alias/u,
  );
  for (const name of [
    "../outside",
    "C:\\outside",
    "crdd-coordinator-doctor-",
    `crdd-coordinator-doctor-${"a".repeat(97)}`,
  ]) {
    const base = fixture();
    base.target.root.name = name;
    assert.throws(
      () => encodeHostTerminalIntent(base),
      /host_terminal_name_invalid/u,
    );
  }
  for (const name of [
    "../host.json",
    "host-token.json",
    `host-${"A".repeat(64)}.json`,
  ]) {
    const base = fixture();
    base.target.marker.name = name;
    assert.throws(
      () => encodeHostTerminalIntent(base),
      /host_terminal_name_invalid/u,
    );
  }
  for (const reference of [
    "host.existing.token",
    "host-terminal.11111111-2222-3333-8444-555555555555",
    "host-terminal.11111111-2222-4333-7444-555555555555",
    "host-terminal.11111111-2222-4333-8444-AAAAAAAAAAAA",
  ])
    assert.throws(
      () => encodeHostTerminalIntent({ ...fixture(), reference }),
      /host_terminal_reference_invalid/u,
    );
  for (const hash of [
    "",
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(64),
    "not-a-hash",
  ]) {
    const base = fixture();
    base.target.marker.sha256 = hash;
    assert.throws(
      () => encodeHostTerminalIntent(base),
      /host_terminal_hash_invalid/u,
    );
  }
});

/**
 * nestedの実行可能propertyを拒否する。
 *
 * @responsibility getter、toJSON、Proxy、特殊prototypeを解析時に実行しない。
 * @trace PRL-UT-006
 * @precondition 実行回数を観測できる不正fixture。
 * @stimulus 各nested境界へAccessor／Proxyと未知Symbolを置く。
 * @observation 拒否とcallback実行回数。
 * @oracle 全拒否かつgetter／Proxy trap実行0。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: Process内の入力境界だけ。
 */
test("Host終端intentはnested getterとProxyを実行しない", () => {
  let executed = 0;
  const getter = Object.defineProperty({}, "volumeSerial", {
    enumerable: true,
    get: () => {
      executed += 1;
      return 1;
    },
  });
  const proxy = new Proxy(identity(4), {
    ownKeys: () => {
      executed += 1;
      return [];
    },
    getPrototypeOf: () => {
      executed += 1;
      return Object.prototype;
    },
  });
  for (const bad of [getter, proxy, Object.create(identity(4))]) {
    const base = fixture();
    base.target.root.identity = bad;
    assert.throws(() => encodeHostTerminalIntent(base), /host_terminal_/u);
  }
  const input = fixture();
  Object.defineProperty(input.target.marker, "sha256", {
    enumerable: true,
    get: () => {
      executed += 1;
      return "f".repeat(64);
    },
  });
  assert.throws(
    () => encodeHostTerminalIntent(input),
    /host_terminal_shape_invalid/u,
  );
  const unknown = fixture();
  Object.defineProperty(unknown, Symbol("hidden"), { value: true });
  assert.throws(
    () => encodeHostTerminalIntent(unknown),
    /host_terminal_shape_invalid/u,
  );
  const withToJson = {
    ...fixture(),
    toJSON: () => {
      executed += 1;
      return fixture();
    },
  };
  assert.throws(
    () => encodeHostTerminalIntent(withToJson),
    /host_terminal_shape_invalid/u,
  );
  assert.equal(executed, 0);
});

/**
 * 文書上限と正規bytesの反例を確認する。
 *
 * @responsibility UTF-8、JSONの意味一致とbyte完全一致を区別する。
 * @trace PRL-UT-006
 * @precondition 正規fixture文書。
 * @stimulus BOM、空白、重複key、改行、escape、指数表現、不正UTF-8を与える。
 * @observation 固定エラーと受理bytes。
 * @oracle 非正規表現・不正文書を全拒否する。
 * @cleanup N/A: bytesだけを生成する。
 * @boundary N/A: file flushやpublicationは観測しない。
 */
test("Host終端intentはBOM・重複key・余分bytes・非正規JSONを拒否する", () => {
  const text = encodeHostTerminalIntent(fixture()).serialized;
  for (const noncanonical of [
    `${text}\n`,
    ` ${text}`,
    `${text}{}`,
    `\uFEFF${text}`,
    text.replace(
      '"contractRevision":2',
      '"contractRevision":2,"contractRevision":2',
    ),
    text.replace('"contractRevision":2', '"contractRevision":2e0'),
    text.replace('"fileIndexHigh":0', '"fileIndexHigh":-0'),
    text.replace("workspace", "\\u0077orkspace"),
    JSON.stringify(JSON.parse(text), null, 2),
  ]) {
    assert.notEqual(noncanonical, text);
    assert.throws(
      () => decodeHostTerminalIntent(Buffer.from(noncanonical, "utf8")),
      /host_terminal_/u,
    );
  }
  for (const bytes of [
    Buffer.from([0xc3, 0x28]),
    Buffer.from("{"),
    Buffer.alloc(0),
    Buffer.alloc(8_193),
    Buffer.alloc(8_192, 0x20),
  ])
    assert.throws(() => decodeHostTerminalIntent(bytes), /host_terminal_/u);
  assert.throws(
    () => decodeHostTerminalIntent(text),
    /host_terminal_bytes_invalid/u,
  );
  assert.throws(
    () => decodeHostTerminalIntent(new Uint8Array(new SharedArrayBuffer(4))),
    /host_terminal_bytes_invalid/u,
  );
  assert.throws(
    () => decodeHostTerminalIntent(Buffer.alloc(8_192, 0x20)),
    /host_terminal_document_invalid/u,
  );
  assert.throws(
    () => decodeHostTerminalIntent(Buffer.alloc(8_193, 0x20)),
    /host_terminal_bytes_invalid/u,
  );
});

/**
 * byte入力のcustom propertyを通らず所有copyを取る。
 *
 * @responsibility iterator、buffer getterおよび入力変更を結果へ持ち越さない。
 * @trace PRL-UT-006
 * @precondition 正規文書を持つUint8Array。
 * @stimulus getter／iteratorを上書きしてdecode後に元bytesを変更する。
 * @observation callback回数と返却serialized。
 * @oracle custom処理実行0、変更後も返却値不変。
 * @cleanup N/A: memory copyのみ。
 * @boundary N/A: 実搬送・OS protectionは未検証。
 */
test("Host終端intentはbyte入力のcustom getterやiteratorを使わない", () => {
  const text = encodeHostTerminalIntent(fixture()).serialized;
  const bytes = new Uint8Array(Buffer.from(text));
  let executed = 0;
  Object.defineProperty(bytes, "buffer", {
    get: () => {
      executed += 1;
      throw new Error("forbidden");
    },
  });
  Object.defineProperty(bytes, Symbol.iterator, {
    value: () => {
      executed += 1;
      throw new Error("forbidden");
    },
  });
  const decoded = decodeHostTerminalIntent(bytes);
  bytes.fill(0);
  assert.equal(decoded.serialized, text);
  assert.equal(executed, 0);
  const backing = Buffer.concat([
    Buffer.from("prefix"),
    Buffer.from(text),
    Buffer.from("suffix"),
  ]);
  assert.equal(
    decodeHostTerminalIntent(backing.subarray(6, 6 + Buffer.byteLength(text)))
      .serialized,
    text,
  );
  const detached = new Uint8Array(Buffer.from(text));
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(
    () => decodeHostTerminalIntent(detached),
    /host_terminal_bytes_invalid/u,
  );
  assert.throws(
    () =>
      decodeHostTerminalIntent(
        new Proxy(new Uint8Array(Buffer.from(text)), {}),
      ),
    /host_terminal_bytes_invalid/u,
  );
});
