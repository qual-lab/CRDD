/**
 * MCP Runtime活動Adapterの開始済みReader終了を検証する。
 * @packageDocumentation
 * @responsibility 取消要求と非取消Readerの終了を分け、開始済みReaderをjoinする。
 * @trace EST-IT-014
 * @level IT
 * @scope 開始前取消、開始後取消、Reader完了と応答保留。
 * @boundary MCP Routing→活動Reader。旧CROS資格・Gatewayは使わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  routeMcpRequest,
  MCP_RUNTIME_ACTIVITY_TOOL,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
} from "../../src/index.ts";

/**
 * Runtime活動の読取り中取消をjoin後に返すことを検証する。
 *
 * @responsibility 取消応答と読取り完了を混同しないProtocol境界を確認する。
 * @trace EST-IT-014
 * @precondition 解放まで保留するReaderとAbortControllerを用意する。
 * @stimulus Tool開始後に取消し、その後Readerを解放する。
 * @observation 応答保留、Reader完了と取消結果を確認する。
 * @oracle Reader完了前に結果を返さず、完了後-32800を返す。
 * @cleanup 保留gateをfinallyで解放し、開始済みPromiseをjoinする。
 * @boundary MCP Adapterと非取消Readerの境界。
 */
test("Runtime活動MCPは開始済みReaderをjoinしてから取消を返す", async () => {
  const controller = new AbortController();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let readStarted = false;
  let readCompleted = false;
  let responseSettled = false;
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: MCP_RUNTIME_ACTIVITY_TOOL,
      arguments: { projectId: "PRJ-MCP" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  let cancelledReadCount = 0;
  const refused = await routeMcpRequest(
    request,
    {
      projectContext: {
        readPortfolio: async () => ({
          projects: [],
          retainedAsSourceOfTruth: false,
        }),
      },
      runtimeActivity: {
        read: async () => {
          cancelledReadCount += 1;
          return null;
        },
      },
    },
    alreadyCancelled.signal,
  );
  assert.ok("error" in refused);
  assert.equal(refused.error.code, -32800);
  assert.equal(cancelledReadCount, 0);
  const pending = routeMcpRequest(
    request,
    {
      projectContext: {
        readPortfolio: async () => ({
          projects: [],
          retainedAsSourceOfTruth: false,
        }),
      },
      runtimeActivity: {
        read: async () => {
          readStarted = true;
          await gate;
          readCompleted = true;
          return null;
        },
      },
    },
    controller.signal,
  );
  void pending.then(() => {
    responseSettled = true;
  });
  try {
    assert.equal(readStarted, true);
    controller.abort();
    await Promise.resolve();
    assert.equal(responseSettled, false);
    assert.equal(readCompleted, false);
    release();
    const reply = await pending;
    assert.equal(readCompleted, true);
    assert.ok("error" in reply);
    assert.equal(reply.error.code, -32800);
  } finally {
    release();
    await pending;
  }
});
