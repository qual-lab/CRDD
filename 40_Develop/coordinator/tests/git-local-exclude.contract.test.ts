import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import {
  applyGitLocalExcludeCandidate,
  compileGitLocalExcludeCandidate,
  describeGitLocalExcludeContract,
} from "../src/security/git-local-exclude.ts";
import { assertPresent, errorCode } from "./test-support.ts";

// Test-only failure observations. No host path, contents or relaxed checks.
function observeExcludeOperation<T>(operation: () => T) {
  const events: unknown[] = [];
  const names = [
    "lstatSync",
    "fstatSync",
    "openSync",
    "writeSync",
    "fsyncSync",
    "closeSync",
    "renameSync",
  ] as const;
  const originals = names.map((name) => [name, fs[name]] as const);
  for (const [name, original] of originals) {
    Reflect.set(fs, name, (...args: unknown[]) => {
      const target =
        typeof args[0] === "string" ? path.basename(args[0]) : args[0];
      const event: Record<string, unknown> = { operation: name, target };
      try {
        const result: unknown = Reflect.apply(original, fs, args);
        if (
          (name === "lstatSync" || name === "fstatSync") &&
          result &&
          typeof result === "object"
        ) {
          for (const field of [
            "ino",
            "size",
            "birthtimeNs",
            "mtimeNs",
            "ctimeNs",
          ]) {
            const value: unknown = Reflect.get(result, field);
            event[field] = typeof value === "bigint" ? String(value) : value;
          }
        }
        return result;
      } catch (error) {
        event.errorCode = errorCode(error);
        throw error;
      } finally {
        events.push(event);
        if (events.length > 100) events.shift();
      }
    });
  }
  try {
    return { result: operation(), diagnostics: events };
  } finally {
    for (const [name, original] of originals) Reflect.set(fs, name, original);
  }
}

