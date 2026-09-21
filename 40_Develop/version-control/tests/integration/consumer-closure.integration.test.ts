/**
 * version-control:integration:consumer-closureの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:consumer-closureが所有する検証責務を実行する。
 * @trace RCM-IT-004
 * @level IT
 * @scope version-control、consumer-closure
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { describeRepositoryLocationContract } from "../../src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const developRoot = path.join(repositoryRoot, "40_Develop");

/**
 * publicExportNamesのTest準備責務を実行する。
 *
 * @responsibility publicExportNamesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus publicExportNamesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
function publicExportNames(source: string): readonly string[] {
  const names: string[] = [];
  for (const block of source.matchAll(/export\s*\{([\s\S]*?)\}\s*from/gu))
    for (const raw of block[1]?.split(",") ?? []) {
      const normalized = raw.trim().replace(/^type\s+/u, "");
      if (normalized.length > 0)
        names.push(normalized.split(/\s+as\s+/u).at(-1) ?? normalized);
    }
  return [...new Set(names)].sort();
}

/**
 * productionSourcesのTest準備責務を実行する。
 *
 * @responsibility productionSourcesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus productionSourcesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
function productionSources(root: string): readonly string[] {
  const foundFiles: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) foundFiles.push(...productionSources(target));
    else if (entry.isFile() && entry.name.endsWith(".ts"))
      foundFiles.push(target);
  }
  return foundFiles;
}

/**
 * Repository Locationの旧Ownerと重複した能力発行入口を残さないを検証する。
 *
 * @responsibility Repository Locationの旧Ownerと重複した能力発行入口を残さないの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Locationの旧Ownerと重複した能力発行入口を残さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Repository Locationの旧Ownerと重複した能力発行入口を残さない", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    sourcePath,
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  const retiredPaths = [
    "runtime-data/src/platform/repository-root-capability.ts",
    "coordinator/src/security/repository-root-resolution.ts",
    "coordinator/src/security/repository-git-layout.ts",
    "coordinator/src/security/repository-git-layout-internal.ts",
    "coordinator/src/security/git-object-reader.ts",
  ];
  for (const retiredPath of retiredPaths)
    assert.equal(
      sources.some(({ source }) => source.includes(retiredPath)),
      false,
      retiredPath,
    );

  const issuers = sources.filter(({ source }) =>
    source.includes("const REPOSITORY_LOCATION_CONTRACT ="),
  );
  assert.deepEqual(
    issuers.map(({ sourcePath }) =>
      path.relative(repositoryRoot, sourcePath).replaceAll(path.sep, "/"),
    ),
    ["40_Develop/version-control/src/repository-location.ts"],
  );
});

/**
 * 保護対象Runtimeは公開barrelやVersion Control内部実装を依存閉包へ取り込まないを検証する。
 *
 * @responsibility 保護対象Runtimeは公開barrelやVersion Control内部実装を依存閉包へ取り込まないの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 保護対象Runtimeは公開barrelやVersion Control内部実装を依存閉包へ取り込まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("保護対象Runtimeは公開barrelやVersion Control内部実装を依存閉包へ取り込まない", () => {
  const protectedRoots = [
    path.join(developRoot, "coordinator", "src"),
    path.join(developRoot, "coordinator", "scripts"),
    path.join(developRoot, "runtime-data", "src"),
    path.join(developRoot, "execution-intelligence", "src"),
  ];
  const sources = protectedRoots
    .flatMap((root) => productionSources(root))
    .map((sourcePath) => ({
      relativePath: path
        .relative(repositoryRoot, sourcePath)
        .replaceAll(path.sep, "/"),
      source: fs.readFileSync(sourcePath, "utf8"),
    }));
  for (const { relativePath, source } of sources) {
    assert.equal(
      source.includes("version-control/src/index.ts"),
      false,
      `${relativePath}: protected runtime must import the exact port or adapter`,
    );
    if (!relativePath.startsWith("40_Develop/version-control/")) {
      assert.equal(
        /version-control\/src\/git\/(?:object-reader|repository-layout)\.ts/u.test(
          source,
        ),
        false,
        `${relativePath}: low-level Git implementation`,
      );
    }
  }
});

/**
 * Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致するを検証する。
 *
 * @responsibility Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  /**
   * externalConsumersのTest準備責務を実行する。
   *
   * @responsibility externalConsumersがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RCM-IT-004
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus externalConsumersを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
   */
  const externalConsumers = (pattern: RegExp) =>
    sources
      .filter(
        ({ relativePath, source }) =>
          !relativePath.startsWith("40_Develop/version-control/") &&
          pattern.test(source),
      )
      .map(({ relativePath }) => relativePath)
      .sort();

  assert.deepEqual(
    externalConsumers(
      /\b(?:inspectFixedSnapshot|readFixedSnapshotFile|materializeFixedSnapshotCandidate|inspectRepositoryFixedSnapshot|gitFixedSnapshotAdapter)\b/u,
    ),
    [
      "40_Develop/coordinator/scripts/prepare-release-candidate.ts",
      "40_Develop/coordinator/scripts/sign-release-manifest.ts",
      "40_Develop/coordinator/src/security/external-send-policy-runtime.ts",
      "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
      "40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts",
      "40_Develop/coordinator/src/security/repository-workspace-runtime.ts",
    ],
  );
  assert.deepEqual(
    externalConsumers(
      /\b(?:observeFixedRevisionIdentity|gitFixedRevisionIdentityAdapter|observeRepositoryRevision|gitRepositoryRevisionAdapter)\b/u,
    ),
    ["40_Develop/coordinator/src/security/repository-operation-runtime.ts"],
  );
});

