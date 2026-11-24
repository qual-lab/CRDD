/**
 * Checkpoint完成操作の依存選択と停止条件を実Sourceの局所評価で確認する。
 * @packageDocumentation
 * @responsibility Docker五用途の保存順序と拒否時の保存0、専用Host完成操作の値契約を確認する。
 * @trace ERB-UT-023
 * @trace PRL-UT-006
 * @level UT
 * @scope Source読取り・有限依存とHost候補の値検査。実保存・AI・Dockerは使用しない。
 * @boundary 実操作本文と試験内のReader／候補／Writer代役。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { HostOperationRecord } from "../../../src/attempt/types.ts";
import {
  decodeHostOperation,
  validHostOperationTransition,
} from "../../../src/attempt/validation.ts";
import { createRuntimeStorageSourceFixture } from "../../support/storage-source.ts";
import { createResourceOperationFixture } from "../../support/resource-operation.ts";
import { encodeStateValue } from "../../../src/state/operations.ts";

/**
 * 初回資源Intent前の回復終端を、独立Hostの確定後だけ保存する。
 * @responsibility Null Bookを架空の資源へ変換せず、現在のHost相関と元版を保存入口へ渡す。
 * @trace ERB-UT-023
 * @precondition 現行IdentityとHostを含む有限Snapshotを使用する。
 * @stimulus Host確定・未確定、資源未発行と未知発行を渡す。
 * @observation 実候補生成の成否とWriterの到達数。
 * @oracle 全共同条件を満たす場合だけblocked結果の清掃確認を保存する。
 * @cleanup N/A: メモリだけ。
 * @boundary 実回復終端受付・候補生成と有限Reader／Writer。
 */
test("初回Intent前の回復終端は同じHost確定後だけ候補を保存する", () => {
  const fixture = createResourceOperationFixture();
  for (const fault of ["none", "host_pending", "unknown_effect"]) {
    const snapshot = JSON.parse(fixture.bytes.toString("utf8"));
    const operation = snapshot.operations.find(
      (item: { kind: string }) => item.kind === "docker_task",
    );
    const host = snapshot.operations.find(
      (item: { kind: string }) => item.kind === "host_operation",
    );
    host.phase = fault === "host_pending" ? "active" : "terminal";
    host.cleanup = fault === "host_pending" ? "pending" : "confirmed";
    operation.phase = "settling";
    operation.lease = "released";
    operation.resources = null;
    operation.execution.ownerEffect = "disabled";
    if (fault === "unknown_effect")
      operation.execution.externalSend = "unknown";
    const before = Buffer.from(`${encodeStateValue(snapshot)}\n`);
    let writes = 0;
    const api = createRuntimeStorageSourceFixture(undefined, {
      readStateSnapshot: () => ({
        status: "completed",
        lockReleased: true,
        value: { snapshot, payloadSha256: "a".repeat(64) },
      }),
      writeStateSnapshot: (
        _owner: unknown,
        _repository: unknown,
        bytes: unknown,
      ) => {
        if (Buffer.isBuffer(bytes)) writes++;
        return {
          status: Buffer.isBuffer(bytes) ? "completed" : "blocked",
          snapshotConfirmed: Buffer.isBuffer(bytes),
          lockReleased: true,
        };
      },
    });
    const result = api.saveRecoveryCheckpoint(
      {
        operationId: fixture.identity.operationId,
        repositoryRoot: "fixture-root",
        repositoryBinding: fixture.binding,
        revalidate: () => true,
      },
      fixture.recoveryId,
      before,
      { kind: "terminal", assertOwner: () => true },
    );
    assert.equal(result.snapshotConfirmed, fault === "none", fault);
    assert.equal(writes, fault === "none" ? 1 : 0, fault);
  }
});

/**
 * 回復Lease解放を現行execution契約だけで受付する。
 * @responsibility 旧ownerDisabledを要求せず、Owner無効・資源終結・元版と結果保持を共同確認する。
 * @trace ERB-UT-023
 * @precondition 本番受付本文と独立した有限Reader／候補／Writerを使う。
 * @stimulus 正規解放、Owner有効／不明、資源未終結、別版・別操作、結果改変を渡す。
 * @observation 候補とWriterの到達数、元入力全文。
 * @oracle 正規解放だけが候補生成と保存へ到達する。
 * @cleanup N/A: メモリだけ。
 * @boundary 回復Checkpointの受付。候補遷移と実保存は別の既存試験で検証する。
 */
