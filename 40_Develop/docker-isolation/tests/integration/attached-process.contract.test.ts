/**
 * 固定attachと対話stdioの所有Process接続を検証する。
 * @packageDocumentation
 * @responsibility readyとcloseを区別し、出力上限とtree終端の補助子を観測する。
 * @trace ERB-IT-002
 * @level IT
 * @scope Process境界の模擬イベント。実Docker・実Windows成功は主張しない。
 * @boundary 固定attach→共通所有Process。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  startDockerProbeAttachedProcess,
  startOwnedAttachTerminationFixture,
  executeDockerProbeCommand,
  planDockerProbeCommand,
  type DockerProbeCommand,
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
  type DockerAuthenticationInput,
  type DockerAttachedProcess,
  type CommandExecution,
} from "../../src/index.ts";
import { createDockerAuthenticationRuntimeUsing as createDockerAuthenticationRuntime } from "../../src/authentication/execute.ts";
import { dockerAuthenticationCommandIsPlanned } from "../../src/authentication/plan.ts";
import { setTimeout as delay } from "node:timers/promises";
import { startOwnedWindowsProcess } from "../../src/process/start.ts";

/**
 * 本番認証Factoryの固定構成と元snapshotの寿命を反証する。
 * @responsibility 上位の技術注入なしで元観測と各実行前検証を維持する。
 * @trace ERB-IT-002
 * @precondition 実Factory本文と低位Runtimeの観測用代役を使う。
 * @stimulus 複数計画、初回CLI／環境／cwd失敗、元snapshotの再検証失敗。
 * @observation 構築順序・回数、低位binding、元snapshot参照、例外。
 * @oracle 初期観測はFactoryごと一回、各bindingは同snapshotを再検証し取り直さない。
 * @cleanup N/A: VM内でProcess・Docker・Filesystemを変更しない。
 * @boundary 本番認証構築と低位Runtime。実認証の成立とは区別する。
 */
test("認証Factoryは初期観測と同snapshotの各実行前検証を下位に閉じる", () => {
  const text = fs.readFileSync(
    new URL("../../src/authentication/execute.ts", import.meta.url),
    "utf8",
  );
  const begin = text.indexOf(
    "export function createDockerAuthenticationRuntimeFactory(",
  );
  assert.ok(begin > 0);
  const body = stripTypeScriptTypes(text.slice(begin)).replace(
    "export function",
    "function",
  );
  for (const failure of [
    "none",
    "cli",
    "environment",
    "systemRoot",
    "cwd",
    "stat",
  ]) {
    const events: string[] = [];
    const snapshot = Object.freeze({ identity: "same" });
    const environment = Object.freeze(
      failure === "systemRoot" ? {} : { SystemRoot: "C:\\Windows" },
    );
    let verifyFails = false;
    const createFactory = runInNewContext(
      `${body}; createDockerAuthenticationRuntimeFactory`,
      {
        path,
        fs: {
          statSync: (cwd: string) => {
            events.push("cwd");
            assert.equal(cwd, "C:\\Windows\\System32");
            if (failure === "stat") throw Error("stat_unavailable");
            return { isDirectory: () => failure !== "cwd" };
          },
        },
        observeTrustedDockerCli: () => {
          events.push("observe");
          if (failure === "cli") throw Error("cli_unavailable");
          return snapshot;
        },
        createDockerProcessEnvironment: () => {
          events.push("environment");
          if (failure === "environment") throw Error("environment_unavailable");
          return environment;
        },
        verifyTrustedDockerCliSnapshot: (value: unknown) => {
          events.push("verify");
          assert.equal(value, snapshot);
          if (verifyFails) throw Error("cli_changed");
          return "fixed-cli";
        },
        createDockerAuthenticationRuntimeUsing: (
          binding: {
            verifyCli: () => string;
            environment: () => unknown;
            workingDirectory: string;
          },
          plan: unknown,
        ) => {
          if (plan === null)
            throw Error("docker_authentication_plan_not_planned");
          return { binding, plan };
        },
      },
    );
    if (failure !== "none") {
      assert.throws(() => createFactory());
      assert.equal(events.filter((item) => item === "observe").length, 1);
      assert.equal(events.includes("verify"), false);
      continue;
    }
    const create = createFactory();
    assert.deepEqual(events, ["observe", "environment", "cwd"]);
    assert.throws(() => create(null), /plan_not_planned/);
    assert.deepEqual(events, ["observe", "environment", "cwd"]);
    const first = create({ name: "first" }),
      second = create({ name: "second" });
    for (const runtime of [first, second]) {
      assert.equal(runtime.binding.environment(), environment);
      assert.equal(runtime.binding.workingDirectory, "C:\\Windows\\System32");
      assert.equal(runtime.binding.verifyCli(), "fixed-cli");
    }
    verifyFails = true;
    assert.throws(() => first.binding.verifyCli(), /cli_changed/);
    assert.equal(events.filter((item) => item === "observe").length, 1);
    assert.equal(events.filter((item) => item === "verify").length, 3);
  }
});

