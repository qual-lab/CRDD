/**
 * AI設定の管理操作をMCPへ公開しない境界を検証する。
 * @packageDocumentation
 * @responsibility 旧Profile操作の一覧不存在・呼出し拒否と公開API撤去を確認する。
 * @trace RCM-IT-010
 * @trace EST-IT-002
 * @level IT
 * @scope 正式Server Factory、公式SDK、Package Root公開。
 * @boundary EST-IT-002=Direct Boundary: 合成要求→本番Factory→公式SDK。
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as api from "../../src/index.ts";
import { invokeMcpRequest } from "../fixtures/sdk-request.ts";
import type { McpServerDependencies } from "../../src/request/server.ts";

const retiredTools = [
  "crdd.list_ai_profiles",
  "crdd.create_ai_profile",
  "crdd.update_ai_profile",
  "crdd.delete_ai_profile",
] as const;
const meta = {
  "io.modelcontextprotocol/protocolVersion":
    api.MCP_COORDINATOR_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
};

/**
 * 退役した設定管理操作は構成の有無によらず一覧・呼出しへ戻らない。
 * @responsibility 旧正本の読取り・保存を発行せず固定の未知Tool拒否を維持する。
 * @trace RCM-IT-010
 * @trace EST-IT-002
 * @precondition 本番Factoryへ外部作用のない合成依存だけを渡す。
 * @stimulus 旧四操作の一覧と、以前の形式に沿った呼出しをSDKへ渡す。
 * @observation 一覧、Protocol error、旧Owner呼出し数。
 * @oracle 旧四操作は全て不在、callは-32601、旧Owner読取り・保存0。
 * @cleanup SDKの終了とjoinをfixtureが確認する。
 * @boundary EST-IT-002=Direct Boundary: SDK→固定Tool登録。
 */
test("旧Profile四操作はMCPへ公開せず隠れたStoreを呼ばない", async () => {
  let effects = 0;
  const oldOwner = {
    snapshot: () => {
      effects++;
      throw Error("unexpected_read");
    },
    execute: () => {
      effects++;
      throw Error("unexpected_write");
    },
  };
  for (const dependencies of [
    {},
    {
      aiProfileAdministration: oldOwner,
      aiProfileAdministrationResolver: () => {
        effects++;
        return oldOwner;
      },
    },
  ]) {
    const source = dependencies as McpServerDependencies;
    const listed = await invokeMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: meta } },
      source,
    );
    assert.ok("result" in listed);
    for (const name of retiredTools) {
      assert.equal(JSON.stringify(listed).includes(name), false);
      const result = await invokeMcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name,
            arguments: name.endsWith("list_ai_profiles")
              ? {}
              : {
                  expectedRevision: 1,
                  profile: { profileId: "PROFILE-900001" },
                  profileId: "PROFILE-900001",
                  confirmed: true,
                },
            _meta: meta,
          },
        },
        source,
      );
      assert.ok("error" in result);
      assert.equal(result.error.code, -32601);
    }
  }
  assert.equal(effects, 0);
});

/**
 * 旧Profile操作用の公開SymbolをPackage Rootから除去する。
 * @responsibility 廃止した内部処理へConsumerが再接続できないことを確認する。
 * @trace RCM-IT-010
 * @precondition 現行Package Rootだけを読み込む。
 * @stimulus 旧三公開名の存在を調べる。
 * @observation export集合のown property。
 * @oracle 三項目とも不存在で、Server Factoryは維持する。
 * @cleanup N/A: 読取り専用のModule値だけ。
 * @boundary Package Root公開集合。
 */
test("旧Profile専用公開APIは撤去し通常Server入口を維持する", () => {
  for (const key of [
    "getMcpAiProfileToolDefinitions",
    "handleMcpAiProfileRequest",
    "MCP_AI_PROFILE_TOOLS",
  ])
    assert.equal(Object.hasOwn(api, key), false);
  assert.equal(typeof api.createMcpServerFactory, "function");
});
