/**
 * 現在回収OwnerのHost遷移と実状態保存を別Processで接続する。
 * @packageDocumentation
 * @responsibility 実marker・File排他・遷移／清掃の保存確定と再入場の不変性を確認する。
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope 自己生成Repository、実Hostと現在state。通常形の後続資源発見・不存在、identified／auth unknown条件のDocker読取り・Authenticode応答、restart二形のDI再起動結果は合成値であり、実Docker／Provider要求は行わない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収Driver→Host／現在状態Writer。
 */

import assert from "node:assert/strict";
import childProcess, { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { runInNewContext, Script } from "node:vm";
import { startOwnedWindowsProcess } from "../../../docker-isolation/src/process/start.ts";
import type { ExecutionOperationRecord } from "../../../execution-model/src/index.ts";
import {
  createResourceBookFixture,
  createResourceOperationFixture,
} from "../../../execution-model/tests/support/resource-operation.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/configuration/runtime-data.ts";
import { beginRuntimeOwnedCoordinatorHostSubmission } from "../../src/execution/controller.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  bindRuntimeOwnedRepositoryOperation,
  borrowOwnedHostRecoverySnapshot,
  borrowRuntimeOwnedCoordinatorStateRepository,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../../src/execution/operation.ts";
import {
  readOperationStateStage,
  saveOperationCheckpoint,
  saveOperationStart,
} from "../../src/execution/persistence.ts";
import { loadHostRecoveryRecordByToken } from "../../src/execution/recovery.ts";
import { executionSelection } from "../fixtures/ai-selection.ts";
import {
  currentAuthenticationRecoveryCliSource,
  currentRecoveryCliSource,
  hostFixtureProcessBoundarySource,
  savedAbsenceProcessProfileSource,
} from "../fixtures/current-authentication-recovery-cli.ts";
import { currentHostTransitionWorkerSource } from "../fixtures/current-host-transition-worker.ts";
import {
  canonicalJson,
  restartRequestIdFixture,
} from "../support/contract-assertions.ts";

/** 本番通知本文の保存Owner選択を、実適格判定と段階別の拒否で反証する。
 * @trace ERB-IT-014
 * @boundary 専用inspectは1 call・不存在2 round。Filesystem／Docker要求なし。
 */
test("認証終了の保存順序: 専用Ownerを先に選び不成立時は一般経路か安全停止", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "onResourcesClosed: (snapshot, observations) =>",
    source.indexOf(
      "export async function recoverRuntimeOwnedDockerTaskResources(",
    ),
  );
  const end = source.indexOf("\n    });\n    const abort", begin);
  assert.ok(begin > 0 && end > begin);
  const callbackSource = source
    .slice(begin + "onResourcesClosed: ".length, end)
    .trim()
    .replace(/,$/u, "");
  const fixture = createResourceOperationFixture();
  const original = JSON.parse(fixture.bytes.toString()).operations[0];
  const keys = [
    "create_egress_network",
    "create_internal_network",
    "create_provider",
    "create_proxy",
    "create_subscription_auth_probe",
  ];
  const planned = createResourceBookFixture(
    fixture.identity.ownershipLabel,
    "planned",
    keys,
  );
  const book = {
    ...planned,
    snapshot: {
      resources: planned.snapshot.resources.map((resource) =>
        resource.key === "create_subscription_auth_probe"
          ? { ...resource, request: "unknown" as const }
          : resource,
      ),
    },
    checkpoints: planned.checkpoints.map((checkpoint) =>
      checkpoint.key === "create_subscription_auth_probe"
        ? { ...checkpoint, submission: "intent_saved" as const }
        : checkpoint,
    ),
  };
  const scopeSha256 = "d".repeat(64);
  const requestId = restartRequestIdFixture(
    fixture.binding,
    original.identitySha256,
    fixture.recoveryId,
    scopeSha256,
  );
  assert.ok(requestId);
  const eligible: ExecutionOperationRecord = {
    ...original,
    phase: "settling",
    resources: book,
    execution: {
      externalSend: "not_issued",
      ownerEffect: "disabled",
      providerStart: "not_started",
      sharedWrite: "not_issued",
      workspaceReusable: false,
    },
    dockerRestart: {
      requestId,
      scopeSha256,
      request: "confirmed",
      cleanup: "confirmed",
      result: {
        status: "completed",
        reason: "docker_restart_settled",
        request: "confirmed",
        effectOutcomeUnknown: false,
      },
    },
  };
  for (const scenario of [
    "eligible",
    "receipt",
    "other_unsettled",
    "becomes_eligible_after_generic",
    "restart_missing",
    "missing_book",
    "generic_refused",
    "inspect_unknown",
    "inspect_config_unknown",
    "writer_failed",
    "readback_failed",
    "owner_before",
    "owner_before_inspect",
    "owner_after_inspect",
    "owner_at_write",
    "owner_after_readback",
  ]) {
    const operation: ExecutionOperationRecord =
      scenario === "receipt"
        ? {
            ...eligible,
            resources: {
              ...book,
              snapshot: {
                resources: book.snapshot.resources.map((resource) =>
                  resource.key === "create_subscription_auth_probe"
                    ? {
                        ...resource,
                        identity: {
                          ...resource.identity,
                          dockerId: "a".repeat(64),
                        },
                        request: "issued",
                      }
                    : resource,
                ),
              },
              checkpoints: book.checkpoints.map((checkpoint) =>
                checkpoint.key === "create_subscription_auth_probe"
                  ? { ...checkpoint, receiptSource: "docker_create_result" }
                  : checkpoint,
              ),
            },
          }
        : scenario === "other_unsettled" ||
            scenario === "becomes_eligible_after_generic"
          ? {
              ...eligible,
              resources: {
                ...book,
                snapshot: {
                  resources: book.snapshot.resources.map((resource) =>
                    resource.key === "create_provider"
                      ? { ...resource, request: "unknown" }
                      : resource,
                  ),
                },
                checkpoints: book.checkpoints.map((checkpoint) =>
                  checkpoint.key === "create_provider"
                    ? { ...checkpoint, submission: "intent_saved" }
                    : checkpoint,
                ),
              },
            }
          : scenario === "restart_missing" || scenario === "generic_refused"
            ? { ...eligible, dockerRestart: null }
            : scenario === "missing_book"
              ? { ...eligible, resources: null }
              : eligible;
    const generalPath = [
      "receipt",
      "other_unsettled",
      "becomes_eligible_after_generic",
      "restart_missing",
      "missing_book",
      "generic_refused",
    ].includes(scenario);
    const counts = { generic: 0, inspect: 0, writer: 0, read: 0 };
    let currentCalls = 0;
    const capability = {},
      rootCapability = {},
      before = Buffer.from("before");
    const record = {
      repository: { repositoryBinding: fixture.binding },
      recoveryId: fixture.recoveryId,
      before,
      cleanupUnknown: false,
      persistenceFailed: false,
      rootCapability,
    };
    const snapshot = book.snapshot,
      observations = keys.map((key) => ({
        key,
        observation:
          key === "create_subscription_auth_probe" ? "absent" : "not_requested",
      }));
    const context = {
      Buffer,
      capability,
      record,
      borrowed: { directory: "fixture-management" },
      signal: undefined,
      authenticationClosureConfirmed: false,
      inspectionConfigConfirmed: true,
      current: () => {
        currentCalls++;
        if (record.persistenceFailed || record.cleanupUnknown)
          throw Error("fixture_owner_unconfirmed");
        if (
          scenario === "owner_before" ||
          (scenario === "owner_before_inspect" && currentCalls === 2) ||
          (scenario === "owner_after_inspect" && counts.inspect > 0)
        )
          throw Error("fixture_owner_lost");
        const becameEligible =
          scenario === "becomes_eligible_after_generic" && counts.generic > 0;
        // このCaseはReaderの前後で条件が変わる搬送を検証する。モデル条件自体はEMの反証が所有する。
        return {
          operation: becameEligible ? eligible : operation,
          authenticationClosureAllowed: becameEligible || !generalPath,
        };
      },
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint: (
        owner: unknown,
        kind: string,
        value: unknown,
      ) => {
        assert.equal(owner, capability);
        assert.equal(kind, "cleanup");
        assert.deepEqual(
          structuredClone(value),
          structuredClone({ snapshot, observations }),
        );
        counts.generic++;
        return scenario !== "generic_refused";
      },
      projectResourceTarget: () => ({
        resources: { resources: book.snapshot.resources },
        cleanupOrder: keys,
        previouslyAbsent: [],
      }),
      inspect: (
        target: {
          resources: { resources: { key: string }[] };
          cleanupOrder: string[];
          previouslyAbsent: unknown[];
        },
        options: unknown,
      ) => {
        counts.inspect++;
        assert.deepEqual(
          structuredClone(target.resources.resources.map((r) => r.key)),
          ["create_subscription_auth_probe"],
        );
        assert.deepEqual(structuredClone(target.cleanupOrder), [
          "create_subscription_auth_probe",
        ]);
        assert.deepEqual(structuredClone(target.previouslyAbsent), []);
        assert.deepEqual(structuredClone(options), {
          stopOnUnknownAbsence: true,
        });
        return {
          status: scenario === "inspect_unknown" ? "unknown" : "completed",
          configCleanupConfirmed: scenario !== "inspect_config_unknown",
          resources: [
            {
              key: "create_subscription_auth_probe",
              absenceObservations: [
                "absent",
                scenario === "inspect_unknown" ? "unknown" : "absent",
              ],
            },
          ],
        };
      },
      assertCurrentRecoveryOwner: () =>
        scenario !== "owner_at_write" &&
        !(scenario === "owner_after_readback" && counts.read > 0),
      saveRecoveryCheckpoint: (
        repository: unknown,
        id: string,
        bytes: Buffer,
        request: {
          kind: "authentication_unknown_closure";
          observations: unknown;
          assertOwner: () => boolean;
        },
      ) => {
        counts.writer++;
        assert.equal(repository, record.repository);
        assert.equal(id, fixture.recoveryId);
        assert.equal(bytes, before);
        assert.deepEqual(structuredClone(request.observations), [
          { round: 1, name: "absent", name_label: "absent" },
          { round: 2, name: "absent", name_label: "absent" },
        ]);
        const confirmed = request.assertOwner() && scenario !== "writer_failed";
        return {
          status: confirmed ? "completed" : "blocked",
          snapshotConfirmed: confirmed,
          lockReleased: true,
          revision: 2,
          payloadSha256: "saved",
        };
      },
      readState: (owner: unknown) => {
        counts.read++;
        assert.equal(owner, rootCapability);
        return {
          status: "completed",
          lockReleased: true,
          value: {
            snapshot: { revision: 2 },
            operationStates: [],
            sourceText: '{"revision":2}\n',
            payloadSha256: scenario === "readback_failed" ? "changed" : "saved",
          },
        };
      },
      canonicalJson: JSON.stringify,
    };
    const callback = runInNewContext(`(${callbackSource})`, context);
    const fails = [
      "generic_refused",
      "inspect_unknown",
      "inspect_config_unknown",
      "writer_failed",
      "readback_failed",
      "owner_before",
      "owner_before_inspect",
      "owner_after_inspect",
      "owner_at_write",
      "owner_after_readback",
    ].includes(scenario);
    if (fails) assert.throws(() => callback(snapshot, observations));
    else callback(snapshot, observations);
    assert.equal(counts.generic, generalPath ? 1 : 0, scenario);
    assert.equal(
      counts.inspect,
      (generalPath && scenario !== "becomes_eligible_after_generic") ||
        ["owner_before", "owner_before_inspect"].includes(scenario)
        ? 0
        : 1,
      scenario,
    );
    assert.equal(
      counts.writer,
      (generalPath && scenario !== "becomes_eligible_after_generic") ||
        [
          "owner_before",
          "owner_before_inspect",
          "owner_after_inspect",
          "inspect_unknown",
          "inspect_config_unknown",
        ].includes(scenario)
        ? 0
        : 1,
      scenario,
    );
    assert.equal(
      counts.read,
      [
        "eligible",
        "becomes_eligible_after_generic",
        "readback_failed",
        "owner_after_readback",
      ].includes(scenario)
        ? 1
        : 0,
      scenario,
    );
    assert.equal(
      context.authenticationClosureConfirmed,
      scenario === "eligible" || scenario === "becomes_eligible_after_generic",
      scenario,
    );
    assert.equal(record.recoveryId, fixture.recoveryId);
  }
});

