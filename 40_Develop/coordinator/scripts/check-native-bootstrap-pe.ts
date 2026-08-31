import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildNativeBootstrap,
  inspectNativeBootstrapBuildBoundary,
  NATIVE_BOOTSTRAP_TARGET,
  NATIVE_BOOTSTRAP_TOOLCHAIN,
} from "./build-native-bootstrap.ts";
import {
  beginNativeProvisionSupervisorArtifactSigningObservation,
  NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH,
} from "../src/security/native-provision-supervisor-release.ts";
import {
  inspectNativeBootstrapPe,
  NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
} from "../src/security/native-bootstrap-pe-inspector.ts";
import {
  readStableBoundedFileSnapshot,
  sameStableFileIdentity,
} from "../src/security/bounded-file-snapshot.ts";
import { pathToFileURL } from "node:url";

const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const crateRoot = path.resolve(coordinatorRoot, "..", "platform-access");
const runRoot = path.join(
  crateRoot,
  "target",
  `native bootstrap pe ${process.pid} ${randomBytes(8).toString("hex")}`,
);
const expectedProvision = Buffer.from(
  '{"contract":"crdd-coordinator/native-provision-supervisor-result","contractRevision":2,"status":"blocked","reason":"native_provision_fixed_release_layout_invalid","observationAttempted":false,"workerSpawnAttempts":0,"processEffectIssued":false,"helperProcessSpawned":false,"helperProcessResumed":false,"helperExchangeCompleted":false,"processTreeTerminationConfirmed":false,"manualRecoveryRequired":false,"filesystemEffectIssued":false,"networkEffectIssued":false,"runtimeAuthorityConferred":false,"runtimeCapabilityIssued":false}\n',
);
const expectedInvalid = Buffer.from(
  '{"contract":"crdd-coordinator/native-provision-supervisor-result","contractRevision":2,"status":"blocked","reason":"native_provision_supervisor_arguments_invalid","observationAttempted":false,"workerSpawnAttempts":0,"processEffectIssued":false,"helperProcessSpawned":false,"helperProcessResumed":false,"helperExchangeCompleted":false,"processTreeTerminationConfirmed":false,"manualRecoveryRequired":false,"filesystemEffectIssued":false,"networkEffectIssued":false,"runtimeAuthorityConferred":false,"runtimeCapabilityIssued":false}\n',
);

