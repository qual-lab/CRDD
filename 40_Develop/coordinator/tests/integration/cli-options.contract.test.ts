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
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { parseDoctorArguments } from "../../src/cli/options.ts";
import { renderDockerRecoveryDoctorReport } from "../../src/cli/recovery-report.ts";
import { assertPresent } from "../support/contract-assertions.ts";
import { withUnsignedRuntimeFixture } from "../support/unsigned-runtime-fixture.ts";

const coordinatorExecutable = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../bin/coordinator.ts",
);
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
 * CLIの回復先解決はReader欠測・解放不明を処置可能へ丸めない。
 * @responsibility 実CLIのprivate関数本文へ読取り故障だけを注入して停止条件を反証する。
 * @trace ERB-IT-003
 * @precondition 実入口の正常搬送は現在状態Filesystem試験で別確認する。
 * @stimulus Reader欠測・解放不明・複数一致・ID差・Host／Probe用途差を与える。Root拒否はCLI分岐試験で確認する。
 * @observation Root返却値と読取り回数。
 * @oracle 正常だけexact Rootを返し、故障はいずれもnull。Reader成功だけを処置Authorityにしない。
 * @cleanup N/A: VM内の局所値とSource読取りだけで資源を生成しない。
 * @boundary ERB-IT-003=Direct Boundary: 実関数本文のReader故障注入。実Kernel／CLI起動の証明には使用しない。
 */
