/**
 * 現在回収Ownerと実DI Executorの固定Process要求を結合する。
 * @packageDocumentation
 * @responsibility ID保存・読戻し前の削除と観測不能の成功化を反証する。
 * @trace ERB-IT-014
 * @trace PRL-IT-005
 * @level IT
 * @scope 本番回収・Orchestrator待機本文、模擬現在状態、実空configとspawnSync差替え。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収Owner→Docker Isolation。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test, { mock, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { runInNewContext } from "node:vm";
import { isDockerRestartCheckpointSettled } from "../../src/execution/restart-checkpoint.ts";
import {
  coordinatorTaskResourcesAreSettled,
  coordinatorAuthenticationUnknownCanClose,
} from "../../src/storage/model.ts";
import {
  createDockerOperationRecoveryExecutor,
  createDockerResourceRecoveryExecutor,
  isDockerResourcePurpose,
  observeDockerRecoveryConfigIdentity,
  planDockerRecoveryResourceExpectations,
} from "../../../docker-isolation/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
  snapshotPlainRecord,
} from "../../../domain-model/src/index.ts";

/**
 * 修復wrapperと排他内guardの対象外拒否を本番本文で反証する。
 * @responsibility codecの拒否に依存せず各guardを除去した負対照を確認する。
 * @trace ERB-IT-014
 * @precondition 実Sourceの一意区間、メモリSnapshotと受理codec代役。
 * @stimulus Task・別修復・未解決参照・配送の変更と除去を加える。
 * @observation 下位Writer要求counter、guard後継続counter、元本文不変。
 * @oracle 元guardは0、当該guard無効化時だけ1へ進む。
 * @cleanup N/A: VM内だけで実Writer・Kernel・Filesystemは使わない。
 * @boundary ERB-IT-014=Direct Boundary: 本番修復scope guardの分離Oracle。
 */
test("修復Writerの二重scope guardは他操作と参照の変更・除去を拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/storage/settlement-store.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf(
    "export function writeRuntimeOwnedCoordinatorRepairSnapshot(",
  );
  const end = text.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const dispatchStart = text.indexOf("function validateRepairWriteCandidate(");
  const dispatch = stripTypeScriptTypes(
    text.slice(dispatchStart, text.indexOf("\n/**", dispatchStart)),
  );
  assert.ok(dispatchStart > 0);
  const wrapper = stripTypeScriptTypes(text.slice(start, end)).replace(
    "export function",
    "function",
  );
  const guardStart = wrapper.indexOf("      encodeCoordinatorStateValue(");
  const guardEnd = wrapper.indexOf(
    "      !validateRepairWriteCandidate(",
    guardStart,
  );
  assert.ok(guardStart > 0 && guardEnd > guardStart);
  const wrapperMutant = wrapper.slice(0, guardStart) + wrapper.slice(guardEnd);
  const writer = text.indexOf("function writeCoordinatorStateSnapshot(");
  const boundaryStart = text.indexOf("    if (currentRepair) {", writer);
  const boundaryEnd = text.indexOf(
    "    let completionConfirmed",
    boundaryStart,
  );
  assert.ok(boundaryStart > writer && boundaryEnd > boundaryStart);
  const boundary = stripTypeScriptTypes(text.slice(boundaryStart, boundaryEnd));
  const boundaryMutant = boundary.replace(
    'throw new Error("repair_writer_scope_invalid");',
    "void 0;",
  );
  assert.notEqual(boundaryMutant, boundary);
  const repository = {
    repositoryRoot: "root",
    repositoryBinding: "a".repeat(64),
    operationId: "OP-123456",
    revalidate: () => true,
  };
  const target = {
    kind: "runtime_repair",
    recoveryId: "target",
    identityJson: '{"operationId":"OP-123456"}',
    checkpoint: 0,
    summarySha256: null,
    history: null,
  };
  const before = {
    operations: [
      target,
      { kind: "docker_task", recoveryId: "task", value: 0 },
      { kind: "runtime_repair", recoveryId: "other", value: 0 },
    ],
    unresolvedRecoveries: [{ value: 0 }],
    pendingDeliveries: [{ value: 0 }],
  };
  const original = JSON.stringify(before);
  for (const scenario of [
    "preserved",
    "task_changed",
    "task_removed",
    "repair_changed",
    "repair_removed",
    "recovery_changed",
    "recovery_removed",
    "delivery_changed",
    "delivery_removed",
  ]) {
    const after = JSON.parse(original);
    after.operations[0].checkpoint = 1;
    if (scenario === "task_changed") after.operations[1].value = 1;
    if (scenario === "task_removed") after.operations.splice(1, 1);
    if (scenario === "repair_changed") after.operations[2].value = 1;
    if (scenario === "repair_removed") after.operations.splice(2, 1);
    if (scenario === "recovery_changed")
      after.unresolvedRecoveries[0].value = 1;
    if (scenario === "recovery_removed") after.unresolvedRecoveries = [];
    if (scenario === "delivery_changed") after.pendingDeliveries[0].value = 1;
    if (scenario === "delivery_removed") after.pendingDeliveries = [];
    const beforeBytes = Buffer.from(original),
      bytes = Buffer.from(JSON.stringify(after));
    for (const mutated of [false, true]) {
      let requests = 0;
      const evaluateWrapper = runInNewContext(
        `${dispatch}\n${mutated ? wrapperMutant : wrapper}; writeRuntimeOwnedCoordinatorRepairSnapshot`,
        {
          Buffer,
          types: utilTypes,
          settlements: new WeakMap(),
          initializations: new WeakMap(),
          borrowRuntimeOwnedCoordinatorRecoveryRepository: () => repository,
          decodeCoordinatorStateSnapshot: (value: Buffer) => ({
            snapshot: JSON.parse(value.toString("utf8")),
          }),
          validateCoordinatorStateTransition: () => true,
          encodeCoordinatorStateValue: JSON.stringify,
          writeCoordinatorStateSnapshot: (_owner: unknown, root: unknown) => {
            if (root) requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
        },
      );
      evaluateWrapper(
        {},
        "target",
        beforeBytes,
        bytes,
        () => true,
        "checkpoint",
      );
      assert.equal(requests, scenario === "preserved" || mutated ? 1 : 0);
      let continuations = 0;
      /**
       * 現在Owner境界の実本文と変異を同じVMで評価する。
       * @responsibility 現在Owner境界の実本文と変異を同じVMで評価する。
       * @trace ERB-IT-014
       * @precondition 現repair記録と固定状態byte・Owner確認。
       * @stimulus 対象境界をVMへ結合し継続到達を数える。
       * @observation 拒否結果、継続回数と保存本文。
       * @oracle Owner喪失や元版差では後続処置0・本文不変。
       * @cleanup VMの有限代役を評価後に破棄する。
       * @boundary 実Sourceの境界断面。実Host・Docker操作なし。
       */
      const evaluateBoundary = () =>
        runInNewContext(
          `(function(){${mutated ? boundaryMutant : boundary}; proceed();})()`,
          {
            currentRepair: {
              repository,
              recoveryId: "target",
              before: beforeBytes,
              candidate: bytes,
              assertOwner: () => true,
            },
            repository,
            candidate: { snapshot: after },
            current: { snapshot: before },
            currentBytes: beforeBytes,
            bytes,
            encodeCoordinatorStateValue: JSON.stringify,
            proceed: () => continuations++,
          },
        );
      if (scenario === "preserved" || mutated)
        assert.doesNotThrow(evaluateBoundary);
      else assert.throws(evaluateBoundary, /repair_writer_scope_invalid/u);
      assert.equal(continuations, scenario === "preserved" || mutated ? 1 : 0);
      if (scenario !== "preserved" && mutated) {
        assert.throws(() => assert.equal(requests, 0));
        assert.throws(() => assert.equal(continuations, 0));
      }
      assert.equal(JSON.stringify(before), original);
    }
  }
});

/**
 * 認証限定終了の保存Owner取り違えを外側と排他内で独立に拒否する。
 * @responsibility 本番guardを抽出し、対象相関の省略変異を同じOracleで検出する。
 * @trace ERB-IT-014
 * @precondition 自己生成メモリ値と実Source本文だけを使う。
 * @stimulus 同Repositoryの別操作、重複対象、候補Identity差、Owner失効を与える。
 * @observation 下位Writer到達数と排他内guard後の継続数、元byte不変。
 * @oracle 正例だけ各一回。各guard省略変異は誤継続として検出する。
 * @cleanup N/A: VMだけで実Kernel・Filesystem・Dockerは使わない。
 * @boundary ERB-IT-014=Direct Boundary: 専用Writerの対象相関。物理保存の証明ではない。
 */
test("認証限定Writerの二重対象相関は別操作Ownerを拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/storage/settlement-store.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf(
    "export function writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(",
  );
  const end = text.indexOf("\nconst settlements =", start);
  assert.ok(start > 0 && end > start);
  const wrapper = stripTypeScriptTypes(text.slice(start, end)).replace(
    "export function",
    "function",
  );
  const guardStart = wrapper.indexOf("    if (\n      beforeTasks");
  const guardEnd = wrapper.indexOf("    const binding =", guardStart);
  assert.ok(guardStart > 0 && guardEnd > guardStart);
  const wrapperMutant = wrapper.slice(0, guardStart) + wrapper.slice(guardEnd);
  const innerStart = text.indexOf("    if (currentAuthenticationClosure) {");
  const innerEnd = text.indexOf("    } else if (", innerStart);
  assert.ok(innerStart > 0 && innerEnd > innerStart);
  const inner = stripTypeScriptTypes(
    `${text.slice(innerStart, innerEnd)}\n    }`,
  );
  const innerGuardStart = inner.indexOf("      if (");
  const innerGuardEnd = inner.indexOf(
    '        throw new Error("authentication_closure_context");',
    innerGuardStart,
  );
  assert.ok(innerGuardStart > 0 && innerGuardEnd > innerGuardStart);
  const innerMutant =
    inner.slice(0, innerGuardStart) +
    inner.slice(
      innerGuardEnd +
        '        throw new Error("authentication_closure_context");'.length,
    );
  const repository = {
    repositoryRoot: "fixed-root",
    repositoryBinding: "a".repeat(64),
    operationId: "OP-A",
    revalidate: () => true,
  };
  for (const scenario of [
    "valid",
    "other_owner",
    "duplicate_before",
    "duplicate_candidate",
    "identity_changed",
    "owner_lost",
  ]) {
    const target = {
      kind: "docker_task",
      recoveryId: "exact",
      identityJson: JSON.stringify({
        operationId: scenario === "other_owner" ? "OP-B" : "OP-A",
      }),
    };
    const other = {
      kind: "docker_task",
      recoveryId: "other",
      identityJson: '{"operationId":"OP-B"}',
    };
    const before = {
      operations: [
        target,
        other,
        ...(scenario === "duplicate_before" ? [target] : []),
      ],
    };
    const after = JSON.parse(JSON.stringify(before));
    if (scenario === "duplicate_before") after.operations.pop();
    if (scenario === "duplicate_candidate") after.operations.push(target);
    if (scenario === "identity_changed")
      after.operations[0].identityJson =
        '{"operationId":"OP-A","different":true}';
    const beforeBytes = Buffer.from(JSON.stringify(before));
    const bytes = Buffer.from(JSON.stringify(after));
    for (const mutant of [false, true]) {
      let requests = 0;
      const evaluateWrapper = runInNewContext(
        `${mutant ? wrapperMutant : wrapper}; writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure`,
        {
          Buffer,
          types: utilTypes,
          settlements: new WeakMap(),
          encodeCoordinatorStateValue: JSON.stringify,
          decodeCoordinatorStateSnapshot: (value: Buffer) => ({
            snapshot: JSON.parse(value.toString()),
          }),
          prepareCoordinatorAuthenticationUnknownClosureSnapshot: () => bytes,
          writeCoordinatorStateSnapshot: (_owner: unknown, root: unknown) => {
            if (root) requests++;
            return { status: "blocked", filesystemEffectIssued: false };
          },
        },
      );
      evaluateWrapper(
        repository,
        "exact",
        beforeBytes,
        [],
        () => scenario !== "owner_lost",
      );
      assert.equal(
        requests,
        scenario === "valid" || (mutant && scenario !== "owner_lost") ? 1 : 0,
        `${scenario}: wrapper`,
      );
      let continuations = 0;
      /**
       * authunknownの内側再入場境界を局所評価する。
       * @responsibility authunknownの内側再入場境界を局所評価する。
       * @trace ERB-IT-014
       * @precondition 固定current/Ownerとauthunknown記録。
       * @stimulus 内側本文へ同じbindingと故障を渡す。
       * @observation 継続回数、blockedと元記録。
       * @oracle Owner失効・current差を既知不存在へ丸めない。
       * @cleanup N/A: メモリ上のVM評価のみ。
       * @boundary auth再入場のSource断面。実回復成功ではない。
       */
      const evaluateInner = () =>
        runInNewContext(
          `(function(){${mutant ? innerMutant : inner}; proceed();})()`,
          {
            currentAuthenticationClosure: {
              repository,
              recoveryId: "exact",
              before: beforeBytes,
              candidate: bytes,
              observations: [],
              assertOwner: () => scenario !== "owner_lost",
            },
            current: { snapshot: before },
            candidate: { snapshot: after },
            currentBytes: beforeBytes,
            bytes,
            repository,
            prepareCoordinatorAuthenticationUnknownClosureSnapshot: () => bytes,
            proceed: () => continuations++,
          },
        );
      if (scenario === "valid" || mutant) assert.doesNotThrow(evaluateInner);
      else assert.throws(evaluateInner, /authentication_closure_context/u);
      assert.equal(continuations, scenario === "valid" || mutant ? 1 : 0);
      if (mutant && scenario !== "valid" && scenario !== "owner_lost") {
        assert.throws(() => assert.equal(requests, 0));
        assert.throws(() => assert.equal(continuations, 0));
      }
      assert.equal(beforeBytes.toString(), JSON.stringify(before));
    }
  }
});

/**
 * 初期化後の保存拒否・例外で既発行Effectを失わない。
 * @responsibility 本番wrapper本文の集約を保存本体・Kernelの成立と分ける。
 * @trace ERB-IT-014
 * @precondition 所有試験Directory、実wrapper本文と依存代役。
 * @stimulus 初期化拒否・部分作成・成功後Writer拒否／例外を与える。
 * @observation 実作成物、返却Effect、保存未確定と下位要求counter。
 * @oracle 初期化のEffectは後続結果とORし、保存成功へ補完しない。
 * @cleanup 所有子だけを境界確認して削除し不存在を確認する。
 * @boundary ERB-IT-014=Direct Boundary: wrapperのEffect集約。実Kernelは別Host Case。
 */
test("修復Writer wrapperは初期化Effectを後続拒否・例外から保全する", (t) => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "tests",
  );
  const root = fs.mkdtempSync(
    path.join(area.directory, "repair-writer-wrapper-"),
  );
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.ok(
      root.startsWith(`${area.directory}${path.sep}repair-writer-wrapper-`),
    );
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
    if (fs.readdirSync(area.directory).length === 0)
      fs.rmdirSync(area.directory);
  });
  const text = fs.readFileSync(
    new URL("../../src/storage/settlement-store.ts", import.meta.url),
    "utf8",
  );
  const start = text.indexOf(
    "export function writeRuntimeOwnedCoordinatorRepairSnapshot(",
  );
  const body = stripTypeScriptTypes(
    text.slice(start, text.indexOf("\n/**", start)),
  ).replace("export function", "function");
  const dispatchStart = text.indexOf("function validateRepairWriteCandidate(");
  const dispatch = stripTypeScriptTypes(
    text.slice(dispatchStart, text.indexOf("\n/**", dispatchStart)),
  );
  assert.ok(dispatchStart > 0);
  const mutant = body.replace(
    /initializationEffectIssued\s*\|\|\s*saved.filesystemEffectIssued/u,
    "saved.filesystemEffectIssued",
  );
  assert.notEqual(mutant, body);
  for (const mode of [
    "init_rejected",
    "init_partial",
    "writer_lock",
    "writer_owner",
    "writer_throw",
  ]) {
    const directory = path.join(root, mode);
    let calls = 0;
    const candidate = {
      operations: [
        {
          kind: "runtime_repair",
          recoveryId: "target",
          identityJson: '{"operationId":"OP-123456"}',
          summarySha256: null,
          history: null,
        },
      ],
      unresolvedRecoveries: [],
      pendingDeliveries: [],
    };
    /**
     * 回復Writer断面へ固定Repo・state・Capabilityを結合する。
     * @responsibility 回復Writer断面へ固定Repo・state・Capabilityを結合する。
     * @trace ERB-IT-014
     * @precondition 抽出Sourceとcreate代役。
     * @stimulus 実Writer本文をVMで生成し入力を渡す。
     * @observation 保存要求・返却理由・参照相関。
     * @oracle scopeとOwnerの差を保存成功へ変換しない。
     * @cleanup VM用代役を破棄し実記録を書き換えない。
     * @boundary Writerの局所境界。実Filesystem変更なし。
     */
    const evaluate = (source: string, create: boolean) => {
      const wrapper = runInNewContext(
        `${dispatch}\n${source}; writeRuntimeOwnedCoordinatorRepairSnapshot`,
        {
          Buffer,
          Object,
          Promise,
          types: utilTypes,
          settlements: new WeakMap(),
          initializations: new WeakMap(),
          borrowRuntimeOwnedCoordinatorRecoveryRepository: () => ({
            repositoryRoot: root,
            repositoryBinding: "a".repeat(64),
            revalidate: () => true,
          }),
          decodeCoordinatorStateSnapshot: () => ({ snapshot: candidate }),
          validateCoordinatorStateTransition: () => true,
          encodeCoordinatorStateValue: JSON.stringify,
          prepareCoordinatorStateInitialization: () => {
            if (create && mode !== "init_rejected") fs.mkdirSync(directory);
            return {
              status: mode.startsWith("init_") ? "blocked" : "prepared",
              effectIssued: mode !== "init_rejected",
              lockReleased: true,
            };
          },
          writeCoordinatorStateSnapshot: (
            _owner: unknown,
            repository: unknown,
          ) => {
            if (!repository)
              return {
                status: "blocked",
                reason: "coordinator_state_input_invalid",
                snapshotConfirmed: false,
                filesystemEffectIssued: false,
                lockReleased: true,
              };
            calls++;
            if (mode === "writer_throw") throw new Error("synthetic");
            return {
              status: "blocked",
              reason:
                mode === "writer_lock"
                  ? "coordinator_state_lock_unavailable"
                  : "coordinator_state_storage_unconfirmed",
              snapshotConfirmed: false,
              filesystemEffectIssued: false,
              lockReleased: mode !== "writer_lock",
            };
          },
        },
      );
      return wrapper(
        {},
        "target",
        null,
        Buffer.from(JSON.stringify(candidate)),
        () => true,
        "checkpoint",
      );
    };
    const result = evaluate(body, true);
    assert.equal(result.status, "blocked");
    assert.equal(result.snapshotConfirmed, false);
    assert.equal(result.filesystemEffectIssued, mode !== "init_rejected");
    assert.equal(fs.existsSync(directory), mode !== "init_rejected");
    assert.equal(calls, mode.startsWith("init_") ? 0 : 1);
    if (mode.startsWith("init_"))
      assert.equal(
        result.reason,
        "coordinator_state_initialization_unconfirmed",
      );
    if (mode === "writer_lock") {
      assert.equal(result.reason, "coordinator_state_lock_unavailable");
      assert.equal(result.lockReleased, false);
      const changed = evaluate(mutant, false);
      assert.throws(() => assert.equal(changed.filesystemEffectIssued, true));
    }
  }
});

