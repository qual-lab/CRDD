import {
  createFilesystemRepositoryObservationPort,
  type RepositoryObservationPort,
} from "../../../crdd-domain-library/src/repository-observation/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

export type LegacyFieldOwner =
  | "architecture-details"
  | "implementation-symbol"
  | "quality-and-test-symbol"
  | "generated-projection";

export type LegacyFieldInventory = Readonly<{
  field: string;
  owner: LegacyFieldOwner;
  itemCount: number;
  identityCoverage: "complete" | "partial" | "not-applicable";
  semanticShape: "structured" | "partial" | "not-applicable";
  missingIds: readonly string[];
}>;

export type LegacyRuntimeInventory = Readonly<{
  subsystem: "coordinator" | "project-runtime";
  legacyPath: string;
  architecturePaths: readonly string[];
  fields: readonly LegacyFieldInventory[];
}>;

export type LegacyRuntimeInventoryFinding = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

type FieldRule = Readonly<{
  field: string;
  owner: LegacyFieldOwner;
  semanticShape: "structured" | "partial" | "not-applicable";
  valueKind: "array" | "object" | "scalar";
}>;

type PilotRule = Readonly<{
  subsystem: "coordinator" | "project-runtime";
  legacyPath: string;
  architecturePaths: readonly string[];
  fields: readonly FieldRule[];
}>;

const pilotRules: readonly PilotRule[] = [
  {
    subsystem: "coordinator",
    legacyPath: "07_Quality/Registry/coordinator-runtime-traceability.json",
    architecturePaths: [
      "06_Architecture/Details/coordinator/01_Architecture.md",
    ],
    fields: [
      {
        field: "schema",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "schemaRevision",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "effectObservationScope",
        owner: "architecture-details",
        semanticShape: "partial",
        valueKind: "scalar",
      },
      {
        field: "architectureDocument",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "resources",
        owner: "architecture-details",
        semanticShape: "partial",
        valueKind: "array",
      },
      {
        field: "states",
        owner: "architecture-details",
        semanticShape: "partial",
        valueKind: "array",
      },
      {
        field: "transitions",
        owner: "architecture-details",
        semanticShape: "partial",
        valueKind: "array",
      },
      {
        field: "attemptClassifications",
        owner: "architecture-details",
        semanticShape: "partial",
        valueKind: "array",
      },
      {
        field: "invariants",
        owner: "architecture-details",
        semanticShape: "partial",
        valueKind: "array",
      },
      {
        field: "verificationBindings",
        owner: "quality-and-test-symbol",
        semanticShape: "not-applicable",
        valueKind: "array",
      },
      {
        field: "verificationBoundaryByBinding",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "object",
      },
    ],
  },
  {
    subsystem: "project-runtime",
    legacyPath: "07_Quality/Registry/project-runtime-design-traceability.json",
    architecturePaths: [
      "06_Architecture/Details/project-runtime/01_Architecture.md",
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
    ],
    fields: [
      {
        field: "schema",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "schemaRevision",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "architectureDocument",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "designDocument",
        owner: "generated-projection",
        semanticShape: "not-applicable",
        valueKind: "scalar",
      },
      {
        field: "interfaces",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "persistentRecords",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "resources",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "locks",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "authorities",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "effects",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "stateMachines",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "actionBindings",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "invariants",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "failureInjections",
        owner: "architecture-details",
        semanticShape: "structured",
        valueKind: "array",
      },
      {
        field: "implementationBindings",
        owner: "implementation-symbol",
        semanticShape: "not-applicable",
        valueKind: "array",
      },
      {
        field: "verificationBindings",
        owner: "quality-and-test-symbol",
        semanticShape: "not-applicable",
        valueKind: "array",
      },
    ],
  },
];

function readRepositoryFile(
  repository: ReturnType<typeof createFilesystemRepositoryObservationPort>,
  repositoryRelativePath: string,
): Readonly<
  | { status: "resolved"; source: string }
  | { status: "failed"; finding: LegacyRuntimeInventoryFinding }
> {
  const observation = repository.observeFile(repositoryRelativePath);
  if (observation.status === "resolved")
    return { status: "resolved", source: observation.source };
  return {
    status: "failed",
    finding: {
      code: "semantic-coverage-pilot-input-unobservable",
      path: repositoryRelativePath,
      message: observation.reason,
    },
  };
}

function collectBacktickedIds(sources: readonly string[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(
      /`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)`/gu,
    )) {
      const id = match[1];
      if (id) ids.add(id);
    }
  }
  return ids;
}

function readLegacyItems(
  value: unknown,
  path: string,
  rule: FieldRule,
): Readonly<
  | { status: "resolved"; ids: readonly string[]; itemCount: number }
  | { status: "failed"; finding: LegacyRuntimeInventoryFinding }
