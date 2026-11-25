/**
 * coordinator:integration:cli-optionsの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:cli-optionsが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @trace ERB-IT-003
 * @level IT
 * @scope cli、options
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Coordinator Application Port→Core
 * @boundary ERB-IT-003=Direct Boundary: CLIの実private読取り本文→Reader故障注入。実Kernel・実CLI搬送は現在状態ITで別確認する。
 */
import assert from "node:assert/strict";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { parseRepositoryProjectContextMarkdown } from "@qual-lab/crdd-document-model";

import {
  parseDoctorArguments,
  renderDockerRecoveryDoctorReport,
} from "../../src/cli/command.ts";

import { assertPresent } from "../support/contract-assertions.ts";
import { withUnsignedRuntimeFixture } from "../support/unsigned-distribution-fixture.ts";

const coordinatorExecutable = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../bin/coordinator.ts",
);

/**
 * CLIが実Context Parserの部分結果を必要な内容として搬送する。
 * @responsibility Checklist不備を起動拒否へ昇格せず、構造欠測と読取り故障を拒否する。
 * @trace PRL-IT-012
 * @precondition 実CLI関数本文・実Parserと、外部Effectを発行しない有限依存。
 * @stimulus Checklistだけ未評価の本文、構造欠測、読取り故障、又は取消登録・解放の失敗を与える。
 * @observation Project ID搬送、Task受付代役の回数、取消解放と出力。
 * @oracle 部分結果を搬送し、不正・読取り故障・登録拒否はTask受付0。解放失敗でも元回復参照を保つ。
 * @cleanup N/A: 読取り済み文字列とVM内のみ。実Listenerは登録しない。
 * @boundary CLIの受付接続を検証し、実CLI・Task・AI完了の証明とは区別する。
 */