/**
 * Task Writer内の修復保全guardを本番区間から直接反証する。
 * @responsibility 純粋codecの成功を実Writer側の拒否確認へ流用しない。
 * @trace ERB-IT-014
 * @precondition 本番Writerの一意なguard区間とメモリ内Snapshot。
 * @stimulus Repair新規・変更・除去、Task更新とguard除去変異を与える。
 * @observation guard通過後の保存継続counterと入力全文不変。
 * @oracle 不正候補は継続0、正対照は1。各guard除去は同じOracleを破る。
 * @cleanup N/A: VM内だけで実FileやKernelは使わない。
 * @boundary ERB-IT-014=Direct Boundary: Task Writerの対象外Repair保全guard。
 */
test("Task Writerの修復保全guardは新規・変更・除去を拒否する", () => {
  const text = fs.readFileSync(
    new URL("../../src/storage/settlement-store.ts", import.meta.url),
    "utf8",
  );
  const functionStart = text.indexOf("function writeCoordinatorStateSnapshot(");
  const normalStart = text.indexOf(
    "    const previousOperations = new Map(",
    functionStart,
  );
  const normalEnd = text.indexOf(
    "      for (const resource of operation.resources)",
    normalStart,
  );
  const settlementStart = text.indexOf(
    "      for (const previous of current.snapshot.operations) {",
    functionStart,
  );
  const settlementEnd = text.indexOf(
    "        const next = candidate.snapshot.operations.find(",
    settlementStart,
  );
  const publication = text.indexOf('create("state.lock", marker)', normalEnd);
  assert.ok(
    functionStart >= 0 &&
      normalStart > functionStart &&
      normalEnd > normalStart,
  );
  assert.ok(
    settlementStart > functionStart &&
      settlementEnd > settlementStart &&
      settlementEnd < normalStart,
  );
  assert.ok(publication > normalEnd, "guardは保存開始より前に置く");
  const intervals = [
    {
      body: `${text.slice(normalStart, normalEnd)}\n}`,
      reason: "repair_writer_unconnected",
    },
    {
      body: `${text.slice(settlementStart, settlementEnd)}\n}`,
      reason: "repair_state_changed_by_task_settlement",
    },
  ];
  const repair = {
    kind: "runtime_repair",
    recoveryId: "repair",
    checkpoint: null,
  };
  const task = {
    kind: "docker_task",
    recoveryId: "task",
    phase: "executing",
    identityJson: '{"operationId":"OP-123456"}',
  };
  for (const [index, interval] of intervals.entries()) {
    const throwAt = interval.body.indexOf(
      `throw new Error("${interval.reason}")`,
    );
    const guardAt = interval.body.lastIndexOf("if (", throwAt);
    const guardEnd = interval.body.indexOf(";", throwAt) + 1;
    assert.ok(throwAt >= 0 && guardAt >= 0 && guardEnd > throwAt);
    const mutant =
      interval.body.slice(0, guardAt) + interval.body.slice(guardEnd);
    assert.notEqual(mutant, interval.body);
    const cases =
      index === 0
        ? ["new", "changed", "preserved"]
        : ["removed", "changed", "preserved"];
    for (const scenario of cases) {
      const before = {
        operations: scenario === "new" ? [task] : [task, repair],
      };
      const changedTask = { ...task, phase: "settling" };
      const after = {
        operations:
          scenario === "removed"
            ? [changedTask]
            : [
                changedTask,
                {
                  ...repair,
                  ...(scenario === "changed" ? { checkpoint: {} } : {}),
                },
              ],
      };
      const original = JSON.stringify({ before, after });
      for (const mutated of [false, true]) {
        let continuations = 0;
        /**
         * 回復の観測間隔境界をSource変異付きで検査する。
         * @responsibility 回復の観測間隔境界をSource変異付きで検査する。
         * @trace ERB-IT-014
         * @precondition 同じ保存byteとOwner確認の有限値。
         * @stimulus 実interval本文または変異をVMで評価する。
         * @observation 継続到達と状態byte。
         * @oracle 観測間の失効・版差で処置を止める。
         * @cleanup N/A: 実TimerやI/Oは生成しない。
         * @boundary 観測順序の局所Source評価。
         */
        const evaluate = () =>
          runInNewContext(
            `(function(){${stripTypeScriptTypes(mutated ? mutant : interval.body)}; proceed();})()`,
            {
              current: { snapshot: before },
              candidate: { snapshot: after },
              currentRepair: null,
              repairHistoryScopeConfirmed: false,
              currentHistory: null,
              encodeCoordinatorStateValue: JSON.stringify,
              proceed: () => {
                continuations++;
              },
            },
          );
        if (scenario === "preserved" || mutated) assert.doesNotThrow(evaluate);
        else assert.throws(evaluate, new RegExp(interval.reason));
        assert.equal(
          continuations,
          scenario === "preserved" || mutated ? 1 : 0,
        );
        if (scenario !== "preserved" && mutated)
          assert.throws(
            () => assert.equal(continuations, 0),
            "guard除去は拒否Oracleを破る",
          );
        assert.equal(JSON.stringify({ before, after }), original);
      }
    }
  }
});

const source = fs.readFileSync(
  new URL("../../src/execution/recovery.ts", import.meta.url),
  "utf8",
);
const start = source.indexOf(
  "export function currentDockerRecoveryResourceExpectations(",
);
const end = source.indexOf("function validProductionPlan(", start);
assert.ok(start >= 0 && end > start);
const body = stripTypeScriptTypes(
  source
    .slice(start, end)
    .replaceAll("export function", "function")
    .replaceAll("export async function", "async function"),
);
const purposes = [
  "create_egress_network",
  "create_internal_network",
  "create_provider",
  "create_proxy",
  "create_subscription_auth_probe",
] as const;
const id = "a".repeat(64);
const label = "crdd.coordinator.runtime=0123456789abcdef";
const name = "crdd-internal-0123456789abcdef";

/**
 * 退役処理と既存checkpoint本文を結合し、保存候補と読戻し境界を反証する。
 * @responsibility 旧Ownerの退役と資源清掃・Process終了の主張を混同しない。
 * @trace ERB-IT-014
 * @precondition 実Owner確認・退役・checkpoint本文とメモリWriterを使う。
 * @stimulus active／unknown、既退役、偽造、各排他・元版・保存・読戻しの失敗。
 * @observation Writer候補、Owner確認、元版、保存後本文と停止field。
 * @oracle 対象phaseとownerEffect以外は維持し、不明後の再入場はWriter0。
 * @cleanup N/A: 実Filesystem・Docker・Processを作成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 回収Owner→既存checkpoint Writer。
 */
test("現在回収退役: 元版・三排他・保存読戻しと非対象保持", () => {
  const ownerStart = source.indexOf("function assertCurrentRecoveryOwner(");
  const ownerEnd = source.indexOf(
    "function resolveCurrentRecoveryHostToken(",
    ownerStart,
  );
  const checkpointStart = source.indexOf(
    "export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(",
  );
  const checkpointEnd = source.indexOf(
    "export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(",
    checkpointStart,
  );
  assert.ok(
    ownerStart >= 0 && ownerEnd > ownerStart && checkpointEnd > checkpointStart,
  );
  const actualBody = stripTypeScriptTypes(
    `${source.slice(ownerStart, ownerEnd)}\n${source.slice(checkpointStart, checkpointEnd)}`.replaceAll(
      "export function",
      "function",
    ),
  );
  for (const scenario of [
    "active",
    "unknown",
    "disabled",
    "absent_disabled",
    "late_phase",
    "forged",
    "copy",
    "root",
    "marker",
    "lock_0",
    "lock_1",
    "lock_2",
    "lock_throw",
    "changed",
    "read_unlock",
    "writer_false",
    "writer_throw",
    "writer_unlock",
    "readback_revision",
    "readback_hash",
    "readback_throw",
    "completion_disabled",
    "completion_changed",
    "completion_blocked",
    "completion_null",
    "completion_unlock",
    "completion_throw",
    "completion_active",
    "history_disabled",
    "history_blocked",
    "history_null",
    "history_changed",
    "history_unlock",
    "history_throw",
    "history_active",
    "history_owner_lost",
    "history_host_present",
    "history_publication",
    "history_normal_unlock",
    "history_normal_throw",
  ]) {
    const operation = {
      kind: "docker_task",
      recoveryId: "exact",
      phase: scenario === "late_phase" ? "awaiting_delivery" : "executing",
      execution: {
        ownerEffect:
          scenario.includes("disabled") ||
          (scenario.startsWith("history_") && scenario !== "history_active") ||
          (scenario.startsWith("completion_") &&
            scenario !== "completion_active")
            ? "disabled"
            : scenario === "unknown"
              ? "unknown"
              : "active",
        providerStart: "not_started",
        providerSend: "not_issued",
        sharedWrite: "not_issued",
        workspaceReusable: false,
      },
      lease: "held",
      primaryFailure: { stage: "create", reason: "first" },
      outcome: null,
      summarySha256: null,
      resources: [{ request: "unknown" }],
      host: { cleanup: "pending" },
      dockerRestart: null,
      history: { status: "pending" },
    };
    const original = {
      revision: 7,
      operations: [operation, { recoveryId: "other", untouched: [1, 2, 3] }],
    };
    let saved = structuredClone(original);
    const before = Buffer.from(`${JSON.stringify(original)}\n`);
    const capability = {},
      root = {};
    let ownerLive = true;
    const record = {
      kind: "recovery",
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      completionPending: scenario.startsWith("completion_"),
      hostCleanup:
        scenario === "absent_disabled" ||
        scenario.startsWith("completion_") ||
        (scenario.startsWith("history_") && scenario !== "history_host_present")
          ? "absent"
          : "present",
      hostCleanupPublication: scenario === "history_publication" ? {} : null,
      hostToken: "token",
      hostRoot: "host",
      hostNonce: "nonce",
      hostGeneration: {},
      rootCapability: root,
      recoveryId: "exact",
      before,
      repository: { revalidate: () => scenario !== "root" && ownerLive },
      locks: [0, 1, 2].map((i) => ({
        assertLive() {
          if (scenario === "lock_throw") throw new Error("lock");
          return scenario !== `lock_${i}`;
        },
      })),
    };
    let writes = 0,
      reads = 0,
      completionReads = 0,
      historyReads = 0;
    const retire = runInNewContext(
      `${actualBody}; retireRuntimeOwnedDockerTaskExecutionOwner`,
      {
        Buffer,
        Object,
        JSON,
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        encodeCoordinatorStateValue: JSON.stringify,
        verifyHostOperationRecoveryGeneration() {
          if (scenario === "marker") throw new Error("marker");
        },
        loadHostRecoveryRecordByToken: () => ({ parsed: { nonce: "nonce" } }),
        observeHostRecoveryCleanup: () => ({
          root: "absent",
          marker: "absent",
        }),
        readRuntimeOwnedCoordinatorRecoverySnapshot(receivedRoot: unknown) {
          assert.equal(record.completionPending, false);
          assert.equal(receivedRoot, root);
          reads++;
          if (scenario.startsWith("history_")) {
            if (scenario === "history_normal_throw")
              throw new Error("normal read failed");
            return {
              status: "blocked",
              lockReleased: scenario !== "history_normal_unlock",
              value: null,
            };
          }
          if (reads > 1 && scenario === "readback_throw")
            throw new Error("readback");
          const snapshot = structuredClone(saved);
          if (
            scenario === "changed" ||
            (reads > 1 && scenario === "readback_revision")
          )
            snapshot.revision++;
          return {
            status: "completed",
            lockReleased: scenario !== "read_unlock",
            value: {
              snapshot,
              payloadSha256:
                reads > 1 && scenario === "readback_hash" ? "changed" : "saved",
            },
          };
        },
        readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
          receivedRoot: unknown,
          receivedId: string,
        ) {
          assert.equal(record.completionPending, true);
          assert.equal(receivedRoot, root);
          assert.equal(receivedId, record.recoveryId);
          completionReads++;
          if (scenario === "completion_throw")
            throw new Error("completion read");
          const snapshot = structuredClone(saved);
          if (scenario === "completion_changed") snapshot.revision++;
          return {
            status: scenario === "completion_blocked" ? "blocked" : "completed",
            lockReleased: scenario !== "completion_unlock",
            value:
              scenario === "completion_null"
                ? null
                : { snapshot, payloadSha256: "saved" },
          };
        },
        readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
          receivedRoot: unknown,
          receivedId: string,
        ) {
          assert.equal(receivedRoot, root);
          assert.equal(receivedId, record.recoveryId);
          historyReads++;
          if (scenario === "history_throw")
            throw new Error("history read failed");
          const snapshot = structuredClone(saved);
          if (scenario === "history_changed") snapshot.revision++;
          if (scenario === "history_owner_lost") ownerLive = false;
          return {
            status: scenario === "history_blocked" ? "blocked" : "completed",
            lockReleased: scenario !== "history_unlock",
            value:
              scenario === "history_null"
                ? null
                : { snapshot, payloadSha256: "saved" },
          };
        },
        writeRuntimeOwnedCoordinatorRecoveryCheckpoint(
          repository: unknown,
          recoveryId: string,
          prior: Buffer,
          kind: string,
          candidate: Record<string, unknown>,
          owner: () => boolean,
        ) {
          writes++;
          assert.equal(repository, record.repository);
          assert.equal(recoveryId, "exact");
          assert.equal(kind, "lifecycle");
          assert.ok(prior.equals(before));
          assert.equal(owner(), true);
          const expected = {
            phase: "settling",
            lease: operation.lease,
            execution: { ...operation.execution, ownerEffect: "disabled" },
            primaryFailure: operation.primaryFailure,
            outcome: null,
            summarySha256: null,
          };
          assert.deepEqual(JSON.parse(JSON.stringify(candidate)), expected);
          if (scenario === "writer_throw") throw new Error("writer");
          saved = {
            ...saved,
            revision: 8,
            operations: [
              { ...operation, ...JSON.parse(JSON.stringify(candidate)) },
              original.operations[1],
            ],
          } as typeof saved;
          return {
            status: scenario === "writer_false" ? "blocked" : "completed",
            snapshotConfirmed: true,
            lockReleased: scenario !== "writer_unlock",
            revision: 8,
            payloadSha256: "saved",
          };
        },
      },
    ) as (key: unknown) => boolean;
    const success = [
      "active",
      "unknown",
      "disabled",
      "absent_disabled",
      "completion_disabled",
      "history_disabled",
    ].includes(scenario);
    assert.equal(
      retire(
        scenario === "forged"
          ? {}
          : scenario === "copy"
            ? { ...capability }
            : capability,
      ),
      success,
      scenario,
    );
    const writeExpected = [
      "active",
      "unknown",
      "writer_false",
      "writer_throw",
      "writer_unlock",
      "readback_revision",
      "readback_hash",
      "readback_throw",
    ].includes(scenario);
    assert.equal(writes, writeExpected ? 1 : 0, scenario);
    if (record.completionPending) {
      assert.equal(reads, 0, scenario);
      assert.equal(completionReads, 1, scenario);
      assert.equal(writes, 0, scenario);
      assert.equal(
        record.cleanupUnknown,
        scenario === "completion_unlock",
        scenario,
      );
      assert.deepEqual(saved, original);
    } else assert.equal(completionReads, 0, scenario);
    assert.equal(
      historyReads,
      scenario.startsWith("history_") &&
        ![
          "history_host_present",
          "history_publication",
          "history_normal_unlock",
          "history_normal_throw",
        ].includes(scenario)
        ? 1
        : 0,
      scenario,
    );
    if (scenario.startsWith("history_")) {
      assert.equal(writes, 0, scenario);
      assert.deepEqual(saved, original, scenario);
      assert.equal(
        record.cleanupUnknown,
        ["history_unlock", "history_normal_unlock"].includes(scenario),
        scenario,
      );
    }
    if (["active", "unknown"].includes(scenario)) {
      const expected = structuredClone(original);
      expected.revision = 8;
      expected.operations[0] = {
        ...operation,
        phase: "settling",
        execution: { ...operation.execution, ownerEffect: "disabled" },
      };
      assert.deepEqual(saved, expected);
      assert.ok(
        record.before.equals(Buffer.from(`${JSON.stringify(expected)}\n`)),
      );
    }
    if (writeExpected && !success) {
      assert.equal(record.persistenceFailed, true, scenario);
      assert.equal(retire(capability), false, scenario);
      assert.equal(writes, 1, scenario);
    }
  }
});

/**
 * 回収Ownerの外側排他解放を、終端保存前の独立した事実として確認する。
 * @responsibility 全逆順解放、一回性と過去不明の保持を本番本文で反証する。
 * @trace ERB-IT-014
 * @precondition メモリ内のOwnerと模擬排他だけを使用する。
 * @stimulus 正常、false、例外、過去不明、偽造、別種別と再入場を渡す。
 * @observation 各releaseの順序・回数、Ownerの閉鎖と確認field、元本文。
 * @oracle 全解放成功かつ過去不明なしの場合だけ確認し、終了保存は発行しない。
 * @cleanup N/A: 外部資源・Process・ファイルを作成しない。
 * @boundary ERB-IT-014=Direct Boundary: 本番解放関数と既存Owner Map。
 */
