/**
 * Workbench公開CLIの入力境界と自己生成Host起動・終了を実Processで検証する。
 * @packageDocumentation
 * @responsibility 明示mode・閉引数・Host構成拒否と未認証非開示・所有終了を観測する。
 * @trace ERB-ST-022
 * @level ST
 * @scope Help・起動前拒否・正常Host Listener・公開設定ありCLI・自己生成TLS縦断・合成Signal終了。実運用Proxy・OS Signal搬送は未確認。
 * @boundary Node Process→本番CLI。実Host資格・Providerを使用しない。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  type ClientRequest,
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingHttpHeaders,
} from "node:http";
import {
  createServer as createHttpsServer,
  request as httpsRequest,
} from "node:https";
import { createServer } from "node:net";
import path from "node:path";
import type { Duplex } from "node:stream";
import test from "node:test";
import { createCredentialMaterial } from "../../../access-management/src/credential/token.ts";
import {
  prepareHostInitializationRoot,
  readHostInitializationState,
  resolveHostRootInput,
} from "../../../access-management/src/index.ts";
import { createHostAiProfileCatalogStore } from "../../../ai-adapter/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);
const entry = path.resolve(
  import.meta.dirname,
  "../../bin/workbench-server.ts",
);

/**
 * 自己生成CLIの固定port候補を短命Listenerから取得する。
 * @responsibility port0の案内URLと公開Originを分けて内部観測できるようにする。
 * @trace ERB-ST-022
 * @precondition loopbackだけへlistenする。
 * @stimulus 一回のport0待受とclose。
 * @observation 数値portとListener終了。
 * @oracle 候補を後続Processまで予約済みと表示しない。競合時はCLI起動失敗にする。
 * @cleanup 所有Listenerをcloseしてから返す。
 * @boundary 試験準備だけ。製品Listener設定を変更しない。
 */
async function availableEntryPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  assert.ok(address && typeof address !== "string");
  return address.port;
}

/**
 * 公開Host案内を保持して所有CLIまたは試験TLS終端へ要求を搬送する。
 * @responsibility HTTP／HTTPSを実通信し、明示CA検証と公開Host Headerを維持する。
 * @trace ERB-ST-022
 * @precondition URLは自己生成http loopback、または明示試験CA付きlocalhost HTTPSで、有限Signalを渡す。
 * @stimulus 同OriginのGETまたはForm POST、公開Host／TLS案内Header。
 * @observation HTTP状態と上限16MiBの非秘密本文。
 * @oracle 受信中断・容量超過を固定失敗へ閉じ、成功へ補完しない。
 * @cleanup Responseをendまで取得し、異常時は所有Requestを破棄する。
 * @boundary 所有CLIの内部HTTP、または所有TLS終端への実HTTPS。運用Hostの検証ではない。
 */
function requestEntry(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: URLSearchParams;
    signal: AbortSignal;
    ca?: Buffer | undefined;
  },
): Promise<Response> {
  const parsed = new URL(url);
  assert.ok(parsed.protocol === "http:" || parsed.protocol === "https:");
  assert.ok(parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (parsed.protocol === "https:") assert.ok(options.ca);
  return new Promise((resolve, reject) => {
    const request = (parsed.protocol === "https:" ? httpsRequest : httpRequest)(
      parsed,
      { ...options, agent: false },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 16 * 1024 * 1024)
            request.destroy(new Error("entry_response_limit"));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("aborted", () =>
          reject(new Error("entry_response_aborted")),
        );
        response.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
            }),
          ),
        );
      },
    );
    request.on("error", reject);
    request.end(options.body?.toString());
  });
}

/**
 * 所有CLIだけへ転送する自己生成TLS終端を構成する。
 * @responsibility 実TLSとProxyのHeader上書きを試験し、製品Gatewayを追加しない。
 * @trace ERB-ST-022
 * @precondition test-only公開証明書と内部loopback port候補だけを使用する。
 * @stimulus localhost HTTPS要求を同じHostのCLIへ配送する。
 * @observation 証明書検証済みTLS応答と内部HTTP結果。
 * @oracle Client由来のForwarded値を透過せず、接続失敗を成功へ補完しない。
 * @cleanup 受付を先に停止し、全Upstream・Socketと終了観測をjoinしてListener closeを待つ。
 * @boundary 試験TLS終端のみ。実運用Proxy設定・OS信頼Storeは変更しない。
 */
