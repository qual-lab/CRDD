import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  beginReleaseStagingManifestSession,
  describeReleaseStagingManifestContract,
  placeReleaseStagingManifestCandidate,
  ReleaseStagingManifestError,
} from "../scripts/release-staging-manifest.ts";
import {
  signReleaseManifest,
  preflightReleaseManifest,
} from "../scripts/sign-release-manifest.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { createNativeBootstrapPeFixture } from "./native-bootstrap-pe-fixture.ts";

const TEST_PASSPHRASE = "test-only-release-signing-passphrase";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");
const releaseStagingRoot = path.join(
  repositoryRoot,
  ".crdd",
  "release-staging",
);

test("期限なしは明示指定だけを受け、CLIの排他違反とundefinedを秘密入力前に拒否する", () => {
  const options = {
    distributionRoot: repositoryRoot,
    privateKeyPath: path.join(
      repositoryRoot,
      ".crdd",
      "test-key-never-read.pem",
    ),
    passphrase: "test-only-never-read",
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    issuedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: null,
  };
  for (const operation of [signReleaseManifest, preflightReleaseManifest]) {
    assert.throws(
      () => Reflect.apply(operation, undefined, [options]),
      /release_manifest_distribution_root_invalid/u,
    );
    assert.throws(
      () =>
        Reflect.apply(operation, undefined, [
          { ...options, expiresAt: undefined },
        ]),
      /release_manifest_time_invalid/u,
    );
    const missing = { ...options };
    Reflect.deleteProperty(missing, "expiresAt");
    assert.throws(
      () => Reflect.apply(operation, undefined, [missing]),
      /release_manifest_time_invalid/u,
    );
  }
  const args = [
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "--distribution-root",
    options.distributionRoot,
    "--private-key",
    options.privateKeyPath,
    "--crdd-version",
    options.crddVersion,
    "--release-sequence",
    "1",
    "--crdd-commit",
    options.crddCommit,
    "--crdd-tree",
    options.crddTree,
    "--issued-at",
    options.issuedAt,
  ];
  for (const [expiryArguments, reason] of [
    [["--no-expiry"], "release_manifest_distribution_root_invalid"],
    [
      ["--expires-at", "2027-09-01T00:00:00.000Z"],
      "release_manifest_distribution_root_invalid",
    ],
    [[], "release_manifest_arguments_invalid"],
    [["--no-expiry", "--no-expiry"], "release_manifest_arguments_invalid"],
    [
      ["--no-expiry", "--expires-at", "2027-09-01T00:00:00.000Z"],
      "release_manifest_arguments_invalid",
    ],
    [["--expires-at", "null"], "release_manifest_time_invalid"],
    [["--no-expiry", "true"], "release_manifest_arguments_invalid"],
  ] as const) {
    const result = spawnSync(process.execPath, [...args, ...expiryArguments], {
      encoding: "utf8",
      input: "test-only-not-a-release-secret\n",
      shell: false,
      windowsHide: true,
      timeout: 5_000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.error, undefined);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `${reason}\n`);
  }
  assert.equal(fs.existsSync(options.privateKeyPath), false);
});

function uniqueReleaseCandidate(prefix: string) {
  fs.mkdirSync(releaseStagingRoot, { recursive: true });
  const value = path.join(
    releaseStagingRoot,
    `${prefix}-${randomBytes(8).toString("hex")}`,
  );
  fs.mkdirSync(value);
  return value;
}

