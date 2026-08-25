import fs from "node:fs";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { describeAuthorityFileBundleContract } from "../security/authority-file-bundle.ts";
import { describeAuthorityGrantVerifierContract } from "../security/authority-grant-verifier.ts";
import { describeAuthorityPrelaunchVerifierContract } from "../security/authority-prelaunch-verifier.ts";
import { describeAuthorityRootContract } from "../security/authority-root-profile.ts";
import { describeAuthorityTrustLoaderContract } from "../security/authority-trust-loader.ts";
import {
  DOCKER_ISOLATION_PROFILE,
  runDockerIsolationProbe,
} from "../security/docker-isolation.ts";
import { describeEgressProxyTopology } from "../security/egress-proxy-policy.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
  getOwnedHostRecoveryId,
} from "../security/execution-environment.ts";
import { describeGitLocalExcludeContract } from "../security/git-local-exclude.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../security/plain-data-snapshot.ts";
import { describeProviderIsolationContract } from "../security/provider-isolation-profile.ts";
import { describeProviderLifecycleContract } from "../security/provider-lifecycle.ts";
import { describeRepositoryGitLayoutContract } from "../security/repository-git-layout.ts";
import { inspectRepositoryRevisionCandidate } from "../security/repository-operation-runtime.ts";
import { describeRootProtectionPolicyContract } from "../security/root-protection-policy.ts";
import { describeRuntimeActivationContract } from "../security/runtime-activation-record.ts";
import {
  describeRuntimeRootPathIdentityContract,
  inspectPosixRuntimeRootModePrecheckCandidate,
  inspectRuntimeRootPathIdentityCandidate,
} from "../security/runtime-root-path-identity.ts";
import {
  describeRuntimeRootContract,
  selectRuntimeRootCandidate,
} from "../security/runtime-root-profile.ts";
import { isSupportedCoordinatorNodeRuntime } from "./node-runtime-version.ts";

export const CHECK_STATUS = Object.freeze([
  "confirmed",
  "blocked",
  "not_implemented",
  "unknown",
] as const);

type CheckStatus = "confirmed" | "blocked" | "not_implemented" | "unknown";
export type DiagnosticCheck = {
  id: string;
  status: CheckStatus;
  reason: string | null;
  followUp: string | null;
};
type DiscoveryResult = Readonly<{
  located: boolean;
  candidateCount: number;
  formats: readonly string[];
  reason: string | null;
}>;
type RuntimeRootRequest = Readonly<{
  cliOverride: string | null;
  environmentOverride: string | null;
  activationIntent: "explicit_enable_request";
}>;
type DoctorOptions = Readonly<{
  activeIsolation: boolean;
  cwd: string;
  runtimeRootRequest: RuntimeRootRequest | null;
}>;
type DiscoveryOptions = Readonly<{
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  fileSystem?: typeof fs;
}>;

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

