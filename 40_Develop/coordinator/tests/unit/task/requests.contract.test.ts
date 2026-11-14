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
} from "../../../src/input/snapshot.ts";
import { inspectSingleTaskCommand } from "../../../src/task/requests.ts";

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
    new URL("../../../src/task/requests.ts", import.meta.url),
    "utf8",
  );
  let effects = 0;
  const forbidden = () => {
    effects += 1;
    throw new Error("effect_forbidden");
  };
  const create = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "createCoordinatorTaskRequests"))});`,
    [
      "inspectSingleTaskCommand",
      "readState",
      "verifyRuntimePersistenceRepository",
      "inspectExecutionSelection",
      "inspectTaskExecutionSelections",
      "randomUUID",
      "createCoordinatorSnapshotStatePort",
    ],
  )(
    () => ({ mode: "read_only_advice" }),
    () => ({
      status: "completed",
      value: { queueEntries: [], intakeEpoch: "epoch" },
    }),
    (value: unknown) => value,
    inspectExecutionSelection,
    inspectTaskExecutionSelections,
    forbidden,
    forbidden,
  ) as (deps: object) => {
    start: (raw: unknown) => Promise<{ status: string; reason: string }>;
  };
  for (const primary of [null, {}, { provider: "codex", unknown: true }]) {
    const owner = create({
      authorize: () => true,
      root: "C:/synthetic",
      binding: "binding",
      resolveSelection: () => ({ primary, taskExecutionSelections: null }),
      observeRevision: () => "a".repeat(40),
      execute: forbidden,
    });
    const result = await owner.start({});
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "orchestrator_task_configuration_unavailable");
  }
  assert.equal(effects, 0);
});

/**
 * 受付済み選定の受渡しでは再捕捉せず、実行直前の認可とRootは再確認する。
 * @responsibility 内部重複の撤去と外部境界の保持を分けて検証する。
 * @trace PRL-UT-006
 * @precondition 実openTaskSession宣言を有限の保存・実行代替へ接続する。
 * @stimulus 捕捉済みrecord、失効した認可、変わったRootと取消を渡す。
 * @observation Adviceへ渡した選定の同一参照と実行回数。
 * @oracle 正常時は同じ値を渡し、三拒否経路では実行しない。
 * @cleanup メモリ内値のみ。保存・Process・Dockerなし。
 * @boundary 受付から用途実行への内部接続。実保存成立の試験ではない。
 */
test("単発内部実行は捕捉済み選定を渡し認可・Root・取消を維持する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/task/requests.ts", import.meta.url),
    "utf8",
  );
  let authorized = true;
  let root = "C:/synthetic";
  let calls = 0;
  let received: unknown;
  const names = [
    "isPrincipalId",
    "resolveVerifiedRepositoryRoot",
    "initializeExecutionStore",
    "verifyRuntimePersistenceRepository",
    "deriveCoordinatorRepositoryBindingId",
    "observeLeaseOwner",
    "createCoordinatorTaskRequests",
    "runRepositoryAdvice",
    "inspectExecutionSelection",
  ];
  const values = [
    () => true,
    () => root,
    () => ({ status: "completed" }),
    (value: unknown) => value,
    () => "binding",
    () => undefined,
    (options: unknown) => options,
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
  const open = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "openTaskSession"))});`,
    names,
  )(...values) as (context: object) => {
    execute: (
      ...args: unknown[]
    ) => Promise<{ status: string; reason: string }>;
  };
  const owner = open({
    rootCapability: {},
    projectId: "project",
    principalId: "operator",
    authorize: () => authorized,
  });
  const selection = Object.freeze({ accepted: "selection" });
  const execution = {
    record: { executionSelection: selection, operationId: "operation" },
  };
  const command = { mode: "read_only_advice" };
  const signal = new AbortController();
  const invoke = () =>
    owner.execute(
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
    new URL("../../../src/task/requests.ts", import.meta.url),
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
    mode: "read_only_advice",
    workType: null,
    prompt: "合成入力",
    contextReferences: ["PROJECT_CONTEXT.md"],
    allowedPaths: [],
    workspaceId: null,
  };
  assert.ok(inspectSingleTaskCommand(command));
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
    new URL("../../../src/task/requests.ts", import.meta.url),
    "utf8",
  );
  const project = runInNewContext(
    `(${stripTypeScriptTypes(sourceDeclaration(source, "view"))})`,
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
