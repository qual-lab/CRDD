export const REPOSITORY_MANIFEST_SCHEMA =
  "crdd/repository-manifest/v1" as const;
export const CROS_TRUST_POLICY_SCHEMA = "cros/trust-policy/v1" as const;

const ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
export const CROS_DIRECTORY_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const CAPABILITY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export type RepositoryManifest = Readonly<{
  schema: typeof REPOSITORY_MANIFEST_SCHEMA;
  projectId: string;
  displayName: string;
  repositoryRole: "crdd-standard" | "crdd-adopted" | "cros-host";
  capabilities: readonly string[];
  contextSurfaces: readonly string[];
  externalSendPolicy: "config/external-send-policy.json" | null;
}>;

export type CrosTrustPolicy = Readonly<{
  schema: typeof CROS_TRUST_POLICY_SCHEMA;
  trustDomainId: string;
  trustedRuntimePublishers: readonly string[];
  repositoryAdmission: "explicit-binding-only";
  maximumCapabilities: readonly string[];
  transports: readonly ("stdio" | "local-http" | "remote-http")[];
  allowUnsignedLocalDevelopment: boolean;
}>;

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

function exactKeys(value: Readonly<Record<string, unknown>>, keys: string[]) {
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key, index) => key === keys[index])
  );
}

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
      "repositoryRole",
      "schema",
    ]) ||
    record.schema !== REPOSITORY_MANIFEST_SCHEMA ||
    typeof record.projectId !== "string" ||
    !ID.test(record.projectId) ||
    typeof record.displayName !== "string" ||
    record.displayName.length < 1 ||
    record.displayName.length > 160 ||
    !["crdd-standard", "crdd-adopted", "cros-host"].includes(
      String(record.repositoryRole),
    ) ||
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
    displayName: record.displayName,
    repositoryRole:
      record.repositoryRole as RepositoryManifest["repositoryRole"],
    capabilities,
    contextSurfaces,
    externalSendPolicy:
      record.externalSendPolicy as RepositoryManifest["externalSendPolicy"],
  });
}

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
