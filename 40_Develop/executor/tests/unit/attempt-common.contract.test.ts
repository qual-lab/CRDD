/**
 * 通常Attemptの共通DI接続を有限の技術境界で反証する。
 * @responsibility 五資源・九操作・通知・一次失敗・元結果相関の搬送を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 実入力構築とAdapter本文。実Process・Docker・AIは使用しない。
 * @boundary DI共通Owner自体の保証はDIの共通Lifecycle試験で確認する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as di from "../../../docker-isolation/src/index.ts";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { PURPOSES } from "../../src/lifecycle/attempt.ts";
import * as boundary from "../../src/lifecycle/attempt.ts";
import { isPrimaryFailureDiagnostic } from "../../scripts/provider-attempt-host.ts";
import type { AttemptDiagnosticNotice, CancelResult } from "../../src/index.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";
import {
  applyCoordinatorResourceEvent,
  applyCoordinatorResourceCleanup,
  type CoordinatorResourceBook,
} from "../../../domain-model/src/index.ts";

/**
 * DIの停止理由・観測段階を上位理由と分離して保持する。
 * @responsibility 後着の通知拒否で一次技術診断を消さず、検証Toolも同じ値を受理する。
 * @trace ERB-UT-023
 * @precondition 有限DI結果のみ。実Docker・AI・保持物は使用しない。
 * @stimulus JSON／Identity／Image／構成拒否を表す元失敗と後着の終了通知拒否。
 * @observation 上位理由と元failure全field、検証Toolの受理・不正値拒否。
 * @oracle 異なるDI理由を復元でき、自由文と余剰fieldは受理しない。
 * @cleanup 有限Completionまで待つ。
 */
test("DIの元失敗を診断に保持し検証Toolへ欠落なく搬送する", async () => {
  for (const reason of [
    "docker_isolation_execution_failed",
    "docker_isolation_identity_mismatch",
    "docker_isolation_image_unconfirmed",
    "docker_isolation_root_readonly_mismatch",
    "docker_isolation_mount_source_unconfirmed",
  ]) {
    const f = fixture();
    const failure: NonNullable<di.IsolationExecutionResult["failure"]> =
      Object.freeze({
        stepKey: "create_subscription_auth_probe",
        stage: "observation",
        reason,
        notification: null,
        kind: "command_failed",
        exceptionCode: "unclassified_exception",
        commandHandleObtained: true,
        responseObserved: true,
      });
    f.fail(failure);
    let diagnostic:
      | import("../../src/index.ts").PrimaryFailureDiagnostic
      | null = null;
    const result = await f.run({
      onDiagnostic: (notice) => {
        if (notice.event === "coordinator_provider_boundary_settled")
          diagnostic = notice.primaryFailure;
      },
      onCleanupCompleted: () => {
        throw Error("late_notification_failure");
      },
    });
    assert.equal(
      result.reason,
      "docker_process_controller_execution_failed_closed",
    );
    assert.ok(diagnostic);
    const captured =
      diagnostic as import("../../src/index.ts").PrimaryFailureDiagnostic;
    assert.deepEqual(captured.isolationFailure, failure);
    assert.equal(isPrimaryFailureDiagnostic(captured), true);
    for (const changed of [
      { reason: "private exception text" },
      { stage: "unknown" },
      { extra: "raw-output" },
      { exceptionCode: "secret-value" },
    ])
      assert.equal(
        isPrimaryFailureDiagnostic({
          ...captured,
          isolationFailure: { ...failure, ...changed },
        }),
        false,
      );
  }
});

/**
 * 最初のIntentと作成Receiptへ同じDI由来の保存断面を搬送する。
 * @responsibility 初期Snapshot・更新Snapshot・元回収方針を再構成しない。
 * @trace ERB-UT-023
 * @precondition 実executeAttemptと有限DIの元準備・完了を使用する。
 * @stimulus 通常の作成前通知と作成Receipt通知を順に実行する。
 * @observation Snapshot参照、ID相関、回収順序と固定条件。
 * @oracle 初回は元準備Snapshot、Receiptは元観測Snapshot、回収方針は元Requestと一致。
 * @cleanup 試験Promiseを完了する。Filesystem・実Docker・AIは使用しない。
 * @boundary Executor通知の搬送。耐久保存の成立は別のDomain結合試験で確認する。
 */
test("必須通知は元Snapshotと回収方針を同じ実行から搬送する", async () => {
  const f = fixture();
  let submissions = 0;
  let receipts = 0;
  await f.run({
    onCommandSubmitting: (_purpose, resources) => {
      const request = f.request();
      assert.ok(request);
      if (submissions++ === 0)
        assert.equal(resources.snapshot, f.initialSnapshot());
      assert.equal(resources.cleanup.cleanupOrder, request.cleanupOrder);
      assert.equal(resources.cleanup.setupTimeoutMs, request.setupTimeoutMs);
      assert.equal(
        resources.cleanup.unreceiptedAbsence,
        request.unreceiptedAbsence,
      );
      assert.equal(
        resources.cleanup.verifyLabelAbsence,
        request.verifyLabelAbsence,
      );
    },
    onResourceCreated: (purpose, id, resources) => {
      receipts++;
      assert.equal(resources.snapshot, f.snapshot());
      assert.equal(
        resources.snapshot.resources.find((r) => r.key === purpose)?.identity
          .dockerId,
        id,
      );
    },
  });
  assert.ok(submissions > 0);
  assert.equal(receipts, 5);
});