test("回復Lease解放は現行executionと同じ元版・結果を要求する", () => {
  const immutable = createResourceOperationFixture();
  for (const fault of [
    "none",
    "active",
    "unknown",
    "resources",
    "version",
    "operation",
    "outcome",
    "summary",
  ] as const) {
    const operation = {
      ...immutable.operation,
      phase: "settling" as const,
      execution: {
        ...immutable.operation.execution,
        ownerEffect: "disabled" as const,
      },
    };
    const base = JSON.parse(immutable.bytes.toString("utf8"));
    const snapshot = {
      ...base,
      operations: base.operations.map((item: { kind: string }) =>
        item.kind === "docker_task" ? operation : item,
      ),
    };
    const before = Buffer.from(`${encodeStateValue(snapshot)}\n`);
    const next = {
      phase: "settling",
      lease: "released",
      execution: {
        ...operation.execution,
        ownerEffect:
          fault === "active"
            ? "active"
            : fault === "unknown"
              ? "unknown"
              : "disabled",
      },
      primaryFailure: operation.primaryFailure,
      outcome: fault === "outcome" ? {} : operation.outcome,
      summarySha256:
        fault === "summary" ? "a".repeat(64) : operation.summarySha256,
    };
    let prepared = 0,
      writes = 0;
    const candidate = Buffer.from("candidate");
    const api = createRuntimeStorageSourceFixture(undefined, {
      readStateSnapshot: () => ({
        status: "completed",
        lockReleased: true,
        value: {
          snapshot,
          operationStates: [
            {
              kind: "docker_task",
              operation,
              resourcesSettled: fault !== "resources",
            },
          ],
        },
      }),
      prepareStateLifecycleSnapshot: (
        bytes: Buffer,
        id: string,
        value: unknown,
      ) => {
        assert.deepEqual(bytes, before);
        assert.equal(id, operation.recoveryId);
        assert.deepEqual(value, next);
        prepared++;
        return candidate;
      },
      writeStateSnapshot: (
        _owner: unknown,
        _repository: unknown,
        bytes: unknown,
      ) => {
        if (bytes === candidate) writes++;
        return {
          status: bytes === candidate ? "completed" : "blocked",
          snapshotConfirmed: bytes === candidate,
          lockReleased: true,
        };
      },
    });
    const result = api.saveRecoveryCheckpoint(
      {
        operationId:
          fault === "operation" ? "OP-999999" : immutable.identity.operationId,
        repositoryBinding: immutable.binding,
        repositoryRoot: "fixture-root",
        revalidate: () => true,
      },
      operation.recoveryId,
      fault === "version" ? Buffer.from("different") : before,
      { kind: "lifecycle", value: next, assertOwner: () => true },
    );
    assert.equal(result.snapshotConfirmed, fault === "none", fault);
    assert.equal(prepared, fault === "none" ? 1 : 0, fault);
    assert.equal(writes, fault === "none" ? 1 : 0, fault);
    assert.deepEqual(before, Buffer.from(`${encodeStateValue(snapshot)}\n`));
  }
});

/**
 * 開始保存と終端準備を一つの完成操作として検証する。
 * @responsibility 保存済みの開始記録を準備失敗で未実施へ戻さない。
 * @trace PRL-UT-006
 * @precondition 同じ操作・Repositoryの合成読取りと保存結果を使う。
 * @stimulus 準備成功・拒否・例外、保存不明とReader解放不明を与える。
 * @observation 開始保存flag、Context、exact回復参照、Effectと呼出し順序。
 * @oracle 保存と排他確認後だけ準備し、失敗でも元参照と発行事実を保持する。
 * @cleanup 外部資源なし。
 * @boundary 完成操作の制御。実Filesystemは限定結合試験が確認する。
 */
