/**
 * mcp:integration:transport-lifecycleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:integration:transport-lifecycleが所有する検証責務を実行する。
 * @trace EST-IT-001
 * @trace EST-IT-002
 * @level IT
 * @scope mcp、transport、lifecycle、cancellation、cleanup
 * @boundary EST-IT-001=Direct Boundary: CLI／MCP Adapter→Application Contract / EST-IT-002=Adjacent 1 Block: Transport stream→Adapter→Application入口
 */
import assert from "node:assert/strict";
import { withCallerPlan } from "../../../domain-model/tests/fixtures/execution-plan.ts";
import { request as httpRequest } from "node:http";
import { createConnection } from "node:net";
import { PassThrough, Readable, Writable } from "node:stream";
import test from "node:test";

import {
  runMcpCoordinatorStdio,
  runMcpStdio,
  createMcpServerFactory,
  startMcpCoordinatorStreamableHttp,
  startMcpStreamableHttp,
  type McpCoordinatorDependencies,
} from "../../src/index.ts";
import {
  protocolComplete,
  protocolError,
} from "../../src/request/validation.ts";
import { createMcpRequestServer } from "../../src/request/server.ts";

const SDK_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

/**
 * Factory拒否でも後続frameを壊さずJSON-lines応答を完了する。
 * @responsibility 入力拒否・初回保存失敗の改行と次要求を確認する。
 * @trace EST-IT-002
 * @precondition 不正cursorと正常一覧、初回保存失敗の合成Source。
 * @stimulus 拒否と正常を連続送信し、初回拒否も別に送る。
 * @observation 改行終端、個別JSON解析、codeとOwner呼出し数を確認する。
 * @oracle frameは結合せず、拒否でOwner非実行、後続は通常成功する。
 * @cleanup stdinと実行Promiseを収束させる。
 * @boundary Factory拒否→外部stdio framing。
 */
test("SDK stdioはFactory拒否と初回失敗を改行終端し次要求を維持する", async () => {
  const input = new PassThrough();
  const frames: string[] = [];
  let finish: () => void = () => {};
  const both = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      frames.push(String(chunk));
      callback();
      if (frames.length === 2) finish();
    },
  });
  let reads = 0;
  const factory = createMcpServerFactory({
    projectContext: {
      readPortfolio: async () => {
        reads += 1;
        return { projects: [], retainedAsSourceOfTruth: false };
      },
    },
  });
  const running = runMcpStdio(factory, input, sink);
  try {
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: SDK_META, cursor: "invalid" } })}\n${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: SDK_META } })}\n`,
    );
    await both;
    input.end();
    assert.equal((await running).status, "completed");
    assert.ok(frames.every((frame) => frame.endsWith("\n")));
    assert.equal(JSON.parse(frames[0] ?? "").error.code, -32602);
    assert.equal(JSON.parse(frames[1] ?? "").result.tools.length, 2);
    assert.equal(reads, 0);
  } finally {
    input.end();
    await running;
  }
  const failed = output();
  await runMcpStdio(
    createMcpServerFactory({
      initialConnection: async () =>
        protocolError(3, -32603, "Initial connection unavailable"),
    }),
    Readable.from([
      `${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "server/discover", params: { _meta: SDK_META } })}\n`,
    ]),
    failed.stream,
  );
  assert.ok(failed.read().endsWith("\n"));
  assert.equal(JSON.parse(failed.read()).error.code, -32603);
});

/**
 * Factory生成中の取消を要求の後へ配送し、次IDへ流用しない。
 * @responsibility SDK要求登録前の通知喪失と別要求への取消混入を防ぐ。
 * @trace EST-IT-002
 * @precondition Factoryと取消後Ownerを別gateで保留する。
 * @stimulus Factory中に取消し、生成・Ownerを順に解放して次IDを送る。
 * @observation 同じOwnerの取消、join保留、次IDのSignalと応答を確認する。
 * @oracle 要求1は取消されjoinされる。要求2は未取消で一回成功する。
 * @cleanup 両gate・stdinを解放し、実行Promiseをjoinする。
 * @boundary 外部取消→Factory→要求別SDK→Owner。
 */
test("SDK stdioはFactory生成中の取消を保持し次IDへ流用しない", async () => {
  const input = new PassThrough();
  let entered: () => void = () => {};
  const entering = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let releaseFactory: () => void = () => {};
  const factoryGate = new Promise<void>((resolve) => {
    releaseFactory = resolve;
  });
  let cancelled: () => void = () => {};
  const cancellation = new Promise<void>((resolve) => {
    cancelled = resolve;
  });
  let releaseOwner: () => void = () => {};
  const ownerGate = new Promise<void>((resolve) => {
    releaseOwner = resolve;
  });
  let next: () => void = () => {};
  const nextResponse = new Promise<void>((resolve) => {
    next = resolve;
  });
  const frames: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      frames.push(String(chunk));
      callback();
      next();
    },
  });
  let settled = false;
  let nextAborted: boolean | null = null;
  const running = runMcpStdio(
    {
      async createServer(raw, signal, observe) {
        if ((raw as { id: number }).id === 1) {
          entered();
          await factoryGate;
        }
        return createMcpRequestServer(
          async (request, current) => {
            const id = (request as { id: number }).id;
            if (id === 1) {
              if (!current.aborted)
                await new Promise<void>((resolve) =>
                  current.addEventListener("abort", () => resolve(), {
                    once: true,
                  }),
                );
              cancelled();
              await ownerGate;
            } else {
              nextAborted = current.aborted;
            }
            return protocolComplete(id, { content: [] });
          },
          raw,
          signal,
          observe ?? (() => {}),
        );
      },
    },
    input,
    sink,
  );
  void running.then(() => {
    settled = true;
  });
  try {
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { _meta: SDK_META, name: "fixture", arguments: {} } })}\n`,
    );
    await entering;
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1, _meta: SDK_META } })}\n`,
    );
    releaseFactory();
    await cancellation;
    assert.equal(settled, false);
    releaseOwner();
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { _meta: SDK_META, name: "fixture", arguments: {} } })}\n`,
    );
    await nextResponse;
    input.end();
    assert.equal((await running).status, "completed");
    assert.equal(nextAborted, false);
    assert.equal(frames.length, 1);
    assert.equal(JSON.parse(frames[0] ?? "").id, 2);
  } finally {
    releaseFactory();
    releaseOwner();
    input.end();
    await running;
  }
});

