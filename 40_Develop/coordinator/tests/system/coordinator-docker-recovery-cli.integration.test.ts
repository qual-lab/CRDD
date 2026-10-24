/**
 * coordinator:system:coordinator-docker-recovery-cliの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:coordinator-docker-recovery-cliが所有する検証責務を実行する。
 * @trace PRL-ST-001
 * @level ST
 * @scope coordinator、docker、recovery、cli
 * @boundary PRL-ST-001=System/E2E: 公開入口→Coordinator→Execution→受入
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
import { renderDockerRecoveryDoctorReport } from "../../src/cli/recovery-report.ts";
import { parseDoctorArguments } from "../../src/cli/options.ts";

const recoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
const hostRecoveryId = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;

/**
 * 現在CLIは正式APIを一度待機しRootと取消を結合する。
 * @responsibility 移管後の正式APIとCLI取消・表示の接続を確認する。
 * @trace PRL-ST-001
 * @precondition 実CLI本文と有限代役、合成参照だけを使用する。
 * @stimulus 正常・取消・入力拒否・解除失敗を与える。
 * @observation API呼出し、元参照、Signal、解除順、出力と終了値。
 * @oracle 受付拒否は下位0、一次理由保持、表示後の再送なし。
 * @cleanup VM内のみ。実Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=Related 2 Blocks: 正式APIとCLI。
 */
