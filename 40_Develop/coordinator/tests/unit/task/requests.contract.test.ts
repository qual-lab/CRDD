/**
 * 単発依頼の閉入力と公開結果投影を検証する。
 * @packageDocumentation
 * @responsibility 不正入力を実行前に拒否し、成功理由と一次失敗の相関を保持する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 値検査のみ。
 * @boundary Surface入力と単発Owner。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction, runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import {
  inspectExecutionSelection,
  inspectTaskExecutionSelections,
} from "../../../../execution-model/src/index.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
  inspectWorkspaceResult,
} from "../../../src/lifecycle/validation.ts";
import { inspectSingleTaskCommand } from "../../../src/lifecycle/validation.ts";
import { capturePreparedWorkspaceTarget } from "../../../src/lifecycle/workspace.ts";

/**
 * Taskの受付拒否でも元の回復参照を保持する。
 * @trace PRL-UT-006
 * @stimulus 同じControlに未確認の回復参照がある場合とない場合に受付を拒否する。
 * @oracle 拒否理由は共通投影を通り、回復参照がある場合だけ回復待ちにする。
 * @cleanup 局所値のみ。外部処置なし。
 */
test("Taskの受付拒否は現在Controlの元回復参照を失わない", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declarations = ["blockTaskCompletion", "runCoordinatorTaskCore"]
    .map((name) => sourceDeclaration(source, name))
    .join("\n");
  const recoverId = "docker-task-recovery-original";
  const run = compileFunction(
    `${stripTypeScriptTypes(declarations)}\nreturn runCoordinatorTaskCore;`,
    [
      "snapshotCoordinatorTaskRequest",
      "projectCoordinatorTaskPublicReason",
      "controlDockerRecoveryIds",
      "nonEmptyStringValue",
    ],
  )(
    () => ({ status: "blocked", reason: "private_reason" }),
    (_reason: string, fallback: string) => fallback,
    (control: { ids: readonly string[] }) => control.ids,
    (input: unknown) =>
      typeof input === "string" && input.length > 0 ? input : null,
  );
  const observed = await run({}, "fixture", { ids: [recoverId, recoverId] });
  assert.equal(observed.reason, "coordinator_task_failed_closed");
  assert.equal(observed.manualRecoveryRequired, true);
  assert.equal(observed.cleanupConfirmed, false);
  assert.equal(observed.dockerRecoveryId, recoverId);
  assert.deepEqual(observed.dockerRecoveryIds, [recoverId]);
  const absent = await run({}, "fixture", { ids: [] });
  assert.equal(absent.manualRecoveryRequired, false);
  assert.equal(absent.cleanupConfirmed, true);
  assert.equal(absent.dockerRecoveryId, null);
});

/**
 * 回復照合へ既存Owner観測を同一参照で渡す。
 * @responsibility 受付の省略可能callbackを撤去しても不明時の元参照を維持する。
 * @trace PRL-UT-006
 * @precondition 実受付宣言を有限のState・Lease照合・投影へ接続する。
 * @stimulus 保存済み未完了記録への取消、又は記録欠測。
 * @observation observerの同一性、呼出し数、元回復ID。
 * @oracle 記録ありでは観測を一度搬送し、記録なしでは観測0。不明を成功にしない。
 * @cleanup 局所値のみ。実Lease・Process・保存なし。
 * @boundary 単発受付と既存Lease回復。
 */
test("単発回復は既存Owner観測を直接渡して元回復参照を保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(
    source,
    "createCoordinatorTaskRequests",
  );
  assert.equal(declaration.includes("deps.observeLeaseOwner"), false);
  const build = compileFunction(`return (${declaration});`, [
    "readState",
    "resolveExecutionStorageDirectory",
    "reconcileCoordinatorSnapshotLeaseOwnerLoss",
    "observeLeaseOwner",
    "projectSingleTask",
  ]);
  for (const present of [false, true]) {
    let reconciliations = 0;
    let observations = 0;
    const observation = Object.freeze({
      status: "unknown",
      ownerProcessId: 17,
      ownerGeneration: "owner.original",
    });
    const observer = (owner: unknown) => {
      observations++;
      assert.deepEqual(owner, {
        ownerProcessId: 17,
        ownerGeneration: "owner.original",
      });
      return observation;
    };
    const record = {
      principalId: "principal.original",
      phase: "starting",
      recoveryIds: ["host-operation.original"],
    };
    const queue = {
      queueId: "request.original",
      projectId: "project.original",
      singleTask: record,
      ownerGeneration: "owner.original",
    };
    const create = build(
      () => ({
        status: "completed",
        value: { queueEntries: present ? [queue] : [], leaseIntents: [] },
      }),
      (root: unknown) => {
        assert.equal(root, "synthetic-root");
        return root;
      },
      (...args: unknown[]) => {
        reconciliations++;
        assert.deepEqual(args.slice(0, 5), [
          "synthetic-root",
          "binding.original",
          "project.original",
          "request.original",
          "project-operation",
        ]);
        assert.equal(args[5], observer);
        assert.equal(
          observer({ ownerProcessId: 17, ownerGeneration: "owner.original" }),
          observation,
        );
        return {
          status: "blocked",
          reason: "owner_observation_unknown",
          recoveryId: "recovery.original",
        };
      },
      observer,
      (
        _id: unknown,
        received: { recoveryIds?: readonly string[] } | null,
        status: string,
        reason: string,
      ) => ({ status, reason, recoveryIds: received?.recoveryIds ?? [] }),
    ) as (input: object) => {
      cancel: (
        id: string,
      ) => Promise<{ status: string; recoveryIds: readonly string[] }>;
      close: () => Promise<void>;
    };
    const owner = create({
      root: "synthetic-root",
      binding: "binding.original",
      projectId: "project.original",
      principalId: "principal.original",
      authorize: () => true,
    });
    const result = await owner.cancel("request.original");
    assert.equal(result.status, "unknown");
    assert.deepEqual(
      result.recoveryIds,
      present ? ["host-operation.original", "recovery.original"] : [],
    );
    assert.equal(reconciliations, present ? 1 : 0);
    assert.equal(observations, present ? 1 : 0);
    await owner.close();
  }
});

/**
 * 明示回復は同じLeaseと保存で確認したQueueだけを共通終結へ渡す。
 * @trace PRL-UT-006
 * @stimulus 終端保存の成功・拒否と、共通終結の拒否を与える。
 * @oracle 元IDと失敗順序を保ち、保存拒否時は元世代を使用する。
 * @cleanup メモリ内のみ。
 */
