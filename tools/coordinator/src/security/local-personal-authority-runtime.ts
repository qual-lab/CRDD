import {
  AUTHORITY_FILE_BUNDLE_CONTRACT,
  loadAuthorityFileBundleCandidate,
} from "./authority-file-bundle.ts";
import {
  AUTHORITY_REGISTRY_CONTRACT,
  validateAuthorityRegistryCandidate,
} from "./authority-grant-verifier.ts";
import {
  AUTHORITY_TRUST_POLICY_CONTRACT,
  decodeCanonicalAuthorityTrustPolicyBytes,
} from "./authority-trust-loader.ts";
import { inspectRuntimeOwnedDevelopmentOperationContext } from "./development-measurement-session.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";
import {
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile,
} from "./provider-isolation-profile.ts";

export const LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT =
  "crdd-coordinator/local-personal-authority-runtime";
export const LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT_REVISION = 1;

const SOURCE_LIFETIME_MS = 30_000;
const GRANT_LIFETIME_MS = 300_000;
const PROFILE = Object.freeze({
  "PROFILE-100001": Object.freeze({
    provider: "codex",
    origin: "https://chatgpt.com",
    suffix: "100001",
  }),
  "PROFILE-100002": Object.freeze({
    provider: "codex",
    origin: "https://chatgpt.com",
    suffix: "100002",
  }),
  "PROFILE-100003": Object.freeze({
    provider: "codex",
    origin: "https://chatgpt.com",
    suffix: "100003",
  }),
  "PROFILE-100004": Object.freeze({
    provider: "codex",
    origin: "https://chatgpt.com",
    suffix: "100004",
  }),
  "PROFILE-200001": Object.freeze({
    provider: "claude",
    origin: "https://claude.ai",
    suffix: "200001",
  }),
  "PROFILE-200002": Object.freeze({
    provider: "claude",
    origin: "https://claude.ai",
    suffix: "200002",
  }),
});

type Binding = Readonly<{
  operationId: string;
  provider: string;
  profileId: string;
}>;
type Source = Readonly<{
  profile: unknown;
  bundle: unknown;
  scopeId: string;
}>;
type SourceRecord = Readonly<{
  source: Source;
  expiresAtMs: number;
}>;
type RuntimeDependencies = Readonly<{
  wallNow: () => number;
  verifyRelease: (evaluationTime: string) => unknown;
  verifyDevelopment?: (
    binding: Binding,
    managementCapability: unknown,
  ) => "not_development" | "authorized" | "blocked";
}>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("local_personal_authority_json_invalid");
  return serialized;
}

function releaseConfirmed(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  return (
    value.status === "candidate" &&
    value.runtimeOwnedReleaseTrustConfirmed === true &&
    value.releaseIdentityRuntimeOwned === true &&
    value.crddDistributionConfirmed === true
  );
}

