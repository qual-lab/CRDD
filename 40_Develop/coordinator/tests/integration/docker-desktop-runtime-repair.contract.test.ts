/**
 * coordinator:integration:docker-desktop-runtime-repairの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-desktop-runtime-repairが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @trace ERB-IT-012
 * @level IT
 * @scope docker、desktop、runtime、repair
 * @boundary ERB-IT-001／ERB-IT-012=Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderDockerRecoveryDoctorReport } from "../../src/core/docker-recovery-command-report.ts";
import {
  createDockerDesktopRepairContinuation,
  inspectDockerDesktopRepairContinuation,
  persistDockerDesktopRepairContinuationIntent,
} from "../../src/security/docker-desktop-repair-continuation-store.ts";
import type {
  DockerDesktopRepairLedgerSnapshot,
  DockerDesktopRepairOperation,
} from "../../src/security/docker-desktop-repair-record-store.ts";
import {
  classifyCanonicalDockerDesktopRepairHistoricalOperation,
  createDockerDesktopRepairOperation,
  DOCKER_DESKTOP_REPAIR_STAGES,
  type DockerDesktopRepairHistoryVerifier,
  inspectDockerDesktopRepairHistoricalOperation,
  inventoryDockerDesktopRepairOperations,
  persistDockerDesktopRepairHistoricalAdoption,
  persistDockerDesktopRepairHistoricalClosure,
  persistDockerDesktopRepairStage,
} from "../../src/security/docker-desktop-repair-record-store.ts";
import {
  adoptWindowsDockerDesktopRepairUsingDependencies,
  classifyDockerDesktopRepairHistoricalAdoptionRoute,
  closeWindowsDockerDesktopRepairUsingDependencies,
  describeDockerDesktopRuntimeRepairContract,
  observeDockerDesktopEngineResult,
  observeDockerDesktopRuntimeDirectoryLockUsingDependencies,
  type PreparedBoundary,
  type RepairDependencies,
  repairWindowsDockerDesktopRuntimeUsingDependencies,
  validateDockerDesktopRepairHistoricalAdoptionResult,
  validateDockerDesktopRepairHistoricalClosureResult,
} from "../../src/security/docker-desktop-runtime-repair.ts";
import {
  assertRuntimeTraceCase,
  assertRuntimeTraceExecutionCoverage,
} from "../support/runtime-trace-case.ts";

const repairRuntimeTraceAssertions: Readonly<
  Record<string, typeof assertRuntimeTraceCase>
> = Object.freeze({
  "CASE-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION": assertRuntimeTraceCase,
});
const executedRepairRuntimeTraceCases = new Set<string>();

const RUN_IDENTITY = Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" });

/**
 * snapshotDirectoryBytesのTest準備責務を実行する。
 *
 * @responsibility snapshotDirectoryBytesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus snapshotDirectoryBytesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function snapshotDirectoryBytes(root: string) {
  const result = new Map<string, string>();
  /**
   * visitのTest準備責務を実行する。
   *
   * @responsibility visitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus visitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
   */
  const visit = (directory: string) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const metadata = fs.lstatSync(target);
      if (metadata.isDirectory()) visit(target);
      else
        result.set(
          path.relative(root, target),
          fs.readFileSync(target).toString("base64"),
        );
    }
  };
  visit(root);
  return result;
}

/**
 * Docker停止時の空行またはJSON nullはCLI失敗とpipe不存在の両方がある場合だけ受理するを検証する。
 *
 * @responsibility Docker停止時の空行またはJSON nullはCLI失敗とpipe不存在の両方がある場合だけ受理するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker停止時の空行またはJSON nullはCLI失敗とpipe不存在の両方がある場合だけ受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Docker停止時の空行またはJSON nullはCLI失敗とpipe不存在の両方がある場合だけ受理する", () => {
  const base = {
    pid: 123,
    status: 1,
    signal: null,
    stdout: "\n",
    stderr: "engine unavailable",
  } as const;
  for (const stdout of ["", "\n", "\r\n", "null", "null\n", "null\r\n"]) {
    for (const pipe of ["ENOENT", "EACCES", "EPERM", "EIO", "present"]) {
      let probes = 0;
      const result = observeDockerDesktopEngineResult(
        { ...base, stdout },
        "28.1.1",
        () => {
          probes += 1;
          if (pipe !== "present")
            throw Object.assign(new Error(), { code: pipe });
        },
      );
      assert.equal(result, pipe === "ENOENT" ? "known_unavailable" : "unknown");
      assert.equal(probes, 1);
    }
  }
  for (const overrides of [
    { stdout: " " },
    { stdout: "\t" },
    { stdout: "\r" },
    { stdout: "\n\n" },
    { stdout: "\r\n\r\n" },
    { stdout: " null\n" },
    { stdout: "null \n" },
    { stdout: "NULL\n" },
    { stdout: "28.1.1\n" },
    { stdout: Buffer.from("\n") },
    { pid: undefined },
    { status: null },
    { status: 0 },
    { error: Object.assign(new Error(), { code: "ETIMEDOUT" }) },
    { error: Object.assign(new Error(), { code: "EACCES" }) },
    { signal: "SIGTERM" as const },
  ]) {
    const result = observeDockerDesktopEngineResult(
      { ...base, ...overrides },
      "28.1.1",
      () => assert.fail("判定不能なCLI応答からpipe確認へ進まない"),
    );
    assert.equal(result, "unknown");
  }
  assert.equal(
    observeDockerDesktopEngineResult(
      { ...base, status: 0, stdout: "28.1.1\n", stderr: "" },
      "28.1.1",
      () => assert.fail("応答済みEngineへ停止確認を行わない"),
    ),
    "ready",
  );
  for (const override of [
    { stdout: "28.1.2\n", stderr: "" },
    { stdout: "28.1.1\n", stderr: "warning" },
  ]) {
    assert.equal(
      observeDockerDesktopEngineResult(
        { ...base, status: 0, ...override },
        "28.1.1",
        () => assert.fail("版不一致や警告を停止済みへ変換しない"),
      ),
      "unknown",
    );
  }
});

/**
 * 実子Processの空行・JSON null・非zero終了を停止判定へ搬送するを検証する。
 *
 * @responsibility 実子Processの空行・JSON null・非zero終了を停止判定へ搬送するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実子Processの空行・JSON null・非zero終了を停止判定へ搬送するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("実子Processの空行・JSON null・非zero終了を停止判定へ搬送する", () => {
  for (const stdout of ["\n", "\r\n", "null\n", "null\r\n", "unexpected\n"]) {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `process.stdout.write(${JSON.stringify(stdout)});process.exitCode=1;`,
      ],
      { shell: false, windowsHide: true, encoding: "utf8", timeout: 5_000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, stdout);
    assert.equal(
      observeDockerDesktopEngineResult(result, "28.1.1", () => {
        throw Object.assign(new Error(), { code: "ENOENT" });
      }),
      stdout === "unexpected\n" ? "unknown" : "known_unavailable",
    );
  }
});

/**
 * Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否するを検証する。
 *
 * @responsibility Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否する", () => {
  const entries = [
    { name: "sailor-ingest.sock", isDirectory: false, isSymbolicLink: false },
    {
      name: "userAnalyticsOtlpHttp.sock",
      isDirectory: false,
      isSymbolicLink: false,
    },
  ] as const;
  const observe = (
    overrides: Partial<
      Parameters<
        typeof observeDockerDesktopRuntimeDirectoryLockUsingDependencies
      >[1]
    > = {},
  ) =>
    observeDockerDesktopRuntimeDirectoryLockUsingDependencies(boundary, {
      identityAt: () => RUN_IDENTITY,
      readEntries: () => entries,
      probeEntry: (target) => {
        if (target.endsWith("sailor-ingest.sock"))
          throw Object.assign(new Error("locked"), { code: "EACCES" });
      },
      ...overrides,
    });
  assert.deepEqual(observe(), RUN_IDENTITY);
  assert.deepEqual(
    observe({
      readEntries: () =>
        entries.map((entry) => ({ ...entry, isSymbolicLink: true })),
      probeEntry: () => {
        throw Object.assign(new Error("locked Windows AF_UNIX endpoint"), {
          code: "EACCES",
        });
      },
    }),
    RUN_IDENTITY,
  );
  assert.equal(
    observe({
      probeEntry: () => undefined,
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: () =>
        Array.from({ length: 65 }, (_unusedEntry, index) => ({
          name: `socket-${index}`,
          isDirectory: false,
          isSymbolicLink: false,
        })),
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: () => [
        { name: "nested", isDirectory: true, isSymbolicLink: false },
      ],
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: () =>
        entries.map((entry) => ({ ...entry, isSymbolicLink: true })),
      probeEntry: () => {
        throw Object.assign(new Error("unexpected observation failure"), {
          code: "EINVAL",
        });
      },
    }),
    null,
  );
  assert.equal(
    observe({
      identityAt: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1 ? RUN_IDENTITY : { ...RUN_IDENTITY, ino: "99" };
        };
      })(),
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1
            ? entries
            : [{ ...entries[0], name: "replaced.sock" }];
        };
      })(),
    }),
    null,
  );
});
const policy = Object.freeze({
  policySha256: "5".repeat(64),
  dockerDesktopVersion: "4.41.2",
  engineVersion: "28.1.1",
  artifacts: new Map(),
});
const boundary: PreparedBoundary = Object.freeze({
  runtimeStateRoot: "C:\\runtime-state",
  runtimeStateIdentityHash: "1".repeat(64),
  runtimeStateProtectionHash: "2".repeat(64),
  localUserBindingHash: "3".repeat(64),
  runtimeStateBindingHash: "4".repeat(64),
  dockerPolicySha256: policy.policySha256,
  crddManifestHash: "7".repeat(64),
  crddReleaseSequence: 1,
  runtimeExecutionIdentitySha256: "9".repeat(64),
  localAppData: "C:\\local",
  runDirectory: "C:\\local\\Docker\\run",
  socketPath: "C:\\local\\Docker\\run\\dockerInference",
  platformAccessArtifact: Object.freeze({ sha256: "6".repeat(64) }),
  policy,
});

/**
 * sessionのTest準備責務を実行する。
 *
 * @responsibility sessionがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus sessionを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function session(
  options: {
    release?: "released" | "protocol_failed" | "cleanup_unknown";
    processes?: "absent" | "verified" | "unknown";
    terminate?:
      | "absent"
      | "not_issued_unknown"
      | "terminated"
      | "partial_or_unknown"
      | "unknown";
    live?: boolean;
  } = {},
) {
  return Object.freeze({
    assertLive: () => options.live ?? true,
    onFailureDetected: () => () => undefined,
    failureDetected: new Promise<void>(() => undefined),
    verifyArtifacts: async () => "verified" as const,
    inspectProcesses: async () => options.processes ?? ("verified" as const),
    terminateProcesses: async () =>
      options.terminate ?? ("terminated" as const),
    launchDesktop: async () => "started" as const,
    abort: async () =>
      Object.freeze({
        cleanup: "confirmed" as const,
        protocol: "not_applicable" as const,
      }),
    release: async () =>
      options.release === "cleanup_unknown"
        ? Object.freeze({
            cleanup: "unknown" as const,
            protocol: "failed" as const,
          })
        : options.release === "protocol_failed"
          ? Object.freeze({
              cleanup: "confirmed" as const,
              protocol: "failed" as const,
            })
          : Object.freeze({
              cleanup: "confirmed" as const,
              protocol: "completed" as const,
            }),
  });
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function fixture(overrides: Partial<RepairDependencies> = {}) {
  const calls: string[] = [];
  let operation: DockerDesktopRepairOperation | null = null;
  let wasRenamed = false;
  let wasRestarted = false;
  let terminated = false;
  let engineObservations = 0;
  const repairHelper = Object.freeze({
    ...session(),
    inspectProcesses: async () =>
      wasRestarted || !terminated ? ("verified" as const) : ("absent" as const),
    terminateProcesses: async () => {
      terminated = true;
      return "terminated" as const;
    },
    launchDesktop: async () => {
      calls.push("start");
      wasRestarted = true;
      return "started" as const;
    },
  });
  const dependencies: RepairDependencies = {
    prepareBoundary: () => {
      calls.push("prepare");
      return boundary;
    },
    acquireHelper: async () => {
      calls.push("helper");
      return Object.freeze({
        status: "acquired" as const,
        session: repairHelper,
      });
    },
    inventory: () =>
      Object.freeze({
        status: "verified" as const,
        operations: Object.freeze(operation ? [operation] : []),
      }),
    observeEngine: () => {
      engineObservations += 1;
      calls.push(`engine:${engineObservations}`);
      return wasRestarted
        ? "ready"
        : observeDockerDesktopEngineResult(
            {
              pid: 123,
              status: 1,
              signal: null,
              stdout: "\n",
              stderr: "unavailable",
            },
            policy.engineVersion,
            () => {
              throw Object.assign(new Error(), { code: "ENOENT" });
            },
          );
    },
    observeKnownSocketFailure: () => {
      calls.push("socket");
      return RUN_IDENTITY;
    },
    persistStage: (_boundary, current, stage, ledger) => {
      calls.push(`persist:${stage}`);
      operation = Object.freeze({
        ...current,
        stage,
        sequence: current.sequence + 1,
        previousRecordSha256: String(current.sequence + 1).padStart(64, "0"),
        ledger: Object.freeze({ ...ledger }),
      });
      return operation;
    },
    officialShutdown: () => {
      calls.push("shutdown");
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    terminateDockerWsl: () => {
      calls.push("wsl");
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    renameRunDirectory: () => {
      calls.push("rename");
      wasRenamed = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    awaitEngine: async () => {
      calls.push("await-engine");
      return "ready" as const;
    },
    identityAt: (target) => {
      if (target === boundary.runDirectory)
        return wasRenamed && !wasRestarted ? null : RUN_IDENTITY;
      if (target.includes("run.crdd-stale-"))
        return wasRenamed ? RUN_IDENTITY : null;
      return null;
    },
    observePath: (target) => {
      if (overrides.identityAt) {
        const observed = overrides.identityAt(target);
        return observed
          ? Object.freeze({ state: "present" as const, identity: observed })
          : Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            });
      }
      if (target === boundary.runDirectory)
        return wasRenamed && !wasRestarted
          ? Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            })
          : Object.freeze({
              state: "present" as const,
              identity: RUN_IDENTITY,
            });
      if (target.includes("run.crdd-stale-"))
        return wasRenamed
          ? Object.freeze({ state: "present" as const, identity: RUN_IDENTITY })
          : Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            });
      return Object.freeze({ state: "unknown" as const, identity: null });
    },
    ...overrides,
  };
  return Object.freeze({
    calls,
    dependencies,
    setOperation: (value: DockerDesktopRepairOperation) => {
      operation = value;
      wasRenamed = [
        "renamed",
        "recovered_pending_disposition",
        "closed_retained",
      ].includes(value.stage);
      wasRestarted = [
        "recovered_pending_disposition",
        "closed_retained",
      ].includes(value.stage);
      if (
        value.stage === "no_stale_known_effect_recovery_pending" ||
        value.stage === "closed_no_stale_known_effect_retained" ||
        value.stage === "no_stale_historical_effect_unknown_pending" ||
        value.stage === "closed_historical_effect_unknown_retained"
      )
        wasRestarted = true;
    },
  });
}

/**
 * persistActualRepairRecordのTest準備責務を実行する。
 *
 * @responsibility persistActualRepairRecordがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus persistActualRepairRecordを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function persistActualRepairRecord(
  currentBoundary: PreparedBoundary,
  current: DockerDesktopRepairOperation,
  stage: DockerDesktopRepairOperation["stage"],
  ledger: DockerDesktopRepairLedgerSnapshot,
) {
  const lastWrite = ledger.filesystemEffects.findLastIndex(
    (entry) => entry.action === "record_write",
  );
  const filesystemEffects = ledger.filesystemEffects.map((entry, index) =>
    index === lastWrite && entry.confirmation === "unknown"
      ? Object.freeze({ ...entry, confirmation: "confirmed" as const })
      : entry,
  );
  filesystemEffects.push(
    Object.freeze({
      sequence: filesystemEffects.length,
      action: "record_write" as const,
      phase: "settled" as const,
      issued: true,
      confirmation: "unknown" as const,
    }),
  );
  return persistDockerDesktopRepairStage(
    currentBoundary,
    current,
    stage,
    Object.freeze({
      ...ledger,
      evidenceState:
        lastWrite >= 0 ? ("preserved" as const) : ledger.evidenceState,
      filesystemEffects: Object.freeze(filesystemEffects),
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "unknown",
    }),
  );
}

/**
 * persistActualProcessEffectのTest準備責務を実行する。
 *
 * @responsibility persistActualProcessEffectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus persistActualProcessEffectを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function persistActualProcessEffect(
  currentBoundary: PreparedBoundary,
  current: DockerDesktopRepairOperation,
  action: "official_shutdown" | "native_termination" | "wsl_termination",
  observed: Readonly<{
    issued: boolean | null;
    confirmation: "confirmed" | "not_issued" | "unknown";
  }>,
) {
  const intent = persistActualRepairRecord(
    currentBoundary,
    current,
    current.stage,
    Object.freeze({
      ...current.ledger,
      processEffects: Object.freeze([
        ...current.ledger.processEffects,
        Object.freeze({
          sequence: current.ledger.processEffects.length,
          action,
          phase: "intent_recorded" as const,
          issued: null,
          confirmation: "unknown" as const,
        }),
      ]),
      processEffectIssued: current.ledger.processEffectIssued ? true : null,
      processEffectConfirmation: "unknown",
    }),
  );
  assert.ok(intent);
  const processEffects = intent.ledger.processEffects.map((entry) =>
    entry.action === action
      ? Object.freeze({ ...entry, phase: "settled" as const, ...observed })
      : entry,
  );
  const isIssued = processEffects.some((entry) => entry.issued === true)
    ? true
    : processEffects.some((entry) => entry.issued === null)
      ? null
      : false;
  const confirmation = processEffects.some(
    (entry) => entry.confirmation === "unknown",
  )
    ? "unknown"
    : isIssued
      ? "confirmed"
      : "not_issued";
  const settled = persistActualRepairRecord(
    currentBoundary,
    intent,
    intent.stage,
    Object.freeze({
      ...intent.ledger,
      processEffects: Object.freeze(processEffects),
      processEffectIssued: isIssued,
      processEffectConfirmation: confirmation,
    }),
  );
  assert.ok(settled);
  return settled;
}

/**
 * operationFixtureのTest準備責務を実行する。
 *
 * @responsibility operationFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus operationFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function operationFixture(
  stage: DockerDesktopRepairOperation["stage"],
  ledgerOverrides: Partial<DockerDesktopRepairLedgerSnapshot> = {},
): DockerDesktopRepairOperation {
  const id = "f".repeat(32);
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "observed_runtime_directory_rename",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
      Object.freeze({
        sequence: 1,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
    ...ledgerOverrides,
  });
  return Object.freeze({
    operationId: id,
    repairId: `docker-desktop-repair.${id}`,
    originLocalUserBindingHash: boundary.localUserBindingHash,
    operationDirectory: `C:\\runtime-state\\docker-desktop-repair-${id}`,
    staleName: `run.crdd-stale-${id}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${id}`,
    runIdentity: RUN_IDENTITY,
    stage,
    sequence: 1,
    previousRecordSha256: "f".repeat(64),
    ledger,
  });
}

/**
 * 履歴引継ぎrouteは不正・履歴なし・終了済み・同一Session・新Sessionを排他的に分類するを検証する。
 *
 * @responsibility 履歴引継ぎrouteは不正・履歴なし・終了済み・同一Session・新Sessionを排他的に分類するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 履歴引継ぎrouteは不正・履歴なし・終了済み・同一Session・新Sessionを排他的に分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("履歴引継ぎrouteは不正・履歴なし・終了済み・同一Session・新Sessionを排他的に分類する", () => {
  const original = operationFixture("prepared");
  assert.equal(
    classifyDockerDesktopRepairHistoricalAdoptionRoute(original, boundary),
    "initial_adoption",
  );
  const history = {
    adoptionSha256: "a".repeat(64),
    handoffTipSha256: "a".repeat(64),
    handoffCount: 0,
    originLocalUserBindingHash: boundary.localUserBindingHash,
    currentLocalUserBindingHash: boundary.localUserBindingHash,
    currentSessionBound: true,
    closed: false,
    liveRunIdentity: null,
    staleState: "unknown" as const,
  };
  assert.equal(
    classifyDockerDesktopRepairHistoricalAdoptionRoute(
      {
        ...original,
        history: {
          ...history,
          closed: true,
          liveRunIdentity: RUN_IDENTITY,
          staleState: "retained",
        },
      },
      boundary,
    ),
    "closed",
  );
  for (const liveRunIdentity of [
    { ...RUN_IDENTITY, ino: "0" },
    { ...RUN_IDENTITY, extra: "4" },
  ])
    assert.equal(
      classifyDockerDesktopRepairHistoricalAdoptionRoute(
        {
          ...original,
          history: {
            ...history,
            closed: true,
            liveRunIdentity,
            staleState: "retained",
          },
        },
        boundary,
      ),
      "invalid",
    );
  assert.equal(
    classifyDockerDesktopRepairHistoricalAdoptionRoute(
      { ...original, history },
      boundary,
    ),
    "current_session",
  );
  assert.equal(
    classifyDockerDesktopRepairHistoricalAdoptionRoute(
      {
        ...original,
        history: {
          ...history,
          currentLocalUserBindingHash: "c".repeat(64),
          currentSessionBound: false,
        },
      },
      boundary,
    ),
    "session_handoff",
  );
  const { handoffTipSha256: tipValue, ...missingTip } = history;
  const { handoffCount: countValue, ...missingCount } = history;
  for (const invalidHistory of [
    { ...history, currentLocalUserBindingHash: "c".repeat(64) },
    { ...history, currentSessionBound: false },
    { ...history, adoptionSha256: "A".repeat(64) },
    missingTip,
    missingCount,
    { ...history, handoffCount: 9 },
    { ...history, originLocalUserBindingHash: "not-a-hash" },
    { ...history, liveRunIdentity: RUN_IDENTITY },
    { ...history, staleState: "absent" as const },
  ])
    assert.equal(
      classifyDockerDesktopRepairHistoricalAdoptionRoute(
        { ...original, history: invalidHistory },
        boundary,
      ),
      "invalid",
    );
});

/**
 * 履歴引継ぎ結果は元chain不変fieldと許可されたSession差分を全数検証するを検証する。
 *
 * @responsibility 履歴引継ぎ結果は元chain不変fieldと許可されたSession差分を全数検証するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 履歴引継ぎ結果は元chain不変fieldと許可されたSession差分を全数検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("履歴引継ぎ結果は元chain不変fieldと許可されたSession差分を全数検証する", () => {
  const before = operationFixture("prepared");
  const adopted: DockerDesktopRepairOperation = {
    ...before,
    history: {
      adoptionSha256: "a".repeat(64),
      handoffTipSha256: "a".repeat(64),
      handoffCount: 0,
      originLocalUserBindingHash: boundary.localUserBindingHash,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
      closed: false,
      liveRunIdentity: null,
      staleState: "unknown",
    },
  };
  assert.equal(
    validateDockerDesktopRepairHistoricalAdoptionResult(
      "initial_adoption",
      before,
      adopted,
      boundary,
    ),
    true,
  );
  assert.ok(adopted.history);
  const adoptedHistory = adopted.history;
  const changedCores: DockerDesktopRepairOperation[] = [
    { ...adopted, operationId: "e".repeat(32) },
    { ...adopted, repairId: `docker-desktop-repair.${"e".repeat(32)}` },
    { ...adopted, originLocalUserBindingHash: "e".repeat(64) },
    { ...adopted, operationDirectory: `${adopted.operationDirectory}-other` },
    { ...adopted, staleName: `${adopted.staleName}-other` },
    { ...adopted, staleDirectory: `${adopted.staleDirectory}-other` },
    { ...adopted, runIdentity: { ...adopted.runIdentity, ino: "99" } },
    { ...adopted, stage: "processes_stopped" },
    { ...adopted, sequence: adopted.sequence + 1 },
    { ...adopted, previousRecordSha256: "e".repeat(64) },
    { ...adopted, ledger: { ...adopted.ledger, engineReady: true } },
  ];
  for (const changed of changedCores)
    assert.equal(
      validateDockerDesktopRepairHistoricalAdoptionResult(
        "initial_adoption",
        before,
        changed,
        boundary,
      ),
      false,
    );
  const withoutOrigin = { ...adopted } as Record<string, unknown>;
  delete withoutOrigin.originLocalUserBindingHash;
  const accessorIdentity = Object.defineProperty(
    { ...adopted.runIdentity },
    "ino",
    { enumerable: true, get: () => "2" },
  );
  const accessorLedger = Object.defineProperty(
    { ...adopted.ledger },
    "engineReady",
    { enumerable: true, get: () => false },
  );
  for (const malformed of [
    withoutOrigin,
    { ...adopted, operationId: "F".repeat(32) },
    { ...adopted, repairId: `docker-desktop-repair.${"e".repeat(32)}` },
    { ...adopted, runIdentity: { ...adopted.runIdentity, ino: "0" } },
    { ...adopted, runIdentity: { ...adopted.runIdentity, extra: "4" } },
    { ...adopted, runIdentity: accessorIdentity },
    { ...adopted, sequence: -1 },
    { ...adopted, sequence: Number.MAX_SAFE_INTEGER },
    { ...adopted, previousRecordSha256: "F".repeat(64) },
    { ...adopted, ledger: accessorLedger },
    new Proxy(adopted, {
      ownKeys: () => {
        throw new Error("hostile_proxy");
      },
    }),
  ]) {
    assert.equal(
      classifyCanonicalDockerDesktopRepairHistoricalOperation(
        malformed,
        boundary,
      ),
      "invalid",
    );
  }
  for (const history of [
    { ...adoptedHistory, adoptionSha256: "A".repeat(64) },
    { ...adoptedHistory, handoffTipSha256: "b".repeat(64) },
    { ...adoptedHistory, handoffCount: 1 },
    { ...adoptedHistory, originLocalUserBindingHash: "e".repeat(64) },
    { ...adoptedHistory, currentLocalUserBindingHash: "e".repeat(64) },
    { ...adoptedHistory, currentSessionBound: false },
    { ...adoptedHistory, closed: true },
    { ...adoptedHistory, liveRunIdentity: RUN_IDENTITY },
    { ...adoptedHistory, staleState: "absent" as const },
  ])
    assert.equal(
      validateDockerDesktopRepairHistoricalAdoptionResult(
        "initial_adoption",
        before,
        { ...adopted, history },
        boundary,
      ),
      false,
    );
  const prior: DockerDesktopRepairOperation = {
    ...before,
    history: {
      ...adoptedHistory,
      currentLocalUserBindingHash: "c".repeat(64),
      currentSessionBound: false,
    },
  };
  assert.ok(prior.history);
  const priorHistory = prior.history;
  const handed: DockerDesktopRepairOperation = {
    ...prior,
    history: {
      ...priorHistory,
      handoffTipSha256: "d".repeat(64),
      handoffCount: 1,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
    },
  };
  assert.equal(
    validateDockerDesktopRepairHistoricalAdoptionResult(
      "session_handoff",
      prior,
      handed,
      boundary,
    ),
    true,
  );
  assert.ok(handed.history);
  const handedHistory = handed.history;
  const priorHandoffTip = priorHistory.handoffTipSha256;
  assert.ok(priorHandoffTip);
  for (const history of [
    { ...handedHistory, adoptionSha256: "e".repeat(64) },
    { ...handedHistory, handoffTipSha256: priorHandoffTip },
    { ...handedHistory, handoffCount: 2 },
    { ...handedHistory, originLocalUserBindingHash: "e".repeat(64) },
    { ...handedHistory, currentLocalUserBindingHash: "e".repeat(64) },
    { ...handedHistory, currentSessionBound: false },
    { ...handedHistory, closed: true },
    { ...handedHistory, liveRunIdentity: RUN_IDENTITY },
    { ...handedHistory, staleState: "retained" as const },
  ])
    assert.equal(
      validateDockerDesktopRepairHistoricalAdoptionResult(
        "session_handoff",
        prior,
        { ...handed, history },
        boundary,
      ),
      false,
    );

  const closed: DockerDesktopRepairOperation = {
    ...handed,
    history: {
      ...handedHistory,
      closed: true,
      liveRunIdentity: RUN_IDENTITY,
      staleState: "retained",
    },
  };
  const expectedClosure = {
    liveRunIdentity: RUN_IDENTITY,
    staleState: "retained" as const,
  };
  assert.equal(
    validateDockerDesktopRepairHistoricalClosureResult(
      handed,
      closed,
      boundary,
      expectedClosure,
    ),
    true,
  );
  assert.equal(
    validateDockerDesktopRepairHistoricalClosureResult(
      handed,
      closed,
      boundary,
      {
        liveRunIdentity: { ...RUN_IDENTITY, ino: "0" },
        staleState: "retained",
      },
    ),
    false,
  );
  assert.ok(closed.history);
  for (const history of [
    { ...closed.history, adoptionSha256: "e".repeat(64) },
    { ...closed.history, handoffTipSha256: "e".repeat(64) },
    { ...closed.history, handoffCount: 2 },
    { ...closed.history, originLocalUserBindingHash: "e".repeat(64) },
    { ...closed.history, currentLocalUserBindingHash: "e".repeat(64) },
    { ...closed.history, currentSessionBound: false },
    { ...closed.history, closed: false },
    { ...closed.history, liveRunIdentity: { ...RUN_IDENTITY, ino: "99" } },
    { ...closed.history, staleState: "absent" as const },
  ])
    assert.equal(
      validateDockerDesktopRepairHistoricalClosureResult(
        handed,
        { ...closed, history },
        boundary,
        expectedClosure,
      ),
      false,
    );
});

/**
 * Canonical履歴分類は全modeと非plain・余分field・疎配列・nested Proxyを一つのOwnerで閉じるを検証する。
 *
 * @responsibility Canonical履歴分類は全modeと非plain・余分field・疎配列・nested Proxyを一つのOwnerで閉じるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Canonical履歴分類は全modeと非plain・余分field・疎配列・nested Proxyを一つのOwnerで閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Canonical履歴分類は全modeと非plain・余分field・疎配列・nested Proxyを一つのOwnerで閉じる", () => {
  const original = operationFixture("prepared");
  const openCurrent: DockerDesktopRepairOperation = {
    ...original,
    history: {
      adoptionSha256: "a".repeat(64),
      handoffTipSha256: "a".repeat(64),
      handoffCount: 0,
      originLocalUserBindingHash: boundary.localUserBindingHash,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
      closed: false,
      liveRunIdentity: null,
      staleState: "unknown",
    },
  };
  assert.equal(
    classifyCanonicalDockerDesktopRepairHistoricalOperation(original, boundary),
    "no_history",
  );
  assert.equal(
    classifyCanonicalDockerDesktopRepairHistoricalOperation(
      openCurrent,
      boundary,
    ),
    "open_current",
  );
  const hostileReadProxy = new Proxy(openCurrent, {
    get: () => {
      throw new Error("canonical_classifier_must_use_descriptor_values");
    },
  });
  assert.equal(
    classifyCanonicalDockerDesktopRepairHistoricalOperation(
      hostileReadProxy,
      boundary,
    ),
    "open_current",
  );
  assert.ok(openCurrent.history);
  const openCurrentHistory = openCurrent.history;
  const openPrior: DockerDesktopRepairOperation = {
    ...openCurrent,
    history: {
      ...openCurrentHistory,
      currentLocalUserBindingHash: "c".repeat(64),
      currentSessionBound: false,
    },
  };
  assert.equal(
    classifyCanonicalDockerDesktopRepairHistoricalOperation(
      openPrior,
      boundary,
    ),
    "open_prior",
  );
  const legacyClosed: DockerDesktopRepairOperation = {
    ...original,
    history: {
      adoptionSha256: "a".repeat(64),
      closed: true,
      liveRunIdentity: RUN_IDENTITY,
      staleState: "retained",
    },
  };
  assert.ok(legacyClosed.history);
  const legacyClosedHistory = legacyClosed.history;
  assert.equal(
    classifyCanonicalDockerDesktopRepairHistoricalOperation(
      legacyClosed,
      boundary,
      { liveRunIdentity: RUN_IDENTITY, staleState: "retained" },
    ),
    "closed",
  );
  const symbol = Symbol("extra");
  const withSymbol = { ...openCurrentHistory, [symbol]: true };
  const nonPlain = Object.assign(
    Object.create({ inherited: true }) as Record<string, unknown>,
    openCurrentHistory,
  );
  const nestedProxy = new Proxy(
    { ...RUN_IDENTITY },
    {
      ownKeys: () => {
        throw new Error("nested_hostile_proxy");
      },
    },
  );
  const cyclicIdentity = { ...RUN_IDENTITY } as Record<string, unknown>;
  cyclicIdentity.dev = cyclicIdentity;
  const sparseEffects = new Array(1) as unknown[];
  const malformedOperations: unknown[] = [
    { ...openCurrent, history: nonPlain },
    { ...openCurrent, history: { ...openCurrentHistory, extra: true } },
    { ...openCurrent, history: withSymbol },
    {
      ...openCurrent,
      history: { ...openCurrentHistory, liveRunIdentity: nestedProxy },
    },
    {
      ...legacyClosed,
      history: { ...legacyClosedHistory, liveRunIdentity: cyclicIdentity },
    },
    {
      ...openCurrent,
      ledger: { ...openCurrent.ledger, processEffects: sparseEffects },
    },
  ];
  for (const malformed of malformedOperations) {
    assert.equal(
      classifyCanonicalDockerDesktopRepairHistoricalOperation(
        malformed,
        boundary,
      ),
      "invalid",
    );
    assert.equal(
      classifyDockerDesktopRepairHistoricalAdoptionRoute(
        malformed as DockerDesktopRepairOperation,
        boundary,
      ),
      "invalid",
    );
  }
  assert.equal(
    classifyCanonicalDockerDesktopRepairHistoricalOperation(
      legacyClosed,
      boundary,
      {
        liveRunIdentity: RUN_IDENTITY,
        staleState: "retained",
        [symbol]: true,
      } as never,
    ),
    "invalid",
  );
  const runtimeSource = fs.readFileSync(
    new URL(
      "../../src/security/docker-desktop-runtime-repair.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(runtimeSource.includes("validOpenRepairHistory"), false);
  assert.equal(runtimeSource.includes("validClosedRepairHistory"), false);
  assert.equal(
    runtimeSource.includes("validRepairHistorySessionFields"),
    false,
  );
  assert.equal(
    runtimeSource.includes(
      "classifyCanonicalDockerDesktopRepairHistoricalOperation",
    ),
    true,
  );
});

/**
 * 引継ぎ済みの全旧stageはHost操作を再発行せず、現在観測と明示終了だけへ接続するを検証する。
 *
 * @responsibility 引継ぎ済みの全旧stageはHost操作を再発行せず、現在観測と明示終了だけへ接続するの合否判定を所有する。
 * @trace ERB-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 引継ぎ済みの全旧stageはHost操作を再発行せず、現在観測と明示終了だけへ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-012=Related 2 Blocks: Coordinator→Repair Record→Platform Adapter
 */