test("開始保存後の終端準備失敗は元記録とEffectを保持する", () => {
  const immutable = createResourceOperationFixture();
  for (const scenario of [
    "ready",
    "refused",
    "throw",
    "write_unknown",
    "read_unlock_unknown",
    "prepare_unlock_unknown",
  ]) {
    const access = {},
      context = {};
    const identityJson = immutable.operation.identityJson;
    const operation = immutable.operation;
    const currentSnapshot = JSON.parse(immutable.bytes.toString("utf8"));
    currentSnapshot.operations = currentSnapshot.operations.filter(
      (item: { kind: string }) => item.kind === "host_operation",
    );
    const calls: string[] = [];
    const execute = createRuntimeStorageSourceFixture(undefined, {
      observeOperationRepository: () => ({
        operationId: immutable.identity.operationId,
        repositoryBinding: immutable.binding,
      }),
      readStateSnapshot: () => ({
        status: "completed",
        reason: "read",
        lockReleased: scenario !== "read_unlock_unknown",
        value: { snapshot: currentSnapshot },
      }),
      writeStateSnapshot: () => ({
        status: "blocked",
        reason: "coordinator_state_input_invalid",
        snapshotConfirmed: false,
        filesystemEffectIssued: false,
        lockReleased: true,
      }),
      writeOwnedStateSnapshot: (received: unknown) => {
        assert.equal(received, access);
        calls.push("save");
        return {
          status: scenario === "write_unknown" ? "blocked" : "completed",
          reason: "write",
          snapshotConfirmed: scenario !== "write_unknown",
          filesystemEffectIssued: true,
          lockReleased: true,
        };
      },
      prepareOperationCompletion: (
        received: unknown,
        reference: unknown,
        consumer: unknown,
      ) => {
        calls.push("prepare");
        assert.equal(received, access);
        assert.equal(reference, operation.recoveryId);
        assert.equal(consumer, immutable.identity.consumer);
        if (scenario === "throw") throw new Error("prepare failure");
        return {
          context: scenario === "ready" ? context : null,
          reason:
            scenario === "prepare_unlock_unknown"
              ? "coordinator_state_lock_release_unconfirmed"
              : null,
          lockReleased: scenario !== "prepare_unlock_unknown",
        };
      },
    }).saveOperationStart;
    const result = execute(access, identityJson);
    assert.equal(result.recoveryId, operation.recoveryId);
    assert.equal(result.status, scenario === "ready" ? "completed" : "blocked");
    assert.equal(
      result.completionContext,
      scenario === "ready" ? context : null,
    );
    assert.equal(
      result.startSaved,
      ["ready", "refused", "throw", "prepare_unlock_unknown"].includes(
        scenario,
      ),
    );
    assert.equal(
      result.lockReleased,
      !["read_unlock_unknown", "prepare_unlock_unknown", "throw"].includes(
        scenario,
      ),
    );
    if (scenario === "prepare_unlock_unknown")
      assert.equal(result.reason, "coordinator_state_lock_release_unconfirmed");
    assert.equal(
      result.filesystemEffectIssued,
      scenario !== "read_unlock_unknown",
    );
    assert.deepEqual(
      calls,
      scenario === "read_unlock_unknown"
        ? []
        : scenario === "write_unknown"
          ? ["save"]
          : ["save", "prepare"],
    );
  }
});

/**
 * Docker開始は空Stateを仮生成せず、保存済みHostを含む現在断面へ追加する。
 * @responsibility 入力検証・現在Reader・Writer・終了Context捕捉を一つの完成操作として確認する。
 * @trace ERB-UT-023
 * @precondition 不変Identityだけを共有し、各観点のSnapshot・Owner・故障を独立させる。
 * @stimulus 正常、Host欠測、Reader不明／未解放、不正JSON／nonce／Operation／Repository、保存不明、Context欠測。
 * @observation Reader・Writer回数、既存Host全文、回復ID、保存flagとEffect。
 * @oracle 不正入力はReader 0、Host欠測はWriter 0。不明時も元参照を保持し開始成功へ補完しない。
 * @cleanup N/A: Sourceとメモリ代役のみ。
 * @boundary 受付と現在候補の調停。実CASは既存保存結合試験が検証する。
 */