> {
  const { field, valueKind } = rule;
  if (valueKind === "scalar") {
    if (
      (typeof value !== "string" || value.length === 0) &&
      (typeof value !== "number" || !Number.isInteger(value))
    )
      return {
        status: "failed",
        finding: {
          code: "semantic-coverage-pilot-field-invalid",
          path,
          message: `${field} must be one non-empty string or integer`,
        },
      };
    return { status: "resolved", ids: [], itemCount: 1 };
  }
  if (valueKind === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return {
        status: "failed",
        finding: {
          code: "semantic-coverage-pilot-field-invalid",
          path,
          message: `${field} must be an object`,
        },
      };
    return {
      status: "resolved",
      ids: Object.keys(value).sort(),
      itemCount: Object.keys(value).length,
    };
  }
  if (!Array.isArray(value))
    return {
      status: "failed",
      finding: {
        code: "semantic-coverage-pilot-field-invalid",
        path,
        message: `${field} must be an array`,
      },
    };
  const ids: string[] = [];
  for (const [index, item] of value.entries()) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "string"
    )
      return {
        status: "failed",
        finding: {
          code: "semantic-coverage-pilot-item-invalid",
          path,
          message: `${field}[${index}] must have one string id`,
        },
      };
    ids.push(item.id);
  }
  return { status: "resolved", ids: ids.sort(), itemCount: ids.length };
}

export function createLegacyRuntimeInventoriesFromObservation(
  repository: RepositoryObservationPort,
): Readonly<{
  inventories: readonly LegacyRuntimeInventory[];
  findings: readonly LegacyRuntimeInventoryFinding[];
}> {
  const inventories: LegacyRuntimeInventory[] = [];
  const findings: LegacyRuntimeInventoryFinding[] = [];

  for (const rule of pilotRules) {
    const legacyFile = readRepositoryFile(repository, rule.legacyPath);
    if (legacyFile.status === "failed") {
      findings.push(legacyFile.finding);
      continue;
    }
    let legacy: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(legacyFile.source);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new Error("root must be an object");
      legacy = parsed as Record<string, unknown>;
    } catch {
      findings.push({
        code: "semantic-coverage-pilot-json-invalid",
        path: rule.legacyPath,
        message: "legacy migration input is not one JSON object",
      });
      continue;
    }

    const architectureSources: string[] = [];
    let isArchitectureReadable = true;
    for (const architecturePath of rule.architecturePaths) {
      const sourceFile = readRepositoryFile(repository, architecturePath);
      if (sourceFile.status === "failed") {
        findings.push(sourceFile.finding);
        isArchitectureReadable = false;
      } else architectureSources.push(sourceFile.source);
    }
    if (!isArchitectureReadable) continue;
    const canonicalIds = collectBacktickedIds(architectureSources);
    const classifiedFields = new Set(rule.fields.map(({ field }) => field));
    for (const field of Object.keys(legacy)) {
      if (!classifiedFields.has(field))
        findings.push({
          code: "semantic-coverage-pilot-field-unclassified",
          path: rule.legacyPath,
          message: `${field} has no migration owner`,
        });
    }
    const fields: LegacyFieldInventory[] = [];
    for (const fieldRule of rule.fields) {
      if (!(fieldRule.field in legacy)) {
        findings.push({
          code: "semantic-coverage-pilot-field-missing",
          path: rule.legacyPath,
          message: `${fieldRule.field} is missing`,
        });
        continue;
      }
      const legacyItems = readLegacyItems(
        legacy[fieldRule.field],
        rule.legacyPath,
        fieldRule,
      );
      if (legacyItems.status === "failed") {
        findings.push(legacyItems.finding);
        continue;
      }
      const missingIds =
        fieldRule.owner === "architecture-details"
          ? legacyItems.ids.filter((id) => !canonicalIds.has(id))
          : [];
      fields.push({
        field: fieldRule.field,
        owner: fieldRule.owner,
        itemCount: legacyItems.itemCount,
        identityCoverage:
          fieldRule.owner !== "architecture-details" ||
          fieldRule.valueKind !== "array"
            ? "not-applicable"
            : missingIds.length === 0
              ? "complete"
              : "partial",
        semanticShape: fieldRule.semanticShape,
        missingIds,
      });
    }
    inventories.push({
      subsystem: rule.subsystem,
      legacyPath: rule.legacyPath,
      architecturePaths: rule.architecturePaths,
      fields,
    });
  }

  if (findings.length > 0) return { inventories: [], findings };
  return { inventories, findings: [] };
}

export function createLegacyRuntimeInventories(
  capability: VerifiedRepositoryRoot,
): Readonly<{
  inventories: readonly LegacyRuntimeInventory[];
  findings: readonly LegacyRuntimeInventoryFinding[];
}> {
  return createLegacyRuntimeInventoriesFromObservation(
    createFilesystemRepositoryObservationPort(capability),
  );
}
