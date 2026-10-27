/**
 * mcp:system:stdioの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:system:stdioが所有する検証責務を実行する。
 * @trace EST-ST-012
 * @level ST
 * @scope mcp、project、runtime、stdio
 * @boundary EST-ST-012=System/E2E: MCP stdio入口→Application→応答stream
 */
import assert from "node:assert/strict";
import { withCallerPlan } from "../../../domain-model/tests/fixtures/execution-plan.ts";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runMcpCoordinatorStdio } from "../../src/index.ts";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

/**
 * 公式Clientが公開stdio入口で一覧とToolを往復できることを確認する。
 * @responsibility SDKの規格選択・metadata・結果搬送を公開Processで照合する。
 * @trace EST-ST-012
 * @precondition ローカルRepositoryと固定SDK版のみを利用する。
 * @stimulus modern規格を固定して接続し、Project一覧Toolを呼ぶ。
 * @observation discover、SDK Server識別名、一覧、実行結果とClient closeを確認する。
 * @oracle Server識別名はcrdd-mcp、Project Toolが存在し、結果を一回取得できる。
 * @cleanup Client closeで自己生成子Processとstdioを回収する。
 * @boundary 公式SDK Client→配布Launcher→stdio→専門Owner。
 */
test("公式SDK Clientは公開stdioのdiscover・一覧・実行を利用できる", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const client = new Client(
    { name: "crdd-synthetic-test", version: "1" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, "template/tools/crdd-mcp-server.ts"), "--stdio"],
    cwd: root,
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, "crdd-mcp");
    const listing = await client.listTools();
    assert.ok(listing.tools.some((tool) => tool.name === "crdd.list_projects"));
    const result = await client.callTool({
      name: "crdd.list_projects",
      arguments: {},
    });
    assert.notEqual(result.isError, true);
    assert.ok(result.structuredContent);
  } finally {
    await client.close();
  }
});

/**
 * outputのTest準備責務を実行する。
 *
 * @responsibility outputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus outputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
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
 * stdio process transports one bounded MCP request and closes on parent EOFを検証する。
 *
 * @responsibility stdio process transports one bounded MCP request and closes on parent EOFの合否判定を所有する。
 * @trace EST-ST-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus stdio process transports one bounded MCP request and closes on parent EOFの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("stdio process transports one bounded MCP request and closes on parent EOF", async () => {
  const sink = output();
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const result = await runMcpCoordinatorStdio(
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "principal-a",
      }),
      runObjective: async () => assert.fail("objective not expected"),
      submitDecision: async () => assert.fail("decision not expected"),
      getProjectState: async () => assert.fail("state query not expected"),
    },
    Readable.from([`${JSON.stringify(request)}\n`]),
    sink.stream,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "mcp_stdio_closed");
  const response = JSON.parse(sink.read());
  assert.equal(response.id, 1);
  assert.equal(response.result.resultType, "complete");
});

/**
 * 通常配布LauncherにWorkspace二Toolが実接続されていることを確認する。
 * @responsibility Adapter単独試験を公開入口完成と誤認しない。
 * @trace EST-ST-012
 * @precondition 現在Repository内の通常tools入口。
 * @stimulus tools/listを実子Processへ一回配送する。
 * @observation 閉SchemaとTool名、正常Process終了。
 * @oracle Root・callback・参照解放申告を公開Schemaに持たない。
 * @cleanup stdin EOFと同期子Process終了。生成物なし。
 * @boundary 通常stdio配布入口。Provider起動なし。
 */