test("通常Task CLIはContext部分結果を搬送し構造欠測を拒否する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/cli/command.ts", import.meta.url),
    "utf8",
  );
  const offset = source.indexOf("export async function runSingleTaskCommand(");
  assert.ok(offset > 0);
  const body = sourceDeclaration(source, "runSingleTaskCommand");
  const complete = fs.readFileSync(
    new URL("../../../../PROJECT_CONTEXT.md", import.meta.url),
    "utf8",
  );
  assert.equal(
    parseRepositoryProjectContextMarkdown(complete).status,
    "complete",
  );
  const partial = complete.replace(/^- \[x\]/mu, "- [ ]");
  const actual = parseRepositoryProjectContextMarkdown(partial);
  assert.equal(actual.status, "partial");
  assert.ok(actual.result);
  for (const scenario of [
    { operation: "task", fault: "partial" },
    { operation: "task", fault: "invalid" },
    { operation: "task", fault: "read" },
    { operation: "task", fault: "mismatch" },
    { operation: "task", fault: "bind" },
    { operation: "task", fault: "release-known" },
    { operation: "task", fault: "release-unknown" },
    { operation: "advice", fault: "partial" },
    { operation: "advice", fault: "invalid" },
    { operation: "advice", fault: "read" },
    { operation: "advice", fault: "mismatch" },
  ] as const) {
    const { operation, fault } = scenario;
    const releaseFailed =
      fault === "release-known" || fault === "release-unknown";
    const executionUnknown = fault === "release-unknown";
    const recoveryIds = executionUnknown ? ["host-operation.OP-123456"] : [];
    const result = {
      status: executionUnknown ? "unknown" : "completed",
      cleanupConfirmed: !executionUnknown,
      recoveryIds,
      reason: executionUnknown ? "fixture_cleanup_unconfirmed" : null,
      secondaryFailures: executionUnknown ? ["fixture_primary_secondary"] : [],
    };
    const mode = operation === "advice" ? "read_only_advice" : "workspace_edit";
    let tasks = 0,
      binds = 0,
      releases = 0;
    let output = "";
    const capability = {};
    const localProcess = {
      cwd: () => "logical-root",
      stdout: {
        write: (value: string) => {
          output += value;
        },
      },
      exitCode: -1,
    };
    const run = runInNewContext(`${body}; runSingleTaskCommand`, {
      path,
      process: localProcess,
      AbortController,
      UsageError: class extends Error {},
      isPrincipalId: () => true,
      inspectSingleTaskCommand: () => ({
        mode:
          fault === "mismatch"
            ? mode === "workspace_edit"
              ? "read_only_advice"
              : "workspace_edit"
            : mode,
      }),
      readBoundedTaskRequestFromStdin: () => ({}),
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => "logical-root",
      getRepository: () => ({ status: "completed", capability }),
      readStableFileSnapshot: () => {
        if (fault === "read") throw new Error("fixture_read_failed");
        return {
          bytes: Buffer.from(fault === "invalid" ? "# Broken" : partial),
        };
      },
      parseRepositoryProjectContextMarkdown,
      bindTaskCliCancellationSignals: () => {
        binds++;
        return {
          status: fault === "bind" ? "binding_failed" : "bound",
          unbind: () => {
            releases++;
            if (releaseFailed) return { status: "failed" };
            return { status: "released" };
          },
        };
      },
      runTask: async (
        context: {
          projectId: string;
          rootCapability: unknown;
          authorize: () => boolean;
        },
        command: { mode: string },
      ) => {
        tasks++;
        assert.equal(command.mode, mode);
        assert.equal(context.projectId, actual.result?.projectId);
        assert.equal(context.rootCapability, capability);
        assert.equal(context.authorize(), true);
        return result;
      },
    }) as (args: readonly string[]) => Promise<void>;
    await run([
      operation,
      "--request-stdin",
      "--json",
      "--principal-id",
      "local.email.fixture@example.invalid",
    ]);
    const expected = fault === "partial" || releaseFailed ? 1 : 0;
    assert.deepEqual(
      [tasks, binds, releases],
      [
        expected,
        fault === "bind" ? 1 : expected,
        fault === "bind" ? 1 : expected,
      ],
    );
    const report = JSON.parse(output);
    assert.equal(report.command, operation);
    if (fault === "mismatch")
      assert.equal(
        report.reason,
        operation === "advice"
          ? "advice_request_required"
          : "task_workspace_request_required",
      );
    if (fault === "bind")
      assert.equal(report.reason, "task_cancellation_binding_failed");
    if (releaseFailed) {
      assert.deepEqual(report, {
        command: operation,
        ...result,
        status: "unknown",
        secondaryFailures: [
          ...result.secondaryFailures,
          "task_cancellation_release_unconfirmed",
        ],
      });
    } else
      assert.equal(
        report.status,
        fault === "partial" ? "completed" : "blocked",
      );
    assert.equal(localProcess.exitCode, fault === "partial" ? 0 : 2);
  }
});
const publicCoordinatorLauncher = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../template/tools/crdd-coordinator.ts",
);

/**
 * 旧修復CLIは形式の正しさにかかわらず現在処置の前で拒否する。
 * @responsibility 旧署名Root・旧修復IDをRuntimeのAuthorityへ復元しないことを確認する。
 * @trace PRL-IT-012
 * @precondition 実parserと実入口、子のProcess要求と同期Filesystem変更を拒否する。
 * @stimulus 旧四flagの単独・値付き・現在回復との混在を両順序で渡す。
 * @observation parser結果、終了コード、Process／保存要求件数。
 * @oracle Usage64・doctor_arguments_invalid・処置DTOなし、Process／保存0。
 * @cleanup 子は終了待機する。実Docker・認証・一時File生成なし。
 * @boundary PRL-IT-012=Related 2 Blocks: 実入口→parser→処置前拒否。
 */
