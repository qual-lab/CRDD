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
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parseUnambiguousJsonDocument } from "../../../ai-adapter/src/index.ts";
import {
  requestInChild,
  projectVerificationTransportFailure,
} from "../../scripts/ai-verification-http.ts";

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
  for (const scenario of [
    "success",
    "spawn-throw",
    "spawn-error",
    "stdin-error",
    "stdin-throw",
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
  ] as const) {
    const child = new EventEmitter() as EventEmitter & {
      stdin: EventEmitter & { end: (input: string) => void };
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => boolean;
    };
    child.stdin = Object.assign(new EventEmitter(), {
      end: (_input: string) => {},
    });
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const timers = new Map<number, () => void>();
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
      timing: { startedAt: 1, headersAt: 2 as number | null, completedAt: 3 },
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
        options: { env: object; shell: boolean; windowsHide: boolean },
      ) => {
        spawned++;
        assert.equal(exe, "fixed-node");
        assert.ok(args[0]);
        assert.equal(path.basename(args[0]), "ai-verification-client.ts");
        assert.equal(JSON.stringify(options.env), "{}");
        assert.equal(options.shell, false);
        assert.equal(options.windowsHide, true);
        if (scenario === "spawn-throw") throw Error("synthetic-secret");
        child.stdin.end = (value: string) => {
          input = value;
          if (scenario === "stdin-throw") throw Error("synthetic-secret");
          queueMicrotask(() => {
            if (scenario === "spawn-error")
              child.emit("error", Error("synthetic-secret"));
            else if (scenario === "stdin-error")
              child.stdin.emit("error", Error("synthetic-secret"));
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
              child.stdout.emit("data", Buffer.from(output));
              if (
                scenario === "payload-no-close" ||
                scenario === "cleanup-unknown" ||
                scenario === "late-close" ||
                scenario === "late-close-unknown"
              ) {
                const deadline = timers.get(20_000);
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
        };
        return child;
      },
    }) as typeof requestInChild;
    const operation = invoke(
      "http://127.0.0.1:1234/",
      "/ai-request/action",
      new URLSearchParams({ actionToken: "synthetic-token" }),
      () => {
        throw Error("clock-only");
      },
    );
    if (scenario === "success" || scenario === "late-close")
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
  const server = createServer((_request, response) => {
    requests++;
    if (mode === "normal") response.end("synthetic");
    else if (mode === "disconnect") response.destroy();
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
    assert.equal(requests, 3);
  } finally {
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