test("Docker開始は現在Hostを保ち、旧空State初期化へ戻らない", () => {
  const immutable = createResourceOperationFixture();
  for (const fault of [
    "none",
    "host_absent",
    "reader_unknown",
    "reader_unknown_with_value",
    "reader_completed_without_value",
    "reader_unreleased",
    "nonce",
    "operation",
    "repository",
    "json",
    "writer_unknown",
    "context_missing",
  ]) {
    const snapshot = JSON.parse(immutable.bytes.toString("utf8"));
    snapshot.operations = snapshot.operations.filter(
      (item: { kind: string }) => item.kind === "host_operation",
    );
    if (fault === "host_absent") snapshot.operations = [];
    const before = JSON.stringify(snapshot),
      calls: string[] = [];
    const identity = JSON.parse(immutable.operation.identityJson);
    if (fault === "nonce") identity.operationNonce = "bad";
    if (fault === "operation") identity.operationId = "OP-999999";
    if (fault === "repository") identity.repositoryBinding = "f".repeat(64);
    const input = `${JSON.stringify(identity)}${fault === "json" ? "" : "\n"}`;
    const context = {};
    const api = createRuntimeStorageSourceFixture(undefined, {
      observeOperationRepository: () => ({
        operationId: immutable.identity.operationId,
        repositoryBinding: immutable.binding,
      }),
      readStateSnapshot: () => {
        calls.push("read");
        return {
          status: ["reader_unknown", "reader_unknown_with_value"].includes(
            fault,
          )
            ? "blocked"
            : "completed",
          reason: "reader_result",
          lockReleased: fault !== "reader_unreleased",
          value: ["reader_unknown", "reader_completed_without_value"].includes(
            fault,
          )
            ? null
            : { snapshot },
        };
      },
      writeStateSnapshot: () => ({
        status: "blocked",
        reason: "coordinator_state_input_invalid",
        snapshotConfirmed: false,
        filesystemEffectIssued: false,
        lockReleased: true,
      }),
      writeOwnedStateSnapshot: (_owner: unknown, bytes: Buffer) => {
        calls.push("write");
        const next = JSON.parse(bytes.toString("utf8"));
        assert.deepEqual(
          next.operations.filter(
            (item: { kind: string }) => item.kind === "host_operation",
          ),
          snapshot.operations,
        );
        return {
          status: fault === "writer_unknown" ? "blocked" : "completed",
          reason: "writer_result",
          snapshotConfirmed: fault !== "writer_unknown",
          filesystemEffectIssued: true,
          lockReleased: true,
        };
      },
      prepareOperationCompletion: () => {
        calls.push("context");
        return {
          context: fault === "context_missing" ? null : context,
          lockReleased: true,
        };
      },
    });
    const result = api.saveOperationStart({}, input);
    const invalidInput = ["nonce", "operation", "repository", "json"].includes(
      fault,
    );
    assert.equal(
      result.status,
      fault === "none" ? "completed" : "blocked",
      fault,
    );
    assert.equal(
      result.recoveryId,
      invalidInput ? null : immutable.recoveryId,
      fault,
    );
    assert.equal(
      result.startSaved,
      fault === "none" || fault === "context_missing",
      fault,
    );
    assert.equal(
      result.completionContext,
      fault === "none" ? context : null,
      fault,
    );
    assert.equal(calls.includes("read"), !invalidInput, fault);
    assert.equal(
      calls.includes("write"),
      ["none", "writer_unknown", "context_missing"].includes(fault),
      fault,
    );
    assert.equal(result.filesystemEffectIssued, calls.includes("write"), fault);
    assert.equal(JSON.stringify(snapshot), before, fault);
  }
});

/**
 * 同じHostに固定Commitの予定・OID・Ref確認・回収を保存する。
 * @responsibility 別Storeや独立した許可を作らず、未確認を未発行へ戻さない。
 * @trace ERB-UT-023
 * @precondition 正規Hostと合成Git値のみ。
 * @stimulus 予定、OID取得、Ref発行、確認、回収と終端を順に与える。
 * @observation 値遷移と既知値の保持。
 * @oracle 未回収Refを持つHost終端は不成立。
 * @cleanup N/A: メモリ値のみ。
 * @boundary 実Gitの成立はCoordinatorの結合試験が所有する。
 */