/**
 * 元DI通知をDomainの同じ記録へ順次適用する。
 * @responsibility 発行前Intent・Receipt・最終観測の順序を結合して確認する。
 * @trace ERB-UT-023
 * @boundary 実宣言と純粋Domain。物理耐久性・Docker実体の主張ではない。
 */
test("通常Attemptの必須通知は同じBookへIntent・Receipt・最終観測を接続できる", async () => {
  const f = fixture();
  let book: CoordinatorResourceBook | null = null;
  let closed = false;
  await f.run({
    onCommandSubmitting: (purpose, resources) => {
      if (!purpose.startsWith("create_")) return;
      book = applyCoordinatorResourceEvent(
        book,
        JSON.parse(
          JSON.stringify({ ...resources, event: "submission", key: purpose }),
        ),
      );
      assert.ok(book, "後続Effect前に同じ資源のIntentが成立する");
    },
    onResourceCreated: (purpose, _id, resources) => {
      book = applyCoordinatorResourceEvent(
        book,
        JSON.parse(
          JSON.stringify({ ...resources, event: "receipt", key: purpose }),
        ),
      );
      assert.ok(book, "元SnapshotのReceiptだけを同じ記録に結合する");
    },
    onResourcesClosed: (observation) => {
      assert.ok(book);
      book = applyCoordinatorResourceCleanup(
        book,
        JSON.parse(JSON.stringify(observation.resourceSnapshot)),
        JSON.parse(JSON.stringify(observation.resources)),
        { recoveryId: "exact-recovery", previousPayloadSha256: "a".repeat(64) },
      );
      assert.ok(book);
      assert.ok(
        book.checkpoints.every(
          (c) =>
            c.receiptSource === "docker_create_result" &&
            c.observation === "absent",
        ),
      );
      closed = true;
    },
  });
  assert.equal(closed, true);
});

/**
 * Executor外側の未知例外をDIの技術失敗と取り違えない。
 * @responsibility 外側catchの固定診断と生例外非公開を確認する。
 * @trace ERB-UT-023
 * @precondition 本番executeAttempt本文と有限の実行・回収境界を使用する。
 * @stimulus code/messageの読取りを禁止した例外を実行代役から投げる。
 * @observation blocked結果、固定例外分類、例外Property読取り数。
 * @oracle unclassified_exceptionとなり、Property読取りは0回。
 * @cleanup N/A: 値とPromiseだけ。実Process・Docker・AIは使用しない。
 * @boundary Executor外側catch。DI内部の分類はDI試験で検証する。
 */
test("Executor外側の未知例外はDIとして再分類せず生値を公開しない", async () => {
  const source = readFileSync(
    new URL("../../src/lifecycle/attempt.ts", import.meta.url),
    "utf8",
  );
  const execute = runInNewContext(
    `${sourceDeclaration(source, "executeAttempt")}\nexecuteAttempt`,
    {
      createConfigurationNotice: () => ({}),
      createCompletionResult: (value: unknown) => value,
    },
  );
  let reads = 0;
  const thrown = Object.defineProperties(
    {},
    {
      code: {
        get() {
          reads++;
          throw Error("must_not_read");
        },
      },
      message: {
        get() {
          reads++;
          throw Error("must_not_read");
        },
      },
    },
  );
  const notices: Array<{ primaryFailure?: { exceptionCode: string } }> = [];
  const result = await execute(
    {
      callbacks: {
        onDiagnostic: (notice: (typeof notices)[number]) => {
          notices.push(notice);
        },
      },
      prepareIsolation: () => ({ resources: { resources: [] } }),
      executeIsolation: () => {
        throw thrown;
      },
    },
    { lifecycle: { cancellationRequested: false, finish() {} } },
    {
      operationId: "OP-123456",
      provider: "codex",
      taskRole: "executor",
      isolationRequest: {
        cleanupOrder: [],
        setupTimeoutMs: 10000,
        unreceiptedAbsence: "retain",
        verifyLabelAbsence: false,
      },
    },
    { recoveryId: "exact-recovery" },
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    notices.at(-1)?.primaryFailure?.exceptionCode,
    "unclassified_exception",
  );
  assert.equal(reads, 0);
});

/**
 * 入力構築が既存のpayload・環境・Path条件を維持する。
 * @responsibility 構成Ownerの拒否条件を有限入力で確認する。
 * @trace ERB-UT-023
 * @precondition 本番の純粋構築から合成Planを取得する。
 * @stimulus 各件数・容量・Path境界を渡す。
 * @observation 受理又はnull。
 * @oracle 許容範囲だけ受理する。
 * @cleanup N/A: 値検査だけ。
 * @boundary Executorの入力構築。
 */