test("引継ぎ済みの全旧stageはHost操作を再発行せず、現在観測と明示終了だけへ接続する", async () => {
  for (const stage of DOCKER_DESKTOP_REPAIR_STAGES) {
    const isNoStale =
      stage.includes("no_stale") ||
      stage === "closed_historical_effect_unknown_retained";
    const original = operationFixture(stage, {
      staleState: isNoStale ? "absent" : "retained",
      processEffectIssued: null,
      processEffectConfirmation: "unknown",
    });
    let operation: DockerDesktopRepairOperation = {
      ...original,
      history: {
        adoptionSha256: "a".repeat(64),
        handoffTipSha256: "a".repeat(64),
        handoffCount: 0,
        originLocalUserBindingHash: boundary.localUserBindingHash,
        currentLocalUserBindingHash: boundary.localUserBindingHash,
        currentSessionBound: true,
        closed: false,
        liveRunIdentity: null,
        staleState: "unknown",
      },
    };
    let hostCalls = 0;
    let closureWrites = 0;
    /**
     * rejectHostのTest準備責務を実行する。
     *
     * @responsibility rejectHostがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
     * @trace ERB-IT-012
     * @precondition 呼出し元Test Caseが必要な入力を渡す。
     * @stimulus rejectHostを呼び出す。
     * @observation 返却値、生成fixtureまたは観測値を取得する。
     * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
     * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-012=Related 2 Blocks: Coordinator→Repair Record→Platform Adapter
     */
    const rejectHost = () => {
      hostCalls += 1;
      throw new Error("unexpected Host action");
    };
    const currentRun = isNoStale
      ? RUN_IDENTITY
      : { dev: "4", ino: "5", birthtimeNs: "6" };
    const state = fixture({
      inventory: () => ({ status: "verified", operations: [operation] }),
      observeEngine: () => "ready",
      observePath: (target) =>
        target === boundary.runDirectory
          ? { state: "present", identity: currentRun }
          : isNoStale
            ? { state: "confirmed_absent", identity: null }
            : { state: "present", identity: RUN_IDENTITY },
      acquireHelper: async () => ({
        status: "acquired",
        session: {
          ...session(),
          terminateProcesses: async () => rejectHost(),
          launchDesktop: async () => rejectHost(),
        },
      }),
      officialShutdown: rejectHost,
      terminateDockerWsl: rejectHost,
      renameRunDirectory: rejectHost,
      persistStage: () =>
        assert.fail("historical records cannot append ordinary stages"),
      history: {
        inspect: () => operation,
        loadOriginManifest: () => ({}),
        loadCurrentManifest: () => ({}),
        persistAdoption: () => assert.fail("already adopted"),
        persistClosure: (_boundary, current, observation) => {
          closureWrites += 1;
          assert.ok(current.history);
          operation = {
            ...current,
            history: { ...current.history, ...observation, closed: true },
          };
          return operation;
        },
      },
    });
    const observed = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.equal(observed.status, "historical_recovered_pending_close", stage);
    assert.equal(observed.effectStateUnknown, true);
    assert.equal(observed.newRepairPermitted, false);
    const closed = await closeWindowsDockerDesktopRepairUsingDependencies(
      operation.repairId,
      state.dependencies,
    );
    assert.equal(closed.status, "historical_closed_retained", stage);
    assert.equal(closed.effectStateUnknown, true);
    assert.equal(closed.newRepairPermitted, true);
    assert.equal(hostCalls, 0);
    assert.equal(closureWrites, 1);
    assert.deepEqual(operation.ledger, original.ledger);
    assert.equal(operation.stage, original.stage);
    for (const shouldOutputJson of [false, true])
      assert.equal(
        renderDockerRecoveryDoctorReport(closed, shouldOutputJson).exitCode,
        0,
      );
    const repeated = await closeWindowsDockerDesktopRepairUsingDependencies(
      operation.repairId,
      state.dependencies,
    );
    assert.equal(repeated.status, "historical_closed_retained");
    assert.equal(closureWrites, 1);
  }
});

