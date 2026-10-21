/**
 * coordinator:system:coordinator-docker-recovery-cliの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:coordinator-docker-recovery-cliが所有する検証責務を実行する。
 * @trace PRL-ST-001
 * @level ST
 * @scope coordinator、docker、recovery、cli
 * @boundary PRL-ST-001=System/E2E: 公開入口→Orchestrator→Execution→受入
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { withUnsignedRuntimeFixture } from "../support/unsigned-runtime-fixture.ts";
import { renderDockerRecoveryDoctorReport } from "../../src/diagnostics/docker-recovery-command-report.ts";
import { parseDoctorArguments } from "../../src/cli/options.ts";

const recoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
const hostRecoveryId = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;

/**
 * 新しい実行環境修復CLIを固定公開診断まで接続する。
 * @responsibility 旧Desktop handler・内部Path・表示再試行へ戻さない。
 * @trace PRL-ST-001
 * @precondition 実CLI関数と実renderer、下位Effectは模擬。
 * @stimulus 初回／exact、binding／Root拒否、取消、解除・表示失敗。
 * @observation 下位呼出し数、signal、解除順、公開JSONと終了コード。
 * @oracle Effect前拒否は0、解除不明は一次理由保持・exit2、内部値漏洩0。
 * @cleanup N/A: VM内のみ、Docker／Process／Filesystem書込み0。
 * @boundary PRL-ST-001=Related 2 Blocks: CLI→修復composition→固定公開診断。
 */
