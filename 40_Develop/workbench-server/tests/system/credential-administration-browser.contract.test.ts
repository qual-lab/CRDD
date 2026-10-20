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
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs, { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createCredentialMaterial } from "../../../access-management/src/credential/token.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/repository/binding.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import {
  createAiProfileCatalogAdministration,
  createHostAiProfileCatalogStore,
} from "../../../ai-adapter/src/index.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { prepareWorkspaceSurface } from "../../../orchestrator/tests/fixtures/workspace-surface.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  closeOwnedBrowserProcessTree,
  observeLocalListener,
} from "../../../visual-preview/src/index.ts";
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
 * @stimulus 許可済みRoot直下の固定tests Directoryを作成する。
 * @observation 返却Pathと固定Directoryの存在。
 * @oracle 入力Rootの外へfallbackせず既存共有領域を削除しない。
 * @cleanup mode別自己生成Directoryは親Caseが回収し共有tests Rootは保持する。
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
 * @stimulus 同じProfileのDevToolsActivePortを期限内で再読取りする。
 * @observation portとbrowserPath、元Processの終了有無。
 * @oracle 正規localhost相関が成立しない限り起動成功を返さない。
 * @cleanup 所有BrowserとProfileはCaseのafterで終了・不存在を確認する。
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
 * @input 同じ操作のlocalhost Endpoint、固定methodとparams、任意Profile表示領域、固定の単一／複合評価区分、省略可能な閉じた評価地点。
 * @returns Runtime評価のboolean／counter／非秘密寸法。その他はtrue。
 * @precondition 利用者入力・Network本文・Header・画像を要求しない。
 * @postcondition WebSocketのclose後だけ完了する。
 * @effect Runtime評価、再読込またはBrowser正常終了。Profile時は表示領域設定と固定Tab操作。
 * @failure 期限・Protocol・評価失敗は機密を含まない固定Error。
 * @invariant CDPの例外descriptionや任意Response本文をログへ搬送しない。
 * @boundary 試験専用localhost DevTools。
 * @security 鍵比較はBrowser内だけで行う。
 * @concurrency 通常はID1、Profileは同一接続内でID0設定→1計測／focus→2 keyDown→3 keyUp→4 focus確認を順次受理し、成功・失敗ともcloseでTimerを回収する。
 * @stimulus 固定methodとparamsを所有Browserへ送る。
 * @observation 相関IDの応答、有限計測値、WebSocket close。
 * @oracle 不正相関・期限・評価失敗を固定Errorとして返す。
 * @cleanup 成功失敗ともTimerとWebSocketをcloseまで回収する。
 */
async function requestBrowser(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
  viewport?: Readonly<{ width: number; height: number }>,
  evaluation: "single" | "composite" = "single",
  evaluationStep?:
    | "document_ready"
    | "local_reload"
    | "local_partial_conflict"
    | "local_partial_unavailable"
    | "local_ready"
    | "local_connect"
    | "local_navigation",
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
          const errorClass =
            reply.result?.exceptionDetails?.exception?.className;
          const category = [
            "TypeError",
            "ReferenceError",
            "SyntaxError",
          ].includes(errorClass)
            ? `_${errorClass}`
            : "";
          failure = new Error(
            diagnostic.includes("Execution context was destroyed") ||
              diagnostic.includes("Cannot find context")
              ? "credential_browser_context_replaced"
              : evaluationStep === undefined
                ? "credential_browser_evaluation_failed"
                : `credential_browser_evaluation_failed_${evaluationStep}${category}`,
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
 * Browser評価の失敗は閉じた地点だけを伴い機密を返さない。
 * @responsibility 実requestBrowserの失敗拒否と固定診断を有限Transportで確認する。
 * @trace RFD-ST-003
 * @precondition WebSocketだけを同Process内の有限応答へ置換する。
 * @stimulus 機密風description付き評価失敗を地点あり・なしで返す。
 * @observation 拒否理由、cause非保持、正常応答値とclose後の完了。
 * @oracle 生例外を返さず地点なしは従来理由、地点ありは固定理由のまま拒否する。
 * @cleanup finallyで元WebSocketを復元し各要求のTimerをcloseで解除する。
 * @boundary CDP応答の局所搬送だけ。実Browserや外部通信は発行しない。
 */
test("Browser評価失敗の診断は固定地点だけを公開する", async () => {
  const original = globalThis.WebSocket;
  let reply: unknown;
  class ProtocolSocket extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    send() {
      queueMicrotask(() =>
        this.dispatchEvent(
          new MessageEvent("message", {
            data: JSON.stringify(reply),
          }),
        ),
      );
    }
    close() {
      this.dispatchEvent(new Event("close"));
    }
  }
  globalThis.WebSocket = ProtocolSocket as unknown as typeof WebSocket;
  try {
    for (const step of [
      undefined,
      "document_ready",
      "local_reload",
      "local_partial_conflict",
      "local_partial_unavailable",
      "local_ready",
      "local_connect",
      "local_navigation",
    ] as const) {
      reply = {
        id: 1,
        result: {
          exceptionDetails: {
            exception: { description: "fixture-secret-token-never-output" },
          },
        },
      };
      await assert.rejects(
        requestBrowser(
          "ws://fixture.invalid",
          "Runtime.evaluate",
          {},
          undefined,
          "single",
          step,
        ),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(
            error.message,
            step === undefined
              ? "credential_browser_evaluation_failed"
              : `credential_browser_evaluation_failed_${step}`,
          );
          assert.equal(error.cause, undefined);
          assert.equal(
            String(error).includes("fixture-secret-token-never-output"),
            false,
          );
          return true;
        },
      );
    }
    for (const className of [
      "TypeError",
      "ReferenceError",
      "SyntaxError",
      "fixture-secret-class-never-output",
    ]) {
      reply = {
        id: 1,
        result: {
          exceptionDetails: {
            exception: {
              className,
              description: "fixture-secret-description-never-output",
            },
          },
        },
      };
      await assert.rejects(
        requestBrowser(
          "ws://fixture.invalid",
          "Runtime.evaluate",
          {},
          undefined,
          "single",
          "document_ready",
        ),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(
            error.message,
            `credential_browser_evaluation_failed_document_ready${className.startsWith("fixture-") ? "" : `_${className}`}`,
          );
          assert.equal(String(error).includes("fixture-secret"), false);
          assert.equal(error.cause, undefined);
          return true;
        },
      );
    }
    reply = {
      id: 1,
      result: {
        exceptionDetails: {
          exception: {
            className: "TypeError",
            description:
              "Execution context was destroyed fixture-secret-never-output",
          },
        },
      },
    };
    await assert.rejects(
      requestBrowser(
        "ws://fixture.invalid",
        "Runtime.evaluate",
        {},
        undefined,
        "single",
        "document_ready",
      ),
      { message: "credential_browser_context_replaced" },
    );
    reply = { id: 1, result: { result: { value: true } } };
    assert.equal(
      await requestBrowser(
        "ws://fixture.invalid",
        "Runtime.evaluate",
        {},
        undefined,
        "single",
        "local_ready",
      ),
      true,
    );
  } finally {
    globalThis.WebSocket = original;
  }
});