/**
 * 履歴終了の異常境界は新規修復許可を出さず、既存Host操作を発行しないを検証する。
 *
 * @responsibility 履歴終了の異常境界は新規修復許可を出さず、既存Host操作を発行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 履歴終了の異常境界は新規修復許可を出さず、既存Host操作を発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("履歴終了の異常境界は新規修復許可を出さず、既存Host操作を発行しない", async () => {
  for (const failure of [
    "engine",
    "process",
    "run",
    "stale",
    "stale_unknown",
    "cancel",
    "write",
    "cleanup",
    "authority",
  ] as const) {
    const original = operationFixture("renamed", {
      processEffectIssued: null,
      processEffectConfirmation: "unknown",
    });
    let operation: DockerDesktopRepairOperation = {
      ...original,
      history: {
        adoptionSha256: "a".repeat(64),
        handoffTipSha256: "a".repeat(64),
        handoffCount: 0,
        originLocalUserBindingHash: boundary.localUserBindingHash,
        currentLocalUserBindingHash: boundary.localUserBindingHash,
        currentSessionBound: true,
        closed: false,
        liveRunIdentity: null,
        staleState: "unknown",
      },
    };
    let closureWrites = 0;
    let wasReleased = false;
    const state = fixture({
      inventory: () => ({ status: "verified", operations: [operation] }),
      prepareBoundary: () =>
        failure === "authority" && wasReleased ? null : boundary,
      observeEngine: () =>
        failure === "engine" ? "known_unavailable" : "ready",
      observePath: (target) =>
        target === boundary.runDirectory
          ? failure === "run"
            ? { state: "unknown", identity: null }
            : {
                state: "present",
                identity: { dev: "9", ino: "8", birthtimeNs: "7" },
              }
          : failure === "stale_unknown"
            ? { state: "unknown", identity: null }
            : {
                state: "present",
                identity:
                  failure === "stale"
                    ? { ...RUN_IDENTITY, ino: "99" }
                    : RUN_IDENTITY,
              },
      registerCancellation: (listener) => {
        if (failure === "cancel") listener();
        return () => undefined;
      },
      acquireHelper: async () => ({
        status: "acquired",
        session: {
          ...session({
            processes: failure === "process" ? "unknown" : "verified",
          }),
          release: async () => {
            wasReleased = true;
            return failure === "cleanup"
              ? { cleanup: "unknown", protocol: "failed" }
              : { cleanup: "confirmed", protocol: "completed" };
          },
        },
      }),
      history: {
        inspect: () => operation,
        loadOriginManifest: () => ({}),
        loadCurrentManifest: () => ({}),
        persistAdoption: () => assert.fail("not adoption"),
        persistClosure: (_boundary, current, observation) => {
          closureWrites += 1;
          if (failure === "write") return null;
          assert.ok(current.history);
          operation = {
            ...current,
            history: { ...current.history, ...observation, closed: true },
          };
          return operation;
        },
      },
    });
    const result = await closeWindowsDockerDesktopRepairUsingDependencies(
      operation.repairId,
      state.dependencies,
    );
    assert.equal(result.status, "blocked", failure);
    assert.equal(result.newRepairPermitted, false, failure);
    assert.equal(
      closureWrites,
      ["write", "cleanup", "authority"].includes(failure) ? 1 : 0,
      failure,
    );
    assert.equal(
      state.calls.some((call) =>
        ["start", "shutdown", "wsl", "rename"].includes(call),
      ),
      false,
    );
    for (const shouldOutputJson of [true, false])
      assert.equal(
        renderDockerRecoveryDoctorReport(result, shouldOutputJson).exitCode,
        2,
      );
  }
});

/**
 * 既知のruntime directory lockを持つ引継ぎ済み履歴は証拠を閉じ、新修復を許可するを検証する。
 *
 * @responsibility 既知のruntime directory lockを持つ引継ぎ済み履歴は証拠を閉じ、新修復を許可するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既知のruntime directory lockを持つ引継ぎ済み履歴は証拠を閉じ、新修復を許可するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("既知のruntime directory lockを持つ引継ぎ済み履歴は証拠を閉じ、新修復を許可する", async () => {
  const original = operationFixture("prepared", {
    processEffectIssued: null,
    processEffectConfirmation: "unknown",
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "manual_recovery_required",
    evidenceState: "preserved",
    disposition: "historical_effect_unknown_pending_human_decision",
  });
  let operation: DockerDesktopRepairOperation = {
    ...original,
    history: {
      adoptionSha256: "a".repeat(64),
      handoffTipSha256: "b".repeat(64),
      handoffCount: 1,
      originLocalUserBindingHash: boundary.localUserBindingHash,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
      closed: false,
      liveRunIdentity: null,
      staleState: "unknown",
    },
  };
  let closureWrites = 0;
  let hostEffects = 0;
  const state = fixture({
    inventory: () => ({ status: "verified", operations: [operation] }),
    observeEngine: () => "known_unavailable",
    observeKnownSocketFailure: () => RUN_IDENTITY,
    observePath: (target) =>
      target === boundary.runDirectory
        ? { state: "present", identity: RUN_IDENTITY }
        : { state: "confirmed_absent", identity: null },
    history: {
      inspect: () => operation,
      loadOriginManifest: () => ({}),
      loadCurrentManifest: () => ({}),
      persistAdoption: () => assert.fail("already adopted"),
      persistClosure: (_currentBoundary, current, observation) => {
        closureWrites += 1;
        assert.ok(current.history);
        operation = {
          ...current,
          history: { ...current.history, ...observation, closed: true },
        };
        return operation;
      },
    },
    officialShutdown: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    terminateDockerWsl: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    renameRunDirectory: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
  });
  const result = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    state.dependencies,
  );
  assert.equal(
    result.status,
    "historical_closed_retained",
    JSON.stringify(result),
  );
  assert.equal(
    result.reason,
    "docker_desktop_repair_historical_broken_state_retained_for_new_repair",
  );
  assert.equal(result.engineReady, false);
  assert.equal(result.staleRuntimeDirectory, "absent");
  assert.equal(result.evidenceState, "preserved");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.newRepairPermitted, true);
  assert.equal(closureWrites, 1);
  assert.equal(hostEffects, 0);
});

/**
 * Host Effect非発行を証明できる引継ぎ済み履歴は現在の故障推定なしで閉じるを検証する。
 *
 * @responsibility Host Effect非発行を証明できる引継ぎ済み履歴は現在の故障推定なしで閉じるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Effect非発行を証明できる引継ぎ済み履歴は現在の故障推定なしで閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Host Effect非発行を証明できる引継ぎ済み履歴は現在の故障推定なしで閉じる", async () => {
  const original = operationFixture("prepared", {
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown",
        phase: "settled",
        issued: false,
        confirmation: "not_issued",
      }),
    ]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "manual_recovery_required",
    evidenceState: "preserved",
    disposition: "historical_effect_unknown_pending_human_decision",
  });
  let operation: DockerDesktopRepairOperation = {
    ...original,
    history: {
      adoptionSha256: "a".repeat(64),
      handoffTipSha256: "b".repeat(64),
      handoffCount: 1,
      originLocalUserBindingHash: boundary.localUserBindingHash,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
      closed: false,
      liveRunIdentity: null,
      staleState: "unknown",
    },
  };
  let closureWrites = 0;
  let hostEffects = 0;
  const state = fixture({
    inventory: () => ({ status: "verified", operations: [operation] }),
    observeEngine: () => "unknown",
    observeKnownSocketFailure: () => null,
    observePath: (target) =>
      target === boundary.runDirectory
        ? { state: "present", identity: RUN_IDENTITY }
        : { state: "confirmed_absent", identity: null },
    history: {
      inspect: () => operation,
      loadOriginManifest: () => ({}),
      loadCurrentManifest: () => ({}),
      persistAdoption: () => assert.fail("already adopted"),
      persistClosure: (_currentBoundary, current, observation) => {
        closureWrites += 1;
        assert.deepEqual(observation.liveRunIdentity, RUN_IDENTITY);
        assert.ok(current.history);
        operation = {
          ...current,
          history: { ...current.history, ...observation, closed: true },
        };
        return operation;
      },
    },
    officialShutdown: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    terminateDockerWsl: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    renameRunDirectory: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
  });
  const result = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    state.dependencies,
  );
  assert.equal(result.status, "historical_closed_retained");
  assert.equal(
    result.reason,
    "docker_desktop_repair_historical_no_host_effect_retained_for_new_repair",
  );
  assert.equal(result.newRepairPermitted, true);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(closureWrites, 1);
  assert.equal(hostEffects, 0);
});

/**
 * Host Effect非発行を証明できる履歴はexactな旧stale Evidenceを保持して閉じることを検証する。
 *
 * @responsibility Host Effect非発行の履歴を閉じる際に、元Operationと完全一致する旧stale Evidenceを削除せず保持する判定の合否を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するHost Effect非発行Operationとexactな旧stale Identityを使用する。
 * @stimulus 旧staleが元OperationのrunIdentityと一致する状態で明示closeする。
 * @observation 終了状態、Evidence保持状態、closure書込み件数およびHost Effect件数を観測する。
 * @oracle historical_closed_retained、stale=retained、closure 1件、Host Effect 0件となる。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Host Effect非発行履歴はexactな旧stale Evidenceを削除せず閉じる", async () => {
  const original = operationFixture("prepared", {
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown",
        phase: "settled",
        issued: false,
        confirmation: "not_issued",
      }),
    ]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "retained",
    hostSafety: "manual_recovery_required",
    evidenceState: "preserved",
    disposition: "historical_effect_unknown_pending_human_decision",
  });
  let operation: DockerDesktopRepairOperation = {
    ...original,
    history: {
      adoptionSha256: "a".repeat(64),
      handoffTipSha256: "b".repeat(64),
      handoffCount: 1,
      originLocalUserBindingHash: boundary.localUserBindingHash,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
      closed: false,
      liveRunIdentity: null,
      staleState: "retained",
    },
  };
  let closureWrites = 0;
  let hostEffects = 0;
  const state = fixture({
    inventory: () => ({ status: "verified", operations: [operation] }),
    observeEngine: () => "unknown",
    observeKnownSocketFailure: () => null,
    observePath: (target) =>
      target === boundary.runDirectory
        ? { state: "present", identity: RUN_IDENTITY }
        : target === operation.staleDirectory
          ? { state: "present", identity: operation.runIdentity }
          : { state: "confirmed_absent", identity: null },
    history: {
      inspect: () => operation,
      loadOriginManifest: () => ({}),
      loadCurrentManifest: () => ({}),
      persistAdoption: () => assert.fail("already adopted"),
      persistClosure: (_currentBoundary, current, observation) => {
        closureWrites += 1;
        assert.deepEqual(observation.liveRunIdentity, RUN_IDENTITY);
        assert.equal(observation.staleState, "retained");
        assert.ok(current.history);
        operation = {
          ...current,
          history: { ...current.history, ...observation, closed: true },
        };
        return operation;
      },
    },
    officialShutdown: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    terminateDockerWsl: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    renameRunDirectory: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
  });
  const result = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    state.dependencies,
  );
  assert.equal(result.status, "historical_closed_retained");
  assert.equal(
    result.reason,
    "docker_desktop_repair_historical_no_host_effect_retained_for_new_repair",
  );
  assert.equal(result.staleRuntimeDirectory, "retained");
  assert.equal(result.newRepairPermitted, true);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.evidenceState, "preserved");
  assert.equal(closureWrites, 1);
  assert.equal(hostEffects, 0);
});

/**
 * 旧runが新しい既知障害世代へ置換済みでも旧stale Evidenceを保持して新修復を許可するを検証する。
 *
 * @responsibility 旧runが新しい既知障害世代へ置換済みでも旧stale Evidenceを保持して新修復を許可するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧runが新しい既知障害世代へ置換済みで、旧staleが元OperationのIdentityと一致する状態を明示closeする。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("旧runが新しい既知障害世代へ置換済みでも旧stale Evidenceを保持して新修復を許可する", async () => {
  const replacementRunIdentity = Object.freeze({
    dev: "9",
    ino: "8",
    birthtimeNs: "7",
  });
  const original = operationFixture("prepared", {
    processEffectIssued: null,
    processEffectConfirmation: "unknown",
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "manual_recovery_required",
    evidenceState: "preserved",
    disposition: "historical_effect_unknown_pending_human_decision",
  });
  let operation: DockerDesktopRepairOperation = {
    ...original,
    history: {
      adoptionSha256: "a".repeat(64),
      handoffTipSha256: "b".repeat(64),
      handoffCount: 1,
      originLocalUserBindingHash: boundary.localUserBindingHash,
      currentLocalUserBindingHash: boundary.localUserBindingHash,
      currentSessionBound: true,
      closed: false,
      liveRunIdentity: null,
      staleState: "unknown",
    },
  };
  let closureWrites = 0;
  let hostEffects = 0;
  const state = fixture({
    inventory: () => ({ status: "verified", operations: [operation] }),
    observeEngine: () => "known_unavailable",
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "absent" }),
    }),
    observeKnownSocketFailure: () => replacementRunIdentity,
    observePath: (target) =>
      target === boundary.runDirectory
        ? { state: "present", identity: replacementRunIdentity }
        : target === operation.staleDirectory
          ? { state: "present", identity: operation.runIdentity }
          : { state: "confirmed_absent", identity: null },
    history: {
      inspect: () => operation,
      loadOriginManifest: () => ({}),
      loadCurrentManifest: () => ({}),
      persistAdoption: () => assert.fail("already adopted"),
      persistClosure: (_currentBoundary, current, observation) => {
        closureWrites += 1;
        assert.deepEqual(observation.liveRunIdentity, replacementRunIdentity);
        assert.ok(current.history);
        operation = {
          ...current,
          history: { ...current.history, ...observation, closed: true },
        };
        return operation;
      },
    },
    officialShutdown: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    terminateDockerWsl: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    renameRunDirectory: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
  });
  const result = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    state.dependencies,
  );
  assert.equal(
    result.status,
    "historical_closed_retained",
    JSON.stringify(result),
  );
  assert.equal(
    result.reason,
    "docker_desktop_repair_historical_superseded_state_retained_for_new_repair",
  );
  assert.equal(result.engineReady, false);
  assert.equal(result.staleRuntimeDirectory, "retained");
  assert.equal(result.evidenceState, "preserved");
  assert.equal(result.newRepairPermitted, true);
  assert.equal(closureWrites, 1);
  assert.equal(hostEffects, 0);
});

/**
 * 履歴引継ぎの保存不明は同じIDを返し、過去操作を再実行しないを検証する。
 *
 * @responsibility 履歴引継ぎの保存不明は同じIDを返し、過去操作を再実行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 履歴引継ぎの保存不明は同じIDを返し、過去操作を再実行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("履歴引継ぎの保存不明は同じIDを返し、過去操作を再実行しない", async () => {
  const operation = operationFixture("renamed", {
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown",
        phase: "intent_recorded",
        issued: null,
        confirmation: "unknown",
      }),
    ]),
    processEffectIssued: null,
    processEffectConfirmation: "unknown",
  });
  let writes = 0;
  const state = fixture({
    history: {
      inspect: () => operation,
      loadOriginManifest: () => ({}),
      loadCurrentManifest: () => ({}),
      persistAdoption: () => {
        writes += 1;
        return null;
      },
      persistClosure: () => assert.fail("not closing"),
    },
  });
  const result = await adoptWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    "C:\\old-release",
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.repairId, operation.repairId);
  assert.equal(result.newRepairPermitted, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(writes, 1);
  assert.equal(
    state.calls.some((call) =>
      ["start", "shutdown", "wsl", "rename"].includes(call),
    ),
    false,
  );
});

/**
 * 旧Sessionで終了済みの修復は現在Dockerを観測せずEffect 0で引継ぎと終了を完了するを検証する。
 *
 * @responsibility 旧Sessionで終了済みの修復は現在Dockerを観測せずEffect 0で引継ぎと終了を完了するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧Sessionで終了済みの修復は現在Dockerを観測せずEffect 0で引継ぎと終了を完了するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("旧Sessionで終了済みの修復は現在Dockerを観測せずEffect 0で引継ぎと終了を完了する", async () => {
  const original = operationFixture("closed_retained", {
    engineReady: true,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "retained_by_human_decision",
    liveRunIdentity: { dev: "9", ino: "8", birthtimeNs: "7" },
  });
  let operation: DockerDesktopRepairOperation = original;
  let dockerObservationCount = 0;
  let closureWrites = 0;
  const state = fixture({
    observeEngine: () => {
      dockerObservationCount += 1;
      return "known_unavailable";
    },
    observePath: () => {
      dockerObservationCount += 1;
      return { state: "unknown", identity: null };
    },
    inventory: () => ({ status: "verified", operations: [operation] }),
    history: {
      inspect: () => operation,
      loadOriginManifest: () => ({}),
      loadCurrentManifest: () => ({}),
      persistAdoption: (_boundary, current) => {
        operation = {
          ...current,
          history: {
            adoptionSha256: "a".repeat(64),
            handoffTipSha256: "a".repeat(64),
            handoffCount: 0,
            originLocalUserBindingHash: boundary.localUserBindingHash,
            currentLocalUserBindingHash: boundary.localUserBindingHash,
            currentSessionBound: true,
            closed: false,
            liveRunIdentity: null,
            staleState: "unknown",
          },
        };
        return operation;
      },
      persistClosure: (_boundary, current, observation) => {
        closureWrites += 1;
        assert.ok(current.history);
        operation = {
          ...current,
          history: { ...current.history, ...observation, closed: true },
        };
        return operation;
      },
    },
  });
  const result = await adoptWindowsDockerDesktopRepairUsingDependencies(
    original.repairId,
    "C:\\old-release",
    state.dependencies,
  );
  assert.equal(
    result.status,
    "historical_closed_retained",
    JSON.stringify(result),
  );
  assert.equal(result.newRepairPermitted, true);
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.filesystemEffectIssued, true);
  assert.equal(dockerObservationCount, 0);
  assert.equal(closureWrites, 1);
  assert.equal(
    state.calls.some((call) =>
      ["start", "shutdown", "wsl", "rename"].includes(call),
    ),
    false,
  );
});

/**
 * 実Runtime利用側は実Storeのadoptionから再ログオンhandoffとclosureまで同じ履歴を収束するを検証する。
 *
 * @responsibility 実Runtime利用側は実Storeのadoptionから再ログオンhandoffとclosureまで同じ履歴を収束するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Runtime利用側は実Storeのadoptionから再ログオンhandoffとclosureまで同じ履歴を収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("実Runtime利用側は実Storeのadoptionから再ログオンhandoffとclosureまで同じ履歴を収束する", async (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-repair-runtime-history-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(path.join(localAppData, "Docker", "run"), {
    recursive: true,
  });
  const originBoundary: PreparedBoundary = Object.freeze({
    ...boundary,
    runtimeStateRoot,
    localAppData,
    runDirectory: path.join(localAppData, "Docker", "run"),
    socketPath: path.join(localAppData, "Docker", "run", "dockerInference"),
    localUserBindingHash: "a".repeat(64),
    crddManifestHash: "b".repeat(64),
    crddReleaseSequence: 1,
    runtimeExecutionIdentitySha256: "c".repeat(64),
  });
  const firstSessionBoundary: PreparedBoundary = Object.freeze({
    ...originBoundary,
    crddManifestHash: "e".repeat(64),
    crddReleaseSequence: 2,
    runtimeExecutionIdentitySha256: "f".repeat(64),
  });
  const nextSessionBoundary: PreparedBoundary = Object.freeze({
    ...firstSessionBoundary,
    localUserBindingHash: "1".repeat(64),
  });
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const created = createDockerDesktopRepairOperation(
    originBoundary,
    RUN_IDENTITY,
    ledger,
  );
  const original = persistActualRepairRecord(
    originBoundary,
    created,
    "prepared",
    ledger,
  );
  assert.ok(original);
  const originManifest = { release: "origin" };
  const currentManifest = { release: "current" };
  /**
   * verifyHistoryのTest準備責務を実行する。
   *
   * @responsibility verifyHistoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus verifyHistoryを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
   */
  const verifyHistory: DockerDesktopRepairHistoryVerifier = (value) => {
    const selected =
      JSON.stringify(value) === JSON.stringify(originManifest)
        ? originBoundary
        : JSON.stringify(value) === JSON.stringify(currentManifest)
          ? firstSessionBoundary
          : null;
    return selected
      ? {
          manifestHash: selected.crddManifestHash,
          releaseSequence: selected.crddReleaseSequence,
          runtimeExecutionIdentitySha256:
            selected.runtimeExecutionIdentitySha256,
          crddTree: "2".repeat(40),
          packageContentRootSha256: "3".repeat(64),
        }
      : null;
  };
  let activeBoundary = firstSessionBoundary;
  let isHelperHeld = false;
  let helperAcquisitions = 0;
  let helperReleases = 0;
  let hostEffects = 0;
  let adoptionWrites = 0;
  const realHistory = Object.freeze({
    inspect: (
      current: Parameters<
        typeof inspectDockerDesktopRepairHistoricalOperation
      >[0],
      repairId: string,
      manifest: unknown,
    ) =>
      inspectDockerDesktopRepairHistoricalOperation(
        current,
        repairId,
        manifest,
        verifyHistory,
      ),
    persistAdoption: (
      current: Parameters<
        typeof persistDockerDesktopRepairHistoricalAdoption
      >[0],
      operation: DockerDesktopRepairOperation,
      origin: unknown,
      adopting: unknown,
    ) => {
      adoptionWrites += 1;
      return persistDockerDesktopRepairHistoricalAdoption(
        current,
        operation,
        origin,
        adopting,
        verifyHistory,
      );
    },
    persistClosure: (
      current: Parameters<
        typeof persistDockerDesktopRepairHistoricalClosure
      >[0],
      operation: DockerDesktopRepairOperation,
      observation: Parameters<
        typeof persistDockerDesktopRepairHistoricalClosure
      >[2],
      closing: unknown,
    ) =>
      persistDockerDesktopRepairHistoricalClosure(
        current,
        operation,
        observation,
        closing,
        verifyHistory,
      ),
    loadOriginManifest: () => originManifest,
    loadCurrentManifest: () => currentManifest,
  });
  /**
   * createFailureCandidateのTest準備責務を実行する。
   *
   * @responsibility createFailureCandidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus createFailureCandidateを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
   */
  const createFailureCandidate = () => {
    const candidate = createDockerDesktopRepairOperation(
      originBoundary,
      RUN_IDENTITY,
      ledger,
    );
    const persisted = persistActualRepairRecord(
      originBoundary,
      candidate,
      "prepared",
      ledger,
    );
    assert.ok(persisted);
    return persisted;
  };
  const helperFailureCandidate = createFailureCandidate();
  const helperBefore = snapshotDirectoryBytes(
    helperFailureCandidate.operationDirectory,
  );
  const helperFailure = fixture({
    history: realHistory,
    prepareBoundary: () => firstSessionBoundary,
    acquireHelper: async () => ({ status: "unavailable", session: null }),
  });
  const helperFailureResult =
    await adoptWindowsDockerDesktopRepairUsingDependencies(
      helperFailureCandidate.repairId,
      "C:\\old-release",
      helperFailure.dependencies,
    );
  assert.equal(helperFailureResult.status, "blocked");
  assert.equal(
    helperFailureResult.reason,
    "docker_desktop_repair_historical_helper_unavailable",
  );
  assert.equal(
    helperFailure.calls.some((call) =>
      ["shutdown", "wsl", "rename", "start"].includes(call),
    ),
    false,
  );
  assert.deepEqual(
    snapshotDirectoryBytes(helperFailureCandidate.operationDirectory),
    helperBefore,
  );
  fs.rmSync(helperFailureCandidate.operationDirectory, { recursive: true });

  const boundaryFailureCandidate = createFailureCandidate();
  const boundaryBefore = snapshotDirectoryBytes(
    boundaryFailureCandidate.operationDirectory,
  );
  let boundaryReads = 0;
  const boundaryFailure = fixture({
    history: realHistory,
    prepareBoundary: () =>
      boundaryReads++ === 0 ? firstSessionBoundary : nextSessionBoundary,
    acquireHelper: async () => ({ status: "acquired", session: session() }),
  });
  const boundaryFailureResult =
    await adoptWindowsDockerDesktopRepairUsingDependencies(
      boundaryFailureCandidate.repairId,
      "C:\\old-release",
      boundaryFailure.dependencies,
    );
  assert.equal(boundaryFailureResult.status, "blocked");
  assert.equal(
    boundaryFailureResult.repairId,
    boundaryFailureCandidate.repairId,
  );
  assert.equal(
    boundaryFailure.calls.some((call) =>
      ["shutdown", "wsl", "rename", "start"].includes(call),
    ),
    false,
  );
  assert.deepEqual(
    snapshotDirectoryBytes(boundaryFailureCandidate.operationDirectory),
    boundaryBefore,
  );
  fs.rmSync(boundaryFailureCandidate.operationDirectory, { recursive: true });

  const projectionFailureCandidate = createFailureCandidate();
  const corruptProjectionHistory = {
    ...realHistory,
    persistAdoption: (
      ...args: Parameters<typeof realHistory.persistAdoption>
    ) => {
      const persisted = realHistory.persistAdoption(...args);
      assert.ok(persisted?.history);
      return {
        ...persisted,
        history: { ...persisted.history, adoptionSha256: "z".repeat(64) },
      };
    },
  };
  const projectionFailure = fixture({
    history: corruptProjectionHistory,
    prepareBoundary: () => firstSessionBoundary,
    acquireHelper: async () => ({ status: "acquired", session: session() }),
    observeEngine: () => "ready",
    observePath: (target) =>
      target === firstSessionBoundary.runDirectory
        ? { state: "present", identity: RUN_IDENTITY }
        : { state: "confirmed_absent", identity: null },
  });
  const projectionFailureResult =
    await adoptWindowsDockerDesktopRepairUsingDependencies(
      projectionFailureCandidate.repairId,
      "C:\\old-release",
      projectionFailure.dependencies,
    );
  assert.equal(projectionFailureResult.status, "blocked");
  const bytesAfterProjectionFailure = snapshotDirectoryBytes(
    projectionFailureCandidate.operationDirectory,
  );
  const projectionRetry = fixture({
    history: realHistory,
    prepareBoundary: () => firstSessionBoundary,
    acquireHelper: async () => ({ status: "acquired", session: session() }),
    observeEngine: () => "ready",
    observePath: (target) =>
      target === firstSessionBoundary.runDirectory
        ? { state: "present", identity: RUN_IDENTITY }
        : { state: "confirmed_absent", identity: null },
  });
  const projectionRetryResult =
    await adoptWindowsDockerDesktopRepairUsingDependencies(
      projectionFailureCandidate.repairId,
      "C:\\old-release",
      projectionRetry.dependencies,
    );
  assert.equal(
    projectionRetryResult.status,
    "historical_recovered_pending_close",
  );
  assert.deepEqual(
    snapshotDirectoryBytes(projectionFailureCandidate.operationDirectory),
    bytesAfterProjectionFailure,
  );
  fs.rmSync(projectionFailureCandidate.operationDirectory, { recursive: true });
  adoptionWrites = 0;
  const state = fixture({
    history: realHistory,
    prepareBoundary: () => activeBoundary,
    acquireHelper: async () => {
      assert.equal(isHelperHeld, false);
      isHelperHeld = true;
      helperAcquisitions += 1;
      return {
        status: "acquired",
        session: {
          ...session(),
          release: async () => {
            assert.equal(isHelperHeld, true);
            isHelperHeld = false;
            helperReleases += 1;
            return { cleanup: "confirmed", protocol: "completed" };
          },
        },
      };
    },
    inventory: (current) =>
      inventoryDockerDesktopRepairOperations(current, verifyHistory),
    observeEngine: () => "ready",
    observePath: (target) =>
      target === activeBoundary.runDirectory
        ? { state: "present", identity: RUN_IDENTITY }
        : target.includes("run.crdd-stale-")
          ? { state: "confirmed_absent", identity: null }
          : { state: "unknown", identity: null },
    officialShutdown: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    terminateDockerWsl: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
    renameRunDirectory: () => {
      hostEffects += 1;
      throw new Error("unexpected host effect");
    },
  });
  assert.ok(
    inspectDockerDesktopRepairHistoricalOperation(
      firstSessionBoundary,
      original.repairId,
      originManifest,
      verifyHistory,
    ),
  );
  const adopted = await adoptWindowsDockerDesktopRepairUsingDependencies(
    original.repairId,
    "C:\\old-release",
    state.dependencies,
  );
  assert.equal(adopted.repairId, original.repairId, JSON.stringify(adopted));
  assert.equal(
    adopted.status,
    "historical_recovered_pending_close",
    JSON.stringify(adopted),
  );
  assert.equal(adoptionWrites, 1);
  const sameSession = await adoptWindowsDockerDesktopRepairUsingDependencies(
    original.repairId,
    "C:\\old-release",
    state.dependencies,
  );
  assert.equal(sameSession.status, "historical_recovered_pending_close");
  assert.equal(adoptionWrites, 1);
  activeBoundary = nextSessionBoundary;
  const handed = await adoptWindowsDockerDesktopRepairUsingDependencies(
    original.repairId,
    "C:\\old-release",
    state.dependencies,
  );
  assert.equal(handed.repairId, original.repairId);
  assert.equal(handed.repairId, original.repairId, JSON.stringify(handed));
  const directlyHanded = inspectDockerDesktopRepairHistoricalOperation(
    nextSessionBoundary,
    original.repairId,
    originManifest,
    verifyHistory,
  );
  assert.ok(directlyHanded, JSON.stringify(handed));
  assert.equal(directlyHanded.history?.handoffCount, 1);
  assert.equal(adoptionWrites, 2);
  repairRuntimeTraceAssertions[
    "CASE-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION"
  ]?.("CASE-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION", {
    id: "CASE-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION",
    transitionId: "TRANS-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION",
    fromState: "STATE-REPAIR-HISTORY-PRIOR-SESSION",
    outcome: "taken",
    expectedEndState: "STATE-REPAIR-HISTORY-CURRENT-SESSION",
    effectObservations: { provider: 0, host: 0, cleanup: 1 },
    expectedStatus: "completed",
    resourcePostconditions: {
      "RES-RUNTIME-STATE-LOCK": "absent",
      "RES-REPAIR-HISTORY-PREPARE": "absent",
    },
  });
  executedRepairRuntimeTraceCases.add(
    "CASE-REPAIR-HISTORY-PRIOR-TO-CURRENT-SESSION",
  );
  const closed = await closeWindowsDockerDesktopRepairUsingDependencies(
    original.repairId,
    state.dependencies,
  );
  assert.equal(closed.status, "historical_closed_retained");
  assert.equal(closed.repairId, original.repairId);
  assert.equal(closed.nativeHelperCleanupConfirmed, true);
  const closedAgain = await adoptWindowsDockerDesktopRepairUsingDependencies(
    original.repairId,
    "C:\\old-release",
    state.dependencies,
  );
  assert.equal(closedAgain.status, "historical_closed_retained");
  assert.equal(adoptionWrites, 2);
  assert.equal(isHelperHeld, false);
  assert.equal(helperAcquisitions, 5);
  assert.equal(helperReleases, 5);
  assert.equal(hostEffects, 0);
  const inventory = inventoryDockerDesktopRepairOperations(
    nextSessionBoundary,
    verifyHistory,
  );
  assert.equal(inventory.status, "verified");
  assert.equal(inventory.operations[0]?.repairId, original.repairId);
  assert.equal(inventory.operations[0]?.history?.closed, true);
  assert.equal(inventory.operations[0]?.history?.handoffCount, 1);
});

