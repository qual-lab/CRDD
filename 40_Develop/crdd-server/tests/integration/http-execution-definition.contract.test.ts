/**
 * Coordinatorを読めないWorkbenchでCore定義を保存する。
 * @packageDocumentation
 * @responsibility 公開Root・HTTPと確定した単体の対象を実Domain Writer・再読取りへ接続する。
 * @trace PRL-IT-012
 * @trace RFD-IT-013
 * @level IT
 * @scope Core初期化・定義CRUD・CAS・入力拒否・Server終了、AM認可結果の型適合と同値保持。
 * @boundary Workbench HTTP又は直接AM認可からDomain保存。実AI・Dockerは対象外。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import path from "node:path";
import test from "node:test";
import {
  createDefinitionAccess,
  executeDefinitionOperation,
  resolveLocalDefinitionAccess,
} from "../../src/service/execution.ts";
import { createExecutionDefinitionHandler } from "../../src/transport/api-server.ts";
import { getRepository } from "@qual-lab/crdd-version-control";
import { contentFixture } from "../../../access-management/tests/integration/storage/fixture.ts";
import {
  initializeExecutionState,
  queryPlan,
  type savePlan,
} from "@qual-lab/crdd-execution-model";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { taskExecutionSelections } from "../../../coordinator/tests/fixtures/ai-selection.ts";

/**
 * 非導入の実行機能を読込拒否しても定義を編集できる。
 * @responsibility 公開起動とHTTP搬送・CAS・永続再読取りの実接続を検証する。
 * @trace PRL-IT-012
 * @precondition 自己生成Git Repositoryと合成Contextだけ。
 * @stimulus Coordinator/Executor解決拒否下で起動・初期化・Plan保存・Task CRUD・再起動する。
 * @observation HTTP結果・版・拒否・子Process終了と専用stateの存在。
 * @oracle Domain値を保存し、古いCASと異なるOriginは拒否、再起動後に同じ定義を読む。
 * @cleanup 子のServer終了を待ち、既存helperでexact合成Rootを回収する。
 * @boundary Workbench Root→本番HTTP→Domain→合成Filesystem。
 */
