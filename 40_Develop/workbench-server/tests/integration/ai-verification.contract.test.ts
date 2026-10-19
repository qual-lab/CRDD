/**
 * 読取り助言の試験器を外部AIなしで検証する。
 * @packageDocumentation
 * @responsibility 有限代役と公開HTTPで診断・原失敗・回収の相関を検証する。
 * @trace ERB-IT-021
 * @level IT
 * @scope Docker比較、公開HTTP搬送、一次失敗と終了観測。
 * @boundary 合成inventory／有限Owner→正式試験Source。実Provider成功の根拠ではない。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { verifyWorkspaceOutputBytes } from "../../scripts/workspace-output-verification.ts";
import path, { join } from "node:path";
import {
  gitRepositoryRevisionAdapter,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  startWorkbench,
  readWorkbenchProjectSurface,
} from "../../src/index.ts";
import {
  assessVerificationDockerInventory,
  createWorkbenchAiVerificationHttpClient,
  projectVerificationTransportFailure,
  type VerificationDockerInventory,
} from "../../scripts/ai-verification-http.ts";

/**
 * 編集試験の失敗後処置を実本文と有限Ownerで確認する。
 * @trace ERB-IT-021
 * @precondition HTTP・AI・Docker・Filesystem書込みを代役へ置く。
 * @stimulus 受付前／受付応答不明、観測失敗、取消成功・未確認・例外、close失敗。
 * @observation 同じIDの取消回数、終了順序、一次診断と回収結果。
 * @oracle Task再送0、取消最大1、取消結果を待ってclose、不明を清掃成功にしない。
 * @cleanup VMのPromiseをすべて完了する。実資源なし。
 * @responsibility 編集試験の失敗後処置を実本文と有限Ownerで確認する。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("Workspace試験は通信失敗後に同じTaskの取消結果を保存してから閉じる", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/verify-workspace-ai.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("  const workspaceId = randomUUID();");
  const end = source.indexOf("\n  return evidence;", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(
    `(async () => { ${source.slice(start, end)}\nreturn evidence; })()`,
  );
  for (const scenario of [
    "success",
    "before-accept",
    "accept-unknown",
    "cancel-clean",
    "cancel-unknown",
    "cancel-throws",
    "cancel-running",
    "cancel-secondary",
    "cancel-secondary-missing",
    "cancel-other-id",
    "close-fails",
  ]) {
    let starts = 0;
    let observes = 0;
    const events: string[] = [];
    const transport = new Error("workbench_verification_transport_failed", {
      cause: {
        failureClass: "headers_unobserved",
        timedOut: true,
        transportCode: "ECONNRESET",
        secret: "synthetic-secret",
      },
    });
    const snapshot = {
      requestId: "request-synthetic",
      status: "blocked",
      reason: "synthetic_failure",
      cleanupConfirmed: true,
      recoveryIds: [],
      secondaryFailures: [],
    };
    const result = await runInNewContext(body, {
      Error,
      Buffer,
      verifyWorkspaceOutputBytes,
      assert,
      path,
      mode: "direct",
      root: "synthetic-root",
      parent: "synthetic-parent",
      base: "base",
      preflight: false,
      projectId: "synthetic",
      randomUUID: () => "workspace-id",
      hash: () => "fixed-hash",
      projectVerificationTransportFailure,
      git: (_root: string, args: string[]) =>
        args[0] === "rev-parse" ? "base" : "staged.txt",
      fs: {
        readFileSync: (file: string, encoding?: string) => {
          const content =
            {
              "source.txt": "DIRECT_OK\n",
              "dirty.txt": "EXISTING_DIRTY\n",
              "staged.txt": "EXISTING_STAGE\n",
              "unselected.txt": "EXISTING_UNTRACKED\n",
            }[path.basename(file)] ?? "index";
          return encoding ? content : Buffer.from(content);
        },
      },
      requestBounded: () => {
        throw new Error("unexpected_workspace_operation");
      },
      readMain: async () => ({ actionToken: "synthetic" }),
      createWorkbenchAiVerificationHttpClient: async () => ({
        start: async () => {
          starts++;
          if (scenario === "before-accept") throw transport;
          if (scenario === "accept-unknown")
            throw new Error("workbench_ai_http_start_outcome_unknown");
          return { status: "accepted", requestId: snapshot.requestId };
        },
        observe: async () => {
          observes++;
          if (scenario !== "success") throw transport;
          return {
            ...snapshot,
            status: "completed",
            executionStatus: "completed",
            workspaceResult: {
              workspaceId: null,
              changedPaths: ["source.txt"],
            },
          };
        },
        cancel: async () => {
          throw new Error("unexpected_http_retry");
        },
      }),
      owner: {
        cancel: async (id: string) => {
          assert.equal(id, snapshot.requestId);
          events.push("cancel");
          await Promise.resolve();
          events.push("cancel-result");
          if (scenario === "cancel-throws") throw new Error("synthetic-secret");
          if (scenario === "cancel-other-id")
            return { ...snapshot, requestId: "other" };
          if (scenario === "cancel-unknown")
            return {
              ...snapshot,
              status: "unknown",
              cleanupConfirmed: false,
              recoveryIds: ["recovery-synthetic"],
            };
          if (scenario === "cancel-running")
            return { ...snapshot, status: "running" };
          if (scenario === "cancel-secondary")
            return { ...snapshot, secondaryFailures: ["synthetic_secondary"] };
          if (scenario === "cancel-secondary-missing")
            return { ...snapshot, secondaryFailures: undefined };
          return snapshot;
        },
      },
      handle: {
        baseUrl: "http://synthetic.invalid",
        close: async () => {
          events.push("close");
          if (scenario === "close-fails") throw new Error("synthetic-secret");
        },
      },
    });
    assert.equal(starts, 1, scenario);
    assert.equal(
      observes,
      ["before-accept", "accept-unknown"].includes(scenario) ? 0 : 1,
      scenario,
    );
    if (["success", "before-accept", "accept-unknown"].includes(scenario))
      assert.deepEqual(events, ["close"], scenario);
    else
      assert.deepEqual(events, ["cancel", "cancel-result", "close"], scenario);
    assert.equal(result.limitedProbePassed, scenario === "success", scenario);
    if (scenario !== "success") assert.ok(result.primaryFailure);
    if (!["success", "accept-unknown"].includes(scenario)) {
      assert.equal(
        result.primaryFailure,
        "workbench_verification_transport_failed",
      );
      assert.equal(result.transportFailure.timedOut, true);
      assert.equal(result.transportFailure.transportCode, "ECONNRESET");
    }
    assert.equal(
      result.runtimeClean,
      ["success", "cancel-clean", "close-fails"].includes(scenario),
      scenario,
    );
    assert.equal(result.closeConfirmed, scenario !== "close-fails");
    if (scenario === "cancel-unknown")
      assert.equal(result.task.recoveryIds[0], "recovery-synthetic");
    if (scenario === "cancel-secondary")
      assert.equal(result.task.secondaryFailures[0], "synthetic_secondary");
    if (scenario === "cancel-secondary-missing")
      assert.equal(result.task.secondaryFailures, undefined);
    if (["cancel-throws", "cancel-other-id"].includes(scenario))
      assert.equal(
        result.cancellationFailure,
        "workspace_verification_cancel_unconfirmed",
      );
    assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
  }
});

/**
 * 通信例外は許可済み分類だけを保持する。
 * @trace ERB-IT-021
 * @precondition 合成例外のみ。外部接続なし。
 * @stimulus 既知／未知code、自由なmessage・cause。
 * @observation 投影JSON。
 * @oracle URL・秘密本文・未知codeを出力しない。
 * @cleanup N/A: 同期判定。
 * @responsibility 通信例外は許可済み分類だけを保持する。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("通信診断は未知codeと自由な例外本文を保存しない", () => {
  assert.equal(
    projectVerificationTransportFailure(new Error("synthetic-secret")),
    null,
  );
  const result = projectVerificationTransportFailure(
    new Error("workbench_verification_transport_failed", {
      cause: {
        failureClass: "headers_unobserved",
        timedOut: false,
        transportCode: "synthetic-secret",
        url: "synthetic-secret",
      },
    }),
  );
  assert.equal(result?.transportCode, null);
  assert.equal(result?.failureClass, "headers_unobserved");
  assert.equal(result?.timedOut, false);
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
});

/**
 * 有界HTTPの実本文で期限発火と清掃中断を区別する。
 * @trace ERB-IT-021
 * @precondition fetch・Timer・Readerは有限代役。外部通信なし。
 * @stimulus 接続拒否、期限超過、本文切断、本文上限、Reader回収失敗。
 * @observation 固定診断とReader解放。
 * @oracle 期限発火だけtimedOut=true、本文の清掃abortはfalse。
 * @cleanup Timer解除とReaderのcancel／releaseLockを観測する。
 * @responsibility 有界HTTPの実本文で期限発火と清掃中断を区別する。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("HTTP試験器は期限超過と本文清掃のabortを区別する", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/ai-verification-http.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export async function requestBounded(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replace("export async", "async"),
  );
  for (const scenario of [
    "refused",
    "timeout",
    "read-failed",
    "body-limit",
    "reader-cleanup-failed",
  ]) {
    let expire!: () => void;
    let releases = 0;
    let cancels = 0;
    let clears = 0;
    const invoke = runInNewContext(`${body}\nrequestBounded`, {
      Error,
      URL,
      AbortController,
      Buffer,
      Object,
      setTimeout: (callback: () => void, ms: number) => {
        if (ms === 15_000) expire = callback;
        return 1;
      },
      clearTimeout: () => {
        clears++;
      },
      fetch: async () => {
        if (scenario === "timeout") expire();
        if (["refused", "timeout"].includes(scenario))
          throw new TypeError("synthetic-secret", {
            cause: Object.assign(new Error("synthetic-secret"), {
              code: "ECONNREFUSED",
            }),
          });
        return {
          body: {
            getReader: () => ({
              read: async () => {
                if (scenario === "body-limit")
                  return { done: false, value: Buffer.alloc(1024 * 1024 + 1) };
                throw new Error("synthetic-secret");
              },
              cancel: async () => {
                cancels++;
                if (scenario === "reader-cleanup-failed")
                  throw new Error("synthetic-secret");
              },
              releaseLock: () => {
                releases++;
              },
            }),
          },
        };
      },
    }) as (url: string, route: string) => Promise<unknown>;
    let error: unknown;
    try {
      await invoke("http://synthetic.invalid", "/fixed");
    } catch (caught) {
      error = caught;
    }
    const diagnostic = projectVerificationTransportFailure(error);
    assert.ok(diagnostic, scenario);
    assert.equal(diagnostic.timedOut, scenario === "timeout", scenario);
    assert.equal(
      diagnostic.reason,
      ["refused", "timeout"].includes(scenario)
        ? "workbench_verification_transport_failed"
        : scenario === "reader-cleanup-failed"
          ? "workbench_verification_reader_cleanup_unknown"
          : "workbench_verification_response_incomplete",
    );
    assert.equal(releases, ["refused", "timeout"].includes(scenario) ? 0 : 1);
    assert.equal(cancels, releases);
    assert.ok(clears > 0);
    assert.equal(
      JSON.stringify(diagnostic).includes("synthetic-secret"),
      false,
    );
  }
});

/**
 * 合成編集試験も明示された一回の用途以外を受け付けない。
 * @trace ERB-IT-021
 * @precondition 実AI・Dockerを起動しない不正引数だけを与える。
 * @stimulus 同意なし・追加引数・未知用途。
 * @observation 実CLIの終了値。
 * @oracle 64で外部Effect前に停止する。
 * @cleanup 子Processの終了を待つ。試験Rootは作成されない。
 * @responsibility 合成編集試験も明示された一回の用途以外を受け付けない。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("Workspace実AI試験CLIは同意なしと未知引数を起動前に拒否する", () => {
  const entry = fileURLToPath(
    new URL("../../scripts/verify-workspace-ai.ts", import.meta.url),
  );
  for (const args of [
    [],
    ["--unknown"],
    ["--external-send-confirmed", "--retry"],
  ]) {
    assert.throws(
      () =>
        execFileSync(process.execPath, [entry, ...args], {
          stdio: "pipe",
          windowsHide: true,
          timeout: 15_000,
        }),
      (error: unknown) =>
        error !== null &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 64,
    );
  }
});

/**
 * 試験器のRoot検査と清掃失敗を実main本文で反証する。
 * @trace ERB-IT-021
 * @precondition Filesystem・Providerは有限代役であり実Effectなし。
 * @stimulus 親のlink、自己生成物削除EPERM、正常終了。
 * @observation 作成件数、元Task結果、保存した清掃失敗、終了値。
 * @oracle linkは書込み0、削除失敗は元結果を保持してexit2。
 * @cleanup N/A: 実資源を作らない。
 * @responsibility 試験器のRoot検査と清掃失敗を実main本文で反証する。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("Workspace試験mainは作成前のRoot検査と元結果を失わない清掃を行う", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/verify-workspace-ai.ts", import.meta.url),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function main()"),
    source.lastIndexOf("await main().catch"),
  );
  for (const scenario of [
    "success",
    "cleanup-fails",
    "task-failed-clean",
    "linked-parent",
    "source-changed",
    "source-unknown",
  ]) {
    let writes = 0;
    let sourceReads = 0;
    const saved: string[] = [];
    const processState = {
      argv: ["node", "probe", "--preflight"],
      cwd: () => path.resolve("fixture"),
      exitCode: 0,
      stderr: { write: () => undefined },
    };
    const execution = runInNewContext(
      stripTypeScriptTypes(`${body}\nmain();`),
      {
        assert,
        path,
        observeRuntimeOwnedDevelopmentSource: () => {
          sourceReads++;
          if (sourceReads > 1 && scenario === "source-unknown")
            throw new Error("synthetic_observation_unknown");
          return {
            scope: "crdd-development-source-snapshot/v1",
            sourceSha256:
              sourceReads > 1 && scenario === "source-changed"
                ? "different"
                : "same",
            sourceIdentitySha256: "identity",
          };
        },
        process: processState,
        verifyRepositoryRoot: () => ({ status: "completed", capability: {} }),
        resolveVerifiedRepositoryRoot: () => processState.cwd(),
        resolveRepositoryRuntimeDataPaths: () => ({
          tests: path.join(processState.cwd(), ".crdd", "tests"),
        }),
        observeRepositoryRuntimeDataArea: () => ({
          status: scenario === "linked-parent" ? "blocked" : "ready",
        }),
        observeVerificationDockerInventory: () => ({
          containers: [],
          networks: [],
        }),
        assessVerificationDockerInventory: () => ({ status: "verified" }),
        verify: async (_parent: string, mode: string) => ({
          mode,
          limitedProbePassed: scenario !== "task-failed-clean",
          runtimeClean: true,
          workspaceClean: true,
          closeConfirmed: true,
          task: { primaryFailure: null },
        }),
        fs: {
          lstatSync: () => ({
            isDirectory: () => true,
            isSymbolicLink: () => scenario === "linked-parent",
          }),
          realpathSync: { native: (value: string) => value },
          existsSync: () => false,
          mkdirSync: () => {
            writes++;
          },
          rmSync: (value: string) => {
            if (scenario === "cleanup-fails" && value.endsWith("direct"))
              throw new Error("EPERM");
          },
          writeFileSync: (_file: string, value: string) => {
            writes++;
            saved.push(value);
          },
        },
        console: { log: () => undefined },
      },
    );
    if (scenario === "linked-parent") {
      await assert.rejects(execution, /verification_parent_invalid/u);
      assert.equal(writes, 0);
    } else {
      await execution;
      const report = JSON.parse(saved.at(-1) ?? "null");
      assert.equal(
        report.results.length,
        scenario === "task-failed-clean" ? 1 : 2,
      );
      assert.equal(report.results[0].task.primaryFailure, null);
      assert.equal(report.fixtureRootsRemoved, scenario !== "cleanup-fails");
      assert.equal(sourceReads, 2);
      assert.equal(report.sourceUnchanged, !scenario.startsWith("source-"));
      assert.equal(processState.exitCode, scenario === "success" ? 0 : 2);
      if (scenario === "cleanup-fails")
        assert.deepEqual(report.fixtureCleanupFailures, [
          "direct_fixture_removal_failed",
        ]);
    }
  }
});

/**
 * 実inventory Readerは欠測を拒否しIPAMとOptions差を比較へ搬送する。
 * @trace ERB-IT-021
 * @precondition Docker CLI出力だけを有限代役に置き換える。
 * @stimulus 正常inspect、IPAM／Options差、欠測・不正JSON・取得失敗を与える。
 * @observation 実Readerの戻り値とConfiguration Hash。
 * @oracle 不完全観測を空配列へ畳まず、意味上の構成差をHashへ反映する。
 * @cleanup N/A: Docker CLIを実行しない。
 * @responsibility 不完全観測を空配列へ畳まず、意味上の構成差をHashへ反映する。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("実inventory Readerは欠測を拒否しIPAMとOptions差を比較へ搬送する", () => {
  const source = fs.readFileSync(
    new URL("../../scripts/ai-verification-http.ts", import.meta.url),
    "utf8",
  );
  const body = source
    .slice(
      source.indexOf("const digest ="),
      source.indexOf("/**\n * 標準Network"),
    )
    .replaceAll("export function", "function");
  assert.ok(body.includes("function validInventory"));
  /**
   * 構成Hashを比較する独立した合成Docker観測を作る。
   * @responsibility 各反例の前に正常な値を新規生成する。
   * @trace ERB-IT-021
   * @precondition 固定ID関数を使用する。
   * @stimulus 正常Containerと標準Networkを構築する。
   * @observation 独立した合成Object。
   * @oracle 反例間で変異を共有しない。
   * @cleanup N/A: Process内値のみ。
   * @boundary 合成観測から実Reader。
   */
  const raw = () => ({
    containers: [
      {
        Id: id(10),
        Name: "/existing",
        Image: id(20),
        State: { Status: "exited" },
        Config: { User: "1000", WorkingDir: "/work", Cmd: [], Entrypoint: [] },
        HostConfig: {},
        Mounts: [],
      },
    ],
    networks: base.networks.map((n) => ({
      Id: n.id,
      Name: n.name,
      Driver: n.driver,
      Scope: n.scope,
      Internal: false,
      EnableIPv4: true,
      EnableIPv6: false,
      Options: n.defaultBridge
        ? { "com.docker.network.bridge.default_bridge": "true" }
        : {},
      IPAM: { Driver: "default", Config: [], Options: null },
      Labels: null,
      Containers: {},
      Attachable: false,
      Ingress: false,
      ConfigOnly: false,
      ConfigFrom: {},
    })),
  });
  /**
   * 有限CLI出力を実inventory Reader本文へ渡す。
   * @responsibility 取得失敗と構成欠測を観測結果へ搬送する。
   * @trace ERB-IT-021
   * @precondition 合成inventoryと閉じた故障値を指定する。
   * @stimulus VMのCLI代役から一覧とinspect結果を返す。
   * @observation Reader結果又は不明。
   * @oracle 後続assertで差をHashへ反映し欠測を拒否する。
   * @cleanup N/A: VM内で完結し実CLIは発行しない。
   * @boundary 取得代役と本番相当Reader本文。
   */
  const run = (data: ReturnType<typeof raw>, fault = "") =>
    runInNewContext(
      stripTypeScriptTypes(`${body}\nobserveVerificationDockerInventory();`),
      {
        createHash,
        execFileSync: (
          _command: string,
          args: string[],
          options: { maxBuffer: number; timeout: number },
        ) => {
          assert.equal(options.maxBuffer, 1024 * 1024);
          assert.equal(options.timeout, 20_000);
          if (fault === "failure")
            throw new Error("synthetic_capacity_or_transport_failure");
          if (args[0] === "ps") return `${id(10)}\n`;
          if (args[0] === "network" && args[1] === "ls")
            return data.networks.map((n) => n.Id).join("\n");
          if (fault === "json") return "{";
          return JSON.stringify(
            args[0] === "container" ? data.containers : data.networks,
          );
        },
      },
    );
  const baseline = run(raw());
  assert.ok(baseline);
  const changed = raw();
  const bridge = changed.networks[0];
  assert.ok(bridge);
  bridge.IPAM.Driver = "changed";
  assert.notEqual(
    run(changed)?.networks[0]?.configurationHash,
    baseline.networks[0]?.configurationHash,
  );
  bridge.IPAM.Driver = "default";
  Object.assign(bridge.Options, { mtu: "1400" });
  assert.notEqual(
    run(changed)?.networks[0]?.configurationHash,
    baseline.networks[0]?.configurationHash,
  );
  assert.equal(run(raw(), "failure"), null);
  assert.equal(run(raw(), "json"), null);
  for (const [section, fields] of [
    ["container", ["Config", "State", "HostConfig", "Mounts"]],
    ["config", ["User", "WorkingDir", "Cmd", "Entrypoint"]],
    [
      "network",
      [
        "Internal",
        "EnableIPv4",
        "EnableIPv6",
        "IPAM",
        "Containers",
        "Options",
        "Labels",
        "Attachable",
        "Ingress",
        "ConfigOnly",
        "ConfigFrom",
      ],
    ],
    ["ipam", ["Driver", "Config", "Options"]],
  ] as const) {
    for (const field of fields) {
      for (const invalid of [undefined, 42]) {
        const fixture = raw();
        const target =
          section === "container"
            ? fixture.containers[0]
            : section === "config"
              ? fixture.containers[0]?.Config
              : section === "ipam"
                ? fixture.networks[0]?.IPAM
                : fixture.networks[0];
        assert.ok(target);
        if (invalid === undefined) Reflect.deleteProperty(target, field);
        else Reflect.set(target, field, invalid);
        assert.equal(run(fixture), null, `${section}.${field}:${invalid}`);
      }
    }
  }
  for (const field of [
    "IPAM",
    "Containers",
    "Options",
    "Labels",
    "ConfigFrom",
  ]) {
    const fixture = raw();
    assert.ok(fixture.networks[0]);
    Reflect.set(fixture.networks[0], field, []);
    assert.equal(run(fixture), null, field);
  }
  const nullable = raw();
  assert.ok(nullable.containers[0]);
  assert.ok(nullable.networks[0]);
  Object.assign(nullable.containers[0].Config, {
    Cmd: null,
    Entrypoint: null,
  });
  Object.assign(nullable.networks[0].IPAM, { Config: null, Options: null });
  assert.ok(run(nullable));
  Reflect.deleteProperty(bridge, "IPAM");
  assert.equal(run(changed), null);
});

