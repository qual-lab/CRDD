/**
 * coordinator:integration:task-cli-cancellationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-cli-cancellationが所有する検証責務を実行する。
 * @trace ERB-IT-003
 * @level IT
 * @scope task、cli、cancellation
 * @boundary ERB-IT-003=Related 2 Blocks: Task Runtime→Controller→外部Runtime→Recovery
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type {
  CallExpression,
  FunctionDeclaration,
  Identifier,
  Node,
  SourceFile,
  TryStatement,
  VariableDeclaration,
} from "typescript/unstable/ast";
import {
  isAwaitExpression,
  isBlock,
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
  isIfStatement,
  isImportDeclaration,
  isNamedImports,
  isPropertyAccessExpression,
  isReturnStatement,
  isStringLiteral,
  isTryStatement,
  isVariableDeclaration,
} from "typescript/unstable/ast/is";
import type { Project } from "typescript/unstable/sync";
import { API } from "typescript/unstable/sync";

import {
  bindTaskCliCancellationSignalsForTesting,
  createTaskCliCancellationLatch,
  projectTaskCliCancellationFailure,
} from "../../src/cli/cancellation.ts";

/**
 * CLI取消latchは重複signalを同じPromiseと一つのobserverへ収束するを検証する。
 *
 * @responsibility CLI取消latchは重複signalを同じPromiseと一つのobserverへ収束するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI取消latchは重複signalを同じPromiseと一つのobserverへ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI取消latchは重複signalを同じPromiseと一つのobserverへ収束する", async () => {
  let cancelEffects = 0;
  const receipt = Object.freeze({ status: "requested" });
  const latch = createTaskCliCancellationLatch(() => {
    cancelEffects += 1;
    return Promise.resolve(receipt);
  });
  const first = latch.request();
  const duplicate = latch.request();
  assert.strictEqual(duplicate, first);
  assert.strictEqual(await first, receipt);
  assert.equal(cancelEffects, 1);
  assert.equal(latch.observerCount(), 1);
});

/**
 * CLI取消latchは同期throwと非同期rejectを未処理rejectionへ流さないを検証する。
 *
 * @responsibility CLI取消latchは同期throwと非同期rejectを未処理rejectionへ流さないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI取消latchは同期throwと非同期rejectを未処理rejectionへ流さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI取消latchは同期throwと非同期rejectを未処理rejectionへ流さない", async () => {
  for (const requestCancellation of [
    () => {
      throw new Error("fixed_sync_throw");
    },
    () => Promise.reject(new Error("fixed_async_reject")),
  ]) {
    const latch = createTaskCliCancellationLatch(requestCancellation);
    const observed = latch.request();
    assert.strictEqual(latch.request(), observed);
    await assert.rejects(observed);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(latch.observerCount(), 1);
  }
});

/**
 * CLI取消latchはnever receiptも重複Effectなしで保持するを検証する。
 *
 * @responsibility CLI取消latchはnever receiptも重複Effectなしで保持するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI取消latchはnever receiptも重複Effectなしで保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI取消latchはnever receiptも重複Effectなしで保持する", () => {
  let cancelEffects = 0;
  const never = new Promise<never>(() => undefined);
  const latch = createTaskCliCancellationLatch(() => {
    cancelEffects += 1;
    return never;
  });
  assert.strictEqual(latch.request(), never);
  assert.strictEqual(latch.request(), never);
  assert.equal(cancelEffects, 1);
  assert.equal(latch.observerCount(), 1);
});

/**
 * CLI signal bindingは同一listenerを両signalへ結合して冪等に解除するを検証する。
 *
 * @responsibility CLI signal bindingは同一listenerを両signalへ結合して冪等に解除するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI signal bindingは同一listenerを両signalへ結合して冪等に解除するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI signal bindingは同一listenerを両signalへ結合して冪等に解除する", () => {
  const emitter = new EventEmitter();
  const registrations: Array<readonly [string, () => void]> = [];
  const removals: Array<readonly [string, () => void]> = [];
  let cancellationEffects = 0;
  const binding = bindTaskCliCancellationSignalsForTesting(
    {
      on: (signal, listener) => {
        registrations.push([signal, listener]);
        emitter.on(signal, listener);
      },
      removeListener: (signal, listener) => {
        removals.push([signal, listener]);
        emitter.removeListener(signal, listener);
      },
    },
    () => {
      cancellationEffects += 1;
      return Promise.resolve();
    },
  );
  assert.equal(binding.status, "bound");
  assert.equal(registrations.length, 2);
  assert.strictEqual(registrations[0]?.[1], registrations[1]?.[1]);
  emitter.emit("SIGINT");
  emitter.emit("SIGTERM");
  assert.equal(cancellationEffects, 1);
  assert.equal(binding.cancellation.observerCount(), 1);
  assert.deepEqual(binding.unbind(), {
    status: "released",
    failedSignals: [],
  });
  assert.equal(removals.length, 2);
  assert.strictEqual(removals[0]?.[1], registrations[0]?.[1]);
  assert.strictEqual(removals[1]?.[1], registrations[0]?.[1]);
  assert.deepEqual(binding.unbind(), {
    status: "released",
    failedSignals: [],
  });
  assert.equal(removals.length, 2);
  emitter.emit("SIGINT");
  emitter.emit("SIGTERM");
  assert.equal(cancellationEffects, 1);
});

/**
 * CLI signal bindingは登録中signalも単一取消Effectへ収束するを検証する。
 *
 * @responsibility CLI signal bindingは登録中signalも単一取消Effectへ収束するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI signal bindingは登録中signalも単一取消Effectへ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI signal bindingは登録中signalも単一取消Effectへ収束する", () => {
  let cancellationEffects = 0;
  let firstListener: (() => void) | null = null;
  const binding = bindTaskCliCancellationSignalsForTesting(
    {
      on: (signal, listener) => {
        if (signal === "SIGINT") {
          firstListener = listener;
          listener();
        } else {
          assert.strictEqual(listener, firstListener);
          listener();
        }
      },
      removeListener: () => undefined,
    },
    () => {
      cancellationEffects += 1;
      return Promise.resolve();
    },
  );
  assert.equal(binding.status, "bound");
  assert.equal(cancellationEffects, 1);
  assert.equal(binding.cancellation.observerCount(), 1);
  assert.equal(binding.unbind().status, "released");
});

/**
 * CLI signal bindingは各登録失敗を取消と登録済みlistenerのrollbackへ閉じるを検証する。
 *
 * @responsibility CLI signal bindingは各登録失敗を取消と登録済みlistenerのrollbackへ閉じるの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI signal bindingは各登録失敗を取消と登録済みlistenerのrollbackへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI signal bindingは各登録失敗を取消と登録済みlistenerのrollbackへ閉じる", () => {
  for (const failAt of [1, 2]) {
    const removals: string[] = [];
    let registrations = 0;
    let cancellationEffects = 0;
    const binding = bindTaskCliCancellationSignalsForTesting(
      {
        on: () => {
          registrations += 1;
          if (registrations === failAt) throw new Error("fixed_bind_failure");
        },
        removeListener: (signal) => removals.push(signal),
      },
      () => {
        cancellationEffects += 1;
        return Promise.resolve();
      },
    );
    assert.equal(binding.status, "binding_failed");
    assert.equal(cancellationEffects, 1);
    assert.equal(binding.cancellation.observerCount(), 1);
    assert.deepEqual(removals, failAt === 1 ? [] : ["SIGINT"]);
    assert.equal(binding.unbind().status, "released");
  }
});

/**
 * CLI signal bindingはrollback・解除の片側失敗でも全signalを試行し非成功を保持するを検証する。
 *
 * @responsibility CLI signal bindingはrollback・解除の片側失敗でも全signalを試行し非成功を保持するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI signal bindingはrollback・解除の片側失敗でも全signalを試行し非成功を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI signal bindingはrollback・解除の片側失敗でも全signalを試行し非成功を保持する", () => {
  const rollbackAttempts: string[] = [];
  let registrations = 0;
  const failedBinding = bindTaskCliCancellationSignalsForTesting(
    {
      on: () => {
        registrations += 1;
        if (registrations === 2) throw new Error("fixed_second_bind_failure");
      },
      removeListener: (signal) => {
        rollbackAttempts.push(signal);
        throw new Error("fixed_rollback_failure");
      },
    },
    () => Promise.resolve(),
  );
  assert.equal(failedBinding.status, "binding_failed");
  assert.deepEqual(rollbackAttempts, ["SIGINT"]);
  assert.equal(failedBinding.unbind().status, "failed");
  assert.deepEqual(rollbackAttempts, ["SIGINT", "SIGINT"]);

  const releaseAttempts: string[] = [];
  const bound = bindTaskCliCancellationSignalsForTesting(
    {
      on: () => undefined,
      removeListener: (signal) => {
        releaseAttempts.push(signal);
        if (signal === "SIGINT") throw new Error("fixed_release_failure");
      },
    },
    () => Promise.resolve(),
  );
  assert.equal(bound.unbind().status, "failed");
  assert.deepEqual(releaseAttempts, ["SIGINT", "SIGTERM"]);
  assert.equal(bound.unbind().status, "failed");
  assert.deepEqual(releaseAttempts, ["SIGINT", "SIGTERM"]);
});

/**
 * CLI signal failure投影はRuntimeの全安全観測とRecovery Evidenceを単調保持するを検証する。
 *
 * @responsibility CLI signal failure投影はRuntimeの全安全観測とRecovery Evidenceを単調保持するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI signal failure投影はRuntimeの全安全観測とRecovery Evidenceを単調保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI signal failure投影はRuntimeの全安全観測とRecovery Evidenceを単調保持する", () => {
  const digestA = "a".repeat(64);
  const digestB = "b".repeat(64);
  const runtimeResult = Object.freeze({
    status: "blocked",
    reason: "coordinator_task_operation_cleanup_unconfirmed",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    candidateId: `candidate.${digestA}.${digestB}`,
    expiresAtMs: 2_000_000_000_000,
    hostRecoveryId: `host.root.${digestA}.${digestB}`,
    hostRecoveryIds: Object.freeze([
      `host.root.${digestA}.${digestB}`,
      `host.root.${digestB}.${digestA}`,
    ]),
    dockerRecoveryId: `docker-task.${digestA}.${digestB}.${digestA}`,
    dockerRecoveryIds: Object.freeze([
      `docker-task.${digestA}.${digestB}.${digestA}`,
      `docker-task.${digestB}.${digestA}.${digestB}`,
    ]),
    candidateRecoveryId: `candidate-recovery.${digestA}.${digestB}`,
    candidateRecoveryIds: Object.freeze([
      `candidate-recovery.${digestA}.${digestB}`,
    ]),
    candidateStoreRecoveryId: `candidate-store-recovery.${digestA}`,
    candidateStoreRecoveryIds: Object.freeze([
      `candidate-store-recovery.${digestA}`,
    ]),
    canonicalRepositoryChanged: false,
  });
  for (const reason of [
    "task_cli_cancellation_signal_binding_failed",
    "task_cli_cancellation_signal_release_failed",
  ] as const) {
    const projected = projectTaskCliCancellationFailure(runtimeResult, reason);
    assert.equal(projected.command, "task");
    assert.equal(projected.status, "blocked");
    assert.equal(projected.reason, reason);
    const projectedRecord = projected as Readonly<Record<string, unknown>>;
    const runtimeRecord = runtimeResult as Readonly<Record<string, unknown>>;
    for (const key of Object.keys(runtimeResult)) {
      if (key === "status" || key === "reason") continue;
      assert.strictEqual(projectedRecord[key], runtimeRecord[key]);
    }
    assert.equal(Object.isFrozen(projected), true);
    const json = JSON.parse(JSON.stringify(projected));
    assert.deepEqual(json, projected);
    assert.equal(json.manualRecoveryRequired, true);
    assert.equal(json.processRestartRequired, true);
    assert.deepEqual(json.hostRecoveryIds, runtimeResult.hostRecoveryIds);
    assert.deepEqual(json.dockerRecoveryIds, runtimeResult.dockerRecoveryIds);
  }
});

/**
 * CLI signal failure投影はcleanup確認済み対照へRecoveryを捏造しないを検証する。
 *
 * @responsibility CLI signal failure投影はcleanup確認済み対照へRecoveryを捏造しないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI signal failure投影はcleanup確認済み対照へRecoveryを捏造しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI signal failure投影はcleanup確認済み対照へRecoveryを捏造しない", () => {
  const projected = projectTaskCliCancellationFailure(
    Object.freeze({
      status: "completed",
      reason: "coordinator_task_completed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      hostRecoveryId: null,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([]),
      candidateRecoveryId: null,
      candidateStoreRecoveryId: null,
    }),
    "task_cli_cancellation_signal_release_failed",
  );
  assert.equal(projected.status, "blocked");
  assert.equal(projected.cleanupConfirmed, true);
  assert.equal(projected.manualRecoveryRequired, false);
  assert.equal(projected.processRestartRequired, false);
  assert.equal(projected.candidateId, null);
  assert.deepEqual(projected.dockerRecoveryIds, []);
  const json = JSON.parse(JSON.stringify(projected));
  assert.equal(json.hostRecoveryId, null);
  assert.equal(json.dockerRecoveryId, null);
  assert.equal(json.candidateRecoveryId, null);
  assert.equal(json.candidateStoreRecoveryId, null);
  assert.equal(json.manualRecoveryRequired, false);
});

/**
 * CLI相当のvoid取消はstrict独立Processで未処理rejectionを作らないを検証する。
 *
 * @responsibility CLI相当のvoid取消はstrict独立Processで未処理rejectionを作らないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI相当のvoid取消はstrict独立Processで未処理rejectionを作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI相当のvoid取消はstrict独立Processで未処理rejectionを作らない", () => {
  const fixture = path.join(
    import.meta.dirname,
    "..",
    "fixtures",
    "task-cli-cancellation-strict-probe.ts",
  );
  for (const scenario of ["sync_throw", "async_reject", "malformed", "never"]) {
    const child = spawnSync(
      process.execPath,
      ["--unhandled-rejections=strict", fixture, scenario],
      {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(child.error, undefined, scenario);
    assert.equal(child.status, 0, `${scenario}: ${child.stderr}`);
    assert.equal(child.signal, null, scenario);
    assert.equal(child.stderr, "", scenario);
    const lines = child.stdout.trimEnd().split("\n");
    assert.equal(lines.length, 1, scenario);
    assert.deepEqual(JSON.parse(lines[0] ?? "null"), {
      scenario,
      cancellationEffects: 1,
      observerCount: 1,
      sigintListeners: 0,
      sigtermListeners: 0,
      outputCount: 1,
    });
  }
});

/**
 * visitTreeのTest準備責務を実行する。
 *
 * @responsibility visitTreeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus visitTreeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
function visitTree(root: Node, visitor: (node: Node) => void) {
  /**
   * visitのTest準備責務を実行する。
   *
   * @responsibility visitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-003
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus visitを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
   */
  const visit = (node: Node) => {
    visitor(node);
    node.forEachChild(visit);
  };
  visit(root);
}