/**
 * 接続試験の再読込を新Documentの準備まで直列化する。
 * @responsibility reload受理を完了とせず、次の明示送信前に新画面を読取り確認する。
 * @trace ERB-ST-022
 * @precondition 試験が所有する接続画面だけを扱う。
 * @stimulus timeOrigin読取り、reload一回、準備状態の有限読取り。
 * @observation 旧Documentと異なるtimeOrigin・complete・接続入力欄。
 * @oracle Context置換では読取りだけを再評価し、POSTやreloadを再送しない。
 * @cleanup 各requestBrowserがTimerとSocketを回収し、親CaseがBrowserを回収する。
 * @boundary 試験用CDPの受理とDocument生成を分ける。製品の回復機構ではない。
 */
async function reloadConnectionDocument(pageUrl: string): Promise<void> {
  const previous = await requestBrowser(
    pageUrl,
    "Runtime.evaluate",
    {
      expression: "performance.timeOrigin",
      returnByValue: true,
    },
    undefined,
    "single",
    "local_reload",
  );
  assert.equal(typeof previous, "number");
  assert.equal(Number.isFinite(previous), true);
  await requestBrowser(
    pageUrl,
    "Page.reload",
    {},
    undefined,
    "single",
    "local_reload",
  );
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    try {
      if (
        (await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `performance.timeOrigin!==${JSON.stringify(previous)}&&document.readyState==='complete'&&Boolean(document.querySelector('#connection input[name=token]'))`,
            returnByValue: true,
          },
          undefined,
          "single",
          "local_reload",
        )) === true
      )
        return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "credential_browser_context_replaced"
      )
        throw error;
    }
    await delay(100);
  }
  throw new Error("credential_browser_reload_ready_unconfirmed");
}

/**
 * reload応答だけで次操作へ進まないことを合成CDPで検証する。
 * @responsibility Context置換と旧Document準備を次送信の許可にしない。
 * @trace ERB-ST-022
 * @precondition 同Processの有限WebSocket応答だけ。
 * @stimulus reload受理、Context破棄、準備false、準備trueを順に返す。
 * @observation reload一回と読取り要求だけ。
 * @oracle 送信操作を再試行せず新Document条件成立後だけ完了する。
 * @cleanup 元WebSocketを復元し全SocketとTimerをcloseする。
 * @boundary 合成CDPの受理・新Document確認だけ。実Browser成立は別Caseで確認する。
 */
test("Browser再読込は一回だけ発行し新Documentの準備を確認する", async () => {
  const original = globalThis.WebSocket;
  const methods: string[] = [];
  let reads = 0;
  class ReloadSocket extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    send(data: string) {
      const packet = JSON.parse(data);
      methods.push(packet.method);
      let reply: unknown;
      if (packet.method === "Page.reload") reply = { id: 1, result: {} };
      else if (++reads === 1)
        reply = { id: 1, result: { result: { value: 10 } } };
      else if (reads === 2)
        reply = {
          id: 1,
          error: { message: "Execution context was destroyed" },
        };
      else reply = { id: 1, result: { result: { value: reads === 4 } } };
      queueMicrotask(() =>
        this.dispatchEvent(
          new MessageEvent("message", { data: JSON.stringify(reply) }),
        ),
      );
    }
    close() {
      this.dispatchEvent(new Event("close"));
    }
  }
  globalThis.WebSocket = ReloadSocket as unknown as typeof WebSocket;
  try {
    await reloadConnectionDocument("ws://fixture.invalid");
    assert.deepEqual(methods, [
      "Runtime.evaluate",
      "Page.reload",
      "Runtime.evaluate",
      "Runtime.evaluate",
      "Runtime.evaluate",
    ]);
  } finally {
    globalThis.WebSocket = original;
  }
});

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
 * @stimulus 指定modeの資格操作と一回の通信故障を式に組み込む。
 * @observation DOM提示・一要求化・GET/URL/Storageの非保持を示すboolean。
 * @oracle 鍵比較をBrowser内に閉じて秘密値を返却しない。
 * @cleanup 式のfinallyでfetch復元、親CaseがBrowser/Profileを回収する。
 */