test("現在修復CLIはRootと取消を結合し内部状態を公開しない", async () => {
  const source = fs.readFileSync(
    new URL("../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("async function runRuntimeRepairDoctorCommand(");
  const end = source.indexOf("export const COORDINATOR_LAUNCH_ENTRIES", start);
  assert.ok(start > 0 && end > start);
  assert.equal(
    source.includes("repairRuntimeOwnedWindowsDockerDesktopRuntime"),
    false,
  );
  assert.doesNotMatch(
    source,
    /dispatchDockerDesktopRepairDoctorCommand|AfterVerifiedDockerDesktopRestart/u,
  );
  const body = stripTypeScriptTypes(source.slice(start, end));
  const id = `docker-runtime-repair.${"a".repeat(64)}.${"b".repeat(64)}`;
  for (const scenario of [
    "normal",
    "exact",
    "binding",
    "root",
    "resolve_throw",
    "producer_throw",
    "cancel",
    "exact_cancel",
    "unbind",
    "unbind_throw",
    "render_throw",
    "write_throw",
    "retain",
    "retain_cancel",
    "retain_unbind",
    "retain_unbind_throw",
    "retain_render_throw",
    "retain_write_throw",
    "retain_wrong_id",
  ] as const) {
    const retention = scenario.startsWith("retain");
    const cancelled =
      scenario === "cancel" ||
      scenario === "exact_cancel" ||
      scenario === "retain_cancel";
    let calls = 0,
      roots = 0,
      output = "",
      exitCode = -1,
      secretReads = 0;
    const events: string[] = [];
    const root = Object.freeze({});
    const context = {
      AbortController,
      Object,
      plainRecord: (value: unknown) => value,
      bindTaskCliCancellationSignals: (cancel: () => unknown) => {
        events.push("bind");
        if (cancelled) cancel();
        return {
          status: scenario === "binding" ? "blocked" : "bound",
          unbind: () => {
            events.push("unbind");
            if (scenario.endsWith("unbind_throw")) throw new Error("fixture");
            return {
              status: scenario.endsWith("unbind") ? "unknown" : "released",
            };
          },
        };
      },
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => {
        roots++;
        if (scenario === "resolve_throw") throw new Error("private-root");
        return "root";
      },
      verifyRepositoryRoot: () => ({
        status: scenario === "root" ? "blocked" : "completed",
        capability: root,
      }),
      repairRuntimeOwnedDockerRuntime: async (
        received: unknown,
        signal: AbortSignal,
        requested: unknown,
        purpose: unknown,
      ) => {
        calls++;
        events.push("repair");
        assert.equal(received, root);
        assert.equal(
          requested,
          retention || scenario === "exact" || scenario === "exact_cancel"
            ? id
            : null,
        );
        assert.equal(purpose, retention ? "retain" : "repair");
        assert.equal(signal.aborted, cancelled);
        if (scenario === "producer_throw")
          throw new Error("private-provider-output");
        if (scenario === "cancel")
          return {
            status: "blocked",
            reason: "runtime_repair_boundary_unavailable",
            recoveryId: null,
            finalCheckpointConfirmed: false,
            outcomeConfirmed: false,
            retentionConfirmed: false,
            retentionReviewAfter: null,
            historyConfirmed: false,
            completionConfirmed: false,
            nativeCleanupConfirmed: false,
          };
        return Object.defineProperty(
          {
            status: "observed",
            reason: "runtime_repair_recovered",
            recoveryId:
              scenario === "retain_wrong_id"
                ? `docker-runtime-repair.${"c".repeat(64)}.${"d".repeat(64)}`
                : id,
            finalCheckpointConfirmed: true,
            outcomeConfirmed: true,
            retentionConfirmed: retention,
            retentionReviewAfter: retention ? "2026-10-24T00:00:00.000Z" : null,
            historyConfirmed: true,
            completionConfirmed: true,
            nativeCleanupConfirmed: true,
          },
          "checkpoint",
          {
            get: () => {
              secretReads++;
              throw new Error("private-checkpoint");
            },
          },
        );
      },
      renderDockerRecoveryDoctorReport: (value: unknown, json: boolean) => {
        events.push("render");
        assert.ok(events.indexOf("unbind") < events.indexOf("render"));
        if (scenario.endsWith("render_throw"))
          throw new Error("fixture-render");
        return renderDockerRecoveryDoctorReport(
          JSON.parse(JSON.stringify(value)),
          json,
        );
      },
      process: {
        cwd: () => "current",
        stdout: {
          write: (value: string) => {
            if (scenario.endsWith("write_throw"))
              throw new Error("fixture-write");
            output = value;
          },
        },
        set exitCode(value: number) {
          exitCode = value;
        },
      },
    };
    const execute = runInNewContext(
      `${body}; runRuntimeRepairDoctorCommand`,
      context,
    ) as (
      json: boolean,
      recoveryId: string | null,
      purpose: "repair" | "retain",
    ) => Promise<void>;
    if (scenario.endsWith("render_throw") || scenario.endsWith("write_throw"))
      await assert.rejects(
        execute(true, retention ? id : null, retention ? "retain" : "repair"),
      );
    else {
      await execute(
        true,
        retention || scenario === "exact" || scenario === "exact_cancel"
          ? id
          : null,
        retention ? "retain" : "repair",
      );
      const value = JSON.parse(output);
      const denied = [
        "binding",
        "root",
        "resolve_throw",
        "producer_throw",
        "cancel",
        "retain_cancel",
        "retain_wrong_id",
      ].includes(scenario);
      assert.equal(value.status, denied ? "blocked" : "observed", scenario);
      assert.equal(value.completionConfirmed, !denied);
      assert.equal(value.retentionConfirmed, retention && !denied);
      if (retention) {
        const expected = {
          contract: "crdd-coordinator/current-runtime-repair",
          status: denied ? "blocked" : "observed",
          reason: denied
            ? scenario === "retain_wrong_id"
              ? "runtime_repair_boundary_unavailable"
              : "runtime_repair_cancelled"
            : "runtime_repair_recovered",
          recoveryId: id,
          finalCheckpointConfirmed: !denied,
          outcomeConfirmed: !denied,
          retentionConfirmed: !denied,
          retentionReviewAfter: denied ? null : "2026-10-24T00:00:00.000Z",
          historyConfirmed: !denied,
          completionConfirmed: !denied,
          nativeCleanupConfirmed: !denied,
          cliCleanupConfirmed: !scenario.includes("unbind"),
          cliCleanupReason: scenario.includes("unbind")
            ? "runtime_repair_cli_cleanup_unconfirmed"
            : null,
        };
        assert.deepEqual(value, expected);
        assert.throws(() =>
          assert.deepEqual(
            {
              ...value,
              recoveryId: `docker-runtime-repair.${"c".repeat(64)}.${"d".repeat(64)}`,
            },
            expected,
          ),
        );
        if (scenario.includes("unbind"))
          assert.throws(() =>
            assert.deepEqual(
              { ...value, cliCleanupConfirmed: true, cliCleanupReason: null },
              expected,
            ),
          );
      }
      assert.equal(
        exitCode,
        denied || scenario.includes("unbind") ? 2 : 0,
        scenario,
      );
      if (scenario.includes("unbind"))
        assert.equal(value.reason, "runtime_repair_recovered");
      assert.equal(output.includes("private"), false);
      assert.equal(output.includes("checkpoint"), false);
    }
    assert.equal(
      calls,
      ["binding", "root", "resolve_throw", "retain_cancel"].includes(scenario)
        ? 0
        : 1,
      scenario,
    );
    assert.equal(
      roots,
      scenario === "binding" || scenario === "retain_cancel" ? 0 : 1,
      scenario,
    );
    assert.equal(secretReads, 0);
    if (scenario === "retain") {
      for (const mutant of [
        body.replace(/(controller\.signal,\s*recoveryId,)\s*purpose,/u, "$1"),
        body.replace(
          /(controller\.signal,\s*recoveryId,)\s*purpose,/u,
          '$1 "repair",',
        ),
        body.replace(
          /(controller\.signal,)\s*recoveryId,\s*purpose,/u,
          '$1 "different-id", purpose,',
        ),
      ]) {
        assert.notEqual(mutant, body);
        calls = 0;
        roots = 0;
        output = "";
        events.length = 0;
        const altered = runInNewContext(
          `${mutant}; runRuntimeRepairDoctorCommand`,
          context,
        ) as typeof execute;
        await altered(true, id, "retain");
        assert.equal(calls, 1);
        assert.equal(JSON.parse(output).status, "blocked");
        assert.throws(() =>
          assert.equal(JSON.parse(output).retentionConfirmed, true),
        );
      }
    }
  }
});

/**
 * 修復診断の共同fieldとgetter／Proxy拒否を固定する。
 * @responsibility 内部余剰fieldを外部結果へ転送しない。
 * @trace PRL-ST-001
 * @precondition 正規の固定公開結果。
 * @stimulus 各確認field・ID・reasonの破損と悪意のgetter。
 * @observation exitCode、JSON field集合、getter実行数。
 * @oracle 完了は履歴・正規ID・解除の共同成立だけ、getterを実行せず拒否。
 * @cleanup N/A: 純粋値のみ。
 * @boundary 公開renderer契約。
 */
test("現在修復診断は固定fieldと相関だけを表示する", () => {
  const value = {
    contract: "crdd-coordinator/current-runtime-repair",
    status: "observed",
    reason: "runtime_repair_recovered",
    recoveryId: `docker-runtime-repair.${"a".repeat(64)}.${"b".repeat(64)}`,
    finalCheckpointConfirmed: true,
    outcomeConfirmed: true,
    retentionConfirmed: false,
    retentionReviewAfter: null,
    historyConfirmed: true,
    completionConfirmed: true,
    nativeCleanupConfirmed: true,
    cliCleanupConfirmed: true,
    cliCleanupReason: null,
  };
  assert.equal(renderDockerRecoveryDoctorReport(value, true).exitCode, 0);
  assert.equal(
    renderDockerRecoveryDoctorReport(
      {
        ...value,
        cliCleanupConfirmed: false,
        cliCleanupReason: "runtime_repair_cli_cleanup_unconfirmed",
      },
      true,
    ).exitCode,
    2,
  );
  for (const change of [
    { historyConfirmed: false },
    { retentionConfirmed: true },
    { recoveryId: null },
    { reason: "secret_value" },
    { status: "blocked" },
    { cliCleanupReason: "private/path" },
  ])
    assert.throws(() =>
      renderDockerRecoveryDoctorReport({ ...value, ...change }, true),
    );
  const waiting = {
    ...value,
    completionConfirmed: false,
    historyConfirmed: false,
  };
  assert.equal(renderDockerRecoveryDoctorReport(waiting, false).exitCode, 2);
  assert.match(
    renderDockerRecoveryDoctorReport(waiting, false).stdout,
    /保持判断待ち/u,
  );
  const retained = {
    ...value,
    completionConfirmed: false,
    retentionConfirmed: true,
    retentionReviewAfter: "2026-10-24T00:00:00.000Z",
  };
  assert.equal(renderDockerRecoveryDoctorReport(retained, false).exitCode, 2);
  const retainedComplete = {
    ...retained,
    completionConfirmed: true,
    outcomeConfirmed: false,
    finalCheckpointConfirmed: false,
    nativeCleanupConfirmed: false,
  };
  assert.equal(
    renderDockerRecoveryDoctorReport(retainedComplete, false).exitCode,
    0,
  );
  assert.match(
    renderDockerRecoveryDoctorReport(retainedComplete, false).stdout,
    /保持引渡し完了/u,
  );
  for (const deadline of [
    null,
    "2026-10-24",
    "2026-10-24T00:00:00Z",
    "invalid",
    1,
  ])
    assert.throws(() =>
      renderDockerRecoveryDoctorReport(
        { ...retainedComplete, retentionReviewAfter: deadline },
        true,
      ),
    );
  assert.throws(() =>
    renderDockerRecoveryDoctorReport(
      { ...value, retentionReviewAfter: "2026-10-24T00:00:00.000Z" },
      true,
    ),
  );
  for (const key of [
    "historyConfirmed",
    "outcomeConfirmed",
    "finalCheckpointConfirmed",
    "nativeCleanupConfirmed",
  ])
    assert.throws(() =>
      renderDockerRecoveryDoctorReport({ ...retained, [key]: false }, true),
    );
  for (const key of [
    "outcomeConfirmed",
    "finalCheckpointConfirmed",
    "nativeCleanupConfirmed",
  ])
    assert.throws(() =>
      renderDockerRecoveryDoctorReport({ ...waiting, [key]: false }, true),
    );
  assert.throws(() =>
    renderDockerRecoveryDoctorReport(
      { ...value, status: "blocked", completionConfirmed: false },
      true,
    ),
  );
  assert.throws(() =>
    renderDockerRecoveryDoctorReport(
      {
        ...waiting,
        outcomeConfirmed: false,
        finalCheckpointConfirmed: false,
        nativeCleanupConfirmed: false,
      },
      true,
    ),
  );
  assert.equal(
    renderDockerRecoveryDoctorReport(
      {
        ...waiting,
        status: "blocked",
        reason: "runtime_repair_state_unavailable",
        historyConfirmed: true,
      },
      true,
    ).exitCode,
    2,
  );
  assert.equal(
    renderDockerRecoveryDoctorReport(
      {
        ...value,
        outcomeConfirmed: false,
        finalCheckpointConfirmed: false,
        nativeCleanupConfirmed: false,
      },
      true,
    ).exitCode,
    0,
  );
  let getters = 0;
  assert.throws(() =>
    renderDockerRecoveryDoctorReport(
      Object.defineProperty({ ...value }, "reason", {
        get: () => {
          getters++;
          return "secret";
        },
      }),
      true,
    ),
  );
  assert.throws(() =>
    renderDockerRecoveryDoctorReport(
      new Proxy(value, {
        get: () => {
          getters++;
          throw new Error("fixture");
        },
      }),
      true,
    ),
  );
  assert.equal(getters, 0);
  const extra = Object.defineProperty({ ...value }, "internalRoot", {
    get: () => {
      getters++;
      return "private-root";
    },
  });
  assert.equal(
    renderDockerRecoveryDoctorReport(extra, true).stdout.includes(
      "internalRoot",
    ),
    false,
  );
  assert.equal(getters, 0);
});

/**
 * 実引数解析からdoctorの修復分岐へ到達することを確認する。
 * @responsibility 補助関数だけの成功をCLI配線の根拠にしない。
 * @trace PRL-ST-001
 * @precondition 実parserと本番doctor分岐本文、外部処理はspy。
 * @stimulus 明示修復、exact修復ID、通常doctor、Task、旧close／adoptと分類無効化変異。
 * @observation 新旧経路の呼出し列とexact ID。
 * @oracle 新修復だけ一回発火し、分類無効化を同Oracleが拒否する。
 * @cleanup N/A: 実Docker・Process・Filesystem操作0。
 * @boundary PRL-ST-001=Related 2 Blocks: 引数→doctor分類→用途別入口。
 */
test("doctorの実parserと分岐は新修復だけを現在compositionへ渡す", async () => {
  const source = fs.readFileSync(
    new URL("../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const branch = source.indexOf('} else if (command === "doctor") {');
  const start = source.indexOf("  try {", branch);
  const end = source.indexOf("\n  } else {", start);
  assert.ok(branch > 0 && start > branch && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const id = `docker-runtime-repair.${"a".repeat(64)}.${"b".repeat(64)}`;
  /**
   * 本番分岐を外部処理spyと実parserで一度実行する。
   * @responsibility RootやDockerを起動せず分類の実接続を観測する。
   * @trace PRL-ST-001
   * @precondition 型除去済みの同じ分岐本文。
   * @stimulus Sourceまたは一条件変異とargv。
   * @observation 呼出し列。
   * @oracle 未定義依存を成功へ補完せず例外を上位へ返す。
   * @cleanup N/A: VMのみ。
   * @boundary 実parserと用途別CLI入口。
   */
  const route = async (text: string, args: string[]) => {
    const events: string[] = [];
    const run = runInNewContext(`(async function(){${text}})`, {
      args,
      Object,
      AbortController,
      UsageError: Error,
      parseDoctorArguments,
      plainRecord: (value: unknown) => value,
      process: {
        env: {},
        cwd: () => "root",
        stdout: { write: () => undefined },
        stderr: { write: () => undefined },
        exitCode: 0,
      },
      runRuntimeRepairDoctorCommand: async (
        _json: boolean,
        exact: string | null,
        purpose: "repair" | "retain",
      ) => {
        events.push(
          `${purpose === "retain" ? "retain" : "new"}:${exact ?? "fresh"}`,
        );
        assert.ok(purpose === "repair" || purpose === "retain");
      },
      bindTaskCliCancellationSignals: () => ({
        status: "bound",
        unbind: () => ({ status: "released" }),
      }),
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => {
        events.push("root");
        return "root";
      },
      verifyRepositoryRoot: () => {
        events.push("verify");
        return { status: "completed", capability: {} };
      },
      recoverRuntimeOwnedDockerTaskForCurrentConsumer: async (
        exact: string,
      ) => {
        events.push(`task:${exact}`);
        return { contract: "fixture", status: "blocked", recoveryId: exact };
      },
      restartRuntimeOwnedDockerForRecovery: async (exact: string) => {
        events.push(`restart:${exact}`);
        return { status: "blocked", cleanupConfirmed: true };
      },
      renderDockerRecoveryDoctorReport: () => ({ stdout: "safe", exitCode: 2 }),
      runDoctor: () => {
        events.push("doctor");
        return { status: "ready" };
      },
      inspectRuntimeOwnedDockerTaskAdmission: (root: string) => {
        assert.equal(root, "root");
        return {};
      },
      currentRecoveryOperationRoot: () => null,
      renderDoctorCommandFailure: (error: unknown) => {
        if (
          error instanceof Error &&
          error.message === "doctor_arguments_invalid"
        )
          assert.deepEqual(events, []);
        throw error;
      },
    }) as () => Promise<void>;
    await run();
    return events;
  };
  const cases: Array<[string[], string[]]> = [
    [["--repair-docker-desktop-runtime", "--json"], ["new:fresh"]],
    [["--recover-isolation", id, "--json"], [`new:${id}`]],
    [["--retain-docker-runtime-repair", id, "--json"], [`retain:${id}`]],
    [
      ["--recover-isolation", recoveryId, "--json"],
      ["root", "verify", `task:${recoveryId}`],
    ],
    [["--json"], ["root", "doctor"]],
    [
      ["--restart-docker-for-recovery", recoveryId, "--json"],
      ["root", "verify", `restart:${recoveryId}`],
    ],
  ];
  for (const [args, expected] of cases)
    assert.deepEqual(await route(body, args), expected);
  const old = `docker-desktop-repair.${"c".repeat(32)}`;
  const releaseRoot = path.resolve("historical-release-not-used");
  for (const args of [
    [
      "--adopt-docker-desktop-repair",
      old,
      "--repair-release-root",
      releaseRoot,
    ],
    [
      "--repair-release-root",
      releaseRoot,
      "--adopt-docker-desktop-repair",
      old,
    ],
    [
      "--recover-isolation",
      recoveryId,
      "--after-docker-desktop-repair",
      old,
      "--repair-release-root",
      releaseRoot,
    ],
    [
      "--repair-release-root",
      releaseRoot,
      "--after-docker-desktop-repair",
      old,
      "--recover-isolation",
      recoveryId,
    ],
  ])
    await assert.rejects(() => route(body, args), /doctor_arguments_invalid/u);
  for (const retired of [
    "--close-docker-desktop-runtime-repair",
    "--adopt-docker-desktop-repair",
    "--after-docker-desktop-repair",
    "--repair-release-root",
  ]) {
    for (const args of [
      [retired],
      [retired, "old"],
      [retired, "old", "--recover-isolation", recoveryId],
      ["--recover-isolation", recoveryId, retired, "old"],
    ])
      await assert.rejects(
        () => route(body, args),
        /doctor_arguments_invalid/u,
      );
  }
  const pattern = /const isCurrentRuntimeRepair =[\s\S]*?;/u;
  assert.equal(body.match(new RegExp(pattern.source, "gu"))?.length, 1);
  const mutant = body.replace(pattern, "const isCurrentRuntimeRepair = false;");
  for (const [args, expected] of cases.slice(0, 3)) {
    const changed = await route(mutant, args);
    assert.throws(() => assert.deepEqual(changed, expected));
  }
  for (const changed of [
    body.replace(/\? "retain"\s*: "repair"/u, '? "repair" : "repair"'),
    body.replace(
      /\? options\.retainDockerRuntimeRepairId\s*: recoveryId/u,
      "? recoveryId : recoveryId",
    ),
  ]) {
    assert.notEqual(changed, body);
    const events = await route(changed, [
      "--retain-docker-runtime-repair",
      id,
      "--json",
    ]);
    assert.throws(() => assert.deepEqual(events, [`retain:${id}`]));
  }
});

/**
 * 現在回復CLIの取消・Root・表示を本番分岐本文で接続する。
 * @responsibility bindingと表示失敗が技術回復の再実行・状態復元を生まないことを確認する。
 * @trace PRL-ST-001
 * @precondition 本番CLI分岐と固定公開診断を使用する。
 * @stimulus binding／Root拒否、unbind不明、表示例外を渡す。
 * @observation 呼出し順序、回数、終了コード、公開表示を観測する。
 * @oracle 正常は一回だけ組立て、unbind不明でも既完了状態を維持しexit2。
 * @cleanup N/A: 実Process・Filesystem・Dockerを生成しない。
 * @boundary PRL-ST-001=Related 2 Blocks: CLI→現在回復組立て→renderer。
 */
test("現在回復CLIは取消排他を解放してから固定診断を表示する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const branch = source.indexOf('recoveryId?.startsWith("docker-task.")');
  const start = source.indexOf("      const controller", branch);
  const end = source.indexOf("    } else {", start);
  assert.ok(branch > 0 && start > branch && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  for (const scenario of [
    "normal",
    "binding",
    "root",
    "cancel_before",
    "cancel_after",
    "unbind",
    "unbind_throw",
    "render_throw",
    "write_throw",
  ]) {
    const events: string[] = [];
    let calls = 0,
      exitCode: number | undefined,
      output = "";
    let cancel: (() => Promise<unknown>) | null = null;
    const fixed = {
      contract: "crdd-coordinator/current-task-recovery",
      status: "recovered",
      reason: "docker_task_recovery_completed",
      recoveryId,
      dockerCleanupConfirmed: true,
      hostCleanupConfirmed: true,
      locksReleased: true,
      historyConfirmed: true,
      deliveryPending: false,
      operationRetained: false,
      operationRemovalConfirmed: true,
      taskRecoveryCompleted: true,
      cleanupReason: null,
      secret: "not_public",
      preparation: {},
    };
    const processMock = {
      cwd: () => "repository",
      stdout: {
        write(text: string) {
          events.push("write");
          if (scenario === "write_throw") throw new Error("fixture");
          output = text;
        },
      },
      get exitCode() {
        return exitCode;
      },
      set exitCode(value: number | undefined) {
        exitCode = value;
      },
    };
    const run = runInNewContext(`(async () => { ${body} })`, {
      AbortController,
      Object,
      recoveryId,
      options: { json: true },
      process: processMock,
      bindTaskCliCancellationSignals: (callback: () => Promise<unknown>) => {
        events.push("bind");
        cancel = callback;
        if (scenario === "cancel_before") void callback();
        return {
          status: scenario === "binding" ? "blocked" : "bound",
          unbind() {
            events.push("unbind");
            if (scenario === "unbind_throw") throw new Error("fixture");
            return { status: scenario === "unbind" ? "blocked" : "released" };
          },
        };
      },
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => "root",
      verifyRepositoryRoot: () => {
        events.push("root");
        return {
          status: scenario === "root" ? "blocked" : "completed",
          capability: {},
        };
      },
      recoverRuntimeOwnedDockerTaskForCurrentConsumer: async () => {
        events.push("recover");
        calls++;
        if (scenario === "cancel_after" && cancel) await cancel();
        return fixed;
      },
      renderDockerRecoveryDoctorReport(value: unknown, json: boolean) {
        events.push("render");
        if (scenario === "render_throw") throw new Error("fixture");
        return renderDockerRecoveryDoctorReport(
          JSON.parse(JSON.stringify(value)),
          json,
        );
      },
    }) as () => Promise<void>;
    if (scenario === "render_throw" || scenario === "write_throw")
      await assert.rejects(run);
    else await run();
    assert.equal(
      calls,
      ["binding", "root", "cancel_before"].includes(scenario) ? 0 : 1,
      scenario,
    );
    assert.equal(events.filter((x) => x === "unbind").length, 1, scenario);
    assert.ok(events.indexOf("unbind") < events.indexOf("render"), scenario);
    if (output) {
      assert.doesNotMatch(output, /secret|preparation|not_public/);
      const report = JSON.parse(output);
      assert.equal(
        report.taskRecoveryCompleted,
        !["binding", "root", "cancel_before"].includes(scenario),
      );
      assert.equal(
        exitCode,
        ["normal", "cancel_after"].includes(scenario) ? 0 : 2,
        scenario,
      );
      if (scenario.startsWith("unbind"))
        assert.equal(report.reason, fixed.reason);
    }
  }
});

/**
 * 現在回復の診断を利用形態と共同条件で表示する。
 * @responsibility 部分成立・CLI清掃不明・未知fieldを正常完了表示へ混入させない。
 * @trace PRL-ST-001
 * @precondition 固定公開fieldだけを持つ診断を構成する。
 * @stimulus 正常transient、durable待ち、相関欠落と余剰fieldを渡す。
 * @observation 人間表示・JSON・終了コードを比較する。
 * @oracle 正常と受領待ちを区別し、余剰fieldは出力しない。
 * @cleanup N/A: 値変換だけ。
 * @boundary PRL-ST-001=Direct Boundary: 固定診断→renderer。
 */
test("現在回復rendererは完了と耐久受領待ちを区別する", () => {
  const base = {
    contract: "crdd-coordinator/current-task-recovery",
    status: "recovered",
    reason: "docker_task_recovery_completed",
    recoveryId,
    dockerCleanupConfirmed: true,
    hostCleanupConfirmed: true,
    locksReleased: true,
    historyConfirmed: true,
    deliveryPending: false,
    operationRetained: false,
    operationRemovalConfirmed: true,
    taskRecoveryCompleted: true,
    cleanupReason: null,
    cliCleanupConfirmed: true,
    cliCleanupReason: null,
    secret: "not_public",
  };
  assert.equal(renderDockerRecoveryDoctorReport(base, true).exitCode, 0);
  assert.doesNotMatch(
    renderDockerRecoveryDoctorReport(base, true).stdout,
    /secret|not_public/,
  );
  assert.match(
    renderDockerRecoveryDoctorReport(base, false).stdout,
    /回復: 完了/,
  );
  const pending = {
    ...base,
    status: "awaiting_delivery",
    reason: "docker_task_recovery_durable_acceptance_pending",
    deliveryPending: true,
    operationRetained: true,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
  };
  assert.equal(renderDockerRecoveryDoctorReport(pending, true).exitCode, 0);
  assert.match(
    renderDockerRecoveryDoctorReport(pending, false).stdout,
    /Orchestrator受領待ち/,
  );
  for (const field of [
    "dockerCleanupConfirmed",
    "hostCleanupConfirmed",
    "locksReleased",
    "historyConfirmed",
    "operationRemovalConfirmed",
    "taskRecoveryCompleted",
  ])
    assert.throws(
      () => renderDockerRecoveryDoctorReport({ ...base, [field]: false }, true),
      /diagnostic_failed/,
    );
  const release = {
    ...base,
    cliCleanupConfirmed: false,
    cliCleanupReason: "cli_release_unconfirmed",
  };
  assert.equal(renderDockerRecoveryDoctorReport(release, true).exitCode, 2);
  assert.equal(
    JSON.parse(renderDockerRecoveryDoctorReport(release, true).stdout)
      .taskRecoveryCompleted,
    true,
  );
  let getters = 0;
  for (const key of [
    "contract",
    "status",
    "cleanupReason",
    "dockerCleanupConfirmed",
  ]) {
    const input = { ...base };
    Object.defineProperty(input, key, {
      enumerable: true,
      get() {
        getters++;
        throw new Error("secret");
      },
    });
    assert.throws(
      () => renderDockerRecoveryDoctorReport(input, true),
      /diagnostic_failed/,
    );
  }
  assert.equal(getters, 0);
  const inherited = Object.getOwnPropertyDescriptor(
    Object.prototype,
    "contract",
  );
  try {
    Object.defineProperty(Object.prototype, "contract", {
      configurable: true,
      get() {
        getters++;
        throw new Error("secret");
      },
    });
    assert.equal(
      renderDockerRecoveryDoctorReport({ status: "blocked" }, true).exitCode,
      2,
    );
  } finally {
    if (inherited)
      Object.defineProperty(Object.prototype, "contract", inherited);
    else Reflect.deleteProperty(Object.prototype, "contract");
  }
  assert.equal(getters, 0);
  const blocked = {
    ...base,
    status: "blocked",
    reason: "recovery_stopped",
    operationRetained: true,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
  };
  assert.equal(renderDockerRecoveryDoctorReport(blocked, true).exitCode, 2);
  for (const value of [
    { ...base, status: "blocked" },
    { ...pending, status: "blocked" },
    { ...blocked, operationRemovalConfirmed: true },
    { ...blocked, taskRecoveryCompleted: true },
    { ...blocked, operationRetained: false },
    { ...base, reason: "wrong_reason" },
    { ...pending, reason: "wrong_reason" },
  ])
    assert.throws(
      () => renderDockerRecoveryDoctorReport(value, true),
      /diagnostic_failed/,
    );
});

/**
 * invokeCliのTest準備責務を実行する。
 *
 * @responsibility invokeCliがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-ST-001
 * @precondition 呼出し元Test CaseがJSONまたは人間表示を指定する。
 * @stimulus 自己生成Git Rootで元操作のない回復CLIを呼ぶ。
 * @observation exact Git Root、公開結果、本体stateの前後Hashと存在を取得する。
 * @oracle 親Repositoryを参照せず正規拒否し、本体stateの本文・存在は不変。
 * @cleanup 共通fixtureが作成した専用Rootをfinallyで清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
function invokeCli(isJson: boolean) {
  const stateFile = path.resolve(
    import.meta.dirname,
    "../../../../.crdd/coordinator/state.json",
  );
  const before = fs.existsSync(stateFile)
    ? createHash("sha256").update(fs.readFileSync(stateFile)).digest("hex")
    : null;
  try {
    return withUnsignedRuntimeFixture((root) => {
      execFileSync("git", ["init", "--quiet"], {
        cwd: root,
        windowsHide: true,
      });
      fs.writeFileSync(
        path.join(root, "fixture-marker.txt"),
        "public recovery fixture\n",
      );
      execFileSync("git", ["add", "--", "fixture-marker.txt"], {
        cwd: root,
        windowsHide: true,
      });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=CRDD Test",
          "-c",
          "user.email=crdd-test@example.invalid",
          "-c",
          "core.hooksPath=NUL",
          "commit",
          "--no-gpg-sign",
          "--quiet",
          "-m",
          "Recovery CLI fixture",
        ],
        { cwd: root, windowsHide: true },
      );
      const resolved = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: root,
        windowsHide: true,
        encoding: "utf8",
      }).trim();
      assert.equal(
        fs.realpathSync.native(resolved),
        fs.realpathSync.native(root),
      );
      assert.equal(
        execFileSync("git", ["ls-files"], {
          cwd: root,
          windowsHide: true,
          encoding: "utf8",
        }),
        "fixture-marker.txt\n",
      );
      return spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(root, "40_Develop", "coordinator", "bin", "coordinator.ts"),
          "doctor",
          "--recover-isolation",
          recoveryId,
          ...(isJson ? ["--json"] : []),
        ],
        { cwd: root, windowsHide: true, encoding: "utf8", timeout: 10_000 },
      );
    });
  } finally {
    const after = fs.existsSync(stateFile)
      ? createHash("sha256").update(fs.readFileSync(stateFile)).digest("hex")
      : null;
    assert.equal(after, before);
  }
}

/**
 * 実CLIのdocker-task dispatchはJSONでexact IDと安全なblocked理由を返すを検証する。
 *
 * @responsibility 実CLIのdocker-task dispatchはJSONでexact IDと安全なblocked理由を返すの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実CLIのdocker-task dispatchはJSONでexact IDと安全なblocked理由を返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("実CLIのdocker-task dispatchはJSONでexact IDと安全なblocked理由を返す", () => {
  const result = invokeCli(true);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    contract: "crdd-coordinator/current-task-recovery",
    status: "blocked",
    reason: "docker_task_recovery_preparation_unconfirmed",
    recoveryId: recoveryId,
    dockerCleanupConfirmed: false,
    hostCleanupConfirmed: false,
    locksReleased: true,
    historyConfirmed: false,
    deliveryPending: false,
    operationRetained: null,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: null,
    cliCleanupConfirmed: true,
    cliCleanupReason: null,
  });
  assert.equal(result.stderr, "");
});

/**
 * 実CLIの人間表示はmanual recoveryとEvidence不明を示し反復実行を誘導しないを検証する。
 *
 * @responsibility 実CLIの人間表示はmanual recoveryとEvidence不明を示し反復実行を誘導しないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実CLIの人間表示はmanual recoveryとEvidence不明を示し反復実行を誘導しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("実CLIの人間表示は現在回復の停止を示し反復実行を誘導しない", () => {
  const result = invokeCli(false);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /Coordinator Task回復: 停止/u);
  assert.match(result.stdout, new RegExp(`回復ID: ${recoveryId}`, "u"));
  assert.match(result.stdout, /Task回復完了: いいえ/u);
  assert.match(
    result.stdout,
    /理由: docker_task_recovery_preparation_unconfirmed/u,
  );
  assert.doesNotMatch(result.stdout, /次の操作: coordinator doctor/u);
  assert.doesNotMatch(result.stdout, /C:\\/u);
  assert.equal(result.stderr, "");
});

/**
 * CLI共通projectorはEvidenceの保持・非保持・不明を推測せず分離するを検証する。
 *
 * @responsibility CLI共通projectorはEvidenceの保持・非保持・不明を推測せず分離するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI共通projectorはEvidenceの保持・非保持・不明を推測せず分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI共通projectorはEvidenceの保持・非保持・不明を推測せず分離する", () => {
  for (const [evidenceState, expected] of [
    ["preserved", /回復根拠: 保持済み/u],
    ["not_preserved", /回復根拠: 保持されていません/u],
    ["unknown", /回復根拠: 保持状況は未確認/u],
  ] as const) {
    const human = renderDockerRecoveryDoctorReport(
      {
        status: "blocked",
        reason: "docker_task_recovery_create_outcome_unknown",
        recoveryId: evidenceState === "not_preserved" ? null : recoveryId,
        manualRecoveryRequired: true,
        evidenceState,
      },
      false,
    );
    assert.match(human.stdout, expected);
    if (evidenceState === "not_preserved") {
      assert.match(human.stdout, /再利用できる回復IDは取得できていません/u);
      assert.match(
        human.stdout,
        /理由と回復根拠の保持状況をRuntime運用担当者へ渡してください/u,
      );
      assert.match(
        human.stdout,
        /名前やラベルだけを根拠に資源を削除しないでください/u,
      );
      assert.doesNotMatch(human.stdout, /次の操作: coordinator doctor/u);
    }
  }
});

/**
 * 日本語の復旧表示は三値とJSON・終了コードを保持するを検証する。
 *
 * @responsibility 日本語の復旧表示は三値とJSON・終了コードを保持するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 日本語の復旧表示は三値とJSON・終了コードを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("日本語の復旧表示は三値とJSON・終了コードを保持する", () => {
  for (const [observationConfirmed, expected] of [
    [true, "はい"],
    [false, "いいえ"],
    [null, "未確認"],
    [undefined, "未確認"],
  ] as const) {
    const report = Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "closed_retained",
      reason: "docker_desktop_repair_evidence_retention_closed",
      repairId: `docker-desktop-repair.${"a".repeat(32)}`,
      engineReady: observationConfirmed,
      processEffectIssued: observationConfirmed,
      filesystemEffectIssued: observationConfirmed,
      nativeHelperCleanupConfirmed: observationConfirmed,
      newRepairPermitted: observationConfirmed,
      staleRuntimeDirectory: "retained",
    });
    const human = renderDockerRecoveryDoctorReport(report, false);
    const json = renderDockerRecoveryDoctorReport(report, true);
    assert.equal(json.stdout, `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(human.exitCode, observationConfirmed === true ? 0 : 2);
    assert.equal(json.exitCode, human.exitCode);
    for (const label of [
      "Docker Engineの準備完了",
      "プロセス操作の発行",
      "ファイルシステム操作の発行",
      "ネイティブ補助プロセスの資源回収確認",
      "新しい復旧操作の許可",
    ])
      assert.ok(human.stdout.includes(`- ${label}: ${expected}\n`));
    assert.match(human.stdout, /プロセス操作の確認状態: unknown/u);
    assert.match(human.stdout, /ファイルシステム操作の確認状態: unknown/u);
    assert.match(human.stdout, /復旧根拠の保持状態: unknown/u);
    assert.match(human.stdout, /削除の実行: なし/u);
  }
});

/**
 * 日本語の手動復旧案内は復旧記録上限時の再試行・削除・改名禁止を保持するを検証する。
 *
 * @responsibility 日本語の手動復旧案内は復旧記録上限時の再試行・削除・改名禁止を保持するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 日本語の手動復旧案内は復旧記録上限時の再試行・削除・改名禁止を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("日本語の手動復旧案内は復旧記録上限時の再試行・削除・改名禁止を保持する", () => {
  for (const reason of [
    "docker_desktop_repair_record_capacity_unavailable",
    "docker_desktop_repair_operation_capacity_unavailable",
  ]) {
    const report = Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "blocked",
      reason,
      repairId: `docker-desktop-repair.${"b".repeat(32)}`,
      manualRecoveryRequired: true,
      operatorActionRequired: true,
      newRepairPermitted: false,
      nativeHelperCleanupConfirmed: null,
    });
    const human = renderDockerRecoveryDoctorReport(report, false);
    const json = renderDockerRecoveryDoctorReport(report, true);
    assert.equal(json.stdout, `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(human.exitCode, 2);
    assert.equal(json.exitCode, human.exitCode);
    assert.ok(human.stdout.includes(`- 理由: ${reason}\n`));
    assert.match(
      human.stdout,
      /新しい復旧の試行を止め、Runtime運用担当者へ連絡/u,
    );
    assert.match(
      human.stdout,
      /保持した根拠や段階記録を手動で削除・改名しない/u,
    );
    assert.match(
      human.stdout,
      /復旧記録の上限: 再試行や復旧記録の削除・圧縮をしない/u,
    );
    assert.doesNotMatch(human.stdout, /--close-docker-desktop-runtime-repair/u);
  }
});

/**
 * 日本語の環境診断は未実行・状態変更なし・認証値非記録を明示するを検証する。
 *
 * @responsibility 日本語の環境診断は未実行・状態変更なし・認証値非記録を明示するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 日本語の環境診断は未実行・状態変更なし・認証値非記録を明示するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("日本語の環境診断は未実行・状態変更なし・認証値非記録を明示する", () => {
  const report = Object.freeze({
    status: "blocked",
    providers: {
      codex: { located: true },
      claude: { located: false },
    },
    credentials: { valuesRecorded: false },
    filesystem: { enforcement: "fixture_filesystem_enforcement" },
    egress: { providerAllowlist: "fixture_provider_allowlist" },
    runtimeRootEvaluation: { status: "candidate" },
    blockers: [{ id: "fixture_check", reason: "fixture_reason" }],
  });
  const human = renderDockerRecoveryDoctorReport(report, false);
  const json = renderDockerRecoveryDoctorReport(report, true);
  assert.equal(json.stdout, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(human.exitCode, 2);
  assert.equal(json.exitCode, human.exitCode);
  assert.match(
    human.stdout,
    /codex: 実行ファイルを検出; 実行による確認は行っていません/u,
  );
  assert.match(
    human.stdout,
    /claude: 実行ファイルが見つかりません; 実行による確認は行っていません/u,
  );
  assert.match(human.stdout, /認証情報の値の記録: なし/u);
  assert.match(
    human.stdout,
    /ファイルシステム制約の強制状態: fixture_filesystem_enforcement/u,
  );
  assert.match(
    human.stdout,
    /Provider外部送信先の許可リスト: fixture_provider_allowlist/u,
  );
  assert.match(
    human.stdout,
    /Runtimeルートの評価: candidate; 状態変更は行っていません/u,
  );
  assert.match(human.stdout, /実行を妨げる事項: 1/u);
  assert.match(human.stdout, /fixture_check: fixture_reason/u);
});

/**
 * CLI共通projectorはHost release不明時もexact IDと再実行commandを保持するを検証する。
 *
 * @responsibility CLI共通projectorはHost release不明時もexact IDと再実行commandを保持するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI共通projectorはHost release不明時もexact IDと再実行commandを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI共通projectorはHost release不明時もexact IDと再実行commandを保持する", () => {
  const report = Object.freeze({
    status: "blocked",
    reason: "host_recovery_generation_release_unconfirmed",
    recoveryId: hostRecoveryId,
  });
  const json = renderDockerRecoveryDoctorReport(report, true);
  assert.equal(json.exitCode, 2);
  assert.deepEqual(JSON.parse(json.stdout), report);
  const human = renderDockerRecoveryDoctorReport(report, false);
  assert.equal(human.exitCode, 2);
  assert.match(human.stdout, new RegExp(hostRecoveryId, "u"));
  assert.match(
    human.stdout,
    new RegExp(
      `次の操作: coordinator doctor --recover-isolation ${hostRecoveryId}`,
      "u",
    ),
  );
  assert.doesNotMatch(human.stdout, /C:\\/u);
});

/**
 * CLI共通projectorはthird stateをblocked、回復成功をexit 0へ分離するを検証する。
 *
 * @responsibility CLI共通projectorはthird stateをblocked、回復成功をexit 0へ分離するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI共通projectorはthird stateをblocked、回復成功をexit 0へ分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI共通projectorはthird stateをblocked、回復成功をexit 0へ分離する", () => {
  const third = {
    status: "blocked",
    reason: "docker_task_recovery_root_unverified",
  };
  assert.equal(third.status, "blocked");
  const blocked = renderDockerRecoveryDoctorReport(third, false);
  assert.equal(blocked.exitCode, 2);
  assert.match(blocked.stdout, /docker_task_recovery_root_unverified/u);
  const recovered = renderDockerRecoveryDoctorReport(
    {
      status: "recovered",
      reason: "docker_task_recovery_completed",
      recoveryId: null,
    },
    true,
  );
  assert.equal(recovered.exitCode, 0);
  assert.equal(JSON.parse(recovered.stdout).status, "recovered");
});
