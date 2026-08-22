import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildNativeBootstrap,
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

const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const crateRoot = path.resolve(coordinatorRoot, "..", "platform-access");
const runRoot = path.join(
  crateRoot,
  "target",
  `native bootstrap pe ${process.pid} ${randomBytes(8).toString("hex")}`,
);
const expectedProvision = Buffer.from(
  '{"contract":"crdd-coordinator/native-provision-supervisor-result","contractRevision":1,"status":"blocked","reason":"native_provision_supervisor_release_binding_not_implemented","observationAttempted":false,"workerSpawnAttempts":0,"processEffectIssued":false,"helperProcessSpawned":false,"filesystemEffectIssued":false,"networkEffectIssued":false,"runtimeAuthorityConferred":false,"runtimeCapabilityIssued":false}\n',
);
const expectedInvalid = Buffer.from(
  '{"contract":"crdd-coordinator/native-provision-supervisor-result","contractRevision":1,"status":"blocked","reason":"native_provision_supervisor_arguments_invalid","observationAttempted":false,"workerSpawnAttempts":0,"processEffectIssued":false,"helperProcessSpawned":false,"filesystemEffectIssued":false,"networkEffectIssued":false,"runtimeAuthorityConferred":false,"runtimeCapabilityIssued":false}\n',
);

function fail(reason: string): never {
  throw new Error(`native_bootstrap_pe_invalid:${reason}`);
}

function artifactIdentity(file: string) {
  const metadata = fs.lstatSync(file, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0n ||
    metadata.size > BigInt(NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES) ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    fail("artifact_identity");
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

function sameIdentity(
  left: ReturnType<typeof artifactIdentity>,
  right: ReturnType<typeof artifactIdentity>,
) {
  return Reflect.ownKeys(left).every(
    (key) =>
      left[key as keyof typeof left] === right[key as keyof typeof right],
  );
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

try {
  const firstExecutable = buildNativeBootstrap(path.join(runRoot, "build one"));
  const secondExecutable = buildNativeBootstrap(
    path.join(runRoot, "build two"),
  );
  const firstBytes = fs.readFileSync(firstExecutable);
  const secondBytes = fs.readFileSync(secondExecutable);
  const artifactSha256 = sha256(firstBytes);
  if (!firstBytes.equals(secondBytes)) fail("reproducible_build");
  const inspection = inspectNativeBootstrapPe(firstBytes);
  if (inspection.status !== "accepted") fail(`pe:${inspection.reason}`);

  const before = artifactIdentity(firstExecutable);
  assertCliResult(firstExecutable, ["provision"], expectedProvision);
  for (const commandArguments of [
    [],
    ["doctor"],
    ['"provision"'],
    ["provision", "extra"],
    ["PROVISION"],
  ])
    assertCliResult(firstExecutable, commandArguments, expectedInvalid);
  const after = artifactIdentity(firstExecutable);
  const afterBytes = fs.readFileSync(firstExecutable);
  if (!sameIdentity(before, after) || sha256(afterBytes) !== artifactSha256)
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
    beginNativeProvisionSupervisorArtifactSigningObservation(distributionRoot);
  if (
    !signingObservation ||
    signingObservation.artifact.sha256 !== artifactSha256 ||
    signingObservation.artifact.byteLength !== firstBytes.length
  )
    fail("signing_observation_binding");

  process.stdout.write(
    `${JSON.stringify(
      {
        toolchain: NATIVE_BOOTSTRAP_TOOLCHAIN,
        target: NATIVE_BOOTSTRAP_TARGET,
        reproducibleBuilds: Object.freeze({
          count: 2,
          byteIdentical: true,
          sha256: artifactSha256,
          byteLength: firstBytes.length,
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
          workerSpawnAttempts: 0,
          processEffectIssued: false,
          helperProcessSpawned: false,
          filesystemEffectIssued: false,
          networkEffectIssued: false,
          runtimeAuthorityConferred: false,
          runtimeCapabilityIssued: false,
        }),
        verificationRun: Object.freeze({
          processEffectIssued: true,
          filesystemEffectIssued: true,
          dependencyNetwork: "prohibited_by_cargo_frozen",
          loadedImageBinding: "not_verified",
          stdoutWriteFailure: "not_verified",
          partialWrite: "not_verified",
          panicPath: "not_verified",
        }),
      },
      null,
      2,
    )}\n`,
  );
} finally {
  fs.rmSync(runRoot, { recursive: true, force: true });
}