test("Request構築は旧payload上限と予約名・Path拒否を維持する", () => {
  const { plan } = fixture();
  const execution = boundary.resolveProviderExecution(plan);
  assert.ok(execution);
  const build = (
    argv: readonly string[],
    environment: Readonly<Record<string, string>>,
  ) =>
    boundary.resolveIsolationCommandInput(
      plan,
      "C:/synthetic/tmp",
      "a".repeat(64),
      { ...execution, argv, environment } as typeof execution,
    );
  assert.ok(build(Array(256).fill("arg"), {}));
  assert.equal(build(Array(257).fill("arg"), {}), null);
  assert.ok(
    build(
      execution.argv,
      Object.fromEntries(
        Array.from({ length: 64 }, (_, i) => [`SAFE_${i}`, "value"]),
      ),
    ),
  );
  assert.equal(
    build(
      execution.argv,
      Object.fromEntries(
        Array.from({ length: 65 }, (_, i) => [`SAFE_${i}`, "value"]),
      ),
    ),
    null,
  );
  for (const name of [
    "HOME",
    "TMPDIR",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
  ])
    assert.equal(build(execution.argv, { [name]: "untrusted" }), null);
  const empty = build([""], {});
  assert.ok(empty);
  const baseBytes = Buffer.byteLength(JSON.stringify(empty.execution), "utf8");
  assert.ok(build(["x".repeat(128 * 1024 - baseBytes)], {}));
  assert.equal(build(["x".repeat(128 * 1024 - baseBytes + 1)], {}), null);
  for (const temporary of [
    "relative",
    "C:/bad,path",
    "C:/bad\npath",
    "C:/bad\0path",
  ])
    assert.equal(
      boundary.resolveIsolationCommandInput(plan, temporary, "a".repeat(64)),
      null,
    );
});

