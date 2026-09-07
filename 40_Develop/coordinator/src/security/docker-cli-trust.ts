import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createWindowsDockerCliEnvironment } from "../core/windows-child-environment.ts";

export const DOCKER_CLI_TRUST_CONTRACT = "crdd-coordinator/docker-cli-trust";
export const DOCKER_CLI_TRUST_CONTRACT_REVISION = 1;

export const DOCKER_CLI_ROOT =
  "C:\\Program Files\\Docker\\Docker\\resources\\bin";
export const DOCKER_CLI_EXECUTABLE = `${DOCKER_CLI_ROOT}\\docker.exe`;

const MAXIMUM_DOCKER_CLI_BYTES = 256 * 1024 * 1024;
const AUTHENTICODE_TIMEOUT_MS = 10_000;
const AUTHENTICODE_SUCCESS = "CRDD_DOCKER_AUTHENTICODE_OK";
const DOCKER_PUBLISHER_ORGANIZATION = "Docker Inc";

export type DockerCliTrustSnapshot = Readonly<{
  executablePath: typeof DOCKER_CLI_EXECUTABLE;
  rootIdentity: string;
  executableIdentity: string;
  bytes: number;
  sha256: string;
  publisherOrganization: typeof DOCKER_PUBLISHER_ORGANIZATION;
  trustBasis: "windows_authenticode_valid_docker_inc_publisher";
}>;

function filesystemIdentity(target: string, expected: "file" | "directory") {
  const metadata = fs.lstatSync(target, { bigint: true });
  const expectedType =
    expected === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !expectedType ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_cli_filesystem_identity_invalid");
  }
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

function inspectDockerAuthenticode() {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_cli_authenticode_unavailable");
  const systemRoot = environment.SystemRoot;
  if (typeof systemRoot !== "string" || systemRoot.length === 0)
    throw new Error("docker_cli_authenticode_unavailable");
  const powershell = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  if (
    fs.realpathSync.native(powershell).toLocaleLowerCase("en-US") !==
      powershell.toLocaleLowerCase("en-US") ||
    !fs.lstatSync(powershell).isFile() ||
    fs.lstatSync(powershell).isSymbolicLink()
  ) {
    throw new Error("docker_cli_authenticode_unavailable");
  }
  const script = [
    "$ErrorActionPreference='Stop'",
    `$signature=Get-AuthenticodeSignature -LiteralPath '${DOCKER_CLI_EXECUTABLE.replaceAll("'", "''")}'`,
    "$certificate=$signature.SignerCertificate",
    `if(([string]$signature.Status -ne 'Valid') -or ($null -eq $certificate) -or ([string]$certificate.Subject -notmatch '(?:^|, )O=${DOCKER_PUBLISHER_ORGANIZATION}(?:,|$)')){exit 2}`,
    `Write-Output '${AUTHENTICODE_SUCCESS}'`,
  ].join(";");
  const result = spawnSync(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    {
      cwd: systemRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: AUTHENTICODE_TIMEOUT_MS,
      maxBuffer: 512,
    },
  );
  if (
    result.error ||
    result.status !== 0 ||
    result.signal !== null ||
    result.stdout !== `${AUTHENTICODE_SUCCESS}\r\n` ||
    result.stderr !== ""
  ) {
    throw new Error("docker_cli_authenticode_untrusted");
  }
}

function inspectDockerCliFile() {
  if (
    fs.realpathSync.native(DOCKER_CLI_ROOT) !== DOCKER_CLI_ROOT ||
    fs.realpathSync.native(DOCKER_CLI_EXECUTABLE) !== DOCKER_CLI_EXECUTABLE
  ) {
    throw new Error("docker_cli_path_untrusted");
  }
  const metadata = fs.lstatSync(DOCKER_CLI_EXECUTABLE);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > MAXIMUM_DOCKER_CLI_BYTES
  ) {
    throw new Error("docker_cli_file_untrusted");
  }
  return Object.freeze({
    rootIdentity: filesystemIdentity(DOCKER_CLI_ROOT, "directory"),
    executableIdentity: filesystemIdentity(DOCKER_CLI_EXECUTABLE, "file"),
    bytes: metadata.size,
    sha256: createHash("sha256")
      .update(fs.readFileSync(DOCKER_CLI_EXECUTABLE))
      .digest("hex")
      .toUpperCase(),
  });
}

export function observeTrustedDockerCli(): DockerCliTrustSnapshot {
  if (process.platform !== "win32")
    throw new Error("docker_cli_platform_unsupported");
  const before = inspectDockerCliFile();
  inspectDockerAuthenticode();
  const after = inspectDockerCliFile();
  if (
    before.rootIdentity !== after.rootIdentity ||
    before.executableIdentity !== after.executableIdentity ||
    before.bytes !== after.bytes ||
    before.sha256 !== after.sha256
  ) {
    throw new Error("docker_cli_changed_during_trust_observation");
  }
  return Object.freeze({
    executablePath: DOCKER_CLI_EXECUTABLE,
    ...after,
    publisherOrganization: DOCKER_PUBLISHER_ORGANIZATION,
    trustBasis: "windows_authenticode_valid_docker_inc_publisher",
  });
}

export function verifyTrustedDockerCliSnapshot(
  snapshot: DockerCliTrustSnapshot,
) {
  const current = inspectDockerCliFile();
  if (
    snapshot.executablePath !== DOCKER_CLI_EXECUTABLE ||
    snapshot.publisherOrganization !== DOCKER_PUBLISHER_ORGANIZATION ||
    snapshot.trustBasis !== "windows_authenticode_valid_docker_inc_publisher" ||
    current.rootIdentity !== snapshot.rootIdentity ||
    current.executableIdentity !== snapshot.executableIdentity ||
    current.bytes !== snapshot.bytes ||
    current.sha256 !== snapshot.sha256
  ) {
    throw new Error("docker_cli_replaced");
  }
  return DOCKER_CLI_EXECUTABLE;
}

export function describeDockerCliTrustContract() {
  return Object.freeze({
    contract: DOCKER_CLI_TRUST_CONTRACT,
    contractRevision: DOCKER_CLI_TRUST_CONTRACT_REVISION,
    absolutePath: DOCKER_CLI_EXECUTABLE,
    pathLookupAllowed: false,
    publisherOrganization: DOCKER_PUBLISHER_ORGANIZATION,
    trustBasis: "windows_authenticode_valid_docker_inc_publisher",
    exactVersionRequired: false,
    exactHashRequiredAcrossOperations: false,
    sameIdentityAndHashRequiredWithinOperation: true,
    unknownOrInvalidSignatureEffect: "fail_closed_before_docker_effect",
  });
}