/**
 * 比較反例用の非秘密Docker IDを作る。
 * @responsibility 固定整数から64桁の合成IDを構築する。
 * @trace ERB-IT-021
 * @precondition 試験内の非負整数を使う。
 * @stimulus 16進表現を固定長へ埋める。
 * @observation ID文字列。
 * @oracle 正常IDと構成差を実Dockerなしで区別する。
 * @cleanup N/A: 値変換だけ。
 * @boundary 合成Docker inventory入力。
 */
const id = (n: number) => n.toString(16).padStart(64, "0");
type MutableInventory = {
  containers: [Record<string, unknown>, ...Record<string, unknown>[]];
  networks: [
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
  ];
};
const base: VerificationDockerInventory = {
  containers: [
    {
      id: id(10),
      name: "/existing",
      image: id(20),
      state: "exited",
      configurationHash: id(30),
    },
  ],
  networks: [
    {
      id: id(1),
      name: "bridge",
      driver: "bridge",
      scope: "local",
      defaultBridge: true,
      configurationHash: id(31),
    },
    {
      id: id(2),
      name: "host",
      driver: "host",
      scope: "local",
      defaultBridge: false,
      configurationHash: id(32),
    },
    {
      id: id(3),
      name: "none",
      driver: "null",
      scope: "local",
      defaultBridge: false,
      configurationHash: id(33),
    },
    {
      id: id(4),
      name: "user",
      driver: "bridge",
      scope: "local",
      defaultBridge: false,
      configurationHash: id(34),
    },
  ],
};