test("単発回復は保存結果を共通終結へ渡し回復参照と理由を保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(
    source,
    "createCoordinatorTaskRequests",
  );
  const build = compileFunction(`return (${declaration});`, [
    "readState",
    "resolveExecutionStorageDirectory",
    "reconcileCoordinatorSnapshotLeaseOwnerLoss",
    "observeLeaseOwner",
    "acquireCoordinatorSnapshotLease",
    "recoverSingleTaskOperation",
    "updateCoordinatorSingleTask",
    "finishOperationLease",
    "projectSingleTask",
  ]);
  for (const saved of [false, true]) {
    const record = {
      principalId: "principal",
      phase: "starting",
      status: "pending",
      recoveryIds: ["host.original"],
    };
    const queue = {
      projectId: "project",
      queueId: "request",
      generation: 7,
      state: "running",
      singleTask: record,
    };
    const confirmed = { ...queue, generation: 8 };
    const lease = Object.freeze({ ownerGeneration: "owner.original" });
    let finishes = 0;
    const create = build(
      () => ({ status: "completed", value: { queueEntries: [queue] } }),
      (root: unknown) => root,
      () => ({ status: "completed", value: { queue } }),
      assert.fail,
      () => ({ status: "completed", value: lease }),
      async () => ({ cleanupConfirmed: false, recoveryIds: ["host.original"] }),
      () =>
        saved
          ? { status: "completed", value: confirmed }
          : {
              status: "blocked",
              reason: "write.failed",
              recoveryId: "store.original",
            },
      (actualLease: unknown, target: { queue: unknown }) => {
        finishes++;
        assert.equal(actualLease, lease);
        assert.deepEqual(target, {
          kind: "single-recovery",
          root: "root",
          binding: "binding",
          queueId: "request",
          queue: saved ? confirmed : queue,
        });
        assert.equal(target.queue, saved ? confirmed : queue);
        return {
          status: "blocked",
          reason: "release.failed",
          recoveryId: "store.original",
        };
      },
      (
        _id: unknown,
        value: { recoveryIds: string[] } | null,
        status: string,
        reason: string,
      ) => ({
        status,
        reason,
        recoveryIds: value?.recoveryIds ?? [],
        secondaryFailures: [],
      }),
    );
    const owner = create({
      root: "root",
      binding: "binding",
      projectId: "project",
      principalId: "principal",
      authorize: () => true,
    });
    assert.deepEqual(await owner.cancel("request"), {
      status: "unknown",
      reason: "coordinator_task_body_unavailable",
      recoveryIds: ["host.original", "store.original"],
      secondaryFailures: [
        ...(saved ? [] : ["write.failed"]),
        "release.failed",
        "coordinator_task_lease_release_unconfirmed",
      ],
    });
    assert.equal(finishes, 1);
    await owner.close();
  }
});

/**
 * 単発編集は具体開始・取消と元Host情報を共通Task処理へ渡す。
 * @trace PRL-UT-006
 * @stimulus Workbench／CLIの受付済み編集を有限の共通Task処理へ接続する。
 * @oracle 元関数参照を包まず、同じRootと認可関数を渡す。Host用途は下位が付ける。
 * @cleanup メモリ内のみ。
 */
test("単発編集は開始と取消の実体を包まず同じHost情報を渡す", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(source, "executeSingleTask");
  for (const consumer of ["workbench", "coordinator_cli"]) {
    const rootCapability = Object.freeze({}),
      root = "synthetic-root";
    const target = Object.freeze({
      workspaceId: null,
      ownerRepositoryRoot: root,
      executionTree: root,
      baseCommit: null,
      head: null,
    });
    const signal = new AbortController().signal;
    const started = async () => {};
    let authorizations = 0,
      attempts = 0;
    const authorize = () => {
      authorizations++;
      return true;
    };
    const execute = compileFunction(`return (${declaration});`, [
      "resolveVerifiedRepositoryRoot",
      "runCoordinatorSingleTaskAttempt",
    ])(
      (value: unknown) => {
        assert.equal(value, rootCapability);
        return root;
      },
      async (
        input: {
          cancellationSignal: unknown;
          observeStarted: unknown;
          workspaceTarget: unknown;
        },
        context: {
          consumer: unknown;
          hostInput: {
            root: unknown;
            recordingCurrent: unknown;
          };
        },
      ) => {
        attempts++;
        assert.equal(input.cancellationSignal, signal);
        assert.equal(input.observeStarted, started);
        assert.equal(input.workspaceTarget, target);
        assert.equal(context.consumer, consumer);
        assert.deepEqual(context.hostInput, {
          root: rootCapability,
          recordingCurrent: authorize,
        });
        assert.equal(context.hostInput.root, rootCapability);
        assert.equal(authorizations, 1);
        return {
          status: "completed",
          effectState: "settled",
          candidateId: null,
          cleanupConfirmed: true,
          recoveryIds: [],
        };
      },
    );
    const result = await execute(
      { rootCapability, root, consumer, authorize },
      { mode: "edit", prompt: "fixture", allowedPaths: ["fixture.txt"] },
      {
        record: { attemptId: "a", operationId: "o", taskId: "t" },
        target,
        repositoryRevision: "a".repeat(40),
      },
      signal,
      started,
      async () => {},
    );
    assert.equal(result.status, "completed");
    assert.equal(attempts, 1);
  }
});

/**
 * Objectiveの選定・Task組立て代役を元要求へ結合し、保留中は保持する。
 * @trace PRL-UT-006
 * @precondition 実fixture宣言のimportだけを有限のModule取得へ結合する。
 * @stimulus 正常・保留・投影／登録／呼出し／解除失敗と代役未設定を与える。
 * @observation 逆順解除、元要求・Stateと具体操作の参照。
 * @oracle 完了前に解除せず、Task組立ての登録又は解除失敗でも選定代役を解除する。
 * @cleanup メモリ内の代役だけ。
 */
