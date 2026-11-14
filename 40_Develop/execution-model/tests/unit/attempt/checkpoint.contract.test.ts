/**
 * Checkpoint完成操作の依存選択と停止条件を実Sourceの局所評価で確認する。
 * @packageDocumentation
 * @responsibility 六用途の元入力・候補・Writer順序と拒否時の保存0を維持する。
 * @trace ERB-UT-023
 * @level UT
 * @scope Source読取りと有限の同期依存。実保存・AI・Dockerは使用しない。
 * @boundary 実操作本文と試験内のReader／候補／Writer代役。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeStorageSourceFixture } from "../../support/runtime-storage-source.ts";

const KINDS = [
  "resource",
  "cleanup",
  "host",
  "lifecycle",
  "references",
  "restart",
] as const;

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
    ["host", "prepareStateHostSnapshot"],
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
test("Checkpoint六用途は同じ元入力と候補を一回のOwned Writerへ渡す", () => {
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
