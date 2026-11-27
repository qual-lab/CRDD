/**
 * 実CLIのHTTP APIとMCP stdioで、同じ定義操作の外側時間を測る。
 * @responsibility 合成リポジトリ・計測・終了確認を所有する。製品の認可や保存を代替しない。
 * @trace ARCH-000012
 */
import childProcess, { execFileSync, fork } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import readline from "node:readline";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { getRepository } from "@qual-lab/crdd-version-control";
import { prepareRepositoryDataDirectory } from "../src/service/configuration.ts";
import { MCP_COORDINATOR_PROTOCOL_VERSION } from "../src/transport/mcp-protocol.ts";

const entry = fileURLToPath(import.meta.url);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const childMode = "--benchmark-child";
const timeoutMs = 30_000;
const repositoryId = "repository.benchmark";
const target = { projectId: "project.benchmark", milestoneId: "milestone" };

type Transport = "api" | "mcp";
type Sample = { elapsedMs: number; git: number; origin: number };
type Run = { startupMs: number; initialize: Sample; read: Sample };

class CleanupUnconfirmed extends Error {}

async function runCli() {
  if (!process.send) throw new Error("計測用の親プロセスが必要です");
  const original = childProcess.spawnSync;
  let git = 0;
  let origin = 0;
  childProcess.spawnSync = ((...args: Parameters<typeof original>) => {
    if (/^git(?:\.exe)?$/iu.test(path.basename(args[0]))) {
      git++;
      if (Array.isArray(args[1]) && args[1].includes("remote.origin.url"))
        origin++;
    }
    return original(...args);
  }) as typeof original;
  syncBuiltinESMExports();
  const respond = (message: unknown) => {
    if (message === "git-count") process.send?.({ git, origin });
  };
  process.on("message", respond);
  try {
    const bin = fileURLToPath(
      new URL("../bin/crdd-server.ts", import.meta.url),
    );
    process.argv.splice(1, Infinity, bin, "--port", "0", "--mcp-stdio");
    await import("../bin/crdd-server.ts");
  } finally {
    process.off("message", respond);
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
    if (process.connected) process.disconnect();
  }
}

function requireDirectory(directory: string) {
  if (
    !fs.lstatSync(directory).isDirectory() ||
    path.relative(directory, fs.realpathSync.native(directory)) !== ""
  )
    throw new Error("計測領域の実体を確認できません");
}

function fixtureRoot() {
  const owner = getRepository(repositoryRoot);
  if (owner.status !== "completed")
    throw new Error("CRDDのルートを確認できません");
  requireDirectory(repositoryRoot);
  const temporary = prepareRepositoryDataDirectory(owner.capability, "tmp");
  return fs.mkdtempSync(path.join(temporary, "server-benchmark-"));
}

function prepareFixture(directory: string) {
  fs.mkdirSync(directory);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !/^(?:CRDD_|GIT_|NODE_OPTIONS$|NODE_V8_COVERAGE$)/iu.test(name),
    ),
  );
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = path.join(directory, "unused-global-git-config");
  env.TEMP = directory;
  env.TMP = directory;
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: directory, env, windowsHide: true });
  git("init", "--quiet", "--template=", "--initial-branch=main");
  fs.mkdirSync(path.join(directory, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(directory, ".git", "info", "exclude"), "");
  git("config", "--local", "user.name", "CRDD Benchmark");
  git("config", "--local", "user.email", "benchmark@example.invalid");
  fs.writeFileSync(
    path.join(directory, "PROJECT_CONTEXT.md"),
    [
      `# Project Context\n\nProject ID: ${target.projectId}\nRepository ID: ${repositoryId}\nRepository Role: development\n`,
      ...[
        "今どうなっているか",
        "何が危ない、または止まっているか",
        "今、人間が決めることは何か",
        "なぜこの状態・判断になったか",
        "次に何をすべきか",
      ].map(
        (name, index) =>
          `## ${index + 1}. ${name}\n\n### 結論\n\n合成計測。\n\n| 項目 | 内容 |\n| --- | --- |\n| 計測 | 固定 |\n`,
      ),
    ].join("\n"),
  );
  git("add", "--", "PROJECT_CONTEXT.md");
  git("commit", "--quiet", "-m", "benchmark fixture");
  const fixture = getRepository(directory);
  if (fixture.status !== "completed")
    throw new Error("計測用Gitリポジトリを確認できません");
  const configuration = prepareRepositoryDataDirectory(
    fixture.capability,
    "config",
  );
  fs.writeFileSync(
    path.join(configuration, "repository-manifest.json"),
    JSON.stringify({
      schema: "crdd/repository-manifest/v2",
      repositoryId,
      projectId: target.projectId,
      displayName: "計測用",
      repositoryRole: "development",
      capabilities: ["domain-model", "mcp-server"],
      contextSurfaces: ["crdd-context"],
      externalSendPolicy: "config/external-send-policy.json",
    }),
  );
  return env;
}

