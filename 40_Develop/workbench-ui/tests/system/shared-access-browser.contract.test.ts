/**
 * 実Browserで共有のログイン・管理と単体／共有のCSR画面を検証する。
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
 * @scope 合成外部ログイン、共有管理、自己生成RepositoryのGET遷移とRoot相関、内容保存・Git操作、Repository別AI設定の管理Role・保存結果・応答喪失・fresh GET・取消、native操作非横取り、pagehide取消と同じCookieセッションでの再開、秘密非保持、所有資源回収。
 * @boundary Workbench本番Server→本番Bundle→専用Browser→AM保存Owner。成果物原文は同じ選択Rootに相関し、文字列表示・履歴移動・遅延拒否・再読込後の再接続を観測する。
 */
import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync, sign as signData } from "node:crypto";
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
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "@qual-lab/crdd-version-control";
import {
  closeOwnedBrowserProcessTree,
  observeLocalListener,
} from "@qual-lab/crdd-visual-preview";
import { build } from "vite";
import { selectionConfig } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { prepareWorkspaceSurface } from "../../../coordinator/tests/fixtures/workspace-surface.ts";
// Serverの読取りを同一プロセスで観測する明示システム試験だけの接続。
import { startWorkbench } from "../../../crdd-server/src/app.ts";
import { prepareSharedAccessBrowserFixture } from "../../../crdd-server/tests/support/shared-access-browser.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

const googleIssuer = "https://accounts.google.com";
const browserLoginSubject = "workbench-browser-test-user";
const browserLoginClient = "workbench-browser-test-client";
const browserGitHubToken = "ghu_browser_fixture";
const browserGitRepositories = {
  unavailable: { id: 91, full_name: "browser-fixture/unavailable" },
  next: { id: 92, full_name: "browser-fixture/next" },
  latest: { id: 93, full_name: "browser-fixture/latest" },
} as const;

/** 共有Serverの起動要件を満たす試験専用のOAuth設定。 */
function createBrowserOAuthFixture() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    clients: [
      {
        id: "browser-test-mcp-client",
        redirects: ["http://127.0.0.1:18443/callback"],
      },
    ],
    verifier: {
      id: "crdd-mcp-verifier",
      secret: "synthetic-test-only-verifier-secret-32-bytes",
    },
    cookieKeys: ["synthetic-test-only-cookie-key-32-bytes"],
    jwks: {
      keys: [
        { ...privateKey.export({ format: "jwk" }), alg: "RS256", use: "sig" },
      ],
    },
  };
}

/** 外部応答だけを合成し、本人確認・連携・Cookie発行はWorkbenchの実入口を使う。 */
async function prepareBrowserLogin(t: test.TestContext, gitHost = false) {
  const socket = createServer();
  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  await new Promise<void>((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  assert.ok(address && typeof address !== "string");
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const realFetch = globalThis.fetch;
  let nonce: string | null = null;
  let gitRead: "allowed" | "denied" | "unavailable" = "allowed";
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      if (url.href === `${googleIssuer}/.well-known/openid-configuration`)
        return Response.json({
          issuer: googleIssuer,
          authorization_endpoint: `${googleIssuer}/auth`,
          token_endpoint: `${googleIssuer}/token`,
          jwks_uri: `${googleIssuer}/jwks`,
          code_challenge_methods_supported: ["S256"],
          id_token_signing_alg_values_supported: ["RS256"],
        });
      if (url.href === `${googleIssuer}/jwks`)
        return Response.json({
          keys: [
            {
              ...keys.publicKey.export({ format: "jwk" }),
              alg: "RS256",
              kid: "fixture",
            },
          ],
        });
      if (url.href === `${googleIssuer}/token`) {
        assert.ok(nonce);
        const encode = (value: object) =>
          Buffer.from(JSON.stringify(value)).toString("base64url");
        const iat = Math.floor(Date.now() / 1_000);
        const payload = `${encode({ alg: "RS256", kid: "fixture" })}.${encode({ iss: googleIssuer, sub: browserLoginSubject, aud: browserLoginClient, iat, exp: iat + 120, nonce })}`;
        return Response.json({
          access_token: "synthetic-workbench-access-token",
          token_type: "Bearer",
          id_token: `${payload}.${signData("sha256", Buffer.from(payload), keys.privateKey).toString("base64url")}`,
        });
      }
      if (
        gitHost &&
        url.href === "https://github.com/login/oauth/access_token"
      ) {
        return Response.json({
          access_token: browserGitHubToken,
          token_type: "bearer",
          expires_in: 3600,
        });
      }
      if (gitHost && url.origin === "https://api.github.com") {
        if (
          url.pathname === "/applications/synthetic-browser-git/token" &&
          init?.method === "DELETE"
        ) {
          assert.equal(
            new Headers(init.headers).get("authorization"),
            `Basic ${Buffer.from("synthetic-browser-git:synthetic-browser-git-secret").toString("base64")}`,
          );
          assert.deepEqual(JSON.parse(String(init.body)), {
            access_token: browserGitHubToken,
          });
          return new Response(null, { status: 204 });
        }
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          `Bearer ${browserGitHubToken}`,
        );
        if (url.pathname === "/user") return Response.json({ id: 73 });
        if (url.pathname === "/user/installations")
          return Response.json({
            total_count: 1,
            installations: [
              {
                id: 24,
                account: { login: "browser-fixture" },
                permissions: { contents: "write" },
              },
            ],
          });
        assert.equal(url.pathname, "/user/installations/24/repositories");
        if (gitRead === "unavailable")
          return new Response(null, { status: 503 });
        return Response.json({
          total_count: Object.keys(browserGitRepositories).length,
          repositories: Object.values(browserGitRepositories).map((entry) => ({
            ...entry,
            permissions: {
              pull: gitRead === "allowed",
              push: gitRead === "allowed",
            },
          })),
        });
      }
      assert.equal(
        url.hostname,
        "127.0.0.1",
        "browser_fixture_external_request",
      );
      return realFetch(input, init);
    },
  );
  return {
    port: address.port,
    setGitRead(value: typeof gitRead) {
      gitRead = value;
    },
    loginProviders: {
      google: {
        clientId: browserLoginClient,
        clientSecret: "synthetic-browser-secret",
      },
    },
    async createSession(baseUrl: string) {
      const response = await fetch(
        new URL("/api/session/login/google", baseUrl),
        {
          method: "POST",
          headers: { origin: baseUrl },
          redirect: "manual",
        },
      );
      assert.equal(response.status, 303);
      const authorization = new URL(response.headers.get("location") ?? "");
      nonce = authorization.searchParams.get("nonce");
      const state = authorization.searchParams.get("state");
      const proofCookie = response.headers.getSetCookie()[0]?.split(";")[0];
      assert.ok(nonce && state && proofCookie);
      const callback = await fetch(
        new URL(
          `/api/session/login/google/callback?${new URLSearchParams({ state, code: "synthetic" })}`,
          baseUrl,
        ),
        { headers: { cookie: proofCookie }, redirect: "manual" },
      );
      assert.equal(callback.status, 303);
      const cookie = callback.headers
        .getSetCookie()
        .find((entry) => entry.startsWith("crdd-client-session="))
        ?.split(";")[0];
      assert.ok(cookie);
      return cookie;
    },
    async connectGitHost(baseUrl: string, cookie: string) {
      assert.equal(gitHost, true);
      const response = await fetch(
        new URL("/api/session/git/github", baseUrl),
        {
          method: "POST",
          headers: { origin: baseUrl, cookie },
          redirect: "manual",
        },
      );
      assert.equal(response.status, 303);
      const authorization = new URL(response.headers.get("location") ?? "");
      assert.equal(authorization.origin, "https://github.com");
      const state = authorization.searchParams.get("state");
      assert.ok(state);
      const callback = await fetch(
        new URL(
          `/api/session/git/github/callback?${new URLSearchParams({ state, code: "synthetic" })}`,
          baseUrl,
        ),
        { headers: { cookie }, redirect: "manual" },
      );
      assert.equal(callback.status, 303);
    },
  };
}