/**
 * Dockerと終了補助のspawnを差し替える所有子イベントFixture。
 * @responsibility 元子と終了補助子、spawn構成を別々に観測する。
 * @trace ERB-IT-002
 * @precondition 同一Test内だけでBuiltin差替えを使う。
 * @stimulus 固定子イベントとstdoutを注入する。
 * @observation 実装が組み立てたargv・stdioとclose待機を取得する。
 * @oracle 呼出しTestが不存在と観測不能を区別できる。
 * @cleanup 元Builtinを戻し全模擬子をcloseする。
 * @boundary 模擬Processと実装Owner。Platform Accessの固定OS所在読取りは実観測し、tree成立の根拠にはしない。
 */
function processFixture(context: test.TestContext, interactive = false) {
  const child = Object.assign(new childProcess.ChildProcess(), {
    pid: 1234,
    stdin: interactive ? null : new PassThrough(),
    stdout: interactive ? null : new PassThrough(),
    stderr: interactive ? null : new PassThrough(),
  });
  const helper = Object.assign(new childProcess.ChildProcess(), {
    pid: 5678,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: () => true,
  });
  const calls: unknown[][] = [];
  const original = childProcess.spawn;
  childProcess.spawn = ((...args: unknown[]) => {
    calls.push(args);
    return calls.length === 1 ? child : helper;
  }) as typeof childProcess.spawn;
  syncBuiltinESMExports();
  context.after(() => {
    child.emit("close", null, null);
    helper.emit("close", 0, null);
    childProcess.spawn = original;
    syncBuiltinESMExports();
  });
  return { child, helper, calls };
}

const binding = {
  executable: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  verifyCli: (): string => binding.executable,
  environment: () => ({ SystemRoot: "C:\\Windows" }),
};

/**
 * stdout観測の同期契約と元Processの終了待ちを確認する。
 * @responsibility 不正返却の拒否捕捉を既存の終了経路へ接続する。
 * @trace ERB-IT-002
 * @precondition 模擬子・模擬終了補助だけを使用する。
 * @stimulus 同期void、throw、Promise成功・即時拒否・後着拒否・pending、値返却を渡す。
 * @observation 終了要求数、元close、出力失敗flag、後着後の不変。
 * @oracle 正常void以外は即時に終了要求し、close前に終了成立を返さない。
 * @cleanup 既存fixtureが両模擬子をcloseしBuiltinを復元する。
 * @boundary 同期stdout搬送と所有Process。実Docker・実Processの成功は対象外。
 */
test("stdout観測は非同期返却を待たず失敗にして後着拒否を捕捉する", async (t) => {
  for (const mode of [
    "normal",
    "throw",
    "resolved",
    "reject",
    "late_reject",
    "pending",
    "value",
  ] as const) {
    await t.test(mode, async (context) => {
      const fixture = processFixture(context);
      let rejectLate: ((error: Error) => void) | undefined;
      const handle = startOwnedWindowsProcess(
        binding.executable,
        [],
        binding.environment(),
        null,
        {
          observeStdout: () => {
            if (mode === "throw") throw Error("synthetic_observer_failure");
            if (mode === "resolved") return Promise.resolve();
            if (mode === "reject")
              return Promise.reject(Error("synthetic_observer_reject"));
            if (mode === "late_reject")
              return new Promise<void>((_resolve, reject) => {
                rejectLate = reject;
              });
            if (mode === "pending") return new Promise<void>(() => {});
            if (mode === "value") return 1;
          },
        },
      );
      fixture.child.emit("spawn");
      assert.equal(await handle.started(100), true);
      fixture.child.stdout?.write("synthetic\n");
      assert.equal(handle.terminationRequested?.(), mode !== "normal");
      assert.equal(handle.closed(), false);
      assert.equal(fixture.calls.length, mode === "normal" ? 1 : 2);
      fixture.child.emit("close", 0, null);
      fixture.helper.emit("close", 0, null);
      const result = await handle.wait(100);
      assert.ok(result);
      assert.equal(result.outputExceeded, mode !== "normal");
      assert.equal(handle.closed(), true);
      rejectLate?.(Error("synthetic_late_observer_reject"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(fixture.calls.length, mode === "normal" ? 1 : 2);
      assert.equal(await handle.wait(100), result);
    });
  }
});

/**
 * probeの内部観測が非同期返却を隠さず共通Process Ownerへ渡すことを確認する。
 * @responsibility 不正な同chunkからreadyを成立させず、既知readyは巻き戻さない。
 * @trace ERB-IT-002
 * @precondition 本番startAttached本文とメモリ内のProcess接続代役を使用する。
 * @stimulus 正常void、Promise、値返却をstdout観測へ渡す。
 * @observation 外側へ渡す同じ返却値、同期prefixのready、元completion。
 * @oracle 不正返却を消さず外側へ返し、Promiseの完了をready根拠にしない。
 * @cleanup N/A: I/O・Process・Timerを生成しない。
 * @boundary probe内部搬送。共通Processの失敗／終端は別の上記試験で検証する。
 */
test("probe観測は不正返却を外側へ渡し同期readyだけを保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/probe/process.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf("function startAttached(");
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin > 0 && end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end));
  for (const mode of ["normal", "promise", "value"] as const) {
    let observeOutput: ((value: Buffer) => unknown) | undefined;
    let resolveCompletion!: (value: CommandExecution) => void;
    const completion = new Promise<CommandExecution>((resolve) => {
      resolveCompletion = resolve;
    });
    const start = runInNewContext(`${body}; startAttached`, {
      Buffer,
      startOwnedWindowsProcess: (
        _exe: string,
        _args: readonly string[],
        _env: unknown,
        _stdin: unknown,
        options: { observeStdout: (value: Buffer) => unknown },
      ) => {
        observeOutput = options.observeStdout;
        return {
          started: async () => true,
          wait: () => completion,
          closed: () => false,
          terminateAndWait: async () => true,
        };
      },
    });
    let observerResult: unknown =
      mode === "promise" ? Promise.resolve() : mode === "value" ? 1 : undefined;
    const attached: DockerAttachedProcess = start(
      "fixed",
      [],
      {},
      "ready\n",
      () => observerResult,
    );
    assert.ok(observeOutput);
    assert.equal(observeOutput(Buffer.from("ready\n")), observerResult);
    let observedReady: boolean | null = null;
    void attached.ready.then((value) => {
      observedReady = value;
    });
    await Promise.resolve();
    assert.equal(observedReady, mode === "normal" ? true : null);
    if (mode === "normal") {
      observerResult = Promise.resolve();
      assert.equal(observeOutput(Buffer.from("next\n")), observerResult);
      assert.equal(await attached.ready, true);
    }
    resolveCompletion({
      status: 0,
      signal: null,
      stdout: "",
      stderr: "",
      outputExceeded: false,
    });
    await attached.completion;
    assert.equal(await attached.ready, mode === "normal");
  }
});