/**
 * Docker Desktop修復Runtimeの設計Traceを全実行するを検証する。
 *
 * @responsibility Docker Desktop修復Runtimeの設計Traceを全実行するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker Desktop修復Runtimeの設計Traceを全実行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Docker Desktop修復Runtimeの設計Traceを全実行する", () => {
  assertRuntimeTraceExecutionCoverage(
    "40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts",
    Object.keys(repairRuntimeTraceAssertions),
    executedRepairRuntimeTraceCases,
  );
});

/**
 * 既知障害だけを順序付きで処置し明示closeを要求するを検証する。
 *
 * @responsibility 既知障害だけを順序付きで処置し明示closeを要求するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既知障害だけを順序付きで処置し明示closeを要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("既知障害だけを順序付きで処置し明示closeを要求する", async () => {
  const state = fixture();
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.filesystemEffectIssued, true);
  assert.equal(result.engineReady, true);
  assert.equal(result.staleRuntimeDirectory, "retained");
  assert.equal(result.deletionPerformed, false);
  assert.deepEqual(
    state.calls.filter((call) =>
      [
        "shutdown",
        "wsl",
        "rename",
        "start",
        "persist:prepared",
        "persist:processes_stopped",
        "persist:renamed",
        "persist:recovered_pending_disposition",
      ].includes(call),
    ),
    [
      "persist:prepared",
      "persist:prepared",
      "shutdown",
      "persist:prepared",
      "persist:prepared",
      "persist:prepared",
      "persist:prepared",
      "wsl",
      "persist:prepared",
      "persist:processes_stopped",
      "persist:processes_stopped",
      "rename",
      "persist:processes_stopped",
      "persist:renamed",
      "persist:renamed",
      "start",
      "persist:renamed",
      "persist:recovered_pending_disposition",
    ],
  );

  const close = await closeWindowsDockerDesktopRepairUsingDependencies(
    result.repairId,
    state.dependencies,
  );
  assert.equal(close.status, "closed_retained");
  assert.equal(close.newRepairPermitted, true);
  assert.equal(close.disposition, "retained_by_human_decision");
  assert.equal(close.deletionPerformed, false);
});

/**
 * Engine ready・unknown・socket根拠なしではDocker Host Effectを発行しないを検証する。
 *
 * @responsibility Engine ready・unknown・socket根拠なしではDocker Host Effectを発行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Engine ready・unknown・socket根拠なしではDocker Host Effectを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Engine ready・unknown・socket根拠なしではDocker Host Effectを発行しない", async () => {
  for (const scenario of [
    ...["EACCES", "present"].map((pipe) => ({
      observeEngine: () =>
        observeDockerDesktopEngineResult(
          {
            pid: 123,
            status: 1,
            signal: null,
            stdout: "\n",
            stderr: "unavailable",
          },
          policy.engineVersion,
          () => {
            if (pipe !== "present")
              throw Object.assign(new Error(), { code: pipe });
          },
        ),
      reason: "docker_desktop_engine_state_unknown",
    })),
    {
      observeEngine: () => "ready" as const,
      reason: "docker_desktop_engine_already_available",
    },
    {
      observeEngine: () => "unknown" as const,
      reason: "docker_desktop_engine_state_unknown",
    },
    {
      observeKnownSocketFailure: () => null,
      reason: "docker_desktop_known_socket_failure_unconfirmed",
    },
  ]) {
    const state = fixture(scenario);
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.equal(result.reason, scenario.reason);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.nativeHelperCleanupConfirmed, true);
  }
});

/**
 * intent耐久化後のEngine回復・不明はHost関数を呼ばずsettlementへ閉じるを検証する。
 *
 * @responsibility intent耐久化後のEngine回復・不明はHost関数を呼ばずsettlementへ閉じるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus intent耐久化後のEngine回復・不明はHost関数を呼ばずsettlementへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("intent耐久化後のEngine回復・不明はHost関数を呼ばずsettlementへ閉じる", async () => {
  for (const afterIntent of ["ready", "unknown"] as const) {
    let observations = 0;
    const state = fixture({
      observeEngine: () => {
        observations += 1;
        return observations <= 2 ? "known_unavailable" : afterIntent;
      },
    });
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.equal(state.calls.includes("shutdown"), false);
    assert.equal(result.processEffectIssued, false);
    if (afterIntent === "ready") {
      assert.equal(result.status, "recovered_pending_close");
      assert.equal(
        result.operationState,
        "no_stale_known_effect_recovery_pending",
      );
    } else {
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        "docker_desktop_repair_pre_effect_state_unknown",
      );
    }
  }
});

/**
 * 自然回復settlement後のEngine再停止をpendingへ永続化しないを検証する。
 *
 * @responsibility 自然回復settlement後のEngine再停止をpendingへ永続化しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 自然回復settlement後のEngine再停止をpendingへ永続化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("自然回復settlement後のEngine再停止をpendingへ永続化しない", async () => {
  let observations = 0;
  const state = fixture({
    observeEngine: () => {
      observations += 1;
      if (observations <= 2) return "known_unavailable" as const;
      if (observations === 3) return "ready" as const;
      return "known_unavailable" as const;
    },
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_current_state_changed_before_record",
  );
  assert.equal(state.calls.includes("shutdown"), false);
  assert.equal(
    state.calls.includes("persist:no_stale_known_effect_recovery_pending"),
    false,
  );
});

/**
 * 最終artifact await中のEngine回復はfresh行列で公式shutdown Effect 0にするを検証する。
 *
 * @responsibility 最終artifact await中のEngine回復はfresh行列で公式shutdown Effect 0にするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 最終artifact await中のEngine回復はfresh行列で公式shutdown Effect 0にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("最終artifact await中のEngine回復はfresh行列で公式shutdown Effect 0にする", async () => {
  let verifyCalls = 0;
  let isEngineReady = false;
  let shutdownCalls = 0;
  const state = fixture({
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session({ processes: "verified" }),
        verifyArtifacts: async () => {
          verifyCalls += 1;
          if (verifyCalls === 5) isEngineReady = true;
          return "verified" as const;
        },
      }),
    }),
    observeEngine: () => (isEngineReady ? "ready" : "known_unavailable"),
    officialShutdown: () => {
      shutdownCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(verifyCalls >= 5, true);
  assert.equal(shutdownCalls, 0);
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
});

/**
 * Effect別fresh行列はWSL／rename直前のProcess再出現をEffect 0へ閉じるを検証する。
 *
 * @responsibility Effect別fresh行列はWSL／rename直前のProcess再出現をEffect 0へ閉じるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Effect別fresh行列はWSL／rename直前のProcess再出現をEffect 0へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Effect別fresh行列はWSL／rename直前のProcess再出現をEffect 0へ閉じる", async () => {
  let inspections = 0;
  let wslCalls = 0;
  const wslState = fixture({
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session({ processes: "absent", terminate: "absent" }),
        inspectProcesses: async () => {
          inspections += 1;
          return inspections >= 3 ? ("verified" as const) : ("absent" as const);
        },
      }),
    }),
    terminateDockerWsl: () => {
      wslCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
  });
  const wslResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    wslState.dependencies,
  );
  assert.equal(wslResult.status, "blocked");
  assert.equal(wslCalls, 0);

  const stopped = operationFixture("processes_stopped", {
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
      Object.freeze({
        sequence: 1,
        action: "native_termination",
        phase: "settled",
        issued: false,
        confirmation: "not_issued",
      }),
      Object.freeze({
        sequence: 2,
        action: "wsl_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    evidenceState: "preserved",
  });
  let renameCalls = 0;
  const renameState = fixture({
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "verified" }),
    }),
    renameRunDirectory: () => {
      renameCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
  });
  renameState.setOperation(stopped);
  const renameResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    renameState.dependencies,
  );
  assert.equal(renameResult.status, "blocked");
  assert.equal(renameCalls, 0);
});

/**
 * 64 retained operationでは新規operation directory／recordを作らないを検証する。
 *
 * @responsibility 64 retained operationでは新規operation directory／recordを作らないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 64 retained operationでは新規operation directory／recordを作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("64 retained operationでは新規operation directory／recordを作らない", async () => {
  const retained = operationFixture("closed_retained", {
    engineReady: true,
    disposition: "retained_by_human_decision",
    liveRunIdentity: RUN_IDENTITY,
  });
  let persisted = 0;
  const state = fixture({
    inventory: () =>
      Object.freeze({
        status: "verified" as const,
        operations: Object.freeze(Array.from({ length: 64 }, () => retained)),
      }),
    persistStage: (..._args) => {
      persisted += 1;
      return null;
    },
    observePath: (target) =>
      target.includes("run.crdd-stale-")
        ? Object.freeze({ state: "present" as const, identity: RUN_IDENTITY })
        : Object.freeze({ state: "present" as const, identity: RUN_IDENTITY }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.reason,
    "docker_desktop_repair_operation_capacity_unavailable",
  );
  assert.equal(persisted, 0);
  assert.equal(state.calls.includes("shutdown"), false);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.operatorActionRequired, true);
  const rendered = renderDockerRecoveryDoctorReport(result, false);
  assert.match(rendered.stdout, /再試行や復旧記録の削除・圧縮をしない/u);
});

/**
 * 復旧記録の残枠不足では次のHost Effectを発行しないを検証する。
 *
 * @responsibility 復旧記録の残枠不足では次のHost Effectを発行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 復旧記録の残枠不足では次のHost Effectを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("復旧記録の残枠不足では次のHost Effectを発行しない", async () => {
  let terminationCalls = 0;
  const prepared = Object.freeze({
    ...operationFixture("prepared", {
      processEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "official_shutdown",
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ]),
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "record_write",
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ]),
      staleState: "absent",
    }),
    sequence: 13,
  });
  const state = fixture({
    acquireHelper: async () =>
      Object.freeze({
        status: "acquired" as const,
        session: Object.freeze({
          ...session({ processes: "verified" }),
          terminateProcesses: async () => {
            terminationCalls += 1;
            return "terminated" as const;
          },
        }),
      }),
  });
  state.setOperation(prepared);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(terminationCalls, 0);
  assert.equal(state.calls.includes("wsl"), false);
});

/**
 * 境界・lock不成立とhelper cleanup不明を区別するを検証する。
 *
 * @responsibility 境界・lock不成立とhelper cleanup不明を区別するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 境界・lock不成立とhelper cleanup不明を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("境界・lock不成立とhelper cleanup不明を区別する", async () => {
  const boundaryResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      fixture({ prepareBoundary: () => null }).dependencies,
    );
  assert.equal(
    boundaryResult.reason,
    "docker_desktop_repair_boundary_unavailable",
  );
  assert.equal(boundaryResult.manualRecoveryRequired, false);
  assert.equal(boundaryResult.effectStateUnknown, false);

  const lockResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      acquireHelper: async () =>
        Object.freeze({ status: "unavailable" as const, session: null }),
    }).dependencies,
  );
  assert.equal(lockResult.reason, "docker_desktop_repair_lock_unavailable");
  assert.equal(lockResult.manualRecoveryRequired, false);

  const cleanupResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      fixture({
        acquireHelper: async () =>
          Object.freeze({ status: "cleanup_unknown" as const, session: null }),
      }).dependencies,
    );
  assert.equal(cleanupResult.manualRecoveryRequired, true);
  assert.equal(cleanupResult.effectStateUnknown, true);
});

/**
 * 記録・process inventory・rename・restartの不明を成功へ昇格しないを検証する。
 *
 * @responsibility 記録・process inventory・rename・restartの不明を成功へ昇格しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 記録・process inventory・rename・restartの不明を成功へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("記録・process inventory・rename・restartの不明を成功へ昇格しない", async () => {
  const scenarios: readonly [Partial<RepairDependencies>, string][] = [
    [
      { persistStage: () => null },
      "docker_desktop_repair_record_durability_unknown",
    ],
    [
      {
        acquireHelper: async () =>
          Object.freeze({
            status: "acquired" as const,
            session: session({ processes: "unknown" }),
          }),
      },
      "docker_desktop_repair_pre_effect_state_unknown",
    ],
    [
      {
        acquireHelper: async () =>
          Object.freeze({
            status: "acquired" as const,
            session: session({
              processes: "verified",
              terminate: "terminated",
            }),
          }),
      },
      "docker_desktop_repair_pre_effect_state_unknown",
    ],
    [
      {
        renameRunDirectory: () =>
          Object.freeze({
            issued: null,
            confirmation: "unknown" as const,
            staleState: "unknown" as const,
          }),
      },
      "docker_desktop_runtime_rename_unconfirmed",
    ],
    [
      {
        acquireHelper: async () =>
          Object.freeze({
            status: "acquired" as const,
            session: Object.freeze({
              ...session(),
              inspectProcesses: async () => "absent" as const,
              launchDesktop: async () => "unknown" as const,
            }),
          }),
      },
      "docker_desktop_restart_unconfirmed",
    ],
  ];
  for (const [overrides, reason] of scenarios) {
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      fixture(overrides).dependencies,
    );
    assert.equal(result.status, "blocked", reason);
    assert.equal(result.reason, reason);
    if (result.processEffectIssued !== false)
      assert.equal(result.manualRecoveryRequired, true);
  }
});

/**
 * K/Nとrun path unknownは後続WSL／launcher Effectを発行しないを検証する。
 *
 * @responsibility K/Nとrun path unknownは後続WSL／launcher Effectを発行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus K/Nとrun path unknownは後続WSL／launcher Effectを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("K/Nとrun path unknownは後続WSL／launcher Effectを発行しない", async () => {
  const unknownTermination = fixture({
    acquireHelper: async () =>
      Object.freeze({
        status: "acquired" as const,
        session: session({
          processes: "verified",
          terminate: "not_issued_unknown",
        }),
      }),
  });
  const terminationResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      unknownTermination.dependencies,
    );
  assert.equal(
    terminationResult.reason,
    "docker_desktop_process_state_unknown_without_effect",
  );
  assert.equal(unknownTermination.calls.includes("wsl"), false);

  const renamedOperation = operationFixture("renamed");
  const unknownPath = fixture({
    observePath: (target) =>
      target.includes("run.crdd-stale-")
        ? Object.freeze({ state: "present" as const, identity: RUN_IDENTITY })
        : Object.freeze({ state: "unknown" as const, identity: null }),
  });
  unknownPath.setOperation(renamedOperation);
  const pathResult = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    unknownPath.dependencies,
  );
  assert.equal(pathResult.status, "blocked");
  assert.equal(unknownPath.calls.includes("start"), false);
});

/**
 * helper解放不明は回復後も成功へ昇格しないを検証する。
 *
 * @responsibility helper解放不明は回復後も成功へ昇格しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus helper解放不明は回復後も成功へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("helper解放不明は回復後も成功へ昇格しない", async () => {
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      acquireHelper: async () =>
        Object.freeze({
          status: "acquired" as const,
          session: session({ release: "cleanup_unknown" }),
        }),
    }).dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_desktop_repair_lock_cleanup_unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.nativeHelperCleanupConfirmed, false);
});

/**
 * repairはhelper解放後のpackage世代変更をpending成功へ投影しないを検証する。
 *
 * @responsibility repairはhelper解放後のpackage世代変更をpending成功へ投影しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus repairはhelper解放後のpackage世代変更をpending成功へ投影しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("repairはhelper解放後のpackage世代変更をpending成功へ投影しない", async () => {
  let released = false;
  let wasLaunched = false;
  let terminated = false;
  let wasRenamed = false;
  const changedBoundary = Object.freeze({
    ...boundary,
    runtimeExecutionIdentitySha256: "b".repeat(64),
  });
  const repairHelper = Object.freeze({
    ...session(),
    inspectProcesses: async () =>
      wasLaunched || !terminated ? ("verified" as const) : ("absent" as const),
    terminateProcesses: async () => {
      terminated = true;
      return "terminated" as const;
    },
    release: async () => {
      released = true;
      return Object.freeze({
        cleanup: "confirmed" as const,
        protocol: "completed" as const,
      });
    },
    launchDesktop: async () => {
      wasLaunched = true;
      return "started" as const;
    },
  });
  const state = fixture({
    prepareBoundary: () => (released ? changedBoundary : boundary),
    observeEngine: () =>
      wasLaunched ? ("ready" as const) : ("known_unavailable" as const),
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: repairHelper,
    }),
    renameRunDirectory: () => {
      wasRenamed = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    observePath: (target) => {
      if (target === boundary.runDirectory)
        return wasRenamed && !wasLaunched
          ? Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            })
          : Object.freeze({
              state: "present" as const,
              identity: RUN_IDENTITY,
            });
      if (target.includes("run.crdd-stale-"))
        return wasRenamed
          ? Object.freeze({ state: "present" as const, identity: RUN_IDENTITY })
          : Object.freeze({
              state: "confirmed_absent" as const,
              identity: null,
            });
      return Object.freeze({ state: "unknown" as const, identity: null });
    },
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_terminal_boundary_changed",
  );
});

/**
 * helper解放後のboundary例外は取得済みrepair Evidenceを保持して正規化するを検証する。
 *
 * @responsibility helper解放後のboundary例外は取得済みrepair Evidenceを保持して正規化するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus helper解放後のboundary例外は取得済みrepair Evidenceを保持して正規化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("helper解放後のboundary例外は取得済みrepair Evidenceを保持して正規化する", async () => {
  let released = false;
  let isHelperLaunched = false;
  let isHelperRenamed = false;
  const state = fixture({
    prepareBoundary: () => {
      if (released) throw new Error("C:\\secret\\boundary");
      return boundary;
    },
    observeEngine: () =>
      isHelperLaunched ? ("ready" as const) : ("known_unavailable" as const),
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session({ processes: "absent", terminate: "absent" }),
        inspectProcesses: async () =>
          isHelperLaunched ? ("verified" as const) : ("absent" as const),
        launchDesktop: async () => {
          isHelperLaunched = true;
          return "started" as const;
        },
        release: async () => {
          released = true;
          return Object.freeze({
            cleanup: "confirmed" as const,
            protocol: "completed" as const,
          });
        },
      }),
    }),
    renameRunDirectory: () => {
      isHelperRenamed = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    observePath: (target) =>
      target === boundary.runDirectory
        ? isHelperLaunched
          ? Object.freeze({ state: "present" as const, identity: RUN_IDENTITY })
          : isHelperRenamed
            ? Object.freeze({
                state: "confirmed_absent" as const,
                identity: null,
              })
            : Object.freeze({
                state: "present" as const,
                identity: RUN_IDENTITY,
              })
        : target.includes("run.crdd-stale-")
          ? isHelperRenamed
            ? Object.freeze({
                state: "present" as const,
                identity: RUN_IDENTITY,
              })
            : Object.freeze({
                state: "confirmed_absent" as const,
                identity: null,
              })
          : Object.freeze({ state: "unknown" as const, identity: null }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_terminal_boundary_changed",
  );
  assert.match(result.repairId ?? "", /^docker-desktop-repair\.[a-f0-9]{32}$/u);
  assert.equal(result.nativeHelperCleanupConfirmed, true);
  assert.equal(result.newRepairPermitted, false);
});

/**
 * prepared再開は過去Process EffectをEffect 0へ誤投影しないを検証する。
 *
 * @responsibility prepared再開は過去Process EffectをEffect 0へ誤投影しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus prepared再開は過去Process EffectをEffect 0へ誤投影しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("prepared再開は過去Process EffectをEffect 0へ誤投影しない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "a".repeat(32),
    repairId: `docker-desktop-repair.${"a".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-a",
    staleName: `run.crdd-stale-${"a".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"a".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "prepared",
    sequence: 0,
    previousRecordSha256: "9".repeat(64),
    ledger,
  });
  const state = fixture({ observeEngine: () => "ready" as const });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, null);
  assert.equal(result.newRepairPermitted, false);
  assert.deepEqual(
    state.calls.filter((entry) => entry.startsWith("persist:")),
    ["persist:prepared", "persist:no_stale_historical_effect_unknown_pending"],
  );
});

/**
 * preparedの既知Effect自然回復も観測Recordとpending stageを分離するを検証する。
 *
 * @responsibility preparedの既知Effect自然回復も観測Recordとpending stageを分離するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus preparedの既知Effect自然回復も観測Recordとpending stageを分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("preparedの既知Effect自然回復も観測Recordとpending stageを分離する", async () => {
  const operation = operationFixture("prepared", {
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    evidenceState: "preserved",
  });
  const state = fixture({ observeEngine: () => "ready" as const });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.deepEqual(
    state.calls.filter((entry) => entry.startsWith("persist:")),
    ["persist:prepared", "persist:no_stale_known_effect_recovery_pending"],
  );
});

/**
 * preparedはsettlement済みshutdown／K／WSLを再発行せず次の状態へ進むを検証する。
 *
 * @responsibility preparedはsettlement済みshutdown／K／WSLを再発行せず次の状態へ進むの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus preparedはsettlement済みshutdown／K／WSLを再発行せず次の状態へ進むの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("preparedはsettlement済みshutdown／K／WSLを再発行せず次の状態へ進む", async () => {
  for (const actions of [
    ["official_shutdown"],
    ["official_shutdown", "native_termination"],
    ["official_shutdown", "native_termination", "wsl_termination"],
  ] as const) {
    const processEffects = Object.freeze(
      actions.map((action, sequence) =>
        Object.freeze({
          sequence,
          action,
          phase: "settled" as const,
          issued: true,
          confirmation: "confirmed" as const,
        }),
      ),
    );
    const operation = operationFixture("prepared", {
      processEffects,
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "record_write",
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ]),
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "confirmed",
      staleState: "absent",
    });
    const state = fixture({
      acquireHelper: async () =>
        Object.freeze({
          status: "acquired" as const,
          session: session({ processes: "absent" }),
        }),
    });
    state.setOperation(operation);
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.notEqual(
      result.reason,
      "docker_desktop_repair_authority_changed_after_intent",
    );
    assert.equal(state.calls.includes("shutdown"), false);
    if ((actions as readonly string[]).includes("wsl_termination"))
      assert.equal(state.calls.includes("wsl"), false);
  }
});

/**
 * renamed再開でEngineが既に回復済みならlauncherを二重起動しないを検証する。
 *
 * @responsibility renamed再開でEngineが既に回復済みならlauncherを二重起動しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus renamed再開でEngineが既に回復済みならlauncherを二重起動しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("renamed再開でEngineが既に回復済みならlauncherを二重起動しない", async () => {
  const recoveredRunIdentity = Object.freeze({
    dev: "7",
    ino: "8",
    birthtimeNs: "9",
  });
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "b".repeat(32),
    repairId: `docker-desktop-repair.${"b".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-b",
    staleName: `run.crdd-stale-${"b".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"b".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "renamed",
    sequence: 2,
    previousRecordSha256: "8".repeat(64),
    ledger,
  });
  const state = fixture({
    observeEngine: () => "ready" as const,
    identityAt: (target) =>
      target === boundary.runDirectory
        ? recoveredRunIdentity
        : target.includes("run.crdd-stale-")
          ? RUN_IDENTITY
          : null,
  });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(state.calls.includes("start"), false);
  assert.equal(
    state.calls.includes("persist:recovered_pending_disposition"),
    true,
  );
});

/**
 * 現行の非履歴Operationも失敗起動Continuation能力を要求することを検証する。
 *
 * @responsibility 現行の非履歴Operationが複数Runtime領域の段階処置を迂回しないことを保証する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Continuation能力を持たない依存境界で現行の非履歴Operationへ再入場する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle 単一領域の再起動判定へ戻らず、Continuation能力不足としてEffect 0で停止する。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("現行の非履歴Operationも失敗起動Continuation能力を要求する", async () => {
  const operationDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-current-repair-"),
  );
  try {
    const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
      processEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "native_termination" as const,
          phase: "settled" as const,
          issued: true,
          confirmation: "confirmed" as const,
        }),
        Object.freeze({
          sequence: 1,
          action: "desktop_launch" as const,
          phase: "settled" as const,
          issued: true,
          confirmation: "confirmed" as const,
        }),
      ]),
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffects: Object.freeze([]),
      filesystemEffectIssued: false,
      filesystemEffectConfirmation: "not_issued",
      engineReady: false,
      staleState: "retained",
      hostSafety: "manual_recovery_required",
      evidenceState: "preserved",
      disposition: "not_applicable",
      liveRunIdentity: null,
    });
    const operation: DockerDesktopRepairOperation = Object.freeze({
      operationId: "e".repeat(32),
      repairId: `docker-desktop-repair.${"e".repeat(32)}`,
      operationDirectory,
      staleName: `run.crdd-stale-${"e".repeat(32)}`,
      staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"e".repeat(32)}`,
      runIdentity: RUN_IDENTITY,
      stage: "renamed",
      sequence: 2,
      previousRecordSha256: "8".repeat(64),
      ledger,
    });
    const state = fixture({
      acquireHelper: async () =>
        Object.freeze({
          status: "acquired" as const,
          session: session({ processes: "absent" }),
        }),
      awaitEngine: async () => "known_unavailable" as const,
    });
    state.setOperation(operation);
    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      state.dependencies,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "docker_desktop_repair_continuation_capability_unavailable",
    );
    assert.equal(state.calls.includes("start"), false);
    assert.equal(
      fs.existsSync(path.join(operationDirectory, "runtime-continuation")),
      false,
    );
  } finally {
    fs.rmSync(operationDirectory, { recursive: true, force: true });
  }
});

/**
 * processes_stopped再開は既知issuedを保持してno-stale pendingへ進むを検証する。
 *
 * @responsibility processes_stopped再開は既知issuedを保持してno-stale pendingへ進むの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus processes_stopped再開は既知issuedを保持してno-stale pendingへ進むの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("processes_stopped再開は既知issuedを保持してno-stale pendingへ進む", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "d".repeat(32),
    repairId: `docker-desktop-repair.${"d".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-d",
    staleName: `run.crdd-stale-${"d".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"d".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "processes_stopped",
    sequence: 1,
    previousRecordSha256: "6".repeat(64),
    ledger,
  });
  const state = fixture({ observeEngine: () => "ready" as const });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.processEffectConfirmation, "confirmed");
  assert.equal(result.effectStateUnknown, false);
});

/**
 * processes_stopped再開はProcess不明または置換runをpendingへ昇格しないを検証する。
 *
 * @responsibility processes_stopped再開はProcess不明または置換runをpendingへ昇格しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus processes_stopped再開はProcess不明または置換runをpendingへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("processes_stopped再開はProcess不明または置換runをpendingへ昇格しない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "1".repeat(32),
    repairId: `docker-desktop-repair.${"1".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-1",
    staleName: `run.crdd-stale-${"1".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"1".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "processes_stopped",
    sequence: 1,
    previousRecordSha256: "6".repeat(64),
    ledger,
  });
  const unknown = fixture({
    observeEngine: () => "ready" as const,
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "unknown" }),
    }),
  });
  unknown.setOperation(operation);
  const unknownResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      unknown.dependencies,
    );
  assert.equal(unknownResult.status, "blocked");
  assert.equal(
    unknown.calls.includes(
      "persist:no_stale_historical_effect_unknown_pending",
    ),
    false,
  );

  const foreignIdentity = Object.freeze({
    dev: "9",
    ino: "9",
    birthtimeNs: "9",
  });
  const replaced = fixture({
    observeEngine: () => "ready" as const,
    identityAt: (target) =>
      target === boundary.runDirectory ? foreignIdentity : null,
  });
  replaced.setOperation(operation);
  const replacedResult =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(
      replaced.dependencies,
    );
  assert.equal(replacedResult.status, "blocked");
});

/**
 * rename Effect後settlement前の再開はexact staleをadoptし再renameしないを検証する。
 *
 * @responsibility rename Effect後settlement前の再開はexact staleをadoptし再renameしないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rename Effect後settlement前の再開はexact staleをadoptし再renameしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("rename Effect後settlement前の再開はexact staleをadoptし再renameしない", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "runtime_directory_rename",
        phase: "intent_recorded",
        issued: null,
        confirmation: "unknown",
      }),
    ]),
    filesystemEffectIssued: null,
    filesystemEffectConfirmation: "unknown",
    engineReady: false,
    staleState: "unknown",
    hostSafety: "unknown",
    evidenceState: "preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "2".repeat(32),
    repairId: `docker-desktop-repair.${"2".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-2",
    staleName: `run.crdd-stale-${"2".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"2".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "processes_stopped",
    sequence: 3,
    previousRecordSha256: "7".repeat(64),
    ledger,
  });
  const state = fixture({
    observeEngine: () => "known_unavailable" as const,
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "absent" }),
    }),
    identityAt: (target) =>
      target.includes("run.crdd-stale-") ? RUN_IDENTITY : null,
  });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(state.calls.includes("rename"), false);
  assert.equal(state.calls.includes("persist:renamed"), true);
});

/**
 * rename adoptionのfresh snapshot変化をsettlement stageへ永続化しないを検証する。
 *
 * @responsibility rename adoptionのfresh snapshot変化をsettlement stageへ永続化しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rename adoptionのfresh snapshot変化をsettlement stageへ永続化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("rename adoptionのfresh snapshot変化をsettlement stageへ永続化しない", async () => {
  const operation = operationFixture("processes_stopped", {
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "runtime_directory_rename",
        phase: "intent_recorded",
        issued: null,
        confirmation: "unknown",
      }),
    ]),
    filesystemEffectIssued: null,
    filesystemEffectConfirmation: "unknown",
    staleState: "unknown",
    hostSafety: "unknown",
  });
  let staleObservations = 0;
  const state = fixture({
    observeEngine: () => "known_unavailable" as const,
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: session({ processes: "absent" }),
    }),
    identityAt: (target) => {
      if (!target.includes("run.crdd-stale-")) return null;
      staleObservations += 1;
      return staleObservations === 1 ? RUN_IDENTITY : null;
    },
  });
  state.setOperation(operation);
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_current_state_changed_before_record",
  );
  assert.equal(state.calls.includes("rename"), false);
  assert.equal(state.calls.includes("persist:processes_stopped"), false);
  assert.equal(state.calls.includes("persist:renamed"), false);
});

/**
 * processes_stopped再開は実rev4 Storeでも単調にpersistできるを検証する。
 *
 * @responsibility processes_stopped再開は実rev4 Storeでも単調にpersistできるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus processes_stopped再開は実rev4 Storeでも単調にpersistできるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("processes_stopped再開は実rev4 Storeでも単調にpersistできる", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repair-resume-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  const runDirectory = path.join(localAppData, "Docker", "run");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(runDirectory, { recursive: true });
  const metadata = fs.lstatSync(runDirectory, { bigint: true });
  const actualRunIdentity = Object.freeze({
    dev: String(metadata.dev),
    ino: String(metadata.ino),
    birthtimeNs: String(metadata.birthtimeNs),
  });
  const actualBoundary: PreparedBoundary = Object.freeze({
    ...boundary,
    runtimeStateRoot,
    localAppData,
    runDirectory,
    socketPath: path.join(runDirectory, "dockerInference"),
  });
  const baseLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const created = createDockerDesktopRepairOperation(
    actualBoundary,
    actualRunIdentity,
    baseLedger,
  );
  const writeRecord = (
    current: DockerDesktopRepairOperation,
    stage: DockerDesktopRepairOperation["stage"],
    nextLedger: DockerDesktopRepairLedgerSnapshot,
  ) => {
    const lastWrite = nextLedger.filesystemEffects.findLastIndex(
      (entry) => entry.action === "record_write",
    );
    const filesystemEffects = nextLedger.filesystemEffects.map(
      (entry, index) =>
        index === lastWrite && entry.confirmation === "unknown"
          ? Object.freeze({ ...entry, confirmation: "confirmed" as const })
          : entry,
    );
    filesystemEffects.push(
      Object.freeze({
        sequence: filesystemEffects.length,
        action: "record_write" as const,
        phase: "settled" as const,
        issued: true,
        confirmation: "unknown" as const,
      }),
    );
    return persistDockerDesktopRepairStage(
      actualBoundary,
      current,
      stage,
      Object.freeze({
        ...nextLedger,
        evidenceState:
          lastWrite >= 0 ? ("preserved" as const) : nextLedger.evidenceState,
        filesystemEffects: Object.freeze(filesystemEffects),
        filesystemEffectIssued: true,
        filesystemEffectConfirmation: "unknown",
      }),
    );
  };
  const prepared = writeRecord(created, "prepared", baseLedger);
  assert.ok(prepared);
  const addProcessEffect = (
    current: DockerDesktopRepairOperation,
    action: "official_shutdown" | "native_termination" | "wsl_termination",
    isIssued = true,
  ) => {
    const intentEntries = Object.freeze([
      ...current.ledger.processEffects,
      Object.freeze({
        sequence: current.ledger.processEffects.length,
        action,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]);
    const intent = writeRecord(
      current,
      current.stage,
      Object.freeze({
        ...current.ledger,
        processEffects: intentEntries,
        processEffectIssued: current.ledger.processEffectIssued ? true : null,
        processEffectConfirmation: "unknown",
      }),
    );
    assert.ok(intent);
    const settledEntries = Object.freeze(
      intent.ledger.processEffects.map((entry) =>
        entry.action === action
          ? Object.freeze({
              ...entry,
              phase: "settled" as const,
              issued: isIssued,
              confirmation: isIssued
                ? ("confirmed" as const)
                : ("not_issued" as const),
            })
          : entry,
      ),
    );
    const settled = writeRecord(
      intent,
      intent.stage,
      Object.freeze({
        ...intent.ledger,
        processEffects: settledEntries,
        processEffectIssued: true,
        processEffectConfirmation: "confirmed",
      }),
    );
    assert.ok(settled);
    return settled;
  };
  const shutdown = addProcessEffect(prepared, "official_shutdown");
  const nativeAbsent = addProcessEffect(shutdown, "native_termination", false);
  const wsl = addProcessEffect(nativeAbsent, "wsl_termination");
  const stopped = writeRecord(wsl, "processes_stopped", wsl.ledger);
  assert.ok(stopped);
  /**
   * actualIdentityAtのTest準備責務を実行する。
   *
   * @responsibility actualIdentityAtがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus actualIdentityAtを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
   */
  const actualIdentityAt = (target: string) => {
    try {
      const value = fs.lstatSync(target, { bigint: true });
      return Object.freeze({
        dev: String(value.dev),
        ino: String(value.ino),
        birthtimeNs: String(value.birthtimeNs),
      });
    } catch {
      return null;
    }
  };
  const state = fixture({
    prepareBoundary: () => actualBoundary,
    inventory: inventoryDockerDesktopRepairOperations,
    persistStage: persistDockerDesktopRepairStage,
    observeEngine: () => "ready",
    identityAt: actualIdentityAt,
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.processEffectConfirmation, "confirmed");
  const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(inventory.status, "verified");
  assert.equal(
    inventory.operations[0]?.stage,
    "no_stale_known_effect_recovery_pending",
  );
  const replay = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(replay.status, "recovered_pending_close");
  assert.equal(replay.filesystemEffectConfirmation, "confirmed");
  assert.equal(replay.effectStateUnknown, false);
  assert.equal(
    inventoryDockerDesktopRepairOperations({
      ...actualBoundary,
      localUserBindingHash: "d".repeat(64),
    }).status,
    "unknown",
  );
  const closed = await closeWindowsDockerDesktopRepairUsingDependencies(
    replay.repairId,
    state.dependencies,
  );
  assert.equal(closed.status, "closed_retained");
  assert.equal(closed.newRepairPermitted, true);
  const closedInventory =
    inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(closedInventory.status, "verified");
  assert.equal(
    closedInventory.operations[0]?.stage,
    "closed_no_stale_known_effect_retained",
  );
  const nextBoundary = {
    ...actualBoundary,
    localUserBindingHash: "d".repeat(64),
  };
  const nextSession = fixture({
    prepareBoundary: () => nextBoundary,
    inventory: inventoryDockerDesktopRepairOperations,
    persistStage: persistDockerDesktopRepairStage,
    observeEngine: () => "ready",
    identityAt: actualIdentityAt,
  });
  const nextClose = await closeWindowsDockerDesktopRepairUsingDependencies(
    replay.repairId,
    nextSession.dependencies,
  );
  assert.equal(nextClose.status, "closed_retained", JSON.stringify(nextClose));
  assert.equal(nextClose.newRepairPermitted, true);
  const closedOperation = closedInventory.operations[0];
  assert.ok(closedOperation);
  assert.equal(
    persistDockerDesktopRepairStage(
      nextBoundary,
      closedOperation,
      "prepared",
      closedOperation.ledger,
    ),
    null,
  );
  assert.equal(
    nextSession.calls.some((call) =>
      ["shutdown", "terminate", "wsl", "rename", "launch"].includes(call),
    ),
    false,
  );
  assert.deepEqual(
    inventoryDockerDesktopRepairOperations(nextBoundary).operations,
    closedInventory.operations,
  );
});