test("現在回収排他: 全逆順・一回性・不明保持を終端処理から分離する", () => {
  const releaseStart = source.indexOf(
    "export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(",
  );
  assert.ok(releaseStart >= 0 && start > releaseStart);
  const releaseBody = stripTypeScriptTypes(
    source.slice(releaseStart, start).replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "false",
    "throw",
    "past_unknown",
    "reentrant",
  ]) {
    const capability = Object.freeze({});
    const calls: number[] = [];
    const before = Buffer.from("unchanged-current-state");
    const record = {
      kind: "recovery",
      closed: false,
      cleanupUnknown: scenario === "past_unknown",
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
      before,
      locks: [0, 1, 2].map((index) => ({
        release() {
          calls.push(index);
          assert.equal(record.closed, true);
          assert.equal(record.releaseAttempted, true);
          assert.equal(record.releaseConfirmed, false);
          if (scenario === "reentrant")
            assert.equal(release(capability), false);
          if (index === 1 && scenario === "throw") throw new Error("synthetic");
          return index !== 1 || scenario !== "false";
        },
      })),
    };
    const map = new WeakMap<object, typeof record>([[capability, record]]);
    const release = runInNewContext(
      `${releaseBody}; releaseRuntimeOwnedDockerTaskRecoveryPreparation`,
      { dockerRecoveryPreparations: map },
    ) as (value: unknown) => boolean;
    for (const invalid of [null, undefined, 0, "owner", {}, { ...capability }])
      assert.equal(release(invalid), false);
    assert.deepEqual(calls, []);
    const confirmed = scenario === "normal" || scenario === "reentrant";
    assert.equal(release(capability), confirmed, scenario);
    assert.deepEqual(calls, [2, 1, 0], scenario);
    assert.equal(record.releaseConfirmed, confirmed, scenario);
    assert.equal(record.cleanupUnknown, !confirmed, scenario);
    assert.equal(record.finalizationAttempted, false);
    assert.equal(record.before, before);
    assert.equal(before.toString(), "unchanged-current-state");
    assert.equal(release(capability), false);
    assert.deepEqual(calls, [2, 1, 0]);
    const restartKey = Object.freeze({});
    const restart = { ...record, kind: "restart", closed: false };
    map.set(restartKey, restart);
    assert.equal(release(restartKey), false);
    assert.equal(restart.closed, false);
    assert.deepEqual(calls, [2, 1, 0]);
  }
});

/**
 * 回収終了保存の一回性と解放前・不明時のWriter非発行を確認する。
 * @responsibility 解放済みOwnerが固定Writer以外へ復活しない条件を反証する。
 * @trace ERB-IT-014
 * @precondition メモリ内のOwnerと模擬Writerだけを使用する。
 * @stimulus 各前提欠測、正常、保存失敗・例外と同Owner再入場を渡す。
 * @observation Writer回数、Owner確認closureの有効期間と終了試行field。
 * @oracle 全前提成立時だけ一回発行し、返却後はclosureも失効する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-IT-014=Direct Boundary: 本番finalizer→模擬Writer。
 */
test("現在回収終端: 解放確認・一回性・Writer借用の短命性", () => {
  const finalizerStart = source.indexOf(
    "export function finalizeRuntimeOwnedDockerTaskRecoveryPreparation(",
  );
  assert.ok(finalizerStart >= 0 && start > finalizerStart);
  const finalizerBody = stripTypeScriptTypes(
    source
      .slice(finalizerStart, start)
      .replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "write_failed",
    "write_throw",
    "open",
    "unattempted",
    "unconfirmed",
    "retried",
    "persistence_failed",
    "cleanup_unknown",
    "host_present",
    "host_publication",
    "wrong_kind",
    "root_changed",
    "root_present",
    "marker_present",
    "root_unknown",
    "marker_unknown",
    "observe_throw",
    "late_root_present",
    "late_marker_present",
    "late_root_unknown",
    "late_marker_unknown",
  ]) {
    const capability = Object.freeze({});
    const record = {
      kind: scenario === "wrong_kind" ? "restart" : "recovery",
      closed: scenario !== "open",
      releaseAttempted: scenario !== "unattempted",
      releaseConfirmed: scenario !== "unconfirmed",
      finalizationAttempted: scenario === "retried",
      persistenceFailed: scenario === "persistence_failed",
      cleanupUnknown: scenario === "cleanup_unknown",
      hostCleanup: scenario === "host_present" ? "present" : "absent",
      hostCleanupPublication: scenario === "host_publication" ? {} : null,
      repository: { revalidate: () => scenario !== "root_changed" },
      recoveryId: "exact-recovery",
      hostToken: "fixed-token",
      hostRoot: "fixed-root",
      before: Buffer.from("fixed-before"),
    };
    let writes = 0;
    let physicalWrites = 0,
      observations = 0;
    let borrowed: (() => boolean) | null = null;
    const finalize = runInNewContext(
      `${finalizerBody}; finalizeRuntimeOwnedDockerTaskRecoveryPreparation`,
      {
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        observeHostRecoveryCleanup(token: string, root: string) {
          assert.equal(token, record.hostToken);
          assert.equal(root, record.hostRoot);
          observations++;
          if (scenario === "observe_throw")
            throw new Error("synthetic observation");
          const fault =
            scenario.startsWith("late_") && observations === 1
              ? "normal"
              : scenario.replace("late_", "");
          return {
            root:
              fault === "root_present"
                ? "present"
                : fault === "root_unknown"
                  ? "unknown"
                  : "absent",
            marker:
              fault === "marker_present"
                ? "present"
                : fault === "marker_unknown"
                  ? "unknown"
                  : "absent",
          };
        },
        writeRuntimeOwnedCoordinatorRecoveryTerminal(
          repository: unknown,
          recoveryId: string,
          before: Buffer,
          assertOwner: () => boolean,
        ) {
          writes++;
          assert.equal(repository, record.repository);
          assert.equal(recoveryId, record.recoveryId);
          assert.equal(before, record.before);
          assert.equal(record.finalizationAttempted, true);
          borrowed = assertOwner;
          if (scenario === "write_throw") throw new Error("synthetic");
          if (!assertOwner() || !assertOwner())
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          physicalWrites++;
          return {
            status:
              scenario === "write_failed" || !assertOwner()
                ? "blocked"
                : "completed",
            snapshotConfirmed: scenario !== "write_failed" && assertOwner(),
            lockReleased: true,
          };
        },
      },
    ) as (value: unknown) => { status: string; snapshotConfirmed: boolean };
    for (const invalid of [null, undefined, {}, { ...capability }])
      assert.equal(finalize(invalid).snapshotConfirmed, false);
    const attempted = [
      "normal",
      "write_failed",
      "write_throw",
      "root_changed",
      "root_present",
      "marker_present",
      "root_unknown",
      "marker_unknown",
      "observe_throw",
      "late_root_present",
      "late_marker_present",
      "late_root_unknown",
      "late_marker_unknown",
    ].includes(scenario);
    const result = finalize(capability);
    assert.equal(result.snapshotConfirmed, scenario === "normal", scenario);
    if (attempted)
      assert.equal(record.persistenceFailed, scenario !== "normal", scenario);
    assert.equal(writes, attempted ? 1 : 0, scenario);
    assert.equal(
      physicalWrites,
      scenario === "normal" || scenario === "write_failed" ? 1 : 0,
      scenario,
    );
    if (scenario.startsWith("late_")) assert.equal(observations, 2, scenario);
    if (borrowed !== null) assert.equal((borrowed as () => boolean)(), false);
    assert.equal(finalize(capability).snapshotConfirmed, false);
    assert.equal(writes, attempted ? 1 : 0);
    assert.equal(record.before.toString(), "fixed-before");
  }
});

/**
 * 解放済みOwnerの履歴接続を二段以内へ限定する。
 * @responsibility 中間保存失敗後の再発行と返却後のOwner借用を反証する。
 * @trace ERB-IT-014
 * @precondition 本番Wrapper本文と模擬履歴Driverだけを使用する。
 * @stimulus 初期・既確認、各段失敗／例外、排他不明、Host再出現と未収束を渡す。
 * @observation 呼出し回数、Effect累積、sticky拒否と借用失効。
 * @oracle 最大二段、失敗後同Owner再発行0、全体Task・配送完成を主張しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary ERB-IT-014=Direct Boundary: 私有回収Map→履歴Driver。
 */
test("現在回収履歴: 有界二段・失敗後停止・Effect保持", () => {
  const historyStart = source.indexOf(
    "export function completeRuntimeOwnedDockerTaskRecoveryHistory(",
  );
  assert.ok(historyStart >= 0 && historyStart < start);
  const historyBody = stripTypeScriptTypes(
    source
      .slice(historyStart, start)
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  for (const scenario of [
    "normal",
    "already_confirmed",
    "first_failed",
    "second_failed",
    "second_throw",
    "lock_unknown",
    "host_present",
    "unsettled",
    "unreleased",
  ]) {
    const capability = Object.freeze({});
    const record = {
      kind: "recovery",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: scenario !== "unreleased",
      finalizationAttempted: true,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null,
      repository: { revalidate: () => true },
      recoveryId: "exact",
      hostToken: "token",
      hostRoot: "root",
    };
    let calls = 0;
    const borrowed: (() => boolean)[] = [];
    const complete = runInNewContext(
      `${historyBody}; completeRuntimeOwnedDockerTaskRecoveryHistory`,
      {
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        observeHostRecoveryCleanup(token: string, root: string) {
          assert.equal(token, "token");
          assert.equal(root, "root");
          return {
            root: scenario === "host_present" ? "present" : "absent",
            marker: "absent",
          };
        },
        advanceRuntimeOwnedCoordinatorRecoveryHistory(
          repository: unknown,
          recoveryId: string,
          owner: () => boolean,
        ) {
          calls++;
          borrowed.push(owner);
          assert.equal(repository, record.repository);
          assert.equal(recoveryId, "exact");
          if (scenario === "second_throw" && calls === 2)
            throw new Error("synthetic");
          const failed =
            !owner() ||
            scenario === "first_failed" ||
            scenario === "lock_unknown" ||
            (scenario === "second_failed" && calls === 2);
          return {
            status: failed ? "blocked" : "completed",
            snapshotConfirmed: !failed,
            lockReleased: scenario !== "lock_unknown",
            historyConfirmed:
              !failed &&
              scenario !== "unsettled" &&
              (scenario === "already_confirmed" || calls === 2),
            filesystemEffectIssued: !failed && scenario !== "already_confirmed",
          };
        },
      },
    ) as (capability: unknown) => {
      status: string;
      historyConfirmed: boolean;
      filesystemEffectIssued: boolean;
    };
    assert.equal(complete({}).status, "blocked");
    assert.equal(calls, 0);
    const result = complete(capability);
    const completed = scenario === "normal" || scenario === "already_confirmed";
    assert.equal(result.historyConfirmed, completed, scenario);
    assert.equal(result.status, completed ? "completed" : "blocked", scenario);
    assert.equal(
      calls,
      scenario === "unreleased"
        ? 0
        : ["normal", "second_failed", "second_throw", "unsettled"].includes(
              scenario,
            )
          ? 2
          : 1,
      scenario,
    );
    assert.equal(
      result.filesystemEffectIssued,
      ["normal", "second_failed", "second_throw", "unsettled"].includes(
        scenario,
      ),
      scenario,
    );
    for (const owner of borrowed) assert.equal(owner(), false);
    if (!completed) {
      const beforeCalls = calls;
      assert.equal(complete(capability).status, "blocked");
      assert.equal(calls, beforeCalls);
    }
    assert.equal(record.cleanupUnknown, scenario === "lock_unknown");
  }
});

/**
 * 既に不存在のHostを未要求欄から確認保存する順序を反証する。
 * @responsibility pending保存前後の拒否と物理処置0を確認する。
 * @trace ERB-IT-014
 * @precondition 本番清掃関数本文とメモリ内の保存Owner代役を使う。
 * @stimulus pending保存失敗・例外、保存後Owner失効、正常の四形。
 * @observation pending／confirmed順序、本文、物理処置要求数。
 * @oracle pending成功とfresh Owner確認なしにconfirmedへ進まず、Host物理処置は0。
 * @cleanup N/A: VM内だけで実資源を作らない。
 * @boundary 現在回収Owner→既存Host checkpoint／清掃確定Writer。
 */
test("既Host不存在: 未要求からpendingを経て確認し物理処置しない", () => {
  const start = source.indexOf(
    "export function cleanupRuntimeOwnedDockerTaskHost(",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end)).replace(
    "export function",
    "function",
  );
  for (const scenario of [
    "normal",
    "pending_failed",
    "pending_throw",
    "owner_lost_after_pending",
  ]) {
    const capability = Object.freeze({});
    const initial = {
      kind: "docker_task",
      recoveryId: "exact",
      host: {
        currentToken: "token",
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      execution: { ownerEffect: "disabled" },
    };
    let snapshot: { revision: number; operations: [typeof initial] } = {
      revision: 1,
      operations: [initial],
    };
    /**
     * 合成Snapshotを比較用JSON本文へ符号化する。
     * @responsibility 合成Snapshotを比較用JSON本文へ符号化する。
     * @trace ERB-IT-014
     * @precondition 同試験の閉じたsnapshot。
     * @stimulus JSON.stringifyを適用する。
     * @observation 固定JSON文字列。
     * @oracle 差替え前後の本文一致を同じ符号化で検査する。
     * @cleanup N/A: 文字列生成のみ。
     * @boundary VMfixtureの期待byte生成で実保存なし。
     */
    const encode = (value: unknown) => JSON.stringify(value);
    /**
     * Snapshotの保存形式byteを再構成する。
     * @responsibility Snapshotの保存形式byteを再構成する。
     * @trace ERB-IT-014
     * @precondition 同じsnapshotとJSON符号化関数。
     * @stimulus JSON末尾に改行を加えてBufferにする。
     * @observation 比較対象の全文byte。
     * @oracle 拒否時の本文変化を部分field比較で見落とさない。
     * @cleanup N/A: Bufferだけを生成する。
     * @boundary 局所保存byte比較。実File作成なし。
     */
    const bytes = () => Buffer.from(`${encode(snapshot)}\n`);
    const record = {
      kind: "recovery",
      hostCleanup: "absent",
      hostCleanupPublication: null,
      recoveryId: "exact",
      hostToken: "token",
      repository: { repositoryBinding: "binding" },
      before: bytes(),
      persistenceFailed: false,
      cleanupUnknown: false,
    };
    const stages: string[] = [];
    let physical = 0;
    const environment = {
      Buffer,
      dockerRecoveryPreparations: new WeakMap([[capability, record]]),
      encodeCoordinatorStateValue: encode,
      coordinatorTaskResourcesAreSettled: () => true,
      assertCurrentRecoveryOwner: () =>
        !(scenario === "owner_lost_after_pending" && stages.length > 0),
      readRuntimeOwnedCoordinatorRecoverySnapshot: () => ({
        status: "completed",
        lockReleased: true,
        value: { snapshot, payloadSha256: `hash-${snapshot.revision}` },
      }),
      persistRuntimeOwnedDockerTaskRecoveryCheckpoint: (
        _key: unknown,
        kind: string,
        value: (typeof snapshot.operations)[0]["host"],
      ) => {
        assert.equal(kind, "host");
        assert.equal(value.cleanup, "pending");
        stages.push("pending");
        if (scenario === "pending_throw")
          throw new Error("fixture_pending_failure");
        if (scenario === "pending_failed") return false;
        snapshot = {
          revision: snapshot.revision + 1,
          operations: [{ ...snapshot.operations[0], host: value }],
        };
        record.before = bytes();
        return true;
      },
      prepareCoordinatorStateHostSnapshot: (
        _before: unknown,
        _id: unknown,
        value: (typeof snapshot.operations)[0]["host"],
      ) =>
        Buffer.from(
          `${encode({ revision: snapshot.revision + 1, operations: [{ ...snapshot.operations[0], host: value }] })}\n`,
        ),
      writeRuntimeOwnedCoordinatorRecoveredHostCleanup: (
        _repository: unknown,
        _id: unknown,
        _before: unknown,
        owner: () => boolean,
      ) => {
        assert.equal(owner(), true);
        assert.equal(snapshot.operations[0].host.cleanup, "pending");
        stages.push("confirmed");
        snapshot = {
          revision: snapshot.revision + 1,
          operations: [
            {
              ...snapshot.operations[0],
              host: { ...snapshot.operations[0].host, cleanup: "confirmed" },
            },
          ],
        };
        return {
          status: "completed",
          snapshotConfirmed: true,
          lockReleased: true,
          revision: snapshot.revision,
          payloadSha256: `hash-${snapshot.revision}`,
        };
      },
      recoverOwnedOperationDirectories: () => {
        physical++;
        throw new Error("unexpected_host_effect");
      },
      loadHostRecoveryRecordByToken: () => {
        physical++;
        throw new Error("unexpected_host_load");
      },
    };
    const cleanup = runInNewContext(
      `${body}; cleanupRuntimeOwnedDockerTaskHost`,
      environment,
    );
    assert.equal(cleanup(capability), scenario === "normal", scenario);
    assert.deepEqual(
      stages,
      scenario === "normal" ? ["pending", "confirmed"] : ["pending"],
      scenario,
    );
    assert.equal(physical, 0, scenario);
    if (scenario !== "normal")
      assert.notEqual(snapshot.operations[0].host.cleanup, "confirmed");
  }
});

/**
 * 既Host不存在で使用できるcheckpointを既存host pendingだけに限定する。
 * @responsibility 資源・結果の書換えと未終端操作への保存を拒否する。
 * @trace ERB-IT-014
 * @precondition 本番checkpoint本文とメモリReader／Writerを使用する。
 * @stimulus 正常なpending、別token、別field、別kind、非終端操作を渡す。
 * @observation 保存要求数、Owner確認、保存後の停止状態。
 * @oracle 完全一致するhost pending以外の保存要求は0。
 * @cleanup N/A: VM内で実資源を作らない。
 * @boundary 回収Owner→既存checkpoint Writer。
 */
test("既Host不存在checkpoint: 同じHostのpendingだけを保存する", () => {
  const start = source.indexOf(
    "export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end)).replace(
    "export function",
    "function",
  );
  for (const scenario of [
    "normal",
    "token",
    "extra",
    "resource",
    "unsettled",
    "already_pending",
    "owner",
    "writer_failed",
  ]) {
    const host = {
      currentToken: "token",
      pendingTransitionJson: null,
      cleanup: scenario === "already_pending" ? "pending" : "not_requested",
    };
    const snapshot = {
      revision: 1,
      operations: [{ kind: "docker_task", recoveryId: "exact", host }],
    };
    const capability = {};
    const record = {
      kind: "recovery",
      hostCleanup: "absent",
      hostCleanupPublication: null,
      recoveryId: "exact",
      hostToken: "token",
      repository: { repositoryBinding: "binding" },
      before: Buffer.from(JSON.stringify(snapshot)),
      persistenceFailed: false,
      cleanupUnknown: false,
    };
    let writes = 0;
    const persist = runInNewContext(
      `${body}; persistRuntimeOwnedDockerTaskRecoveryCheckpoint`,
      {
        Buffer,
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        encodeCoordinatorStateValue: JSON.stringify,
        assertCurrentRecoveryOwner: () => scenario !== "owner",
        decodeCoordinatorStateSnapshot: () => ({ snapshot }),
        coordinatorReleasedTaskCanObserveHostAbsence: () =>
          scenario !== "unsettled",
        writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
          _repository: unknown,
          _id: unknown,
          _before: unknown,
          _kind: unknown,
          value: typeof host,
          owner: () => boolean,
        ) => {
          assert.equal(owner(), true);
          writes++;
          snapshot.revision++;
          const operation = snapshot.operations[0];
          assert.ok(operation);
          operation.host = value;
          return {
            status: scenario === "writer_failed" ? "blocked" : "completed",
            snapshotConfirmed: true,
            lockReleased: true,
            revision: snapshot.revision,
            payloadSha256: "hash",
          };
        },
        readRuntimeOwnedCoordinatorRecoverySnapshot: () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot, payloadSha256: "hash" },
        }),
      },
    );
    const value = {
      ...host,
      cleanup: "pending",
      ...(scenario === "token" ? { currentToken: "other" } : {}),
      ...(scenario === "extra" ? { other: true } : {}),
    };
    assert.equal(
      persist(capability, scenario === "resource" ? "resource" : "host", value),
      scenario === "normal",
      scenario,
    );
    assert.equal(
      writes,
      scenario === "normal" || scenario === "writer_failed" ? 1 : 0,
      scenario,
    );
  }
});