test("旧修復CLIは実入口で署名Root解決やProcess要求より先に拒否する", () => {
  const task = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const old = `docker-desktop-repair.${"d".repeat(32)}`;
  const cases: string[][] = [];
  const releaseRoot = path.resolve("historical-release-not-used");
  cases.push(
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
      task,
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
      task,
    ],
  );
  for (const flag of [
    "--close-docker-desktop-runtime-repair",
    "--adopt-docker-desktop-repair",
    "--after-docker-desktop-repair",
    "--repair-release-root",
  ]) {
    for (const args of [
      [flag],
      [flag, old],
      [flag, old, "--recover-isolation", task],
      ["--recover-isolation", task, flag, old],
    ]) {
      cases.push(args);
      const result = parseDoctorArguments(args, undefined);
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "doctor_arguments_invalid");
      assert.equal(result.value, null);
    }
  }
  const entry = coordinatorExecutable;
  for (const args of cases) {
    const denied = parseDoctorArguments(args, undefined);
    assert.equal(denied.status, "blocked");
    assert.equal(denied.reason, "doctor_arguments_invalid");
    assert.equal(denied.value, null);
    const result = spawnSync(process.execPath, ["-"], {
      input: `const assert=(await import('node:assert/strict')).default;
const cp=(await import('node:child_process')).default;
const fs=(await import('node:fs')).default;
const {syncBuiltinESMExports}=await import('node:module');
const {pathToFileURL}=await import('node:url');
let effects=0, output='';
/**
 * 旧CLI操作がEffectへ到達したら試験を失敗させる。
 * @responsibility 旧CLI操作がEffectへ到達したら試験を失敗させる。
 * @trace PRL-IT-012
 * @precondition 子Process内の旧処置先を拒否代役へ置換。
 * @stimulus 到達回数を増やし固定例外を投げる。
 * @observation effectsとCLIの不正操作結果。
 * @oracle 旧candidate入力はこの代役へ到達せず拒否される。
 * @cleanup 子を待機しModule mockは子終了で破棄する。
 * @boundary 実CLI子の配送検査だけ。旧Storeを生成しない。
 */
const refuse=()=>{effects++;throw Error('retired_effect_forbidden')};
for(const key of ['spawn','spawnSync','execFile','execFileSync','exec','execSync','fork'])cp[key]=refuse;
for(const key of ['writeFileSync','appendFileSync','mkdirSync','renameSync','rmSync','unlinkSync','rmdirSync'])fs[key]=refuse;
syncBuiltinESMExports();
process.stdout.write=(chunk)=>{output+=String(chunk);return true};
let index=0;
for(const args of ${JSON.stringify([args])}) {
 output='';process.exitCode=0;
 process.argv=[process.execPath,${JSON.stringify(coordinatorExecutable)},'doctor',...args,'--json'];
 await import(pathToFileURL(${JSON.stringify(entry)}).href+'?retired='+index++);
 assert.equal(process.exitCode,64);
 const report=JSON.parse(output);assert.equal(report.status,'blocked');assert.equal(report.reason,'doctor_arguments_invalid');
 assert.equal(effects,0);
}
process.exitCode=0;`,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
  }
});

