/**
 * HTTP故障後の同一IDと終了未確認時の再送禁止を反証する。
 * @packageDocumentation
 * @responsibility HTTP故障後の同一IDと終了未確認時の再送禁止を反証する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary Workbench HTTPとBrowser契約の検証接続。製品入口には接続しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { readVerificationView } from "../support/workbench-ai-client.ts";

/** 不明な状態やTokenを受付・取消の材料にしない。 @trace ERB-IT-021 */
test("検証クライアントは不正な操作TokenとAI応答を拒否する", () => {
  const snapshot = {
    requestId: "request-synthetic",
    mode: "read_only_advice",
    executionSelection: {
      provider: "codex",
      workType: null,
      modelIdentifier: "fixture",
      reasoningEffort: "medium",
    },
    status: "unknown",
    reason: null,
    resultAvailable: false,
    candidate: null,
    facts: [],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
    cleanupConfirmed: false,
    recoveryIds: ["fixture-recovery"],
  };
  const view = {
    contract: "crdd/workbench/view/v1",
    view: "main",
    actionToken: "a".repeat(43),
    aiRequest: {
      configured: true,
      notice: null,
      additionalHosts: null,
      snapshot,
    },
  };
  assert.equal(readVerificationView(view).aiRequest.snapshot, snapshot);
  for (const body of [
    { ...view, actionToken: "short" },
    { ...view, view: "access" },
    { ...view, aiRequest: {} },
    { ...view, aiRequest: { ...view.aiRequest, configured: "true" } },
    { ...view, aiRequest: { ...view.aiRequest, notice: [] } },
    { ...view, aiRequest: { ...view.aiRequest, additionalHosts: [1] } },
    ...[
      { status: "unrecognized" },
      { requestId: "" },
      { cleanupConfirmed: "false" },
      { recoveryIds: [1] },
      { candidate: {} },
      { executionSelection: { ...snapshot.executionSelection, workType: [] } },
    ].map((fault) => ({
      ...view,
      aiRequest: { ...view.aiRequest, snapshot: { ...snapshot, ...fault } },
    })),
  ])
    assert.throws(
      () => readVerificationView(body),
      /workbench_verification_model_invalid/u,
    );
});

/**
 * HTTP子の故障後も同じ受付IDと回復参照を保存する。
 * @trace ERB-IT-021
 * @precondition 正式Client本文に有限HTTP・Read Modelを注入する。
 * @stimulus POST後の異常終了、HTTP期限、子終了未確認。
 * @observation POST数、GET数、同IDの結果・回復参照、close拒否。
 * @oracle 再送0、終了未確認では新要求0、Taskを成功へ丸めない。
 * @cleanup 全Promiseをjoinする。実Process・Taskは作らない。
 * @responsibility HTTP子の故障は同ID観測を保持し終了未確認だけをstickyにする
 * @boundary 有限Process代役と実HTTP子。Provider・Docker・Repository操作なし。
 */
test("HTTP子の故障は同ID観測を保持し終了未確認だけをstickyにする", async () => {
  const source = fs.readFileSync(
    new URL("../support/workbench-ai-client.ts", import.meta.url),
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
    ) as typeof import("../support/workbench-ai-client.ts").createWorkbenchAiVerificationHttpClient;
    const client = await createClient("http://127.0.0.1:1234/");
    const close = client.close;
    assert.ok(close);
    let id: string | null = null;
    await assert.rejects(
      client.start({
        requestId: "request-synthetic",
        mode: "read_only_advice",
        workType: null,
        workspaceId: null,
        choice: { provider: "codex", model: "synthetic", effort: "medium" },
        prompt: "synthetic",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: [],
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
      assert.equal(reads, 1);
      await assert.rejects(
        client.observe("request-synthetic"),
        /request_unknown/,
      );
      await assert.rejects(close(), /client_process_cleanup_unknown/);
      assert.equal(reads, 1);
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