function errorCode(error: unknown): string | null {
  if (!isObject(error)) return null;
  const value = ownValue(error, "code");
  return typeof value === "string" ? value : null;
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export const REQUIRED_CHECK_IDS = Object.freeze([
  "runtime.node",
  "repository.git",
  "repository.identity",
  "runtime.root",
  "operation.directories",
  "execution.filesystem",
  "execution.credential_environment",
  "execution.credential_isolation",
  "execution.egress",
  "provider.codex.discovery",
  "provider.codex.authentication",
  "provider.codex.active_probe",
  "provider.codex.auto_update",
  "provider.codex.telemetry",
  "provider.codex.session_resume",
  "provider.codex.timeout",
  "provider.codex.cancel",
  "provider.codex.process_tree_termination",
  "provider.claude.discovery",
  "provider.claude.authentication",
  "provider.claude.active_probe",
  "provider.claude.auto_update",
  "provider.claude.telemetry",
  "provider.claude.session_resume",
  "provider.claude.timeout",
  "provider.claude.cancel",
  "provider.claude.process_tree_termination",
]);

function check(
  id: string,
  status: CheckStatus,
  reason: string | null,
  followUp: string | null = null,
): DiagnosticCheck {
  return { id, status, reason, followUp };
}

export function evaluateReadiness(checks: unknown) {
  const expected = new Set(REQUIRED_CHECK_IDS);
  const seen = new Set<string>();
  const blockers: Array<{ id: string | null; reason: string }> = [];
  const checkSnapshot = snapshotPlainArray<unknown>(
    checks,
    REQUIRED_CHECK_IDS.length + 1,
  );
  const entries = checkSnapshot.status === "ok" ? checkSnapshot.value : [];

  for (const item of entries) {
    if (item === null || typeof item !== "object") {
      blockers.push({ id: null, reason: "unknown_check" });
      continue;
    }
    const id = Reflect.get(item, "id");
    const status = Reflect.get(item, "status");
    const reason = Reflect.get(item, "reason");
    if (typeof id !== "string" || !expected.has(id)) {
      blockers.push({
        id: typeof id === "string" ? id : null,
        reason: "unknown_check",
      });
      continue;
    }
    if (seen.has(id)) {
      blockers.push({ id, reason: "duplicate_check" });
      continue;
    }
    seen.add(id);
    if (
      typeof status !== "string" ||
      !CHECK_STATUS.some((candidate) => candidate === status)
    ) {
      blockers.push({ id, reason: "invalid_status" });
      continue;
    }
    if (status !== "confirmed") {
      blockers.push({
        id,
        reason: typeof reason === "string" ? reason : status,
      });
    }
  }

  for (const id of REQUIRED_CHECK_IDS) {
    if (!seen.has(id)) blockers.push({ id, reason: "missing_check" });
  }

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}

function pathValue(environment: NodeJS.ProcessEnv): string {
  return environment.PATH ?? environment.Path ?? "";
}

function candidateExtensions(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): string[] {
  if (platform !== "win32") return [""];
  const configured = environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  return configured
    .split(";")
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

function commandFormat(candidate: string): string {
  const extension = path.extname(candidate).toLowerCase().replace(/^\./u, "");
  return extension || "native";
}

export function discoverCommand(
  command: string,
  options: DiscoveryOptions = {},
): DiscoveryResult {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const fileSystem = options.fileSystem ?? fs;
  const candidates = [];

  for (const directory of pathValue(environment)
    .split(path.delimiter)
    .filter(Boolean)) {
    for (const extension of candidateExtensions(platform, environment)) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        const metadata = fileSystem.lstatSync(candidate);
        if (!metadata.isFile() || metadata.isSymbolicLink()) continue;
        if (platform !== "win32" && (metadata.mode & 0o111) === 0) continue;
        candidates.push({ format: commandFormat(candidate) });
      } catch (error) {
        if (errorCode(error) !== "ENOENT" && errorCode(error) !== "ENOTDIR") {
          return {
            located: false,
            candidateCount: 0,
            formats: [],
            reason: "discovery_failed",
          };
        }
      }
    }
  }

  return {
    located: candidates.length > 0,
    candidateCount: candidates.length,
    formats: [
      ...new Set(candidates.map((candidate) => candidate.format)),
    ].sort(),
    reason: candidates.length > 0 ? null : "command_not_found",
  };
}

function probeGitRepository(cwd: string) {
  const identity = inspectRepositoryRevisionCandidate(cwd);

  return {
    gitAvailable: identity?.status === "candidate",
    identityAvailable: identity?.status === "candidate",
    headCommit: identity?.commit ?? null,
    headTree: identity?.tree ?? null,
    workingState: "not_observed",
    externalGitCliUsed: false,
  };
}

export const isSupportedNodeVersion = isSupportedCoordinatorNodeRuntime;

function nodeSupported(): boolean {
  return isSupportedNodeVersion(process.versions.node);
}