/**
 * 検証付き再起動と通常回復はexact Taskを指定する別操作を検証する。
 *
 * @responsibility 現在の二入口を受理し、廃止した記録後専用flagは引数処理で拒否する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact Taskの再起動・通常回復と、旧flag付きの入力を比較する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("検証付き再起動と通常回復はexact Taskを指定し旧flagを拒否する", () => {
  const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const restart = parseDoctorArguments(
    ["recovery", "resume", id, "--restart-docker", "--json"],
    undefined,
  );
  assert.equal(restart.status, "ok");
  assert.equal(restart.value?.recoveryId, id);
  const recover = parseDoctorArguments(["recovery", "resume", id], undefined);
  assert.equal(recover.status, "ok");
  assert.equal(recover.value?.recoveryId, id);
  assert.equal(
    Object.hasOwn(recover.value, "afterRecordedDockerRestart"),
    false,
  );
  const retired = parseDoctorArguments(
    ["--recover-isolation", id, "--after-recorded-docker-restart", "--json"],
    undefined,
  );
  assert.equal(retired.status, "blocked");
  assert.equal(retired.reason, "doctor_arguments_invalid");
  assert.equal(retired.value, null);
  const rejected = spawnSync(process.execPath, ["-"], {
    input: `const assert = (await import('node:assert/strict')).default;
const cp = (await import('node:child_process')).default;
const {syncBuiltinESMExports} = await import('node:module');
let calls = 0;
cp.spawnSync = () => { calls++; throw new Error('retired_flag_effect_forbidden'); };
syncBuiltinESMExports();
process.argv = [process.execPath, ${JSON.stringify(coordinatorExecutable)}, 'doctor', '--recover-isolation', ${JSON.stringify(id)}, '--after-recorded-docker-restart', '--json'];
await import(${JSON.stringify(new URL("../../bin/coordinator.ts", import.meta.url).href)});
assert.equal(calls, 0); assert.equal(process.exitCode, 64);`,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  assert.equal(rejected.error, undefined);
  assert.equal(rejected.signal, null);
  assert.equal(rejected.status, 64, rejected.stderr);
  assert.equal(JSON.parse(rejected.stdout).reason, "doctor_arguments_invalid");
  for (const argumentValues of [
    ["--restart-docker-for-recovery"],
    ["--restart-docker-for-recovery", "invalid"],
    ["--restart-docker-for-recovery", id, "--isolation"],
    ["--restart-docker-for-recovery", id, "--recover-isolation", id],
    ["--restart-docker-for-recovery", id, "--repair-docker-desktop-runtime"],
    ["--restart-docker-for-recovery", id, "--after-recorded-docker-restart"],
    ["--after-recorded-docker-restart"],
    ["--recover-isolation", id, "--after-recorded-docker-restart"],
    ["--recover-isolation", "host.invalid", "--after-recorded-docker-restart"],
    [
      "--recover-isolation",
      id,
      "--after-recorded-docker-restart",
      "--after-docker-desktop-repair",
      `docker-desktop-repair.${"a".repeat(32)}`,
      "--repair-release-root",
      "C:\\old",
    ],
  ])
    assert.equal(
      parseDoctorArguments(argumentValues, undefined).status,
      "blocked",
      JSON.stringify(argumentValues),
    );
});

/**
 * 旧配布候補引数を通常再起動へ持ち込まないことを検証する。
 *
 * @responsibility 通常再起動と旧署名配布経路の分離を確認する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧配布候補引数を各順序・他操作との組合せで渡す。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("旧配布候補引数は通常再起動へ持ち込めない", () => {
  const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const option = "--restart-origin-release-root";
  const root = "C:\\origin";
  for (const args of [
    ["--restart-docker-for-recovery", id, option, root],
    [option, root, "--restart-docker-for-recovery", id, "--json"],
  ]) {
    const result = parseDoctorArguments(args, undefined);
    assert.equal(result.status, "blocked");
    assert.equal(result.value, null);
  }
  for (const args of [
    [option],
    [option, root],
    ["--restart-docker-for-recovery", id, option],
    ["--restart-docker-for-recovery", id, option, "--json"],
    ["--restart-docker-for-recovery", id, option, root, option, root],
    [
      "--restart-docker-for-recovery",
      id,
      option,
      root,
      "--repair-release-root",
      root,
    ],
    ["--recover-isolation", id, option, root],
    ["--isolation", option, root],
    ["--repair-docker-desktop-runtime", option, root],
  ])
    assert.equal(
      parseDoctorArguments(args, undefined).status,
      "blocked",
      JSON.stringify(args),
    );
});

/**
 * 再起動結果はTask回復を成功へ混同せずcleanup不明を拒否するを検証する。
 *
 * @responsibility 再起動結果はTask回復を成功へ混同せずcleanup不明を拒否するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 再起動結果はTask回復を成功へ混同せずcleanup不明を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("再起動結果はTask回復を成功へ混同せずcleanup不明を拒否する", () => {
  const base = {
    contract: "crdd-coordinator/docker-restart-for-recovery",
    status: "completed",
    reason: "docker_restart_settled",
    restartCompleted: true,
    taskRecoveryCompleted: false,
    cleanupConfirmed: true,
  };
  assert.equal(renderDockerRecoveryDoctorReport(base, true).exitCode, 0);
  assert.match(
    renderDockerRecoveryDoctorReport(base, false).stdout,
    /Taskの復旧・再実行は行っていません/u,
  );
  for (const patch of [
    { cleanupConfirmed: false },
    { restartCompleted: false },
    { taskRecoveryCompleted: true },
    { status: "blocked" },
  ]) {
    assert.equal(
      renderDockerRecoveryDoctorReport({ ...base, ...patch }, true).exitCode,
      2,
    );
  }
});

/**
 * doctorは診断と復旧に必要な引数だけを受理するを検証する。
 *
 * @responsibility doctorは診断と復旧に必要な引数だけを受理するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus doctorは診断と復旧に必要な引数だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("doctorは診断と復旧に必要な引数だけを受理する", () => {
  assert.equal(parseDoctorArguments(["doctor"], undefined).status, "ok");
  assert.equal(
    parseDoctorArguments(
      ["recovery", "resume", "host.safe", "--json"],
      undefined,
    ).status,
    "ok",
  );
  for (const argumentValues of [
    ["--json", "--json"],
    ["--unknown"],
    ["extra"],
    ["--recover-isolation", "host.safe", "--isolation"],
    ["--enable-runtime"],
    ["--runtime-root", path.resolve("runtime-root")],
  ]) {
    assert.equal(
      parseDoctorArguments(argumentValues, undefined).status,
      "blocked",
    );
  }
});

/**
 * Docker Desktop最終復旧は単独の明示doctor処置としてだけ受理するを検証する。
 *
 * @responsibility Docker Desktop最終復旧は単独の明示doctor処置としてだけ受理するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker Desktop最終復旧は単独の明示doctor処置としてだけ受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker Desktop最終復旧は単独の明示doctor処置としてだけ受理する", () => {
  const repair = parseDoctorArguments(
    ["maintenance", "repair", "--json"],
    undefined,
  );
  assert.equal(repair.status, "ok");
  assertPresent(repair.value);
  assert.equal(repair.value.action, "repair-docker");

  assert.equal(
    parseDoctorArguments(
      ["--repair-docker-desktop-runtime", "--isolation"],
      undefined,
    ).reason,
    "doctor_arguments_invalid",
  );
});

/**
 * 明示保持の入力をexact修復IDだけに限定する。
 * @responsibility 他処置との混在・欠測から保持判断を推測しない。
 * @trace PRL-IT-012
 * @precondition 純粋parserと現在形式の修復参照。
 * @stimulus 正常、全doctor操作との両順序混在、不正・重複・欠測。
 * @observation status・reason・固定ID・他操作field。
 * @oracle 単独保持だけ受理し、拒否では処置DTOを返さない。
 * @cleanup N/A: 値の解析だけ。
 * @boundary 引数と明示保持判断。
 */
