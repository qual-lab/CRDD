import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const ROOT_IDENTITY_OBSERVATION_CONTRACT =
  "crdd-coordinator/root-identity-observation";
export const ROOT_PROTECTION_OBSERVATION_CONTRACT =
  "crdd-coordinator/root-protection-observation";
export const ROOT_OBSERVATION_CONTRACT_REVISION = 1;
export const ROOT_IDENTITY_OBSERVATION_DOMAIN =
  "CRDD\0ROOT-IDENTITY-OBSERVATION\0V1\0";
export const ROOT_PROTECTION_OBSERVATION_DOMAIN =
  "CRDD\0ROOT-PROTECTION-OBSERVATION\0V1\0";

const rootIdentityDomain = Buffer.from(
  ROOT_IDENTITY_OBSERVATION_DOMAIN,
  "ascii",
);
const rootProtectionDomain = Buffer.from(
  ROOT_PROTECTION_OBSERVATION_DOMAIN,
  "ascii",
);
const ROOT_ROLES = new Set(["runtime", "authority"]);
const OBSERVATION_KEYS = new Set([
  "allOwnersTrusted",
  "entityCount",
  "filesystemClass",
  "objectBirthtimeNanoseconds",
  "objectDeviceId",
  "objectFileId",
  "otherWriteAceCount",
  "reparsePointCount",
  "rootDaclProtected",
  "rootRole",
  "runtimeDenyAceCount",
  "runtimePrincipalSid",
  "runtimeReadExecuteEntityCount",
  "runtimeRootInheritanceRuleCount",
  "runtimeWriteEntityCount",
]);
const MAXIMUM_ENTITIES = 2_049;
const POWERSHELL_TIMEOUT_MILLISECONDS = 30_000;
const POWERSHELL_OUTPUT_BYTES = 64 * 1_024;
const WINDOWS_ROOT = /^[A-Za-z]:\\Windows$/u;
const WINDOWS_SID = /^S-1-(?:[0-9]+-){1,14}[0-9]+$/u;
const DECIMAL_IDENTITY = /^[1-9][0-9]{0,39}$/u;
const POWERSHELL_SCRIPT = `
$ErrorActionPreference = 'Stop'
$root = [Environment]::GetEnvironmentVariable('CRDD_ROOT_OBSERVATION_PATH', 'Process')
$rootRole = [Environment]::GetEnvironmentVariable('CRDD_ROOT_OBSERVATION_ROLE', 'Process')
if ([string]::IsNullOrWhiteSpace($root)) { throw 'root_missing' }
if ($rootRole -ne 'runtime' -and $rootRole -ne 'authority') { throw 'role_invalid' }
$runtimeSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$runtimeIdentity = [Security.Principal.SecurityIdentifier]::new($runtimeSid)
$trusted = @('S-1-5-18', 'S-1-5-32-544')
$writeMask = [int64]852310
$readExecuteMask = [int64]131241
$rootItem = Get-Item -LiteralPath $root -Force
$drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($rootItem.FullName))
if ($drive.DriveType -ne [IO.DriveType]::Fixed) { throw 'filesystem_not_local' }
$items = @($rootItem) + @(Get-ChildItem -LiteralPath $rootItem.FullName -Force -Recurse)
if ($items.Count -lt 1 -or $items.Count -gt 2049) { throw 'entity_count_invalid' }
$allOwnersTrusted = $true
$otherWriteAceCount = 0
$runtimeReadExecuteEntityCount = 0
$runtimeWriteEntityCount = 0
$runtimeRootInheritanceRuleCount = 0
$runtimeDenyAceCount = 0
$reparsePointCount = 0
$rootDaclProtected = $false
for ($index = 0; $index -lt $items.Count; $index++) {
  $item = $items[$index]
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    $reparsePointCount++
    continue
  }
  $acl = Get-Acl -LiteralPath $item.FullName
  if ($index -eq 0) { $rootDaclProtected = [bool]$acl.AreAccessRulesProtected }
  $ownerSid = ([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value
  if ($trusted -notcontains $ownerSid) { $allOwnersTrusted = $false }
  $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
  $entityRuntimeReadExecute = $false
  $entityRuntimeWrite = $false
  foreach ($rule in $rules) {
    $ruleSid = $rule.IdentityReference.Value
    $rights = [int64]$rule.FileSystemRights
    if ($ruleSid -eq $runtimeIdentity.Value) {
      if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny) {
        $runtimeDenyAceCount++
      } elseif (($rights -band $readExecuteMask) -eq $readExecuteMask) {
        $entityRuntimeReadExecute = $true
      }
      if (
        $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        ($rights -band $writeMask) -ne 0
      ) { $entityRuntimeWrite = $true }
      if (
        $index -eq 0 -and
        -not $rule.IsInherited -and
        $rule.InheritanceFlags -eq ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -and
        $rule.PropagationFlags -eq [Security.AccessControl.PropagationFlags]::None -and
        $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        ($rights -band $readExecuteMask) -eq $readExecuteMask -and
        (($rootRole -eq 'runtime' -and ($rights -band $writeMask) -ne 0) -or
         ($rootRole -eq 'authority' -and ($rights -band $writeMask) -eq 0))
      ) { $runtimeRootInheritanceRuleCount++ }
    }
    if (
      $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
      ($rights -band $writeMask) -ne 0 -and
      $trusted -notcontains $ruleSid -and
      $ruleSid -ne $runtimeIdentity.Value
    ) { $otherWriteAceCount++ }
  }
  if ($entityRuntimeReadExecute) { $runtimeReadExecuteEntityCount++ }
  if ($entityRuntimeWrite) { $runtimeWriteEntityCount++ }
}
[pscustomobject]@{
  allOwnersTrusted = $allOwnersTrusted
  entityCount = [int]$items.Count
  filesystemClass = 'local'
  otherWriteAceCount = $otherWriteAceCount
  reparsePointCount = $reparsePointCount
  rootDaclProtected = $rootDaclProtected
  rootRole = $rootRole
  runtimeDenyAceCount = $runtimeDenyAceCount
  runtimePrincipalSid = $runtimeIdentity.Value
  runtimeReadExecuteEntityCount = $runtimeReadExecuteEntityCount
  runtimeRootInheritanceRuleCount = $runtimeRootInheritanceRuleCount
  runtimeWriteEntityCount = $runtimeWriteEntityCount
} | ConvertTo-Json -Compress
`;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rootIdentityHash: null,
    rootProtectionHash: null,
    identityObserved: false,
    protectionObserved: false,
    absolutePathReported: false,
    principalReported: false,
    aclReported: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function uint64BigEndian(value: number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

function artifactHash(
  domain: Buffer,
  value: Readonly<Record<string, unknown>>,
) {
  const canonicalBytes = Buffer.from(JSON.stringify(value), "utf8");
  return createHash("sha256")
    .update(domain)
    .update(uint64BigEndian(canonicalBytes.byteLength))
    .update(canonicalBytes)
    .digest("hex");
}

function integer(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAXIMUM_ENTITIES
  );
}