function createSource(binding: Binding, now: number): Source | null {
  const specification = PROFILE[binding.profileId as keyof typeof PROFILE];
  if (
    !specification ||
    specification.provider !== binding.provider ||
    !/^OP-[0-9]{6,}$/u.test(binding.operationId)
  ) {
    return null;
  }
  const registryId = `AUTHREG-${specification.suffix}`;
  const grantRef = `AUTH-${specification.suffix}`;
  const scopeId = `SCOPE-${specification.suffix}`;
  const mountRequirement = Object.freeze({
    provider: specification.provider,
    profileId: binding.profileId,
    operationId: binding.operationId,
    issuer: "runtime_owned" as const,
    requiredState: "active" as const,
    verification: "runtime_capability_required" as const,
  });
  const profile = Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 3,
    profileId: binding.profileId,
    provider: specification.provider,
    operationId: binding.operationId,
    authMethod: "subscription_oauth",
    authority: Object.freeze({ registryId, grantRef }),
    providerHomeMountGrant: mountRequirement,
    egress: Object.freeze({ origins: Object.freeze([specification.origin]) }),
  });
  const validatedProfile = validateProviderIsolationProfile(profile);
  if (validatedProfile.status !== "candidate") return null;
  const registryCandidate = validateAuthorityRegistryCandidate({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: 3,
    registryId,
    registryRevision: 1,
    observedAt: new Date(now).toISOString(),
    grants: [
      {
        grantRef,
        grantRevision: 1,
        status: "active",
        validFrom: new Date(now - 60_000).toISOString(),
        expiresAt: new Date(now + GRANT_LIFETIME_MS).toISOString(),
        provider: specification.provider,
        profileId: binding.profileId,
        origins: [specification.origin],
        providerHomeMountGrant: mountRequirement,
        operationId: binding.operationId,
        scopeId,
        profileHash: validatedProfile.profileHash,
      },
    ],
  });
  if (registryCandidate.status !== "candidate") return null;
  const registryBytes = Buffer.from(
    canonicalJson(registryCandidate.registry),
    "utf8",
  );
  const trustPolicy = Object.freeze({
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: `AUTHPOL-${specification.suffix}`,
    policyRevision: 1,
    status: "active",
    registryId,
    registryRevision: 1,
    registryHash: registryCandidate.registryHash,
  });
  const trustPolicyBytes = Buffer.from(canonicalJson(trustPolicy), "utf8");
  const decodedPolicy =
    decodeCanonicalAuthorityTrustPolicyBytes(trustPolicyBytes);
  if (decodedPolicy.status !== "candidate") return null;
  const manifest = Object.freeze({
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: 1,
    bundleId: `AUTHBUNDLE-${specification.suffix}`,
    bundleRevision: 1,
    status: "active",
    previousBundleHash: null,
    trustPolicyHash: decodedPolicy.trustPolicyHash,
    registryHash: registryCandidate.registryHash,
  });
  const bundle = Object.freeze({
    manifestBytes: Buffer.from(canonicalJson(manifest), "utf8"),
    trustPolicyBytes,
    registryBytes,
  });
  if (loadAuthorityFileBundleCandidate(bundle).status !== "candidate")
    return null;
  return Object.freeze({ profile, bundle, scopeId });
}

function createRuntime(dependencies: RuntimeDependencies) {
  const sources = new Map<string, SourceRecord>();
  return Object.freeze({
    load(binding: Binding, managementCapability?: unknown) {
      try {
        const now = dependencies.wallNow();
        if (!Number.isFinite(now) || now < 0) return null;
        const evaluationTime = new Date(now).toISOString();
        const development =
          dependencies.verifyDevelopment?.(binding, managementCapability) ??
          "not_development";
        if (
          development === "blocked" ||
          (development === "not_development" &&
            !releaseConfirmed(dependencies.verifyRelease(evaluationTime)))
        )
          return null;
        const key = `${binding.operationId}\0${binding.provider}\0${binding.profileId}`;
        const current = sources.get(key);
        if (current && now < current.expiresAtMs) return current.source;
        const source = createSource(binding, now);
        if (!source) return null;
        sources.set(
          key,
          Object.freeze({ source, expiresAtMs: now + SOURCE_LIFETIME_MS }),
        );
        return source;
      } catch {
        return null;
      }
    },
  });
}

const productionRuntime = createRuntime(
  Object.freeze({
    wallNow: Date.now,
    verifyDevelopment: (binding, managementCapability) => {
      const context =
        inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
      if (!context) return "not_development";
      return context.checkNewWork() &&
        verifyOwnedOperationManagementCapability(managementCapability)
          .operationId === binding.operationId
        ? "authorized"
        : "blocked";
    },
    verifyRelease: (evaluationTime) =>
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime,
      }),
  }),
);

export function loadRuntimeOwnedLocalPersonalAuthority(
  binding: Binding,
  managementCapability?: unknown,
) {
  return productionRuntime.load(binding, managementCapability);
}

export function createIsolatedLocalPersonalAuthorityRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const runtime = createRuntime(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    load: runtime.load,
  });
}

export function describeLocalPersonalAuthorityRuntimeContract() {
  return Object.freeze({
    contract: LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT,
    contractRevision: LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT_REVISION,
    trustProfile: "local_personal_t1_t2",
    providers: Object.freeze(["codex", "claude"]),
    profiles: Object.freeze(Object.keys(PROFILE)),
    releaseTrust: "official_signed_crdd_release_required_each_load",
    operationBinding: "runtime_owned_exact_operation_profile_provider",
    externalAuthorityRootRequired: false,
    managedAuthorityProfileSupported: false,
    providerEffectAllowed: false,
  });
}