function credentialBrowserExpression(mode: "issue" | "self" | "all"): string {
  return `(async () => {
    const mode = ${JSON.stringify(mode)};
    /**
     * 資格Formの描画と一回提示を待つ。
     * @responsibility 資格Formの描画と一回提示を待つ。
     * @trace RFD-ST-016
     * @precondition 資格操作を描画した同Origin画面。
     * @stimulus 15秒内で条件を再評価し成立trueまたは期限falseを返す。
     * @observation Form・短命鍵・旧接続の各条件。
     * @oracle 未成立は親式が固定失敗とし提示成功を捏造しない。
     * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
     * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
     */
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
    /**
     * 指定資格操作とUser IDに一致するFormだけを選ぶ。
     * @responsibility 指定資格操作とUser IDに一致するFormだけを選ぶ。
     * @trace RFD-ST-016
     * @precondition 固定operationとuserId。
     * @stimulus 資格panelのForm集合から二field一致を選ぶ。
     * @observation 対象Formまたはundefined。
     * @oracle 別Userの資格操作をsubmitしない。
     * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
     * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
     */
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
 * @stimulus 通常管理Formの保存と用途限定応答故障を順に操作する。
 * @observation 保存回数、fresh投影、focus、拒否・不明表示のboolean。
 * @oracle 二重submitは一回、再観測だけで暗黙再送をしない。
 * @cleanup Browser内fetchを復元しServerとProfileを親Caseが回収する。
 */
function managementBrowserExpression(
  exerciseFailures = false,
  reconnectionToken?: string,
  registrationRoot?: string,
): string {
  return `(async () => {
    /**
     * 管理Formの保存後描画を有限時間で待つ。
     * @responsibility 管理Formの保存後描画を有限時間で待つ。
     * @trace RFD-ST-022
     * @trace EST-ST-013
     * @precondition 本番管理CSRを同Originで評価している。
     * @stimulus 15秒の条件再観測後、未成立なら固定例外。
     * @observation 対象Formと保存結果の再描画。
     * @oracle 期限切れを正常な管理保存完了として返さない。
     * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
     * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
     */
    const waitFor = async (condition) => { const end=Date.now()+15000; while(Date.now()<end) { if(condition()) return true; await new Promise(r=>setTimeout(r,50)); } throw new Error('management_browser_wait_failed'); };
    /**
     * 通常管理の現在panelだけを取得する。
     * @responsibility 通常管理の現在panelだけを取得する。
     * @trace RFD-ST-022
     * @trace EST-ST-013
     * @precondition 本番管理画面。
     * @stimulus access-managementのDOMを選ぶ。
     * @observation 現在panelまたはnull。
     * @oracle 他panelを管理Formの代用にしない。
     * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
     * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
     */
    const panel = () => document.querySelector('#access-management');
    /**
     * 管理操作と任意field値に一致するFormを選ぶ。
     * @responsibility 管理操作と任意field値に一致するFormを選ぶ。
     * @trace RFD-ST-022
     * @trace EST-ST-013
     * @precondition 管理panelと固定操作値。
     * @stimulus 同じpanel内のoperation/field値を照合する。
     * @observation 対象Formまたはundefined。
     * @oracle 別Userや別操作のFormへ送信しない。
     * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
     * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
     */
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
      const role = formFor('updateUserRole', 'userId', id); role.elements.namedItem('nextRole').value='manager'; role.requestSubmit();
      const roleChanged = await waitFor(() => panel().querySelector('[role=status]')?.textContent.includes('改訂 4。') && formFor('updateUserRole', 'userId', id)?.elements.namedItem('currentRole').value === 'manager' && !formFor('registerUser').querySelector('button').disabled);
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
            if (suffix === "next") {
              const base = spawnSync("git", ["rev-parse", "HEAD"], {
                cwd: target,
                encoding: "utf8",
                windowsHide: true,
              });
              assert.equal(base.status, 0);
              prepareWorkspaceSurface(
                target,
                "project.fixture",
                base.stdout.trim(),
              );
            }
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
        const catalog = createHostAiProfileCatalogStore({
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
            (await requestBrowser(
              pageUrl,
              "Runtime.evaluate",
              {
                expression: `(async () => { const end=Date.now()+15000; while(Date.now()<end) { if(document.querySelector(${JSON.stringify(mode === "local-connection" || mode === "content-operations" || mode === "artifact-navigation" || mode === "git-operations" || mode === "cros-management" || mode === "profile-manager" || mode === "profile-developer" ? "#connection form" : "#credential-administration form")}) && document.readyState==='complete') return true; await new Promise(r=>setTimeout(r,100)); } return false; })()`,
                awaitPromise: true,
                returnByValue: true,
              },
              undefined,
              "single",
              "document_ready",
            )) === true;
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
            /**
             * Git操作の描画と結果確定を期限内で待つ。
             * @responsibility Git操作の描画と結果確定を期限内で待つ。
             * @trace ERB-ST-022
             * @trace RFD-ST-015
             * @precondition Repository操作の本番DOM。
             * @stimulus 10秒以内のpredicate成立を待つ。
             * @observation 操作Formと固定結果reason。
             * @oracle 期限でgit_ui_unconfirmedとなり次操作へ進まない。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('git_ui_unconfirmed');};
            /**
             * 指定Git操作の現在Formを選ぶ。
             * @responsibility 指定Git操作の現在Formを選ぶ。
             * @trace ERB-ST-022
             * @precondition 本番Repository panelの固定操作名。
             * @stimulus operation fieldが一致するFormを取得する。
             * @observation prepare・unprepare・Commit・PushのForm。
             * @oracle 別操作の完了を同じ操作の成功に使わない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const form=(operation)=>document.querySelector('#repository form:has([name=operation][value='+operation+'])');
            /**
             * Git結果reasonと操作再開可能を共同確認する。
             * @responsibility Git結果reasonと操作再開可能を共同確認する。
             * @trace ERB-ST-022
             * @precondition 同じGit操作の結果表示。
             * @stimulus 結果本文のreasonとfieldsetのdisabledを読む。
             * @observation 同じreasonの表示と有効化の真偽。
             * @oracle 結果表示だけで待機中の処理を完了としない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
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
        const workspace = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            /**
             * Workspace操作の受付と再取得表示を待つ。
             * @responsibility Workspace操作の受付と再取得表示を待つ。
             * @trace ERB-ST-022
             * @precondition 本番Workspace panelと有限応答故障。
             * @stimulus 10秒内で対象UI条件を再観測する。
             * @observation 受付一覧・結果未確認・終了表示。
             * @oracle 未確認応答を成功とせず期限で停止する。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('workspace_ui_unconfirmed');};
            /**
             * Workspace panelと現在操作要素を同じ対象から取得する。
             * @responsibility Workspace panelと現在操作要素を同じ対象から取得する。
             * @trace ERB-ST-022
             * @precondition Workspace画面を描画した状態。
             * @stimulus panel・表示名一致button・statusを同じDOMから読む。
             * @observation 操作要素と固定表示。
             * @oracle 不正応答時に別Workspaceの表示を採用しない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const panel=()=>document.querySelector('#workspaces'), button=(text)=>[...panel().querySelectorAll('button')].find(b=>b.textContent===text), notice=()=>panel().querySelector('[role=status]')?.textContent;
            const originalFetch=window.fetch;let creates=0,renames=0,corrupt=false;
            window.fetch=async(input,options)=>{const route=new URL(String(input),location.href).pathname;const command=route==='/workspace/action'?JSON.parse(new URLSearchParams(String(options.body)).get('command')):null;if(command?.operation==='create')creates++;if(command?.operation==='rename')renames++;const response=await originalFetch(input,options);if(corrupt===true&&command?.operation==='rename'){await response.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}if(typeof corrupt==='string'&&command?.operation==='get'){const result=await response.json();if(corrupt==='wrong-id')result.data.workspace.workspaceId='00000000-0000-4000-8000-000000000099';if(corrupt==='bad-paths')result.data.changedPaths=[{}];if(corrupt==='fixture-paths')result.data.changedPaths=['synthetic-changed.txt'];return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}if(corrupt==='bad-status'&&command?.operation==='rename'){const result=await response.json();result.data.status='made-up';return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}return response;};
            try{
              button('受付一覧を再取得').click();await wait(()=>panel().querySelector('select')?.options.length===3);
              const queue=panel().querySelector('select');queue.value='queue-a';queue.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>requestAnimationFrame(resolve));
              const create=button('独立した作業領域を作成');create.click();create.click();await wait(()=>notice()?.includes('操作完了')&&!!button('状態・変更一覧を再取得'));
              const singleCreate=creates===1;
              corrupt=true;button('表示名を変更').click();await wait(()=>notice()?.includes('結果未確認'));await new Promise(resolve=>setTimeout(resolve,80));const noResend=renames===1;
              corrupt=false;button('受付一覧を再取得').click();await wait(()=>notice()?.includes('受付を選択')&&!!button('状態・変更一覧を再取得'));
              const fresh=renames===1&&!notice()?.includes('結果未確認');
              const invalidResults=[];
              for(const kind of ['wrong-id','bad-paths','bad-status']){
                // 不正status時の表示保持を非空の合成一覧で反証する。Git差分の実在主張とは別。
                if(kind==='bad-status'){corrupt='fixture-paths';button('状態・変更一覧を再取得').click();await wait(()=>panel().querySelector('.table-scroll')?.textContent.includes('synthetic-changed.txt'));}
                const before=panel().querySelector('dl').textContent, beforePaths=panel().querySelector('.table-scroll')?.textContent;corrupt=kind;
                button(kind==='bad-status'?'表示名を変更':'状態・変更一覧を再取得').click();await wait(()=>notice()?.includes('結果未確認'));
                const unchanged=panel().querySelector('dl').textContent===before&&panel().querySelector('.table-scroll')?.textContent===beforePaths, count=renames;
                button('表示名を変更').click();await new Promise(resolve=>setTimeout(resolve,80));
                const noExtra=renames===count;corrupt=false;button('状態・変更一覧を再取得').click();await wait(()=>notice()?.includes('現在の作業領域と変更を取得'));
                invalidResults.push(unchanged&&noExtra);
              }
              const check=[...panel().querySelectorAll('input[type=checkbox]')].find(input=>input.closest('label')?.textContent.includes('未採用変更'));check.click();await new Promise(resolve=>requestAnimationFrame(resolve));button('この独立作業領域を終了・破棄').click();await wait(()=>notice()?.includes('操作完了')&&!!button('独立した作業領域を作成'));
              return {singleCreate,noResend,fresh,invalidResults,ended:!button('状態・変更一覧を再取得')};
            }finally{window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.deepEqual(workspace, {
          singleCreate: true,
          noResend: true,
          fresh: true,
          invalidResults: [true, true, true],
          ended: true,
        });
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
            /**
             * Git応答故障後の拒否・不明表示を待つ。
             * @responsibility Git応答故障後の拒否・不明表示を待つ。
             * @trace ERB-ST-022
             * @precondition 実Git操作に用途限定fetch故障を加えた画面。
             * @stimulus 10秒内の結果または再取得条件を待つ。
             * @observation 既知保存・不明・再取得後Form。
             * @oracle 表示未成立ならgit_fault_unconfirmedとして停止する。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('git_fault_unconfirmed');};
            /**
             * Git故障試験の現在操作Formを取得する。
             * @responsibility Git故障試験の現在操作Formを取得する。
             * @trace ERB-ST-022
             * @precondition 固定Git操作名と現在Repository画面。
             * @stimulus operation selectorでFormを選ぶ。
             * @observation 再取得後の対象Form。
             * @oracle 不明応答中の古いFormを次操作へ再使用しない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const form=(operation)=>document.querySelector('#repository form:has([name=operation][value='+operation+'])');
            /**
             * Git故障時の結果案内を現在表示から読む。
             * @responsibility Git故障時の結果案内を現在表示から読む。
             * @trace ERB-ST-022
             * @precondition repository-operation-surfaceがある。
             * @stimulus 同surfaceのstatus本文を読む。
             * @observation 拒否・既知保存・結果未確認の案内。
             * @oracle 異なる分類を同じ完了通知へ畳まない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
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
            /**
             * 成果物の対象切替後の本文描画を待つ。
             * @responsibility 成果物の対象切替後の本文描画を待つ。
             * @trace ERB-ST-022
             * @precondition 本番Artifact詳細の遷移前画面。
             * @stimulus 10秒以内の選択対象と本文条件を検査する。
             * @observation 対象本文と見出し表示。
             * @oracle 旧対象の本文を新対象の完了表示に使わない。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('artifact_navigation_unconfirmed');};
            /**
             * 成果物の同Originリンク遷移を本番CSRへ届ける。
             * @responsibility 成果物の同Originリンク遷移を本番CSRへ届ける。
             * @trace ERB-ST-022
             * @precondition 固定された同Originの試験href。
             * @stimulus 一時anchorをReact Root内へ追加してclickする。
             * @observation CSRの現在対象と表示本文。
             * @oracle 通常のリンク搬送を経て旧対象の遅延結果を採用しない。
             * @cleanup click直後に自分で作成したanchorだけを除去する。
             * @boundary 専用Browser DOM。直接Owner APIで遷移を迂回しない。
             */
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            /**
             * 成果物詳細の正本本文だけを読む。
             * @responsibility 成果物詳細の正本本文だけを読む。
             * @trace ERB-ST-022
             * @precondition artifact-detailの表示。
             * @stimulus canonical-markdownのtextContentを取得する。
             * @observation 現在対象の本文またはundefined。
             * @oracle 一覧や旧詳細本文で新対象表示を代替しない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const body=()=>document.querySelector('#artifact-detail .canonical-markdown')?.textContent;
            try{
              const unsentInput=document.querySelector('#connection input[name=token]');unsentInput.value='synthetic-unsent';const beforeInputHash=reads;click('#connection');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const hashInputPreserved=unsentInput===document.querySelector('#connection input[name=token]')&&unsentInput.value==='synthetic-unsent'&&reads===beforeInputHash;
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
              const beforeSame=reads;stage='same-url';click(location.pathname+location.search);await wait(()=>reads===beforeSame+1&&body()?.includes('原文-next'));
              const sameUrlFresh=reads===beforeSame+1;
              const beforeHash=reads;stage='hash';click('#artifact-detail');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const hashNoRead=reads===beforeHash;
              stage='other';click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>body()?.includes('原文-latest'));
              const otherSource=document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest' && !body().includes('原文-next');
              return {hashInputPreserved,changeSource,textOnly,ownerSource,historyFresh,sameUrlFresh,hashNoRead,otherSource,authenticated:authenticated>0,storageEmpty:localStorage.length===0&&sessionStorage.length===0};
            }catch(error){return{failedStage:stage,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{window.fetch=originalFetch;}
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        assert.deepEqual(observed, {
          hashInputPreserved: true,
          changeSource: true,
          textOnly: true,
          ownerSource: true,
          historyFresh: true,
          sameUrlFresh: true,
          hashNoRead: true,
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
            /**
             * 遅延した成果物応答の非採用を待つ。
             * @responsibility 遅延した成果物応答の非採用を待つ。
             * @trace ERB-ST-022
             * @precondition 旧要求の応答を保留するBrowser式。
             * @stimulus 10秒以内で新対象の表示を再観測する。
             * @observation 新本文と遅延旧本文の非表示。
             * @oracle 遅延旧応答が現在画面を置換したら失敗する。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('artifact_late_unconfirmed');};
            /**
             * 遅延成果物試験の対象切替を本番CSRへ届ける。
             * @responsibility 遅延成果物試験の対象切替を本番CSRへ届ける。
             * @trace ERB-ST-022
             * @precondition 固定された同Originの試験href。
             * @stimulus 一時anchorをReact Root内へ追加してclickする。
             * @observation CSRの現在対象と表示本文。
             * @oracle 通常のリンク搬送を経て旧対象の遅延結果を採用しない。
             * @cleanup click直後に自分で作成したanchorだけを除去する。
             * @boundary 専用Browser DOM。直接Owner APIで遷移を迂回しない。
             */
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            try{
              click('/change?repositoryId=repository.next&id=CHG-000401');await wait(()=>typeof release==='function');stage='switch';click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>document.querySelector('#artifact-detail .canonical-markdown')?.textContent.includes('原文-latest'));
              const cancelled=signal?.aborted===true;release();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const lateRejected=!document.body.innerText.includes('遅延旧本文') && document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest';
              stage='mismatch';corrupt=true;click('/change?repositoryId=repository.next&id=CHG-000401');await wait(()=>document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient==='blocked');
              const mismatchRejected=!document.querySelector('#artifact-detail') && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
              corrupt=false;click('/change?repositoryId=repository.latest&id=CHG-000401');await wait(()=>document.querySelector('#artifact-detail')?.dataset.repositoryId==='repository.latest');
              stage='shared-null';selectionNull=true;click('/change?repositoryId=repository.next&id=CHG-000401');await wait(()=>document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient==='blocked');
              const sharedNullRejected=!document.querySelector('#artifact-detail') && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
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
            let posts=0, reads=0, failRead=false, corruptResponse=false, lastBody=null, stage='connect';
            window.fetch=async(input, options)=>{
              const url=new URL(String(input),location.href);
              if(url.pathname==='/api/workbench-view') reads++;
              if(url.pathname==='/api/workbench-view' && failRead) throw new Error('fixture_read_failure');
              if(url.pathname==='/topic-meeting/action') { posts++; lastBody=String(options.body); }
              const response=await originalFetch(input, options);
              if(url.pathname==='/topic-meeting/action' && corruptResponse) { await response.arrayBuffer(); return new Response('{',{headers:{'content-type':'application/json'}}); }
              return response;
            };
            /**
             * Topic保存とRepository内遷移の描画を待つ。
             * @responsibility Topic保存とRepository内遷移の描画を待つ。
             * @trace CPR-ST-005
             * @precondition 同ProjectのTopic一覧・詳細。
             * @stimulus 10秒以内で指定したDOM条件を再観測する。
             * @observation 保存表示と同Repositoryの本文。
             * @oracle 内容未確定のまま次の操作を開始しない。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000; while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));} throw new Error('content_condition_unconfirmed');};
            /**
             * Topic一覧と詳細の同Repository遷移を届ける。
             * @responsibility Topic一覧と詳細の同Repository遷移を届ける。
             * @trace CPR-ST-005
             * @precondition 固定された同Originの試験href。
             * @stimulus 一時anchorをReact Root内へ追加してclickする。
             * @observation CSRの現在対象と表示本文。
             * @oracle 通常のリンク搬送を経て旧対象の遅延結果を採用しない。
             * @cleanup click直後に自分で作成したanchorだけを除去する。
             * @boundary 専用Browser DOM。直接Owner APIで遷移を迂回しない。
             */
            const click=(href)=>{const link=document.createElement('a');link.href=href;document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();};
            /**
             * 内容保存の確認済み案内を読む。
             * @responsibility 内容保存の確認済み案内を読む。
             * @trace CPR-ST-005
             * @precondition 同じrecord-operation-surface。
             * @stimulus 保存確認statusの文字列を検査する。
             * @observation 保存を確認した表示の真偽。
             * @oracle POST送信だけで保存確認表示を成立させない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const saved=()=>document.querySelector('.record-operation-surface [role=status]')?.innerText.includes('保存を確認し');
            /**
             * Topic作成の正規action Formだけを取得する。
             * @responsibility Topic作成の正規action Formだけを取得する。
             * @trace CPR-ST-005
             * @precondition topics panelが現在表示されている。
             * @stimulus actionとoperation=createの双方を照合する。
             * @observation 対象作成Form。
             * @oracle 別種別や旧対象のFormへ登録しない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const createForm=()=>document.querySelector('#topics form[action="/topic-meeting/action"]:has([name=operation][value=create])');
            /**
             * 同Projectの合成Topic本文をBrowser内で組み立てる。
             * @responsibility 同Projectの合成Topic本文をBrowser内で組み立てる。
             * @trace CPR-ST-005
             * @precondition 固定Projectと自己生成Topic ID・見出し。
             * @stimulus 指定ID・titleと改訂をMarkdownへ結合する。
             * @observation 公開Formへ渡すTopic本文。
             * @oracle 正規本文対照を使い保存故障の分類だけを反証する。
             * @cleanup N/A: Browser内の合成文字列のみ。
             * @boundary 実秘密を含まず、返却結果へ本文を搬送しない。
             */
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
              const beforeDeleteReads=reads;
              stage='delete'; deletion.querySelector('[name=confirmed]').checked=true; deletion.requestSubmit();
              await wait(()=>!!document.querySelector('#topics') && document.querySelector('#topics .operation-result')?.innerText.includes('record_deleted'));
              const deletedToSameRepository=location.pathname==='/' && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
              const singleDeleteRead=reads-beforeDeleteReads===1 && posts-beforeDelete===1;
              const afterDeleteReads=reads;
              stage='delete-back';history.back();await wait(()=>reads===afterDeleteReads+1 && !!document.querySelector('#topics') && !document.querySelector('#topics .operation-result')?.innerText.includes('record_deleted'));
              stage='delete-forward';history.forward();await wait(()=>location.hash==='#topics' && !!document.querySelector('#topics'));
              const deleteHistoryConsistent=reads===afterDeleteReads+1 && !document.querySelector('#topics .operation-result')?.innerText.includes('record_deleted');
              return {singleCreate,selectedAfterCreate,detailUpdated,confirmationRequired,deletedToSameRepository,singleDeleteRead,deleteHistoryConsistent,posts};
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
          singleDeleteRead: true,
          deleteHistoryConsistent: true,
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
            /**
             * 内容保存の故障分類とGET再取得を待つ。
             * @responsibility 内容保存の故障分類とGET再取得を待つ。
             * @trace CPR-ST-005
             * @precondition Topic保存応答とGETへ有限故障を注入する。
             * @stimulus 10秒内に保存済み・不明の区別を確認する。
             * @observation 旧本文非表示、固定結果、再取得後本文。
             * @oracle 故障時に保存未成立と決めつけずPOST再送0を保つ。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('content_fault_unconfirmed');};
            /**
             * 保存故障を注入するTopic作成Formを選ぶ。
             * @responsibility 保存故障を注入するTopic作成Formを選ぶ。
             * @trace CPR-ST-005
             * @precondition 現在Topic一覧と固定create操作。
             * @stimulus topics内のcreate Formを選ぶ。
             * @observation 故障注入対象のForm。
             * @oracle 応答故障後に古いFormの再送へ進まない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const createForm=()=>document.querySelector('#topics form:has([name=operation][value=create])');
            /**
             * 同Projectの合成Topic本文をBrowser内で組み立てる。
             * @responsibility 同Projectの合成Topic本文をBrowser内で組み立てる。
             * @trace CPR-ST-005
             * @precondition 固定Projectと自己生成Topic ID・見出し。
             * @stimulus 指定ID・titleと固定初版をMarkdownへ結合する。
             * @observation 公開Formへ渡すTopic本文。
             * @oracle 正規本文対照を使い保存故障の分類だけを反証する。
             * @cleanup N/A: Browser内の合成文字列のみ。
             * @boundary 実秘密を含まず、返却結果へ本文を搬送しない。
             */
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
            /**
             * Topic昇格とMeeting処置の表示を待つ。
             * @responsibility Topic昇格とMeeting処置の表示を待つ。
             * @trace CPR-ST-005
             * @precondition 二つのOutcomeを持つ合成Meeting。
             * @stimulus 10秒内の処置結果とForm有効化を確認する。
             * @observation 昇格先・未処置件数・Close結果。
             * @oracle 早期Close拒否と全件処置後Closeを区別する。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('content_lifecycle_unconfirmed');};
            /**
             * Topic昇格とMeeting処置後のリンク遷移を届ける。
             * @responsibility Topic昇格とMeeting処置後のリンク遷移を届ける。
             * @trace CPR-ST-005
             * @precondition 固定された同Originの試験href。
             * @stimulus 一時anchorをReact Root内へ追加してclickする。
             * @observation CSRの現在対象と表示本文。
             * @oracle 通常のリンク搬送を経て旧対象の遅延結果を採用しない。
             * @cleanup click直後に自分で作成したanchorだけを除去する。
             * @boundary 専用Browser DOM。直接Owner APIで遷移を迂回しない。
             */
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            /**
             * 内容処置reasonとForm有効化を共同確認する。
             * @responsibility 内容処置reasonとForm有効化を共同確認する。
             * @trace CPR-ST-005
             * @precondition 同じ処置のrecord-operation-surface。
             * @stimulus 結果reasonとfieldsetのdisabledを読む。
             * @observation 処置終了と次操作可能の真偽。
             * @oracle 結果だけ現れても待機中は次処置を開始しない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
            const result=(reason)=>document.querySelector('.record-operation-surface .operation-result')?.innerText.includes(reason) && !document.querySelector('.record-operation-surface fieldset')?.disabled;
            /**
             * Meeting処置の指定操作Formだけを取得する。
             * @responsibility Meeting処置の指定操作Formだけを取得する。
             * @trace CPR-ST-005
             * @precondition Meeting詳細に固定操作名がある。
             * @stimulus operation field一致でFormを選ぶ。
             * @observation Outcome処置・Close用の対象Form。
             * @oracle 別操作のFormへ値を書き込まない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
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
              /**
               * 指定Outcomeの処置内容とClose選択をFormへ設定する。
               * @responsibility 指定Outcomeの処置内容とClose選択をFormへ設定する。
               * @trace CPR-ST-005
               * @precondition 合成Meetingの未処置Outcomeと明示close選択。
               * @stimulus 処置Formを開き固定担当・追跡・結果fieldとcheckboxを埋める。
               * @observation 送信対象OutcomeとCloseの真偽。
               * @oracle 一件処置と全件完了を混同せず未選択falseを保持する。
               * @cleanup 親Caseが合成Meetingとfixtureを回収する。
               * @boundary Browser内Form準備。送信は呼出し元が明示する。
               */
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
            /**
             * 内容保存中の対象切替と取消を待つ。
             * @responsibility 内容保存中の対象切替と取消を待つ。
             * @trace CPR-ST-005
             * @precondition 応答を保留した本番内容Form。
             * @stimulus 10秒内で新対象表示と旧要求の非採用を確認する。
             * @observation Signal取消・現在本文・POST件数。
             * @oracle 遅延応答で対象を戻さず再送を発行しない。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw new Error('content_interruption_unconfirmed');};
            /**
             * 処置待機中の新対象リンクを本番CSRへ届ける。
             * @responsibility 処置待機中の新対象リンクを本番CSRへ届ける。
             * @trace CPR-ST-005
             * @precondition 固定された同Originの試験href。
             * @stimulus 一時anchorをReact Root内へ追加してclickする。
             * @observation CSRの現在対象と表示本文。
             * @oracle 通常のリンク搬送を経て旧対象の遅延結果を採用しない。
             * @cleanup click直後に自分で作成したanchorだけを除去する。
             * @boundary 専用Browser DOM。直接Owner APIで遷移を迂回しない。
             */
            const click=(href)=>{const a=document.createElement('a');a.href=href;document.querySelector('[data-workbench-react-root]').append(a);a.click();a.remove();};
            /**
             * 対象切替反例で現在内容操作のFormを選ぶ。
             * @responsibility 対象切替反例で現在内容操作のFormを選ぶ。
             * @trace CPR-ST-005
             * @precondition 応答保留前の固定操作名。
             * @stimulus operation selectorで現在Formを取得する。
             * @observation 同じ要求を発行するForm。
             * @oracle 旧対象への再送や別操作の送信に使わない。
             * @cleanup N/A: DOM読取りのみ。親Caseが所有Browserを終了する。
             * @boundary 本番DOM内の対象選択。Nodeへ秘密値を返さない。
             */
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
                undefined,
                "single",
                expected === "競合あり"
                  ? "local_partial_conflict"
                  : "local_partial_unavailable",
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
              if (expected === "競合あり")
                await reloadConnectionDocument(pageUrl);
            }
          } finally {
            await writeFile(unavailablePath, unavailableBody);
            await writeFile(nextPath, nextBody);
            await reloadConnectionDocument(pageUrl);
          }
          const ready = await requestBrowser(
            pageUrl,
            "Runtime.evaluate",
            {
              expression: `(async()=>{const end=Date.now()+15000;while(Date.now()<end){if(document.querySelector('#connection input[name=token]'))return true;await new Promise(r=>setTimeout(r,50));}return false;})()`,
              awaitPromise: true,
              returnByValue: true,
            },
            undefined,
            "single",
            "local_ready",
          );
          assert.equal(ready, true);
          const setup = await requestBrowser(
            pageUrl,
            "Runtime.evaluate",
            {
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
            },
            undefined,
            "single",
            "local_connect",
          );
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
            /**
             * 接続とProfile操作の現在表示を有限時間で待つ。
             * @responsibility 接続とProfile操作の現在表示を有限時間で待つ。
             * @trace RFD-ST-003
             * @trace ERB-ST-022
             * @precondition 同じBrowser内の接続とProfile画面。
             * @stimulus 待機番号を増やし15秒以内でpredicateを評価する。
             * @observation 接続・資格非表示・現在Role別Profile状態。
             * @oracle 未成立は固定例外にし途中描画を完了としない。
             * @cleanup Timerは各待機で完了し、親CaseがBrowser・Server・Profileを終了確認する。
             * @boundary 専用Browser内DOMの有限観測。返却は非秘密の判定だけ。
             */
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
              /**
               * Profile管理の固定入力を通常Formへ設定する。
               * @responsibility Profile管理の固定入力を通常Formへ設定する。
               * @trace RCM-ST-012
               * @precondition managerの本番Profile Form。
               * @stimulus 操作・Profile ID・固定model・選択Role・理由を設定する。
               * @observation 作成更新削除へ渡す現在Form。
               * @oracle 旧認証を迂回せずProfile Consumerの明示操作だけに使う。
               * @cleanup 親Caseが自己生成ProfileとServer/Browserを終了する。
               * @boundary 本番CSRのProfile管理。実AI要求を発行しない。
               */
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
                /**
                 * Syntheticなリンク操作で既定処理の未消費を観測する。
                 * @responsibility Syntheticなリンク操作で既定処理の未消費を観測する。
                 * @trace ERB-ST-022
                 * @precondition 対象リンクにCase専用Listenerを登録する。
                 * @stimulus 既存defaultPreventedを記録してnative動作だけを抑止する。
                 * @observation 本番Handlerが非対象イベントを消費していない真偽。
                 * @oracle 修飾操作等を通常CSR遷移として横取りしない。
                 * @cleanup 試験内Listenerを解除しBrowserを終了する。
                 * @boundary DOMイベント搬送だけ。新しいWindowや外部通信を開始しない。
                 */
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
          mode === "local-connection" ? "local_navigation" : undefined,
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
          observed = await requestBrowser(
            pageUrl,
            "Runtime.evaluate",
            {
              expression: managementBrowserExpression(
                mode === "cros-management",
                mode === "cros-management" ? material.token : undefined,
                registrationRoot,
              ),
              awaitPromise: true,
              returnByValue: true,
            },
            undefined,
            "composite",
          );
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