/** @trace ERB-ST-022 同じQueue IDを持つ別Repositoryを区別する実DOMの対照。 */
test("Workbenchは活動再取得で消えた実行を別Graphへ自動切替しない", {
  skip: process.env.CRDD_WORKBENCH_ACTIVITY_BROWSER !== "1",
}, async () => {
  assert.ok(repositoryRoot);
  const executable = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
  ]
    .filter((value): value is string => value !== undefined)
    .map((value) =>
      path.join(value, "Google", "Chrome", "Application", "chrome.exe"),
    )
    .find(existsSync);
  assert.ok(executable, "activity_browser_chrome_unavailable");
  const testRoot = await prepareSharedAccessBrowserTestRoot(repositoryRoot);
  const directory = await mkdtemp(path.join(testRoot, "activity-browser-"));
  const page = path.join(directory, "index.html");
  const profile = path.join(directory, "profile");
  let child: ChildProcess | undefined;
  let endpoint: Awaited<ReturnType<typeof readBrowserEndpoint>> | undefined;
  try {
    await writeFile(
      page,
      '<!doctype html><meta charset="utf-8"><body><div id="activity-fixture"></div><script>window.addEventListener("error",event=>{document.body.dataset.activityResult=JSON.stringify({error:event.message});});</script><script src="probe.js" onerror="document.body.dataset.activityResult=JSON.stringify({error:\'probe.js unavailable\'})"></script>',
      { flag: "wx" },
    );
    await build({
      configFile: false,
      root: path.resolve(import.meta.dirname, "../.."),
      oxc: { jsx: { runtime: "automatic" } },
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      logLevel: "error",
      build: {
        outDir: directory,
        emptyOutDir: false,
        lib: {
          entry: path.resolve(
            import.meta.dirname,
            "../support/activity-reselection.ts",
          ),
          name: "ActivityFixture",
          formats: ["iife"],
          fileName: () => "probe.js",
        },
      },
    });
    child = spawn(
      executable,
      [
        `--user-data-dir=${profile}`,
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        "--no-first-run",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--headless=new",
        pathToFileURL(page).href,
      ],
      { stdio: "ignore", windowsHide: true },
    );
    endpoint = await readBrowserEndpoint(profile, child);
    const listing = `http://127.0.0.1:${endpoint.port}/json/list`;
    let result: unknown;
    for (
      let attempt = 0;
      attempt < 50 && typeof result !== "string";
      attempt++
    ) {
      const targets = (await (await fetch(listing)).json()) as {
        url: string;
        webSocketDebuggerUrl: string;
      }[];
      const target = targets.find(
        ({ url }) => url === pathToFileURL(page).href,
      );
      if (target)
        result = await requestBrowser(
          target.webSocketDebuggerUrl,
          "Runtime.evaluate",
          {
            expression: "document.body?.dataset.activityResult",
            returnByValue: true,
          },
        );
      if (typeof result !== "string") await delay(100);
    }
    assert.equal(typeof result, "string");
    assert.deepEqual(JSON.parse(String(result)), {
      selected: true,
      restored: true,
      missing: true,
      notSubstituted: true,
      explicit: true,
    });
  } finally {
    try {
      if (child) {
        const cleanup = await closeOwnedBrowserProcessTree(child, async () => {
          if (!endpoint) throw Error("activity_browser_endpoint_unavailable");
          await requestBrowser(
            `ws://127.0.0.1:${endpoint.port}${endpoint.browserPath}`,
            "Browser.close",
          );
        });
        assert.equal(cleanup.processTreeExitConfirmed, true);
        assert.equal(cleanup.cleanupErrors.length, 0);
      }
    } finally {
      assert.equal(path.dirname(directory), testRoot);
      await rm(directory, { recursive: true });
    }
  }
});

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
async function prepareSharedAccessBrowserTestRoot(
  root: string,
): Promise<string> {
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
      throw new Error("shared_access_browser_exited");
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
  throw new Error("shared_access_browser_start_timeout");
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
  evaluationStep?: "document_ready" | "document_reload" | "shared_navigation",
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
        failure = new Error("shared_access_browser_protocol_timeout");
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
            failure = new Error("shared_access_browser_viewport_unavailable");
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
                    "document.activeElement?.getAttribute('name')==='saveSelection'",
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
              throw new Error("shared_access_browser_viewport_result_invalid");
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
              ? "shared_access_browser_context_replaced"
              : evaluationStep === undefined
                ? "shared_access_browser_evaluation_failed"
                : `shared_access_browser_evaluation_failed_${evaluationStep}${category}`,
          );
        } else
          outcome =
            method === "Runtime.evaluate" ? reply.result?.result?.value : true;
      } catch {
        failure = new Error("shared_access_browser_protocol_invalid");
      }
      socket.close();
    });
    socket.addEventListener("error", () => {
      failure ??= new Error("shared_access_browser_protocol_failed");
      socket.close();
    });
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (settled || (method === "Browser.close" && sent))
          resolve(outcome ?? true);
        else reject(new Error("shared_access_browser_response_missing"));
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
      "document_reload",
      "shared_navigation",
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
              ? "shared_access_browser_evaluation_failed"
              : `shared_access_browser_evaluation_failed_${step}`,
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
            `shared_access_browser_evaluation_failed_document_ready${className.startsWith("fixture-") ? "" : `_${className}`}`,
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
      { message: "shared_access_browser_context_replaced" },
    );
    reply = { id: 1, result: { result: { value: true } } };
    assert.equal(
      await requestBrowser(
        "ws://fixture.invalid",
        "Runtime.evaluate",
        {},
        undefined,
        "single",
        "document_ready",
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
 * @observation 旧Documentと異なるtimeOrigin・complete・呼出し側が指定したDOM。
 * @oracle Context置換では読取りだけを再評価し、POSTやreloadを再送しない。
 * @cleanup 各requestBrowserがTimerとSocketを回収し、親CaseがBrowserを回収する。
 * @boundary 試験用CDPの受理とDocument生成を分ける。製品の回復機構ではない。
 */
async function reloadBrowserDocument(
  pageUrl: string,
  readySelector: string,
): Promise<void> {
  const previous = await requestBrowser(
    pageUrl,
    "Runtime.evaluate",
    {
      expression: "performance.timeOrigin",
      returnByValue: true,
    },
    undefined,
    "single",
    "document_reload",
  );
  assert.equal(typeof previous, "number");
  assert.equal(Number.isFinite(previous), true);
  await requestBrowser(
    pageUrl,
    "Page.reload",
    {},
    undefined,
    "single",
    "document_reload",
  );
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    try {
      if (
        (await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `performance.timeOrigin!==${JSON.stringify(previous)}&&document.readyState==='complete'&&Boolean(document.querySelector(${JSON.stringify(readySelector)}))`,
            returnByValue: true,
          },
          undefined,
          "single",
          "document_reload",
        )) === true
      )
        return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "shared_access_browser_context_replaced"
      )
        throw error;
    }
    await delay(100);
  }
  throw new Error("shared_access_browser_reload_ready_unconfirmed");
}

/** 意味操作は再送せず、読み取りだけを新Documentで再評価する。 */
async function waitForBrowserCondition(pageUrl: string, expression: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (
        (await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression,
          returnByValue: true,
        })) === true
      )
        return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "shared_access_browser_context_replaced"
      )
        throw error;
    }
    await delay(100);
  }
  throw new Error("browser_shared_session_condition_unconfirmed");
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
    await reloadBrowserDocument("ws://fixture.invalid", "[data-fixture-ready]");
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

/** 現行の管理RESTを画面から操作し、再送せずに保存結果を表示することを確認する。 */
function managementBrowserExpression(): string {
  return `(async () => {
    const waitFor=async (condition,stage)=>{ const end=Date.now()+15000; while(Date.now()<end){if(condition())return;await new Promise(r=>setTimeout(r,50));} throw new Error('management_browser_wait_failed:'+stage); };
    const panel=()=>document.querySelector('#access-management');
    const status=()=>panel()?.querySelector('[role=status]');
    const formFor=(operation,id)=>[...(panel()?.querySelectorAll('form')??[])].find(f=>f.elements.namedItem('operation')?.value===operation&&(!id||f.elements.namedItem('userId')?.value===id));
    const buttonFor=(name)=>[...document.querySelectorAll('button')].find(b=>b.textContent===name);
    const originalFetch=window.fetch;
    const writes=[], reads=[];
    let stage='session', userId, injected;
    window.fetch=function(input,init) {
      const url=new URL(input instanceof Request?input.url:String(input),location.href);
      const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
      if(url.origin===location.origin&&method==='GET'&&['/api/users','/api/repositories','/api/access/me'].includes(url.pathname))reads.push(url.pathname);
      if(url.origin===location.origin&&url.pathname.startsWith('/api/users')&&method!=='GET'){
        writes.push([method,url.pathname]);
        if(injected){
          const scenario=injected;injected=null;
          if(scenario==='disconnect')return Promise.reject(new Error('synthetic_response_loss'));
          const body=JSON.parse(init.body);
          const result=scenario==='rejected'||scenario==='conflict'
            ? {status:'rejected',reason:scenario==='conflict'?'management_revision_conflict':'management_request_rejected'}
            : {status:'unavailable',reason:'management_operation_unavailable',operationId:body.operationId,expectedRevision:body.expectedRevision,observedRevision:scenario==='cleanup'?body.expectedRevision+1:null,publication:scenario==='cleanup'?'confirmed':'unconfirmed',cleanupConfirmed:false,primaryFailure:scenario==='cleanup'?'cleanup_failed':'publication_failed'};
          const statusCode=scenario==='rejected'?403:scenario==='conflict'?409:503;
          return Promise.resolve(new Response(JSON.stringify(result),{status:statusCode,headers:{'content-type':'application/json'}}));
        }
      }
      return originalFetch.call(window,input,init);
    };
    try{
      buttonFor('管理セッションを開始').click();
      const registration=()=>document.querySelector('form:has(input[name=username]):has(input[name=email])');
      await waitFor(()=>registration()&&!registration().querySelector('fieldset').disabled,stage);
      stage='registration';
      const register=registration();
      register.elements.namedItem('username').value='管理画面登録';
      register.elements.namedItem('email').value='browser-invited@example.invalid';
      register.requestSubmit();
      register.requestSubmit();
      await waitFor(()=>buttonFor('リンクを閉じる'),stage);
      buttonFor('リンクを閉じる').click();
      stage='rename';
      const lookup=()=>[...(panel()?.querySelectorAll('form')??[])].find(f=>f.elements.namedItem('operation')?.value==='updateUserName'&&f.elements.namedItem('username')?.value==='管理画面登録');
      await waitFor(lookup,stage);
      const rename=lookup();
      userId=rename.elements.namedItem('userId').value;
      rename.elements.namedItem('username').value='管理画面改名';
      rename.requestSubmit();
      await waitFor(()=>status()?.textContent.includes('変更を保存しました')&&!formFor('updateUserName',userId)?.querySelector('button').disabled&&formFor('updateUserName',userId)?.elements.namedItem('username').value==='管理画面改名',stage);
      stage='role';
      const role=formFor('updateUserRole',userId);
      role.elements.namedItem('nextRole').value='manager';
      role.requestSubmit();
      await waitFor(()=>formFor('updateUserRole',userId)?.elements.namedItem('currentRole').value==='manager'&&!formFor('updateUserRole',userId)?.querySelector('button').disabled,stage);
      const focused=document.activeElement===status();
      const retiredControlsAbsent=!document.querySelector('#credential-administration,form[action="/api/access"],form[action="/api/access/connection"],form:has([name=operation][value=updateExposure]),form:has([name=operation][value=updateRoleContentAccess])');
      let conflictReads=[];
      for(const [scenario,expected] of [['rejected','受理されませんでした'],['conflict','最新の一覧を確認'],['unknown','保存の結果を確認できません'],['cleanup','保存は確認済みですが']]){
        const readStart=reads.length;
        stage=scenario;injected=scenario;formFor('updateUserName',userId).requestSubmit();
        await waitFor(()=>status()?.textContent.includes(expected)&&formFor('updateUserName',userId)&&!formFor('updateUserName',userId).querySelector('button').disabled,stage);
        if(scenario==='conflict')conflictReads=reads.slice(readStart).sort();
      }
      stage='disconnect';injected='disconnect';formFor('updateUserName',userId).requestSubmit();
      await waitFor(()=>status()?.textContent.includes('現在投影の確認は完了していません')&&!formFor('updateUserName',userId),stage);
      return {userId,writes,conflictReads,focused,storageEmpty:localStorage.length===0&&sessionStorage.length===0,retiredControlsAbsent};
    }catch{return {failedStage:stage,writes};}
    finally{window.fetch=originalFetch;}
  })()`;
}