/**
 * 現在Rootの回収組立てを、固定段階と全解放の順序で反証する。
 * @responsibility 一次失敗・取消・既回収を後続処置やTask完了へ丸めない。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と既存下位APIの固定模擬を使用する。
 * @stimulus 各段階の停止／例外、解放false／例外、六つの取消点、既Host不存在を渡す。
 * @observation 呼出し順序、解放回数、確認field、元参照と内部準備キー。
 * @oracle 失敗後の次段0、取得後は全解放一回、元失敗と解放失敗を独立保持する。
 * @cleanup N/A: 外部ProcessやFilesystem資源を作らない。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在回収組立て→技術／保存Owner。
 */
test("現在回収組立て: 順序・一次失敗・段階間取消", async () => {
  const begin = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskFromCurrentRepository(",
  );
  const finish = source.indexOf(
    "export function recoverRuntimeOwnedDockerTaskResources(",
    begin,
  );
  assert.ok(begin >= 0 && finish > begin);
  const driverBody = stripTypeScriptTypes(
    source
      .slice(begin, finish)
      .replaceAll("export async function", "async function")
      .replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "already_absent",
    "host_publication",
    "invalid_id",
    "invalid_signal",
    "proxy_signal",
    "undefined_signal",
    "pre_cancel",
    "prepare_failed",
    "retirement_failed",
    "retirement_cancelled",
    "resources_failed",
    "resources_throw",
    "absence_failed",
    "host_failed",
    "release_false",
    "release_throw",
    "resources_failed_release_false",
    "terminal_failed",
    "terminal_throw",
    "terminal_unlock_failed",
    "history_failed",
    "history_throw",
    "history_unlock_failed",
    "delivery_failed",
    "delivery_throw",
    "delivery_unlock_failed",
    "delivery_unconfirmed_pending",
    "durable_delivery",
    "cancel_1",
    "cancel_2",
    "cancel_3",
    "cancel_4",
    "cancel_5",
    "cancel_6",
  ]) {
    const capability = Object.freeze({}),
      root = Object.freeze({});
    const record = {
      kind: "recovery",
      hostCleanup: ["already_absent", "host_publication"].includes(scenario)
        ? "absent"
        : "present",
      hostCleanupPublication: scenario === "host_publication" ? {} : null,
      before: Buffer.from("current"),
      repository: { repositoryBinding: "binding" },
      recoveryId: "exact",
      persistenceFailed: false,
    };
    const events: string[] = [];
    const retirementEvents: string[] = [];
    let retired = false;
    let retirementYieldPending = false;
    const controller = new AbortController();
    let proxyTraps = 0;
    const proxySignal = new Proxy(controller.signal, {
      get() {
        proxyTraps++;
        throw new Error("forbidden signal get");
      },
      getPrototypeOf() {
        proxyTraps++;
        throw new Error("forbidden signal prototype");
      },
      set() {
        proxyTraps++;
        throw new Error("forbidden signal set");
      },
      has() {
        proxyTraps++;
        throw new Error("forbidden signal has");
      },
    });
    let yields = 0;
    if (scenario === "pre_cancel") controller.abort();
    const driver = runInNewContext(
      `${driverBody}; recoverRuntimeOwnedDockerTaskFromCurrentRepository`,
      {
        AbortSignal,
        utilTypes,
        Object,
        Buffer,
        parseDockerTaskRecoveryId: (token: unknown) =>
          token === "invalid" ? null : { token: "exact" },
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        prepareRuntimeOwnedDockerTaskRecovery(
          token: string,
          receivedRoot: unknown,
        ) {
          events.push("prepare");
          assert.equal(token, "exact");
          assert.equal(receivedRoot, root);
          return scenario === "prepare_failed"
            ? {
                status: "blocked",
                reason: "fixture_prepare_failed",
                cleanupConfirmed: false,
              }
            : { status: "prepared", capability };
        },
        async yieldRecoveryEvents() {
          if (retirementYieldPending) {
            retirementYieldPending = false;
            retirementEvents.push("yield_after_retirement");
            if (scenario === "retirement_cancelled") controller.abort();
            return;
          }
          events.push("yield");
          yields++;
          if (scenario === `cancel_${yields}`) controller.abort();
        },
        retireRuntimeOwnedDockerTaskExecutionOwner(key: unknown) {
          assert.equal(key, capability);
          assert.deepEqual(events, ["prepare", "yield"]);
          retirementEvents.push("retire");
          retired = scenario !== "retirement_failed";
          retirementYieldPending = retired;
          return retired;
        },
        executeRuntimeOwnedDockerTaskResourceRecovery(key: unknown) {
          assert.equal(retired, true);
          assert.deepEqual(retirementEvents, [
            "retire",
            "yield_after_retirement",
          ]);
          events.push("resources");
          assert.equal(key, capability);
          if (scenario === "resources_throw")
            throw new Error("fixture_resources_throw");
          const completed = !scenario.startsWith("resources_failed");
          return {
            status: completed ? "completed" : "blocked",
            reason: "fixture_resources_failed",
            dockerCleanupConfirmed: completed,
            configCleanupConfirmed: true,
          };
        },
        confirmRuntimeOwnedDockerTaskHostAbsence(key: unknown) {
          events.push("absence");
          assert.equal(key, capability);
          return scenario !== "absence_failed";
        },
        decodeCoordinatorStateSnapshot: () => ({
          snapshot: {
            operations: [
              {
                kind: "docker_task",
                recoveryId: "exact",
                host: {
                  cleanup:
                    scenario === "already_absent" ? "confirmed" : "pending",
                },
              },
            ],
          },
        }),
        cleanupRuntimeOwnedDockerTaskHost(key: unknown) {
          events.push("host");
          assert.equal(key, capability);
          return scenario !== "host_failed";
        },
        releaseRuntimeOwnedDockerTaskRecoveryPreparation(key: unknown) {
          events.push("release");
          assert.equal(key, capability);
          if (scenario === "release_throw")
            throw new Error("fixture_release_throw");
          return !["release_false", "resources_failed_release_false"].includes(
            scenario,
          );
        },
        finalizeRuntimeOwnedDockerTaskRecoveryPreparation(key: unknown) {
          events.push("terminal");
          assert.equal(key, capability);
          if (scenario === "terminal_throw") throw new Error("fixture");
          return {
            status: scenario === "terminal_failed" ? "blocked" : "completed",
            snapshotConfirmed: scenario !== "terminal_failed",
            lockReleased: scenario !== "terminal_unlock_failed",
          };
        },
        completeRuntimeOwnedDockerTaskRecoveryHistory(key: unknown) {
          events.push("history");
          assert.equal(key, capability);
          if (scenario === "history_throw") throw new Error("fixture");
          return {
            status: scenario === "history_failed" ? "blocked" : "completed",
            historyConfirmed: scenario !== "history_failed",
            lockReleased: scenario !== "history_unlock_failed",
            reason: "fixture_history_failed",
          };
        },
        registerRuntimeOwnedDockerTaskRecoveryDelivery(key: unknown) {
          events.push("delivery");
          assert.equal(key, capability);
          if (scenario === "delivery_throw") throw new Error("fixture");
          return {
            status: scenario === "delivery_failed" ? "blocked" : "completed",
            snapshotConfirmed: ![
              "delivery_failed",
              "delivery_unconfirmed_pending",
            ].includes(scenario),
            lockReleased: scenario !== "delivery_unlock_failed",
            deliveryPending: [
              "durable_delivery",
              "delivery_unlock_failed",
              "delivery_unconfirmed_pending",
            ].includes(scenario),
            reason: "fixture_delivery_failed",
          };
        },
        safeRecoveryReason: (error: Error, fallback: string) =>
          error.message || fallback,
      },
    ) as (
      token: unknown,
      root: unknown,
      signal?: AbortSignal,
    ) => Promise<{
      status: string;
      reason: string;
      recoveryId: string | null;
      cleanupReason: string | null;
      operationRetained: boolean;
      taskRecoveryCompleted: boolean;
      historyConfirmed: boolean;
      dockerCleanupConfirmed: boolean;
      hostCleanupConfirmed: boolean;
      locksReleased: boolean;
      deliveryPending: boolean;
      preparation: unknown;
    }>;
    const result = await driver(
      scenario === "invalid_id" ? "invalid" : "exact",
      root,
      scenario === "invalid_signal"
        ? ({} as AbortSignal)
        : scenario === "proxy_signal"
          ? proxySignal
          : scenario === "undefined_signal"
            ? undefined
            : controller.signal,
    );
    const successful = [
      "normal",
      "already_absent",
      "host_publication",
      "undefined_signal",
      "durable_delivery",
    ].includes(scenario);
    assert.equal(result.status, successful ? "completed" : "blocked", scenario);
    assert.equal(result.operationRetained, true);
    assert.equal(result.taskRecoveryCompleted, false);
    assert.equal(result.preparation, successful ? capability : null, scenario);
    assert.equal(
      result.recoveryId,
      scenario === "invalid_id" ? null : "exact",
      scenario,
    );
    const acquired = ![
      "invalid_id",
      "invalid_signal",
      "proxy_signal",
      "pre_cancel",
      "prepare_failed",
    ].includes(scenario);
    assert.equal(
      events.filter((event) => event === "release").length,
      acquired ? 1 : 0,
      scenario,
    );
    for (const phase of ["terminal", "history", "delivery"])
      if (events.includes(phase))
        assert.ok(events.indexOf("release") < events.indexOf(phase), scenario);
    if (scenario === "normal")
      assert.deepEqual(events, [
        "prepare",
        "yield",
        "resources",
        "yield",
        "absence",
        "yield",
        "host",
        "release",
        "yield",
        "terminal",
        "yield",
        "history",
        "yield",
        "delivery",
      ]);
    if (scenario === "already_absent") {
      assert.equal(events.includes("resources"), false);
      assert.equal(events.includes("absence"), false);
      assert.equal(events.includes("host"), false);
    }
    if (scenario === "host_publication") {
      assert.equal(events.includes("resources"), false);
      assert.equal(events.includes("absence"), false);
      assert.equal(events.includes("host"), true);
    }
    if (scenario.startsWith("resources_failed")) {
      assert.equal(result.reason, "fixture_resources_failed");
      assert.equal(events.includes("host"), false);
      assert.equal(events.includes("terminal"), false);
    }
    if (scenario === "resources_failed_release_false")
      assert.equal(
        result.cleanupReason,
        "docker_task_recovery_release_unconfirmed",
      );
    if (scenario.startsWith("cancel_") || scenario === "pre_cancel")
      assert.equal(result.reason, "docker_task_recovery_cancelled");
    if (["delivery_failed", "delivery_throw", "cancel_6"].includes(scenario))
      assert.equal(result.historyConfirmed, true);
    if (!acquired)
      assert.equal(
        events.some((event) => event !== "prepare"),
        false,
      );
    assert.equal(proxyTraps, 0, scenario);
    // 各行は「理由、exact呼出し列、Docker、Host、解放、履歴、配送待ち」。
    const completeEvents =
      "prepare yield resources yield absence yield host release yield terminal yield history yield delivery";
    const matrix: Record<
      string,
      readonly [string, string, boolean, boolean, boolean, boolean, boolean]
    > = {
      normal: [
        "docker_task_recovery_runtime_state_settled",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      undefined_signal: [
        "docker_task_recovery_runtime_state_settled",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      durable_delivery: [
        "docker_task_recovery_runtime_state_settled",
        completeEvents,
        true,
        true,
        true,
        true,
        true,
      ],
      already_absent: [
        "docker_task_recovery_runtime_state_settled",
        "prepare yield yield release yield terminal yield history yield delivery",
        true,
        true,
        true,
        true,
        false,
      ],
      host_publication: [
        "docker_task_recovery_runtime_state_settled",
        "prepare yield yield host release yield terminal yield history yield delivery",
        true,
        true,
        true,
        true,
        false,
      ],
      invalid_id: [
        "docker_task_recovery_id_invalid",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      invalid_signal: [
        "docker_task_recovery_cancellation_invalid",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      proxy_signal: [
        "docker_task_recovery_cancellation_invalid",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      pre_cancel: [
        "docker_task_recovery_cancelled",
        "",
        false,
        false,
        true,
        false,
        false,
      ],
      prepare_failed: [
        "fixture_prepare_failed",
        "prepare",
        false,
        false,
        false,
        false,
        false,
      ],
      retirement_failed: [
        "docker_task_recovery_owner_retirement_unconfirmed",
        "prepare yield release",
        false,
        false,
        true,
        false,
        false,
      ],
      retirement_cancelled: [
        "docker_task_recovery_cancelled",
        "prepare yield release",
        false,
        false,
        true,
        false,
        false,
      ],
      resources_failed: [
        "fixture_resources_failed",
        "prepare yield resources release",
        false,
        false,
        true,
        false,
        false,
      ],
      resources_throw: [
        "fixture_resources_throw",
        "prepare yield resources release",
        false,
        false,
        true,
        false,
        false,
      ],
      absence_failed: [
        "docker_task_recovery_host_absence_unconfirmed",
        "prepare yield resources yield absence release",
        true,
        false,
        true,
        false,
        false,
      ],
      host_failed: [
        "docker_task_recovery_host_cleanup_unconfirmed",
        "prepare yield resources yield absence yield host release",
        true,
        false,
        true,
        false,
        false,
      ],
      release_false: [
        "docker_task_recovery_release_unconfirmed",
        "prepare yield resources yield absence yield host release",
        true,
        true,
        false,
        false,
        false,
      ],
      release_throw: [
        "docker_task_recovery_release_unconfirmed",
        "prepare yield resources yield absence yield host release",
        true,
        true,
        false,
        false,
        false,
      ],
      resources_failed_release_false: [
        "fixture_resources_failed",
        "prepare yield resources release",
        false,
        false,
        false,
        false,
        false,
      ],
      terminal_failed: [
        "docker_task_recovery_terminal_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal",
        true,
        true,
        true,
        false,
        false,
      ],
      terminal_throw: [
        "docker_task_recovery_terminal_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal",
        true,
        true,
        true,
        false,
        false,
      ],
      terminal_unlock_failed: [
        "docker_task_recovery_terminal_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal",
        true,
        true,
        false,
        false,
        false,
      ],
      history_failed: [
        "fixture_history_failed",
        "prepare yield resources yield absence yield host release yield terminal yield history",
        true,
        true,
        true,
        false,
        false,
      ],
      history_throw: [
        "docker_task_recovery_history_unconfirmed",
        "prepare yield resources yield absence yield host release yield terminal yield history",
        true,
        true,
        true,
        false,
        false,
      ],
      history_unlock_failed: [
        "fixture_history_failed",
        "prepare yield resources yield absence yield host release yield terminal yield history",
        true,
        true,
        false,
        true,
        false,
      ],
      delivery_failed: [
        "fixture_delivery_failed",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      delivery_throw: [
        "docker_task_recovery_delivery_unconfirmed",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      delivery_unlock_failed: [
        "fixture_delivery_failed",
        completeEvents,
        true,
        true,
        false,
        true,
        true,
      ],
      delivery_unconfirmed_pending: [
        "fixture_delivery_failed",
        completeEvents,
        true,
        true,
        true,
        true,
        false,
      ],
      cancel_1: [
        "docker_task_recovery_cancelled",
        "prepare yield release",
        false,
        false,
        true,
        false,
        false,
      ],
      cancel_2: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield release",
        true,
        false,
        true,
        false,
        false,
      ],
      cancel_3: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield release",
        true,
        false,
        true,
        false,
        false,
      ],
      cancel_4: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield host release yield",
        true,
        true,
        true,
        false,
        false,
      ],
      cancel_5: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield host release yield terminal yield",
        true,
        true,
        true,
        false,
        false,
      ],
      cancel_6: [
        "docker_task_recovery_cancelled",
        "prepare yield resources yield absence yield host release yield terminal yield history yield",
        true,
        true,
        true,
        true,
        false,
      ],
    };
    const row = matrix[scenario];
    assert.ok(row, scenario);
    const expectedEvents = row[1] === "" ? [] : row[1].split(" ");
    const expectedResult = {
      status: successful ? "completed" : "blocked",
      reason: row[0],
      recoveryId: scenario === "invalid_id" ? null : "exact",
      dockerCleanupConfirmed: row[2],
      hostCleanupConfirmed: row[3],
      locksReleased: row[4],
      historyConfirmed: row[5],
      deliveryPending: row[6],
      operationRetained: true,
      taskRecoveryCompleted: false,
      cleanupReason: row[4] ? null : "docker_task_recovery_release_unconfirmed",
      preparation: successful ? capability : null,
    };
    assert.deepEqual(events, expectedEvents, scenario);
    assert.deepEqual({ ...result }, expectedResult, scenario);
    // Oracle自体が、余分な後段呼出しと確認済みfactの欠落を拒否することも固定する。
    assert.throws(() =>
      assert.deepEqual([...events, "unexpected_effect"], expectedEvents),
    );
    for (const field of [
      "dockerCleanupConfirmed",
      "hostCleanupConfirmed",
      "locksReleased",
      "historyConfirmed",
      "deliveryPending",
    ] as const)
      if (expectedResult[field])
        assert.throws(() =>
          assert.deepEqual({ ...result, [field]: false }, expectedResult),
        );
  }
});

/**
 * 現在相関解決の全数観測と明示不存在の境界を反証する。
 * @responsibility 未観測・曖昧・別consumerをabsenceへ畳まない。
 * @trace ERB-IT-014
 * @precondition 本番Resolver本文と固定現在Readerを使う。
 * @stimulus 正常、重複、欠測、旧内部ID、getter／Proxyを渡す。
 * @observation matched／absence全数、読取り回数とtrap数。
 * @oracle 完全観測だけを上位相関へ対応し、旧内部IDへfallbackしない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Reader→上位相関解決。
 */
test("現在相関Resolverは完全観測と上位相関だけを使う", () => {
  const begin = source.indexOf(
    "export function resolveRuntimeOwnedDockerTaskCurrentCorrelations(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "no_fallback",
    "missing_correlation",
    "wrong_consumer",
    "duplicate_correlation",
    "duplicate_recovery",
    "blocked",
    "unlock",
    "null",
    "throw",
    "input_duplicate",
    "input_invalid",
    "input_getter",
    "input_proxy",
    "wrong_root",
  ]) {
    const root = Object.freeze({});
    let reads = 0,
      traps = 0;
    const operations = [
      {
        kind: "docker_task",
        recoveryId: "exact",
        identityJson: JSON.stringify({
          consumer: "orchestrator",
          recoveryCorrelationId: "upper-a",
          operationId: "internal-different",
        }),
      },
    ];
    const operation = operations[0];
    assert.ok(operation);
    if (scenario === "no_fallback")
      operation.identityJson = JSON.stringify({
        consumer: "coordinator_cli",
        operationId: "upper-a",
      });
    if (scenario === "missing_correlation")
      operation.identityJson = JSON.stringify({
        consumer: "orchestrator",
        operationId: "upper-a",
      });
    if (scenario === "wrong_consumer")
      operation.identityJson = JSON.stringify({
        consumer: "workbench",
        recoveryCorrelationId: "upper-a",
      });
    if (scenario === "duplicate_correlation")
      operations.push({ ...operation, recoveryId: "other" });
    if (scenario === "duplicate_recovery")
      operations.push({
        kind: "docker_task",
        recoveryId: "exact",
        identityJson: JSON.stringify({
          consumer: "orchestrator",
          recoveryCorrelationId: "absent",
        }),
      });
    let input: unknown = ["upper-a", "absent"];
    if (scenario === "input_duplicate") input = ["upper-a", "upper-a"];
    if (scenario === "input_invalid") input = ["bad id"];
    if (scenario === "input_getter")
      Object.defineProperty(input, "0", {
        get() {
          traps++;
          throw new Error("fixture");
        },
      });
    if (scenario === "input_proxy")
      input = new Proxy(input as object, {
        get() {
          traps++;
          throw new Error("fixture");
        },
      });
    const run = runInNewContext(
      `${body}; resolveRuntimeOwnedDockerTaskCurrentCorrelations`,
      {
        Object,
        Array,
        Map,
        Set,
        JSON,
        utilTypes,
        readRuntimeOwnedCoordinatorRecoverySnapshot(received: unknown) {
          reads++;
          if (scenario === "throw") throw new Error("secret");
          return {
            status:
              scenario === "blocked" || received !== root
                ? "blocked"
                : "completed",
            lockReleased: scenario !== "unlock",
            value: scenario === "null" ? null : { snapshot: { operations } },
          };
        },
      },
    ) as (
      ids: unknown,
      root: unknown,
    ) => {
      status: string;
      lockReleased: boolean;
      bindings: unknown[];
      absentCorrelationIds: unknown[];
    };
    const result = run(input, scenario === "wrong_root" ? {} : root);
    assert.equal(
      result.status,
      ["normal", "no_fallback"].includes(scenario) ? "completed" : "blocked",
      scenario,
    );
    assert.equal(traps, 0, scenario);
    assert.equal(reads, scenario.startsWith("input_") ? 0 : 1, scenario);
    if (result.status === "completed") {
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.bindings)),
        scenario === "normal"
          ? [{ correlationId: "upper-a", recoveryId: "exact" }]
          : [],
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.absentCorrelationIds)),
        scenario === "normal" ? ["absent"] : ["upper-a", "absent"],
      );
    } else {
      assert.equal(result.bindings.length, 0);
      assert.equal(result.absentCorrelationIds.length, 0);
    }
    if (scenario === "unlock") assert.equal(result.lockReleased, false);
  }
});