/**
 * namedImportIdentifierのTest準備責務を実行する。
 *
 * @responsibility namedImportIdentifierがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus namedImportIdentifierを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
function namedImportIdentifier(
  sourceFile: SourceFile,
  importedName: string,
  moduleName: string,
) {
  const matches: Identifier[] = [];
  for (const statement of sourceFile.statements) {
    if (
      !isImportDeclaration(statement) ||
      !isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName ||
      !statement.importClause?.namedBindings ||
      !isNamedImports(statement.importClause.namedBindings)
    )
      continue;
    for (const element of statement.importClause.namedBindings.elements) {
      const exportedName = element.propertyName?.text ?? element.name.text;
      if (exportedName === importedName) matches.push(element.name);
    }
  }
  return matches;
}

/**
 * callPropertyNameのTest準備責務を実行する。
 *
 * @responsibility callPropertyNameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus callPropertyNameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
function callPropertyName(call: CallExpression) {
  return isPropertyAccessExpression(call.expression) &&
    isIdentifier(call.expression.name)
    ? call.expression.name.text
    : null;
}

/**
 * inspectTaskCliCancellationWiringのTest準備責務を実行する。
 *
 * @responsibility inspectTaskCliCancellationWiringがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectTaskCliCancellationWiringを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
function inspectTaskCliCancellationWiring(
  project: Project,
  sourceFile: SourceFile,
) {
  const failures: string[] = [];
  const checker = project.checker;
  const helper = namedImportIdentifier(
    sourceFile,
    "bindTaskCliCancellationSignals",
    "./cancellation.ts",
  );
  const execution = namedImportIdentifier(sourceFile, "runTask", "../api.ts");
  if (helper.length !== 1 || execution.length !== 1)
    return ["operation_import_not_exact"];
  const helperImport = helper[0],
    executionImport = execution[0];
  assert.ok(helperImport && executionImport);
  const helperSymbol = checker.getResolvedSymbol(helperImport);
  const executionSymbol = checker.getResolvedSymbol(executionImport);
  const functions = sourceFile.statements.filter(
    (n): n is FunctionDeclaration =>
      isFunctionDeclaration(n) && n.name?.text === "runSingleTaskCommand",
  );
  const body = functions[0]?.body;
  if (functions.length !== 1 || !body) return ["task_function_not_exact"];
  const calls: CallExpression[] = [],
    identifiers: Identifier[] = [],
    declarations: VariableDeclaration[] = [],
    tries: TryStatement[] = [];
  visitTree(body, (n) => {
    if (isCallExpression(n)) calls.push(n);
    if (isIdentifier(n)) identifiers.push(n);
    if (isVariableDeclaration(n)) declarations.push(n);
    if (isTryStatement(n)) tries.push(n);
  });
  const helperCalls = calls.filter(
    (c) =>
      isIdentifier(c.expression) &&
      checker.getResolvedSymbol(c.expression)?.id === helperSymbol?.id,
  );
  const executions = calls.filter(
    (c) =>
      isIdentifier(c.expression) &&
      checker.getResolvedSymbol(c.expression)?.id === executionSymbol?.id,
  );
  if (helperCalls.length !== 1) failures.push("helper_call_not_exact");
  if (executions.length !== 1) failures.push("execution_call_not_exact");
  const binding = declarations.filter(
    (d) => isIdentifier(d.name) && d.name.text === "cancellation",
  );
  const controllers = declarations.filter(
    (d) => isIdentifier(d.name) && d.name.text === "controller",
  );
  const bindingSymbol =
    binding[0] && isIdentifier(binding[0].name)
      ? checker.getResolvedSymbol(binding[0].name)
      : undefined;
  const controllerSymbol =
    controllers[0] && isIdentifier(controllers[0].name)
      ? checker.getResolvedSymbol(controllers[0].name)
      : undefined;
  if (binding.length !== 1 || !bindingSymbol)
    failures.push("binding_not_exact");
  if (controllers.length !== 1 || !controllerSymbol)
    failures.push("controller_not_exact");
  for (const identifier of identifiers) {
    const expected =
      identifier.text === "cancellation"
        ? bindingSymbol
        : identifier.text === "controller"
          ? controllerSymbol
          : undefined;
    if (expected && checker.getResolvedSymbol(identifier)?.id !== expected.id)
      failures.push("binding_shadowed_or_unresolved");
  }
  /**
   * 呼出し受信側のSymbolを取得し、同名変数の別物を区別する。
   * @responsibility AST上の受信側を型検査済みSymbolへ対応付ける。
   * @trace ERB-IT-003
   * @precondition 固定Sourceの型検査Contextが構築済みである。
   * @stimulus Property呼出しの受信側を照会する。
   * @observation 解決したSymbol又はundefinedを返す。
   * @oracle 同名でも別宣言なら同一Symbolとして扱わない。
   * @cleanup N/A: メモリ内の読取りだけを行う。
   * @boundary ERB-IT-003=Direct Boundary: CLI ASTとSymbol解決。
   */
  const receiver = (c: CallExpression) =>
    isPropertyAccessExpression(c.expression) &&
    isIdentifier(c.expression.expression)
      ? checker.getResolvedSymbol(c.expression.expression)
      : undefined;
  const unbind = calls.filter(
    (c) =>
      callPropertyName(c) === "unbind" && receiver(c)?.id === bindingSymbol?.id,
  );
  const abort = calls.filter(
    (c) =>
      callPropertyName(c) === "abort" &&
      receiver(c)?.id === controllerSymbol?.id,
  );
  if (unbind.length !== 1) failures.push("unbind_not_exact");
  if (
    abort.length !== 1 ||
    !helperCalls[0] ||
    !abort[0] ||
    abort[0].pos < helperCalls[0].pos ||
    abort[0].end > helperCalls[0].end
  )
    failures.push("abort_not_in_binding");
  const executionCall = executions[0],
    signal = executionCall?.arguments[2];
  if (!executionCall || !isAwaitExpression(executionCall.parent))
    failures.push("execution_not_awaited");
  if (
    !signal ||
    !isPropertyAccessExpression(signal) ||
    signal.name.text !== "signal" ||
    !isIdentifier(signal.expression) ||
    checker.getResolvedSymbol(signal.expression)?.id !== controllerSymbol?.id
  )
    failures.push("execution_signal_mismatch");
  const lifecycle = tries.filter(
    (t) =>
      t.finallyBlock &&
      unbind[0] &&
      unbind[0].pos >= t.finallyBlock.pos &&
      unbind[0].end <= t.finallyBlock.end,
  );
  const lifecycleTry = lifecycle[0];
  if (
    lifecycle.length !== 1 ||
    !lifecycleTry ||
    !executionCall ||
    executionCall.pos < lifecycleTry.tryBlock.pos ||
    executionCall.end > lifecycleTry.tryBlock.end
  )
    failures.push("execution_unbind_finally_mismatch");
  const outputs = calls.filter(
    (c) =>
      callPropertyName(c) === "write" &&
      isPropertyAccessExpression(c.expression) &&
      isPropertyAccessExpression(c.expression.expression) &&
      c.expression.expression.name.text === "stdout",
  );
  const guard = body.statements[0],
    guardBlock =
      guard && isIfStatement(guard) && isBlock(guard.thenStatement)
        ? guard.thenStatement
        : null;
  const guardReturn = guardBlock?.statements.at(-1);
  if (!guardBlock || !guardReturn || !isReturnStatement(guardReturn))
    failures.push("argument_rejection_not_guarded");
  if (
    outputs
      .filter(
        (c) => !guardBlock || c.pos < guardBlock.pos || c.end > guardBlock.end,
      )
      .some((c) => !lifecycle[0] || c.pos < lifecycle[0].end)
  )
    failures.push("report_before_join");
  if (
    calls.some(
      (c) =>
        isPropertyAccessExpression(c.expression) &&
        isIdentifier(c.expression.expression) &&
        c.expression.expression.text === "process" &&
        ["on", "removeListener"].includes(c.expression.name.text),
    )
  )
    failures.push("direct_signal_call_present");
  return Object.freeze(failures);
}

