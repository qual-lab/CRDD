/**
 * Browser取得・明示操作のQuery接続を合成I/Oで検証する。
 * @packageDocumentation
 * @responsibility fresh取得・取消・再送なし・Cache非保持を実Queryで反証する。
 * @trace ERB-IT-021
 * @level IT
 * @scope TanStack Query→既存通信／合成読取り。
 * @boundary 実Browserの画面・実Server・実AIは別検証。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  onlineManager,
  QueryClient,
  type QueryCache,
  type MutationCache,
} from "@tanstack/react-query";
import {
  clearWorkbenchQueries,
  readWorkbenchQuery,
} from "../../src/client/api/queries.ts";
import { requestWorkbenchMutation } from "../../src/client/api/mutations.ts";
import { clearWorkbenchCredential } from "../../src/client/api/connection.ts";

/**
 * 同一用途でも毎回読取り、失敗・offlineから自動再送しない。
 * @responsibility 成功値と失敗本文をCacheへ残さない。
 * @trace ERB-IT-021
 * @precondition 実QueryClientと合成読取りだけ。
 * @stimulus 同一用途二回、offline一回、秘密風例外一回。
 * @observation 呼出し回数・固定例外・Query Cache空。
 * @oracle 前回値再利用0、失敗再送0、自由本文出力0。
 * @cleanup Online設定とprototypeを復元しQueryを破棄する。
 */
test("Queryは毎回freshでoffline保留・自動再送・結果保持をしない", async () => {
  const original = QueryClient.prototype.getQueryCache;
  const online = onlineManager.isOnline();
  let cache: QueryCache | undefined;
  QueryClient.prototype.getQueryCache = function () {
    cache = original.call(this);
    return cache;
  };
  let calls = 0;
  try {
    for (const expected of [1, 2]) {
      assert.equal(
        await readWorkbenchQuery(
          "view",
          new AbortController().signal,
          async () => ++calls,
        ),
        expected,
      );
      assert.equal(cache?.getAll().length, 0);
    }
    onlineManager.setOnline(false);
    assert.equal(
      await readWorkbenchQuery(
        "view",
        new AbortController().signal,
        async () => ++calls,
      ),
      3,
    );
    await assert.rejects(
      readWorkbenchQuery("view", new AbortController().signal, async () => {
        calls++;
        throw new Error("fixture-secret-never-output");
      }),
      { message: "workbench_query_unavailable" },
    );
    assert.equal(calls, 4);
    assert.equal(cache?.getAll().length, 0);
  } finally {
    clearWorkbenchQueries();
    onlineManager.setOnline(online);
    QueryClient.prototype.getQueryCache = original;
  }
});

/**
 * 同一URL相当の次要求と接続終了で旧Promiseを再利用しない。
 * @responsibility Caller取消とQuery取消の両方を読取りへ渡す。
 * @trace ERB-IT-021
 * @precondition 外部資源を持たない遅延Promise。
 * @stimulus 旧要求中に同用途の次要求、Caller取消、全Query破棄を行う。
 * @observation 旧Signal取消・次結果・固定失敗と遅延値非採用。
 * @oracle 旧finallyが新要求を取消せず、終了後の値を返さない。
 * @cleanup 全遅延PromiseをsettleしQueryを破棄する。
 */
test("Queryは取消済み旧要求を次要求や次接続へ共有しない", async () => {
  let finishOld: ((value: number) => void) | undefined;
  let oldSignal: AbortSignal | undefined;
  const firstOwner = new AbortController();
  const old = readWorkbenchQuery("view", firstOwner.signal, async (signal) => {
    oldSignal = signal;
    return new Promise<number>((resolve) => {
      finishOld = resolve;
    });
  });
  const rejected = assert.rejects(old, {
    message: "workbench_query_unavailable",
  });
  let finishNext: ((value: number) => void) | undefined;
  let nextSignal: AbortSignal | undefined;
  const next = readWorkbenchQuery(
    "view",
    new AbortController().signal,
    async (signal) => {
      nextSignal = signal;
      return new Promise<number>((resolve) => {
        finishNext = resolve;
      });
    },
  );
  assert.equal(oldSignal?.aborted, false);
  assert.equal(nextSignal?.aborted, false);
  firstOwner.abort();
  assert.equal(oldSignal?.aborted, true);
  finishOld?.(1);
  await rejected;
  assert.equal(nextSignal?.aborted, false);
  finishNext?.(2);
  assert.equal(await next, 2);
  const owner = new AbortController();
  let callerSignal: AbortSignal | undefined;
  let finishCaller: (() => void) | undefined;
  const cancelled = readWorkbenchQuery(
    "profiles",
    owner.signal,
    async (signal) => {
      callerSignal = signal;
      await new Promise<void>((resolve) => {
        finishCaller = resolve;
      });
      return 1;
    },
  );
  const cancellation = assert.rejects(cancelled, {
    message: "workbench_query_unavailable",
  });
  owner.abort();
  assert.equal(callerSignal?.aborted, true);
  finishCaller?.();
  await cancellation;
  let closingSignal: AbortSignal | undefined;
  let finishClosing: (() => void) | undefined;
  const closing = readWorkbenchQuery(
    "view",
    new AbortController().signal,
    async (signal) => {
      closingSignal = signal;
      await new Promise<void>((resolve) => {
        finishClosing = resolve;
      });
      return 3;
    },
  );
  const closed = assert.rejects(closing);
  clearWorkbenchQueries();
  assert.equal(closingSignal?.aborted, true);
  finishClosing?.();
  await closed;
});

/**
 * 非鍵POSTを一回送り、Form・応答をMutation記録へ保持しない。
 * @responsibility 失敗を再送せず、鍵専用操作をMutationへ入れない。
 * @trace ERB-IT-021
 * @precondition 合成fetch／locationと実Mutation Cache。
 * @stimulus 正常POST、通信故障、鍵専用Pathを与える。
 * @observation 送信回数、返却応答、Cache空、固定拒否。
 * @oracle 各許可操作一回・専用鍵経路0回・失敗後Cache0。
 * @cleanup fetch・location・prototypeと資格参照を復元する。
 */
test("Mutationは非鍵操作だけを一回送りCacheを回収する", async () => {
  const originalFetch = globalThis.fetch;
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  const original = QueryClient.prototype.getMutationCache;
  let cache: MutationCache | undefined;
  QueryClient.prototype.getMutationCache = function () {
    cache = original.call(this);
    return cache;
  };
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "http://127.0.0.1:12345" },
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 2) throw new Error("fixture-secret-never-output");
    return new Response("{}");
  };
  try {
    const response = await requestWorkbenchMutation("/workspace/action", {
      method: "POST",
      body: "operation=list",
    });
    assert.equal(await response.text(), "{}");
    assert.equal(cache?.getAll().length, 0);
    await assert.rejects(
      requestWorkbenchMutation("/workspace/action", { method: "POST" }),
      { message: "workbench_mutation_unavailable" },
    );
    await assert.rejects(
      requestWorkbenchMutation("/connection-credentials/action", {
        method: "POST",
      }),
      { message: "workbench_mutation_rejected" },
    );
    assert.equal(calls, 2);
    assert.equal(cache?.getAll().length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    QueryClient.prototype.getMutationCache = original;
    clearWorkbenchCredential();
    if (location) Object.defineProperty(globalThis, "location", location);
    else Reflect.deleteProperty(globalThis, "location");
  }
});
