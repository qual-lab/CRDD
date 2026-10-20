/**
 * 専用BrowserのDevTools通信とListener三値観測を所有する。
 * @responsibility 専用BrowserのDevTools通信とListener三値観測を所有する。
 * @trace ARCH-000003
 */
import type { ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import type { ListenerObservation } from "./types.ts";

/**
 * Chrome DevTools Protocolの応答を定義する。
 *
 * @responsibility Request IDと成功・失敗Payloadを型境界へ閉じる。
 * @trace ARCH-000003
 * @shape id、resultまたはerrorで構成する。
 * @invariant resultとerrorの意味を呼出し側が検査する。
 * @boundary WebSocket JSONとProcess内TypeScriptの境界。
 * @security 未検証Payloadを業務結果へ直接採用しない。
 * @compatibility Runtime.evaluateが返す最小Shapeだけを利用する。
 */
type DevToolsResponse = Readonly<{
  id?: number;
  result?: Readonly<{
    result?: Readonly<{ value?: unknown }>;
    exceptionDetails?: Readonly<{
      text?: string;
      exception?: Readonly<{ description?: string }>;
    }>;
  }>;
  error?: unknown;
}>;

/**
 * DevTools Endpointが終了後に利用不能であることを確認する。
 *
 * @responsibility Browser終了後に同じDebugger Listenerが残っていないことを観測する。
 * @trace ARCH-000003
 * @input portに同じBrowserが使用したlocalhost DevTools Portを受け取る。
 * @returns 接続拒否ならabsent、接続成立ならpresent、観測不能ならunknownを返す。
 * @precondition portはwaitForDevToolsが同じ専用Profileから取得した値である。
 * @postcondition 外部Hostへ接続しない。
 * @effect localhost HTTP GETを限定回数実行する。
 * @failure timeout、Abortまたは分類不能Errorはunknownとし不存在へ畳まない。
 * @invariant 応答本文やEndpointを結果へ保存しない。
 * @boundary Chrome DevTools localhost Listenerの終了後観測境界。
 * @security localhost以外へ送信しない。
 * @concurrency 終了直後の遅延を最大5秒間再観測する。
 */
export async function confirmDevToolsUnavailable(
  port: number,
): Promise<ListenerObservation> {
  const deadline = Date.now() + 5_000;
  let observation: ListenerObservation = "unknown";
  while (Date.now() < deadline) {
    observation = await observeLocalListener(port);
    if (observation === "absent") return observation;
    await wait(100);
  }
  return observation;
}

/**
 * Preview Listenerがclose後に接続を受理しないことを確認する。
 *
 * @responsibility HTTP Serverのclose完了と実際のListener不存在を別に観測する。
 * @trace ARCH-000003
 * @input healthUrlに同じPreview Handleが公開したlocalhost Health URLを受け取る。
 * @returns 接続拒否ならabsent、接続成立ならpresent、観測不能ならunknownを返す。
 * @precondition healthUrlはstartVisualPreviewが返したlocalhost URLである。
 * @postcondition 外部Hostへ接続しない。
 * @effect localhost HTTP GETを限定回数実行する。
 * @failure timeoutまたは分類不能Errorはunknownとしcleanup成功へ畳まない。
 * @invariant URLまたはResponse本文を公開結果へ含めない。
 * @boundary Visual Preview Listenerの終了後観測境界。
 * @security startVisualPreview由来のlocalhost URLだけを使用する。
 * @concurrency close直後の遅延を最大5秒間再観測する。
 */
export async function confirmPreviewListenerClosed(
  healthUrl: string,
): Promise<ListenerObservation> {
  const url = new URL(healthUrl);
  if (url.hostname !== "127.0.0.1" || url.port.length === 0) return "unknown";
  const port = Number(url.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) return "unknown";
  const deadline = Date.now() + 5_000;
  let observation: ListenerObservation = "unknown";
  while (Date.now() < deadline) {
    observation = await observeLocalListener(port);
    if (observation === "absent") return observation;
    await wait(100);
  }
  return observation;
}

/**
 * localhost TCP Listenerの存在状態を一回だけ観測する。
 *
 * @responsibility 接続成立、明示的接続拒否および観測不能を混同せず分類する。
 * @trace ARCH-000003
 * @input portにlocalhost上の検証対象TCP Portを受け取る。
 * @returns present、absentまたはunknownを返す。
 * @precondition portは1から65535の整数である。
 * @postcondition 作成したSocketを必ず破棄する。
 * @effect localhostへのTCP接続を一回だけ試行する。
 * @failure ECONNREFUSED以外のErrorと500ms timeoutはunknownを返す。
 * @invariant 接続拒否だけをListener不存在の根拠にする。
 * @boundary Node.js Socketとlocalhost Listenerの観測境界。
 * @security localhost以外へ接続しない。
 * @concurrency connect、error、timeoutの最初の一件だけを採用する。
 */
export async function observeLocalListener(
  port: number,
): Promise<ListenerObservation> {
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) return "unknown";
  return await new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let isSettled = false;
    const settle = (observation: ListenerObservation): void => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve(observation);
    };
    socket.setTimeout(500);
    socket.once("connect", () => settle("present"));
    socket.once("timeout", () => settle("unknown"));
    socket.once("error", (error: NodeJS.ErrnoException) =>
      settle(error.code === "ECONNREFUSED" ? "absent" : "unknown"),
    );
  });
}