test("CLI回復先は読取り欠測と排他解放不明を拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "function resolveRuntimeOwnedCurrentRecoveryOperationRoot(",
  );
  assert.ok(start >= 0);
  const end = source.indexOf("\n/**", start);
  assert.ok(end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const id = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
  const expectedRoot = path.resolve("crdd-coordinator-doctor-fixture");
  const valid = {
    status: "completed",
    lockReleased: true,
    value: {
      snapshot: {
        operations: [
          {
            kind: "docker_task",
            identityJson: JSON.stringify({
              hostPaths: { root: expectedRoot },
              operationMode: "isolated_task",
            }),
            host: { currentToken: id },
          },
        ],
      },
    },
  };
  for (const fault of [
    "none",
    "blocked",
    "unreleased",
    "missing",
    "throw",
    "multiple",
    "wrong_token",
    "probe",
    "probe_wrong_mode",
    "bad_id",
  ]) {
    let reads = 0;
    const capability = Object.freeze({});
    const resolve = runInNewContext(
      `${body}\nresolveRuntimeOwnedCurrentRecoveryOperationRoot`,
      {
        path,
        readRuntimeOwnedCoordinatorRecoverySnapshot: (received: unknown) => {
          assert.equal(received, capability);
          reads += 1;
          if (fault === "throw") throw new Error("reader observation failed");
          if (fault === "blocked") return { ...valid, status: "blocked" };
          if (fault === "unreleased") return { ...valid, lockReleased: false };
          if (fault === "missing") return { ...valid, value: null };
          if (fault === "multiple")
            return {
              ...valid,
              value: {
                snapshot: {
                  operations: [
                    ...valid.value.snapshot.operations,
                    ...valid.value.snapshot.operations,
                  ],
                },
              },
            };
          if (fault === "wrong_token")
            return {
              ...valid,
              value: {
                snapshot: {
                  operations: [
                    {
                      ...valid.value.snapshot.operations[0],
                      host: { currentToken: `${id}-other` },
                    },
                  ],
                },
              },
            };
          if (fault === "probe")
            return {
              ...valid,
              value: {
                snapshot: {
                  operations: [
                    {
                      ...valid.value.snapshot.operations[0],
                      identityJson: JSON.stringify({
                        hostPaths: { root: expectedRoot },
                        operationMode: "boolean_probe",
                      }),
                    },
                  ],
                },
              },
            };
          return valid;
        },
      },
    );
    assert.equal(
      resolve(
        fault === "bad_id"
          ? "host.invalid"
          : fault.startsWith("probe")
            ? id.replace(/^host\./u, "docker.")
            : id,
        capability,
      ),
      fault === "none" || fault === "probe" ? expectedRoot : null,
    );
    assert.equal(reads, fault === "bad_id" ? 0 : 1);
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
    ["--restart-docker-for-recovery", id, "--json"],
    undefined,
  );
  assert.equal(restart.status, "ok");
  assert.equal(restart.value?.restartDockerForRecoveryId, id);
  const recover = parseDoctorArguments(["--recover-isolation", id], undefined);
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
  assert.equal(parseDoctorArguments([], undefined).status, "ok");
  assert.equal(
    parseDoctorArguments(
      ["--recover-isolation", "host.safe", "--json"],
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
    ["--repair-docker-desktop-runtime", "--json"],
    undefined,
  );
  assert.equal(repair.status, "ok");
  assertPresent(repair.value);
  assert.equal(repair.value.repairDockerDesktopRuntime, true);

  assert.equal(
    parseDoctorArguments(
      ["--repair-docker-desktop-runtime", "--isolation"],
      undefined,
    ).reason,
    "doctor_arguments_incompatible",
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
  const id = `docker-runtime-repair.${"a".repeat(64)}.${"b".repeat(64)}`;
  const task = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const old = `docker-desktop-repair.${"c".repeat(32)}`;
  const flag = "--retain-docker-runtime-repair";
  const parsed = parseDoctorArguments(
    [flag, id, "--json"],
    "ignored-environment-root",
  );
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.value?.retainDockerRuntimeRepairId, id);
  assert.equal(parsed.value?.repairDockerDesktopRuntime, false);
  assert.equal(parsed.value?.recoveryId, null);
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
          : "doctor_arguments_incompatible",
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
        : "doctor_arguments_incompatible",
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
  assert.deepEqual(JSON.parse(result.stdout), {
    contract: "crdd-coordinator/capabilities",
    contractRevision: 4,
    profile: "local_personal",
    commands: [
      {
        command: "task",
        availability: "available",
        invocation: "task --request-stdin --json",
      },
      { command: "doctor", availability: "available" },
    ],
  });
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
    [publicCoordinatorLauncher, "automation", "capabilities", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.contract, "crdd-coordinator/capabilities");
  assert.equal(output.contractRevision, 4);
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
    assert.equal(result.stderr.includes("Unknown command"), true);
    assert.equal(result.stdout.includes(`"command":"${command}"`), false);
  }
  const project = spawnSync(
    process.execPath,
    [coordinatorExecutable, "project", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(project.status, 64);
  assert.equal(project.stderr, "");
  assert.deepEqual(JSON.parse(project.stdout), {
    command: "project",
    status: "blocked",
    reason: "project_arguments_invalid",
  });
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
  assert.equal(result.stdout.includes("--retain-docker-runtime-repair"), true);
  assert.equal(result.stdout.includes("明示的な保持判断"), true);
  assert.equal(result.status, 0);
  assert.equal(
    result.stdout.includes("crdd-coordinator.ts task --request-stdin --json"),
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
      [entry, "task", "--request-stdin", "--json"],
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
  }

  const invalidRepository = withUnsignedRuntimeFixture((root) =>
    spawnSync(
      process.execPath,
      [
        path.join(root, "40_Develop", "coordinator", "bin", "coordinator.ts"),
        "task",
        "--request-stdin",
        "--json",
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
    [coordinatorExecutable, "task"],
    {
      input: "synthetic-input-not-to-be-reported",
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(missingArguments.error, undefined);
  assert.equal(missingArguments.status, 64);
  assert.equal(missingArguments.stderr, "");
  assert.equal(
    missingArguments.stdout,
    `${JSON.stringify({ command: "task", status: "blocked", reason: "task_arguments_invalid" }, null, 2)}\n`,
  );
  assert.equal(
    missingArguments.stdout.includes("synthetic-input-not-to-be-reported"),
    false,
  );
});
