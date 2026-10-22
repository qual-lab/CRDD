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
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isPropertyAccessExpression,
  isStringLiteral,
  isTryStatement,
  isVariableDeclaration,
} from "typescript/unstable/ast/is";
import type { Project } from "typescript/unstable/sync";
import { API } from "typescript/unstable/sync";

import { renderSafeHumanCommandReport } from "../../../orchestrator/src/cli/command-report.ts";
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
    const human = renderSafeHumanCommandReport(projected);
    assert.match(human, /候補ID/u);
    assert.doesNotMatch(human, /coordinator candidate export/u);
    assert.match(human, /Host回復ID/u);
    assert.equal(human.match(/Docker回復ID:/gu)?.length, 2);
    assert.match(human, /候補回復ID/u);
    assert.match(human, /候補保存領域の回復ID/u);
    assert.match(human, /Coordinator Runtimeを再起動/u);
    assert.match(human, /手動回復の必要性: あり/u);
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
  const human = renderSafeHumanCommandReport(projected);
  assert.doesNotMatch(human, /回復ID|実行担当者へ引き渡して/u);
  assert.match(human, /手動回復の必要性: なし/u);
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
  const helperImports = namedImportIdentifier(
    sourceFile,
    "bindTaskCliCancellationSignals",
    "../../../coordinator/src/cli/cancellation.ts",
  );
  const ownerImports = namedImportIdentifier(
    sourceFile,
    "createRepositoryTaskRequests",
    "../task/request-composition.ts",
  );
  if (helperImports.length !== 1) failures.push("helper_import_not_exact");
  if (ownerImports.length !== 1) failures.push("owner_import_not_exact");
  const helperSymbol = helperImports[0]
    ? checker.getResolvedSymbol(helperImports[0])
    : undefined;
  const ownerFactorySymbol = ownerImports[0]
    ? checker.getResolvedSymbol(ownerImports[0])
    : undefined;
  if (!helperSymbol) failures.push("helper_import_symbol_missing");
  if (!ownerFactorySymbol) failures.push("owner_import_symbol_missing");

  const taskFunctions = sourceFile.statements.filter(
    (statement): statement is FunctionDeclaration =>
      isFunctionDeclaration(statement) &&
      statement.name?.text === "runSingleTaskCommand",
  );
  const taskFunction = taskFunctions[0];
  const taskBody = taskFunction?.body;
  if (taskFunctions.length !== 1 || !taskFunction || !taskBody)
    return Object.freeze([...failures, "task_function_not_exact"]);
  const calls: CallExpression[] = [];
  const declarations: VariableDeclaration[] = [];
  const identifiers: Identifier[] = [];
  const tryStatements: TryStatement[] = [];
  visitTree(taskBody, (node) => {
    if (isCallExpression(node)) calls.push(node);
    if (isVariableDeclaration(node)) declarations.push(node);
    if (isIdentifier(node)) identifiers.push(node);
    if (isTryStatement(node)) tryStatements.push(node);
  });
  const helperCalls = calls.filter(
    (call) =>
      isIdentifier(call.expression) &&
      checker.getResolvedSymbol(call.expression)?.id === helperSymbol?.id,
  );
  if (helperCalls.length !== 1) failures.push("helper_call_not_exact");
  const helperCall = helperCalls[0];
  const ownerFactoryCalls = calls.filter(
    (call) =>
      isIdentifier(call.expression) &&
      checker.getResolvedSymbol(call.expression)?.id === ownerFactorySymbol?.id,
  );
  if (ownerFactoryCalls.length !== 1)
    failures.push("owner_factory_call_not_exact");

  const bindingDeclarations = declarations.filter(
    (declaration) =>
      isIdentifier(declaration.name) &&
      declaration.name.text === "cancellation",
  );
  if (bindingDeclarations.length !== 1)
    failures.push("binding_declaration_not_exact");
  const bindingDeclaration = bindingDeclarations[0];
  const bindingSymbol =
    bindingDeclaration && isIdentifier(bindingDeclaration.name)
      ? checker.getResolvedSymbol(bindingDeclaration.name)
      : undefined;
  if (!bindingSymbol) failures.push("binding_symbol_missing");
  const ownerDeclarations = declarations.filter(
    (declaration) =>
      isIdentifier(declaration.name) && declaration.name.text === "owner",
  );
  const ownerDeclaration = ownerDeclarations[0];
  const ownerSymbol =
    ownerDeclarations.length === 1 &&
    ownerDeclaration &&
    isIdentifier(ownerDeclaration.name)
      ? checker.getResolvedSymbol(ownerDeclaration.name)
      : undefined;
  if (!ownerSymbol) failures.push("owner_binding_not_exact");
  const controllerDeclarations = declarations.filter(
    (declaration) =>
      isIdentifier(declaration.name) && declaration.name.text === "controller",
  );
  const controllerDeclaration = controllerDeclarations[0];
  const controllerSymbol =
    controllerDeclarations.length === 1 &&
    controllerDeclaration &&
    isIdentifier(controllerDeclaration.name)
      ? checker.getResolvedSymbol(controllerDeclaration.name)
      : undefined;
  if (!controllerSymbol) failures.push("controller_binding_not_exact");
  for (const identifier of identifiers) {
    const expected =
      identifier.text === "cancellation"
        ? bindingSymbol
        : identifier.text === "owner"
          ? ownerSymbol
          : identifier.text === "controller"
            ? controllerSymbol
            : undefined;
    if (expected && checker.getResolvedSymbol(identifier)?.id !== expected.id)
      failures.push(`${identifier.text}_shadowed_or_unresolved`);
  }

  /**
   * Property呼出しの受信者を型検査器のSymbolへ解決する。
   * @responsibility Property呼出しの受信者を型検査器のSymbolへ解決する。
   * @trace ERB-IT-003
   * @precondition 解析済みCLI ASTとchecker。
   * @stimulus 識別子受信者だけのSymbolを取得する。
   * @observation 呼出し受信者のSymbolまたはnull。
   * @oracle 同名decoyを所有Ownerと同一視しない。
   * @cleanup N/A: AST読取りのみ。
   * @boundary 静的CLI解析。stdinやProcessの実操作なし。
   */
  const receiverSymbol = (call: CallExpression) => {
    if (!isPropertyAccessExpression(call.expression)) return undefined;
    const receiver = call.expression.expression;
    return isIdentifier(receiver)
      ? checker.getResolvedSymbol(receiver)
      : undefined;
  };
  /**
   * 同じOwnerの指定操作だけをAST呼出し集合から選ぶ。
   * @responsibility 同じOwnerの指定操作だけをAST呼出し集合から選ぶ。
   * @trace ERB-IT-003
   * @precondition Owner Symbolと抽出済み呼出し。
   * @stimulus 操作名と受信者Symbolの両方を照合する。
   * @observation start・wait・closeの対象呼出し数。
   * @oracle 別Ownerや同名関数を数えず各一回を検査する。
   * @cleanup N/A: 局所配列の選別だけ。
   * @boundary AST所有者相関。実Taskを開始しない。
   */
  const ownerCalls = (name: string) =>
    calls.filter(
      (call) =>
        callPropertyName(call) === name &&
        receiverSymbol(call)?.id === ownerSymbol?.id,
    );
  const startCalls = ownerCalls("start");
  const waitCalls = ownerCalls("wait");
  const closeCalls = ownerCalls("close");
  if (startCalls.length !== 1) failures.push("owner_start_call_not_exact");
  if (waitCalls.length !== 1) failures.push("owner_wait_call_not_exact");
  if (closeCalls.length !== 1) failures.push("owner_close_call_not_exact");
  const startCall = startCalls[0];
  const waitCall = waitCalls[0];
  const closeCall = closeCalls[0];
  /**
   * 対象呼出しの直上awaitとSource範囲を確認する。
   * @responsibility 対象呼出しの直上awaitとSource範囲を確認する。
   * @trace ERB-IT-003
   * @precondition 同一SourceのCallExpression。
   * @stimulus 親ノードとpos/endを比較する。
   * @observation awaitされた同じ呼出しかの真偽。
   * @oracle 終了待機を別呼出しやdecoyのawaitで代替しない。
   * @cleanup N/A: ASTノード参照のみ。
   * @boundary CLI取消・終了の静的接続で実取消完了は主張しない。
   */
  const isAwaitedCall = (call: CallExpression | undefined) =>
    Boolean(
      call &&
        isAwaitExpression(call.parent) &&
        call.parent.expression.pos === call.pos &&
        call.parent.expression.end === call.end,
    );
  if (!isAwaitedCall(startCall)) failures.push("owner_start_not_awaited");
  if (!isAwaitedCall(waitCall)) failures.push("owner_wait_not_awaited");
  if (!isAwaitedCall(closeCall)) failures.push("owner_close_not_awaited");

  const abortCalls = calls.filter(
    (call) =>
      callPropertyName(call) === "abort" &&
      receiverSymbol(call)?.id === controllerSymbol?.id,
  );
  if (abortCalls.length !== 1) failures.push("controller_abort_call_not_exact");
  if (
    !helperCall ||
    !abortCalls[0] ||
    abortCalls[0].pos < helperCall.pos ||
    abortCalls[0].end > helperCall.end
  )
    failures.push("abort_call_outside_binding_callback");
  const startSignal = startCall?.arguments[1];
  if (
    !startSignal ||
    !isPropertyAccessExpression(startSignal) ||
    startSignal.name.text !== "signal" ||
    !isIdentifier(startSignal.expression) ||
    checker.getResolvedSymbol(startSignal.expression)?.id !==
      controllerSymbol?.id
  )
    failures.push("owner_start_signal_mismatch");

  const unbindCalls = calls.filter(
    (call) =>
      callPropertyName(call) === "unbind" &&
      receiverSymbol(call)?.id === bindingSymbol?.id,
  );
  if (unbindCalls.length !== 1) failures.push("unbind_call_not_exact");
  const unbindCall = unbindCalls[0];
  const containingFinallyItems = tryStatements.filter(
    (statement) =>
      statement.finallyBlock &&
      closeCall &&
      unbindCall &&
      closeCall.pos >= statement.finallyBlock.pos &&
      closeCall.end <= statement.finallyBlock.end &&
      unbindCall.pos >= statement.finallyBlock.pos &&
      unbindCall.end <= statement.finallyBlock.end,
  );
  if (containingFinallyItems.length !== 1)
    failures.push("owner_close_and_unbind_not_in_same_finally");
  const lifecycleTry = containingFinallyItems[0];
  if (
    !lifecycleTry ||
    !startCall ||
    !waitCall ||
    startCall.pos < lifecycleTry.tryBlock.pos ||
    startCall.end > lifecycleTry.tryBlock.end ||
    waitCall.pos < lifecycleTry.tryBlock.pos ||
    waitCall.end > lifecycleTry.tryBlock.end
  )
    failures.push("start_wait_not_guarded_by_finally");
  if (
    !helperCall ||
    !startCall ||
    !waitCall ||
    !closeCall ||
    !unbindCall ||
    !(
      helperCall.pos < startCall.pos &&
      startCall.pos < waitCall.pos &&
      waitCall.pos < closeCall.pos &&
      closeCall.pos < unbindCall.pos
    )
  )
    failures.push("lifecycle_order_invalid");

  const directSignalCalls = calls.filter(
    (call) =>
      isPropertyAccessExpression(call.expression) &&
      isIdentifier(call.expression.expression) &&
      call.expression.expression.text === "process" &&
      ["on", "removeListener"].includes(call.expression.name.text),
  );
  if (directSignalCalls.length !== 0)
    failures.push("direct_signal_call_present");
  const outputCalls = calls.filter(
    (call) =>
      callPropertyName(call) === "write" &&
      isPropertyAccessExpression(call.expression) &&
      isPropertyAccessExpression(call.expression.expression) &&
      call.expression.expression.name.text === "stdout",
  );
  const outputCall = outputCalls[0];
  if (
    outputCalls.length !== 1 ||
    !outputCall ||
    !lifecycleTry ||
    outputCall.pos < lifecycleTry.end
  )
    failures.push("report_not_after_lifecycle_finally");
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
  const orchestratorRoot = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "orchestrator",
  );
  const api = new API({ cwd: orchestratorRoot });
  try {
    const configFile = path.join(orchestratorRoot, "tsconfig.json");
    const snapshot = api.updateSnapshot({ openProjects: [configFile] });
    try {
      const project =
        snapshot.getProject(configFile) ?? snapshot.getProjects()[0];
      assert.ok(project);
      const sourceFile = projectSourceFile(
        project,
        path.join(orchestratorRoot, "src", "cli", "command.ts"),
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
  const orchestratorRoot = path.resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "orchestrator",
  );
  const original = fs.readFileSync(
    path.join(orchestratorRoot, "src", "cli", "command.ts"),
    "utf8",
  );
  const mutations = [
    original.replace(
      'if (cancellation && cancellation.unbind().status !== "released") {',
      '{ const cancellation = null; }\n    if (cancellation && cancellation.unbind().status !== "released") {',
    ),
    original.replace(
      "    cancellation = bindTaskCliCancellationSignals(async () =>",
      "    bindTaskCliCancellationSignals(async () => controller.abort());\n    cancellation = bindTaskCliCancellationSignals(async () =>",
    ),
    original.replace(
      "    cancellation = bindTaskCliCancellationSignals(async () =>",
      "    process.on('SIGINT', () => undefined);\n    cancellation = bindTaskCliCancellationSignals(async () =>",
    ),
    original
      .replace(
        "    try {\n      await owner?.close();",
        "    try {\n      await Promise.resolve();",
      )
      .replace(
        "  process.exitCode =",
        "  await owner?.close();\n  process.exitCode =",
      ),
    original.replace(
      "    const started = await owner.start(command, controller.signal);",
      "    const started = await owner.start(command, new AbortController().signal);",
    ),
    original.replace(
      "    const started = await owner.start(command, controller.signal);",
      "    const started = owner.start(command, controller.signal);",
    ),
    original.replace(
      '      report = { command: "task", ...(await owner.wait(started.requestId)) };',
      '      report = { command: "task", ...owner.wait(started.requestId) };',
    ),
    original.replace("      await owner?.close();", "      owner?.close();"),
    original
      .replace(
        "      await owner?.close();",
        "      cancellation?.unbind();\n      await owner?.close();",
      )
      .replace(
        '    if (cancellation && cancellation.unbind().status !== "released") {',
        "    if (false) {",
      ),
  ];
  for (const mutation of mutations) assert.notEqual(mutation, original);
  const virtualFiles: Record<string, string> = {};
  const fileNames = [original, ...mutations].map((source, index) => {
    const fileName = path
      .join(orchestratorRoot, "src/cli", `.crdd-cli-mutation-${index}.ts`)
      .replaceAll("\\", "/");
    virtualFiles[fileName] = source;
    return fileName;
  });
  const configFile = path
    .join(orchestratorRoot, ".crdd-cli-mutation.json")
    .replaceAll("\\", "/");
  virtualFiles[configFile] = JSON.stringify({
    extends: "./tsconfig.json",
    files: fileNames,
    include: [],
  });
  const api = new API({
    cwd: orchestratorRoot,
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
        "cancellation_shadowed_or_unresolved",
        "helper_call_not_exact",
        "direct_signal_call_present",
        "owner_close_and_unbind_not_in_same_finally",
        "owner_start_signal_mismatch",
        "owner_start_not_awaited",
        "owner_wait_not_awaited",
        "owner_close_not_awaited",
        "lifecycle_order_invalid",
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