async function createEntryTlsProxy(
  backendPort: number,
  joinObservation: Promise<void> = Promise.resolve(),
) {
  const cert = await readFile(
    path.join(import.meta.dirname, "../fixtures/tls-test-certificate.pem"),
  );
  const key = await readFile(
    path.join(import.meta.dirname, "../fixtures/tls-test-key.pem"),
  );
  const sockets = new Set<Duplex>();
  const upstreams = new Set<ClientRequest>();
  const settlements = new Set<Promise<void>>();
  let origin = "";
  let closing = false;
  let closeOperation: Promise<void> | undefined;
  const server = createHttpsServer({ key, cert }, (incoming, response) => {
    if (closing) {
      incoming.destroy();
      response.destroy();
      return;
    }
    const forwarded: IncomingHttpHeaders = { ...incoming.headers };
    delete forwarded.forwarded;
    delete forwarded["x-forwarded-proto"];
    delete forwarded["x-forwarded-host"];
    forwarded["x-forwarded-proto"] = "https";
    forwarded["x-forwarded-host"] = new URL(origin).host;
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: backendPort,
        path: incoming.url,
        method: incoming.method,
        headers: forwarded,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 500, result.headers);
        result.pipe(response);
        result.on("error", () => response.destroy());
      },
    );
    upstreams.add(upstream);
    const joined = new Promise<void>((resolve) =>
      upstream.once("close", () => {
        upstreams.delete(upstream);
        void joinObservation.then(resolve);
      }),
    );
    settlements.add(joined);
    void joined.then(() => settlements.delete(joined));
    upstream.on("error", () => response.destroy());
    incoming.on("aborted", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableFinished) upstream.destroy();
    });
    incoming.pipe(upstream);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `https://localhost:${address.port}`;
  return {
    origin,
    ca: cert,
    close: () => {
      if (closeOperation) return closeOperation;
      closing = true;
      const listenerClosed = new Promise<Error | undefined>((resolve) =>
        server.close((error) => resolve(error)),
      );
      closeOperation = (async () => {
        const pending = [...settlements];
        for (const upstream of upstreams) upstream.destroy();
        for (const socket of sockets) socket.destroy();
        await Promise.all(pending);
        const closeError = await listenerClosed;
        if (closeError) throw closeError;
        assert.equal(upstreams.size, 0);
        assert.equal(sockets.size, 0);
        assert.equal(settlements.size, 0);
        await assert.rejects(
          requestEntry(origin, { ca: cert, signal: AbortSignal.timeout(2000) }),
          (error) => (error as NodeJS.ErrnoException).code === "ECONNREFUSED",
        );
      })();
      return closeOperation;
    },
  };
}

/**
 * 転送終了の観測待機中にTLS終端が新規要求を受け付けないことを反証する。
 * @responsibility join待機前の受付停止と、遅延要求による新Upstream生成なしを確認する。
 * @trace ERB-ST-022
 * @precondition 自己生成HTTP Listenerと公開試験証明書だけを使用する。
 * @stimulus 未応答の転送を終了し、終了観測を保留した間に新規TLS接続を試みる。
 * @observation fresh接続の拒否、Backend要求件数、全終了待機の完了。
 * @oracle join観測保留を実資源の生存と同一視せず、二件目のBackend要求を許さない。
 * @cleanup 保留を解除し、TLS終端とBackend Listenerをjoinする。
 * @boundary 試験用終端のみ。製品Runtimeの終了契約を変更しない。
 */
