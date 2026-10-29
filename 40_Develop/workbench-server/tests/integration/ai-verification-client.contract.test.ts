/**
 * 検証専用HTTP子の有限搬送・終了確認を検証する。
 * @packageDocumentation
 * @responsibility HTTP結果と子終了・Task終了を混同しない検証Tool境界。
 * @trace ERB-IT-021
 * @level IT
 * @scope 固定子の起動失敗、pipe、上限、終了値、期限、実loopback通信。
 * @boundary 有限Process代役と実HTTP子。Provider・Docker・Repository操作なし。
 */
import assert from "node:assert/strict";
import childProcess, { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createReadonlyVerificationTiming } from "../../scripts/ai-verification-timing.ts";
import { parseUnambiguousJsonDocument } from "../../../ai-adapter/src/index.ts";
import {
  projectVerificationTransportFailure,
  requestInChild,
} from "../../scripts/ai-verification-http.ts";

/**
 * 正式子へ不正IPC入力を一件送り、HTTP未発行・自然終了を確認する。
 * @trace ERB-IT-021
 * @stimulus 型不正、過大、多byte、曖昧JSON、余分field、非loopback。
 * @oracle 固定失敗frame／終了1、stderr零、IPC切断、受信HTTP零。
 * @cleanup 親の有限監視で子closeを確認する。
 */
test("IPC子は不正入力でもchannelを残さず終了する", async () => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.end("synthetic");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const input = {
      baseUrl: `http://127.0.0.1:${address.port}`,
      route: "/api/workbench-view?route=%2F",
      form: null,
    };
    for (const message of [
      true,
      {},
      "x".repeat(256 * 1024 + 1),
      "あ".repeat(90_000),
      '{"baseUrl":"a","baseUrl":"b"}',
      JSON.stringify({ ...input, secret: "synthetic-secret" }),
      JSON.stringify({ ...input, baseUrl: "https://example.invalid" }),
    ]) {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL("../../scripts/ai-verification-client.ts", import.meta.url),
          ),
        ],
        {
          env: {},
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe", "ipc"],
        },
      );
      assert.ok(child.stdout && child.stderr);
      let output = "";
      let stderr = 0;
      let disconnected = false;
      child.stdout.on("data", (chunk) => {
        output += chunk;
        assert.ok(Buffer.byteLength(output) < 4096);
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.length;
      });
      child.once("disconnect", () => {
        disconnected = true;
      });
      const completion = new Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      const timeout = setTimeout(() => child.kill(), 5000);
      try {
        child.send(message);
        const result = await completion;
        assert.equal(result.code, 1);
        assert.equal(result.signal, null);
        assert.equal(disconnected, true);
        assert.equal(stderr, 0);
        assert.equal(JSON.parse(output).failure, null);
        assert.equal(output.includes("synthetic-secret"), false);
      } finally {
        clearTimeout(timeout);
      }
    }
    assert.equal(requests, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

/**
 * 子は一件だけ消費し、切断・入力拒否・HTTP故障でもchannelを残さない。
 * @trace ERB-IT-021
 * @stimulus 二件通知、受領前disconnect、型不正、JSON拒否、HTTP例外。
 * @oracle HTTP最大一回、元の固定結果と終了値、message/disconnect listener零。
 * @cleanup VMのPromiseをjoinする。実Processなし。
 */
test("IPC子は二件目を実行せず拒否経路でも購読を解除する", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/ai-verification-client.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    `(async()=>{${source.slice(source.indexOf("let startedAt ="))}})()`,
  );
  for (const scenario of [
    "double",
    "disconnect",
    "invalid-type",
    "invalid-json",
    "http-failure",
  ]) {
    let requests = 0;
    let disconnects = 0;
    const output: string[] = [];
    const subscriptions = new Map<string, unknown>();
    let subscribed = 0;
    const fake = Object.assign(new EventEmitter(), {
      connected: true,
      send: () => true,
      stdout: { write: (text: string) => output.push(text) },
      exitCode: 0,
      disconnect: () => {},
    });
    fake.disconnect = () => {
      disconnects++;
      fake.connected = false;
      fake.emit("disconnect");
    };
    const execution = runInNewContext(body, {
      Buffer,
      Date,
      Error,
      URL,
      URLSearchParams,
      process: fake,
      parseUnambiguousJsonDocument,
      projectVerificationTransportFailure,
      subscribe: (name: string, callback: unknown) => {
        assert.ok(
          ["undici:request:create", "undici:client:sendHeaders"].includes(name),
        );
        assert.equal(subscriptions.has(name), false);
        subscriptions.set(name, callback);
        subscribed++;
      },
      unsubscribe: (name: string, callback: unknown) => {
        if (subscriptions.has(name))
          assert.equal(subscriptions.get(name), callback);
        subscriptions.delete(name);
      },
      requestBounded: async () => {
        requests++;
        if (scenario === "http-failure") throw Error("synthetic-secret");
        return { status: 200, location: null, body: "synthetic" };
      },
    });
    if (scenario === "disconnect") fake.disconnect();
    else {
      const message =
        scenario === "invalid-type"
          ? {}
          : scenario === "invalid-json"
            ? '{"route":"a","route":"b"}'
            : JSON.stringify({
                baseUrl: "http://127.0.0.1:12345",
                route: "/api/workbench-view?route=%2F",
                form: null,
              });
      fake.emit("message", message);
      if (scenario === "double") fake.emit("message", message);
    }
    await execution;
    assert.equal(
      requests,
      ["double", "http-failure"].includes(scenario) ? 1 : 0,
    );
    assert.equal(output.length, 1);
    assert.equal(output[0]?.includes("synthetic-secret"), false);
    assert.equal(fake.exitCode, scenario === "double" ? 0 : 1);
    assert.equal(fake.connected, false);
    assert.equal(disconnects, 1);
    assert.equal(fake.listenerCount("message"), 0);
    assert.equal(fake.listenerCount("disconnect"), 0);
    assert.equal(subscriptions.size, 0);
    assert.equal(
      subscribed,
      ["double", "http-failure"].includes(scenario) ? 2 : 0,
    );
  }
});

