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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";
import {
  MCP_COORDINATOR_PROTOCOL_VERSION,
  MANAGE_EXECUTION_DEFINITION_TOOL,
  GET_EXECUTION_DEFINITION_TOOL,
} from "../../src/transport/mcp-server.ts";
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
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "crdd.get_execution_definition",
    "crdd.manage_execution_definition",
  ]);
  for (const oldName of [
    "crdd.get_runtime_definition",
    "crdd.manage_runtime_definition",
  ]) {
    const request = packet(GET_EXECUTION_DEFINITION_TOOL, {
      operation: "plan",
      projectId: "project",
      milestoneId: "milestone",
    });
    const old = await invokeMcpRequest(
      { ...request, params: { ...request.params, name: oldName } },
      dependencies,
    );
    assert.equal(old.error?.code, -32601);
  }
  assert.equal(calls, 0);
  const denied = await invokeMcpRequest(
    packet(GET_EXECUTION_DEFINITION_TOOL, {
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
 * @stimulus 未許可操作、過剰・不足項目、配列と取消を渡す。
 * @observation エラーとResolver回数。
 * @oracle Resolverの呼び出しは零。
 * @cleanup N/A: メモリ値のみ。
 * @boundary MCP受付→認可解決前。
 */
test("Core定義Toolは不正・未許可操作・開始前取消を配送しない", async () => {
  let resolved = 0;
  const resolve = () => {
    resolved++;
    return null;
  };
  const command = {
    operation: "plan",
    projectId: "project",
    milestoneId: "milestone",
  };
  for (const input of [
    { ...command, operation: "queue.enqueue" },
    { ...command, operation: "initialize", expectedAbsence: true },
    { ...command, authority: true },
    { operation: "plan", projectId: "project" },
    [command],
  ]) {
    const result = await invokeMcpRequest(
      packet(GET_EXECUTION_DEFINITION_TOOL, input),
      { runtimeDefinition: resolve },
      new AbortController().signal,
    );
    assert.equal(result.error?.code, -32602);
  }
  assert.equal(
    (
      await invokeMcpRequest(
        packet(MANAGE_EXECUTION_DEFINITION_TOOL, command),
        { runtimeDefinition: resolve },
        new AbortController().signal,
      )
    ).error?.code,
    -32602,
  );
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (
      await invokeMcpRequest(
        packet(GET_EXECUTION_DEFINITION_TOOL, command),
        { runtimeDefinition: resolve },
        controller.signal,
      )
    ).error?.code,
    -32800,
  );
  assert.equal(resolved, 0);
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
    runtime: new URL("../../src/transport/mcp-server.ts", import.meta.url).href,
    sdk: new URL("../fixtures/sdk-request.ts", import.meta.url).href,
    definition: new URL("../../src/service/execution.ts", import.meta.url).href,
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
    for (const name of ["describeMcpCoordinatorAdapterContract","handleMcpCoordinatorRequest","MCP_COORDINATOR_ADAPTER_CONTRACT","getExecutionToolDefinitions","MCP_COORDINATOR_DECISION_TOOL","MCP_COORDINATOR_OBJECTIVE_TOOL","MCP_COORDINATOR_STATE_TOOL"])
      assert.equal(Object.hasOwn(runtime,name),false);
    let automationCalls=0;
    const execution = runtime.createMcpServerFactory({coordinator:{
      authenticateClient:()=>{automationCalls++;throw Error("unexpected");},
      runObjective:async()=>{automationCalls++;},getProjectState:async()=>{automationCalls++;}
    }});
    const list = await sdk.invokeMcpSource(execution,{jsonrpc:"2.0",id:0,method:"tools/list",params:{_meta:${JSON.stringify(META)}}},new AbortController().signal);
    assert.deepEqual(list.result.tools.map(tool=>tool.name),["crdd.run_objective","crdd.submit_decision","crdd.get_execution_state"]);
    const unavailable = await sdk.invokeMcpSource(execution,{jsonrpc:"2.0",id:1,method:"tools/call",params:{_meta:${JSON.stringify(META)},name:"crdd.get_execution_state",arguments:{}}},new AbortController().signal);
    assert.deepEqual(unavailable.error,{code:-32603,message:"Coordinator unavailable"});
    assert.equal(automationCalls,0);
    const vc = await import(${JSON.stringify(modules.vc)});
    const verified = vc.getRepository(${JSON.stringify(root)});
    assert.equal(verified.status, "completed");
    let authorized = true;
    const { createDefinitionAccess } = await import(${JSON.stringify(modules.definition)});
    const access = createDefinitionAccess(verified.capability, ${JSON.stringify(root)}, "host-test", () => authorized);
    const target = {projectId:"project",milestoneId:"milestone"};
    let id = 0;
    const call = async (name, command) => {
      const source=runtime.createMcpServerFactory({runtimeDefinition:()=>access});
      const response = await sdk.invokeMcpSource(source,{jsonrpc:"2.0", id:++id, method:"tools/call",params:{name,arguments:{repositoryId:"repository",command:{...target,...command}},_meta:${JSON.stringify(META)}}},new AbortController().signal);
      assert.equal(response.error, undefined, JSON.stringify(response));
      return response.result.structuredContent;
    };
    const write = (command) => call(runtime.MANAGE_EXECUTION_DEFINITION_TOOL, command);
    const read = (operation) => call(runtime.GET_EXECUTION_DEFINITION_TOOL, {operation});
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
    execFileSync(
      process.execPath,
      [
        "--eval",
        `
    import assert from "node:assert/strict";
    import {registerHooks} from "node:module";
    const controller=new AbortController();
    let imports=0,calls=0;
    registerHooks({resolve(specifier,context,next){
      if(specifier.includes("coordinator/")){imports++;controller.abort();}
      return next(specifier,context);
    }});
    const runtime=await import(${JSON.stringify(modules.runtime)});
    const sdk=await import(${JSON.stringify(modules.sdk)});
    assert.equal(imports,0);
    const fail=()=>{calls++;throw Error("unexpected");};
    const source=runtime.createMcpServerFactory({coordinator:{authenticateClient:fail,runObjective:fail,getProjectState:fail}});
    const request={jsonrpc:"2.0",id:1,method:"tools/call",params:{_meta:${JSON.stringify(META)},name:"crdd.get_execution_state",arguments:{}}};
    const response=await sdk.invokeMcpSource(source,request,controller.signal);
    assert.equal(response.error.code,-32800);
    assert.ok(imports>0);assert.equal(calls,0);
    process.stdout.write("automation_import_cancelled");
  `,
      ],
      { encoding: "utf8", stdio: "pipe", windowsHide: true, timeout: 10000 },
    ),
    "automation_import_cancelled",
  );
  fs.mkdirSync(path.join(root, ".crdd", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "PROJECT_CONTEXT.md"),
    "# Project Context\n\nProject ID: project\nRepository ID: repository\nRepository Role: development\n" +
      [
        "今どうなっているか",
        "何が危ない、または止まっているか",
        "今、人間が決めることは何か",
        "なぜこの状態・判断になったか",
        "次に何をすべきか",
      ]
        .map(
          (name, index) =>
            `\n## ${index + 1}. ${name}\n\n### 結論\n\n合成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
        )
        .join(""),
  );
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
    new URL("../../../../template/tools/crdd-server.ts", import.meta.url),
  );
  const entryCall = (request: unknown, args = ["--mcp-stdio"]) =>
    JSON.parse(
      execFileSync(process.execPath, ["--import", hook, entry, ...args], {
        cwd: root,
        input: `${JSON.stringify(request)}\n`,
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
  assert.ok(names.includes(GET_EXECUTION_DEFINITION_TOOL));
  assert.ok(names.includes(MANAGE_EXECUTION_DEFINITION_TOOL));
  assert.ok(names.includes("crdd.run_objective"));
  assert.ok(names.includes("crdd.submit_decision"));
  assert.ok(names.includes("crdd.get_execution_state"));
  const unavailable = entryCall({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { _meta: META, name: "crdd.get_execution_state", arguments: {} },
  });
  assert.deepEqual(unavailable.error, {
    code: -32603,
    message: "Coordinator unavailable",
  });
  const observed = entryCall(
    packet(GET_EXECUTION_DEFINITION_TOOL, {
      operation: "plan",
      projectId: "project",
      milestoneId: "milestone",
    }),
  ).result.structuredContent;
  assert.equal(observed.status, "available");
  const created = entryCall(
    packet(MANAGE_EXECUTION_DEFINITION_TOOL, {
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
    packet(MANAGE_EXECUTION_DEFINITION_TOOL, {
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
    packet(GET_EXECUTION_DEFINITION_TOOL, {
      operation: "tasks",
      projectId: "project",
      milestoneId: "milestone",
    }),
  ).result.structuredContent;
  assert.equal(tasks.value.length, 2);
  const stateFile = path.join(root, ".crdd", "execution-model", "state.json");
  const before = fs.readFileSync(stateFile);
  const wrongRepository = packet(GET_EXECUTION_DEFINITION_TOOL, {
    operation: "plan",
    projectId: "project",
    milestoneId: "milestone",
  });
  wrongRepository.params.arguments.repositoryId = "other";
  const denied = entryCall(wrongRepository);
  assert.ok(denied.error || denied.result?.isError);
  assert.equal(
    entryCall(
      packet(GET_EXECUTION_DEFINITION_TOOL, {
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
    ["--mcp-stdio", "--automation"],
    ["--automation", "--automation", "--mcp-stdio"],
    ["--automation", "--mcp-stdio"],
  ]) {
    assert.throws(
      () => entryCall({}, args),
      (error: unknown) => (error as { status: number }).status === 64,
    );
  }
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
            `Object.defineProperty(process.versions,'node',{value:${JSON.stringify(version)}});process.argv=['node',${JSON.stringify(entry)},'--mcp-stdio'];await import(${JSON.stringify(new URL("../../../../template/tools/crdd-server.ts", import.meta.url).href)});`,
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
            "CRDD Serverには検証済みのNode.js 24.12.0以降が必要です。",
          )
        );
      },
    );
  }
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model", "state.json")),
    true,
  );
});

/**
 * 遅延読込み前のWorkspace入力捕捉と取消を反証する。
 * @responsibility 元参照の変更とimport失敗を実処置へ持ち込まない。
 * @trace PRL-IT-012
 * @precondition 有限Node子と合成Workspace要求だけを使用する。
 * @stimulus import時に元入力を変更、又は取消と読込み失敗を同時に発生させる。
 * @observation Resolver回数、拒否コード、Coordinatorの読込み回数。
 * @oracle 捕捉済みの正常入力だけがResolverへ到達し、取消・不正入力は零回。
 * @cleanup 同期子の終了を待ち、保存・一時Fileは作らない。
 * @boundary 公開MCP handlerとModule読込みの待機境界。
 */
test("Workspaceは読込み待機前の入力を捕捉し取消失敗を区別する", () => {
  const module = new URL("../../src/transport/mcp-server.ts", import.meta.url)
    .href;
  for (const mode of ["mutation", "cancel"]) {
    const output = execFileSync(
      process.execPath,
      [
        "--eval",
        `
      import assert from "node:assert/strict";
      import {registerHooks} from "node:module";
      const mode=${JSON.stringify(mode)}, controller=new AbortController();
      let reads=0,imports=0,selected;
      const command={operation:"freeze",projectId:"project",queueId:"queue",workspaceId:"11111111-1111-4111-8111-111111111111",expectedGeneration:1,operationId:"22222222-2222-4222-8222-222222222222",baseCommit:"a".repeat(40),expectedHead:"a".repeat(40),selection:[{path:"src/code.ts",blobId:"a".repeat(40),mode:"100644"}],candidateName:null,relatedChangeIds:["CHG-000001"]};
      registerHooks({resolve(s,c,next){if(s.includes("coordinator/")){
        imports++;
        if(mode==="cancel"){controller.abort();throw Error("unavailable");}
        command.operation="invalid";command.expectedGeneration=-1;
        command.selection[0].path="../outside";command.relatedChangeIds[0]="invalid";
      }return next(s,c);}});
      const api=await import(${JSON.stringify(module)});
      const packet=(command)=>({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:api.MCP_WORKSPACE_MANAGE_TOOL,arguments:{repositoryId:"repository",command},_meta:${JSON.stringify(META)}}});
      const resolve=(repositoryId)=>{reads++;selected=repositoryId;return null;};
      for(const invalid of [[],{...command,operation:{}},{...command,selection:[0]},{...command,selection:[{path:"a",mode:"100644"}]}]){
        const result=await api.handleMcpWorkspaceRequest(packet(invalid),resolve,controller.signal);
        assert.equal(result.error.code,-32602);
      }
      assert.equal(imports,0);assert.equal(reads,0);
      const input=packet(command);
      const pending=api.handleMcpWorkspaceRequest(input,resolve,controller.signal);
      input.params.arguments.repositoryId="changed-after-call";
      command.candidateName="changed-after-call";
      const result=await pending;
      assert.ok(imports>0);
      assert.equal(result.error.code,mode==="cancel"?-32800:-32603);
      assert.equal(reads,mode==="cancel"?0:1);
      assert.equal(selected,mode==="cancel"?undefined:"repository");
      process.stdout.write("workspace_boundary_passed");
    `,
      ],
      { encoding: "utf8", stdio: "pipe", windowsHide: true, timeout: 10000 },
    );
    assert.equal(output, "workspace_boundary_passed");
  }
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
  name:
    | typeof GET_EXECUTION_DEFINITION_TOOL
    | typeof MANAGE_EXECUTION_DEFINITION_TOOL,
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