test("HostのGit資源は予定からOID・Ref確認・回収へ単調に進む", () => {
  const fixture = createResourceOperationFixture();
  const host = JSON.parse(fixture.bytes.toString("utf8")).operations.find(
    (item: { kind: string }) => item.kind === "host_operation",
  ) as HostOperationRecord;
  assert.ok(host);
  const item = {
    name: `refs/heads/crdd/operation/${host.operationId}/baseline`,
    commitId: null,
    temporary: null,
    request: "not_issued",
    cleanup: "pending",
  } as const;
  const planned = { ...host, git: [item] };
  const receivedItem = { ...item, commitId: "a".repeat(40) };
  const confirmedItem = { ...receivedItem, request: "confirmed" as const };
  const received = { ...host, git: [receivedItem] };
  const issued = {
    ...host,
    git: [{ ...receivedItem, request: "unknown" as const }],
  };
  const confirmed = { ...host, git: [confirmedItem] };
  const cleaned = {
    ...host,
    git: [{ ...confirmedItem, cleanup: "confirmed" as const }],
  };
  for (const [before, after] of [
    [host, planned],
    [planned, received],
    [received, issued],
    [issued, confirmed],
    [confirmed, cleaned],
  ])
    assert.equal(validHostOperationTransition(before, after), true);
  assert.equal(
    decodeHostOperation({
      ...confirmed,
      phase: "terminal",
      cleanup: "confirmed",
    }),
    null,
  );
  assert.equal(
    validHostOperationTransition(cleaned, {
      ...cleaned,
      phase: "terminal",
      cleanup: "confirmed",
    }),
    true,
  );
});

/**
 * Git値の範囲逸脱・既知値差替え・巻戻しを拒否する。
 * @responsibility 名前だけを削除許可にせず閉形式と元操作の相関を維持する。
 * @trace ERB-UT-023
 * @precondition 各反証は正規Hostから独立生成する。
 * @stimulus 別操作、suffix、OID、Index Path／実体、Ref状態とHost回収状態を単独変更する。
 * @observation 値受付と遷移拒否、Getter未実行。
 * @oracle 不明・余剰・消去・既知値差を補完しない。
 * @cleanup N/A: メモリ値のみ。
 * @boundary 保存値検査。実体・Git CAS・現在性は物理Ownerの責務。
 */
test("HostのGit資源は別操作・Index逸脱・既知値差と未回収終端を拒否する", () => {
  const fixture = createResourceOperationFixture();
  const host = JSON.parse(fixture.bytes.toString("utf8")).operations.find(
    (item: { kind: string }) => item.kind === "host_operation",
  ) as HostOperationRecord;
  const item = {
    name: `refs/heads/crdd/operation/${host.operationId}/baseline`,
    commitId: "a".repeat(40),
    temporary: null,
    request: "unknown",
    cleanup: "pending",
  } as const;
  const before = { ...host, git: [item] };
  const storedIndex = {
    relativePath: `.crdd/coordinator/${host.operationId}/management/candidate-index-abcdef`,
    identity: "a".repeat(64),
  };
  assert.ok(
    decodeHostOperation({
      ...host,
      git: [{ ...item, temporary: storedIndex }],
    }),
  );
  for (const first of [
    item,
    { ...item, request: "unknown" },
    { ...item, cleanup: "confirmed" },
  ])
    assert.equal(
      validHostOperationTransition(host, { ...host, git: [first] }),
      false,
    );
  const planned = {
    ...item,
    commitId: null,
    request: "not_issued",
    cleanup: "pending",
  };
  assert.equal(
    validHostOperationTransition(host, {
      ...host,
      git: [
        planned,
        { ...planned, name: planned.name.replace("baseline", "candidate-1") },
      ],
    }),
    false,
  );
  for (const changed of [
    { ...item, name: item.name.replace(host.operationId, "OP-999999") },
    { ...item, name: item.name.replace("baseline", "candidate-0") },
    { ...item, commitId: "bad" },
    { ...item, commitId: null },
    { ...item, extra: true },
    {
      ...item,
      temporary: { relativePath: ".crdd/../index", identity: "a".repeat(64) },
    },
    {
      ...item,
      temporary: {
        ...storedIndex,
        relativePath: `.crdd/operations/${host.operationId}/management/candidate-index-abcdef`,
      },
    },
    {
      ...item,
      temporary: {
        ...storedIndex,
        identity: "bad",
      },
    },
  ])
    assert.equal(decodeHostOperation({ ...host, git: [changed] }), null);
  for (const changed of [
    { ...item, commitId: "b".repeat(40) },
    { ...item, request: "not_issued" },
  ])
    assert.equal(
      validHostOperationTransition(before, { ...host, git: [changed] }),
      false,
    );
  assert.equal(validHostOperationTransition(before, host), false);
  assert.equal(decodeHostOperation({ ...host, git: [item, item] }), null);
  assert.equal(
    decodeHostOperation({ ...host, purpose: "isolation_probe", git: [item] }),
    null,
  );
  let traps = 0;
  const hostile = Object.defineProperty({ ...item }, "name", {
    get() {
      traps++;
      return item.name;
    },
  });
  assert.equal(decodeHostOperation({ ...host, git: [hostile] }), null);
  assert.equal(traps, 0);
  const array = Object.assign([item], { extra: true });
  assert.equal(decodeHostOperation({ ...host, git: array }), null);
  for (const array of [
    Object.assign([item], { [Symbol("extra")]: true }),
    Object.defineProperty([item], "extra", { value: true }),
    Object.defineProperty([item], "0", {
      get() {
        traps++;
        return item;
      },
    }),
  ])
    assert.equal(decodeHostOperation({ ...host, git: array }), null);
  assert.equal(traps, 0);
  const stopped = { ...host, cleanup: "pending" as const };
  assert.equal(
    validHostOperationTransition(stopped, { ...stopped, git: [item] }),
    false,
  );
});

