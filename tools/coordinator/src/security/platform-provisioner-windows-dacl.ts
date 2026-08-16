import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const OBSERVATION_KEYS = new Set([
  "entityCount",
  "rootDaclProtected",
  "allOwnersTrusted",
  "untrustedWriteAceCount",
  "runtimeReadExecuteEntityCount",
  "runtimeRootInheritanceRuleCount",
  "runtimeWriteAceCount",
  "runtimeDenyAceCount",
  "reparsePointCount",
]);
const MAXIMUM_ENTITIES = 2_049;
const POWERSHELL_TIMEOUT_MS = 30_000;
const POWERSHELL_OUTPUT_BYTES = 64 * 1024;
const WINDOWS_ROOT = /^[A-Za-z]:\\Windows$/u;
const WINDOWS_SID = /^S-1-(?:[0-9]+-){1,14}[0-9]+$/u;
const SCRIPT = `
$ErrorActionPreference = 'Stop'
$root = [Environment]::GetEnvironmentVariable('CRDD_DACL_ROOT', 'Process')
if ([string]::IsNullOrWhiteSpace($root)) { throw 'root_missing' }
$runtimeSid = [Environment]::GetEnvironmentVariable('CRDD_RUNTIME_PRINCIPAL_SID', 'Process')
if ([string]::IsNullOrWhiteSpace($runtimeSid)) {
  $runtimeSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
}
$runtimeIdentity = [Security.Principal.SecurityIdentifier]::new($runtimeSid)
$trusted = @('S-1-5-18', 'S-1-5-32-544')
$writeMask = [int64]852310
$readExecuteMask = [int64]131241
$rootItem = Get-Item -LiteralPath $root -Force
$items = @($rootItem) + @(Get-ChildItem -LiteralPath $root -Force -Recurse)
if ($items.Count -lt 1 -or $items.Count -gt 2049) { throw 'entity_count_invalid' }
$allOwnersTrusted = $true
$untrustedWriteAceCount = 0
$runtimeReadExecuteEntityCount = 0
$runtimeRootInheritanceRuleCount = 0
$runtimeWriteAceCount = 0
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
  foreach ($rule in $rules) {
    $ruleSid = $rule.IdentityReference.Value
    $rights = [int64]$rule.FileSystemRights
    if ($ruleSid -eq $runtimeIdentity.Value) {
      if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny) {
        $runtimeDenyAceCount++
      } elseif (($rights -band $readExecuteMask) -eq $readExecuteMask) {
        $entityRuntimeReadExecute = $true
      }
      if (($rights -band $writeMask) -ne 0) { $runtimeWriteAceCount++ }
      if (
        $index -eq 0 -and
        -not $rule.IsInherited -and
        $rule.InheritanceFlags -eq ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -and
        $rule.PropagationFlags -eq [Security.AccessControl.PropagationFlags]::None -and
        $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        ($rights -band $readExecuteMask) -eq $readExecuteMask -and
        ($rights -band $writeMask) -eq 0
      ) { $runtimeRootInheritanceRuleCount++ }
    }
    if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
    if (($rights -band $writeMask) -ne 0 -and $trusted -notcontains $ruleSid) {
      $untrustedWriteAceCount++
    }
  }
  if ($entityRuntimeReadExecute) { $runtimeReadExecuteEntityCount++ }
}
[pscustomobject]@{
  entityCount = [int]$items.Count
  rootDaclProtected = $rootDaclProtected
  allOwnersTrusted = $allOwnersTrusted
  untrustedWriteAceCount = $untrustedWriteAceCount
  runtimeReadExecuteEntityCount = $runtimeReadExecuteEntityCount
  runtimeRootInheritanceRuleCount = $runtimeRootInheritanceRuleCount
  runtimeWriteAceCount = $runtimeWriteAceCount
  runtimeDenyAceCount = $runtimeDenyAceCount
  reparsePointCount = $reparsePointCount
} | ConvertTo-Json -Compress
`;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    entityCount: null,
    writePolicyConfirmed: false,
    runtimeReadConfirmed: false,
    runtimePrincipalBound: false,
    permissionMutationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