/**
 * Client送出後のServer event loop停止を、受信後の処理時間と区別する。
 * @trace ERB-IT-021
 * @boundary 合成loopback一要求。AI・Docker・Repository入力なし。
 * @cleanup Client実close、時計解除、Server socketとServer closeを確認する。
 */
test("HTTP送出時計はServer受信前のevent loop待ちを区別する", async () => {
  const server = createServer((_request, response) =>
    response.end("synthetic"),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const timing = createReadonlyVerificationTiming();
  timing.bind(base);
  try {
    const pending = requestInChild(
      base,
      "/api/workbench-view?route=%2F",
      undefined,
      timing.client,
    );
    // 独立Clientは進めたまま、Serverを所有するこのevent loopだけ有限停止する。
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    assert.equal((await pending).status, 200);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const result = timing.snapshot();
    const client = result.clients[0],
      received = result.servers[0];
    assert.ok(client && received && result.loopDelay);
    assert.ok(
      client.requestCreatedAt !== null && client.headersSendingAt !== null,
    );
    assert.ok(client.startedAt <= client.requestCreatedAt);
    assert.ok(client.requestCreatedAt <= client.headersSendingAt);
    assert.ok(client.headersSendingAt < received.receivedAt);
    assert.ok(received.receivedAt - client.headersSendingAt > 300);
    assert.ok(result.loopDelay.delayMs > 1000);
    assert.ok(
      client.headersAt !== null && client.headersAt - client.startedAt < 15_000,
    );
  } finally {
    timing.dispose();
    const closed = timing.snapshot();
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.deepEqual(timing.snapshot(), closed);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

/**
 * 親の同期占有中にも一件入力とHTTP・子終了が進むことを確認する。
 * @trace ERB-IT-021
 * @stimulus 正式send直後に親だけ22秒停止。独立Serverは即時応答する。
 * @oracle HTTP200／子close0、子内15秒以内、期限延長・再送なし。
 * @cleanup spawn差替えを復元し、独立Serverのcloseを有限確認する。
 */
test("IPC入力は親22秒停止中にも子のHTTP完了を妨げない", async () => {
  const original = childProcess.spawn;
  const server = original(
    process.execPath,
    [
      fileURLToPath(
        new URL("../fixtures/ai-verification-http-server.ts", import.meta.url),
      ),
    ],
    { env: {}, windowsHide: true, stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  assert.ok(server.stderr);
  let stderr = 0;
  server.stderr.on("data", (chunk) => {
    stderr += chunk.length;
  });
  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    server.once("error", reject);
    server.once("close", (code, signal) => resolve({ code, signal }));
  });
  const startup = setTimeout(() => server.kill(), 5000);
  try {
    const port = await Promise.race([
      new Promise<unknown>((resolve) => server.once("message", resolve)),
      closed.then(() => {
        throw Error("fixture_closed_before_listening");
      }),
    ]);
    clearTimeout(startup);
    assert.ok(typeof port === "number" && Number.isSafeInteger(port));
    let sends = 0;
    childProcess.spawn = ((...args: Parameters<typeof spawn>) => {
      const child = original(...args);
      const send = child.send.bind(child);
      child.send = ((...values: Parameters<typeof child.send>) => {
        const result = send(...values);
        sends++;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 22_000);
        return result;
      }) as typeof child.send;
      return child;
    }) as typeof spawn;
    syncBuiltinESMExports();
    const timings: { startedAt: number; completedAt: number }[] = [];
    const result = await requestInChild(
      `http://127.0.0.1:${port}`,
      "/api/workbench-view?route=%2F",
      undefined,
      (t) => timings.push(t),
    );
    assert.equal(result.status, 200);
    assert.equal(sends, 1);
    assert.ok(
      timings[0] && timings[0].completedAt - timings[0].startedAt < 15000,
    );
  } finally {
    clearTimeout(startup);
    childProcess.spawn = original;
    syncBuiltinESMExports();
    if (server.connected) server.send("close");
    const timeout = setTimeout(() => server.kill(), 2000);
    try {
      const result = await closed;
      assert.equal(result.code, 0);
      assert.equal(result.signal, null);
      assert.equal(stderr, 0);
    } finally {
      clearTimeout(timeout);
    }
  }
});

/**
 * 正式親処理を有限Processで駆動し、成功値と終了条件の反例を確認する。
 * @trace ERB-IT-021
 * @precondition 固定spawnとTimerだけ代役にし、正式の解析・診断を使用する。
 * @stimulus 正常、終了値不一致、重複key、過大出力、pipe故障、close欠測。
 * @observation 子への入力、kill回数、close待機、返却又は固定失敗。
 * @oracle closeなしの成功0、kill最大1、秘密本文・stderrの診断流出0。
 * @cleanup 全有限TimerとPromiseを完了し実Processを作らない。
 */
test("HTTP子は結果frameと実closeを共同確認し異常を有限分類する", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/ai-verification-http.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export async function requestInChild(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(
    source
      .slice(start, end)
      .replace("export async", "async")
      .replaceAll("import.meta.dirname", '"fixed-script-directory"'),
  );
  const scenarios = [
    "success",
    "spawn-throw",
    "spawn-error",
    "send-callback-error",
    "send-throw",
    "channel-missing",
    "channel-disconnected",
    "send-undelivered",
    "backpressure",
    "late-callback-error",
    "stdout-error",
    "stderr-error",
    "stdout-limit",
    "stderr-limit",
    "stderr-warning",
    "nonzero",
    "signal",
    "duplicate",
    "extra",
    "invalid",
    "failure-zero",
    "failure-two",
    "failure-body",
    "payload-no-close",
    "cleanup-unknown",
    "late-close",
    "late-close-unknown",
    "timing-missing",
    "timing-reversed",
    "dispatch-missing",
    "dispatch-reversed",
    "dispatch-outside",
    "response-before-send",
  ] as const;
  for (const { route, scenario } of [
    "/workspace/action",
    "/ai-request/action",
    "/api/workbench-view?route=%2F",
  ].flatMap((route) => scenarios.map((scenario) => ({ route, scenario })))) {
    const child = new EventEmitter() as EventEmitter & {
      send: (input: string, callback: (error: Error | null) => void) => boolean;
      connected: boolean;
      channel: object | null;
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => boolean;
    };
    child.connected = scenario !== "channel-disconnected";
    child.channel = scenario === "channel-missing" ? null : {};
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const timers = new Map<number, () => void>();
    const scheduledDeadlines: number[] = [];
    let kills = 0;
    let input = "";
    let spawned = 0;
    child.kill = () => {
      kills++;
      if (scenario === "late-close")
        queueMicrotask(() => child.emit("close", 0, null));
      else if (
        scenario !== "cleanup-unknown" &&
        scenario !== "late-close-unknown"
      )
        child.emit("close", null, "SIGTERM");
      return scenario !== "late-close" && scenario !== "late-close-unknown";
    };
    const failure = {
      reason: "workbench_verification_transport_failed",
      failureClass: "headers_unobserved",
      timedOut: true,
      transportCode: null,
    };
    const frame = {
      version: 1,
      status: 303 as number | null,
      location: "/#ai-request" as string | null,
      body: "" as string | null,
      failure: null as unknown,
      timing: {
        startedAt: 1,
        requestCreatedAt: 1,
        headersSendingAt: 1,
        headersAt: 2 as number | null,
        completedAt: 3,
      },
    };
    const invoke = runInNewContext(`${body}\nrequestInChild`, {
      URL,
      Buffer,
      Error,
      path,
      process: { execPath: "fixed-node" },
      CLIENT_PROCESS_TIMEOUT_MS: 20_000,
      CLIENT_PROCESS_CLOSE_TIMEOUT_MS: 2_000,
      CLIENT_OUTPUT_MAX_BYTES: 6 * 1024 * 1024 + 4096,
      parseUnambiguousJsonDocument,
      projectVerificationTransportFailure,
      setTimeout: (callback: () => void, ms: number) => {
        scheduledDeadlines.push(ms);
        timers.set(ms, () => {
          timers.delete(ms);
          callback();
        });
        return ms;
      },
      clearTimeout: (id: number) => timers.delete(id),
      spawn: (
        exe: string,
        args: string[],
        options: {
          env: object;
          shell: boolean;
          windowsHide: boolean;
          stdio: string[];
        },
      ) => {
        spawned++;
        assert.equal(exe, "fixed-node");
        assert.ok(args[0]);
        assert.equal(path.basename(args[0]), "ai-verification-client.ts");
        assert.equal(JSON.stringify(options.env), "{}");
        assert.equal(options.shell, false);
        assert.equal(options.windowsHide, true);
        assert.deepEqual(Array.from(options.stdio), [
          "ignore",
          "pipe",
          "pipe",
          "ipc",
        ]);
        if (scenario === "spawn-throw") throw Error("synthetic-secret");
        child.send = (value: string, callback) => {
          input = value;
          if (scenario === "send-throw") throw Error("synthetic-secret");
          queueMicrotask(() => {
            if (scenario === "late-callback-error") {
              child.stdout.emit("data", Buffer.from(JSON.stringify(frame)));
              child.emit("close", 0, null);
              callback(Error("synthetic-secret"));
              return;
            }
            if (scenario === "send-callback-error") {
              callback(Error("synthetic-secret"));
              return;
            }
            callback(null);
            if (scenario === "send-undelivered") {
              timers.get(route === "/workspace/action" ? 65_000 : 20_000)?.();
              return;
            }
            if (scenario === "spawn-error")
              child.emit("error", Error("synthetic-secret"));
            else if (scenario === "stdout-error")
              child.stdout.emit("error", Error("synthetic-secret"));
            else if (scenario === "stderr-error")
              child.stderr.emit("error", Error("synthetic-secret"));
            else if (scenario === "stdout-limit")
              child.stdout.emit("data", Buffer.alloc(6 * 1024 * 1024 + 4097));
            else if (scenario === "stderr-limit")
              child.stderr.emit("data", Buffer.alloc(4097));
            else if (scenario === "stderr-warning") {
              child.stderr.emit("data", Buffer.from("synthetic-secret"));
              child.stdout.emit("data", Buffer.from(JSON.stringify(frame)));
              child.emit("close", 0, null);
            } else {
              if (scenario.startsWith("failure-")) {
                frame.failure = failure;
                frame.status = null;
                frame.location = null;
                frame.body =
                  scenario === "failure-body" ? "synthetic-secret" : null;
                frame.timing.headersAt = null;
              }
              let output = JSON.stringify(frame);
              if (scenario === "duplicate")
                output = output.replace(
                  '"version":1',
                  '"version":1,"version":1',
                );
              if (scenario === "extra")
                output = output.replace(
                  '"version":1',
                  '"version":1,"extra":true',
                );
              if (scenario === "invalid") output = "synthetic-secret";
              if (scenario === "timing-missing")
                output = output.replace(',"completedAt":3', "");
              if (scenario === "timing-reversed")
                output = output.replace('"completedAt":3', '"completedAt":1');
              if (scenario === "dispatch-missing")
                output = output.replace(',"requestCreatedAt":1', "");
              if (scenario === "dispatch-reversed")
                output = output.replace(
                  '"requestCreatedAt":1',
                  '"requestCreatedAt":2',
                );
              if (scenario === "dispatch-outside")
                output = output.replace(
                  '"headersSendingAt":1',
                  '"headersSendingAt":4',
                );
              if (scenario === "response-before-send")
                output = output
                  .replace('"headersSendingAt":1', '"headersSendingAt":2')
                  .replace('"headersAt":2', '"headersAt":1');
              child.stdout.emit("data", Buffer.from(output));
              if (
                scenario === "payload-no-close" ||
                scenario === "cleanup-unknown" ||
                scenario === "late-close" ||
                scenario === "late-close-unknown"
              ) {
                const deadline = timers.get(
                  route === "/workspace/action" ? 65_000 : 20_000,
                );
                assert.ok(deadline);
                deadline();
                if (
                  scenario === "cleanup-unknown" ||
                  scenario === "late-close-unknown"
                ) {
                  const closeDeadline = timers.get(2_000);
                  assert.ok(closeDeadline);
                  closeDeadline();
                }
              } else
                child.emit(
                  "close",
                  scenario === "nonzero"
                    ? 1
                    : scenario === "failure-two" || scenario === "failure-body"
                      ? 2
                      : 0,
                  scenario === "signal" ? "SIGTERM" : null,
                );
            }
          });
          return scenario !== "backpressure";
        };
        return child;
      },
    }) as typeof requestInChild;
    const operation = invoke(
      "http://127.0.0.1:1234/",
      route,
      new URLSearchParams({ actionToken: "synthetic-token" }),
      () => {
        throw Error("clock-only");
      },
    );
    assert.equal(
      scheduledDeadlines.includes(
        route === "/workspace/action" ? 65_000 : 20_000,
      ),
      scenario !== "spawn-throw",
    );
    if (
      ["success", "late-close", "backpressure", "late-callback-error"].includes(
        scenario,
      )
    )
      assert.equal((await operation).status, 303);
    else
      await assert.rejects(operation, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          scenario === "failure-two"
            ? "workbench_verification_transport_failed"
            : scenario === "cleanup-unknown" ||
                scenario === "late-close-unknown"
              ? "workbench_verification_client_process_cleanup_unknown"
              : "workbench_verification_client_process_failed",
        );
        assert.equal(
          JSON.stringify(projectVerificationTransportFailure(error)).includes(
            "synthetic-secret",
          ),
          false,
        );
        const diagnostic = projectVerificationTransportFailure(error);
        if (scenario !== "failure-two") {
          assert.ok(diagnostic?.clientProcess, scenario);
          assert.equal(
            diagnostic.clientProcess.terminationRequested,
            kills > 0,
            scenario,
          );
        }
        if (scenario === "stderr-warning") {
          assert.equal(diagnostic?.clientProcess?.stage, "stderr");
          assert.equal(diagnostic?.clientProcess?.exitCode, 0);
          assert.equal(diagnostic?.clientProcess?.stderrBytes, 16);
          assert.equal(diagnostic?.clientProcess?.signal, null);
        }
        return true;
      });
    assert.equal(spawned, 1);
    assert.ok(kills <= 1);
    assert.equal(timers.size, 0, scenario);
    if (input)
      assert.equal(JSON.parse(input).form, "actionToken=synthetic-token");
  }
});

/**
 * 子の実HTTP期限と通信失敗を確認し、Serverを終了する。
 * @trace ERB-IT-021
 * @precondition localhostだけのServer。Task・Provider・認証情報はない。
 * @stimulus 正常応答、接続切断、15秒応答なし。
 * @observation 正式子close後の結果と有限Transport診断。
 * @oracle 期限値を変更せずtimedOutを保持し、本文を保存しない。
 * @cleanup 子を正式処理でjoin後にServer接続を閉じる。
 */
test("実HTTP子は通常・切断・15秒期限を区別して終了する", async () => {
  let mode = "normal";
  let requests = 0;
  let slowResponse: ReturnType<typeof setTimeout> | undefined;
  const server = createServer((_request, response) => {
    requests++;
    if (mode === "normal") response.end("synthetic");
    else if (mode === "disconnect") response.destroy();
    else if (mode === "workspace")
      slowResponse = setTimeout(
        () => response.end("workspace-synthetic"),
        16_000,
      );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/`;
    assert.equal(
      (await requestInChild(url, "/api/workbench-view?route=%2F")).body,
      "synthetic",
    );
    for (const next of ["disconnect", "timeout"]) {
      mode = next;
      await assert.rejects(
        requestInChild(url, "/api/workbench-view?route=%2F"),
        (error: unknown) => {
          const failure = projectVerificationTransportFailure(error);
          assert.equal(
            failure?.reason,
            "workbench_verification_transport_failed",
          );
          assert.equal(failure?.failureClass, "headers_unobserved");
          assert.equal(failure?.timedOut, next === "timeout");
          return true;
        },
      );
    }
    mode = "workspace";
    const timings: number[] = [];
    assert.equal(
      (
        await requestInChild(
          url,
          "/workspace/action",
          new URLSearchParams({ operation: "synthetic" }),
          (timing) => {
            timings.push(timing.completedAt - timing.startedAt);
          },
        )
      ).body,
      "workspace-synthetic",
    );
    assert.ok(
      timings[0] !== undefined && timings[0] >= 15_000 && timings[0] < 60_000,
    );
    assert.equal(requests, 4);
  } finally {
    if (slowResponse !== undefined) clearTimeout(slowResponse);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

/**
 * Process診断へ任意文字列や不正fieldを混入させない。
 * @trace ERB-IT-021
 * @responsibility 閉じた診断値だけを投影する。
 * @precondition 合成Errorのみ。
 * @stimulus 正常診断と未知段階・秘密Signal・余分field・不正数値。
 * @observation 投影結果。
 * @oracle 不正診断を省略し元の固定理由を保持する。
 * @cleanup 実資源なし。
 * @boundary Error causeから安全な結果。
 */
test("HTTP子の診断は閉形式だけを搬送する", () => {
  const valid = {
    stage: "stderr",
    exitCode: 0,
    signal: null,
    stderrBytes: 4,
    terminationRequested: false,
  };
  for (const record of [
    valid,
    { ...valid, stage: "synthetic-secret" },
    { ...valid, signal: "synthetic-secret" },
    { ...valid, extra: "synthetic-secret" },
    { ...valid, stderrBytes: -1 },
    { ...valid, exitCode: "0" },
    { ...valid, terminationRequested: "false" },
  ]) {
    const result = projectVerificationTransportFailure(
      new Error("workbench_verification_client_process_failed", {
        cause: { clientProcess: record },
      }),
    );
    assert.equal(
      result?.reason,
      "workbench_verification_client_process_failed",
    );
    assert.equal(result?.clientProcess !== undefined, record === valid);
    assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
  }
});

/**
 * HTTP子の故障後も同じ受付IDと回復参照を保存する。
 * @trace ERB-IT-021
 * @precondition 正式Client本文に有限HTTP・Read Modelを注入する。
 * @stimulus POST後の異常終了、HTTP期限、子終了未確認。
 * @observation POST数、GET数、同IDの結果・回復参照、close拒否。
 * @oracle 再送0、終了未確認では新要求0、Taskを成功へ丸めない。
 * @cleanup 全Promiseをjoinする。実Process・Taskは作らない。
 */
test("HTTP子の故障は同ID観測を保持し終了未確認だけをstickyにする", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/ai-verification-http.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export async function createWorkbenchAiVerificationHttpClient(",
  );
  const body = stripTypeScriptTypes(
    source.slice(start).replace("export async", "async"),
  );
  for (const scenario of [
    "process-failed",
    "http-timeout",
    "cleanup-unknown",
  ] as const) {
    let posts = 0;
    let reads = 0;
    let snapshot: null | {
      requestId: string;
      mode: string;
      executionSelection: null;
      status: string;
      primaryFailure: string;
      recoveryIds: string[];
      cleanupConfirmed: boolean;
    } = null;
    const createClient = runInNewContext(
      `${body}\ncreateWorkbenchAiVerificationHttpClient`,
      {
        URL,
        URLSearchParams,
        Error,
        assert,
        readMain: async () => {
          reads++;
          return { actionToken: "synthetic", aiRequest: { snapshot } };
        },
        requestInChild: async () => {
          posts++;
          snapshot = {
            requestId: "request-synthetic",
            mode: "read_only_advice",
            executionSelection: null,
            status: "unknown",
            primaryFailure: "primary-synthetic",
            recoveryIds: ["recovery-synthetic"],
            cleanupConfirmed: false,
          };
          throw new Error(
            scenario === "cleanup-unknown"
              ? "workbench_verification_client_process_cleanup_unknown"
              : scenario === "process-failed"
                ? "workbench_verification_client_process_failed"
                : "workbench_verification_transport_failed",
            {
              cause: {
                failureClass: "headers_unobserved",
                timedOut: scenario === "http-timeout",
                transportCode: null,
              },
            },
          );
        },
      },
    ) as typeof import("../../scripts/ai-verification-http.ts").createWorkbenchAiVerificationHttpClient;
    const client = await createClient("http://127.0.0.1:1234/");
    const close = client.close;
    assert.ok(close);
    let id: string | null = null;
    await assert.rejects(
      client.start({
        mode: "read_only_advice",
        workType: null,
        workspaceId: null,
        choice: { provider: "codex", model: "synthetic", effort: "medium" },
        prompt: "synthetic",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: [],
        expectedNetworkPolicyHash: "a".repeat(64),
        externalSendConfirmed: true,
      }),
      (error: unknown) => {
        assert.ok(
          error instanceof Error &&
            error.cause &&
            typeof error.cause === "object" &&
            "requestId" in error.cause,
        );
        id = error.cause.requestId as string | null;
        assert.equal(error.message, "workbench_ai_http_start_outcome_unknown");
        return true;
      },
    );
    assert.equal(posts, 1);
    if (scenario === "cleanup-unknown") {
      assert.equal(id, null);
      assert.equal(reads, 2);
      await assert.rejects(
        client.observe("request-synthetic"),
        /request_unknown/,
      );
      await assert.rejects(close(), /client_process_cleanup_unknown/);
      assert.equal(reads, 2);
    } else {
      assert.equal(id, "request-synthetic");
      assert.ok(id);
      const observed = await client.observe(id);
      assert.equal(observed.status, "unknown");
      assert.equal(observed.primaryFailure, "primary-synthetic");
      assert.deepEqual(observed.recoveryIds, ["recovery-synthetic"]);
      assert.equal(observed.cleanupConfirmed, false);
      await close();
      await assert.rejects(client.observe(id), /client_closed/);
    }
    assert.equal(posts, 1);
  }
});