/** 本番と同じ入力構築を実行し、共通DIだけを有限代役へ置換する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
function fixture() {
  const classification = Object.freeze({
    category: "completed" as const,
    stdoutBytes: 9,
    stderrBytes: 0,
  });
  const value = attemptPlan();
  const plan = boundary.prepareAttempt(
    { randomBytes: (size) => Buffer.alloc(size, 1) },
    {
      kind: "attempt",
      purpose: "probe",
      selection: value.executionSelection,
      target: {
        provider: value.provider,
        operationId: value.operationId,
        grantRef: value.grantRef,
        workspaceSourcePath: "C:/synthetic/work",
        temporarySourcePath: "C:/synthetic/tmp",
        providerHomeSourcePath: value.providerHomeSourcePath,
        providerHomeIdentityHash: value.providerHomeIdentityHash,
        providerHomeProtectionHash: value.providerHomeProtectionHash,
        localUserBindingHash: value.localUserBindingHash,
        stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash,
        activeMountCapability: value.activeMountCapability,
      },
    },
    { tmp: "C:/synthetic/tmp", management: "C:/synthetic/management" },
  );
  assert.ok(plan);
  let request: di.IsolationRequest | null = null;
  let calls = 0;
  let failure: di.IsolationExecutionResult["failure"] = null;
  let snapshot: di.ResourceSnapshot | null = null;
  let initialSnapshot: di.ResourceSnapshot | null = null;
  let commandFailure: {
    key: string;
    code: "PROCESS_FAILURE" | "ETIMEDOUT";
  } | null = null;
  let releases = 0;
  const events: string[] = [];
  let prepareRejected = false;
  let invocationFailed = false;
  let transform = (
    value: di.IsolationExecutionResult,
  ): di.IsolationExecutionResult => value;
  const context = {
    ...di,
    ...boundary,
    Object,
    WeakMap,
    PURPOSES,
    prepareIsolation: (input: di.IsolationRequest) => {
      request = input;
      if (prepareRejected) return null;
      initialSnapshot = Object.freeze({
        resources: Object.freeze(
          input.resources.map((resource) =>
            Object.freeze({
              key: resource.key,
              identity: Object.freeze({
                kind: resource.kind,
                name: resource.name,
                ownershipLabel: resource.ownershipLabel,
                dockerId: null,
              }),
              request: "not_issued" as const,
              configuration: Object.freeze({
                image: null,
                command: null,
                environmentNames: null,
                mounts: null,
                networks: null,
                internal: null,
              }),
            }),
          ),
        ),
      });
      return { resources: initialSnapshot };
    },
    executeIsolation: (
      _prepared: unknown,
      callbacks: di.IsolationCallbacks = {},
    ): di.IsolationExecution => {
      calls++;
      if (invocationFailed) throw Error("synthetic_invocation_failure");
      assert.ok(request);
      const current = request;
      snapshot = Object.freeze({
        resources: Object.freeze(
          current.resources.map((resource, index) =>
            Object.freeze({
              key: resource.key,
              identity: Object.freeze({
                kind: resource.kind,
                dockerId: String(index + 1).repeat(64),
                name: resource.name,
                ownershipLabel: resource.ownershipLabel,
              }),
              request: "issued" as const,
              configuration: Object.freeze({
                image: resource.kind === "container" ? resource.image : null,
                command: null,
                environmentNames: null,
                mounts: null,
                networks: null,
                internal:
                  resource.kind === "network" ? resource.internal : null,
              }),
            }),
          ),
        ),
      });
      const completedResources = snapshot;
      assert.ok(initialSnapshot);
      let resources = failure ? snapshot : initialSnapshot;
      snapshot = resources;
      const completion = Promise.resolve().then(
        async (): Promise<di.IsolationExecutionResult> => {
          if (failure?.notification === "onNotIssued") {
            const step = current.steps.find(
              (step) => step.key === failure?.stepKey,
            );
            assert.ok(step);
            callbacks.onNotIssued?.(step);
          } else if (!failure) {
            for (const step of current.steps) {
              await callbacks.onSubmitting?.(step);
              if (step.action === "create") {
                resources = Object.freeze({
                  resources: Object.freeze(
                    resources.resources.map((resource) => {
                      if (resource.key !== step.resource) return resource;
                      const observed = completedResources.resources.find(
                        (completed) => completed.key === resource.key,
                      );
                      assert.ok(observed);
                      return observed;
                    }),
                  ),
                });
                snapshot = resources;
                await callbacks.onCreated?.(step, resources);
              } else if (step.action === "run") {
                await callbacks.onStarted?.(step);
                const response = {
                  status: 0,
                  signal: null,
                  stdout:
                    step.key === "start_subscription_auth_probe_attached"
                      ? JSON.stringify({
                          loggedIn: true,
                          authMethod: "claude.ai",
                          apiProvider: "firstParty",
                          forcedLoginMethod: "claudeai",
                          subscriptionType: "max",
                        })
                      : JSON.stringify({
                          type: "result",
                          subtype: "success",
                          is_error: false,
                          num_turns: 1,
                          total_cost_usd: 0,
                          structured_output: { status: true },
                        }),
                  stderr: "",
                  outputExceeded: false,
                };
                const commandResult = {
                  observation:
                    commandFailure?.key === step.key ? null : response,
                  elapsedMs: 1,
                  errorCode:
                    commandFailure?.key === step.key
                      ? commandFailure.code
                      : null,
                  classification:
                    commandFailure?.key === step.key
                      ? { category: "deadline_exceeded" as const }
                      : classification,
                  exitClass: "zero" as const,
                };
                try {
                  await callbacks.onObserved?.(step, commandResult);
                  if (commandResult.observation !== null)
                    await callbacks.onCompleted?.(step, {
                      ...commandResult,
                      observation: commandResult.observation,
                    });
                } catch {
                  failure = {
                    stepKey: step.key,
                    stage: "notification",
                    reason: "docker_isolation_notification_failed",
                    notification: "onObserved",
                    kind: "threw",
                    commandHandleObtained: true,
                    responseObserved: commandResult.observation !== null,
                    exceptionCode: null,
                  };
                  break;
                }
              }
            }
          }
          return transform({
            failure,
            resources,
            cancellationRequested: false,
            processTerminationConfirmed: true,
            notificationDeliveryConfirmed: true,
            callbackRegistrationReleased: true,
            cleanup: {
              confirmed: true,
              configCleanupConfirmed: true,
              observations: resources.resources.map((resource) => ({
                key: resource.key,
                observation: "absent",
              })),
            },
          });
        },
      );
      return {
        completion,
        cancel: async () => ({
          cancellationRequested: true,
          processTerminationObserved: true,
        }),
      };
    },
  };
  const management = {};
  const reference = {
    recoveryId: `docker-task.${plan.stableLogicalHomeBindingHash}.${"b".repeat(64)}.${"c".repeat(64)}`,
    recoveryCapability: {},
  };
  let currentControl: unknown = null;
  const state = {
    controls: new WeakMap(),
    acquireHomeLease: () => ({
      assertLive: () => true,
      release: () => {
        releases++;
        events.push("home");
        return true;
      },
    }),
    prepareIsolation: context.prepareIsolation as typeof di.prepareIsolation,
    executeIsolation: context.executeIsolation,
  };
  return {
    plan,
    releases: () => releases,
    commandFailure: (key: string, code: "PROCESS_FAILURE" | "ETIMEDOUT") => {
      commandFailure = { key, code };
    },
    events,
    rejectPrepare: () => {
      prepareRejected = true;
    },
    failInvocation: () => {
      invocationFailed = true;
    },
    transform: (value: typeof transform) => {
      transform = value;
    },
    run: (
      callbacks: import("../../src/lifecycle/types.ts").AttemptCallbacks = {},
    ) => {
      const started = boundary.start(
        { ...state, callbacks },
        plan,
        management,
        reference,
      );
      assert.equal(started.status, "started");
      if (started.status !== "started") throw Error("test_start_blocked");
      currentControl = started.controlCapability;
      return started.completion;
    },
    cancel: () => boundary.cancel(state, currentControl, management),
    request: () => request,
    snapshot: () => snapshot,
    initialSnapshot: () => initialSnapshot,
    calls: () => calls,
    classification: () => classification,
    fail: (value: NonNullable<di.IsolationExecutionResult["failure"]>) => {
      failure = value;
    },
  };
}

/**
 * DI終了不明・回収不明と要求前拒否を区別してHome解放条件を反証する。
 * @responsibility 元DI結果を直接解釈し、未確認から不存在を推測しない。
 * @trace ERB-UT-023
 * @precondition 実行要求の代役だけを使用し実Docker・AIは起動しない。
 * @stimulus 終了不明、回収不明、部分観測、純粋準備拒否、要求時例外。
 * @observation 元回復ID、Snapshot、Home解放回数と最終結果。
 * @oracle 要求前拒否以外の未確認ではHomeを保持し、自動再要求しない。
 * @cleanup メモリ内のPromiseだけ。実Home・資源を取得しない。
 */
