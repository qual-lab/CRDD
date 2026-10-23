/**
 * 上位の保存・許可とDI固定再起動の本番組立てを確認する。
 * @packageDocumentation
 * @responsibility 生NativeやOS条件を上位へ戻さず、要求前保存・受付・終端・回収の順を検証する。
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope 現在checkpoint、公開DI入力、通知保存と外側排他。
 * @boundary ERB-IT-014=Related 2 Blocks: 本番組立て→DI公開相当driverと実Machine。
 */
import assert from "node:assert/strict";
import { sourceDeclaration } from "../support/source-declaration.ts";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { restartDockerRuntimeForVerification } from "../../../docker-isolation/src/docker-desktop/restart.ts";
import { createDockerRestartMachineForVerification } from "../../../docker-isolation/src/docker-desktop/restart-state.ts";
import {
  decodeDockerRestartCheckpoint,
  validateDockerRestartCheckpointTransition,
} from "../../src/execution/result.ts";
import { restartRuntimeOwnedDockerForRecovery } from "../../src/execution/recovery.ts";
/**
 * production facadeとpackage exportsはcaller Root／observer／runner seamを閉じるを検証する。
 *
 * @responsibility production facadeとpackage exportsはcaller Root／observer／runner seamを閉じるの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production facadeとpackage exportsはcaller Root／observer／runner seamを閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("production facadeとpackage exportsはcaller Root／observer／runner seamを閉じる", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve("package.json"), "utf8"),
  );
  assert.deepEqual(packageJson.exports, {
    "./cli": "./bin/coordinator.ts",
    ".": "./src/index.ts",
  });
  const hostFacade = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  const composition = fs.readFileSync(
    path.resolve("src/execution/recovery.ts"),
    "utf8",
  );
  const expectedOperations = [
    "finalizeRuntimeOwnedDockerRestartPreparation",
    "persistRuntimeOwnedDockerRestartCheckpoint",
    "prepareRuntimeOwnedDockerRestart",
    "releaseRuntimeOwnedDockerRestartPreparation",
    "verifyRuntimeOwnedDockerRestartPreparation",
  ];
  /**
   * 現在の公開境界と再起動Callerの私有接続を検査する。
   * @responsibility Rootへの準備操作再公開と下位private入口への依存を拒否する。
   * @trace PRL-IT-013
   * @precondition メモリ内のRootとCallerのSourceを受け取る。
   * @stimulus 正常Sourceまたは単一境界を変異したSourceを照合する。
   * @observation 公開名、固定import先とimport名集合を読む。
   * @oracle 現在5操作だけが私有接続され、DI root入口だけを使用する。
   * @cleanup N/A: Source読取りとメモリ評価のみ。
   * @boundary PRL-IT-013=Direct Boundary: Package公開契約→現在再起動Caller
   */
  const assertCurrentRestartBoundary = (
    rootSource: string,
    callerSource: string,
  ) => {
    for (const symbol of expectedOperations)
      assert.equal(rootSource.includes(symbol), false, symbol);
    assert.doesNotMatch(rootSource, /WithObserver|WithRunner/u);
    const restartOwnerExports = [
      ...rootSource.matchAll(
        /export\s+(?:type\s+)?\{([^{}]+)\}\s*from\s*["']\.\/execution\/(?:recovery|runtime-restart)\.ts["']/gu,
      ),
    ];
    for (const declaration of restartOwnerExports)
      assert.doesNotMatch(declaration[1] ?? "", /RecoveryAcknowledgement/u);
    assert.doesNotMatch(
      rootSource,
      /export\s*\*(?:\s+as\s+[A-Za-z_$][\w$]*)?\s+from\s*["']\.\/execution\/recovery\.ts["']/u,
    );
    for (const name of expectedOperations)
      assert.match(
        sourceDeclaration(callerSource, name),
        new RegExp(`function ${name}\\(`, "u"),
      );
    assert.match(callerSource, /\brestartDockerRuntime\b/u);
    assert.match(callerSource, /\btype DockerRuntimeRestartEvent\b/u);
    assert.deepEqual(
      [
        ...new Set(
          [
            ...callerSource.matchAll(
              /["'](\.\.\/\.\.\/\.\.\/docker-isolation\/src\/[^"']+)["']/gu,
            ),
          ].map((match) => match[1]),
        ),
      ],
      ["../../../docker-isolation/src/index.ts"],
    );
    assert.match(
      callerSource,
      /import\s*\{[^}]*\btype DockerRestartCheckpoint\b[^}]*\}\s*from ["']\.\/result\.ts["']/u,
    );
    assert.doesNotMatch(
      callerSource,
      /docker-desktop|docker-recovery-runtime-internal\.ts|restart-record\.ts|restart-continuation-record\.ts|restart-handoff-record\.ts/u,
    );
  };
  assertCurrentRestartBoundary(hostFacade, composition);
  const missingPreparation = composition.replace(
    "function prepareRuntimeOwnedDockerRestart(",
    "function missingDockerRestartPreparation(",
  );
  assert.notEqual(missingPreparation, composition);
  assert.throws(() =>
    assertCurrentRestartBoundary(hostFacade, missingPreparation),
  );
  const privateDriver = composition.replace(
    "../../../docker-isolation/src/index.ts",
    "../../../docker-isolation/src/docker-desktop/restart.ts",
  );
  assert.notEqual(privateDriver, composition);
  assert.throws(() => assertCurrentRestartBoundary(hostFacade, privateDriver));
  assert.throws(() =>
    assertCurrentRestartBoundary(
      `${hostFacade}\nexport { prepareRuntimeOwnedDockerRestart } from "./execution/recovery.ts";`,
      composition,
    ),
  );
  for (const owner of ["recovery", "runtime-restart"]) {
    assert.throws(() =>
      assertCurrentRestartBoundary(
        `${hostFacade}\nexport type { RecoveryAcknowledgement } from "./execution/${owner}.ts";`,
        composition,
      ),
    );
  }
  for (const suffix of ["", " as privateRecovery"]) {
    assert.throws(() =>
      assertCurrentRestartBoundary(
        `${hostFacade}\nexport *${suffix} from "./execution/recovery.ts";`,
        composition,
      ),
    );
  }
  assert.throws(() =>
    assertCurrentRestartBoundary(
      hostFacade,
      `${composition}\nimport "../../../docker-isolation/src/docker-desktop/restart.ts";`,
    ),
  );
  const blocked = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'await import("@qual-lab/crdd-coordinator/src/execution/recovery.ts")',
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/u);
});