/**
 * 通常入口向け回復組立ての固定consumerと公開結果を反証する。
 * @responsibility 技術結果の部分成立・配送方式差・終了不明を完了表示へ昇格しない。
 * @trace ERB-IT-014
 * @precondition 本番組立て本文と技術Driver／終了処理の固定模擬を使う。
 * @stimulus 技術field欠測、三consumer、未知consumer、保存失敗を渡す。
 * @observation 終了処理回数と公開結果の全fieldを観測する。
 * @oracle 共同成立した固定transientだけ一回終了し、durableは受領待ちを保持する。
 * @cleanup N/A: メモリ内だけで外部資源を生成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 技術Driver→用途別終了→公開診断。
 */
test("現在回復の公開組立て: 固定consumer・共同成立・内部値非公開", async () => {
  const begin = source.indexOf(
    "export async function recoverRuntimeOwnedDockerTaskForCurrentConsumer(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export async function", "async function"),
  );
  for (const scenario of [
    "cli",
    "workbench",
    "orchestrator",
    "unknown_consumer",
    "wrong_delivery",
    "missing_owner",
    "dockerCleanupConfirmed",
    "hostCleanupConfirmed",
    "locksReleased",
    "historyConfirmed",
    "cleanupReason",
    "technical_blocked",
    "completion_blocked",
    "snapshotConfirmed",
    "lockReleased",
    "operationRemovalConfirmed",
    "taskRecoveryCompleted",
    "completion_throw",
  ]) {
    const key = Object.freeze({});
    const technical = {
      status: "completed",
      reason: "technical_ready",
      recoveryId: "exact",
      preparation: key,
      dockerCleanupConfirmed: true,
      hostCleanupConfirmed: true,
      locksReleased: true,
      historyConfirmed: true,
      cleanupReason: null as string | null,
      deliveryPending:
        scenario === "orchestrator" || scenario === "wrong_delivery",
      secret: "must_not_escape",
    };
    if (
      [
        "dockerCleanupConfirmed",
        "hostCleanupConfirmed",
        "locksReleased",
        "historyConfirmed",
      ].includes(scenario)
    )
      Object.assign(technical, { [scenario]: false });
    if (scenario === "cleanupReason")
      technical.cleanupReason = "release_unknown";
    if (scenario === "technical_blocked") technical.status = "blocked";
    const consumer =
      scenario === "orchestrator"
        ? "orchestrator"
        : scenario === "workbench"
          ? "workbench"
          : scenario === "unknown_consumer"
            ? "unknown"
            : "coordinator_cli";
    let calls = 0;
    const owner = {
      kind: "recovery",
      before: Buffer.from("before"),
      repository: { repositoryBinding: "binding" },
    };
    const run = runInNewContext(
      `${body}; recoverRuntimeOwnedDockerTaskForCurrentConsumer`,
      {
        Object,
        JSON,
        recoverRuntimeOwnedDockerTaskFromCurrentRepository: async () =>
          technical,
        dockerRecoveryPreparations: new WeakMap(
          scenario === "missing_owner" ? [] : [[key, owner]],
        ),
        decodeCoordinatorStateSnapshot: () => ({
          snapshot: {
            operations: [
              {
                kind: "docker_task",
                recoveryId: "exact",
                identityJson: JSON.stringify({ consumer }),
              },
            ],
          },
        }),
        coordinatorConsumerCompletionPolicy: (value: string) =>
          value === "orchestrator"
            ? "durable"
            : ["coordinator_cli", "workbench"].includes(value)
              ? "transient"
              : null,
        completeRuntimeOwnedDockerTaskTransientRecovery(received: unknown) {
          assert.equal(received, key);
          calls++;
          if (scenario === "completion_throw") throw new Error("secret");
          return {
            status: scenario === "completion_blocked" ? "blocked" : "completed",
            reason: "completion_stopped",
            snapshotConfirmed: scenario !== "snapshotConfirmed",
            lockReleased: scenario !== "lockReleased",
            operationRemovalConfirmed: scenario !== "operationRemovalConfirmed",
            taskRecoveryCompleted: scenario !== "taskRecoveryCompleted",
          };
        },
      },
    ) as () => Promise<Record<string, unknown>>;
    const result = await run();
    const normal = ["cli", "workbench"].includes(scenario);
    assert.equal(
      result.status,
      normal
        ? "recovered"
        : scenario === "orchestrator"
          ? "awaiting_delivery"
          : "blocked",
      scenario,
    );
    assert.equal(result.taskRecoveryCompleted, normal, scenario);
    assert.equal(
      calls,
      normal ||
        scenario.startsWith("completion_") ||
        [
          "snapshotConfirmed",
          "lockReleased",
          "operationRemovalConfirmed",
          "taskRecoveryCompleted",
        ].includes(scenario)
        ? 1
        : 0,
      scenario,
    );
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        "contract",
        "status",
        "reason",
        "recoveryId",
        "dockerCleanupConfirmed",
        "hostCleanupConfirmed",
        "locksReleased",
        "historyConfirmed",
        "deliveryPending",
        "operationRetained",
        "operationRemovalConfirmed",
        "taskRecoveryCompleted",
        "cleanupReason",
      ].sort(),
      scenario,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /must_not_escape|preparation|secret|before/,
    );
    if (scenario === "lockReleased")
      assert.equal(
        result.cleanupReason,
        "docker_task_recovery_release_unconfirmed",
      );
  }
});

/**
 * 上位の技術終端判定と非同期前後照合を本番本文で反証する。
 * @responsibility 部分診断と待機中変更から上位保存・ACKへ進めない。
 * @trace ERB-IT-014
 * @trace PRL-IT-005
 * @precondition 本番Objectiveの値判定と現在境界callbackだけを使う。
 * @stimulus 各共同field差、旧形式、getter／Proxy、取消・世代・Queue差を渡す。
 * @observation 判定値とtrap数を観測する。
 * @oracle 正規耐久待ちと同じ現在境界だけを受理する。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 下位診断→上位の技術settled条件。
 */