const KINDS = [
  "resource",
  "cleanup",
  "lifecycle",
  "references",
  "restart",
] as const;

/**
 * Host保存値の作成前Intent・実体Receipt・終端の相関を純粋値で確認する。
 * @responsibility この単体試験ではWriterへ接続せず値契約だけを検証する。
 * @trace ERB-UT-023
 * @precondition ID・実体は試験内の固定値で、実Filesystemを観測しない。
 * @stimulus 未作成、部分作成、全Receipt、回収不明、明示回収と終端を与える。
 * @observation 同じ操作の値遷移と独立捕捉。
 * @oracle 不明を完了へ補完せず、Receiptと操作IDを置換しない。
 * @cleanup N/A: メモリ値のみ。
 * @boundary 保存候補の意味検査。実作成・保存・回収の成立は対象外。
 */
test("Host保存候補は一つのIntentからReceiptと回収終端へ進む", () => {
  const intent: HostOperationRecord = {
    kind: "host_operation",
    operationId: "OP-123456",
    recoveryId: "host-operation.OP-123456",
    purpose: "task",
    resources: null,
    createdAt: "2026-11-19T00:00:00.000Z",
    phase: "preparing",
    rootIdentity: null,
    childIdentities: {},
    cleanup: "not_requested",
  };
  const identity = { dev: "1", ino: "2", birthtimeNs: "3" };
  const root = { ...intent, rootIdentity: identity };
  const partial = { ...root, childIdentities: { workspace: identity } };
  const active: HostOperationRecord = {
    ...root,
    phase: "active",
    childIdentities: {
      workspace: identity,
      providerHome: identity,
      tmp: identity,
      events: identity,
      projection: identity,
      management: identity,
    },
  };
  const pending: HostOperationRecord = { ...active, cleanup: "pending" };
  const unknown: HostOperationRecord = { ...pending, cleanup: "unknown" };
  const terminal: HostOperationRecord = {
    ...pending,
    phase: "terminal",
    cleanup: "confirmed",
  };
  for (const [before, after] of [
    [null, intent],
    [intent, root],
    [root, partial],
    [partial, active],
    [active, pending],
    [pending, unknown],
    [unknown, pending],
    [pending, terminal],
    [terminal, terminal],
  ])
    assert.equal(validHostOperationTransition(before, after), true);
  assert.equal(
    validHostOperationTransition(intent, {
      ...intent,
      phase: "terminal",
      cleanup: "confirmed",
    }),
    true,
  );
  for (const [before, after] of [
    [null, active],
    [null, terminal],
    [partial, { ...partial, phase: "active" }],
    [active, root],
    [active, { ...active, rootIdentity: null }],
    [active, { ...active, rootIdentity: { ...identity, ino: "4" } }],
    [active, { ...active, childIdentities: {} }],
    [
      active,
      {
        ...active,
        childIdentities: {
          ...active.childIdentities,
          workspace: { ...identity, ino: "4" },
        },
      },
    ],
    [pending, active],
    [terminal, pending],
    [active, { ...active, phase: "terminal" }],
    [active, { ...active, operationId: "OP-654321" }],
    [
      active,
      {
        ...active,
        operationId: "OP-654321",
        recoveryId: "host-operation.OP-654321",
      },
    ],
    [active, { ...active, purpose: "advice" }],
    [active, { ...active, createdAt: "2026-11-20T00:00:00.000Z" }],
  ])
    assert.equal(validHostOperationTransition(before, after), false);
  const captured = decodeHostOperation(active);
  assert.ok(captured);
  assert.notEqual(captured, active);
  assert.notEqual(captured.rootIdentity, identity);
  assert.notEqual(captured.childIdentities.workspace, identity);
  assert.equal(Object.isFrozen(captured), true);
  assert.equal(Object.isFrozen(captured.childIdentities.workspace), true);
  identity.ino = "9";
  assert.equal(captured.rootIdentity?.ino, "2");
});