test("Workbench RootはCoordinatorなしで起動・定義CRUD・再読取りする", (t) => {
  const directory = createRepositoryTestDirectory("workbench-core-definition-");
  t.after(directory.cleanup);
  const root = directory.path;
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], {
      stdio: "pipe",
      windowsHide: true,
    });
  git("init", "--quiet", "--template=");
  git("config", "user.name", "CRDD Test");
  git("config", "user.email", "test@example.invalid");
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  const exclude = path.join(root, ".git", "info", "exclude");
  fs.writeFileSync(exclude, "# fixture\n");
  fs.mkdirSync(path.join(root, "04_UI", "assets", "brand"), {
    recursive: true,
  });
  fs.copyFileSync(
    new URL(
      "../../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg",
      import.meta.url,
    ),
    path.join(root, "04_UI", "assets", "brand", "crdd-brand-icon-512x512.jpg"),
  );
  fs.writeFileSync(
    path.join(root, "PROJECT_CONTEXT.md"),
    "# Project Context\n\nProject ID: project.fixture\nRepository ID: repository.fixture\nRepository Role: development\n" +
      [
        "今どうなっているか",
        "何が危ない、または止まっているか",
        "今、人間が決めることは何か",
        "なぜこの状態・判断になったか",
        "次に何をすべきか",
      ]
        .map(
          (name, i) =>
            `\n## ${i + 1}. ${name}\n\n### 結論\n\n合成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
        )
        .join(""),
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "fixture");
  fs.mkdirSync(path.join(root, ".crdd", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".crdd", "config", "repository-manifest.json"),
    JSON.stringify({
      schema: "crdd/repository-manifest/v2",
      projectId: "project.fixture",
      repositoryId: "repository.fixture",
      displayName: "合成",
      repositoryRole: "development",
      capabilities: ["domain-model", "mcp-server"],
      contextSurfaces: ["crdd-context"],
      externalSendPolicy: "config/external-send-policy.json",
    }),
  );
  const module = new URL("../../src/app.ts", import.meta.url).href;
  const em = new URL(import.meta.resolve("@qual-lab/crdd-execution-model"))
    .href;
  const head = git("rev-parse", "HEAD").toString("utf8").trim();
  const output = execFileSync(
    process.execPath,
    [
      "--eval",
      `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {registerHooks} from 'node:module';
      registerHooks({resolve(s,c,n){if(s==='@qual-lab/crdd-coordinator'||s.includes('coordinator/')||s==='@qual-lab/crdd-executor'||s.includes('executor/')||/^(?:mcp-|tools-)/.test(s.split('/').at(-1))||s.startsWith('@modelcontextprotocol/'))throw new Error('optional_runtime_unavailable');return n(s,c);}});
    const {startWorkbench}=await import(${JSON.stringify(module)});
    let server=await startWorkbench({workingDirectory:${JSON.stringify(root)}});
    const target={projectId:'project.fixture',milestoneId:'milestone'};
    const base='/api/repositories/repository.fixture/projects/project.fixture/milestones/milestone';
    const write=async({operation,taskId,objectiveId,...body}, origin=server.baseUrl)=>{
      const [method, resource]= {
        initialize:['POST','/definition'],
        'plan.save':['PUT','/plan'],
        'task.create':['POST','/tasks'],
        'task.update':['PATCH','/tasks/'+taskId],
        'task.delete':['DELETE','/tasks/'+taskId],
        'objective.create':['POST','/objectives'],
        'objective.update':['PATCH','/objectives/'+objectiveId],
        'objective.delete':['DELETE','/objectives/'+objectiveId],
      }[operation];
      const response=await fetch(server.baseUrl+base+resource,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
      return {status:response.status,value:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};
    };
    const query=async()=>{const r=await fetch(server.baseUrl+base+'/plan');assert.equal(r.status,200);return r.json();};
    try{
      assert.equal((await write({operation:'initialize',expectedAbsence:true},'https://other.invalid')).status,403);
      assert.equal((await fetch(server.baseUrl+'/api/execution/definition',{method:'POST'})).status,404);
      assert.equal((await fetch(server.baseUrl+'/api/execution/definition')).status,404);
      for (const [url, body] of [
        [base+'/definition','{"operation":"initialize","expectedAbsence":true}'],
        [base+'/definition','{"expectedAbsence":true,"expectedAbsence":true}'],
        [base+'/definition','{"expectedAbsence":true,"projectId":"other"}'],
      ]) assert.equal((await fetch(server.baseUrl+url,{method:'POST',headers:{origin:server.baseUrl,'content-type':'application/json'},body})).status,400);
      assert.equal((await fetch(server.baseUrl+base.replace('repository.fixture','other')+'/plan')).status,403);
      assert.equal((await write({operation:'initialize',expectedAbsence:true,unknown:true})).status,400);
      assert.equal(readFileSync(${JSON.stringify(exclude)},'utf8'),'# fixture\\n');
      const initialized=await write({operation:'initialize',expectedAbsence:true});
      assert.equal(initialized.status,201);
      const initial=initialized.value;assert.equal(initial.status,'saved',JSON.stringify(initial));
      const notAllowed=await fetch(server.baseUrl+base+'/plan',{method:'POST'});
      assert.equal(notAllowed.status,405);
      assert.equal(notAllowed.headers.get('allow'),'GET, HEAD, PUT');
      const registered=readFileSync(${JSON.stringify(exclude)},'utf8');
      assert.equal(registered.split(/\\r?\\n/).filter(line=>line==='.crdd/').length,1);
      const plan={milestoneAcceptanceCriteria:['確認'],objectives:[{id:'objective',acceptanceCriteria:['確認']}],tasks:[{id:'task',objectiveId:'objective',dependencies:[],allowedPaths:['code.ts'],conflictKeys:[]}]};
      const saved=(await write({operation:'plan.save',expected:initial.version,expectedDefinitionHash:null,definition:plan})).value;assert.equal(saved.status,'saved',JSON.stringify(saved));
      assert.equal((await write({operation:'plan.save',expected:initial.version,expectedDefinitionHash:null,definition:plan})).value.status,'conflict');
      const objective=(await write({operation:'objective.create',expected:saved.version,definition:{id:'extra-objective',acceptanceCriteria:['新規']}})).value;
      assert.equal(objective.status,'saved',JSON.stringify(objective));
      const objectiveUpdated=(await write({operation:'objective.update',objectiveId:'extra-objective',expected:objective.version,expectedDefinitionHash:objective.value.definitionHash,definition:{id:'extra-objective',acceptanceCriteria:['更新']}})).value;
      assert.equal(objectiveUpdated.status,'saved',JSON.stringify(objectiveUpdated));
      const objectives=await(await fetch(server.baseUrl+base+'/objectives')).json();
      assert.equal(objectives.status,'available');
      assert.equal(objectives.value.length,2);
      const objectiveDeleted=(await write({operation:'objective.delete',objectiveId:'extra-objective',expected:objectiveUpdated.version,expectedDefinitionHash:objectiveUpdated.value.definitionHash})).value;
      assert.equal(objectiveDeleted.status,'saved',JSON.stringify(objectiveDeleted));
      const created=(await write({operation:'task.create',expected:objectiveDeleted.version,definition:{id:'extra',objectiveId:'objective',dependencies:[],allowedPaths:['extra.ts'],conflictKeys:[]}})).value;assert.equal(created.status,'saved',JSON.stringify(created));
      const taskUpdated=(await write({operation:'task.update',expected:created.version,taskId:'extra',expectedDefinitionHash:created.value.definitionHash,definition:{id:'extra',objectiveId:'objective',dependencies:[],allowedPaths:['updated.ts'],conflictKeys:[]}})).value;
      assert.equal(taskUpdated.status,'saved',JSON.stringify(taskUpdated));
      const deleted=(await write({operation:'task.delete',expected:taskUpdated.version,taskId:'extra',expectedDefinitionHash:taskUpdated.value.definitionHash})).value;assert.equal(deleted.status,'saved',JSON.stringify(deleted));
      const definitionUrl=server.baseUrl+base;
      const missing=await fetch(definitionUrl+'/tasks?queueId=missing');
      assert.equal(missing.status,200);assert.equal((await missing.json()).status,'absent');
      assert.equal((await fetch(definitionUrl+'/tasks?queueId=a&queueId=b')).status,400);
      assert.equal((await fetch(definitionUrl+'/plan?queueId=a')).status,400);
      assert.equal((await write({operation:'initialize',expectedAbsence:true,queueId:'a'})).status,400);
      const large={...plan,tasks:Array.from({length:128},(_,i)=>({id:'large-'+i,objectiveId:'objective',dependencies:[],allowedPaths:Array.from({length:128},(_,j)=>'src/'+i+'-'+j+'-'+ 'p'.repeat(200)),conflictKeys:[]}))};
      assert.ok(Buffer.byteLength(JSON.stringify(large))>3*1024*1024);
      const largeSaved=(await write({operation:'plan.save',expected:deleted.version,expectedDefinitionHash:deleted.value.definitionHash??(await query()).value.definitionHash,definition:large})).value;
      assert.equal(largeSaved.status,'saved',JSON.stringify(largeSaved));
      const before=await query();assert.equal(before.status,'available');
      const planGet=await fetch(server.baseUrl+base+'/plan');
      const planHead=await fetch(server.baseUrl+base+'/plan',{method:'HEAD'});
      assert.equal(planHead.status,planGet.status);
      for(const key of ['content-type','content-length']) assert.equal(planHead.headers.get(key),planGet.headers.get(key));
      assert.equal(await planHead.text(),'');await planGet.text();
      const {request}=await import('node:http');
      const rejected=await new Promise((resolve,reject)=>{const r=request(server.baseUrl+base+'/plan',{method:'PUT',headers:{origin:server.baseUrl,'content-type':'application/json','content-length':3*16777216+16385}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});r.on('error',reject);r.end();});
      assert.equal(rejected,413);assert.deepEqual(await query(),before);
      const chunked=await new Promise((resolve,reject)=>{
        const workspace=server.baseUrl+'/api/repositories/repository.fixture/workspaces';
        const r=request(workspace,{method:'POST',headers:{origin:server.baseUrl,'content-type':'application/json','transfer-encoding':'chunked'}},
          response=>{response.resume();response.on('end',()=>{resolve([response.statusCode,response.headers.connection]);r.destroy();});});
        r.on('error',reject);r.setTimeout(3000,()=>r.destroy(Error('chunked_rejection_timeout')));r.write('x'.repeat(16384));r.write('x');
      });
      assert.deepEqual(chunked,[413,'close']);
      await server.close();server=await startWorkbench({workingDirectory:${JSON.stringify(root)}});
      assert.deepEqual(await query(),before);
      const {createQueue}=await import(${JSON.stringify(em)});
      const repositoryRevision=${JSON.stringify(head)};
      const fixtureRoot=${JSON.stringify(root)};
      const {repositoryBindingId}=JSON.parse(readFileSync(fixtureRoot+'/.crdd/execution-model/state.json','utf8'));
      for(const [queueId,hash] of [['queue-a','a'],['queue-b','b']]){
        const queued=createQueue({directory:fixtureRoot},repositoryBindingId,{kind:'scheduled',input:[
          {...target,queueId,repositoryRevision,requestHash:hash.repeat(64),scopeHash:hash.repeat(64),originLane:'scheduled'},
          {...target,...plan,repositoryRevision,maximumConcurrency:1,ownerGeneration:'fixture-owner',taskExecutionSelections:${JSON.stringify(taskExecutionSelections())},tasks:[{...plan.tasks[0],allowedPaths:[queueId+'.ts']}]}
        ]});
        assert.equal(queued.status,'completed',queued.reason);
        const response=await(await fetch(server.baseUrl+base+'/tasks?'+new URLSearchParams({queueId}))).json();
        assert.equal(response.status,'available');assert.deepEqual(response.value[0].definition.allowedPaths,[queueId+'.ts']);assert.equal(response.value[0].execution.state,'ready');
      }
      const shared=await(await fetch(server.baseUrl+base+'/tasks')).json();
      assert.equal(shared.status,'available');assert.equal(shared.value.length,large.tasks.length);assert.ok(shared.value.every(task=>task.execution===null));
    }finally{await server.close();}
    await assert.rejects(fetch(server.baseUrl+'/.well-known/crdd-workbench-health'));
    process.stdout.write('workbench_core_crud_passed');
  `,
    ],
    { encoding: "utf8", stdio: "pipe", timeout: 60000, windowsHide: true },
  );
  assert.equal(output, "workbench_core_crud_passed");
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-model", "state.json")),
    true,
  );
});

/**
 * 任意Ownerの読込み待機後に失効・取消・Root変更を再確認する。
 * @responsibility 本番Routeの固定待機区間を有限代役で反証し、Readerの非発行を観測する。
 * @trace PRL-IT-012
 * @precondition 公開HTTPの正常保存は同Suite上段で実検証する。
 * @stimulus Sourceの同じawait区間で現在条件を失効させる。
 * @observation Reader呼出し回数と拒否又は取消終了。
 * @oracle 生存時一回、失効・切断・取消時零回。
 * @cleanup 局所Promiseを解決して終了する。Filesystem生成なし。
 * @boundary 固定動的import後の利用側。代役から実認可の成立を推定しない。
 */
test("単体表示のOwner待機後の失効・取消は設定Readerを発行しない", async () => {
  const viewSource = fs.readFileSync(
    new URL("../../src/transport/api-server.ts", import.meta.url),
    "utf8",
  );
  const source = sourceDeclaration(viewSource, "handleRepositoryView");
  const start = source.indexOf("const owner = await import(");
  const end = source.indexOf(
    "\n",
    source.indexOf("network = owner.readRepositoryNetworkHosts(", start),
  );
  assert.ok(start > 0 && end > start);
  const segment = source
    .slice(start, end)
    .replace(/await import\([\s\S]*?\)/u, "await gate");
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  for (const condition of ["live", "aborted", "destroyed", "revoked"]) {
    let release!: (value: unknown) => void;
    let reads = 0;
    let live = true;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const requestSignal = { aborted: false };
    const response = { destroyed: false };
    const capability = {};
    const repositoryRoot = "fixture";
    const run = new AsyncFunction(
      "gate",
      "requestSignal",
      "response",
      "resolveVerifiedRepositoryRoot",
      "capability",
      "repositoryRoot",
      `let network=null;${segment};return network;`,
    );
    const result = run(
      gate,
      requestSignal,
      response,
      () => (live ? repositoryRoot : null),
      capability,
      repositoryRoot,
    );
    if (condition === "aborted") requestSignal.aborted = true;
    if (condition === "destroyed") response.destroyed = true;
    if (condition === "revoked") live = false;
    release({
      readRepositoryNetworkHosts() {
        reads++;
        return {};
      },
    });
    if (condition === "revoked") await assert.rejects(result);
    else await result;
    assert.equal(reads, condition === "live" ? 1 : 0);
  }
});

/**
 * Manifestの再観測をWBと配布MCPの実Closureへ接続する。
 * @responsibility Hash比較を手書きせず、実Sourceの再確認位置とReader呼出し回数を固定する。
 * @trace PRL-IT-012
 * @precondition 型を除去した現Sourceと非秘密の有限読取り代役だけを使う。
 * @stimulus 同Hash、別Hash、不在、観測不能、Root変更、取消を各Closureへ渡す。
 * @observation 判定と毎回のReader呼出し数。
 * @oracle 同Hashだけtrue。WBは読取り後、MCPは外側のSignal／Root確認後に再読取りする。
 * @cleanup N/A: 同Process内の値と関数だけを作り、File・HTTP・AIを起動しない。
 * @boundary 製品の再認可Closure。代役から実AM認可・File安定性の成立を推定しない。
 */
test("WBと配布MCPはManifestを毎回再読取りしIdentity差を拒否する", async () => {
  const workspaceSource = fs.readFileSync(
    new URL("../../src/service/workspace.ts", import.meta.url),
    "utf8",
  );
  const localWorkspaceDeclaration = sourceDeclaration(
    workspaceSource,
    "resolveLocalWorkspaceAccess",
  );
  const templateSource = fs.readFileSync(
    new URL("../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const routingDeclaration = sourceDeclaration(
    templateSource,
    "createLocalMcpDependencies",
  );
  const localDefinitionDeclaration = sourceDeclaration(
    fs.readFileSync(
      new URL("../../src/service/execution.ts", import.meta.url),
      "utf8",
    ),
    "resolveLocalDefinitionAccess",
  );
  const capability = {};
  const root = "fixture-root";
  for (const owner of ["workbench", "mcp"] as const) {
    for (const condition of [
      "same",
      "changed",
      "missing",
      "blocked",
      "root",
      "cancelled",
    ] as const) {
      let reads = 0;
      let currentRoot: string | null = root;
      let current: unknown = {
        status: "ready",
        identity: "original-bytes-hash",
        manifest: { repositoryId: "repository.fixture", projectId: "project" },
      };
      const signal = { aborted: false };
      const read = () => {
        reads++;
        return current;
      };
      let authorize: () => boolean;
      if (owner === "workbench") {
        const resolveAccess = new Function(
          "getRepository",
          "readRepositoryManifest",
          "resolveVerifiedRepositoryRoot",
          `${localWorkspaceDeclaration};return resolveLocalWorkspaceAccess;`,
        )(
          () => ({ status: "completed", capability }),
          read,
          () => currentRoot,
        );
        const context = resolveAccess(root, "repository.fixture", signal);
        assert.ok(context);
        assert.equal(reads, 1, "Workbenchは初回に対象Manifestを読む");
        authorize = context.authorize;
      } else {
        const makeRouting = new Function(
          "getRepository",
          "readRepositoryManifest",
          "resolveVerifiedRepositoryRoot",
          "resolveVerifiedRepositoryRootFromWorkingDirectory",
          "createTopicOperations",
          "createMeetingOperations",
          "readGitUser",
          "createLocalPrincipalId",
          "createDefinitionAccess",
          `${localDefinitionDeclaration};${routingDeclaration};return createLocalMcpDependencies;`,
        )(
          () => ({
            status: "completed",
            capability,
            placement: { directory: root },
          }),
          read,
          () => currentRoot,
          () => root,
          () => ({}),
          () => ({}),
          () => ({ status: "completed", email: "test@example.invalid" }),
          () => "local-principal",
          createDefinitionAccess,
        );
        const routing = makeRouting(root);
        const context = routing.runtimeDefinition("repository.fixture", signal);
        assert.ok(context);
        assert.equal(reads, 1, "MCPの初回Contextは実workspace Closureで読む");
        authorize = () =>
          context.revalidate("definition.read", { projectId: "project" });
      }
      reads = 0;
      if (condition === "changed")
        current = { status: "ready", identity: "changed-bytes-hash" };
      if (condition === "missing")
        current = { status: "missing", reason: "repository_manifest_missing" };
      if (condition === "blocked")
        current = {
          status: "blocked",
          reason: "repository_manifest_unavailable",
        };
      if (condition === "root") currentRoot = "different-root";
      if (condition === "cancelled") signal.aborted = true;
      for (let call = 1; call <= 2; call++) {
        assert.equal(
          authorize(),
          condition === "same",
          `${owner}:${condition}`,
        );
        const expectedReads =
          condition === "root" || condition === "cancelled" ? 0 : call;
        assert.equal(reads, expectedReads, `${owner}:${condition}:Reader`);
      }
    }
  }
});

/**
 * 公開binの既定Core構成と明示Automation構成を区別する。
 * @responsibility Library起動だけでbinの依存閉包を成立扱いしない。
 * @trace PRL-IT-012
 * @precondition Library・公開HTTPの実接続は上段で別途確認する。
 * @stimulus 専門Ownerだけを有限代役へ差し替え、実binへ各引数を渡す。
 * @observation load・Session構成回数、help、終了値。
 * @oracle 既定load零、明示時だけ一回、重複と不正形式64。
 * @cleanup 子Process終了をjoinする。Filesystem生成なし。
 * @boundary binの構成だけ。代役からAI・AM・保存の成立を推定しない。
 */
test("Server binは既定で統合しAI Sessionを起動だけでは作らない", async () => {
  const entry = new URL("../../bin/crdd-server.ts", import.meta.url).href;
  const command = new URL("../../src/cli/command.ts", import.meta.url).href;
  const run = (args: string[]) => {
    try {
      return {
        status: 0,
        output: execFileSync(
          process.execPath,
          [
            "--eval",
            `
      import {registerHooks} from 'node:module';
      const entry=${JSON.stringify(entry)};
      const command=${JSON.stringify(command)};
      const moduleUrl=s=>'data:text/javascript,'+encodeURIComponent(s);
      registerHooks({resolve(s,c,n){
        if(c.parentURL===command&&s==='../transport/mcp-server.ts')return {shortCircuit:true,url:moduleUrl("export const createMcpServerFactory=()=>({});export const readMcpServerConfiguration=async()=>({})")};
        if(c.parentURL===command&&s==='../transport/mcp-stdio.ts')return {shortCircuit:true,url:moduleUrl("export const runMcpStdio=async()=>({status:'completed',cleanupConfirmed:true})")};
        if(c.parentURL===command&&s==='../app.ts')return {shortCircuit:true,url:moduleUrl("export async function readProjectViewData(){return {context:{projectId:'fixture'}}};export async function readWorkbenchServerConfiguration(){return {}};const ready=label=>{process.stdout.write(label+'|');setImmediate(()=>process.emit('SIGTERM'));return {publicUrl:'http://127.0.0.1:1',close:async()=>{}}};export async function startWorkbench(input){if(input.apiDocumentation&&input.aiRequests)throw Error('docs_ai');return ready(input.apiDocumentation?'DOCS_STARTED':'CORE_STARTED')};export async function startCrddServer(input){if(!input.localAccessRoot||!input.mcpOAuth||!input.loginProviders?.google||input.gitHosts?.[0]?.provider!=='github')throw Error('shared_missing');if(input.sharedAiRequestsFactory)input.sharedAiRequestsFactory({},'fixture','host',()=>true);return ready('SHARED_STARTED')}")};
        if(c.parentURL===command&&s==='./environment.ts')return {shortCircuit:true,url:moduleUrl("export const consumeOAuthEnvironment=(_environment,shared)=>shared?{loginProviders:{google:{clientId:'synthetic-cli',clientSecret:'synthetic-secret'}},mcpOAuth:{},gitHosts:[{provider:'github',host:'github.com',providerData:{clientId:'synthetic-cli',clientSecret:'synthetic-git-secret'}}]}:undefined;")};
        if(c.parentURL===command&&s==='@qual-lab/crdd-access-management')return {shortCircuit:true,url:moduleUrl("export const resolveHostRootInput=()=>({});export const readExistingHostRoot=()=>({});export const readHostInitializationState=(_root,{acceptsAdministratorIssuer})=>({status:'existing',administratorLinked:acceptsAdministratorIssuer('https://accounts.google.com')&&!acceptsAdministratorIssuer('https://fixture.invalid')});")};
        if(s==='@qual-lab/crdd-coordinator')return {shortCircuit:true,url:moduleUrl("process.stdout.write('AUTOMATION_LOADED|');export function openTaskSession(input){if(!input.rootCapability||!input.authorize())throw Error('binding');process.stdout.write('SESSION_CREATED|');return {}}")};
        if(s.includes('coordinator/'))throw Error('coordinator_source_path_not_allowed');
        return n(s,c);
      }});
      process.argv=['node',new URL(entry).pathname,...${JSON.stringify(args)}];
      await import(entry);
    `,
          ],
          {
            cwd: path.resolve(import.meta.dirname, "../../../.."),
            encoding: "utf8",
            stdio: "pipe",
            timeout: 10000,
            windowsHide: true,
          },
        ),
      };
    } catch (error) {
      const child = error as { status: number; stdout: string; stderr: string };
      return {
        status: child.status,
        output: child.stdout,
        error: child.stderr,
      };
    }
  };
  for (const args of [[], ["--shared"]]) {
    const result = run(args);
    assert.equal(result.status, 0, JSON.stringify(result));
    assert.match(
      result.output,
      args.length ? /SHARED_STARTED/u : /CORE_STARTED/u,
    );
    assert.doesNotMatch(result.output, /AUTOMATION_LOADED|SESSION_CREATED/u);
  }
  assert.equal(run(["--automation"]).status, 64);
  assert.equal(run(["--cros"]).status, 64);
  assert.equal(run(["--port", "0", "--shared", "--docs"]).status, 64);
  const docs = run(["--docs", "--mcp-stdio"]);
  assert.equal(docs.status, 0);
  assert.doesNotMatch(docs.output, /AUTOMATION_LOADED|SESSION_CREATED/u);
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.output, /crdd-server \[--shared \| --mcp-stdio\]/u);
  assert.doesNotMatch(help.output, /AUTOMATION_LOADED|CORE_STARTED/u);

  const declaration = sourceDeclaration(
    fs.readFileSync(
      new URL("../../src/cli/command.ts", import.meta.url),
      "utf8",
    ),
    "createAiRequests",
  ).replace(
    /await import\(\s*"@qual-lab\/crdd-coordinator"\s*,?\s*\)/u,
    "await loadCoordinator()",
  );
  assert.ok(declaration.includes("await loadCoordinator()"));
  const createAiRequests = new Function(
    "loadCoordinator",
    `${declaration};return createAiRequests;`,
  );
  let releaseLoad!: () => void;
  let reportLoad!: () => void;
  const seenLoad = new Promise<void>((resolve) => {
    reportLoad = resolve;
  });
  const allowLoad = new Promise<void>((resolve) => {
    releaseLoad = resolve;
  });
  let initializations = 0;
  const received: (AbortSignal | undefined)[] = [];
  const recovered: string[] = [];
  const create = createAiRequests(async () => {
    reportLoad();
    await allowLoad;
    return {
      openTaskSession() {
        initializations++;
        return {
          start(_request: unknown, signal?: AbortSignal) {
            received.push(signal);
            return { status: "accepted", requestId: "fixture", reason: null };
          },
          observe(requestId: string) {
            assert.equal(requestId, "saved-before-restart");
            recovered.push("observe");
            return { requestId, status: "running" };
          },
          cancel(requestId: string) {
            assert.equal(requestId, "saved-before-restart");
            recovered.push("cancel");
            return { requestId, status: "cancelled" };
          },
          async close() {},
        };
      },
    };
  });
  const requests = create(() => ({
    principalId: "fixture",
    authorize: () => true,
  }));
  const cancelled = new AbortController();
  const pending = requests.start({}, cancelled.signal);
  await seenLoad;
  cancelled.abort();
  releaseLoad();
  assert.equal((await pending).status, "blocked");
  assert.equal(initializations, 0);
  const live = new AbortController();
  const next = new AbortController();
  assert.equal((await requests.start({}, live.signal)).status, "accepted");
  assert.equal((await requests.start({}, next.signal)).status, "accepted");
  assert.equal(initializations, 1);
  assert.equal(received.length, 2);
  assert.equal(received[0], live.signal);
  assert.equal(received[1], next.signal);
  await requests.close();
  for (const operation of ["observe", "cancel"] as const) {
    const reopened = create(() => ({
      principalId: "fixture",
      authorize: () => true,
    }));
    const result = await reopened[operation](
      "saved-before-restart",
      live.signal,
    );
    assert.equal(result.requestId, "saved-before-restart");
    await reopened.close();
  }
  assert.equal(initializations, 3);
  assert.deepEqual(recovered, ["observe", "cancel"]);
  assert.equal(received.length, 2);
});

/**
 * 確定した単体の対象からDomainの実保存までを結合する。
 * @responsibility 認可Contextの模擬成功と本番Writer接続を区別する。
 * @trace RFD-IT-013
 * @precondition 自己生成の管理StoreとGit構造だけを使う。
 * @stimulus 明示初期化・Plan保存・再読取りを同じ要求Contextで行う。
 * @observation 保存結果、再読取り、各操作の有限計測。
 * @oracle 起動対象だけで同じDomain Writerへ接続し、認可区画を変更しない。
 * @cleanup 既存Fixtureが今回のRootだけを回収する。
 * @boundary 確定した単体リポジトリ→Domain実Writerと既存OS排他。
 */
test("Core定義Contextを実Writerの初期化・Plan保存・再読取りへ接続する", async (t) => {
  const f = contentFixture(t);
  const signal = new AbortController().signal;
  execFileSync("git", ["init", "--quiet", f.target.directory], {
    windowsHide: true,
  });
  execFileSync(
    "git",
    [
      "-C",
      f.target.directory,
      "config",
      "--local",
      "user.email",
      "fixture@example.invalid",
    ],
    {
      windowsHide: true,
    },
  );
  fs.writeFileSync(
    path.join(f.target.directory, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(f.target.directory, ".git", "refs", "heads", "main"),
    `${"1".repeat(40)}\n`,
  );
  const repository = getRepository(f.target.directory);
  assert.equal(repository.status, "completed");
  await t.test(
    "共有セッションがない定義保存は本文を読まない",
    async (context) => {
      const origin = new URL("http://127.0.0.1:3000");
      const socket = new Socket();
      context.after(() => socket.destroy());
      const incoming = new IncomingMessage(socket);
      incoming.method = "PUT";
      incoming.url = `/api/repositories/${f.target.manifest.repositoryId}/projects/${f.target.manifest.projectId}/milestones/milestone.fixture/plan`;
      incoming.headers = {
        host: origin.host,
        origin: origin.origin,
        "content-type": "application/json",
      };
      incoming.headersDistinct = {
        host: [origin.host],
        origin: [origin.origin],
        "content-type": ["application/json"],
      };
      const readBody = context.mock.method(incoming, "iterator", () =>
        assert.fail("共有セッション確認前に本文を読んだ"),
      );
      const readGitHostLinkedSession = context.mock.fn(() => null);
      const handler = createExecutionDefinitionHandler({
        getOrigin: () => origin,
        capability: repository.capability,
        accessRoot: f.root,
        readGitHostLinkedSession,
      });
      const response = new ServerResponse(incoming);
      await handler(incoming, response, signal);
      assert.equal(response.statusCode, 403);
      assert.equal(readGitHostLinkedSession.mock.callCount(), 1);
      assert.equal(readBody.mock.callCount(), 0);
      assert.equal(
        fs.existsSync(
          path.join(f.target.directory, ".crdd", "execution-model"),
        ),
        false,
      );
    },
  );
  assert.equal(
    resolveLocalDefinitionAccess(
      repository.capability,
      "repository.other",
      signal,
    ),
    null,
  );
  const access = resolveLocalDefinitionAccess(
    repository.capability,
    f.target.manifest.repositoryId,
    signal,
  );
  assert.ok(access);
  const target = {
    projectId: f.target.manifest.projectId,
    milestoneId: "milestone.test",
  };
  const before = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
  );
  const started = performance.now();
  const initial = initializeExecutionState(access, {
    ...target,
    expectedAbsence: true,
  });
  const initializedAt = performance.now();
  assert.equal(initial.status, "saved", JSON.stringify(initial));
  if (initial.status !== "saved") return;
  let revisionReads = 0;
  const observedAccess = {
    ...access,
    readInitialPlanRevision: () => {
      revisionReads++;
      return access.readInitialPlanRevision();
    },
  };
  const input = {
    ...target,
    expected: initial.version,
    expectedDefinitionHash: null,
    definition: {
      milestoneAcceptanceCriteria: ["確認"],
      objectives: [{ id: "objective", acceptanceCriteria: ["確認"] }],
      tasks: [
        {
          id: "task",
          objectiveId: "objective",
          dependencies: [],
          allowedPaths: ["src/code.ts"],
          conflictKeys: [],
        },
      ],
    },
  };
  const saved = executeDefinitionOperation(observedAccess, {
    operation: "plan.save",
    input,
  }) as ReturnType<typeof savePlan>;
  const savedAt = performance.now();
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  const read = queryPlan(access, target);
  assert.equal(read.status, "available", JSON.stringify(read));
  assert.equal(revisionReads, 1);
  if (read.status !== "available") return;
  fs.unlinkSync(path.join(f.target.directory, ".git", "refs", "heads", "main"));
  const updated = executeDefinitionOperation(observedAccess, {
    operation: "plan.save",
    input: {
      ...input,
      expected: read.version,
      expectedDefinitionHash: read.value.definitionHash,
      definition: {
        ...input.definition,
        milestoneAcceptanceCriteria: ["変更"],
      },
    },
  });
  assert.equal(
    (updated as ReturnType<typeof savePlan>).status,
    "saved",
    JSON.stringify(updated),
  );
  assert.equal(revisionReads, 1);
  assert.deepEqual(
    fs.readFileSync(path.join(f.directory, "access-management.json")),
    before,
  );
  t.diagnostic(
    JSON.stringify({
      initializeMs: Math.round(initializedAt - started),
      saveMs: Math.round(savedAt - initializedAt),
      readMs: Math.round(performance.now() - savedAt),
    }),
  );
});
