/**
 * Coordinatorを読めないWorkbenchでCore定義を保存する。
 * @packageDocumentation
 * @responsibility 公開Root・HTTP・実Domain Writerと再読取りを一つの合成Repositoryで確認する。
 * @trace PRL-IT-012
 * @level IT
 * @scope Core初期化・定義CRUD・CAS・入力拒否・Server終了。
 * @boundary 子ProcessのWorkbench HTTPからDomain保存。実AI・Dockerは対象外。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRepositoryTestDirectory } from "../../../domain-model/tests/support/repository-test-directory.ts";

/**
 * 非導入の実行機能を読込拒否しても定義を編集できる。
 * @responsibility 公開起動とHTTP搬送・CAS・永続再読取りの実接続を検証する。
 * @trace PRL-IT-012
 * @precondition 自己生成Git Repositoryと合成Contextだけ。
 * @stimulus Coordinator/Executor解決拒否下で起動・初期化・Plan保存・Task CRUD・再起動する。
 * @observation HTTP結果・版・拒否・子Process終了と専用stateの存在。
 * @oracle Domain値を保存し、古いCASと不正Tokenは拒否、再起動後に同じ定義を読む。
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
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
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
  const module = new URL("../../src/index.ts", import.meta.url).href;
  const output = execFileSync(
    process.execPath,
    [
      "--eval",
      `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    registerHooks({resolve(s,c,n){if(s.includes('coordinator/')||s.includes('executor/'))throw new Error('automation_unavailable');return n(s,c);}});
    const {startWorkbench}=await import(${JSON.stringify(module)});
    let server=await startWorkbench({workingDirectory:${JSON.stringify(root)}});
    const target={projectId:'project.fixture',milestoneId:'milestone'};
    const write=async(command,token)=>{
      const response=await fetch(server.baseUrl+'/api/runtime-definition',{method:'POST',headers:{origin:server.baseUrl,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({actionToken:token,command:JSON.stringify({...target,...command})})});
      return {status:response.status,value:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};
    };
    const query=async()=>{const r=await fetch(server.baseUrl+'/api/runtime-definition?'+new URLSearchParams({...target,operation:'plan'}));assert.equal(r.status,200);return r.json();};
    try{
      const view=await(await fetch(server.baseUrl+'/api/workbench-view')).json();
      const token=view.actionToken;assert.equal(typeof token,'string');
      assert.equal((await write({operation:'initialize',expectedAbsence:true},'wrong')).status,400);
      const initial=(await write({operation:'initialize',expectedAbsence:true},token)).value;assert.equal(initial.status,'saved',JSON.stringify(initial));
      const plan={milestoneAcceptanceCriteria:['確認'],objectives:[{id:'objective',acceptanceCriteria:['確認']}],tasks:[{id:'task',objectiveId:'objective',dependencies:[],allowedPaths:['code.ts'],conflictKeys:[]}]};
      const saved=(await write({operation:'plan.save',expected:initial.version,expectedDefinitionHash:null,definition:plan},token)).value;assert.equal(saved.status,'saved',JSON.stringify(saved));
      assert.equal((await write({operation:'plan.save',expected:initial.version,expectedDefinitionHash:null,definition:plan},token)).value.status,'conflict');
      const created=(await write({operation:'task.create',expected:saved.version,definition:{id:'extra',objectiveId:'objective',dependencies:[],allowedPaths:['extra.ts'],conflictKeys:[]}},token)).value;assert.equal(created.status,'saved',JSON.stringify(created));
      const deleted=(await write({operation:'task.delete',expected:created.version,taskId:'extra',expectedDefinitionHash:created.value.definitionHash},token)).value;assert.equal(deleted.status,'saved',JSON.stringify(deleted));
      const large={...plan,tasks:Array.from({length:128},(_,i)=>({id:'large-'+i,objectiveId:'objective',dependencies:[],allowedPaths:Array.from({length:128},(_,j)=>'src/'+i+'-'+j+'-'+ 'p'.repeat(200)),conflictKeys:[]}))};
      assert.ok(Buffer.byteLength(JSON.stringify(large))>3*1024*1024);
      const largeSaved=(await write({operation:'plan.save',expected:deleted.version,expectedDefinitionHash:deleted.value.definitionHash??(await query()).value.definitionHash,definition:large},token)).value;
      assert.equal(largeSaved.status,'saved',JSON.stringify(largeSaved));
      const before=await query();assert.equal(before.status,'available');
      const {request}=await import('node:http');
      const rejected=await new Promise((resolve,reject)=>{const r=request(server.baseUrl+'/api/runtime-definition',{method:'POST',headers:{origin:server.baseUrl,'content-type':'application/x-www-form-urlencoded','content-length':3*16777216+16385}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});r.on('error',reject);r.end();});
      assert.equal(rejected,403);assert.deepEqual(await query(),before);
      await server.close();server=await startWorkbench({workingDirectory:${JSON.stringify(root)}});
      assert.deepEqual(await query(),before);
    }finally{await server.close();}
    await assert.rejects(fetch(server.baseUrl+'/.well-known/crdd-workbench-health'));
    process.stdout.write('workbench_core_crud_passed');
  `,
    ],
    { encoding: "utf8", stdio: "pipe", timeout: 60000, windowsHide: true },
  );
  assert.equal(output, "workbench_core_crud_passed");
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "domain-model", "state.json")),
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
test("任意Owner待機後の失効・取消は設定Readerを発行しない", async () => {
  for (const shared of [false, true]) {
    const source = fs.readFileSync(
      new URL(
        shared
          ? "../../src/server/routes/shared-view.ts"
          : "../../src/server/routes/repository-view.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const start = source.indexOf("const owner = await import(");
    const end = source.indexOf(
      "\n",
      source.indexOf("network = owner.readRepositoryNetworkPolicies(", start),
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
      const currentCollection = {};
      const run = new AsyncFunction(
        "gate",
        "requestSignal",
        "response",
        "resolveVerifiedRepositoryRoot",
        "capability",
        "repositoryRoot",
        "sameAccessCollection",
        "currentCollection",
        "resolveRepositoryAccessCollection",
        "credentialAdministration",
        "selected",
        `let network=null;${segment};return network;`,
      );
      const result = run(
        gate,
        requestSignal,
        response,
        () => (live ? repositoryRoot : null),
        capability,
        repositoryRoot,
        () => live,
        currentCollection,
        () => currentCollection,
        { root: {}, token: "synthetic" },
        { root: capability },
      );
      if (condition === "aborted") requestSignal.aborted = true;
      if (condition === "destroyed") response.destroyed = true;
      if (condition === "revoked") live = false;
      release({
        readRepositoryNetworkPolicies() {
          reads++;
          return {};
        },
      });
      if (condition === "revoked") await assert.rejects(result);
      else await result;
      assert.equal(reads, condition === "live" ? 1 : 0);
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
test("Workbench binは既定Coreだけを構成しAutomationを明示時だけ読む", () => {
  const entry = new URL("../../bin/workbench-server.ts", import.meta.url).href;
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
      const moduleUrl=s=>'data:text/javascript,'+encodeURIComponent(s);
      registerHooks({resolve(s,c,n){
        if(c.parentURL===entry&&s==='../src/index.ts')return {shortCircuit:true,url:moduleUrl("export async function readWorkbenchProjectSurface(){return {context:{projectId:'fixture'}}};export async function readWorkbenchServerConfiguration(){return {}};export async function startWorkbench(input){if(input.sharedAiRequestsFactory)input.sharedAiRequestsFactory({},'fixture','host',()=>true);process.stdout.write('CORE_STARTED|');return {publicUrl:'http://127.0.0.1:1',close:async()=>{}}}")};
        if(c.parentURL===entry&&s.includes('access-management/src/index.ts'))return {shortCircuit:true,url:moduleUrl("export const resolveHostRootInput=()=>({});export const readExistingHostRoot=()=>({});export const readHostInitializationState=()=>({status:'completed'});")};
        if(s.includes('coordinator/src/index.ts'))return {shortCircuit:true,url:moduleUrl("process.stdout.write('AUTOMATION_LOADED|');export function openTaskSession(input){if(!input.rootCapability||!input.authorize())throw Error('binding');process.stdout.write('SESSION_CREATED|');return {}}")};
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
  for (const args of [[], ["--cros"]]) {
    const result = run(args);
    assert.equal(result.status, 0, JSON.stringify(result));
    assert.match(result.output, /CORE_STARTED/u);
    assert.doesNotMatch(result.output, /AUTOMATION_LOADED|SESSION_CREATED/u);
  }
  for (const args of [["--automation"], ["--cros", "--automation"]]) {
    const result = run(args);
    assert.equal(result.status, 0);
    assert.equal(result.output.match(/AUTOMATION_LOADED/gu)?.length, 1);
    assert.equal(result.output.match(/SESSION_CREATED/gu)?.length, 1);
  }
  assert.equal(run(["--automation", "--automation"]).status, 64);
  assert.equal(run(["--port", "0", "--cros"]).status, 64);
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(
    help.output,
    /workbench-server \[--cros\] \[--automation\] \[--port <port>\]/u,
  );
  assert.doesNotMatch(help.output, /AUTOMATION_LOADED|CORE_STARTED/u);
});
