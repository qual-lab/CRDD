/**
 * 実Browserで鍵管理・通常管理と資格付きCSR画面遷移の現在投影を検証する。
 * @packageDocumentation
 * @responsibility 本番CSRの操作・表示・消去を自己生成AM Rootと専用Chromeで観測する。
 * @trace RFD-ST-016
 * @trace RFD-ST-004
 * @trace RFD-ST-003
 * @trace ERB-ST-022
 * @trace RFD-ST-022
 * @trace RFD-ST-015
 * @trace EST-ST-013
 * @trace RCM-ST-012
 * @trace CPR-ST-005
 * @level ST
 * @scope 同Process鍵管理、Standalone／CROS通常管理、三つの自己生成Repositoryの既知GET遷移と選択Root相関、直接接続の内容保存・昇格・Outcome処置と直接接続Git操作と未接続AIの無効表示、native操作非横取り、遅延応答拒否、接続中pagehide取消と資格なし再開、専用POST、秘密非保持、所有資源回収。
 * @boundary Workbench本番Server→本番Bundle→専用Browser→AM保存Owner。成果物原文は同じ選択Rootに相関し、文字列表示・履歴移動・遅延拒否・再読込後の再接続を観測する。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs, { existsSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import {
  createCredentialMaterial,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/state/repository-binding.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  closeOwnedBrowserProcessTree,
  observeLocalListener,
} from "../../../visual-preview/src/browser/verify-visual.ts";
import { startWorkbench } from "../../src/index.ts";
import {
  createCrosAiProfileCatalogStore,
  createAiProfileCatalogAdministration,
} from "../../../ai-adapter/src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 試験内の固定Rootを先行試験なしで準備する。
 * @responsibility `.crdd/tests`の欠測親を含めて作成する。
 * @trace RFD-ST-016
 * @input 検証済みRepository RootまたはRepository-localの自己生成反証Root。
 * @returns 入力Root直下のexact `.crdd/tests` Path。
 * @precondition Rootは当該試験の許可範囲で、外部入力を受け取らない。
 * @postcondition 固定Rootが存在し、共有Rootの削除・改名を行わない。
 * @effect 固定Directoryのmkdirだけ。
 * @failure 作成不能は例外で停止し、別Rootへfallbackしない。
 * @invariant 本helperはRoot IdentityやFilesystem Authorityを発行しない。
 * @boundary 試験の開始準備とRepository-local Filesystem。
 * @security OS一時領域・Host管理領域を使用しない。
 * @concurrency 既存Directoryは再利用し、各modeの専用Directoryはmkdtempで分離する。
 */
async function prepareCredentialBrowserTestRoot(root: string): Promise<string> {
  const testRoot = path.join(root, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  return testRoot;
}

/**
 * 専用Chromeの起動相関を私有Profileから取得する。
 * @responsibility 未完成Fileと終了済みProcessを起動成功へ変換しない。
 * @trace RFD-ST-016
 * @input 自己生成Profileと所有ChildProcess。
 * @returns localhost portとBrowser終了用Path。
 * @precondition remote-debugging-port=0で当該Profileを使用して起動済み。
 * @postcondition 機密・Protocol本文を記録しない。
 * @effect DevToolsActivePortを有限時間再観測する。
 * @failure 30秒、Process終了、不正相関では固定Error。
 * @invariant 通常Browserや既存Profileへ接続しない。
 * @boundary 専用Browserと自己生成Filesystem。
 * @security Endpointをログへ出さない。
 * @concurrency BrowserのFile確定まで100ms間隔で再観測する。
 */
async function readBrowserEndpoint(profile: string, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error("credential_browser_exited");
    try {
      const [portText, browserPath] = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      )
        .trim()
        .split(/\r?\n/u);
      const port = Number(portText);
      if (
        Number.isInteger(port) &&
        port > 0 &&
        browserPath?.startsWith("/devtools/browser/")
      )
        return { port, browserPath };
    } catch {
      /* 起動中の未完成Fileだけ再観測する。 */
    }
    await delay(100);
  }
  throw new Error("credential_browser_start_timeout");
}

/**
 * 所有Browserの固定CDP要求を一回だけ送る。
 * @responsibility 応答相関・期限・WebSocket終了を所有し、例外本文や秘密を返さない。
 * @trace RFD-ST-016
 * @input 同じ操作のlocalhost Endpoint、固定methodとparams、任意Profile表示領域、固定の単一／複合評価区分。
 * @returns Runtime評価のboolean／counter／非秘密寸法。その他はtrue。
 * @precondition 利用者入力・Network本文・Header・画像を要求しない。
 * @postcondition WebSocketのclose後だけ完了する。
 * @effect Runtime評価、再読込またはBrowser正常終了。Profile時は表示領域設定と固定Tab操作。
 * @failure 期限・Protocol・評価失敗は機密を含まない固定Error。
 * @invariant CDPの例外descriptionや任意Response本文をログへ搬送しない。
 * @boundary 試験専用localhost DevTools。
 * @security 鍵比較はBrowser内だけで行う。
 * @concurrency 通常はID1、Profileは同一接続内でID0設定→1計測／focus→2 keyDown→3 keyUp→4 focus確認を順次受理し、成功・失敗ともcloseでTimerを回収する。
 */
async function requestBrowser(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
  viewport?: Readonly<{ width: number; height: number }>,
  evaluation: "single" | "composite" = "single",
): Promise<unknown> {
  const socket = new WebSocket(url);
  return await new Promise((resolve, reject) => {
    let sent = false,
      settled = false,
      outcome: unknown,
      failure: Error | null = null;
    let expectedViewportId = 0;
    const timer = setTimeout(
      () => {
        failure = new Error("credential_browser_protocol_timeout");
        socket.close();
      },
      method === "Runtime.evaluate" && evaluation === "composite"
        ? 60_000
        : 25_000,
    );
    socket.addEventListener("open", () => {
      sent = true;
      socket.send(
        JSON.stringify(
          viewport === undefined
            ? { id: 1, method, params }
            : {
                id: 0,
                method: "Emulation.setDeviceMetricsOverride",
                params: {
                  width: viewport.width,
                  height: viewport.height,
                  deviceScaleFactor: 1,
                  mobile: false,
                },
              },
        ),
      );
    });
    socket.addEventListener("message", (event) => {
      try {
        const reply = JSON.parse(String(event.data));
        if (viewport !== undefined && !settled) {
          if (reply.id !== expectedViewportId) return;
          if (reply.error || reply.result?.exceptionDetails) {
            failure = new Error("credential_browser_viewport_unavailable");
            socket.close();
            return;
          }
          expectedViewportId += 1;
          if (reply.id === 0)
            socket.send(JSON.stringify({ id: 1, method, params }));
          else if (reply.id === 1) {
            outcome = reply.result?.result?.value;
            socket.send(
              JSON.stringify({
                id: 2,
                method: "Input.dispatchKeyEvent",
                params: {
                  type: "keyDown",
                  key: "Tab",
                  code: "Tab",
                  windowsVirtualKeyCode: 9,
                },
              }),
            );
          } else if (reply.id === 2)
            socket.send(
              JSON.stringify({
                id: 3,
                method: "Input.dispatchKeyEvent",
                params: {
                  type: "keyUp",
                  key: "Tab",
                  code: "Tab",
                  windowsVirtualKeyCode: 9,
                },
              }),
            );
          else if (reply.id === 3)
            socket.send(
              JSON.stringify({
                id: 4,
                method: "Runtime.evaluate",
                params: {
                  expression:
                    "document.activeElement?.getAttribute('name')==='adapterModel'",
                  returnByValue: true,
                },
              }),
            );
          else {
            if (
              outcome === null ||
              typeof outcome !== "object" ||
              Array.isArray(outcome)
            )
              throw new Error("credential_browser_viewport_result_invalid");
            outcome = {
              ...outcome,
              keyboardNext: reply.result?.result?.value === true,
            };
            settled = true;
            socket.close();
          }
          return;
        }
        if (reply.id !== 1 || settled) return;
        settled = true;
        if (reply.error || reply.result?.exceptionDetails) {
          const diagnostic = String(
            reply.error?.message ??
              reply.result?.exceptionDetails?.exception?.description ??
              "",
          );
          failure = new Error(
            diagnostic.includes("Execution context was destroyed") ||
              diagnostic.includes("Cannot find context")
              ? "credential_browser_context_replaced"
              : "credential_browser_evaluation_failed",
          );
        } else
          outcome =
            method === "Runtime.evaluate" ? reply.result?.result?.value : true;
      } catch {
        failure = new Error("credential_browser_protocol_invalid");
      }
      socket.close();
    });
    socket.addEventListener("error", () => {
      failure ??= new Error("credential_browser_protocol_failed");
      socket.close();
    });
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (settled || (method === "Browser.close" && sent))
          resolve(outcome ?? true);
        else reject(new Error("credential_browser_response_missing"));
      },
      { once: true },
    );
  });
}

/**
 * 本番CSRの操作反証を固定Browser式へ構成する。
 * @responsibility 鍵をDOMと同じBrowser内でだけ比較し、非秘密判定だけ返す。
 * @trace RFD-ST-016
 * @input 試験内固定のissue／self／all選択。
 * @returns 操作・表示・非保持・失敗処置の固定式。
 * @precondition 本番Bundleが同じlocalhost画面へ配信される。
 * @postcondition 生成鍵をNode、console、画像、storageへ保存しない。
 * @effect 本番Formをsubmitし、用途限定通信失敗をBrowser内で一度注入する。
 * @failure 必須DOM未成立は固定Error。本文や秘密は返さない。
 * @invariant 手動受付Route・ACK・再表示APIを追加しない。
 * @boundary 専用Browserの本番DOMとfetch。
 * @security 要求/応答Bodyの比較はBrowser内のみで、結果はboolean/counter。
 * @concurrency 重複submitの一要求化と次操作開始時の消去を観測する。
 */
function credentialBrowserExpression(mode: "issue" | "self" | "all"): string {
  return `(async () => {
    const mode = ${JSON.stringify(mode)};
    const waitFor = async (condition) => { const end = Date.now() + 15000; while(Date.now() < end) { if(condition()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
    if(!await waitFor(() => document.querySelector('#credential-administration form'))) throw new Error('credential_browser_dom_unavailable');
    const originalFetch = window.fetch.bind(window);
    let posts = 0, deliveredKey = '', failNext = false;
    window.fetch = async (...args) => {
      const requestUrl = new URL(String(args[0]), location.href);
      if(requestUrl.origin === location.origin && requestUrl.pathname === '/connection-credentials/action') {
        posts++;
        if(failNext) throw new Error('synthetic_connection_failure');
        const response = await originalFetch(...args);
        const result = await response.clone().json();
        if(result.status === 'presenting' && typeof result.token === 'string') deliveredKey = result.token;
        return response;
      }
      return originalFetch(...args);
    };
    const operation = mode === 'issue' ? 'issue' : mode === 'self' ? 'exchange-user' : 'exchange-all';
    const userId = mode === 'issue' ? '00000000-0000-4000-8000-000000000004' : '00000000-0000-4000-8000-000000000003';
    const selectForm = () => Array.from(document.querySelectorAll('#credential-administration form')).find(f => f.elements.namedItem('operation')?.value === operation && f.elements.namedItem('userId')?.value === userId);
    const form = selectForm(); if(!form) throw new Error('credential_browser_form_unavailable');
    if(mode === 'all') form.elements.namedItem('confirmed').checked = true;
    form.requestSubmit(); form.requestSubmit();
    const shown = await waitFor(() => deliveredKey && document.querySelector('.one-time-token code')?.textContent === deliveredKey);
    const firstPostOnce = posts === 1;
    const model = await (await originalFetch('/api/workbench-view', { cache:'no-store' })).json();
    const getSecretAbsent = deliveredKey !== '' && !JSON.stringify(model).includes(deliveredKey);
    const urlSecretAbsent = deliveredKey !== '' && !location.href.includes(deliveredKey);
    const storageSecretAbsent = localStorage.length === 0 && sessionStorage.length === 0;
    let previousCleared = true, failedResponseNoSuccess = true, oldConnectionUnavailable = true;
    if(mode === 'issue') {
      await waitFor(() => !selectForm()?.querySelector('button')?.disabled);
      failNext = true; selectForm().requestSubmit();
      previousCleared = await waitFor(() => !document.querySelector('.one-time-token code'));
      failedResponseNoSuccess = await waitFor(() => document.querySelector('#credential-administration [role=status]')?.textContent?.includes('操作または現在状態の確認を完了できません'));
    } else {
      oldConnectionUnavailable = model.credentials.state === 'unavailable' && await waitFor(() => document.querySelectorAll('#credential-administration form').length === 0);
    }
    window.fetch = originalFetch;
    deliveredKey = '';
    return { shown, firstPostOnce, getSecretAbsent, urlSecretAbsent, storageSecretAbsent, previousCleared, failedResponseNoSuccess, oldConnectionUnavailable, postCount: posts };
  })()`;
}