const source = fs.readFileSync(
  new URL("../../src/execution/recovery.ts", import.meta.url),
  "utf8",
);
const body = sourceDeclaration(source, "restartRuntimeOwnedDockerForRecovery");
/**
 * 本番組立てを実DI driverとMachineへ結合する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus 固定故障と現在要求記録を構成する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle 要求前checkpointがNative取得より先、同じrequestだけ保存。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
async function compose(fault: string = "normal") {
  const calls: string[] = [],
    capability = Object.freeze({}),
    root = Object.freeze({});
  const controller = new AbortController();
  let checkpoint: unknown = null,
    saves = 0,
    permitted = true,
    processes = true,
    running = true,
    ready = true;
  let released = false;
  let clientInspections = 0;
  const requestId = "a".repeat(64),
    scopeSha256 = "b".repeat(64);
  const session = {
    assertLive: () => true,
    verifyArtifacts: async () => "verified" as const,
    inspectClientProcesses: async () =>
      fault === "start_guard" && ++clientInspections === 3
        ? ("verified" as const)
        : ("absent" as const),
    inspectProcesses: async () =>
      processes ? ("verified" as const) : ("absent" as const),
    stopDesktop: async () => {
      calls.push("stop");
      if (fault === "stop_unknown") return "outcome_unknown" as const;
      processes = false;
      running = false;
      ready = false;
      if (fault === "cancel_after_stop") controller.abort();
      return "command_completed" as const;
    },
    launchDesktop: async () => {
      calls.push("start");
      processes = true;
      running = true;
      ready = true;
      return "started" as const;
    },
    terminateProcesses: async () => {
      throw new Error("forced termination forbidden");
    },
    release: async () => {
      calls.push("helper_release");
      return {
        cleanup:
          fault === "cleanup_unknown"
            ? ("unknown" as const)
            : ("confirmed" as const),
        protocol: "completed" as const,
      };
    },
    abort: async () => {
      calls.push("helper_abort");
      return {
        cleanup: "confirmed" as const,
        protocol: "not_applicable" as const,
      };
    },
    failureDetected: new Promise<void>(() => {}),
    onFailureDetected: () => () => {},
  };
  const dependencies = {
    platform: "win32",
    acquire: async () => {
      calls.push("acquire");
      return { status: "acquired" as const, session };
    },
    createMachine: (
      _session: unknown,
      boundary: () => boolean,
      signal: AbortSignal,
      onAccepted?: () => void,
      onAttempted?: () => void,
    ) =>
      createDockerRestartMachineForVerification({
        session,
        boundary,
        signal,
        ...(onAccepted ? { onRequestAccepted: onAccepted } : {}),
        ...(onAttempted ? { onRequestAttempted: onAttempted } : {}),
        observeBackend: () => (running ? "running" : "stopped"),
        observeEngine: () => (ready ? "ready" : "known_unavailable"),
        containersAbsent: () => true,
        now: () => 0,
        wait: async () => {
          throw new Error("unexpected wait");
        },
      }),
    now: () => 0,
  };
  const context = {
    Object,
    Error,
    capability,
    root,
    controller,
    prepareRuntimeOwnedDockerRestart: () => {
      calls.push("prepare");
      return {
        status: "prepared",
        capability,
        recoveryId: "exact-recovery",
        requestId,
        scopeSha256,
        checkpointInitialized: false,
        alreadyRequested: fault === "already_requested",
      };
    },
    verifyRuntimeOwnedDockerRestartPreparation: (owner: unknown) =>
      owner === capability && permitted,
    persistRuntimeOwnedDockerRestartCheckpoint: (
      owner: unknown,
      value: unknown,
    ) => {
      assert.equal(owner, capability);
      saves++;
      calls.push(`save:${saves}`);
      if (
        (fault === "initial_save" && saves === 1) ||
        (fault === "intent_save" && saves === 2) ||
        (fault === "accepted_save" && saves === 3) ||
        (fault === "terminal_save" && saves === 4)
      ) {
        permitted = false;
        return false;
      }
      const next = JSON.parse(JSON.stringify(value));
      if (!released) assert.notEqual(next.result?.status, "completed");
      assert.equal(
        validateDockerRestartCheckpointTransition(checkpoint, next),
        true,
      );
      checkpoint = next;
      return true;
    },
    releaseRuntimeOwnedDockerRestartPreparation: () => {
      calls.push("lock_release");
      released = true;
      if (fault === "lock_throw") throw new Error("private lock detail");
      return fault !== "lock_false";
    },
    finalizeRuntimeOwnedDockerRestartPreparation: (
      _owner: unknown,
      result: Awaited<ReturnType<typeof restartDockerRuntimeForVerification>>,
    ) => {
      assert.equal(released, true);
      calls.push("finalize");
      if (!permitted || fault === "final_save")
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
        };
      const cleanup =
        result.cleanupConfirmed &&
        fault !== "lock_false" &&
        fault !== "lock_throw";
      const next = JSON.parse(
        JSON.stringify({
          ...(checkpoint as object),
          cleanup:
            (checkpoint as { request: string }).request === "not_issued"
              ? "not_required"
              : cleanup
                ? "confirmed"
                : "unknown",
          result: {
            status:
              result.status === "completed" && cleanup
                ? "completed"
                : "blocked",
            reason: cleanup
              ? result.reason
              : "docker_restart_cleanup_unconfirmed",
            request: result.request,
            effectOutcomeUnknown: result.effectOutcomeUnknown,
          },
        }),
      );
      assert.ok(decodeDockerRestartCheckpoint(next));
      assert.equal(next.result.request, result.request);
      assert.equal(
        next.result.effectOutcomeUnknown,
        result.effectOutcomeUnknown,
      );
      for (const missing of ["request", "effectOutcomeUnknown"]) {
        const legacy = JSON.parse(JSON.stringify(next));
        delete legacy.result[missing];
        assert.equal(decodeDockerRestartCheckpoint(legacy), null);
      }
      assert.equal(
        validateDockerRestartCheckpointTransition(checkpoint, next),
        true,
      );
      checkpoint = next;
      calls.push("final_save");
      return {
        status: "completed",
        snapshotConfirmed: true,
        lockReleased: true,
      };
    },
    restartDockerRuntime: (
      input: Parameters<typeof restartDockerRuntimeForVerification>[0],
    ) => {
      calls.push("lower");
      return restartDockerRuntimeForVerification(input, dependencies);
    },
  };
  const run = runInNewContext(
    `${body}\nrestartRuntimeOwnedDockerForRecovery`,
    context,
  );
  const result = await run("exact-recovery", controller.signal, root);
  const after = [...calls];
  controller.abort();
  await Promise.resolve();
  assert.deepEqual(calls, after);
  return { result, calls, checkpoint };
}
/**
 * 現在の保存確認後に一回だけ下位処置を開始する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus 全境界を正常に終了する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle 初期→unknown保存後だけ取得・停止・起動、受付と終端保存、下位回収後外側解放。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立ては現在要求保存後だけDI固定操作へ委譲する", async () => {
  const { result, calls, checkpoint } = await compose();
  assert.equal(result.status, "completed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.taskRecoveryCompleted, false);
  assert.equal(result.primaryFailure, null);
  assert.equal(result.cleanupFailure, null);
  assert.deepEqual(calls, [
    "prepare",
    "lower",
    "save:1",
    "save:2",
    "acquire",
    "stop",
    "save:3",
    "start",
    "helper_release",
    "save:4",
    "lock_release",
    "finalize",
    "final_save",
  ]);
  assert.equal((checkpoint as { request: string }).request, "confirmed");
  assert.equal((checkpoint as { cleanup: string }).cleanup, "confirmed");
});
/**
 * 保存不明後の追加Effectを拒否し元要求を保持する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus initial_saveで保存確認を拒否する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle record_unconfirmed、元相関保持、回収一回、失敗後の要求を発行しない。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てのinitial_save拒否で後続Effectを止める", async () => {
  const { result, calls } = await compose("initial_save");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_record_unconfirmed");
  assert.equal(result.primaryFailure, "docker_restart_record_unconfirmed");
  assert.equal(result.cleanupFailure, null);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
  assert.equal(calls.includes("acquire"), false);
  assert.equal(calls.includes("finalize"), false);
});
/**
 * 保存不明後の追加Effectを拒否し元要求を保持する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus intent_saveで保存確認を拒否する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle record_unconfirmed、元相関保持、回収一回、失敗後の要求を発行しない。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てのintent_save拒否で後続Effectを止める", async () => {
  const { result, calls } = await compose("intent_save");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_record_unconfirmed");
  assert.equal(result.primaryFailure, "docker_restart_record_unconfirmed");
  assert.equal(result.cleanupFailure, null);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
  assert.equal(calls.includes("acquire"), false);
});
/**
 * 保存不明後の追加Effectを拒否し元要求を保持する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus accepted_saveで保存確認を拒否する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle record_unconfirmed、元相関保持、回収一回、失敗後の要求を発行しない。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てのaccepted_save拒否で後続Effectを止める", async () => {
  const { result, calls } = await compose("accepted_save");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_record_unconfirmed");
  assert.equal(result.primaryFailure, "docker_restart_record_unconfirmed");
  assert.equal(result.cleanupFailure, null);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
  assert.equal(calls.includes("acquire"), true);
  assert.equal(calls.includes("start"), false);
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
});
/**
 * 保存不明後の追加Effectを拒否し元要求を保持する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus terminal_saveで保存確認を拒否する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle record_unconfirmed、元相関保持、回収一回、失敗後の要求を発行しない。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てのterminal_save拒否で後続Effectを止める", async () => {
  const { result, calls } = await compose("terminal_save");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_record_unconfirmed");
  assert.equal(result.primaryFailure, "docker_restart_record_unconfirmed");
  assert.equal(result.cleanupFailure, null);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
  assert.equal(calls.includes("acquire"), true);
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
});

/**
 * 外側解放後の終端保存拒否を処置成功へ畳まない。
 * @responsibility 回収済みの技術結果と耐久保存不明を分離する。
 * @trace ERB-IT-014
 * @precondition 本番組立てと実DI driver、合成Native・Writerを使用する。
 * @stimulus 外側解放後のfinal_saveだけを拒否する。
 * @observation 公開結果、保存checkpoint、要求と終端保存の発行数。
 * @oracle blocked、記録不明、cleanup確認を維持し、pendingと未確定結果を保持する。
 * @cleanup 合成Sessionのみ。実Docker・外部AIへのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: 同要求Owner→終端保存。
 */