test("Orchestrator回復はexact耐久待ちと待機後の同じ境界を要求する", () => {
  const source = fs.readFileSync(
    new URL("../../../orchestrator/src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function exactRecoveryCompleted(");
  const end = source.indexOf("\n/**", start);
  const check = runInNewContext(
    `${stripTypeScriptTypes(source.slice(start, end))}; exactRecoveryCompleted`,
    { snapshotPlainRecord, Set, Array },
  ) as (value: unknown, kind: string, id: string) => boolean;
  const base = {
    contract: "crdd-coordinator/current-task-recovery",
    status: "awaiting_delivery",
    reason: "docker_task_recovery_durable_acceptance_pending",
    recoveryId: "exact",
    dockerCleanupConfirmed: true,
    hostCleanupConfirmed: true,
    locksReleased: true,
    historyConfirmed: true,
    deliveryPending: true,
    operationRetained: true,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: null,
  };
  assert.equal(check(base, "docker", "exact"), true);
  for (const key of Object.keys(base)) {
    const original = base[key as keyof typeof base];
    const value =
      typeof original === "boolean"
        ? !original
        : original === null
          ? "unknown"
          : "wrong";
    assert.equal(
      check({ ...base, [key]: value }, "docker", "exact"),
      false,
      key,
    );
    const absent: Record<string, unknown> = { ...base };
    delete absent[key];
    assert.equal(check(absent, "docker", "exact"), false, key);
  }
  assert.equal(check(base, "docker", "other"), false);
  assert.equal(
    check({ status: "recovered", recoveryId: null }, "docker", "exact"),
    false,
  );
  assert.equal(
    check(
      { status: "recovered", recoveryId: null },
      "runtime_process",
      "exact",
    ),
    true,
  );
  let traps = 0;
  const getter = { ...base };
  Object.defineProperty(getter, "status", {
    enumerable: true,
    get() {
      traps++;
      throw new Error("fixture");
    },
  });
  assert.equal(check(getter, "docker", "exact"), false);
  assert.equal(
    check(
      new Proxy(base, {
        get() {
          traps++;
          throw new Error("fixture");
        },
      }),
      "docker",
      "exact",
    ),
    false,
  );
  assert.equal(traps, 0);
  const boundaryStart = source.indexOf(
    "    const recoveryBoundaryCurrent = () => {",
  );
  const boundaryEnd = source.indexOf("    if (unresolvedTasks", boundaryStart);
  assert.ok(boundaryStart >= 0 && boundaryEnd > boundaryStart);
  const body = stripTypeScriptTypes(source.slice(boundaryStart, boundaryEnd));
  for (const scenario of [
    "normal",
    "cancel",
    "process",
    "state",
    "queue",
    "state_blocked",
    "queue_blocked",
    "null",
    "throw",
  ]) {
    const state = {
      generation: 5,
      tasks: [{ recoveryId: "exact", phase: "recovering" }],
    };
    const queue = {
      queueId: "queue",
      generation: 4,
      state: "recovery_required",
      resultReference: "same",
    };
    const current = runInNewContext(`${body}; recoveryBoundaryCurrent`, {
      JSON,
      cancellationSignal: { aborted: scenario === "cancel" },
      recoveryProcess: "owner",
      recoveryQueue: JSON.stringify(queue),
      recoveryState: state,
      request: { projectId: "project" },
      queueId: "queue",
      dependencies: {
        processSafety: {
          getProcessInstanceIdentity: () =>
            scenario === "process" ? "other" : "owner",
        },
      },
      persistence: {
        state: {
          readState: () => {
            if (scenario === "throw") throw new Error("fixture");
            return {
              status: scenario === "state_blocked" ? "blocked" : "completed",
              value:
                scenario === "null"
                  ? null
                  : scenario === "state"
                    ? { ...state, generation: 6 }
                    : state,
            };
          },
          readQueue: () => ({
            status: scenario === "queue_blocked" ? "blocked" : "completed",
            value:
              scenario === "queue"
                ? { ...queue, resultReference: "other" }
                : queue,
          }),
        },
      },
    }) as () => boolean;
    assert.equal(current(), scenario === "normal", scenario);
  }
});

/**
 * ACK直前の二つのガードを本番配置と抽出実行で反証する。
 * @responsibility callback定義だけでなく処置直前の停止が有効であることを確認する。
 * @trace PRL-IT-005
 * @precondition 本番の各try／catch blockをそのまま抽出する。
 * @stimulus 現在境界不成立と、当該ガードだけを無効化した負対照を渡す。
 * @observation 下位処置回数・模擬保存状態・拒否結果。
 * @oracle 原文は処置0、負対照は同じOracleが拒否する。
 * @cleanup N/A: メモリ内だけでProduction Sourceを変更しない。
 * @boundary PRL-IT-005=Related 2 Blocks: 上位ACK前ガード→下位ACK／終了処置。全文の変異試験ではない。
 */
test("ACK直前のガード負対照は処置ゼロOracleに拒否される", () => {
  const source = fs.readFileSync(
    new URL("../../../orchestrator/src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  for (const stage of ["ack", "finalize"] as const) {
    const declaration =
      stage === "ack"
        ? "let acknowledgementResult: unknown;"
        : "let finalized: unknown;";
    const next =
      stage === "ack"
        ? "const acknowledged = snapshotPlainRecord("
        : "const finalResult = snapshotPlainRecord(";
    const start = source.indexOf(declaration);
    const end = source.indexOf(next, start);
    assert.ok(start >= 0 && end > start);
    const original = source.slice(start, end);
    assert.equal(
      (original.match(/if \(!recoveryBoundaryCurrent\(\)\)/gu) ?? []).length,
      1,
    );
    const call =
      stage === "ack"
        ? "taskRecovery.acknowledgeDocker("
        : "taskRecovery.finalizeDockerAcknowledgement(";
    assert.ok(
      original.indexOf("if (!recoveryBoundaryCurrent())") <
        original.indexOf(call),
    );
    for (const bypass of [false, true]) {
      let calls = 0;
      const durable = {
        phase: stage === "ack" ? "settled" : "acknowledged",
        deliveryReleased: false,
      };
      const before = { ...durable };
      const resultName =
        stage === "ack" ? "acknowledgementResult" : "finalized";
      const text = bypass
        ? original.replace("if (!recoveryBoundaryCurrent())", "if (false)")
        : original;
      const result = runInNewContext(
        `${stripTypeScriptTypes(text)}; ${resultName}`,
        {
          Object,
          recoveryBoundaryCurrent: () => false,
          request: { projectId: "project", milestoneId: "milestone" },
          recoveryState: { generation: 3 },
          item: { taskId: "task", recoveryId: "exact" },
          settledTask: { attemptId: "attempt", operationId: "operation" },
          currentObligation: { acknowledgement: {} },
          taskRecovery: {
            acknowledgeDocker: () => {
              calls++;
              durable.deliveryReleased = true;
              return { status: "completed" };
            },
            finalizeDockerAcknowledgement: () => {
              calls++;
              durable.deliveryReleased = true;
              return { status: "completed" };
            },
          },
        },
      );
      if (bypass) {
        assert.throws(() => assert.equal(calls, 0));
        assert.throws(() => assert.deepEqual(durable, before));
      } else {
        assert.equal(calls, 0);
        assert.deepEqual(durable, before);
        assert.equal(result, null);
      }
    }
  }
});

/**
 * transient終了接続を真正な技術Ownerと一回の保存へ限定する。
 * @responsibility 不正Owner・再試行・Root／Host不明からの操作除去を拒否する。
 * @trace ERB-IT-014
 * @precondition 本番終了接続本文と既存私有Map・保存Ownerの固定模擬を使う。
 * @stimulus 各準備条件欠落、保存失敗／例外、Root／Host不明と借用再使用を渡す。
 * @observation 保存回数、終了確認、sticky失敗、借用callback失効。
 * @oracle 有効Ownerの一回だけ保存を試行し、表示・受領値を要求しない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: 技術回収Owner→終了保存Owner。
 */
test("現在transient終了: genuine Owner・一回性・借用失効", () => {
  const storeSource = fs.readFileSync(
    new URL("../../src/storage/settlement-store.ts", import.meta.url),
    "utf8",
  );
  const storeStart = storeSource.indexOf(
    "export function completeRuntimeOwnedCoordinatorCurrentRecovery(",
  );
  const storeEnd = storeSource.indexOf("\n/**", storeStart);
  assert.ok(storeStart >= 0 && storeEnd > storeStart);
  const helperStart = storeSource.indexOf(
    "function completeCoordinatorCurrentRecovery(",
  );
  const helperEnd = storeSource.indexOf("\n/**", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const storeBody = stripTypeScriptTypes(
    storeSource
      .slice(storeStart, storeEnd)
      .replaceAll("export function", "function") +
      storeSource.slice(helperStart, helperEnd),
  );
  const start = source.indexOf(
    "export function completeRuntimeOwnedDockerTaskTransientRecovery(",
  );
  const end = source.indexOf(
    "export function recoverRuntimeOwnedDockerTaskResources(",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replaceAll("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "pending_reentry",
    "closed",
    "releaseAttempted",
    "releaseConfirmed",
    "finalizationAttempted",
    "completionAttempted",
    "persistenceFailed",
    "cleanupUnknown",
    "host",
    "publication",
    "root",
    "host_present",
    "host_unknown",
    "save_failed",
    "save_unlock_failed",
    "save_throw",
    "reader_unlock_failed",
    "reader_rejected",
    "reader_throw",
    "reader_owner_expired",
    "reader_publication_missing",
  ] as const) {
    const key = Object.freeze({}),
      root = Object.freeze({});
    const record = {
      kind: "recovery",
      rootCapability: root,
      recoveryId: "exact",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: true,
      finalizationAttempted: scenario !== "pending_reentry",
      completionPending: scenario === "pending_reentry",
      completionAttempted: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null as object | null,
      hostToken: "host",
      hostRoot: "root",
      repository: { revalidate: () => scenario !== "root" },
    };
    if (
      [
        "closed",
        "releaseAttempted",
        "releaseConfirmed",
        "finalizationAttempted",
      ].includes(scenario)
    )
      Object.assign(record, { [scenario]: false });
    if (
      ["completionAttempted", "persistenceFailed", "cleanupUnknown"].includes(
        scenario,
      )
    )
      Object.assign(record, { [scenario]: true });
    if (scenario === "host") record.hostCleanup = "unknown";
    if (scenario === "publication") record.hostCleanupPublication = {};
    let calls = 0,
      borrowed: (() => boolean) | null = null;
    const complete = runInNewContext(
      `${body}; completeRuntimeOwnedDockerTaskTransientRecovery`,
      {
        Object,
        dockerRecoveryPreparations: new WeakMap([[key, record]]),
        observeHostRecoveryCleanup: () => ({
          root:
            scenario === "host_present"
              ? "present"
              : scenario === "host_unknown"
                ? "unknown"
                : "absent",
          marker: "absent",
        }),
        completeRuntimeOwnedCoordinatorCurrentRecovery(
          receivedRoot: unknown,
          id: string,
          owner: () => boolean,
        ) {
          calls++;
          assert.equal(receivedRoot, root);
          assert.equal(id, "exact");
          borrowed = owner;
          if (scenario === "save_throw") throw new Error("fixture");
          if (scenario.startsWith("reader_")) {
            let writes = 0;
            const save = runInNewContext(
              `${storeBody}; completeRuntimeOwnedCoordinatorCurrentRecovery`,
              {
                Object,
                settlements: new WeakMap(),
                borrowRuntimeOwnedCoordinatorRecoveryRepository: () => ({}),
                readRuntimeOwnedCoordinatorCurrentCompletionSnapshot: () => {
                  if (scenario === "reader_throw") throw new Error("fixture");
                  if (
                    scenario === "reader_owner_expired" ||
                    scenario === "reader_publication_missing"
                  )
                    return {
                      status: "completed",
                      reason: "fixture_reader_ready",
                      lockReleased: true,
                      currentCompletionPublication:
                        scenario === "reader_publication_missing" ? null : {},
                      value: {
                        snapshot: {
                          operations: [{ kind: "docker_task", recoveryId: id }],
                        },
                      },
                    };
                  return {
                    status: "blocked",
                    reason: "fixture_reader_unconfirmed",
                    lockReleased: scenario !== "reader_unlock_failed",
                    currentCompletionPublication: null,
                    value: null,
                  };
                },
                writeCoordinatorStateSnapshot(
                  _a: unknown,
                  repository: unknown,
                ) {
                  if (repository) writes++;
                  return {
                    status: "blocked",
                    reason: "coordinator_state_input_invalid",
                    snapshotConfirmed: false,
                    lockReleased: true,
                    filesystemEffectIssued: false,
                  };
                },
              },
            ) as (root: unknown, id: string, owner: () => boolean) => object;
            let confirmations = 0;
            const saved = save(receivedRoot, id, () => {
              confirmations++;
              return (
                owner() &&
                !(scenario === "reader_owner_expired" && confirmations === 2)
              );
            });
            if (scenario === "reader_owner_expired")
              assert.equal(confirmations, 2);
            assert.equal(writes, 0, scenario);
            return saved;
          }
          const confirmed = owner() && scenario !== "save_failed";
          return {
            status: confirmed ? "completed" : "blocked",
            reason: "fixture",
            snapshotConfirmed: confirmed,
            lockReleased: scenario !== "save_unlock_failed",
            filesystemEffectIssued: confirmed,
          };
        },
      },
    ) as (capability: unknown) => {
      status: string;
      operationRemovalConfirmed: boolean;
      taskRecoveryCompleted: boolean;
      filesystemEffectIssued: boolean;
      lockReleased: boolean;
      cleanupReason?: string | null;
      reason: string;
    };
    assert.equal(complete({}).filesystemEffectIssued, false);
    const result = complete(key);
    const expected = ["normal", "pending_reentry"].includes(scenario);
    assert.equal(result.status, expected ? "completed" : "blocked", scenario);
    assert.equal(result.operationRemovalConfirmed, expected, scenario);
    assert.equal(result.taskRecoveryCompleted, expected, scenario);
    const attempted = [
      "normal",
      "pending_reentry",
      "root",
      "host_present",
      "host_unknown",
      "save_failed",
      "save_unlock_failed",
      "save_throw",
      "reader_unlock_failed",
      "reader_rejected",
      "reader_throw",
      "reader_owner_expired",
      "reader_publication_missing",
    ].includes(scenario);
    assert.equal(calls, attempted ? 1 : 0, scenario);
    if (borrowed) assert.equal((borrowed as () => boolean)(), false, scenario);
    const count = calls;
    assert.equal(complete(key).filesystemEffectIssued, false, scenario);
    assert.equal(calls, count, scenario);
    if (attempted && !expected)
      assert.equal(record.persistenceFailed, true, scenario);
    if (scenario.startsWith("reader_")) {
      const unknown = scenario === "reader_unlock_failed";
      assert.equal(result.lockReleased, !unknown, scenario);
      assert.equal(record.cleanupUnknown, unknown, scenario);
      assert.equal(
        result.cleanupReason,
        unknown ? "docker_task_recovery_release_unconfirmed" : null,
        scenario,
      );
      assert.equal(
        result.reason,
        [
          "reader_throw",
          "reader_owner_expired",
          "reader_publication_missing",
        ].includes(scenario)
          ? "coordinator_state_input_invalid"
          : "fixture_reader_unconfirmed",
        scenario,
      );
      assert.equal(result.filesystemEffectIssued, false, scenario);
    }
  }
});

/**
 * 終端Writerの候補生成を固定前提と元結果へ限定する。
 * @responsibility 不明資源・Host・Ownerと元版差で保存候補を発行しないことを反証する。
 * @trace ERB-IT-014
 * @precondition 本番Writer本文と模擬Reader／候補生成／物理Writerだけを使う。
 * @stimulus 五資源の各未終了形、HostとOwner欠測、既存三結果と結果欠測を渡す。
 * @observation 候補生成と物理保存回数、固定lifecycle値、Writer中の再確認。
 * @oracle 全前提成立時だけ結果・一次失敗を保持したsettling候補を保存する。
 * @cleanup N/A: 外部資源を作成しない。実Filesystem保存は別のHost試験が所有する。
 * @boundary ERB-IT-014=Direct Boundary: 本番固定Writerの前提検査。
 */
test("現在回収終端Writer: 五資源・Host・元版の拒否と結果保持", () => {
  const storeSource = fs.readFileSync(
    new URL("../../src/storage/settlement-store.ts", import.meta.url),
    "utf8",
  );
  const writerStart = storeSource.indexOf(
    "export function writeRuntimeOwnedCoordinatorRecoveryTerminal(",
  );
  const writerEnd = storeSource.indexOf(
    "export function writeRuntimeOwnedCoordinatorRecoveryCheckpoint(",
    writerStart,
  );
  assert.ok(writerStart >= 0 && writerEnd > writerStart);
  const writerBody = stripTypeScriptTypes(
    storeSource
      .slice(writerStart, writerEnd)
      .replaceAll("export function", "function"),
  );
  const mutantBody = writerBody
    .replaceAll(
      "writeRuntimeOwnedCoordinatorRecoveryTerminal",
      "mutatedRecoveryTerminal",
    )
    .replace(
      "!isDockerRestartCheckpointSettled(operation.dockerRestart)",
      "false",
    );
  assert.notEqual(
    mutantBody,
    writerBody.replaceAll(
      "writeRuntimeOwnedCoordinatorRecoveryTerminal",
      "mutatedRecoveryTerminal",
    ),
  );
  const restartCases = ["not_issued", "unknown", "issued", "confirmed"].flatMap(
    (request) =>
      ["not_required", "pending", "confirmed", "unknown"].flatMap((cleanup) =>
        ["null", "completed", "blocked"].map(
          (result) => `restart:${request}:${cleanup}:${result}`,
        ),
      ),
  );
  for (const scenario of [
    "null",
    "blocked",
    "completed",
    "cancelled",
    "before_changed",
    "operation_changed",
    "missing",
    "host_pending",
    "transition_pending",
    "owner_active",
    "awaiting",
    "restart_unknown",
    "restart_unissued_final",
    "restart_unissued_effect_unknown",
    "owner_changed",
    ...restartCases,
    ...purposes.flatMap((purpose) =>
      [
        "unknown",
        "issued",
        "intent_saved",
        "unidentified_absent",
        "present",
      ].map((value) => `${purpose}:${value}`),
    ),
  ]) {
    const existing =
      scenario === "completed"
        ? {
            status: "completed",
            reason: "provider_operation_completed",
            cleanupConfirmed: false,
          }
        : scenario === "cancelled"
          ? {
              status: "cancelled",
              reason: "provider_operation_cancelled",
              cleanupConfirmed: false,
            }
          : scenario === "blocked"
            ? {
                status: "blocked",
                reason: "provider_result_invalid",
                cleanupConfirmed: false,
              }
            : null;
    const operation = {
      kind: "docker_task",
      identityJson: JSON.stringify({
        operationId: scenario === "operation_changed" ? "other" : "OP-1",
      }),
      recoveryId: "exact-recovery",
      phase: scenario === "awaiting" ? "awaiting_delivery" : "settling",
      host: {
        cleanup: scenario === "host_pending" ? "pending" : "confirmed",
        pendingTransitionJson:
          scenario === "transition_pending" ? "pending" : null,
      },
      execution: {
        ownerEffect: scenario === "owner_active" ? "active" : "disabled",
        externalSend: "issued",
      },
      primaryFailure: existing === null ? null : { reason: "original_failure" },
      outcome: existing,
      summarySha256: null,
      dockerRestart: scenario.startsWith("restart_unissued_")
        ? {
            requestId: "a".repeat(64),
            scopeSha256: "b".repeat(64),
            request: "unknown",
            cleanup: "confirmed",
            result: {
              status: "blocked",
              reason: "docker_restart_stop_unconfirmed",
              request: "not_issued",
              effectOutcomeUnknown:
                scenario === "restart_unissued_effect_unknown",
            },
          }
        : scenario.startsWith("restart:")
          ? {
              requestId: "a".repeat(64),
              scopeSha256: "b".repeat(64),
              request: scenario.split(":")[1],
              cleanup: scenario.split(":")[2],
              result:
                scenario.split(":")[3] === "null"
                  ? null
                  : {
                      status: scenario.split(":")[3],
                      reason: "fixed_result",
                      request: scenario.split(":")[1],
                      effectOutcomeUnknown: ![
                        "not_issued",
                        "confirmed",
                      ].includes(scenario.split(":")[1] ?? ""),
                    },
            }
          : scenario === "restart_unknown"
            ? { request: "unknown", cleanup: "pending", result: null }
            : null,
      resources: purposes.map((purpose) => {
        const state = scenario.startsWith(`${purpose}:`)
          ? scenario.slice(purpose.length + 1)
          : "not_requested";
        return {
          purpose,
          request:
            state === "present"
              ? "identified"
              : state === "unidentified_absent"
                ? "unknown"
                : state,
          observation:
            state === "unidentified_absent"
              ? "absent"
              : state === "present"
                ? "present"
                : "unobserved",
        };
      }),
    };
    const snapshot = { operations: scenario === "missing" ? [] : [operation] };
    const before = Buffer.from(`${JSON.stringify(snapshot)}\n`);
    let candidates = 0,
      writes = 0,
      ownerChecks = 0;
    const repository = {
      operationId: "OP-1",
      repositoryBinding: "fixed",
      revalidate: () => true,
    };
    const writer = runInNewContext(
      `${writerBody}; ${mutantBody}; writeRuntimeOwnedCoordinatorRecoveryTerminal.mutant = mutatedRecoveryTerminal; writeRuntimeOwnedCoordinatorRecoveryTerminal`,
      {
        Buffer,
        isDockerRestartCheckpointSettled,
        coordinatorTaskResourcesAreSettled,
        encodeCoordinatorStateValue: JSON.stringify,
        readCoordinatorStateSnapshot: () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot },
        }),
        prepareCoordinatorStateLifecycleSnapshot(
          bytes: Buffer,
          recoveryId: string,
          lifecycle: unknown,
          binding: string,
        ) {
          candidates++;
          assert.deepEqual(bytes, before);
          assert.equal(recoveryId, "exact-recovery");
          assert.equal(binding, "fixed");
          assert.deepEqual(JSON.parse(JSON.stringify(lifecycle)), {
            phase: "settling",
            lease: "released",
            execution: operation.execution,
            primaryFailure: operation.primaryFailure,
            outcome:
              existing === null
                ? {
                    status: "blocked",
                    reason: "docker_process_controller_execution_failed_closed",
                    cleanupConfirmed: true,
                  }
                : { ...existing, cleanupConfirmed: true },
            summarySha256: null,
          });
          return Buffer.from("fixed-candidate");
        },
        writeCoordinatorStateSnapshot(
          _management: unknown,
          bound: { revalidate: () => boolean } | null,
          candidate: Buffer | null,
        ) {
          if (candidate === null)
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          writes++;
          assert.equal(bound?.revalidate(), true);
          assert.equal(candidate.toString(), "fixed-candidate");
          return {
            status: "completed",
            snapshotConfirmed: true,
            lockReleased: true,
          };
        },
      },
    ) as ((
      repo: unknown,
      recoveryId: string,
      bytes: Buffer,
      owner: () => boolean,
    ) => { snapshotConfirmed: boolean }) & {
      mutant: (...args: unknown[]) => { snapshotConfirmed: boolean };
    };
    const result = writer(
      repository,
      "exact-recovery",
      scenario === "before_changed" ? Buffer.from("different") : before,
      () => ++ownerChecks === 1 || scenario !== "owner_changed",
    );
    const accepted = [
      "null",
      "blocked",
      "completed",
      "cancelled",
      "restart:not_issued:not_required:null",
      "restart:confirmed:confirmed:completed",
      "restart:confirmed:confirmed:blocked",
      "restart_unissued_final",
    ].includes(scenario);
    assert.equal(result.snapshotConfirmed, accepted, scenario);
    assert.equal(candidates, accepted ? 1 : 0, scenario);
    assert.equal(writes, accepted ? 1 : 0, scenario);
    assert.equal(before.toString(), `${JSON.stringify(snapshot)}\n`);
    if (
      [
        "restart:confirmed:confirmed:null",
        "restart_unissued_effect_unknown",
      ].includes(scenario)
    ) {
      assert.equal(
        writer.mutant(repository, "exact-recovery", before, () => true)
          .snapshotConfirmed,
        true,
      );
      assert.equal(candidates, 1);
      assert.equal(writes, 1);
    }
  }
});

/**
 * 同じ本番本文を模擬Owner・状態と実Executorへ結合する。
 * @responsibility 固定要求と保存順を観測し、試験物を自己所有Rootへ限定する。
 * @trace ERB-IT-014
 * @precondition Repository Rootの.gitと通常tests親を検証する。
 * @stimulus 一つのNetworkと四つの未要求資源を構築する。
 * @observation 要求、Writer、読戻し、元操作と非対象操作を返す。
 * @oracle 本番本文とDI本体を変更せず、spawnだけを差し替える。
 * @cleanup mockを復元し、exact自己生成Directoryを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: Owner→実Executorと空config。
 */