test("通常MCP LauncherはWorkspaceの読取りと明示操作を公開する", () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
  );
  const request = {
    jsonrpc: "2.0",
    id: "workspace-tools",
    method: "tools/list",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const result = spawnSync(process.execPath, [entry, "--stdio"], {
    cwd: path.dirname(entry),
    input: `${JSON.stringify(request)}\n`,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  const tools = response.result.tools as {
    name: string;
    inputSchema: unknown;
  }[];
  for (const name of ["crdd.get_workspace", "crdd.manage_workspace"]) {
    const tool = tools.find((tool) => tool.name === name);
    assert.ok(tool);
    assert.doesNotMatch(
      JSON.stringify(tool.inputSchema),
      /ownerRoot|authorize|referencesReleased/u,
    );
  }
});

/**
 * stdio process rejects trailing and oversized frames without semantic effectsを検証する。
 *
 * @responsibility stdio process rejects trailing and oversized frames without semantic effectsの合否判定を所有する。
 * @trace EST-ST-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus stdio process rejects trailing and oversized frames without semantic effectsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("stdio process rejects trailing and oversized frames without semantic effects", async () => {
  let effects = 0;
  const dependencies = {
    authenticateClient: () => ({
      status: "verified",
      principalId: "principal-a",
    }),
    runObjective: async () => {
      effects += 1;
    },
    submitDecision: async () => {
      effects += 1;
    },
    getProjectState: async () => {
      effects += 1;
    },
  };
  const trailing = await runMcpCoordinatorStdio(
    dependencies,
    Readable.from(["{}"]),
    output().stream,
  );
  const oversized = await runMcpCoordinatorStdio(
    dependencies,
    Readable.from(["x".repeat(128 * 1024 + 1)]),
    output().stream,
  );
  assert.equal(trailing.status, "blocked");
  assert.equal(oversized.status, "blocked");
  assert.equal(trailing.reason, "mcp_stdio_failed");
  assert.equal(oversized.reason, "mcp_stdio_failed");
  assert.equal(effects, 0);
});

/**
 * template toolsの公開入口はbounded MCP stdio processを提供するを検証する。
 *
 * @responsibility template toolsの公開入口はbounded MCP stdio processを提供するの合否判定を所有する。
 * @trace EST-ST-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus template toolsの公開入口はbounded MCP stdio processを提供するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("template toolsの公開入口はbounded MCP stdio processを提供する", () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
  );
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: "discover-1",
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  });
  const result = spawnSync(process.execPath, [entry, "--stdio"], {
    cwd: path.dirname(entry),
    input: `${request}\n`,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.id, "discover-1");
  assert.equal(response.result.resultType, "complete");
});

/**
 * 配布MCP入口が現在RepositoryのProject Contextを五場面で返すことを検証する。
 *
 * @responsibility Repository単体利用でCredentialなしのProject Context取得を検証する。
 * @trace EST-ST-012
 * @precondition Repository Rootに現行PROJECT_CONTEXT.mdが存在する。
 * @stimulus crdd-mcp --stdioへcrdd.get_project_contextを送る。
 * @observation structuredContent内のProject、Sourceおよび五場面を取得する。
 * @oracle qual-lab.crddの五場面が固定順で返り、Runtime状態DTOへ変換されない。
 * @cleanup 子Processはstdin EOF後に終了し、一時資源を残さない。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("template toolsの公開入口はRepository Project Contextを取得する", async () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
  );
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: "project-context-1",
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: "crdd.get_project_context",
      arguments: { projectId: "qual-lab.crdd" },
    },
  });
  const child = spawn(process.execPath, [entry, "--stdio"], {
    cwd: path.dirname(entry),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const response = await new Promise<{
    result: {
      structuredContent: {
        project: {
          projectId: string;
          sources: readonly {
            context: { scenes: readonly { key: string }[] };
          }[];
        };
      };
    };
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("project_context_mcp_response_timeout"));
    }, 10_000);
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      const newline = stdout.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(stdout.slice(0, newline)));
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stdin.write(`${request}\n`);
  });
  child.stdin.end();
  const status = await new Promise<number | null>((resolve) =>
    child.once("close", resolve),
  );
  assert.equal(status, 0, stderr);
  const project = response.result.structuredContent.project;
  assert.equal(project.projectId, "qual-lab.crdd");
  const source = project.sources[0];
  assert.ok(source);
  assert.deepEqual(
    source.context.scenes.map((scene: Readonly<{ key: string }>) => scene.key),
    ["current", "risk", "decision", "reason", "next"],
  );
  assert.equal(
    Object.hasOwn(response.result.structuredContent, "requestId"),
    false,
  );
});

/**
 * MCP公開Launcherは未知の起動形式を意味処理前に拒否するを検証する。
 *
 * @responsibility MCP公開Launcherは未知の起動形式を意味処理前に拒否するの合否判定を所有する。
 * @trace EST-ST-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus MCP公開Launcherは未知の起動形式を意味処理前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("MCP公開Launcherは未知の起動形式を意味処理前に拒否する", () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
  );
  const result = spawnSync(process.execPath, [entry, "--unknown"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  assert.equal(result.status, 64);
  assert.equal(result.stderr.includes("使い方"), true);
  assert.equal(result.stdout, "");
});

/**
 * parent EOF aborts and joins an active semantic request before stdio closesを検証する。
 *
 * @responsibility parent EOF aborts and joins an active semantic request before stdio closesの合否判定を所有する。
 * @trace EST-ST-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus parent EOF aborts and joins an active semantic request before stdio closesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("parent EOF aborts and joins an active semantic request before stdio closes", async () => {
  const input = new PassThrough();
  const sink = output();
  let isCancellationObserved = false;
  const running = runMcpCoordinatorStdio(
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "principal-a",
      }),
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          /**
           * cancelのTest準備責務を実行する。
           *
           * @responsibility cancelがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
           * @trace EST-ST-012
           * @precondition 呼出し元Test Caseが必要な入力を渡す。
           * @stimulus cancelを呼び出す。
           * @observation 返却値、生成fixtureまたは観測値を取得する。
           * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
           * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
           * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
           */
          const cancel = () => {
            isCancellationObserved = true;
            resolve({
              contract: "crdd-coordinator/orchestrator-objective-intake/v2",
              status: "cancelled",
              reason: "orchestrator_parent_lost",
              requestId: "request-parent-loss",
              projectId: "project-a",
              milestoneId: "milestone-a",
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
      submitDecision: async () => assert.fail("decision not expected"),
      getProjectState: async () => assert.fail("state query not expected"),
    },
    input,
    sink.stream,
  );
  const objectiveRequest = {
    jsonrpc: "2.0",
    id: "objective-parent-loss",
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: "crdd.run_objective",
      arguments: withCallerPlan({
        requestId: "request-parent-loss",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: "a".repeat(40),
        objective: "Run until the parent disconnects.",
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
  };
  input.end(`${JSON.stringify(objectiveRequest)}\n`);
  const result = await running;
  assert.equal(result.status, "completed");
  assert.equal(isCancellationObserved, true);
  assert.equal(
    JSON.parse(sink.read()).result.structuredContent.status,
    "cancelled",
  );
});

/**
 * stdio preserves semantic cleanup uncertainty after transport cleanupを検証する。
 *
 * @responsibility stdio preserves semantic cleanup uncertainty after transport cleanupの合否判定を所有する。
 * @trace EST-ST-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus stdio preserves semantic cleanup uncertainty after transport cleanupの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-012=Direct Boundary: mcp Test Source→対象契約
 */
test("stdio preserves semantic cleanup uncertainty after transport cleanup", async () => {
  const sink = output();
  const objectiveRequest = {
    jsonrpc: "2.0",
    id: "objective-recovery",
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: "crdd.run_objective",
      arguments: withCallerPlan({
        requestId: "request-recovery",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: "a".repeat(40),
        objective: "Observe cleanup uncertainty.",
        acceptanceCriteria: ["Recovery remains visible."],
        allowedPaths: ["result.txt"],
        readPaths: ["README.md"],
        maximumConcurrency: 1,
        maximumReplans: 0,
        originLane: "interactive",
        adoptResult: false,
        intakeEpoch: "fixture-epoch",
      }),
    },
  };
  const result = await runMcpCoordinatorStdio(
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "principal-a",
      }),
      runObjective: async () => ({
        contract: "crdd-coordinator/public-runtime/v2",
        status: "blocked",
        reason: "orchestrator_task_recovery_required",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      }),
      submitDecision: async () => assert.fail("decision not expected"),
      getProjectState: async () => assert.fail("state query not expected"),
    },
    Readable.from([`${JSON.stringify(objectiveRequest)}\n`]),
    sink.stream,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.transportCleanupConfirmed, true);
  assert.equal(result.semanticResultObserved, true);
  assert.equal(result.semanticCleanupConfirmed, false);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
});
