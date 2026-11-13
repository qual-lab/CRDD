/**
 * 認証の元Snapshot・Intent・Receipt保存を有限Filesystemで反証する。
 * @responsibility 通知正常終了より前の保存読戻しと未要求窓の区別を確認する。
 * @trace ERB-UT-016
 * @level UT
 * @scope Source宣言とメモリ内保存。実AI・Docker・Directory操作はない。
 * @packageDocumentation
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
  validateResourceBook,
} from "../../../execution-model/src/index.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { snapshotJsonValue } from "../../src/input/snapshot.ts";

/**
 * 認証記録の実宣言へ保存代役だけを接続する。
 * @responsibility このSuiteの合成依存と初期入力を構築する
 * @trace ERB-UT-016
 * @precondition Source宣言とメモリ内保存。実AI・Docker・Directory操作はない。
 * @stimulus このSuiteの合成依存と初期入力を構築する。
 * @observation 構築した候補、有限応答または検出した例外。
 * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
 * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
function fixture() {
  const source = fs.readFileSync(
    new URL("../../src/execution/authority.ts", import.meta.url),
    "utf8",
  );
  const expected = {
    contract: "provider-authentication",
    contractRevision: 2,
    provider: "codex",
    action: "status",
    recoveryId: "provider-auth.codex.status.fixture",
    stableLogicalHomeBindingHash: "a".repeat(64),
    suffix: "a".repeat(16),
    ownershipLabel: "crdd.owner=fixture",
    resources: null,
    state: "active",
    commandState: "idle",
    commandPurpose: null,
  };
  let saved = JSON.stringify(expected),
    writes = 0,
    failRead = false;
  let resourceCalls = 0;
  let tamper: null | ((value: Record<string, unknown>) => unknown) = null;
  const names = [
    "sameRecoveryRecord",
    "setProviderAuthenticationRecoveryCommandState",
    "recordProviderAuthenticationResource",
    "readProviderAuthenticationResources",
  ];
  const api = runInNewContext(
    names.map((n) => sourceDeclaration(source, n)).join("\n") +
      ";({set:setProviderAuthenticationRecoveryCommandState,record:recordProviderAuthenticationResource,read:readProviderAuthenticationResources})",
    {
      Object,
      JSON,
      createHash,
      validateResourceBook,
      snapshotJsonValue,
      isDeepStrictEqual,
      applyResourceEvent: (
        before: OperationResources | null,
        event: unknown,
      ) => {
        resourceCalls++;
        return applyResourceEvent(before, JSON.parse(JSON.stringify(event)));
      },
      applyResourceCleanup: (
        ...args: Parameters<typeof applyResourceCleanup>
      ) => {
        resourceCalls++;
        return applyResourceCleanup(...args);
      },
      fs: {
        readFileSync: () => {
          if (failRead) throw Error("unavailable");
          return saved;
        },
        writeFileSync: (
          _path: string,
          bytes: string,
          options: { flush: boolean },
        ) => {
          assert.equal(options.flush, true);
          writes++;
          saved = tamper ? JSON.stringify(tamper(JSON.parse(bytes))) : bytes;
        },
      },
    },
  ) as {
    set(
      record: unknown,
      state: string,
      purpose: string | null,
      resources?: unknown,
      key?: string,
    ): boolean;
    record(record: unknown, event: unknown): boolean;
    read(
      record: unknown,
    ): Readonly<{ resources: OperationResources | null }> | null;
  };
  const material = {
    snapshot: {
      resources: [
        {
          key: "probe",
          request: "not_issued",
          identity: {
            kind: "container",
            name: "crdd-probe",
            dockerId: null,
            ownershipLabel: expected.ownershipLabel,
          },
          configuration: {
            image: null,
            command: null,
            environmentNames: null,
            mounts: null,
            networks: null,
            internal: null,
          },
        },
      ],
    },
    cleanup: {
      cleanupOrder: ["probe"],
      setupTimeoutMs: 1000,
      unreceiptedAbsence: "observe",
      verifyLabelAbsence: true,
    },
  };
  return {
    api,
    material,
    record: { ...expected, recordPath: "finite-record" },
    state: () => JSON.parse(saved),
    writes: () => writes,
    resourceCalls: () => resourceCalls,
    tamper(value: typeof tamper) {
      tamper = value;
    },
    failRead() {
      failRead = true;
    },
  };
}

/**
 * 未信頼通知の捕捉拒否を資源更新と保存より前に確認する。
 * @responsibility 共通入力捕捉の拒否を認証の既存false結果へ接続する。
 * @trace ERB-UT-016
 * @precondition 有限記録と本番認証処理を使う。
 * @stimulus Getter・Proxy・toJSON・symbolと循環入力をIntent／Receiptへ渡す。
 * @observation Writer・資源値操作・未知実行の到達数と元記録。
 * @oracle 全てfalse・到達0・元記録不変となる。
 * @cleanup 外部資源なし。
 * @boundary 論理的な記録接続。実認証やDocker成立は示さない。
 */