/**
 * 通常管理Formの保存と現在投影を固定Browser式で確認する。
 * @responsibility 明示送信の一要求化、再描画・Focus・非秘密保持、manager自己内容変更後の内容拒否と管理継続を観測する。
 * @trace RFD-ST-022
 * @trace EST-ST-013
 * @input CROS表示反証の適用有無、自己生成資格による再接続材料、親Caseが回収する登録試験Root。
 * @returns booleanと要求回数を返す固定式。
 * @precondition 本番CSRの管理Formが描画済み。
 * @postcondition User IDや応答本文をNodeへ返さず、登録直後の未公開と自己内容拒否をbooleanで返す。
 * @effect ユーザー・Role四回とRepository登録・公開・解除三回の実保存。CROSだけ固定結果／応答喪失をBrowser内で注入する。
 * @failure 15秒内の再描画未成立は固定例外。
 * @invariant 鍵を発行せず、再送・新Sessionを追加しない。
 * @boundary 本番DOMと同Origin管理POST。固定応答注入は表示だけの反証で、実清掃故障の証明ではない。
 * @security 自己生成の名前・Role・登録Rootだけを操作Formへ渡す。試験資格は認証Headerと再接続だけに使用し、返却値へ含めない。
 * @concurrency 重複submitを観測し、各fresh投影を待って次の操作へ進む。
 */
function managementBrowserExpression(
  exerciseFailures = false,
  reconnectionToken?: string,
  registrationRoot?: string,
): string {
  return `(async () => {
    const waitFor = async (condition) => { const end=Date.now()+15000; while(Date.now()<end) { if(condition()) return true; await new Promise(r=>setTimeout(r,50)); } throw new Error('management_browser_wait_failed'); };
    const panel = () => document.querySelector('#access-management');
    const formFor = (operation, field, value) => Array.from(panel()?.querySelectorAll('form') ?? []).find(f => f.elements.namedItem('operation')?.value === operation && (!field || f.elements.namedItem(field)?.value === value));
    await waitFor(() => formFor('registerUser'));
    const exerciseFailures = ${JSON.stringify(exerciseFailures)};
    const originalFetch = window.fetch.bind(window); let postCount=0, injected=null, stage='register-user';
    window.fetch = (...args) => {
      const requestUrl = new URL(String(args[0]), location.href);
      if(requestUrl.origin === location.origin && requestUrl.pathname === '/access-management/action') {
        postCount++;
        if(injected) {
          const selected=injected; injected=null;
          if(selected==='disconnect') throw new Error('synthetic_response_loss');
          const form=args[1].body, revision=Number(form.get('expectedRevision'));
          const result=selected==='rejected' ? { status:'rejected', reason:'management_request_rejected' } : { status:'unavailable', reason:'management_operation_unavailable', operationId:form.get('operationId'), expectedRevision:revision, observedRevision:selected==='cleanup' ? revision+1 : null, publication:selected==='cleanup' ? 'confirmed' : 'unconfirmed', cleanupConfirmed:false, primaryFailure:selected==='cleanup' ? 'cleanup_failed' : 'publication_failed' };
          return Promise.resolve(new Response(JSON.stringify(result), { headers:{ 'content-type':'application/json' } }));
        }
      }
      return originalFetch(...args);
    };
    try {
      const registration = formFor('registerUser'); registration.elements.namedItem('username').value='管理画面登録'; registration.elements.namedItem('plannedRole').value='developer';
      registration.requestSubmit(); registration.requestSubmit();
      const registered = await waitFor(() => formFor('updateUserName', 'username', '管理画面登録') && !formFor('registerUser').querySelector('button').disabled);
      const rename = formFor('updateUserName', 'username', '管理画面登録'); const id=rename.elements.namedItem('userId').value;
      stage='rename-user';
      rename.elements.namedItem('username').value='管理画面改名'; rename.requestSubmit();
      const renamed = await waitFor(() => panel().querySelector('[role=status]')?.textContent.includes('改訂 3。') && formFor('updateUserName', 'userId', id)?.elements.namedItem('username').value === '管理画面改名' && !formFor('registerUser').querySelector('button').disabled);
      stage='change-role';
      const role = formFor('changeUserRole', 'userId', id); role.elements.namedItem('nextRole').value='manager'; role.requestSubmit();
      const roleChanged = await waitFor(() => panel().querySelector('[role=status]')?.textContent.includes('改訂 4。') && formFor('changeUserRole', 'userId', id)?.elements.namedItem('currentRole').value === 'manager' && !formFor('registerUser').querySelector('button').disabled);
      stage='content-access';
      const targetRole=exerciseFailures ? 'manager' : 'developer';
      const content = formFor('updateRoleContentAccess', 'targetRole', targetRole); for(const box of content.querySelectorAll('input[type=checkbox]')) box.checked=false; content.requestSubmit();
      const contentChanged = await waitFor(() => { const fresh=formFor('updateRoleContentAccess', 'targetRole', targetRole); return panel().querySelector('[role=status]')?.textContent.includes('改訂 5。') && fresh && Array.from(fresh.querySelectorAll('input[type=checkbox]')).every(box => !box.checked) && !formFor('registerUser').querySelector('button').disabled; });
      const registrationPresent=Boolean(formFor('registerRepository'));
      const registrationRoot=${JSON.stringify(registrationRoot)};
      let repositoryRegistered=false, registrationNotPublished=false, exposureChanged=false, repositoryRemoved=false, selfContentRejected=!exerciseFailures;
      if(registrationRoot!==undefined) {
        stage='register-repository';
        const registration=formFor('registerRepository');
        registration.elements.namedItem('repositoryId').value='repository.browser-registration';
        registration.elements.namedItem('repositoryRoot').value=registrationRoot;
        registration.requestSubmit();
        repositoryRegistered=await waitFor(()=>panel().querySelector('[role=status]')?.textContent.includes('改訂 6。') && formFor('unregisterRepository','repositoryId','repository.browser-registration') && !formFor('registerUser').querySelector('button').disabled);
        registrationNotPublished=formFor('updateExposure','repositoryId','repository.browser-registration')?.textContent.includes('公開設定なし')===true;
        stage='update-exposure';
        const exposure=formFor('updateExposure','repositoryId','repository.browser-registration');
        for(const box of exposure.querySelectorAll('input[type=checkbox]'))box.checked=box.value==='development';
        exposure.requestSubmit();
        exposureChanged=await waitFor(()=>panel().querySelector('[role=status]')?.textContent.includes('改訂 7。') && formFor('updateExposure','repositoryId','repository.browser-registration')?.querySelector('input[value=development]')?.checked && !formFor('registerUser').querySelector('button').disabled);
        if(exerciseFailures) {
          const key=${JSON.stringify(reconnectionToken)};
          const denied=await originalFetch('/api/workbench-view?repositoryId=repository.browser-registration',{headers:{authorization:'Bearer '+key}});
          selfContentRejected=denied.status===403 && await denied.text()==='local_repository_access_unavailable'+String.fromCharCode(10);
        }
        stage='unregister-repository';
        formFor('unregisterRepository','repositoryId','repository.browser-registration').requestSubmit();
        repositoryRemoved=await waitFor(()=>panel().querySelector('[role=status]')?.textContent.includes('改訂 8。') && !formFor('unregisterRepository','repositoryId','repository.browser-registration') && !formFor('updateExposure','repositoryId','repository.browser-registration') && formFor('registerUser')?.querySelector('button')?.disabled===false);
      }
      const resultFocused=document.activeElement === panel().querySelector('[role=status]');
      let rejectedVisible=true, unknownVisible=true, cleanupVisible=true, responseLossVisible=true;
      if(exerciseFailures) {
        stage='failure-presentation';
        for(const [scenario, expected] of [['rejected','受理されませんでした'],['unknown','保存の結果を確認できません'],['cleanup','保存は確認済みですが']]) {
          injected=scenario; const form=formFor('updateUserName','userId',id); form.requestSubmit();
          const observed=await waitFor(() => panel().querySelector('[role=status]')?.textContent.includes(expected) && formFor('registerUser') && !formFor('registerUser').querySelector('button').disabled);
          if(scenario==='rejected') rejectedVisible=observed; else if(scenario==='unknown') unknownVisible=observed; else cleanupVisible=observed;
        }
        injected='disconnect'; formFor('updateUserName','userId',id).requestSubmit();
        responseLossVisible=await waitFor(() => panel().querySelector('[role=status]')?.textContent.includes('現在投影の確認は完了していません') && !formFor('registerUser'));
        await new Promise(r=>setTimeout(r,200));
      }
      stage='retired-header';
      const beforeRetiredHeader=postCount;
      window.fetch=async (...args)=>{
        const url=new URL(String(args[0]),location.href);
        if(url.pathname==='/access-management/action')postCount++;
        const reply=await originalFetch(...args);
        if(url.pathname==='/api/access-management'&&url.searchParams.get('view')==='current'){
          const headers=new Headers(reply.headers);headers.set('x-crdd-management-mode','remote');
          return new Response(await reply.text(),{status:reply.status,headers});
        }
        return reply;
      };
      window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
      window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
      const reconnectionToken=${JSON.stringify(reconnectionToken)};
      if(reconnectionToken!==undefined){
        await waitFor(()=>document.querySelector('#connection form'));
        const connection=document.querySelector('#connection form');
        connection.elements.namedItem('token').value=reconnectionToken;connection.requestSubmit();
      }
      const retiredHeaderRejected=await waitFor(()=>panel()?.querySelector('[role=status]')?.textContent.includes('現在の管理状態を確認できません')&&!formFor('registerUser'));
      const retiredHeaderPostZero=postCount===beforeRetiredHeader;
      const retiredConnectionSurfaceAbsent=!document.querySelector('[name=mcpEndpoint],form[action="/connection/action"]');
      return { registered, renamed, roleChanged, contentChanged, repositoryRegistered, registrationNotPublished, exposureChanged, repositoryRemoved, selfContentRejected, postCount, resultFocused, storageEmpty:localStorage.length===0 && sessionStorage.length===0, registrationPresent, rejectedVisible, unknownVisible, cleanupVisible, responseLossVisible, retiredHeaderRejected, retiredHeaderPostZero, retiredConnectionSurfaceAbsent };
    } catch { return { failedStage:stage, postCount }; }
    finally { window.fetch=originalFetch; }
  })()`;
}

/**
 * 通常発行・本人交換・全員交換と通常管理のBrowser lifecycleを実環境で確認する。
 * @responsibility HTTPだけでは見えない表示・消去・再読込・接続失効と資格付き画面遷移・終了後非採用、文書未確認・競合の部分表示とリンク抑止を反証する。
 * @trace RFD-ST-016
 * @trace RFD-ST-004
 * @trace RFD-ST-003
 * @trace ERB-ST-022
 * @trace RFD-ST-022
 * @trace EST-ST-013
 * @precondition 対応ChromeとBuild済み本番Bundleを使用する。
 * @stimulus 自己生成AM状態へ重複submit・失敗・reload、IDなし既知link／GET検索・戻る、外部／download／別tab／修飾click／POST、遅延GETと接続中の合成pagehide／pageshowを適用する。RecordではDetail保存成功／競合後のGET故障・明示再取得と、POST応答保留中のRepository切替を適用する。 Gitでは二重送信、確認なし／確認付きPush、処置後GET故障、不正応答、GET再取得と対象切替を適用する。
 * Portfolioでは二本文の一方欠測・他方Identity競合、競合本文復元、全本文復元とreloadを実施する。
 * @observation boolean/counter、選択ID・defaultPrevented・Model取得件数・取消Signal・再開Header有無、非秘密保存状態、Browser/Listener/Profile終了だけ取得する。Recordでは旧Detail本文／Formの有無、known completed／blocked通知、再取得前後のPOST数、保留POSTのSignalと新選択の維持を観測する。 GitではPOST件数、要求専用結果、非選択Root HEAD、local Remote Revisionと取消Signalを観測する。
 * Portfolioの日本語状態表示、Repositoryリンク集合、外国Identityの非表示と復元後通常接続を取得する。
 * @oracle 鍵一度表示、秘密非保持、失敗後完了0、旧接続利用可0、選択保持、対象外Model取得0、旧世代採用0、pagehide保留GET取消・Root空・終了後応答採用0、再開資格Header0。RecordのGET故障では旧本文／Form非表示、既知保存とblockedを混同しない通知、GET retryによるPOST増0、対象切替時の保留POST取消と遅延応答採用0を要求する。合成通知を実cache保存復元証明にしない。 Gitでは確認不足Push0、再取得後の操作結果未確認保持、旧状態非表示、GET再取得POST増0、他Root Effect0を要求する。
 * Portfolioは未確認を一部未確認、競合を競合ありと表示し、completeだけをリンクにする。外国Identityを公開せず、復元後通常接続できる。
 * @cleanup 既存Browser所有Tree終了処理とServer close後、検証した自己生成Rootだけ削除する。
 * @boundary 本番Server／本番CSR／専用Browser／AMのSystem境界。
 */
