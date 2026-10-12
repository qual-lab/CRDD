/**
 * 実Browserで鍵の短命表示と接続失効を検証する。
 * @packageDocumentation
 * @responsibility 本番CSRの操作・表示・消去を自己生成AM Rootと専用Chromeで観測する。
 * @trace RFD-ST-016
 * @trace ERB-ST-022
 * @level ST
 * @scope 同Process鍵管理、専用POST、DOM、再読込、秘密非保持、所有資源回収。
 * @boundary Workbench本番Server→本番Bundle→専用Browser→AM保存Owner。
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
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
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  closeOwnedBrowserProcessTree,
  observeLocalListener,
} from "../../../visual-preview/src/browser/verify-visual.ts";
import { startWorkbench } from "../../src/index.ts";

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
 * @input 同じ操作のlocalhost Endpoint、固定methodとparams。
 * @returns Runtime評価のboolean/counterだけ。その他はtrue。
 * @precondition 利用者入力・Network本文・Header・画像を要求しない。
 * @postcondition WebSocketのclose後だけ完了する。
 * @effect Runtime評価、再読込またはBrowser正常終了を一回発行する。
 * @failure 期限・Protocol・評価失敗は機密を含まない固定Error。
 * @invariant CDPの例外descriptionや任意Response本文をログへ搬送しない。
 * @boundary 試験専用localhost DevTools。
 * @security 鍵比較はBrowser内だけで行う。
 * @concurrency Request ID1だけ受理し、ListenerとTimerをclose時に回収する。
 */
async function requestBrowser(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const socket = new WebSocket(url);
  return await new Promise((resolve, reject) => {
    let sent = false,
      settled = false,
      outcome: unknown,
      failure: Error | null = null;
    const timer = setTimeout(() => {
      failure = new Error("credential_browser_protocol_timeout");
      socket.close();
    }, 25_000);
    socket.addEventListener("open", () => {
      sent = true;
      socket.send(JSON.stringify({ id: 1, method, params }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const reply = JSON.parse(String(event.data));
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
      failure = new Error("credential_browser_protocol_failed");
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
      if(String(args[0]) === '/connection-credentials/action') {
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
 * 通常発行・本人交換・全員交換のBrowser lifecycleを実環境で確認する。
 * @responsibility HTTPだけでは見えない表示・消去・再読込・接続失効を反証する。
 * @trace RFD-ST-016
 * @trace ERB-ST-022
 * @precondition 対応ChromeとBuild済み本番Bundleを使用する。
 * @stimulus 三つの自己生成AM状態へ実Browserから重複submit・失敗・reloadを適用する。
 * @observation boolean/counter、非秘密保存状態、Browser/Listener/Profile終了だけ取得する。
 * @oracle 鍵一度表示、POST一回、秘密非保持、失敗後完了0、交換後旧接続利用可0。
 * @cleanup 既存Browser所有Tree終了処理とServer close後、検証した自己生成Rootだけ削除する。
 * @boundary 本番Server／本番CSR／専用Browser／AMのSystem境界。
 */
test("実Browserの鍵提示は短命で交換後の旧接続を継続しない", {
  timeout: 180_000,
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
  for (const mode of ["issue", "self", "all"] as const)
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
      await writeFile(current, JSON.stringify(state));
      const root = createFilesystemStoreRoot(access);
      assert.ok(root);
      const handle = await startWorkbench({
        workingDirectory: repositoryRoot,
        credentialAdministration: { root, token: material.token },
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
              expression: `(async () => { const end=Date.now()+15000; while(Date.now()<end) { if(document.querySelector('#credential-administration form') && document.readyState==='complete') return true; await new Promise(r=>setTimeout(r,100)); } return false; })()`,
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