export function evaluateWindowsPackageDaclObservationCandidate(raw: unknown) {
  try {
    const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
    if (
      !value ||
      typeof value.entityCount !== "number" ||
      !Number.isSafeInteger(value.entityCount) ||
      value.entityCount < 1 ||
      value.entityCount > MAXIMUM_ENTITIES ||
      typeof value.rootDaclProtected !== "boolean" ||
      typeof value.allOwnersTrusted !== "boolean" ||
      typeof value.untrustedWriteAceCount !== "number" ||
      !Number.isSafeInteger(value.untrustedWriteAceCount) ||
      value.untrustedWriteAceCount < 0 ||
      typeof value.runtimeReadExecuteEntityCount !== "number" ||
      !Number.isSafeInteger(value.runtimeReadExecuteEntityCount) ||
      value.runtimeReadExecuteEntityCount < 0 ||
      typeof value.runtimeRootInheritanceRuleCount !== "number" ||
      !Number.isSafeInteger(value.runtimeRootInheritanceRuleCount) ||
      value.runtimeRootInheritanceRuleCount < 0 ||
      typeof value.runtimeWriteAceCount !== "number" ||
      !Number.isSafeInteger(value.runtimeWriteAceCount) ||
      value.runtimeWriteAceCount < 0 ||
      typeof value.runtimeDenyAceCount !== "number" ||
      !Number.isSafeInteger(value.runtimeDenyAceCount) ||
      value.runtimeDenyAceCount < 0 ||
      typeof value.reparsePointCount !== "number" ||
      !Number.isSafeInteger(value.reparsePointCount) ||
      value.reparsePointCount < 0
    ) {
      return blocked("windows_package_dacl_observation_invalid");
    }
    if (value.reparsePointCount !== 0) {
      return blocked("windows_package_dacl_reparse_rejected");
    }
    if (!value.rootDaclProtected) {
      return blocked("windows_package_dacl_inheritance_not_protected");
    }
    if (!value.allOwnersTrusted) {
      return blocked("windows_package_dacl_owner_not_trusted");
    }
    if (value.untrustedWriteAceCount !== 0) {
      return blocked("windows_package_dacl_untrusted_write_rejected");
    }
    if (value.runtimeWriteAceCount !== 0) {
      return blocked("windows_package_dacl_runtime_write_rejected");
    }
    if (value.runtimeDenyAceCount !== 0) {
      return blocked("windows_package_dacl_runtime_deny_rejected");
    }
    if (value.runtimeRootInheritanceRuleCount !== 1) {
      return blocked("windows_package_dacl_runtime_root_rule_invalid");
    }
    if (value.runtimeReadExecuteEntityCount !== value.entityCount) {
      return blocked("windows_package_dacl_runtime_read_execute_incomplete");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_package_write_and_runtime_read_execute_dacl_verified",
      entityCount: value.entityCount,
      writePolicyConfirmed: true,
      runtimeReadConfirmed: true,
      runtimePrincipalBound: true,
      permissionMutationIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("windows_package_dacl_observation_invalid");
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

export function inspectWindowsPackageDaclCandidate(
  packageRoot: unknown,
  runtimePrincipalSid?: unknown,
) {
  try {
    if (
      process.platform !== "win32" ||
      typeof packageRoot !== "string" ||
      !path.isAbsolute(packageRoot) ||
      packageRoot.includes("\0")
    ) {
      return blocked("windows_package_dacl_platform_or_root_invalid");
    }
    if (
      runtimePrincipalSid !== undefined &&
      (typeof runtimePrincipalSid !== "string" ||
        !WINDOWS_SID.test(runtimePrincipalSid))
    ) {
      return blocked("windows_package_dacl_runtime_principal_invalid");
    }
    const executable = powershellExecutable();
    if (!executable) return blocked("windows_package_dacl_host_unavailable");
    const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
    const output = execFileSync(
      executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: POWERSHELL_TIMEOUT_MS,
        maxBuffer: POWERSHELL_OUTPUT_BYTES,
        env: {
          SystemRoot: process.env.SystemRoot,
          CRDD_DACL_ROOT: packageRoot,
          ...(typeof runtimePrincipalSid === "string"
            ? { CRDD_RUNTIME_PRINCIPAL_SID: runtimePrincipalSid }
            : {}),
        },
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return evaluateWindowsPackageDaclObservationCandidate(JSON.parse(output));
  } catch {
    return blocked("windows_package_dacl_observation_failed");
  }
}

export function describeWindowsPackageDaclContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-windows-dacl",
    contractRevision: 1,
    observer: "fixed_windows_powershell_5_1_sid_and_numeric_mask_candidate",
    trustedWriterSids: Object.freeze(["S-1-5-18", "S-1-5-32-544"]),
    rootInheritance: "protected_required",
    untrustedWriteAcePolicy: "rejected",
    ownerPolicy: "system_or_machine_administrators_required",
    recursiveEntityLimit: MAXIMUM_ENTITIES,
    runtimePrincipalSelection:
      "current_windows_identity_by_default_or_explicit_service_sid",
    runtimeReadBinding: "implemented_candidate",
    runtimeReadExecuteRule:
      "single_explicit_root_inheritable_allow_and_effective_on_every_entity",
    runtimeWritePolicy: "rejected",
    runtimeDenyPolicy: "rejected",
    permissionMutation: "prohibited",
    verification: "implemented_write_and_runtime_read_execute_policy_candidate",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
