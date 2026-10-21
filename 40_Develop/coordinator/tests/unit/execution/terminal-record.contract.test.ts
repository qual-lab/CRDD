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
import type { HostTerminalWindowsIdentity } from "../../../../platform-access/src/index.ts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";
import { snapshotPlainRecord } from "../../../../domain-model/src/index.ts";
import { hostOperationGenerationBindingHash } from "../../../src/execution/kernel-lock.ts";
import type { HostTerminalCheckpointPreparation } from "../../../src/execution/terminal-caller-checkpoint.ts";
import {
  decodeHostTerminalIntent,
  decodeKnownFixtureHostTerminalIntent,
  encodeHostTerminalIntent,
  encodeKnownFixtureHostTerminalIntent,
  resolveHostTerminalLegacyGeneration,
} from "../../../src/execution/terminal-record.ts";

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
      "../../../src/execution/terminal-caller-checkpoint.ts",
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
      "projectDevelopmentSourceReader",
    ],
  )(
    snapshotPlainRecord,
    /^host-terminal\.[a-f0-9-]{36}$/u,
    resolveHostTerminalLegacyGeneration,
    () => ({}),
    createHash,
    (context: unknown) => context,
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
