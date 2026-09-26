/**
 * runtime-data-contractに属する責務をまとめる。
 *
 * @responsibility RepositoryManifestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000011
 */
export const REPOSITORY_MANIFEST_SCHEMA =
  "crdd/repository-manifest/v2" as const;
export const CROS_TRUST_POLICY_SCHEMA = "cros/trust-policy/v1" as const;

const ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
export const CROS_DIRECTORY_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const CAPABILITY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

/**
 * runtime-data-contractで使用するRepository Manifestの値契約を定義する。
 *
 * @responsibility Repository ManifestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryManifestの宣言は外部境界を開かない。
 * @security N/A: RepositoryManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryManifest = Readonly<{
  schema: typeof REPOSITORY_MANIFEST_SCHEMA;
  projectId: string;
  repositoryId: string;
  displayName: string;
  repositoryRole: string;
  capabilities: readonly string[];
  contextSurfaces: readonly string[];
  externalSendPolicy: "config/external-send-policy.json" | null;
}>;

/**
 * runtime-data-contractで使用するCros Trust Policyの値契約を定義する。
 *
 * @responsibility Cros Trust PolicyのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape CrosTrustPolicyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CrosTrustPolicyで宣言した値と責務の対応を維持する。
 * @boundary N/A: CrosTrustPolicyの宣言は外部境界を開かない。
 * @security N/A: CrosTrustPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CrosTrustPolicyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CrosTrustPolicy = Readonly<{
  schema: typeof CROS_TRUST_POLICY_SCHEMA;
  trustDomainId: string;
  trustedRuntimePublishers: readonly string[];
  repositoryAdmission: "explicit-binding-only";
  maximumCapabilities: readonly string[];
  transports: readonly ("stdio" | "local-http" | "remote-http")[];
  allowUnsignedLocalDevelopment: boolean;
}>;

/**
 * 記録をPlain Dataとして検証する。
 *
 * @responsibility 記録の許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000011
 * @input value: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown」がplainRecordの入力契約を満たす。
 * @postcondition plainRecordの責務を完了した結果だけを返す。
 * @effect N/A: plainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainRecordは独自の失敗分岐を所有しない。
 * @invariant plainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: plainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainRecordは共有非同期状態を持たない同期処理である。
 */
function plainRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return null;
  return value as Readonly<Record<string, unknown>>;
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000011
 * @input value: Readonly<Record<string, unknown>>、keys: string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: Readonly<Record<string, unknown>>、keys: string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security N/A: exactKeysはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: Readonly<Record<string, unknown>>, keys: string[]) {
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key, index) => key === keys[index])
  );
}

/**
 * identifiersを決定する。
 *
 * @responsibility identifiersの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input value: unknown、pattern: RegExp
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown、pattern: RegExp」がidentifiersの入力契約を満たす。
 * @postcondition identifiersの責務を完了した結果だけを返す。
 * @effect N/A: identifiersは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identifiersは独自の失敗分岐を所有しない。
 * @invariant identifiersは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identifiersはProcess内の同一Subsystemで完結する。
 * @security N/A: identifiersはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: identifiersは共有非同期状態を持たない同期処理である。
 */
function identifiers(
  value: unknown,
  pattern: RegExp,
): readonly string[] | null {
  if (!Array.isArray(value) || value.length > 128) return null;
  const identifiers: string[] = [];
  for (const item of value) {
    if (
      typeof item !== "string" ||
      !pattern.test(item) ||
      identifiers.includes(item)
    )
      return null;
    identifiers.push(item);
  }
  return Object.freeze(identifiers);
}