/**
 * 固定TreeのPID観測を狭い閉集合として確認する。
 * @responsibility 任意scenario、重複PID、余分な出力を拒否する。
 * @trace ERB-IT-002
 * @precondition 模擬所有子だけを使用する。
 * @stimulus 固定markerと正常・不正tupleを搬送する。
 * @observation PID tuple、元子と補助子のclose。
 * @oracle 二つの相異なる正safe integerだけを観測する。
 * @cleanup 両模擬子をcloseしBuiltinを戻す。
 * @boundary 固定Tree診断と元所有Handle。
 */
test("固定TreeのPID観測は二要素だけを受理し終了要求を重複発行しない", async (context) => {
  const fixture = processFixture(context);
  assert.throws(() =>
    startOwnedAttachTerminationFixture(
      "unknown" as "ready_tree",
      binding.environment(),
    ),
  );
  assert.equal(fixture.calls.length, 0);
  const handle = startOwnedAttachTerminationFixture(
    "ready_tree",
    binding.environment(),
  );
  fixture.child.emit("spawn");
  fixture.child.stdout?.write("crdd-owned-");
  fixture.child.stdout?.write("attach-ready\n[1234,");
  fixture.child.stdout?.write("5678]");
  fixture.child.stdout?.write("\n");
  assert.equal(await handle.ready, true);
  assert.deepEqual(handle.observedTreeProcessIds(), [1234, 5678]);
  const first = handle.terminateAndWait();
  const second = handle.terminateAndWait();
  assert.equal(first, second);
  fixture.child.emit("close", null, null);
  assert.equal(handle.isClosed(), false);
  fixture.helper.emit("close", 0, null);
  assert.ok(await first);
  assert.equal(handle.getTerminationRequestCount(), 1);
  assert.equal(handle.isClosed(), true);
});

for (const tuple of [
  "[1,1]",
  "[0,2]",
  "[1,2,3]",
  '[1,"2"]',
  "[1,9007199254740992]",
  "[1,2]\nextra",
  `${"x".repeat(257)}\ncrdd-owned-attach-ready\n[1,2]`,
]) {
  /**
   * 不正PID tupleを不存在観測の根拠にしない。
   * @responsibility 不正・余剰観測をnullへ保持する。
   * @trace ERB-IT-002
   * @precondition 模擬子を使用する。
   * @stimulus 不正tupleを搬送する。
   * @observation 狭いPID getter。
   * @oracle nullとなり任意PIDは発行されない。
   * @cleanup 模擬closeとBuiltin復元。
   * @boundary 固定診断出力と観測tuple。
   */
  test(`固定Treeは不正PID tupleを拒否する: ${tuple}`, async (context) => {
    const fixture = processFixture(context);
    const handle = startOwnedAttachTerminationFixture(
      "ready_tree",
      binding.environment(),
    );
    fixture.child.emit("spawn");
    fixture.child.stdout?.write(`crdd-owned-attach-ready\n${tuple}\n`);
    assert.equal(handle.observedTreeProcessIds(), null);
    fixture.child.emit("close", 0, null);
    await handle.completion;
  });
}

