import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  type CrddLauncherBindingRequest,
  resolveCrddCheckerLauncherBinding,
} from "../../src/launcher-binding.ts";

const root = path.win32.resolve("C:/fixture/crdd");
const projectRoot = path.win32.resolve("C:/fixture/project");
const launcher = path.win32.join(root, "template", "tools", "crdd-check.ts");
const implementation = path.win32.join(
  root,
  "40_Develop",
  "checker",
  "src",
  "checker-cli.ts",
);
const repositoryManifest = {
  schema: "crdd/repository-manifest/v1",
  projectId: "qual-lab.crdd",
  repositoryRole: "crdd-standard",
} as const;
const releaseBinding = {
  verified: true,
  distributionRoot: root,
  crddVersion: "v0.21.0",
  packageContentRootSha256: "a".repeat(64),
  runtimeExecutionIdentitySha256: "b".repeat(64),
} as const;

function request(
  overrides: Partial<CrddLauncherBindingRequest> = {},
): CrddLauncherBindingRequest {
  return {
    launcherRealPath: launcher,
    versionControlRoot: root,
    repositoryManifest,
    releaseBinding: null,
    implementationEntryRealPath: implementation,
    pathFlavor: "win32",
    launcherObservation: "regular-file",
    baselineRootObservation: "regular-directory",
    manifestObservation: "regular-file",
    implementationObservation: "regular-file",
    ...overrides,
  };
}

test("binds the official development root to its own implementation", () => {
  const result = resolveCrddCheckerLauncherBinding(request());
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.mode, "development");
  assert.equal(result.baselineRoot, root);
  assert.equal(result.implementationEntry, implementation);
});

test("binds an adopted released baseline without fixing its directory name", () => {
  const adoptedRoot = path.win32.resolve("C:/fixture/project/01_CRDD");
  const result = resolveCrddCheckerLauncherBinding(
    request({
      launcherRealPath: path.win32.join(
        adoptedRoot,
        "template",
        "tools",
        "crdd-check.ts",
      ),
      implementationEntryRealPath: path.win32.join(
        adoptedRoot,
        "40_Develop",
        "checker",
        "src",
        "checker-cli.ts",
      ),
      versionControlRoot: projectRoot,
      repositoryManifest: null,
      releaseBinding: { ...releaseBinding, distributionRoot: adoptedRoot },
    }),
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.mode, "released-baseline");
  assert.equal(result.baselineRoot, adoptedRoot);
});

test("binds a fully qualified UNC development root", () => {
  const uncRoot = "\\\\server\\share\\CRDD";
  const result = resolveCrddCheckerLauncherBinding(
    request({
      launcherRealPath: `${uncRoot}\\template\\tools\\crdd-check.ts`,
      implementationEntryRealPath: `${uncRoot}\\40_Develop\\checker\\src\\checker-cli.ts`,
      versionControlRoot: uncRoot,
    }),
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.baselineRoot, uncRoot);
  assert.equal(result.mode, "development");
});

test("does not select the project implementation outside the baseline root", () => {
  const result = resolveCrddCheckerLauncherBinding(
    request({
      implementationEntryRealPath: path.win32.join(
        projectRoot,
        "40_Develop",
        "checker",
        "src",
        "checker-cli.ts",
      ),
    }),
  );
  assert.deepEqual(result, {
    status: "blocked",
    reason: "implementation_path_invalid",
  });
});