/**
 * Docker比較は標準ID差を区別し不明・構成差・利用者資源差を拒否する。
 * @trace ERB-IT-021
 * @precondition 合成の既存Containerと標準／利用者Networkを用意する。
 * @stimulus ID世代差・属性差・欠測・重複・未回収を与える。
 * @observation 比較status、理由、専用診断と追加／消失ID。
 * @oracle 標準ID差だけを構成不変と分け、他の不明・変更を成功にしない。
 * @cleanup N/A: 値だけの比較。
 * @responsibility 標準ID差だけを構成不変と分け、他の不明・変更を成功にしない。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("Docker比較は標準ID差を区別し不明・構成差・利用者資源差を拒否する", () => {
  assert.equal(
    assessVerificationDockerInventory(base, base, true).status,
    "verified",
  );
  const changed = structuredClone(base);
  const bridge = changed.networks[0];
  assert.ok(bridge);
  (bridge as { id: string }).id = id(101);
  const allowed = assessVerificationDockerInventory(base, changed, true);
  assert.equal(allowed.status, "verified");
  assert.equal(allowed.standardNetworkIdentityChanged, true);
  assert.equal(allowed.reason, "standard_network_identity_changed");
  assert.deepEqual(allowed.addedNetworks, [id(101)]);
  assert.deepEqual(allowed.removedNetworks, [id(1)]);
  assert.equal(
    assessVerificationDockerInventory(base, changed, false).status,
    "blocked",
  );
  for (const change of [
    (v: MutableInventory) => {
      v.networks[0].configurationHash = id(99);
    },
    (v: MutableInventory) => {
      v.networks[3].id = id(99);
    },
    (v: MutableInventory) => {
      v.containers[0].state = "running";
    },
    (v: MutableInventory) => {
      v.containers.push({
        ...v.containers[0],
        id: id(99),
        name: "/unexpected",
      });
    },
    (v: MutableInventory) => {
      v.networks.push({ ...v.networks[3], id: id(99), name: "unexpected" });
    },
  ]) {
    const value = structuredClone(base);
    change(value as unknown as MutableInventory);
    assert.equal(
      assessVerificationDockerInventory(base, value, true).status,
      "blocked",
    );
  }
  for (const change of [
    (v: MutableInventory) => {
      v.networks[0].defaultBridge = false;
    },
    (v: MutableInventory) => {
      v.networks[1].driver = "bridge";
    },
    (v: MutableInventory) => {
      v.networks[2].scope = "swarm";
    },
    (v: MutableInventory) => {
      v.networks.push({ ...v.networks[0] });
    },
    (v: MutableInventory) => {
      v.networks.splice(0, 1);
    },
    (v: MutableInventory) => {
      v.containers[0].configurationHash = null;
    },
  ]) {
    const value = structuredClone(base);
    change(value as unknown as MutableInventory);
    assert.equal(
      assessVerificationDockerInventory(base, value, true).status,
      "unknown",
    );
  }
  for (const value of [
    null,
    {},
    { containers: [], networks: [] },
    { containers: null, networks: base.networks },
  ]) {
    assert.equal(
      assessVerificationDockerInventory(value, base, true).status,
      "unknown",
    );
    assert.equal(
      assessVerificationDockerInventory(base, value, true).status,
      "unknown",
    );
  }
});

/**
 * 実AI試験CLIは明示同意と固定Provider以外を起動前に拒否する。
 * @trace ERB-IT-021
 * @precondition 正式CLIを未同意又は不正引数で起動する。
 * @stimulus 同意なし、未知Provider、余剰引数。
 * @observation exit64と案内だけ。
 * @oracle Server／Docker／Provider要求へ進まない。
 * @cleanup 子Processの終了を待つ。
 * @responsibility Server／Docker／Provider要求へ進まない。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("実AI試験CLIは明示同意と固定Provider以外を起動前に拒否する", () => {
  const script = fileURLToPath(
    new URL("../../scripts/verify-readonly-ai.ts", import.meta.url),
  );
  for (const args of [
    [],
    ["--provider", "claude"],
    ["--provider", "unknown", "--external-send-confirmed"],
    ["--provider", "claude", "--external-send-confirmed", "extra"],
  ]) {
    let status: number | null = null;
    try {
      execFileSync(process.execPath, [script, ...args], {
        timeout: 15_000,
        stdio: "pipe",
      });
    } catch (error) {
      status = (error as { status: number }).status;
    }
    assert.equal(status, 64);
  }
});

/**
 * 正式試験mainは公開HTTPで一回だけ依頼し失敗と終了観測を分ける。
 * @trace ERB-IT-021
 * @precondition 正式main本文と公開HTTPを使い、Provider OwnerとCLI観測だけ有限代役へ置く。
 * @stimulus 成功、標準世代差、一次失敗＋close失敗、cleanup不明を与える。
 * @observation start一回、固定Input、最終評価と終了Code。
 * @oracle 外部AIなしで本文搬送を維持し、失敗をclose又は比較成功で消さない。
 * @cleanup 実loopback ServerとSocketをcloseする。
 * @boundary Source本文の結合であり、実AI又は実Docker再実行ではない。
 * @responsibility 外部AIなしで本文搬送を維持し、失敗をclose又は比較成功で消さない。
 */