test("外側解放後の終端保存拒否はpendingを保持する", async () => {
  const { result, calls, checkpoint } = await compose("final_save");
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_record_unconfirmed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal((checkpoint as { cleanup: string }).cleanup, "pending");
  assert.equal((checkpoint as { result: unknown }).result, null);
  assert.equal(calls.filter((call) => call === "finalize").length, 1);
  assert.equal(calls.filter((call) => call === "start").length, 1);
});

/**
 * 下位一次失敗・回収不明と外側解放を区別する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus stop_unknownを固定境界へ注入する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle blocked、一次理由を保持し、cleanup不明だけ別field、実処置二重発行0。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てはstop_unknownの技術結果を上書きしない", async () => {
  const { result, calls } = await compose("stop_unknown");
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, "docker_restart_stop_unconfirmed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.cleanupFailure, null);
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
  assert.equal(calls.includes("start"), false);
});
/**
 * 下位一次失敗・回収不明と外側解放を区別する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus cleanup_unknownを固定境界へ注入する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle blocked、一次理由を保持し、cleanup不明だけ別field、実処置二重発行0。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てはcleanup_unknownの技術結果を上書きしない", async () => {
  const { result, calls } = await compose("cleanup_unknown");
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, null);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.cleanupFailure, "docker_restart_cleanup_unconfirmed");
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
});
/**
 * 下位一次失敗・回収不明と外側解放を区別する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus cancel_after_stopを固定境界へ注入する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle blocked、一次理由を保持し、cleanup不明だけ別field、実処置二重発行0。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てはcancel_after_stopの技術結果を上書きしない", async () => {
  const { result, calls } = await compose("cancel_after_stop");
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, "docker_restart_cancelled");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.cleanupFailure, null);
  assert.equal(calls.filter((call) => call === "helper_abort").length, 1);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
  assert.equal(calls.includes("start"), false);
});
/**
 * 下位一次失敗・回収不明と外側解放を区別する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus lock_falseを固定境界へ注入する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle blocked、一次理由を保持し、cleanup不明だけ別field、実処置二重発行0。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てはlock_falseの技術結果を上書きしない", async () => {
  const { result, calls, checkpoint } = await compose("lock_false");
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, null);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.cleanupFailure, "docker_restart_cleanup_unconfirmed");
  assert.equal((checkpoint as { cleanup: string }).cleanup, "unknown");
  assert.equal(
    (checkpoint as { result: { status: string } }).result.status,
    "blocked",
  );
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
});
/**
 * 下位一次失敗・回収不明と外側解放を区別する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus lock_throwを固定境界へ注入する。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle blocked、一次理由を保持し、cleanup不明だけ別field、実処置二重発行0。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("本番組立てはlock_throwの技術結果を上書きしない", async () => {
  const { result, calls, checkpoint } = await compose("lock_throw");
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, null);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.cleanupFailure, "docker_restart_cleanup_unconfirmed");
  assert.equal((checkpoint as { cleanup: string }).cleanup, "unknown");
  assert.equal(
    (checkpoint as { result: { status: string } }).result.status,
    "blocked",
  );
  assert.equal(calls.filter((call) => call === "helper_release").length, 1);
  assert.equal(calls.filter((call) => call === "lock_release").length, 1);
});

/**
 * 保存済みの既要求を新しいNative要求へ変換しない。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus 同じ準備に既要求がある状態で呼ぶ。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle 下位取得・保存・停止・開始0、外側排他だけ解放。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("既要求の再入場は旧phaseを再生せず処置0で止まる", async () => {
  const { result, calls } = await compose("already_requested");
  assert.equal(
    result.reason,
    "docker_restart_existing_attempt_requires_recovery",
  );
  assert.equal(result.restartCompleted, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(calls, ["prepare", "lock_release"]);
});
/**
 * 開始前取消と不正参照を準備前に拒否する。
 * @responsibility 上位保存と下位固定処置の相関・失敗・終端を確認する。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と実DI driver／Machine、合成外部境界を使用する。
 * @stimulus 取消Signalまたは不正回復参照を渡す。
 * @observation 保存順、Native要求、通知、一次／cleanupと外側解放。
 * @oracle cleanup不要、固定拒否、Native処置なし。
 * @cleanup 合成Sessionと排他だけ。実Docker・外部AI・FilesystemのEffectなし。
 * @boundary ERB-IT-014=Related 2 Blocks: Coordinator組立て→DI実driver／Machine→合成Native。
 */
