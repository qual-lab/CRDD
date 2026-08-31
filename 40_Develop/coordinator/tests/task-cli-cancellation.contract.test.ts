import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { API } from "typescript/unstable/sync";
import {
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
import type {
  CallExpression,
  FunctionDeclaration,
  Identifier,
  Node,
  SourceFile,
  TryStatement,
  VariableDeclaration,
} from "typescript/unstable/ast";
import type { Project } from "typescript/unstable/sync";

import { renderSafeHumanCommandReport } from "../src/core/command-report.ts";
import {
  bindTaskCliCancellationSignalsForTesting,
  createTaskCliCancellationLatch,
  projectTaskCliCancellationFailure,
} from "../src/core/task-cli-cancellation.ts";

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

test("CLI相当のvoid取消はstrict独立Processで未処理rejectionを作らない", () => {
  const fixture = path.join(
    import.meta.dirname,
    "fixtures",
    "task-cli-cancellation-strict-probe.ts",
  );
  for (const scenario of ["sync_throw", "async_reject", "malformed", "never"]) {
    const child = spawnSync(
      process.execPath,
      ["--unhandled-rejections=strict", fixture, scenario],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
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

function visitTree(root: Node, visitor: (node: Node) => void) {
  const visit = (node: Node) => {
    visitor(node);
    node.forEachChild(visit);
  };
  visit(root);
}

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

function callPropertyName(call: CallExpression) {
  return isPropertyAccessExpression(call.expression) &&
    isIdentifier(call.expression.name)
    ? call.expression.name.text
    : null;
}

function inspectTaskCliCancellationWiring(
  project: Project,
  sourceFile: SourceFile,
) {
  const failures: string[] = [];
  const checker = project.checker;
  const helperImports = namedImportIdentifier(
    sourceFile,
    "bindTaskCliCancellationSignals",
    "../src/core/task-cli-cancellation.ts",
  );
  const cancelImports = namedImportIdentifier(
    sourceFile,
    "cancelRuntimeOwnedCoordinatorTask",
    "../src/security/coordinator-task-runtime.ts",
  );
  const projectorImports = namedImportIdentifier(
    sourceFile,
    "projectTaskCliCancellationFailure",
    "../src/core/task-cli-cancellation.ts",
  );
  if (helperImports.length !== 1) failures.push("helper_import_not_exact");
  if (cancelImports.length !== 1) failures.push("cancel_import_not_exact");
  if (projectorImports.length !== 1)
    failures.push("projector_import_not_exact");
  const helperSymbol = helperImports[0]
    ? checker.getResolvedSymbol(helperImports[0])
    : undefined;
  const cancelSymbol = cancelImports[0]
    ? checker.getResolvedSymbol(cancelImports[0])
    : undefined;
  const projectorSymbol = projectorImports[0]
    ? checker.getResolvedSymbol(projectorImports[0])
    : undefined;
  if (!helperSymbol) failures.push("helper_import_symbol_missing");
  if (!cancelSymbol) failures.push("cancel_import_symbol_missing");
  if (!projectorSymbol) failures.push("projector_import_symbol_missing");

  const taskFunctions = sourceFile.statements.filter(
    (statement): statement is FunctionDeclaration =>
      isFunctionDeclaration(statement) &&
      statement.name?.text === "runTaskCommand",
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
  const bindingDeclarations = declarations.filter(
    (declaration) =>
      isIdentifier(declaration.name) &&
      declaration.name.text === "cancellationBinding",
  );
  if (bindingDeclarations.length !== 1)
    failures.push("binding_declaration_not_exact");
  const bindingDeclaration = bindingDeclarations[0];
  if (
    !bindingDeclaration ||
    !helperCall ||
    bindingDeclaration.initializer?.pos !== helperCall.pos ||
    bindingDeclaration.initializer.end !== helperCall.end
  )
    failures.push("helper_call_not_binding_initializer");
  const bindingSymbol =
    bindingDeclaration && isIdentifier(bindingDeclaration.name)
      ? checker.getResolvedSymbol(bindingDeclaration.name)
      : undefined;
  if (!bindingSymbol) failures.push("binding_symbol_missing");
  for (const identifier of identifiers)
    if (
      identifier.text === "cancellationBinding" &&
      checker.getResolvedSymbol(identifier)?.id !== bindingSymbol?.id
    )
      failures.push("binding_shadowed_or_unresolved");

  const unbindCalls = calls.filter(
    (call) => callPropertyName(call) === "unbind",
  );
  if (unbindCalls.length !== 1) failures.push("unbind_call_not_exact");
  const unbindCall = unbindCalls[0];
  const unbindReceiver =
    unbindCall && isPropertyAccessExpression(unbindCall.expression)
      ? unbindCall.expression.expression
      : undefined;
  if (
    !unbindReceiver ||
    !isIdentifier(unbindReceiver) ||
    checker.getResolvedSymbol(unbindReceiver)?.id !== bindingSymbol?.id
  )
    failures.push("unbind_receiver_binding_mismatch");
  const containingFinallyItems = tryStatements.filter(
    (statement) =>
      statement.finallyBlock &&
      unbindCall &&
      unbindCall.pos >= statement.finallyBlock.pos &&
      unbindCall.end <= statement.finallyBlock.end,
  );
  if (containingFinallyItems.length !== 1)
    failures.push("unbind_not_in_finally");

  const directSignalCalls = calls.filter(
    (call) =>
      isPropertyAccessExpression(call.expression) &&
      isIdentifier(call.expression.expression) &&
      call.expression.expression.text === "process" &&
      ["on", "removeListener"].includes(call.expression.name.text),
  );
  if (directSignalCalls.length !== 0)
    failures.push("direct_signal_call_present");
  const oldLatchCalls = calls.filter(
    (call) =>
      isIdentifier(call.expression) &&
      call.expression.text === "createTaskCliCancellationLatch",
  );
  if (oldLatchCalls.length !== 0) failures.push("old_latch_call_present");
  const cancelCalls = calls.filter(
    (call) =>
      isIdentifier(call.expression) &&
      checker.getResolvedSymbol(call.expression)?.id === cancelSymbol?.id,
  );
  if (cancelCalls.length !== 1) failures.push("cancel_call_not_exact");
  if (
    helperCall &&
    cancelCalls[0] &&
    (cancelCalls[0].pos < helperCall.pos || cancelCalls[0].end > helperCall.end)
  )
    failures.push("cancel_call_outside_helper_callback");
  const projectorCalls = calls.filter(
    (call) =>
      isIdentifier(call.expression) &&
      checker.getResolvedSymbol(call.expression)?.id === projectorSymbol?.id,
  );
  if (projectorCalls.length !== 1) failures.push("projector_call_not_exact");
  const resultDeclarations = declarations.filter(
    (declaration) =>
      isIdentifier(declaration.name) && declaration.name.text === "result",
  );
  const resultSymbol =
    resultDeclarations.length === 1 &&
    resultDeclarations[0] &&
    isIdentifier(resultDeclarations[0].name)
      ? checker.getResolvedSymbol(resultDeclarations[0].name)
      : undefined;
  const projectorResultArgument = projectorCalls[0]?.arguments[0];
  if (
    !resultSymbol ||
    !projectorResultArgument ||
    !isIdentifier(projectorResultArgument) ||
    checker.getResolvedSymbol(projectorResultArgument)?.id !== resultSymbol.id
  )
    failures.push("projector_result_binding_mismatch");

  const bodyStatements = taskBody.statements;
  const bindingStatementIndex = bodyStatements.findIndex(
    (statement) =>
      bindingDeclaration &&
      bindingDeclaration.pos >= statement.pos &&
      bindingDeclaration.end <= statement.end,
  );
  const followingStatement = bodyStatements[bindingStatementIndex + 1];
  if (
    bindingStatementIndex < 0 ||
    !followingStatement ||
    !isTryStatement(followingStatement) ||
    followingStatement.finallyBlock !== containingFinallyItems[0]?.finallyBlock
  )
    failures.push("helper_not_immediately_guarded_by_finally");
  return Object.freeze(failures);
}

function projectSourceFile(project: Project, fileName: string) {
  const normalized = path.resolve(fileName).replaceAll("\\", "/");
  const sourceFile = project.program.getSourceFile(normalized);
  assert.ok(sourceFile, normalized);
  return sourceFile;
}

test("公開CLIはproduction helperの単一bindingとfinally解除をAST・symbolで固定する", () => {
  const coordinatorRoot = path.resolve(import.meta.dirname, "..");
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
        path.join(coordinatorRoot, "bin", "coordinator.ts"),
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

test("CLI AST契約はshadow・二重binding・直接signal・finally外解除・guard前returnを拒否する", () => {
  const original = fs.readFileSync(
    path.join(import.meta.dirname, "..", "bin", "coordinator.ts"),
    "utf8",
  );
  const mutations = [
    original.replace(
      "releaseStatus = cancellationBinding.unbind();",
      "{ const cancellationBinding = { unbind: () => ({ status: 'released' }) }; releaseStatus = cancellationBinding.unbind(); }",
    ),
    original.replace(
      "  try {\n    result = await started.completion;",
      "  bindTaskCliCancellationSignals(() => cancelRuntimeOwnedCoordinatorTask(started.controlCapability));\n  try {\n    result = await started.completion;",
    ),
    original.replace(
      "  try {\n    result = await started.completion;",
      "  process.on('SIGINT', () => undefined);\n  try {\n    result = await started.completion;",
    ),
    original.replace(
      "  } finally {\n    releaseStatus = cancellationBinding.unbind();\n  }",
      "  } finally {\n    // deliberately empty\n  }\n  releaseStatus = cancellationBinding.unbind();",
    ),
    original.replace(
      "  try {\n    result = await started.completion;",
      "  if (false) return;\n  try {\n    result = await started.completion;",
    ),
    original.replace(
      "projectTaskCliCancellationFailure(\n      result,",
      "projectTaskCliCancellationFailure(\n      { status: 'blocked', reason: 'discarded_runtime_result' },",
    ),
  ];
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-task-cli-ast-"),
  );
  try {
    const fileNames = mutations.map((source, index) => {
      const fileName = path.join(temporaryRoot, `mutated-${index}.ts`);
      fs.writeFileSync(fileName, source, "utf8");
      return fileName;
    });
    const configFile = path.join(temporaryRoot, "tsconfig.json");
    fs.writeFileSync(
      configFile,
      `${JSON.stringify({ compilerOptions: { noEmit: true }, files: fileNames })}\n`,
      "utf8",
    );
    const api = new API({ cwd: temporaryRoot });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [configFile] });
      try {
        const project =
          snapshot.getProject(configFile) ?? snapshot.getProjects()[0];
        assert.ok(project);
        for (const fileName of fileNames) {
          const failures = inspectTaskCliCancellationWiring(
            project,
            projectSourceFile(project, fileName),
          );
          assert.notDeepEqual(failures, [], fileName);
        }
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