/**
 * 外部出力の故障を開始済みOwnerの取消・joinへ接続する。
 * @responsibility 出力errorから正常終了やListener残存を作らない。
 * @trace EST-IT-002
 * @precondition Signalまで待機するOwnerと自己生成Stream。
 * @stimulus Owner開始後に外部Writableのerrorを発火する。
 * @observation Owner取消、blocked結果、意味cleanupとListener解放を確認する。
 * @oracle Owner完了まで待ち、外部出力故障をcompletedへ変えない。
 * @cleanup stdinを閉じ実行Promiseをjoinする。
 * @boundary 外部Writable故障とSDK内の実行終了。
 */
test("SDK stdioは出力故障でもOwnerを取消してjoinする", async () => {
  const input = new PassThrough();
  const sink = output();
  let started: () => void = () => {};
  const start = new Promise<void>((resolve) => {
    started = resolve;
  });
  let joined = false;
  const running = runMcpStdio(
    async (_raw, signal) => {
      started();
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      joined = true;
      return protocolComplete(1, {
        content: [],
        structuredContent: {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
        },
      });
    },
    input,
    sink.stream,
  );
  try {
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { _meta: SDK_META, name: "fixture", arguments: {} } })}\n`,
    );
    await start;
    sink.stream.emit("error", new Error("synthetic output failure"));
    input.end();
    const result = await running;
    assert.equal(result.status, "blocked");
    assert.equal(joined, true);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(input.listenerCount("data"), 0);
    assert.equal(sink.stream.listenerCount("error"), 0);
  } finally {
    input.end();
    await running;
  }
});

/**
 * 同一IDの後続要求でもOwnerと外部出力完了を逐次化する。
 * @responsibility SDK内部完了と外部Writable callback完了を区別する。
 * @trace EST-IT-002
 * @precondition 二要求と一回目の出力を保留するWritable。
 * @stimulus 同じIDでA・Bを連続送信し、出力callbackを明示解放する。
 * @observation Owner順序、出力回数、入力Listenerを確認する。
 * @oracle 一回目の出力完了までBは開始せず、入力値を取り違えない。
 * @cleanup callbackと入力をfinallyで解放し、実行Promiseをjoinする。
 * @boundary 外部stdio→要求別SDK→Owner→外部Writable。
 */
test("SDK stdioは同一IDでも入力と出力callbackを逐次に保つ", async () => {
  const input = new PassThrough();
  const observed: string[] = [];
  let release: () => void = () => {};
  let ready: () => void = () => {};
  const firstWrite = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let completed: () => void = () => {};
  const both = new Promise<void>((resolve) => {
    completed = resolve;
  });
  let writes = 0;
  const sink = new Writable({
    write(_chunk, _encoding, callback) {
      writes += 1;
      if (writes === 1) {
        release = () => {
          release = () => {};
          callback();
        };
        ready();
      } else {
        callback();
        completed();
      }
    },
  });
  const running = runMcpStdio(
    async (raw) => {
      const request = raw as {
        id: number;
        params: { arguments: { text: string } };
      };
      observed.push(request.params.arguments.text);
      return protocolComplete(request.id, {
        content: [{ type: "text", text: request.params.arguments.text }],
      });
    },
    input,
    sink,
  );
  try {
    input.write(
      `${["A", "B"]
        .map((text) =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { _meta: SDK_META, name: "fixture", arguments: { text } },
          }),
        )
        .join("\n")}\n`,
    );
    await firstWrite;
    assert.deepEqual(observed, ["A"]);
    release();
    await both;
    input.end();
    assert.equal((await running).status, "completed");
    assert.deepEqual(observed, ["A", "B"]);
    assert.equal(input.listenerCount("data"), 0);
    assert.equal(sink.listenerCount("error"), 0);
  } finally {
    release();
    input.end();
    await running;
  }
});

/**
 * 実行中の取消通知とOwner完了を別々に観測する。
 * @responsibility 取消通知を通常Queueへ閉じ込めずcleanup未確認を保持する。
 * @trace EST-IT-002
 * @precondition 取消を受けた後も明示解放まで終了しないOwner。
 * @stimulus 現在IDの取消通知を送信し、Ownerを後から解放する。
 * @observation 取消受信、結果保留、意味cleanupとListener解放を確認する。
 * @oracle join前に終了せず、SDK取消の無応答とcleanup不明を混同しない。
 * @cleanup Owner gateとstdinを解放してjoinする。
 * @boundary MCP取消通知→SDK Signal→Owner→Transport終了。
 */
test("SDK stdioは実行中取消を伝播してOwner joinと意味結果を保持する", async () => {
  const input = new PassThrough();
  const sink = output();
  let started: () => void = () => {};
  const start = new Promise<void>((resolve) => {
    started = resolve;
  });
  let cancelled: () => void = () => {};
  const cancellation = new Promise<void>((resolve) => {
    cancelled = resolve;
  });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let settled = false;
  const running = runMcpStdio(
    async (_raw, signal) => {
      started();
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            cancelled();
            resolve();
          },
          { once: true },
        ),
      );
      await gate;
      return protocolComplete(1, {
        content: [],
        structuredContent: {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        },
      });
    },
    input,
    sink.stream,
  );
  void running.then(() => {
    settled = true;
  });
  try {
    input.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { _meta: SDK_META, name: "fixture", arguments: {} },
      })}\n`,
    );
    await start;
    input.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: { requestId: 1, _meta: SDK_META },
      })}\n`,
    );
    await cancellation;
    assert.equal(settled, false);
    release();
    input.end();
    const result = await running;
    assert.equal(result.semanticResultObserved, true);
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(sink.read(), "");
    assert.equal(input.listenerCount("data"), 0);
  } finally {
    release();
    input.end();
    await running;
  }
});

/**
 * 解析済み待機要求の総量超過を停止へ接続する。
 * @responsibility SDKの一frame上限だけへ入力制限を縮めない。
 * @trace EST-IT-002
 * @precondition 一要求をSignalまで保留するOwnerと多数の小frame。
 * @stimulus 実行中に128KiBを超える待機frameを投入する。
 * @observation 開始回数、取消、終了状態とListenerを確認する。
 * @oracle 後続Ownerは開始せずblocked、開始済みOwnerはjoinする。
 * @cleanup stdinを閉じ実行Promiseをjoinする。
 * @boundary 外部Queue総量とSDK一要求接続。
 */
test("SDK stdioは小frameの待機総量でも128KiBを強制する", async () => {
  const input = new PassThrough();
  const sink = output();
  let started: () => void = () => {};
  const start = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const running = runMcpStdio(
    async (_raw, signal) => {
      calls += 1;
      started();
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      return protocolComplete(1, { content: [] });
    },
    input,
    sink.stream,
  );
  const line = `${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { _meta: SDK_META, name: "fixture", arguments: {} },
  })}\n`;
  try {
    input.write(line);
    await start;
    input.write(line.repeat(1000));
    input.end();
    assert.equal((await running).status, "blocked");
    assert.equal(calls, 1);
    assert.equal(input.listenerCount("data"), 0);
  } finally {
    input.end();
    await running;
  }
});

const TOKEN = "integration-boundary-token-0123456789abcdef";

/**
 * dependenciesのTest準備責務を実行する。
 *
 * @responsibility dependenciesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus dependenciesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-001=Direct Boundary: mcp Test Source→対象契約
 */
function dependencies(
  overrides: Partial<McpCoordinatorDependencies> = {},
): McpCoordinatorDependencies {
  return {
    authenticateClient: () => ({
      status: "verified",
      principalId: "integration-principal",
    }),
    runObjective: async () => assert.fail("objective not expected"),
    submitDecision: async () => assert.fail("decision not expected"),
    getProjectState: async () => assert.fail("state query not expected"),
    ...overrides,
  };
}

/**
 * outputのTest準備責務を実行する。
 *
 * @responsibility outputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus outputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-001=Direct Boundary: mcp Test Source→対象契約
 */
function output() {
  let content = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      content += String(chunk);
      callback();
    },
  });
  return { stream, read: () => content };
}

/**
 * stdio blockはparent EOFで進行要求を取消してjoin後に終了するを検証する。
 *
 * @responsibility stdio blockはparent EOFで進行要求を取消してjoin後に終了するの合否判定を所有する。
 * @trace EST-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus stdio blockはparent EOFで進行要求を取消してjoin後に終了するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-001=Direct Boundary: mcp Test Source→対象契約
 */
test("stdio blockはparent EOFで進行要求を取消してjoin後に終了する", async () => {
  const input = new PassThrough();
  const sink = output();
  let wasCancelled = false;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const running = runMcpCoordinatorStdio(
    dependencies({
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          markStarted();
          /**
           * cancelのTest準備責務を実行する。
           *
           * @responsibility cancelがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
           * @trace EST-IT-001
           * @precondition 呼出し元Test Caseが必要な入力を渡す。
           * @stimulus cancelを呼び出す。
           * @observation 返却値、生成fixtureまたは観測値を取得する。
           * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
           * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
           * @boundary EST-IT-001=Direct Boundary: mcp Test Source→対象契約
           */
          const cancel = () => {
            wasCancelled = true;
            resolve({
              contract: "crdd-coordinator/orchestrator-objective-intake/v2",
              status: "cancelled",
              reason: "orchestrator_parent_lost",
              requestId: "integration-request",
              projectId: "integration-project",
              milestoneId: "integration-milestone",
              queueId: null,
              projection: null,
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              recoveryIds: [],
              recoveryObligations: [],
              effectState: "settled",
            });
          };
          if (signal.aborted) cancel();
          else signal.addEventListener("abort", cancel, { once: true });
        }),
    }),
    input,
    sink.stream,
  );
  input.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: "integration-objective",
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
        name: "crdd.run_objective",
        arguments: withCallerPlan({
          requestId: "integration-request",
          projectId: "integration-project",
          milestoneId: "integration-milestone",
          objective: "observe transport lifecycle",
          repositoryRevision: "a".repeat(40),
          acceptanceCriteria: ["Cancellation is observed."],
          allowedPaths: ["result.txt"],
          readPaths: ["README.md"],
          maximumConcurrency: 1,
          maximumReplans: 0,
          originLane: "interactive",
          adoptResult: false,
          intakeEpoch: "fixture-epoch",
        }),
      },
    })}\n`,
  );
  await started;
  input.end();
  const result = await running;
  assert.equal(wasCancelled, true);
  assert.equal(result.status, "completed");
  assert.match(sink.read(), /orchestrator_parent_lost/u);
});

