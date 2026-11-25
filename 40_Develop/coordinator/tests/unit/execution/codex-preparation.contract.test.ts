/**
 * coordinator:unit:codex-docker-runtime-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:codex-docker-runtime-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope codex、docker、runtime、adapter
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test, { mock } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  getAuthenticationDefinition,
  planExecution,
} from "@qual-lab/crdd-ai-adapter";
import { describeDockerProviderExecutionLocations } from "../../../../docker-isolation/src/image/assets.ts";
import { prepareDockerNetworkPolicy } from "../../../../docker-isolation/src/network/policy.ts";
import {
  containsRecognizedSecretMaterial,
  containsRecognizedSecretScope,
  snapshotCoordinatorTaskRequest,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../../../src/lifecycle/validation.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { bindIsolationRuntime } from "../../../../executor/tests/support/executor-test.ts";
import {
  capturePreparationInput,
  createPreparationFailure,
} from "../../../src/lifecycle/selection.ts";
import { startDockerProcessController } from "../../../src/lifecycle/execution.ts";
import { cancelExecutorAttempt } from "../../../src/lifecycle/environment.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import {
  createAttemptPreparation,
  createReviewerWorkspaceReader,
  reviewerSnapshotId,
  reviewerWorkspaceRoot,
} from "../../fixtures/attempt-preparation.ts";

/**
 * 用途別の準備入力を一回捕捉する境界とCapabilityの搬送を確認する。
 * @trace PRL-UT-014
 * @precondition 各用途に同じメモリ内の準備情報を使う。
 * @stimulus 正規三用途と、未知用途・不足・余剰・getter・Proxyを与える。
 * @observation 捕捉結果、元参照、入力を介したコード実行の有無。
 * @oracle 正規用途だけを受付し、元Capabilityを再生成せず、無効入力のtrapを呼ばない。
 * @cleanup N/A: メモリのみ。実AI・Dockerを使わない。
 */
test("準備入力は用途ごとの正確な形だけを捕捉しCapabilityを作り直さない", () => {
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const packetCapability = Object.freeze({});
  const packetOwnerCapability = Object.freeze({});
  const selection = executionSelection("executor");
  const providerHome = {
    provider: selection.provider,
    providerHomeSourcePath: "synthetic",
    providerHomeIdentityHash: "a".repeat(64),
    stableLogicalHomeBindingHash: "b".repeat(64),
  };
  const probe = {
    purpose: "probe",
    managementCapability,
    mountCapability,
    providerHome,
    executionSelection: selection,
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "workbench",
  };
  const { executionSelection: _selection, ...common } = probe;
  const task = {
    ...common,
    purpose: "task",
    packetCapability,
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
  };
  const advice = {
    ...task,
    purpose: "advice",
    packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
    packetOwnerCapability,
  };
  for (const input of [task, advice]) {
    const result = capturePreparationInput(input);
    assert.ok(result);
    assert.equal(result.purpose, input.purpose);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.providerHome));
    assert.notStrictEqual(result.providerHome, providerHome);
    assert.deepEqual({ ...result.providerHome }, providerHome);
    assert.strictEqual(result.managementCapability, managementCapability);
    assert.strictEqual(result.mountCapability, mountCapability);
    assert.strictEqual(result.packetCapability, packetCapability);
    if (result.purpose === "advice")
      assert.strictEqual(result.packetOwnerCapability, packetOwnerCapability);
  }
  let trapCalls = 0;
  const unexpected = () => {
    trapCalls++;
    throw Error("gated input executed code");
  };
  for (const input of [
    probe,
    { ...task, purpose: "other" },
    { ...task, purpose: "advice" },
    { ...probe, purpose: "task" },
    { ...advice, purpose: "probe" },
    { ...probe, executionSelection: { ...selection, role: "unknown" } },
    { ...task, executionSelection: { ...selection, purpose: "advice" } },
    {
      ...advice,
      executionSelection: selection,
    },
    { ...task, packetRef: advice.packetRef },
    { ...advice, unexpected: true },
    {
      ...task,
      get purpose() {
        return unexpected();
      },
    },
    { ...task, [Symbol()]: true },
    Object.assign(Object.create({ purpose: "task" }), {
      ...task,
      purpose: undefined,
    }),
    new Proxy(task, {
      getOwnPropertyDescriptor: unexpected,
      ownKeys: unexpected,
    }),
    {
      ...advice,
      providerHome: {
        ...providerHome,
        get provider() {
          return unexpected();
        },
      },
    },
  ]) {
    assert.equal(capturePreparationInput(input), null);
  }
  assert.equal(trapCalls, 0);
});

/**
 * 借用パスを要求捕捉へ、Reviewerの作業ツリー証拠を準備検査へ搬送する。
 * @responsibility Path集合の旧容量上限を復活させず、Reviewerには本文を渡さない。
 * @trace PRL-UT-014
 * @precondition 私有準備関数の実宣言と実Domain値検査を局所VMへ接続する。
 * @stimulus 65Path・長Path、作業ツリー証拠と本文混入・Hash不正を渡す。
 * @observation 全パスの件数と、正常・拒否の準備結果。
 * @oracle 容量だけで拒否せず、Hash・本文混入・Path文法・Accessor不正は拒否する。
 * @cleanup N/A: 局所値のみ。実AI送信・Docker・Filesystem保存なし。
 * @boundary 本番要求捕捉と実準備宣言の値検査。Provider実行は対象外。
 */