test("production署名sourceはTrust差替え、検証skipまたはtest hookを持たない", () => {
  const forbiddenNames = [
    "ContractTestTrust",
    "signReleaseManifestForContractTest",
    "skipCommitTreeBinding",
    "skipReleaseIdentityBinding",
    "beforeSignature",
    "afterManifestWrite",
    "expectedSignerSpkiDer",
  ];
  const forbiddenPatterns = [
    /ContractTest/u,
    /ForContractTest/u,
    /skip[A-Z][A-Za-z]+(?:Binding|Validation)/u,
    /(?:before|after)[A-Z][A-Za-z]+(?:Hook|Write|Signature)/u,
  ];
  for (const relativeRoot of ["scripts", "src", "bin"] as const) {
    const files = fs.readdirSync(path.join(coordinatorRoot, relativeRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      for (const identifier of forbiddenNames) {
        assert.equal(
          source.includes(identifier),
          false,
          `${relativeRoot}/${entry.name}: ${identifier}`,
        );
      }
      for (const pattern of forbiddenPatterns) {
        assert.equal(
          pattern.test(source),
          false,
          `${relativeRoot}/${entry.name}: ${pattern.source}`,
        );
      }
    }
  }

  const stagingImporters: string[] = [];
  for (const relativeRoot of ["scripts", "src", "bin"] as const) {
    const files = fs.readdirSync(path.join(coordinatorRoot, relativeRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      if (source.includes('from "./release-staging-manifest.ts"')) {
        stagingImporters.push(
          path
            .relative(coordinatorRoot, path.join(entry.parentPath, entry.name))
            .replaceAll("\\", "/"),
        );
      }
    }
  }
  assert.deepEqual(stagingImporters.sort(), [
    "scripts/sign-release-manifest.ts",
  ]);

  const signerSource = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  assert.equal(signerSource.includes('from "node:child_process"'), false);
  assert.equal(
    /(?:execFile|spawn)Sync\(\s*["']git["']/u.test(signerSource),
    false,
  );
  assert.match(signerSource, /inspectGitCommitTreeCandidate/u);
});

test("SHA-256 CRDD Release Identityはpassphrase利用とFilesystem観測より前に明示拒否する", () => {
  assert.throws(
    () =>
      signReleaseManifest({
        distributionRoot: "fixture-distribution-root-not-read",
        privateKeyPath: "fixture-private-key-not-read",
        passphrase: "fixture-passphrase-not-read",
        crddVersion: "v0.18.0",
        releaseSequence: 1,
        crddCommit: "a".repeat(64),
        crddTree: "b".repeat(64),
        issuedAt: "2026-08-25T00:00:00.000Z",
        expiresAt: "2027-08-25T00:00:00.000Z",
      }),
    /release_manifest_git_object_format_unsupported/u,
  );

  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      "--distribution-root",
      "fixture-distribution-root-not-read",
      "--private-key",
      "fixture-private-key-not-read",
      "--crdd-version",
      "v0.18.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      "a".repeat(64),
      "--crdd-tree",
      "b".repeat(64),
      "--issued-at",
      "2026-08-25T00:00:00.000Z",
      "--expires-at",
      "2027-08-25T00:00:00.000Z",
    ],
    {
      encoding: "utf8",
      input: "",
      shell: false,
      timeout: 2_000,
      windowsHide: true,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "release_manifest_git_object_format_unsupported\n");
});

test("Release公開引数はpassphrase入力とFilesystem観測より前に完全検証する", () => {
  const base = {
    distributionRoot: path.resolve("fixture-distribution-root-not-read"),
    privateKeyPath: path.resolve("fixture-private-key-not-read"),
    passphrase: "fixture-passphrase-not-read",
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    issuedAt: "2026-08-26T02:39:49.000Z",
    expiresAt: "2026-08-27T02:39:49.000Z",
  };
  for (const [override, reason] of [
    [
      { distributionRoot: "fixture-distribution-root-not-read" },
      "release_manifest_distribution_root_invalid",
    ],
    [
      { privateKeyPath: "fixture-private-key-not-read" },
      "release_manifest_private_key_path_invalid",
    ],
    [{ releaseSequence: 0 }, "release_manifest_release_sequence_invalid"],
    [{ crddVersion: "0.18.0" }, "release_manifest_crdd_version_invalid"],
    [{ issuedAt: "2026-08-26T02:39:49Z" }, "release_manifest_time_invalid"],
    [{ issuedAt: "2026-08-26T02:39:49.00Z" }, "release_manifest_time_invalid"],
    [
      { issuedAt: "2026-08-26T02:39:49.000+00:00" },
      "release_manifest_time_invalid",
    ],
    [{ issuedAt: "2026-02-30T00:00:00.000Z" }, "release_manifest_time_invalid"],
    [
      { expiresAt: "2026-08-26T02:39:49.000Z" },
      "release_manifest_validity_window_invalid",
    ],
    [
      { expiresAt: "2026-08-26T02:39:48.999Z" },
      "release_manifest_validity_window_invalid",
    ],
  ] as const) {
    assert.throws(
      () => signReleaseManifest({ ...base, ...override }),
      (error: unknown) => error instanceof Error && error.message === reason,
    );
  }

  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      "--distribution-root",
      path.resolve("fixture-distribution-root-not-read"),
      "--private-key",
      path.resolve("fixture-private-key-not-read"),
      "--crdd-version",
      "v0.18.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      "a".repeat(40),
      "--crdd-tree",
      "b".repeat(40),
      "--issued-at",
      "2026-08-26T02:39:49Z",
      "--expires-at",
      "2026-08-27T02:39:49.000Z",
    ],
    {
      encoding: "utf8",
      input: "passphrase-must-not-be-read\n",
      shell: false,
      timeout: 2_000,
      windowsHide: true,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "release_manifest_time_invalid\n");
});

test("Release stagingの非秘密検査はpassphrase入力より前に完了する", () => {
  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      "--distribution-root",
      path.resolve(coordinatorRoot, "../.."),
      "--private-key",
      path.resolve("fixture-private-key-must-not-be-read"),
      "--crdd-version",
      "v0.18.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      "a".repeat(40),
      "--crdd-tree",
      "b".repeat(40),
      "--issued-at",
      "2026-08-26T02:39:49.000Z",
      "--expires-at",
      "2026-08-27T02:39:49.000Z",
    ],
    {
      encoding: "utf8",
      input: "passphrase-must-not-be-read\n",
      shell: false,
      timeout: 2_000,
      windowsHide: true,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "release_manifest_distribution_root_invalid\n");
});

test("Release署名RootはRepository-localの単一candidate directoryだけを受理する", () => {
  const candidate = uniqueReleaseCandidate("contract-root");
  const outside = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-signing-root-outside-"),
  );
  const arbitraryLocal = path.join(
    repositoryRoot,
    ".crdd",
    "e2e-distributions",
    "contract-root",
  );
  const nested = path.join(candidate, "nested");
  try {
    fs.mkdirSync(arbitraryLocal, { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    for (const distributionRoot of [
      outside,
      repositoryRoot,
      path.join(repositoryRoot, ".crdd"),
      releaseStagingRoot,
      arbitraryLocal,
      nested,
    ]) {
      assert.throws(
        () =>
          signReleaseManifest({
            distributionRoot,
            privateKeyPath: path.resolve("fixture-private-key-not-read"),
            passphrase: "fixture-passphrase-not-read",
            crddVersion: "v0.18.0",
            releaseSequence: 1,
            crddCommit: "a".repeat(40),
            crddTree: "b".repeat(40),
            issuedAt: "2026-08-26T02:39:49.000Z",
            expiresAt: "2026-08-27T02:39:49.000Z",
          }),
        /release_manifest_distribution_root_invalid/u,
      );
    }
  } finally {
    fs.rmSync(candidate, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(arbitraryLocal, { recursive: true, force: true });
  }
});

function ephemeralEnvelopeBytes() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const payload = Buffer.from("CRDD test-only placement envelope", "utf8");
  const signature = sign(null, payload, privateKey).toString("base64url");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const canonical = canonicalizeProvisioningJsonValueCandidate({
    contract: "crdd-test/release-manifest-placement-envelope",
    contractRevision: 1,
    payload: payload.toString("base64url"),
    publicKey: publicKeyDer.toString("base64url"),
    signature,
  });
  assert.equal(canonical.status, "candidate");
  assert.ok("canonicalBytes" in canonical);
  return canonical.canonicalBytes;
}

function placementFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-placement-flow-"));
  const distributionRoot = path.join(parent, "distribution");
  const executablePath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "windows-x64",
    "crdd-platform-access.exe",
  );
  const manifestPath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "coordinator-package-manifest.json",
  );
  const supervisorPath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "windows-x64",
    "coordinator.exe",
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.mkdirSync(path.dirname(supervisorPath), { recursive: true });
  fs.writeFileSync(executablePath, "fixed-test-platform-access-binary");
  fs.writeFileSync(
    supervisorPath,
    createNativeBootstrapPeFixture(
      "64b471129ecaf7520da80865cec614b8c75ea0149582ab08f577ea29c647385a",
    ),
  );
  const observation = beginReleaseStagingManifestSession(distributionRoot);
  assert.ok(observation);
  return {
    parent,
    distributionRoot,
    executablePath,
    supervisorPath,
    manifestPath,
    token: observation.token,
    canonicalBytes: ephemeralEnvelopeBytes(),
  };
}

