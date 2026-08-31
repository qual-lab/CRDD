import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import * as runtimeRootPathIdentityModule from "../src/security/runtime-root-path-identity.ts";
import {
  applyGitLocalExcludeWithInitialRootSnapshotCandidate,
  describeRuntimeRootPathIdentityContract,
  inspectPosixRuntimeRootModePrecheckCandidate,
  inspectRuntimeRootPathIdentityCandidate,
} from "../src/security/runtime-root-path-identity.ts";
import { assertPresent, errorCode } from "./test-support.ts";

function temporaryDirectory(t: TestContext, prefix = "crdd-root-path-") {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  return target;
}

function input(
  repositoryRoot: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    repositoryRoot,
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request",
    ...overrides,
  };
}

function bigintRequested(options: unknown): boolean {
  return (
    options !== null &&
    typeof options === "object" &&
    Reflect.get(options, "bigint") === true
  );
}

test("Path Identity module does not expose a generic session, descriptor, token, or callback API", () => {
  assert.deepEqual(Object.keys(runtimeRootPathIdentityModule).sort(), [
    "RUNTIME_ROOT_PATH_IDENTITY_CONTRACT",
    "RUNTIME_ROOT_PATH_IDENTITY_CONTRACT_REVISION",
    "applyGitLocalExcludeWithInitialRootSnapshotCandidate",
    "describeRuntimeRootPathIdentityContract",
    "inspectPosixRuntimeRootModePrecheckCandidate",
    "inspectRuntimeRootPathIdentityCandidate",
  ]);
});

test("POSIX Runtime Root precheck入口はFilesystem分類前に入力とPathへ触れずblockedに保つ", () => {
  let trapCalls = 0;
  const raw = new Proxy(
    {},
    {
      ownKeys() {
        trapCalls += 1;
        throw new Error("must not inspect input");
      },
      getOwnPropertyDescriptor() {
        trapCalls += 1;
        throw new Error("must not inspect input");
      },
      get() {
        trapCalls += 1;
        throw new Error("must not inspect input");
      },
    },
  );
  const result = inspectPosixRuntimeRootModePrecheckCandidate(raw);
  assert.equal(result.status, "blocked");
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.summary, null);
  assert.equal(trapCalls, 0);
  if (process.platform === "win32") {
    assert.equal(
      result.reason,
      "posix_runtime_root_mode_precheck_platform_unsupported",
    );
  } else {
    assert.equal(
      result.reason,
      "posix_runtime_root_filesystem_class_verification_required",
    );
  }
});

test("Repository既定RootのFilesystem object候補をPath非出力で確認する", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const result = inspectRuntimeRootPathIdentityCandidate(input(repositoryRoot));
  assert.equal(result.status, "candidate");
  assertPresent(result.summary);
  assert.equal(result.summary.source, "repository_default");
  assert.equal(result.summary.location, "repository_default_location");
  assert.equal(
    result.summary.pathObjectIdentityVerification,
    "implemented_candidate",
  );
  assert.equal(result.summary.ownerAclVerification, "not_implemented");
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("CLI内部customを分類し、外部overrideは人間承認Capabilityなしで拒否する", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const internal = path.join(repositoryRoot, "runtime-custom");
  fs.mkdirSync(internal);
  const internalResult = inspectRuntimeRootPathIdentityCandidate(
    input(repositoryRoot, {
      cliOverride: internal,
      environmentOverride: path.join(repositoryRoot, "unused"),
    }),
  );
  assert.equal(internalResult.status, "candidate");
  assertPresent(internalResult.summary);
  assert.equal(internalResult.summary.source, "cli_override");
  assert.equal(internalResult.summary.location, "repository_internal_custom");

  const external = temporaryDirectory(t, "crdd-external-root-");
  const externalResult = inspectRuntimeRootPathIdentityCandidate(
    input(repositoryRoot, {
      environmentOverride: external,
    }),
  );
  assert.equal(externalResult.status, "blocked");
  assert.equal(
    externalResult.reason,
    "runtime_root_external_write_authorization_required",
  );
  assert.equal(externalResult.summary, null);
  assert.equal(externalResult.absolutePathReported, false);
  assert.equal(externalResult.filesystemIdentityReported, false);
  assert.equal(externalResult.runtimeCapabilityIssued, false);
});

test("外部overrideはGit exclude不要候補へ昇格させない", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const external = temporaryDirectory(t, "crdd-external-root-");
  const result = applyGitLocalExcludeWithInitialRootSnapshotCandidate(
    input(repositoryRoot, { cliOverride: external }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "runtime_root_external_write_authorization_required",
  );
  assert.equal(result.plan, null);
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(result.gitMetadataWriteVerified, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("CLIで既定Root同値を明示しても選択入口と実体位置を分離する", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const root = path.join(repositoryRoot, ".crdd-runtime");
  fs.mkdirSync(root);
  const result = inspectRuntimeRootPathIdentityCandidate(
    input(repositoryRoot, {
      cliOverride: root,
      environmentOverride: path.join(repositoryRoot, "unused"),
    }),
  );
  assert.equal(result.status, "candidate");
  assertPresent(result.summary);
  assert.equal(result.summary.source, "cli_override");
  assert.equal(result.summary.location, "repository_default_location");
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("Rootまたはparent欠落とRepository root同値をblockedへ閉じる", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(input(repositoryRoot)).status,
    "blocked",
  );
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(
      input(repositoryRoot, {
        cliOverride: path.join(repositoryRoot, "missing-parent", "root"),
      }),
    ).status,
    "blocked",
  );
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(
      input(repositoryRoot, {
        cliOverride: repositoryRoot,
      }),
    ).status,
    "blocked",
  );
});