function fixture(
  t: TestContext,
  request: "unknown" | "intent_saved" | "identified" = "unknown",
  withEgress = false,
  existingAbsence = false,
  operationFactory = false,
) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  assert.ok(fs.statSync(path.join(root, ".git")).isDirectory());
  const parent = path.join(root, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "current-recovery-resources-"),
  );
  const configDirectory = path.join(directory, "config");
  fs.mkdirSync(configDirectory);
  const managementDirectory = path.join(directory, "management");
  const oldConfigDirectory = path.join(
    managementDirectory,
    "docker-recovery-config-old",
  );
  if (operationFactory) {
    fs.mkdirSync(managementDirectory);
    fs.mkdirSync(oldConfigDirectory);
    fs.writeFileSync(path.join(oldConfigDirectory, "preserved"), "old-config");
  }
  let operationConfig: string | null = null;
  let factoryCalls = 0,
    closeCalls = 0;
  const events: string[] = [];
  const argvLog: string[][] = [];
  let live = true,
    writerRefused = false,
    staleReadback = false,
    removed = existingAbsence;
  const cleanupWrites: {
    previousHash: string;
    observations: {
      purpose: string;
      plannedResourceName: string;
      dockerId: string | null;
      observation: string;
    }[];
  }[] = [];
  let mode = "normal";
  const resources = purposes.map((purpose) => ({
    purpose,
    request:
      purpose === "create_internal_network"
        ? request
        : withEgress && purpose === "create_egress_network"
          ? "unknown"
          : "not_requested",
    dockerId:
      purpose === "create_internal_network" && request === "identified"
        ? id
        : null,
    receiptSource:
      purpose === "create_internal_network" && request === "identified"
        ? "docker_create_result"
        : null,
    observation:
      purpose === "create_internal_network" && existingAbsence
        ? "absent"
        : "unobserved",
    absence:
      purpose === "create_internal_network" && existingAbsence
        ? {
            recoveryId: "exact-recovery",
            purpose,
            plannedResourceName: name,
            dockerId: id,
            evidenceSha256: "e".repeat(64),
          }
        : (null as {
            recoveryId: string;
            purpose: string;
            plannedResourceName: string;
            dockerId: string | null;
            evidenceSha256: string;
          } | null),
  }));
  const operation = {
    kind: "docker_task",
    recoveryId: "exact-recovery",
    identityJson: JSON.stringify({
      resources: {
        internal: name,
        egress: "crdd-egress-0123456789abcdef",
        provider: "crdd-claude-0123456789abcdef",
        proxy: "crdd-proxy-0123456789abcdef",
        auth: "crdd-auth-0123456789abcdef",
      },
      ownershipLabel: label,
      images: {
        provider: `sha256:${"b".repeat(64)}`,
        proxy: `sha256:${"c".repeat(64)}`,
      },
      operationMode: "isolated_task",
      workspaceMountMode: "read_write",
    }),
    resources,
    host: { cleanup: "not_requested" },
    lease: "held",
    outcome: null,
    primaryFailure: { reason: "original_failure" },
  };
  const untouched = { recoveryId: "other-recovery", marker: "unchanged" };
  const snapshot = { operations: [operation, untouched] };
  const initial = JSON.stringify(snapshot);
  const capability = Object.freeze({});
  const record = {
    kind: "recovery",
    recoveryId: operation.recoveryId,
    rootCapability: {},
    before: Buffer.from(`${JSON.stringify(snapshot)}\n`),
    closed: false,
    persistenceFailed: false,
    cleanupUnknown: false,
    hostCleanup: "present",
    hostCleanupPublication: null,
    repository: { repositoryBinding: "f".repeat(64) },
    hostToken: "exact-host-token",
    hostGeneration: Object.freeze({}),
  };
  const map = new WeakMap([[capability, record]]);
  const replacement = mock.method(
    childProcess,
    "spawnSync",
    (
      executable: string,
      argv: readonly string[],
      options: childProcess.SpawnSyncOptions,
    ) => {
      assert.equal(
        executable,
        "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
      );
      const selectedConfig = argv[3];
      if (operationFactory) {
        assert.ok(selectedConfig);
        assert.equal(path.dirname(selectedConfig), managementDirectory);
        assert.ok(
          path.basename(selectedConfig).startsWith("docker-recovery-config-"),
        );
        assert.notEqual(selectedConfig, oldConfigDirectory);
        assert.equal(operationConfig, selectedConfig);
      }
      assert.deepEqual(argv.slice(0, 4), [
        "--host",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        "--config",
        operationFactory ? operationConfig : configDirectory,
      ]);
      assert.equal(options.shell, false);
      assert.equal(options.windowsHide, true);
      assert.equal(options.timeout, 10_000);
      assert.equal(options.maxBuffer, 1_048_576);
      assert.deepEqual({ ...options.env }, { SystemRoot: "fixed-test" });
      const command = argv.slice(4);
      argvLog.push([...command]);
      events.push(`docker:${command[1]}`);
      let stdout = "",
        stderr = "",
        status: number | null = 0;
      let signal: NodeJS.Signals | null = null;
      let error: Error | undefined;
      if (mode === "signal") signal = "SIGTERM";
      if (mode === "error") {
        error = new Error("synthetic failure");
        status = null;
      }
      if (mode === "stderr") stderr = "synthetic diagnostic";
      if (command[1] === "ls" && !removed) {
        stdout =
          mode === "empty"
            ? ""
            : mode === "multiple"
              ? `${id}\n${"d".repeat(64)}\n`
              : `${id}\n`;
        if (mode === "disappear" && command.includes(`id=${id}`)) stdout = "";
        if (
          mode === "foreign" &&
          command.some((value) => value.startsWith("label="))
        )
          stdout = `${"d".repeat(64)}\n`;
      } else if (command[1] === "inspect") {
        stdout = JSON.stringify([
          {
            Id: id,
            Name: name,
            Labels: { "crdd.coordinator.runtime": "0123456789abcdef" },
            Driver: "bridge",
            Scope: "local",
            Internal: true,
          },
        ]);
      } else if (command[1] === "rm") {
        const selected = operation.resources.find(
          (value) => value.purpose === "create_internal_network",
        );
        assert.equal(selected?.dockerId, id);
        assert.equal(selected?.request, "identified");
        assert.equal(record.before.toString(), `${JSON.stringify(snapshot)}\n`);
        removed = true;
        stdout = `${id}\n`;
      }
      if (
        mode === "owner-lost" ||
        (mode === "inspect-owner-lost" && command[1] === "inspect")
      )
        live = false;
      return {
        pid: 0,
        output: [null, stdout, stderr],
        stdout,
        stderr,
        status,
        signal,
        ...(error ? { error } : {}),
      };
    },
  );
  syncBuiltinESMExports();
  let disposed = false;
  /**
   * 自己生成試験境界を一度だけ片付ける。
   * @responsibility 後続fixtureへProcess差替えを漏らさない。
   * @trace ERB-IT-014
   * @precondition このfixtureが作成したexact Directoryとmockを持つ。
   * @stimulus 正常終了またはTest hookから呼ぶ。
   * @observation mock復元とDirectory不存在。
   * @oracle 同じRoot内の自作物だけを回収する。
   * @cleanup 本関数が所有するmockと空configを回収する。
   * @boundary 試験の固定Process差替えとRepository-local試験物。
   */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    replacement.mock.restore();
    syncBuiltinESMExports();
    assert.equal(
      path.dirname(fs.realpathSync(directory)),
      fs.realpathSync(parent),
    );
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  };
  t.after(dispose);
  const executor = createDockerResourceRecoveryExecutor({
    configDirectory,
    configIdentity: observeDockerRecoveryConfigIdentity(configDirectory),
    environment: () => ({ SystemRoot: "fixed-test" }),
    verifyCli: () => {
      events.push("cli");
      assert.equal(live, true);
    },
  });
  const context = {
    coordinatorTaskResourcesAreSettled,
    coordinatorAuthenticationUnknownCanClose,
    planDockerRecoveryResourceExpectations,
    isDockerResourcePurpose,
    Buffer,
    Object,
    Error,
    Map,
    dockerRecoveryPreparations: map,
    assertCurrentRecoveryOwner: () => {
      const observed = live;
      if (mode === "inspect-owner-lost") live = true;
      return observed;
    },
    encodeCoordinatorStateValue: JSON.stringify,
    codexAdviceProviderInitRequired: () => false,
    decodeCoordinatorStateSnapshot: (bytes: Buffer, binding: string) => {
      assert.equal(binding, record.repository.repositoryBinding);
      assert.equal(bytes.toString(), record.before.toString());
      return { snapshot: JSON.parse(bytes.toString()) };
    },
    borrowHostRecoveryManagementDirectory: (
      token: string,
      generation: object,
    ) => {
      assert.equal(token, record.hostToken);
      assert.equal(generation, record.hostGeneration);
      events.push("borrow");
      return {
        directory: managementDirectory,
        assertCurrent: () => mode !== "factory-refused",
      };
    },
    createDockerTaskRecoveryExecutor: (
      input: Pick<
        Parameters<typeof createDockerOperationRecoveryExecutor>[0],
        "managementDirectory" | "assertOwner"
      >,
    ) => {
      factoryCalls++;
      events.push("factory");
      assert.equal(input.managementDirectory, managementDirectory);
      assert.deepEqual(Object.keys(input).sort(), [
        "assertOwner",
        "managementDirectory",
      ]);
      const created = createDockerOperationRecoveryExecutor({
        managementDirectory: input.managementDirectory,
        assertOwner: input.assertOwner,
        verifyCli: () => {
          events.push("cli");
          assert.equal(live, true);
        },
        environment: () => ({ SystemRoot: "fixed-test" }),
      });
      if (created.status !== "ready") return created;
      const configs = fs
        .readdirSync(managementDirectory)
        .filter(
          (entry) =>
            entry.startsWith("docker-recovery-config-") &&
            entry !== "docker-recovery-config-old",
        );
      assert.equal(configs.length, 1);
      operationConfig = path.join(managementDirectory, configs[0] as string);
      return {
        ...created,
        executor: {
          ...created.executor,
          close: () => {
            closeCalls++;
            events.push("close");
            const confirmed = created.executor.close();
            if (mode === "close-throw")
              throw new Error("synthetic close observation failure");
            return confirmed;
          },
        },
      };
    },
    readRuntimeOwnedCoordinatorRecoverySnapshot: () => {
      events.push("readback");
      return {
        status: "completed",
        lockReleased: true,
        value: { snapshot: staleReadback ? JSON.parse(initial) : snapshot },
      };
    },
    persistRuntimeOwnedDockerTaskRecoveryCheckpoint: (
      _capability: unknown,
      kind: string,
      value: unknown,
    ) => {
      events.push(`write:${kind}`);
      if (writerRefused) {
        record.persistenceFailed = true;
        return false;
      }
      if (kind === "resource") {
        const next = value as (typeof resources)[number];
        operation.resources = operation.resources.map((old) =>
          old.purpose === next.purpose ? next : old,
        );
      } else {
        const observations = value as {
          purpose: string;
          plannedResourceName: string;
          dockerId: string | null;
          observation: string;
        }[];
        const previousHash = createHash("sha256")
          .update(record.before)
          .digest("hex");
        cleanupWrites.push({
          previousHash,
          observations: JSON.parse(JSON.stringify(observations)),
        });
        operation.resources = operation.resources.map((old) => {
          const observed = observations.find(
            (item) => item.purpose === old.purpose,
          );
          assert.ok(observed);
          if (observed.observation === "not_requested") return old;
          return {
            ...old,
            observation: observed.observation,
            absence:
              observed.observation === "absent"
                ? {
                    recoveryId: operation.recoveryId,
                    purpose: old.purpose,
                    plannedResourceName: observed.plannedResourceName,
                    dockerId: old.dockerId,
                    evidenceSha256: createHash("sha256")
                      .update(
                        JSON.stringify({
                          recoveryId: operation.recoveryId,
                          previousPayloadSha256: previousHash,
                          observation: observed,
                        }),
                      )
                      .digest("hex"),
                  }
                : old.absence,
          };
        });
      }
      record.before = Buffer.from(`${JSON.stringify(snapshot)}\n`);
      if (
        operationFactory &&
        kind === "cleanup" &&
        ["nonempty-close", "identity-close"].includes(mode)
      ) {
        assert.ok(operationConfig);
        if (mode === "nonempty-close")
          fs.writeFileSync(
            path.join(operationConfig, "unexpected"),
            "known-test-byte",
          );
        if (mode === "identity-close") {
          fs.renameSync(operationConfig, `${operationConfig}-original`);
          fs.mkdirSync(operationConfig);
        }
      }
      return true;
    },
  };
  const run = runInNewContext(
    `${body}\nrecoverRuntimeOwnedDockerTaskResources`,
    context,
  ) as (
    owner: unknown,
    operations: typeof executor,
  ) => {
    status: string;
    dockerCleanupConfirmed: boolean;
    recoveryId: string;
    reason: string;
  };
  const execute = runInNewContext(
    `${body}\nexecuteRuntimeOwnedDockerTaskResourceRecovery`,
    context,
  ) as (
    owner: unknown,
  ) => ReturnType<typeof run> & { configCleanupConfirmed: boolean };
  return {
    executor,
    dispose,
    events,
    argvLog,
    cleanupWrites,
    operation,
    untouched,
    initial,
    record,
    managementDirectory,
    oldConfigDirectory,
    execute: () => execute(capability),
    get operationConfig() {
      return operationConfig;
    },
    get factoryCalls() {
      return factoryCalls;
    },
    get closeCalls() {
      return closeCalls;
    },
    run: () => run(capability, executor),
    set mode(value: string) {
      mode = value;
    },
    set writerRefused(value: boolean) {
      writerRefused = value;
    },
    set staleReadback(value: boolean) {
      staleReadback = value;
    },
  };
}

/**
 * 実Executorの発見と削除をID保存・読戻しで順序付ける。
 * @responsibility 予定名だけの削除と保存前削除を拒否するOracleを所有する。
 * @trace ERB-IT-014
 * @precondition 一Networkのみ要求済み、他四資源は未要求。
 * @stimulus unknown・intent_saved・known IDを回収する。
 * @observation 実固定argv、保存・読戻し順と最終五観測。
 * @oracle intentをunknownへ保存、発見IDをreconciliation保存、読戻し後にだけrm。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Owner→DI Executor。
 */
test("実ExecutorのID発見は同state保存・読戻し後にだけ削除する", (t) => {
  for (const request of ["unknown", "intent_saved", "identified"] as const) {
    const f = fixture(t, request);
    const result = f.run();
    assert.equal(result.status, "completed", result.reason);
    assert.equal(result.dockerCleanupConfirmed, true);
    const rm = f.events.indexOf("docker:rm");
    assert.ok(rm > 0);
    const writes = f.events.flatMap((value, index) =>
      value === "write:resource" ? [index] : [],
    );
    assert.equal(
      writes.length,
      request === "intent_saved" ? 2 : request === "unknown" ? 1 : 0,
    );
    for (const write of writes) {
      assert.ok(write < rm);
      assert.ok(f.events.slice(write + 1, rm).includes("readback"));
    }
    if (request === "intent_saved") {
      const firstWrite = writes[0];
      assert.ok(firstWrite !== undefined);
      assert.ok(firstWrite < f.events.indexOf("docker:ls"));
    }
    assert.equal(f.argvLog.filter((argv) => argv[1] === "rm").length, 1);
    assert.deepEqual(
      f.argvLog.find((argv) => argv[1] === "rm"),
      ["network", "rm", id],
    );
    assert.ok(f.argvLog.slice(-2).every((argv) => argv[1] === "ls"));
    assert.equal(
      f.operation.resources.find(
        (value) => value.purpose === "create_internal_network",
      )?.observation,
      "absent",
    );
    assert.deepEqual(f.operation.host, { cleanup: "not_requested" });
    assert.equal(f.operation.lease, "held");
    assert.equal(f.operation.outcome, null);
    assert.deepEqual(f.operation.primaryFailure, {
      reason: "original_failure",
    });
    assert.deepEqual(f.untouched, {
      recoveryId: "other-recovery",
      marker: "unchanged",
    });
    f.dispose();
  }
});

/**
 * 上位本番組立てが自作configを全返却経路で閉じる。
 * @responsibility 操作管理直下の一意configと既存残存の非使用を確認する。
 * @trace ERB-IT-014
 * @precondition Host借用と現在状態だけを差し替え、DI factoryとFilesystemは実本体を使う。
 * @stimulus 正常、未発見、保存拒否、Owner失効を与える。
 * @observation factory件数、実spawn config、close、自作不存在と旧prefix本文。
 * @oracle config清掃とDocker結果を分離し、旧prefix変更0、Host・Lease・結果不変。
 * @cleanup fixtureのexact自己生成領域とmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 上位execute→実DI factory／spawn差替え。
 */
test("本番config接続は正常と拒否でも自作だけを閉じる", (t) => {
  for (const failure of ["normal", "empty", "writer", "owner-lost"]) {
    const f = fixture(t, "unknown", false, false, true);
    const preserved = JSON.stringify({
      host: f.operation.host,
      lease: f.operation.lease,
      outcome: f.operation.outcome,
      primary: f.operation.primaryFailure,
      other: f.untouched,
    });
    if (failure === "writer") f.writerRefused = true;
    else f.mode = failure;
    const result = f.execute();
    assert.equal(
      result.status,
      failure === "normal" ? "completed" : "blocked",
      failure,
    );
    assert.equal(result.recoveryId, "exact-recovery");
    assert.equal(result.dockerCleanupConfirmed, failure === "normal");
    assert.equal(result.configCleanupConfirmed, true);
    assert.equal(f.factoryCalls, 1);
    assert.equal(f.closeCalls, 1);
    assert.ok(f.operationConfig);
    assert.equal(fs.existsSync(f.operationConfig), false);
    assert.deepEqual(fs.readdirSync(f.managementDirectory), [
      "docker-recovery-config-old",
    ]);
    assert.equal(
      fs.readFileSync(path.join(f.oldConfigDirectory, "preserved"), "utf8"),
      "old-config",
    );
    assert.equal(
      JSON.stringify({
        host: f.operation.host,
        lease: f.operation.lease,
        outcome: f.operation.outcome,
        primary: f.operation.primaryFailure,
        other: f.untouched,
      }),
      preserved,
    );
    if (failure !== "normal")
      assert.equal(
        f.argvLog.some((argv) => argv[1] === "rm"),
        false,
      );
    f.dispose();
  }
});

/**
 * factory拒否ではconfig作成・Docker要求を発行しない。
 * @responsibility Host借用成功だけを技術処置許可へ昇格しない。
 * @trace ERB-IT-014
 * @precondition 実DI factoryのOwner確認だけをfalseにする。
 * @stimulus 作成前拒否と同Ownerへの再呼出し。
 * @observation argv0、管理領域entries、factoryとclose件数。
 * @oracle 旧prefixのみ保持、自作生成0・要求0、同参照blocked。
 * @cleanup fixtureの自己生成領域とmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: execute→DI factory拒否。
 */
test("本番config factory拒否は作成前Effect0で停止する", (t) => {
  const f = fixture(t, "unknown", false, false, true);
  f.mode = "factory-refused";
  const before = JSON.stringify(f.operation);
  const result = f.execute();
  assert.equal(result.status, "blocked");
  assert.equal(result.configCleanupConfirmed, true);
  assert.equal(result.recoveryId, "exact-recovery");
  assert.equal(f.operationConfig, null);
  assert.equal(f.closeCalls, 0);
  assert.deepEqual(f.argvLog, []);
  assert.deepEqual(fs.readdirSync(f.managementDirectory), [
    "docker-recovery-config-old",
  ]);
  assert.equal(JSON.stringify(f.operation), before);
  const events = [...f.events];
  assert.equal(f.execute().status, "blocked");
  assert.deepEqual(f.events, events);
});

/**
 * closeの非空・実体差・例外を資源回収成功と区別する。
 * @responsibility 自作config不明をstickyに保持し、再実行で成功へ戻さない。
 * @trace ERB-IT-014
 * @precondition 実factoryの自作configを使い、close直前に故障だけを注入する。
 * @stimulus 非空、実体差替え、実close後の観測例外を与える。
 * @observation 資源結果とconfig結果、旧prefix、再呼出し要求数。
 * @oracle 同参照blocked・cleanupUnknown保持、二度目factory／要求0、旧prefix不変。
 * @cleanup 由来既知の故障注入物をfixture終了時だけ回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 実DI close→上位finally。
 */