function providerChecks(
  name: string,
  discovery: DiscoveryResult,
): DiagnosticCheck[] {
  return [
    check(
      `provider.${name}.discovery`,
      discovery.located ? "confirmed" : "blocked",
      discovery.reason,
      discovery.located ? null : "install_or_select_provider_outside_runtime",
    ),
    check(
      `provider.${name}.authentication`,
      "unknown",
      "subscription_oauth_explicit_login_not_evaluated",
    ),
    check(
      `provider.${name}.active_probe`,
      "not_implemented",
      "provider_egress_auth_and_fixed_image_binding_required_before_spawn",
    ),
    check(
      `provider.${name}.auto_update`,
      "not_implemented",
      "provider_fixed_image_and_auto_update_enforcement_not_implemented",
    ),
    check(
      `provider.${name}.telemetry`,
      "not_implemented",
      "provider_telemetry_policy_not_implemented",
    ),
    check(
      `provider.${name}.session_resume`,
      "not_implemented",
      "provider_session_resume_prohibited_but_not_enforced",
    ),
    check(
      `provider.${name}.timeout`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
    check(
      `provider.${name}.cancel`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
    check(
      `provider.${name}.process_tree_termination`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
  ];
}

function reportableFilesystemPolicy(
  policy: ReturnType<typeof describeFilesystemPolicy>,
  root: string,
) {
  const relative = (value: string) =>
    path.relative(root, value).replaceAll("\\", "/");
  return {
    coordinatorRuntime: {
      write: policy.coordinatorRuntime.write.map(relative),
    },
    repositoryAdapter: { write: policy.repositoryAdapter.write.map(relative) },
    providerProcess: {
      write: policy.providerProcess.write.map(relative),
      deny: policy.providerProcess.deny.map(relative),
    },
    credentialBroker: policy.credentialBroker,
  };
}

const DOCTOR_OPTION_KEYS = new Set([
  "activeIsolation",
  "cwd",
  "runtimeRootRequest",
]);
const RUNTIME_ROOT_REQUEST_KEYS = new Set([
  "cliOverride",
  "environmentOverride",
  "activationIntent",
]);

function validRuntimeRootOverride(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 4_096 &&
      !/[\u0000-\u001f\u007f]/u.test(value) &&
      path.isAbsolute(value))
  );
}

function normalizeDoctorOptions(rawOptions: unknown): DoctorOptions {
  try {
    if (
      !rawOptions ||
      typeof rawOptions !== "object" ||
      utilTypes.isProxy(rawOptions) ||
      Array.isArray(rawOptions)
    ) {
      throw new Error("doctor_options_invalid");
    }
    const prototype = Object.getPrototypeOf(rawOptions);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("doctor_options_invalid");
    const descriptors = Object.getOwnPropertyDescriptors(rawOptions);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.some(
        (key) => typeof key !== "string" || !DOCTOR_OPTION_KEYS.has(key),
      )
    ) {
      throw new Error("doctor_options_invalid");
    }
    const value = (key: string, fallback: unknown): unknown => {
      const descriptor = descriptors[key];
      if (!descriptor) return fallback;
      if (
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        throw new Error("doctor_options_invalid");
      return descriptor.value;
    };
    const isIsolationActive = value("activeIsolation", false);
    const cwd = value("cwd", process.cwd());
    const rawRuntimeRootRequest = value("runtimeRootRequest", null);
    if (
      typeof isIsolationActive !== "boolean" ||
      typeof cwd !== "string" ||
      !path.isAbsolute(cwd) ||
      /[\u0000-\u001f\u007f]/u.test(cwd)
    ) {
      throw new Error("doctor_options_invalid");
    }
    let runtimeRootRequest: RuntimeRootRequest | null = null;
    if (rawRuntimeRootRequest !== null) {
      const snapshot = snapshotPlainRecord(
        rawRuntimeRootRequest,
        RUNTIME_ROOT_REQUEST_KEYS,
      );
      if (
        !snapshot ||
        !validRuntimeRootOverride(snapshot.cliOverride) ||
        !validRuntimeRootOverride(snapshot.environmentOverride) ||
        snapshot.activationIntent !== "explicit_enable_request"
      ) {
        throw new Error("doctor_options_invalid");
      }
      runtimeRootRequest = Object.freeze({
        cliOverride: snapshot.cliOverride,
        environmentOverride: snapshot.environmentOverride,
        activationIntent: snapshot.activationIntent,
      });
    }
    return Object.freeze({
      activeIsolation: isIsolationActive,
      cwd,
      runtimeRootRequest,
    });
  } catch (error) {
    if (errorMessage(error) === "doctor_options_invalid") throw error;
    throw new Error("doctor_options_invalid");
  }
}

export function runDoctor(options: unknown = {}) {
  const normalizedOptions = normalizeDoctorOptions(options);
  const isIsolationActive = normalizedOptions.activeIsolation;
  const cwd = normalizedOptions.cwd;
  const owned = createOwnedOperationDirectories();
  if (!owned.directories)
    throw new Error("owned_operation_directory_identity_required");
  const ownedDirectories = owned.directories;
  const initialHostRecoveryId = getOwnedHostRecoveryId(owned);
  let shouldRetainOperationDirectories = false;
  try {
    const providerEnvironment = createProviderEnvironment(
      process.env,
      ownedDirectories,
    );
    const credentialNames = credentialEnvironmentNamesPresent(process.env);
    const forwardedCredentialNames =
      credentialEnvironmentNamesPresent(providerEnvironment);
    const repository = probeGitRepository(cwd);
    const providers = Object.freeze({
      codex: discoverCommand("codex"),
      claude: discoverCommand("claude"),
    });

    const runtimeRootInput = {
      repositoryRoot: cwd,
      cliOverride: normalizedOptions.runtimeRootRequest?.cliOverride ?? null,
      environmentOverride:
        normalizedOptions.runtimeRootRequest?.environmentOverride ?? null,
      activationIntent:
        normalizedOptions.runtimeRootRequest?.activationIntent ?? null,
    };
    const runtimeRootEvaluation =
      normalizedOptions.runtimeRootRequest === null
        ? selectRuntimeRootCandidate(runtimeRootInput)
        : inspectRuntimeRootPathIdentityCandidate(runtimeRootInput);
    const runtimeRootProtectionPrecheck =
      normalizedOptions.runtimeRootRequest === null
        ? Object.freeze({
            status: "not_evaluated",
            reason: "runtime_feature_not_enabled",
            summary: null,
            filesystemEffectIssued: false,
            runtimeCapabilityIssued: false,
          })
        : inspectPosixRuntimeRootModePrecheckCandidate(runtimeRootInput);
    const isolation = isIsolationActive
      ? runDockerIsolationProbe(owned)
      : Object.freeze({
          status: "not_implemented",
          reason: "filesystem_boundary_not_enforced",
          hostCleanupCompleted: false,
          recoveryId: null,
          manualRecoveryRequired: false,
          fakeProviderLifecycle: Object.freeze({
            status: "not_evaluated",
            reason: "dynamic_fake_provider_not_requested",
            provenance: "repository_owned_docker_fake_provider",
            fakeProviderStartAttempted: false,
            fakeProviderExecuted: false,
            resultNormalizationVerified: false,
            containerAbsenceVerified: false,
            processTreeAbsenceVerified: false,
            hostCleanupVerified: false,
            elapsedMs: null,
            stdoutBytes: 0,
            stderrBytes: 0,
            exitCode: null,
            signal: null,
            timedOut: false,
            cancellationRequested: false,
            cancellationObservation: "not_implemented",
            diagnosticDockerContainerEffectIssued: false,
            diagnosticFilesystemEffectIssued: false,
            providerNetworkEffectIssued: false,
            runtimeAuthorityIssued: false,
            operationCapabilityIssued: false,
            realProviderReadiness: false,
          }),
        });
    shouldRetainOperationDirectories = isIsolationActive
      ? isolation.hostCleanupCompleted !== true
      : false;
    const isolationCheckStatus: CheckStatus =
      isolation.status === "confirmed"
        ? "confirmed"
        : isolation.status === "not_implemented"
          ? "not_implemented"
          : "blocked";
    const checks = [
      check(
        "runtime.node",
        nodeSupported() ? "confirmed" : "blocked",
        nodeSupported() ? null : "node_24_12_or_newer_required",
      ),
      check(
        "repository.git",
        repository.gitAvailable ? "confirmed" : "blocked",
        repository.gitAvailable ? null : "git_unavailable",
      ),
      check(
        "repository.identity",
        repository.identityAvailable ? "confirmed" : "blocked",
        repository.identityAvailable ? null : "repository_identity_unavailable",
      ),
      check(
        "runtime.root",
        "blocked",
        runtimeRootEvaluation.status === "candidate"
          ? "runtime_root_activation_record_not_implemented"
          : runtimeRootEvaluation.reason,
      ),
      check(
        "operation.directories",
        "confirmed",
        "owned_operation_directories_created",
      ),
      check("execution.filesystem", isolationCheckStatus, isolation.reason),
      check(
        "execution.credential_environment",
        forwardedCredentialNames.length === 0 ? "confirmed" : "blocked",
        forwardedCredentialNames.length === 0
          ? null
          : "credential_environment_filter_failed",
      ),
      check(
        "execution.credential_isolation",
        isIsolationActive && isolation.status === "confirmed"
          ? "confirmed"
          : "not_implemented",
        isIsolationActive && isolation.status === "confirmed"
          ? "credential_paths_not_mounted_in_fake_probe"
          : "credential_store_isolation_not_enforced",
      ),
      check(
        "execution.egress",
        isIsolationActive && isolation.status === "confirmed"
          ? "blocked"
          : "not_implemented",
        isIsolationActive && isolation.status === "confirmed"
          ? "provider_endpoint_allowlist_not_configured"
          : "provider_egress_allowlist_not_enforced",
      ),
      ...providerChecks("codex", providers.codex),
      ...providerChecks("claude", providers.claude),
    ];
    const readiness = evaluateReadiness(checks);

    const report = {
      reportVersion: 11,
      diagnosticMode: isIsolationActive
        ? "docker_fake_provider_probe"
        : "passive_preflight",
      status: readiness.status,
      platform: process.platform,
      node: { version: process.version, supported: nodeSupported() },
      repository,
      credentials: {
        detectedNames: credentialNames,
        forwardedNames: forwardedCredentialNames,
        valuesRecorded: false,
        environmentFiltered: forwardedCredentialNames.length === 0,
        isolationEnforcement:
          isIsolationActive && isolation.status === "confirmed"
            ? "confirmed_for_fake_probe"
            : "not_implemented",
      },
      filesystem: {
        policy: reportableFilesystemPolicy(
          describeFilesystemPolicy(ownedDirectories),
          owned.root,
        ),
        enforcement: isolation.status,
        profile: isIsolationActive ? DOCKER_ISOLATION_PROFILE : null,
      },
      runtimeRoot: describeRuntimeRootContract(),
      runtimeRootPathIdentity: describeRuntimeRootPathIdentityContract(),
      runtimeActivation: describeRuntimeActivationContract(),
      rootProtectionPolicy: describeRootProtectionPolicyContract(),
      runtimeRootEvaluation,
      runtimeRootProtectionPrecheck,
      repositoryGitLayout: describeRepositoryGitLayoutContract(),
      gitLocalExclude: describeGitLocalExcludeContract(),
      providerLifecycle: describeProviderLifecycleContract(),
      fakeProviderLifecycle: isolation.fakeProviderLifecycle,
      egress: {
        providerAllowlist: "not_implemented",
        fakeProbeNetwork:
          isIsolationActive && isolation.status === "confirmed"
            ? "blocked"
            : "not_evaluated",
        isolationProfileContract: describeProviderIsolationContract(),
        authorityVerifier: describeAuthorityGrantVerifierContract(),
        authorityTrustLoader: describeAuthorityTrustLoaderContract(),
        authorityFileBundle: describeAuthorityFileBundleContract(),
        authorityRoot: describeAuthorityRootContract(),
        authorityPrelaunchVerifier:
          describeAuthorityPrelaunchVerifierContract(),
        proxyTopology: describeEgressProxyTopology(),
        activation: "blocked",
        activationReason:
          "runtime_file_bundle_path_acl_activation_provider_launch_integration_proxy_and_provider_home_mount_grant_verification_not_implemented",
      },
      recovery: shouldRetainOperationDirectories
        ? {
            required: true,
            recoveryId: isolation.recoveryId ?? null,
            reason: isolation.reason,
            manualRecoveryRequired: isolation.manualRecoveryRequired === true,
          }
        : { required: false },
      providers,
      checks,
      blockers: readiness.blockers,
    };
    if (!isIsolationActive) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        const filesystemCheck = report.checks.find(
          (item) => item.id === "execution.filesystem",
        );
        if (!filesystemCheck)
          throw new Error("doctor_filesystem_check_missing");
        filesystemCheck.status = "blocked";
        filesystemCheck.reason = "host_operation_cleanup_failed";
        const cleanupReadiness = evaluateReadiness(report.checks);
        report.status = "blocked";
        report.blockers = cleanupReadiness.blockers;
        report.recovery = {
          required: true,
          recoveryId: initialHostRecoveryId,
          reason: "host_operation_cleanup_failed",
          manualRecoveryRequired: false,
        };
      }
    }
    return report;
  } catch (error) {
    if (!isIsolationActive && !shouldRetainOperationDirectories) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        /* recovery marker remains external */
      }
    }
    throw error;
  }
}
