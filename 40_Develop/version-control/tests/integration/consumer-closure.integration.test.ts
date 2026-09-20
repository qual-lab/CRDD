import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { describeRepositoryLocationContract } from "../../src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const developRoot = path.join(repositoryRoot, "40_Develop");

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

function productionSources(root: string): readonly string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...productionSources(target));
    else if (entry.isFile() && entry.name.endsWith(".ts")) found.push(target);
  }
  return found;
}

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

test("Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
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

test("Repository Locationの公開ProjectionにGit固有語彙を出さない", () => {
  const projection = JSON.stringify(describeRepositoryLocationContract());
  for (const term of ["commit", "tree", "index", "worktree", "staged"])
    assert.equal(projection.toLocaleLowerCase("en-US").includes(term), false);
});

test("Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
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
      "40_Develop/checker/compile-semantic-ir-pilot.ts",
      "40_Develop/checker/regression-execution.ts",
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
    ],
  );
  assert.deepEqual(
    consumers(
      /\b(?:registerRepositoryLocalIgnore|gitRepositoryLocalIgnoreAdapter)\b/u,
    ),
    ["40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts"],
  );
});

test("Checkerは同じ基準版RootのVersion Control公開入口だけを使う", () => {
  const checkerSource = fs.readFileSync(
    path.join(repositoryRoot, "template", "tools", "crdd-check.ts"),
    "utf8",
  );
  assert.equal(
    checkerSource.includes(
      'from "../../40_Develop/version-control/src/index.ts"',
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
  const section = /### 3\.1 現行公開Symbol\r?\n([\s\S]*?)\r?\n## 4\./u.exec(
    architecture,
  )?.[1];
  assert.ok(section, "Version Control Architectureの公開Symbol節");
  const declared = [...section.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/gu)]
    .map((match) => match[1] ?? "")
    .filter(Boolean)
    .sort();
  assert.deepEqual(publicExportNames(source), declared);
});

test("Local Change SetとChecker配布能力のConsumer集合が宣言と一致する", () => {
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
    "40_Develop/checker/regression-execution.ts",
  ]);

  const checkerRuntimeConsumers = sources
    .filter(({ source }) =>
      source.includes('from "../../40_Develop/version-control/src/index.ts"'),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(checkerRuntimeConsumers, ["template/tools/crdd-check.ts"]);
});

test("既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使う", () => {
  const consumerPaths = [
    "40_Develop/checker/regression-execution.ts",
    "template/tools/crdd-check.ts",
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