/** 自己生成Rootだけを、親Git設定・Hook・署名・templateを使わず準備する。
 * @trace ERB-IT-014
 */
function prepareHostFixtureRepository(root: string) {
  const options = {
    cwd: root,
    encoding: "utf8" as const,
    shell: false,
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 1_048_576,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
      ),
      GIT_CONFIG_GLOBAL: "NUL",
      GIT_CONFIG_SYSTEM: "NUL",
    },
  };
  for (const args of [
    ["init", "--template=", "--quiet"],
    [
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
  ]) {
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "core.hooksPath=NUL",
        "-c",
        "commit.gpgSign=false",
        "-c",
        "core.fsmonitor=false",
        ...args,
      ],
      options,
    );
  }
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "", {
    flag: "wx",
  });
}

/** Git準備の実呼出し部分をspyへ渡し、親設定の遮断と非0時停止を確認する。
 * @trace ERB-IT-014
 */
test("Host親Git準備: 固定引数・環境と失敗時停止を確認する", () => {
  const source = prepareHostFixtureRepository.toString();
  for (const failAt of [null, 0, 1]) {
    const failed = failAt !== null;
    const filesystemRequests: unknown[][] = [];
    const requests: {
      executable: string;
      args: readonly string[];
      options: Record<string, unknown>;
    }[] = [];
    const context = {
      path,
      fs: {
        mkdirSync: (...args: unknown[]) =>
          filesystemRequests.push(["mkdir", ...args]),
        writeFileSync: (...args: unknown[]) =>
          filesystemRequests.push(["write", ...args]),
      },
      process: {
        env: {
          GIT_DIR: "private-fixture-directory",
          git_config_count: "3",
          GIT_CONFIG_COUNT: "2",
          GIT_EXEC_PATH: "private-fixture-exec",
          PATH: "fixture-git-path",
          SystemRoot: "C:\\Windows",
        },
      },
      execFileSync: (
        executable: string,
        args: readonly string[],
        options: Record<string, unknown>,
      ) => {
        requests.push({ executable, args, options });
        if (requests.length - 1 === failAt) throw Error("fixture_git_failed");
        return "";
      },
    };
    const run = () => runInNewContext(`(${source})('C:\\\\fixture')`, context);
    if (failed) assert.throws(run);
    else run();
    assert.equal(requests.length, failAt === null ? 2 : failAt + 1);
    assert.deepEqual(
      structuredClone(filesystemRequests),
      failed
        ? []
        : [
            ["mkdir", "C:\\fixture\\.git\\info"],
            ["write", "C:\\fixture\\.git\\info\\exclude", "", { flag: "wx" }],
          ],
    );
    for (const [index, request] of requests.entries()) {
      assert.equal(request.executable, "git");
      assert.deepEqual(structuredClone(request.args), [
        "-C",
        "C:\\fixture",
        "-c",
        "core.hooksPath=NUL",
        "-c",
        "commit.gpgSign=false",
        "-c",
        "core.fsmonitor=false",
        ...(index === 0
          ? ["init", "--template=", "--quiet"]
          : [
              "-c",
              "user.name=CRDD Test",
              "-c",
              "user.email=test@example.invalid",
              "commit",
              "--allow-empty",
              "--quiet",
              "-m",
              "fixture",
            ]),
      ]);
      assert.deepEqual(structuredClone(request.options), {
        cwd: "C:\\fixture",
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1048576,
        env: {
          PATH: "fixture-git-path",
          SystemRoot: "C:\\Windows",
          GIT_CONFIG_GLOBAL: "NUL",
          GIT_CONFIG_SYSTEM: "NUL",
        },
      });
    }
  }
});

/** 通常CLI三形の試験期限だけを既存の二層枠へ揃え、他の期限を保つ。
 * @trace ERB-IT-014
 */
test("CLI試験の期限: 通常三形だけ既存の二層枠へ接続する", () => {
  const inner = currentHostTransitionWorkerSource.match(
    /const cliChildTimeout =[\s\S]*?;/u,
  )?.[0];
  const outer = fs
    .readFileSync(import.meta.filename, "utf8")
    .match(/\n\s{6}const hostWorkerTimeout =[\s\S]*?;/u)?.[0];
  assert.ok(inner && outer);
  for (const [fault, innerExpected, outerExpected] of [
    ["cli_entry_cli", 120000, 180000],
    ["cli_entry_workbench", 120000, 180000],
    ["cli_entry_orchestrator", 120000, 180000],
    ["restart_cli_entry", 120000, 180000],
    ["restart_auth_cli_entry", 120000, 180000],
    ["cli_entry_orchestrator_identified", 60000, 90000],
    ["driver", 60000, 90000],
    ["A", 60000, 90000],
    ["handoff_failure", 60000, 90000],
  ] as const) {
    assert.equal(
      runInNewContext(`${inner};cliChildTimeout`, {
        process: { argv: ["node", "-", "fixture", fault] },
        restartEntry: ["restart_cli_entry", "restart_auth_cli_entry"].includes(
          fault,
        ),
      }),
      innerExpected,
    );
    assert.equal(
      runInNewContext(`${outer};hostWorkerTimeout`, {
        publicationFault: fault,
      }),
      outerExpected,
    );
  }
});

/** 診断Observerは元Session・引数・Completionを置き換えず、非秘密の技術fieldだけを読む。
 * @trace ERB-IT-014
 */
test("認証回収診断: 元Sessionを返し非秘密fieldだけを観測する", async () => {
  const begin =
    currentAuthenticationRecoveryCliSource.indexOf("const executorUrl=");
  const end = currentAuthenticationRecoveryCliSource.indexOf(
    "const storeUrl =",
    begin,
  );
  assert.ok(begin > 0 && end > begin);
  const block = currentAuthenticationRecoveryCliSource
    .slice(begin, end)
    .replace(
      "const executor=await import(executorUrl);",
      "const executor=fixtureExecutor;",
    );
  for (const mode of [
    "completed",
    "rejected",
    "threw",
    "duplicate",
    "unknown_key",
    "unknown_observation",
  ] as const) {
    const secret = "PRIVATE_OBSERVER_VALUE_42";
    let resolve: (value: unknown) => void = () => {},
      reject: (error: unknown) => void = () => {};
    const completion = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const execution = { completion, cancel: () => Promise.resolve() };
    const target = {
        resources: {
          resources: [
            "create_egress_network",
            "create_internal_network",
            "create_provider",
            "create_proxy",
            "create_subscription_auth_probe",
          ].map((key) => ({ key })),
        },
      },
      callbacks = {};
    let cleanup: (...args: unknown[]) => unknown = () => {};
    const context = {
      technicalObservation: null as unknown,
      executorMock: null,
      target: { resources: { snapshot: target.resources } },
      fixtureExecutor: {
        cleanupResources: (...args: unknown[]) => {
          assert.equal(args[0], target);
          assert.equal(args[1], callbacks);
          if (mode === "threw") throw Error(secret);
          return execution;
        },
      },
      mock: {
        module: (
          _url: string,
          options: {
            namedExports: { cleanupResources: (...args: unknown[]) => unknown };
          },
        ) => {
          cleanup = options.namedExports.cleanupResources;
          return { restore() {} };
        },
      },
    };
    await runInNewContext(`(async()=>{${block}})()`, context);
    if (mode === "threw") {
      assert.throws(
        () => cleanup(target, callbacks),
        (error) =>
          error instanceof Error
            ? error.message === "fixture_cleanup_construction_failed"
            : String(error).includes("fixture_cleanup_construction_failed"),
      );
      assert.equal(
        JSON.stringify(context.technicalObservation).includes(secret),
        false,
      );
      continue;
    }
    assert.equal(cleanup(target, callbacks), execution);
    if (mode === "rejected") reject(Error(secret));
    else
      resolve({
        failure: {
          reason: "docker_isolation_execution_failed",
          notification: null,
          private: secret,
        },
        processTerminationConfirmed: true,
        cleanup: {
          confirmed: false,
          configCleanupConfirmed: true,
          observations:
            mode === "duplicate"
              ? [
                  { key: "create_provider", observation: "absent" },
                  { key: "create_provider", observation: "absent" },
                ]
              : [
                  {
                    key: mode === "unknown_key" ? secret : "create_provider",
                    observation:
                      mode === "unknown_observation" ? secret : "absent",
                    private: secret,
                  },
                ],
          private: secret,
        },
        private: secret,
      });
    await new Promise(setImmediate);
    assert.deepEqual(
      structuredClone(context.technicalObservation),
      mode === "rejected"
        ? { stage: "completion_rejected" }
        : mode !== "completed"
          ? { stage: "observer_failed" }
          : {
              stage: "completed",
              failureReason: "docker_isolation_execution_failed",
              notification: null,
              processTerminationConfirmed: true,
              cleanupConfirmed: false,
              configCleanupConfirmed: true,
              observations: [{ key: "create_provider", observation: "absent" }],
            },
    );
    assert.equal(
      JSON.stringify(context.technicalObservation).includes(secret),
      false,
    );
  }
});