test("ObjectiveのModule代役は元要求とStateを保持し全終了経路で逆順解除する", async () => {
  const source = fs.readFileSync(
    new URL("../../fixtures/task-persistence-fixture.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(source, "runTestCoordinatorObjective");
  const imports = /await import\(\s*url\s*\)/gu;
  assert.equal([...declaration.matchAll(imports)].length, 1);
  for (const mode of [
    "completed",
    "pending",
    "projection_throw",
    "invoke_reject",
    "missing_selection",
    "missing_builder",
    "plan_register_throw",
    "plan_restore_throw",
    "owner_register_throw",
    "owner_restore_throw",
    "missing_owner",
  ]) {
    const request = Object.freeze({
        requestId: "original",
        repositoryRevision: "revision",
      }),
      state = Object.freeze({ original: true }),
      root = Object.freeze({});
    const signal = new AbortController().signal,
      execution = { runSingleTaskAttempt: async () => ({}) };
    let ownerCall: ((owner: unknown) => unknown) | undefined;
    const restored: string[] = [];
    let selectionCalls = 0,
      builderCalls = 0,
      release: (() => void) | undefined;
    let selectionCall:
      | ((_root: unknown, request: unknown) => unknown)
      | undefined;
    let buildCall:
      | ((request: unknown, state: unknown, root: unknown) => unknown)
      | undefined;
    const run = compileFunction(
      "return (" +
        declaration
          .replace(imports, "await importModule(url)")
          .replaceAll("import.meta.url", JSON.stringify(import.meta.url)) +
        ");",
      [
        "URL",
        "randomUUID",
        "mock",
        "selection",
        "objectiveValidation",
        "buildFixtureTaskExecutions",
        "environment",
        "kernel",
        "withTestAttempt",
        "dispatchSource",
        "unconfiguredRuntime",
        "importModule",
      ],
    )(
      URL,
      () => "generation",
      {
        module: (
          _url: string,
          options: {
            namedExports: Record<string, (...args: unknown[]) => unknown>;
          },
        ) => {
          if (options.namedExports.resolveObjectiveTaskSelections) {
            selectionCall = options.namedExports.resolveObjectiveTaskSelections;
            return {
              restore: () => {
                restored.push("selection");
              },
            };
          }
          if (options.namedExports.observeObjectiveLeaseOwner) {
            if (mode === "owner_register_throw") throw Error(mode);
            ownerCall = options.namedExports.observeObjectiveLeaseOwner;
            return {
              restore: () => {
                restored.push("owner");
                if (mode === "owner_restore_throw") throw Error(mode);
              },
            };
          }
          if (options.namedExports.writeCoordinatorRecoveryDiagnostic) {
            assert.ok(
              options.namedExports.resolveDockerTaskCurrentCorrelations,
            );
            return { restore: () => restored.push("environment") };
          }
          assert.ok(options.namedExports.buildObjectiveTaskExecutions);
          if (mode === "plan_register_throw") throw Error(mode);
          buildCall = options.namedExports.buildObjectiveTaskExecutions;
          return {
            restore: () => {
              restored.push("plan");
              if (mode === "plan_restore_throw") throw Error(mode);
            },
          };
        },
      },
      {},
      {
        snapshotPlainRecord,
        validIdentity: (value: unknown) => value === "binding",
        inspectCoordinatorObjectiveRequest: (input: unknown) => {
          assert.equal(input, request);
          return input;
        },
      },
      (value: unknown) => value,
      {},
      {},
      async (
        attempt: unknown,
        invoke: (url: string) => Promise<unknown>,
        source: unknown,
        replacements: Map<string, string>,
      ) => {
        assert.equal(attempt, execution.runSingleTaskAttempt);
        assert.equal(
          source,
          "source\nexport { executeAcceptedCoordinatorObjective, createObjectiveIntake, blocked };",
        );
        assert.equal(replacements.size, 4);
        assert.ok(replacements.get("./environment.ts"));
        assert.equal(replacements.has("../execution/recovery.ts"), false);
        assert.ok(replacements.get("./host.ts"));
        assert.ok(replacements.get("./selection.ts"));
        assert.ok(replacements.get("./validation.ts"));
        if (mode === "projection_throw" || mode === "invoke_reject")
          throw Error(mode);
        return invoke("objective-url");
      },
      "source",
      {},
      async () => ({
        createObjectiveIntake: () => ({}),
        executeAcceptedCoordinatorObjective: async (
          context: object,
          raw: unknown,
          actualSignal: unknown,
        ) => {
          assert.equal(Object.hasOwn(context, "resolveTaskSelections"), false);
          assert.equal(Object.hasOwn(context, "createTaskExecutions"), false);
          assert.equal(Object.hasOwn(context, "observeLeaseOwner"), false);
          assert.ok(ownerCall);
          if (mode === "missing_owner")
            assert.throws(
              () => ownerCall?.(root),
              /fixture_unconfigured_objective_owner/,
            );
          else assert.equal(ownerCall(root), root);
          assert.equal(raw, request);
          assert.equal(actualSignal, signal);
          assert.ok(selectionCall);
          assert.ok(buildCall);
          if (mode === "missing_selection")
            assert.throws(
              () => selectionCall?.(root, request),
              /fixture_unconfigured_objective_selection/,
            );
          else assert.equal(selectionCall(root, request), request);
          if (mode === "missing_builder")
            assert.throws(
              () => buildCall?.(request, state, root),
              /fixture_unconfigured_objective_tasks/,
            );
          else assert.equal(buildCall(request, state, root), state);
          if (mode === "pending")
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          return request;
        },
      }),
    ) as (
      dependencies: object,
      request: object,
      signal: AbortSignal,
    ) => Promise<unknown>;
    const operation = run(
      {
        execution,
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({
          status: "verified",
          repositoryBindingId: "binding",
          repositoryRevision: request.repositoryRevision,
          workingDirectory: "fixture-root",
          repositoryRoot: root,
        }),
        ...(mode === "missing_owner"
          ? {}
          : {
              observeLeaseOwner: (owner: unknown) => {
                assert.equal(owner, root);
                return owner;
              },
            }),
        ...(mode === "missing_selection"
          ? {}
          : {
              resolveTaskSelections: (raw: unknown) => {
                selectionCalls++;
                assert.equal(raw, request);
                return raw;
              },
            }),
        ...(mode === "missing_builder"
          ? {}
          : {
              createTaskExecutions: (raw: unknown, observed: unknown) => {
                builderCalls++;
                assert.equal(raw, request);
                assert.equal(observed, state);
                return observed;
              },
            }),
      },
      request,
      signal,
    );
    if (mode === "pending") {
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(restored, []);
      assert.ok(release);
      release();
    }
    if (
      [
        "projection_throw",
        "invoke_reject",
        "plan_register_throw",
        "plan_restore_throw",
        "owner_register_throw",
        "owner_restore_throw",
      ].includes(mode)
    )
      await assert.rejects(operation, new RegExp(mode));
    else assert.equal(await operation, request);
    assert.deepEqual(
      restored,
      mode === "plan_register_throw"
        ? ["selection"]
        : mode === "owner_register_throw"
          ? ["plan", "selection"]
          : ["environment", "owner", "plan", "selection"],
    );
    const reached = [
      "completed",
      "pending",
      "missing_selection",
      "missing_builder",
      "missing_owner",
      "plan_restore_throw",
      "owner_restore_throw",
    ].includes(mode);
    assert.equal(
      selectionCalls,
      reached && mode !== "missing_selection" ? 1 : 0,
    );
    assert.equal(builderCalls, reached && mode !== "missing_builder" ? 1 : 0);
  }
});

/**
 * 五つの試験代役は構築失敗でも全解除する。
 * @responsibility 未設定Owner観測へ到達したことを別の拒否に隠さず検出する。
 * @trace PRL-UT-006
 * @precondition 実fixture宣言とメモリ内Module登録を使う。
 * @stimulus 全登録直後のSource構築例外、観測代役の未指定又は明示指定。
 * @observation 登録・逆順解除、観測property取得数と実代役呼出し数。
 * @oracle 五登録を逆順解除し、未指定到達はthrow、指定時はexact Ownerを一回搬送する。
 * @cleanup メモリ内代役のみ。実Module・Process・保存なし。
 * @boundary 試験Ownerの構築と観測代役。
 */
test("単発fixtureは全Moduleを逆順解除し未指定Owner観測への到達を拒否する", async () => {
  const source = fs.readFileSync(
    new URL("../../support/task-requests.ts", import.meta.url),
    "utf8",
  );
  const dynamicKernel = '(await import("../../src/lifecycle/host.ts"))';
  const original = sourceDeclaration(source, "createTaskRequestsFixture");
  assert.equal(original.split(dynamicKernel).length, 2);
  const declaration = original
    .replace(dynamicKernel, "kernel")
    .replaceAll(
      "import.meta.url",
      JSON.stringify(
        new URL("../../support/task-requests.ts", import.meta.url).href,
      ),
    );
  const names = [
    "getRepository",
    "assert",
    "randomUUID",
    "mock",
    "selection",
    "versionControl",
    "recovery",
    "kernel",
    "sourceUrl",
    "dispatchSource",
    "dispatchUrl",
    "requestsSource",
    "requestsUrl",
  ];
  const build = compileFunction(`return (${declaration});`, names);
  for (const configured of [false, true]) {
    const modules: { namedExports: Record<string, unknown> }[] = [];
    const restored: number[] = [];
    let reads = 0;
    let calls = 0;
    const observed = Object.freeze({ owner: "original" });
    const answer = Object.freeze({ status: "unknown" });
    const failure = Error("source_construction_failed");
    const create = build(
      () => ({ status: "completed", capability: {} }),
      assert,
      () => "fixture-generation",
      {
        module: (
          _url: string,
          options: { namedExports: Record<string, unknown> },
        ) => {
          const index = modules.push(options) - 1;
          return {
            restore: () => {
              restored.push(index);
            },
          };
        },
      },
      {},
      {},
      {},
      {},
      () => {
        throw failure;
      },
      "await executeSingleTask(\nawait recoverSingleTaskOperation(",
      new URL(import.meta.url),
      "",
      new URL(import.meta.url),
    ) as (
      dependencies: object,
      execute: () => Promise<never>,
    ) => Promise<unknown>;
    await assert.rejects(
      () =>
        create(
          {
            root: "synthetic",
            get observeLeaseOwner() {
              reads++;
              return configured
                ? (owner: unknown) => {
                    calls++;
                    assert.equal(owner, observed);
                    return answer;
                  }
                : undefined;
            },
          },
          async () => {
            throw Error("execution_forbidden");
          },
        ),
      (error) => error === failure,
    );
    assert.equal(modules.length, 5);
    assert.deepEqual(restored, [4, 3, 2, 1, 0]);
    const observe = modules[4]?.namedExports.observeLeaseOwner;
    assert.equal(typeof observe, "function");
    if (typeof observe !== "function") throw Error("owner_observer_missing");
    if (configured) assert.equal(observe(observed), answer);
    else
      assert.throws(
        () => observe(observed),
        /fixture_owner_observation_unconfigured/u,
      );
    assert.equal(reads, configured ? 2 : 1);
    assert.equal(calls, configured ? 1 : 0);
  }
});

/**
 * 単発回復の相関・順序・未確認参照を確認する。
 * @responsibility 保存済みIDを別IDへ置換せず、観測不能を回収済みにしない。
 * @trace PRL-UT-006
 * @precondition 実回復宣言を有限のDocker・保存・Host観測へ接続する。
 * @stimulus 相関欠測、Docker未完了、完了済み照合、Host拒否、未開始と例外。
 * @observation 元Root・consumer・認可参照、ID配列と呼出し順。
 * @oracle 同じOperationだけを照合し、未知状態では元参照を保持する。
 * @cleanup 局所値のみ。実回復・AI・Docker・Filesystemなし。
 * @boundary 単発受付と回復Ownerの内部接続。
 */
test("単発回復は元相関と回収順を保ち未確認参照を残す", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const build = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "recoverSingleTaskOperation"))});`,
    [
      "resolveDockerTaskCurrentCorrelations",
      "recoverDockerTaskForCurrentConsumer",
      "readState",
      "recoverSingleTaskHostOperation",
      "recoveryStorageInput",
      "borrowCoordinatorRecoveryRepository",
    ],
  );
  for (const scenario of [
    "repository_unavailable",
    "unknown",
    "docker_pending",
    "read_confirmed",
    "read_unknown",
    "host_unknown",
    "preferred_host",
    "unstarted",
    "settled",
    "throw",
  ]) {
    const root = Object.freeze({ root: "synthetic" });
    const storage = Object.freeze({ root: { directory: "fixture-only" } });
    // 回復中はRootから一度だけ借りたRepositoryを各処理へ渡す。
    const repository = Object.freeze({ repositoryBinding: "fixture-binding" });
    const authorize = () => true;
    const ids =
      scenario === "unknown"
        ? ["host-operation.original"]
        : scenario.startsWith("read_")
          ? ["docker-task.previous"]
          : scenario === "preferred_host"
            ? ["host-operation.legacy", "host-operation.current"]
            : [];
    const order: string[] = [];
    const failure = Error("synthetic_recovery_failure");
    const bindings = ["docker_pending", "host_unknown", "throw"].includes(
      scenario,
    )
      ? [{ recoveryId: "docker-task.current" }]
      : [];
    const record = {
      operationId: "operation.original",
      recoveryIds: ids,
      phase: scenario === "unstarted" ? "starting" : "settled",
      ...(scenario === "host_unknown" || scenario === "preferred_host"
        ? { adviceOperation: { hostRecoveryId: "host-operation.current" } }
        : {}),
    };
    const run = build(
      (
        operations: unknown,
        receivedRoot: unknown,
        consumer: unknown,
        receivedRepository: unknown,
      ) => {
        order.push("correlations");
        assert.deepEqual(operations, [record.operationId]);
        assert.equal(receivedRoot, root);
        assert.equal(consumer, "coordinator_cli");
        assert.equal(receivedRepository, repository);
        return scenario === "unknown"
          ? { status: "unknown", reason: "correlations_unknown" }
          : { status: "completed", bindings };
      },
      async (
        id: unknown,
        receivedRoot: unknown,
        _signal: unknown,
        receivedRepository: unknown,
      ) => {
        order.push("docker");
        assert.equal(id, "docker-task.current");
        assert.equal(receivedRoot, root);
        assert.equal(receivedRepository, repository);
        if (scenario === "throw") throw failure;
        return {
          status: "recovered",
          taskRecoveryCompleted: scenario !== "docker_pending",
          reason: "docker_unconfirmed",
        };
      },
      (receivedRoot: unknown, request: unknown) => {
        order.push("state");
        assert.equal(receivedRoot, storage);
        assert.deepEqual(request, {
          scope: "recovery",
          input: {
            kind: "completion",
            recoveryId: "docker-task.previous",
            correlationId: record.operationId,
          },
        });
        return { operationCompletionConfirmed: scenario === "read_confirmed" };
      },
      (
        receivedRoot: unknown,
        hostId: unknown,
        current: unknown,
        receivedRepository: unknown,
      ) => {
        order.push("host");
        assert.equal(receivedRoot, root);
        assert.equal(hostId, "host-operation.current");
        assert.equal(current, authorize);
        assert.equal(receivedRepository, repository);
        return {
          cleanupConfirmed: scenario !== "host_unknown",
          reason: "host_unconfirmed",
        };
      },
      (receivedRepository: unknown) => {
        assert.equal(receivedRepository, repository);
        return storage;
      },
      (receivedRoot: unknown, directory: unknown) => {
        order.push("repository");
        assert.equal(receivedRoot, root);
        assert.equal(directory, undefined);
        return scenario === "repository_unavailable" ? null : repository;
      },
    ) as (
      context: object,
      record: object,
    ) => Promise<{
      cleanupConfirmed: boolean;
      recoveryIds: readonly string[];
      reason: string;
    }>;
    const invoke = () =>
      run(
        { rootCapability: root, consumer: "coordinator_cli", authorize },
        record,
      );
    if (scenario === "throw") {
      await assert.rejects(invoke, (error) => error === failure);
      assert.deepEqual(order, ["repository", "correlations", "docker"]);
      continue;
    }
    const result = await invoke();
    if (scenario === "repository_unavailable") {
      assert.equal(result.recoveryIds, ids);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(
        result.reason,
        "docker_task_recovery_correlation_current_unconfirmed",
      );
      assert.deepEqual(order, ["repository"]);
      continue;
    }
    order.shift();
    if (scenario === "unknown") {
      assert.equal(result.recoveryIds, ids);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.reason, "correlations_unknown");
      assert.deepEqual(order, ["correlations"]);
    } else if (scenario === "docker_pending") {
      assert.deepEqual(result.recoveryIds, ["docker-task.current"]);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.reason, "docker_unconfirmed");
      assert.deepEqual(order, ["correlations", "docker"]);
    } else if (scenario.startsWith("read_")) {
      assert.deepEqual(
        result.recoveryIds,
        scenario === "read_confirmed" ? [] : ids,
      );
      assert.equal(result.cleanupConfirmed, scenario === "read_confirmed");
      assert.deepEqual(order, ["correlations", "state"]);
    } else if (scenario === "host_unknown") {
      assert.deepEqual(result.recoveryIds, ["host-operation.current"]);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.reason, "host_unconfirmed");
      assert.deepEqual(order, ["correlations", "docker", "host"]);
    } else if (scenario === "preferred_host") {
      assert.deepEqual(result.recoveryIds, ["host-operation.legacy"]);
      assert.equal(result.cleanupConfirmed, false);
      assert.deepEqual(order, ["correlations", "host"]);
    } else {
      assert.deepEqual(result.recoveryIds, []);
      assert.equal(result.cleanupConfirmed, scenario === "settled");
      assert.equal(
        result.reason,
        scenario === "settled"
          ? "coordinator_task_recovery_observed"
          : "coordinator_task_operation_creation_unconfirmed",
      );
      assert.deepEqual(order, ["correlations"]);
    }
  }
});

/**
 * Host回収の世代取得・清掃・解放と例外処置を移管前と同じに保つ。
 * @responsibility 解放拒否や例外を成功へ補完しない。
 * @trace PRL-UT-006
 * @precondition 実Host回復宣言と有限の世代／清掃操作を使う。
 * @stimulus 取得不能、清掃拒否、解放拒否及び各段の例外。
 * @observation exact参照、呼出し順、解放回数と返却理由。
 * @oracle 取得前に清掃せず、取得後の例外処置は既存の一回のcatch処置を維持する。
 * @cleanup 局所値だけ。実Directory・Lockは操作しない。
 * @boundary Host回復世代と清掃操作。
 */
test("単発Host回復は同じ世代を清掃して既存の解放失敗を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const build = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "recoverSingleTaskHostOperation"))});`,
    [
      "acquireHostOperationRecoveryGeneration",
      "recoverOwnedOperationDirectories",
      "releaseHostOperationRecoveryGeneration",
    ],
  );
  for (const scenario of [
    "complete",
    "missing",
    "cleanup_blocked",
    "release_refused",
    "acquire_throw",
    "cleanup_throw",
    "release_throw",
    "release_always_throw",
  ]) {
    const root = Object.freeze({ root: "synthetic" });
    const generation = Object.freeze({ generation: "original" });
    const authorize = () => true;
    const order: string[] = [];
    let releases = 0;
    const failure = Error("synthetic_host_failure");
    const run = build(
      (receivedRoot: unknown, id: unknown, current: unknown) => {
        order.push("acquire");
        assert.equal(receivedRoot, root);
        assert.equal(id, "host-operation.original");
        assert.equal(current, authorize);
        if (scenario === "acquire_throw") throw failure;
        return scenario === "missing" ? null : generation;
      },
      (id: unknown, received: unknown) => {
        order.push("cleanup");
        assert.equal(id, "host-operation.original");
        assert.equal(received, generation);
        if (scenario === "cleanup_throw") throw failure;
        return {
          status: scenario === "cleanup_blocked" ? "blocked" : "recovered",
          reason: "original_cleanup_reason",
        };
      },
      (received: unknown) => {
        order.push("release");
        assert.equal(received, generation);
        releases++;
        if (
          scenario === "release_always_throw" ||
          (scenario === "release_throw" && releases === 1)
        )
          throw failure;
        return scenario !== "release_refused";
      },
    ) as (
      root: object,
      id: string,
      current: () => boolean,
    ) => { cleanupConfirmed: boolean; reason: string };
    const invoke = () => run(root, "host-operation.original", authorize);
    if (scenario === "acquire_throw" || scenario === "release_always_throw") {
      assert.throws(invoke, (error) => error === failure);
    } else {
      const result = invoke();
      assert.equal(result.cleanupConfirmed, scenario === "complete");
      assert.equal(
        result.reason,
        scenario === "complete"
          ? "workbench_ai_advice_host_cleanup_observed"
          : ["cleanup_blocked", "release_refused"].includes(scenario)
            ? "original_cleanup_reason"
            : "workbench_ai_advice_host_cleanup_unconfirmed",
      );
    }
    assert.equal(
      releases,
      ["missing", "acquire_throw"].includes(scenario)
        ? 0
        : scenario.startsWith("release_") && scenario !== "release_refused"
          ? 2
          : 1,
    );
    assert.deepEqual(order, [
      "acquire",
      ...(["missing", "acquire_throw"].includes(scenario)
        ? []
        : ["cleanup", ...Array.from({ length: releases }, () => "release")]),
    ]);
  }
});