function temporaryRoot(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-local-exclude-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeGitDirectory(target: string) {
  fs.mkdirSync(path.join(target, "info"), { recursive: true });
  fs.writeFileSync(path.join(target, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(target, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
}

function normalRepository(t: TestContext) {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  return repositoryRoot;
}

function linkedRepository(t: TestContext) {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "linked");
  const commonGitDirectory = path.join(parent, "main.git");
  const gitDirectory = path.join(commonGitDirectory, "worktrees", "linked");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(commonGitDirectory);
  fs.mkdirSync(gitDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(gitDirectory, "HEAD"),
    "ref: refs/heads/linked\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(repositoryRoot, ".git"),
    `gitdir: ${gitDirectory}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(gitDirectory, "commondir"), "../..\n", "utf8");
  return repositoryRoot;
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

function existingInput(
  repositoryRoot: string,
  overrides: Record<string, unknown> = {},
) {
  const value = input(repositoryRoot, overrides);
  const root =
    value.cliOverride ??
    value.environmentOverride ??
    path.join(repositoryRoot, ".crdd-runtime");
  fs.mkdirSync(root, { recursive: true });
  return value;
}

test("Repository既定Rootの完全一致local exclude候補を作る", (t) => {
  const repositoryRoot = normalRepository(t);
  const result = compileGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(result.status, "candidate");
  assertPresent(result.plan);
  assert.equal(
    result.reason,
    "git_local_exclude_write_and_verification_required",
  );
  assert.deepEqual(result.plan, {
    excludeRequired: true,
    excludeEntry: "/.crdd-runtime/",
    trackedGitignoreModificationAllowed: false,
  });
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("通常Repositoryのcustom Rootをroot相対かつGit pattern安全なentryにする", (t) => {
  const repositoryRoot = normalRepository(t);
  const customRoot = path.join(repositoryRoot, "runtime [x] #!");
  const result = compileGitLocalExcludeCandidate(
    input(repositoryRoot, { cliOverride: customRoot }),
  );
  assert.equal(result.status, "candidate");
  assertPresent(result.plan);
  assert.equal(result.plan.excludeEntry, "/runtime\\ \\[x\\]\\ \\#\\!/");
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("Repository外overrideはGit exclude候補へ昇格させない", (t) => {
  const repositoryRoot = normalRepository(t);
  const externalRoot = path.resolve(repositoryRoot, "..", "external-runtime");
  const result = compileGitLocalExcludeCandidate(
    input(repositoryRoot, { environmentOverride: externalRoot }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "runtime_root_external_write_authorization_required",
  );
  assert.equal(result.plan, null);
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("enable候補でない入力とRepository root自体を拒否する", (t) => {
  const repositoryRoot = normalRepository(t);
  assert.equal(
    compileGitLocalExcludeCandidate(
      input(repositoryRoot, { activationIntent: null }),
    ).reason,
    "runtime_root_enable_candidate_required",
  );
  assert.equal(
    compileGitLocalExcludeCandidate(
      input(repositoryRoot, { cliOverride: repositoryRoot }),
    ).reason,
    "runtime_root_must_not_equal_repository_root",
  );
  assert.equal(
    compileGitLocalExcludeCandidate(
      input(repositoryRoot, {
        cliOverride: path.join(repositoryRoot, ".git", "runtime"),
      }),
    ).reason,
    "runtime_root_git_metadata_overlap",
  );
});

test("linked worktreeは既定Rootだけを共有exclude候補にする", (t) => {
  const repositoryRoot = linkedRepository(t);
  const defaultResult = compileGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(defaultResult.status, "candidate");
  assertPresent(defaultResult.plan);
  assert.equal(defaultResult.plan.excludeEntry, "/.crdd-runtime/");

  const cliDefaultResult = compileGitLocalExcludeCandidate(
    input(repositoryRoot, {
      cliOverride: path.join(repositoryRoot, ".crdd-runtime"),
    }),
  );
  assert.equal(cliDefaultResult.status, "candidate");
  assertPresent(cliDefaultResult.plan);
  assert.equal(cliDefaultResult.plan.excludeEntry, "/.crdd-runtime/");
  assert.equal(
    JSON.stringify(cliDefaultResult).includes(repositoryRoot),
    false,
  );

  const environmentDefaultResult = compileGitLocalExcludeCandidate(
    input(repositoryRoot, {
      environmentOverride: path.join(repositoryRoot, ".crdd-runtime"),
    }),
  );
  assert.equal(environmentDefaultResult.status, "candidate");
  assertPresent(environmentDefaultResult.plan);
  assert.equal(environmentDefaultResult.plan.excludeEntry, "/.crdd-runtime/");
  assert.equal(
    JSON.stringify(environmentDefaultResult).includes(repositoryRoot),
    false,
  );

  const customResult = compileGitLocalExcludeCandidate(
    input(repositoryRoot, {
      cliOverride: path.join(repositoryRoot, "custom-runtime"),
    }),
  );
  assert.equal(customResult.status, "blocked");
  assert.equal(
    customResult.reason,
    "linked_worktree_repository_custom_root_rejected",
  );

  const externalResult = compileGitLocalExcludeCandidate(
    input(repositoryRoot, {
      cliOverride: path.join(path.dirname(repositoryRoot), "external-runtime"),
    }),
  );
  assert.equal(externalResult.status, "blocked");
  assert.equal(
    externalResult.reason,
    "runtime_root_external_write_authorization_required",
  );
  assert.equal(externalResult.plan, null);
});

test("Repository内RootはGit layout候補を再確認する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  const result = compileGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "repository_git_layout_candidate_required");
});

test("accessorとProxyを実行せずblockedへ閉じる", (t) => {
  let getterCalls = 0;
  const repositoryRoot = normalRepository(t);
  const accessor = input(repositoryRoot);
  Object.defineProperty(accessor, "repositoryRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return repositoryRoot;
    },
  });
  assert.equal(compileGitLocalExcludeCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const target = input(repositoryRoot);
  const proxy = new Proxy(target, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(target);
    },
  });
  assert.equal(compileGitLocalExcludeCandidate(proxy).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("local exclude契約はmetadata書込み候補とactivation未実装を分離する", () => {
  const contract = describeGitLocalExcludeContract();
  assert.equal(contract.repositoryContainedRootBackend, ".git/info/exclude");
  assert.equal(contract.repositoryExternalRootRequiresExclude, false);
  assert.equal(contract.trackedGitignoreModificationAllowed, false);
  assert.equal(contract.exactRootRelativeEntryRequired, true);
  assert.equal(contract.idempotentWriteRequired, true);
  assert.equal(contract.postWriteVerificationRequired, true);
  assert.equal(contract.writeFailureBlocksActivation, true);
  assert.equal(contract.gitIgnoreIsSecurityBoundary, false);
  assert.equal(
    contract.repositoryGitDirectoryResolution,
    "implemented_candidate",
  );
  assert.equal(contract.linkedWorktreeDefaultRootAllowed, true);
  assert.equal(
    contract.linkedWorktreeRepositoryContainedCustomRootAllowed,
    false,
  );
  assert.equal(contract.linkedWorktreeExternalOverrideAllowed, false);
  assert.equal(
    contract.repositoryExternalOverride,
    "blocked_until_runtime_owned_human_authorization_is_implemented",
  );
  assert.equal(contract.metadataWriteIntegration, "implemented_candidate");
  assert.equal(
    contract.runtimeRootPathIdentityPrePostVerification,
    "implemented_candidate_initial_snapshot_binding",
  );
  assert.equal(contract.runtimeRootIdentityDescriptorTransfer, false);
  assert.equal(contract.metadataWriteActivationIntegration, "not_implemented");
  assert.equal(contract.maximumExcludeBytes, 131072);
  assert.equal(contract.existingGitInfoDirectoryRequired, true);
  assert.equal(contract.runtimeCapabilityIssued, false);
});

test("Adapter候補は既存内容を保ち完全一致entryを冪等更新する", (t) => {
  const repositoryRoot = normalRepository(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.writeFileSync(exclude, "# local rules\n/build/\n", "utf8");
  const observed = observeExcludeOperation(() =>
    applyGitLocalExcludeCandidate(existingInput(repositoryRoot)),
  );
  const first = observed.result;
  assert.equal(first.status, "candidate", JSON.stringify(observed));
  assert.equal(first.gitMetadataWriteIssued, true);
  assert.equal(first.gitMetadataWriteVerified, true);
  assert.equal(
    fs.readFileSync(exclude, "utf8"),
    "# local rules\n/build/\n/.crdd-runtime/\n",
  );
  const second = applyGitLocalExcludeCandidate(existingInput(repositoryRoot));
  assert.equal(second.status, "candidate");
  assert.equal(second.gitMetadataWriteIssued, false);
  assert.equal(second.gitMetadataWriteVerified, true);
  assert.equal(JSON.stringify(first).includes(repositoryRoot), false);
});

for (const alteration of ["timestamp", "mode"] as const) {
  test(`自己write後close前の${alteration}を初期identityと権限へ照合する`, (t) => {
    const repositoryRoot = normalRepository(t);
    const lock = path.join(
      repositoryRoot,
      ".git",
      "info",
      ".crdd-runtime-exclude.lock",
    );
    const originalOpen = fs.openSync;
    const originalFsync = fs.fsyncSync;
    const originalLstat = fs.lstatSync;
    let ownedDescriptor: number | null = null;
    let isArmed = false;
    let hasAltered = false;
    Reflect.set(fs, "openSync", (target: unknown, ...args: unknown[]) => {
      const descriptor: number = Reflect.apply(originalOpen, fs, [
        target,
        ...args,
      ]);
      if (
        target === lock &&
        typeof args[0] === "number" &&
        (args[0] & fs.constants.O_WRONLY) !== 0
      )
        ownedDescriptor = descriptor;
      return descriptor;
    });
    fs.fsyncSync = (descriptor) => {
      originalFsync.call(fs, descriptor);
      if (descriptor !== ownedDescriptor) return;
      isArmed = true;
      if (alteration === "mode") {
        const before = originalLstat.call(fs, lock, { bigint: true });
        fs.chmodSync(lock, 0o444);
        assert.notEqual(
          originalLstat.call(fs, lock, { bigint: true }).mode,
          before.mode,
        );
        hasAltered = true;
      }
    };
    Reflect.set(fs, "lstatSync", (target: unknown, ...args: unknown[]) => {
      if (
        target === lock &&
        isArmed &&
        !hasAltered &&
        alteration === "timestamp"
      ) {
        hasAltered = true;
        const before = originalLstat.call(fs, lock, { bigint: true });
        fs.utimesSync(
          lock,
          new Date(1_700_000_000_000),
          new Date(1_700_000_000_000),
        );
        const after = originalLstat.call(fs, lock, { bigint: true });
        assert.equal(after.ino, before.ino);
        assert.notEqual(after.mtimeNs, before.mtimeNs);
      }
      return Reflect.apply(originalLstat, fs, [target, ...args]);
    });
    let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
    try {
      result = applyGitLocalExcludeCandidate(existingInput(repositoryRoot));
    } finally {
      fs.openSync = originalOpen;
      fs.fsyncSync = originalFsync;
      Reflect.set(fs, "lstatSync", originalLstat);
      if (alteration === "mode" && fs.existsSync(lock))
        fs.chmodSync(lock, 0o600);
    }
    assert.equal(hasAltered, true);
    assert.equal(
      result.status,
      alteration === "timestamp" ? "candidate" : "blocked",
      JSON.stringify(result),
    );
    assert.equal(result.gitMetadataWriteVerified, alteration === "timestamp");
    if (alteration === "mode")
      assert.equal(result.gitMetadataWriteIssued, false);
  });
}

test("自己書込みlockのclose時刻更新はidentityと内容を維持して確定する", (t) => {
  const repositoryRoot = normalRepository(t);
  const lock = path.join(
    repositoryRoot,
    ".git",
    "info",
    ".crdd-runtime-exclude.lock",
  );
  const originalOpen = fs.openSync;
  const originalClose = fs.closeSync;
  let ownedDescriptor: number | null = null;
  let hasUpdated = false;
  Reflect.set(fs, "openSync", (target: unknown, ...args: unknown[]) => {
    const descriptor: number = Reflect.apply(originalOpen, fs, [
      target,
      ...args,
    ]);
    if (
      target === lock &&
      typeof args[0] === "number" &&
      (args[0] & fs.constants.O_WRONLY) !== 0
    )
      ownedDescriptor = descriptor;
    return descriptor;
  });
  fs.closeSync = (descriptor) => {
    originalClose.call(fs, descriptor);
    if (descriptor === ownedDescriptor && !hasUpdated) {
      hasUpdated = true;
      ownedDescriptor = null;
      const before = fs.lstatSync(lock, { bigint: true });
      fs.utimesSync(
        lock,
        new Date(1_700_000_000_000),
        new Date(1_700_000_000_000),
      );
      const after = fs.lstatSync(lock, { bigint: true });
      assert.equal(after.ino, before.ino);
      assert.equal(after.birthtimeNs, before.birthtimeNs);
      assert.notEqual(after.mtimeNs, before.mtimeNs);
    }
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(existingInput(repositoryRoot));
  } finally {
    fs.openSync = originalOpen;
    fs.closeSync = originalClose;
  }
  assert.equal(hasUpdated, true);
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.equal(result.gitMetadataWriteVerified, true);
  assert.equal(
    fs.readFileSync(
      path.join(repositoryRoot, ".git", "info", "exclude"),
      "utf8",
    ),
    "/.crdd-runtime/\n",
  );
  assert.equal(fs.existsSync(lock), false);
});

for (const alteration of [
  "same-content-replacement",
  "same-size-content",
  "mode",
  "close-failure",
] as const) {
  test(`close境界の${alteration}を自己書込みの正常確定へ取り込まない`, (t) => {
    const repositoryRoot = normalRepository(t);
    const lock = path.join(
      repositoryRoot,
      ".git",
      "info",
      ".crdd-runtime-exclude.lock",
    );
    const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
    const initial = "# retained\n";
    fs.writeFileSync(exclude, initial, "utf8");
    const originalOpen = fs.openSync;
    const originalClose = fs.closeSync;
    let ownedDescriptor: number | null = null;
    let hasAltered = false;
    Reflect.set(fs, "openSync", (target: unknown, ...args: unknown[]) => {
      const descriptor: number = Reflect.apply(originalOpen, fs, [
        target,
        ...args,
      ]);
      if (
        target === lock &&
        typeof args[0] === "number" &&
        (args[0] & fs.constants.O_WRONLY) !== 0
      )
        ownedDescriptor = descriptor;
      return descriptor;
    });
    fs.closeSync = (descriptor) => {
      originalClose.call(fs, descriptor);
      if (descriptor !== ownedDescriptor || hasAltered) return;
      hasAltered = true;
      ownedDescriptor = null;
      if (alteration === "close-failure")
        throw new Error("fixed-close-failure");
      const before = fs.lstatSync(lock, { bigint: true });
      const bytes = fs.readFileSync(lock);
      if (alteration === "same-content-replacement") {
        fs.renameSync(lock, `${lock}.original`);
        fs.writeFileSync(lock, bytes, { flag: "wx" });
        assert.notEqual(fs.lstatSync(lock, { bigint: true }).ino, before.ino);
      } else if (alteration === "same-size-content") {
        bytes[0] = (bytes[0] ?? 0) ^ 1;
        fs.writeFileSync(lock, bytes);
        assert.equal(fs.lstatSync(lock, { bigint: true }).size, before.size);
      } else {
        fs.chmodSync(lock, 0o444);
        assert.notEqual(fs.lstatSync(lock, { bigint: true }).mode, before.mode);
      }
    };
    let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
    try {
      result = applyGitLocalExcludeCandidate(existingInput(repositoryRoot));
    } finally {
      fs.openSync = originalOpen;
      fs.closeSync = originalClose;
      if (alteration === "mode" && fs.existsSync(lock))
        fs.chmodSync(lock, 0o600);
    }
    assert.equal(hasAltered, true);
    assert.equal(result.status, "blocked");
    assert.equal(result.gitMetadataWriteIssued, false);
    assert.equal(result.gitMetadataWriteVerified, false);
    assert.equal(fs.readFileSync(exclude, "utf8"), initial);
    if (alteration === "same-content-replacement") {
      // Foreign replacement must not be removed as the owned lock.
      assert.equal(fs.existsSync(lock), true);
      assert.equal(fs.existsSync(`${lock}.original`), true);
    }
  });
}

test("空または未作成excludeを作成し外部overrideはmetadata処置前に拒否する", (t) => {
  const repositoryRoot = normalRepository(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.writeFileSync(exclude, "");
  assert.equal(
    applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
    "candidate",
  );
  assert.equal(fs.readFileSync(exclude, "utf8"), "/.crdd-runtime/\n");
  fs.unlinkSync(exclude);
  assert.equal(
    applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
    "candidate",
  );
  const beforeEntries = fs.readdirSync(
    path.join(repositoryRoot, ".git", "info"),
  );
  const external = applyGitLocalExcludeCandidate(
    existingInput(repositoryRoot, {
      cliOverride: path.join(path.dirname(repositoryRoot), "external-runtime"),
    }),
  );
  assert.equal(external.status, "blocked");
  assert.equal(
    external.reason,
    "runtime_root_external_write_authorization_required",
  );
  assert.equal(external.gitMetadataWriteIssued, false);
  assert.deepEqual(
    fs.readdirSync(path.join(repositoryRoot, ".git", "info")),
    beforeEntries,
  );
});

test("既存lock、過大exclude、linkをblockedへ閉じる", (t) => {
  const repositoryRoot = normalRepository(t);
  const gitInfoDirectory = path.join(repositoryRoot, ".git", "info");
  const exclude = path.join(gitInfoDirectory, "exclude");
  const lock = path.join(gitInfoDirectory, ".crdd-runtime-exclude.lock");
  fs.writeFileSync(lock, "unknown", "utf8");
  assert.equal(
    applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(lock, "utf8"), "unknown");
  fs.unlinkSync(lock);
  fs.writeFileSync(exclude, "x".repeat(131073), "utf8");
  assert.equal(
    applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
    "blocked",
  );
  fs.unlinkSync(exclude);
  const target = path.join(gitInfoDirectory, "target");
  fs.writeFileSync(target, "safe\n", "utf8");
  try {
    fs.symlinkSync(target, exclude, "file");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(errorCode(error) ?? "")) return;
    throw error;
  }
  assert.equal(
    applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
    "blocked",
  );
});

test("書込み中の変化とclose失敗を成功へ流用しない", (t) => {
  const repositoryRoot = normalRepository(t);
  const lock = path.join(
    repositoryRoot,
    ".git",
    "info",
    ".crdd-runtime-exclude.lock",
  );
  const originalWrite = fs.writeSync;
  let hasChanged = false;
  Reflect.set(fs, "writeSync", (descriptor: number, ...args: unknown[]) => {
    const written = Reflect.apply(originalWrite, fs, [descriptor, ...args]);
    if (!hasChanged) {
      hasChanged = true;
      fs.ftruncateSync(descriptor, Math.max(0, written - 1));
    }
    return written;
  });
  try {
    assert.equal(
      applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs, "writeSync", originalWrite);
  }
  assert.equal(fs.existsSync(lock), false);
  const originalClose = fs.closeSync;
  let hasFailed = false;
  fs.closeSync = (descriptor) => {
    originalClose.call(fs, descriptor);
    if (!hasFailed) {
      hasFailed = true;
      throw new Error("fixture-close-failure");
    }
  };
  try {
    assert.equal(
      applyGitLocalExcludeCandidate(existingInput(repositoryRoot)).status,
      "blocked",
    );
  } finally {
    fs.closeSync = originalClose;
  }
  assert.equal(hasFailed, true);
  assert.equal(fs.existsSync(lock), false);
});

test("置換後の検証失敗は書込み済みblockedとして返す", (t) => {
  const repositoryRoot = normalRepository(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  const originalRename = fs.renameSync;
  let hasReplaced = false;
  fs.renameSync = (source, destination) => {
    originalRename.call(fs, source, destination);
    if (!hasReplaced) {
      hasReplaced = true;
      fs.writeFileSync(destination, "/different-entry/\n", "utf8");
    }
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(existingInput(repositoryRoot));
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, true);
  assert.equal(result.gitMetadataWriteVerified, false);
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
  assert.equal(fs.readFileSync(exclude, "utf8"), "/different-entry/\n");
});

test("linked worktreeはcommon excludeだけを更新する", (t) => {
  const repositoryRoot = linkedRepository(t);
  const result = applyGitLocalExcludeCandidate(existingInput(repositoryRoot));
  assert.equal(result.status, "candidate");
  const gitDirectory = fs
    .readFileSync(path.join(repositoryRoot, ".git"), "utf8")
    .slice("gitdir: ".length)
    .trim();
  const commonDirectory = path.resolve(gitDirectory, "../..");
  assert.equal(
    fs.readFileSync(path.join(commonDirectory, "info", "exclude"), "utf8"),
    "/.crdd-runtime/\n",
  );
  assert.equal(
    fs.existsSync(path.join(gitDirectory, "info", "exclude")),
    false,
  );
});

test("Path Identityが書込み直前に失われた場合はmetadataを書かない", (t) => {
  const repositoryRoot = normalRepository(t);
  const runtimeRoot = path.join(repositoryRoot, ".crdd-runtime");
  const originalRoot = `${runtimeRoot}-original`;
  const outside = temporaryRoot(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.mkdirSync(runtimeRoot);
  const originalOpen = fs.openSync;
  let hasReplaced = false;
  fs.openSync = (target, ...rest) => {
    if (
      !hasReplaced &&
      target === path.join(repositoryRoot, ".git", "config")
    ) {
      hasReplaced = true;
      fs.renameSync(runtimeRoot, originalRoot);
      try {
        fs.symlinkSync(
          outside,
          runtimeRoot,
          process.platform === "win32" ? "junction" : "dir",
        );
      } catch (error) {
        fs.renameSync(originalRoot, runtimeRoot);
        if (["EPERM", "EACCES", "ENOTSUP"].includes(errorCode(error) ?? ""))
          return originalOpen.call(fs, target, ...rest);
        throw error;
      }
    }
    return originalOpen.call(fs, target, ...rest);
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(input(repositoryRoot));
  } finally {
    fs.openSync = originalOpen;
  }
  if (!hasReplaced || !fs.lstatSync(runtimeRoot).isSymbolicLink()) return;
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(fs.existsSync(exclude), false);
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("initial Root identity is not rebased to a valid same-name replacement", (t) => {
  const repositoryRoot = normalRepository(t);
  const runtimeRoot = path.join(repositoryRoot, ".crdd-runtime");
  const originalRoot = `${runtimeRoot}-original`;
  const replacementRoot = `${runtimeRoot}-replacement`;
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.mkdirSync(runtimeRoot);
  fs.mkdirSync(replacementRoot);
  const originalOpen = fs.openSync;
  let hasReplaced = false;
  fs.openSync = (target, ...rest) => {
    if (
      !hasReplaced &&
      target === path.join(repositoryRoot, ".git", "config")
    ) {
      hasReplaced = true;
      fs.renameSync(runtimeRoot, originalRoot);
      fs.renameSync(replacementRoot, runtimeRoot);
    }
    return originalOpen.call(fs, target, ...rest);
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(input(repositoryRoot));
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(hasReplaced, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(fs.existsSync(exclude), false);
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("initial parent identity is not rebased to a valid same-name replacement", (t) => {
  const repositoryRoot = normalRepository(t);
  const runtimeParent = path.join(repositoryRoot, "runtime-parent");
  const runtimeRoot = path.join(runtimeParent, "root");
  const originalParent = `${runtimeParent}-original`;
  const replacementParent = `${runtimeParent}-replacement`;
  const replacementRoot = path.join(replacementParent, "root");
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(replacementRoot, { recursive: true });
  const originalOpen = fs.openSync;
  let hasReplaced = false;
  fs.openSync = (target, ...rest) => {
    if (
      !hasReplaced &&
      target === path.join(repositoryRoot, ".git", "config")
    ) {
      hasReplaced = true;
      fs.renameSync(runtimeParent, originalParent);
      fs.renameSync(replacementParent, runtimeParent);
    }
    return originalOpen.call(fs, target, ...rest);
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(
      input(repositoryRoot, { cliOverride: runtimeRoot }),
    );
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(hasReplaced, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(fs.existsSync(exclude), false);
});

test("initial Repository identity is not rebased to a valid same-name replacement", (t) => {
  const fixtureRoot = temporaryRoot(t);
  const repositoryRoot = path.join(fixtureRoot, "repository");
  const originalRepository = path.join(fixtureRoot, "repository-original");
  const replacementRepository = path.join(
    fixtureRoot,
    "repository-replacement",
  );
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(replacementRepository);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  makeGitDirectory(path.join(replacementRepository, ".git"));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  fs.mkdirSync(path.join(replacementRepository, ".crdd-runtime"));
  const originalOpen = fs.openSync;
  let hasReplaced = false;
  fs.openSync = (target, ...rest) => {
    if (
      !hasReplaced &&
      target === path.join(repositoryRoot, ".git", "config")
    ) {
      hasReplaced = true;
      fs.renameSync(repositoryRoot, originalRepository);
      fs.renameSync(replacementRepository, repositoryRoot);
    }
    return originalOpen.call(fs, target, ...rest);
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(input(repositoryRoot));
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(hasReplaced, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(
    fs.existsSync(path.join(repositoryRoot, ".git", "info", "exclude")),
    false,
  );
});

test("metadata書込み後のPath Identity喪失は書込み済みblockedとして返す", (t) => {
  const repositoryRoot = normalRepository(t);
  const runtimeRoot = path.join(repositoryRoot, ".crdd-runtime");
  const originalRoot = `${runtimeRoot}-original`;
  const replacementRoot = `${runtimeRoot}-replacement`;
  fs.mkdirSync(runtimeRoot);
  fs.mkdirSync(replacementRoot);
  const originalRename = fs.renameSync;
  const originalRealpath = fs.realpathSync.native;
  let isArmed = false;
  let hasReplaced = false;
  fs.renameSync = (source, destination) => {
    originalRename.call(fs, source, destination);
    if (destination === path.join(repositoryRoot, ".git", "info", "exclude"))
      isArmed = true;
  };
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    const result = Reflect.apply(originalRealpath, fs.realpathSync, [target]);
    if (isArmed && !hasReplaced && target === runtimeRoot) {
      hasReplaced = true;
      originalRename.call(fs, runtimeRoot, originalRoot);
      originalRename.call(fs, replacementRoot, runtimeRoot);
    }
    return result;
  });
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(input(repositoryRoot));
  } finally {
    fs.renameSync = originalRename;
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "runtime_root_path_identity_reverification_failed",
  );
  assert.equal(result.gitMetadataWriteIssued, true);
  assert.equal(result.gitMetadataWriteVerified, false);
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("post-write parent replacement preserves the issued-write fact", (t) => {
  const repositoryRoot = normalRepository(t);
  const runtimeParent = path.join(repositoryRoot, "runtime-parent");
  const runtimeRoot = path.join(runtimeParent, "root");
  const originalParent = `${runtimeParent}-original`;
  const replacementParent = `${runtimeParent}-replacement`;
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(path.join(replacementParent, "root"), { recursive: true });
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  const originalRename = fs.renameSync;
  let hasReplaced = false;
  fs.renameSync = (source, destination) => {
    originalRename.call(fs, source, destination);
    if (!hasReplaced && destination === exclude) {
      hasReplaced = true;
      originalRename.call(fs, runtimeParent, originalParent);
      originalRename.call(fs, replacementParent, runtimeParent);
    }
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(
      input(repositoryRoot, { cliOverride: runtimeRoot }),
    );
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(hasReplaced, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, true);
  assert.equal(result.gitMetadataWriteVerified, false);
});

test("post-write Repository replacement preserves the issued-write fact", (t) => {
  const fixtureRoot = temporaryRoot(t);
  const repositoryRoot = path.join(fixtureRoot, "repository");
  const originalRepository = path.join(fixtureRoot, "repository-original");
  const replacementRepository = path.join(
    fixtureRoot,
    "repository-replacement",
  );
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(replacementRepository);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  makeGitDirectory(path.join(replacementRepository, ".git"));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  fs.mkdirSync(path.join(replacementRepository, ".crdd-runtime"));
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  const originalRename = fs.renameSync;
  let hasReplaced = false;
  fs.renameSync = (source, destination) => {
    originalRename.call(fs, source, destination);
    if (!hasReplaced && destination === exclude) {
      hasReplaced = true;
      originalRename.call(fs, repositoryRoot, originalRepository);
      originalRename.call(fs, replacementRepository, repositoryRoot);
    }
  };
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  let diagnostics: unknown;
  try {
    const observed = observeExcludeOperation(() =>
      applyGitLocalExcludeCandidate(input(repositoryRoot)),
    );
    result = observed.result;
    diagnostics = observed;
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(hasReplaced, true, JSON.stringify(diagnostics));
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, true);
  assert.equal(result.gitMetadataWriteVerified, false);
});

test("外部overrideはPath Identity前提も満たせない場合を安全に拒否する", (t) => {
  const repositoryRoot = normalRepository(t);
  const externalRoot = path.join(
    path.dirname(repositoryRoot),
    "missing-external-runtime",
  );
  const result = applyGitLocalExcludeCandidate(
    input(repositoryRoot, {
      environmentOverride: externalRoot,
    }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, false);
});

test("external override remains bound to the initial Root identity", (t) => {
  const fixtureRoot = temporaryRoot(t);
  const repositoryRoot = path.join(fixtureRoot, "repository");
  const externalRoot = path.join(fixtureRoot, "external-runtime");
  const originalExternal = path.join(fixtureRoot, "external-runtime-original");
  const replacementExternal = path.join(
    fixtureRoot,
    "external-runtime-replacement",
  );
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  fs.mkdirSync(externalRoot);
  fs.mkdirSync(replacementExternal);
  const originalRealpath = fs.realpathSync.native;
  let rootReads = 0;
  let hasReplaced = false;
  Reflect.set(fs.realpathSync, "native", (target: unknown) => {
    if (target === externalRoot) {
      rootReads += 1;
      if (rootReads === 3) {
        hasReplaced = true;
        fs.renameSync(externalRoot, originalExternal);
        fs.renameSync(replacementExternal, externalRoot);
      }
    }
    return Reflect.apply(originalRealpath, fs.realpathSync, [target]);
  });
  let result: ReturnType<typeof applyGitLocalExcludeCandidate>;
  try {
    result = applyGitLocalExcludeCandidate(
      input(repositoryRoot, { environmentOverride: externalRoot }),
    );
  } finally {
    Reflect.set(fs.realpathSync, "native", originalRealpath);
  }
  assert.equal(hasReplaced, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(JSON.stringify(result).includes(externalRoot), false);
});