/**
 * HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否するを検証する。
 *
 * @responsibility HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否するの合否判定を所有する。
 * @trace EST-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-002=Direct Boundary: mcp Test Source→対象契約
 */
test("HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否する", async () => {
  const server = await startMcpCoordinatorStreamableHttp(dependencies(), {
    port: 0,
    bearerToken: TOKEN,
  });
  const socket = createConnection({ host: server.host, port: server.port });
  const closed = new Promise<void>((resolve) => socket.once("close", resolve));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  assert.deepEqual(await server.close(), {
    status: "completed",
    cleanupConfirmed: true,
  });
  await closed;
  assert.deepEqual(await server.close(), {
    status: "completed",
    cleanupConfirmed: true,
  });
  await assert.rejects(
    new Promise<void>((resolve, reject) => {
      const request = httpRequest(
        {
          host: server.host,
          port: server.port,
          path: server.endpoint,
          method: "POST",
        },
        () => resolve(),
      );
      request.once("error", reject);
      request.end();
    }),
  );
});

/**
 * 公式SDKへの搬送でTool結果を二重包装せず、既存の入口拒否を保持する。
 * @responsibility SDK標準応答とCRDDの閉じた公開操作・JSON入力境界を実HTTPで照合する。
 * @trace EST-IT-002
 * @precondition 合成Handlerと動的localhost Portだけを使用する。
 * @stimulus 正常Tool、重複key、SDK組込みの未公開pingを送信する。
 * @observation Handler回数、HTTP status、JSON結果、cache-control。
 * @oracle 正常一回のTool結果だけを公開し、拒否要求の意味処理0。応答二重包装なし。
 * @cleanup 全経路でServer closeとListener回収を待つ。
 * @boundary 実localhost HTTP→公式SDK Node→合成意味Handler。
 */
