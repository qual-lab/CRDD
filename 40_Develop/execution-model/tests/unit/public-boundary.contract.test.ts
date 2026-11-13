/**
 * Modelの固定公開契約を検証する。
 * @packageDocumentation
 * @responsibility 公開集合と内部境界、用途固有の操作を検査する。
 * @trace RCM-UT-014
 * @trace RCM-UT-016
 * @level UT
 * @scope 公開契約、実行時値、型、Package依存
 * @boundary 同一Processの境界検査。外部Effectなし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  purposeResource,
  REPAIR_ACTIONS,
  REPAIR_DIRECTORIES,
} from "../../src/attempt/validation.ts";
import * as domainLibrary from "../../src/index.ts";

/**
 * Sourceのimport・再export・型参照から他モデルへの接続を抽出する。
 * @responsibility 相対PathとPackage名の直接依存を同じ境界で検査する。
 * @trace RCM-UT-014
 * @precondition 検査対象はSource本文とその所在である。
 * @stimulus static／type／dynamic import、再export、requireの参照を調べる。
 * @observation 他モデルへの参照値。
 * @oracle 型だけの依存も許容せず、VC等の専門Packageは妨げない。
 * @cleanup 外部資源なし。
 * @boundary 3ModelのSource／Package境界。
 */
function crossModelReferences(source: string, file: string, owner: string) {
  const models = ["document-model", "execution-model", "configuration-model"];
  return [
    ...source.matchAll(
      /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*|new\s+URL\(\s*)["']([^"']+)["']/gu,
    ),
  ]
    .map((match) => match[1] ?? "")
    .filter((specifier) => {
      const clean = specifier.replace(/[?#].*$/u, "");
      const target = clean.startsWith(".")
        ? path.resolve(path.dirname(file), clean).replaceAll("\\", "/")
        : clean;
      return models.some(
        (model) =>
          model !== owner &&
          (target.includes(`/${model}/`) ||
            target === `@qual-lab/crdd-${model}` ||
            target.startsWith(`@qual-lab/crdd-${model}/`)),
      );
    });
}

/**
 * 3モデル間の実装・型・再export・Package直接依存を拒否する。
 * @responsibility 公開境界をCallbackやFacadeではなく実Sourceから検査する。
 * @trace RCM-UT-014
 * @precondition 3つのモデルが同じ40_Develop配下にある。
 * @stimulus 本番Sourceとpackage宣言、型を含む合成反証を照合する。
 * @observation 参照違反の一覧。
 * @oracle 直接依存は0、VCへの正規参照は受理する。
 * @cleanup 読取りと合成文字列だけで資源を作らない。
 * @boundary Model Packageの依存契約。
 */
test("3モデルは実装・型・再export・Packageの直接依存を持たない", () => {
  const develop = path.resolve(import.meta.dirname, "../../..");
  const models = ["document-model", "execution-model", "configuration-model"];
  const violations: string[] = [];
  for (const owner of models) {
    const packageRoot = path.join(develop, owner);
    const file = path.join(packageRoot, "src", "index.ts");
    const other = models.find((model) => model !== owner) as string;
    for (const statement of [
      `import type { Value } from "../../${other}/src/index.ts";`,
      `export type { Value } from "../../${other}/src/types.ts";`,
      `type Value = import("../../${other}/src/index.ts").Value;`,
      `import("@qual-lab/crdd-${other}");`,
      `require("@qual-lab/crdd-${other}/private");`,
      `new URL("../../${other}/src/types.ts", import.meta.url);`,
    ])
      assert.equal(crossModelReferences(statement, file, owner).length, 1);
    assert.deepEqual(
      crossModelReferences(
        'import type { Repository } from "../../version-control/src/index.ts";',
        file,
        owner,
      ),
      [],
    );
    for (const target of typescriptFiles(path.join(packageRoot, "src"))) {
      const source = fs.readFileSync(target, "utf8");
      for (const referenced of crossModelReferences(source, target, owner)) {
        violations.push(
          `${owner}:${path.relative(packageRoot, target)}:${referenced}`,
        );
      }
    }
    const metadata = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    );
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      for (const dependency of Object.keys(metadata[field] ?? {})) {
        if (
          models.some(
            (model) =>
              model !== owner && dependency === `@qual-lab/crdd-${model}`,
          )
        )
          violations.push(`${owner}:${field}:${dependency}`);
      }
    }
    for (const referenced of crossModelReferences(
      Object.values(metadata.exports ?? {})
        .map((value) => `export * from ${JSON.stringify(value)};`)
        .join("\n"),
      path.join(packageRoot, "package.json"),
      owner,
    ))
      violations.push(`${owner}:exports:${referenced}`);
  }
  assert.deepEqual(violations, []);
});