test("Repositoryを内包する直接parentまたは上位祖先を外部Rootにしない", (t) => {
  const container = temporaryDirectory(t);
  const upper = path.join(container, "upper");
  const repositoryRoot = path.join(upper, "repository");
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"), { recursive: true });
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(
      input(repositoryRoot, {
        cliOverride: upper,
      }),
    ).status,
    "blocked",
  );
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(
      input(repositoryRoot, {
        cliOverride: container,
      }),
    ).status,
    "blocked",
  );
});

test("Root linkとlexical／real containment差をblockedへ閉じる", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const outside = temporaryDirectory(t, "crdd-linked-root-");
  const linked = path.join(repositoryRoot, ".crdd-runtime");
  try {
    fs.symlinkSync(outside, linked, "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(errorCode(error) ?? "")) return;
    throw error;
  }
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(input(repositoryRoot)).status,
    "blocked",
  );
});

test("lexical disjointからreal Root包含へ変わるalias差をblockedへ閉じる", (t) => {
  const container = temporaryDirectory(t);
  const realRoot = path.join(container, "ancestor");
  const repositoryRoot = path.join(realRoot, "repository");
  const lexicalRoot = path.join(container, "external");
  fs.mkdirSync(repositoryRoot, { recursive: true });
  fs.mkdirSync(lexicalRoot);
  const lexicalIdentity = fs.lstatSync(lexicalRoot, { bigint: true });
  const originalLstat = fs.lstatSync;
  const originalRealpath = fs.realpathSync.native;
  Reflect.set(fs, "lstatSync", (target: unknown, options: unknown) => {
    if (target === realRoot && bigintRequested(options)) return lexicalIdentity;
    return Reflect.apply(originalLstat, fs, [target, options]);
  });
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    if (target === lexicalRoot) return realRoot;
    return Reflect.apply(originalRealpath, fs.realpathSync, [target]);
  });
  try {
    const result = inspectRuntimeRootPathIdentityCandidate(
      input(repositoryRoot, {
        cliOverride: lexicalRoot,
      }),
    );
    assert.equal(result.status, "blocked");
    assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
  } finally {
    Reflect.set(fs, "lstatSync", originalLstat);
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
});

test("lexical Root包含からreal disjointへ変わるalias差をblockedへ閉じる", (t) => {
  const container = temporaryDirectory(t);
  const lexicalRoot = path.join(container, "ancestor");
  const repositoryRoot = path.join(lexicalRoot, "repository");
  const realRoot = path.join(container, "external");
  fs.mkdirSync(repositoryRoot, { recursive: true });
  fs.mkdirSync(realRoot);
  const lexicalIdentity = fs.lstatSync(lexicalRoot, { bigint: true });
  const originalLstat = fs.lstatSync;
  const originalRealpath = fs.realpathSync.native;
  Reflect.set(fs, "lstatSync", (target: unknown, options: unknown) => {
    if (target === realRoot && bigintRequested(options)) return lexicalIdentity;
    return Reflect.apply(originalLstat, fs, [target, options]);
  });
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    if (target === lexicalRoot) return realRoot;
    return Reflect.apply(originalRealpath, fs.realpathSync, [target]);
  });
  try {
    const result = inspectRuntimeRootPathIdentityCandidate(
      input(repositoryRoot, {
        cliOverride: lexicalRoot,
      }),
    );
    assert.equal(result.status, "blocked");
    assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
  } finally {
    Reflect.set(fs, "lstatSync", originalLstat);
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
});

test("検査中のRoot replacementをcandidateへ流用しない", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const root = path.join(repositoryRoot, ".crdd-runtime");
  fs.mkdirSync(root);
  const replacement = path.join(repositoryRoot, "replacement");
  fs.mkdirSync(replacement);
  const originalRealpath = fs.realpathSync.native;
  let hasReplaced = false;
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    const result = Reflect.apply(originalRealpath, fs.realpathSync, [target]);
    if (!hasReplaced && target === root) {
      hasReplaced = true;
      fs.renameSync(root, `${root}-old`);
      fs.renameSync(replacement, root);
    }
    return result;
  });
  try {
    assert.equal(
      inspectRuntimeRootPathIdentityCandidate(input(repositoryRoot)).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
});

