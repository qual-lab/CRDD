/**
 * Core定義ToolをDomainの実保存へ接続する。
 * @packageDocumentation
 * @responsibility Coordinator非読込の公開RootとSDKでCRUD・CAS・拒否・再読取りを反証する。
 * @trace PRL-IT-012
 * @level IT
 * @scope Package Root・本番Factory・Core Toolの閉入力と一般定義保存。
 * @boundary 子Process→MCP Tool→Domain→自己生成Filesystemと既存短期排他。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
test("MCP RootはCoordinatorなしで保存・再読取り・CASを維持する", (t) => {
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
    runtime: new URL("../../src/index.ts", import.meta.url).href,
    sdk: new URL("../fixtures/sdk-request.ts", import.meta.url).href,
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
    const sdk = await import(${JSON.stringify(modules.sdk)});
    assert.equal(runtime.inspectMcpCoordinatorObjectiveResult(null),null);
    const vc = await import(${JSON.stringify(modules.vc)});
    const verified = vc.verifyRepositoryRoot(${JSON.stringify(root)});
    assert.equal(verified.status, "completed");
    let authorized = true;
    const access = { root: verified.capability, principalId: "host-test", revalidate: () => authorized };
    const target = {projectId:"project",milestoneId:"milestone"};
    let id = 0;
    const call = async (name, command) => {
      const source=runtime.createMcpServerFactory({runtimeDefinition:()=>access});
      const response = await sdk.invokeMcpSource(source,{jsonrpc:"2.0", id:++id, method:"tools/call",params:{name,arguments:{repositoryId:"repository",command:{...target,...command}},_meta:${JSON.stringify(META)}}},new AbortController().signal);
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
  fs.mkdirSync(path.join(root, ".crdd", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".crdd", "config", "repository-manifest.json"),
    JSON.stringify({
      schema: "crdd/repository-manifest/v2",
      projectId: "project",
      repositoryId: "repository",
      displayName: "合成",
      repositoryRole: "development",
      capabilities: ["domain-model", "mcp-server"],
      contextSurfaces: ["crdd-context"],
      externalSendPolicy: "config/external-send-policy.json",
    }),
  );
  const hook =
    "data:text/javascript," +
    encodeURIComponent(
      `import {registerHooks} from 'node:module';registerHooks({resolve(s,c,n){if(s.includes('coordinator/')||s.includes('executor/'))throw Error('automation_unavailable');return n(s,c);}});`,
    );
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
  );
  const entryCall = (request: unknown, args = ["--stdio"]) =>
    JSON.parse(
      execFileSync(process.execPath, ["--import", hook, entry, ...args], {
        cwd: root,
        input: JSON.stringify(request) + "\n",
        encoding: "utf8",
        stdio: "pipe",
        windowsHide: true,
        timeout: 10000,
      }),
    );
  const listed = entryCall({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: { _meta: META },
  });
  const names = listed.result.tools.map((tool: { name: string }) => tool.name);
  assert.ok(names.includes(MCP_RUNTIME_READ_TOOL));
  assert.ok(names.includes(MCP_RUNTIME_MANAGE_TOOL));
  assert.equal(names.includes("crdd.get_coordinator_state"), false);
  const observed = entryCall(
    packet(MCP_RUNTIME_READ_TOOL, {
      operation: "plan",
      projectId: "project",
      milestoneId: "milestone",
    }),
  ).result.structuredContent;
  assert.equal(observed.status, "available");
  const created = entryCall(
    packet(MCP_RUNTIME_MANAGE_TOOL, {
      operation: "task.create",
      projectId: "project",
      milestoneId: "milestone",
      expected: observed.version,
      definition: {
        id: "entry-task",
        objectiveId: "objective",
        dependencies: [],
        allowedPaths: ["src/entry.ts"],
        conflictKeys: [],
      },
    }),
  ).result.structuredContent;
  assert.equal(created.status, "saved", JSON.stringify(created));
  const stale = entryCall(
    packet(MCP_RUNTIME_MANAGE_TOOL, {
      operation: "task.create",
      projectId: "project",
      milestoneId: "milestone",
      expected: observed.version,
      definition: {
        id: "entry-task-2",
        objectiveId: "objective",
        dependencies: [],
        allowedPaths: ["src/entry.ts"],
        conflictKeys: [],
      },
    }),
  ).result.structuredContent;
  assert.equal(stale.status, "conflict");
  const tasks = entryCall(
    packet(MCP_RUNTIME_READ_TOOL, {
      operation: "tasks",
      projectId: "project",
      milestoneId: "milestone",
    }),
  ).result.structuredContent;
  assert.equal(tasks.value.length, 2);
  const stateFile = path.join(root, ".crdd", "coordinator", "state.json");
  const before = fs.readFileSync(stateFile);
  const wrongRepository = packet(MCP_RUNTIME_READ_TOOL, {
    operation: "plan",
    projectId: "project",
    milestoneId: "milestone",
  });
  wrongRepository.params.arguments.repositoryId = "other";
  const denied = entryCall(wrongRepository);
  assert.ok(denied.error || denied.result?.isError);
  assert.equal(
    entryCall(
      packet(MCP_RUNTIME_READ_TOOL, {
        operation: "plan",
        projectId: "other",
        milestoneId: "milestone",
      }),
    ).result.structuredContent.status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(stateFile), before);
  for (const args of [
    ["--cros", "--automation", "--http", "--port", "0"],
    ["--stdio", "--automation"],
    ["--automation", "--automation", "--stdio"],
  ]) {
    assert.throws(
      () => entryCall({}, args),
      (error: unknown) => (error as { status: number }).status === 64,
    );
  }
  assert.throws(
    () => entryCall({}, ["--automation", "--stdio"]),
    (error: unknown) => {
      const child = error as { status: number; stdout: string };
      return child.status === 2 && child.stdout === "";
    },
  );
  for (const version of [
    "24.11.9",
    "24.12.0-preview",
    "024.12.0",
    "9007199254740992.0.0",
  ]) {
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            "--import",
            hook,
            "--eval",
            `Object.defineProperty(process.versions,'node',{value:${JSON.stringify(version)}});process.argv=['node',${JSON.stringify(entry)},'--stdio'];await import(${JSON.stringify(new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url).href)});`,
          ],
          {
            cwd: root,
            input: "",
            encoding: "utf8",
            stdio: "pipe",
            timeout: 10000,
            windowsHide: true,
          },
        ),
      (error: unknown) => {
        const child = error as { status: number; stderr: string };
        return (
          child.status === 2 &&
          child.stderr.includes(
            "CRDD MCP requires a preverified Node.js 24.12.0",
          )
        );
      },
    );
  }
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