/**
 * 単発選定の用途分岐と設定一回読取りを確認する。
 * @responsibility 既存Resolverの返却値と明示選択を補完せず搬送する。
 * @trace PRL-UT-006
 * @precondition 実選定関数の宣言と有限のReader／Resolverを使う。
 * @stimulus 助言・編集、設定欠測、選定拒否とReader例外。
 * @observation Root・Catalog・設定・要求の参照、呼出し順と件数。
 * @oracle 設定読取りは各一回、用途別Resolverだけを呼び、欠測はnull、例外は元例外。
 * @cleanup 局所値のみ。実保存・AI・Dockerなし。
 * @boundary 検証済みRepositoryの選定受付。
 */
test("単発選定は同じ設定から用途別に一度だけ解決する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const root = Object.freeze({ root: "synthetic" });
  const catalog = Object.freeze({ catalog: "synthetic" });
  const snapshot = Object.freeze({
    config: Object.freeze({}),
    identity: "synthetic",
  });
  const primary = Object.freeze({ role: "advice" });
  const pair = Object.freeze({ executor: Object.freeze({ role: "executor" }) });
  const choice = Object.freeze({ provider: "synthetic" });
  let available = true;
  let resolved = true;
  let fail = false;
  const failure = Error("selection_reader_failure");
  const order: string[] = [];
  const run = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "resolveSingleTaskSelection"))});`,
    [
      "resolveVerifiedRepositoryRoot",
      "readRepositoryAiSelection",
      "getModelCatalog",
      "resolveCheckedExecutionSelection",
      "resolveCheckedTaskExecutionSelections",
    ],
  )(
    (received: unknown) => {
      assert.equal(received, root);
      return "fixture-directory";
    },
    (receivedRoot: unknown, receivedCatalog: unknown) => {
      order.push("read");
      assert.equal(receivedRoot, "fixture-directory");
      assert.equal(receivedCatalog, catalog);
      if (fail) throw failure;
      return available
        ? { status: "available", snapshot }
        : { status: "unavailable" };
    },
    () => ({ catalog }),
    (
      received: unknown,
      request: { role?: string; workType: string; choice: unknown },
    ) => {
      order.push("advice");
      assert.equal(received, snapshot);
      assert.equal(request.role, "advice");
      assert.equal(request.workType, "coding");
      assert.equal(request.choice, choice);
      return resolved
        ? { status: "resolved", value: primary }
        : { status: "blocked" };
    },
    (
      received: unknown,
      request: { role?: string; workType: string; choice: unknown },
    ) => {
      order.push("task");
      assert.equal(received, snapshot);
      assert.equal(request.role, undefined);
      assert.equal(request.workType, "coding");
      assert.equal(request.choice, choice);
      return resolved
        ? { status: "resolved", value: pair }
        : { status: "blocked" };
    },
  ) as (root: object, command: object) => unknown;
  for (const mode of ["read_only_advice", "workspace_edit"]) {
    const command = { mode, workType: "coding", choice };
    order.length = 0;
    assert.deepEqual(
      run(root, command),
      mode === "read_only_advice"
        ? { primary, taskExecutionSelections: null }
        : { primary: pair.executor, taskExecutionSelections: pair },
    );
    assert.deepEqual(order, [
      "read",
      mode === "read_only_advice" ? "advice" : "task",
    ]);
    resolved = false;
    assert.equal(run(root, command), null);
    resolved = true;
    available = false;
    order.length = 0;
    assert.equal(run(root, command), null);
    assert.deepEqual(order, ["read"]);
    available = true;
    fail = true;
    assert.throws(
      () => run(root, command),
      (error) => error === failure,
    );
    fail = false;
  }
});

/**
 * 単発ITの途中失敗でも全Ownerの終了を待つ。
 * @responsibility 一件の終了拒否から対象Root削除へ進まない。
 * @trace PRL-UT-006
 * @precondition 実ITの終了hook本文を使う。
 * @stimulus 二Ownerの正常終了又は一Ownerの終了拒否。
 * @observation 全close件数とRoot削除件数。
 * @oracle 全Ownerを待ち、終了拒否では削除0。
 * @cleanup メモリ値のみ。実Filesystemを変更しない。
 * @boundary 試験Ownerと試験領域の終了契約。
 */
test("単発ITは全Ownerの終了を待ち未確認ならRootを保全する", async () => {
  const source = fs.readFileSync(
    new URL(
      "../../integration/single-task-state.integration.test.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const hooks = [
    ...source.matchAll(
      /t\.after\((async \(\) => \{[\s\S]*?fixture_owner_close_unconfirmed[\s\S]*?\n {2}\})\);/gu,
    ),
  ];
  assert.equal(hooks.length, 2);
  for (const hook of hooks) {
    for (const reject of [false, true]) {
      let closed = 0;
      let removed = 0;
      const owners = [
        {
          close: async () => {
            closed++;
            if (reject) throw Error("close_unknown");
          },
        },
        {
          close: async () => {
            closed++;
          },
        },
      ];
      const cleanup = compileFunction(`return (${hook[1]});`, [
        "owners",
        "assert",
        "fs",
        "root",
      ])(
        owners,
        assert,
        {
          rmSync: () => {
            removed++;
          },
          existsSync: () => false,
        },
        "synthetic",
      ) as () => Promise<void>;
      if (reject)
        await assert.rejects(cleanup, /fixture_owner_close_unconfirmed/u);
      else await cleanup();
      assert.equal(closed, 2);
      assert.equal(removed, reject ? 0 : 1);
    }
  }
});

/**
 * 単発結果のWorkspace観測は一回捕捉した固定値を後段へ渡す。
 * @responsibility 重複検査を撤去しても不正Pathの拒否と元配列からの独立を維持する。
 * @trace PRL-UT-006
 * @precondition 実結果受付宣言と実Workspace検査を使用する。
 * @stimulus 正常観測・越境Pathと元配列の後続変更を与える。
 * @observation 受付回数、固定結果と不正拒否。
 * @oracle 一回で独立捕捉し、後段Ownerに二つ目のWorkspace受付を残さない。
 * @cleanup メモリ値のみ。
 * @boundary 実行結果の受付と単発記録Owner。
 */
test("単発Workspace結果は一回捕捉して同じ固定観測を再利用する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/validation.ts", import.meta.url),
    "utf8",
  );
  let inspections = 0;
  const capture = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "snapshotSingleTaskOutcome"))});`,
    ["snapshotPlainArray", "snapshotPlainRecord", "inspectWorkspaceResult"],
  )(snapshotPlainArray, snapshotPlainRecord, (value: unknown) => {
    inspections++;
    return inspectWorkspaceResult(value);
  }) as (
    value: unknown,
  ) => { workspaceResult: ReturnType<typeof inspectWorkspaceResult> } | null;
  const paths = ["src/file.ts"];
  const raw = {
    mode: "workspace_edit",
    status: "completed",
    reason: null,
    cleanupConfirmed: true,
    recoveryIds: [],
    advice: null,
    workspaceResult: {
      workspaceId: "11111111-1111-4111-8111-111111111111",
      changedPaths: paths,
      canonicalRepositoryChanged: false,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    },
  };
  const accepted = capture(raw);
  assert.ok(accepted?.workspaceResult);
  assert.equal(inspections, 1);
  paths.push("later.ts");
  assert.deepEqual(accepted.workspaceResult.changedPaths, ["src/file.ts"]);
  assert.ok(Object.isFrozen(accepted.workspaceResult.changedPaths));
  assert.equal(
    capture({
      ...raw,
      workspaceResult: { ...raw.workspaceResult, changedPaths: ["../outside"] },
    }),
    null,
  );
  assert.equal(inspections, 2);
  assert.doesNotMatch(
    sourceDeclaration(
      fs.readFileSync(
        new URL("../../../src/lifecycle/execution.ts", import.meta.url),
        "utf8",
      ),
      "executeSingleOperation",
    ),
    /\binspectWorkspaceResult\s*\(/u,
  );
});