/**
 * DevTools Active Port情報の生成を待つ。
 *
 * @responsibility BrowserのDebugger PortとWebSocket Pathを起動期限内に取得する。
 * @trace ARCH-000003
 * @input profileRootとBrowser Processを受け取る。
 * @returns PortとBrowser WebSocket Pathを返す。
 * @precondition Browserは同じprofileRootとremote-debugging-port=0で起動済みである。
 * @postcondition 有効なPortとPathだけを返す。
 * @effect Profile内のDevToolsActivePortを読取る。
 * @failure 30秒以内に生成されない、またはProcessが終了した場合はErrorを投げる。
 * @invariant 未完成Fileを成功として扱わない。
 * @boundary Chromium Profile Filesystem境界。
 * @security File内容を公開結果へ含めない。
 * @concurrency Browser書込みとPolling読取りの競合を再試行する。
 */
export async function waitForDevTools(
  profileRoot: string,
  child: ChildProcess,
): Promise<Readonly<{ port: number; browserWebSocketPath: string }>> {
  const activePortPath = path.join(profileRoot, "DevToolsActivePort");
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error("visual_zoom_browser_exited");
    try {
      const [portLine, browserWebSocketPath] = (
        await readFile(activePortPath, "utf8")
      )
        .trim()
        .split(/\r?\n/u);
      const port = Number(portLine);
      if (
        Number.isInteger(port) &&
        port > 0 &&
        browserWebSocketPath?.startsWith("/devtools/browser/")
      )
        return Object.freeze({ port, browserWebSocketPath });
    } catch {
      // BrowserがFileを確定するまで再観測する。
    }
    await wait(100);
  }
  throw new Error("visual_zoom_browser_start_timeout");
}

/**
 * 最初のPage TargetのWebSocket URLを取得する。
 *
 * @responsibility localhost DevTools一覧からPage Targetを一つ選ぶ。
 * @trace ARCH-000003
 * @input portに専用BrowserのDebugger Port、expectedUrlに対象Preview URLを受け取る。
 * @returns Page TargetのWebSocket URLを返す。
 * @precondition Portは同じ操作が起動したlocalhost Browserに属する。
 * @postcondition type=pageのTargetだけを返す。
 * @effect localhost DevTools HTTP Endpointを読取る。
 * @failure Target不在、HTTP失敗または不正ShapeではErrorを投げる。
 * @invariant 外部Hostへ接続しない。
 * @boundary localhost DevTools HTTP境界。
 * @security Endpointを公開結果へ含めない。
 * @concurrency Target生成直後の遅延を短時間再試行する。
 */
export async function resolvePageWebSocketUrl(
  port: number,
  expectedUrl: string,
): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as readonly Readonly<{
        type?: string;
        url?: string;
        webSocketDebuggerUrl?: string;
      }>[];
      const pageTarget = targets.find(
        (target) =>
          target.type === "page" &&
          target.url === expectedUrl &&
          typeof target.webSocketDebuggerUrl === "string",
      );
      if (pageTarget?.webSocketDebuggerUrl !== undefined)
        return pageTarget.webSocketDebuggerUrl;
    } catch {
      // Page Targetが公開されるまで再観測する。
    }
    await wait(100);
  }
  throw new Error("visual_zoom_page_target_unavailable");
}