test("借用PathとReviewerの作業ツリー証拠を検査し旧本文投影を拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const names = [
    "INVALID_WINDOWS_CHARACTER",
    "RESERVED_WINDOWS_SEGMENT",
    "SCOPE_KEYS",
    "validText",
    "validSegment",
    "normalizedAllowedPath",
    "normalizedStrings",
    "normalizedPaths",
    "normalizeTaskScope",
    "normalizedReviewerReadProjection",
  ];
  const api = runInNewContext(
    names.map((name) => sourceDeclaration(source, name)).join("\n") +
      ";({paths:normalizedPaths,scope:normalizeTaskScope,reviewer:normalizedReviewerReadProjection})",
    {
      Buffer,
      TextDecoder,
      createHash,
      snapshotPlainArray,
      snapshotPlainRecord,
      containsRecognizedSecretMaterial,
      containsRecognizedSecretScope,
    },
  ) as {
    paths: (value: unknown) => readonly string[] | null;
    scope: (value: unknown) => {
      allowedPaths: readonly string[];
      readPaths: readonly string[];
      acceptanceCriteria: readonly string[];
    } | null;
    reviewer: (value: unknown) => { workspaceReview: true } | null;
  };
  const longPath = `${"segment/".repeat(150)}file.txt`;
  const paths = [
    ...Array.from({ length: 64 }, (_, index) => `src/${index}.txt`),
    longPath,
  ];
  assert.ok(Buffer.byteLength(longPath) > 1024);
  assert.equal(api.paths(paths)?.length, 65);
  assert.equal(api.paths(["../outside"]), null);
  assert.equal(api.paths(["same", "SAME"]), null);
  const scope = {
    objective: "o".repeat(8193),
    acceptanceCriteria: Array.from(
      { length: 17 },
      (_, index) => `${index}-${"c".repeat(1025)}`,
    ),
    allowedPaths: paths,
    readPaths: paths,
  };
  assert.equal(api.scope(scope)?.readPaths.length, 65);
  assert.equal(api.scope(scope)?.acceptanceCriteria?.length, 17);
  assert.equal(api.scope({ ...scope, readPaths: [0] }), null);
  const request = {
    ...scope,
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  };
  const captured = snapshotCoordinatorTaskRequest(request);
  assert.equal(captured?.status, "accepted");
  if (captured?.status === "accepted")
    assert.equal(captured.request.readPaths.length, 65);
  assert.equal(
    snapshotCoordinatorTaskRequest({ ...request, allowedPaths: [0] }),
    null,
  );
  assert.equal(
    snapshotCoordinatorTaskRequest({ ...request, readPaths: ["."] }),
    null,
  );
  assert.equal(
    snapshotCoordinatorTaskRequest({
      ...request,
      readPaths: [".", "README.md"],
    }),
    null,
  );
  assert.equal(
    snapshotCoordinatorTaskRequest({ ...request, allowedPaths: ["."] }),
    null,
  );
  const candidateSnapshotId = reviewerSnapshotId;
  const projectionHash = createHash("sha256")
    .update("crdd-review-content-v2\0")
    .update(candidateSnapshotId)
    .update("\0")
    .update("0\0[]")
    .digest("hex");
  const projection = {
    status: "projected",
    candidateSnapshotId,
    projectionHash,
    workspaceReview: true,
    withheldFileCount: 0,
    totalBytes: 0,
    files: [],
  };
  const normalized = api.reviewer(projection);
  assert.equal(normalized?.workspaceReview, true);
  assert.equal(api.reviewer({ ...projection, totalBytes: 1 }), null);
  assert.equal(
    api.reviewer({ ...projection, files: [{ content: "old" }] }),
    null,
  );
  assert.equal(
    api.reviewer({ ...projection, projectionHash: "c".repeat(64) }),
    null,
  );
  assert.equal(
    api.reviewer({ ...projection, candidateSnapshotId: "d".repeat(64) }),
    null,
  );
  let getterCalls = 0;
  const accessor = Object.defineProperty({ ...projection }, "files", {
    get() {
      getterCalls += 1;
      return [];
    },
  });
  assert.equal(api.reviewer(accessor), null);
  assert.equal(getterCalls, 0);
});

/**
 * 上位の管理情報がExecutor向け実値へ流れないことを反証する。
 * @responsibility 型の削除だけでなく選定・Packet・Pathの明示投影を確認する。
 * @trace PRL-UT-014
 * @precondition 元宣言と合成Ownerの有限代役だけを用いる。
 * @stimulus 上位専用fieldを持つ値を消費し、Executor向けcallback結果を取得する。
 * @observation exact key、元相関値、上位正本の不変と消費回数。
 * @oracle 不要fieldを搬送せず、完全選定の結合と元PacketのHashは維持する。
 * @cleanup N/A: 合成値だけ。実Host・Docker・AIは利用しない。
 * @boundary 上位Ownerから単段入力への値投影。暗号検証の成立は別試験で確認する。
 */
test("Executor向け投影は上位の時刻・速度・助言管理Hashと不要Pathを搬送しない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const technicalSelection = { marker: "technical" };
  const packet = {
    allowedReferences: ["reference"],
    packetRef: "packet",
    operationId: "operation",
    executionSelection: technicalSelection,
    provider: "codex",
    taskHash: "upper-task",
    projectionHash: "upper-projection",

    packetHash: "packet-hash",
    additionalHosts: Object.freeze([]),
    providerPrompt: "synthetic",
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
  };
  let packetConsumed = 0,
    unexpected = 0;
  const unused = () => {
    unexpected++;
    throw Error("unexpected_effect");
  };
  const declarations = [
    "verifyProviderOperationMount",
    "consumeAttemptAdvicePacket",
  ]
    .map((name) => stripTypeScriptTypes(sourceDeclaration(source, name)))
    .join("\n");
  const callbacks = runInNewContext(
    `${declarations};({ verifyProviderOperationMount, consumeAttemptAdvicePacket })`,
    {
      verifyOwnedOperationManagementMountBinding: () => ({
        operationId: "operation",
        createdAt: "upper-time",
        mounts: {
          workspace: "shared",
          providerHome: "home",
          tmp: "tmp",
          events: "events",
          projection: "projection",
          management: "management",
        },
      }),
      readBorrowedExecutionBinding: () => ({
        target: { executionTree: "execution" },
        protection: { gitSourcePath: "git", internalSourcePath: "internal" },
      }),
      randomBytes: unused,
      consumeProviderTaskPacket: unused,
      consumeProviderAdvicePacket: () => {
        packetConsumed++;
        return packet;
      },
    },
  );
  const binding = callbacks.verifyProviderOperationMount({}, {});
  assert.deepEqual(
    Object.keys(binding).sort(),
    ["operationId", "mounts", "workspaceProtection"].sort(),
  );
  assert.deepEqual(
    Object.keys(binding.mounts).sort(),
    ["workspace", "tmp"].sort(),
  );
  assert.equal(binding.mounts.workspace, "execution");
  assert.equal(binding.operationId, "operation");
  assert.equal(binding.mounts.tmp, "tmp");
  assert.deepEqual(JSON.parse(JSON.stringify(binding.workspaceProtection)), {
    gitSourcePath: "git",
    internalSourcePath: "internal",
  });
  const advice = callbacks.consumeAttemptAdvicePacket({}, {});
  assert.deepEqual(
    Object.keys(advice).sort(),
    Object.keys(packet)
      .filter((key) => key !== "taskHash" && key !== "projectionHash")
      .sort(),
  );
  assert.equal(advice.packetHash, packet.packetHash);
  for (const key of Object.keys(advice))
    assert.strictEqual(advice[key], packet[key as keyof typeof packet], key);
  assert.equal(packet.taskHash, "upper-task");
  assert.equal(packet.projectionHash, "upper-projection");
  assert.deepEqual([packetConsumed, unexpected], [1, 0]);
});