/**
 * Host保存候補の外部値は余剰欄・実行Property・Proxyを拒否する。
 * @trace ERB-UT-023
 * @precondition すべてメモリ上の不正値。
 * @stimulus Path・Hash token・欠測・不正日時・getterとProxyを渡す。
 * @observation null拒否と実行Property呼出し0。
 * @oracle 保存形を補正・互換変換せず、実体不明を成功にしない。
 * @cleanup N/A: 外部Effectなし。
 * @boundary 未信頼入力から所有する保存値への捕捉。
 */
test("Host保存候補はPathと旧tokenを持たず不正入力を補完しない", () => {
  const intent = {
    kind: "host_operation",
    operationId: "OP-123456",
    recoveryId: "host-operation.OP-123456",
    purpose: "advice",
    resources: null,
    createdAt: "2026-11-19T00:00:00.000Z",
    phase: "preparing",
    rootIdentity: null,
    childIdentities: {},
    cleanup: "not_requested",
  };
  let executed = 0;
  const getter = Object.defineProperty({ ...intent }, "operationId", {
    enumerable: true,
    get() {
      executed++;
      return "OP-123456";
    },
  });
  const proxy = new Proxy(intent, {
    ownKeys() {
      executed++;
      return [];
    },
  });
  const childGetter = Object.defineProperty({}, "workspace", {
    enumerable: true,
    get() {
      executed++;
      return {};
    },
  });
  const identityGetter = Object.defineProperty(
    { ino: "2", birthtimeNs: "3" },
    "dev",
    {
      enumerable: true,
      get() {
        executed++;
        return "1";
      },
    },
  );
  for (const value of [
    null,
    [],
    {},
    getter,
    proxy,
    { ...intent, childIdentities: childGetter },
    { ...intent, rootIdentity: identityGetter },
    { ...intent, rootIdentity: proxy },
    { ...intent, childIdentities: proxy },
    { ...intent, path: "/host" },
    { ...intent, currentToken: "host.old" },
    { ...intent, operationId: undefined },
    { ...intent, purpose: {} },
    { ...intent, createdAt: "2026-11-19" },
    { ...intent, phase: "active" },
    { ...intent, phase: "terminal" },
    { ...intent, cleanup: "confirmed" },
    { ...intent, childIdentities: { unknown: {} } },
    { ...intent, rootIdentity: { dev: "1", ino: "2" } },
    { ...intent, rootIdentity: { dev: "1", ino: "-2", birthtimeNs: "3" } },
  ])
    assert.equal(decodeHostOperation(value), null);
  assert.equal(executed, 0);
});

/**
 * 同じ実操作本文へ用途固定の同期依存だけを接続する。
 * @responsibility 保存や実Ownerを作らず依存選択を観測する。
 * @trace ERB-UT-023
 * @precondition 呼出しごとに新規counter・結果・候補を作る。
 * @stimulus Reader、操作相関、元版又は候補拒否を注入する。
 * @observation 呼出し順、候補引数、Writer引数と返却値。
 * @oracle 代役を実保存成功の根拠にせず、実Sourceの制御だけを確認する。
 * @cleanup メモリ値だけ。製品Module・保存物は変更しない。
 * @boundary 局所Source評価と有限依存。
 */