test("現在CLIは正式APIを一度待機しRootと取消を結合する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/cli/doctor.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    source
      .slice(source.indexOf("export async function runDoctorCommand"))
      .replace("export ", ""),
  );
  const id = "docker-runtime-repair." + "a".repeat(64) + "." + "b".repeat(64);
  for (const action of [
    "repair-docker",
    "retain-repair",
    "resume",
    "restart-docker",
  ]) {
    for (const scenario of [
      "normal",
      "binding",
      "root",
      "resolve_throw",
      "producer_throw",
      "unbind",
      "unbind_throw",
      "render_throw",
      "write_throw",
      "cancel",
    ]) {
      let calls = 0,
        output = "",
        exitCode = -1,
        releases = 0;
      const events: string[] = [];
      const controllerRoot = {};
      const args =
        action === "repair-docker"
          ? ["maintenance", action, "--json"]
          : action === "retain-repair"
            ? ["maintenance", action, id, "--json"]
            : [
                "recovery",
                action,
                action === "resume" ? id : recoveryId,
                "--json",
              ];
      /**
       * 有限の修復結果を返し、CLIからの元参照と取消Signalを観測する。
       * @responsibility 正式API代役の呼出し回数・相関と注入故障を検査する。
       * @trace PRL-ST-001
       * @precondition 合成ID・Rootと固定scenarioだけを使用する。
       * @stimulus 実CLI本文からAPIへ要求を渡す。
       * @observation 引数、Signal、呼出し数と固定結果を取得する。
       * @oracle 同じ参照を一度だけ受け、例外の自由本文は公開しない。
       * @cleanup N/A: VM内の値だけで実Docker・外部AIを使わない。
       * @boundary PRL-ST-001=Related 2 Blocks: CLIと正式APIの有限代役。
       */
      const produce = async (...received: unknown[]) => {
        calls++;
        events.push("api");
        const signal = received.at(-1);
        assert.ok(signal instanceof AbortSignal);
        assert.equal(
          (received.at(-2) as { rootCapability: unknown }).rootCapability,
          controllerRoot,
        );
        if (action !== "repair-docker")
          assert.equal(
            (received[0] as { recoveryId: string }).recoveryId,
            args[2],
          );
        if (scenario === "producer_throw")
          throw Error("PRIVATE_FIXTURE_DETAIL");
        return {
          status: "blocked",
          reason: "runtime_repair_failed_closed",
          recoveryId: action === "repair-docker" ? id : args[2],
          cleanupConfirmed: true,
          restartCompleted: false,
          taskRecoveryCompleted: false,
          finalCheckpointConfirmed: false,
          outcomeConfirmed: false,
          retentionConfirmed: false,
          retentionReviewAfter: null,
          historyConfirmed: false,
          completionConfirmed: false,
          nativeCleanupConfirmed: false,
        };
      };
      const context = {
        AbortController,
        parseDoctorArguments,
        UsageError: class extends Error {},
        resolveVerifiedRepositoryRootFromWorkingDirectory: () => {
          if (scenario === "resolve_throw")
            throw Error("PRIVATE_FIXTURE_DETAIL");
          return "fixture-root";
        },
        verifyRepositoryRoot: () =>
          scenario === "root"
            ? { status: "blocked" }
            : { status: "completed", capability: controllerRoot },
        bindTaskCliCancellationSignals: (cancel: () => void) => {
          if (scenario === "cancel") cancel();
          return {
            status: scenario === "binding" ? "blocked" : "bound",
            unbind: () => {
              releases++;
              events.push("release");
              if (scenario === "unbind_throw")
                throw Error("PRIVATE_FIXTURE_DETAIL");
              return { status: scenario === "unbind" ? "unknown" : "released" };
            },
          };
        },
        diagnoseEnvironment: () => {
          throw Error("unexpected_diagnosis");
        },
        recoverExecution: produce,
        restartDockerForRecovery: produce,
        repairDockerRuntime: produce,
        retainRepair: produce,
        renderDockerRecoveryDoctorReport: (report: unknown, json: boolean) => {
          events.push("render");
          if (scenario === "render_throw")
            throw Error("PRIVATE_FIXTURE_DETAIL");
          return renderDockerRecoveryDoctorReport(
            JSON.parse(JSON.stringify(report)),
            json,
          );
        },
        renderDoctorCommandFailure: () => ({
          json: JSON.stringify({ status: "blocked", reason: "fixed_failure" }),
          human: "fixed_failure",
          exitCode: 2,
        }),
        process: {
          cwd: () => "fixture-root",
          stdout: {
            write: (value: string) => {
              if (scenario === "write_throw")
                throw Error("PRIVATE_FIXTURE_DETAIL");
              output += value;
            },
          },
          stderr: {
            write: (value: string) => {
              output += value;
            },
          },
          set exitCode(value: number) {
            exitCode = value;
          },
        },
      };
      const run = runInNewContext(body + ";runDoctorCommand", context);
      if (scenario === "write_throw") await assert.rejects(run(args));
      else await run(args);
      assert.equal(
        calls,
        ["root", "resolve_throw", "binding"].includes(scenario) ? 0 : 1,
        scenario,
      );
      assert.equal(
        releases,
        ["root", "resolve_throw"].includes(scenario) ? 0 : 1,
        scenario,
      );
      assert.doesNotMatch(output, /PRIVATE_FIXTURE_DETAIL/);
      if (
        scenario === "normal" ||
        scenario === "unbind" ||
        scenario === "unbind_throw" ||
        scenario === "cancel"
      ) {
        const result = JSON.parse(output);
        assert.equal(
          result.reason,
          "runtime_repair_failed_closed",
          `${action}/${scenario}: ${output}`,
        );
        assert.equal(
          result.recoveryId,
          action === "repair-docker" ? id : args[2],
        );
        if (action !== "restart-docker")
          assert.equal(
            result.cliCleanupConfirmed,
            !scenario.startsWith("unbind"),
          );
        assert.ok(events.indexOf("release") < events.indexOf("render"));
        assert.equal(exitCode, 2);
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
 * 新文法のparserは処置の混在と旧flagを拒否する。
 * @responsibility 移管後の正式APIとCLI取消・表示の接続を確認する。
 * @trace PRL-ST-001
 * @precondition 実CLI本文と有限代役、合成参照だけを使用する。
 * @stimulus 正常・取消・入力拒否・解除失敗を与える。
 * @observation API呼出し、元参照、Signal、解除順、出力と終了値。
 * @oracle 受付拒否は下位0、一次理由保持、表示後の再送なし。
 * @cleanup VM内のみ。実Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=Related 2 Blocks: 正式APIとCLI。
 */
test("新文法のparserは処置の混在と旧flagを拒否する", () => {
  for (const args of [
    ["doctor", "check"],
    ["doctor", "isolation", "--json"],
    ["maintenance", "repair-docker"],
  ])
    assert.equal(parseDoctorArguments(args, undefined).status, "ok");
  for (const args of [
    ["doctor"],
    ["doctor", "--isolation"],
    ["maintenance", "repair-docker", "--isolation"],
    ["recovery", "resume"],
    ["recovery", "resume", recoveryId, "--json", "--json"],
    ["recovery", "restart-docker", "invalid"],
    ["maintenance", "retain-repair", recoveryId],
  ])
    assert.equal(parseDoctorArguments(args, undefined).status, "blocked");
});

/**
 * 修復の公開投影は内部保存checkpointを返さない。
 * @responsibility 移管後の正式APIとCLI取消・表示の接続を確認する。
 * @trace PRL-ST-001
 * @precondition 実CLI本文と有限代役、合成参照だけを使用する。
 * @stimulus 正常・取消・入力拒否・解除失敗を与える。
 * @observation API呼出し、元参照、Signal、解除順、出力と終了値。
 * @oracle 受付拒否は下位0、一次理由保持、表示後の再送なし。
 * @cleanup VM内のみ。実Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=Related 2 Blocks: 正式APIとCLI。
 */
test("修復の公開投影は内部保存checkpointを返さない", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function projectRuntimeRepairObservation(",
  );
  const end = source.indexOf("\n/**", start);
  const body = stripTypeScriptTypes(
    source.slice(start, end < 0 ? undefined : end).replace("export ", ""),
  );
  const project = runInNewContext(
    body + ";projectRuntimeRepairObservation",
    {},
  );
  const value = project(
    {
      status: "blocked",
      reason: "primary_fixture_failure",
      recoveryId,
      finalCheckpointConfirmed: false,
      outcomeConfirmed: false,
      retentionConfirmed: false,
      retentionReviewAfter: null,
      historyConfirmed: false,
      completionConfirmed: false,
      nativeCleanupConfirmed: false,
      statePublication: { private: "PRIVATE_FIXTURE_DETAIL" },
      stateMarkerCleanup: { private: "PRIVATE_FIXTURE_DETAIL" },
      checkpoints: ["PRIVATE_FIXTURE_DETAIL"],
    },
    null,
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    [
      "status",
      "reason",
      "recoveryId",
      "finalCheckpointConfirmed",
      "outcomeConfirmed",
      "retentionConfirmed",
      "retentionReviewAfter",
      "historyConfirmed",
      "completionConfirmed",
      "nativeCleanupConfirmed",
    ].sort(),
  );
  assert.equal(value.reason, "primary_fixture_failure");
  const expected =
    "docker-runtime-repair." + "a".repeat(64) + "." + "b".repeat(64);
  const other =
    "docker-runtime-repair." + "c".repeat(64) + "." + "d".repeat(64);
  const mismatch = project(
    {
      ...value,
      recoveryId: other,
      completionConfirmed: true,
      historyConfirmed: true,
    },
    expected,
  );
  assert.equal(mismatch.recoveryId, expected);
  assert.equal(mismatch.status, "blocked");
  assert.equal(mismatch.reason, "runtime_repair_boundary_unavailable");
  for (const key of [
    "finalCheckpointConfirmed",
    "outcomeConfirmed",
    "retentionConfirmed",
    "historyConfirmed",
    "completionConfirmed",
    "nativeCleanupConfirmed",
  ])
    assert.equal(mismatch[key], false);
  assert.equal(mismatch.retentionReviewAfter, null);
  assert.equal(JSON.stringify(mismatch).includes(other), false);
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_FIXTURE_DETAIL/);
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
    /技術回収済み・Task側の受領待ち/,
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
          "recovery",
          "resume",
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

/**
 * 修復・保持・再入場の三正式入口は同じexact参照を投影する。
 * @responsibility 下位が別IDを返す反例を三Consumerへ接続する。
 * @trace PRL-ST-001
 * @precondition 実API／回復本文と有限の下位代役だけ。
 * @stimulus 下位が別操作の成功を返す。
 * @observation 元ID、公開確認値と下位呼出し回数。
 * @oracle 元IDのblocked・全確認falseとなり、別IDを公開しない。
 * @cleanup VM内のみ。Docker・保存・外部AIなし。
 * @boundary PRL-ST-001=Related 2 Blocks: API→既存回復→公開投影。
 */
test("修復保持再入場の三入口は別IDの成功を元要求へ転用しない", async () => {
  const api = fs.readFileSync(
    new URL("../../src/api.ts", import.meta.url),
    "utf8",
  );
  const recovery = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const expected =
    "docker-runtime-repair." + "a".repeat(64) + "." + "b".repeat(64);
  const other =
    "docker-runtime-repair." + "c".repeat(64) + "." + "d".repeat(64);
  const projectionStart = recovery.indexOf(
    "export function projectRuntimeRepairObservation(",
  );
  const projector = stripTypeScriptTypes(
    recovery.slice(projectionStart).replace("export ", ""),
  );
  for (const [source, name] of [
    [api, "repairDockerRuntime"],
    [api, "retainRepair"],
    [recovery, "resumeRuntimeOwnedExecution"],
  ] as const) {
    const start = source.indexOf("export async function " + name + "("),
      end = source.indexOf("\n}\n", start);
    assert.ok(start >= 0 && end > start);
    const body = stripTypeScriptTypes(
      source.slice(start, end + 3).replace("export ", ""),
    );
    let calls = 0;
    const context = {
      AbortController,
      executionRoot: () => {},
      executionSignal: (signal: AbortSignal) => signal,
      recoveryReference: (request: { recoveryId: string }) =>
        request.recoveryId,
      readExecutionCancellation: () => false,
      repairRuntimeOwnedDockerRuntime: async () => {
        calls++;
        return {
          status: "observed",
          reason: "runtime_repair_recovered",
          recoveryId: other,
          finalCheckpointConfirmed: true,
          outcomeConfirmed: true,
          retentionConfirmed: true,
          retentionReviewAfter: "2026-11-01T00:00:00.000Z",
          historyConfirmed: true,
          completionConfirmed: true,
          nativeCleanupConfirmed: true,
        };
      },
    };
    const operation = runInNewContext(
      projector + "\n" + body + ";" + name,
      context,
    );
    const result = await operation(
      name === "resumeRuntimeOwnedExecution"
        ? expected
        : { recoveryId: expected },
      { rootCapability: {} },
      new AbortController().signal,
    );
    assert.equal(calls, 1);
    assert.equal(result.status, "blocked");
    assert.equal(result.recoveryId, expected);
    assert.equal(result.reason, "runtime_repair_boundary_unavailable");
    for (const key of [
      "finalCheckpointConfirmed",
      "outcomeConfirmed",
      "retentionConfirmed",
      "historyConfirmed",
      "completionConfirmed",
      "nativeCleanupConfirmed",
    ])
      assert.equal(result[key], false);
    assert.equal(JSON.stringify(result).includes(other), false);
  }
});
