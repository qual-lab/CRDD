/**
 * Core定義ToolをDomainの実保存へ接続する。
 * @packageDocumentation
 * @responsibility Coordinator非読込のTool単位でCRUD・CAS・拒否・再読取りを反証する。
 * @trace PRL-IT-012
 * @level IT
 * @scope tools/runtimeの閉入力と一般定義保存。Server Rootの読込閉包は別の未完了検証。
 * @boundary 子Process→MCP Tool→Domain→自己生成Filesystemと既存短期排他。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRepositoryTestDirectory } from "../../../domain-model/tests/support/repository-test-directory.ts";
import {
  handleMcpRuntimeRequest,
  MCP_RUNTIME_READ_TOOL,
  MCP_RUNTIME_MANAGE_TOOL,
} from "../../src/tools/runtime.ts";
import { MCP_COORDINATOR_PROTOCOL_VERSION } from "../../src/request/validation.ts";
import { invokeMcpRequest } from "../fixtures/sdk-request.ts";

const META = {
  "io.modelcontextprotocol/protocolVersion": MCP_COORDINATOR_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
};

/**
 * 正式Factoryが構成したCore ToolだけをSDKへ公開する。
 * @responsibility 個別handlerの成功と本番の登録接続を区別する。
 * @trace PRL-IT-012
 * @precondition 内容を許可しない要求内Resolverを構成する。
 * @stimulus 一覧取得とPlan Queryを公式SDKへ渡す。
 * @observation exact Tool集合とResolver回数。
 * @oracle 二つのCore Toolだけを列挙し、Callは一回だけ認可へ届く。
 * @cleanup 既存SDK fixtureがcloseとjoinを行う。
 * @boundary 本番Factory→公式SDK→Core Tool。
 */
test("本番Factoryは構成したCore定義ToolだけをSDKへ接続する", async () => {
  let calls = 0;
  const dependencies = {
    runtimeDefinition: () => {
      calls++;
      return null;
    },
  };
  const listed = await invokeMcpRequest(
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: META } },
    dependencies,
  );
  const tools = (listed.result as { tools: { name: string }[] }).tools;
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [MCP_RUNTIME_READ_TOOL, MCP_RUNTIME_MANAGE_TOOL].sort(),
  );
  assert.equal(calls, 0);
  const denied = await invokeMcpRequest(
    packet(MCP_RUNTIME_READ_TOOL, {
      operation: "plan",
      projectId: "project",
      milestoneId: "milestone",
    }),
    dependencies,
  );
  assert.equal(denied.error?.code, -32603);
  assert.equal(calls, 1);
});

/**
 * 不正要求と開始前取消で認可Ownerを呼ばない。
 * @responsibility 閉入力と許可操作の境界をOwner呼出し前に固定する。
 * @trace PRL-IT-012
 * @precondition 外部資源を持たないResolver。
 * @stimulus 未許可操作、過剰field、getter、Proxyと取消を渡す。
 * @observation エラーとResolver回数。
 * @oracle Resolver零、入力hook零。
 * @cleanup N/A: メモリ値のみ。
 * @boundary MCP受付→認可解決前。
 */
test("Core定義Toolは不正・未許可操作・開始前取消を配送しない", async () => {
  let resolved = 0;
  let hooks = 0;
  const resolve = () => {
    resolved++;
    return null;
  };
  const command = {
    operation: "plan",
    projectId: "project",
    milestoneId: "milestone",
  };
  const getter = { ...command };
  Object.defineProperty(getter, "operation", {
    enumerable: true,
    get() {
      hooks++;
      return "plan";
    },
  });
  for (const input of [
    { ...command, operation: "queue.enqueue" },
    { ...command, authority: true },
    getter,
    new Proxy(command, {
      ownKeys() {
        hooks++;
        return [];
      },
    }),
  ]) {
    const result = await handleMcpRuntimeRequest(
      packet(MCP_RUNTIME_READ_TOOL, input),
      resolve,
      new AbortController().signal,
    );
    assert.equal(result.error?.code, -32602);
  }
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (
      await handleMcpRuntimeRequest(
        packet(MCP_RUNTIME_READ_TOOL, command),
        resolve,
        controller.signal,
      )
    ).error?.code,
    -32800,
  );
  assert.equal(resolved, 0);
  assert.equal(hooks, 0);
});

/**
 * 実行Packageを読めない子で明示CRUDを保存する。
 * @responsibility Toolの実Writer接続と再読取りを模擬成功から区別する。
 * @trace PRL-IT-012
 * @precondition Root確認付き自己生成Repositoryだけ。
 * @stimulus 明示初期化、Plan保存、Objective作成／更新／削除、stale CAS、読取りを行う。
 * @observation 子の終了、各Domain結果、実state File。
 * @oracle 一つのWriterへ保存・再読取りし、staleは競合、Provider実行なし。
 * @cleanup 子をjoinし、既存helperでexact試験Rootを削除する。
 * @boundary 子ProcessとDomain実Filesystem。AI・Dockerは呼ばない。
 */