/**
 * 作成結果と直後inspectの構成を同じ元Planへ結合する。
 * @responsibility create成功だけから保存可能Receiptを発行しない。
 * @trace ERB-IT-002
 * @precondition 各模擬Processは個別streamとcloseを持つ。
 * @stimulus 元createの実ID、直後inspect正常値または別実IDを搬送する。
 * @observation 固定二要求、構成確認とReceipt。
 * @oracle 全一致時だけ実IDReceiptを返し、別実IDは未確認として保持する。
 * @cleanup Builtinを復元し全模擬Processを終了する。
 * @boundary create結果→即時inspect→技術Receipt。
 */
test("認証NetworkのReceiptはcreateと即時inspectの実ID・構成一致後だけ返る", async (context) => {
  const original = childProcess.spawn;
  context.after(() => {
    childProcess.spawn = original;
    syncBuiltinESMExports();
  });
  for (const matches of [true, false]) {
    const input = authenticationInput();
    const plan = planDockerAuthenticationCommands(input);
    assert.equal(
      plan.commands.some((item) =>
        item.argv.some((arg) => arg.startsWith("--pids-limit")),
      ),
      false,
    );
    const command = plan.commands.find(
      (item) => item.purpose === "create_internal_network",
    );
    assert.ok(command);
    const id = "c".repeat(64);
    const calls: string[][] = [];
    childProcess.spawn = ((_file: string, argv: string[]) => {
      calls.push(argv);
      const child = Object.assign(new EventEmitter(), {
        pid: 1234,
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      });
      queueMicrotask(() => {
        child.emit("spawn");
        child.stdout.write(
          calls.length === 1
            ? id
            : JSON.stringify([
                {
                  Id: matches ? id : "d".repeat(64),
                  Name: input.internalNetworkName,
                  Labels: { "crdd.coordinator.authentication": "1".repeat(16) },
                  Driver: "bridge",
                  Scope: "local",
                  Internal: true,
                },
              ]),
        );
        child.emit("close", 0, null);
      });
      return child;
    }) as unknown as typeof childProcess.spawn;
    syncBuiltinESMExports();
    const runtime = createDockerAuthenticationRuntime(
      { ...binding, workingDirectory: "C:\\Windows\\System32" },
      plan,
    );
    const result = await runtime.execute(command, () => true);
    assert.equal(calls.length, 2);
    assert.equal(result.processCompletionConfirmed, true);
    assert.equal(result.resourceCreationConfirmed, matches);
    assert.deepEqual(
      result.resourceReceipt,
      matches ? { name: input.internalNetworkName, dockerId: id } : undefined,
    );
    if (!matches)
      assert.equal(
        result.error?.message,
        "docker_authentication_creation_unconfirmed",
      );
    const recovery = planDockerAuthenticationResourceRecovery(
      plan,
      input.internalNetworkName,
      id,
    );
    await assert.rejects(
      runtime.execute(recovery.cleanupCommand, () => true),
      /removal_not_observed/u,
    );
    const observation = await runtime.execute(
      recovery.ownershipCommand,
      () => true,
    );
    assert.equal(observation.resourceConfigurationConfirmed, matches);
    if (matches) {
      const removed = await runtime.execute(
        recovery.cleanupCommand,
        () => true,
      );
      assert.equal(removed.processCompletionConfirmed, true);
      assert.deepEqual(calls.at(-1)?.slice(2), ["network", "rm", id]);
      await assert.rejects(
        runtime.execute(recovery.cleanupCommand, () => true),
        /removal_not_observed/u,
      );
    } else
      await assert.rejects(
        runtime.execute(recovery.cleanupCommand, () => true),
        /removal_not_observed/u,
      );
    await assert.rejects(
      runtime.execute(
        plan.cleanupCommands[3] as NonNullable<
          (typeof plan.cleanupCommands)[3]
        >,
        () => true,
      ),
      /removal_not_observed/u,
    );
  }
});

/**
 * 認証技術計画の固定入力を構築する。
 * @responsibility 秘密値・実資源・Provider意味を使わない入力を渡す。
 * @trace ERB-IT-002
 * @precondition 実認証の成功根拠として使用しない。
 * @stimulus 固定名・digest・Homeと非秘密CLIを構築する。
 * @observation 下位固定Planへ渡す技術値。
 * @oracle 呼出しTestが構成と元Commandの照合を確認する。
 * @cleanup N/A: 実資源なし。
 * @boundary 計画と下位Command相関。
 */
function authenticationInput(): Extract<
  DockerAuthenticationInput,
  { action: "login" }