/**
 * Resolverの未信頼返却値は内部受渡しの簡素化後も受付で拒否する。
 * @responsibility 不正選定がID発行・保存・実行へ到達しないことを確認する。
 * @trace PRL-UT-006
 * @precondition 実受付宣言とEM検査を有限のメモリStateへ接続する。
 * @stimulus Resolverが欠測・空・未知fieldを含む選定を返す。
 * @observation blocked理由とID発行・保存・実行の未呼出し。
 * @oracle configuration_unavailableで拒否し後続Effectを発行しない。
 * @cleanup メモリ値だけ。外部資源なし。
 * @boundary Resolver返却値の受付。実Filesystemは使用しない。
 */
test("単発受付は不正Resolver選定をID発行・保存・実行前に拒否する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  let effects = 0;
  const forbidden = () => {
    effects += 1;
    throw new Error("effect_forbidden");
  };
  let selectedPrimary: unknown;
  const order: string[] = [];
  const create = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "createCoordinatorTaskRequests"))});`,
    [
      "inspectSingleTaskCommand",
      "readState",
      "resolveExecutionStorageDirectory",
      "inspectExecutionSelection",
      "inspectTaskExecutionSelections",
      "randomUUID",
      "createHash",
      "resolveSingleTaskSelection",
      "readRepositoryRevision",
      "capturePreparedWorkspaceTarget",
    ],
  )(
    () => ({ mode: "read_only_advice" }),
    () => ({
      status: "completed",
      value: { queueEntries: [] },
    }),
    (value: unknown) => value,
    (value: unknown) => {
      order.push("primary");
      return inspectExecutionSelection(value);
    },
    (value: unknown) => {
      order.push("pair");
      return inspectTaskExecutionSelections(value);
    },
    forbidden,
    createHash,
    () => {
      order.push("selection");
      return { primary: selectedPrimary, taskExecutionSelections: null };
    },
    () => {
      order.push("revision");
      return { revisionIdentity: "a".repeat(40) };
    },
    capturePreparedWorkspaceTarget,
  ) as (deps: object) => {
    start: (raw: unknown) => Promise<{ status: string; reason: string }>;
  };
  for (const primary of [null, {}, { provider: "codex", unknown: true }]) {
    selectedPrimary = primary;
    order.length = 0;
    const owner = create({
      authorize: () => true,
      root: "C:/synthetic",
      binding: "binding",
    });
    const result = await owner.start({});
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "coordinator_task_configuration_unavailable");
    assert.deepEqual(order, ["selection", "primary", "pair", "revision"]);
  }
  assert.equal(effects, 0);
});

/**
 * 受付済み選定の受渡しでは再捕捉せず、実行直前の認可とRootは再確認する。
 * @responsibility 内部重複の撤去と外部境界の保持を分けて検証する。
 * @trace PRL-UT-006
 * @precondition 実executeSingleTask宣言を有限のRoot観測・Advice実行代替へ接続する。
 * @stimulus 捕捉済みrecord、失効した認可、変わったRootと取消を渡す。
 * @observation Adviceへ渡した選定の同一参照と実行回数。
 * @oracle 正常時は同じ値を渡し、三拒否経路では実行しない。
 * @cleanup メモリ内値のみ。保存・Process・Dockerなし。
 * @boundary 受付から用途実行への内部接続。実保存成立の試験ではない。
 */
test("単発内部実行は捕捉済み選定を渡し認可・Root・取消を維持する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  let authorized = true;
  let root = "C:/synthetic";
  let calls = 0;
  let received: unknown;
  const names = [
    "resolveVerifiedRepositoryRoot",
    "runRepositoryAdvice",
    "inspectExecutionSelection",
  ];
  const values = [
    () => root,
    async (_root: unknown, command: { executionSelection: unknown }) => {
      calls += 1;
      received = command.executionSelection;
      return {
        result: {
          status: "completed",
          reason: null,
          facts: [],
          sharedAnalysis: [],
          additionalInferences: [],
          nextOptions: [],
        },
        cleanupConfirmed: true,
        hostRecoveryId: null,
        dockerRecoveryId: null,
      };
    },
    () => {
      throw new Error("duplicate_inspection");
    },
  ];
  const execute = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "executeSingleTask"))});`,
    names,
  )(...values) as (
    ...args: unknown[]
  ) => Promise<{ status: string; reason: string }>;
  const context = {
    rootCapability: {},
    root: "C:/synthetic",
    consumer: "workbench",
    authorize: () => authorized,
  };
  const selection = Object.freeze({ accepted: "selection" });
  const execution = {
    record: { executionSelection: selection, operationId: "operation" },
  };
  const command = { mode: "read_only_advice" };
  const signal = new AbortController();
  const invoke = () =>
    execute(
      context,
      command,
      execution,
      signal.signal,
      () => undefined,
      () => undefined,
    );
  assert.equal((await invoke()).status, "completed");
  assert.equal(received, selection);
  authorized = false;
  assert.equal(
    (await invoke()).reason,
    "coordinator_task_selection_or_access_invalid",
  );
  authorized = true;
  root = "C:/changed";
  assert.equal(
    (await invoke()).reason,
    "coordinator_task_selection_or_access_invalid",
  );
  root = "C:/synthetic";
  signal.abort();
  assert.equal((await invoke()).status, "cancelled");
  assert.equal(calls, 1);
});