test("rejects each wrong path, identity and boundary at its expected guard", () => {
  const cases: ReadonlyArray<readonly [CrddLauncherBindingRequest, string]> = [
    [
      request({
        launcherRealPath: path.win32.join(projectRoot, "crdd-check.ts"),
      }),
      "launcher_path_unrecognized",
    ],
    [
      request({
        launcherRealPath: path.win32.resolve(
          "C:/fixture/nottemplate/tools/crdd-check.ts",
        ),
      }),
      "launcher_path_unrecognized",
    ],
    [
      request({
        launcherRealPath: path.win32.resolve(
          "C:/fixture/x40_Develop/checker/crdd-check.ts",
        ),
      }),
      "launcher_path_unrecognized",
    ],
    [
      request({ launcherRealPath: "template/tools/crdd-check.ts" }),
      "launcher_path_unrecognized",
    ],
    [
      request({ launcherRealPath: "C:template/tools/crdd-check.ts" }),
      "launcher_path_unrecognized",
    ],
    [
      request({ launcherRealPath: "\\template\\tools\\crdd-check.ts" }),
      "launcher_path_unrecognized",
    ],
    [
      request({ launcherRealPath: "/template/tools/crdd-check.ts" }),
      "launcher_path_unrecognized",
    ],
    [
      request({
        implementationEntryRealPath: "40_Develop/checker/src/checker-cli.ts",
      }),
      "implementation_path_invalid",
    ],
    [
      request({
        implementationEntryRealPath:
          "\\40_Develop\\checker\\src\\checker-cli.ts",
      }),
      "implementation_path_invalid",
    ],
    [request({ versionControlRoot: "." }), "development_identity_invalid"],
    [request({ versionControlRoot: "\\" }), "development_identity_invalid"],
    [
      request({
        versionControlRoot: projectRoot,
        repositoryManifest: null,
        releaseBinding: { ...releaseBinding, distributionRoot: projectRoot },
      }),
      "release_identity_invalid",
    ],
    [
      request({
        versionControlRoot: projectRoot,
        repositoryManifest: null,
        releaseBinding: { ...releaseBinding, distributionRoot: "01_CRDD" },
      }),
      "release_identity_invalid",
    ],
    [
      request({
        versionControlRoot: projectRoot,
        repositoryManifest: null,
        releaseBinding: { ...releaseBinding, distributionRoot: "\\01_CRDD" },
      }),
      "release_identity_invalid",
    ],
    [
      request({
        versionControlRoot: projectRoot,
        repositoryManifest: null,
        releaseBinding: { ...releaseBinding, crddVersion: "0.21" },
      }),
      "release_identity_invalid",
    ],
    [
      request({
        versionControlRoot: projectRoot,
        repositoryManifest: null,
        releaseBinding: {
          ...releaseBinding,
          packageContentRootSha256: "modified",
        },
      }),
      "release_identity_invalid",
    ],
    [
      request({ launcherObservation: "symbolic-or-junction" }),
      "launcher_boundary_invalid",
    ],
    [
      request({ baselineRootObservation: "unobservable" }),
      "baseline_root_boundary_invalid",
    ],
    [request({ manifestObservation: "absent" }), "manifest_boundary_invalid"],
    [
      request({ manifestObservation: "symbolic-or-junction" }),
      "manifest_boundary_invalid",
    ],
    [
      request({ implementationObservation: "unobservable" }),
      "implementation_boundary_invalid",
    ],
  ];

  for (const [item, reason] of cases)
    assert.deepEqual(resolveCrddCheckerLauncherBinding(item), {
      status: "blocked",
      reason,
    });
});

test("keeps POSIX path identity case-sensitive", () => {
  const posixRoot = "/srv/CRDD";
  const result = resolveCrddCheckerLauncherBinding({
    ...request(),
    pathFlavor: "posix",
    launcherRealPath: "/srv/CRDD/template/tools/crdd-check.ts",
    implementationEntryRealPath:
      "/srv/crdd/40_Develop/checker/src/checker-cli.ts",
    versionControlRoot: posixRoot,
  });
  assert.deepEqual(result, {
    status: "blocked",
    reason: "implementation_path_invalid",
  });
});

test("does not let the current directory complete relative identity paths", () => {
  const original = process.cwd();
  const relativeRequest = request({
    launcherRealPath: "template/tools/crdd-check.ts",
    implementationEntryRealPath: "40_Develop/checker/src/checker-cli.ts",
    versionControlRoot: ".",
  });
  try {
    process.chdir(path.dirname(original));
    const fromParent = resolveCrddCheckerLauncherBinding(relativeRequest);
    process.chdir(original);
    const fromRepository = resolveCrddCheckerLauncherBinding(relativeRequest);
    assert.deepEqual(fromParent, {
      status: "blocked",
      reason: "launcher_path_unrecognized",
    });
    assert.deepEqual(fromRepository, fromParent);
  } finally {
    process.chdir(original);
  }
});