> {
  const suffix = "1".repeat(16);
  return {
    action: "login",
    providerHomeSourcePath: "C:\\fixture\\home",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    ownershipLabel: `crdd.coordinator.authentication=${suffix}`,
    internalNetworkName: `crdd-internal-${suffix}`,
    egressNetworkName: `crdd-egress-${suffix}`,
    proxyContainerName: `crdd-proxy-${suffix}`,
    loginContainerName: `crdd-claude-${suffix}`,
    probeContainerName: `crdd-auth-${suffix}`,
    proxyToken: "2".repeat(64),
    proxyPort: 3128,
    proxyProfile: "claude",
    authenticationCli: {
      loginArgv: ["auth", "login"],
      statusArgv: ["auth", "status"],
      environment: { CI: "true" },
    },
  };
}

/**
 * 認証計画の固定隔離と元Command照合を確認する。
 * @responsibility コピーCommandを下位生成済み操作として認定しない。
 * @trace ERB-IT-002
 * @precondition 固定技術入力だけを使用する。
 * @stimulus 計画生成とCaller payloadの後発変更。
 * @observation 操作順序、対話方式、元Command相関、凍結argv。
 * @oracle 九開始操作と五資源、対話一操作、元だけ照合、後発変更なし。
 * @cleanup N/A: 計画のみ。
 * @boundary 認証技術Planと実行前相関。
 */
test("認証固定PlanはHomeだけを接続し元Commandを凍結する", () => {
  const input = authenticationInput();
  const plan = planDockerAuthenticationCommands(input);
  assert.equal(plan.commands.length, 9);
  assert.equal(plan.cleanupCommands.length, 5);
  assert.deepEqual(
    plan.commands.filter((c) => c.interactive).map((c) => c.purpose),
    ["start_login_attached"],
  );
  const command = plan.commands.find((c) => c.purpose === "create_login");
  assert.ok(command);
  assert.equal(command.argv.filter((v) => v === "--mount").length, 1);
  assert.ok(command.argv.includes("--read-only"));
  assert.equal(dockerAuthenticationCommandIsPlanned(command), true);
  assert.equal(dockerAuthenticationCommandIsPlanned({ ...command }), false);
  (input.authenticationCli.loginArgv as string[]).push("changed");
  assert.equal(command.argv.includes("changed"), false);
  assert.equal(Object.isFrozen(command.argv), true);
});

/**
 * 認証技術入力のgetter・設定上書き・別名を拒否する。
 * @responsibility 固定隔離の上書きと未評価入力を計画へ搬送しない。
 * @trace ERB-IT-002
 * @precondition 不正入力だけを使用する。
 * @stimulus Resource名差替え、HOME上書き、配列getter。
 * @observation 拒否とgetter実行数。
 * @oracle 計画不成立、getter0。
 * @cleanup N/A: 実Effectなし。
 * @boundary 不正payloadと固定Plan。
 */
test("認証固定Planは名前差替えと環境上書きとgetterを拒否する", () => {
  const input = authenticationInput();
  assert.throws(() =>
    planDockerAuthenticationCommands({
      ...input,
      loginContainerName: "foreign",
    }),
  );
  assert.throws(() =>
    planDockerAuthenticationCommands({
      ...input,
      authenticationCli: {
        ...input.authenticationCli,
        environment: { HOME: "foreign" },
      },
    }),
  );
  let calls = 0;
  const argv = ["auth", "login"];
  Object.defineProperty(argv, "1", {
    get: () => {
      calls += 1;
      return "login";
    },
    enumerable: true,
  });
  assert.throws(() =>
    planDockerAuthenticationCommands({
      ...input,
      authenticationCli: { ...input.authenticationCli, loginArgv: argv },
    }),
  );
  assert.equal(calls, 0);
});

/**
 * 許可喪失を共通tree終端と両closeへ接続する。
 * @responsibility 認証の上位意味を持たず技術終了を観測する。
 * @trace ERB-IT-002
 * @precondition 模擬Processと生成済みCommandだけを使用する。
 * @stimulus 開始後に許可観測をfalseへ切替え、元子と補助子をcloseする。
 * @observation 固定argv、終端要求、一次理由、終了確認。
 * @oracle 許可喪失を保持し、両close後だけ終了確認true。
 * @cleanup Fixture hookと実装のTimer回収。
 * @boundary 許可生存観測→所有Process。
 */
test("認証Processは許可喪失後に元子と終端補助子をjoinする", async (context) => {
  const fixture = processFixture(context);
  const plan = planDockerAuthenticationCommands(authenticationInput());
  const command = plan.commands[0];
  assert.ok(command);
  let live = true;
  const runtime = createDockerAuthenticationRuntime(
    { ...binding, workingDirectory: "C:\\Windows\\System32" },
    plan,
  );
  const resultPromise = runtime.execute(command, () => live);
  fixture.child.emit("spawn");
  live = false;
  await delay(300);
  assert.equal(fixture.calls.length, 2);
  fixture.child.emit("close", null, "SIGTERM");
  fixture.helper.emit("close", 0, null);
  const result = await resultPromise;
  assert.equal(result.error?.message, "docker_execution_permit_lost");
  assert.equal(result.processCompletionConfirmed, true);
  assert.equal(result.signal, "SIGTERM");
});