test("実Browserの管理操作は現在投影を更新し、鍵提示は短命である", {
  // 内容操作の複数評価を追加した全Case合計の上限。各評価・製品の待機期限は変更しない。
  // 既存全体263秒＋追加Git単独49秒を包含する親試験だけの上限。個別待機は不変更。
  timeout: 420_000,
}, async (t) => {
  const testRoot = await prepareCredentialBrowserTestRoot(repositoryRoot);
  await t.test("欠測親から固定試験Rootを独立準備する", async () => {
    const fresh = await mkdtemp(
      path.join(testRoot, "workbench-browser-bootstrap-"),
    );
    try {
      await assert.rejects(lstat(path.join(fresh, ".crdd")), {
        code: "ENOENT",
      });
      const prepared = await prepareCredentialBrowserTestRoot(fresh);
      assert.equal(prepared, path.join(fresh, ".crdd", "tests"));
      assert.equal((await lstat(prepared)).isDirectory(), true);
    } finally {
      assert.equal(path.dirname(fresh), testRoot);
      await rm(fresh, { recursive: true });
      await assert.rejects(lstat(fresh), { code: "ENOENT" });
    }
  });
  const executable = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
  ]
    .filter((value): value is string => value !== undefined)
    .map((value) =>
      path.join(value, "Google", "Chrome", "Application", "chrome.exe"),
    )
    .find((value) => existsSync(value));
  assert.ok(executable, "credential_browser_chrome_unavailable");
  const modes = [
    "issue",
    "self",
    "all",
    "management",
    "cros-management",
    "local-connection",
    "profile-manager",
    "profile-developer",
    "content-operations",
    "artifact-navigation",
    "git-operations",
  ] as const;
  const requestedCase = process.env.CRDD_WORKBENCH_BROWSER_CASE;
  if (requestedCase && !modes.some((mode) => mode === requestedCase))
    throw new Error("credential_browser_case_invalid");
  for (const mode of modes.filter(
    (mode) => !requestedCase || mode === requestedCase,
  ))
    await t.test(mode, async (context) => {
      const directory = await mkdtemp(
        path.join(testRoot, "workbench-credential-browser-"),
      );
      const profile = path.join(directory, "chrome");
      const access = path.join(directory, "access");
      await mkdir(profile);
      await mkdir(access);
      const material = createCredentialMaterial();
      const adminId = "00000000-0000-4000-8000-000000000003";
      const developerId = "00000000-0000-4000-8000-000000000004";
      const state: AccessManagementState = {
        contract: "crdd-access-management/state",
        schemaRevision: 2,
        revision: 1,
        operationId: "00000000-0000-4000-8000-000000000001",
        users: [
          { userId: adminId, username: "管理者", role: "administrator" },
          { userId: developerId, username: "開発者", role: "developer" },
        ],
        roleContentAccess: [
          { role: "developer", workspaceIds: ["development"] },
          { role: "manager", workspaceIds: ["development", "management"] },
          { role: "administrator", workspaceIds: [] },
        ],
        credentials: [
          {
            credentialId: material.credentialId,
            userId: adminId,
            tokenVersion: 1,
            tokenSalt: material.tokenSalt,
            tokenVerifier: material.tokenVerifier,
            revoked: false,
            operationId: "00000000-0000-4000-8000-000000000002",
            presentation: "confirmed",
          },
        ],
        registeredRepositories: [],
        exposure: [],
        unresolvedKeyExchanges: [],
        initialization: {
          stage: "completed",
          attemptId: "00000000-0000-4000-8000-000000000002",
          initialUserId: adminId,
          initialCredentialId: material.credentialId,
          confirmationCredentialId: material.credentialId,
          connection: "confirmed",
        },
      };
      const current = path.join(access, "access-management.json");
      let registrationRoot: string | undefined;
      if (mode === "management" || mode === "cros-management") {
        if (mode === "cros-management") {
          const actor = state.users[0];
          assert.ok(actor);
          actor.role = "manager";
          actor.username = "管理担当";
          assert.equal(
            state.users.some((user) => user.role === "administrator"),
            false,
          );
        }
        registrationRoot = path.join(directory, "registration-target");
        await mkdir(path.join(registrationRoot, ".crdd", "config"), {
          recursive: true,
        });
        assert.equal(
          spawnSync("git", ["init", "--quiet", registrationRoot], {
            windowsHide: true,
            encoding: "utf8",
          }).status,
          0,
        );
        await writeFile(
          path.join(
            registrationRoot,
            ".crdd",
            "config",
            "repository-manifest.json",
          ),
          JSON.stringify({
            schema: "crdd/repository-manifest/v2",
            projectId: "project.fixture",
            repositoryId: "repository.browser-registration",
            displayName: "登録試験",
            repositoryRole: "development",
            capabilities: [],
            contextSurfaces: [],
            externalSendPolicy: null,
          }),
        );
        await writeFile(
          path.join(registrationRoot, "PROJECT_CONTEXT.md"),
          "# Project Context\n\nProject ID: project.fixture\nRepository ID: repository.browser-registration\nRepository Role: development\n" +
            [
              "今どうなっているか",
              "何が危ない、または止まっているか",
              "今、人間が決めることは何か",
              "なぜこの状態・判断になったか",
              "次に何をすべきか",
            ]
              .map(
                (heading, index) =>
                  `\n## ${index + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
              )
              .join(""),
        );
      }
      if (mode === "profile-manager" || mode === "profile-developer") {
        const actor = state.users.find((user) => user.userId === adminId);
        assert.ok(actor);
        actor.role = mode === "profile-manager" ? "manager" : "developer";
        state.users.push({
          userId: "00000000-0000-4000-8000-000000000005",
          username: "別管理者",
          role: "administrator",
        });
        for (const entry of state.roleContentAccess) entry.workspaceIds = [];
      }
      if (
        mode === "local-connection" ||
        mode === "content-operations" ||
        mode === "artifact-navigation" ||
        mode === "git-operations"
      ) {
        const administrator = state.roleContentAccess.find(
          (entry) => entry.role === "administrator",
        );
        assert.ok(administrator);
        administrator.workspaceIds = ["development"];
        for (const suffix of ["unavailable", "next", "latest"]) {
          const id = `repository.${suffix}`;
          const target = path.join(directory, suffix);
          await mkdir(path.join(target, ".crdd", "config"), {
            recursive: true,
          });
          assert.equal(
            spawnSync(
              "git",
              [
                "init",
                "--quiet",
                ...(mode === "git-operations" ? ["--initial-branch=main"] : []),
                target,
              ],
              {
                windowsHide: true,
                encoding: "utf8",
              },
            ).status,
            0,
          );
          await writeFile(
            path.join(target, ".crdd", "config", "repository-manifest.json"),
            JSON.stringify({
              schema: "crdd/repository-manifest/v2",
              projectId: "project.fixture",
              repositoryId: id,
              displayName: "試験",
              repositoryRole: "development",
              capabilities: [],
              contextSurfaces: [],
              externalSendPolicy: null,
            }),
          );
          await writeFile(
            path.join(target, "PROJECT_CONTEXT.md"),
            `# Project Context\n\nProject ID: project.fixture\nRepository ID: ${id}\nRepository Role: development\n` +
              [
                "今どうなっているか",
                "何が危ない、または止まっているか",
                "今、人間が決めることは何か",
                "なぜこの状態・判断になったか",
                "次に何をすべきか",
              ]
                .map(
                  (heading, index) =>
                    `\n## ${index + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
                )
                .join(""),
          );
          if (mode === "artifact-navigation") {
            for (const relative of [
              "99_Roadmap/01_Roadmap.md",
              "99_Roadmap/03_Releases.md",
              "07_Quality/01_Quality_Center.md",
              "99_Roadmap/Changes/CHG-000401/change.md",
            ]) {
              const file = path.join(target, ...relative.split("/"));
              await mkdir(path.dirname(file), { recursive: true });
              await writeFile(
                file,
                `# 原文-${suffix}\n<script>globalThis.__artifactProbe=1</script>\n`,
              );
            }
          }
          if (mode === "git-operations") {
            const hooks = path.join(directory, "empty-hooks");
            await mkdir(hooks, { recursive: true });
            await writeFile(path.join(target, ".gitignore"), ".crdd/\n");
            await writeFile(path.join(target, "work.txt"), "seed\n");
            for (const args of [
              ["config", "user.name", "Fixture"],
              ["config", "user.email", "fixture@example.invalid"],
              ["config", "commit.gpgsign", "false"],
              ["config", "core.hooksPath", hooks],
              ["add", "--", ".gitignore", "work.txt", "PROJECT_CONTEXT.md"],
              ["commit", "--quiet", "--message", "seed"],
            ])
              assert.equal(
                spawnSync("git", args, {
                  cwd: target,
                  windowsHide: true,
                  encoding: "utf8",
                }).status,
                0,
                "git_fixture_prepared",
              );
            await writeFile(
              path.join(target, "work.txt"),
              `working-${suffix}\n`,
            );
          }
          state.registeredRepositories.push({
            repositoryId: id,
            repositoryRoot: target,
            bindingId: deriveRepositoryBindingId(id, target),
          });
          state.exposure.push({
            repositoryId: id,
            workspaceIds: ["development"],
          });
        }
      }
      if (mode === "git-operations") {
        const target = path.join(directory, "next"),
          remote = path.join(directory, "remote.git");
        for (const [cwd, args] of [
          [directory, ["init", "--bare", "--quiet", remote]],
          [target, ["remote", "add", "origin", remote]],
          [target, ["push", "--quiet", "--set-upstream", "origin", "main"]],
        ] as const)
          assert.equal(
            spawnSync("git", args, { cwd, windowsHide: true, encoding: "utf8" })
              .status,
            0,
            "git_fixture_remote_prepared",
          );
      }
      await writeFile(current, JSON.stringify(state));
      const root = createFilesystemStoreRoot(access);
      assert.ok(root);
      let crosProfiles:
        | ReturnType<typeof createAiProfileCatalogAdministration>
        | undefined;
      if (
        mode === "local-connection" ||
        mode === "content-operations" ||
        mode === "artifact-navigation" ||
        mode === "git-operations" ||
        mode === "profile-manager" ||
        mode === "profile-developer"
      ) {
        const config = path.join(directory, "catalog-host");
        await mkdir(config);
        const catalog = createCrosAiProfileCatalogStore({
          platform: "win32",
          localAppData: config,
          publisher: "qual-lab",
          application: "cros",
          trustDomainId: "browser-fixture",
        });
        assert.equal(catalog.status, "ready");
        if (catalog.status !== "ready")
          throw new Error("browser_catalog_unavailable");
        crosProfiles = createAiProfileCatalogAdministration(catalog.store);
      }
      const handle = await startWorkbench({
        workingDirectory: repositoryRoot,
        ...(crosProfiles === undefined
          ? {}
          : { crosProfileAdministration: crosProfiles }),
        ...(mode === "cros-management" ||
        mode === "local-connection" ||
        mode === "content-operations" ||
        mode === "artifact-navigation" ||
        mode === "git-operations" ||
        mode === "profile-manager" ||
        mode === "profile-developer"
          ? { localAccessRoot: root }
          : { credentialAdministration: { root, token: material.token } }),
      });
      let endpoint: Awaited<ReturnType<typeof readBrowserEndpoint>> | null =
        null;
      const child = spawn(
        executable,
        [
          `--user-data-dir=${profile}`,
          "--remote-debugging-address=127.0.0.1",
          "--remote-debugging-port=0",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-background-mode",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-extensions",
          "--disable-breakpad",
          "--disable-crash-reporter",
          "--disable-sync",
          "--metrics-recording-only",
          "--headless=new",
          "--window-size=1440,900",
          `${handle.baseUrl}/`,
        ],
        { stdio: "ignore", windowsHide: true },
      );
      context.after(async () => {
        let cleanup: Awaited<
          ReturnType<typeof closeOwnedBrowserProcessTree>
        > | null = null;
        let workbenchListener: Awaited<
          ReturnType<typeof observeLocalListener>
        > = "unknown";
        let devtoolsListener: Awaited<ReturnType<typeof observeLocalListener>> =
          "unknown";
        let directoryAbsent = false;
        const failures: string[] = [];
        try {
          cleanup = await closeOwnedBrowserProcessTree(child, async () => {
            if (!endpoint)
              throw new Error("credential_browser_endpoint_unavailable");
            await requestBrowser(
              `ws://127.0.0.1:${endpoint.port}${endpoint.browserPath}`,
              "Browser.close",
            );
          });
        } catch {
          failures.push("browser_close");
        }
        try {
          await handle.close();
        } catch {
          failures.push("server_close");
        }
        try {
          workbenchListener = await observeLocalListener(
            Number(new URL(handle.baseUrl).port),
          );
        } catch {
          failures.push("server_observation");
        }
        try {
          if (endpoint)
            devtoolsListener = await observeLocalListener(endpoint.port);
          else failures.push("devtools_endpoint_unknown");
        } catch {
          failures.push("devtools_observation");
        } finally {
          if (path.dirname(directory) !== testRoot)
            failures.push("directory_scope_invalid");
          else {
            try {
              await rm(directory, { recursive: true });
            } catch {
              failures.push("directory_removal");
            }
          }
          try {
            await lstat(directory);
          } catch (error) {
            directoryAbsent =
              error !== null &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "ENOENT";
            if (!directoryAbsent) failures.push("directory_observation");
          }
        }
        assert.equal(cleanup?.processTreeExitConfirmed, true);
        assert.equal(cleanup?.cleanupErrors.length, 0);
        assert.equal(workbenchListener, "absent");
        assert.equal(devtoolsListener, "absent");
        assert.equal(directoryAbsent, true);
        assert.equal(failures.length, 0);
      });
      endpoint = await readBrowserEndpoint(profile, child);
      let pageUrl: string | null = null;
      for (let attempt = 0; attempt < 100 && !pageUrl; attempt++) {
        const targets = (await (
          await fetch(`http://127.0.0.1:${endpoint.port}/json/list`)
        ).json()) as {
          type: string;
          url: string;
          webSocketDebuggerUrl: string;
        }[];
        const target = targets.find(
          (value) =>
            value.type === "page" && value.url === `${handle.baseUrl}/`,
        );
        pageUrl = target?.webSocketDebuggerUrl ?? null;
        if (!pageUrl) await delay(100);
      }
      assert.ok(pageUrl, "credential_browser_page_unavailable");
      let ready = false;
      for (let attempt = 0; attempt < 10 && !ready; attempt++) {
        try {
          ready =
            (await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `(async () => { const end=Date.now()+15000; while(Date.now()<end) { if(document.querySelector(${JSON.stringify(mode === "local-connection" || mode === "content-operations" || mode === "artifact-navigation" || mode === "git-operations" || mode === "cros-management" || mode === "profile-manager" || mode === "profile-developer" ? "#connection form" : "#credential-administration form")}) && document.readyState==='complete') return true; await new Promise(r=>setTimeout(r,100)); } return false; })()`,
              awaitPromise: true,
              returnByValue: true,
            })) === true;
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== "credential_browser_context_replaced"
          )
            throw error;
        }
        if (!ready) await delay(250);
      }
      assert.equal(ready, true, "credential_browser_ready_unconfirmed");
      if (mode === "git-operations") {
        const otherHead = spawnSync("git", ["rev-parse", "HEAD"], {
          cwd: path.join(directory, "latest"),
          encoding: "utf8",
          windowsHide: true,
        }).stdout.trim();
        const normal = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const key=${JSON.stringify(material.token)}, originalFetch=window.fetch;let posts=0,authenticated=true,stage='connect';
            window.fetch=(input,options)=>{if(new URL(String(input),location.href).pathname==='/repository/action'){posts++;authenticated=authenticated&&new Headers(options?.headers).get('authorization')==='Bearer '+key;}return originalFetch(input,options);};
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('git_ui_unconfirmed');};
            const form=(operation)=>document.querySelector('#repository form:has([name=operation][value='+operation+'])');
            const settled=(reason)=>document.querySelector('.repository-operation-surface .operation-result')?.innerText.includes(reason)&&!document.querySelector('.repository-operation-surface fieldset')?.disabled;
            try{
              document.querySelector('#connection input[name=token]').value=key;document.querySelector('#connection form').requestSubmit();
              await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='disconnect'&&!document.querySelector('#connection button')?.disabled);
              stage='select';const link=document.createElement('a');link.href='/?repositoryId=repository.next';document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();await wait(()=>!!form('prepare'));
              stage='stage';let operation=form('prepare');operation.requestSubmit();operation.requestSubmit();await wait(()=>settled('prepare_completed'));
              const singleStage=posts===1&&!!form('unprepare');
              stage='unstage';form('unprepare').requestSubmit();await wait(()=>settled('unprepare_completed')&&!!form('prepare'));
              stage='restage';form('prepare').requestSubmit();await wait(()=>settled('prepare_completed')&&!!form('unprepare'));
              stage='commit';operation=form('create_revision');operation.querySelector('[name=message]').value='Browser Git確認';operation.requestSubmit();await wait(()=>settled('revision_created')&&!!form('publish_revision'));
              const publication=form('publish_revision'), revision=publication.querySelector('[name=revisionIdentity]').value;
              const beforeConfirmation=posts;publication.requestSubmit();await new Promise(resolve=>setTimeout(resolve,100));const confirmationRequired=posts===beforeConfirmation;
              stage='push';publication.querySelector('[name=humanConfirmed]').checked=true;publication.requestSubmit();publication.requestSubmit();await wait(()=>settled('publication_confirmed'));
              return{singleStage,confirmationRequired,posts,authenticated,revision,selected:document.querySelector('[data-repository-id]')?.dataset.repositoryId,storageEmpty:localStorage.length===0&&sessionStorage.length===0};
            }catch(error){return{failedStage:stage,posts,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.ok(normal && typeof normal === "object" && "revision" in normal);
        const observed = normal as Record<string, unknown>;
        const remoteHead = spawnSync("git", ["rev-parse", "refs/heads/main"], {
          cwd: path.join(directory, "remote.git"),
          encoding: "utf8",
          windowsHide: true,
        });
        assert.equal(remoteHead.status, 0);
        assert.deepEqual(normal, {
          singleStage: true,
          confirmationRequired: true,
          posts: 5,
          authenticated: true,
          revision: remoteHead.stdout.trim(),
          selected: "repository.next",
          storageEmpty: true,
        });
        assert.equal(
          spawnSync("git", ["rev-parse", "HEAD"], {
            cwd: path.join(directory, "latest"),
            encoding: "utf8",
            windowsHide: true,
          }).stdout.trim(),
          otherHead,
        );
        assert.equal(typeof observed.revision, "string");
        await writeFile(
          path.join(directory, "next", "work.txt"),
          "after-browser-push\n",
        );
        await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async()=>{const link=document.createElement('a');link.href='/?repositoryId=repository.next&gitRefresh=true';document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();const end=Date.now()+10000;while(Date.now()<end){if(document.querySelector('#repository form:has([name=operation][value=prepare])'))return true;await new Promise(resolve=>setTimeout(resolve,40));}return false;})()`,
          awaitPromise: true,
          returnByValue: true,
        }).then((value) => assert.equal(value, true));
        const faults = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const originalFetch=window.fetch;let posts=0,failRead=false,corrupt=false,hold=false,release=null,signal=null,stage='saved-read-failure';
            window.fetch=async(input,options)=>{const route=new URL(String(input),location.href).pathname;if(route==='/api/workbench-view'&&failRead)throw new Error('fixture_read_failure');if(route==='/repository/action')posts++;const response=await originalFetch(input,options);if(route==='/repository/action'&&corrupt){await response.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}if(route==='/repository/action'&&hold){signal=options.signal;return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('git_fault_unconfirmed');};
            const form=(operation)=>document.querySelector('#repository form:has([name=operation][value='+operation+'])');
            const notice=()=>document.querySelector('.repository-operation-surface [role=status]')?.innerText;
            try{
              failRead=true;form('prepare').requestSubmit();await wait(()=>notice()?.includes('操作の完了は確認済み')&&!document.querySelector('#repository'));
              const knownSaved=posts===1&&document.querySelector('.repository-operation-surface .operation-result')?.innerText.includes('prepare_completed');
              stage='read-retry';failRead=false;document.querySelector('.repository-operation-surface button').click();await wait(()=>!!form('unprepare'));const retryNoPost=posts===1;
              stage='invalid-response';corrupt=true;form('unprepare').requestSubmit();await wait(()=>notice()?.includes('未処置と判断せず')&&!document.querySelector('#repository'));
              const unknownNotUnsaved=!document.querySelector('.repository-operation-surface .operation-result')&&posts===2;
              stage='unknown-retry';corrupt=false;document.querySelector('.repository-operation-surface button').click();await wait(()=>!!form('prepare')&&notice()?.includes('操作結果は引き続き未確認'));const unknownRetryNoPost=posts===2;
              stage='blocked-read-failure';failRead=true;const commit=form('create_revision');commit.querySelector('[name=message]').value='拒否の確認';commit.requestSubmit();await wait(()=>notice()?.includes('操作は拒否されました')&&!document.querySelector('#repository'));
              const blockedSeparate=posts===3&&document.querySelector('.repository-operation-surface .operation-result')?.innerText.includes('revision_creation_rejected');
              stage='blocked-retry';failRead=false;document.querySelector('.repository-operation-surface button').click();await wait(()=>!!form('prepare'));const blockedRetryNoPost=posts===3;
              stage='pending';hold=true;form('prepare').requestSubmit();await wait(()=>typeof release==='function');
              stage='switch';const link=document.createElement('a');link.href='/?repositoryId=repository.latest';document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();await wait(()=>document.querySelector('[data-repository-id]')?.dataset.repositoryId==='repository.latest');
              const aborted=signal?.aborted===true;release();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const lateRejected=posts===4&&!document.querySelector('.repository-operation-surface .operation-result')&&document.querySelector('[data-repository-id]')?.dataset.repositoryId==='repository.latest';
              return{knownSaved,retryNoPost,unknownNotUnsaved,unknownRetryNoPost,blockedSeparate,blockedRetryNoPost,aborted,lateRejected,posts};
            }catch(error){return{failedStage:stage,posts,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{if(release)release();window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.deepEqual(faults, {
          knownSaved: true,
          retryNoPost: true,
          unknownNotUnsaved: true,
          unknownRetryNoPost: true,
          blockedSeparate: true,
          blockedRetryNoPost: true,
          aborted: true,
          lateRejected: true,
          posts: 4,
        });
        assert.equal(
          spawnSync("git", ["diff", "--cached", "--name-only"], {
            cwd: path.join(directory, "next"),
            encoding: "utf8",
            windowsHide: true,
          }).stdout.trim(),
          "work.txt",
        );
        assert.equal(
          spawnSync("git", ["rev-parse", "HEAD"], {
            cwd: path.join(directory, "latest"),
            encoding: "utf8",
            windowsHide: true,
          }).stdout.trim(),
          otherHead,
        );
        assert.deepEqual(JSON.parse(await readFile(current, "utf8")), state);
        return;
      }
      if (mode === "artifact-navigation") {
        const observed = await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async()=>{
            const key=${JSON.stringify(material.token)}, originalFetch=window.fetch;let authenticated=0,reads=0,stage='connect';
            window.fetch=(input,options)=>{if(new URL(String(input),location.href).pathname==='/api/workbench-view'){reads++;if(new Headers(options.headers).get('authorization')==='Bearer '+key)authenticated++;}return originalFetch(input,options);};
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('artifact_navigation_unconfirmed');};
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            const body=()=>document.querySelector('#artifact-detail .canonical-markdown')?.textContent;
            try{
              document.querySelector('#connection input[name=token]').value=key;document.querySelector('#connection form').requestSubmit();await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='disconnect' && !document.querySelector('#connection button')?.disabled);
              stage='select';click('/?repositoryId=repository.next');await wait(()=>!!document.querySelector('#documentation'));
              stage='change';click('/change?id=CHG-000401');await wait(()=>body()?.includes('原文-next'));
              const changeSource=document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.next' && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
              const textOnly=body().includes('<script>') && !document.querySelector('#artifact-detail script') && globalThis.__artifactProbe===undefined;
              stage='return';document.querySelector('#artifact-detail .page-link').click();await wait(()=>!!document.querySelector('#documentation'));
              const owner=[...document.querySelectorAll('#documentation a')].find(a=>new URL(a.href).searchParams.get('path')==='99_Roadmap/01_Roadmap.md');
              stage='owner';owner.click();await wait(()=>body()?.includes('原文-next'));
              const ownerSource=new URL(location.href).pathname==='/owner-artifact' && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
              const beforeBack=reads;stage='back';history.back();await wait(()=>!!document.querySelector('#documentation'));stage='forward';history.forward();await wait(()=>body()?.includes('原文-next'));
              const historyFresh=reads>=beforeBack+2;
              stage='other';click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>body()?.includes('原文-latest'));
              const otherSource=document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest' && !body().includes('原文-next');
              return {changeSource,textOnly,ownerSource,historyFresh,otherSource,authenticated:authenticated>0,storageEmpty:localStorage.length===0&&sessionStorage.length===0};
            }catch(error){return{failedStage:stage,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{window.fetch=originalFetch;}
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        assert.deepEqual(observed, {
          changeSource: true,
          textOnly: true,
          ownerSource: true,
          historyFresh: true,
          otherSource: true,
          authenticated: true,
          storageEmpty: true,
        });
        const late = await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async()=>{
            const originalFetch=window.fetch;let release=null,signal=null,corrupt=false,selectionNull=false,standaloneMismatch=false,lastModel=null,stage='pending';
            window.fetch=async(input,options)=>{
              const url=new URL(String(input),location.href);
              if(standaloneMismatch&&url.pathname==='/api/workbench-view'&&url.searchParams.get('route')==='/change'&&!url.searchParams.has('repositoryId'))return new Response(JSON.stringify(lastModel),{headers:{'content-type':'application/json'}});
              const response=await originalFetch(input,options);
              if(url.pathname==='/api/workbench-view'&&url.searchParams.get('route')==='/change'&&url.searchParams.get('repositoryId')==='repository.next'){
                const model=await response.json();
                lastModel=structuredClone(model);
                if(selectionNull){model.selectedRepositoryId=null;return new Response(JSON.stringify(model),{headers:{'content-type':'application/json'}});}
                if(corrupt){model.repositoryId='repository.latest';model.selectedRepositoryId='repository.latest';return new Response(JSON.stringify(model),{headers:{'content-type':'application/json'}});}
                signal=options.signal;model.artifact.markdown='遅延旧本文';return new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify(model),{headers:{'content-type':'application/json'}}));});
              }return response;
            };
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('artifact_late_unconfirmed');};
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            try{
              click('/change?repositoryId=repository.next&id=CHG-000401');await wait(()=>typeof release==='function');stage='switch';click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>document.querySelector('#artifact-detail .canonical-markdown')?.textContent.includes('原文-latest'));
              const cancelled=signal?.aborted===true;release();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const lateRejected=!document.body.innerText.includes('遅延旧本文') && document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest';
              stage='mismatch';corrupt=true;click('/change?repositoryId=repository.next&id=CHG-000401');await wait(()=>document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient==='blocked');
              const mismatchRejected=!document.querySelector('#artifact-detail') && new URL(location.href).searchParams.get('repositoryId')==='repository.latest';
              corrupt=false;click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest');
              stage='shared-null';selectionNull=true;click('/change?repositoryId=repository.next&id=CHG-000401');await wait(()=>document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient==='blocked');
              const sharedNullRejected=!document.querySelector('#artifact-detail') && new URL(location.href).searchParams.get('repositoryId')==='repository.latest';
              selectionNull=false;click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest');
              stage='standalone-selection';standaloneMismatch=true;history.replaceState(null,'','/change?id=CHG-000401');dispatchEvent(new PopStateEvent('popstate'));await wait(()=>document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient==='blocked');
              const standaloneSelectionRejected=!document.querySelector('#artifact-detail') && new URL(location.href).searchParams.get('repositoryId')===null;
              history.replaceState(null,'','/change?repositoryId=repository.latest&id=CHG-000401');
              return{cancelled,lateRejected,mismatchRejected,sharedNullRejected,standaloneSelectionRejected};
            }catch(error){return{failedStage:stage,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{if(release)release();window.fetch=originalFetch;}
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        assert.deepEqual(late, {
          cancelled: true,
          lateRejected: true,
          mismatchRejected: true,
          sharedNullRejected: true,
          standaloneSelectionRejected: true,
        });
        await requestBrowser(pageUrl, "Page.reload");
        let reloaded: unknown;
        for (
          let attempt = 0;
          attempt < 10 && reloaded === undefined;
          attempt++
        ) {
          await delay(250);
          try {
            reloaded = await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `(async()=>{const end=Date.now()+10000;while(Date.now()<end){if(document.querySelector('#connection input[name=token]'))return{reconnect:true,bodyAbsent:!document.querySelector('#artifact-detail'),storageEmpty:localStorage.length===0&&sessionStorage.length===0};await new Promise(r=>setTimeout(r,40));}return{reconnect:false};})()`,
              awaitPromise: true,
              returnByValue: true,
            });
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.message !== "credential_browser_context_replaced"
            )
              throw error;
          }
        }
        assert.deepEqual(reloaded, {
          reconnect: true,
          bodyAbsent: true,
          storageEmpty: true,
        });
        assert.deepEqual(JSON.parse(await readFile(current, "utf8")), state);
        return;
      }
      if (mode === "content-operations") {
        const connected = await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async()=>{
            document.querySelector('#connection input[name=token]').value=${JSON.stringify(material.token)};
            document.querySelector('#connection form').requestSubmit();
            const end=Date.now()+10000;while(Date.now()<end){
              if(document.querySelector('#connection input[name=operation]')?.value==='disconnect'&&!document.querySelector('#connection button')?.disabled)return true;
              await new Promise(resolve=>setTimeout(resolve,40));
            }return false;
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        assert.equal(connected, true);
        const targetContext = path.join(
          directory,
          "next",
          "PROJECT_CONTEXT.md",
        );
        const targetManifest = path.join(
          directory,
          "next",
          ".crdd",
          "config",
          "repository-manifest.json",
        );
        const manifestBefore = await readFile(targetManifest);
        const contextBefore = await readFile(targetContext);
        const originalOpen = fs.openSync;
        let deniedReads = 0;
        const deniedObservation = context.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof fs.openSync>) => {
            if (String(args[0]) === targetContext) deniedReads++;
            return originalOpen(...args);
          },
        );
        syncBuiltinESMExports();
        try {
          const probe = fs.openSync(targetContext, "r");
          fs.closeSync(probe);
          assert.equal(
            deniedReads,
            1,
            "denied_reader_observer_positive_control",
          );
          const beforeTimeOnly = await readFile(current);
          const contentRequest = `(async()=>{const reply=await fetch('/api/workbench-view?repositoryId=repository.next',{headers:{authorization:'Bearer '+${JSON.stringify(material.token)}}});return{status:reply.status,model:await reply.json()};})()`;
          deniedReads = 0;
          const initialContent = await requestBrowser(
            pageUrl,
            "Runtime.evaluate",
            {
              expression: contentRequest,
              awaitPromise: true,
              returnByValue: true,
            },
          );
          const initialReads = deniedReads;
          assert.ok(
            initialReads > 0,
            "authorized_content_reader_positive_control",
          );
          const later = Date.now() + 365 * 24 * 60 * 60 * 1000;
          const clock = context.mock.method(Date, "now", () => later);
          try {
            deniedReads = 0;
            const laterContent = await requestBrowser(
              pageUrl,
              "Runtime.evaluate",
              {
                expression: contentRequest,
                awaitPromise: true,
                returnByValue: true,
              },
            );
            assert.deepEqual(
              laterContent,
              initialContent,
              "same_browser_content_request_after_time_only_change",
            );
            assert.equal(deniedReads, initialReads);
            assert.deepEqual(await readFile(current), beforeTimeOnly);
          } finally {
            clock.mock.restore();
          }
          for (const scenario of [
            "revoked",
            "stale-role",
            "exposure-outside",
            "management-only",
            "root-unavailable",
          ] as const) {
            const rejectedState = structuredClone(state);
            const actor = rejectedState.users[0];
            const credential = rejectedState.credentials[0];
            assert.ok(actor && credential);
            if (scenario === "revoked") credential.revoked = true;
            if (scenario === "stale-role") {
              actor.role = "developer";
              const role = rejectedState.roleContentAccess.find(
                (entry) => entry.role === "developer",
              );
              assert.ok(role);
              role.workspaceIds = [];
            }
            if (scenario === "exposure-outside") {
              const exposure = rejectedState.exposure.find(
                (entry) => entry.repositoryId === "repository.next",
              );
              assert.ok(exposure);
              exposure.workspaceIds = [];
            }
            if (scenario === "management-only") {
              const role = rejectedState.roleContentAccess.find(
                (entry) => entry.role === "administrator",
              );
              assert.ok(role);
              role.workspaceIds = ["management"];
            }
            if (scenario === "root-unavailable")
              await writeFile(targetManifest, "synthetic-invalid-manifest");
            await writeFile(current, JSON.stringify(rejectedState));
            const beforeRequest = await readFile(current);
            deniedReads = 0;
            const rejected = await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `(async()=>{const reply=await fetch('/api/workbench-view?repositoryId=repository.next',{headers:{authorization:'Bearer '+${JSON.stringify(material.token)}}});return{status:reply.status,closedBody:await reply.text()==='local_repository_access_unavailable'+String.fromCharCode(10)};})()`,
              awaitPromise: true,
              returnByValue: true,
            });
            assert.deepEqual(
              rejected,
              { status: 403, closedBody: true },
              scenario,
            );
            assert.equal(deniedReads, 0, scenario);
            assert.deepEqual(await readFile(current), beforeRequest, scenario);
            assert.deepEqual(
              await readFile(targetContext),
              contextBefore,
              scenario,
            );
            await writeFile(targetManifest, manifestBefore);
          }
        } finally {
          deniedObservation.mock.restore();
          syncBuiltinESMExports();
          await writeFile(current, JSON.stringify(state));
          await writeFile(targetManifest, manifestBefore);
        }
        const promotionMarkdown =
          "# 昇格試験\n\n成果物種別: Topic\nTopic ID: `TOPIC-000201`\nProject ID: `project.fixture`\n状態: `open`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 現在の論点\n\n### 結論\n\n昇格を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | N/A: 未処置 |\n| 昇格先 | N/A: 未昇格 |\n| 終了理由 | N/A: 未終了 |\n| 残る影響 | N/A: 未終了 |\n";
        const meetingMarkdown =
          "# Outcome試験\n\n成果物種別: Meeting\nMeeting ID: `MTG-000201`\nProject ID: `project.fixture`\n状態: `recorded`\n開催日時: `2026-10-13 09:00 JST`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 目的と要約\n\n### 結論\n\n二件のOutcomeを処置する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| `OUT-001` | Action | 一件目 | `pending` | 試験担当 | 次回 | N/A: 未移管 |\n| `OUT-002` | Action | 二件目 | `pending` | 試験担当 | 次回 | N/A: 未移管 |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| `OUT-001` | | | | |\n| `OUT-002` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | OPEN: 未処置 |\n| 未処置Outcome | OUT-001、OUT-002 |\n| 訂正元／訂正先 | N/A: 訂正ではない |\n| 残る影響 | 未処置 |\n";
        const changeDirectory = path.join(
          directory,
          "next",
          "99_Roadmap",
          "Changes",
          "CHG-000201",
        );
        await mkdir(changeDirectory, { recursive: true });
        await writeFile(
          path.join(changeDirectory, "change.md"),
          "# 自己生成変更\n",
        );
        const observed = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const key=${JSON.stringify(material.token)}, originalFetch=window.fetch;
            let posts=0, failRead=false, corruptResponse=false, lastBody=null, stage='connect';
            window.fetch=async(input, options)=>{
              const url=new URL(String(input),location.href);
              if(url.pathname==='/api/workbench-view' && failRead) throw new Error('fixture_read_failure');
              if(url.pathname==='/topic-meeting/action') { posts++; lastBody=String(options.body); }
              const response=await originalFetch(input, options);
              if(url.pathname==='/topic-meeting/action' && corruptResponse) { await response.arrayBuffer(); return new Response('{',{headers:{'content-type':'application/json'}}); }
              return response;
            };
            const wait=async(predicate)=>{const end=Date.now()+10000; while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));} throw new Error('content_condition_unconfirmed');};
            const click=(href)=>{const link=document.createElement('a');link.href=href;document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();};
            const saved=()=>document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('保存を確認し');
            const createForm=()=>document.querySelector('#topics form[action="/topic-meeting/action"]:has([name=operation][value=create])');
            const markdown=(id,title,revision)=>'# '+title+'\\n\\n成果物種別: Topic\\nTopic ID: \\x60'+id+'\\x60\\nProject ID: \\x60project.fixture\\x60\\n状態: \\x60open\\x60\\n改訂: \\x60'+revision+'\\x60\\n維持責任者: \\x60試験担当\\x60\\n\\n## 1. 現在の論点\\n\\n### 結論\\n\\n自己生成試験。\\n';
            try {
              stage='select'; click('/?repositoryId=repository.next'); await wait(()=>!!createForm() && !createForm().closest('fieldset').disabled);
              const form=createForm(); form.closest('details').open=true; form.querySelector('textarea').value=markdown('TOPIC-000101','初期',1);
              stage='create'; form.requestSubmit(); form.requestSubmit(); await wait(saved);
              const singleCreate=posts===1, selectedAfterCreate=location.search.includes('repository.next');
              stage='detail'; click('/topic?repositoryId=repository.next&id=TOPIC-000101'); await wait(()=>!!document.querySelector('#topic-detail'));
              const update=document.querySelector('form:has([name=operation][value=update])'); update.closest('details').open=true;
              stage='update'; update.querySelector('textarea').value=markdown('TOPIC-000101','更新済み',2); update.requestSubmit(); await wait(saved);
              const detailUpdated=document.querySelector('#topic-detail h1')?.innerText==='更新済み' && document.querySelector('.detail-metadata')?.innerText.includes('2');
              const deletion=document.querySelector('form:has([name=operation][value=delete])'); const beforeDelete=posts;
              deletion.requestSubmit(); const confirmationRequired=posts===beforeDelete;
              stage='delete'; deletion.querySelector('[name=confirmed]').checked=true; deletion.requestSubmit();
              await wait(()=>!!document.querySelector('#topics') && document.querySelector('#topics .operation-result')?.innerText.includes('record_deleted'));
              const deletedToSameRepository=location.pathname==='/' && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
              return {singleCreate,selectedAfterCreate,detailUpdated,confirmationRequired,deletedToSameRepository,posts};
            } catch {return {failedStage:stage,posts};} finally {window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.deepEqual(observed, {
          singleCreate: true,
          selectedAfterCreate: true,
          detailUpdated: true,
          confirmationRequired: true,
          deletedToSameRepository: true,
          posts: 3,
        });
        const faultResults = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const originalFetch=window.fetch;let posts=0,failRead=false,corruptResponse=false,lastBody=null,stage='read-failure';
            window.fetch=async(input,options)=>{
              const route=new URL(String(input),location.href).pathname;
              if(route==='/api/workbench-view' && failRead) throw new Error('fixture_read_failure');
              if(route==='/topic-meeting/action'){posts++;lastBody=String(options.body);}
              const response=await originalFetch(input,options);
              if(route==='/topic-meeting/action' && corruptResponse){await response.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}
              return response;
            };
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('content_fault_unconfirmed');};
            const createForm=()=>document.querySelector('#topics form:has([name=operation][value=create])');
            const markdown=(id,title)=>'# '+title+'\\n\\n成果物種別: Topic\\nTopic ID: \\x60'+id+'\\x60\\nProject ID: \\x60project.fixture\\x60\\n状態: \\x60open\\x60\\n改訂: \\x601\\x60\\n維持責任者: \\x60試験担当\\x60\\n\\n## 1. 現在の論点\\n\\n### 結論\\n\\n自己生成試験。\\n';
            try{
              const fault=createForm(); fault.closest('details').open=true; fault.querySelector('textarea').value=markdown('TOPIC-000102','保存後表示故障');
              stage='read-failure'; failRead=true; fault.requestSubmit(); await wait(()=>document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('保存は確認済み'));
              const knownSave=posts===1 && !document.querySelector('#topics'), beforeRetry=posts;
              stage='read-retry'; failRead=false; document.querySelector('.record-operation-surface button').click(); await wait(()=>!!createForm());
              const retryNoPost=posts===beforeRetry && document.querySelector('#topics')?.innerText.includes('保存後表示故障');
              const lost=createForm(); lost.closest('details').open=true; lost.querySelector('textarea').value=markdown('TOPIC-000103','応答未確認');
              stage='response-failure'; corruptResponse=true; lost.requestSubmit(); await wait(()=>document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('未保存と判断せず'));
              const unknownOutcome=!document.querySelector('#topics') && !document.querySelector('.record-operation-surface .operation-result');
              stage='response-retry'; corruptResponse=false; const beforeLostRetry=posts; document.querySelector('.record-operation-surface button').click(); await wait(()=>!!createForm());
              const lostRetryNoPost=posts===beforeLostRetry && document.querySelector('#topics')?.innerText.includes('応答未確認');
              const key=${JSON.stringify(material.token)};
              const noSecret=localStorage.length===0 && sessionStorage.length===0 && !location.href.includes(key) && !lastBody.includes(key);
              return {knownSave,retryNoPost,unknownOutcome,lostRetryNoPost,noSecret,posts};
            } catch {return {failedStage:stage,posts};} finally {window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        ).catch((error: unknown) => {
          throw new Error("content_fault_protocol_failed", { cause: error });
        });
        assert.deepEqual(faultResults, {
          knownSave: true,
          retryNoPost: true,
          unknownOutcome: true,
          lostRetryNoPost: true,
          noSecret: true,
          posts: 2,
        });
        const lifecycle = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const originalFetch=window.fetch; let posts=0, lastBody=null, stage='promotion-create', lastReadStatus=null;
            window.fetch=async(input,options)=>{const route=new URL(String(input),location.href).pathname;if(route==='/topic-meeting/action'){posts++;lastBody=new URLSearchParams(options.body);}const response=await originalFetch(input,options);if(route==='/api/workbench-view')lastReadStatus=response.status;return response;};
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('content_lifecycle_unconfirmed');};
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            const result=(reason)=>document.querySelector('.record-operation-surface .operation-result')?.innerText.includes(reason) && !document.querySelector('.record-operation-surface fieldset')?.disabled;
            const getForm=(operation)=>document.querySelector('form:has([name=operation][value='+operation+'])');
            try {
              const create=document.querySelector('#topics form:has([name=operation][value=create])');create.closest('details').open=true;create.querySelector('textarea').value=${JSON.stringify(promotionMarkdown)};create.requestSubmit();await wait(()=>result('record_created'));
              stage='promotion-detail'; click('/topic?repositoryId=repository.next&id=TOPIC-000201');await wait(()=>!!document.querySelector('#topic-detail') && !!getForm('promote-topic') && !getForm('promote-topic').closest('fieldset').disabled);
              const promote=getForm('promote-topic');promote.closest('details').open=true;
              stage='promote'; promote.querySelector('[name=changeId]').value='CHG-000201';promote.querySelector('[name=reason]').value='具体変更';promote.querySelector('[name=remainingResponsibility]').value='終了時再確認';promote.requestSubmit();await wait(()=>result('topic_promoted'));
              const promoted=document.querySelector('#topic-detail header')?.innerText.includes('promoted');
              stage='meeting-select'; click('/?repositoryId=repository.next');await wait(()=>!!document.querySelector('#meetings form:has([name=operation][value=create])'));
              stage='meeting-create'; const meeting=document.querySelector('#meetings form:has([name=operation][value=create])');meeting.closest('details').open=true;meeting.querySelector('textarea').value=${JSON.stringify(meetingMarkdown)};meeting.requestSubmit();await wait(()=>result('record_created'));
              stage='meeting-detail'; click('/meeting?repositoryId=repository.next&id=MTG-000201');await wait(()=>!!document.querySelector('#meeting-detail') && !!getForm('treat-outcome') && !getForm('treat-outcome').closest('fieldset').disabled);
              const fill=(outcome, close)=>{const form=getForm('treat-outcome');form.closest('details').open=true;for(const [name,value] of Object.entries({outcomeId:outcome,owner:'試験担当',reviewTrigger:'次回',targetReference:'N/A: 自己完結',treatment:'完了確認',completionCondition:'確認済み',result:'確認済み'}))form.querySelector('[name='+name+']').value=value;form.querySelector('[name=closeMeeting]').checked=close;return form;};
              stage='early-close'; fill('OUT-001',true).requestSubmit();await wait(()=>result('meeting_outcome_invalid'));
              const earlyCloseRejected=document.querySelector('#meeting-detail header')?.innerText.includes('recorded') && lastBody.getAll('closeMeeting').join(',')==='true';
              stage='first-outcome'; fill('OUT-001',false).requestSubmit();await wait(()=>result('meeting_outcome_treated'));
              const uncheckedFalseOnce=lastBody.getAll('closeMeeting').join(',')==='false' && document.querySelector('#meeting-detail header')?.innerText.includes('recorded');
              stage='final-close'; fill('OUT-002',true).requestSubmit();await wait(()=>result('meeting_outcome_treated') && document.querySelector('#meeting-detail header')?.innerText.includes('closed'));
              const closed=lastBody.getAll('closeMeeting').join(',')==='true' && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
              return {promoted,earlyCloseRejected,uncheckedFalseOnce,closed,posts};
            }catch(error){return {failedStage:stage,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other',posts,lastReadStatus,screen:document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient,route:location.pathname};}finally{window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        ).catch((error: unknown) => {
          throw new Error("content_lifecycle_protocol_failed", {
            cause: error,
          });
        });
        assert.deepEqual(lifecycle, {
          promoted: true,
          earlyCloseRejected: true,
          uncheckedFalseOnce: true,
          closed: true,
          posts: 6,
        });
        const interruptions = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const originalFetch=window.fetch; let posts=0, failRead=false, holdPost=false, releaseLate=null, lateSignal=null, stage='detail-select';
            window.fetch=async(input,options)=>{
              const route=new URL(String(input),location.href).pathname;
              if(route==='/api/workbench-view' && failRead) throw new Error('fixture_read_failure');
              if(route==='/topic-meeting/action') posts++;
              const response=await originalFetch(input,options);
              if(route==='/topic-meeting/action' && holdPost) {lateSignal=options.signal;return new Promise(resolve=>{releaseLate=()=>resolve(response);});}
              return response;
            };
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('content_interruption_unconfirmed');};
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            const form=(operation)=>document.querySelector('form:has([name=operation][value='+operation+'])');
            try{
              click('/topic?repositoryId=repository.next&id=TOPIC-000103');await wait(()=>!!document.querySelector('#topic-detail') && !!form('update'));
              const update=form('update');update.closest('details').open=true;
              update.querySelector('textarea').value=update.querySelector('textarea').value.replace('改訂: \\x601\\x60','改訂: \\x602\\x60');
              stage='detail-read-failure';failRead=true;update.requestSubmit();await wait(()=>document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('保存は確認済み'));
              const detailHidden=!document.querySelector('.canonical-markdown') && !form('update') && document.querySelector('.record-operation-surface .operation-result')?.innerText.includes('record_updated');
              const beforeRetry=posts;stage='detail-retry';failRead=false;document.querySelector('.record-operation-surface button').click();await wait(()=>!!form('update') && !form('update').closest('fieldset').disabled);
              const detailFreshSame=posts===beforeRetry && new URL(location.href).searchParams.get('id')==='TOPIC-000103' && form('update').querySelector('[name=expectedRevision]').value==='2';
              const conflict=form('update');conflict.closest('details').open=true;conflict.querySelector('[name=expectedRevision]').value='9';
              stage='blocked-read-failure';failRead=true;conflict.requestSubmit();await wait(()=>document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('変更は拒否されました'));
              const blockedSeparated=!document.querySelector('.canonical-markdown') && document.querySelector('.record-operation-surface .operation-result')?.innerText.includes('record_revision_conflict') && !document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('保存は確認済み');
              stage='blocked-retry';failRead=false;document.querySelector('.record-operation-surface button').click();await wait(()=>!!form('update') && !form('update').closest('fieldset').disabled);
              const blockedNoResend=posts===2, source=form('update').querySelector('textarea').value;
              stage='pending-select';click('/?repositoryId=repository.next');await wait(()=>!!document.querySelector('#topics form:has([name=operation][value=create])'));
              const create=document.querySelector('#topics form:has([name=operation][value=create])');create.closest('details').open=true;create.querySelector('textarea').value=source.replace('TOPIC-000103','TOPIC-000104').replace('改訂: \\x602\\x60','改訂: \\x601\\x60').replace('応答未確認','遅延受信');
              stage='pending-post';holdPost=true;create.requestSubmit();await wait(()=>typeof releaseLate==='function');
              stage='target-switch';click('/?repositoryId=repository.latest');await wait(()=>document.querySelector('[data-repository-id]')?.dataset.repositoryId==='repository.latest');
              const aborted=lateSignal?.aborted===true, beforeRelease=posts;releaseLate();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const lateNotAdopted=posts===beforeRelease && new URL(location.href).searchParams.get('repositoryId')==='repository.latest' && !document.querySelector('.record-operation-surface .operation-result') && !document.body.innerText.includes('遅延受信');
              return {detailHidden,detailFreshSame,blockedSeparated,blockedNoResend,aborted,lateNotAdopted,posts};
            }catch(error){return {failedStage:stage,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other',posts};}finally{if(releaseLate)releaseLate();window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        ).catch((error: unknown) => {
          throw new Error("content_interruption_protocol_failed", {
            cause: error,
          });
        });
        assert.deepEqual(interruptions, {
          detailHidden: true,
          detailFreshSame: true,
          blockedSeparated: true,
          blockedNoResend: true,
          aborted: true,
          lateNotAdopted: true,
          posts: 3,
        });
        assert.equal(
          existsSync(
            path.join(
              directory,
              "next",
              "22_Topics",
              "TOPIC-000101",
              "topic.md",
            ),
          ),
          false,
        );
        assert.equal(
          existsSync(
            path.join(
              directory,
              "latest",
              "22_Topics",
              "TOPIC-000102",
              "topic.md",
            ),
          ),
          false,
        );
        assert.deepEqual(JSON.parse(await readFile(current, "utf8")), state);
        return;
      }
      if (
        mode === "local-connection" ||
        mode === "profile-manager" ||
        mode === "profile-developer"
      ) {
        let connectionSetup: Readonly<{
          posts: number;
          nextViewAuthenticated: boolean;
        }> | null = null;
        if (mode === "local-connection") {
          const unavailablePath = path.join(
            directory,
            "unavailable",
            "PROJECT_CONTEXT.md",
          );
          const nextPath = path.join(directory, "next", "PROJECT_CONTEXT.md");
          const unavailableBody = await readFile(unavailablePath, "utf8");
          const nextBody = await readFile(nextPath, "utf8");
          try {
            await rm(unavailablePath);
            await writeFile(
              nextPath,
              nextBody.replace(
                "Repository ID: repository.next",
                "Repository ID: foreign-source",
              ),
            );
            for (const expected of ["競合あり", "一部未確認"]) {
              const partial = await requestBrowser(
                pageUrl,
                "Runtime.evaluate",
                {
                  expression: `(async()=>{
                  const end=Date.now()+15000;
                  while(!document.querySelector('#connection input[name=token]')){if(Date.now()>end)throw new Error('connection_not_ready');await new Promise(r=>setTimeout(r,50));}
                  document.querySelector('#connection input[name=token]').value=${JSON.stringify(material.token)};
                  document.querySelector('#connection form').requestSubmit();
                  while(!document.querySelector('#projects')?.innerText.includes(${JSON.stringify(expected)})){if(Date.now()>end)throw new Error('partial_view_not_ready');await new Promise(r=>setTimeout(r,50));}
                  const projects=document.querySelector('#projects');
                  const links=[...projects.querySelectorAll('a')].map(a=>a.textContent);
                  return {state:projects.innerText.includes(${JSON.stringify(expected)}),unavailable:projects.innerText.includes('文書未確認'),conflicting:projects.innerText.includes('文書競合'),links,foreign:document.body.innerText.includes('foreign-source')};
                })()`,
                  awaitPromise: true,
                  returnByValue: true,
                },
              );
              assert.deepEqual(partial, {
                state: true,
                unavailable: true,
                conflicting: expected === "競合あり",
                links:
                  expected === "競合あり"
                    ? ["repository.latest"]
                    : ["repository.latest", "repository.next"],
                foreign: false,
              });
              await writeFile(nextPath, nextBody);
              await requestBrowser(pageUrl, "Page.reload", {});
            }
          } finally {
            await writeFile(unavailablePath, unavailableBody);
            await writeFile(nextPath, nextBody);
            await requestBrowser(pageUrl, "Page.reload", {});
          }
          const ready = await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `(async()=>{const end=Date.now()+15000;while(Date.now()<end){if(document.querySelector('#connection input[name=token]'))return true;await new Promise(r=>setTimeout(r,50));}return false;})()`,
            awaitPromise: true,
            returnByValue: true,
          });
          assert.equal(ready, true);
          const setup = await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `(async()=>{
              const originalFetch=window.fetch;let posts=0,nextViewAuthenticated=false;
              const key=${JSON.stringify(material.token)};
              window.fetch=(input,options)=>{const pathname=new URL(String(input),location.href).pathname;if(pathname==='/local-connection/action')posts++;if(pathname==='/api/workbench-view'&&new Headers(options?.headers).get('authorization')==='Bearer '+key)nextViewAuthenticated=true;return originalFetch(input,options);};
              try{
                document.querySelector('#connection input[name=token]').value=${JSON.stringify(material.token)};
                const form=document.querySelector('#connection form');form.requestSubmit();form.requestSubmit();
                const end=Date.now()+15000;while(Date.now()<end){
                  if(document.querySelector('#connection input[name=operation]')?.value==='disconnect'&&!document.querySelector('#connection button')?.disabled&&document.querySelector('#ai-profile-administration form')&&!document.querySelector('#ai-profile-administration fieldset')?.disabled)return{posts,nextViewAuthenticated};
                  await new Promise(resolve=>setTimeout(resolve,50));
                }return{unconfirmed:true,posts};
              }finally{window.fetch=originalFetch;}
            })()`,
            awaitPromise: true,
            returnByValue: true,
          });
          assert.deepEqual(setup, { posts: 1, nextViewAuthenticated: true });
          connectionSetup = setup as Readonly<{
            posts: number;
            nextViewAuthenticated: boolean;
          }>;
        }
        const observed = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async () => {
            const key=${JSON.stringify(material.token)};
            const originalFetch=window.fetch;
            let posts=${JSON.stringify(connectionSetup?.posts ?? 0)}, authenticatedReads=0, modelReads=0, profilePosts=0, waitNumber=0;
            let failProfileRead=false, invalidateProfileResponse=false;
            window.fetch=async (input, options) => {
              const pathname=new URL(String(input),location.href).pathname;
              if(String(input).endsWith('/local-connection/action')) posts++;
              if(pathname==='/ai-profiles/action') profilePosts++;
              if(new URL(String(input),location.href).pathname==='/api/workbench-view') modelReads++;
              if(new Headers(options?.headers).get('authorization')==='Bearer '+key) authenticatedReads++;
              if(pathname==='/api/ai-profiles' && failProfileRead) throw new Error('fixture_read_unavailable');
              const response=await originalFetch(input, options);
              if(pathname==='/ai-profiles/action' && invalidateProfileResponse) {
                await response.arrayBuffer();
                return new Response('{',{headers:{'content-type':'application/json'}});
              }
              return response;
            };
            const wait=async(predicate)=>{ waitNumber++; const end=Date.now()+15000; while(Date.now()<end){ if(predicate()) return true; await new Promise(r=>setTimeout(r,50)); } throw new Error('browser_condition_unconfirmed'); };
            try {
              if(${JSON.stringify(mode)}!=='local-connection'){
                const input=document.querySelector('#connection input[name=token]');input.value=key;
                const form=document.querySelector('#connection form');form.requestSubmit();form.requestSubmit();
              }
              const connected=await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='disconnect' && !document.querySelector('#connection button')?.disabled);
              const inputCleared=!document.querySelector('#connection input[name=token]');
              const secretAbsent=!document.body.innerText.includes(key) && !location.href.includes(key) && localStorage.length===0 && sessionStorage.length===0;
              const nextGetAuthenticated=${JSON.stringify(mode)}==='local-connection'
                ? ${JSON.stringify(connectionSetup?.nextViewAuthenticated ?? false)}
                : authenticatedReads>0;
              if(${JSON.stringify(mode)}==='profile-developer') {
                const unavailable=await wait(()=>document.querySelector('#ai-profile-administration [role=status]')?.innerText.includes('取得できません'));
                return {connected,inputCleared,secretAbsent,nextGetAuthenticated,unavailable,catalogAbsent:!document.querySelector('#ai-profile-administration table'),formAbsent:!document.querySelector('#ai-profile-administration form'),profilePosts};
              }
              const profileReady=await wait(()=>document.querySelector('#ai-profile-administration form') && !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              if(${JSON.stringify(mode)}==='profile-manager') {
              const fillProfile=(operation,reason)=>{
                const form=document.querySelector('#ai-profile-administration .ai-profile-administration-form');
                form.querySelector('[name=operation]').value=operation;
                form.querySelector('[name=profileId]').value='PROFILE-300001';
                form.querySelector('[name=adapterModel]').value='codex-cli|gpt-6-astra';
                form.querySelector('[name=family]').value='astra';
                form.querySelector('[name=defaultReasoningEffort]').value='high';
                form.querySelector('[name=compatibilityReason]').value=reason;
                form.querySelector('[name=selectionRole][value=executor]').checked=true;
                form.querySelector('[name=modelTier][value=preferred]').checked=true;
                return form;
              };
              const beforeProfile=profilePosts;
              const create=fillProfile('create','');
              create.requestSubmit(); create.requestSubmit();
              const profileCreated=await wait(()=>document.querySelector('#ai-profile-administration table')?.innerText.includes('PROFILE-300001') &&
                !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              const profileSingleCreate=profilePosts===beforeProfile+1;
              fillProfile('update','browser-fixture').requestSubmit();
              const profileUpdated=await wait(()=>document.querySelector('#ai-profile-administration .operation-result')?.innerText.includes('profile_updated') &&
                !!document.querySelector('#ai-profile-administration .ai-profile-administration-form') &&
                !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              failProfileRead=true;
              const beforeReadFailure=profilePosts;
              fillProfile('update','saved-before-read-failure').requestSubmit();
              const savedReadFailure=await wait(()=>document.querySelector('#ai-profile-administration [role=status]')?.innerText.includes('保存は確認済み') &&
                document.querySelector('#ai-profile-administration .operation-result')?.innerText.includes('profile_updated') &&
                !document.querySelector('#ai-profile-administration table') && !document.querySelector('#ai-profile-administration button')?.disabled);
              await new Promise(resolve=>setTimeout(resolve,150));
              const noReadFailureResend=profilePosts===beforeReadFailure+1;
              failProfileRead=false;
              document.querySelector('#ai-profile-administration button').click();
              const savedFreshRead=await wait(()=>!!document.querySelector('#ai-profile-administration .ai-profile-administration-form') &&
                !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              const explicitReadNoPost=profilePosts===beforeReadFailure+1;
              const savedReason=(await (await originalFetch('/api/ai-profiles',{headers:{authorization:'Bearer '+key}})).json()).catalog.profiles.find(profile=>profile.profileId==='PROFILE-300001')?.compatibilityReason;
              invalidateProfileResponse=true;
              const beforeInvalidResponse=profilePosts;
              fillProfile('update','saved-before-response-loss').requestSubmit();
              const responseUnconfirmed=await wait(()=>document.querySelector('#ai-profile-administration [role=status]')?.innerText.includes('未保存と判断せず') &&
                !document.querySelector('#ai-profile-administration .operation-result') && !document.querySelector('#ai-profile-administration table') &&
                !document.querySelector('#ai-profile-administration button')?.disabled);
              await new Promise(resolve=>setTimeout(resolve,150));
              const noResponseLossResend=profilePosts===beforeInvalidResponse+1;
              invalidateProfileResponse=false;
              document.querySelector('#ai-profile-administration button').click();
              const responseFreshRead=await wait(()=>!!document.querySelector('#ai-profile-administration .ai-profile-administration-form') &&
                !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              const explicitResponseReadNoPost=profilePosts===beforeInvalidResponse+1;
              const responseReason=(await (await originalFetch('/api/ai-profiles',{headers:{authorization:'Bearer '+key}})).json()).catalog.profiles.find(profile=>profile.profileId==='PROFILE-300001')?.compatibilityReason;
              const deletion=[...document.querySelectorAll('#ai-profile-administration table form')].find(form=>form.querySelector('[name=profileId]')?.value==='PROFILE-300001');
              const beforeDelete=profilePosts;
              deletion.requestSubmit(); await new Promise(resolve=>setTimeout(resolve,100));
              const profileConfirmationRequired=profilePosts===beforeDelete;
              deletion.querySelector('[name=confirmed]').checked=true; deletion.requestSubmit();
              const profileDeleted=await wait(()=>!document.querySelector('#ai-profile-administration table')?.innerText.includes('PROFILE-300001') &&
                !!document.querySelector('#ai-profile-administration table') && !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              const measuredProfileFetch=window.fetch;
              let releaseProfile, profileSignal;
              window.fetch=async(input,options)=>{
                if(new URL(String(input),location.href).pathname==='/api/ai-profiles') {
                  profileSignal=options?.signal;
                  const currentCatalog=await (await originalFetch(input,options)).json();
                  currentCatalog.catalog.profiles[0].profileId='PROFILE-999999';
                  return new Promise(resolve=>{releaseProfile=()=>resolve(new Response(JSON.stringify(currentCatalog),{headers:{'content-type':'application/json'}}));});
                }
                return measuredProfileFetch(input,options);
              };
              document.querySelector('#connection form').requestSubmit();
              await wait(()=>document.querySelector('#connection input[name=token]') && !document.querySelector('#connection button')?.disabled);
              document.querySelector('#connection input[name=token]').value=key;
              document.querySelector('#connection form').requestSubmit();
              const profilePending=await wait(()=>typeof releaseProfile==='function' && document.querySelector('#connection input[name=operation]')?.value==='disconnect' && !document.querySelector('#connection button')?.disabled);
              document.querySelector('#connection form').requestSubmit();
              const profileDisconnected=await wait(()=>document.querySelector('#connection input[name=token]') && !document.querySelector('#connection button')?.disabled);
              const profileCancelled=profilePending && profileDisconnected && profileSignal?.aborted===true;
              window.fetch=measuredProfileFetch;
              releaseProfile();
              await new Promise(resolve=>setTimeout(resolve,100));
              const profileLateRejected=!document.querySelector('#ai-profile-administration table') && !document.body.innerText.includes('PROFILE-999999');
              document.querySelector('#connection input[name=token]').value=key;
              document.querySelector('#connection form').requestSubmit();
              const profileReconnected=await wait(()=>!!document.querySelector('#ai-profile-administration table') && !document.querySelector('#ai-profile-administration fieldset')?.disabled);
              const profileFreshOnly=profileReconnected && !document.body.innerText.includes('PROFILE-999999') && !document.body.innerText.includes('保存は確認済み');
              return {connected,inputCleared,secretAbsent,nextGetAuthenticated,profileReady,profileCreated,profileSingleCreate,profileUpdated,savedReadFailure,noReadFailureResend,savedFreshRead,explicitReadNoPost,savedReason,responseUnconfirmed,noResponseLossResend,responseFreshRead,explicitResponseReadNoPost,responseReason,profileConfirmationRequired,profileDeleted,profileCancelled,profileLateRejected,profileFreshOnly};
              }
              const oldRoot=document.querySelector('[data-workbench-react-root]');
              const beforeNavigation=authenticatedReads;
              const link=document.createElement('a');
              link.href='/?repositoryId=repository.unavailable';
              link.textContent='固定navigation反証';
              document.querySelector('#connection').append(link);
              link.click();
              const navigated=await wait(()=>location.search.includes('repositoryId=repository.unavailable') && document.querySelector('#ai-profiles')?.innerText.includes('未取得'));
              const credentialRetained=authenticatedReads>beforeNavigation;
              const rootRetained=document.querySelector('[data-workbench-react-root]')===oldRoot;
              const inheritedLink=document.createElement('a'); inheritedLink.href='/?inherited=true';
              document.querySelector('#connection').append(inheritedLink); inheritedLink.click();
              const inheritedSelection=await wait(()=>location.search.includes('inherited=true') && new URL(location.href).searchParams.get('repositoryId')==='repository.unavailable' && document.querySelector('#ai-profiles')?.innerText.includes('未取得'));
              const inheritedSearch=document.createElement('form'); inheritedSearch.method='get'; inheritedSearch.action='/';
              document.querySelector('#connection').append(inheritedSearch); inheritedSearch.requestSubmit();
              const inheritedSearchSelection=await wait(()=>!location.search.includes('inherited=true') && new URL(location.href).searchParams.get('repositoryId')==='repository.unavailable' && document.querySelector('#ai-profiles')?.innerText.includes('未取得'));
              const guardResults=[];
              for(const kind of ['external','download','blank','modified','post']) {
                const node=document.createElement(kind==='post'?'form':'a');
                if(kind==='post'){node.method='post';node.action='/';} else {node.href=kind==='external'?'https://example.invalid/':'/';}
                if(kind==='download')node.setAttribute('download','fixture');
                if(kind==='blank')node.setAttribute('target','_blank');
                oldRoot.append(node);
                const type=kind==='post'?'submit':'click'; let untouched=false;
                const stopNative=event=>{untouched=!event.defaultPrevented;event.preventDefault();};
                window.addEventListener(type,stopNative,{once:true});
                const before=modelReads;
                node.dispatchEvent(kind==='post'?new SubmitEvent('submit',{bubbles:true,cancelable:true}):new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:kind==='modified'}));
                node.remove(); await new Promise(resolve=>setTimeout(resolve,20));
                guardResults.push(untouched && modelReads===before);
              }
              const nativeGuards=guardResults.every(Boolean);
              const search=document.createElement('form'); search.method='get'; search.action='/';
              const selection=document.createElement('input'); selection.name='repositoryId'; selection.value='repository.next';
              search.append(selection); document.querySelector('#connection').append(search); search.requestSubmit();
              const searched=await wait(()=>location.search.includes('repositoryId=repository.next') && document.querySelector('#ai-profiles')?.innerText.includes('未取得'));
              history.back();
              const returned=await wait(()=>location.search.includes('repositoryId=repository.unavailable') && document.querySelector('#ai-profiles')?.innerText.includes('未取得'));
              const lateModel=await (await originalFetch('/api/workbench-view', {headers:{authorization:'Bearer '+key}})).json();
              const measuredFetch=window.fetch; let releaseLate;
              window.fetch=(input, options)=>new URL(String(input),location.href).searchParams.get('navigationDelay')==='true'
                ? new Promise(resolve=>{releaseLate=resolve;}) : measuredFetch(input,options);
              const delayedLink=document.createElement('a'); delayedLink.href='/?repositoryId=repository.unavailable&navigationDelay=true';
              document.querySelector('#connection').append(delayedLink); delayedLink.click(); delayedLink.remove();
              const newerLink=document.createElement('a'); newerLink.href='/?repositoryId=repository.latest';
              oldRoot.append(newerLink); newerLink.click(); newerLink.remove();
              const latest=await wait(()=>location.search.includes('repositoryId=repository.latest') && document.querySelector('#ai-profiles')?.innerText.includes('未取得'));
              releaseLate(new Response(JSON.stringify({...lateModel,notice:'遅延応答の反例'}),{headers:{'content-type':'application/json'}}));
              await new Promise(resolve=>setTimeout(resolve,100));
              const lateRejected=latest && !document.body.innerText.includes('遅延応答の反例') && location.search.includes('repositoryId=repository.latest');
              const selectedRootMatched=document.querySelector('[data-repository-id]')?.dataset.repositoryId==='repository.latest';
              const sharedControlsBounded=document.querySelector('#topics')?.closest('fieldset')?.disabled===false && document.querySelector('#repository')?.closest('fieldset')?.disabled===false && document.querySelector('#ai-request select[name=profileId]')?.disabled===true;
              window.fetch=measuredFetch;
              const portal=document.createElement('a'); portal.href='/?repositoryId='; oldRoot.append(portal); portal.click(); portal.remove();
              await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='disconnect');
              document.querySelector('#connection form').requestSubmit();
              const disconnected=await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='connect' && !document.querySelector('#connection button')?.disabled);
              document.querySelector('#connection input[name=token]').value=key;
              document.querySelector('#connection form').requestSubmit();
              const reconnected=await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='disconnect' && !document.querySelector('#connection button')?.disabled);
              let releaseHidden, hiddenSignal, resumedAuthorization='not_observed';
              window.fetch=(input,options)=>{
                if(new URL(String(input),location.href).searchParams.get('pagehideDelay')==='true') {
                  hiddenSignal=options?.signal;
                  return new Promise(resolve=>{releaseHidden=resolve;});
                }
                resumedAuthorization=new Headers(options?.headers).get('authorization');
                return measuredFetch(input,options);
              };
              const hiddenLink=document.createElement('a'); hiddenLink.href='/?pagehideDelay=true'; oldRoot.append(hiddenLink); hiddenLink.click(); hiddenLink.remove();
              const pending=await wait(()=>typeof releaseHidden==='function');
              window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted:true}));
              const closed=document.querySelector('[data-workbench-react-root]')?.childElementCount===0;
              const cancelled=pending && hiddenSignal?.aborted===true;
              releaseHidden(new Response(JSON.stringify({...lateModel,notice:'終了後応答の反例'}),{headers:{'content-type':'application/json'}}));
              await new Promise(resolve=>setTimeout(resolve,100));
              const hiddenRejected=oldRoot.childElementCount===0 && !document.body.innerText.includes('終了後応答の反例');
              window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}));
              const resumed=await wait(()=>document.querySelector('#connection input[name=operation]')?.value==='connect');
              const resumedWithoutCredential=resumedAuthorization===null;
              return {connected,inputCleared,secretAbsent,nextGetAuthenticated,profileReady,navigated,credentialRetained,rootRetained,inheritedSelection,inheritedSearchSelection,nativeGuards,searched,returned,lateRejected,selectedRootMatched,sharedControlsBounded,disconnected,reconnected,closed,cancelled,hiddenRejected,resumed,resumedWithoutCredential,posts};
            } catch {return {failedWait:waitNumber,posts,profilePosts};} finally {window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          mode === "profile-developer" ? "single" : "composite",
        );
        const profileExpected = {
          connected: true,
          inputCleared: true,
          secretAbsent: true,
          nextGetAuthenticated: true,
          profileReady: true,
          profileCreated: true,
          profileSingleCreate: true,
          profileUpdated: true,
          savedReadFailure: true,
          noReadFailureResend: true,
          savedFreshRead: true,
          explicitReadNoPost: true,
          savedReason: "saved-before-read-failure",
          responseUnconfirmed: true,
          noResponseLossResend: true,
          responseFreshRead: true,
          explicitResponseReadNoPost: true,
          responseReason: "saved-before-response-loss",
          profileConfirmationRequired: true,
          profileDeleted: true,
        };
        assert.deepEqual(
          observed,
          mode === "profile-developer"
            ? {
                connected: true,
                inputCleared: true,
                secretAbsent: true,
                nextGetAuthenticated: true,
                unavailable: true,
                catalogAbsent: true,
                formAbsent: true,
                profilePosts: 0,
              }
            : mode === "profile-manager"
              ? {
                  ...profileExpected,
                  profileCancelled: true,
                  profileLateRejected: true,
                  profileFreshOnly: true,
                }
              : {
                  connected: true,
                  inputCleared: true,
                  secretAbsent: true,
                  nextGetAuthenticated: true,
                  profileReady: true,
                  navigated: true,
                  credentialRetained: true,
                  rootRetained: true,
                  inheritedSelection: true,
                  inheritedSearchSelection: true,
                  nativeGuards: true,
                  searched: true,
                  returned: true,
                  lateRejected: true,
                  selectedRootMatched: true,
                  sharedControlsBounded: true,
                  disconnected: true,
                  reconnected: true,
                  closed: true,
                  cancelled: true,
                  hiddenRejected: true,
                  resumed: true,
                  resumedWithoutCredential: true,
                  posts: 3,
                },
        );
        if (mode === "profile-manager") {
          for (const viewport of [
            { name: "desktop", width: 1440, height: 900 },
            { name: "tablet", width: 1024, height: 768 },
            { name: "mobile", width: 390, height: 844 },
          ]) {
            const layout = await requestBrowser(
              pageUrl,
              "Runtime.evaluate",
              {
                expression: `(async()=>{
                await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                const panel=document.querySelector('#ai-profile-administration');
                const form=panel.querySelector('.ai-profile-administration-form');
                const rect=panel.getBoundingClientRect();
                const controls=[...form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),select,button')];
                const targetSizes=controls.every(control=>{const r=control.getBoundingClientRect();return r.width>=32 && r.height>=32;});
                const fontSizes=controls.every(control=>Number.parseFloat(getComputedStyle(control).fontSize)>=12);
                form.querySelector('[name=profileId]').focus();
                return {width:innerWidth,height:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,panelContained:rect.left>=-1 && rect.right<=innerWidth+1,targetSizes,fontSizes,formPresent:controls.length>0};
              })()`,
                awaitPromise: true,
                returnByValue: true,
              },
              viewport,
            );
            assert.deepEqual(
              layout,
              {
                width: viewport.width,
                height: viewport.height,
                pageOverflow: false,
                panelContained: true,
                targetSizes: true,
                fontSizes: true,
                formPresent: true,
                keyboardNext: true,
              },
              `profile_layout_${viewport.name}`,
            );
          }
        }
        assert.deepEqual(JSON.parse(await readFile(current, "utf8")), state);
        return;
      }
      if (mode === "cros-management") {
        const connected = await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async () => {
            const form=document.querySelector('#connection form');
            form.elements.namedItem('token').value=${JSON.stringify(material.token)};
            form.requestSubmit();
            const end=Date.now()+15000;
            while(Date.now()<end) {
              if(document.querySelector('#access-management form') && !document.querySelector('#connection button')?.disabled) return true;
              await new Promise(r=>setTimeout(r,50));
            }
            return false;
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        assert.equal(connected, true);
      }
      if (mode === "management" || mode === "cros-management") {
        assert.ok(registrationRoot);
        const contextPath = path.join(registrationRoot, "PROJECT_CONTEXT.md");
        let contentReads = 0;
        const originalOpen = fs.openSync;
        const contentObservation = context.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof fs.openSync>) => {
            if (String(args[0]) === contextPath) contentReads++;
            return originalOpen(...args);
          },
        );
        syncBuiltinESMExports();
        let observed: unknown;
        try {
          const probe = fs.openSync(contextPath, "r");
          fs.closeSync(probe);
          assert.equal(contentReads, 1, "content_observer_positive_control");
          contentReads = 0;
          observed = await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: managementBrowserExpression(
              mode === "cros-management",
              mode === "cros-management" ? material.token : undefined,
              registrationRoot,
            ),
            awaitPromise: true,
            returnByValue: true,
          });
        } finally {
          contentObservation.mock.restore();
          syncBuiltinESMExports();
        }
        if (mode === "cros-management")
          assert.equal(
            contentReads,
            1,
            "registration_identity_read_once_and_denied_content_reader_additional_zero",
          );
        const saved = JSON.parse(
          await readFile(current, "utf8"),
        ) as AccessManagementState;
        if (mode === "cros-management")
          assert.equal(saved.users[0]?.role, "manager");
        assert.deepEqual(observed, {
          registered: true,
          renamed: true,
          roleChanged: true,
          contentChanged: true,
          repositoryRegistered: true,
          registrationNotPublished: true,
          exposureChanged: true,
          repositoryRemoved: true,
          selfContentRejected: true,
          postCount: mode === "cros-management" ? 11 : 7,
          resultFocused: true,
          storageEmpty: true,
          registrationPresent: true,
          rejectedVisible: true,
          unknownVisible: true,
          cleanupVisible: true,
          responseLossVisible: true,
          retiredHeaderRejected: true,
          retiredHeaderPostZero: true,
          retiredConnectionSurfaceAbsent: true,
        });
        assert.equal(saved.users.length, 3);
        assert.equal(saved.users.at(-1)?.username, "管理画面改名");
        assert.equal(saved.users.at(-1)?.role, "manager");
        assert.deepEqual(
          saved.roleContentAccess.find(
            (row) =>
              row.role ===
              (mode === "cros-management" ? "manager" : "developer"),
          )?.workspaceIds,
          [],
        );
        assert.equal(saved.credentials.length, 1);
        assert.deepEqual(saved.registeredRepositories, []);
        assert.deepEqual(saved.exposure, []);
        assert.ok(registrationRoot);
        assert.equal(existsSync(registrationRoot), true);
        assert.match(
          await readFile(
            path.join(registrationRoot, "PROJECT_CONTEXT.md"),
            "utf8",
          ),
          /自己生成試験。/u,
        );
        if (mode === "cros-management")
          assert.equal(
            saved.users.some((user) => user.role === "administrator"),
            false,
          );
        return;
      }
      const observed = await requestBrowser(pageUrl, "Runtime.evaluate", {
        expression: credentialBrowserExpression(mode),
        awaitPromise: true,
        returnByValue: true,
      });
      assert.deepEqual(observed, {
        shown: true,
        firstPostOnce: true,
        getSecretAbsent: true,
        urlSecretAbsent: true,
        storageSecretAbsent: true,
        previousCleared: true,
        failedResponseNoSuccess: true,
        oldConnectionUnavailable: true,
        postCount: mode === "issue" ? 2 : 1,
      });
      await requestBrowser(pageUrl, "Page.reload");
      let reloaded: unknown;
      for (let attempt = 0; attempt < 10 && reloaded === undefined; attempt++) {
        await delay(250);
        try {
          reloaded = await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `(async () => { const end = Date.now()+15000; while(Date.now()<end) { if(document.querySelector('#workbench-client-ready')) return { ready:true, keyAbsent:!document.querySelector('.one-time-token code'), storageEmpty:localStorage.length===0 && sessionStorage.length===0 }; await new Promise(r=>setTimeout(r,50)); } return { ready:false }; })()`,
            awaitPromise: true,
            returnByValue: true,
          });
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== "credential_browser_context_replaced"
          )
            throw error;
        }
      }
      assert.deepEqual(reloaded, {
        ready: true,
        keyAbsent: true,
        storageEmpty: true,
      });
      const saved = JSON.parse(
        await readFile(current, "utf8"),
      ) as AccessManagementState;
      assert.equal(saved.unresolvedKeyExchanges.length, 0);
      assert.equal(saved.credentials[0]?.revoked, mode !== "issue");
      assert.equal(saved.credentials.at(-1)?.presentation, "confirmed");
      assert.equal(saved.credentials.length, 2);
    });
});