function principalHash(sid: string) {
  return createHash("sha256")
    .update(Buffer.from("CRDD\0WINDOWS-PRINCIPAL-SID\0V1\0", "ascii"))
    .update(Buffer.from(sid, "utf8"))
    .digest("hex");
}

export function compileWindowsRootObservationCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, OBSERVATION_KEYS);
    if (
      !input ||
      !ROOT_ROLES.has(input.rootRole as string) ||
      input.filesystemClass !== "local" ||
      typeof input.allOwnersTrusted !== "boolean" ||
      typeof input.rootDaclProtected !== "boolean" ||
      !integer(input.entityCount) ||
      input.entityCount === 0 ||
      !integer(input.otherWriteAceCount) ||
      !integer(input.reparsePointCount) ||
      !integer(input.runtimeDenyAceCount) ||
      !integer(input.runtimeReadExecuteEntityCount) ||
      !integer(input.runtimeRootInheritanceRuleCount) ||
      !integer(input.runtimeWriteEntityCount) ||
      typeof input.runtimePrincipalSid !== "string" ||
      !WINDOWS_SID.test(input.runtimePrincipalSid) ||
      typeof input.objectDeviceId !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectDeviceId) ||
      typeof input.objectFileId !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectFileId) ||
      typeof input.objectBirthtimeNanoseconds !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectBirthtimeNanoseconds)
    ) {
      return blocked("windows_root_observation_invalid");
    }
    const entityCount = input.entityCount as number;
    const isRuntimeRoot = input.rootRole === "runtime";
    if (
      !input.rootDaclProtected ||
      !input.allOwnersTrusted ||
      input.otherWriteAceCount !== 0 ||
      input.reparsePointCount !== 0 ||
      input.runtimeDenyAceCount !== 0 ||
      input.runtimeReadExecuteEntityCount !== entityCount ||
      input.runtimeRootInheritanceRuleCount !== 1 ||
      (isRuntimeRoot
        ? input.runtimeWriteEntityCount !== entityCount
        : input.runtimeWriteEntityCount !== 0)
    ) {
      return blocked("windows_root_protection_not_satisfied");
    }
    const identityArtifact = Object.freeze({
      contract: ROOT_IDENTITY_OBSERVATION_CONTRACT,
      contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
      filesystemClass: "local",
      objectBirthtimeNanoseconds: input.objectBirthtimeNanoseconds,
      objectDeviceId: input.objectDeviceId,
      objectFileId: input.objectFileId,
      platformFamily: "windows",
    });
    const protectionArtifact = Object.freeze({
      contract: ROOT_PROTECTION_OBSERVATION_CONTRACT,
      contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
      filesystemClass: "local",
      platformFamily: "windows",
      rootRole: input.rootRole,
      runtimeAccess: isRuntimeRoot ? "read_write" : "read_only",
      runtimePrincipalIdentityHash: principalHash(input.runtimePrincipalSid),
      untrustedWriteAllowed: false,
      writeAuthority: isRuntimeRoot
        ? "runtime_principal_only"
        : "provisioner_principal_only",
      writerExclusivity:
        "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
    });
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_root_identity_and_protection_observed_candidate",
      rootIdentityHash: artifactHash(rootIdentityDomain, identityArtifact),
      rootProtectionHash: artifactHash(
        rootProtectionDomain,
        protectionArtifact,
      ),
      identityObserved: true,
      protectionObserved: true,
      absolutePathReported: false,
      principalReported: false,
      aclReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("windows_root_observation_invalid");
  }
}