/**
 * 全5 Host Effectのwriter ack不明とdurable intent crashを実rev4 Storeで分離するを検証する。
 *
 * @responsibility 全5 Host Effectのwriter ack不明とdurable intent crashを実rev4 Storeで分離するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全5 Host Effectのwriter ack不明とdurable intent crashを実rev4 Storeで分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("全5 Host Effectのwriter ack不明とdurable intent crashを実rev4 Storeで分離する", async (t) => {
  const actions = [
    "official_shutdown",
    "native_termination",
    "wsl_termination",
    "runtime_directory_rename",
    "desktop_launch",
  ] as const;
  for (const action of actions) {
    for (const crashPhase of [
      "intent_ack_unknown",
      "host_before_settlement",
      "settlement_ack_unknown",
      "durable_intent_crash",
    ] as const) {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), `crdd-repair-crash-${action}-`),
      );
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const runtimeStateRoot = path.join(root, "RuntimeState");
      const localAppData = path.join(root, "LocalAppData");
      const runDirectory = path.join(localAppData, "Docker", "run");
      fs.mkdirSync(runtimeStateRoot);
      fs.mkdirSync(runDirectory, { recursive: true });
      /**
       * identityAtのTest準備責務を実行する。
       *
       * @responsibility identityAtがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
       * @trace ERB-IT-001
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus identityAtを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
       */
      const identityAt = (target: string) => {
        try {
          const value = fs.lstatSync(target, { bigint: true });
          return Object.freeze({
            dev: String(value.dev),
            ino: String(value.ino),
            birthtimeNs: String(value.birthtimeNs),
          });
        } catch {
          return null;
        }
      };
      const initialIdentity = identityAt(runDirectory);
      assert.ok(initialIdentity);
      const actualBoundary: PreparedBoundary = Object.freeze({
        ...boundary,
        runtimeStateRoot,
        localAppData,
        runDirectory,
        socketPath: path.join(runDirectory, "dockerInference"),
      });
      let isEngineReady = false;
      let processes: "verified" | "absent" = "verified";
      let wasInjected = false;
      const unexpectedPersistFailures: string[] = [];
      const calls = new Map<string, number>();
      /**
       * countのTest準備責務を実行する。
       *
       * @responsibility countがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
       * @trace ERB-IT-001
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus countを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
       */
      const count = (name: string) =>
        calls.set(name, (calls.get(name) ?? 0) + 1);
      const dependencies: RepairDependencies = {
        ...fixture().dependencies,
        prepareBoundary: () => actualBoundary,
        inventory: inventoryDockerDesktopRepairOperations,
        persistStage: (currentBoundary, current, stage, nextLedger) => {
          const entries = [
            ...nextLedger.processEffects,
            ...nextLedger.filesystemEffects,
          ];
          const previousEntries = [
            ...current.ledger.processEffects,
            ...current.ledger.filesystemEffects,
          ];
          const next = entries.find((entry) => entry.action === action);
          const previous = previousEntries.find(
            (entry) => entry.action === action,
          );
          if (
            !wasInjected &&
            crashPhase === "host_before_settlement" &&
            next?.phase === "settled" &&
            previous?.phase === "intent_recorded"
          ) {
            wasInjected = true;
            return null;
          }
          const persisted = persistDockerDesktopRepairStage(
            currentBoundary,
            current,
            stage,
            nextLedger,
          );
          if (!persisted)
            unexpectedPersistFailures.push(
              `${current.stage}->${stage}:prev=${current.ledger.filesystemEffects.map((entry) => `${entry.action}/${entry.phase}`).join(",")}:next=${nextLedger.processEffects.map((entry) => `${entry.action}/${entry.phase}`).join(",")}:${nextLedger.filesystemEffects.map((entry) => `${entry.action}/${entry.phase}`).join(",")}`,
            );
          const targetPhase =
            crashPhase === "intent_ack_unknown" ||
            crashPhase === "durable_intent_crash"
              ? "intent_recorded"
              : crashPhase === "settlement_ack_unknown"
                ? "settled"
                : null;
          if (
            persisted &&
            !wasInjected &&
            crashPhase !== "host_before_settlement" &&
            next?.phase === targetPhase &&
            previous?.phase !== targetPhase
          ) {
            wasInjected = true;
            if (crashPhase === "durable_intent_crash")
              throw new Error("synthetic process loss after durable intent");
            return null;
          }
          return persisted;
        },
        observeEngine: () => (isEngineReady ? "ready" : "known_unavailable"),
        observeKnownSocketFailure: () => initialIdentity,
        identityAt,
        observePath: (target) => {
          const identity = identityAt(target);
          return identity
            ? Object.freeze({ state: "present" as const, identity })
            : Object.freeze({
                state: "confirmed_absent" as const,
                identity: null,
              });
        },
        acquireHelper: async () => ({
          status: "acquired" as const,
          session: Object.freeze({
            ...session(),
            inspectProcesses: async () => processes,
            terminateProcesses: async () => {
              count("native_termination");
              processes = "absent";
              return "terminated" as const;
            },
            launchDesktop: async () => {
              count("desktop_launch");
              fs.mkdirSync(runDirectory);
              processes = "verified";
              isEngineReady = true;
              return "started" as const;
            },
          }),
        }),
        officialShutdown: () => {
          count("official_shutdown");
          return Object.freeze({
            issued: true,
            confirmation: "confirmed" as const,
          });
        },
        terminateDockerWsl: () => {
          count("wsl_termination");
          return Object.freeze({
            issued: true,
            confirmation: "confirmed" as const,
          });
        },
        renameRunDirectory: (_currentBoundary, operation) => {
          count("runtime_directory_rename");
          fs.renameSync(runDirectory, operation.staleDirectory);
          return Object.freeze({
            issued: true,
            confirmation: "confirmed" as const,
            staleState: "retained" as const,
          });
        },
        awaitEngine: async () =>
          isEngineReady ? "ready" : "known_unavailable",
      };
      const first =
        await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
      assert.equal(wasInjected, true, `${action}/${crashPhase}`);
      const second =
        await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
      const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
      assert.equal(inventory.status, "verified", `${action}/${crashPhase}`);
      if (crashPhase === "durable_intent_crash") {
        assert.equal(first.status, "blocked", `${action}/${crashPhase}`);
        assert.equal(calls.get(action) ?? 0, 0, action);
        assert.equal(second.status, "blocked", action);
        assert.equal(calls.get(action) ?? 0, 0, action);
        const durableOperation = inventory.operations[0];
        assert.ok(durableOperation);
        assert.equal(
          [
            ...durableOperation.ledger.processEffects,
            ...durableOperation.ledger.filesystemEffects,
          ].find((entry) => entry.action === action)?.phase,
          "intent_recorded",
          action,
        );
      } else if (
        crashPhase === "host_before_settlement" &&
        action !== "runtime_directory_rename"
      ) {
        assert.equal(first.status, "blocked", `${action}/${crashPhase}`);
        assert.equal(calls.get(action), 1, action);
        assert.equal(second.status, "blocked", action);
      } else {
        if (crashPhase === "host_before_settlement")
          assert.equal(first.status, "blocked", `${action}/${crashPhase}`);
        else
          assert.equal(
            first.status,
            "recovered_pending_close",
            `${action}/${crashPhase}`,
          );
        assert.equal(calls.get(action), 1, action);
        assert.equal(
          second.status,
          "recovered_pending_close",
          `${action}: ${JSON.stringify(second)} persist=${JSON.stringify(unexpectedPersistFailures)}`,
        );
        assert.deepEqual(unexpectedPersistFailures, [], action);
      }
      for (const countValue of calls.values()) assert.ok(countValue <= 1);
    }
  }
});