test("Core定義Tool単体はCoordinatorなしで保存・再読取り・CASを維持する", (t) => {
  const directory = createRepositoryTestDirectory("mcp-runtime-definition-");
  t.after(directory.cleanup);
  const root = directory.path;
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "refs", "heads", "main"),
    `${"1".repeat(40)}\n`,
  );
  const modules = {
    runtime: new URL("../../src/tools/runtime.ts", import.meta.url).href,
    vc: new URL("../../../version-control/src/index.ts", import.meta.url).href,
  };
  const output = execFileSync(
    process.execPath,
    [
      "--eval",
      `
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    registerHooks({resolve(specifier, context, next) {
      if (specifier.includes("coordinator/") || specifier.includes("executor/")) throw new Error("automation_unavailable");
      return next(specifier, context);
    }});
    const runtime = await import(${JSON.stringify(modules.runtime)});
    const vc = await import(${JSON.stringify(modules.vc)});
    const verified = vc.verifyRepositoryRoot(${JSON.stringify(root)});
    assert.equal(verified.status, "completed");
    let authorized = true;
    const access = { root: verified.capability, principalId: "host-test", revalidate: () => authorized };
    const target = {projectId:"project",milestoneId:"milestone"};
    let id = 0;
    const call = async (name, command) => {
      const response = await runtime.handleMcpRuntimeRequest({jsonrpc:"2.0", id:++id, method:"tools/call",params:{name,arguments:{repositoryId:"repository",command:{...target,...command}},_meta:${JSON.stringify(META)}}}, () => access, new AbortController().signal);
      assert.equal(response.error, undefined, JSON.stringify(response));
      return response.result.structuredContent;
    };
    const write = (command) => call(runtime.MCP_RUNTIME_MANAGE_TOOL, command);
    const read = (operation) => call(runtime.MCP_RUNTIME_READ_TOOL, {operation});
    const initial = await write({operation:"initialize",expectedAbsence:true});
    assert.equal(initial.status,"saved",JSON.stringify(initial));
    const plan = {milestoneAcceptanceCriteria:["確認"],objectives:[{id:"objective",acceptanceCriteria:["確認"]}],tasks:[{id:"task",objectiveId:"objective",dependencies:[],allowedPaths:["src/code.ts"],conflictKeys:[]}]};
    const saved = await write({operation:"plan.save",expected:initial.version,expectedDefinitionHash:null,definition:plan});
    assert.equal(saved.status,"saved",JSON.stringify(saved));
    assert.equal((await write({operation:"plan.save",expected:initial.version,expectedDefinitionHash:null,definition:plan})).status,"conflict");
    const created = await write({operation:"objective.create",expected:saved.version,definition:{id:"extra",acceptanceCriteria:["first"]}});
    assert.equal(created.status,"saved",JSON.stringify(created));
    const updated = await write({operation:"objective.update",expected:created.version,objectiveId:"extra",expectedDefinitionHash:created.value.definitionHash,definition:{id:"extra",acceptanceCriteria:["updated"]}});
    assert.equal(updated.status,"saved",JSON.stringify(updated));
    const deleted = await write({operation:"objective.delete",expected:updated.version,objectiveId:"extra",expectedDefinitionHash:updated.value.definitionHash});
    assert.equal(deleted.status,"saved",JSON.stringify(deleted));
    const taskCreated = await write({operation:"task.create",expected:deleted.version,definition:{id:"extra-task",objectiveId:"objective",dependencies:[],allowedPaths:["src/extra.ts"],conflictKeys:[]}});
    assert.equal(taskCreated.status,"saved",JSON.stringify(taskCreated));
    const taskUpdated = await write({operation:"task.update",expected:taskCreated.version,taskId:"extra-task",expectedDefinitionHash:taskCreated.value.definitionHash,definition:{...taskCreated.value.definition,allowedPaths:["src/updated.ts"]}});
    assert.equal(taskUpdated.status,"saved",JSON.stringify(taskUpdated));
    const taskDeleted = await write({operation:"task.delete",expected:taskUpdated.version,taskId:"extra-task",expectedDefinitionHash:taskUpdated.value.definitionHash});
    assert.equal(taskDeleted.status,"saved",JSON.stringify(taskDeleted));
    const observed = await read("objectives");
    assert.equal(observed.status,"available"); assert.equal(observed.value.length,1);
    assert.equal((await read("tasks")).value.length,1);
    authorized = false;
    assert.equal((await read("plan")).status,"blocked");
    process.stdout.write("core_tool_crud_passed");
  `,
    ],
    { encoding: "utf8", stdio: "pipe", timeout: 60_000 },
  );
  assert.equal(output, "core_tool_crud_passed");
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "coordinator", "state.json")),
    true,
  );
});

/**
 * 固定したTool Callを構築する。
 * @responsibility 正規Envelopeと未信頼commandを分離する。
 * @trace PRL-IT-012
 * @precondition 合成値だけ。
 * @stimulus Tool名と試験commandを指定。
 * @observation 返却値を受付へ渡す。
 * @oracle 元commandのhookを実行せず同じ参照を搬送する。
 * @cleanup N/A: 局所値。
 * @boundary 試験とTool受付。
 */
function packet(
  name: typeof MCP_RUNTIME_READ_TOOL | typeof MCP_RUNTIME_MANAGE_TOOL,
  command: unknown,
) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name,
      arguments: { repositoryId: "repository", command },
      _meta: META,
    },
  };
}