function withFsyncMutation(
  mutation: (descriptor: number) => void,
  operation: () => void,
) {
  const originalFsyncSync = fs.fsyncSync;
  fs.fsyncSync = ((descriptor: number) => {
    originalFsyncSync(descriptor);
    mutation(descriptor);
  }) as typeof fs.fsyncSync;
  try {
    operation();
  } finally {
    fs.fsyncSync = originalFsyncSync;
  }
}

function assertStagingFailure(
  operation: () => void,
  isEffectExpected: boolean,
  shouldExpectDiscard: boolean,
) {
  try {
    operation();
    assert.fail("release staging failure was required");
  } catch (error) {
    assert.ok(error instanceof ReleaseStagingManifestError);
    assert.equal(error.releaseStagingFilesystemEffectIssued, isEffectExpected);
    assert.equal(error.stagingRootMustBeDiscarded, shouldExpectDiscard);
  }
}

test("両Rust成果物の各単独欠落ではRelease staging sessionを開始しない", () => {
  const cases = ["platform-access", "native-supervisor"] as const;
  for (const missing of cases) {
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-staging-missing-"),
    );
    const distributionRoot = path.join(parent, "distribution");
    const executablePath = path.join(
      distributionRoot,
      "template",
      "tools",
      "coordinator",
      "windows-x64",
      "crdd-platform-access.exe",
    );
    const supervisorPath = path.join(
      distributionRoot,
      "template",
      "tools",
      "coordinator",
      "windows-x64",
      "coordinator.exe",
    );
    try {
      fs.mkdirSync(path.dirname(executablePath), { recursive: true });
      fs.mkdirSync(path.dirname(supervisorPath), { recursive: true });
      if (missing !== "platform-access") {
        fs.writeFileSync(executablePath, "fixed-test-platform-access-binary");
      }
      if (missing !== "native-supervisor") {
        fs.writeFileSync(supervisorPath, createNativeBootstrapPeFixture());
      }
      assert.equal(beginReleaseStagingManifestSession(distributionRoot), null);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }
});