test("TLS終端は転送の終了観測待機より先に新規受付を停止する", async () => {
  let releaseJoin!: () => void;
  const joinObservation = new Promise<void>((resolve) => {
    releaseJoin = resolve;
  });
  let observeRequest!: () => void;
  const requestObserved = new Promise<void>((resolve) => {
    observeRequest = resolve;
  });
  let requests = 0;
  const backend = createHttpServer(() => {
    requests += 1;
    observeRequest();
  });
  await new Promise<void>((resolve, reject) => {
    backend.once("error", reject);
    backend.listen(0, "127.0.0.1", resolve);
  });
  const address = backend.address();
  assert.ok(address && typeof address !== "string");
  let tls: Awaited<ReturnType<typeof createEntryTlsProxy>> | undefined;
  let requestSettled: Promise<unknown> | undefined;
  try {
    tls = await createEntryTlsProxy(address.port, joinObservation);
    requestSettled = requestEntry(tls.origin, {
      ca: tls.ca,
      signal: AbortSignal.timeout(5000),
    }).then(
      () => "unexpected_response",
      () => "request_failed",
    );
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        requestObserved,
        new Promise<never>((_, reject) => {
          requestTimer = setTimeout(
            () => reject(new Error("tls_backend_request_not_observed")),
            5000,
          );
        }),
      ]);
    } finally {
      clearTimeout(requestTimer);
    }
    const closing = tls.close();
    await assert.rejects(
      requestEntry(tls.origin, {
        ca: tls.ca,
        signal: AbortSignal.timeout(2000),
      }),
      (error) => (error as NodeJS.ErrnoException).code === "ECONNREFUSED",
    );
    assert.equal(requests, 1);
    releaseJoin();
    await closing;
    assert.equal(await requestSettled, "request_failed");
  } finally {
    releaseJoin();
    try {
      await tls?.close();
      await requestSettled;
    } finally {
      backend.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        backend.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
});

/**
 * 所有Childの終了または起動不能を拒否Promiseを残さず観測する。
 * @responsibility spawn errorを正常exitから分離し、待機開始前の失敗も保持する。
 * @trace ERB-ST-022
 * @precondition Child作成直後に一度だけ登録する。
 * @stimulus Childのexitまたはerror。
 * @observation Exit値・Signal、または生成Process不存在付き起動失敗。
 * @oracle errorから正常終了や既存Process不存在を推定しない。
 * @cleanup terminal時に当該Listenerを解除する。
 * @boundary 試験が所有するChildだけ。製品のProcess lifecycleを変更しない。
 */
function observeEntryExit(child: ReturnType<typeof spawn>) {
  return new Promise<
    | { kind: "exit"; status: number | null; signal: NodeJS.Signals | null }
    | { kind: "error"; processNotCreated: boolean }
  >((resolve) => {
    /**
     * 所有Childのexitを終端結果として受け取る。
     * @responsibility error監視を解放し、実exit値とSignalを返す。
     * @trace ERB-ST-022
     * @precondition Child生成直後から監視している。
     * @stimulus Nodeのexit通知。
     * @observation exit値とSignal、error Listener解除。
     * @oracle error通知を正常exitへ変換しない。
     * @cleanup 対応error Listenerを解除する。
     * @boundary 試験所有Childの終了観測だけ。
     */
    const exited = (status: number | null, signal: NodeJS.Signals | null) => {
      child.off("error", failed);
      resolve({ kind: "exit", status, signal });
    };
    /**
     * Process未生成のspawn失敗だけを終端結果にする。
     * @responsibility 生成済みChildのerrorでは監視を継続する。
     * @trace ERB-ST-022
     * @precondition Childのerror監視を登録している。
     * @stimulus Nodeのerror通知。
     * @observation pid、失敗結果、対応Listener解除。
     * @oracle 生成済みProcessの不存在をerrorから推定しない。
     * @cleanup 未生成が確認された場合だけexit／error Listenerを解除する。
     * @boundary 試験所有Childの起動観測だけ。
     */
    const failed = () => {
      if (child.pid !== undefined) return;
      child.off("exit", exited);
      child.off("error", failed);
      resolve({ kind: "error", processNotCreated: child.pid === undefined });
    };
    child.once("exit", exited);
    child.on("error", failed);
  });
}

/**
 * 終了観測を有限時間で待ち、Timerを必ず解除する。
 * @responsibility 観測不能をTimeoutとして拒否し、未処理Promiseを作らない。
 * @trace ERB-ST-022
 * @precondition observeEntryExitの非拒否Promiseを同じChildに対して使用する。
 * @stimulus 終了観測または10秒経過。
 * @observation terminal分類または固定Timeout。
 * @oracle 待機期限超過を終了へ変換しない。
 * @cleanup settledとTimeoutの双方でTimerを解除する。
 * @boundary 所有Childの試験待機だけ。
 */
async function waitEntryExit(observation: ReturnType<typeof observeEntryExit>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      observation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("entry_exit_observation_timeout")),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Child起動不能と初期throwを終了観測で区別する。
 * @responsibility URL待機より前の失敗にも未処理拒否を残さない。
 * @trace ERB-ST-022
 * @precondition Processは試験が直接所有し、Host／Repositoryへ書き込まない。
 * @stimulus 不存在Executable、固定Node Driver初期throw、生存Childへの重複error。
 * @observation Process未生成、初期throw時Exit1、生存Childの停止後exitとListener0。
 * @oracle 両者を正常Workbench起動や正常終了へ変換しない。
 * @cleanup 有限時間で生成Childの終了を確認する。試験Fileなし。
 * @boundary 終了観測helperの異常反証。製品起動保証の代替ではない。
 */
