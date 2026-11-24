/**
 * 公開HTTPを使う検証クライアントの失敗を反証する。
 * @packageDocumentation
 * @responsibility 受付後故障、同一要求の観測・取消、終了確認を保つ。
 * @trace ERB-IT-021
 * @level IT
 * @boundary localhost HTTPと偽Application。実AI・Dockerは使わない。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { executionSelection } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import {
  type AiRequestCommand,
  type AiRequests,
  startWorkbench,
} from "../../src/app.ts";
import { requestRaw } from "../support/workbench-http.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  createWorkbenchAiVerificationHttpClient,
  readMain,
} from "../support/workbench-ai-client.ts";
import { assertViewResponse } from "../support/workbench-wire.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 公開HTTPの受付後故障と受信期限を有限な反証集合で検証する。
 *
 * @responsibility POST再送0、受付不明と再観測ID、所有HTTP接続の終了を判定する。
 * @trace ERB-IT-021
 * @precondition 実Workbenchから得た公開モデルを故障注入Serverの応答形式に使う。
 * @stimulus 受付後切断、不正redirect、不正モデル、400、上限超過と期限超過を注入する。
 * @observation POST件数、Errorの固定診断、再観測ID、取消と終了時間を読む。
 * @oracle 受付済みを未実行と断定せず、再送せず、観測可能な同じIDへ戻る。
 * @cleanup 所有HTTP ServerとConnectionをfinallyで終了する。
 * @boundary ERB-IT-021=検証HTTP接続部→故障注入HTTP Server。実Provider回収の証明ではない。
 */