/**
 * 共有のブラウザーセッションと単体Git・作業領域の公開画面を実環境で確認する。
 * @responsibility HTTPだけでは見えない表示・消去・再読込・接続失効と資格付き画面遷移・終了後非採用、文書未確認・競合の部分表示とリンク抑止を反証する。
 * @trace RFD-ST-016
 * @trace RFD-ST-004
 * @trace RFD-ST-003
 * @trace ERB-ST-022
 * @trace RFD-ST-022
 * @trace EST-ST-013
 * @precondition 対応ChromeとBuild済み本番Bundleを使用する。
 * @stimulus 自己生成AM状態へ重複submit・失敗・reload、IDなし既知link／GET検索・戻る、外部／download／別tab／修飾click／POST、遅延GETと接続中の合成pagehide／pageshowを適用する。RecordではDetail保存成功／競合後のGET故障・明示再取得と、POST応答保留中のRepository切替を適用する。 Gitでは二重送信、確認なし／確認付きPush、処置後GET故障、不正応答、GET再取得と対象切替を適用する。
 * AI設定ではmanager／developer、五役割の標準入力、分類・上書きの追加／改名／削除、未設定からの明示編集、CAS二重submit、応答喪失、保存後GET故障、保留GET中の対象切替を適用する。
 * Portfolioでは二本文の一方欠測・他方Identity競合、競合本文復元、全本文復元とreloadを実施する。
 * @observation boolean/counter、選択ID・defaultPrevented・Model取得件数・取消Signal・再開Header有無、非秘密保存状態、Browser/Listener/Profile終了だけ取得する。Recordでは旧Detail本文／Formの有無、known completed／blocked通知、再取得前後のPOST数、保留POSTのSignalと新選択の維持を観測する。 GitではPOST件数、要求専用結果、非選択Root HEAD、local Remote Revisionと取消Signalを観測する。
 * AI設定のPUT数・通知・取消Signal・現在設定、標準入力と同じJSON draft、未設定時の空Modelを観測する。
 * Portfolioの日本語状態表示、Repositoryリンク集合、外国Identityの非表示と復元後通常接続を取得する。
 * @oracle 選択保持、対象外Model取得0、旧世代採用0、pagehide保留GET取消・Root空・終了後応答採用0、Bearerなしの同じCookieセッションで再開する。RecordのGET故障では旧本文／Form非表示、既知保存とblockedを混同しない通知、GET retryによるPOST増0、対象切替時の保留POST取消と遅延応答採用0を要求する。合成通知を実cache保存復元証明にしない。単体Gitでは確認不足Push0、再取得後の操作結果未確認保持、旧状態非表示、GET再取得POST増0、他Root Effect0を要求する。
 * AI設定は管理Roleとdevelopment認可、標準入力だけの分類・上書き編集、単一draft、未設定のModel非補完、POST一回・fresh GETのみ・既知保存保持・遅延非採用を要求する。
 * Portfolioは未確認を一部未確認、競合を競合ありと表示し、completeだけをリンクにする。外国Identityを公開せず、復元後通常接続できる。
 * @cleanup 既存Browser所有Tree終了処理とServer close後、検証した自己生成Rootだけ削除する。
 * @boundary 本番Server／本番CSR／専用Browser／AMのSystem境界。
 */