/**
 * 元Commandと開始前許可の拒否を確認する。
 * @responsibility 任意Commandやfalse許可でProcessを作らない。
 * @trace ERB-IT-002
 * @precondition 模擬Processと元計画を使用する。
 * @stimulus Commandコピーと開始前のfalse許可。
 * @observation spawn数と固定停止理由。
 * @oracle spawn0、拒否と終了後不存在を混同しない。
 * @cleanup Fixture hook。
 * @boundary 固定計画の元相関と開始Gate。
 */
test("認証ProcessはコピーCommandと開始前許可喪失でEffect0", async (context) => {
  const fixture = processFixture(context);
  const plan = planDockerAuthenticationCommands(authenticationInput());
  const command = plan.commands[0];
  assert.ok(command);
  const configured = { ...binding, workingDirectory: "C:\\Windows\\System32" };
  const runtime = createDockerAuthenticationRuntime(configured, plan);
  assert.throws(
    () => createDockerAuthenticationRuntime(configured, { ...plan }),
    /plan_not_planned/u,
  );
  const other = planDockerAuthenticationCommands(authenticationInput())
    .commands[0];
  assert.ok(other);
  await assert.rejects(
    runtime.execute(other, () => true),
    /command_not_planned/u,
  );
  await assert.rejects(
    runtime.execute({ ...command }, () => true),
    /command_not_planned/u,
  );
  const result = await runtime.execute(command, () => false);
  assert.equal(result.error?.message, "docker_execution_permit_lost");
  assert.equal(result.processCompletionConfirmed, true);
  assert.equal(fixture.calls.length, 0);
});

/**
 * 対話認証のinheritと秘密出力非捕捉を確認する。
 * @responsibility 対話Commandと捕捉Commandのstdioを混在させない。
 * @trace ERB-IT-002
 * @precondition stdioなしの模擬対話Processと元Plan。
 * @stimulus 対話Commandのspawnとclose。
 * @observation 固定Engine、stdio、出力と終了確認。
 * @oracle inherit、空出力、close後確認true。
 * @cleanup Fixture hookとTimer回収。
 * @boundary 対話端末の技術搬送。
 */
test("認証対話は共通Ownerのinherit方式で捕捉0", async (context) => {
  const fixture = processFixture(context, true);
  const plan = planDockerAuthenticationCommands(authenticationInput());
  const command = plan.commands.find(
    (c) => c.purpose === "start_login_attached",
  );
  assert.ok(command);
  const runtime = createDockerAuthenticationRuntime(
    { ...binding, workingDirectory: "C:\\Windows\\System32" },
    plan,
  );
  const resultPromise = runtime.execute(command, () => true);
  const argv = fixture.calls[0]?.[1] as string[] | undefined;
  assert.deepEqual(argv?.slice(0, 2), [
    "-H",
    "npipe:////./pipe/dockerDesktopLinuxEngine",
  ]);
  assert.equal(
    (fixture.calls[0]?.[2] as { stdio?: string } | undefined)?.stdio,
    "inherit",
  );
  fixture.child.emit("spawn");
  fixture.child.emit("close", 0, null);
  const result = await resultPromise;
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.equal(result.processCompletionConfirmed, true);
});

/**
 * 同期診断の固定引数と元Process失敗を確認する。
 * @responsibility error、Status、stderrを不存在へ分類しない。
 * @trace ERB-IT-002
 * @precondition spawnSyncを局所差替えする。
 * @stimulus 固定inspectを発行し失敗結果を返す。
 * @observation 固定Engine、実ID、上限、元結果。
 * @oracle 一回発行・shellなし・同じerror保持。
 * @cleanup 元Builtinを戻す。
 * @boundary 固定同期Docker Process。
 */
test("同期診断は固定引数を構築し一次Process失敗を保持する", (context) => {
  const original = childProcess.spawnSync;
  const failure = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
  const calls: unknown[][] = [];
  childProcess.spawnSync = ((...args: unknown[]) => {
    calls.push(args);
    return {
      status: null,
      signal: "SIGTERM",
      stdout: "",
      stderr: "diagnostic",
      error: failure,
    };
  }) as unknown as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  context.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  const verifiedBinding = {
    ...binding,
    executable: "unverified.exe",
    verifyCli: () => binding.executable,
  };
  const result = executeDockerProbeCommand(
    verifiedBinding,
    { purpose: "inspect", containerId: "a".repeat(64) },
    10_000,
  );
  assert.deepEqual(calls[0]?.[1], [
    "-H",
    "npipe:////./pipe/dockerDesktopLinuxEngine",
    "container",
    "inspect",
    "a".repeat(64),
  ]);
  assert.equal(calls[0]?.[0], binding.executable);
  const options = calls[0]?.[2] as {
    shell?: boolean;
    maxBuffer?: number;
    timeout?: number;
  };
  assert.equal(options.shell, false);
  assert.equal(options.maxBuffer, 65536);
  assert.equal(options.timeout, 10_000);
  assert.equal(result.error, failure);
  assert.equal(result.signal, "SIGTERM");
  assert.equal(result.stderr, "diagnostic");
});