/**
 * official shutdown未確認のactual Store再開は全後続Host Effectを0にするを検証する。
 *
 * @responsibility official shutdown未確認のactual Store再開は全後続Host Effectを0にするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus official shutdown未確認のactual Store再開は全後続Host Effectを0にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("official shutdown未確認のactual Store再開は全後続Host Effectを0にする", async (t) => {
  for (const observed of [
    Object.freeze({ issued: true, confirmation: "unknown" as const }),
    Object.freeze({ issued: false, confirmation: "not_issued" as const }),
  ]) {
    await t.test(
      `${String(observed.issued)}/${observed.confirmation}`,
      async (caseContext) => {
        const root = fs.mkdtempSync(
          path.join(os.tmpdir(), "crdd-repair-shutdown-replay-"),
        );
        caseContext.after(() =>
          fs.rmSync(root, { recursive: true, force: true }),
        );
        const runtimeStateRoot = path.join(root, "RuntimeState");
        const localAppData = path.join(root, "LocalAppData");
        const runDirectory = path.join(localAppData, "Docker", "run");
        fs.mkdirSync(runtimeStateRoot);
        fs.mkdirSync(runDirectory, { recursive: true });
        const metadata = fs.lstatSync(runDirectory, { bigint: true });
        const actualIdentity = Object.freeze({
          dev: String(metadata.dev),
          ino: String(metadata.ino),
          birthtimeNs: String(metadata.birthtimeNs),
        });
        const actualBoundary: PreparedBoundary = Object.freeze({
          ...boundary,
          runtimeStateRoot,
          localAppData,
          runDirectory,
          socketPath: path.join(runDirectory, "dockerInference"),
        });
        const baseLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
          processEffects: Object.freeze([]),
          processEffectIssued: false,
          processEffectConfirmation: "not_issued",
          filesystemEffects: Object.freeze([]),
          filesystemEffectIssued: false,
          filesystemEffectConfirmation: "not_issued",
          engineReady: false,
          staleState: "absent",
          hostSafety: "safe",
          evidenceState: "not_preserved",
          disposition: "not_applicable",
          liveRunIdentity: null,
        });
        const created = createDockerDesktopRepairOperation(
          actualBoundary,
          actualIdentity,
          baseLedger,
        );
        const prepared = persistActualRepairRecord(
          actualBoundary,
          created,
          "prepared",
          baseLedger,
        );
        assert.ok(prepared);
        persistActualProcessEffect(
          actualBoundary,
          prepared,
          "official_shutdown",
          observed,
        );
        let hostCalls = 0;
        const dependencies: RepairDependencies = {
          ...fixture().dependencies,
          prepareBoundary: () => actualBoundary,
          inventory: inventoryDockerDesktopRepairOperations,
          persistStage: persistDockerDesktopRepairStage,
          observeEngine: () => "known_unavailable",
          observeKnownSocketFailure: () => actualIdentity,
          observePath: (target) =>
            target === runDirectory
              ? Object.freeze({
                  state: "present" as const,
                  identity: actualIdentity,
                })
              : Object.freeze({
                  state: "confirmed_absent" as const,
                  identity: null,
                }),
          officialShutdown: () => {
            hostCalls += 1;
            return Object.freeze({ issued: true, confirmation: "confirmed" });
          },
          terminateDockerWsl: () => {
            hostCalls += 1;
            return Object.freeze({ issued: true, confirmation: "confirmed" });
          },
          renameRunDirectory: () => {
            hostCalls += 1;
            return Object.freeze({
              issued: true,
              confirmation: "confirmed",
              staleState: "retained",
            });
          },
        };
        const result =
          await repairWindowsDockerDesktopRuntimeUsingDependencies(
            dependencies,
          );
        assert.equal(result.status, "blocked");
        assert.equal(
          result.reason,
          observed.confirmation === "unknown"
            ? "docker_desktop_repair_settled_prefix_invalid"
            : "docker_desktop_repair_pre_effect_state_unknown",
        );
        assert.equal(hostCalls, 0);
      },
    );
  }
});

/**
 * 実rev4 StoreのK/Aはshutdown・native Host call 0で保存失敗後も再観測してWSLへ進むを検証する。
 *
 * @responsibility 実rev4 StoreのK/Aはshutdown・native Host call 0で保存失敗後も再観測してWSLへ進むの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実rev4 StoreのK/Aはshutdown・native Host call 0で保存失敗後も再観測してWSLへ進むの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("実rev4 StoreのK/Aはshutdown・native Host call 0で保存失敗後も再観測してWSLへ進む", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repair-ka-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  const runDirectory = path.join(localAppData, "Docker", "run");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(runDirectory, { recursive: true });
  /**
   * identityAtのTest準備責務を実行する。
   *
   * @responsibility identityAtがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus identityAtを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
   */
  const identityAt = (target: string) => {
    try {
      const value = fs.lstatSync(target, { bigint: true });
      return Object.freeze({
        dev: String(value.dev),
        ino: String(value.ino),
        birthtimeNs: String(value.birthtimeNs),
      });
    } catch {
      return null;
    }
  };
  const initialIdentity = identityAt(runDirectory);
  assert.ok(initialIdentity);
  const actualBoundary: PreparedBoundary = Object.freeze({
    ...boundary,
    runtimeStateRoot,
    localAppData,
    runDirectory,
    socketPath: path.join(runDirectory, "dockerInference"),
  });
  let isEngineReady = false;
  let wasLaunched = false;
  let shouldFailNativeObservationOnce = true;
  let shutdownCalls = 0;
  let nativeCalls = 0;
  let wslCalls = 0;
  const dependencies: RepairDependencies = {
    ...fixture().dependencies,
    prepareBoundary: () => actualBoundary,
    inventory: inventoryDockerDesktopRepairOperations,
    persistStage: (currentBoundary, current, stage, nextLedger) => {
      const previousNative = current.ledger.processEffects.find(
        (entry) => entry.action === "native_termination",
      );
      const nextNative = nextLedger.processEffects.find(
        (entry) => entry.action === "native_termination",
      );
      if (
        shouldFailNativeObservationOnce &&
        !previousNative &&
        nextNative?.phase === "settled" &&
        nextNative.issued === false
      ) {
        shouldFailNativeObservationOnce = false;
        return null;
      }
      return persistDockerDesktopRepairStage(
        currentBoundary,
        current,
        stage,
        nextLedger,
      );
    },
    observeEngine: () => (isEngineReady ? "ready" : "known_unavailable"),
    observeKnownSocketFailure: () => initialIdentity,
    identityAt,
    observePath: (target) => {
      const value = identityAt(target);
      return value
        ? Object.freeze({ state: "present" as const, identity: value })
        : Object.freeze({
            state: "confirmed_absent" as const,
            identity: null,
          });
    },
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session({ processes: "absent" }),
        inspectProcesses: async () =>
          wasLaunched ? ("verified" as const) : ("absent" as const),
        terminateProcesses: async () => {
          nativeCalls += 1;
          return "absent" as const;
        },
        launchDesktop: async () => {
          fs.mkdirSync(runDirectory);
          wasLaunched = true;
          isEngineReady = true;
          return "started" as const;
        },
      }),
    }),
    officialShutdown: () => {
      shutdownCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    terminateDockerWsl: () => {
      wslCalls += 1;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
    renameRunDirectory: (_currentBoundary, operation) => {
      fs.renameSync(runDirectory, operation.staleDirectory);
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
        staleState: "retained" as const,
      });
    },
    awaitEngine: async () => (isEngineReady ? "ready" : "known_unavailable"),
  };
  const first =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
  assert.equal(first.status, "blocked", JSON.stringify(first));
  assert.equal(first.reason, "docker_desktop_repair_record_durability_unknown");
  const result =
    await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  assert.equal(shutdownCalls, 0);
  assert.equal(nativeCalls, 0);
  assert.equal(wslCalls, 1);
  const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(inventory.status, "verified");
  const native = inventory.operations[0]?.ledger.processEffects.find(
    (entry) => entry.action === "native_termination",
  );
  assert.deepEqual(native, {
    sequence: 1,
    action: "native_termination",
    phase: "settled",
    issued: false,
    confirmation: "not_issued",
  });
  const shutdown = inventory.operations[0]?.ledger.processEffects.find(
    (entry) => entry.action === "official_shutdown",
  );
  assert.deepEqual(shutdown, {
    sequence: 0,
    action: "official_shutdown",
    phase: "settled",
    issued: false,
    confirmation: "not_issued",
  });
});

/**
 * preparedからの自然復旧は実rev4 Storeへ観測Recordとstage Recordを分離するを検証する。
 *
 * @responsibility preparedからの自然復旧は実rev4 Storeへ観測Recordとstage Recordを分離するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus preparedからの自然復旧は実rev4 Storeへ観測Recordとstage Recordを分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("preparedからの自然復旧は実rev4 Storeへ観測Recordとstage Recordを分離する", async (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-repair-natural-recovery-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  const runDirectory = path.join(localAppData, "Docker", "run");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(runDirectory, { recursive: true });
  /**
   * identityAtのTest準備責務を実行する。
   *
   * @responsibility identityAtがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus identityAtを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
   */
  const identityAt = (target: string) => {
    try {
      const value = fs.lstatSync(target, { bigint: true });
      return Object.freeze({
        dev: String(value.dev),
        ino: String(value.ino),
        birthtimeNs: String(value.birthtimeNs),
      });
    } catch {
      return null;
    }
  };
  const actualRunIdentity = identityAt(runDirectory);
  assert.ok(actualRunIdentity);
  const actualBoundary: PreparedBoundary = Object.freeze({
    ...boundary,
    runtimeStateRoot,
    localAppData,
    runDirectory,
    socketPath: path.join(runDirectory, "dockerInference"),
  });
  const baseLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: false,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  });
  const created = createDockerDesktopRepairOperation(
    actualBoundary,
    actualRunIdentity,
    baseLedger,
  );
  const preparedLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    ...baseLedger,
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write" as const,
        phase: "settled" as const,
        issued: true,
        confirmation: "unknown" as const,
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "unknown",
  });
  const prepared = persistDockerDesktopRepairStage(
    actualBoundary,
    created,
    "prepared",
    preparedLedger,
  );
  assert.ok(prepared);
  const state = fixture({
    prepareBoundary: () => actualBoundary,
    inventory: inventoryDockerDesktopRepairOperations,
    persistStage: persistDockerDesktopRepairStage,
    observeEngine: () => "ready",
    identityAt,
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(
    result.status,
    "recovered_pending_close",
    JSON.stringify(result),
  );
  const inventory = inventoryDockerDesktopRepairOperations(actualBoundary);
  assert.equal(inventory.status, "verified");
  const recovered = inventory.operations[0];
  assert.equal(recovered?.stage, "no_stale_historical_effect_unknown_pending");
  assert.equal(recovered?.sequence, 2);
  assert.equal(
    recovered?.ledger.processEffects[0]?.action,
    "historical_process_reconciliation",
  );
  assert.equal(recovered?.ledger.processEffects[0]?.issued, null);
  assert.equal(recovered?.ledger.processEffects[0]?.confirmation, "unknown");
  assert.equal(recovered?.ledger.engineReady, true);
  assert.equal(recovered?.ledger.staleState, "absent");
  assert.equal(recovered?.ledger.evidenceState, "preserved");
});