/**
 * 共通本番依存の組立てと拒否結果が準備状態を追加しないことを確認する。
 *
 * @responsibility 関数参照、凍結と外部Effect前の固定結果を照合する。
 * @trace PRL-UT-014
 * @precondition 同じCoordinator改訂版から共通組立てを読み込む。
 * @stimulus 本番依存を二回取得し、固定拒否結果を構築する。
 * @observation field集合、関数参照、時計、結果の凍結とEffect field。
 * @oracle 固定依存だけを保持し、StoreやCapabilityを生成せず、拒否結果は全Effect false。
 * @cleanup N/A: 関数参照と値だけを組み立て、資源取得関数を実行しない。
 * @boundary PRL-UT-014=Direct Boundary: 準備依存の共通組立て。
 */
test("共通Provider本番組立てはStoreを共有せず固定依存とEffect前拒否を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /getProviderDockerAdapter/);
  const lifecycle = fs.readFileSync(
    new URL("../../../src/lifecycle/execution.ts", import.meta.url),
    "utf8",
  );
  assert.match(lifecycle, /prepareProviderAttempt\(provider, captured\)/u);
  assert.equal([...source.matchAll(/\bcreateExecutor\(/gu)].length, 1);
  assert.doesNotMatch(
    source,
    /providerDockerPreparationDependencies|PreparationHost/u,
  );
  const result = createPreparationFailure("fixed_preparation_failure");
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, {
    status: "blocked",
    reason: "fixed_preparation_failure",
    plan: null,
    operationId: null,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    operationCapabilityIssued: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
});

/**
 * 技術Command検査用の試験投影を介さず、本番の準備記録を確認する。
 * @responsibility 上位計画の直接返却と、技術実行・記録投影の分離を実返却値で反証する。
 * @trace PRL-UT-014
 * @precondition 本番準備OwnerとRequestを受ける実Factory。Home・Docker操作は行わない。
 * @stimulus Probe・編集・レビューの準備計画を直接取得する。
 * @observation 上位記録とExecutorのkey、五資源・Image・Mode、元参照。
 * @oracle Command・本文・Authorityは記録投影へ出ず、内部計画の技術実行は同じ元Executorが所有する。
 * @cleanup メモリ内の候補のみ。外部資源は生成しない。
 */
test("本番の準備は上位計画を直接返し技術実行と記録投影を分離する", () => {
  let management = Object.freeze({});
  const reviewerPreparation = createReviewerWorkspaceReader(() => management);
  for (const mode of ["executor", "reviewer"] as const) {
    let observedPlan:
      | import("../../../src/lifecycle/types.ts").PreparedAttemptPlan<"codex">
      | null = null;
    const fixture = createFixture(
      {
        observePlan: (plan) => {
          observedPlan = plan;
        },
      },
      true,
      mode === "reviewer" ? "reviewer" : "executor",
      mode === "reviewer" ? reviewerPreparation : undefined,
    );
    management = fixture.managementCapability;
    const prepared = fixture.adapter.prepare({
      purpose: "task",
      packetCapability: Object.freeze({}),
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
    const owned = observedPlan as
      | import("../../../src/lifecycle/types.ts").PreparedAttemptPlan<"codex">
      | null;
    assert.ok(owned);
    assert.equal("commands" in owned, false);
    assert.equal("providerInput" in owned, false);
    assert.equal("prepare" in owned.executor, false);
    assert.equal("plan" in owned.executor, false);
    assert.equal(Object.isFrozen(owned.executor), true);
    const projection = owned.executor.recordProjection;
    assert.equal(Object.isFrozen(projection), true);
    assert.deepEqual(
      Object.keys(projection).sort(),
      [
        "authContainerName",
        "providerContainerName",
        "proxyContainerName",
        "internalNetworkName",
        "egressNetworkName",
        "ownershipLabel",
        "providerImageDigest",
        "proxyImageDigest",
        "subscriptionOffering",
        "operationMode",
        "workspaceMountMode",
      ].sort(),
    );
    for (const key of Object.keys(projection) as (keyof typeof projection)[])
      assert.equal(projection[key], owned[key]);
    assert.strictEqual(prepared.plan, owned);
    const refused = owned.executor.start({
      managementCapability: fixture.managementCapability,
      reference: { recoveryId: "invalid", recoveryCapability: {} },
    });
    assert.equal(refused.status, "blocked");
    const duplicate = owned.executor.start({
      managementCapability: fixture.managementCapability,
      reference: {
        recoveryId: `docker-task.${owned.stableLogicalHomeBindingHash}.${"1".repeat(64)}.${"2".repeat(64)}`,
        recoveryCapability: {},
      },
    });
    assert.equal(duplicate.status, "blocked");
    assert.equal(duplicate.reason, "docker_process_controller_plan_invalid");
    assert.equal(duplicate.dockerEffectStarted, false);
    assert.equal(duplicate.providerRequestStarted, false);
  }
});

const fixedSelection = executionSelection("executor", {
  provider: "codex",
  model: "gpt-5.5",
  effort: "low",
});

/**
 * createFixtureのTest準備責務を実行する。
 *
 * @responsibility createFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
function createFixture(
  overrides: Partial<
    Parameters<typeof createAttemptPreparation<"codex">>[1]
  > & {
    executionSelection?: ReturnType<typeof executionSelection>;
    observePlan?: (
      plan: import("../../../src/lifecycle/types.ts").PreparedAttemptPlan<"codex">,
    ) => void;
  } = {},
  isTaskMode = true,
  taskRole: "executor" | "reviewer" = "executor",
  createPreparation?: ReturnType<typeof createReviewerWorkspaceReader>,
) {
  const selected = isTaskMode
    ? executionSelection(
        taskRole === "executor" ? "executor" : "independent_reviewer",
        {
          provider: "codex",
          model: "gpt-5.5",
          effort: taskRole === "executor" ? "low" : "medium",
        },
      )
    : fixedSelection;
  const {
    executionSelection: selectedOverride,
    observePlan,
    ...hostOverrides
  } = overrides;
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  let randomValue = 0;
  let technicalPlan:
    | import("../../../../executor/tests/support/executor-test.ts").TestAttemptPlan
    | null = null;
  const dependencies = {
    verifyOperationMount: (management: unknown, mount: unknown) => {
      assert.equal(management, managementCapability);
      assert.equal(mount, mountCapability);
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
        mounts: Object.freeze({
          workspace: "C:\\crdd\\operation\\workspace",
          providerHome: "C:\\crdd\\operation\\provider-home",
          tmp: "C:\\crdd\\operation\\tmp",
          events: "C:\\crdd\\operation\\events",
          projection: "C:\\crdd\\operation\\projection",
          management: "C:\\crdd\\operation\\management",
        }),
      });
    },
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole,
        ...(taskRole === "reviewer"
          ? {
              reviewerReadProjection: {
                candidateSnapshotId: reviewerSnapshotId,
              },
            }
          : {}),
        taskAttempt: 0 as const,
        executionSelection: selected,
        taskPacketHash: "a".repeat(64),
        prompt: "Implement the bounded local candidate.",
        additionalHosts: Object.freeze([]),
        promptTransport: "provider_stdin_only" as const,
      }),
    ...hostOverrides,
  };
  const adapter = createAttemptPreparation(
    "codex",
    dependencies,
    (upper, lower) => {
      technicalPlan = lower;
      observePlan?.(upper);
    },
    createPreparation,
  );
  return {
    adapter,
    getTechnicalPlan: () => {
      if (!technicalPlan) throw Error("fixture_plan_missing");
      return technicalPlan;
    },
    managementCapability,
    mountCapability,
    executionSelection: selectedOverride ?? selected,
    providerHome: Object.freeze({
      provider: "codex" as const,
      providerHomeSourcePath:
        "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\codex",
      providerHomeIdentityHash: "b".repeat(64),
      stableLogicalHomeBindingHash: "1".repeat(64),
    }),
  };
}

/**
 * Workbench助言をRepository非共有のCodex Planへ固定することを検証する。
 *
 * @responsibility 第3実行モードのIdentity、標準入力およびMount境界を判定する。
 * @trace PRL-UT-014
 * @precondition 固定Model Selectionと有効なAdvice Packetを使用する。
 * @stimulus prepareAdvice相当の入力を準備し、返された計画を確認する。
 * @observation operationMode、Packet Identity、CommandおよびWorkspace Mountを観測する。
 * @oracle workbench_adviceでありRepository／Workspaceを共有しない。
 * @cleanup Provider Effectを発行しないため外部資源はない。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Workbench助言をRepository非共有のCodex Planへ固定する", () => {
  const providerCommand =
    planExecution(
      {
        provider: "codex",
        purpose: "advice",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.6-sol",
          reasoningEffort: "low",
          identifierKind: "exact",
        },
        allowedReferences: ["synthetic-reference"],
      },
      describeDockerProviderExecutionLocations("codex", "alternate"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  const dependencies = {
    executionSelection: executionSelection("advice", {
      provider: "codex",
      model: "gpt-5.6-sol",
      effort: "low",
    }),
    consumeAdvicePacket: () =>
      Object.freeze({
        contract: "crdd-executor/advice-input",
        contractRevision: 2,
        executionSelection: executionSelection("advice", {
          provider: "codex",
          model: "gpt-5.6-sol",
          effort: "low",
        }),
        packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
        operationId: "OP-123456",

        provider: "codex" as const,
        taskHash: "2".repeat(64),
        projectionHash: "3".repeat(64),

        packetHash: "5".repeat(64),
        additionalHosts: Object.freeze([]),
        providerPrompt: "Give advice from the supplied projection.",
        allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
        repositoryMounted: false as const,
        workspaceMounted: false as const,
        toolsAllowed: false as const,
        sessionPersistenceAllowed: false as const,
      }),
  };
  for (const change of [
    { operationId: "OP-654321" },
    {
      executionSelection: {
        ...executionSelection("executor", {
          provider: "codex",
          model: "gpt-5.5",
          effort: "low",
        }),
        configIdentity: "f".repeat(64),
      },
    },
    { provider: "claude" },
    { repositoryMounted: true },
    { workspaceMounted: true },
    { toolsAllowed: true },
    { sessionPersistenceAllowed: true },
    {
      executionSelection: {
        ...dependencies.consumeAdvicePacket().executionSelection,
        role: "coordinator",
      },
    },
  ]) {
    const rejected = createFixture(
      {
        ...dependencies,
        consumeAdvicePacket: () =>
          ({ ...dependencies.consumeAdvicePacket(), ...change }) as never,
      },
      true,
    );
    const result = rejected.adapter.prepare({
      purpose: "advice",
      managementCapability: rejected.managementCapability,
      mountCapability: rejected.mountCapability,
      providerHome: rejected.providerHome,
      packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "workbench",
      packetCapability: {},
      packetOwnerCapability: {},
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.providerRequestIssued, false);
    assert.equal(result.dockerEffectIssued, false);
  }
  const fixture = createFixture(dependencies, true);
  const prepared = fixture.adapter.prepare({
    purpose: "advice",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "workbench",
    packetCapability: Object.freeze({}),
    packetOwnerCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.equal(plan.operationMode, "workbench_advice");
  assert.equal(prepared.plan.consumer, "workbench");
  assert.equal(
    prepared.plan.advicePacketRef,
    "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
  );
  assert.equal(plan.providerInput, "Give advice from the supplied projection.");
  assert.equal(plan.workspaceSourcePath, null);
  assert.equal(plan.workspaceMountMode, null);
  const createProvider = plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  assert.ok(createProvider);
  assert.equal(createProvider.argv.includes("--init"), true);
  assert.equal(
    createProvider.argv.includes("C:\\crdd\\operation\\workspace"),
    false,
  );
  assert.deepEqual(
    createProvider.argv.slice(-providerCommand.argv.length),
    providerCommand.argv,
  );
});

/**
 * Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理するを検証する。
 *
 * @responsibility Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理する", () => {
  const fixture = createFixture({}, true, "executor");
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  const firstCommand = plan.commands[0];
  assert.ok(firstCommand);
  const authenticationCli = getAuthenticationDefinition("codex");
  assert.ok(Object.isFrozen(authenticationCli));
  assert.ok(Object.isFrozen(authenticationCli.statusArgv));
  assert.deepEqual(authenticationCli.statusArgv, ["login", "status"]);
  assert.equal(authenticationCli.homeEnvironmentVariable, "CODEX_HOME");
  assert.equal(authenticationCli.homeDirectoryName, "codex");
  assert.deepEqual(firstCommand.argv.slice(-2), authenticationCli.statusArgv);
  assert.ok(firstCommand.argv.includes("CODEX_HOME=/provider-home"));

  let closed = false;
  const effect = bindIsolationRuntime(
    {
      startExecution: () => {
        throw new Error("fixture_session_unused");
      },
      startCommand: () =>
        Object.freeze({
          started: async () => true,
          wait: async () => {
            closed = true;
            return Object.freeze({
              status: 0,
              signal: null,
              stdout: "",
              stderr: "",
              outputExceeded: false,
            });
          },
          terminateAndWait: async () => {
            closed = true;
            return true;
          },
          closed: () => closed,
        }),
      cleanupOwnedResources: async () => {
        throw new Error("fixture_cleanup_not_configured");
      },
      verifyCleanupOutcome: () => null,
    },
    Object.freeze({
      tmp: "C:\\crdd\\operation\\tmp",
      management: "C:\\crdd\\operation\\management",
    }),
  );
  assert.doesNotThrow(() =>
    effect.startCommand(firstCommand, plan, fixture.managementCapability),
  );
});

/**
 * 低推論選定を固定計画と元Executorの再開始拒否へ接続するを検証する。
 *
 * @responsibility 低推論選定を固定計画と元Executorの再開始拒否へ接続するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 低推論選定を固定計画と元Executorの再開始拒否へ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("低推論選定を固定計画と元Executorの再開始拒否へ接続する", () => {
  const randomCalls: number[] = [];
  const fixture = createFixture({
    randomBytes: (size: number) => {
      randomCalls.push(size);
      return Buffer.alloc(size, size === 8 ? 1 : 2);
    },
  });
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetCapability: {},
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.plan.executionSelection.modelIdentifier, "gpt-5.5");
  assert.equal(prepared.plan.executionSelection.reasoningEffort, "low");
  assert.equal(Object.hasOwn(prepared, "selectedModelTier"), false);
  const { plan: internalPlan, ...presentation } = prepared;
  assert.strictEqual(internalPlan.executor, prepared.plan.executor);
  const publicJson = JSON.stringify({
    ...presentation,
    recordProjection: internalPlan.executor.recordProjection,
  });
  assert.doesNotMatch(publicJson, /Users\\\\person/);
  assert.doesNotMatch(publicJson, /CRDD_PROXY_AUTH/);
  assert.doesNotMatch(publicJson, /create_provider/);

  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.deepEqual(randomCalls, [8, 32]);
  const expectedNames = {
    internalNetworkName: `crdd-internal-${"01".repeat(8)}`,
    egressNetworkName: `crdd-egress-${"01".repeat(8)}`,
    proxyContainerName: `crdd-proxy-${"01".repeat(8)}`,
    authContainerName: `crdd-auth-${"01".repeat(8)}`,
    providerContainerName: `crdd-codex-${"b".repeat(16)}`,
    ownershipLabel: `crdd.coordinator.runtime=${"01".repeat(8)}`,
  };
  /**
   * 実計画の資源名と全操作の対象を同じ固定期待へ照合する。
   * @responsibility 正常計画とコピー変異へ同じ位置依存Oracleを適用する。
   * @trace PRL-UT-014
   * @precondition 本番準備が返したplanまたはその一軸変異を使う。
   * @stimulus 各fieldとname／label／操作対象を比較する。
   * @observation 固定flag直後と対象位置の値。
   * @oracle 五資源名・labelと九操作の相関が全て一致する。
   * @cleanup N/A: 計画値だけを読み実資源を扱わない。
   * @boundary PRL-UT-014=Direct Boundary: 準備結果→DI command。
   */
  const assertResourceBinding = (candidate: NonNullable<typeof plan>) => {
    for (const [key, expected] of Object.entries(expectedNames))
      assert.equal(candidate[key as keyof typeof expectedNames], expected);
    for (const [purpose, name] of [
      ["create_subscription_auth_probe", expectedNames.authContainerName],
      ["create_internal_network", expectedNames.internalNetworkName],
      ["create_egress_network", expectedNames.egressNetworkName],
      ["create_proxy", expectedNames.proxyContainerName],
      ["create_provider", expectedNames.providerContainerName],
    ]) {
      const command = candidate.commands.find(
        (entry) => entry.purpose === purpose,
      );
      assert.ok(command && name);
      const label = command.argv.indexOf("--label");
      assert.ok(label >= 0);
      assert.equal(
        command.argv.filter((value) => value === "--label").length,
        1,
      );
      assert.equal(command.argv[label + 1], expectedNames.ownershipLabel);
      if (purpose?.includes("network")) assert.equal(command.argv.at(-1), name);
      else {
        const nameIndex = command.argv.indexOf("--name");
        assert.ok(nameIndex >= 0);
        assert.equal(
          command.argv.filter((value) => value === "--name").length,
          1,
        );
        assert.equal(command.argv[nameIndex + 1], name);
      }
    }
    for (const [purpose, tail] of [
      [
        "start_subscription_auth_probe_attached",
        [expectedNames.authContainerName],
      ],
      [
        "connect_proxy_egress",
        [expectedNames.egressNetworkName, expectedNames.proxyContainerName],
      ],
      ["start_proxy", [expectedNames.proxyContainerName]],
      ["start_provider_attached", [expectedNames.providerContainerName]],
    ] as const) {
      const command = candidate.commands.find(
        (entry) => entry.purpose === purpose,
      );
      assert.ok(command);
      assert.deepEqual(command.argv.slice(-tail.length), tail);
    }
  };
  assertResourceBinding(plan);
  for (const changed of [
    {
      ...plan,
      providerContainerName: expectedNames.providerContainerName.replace(
        /codex|claude/u,
        (value) => (value === "codex" ? "claude" : "codex"),
      ),
    },
    {
      ...plan,
      providerContainerName: expectedNames.providerContainerName.replace(
        /[ab]{16}$/u,
        "c".repeat(16),
      ),
    },
    { ...plan, internalNetworkName: `crdd-internal-${"03".repeat(8)}` },
  ])
    assert.throws(() => assertResourceBinding(changed));
  for (const [purpose, flag] of [
    ["create_provider", "--name"],
    ["create_provider", "--label"],
    ["create_internal_network", "target"],
    ["connect_proxy_egress", "target"],
    ["start_subscription_auth_probe_attached", "target"],
    ["start_proxy", "target"],
    ["start_provider_attached", "target"],
  ]) {
    const commands = plan.commands.map((command) => {
      if (command.purpose !== purpose) return command;
      const argv = [...command.argv];
      const index =
        flag === "target" ? argv.length - 1 : argv.indexOf(flag ?? "") + 1;
      const original = argv[index];
      argv[index] =
        flag === "--label"
          ? `crdd.coordinator.runtime=${"03".repeat(8)}`
          : `crdd-proxy-${"03".repeat(8)}`;
      if (flag !== "target" && original) argv.push(original);
      return { ...command, argv };
    });
    assert.throws(() => assertResourceBinding({ ...plan, commands }));
  }
  assert.equal(plan.providerContainerName, `crdd-codex-${"b".repeat(16)}`);

  const purposes = plan.commands.map((candidate) => candidate.purpose);
  assert.deepEqual(purposes, [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ]);
  const authProbe = plan.commands[0];
  assert.equal(authProbe?.purpose, "create_subscription_auth_probe");
  assert.deepEqual(
    authProbe?.argv.filter((value) => value.startsWith("--network")),
    ["--network=none"],
  );
  const internalNetworkArguments = plan.commands[2]?.argv ?? [];
  assert.equal(internalNetworkArguments.includes("--internal"), true);
  const provider = plan.commands.find(
    (candidate) => candidate.purpose === "create_provider",
  );
  assert.ok(provider);
  assert.equal(provider.argv.includes("--pull=never"), true);
  assert.equal(provider.argv.includes("--network=none"), false);
  assert.match(
    provider.argv[provider.argv.indexOf("--network") + 1] ?? "",
    /^crdd-internal-/u,
  );
  assert.equal(provider.argv.includes("--read-only"), true);
  assert.equal(provider.argv.includes("--fallback-model"), false);
  const modelIndex = provider.argv.indexOf("--model");
  assert.equal(provider.argv[modelIndex + 1], "gpt-5.5");
  assert.equal(provider.argv.includes('model_reasoning_effort="low"'), true);
  const proxyUrl = provider.argv
    .find((value) => value.startsWith("HTTPS_PROXY="))
    ?.slice("HTTPS_PROXY=".length);
  assert.match(proxyUrl ?? "", /^http:\/\/crdd:[a-f0-9]{64}@proxy:8080$/u);
  assert.equal(provider.argv.includes(`HTTP_PROXY=${proxyUrl}`), true);
  assert.equal(provider.argv.includes(`ALL_PROXY=${proxyUrl}`), true);
  assert.equal(provider.argv.includes("NO_PROXY="), true);
  assert.equal(
    provider.argv.some((value) => value.startsWith("OPENAI_API_KEY=")),
    false,
  );
  const firstStart = prepared.plan.executor.start({
    managementCapability: fixture.managementCapability,
    reference: { recoveryId: "invalid", recoveryCapability: {} },
  });
  assert.equal(firstStart.status, "blocked");
  const duplicateStart = prepared.plan.executor.start({
    managementCapability: fixture.managementCapability,
    reference: {
      recoveryId: `docker-task.${prepared.plan.stableLogicalHomeBindingHash}.${"1".repeat(64)}.${"2".repeat(64)}`,
      recoveryCapability: {},
    },
  });
  assert.equal(duplicateStart.status, "blocked");
  assert.equal(duplicateStart.reason, "docker_process_controller_plan_invalid");
  assert.equal(duplicateStart.dockerEffectStarted, false);
  assert.equal(duplicateStart.providerRequestStarted, false);
});

/**
 * 乱数の不正取得と例外が準備後の権限発行へ進まないことを確認する。
 * @responsibility 取得順と計画拒否を既存準備から観測する。
 * @trace PRL-UT-014
 * @precondition 固定選定と模擬Mountを持つ実準備Adapterを使う。
 * @stimulus 各取得の短長違反と例外を与える。
 * @observation 乱数呼出列、準備結果、計画拒否回数。
 * @oracle 不正Bufferでも二取得を維持し、例外以後は取得しない。Provider実行0。
 * @cleanup N/A: 値fixtureのみでDocker・外部AI・実Mountを取得しない。
 * @boundary PRL-UT-014=Direct Boundary: 準備Owner→DI値生成。
 */
test("DI乱数検査の不成立は発行前停止を保つ", () => {
  for (const mode of [
    "short8",
    "long8",
    "short32",
    "long32",
    "throw8",
    "throw32",
  ]) {
    const randomCalls: number[] = [];
    const fixture = createFixture({
      randomBytes: (size: number) => {
        randomCalls.push(size);
        if (mode === `throw${size}`) throw new Error("fixed_random_failure");
        return Buffer.alloc(
          mode === `short${size}`
            ? size - 1
            : mode === `long${size}`
              ? size + 1
              : size,
          1,
        );
      },
    });
    const prepared = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetCapability: {},
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(prepared.status, "blocked");
    assert.deepEqual(randomCalls, mode === "throw8" ? [8] : [8, 32]);

    assert.equal(prepared.dockerEffectIssued, false);
  }
});
/**
 * Task Packetをstdin専用入力と隔離workspace RW mountへ結合するを検証する。
 *
 * @responsibility Task Packetをstdin専用入力と隔離workspace RW mountへ結合するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task Packetをstdin専用入力と隔離workspace RW mountへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task Packetをstdin専用入力と隔離workspace RW mountへ結合する", () => {
  const fixture = createFixture({}, true);
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: "recovery.fixture-executor",
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  assert.strictEqual(
    prepared.plan.executionSelection,
    fixture.executionSelection,
  );
  assert.equal(prepared.plan.executionSelection.modelIdentifier, "gpt-5.5");
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.equal(plan.operationMode, "isolated_task");
  assert.equal(plan.taskRole, "executor");
  assert.equal(
    prepared.plan.recoveryCorrelationId,
    "recovery.fixture-executor",
  );
  assert.equal(prepared.plan.consumer, "coordinator_cli");
  assert.equal(plan.workspaceMountMode, "read_write");
  assert.equal(plan.providerInput, "Implement the bounded local candidate.");
  const argv = plan.commands.flatMap((command) => command.argv);
  assert.equal(argv.includes(plan.providerInput), false);
  assert.equal(argv.includes("--interactive"), true);
  assert.equal(
    argv.includes(
      "--security-opt=seccomp=" +
        fileURLToPath(
          new URL(
            "../../../../docker-isolation/src/execution/codex-executor-seccomp.json",
            import.meta.url,
          ),
        ),
    ),
    true,
  );
  assert.equal(
    argv.some(
      (value) => value.includes("dst=/work") && !value.includes("readonly"),
    ),
    true,
  );
});

/**
 * Reviewerは読み取り専用Workspaceと固定seccompを使う。
 *
 * @responsibility ReviewerのWorkspace、保護Mount、固定seccompの接続を検査する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewer用にProvider実行を準備する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Reviewerは読み取り専用Workspaceと固定seccompを使う", () => {
  let management = Object.freeze({});
  const reviewerPreparation = createReviewerWorkspaceReader(() => management);
  const fixture = createFixture(
    {
      consumeTaskPacket: () =>
        Object.freeze({
          operationId: "OP-123456",
          taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
          taskRole: "reviewer" as const,
          reviewerReadProjection: { candidateSnapshotId: reviewerSnapshotId },
          taskAttempt: 0 as const,
          executionSelection: executionSelection("independent_reviewer", {
            provider: "codex",
            model: "gpt-5.5",
            effort: "medium",
          }),
          taskPacketHash: "a".repeat(64),
          prompt: "Review the bounded local candidate.",
          additionalHosts: Object.freeze([]),
          promptTransport: "provider_stdin_only" as const,
        }),
    },
    true,
    "reviewer",
    reviewerPreparation,
  );
  management = fixture.managementCapability;
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.equal(plan.workspaceSourcePath, reviewerWorkspaceRoot);
  const provider = plan.commands.find(
    (candidate) => candidate.purpose === "create_provider",
  );
  assert.ok(provider);
  assert.equal(plan.workspaceMountMode, "read_only");
  assert.equal(
    provider.argv.includes(
      "--security-opt=seccomp=" +
        fileURLToPath(
          new URL(
            "../../../../docker-isolation/src/execution/codex-executor-seccomp.json",
            import.meta.url,
          ),
        ),
    ),
    true,
  );
  assert.equal(
    provider.argv.some(
      (value) => value.includes("dst=/work") && value.endsWith(",readonly"),
    ),
    true,
  );
  const resource = plan.isolationRequest.resources.find(
    (item) => item.key === "create_provider",
  );
  assert.ok(resource?.kind === "container");
  assert.deepEqual(
    resource.mounts
      .filter(({ readOnly }) => readOnly)
      .map(({ target }) => target),
    ["/work", "/work/.git", "/work/.crdd", "/work/.env", "/work/private"],
  );
});

/**
 * Packet相関の拒否を上位へ移してもEffect前停止を維持する。
 *
 * @responsibility Operation・発行済み参照・試行番号・本文搬送の相関拒否を固定する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Packetの四相関を一件ずつ差し替える。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task Packetの相関不一致は上位準備で拒否しPlanを発行しない", () => {
  const selected = executionSelection("executor", {
    provider: "codex",
    model: "gpt-5.5",
    effort: "low",
  });
  const policy = prepareDockerNetworkPolicy("codex", []);
  assert.equal(policy.status, "ready");
  if (policy.status !== "ready") return;
  const base = {
    operationId: "OP-123456",
    taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskRole: "executor",
    taskAttempt: 0,
    executionSelection: selected,
    taskPacketHash: "a".repeat(64),
    prompt: "synthetic",
    additionalHosts: Object.freeze([]),
    promptTransport: "provider_stdin_only",
  };
  for (const change of [
    { operationId: "OP-654321" },
    {
      taskPacketRef: "TASKPKT-FFEEDDCCBBAA99887766554433221100",
      executionSelection: {
        ...base.executionSelection,
        configIdentity: "f".repeat(64),
      },
    },
    { taskAttempt: 1 },
    { promptTransport: "argv" },
  ]) {
    const fixture = createFixture(
      {
        consumeTaskPacket: () => ({ ...base, ...change }) as never,
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      packetCapability: {},
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(result.status, "blocked");
  }
});

/**
 * Executor seccomp profileを検証できなければProvider planを発行しないを検証する。
 *
 * @responsibility Executor seccomp profileを検証できなければProvider planを発行しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Executor seccomp profileを検証できなければProvider planを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Executor seccomp profileを検証できなければProvider planを発行しない", () => {
  const fixture = createFixture({}, true);
  const lstat = fs.lstatSync;
  let rejected = 0;
  const injected = mock.method(fs, "lstatSync", ((
    ...args: Parameters<typeof fs.lstatSync>
  ) => {
    if (String(args[0]).endsWith("codex-executor-seccomp.json")) {
      rejected += 1;
      throw new Error("injected_seccomp_observation_failure");
    }
    return Reflect.apply(lstat, fs, args);
  }) as typeof fs.lstatSync);
  let prepared: ReturnType<typeof fixture.adapter.prepare>;
  try {
    prepared = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
  } finally {
    injected.mock.restore();
  }
  assert.ok(rejected >= 1);
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_plan_invalid");
  assert.equal(prepared.providerRequestIssued, false);
});

/**
 * production adapterは偽造Operationを実行前に拒否するを検証する。
 *
 * @responsibility production adapterは未発行のCapabilityと未接続Selection 選定入力を拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production adapterは未発行のCapabilityと未接続Selection 選定入力を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("production adapterは未発行のCapabilityと未接続Selection 選定入力を拒否する", () => {
  const prepared = startDockerProcessController(
    "codex",
    {
      purpose: "task",
      packetCapability: {},
      managementCapability: {},
      mountCapability: {},
      providerHome: {
        provider: "codex",
        providerHomeSourcePath: "C:\\home",
        providerHomeIdentityHash: "a".repeat(64),
        stableLogicalHomeBindingHash: "b".repeat(64),
      },
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    },
    () => true,
    undefined,
    {},
    [],
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.providerRequestStarted, false);
  void cancelExecutorAttempt({}, {}).then((result) =>
    assert.equal(result.status, "blocked"),
  );
});

/**
 * 固定選定を実際のProvider準備へ搬送し、fallbackを追加しない。
 * @trace PRL-UT-014
 * @precondition 固定選定と有限Host代役で準備する。
 * @stimulus Taskの技術計画を組み立てる。
 * @observation 元選定、購読種別、Providerの引数と開始前の結果。
 * @oracle 固定選定と隔離・ProxyのProvider差を維持し、公開向け結果に生の引数を出さない。
 * @cleanup N/A: 外部資源を開始しない。
 * @boundary Coordinatorの準備とExecutorの技術計画。
 */
test("固定選定とProxy条件を実計画で確認しfallbackを追加しない", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetCapability: {},
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  assert.deepEqual(
    prepared.plan.executionSelection,
    fixture.executionSelection,
  );
  assert.equal(
    prepared.plan.executionSelection.modelIdentifier,
    fixture.executionSelection.modelIdentifier,
  );
  assert.equal(
    prepared.plan.subscriptionOffering,
    "chatgpt_subscription_oauth",
  );
  assert.equal(prepared.providerRequestIssued, false);
  assert.equal(prepared.dockerEffectIssued, false);
  assert.equal("commands" in prepared.plan, false);
  assert.equal("providerAuthority" in prepared.plan, false);
  const provider = fixture
    .getTechnicalPlan()
    .commands.find((candidate) => candidate.purpose === "create_provider");
  assert.ok(provider);
  assert.equal(provider.argv.includes("--fallback-model"), false);
  assert.match(
    provider.argv[provider.argv.indexOf("--network") + 1] ?? "",
    /^crdd-internal-/u,
  );
  assert.equal(
    provider.argv[provider.argv.indexOf("--model") + 1],
    fixture.executionSelection.modelIdentifier,
  );
  for (const key of ["HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY"])
    assert.ok(provider.argv.some((arg) => arg.startsWith(`${key}=`)));
  assert.ok(provider.argv.includes("NO_PROXY="));
});