test("正式試験mainは公開HTTPで一回だけ依頼し失敗と終了観測を分ける", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const surface = await readWorkbenchProjectSurface(root);
  const source = fs.readFileSync(
    new URL("../../scripts/verify-readonly-ai.ts", import.meta.url),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function main()"),
    source.indexOf("\nawait main().catch"),
  );
  assert.ok(body.length > 100);
  for (const scenario of [
    "success",
    "generation",
    "primary-close",
    "cleanup",
    "after-paused",
    "after-restarting",
    "before-paused",
    "before-restarting",
  ] as const) {
    let starts = 0;
    let observation = 0;
    const output: string[] = [];
    const processState = {
      argv: [
        "node",
        "script",
        "--provider",
        "claude",
        "--external-send-confirmed",
      ],
      cwd: () => root,
      stderr: { write: () => true },
      exitCode: 0,
    };
    const snapshot = {
      requestId: "synthetic-verification",
      mode: "read_only_advice" as const,
      profileId: "PROFILE-200001",
      status: "completed" as const,
      executionStatus: "completed",
      reason: null,
      cleanupConfirmed: scenario !== "cleanup",
      recoveryIds: [],
      secondaryFailures: [],
      facts: [{ text: "synthetic", references: ["PROJECT_CONTEXT.md"] }],
      sharedAnalysis: [],
      additionalInferences: [],
      nextOptions: [],
      candidate: null,
    };
    const fakeOwner = {
      start: async (input: {
        contextReferences: string[];
        mode: string;
        externalSendConfirmed: boolean;
      }) => {
        starts++;
        assert.deepEqual([...input.contextReferences], ["PROJECT_CONTEXT.md"]);
        assert.equal(input.mode, "read_only_advice");
        assert.equal(input.externalSendConfirmed, true);
        if (scenario === "primary-close") throw new Error("synthetic_primary");
        return {
          status: "accepted" as const,
          requestId: snapshot.requestId,
          reason: null,
        };
      },
      observe: async () => snapshot,
      cancel: async () => snapshot,
      close: async () => {},
    };
    const catalog = {
      revision: 0,
      catalog: {
        profiles: [
          {
            profileId: "PROFILE-200001",
            exactModelId: "opus",
            adapterId: "claude",
            selectionRoles: ["coordinator"],
          },
        ],
        adapters: [{ adapterId: "claude", provider: "claude" }],
      },
    };
    const execution = runInNewContext(
      stripTypeScriptTypes(`${body}\nmain();`),
      {
        assert,
        createHash,
        Buffer,
        join,
        URLSearchParams,
        Error,
        process: processState,
        console: { log: (v: string) => output.push(v) },
        execFileSync: () => {
          throw new Error("git_process_forbidden");
        },
        gitRepositoryRevisionAdapter: (directory: string) => {
          const expected = gitRepositoryRevisionAdapter(directory);
          const previous = process.env.GIT_DIR;
          try {
            process.env.GIT_DIR = join(root, "nonexistent-synthetic-git-dir");
            const actual = gitRepositoryRevisionAdapter(directory);
            assert.deepEqual(actual, expected);
            return actual;
          } finally {
            if (previous === undefined) delete process.env.GIT_DIR;
            else process.env.GIT_DIR = previous;
          }
        },
        readFileSync: () => Buffer.from("synthetic context"),
        verifyRepositoryRoot,
        createRepositoryAiProfileCatalogStore: () => ({
          status: "ready",
          store: {
            snapshot: () => ({ status: "read", value: catalog, error: null }),
          },
        }),
        readWorkbenchProjectSurface: async () => surface,
        createRepositoryTaskRequests: () => fakeOwner,
        startWorkbench: async (input: Parameters<typeof startWorkbench>[0]) => {
          const handle = await startWorkbench(input);
          return {
            ...handle,
            close: async () => {
              await handle.close();
              if (scenario === "primary-close")
                throw new Error("synthetic_close");
            },
          };
        },
        createWorkbenchAiVerificationHttpClient,
        assessVerificationDockerInventory,
        observeVerificationDockerInventory: () => {
          const value = structuredClone(base);
          if (scenario === "before-paused")
            (value.containers[0] as { state: string }).state = "paused";
          if (scenario === "before-restarting")
            (value.containers[0] as { state: string }).state = "restarting";
          if (observation++ > 0) {
            if (scenario === "generation")
              (value.networks[0] as { id: string }).id = id(101);
            if (scenario === "after-paused")
              (value.containers[0] as { state: string }).state = "paused";
            if (scenario === "after-restarting")
              (value.containers[0] as { state: string }).state = "restarting";
          }
          return value;
        },
        delay: () => Promise.resolve(),
      },
    );
    if (scenario.startsWith("before-")) {
      await assert.rejects(execution, /docker_preflight_unconfirmed/u);
      assert.equal(starts, 0);
      continue;
    }
    await execution;
    assert.equal(starts, 1, JSON.stringify(output));
    const result = JSON.parse(output.at(-1) ?? "null");
    assert.equal(result.fullE2eVerified, false);
    assert.equal(result.wholeRepositoryUnchangedClaimed, false);
    assert.equal(result.projectContextUnchanged, true);
    assert.equal(result.revisionUnchanged, true);
    assert.equal(
      result.limitedProbePassed,
      scenario === "success" || scenario === "generation",
    );
    assert.equal(
      processState.exitCode,
      scenario === "success" || scenario === "generation" ? 0 : 2,
    );
    if (scenario === "generation")
      assert.equal(result.resources.standardNetworkIdentityChanged, true);
    if (scenario === "primary-close") {
      assert.ok(result.primaryFailure);
      assert.equal(result.closeFailure, "synthetic_close");
    }
  }
});