/** 再入場の拒否判定は非同期の完了を待ち、Docker操作へ進まない。
 * @trace ERB-IT-014
 */
test("回収再入場の拒否: await省略と下位Effect発行を反例で拒否する", async () => {
  const start = currentHostTransitionWorkerSource.indexOf(
    "let rejectedEffects=0;",
  );
  const end = currentHostTransitionWorkerSource.indexOf(
    "assert.equal(recovery.cleanupRuntimeOwnedDockerTaskHost",
    start,
  );
  assert.ok(start > 0 && end > start);
  const block = currentHostTransitionWorkerSource.slice(start, end);
  const run = async (source: string, issueEffect = false) =>
    runInNewContext(`(async()=>{${source}})()`, {
      assert,
      AbortController,
      prepared: { capability: {} },
      recovery: {
        recoverRuntimeOwnedDockerTaskResources: async (
          _capability: unknown,
          cleanup: () => void,
        ) => {
          if (issueEffect) {
            try {
              cleanup();
            } catch {}
          }
          return {
            status: "blocked",
            reason: "docker_task_recovery_owner_unconfirmed",
          };
        },
        executeRuntimeOwnedDockerTaskResourceRecovery: async () => ({
          status: "blocked",
          reason: "docker_task_recovery_owner_unconfirmed",
        }),
      },
    });
  await run(block);
  await assert.rejects(() =>
    run(
      block.replace("const refusedResources=await ", "const refusedResources="),
    ),
  );
  await assert.rejects(() => run(block, true));
});

/** 全子入口の既定拒否とfinally復元を、Processを生成しないspyで確認する。
 * @trace ERB-IT-014
 */
