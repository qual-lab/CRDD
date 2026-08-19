import path from "node:path";

import { isSupportedWindowsAbsolutePathCandidate } from "./authority-root-path-lexical.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_HOME_CONTRACT = "crdd-coordinator/provider-home";
export const PROVIDER_HOME_CONTRACT_REVISION = 1;

export const PROVIDER_HOME_ROOT_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "ProviderHomes",
]);

const PROVIDERS = Object.freeze(["codex", "claude"] as const);
const INPUT_KEYS = new Set(["provider", "localAppDataRoot"]);

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    homeLayoutCandidate: false,
    protectionVerified: false,
    authSessionVerified: false,
    providerHomeMountGrantIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
  });
}

function provider(value: unknown): (typeof PROVIDERS)[number] | null {
  return typeof value === "string" &&
    PROVIDERS.some((candidate) => candidate === value)
    ? (value as (typeof PROVIDERS)[number])
    : null;
}

function resolveLayoutForValidation(
  localAppDataRoot: string,
  selectedProvider: (typeof PROVIDERS)[number],
) {
  const root = path.win32.join(
    localAppDataRoot,
    ...PROVIDER_HOME_ROOT_SEGMENTS,
  );
  return Object.freeze({
    root,
    providerHome: path.win32.join(root, selectedProvider),
  });
}

export function evaluateWindowsProviderHomeLayoutCandidate(raw: unknown) {
  const input = snapshotPlainRecord(raw, INPUT_KEYS);
  if (!input) return blocked("provider_home_layout_input_invalid");
  const selectedProvider = provider(input.provider);
  if (!selectedProvider) return blocked("provider_home_provider_not_supported");
  if (!isSupportedWindowsAbsolutePathCandidate(input.localAppDataRoot)) {
    return blocked("provider_home_local_app_data_root_invalid");
  }
  const layout = resolveLayoutForValidation(
    input.localAppDataRoot,
    selectedProvider,
  );
  if (
    !isSupportedWindowsAbsolutePathCandidate(layout.root) ||
    !isSupportedWindowsAbsolutePathCandidate(layout.providerHome)
  ) {
    return blocked("provider_home_layout_invalid");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "provider_home_protection_effect_and_observation_required",
    provider: selectedProvider,
    scope: "local_os_user_and_provider" as const,
    rootInputSource: "caller_supplied_windows_absolute_path_candidate" as const,
    requiredEffectRootSource:
      "windows_known_folder_local_app_data_at_explicit_bootstrap_time" as const,
    homeLayoutCandidate: true,
    persistentAcrossOperations: true,
    sharedAcrossRepositoriesForSameOsUser: true,
    hostDefaultHomeImportAllowed: false,
    otherProviderHomeSharingAllowed: false,
    operationCleanupOwned: false,
    protectionVerified: false,
    authSessionVerified: false,
    providerHomeMountGrantIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
  });
}

export function describeProviderHomeContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_CONTRACT,
    contractRevision: PROVIDER_HOME_CONTRACT_REVISION,
    platform: "windows_local_user_target_only",
    providers: PROVIDERS,
    layoutCandidateInputSource:
      "caller_supplied_windows_absolute_path_candidate_non_authority",
    requiredEffectRootSource:
      "windows_known_folder_local_app_data_at_explicit_bootstrap_time",
    rootSegments: PROVIDER_HOME_ROOT_SEGMENTS,
    providerDirectoryNames: Object.freeze({ codex: "codex", claude: "claude" }),
    scope: "local_os_user_and_provider",
    persistentAcrossOperations: true,
    sharedAcrossRepositoriesForSameOsUser: true,
    hostDefaultHomeImportAllowed: false,
    hostCredentialImportAllowed: false,
    operationTemporaryHomeImportAllowed: false,
    otherProviderHomeSharingAllowed: false,
    operationCleanupOwned: false,
    symlinkJunctionOrReparseAllowed: false,
    stableRootIdentityRequired: true,
    selectedLocalUserBindingRequired: true,
    ownerAndDaclVerificationRequired: true,
    untrustedWriterAllowed: false,
    providerRefreshWriteTarget: "provider_specific_home_only",
    tokenSessionOrPathReported: false,
    bootstrapEntry: "explicit_login_only_target",
    protectionEffect: "not_implemented",
    protectionObservation: "not_implemented",
    selectedLocalUserBinder: "not_implemented",
    authSessionProbe: "not_implemented",
    logoutRevocationAndDeletion: "not_implemented_separate_bootstrap_lifecycle",
    callerPathConfersAuthority: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}
