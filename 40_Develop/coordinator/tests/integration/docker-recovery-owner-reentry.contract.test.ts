/**
 * 本番Ownerの途中失敗後の進行保持と正常終了の実Host結合を確認する。
 * @packageDocumentation
 * @responsibility 模擬下位境界による再入場と、実修復保存から同RootのTask・Home排他・Host・現在Writerによる正常終了への接続を検証する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope 模擬境界によるProcess内再入場、退避なし／自動破棄保存前中断後の明示保持から実修復API・現在Writer／history／completionを経た同Root Taskへの接続、実Root・Home排他・Hostによる正常終了、認証create切断子の五通常例外。Native・Docker技術は代役とし実Docker処置は行わない。
 * @boundary ERB-IT-003=Owner→保存・Host境界の模擬接続と実Host結合。ERB-IT-014=実修復API／DI Machine／保存と、模擬Native・技術観測。
 */

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext, runInThisContext } from "node:vm";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { acquireLock } from "../../../lock/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/lifecycle/host.ts";
import * as locks from "../../src/lifecycle/host.ts";
import { verifyNormalOwnerLifecycle } from "../fixtures/docker-owned-process-test-support.ts";

/**
 * 自己生成子の観測条件を有界待機する。
 * @responsibility 待機期限をcloseまたは成功へ読み替えない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 呼出し元が子の所有と回収を維持する。
 * @stimulus 局所観測を10ms間隔で確認する。
 * @observation 条件成立または期限例外。
 * @oracle 期限まで未成立なら失敗する。
 * @cleanup 各待機timerは解決後に残らない。
 * @boundary 同Process内の試験待機。
 */