test("DIの未確認結果はHomeを保持し準備拒否と要求時例外を区別する", async () => {
  for (const transform of [
    (r: di.IsolationExecutionResult) => ({
      ...r,
      processTerminationConfirmed: false,
    }),
    (r: di.IsolationExecutionResult) => ({
      ...r,
      cleanup: { ...r.cleanup, confirmed: false },
    }),
    (r: di.IsolationExecutionResult) => ({
      ...r,
      cleanup: {
        ...r.cleanup,
        confirmed: false,
        configCleanupConfirmed: false,
      },
    }),
    (r: di.IsolationExecutionResult) => ({
      ...r,
      cleanup: { ...r.cleanup, confirmed: false, observations: [] },
    }),
    (r: di.IsolationExecutionResult) => ({
      ...r,
      resources: { resources: r.resources.resources.slice(1) },
    }),
  ]) {
    const f = fixture();
    f.transform(transform);
    const result = await f.run();
    assert.equal(f.calls(), 1);
    assert.equal(f.releases(), 0);
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.homeLeaseReleased, false);
    assert.ok(result.recoveryId);
  }
  const before = fixture();
  before.rejectPrepare();
  const rejected = await before.run();
  assert.equal(before.calls(), 0);
  assert.equal(before.releases(), 1);
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.resourceSnapshot, null);
  const after = fixture();
  after.failInvocation();
  const unknown = await after.run();
  assert.equal(after.calls(), 1);
  assert.equal(after.releases(), 0);
  assert.equal(unknown.cleanupConfirmed, false);
  assert.equal(unknown.resourceSnapshot, after.initialSnapshot());
  assert.ok(
    unknown.resourceSnapshot?.resources.every(
      (r) => r.identity.dockerId === null,
    ),
  );
  assert.equal(unknown.recoveryId, rejected.recoveryId);
});

/**
 * 作成Receipt通知へ到達しなくてもDIの元実IDによる観測を保持する。
 * @responsibility 作成事実と回収成否を別の事実として扱う。
 * @trace ERB-UT-023
 * @precondition 元Snapshotに実IDがある有限の失敗結果。
 * @stimulus create後、onCreated通知前の中断を再現する。
 * @observation 作成観測、回復ID、Cleanup未確認とHome保持。
 * @oracle 元実IDがあれば作成観測true。不明な回収を成功にしない。
 * @cleanup 実資源なし。
 */