/**
 * Repository Locationの公開ProjectionにGit固有語彙を出さないを検証する。
 *
 * @responsibility Repository Locationの公開ProjectionにGit固有語彙を出さないの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Locationの公開ProjectionにGit固有語彙を出さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Repository Locationの公開ProjectionにGit固有語彙を出さない", () => {
  const projection = JSON.stringify(describeRepositoryLocationContract());
  for (const term of ["commit", "tree", "index", "worktree", "staged"])
    assert.equal(projection.toLocaleLowerCase("en-US").includes(term), false);
});

/**
 * Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致するを検証する。
 *
 * @responsibility Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  /**
   * consumersのTest準備責務を実行する。
   *
   * @responsibility consumersがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RCM-IT-004
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus consumersを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
   */
  const consumers = (pattern: RegExp) =>
    sources
      .filter(
        ({ relativePath, source }) =>
          !relativePath.startsWith("40_Develop/version-control/") &&
          pattern.test(source),
      )
      .map(({ relativePath }) => relativePath)
      .sort();

  assert.deepEqual(
    consumers(
      /\b(?:verifyRepositoryRoot|verifyRepositoryRootFromWorkingDirectory|resolveVerifiedRepositoryRootFromWorkingDirectory|describeRepositoryLocationContract)\b/u,
    ),
    [
      "40_Develop/checker/src/rules/reality-symbol-graph.ts",
      "40_Develop/coordinator/bin/coordinator.ts",
      "40_Develop/coordinator/scripts/measure-development-providers.ts",
      "40_Develop/coordinator/scripts/prepare-release-candidate.ts",
      "40_Develop/coordinator/scripts/promote-release-manifest.ts",
      "40_Develop/coordinator/scripts/sign-release-manifest.ts",
      "40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts",
      "40_Develop/coordinator/scripts/verify-signed-general-task.ts",
      "40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts",
      "40_Develop/coordinator/scripts/verify-signed-route-matrix.ts",
      "40_Develop/coordinator/src/composition/project-runtime-composition-root.ts",
      "40_Develop/coordinator/src/core/doctor.ts",
      "40_Develop/coordinator/src/core/verification-result-record.ts",
      "40_Develop/coordinator/src/security/external-send-policy-runtime.ts",
      "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
      "40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts",
      "40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts",
      "40_Develop/coordinator/src/security/repository-operation-runtime.ts",
      "40_Develop/coordinator/src/security/repository-workspace-runtime.ts",
      "40_Develop/execution-intelligence/src/store/verified-repository-root.ts",
      "40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts",
      "40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts",
      "40_Develop/verification-runner/src/execution/regression-execution.ts",
    ],
  );
  assert.deepEqual(
    consumers(
      /\b(?:registerRepositoryLocalIgnore|gitRepositoryLocalIgnoreAdapter)\b/u,
    ),
    ["40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts"],
  );
});