test("修復保持はexact IDの単独操作だけを受理する", () => {
  const id = `docker-repair.${"a".repeat(64)}.${"b".repeat(64)}`;
  const task = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const old = `docker-desktop-repair.${"c".repeat(32)}`;
  const flag = "--retain-docker-runtime-repair";
  const parsed = parseDoctorArguments(
    ["maintenance", "repair", "--retain", id, "--json"],
    "ignored-environment-root",
  );
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.value?.recoveryId, id);
  assert.equal(parsed.value?.action, "retain-repair");
  assert.equal(parsed.value?.recoveryId, id);
  for (const other of [
    ["--isolation"],
    ["--recover-isolation", id],
    ["--repair-docker-desktop-runtime"],
    ["--close-docker-desktop-runtime-repair", old],
    [
      "--adopt-docker-desktop-repair",
      old,
      "--repair-release-root",
      "C:\\fixed",
    ],
    [
      "--after-docker-desktop-repair",
      old,
      "--repair-release-root",
      "C:\\fixed",
    ],
    ["--repair-release-root", "C:\\fixed"],
    ["--restart-docker-for-recovery", task],
  ])
    for (const args of [
      [flag, id, ...other],
      [...other, flag, id],
    ]) {
      const denied = parseDoctorArguments(args, undefined);
      assert.equal(denied.status, "blocked", JSON.stringify(args));
      assert.equal(
        denied.reason,
        args.some((argument) =>
          [
            "--close-docker-desktop-runtime-repair",
            "--adopt-docker-desktop-repair",
            "--after-docker-desktop-repair",
            "--repair-release-root",
          ].includes(argument),
        )
          ? "doctor_arguments_invalid"
          : "doctor_arguments_invalid",
      );
      assert.equal(denied.value, null);
    }
  for (const args of [
    [flag],
    [flag, task],
    [flag, old],
    [flag, id.toUpperCase()],
    [flag, "invalid"],
    [flag, id, flag, id],
  ]) {
    const denied = parseDoctorArguments(args, id);
    assert.equal(denied.status, "blocked");
    assert.equal(denied.reason, "doctor_arguments_invalid");
    assert.equal(denied.value, null);
  }
  for (const args of [[flag], [flag, id, "--isolation"]]) {
    const result = spawnSync(process.execPath, ["-"], {
      input: `const assert=(await import('node:assert/strict')).default;
const cp=(await import('node:child_process')).default;
const {syncBuiltinESMExports}=await import('node:module');let calls=0;
for(const key of ['spawnSync','spawn','exec','execSync','execFile','execFileSync','fork']) cp[key]=()=>{calls++;throw Error('retention_rejection_effect_forbidden');};
syncBuiltinESMExports();process.argv=[process.execPath,${JSON.stringify(coordinatorExecutable)},'doctor',...${JSON.stringify(args)},'--json'];
await import(${JSON.stringify(new URL("../../bin/coordinator.ts", import.meta.url).href)});assert.equal(calls,0);assert.equal(process.exitCode,64);`,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 64, result.stderr);
    assert.equal(
      JSON.parse(result.stdout).reason,
      args.length === 1
        ? "doctor_arguments_invalid"
        : "doctor_arguments_invalid",
    );
  }
});