/**
 * 型を含む明示export名をSourceから観測する。
 * @responsibility 固定期待集合に対する観測値だけを取得する。
 * @trace RCM-UT-014
 * @precondition 相対Pathは試験内で固定する。
 * @stimulus 対象Moduleの公開宣言を列挙する。
 * @observation exportされた名前。
 * @oracle 呼出し元が固定literalと完全一致を確認する。
 * @cleanup 読取りのみ。
 * @boundary Package Rootの型宣言。
 */
function exportedNames(relativePath: string): readonly string[] {
  const source = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath),
    "utf8",
  );
  const names = [
    ...[
      ...source.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s*from/gu),
    ].flatMap((match) =>
      (match[1] ?? "")
        .split(",")
        .map(
          (entry) =>
            entry
              .trim()
              .replace(/^type\s+/u, "")
              .split(/\s+as\s+/u)
              .at(-1) ?? "",
        )
        .filter((entry) => entry.length > 0),
    ),
    ...[
      ...source.matchAll(
        /export\s+(?:type|interface|const|function|class)\s+([A-Za-z][A-Za-z0-9]*)/gu,
      ),
    ].map((match) => match[1] ?? ""),
  ];
  return names.filter((name) => name.length > 0).sort();
}

/**
 * Module境界の検査対象Sourceを列挙する。
 * @responsibility 依存ライブラリを除き対象RepositoryのSourceだけを読む。
 * @trace RCM-UT-014
 * @precondition Rootは試験内で固定する。
 * @stimulus Sourceと利用側の型付きFileを列挙する。
 * @observation 対象File一覧。
 * @oracle 呼出し元が各Fileの依存を検査する。
 * @cleanup 読取りのみ。
 * @boundary Sourceの静的依存確認。
 */
function typescriptFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...typescriptFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(target);
  }
  return files;
}

/**
 * 内部の固定検査集合の不変性とRootからの分離を確認する。
 * @responsibility Root非公開化後も固定値自体の不変性を保持する。
 * @trace RCM-UT-014
 * @precondition 固定値は正本Module、公開有無はRootの実Moduleを使用する。
 * @stimulus 固定配列と辞書へのReflect書込みを試みる。
 * @observation 書込み拒否と元値の一致。
 * @oracle 配列要素・長さと辞書の検査条件が変わらない。
 * @cleanup N/A: 不変値への拒否だけを観測する。
 * @boundary 内部検査値とPackage Rootの公開集合。
 */
test("内部の固定検査集合は変更できずRootへ公開しない", () => {
  for (const value of [REPAIR_ACTIONS, REPAIR_DIRECTORIES, purposeResource]) {
    const before = JSON.stringify(value);
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Reflect.set(value, "unexpected", "changed"), false);
    if (Array.isArray(value)) {
      assert.equal(Reflect.set(value, "0", "changed"), false);
      assert.equal(Reflect.set(value, "length", 0), false);
    } else {
      assert.equal(Reflect.set(value, "create_provider", "changed"), false);
    }
    assert.equal(JSON.stringify(value), before);
  }
  for (const name of [
    "REPAIR_ACTIONS",
    "REPAIR_DIRECTORIES",
    "purposeResource",
    "parseAdviceResult",
    "describeAdviceResultSchema",
    "inspectTaskResultContent",
    "finalReasons",
    "INTEGRATION_RECORD_IDENTITY",
    "INTEGRATION_BINDING_IDENTITY",
    "repairReasons",
    "nullableId",
    "stringArray",
    "prepareStateOperationSnapshot",
  ]) {
    assert.equal(Object.hasOwn(domainLibrary, name), false);
  }
});

/**
 * 採用設計の公開集合とPackage入口を固定する。
 * @responsibility 実装から期待集合を生成せず欠落・余剰を拒否する。
 * @trace RCM-UT-014
 * @precondition 採用設計のSymbolをliteralで固定する。
 * @stimulus Rootとpackageの公開集合を取得する。
 * @observation 明示exportと実行値、Subpath。
 * @oracle 固定集合と完全一致する。
 * @cleanup 外部資源なし。
 * @boundary 公開Moduleと型契約。
 */
