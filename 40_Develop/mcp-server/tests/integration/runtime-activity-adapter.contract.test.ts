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
import { invokeMcpRequest } from "../fixtures/sdk-request.ts";
import test from "node:test";
import {
  getMcpExecutionStatusToolDefinitions,
  MCP_EXECUTION_STATUS_TOOL,
  MCP_COORDINATOR_PROTOCOL_VERSION,
} from "../../src/index.ts";

/**
 * 実行状況Toolの現行名だけを公開・受付することを検証する。
 * @responsibility 通信名の変更と旧名でのReader非実行を確認する。
 * @trace EST-IT-014
 * @precondition 認可済み読取り依存と有効なMCP metadataを用意する。
 * @stimulus 一覧を取得し、旧名と新名で同じ引数を送る。
 * @observation 公開名、旧名拒否、Reader呼出し数と新名の結果を観測する。
 * @oracle 新名だけを公開し、旧名は-32601かつReader零回、新名は一回呼ぶ。
 * @cleanup N/A: 永続状態・外部資源を生成しない。
 * @boundary MCP公開名とCoordinator Readerの境界。
 */
test("実行状況MCPは新Tool名だけを公開・受付する", async () => {
  assert.equal(MCP_EXECUTION_STATUS_TOOL, "crdd.get_execution_status");
  assert.deepEqual(
    getMcpExecutionStatusToolDefinitions().map((tool) => tool.name),
    ["crdd.get_execution_status"],
  );
  let reads = 0;
  const dependencies = {
    projectContext: {
      readPortfolio: async () => ({
        projects: [],
        retainedAsSourceOfTruth: false as const,
      }),
    },
    runtimeActivity: {
      read: async () => {
        reads += 1;
        return null;
      },
    },
  };
  /**
   * Tool名だけが異なる同一条件の要求を構築する。
   * @responsibility 改名以外の入力条件を固定する。
   * @trace EST-IT-014
   * @precondition Tool名を指定する。
   * @stimulus 固定metadataとprojectIdを付与する。
   * @observation 返された要求をRoutingへ渡す。
   * @oracle Tool名以外の要求内容は同一である。
   * @cleanup N/A: 値だけを構築する。
   * @boundary 試験入力の構築境界。
   */
  const request = (name: string) => ({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name,
      arguments: { projectId: "PRJ-MCP" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  });
  const signal = new AbortController().signal;
  const old = await invokeMcpRequest(
    request("crdd.get_runtime_activity"),
    dependencies,
    signal,
  );
  assert.ok("error" in old);
  assert.equal(old.error.code, -32601);
  assert.equal(reads, 0);
  const current = await invokeMcpRequest(
    request("crdd.get_execution_status"),
    dependencies,
    signal,
  );
  assert.ok("result" in current);
  assert.equal(reads, 1);
});

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
  let markStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let readCompleted = false;
  let responseSettled = false;
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: MCP_EXECUTION_STATUS_TOOL,
      arguments: { projectId: "PRJ-MCP" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  let cancelledReadCount = 0;
  const refused = await invokeMcpRequest(
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
  const pending = invokeMcpRequest(
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
          markStarted();
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
    await started;
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