/**
 * Page上で式を実行し、値を取得する。
 *
 * @responsibility 一回のRuntime.evaluate要求と応答相関を所有する。
 * @trace ARCH-000003
 * @input webSocketUrlとBrowser内で実行する固定式を受け取る。
 * @returns 式のJSON互換値を返す。
 * @precondition URLは同じ操作のlocalhost DevTools Targetに属する。
 * @postcondition WebSocketを閉じ、応答値だけを返す。
 * @effect localhost WebSocketを一つ開閉し、Page内の読取り式を実行する。
 * @failure 接続、Protocol、式評価またはtimeout失敗でErrorを投げる。
 * @invariant user gestureまたはFilesystem Effectを発行しない。
 * @boundary Chrome DevTools Protocol境界。
 * @security 式は実装内固定であり、利用者入力をScriptへ連結しない。
 * @concurrency Request ID 1の応答だけを受理する。
 */
export async function evaluateInPage(
  webSocketUrl: string,
  expression: string,
): Promise<unknown> {
  const socket = new WebSocket(webSocketUrl);
  return await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("visual_zoom_devtools_timeout"));
    }, 15_000);
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      try {
        const response = JSON.parse(String(event.data)) as DevToolsResponse;
        if (response.id !== 1) return;
        clearTimeout(timeout);
        socket.close();
        if (
          response.error !== undefined ||
          response.result?.exceptionDetails !== undefined
        )
          reject(
            new Error(
              `visual_zoom_devtools_evaluation_failed:${
                response.result?.exceptionDetails?.exception?.description ??
                response.result?.exceptionDetails?.text ??
                (response.error === undefined
                  ? "protocol_error"
                  : JSON.stringify(response.error))
              }`,
            ),
          );
        else resolve(response.result?.result?.value);
      } catch {
        clearTimeout(timeout);
        socket.close();
        reject(new Error("visual_zoom_devtools_response_invalid"));
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("visual_zoom_devtools_connection_failed"));
    });
  });
}

/**
 * Browser全体へ正常終了を要求する。
 *
 * @responsibility DevToolsのBrowser.closeを用いて、RendererやCrash Handlerを含むBrowser Process Treeの終了を開始する。
 * @trace ARCH-000003
 * @input portとbrowserWebSocketPathに同じ操作が発行したDevTools Browser Endpointを受け取る。
 * @returns 終了要求の受理またはWebSocket切断を確認した時点で解決するPromiseを返す。
 * @precondition EndpointはwaitForDevToolsが同じ専用Profileから取得したlocalhost値である。
 * @postcondition Browserへ正常終了要求が一回送られ、WebSocketが閉じている。
 * @effect localhost WebSocketを一つ開閉し、Browser.closeを一回要求する。
 * @failure 接続前の失敗またはtimeoutではErrorを投げ、呼出し側の所有Process強制終了へ移る。
 * @invariant 外部Browserまたは通常Profileへ終了要求を送らない。
 * @boundary Chrome DevTools ProtocolのBrowser Process境界。
 * @security Endpointを結果やLogへ公開しない。
 * @concurrency 応答とBrowser終了によるWebSocket切断を同じ完了へ畳む。
 */
export async function requestBrowserClose(
  port: number,
  browserWebSocketPath: string,
): Promise<void> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${browserWebSocketPath}`);
  await new Promise<void>((resolve, reject) => {
    let isCommandSent = false;
    let isSettled = false;
    const finish = (error?: Error) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      socket.close();
      if (error === undefined) resolve();
      else reject(error);
    };
    const timeout = setTimeout(
      () => finish(new Error("visual_zoom_browser_close_timeout")),
      5_000,
    );
    socket.addEventListener("open", () => {
      isCommandSent = true;
      socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const response = JSON.parse(String(event.data)) as DevToolsResponse;
        if (response.id !== 1) return;
        if (response.error !== undefined)
          finish(new Error("visual_zoom_browser_close_rejected"));
        else finish();
      } catch {
        finish(new Error("visual_zoom_browser_close_response_invalid"));
      }
    });
    socket.addEventListener("close", () => {
      if (isCommandSent) finish();
      else finish(new Error("visual_zoom_browser_close_connection_lost"));
    });
    socket.addEventListener("error", () =>
      finish(new Error("visual_zoom_browser_close_connection_failed")),
    );
  });
}