/**
 * projectSourceFileのTest準備責務を実行する。
 *
 * @responsibility projectSourceFileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus projectSourceFileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
function projectSourceFile(project: Project, fileName: string) {
  const normalized = path.resolve(fileName).replaceAll("\\", "/");
  const sourceFile = project.program.getSourceFile(normalized);
  assert.ok(sourceFile, normalized);
  return sourceFile;
}

/**
 * 公開CLIはproduction helperの単一bindingとfinally解除をAST・symbolで固定するを検証する。
 *
 * @responsibility 公開CLIはproduction helperの単一bindingとfinally解除をAST・symbolで固定するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開CLIはproduction helperの単一bindingとfinally解除をAST・symbolで固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開CLIはproduction helperの単一bindingとfinally解除をAST・symbolで固定する", () => {
  const coordinatorRoot = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "coordinator",
  );
  const api = new API({ cwd: coordinatorRoot });
  try {
    const configFile = path.join(coordinatorRoot, "tsconfig.strict.json");
    const snapshot = api.updateSnapshot({ openProjects: [configFile] });
    try {
      const project =
        snapshot.getProject(configFile) ?? snapshot.getProjects()[0];
      assert.ok(project);
      const sourceFile = projectSourceFile(
        project,
        path.join(coordinatorRoot, "src", "cli", "request.ts"),
      );
      assert.deepEqual(
        inspectTaskCliCancellationWiring(project, sourceFile),
        [],
      );
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});

/**
 * CLI AST契約はshadow・二重binding・直接signal・非await join・finally外終了・signal差替え・解放順序違反を拒否するを検証する。
 *
 * @responsibility CLI AST契約はshadow・二重binding・直接signal・非await join・finally外終了・signal差替え・解放順序違反を拒否するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI AST契約はshadow・二重binding・直接signal・非await join・finally外終了・signal差替え・解放順序違反を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI AST契約はshadow・二重binding・直接signal・非await join・finally外終了・signal差替え・解放順序違反を拒否する", () => {
  const coordinatorRoot = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "coordinator",
  );
  const original = fs.readFileSync(
    path.join(coordinatorRoot, "src", "cli", "request.ts"),
    "utf8",
  );
  const mutations = [
    original.replace(
      "    if (!released) {",
      "    { const cancellation = null; }\n    if (!released) {",
    ),
    original.replace(
      "    cancellation = bindTaskCliCancellationSignals(async () =>",
      "    bindTaskCliCancellationSignals(async()=>controller.abort());\n    cancellation = bindTaskCliCancellationSignals(async () =>",
    ),
    original.replace(
      "    cancellation = bindTaskCliCancellationSignals(async () =>",
      "    process.on('SIGINT',()=>undefined);\n    cancellation = bindTaskCliCancellationSignals(async () =>",
    ),
    original.replace("...(await runTask(", "...(runTask("),
    original.replace(
      "        controller.signal,",
      "        new AbortController().signal,",
    ),
    original.replace("cancellation.unbind()", "cancellation.observe()"),
    original.replace(
      "...(await runTask(",
      '...(await (async()=>{process.stdout.write("early");return runTask;})()(',
    ),
    original.replace(
      "    return;\n  }\n  let cancellation",
      "  }\n  let cancellation",
    ),
  ];
  for (const mutation of mutations) assert.notEqual(mutation, original);
  const virtualFiles: Record<string, string> = {};
  const fileNames = [original, ...mutations].map((source, index) => {
    const fileName = path
      .join(coordinatorRoot, "src/cli", `.crdd-cli-mutation-${index}.ts`)
      .replaceAll("\\", "/");
    virtualFiles[fileName] = source;
    return fileName;
  });
  const configFile = path
    .join(coordinatorRoot, ".crdd-cli-mutation.json")
    .replaceAll("\\", "/");
  virtualFiles[configFile] = JSON.stringify({
    extends: "./tsconfig.strict.json",
    files: fileNames,
    include: [],
  });
  const api = new API({
    cwd: coordinatorRoot,
    fs: {
      readFile: (name) => virtualFiles[name],
      fileExists: (name) => (name in virtualFiles ? true : undefined),
      realpath: (name) => (name in virtualFiles ? name : undefined),
    },
  });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [configFile] });
    try {
      const project =
        snapshot.getProject(configFile) ?? snapshot.getProjects()[0];
      assert.ok(project);
      const expectedFailures = [
        null,
        "binding_shadowed_or_unresolved",
        "helper_call_not_exact",
        "direct_signal_call_present",
        "execution_not_awaited",
        "execution_signal_mismatch",
        "unbind_not_exact",
        "execution_call_not_exact",
        "argument_rejection_not_guarded",
      ];
      for (const [index, fileName] of fileNames.entries()) {
        assert.equal(
          project.program.getSyntacticDiagnostics(fileName).length,
          0,
        );
        const failures = inspectTaskCliCancellationWiring(
          project,
          projectSourceFile(project, fileName),
        );
        const expected = expectedFailures[index];
        if (expected === null) assert.deepEqual(failures, [], "baseline");
        else {
          assert.ok(expected);
          assert.ok(
            failures.includes(expected),
            `${index}: ${failures.join(",")}`,
          );
          assert.equal(
            failures.some(
              (failure) =>
                failure.includes("import_") ||
                failure.endsWith("symbol_missing"),
            ),
            false,
          );
        }
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});