test("認証の不正入力は資源値操作と保存の前に拒否する", () => {
  let traps = 0;
  const getter = Object.defineProperty({}, "snapshot", {
    get() {
      traps++;
      return {};
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        traps++;
        return [];
      },
    },
  );
  const toJSON = {
    toJSON() {
      traps++;
      return {};
    },
  };
  const cycle: unknown[] = [];
  cycle.push(cycle);
  for (const input of [
    getter,
    proxy,
    toJSON,
    { [Symbol("field")]: 1 },
    cycle,
  ]) {
    const f = fixture(),
      before = f.state();
    assert.equal(
      f.api.set(f.record, "in_flight", "create_probe", input, "probe"),
      false,
    );
    assert.equal(f.api.record(f.record, input), false);
    assert.equal(f.writes(), 0);
    assert.equal(f.resourceCalls(), 0);
    assert.deepEqual(f.state(), before);
  }
  assert.equal(traps, 0);
});

/**
 * 認証は初回Intentと元Snapshotの保存読戻しが一致した時だけ通知を完了する。
 * @responsibility 認証は初回Intentと元Snapshotの保存読戻しが一致した時だけ通知を完了する
 * @trace ERB-UT-016
 * @precondition Source宣言とメモリ内保存。実AI・Docker・Directory操作はない。
 * @stimulus 認証は初回Intentと元Snapshotの保存読戻しが一致した時だけ通知を完了するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証は初回Intentと元Snapshotの保存読戻しが一致した時だけ通知を完了するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証は初回Intentと元Snapshotの保存読戻しが一致した時だけ通知を完了する", () => {
  for (const tamper of [
    null,
    (v: Record<string, unknown>) => ({ ...v, resources: null }),
  ]) {
    const f = fixture();
    f.tamper(tamper);
    const accepted = f.api.set(
      f.record,
      "in_flight",
      "create_probe",
      f.material,
      "probe",
    );
    assert.equal(accepted, tamper === null);
    assert.equal(f.writes(), 1);
    if (accepted)
      assert.equal(
        f.state().resources.checkpoints[0].submission,
        "intent_saved",
      );
  }
});

/**
 * 認証のReceiptは同じIntentへだけ保存し、終端結果から実IDを補完しない。
 * @responsibility 認証のReceiptは同じIntentへだけ保存し、終端結果から実IDを補完しない
 * @trace ERB-UT-016
 * @precondition Source宣言とメモリ内保存。実AI・Docker・Directory操作はない。
 * @stimulus 認証のReceiptは同じIntentへだけ保存し、終端結果から実IDを補完しないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証のReceiptは同じIntentへだけ保存し、終端結果から実IDを補完しないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証のReceiptは同じIntentへだけ保存し、終端結果から実IDを補完しない", () => {
  const f = fixture();
  assert.equal(
    f.api.set(f.record, "in_flight", "create_probe", f.material, "probe"),
    true,
  );
  const snapshot = structuredClone(f.material.snapshot);
  const resource = snapshot.resources[0];
  assert.ok(resource);
  const receiptSnapshot = {
    resources: [
      {
        ...resource,
        request: "issued",
        identity: { ...resource.identity, dockerId: "b".repeat(64) },
      },
    ],
  };
  assert.equal(
    f.api.record(f.record, {
      event: "cleanup",
      snapshot: receiptSnapshot,
      observations: [{ key: "probe", observation: "absent" }],
    }),
    false,
  );
  assert.equal(
    f.api.record(f.record, {
      ...f.material,
      snapshot: receiptSnapshot,
      event: "receipt",
      key: "probe",
    }),
    true,
  );
  assert.equal(f.api.set(f.record, "idle", null), true);
  assert.equal(
    f.api.record(f.record, {
      event: "cleanup",
      snapshot: receiptSnapshot,
      observations: [{ key: "probe", observation: "absent" }],
    }),
    true,
  );
  assert.equal(
    f.state().resources.checkpoints[0].receiptSource,
    "docker_create_result",
  );
});

/**
 * 認証の未要求を確認した読取りと観測不能・未終了Intentを区別する。
 * @responsibility 認証の未要求を確認した読取りと観測不能・未終了Intentを区別する
 * @trace ERB-UT-016
 * @precondition Source宣言とメモリ内保存。実AI・Docker・Directory操作はない。
 * @stimulus 認証の未要求を確認した読取りと観測不能・未終了Intentを区別するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証の未要求を確認した読取りと観測不能・未終了Intentを区別するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証の未要求を確認した読取りと観測不能・未終了Intentを区別する", () => {
  const f = fixture();
  const observed = f.api.read(f.record);
  assert.ok(observed);
  assert.equal(observed.resources, null);
  assert.equal(
    f.api.set(f.record, "in_flight", "create_probe", f.material, "probe"),
    true,
  );
  assert.equal(
    f.api.read(f.record),
    null,
    "未終了Intentを未要求窓へ変換しない",
  );
  const unavailable = fixture();
  unavailable.failRead();
  assert.equal(unavailable.api.read(unavailable.record), null);
  assert.equal(unavailable.writes(), 0);
});