function fail(reason: string): never {
  throw new Error(`native_bootstrap_pe_invalid:${reason}`);
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function executeBootstrap(
  executable: string,
  commandArguments: readonly string[],
) {
  return spawnSync(executable, [...commandArguments], {
    encoding: "buffer",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assertCliResult(
  executable: string,
  commandArguments: readonly string[],
  expectedOutput: Buffer,
) {
  const result = executeBootstrap(executable, commandArguments);
  if (
    result.error ||
    result.status !== 2 ||
    result.stderr.length !== 0 ||
    !result.stdout.equals(expectedOutput)
  )
    fail(`cli:${commandArguments.join("_") || "missing"}`);
}

export function nativeBootstrapEffectReport() {
  return Object.freeze({
    reportedResult: Object.freeze({
      observationAttempted: false,
      workerSpawnAttempts: 0,
      processEffectIssued: false,
      helperProcessSpawned: false,
      helperProcessResumed: false,
      helperExchangeCompleted: false,
      processTreeTerminationConfirmed: false,
      manualRecoveryRequired: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    }),
    staticPeDirectNetworkImports: 0,
    bootstrapProcessNetworkEffect: "not_verified",
    dependencyNetwork: "prohibited_by_cargo_frozen",
  });
}

export function inspectNativeBootstrapPeArtifact() {
  const buildBoundary = inspectNativeBootstrapBuildBoundary();
  try {
    const firstExecutable = buildNativeBootstrap(
      path.join(runRoot, "build one"),
    );
    const secondExecutable = buildNativeBootstrap(
      path.join(runRoot, "build two"),
    );
    const firstSnapshot = readStableBoundedFileSnapshot(
      firstExecutable,
      NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
    );
    const secondSnapshot = readStableBoundedFileSnapshot(
      secondExecutable,
      NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
    );
    const firstBytes = firstSnapshot.bytes;
    const secondBytes = secondSnapshot.bytes;
    const firstWorker = readStableBoundedFileSnapshot(
      path.join(path.dirname(firstExecutable), "crdd-platform-access.exe"),
      NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
    );
    const secondWorker = readStableBoundedFileSnapshot(
      path.join(path.dirname(secondExecutable), "crdd-platform-access.exe"),
      NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
    );
    const artifactSha256 = sha256(firstBytes);
    if (!firstBytes.equals(secondBytes)) fail("reproducible_build");
    if (!firstWorker.bytes.equals(secondWorker.bytes))
      fail("reproducible_worker_build");
    const inspection = inspectNativeBootstrapPe(firstBytes);
    if (inspection.status !== "accepted") fail(`pe:${inspection.reason}`);

    assertCliResult(firstExecutable, ["provision"], expectedProvision);
    for (const commandArguments of [
      [],
      ["doctor"],
      ['"provision"'],
      ["provision", "extra"],
      ["PROVISION"],
    ])
      assertCliResult(firstExecutable, commandArguments, expectedInvalid);
    const afterSnapshot = readStableBoundedFileSnapshot(
      firstExecutable,
      NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
    );
    if (
      !sameStableFileIdentity(firstSnapshot.identity, afterSnapshot.identity) ||
      sha256(afterSnapshot.bytes) !== artifactSha256
    )
      fail("cli_artifact_changed");

    const distributionRoot = path.join(runRoot, "distribution");
    const stagedExecutable = path.join(
      distributionRoot,
      ...NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH.split("/"),
    );
    fs.mkdirSync(path.dirname(stagedExecutable), { recursive: true });
    fs.copyFileSync(
      firstExecutable,
      stagedExecutable,
      fs.constants.COPYFILE_EXCL,
    );
    const signingObservation =
      beginNativeProvisionSupervisorArtifactSigningObservation(
        distributionRoot,
      );
    if (
      !signingObservation ||
      signingObservation.artifact.sha256 !== artifactSha256 ||
      signingObservation.artifact.byteLength !== firstBytes.length
    )
      fail("signing_observation_binding");

    return Object.freeze({
      toolchain: NATIVE_BOOTSTRAP_TOOLCHAIN,
      target: NATIVE_BOOTSTRAP_TARGET,
      buildBoundary,
      reproducibleBuilds: Object.freeze({
        count: 2,
        byteIdentical: true,
        sha256: artifactSha256,
        byteLength: firstBytes.length,
        workerSha256: sha256(firstWorker.bytes),
        workerByteLength: firstWorker.bytes.length,
      }),
      pe: inspection,
      signingObservation: Object.freeze({
        sameByteHash: true,
        entrypointContractRevision:
          signingObservation.artifact.entrypointContractRevision,
      }),
      inspectedBootstrap: Object.freeze({
        cli: Object.freeze({
          provision: "exact_blocked",
          invalidCases: 5,
          exitCode: 2,
          stderrBytes: 0,
        }),
        stableFileIdentityBeforeAfterExecution: true,
        effectEvidence: nativeBootstrapEffectReport(),
      }),
      verificationRun: Object.freeze({
        workerProcessEffectIssued: false,
        operationalFilesystemEffectIssued: false,
        harnessFilesystemEffectIssued: true,
        bootstrapProcessNetworkEffect: "not_verified",
        dependencyNetwork: "prohibited_by_cargo_frozen",
        loadedImageBinding:
          "not_required_by_coordinator_runtime_1_0_minimum_trust_boundary",
        stdoutWriteFailure: "not_verified",
        partialWrite: "not_verified",
        panicPath: "not_verified",
      }),
    });
  } finally {
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
}

const entryArgument = process.argv[1];
if (
  entryArgument &&
  pathToFileURL(path.resolve(entryArgument)).href === import.meta.url
)
  process.stdout.write(
    `${JSON.stringify(inspectNativeBootstrapPeArtifact(), null, 2)}\n`,
  );