test("検査中のparent replacementをcandidateへ流用しない", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const parent = path.join(repositoryRoot, "runtime-parent");
  const root = path.join(parent, "root");
  fs.mkdirSync(root, { recursive: true });
  const replacement = path.join(repositoryRoot, "replacement-parent");
  fs.mkdirSync(path.join(replacement, "root"), { recursive: true });
  const originalRealpath = fs.realpathSync.native;
  let hasReplaced = false;
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    const result = Reflect.apply(originalRealpath, fs.realpathSync, [target]);
    if (!hasReplaced && target === parent) {
      hasReplaced = true;
      fs.renameSync(parent, `${parent}-old`);
      fs.renameSync(replacement, parent);
    }
    return result;
  });
  try {
    assert.equal(
      inspectRuntimeRootPathIdentityCandidate(
        input(repositoryRoot, {
          cliOverride: root,
        }),
      ).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
});

test("検査中のRepository replacementをcandidateへ流用しない", (t) => {
  const container = temporaryDirectory(t);
  const repositoryRoot = path.join(container, "repository");
  const oldRepository = path.join(container, "repository-old");
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"), { recursive: true });
  const originalRealpath = fs.realpathSync.native;
  let hasReplaced = false;
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    const result = Reflect.apply(originalRealpath, fs.realpathSync, [target]);
    if (!hasReplaced && target === repositoryRoot) {
      hasReplaced = true;
      fs.renameSync(repositoryRoot, oldRepository);
      fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"), {
        recursive: true,
      });
    }
    return result;
  });
  try {
    assert.equal(
      inspectRuntimeRootPathIdentityCandidate(input(repositoryRoot)).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
});

test("安定したFilesystem identityを取得できないFSはfail closedにする", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  const root = path.join(repositoryRoot, ".crdd-runtime");
  fs.mkdirSync(root);
  const originalLstat = fs.lstatSync;
  Reflect.set(fs, "lstatSync", (target: unknown, options: unknown) => {
    const metadata = Reflect.apply(originalLstat, fs, [target, options]);
    if (target !== root || !bigintRequested(options)) return metadata;
    return {
      isDirectory: () => metadata.isDirectory(),
      isSymbolicLink: () => metadata.isSymbolicLink(),
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeNs: 0n,
      mode: metadata.mode,
      size: metadata.size,
      mtimeNs: metadata.mtimeNs,
      ctimeNs: metadata.ctimeNs,
    };
  });
  try {
    assert.equal(
      inspectRuntimeRootPathIdentityCandidate(input(repositoryRoot)).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs, "lstatSync", originalLstat);
  }
});

test("accessorとProxyを実行せずblockedへ閉じる", (t) => {
  const repositoryRoot = temporaryDirectory(t);
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  let getterCalls = 0;
  const accessor = input(repositoryRoot);
  Object.defineProperty(accessor, "repositoryRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return repositoryRoot;
    },
  });
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const plain = input(repositoryRoot);
  const proxy = new Proxy(plain, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(plain);
    },
  });
  assert.equal(
    inspectRuntimeRootPathIdentityCandidate(proxy).status,
    "blocked",
  );
  assert.equal(proxyCalls, 0);
});

test("Path Identity Coreは作成・権限・activation・Capabilityを成立させない", () => {
  const contract = describeRuntimeRootPathIdentityContract();
  assert.equal(contract.existingRootRequired, true);
  assert.equal(contract.rootCreationIssued, false);
  assert.equal(contract.rootDeletionIssued, false);
  assert.equal(
    contract.pathObjectIdentityVerification,
    "implemented_candidate",
  );
  assert.equal(
    contract.realpathContainmentVerification,
    "implemented_candidate",
  );
  assert.equal(
    contract.rootProtectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(
    contract.posixRuntimeRootPrecheckEntry,
    "implemented_fail_closed",
  );
  assert.equal(contract.posixRuntimeRootModeObservation, "not_implemented");
  assert.equal(contract.filesystemClassVerification, "not_implemented");
  assert.equal(contract.posixAclVerification, "not_implemented");
  assert.equal(contract.runtimePrincipalBinding, "not_implemented");
  assert.equal(
    contract.windowsAccessObservationCore,
    "implemented_candidate_component_only",
  );
  assert.equal(
    contract.windowsBinaryReleaseIdentityBinding,
    "implemented_candidate_signed_manifest",
  );
  assert.equal(
    contract.windowsProcessInvocation,
    "signed_appcontainer_runtime_probe_and_etw_network_nonfire_verified",
  );
  assert.equal(
    contract.windowsDaclAdapter,
    "not_implemented_observation_mapping_required",
  );
  assert.equal(contract.ownerAclVerification, "not_implemented");
  assert.equal(contract.fullParentChainVerification, "not_implemented");
  assert.equal(
    contract.localExcludeIntegration,
    "implemented_candidate_initial_snapshot_binding",
  );
  assert.equal(
    contract.repositoryExternalOverride,
    "blocked_until_runtime_owned_human_authorization_is_implemented",
  );
  assert.equal(contract.activationIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});