test("全Host子入口: 退役Nativeを含む未知Processを既定拒否する", async () => {
  for (const source of [
    currentHostTransitionWorkerSource,
    currentAuthenticationRecoveryCliSource,
    currentRecoveryCliSource,
  ]) {
    new Script(source);
    assert.ok(source.includes(hostFixtureProcessBoundarySource));
    assert.ok(
      source.indexOf(hostFixtureProcessBoundarySource) <
        source.indexOf("const vc = await import(") ||
        !source.includes("const vc = await import("),
    );
    assert.match(source, /finally\s*\{[\s\S]*restoreHostFixtureProcesses\(\)/u);
  }
  const setup = hostFixtureProcessBoundarySource
    .replace(
      /const boundaryCp=\(await import\('node:child_process'\)\)\.default;/u,
      "const boundaryCp=cp;",
    )
    .replace(
      /const \{syncBuiltinESMExports:boundarySync\}=await import\('node:module'\);/u,
      "const boundarySync=synchronize;",
    )
    .replace(
      /const cliSources=await import\([^;]+\);/u,
      "const cliSources=fixtureCliSources;",
    )
    .replace(/const own=await import\([^;]+\);/u, "const own=fixtureWorker;");
  for (const scenario of [
    "unknown",
    "native",
    "native_options",
    "node_source",
    "normal_child",
    "auth_child",
    "reentry_child",
    "history_child",
  ]) {
    let syncCalls = 0,
      otherCalls = 0,
      synchronizations = 0;
    const syncRequests: unknown[][] = [];
    const sync = (...args: unknown[]) => {
      syncCalls++;
      syncRequests.push(args);
      return { status: 0 };
    };
    const other = () => {
      otherCalls++;
      throw Error("real_process_forbidden");
    };
    const cp = {
      spawn: other,
      spawnSync: sync,
      exec: other,
      execSync: other,
      execFile: other,
      execFileSync: other,
      fork: other,
    };
    const originals = { ...cp };
    const context = {
      cp,
      path,
      fixtureCliSources: {
        currentRecoveryCliSource: "normal",
        currentAuthenticationRecoveryCliSource: "auth",
      },
      fixtureWorker: { currentHostTransitionWorkerSource: "worker" },
      fs: {
        readFileSync: () =>
          JSON.stringify({
            operations: [
              { recoveryId: "fixture", resources: { fixture: true } },
            ],
          }),
      },
      process: { cwd: () => "C:\\fixture", execPath: "C:\\node.exe" },
      synchronize: () => {
        synchronizations++;
      },
      assert: {
        ...assert,
        deepEqual: (actual: unknown, expected: unknown) =>
          assert.deepEqual(structuredClone(actual), structuredClone(expected)),
      },
    };
    const reentryMode =
      scenario === "reentry_child"
        ? "recover_cleanup"
        : scenario === "history_child"
          ? "recover_history"
          : null;
    const childArguments = reentryMode
      ? [
          "-",
          "fixture",
          reentryMode,
          "history_pending",
          JSON.stringify({ fixture: true }),
        ]
      : ["--experimental-test-module-mocks", "-", "fixture"];
    const childInput = reentryMode
      ? "worker"
      : scenario === "auth_child"
        ? "auth"
        : "normal";
    const childTimeout = reentryMode ? 60000 : 120000;
    const stimulus =
      scenario === "native"
        ? "assert.throws(()=>cp.spawnSync('retired-native.exe',['--system-windows-directory'],{shell:false}));"
        : scenario === "native_options"
          ? "for(const change of [{env:{EXTRA:'1'}},{cwd:'C:\\\\other'},{encoding:'utf8'},{timeout:5001},{extra:true}])assert.throws(()=>cp.spawnSync('retired-native.exe',['--system-windows-directory'],{shell:false,...change}));"
          : scenario === "node_source"
            ? "await assert.rejects(()=>launchHostFixture(['unexpected'],'unexpected',60000));await assert.rejects(()=>launchHostFixture(['-','fixture','recover_cleanup','A','{}'],'worker',60000));await assert.rejects(()=>launchHostFixture(['--experimental-test-module-mocks','-','fixture'],'foreign',60000));"
            : scenario.endsWith("_child")
              ? `await launchHostFixture(${JSON.stringify(childArguments)},${JSON.stringify(childInput)},${childTimeout});`
              : "for(const key of Object.keys(boundaryOriginal))assert.throws(()=>cp[key]('docker',['version'],{shell:false}));assert.throws(()=>cp.spawnSync('git',['status'],{}));assert.throws(()=>cp.spawnSync('unexpected.exe',[],{}));";
    await runInNewContext(
      `(async()=>{${setup}try{${stimulus}}finally{${scenario === "unknown" || scenario === "native" || scenario === "native_options" ? "assert.throws(()=>restoreHostFixtureProcesses());" : "restoreHostFixtureProcesses();"}}})()`,
      context,
    );
    for (const key of Object.keys(originals) as (keyof typeof originals)[])
      assert.equal(cp[key], originals[key]);
    if (scenario.endsWith("_child"))
      assert.deepEqual(structuredClone(syncRequests), [
        [
          "C:\\node.exe",
          childArguments,
          {
            input: childInput,
            cwd: "C:\\fixture",
            encoding: "utf8",
            timeout: childTimeout,
            windowsHide: true,
          },
        ],
      ]);
    assert.equal(syncCalls, scenario.endsWith("_child") ? 1 : 0);
    assert.equal(otherCalls, 0);
    assert.equal(synchronizations, 2);
  }
});

/** 通常CLIと直接回収が共有する四応答を、Daemonなしで全数照合する。
 * @trace ERB-IT-014
 */
test("保存済み不存在の代役: 四応答・終了・未知要求拒否を確認する", async () => {
  const dockerExe =
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
  const identity = {
    hostPaths: { root: "C:\\fixture\\host" },
    ownershipLabel: "crdd.coordinator.runtime=fixture",
  };
  const resource = {
    key: "create_subscription_auth_probe",
    request: "issued",
    identity: { name: "crdd-fixture-auth", dockerId: "a".repeat(64) },
  };
  const state = {
    operations: [
      {
        recoveryId: "fixture",
        identityJson: JSON.stringify(identity),
        resources: {
          snapshot: { resources: [resource] },
          checkpoints: [{ key: resource.key, observation: "absent" }],
        },
      },
    ],
  };
  const commands = [
    ["version", "--format", "{{.Server.Os}}"],
    [
      "container",
      "ls",
      "--all",
      "--no-trunc",
      "--filter",
      `id=${resource.identity.dockerId}`,
      "--format",
      "{{.ID}}",
    ],
    [
      "container",
      "ls",
      "--all",
      "--no-trunc",
      "--filter",
      `name=^/${resource.identity.name}$`,
      "--format",
      "{{.ID}}",
    ],
    [
      "container",
      "ls",
      "--all",
      "--no-trunc",
      "--filter",
      `label=${identity.ownershipLabel}`,
      "--format",
      "{{.ID}}",
    ],
  ];
  for (const bad of [false, true]) {
    let removed = false,
      realCalls = 0;
    const cp = {
      ChildProcess: childProcess.ChildProcess,
      spawn: () => {
        realCalls++;
        throw Error("real_async_forbidden");
      },
      spawnSync: () => {
        throw Error("default_sync_denied");
      },
    };
    const context = {
      assert: {
        ...assert,
        deepEqual: (actual: unknown, expected: unknown) =>
          assert.deepEqual(structuredClone(actual), structuredClone(expected)),
      },
      boundaryCp: cp,
      boundarySync: () => {},
      PassThrough,
      queueMicrotask,
      setImmediate,
      path,
      process: {
        argv: ["node", "-", "fixture"],
        cwd: () => "C:\\fixture",
        env: { SystemRoot: "C:\\Windows" },
      },
      fs: {
        readFileSync: () => JSON.stringify(state),
        readdirSync: () => [],
        lstatSync: () => {
          if (removed) throw Object.assign(Error("absent"), { code: "ENOENT" });
          return {
            dev: 1n,
            ino: 2n,
            birthtimeNs: 3n,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          };
        },
      },
    };
    const source = savedAbsenceProcessProfileSource.replace(
      "const {PassThrough}=await import('node:stream');",
      "",
    );
    const profile = await runInNewContext(source, context);
    const argv = [
      "--host",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "--config",
      "C:\\fixture\\host\\management\\docker-cli-config",
    ];
    const options = {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: "C:\\Windows\\System32",
      env: { HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "" },
    };
    const firstCommand = commands[0];
    assert.ok(firstCommand);
    if (bad) {
      assert.throws(() =>
        Reflect.apply(cp.spawnSync, cp, [
          dockerExe,
          [...argv, ...firstCommand],
          options,
        ]),
      );
      assert.throws(() =>
        Reflect.apply(cp.spawn, cp, [
          dockerExe,
          [...argv, ...firstCommand],
          {
            shell: false,
            windowsHide: true,
            timeout: 10000,
            maxBuffer: 1048576,
          },
        ]),
      );
      assert.throws(() =>
        Reflect.apply(cp.spawn, cp, [
          dockerExe,
          [
            ...argv.slice(0, 3),
            "D:\\outside\\docker-cli-config",
            ...firstCommand,
          ],
          options,
        ]),
      );
    }
    // Authenticodeの固定応答も実PowerShellへ発行しない。
    const script = [
      "$ErrorActionPreference='Stop'",
      `$signature=Get-AuthenticodeSignature -LiteralPath '${dockerExe}'`,
      "$certificate=$signature.SignerCertificate",
      "if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=Docker Inc(?:,|$)')){exit 2}",
      "Write-Output 'CRDD_DOCKER_AUTHENTICODE_OK'",
    ].join(";");
    Reflect.apply(cp.spawnSync, cp, [
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      {},
    ]);
    for (const command of commands) {
      const child = Reflect.apply(cp.spawn, cp, [
        dockerExe,
        [...argv, ...command],
        options,
      ]);
      child.stdout.resume();
      child.stderr.resume();
      await new Promise((resolve) => child.once("close", resolve));
    }
    await profile.settle();
    removed = true;
    if (bad) assert.throws(() => profile.assertComplete());
    else profile.assertComplete();
    assert.equal(realCalls, 0);
  }
});

/**
 * 実Hostを現在Repositoryへ結合して非秘密の試験Identityを構成する。
 * @responsibility Fixtureでも実Ownerと実Root／markerの相関を使用する。
 * @trace ERB-IT-014
 * @precondition ownedは同じ自己生成Repositoryのtests領域にある。
 * @stimulus 実Host、Repository Rootと独立した二操作のnonceを渡す。
 * @observation 元Owner、Repository結合とHost snapshotを返す。
 * @oracle HashやPathだけでOwnerを代用せず、実binding APIだけを使う。
 * @cleanup 返却Ownerの解放と物理清掃はCaseが所有する。
 * @boundary ERB-IT-014=Related 2 Blocks: Fixture→実Host／Repository結合。
 */
function fixtureOperation(
  owned: ReturnType<typeof createOwnedOperationDirectories>,
  root: string,
) {
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  assert.ok(bindRuntimeOwnedRepositoryOperation(management, root));
  const repository = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(repository);
  const host = borrowOwnedHostRecoverySnapshot(management).snapshot;
  const nonce = randomBytes(32).toString("hex"),
    suffix = nonce.slice(0, 16);
  return {
    management,
    repository,
    identity: {
      schema: "crdd-coordinator/operation-identity/v4",
      operationNonce: nonce,
      provider: "claude",
      consumer: "coordinator_cli",
      operationId: repository.operationId,
      grantRef: "PHMGRANT-FIXTURE",
      executionSelection: executionSelection("executor", {
        provider: "claude",
        model: "opus",
        effort: "medium",
      }),
      taskAttempt: 0,
      stableLogicalHomeBindingHash: randomBytes(32).toString("hex"),
      providerHomeIdentityHash: "8".repeat(64),
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
      operationMode: "isolated_task",
      workspaceMountMode: "read_only",
      initialHostRecoveryId: host.token,
      initialHostRecovery: host,
      hostPaths: {
        root: owned.root,
        marker: loadHostRecoveryRecordByToken(host.token, owned.root).marker,
      },
    },
  };
}

/**
 * 生成子本文の技術代役を実装Ownerへ接続する。
 * @responsibility 旧公開入口への無効なmock注入の再発を拒否する。
 * @trace ERB-IT-014
 * @precondition 固定fixtureの生成済み本文だけを使う。
 * @stimulus 両子本文を構文検査し、接続Moduleと復元を照合する。
 * @observation 構文、Module URL、技術keyと復元呼出し。
 * @oracle 実装Owner接続だけを受理し旧Rootと旧関数名を拒否する。
 * @cleanup N/A: 本文を実行せず実資源を生成しない。
 * @boundary 静的接続だけ。実Host・Dockerの成立は証明しない。
 */
test("回収子の技術代役は現行Moduleへ接続し旧Rootへ注入しない", () => {
  for (const source of [
    currentAuthenticationRecoveryCliSource,
    currentHostTransitionWorkerSource,
  ]) {
    assert.doesNotThrow(() => new Script(source));
    assert.match(source, /docker-isolation\/src\/docker-desktop\/restart\.ts/u);
    assert.doesNotMatch(source, /docker-isolation\/src\/index\.ts/u);
    assert.doesNotMatch(source, /createDockerTaskRecoveryExecutor/u);
    assert.doesNotMatch(source, /--host-terminal-/u);
    assert.doesNotMatch(source, /--system-windows-directory/u);
    assert.doesNotMatch(source, /--host-recovery-namespace-/u);
    assert.doesNotMatch(source, /--local-app-data-directory/u);
  }
  assert.match(
    currentAuthenticationRecoveryCliSource,
    /docker-isolation\/src\/cleanup\/execute\.ts/u,
  );
  assert.ok(
    currentAuthenticationRecoveryCliSource.includes(
      "assert.deepEqual(expectation,{kind:'container',expectedName:authResource.identity.name,ownershipLabel:identity.ownershipLabel})",
    ),
  );
  assert.match(
    currentAuthenticationRecoveryCliSource,
    /recoveryMock\?\.restore\(\)/u,
  );
  assert.match(
    currentAuthenticationRecoveryCliSource,
    /restartMock\?\.restore\(\)/u,
  );
});

/**
 * 二つの実workerのProcess代役を、OS子を作らず閉じた入力で反証する。
 * @trace ERB-IT-014
 * @precondition 元Process入口はspyに置換し、File観測はメモリ値だけを返す。
 * @stimulus 未知同期・非同期、二つのNative mode、既知captured列と途中throw。
 * @observation 元入口の到達数、実DI開始関数の返却、模擬子のイベント・stream終端と復元。
 * @oracle Native同期の許可2形以外は元入口0、既知列だけ正規終了しthrow後も両入口を復元する。
 * @cleanup Builtinをfinallyで復元し、模擬streamだけをdestroyする。
 * @boundary 実Process・Docker・Native・Filesystem操作は行わない。
 */
test("Docker代役は同期・非同期の未知要求を発行前に拒否し終了と復元を確認する", {
  timeout: 10_000,
}, async () => {
  for (const [source, authentication] of [
    [currentHostTransitionWorkerSource, false],
    [currentAuthenticationRecoveryCliSource, true],
  ] as const) {
    const begin = source.indexOf("const classify = function(");
    const end = source.indexOf("syncBuiltinESMExports();", begin);
    const restoreBegin = source.lastIndexOf("cp.spawnSync = originalSpawn;");
    const restoreEnd =
      source.indexOf("syncBuiltinESMExports();", restoreBegin) +
      "syncBuiltinESMExports();".length;
    assert.ok(begin > 0 && end > begin && restoreBegin > end);
    const setup = source.slice(begin, end);
    const restore = source.slice(restoreBegin, restoreEnd);
    assert.match(setup, /cp\.spawn = function/u);
    assert.doesNotMatch(setup, /originalAsyncSpawn\s*\(/u);
    assert.match(restore, /cp\.spawn = originalAsyncSpawn/u);
    for (const scenario of [
      "unknown_sync",
      "unknown_async",
      "native",
      "wrong_channel",
      "native_options",
      "secret_diagnostic",
      "captured",
      "throw",
    ] as const) {
      let originalAsyncCalls = 0,
        originalSyncCalls = 0,
        synchronizations = 0;
      const originalAsync = () => {
        originalAsyncCalls++;
        throw Error("real_async_forbidden");
      };
      const originalSync = () => {
        originalSyncCalls++;
        return {
          pid: 1,
          status: 0,
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
          signal: null,
          output: [null, Buffer.alloc(0), Buffer.alloc(0)],
        };
      };
      const dockerExe =
        "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
      const nativeExe = "C:\\fixture\\crdd-platform-access.exe";
      const ownershipLabel = "crdd.coordinator.runtime=0123456789abcdef";
      const dockerId = "c".repeat(64);
      const providerName = "crdd-fixture-create-provider",
        authName = "crdd-fixture-auth";
      const listed = [
        "container",
        "ls",
        "--all",
        "--no-trunc",
        "--filter",
        `name=^/${authName}$`,
      ];
      const name = [...listed, "--format", "{{.ID}}"],
        labelled = [
          ...listed,
          "--filter",
          `label=${ownershipLabel}`,
          "--format",
          "{{.ID}}",
        ];
      const expectedCommands = [
        ["version", "--format", "{{.Server.Os}}"],
        ["container", "inspect", dockerId],
        ["container", "rm", "--force", dockerId],
        [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ],
        [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `name=^/${providerName}$`,
          "--format",
          "{{.ID}}",
        ],
        [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `label=${ownershipLabel}`,
          "--format",
          "{{.ID}}",
        ],
      ];
      const asyncCommands = [
        ["version", "--format", "{{.Server.Os}}"],
        name,
        labelled,
        ["container", "inspect", authName],
        [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `label=${ownershipLabel}`,
          "--format",
          "{{.ID}}",
        ],
      ];
      const stored = {
        snapshot: {
          resources: [
            {
              key: "create_provider",
              request: "issued",
              identity: { dockerId },
            },
          ],
        },
        checkpoints: [
          {
            key: "create_provider",
            submission: "intent_saved",
            receiptSource: "docker_create_result",
          },
        ],
      };
      const context = {
        secretInput: "PRIVATE_FIXTURE_TOKEN_73e2",
        capturedErrors: [] as { message: string; stderr: string }[],
        console: {
          error: (error: Error) =>
            context.capturedErrors.push({
              message: error.message,
              stderr: String(error.stack),
            }),
        },
        cp: {
          ChildProcess: childProcess.ChildProcess,
          spawn: originalAsync,
          spawnSync: originalSync,
        },
        originalSpawn: originalSync,
        originalAsyncSpawn: originalAsync,
        PassThrough,
        assert: {
          ...assert,
          deepEqual: (actual: unknown, expected: unknown) =>
            assert.deepEqual(
              structuredClone(actual),
              structuredClone(expected),
            ),
        },
        path,
        queueMicrotask,
        setImmediate,
        process: {
          env: { SystemRoot: "C:\\Windows" },
          cwd: () => "C:\\fixture",
        },
        syncBuiltinESMExports: () => {
          synchronizations++;
        },
        fs: {
          lstatSync: () => ({
            dev: 1n,
            ino: 2n,
            birthtimeNs: 3n,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          }),
          readdirSync: () => [],
          readFileSync: () =>
            JSON.stringify({
              operations: [{ recoveryId: "fixture", resources: stored }],
            }),
        },
        dockerExe,
        nativeExe,
        nativeModes: ["--system-windows-directory"],
        dockerId,
        identity: {
          ownershipLabel,
          hostPaths: { root: "C:\\fixture\\host" },
          workspaceMountMode: "read_only",
        },
        authResource: { identity: { name: authName } },
        resourceNames: {
          create_provider: providerName,
          create_internal_network: "crdd-fixture-network",
        },
        selected: { configuration: { image: null } },
        resolvedId: "fixture",
        expectedCommands,
        commands: [name, labelled, name, labelled],
        asyncCommands,
        calls: 0,
        asyncCalls: 0,
        trustCalls: 0,
        violations: 0,
        failureSites: [],
        violation: false,
        saves: 0,
        removalCalls: 0,
        config: null,
        configIdentity: null,
        asyncConfig: null,
        asyncConfigIdentity: null,
        syntheticChildren: [],
      };
      const run = (body: string) => runInNewContext(body, context);
      const realAsync = childProcess.spawn,
        realSync = childProcess.spawnSync;
      try {
        run(`${setup}\nsyncBuiltinESMExports();`);
        if (scenario === "unknown_sync") {
          assert.throws(() =>
            run(
              "cp.spawnSync('unexpected.exe',[],{shell:false,windowsHide:true});",
            ),
          );
          assert.throws(() =>
            run(
              "cp.spawnSync(nativeExe,['--docker-desktop-repair'],{shell:false,windowsHide:true});",
            ),
          );
        } else if (scenario === "unknown_async") {
          assert.throws(() => run("cp.spawn('unexpected.exe',[],{});"));
          assert.throws(() => run("cp.spawn(dockerExe,['unexpected'],{});"));
          assert.throws(() =>
            run("cp.spawn(nativeExe,['--system-windows-directory'],{});"),
          );
        } else if (scenario === "native") {
          assert.throws(() =>
            run(
              "for(const mode of nativeModes)cp.spawnSync(nativeExe,[mode],{env:{},cwd:path.resolve(path.dirname(nativeExe),'../../../..'),shell:false,windowsHide:true,timeout:5000,maxBuffer:65548,encoding:'buffer'});",
            ),
          );
          assert.equal(originalSyncCalls, 0);
        } else if (scenario === "native_options") {
          run(
            "for(const change of [{cwd:'C:\\\\unexpected'},{env:{EXTRA:'1'}},{encoding:'utf8'},{timeout:5001},{extra:true}])assert.throws(()=>cp.spawnSync(nativeExe,[nativeModes[0]],{env:{},cwd:path.resolve(path.dirname(nativeExe),'../../../..'),shell:false,windowsHide:true,timeout:5000,maxBuffer:65548,encoding:'buffer',...change}));",
          );
        } else if (scenario === "secret_diagnostic") {
          run(
            "try{cp.spawn(dockerExe,[secretInput],{env:{TOKEN:secretInput}})}catch(error){console.error(error)}",
          );
          assert.equal(context.capturedErrors.length, 1);
          const captured = context.capturedErrors[0];
          assert.ok(captured);
          assert.equal(captured.stderr.includes(context.secretInput), false);
          assert.ok(
            captured.message.startsWith("host_fixture_classifier_rejected:"),
          );
          const diagnostic = JSON.parse(
            captured.message.slice("host_fixture_classifier_rejected:".length),
          );
          assert.deepEqual(Object.keys(diagnostic).sort(), [
            "channel",
            "index",
            "site",
          ]);
          assert.equal(diagnostic.channel, "async");
          assert.equal(diagnostic.index, 0);
        } else if (scenario === "wrong_channel") {
          run(
            "const argv=['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config','C:\\\\fixture\\\\host\\\\management\\\\docker-cli-config','version','--format','{{.Server.Os}}'];assert.throws(()=>cp.spawnSync(dockerExe,argv,{shell:false,windowsHide:true,cwd:'C:\\\\Windows\\\\System32',stdio:['ignore','pipe','pipe'],env:{}}));assert.throws(()=>cp.spawn(dockerExe,argv,{shell:false,windowsHide:true,timeout:10000,maxBuffer:1048576}));",
          );
        } else if (scenario === "throw") {
          assert.throws(() =>
            run("throw new Error('fixture_recovery_failed');"),
          );
        } else {
          childProcess.spawn = context.cp.spawn as typeof childProcess.spawn;
          childProcess.spawnSync = context.cp
            .spawnSync as unknown as typeof childProcess.spawnSync;
          syncBuiltinESMExports();
          const config = "C:\\fixture\\host\\management\\docker-cli-config";
          const options = { workingDirectory: "C:\\Windows\\System32" };
          const handle = startOwnedWindowsProcess(
            dockerExe,
            [
              "--host",
              "npipe:////./pipe/dockerDesktopLinuxEngine",
              "--config",
              config,
              "version",
              "--format",
              "{{.Server.Os}}",
            ],
            { HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "" },
            null,
            options,
          );
          const result = await handle.wait(1_000);
          assert.ok(result);
          assert.equal(result.status, 0);
          assert.equal(result.stdout, "linux\n");
          assert.equal(handle.closed(), true);
          context.process.env.SystemRoot = "C:\\Windows";
          await run(
            `(async()=>{const cmds=${authentication ? "asyncCommands" : "expectedCommands"};for(const argv of cmds.slice(1)){const child=cp.spawn(dockerExe,['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config','C:\\\\fixture\\\\host\\\\management\\\\docker-cli-config',...argv],{shell:false,windowsHide:true,cwd:'C:\\\\Windows\\\\System32',stdio:['ignore','pipe','pipe'],env:{HTTP_PROXY:'',HTTPS_PROXY:'',ALL_PROXY:''}});const events=[];child.once('spawn',()=>events.push('spawn'));child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});child.stdout.once('end',()=>events.push('stdout_end'));child.stderr.once('end',()=>events.push('stderr_end'));child.once('exit',()=>events.push('exit'));await new Promise(resolve=>child.once('close',()=>{events.push('close');resolve();}));assert.deepEqual(events,['spawn','stdout_end','stderr_end','exit','close']);} ${authentication ? "for(const argv of commands)cp.spawnSync(dockerExe,['--host','npipe:////./pipe/dockerDesktopLinuxEngine','--config','C:\\\\fixture\\\\host\\\\management\\\\docker-recovery-config-fixture',...argv],{shell:false,windowsHide:true,timeout:10000,maxBuffer:1048576});" : ""}})();`,
          );
          assert.equal(
            authentication ? context.asyncCalls : context.calls,
            authentication ? asyncCommands.length : expectedCommands.length,
          );
          if (authentication)
            assert.equal(context.calls, context.commands.length);
        }
      } finally {
        childProcess.spawn = realAsync;
        childProcess.spawnSync = realSync;
        syncBuiltinESMExports();
        run(restore);
        await run("Promise.all(syntheticChildren.map(item=>item.done))");
        run(
          "for(const item of syntheticChildren){assert.deepEqual([item.spawn,item.exit,item.close],[1,1,1]);assert.equal(item.child.stdout.readableEnded,true);assert.equal(item.child.stderr.readableEnded,true);item.child.stdout.destroy();item.child.stderr.destroy();}",
        );
        assert.equal(context.cp.spawn, originalAsync);
        assert.equal(context.cp.spawnSync, originalSync);
      }
      assert.equal(synchronizations, 2);
      assert.equal(originalAsyncCalls, 0);
      assert.equal(originalSyncCalls, 0);
    }
  }
});

/**
 * 引渡し前例外の省略を同じ捕捉Oracleで拒否する。
 * @responsibility 例外未発生でもfinallyへ到達する反例を区別する。
 * @trace PRL-IT-013
 * @precondition 実Workerの固定try／catchを抽出する。
 * @stimulus 固定throwを省略したメモリ変異を与える。
 * @observation 捕捉件数と引渡し件数。
 * @oracle throw省略は同じ捕捉件数Oracleを満たさない。
 * @cleanup N/A: メモリ内評価だけ。
 * @boundary 物理回収は実Host正例が所有する。
 */
test("引渡し前失敗: throw省略を同じ捕捉Oracleで拒否する", () => {
  const start = currentHostTransitionWorkerSource.indexOf(
    "let failureReached = 0",
  );
  const end = currentHostTransitionWorkerSource.indexOf("} finally {", start);
  assert.ok(start >= 0 && end > start);
  const block = `${currentHostTransitionWorkerSource.slice(start, end)}}`;
  const fixedThrow =
    "throw new Error('current_fixture_handoff_before_output');";
  assert.equal(block.split(fixedThrow).length, 2);
  const oracle =
    "assert.equal(failureReached, 1); assert.equal(handoffWrites, 0);";
  assert.equal(currentHostTransitionWorkerSource.split(oracle).length, 2);
  const context = {
    assert,
    handoffFailure: true,
    process: { stdout: { write: () => true } },
  };
  runInNewContext(`(() => {${block}\n${oracle}})()`, context);
  assert.throws(
    () =>
      runInNewContext(
        `(() => {${block.replace(fixedThrow, "")}\n${oracle}})()`,
        context,
      ),
    { code: "ERR_ASSERTION" },
  );
});

/**
 * 再起動直後の兄弟実体比較を、本文差と比較省略で反証する。
 * @responsibility 最終CLI結果だけで中間時点の保全を推定しない。
 * @trace ERB-IT-014
 * @precondition 実Workerの比較関数と二呼出し位置を一意に抽出する。
 * @stimulus marker本文だけを変更し、比較assert省略も与える。
 * @observation 同じ実比較本文の成功・断言失敗とCLI前の二回到達位置。
 * @oracle 正常だけ成功し、変更本文は比較省略時だけ検出できなくなる。
 * @cleanup N/A: VM内のFile観測代役だけで物理変更なし。
 * @boundary 比較Oracleの局所反証。実Host保全は別のHost試験が所有する。
 */
test("再起動後の兄弟Host比較は本文変更と比較省略を区別する", () => {
  const start = currentHostTransitionWorkerSource.indexOf(
    "function assertRestartSiblingPhysical() {",
  );
  const end = currentHostTransitionWorkerSource.indexOf(
    "        const completed =",
    start,
  );
  assert.ok(start > 0 && end > start);
  const body = currentHostTransitionWorkerSource.slice(start, end);
  const beforeCli = currentHostTransitionWorkerSource.indexOf(
    "      if(process.argv[3].startsWith('cli_entry_')",
  );
  const calls = [
    ...currentHostTransitionWorkerSource.matchAll(
      / {8}assertRestartSiblingPhysical\(\);/gu,
    ),
  ].map((match) => match.index);
  assert.equal(calls.length, 2);
  assert.ok(calls[0] !== undefined && calls[1] !== undefined);
  assert.ok(calls[0] > end && calls[1] > calls[0] && calls[1] < beforeCli);
  const orderOracle = `const calls = [...source.matchAll(/ {8}assertRestartSiblingPhysical\\(\\);/gu)].map(match => match.index);
    assert.equal(calls.length,2);
    const steps = [source.indexOf("assert.equal(completed.status,'completed');"),calls[0],source.indexOf('const repeated = await restart.restartRuntimeOwnedDockerForRecovery('),source.indexOf("assert.equal(repeated.status,'blocked');"),calls[1],source.indexOf("      if(process.argv[3].startsWith('cli_entry_')")];
    assert.ok(steps.every((position,index) => Number.isInteger(position) && position >= 0 && (index === 0 || position > steps[index-1])));`;
  runInNewContext(orderOracle, {
    assert,
    source: currentHostTransitionWorkerSource,
  });
  const comparison = "        assertRestartSiblingPhysical();";
  const moved = currentHostTransitionWorkerSource
    .replace(comparison, "")
    .replace(comparison, `${comparison}\n${comparison}`);
  assert.throws(() => runInNewContext(orderOracle, { assert, source: moved }), {
    code: "ERR_ASSERTION",
  });
  const assertion = body.match(/ {12}assert\.deepEqual\([^\n]+/u)?.[0];
  assert.ok(assertion);
  for (const changed of [false, true]) {
    const context = {
      assert,
      Buffer,
      fs: {
        lstatSync: () => ({
          dev: 1n,
          ino: 2n,
          birthtimeNs: 3n,
          isFile: () => true,
          isDirectory: () => false,
        }),
        readFileSync: () => Buffer.from(changed ? "after" : "before"),
      },
    };
    const source = `(() => {const restartSiblingPhysical = [{file:'marker',dev:1n,ino:2n,birthtimeNs:3n,bytes:Buffer.from('before'),children:null}];\n${body}\nassertRestartSiblingPhysical();})();`;
    if (changed)
      assert.throws(() => runInNewContext(source, context), {
        code: "ERR_ASSERTION",
      });
    else runInNewContext(source, context);
    runInNewContext(source.replace(assertion, ""), context);
  }
});

/**
 * 実意図保存・Host遷移・token確定を同じ実Snapshotへ接続する。
 * @responsibility 遷移・Host清掃各二版と解放後終端一版の完全期待値、元結果保持、再処置0と全自己生成物清掃を確認する。
 * @trace ERB-IT-014
 * @precondition Windows実Kernel排他と自己生成Git Repositoryだけを使う。
 * @stimulus 正規開始・disabled Ownerの新回収、同cap再実行とfresh settled再入場、結果引渡し前の失敗を行う。
 * 再起動結果の代役を使う条件では公開組立ての保存後に別Process通常CLIへ接続する。auth形は模擬二回不存在と専用実Writerを通す。実再起動は対象外。
 * @observation 遷移・清掃各二回のstate公開本文、改訂／元版Hash、実marker、他操作と元結果。
 * @oracle 親子の独立予定tokenと全本文が一致し、遷移・清掃は各保存二回、終端は全解放後一回だけ。既存結果・一次失敗は保持し、結果欠測は固定blockedとする。
 * @cleanup 子が全準備を解放後にexact Hostを回収し、親は不存在確認後だけ試験Repositoryを削除する。
 * @boundary ERB-IT-014=Related 2 Blocks: 別Process現在回収→実Host／状態Writer。実Docker・競合CAS・pending旧／予定再入場は対象外。
 */
for (const publicationFault of [
  "none",
  "null_outcome",
  "A",
  "B",
  "C",
  "history_checkpoint_pending",
  "history_checkpoint_published",
  "history_pending",
  "history_published",
  "history_confirm_pending",
  "history_confirm_published",
  "workbench_transient",
  "driver",
  "completion_cli",
  "completion_workbench",
  "completion_pending",
  "completion_readback",
  "cli_entry_cli",
  "cli_entry_workbench",
  "cli_entry_orchestrator",
  "cli_entry_orchestrator_identified",
  "handoff_failure",
  "restart_cli_entry",
  "restart_auth_cli_entry",
] as const) {
  /**
   * 実意図保存・Host遷移・token確定を同じ実Snapshotへ接続する。
   * @responsibility 遷移・Host清掃各二版と解放後終端一版の完全期待値、元結果保持、再処置0と全自己生成物清掃を確認する。
   * @trace ERB-IT-014
   * @precondition Windows実Kernel排他と自己生成Git Repositoryだけを使う。
   * @stimulus 正規開始・disabled Ownerの新回収、同cap再実行とfresh settled再入場、結果引渡し前の失敗を行う。
   * 再起動結果の代役を使う条件では公開組立ての保存後に別Process通常CLIへ接続する。auth形は模擬二回不存在と専用実Writerを通す。実再起動は対象外。
   * @observation 遷移・清掃各二回のstate公開本文、改訂／元版Hash、実marker、他操作と元結果。
   * @oracle 親子の独立予定tokenと全本文が一致し、遷移・清掃は各保存二回、終端は全解放後一回だけ。既存結果・一次失敗は保持し、結果欠測は固定blockedとする。
   * @cleanup 子が全準備を解放後にexact Hostを回収し、親は不存在確認後だけ試験Repositoryを削除する。
   * @boundary ERB-IT-014=Related 2 Blocks: 別Process現在回収→実Host／状態Writer。実Docker・競合CAS・pending旧／予定再入場は対象外。
   */
  test(`Host Windows: 現在Host遷移と清掃の実保存・出版再入場 ${publicationFault}`, async (t) => {
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "host_transition_test",
    );
    const root = fs.mkdtempSync(
      path.join(area.directory, `current-host-transition-${process.pid}-`),
    );
    const rootIdentity = fs.lstatSync(root, { bigint: true });
    const localAppData = path.join(root, "local-app-data");
    for (const name of ["ProviderHomes", "RuntimeState"]) {
      const directory = path.join(localAppData, "Qual-Lab", "CRDD", name);
      fs.mkdirSync(directory, { recursive: true });
      assert.equal(fs.realpathSync.native(directory), directory);
      assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    }
    let otherOwned: ReturnType<typeof createOwnedOperationDirectories> | null =
      null;
    let targetOwned: ReturnType<typeof createOwnedOperationDirectories> | null =
      null;
    let targetManagement: object | null = null;
    let abandoned = false,
      targetStarted = false,
      cleanupConfirmed = false;
    try {
      prepareHostFixtureRepository(root);
      const hosts = requireReadyRepositoryExecutionDataArea(
        ensureRepositoryExecutionDataAreaFromWorkingDirectory(root, "tests"),
        "host_fixture",
      );
      otherOwned = createOwnedOperationDirectories(hosts.directory);
      targetOwned = createOwnedOperationDirectories(hosts.directory);
      const other = fixtureOperation(otherOwned, root),
        target = fixtureOperation(targetOwned, root);
      const otherPhysical = [
        other.identity.hostPaths.root,
        other.identity.hostPaths.marker,
      ].map((file) => {
        const info = fs.lstatSync(file, { bigint: true });
        return {
          file,
          dev: info.dev,
          ino: info.ino,
          birthtimeNs: info.birthtimeNs,
          bytes: info.isFile() ? fs.readFileSync(file) : null,
          children: info.isDirectory() ? fs.readdirSync(file).sort() : null,
        };
      });
      if (publicationFault.startsWith("cli_entry_orchestrator"))
        target.identity.consumer = "orchestrator";
      if (publicationFault.startsWith("cli_entry_orchestrator"))
        Object.assign(target.identity, {
          recoveryCorrelationId: "upper-current-host",
        });
      if (
        publicationFault === "workbench_transient" ||
        publicationFault === "completion_workbench" ||
        publicationFault === "cli_entry_workbench"
      )
        target.identity.consumer = "workbench";
      targetManagement = target.management;
      const initial = Buffer.from(
        `${canonicalJson({ schema: "crdd-execution-model/state/v4", revision: 1, previous: null, repositoryBinding: target.repository.repositoryBinding, repositoryBindingId: null, intakeEpoch: null, projects: [], managedExecutions: [], queueEntries: [], workspaces: [], intakeBindings: [], leaseEvidence: [], leaseIntents: [], results: [], historyPending: [], decisions: [], blockers: [], operations: [], unresolvedRecoveries: [] })}\n`,
      );
      // Host故障の前提値だけを配置する。初期Writerの保証はDomainの実保存試験が所有する。
      const snapshotArea = requireReadyRepositoryExecutionDataArea(
        ensureRepositoryExecutionDataAreaFromWorkingDirectory(
          root,
          "domain-model",
        ),
        "fixture_snapshot_area",
      );
      fs.writeFileSync(
        path.join(snapshotArea.directory, "state.json"),
        initial,
        { flag: "wx" },
      );
      const seeded = readOperationStateStage(target.management);
      assert.equal(seeded.status, "completed", seeded.reason);
      assert.equal(
        saveOperationStart(
          other.management,
          `${JSON.stringify(other.identity)}\n`,
          () => null,
        ).status,
        "completed",
      );
      const started = saveOperationStart(
        target.management,
        `${JSON.stringify(target.identity)}\n`,
        () => null,
      );
      assert.equal(started.status, "completed");
      assert.ok(started.recoveryId);
      assert.equal(
        await activateOwnedHostOperationGenerationLock(target.management),
        "activated",
      );
      const submission = beginRuntimeOwnedCoordinatorHostSubmission(
        target.management,
        started.recoveryId,
      );
      assert.equal(submission.status, "completed");
      assert.equal(submission.hostTransitionConfirmed, true);
      targetStarted = true;
      const current = readOperationStateStage(target.management);
      const operation = current.value?.snapshot.operations.find(
        (item) => item.recoveryId === started.recoveryId,
      );
      assert.ok(operation && operation.kind === "docker_task");
      const rawPlan = createResourceBookFixture(
        JSON.parse(operation.identityJson).ownershipLabel,
        "planned",
        [
          "create_egress_network",
          "create_internal_network",
          "create_provider",
          "create_proxy",
          "create_subscription_auth_probe",
        ],
      );
      const planned = {
        ...rawPlan,
        snapshot: {
          resources: rawPlan.snapshot.resources.map((resource) => ({
            ...resource,
            identity: {
              ...resource.identity,
              name: resource.identity.name.replaceAll("_", "-"),
            },
          })),
        },
      };
      if (
        publicationFault === "cli_entry_orchestrator_identified" ||
        publicationFault === "restart_auth_cli_entry"
      ) {
        const resource = {
          key:
            publicationFault === "restart_auth_cli_entry"
              ? "create_subscription_auth_probe"
              : "create_provider",
          snapshot: planned.snapshot,
          cleanup: planned.cleanup,
        };
        const statePath = path.join(
          root,
          ".crdd",
          "domain-model",
          "state.json",
        );
        const events =
          publicationFault === "restart_auth_cli_entry"
            ? (["submission"] as const)
            : (["submission", "receipt"] as const);
        for (const event of events) {
          const previous = fs.readFileSync(statePath);
          const previousSnapshot = JSON.parse(previous.toString());
          const saved = saveOperationCheckpoint(
            target.management,
            started.recoveryId,
            {
              kind: "resource",
              value: {
                ...resource,
                event,
                snapshot: {
                  resources: resource.snapshot.resources.map((r) =>
                    r.key === resource.key
                      ? {
                          ...r,
                          request: event === "receipt" ? "issued" : "unknown",
                          identity: {
                            ...r.identity,
                            dockerId:
                              event === "receipt" ? "c".repeat(64) : null,
                          },
                        }
                      : r,
                  ),
                },
              },
            },
          );
          assert.equal(saved.status, "completed");
          assert.equal(saved.snapshotConfirmed, true);
          assert.equal(saved.lockReleased, true);
          const next = JSON.parse(fs.readFileSync(statePath, "utf8"));
          assert.equal(next.revision, previousSnapshot.revision + 1);
          assert.deepEqual(next.previous, {
            revision: previousSnapshot.revision,
            payloadSha256: createHash("sha256").update(previous).digest("hex"),
          });
          assert.deepEqual(
            next.operations.filter(
              (item: { recoveryId: string }) =>
                item.recoveryId !== started.recoveryId,
            ),
            previousSnapshot.operations.filter(
              (item: { recoveryId: string }) =>
                item.recoveryId !== started.recoveryId,
            ),
          );
        }
      } else {
        // 元Create応答の欠測後に識別・回収された技術結果を合成する。
        // 実Dockerの不存在ではなく、保存・Host回収の接続を検証する。
        const key = "create_subscription_auth_probe";
        const statePath = path.join(
          root,
          ".crdd",
          "domain-model",
          "state.json",
        );
        for (const event of ["submission", "identified", "cleanup"] as const) {
          const previous = fs.readFileSync(statePath);
          const previousSnapshot = JSON.parse(previous.toString());
          const snapshot = {
            resources: planned.snapshot.resources.map((r) =>
              r.key === key
                ? {
                    ...r,
                    request:
                      event === "submission"
                        ? ("unknown" as const)
                        : ("issued" as const),
                    identity: {
                      ...r.identity,
                      dockerId: event === "submission" ? null : "a".repeat(64),
                    },
                  }
                : r,
            ),
          };
          const saved: {
            status: string;
            snapshotConfirmed: boolean;
            lockReleased: boolean;
          } =
            event === "cleanup"
              ? saveOperationCheckpoint(target.management, started.recoveryId, {
                  kind: "cleanup",
                  value: {
                    snapshot,
                    observations: snapshot.resources.map((r) => ({
                      key: r.key,
                      observation: r.key === key ? "absent" : "not_requested",
                    })),
                  },
                })
              : saveOperationCheckpoint(target.management, started.recoveryId, {
                  kind: "resource",
                  value: {
                    event,
                    key,
                    snapshot,
                    cleanup: planned.cleanup,
                  },
                });
          assert.equal(saved.status, "completed", event);
          assert.equal(saved.snapshotConfirmed, true);
          assert.equal(saved.lockReleased, true);
          const next = JSON.parse(fs.readFileSync(statePath, "utf8"));
          assert.equal(next.revision, previousSnapshot.revision + 1);
          assert.deepEqual(next.previous, {
            revision: previousSnapshot.revision,
            payloadSha256: createHash("sha256").update(previous).digest("hex"),
          });
          assert.deepEqual(
            next.operations.filter(
              (item: { recoveryId: string }) =>
                item.recoveryId !== started.recoveryId,
            ),
            previousSnapshot.operations.filter(
              (item: { recoveryId: string }) =>
                item.recoveryId !== started.recoveryId,
            ),
          );
          assert.deepEqual(
            next.operations.find(
              (item: { recoveryId: string }) =>
                item.recoveryId === started.recoveryId,
            ).resources,
            {
              snapshot,
              cleanup: planned.cleanup,
              checkpoints: snapshot.resources.map((r) => ({
                key: r.key,
                submission: r.key === key ? "intent_saved" : "none",
                receiptSource:
                  r.key === key && event !== "submission"
                    ? "runtime_reconciliation"
                    : null,
                observation:
                  r.key === key && event !== "submission"
                    ? event === "cleanup"
                      ? "absent"
                      : "present"
                    : "unobserved",
                absenceEvidenceSha256:
                  r.key === key && event === "cleanup"
                    ? createHash("sha256")
                        .update(
                          canonicalJson({
                            recoveryId: started.recoveryId,
                            previousPayloadSha256: createHash("sha256")
                              .update(previous)
                              .digest("hex"),
                            observation: { key, observation: "absent" },
                          }),
                        )
                        .digest("hex")
                    : null,
              })),
            },
          );
        }
      }
      const disabled = saveOperationCheckpoint(
        target.management,
        started.recoveryId,
        {
          kind: "lifecycle",
          value: {
            phase: "settling",
            lease: operation.lease,
            execution: { ...operation.execution, ownerEffect: "disabled" },
            primaryFailure:
              publicationFault === "null_outcome"
                ? null
                : {
                    purpose: "create_subscription_auth_probe",
                    stage: "command_wait",
                    reason: "provider_result_invalid",
                    exceptionCode: null,
                    commandHandleObtained: true,
                    responseObserved: false,
                    receiptRecorded: false,
                  },
            outcome:
              publicationFault === "null_outcome"
                ? null
                : {
                    status: "blocked",
                    reason: "provider_result_invalid",
                    cleanupConfirmed: false,
                  },
            summarySha256: null,
          },
        },
      );
      assert.equal(disabled.status, "completed");
      const before = readOperationStateStage(target.management);
      assert.equal(before.status, "completed");
      assert.ok(before.value);
      const beforeOperation = before.value.snapshot.operations.find(
        (item) => item.recoveryId === started.recoveryId,
      );
      assert.ok(beforeOperation && beforeOperation.kind === "docker_task");
      assert.equal(beforeOperation.execution.ownerEffect, "disabled");
      assert.equal(
        beforeOperation.outcome?.status,
        publicationFault === "null_outcome" ? undefined : "blocked",
      );
      const hostBefore = loadHostRecoveryRecordByToken(
        beforeOperation.host.currentToken,
        targetOwned.root,
      );
      const expectedMarker = `${JSON.stringify({ ...hostBefore.record, state: "docker_absent_confirmed" })}\n`;
      const expectedToken = `host.${hostBefore.parsed.rootName}.${hostBefore.parsed.nonce}.${createHash("sha256").update(expectedMarker).digest("hex")}`;
      assert.equal(
        await abandonOwnedHostOperationGenerationLock(target.management),
        true,
      );
      abandoned = true;
      const hostWorkerTimeout = [
        "cli_entry_cli",
        "cli_entry_workbench",
        "cli_entry_orchestrator",
        "restart_cli_entry",
        "restart_auth_cli_entry",
      ].includes(publicationFault)
        ? 180_000
        : 90_000;
      const child = spawnSync(
        process.execPath,
        [
          ...(publicationFault.startsWith("restart_")
            ? ["--experimental-test-module-mocks"]
            : []),
          "-",
          started.recoveryId,
          publicationFault,
          JSON.stringify(beforeOperation.resources),
        ],
        {
          input: currentHostTransitionWorkerSource,
          cwd: root,
          env: { ...process.env, LOCALAPPDATA: localAppData },
          encoding: "utf8",
          timeout: hostWorkerTimeout,
          windowsHide: true,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.ok(child.pid > 0);
      assert.notEqual(child.pid, process.pid);
      if (publicationFault === "handoff_failure") {
        assert.notEqual(child.status, 0);
        assert.equal(child.stdout, "");
        assert.match(
          child.stderr,
          /Error: current_fixture_handoff_before_output/u,
        );
        assert.equal(
          child.stderr.match(/current_handoff_failure_recovered/gu)?.length,
          1,
        );
      } else {
        assert.equal(child.status, 0, child.stderr);
        assert.equal(child.stdout, "current_host_storage_verified");
      }
      const targetRoot = targetOwned.root;
      assert.throws(() => fs.lstatSync(targetRoot), { code: "ENOENT" });
      assert.throws(() => fs.lstatSync(hostBefore.marker), { code: "ENOENT" });
      cleanupConfirmed = true;
      for (const expected of otherPhysical) {
        const info = fs.lstatSync(expected.file, { bigint: true });
        assert.deepEqual(
          {
            file: expected.file,
            dev: info.dev,
            ino: info.ino,
            birthtimeNs: info.birthtimeNs,
            bytes: info.isFile() ? fs.readFileSync(expected.file) : null,
            children: info.isDirectory()
              ? fs.readdirSync(expected.file).sort()
              : null,
          },
          expected,
        );
      }
      for (const file of [
        "state.pending.json",
        "state.lock",
        "history.pending.jsonl",
      ])
        assert.throws(
          () => fs.lstatSync(path.join(root, ".crdd", "domain-model", file)),
          { code: "ENOENT" },
        );
      const finalState = JSON.parse(
        fs.readFileSync(
          path.join(root, ".crdd", "domain-model", "state.json"),
          "utf8",
        ),
      );
      const finalOperation = finalState.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === started.recoveryId,
      );
      assert.deepEqual(
        finalState.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== started.recoveryId,
        ),
        before.value.snapshot.operations.filter(
          (item) => item.recoveryId !== started.recoveryId,
        ),
      );
      if (
        publicationFault.startsWith("completion_") ||
        publicationFault === "handoff_failure" ||
        publicationFault === "cli_entry_cli" ||
        publicationFault === "cli_entry_workbench" ||
        publicationFault.startsWith("cli_entry_orchestrator") ||
        publicationFault.startsWith("restart_")
      ) {
        assert.equal(finalOperation, undefined);
        assert.equal(
          finalState.revision,
          before.value.snapshot.revision +
            // 両restart形とも14更新。認証は専用Writerが保存し、一般cleanup保存を重ねない。
            (publicationFault.startsWith("restart_") ? 14 : 9),
        );
        const rows = fs
          .readFileSync(
            path.join(root, ".crdd", "domain-model", "history.jsonl"),
            "utf8",
          )
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const targetRows = rows.filter(
          (item) => item.summary.recoveryId === started.recoveryId,
        );
        assert.equal(targetRows.length, 1);
        const row = targetRows[0];
        assert.ok(row);
        assert.deepEqual(
          row.summary.primaryFailure,
          beforeOperation.primaryFailure,
        );
        assert.deepEqual(row.summary.outcome, {
          ...beforeOperation.outcome,
          cleanupConfirmed: true,
        });
        return;
      }
      assert.ok(finalOperation);
      assert.equal(finalOperation.host.currentToken, expectedToken);
      const terminalSaved =
        publicationFault === "none" ||
        publicationFault === "null_outcome" ||
        publicationFault.startsWith("history_") ||
        publicationFault === "workbench_transient" ||
        publicationFault === "driver";
      assert.equal(
        finalState.revision,
        before.value.snapshot.revision +
          (publicationFault === "driver" ? 7 : terminalSaved ? 7 : 4),
      );
      assert.equal(finalOperation.host.pendingTransitionJson, null);
      assert.equal(finalOperation.host.cleanup, "confirmed");
      assert.equal(finalOperation.phase, "settling");
      assert.equal(
        finalOperation.lease,
        terminalSaved ? "released" : beforeOperation.lease,
      );
      assert.deepEqual(
        finalOperation.primaryFailure,
        beforeOperation.primaryFailure,
      );
      assert.deepEqual(
        finalOperation.outcome,
        terminalSaved
          ? beforeOperation.outcome === null
            ? {
                status: "blocked",
                reason: "docker_process_controller_execution_failed_closed",
                cleanupConfirmed: true,
              }
            : { ...beforeOperation.outcome, cleanupConfirmed: true }
          : beforeOperation.outcome,
      );
    } finally {
      if (targetManagement && !abandoned)
        assert.equal(
          await abandonOwnedHostOperationGenerationLock(targetManagement),
          true,
        );
      if (otherOwned) cleanupOwnedOperationDirectories(otherOwned);
      if (targetOwned && !targetStarted) {
        cleanupOwnedOperationDirectories(targetOwned);
        cleanupConfirmed = true;
      }
      if (!targetOwned || cleanupConfirmed) {
        assert.equal(path.dirname(root), area.directory);
        const currentRoot = fs.lstatSync(root, { bigint: true });
        assert.equal(
          currentRoot.isDirectory() && !currentRoot.isSymbolicLink(),
          true,
        );
        assert.equal(fs.realpathSync.native(root), root);
        assert.equal(currentRoot.dev, rootIdentity.dev);
        assert.equal(currentRoot.ino, rootIdentity.ino);
        assert.equal(currentRoot.birthtimeNs, rootIdentity.birthtimeNs);
        fs.rmSync(root, { recursive: true });
        assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
        if (fs.readdirSync(area.directory).length === 0)
          fs.rmdirSync(area.directory);
      } else
        t.diagnostic(
          `Host試験の清掃未確認。自己生成Repositoryを保持する: ${root}`,
        );
    }
  });
}
/**
 * 子本文内の資源OracleをNativeなしで実行する。
 * @responsibility 新Bookの完全集合・要求・Receiptと元保存断面の比較を反証する。
 * @trace ERB-IT-014
 * @boundary VM局所検証のみ。実Host・Docker・既存保持物は操作しない。
 */
test("現在回収子の資源Oracleは新Bookと元断面を使い旧配列を受け付けない", () => {
  const planned = createResourceBookFixture(
    "crdd.coordinator.runtime=0123456789abcdef",
    "planned",
    [
      "create_egress_network",
      "create_internal_network",
      "create_provider",
      "create_proxy",
      "create_subscription_auth_probe",
    ],
  );
  const initial = structuredClone(planned);
  const auth = initial.snapshot.resources.find(
    (r) => r.key === "create_subscription_auth_probe",
  );
  const checkpoint = initial.checkpoints.find((c) => c.key === auth?.key);
  assert.ok(auth && checkpoint);
  Reflect.set(auth, "request", "unknown");
  Reflect.set(checkpoint, "submission", "intent_saved");
  for (const source of [
    currentHostTransitionWorkerSource,
    currentAuthenticationRecoveryCliSource,
  ]) {
    const start = source.indexOf(
      "assert.deepEqual(target.resources.snapshot.resources.map",
    );
    const end = source.indexOf("\n          }", start) + "\n          }".length;
    assert.ok(start > 0 && end > start);
    const block = source.slice(start, end);
    const run = (resources: unknown) =>
      runInNewContext(`const target=JSON.parse(input);${block}`, {
        assert,
        input: JSON.stringify({ resources }),
      });
    run(initial);
    for (const mutate of [
      (b: typeof initial) => {
        const r = b.snapshot.resources.find(
          (r) => r.key === "create_subscription_auth_probe",
        );
        assert.ok(r);
        Reflect.set(r, "request", "not_issued");
      },
      (b: typeof initial) => {
        Reflect.apply(Array.prototype.pop, b.snapshot.resources, []);
      },
      (b: typeof initial) => {
        const r = b.snapshot.resources.find((r) => r.key === "create_provider");
        assert.ok(r);
        Reflect.set(r, "request", "issued");
      },
      (b: typeof initial) => {
        const c = b.checkpoints.find((c) => c.key === "create_provider");
        assert.ok(c);
        Reflect.set(c, "submission", "intent_saved");
      },
    ]) {
      const changed = structuredClone(initial);
      mutate(changed);
      assert.throws(() => run(changed), { code: "ERR_ASSERTION" });
    }
  }
  const preserved = currentHostTransitionWorkerSource.match(
    /assert.deepEqual\(JSON.parse\(fs.readFileSync\(statePath\)\)\.operations.find\(item => item.recoveryId === id\)\.resources,initialResources\);/u,
  )?.[0];
  assert.ok(preserved);
  for (const changed of [false, true]) {
    const resources = changed ? null : initial;
    const run = () =>
      runInNewContext(
        `const initialResources=JSON.parse(original);${preserved}`,
        {
          assert,
          original: JSON.stringify(initial),
          fs: {
            readFileSync: () =>
              JSON.stringify({
                operations: [{ recoveryId: "fixture", resources }],
              }),
          },
          statePath: "synthetic",
          id: "fixture",
        },
      );
    if (changed) assert.throws(run, { code: "ERR_ASSERTION" });
    else run();
  }
  const start = currentHostTransitionWorkerSource.indexOf("const freshBook =");
  const end = currentHostTransitionWorkerSource.indexOf(
    "\n                  stdout =",
    start,
  );
  assert.ok(start > 0 && end > start);
  const block = currentHostTransitionWorkerSource.slice(start, end);
  const identified = structuredClone(planned),
    resource = identified.snapshot.resources.find(
      (r) => r.key === "create_provider",
    ),
    receipt = identified.checkpoints.find((c) => c.key === "create_provider");
  assert.ok(resource && receipt);
  Reflect.set(resource, "request", "issued");
  Reflect.set(resource.identity, "dockerId", "c".repeat(64));
  Reflect.set(receipt, "submission", "intent_saved");
  Reflect.set(receipt, "receiptSource", "docker_create_result");
  const run = (resources: unknown) =>
    runInNewContext(
      "const fresh=JSON.parse(input);const resolvedId='fixture',dockerId='c'.repeat(64);" +
        block,
      {
        assert,
        input: JSON.stringify({
          operations: [{ recoveryId: "fixture", resources }],
        }),
      },
    );
  run(identified);
  for (const mutate of [
    (b: typeof identified) => {
      const r = b.snapshot.resources.find((r) => r.key === "create_provider");
      assert.ok(r);
      Reflect.set(r.identity, "dockerId", "d".repeat(64));
    },
    (b: typeof identified) => {
      const c = b.checkpoints.find((c) => c.key === "create_provider");
      assert.ok(c);
      Reflect.set(c, "receiptSource", "runtime_reconciliation");
    },
  ]) {
    const changed = structuredClone(identified);
    mutate(changed);
    assert.throws(() => run(changed), { code: "ERR_ASSERTION" });
  }
});