/**
 * Checkerは同じ基準版RootのVersion Control公開入口だけを使うを検証する。
 *
 * @responsibility Checkerは同じ基準版RootのVersion Control公開入口だけを使うの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Checkerは同じ基準版RootのVersion Control公開入口だけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Checkerは同じ基準版RootのVersion Control公開入口だけを使う", () => {
  const checkerSource = fs.readFileSync(
    path.join(
      repositoryRoot,
      "40_Develop",
      "checker",
      "src",
      "profiles",
      "current-profile.ts",
    ),
    "utf8",
  );
  assert.equal(
    checkerSource.includes(
      'from "../../../version-control/src/checker-observation/index.ts"',
    ),
    true,
  );
  assert.equal(
    checkerSource.includes('from "../../../version-control/src/index.ts"'),
    false,
  );
  const distributedEntry = fs.readFileSync(
    path.join(repositoryRoot, "template", "tools", "crdd-check.ts"),
    "utf8",
  );
  assert.equal(
    distributedEntry.includes(
      'import "../../40_Develop/checker/bin/crdd-check.ts";',
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        repositoryRoot,
        "template",
        "tools",
        "internal",
        "version-control-runtime.ts",
      ),
    ),
    false,
  );
});

/**
 * Version Controlの公開SymbolはArchitectureの現行集合と完全一致するを検証する。
 *
 * @responsibility Version Controlの公開SymbolはArchitectureの現行集合と完全一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Version Controlの公開SymbolはArchitectureの現行集合と完全一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Version Controlの公開SymbolはArchitectureの現行集合と完全一致する", () => {
  const source = fs.readFileSync(
    path.join(
      repositoryRoot,
      "40_Develop",
      "version-control",
      "src",
      "index.ts",
    ),
    "utf8",
  );
  const architecture = fs.readFileSync(
    path.join(
      repositoryRoot,
      "06_Architecture",
      "Details",
      "version-control",
      "01_Architecture.md",
    ),
    "utf8",
  );
  const section = /### 3\.1 現行公開Symbol\r?\n([\s\S]*?)\r?\n### 3\.2/u.exec(
    architecture,
  )?.[1];
  assert.ok(section, "Version Control Architectureの公開Symbol節");
  const declaredExports = [...section.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/gu)]
    .map((match) => match[1] ?? "")
    .filter(Boolean)
    .sort();
  assert.deepEqual(publicExportNames(source), declaredExports);

  const narrowEntrypoints = [
    {
      heading: "Checker Observation",
      sourcePath: "40_Develop/version-control/src/checker-observation/index.ts",
    },
    {
      heading: "Repository Identity",
      sourcePath: "40_Develop/version-control/src/repository-identity/index.ts",
    },
  ] as const;
  for (const entrypoint of narrowEntrypoints) {
    const narrowSource = fs.readFileSync(
      path.join(repositoryRoot, entrypoint.sourcePath),
      "utf8",
    );
    const narrowSection = new RegExp(
      `#### ${entrypoint.heading}\\r?\\n([\\s\\S]*?)(?:\\r?\\n#### |\\r?\\n## 4\\.)`,
      "u",
    ).exec(architecture)?.[1];
    assert.ok(narrowSection, `${entrypoint.heading}の公開Symbol節`);
    const narrowDeclaredExports = [
      ...narrowSection.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/gu),
    ]
      .map((match) => match[1] ?? "")
      .filter(Boolean)
      .sort();
    assert.deepEqual(
      publicExportNames(narrowSource),
      narrowDeclaredExports,
      entrypoint.heading,
    );
  }
});

/**
 * Local Change Setと狭いVersion Control公開入口のConsumer集合が宣言と一致するを検証する。
 *
 * @responsibility Local Change Setと狭いVersion Control公開入口のConsumer集合が宣言と一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Local Change Setと狭いVersion Control公開入口のConsumer集合が宣言と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("Local Change Setと狭いVersion Control公開入口のConsumer集合が宣言と一致する", () => {
  const sources = [
    ...productionSources(developRoot),
    ...productionSources(path.join(repositoryRoot, "template", "tools")),
  ].map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));

  const localChangeSetConsumers = sources
    .filter(({ source }) =>
      /\b(observeLocalChangeSet|gitLocalChangeSetAdapter)\b/u.test(source),
    )
    .map(({ relativePath }) => relativePath)
    .filter(
      (relativePath) => !relativePath.startsWith("40_Develop/version-control/"),
    )
    .sort();
  assert.deepEqual(localChangeSetConsumers, [
    "40_Develop/verification-runner/src/execution/regression-execution.ts",
  ]);

  const checkerObservationConsumers = sources
    .filter(({ source }) =>
      source.includes("version-control/src/checker-observation/index.ts"),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(checkerObservationConsumers, [
    "40_Develop/checker/src/profiles/current-profile.ts",
  ]);

  const repositoryIdentityConsumers = sources
    .filter(({ source }) =>
      source.includes("version-control/src/repository-identity/index.ts"),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(repositoryIdentityConsumers, [
    "40_Develop/checker/src/adapters/reality-test-catalog.ts",
    "40_Develop/checker/src/adapters/reality-traceability.ts",
    "40_Develop/checker/src/rules/reality-symbol-graph.ts",
    "40_Develop/crdd-domain-library/src/repository-observation/index.ts",
    "40_Develop/crdd-domain-library/src/repository-observation/reality-symbol-repository-observer.ts",
    "40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts",
    "40_Develop/semantic-coverage/src/application/semantic-coverage.ts",
    "40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts",
    "40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts",
  ]);
});

/**
 * 既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使うを検証する。
 *
 * @responsibility 既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使うの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使う", () => {
  const consumerPaths = [
    "40_Develop/checker/src/profiles/current-profile.ts",
    "40_Develop/checker/src/rules/reality-symbol-graph.ts",
    "40_Develop/verification-runner/src/execution/regression-execution.ts",
  ];
  const forbiddenPatterns = [
    /node:child_process/u,
    /\b(?:spawnSync|execFileSync|execSync)\b/u,
    /\bcollectChangedPathsFromGit\b/u,
    /\b(?:gitArguments|gitCommand|gitExecutable)\b/u,
  ];
  for (const relativePath of consumerPaths) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    for (const pattern of forbiddenPatterns)
      assert.equal(pattern.test(source), false, `${relativePath}: ${pattern}`);
  }
});

/**
 * GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行するを検証する。
 *
 * @responsibility GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
test("GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  const owners = sources
    .filter(({ source }) =>
      source.includes(
        "const gitLocalChangeSetAdapter = createGitLocalChangeSetAdapter()",
      ),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(owners, [
    "40_Develop/version-control/src/git/local-change-set-adapter.ts",
  ]);
});