test("CLI試験の終了観測はspawn失敗と初期throwを区別する", async () => {
  const absent = spawn(
    path.join(repositoryRoot, ".crdd", "tests", "entry-not-an-executable"),
    [],
    {
      windowsHide: true,
      shell: false,
      stdio: "ignore",
    },
  );
  assert.deepEqual(await waitEntryExit(observeEntryExit(absent)), {
    kind: "error",
    processNotCreated: true,
  });
  const failed = spawn(
    process.execPath,
    ["--eval", "throw new Error('fixed_test_driver_failure')"],
    {
      windowsHide: true,
      shell: false,
      stdio: "ignore",
    },
  );
  assert.deepEqual(await waitEntryExit(observeEntryExit(failed)), {
    kind: "exit",
    status: 1,
    signal: null,
  });
  const alive = spawn(
    process.execPath,
    ["--eval", "setInterval(()=>{},1000)"],
    {
      windowsHide: true,
      shell: false,
      stdio: "ignore",
    },
  );
  const observation = observeEntryExit(alive);
  try {
    assert.ok(alive.pid);
    alive.emit("error", new Error("synthetic_child_error_after_spawn"));
    alive.emit("error", new Error("synthetic_repeated_child_error"));
    assert.equal(alive.kill(), true);
    const terminal = await waitEntryExit(observation);
    assert.equal(terminal.kind, "exit");
    assert.equal(alive.listenerCount("exit"), 0);
    assert.equal(alive.listenerCount("error"), 0);
  } finally {
    if (
      alive.pid !== undefined &&
      alive.exitCode === null &&
      alive.signalCode === null
    )
      alive.kill();
    const terminal = await waitEntryExit(observation);
    assert.ok(terminal.kind === "exit" || terminal.processNotCreated);
  }
});

/**
 * 起動前拒否のCLIを現在のNodeから有限時間で実行する。
 * @responsibility 実Host入力を無効化し、固定出力分類と終了値だけを取得する。
 * @trace ERB-ST-022
 * @precondition 本番entryを絶対Pathで指定し、Provider要求を与えない。
 * @stimulus Help、不正引数、Host環境不足。
 * @observation Processの正常終了通知・Exit・公開出力だけ。
 * @oracle timeoutや起動例外を期待した拒否へ変換しない。
 * @cleanup 同期Processの終了を確認する。試験Fileは作成しない。
 * @boundary 起動前拒否のみ。実資源を開始する正常modeはこのhelperで使わない。
 */
function runRejectedEntry(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = { ...process.env, CROS_TRUST_DOMAIN_ID: "" },
) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 20000,
    maxBuffer: 65536,
  });
  assert.equal(result.error, undefined, "entry_process_observation_failed");
  assert.equal(result.signal, null, "entry_process_not_normally_settled");
  return result;
}

/**
 * Helpと閉引数拒否がListener開始前に終了することを確認する。
 * @responsibility 単体／CROSの曖昧なmodeと不正portを受理しない。
 * @trace ERB-ST-022
 * @precondition Host入力は試験環境で無効化済み。
 * @stimulus Help、未知・重複・不完全引数、範囲外port。
 * @observation Exit0または64と固定Help、起動通知なし。
 * @oracle 拒否を起動成功や単体fallbackとして表示しない。
 * @cleanup 各Processの同期終了を確認する。生成Fileなし。
 * @boundary 正常起動・TLS・Provider・Signal終了の証明には使用しない。
 */
test("Workbench CLIはHelpと不正引数を起動前に処置する", () => {
  const help = runRejectedEntry(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /workbench-server \[--cros\]/u);
  assert.equal(help.stderr, "");
  for (const args of [
    ["--unknown"],
    ["--cros", "--cros"],
    ["--port"],
    ["--port", "-1"],
    ["--port", "65536"],
    ["--port", "NaN"],
    ["--port", "0", "--port", "1"],
  ]) {
    const rejected = runRejectedEntry(args);
    assert.equal(rejected.status, 64);
    assert.equal(rejected.stdout, "");
    assert.match(rejected.stderr, /^使い方:/u);
  }
});