/**
 * 過去Effect不明かつstaleなしは専用close後も履歴不明を保持するを検証する。
 *
 * @responsibility 過去Effect不明かつstaleなしは専用close後も履歴不明を保持するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 過去Effect不明かつstaleなしは専用close後も履歴不明を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("過去Effect不明かつstaleなしは専用close後も履歴不明を保持する", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "historical_process_reconciliation",
        phase: "settled",
        issued: null,
        confirmation: "unknown",
      }),
    ]),
    processEffectIssued: null,
    processEffectConfirmation: "unknown",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: true,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "historical_effect_unknown_pending_human_decision",
    liveRunIdentity: RUN_IDENTITY,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "c".repeat(32),
    repairId: `docker-desktop-repair.${"c".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-c",
    staleName: `run.crdd-stale-${"c".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"c".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "no_stale_historical_effect_unknown_pending",
    sequence: 1,
    previousRecordSha256: "7".repeat(64),
    ledger,
  });
  const state = fixture();
  state.setOperation(operation);
  const result = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    state.dependencies,
  );
  assert.equal(
    result.status,
    "closed_historical_effect_unknown_retained",
    JSON.stringify(result),
  );
  assert.equal(result.processEffectIssued, null);
  assert.equal(
    result.disposition,
    "historical_effect_unknown_retained_by_human_decision",
  );
  assert.equal(result.newRepairPermitted, true);
});

/**
 * 非同期境界中の取消後はsettlement Evidence以外の新Host Effectを発行しないを検証する。
 *
 * @responsibility 非同期境界中の取消後はsettlement Evidence以外の新Host Effectを発行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非同期境界中の取消後はsettlement Evidence以外の新Host Effectを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("非同期境界中の取消後はsettlement Evidence以外の新Host Effectを発行しない", async () => {
  let cancel: () => void = () => undefined;
  let terminationCalls = 0;
  let inspectionCalls = 0;
  const cancellingSession = Object.freeze({
    ...session(),
    inspectProcesses: async () => {
      inspectionCalls += 1;
      cancel();
      return await new Promise<"verified">(() => undefined);
    },
    terminateProcesses: async () => {
      terminationCalls += 1;
      return "terminated" as const;
    },
  });
  const state = fixture({
    registerCancellation: (listener) => {
      cancel = listener;
      return () => undefined;
    },
    acquireHelper: async () =>
      Object.freeze({
        status: "acquired" as const,
        session: cancellingSession,
      }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_cancelled_after_process_effect",
  );
  assert.equal(inspectionCalls, 1);
  assert.equal(terminationCalls, 0);
  assert.equal(state.calls.includes("wsl"), false);
  assert.deepEqual(
    state.calls.filter((call) => call.startsWith("persist:")),
    ["persist:prepared", "persist:prepared", "persist:prepared"],
  );
});

/**
 * helper喪失をawait中に検出した後はprocess terminationへ進まないを検証する。
 *
 * @responsibility helper喪失をawait中に検出した後はprocess terminationへ進まないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus helper喪失をawait中に検出した後はprocess terminationへ進まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("helper喪失をawait中に検出した後はprocess terminationへ進まない", async () => {
  let helperFailure: () => void = () => undefined;
  let terminationCalls = 0;
  const losingSession = Object.freeze({
    ...session(),
    onFailureDetected: (listener: () => void) => {
      helperFailure = listener;
      return () => undefined;
    },
    inspectProcesses: async () => {
      helperFailure();
      return await new Promise<"verified">(() => undefined);
    },
    terminateProcesses: async () => {
      terminationCalls += 1;
      return "terminated" as const;
    },
  });
  const state = fixture({
    acquireHelper: async () =>
      Object.freeze({ status: "acquired" as const, session: losingSession }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_desktop_repair_native_helper_lost");
  assert.equal(terminationCalls, 0);
  assert.equal(state.calls.includes("wsl"), false);
});

/**
 * cleanup settlementはpackage再計算後のhelper喪失をRecord Effect 0へ閉じるを検証する。
 *
 * @responsibility cleanup settlementはpackage再計算後のhelper喪失をRecord Effect 0へ閉じるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup settlementはpackage再計算後のhelper喪失をRecord Effect 0へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("cleanup settlementはpackage再計算後のhelper喪失をRecord Effect 0へ閉じる", async () => {
  let isLive = true;
  let hostEffectIssued = false;
  const state = fixture({
    prepareBoundary: () => {
      if (hostEffectIssued) isLive = false;
      return boundary;
    },
    acquireHelper: async () => ({
      status: "acquired" as const,
      session: Object.freeze({
        ...session(),
        assertLive: () => isLive,
      }),
    }),
    officialShutdown: () => {
      hostEffectIssued = true;
      return Object.freeze({
        issued: true,
        confirmation: "confirmed" as const,
      });
    },
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_desktop_repair_native_helper_lost");
  assert.deepEqual(
    state.calls.filter((entry) => entry.startsWith("persist:")),
    ["persist:prepared", "persist:prepared"],
  );
  assert.equal(state.calls.includes("wsl"), false);
  assert.equal(state.calls.includes("rename"), false);
  assert.equal(state.calls.includes("start"), false);
});

/**
 * package tupleがawait中に変化した場合は直後Effectを発行しないを検証する。
 *
 * @responsibility package tupleがawait中に変化した場合は直後Effectを発行しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus package tupleがawait中に変化した場合は直後Effectを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("package tupleがawait中に変化した場合は直後Effectを発行しない", async () => {
  let isPackageChanged = false;
  let verificationCalls = 0;
  const changingSession = Object.freeze({
    ...session(),
    verifyArtifacts: async () => {
      verificationCalls += 1;
      if (verificationCalls >= 3) isPackageChanged = true;
      return "verified" as const;
    },
  });
  const changedBoundary = Object.freeze({
    ...boundary,
    crddManifestHash: "a".repeat(64),
  });
  const state = fixture({
    prepareBoundary: () => (isPackageChanged ? changedBoundary : boundary),
    acquireHelper: async () =>
      Object.freeze({ status: "acquired" as const, session: changingSession }),
  });
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    state.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(state.calls.includes("shutdown"), false);
});

/**
 * 後続Process Effect不明を以前のconfirmedで隠さないを検証する。
 *
 * @responsibility 後続Process Effect不明を以前のconfirmedで隠さないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 後続Process Effect不明を以前のconfirmedで隠さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("後続Process Effect不明を以前のconfirmedで隠さない", async () => {
  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      officialShutdown: () =>
        Object.freeze({ issued: true, confirmation: "unknown" as const }),
    }).dependencies,
  );
  assert.equal(result.status, "blocked", JSON.stringify(result));
  assert.equal(result.reason, "docker_desktop_official_shutdown_unconfirmed");
  assert.equal(result.processEffectIssued, true);
  assert.equal(result.processEffectConfirmation, "unknown");
  assert.equal(result.effectStateUnknown, true);
});

/**
 * WSL未確認とEngine再起動失敗は成功へ昇格しないを検証する。
 *
 * @responsibility WSL未確認とEngine再起動失敗は成功へ昇格しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus WSL未確認とEngine再起動失敗は成功へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("WSL未確認とEngine再起動失敗は成功へ昇格しない", async () => {
  const wsl = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({
      terminateDockerWsl: () =>
        Object.freeze({ issued: true, confirmation: "unknown" as const }),
    }).dependencies,
  );
  assert.equal(wsl.status, "blocked");
  assert.equal(wsl.reason, "docker_desktop_wsl_termination_unconfirmed");
  assert.equal(wsl.processEffectConfirmation, "unknown");

  const engine = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    fixture({ awaitEngine: async () => "known_unavailable" as const })
      .dependencies,
  );
  assert.equal(engine.status, "blocked");
  assert.equal(engine.reason, "docker_desktop_engine_restart_unconfirmed");
  assert.equal(engine.manualRecoveryRequired, true);
});

/**
 * 現行署名版が新規作成した修復も失敗起動Continuationへ接続することを検証する。
 *
 * @responsibility 履歴採用の有無で複数Runtime領域の段階処置入口が分岐しないことを保証する。
 * @trace ERB-IT-001
 * @precondition 現行署名版が作成した非履歴Operationはrenamed段階で初回Desktop起動Effectを確定済みである。
 * @stimulus 同じRepair IDへ再入場する。
 * @observation 結果理由と追加Host Effectを観測する。
 * @oracle 通常の単一領域再開へ戻らず、失敗起動Continuationの事前条件判定へ到達する。
 * @cleanup N/A: Test Fixtureは実Host資源を変更しない。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("現行署名版が新規作成した修復も失敗起動Continuationへ接続する", async () => {
  const setup = fixture({
    observeRuntimeDirectoryLock: () => null,
    renameRuntimeDirectory: () =>
      Object.freeze({
        issued: false,
        confirmation: "not_issued" as const,
        staleState: "unknown" as const,
      }),
  });
  setup.setOperation(
    operationFixture("renamed", {
      processEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "desktop_launch" as const,
          phase: "settled" as const,
          issued: true,
          confirmation: "confirmed" as const,
        }),
      ]),
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
    }),
  );

  const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
    setup.dependencies,
  );

  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "docker_desktop_repair_continuation_precondition_unconfirmed",
  );
  assert.equal(result.repairId, `docker-desktop-repair.${"f".repeat(32)}`);
  assert.equal(setup.calls.includes("start"), false);
  assert.equal(setup.calls.includes("rename"), false);
});

/**
 * 現行署名版が新規作成した修復を複数Runtime領域の段階処置で完了することを検証する。
 *
 * @responsibility 現行の非履歴Operationが同じRepair IDのContinuationを作成し、二領域の退避とDesktop再起動を完了できることを保証する。
 * @trace ERB-IT-001
 * @precondition 現行署名版が作成したOperationはrenamed段階であり、初回Desktop起動Effect、失敗起動世代およびSecrets Engineを確認済みである。
 * @stimulus 同じRepair IDへ再入場し、複数Runtime領域のContinuationを実行する。
 * @observation Repair ID、Continuation Effect、退避先、Desktop起動回数、Engine状態および最終状態を観測する。
 * @oracle 二つのrenameと一つのrelaunchが順序付きで各一回だけconfirmedになり、recovered_pending_closeへ到達する。
 * @cleanup Test専用一時Rootをfinallyで削除する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("現行署名版が新規作成した修復を複数Runtime領域の段階処置で完了する", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-current-docker-regions-"),
  );
  try {
    const localAppData = path.join(root, "local");
    const runtimeStateRoot = path.join(root, "runtime-state");
    const runDirectory = path.join(localAppData, "Docker", "run");
    const secretsDirectory = path.join(localAppData, "docker-secrets-engine");
    const operationId = "c".repeat(32);
    const operationDirectory = path.join(
      runtimeStateRoot,
      `docker-desktop-repair-${operationId}`,
    );
    const staleDirectory = path.join(
      localAppData,
      "Docker",
      `run.crdd-stale-${operationId}`,
    );
    fs.mkdirSync(operationDirectory, { recursive: true });
    fs.mkdirSync(staleDirectory, { recursive: true });
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.mkdirSync(secretsDirectory, { recursive: true });
    fs.writeFileSync(path.join(staleDirectory, "dockerInference"), "origin");
    fs.writeFileSync(path.join(runDirectory, "sailor-ingest.sock"), "failed");
    fs.writeFileSync(path.join(secretsDirectory, "engine.sock"), "failed");

    /**
     * identityAtのTest準備責務を実行する。
     *
     * @responsibility 現行OperationのRuntime領域Identityを実Filesystemから決定論的に観測する。
     * @trace ERB-IT-001
     * @precondition 対象はTest専用一時Root内にある。
     * @stimulus 対象Pathのmetadataを観測する。
     * @observation Directory Identityまたは不存在を返す。
     * @oracle 実在する通常DirectoryだけがIdentityを持つ。
     * @cleanup 呼出し元Test Caseが一時Rootを削除する。
     * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
     */
    const identityAt = (target: string) => {
      try {
        const metadata = fs.lstatSync(target, { bigint: true });
        return metadata.isDirectory() &&
          !metadata.isSymbolicLink() &&
          metadata.dev > 0n &&
          metadata.ino > 0n &&
          metadata.birthtimeNs > 0n
          ? Object.freeze({
              dev: String(metadata.dev),
              ino: String(metadata.ino),
              birthtimeNs: String(metadata.birthtimeNs),
            })
          : null;
      } catch {
        return null;
      }
    };
    const originIdentity = identityAt(staleDirectory);
    assert.ok(originIdentity);
    const currentBoundary: PreparedBoundary = Object.freeze({
      ...boundary,
      runtimeStateRoot,
      localAppData,
      runDirectory,
      socketPath: path.join(runDirectory, "dockerInference"),
    });
    const operation: DockerDesktopRepairOperation = Object.freeze({
      operationId,
      repairId: `docker-desktop-repair.${operationId}`,
      originLocalUserBindingHash: currentBoundary.localUserBindingHash,
      operationDirectory,
      staleName: path.basename(staleDirectory),
      staleDirectory,
      runIdentity: originIdentity,
      stage: "renamed",
      sequence: 2,
      previousRecordSha256: "8".repeat(64),
      ledger: Object.freeze({
        processEffects: Object.freeze([
          Object.freeze({
            sequence: 0,
            action: "desktop_launch" as const,
            phase: "settled" as const,
            issued: true,
            confirmation: "confirmed" as const,
          }),
        ]),
        processEffectIssued: true,
        processEffectConfirmation: "confirmed" as const,
        filesystemEffects: Object.freeze([]),
        filesystemEffectIssued: false,
        filesystemEffectConfirmation: "not_issued" as const,
        engineReady: false,
        staleState: "retained" as const,
        hostSafety: "manual_recovery_required" as const,
        evidenceState: "preserved" as const,
        disposition: "not_applicable" as const,
        liveRunIdentity: null,
      }),
    });
    let latestOperation = operation;
    let wasRelaunched = false;
    let launches = 0;
    const renameCalls: string[] = [];
    const repairSession = Object.freeze({
      ...session(),
      inspectProcesses: async () =>
        wasRelaunched ? ("verified" as const) : ("absent" as const),
      launchDesktop: async () => {
        launches += 1;
        wasRelaunched = true;
        fs.mkdirSync(runDirectory);
        fs.writeFileSync(path.join(runDirectory, "dockerInference"), "new");
        fs.mkdirSync(secretsDirectory);
        fs.writeFileSync(path.join(secretsDirectory, "engine.sock"), "new");
        return "started" as const;
      },
    });
    const setup = fixture({
      prepareBoundary: () => currentBoundary,
      acquireHelper: async () =>
        Object.freeze({ status: "acquired" as const, session: repairSession }),
      observeEngine: () =>
        wasRelaunched ? ("ready" as const) : ("known_unavailable" as const),
      observeKnownSocketFailure: () => null,
      observeRuntimeDirectoryLock: identityAt,
      renameRuntimeDirectory: (source, target, expected) => {
        assert.deepEqual(identityAt(source), expected);
        renameCalls.push(source);
        fs.renameSync(source, target);
        return Object.freeze({
          issued: true,
          confirmation: "confirmed" as const,
          staleState: "retained" as const,
        });
      },
      awaitEngine: async () => "ready" as const,
      identityAt,
      persistStage: (_boundary, current, stage, ledger) => {
        latestOperation = Object.freeze({
          ...current,
          stage,
          sequence: current.sequence + 1,
          previousRecordSha256: String(current.sequence + 1).padStart(64, "0"),
          ledger: Object.freeze({ ...ledger }),
        });
        return latestOperation;
      },
    });
    setup.setOperation(operation);

    const result = await repairWindowsDockerDesktopRuntimeUsingDependencies(
      setup.dependencies,
    );

    assert.equal(
      result.status,
      "recovered_pending_close",
      JSON.stringify(result),
    );
    assert.equal(
      result.reason,
      "docker_desktop_repair_continuation_recovered_pending_close",
    );
    assert.equal(result.repairId, operation.repairId);
    assert.equal(launches, 1);
    assert.deepEqual(renameCalls, [runDirectory, secretsDirectory]);
    const continuation = inspectDockerDesktopRepairContinuation(
      currentBoundary,
      latestOperation,
    );
    assert.equal(continuation.status, "valid");
    assert.equal(continuation.continuation?.repairId, operation.repairId);
    assert.equal(continuation.continuation?.stage, "recovered");
    assert.deepEqual(
      Object.values(continuation.continuation?.effects ?? {}).map((effect) =>
        effect
          ? Object.freeze({
              phase: effect.phase,
              issued: effect.issued,
              confirmation: effect.confirmation,
            })
          : null,
      ),
      [
        Object.freeze({
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
        Object.freeze({
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
        Object.freeze({
          phase: "settled",
          issued: true,
          confirmation: "confirmed",
        }),
      ],
    );
    assert.equal(
      fs.existsSync(
        path.join(
          localAppData,
          "Docker",
          `run.crdd-stale-${operationId}-restart`,
        ),
      ),
      true,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          localAppData,
          `docker-secrets-engine.crdd-stale-${operationId}`,
        ),
      ),
      true,
    );
    assert.equal(fs.existsSync(runDirectory), true);
    assert.equal(fs.existsSync(secretsDirectory), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 署名版更新後も同じ復旧IDで失敗起動世代とSecrets Engineを段階退避して回復するを検証する。
 *
 * @responsibility 署名版更新後も同じ復旧IDで失敗起動世代とSecrets Engineを段階退避して回復するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名版更新後も同じ復旧IDで失敗起動世代とSecrets Engineを段階退避して回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("署名版更新後も同じ復旧IDで失敗起動世代とSecrets Engineを段階退避して回復する", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-docker-regions-"));
  try {
    const localAppData = path.join(root, "local");
    const runtimeStateRoot = path.join(root, "runtime-state");
    const runDirectory = path.join(localAppData, "Docker", "run");
    const secretsDirectory = path.join(localAppData, "docker-secrets-engine");
    fs.mkdirSync(runtimeStateRoot, { recursive: true });
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, "dockerInference"), "old");
    /**
     * directoryIdentityのTest準備責務を実行する。
     *
     * @responsibility directoryIdentityがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
     * @trace ERB-IT-001
     * @precondition 呼出し元Test Caseが必要な入力を渡す。
     * @stimulus directoryIdentityを呼び出す。
     * @observation 返却値、生成fixtureまたは観測値を取得する。
     * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
     * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
     */
    const directoryIdentity = (target: string) => {
      try {
        const metadata = fs.lstatSync(target, { bigint: true });
        return metadata.isDirectory() &&
          !metadata.isSymbolicLink() &&
          metadata.dev > 0n &&
          metadata.ino > 0n &&
          metadata.birthtimeNs > 0n
          ? Object.freeze({
              dev: String(metadata.dev),
              ino: String(metadata.ino),
              birthtimeNs: String(metadata.birthtimeNs),
            })
          : null;
      } catch {
        return null;
      }
    };
    const originalIdentity = directoryIdentity(runDirectory);
    assert.ok(originalIdentity);
    const originBoundary: PreparedBoundary = Object.freeze({
      ...boundary,
      runtimeStateRoot,
      localAppData,
      runDirectory,
      socketPath: path.join(runDirectory, "dockerInference"),
      crddManifestHash: "1".repeat(64),
      crddReleaseSequence: 1,
      runtimeExecutionIdentitySha256: "2".repeat(64),
    });
    const currentBoundary: PreparedBoundary = Object.freeze({
      ...originBoundary,
      crddManifestHash: "3".repeat(64),
      crddReleaseSequence: 2,
      runtimeExecutionIdentitySha256: "4".repeat(64),
    });
    const baseLedger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
      processEffects: Object.freeze([]),
      processEffectIssued: false,
      processEffectConfirmation: "not_issued",
      filesystemEffects: Object.freeze([]),
      filesystemEffectIssued: false,
      filesystemEffectConfirmation: "not_issued",
      engineReady: false,
      staleState: "absent",
      hostSafety: "safe",
      evidenceState: "not_preserved",
      disposition: "not_applicable",
      liveRunIdentity: null,
    });
    const created = createDockerDesktopRepairOperation(
      originBoundary,
      originalIdentity,
      baseLedger,
    );
    let stored = persistActualRepairRecord(
      originBoundary,
      created,
      "prepared",
      baseLedger,
    );
    assert.ok(stored);
    stored = persistActualProcessEffect(
      originBoundary,
      stored,
      "official_shutdown",
      {
        issued: false,
        confirmation: "not_issued",
      },
    );
    stored = persistActualProcessEffect(
      originBoundary,
      stored,
      "native_termination",
      {
        issued: false,
        confirmation: "not_issued",
      },
    );
    stored = persistActualProcessEffect(
      originBoundary,
      stored,
      "wsl_termination",
      {
        issued: true,
        confirmation: "confirmed",
      },
    );
    stored = persistActualRepairRecord(
      originBoundary,
      stored,
      "processes_stopped",
      stored.ledger,
    );
    assert.ok(stored);
    const renameIntent = persistActualRepairRecord(
      originBoundary,
      stored,
      stored.stage,
      Object.freeze({
        ...stored.ledger,
        filesystemEffects: Object.freeze([
          ...stored.ledger.filesystemEffects,
          Object.freeze({
            sequence: stored.ledger.filesystemEffects.length,
            action: "runtime_directory_rename" as const,
            phase: "intent_recorded" as const,
            issued: null,
            confirmation: "unknown" as const,
          }),
        ]),
        filesystemEffectIssued: null,
        filesystemEffectConfirmation: "unknown" as const,
      }),
    );
    assert.ok(renameIntent);
    fs.renameSync(runDirectory, stored.staleDirectory);
    const renameEffects = renameIntent.ledger.filesystemEffects.map((entry) =>
      entry.action === "runtime_directory_rename"
        ? Object.freeze({
            ...entry,
            phase: "settled" as const,
            issued: true,
            confirmation: "confirmed" as const,
          })
        : entry,
    );
    stored = persistActualRepairRecord(
      originBoundary,
      renameIntent,
      renameIntent.stage,
      Object.freeze({
        ...renameIntent.ledger,
        filesystemEffects: Object.freeze(renameEffects),
        filesystemEffectIssued: true,
        filesystemEffectConfirmation: "confirmed" as const,
      }),
    );
    assert.ok(stored);
    stored = persistActualRepairRecord(
      originBoundary,
      stored,
      "renamed",
      Object.freeze({ ...stored.ledger, staleState: "retained" as const }),
    );
    assert.ok(stored);
    const launchIntent = persistActualRepairRecord(
      originBoundary,
      stored,
      stored.stage,
      Object.freeze({
        ...stored.ledger,
        processEffects: Object.freeze([
          ...stored.ledger.processEffects,
          Object.freeze({
            sequence: stored.ledger.processEffects.length,
            action: "desktop_launch" as const,
            phase: "intent_recorded" as const,
            issued: null,
            confirmation: "unknown" as const,
          }),
        ]),
        processEffectIssued: true,
        processEffectConfirmation: "unknown" as const,
      }),
    );
    assert.ok(launchIntent);
    const launchEffects = launchIntent.ledger.processEffects.map((entry) =>
      entry.action === "desktop_launch"
        ? Object.freeze({
            ...entry,
            phase: "settled" as const,
            issued: true,
            confirmation: "confirmed" as const,
          })
        : entry,
    );
    stored = persistActualRepairRecord(
      originBoundary,
      launchIntent,
      launchIntent.stage,
      Object.freeze({
        ...launchIntent.ledger,
        processEffects: Object.freeze(launchEffects),
        processEffectIssued: true,
        processEffectConfirmation: "confirmed" as const,
      }),
    );
    assert.ok(stored);
    const originManifest = Object.freeze({ release: "origin" });
    const currentManifest = Object.freeze({ release: "current" });
    /**
     * verifyHistoryのTest準備責務を実行する。
     *
     * @responsibility 署名版更新fixtureのRelease Identityを決定論的に検証する。
     * @trace ERB-IT-012
     * @precondition originまたはcurrentの固定manifestを受け取る。
     * @stimulus verifyHistoryをmanifest候補で呼び出す。
     * @observation 対応するRelease Identityまたはnullを取得する。
     * @oracle 既知manifestだけが対応するRelease Identityへ解決される。
     * @cleanup N/A: Test Helperは永続資源を作成しない。
     * @boundary ERB-IT-012=Related 2 Blocks: Coordinator→Repair Record→Platform Adapter
     */
    const verifyHistory: DockerDesktopRepairHistoryVerifier = (value) => {
      const selected =
        JSON.stringify(value) === JSON.stringify(originManifest)
          ? originBoundary
          : JSON.stringify(value) === JSON.stringify(currentManifest)
            ? currentBoundary
            : null;
      return selected
        ? Object.freeze({
            manifestHash: selected.crddManifestHash,
            releaseSequence: selected.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              selected.runtimeExecutionIdentitySha256,
            crddTree: "5".repeat(40),
            packageContentRootSha256: "6".repeat(64),
          })
        : null;
    };
    assert.ok(
      persistDockerDesktopRepairHistoricalAdoption(
        currentBoundary,
        stored,
        originManifest,
        currentManifest,
        verifyHistory,
      ),
    );
    const adoptedInventory = inventoryDockerDesktopRepairOperations(
      currentBoundary,
      verifyHistory,
    );
    assert.equal(adoptedInventory.status, "verified");
    const operation = adoptedInventory.operations[0];
    assert.ok(operation?.history);
    const operationId = operation.operationId;
    const operationDirectory = operation.operationDirectory;
    const originalStale = operation.staleDirectory;
    fs.mkdirSync(runDirectory, { recursive: true });
    fs.mkdirSync(secretsDirectory, { recursive: true });
    fs.writeFileSync(path.join(runDirectory, "sailor-ingest.sock"), "run");
    fs.writeFileSync(path.join(secretsDirectory, "engine.sock"), "secret");
    let activeOperation = operation;
    let wasRestarted = false;
    let externallyActive = false;
    let shouldActivateAfterRunRename = false;
    let launches = 0;
    let closureWrites = 0;
    const renameCalls: string[] = [];
    const repairSession = Object.freeze({
      ...session(),
      inspectProcesses: async () =>
        wasRestarted || externallyActive
          ? ("verified" as const)
          : ("absent" as const),
      launchDesktop: async () => {
        launches += 1;
        wasRestarted = true;
        fs.mkdirSync(runDirectory);
        fs.writeFileSync(path.join(runDirectory, "dockerInference"), "new");
        fs.mkdirSync(secretsDirectory);
        fs.writeFileSync(path.join(secretsDirectory, "engine.sock"), "new");
        return "started" as const;
      },
    });
    /**
     * observePathのTest準備責務を実行する。
     *
     * @responsibility observePathがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
     * @trace ERB-IT-001
     * @precondition 呼出し元Test Caseが必要な入力を渡す。
     * @stimulus observePathを呼び出す。
     * @observation 返却値、生成fixtureまたは観測値を取得する。
     * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
     * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
     * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
     */
    const observePath = (target: string) => {
      const observed = directoryIdentity(target);
      return observed
        ? Object.freeze({ state: "present" as const, identity: observed })
        : Object.freeze({
            state: "confirmed_absent" as const,
            identity: null,
          });
    };
    let activeBoundary = currentBoundary;
    const dependencies: RepairDependencies = {
      prepareBoundary: () => activeBoundary,
      acquireHelper: async () =>
        Object.freeze({ status: "acquired" as const, session: repairSession }),
      inventory: () =>
        Object.freeze({
          status: "verified" as const,
          operations: Object.freeze([activeOperation]),
        }),
      observeEngine: () =>
        wasRestarted || externallyActive ? "ready" : "known_unavailable",
      observeKnownSocketFailure: () => null,
      observeRuntimeDirectoryLock: (target) => directoryIdentity(target),
      persistStage: () => assert.fail("historical chain must remain immutable"),
      officialShutdown: () =>
        Object.freeze({ issued: false, confirmation: "not_issued" as const }),
      terminateDockerWsl: () =>
        Object.freeze({ issued: false, confirmation: "not_issued" as const }),
      renameRunDirectory: () =>
        assert.fail("original runtime directory must not be renamed again"),
      renameRuntimeDirectory: (source, target, expected) => {
        renameCalls.push(source);
        const before = directoryIdentity(source);
        assert.deepEqual(before, expected);
        fs.renameSync(source, target);
        if (shouldActivateAfterRunRename && source === runDirectory)
          externallyActive = true;
        return Object.freeze({
          issued: true,
          confirmation: "confirmed" as const,
          staleState: "retained" as const,
        });
      },
      awaitEngine: async () =>
        wasRestarted || externallyActive ? "ready" : "known_unavailable",
      identityAt: directoryIdentity,
      observePath,
      history: {
        inspect: () => activeOperation,
        loadOriginManifest: () => ({}),
        loadCurrentManifest: () => ({}),
        persistAdoption: () => assert.fail("already adopted"),
        persistClosure: () => {
          closureWrites += 1;
          return null;
        },
      },
    };
    const result =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(
      result.status,
      "historical_recovered_pending_close",
      JSON.stringify(result),
    );
    assert.equal(
      result.reason,
      "docker_desktop_repair_continuation_recovered_pending_close",
    );
    assert.equal(result.repairId, operation.repairId);
    assert.equal(launches, 1);
    assert.equal(fs.existsSync(originalStale), true);
    assert.equal(
      fs.existsSync(
        path.join(
          localAppData,
          "Docker",
          `run.crdd-stale-${operationId}-restart`,
        ),
      ),
      true,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          localAppData,
          `docker-secrets-engine.crdd-stale-${operationId}`,
        ),
      ),
      true,
    );
    assert.equal(fs.existsSync(runDirectory), true);
    assert.equal(fs.existsSync(secretsDirectory), true);
    const replay =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(replay.status, "historical_recovered_pending_close");
    assert.equal(launches, 1);

    const migratedBoundary: PreparedBoundary = Object.freeze({
      ...currentBoundary,
      localUserBindingHash: "9".repeat(64),
      crddManifestHash: "a".repeat(64),
      crddReleaseSequence: currentBoundary.crddReleaseSequence + 1,
      runtimeExecutionIdentitySha256: "b".repeat(64),
    });
    const operationHistory = operation.history;
    assert.ok(operationHistory);
    const migratedOperation: DockerDesktopRepairOperation = Object.freeze({
      ...operation,
      history: Object.freeze({
        ...operationHistory,
        handoffTipSha256: "d".repeat(64),
        handoffCount: 1,
        currentLocalUserBindingHash: migratedBoundary.localUserBindingHash,
        currentSessionBound: true,
        continuationAuthorities: Object.freeze([
          Object.freeze({
            localUserBindingHash: currentBoundary.localUserBindingHash,
            manifestHash: currentBoundary.crddManifestHash,
            releaseSequence: currentBoundary.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              currentBoundary.runtimeExecutionIdentitySha256,
          }),
          Object.freeze({
            localUserBindingHash: migratedBoundary.localUserBindingHash,
            manifestHash: migratedBoundary.crddManifestHash,
            releaseSequence: migratedBoundary.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              migratedBoundary.runtimeExecutionIdentitySha256,
          }),
        ]),
      }),
    });
    activeBoundary = migratedBoundary;
    activeOperation = migratedOperation;
    const migratedReplay =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(
      migratedReplay.status,
      "blocked",
      JSON.stringify(migratedReplay),
    );
    assert.equal(
      migratedReplay.reason,
      "docker_desktop_repair_continuation_record_invalid",
    );
    assert.equal(migratedReplay.repairId, operation.repairId);
    assert.equal(launches, 1);
    activeBoundary = currentBoundary;
    activeOperation = operation;

    const hiddenSecretsDirectory = `${secretsDirectory}.missing-fixture`;
    fs.renameSync(secretsDirectory, hiddenSecretsDirectory);
    const missingSecretsClose =
      await closeWindowsDockerDesktopRepairUsingDependencies(
        operation.repairId,
        dependencies,
      );
    assert.equal(missingSecretsClose.status, "blocked");
    assert.equal(closureWrites, 0);
    fs.renameSync(hiddenSecretsDirectory, secretsDirectory);
    const continuationDirectory = path.join(
      operationDirectory,
      "runtime-continuation",
    );
    const hiddenContinuationDirectory = `${continuationDirectory}.missing-fixture`;
    fs.renameSync(continuationDirectory, hiddenContinuationDirectory);
    const missingContinuationClose =
      await closeWindowsDockerDesktopRepairUsingDependencies(
        operation.repairId,
        dependencies,
      );
    assert.equal(missingContinuationClose.status, "blocked");
    assert.equal(missingContinuationClose.repairId, operation.repairId);
    assert.equal(closureWrites, 0);
    fs.renameSync(hiddenContinuationDirectory, continuationDirectory);
    const originalContinuationRecord = path.join(
      operationDirectory,
      "runtime-continuation",
      "continuation-00-prepared.json",
    );
    const releaseMismatchedContinuation = JSON.parse(
      fs.readFileSync(originalContinuationRecord, "utf8"),
    );
    releaseMismatchedContinuation.crddManifestHash = "f".repeat(64);
    fs.writeFileSync(
      originalContinuationRecord,
      `${JSON.stringify(releaseMismatchedContinuation)}\n`,
      "utf8",
    );
    const releaseMismatchedClose =
      await closeWindowsDockerDesktopRepairUsingDependencies(
        operation.repairId,
        dependencies,
      );
    assert.equal(releaseMismatchedClose.status, "blocked");
    assert.equal(closureWrites, 0);

    fs.rmSync(continuationDirectory, { recursive: true, force: true });
    const externallyActiveRunIdentity = directoryIdentity(runDirectory);
    const externallyActiveSecretsIdentity = directoryIdentity(secretsDirectory);
    assert.ok(externallyActiveRunIdentity);
    assert.ok(externallyActiveSecretsIdentity);
    assert.ok(
      createDockerDesktopRepairContinuation(
        currentBoundary,
        operation,
        externallyActiveRunIdentity,
        externallyActiveSecretsIdentity,
      ),
    );
    activeOperation = operation;
    wasRestarted = false;
    externallyActive = true;
    const renameCountBeforeActiveReentry = renameCalls.length;
    const activeReentry =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(activeReentry.status, "blocked");
    assert.equal(
      activeReentry.reason,
      "docker_desktop_repair_continuation_effect_precondition_unconfirmed",
    );
    assert.equal(renameCalls.length, renameCountBeforeActiveReentry);
    const partialClose = await closeWindowsDockerDesktopRepairUsingDependencies(
      operation.repairId,
      dependencies,
    );
    assert.equal(partialClose.status, "blocked");
    assert.equal(closureWrites, 0);
    externallyActive = false;

    fs.rmSync(continuationDirectory, { recursive: true, force: true });
    const failedRunStale = path.join(
      localAppData,
      "Docker",
      `run.crdd-stale-${operationId}-restart`,
    );
    const secretsStale = path.join(
      localAppData,
      `docker-secrets-engine.crdd-stale-${operationId}`,
    );
    fs.rmSync(failedRunStale, { recursive: true, force: true });
    fs.rmSync(secretsStale, { recursive: true, force: true });
    const effectBoundaryRunIdentity = directoryIdentity(runDirectory);
    const effectBoundarySecretsIdentity = directoryIdentity(secretsDirectory);
    assert.ok(effectBoundaryRunIdentity);
    assert.ok(effectBoundarySecretsIdentity);
    assert.ok(
      createDockerDesktopRepairContinuation(
        currentBoundary,
        operation,
        effectBoundaryRunIdentity,
        effectBoundarySecretsIdentity,
      ),
    );
    activeOperation = operation;
    shouldActivateAfterRunRename = true;
    const effectBoundaryResult =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(effectBoundaryResult.status, "blocked");
    assert.equal(
      effectBoundaryResult.reason,
      "docker_desktop_repair_continuation_effect_precondition_unconfirmed",
    );
    assert.equal(fs.existsSync(secretsDirectory), true);
    assert.equal(
      fs.existsSync(
        path.join(
          localAppData,
          `docker-secrets-engine.crdd-stale-${operationId}`,
        ),
      ),
      false,
    );
    shouldActivateAfterRunRename = false;
    externallyActive = false;
    fs.mkdirSync(runDirectory);
    fs.writeFileSync(path.join(runDirectory, "dockerInference"), "newer");

    fs.rmSync(continuationDirectory, { recursive: true, force: true });
    fs.rmSync(failedRunStale, { recursive: true, force: true });
    const interruptedRunIdentity = directoryIdentity(runDirectory);
    const interruptedSecretsIdentity = directoryIdentity(secretsDirectory);
    assert.ok(interruptedRunIdentity);
    assert.ok(interruptedSecretsIdentity);
    const preparedContinuation = createDockerDesktopRepairContinuation(
      currentBoundary,
      operation,
      interruptedRunIdentity,
      interruptedSecretsIdentity,
    );
    assert.ok(preparedContinuation);
    const interruptedContinuation =
      persistDockerDesktopRepairContinuationIntent(
        currentBoundary,
        operation,
        preparedContinuation,
        "failed_launch_run_directory_rename",
      );
    assert.ok(interruptedContinuation);
    activeOperation = operation;
    wasRestarted = false;
    const renameCountBeforeInterruptedReentry = renameCalls.length;
    const runRenameCountBeforeInterruptedReentry = renameCalls.filter(
      (source) => source === runDirectory,
    ).length;
    const interruptedReentry =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(interruptedReentry.status, "blocked");
    assert.equal(
      interruptedReentry.reason,
      "docker_desktop_repair_continuation_effect_unknown",
    );
    assert.equal(renameCalls.length, renameCountBeforeInterruptedReentry);

    fs.renameSync(runDirectory, failedRunStale);
    const observedEffectReentry =
      await repairWindowsDockerDesktopRuntimeUsingDependencies(dependencies);
    assert.equal(
      observedEffectReentry.status,
      "historical_recovered_pending_close",
      JSON.stringify(observedEffectReentry),
    );
    assert.equal(observedEffectReentry.repairId, operation.repairId);
    assert.equal(launches, 2);
    assert.equal(
      renameCalls.filter((source) => source === runDirectory).length,
      runRenameCountBeforeInterruptedReentry,
      "意図記録後に外部Effectを観測した再入場では同じrenameを再発行しない",
    );
    assert.equal(fs.existsSync(failedRunStale), true);
    assert.equal(
      fs.existsSync(
        path.join(
          localAppData,
          `docker-secrets-engine.crdd-stale-${operationId}`,
        ),
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * terminal再表示はstale exact identityと解放後package世代を再確認するを検証する。
 *
 * @responsibility terminal再表示はstale exact identityと解放後package世代を再確認するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus terminal再表示はstale exact identityと解放後package世代を再確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("terminal再表示はstale exact identityと解放後package世代を再確認する", async () => {
  const ledger: DockerDesktopRepairLedgerSnapshot = Object.freeze({
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "runtime_directory_rename",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
      Object.freeze({
        sequence: 1,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed",
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: true,
    staleState: "retained",
    hostSafety: "safe",
    evidenceState: "preserved",
    disposition: "retained_by_human_decision",
    liveRunIdentity: RUN_IDENTITY,
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId: "e".repeat(32),
    repairId: `docker-desktop-repair.${"e".repeat(32)}`,
    operationDirectory: "C:\\runtime-state\\docker-desktop-repair-e",
    staleName: `run.crdd-stale-${"e".repeat(32)}`,
    staleDirectory: `C:\\local\\Docker\\run.crdd-stale-${"e".repeat(32)}`,
    runIdentity: RUN_IDENTITY,
    stage: "closed_retained",
    sequence: 4,
    previousRecordSha256: "5".repeat(64),
    ledger,
  });
  const replacement = Object.freeze({ dev: "9", ino: "9", birthtimeNs: "9" });
  const replaced = fixture({
    identityAt: (target) =>
      target.includes("run.crdd-stale-") ? replacement : RUN_IDENTITY,
  });
  replaced.setOperation(operation);
  const replacedResult = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    replaced.dependencies,
  );
  assert.equal(replacedResult.status, "blocked");

  const replacedLiveRun = fixture({
    identityAt: (target) =>
      target.includes("run.crdd-stale-") ? RUN_IDENTITY : replacement,
  });
  replacedLiveRun.setOperation(operation);
  const replacedLiveRunResult =
    await closeWindowsDockerDesktopRepairUsingDependencies(
      operation.repairId,
      replacedLiveRun.dependencies,
    );
  assert.equal(replacedLiveRunResult.status, "blocked");

  let observations = 0;
  const changedBoundary = Object.freeze({
    ...boundary,
    runtimeExecutionIdentitySha256: "a".repeat(64),
  });
  const changed = fixture({
    prepareBoundary: () => {
      observations += 1;
      return observations >= 3 ? changedBoundary : boundary;
    },
  });
  changed.setOperation(operation);
  const changedResult = await closeWindowsDockerDesktopRepairUsingDependencies(
    operation.repairId,
    changed.dependencies,
  );
  assert.equal(changedResult.status, "blocked");
  assert.equal(changedResult.newRepairPermitted, false);
});

/**
 * Contractは自動fallback・全WSL停止・削除・PID killを許可しないを検証する。
 *
 * @responsibility Contractは自動fallback・全WSL停止・削除・PID killを許可しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Contractは自動fallback・全WSL停止・削除・PID killを許可しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("Contractは自動fallback・全WSL停止・削除・PID killを許可しない", () => {
  const contract = describeDockerDesktopRuntimeRepairContract();
  assert.equal(contract.platform, "windows");
  assert.equal(contract.invocation, "explicit_doctor_only");
  assert.equal(contract.automaticFallback, false);
  assert.equal(contract.exactDockerVersionRequired, false);
  assert.equal(contract.crossOperationArtifactHashPinning, false);
  assert.equal(contract.sameOperationArtifactIdentityRequired, true);
  assert.equal(contract.wslTermination, "docker_desktop_distribution_only");
  assert.equal(contract.staleDirectoryDeletion, false);
  assert.equal(contract.providerEffectIssued, false);
  const sources = [
    "../../src/security/docker-desktop-runtime-repair.ts",
    "../../../platform-access/src/docker_repair.rs",
  ].map((relative) =>
    fs.readFileSync(new URL(relative, import.meta.url), "utf8"),
  );
  assert.equal(
    sources.some((source) => source.includes('"--shutdown"')),
    false,
  );
  assert.equal(
    sources.some((source) => source.includes('"-Shutdown"')),
    false,
  );
  assert.match(sources[0] ?? "", /await session\.stopDesktop\(\)/u);
  assert.equal(
    sources.some((source) => source.includes("taskkill")),
    false,
  );
  assert.equal(
    sources.some((source) => source.includes("rmSync(")),
    false,
  );
  assert.equal(
    sources.some((source) => source.includes("unlinkSync(")),
    false,
  );
});

/**
 * 人間表示はtri-stateと明示closeを示しPathを報告しないを検証する。
 *
 * @responsibility 人間表示はtri-stateと明示closeを示しPathを報告しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 人間表示はtri-stateと明示closeを示しPathを報告しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("人間表示はtri-stateと明示closeを示しPathを報告しない", () => {
  const repairId = `docker-desktop-repair.${"a".repeat(32)}`;
  const rendered = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "recovered_pending_close",
      reason: "docker_desktop_runtime_recovered_pending_close",
      repairId,
      manualRecoveryRequired: false,
      engineReady: true,
      processEffectIssued: true,
      filesystemEffectIssued: true,
      staleRuntimeDirectory: "retained",
      nativeHelperCleanupConfirmed: true,
    }),
    false,
  );
  assert.equal(rendered.exitCode, 2);
  assert.match(rendered.stdout, /Docker Engineの準備完了: はい/u);
  assert.match(rendered.stdout, /退避した実行時フォルダの状態: retained/u);
  assert.match(
    rendered.stdout,
    new RegExp(`--close-docker-desktop-runtime-repair ${repairId}`, "u"),
  );
  assert.doesNotMatch(rendered.stdout, /C:\\/u);
  const historical = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "closed_historical_effect_unknown_retained",
      reason: "docker_desktop_repair_evidence_retention_closed",
      repairId,
      manualRecoveryRequired: false,
      engineReady: true,
      processEffectIssued: true,
      processEffectConfirmation: "unknown",
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "confirmed",
      staleRuntimeDirectory: "absent",
      nativeHelperCleanupConfirmed: true,
      effectStateUnknown: true,
      newRepairPermitted: true,
    }),
    false,
  );
  assert.equal(historical.exitCode, 0);
  assert.match(
    historical.stdout,
    /退避した実行時フォルダは観測されていません/u,
  );
  assert.doesNotMatch(historical.stdout, /C:\\/u);
  const knownNoStale = renderDockerRecoveryDoctorReport(
    Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "closed_retained",
      reason: "docker_desktop_repair_evidence_retention_closed",
      repairId,
      manualRecoveryRequired: false,
      engineReady: true,
      processEffectIssued: true,
      processEffectConfirmation: "confirmed",
      filesystemEffectIssued: true,
      filesystemEffectConfirmation: "confirmed",
      staleRuntimeDirectory: "absent",
      nativeHelperCleanupConfirmed: true,
      effectStateUnknown: false,
      newRepairPermitted: true,
    }),
    false,
  );
  assert.equal(knownNoStale.exitCode, 0);
  assert.match(knownNoStale.stdout, /退避した実行時フォルダは残っていません/u);
  assert.match(knownNoStale.stdout, /確認済みのホスト操作履歴/u);
  assert.doesNotMatch(
    knownNoStale.stdout,
    /退避した実行時フォルダの根拠は意図的に保持/u,
  );
});