async function waitForOwnedProcessObservation(
  observed: () => boolean,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (!observed()) {
    assert.ok(Date.now() < deadline, "owned_process_observation_timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * 同期readyを通知した自己生成子を、外部親がNode.js標準で停止する。
 * @responsibility ready、生存、停止要求、元子closeとstdio終了を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 自己生成Repositoryと固定workerだけを渡す。
 * @stimulus 親から所有ChildProcessへ終了要求を一回だけ発行する。
 * @observation 同PIDの単一packet、終了Signal、元子のclose。
 * @oracle 生存readyと終端全確認の後だけ、呼出し元がfresh回復へ進める。
 * @cleanup 失敗時も同じ元子を有界joinし、不明時はRootを保持する。
 * @boundary 実Windows Process。Docker・Providerは呼び出さない。
 */
async function runExternallyTerminatedProducer(worker: string, root: string) {
  const child = spawn(
    process.execPath,
    ["--experimental-test-module-mocks", worker, "parent_terminated"],
    {
      cwd: root,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  let closed = false;
  let status: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let processError: Error | undefined;
  let primaryFailure: unknown;
  let cleanupFailure: unknown;
  let outcome: {
    status: number | null;
    signal: NodeJS.Signals | null;
    error: undefined;
    stdout: string;
    stderr: string;
    pid: number | undefined;
    parentTerminationConfirmed: true;
  } | null = null;
  let terminationRequested = false;
  let terminationRequests = 0;
  let cleanupFallbackIssued = false;
  let cleanupFallbackAccepted: boolean | null = null;
  /**
   * 所有子のstdoutを64KiB以内だけ捕捉する。
   * @responsibility 所有子のstdoutを64KiB以内だけ捕捉する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同じChildProcessの出力監視を登録している。
   * @stimulus 文字列chunkを受け取り累積容量を検査する。
   * @observation stdout本文と固定owned_producer_output_limit例外。
   * @oracle 上限超過を本文へ追加せずprocessErrorとして保持する。
   * @cleanup 所有子のjoin後に同じdata Listenerを解除する。
   * @boundary 実Windows子のstdio。秘密や無制限本文の収集に使わない。
   */
  const onOutput = (chunk: string) => {
    if (Buffer.byteLength(stdout) + Buffer.byteLength(chunk) > 64 * 1024)
      processError = new Error("owned_producer_output_limit");
    else stdout += chunk;
  };
  /**
   * 所有子のstderrを64KiB以内だけ捕捉する。
   * @responsibility 所有子のstderrを64KiB以内だけ捕捉する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同じChildProcessの出力監視を登録している。
   * @stimulus 文字列chunkを受け取り累積容量を検査する。
   * @observation stderr本文と固定owned_producer_error_limit例外。
   * @oracle 上限超過を本文へ追加せずprocessErrorとして保持する。
   * @cleanup 所有子のjoin後に同じdata Listenerを解除する。
   * @boundary 実Windows子のstdio。秘密や無制限本文の収集に使わない。
   */
  const onDiagnostic = (chunk: string) => {
    if (Buffer.byteLength(stderr) + Buffer.byteLength(chunk) > 64 * 1024)
      processError = new Error("owned_producer_error_limit");
    else stderr += chunk;
  };
  /**
   * 所有子のProcess errorを終了観測へ保持する。
   * @responsibility 所有子のProcess errorを終了観測へ保持する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同じ所有子のerror購読。
   * @stimulus 通知されたErrorをprocessErrorへ保存する。
   * @observation 返却または例外化されるProcess失敗。
   * @oracle closeだけから成功を推定せずerrorを参照する。
   * @cleanup 終了待機後に同じerror Listenerを解除する。
   * @boundary 所有ChildProcessの通知。DockerやProviderは起動しない。
   */
  const onError = (error: Error) => {
    processError = error;
  };
  const onClose = (
    code: number | null,
    receivedSignal: NodeJS.Signals | null,
  ) => {
    status = code;
    signal = receivedSignal;
    closed = true;
  };
  child.stdout.setEncoding("utf8").on("data", onOutput).on("error", onError);
  child.stderr
    .setEncoding("utf8")
    .on("data", onDiagnostic)
    .on("error", onError);
  child.once("error", onError);
  child.once("close", onClose);
  try {
    await waitForOwnedProcessObservation(
      () => stdout.includes("\n") || closed || processError !== undefined,
      90_000,
    );
    assert.equal(processError, undefined);
    assert.equal(closed, false);
    assert.equal(child.exitCode, null);
    assert.equal(child.signalCode, null);
    const lines = stdout.split("\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1], "");
    const packet = JSON.parse(lines[0] ?? "");
    assert.equal(packet.pid, child.pid);
    assert.equal(packet.phase, "parent_terminated");
    assert.equal(packet.operationRoot, root);
    assert.match(
      packet.recoveryId,
      /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u,
    );
    terminationRequested = true;
    terminationRequests++;
    assert.equal(child.kill("SIGKILL"), true);
    await waitForOwnedProcessObservation(() => closed, 10_000);
    assert.equal(closed, true);
    assert.equal(signal, "SIGKILL");
    assert.equal(child.stdout.readableEnded, true);
    assert.equal(child.stderr.readableEnded, true);
    assert.equal(processError, undefined);
    assert.equal(stdout.split("\n").length, 2);
    assert.equal(terminationRequests, 1);
    outcome = {
      status,
      signal,
      error: processError,
      stdout,
      stderr,
      pid: child.pid,
      parentTerminationConfirmed: true,
    };
  } catch (error) {
    primaryFailure = error;
  } finally {
    try {
      if (
        !closed &&
        !terminationRequested &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        terminationRequested = true;
        terminationRequests++;
        cleanupFallbackIssued = true;
        cleanupFallbackAccepted = child.kill("SIGKILL");
        assert.equal(cleanupFallbackAccepted, true);
      }
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      await waitForOwnedProcessObservation(() => closed, 10_000);
      assert.equal(child.stdout.readableEnded, true);
      assert.equal(child.stderr.readableEnded, true);
    } catch (error) {
      cleanupFailure ??= error;
    } finally {
      const releaseListeners = () => {
        child.stdout.off("data", onOutput).off("error", onError);
        child.stderr.off("data", onDiagnostic).off("error", onError);
        child.off("error", onError);
        child.off("close", onClose);
      };
      if (closed) releaseListeners();
      else child.once("close", releaseListeners);
    }
  }
  if (cleanupFallbackIssued && primaryFailure === undefined)
    primaryFailure = new Error(
      "owned_producer_cleanup_fallback_not_positive_proof",
    );
  if (primaryFailure !== undefined || cleanupFailure !== undefined)
    throw Object.assign(
      new AggregateError(
        [primaryFailure, cleanupFailure].filter((value) => value !== undefined),
        "owned_producer_termination_unconfirmed",
      ),
      { cleanupFallbackIssued, cleanupFallbackAccepted, childClosed: closed },
    );
  assert.ok(outcome);
  return outcome;
}

/**
 * 親終端helperの実本文へ閉じたProcess通知を与える。
 * @responsibility 実Hostの正例と、要求・close・失敗時清掃の論理反証を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実本文と既知の一故障だけを選ぶ。
 * @stimulus kill拒否・例外、元子close／stdio欠測、遅延closeを与える。
 * @observation 終端要求、fallback、同じ子、利用側への成功搬送とlistener数。
 * @oracle 不明な元子終了から成功を返さず、一次失敗と清掃失敗を保持する。
 * @cleanup VM・局所EventEmitterだけで実Processを作成しない。
 * @boundary 本番同等の試験helper本文と模擬Process通知。実tree終了の証明ではない。
 */
async function evaluateParentTerminationScenario(
  mode:
    | "delayed_close"
    | "kill_false"
    | "kill_throw"
    | "missing_close"
    | "missing_stdio",
  source = stripTypeScriptTypes(runExternallyTerminatedProducer.toString()),
) {
  const output = Object.assign(new EventEmitter(), { readableEnded: false });
  const diagnostic = Object.assign(new EventEmitter(), {
    readableEnded: false,
  });
  Object.assign(output, { setEncoding: () => output });
  Object.assign(diagnostic, { setEncoding: () => diagnostic });
  const calls: string[] = [];
  let closed = false;
  let killCalls = 0;
  let freshConsumerCalls = 0;
  let observations = 0;
  const child = Object.assign(new EventEmitter(), {
    pid: 12345,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    stdout: output,
    stderr: diagnostic,
    kill: (signal: string) => {
      killCalls++;
      calls.push("kill");
      assert.equal(signal, "SIGKILL");
      if (mode === "kill_false") return false;
      if (mode === "kill_throw") throw Error("synthetic_kill_failure");
      if (mode === "missing_close") child.exitCode = 1;
      return true;
    },
  });
  function finish(stdio: boolean) {
    output.readableEnded = stdio;
    diagnostic.readableEnded = stdio;
    child.exitCode = null;
    child.signalCode = "SIGKILL";
    closed = true;
    child.emit("close", null, "SIGKILL");
  }
  const candidate = runInNewContext(`(${source})`, {
    assert,
    AggregateError,
    Buffer,
    process: { execPath: "fixed-node" },
    spawn: () => {
      queueMicrotask(() =>
        output.emit(
          "data",
          JSON.stringify({
            pid: child.pid,
            phase: "parent_terminated",
            operationRoot: "fixed-root",
            recoveryId:
              "docker-task." +
              "a".repeat(64) +
              "." +
              "b".repeat(64) +
              "." +
              "c".repeat(64),
          }) + "\n",
        ),
      );
      return child;
    },
    waitForOwnedProcessObservation: async (observed: () => boolean) => {
      await Promise.resolve();
      observations++;
      calls.push(observations === 1 ? "wait_ready" : "wait_close");
      if (observations >= 2 && mode === "delayed_close") finish(true);
      if (observations >= 2 && mode === "missing_stdio") finish(false);
      if (!observed()) throw Error("fixture_observation_unconfirmed");
    },
  }) as typeof runExternallyTerminatedProducer;
  let result: Awaited<ReturnType<typeof candidate>> | null = null;
  let error: unknown;
  try {
    result = await candidate("fixed-worker", "fixed-root");
    freshConsumerCalls++;
  } catch (failure) {
    error = failure;
  }
  // A late close is cleanup only and must not revise the settled failure.
  if (!closed) finish(true);
  assert.deepEqual(child.eventNames(), []);
  assert.deepEqual(output.eventNames(), []);
  assert.deepEqual(diagnostic.eventNames(), []);
  return { result, error, calls, closed, killCalls, freshConsumerCalls };
}

/**
 * 親終了の停止要求とclose／stdioを独立に反証する。
 * @responsibility killの受理だけで元子終了やfresh回復を成立させない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 本文を局所Process通知へ接続する。
 * @stimulus kill拒否・例外、close／stdio欠測、遅延closeと停止要求省略を与える。
 * @observation 正常返却、一次／清掃失敗、停止回数と利用側到達。
 * @oracle 正常な遅延closeだけ成功、拒否後に再要求せず後着closeで成功へ戻さない。
 * @cleanup 実Process・Filesystem・Dockerを作成しない。
 * @boundary 親停止試験の局所反証。実Host成功とは区別する。
 */
test("親停止はkill失敗と元子close／stdio欠測を成功へ補完しない", async () => {
  const positive = await evaluateParentTerminationScenario("delayed_close");
  assert.ok(positive.result);
  assert.equal(positive.result.status, null);
  assert.equal(positive.result.signal, "SIGKILL");
  assert.equal(positive.error, undefined);
  assert.equal(positive.killCalls, 1);
  assert.equal(positive.freshConsumerCalls, 1);
  for (const mode of [
    "kill_false",
    "kill_throw",
    "missing_close",
    "missing_stdio",
  ] as const) {
    const failed = await evaluateParentTerminationScenario(mode);
    assert.equal(failed.result, null, mode);
    assert.ok(failed.error instanceof AggregateError, mode);
    assert.equal(failed.killCalls, 1, mode);
    assert.equal(failed.freshConsumerCalls, 0, mode);
  }
  const source = stripTypeScriptTypes(
    runExternallyTerminatedProducer.toString(),
  );
  const request = 'assert.equal(child.kill("SIGKILL"), true);';
  assert.ok(source.includes(request));
  const omitted = await evaluateParentTerminationScenario(
    "delayed_close",
    source.replace(request, 'assert.fail("stop_request_omitted");'),
  );
  assert.equal(omitted.result, null);
  assert.equal(omitted.freshConsumerCalls, 0);
});

/**
 * 放棄した実Ownerの終了後、別Processでexact回復を完了する。
 * @responsibility 排他解放と清掃を区別し、旧Process終了から本番consumerまで結合する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition Windowsと自己生成Repository、五資源未要求の固定Planを使う。
 * @stimulus begin／abandon後、保存直後、Host開始後、清掃観測を省略した正常exitと清掃途中二点の終了から別Processへ接続する。
 * @observation 各子の終了、実state全文と改訂、非対象本文／実体、履歴、Host／markerと短命物を個別確認する。
 * @oracle 放棄またはcleanup_withheldのexitだけでは清掃せず、本番回復後だけ対象を除去し非対象を全文保持する。
 * @cleanup 両子と対象清掃の確認後に自己生成Rootだけを回収し、不明時は保持する。
 * @boundary Process喪失とfresh回復。Home観測だけを模擬し実Dockerは使わない。
 */
/**
 * join済みの固定子だけが保持した試験Lockを、停止下で明示回収する。
 * @boundary 新品Root・有限な親子だけ。製品の自動Recoveryではない。
 */
function recoverStoppedFixtureLocks(root: string, pid: number, value: unknown) {
  assert.ok(Array.isArray(value));
  const removals: {
    file: string;
    identity: readonly string[];
    bytes: Buffer;
  }[] = [];
  for (const entry of value) {
    assert.equal(typeof entry.path, "string");
    const file = path.resolve(root, entry.path);
    const directory = path.dirname(file);
    assert.ok(
      [
        path.join(root, ".crdd", "lock"),
        path.join(root, ".crdd", "tests", "reentry-home-locks"),
        path.join(root, ".crdd", "tests", "reentry-runtime-locks"),
      ].includes(directory),
    );
    assert.equal(fs.realpathSync(directory), directory);
    assert.match(
      path.basename(file),
      /^(?:coordinator\.host-operation\.OP-[0-9]{6,}|executor\.provider-home\.[a-f0-9]{64}|coordinator\.docker-state)\.lock$/u,
    );
    const bytes = Buffer.from(entry.bytes, "base64");
    const record = JSON.parse(bytes.toString());
    assert.equal(record.schema, "crdd-lock/v1");
    assert.equal(record.owner.processId, pid);
    assert.match(record.owner.processIdentity, /^[a-f0-9-]{36}$/u);
    assert.match(record.generation, /^[a-f0-9-]{36}$/u);
    const name = path.basename(file);
    assert.equal(
      record.identity,
      name === "coordinator.docker-state.lock"
        ? "docker-state:shared"
        : name.startsWith("coordinator.host-operation.")
          ? `host-operation:${name.slice("coordinator.host-operation.".length, -5)}`
          : `provider-home:${name.slice("executor.provider-home.".length, -5)}`,
    );
    const stat = fs.lstatSync(file, { bigint: true });
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.nlink, 1n);
    assert.deepEqual(
      [stat.dev, stat.ino, stat.birthtimeNs].map(String),
      entry.identity,
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
    const blocked = acquireLock({
      directory,
      name: path.basename(file),
      identity: record.identity,
    });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "lock_exists");
    assert.equal(
      removals.some((item) => item.file === file),
      false,
    );
    removals.push({ file, identity: entry.identity, bytes });
  }
  for (const { file, identity, bytes } of removals) {
    const current = fs.lstatSync(file, { bigint: true });
    assert.equal(current.isFile(), true);
    assert.equal(current.isSymbolicLink(), false);
    assert.equal(current.nlink, 1n);
    assert.deepEqual(
      [current.dev, current.ino, current.birthtimeNs].map(String),
      identity,
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
    // 元子はjoin済みで、次の子は未起動。親はこのScopeの取得を行っていない。
    fs.unlinkSync(file);
    assert.throws(() => fs.lstatSync(file), { code: "ENOENT" });
  }
}

/** 停止下処置の照合失敗を、File削除0で確認する。実Filesystemは使わない。 */
test("停止下Lock回収は元通知・Scope・実体が不一致なら削除しない", () => {
  const source = fs.readFileSync(new URL(import.meta.url), "utf8");
  const start = source.indexOf("function recoverStoppedFixtureLocks(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const factory = runInThisContext(
    `(function(fs, path, acquireLock, assert) { ${body}; return recoverStoppedFixtureLocks; })`,
  );
  for (const fault of [
    "none",
    "owner",
    "scope",
    "generation",
    "path",
    "file",
    "late_file",
    "content",
    "late_content",
    "link",
    "hardlink",
    "nonfile",
    "unobservable",
    "duplicate",
    "second_invalid",
  ] as const) {
    const root = path.resolve("fixture-root");
    const record = {
      schema: "crdd-lock/v1",
      identity: "host-operation:OP-123456",
      owner: {
        processId: 100,
        processIdentity: "11111111-1111-4111-8111-111111111111",
      },
      generation: "22222222-2222-4222-8222-222222222222",
    };
    if (fault === "owner") record.owner.processId = 101;
    if (fault === "scope") record.identity = `provider-home:${"a".repeat(64)}`;
    if (fault === "generation") record.generation = "invalid";
    const bytes = Buffer.from(JSON.stringify(record));
    const entry = {
      path: path.join(
        ".crdd",
        "lock",
        "coordinator.host-operation.OP-123456.lock",
      ),
      identity: ["1", "2", "3"],
      bytes: bytes.toString("base64"),
    };
    if (fault === "path") entry.path = "../foreign.lock";
    let reads = 0,
      deleted = 0;
    const runtime = factory(
      {
        realpathSync: (value: string) => value,
        lstatSync: () => {
          if (deleted > 0)
            throw Object.assign(new Error("absent"), { code: "ENOENT" });
          if (fault === "unobservable")
            throw new Error("observation unavailable");
          reads++;
          return {
            dev: 1n,
            ino:
              fault === "file" || (fault === "late_file" && reads > 1)
                ? 99n
                : 2n,
            birthtimeNs: 3n,
            nlink: fault === "hardlink" ? 2n : 1n,
            isFile: () => fault !== "nonfile",
            isSymbolicLink: () => fault === "link",
          };
        },
        readFileSync: () =>
          fault === "content" || (fault === "late_content" && reads > 1)
            ? Buffer.from("changed")
            : bytes,
        unlinkSync: () => {
          deleted++;
        },
      },
      path,
      () => ({ status: "blocked", reason: "lock_exists" }),
      assert,
    );
    const notices =
      fault === "duplicate"
        ? [entry, entry]
        : fault === "second_invalid"
          ? [entry, { ...entry, path: "../foreign.lock" }]
          : [entry];
    if (fault === "none") {
      runtime(root, 100, notices);
      assert.equal(deleted, 1);
    } else {
      assert.throws(() => runtime(root, 100, notices));
      assert.equal(deleted, 0, fault);
    }
  }
});

for (const producerMode of [
  "producer",
  "state_saved",
  "host_started",
  "cleanup_withheld",
  "parent_terminated",
] as const) {
  /**
   * 放棄した実Ownerの終了後、別Processでexact回復を完了する。
   * @responsibility 排他解放と清掃を区別し、旧Process終了から本番consumerまで結合する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition Windowsと自己生成Repository、五資源未要求の固定Planを使う。
   * @stimulus begin／abandon後、保存直後、Host開始後、清掃観測を省略した正常exitと清掃途中二点の終了から別Processへ接続する。
   * @observation 各子の終了、実state全文と改訂、非対象本文／実体、履歴、Host／markerと短命物を個別確認する。
   * @oracle 放棄またはcleanup_withheldのexitだけでは清掃せず、本番回復後だけ対象を除去し非対象を全文保持する。
   * @cleanup 両子と対象清掃の確認後に自己生成Rootだけを回収し、不明時は保持する。
   * @boundary Process喪失とfresh回復。Home観測だけを模擬し実Dockerは使わない。
   */
  test(`Host Windows: Owner終了境界${producerMode}から別Processの本番回復へ結合する`, async () => {
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "abandon_owner_test",
    );
    const root = fs.mkdtempSync(path.join(area.directory, "abandon-owner-"));
    let cleanupConfirmed = false;
    try {
      execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
      execFileSync(
        "git",
        [
          "-C",
          root,
          "-c",
          "user.name=CRDD Test",
          "-c",
          "user.email=test@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "--quiet",
          "-m",
          "fixture",
        ],
        { windowsHide: true },
      );
      const worker = fileURLToPath(
        new URL(
          "../fixtures/docker-recovery-abandon-worker.ts",
          import.meta.url,
        ),
      );
      const producer =
        producerMode === "parent_terminated"
          ? await runExternallyTerminatedProducer(worker, root)
          : spawnSync(
              process.execPath,
              ["--experimental-test-module-mocks", worker, producerMode],
              {
                cwd: root,
                encoding: "utf8",
                windowsHide: true,
                shell: false,
                timeout: 90_000,
                maxBuffer: 64 * 1024,
              },
            );
      assert.equal(producer.error, undefined);
      assert.equal(
        producer.signal,
        producerMode === "parent_terminated" ? "SIGKILL" : null,
      );
      assert.equal(
        producer.status,
        producerMode === "parent_terminated"
          ? null
          : producerMode === "producer" || producerMode === "cleanup_withheld"
            ? 0
            : 1,
        producer.stderr,
      );
      const emitted = JSON.parse(producer.stdout);
      if (producerMode === "parent_terminated") {
        assert.ok("parentTerminationConfirmed" in producer);
        assert.equal(producer.parentTerminationConfirmed, true);
      }
      if (
        producerMode === "cleanup_withheld" ||
        producerMode === "parent_terminated"
      ) {
        assert.equal(producer.stdout.trim().split(/\r?\n/u).length, 1);
        assert.equal(emitted.operationRoot, root);
        assert.equal(emitted.cleanupObserved, false);
        assert.equal(emitted.authCreateDockerCalls, 0);
      }
      assert.equal(typeof emitted.pid, "number");
      assert.equal(emitted.pid, producer.pid);
      assert.notEqual(emitted.pid, process.pid);
      if (producerMode === "producer") {
        assert.equal(emitted.generationReleased, true);
        assert.deepEqual(emitted.admissionChecks, [
          "invalid_current",
          "invalid_pending",
          "unknown_entry",
          "same_home_after_read",
          "durable_same_home_after_abandon",
          "root_invalid_after_state_read",
        ]);
      } else {
        assert.equal(emitted.phase, producerMode);
        assert.equal(emitted.startWrites, 1);
        assert.equal("generationReleased" in emitted, false);
        assert.throws(
          () => fs.lstatSync(path.join(root, "unexpected-finally")),
          { code: "ENOENT" },
        );
      }
      const statePath = path.join(root, ".crdd", "domain-model", "state.json");
      const before = JSON.parse(fs.readFileSync(statePath, "utf8"));
      const target = before.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === emitted.recoveryId,
      );
      assert.ok(target && target.kind === "docker_task");
      const targetOperationId = JSON.parse(target.identityJson).operationId;
      assert.equal(before.operations.length, 4);
      assert.equal(target.lease, "held");
      assert.equal(target.execution.ownerEffect, "active");
      if (
        producerMode === "cleanup_withheld" ||
        producerMode === "parent_terminated"
      ) {
        assert.equal(target.resources, null);
        assert.equal(target.execution.providerStart, "not_started");
        assert.equal(target.execution.externalSend, "not_issued");
        assert.equal(target.execution.sharedWrite, "not_issued");
      }
      const identity = JSON.parse(target.identityJson);
      assert.equal(identity.operationNonce, emitted.recoveryId.split(".")[2]);
      const targetHost = before.operations.find(
        (item: { kind: string; operationId: string }) =>
          item.kind === "host_operation" &&
          item.operationId === targetOperationId,
      );
      assert.ok(targetHost);
      const hostRoot = path.join(
        root,
        ".crdd",
        "operations",
        targetHost.operationId,
      );
      assert.equal(fs.lstatSync(hostRoot).isDirectory(), true);
      assert.equal(targetHost.cleanup, "not_requested");
      assert.equal(targetHost.phase, "active");
      if (producerMode !== "producer")
        recoverStoppedFixtureLocks(root, emitted.pid, emitted.locks);
      const releasedHomeAcquisition = locks.acquireProviderHomeLock(
        identity.stableLogicalHomeBindingHash,
        path.join(root, ".crdd", "tests", "reentry-home-locks"),
      );
      assert.ok(releasedHomeAcquisition.status === "acquired");
      const releasedHome = releasedHomeAcquisition.lock;
      assert.ok(releasedHome);
      assert.equal(releasedHome.release(), true);
      for (const name of [
        "state.lock",
        "state.pending.json",
        "history.pending.jsonl",
      ])
        assert.throws(
          () => fs.lstatSync(path.join(path.dirname(statePath), name)),
          { code: "ENOENT" },
        );
      const other = before.operations.find(
        (item: { kind: string; recoveryId: string }) =>
          item.kind === "docker_task" && item.recoveryId !== emitted.recoveryId,
      );
      assert.ok(other);
      const otherHost = before.operations.find(
        (item: { kind: string; operationId: string }) =>
          item.kind === "host_operation" &&
          item.operationId === JSON.parse(other.identityJson).operationId,
      );
      assert.ok(otherHost);
      const otherRoot = path.join(
        root,
        ".crdd",
        "operations",
        otherHost.operationId,
      );
      const otherChildNames = fs.readdirSync(otherRoot).sort();
      /** 非対象Rootと全子の実体を独立に確認する。 @trace PRL-IT-013 */
      const captureOtherHost = () => {
        const capture = (location: string) => {
          const value = fs.lstatSync(location, { bigint: true });
          assert.equal(value.isDirectory(), true);
          assert.equal(value.isSymbolicLink(), false);
          return [value.dev, value.ino, value.birthtimeNs].map(String);
        };
        const children = otherChildNames.map((name) => [
          name,
          ...capture(path.join(otherRoot, name)),
        ]);
        assert.deepEqual(fs.readdirSync(otherRoot).sort(), otherChildNames);
        return {
          root: capture(otherRoot),
          children,
        };
      };
      const otherHostBefore = captureOtherHost();
      if (producerMode === "state_saved") {
        const terminated = new Set([process.pid, emitted.pid]);
        for (const interruption of [
          "pending_writer_blocked",
          "pending_saved",
          "host_removed",
          "confirmed_writer_blocked",
        ]) {
          const interrupted = spawnSync(
            process.execPath,
            [
              "--experimental-test-module-mocks",
              worker,
              "recovery",
              emitted.recoveryId,
              interruption,
            ],
            {
              cwd: root,
              encoding: "utf8",
              windowsHide: true,
              shell: false,
              timeout: 90_000,
              maxBuffer: 64 * 1024,
            },
          );
          assert.equal(interrupted.error, undefined);
          assert.equal(interrupted.signal, null);
          const writerBlocked = interruption.endsWith("writer_blocked");
          assert.equal(
            interrupted.status,
            writerBlocked ? 0 : 1,
            interrupted.stderr,
          );
          const packet = JSON.parse(interrupted.stdout);
          assert.equal(packet.pid, interrupted.pid);
          assert.equal(terminated.has(packet.pid), false);
          terminated.add(packet.pid);
          assert.equal(packet.recoveryId, emitted.recoveryId);
          assert.equal(packet.phase, interruption);
          assert.equal(packet.reached, 1);
          assert.equal(
            packet.finalWriterCalls,
            interruption === "confirmed_writer_blocked" ? 1 : 0,
          );
          assert.equal(packet.underlyingFinalWriterCalls, 0);
          assert.equal(packet.hostRecoveryCalls, 1);
          // 資源未要求なので資源Writerを発行しない。Owner失効とHost意図だけ。
          const expectedKinds = ["host_operation"];
          assert.deepEqual(packet.checkpointKinds, expectedKinds);
          assert.equal(packet.checkpointWriterCalls, expectedKinds.length);
          assert.equal(
            packet.actualCheckpointWriterCalls,
            expectedKinds.length -
              (interruption === "pending_writer_blocked" ? 1 : 0),
          );
          if (writerBlocked) {
            assert.equal(packet.report.status, "blocked");
            assert.equal(packet.report.recoveryId, emitted.recoveryId);
            assert.equal(packet.report.operationRetained, null);
            assert.equal(packet.report.operationRemovalConfirmed, false);
            assert.equal(packet.report.taskRecoveryCompleted, false);
            assert.equal(packet.report.locksReleased, true);
          }
          assert.equal(packet.observerRejectionConfirmed, true);
          assert.deepEqual(packet.violations, []);
          assert.ok(
            packet.calls.every((call: string) =>
              ["native", "git"].includes(call),
            ),
          );
          assert.throws(
            () => fs.lstatSync(path.join(root, "unexpected-recovery-finally")),
            { code: "ENOENT" },
          );
          const interruptedState = JSON.parse(
            fs.readFileSync(statePath, "utf8"),
          );
          assert.equal(
            interruptedState.operations.some(
              (item: typeof target) => item.recoveryId === emitted.recoveryId,
            ),
            true,
          );
          assert.deepEqual(
            interruptedState.operations.filter(
              (item: typeof target) =>
                (item.kind !== "host_operation" ||
                  item.operationId !== targetOperationId) &&
                item.recoveryId !== emitted.recoveryId,
            ),
            before.operations.filter(
              (item: typeof target) =>
                (item.kind !== "host_operation" ||
                  item.operationId !== targetOperationId) &&
                item.recoveryId !== emitted.recoveryId,
            ),
          );
          assert.deepEqual(
            interruptedState.unresolvedRecoveries,
            before.unresolvedRecoveries,
          );
          assert.equal(
            Object.hasOwn(interruptedState, "pendingDeliveries"),
            false,
          );
          assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
          assert.deepEqual(captureOtherHost(), otherHostBefore);
          const interruptedHost = interruptedState.operations.find(
            (item: { kind: string; operationId: string }) =>
              item.kind === "host_operation" &&
              item.operationId === targetOperationId,
          );
          assert.ok(interruptedHost);
          assert.equal(
            interruptedHost.cleanup,
            interruption === "pending_writer_blocked"
              ? "not_requested"
              : interruption === "confirmed_writer_blocked"
                ? "unknown"
                : "pending",
          );
          if (
            interruption === "pending_saved" ||
            interruption === "pending_writer_blocked"
          ) {
            const stat = fs.lstatSync(hostRoot, { bigint: true });
            assert.equal(stat.isDirectory(), true);
            assert.equal(stat.isSymbolicLink(), false);
            const normalize = (ino: bigint) =>
              ino < 0n ? BigInt.asUintN(64, ino) : ino;
            assert.equal(
              [stat.dev, normalize(stat.ino), stat.birthtimeNs]
                .map(String)
                .join(":"),
              [
                targetHost.rootIdentity.dev,
                targetHost.rootIdentity.ino,
                targetHost.rootIdentity.birthtimeNs,
              ].join(":"),
            );
          } else
            assert.throws(() => fs.lstatSync(hostRoot), { code: "ENOENT" });
          if (!writerBlocked)
            recoverStoppedFixtureLocks(root, packet.pid, packet.locks);
          const leaseAcquisition = locks.acquireProviderHomeLock(
            identity.stableLogicalHomeBindingHash,
            path.join(root, ".crdd", "tests", "reentry-home-locks"),
          );
          assert.ok(leaseAcquisition.status === "acquired");
          const lease = leaseAcquisition.lock;
          assert.ok(lease);
          assert.equal(lease.release(), true);
          for (const name of [
            "state.lock",
            "state.pending.json",
            "history.pending.jsonl",
            "history.jsonl",
          ])
            assert.throws(
              () => fs.lstatSync(path.join(path.dirname(statePath), name)),
              { code: "ENOENT" },
            );
        }
      }
      const child = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          worker,
          "recovery",
          emitted.recoveryId,
          ...(producerMode === "producer" ? ["none", "verify_admission"] : []),
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          shell: false,
          timeout: 90_000,
          maxBuffer: 64 * 1024,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.equal(child.status, 0, child.stderr);
      const recovered = JSON.parse(child.stdout);
      assert.equal(recovered.pid, child.pid);
      assert.notEqual(recovered.pid, emitted.pid);
      assert.notEqual(recovered.pid, process.pid);
      assert.deepEqual(recovered.violations, []);
      assert.equal(recovered.observerRejectionConfirmed, true);
      assert.deepEqual(
        recovered.recoveryAdmissionChecks,
        producerMode === "producer"
          ? [
              "invalid_current",
              "pending_previous_mismatch",
              "unknown_entry",
              "binding_field_corrupt",
            ]
          : [],
      );
      assert.ok(
        recovered.calls.every((call: string) =>
          ["native", "git"].includes(call),
        ),
      );
      assert.equal(recovered.report.recoveryId, emitted.recoveryId);
      assert.equal(recovered.report.status, "recovered");
      const after = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.deepEqual(
        after.operations.filter(
          (item: { kind: string; operationId?: string; recoveryId: string }) =>
            (item.kind !== "host_operation" ||
              item.operationId !== targetOperationId) &&
            item.recoveryId !== emitted.recoveryId,
        ),
        before.operations.filter(
          (item: { kind: string; operationId?: string; recoveryId: string }) =>
            (item.kind !== "host_operation" ||
              item.operationId !== targetOperationId) &&
            item.recoveryId !== emitted.recoveryId,
        ),
      );
      const terminalHost = after.operations.find(
        (item: { kind: string; operationId: string }) =>
          item.kind === "host_operation" &&
          item.operationId === targetOperationId,
      );
      assert.ok(terminalHost);
      assert.equal(terminalHost.phase, "terminal");
      assert.equal(terminalHost.cleanup, "confirmed");
      assert.equal(
        after.operations.some(
          (item: { kind: string; operationId: string; recoveryId: string }) =>
            item.kind === "docker_task" &&
            item.recoveryId === emitted.recoveryId,
        ),
        false,
      );
      assert.deepEqual(after.unresolvedRecoveries, before.unresolvedRecoveries);
      assert.equal(Object.hasOwn(after, "pendingDeliveries"), false);
      assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
      assert.deepEqual(captureOtherHost(), otherHostBefore);
      for (const location of [
        otherRoot,
        ...fs.readdirSync(otherRoot).map((name) => path.join(otherRoot, name)),
      ]) {
        const missing = `${location}.oracle-missing`;
        assert.throws(() => fs.lstatSync(missing), { code: "ENOENT" });
        fs.renameSync(location, missing);
        try {
          assert.throws(() => captureOtherHost(), { code: "ENOENT" });
        } finally {
          fs.renameSync(missing, location);
        }
        assert.deepEqual(captureOtherHost(), otherHostBefore);
      }
      const history = fs
        .readFileSync(
          path.join(path.dirname(statePath), "history.jsonl"),
          "utf8",
        )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(
        history.filter((row) => row.summary.recoveryId === emitted.recoveryId)
          .length,
        1,
      );
      assert.equal(history.length, 1);
      assert.equal(history[0].summary.operationNonce, identity.operationNonce);
      for (const file of [
        hostRoot,
        ...["state.lock", "state.pending.json", "history.pending.jsonl"].map(
          (name) => path.join(path.dirname(statePath), name),
        ),
      ])
        assert.throws(() => fs.lstatSync(file), { code: "ENOENT" });
      cleanupConfirmed = true;
    } finally {
      if (cleanupConfirmed) fs.rmSync(root, { recursive: true });
    }
  });
}

/**
 * 認証create切断子の通常例外で真正Ownerの解放と記録保持を確認する。
 * @responsibility 実Dockerなしの故障刺激と、実保存・実Home排他・Host保持を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition Windowsの自己生成Repositoryと固定Docker代役だけを使用する。
 * @stimulus 作成前、作成後、unknown保存前後、packet直前を個別Processで失敗させる。
 * @observation 元例外、故障到達、要求列、abandon回数、実stateとHost・markerの保持。
 * @oracle 前半三形はintent_saved、後半二形はunknownで、実Docker0とHome再取得を要求する。
 * @cleanup 子終端・解放・自己生成実体の確認後に専用Rootを回収する。不明時は保持する。
 * @boundary 実Owner／Writer／KernelとDocker代役。Container回収や実restartは検証しない。
 */
for (const fault of [
  "image",
  "inspect",
  "before_unknown",
  "after_unknown",
  "packet",
]) {
  /**
   * 認証create切断子の通常例外で真正Ownerの解放と記録保持を確認する。
   * @responsibility 実Dockerなしの故障刺激と、実保存・実Home排他・Host保持を分離する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition Windowsの自己生成Repositoryと固定Docker代役だけを使用する。
   * @stimulus 作成前、作成後、unknown保存前後、packet直前を個別Processで失敗させる。
   * @observation 元例外、故障到達、要求列、abandon回数、実stateとHost・markerの保持。
   * @oracle 前半三形はintent_saved、後半二形はunknownで、実Docker0とHome再取得を要求する。
   * @cleanup 子終端・解放・自己生成実体の確認後に専用Rootを回収する。不明時は保持する。
   * @boundary 実Owner／Writer／KernelとDocker代役。Container回収や実restartは検証しない。
   */
  test(`Host Windows: 認証create通常例外${fault}でOwner解放と現在記録を保持する`, () => {
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "auth_create_failure_test",
    );
    const root = fs.mkdtempSync(
      path.join(area.directory, "auth-create-failure-"),
    );
    let cleanupConfirmed = false;
    try {
      execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
      execFileSync(
        "git",
        [
          "-C",
          root,
          "-c",
          "user.name=CRDD Test",
          "-c",
          "user.email=test@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--allow-empty",
          "--quiet",
          "-m",
          "fixture",
        ],
        { windowsHide: true },
      );
      const worker = fileURLToPath(
        new URL(
          "../fixtures/docker-recovery-abandon-worker.ts",
          import.meta.url,
        ),
      );
      const child = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          worker,
          "auth_create_failure",
          fault,
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          shell: false,
          timeout: 90_000,
          maxBuffer: 64 * 1024,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.equal(child.status, 1, child.stderr);
      const report = JSON.parse(child.stdout);
      assert.equal(report.pid, child.pid);
      assert.notEqual(report.pid, process.pid);
      assert.equal(report.fault, fault);
      assert.equal(report.faultReached, 1);
      assert.equal(report.abandonCalls, 1);
      assert.equal(
        report.primaryFailure,
        `auth_create_fixture_failure:${fault}`,
      );
      assert.equal(report.generationReleased, true);
      assert.equal(report.homeLeaseReacquired, true);
      assert.equal(report.hostRetained, true);
      assert.equal(report.realDockerCalls, 0);
      assert.deepEqual(
        report.dockerCalls,
        fault === "image" ? ["image"] : ["image", "create", "inspect"],
      );
      const statePath = path.join(root, ".crdd", "domain-model", "state.json");
      const bytes = fs.readFileSync(statePath);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        report.stateSha256,
      );
      const snapshot = JSON.parse(bytes.toString("utf8"));
      assert.equal(snapshot.operations.length, 4);
      const target = snapshot.operations.find(
        (value: { recoveryId: string }) =>
          value.recoveryId === report.recoveryId,
      );
      assert.ok(target && target.kind === "docker_task");
      const auth = target.resources.snapshot.resources.find(
        (value: { key: string }) =>
          value.key === "create_subscription_auth_probe",
      );
      const checkpoint = target.resources.checkpoints.find(
        (value: { key: string }) => value.key === auth.key,
      );
      assert.equal(auth.request, "not_issued");
      assert.equal(auth.identity.dockerId, null);
      assert.deepEqual(checkpoint, {
        key: auth.key,
        submission: "intent_saved",
        receiptSource: null,
        observation: "unobserved",
        absenceEvidenceSha256: null,
      });
      const authHost = snapshot.operations.find(
        (item: { kind: string; operationId: string }) =>
          item.kind === "host_operation" &&
          item.operationId === JSON.parse(target.identityJson).operationId,
      );
      assert.ok(authHost);
      for (const location of [
        path.join(
          root,
          ".crdd",
          "operations",
          JSON.parse(target.identityJson).operationId,
        ),
      ])
        assert.equal(fs.lstatSync(location).isSymbolicLink(), false);
      for (const name of [
        "unexpected-finally",
        ".crdd/domain-model/state.lock",
        ".crdd/domain-model/state.pending.json",
      ])
        assert.throws(() => fs.lstatSync(path.join(root, name)), {
          code: "ENOENT",
        });
      cleanupConfirmed = true;
    } finally {
      if (cleanupConfirmed) {
        assert.equal(path.dirname(root), area.directory);
        assert.equal(fs.realpathSync(root), root);
        fs.rmSync(root, { recursive: true, force: true });
        assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
      }
    }
  });
}

/**
 * 正常完了Ownerを実Host・Home排他・現在Writerへ接続する。
 * @responsibility Docker証明の模擬とHost回収の実測を分け、結果保存までの本番結合を検証する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition Windowsと自己生成Repositoryを使い、修復Native・技術観測、Home観測とDocker証明だけを模擬する。
 * @stimulus 1回形は退避なし、または自動破棄判断の保存直前を一回拒否して自己生成物を明示保持した後、同じstateを再初期化せずTaskへ渡す。2回形は同一Host・Homeで本番begin／正常completeを反復し、一度の実清掃後に結果を完成保存・退役し、逆順再送で再保存0を確認する。
 * @observation 実state本文、Home排他競合、Host marker、履歴、短命物と非対象操作を確認する。
 * @oracle 修復中のTask開始Writerは未保存・保存未確認・耐久Effectなし・Lock解放・元本文不変で拒否する。保持期限は七日で同ID再入場でも不変、保持物を再利用・削除せず、修復終了からの改訂・元版Hashと元修復履歴行を保全する。清掃前finalizeと複製結果は状態不変で拒否し、真正清掃後だけ対象を履歴化して現在状態から除く。
 * @cleanup 真正Ownerを放棄・解放し、確認済み自己生成HostとRepositoryだけを清掃する。
 * @boundary 実Owner／Kernel／Host／Writerと、模擬Docker cleanup・mount・terminal証明。
 */
for (const { repeatCount, retained } of [
  { repeatCount: 1, retained: false },
  { repeatCount: 1, retained: true },
  { repeatCount: 2, retained: false },
]) {
  /**
   * 正常完了Ownerを実Host・Home排他・現在Writerへ接続する。
   * @responsibility Docker証明の模擬とHost回収の実測を分け、結果保存までの本番結合を検証する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @trace ERB-IT-014
   * @precondition Windowsと自己生成Repositoryを使い、修復Native・技術観測、Home観測とDocker証明だけを模擬する。
   * @stimulus 1回形は退避なし、または自動破棄判断の保存直前を一回拒否して自己生成物を明示保持した後、同じstateを再初期化せずTaskへ渡す。複数回形は同一Host・Homeで本番begin／正常completeを反復し、一度の実清掃後に各結果の完成保存・退役を行い、逆順再送で再保存0を確認する。3回形はServer受信済みのHTTP照会を重ねる。
   * @observation 実state本文、Home排他競合、Host marker、履歴、短命物と非対象操作を確認する。
   * @oracle 修復中のTask開始Writerは未保存・保存未確認・耐久Effectなし・Lock解放・元本文不変で拒否する。保持期限は七日で同ID再入場でも不変、保持物を再利用・削除せず、修復終了からの改訂・元版Hashと元修復履歴行を保全する。清掃前finalizeと複製結果は状態不変で拒否し、真正清掃後だけ対象を履歴化して現在状態から除く。
   * @cleanup 真正Ownerを放棄・解放し、確認済み自己生成HostとRepositoryだけを清掃する。
   * @boundary 実Owner／Kernel／Host／Writerと、模擬Docker cleanup・mount・terminal証明。
   */
  test(`Host Windows: 正常Owner${repeatCount}回${retained ? "・保持あり" : ""}から実Home解放・Host清掃・結果保存まで結合する`, async (t) => {
    await verifyNormalOwnerLifecycle(t, repeatCount, retained);
  });
}

/**
 * 実Host Caseの清掃本文で例外時の後続回収と模擬復元を反証する。
 * @responsibility 清掃失敗が元の失敗を隠さず、次Caseへ差替えを残さないことを確認する。
 * @trace PRL-IT-013
 * @precondition 同Fileの固定清掃本文を一意に抽出する。
 * @stimulus 最初のHost清掃の例外、世代解放false、修復終了未確認に、元失敗あり・なしを与える。
 * @observation 全清掃試行、逆順復元、最初の失敗とRoot削除0を確認する。
 * @oracle 後続清掃と全復元を省略せず、元失敗がある場合は同じobjectを維持する。
 * @cleanup N/A: メモリ内の本文評価で実Host・Filesystemを使用しない。
 * @boundary 物理回収は別の実Host正例が所有し、このCaseは失敗時の制御だけを確認する。
 */
test("正常Owner試験の清掃例外は後続回収と全模擬復元を飛ばさない", async () => {
  const source = fs.readFileSync(
    new URL(
      "../fixtures/docker-owned-process-test-support.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const startMarker = ["normal-owner", "cleanup-begin"].join("-");
  const endMarker = ["normal-owner", "cleanup-end"].join("-");
  assert.equal(source.split(startMarker).length, 2);
  assert.equal(source.split(endMarker).length, 2);
  const body = source.slice(
    source.indexOf(startMarker) + startMarker.length,
    source.indexOf(endMarker),
  );
  for (const fault of [
    "host_cleanup_throw",
    "generation_false",
    "repair_unconfirmed",
  ]) {
    for (const primary of [null, Error("fixture_primary_failure")]) {
      const calls: string[] = [];
      const cleanupError = Error("fixture_cleanup_failure");
      const own = Object.freeze({}),
        other = Object.freeze({});
      const result = await runInNewContext(
        `(async () => { let failure = primary; ${body}\n return failure; })()`,
        {
          primary,
          assert,
          pendingCapabilities: new Set(),
          fixtureHomeLease: null,
          ownerRuntime: null,
          management: fault === "generation_false" ? Object.freeze({}) : null,
          owned: own,
          otherOwned: other,
          hostCleaned: false,
          repairClosed: fault !== "repair_unconfirmed",
          hostRuntime: {
            abandonOwnedHostOperationGenerationLock: async () => {
              calls.push("generation");
              return false;
            },
            cleanupOwnedOperationDirectories: async (value: unknown) => {
              calls.push(value === own ? "own" : "other");
              if (value === own && fault === "host_cleanup_throw")
                throw cleanupError;
              assert.ok(value === own || value === other);
              return value;
            },
            verifyOwnedOperationCleanupOutcome: (
              value: unknown,
              expected: unknown,
            ) =>
              value === expected && (value === own || value === other)
                ? "completed"
                : null,
          },
          substitutions: [1, 2].map((value) => ({
            restore: () => {
              calls.push(`restore${value}`);
            },
          })),
          fs: {
            rmSync: () => {
              calls.push("delete");
            },
          },
          root: path.join("fixture", "normal-owner-fixture"),
          area: { directory: "fixture" },
          path,
        },
      );
      if (primary !== null) assert.equal(result, primary);
      else if (fault === "host_cleanup_throw")
        assert.equal(result, cleanupError);
      else if (fault === "generation_false")
        assert.equal(result.code, "ERR_ASSERTION");
      else assert.equal(result, null);
      assert.deepEqual(calls, [
        ...(fault === "generation_false" ? ["generation"] : []),
        "own",
        "other",
        "restore2",
        "restore1",
      ]);
    }
  }
});

/**
 * 完了結果の所見を、同じ上位Ownerの初回レビューだけへ結合する。
 * @responsibility 結果内容と次試行許可の発行条件を分離する。
 * @trace ERB-IT-003
 * @precondition メモリ内の元結果・既存Owner記録と所見を使用する。
 * @stimulus 正常、別結果、別相関、取消、清掃不明、二回目レビューを渡す。
 * @observation 既存許可発行関数の呼出し数と受け取った所見。
 * @oracle 同じ清掃済み初回レビューの原結果だけ一回の呼出しで発行する。
 * @cleanup N/A: 永続化、実Process、実AI、Dockerを使用しない。
 * @boundary 完了結果からCoordinatorの既存許可Ownerへの接続。
 */
test("レビュー所見からの是正許可は同じ終端結果と初回レビューへ限定する", () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(
    source,
    "registerRuntimeOwnedReviewFindings",
  );
  for (const fault of [
    "none",
    "copy",
    "capability",
    "operation",
    "terminal_missing",
    "terminal_operation",
    "terminal_recovery",
    "home",
    "recovery",
    "cleanup",
    "cancel",
    "blocked",
    "attempt1",
    "executor",
    "approved",
    "empty",
    "count",
    "plan_missing",
  ] as const) {
    const capability = Object.freeze({});
    const findings = Object.freeze([
      Object.freeze({ message: "SYNTHETIC_REVIEW_FINDING_PRIVATE" }),
    ]);
    const result = {
      status: "completed",
      cleanupConfirmed: true,
      cancellationRequested: false,
      operationId: "OP-123456",
      normalizedResult: { decision: "changes_requested", findingCount: 1 },
      reviewFindings: findings,
    };
    const plan = {
      operationId: "OP-123456",
      executionSelection: { provider: "codex", modelIdentifier: "synthetic" },
      operationMode: "isolated_task",
      taskRole: "reviewer",
      taskAttempt: 0,
    };
    const terminal = {
      operationId: "OP-123456",
      recoveryId: "exact-recovery",
      homeLeaseReleased: true,
      recoveryCompleted: true,
    };
    const record = {
      managementCapability: {},
      operationId: "OP-123456",
      recoveryId: "exact-recovery",
      dockerCompletion: result,
      terminalObservation: terminal as typeof terminal | undefined,
      completedPlan: plan as typeof plan | undefined,
    };
    if (fault === "operation") result.operationId = "OP-654321";
    if (fault === "terminal_missing") record.terminalObservation = undefined;
    if (fault === "terminal_operation") terminal.operationId = "OP-654321";
    if (fault === "terminal_recovery") terminal.recoveryId = "other";
    if (fault === "home") terminal.homeLeaseReleased = false;
    if (fault === "recovery") terminal.recoveryCompleted = false;
    if (fault === "cleanup") result.cleanupConfirmed = false;
    if (fault === "cancel") result.cancellationRequested = true;
    if (fault === "blocked") result.status = "blocked";
    if (fault === "attempt1") plan.taskAttempt = 1;
    if (fault === "executor") plan.taskRole = "executor";
    if (fault === "approved") result.normalizedResult.decision = "approved";
    if (fault === "empty") result.reviewFindings = Object.freeze([]);
    if (fault === "count") result.normalizedResult.findingCount = 2;
    if (fault === "plan_missing") record.completedPlan = undefined;
    let issued = 0;
    const permit = Object.freeze({});
    const register = runInNewContext(
      `${declaration}\nregisterRuntimeOwnedReviewFindings`,
      {
        durableRecord: (c: object) => (c === capability ? record : null),
        registerTaskRemediation: (
          id: string,
          attempt: number,
          value: unknown,
        ) => {
          issued++;
          assert.equal(id, record.operationId);
          assert.equal(attempt, 0);
          assert.equal(value, findings);
          return permit;
        },
      },
    );
    const returned = register(
      fault === "capability" ? {} : capability,
      fault === "copy" ? { ...result } : result,
    );
    assert.equal(returned, fault === "none" ? permit : null, fault);
    assert.equal(issued, fault === "none" ? 1 : 0, fault);
  }
});

/**
 * 回復子の初回Intent前の前提を、実子本文のReader断片で確認する。
 * @responsibility null Bookを未作成の断定や旧配列へ変換しない。
 * @trace ERB-IT-014
 * @boundary Source内の前提だけ。実Host・Native・Dockerには接続しない。
 */
test("回復子は初回Intent前のnull Bookだけを受け付ける", () => {
  const source = fs.readFileSync(
    new URL("../fixtures/docker-recovery-abandon-worker.ts", import.meta.url),
    "utf8",
  );
  const matches = [
    ...source.matchAll(
      /const target = before\.operations\.find\([\s\S]*?(?=[ ]{2}const targetHost = before\.operations\.find\()/gu,
    ),
  ];
  assert.equal(matches.length, 1);
  const body = matches[0]?.[0];
  assert.ok(body);
  for (const resources of [
    null,
    [],
    { snapshot: { resources: [] }, checkpoints: [] },
  ]) {
    const run = (): unknown =>
      runInNewContext(
        stripTypeScriptTypes(`(()=>{${body};return target;})()`),
        {
          assert,
          id: "exact-recovery",
          before: { operations: [{ recoveryId: "exact-recovery", resources }] },
        },
      );
    if (resources === null) {
      const actual = run();
      assert.ok(actual && typeof actual === "object" && "resources" in actual);
      assert.equal(actual.resources, null);
    } else assert.throws(run);
  }
});