function powershellExecutable() {
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !WINDOWS_ROOT.test(systemRoot)) return null;
  const executable = path.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  try {
    const metadata = fs.lstatSync(executable);
    return metadata.isFile() &&
      !metadata.isSymbolicLink() &&
      fs.realpathSync.native(executable) === executable
      ? executable
      : null;
  } catch {
    return null;
  }
}

function directoryIdentity(target: string) {
  const before = fs.lstatSync(target, { bigint: true });
  const realPath = fs.realpathSync.native(target);
  const resolved = fs.lstatSync(realPath, { bigint: true });
  const after = fs.lstatSync(target, { bigint: true });
  if (
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    before.dev <= 0n ||
    before.ino <= 0n ||
    before.birthtimeNs <= 0n ||
    before.dev !== resolved.dev ||
    before.ino !== resolved.ino ||
    before.birthtimeNs !== resolved.birthtimeNs ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.birthtimeNs !== after.birthtimeNs
  ) {
    throw new Error("windows_root_identity_unstable");
  }
  return Object.freeze({
    realPath,
    objectBirthtimeNanoseconds: before.birthtimeNs.toString(10),
    objectDeviceId: before.dev.toString(10),
    objectFileId: before.ino.toString(10),
  });
}

export function inspectWindowsRootObservationCandidate(
  rootPath: unknown,
  rootRole: unknown,
) {
  try {
    if (
      process.platform !== "win32" ||
      typeof rootPath !== "string" ||
      !path.win32.isAbsolute(rootPath) ||
      rootPath.includes("\0") ||
      !ROOT_ROLES.has(rootRole as string)
    ) {
      return blocked("windows_root_observation_platform_or_input_invalid");
    }
    const initialIdentity = directoryIdentity(rootPath);
    const executable = powershellExecutable();
    if (!executable)
      return blocked("windows_root_observation_host_unavailable");
    const encoded = Buffer.from(POWERSHELL_SCRIPT, "utf16le").toString(
      "base64",
    );
    const output = execFileSync(
      executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: POWERSHELL_TIMEOUT_MILLISECONDS,
        maxBuffer: POWERSHELL_OUTPUT_BYTES,
        env: {
          SystemRoot: process.env.SystemRoot,
          CRDD_ROOT_OBSERVATION_PATH: initialIdentity.realPath,
          CRDD_ROOT_OBSERVATION_ROLE: rootRole as string,
        },
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const finalIdentity = directoryIdentity(rootPath);
    if (
      initialIdentity.realPath !== finalIdentity.realPath ||
      initialIdentity.objectDeviceId !== finalIdentity.objectDeviceId ||
      initialIdentity.objectFileId !== finalIdentity.objectFileId ||
      initialIdentity.objectBirthtimeNanoseconds !==
        finalIdentity.objectBirthtimeNanoseconds
    ) {
      return blocked("windows_root_observation_identity_changed");
    }
    const observed = JSON.parse(output) as Record<string, unknown>;
    return compileWindowsRootObservationCandidate({
      ...observed,
      objectBirthtimeNanoseconds: initialIdentity.objectBirthtimeNanoseconds,
      objectDeviceId: initialIdentity.objectDeviceId,
      objectFileId: initialIdentity.objectFileId,
    });
  } catch {
    return blocked("windows_root_observation_failed");
  }
}

export function describeRootObservationContract() {
  return Object.freeze({
    identityContract: ROOT_IDENTITY_OBSERVATION_CONTRACT,
    protectionContract: ROOT_PROTECTION_OBSERVATION_CONTRACT,
    contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
    identityDomain: ROOT_IDENTITY_OBSERVATION_DOMAIN,
    protectionDomain: ROOT_PROTECTION_OBSERVATION_DOMAIN,
    domainFraming:
      "implemented_candidate_artifact_specific_prefix_uint64be_length_canonical_payload",
    identityInputs:
      "windows_device_file_and_birthtime_identity_without_path_disclosure",
    protectionInputs:
      "windows_fixed_drive_dacl_role_runtime_principal_and_writer_exclusivity",
    windowsAdapter: "implemented_candidate_read_only",
    posixAdapter: "not_implemented",
    rawIdentityReported: false,
    rawProtectionReported: false,
    absolutePathReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