test("supervisor内部Worker結合と実Worker Hashの不一致ではsessionを開始しない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-binding-mismatch-"),
  );
  const distributionRoot = path.join(parent, "distribution");
  const executablePath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "windows-x64",
    "crdd-platform-access.exe",
  );
  const supervisorPath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "windows-x64",
    "coordinator.exe",
  );
  try {
    fs.mkdirSync(path.dirname(executablePath), { recursive: true });
    fs.mkdirSync(path.dirname(supervisorPath), { recursive: true });
    fs.writeFileSync(executablePath, "fixed-test-platform-access-binary");
    fs.writeFileSync(
      supervisorPath,
      createNativeBootstrapPeFixture("2".repeat(64)),
    );
    assert.equal(beginReleaseStagingManifestSession(distributionRoot), null);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("native PE policy不一致ではstaging sessionもFilesystem Effectも開始しない", () => {
  const value = placementFixture();
  try {
    const bytes = fs.readFileSync(value.supervisorPath);
    bytes[0x800] = 0xcb;
    fs.writeFileSync(value.supervisorPath, bytes);
    assert.equal(
      beginReleaseStagingManifestSession(value.distributionRoot),
      null,
    );
    assert.equal(fs.existsSync(value.manifestPath), false);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("署名Authorityを持たない配置helperは同一fdのcanonical byteを再確認する", () => {
  const value = placementFixture();
  try {
    const result = placeReleaseStagingManifestCandidate(
      value.token,
      value.canonicalBytes,
    );
    assert.equal(result.status, "placed");
    assert.equal(result.releaseStagingFilesystemEffectIssued, true);
    assert.equal(result.stagingRootMustBeDiscarded, false);
    assert.equal(result.runtimeFilesystemEffectIssued, false);
    assert.equal(result.provisioningFilesystemEffectIssued, false);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.deepEqual(describeReleaseStagingManifestContract(), {
      contract: "crdd-coordinator/release-staging-manifest",
      contractRevision: 2,
      manifestRelativePath:
        "template/tools/coordinator/coordinator-package-manifest.json",
      releaseStagingManifestWrite: "implemented_explicit_signing_effect",
      releaseStagingFilesystemEffectIssuedOnSuccess: true,
      failedAfterCreateRequiresStagingRootDiscard: true,
      runtimeFilesystemEffectIssued: false,
      provisioningFilesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      productionRuntimeImportAllowed: false,
    });
    assert.deepEqual(fs.readFileSync(value.manifestPath), value.canonicalBytes);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("manifestの同長上書き、短縮および追記をcreatedへ流用しない", {
  concurrency: false,
}, () => {
  const mutations = [
    (descriptor: number, bytes: Buffer) => {
      fs.writeSync(
        descriptor,
        Buffer.alloc(bytes.length, 0x78),
        0,
        bytes.length,
        0,
      );
    },
    (descriptor: number, bytes: Buffer) => {
      fs.ftruncateSync(descriptor, bytes.length - 1);
    },
    (descriptor: number, bytes: Buffer) => {
      fs.writeSync(descriptor, Buffer.from("x"), 0, 1, bytes.length);
    },
  ];
  for (const mutate of mutations) {
    const value = placementFixture();
    try {
      assertStagingFailure(
        () =>
          withFsyncMutation(
            (descriptor) => mutate(descriptor, value.canonicalBytes),
            () =>
              void placeReleaseStagingManifestCandidate(
                value.token,
                value.canonicalBytes,
              ),
          ),
        true,
        true,
      );
      assert.equal(fs.existsSync(value.manifestPath), true);
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

test("manifest Path、Release DirectoryまたはRust成果物群の配置後差を拒否して自動削除しない", {
  concurrency: false,
}, () => {
  const cases = [
    (value: ReturnType<typeof placementFixture>) => {
      fs.renameSync(value.manifestPath, `${value.manifestPath}.original`);
      fs.writeFileSync(value.manifestPath, value.canonicalBytes);
    },
    (value: ReturnType<typeof placementFixture>) => {
      const releaseDirectory = path.dirname(value.manifestPath);
      fs.renameSync(releaseDirectory, `${releaseDirectory}-original`);
      fs.mkdirSync(releaseDirectory);
    },
    (value: ReturnType<typeof placementFixture>) => {
      fs.writeFileSync(value.executablePath, "replacement");
    },
    (value: ReturnType<typeof placementFixture>) => {
      fs.writeFileSync(value.supervisorPath, "replacement");
    },
  ];
  for (const mutate of cases) {
    const value = placementFixture();
    try {
      assertStagingFailure(
        () =>
          withFsyncMutation(
            () => mutate(value),
            () =>
              void placeReleaseStagingManifestCandidate(
                value.token,
                value.canonicalBytes,
              ),
          ),
        true,
        true,
      );
      assert.equal(
        fs.existsSync(value.manifestPath) ||
          fs.existsSync(`${value.manifestPath}.original`) ||
          fs.existsSync(
            path.join(
              `${path.dirname(value.manifestPath)}-original`,
              path.basename(value.manifestPath),
            ),
          ),
        true,
      );
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

test("偽造tokenと既存manifestをRelease staging成功へ流用しない", () => {
  const canonicalBytes = ephemeralEnvelopeBytes();
  assertStagingFailure(
    () => void placeReleaseStagingManifestCandidate({}, canonicalBytes),
    false,
    false,
  );

  const value = placementFixture();
  try {
    fs.writeFileSync(value.manifestPath, canonicalBytes);
    assertStagingFailure(
      () =>
        void placeReleaseStagingManifestCandidate(value.token, canonicalBytes),
      false,
      true,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("固定公開鍵に対応しない秘密鍵ではmanifestを生成しない", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-manifest-sign-"));
  const sourceRoot = path.join(parent, "source");
  const distributionRoot = path.join(
    sourceRoot,
    ".crdd",
    "release-staging",
    "test-sign",
  );
  const keyDirectory = path.join(parent, "key");
  try {
    // Preserve the production source-relative key exclusion boundary. Both the
    // isolated tool distribution and its external test key stay in the fixture.
    for (const directory of ["scripts", "src", "runtime"]) {
      fs.cpSync(
        path.join(coordinatorRoot, directory),
        path.join(sourceRoot, "40_Develop", "coordinator", directory),
        {
          recursive: true,
          filter: (source) => {
            assert.equal(fs.lstatSync(source).isSymbolicLink(), false);
            return true;
          },
        },
      );
    }
    const signerPath = path.join(
      sourceRoot,
      "40_Develop",
      "coordinator",
      "scripts",
      "sign-release-manifest.ts",
    );
    assert.deepEqual(
      fs.readFileSync(signerPath),
      fs.readFileSync(
        path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      ),
    );
    const implementation: typeof import("../scripts/sign-release-manifest.ts") =
      await import(pathToFileURL(signerPath).href);
    fs.mkdirSync(
      path.join(
        distributionRoot,
        "template",
        "tools",
        "coordinator",
        "windows-x64",
      ),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        distributionRoot,
        "template",
        "tools",
        "coordinator",
        "windows-x64",
        "crdd-platform-access.exe",
      ),
      Buffer.from("not-a-real-executable", "ascii"),
    );
    fs.mkdirSync(
      path.join(
        distributionRoot,
        "template",
        "tools",
        "coordinator",
        "windows-x64",
      ),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        distributionRoot,
        "template",
        "tools",
        "coordinator",
        "windows-x64",
        "coordinator.exe",
      ),
      createNativeBootstrapPeFixture(
        "181974aa7e6fd7533c5976b03e88a623a0644f6073398fef0d45c28e3e52c843",
      ),
    );
    fs.mkdirSync(
      path.join(distributionRoot, "40_Develop", "coordinator", "src"),
      {
        recursive: true,
      },
    );
    fs.writeFileSync(
      path.join(distributionRoot, "40_Develop", "coordinator", "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(
        distributionRoot,
        "40_Develop",
        "coordinator",
        "src",
        "fixture.ts",
      ),
      "export const FIXTURE = true;\n",
    );
    const { privateKey } = generateKeyPairSync("ed25519");
    fs.mkdirSync(keyDirectory);
    fs.writeFileSync(
      path.join(keyDirectory, "crdd-release-v1-private.pem"),
      privateKey.export({
        type: "pkcs8",
        format: "pem",
        cipher: "aes-256-cbc",
        passphrase: TEST_PASSPHRASE,
      }),
      { flag: "wx" },
    );
    assert.throws(
      () =>
        implementation.signReleaseManifest({
          distributionRoot,
          privateKeyPath: path.join(
            keyDirectory,
            "crdd-release-v1-private.pem",
          ),
          passphrase: TEST_PASSPHRASE,
          crddVersion: "v0.18.0",
          releaseSequence: 18,
          crddCommit: "0".repeat(40),
          crddTree: "1".repeat(40),
          issuedAt: "2026-08-16T00:00:00.000Z",
          expiresAt: "2027-08-16T00:00:00.000Z",
        }),
      /release_manifest_private_key_not_pinned/u,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          distributionRoot,
          "template",
          "tools",
          "coordinator",
          "coordinator-package-manifest.json",
        ),
      ),
      false,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
    assert.equal(fs.existsSync(parent), false);
  }
});