function lines(stream: Readable) {
  return readline.createInterface({ input: stream, crlfDelay: Infinity });
}

async function matchingLine(
  reader: ReturnType<typeof lines>,
  select: (line: string) => string | undefined,
) {
  const stop = new AbortController();
  const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(timeoutMs)]);
  const closed = once(reader, "close", { signal }).then(() => {
    throw new Error("指定した応答の前に通信が閉じました");
  });
  // 未選択行と期限の後も、観測のリスナーを残さない。
  let listener: ((line: string) => void) | undefined;
  try {
    return await Promise.race([
      closed,
      new Promise<string>((resolve) => {
        listener = (line) => {
          const value = select(line);
          if (value !== undefined) resolve(value);
        };
        reader.on("line", listener);
      }),
    ]);
  } finally {
    stop.abort();
    if (listener) reader.off("line", listener);
  }
}

async function runSample(
  directory: string,
  transport: Transport,
): Promise<Run> {
  const env = prepareFixture(directory);
  const started = performance.now();
  const child = fork(entry, [childMode], {
    cwd: directory,
    env,
    execArgv: [],
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  const input = child.stdin;
  const output = child.stdout && lines(child.stdout);
  const diagnostics = child.stderr && lines(child.stderr);
  let childReason: string | undefined;
  diagnostics?.on("line", (line) => {
    childReason = /理由: ([a-z0-9_]+)/u.exec(line)?.[1] ?? childReason;
  });
  let channelFailure = false;
  const markChannelFailure = () => {
    channelFailure = true;
  };
  child.on("error", markChannelFailure);
  input?.on("error", markChannelFailure);
  const closed = new Promise<readonly [number | null, string | null]>(
    (resolve) => {
      child.once("close", (code, signal) => resolve([code, signal]));
    },
  );
  let result: Run | undefined;
  let sampleError: unknown;
  try {
    if (!input || !output || !diagnostics)
      throw new Error("計測の通信を開けません");
    const base = await matchingLine(
      diagnostics,
      (line) =>
        /^CRDD Server: (http:\/\/127\.0\.0\.1:\d+)\/?$/u.exec(line)?.[1],
    );
    const startupMs = performance.now() - started;
    let id = 0;
    const call = async (operation: "initialize" | "read") => {
      const write = operation === "initialize";
      if (transport === "api") {
        const route = `/api/repositories/${repositoryId}/projects/${target.projectId}/milestones/${target.milestoneId}/${write ? "definition" : "plan"}`;
        const response = await fetch(new URL(route, base), {
          ...((write && {
            method: "POST",
            headers: { origin: base, "content-type": "application/json" },
            body: JSON.stringify({ expectedAbsence: true }),
          }) ||
            {}),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const data = await response.json();
        if (response.status !== (write ? 201 : 200))
          throw new Error(`API ${operation}: HTTP ${response.status}`);
        return data;
      }
      const callId = ++id;
      const pending = matchingLine(output, (line) => line);
      input.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: {
            name: write
              ? "crdd.initialize_execution_definition"
              : "crdd.get_execution_plan",
            arguments: {
              repositoryId,
              ...target,
              ...(write && { expectedAbsence: true }),
            },
            _meta: {
              "io.modelcontextprotocol/protocolVersion":
                MCP_COORDINATOR_PROTOCOL_VERSION,
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        })}\n`,
      );
      const response = JSON.parse(await pending);
      if (response.id !== callId || response.error || response.result?.isError)
        throw new Error(`MCP ${operation}: Tool失敗または応答不一致`);
      return response.result?.structuredContent;
    };
    const readCounters = async () => {
      const pending = once(child, "message", {
        signal: AbortSignal.timeout(timeoutMs),
      });
      child.send("git-count");
      const [counters] = await pending;
      if (
        !Number.isSafeInteger(counters?.git) ||
        !Number.isSafeInteger(counters?.origin)
      )
        throw new Error("Git起動回数を確認できません");
      return counters as Pick<Sample, "git" | "origin">;
    };
    let savedVersion: { revision: number; payloadSha256: string } | undefined;
    const measure = async (
      operation: Parameters<typeof call>[0],
    ): Promise<Sample> => {
      const before = await readCounters();
      const start = performance.now();
      const response = await call(operation);
      const elapsedMs = performance.now() - start;
      const after = await readCounters();
      const expected = operation === "initialize" ? "saved" : "absent";
      if (response?.status !== expected)
        throw new Error(
          `${transport} ${operation}: 期待した定義結果を観測できません`,
        );
      const version = response.version;
      if (
        !Number.isSafeInteger(version?.revision) ||
        typeof version?.payloadSha256 !== "string"
      )
        throw new Error(
          `${transport} ${operation}: 保存の改訂を確認できません`,
        );
      if (operation === "initialize") savedVersion = version;
      else if (
        savedVersion?.revision !== version.revision ||
        savedVersion?.payloadSha256 !== version.payloadSha256
      )
        throw new Error(`${transport}: 初期保存と照会の改訂が一致しません`);
      return {
        elapsedMs,
        git: after.git - before.git,
        origin: after.origin - before.origin,
      };
    };
    const initialize = await measure("initialize");
    const read = await measure("read");
    result = { startupMs, initialize, read };
  } catch (error) {
    sampleError = error;
  }

  input?.end();
  const wait = new AbortController();
  const stop = setTimeout(() => child.kill(), timeoutMs);
  try {
    const exit = await Promise.race([
      closed,
      delay(timeoutMs + 5_000, null, { signal: wait.signal }),
    ]);
    if (exit === null || exit[0] !== 0 || exit[1] !== null || channelFailure)
      throw new CleanupUnconfirmed(
        "計測用Serverの正常終了を確認できません" +
          (childReason ? `: ${childReason}` : ""),
        { cause: sampleError },
      );
  } finally {
    wait.abort();
    clearTimeout(stop);
    output?.close();
    diagnostics?.close();
  }
  if (!result) throw sampleError;
  return result;
}

function summary(input: readonly number[]) {
  const sorted = [...input].sort((a, b) => a - b);
  const round = (n: number | undefined) =>
    n === undefined ? null : Math.round(n * 100) / 100;
  const lower = sorted[Math.floor((sorted.length - 1) / 2)];
  const upper = sorted[Math.floor(sorted.length / 2)];
  return {
    min: round(sorted[0]),
    median: round(
      lower === undefined || upper === undefined
        ? undefined
        : (lower + upper) / 2,
    ),
    max: round(sorted.at(-1)),
  };
}

async function main() {
  const [argument = "3", ...rest] = process.argv.slice(2);
  if (rest.length || !/^(?:[1-9]|10)$/u.test(argument))
    throw new Error("使い方: npm run benchmark -- [反復回数: 1〜10、既定3]");
  const iterations = Number(argument);
  const root = fixtureRoot();
  const results: Record<Transport, Run[]> = { api: [], mcp: [] };
  let cleanupConfirmed = true;
  try {
    for (let i = 0; i < iterations; i++) {
      for (const transport of (i % 2 === 0
        ? ["api", "mcp"]
        : ["mcp", "api"]) as Transport[]) {
        results[transport].push(
          await runSample(path.join(root, `${transport}-${i}`), transport),
        );
      }
    }
  } catch (error) {
    if (error instanceof CleanupUnconfirmed) {
      cleanupConfirmed = false;
      throw new Error(
        `${error.message}。今回の合成領域を保持しました: ${root}`,
      );
    }
    throw error;
  } finally {
    if (cleanupConfirmed) {
      requireDirectory(path.dirname(root));
      requireDirectory(root);
      fs.rmSync(root, { recursive: true });
    }
  }
  const summarize = (runs: Run[]) => {
    const operation = (key: "initialize" | "read") => ({
      milliseconds: summary(runs.map((run) => run[key].elapsedMs)),
      gitProcesses: runs.map((run) => run[key].git),
      gitOriginReads: runs.map((run) => run[key].origin),
    });
    return {
      startupMilliseconds: summary(runs.map((run) => run.startupMs)),
      initialize: operation("initialize"),
      read: operation("read"),
    };
  };
  process.stdout.write(
    `${JSON.stringify({ mode: "local-synthetic", iterations, api: summarize(results.api), mcpStdio: summarize(results.mcp) }, null, 2)}\n`,
  );
}

try {
  if (process.argv[2] === childMode && process.argv.length === 3)
    await runCli();
  else await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "計測に失敗しました"}\n`,
  );
  process.exitCode = 1;
}