/**
 * 他の発行済みPacketや操作・役割・試行の差替えを起動前に拒否する。
 * @responsibility 完全選定の各fieldとstage相関を独立に反証する。
 * @trace PRL-UT-014
 * @precondition 正規Executor選定と同じPacket基準Hashを合成する。
 * @stimulus 選定入力だけ又はPacketだけの一項目を変更する。
 * @observation 拒否、計画拒否、Plan非発行とProvider要求非発行を確認する。
 * @oracle 不一致は全件blockedで、Plan非発行。
 * @cleanup N/A: 実Docker・Processを作らない。
 * @boundary PRL-UT-014=N/A: 局所準備の代役。
 */
test("別の発行済みPacket・stage差替えをProvider Effect前に拒否する", () => {
  const original = executionSelection("executor", {
    provider: "codex",
    model: "gpt-5.5",
    effort: "low",
  });
  const changes: Record<string, unknown>[] = [
    { provider: "claude" },
    { modelIdentifier: "other-model" },
    { identifierKind: "alias" },
    { reasoningEffort: "high" },
    { purpose: "advice" },
    { catalogIdentity: "f".repeat(64) },
    { configIdentity: "e".repeat(64) },
    { role: "independent_reviewer" },
    { workType: "other" },
    { source: "role_default" },
  ];
  for (const change of changes) {
    const selected = { ...original, ...change };
    const fixture = createFixture(
      {
        executionSelection: selected as typeof original,
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetRef: "TASKPKT-FFEEDDCCBBAA99887766554433221100",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
    assert.equal(result.status, "blocked", JSON.stringify(change));

    assert.equal(result.providerRequestIssued, false);
  }
  for (const changed of [
    { operationId: "OP-999999" },
    { taskAttempt: 1 },
    { taskPacketRef: "TASKPKT-FFEEDDCCBBAA99887766554433221100" },
    { taskRole: "reviewer" },
  ]) {
    const fixture = createFixture(
      {
        consumeTaskPacket: () =>
          ({
            operationId: "OP-123456",
            taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
            taskRole: "executor" as const,
            taskAttempt: 0 as const,
            executionSelection: original,
            taskPacketHash: "a".repeat(64),
            prompt: "Synthetic bounded instruction",
            additionalHosts: Object.freeze([]),
            promptTransport: "provider_stdin_only" as const,
            ...changed,
          }) as ReturnType<
            NonNullable<
              Parameters<
                typeof createAttemptPreparation<"codex">
              >[1]["consumeTaskPacket"]
            >
          >,
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
    assert.equal(result.status, "blocked", JSON.stringify(changed));
  }
});

/**
 * 固定利用側を相関IDから独立して計画へ搬送し、不正値を準備前に拒否する。
 *
 * @responsibility 三利用側の搬送と不正値時の計画拒否・Plan非発行を確認する。
 * @trace PRL-UT-014
 * @precondition 固定Task Packetと模擬Mountを持つ準備Adapterを使用する。
 * @stimulus 各利用側を相関あり・なしで準備し、不正値も渡す。
 * @observation 返された計画、Operation観測回数と返却理由を読む。
 * @oracle 利用側は入力定数と一致し、不正値時はOperation観測0で拒否する。
 * @cleanup N/A: Process外資源を生成しない。
 * @boundary PRL-UT-014=Direct Boundary: Task準備入口→固定Provider計画。
 */
test("固定利用側は相関IDと独立し不正値はOperation観測前に拒否する", () => {
  for (const consumer of [
    "coordinator_cli",
    "workbench",
    "coordinator",
  ] as const) {
    for (const correlation of [null, "task-correlation"]) {
      const fixture = createFixture({}, true);
      const prepared = fixture.adapter.prepare({
        purpose: "task",
        managementCapability: fixture.managementCapability,
        mountCapability: fixture.mountCapability,
        providerHome: fixture.providerHome,
        packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskAttempt: 0,
        recoveryCorrelationId: correlation,
        consumer: consumer,
        packetCapability: Object.freeze({}),
      });
      assert.equal(prepared.status, "prepared");
      const plan = fixture.getTechnicalPlan();
      assert.ok(plan);
      assert.equal(prepared.plan.consumer, consumer);
      assert.equal(prepared.plan.recoveryCorrelationId, correlation);
    }
  }
  for (const consumer of [
    undefined,
    null,
    "unknown",
    "orchestrator",
    "transient",
    "durable",
    {},
    0,
  ]) {
    let activationCount = 0;
    const fixture = createFixture(
      {
        verifyOperationMount: () => {
          activationCount += 1;
          throw new Error("unexpected_mount_activation");
        },
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: consumer,
      packetCapability: Object.freeze({}),
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "codex_docker_runtime_consumer_invalid");
    assert.equal(activationCount, 0);
  }
});