test("Package Rootは採用済みの固定公開集合だけを提供する", () => {
  assert.deepEqual(Object.keys(domainLibrary).sort(), [
    "ExecutionStorageBlockedError",
    "OBJECTIVE_STATES",
    "PROJECT_STATE_CONTRACT",
    "TASK_STATES",
    "acquireLease",
    "advanceOwnedRecoveryHistory",
    "advanceOwnedRepairHistory",
    "answerDecision",
    "applyDecision",
    "applyResourceCleanup",
    "applyResourceEvent",
    "areTaskResourcesSettled",
    "canCloseUnknownAuthentication",
    "closeDecision",
    "completeOperation",
    "completeRecovery",
    "completeRepair",
    "createDockerRestartRequestId",
    "createLocalPrincipalId",
    "createObjective",
    "createQueue",
    "createTask",
    "decodeProjectResultAcceptance",
    "deleteObjective",
    "deleteTask",
    "dockerProcessControllerPublicCompletionReasons",
    "getConsumerCompletionPolicy",
    "hashExecutionSelection",
    "initializeExecutionState",
    "initializeExecutionStore",
    "inspectDecision",
    "inspectExecutionPlan",
    "inspectExecutionSelection",
    "inspectSingleTaskRecord",
    "inspectTaskExecutionSelections",
    "inspectWorkspaceResult",
    "isDockerRestartCheckpointSettled",
    "isPrincipalId",
    "isRepairCheckpointSettled",
    "isRepairDisposalSettled",
    "leaseAcquisitionRecoveryId",
    "leaseIdentity",
    "observeTransientTaskCompletion",
    "parseDockerTaskRecoveryId",
    "parseHostRecoveryToken",
    "queryDecisions",
    "queryExecutionState",
    "queryObjectives",
    "queryPlan",
    "queryQueue",
    "queryTasks",
    "queryWorkspaces",
    "readDecision",
    "readLease",
    "readOperationResourcesStage",
    "readOperationResult",
    "readOperationStateStage",
    "readOwnedRecoveryResult",
    "readProjectExecutionState",
    "readQueueEntry",
    "readRecoveryState",
    "readSnapshotIntakeEpoch",
    "readState",
    "readTaskIntakeState",
    "recordDecision",
    "recoverLease",
    "registerOwnedRecoveryResultDelivery",
    "releaseLease",
    "removeStatePublicationMarker",
    "requestDecision",
    "resumeRepairPublication",
    "resumeResourcePublication",
    "retireStateRecords",
    "saveHostCleanupPreparation",
    "saveIntegrationRecord",
    "saveOperationCheckpoint",
    "saveOperationStart",
    "savePlan",
    "saveProjectExecutionState",
    "saveRecoveryCheckpoint",
    "saveRepairState",
    "saveResourceNotIssuedStage",
    "saveUnknownAuthenticationClosureStage",
    "saveWorkspaceRecord",
    "selectQueueEntry",
    "transferHistory",
    "updateObjective",
    "updateQueue",
    "updateTask",
    "validId",
    "validWorkspaceCandidateRequest",
    "validWorkspaceDisplayName",
    "validateHostRecoveryTransitionLineage",
    "validateResourceBook",
    "validateResourceBookTransition",
    "verifyQueueIntake",
  ]);
  assert.deepEqual(exportedNames("../../src/index.ts"), [
    "AcceptanceDecision",
    "AcceptanceTarget",
    "Decision",
    "DecisionRequest",
    "ExecutionModelAccess",
    "ExecutionOperationRecord",
    "ExecutionSelection",
    "ExecutionStateSnapshot",
    "ExecutionStorageBlockedError",
    "LeaseKind",
    "OBJECTIVE_STATES",
    "ObjectivePlan",
    "OperationRecord",
    "OperationResources",
    "PROJECT_STATE_CONTRACT",
    "ProjectDockerRecoveryAcknowledgement",
    "ProjectExecutionState",
    "ProjectMilestoneState",
    "ProjectObjectiveDefinition",
    "ProjectQueueEntry",
    "ProjectQueueState",
    "ProjectResultAcceptance",
    "ProjectTaskDefinition",
    "ProjectTaskRecord",
    "ProjectTaskRecoveryKind",
    "ProjectTaskRecoveryObligation",
    "ProjectTaskResultFact",
    "ProjectTaskState",
    "QueueEnqueueInput",
    "RepairCheckpoint",
    "RepairOperationRecord",
    "RepairSaveRequest",
    "RepositoryWorktreeResult",
    "RestartCheckpoint",
    "SingleTaskRecord",
    "StateVersion",
    "TASK_STATES",
    "TaskExecutionSelections",
    "WorkspaceCandidateRequest",
    "WorkspaceCandidateResult",
    "WorkspaceRecord",
    "WorkspaceResult",
    "acquireLease",
    "advanceOwnedRecoveryHistory",
    "advanceOwnedRepairHistory",
    "answerDecision",
    "applyDecision",
    "applyResourceCleanup",
    "applyResourceEvent",
    "areTaskResourcesSettled",
    "canCloseUnknownAuthentication",
    "closeDecision",
    "completeOperation",
    "completeRecovery",
    "completeRepair",
    "createDockerRestartRequestId",
    "createLocalPrincipalId",
    "createObjective",
    "createQueue",
    "createTask",
    "decodeProjectResultAcceptance",
    "deleteObjective",
    "deleteTask",
    "dockerProcessControllerPublicCompletionReasons",
    "getConsumerCompletionPolicy",
    "hashExecutionSelection",
    "initializeExecutionState",
    "initializeExecutionStore",
    "inspectDecision",
    "inspectExecutionPlan",
    "inspectExecutionSelection",
    "inspectSingleTaskRecord",
    "inspectTaskExecutionSelections",
    "inspectWorkspaceResult",
    "isDockerRestartCheckpointSettled",
    "isPrincipalId",
    "isRepairCheckpointSettled",
    "isRepairDisposalSettled",
    "leaseAcquisitionRecoveryId",
    "leaseIdentity",
    "observeTransientTaskCompletion",
    "parseDockerTaskRecoveryId",
    "parseHostRecoveryToken",
    "queryDecisions",
    "queryExecutionState",
    "queryObjectives",
    "queryPlan",
    "queryQueue",
    "queryTasks",
    "queryWorkspaces",
    "readDecision",
    "readLease",
    "readOperationResourcesStage",
    "readOperationResult",
    "readOperationStateStage",
    "readOwnedRecoveryResult",
    "readProjectExecutionState",
    "readQueueEntry",
    "readRecoveryState",
    "readSnapshotIntakeEpoch",
    "readState",
    "readTaskIntakeState",
    "recordDecision",
    "recoverLease",
    "registerOwnedRecoveryResultDelivery",
    "releaseLease",
    "removeStatePublicationMarker",
    "requestDecision",
    "resumeRepairPublication",
    "resumeResourcePublication",
    "retireStateRecords",
    "saveHostCleanupPreparation",
    "saveIntegrationRecord",
    "saveOperationCheckpoint",
    "saveOperationStart",
    "savePlan",
    "saveProjectExecutionState",
    "saveRecoveryCheckpoint",
    "saveRepairState",
    "saveResourceNotIssuedStage",
    "saveUnknownAuthenticationClosureStage",
    "saveWorkspaceRecord",
    "selectQueueEntry",
    "transferHistory",
    "updateObjective",
    "updateQueue",
    "updateTask",
    "validId",
    "validWorkspaceCandidateRequest",
    "validWorkspaceDisplayName",
    "validateHostRecoveryTransitionLineage",
    "validateResourceBook",
    "validateResourceBookTransition",
    "verifyQueueIntake",
  ]);
  const metadata = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(metadata.exports, { ".": "./src/index.ts" });
});