test("公開組立ては開始前取消と不正参照を拒否する", async () => {
  const controller = new AbortController();
  controller.abort();
  const cancelled = await restartRuntimeOwnedDockerForRecovery(
    "invalid",
    controller.signal,
    {},
  );
  assert.equal(cancelled.reason, "docker_restart_cancelled");
  assert.equal(cancelled.cleanupConfirmed, true);
  const invalid = await restartRuntimeOwnedDockerForRecovery(
    "invalid",
    new AbortController().signal,
    {},
  );
  assert.equal(invalid.reason, "docker_restart_id_invalid");
  assert.equal(invalid.cleanupConfirmed, true);
});

/**
 * 起動前の拒否診断をDI実Machineから上位結果へ搬送する。
 * @responsibility 停止失敗との混同や耐久checkpointへの詳細追加を防ぐ。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文、実DI driverと合成Nativeを使用する。
 * @stimulus 停止確認後、起動前のClient観測だけを拒否する。
 * @observation 公開結果、要求列、保存checkpoint。
 * @oracle start未発行、固定start診断、stop診断null、既存checkpoint形を維持する。
 * @cleanup 合成境界のみ。実Docker・外部AIなし。
 * @boundary ERB-IT-014=CoordinatorからDIの結果搬送。
 */
test("起動前拒否の診断を上位へ搬送し保存契約を増やさない", async () => {
  const { result, calls, checkpoint } = await compose("start_guard");
  assert.equal(result.status, "blocked");
  assert.equal(result.primaryFailure, "docker_restart_start_unconfirmed");
  assert.equal(result.startFailure, "client_processes_unconfirmed");
  assert.equal(result.stopFailure, null);
  assert.equal(result.effectOutcomeUnknown, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(calls.includes("start"), false);
  assert.equal(Object.hasOwn(checkpoint as object, "startFailure"), false);
});
