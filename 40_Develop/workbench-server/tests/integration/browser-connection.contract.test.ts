/**
 * Browser接続の要求・応答世代を有限のTransport fixtureで検証する。
 * @packageDocumentation
 * @responsibility 同Origin搬送、非永続資格、切替後の遅延応答拒否と本文上限を反証する。
 * @trace EST-IT-002
 * @level IT
 * @scope Browser connection module→合成fetch／stream→Caller。
 * @boundary 実Browser・実HTTP・現在Role認可の代替ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  setWorkbenchCredential,
  clearWorkbenchCredential,
  requestWorkbench,
} from "../../src/client/api/connection.ts";

/**
 * 接続資格の搬送と切替前後の応答非混同を検証する。
 * @responsibility Browser storageを使わず、合成streamと要求Headerで反証する。
 * @trace EST-IT-002
 * @precondition Node内の自己所有fetch／location fixtureだけを使用する。
 * @stimulus 未接続・接続・切断・鍵変更・不正Origin／Header・過大本文を与える。
 * @observation 送信回数、Header、redirect構成、Reader取消／解放、固定失敗。
 * @oracle 別Origin送信0、再送0、旧応答0、容量超過時Reader取消・解放。
 * @cleanup 元fetchとlocation descriptorを復元し、資格memoryを解放する。
 * @boundary 合成Transportの局所確認。Browser DOM／実API成立は別検証。
 */
test("Browser接続は同Originと要求世代を守り資格を応答へ含めない", async () => {
  const originalFetch = globalThis.fetch;
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "http://127.0.0.1:12345" },
  });
  let calls = 0;
  let observed: RequestInit | undefined;
  globalThis.fetch = async (_, options) => {
    calls += 1;
    observed = options;
    return new Response('{"status":"completed"}', {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    clearWorkbenchCredential();
    const without = await requestWorkbench("/api/workbench-view");
    assert.equal(new Headers(observed?.headers).has("authorization"), false);
    assert.equal((await without.json()).status, "completed");
    setWorkbenchCredential("fixture-first-key");
    const withKey = await requestWorkbench("/api/workbench-view");
    assert.equal(
      new Headers(observed?.headers).get("authorization"),
      "Bearer fixture-first-key",
    );
    assert.equal(observed?.redirect, "manual");
    assert.equal(observed?.credentials, "omit");
    assert.equal(observed?.mode, "same-origin");
    assert.equal(observed?.cache, "no-store");
    assert.equal((await withKey.text()).includes("fixture-first-key"), false);
    const beforeRejected = calls;
    await assert.rejects(
      requestWorkbench("https://example.invalid/api/workbench-view"),
      { message: "workbench_request_rejected" },
    );
    await assert.rejects(
      requestWorkbench("/api/workbench-view", {
        headers: { authorization: "Bearer other" },
      }),
      { message: "workbench_request_rejected" },
    );
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      requestWorkbench("/api/workbench-view", { signal: cancelled.signal }),
      { message: "workbench_request_rejected" },
    );
    assert.equal(calls, beforeRejected);
    assert.throws(() => setWorkbenchCredential(""), {
      message: "workbench_credential_input_invalid",
    });
    assert.throws(() => setWorkbenchCredential("with whitespace"), {
      message: "workbench_credential_input_invalid",
    });
    assert.throws(() => setWorkbenchCredential("x".repeat(4097)), {
      message: "workbench_credential_input_invalid",
    });
    let release: ((value: Response) => void) | undefined;
    globalThis.fetch = async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    const late = requestWorkbench("/api/workbench-view");
    assert.ok(release);
    setWorkbenchCredential("fixture-second-key");
    release(new Response("old user result"));
    await assert.rejects(late, { message: "workbench_response_unavailable" });
    let cancelledReader = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16777217));
      },
      cancel() {
        cancelledReader = true;
      },
    });
    globalThis.fetch = async () => new Response(stream);
    await assert.rejects(requestWorkbench("/api/workbench-view"), {
      message: "workbench_response_unavailable",
    });
    assert.equal(cancelledReader, true);
    assert.equal(stream.locked, false);
    clearWorkbenchCredential();
    globalThis.fetch = async (_, options) => {
      observed = options;
      return new Response(null, { status: 204 });
    };
    assert.equal((await requestWorkbench("/api/workbench-view")).status, 204);
    assert.equal(new Headers(observed?.headers).has("authorization"), false);
  } finally {
    clearWorkbenchCredential();
    globalThis.fetch = originalFetch;
    if (location) Object.defineProperty(globalThis, "location", location);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

/**
 * 送信開始後の取消を同じSignalとReader終端まで確認する。
 * @responsibility native相当のAbortErrorを固定取消結果へ写し、再送とReader残存を拒否する。
 * @trace EST-IT-002
 * @precondition 自己所有のfetchと応答streamだけを差し替える。
 * @stimulus fetch待機中または本文read待機中にSignalをabortする。
 * @observation 同一Signal、要求数、固定失敗、Reader lockと元fixture復元。
 * @oracle 開始後取消は固定失敗、fetchは各一回、Readerは解放、非取消失敗は保存する。
 * @cleanup fetch／locationを復元し、資格memoryを解放する。
 * @boundary 合成Transportの取消だけ。外部Effect rollbackを主張しない。
 */
test("Browser要求の開始後取消は再送せず応答Readerを解放する", async () => {
  const originalFetch = globalThis.fetch;
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "http://127.0.0.1:12345" },
  });
  try {
    clearWorkbenchCredential();
    const cancellation = new AbortController();
    let calls = 0;
    let observedSignal: AbortSignal | null | undefined;
    let readStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        cancellation.signal.addEventListener(
          "abort",
          () => {
            controller.error(new DOMException("fixture abort", "AbortError"));
          },
          { once: true },
        );
      },
      pull() {
        readStarted?.();
      },
    });
    globalThis.fetch = async (_, options) => {
      calls += 1;
      observedSignal = options?.signal;
      return new Response(stream);
    };
    const reading = requestWorkbench("/api/workbench-view", {
      signal: cancellation.signal,
    });
    await started;
    assert.equal(observedSignal, cancellation.signal);
    cancellation.abort();
    await assert.rejects(reading, {
      message: "workbench_response_unavailable",
    });
    assert.equal(calls, 1);
    assert.equal(stream.locked, false);

    const waitingCancellation = new AbortController();
    globalThis.fetch = (_, options) => {
      calls += 1;
      assert.equal(options?.signal, waitingCancellation.signal);
      return new Promise<Response>((_, reject) => {
        waitingCancellation.signal.addEventListener(
          "abort",
          () => {
            reject(new DOMException("fixture abort", "AbortError"));
          },
          { once: true },
        );
      });
    };
    const waiting = requestWorkbench("/api/workbench-view", {
      signal: waitingCancellation.signal,
    });
    waitingCancellation.abort();
    await assert.rejects(waiting, {
      message: "workbench_response_unavailable",
    });
    assert.equal(calls, 2);

    const networkFailure = new Error("fixture network failure");
    globalThis.fetch = async () => {
      calls += 1;
      throw networkFailure;
    };
    await assert.rejects(
      requestWorkbench("/api/workbench-view"),
      (error) => error === networkFailure,
    );
    assert.equal(calls, 3);
  } finally {
    clearWorkbenchCredential();
    globalThis.fetch = originalFetch;
    if (location) Object.defineProperty(globalThis, "location", location);
    else Reflect.deleteProperty(globalThis, "location");
  }
});