/**
 * 同期診断の不正入力と環境観測順序を確認する。
 * @responsibility accessorや任意argvを開始許可にしない。
 * @trace ERB-IT-002
 * @precondition Processを発行しない負例を使用する。
 * @stimulus 不正purpose・ID・getter・timeoutとCLI失敗。
 * @observation getter実行数、環境とCLI確認順序。
 * @oracle 全不正が開始前拒否、getter0、環境snapshot後にCLI確認。
 * @cleanup N/A: 実資源なし。
 * @boundary 技術入力と同期Effect Gate。
 */
test("同期診断は不正用途とaccessorをEffect前に拒否する", () => {
  let getterCalls = 0;
  const getter = Object.defineProperty({}, "purpose", {
    get: () => {
      getterCalls += 1;
      return "version";
    },
  });
  for (const command of [
    getter,
    { purpose: "shell", containerId: "a".repeat(64) },
    { purpose: "remove", containerId: "name" },
    { purpose: "version", argv: ["run"] },
  ])
    assert.throws(() => planDockerProbeCommand(command as DockerProbeCommand));
  assert.equal(getterCalls, 0);
  const sequence: string[] = [];
  assert.throws(() =>
    executeDockerProbeCommand(
      {
        ...binding,
        environment: () => {
          sequence.push("environment");
          return binding.environment();
        },
        verifyCli: () => {
          sequence.push("cli");
          throw Error("stale");
        },
      },
      { purpose: "version" },
      10_000,
    ),
  );
  assert.deepEqual(sequence, ["environment", "cli"]);
  assert.throws(() =>
    executeDockerProbeCommand(binding, { purpose: "version" }, 0),
  );
});

/**
 * 診断createと三種の不存在観測引数を確認する。
 * @responsibility 固定隔離構成とFilterを上位argvから独立させる。
 * @trace ERB-IT-002
 * @precondition 自己生成不要の絶対Path文字列を使用する。
 * @stimulus createとID／名／Label観測を構築する。
 * @observation 固定Image・制限・Mount・Filter。
 * @oracle 特権や追加引数を受けず、既存構成を保持する。
 * @cleanup N/A: 計画のみ。
 * @boundary 技術計画と固定Docker argv。
 */
test("同期診断のcreateと不存在Filterを閉じた用途から構築する", () => {
  const probeId = "11111111-1111-4111-8111-111111111111";
  const argv = planDockerProbeCommand({
    purpose: "create",
    probeId,
    source: "print('fixed')",
    mounts: {
      workspace: "C:\\fixture\\work",
      providerHome: "C:\\fixture\\home",
      tmp: "C:\\fixture\\tmp",
    },
  });
  for (const value of [
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user=65532:65532",
  ])
    assert.ok(argv.includes(value));
  assert.equal(argv.filter((v) => v === "--mount").length, 3);
  assert.equal(
    planDockerProbeCommand({ purpose: "list_name", probeId }).at(-1),
    `name=^/crdd-coordinator-probe-${probeId}$`,
  );
  assert.equal(
    planDockerProbeCommand({ purpose: "list_label", probeId }).at(-1),
    `label=crdd.coordinator.probe=${probeId}`,
  );
  assert.equal(
    planDockerProbeCommand({
      purpose: "list_id",
      containerId: "a".repeat(64),
    }).at(-1),
    `id=${"a".repeat(64)}`,
  );
});

/**
 * 不正入力とfresh CLI拒否の前Effect 0を確認する。
 * @responsibility 名前や任意argvへのfallbackを拒否する。
 * @trace ERB-IT-002
 * @precondition Process Fixtureを使用する。
 * @stimulus 不正IDと検証失敗を渡す。
 * @observation spawn回数。
 * @oracle 全拒否でspawn0。
 * @cleanup Fixture hook。
 * @boundary 固定入力とProcess開始。
 */
test("attachは実IDとfresh CLI確認前にProcessを開始しない", (context) => {
  const fixture = processFixture(context);
  assert.throws(() =>
    startDockerProbeAttachedProcess(binding, "name", "ready\n"),
  );
  assert.throws(() =>
    startDockerProbeAttachedProcess(
      {
        ...binding,
        verifyCli: () => {
          throw Error("stale");
        },
      },
      "a".repeat(64),
      "ready\n",
    ),
  );
  assert.equal(fixture.calls.length, 0);
});

/**
 * 固定attach構成と分割ready出力を確認する。
 * @responsibility readyを終了結果へ読み替えない。
 * @trace ERB-IT-002
 * @precondition 模擬捕捉子を使用する。
 * @stimulus spawn、分割stdout、closeを順に送る。
 * @observation argv、ready、close、結果。
 * @oracle ready後も未close、close後だけ完了状態。
 * @cleanup Fixture hook。
 * @boundary 同じ子Processの独立通知。
 */