test("実Browserは管理・Repository操作と現在投影の整合を維持する", {
  // 内容操作の複数評価を追加した全Case合計の上限。各評価・製品の待機期限は変更しない。
  // 既存全体263秒＋追加Git単独49秒を包含する親試験だけの上限。個別待機は不変更。
  timeout: 420_000,
}, async (t) => {
  const testRoot = await prepareSharedAccessBrowserTestRoot(repositoryRoot);
  await t.test("欠測親から固定試験Rootを独立準備する", async () => {
    const fresh = await mkdtemp(
      path.join(testRoot, "workbench-browser-bootstrap-"),
    );
    try {
      await assert.rejects(lstat(path.join(fresh, ".crdd")), {
        code: "ENOENT",
      });
      const prepared = await prepareSharedAccessBrowserTestRoot(fresh);
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
  assert.ok(executable, "shared_access_browser_chrome_unavailable");
  const modes = [
    "shared-session",
    "shared-management",
    "shared-navigation",
    "ai-selection-manager",
    "ai-selection-developer",
    "content-operations",
    "artifact-navigation",
    "git-operations",
  ] as const;
  const requestedCase = process.env.CRDD_WORKBENCH_BROWSER_CASE;
  if (requestedCase && !modes.some((mode) => mode === requestedCase))
    throw new Error("shared_access_browser_case_invalid");
  for (const mode of modes.filter(
    (mode) => !requestedCase || mode === requestedCase,
  ))
    await t.test(mode, async (context) => {
      const directory = await mkdtemp(
        path.join(testRoot, "workbench-shared-access-browser-"),
      );
      const profile = path.join(directory, "chrome");
      const access = path.join(directory, "access");
      await mkdir(profile);
      await mkdir(access);
      const accessFixture = prepareSharedAccessBrowserFixture(
        access,
        mode === "ai-selection-manager"
          ? "manager"
          : mode === "ai-selection-developer"
            ? "developer"
            : "administrator",
      );
      const usesGitHost =
        mode === "shared-session" ||
        mode === "shared-navigation" ||
        mode === "artifact-navigation" ||
        mode === "content-operations" ||
        mode === "ai-selection-manager" ||
        mode === "ai-selection-developer";
      if (
        mode === "shared-session" ||
        mode === "shared-navigation" ||
        mode === "content-operations" ||
        mode === "artifact-navigation" ||
        mode === "git-operations" ||
        mode === "ai-selection-manager" ||
        mode === "ai-selection-developer"
      ) {
        for (const suffix of mode === "shared-session"
          ? (["next"] as const)
          : (["unavailable", "next", "latest"] as const)) {
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
          if (
            mode === "ai-selection-manager" ||
            mode === "ai-selection-developer"
          )
            if (suffix !== "latest")
              await writeFile(
                path.join(target, ".crdd", "config", "ai-selection.json"),
                JSON.stringify(selectionConfig()),
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
          if (mode === "git-operations" || mode === "shared-session") {
            const hooks = path.join(directory, "empty-hooks");
            await mkdir(hooks, { recursive: true });
            await writeFile(path.join(target, ".gitignore"), ".crdd/\n");
            await writeFile(path.join(target, "work.txt"), "seed\n");
            const seedPaths = [".gitignore", "work.txt", "PROJECT_CONTEXT.md"];
            if (mode === "git-operations" && suffix === "next") {
              const relative = path.join(
                "99_Roadmap",
                "Changes",
                "CHG-000901",
                "change.md",
              );
              await mkdir(path.dirname(path.join(target, relative)), {
                recursive: true,
              });
              await writeFile(
                path.join(target, relative),
                "# 単体の試験用成果物\n",
              );
              seedPaths.push(relative);
            }
            for (const args of [
              ["config", "user.name", "Fixture"],
              ["config", "user.email", "fixture@example.invalid"],
              ["config", "commit.gpgsign", "false"],
              ["config", "core.hooksPath", hooks],
              ["add", "--", ...seedPaths],
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
            if (suffix === "next" && mode === "git-operations") {
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
            if (mode === "git-operations" && suffix === "next")
              await writeFile(
                path.join(target, "zz-follow-up.txt"),
                "after publication\n",
              );
          }
          const hostedFixture = browserGitRepositories[suffix];
          if (usesGitHost) {
            for (const args of [
              ["config", "protocol.https.allow", "never"],
              [
                "remote",
                "add",
                "origin",
                `https://github.com/${hostedFixture.full_name}.git`,
              ],
            ]) {
              assert.equal(
                spawnSync("git", args, {
                  cwd: target,
                  windowsHide: true,
                  encoding: "utf8",
                }).status,
                0,
                "browser_git_host_remote_configured",
              );
            }
          }
          if (mode === "shared-session" || !usesGitHost) continue;
          accessFixture.addRepository(id, target, {
            provider: "github",
            host: "github.com",
            repositoryId: String(hostedFixture.id),
            providerData: { installationId: "24" },
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
      const browserLogin =
        usesGitHost || mode === "shared-management"
          ? await prepareBrowserLogin(context, usesGitHost)
          : null;
      const accessBaseline = browserLogin
        ? null
        : await accessFixture.initialize().then(accessFixture.baseline);
      const workingDirectory =
        mode === "git-operations"
          ? path.join(directory, "next")
          : repositoryRoot;
      const handle = browserLogin
        ? await accessFixture.start(
            {
              workingDirectory,
              port: browserLogin.port,
              loginProviders: browserLogin.loginProviders,
              sharedRepositoryRoots: [directory],
              gitHosts: [
                {
                  provider: "github",
                  host: "github.com",
                  providerData: {
                    clientId: "synthetic-browser-git",
                    clientSecret: "synthetic-browser-git-secret",
                  },
                },
              ],
              mcpOAuth: createBrowserOAuthFixture(),
            },
            { issuer: googleIssuer, subject: browserLoginSubject },
          )
        : await startWorkbench({ workingDirectory });
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
              throw new Error("shared_access_browser_endpoint_unavailable");
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
      assert.ok(pageUrl, "shared_access_browser_page_unavailable");
      let browserSession: string | null = null;
      if (browserLogin) {
        await waitForBrowserCondition(
          pageUrl,
          `Boolean(document.querySelector('form[action="/api/session/login/google"]'))&&!document.querySelector('form[action="/api/access/connection"]')`,
        );
        if (mode === "shared-session") {
          const response = await fetch(
            new URL("/api/workbench/context", handle.baseUrl),
          );
          assert.equal(response.status, 200);
          const { login } = await response.json();
          assert.deepEqual(login.loginProviders, [
            { id: "google", displayName: "Google" },
          ]);
          const hasLogin = (id: string, name: string) =>
            `document.querySelector(${JSON.stringify(`form[action="/api/session/login/${id}"] button`)})?.textContent.trim() === ${JSON.stringify(`${name}でログイン`)}`;
          await waitForBrowserCondition(
            pageUrl,
            hasLogin(
              login.loginProviders[0].id,
              login.loginProviders[0].displayName,
            ),
          );
        }
        const cookie = await browserLogin.createSession(handle.baseUrl);
        if (usesGitHost)
          await browserLogin.connectGitHost(handle.baseUrl, cookie);
        if (mode === "shared-session") {
          const view = await fetch(
            new URL("/api/workbench/overview", handle.baseUrl),
            {
              headers: { cookie },
            },
          );
          assert.equal(view.status, 200);
          const { view: kind, portfolio } = await view.json();
          assert.equal(kind, "access");
          assert.equal(portfolio, null, "登録前にリポジトリ内容を返さない");
          const selected = await fetch(
            new URL(
              "/api/workbench/overview?repositoryId=repository.next",
              handle.baseUrl,
            ),
            { headers: { cookie } },
          );
          assert.equal(selected.status, 403);
          await selected.text();
        }
        const delimiter = cookie.indexOf("=");
        assert.ok(delimiter > 0);
        await requestBrowser(pageUrl, "Network.setCookie", {
          name: cookie.slice(0, delimiter),
          value: cookie.slice(delimiter + 1),
          url: handle.baseUrl,
          path: "/api",
          httpOnly: true,
          sameSite: "Lax",
        });
        await reloadBrowserDocument(
          pageUrl,
          'section[aria-label="ログインと利用者招待"] button',
        );
        if (mode === "shared-session") {
          const response = await fetch(
            new URL("/api/session/git", handle.baseUrl),
            { headers: { cookie } },
          );
          assert.equal(response.status, 200);
          const { hosts } = await response.json();
          assert.equal(hosts.length, 1);
          const [{ displayName, connected }] = hosts;
          assert.equal(connected, true);
          await waitForBrowserCondition(
            pageUrl,
            `[...document.querySelectorAll('section[aria-label="Gitホスト連携"] button')].some(button=>button.textContent.trim()===${JSON.stringify(`このセッションの${displayName}連携を解除`)})`,
          );
        }
        browserSession = cookie;
      }
      if (mode === "shared-session" || mode === "shared-management") {
        assert.ok(browserSession);
        const rejected = await fetch(`${handle.baseUrl}/api/projects`, {
          headers: { authorization: "Bearer synthetic-invalid-bearer" },
        });
        assert.equal(rejected.status, 403);
        assert.deepEqual(await rejected.json(), { error: "request_rejected" });
        if (mode === "shared-session") {
          const target = path.join(directory, "next");
          const openManagement = `[...document.querySelectorAll('button')].find(b=>b.textContent==='管理セッションを開始')`;
          const register = `document.querySelector('form:has([name=directory]):has([name=repositoryId])')`;
          const unregister = `document.querySelector('#access-management form:has([name=operation][value=unregisterRepository]):has([name=repositoryId][value="repository.next"])')`;
          await waitForBrowserCondition(pageUrl, `Boolean(${openManagement})`);
          await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `${openManagement}.click()`,
            returnByValue: true,
          });
          await waitForBrowserCondition(
            pageUrl,
            `Boolean(${register})&&!${register}.querySelector('fieldset').disabled`,
          );
          await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `(()=>{const form=${register};form.elements.namedItem('repositoryId').value='repository.next';form.elements.namedItem('directory').value=${JSON.stringify(target)};form.requestSubmit();})()`,
            returnByValue: true,
          });
          await waitForBrowserCondition(pageUrl, `Boolean(${unregister})`);
          const registered = await accessFixture.registrations();
          assert.deepEqual(registered.repositories, [
            {
              repositoryId: "repository.next",
              hostedRepository: {
                provider: "github",
                host: "github.com",
                repositoryId: "92",
                providerData: { installationId: "24" },
              },
            },
          ]);
          const git = (...args: string[]) => {
            const result = spawnSync("git", args, {
              cwd: target,
              encoding: "utf8",
              windowsHide: true,
            });
            assert.equal(result.status, 0, result.stderr);
            return result.stdout.trim();
          };
          const head = git("rev-parse", "HEAD");
          await requestBrowser(pageUrl, "Page.navigate", {
            url: new URL("/?repositoryId=repository.next", handle.baseUrl).href,
          });
          const form = (operation: string) =>
            `document.querySelector(${JSON.stringify(`#repository form:has([name=operation][value=${operation}])`)})`;
          await waitForBrowserCondition(pageUrl, `Boolean(${form("prepare")})`);
          assert.equal(
            await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `!([${form("create_revision")},${form("publish_revision")}].some(Boolean))`,
              returnByValue: true,
            }),
            true,
          );
          for (const [operation, next, staged] of [
            ["prepare", "unprepare", "work.txt"],
            ["unprepare", "prepare", ""],
          ] as const) {
            await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `${form(operation)}.requestSubmit()`,
              returnByValue: true,
            });
            await waitForBrowserCondition(
              pageUrl,
              `Boolean(${form(next)})&&!document.querySelector('.repository-operation-surface fieldset')?.disabled`,
            );
            assert.equal(git("diff", "--cached", "--name-only"), staged);
          }
          assert.equal(git("rev-parse", "HEAD"), head);
          await requestBrowser(pageUrl, "Page.navigate", {
            url: handle.baseUrl,
          });
          await waitForBrowserCondition(pageUrl, `Boolean(${unregister})`);
          await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `${unregister}.requestSubmit()`,
            returnByValue: true,
          });
          await waitForBrowserCondition(
            pageUrl,
            `!${unregister} && document.querySelector('#access-management [role=status]')?.textContent.includes('変更を保存しました')`,
          );
          const removed = await accessFixture.registrations();
          assert.equal(removed.revision, registered.revision + 1);
          assert.deepEqual(removed.repositories, []);
          const afterRemoval = await fetch(
            new URL(
              "/api/workbench/overview?repositoryId=repository.next",
              handle.baseUrl,
            ),
            { headers: { cookie: browserSession } },
          );
          assert.equal(afterRemoval.status, 403);
          assert.equal(
            await afterRemoval.text(),
            "local_repository_access_unavailable\n",
          );
          assert.equal(git("rev-parse", "HEAD"), head);
          assert.equal(
            await readFile(path.join(target, "work.txt"), "utf8"),
            "working-next\n",
          );
        }
        const logoutButton = `[...document.querySelectorAll('button')].find(b=>b.textContent==='ログアウト')`;
        await waitForBrowserCondition(pageUrl, `Boolean(${logoutButton})`);
        if (mode === "shared-session") {
          const delimiter = browserSession.indexOf("=");
          assert.ok(delimiter > 0);
          const cookie = {
            name: browserSession.slice(0, delimiter),
            url: handle.baseUrl,
            path: "/api",
          };
          await requestBrowser(pageUrl, "Network.deleteCookies", {
            name: cookie.name,
            domain: new URL(handle.baseUrl).hostname,
            path: cookie.path,
          });
          await requestBrowser(pageUrl, "Runtime.evaluate", {
            expression: `${logoutButton}.click()`,
          });
          await waitForBrowserCondition(
            pageUrl,
            `[...document.querySelectorAll('section[aria-label="ログインと利用者招待"] [role=status]')].some(p=>p.textContent.includes('再ログインしてからログアウト')) &&
              Boolean(document.querySelector('form[action="/api/session/login/google"] button')) &&
              !document.querySelector('[aria-label="Gitホスト連携"],#projects')`,
          );
          await requestBrowser(pageUrl, "Network.setCookie", {
            ...cookie,
            value: browserSession.slice(delimiter + 1),
            httpOnly: true,
            sameSite: "Lax",
          });
          await reloadBrowserDocument(
            pageUrl,
            'section[aria-label="ログインと利用者招待"] button',
          );
          await waitForBrowserCondition(pageUrl, `Boolean(${logoutButton})`);
        }
        if (mode === "shared-management") {
          const management = (await requestBrowser(
            pageUrl,
            "Runtime.evaluate",
            {
              expression: managementBrowserExpression(),
              awaitPromise: true,
              returnByValue: true,
            },
            undefined,
            "composite",
          )) as { userId?: string; failedStage?: string; writes: unknown[] };
          assert.equal(
            management.failedStage,
            undefined,
            JSON.stringify(management),
          );
          assert.ok(management.userId);
          const targetUser = `/api/users/${management.userId}`;
          assert.deepEqual(management, {
            userId: management.userId,
            writes: [
              ["POST", "/api/users"],
              ["PATCH", targetUser],
              ["PUT", `${targetUser}/role`],
              ...Array.from({ length: 5 }, () => ["PATCH", targetUser]),
            ],
            conflictReads: [
              "/api/access/me",
              "/api/repositories",
              "/api/users",
            ],
            focused: true,
            storageEmpty: true,
            retiredControlsAbsent: true,
          });
          const saved = await accessFixture.users();
          const invited = saved.filter(
            (user) => user.userId === management.userId,
          );
          assert.equal(invited.length, 1);
          assert.equal(invited[0]?.username, "管理画面改名");
          assert.equal(invited[0]?.role, "manager");
        }
        const sessionUrl = new URL("/api/session", handle.baseUrl);
        const beforeLogout = await fetch(sessionUrl, {
          headers: { cookie: browserSession },
        });
        assert.equal(beforeLogout.status, 200);
        await beforeLogout.text();
        try {
          assert.equal(
            await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `(()=>{const button=${logoutButton};if(!button)return false;button.click();return true;})()`,
              returnByValue: true,
            }),
            true,
          );
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== "shared_access_browser_context_replaced"
          )
            throw error;
        }
        let status = 200;
        for (let attempt = 0; attempt < 40 && status !== 401; attempt++) {
          const session = await fetch(sessionUrl, {
            headers: { cookie: browserSession },
          });
          status = session.status;
          await session.text();
          if (status !== 401) await delay(100);
        }
        assert.equal(status, 401);
        return;
      }
      if (mode === "git-operations") {
        await waitForBrowserCondition(
          pageUrl,
          `document.readyState==='complete'&&Boolean(document.querySelector('#repository form:has([name=operation][value=prepare])'))`,
        );
        const identifyGitWrite = String.raw`(input,options)=>{
          const route=new URL(String(input),location.href).pathname;
          const method=options?.method;
          if(/^\/api\/repositories\/[^/]+\/staging$/.test(route))return method==='POST'||method==='DELETE';
          return method==='POST'&&/^\/api\/repositories\/[^/]+\/revisions(?:\/(?:[a-f0-9]{40}|[a-f0-9]{64})\/publication)?$/.test(route);
        }`;
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
            const originalFetch=window.fetch;let posts=0,noCredential=true,stage='ready',diffReads=0,overviewFileQueries=0;
            const isGitWrite=${identifyGitWrite};
            window.fetch=(input,options)=>{
              const url=new URL(String(input),location.href);
              if(url.pathname==='/api/repositories/repository.next/worktree/diff'&&url.searchParams.get('path')==='work.txt')diffReads++;
              if(url.pathname==='/api/workbench/overview'&&['diffPath','treeDirectory','treeCursor'].some(name=>url.searchParams.has(name)))overviewFileQueries++;
              if(isGitWrite(input,options)){posts++;noCredential=noCredential&&options?.credentials==='omit'&&!new Headers(options?.headers).has('authorization');}
              return originalFetch(input,options);
            };
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
              await wait(()=>!!form('prepare')&&!document.querySelector('#connection form'));
              stage='file-diff';
              const fileLink=()=>[...document.querySelectorAll('#repository .repository-tree a')].find(link=>link.querySelector('code')?.textContent==='work.txt');
              await wait(()=>!!fileLink());
              fileLink().click();
              await wait(()=>[...document.querySelectorAll('#repository .repository-diff pre')].some(patch=>patch.textContent.includes('+working-next')));
              const dedicatedDiff=diffReads===1&&overviewFileQueries===0&&new URL(location.href).searchParams.get('diffPath')==='work.txt';
              stage='stage';let operation=form('prepare');operation.requestSubmit();operation.requestSubmit();await wait(()=>settled('prepare_completed'));
              const singleStage=posts===1&&!!form('unprepare');
              stage='unstage';form('unprepare').requestSubmit();await wait(()=>settled('unprepare_completed')&&!!form('prepare'));
              stage='restage';form('prepare').requestSubmit();await wait(()=>settled('prepare_completed')&&!!form('unprepare'));
              stage='commit';operation=form('create_revision');operation.querySelector('[name=message]').value='Browser Git確認';operation.requestSubmit();await wait(()=>settled('revision_created')&&!!form('publish_revision'));
              const publication=form('publish_revision'), revision=publication.querySelector('[name=revisionIdentity]').value;
              const beforeConfirmation=posts;publication.requestSubmit();await new Promise(resolve=>setTimeout(resolve,100));const confirmationRequired=posts===beforeConfirmation;
              stage='push';publication.querySelector('[name=humanConfirmed]').checked=true;publication.requestSubmit();publication.requestSubmit();await wait(()=>settled('publication_confirmed'));
              return{dedicatedDiff,singleStage,confirmationRequired,posts,noCredential,revision,selected:document.querySelector('[data-repository-id]')?.dataset.repositoryId,storageEmpty:localStorage.length===0&&sessionStorage.length===0};
            }catch(error){return{failedStage:stage,posts,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.ok(
          normal && typeof normal === "object" && "revision" in normal,
          JSON.stringify(normal),
        );
        const observed = normal as Record<string, unknown>;
        const remoteHead = spawnSync("git", ["rev-parse", "refs/heads/main"], {
          cwd: path.join(directory, "remote.git"),
          encoding: "utf8",
          windowsHide: true,
        });
        assert.equal(remoteHead.status, 0);
        assert.deepEqual(normal, {
          dedicatedDiff: true,
          singleStage: true,
          confirmationRequired: true,
          posts: 5,
          noCredential: true,
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
        const localOnly = path.join(
          directory,
          "next",
          "workspace-local-only.txt",
        );
        await writeFile(localOnly, "keep in the original worktree\n");
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
            const wait=async(predicate,limit=10000)=>{const end=Date.now()+limit;while(Date.now()<end){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error('workspace_ui_unconfirmed');};
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
            /**
             * 現在世代のAI設定Panelを取得する。
             * @responsibility 旧DOM参照を再利用しない。
             * @trace RCM-ST-012
             * @precondition 既存の現在Document。
             * @stimulus 固定IDを読む。
             * @observation 現在Panel又はnull。
             * @oracle 旧対象のPanelを採用しない。
             * @cleanup 局所参照のみ。
             * @boundary 自己生成試験内の局所代役／専用Browser。実AIなし。
             */
            const panel=()=>document.querySelector('#workspaces'), button=(text)=>[...panel().querySelectorAll('button')].find(b=>b.textContent===text), notice=()=>panel().querySelector('[role=status]')?.textContent;
            const originalFetch=window.fetch;let creates=0,renames=0,corrupt=false,stage='queue',lastResult=null;
            window.fetch=async(input,options)=>{const route=new URL(String(input),location.href).pathname;const method=options?.method??'GET';const collection=/^\\/api\\/repositories\\/[^/]+\\/workspaces$/.test(route);const item=/^\\/api\\/repositories\\/[^/]+\\/workspaces\\/[0-9a-f-]+$/.test(route);const command=collection&&method==='POST'?{operation:'create'}:item&&method==='PATCH'?{operation:'rename'}:item&&method==='GET'?{operation:'get'}:null;if(command?.operation==='create')creates++;if(command?.operation==='rename')renames++;const response=await originalFetch(input,options);if(command?.operation==='create'){lastResult={httpStatus:response.status};try{const value=await response.clone().json();lastResult={...lastResult,status:value.status,reason:/^[a-z_]+$/.test(value.data?.reason??'')?value.data.reason:null};}catch{lastResult={...lastResult,json:false};}}if(corrupt===true&&command?.operation==='rename'){await response.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}if(typeof corrupt==='string'&&command?.operation==='get'){const result=await response.json();if(corrupt==='wrong-id')result.data.workspace.workspaceId='00000000-0000-4000-8000-000000000099';if(corrupt==='bad-paths')result.data.changedPaths=[{}];if(corrupt==='fixture-paths')result.data.changedPaths=['synthetic-changed.txt'];return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}if(corrupt==='bad-status'&&command?.operation==='rename'){const result=await response.json();result.data.status='made-up';return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}return response;};
            try{
              button('受付一覧を再取得').click();await wait(()=>panel().querySelector('select')?.options.length===3);
              const queue=panel().querySelector('select');queue.value='queue-a';queue.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>requestAnimationFrame(resolve));
              stage='create-warning';const createStarted=performance.now();const create=button('独立した作業領域を作成');create.click();create.click();await wait(()=>notice()?.includes('引き継がれません')&&!!button('変更を引き継がずに作成'),30000);
              const confirmedBeforeCreation=creates===1&&!button('状態・変更一覧を再取得');
              stage='create';const confirm=button('変更を引き継がずに作成');confirm.click();confirm.click();await wait(()=>notice()?.includes('操作完了')&&!!button('状態・変更一覧を再取得'),30000);
              const singleCreate=creates===2,createMilliseconds=Math.round(performance.now()-createStarted);
              stage='rename-response';corrupt=true;button('表示名を変更').click();await wait(()=>notice()?.includes('結果未確認'));await new Promise(resolve=>setTimeout(resolve,80));const noResend=renames===1;
              corrupt=false;button('受付一覧を再取得').click();await wait(()=>notice()?.includes('受付を選択')&&!!button('状態・変更一覧を再取得'));
              const fresh=renames===1&&!notice()?.includes('結果未確認');
              const invalidResults=[];
              for(const kind of ['wrong-id','bad-paths','bad-status']){stage=kind;
                // 不正status時の表示保持を非空の合成一覧で反証する。Git差分の実在主張とは別。
                if(kind==='bad-status'){corrupt='fixture-paths';button('状態・変更一覧を再取得').click();await wait(()=>panel().querySelector('.table-scroll')?.textContent.includes('synthetic-changed.txt'));}
                const before=panel().querySelector('dl').textContent, beforePaths=panel().querySelector('.table-scroll')?.textContent;corrupt=kind;
                button(kind==='bad-status'?'表示名を変更':'状態・変更一覧を再取得').click();await wait(()=>notice()?.includes('結果未確認'));
                const unchanged=panel().querySelector('dl').textContent===before&&panel().querySelector('.table-scroll')?.textContent===beforePaths, count=renames;
                button('表示名を変更').click();await new Promise(resolve=>setTimeout(resolve,80));
                const noExtra=renames===count;corrupt=false;button('状態・変更一覧を再取得').click();await wait(()=>notice()?.includes('現在の作業領域と変更を取得'));
                invalidResults.push(unchanged&&noExtra);
              }
              stage='end';const endStarted=performance.now();const check=[...panel().querySelectorAll('input[type=checkbox]')].find(input=>input.closest('label')?.textContent.includes('未採用変更'));check.click();await new Promise(resolve=>requestAnimationFrame(resolve));button('この独立作業領域を終了・破棄').click();await wait(()=>notice()?.includes('操作完了')&&!!button('独立した作業領域を作成'),30000);
              return {createMilliseconds,endMilliseconds:Math.round(performance.now()-endStarted),singleCreate,confirmedBeforeCreation,noResend,fresh,invalidResults,ended:!button('状態・変更一覧を再取得')};
            }catch(error){return {failedStage:stage,creates,renames,lastResult,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.ok(workspace && typeof workspace === "object");
        const { createMilliseconds, endMilliseconds, ...workspaceResult } =
          workspace as Record<string, unknown>;
        assert.equal(
          typeof createMilliseconds,
          "number",
          JSON.stringify(workspaceResult),
        );
        assert.equal(
          typeof endMilliseconds,
          "number",
          JSON.stringify(workspaceResult),
        );
        console.log(
          "workspace_browser_owned_git_milliseconds",
          createMilliseconds,
          endMilliseconds,
        );
        assert.deepEqual(workspaceResult, {
          singleCreate: true,
          confirmedBeforeCreation: true,
          noResend: true,
          fresh: true,
          invalidResults: [true, true, true],
          ended: true,
        });
        assert.equal(
          await readFile(localOnly, "utf8"),
          "keep in the original worktree\n",
        );
        await rm(localOnly);
        await waitForBrowserCondition(
          pageUrl,
          `Boolean(document.querySelector('#repository form:has([name=operation][value=prepare]):has([name=path][value="zz-follow-up.txt"])'))`,
        );
        const changePreview = await fetch(
          new URL(
            "/api/repositories/repository.next/changes/CHG-000901",
            handle.baseUrl,
          ),
        );
        assert.equal(changePreview.status, 200);
        assert.equal((await changePreview.json()).identity, "CHG-000901");
        const faults = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const originalFetch=window.fetch;let posts=0,failRead=false,corrupt=false,hold=false,release=null,signal=null,stage='saved-read-failure',detailStatus=null;
            const isGitWrite=${identifyGitWrite};
            window.fetch=async(input,options)=>{const url=new URL(String(input),location.href);const write=isGitWrite(input,options);if(url.pathname==='/api/workbench/overview'&&failRead)throw new Error('fixture_read_failure');if(write)posts++;const response=await originalFetch(input,options);if(url.pathname.endsWith('/changes/CHG-000901'))detailStatus=response.status;if(write&&corrupt){await response.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}if(write&&hold){signal=options.signal;return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
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
            /**
             * AI設定操作の現在通知を観測する。
             * @responsibility 保存済み・不明・再取得を表示から分ける。
             * @trace RCM-ST-012
             * @precondition 現在Panel。
             * @stimulus 固定status要素を読む。
             * @observation 通知又は欠測。
             * @oracle 旧通知をGET完了へ換算しない。
             * @cleanup 局所読取りのみ。
             * @boundary 自己生成試験内の局所代役／専用Browser。実AIなし。
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
              stage='switch';const link=document.createElement('a');link.href='/change?id=CHG-000901&repositoryId=repository.next';document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();await wait(()=>location.pathname==='/change'&&document.querySelector('#artifact-detail .canonical-markdown')?.textContent.includes('単体の試験用成果物'));
              const aborted=signal?.aborted===true;release();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const lateRejected=posts===4&&detailStatus===200&&!document.querySelector('.repository-operation-surface .operation-result')&&location.pathname==='/change'&&document.querySelector('#artifact-detail .canonical-markdown')?.textContent.includes('単体の試験用成果物');
              return{knownSaved,retryNoPost,unknownNotUnsaved,unknownRetryNoPost,blockedSeparate,blockedRetryNoPost,aborted,lateRejected,posts};
            }catch(error){return{failedStage:stage,posts,detailStatus,atDetail:location.pathname==='/change',blocked:document.querySelector('[data-workbench-react-root]')?.dataset.workbenchClient==='blocked',errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{if(release)release();window.fetch=originalFetch;}
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
          "zz-follow-up.txt",
        );
        assert.equal(
          spawnSync("git", ["rev-parse", "HEAD"], {
            cwd: path.join(directory, "latest"),
            encoding: "utf8",
            windowsHide: true,
          }).stdout.trim(),
          otherHead,
        );
        assert.ok(accessBaseline);
        assert.deepEqual(await accessFixture.baseline(), accessBaseline);
        return;
      }
      if (mode === "artifact-navigation") {
        assert.ok(browserSession);
        const beforeNavigation = await accessFixture.baseline();
        const observed = await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async()=>{
            const originalFetch=window.fetch;let authenticated=0,reads=0,stage='select';
            window.fetch=async(input,options)=>{const response=await originalFetch(input,options);const route=new URL(String(input),location.href).pathname;if(route==='/api/workbench/overview'||route.includes('/changes/')||route.endsWith('/artifacts')){reads++;if(response.ok&&options.credentials==='same-origin'&&!new Headers(options.headers).has('authorization'))authenticated++;}return response;};
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
              click('/?repositoryId=repository.next');await wait(()=>!!document.querySelector('#documentation'));
              const unsentInput=document.createElement('input');document.querySelector('#documentation').append(unsentInput);unsentInput.value='synthetic-unsent';const beforeInputHash=reads;click('#documentation');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              const hashInputPreserved=document.querySelector('#documentation').contains(unsentInput)&&unsentInput.value==='synthetic-unsent'&&reads===beforeInputHash;unsentInput.remove();
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
              if(standaloneMismatch&&url.pathname==='/api/workbench/context')return new Response(JSON.stringify(lastModel),{headers:{'content-type':'application/json'}});
              const response=await originalFetch(input,options);
              if(url.pathname==='/api/repositories/repository.next/changes/CHG-000401'){
                const model=await response.json();
                lastModel=structuredClone(model);
                if(selectionNull){model.scope='single';return new Response(JSON.stringify(model),{headers:{'content-type':'application/json'}});}
                if(corrupt){model.repositoryId='repository.latest';return new Response(JSON.stringify(model),{headers:{'content-type':'application/json'}});}
                signal=options.signal;model.markdown='遅延旧本文';return new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify(model),{headers:{'content-type':'application/json'}}));});
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
        const logout = await fetch(new URL("/api/session", handle.baseUrl), {
          method: "DELETE",
          headers: { cookie: browserSession, origin: handle.baseUrl },
        });
        assert.equal(logout.status, 204);
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
              expression: `(async()=>{const end=Date.now()+10000;while(Date.now()<end){if(document.querySelector('form[action="/api/session/login/google"]'))return{reconnect:true,bodyAbsent:!document.querySelector('#artifact-detail'),storageEmpty:localStorage.length===0&&sessionStorage.length===0};await new Promise(r=>setTimeout(r,40));}return{reconnect:false};})()`,
              awaitPromise: true,
              returnByValue: true,
            });
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.message !== "shared_access_browser_context_replaced"
            )
              throw error;
          }
        }
        assert.deepEqual(reloaded, {
          reconnect: true,
          bodyAbsent: true,
          storageEmpty: true,
        });
        assert.deepEqual(await accessFixture.baseline(), beforeNavigation);
        return;
      }
      if (mode === "content-operations") {
        assert.ok(browserSession);
        assert.ok(browserLogin);
        const contentBaseline = await accessFixture.baseline();
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
        const originalRead = fs.promises.readFile;
        let deniedReads = 0;
        const deniedObservation = context.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof fs.openSync>) => {
            if (String(args[0]) === targetContext) deniedReads++;
            return originalOpen(...args);
          },
        );
        const asyncObservation = context.mock.method(
          fs.promises,
          "readFile",
          (...args: Parameters<typeof fs.promises.readFile>) => {
            if (String(args[0]) === targetContext) deniedReads++;
            return originalRead(...args);
          },
        );
        syncBuiltinESMExports();
        try {
          const probe = fs.openSync(targetContext, "r");
          fs.closeSync(probe);
          await readFile(targetContext);
          assert.equal(
            deniedReads,
            2,
            "denied_reader_observer_positive_control",
          );
          const beforeTimeOnly = await accessFixture.baseline();
          const contentRequest = `(async()=>{const reply=await fetch('/api/workbench/overview?repositoryId=repository.next');return{status:reply.status,model:await reply.json()};})()`;
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
          const later = Date.now() + 60_000;
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
            assert.deepEqual(await accessFixture.baseline(), beforeTimeOnly);
          } finally {
            clock.mock.restore();
          }
          await accessFixture.setObservation(contentBaseline, "developer");
          const developerView = (await requestBrowser(
            pageUrl,
            "Runtime.evaluate",
            {
              expression: contentRequest,
              awaitPromise: true,
              returnByValue: true,
            },
          )) as { status: number; model?: { selectedRepositoryId?: string } };
          assert.equal(
            developerView.status,
            200,
            "管理ロールはGitの内容権限を狭めない",
          );
          assert.equal(
            developerView.model?.selectedRepositoryId,
            "repository.next",
          );
          for (const scenario of [
            "account-unlinked",
            "git-read-removed",
            "git-host-unavailable",
            "root-unavailable",
          ] as const) {
            browserLogin.setGitRead(
              scenario === "git-read-removed"
                ? "denied"
                : scenario === "git-host-unavailable"
                  ? "unavailable"
                  : "allowed",
            );
            if (scenario === "root-unavailable")
              await writeFile(targetManifest, "synthetic-invalid-manifest");
            await accessFixture.setObservation(
              contentBaseline,
              scenario === "account-unlinked" ? "unlinked" : "unchanged",
            );
            const beforeRequest = await accessFixture.baseline();
            deniedReads = 0;
            const rejected = await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `(async()=>{const reply=await fetch('/api/workbench/overview?repositoryId=repository.next');return{status:reply.status,closedBody:await reply.text()==='local_repository_access_unavailable'+String.fromCharCode(10)};})()`,
              awaitPromise: true,
              returnByValue: true,
            });
            assert.deepEqual(
              rejected,
              { status: 403, closedBody: true },
              scenario,
            );
            assert.equal(deniedReads, 0, scenario);
            assert.deepEqual(
              await accessFixture.baseline(),
              beforeRequest,
              scenario,
            );
            assert.deepEqual(
              await readFile(targetContext),
              contextBefore,
              scenario,
            );
            await writeFile(targetManifest, manifestBefore);
          }
        } finally {
          browserLogin.setGitRead("allowed");
          deniedObservation.mock.restore();
          asyncObservation.mock.restore();
          syncBuiltinESMExports();
          await accessFixture.setObservation(contentBaseline, "unchanged");
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
            const originalFetch=window.fetch;
            let posts=0, reads=0, portfolioReads=0, failRead=false, corruptResponse=false, lastBody=null, stage='connect', createSurface=null, lastPostStatus=null, lastOverviewStatus=null;
            let releasePortfolio;
            const portfolioGate=new Promise(resolve=>{releasePortfolio=resolve;});
            window.fetch=async(input, options)=>{
              const url=new URL(String(input),location.href);
              if(url.pathname==='/api/projects' && url.searchParams.get('repositoryId')==='repository.next') {
                portfolioReads++;
                if(portfolioReads===2) await portfolioGate;
              }
              if(url.pathname==='/api/workbench/overview') reads++;
              if(url.pathname==='/api/workbench/overview' && failRead) throw new Error('fixture_read_failure');
              const isRecordWrite=/^\\/api\\/repositories\\/[^/]+\\/(topics|meetings)(\\/|$)/.test(url.pathname) && ['POST','PATCH','DELETE','PUT'].includes(options?.method);
              if(isRecordWrite) { posts++; lastBody=String(options.body); }
              const response=await originalFetch(input, options);
              if(isRecordWrite) lastPostStatus=response.status;
              if(url.pathname==='/api/workbench/overview') lastOverviewStatus=response.status;
              if(isRecordWrite && corruptResponse) { await response.arrayBuffer(); return new Response('{',{headers:{'content-type':'application/json'}}); }
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
            const createForm=()=>document.querySelector('#topics form[data-record-operation]:has([name=operation][value=create])');
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
              const portfolioShown=()=>document.querySelector('#portfolio a[href="/project?id=project.fixture"]')!==null;
              stage='select'; click('/?repositoryId=repository.next'); await wait(()=>!!createForm() && !createForm().closest('fieldset').disabled && portfolioReads===1 && portfolioShown());
              const form=createForm(); form.closest('details').open=true; form.querySelector('textarea').value=markdown('TOPIC-000101','初期',1);
              createSurface=form.closest('.record-operation-surface');
              stage='create'; form.requestSubmit(); form.requestSubmit(); await wait(saved);
              stage='portfolio-refresh'; await wait(()=>portfolioReads===2);
              const previousPortfolioHidden=!portfolioShown();
              releasePortfolio(); await wait(portfolioShown);
              const portfolioRefreshed=previousPortfolioHidden && portfolioReads===2;
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
              return {singleCreate,selectedAfterCreate,portfolioRefreshed,detailUpdated,confirmationRequired,deletedToSameRepository,singleDeleteRead,deleteHistoryConsistent,posts};
            } catch {const notice=document.querySelector('.record-operation-surface [role=status]');return {failedStage:stage,posts,portfolioReads,lastPostStatus,lastOverviewStatus,sameSurface:document.querySelector('.record-operation-surface')===createSurface,notice:notice?.innerText?.includes('未確認')?'unconfirmed':notice?.innerText?.includes('保存')?'saved':notice?'other':'absent'};} finally {releasePortfolio();window.fetch=originalFetch;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.deepEqual(observed, {
          portfolioRefreshed: true,
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
              if(route==='/api/workbench/overview' && failRead) throw new Error('fixture_read_failure');
              const isRecordWrite=/^\\/api\\/repositories\\/[^/]+\\/(topics|meetings)(\\/|$)/.test(route) && ['POST','PATCH','DELETE','PUT'].includes(options?.method);
              if(isRecordWrite){posts++;lastBody=String(options.body);}
              const response=await originalFetch(input,options);
              if(isRecordWrite && corruptResponse){await response.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}
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
              const noSecret=localStorage.length===0 && sessionStorage.length===0 && !document.cookie.includes('crdd-client-session=') && !location.href.includes('crdd-client-session') && !lastBody.includes('crdd-client-session');
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
            window.fetch=async(input,options)=>{const route=new URL(String(input),location.href).pathname;if(/^\\/api\\/repositories\\/[^/]+\\/(topics|meetings)(\\/|$)/.test(route)&&['POST','PATCH','DELETE','PUT'].includes(options?.method)){posts++;lastBody=JSON.parse(options.body);}const response=await originalFetch(input,options);if(route==='/api/workbench/overview')lastReadStatus=response.status;return response;};
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
              const earlyCloseRejected=document.querySelector('#meeting-detail header')?.innerText.includes('recorded') && lastBody.closeMeeting===true;
              stage='first-outcome'; fill('OUT-001',false).requestSubmit();await wait(()=>result('meeting_outcome_treated'));
              const uncheckedFalseOnce=lastBody.closeMeeting===false && document.querySelector('#meeting-detail header')?.innerText.includes('recorded');
              stage='final-close'; fill('OUT-002',true).requestSubmit();await wait(()=>result('meeting_outcome_treated') && document.querySelector('#meeting-detail header')?.innerText.includes('closed'));
              const closed=lastBody.closeMeeting===true && new URL(location.href).searchParams.get('repositoryId')==='repository.next';
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
            const originalFetch=window.fetch; let posts=0, failedReads=0, failRead=false, holdPost=false, releaseLate=null, lateSignal=null, stage='detail-select';
            window.fetch=async(input,options)=>{
              const route=new URL(String(input),location.href).pathname;
              if(route==='/api/repositories/repository.next/topics/TOPIC-000103' && (options?.method??'GET')==='GET' && failRead){failedReads++;throw new Error('fixture_read_failure');}
              const isRecordWrite=/^\\/api\\/repositories\\/[^/]+\\/(topics|meetings)(\\/|$)/.test(route) && ['POST','PATCH','DELETE','PUT'].includes(options?.method);
              if(isRecordWrite) posts++;
              const response=await originalFetch(input,options);
              if(isRecordWrite && holdPost) {lateSignal=options.signal;return new Promise(resolve=>{releaseLate=()=>resolve(response);});}
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
              return {detailHidden,detailFreshSame,blockedSeparated,blockedNoResend,aborted,lateNotAdopted,posts,failedReads};
            }catch(error){return {failedStage:stage,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other',posts,failedReads};}finally{if(releaseLate)releaseLate();window.fetch=originalFetch;}
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
          failedReads: 2,
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
        assert.deepEqual(await accessFixture.baseline(), contentBaseline);
        return;
      }
      if (
        mode === "ai-selection-manager" ||
        mode === "ai-selection-developer"
      ) {
        assert.ok(browserSession);
        const accessBeforeSelection = await accessFixture.baseline();
        const observed = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
            const original=window.fetch; let posts=0, corrupt=false, failView=false, held=null, heldSignal=null, stage='session',noAuthorization=true;
            window.fetch=async(input,options)=>{
              const url=new URL(input instanceof Request?input.url:String(input),location.href),route=url.pathname;
              const method=(options?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
              const selection=url.origin===location.origin&&/^\\/api\\/repositories\\/[^/]+\\/ai-selection$/.test(route);
              if(selection){
                if(method==='PUT')posts++;
                noAuthorization=noAuthorization&&!new Headers(options?.headers).has('authorization');
              }
              if(route==='/api/workbench/overview'&&failView)throw Error('fixture_read_unavailable');
              const reply=await original(input,options);
              if(selection&&method==='PUT'&&corrupt){await reply.arrayBuffer();return new Response('{',{headers:{'content-type':'application/json'}});}
              if(selection&&method==='GET'&&held===true){heldSignal=options.signal;return new Promise(resolve=>{held=()=>resolve(reply);});}
              return reply;
            };
            /**
             * 設定画面の現在状態だけを期限内で観測する。
             * @responsibility 途中描画を成功へ畳まない。
             * @trace RCM-ST-012
             * @precondition 自己生成Repositoryの本番画面。
             * @stimulus 10秒以内のDOM再観測。
             * @observation 状態とForm。
             * @oracle 未成立は固定例外。
             * @cleanup 親CaseがBrowserと試験Rootを回収する。
             * @boundary 専用Browser内。実AIなし。
             */
            const wait=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(predicate())return true;await new Promise(r=>setTimeout(r,40));}throw Error('ai_selection_ui_unconfirmed');};
            /**
             * 設定画面の対象Repositoryを切り替える。
             * @responsibility 既存CSR導線と現在対象の成立を待つ。
             * @trace RCM-ST-012
             * @precondition 自己生成の認可済みID。
             * @stimulus 同一Originのlinkを操作する。
             * @observation 現在Repository ID。
             * @oracle 別対象の表示を到達としない。
             * @cleanup 生成linkを即除去しBrowserは親が回収する。
             * @boundary 自己生成試験内の局所代役／専用Browser。実AIなし。
             */
            const navigate=async(id)=>{const link=document.createElement('a');link.href='/?repositoryId='+id;document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();await wait(()=>document.querySelector('[data-repository-id]')?.dataset.repositoryId===id);};
            /**
             * 現在の設定管理Panelを取得する。
             * @responsibility 対象切替後の現DOMを毎回参照する。
             * @trace RCM-ST-012
             * @precondition 本番CSRを専用Browserで表示済み。
             * @stimulus 固定IDのPanelを検索する。
             * @observation 現在のElement又は不存在。
             * @oracle 呼出しCaseが対象・表示内容を照合する。
             * @cleanup N/A: DOMを変更しない。
             * @boundary 自己生成Repositoryと専用Browserの表示観測。
             */
            const panel=()=>document.querySelector('#ai-selection-management');
            /**
             * 現在Panelの操作結果表示を読む。
             * @responsibility 保存済みと不明の表示を現在DOMから観測する。
             * @trace RCM-ST-012
             * @precondition Panelの存在は呼出しCaseが待機する。
             * @stimulus statusの本文を読む。
             * @observation 現在の表示文又は欠測。
             * @oracle 呼出しCaseが期待する状態と照合する。
             * @cleanup N/A: DOMを変更しない。
             * @boundary 本番結果表示と試験Oracle。
             */
            const notice=()=>panel()?.querySelector('[role=status]')?.textContent;
            /**
             * 応答故障用の合成ラベルを設定する。
             * @responsibility 既存JSON詳細入力とReactイベントを搬送する。
             * @trace RCM-ST-012
             * @precondition 現在の合成設定。
             * @stimulus native setterとinput後の描画を待つ。
             * @observation 現在の送信Form。
             * @oracle 入力以外の値を変更しない。
             * @cleanup Browser内の合成値だけ。
             * @boundary 自己生成試験内の局所代役／専用Browser。実AIなし。
             */
            const fill=async(label)=>{const textarea=panel().querySelector('textarea');const value=JSON.parse(textarea.value);value.workTypes.coding.label=label;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,JSON.stringify(value));textarea.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>requestAnimationFrame(resolve));return panel().querySelector('form');};
            /**
             * 現在設定の明示GETを開始する。
             * @responsibility POSTを再送せず既存取得buttonを使う。
             * @trace RCM-ST-012
             * @precondition 現在Panelと非保留状態。
             * @stimulus 再取得buttonを押す。
             * @observation GET応答・現在設定・POST数。
             * @oracle 保存を再送しない。
             * @cleanup 保留要求は親Caseが終了する。
             * @boundary 自己生成試験内の局所代役／専用Browser。実AIなし。
             */
            const read=()=>panel().querySelector('button').click();
            try {
              await wait(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='ログアウト'));
              if(${JSON.stringify(mode)}==='ai-selection-manager'){
                [...document.querySelectorAll('button')].find(button=>button.textContent==='管理セッションを開始').click();
                await wait(()=>!!document.querySelector('#access-management'));
              }
              const noHostSettings=!panel();
              stage='select';await navigate('repository.next');
              await wait(()=>document.querySelector('#ai-selection'));
              if(${JSON.stringify(mode)}==='ai-selection-developer'){
                const response=await fetch('/api/repositories/repository.next/ai-selection',{credentials:'same-origin'});
                await response.text();
                return {noHostSettings,secretAbsent:noAuthorization&&localStorage.length===0&&sessionStorage.length===0,readRejected:response.status===403&&!document.querySelector('#ai-selection').textContent.includes('gpt-5.5'),managementAbsent:!panel(),posts};
              }
              await wait(()=>panel()?.querySelector('textarea')&&!panel().querySelector('button').disabled);
              stage='edit-controls';
              /**
               * JSON手編集を使わず標準入力を操作する。
               * @responsibility 実際のinput/selectイベントと描画更新を搬送する。
               * @trace RCM-ST-012
               * @precondition 現在の入力要素と合成値。
               * @stimulus native setterとchange/inputを発火する。
               * @observation 同じJSON draftへ反映した設定。
               * @oracle 入力が欠測のままでも既定Modelを補完しない。
               * @cleanup Browserの局所入力だけ。
               * @boundary 自己生成試験内の局所代役／専用Browser。実AIなし。
               */
              const change=async(element,value)=>{Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await new Promise(resolve=>requestAnimationFrame(resolve));};
              await change(panel().querySelector('[aria-label="coding 表示名"]'),'browser-saved');
              await change(panel().querySelector('[aria-label="advice Provider default"]'),'claude');
              await change(panel().querySelector('[aria-label="advice Model default"]'),'opus');
              await change(panel().querySelector('[aria-label="advice Effort default"]'),'high');
              await change(panel().querySelector('[aria-label="新しい分類ID"]'),'translation');
              await change(panel().querySelector('[aria-label="新しい分類の表示名"]'),'翻訳');
              [...panel().querySelectorAll('button')].find(button=>button.textContent==='作業分類を追加').click();
              await wait(()=>!!panel().querySelector('[aria-label="translation 表示名"]'));
              const translation=panel().querySelector('[aria-label="translation 表示名"]').closest('fieldset');
              [...translation.querySelectorAll('button')].find(button=>button.textContent==='executor の上書きを編集').click();
              await wait(()=>!!panel().querySelector('[aria-label="executor Model translation"]'));
              await change(panel().querySelector('[aria-label="executor Provider translation"]'),'claude');
              await change(panel().querySelector('[aria-label="executor Model translation"]'),'opus');
              await change(panel().querySelector('[aria-label="executor Effort translation"]'),'medium');
              const changed=JSON.parse(panel().querySelector('textarea').value);
              const controlsEdited=changed.roleDefaults.advice.model==='opus'&&changed.roleDefaults.advice.effort==='high'&&changed.workTypes.coding.label==='browser-saved'&&changed.overrides.executor.translation.model==='opus';
              [...translation.querySelectorAll('button')].find(button=>button.textContent==='executor の上書きを削除').click();
              await wait(()=>!panel().querySelector('[aria-label="executor Model translation"]'));
              [...translation.querySelectorAll('button')].find(button=>button.textContent==='分類と上書きを削除').click();
              await wait(()=>!panel().querySelector('[aria-label="translation 表示名"]'));
              const removed=JSON.parse(panel().querySelector('textarea').value);
              const controlsRemoved=!Object.hasOwn(removed.workTypes,'translation')&&!Object.hasOwn(removed.overrides.executor,'translation');
              stage='save';const form=panel().querySelector('form');form.requestSubmit();form.requestSubmit();
              await wait(()=>notice()?.includes('保存を確認')&&!panel().querySelector('button').disabled);
              const singleSave=posts===1;
              stage='response-lost';corrupt=true;(await fill('response-lost')).requestSubmit();
              await wait(()=>notice()?.includes('変更結果を確認できません'));
              await new Promise(r=>setTimeout(r,80));const noResponseRetry=posts===2;
              stage='read-after-loss';corrupt=false;read();await wait(()=>notice()?.includes('現在の設定を確認しました')&&panel().querySelector('textarea').value.includes('response-lost')&&!panel().querySelector('button').disabled);
              const freshAfterLoss=posts===2;
              stage='read-failure';failView=true;(await fill('saved-before-read-failure')).requestSubmit();
              await wait(()=>notice()?.includes('保存は確認済み'));
              const savedRetained=panel().textContent.includes('saved')&&posts===3;
              stage='read-after-failure';failView=false;read();await wait(()=>notice()?.includes('現在の設定を確認しました')&&panel().querySelector('textarea').value.includes('saved-before-read-failure')&&!panel().querySelector('button').disabled);
              stage='pending';held=true;read();await wait(()=>typeof held==='function');
              stage='switch';await navigate('repository.latest');
              const cancelled=heldSignal.aborted;
              const release=held;held=null;release();await new Promise(r=>setTimeout(r,80));
              const lateRejected=!panel().querySelector('textarea').value.includes('saved-before-read-failure');
              const initialize=[...panel().querySelectorAll('button')].find(button=>button.textContent==='新しい設定を編集');initialize.click();
              await wait(()=>panel().querySelectorAll('select').length===15);
              const missingNotDefaulted=[...panel().querySelectorAll('select')].every(select=>select.value==='')&&posts===3;
              await navigate('repository.next');await wait(()=>panel().querySelector('textarea').value.includes('saved-before-read-failure'));
              return {noHostSettings,secretAbsent:noAuthorization&&localStorage.length===0&&sessionStorage.length===0,controlsEdited,controlsRemoved,singleSave,noResponseRetry,freshAfterLoss,savedRetained,cancelled,lateRejected,missingNotDefaulted,posts};
            }catch(error){return {failedStage:stage,posts,busy:panel()?.querySelector('button')?.disabled,formConnected:panel()?.querySelector('form')?.isConnected,errorClass:['Error','TypeError','SyntaxError','ReferenceError'].includes(error?.name)?error.name:'other'};}finally{window.fetch=original;}
          })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
        );
        assert.deepEqual(
          observed,
          mode === "ai-selection-developer"
            ? {
                noHostSettings: true,
                secretAbsent: true,
                readRejected: true,
                managementAbsent: true,
                posts: 0,
              }
            : {
                noHostSettings: true,
                secretAbsent: true,
                controlsEdited: true,
                controlsRemoved: true,
                singleSave: true,
                noResponseRetry: true,
                freshAfterLoss: true,
                savedRetained: true,
                cancelled: true,
                lateRejected: true,
                missingNotDefaulted: true,
                posts: 3,
              },
        );
        if (mode === "ai-selection-manager") {
          for (const viewport of [
            { width: 1440, height: 900 },
            { width: 1024, height: 768 },
            { width: 390, height: 844 },
          ]) {
            const layout = await requestBrowser(
              pageUrl,
              "Runtime.evaluate",
              {
                expression: `(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const panel=document.querySelector('#ai-selection-management');const form=panel.querySelector('form');const rect=panel.getBoundingClientRect();const controls=[...form.querySelectorAll('textarea,button')];form.querySelector('textarea').focus();return {width:innerWidth,height:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,panelContained:rect.left>=-1&&rect.right<=innerWidth+1,...(rect.left>=-1&&rect.right<=innerWidth+1?{}:{bounds:{left:rect.left,right:rect.right,parentWidth:panel.parentElement.getBoundingClientRect().width,mainScroll:document.querySelector('main').scrollLeft}}),targetSizes:controls.every(c=>{const r=c.getBoundingClientRect();return r.width>=32&&r.height>=32;}),fontSizes:controls.every(c=>Number.parseFloat(getComputedStyle(c).fontSize)>=12),formPresent:controls.length>0};})()`,
                awaitPromise: true,
                returnByValue: true,
              },
              viewport,
            );
            assert.deepEqual(layout, {
              ...viewport,
              pageOverflow: false,
              panelContained: true,
              targetSizes: true,
              fontSizes: true,
              formPresent: true,
              keyboardNext: true,
            });
          }
        }
        assert.deepEqual(await accessFixture.baseline(), accessBeforeSelection);
        return;
      }
      if (mode === "shared-navigation") {
        assert.ok(browserSession);
        const beforeNavigation = await accessFixture.baseline();
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
          for (const [expected, links] of [
            ["競合あり", ["repository.latest"]],
            ["一部未確認", ["repository.latest", "repository.next"]],
          ] as const) {
            await reloadBrowserDocument(pageUrl, "#projects");
            await waitForBrowserCondition(
              pageUrl,
              `document.querySelector('#projects')?.innerText.includes(${JSON.stringify(expected)})`,
            );
            const partial = await requestBrowser(pageUrl, "Runtime.evaluate", {
              expression: `(()=>{const projects=document.querySelector('#projects');return {unavailable:projects.innerText.includes('文書未確認'),conflicting:projects.innerText.includes('文書競合'),links:[...projects.querySelectorAll('a')].map(a=>a.textContent),foreign:document.body.innerText.includes('foreign-source')};})()`,
              returnByValue: true,
            });
            assert.deepEqual(partial, {
              unavailable: true,
              conflicting: expected === "競合あり",
              links,
              foreign: false,
            });
            await writeFile(nextPath, nextBody);
          }
        } finally {
          await writeFile(unavailablePath, unavailableBody);
          await writeFile(nextPath, nextBody);
        }
        await reloadBrowserDocument(pageUrl, "#projects");
        const listBoundary = await requestBrowser(pageUrl, "Runtime.evaluate", {
          expression: `(async()=>{
            const original=window.fetch;let reads=0,releaseDisconnect,disconnected=false,reject=false,stage='ready';
            const panel=()=>document.querySelector('#projects');
            const wait=async(check)=>{const end=Date.now()+15000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,40));}throw Error('project_list_boundary_unconfirmed');};
            await wait(()=>panel()?.querySelector('a'));
            window.fetch=async(input,options)=>{
              const url=new URL(String(input),location.href);
              if(url.pathname==='/api/projects'&&url.searchParams.get('limit')==='20'){
                reads++;
                if(reject)return new Response(null,{status:401});
                if(reads===1)return new Response(null,{status:503});
                if(disconnected)return Response.json({retainedAsSourceOfTruth:false,projects:[],nextCursor:null,cursorInvalid:false});
              }
              if(url.pathname.startsWith('/api/session/git/')&&options?.method==='DELETE'){
                await new Promise(resolve=>{releaseDisconnect=resolve;});
                disconnected=true;
                return new Response(null,{status:204});
              }
              return original(input,options);
            };
            try{
              stage='server-error';
              const link=document.createElement('a');link.href='/?repositoryId=#projects';document.querySelector('[data-workbench-react-root]').append(link);link.click();link.remove();
              await wait(()=>panel()?.innerText.includes('現在の内容を確認できません。'));
              const failedWithoutOldLinks=!panel().querySelector('a')&&!panel().innerText.includes('許可されたRepositoryはありません');
              stage='retry';
              [...panel().querySelectorAll('button')].find(button=>button.textContent==='再取得').click();
              await wait(()=>panel()?.querySelector('a'));
              const disconnectButton=()=>[...document.querySelectorAll('[aria-label="Gitホスト連携"] button')].find(button=>button.textContent.includes('連携を解除'));
              stage='disconnect';
              await wait(()=>!!disconnectButton());
              disconnectButton().click();
              await wait(()=>typeof releaseDisconnect==='function'&&!panel());
              const hiddenDuringDisconnect=reads===2;
              releaseDisconnect();
              await wait(()=>panel()?.innerText.includes('現在許可されたRepositoryはありません。'));
              const emptyAfterDisconnect=!panel().querySelector('a');
              stage='relogin';
              reject=true;
              const reenter=document.createElement('a');reenter.href='/?repositoryId=&documentQuery=fixture-reentry#projects';document.querySelector('[data-workbench-react-root]').append(reenter);reenter.click();reenter.remove();
              await wait(()=>!panel()&&[...document.querySelectorAll('[aria-label="ログインと利用者招待"] button')].some(button=>button.textContent.includes('でログイン')));
              return {failedWithoutOldLinks,hiddenDuringDisconnect,emptyAfterDisconnect,rejectedShowsLogin:true,reads};
            }catch{return {failedStage:stage,reads};}finally{releaseDisconnect?.();window.fetch=original;}
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        assert.deepEqual(listBoundary, {
          failedWithoutOldLinks: true,
          hiddenDuringDisconnect: true,
          emptyAfterDisconnect: true,
          rejectedShowsLogin: true,
          reads: 4,
        });
        await reloadBrowserDocument(pageUrl, "#projects");
        const observed = await requestBrowser(
          pageUrl,
          "Runtime.evaluate",
          {
            expression: `(async()=>{
              const root=document.querySelector('[data-workbench-react-root]');
              const original=window.fetch;
              let reads=0,sessionReads=0,legacyPosts=0,release=null,pendingSignal=null,stage='select';
              const mount=()=>document.querySelector('[data-workbench-react-root]');
              const selected=()=>document.querySelector('[data-repository-id]')?.dataset.repositoryId;
              const url=()=>new URL(location.href);
              const wait=async(predicate)=>{const end=Date.now()+15000;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('shared_navigation_unconfirmed');};
              const click=(href)=>{const a=document.createElement('a');a.href=href;mount().append(a);a.click();a.remove();};
              const search=(repositoryId)=>{const form=document.createElement('form');form.method='get';form.action='/';if(repositoryId){const input=document.createElement('input');input.name='repositoryId';input.value=repositoryId;form.append(input);}mount().append(form);form.requestSubmit();form.remove();};
              window.fetch=async(input,options)=>{
                const path=new URL(String(input),location.href);
                if(path.pathname==='/api/access/connection')legacyPosts++;
                if(path.pathname==='/api/workbench/overview'){
                  reads++;
                  if(path.searchParams.has('pagehideDelay')){pendingSignal=options.signal;return new Promise(resolve=>{release=resolve;});}
                  if(options.credentials==='same-origin'&&!new Headers(options.headers).has('authorization'))sessionReads++;
                }
                return original(input,options);
              };
              try{
                const firstReads=sessionReads;
                click('/?repositoryId=repository.unavailable');
                await wait(()=>selected()==='repository.unavailable');
                const currentSession=mount()===root&&sessionReads>firstReads;
                stage='inherit-link';click('/?inherited=true');
                await wait(()=>url().searchParams.has('inherited')&&url().searchParams.get('repositoryId')==='repository.unavailable'&&selected()==='repository.unavailable');
                stage='inherit-form';search();
                await wait(()=>!url().searchParams.has('inherited')&&url().searchParams.get('repositoryId')==='repository.unavailable'&&selected()==='repository.unavailable');
                stage='native';const guards=[];
                for(const kind of ['external','download','blank','modified','post']){
                  const node=document.createElement(kind==='post'?'form':'a');
                  if(kind==='post'){node.method='post';node.action='/';}else node.href=kind==='external'?'https://example.invalid/':'/';
                  if(kind==='download')node.setAttribute('download','fixture');
                  if(kind==='blank')node.target='_blank';
                  mount().append(node);
                  const type=kind==='post'?'submit':'click';let untouched=false;
                  const stopNative=event=>{untouched=!event.defaultPrevented;event.preventDefault();};
                  window.addEventListener(type,stopNative,{once:true});
                  const before=reads;
                  node.dispatchEvent(kind==='post'?new SubmitEvent('submit',{bubbles:true,cancelable:true}):new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:kind==='modified'}));
                  node.remove();await new Promise(r=>setTimeout(r,20));
                  guards.push(untouched&&reads===before);
                }
                stage='search';search('repository.next');await wait(()=>selected()==='repository.next');
                history.back();await wait(()=>selected()==='repository.unavailable');
                stage='hide';
                const restoredUrl=location.href;
                const stale=await (await original('/api/workbench/overview?repositoryId=repository.latest',{credentials:'same-origin'})).json();
                click('/?repositoryId=repository.latest&pagehideDelay=true');await wait(()=>typeof release==='function');
                window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
                const closed=root.childElementCount===0;
                const cancelled=pendingSignal?.aborted===true;
                if(location.href!==restoredUrl)history.replaceState(history.state,'',restoredUrl);
                release(new Response(JSON.stringify({...stale,notice:'終了後応答の反例'}),{headers:{'content-type':'application/json'}}));
                await new Promise(r=>setTimeout(r,80));
                const hiddenRejected=root.childElementCount===0&&!document.body.innerText.includes('終了後応答の反例');
                stage='resume';const readsBeforeResume=sessionReads;
                window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
                await wait(()=>selected()==='repository.unavailable');
                const session=await original('/api/session',{credentials:'same-origin'});
                return {currentSession,nativeGuards:guards.every(Boolean),closed,cancelled,hiddenRejected,resumedWithSession:session.status===200&&sessionReads>readsBeforeResume,legacyPosts,storageEmpty:localStorage.length===0&&sessionStorage.length===0};
              }catch(error){return {failedStage:stage,errorClass:error.name,legacyPosts,reads,sessionReads};}
              finally{window.fetch=original;}
            })()`,
            awaitPromise: true,
            returnByValue: true,
          },
          undefined,
          "composite",
          "shared_navigation",
        );
        assert.deepEqual(observed, {
          currentSession: true,
          nativeGuards: true,
          closed: true,
          cancelled: true,
          hiddenRejected: true,
          resumedWithSession: true,
          legacyPosts: 0,
          storageEmpty: true,
        });
        assert.deepEqual(await accessFixture.baseline(), beforeNavigation);
        return;
      }
    });
});