test("本番config close不明は資源成功を全体完成へ昇格しない", (t) => {
  for (const failure of ["nonempty-close", "identity-close", "close-throw"]) {
    const f = fixture(t, "unknown", false, false, true);
    f.mode = failure;
    const result = f.execute();
    assert.equal(result.status, "blocked");
    assert.equal(result.dockerCleanupConfirmed, true);
    assert.equal(result.configCleanupConfirmed, false);
    assert.equal(
      result.reason,
      "docker_task_recovery_config_cleanup_unconfirmed",
    );
    assert.equal(result.recoveryId, "exact-recovery");
    assert.equal(f.record.cleanupUnknown, true);
    assert.equal(f.closeCalls, 1);
    assert.ok(f.operationConfig);
    assert.equal(fs.existsSync(f.operationConfig), failure !== "close-throw");
    assert.equal(
      fs.readFileSync(path.join(f.oldConfigDirectory, "preserved"), "utf8"),
      "old-config",
    );
    assert.deepEqual(f.operation.host, { cleanup: "not_requested" });
    assert.equal(f.operation.lease, "held");
    assert.equal(f.operation.outcome, null);
    const events = [...f.events];
    const again = f.execute();
    assert.equal(again.status, "blocked");
    assert.equal(again.recoveryId, "exact-recovery");
    assert.equal(again.configCleanupConfirmed, false);
    assert.equal(f.record.cleanupUnknown, true);
    assert.deepEqual(f.events, events);
    assert.equal(f.factoryCalls, 1);
    assert.equal(f.closeCalls, 1);
    assert.equal(f.run().status, "blocked");
    assert.deepEqual(f.events, events);
    f.dispose();
  }
});

/**
 * 全未要求では上位factoryも借用も生成しない。
 * @responsibility 不要な短命設定を未要求の操作へ追加しない。
 * @trace ERB-IT-014
 * @precondition 五用途を全てnot_requestedまたはnot_issuedにする。
 * @stimulus 本番executeの未要求分岐を呼ぶ。
 * @observation factory／close／argv0と管理領域entries。
 * @oracle config生成0・Host借用0、資源値とHost／Lease／結果を保持する。
 * @cleanup fixtureの自己生成領域とmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: execute未要求分岐→固定Writer。
 */
test("本番executeは全未要求でfactoryとHost借用を呼ばない", (t) => {
  for (const request of ["not_requested", "not_issued"]) {
    const f = fixture(t, "unknown", false, false, true);
    f.operation.resources = f.operation.resources.map((resource) => ({
      ...resource,
      request,
    }));
    f.record.before = Buffer.from(
      `${JSON.stringify({ operations: [f.operation, f.untouched] })}\n`,
    );
    const before = JSON.stringify(f.operation);
    const result = f.execute();
    assert.equal(result.status, "completed");
    assert.equal(result.dockerCleanupConfirmed, true);
    assert.equal(result.configCleanupConfirmed, true);
    assert.equal(f.factoryCalls, 0);
    assert.equal(f.closeCalls, 0);
    assert.deepEqual(f.argvLog, []);
    assert.equal(f.events.includes("borrow"), false);
    assert.equal(JSON.stringify(f.operation), before);
    assert.deepEqual(fs.readdirSync(f.managementDirectory), [
      "docker-recovery-config-old",
    ]);
    f.dispose();
  }
});

/**
 * 実Executorの拒否をunknownとして保持し削除しない。
 * @responsibility 外部Process結果不明から清掃成功を捏造しない。
 * @trace ERB-IT-014
 * @precondition 未識別のNetwork作成結果がunknown。
 * @stimulus foreign、複数ID、途中消失、空照会、Signal、error、stderrを与える。
 * @observation 固定要求と最終unknown、削除件数。
 * @oracle 削除0、Docker清掃確認false、同参照と非対象不変。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 現在Owner→DI拒否。
 */
test("foreign・観測不能・未発見を清掃成功へ補完しない", (t) => {
  for (const mode of [
    "foreign",
    "multiple",
    "disappear",
    "empty",
    "signal",
    "error",
    "stderr",
  ]) {
    const f = fixture(t);
    f.mode = mode;
    const result = f.run();
    assert.equal(result.status, "blocked", mode);
    assert.equal(result.dockerCleanupConfirmed, false, mode);
    assert.equal(result.recoveryId, "exact-recovery");
    assert.equal(
      f.argvLog.some((argv) => argv[1] === "rm"),
      false,
      mode,
    );
    assert.equal(
      f.operation.resources.find(
        (value) => value.purpose === "create_internal_network",
      )?.observation,
      "unknown",
      mode,
    );
    assert.equal(
      f.events.filter((event) => event === "write:resource").length,
      0,
      mode,
    );
    assert.deepEqual(f.untouched, {
      recoveryId: "other-recovery",
      marker: "unchanged",
    });
    f.dispose();
  }
});

/**
 * 保存拒否・読戻し差・Owner失効で後続削除を止める。
 * @responsibility 一度不明となったOwnerから追加処置を発行しない。
 * @trace ERB-IT-014
 * @precondition DI発見前後の模擬状態境界だけを故障させる。
 * @stimulus Writer拒否、保存後別値読戻し、Docker応答中Owner失効。
 * @observation Writerと削除件数、再入場時の追加要求。
 * @oracle 削除0、同参照保持、不明後のWriter・要求再発行0。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 保存・Owner拒否→DI停止。
 */
test("保存・Owner不明は実Executorの削除前に停止する", (t) => {
  for (const mode of ["writer", "readback", "owner"]) {
    const f = fixture(t);
    if (mode === "writer") f.writerRefused = true;
    if (mode === "readback") f.staleReadback = true;
    if (mode === "owner") f.mode = "owner-lost";
    assert.equal(f.run().status, "blocked", mode);
    assert.equal(
      f.argvLog.some((argv) => argv[1] === "rm"),
      false,
      mode,
    );
    const before = [...f.events];
    assert.equal(f.run().status, "blocked");
    assert.deepEqual(f.events, before);
    f.dispose();
  }
});

/**
 * 削除直前の同期確認はtrue以外を処置許可にしない。
 * @responsibility inspect後の許可確認と削除要求を一つの固定境界で評価する。
 * @trace ERB-IT-014
 * @precondition 同構成のknown Networkを使用する。
 * @stimulus callbackへtrue、false、throw、thenableを返す。
 * @observation callback件数、then非実行、削除件数と後観測。
 * @oracle trueだけ削除、一回確認、他値は削除0。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 構成検査→削除直前確認。
 */
test("DI削除直前確認は同期trueだけを受理する", (t) => {
  for (const mode of ["true", "false", "throw", "thenable"]) {
    const f = fixture(t, "identified");
    let checks = 0,
      thenCalls = 0;
    const options = {
      allowAlreadyAbsent: false,
      assertBeforeRemoval: () => {
        checks += 1;
        if (mode === "throw") throw new Error("synthetic owner failure");
        if (mode === "thenable")
          return {
            // biome-ignore lint/suspicious/noThenProperty: hostile thenableのthenを実行しない反証入力。
            then: () => {
              thenCalls += 1;
            },
          } as unknown as boolean;
        return mode === "true";
      },
    };
    const confirmed = f.executor.recoverObserved(
      {
        purpose: "create_internal_network",
        kind: "network",
        dockerId: id,
        expectedName: name,
        ownershipLabel: label,
        expectedImage: null,
        shouldBeInternal: true,
        expectedNetworks: [],
        workspaceMounted: false,
        workspaceReadOnly: false,
        initRequired: false,
      },
      options,
    );
    assert.equal(confirmed, mode === "true", mode);
    assert.equal(checks, 1, mode);
    assert.equal(thenCalls, 0, mode);
    assert.equal(
      f.argvLog.filter((argv) => argv[1] === "rm").length,
      mode === "true" ? 1 : 0,
      mode,
    );
    f.dispose();
  }
});

/**
 * inspect応答後に失効した元Ownerから削除を発行しない。
 * @responsibility 回収関数の入口確認だけで処置許可を固定しない。
 * @trace ERB-IT-014
 * @precondition 一つのknown Networkと後続の未要求資源を用意する。
 * @stimulus 実DI inspectの応答中に元Ownerを失効させる。
 * @observation rm、後続要求、Writerと再入場時の追加Effect。
 * @oracle inspect後のrm0、後続要求0、Writer0、同参照停止。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: DI inspect→削除前Owner確認。
 */
test("inspect後Owner失効は削除と後続Writerを止める", (t) => {
  const f = fixture(t, "identified", true);
  f.mode = "inspect-owner-lost";
  const result = f.run();
  assert.equal(result.status, "blocked");
  assert.equal(result.recoveryId, "exact-recovery");
  assert.equal(
    f.argvLog.some((argv) => argv[1] === "rm"),
    false,
  );
  assert.equal(
    f.events.some((event) => event.startsWith("write:")),
    false,
  );
  assert.equal(f.argvLog.at(-1)?.[1], "inspect");
  const before = [...f.events];
  assert.equal(f.run().status, "blocked");
  assert.deepEqual(f.events, before);
});

/**
 * 保存済みabsenceも実Executorで現在のID・名前不存在を確認する。
 * @responsibility 過去absenceを再観測なしの清掃成功へ流用しない。
 * @trace ERB-IT-014
 * @precondition identified・exact ID・既absenceが保存済みの模擬現在状態。
 * @stimulus 現在のIDと予定名がともに空の成功照会を返す。
 * @observation inspect／rm件数、二軸ls、absenceと現在元版の相関。
 * @oracle inspect0・rm0、ID／absence事実を保持し今回元版へ再相関。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 保存済みabsence→DI現在観測。
 */
test("identified既absenceは現在ID・名前の二軸不存在で再確認する", (t) => {
  const f = fixture(t, "identified", false, true);
  const original = f.operation.resources.find(
    (resource) => resource.purpose === "create_internal_network",
  );
  assert.ok(original?.absence);
  const result = f.run();
  assert.equal(result.status, "completed", result.reason);
  assert.equal(f.argvLog.length, 2);
  assert.ok(f.argvLog.every((argv) => argv[1] === "ls"));
  assert.ok(f.argvLog[0]?.includes(`id=${id}`));
  assert.ok(f.argvLog[1]?.includes(`name=^${name}$`));
  assert.equal(
    f.argvLog.some((argv) => argv[1] === "inspect" || argv[1] === "rm"),
    false,
  );
  const resource = f.operation.resources.find(
    (value) => value.purpose === "create_internal_network",
  );
  assert.equal(resource?.request, "identified");
  assert.equal(resource?.dockerId, id);
  assert.equal(resource?.observation, "absent");
  const write = f.cleanupWrites[0];
  assert.ok(write);
  const observation = write.observations.find(
    (value) => value.purpose === "create_internal_network",
  );
  assert.ok(observation);
  assert.equal(
    resource?.absence?.evidenceSha256,
    createHash("sha256")
      .update(
        JSON.stringify({
          recoveryId: "exact-recovery",
          previousPayloadSha256: write.previousHash,
          observation,
        }),
      )
      .digest("hex"),
  );
  assert.equal(
    write.previousHash,
    createHash("sha256").update(`${f.initial}\n`).digest("hex"),
  );
});

/**
 * 部分回収成功と未解決資源を同じcleanupへ保存し再入場する。
 * @responsibility 後続unknownで既確認ID・absenceを消さず二度削除しない。
 * @trace ERB-IT-014
 * @precondition Internalはidentified、Egressは作成結果unknown。
 * @stimulus Internal回収後にEgress未発見を返し、同じContextへ再入場する。
 * @observation cleanup共同値、二回目のID／名前観測、rmと元版Hash。
 * @oracle blockedでもabsent＋unknownを保持、二回目rm0・後者再観測、他状態不変。
 * @cleanup fixtureが空configとmockを回収する。
 * @boundary ERB-IT-014=Related 2 Blocks: 部分回収→同Owner再入場。
 */
test("部分回収後のunknownは既absenceを保持し再入場で二度削除しない", (t) => {
  const f = fixture(t, "identified", true);
  const preserved = JSON.stringify({
    host: f.operation.host,
    lease: f.operation.lease,
    outcome: f.operation.outcome,
    primaryFailure: f.operation.primaryFailure,
    other: f.untouched,
  });
  const first = f.run();
  assert.equal(first.status, "blocked");
  assert.equal(first.recoveryId, "exact-recovery");
  assert.equal(f.argvLog.filter((argv) => argv[1] === "rm").length, 1);
  const firstWrite = f.cleanupWrites[0];
  assert.ok(firstWrite);
  assert.deepEqual(
    firstWrite.observations
      .filter((value) =>
        ["create_internal_network", "create_egress_network"].includes(
          value.purpose,
        ),
      )
      .map((value) => ({
        purpose: value.purpose,
        observation: value.observation,
        dockerId: value.dockerId,
      })),
    [
      {
        purpose: "create_egress_network",
        observation: "unknown",
        dockerId: null,
      },
      {
        purpose: "create_internal_network",
        observation: "absent",
        dockerId: id,
      },
    ],
  );
  const firstEvidence = f.operation.resources.find(
    (value) => value.purpose === "create_internal_network",
  )?.absence?.evidenceSha256;
  assert.ok(firstEvidence);
  const afterFirst = `${JSON.stringify({ operations: [f.operation, f.untouched] })}\n`;
  const beforeCalls = f.argvLog.length;
  const second = f.run();
  assert.equal(second.status, "blocked");
  assert.equal(second.recoveryId, "exact-recovery");
  const calls = f.argvLog.slice(beforeCalls);
  assert.equal(
    calls.some((argv) => argv[1] === "rm" || argv[1] === "inspect"),
    false,
  );
  assert.ok(calls.some((argv) => argv.includes(`id=${id}`)));
  assert.ok(calls.some((argv) => argv.includes(`name=^${name}$`)));
  assert.ok(
    calls.some((argv) => argv.includes("name=^crdd-egress-0123456789abcdef$")),
  );
  const resource = f.operation.resources.find(
    (value) => value.purpose === "create_internal_network",
  );
  assert.equal(resource?.dockerId, id);
  assert.equal(resource?.observation, "absent");
  assert.equal(
    f.operation.resources.find(
      (value) => value.purpose === "create_egress_network",
    )?.observation,
    "unknown",
  );
  const secondWrite = f.cleanupWrites[1];
  assert.ok(secondWrite);
  assert.equal(
    secondWrite.previousHash,
    createHash("sha256").update(afterFirst).digest("hex"),
  );
  const observation = secondWrite.observations.find(
    (value) => value.purpose === "create_internal_network",
  );
  assert.equal(
    resource?.absence?.evidenceSha256,
    createHash("sha256")
      .update(
        JSON.stringify({
          recoveryId: "exact-recovery",
          previousPayloadSha256: secondWrite.previousHash,
          observation,
        }),
      )
      .digest("hex"),
  );
  assert.notEqual(resource?.absence?.evidenceSha256, firstEvidence);
  assert.equal(
    JSON.stringify({
      host: f.operation.host,
      lease: f.operation.lease,
      outcome: f.operation.outcome,
      primaryFailure: f.operation.primaryFailure,
      other: f.untouched,
    }),
    preserved,
  );
});

/**
 * 現在回収の配送借用を同じOwnerの同期処理へ限定する。
 * @responsibility 偽キー・未解放・Host再出現と保存不明の再発行を反証する。
 * @trace ERB-IT-014
 * @precondition 本番Wrapper本文と模擬配送Writerを使う。
 * @stimulus 正常、Host present、Lock不明、保存失敗、例外、未解放を渡す。
 * @observation 呼出し回数、借用終了、sticky拒否とEffect搬送。
 * @oracle 一回の同期借用だけを認め、不明後の同Owner再発行は0。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-IT-014=Direct Boundary: 私有回収Owner→配送Writer。
 */
test("現在回収配送: 同Owner・失敗停止・借用失効", () => {
  const begin = source.indexOf(
    "export function registerRuntimeOwnedDockerTaskRecoveryDelivery(",
  );
  const end = source.indexOf(
    "export function recoverRuntimeOwnedDockerTaskResources(",
    begin,
  );
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(
    source
      .slice(begin, end)
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  for (const scenario of [
    "normal",
    "host_present",
    "lock_unknown",
    "failed",
    "throw",
    "unreleased",
  ]) {
    const capability = Object.freeze({});
    const record = {
      kind: "recovery",
      closed: true,
      releaseAttempted: true,
      releaseConfirmed: scenario !== "unreleased",
      finalizationAttempted: true,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "absent",
      hostCleanupPublication: null,
      repository: { revalidate: () => true },
      recoveryId: "exact",
      hostToken: "token",
      hostRoot: "root",
    };
    const borrowed: Array<() => boolean> = [];
    let calls = 0;
    const register = runInNewContext(
      `${body}; registerRuntimeOwnedDockerTaskRecoveryDelivery`,
      {
        dockerRecoveryPreparations: new WeakMap([[capability, record]]),
        observeHostRecoveryCleanup: () => ({
          root: scenario === "host_present" ? "present" : "absent",
          marker: "absent",
        }),
        registerRuntimeOwnedCoordinatorRecoveryResultDelivery(
          repository: unknown,
          id: string,
          owner: () => boolean,
        ) {
          calls++;
          borrowed.push(owner);
          assert.equal(repository, record.repository);
          assert.equal(id, "exact");
          if (scenario === "throw") throw new Error("fixture");
          const confirmed = owner() && scenario === "normal";
          return {
            status: confirmed ? "completed" : "blocked",
            snapshotConfirmed: confirmed,
            lockReleased: scenario !== "lock_unknown",
            filesystemEffectIssued: scenario === "failed",
            deliveryPending: confirmed,
          };
        },
      },
    ) as (key: unknown) => { status: string; filesystemEffectIssued: boolean };
    assert.equal(register({}).status, "blocked");
    assert.equal(calls, 0);
    const result = register(capability);
    assert.equal(
      result.status,
      scenario === "normal" ? "completed" : "blocked",
      scenario,
    );
    assert.equal(
      result.filesystemEffectIssued,
      scenario === "failed",
      scenario,
    );
    for (const owner of borrowed) assert.equal(owner(), false);
    if (scenario !== "normal") {
      const prior = calls;
      assert.equal(register(capability).status, "blocked");
      assert.equal(calls, prior);
    }
    assert.equal(record.cleanupUnknown, scenario === "lock_unknown");
  }
});
