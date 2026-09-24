/**
 * legacy-runtime-inventoryに属する責務をまとめる。
 *
 * @responsibility LegacyFieldOwnerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import {
  createFilesystemRepositoryObservationPort,
  type RepositoryObservationPort,
} from "../../../crdd-domain-library/src/repository-observation/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

/**
 * 旧Traceability Propertyの移行先Ownerを表す。
 *
 * @responsibility Canonical意味、実装、検証、生成Projectionの責務を分離する。
 * @trace ARCH-000008
 * @shape LegacyFieldOwnerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LegacyFieldOwnerで宣言した値と責務の対応を維持する。
 * @boundary N/A: LegacyFieldOwnerの宣言は外部境界を開かない。
 * @security N/A: LegacyFieldOwnerはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LegacyFieldOwnerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LegacyFieldOwner =
  | "architecture-details"
  | "implementation-symbol"
  | "quality-and-test-symbol"
  | "generated-projection";

/**
 * 一つの旧Propertyに対する移行判定を表す。
 *
 * @responsibility Owner、件数、Identity Coverageおよび未移行IDを保持する。
 * @trace ARCH-000008
 * @shape LegacyFieldInventoryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LegacyFieldInventoryで宣言した値と責務の対応を維持する。
 * @boundary N/A: LegacyFieldInventoryの宣言は外部境界を開かない。
 * @security N/A: LegacyFieldInventoryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LegacyFieldInventoryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LegacyFieldInventory = Readonly<{
  field: string;
  owner: LegacyFieldOwner;
  itemCount: number;
  identityCoverage: "complete" | "partial" | "not-applicable";
  semanticShape: "structured" | "partial" | "not-applicable";
  missingIds: readonly string[];
}>;

/**
 * 一つのSubsystemの旧Traceability棚卸しを表す。
 *
 * @responsibility 旧入力、Canonical Architecture入力およびProperty判定を結合する。
 * @trace ARCH-000008
 * @shape LegacyRuntimeInventoryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LegacyRuntimeInventoryで宣言した値と責務の対応を維持する。
 * @boundary N/A: LegacyRuntimeInventoryの宣言は外部境界を開かない。
 * @security N/A: LegacyRuntimeInventoryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LegacyRuntimeInventoryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LegacyRuntimeInventory = Readonly<{
  subsystem: "coordinator" | "project-runtime";
  legacyPath: string;
  architecturePaths: readonly string[];
  fields: readonly LegacyFieldInventory[];
}>;

/**
 * 旧Traceability移行で観測した不整合を表す。
 *
 * @responsibility 安定code、Pathおよびmessageを保持する。
 * @trace ARCH-000008
 * @shape LegacyRuntimeInventoryFindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LegacyRuntimeInventoryFindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: LegacyRuntimeInventoryFindingの宣言は外部境界を開かない。
 * @security N/A: LegacyRuntimeInventoryFindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LegacyRuntimeInventoryFindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LegacyRuntimeInventoryFinding = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

/**
 * 一つの旧Propertyを分類する固定規則を表す。
 *
 * @responsibility 期待Owner、構造化度および値種別を宣言する。
 * @trace ARCH-000008
 * @shape FieldRuleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FieldRuleで宣言した値と責務の対応を維持する。
 * @boundary N/A: FieldRuleの宣言は外部境界を開かない。
 * @security N/A: FieldRuleはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FieldRuleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FieldRule = Readonly<{
  field: string;
  owner: LegacyFieldOwner;
  semanticShape: "structured" | "partial" | "not-applicable";
  valueKind: "array" | "object" | "scalar";
}>;

/**
 * Pilot対象Subsystemの旧入力とCanonical比較範囲を表す。
 *
 * @responsibility 棚卸し対象を閉じたProperty集合として固定する。
 * @trace ARCH-000008
 * @shape PilotRuleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PilotRuleで宣言した値と責務の対応を維持する。
 * @boundary N/A: PilotRuleの宣言は外部境界を開かない。
 * @security N/A: PilotRuleはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PilotRuleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Repository Observation Portから移行入力を読み取る。
 *
 * @responsibility 観測不能を例外で失わず安定Findingへ変換する。
 * @trace ARCH-000008
 * @input repository: ReturnType<typeof createFilesystemRepositoryObservationPort>、repositoryRelativePath: string
 * @returns Readonly< | { status: "resolved"; source: string } | { status: "failed"; finding: LegacyRuntimeInventoryFinding } >を返す。
 * @precondition repository: ReturnType<typeof createFilesystemRepositoryObservationPort>、repositoryRelativePath: stringがreadRepositoryFileの入力契約を満たす。
 * @postcondition readRepositoryFileの責務を完了した結果だけを返す。
 * @effect N/A: readRepositoryFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readRepositoryFileは独自の失敗分岐を所有しない。
 * @invariant readRepositoryFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository Observation Portとの読取り境界。
 * @security N/A: readRepositoryFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRepositoryFileは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Canonical文書から明示されたBacktick ID集合を抽出する。
 *
 * @responsibility 自由文を解釈せず識別子形だけを比較入力にする。
 * @trace ARCH-000008
 * @input sources: readonly string[]
 * @returns ReadonlySet<string>を返す。
 * @precondition sources: readonly string[]がcollectBacktickedIdsの入力契約を満たす。
 * @postcondition collectBacktickedIdsの責務を完了した結果だけを返す。
 * @effect N/A: collectBacktickedIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: collectBacktickedIdsは独自の失敗分岐を所有しない。
 * @invariant collectBacktickedIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: collectBacktickedIdsはProcess内の同一Subsystemで完結する。
 * @security N/A: collectBacktickedIdsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: collectBacktickedIdsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * 旧Property値を宣言済み種別に従って検証・列挙する。
 *
 * @responsibility Scalar、Object、Arrayの受理集合とIdentity抽出を固定する。
 * @trace ARCH-000008
 * @input value: unknown、path: string、rule: FieldRule
 * @returns Readonly< | { status: "resolved"; ids: readonly string[]; itemCount: number } | { status: "failed"; finding: LegacyRuntimeInventoryFinding } >を返す。
 * @precondition value: unknown、path: string、rule: FieldRuleがreadLegacyItemsの入力契約を満たす。
 * @postcondition readLegacyItemsの責務を完了した結果だけを返す。
 * @effect N/A: readLegacyItemsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不正shapeやID欠落を空集合へ畳まない。
 * @invariant readLegacyItemsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readLegacyItemsはProcess内の同一Subsystemで完結する。
 * @security N/A: readLegacyItemsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readLegacyItemsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * 観測Port上の旧JSONとCanonical Architectureを比較する。
 *
 * @responsibility 全PropertyをOwnerへ分類し、未分類・欠落・未移行IDをFindingにする。
 * @trace ARCH-000008
 * @input repository: RepositoryObservationPort
 * @returns Readonly<{ inventories: readonly LegacyRuntimeInventory[]; findings: readonly LegacyRuntimeInventoryFinding[]; }>を返す。
 * @precondition repository: RepositoryObservationPortがcreateLegacyRuntimeInventoriesFromObservationの入力契約を満たす。
 * @postcondition createLegacyRuntimeInventoriesFromObservationの責務を完了した結果だけを返す。
 * @effect N/A: createLegacyRuntimeInventoriesFromObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createLegacyRuntimeInventoriesFromObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant Findingがある場合は部分Inventoryを公開しない。
 * @boundary N/A: createLegacyRuntimeInventoriesFromObservationはProcess内の同一Subsystemで完結する。
 * @security N/A: createLegacyRuntimeInventoriesFromObservationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createLegacyRuntimeInventoriesFromObservationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * 検証済みRepository Rootから旧Traceability棚卸しを開始する。
 *
 * @responsibility Repository Capabilityを観測Portへ変換して純粋な棚卸し処理へ渡す。
 * @trace ARCH-000008
 * @input capability: VerifiedRepositoryRoot
 * @returns Readonly<{ inventories: readonly LegacyRuntimeInventory[]; findings: readonly LegacyRuntimeInventoryFinding[]; }>を返す。
 * @precondition capability: VerifiedRepositoryRootがcreateLegacyRuntimeInventoriesの入力契約を満たす。
 * @postcondition createLegacyRuntimeInventoriesの責務を完了した結果だけを返す。
 * @effect N/A: createLegacyRuntimeInventoriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createLegacyRuntimeInventoriesは独自の失敗分岐を所有しない。
 * @invariant createLegacyRuntimeInventoriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済みRepository RootとMigration Applicationの境界。
 * @security N/A: createLegacyRuntimeInventoriesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createLegacyRuntimeInventoriesは共有非同期状態を持たない同期処理である。
 */
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