for (const mode of ["localhost", "public", "tls"] as const) {
  /**
   * 正常Hostで公開CLIの受付・非開示・所有終了を観測する。
   * @responsibility 実ListenerとCLI終了処理を同じChildで確認する。
   * @trace ERB-ST-022
   * @precondition 資格Verifierだけを持つ自己生成Hostが初期化済みである。
   * @stimulus 最小自己生成Repositoryの--cros起動、公開設定あり／なし、未認証GET、鍵接続、IPC合成SIGTERM。
   * @observation 公開案内URLと内部URLの分離、HTTP拒否と認証、Child正常終了、終了後接続拒否。
   * @oracle 起動だけでRepository情報を開示せず、Signal handlerによるcloseがProcess終了を妨げない。
   * @cleanup Child終了後だけ自己生成Hostを削除する。不明時は削除しない。
   * @boundary Signal通知は試験用合成であり、Windows OS Signal搬送の証明ではない。Provider要求0。
   */
  test(`Workbench CLI ${mode}設定は正常Hostで接続し合成Signalで終了する`, async () => {
    const testRoot = path.join(repositoryRoot, ".crdd", "tests");
    await mkdir(testRoot, { recursive: true });
    const fixture = await mkdtemp(path.join(testRoot, "workbench-entry-live-"));
    assert.equal(path.dirname(fixture), testRoot);
    let child: ReturnType<typeof spawn> | undefined;
    let termination: ReturnType<typeof observeEntryExit> | undefined;
    let listeningUrl: string | undefined;
    let tls: Awaited<ReturnType<typeof createEntryTlsProxy>> | undefined;
    let settled = false;
    try {
      const startup = path.join(fixture, "startup");
      await mkdir(startup);
      assert.equal(
        spawnSync("git", ["init", "--quiet", startup], { windowsHide: true })
          .status,
        0,
      );
      const asset = path.join(startup, "04_UI", "assets", "brand");
      await mkdir(asset, { recursive: true });
      await copyFile(
        path.join(
          repositoryRoot,
          "04_UI",
          "assets",
          "brand",
          "crdd-brand-icon-512x512.jpg",
        ),
        path.join(asset, "crdd-brand-icon-512x512.jpg"),
      );
      const port = await availableEntryPort();
      if (mode === "tls") tls = await createEntryTlsProxy(port);
      const publicOrigin =
        mode === "public" ? "https://workbench.example" : tls?.origin;
      if (publicOrigin) {
        const config = path.join(startup, ".crdd", "config");
        await mkdir(config, { recursive: true });
        await writeFile(
          path.join(config, "workbench-server.json"),
          JSON.stringify({ publicOrigin }),
        );
      }
      const requestHeaders: Record<string, string> =
        mode === "public"
          ? {
              host: "workbench.example",
              "x-forwarded-proto": "https",
              "x-forwarded-host": "workbench.example",
            }
          : {};
      const host = path.join(fixture, "host");
      const environment = {
        ...process.env,
        CROS_TRUST_DOMAIN_ID: "workbench-entry-live",
        LOCALAPPDATA: host,
        HOME: host,
        XDG_STATE_HOME: host,
        XDG_CONFIG_HOME: host,
        XDG_RUNTIME_DIR: host,
      };
      const input = resolveHostRootInput(environment);
      assert.ok(input);
      const prepared = prepareHostInitializationRoot(input);
      assert.equal(prepared.status, "ready");
      if (prepared.status !== "ready")
        throw new Error("test_host_preparation_failed");
      const material = createCredentialMaterial();
      const userId = "00000000-0000-4000-8000-000000000003";
      const attemptId = "00000000-0000-4000-8000-000000000002";
      const state = path.join(prepared.root.root, "access-management.json");
      const bytes = JSON.stringify({
        contract: "crdd-access-management/state",
        schemaRevision: 2,
        revision: 1,
        operationId: "00000000-0000-4000-8000-000000000001",
        users: [{ userId, username: "自己生成管理者", role: "administrator" }],
        roleContentAccess: [
          { role: "developer", workspaceIds: ["development"] },
          { role: "manager", workspaceIds: ["development", "management"] },
          { role: "administrator", workspaceIds: [] },
        ],
        credentials: [
          {
            credentialId: material.credentialId,
            userId,
            tokenVersion: 1,
            tokenSalt: material.tokenSalt,
            tokenVerifier: material.tokenVerifier,
            revoked: false,
            operationId: attemptId,
            presentation: "confirmed",
          },
        ],
        registeredRepositories: [],
        exposure: [],
        unresolvedKeyExchanges: [],
        initialization: {
          stage: "completed",
          attemptId,
          initialUserId: userId,
          initialCredentialId: material.credentialId,
          confirmationCredentialId: material.credentialId,
          connection: "confirmed",
        },
      });
      await writeFile(state, bytes);
      assert.equal(
        readHostInitializationState(prepared.root).status,
        "existing",
      );
      assert.equal(createHostAiProfileCatalogStore(input).status, "ready");
      const driver =
        "const {pathToFileURL}=require('node:url');process.once('message',()=>{process.emit('SIGTERM');process.disconnect();});void import(pathToFileURL(process.argv[1]).href);";
      child = spawn(
        process.execPath,
        ["--eval", driver, entry, "--cros", "--port", String(port)],
        {
          cwd: startup,
          env: environment,
          windowsHide: true,
          shell: false,
          stdio: ["ignore", "pipe", "pipe", "ipc"],
        },
      );
      termination = observeEntryExit(child);
      let output = "";
      let diagnostic = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        diagnostic += chunk.toString();
      });
      const announced = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => finish(new Error("entry_start_observation_timeout")),
          15000,
        );
        /**
         * 起動URLを有限の標準出力から取得する。
         * @responsibility 固定案内全体と容量上限を照合する。
         * @trace ERB-ST-022
         * @precondition 所有Childの起動案内待機中。
         * @stimulus stdoutのBuffer受信。
         * @observation 案内URLまたは容量超過。
         * @oracle 未到達を起動成功にしない。
         * @cleanup finishへ待機終了を委譲する。
         * @boundary 所有CLIの起動出力。
         */
        const data = (chunk: Buffer) => {
          output += chunk.toString();
          if (output.length > 65536)
            return finish(new Error("entry_output_limit"));
          const match = /^CROS Workbench: (https?:\/\/[^\s]+)\r?\n$/u.exec(
            output,
          );
          if (match?.[1]) finish(null, match[1]);
        };
        /**
         * Child errorを固定起動失敗にする。
         * @responsibility 生例外を公開せず待機を閉じる。
         * @trace ERB-ST-022
         * @precondition 起動案内待機中。
         * @stimulus Process error通知。
         * @observation Promise拒否。
         * @oracle errorをListener成立にしない。
         * @cleanup finishが自身の購読を除去する。
         * @boundary 所有Processの起動失敗。
         */
        const error = () => finish(new Error("entry_process_failed"));
        /**
         * 起動前終了を構成拒否または終了失敗へ分類する。
         * @responsibility 固定診断から非秘密の理由だけを返す。
         * @trace ERB-ST-022
         * @precondition 起動案内が未確定である。
         * @stimulus Child exit通知。
         * @observation 固定失敗または閉じた理由コード。
         * @oracle exitから受付成功を推定しない。
         * @cleanup finishが自身の購読を解除する。
         * @boundary 所有CLIの終了と非秘密診断。
         */
        const earlyExit = () =>
          finish(
            new Error(
              diagnostic.includes("単体へ切り替えず停止しました")
                ? `entry_configuration_rejected:${/理由: ([a-z_]+)/u.exec(diagnostic)?.[1] ?? "unclassified"}`
                : "entry_exited_before_start",
            ),
          );
        /**
         * 起動観測の待機資源を解放して結果を返す。
         * @responsibility timerと自分のListenerだけを除去する。
         * @trace ERB-ST-022
         * @precondition 所有Childの起動待機を構成済み。
         * @stimulus 正規案内到達または固定失敗。
         * @observation URL解決またはPromise拒否。
         * @oracle 観測終了をChild終了の証明にしない。
         * @cleanup timer、stdout data、error、exit購読を除去する。
         * @boundary 起動観測だけ。Child回収は外側で確認する。
         */
        const finish = (failure: Error | null, value?: string) => {
          clearTimeout(timer);
          child?.stdout?.off("data", data);
          child?.off("error", error);
          child?.off("exit", earlyExit);
          if (failure) reject(failure);
          else resolve(value as string);
        };
        child?.stdout?.on("data", data);
        child?.once("error", error);
        child?.once("exit", earlyExit);
      });
      const internalUrl = `http://127.0.0.1:${port}`;
      const url = tls?.origin ?? internalUrl;
      assert.equal(announced, publicOrigin ?? internalUrl);
      listeningUrl = internalUrl;
      const response = await requestEntry(`${url}/api/workbench-view`, {
        ca: tls?.ca,
        headers: requestHeaders,
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, 200);
      const model = await response.json();
      assert.equal(model.view, "access");
      assert.equal(model.authenticated, false);
      assert.equal(model.portfolio, null);
      assert.equal("project" in model, false);
      if (tls) {
        await assert.rejects(
          requestEntry(`${url}/api/workbench-view`, {
            ca: Buffer.alloc(0),
            signal: AbortSignal.timeout(5000),
          }),
          (error) =>
            [
              "DEPTH_ZERO_SELF_SIGNED_CERT",
              "SELF_SIGNED_CERT_IN_CHAIN",
            ].includes((error as NodeJS.ErrnoException).code ?? ""),
        );
        const overwritten = await requestEntry(`${url}/api/workbench-view`, {
          ca: tls.ca,
          headers: {
            "x-forwarded-proto": "http",
            "x-forwarded-host": "foreign.invalid",
            forwarded: "proto=http;host=foreign.invalid",
          },
          signal: AbortSignal.timeout(5000),
        });
        assert.equal(overwritten.status, 200);
        assert.equal((await overwritten.json()).authenticated, false);
      }
      const selected = await requestEntry(
        `${url}/api/workbench-view?repositoryId=repository.unavailable`,
        {
          ca: tls?.ca,
          headers: requestHeaders,
          signal: AbortSignal.timeout(5000),
        },
      );
      assert.equal(selected.status, 403);
      assert.equal(
        await selected.text(),
        "local_repository_access_unavailable\n",
      );
      const connected = await requestEntry(`${url}/local-connection/action`, {
        ca: tls?.ca,
        method: "POST",
        headers: {
          ...requestHeaders,
          origin: publicOrigin ?? url,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          actionToken: model.actionToken,
          operation: "connect",
          token: material.token,
        }),
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(connected.status, 200);
      assert.deepEqual(await connected.json(), { status: "completed" });
      const headers = {
        ...requestHeaders,
        authorization: `Bearer ${material.token}`,
      };
      const authenticated = await requestEntry(`${url}/api/workbench-view`, {
        ca: tls?.ca,
        headers,
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(authenticated.status, 200);
      const text = await authenticated.text();
      for (const hidden of [
        material.token,
        material.tokenSalt,
        material.tokenVerifier,
        fixture,
        repositoryRoot,
      ])
        assert.equal(text.includes(hidden), false);
      const authorizedModel = JSON.parse(text);
      assert.equal(authorizedModel.view, "access");
      assert.equal(authorizedModel.authenticated, true);
      assert.deepEqual(authorizedModel.portfolio.projects, []);
      const management = await requestEntry(
        `${url}/api/access-management?view=current`,
        { ca: tls?.ca, headers, signal: AbortSignal.timeout(5000) },
      );
      assert.equal(management.status, 200);
      assert.equal((await management.json()).status, "completed");
      const profiles = await requestEntry(`${url}/api/ai-profiles`, {
        ca: tls?.ca,
        headers,
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(profiles.status, 200);
      assert.equal((await profiles.json()).revision, 0);
      const unrelated = await requestEntry(`${url}/api/workbench-view`, {
        ca: tls?.ca,
        headers: requestHeaders,
        signal: AbortSignal.timeout(5000),
      });
      const unrelatedModel = await unrelated.json();
      assert.equal(unrelatedModel.authenticated, false);
      assert.equal(unrelatedModel.portfolio, null);
      assert.equal(await readFile(state, "utf8"), bytes);
      child.send("synthetic_sigterm");
      const result = await waitEntryExit(termination);
      assert.equal(result.kind, "exit");
      settled = true;
      assert.deepEqual(result, { kind: "exit", status: 0, signal: null });
      assert.equal(diagnostic, "");
      await assert.rejects(
        fetch(`${internalUrl}/api/workbench-view`, {
          signal: AbortSignal.timeout(2000),
        }),
      );
    } finally {
      try {
        if (
          child &&
          !settled &&
          child.exitCode === null &&
          child.signalCode === null
        ) {
          child.kill();
          assert.ok(termination);
          const terminal = await waitEntryExit(termination);
          settled = terminal.kind === "exit" || terminal.processNotCreated;
          assert.equal(settled, true, "entry_cleanup_not_confirmed");
        }
      } finally {
        if (tls) await tls.close();
      }
      if (
        !child ||
        settled ||
        child.exitCode !== null ||
        child.signalCode !== null
      ) {
        if (listeningUrl)
          await assert.rejects(
            fetch(`${listeningUrl}/api/workbench-view`, {
              signal: AbortSignal.timeout(2000),
            }),
          );
        await rm(fixture, { recursive: true, force: true });
        assert.equal(
          (await readdir(testRoot)).includes(path.basename(fixture)),
          false,
        );
      }
    }
  });
}

/**
 * CROS明示時の不足Host構成が単体modeへ切り替わらないことを確認する。
 * @responsibility Host設定の有無から利用modeを推測・補完しない。
 * @trace ERB-ST-022
 * @precondition Trust Domain環境を空にし、実Host設定へ到達させない。
 * @stimulus --cros --port 0を実CLIへ渡す。
 * @observation Exit2、固定診断、Listenerの起動通知なし。
 * @oracle 単体Repositoryの内容を返すServerを暗黙起動しない。
 * @cleanup Processの同期終了を確認する。Host Rootは作成しない。
 * @boundary Host Root不存在／破損と正常構成は別Caseで検証する。
 */
test("Workbench CLIはCROS環境不足を単体fallbackせず拒否する", () => {
  const result = runRejectedEntry(["--cros", "--port", "0"]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /単体へ切り替えず停止しました/u);
});

/**
 * 自己生成Hostの不存在・未初期化・破損を実CLIで拒否する。
 * @responsibility 正常Repositoryがあっても共有構成の失敗を単体起動へ変換しない。
 * @trace ERB-ST-022
 * @precondition 検証済みRepository内の専用試験Directoryだけを使用する。
 * @stimulus 固定用途Resolverへ自己生成Host環境を渡し、三つの不成立状態を起動する。
 * @observation 各Processの正常終了、Exit2、公開診断、Host内容の不変。
 * @oracle 初期化・状態修復・Listener起動通知・単体fallbackは発生しない。
 * @cleanup 同期Child終了後に自己生成Directory全体を削除し、不存在を確認する。
 * @boundary 実Hostや資格を使用せず、正常ListenerとSignal終了の証明にはしない。
 */
test("Workbench CLIは不存在・未初期化・破損Hostを変更せず停止する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-entry-"));
  assert.equal(path.dirname(fixture), testRoot);
  try {
    const host = path.join(fixture, "host");
    const environment = {
      ...process.env,
      CROS_TRUST_DOMAIN_ID: "workbench-entry-fixture",
      LOCALAPPDATA: host,
      HOME: host,
      XDG_STATE_HOME: host,
      XDG_CONFIG_HOME: host,
      XDG_RUNTIME_DIR: host,
    };
    const input = resolveHostRootInput(environment);
    assert.ok(input, "test_platform_requires_host_root_input");
    const absent = runRejectedEntry(["--cros", "--port", "0"], environment);
    assert.equal(absent.status, 2);
    assert.equal(absent.stdout, "");
    assert.match(absent.stderr, /単体へ切り替えず停止しました/u);
    assert.deepEqual(await readdir(fixture), []);

    const prepared = prepareHostInitializationRoot(input);
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready")
      throw new Error("test_host_preparation_failed");
    const fresh = runRejectedEntry(["--cros", "--port", "0"], environment);
    assert.equal(fresh.status, 2);
    assert.equal(fresh.stdout, "");
    assert.match(fresh.stderr, /単体へ切り替えず停止しました/u);
    assert.deepEqual(await readdir(prepared.root.root), []);

    const state = path.join(prepared.root.root, "access-management.json");
    const invalid = '{"contract":"invalid-fixture"}\n';
    await writeFile(state, invalid, "utf8");
    const corrupt = runRejectedEntry(["--cros", "--port", "0"], environment);
    assert.equal(corrupt.status, 2);
    assert.equal(corrupt.stdout, "");
    assert.match(corrupt.stderr, /単体へ切り替えず停止しました/u);
    assert.equal(await readFile(state, "utf8"), invalid);
    assert.deepEqual(await readdir(prepared.root.root), [
      "access-management.json",
    ]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
    assert.equal(
      (await readdir(testRoot)).includes(path.basename(fixture)),
      false,
    );
  }
});