/**
 * 正常な実Byteだけを受理する。
 * @responsibility UTF-8の長さとHashを本文なしで返すことを確認する。
 * @trace ERB-IT-021
 * @precondition 合成の日本語一行と末尾LF。
 * @stimulus 同じ実Byteを検査する。
 * @observation 長さ、Hash、返却fieldを確認する。
 * @oracle 固定Byteから導いた二値だけを返す。
 * @cleanup N/A: 値のみ。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("成果の実Byte・長さ・SHA-256を一致確認する", () => {
  const bytes = Buffer.from("合成成果\n");
  assert.deepEqual(
    verifyWorkspaceOutputBytes(
      bytes,
      "合成成果\n",
      ["source.txt"],
      "source.txt",
    ),
    {
      byteLength: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  );
});

/**
 * 改行・文字コード・本文の差を正規化せず拒否する。
 * @responsibility Reviewer approvedだけでは実Byte一致にならないことを反証する。
 * @trace ERB-IT-021
 * @precondition 合成の固定一行。
 * @stimulus CRLF、改行不足・過剰、別本文、不正UTF-8、BOMを渡す。
 * @observation 固定拒否理由。
 * @oracle 全てByte不一致。
 * @cleanup N/A: 値のみ。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("改行とUTF-8の差を成功へ丸めない", () => {
  for (const bytes of [
    Buffer.from("OK\r\n"),
    Buffer.from("OK"),
    Buffer.from("OK\n\n"),
    Buffer.from("BASE\n"),
    Buffer.from([0xff, 0x0a]),
    Buffer.from("\ufeffOK\n"),
  ])
    assert.throws(
      () =>
        verifyWorkspaceOutputBytes(bytes, "OK\n", ["source.txt"], "source.txt"),
      /workspace_output_bytes_mismatch/u,
    );
});

/**
 * 未観測・余計な変更・別Pathを拒否する。
 * @responsibility 本文だけ一致する不完全な成果を成功にしない。
 * @trace ERB-IT-021
 * @precondition 正常本文。
 * @stimulus 未観測、空、追加Path、重複Pathを渡す。
 * @observation 固定拒否理由。
 * @oracle 全て変更範囲不一致。
 * @cleanup N/A: 値のみ。
 * @boundary 正式試験器と有限代役の局所境界。実AI・実Dockerなし。
 */
test("本文一致でも変更Pathが不明又は過剰なら拒否する", () => {
  for (const paths of [
    null,
    [],
    ["other.txt"],
    ["source.txt", "other.txt"],
    ["source.txt", "source.txt"],
  ])
    assert.throws(
      () =>
        verifyWorkspaceOutputBytes(
          Buffer.from("OK\n"),
          "OK\n",
          paths,
          "source.txt",
        ),
      /workspace_output_changed_paths_mismatch/u,
    );
});