/**
 * Adviceの完成結果を全量再捕捉し、末尾不正は拒否する。
 * @responsibility 旧項目数・本文長・参照数・参照長を後段で再適用しない。
 * @trace PRL-UT-006
 * @precondition 製品の非公開宣言と実Schema検査を使う。
 * @stimulus 101項目、32,001文字、101参照と513文字参照、末尾制御文字。
 * @observation 完成結果の全件保持又はnull。
 * @oracle 正常量は保全し、不正参照だけ拒否する。
 * @cleanup メモリ内値のみ。
 * @boundary 単発Ownerの結果搬送。
 */
test("単発Advice結果は旧量上限を超えて末尾まで捕捉する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/validation.ts", import.meta.url),
    "utf8",
  );
  const capture = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "snapshotSingleTaskOutcome"))});`,
    ["snapshotPlainArray", "snapshotPlainRecord"],
  )(snapshotPlainArray, snapshotPlainRecord) as (
    raw: unknown,
  ) => { advice: { facts: { text: string; references: string[] }[] } } | null;
  const references = Array.from(
    { length: 101 },
    (_, index) => `${"r".repeat(513)}-${index}`,
  );
  const facts = Array.from({ length: 101 }, () => ({
    text: "a".repeat(32_001),
    references,
  }));
  const raw = {
    mode: "read_only_advice",
    status: "completed",
    reason: null,
    cleanupConfirmed: true,
    recoveryIds: [],
    workspaceResult: null,
    advice: {
      facts,
      sharedAnalysis: [],
      additionalInferences: [],
      nextOptions: [],
    },
  };
  const result = capture(raw);
  assert.ok(result);
  assert.equal(result.advice.facts.length, 101);
  assert.equal(result.advice.facts[100]?.text, facts[100]?.text);
  assert.equal(result.advice.facts[100]?.references[100], references[100]);
  assert.equal(
    capture({
      ...raw,
      advice: {
        ...raw.advice,
        facts: [
          ...facts.slice(0, 100),
          { text: "valid", references: ["bad\nref"] },
        ],
      },
    }),
    null,
  );
});

/**
 * 固定ContextとmodeごとのPath条件を照合する。
 * @responsibility 作業指示のPathを技術的ACLや任意Root許可にしない。
 * @trace PRL-UT-006
 * @precondition 合成の非秘密入力だけを使う。
 * @stimulus mode、対象、同意、余剰field、getterとProxyを変更する。
 * @observation 閉じたSnapshot又はnullとgetter呼出し0。
 * @oracle 明示した入力だけ受理し旧change_candidateを拒否する。
 * @cleanup Process内値だけ。
 * @boundary 公開要求値の固定。
 */
test("単発入力はROとWorkspaceを分け越境・旧Bundle・余剰値を拒否する", () => {
  const command = {
    requestId: "request-fixture-7940",
    mode: "read_only_advice",
    workType: null,
    prompt: "合成入力",
    contextReferences: ["PROJECT_CONTEXT.md"],
    allowedPaths: [],
    workspaceId: null,
  };
  assert.ok(inspectSingleTaskCommand(command));
  const choice = inspectSingleTaskCommand({
    ...command,
    choice: { effort: "medium", model: "synthetic", provider: "codex" },
  });
  assert.ok(choice?.choice);
  assert.equal(Object.isFrozen(choice.choice), true);
  assert.deepEqual(Object.keys(choice.choice), ["provider", "model", "effort"]);
  assert.deepEqual(
    choice,
    inspectSingleTaskCommand({
      ...command,
      choice: { provider: "codex", model: "synthetic", effort: "medium" },
    }),
  );
  assert.ok(
    inspectSingleTaskCommand({ ...command, prompt: "合成".repeat(16001) }),
  );
  assert.ok(
    inspectSingleTaskCommand({
      ...command,
      mode: "workspace_edit",
      allowedPaths: Array.from(
        { length: 1025 },
        (_, index) => `src/file-${index}.ts`,
      ),
    }),
  );
  assert.ok(
    inspectSingleTaskCommand({
      ...command,
      mode: "workspace_edit",
      allowedPaths: ["src/file.ts"],
    }),
  );
  for (const invalid of [
    { ...command, mode: "change_candidate" },
    { ...command, externalSendConfirmed: false },
    { ...command, expectedNetworkPolicyHash: undefined },
    { ...command, expectedNetworkPolicyHash: "wrong" },
    { ...command, contextReferences: ["secret.txt"] },
    { ...command, allowedPaths: ["src"] },
    { ...command, mode: "workspace_edit" },
    { ...command, mode: "workspace_edit", allowedPaths: ["../other"] },
    { ...command, mode: "workspace_edit", allowedPaths: ["C:/other"] },
    { ...command, mode: "workspace_edit", allowedPaths: ["src", "src"] },
    { ...command, workspaceId: "wrong" },
    { ...command, workspaceId: "11111111-1111-4111-8111-111111111111" },
    { ...command, candidateId: "old" },
    { ...command, profileId: "PROFILE-100001" },
    { ...command, choice: { provider: "codex" } },
    new Proxy(command, {}),
  ])
    assert.equal(inspectSingleTaskCommand(invalid), null);
  let reads = 0;
  const getter = { ...command };
  Object.defineProperty(getter, "prompt", {
    enumerable: true,
    get: () => {
      reads++;
      return "not_read";
    },
  });
  assert.equal(inspectSingleTaskCommand(getter), null);
  assert.equal(reads, 0);
});

/**
 * 成功理由と一次失敗を公開状態・実行状態の相関で区別する。
 * @responsibility 成功理由の混入だけを除き、失敗・取消・未確認と回復参照を保全する。
 * @trace PRL-UT-006
 * @precondition 製品の純粋view本文と合成状態だけを用いる。
 * @stimulus 公開状態・実行状態・理由・記録欠測を組み合わせる。
 * @observation reason、primaryFailure、元回復配列。
 * @oracle 両completedだけ一次失敗null、他状態の理由とexact参照は不変。
 * @cleanup N/A: メモリ内の純粋投影。
 * @boundary 単発Ownerの公開Snapshot。
 */
test("公開完了は成功理由を一次失敗へ複写せず不明・取消の原因を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  const project = runInNewContext(
    `(${stripTypeScriptTypes(sourceDeclaration(source, "projectSingleTask"))})`,
  ) as (
    id: string,
    record: Record<string, unknown> | null,
    status: string,
    reason: string | null,
  ) => Record<string, unknown>;
  const recoveryIds = ["same-exact-recovery"];
  for (const status of [
    "completed",
    "blocked",
    "cancelled",
    "unknown",
    "accepted",
    "running",
  ] as const) {
    const record = {
      status:
        status === "accepted" || status === "running" ? "pending" : status,
      reason: "coordinator_task_workspace_review_completed",
      recoveryIds,
      cleanupConfirmed: false,
    };
    const result = project("request-synthetic", record, status, record.reason);
    assert.equal(result.reason, record.reason);
    assert.equal(
      result.primaryFailure,
      status === "completed" ? null : record.reason,
    );
    assert.equal(result.recoveryIds, recoveryIds);
    assert.equal(result.cleanupConfirmed, false);
  }
  for (const [status, executionStatus] of [
    ["unknown", "completed"],
    ["completed", "unknown"],
    ["blocked", "completed"],
  ] as const) {
    const result = project(
      "request-synthetic",
      { status: executionStatus, reason: "original_failure", recoveryIds },
      status,
      "save_unconfirmed",
    );
    assert.equal(result.primaryFailure, "original_failure");
    assert.equal(result.reason, "save_unconfirmed");
    assert.equal(result.recoveryIds, recoveryIds);
  }
  const missing = project(
    "request-synthetic",
    null,
    "unknown",
    "record_unavailable",
  );
  assert.equal(missing.primaryFailure, "record_unavailable");
  assert.equal(
    project(
      "request-synthetic",
      { status: "completed", reason: null },
      "completed",
      null,
    ).primaryFailure,
    null,
  );
});

/**
 * Graph試験のModule代役は元の実行が完了するまで保持し、例外後も解除する。
 * @trace PRL-UT-006
 * @precondition 実fixture宣言と有限Module代役。Sourceは一度だけ取得する。
 * @stimulus 正常・Source投影例外・呼出し拒否・未完了の呼出し。
 * @observation Task入口の元入力、登録・解除回数と完了前の保持。
 * @oracle 正しい具体入口だけ一回呼び、未完了時は解除0、終了後は必ず解除1。
 * @cleanup メモリ内代役のみ。Process・保存・AIは使わない。
 * @boundary 試験専用Module接続と、その完了待機。
 */
test("Graph fixtureは具体Task入口を確認し完了又は例外後だけModuleを解除する", async () => {
  const origin = new URL(
    "../../fixtures/task-persistence-fixture.ts",
    import.meta.url,
  );
  const source = fs.readFileSync(origin, "utf8");
  const declaration = sourceDeclaration(source, "withTestAttempt").replaceAll(
    "import.meta.url",
    JSON.stringify(origin.href),
  );
  for (const mode of [
    "success",
    "projection_throw",
    "invoke_reject",
    "pending",
  ]) {
    const input = Object.freeze({ attemptId: "original" });
    const value = Object.freeze({ status: "completed" });
    const handle: {
      adapter?: (input: unknown) => Promise<unknown>;
      release?: () => void;
    } = {};
    let registrations = 0,
      restores = 0,
      calls = 0;
    const run = compileFunction(`return (${declaration});`, [
      "URL",
      "randomUUID",
      "mock",
      "assert",
      "sourceUrl",
      "dispatchSource",
      "dispatchUrl",
    ])(
      URL,
      () => "fixture-generation",
      {
        module: (
          _url: string,
          options: {
            namedExports: {
              fixtureTaskAttempt: NonNullable<typeof handle.adapter>;
            };
          },
        ) => {
          registrations++;
          handle.adapter = options.namedExports.fixtureTaskAttempt;
          return {
            restore: () => {
              restores++;
            },
          };
        },
      },
      assert,
      (fixtureSource: string) => {
        assert.match(fixtureSource, /^import \{ fixtureTaskAttempt \} from "/u);
        assert.equal(
          [...fixtureSource.matchAll(/\bfixtureTaskAttempt\(/gu)].length,
          2,
        );
        assert.match(
          fixtureSource,
          /function runCoordinatorSingleTaskAttempt\(/u,
        );
        if (mode === "projection_throw") throw Error("projection");
        return "finite-source";
      },
      "function runCoordinatorSingleTaskAttempt() {}\nrunCoordinatorSingleTaskAttempt();\nrunCoordinatorSingleTaskAttempt();",
      origin,
    ) as (
      attempt: (input: unknown) => Promise<unknown>,
      invoke: (url: string) => Promise<unknown>,
    ) => Promise<unknown>;
    const operation = run(
      async (received) => {
        calls++;
        assert.strictEqual(received, input);
        return value;
      },
      async (url) => {
        assert.equal(url, "finite-source");
        assert.ok(handle.adapter);
        const result = await handle.adapter(input);
        if (mode === "invoke_reject") throw Error("invoke");
        if (mode === "pending")
          await new Promise<void>((resolve) => {
            handle.release = resolve;
          });
        return result;
      },
    );
    if (mode === "pending") {
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(restores, 0);
      assert.equal(calls, 1);
      assert.ok(handle.release);
      handle.release();
    }
    if (mode === "projection_throw" || mode === "invoke_reject")
      await assert.rejects(
        operation,
        new RegExp(mode === "projection_throw" ? "projection" : "invoke"),
      );
    else assert.strictEqual(await operation, value);
    assert.equal(registrations, 1);
    assert.equal(restores, 1);
    assert.equal(calls, mode === "projection_throw" ? 0 : 1);
  }
});