test("SDK HTTPはTool結果と入口拒否を維持する", async (t) => {
  let calls = 0;
  const server = await startMcpStreamableHttp(
    async () => {
      calls++;
      return {
        jsonrpc: "2.0",
        id: 1,
        result: {
          resultType: "complete",
          content: [{ type: "text", text: "synthetic result" }],
          structuredContent: { observed: true },
          isError: false,
        },
      };
    },
    { port: 0, bearerToken: TOKEN },
  );
  t.after(async () => {
    await server.close();
  });
  const params = {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
    },
    name: "synthetic.tool",
    arguments: {},
  };
  const headers = {
    authorization: `Bearer ${TOKEN}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": "tools/call",
    "mcp-name": "synthetic.tool",
  };
  const response = await fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params,
      }),
    },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const output = (await response.json()) as { result: Record<string, unknown> };
  assert.deepEqual(output.result.structuredContent, { observed: true });
  assert.equal(Object.hasOwn(output.result, "jsonrpc"), false);
  assert.equal(Object.hasOwn(output.result, "result"), false);
  assert.equal(calls, 1);
  const duplicate = await fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers,
      body: `{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/call","params":${JSON.stringify(params)}}`,
    },
  );
  assert.equal(duplicate.status, 400);
  await duplicate.arrayBuffer();
  const { "mcp-name": _name, ...pingHeaders } = headers;
  const ping = await fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers: { ...pingHeaders, "mcp-method": "ping" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "ping",
        params: { _meta: params._meta },
      }),
    },
  );
  assert.equal(ping.status, 404);
  await ping.arrayBuffer();
  assert.equal(calls, 1);
});

/**
 * SDK callbackへ同期例外が届いても内部文言を公開しない。
 * @responsibility HandlerのthrowをSDK既定例外応答へ直接透過させない。
 * @trace EST-IT-002
 * @precondition 秘密を含まない合成の内部文言だけを使う。
 * @stimulus Tool HandlerがPromiseを返す前にthrowする。
 * @observation HTTP応答本文とServer終了結果。
 * @oracle 固定Internal errorだけを公開し内部文言なし。要求処理の再実行なし。
 * @cleanup Server closeとListener回収を待つ。
 * @boundary 実HTTP→SDK callback→同期throw。
 */
test("SDK HTTPは同期Handler例外を非開示にする", async (t) => {
  let calls = 0;
  const server = await startMcpStreamableHttp(
    () => {
      calls++;
      throw new Error("fixture-private-detail");
    },
    { port: 0, bearerToken: TOKEN },
  );
  t.after(async () => {
    await server.close();
  });
  const response = await fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": "synthetic.tool",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": {},
          },
          name: "synthetic.tool",
          arguments: {},
        },
      }),
    },
  );
  const content = await response.text();
  assert.doesNotMatch(content, /fixture-private-detail/u);
  assert.match(content, /Internal error/u);
  assert.equal(calls, 1);
});