test("attachは固定Engineと実IDを使いreadyとcloseを分離する", async (context) => {
  const fixture = processFixture(context);
  const handle = startDockerProbeAttachedProcess(
    binding,
    "a".repeat(64),
    "ready\n",
  );
  assert.deepEqual(fixture.calls[0]?.[1], [
    "-H",
    "npipe:////./pipe/dockerDesktopLinuxEngine",
    "start",
    "--attach",
    "a".repeat(64),
  ]);
  fixture.child.emit("spawn");
  fixture.child.stdout?.write("rea");
  fixture.child.stdout?.write("dy\n");
  assert.equal(await handle.started, true);
  assert.equal(await handle.ready, true);
  assert.equal(handle.isClosed(), false);
  fixture.child.emit("close", 0, null);
  assert.equal((await handle.completion).status, 0);
  assert.equal(handle.isClosed(), true);
});

/**
 * errorを終了証明にせず補助子closeまで待つことを確認する。
 * @responsibility ready失敗・一次error・tree終端を独立に観測する。
 * @trace ERB-IT-002
 * @precondition 模擬子と終了補助子を使用する。
 * @stimulus error、取消、元子close、補助子close。
 * @observation 結果、closed、終端要求数。
 * @oracle errorでは未close、両close後に同じ失敗結果を返す。
 * @cleanup Fixture hook。
 * @boundary 元子とtaskkill補助子。
 */
test("attach error後も元子と終端補助子のcloseを保持する", async (context) => {
  const fixture = processFixture(context);
  const handle = startDockerProbeAttachedProcess(
    binding,
    "a".repeat(64),
    "ready\n",
  );
  fixture.child.emit("error", Error("transport"));
  assert.equal(await handle.ready, false);
  assert.equal((await handle.completion).status, null);
  assert.equal(handle.isClosed(), false);
  const termination = handle.terminateAndWait();
  fixture.child.emit("close", null, null);
  assert.equal(handle.isClosed(), false);
  fixture.helper.emit("close", 0, null);
  assert.equal((await termination)?.status, null);
  assert.equal(handle.isClosed(), true);
  assert.equal(handle.getTerminationRequestCount(), 1);
});

/**
 * 診断の64KiB上限から共通tree終端への接続を確認する。
 * @responsibility 出力超過を成功または無制限捕捉にしない。
 * @trace ERB-IT-002
 * @precondition 模擬捕捉子を使用する。
 * @stimulus 64KiBを超すstdoutと両close。
 * @observation 出力、超過flag、終端回数。
 * @oracle 超過出力未保存、終端一回、全close。
 * @cleanup Fixture hook。
 * @boundary 出力搬送とProcess回収。
 */
test("attach出力超過は保存せず共通tree終端へ接続する", async (context) => {
  const fixture = processFixture(context);
  const handle = startDockerProbeAttachedProcess(
    binding,
    "a".repeat(64),
    "ready\n",
  );
  fixture.child.emit("spawn");
  fixture.child.stdout?.write(Buffer.alloc(64 * 1024 + 1, "x"));
  fixture.child.emit("close", null, "SIGTERM");
  fixture.helper.emit("close", 0, null);
  const result = await handle.completion;
  assert.equal(result.outputExceeded, true);
  assert.equal(result.stdout, "");
  assert.equal(handle.getTerminationRequestCount(), 1);
  assert.equal(handle.isClosed(), true);
});

/**
 * 対話stdioを捕捉しない共通Ownerを確認する。
 * @responsibility inherit方式を非対話出力と混在させない。
 * @trace ERB-IT-002
 * @precondition stdio=nullの模擬対話子を使用する。
 * @stimulus 対話構成、spawn、close。
 * @observation stdio、cwd、開始、空出力。
 * @oracle inheritで開始し出力捕捉0、無効callbackは開始前拒否。
 * @cleanup Fixture hook。
 * @boundary 対話端末と所有Process。
 */
test("対話Processは端末inheritと空出力を維持する", async (context) => {
  const fixture = processFixture(context, true);
  assert.throws(() =>
    startOwnedWindowsProcess(
      binding.executable,
      [],
      binding.environment(),
      null,
      { interactive: true, observeStdout: () => undefined },
    ),
  );
  assert.equal(fixture.calls.length, 0);
  const handle = startOwnedWindowsProcess(
    binding.executable,
    [],
    binding.environment(),
    null,
    { interactive: true, workingDirectory: "C:\\Windows\\System32" },
  );
  const options = fixture.calls[0]?.[2] as { stdio?: string } | undefined;
  assert.equal(options?.stdio, "inherit");
  fixture.child.emit("spawn");
  assert.equal(await handle.started(10), true);
  fixture.child.emit("close", 0, null);
  const result = await handle.wait(10);
  assert.equal(result?.stdout, "");
  assert.equal(result?.stderr, "");
  assert.equal(handle.closed(), true);
});
