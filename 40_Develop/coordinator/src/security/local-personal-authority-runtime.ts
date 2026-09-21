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

/**
 * Bindingが扱う値の構造を表す。
 *
 * @responsibility Bindingに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape Bindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Bindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: Bindingの宣言は外部境界を開かない。
 * @security BindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Bindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Binding = Readonly<{
  operationId: string;
  provider: string;
  profileId: string;
}>;
/**
 * Sourceが扱う値の構造を表す。
 *
 * @responsibility Sourceに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape Sourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sourceの宣言は外部境界を開かない。
 * @security SourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Source = Readonly<{
  profile: unknown;
  bundle: unknown;
  scopeId: string;
}>;
/**
 * SourceRecordが扱う値の構造を表す。
 *
 * @responsibility SourceRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape SourceRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SourceRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: SourceRecordの宣言は外部境界を開かない。
 * @security SourceRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SourceRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SourceRecord = Readonly<{
  source: Source;
  expiresAtMs: number;
}>;
/**
 * RuntimeDependenciesが扱う値の構造を表す。
 *
 * @responsibility RuntimeDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  wallNow: () => number;
  verifyRelease: (evaluationTime: string) => unknown;
  verifyDevelopment?: (
    binding: Binding,
    managementCapability: unknown,
  ) => "not_development" | "authorized" | "blocked";
}>;

/**
 * canonicalJsonの処理を実行する。
 *
 * @responsibility canonicalJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns stringを返す。
 * @precondition 「value: unknown」がcanonicalJsonの入力契約を満たす。
 * @postcondition canonicalJsonの責務を完了した結果だけを返す。
 * @effect N/A: canonicalJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canonicalJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canonicalJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalJsonはProcess内の同一Subsystemで完結する。
 * @security canonicalJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalJsonは共有非同期状態を持たない同期処理である。
 */
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

/**
 * releaseConfirmedの処理を実行する。
 *
 * @responsibility releaseConfirmedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input candidate: unknown
 * @returns releaseConfirmedの計算結果を返す。
 * @precondition 「candidate: unknown」がreleaseConfirmedの入力契約を満たす。
 * @postcondition releaseConfirmedの責務を完了した結果だけを返す。
 * @effect N/A: releaseConfirmedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: releaseConfirmedは独自の失敗分岐を所有しない。
 * @invariant releaseConfirmedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseConfirmedはProcess内の同一Subsystemで完結する。
 * @security releaseConfirmedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseConfirmedは共有非同期状態を持たない同期処理である。
 */
function releaseConfirmed(candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  return (
    value.status === "candidate" &&
    value.runtimeOwnedReleaseTrustConfirmed === true &&
    value.runtimeExecutionIdentityRuntimeOwned === true &&
    value.crddDistributionConfirmed === true
  );
}

/**
 * createSourceの処理を実行する。
 *
 * @responsibility createSourceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input binding: Binding、now: number
 * @returns Source | nullを返す。
 * @precondition 「binding: Binding、now: number」がcreateSourceの入力契約を満たす。
 * @postcondition createSourceの責務を完了した結果だけを返す。
 * @effect N/A: createSourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSourceは独自の失敗分岐を所有しない。
 * @invariant createSourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSourceはProcess内の同一Subsystemで完結する。
 * @security createSourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSourceは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createRuntimeの処理を実行する。
 *
 * @responsibility createRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input dependencies: RuntimeDependencies
 * @returns createRuntimeの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeの入力契約を満たす。
 * @postcondition createRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeはProcess内の同一Subsystemで完結する。
 * @security createRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeは共有非同期状態を持たない同期処理である。
 */
function createRuntime(dependencies: RuntimeDependencies) {
  const sources = new Map<string, SourceRecord>();
  return Object.freeze({
    /**
     * loadの処理を実行する。
     *
     * @responsibility loadに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000014
     * @input binding: Binding、managementCapability: unknown
     * @returns loadの計算結果を返す。
     * @precondition 「binding: Binding、managementCapability: unknown」がloadの入力契約を満たす。
     * @postcondition loadの責務を完了した結果だけを返す。
     * @effect N/A: loadは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure loadは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant loadは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: loadはProcess内の同一Subsystemで完結する。
     * @security loadはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: loadは共有非同期状態を持たない同期処理である。
     */
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

/**
 * loadRuntimeOwnedLocalPersonalAuthorityの処理を実行する。
 *
 * @responsibility loadRuntimeOwnedLocalPersonalAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input binding: Binding、managementCapability: unknown
 * @returns loadRuntimeOwnedLocalPersonalAuthorityの計算結果を返す。
 * @precondition 「binding: Binding、managementCapability: unknown」がloadRuntimeOwnedLocalPersonalAuthorityの入力契約を満たす。
 * @postcondition loadRuntimeOwnedLocalPersonalAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: loadRuntimeOwnedLocalPersonalAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: loadRuntimeOwnedLocalPersonalAuthorityは独自の失敗分岐を所有しない。
 * @invariant loadRuntimeOwnedLocalPersonalAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadRuntimeOwnedLocalPersonalAuthorityはProcess内の同一Subsystemで完結する。
 * @security loadRuntimeOwnedLocalPersonalAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadRuntimeOwnedLocalPersonalAuthorityは共有非同期状態を持たない同期処理である。
 */
export function loadRuntimeOwnedLocalPersonalAuthority(
  binding: Binding,
  managementCapability?: unknown,
) {
  return productionRuntime.load(binding, managementCapability);
}

/**
 * createIsolatedLocalPersonalAuthorityRuntimeCandidateの処理を実行する。
 *
 * @responsibility createIsolatedLocalPersonalAuthorityRuntimeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedLocalPersonalAuthorityRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedLocalPersonalAuthorityRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedLocalPersonalAuthorityRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedLocalPersonalAuthorityRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedLocalPersonalAuthorityRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedLocalPersonalAuthorityRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const runtime = createRuntime(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    load: runtime.load,
  });
}

/**
 * describeLocalPersonalAuthorityRuntimeContractの処理を実行する。
 *
 * @responsibility describeLocalPersonalAuthorityRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeLocalPersonalAuthorityRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeLocalPersonalAuthorityRuntimeContractの入力契約を満たす。
 * @postcondition describeLocalPersonalAuthorityRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeLocalPersonalAuthorityRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeLocalPersonalAuthorityRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeLocalPersonalAuthorityRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeLocalPersonalAuthorityRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeLocalPersonalAuthorityRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeLocalPersonalAuthorityRuntimeContractは共有非同期状態を持たない同期処理である。
 */
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