/**
 * 公開Capability表示はLocal Personalの成立済み入口だけを返すを検証する。
 *
 * @responsibility 公開Capability表示はLocal Personalの成立済み入口だけを返すの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開Capability表示はLocal Personalの成立済み入口だけを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開Capability表示はLocal Personalの成立済み入口だけを返す", () => {
  const result = spawnSync(
    process.execPath,
    [coordinatorExecutable, "capabilities", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.contract, "crdd-coordinator/capabilities");
  assert.equal(value.contractRevision, 11);
  assert.equal(value.executionAuthorityIssued, false);
  assert.deepEqual(value.operations, [
    "runObjective",
    "runTask",
    "openTaskSession",
    "submitDecision",
    "acceptResult",
    "queryState",
    "queryActivity",
    "readRepositoryNetworkHosts",
    "diagnoseEnvironment",
    "recoverExecution",
    "readRecovery",
    "restartDockerForRecovery",
    "repairDockerRuntime",
    "retainRepair",
    "getAuthenticationStatus",
    "authenticateProvider",
  ]);
  assert.equal(value.operations.includes("getCapabilities"), false);
  assert.deepEqual(
    value.commands.map((c: { invocation: string }) => c.invocation),
    [
      "run task --request-stdin --json --principal-id <local.email.address>",
      "run objective --request-stdin --json --principal-id <local.email.address>",
      "run advice --request-stdin --json --principal-id <local.email.address>",
      "doctor [--isolation] [--json]",
      "recovery resume <id> [--restart-docker] [--json]",
      "recovery inspect <id> [--json]",
      "maintenance repair [--retain <id>] [--json]",
      "auth status codex|claude [--json]",
      "auth login codex|claude",
      "capabilities --json",
    ],
  );
});

/**
 * template toolsの安定入口はCoordinator共通Launcherへ同一Processで接続するを検証する。
 *
 * @responsibility template toolsの安定入口はCoordinator共通Launcherへ同一Processで接続するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus template toolsの安定入口はCoordinator共通Launcherへ同一Processで接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("template toolsの安定入口はCoordinator共通Launcherへ同一Processで接続する", () => {
  const result = spawnSync(
    process.execPath,
    [publicCoordinatorLauncher, "capabilities", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.contract, "crdd-coordinator/capabilities");
  assert.equal(output.contractRevision, 11);
  assert.equal(
    output.commands.some(
      (entry: { command?: string }) => entry.command === "mcp",
    ),
    false,
  );
});

/**
 * 削除したcommandは互換処理へ入らず未知commandとして拒否されるを検証する。
 *
 * @responsibility 削除したcommandは互換処理へ入らず未知commandとして拒否されるの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 削除したcommandは互換処理へ入らず未知commandとして拒否されるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("削除したcommandは互換処理へ入らず未知commandとして拒否される", () => {
  for (const command of ["activate", "disable", "provision", "mcp"]) {
    const result = spawnSync(
      process.execPath,
      [coordinatorExecutable, command, "--json"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(result.status, 64);
    assert.equal(
      result.stderr.includes("coordinator_launch_mode_invalid"),
      true,
    );
    assert.equal(result.stdout.includes(`"command":"${command}"`), false);
  }
  const project = spawnSync(
    process.execPath,
    [coordinatorExecutable, "project", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(project.status, 64);
  assert.equal(project.stdout, "");
  assert.match(project.stderr, /coordinator_launch_mode_invalid/u);
  for (const args of [
    ["recovery", "restart-docker", "invalid"],
    ["maintenance", "repair-docker"],
    ["maintenance", "retain-repair", "invalid"],
  ]) {
    const rejected = spawnSync(
      process.execPath,
      [coordinatorExecutable, ...args, "--json"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(rejected.status, 64, rejected.stderr);
    assert.equal(
      JSON.parse(rejected.stdout).reason,
      "doctor_arguments_invalid",
    );
  }
});

/**
 * helpは通常Taskと現在利用可能なcommandだけを案内するを検証する。
 *
 * @responsibility helpは通常Taskと現在利用可能なcommandだけを案内するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus helpは通常Taskと現在利用可能なcommandだけを案内するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("helpは通常Taskと現在利用可能なcommandだけを案内する", () => {
  const result = spawnSync(process.execPath, [coordinatorExecutable, "help"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(
    result.stdout.includes("--after-recorded-docker-restart"),
    false,
  );
  assert.equal(
    result.stdout.includes("maintenance repair [--retain <id>]"),
    true,
  );
  assert.equal(result.stdout.includes("recovery resume"), true);
  assert.equal(result.status, 0);
  assert.equal(
    result.stdout.includes("coordinator run task --request-stdin --json"),
    true,
  );
  assert.equal(result.stdout.includes("coordinator capabilities --json"), true);
  assert.equal(result.stdout.includes("--repair-release-root"), false);
  assert.equal(
    result.stdout.includes("it is not the Docker task origin"),
    false,
  );
  assert.equal(result.stdout.includes("--from-release"), false);
  assert.equal(result.stdout.includes("coordinator activate"), false);
  assert.equal(result.stdout.includes("coordinator disable"), false);
  assert.equal(result.stdout.includes("coordinator provision"), false);
  assert.equal(result.stdout.includes("coordinator mcp"), false);
});

/**
 * 通常Taskは統一受付で入力を拒否し対象を推測しない。
 *
 * @responsibility 通常Taskの入力検査を配布署名から独立して確認する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 曖昧JSONと、未署名fixture上で必須項目が欠けた要求を渡す。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("通常Taskは統一受付で入力を拒否し対象を推測しない", () => {
  for (const entry of [coordinatorExecutable, publicCoordinatorLauncher]) {
    const ambiguous = spawnSync(
      process.execPath,
      [
        entry,
        "run",
        "task",
        "--request-stdin",
        "--json",
        "--principal-id",
        "local.email.fixture@example.invalid",
      ],
      {
        input: '{"frontProvider":"codex","frontProvider":"claude"}',
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(ambiguous.status, 2);
    assert.equal(ambiguous.stderr, "");
    assert.equal(
      JSON.parse(ambiguous.stdout).reason,
      "task_request_invalid_json",
    );
    for (const operation of ["task", "advice"]) {
      const input = {
        requestId: `mode-rejected-${operation}`,
        mode: operation === "task" ? "read_only_advice" : "workspace_edit",
        workType: null,
        prompt: "合成入力。実行しない。",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: operation === "task" ? [] : ["src/file.ts"],
        workspaceId: null,
      };
      const rejectedMode = spawnSync(
        process.execPath,
        [
          entry,
          "run",
          operation,
          "--request-stdin",
          "--json",
          "--principal-id",
          "local.email.fixture@example.invalid",
        ],
        {
          input: JSON.stringify(input),
          encoding: "utf8",
          windowsHide: true,
          timeout: 15_000,
        },
      );
      assert.equal(rejectedMode.status, 2, rejectedMode.stderr);
      const report = JSON.parse(rejectedMode.stdout);
      assert.equal(report.command, operation);
      assert.equal(
        report.reason,
        operation === "advice"
          ? "advice_request_required"
          : "task_workspace_request_required",
      );
      assert.equal(report.status, "blocked");
      assert.equal("requestId" in report, false);
      assert.equal(rejectedMode.stdout.trim().split("\n").length, 1);
    }
  }

  const invalidRepository = withUnsignedRuntimeFixture((root) =>
    spawnSync(
      process.execPath,
      [
        path.join(root, "40_Develop", "coordinator", "bin", "coordinator.ts"),
        "run",
        "task",
        "--request-stdin",
        "--json",
        "--principal-id",
        "local.email.fixture@example.invalid",
      ],
      {
        cwd: root,
        input: JSON.stringify({ frontProvider: "codex" }),
        encoding: "utf8",
        windowsHide: true,
      },
    ),
  );
  assert.equal(invalidRepository.error, undefined);
  assert.equal(invalidRepository.status, 2);
  assert.equal(invalidRepository.stderr, "");
  const rejected = JSON.parse(invalidRepository.stdout);
  assert.equal(rejected.command, "task");
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.reason, "task_workspace_request_required");
  assert.equal(rejected.cleanupConfirmed, false);
  assert.equal("requestId" in rejected, false);
  const missingArguments = spawnSync(
    process.execPath,
    [coordinatorExecutable, "run", "task"],
    {
      input: "synthetic-input-not-to-be-reported",
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(missingArguments.error, undefined);
  assert.equal(missingArguments.status, 64);
  assert.equal(missingArguments.stdout, "");
  assert.match(
    missingArguments.stderr,
    /coordinator_launch_arguments_invalid/u,
  );
  assert.equal(
    missingArguments.stdout.includes("synthetic-input-not-to-be-reported"),
    false,
  );
});