test("実Provider検証HTTPの受付後故障は再送せず不明結果と同じIDを保持する", async (context) => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  let initial: Extract<ReturnType<typeof assertViewResponse>, { view: "main" }>;
  try {
    const response = await requestRaw(
      handle.baseUrl,
      "/api/workbench/view?route=%2F",
    );
    assert.equal(response.status, 200);
    const view = assertViewResponse(JSON.parse(response.body.toString("utf8")));
    assert.ok(view.view === "main");
    initial = view;
  } finally {
    await handle.close();
  }
  for (const fault of [
    "cut",
    "location",
    "model-invalid",
    "model-unavailable",
    "internal-400",
    "body-limit",
    "body-incomplete",
    "header-timeout",
    "body-disconnect",
  ] as const) {
    await context.test(fault, async () => {
      let starts = 0;
      let cancels = 0;
      let afterStartReads = 0;
      let cancelled = false;
      const server = createServer((request, response) => {
        if (request.method === "GET") {
          if (starts > 0) afterStartReads += 1;
          if (starts > 0 && fault === "model-unavailable") {
            response.writeHead(503).end();
            return;
          }
          if (
            starts > 0 &&
            afterStartReads === 1 &&
            fault === "model-invalid"
          ) {
            response.writeHead(200).end("{}");
            return;
          }
          const model = {
            ...initial,
            aiRequest: {
              ...initial.aiRequest,
              snapshot:
                starts > 0
                  ? {
                      resultAvailable: false,
                      requestId: "AIREQ-FAULT-001",
                      mode: "read_only_advice",
                      executionSelection: executionSelection("advice"),
                      status: cancelled ? "cancelled" : "running",
                      reason: null,
                      facts: [],
                      sharedAnalysis: [],
                      additionalInferences: [],
                      nextOptions: [],
                      candidate: null,
                    }
                  : null,
            },
          };
          response
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify(model));
          return;
        }
        let body = "";
        request.on("data", (chunk: Buffer) => {
          body += chunk.toString("utf8");
        });
        request.once("end", () => {
          const form = new URLSearchParams(body);
          assert.equal(form.get("actionToken"), initial.actionToken);
          assert.equal(form.get("requestId"), "AIREQ-FAULT-001");
          if (form.get("operation") === "cancel") {
            cancels += 1;
            cancelled = true;
            response.writeHead(303, { Location: "/#ai-request" }).end();
            return;
          }
          starts += 1;
          if (fault === "cut") {
            response.destroy();
            return;
          }
          if (fault === "internal-400") {
            response.writeHead(400).end();
            return;
          }
          if (fault === "header-timeout") return;
          response.writeHead(303, {
            Location: fault === "location" ? "/unexpected" : "/#ai-request",
          });
          if (fault === "body-limit") {
            response.end(Buffer.alloc(1024 * 1024 + 1, 65));
            return;
          }
          if (fault === "body-incomplete") {
            response.write("partial");
            return;
          }
          if (fault === "body-disconnect") {
            response.write("partial");
            setImmediate(() => response.destroy());
            return;
          }
          response.end();
        });
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      assert.ok(address !== null && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      try {
        const application =
          await createWorkbenchAiVerificationHttpClient(baseUrl);
        const begunAt = Date.now();
        let diagnostic: unknown;
        try {
          await application.start({
            requestId: "AIREQ-FAULT-001",
            mode: "read_only_advice",
            workType: null,
            prompt: "固定故障検証",
            contextReferences: ["PROJECT_CONTEXT.md"],
            allowedPaths: [],
            workspaceId: null,
          });
          assert.fail("受付故障を成功へ畳んだ");
        } catch (error) {
          assert.ok(error instanceof Error);
          assert.equal(
            error.message,
            "workbench_ai_http_start_outcome_unknown",
          );
          diagnostic = error.cause;
        }
        assert.ok(
          Date.now() - begunAt < 19_000,
          "HTTP期限と清掃待機が有限である",
        );
        assert.equal(starts, 1);
        assert.ok(
          diagnostic !== null &&
            typeof diagnostic === "object" &&
            "requestId" in diagnostic,
        );
        if (
          [
            "body-limit",
            "body-incomplete",
            "body-disconnect",
            "header-timeout",
          ].includes(fault)
        ) {
          assert.ok("transportCause" in diagnostic);
          const cause = diagnostic.transportCause;
          assert.ok(
            cause !== null &&
              typeof cause === "object" &&
              "failureClass" in cause,
          );
          assert.equal(
            cause.failureClass,
            fault === "body-limit"
              ? "body_limit"
              : fault === "header-timeout"
                ? "headers_unobserved"
                : "read_failed",
          );
          if (fault === "header-timeout") {
            assert.ok("timedOut" in cause);
            assert.equal(cause.timedOut, true);
          }
        }
        assert.equal(
          diagnostic.requestId,
          fault === "model-unavailable" ? null : "AIREQ-FAULT-001",
        );
        if (fault !== "model-unavailable") {
          const result = await application.cancel("AIREQ-FAULT-001");
          assert.equal(result.status, "cancelled");
          assert.equal(cancels, 1);
        } else assert.equal(cancels, 0);
        assert.equal(starts, 1);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      await assert.rejects(requestRaw(baseUrl, "/"));
    });
  }
});

/**
 * 実Provider検証用接続部が公開HTTP受付を迂回しないことを確認する。
 *
 * @responsibility 同意、Token、同じ依頼Identity、取消とListener終了を直接境界で判定する。
 * @trace ERB-IT-021
 * @precondition 実Workbenchへ偽AI Applicationだけを注入する。
 * @stimulus 確認なし、不正Token、別ID取消と正常start／observe／cancelを要求する。
 * @observation Application呼出し件数、公開snapshotと終了後接続を読む。
 * @oracle 拒否入力は呼出し0、正常操作は同じIDと意味区分を保持する。
 * @cleanup finallyで所有Listenerを閉じる。実ProviderとDocker資源は作らない。
 * @boundary ERB-IT-021=検証接続部→HTTP Form／Read Model→偽Application。
 */
test("実Provider検証のHTTP接続部は認可済み依頼Identityを公開境界で照合する", async () => {
  let starts = 0;
  let cancels = 0;
  let received: AiRequestCommand | null = null;
  let status: "running" | "cancelled" = "running";
  const application: AiRequests = {
    start: async (request) => {
      starts += 1;
      received = request;
      return { status: "accepted", requestId: "AIREQ-HTTP-001", reason: null };
    },
    observe: async (requestId) => ({
      resultAvailable: false,
      requestId,
      mode: requestId === "AIREQ-HTTP-001" ? "read_only_advice" : null,
      executionSelection:
        requestId === "AIREQ-HTTP-001" ? executionSelection("advice") : null,
      status: requestId === "AIREQ-HTTP-001" ? status : "unknown",
      reason:
        requestId === "AIREQ-HTTP-001"
          ? null
          : "coordinator_task_not_available",
      facts:
        requestId === "AIREQ-HTTP-001"
          ? [{ text: "公開結果", references: ["PROJECT_CONTEXT.md"] }]
          : [],
      sharedAnalysis: [],
      additionalInferences: [],
      nextOptions: [],
      candidate: null,
    }),
    cancel: async (requestId) => {
      cancels += 1;
      status = "cancelled";
      return application.observe(requestId);
    },
  };
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    aiRequests: application,
  });
  try {
    const transport = await createWorkbenchAiVerificationHttpClient(
      handle.baseUrl,
    );
    const command: AiRequestCommand = {
      requestId: "AIREQ-HTTP-001",
      mode: "read_only_advice",
      workType: null,
      prompt: "固定検証依頼",
      contextReferences: ["PROJECT_CONTEXT.md"],
      allowedPaths: [],
      workspaceId: null,
    };
    const initial = await readMain(handle.baseUrl);
    const wrongToken = await requestRaw(
      handle.baseUrl,
      "/api/ai-request",
      "POST",
      new URLSearchParams({
        actionToken: "wrong",
        operation: "start",
        mode: command.mode,
        workType: command.workType ?? "",
        prompt: command.prompt,
      }).toString(),
    );
    assert.equal(wrongToken.status, 400);
    assert.equal(starts, 0);
    const accepted = await transport.start({
      ...command,
      workspaceId: null,
    });
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.requestId, "AIREQ-HTTP-001");
    assert.equal(starts, 1);
    assert.deepEqual(received, command);
    const observed = await transport.observe("AIREQ-HTTP-001");
    assert.equal(observed.status, "running");
    assert.equal(observed.facts[0]?.text, "公開結果");
    const wrongId = await requestRaw(
      handle.baseUrl,
      "/api/ai-request",
      "POST",
      new URLSearchParams({
        actionToken: initial.actionToken,
        operation: "cancel",
        requestId: "AIREQ-OTHER",
      }).toString(),
    );
    assert.equal(wrongId.status, 400);
    assert.equal(cancels, 0);
    await assert.rejects(
      transport.cancel("AIREQ-OTHER"),
      /workbench_verification_request_unknown/u,
    );
    assert.equal(cancels, 0);
    const cancelled = await transport.cancel("AIREQ-HTTP-001");
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.requestId, accepted.requestId);
    assert.equal(cancels, 1);
  } finally {
    await handle.close();
  }
  await assert.rejects(
    requestRaw(handle.baseUrl, "/.well-known/crdd-workbench-health"),
  );
});