function fixture(fault = "none") {
  const owner = Object.freeze({});
  const value = Object.freeze({ observation: "unknown" });
  const calls: string[] = [];
  const written: unknown[][] = [];
  const prepared: unknown[][] = [];
  const candidate = Buffer.from("candidate");
  const result = Object.freeze({ status: "blocked", reason: "writer_unknown" });
  const repository = {
    repositoryBinding: "binding",
    operationId: "OP-123456",
    revalidate: () => fault !== "owner",
  };
  const operation = {
    kind: "docker_task",
    recoveryId: fault === "recovery" ? "other" : "recovery",
    identityJson: JSON.stringify({
      operationId: fault === "operation" ? "OP-654321" : repository.operationId,
    }),
  };
  const overrides: Record<string, unknown> = {
    observeOperationRepository: () => {
      calls.push("repository");
      return repository;
    },
    readOperationStateStage: () => {
      calls.push("read");
      return {
        status: fault === "reader" ? "blocked" : "completed",
        reason: fault === "reader" ? "reader_unknown" : "observed",
        lockReleased: fault !== "reader",
        value: { snapshot: { operations: [operation] } },
      };
    },
    decodeStateSnapshot: () => (fault === "reference_decode" ? null : {}),
    writeOwnedStateSnapshot: (...args: unknown[]) => {
      calls.push("write");
      written.push(args);
      return result;
    },
  };
  for (const [kind, name] of [
    ["resource", "prepareStateResourceSnapshot"],
    ["cleanup", "prepareStateCleanupSnapshot"],
    ["lifecycle", "prepareStateLifecycleSnapshot"],
    ["references", "prepareStateReferencesSnapshot"],
    ["restart", "prepareStateRestartSnapshot"],
  ] as const) {
    overrides[name] = (...args: unknown[]) => {
      calls.push(String(kind));
      prepared.push(args);
      return fault === "candidate" ? null : candidate;
    };
  }
  const store = createRuntimeStorageSourceFixture(undefined, overrides);
  return {
    owner,
    value,
    calls,
    prepared,
    written,
    candidate,
    result,
    run: store.saveOperationCheckpoint,
  };
}

/** @trace ERB-UT-023 元Readerの後に一候補・一Writerだけを呼び、保存不明をそのまま返す。 */
test("Docker Checkpoint五用途は同じ元入力と候補を一回のOwned Writerへ渡す", () => {
  for (const kind of KINDS) {
    const f = fixture();
    assert.equal(
      f.run(f.owner, "recovery", { kind, value: f.value }),
      f.result,
    );
    assert.deepEqual(f.calls, ["repository", "read", kind, "write"]);
    assert.equal(f.prepared.length, 1);
    assert.equal(f.prepared[0]?.[1], "recovery");
    assert.equal(f.prepared[0]?.[2], f.value);
    assert.equal(f.prepared[0]?.[3], "binding");
    assert.deepEqual(f.written, [[f.owner, f.candidate]]);
  }
});

/** @trace ERB-UT-023 拒否を未発行の成功へ変えず、誤相関・Owner失効・候補不成立で保存しない。 */
test("CheckpointはReader不明・Owner失効・別操作・候補拒否でWriterを呼ばない", () => {
  for (const fault of [
    "reader",
    "owner",
    "operation",
    "recovery",
    "candidate",
    "reference_decode",
  ]) {
    const f = fixture(fault);
    const result = f.run(f.owner, "recovery", {
      kind: fault === "reference_decode" ? "references" : "resource",
      value: f.value,
    });
    assert.equal(result.status, "blocked", fault);
    assert.equal(result.filesystemEffectIssued, false, fault);
    assert.equal(result.lockReleased, fault !== "reader", fault);
    assert.equal(f.written.length, 0, fault);
  }
});

/** @trace ERB-UT-023 未信頼入力の余分欄・不明用途・getterを候補や保存へ流さない。 */
test("Checkpointは未知用途と実行Propertyを候補生成前に拒否する", () => {
  let getters = 0;
  const hostile = Object.defineProperty({ value: null }, "kind", {
    enumerable: true,
    get() {
      getters++;
      throw Error("getter");
    },
  });
  for (const request of [
    null,
    { kind: "unknown", value: null },
    { kind: "host_operation", value: null },
    { kind: "resource", value: null, extra: true },
    hostile,
  ]) {
    const f = fixture();
    const result = Reflect.apply(f.run, undefined, [
      f.owner,
      "recovery",
      request,
    ]);
    assert.equal(result.status, "blocked");
    assert.equal(f.prepared.length, 0);
    assert.equal(f.written.length, 0);
  }
  assert.equal(getters, 0);
});