/**
 * Repository Manifestを観測する。
 *
 * @responsibility Repository Manifestの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000011
 * @input value: unknown
 * @returns RepositoryManifest | nullを返す。
 * @precondition 「value: unknown」がinspectRepositoryManifestの入力契約を満たす。
 * @postcondition inspectRepositoryManifestの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRepositoryManifestは独自の失敗分岐を所有しない。
 * @invariant inspectRepositoryManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryManifestはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRepositoryManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRepositoryManifestは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryManifest(
  value: unknown,
): RepositoryManifest | null {
  const record = plainRecord(value);
  if (
    !record ||
    !exactKeys(record, [
      "capabilities",
      "contextSurfaces",
      "displayName",
      "externalSendPolicy",
      "projectId",
      "repositoryId",
      "repositoryRole",
      "schema",
    ]) ||
    record.schema !== REPOSITORY_MANIFEST_SCHEMA ||
    typeof record.projectId !== "string" ||
    !ID.test(record.projectId) ||
    typeof record.repositoryId !== "string" ||
    !ID.test(record.repositoryId) ||
    record.repositoryId === record.projectId ||
    typeof record.displayName !== "string" ||
    record.displayName.length < 1 ||
    record.displayName.length > 160 ||
    typeof record.repositoryRole !== "string" ||
    !ID.test(record.repositoryRole) ||
    ![null, "config/external-send-policy.json"].includes(
      record.externalSendPolicy as null | string,
    )
  )
    return null;
  const capabilities = identifiers(record.capabilities, CAPABILITY);
  const contextSurfaces = identifiers(record.contextSurfaces, CAPABILITY);
  if (!capabilities || !contextSurfaces) return null;
  return Object.freeze({
    schema: REPOSITORY_MANIFEST_SCHEMA,
    projectId: record.projectId,
    repositoryId: record.repositoryId,
    displayName: record.displayName,
    repositoryRole: record.repositoryRole,
    capabilities,
    contextSurfaces,
    externalSendPolicy:
      record.externalSendPolicy as RepositoryManifest["externalSendPolicy"],
  });
}

/**
 * Cros Trust Policyを観測する。
 *
 * @responsibility Cros Trust Policyの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000011
 * @input value: unknown
 * @returns CrosTrustPolicy | nullを返す。
 * @precondition 「value: unknown」がinspectCrosTrustPolicyの入力契約を満たす。
 * @postcondition inspectCrosTrustPolicyの責務を完了した結果だけを返す。
 * @effect N/A: inspectCrosTrustPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCrosTrustPolicyは独自の失敗分岐を所有しない。
 * @invariant inspectCrosTrustPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCrosTrustPolicyはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCrosTrustPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCrosTrustPolicyは共有非同期状態を持たない同期処理である。
 */
export function inspectCrosTrustPolicy(value: unknown): CrosTrustPolicy | null {
  const record = plainRecord(value);
  if (
    !record ||
    !exactKeys(record, [
      "allowUnsignedLocalDevelopment",
      "maximumCapabilities",
      "repositoryAdmission",
      "schema",
      "transports",
      "trustDomainId",
      "trustedRuntimePublishers",
    ]) ||
    record.schema !== CROS_TRUST_POLICY_SCHEMA ||
    typeof record.trustDomainId !== "string" ||
    !CROS_DIRECTORY_ID.test(record.trustDomainId) ||
    record.trustDomainId === "default" ||
    record.repositoryAdmission !== "explicit-binding-only" ||
    typeof record.allowUnsignedLocalDevelopment !== "boolean"
  )
    return null;
  const publishers = identifiers(
    record.trustedRuntimePublishers,
    CROS_DIRECTORY_ID,
  );
  const maximumCapabilities = identifiers(
    record.maximumCapabilities,
    CAPABILITY,
  );
  const transports = identifiers(
    record.transports,
    /^(?:stdio|local-http|remote-http)$/u,
  );
  if (
    !publishers ||
    publishers.length === 0 ||
    !maximumCapabilities ||
    !transports
  )
    return null;
  return Object.freeze({
    schema: CROS_TRUST_POLICY_SCHEMA,
    trustDomainId: record.trustDomainId,
    trustedRuntimePublishers: publishers,
    repositoryAdmission: "explicit-binding-only",
    maximumCapabilities,
    transports: transports as CrosTrustPolicy["transports"],
    allowUnsignedLocalDevelopment: record.allowUnsignedLocalDevelopment,
  });
}