test("作成通知前の中断でも最終SnapshotのProvider実IDを観測する", async () => {
  const f = fixture();
  f.fail({
    stepKey: "create_provider",
    stage: "wait",
    reason: "fixed_failure",
    kind: "threw",
    notification: null,
    commandHandleObtained: true,
    responseObserved: false,
    exceptionCode: "unknown",
  });
  f.transform((r) => ({ ...r, cleanup: { ...r.cleanup, confirmed: false } }));
  let created: boolean | null = null;
  let receipts = 0;
  const result = await f.run({
    onResourceCreated: () => {
      receipts++;
    },
    onDiagnostic: (notice) => {
      if (notice.event === "coordinator_provider_boundary_settled")
        created = notice.providerContainerCreatedObserved;
    },
  });
  assert.equal(receipts, 0);
  assert.equal(created, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(f.releases(), 0);
  assert.ok(result.recoveryId);
});

/**
 * 必須通知とHome解放の実順序を確認し、通知失敗でも確認済み技術事実を保持する。
 * @trace ERB-UT-023
 * @responsibility 資源終了通知→Home→最終通知の三段を区別する。
 * @precondition 有限DI完了だけを使用。
 * @stimulus 正常と各通知の拒否。
 * @observation 三段の実順序と元回復ID・結果。
 * @oracle 通知失敗はblocked、確認済みHome解放は保持。
 * @cleanup 実資源なし。
 */
test("資源終了通知とHome解放と最終通知の三段順序を維持する", async () => {
  for (const mode of ["normal", "closed", "completed"]) {
    const f = fixture();
    const result = await f.run({
      onResourcesClosed: () => {
        f.events.push("closed");
        if (mode === "closed") throw Error("synthetic");
      },
      onCleanupCompleted: () => {
        f.events.push("completed");
        if (mode === "completed") throw Error("synthetic");
      },
    });
    assert.deepEqual(f.events, ["closed", "home", "completed"]);
    assert.equal(result.status, mode === "normal" ? "completed" : "blocked");
    assert.equal(result.homeLeaseReleased, true);
    assert.equal(result.cleanupConfirmed, true);
    assert.ok(result.recoveryId);
  }
});

/**
 * 通信故障と正規期限超過を元DI観測から別々に分類する。
 * @responsibility 任意の後続通知故障で一次失敗理由を上書きしない。
 * @trace ERB-UT-023
 * @precondition DIの有限Command観測のみ。
 * @stimulus Provider/setupのETIMEDOUTとProviderのPROCESS_FAILURE。
 * @observation 固定理由、同じ回復ID、内容非公開とHome終了。
 * @oracle 期限理由を一般例外へ変換しない。
 * @cleanup 実資源なし。
 */
test("DIの正規Timeoutと通信失敗を分け後着通知で上書きしない", async () => {
  for (const [key, code, reason] of [
    [
      "start_provider_attached",
      "PROCESS_FAILURE",
      "docker_process_controller_execution_failed_closed",
    ],
    ["start_provider_attached", "ETIMEDOUT", "provider_deadline_exceeded"],
    [
      "start_subscription_auth_probe_attached",
      "ETIMEDOUT",
      "docker_setup_deadline_exceeded",
    ],
  ] as const) {
    const f = fixture();
    f.commandFailure(key, code);
    const diagnostics: AttemptDiagnosticNotice[] = [];
    const result = await f.run({
      onDiagnostic: (notice) => {
        diagnostics.push(notice);
      },
      onCleanupCompleted: () => {
        throw Error("late");
      },
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
    const settled = diagnostics.find(
      (n) => n.event === "coordinator_provider_boundary_settled",
    );
    assert.ok(
      settled?.event === "coordinator_provider_boundary_settled" &&
        settled.primaryFailure,
    );
    assert.equal(isPrimaryFailureDiagnostic(settled.primaryFailure), true);
    assert.equal(
      isPrimaryFailureDiagnostic({
        ...settled.primaryFailure,
        exceptionCode: "unknown free text",
      }),
      false,
    );
    if (code === "PROCESS_FAILURE")
      assert.equal(settled.primaryFailure.exceptionCode, "PROCESS_FAILURE");
    assert.ok(result.recoveryId);
    assert.equal(result.normalizedResult, null);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(f.releases(), 1);
  }
});

/** 実構成と元結果だけを共通DIの一生涯へ結合する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常Attemptは五資源・九操作を共通DIへ一回接続し元Snapshotを返す", async () => {
  const f = fixture();
  const events: string[] = [];
  const result = await f.run({
    onCommandSubmitting: (key) => {
      events.push(key);
    },
  });
  assert.equal(f.calls(), 1);
  assert.strictEqual(f.request(), f.plan.isolationRequest);
  assert.equal("commands" in f.plan, false);
  assert.ok(Object.isFrozen(f.plan.isolationRequest));
  assert.ok(Object.isFrozen(f.plan.isolationRequest.resources));
  assert.ok(Object.isFrozen(f.plan.isolationRequest.resources[0]));
  assert.throws(() => {
    (f.plan.isolationRequest.resources as unknown as unknown[]).push({});
  }, TypeError);
  assert.equal(f.request()?.resources.length, 5);
  assert.deepEqual(
    Array.from(f.request()?.steps.map((step) => step.key) ?? []),
    Array.from(PURPOSES),
  );
  assert.deepEqual(events, Array.from(PURPOSES));
  assert.strictEqual(result.resourceSnapshot, f.snapshot());
  assert.equal(result.resourceSnapshot?.resources.length, 5);
  assert.equal(result.cleanupConfirmed, true);
  const primary = f.request()?.steps.at(-1);
  assert.equal(primary?.action, "run");
  if (primary?.action === "run") {
    assert.equal(primary.timeoutMs, 300_000);
    assert.equal(primary.deadlineOrigin, "started");
  }
});

/** Handle取得と応答観測は技術Ownerが報告した実際の段階を保持する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常Attemptは共通DIの一次失敗と未発行通知名を推測で変更しない", async () => {
  for (const stage of ["start", "wait", "notification"] as const) {
    const f = fixture();
    f.fail({
      stepKey: "create_provider",
      stage,
      reason: "fixed_failure",
      kind: "threw",
      notification: stage === "notification" ? "onNotIssued" : null,
      commandHandleObtained: stage !== "start",
      responseObserved: stage === "notification",
      exceptionCode: "unknown",
    });
    let diagnostic:
      | import("../../src/lifecycle/types.ts").PrimaryFailureDiagnostic
      | null = null;
    let notIssued = 0;
    const result = await f.run({
      onCommandNotIssued: () => {
        notIssued++;
      },
      onDiagnostic: (notice) => {
        if (notice.event === "coordinator_provider_boundary_settled")
          diagnostic = notice.primaryFailure;
      },
    });
    const observed = diagnostic as
      | import("../../src/lifecycle/types.ts").PrimaryFailureDiagnostic
      | null;
    assert.equal(result.status, "blocked");
    assert.equal(
      observed?.stage,
      stage === "notification"
        ? "submission_record"
        : stage === "start"
          ? "command_start"
          : "command_wait",
    );
    assert.equal(observed?.commandHandleObtained, stage !== "start");
    assert.equal(observed?.responseObserved, stage === "notification");
    assert.equal(notIssued, stage === "notification" ? 1 : 0);
  }
});

/**
 * 共通資源名と乱数検査が既存境界を二namespaceで維持することを確認する。
 *
 * @responsibility 有限実行namespace、実行Identity形式、63文字上限とBuffer取得長を反証する。
 * @trace ERB-UT-023
 * @precondition 実Docker・外部AIを使わず固定値を共通準備処理へ渡す。
 * @stimulus 二namespaceの正常値、不正Identity、名前長境界と乱数型・長さ違反を与える。
 * @observation 返却資源名、null、例外および乱数取得回数。
 * @oracle 既存prefixと上限を維持し、不正取得を補完しない。
 * @cleanup N/A: 局所値だけで実資源やStoreを作成しない。
 * @boundary N/A: Process内の値生成だけを確認する。
 */
test("Executorの準備資源名は実行Identity形式・63文字境界と乱数長を維持する", () => {
  const { createResourceNames, createRandomHex } = preparationFunctions();
  for (const executionNamespace of ["codex", "claude"] as const) {
    const names = createResourceNames(
      executionNamespace,
      "a".repeat(64),
      "b".repeat(16),
    );
    assert.ok(names);
    assert.deepEqual(
      { ...names },
      {
        internalNetworkName: `crdd-internal-${"b".repeat(16)}`,
        egressNetworkName: `crdd-egress-${"b".repeat(16)}`,
        proxyContainerName: `crdd-proxy-${"b".repeat(16)}`,
        authContainerName: `crdd-auth-${"b".repeat(16)}`,
        providerContainerName: `crdd-${executionNamespace}-${"a".repeat(16)}`,
        ownershipLabel: `crdd.coordinator.runtime=${"b".repeat(16)}`,
      },
    );
    for (const executionIdentityHash of [
      "",
      "a".repeat(63),
      "a".repeat(65),
      "A".repeat(64),
      "g".repeat(64),
    ])
      assert.equal(
        createResourceNames(
          executionNamespace,
          executionIdentityHash,
          "b".repeat(16),
        ),
        null,
      );
    const maximumSuffix = 63 - "crdd-internal-".length;
    assert.equal(
      createResourceNames(
        executionNamespace,
        "a".repeat(64),
        "b".repeat(maximumSuffix),
      )?.internalNetworkName.length,
      63,
    );
    assert.equal(
      createResourceNames(
        executionNamespace,
        "a".repeat(64),
        "b".repeat(maximumSuffix + 1),
      ),
      null,
    );
  }
  for (const namespace of ["", "CODEX", "other", "claude ", "codex;"]) {
    assert.equal(
      createResourceNames(namespace, "a".repeat(64), "b".repeat(16)),
      null,
    );
  }
  for (const bytes of [8, 32]) {
    for (const delta of [-1, 1]) {
      assert.equal(
        createRandomHex(
          { randomBytes: () => Buffer.alloc(bytes + delta) },
          bytes,
        ),
        null,
      );
    }
    const failure = new Error("exact_random_failure");
    assert.throws(
      () =>
        createRandomHex(
          {
            randomBytes: () => {
              throw failure;
            },
          },
          bytes,
        ),
      (error: unknown) => error === failure,
    );
  }
  let calls = 0;
  const state = {
    randomBytes: (size: number) => {
      calls += 1;
      return Buffer.alloc(size, 0xab);
    },
  };
  assert.equal(createRandomHex(state, 8), "ab".repeat(8));
  assert.equal(createRandomHex(state, 32), "ab".repeat(32));
  assert.equal(calls, 2);
  assert.equal(
    createRandomHex({ randomBytes: () => Buffer.alloc(7) }, 8),
    null,
  );
  assert.equal(
    createRandomHex(
      { randomBytes: () => new Uint8Array(8) as unknown as Buffer },
      8,
    ),
    null,
  );
  assert.throws(
    () =>
      createRandomHex(
        {
          randomBytes: () => {
            throw new Error("fixed_random_failure");
          },
        },
        8,
      ),
    /fixed_random_failure/u,
  );
});

/**
 * 不正な資源名・Label・DigestをHome排他より前に拒否する。
 * @responsibility Executorが所有する五資源の生成・開始文法を固定する。
 * @trace ERB-UT-023
 * @precondition 本番準備から得た合成Plan。技術接続は呼ばれると失敗する。
 * @stimulus 名の欠測・不正文法・重複、LabelとDigestの変異を渡す。
 * @observation 開始拒否と技術接続の呼出し回数。
 * @oracle 全変異を拒否し、Home取得・DI要求は0。
 * @cleanup N/A: メモリ内の有限値のみ。
 * @boundary Executor開始入力。実資源観測は行わない。
 */
test("資源Identityの不正はHome取得・DI要求より前に拒否する", () => {
  const { plan } = fixture();
  assert.equal(boundary.isAttemptPlanValid(plan), true);
  const nameKeys = [
    "authContainerName",
    "providerContainerName",
    "proxyContainerName",
    "internalNetworkName",
    "egressNetworkName",
  ] as const;
  for (const change of [
    ...nameKeys.flatMap((key, index) =>
      nameKeys.slice(index + 1).map((other) => ({ [key]: plan[other] })),
    ),
    { authContainerName: "" },
    { providerContainerName: "crdd-codex-invalid" },
    { internalNetworkName: plan.authContainerName },
    { ownershipLabel: "crdd.coordinator.runtime=invalid" },
    { providerImageDigest: "sha256:invalid" },
    { proxyImageDigest: "sha256:invalid" },
  ]) {
    let technicalCalls = 0;
    const state = {
      controls: new WeakMap(),
      callbacks: {},
      acquireHomeLease: () => {
        technicalCalls++;
        throw Error("must_not_call");
      },
      prepareIsolation: () => {
        technicalCalls++;
        throw Error("must_not_call");
      },
      executeIsolation: () => {
        technicalCalls++;
        throw Error("must_not_call");
      },
    };
    const result = boundary.start(
      state,
      { ...plan, ...change },
      {},
      {
        recoveryId: `docker-task.${plan.stableLogicalHomeBindingHash}.${"b".repeat(64)}.${"c".repeat(64)}`,
        recoveryCapability: {},
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(technicalCalls, 0);
  }
});

/**
 * 認証Home環境の既存境界を構成Ownerの実本文で反証する。
 * @responsibility 予約環境名・不正名を拒否し、固定Home以外へ広げない。
 * @trace ERB-UT-023
 * @precondition Source本文だけを用い、実行・保存は行わない。
 * @stimulus 正規名、null、予約名と不正文法。
 * @observation 元環境値又はnull。
 * @oracle 不正値の補完・文字列変換なし。
 * @cleanup 局所VMのみ。実資源なし。
 */
test("Executorの認証環境構築は予約名を拒否し固定Homeだけを返す", () => {
  const { createAuthenticationEnvironment } = preparationFunctions();
  const accepted = createAuthenticationEnvironment("CODEX_HOME");
  assert.ok(accepted);
  assert.deepEqual({ ...accepted }, { CODEX_HOME: "/provider-home" });
  const empty = createAuthenticationEnvironment(null);
  assert.notEqual(empty, null);
  assert.deepEqual({ ...empty }, {});
  for (const name of [
    "",
    "HOME",
    "TMPDIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "bad-name",
    "CODEX_HOME\0",
  ])
    assert.equal(createAuthenticationEnvironment(name), null);
});

/**
 * 非公開の準備三関数を、既存Source抽出でそのまま有限試験へ接続する。
 * @responsibility 製品公開の試験入口を増やさず、正本の実本文だけを使う。
 * @trace ERB-UT-023
 * @precondition 同じPackageのSourceを読み取れる。
 * @stimulus 三宣言を構文木から選び、Bufferだけを共有する。
 * @observation 移管先の同じ関数。
 * @oracle 手書きの置換実装を使わない。
 * @cleanup メモリ内のVMのみ。
 */
function preparationFunctions(): {
  createRandomHex: (
    state: Readonly<{ randomBytes: (size: number) => Buffer }>,
    bytes: number,
  ) => string | null;
  createResourceNames: (
    namespace: string,
    identity: string,
    suffix: string,
  ) => Readonly<{
    internalNetworkName: string;
    egressNetworkName: string;
    proxyContainerName: string;
    authContainerName: string;
    providerContainerName: string;
    ownershipLabel: string;
  }> | null;
  createAuthenticationEnvironment: (
    name: string | null,
  ) => Readonly<Record<string, string>> | null;
} {
  const source = readFileSync(
    new URL("../../src/lifecycle/attempt.ts", import.meta.url),
    "utf8",
  );
  const names = [
    "createRandomHex",
    "createResourceNames",
    "createAuthenticationEnvironment",
  ];
  return runInNewContext(
    names.map((name) => sourceDeclaration(source, name)).join("\n") +
      "\n({" +
      names.join(",") +
      "})",
    { Buffer },
  );
}
/**
 * 最後の受動診断中の取消を最終結果へ反映する。
 * @responsibility 取消受理と内容公開の矛盾を防ぎ、先行失敗と終了後拒否を保持する。
 * @trace ERB-UT-023
 * @boundary 実Attempt本文と有限DIだけ。実AI・Docker・Filesystemなし。
 */
test("終端診断中の取消は成功内容を公開せず先行失敗と終了後拒否を維持する", async () => {
  for (const earlierFailure of [false, true])
    for (const diagnosticThrows of [false, true]) {
      const f = fixture();
      if (earlierFailure)
        f.commandFailure("start_provider_attached", "PROCESS_FAILURE");
      const accepted: Promise<CancelResult>[] = [];
      const afterCompletion: Promise<CancelResult>[] = [];
      let recoveryId: string | null = null;
      const result = await f.run({
        onDiagnostic: (notice) => {
          if (notice.event !== "coordinator_provider_boundary_settled") return;
          recoveryId = notice.recoveryId;
          accepted.push(f.cancel());
          if (diagnosticThrows) throw Error("passive_diagnostic_failure");
        },
        onCompleted: () => {
          afterCompletion.push(f.cancel());
        },
      });
      assert.equal((await accepted[0])?.status, "requested");
      assert.equal((await afterCompletion[0])?.status, "blocked");
      assert.equal(result.status, earlierFailure ? "blocked" : "cancelled");
      assert.equal(
        result.reason,
        earlierFailure
          ? "docker_process_controller_execution_failed_closed"
          : "provider_operation_cancelled",
      );
      assert.equal(result.cancellationRequested, true);
      assert.equal(result.normalizedResult, null);
      assert.equal(result.resultSha256, null);
      assert.equal(result.resultBytes, 0);
      assert.equal(result.reviewFindings, null);
      assert.equal(result.recoveryId, recoveryId);
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(f.releases(), 1);
      assert.equal((await f.cancel()).status, "blocked");
    }
});
