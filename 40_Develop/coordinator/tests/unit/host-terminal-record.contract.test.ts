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
import test from "node:test";
import {
  decodeHostTerminalIntent,
  encodeHostTerminalIntent,
  type HostTerminalWindowsIdentity,
} from "../../src/security/host-terminal-record.ts";

/**
 * 区別可能な局所Win32 Identityを作る。
 *
 * @responsibility 実観測と混同しない整数fixtureを生成する。
 * @trace PRL-UT-006
 * @precondition 呼出し側がfixtureのindexを指定する。
 * @stimulus indexを五fieldへ配置する。
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
    contractRevision: 1,
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
      '{"contract":"crdd-coordinator/host-terminal-intent","contractRevision":1,"reference":',
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
    () => encodeHostTerminalIntent({ ...base, contractRevision: 2 }),
    /host_terminal_contract_invalid/u,
  );
});

/**
 * 各scalarとIdentity aliasの境界を確認する。
 *
 * @responsibility 数値の非正規値、自由Path、誤った参照・Hashを拒否する。
 * @trace PRL-UT-006
 * @precondition 独立した正常fixture。
 * @stimulus 五u32全fieldの境界、不正名と同じfile indexを与える。
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
      '"contractRevision":1',
      '"contractRevision":1,"contractRevision":1',
    ),
    text.replace('"contractRevision":1', '"contractRevision":1e0'),
    text.replace('"fileIndexHigh":0', '"fileIndexHigh":-0'),
    text.replace("workspace", "\\u0077orkspace"),
    JSON.stringify(JSON.parse(text), null, 2),
  ])
    assert.throws(
      () => decodeHostTerminalIntent(Buffer.from(noncanonical, "utf8")),
      /host_terminal_/u,
    );
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