/**
 * srcのDirectoryはCapability-firstかつ二階層以内に保つを検証する。
 *
 * @responsibility srcのDirectoryはCapability-firstかつ二階層以内に保つの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus srcのDirectoryはCapability-firstかつ二階層以内に保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("srcのDirectoryはCapability-firstかつ二階層以内に保つ", () => {
  const sourceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../src",
  );
  const prohibitedNames = new Set(["common", "helpers", "internal", "utils"]);
  const violations: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const target = path.join(directory, entry.name);
      const relativePath = path
        .relative(sourceRoot, target)
        .replaceAll("\\", "/");
      const depth = relativePath.split("/").length;
      if (depth > 2 || prohibitedNames.has(entry.name))
        violations.push(relativePath);
      visit(target);
    }
  };
  visit(sourceRoot);
  assert.deepEqual(violations, []);
});
/**
 * Execution Modelの利用側は宣言済み公開indexだけを利用するを検証する。
 *
 * @responsibility Execution Modelの利用側は宣言済み公開indexだけを利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Execution Modelの利用側は宣言済み公開indexだけを利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Execution Modelの利用側は宣言済み公開indexだけを利用する", () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const developRoot = path.join(repositoryRoot, "40_Develop");
  const consumers = [
    ...fs
      .readdirSync(developRoot, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && entry.name !== "execution-model",
      )
      .map((entry) => path.join(developRoot, entry.name)),
    path.join(repositoryRoot, "template", "tools"),
  ];
  const violations: string[] = [];
  const imports = (source: string) =>
    [
      ...source.matchAll(
        /(?:from\s+|import\s*\(\s*|new\s+URL\(\s*|import\s+)["']([^"']*execution-model\/(?:src|tests)\/[^"']+)["']/gu,
      ),
    ]
      .map((match) => match[1] ?? "")
      .filter(
        (imported) =>
          !/execution-model\/src\/index\.ts$/u.test(
            imported.replace(/[?#].*$/u, ""),
          ),
      );
  for (const prefix of [
    "import { value } from ",
    "import(",
    "new URL(",
    "import ",
  ]) {
    assert.deepEqual(
      imports(`${prefix}"../../../execution-model/src/index.ts?fixture"`),
      [],
    );
    assert.deepEqual(
      imports(`${prefix}"../../../execution-model/src/state/crud.ts"`),
      ["../../../execution-model/src/state/crud.ts"],
    );
    assert.deepEqual(
      imports(
        `${prefix}"../../../execution-model/tests/support/runtime-storage-source.ts"`,
      ),
      ["../../../execution-model/tests/support/runtime-storage-source.ts"],
    );
  }
  // 中立fixtureは許可し、保存内部を試験facade経由で公開する参照は拒否する。
  // Package名や補助Fileのallowlistではなく、相対参照の依存閉包を照合する。
  const domainRoot = path.join(developRoot, "execution-model");
  const reachesPrivate = (
    file: string,
    seen = new Set<string>(),
    syntheticSources?: ReadonlyMap<string, string>,
  ): boolean => {
    if (seen.has(file)) return false;
    seen.add(file);
    const repositoryRelative = path.relative(repositoryRoot, file);
    if (
      repositoryRelative.startsWith("..") ||
      path.isAbsolute(repositoryRelative)
    )
      return true;
    const relative = path.relative(domainRoot, file).replaceAll("\\", "/");
    if (relative.startsWith("src/")) return relative !== "src/index.ts";
    let source: string;
    try {
      const supplied = syntheticSources?.get(file);
      if (syntheticSources && supplied === undefined) return true;
      source = supplied ?? fs.readFileSync(file, "utf8");
    } catch {
      return true;
    }
    for (const match of source.matchAll(
      /(?:from\s+|import\s*\(\s*|new\s+URL\(\s*|import\s+)["']([^"']+)["']/gu,
    )) {
      const target = match[1]?.replace(/[?#].*$/u, "");
      if (
        target?.startsWith(".") &&
        reachesPrivate(
          path.resolve(path.dirname(file), target),
          seen,
          syntheticSources,
        )
      )
        return true;
    }
    return false;
  };
  assert.equal(
    reachesPrivate(
      path.join(domainRoot, "tests/support/runtime-storage-source.ts"),
    ),
    true,
  );
  assert.equal(
    reachesPrivate(
      path.join(domainRoot, "tests/support/source-declaration.ts"),
    ),
    false,
  );
  const syntheticEntry = path.join(domainRoot, "tests", "fixture.ts");
  const syntheticHop = path.join(developRoot, "neutral-fixture.ts");
  assert.equal(
    reachesPrivate(
      syntheticEntry,
      new Set(),
      new Map([[syntheticEntry, 'import "../src/state/crud.ts";']]),
    ),
    true,
  );
  assert.equal(
    reachesPrivate(
      syntheticEntry,
      new Set(),
      new Map([
        [syntheticEntry, 'import "../../neutral-fixture.ts";'],
        [syntheticHop, 'import "./execution-model/src/state/crud.ts";'],
      ]),
    ),
    true,
  );
  for (const consumerRoot of consumers)
    for (const file of typescriptFiles(consumerRoot)) {
      const source = fs.readFileSync(file, "utf8");
      for (const imported of imports(source)) {
        if (
          imported.includes("execution-model/tests/") &&
          !reachesPrivate(
            path.resolve(path.dirname(file), imported.replace(/[?#].*$/u, "")),
          )
        )
          continue;
        violations.push(
          `${path.relative(repositoryRoot, file).replaceAll("\\", "/")}: ${imported}`,
        );
      }
    }
  assert.deepEqual(violations, []);
});
