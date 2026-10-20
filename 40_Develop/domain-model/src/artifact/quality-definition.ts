/**
 * Quality Definitionの本文とLocal ID所有重複を検査する。
 * @responsibility 情報源・適用条件・検証項目・段階・追加種別の意味と部分関係を所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
/**
 * Quality Definitionから抽出した関係・条件・検査結果を表す。
 * @responsibility Quality Definitionから抽出した関係・条件・検査結果を表す。
 * @trace ARCH-000008
 * @shape sourceRelations、sourceRelationEntries、sourceConditions、sourceGoalLevels、obligationKeys、obligationKeyEntries、detailGoalRelations、detailGoalRelationEntries、goalLocalRelations、goalLocalRelationEntries、localItemLevels、localItemBoundaryStages、localIds、issues。
 * @invariant 不正な行からも取得できる関係・後勝ち値・重複出現を保持する。
 * @boundary N/A: 取得済み本文の値モデル。
 * @security 認可・品質成立や実行許可を発行しない。
 * @compatibility 既存の本文条件・後勝ちMap・出現順を維持する。
 */
export type QualityDefinitionModel = Readonly<{
  sourceRelations: ReadonlySet<string>;
  sourceRelationEntries: readonly string[];
  sourceConditions: ReadonlyMap<string, string>;
  sourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
  obligationKeys: ReadonlyMap<string, string>;
  obligationKeyEntries: readonly string[];
  detailGoalRelations: ReadonlySet<string>;
  detailGoalRelationEntries: readonly string[];
  goalLocalRelations: ReadonlySet<string>;
  goalLocalRelationEntries: readonly string[];
  localItemLevels: ReadonlyMap<string, string>;
  localItemBoundaryStages: ReadonlyMap<string, string>;
  localIds: readonly string[];
  issues: readonly DomainIssue[];
}>;
/**
 * Local ID所有確認後の局所Mapと重複Issueを表す。
 * @responsibility Local ID所有確認後の局所Mapと重複Issueを表す。
 * @trace ARCH-000008
 * @shape owners、issues。
 * @invariant 入力Ownerは変更せず、先勝ちの所有と出現ごとの重複を維持する。
 * @boundary N/A: 取得済み本文の値モデル。
 * @security 認可・品質成立や実行許可を発行しない。
 * @compatibility 先勝ちの所有と、同じIDの後続出現ごとの重複診断を維持する。
 */
export type QualityLocalItemOwnershipModel = Readonly<{
  owners: ReadonlyMap<string, string>;
  issues: readonly DomainIssue[];
}>;
/**
 * 情報源固有の条件文字列を正規化する。
 * @responsibility 情報源固有の条件文字列を正規化する。
 * @trace ARCH-000008
 * @input value: 条件セル文字列。
 * @returns trimと連続空白の単一空白化後の条件。
 * @precondition valueは解析した文字列である。
 * @postcondition 入力を変更しない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 大小文字や記号を同一視しない。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function normalizeQualityCondition(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}
/**
 * Quality Definitionの本文条件と部分関係を検査する。
 * @responsibility Quality Definitionの本文条件と部分関係を検査する。
 * @trace ARCH-000008
 * @input artifact: 取得済み生本文と診断位置。qualityId: Directory由来のQA-ID。
 * @returns 関係集合・出現列、条件・段階・境界等のMap、Local ID出現列とIssue。
 * @precondition 呼出し元が正規QA DirectoryのIDと生本文を取得している。
 * @postcondition 不正本文でも解析できた関係を返し、Fileを読み直さない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 生本文、単純pipe、後勝ちMap、Header不正後の継続とIssue順を維持する。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityDefinition(
  artifact: ArtifactSource,
  qualityId: string,
): QualityDefinitionModel {
  const definition = artifact.content,
    sourcePath = artifact.path;
  const issues: DomainIssue[] = [];
  const definitionSourceRelations = new Set<string>();
  const definitionSourceRelationEntries: string[] = [];
  const definitionSourceConditions = new Map<string, string>();
  const definitionSourceGoalLevels = new Map<string, Set<string>>();
  const definitionObligationKeys = new Map<string, string>();
  const definitionObligationKeyEntries: string[] = [];
  const definitionDetailGoalRelations = new Set<string>();
  const definitionDetailGoalRelationEntries: string[] = [];
  const definitionGoalLocalRelations = new Set<string>();
  const definitionGoalLocalRelationEntries: string[] = [];
  const localItemLevels = new Map<string, string>();
  const localItemBoundaryStages = new Map<string, string>();

  const declaredQualityId = definition.match(
    /^Quality ID:\s*`(QA-[0-9]{6})`\s*$/mu,
  )?.[1];
  if (
    declaredQualityId !== qualityId ||
    !new RegExp(`^# ${qualityId}\\s+\\S`, "mu").test(definition)
  )
    issues.push({
      kind: "artifact.quality.definition-identity-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-identity-mismatch",
      details: {},
    });
  const coverageSection = definition.match(
    /^## 1\. 情報源と網羅条件\s*$([\s\S]*?)(?=^##\s)/mu,
  )?.[1];
  if (!coverageSection)
    issues.push({
      kind: "artifact.quality.definition-source-coverage-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-source-coverage-missing",
      details: {},
    });
  for (const line of (coverageSection ?? "").split(/\r?\n/u)) {
    const relation = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\([^)]+\)\s*\|\s*`([a-z0-9.-]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!relation) continue;
    const [
      ,
      sourceId,
      obligationKey,
      derivationSource,
      condition,
      levelCell,
      localCell,
    ] = relation as [string, string, string, string, string, string, string];
    const requestedLevels = new Set(
      Array.from(levelCell.matchAll(/UT|IT|ST|UAT/gu), (match) => match[0]),
    );
    const localIds = Array.from(
      localCell.matchAll(/`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu),
      (match) => match[1] as string,
    );
    if (
      obligationKey !==
        `${sourceId.toLowerCase()}.${qualityId.toLowerCase()}` ||
      derivationSource.trim().length === 0 ||
      condition.trim().length === 0 ||
      requestedLevels.size === 0 ||
      localIds.length === 0
    )
      issues.push({
        kind: "artifact.quality.definition-source-local-relation-incomplete",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "definition-source-local-relation-incomplete",
        details: {},
      });
    definitionSourceConditions.set(
      `${sourceId}|${qualityId}`,
      normalizeQualityCondition(condition),
    );
    definitionObligationKeyEntries.push(obligationKey);
    definitionObligationKeys.set(`${sourceId}|${qualityId}`, obligationKey);
    definitionSourceGoalLevels.set(`${sourceId}|${qualityId}`, requestedLevels);
    for (const localId of localIds) {
      const relation = `${sourceId}|${qualityId}|${localId}`;
      definitionSourceRelationEntries.push(relation);
      definitionSourceRelations.add(relation);
    }
  }
  const detailCoverageSection = definition.match(
    /^### Architecture詳細設計入力\s*$([\s\S]*?)(?=^##\s)/mu,
  )?.[1];
  if (!detailCoverageSection)
    issues.push({
      kind: "artifact.quality.definition-detail-coverage-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-detail-coverage-missing",
      details: {},
    });
  for (const detail of (detailCoverageSection ?? "").matchAll(
    /\[([a-z0-9-]+)\]\(\.\.\/\.\.\/\.\.\/06_Architecture\/Details\/\1\/01_Architecture\.md\)/gu,
  )) {
    const relation = `${detail[1]}|${qualityId}`;
    definitionDetailGoalRelationEntries.push(relation);
    definitionDetailGoalRelations.add(relation);
  }
  const stateApplicabilitySection = definition.match(
    /^### 条件区分の適用\s*$([\s\S]*?)(?=^##\s)/mu,
  )?.[1];
  const stateApplicability = new Map<
    string,
    { applicability: string; localItems: string[]; rationale: string }
  >();
  for (const line of (stateApplicabilitySection ?? "").split(/\r?\n/u)) {
    const row = line.match(
      /^\|\s*(正常|境界|準正常|異常|回復)\s*\|\s*(Required|N\/A)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!row) continue;
    stateApplicability.set(row[1] as string, {
      applicability: row[2] as string,
      localItems: [
        ...(row[3] as string).matchAll(
          /[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}/gu,
        ),
      ].map((match) => match[0]),
      rationale: (row[4] as string).trim(),
    });
  }
  if (
    ["正常", "境界", "準正常", "異常", "回復"].some(
      (state) => !stateApplicability.has(state),
    )
  )
    issues.push({
      kind: "artifact.quality.verification-state-applicability-incomplete",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "verification-state-applicability-incomplete",
      details: {},
    });
  const itemSection = definition.match(
    /^## [0-9]+\. 検証項目\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const expectedItemColumns = [
    "Local ID",
    "条件区分",
    "試験段階",
    "試験種別",
    "対象／境界",
    "外部境界の段階",
    "事前状態／入力",
    "操作／刺激",
    "観測",
    "Oracle",
    "Evidence",
    "終了後条件",
    "実行形態",
  ];
  const itemTableLines = (itemSection ?? "")
    .split(/\r?\n/u)
    .filter((line) => /^\|.*\|\s*$/u.test(line));
  const localItemLevelStages: Array<{
    level: string;
    externalBoundaryStage: string;
  }> = [];
  const definitionLocalIds = new Set<string>();
  const definitionLocalConditionClasses = new Map<string, string>();
  const itemHeaderCells = itemTableLines[0]
    ?.slice(1, itemTableLines[0].lastIndexOf("|"))
    .split("|")
    .map((cell) => cell.trim());
  if (
    !itemHeaderCells ||
    itemHeaderCells.length !== expectedItemColumns.length ||
    itemHeaderCells.some((cell, index) => cell !== expectedItemColumns[index])
  )
    issues.push({
      kind: "artifact.quality.verification-item-schema-invalid",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "verification-item-schema-invalid",
      details: {},
    });
  for (const itemLine of itemTableLines.slice(2)) {
    if (
      !/^\|\s*`[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}`\s*\|/u.test(itemLine)
    )
      continue;
    const cells = itemLine
      .slice(1, itemLine.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length === expectedItemColumns.length)
      localItemLevelStages.push({
        level: cells[2] as string,
        externalBoundaryStage: cells[5] as string,
      });
    if (cells.length === expectedItemColumns.length) {
      const localId = (cells[0] as string).match(
        /^`([A-Z][A-Z0-9]*-(UT|IT|ST|UAT)-[0-9]{3})`$/u,
      )?.[1];
      if (localId) {
        const identifierLevel = (cells[0] as string).match(
          /^`[A-Z][A-Z0-9]*-(UT|IT|ST|UAT)-[0-9]{3}`$/u,
        )?.[1];
        if (identifierLevel !== (cells[2] as string))
          issues.push({
            kind: "artifact.quality.verification-item-id-level-mismatch",
            targetIdentity: sourcePath,
            location: { path: sourcePath },
            reason: "verification-item-id-level-mismatch",
            details: { localId },
          });
        localItemLevels.set(localId, cells[2] as string);
        localItemBoundaryStages.set(localId, cells[5] as string);
        definitionLocalIds.add(localId);
        definitionLocalConditionClasses.set(localId, cells[1] as string);
      }
    }
    if (
      cells.length !== expectedItemColumns.length ||
      cells.some((cell) => cell.length === 0)
    )
      issues.push({
        kind: "artifact.quality.verification-item-axis-missing",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-axis-missing",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      !["正常", "境界", "準正常", "異常", "回復"].includes(cells[1] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-condition-class-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-condition-class-invalid",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      !["UT", "IT", "ST", "UAT"].includes(cells[2] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-test-level-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-test-level-invalid",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      ![
        "N/A",
        "Direct Boundary",
        "Adjacent 1 Block",
        "Related 2 Blocks",
        "System/E2E",
        "User Acceptance",
      ].includes(cells[5] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-external-boundary-stage-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-external-boundary-stage-invalid",
        details: {},
      });
    if (
      cells.length === expectedItemColumns.length &&
      !["Automated", "Manual", "Hybrid"].includes(cells[12] as string)
    )
      issues.push({
        kind: "artifact.quality.verification-item-execution-mode-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-item-execution-mode-invalid",
        details: {},
      });
  }
  for (const [state, entry] of stateApplicability) {
    if (entry.rationale.length === 0)
      issues.push({
        kind: "artifact.quality.verification-state-applicability-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-state-applicability-invalid",
        details: { state, violation: "rationale" },
      });
    const classLocalItems = [...definitionLocalConditionClasses]
      .filter(([, conditionClass]) => conditionClass === state)
      .map(([localId]) => localId);
    if (
      (entry.applicability === "Required" &&
        (entry.localItems.length === 0 ||
          entry.localItems.some(
            (localId) =>
              !definitionLocalIds.has(localId) ||
              definitionLocalConditionClasses.get(localId) !== state,
          ) ||
          classLocalItems.some(
            (localId) => !entry.localItems.includes(localId),
          ))) ||
      (entry.applicability === "N/A" &&
        (entry.localItems.length > 0 || classLocalItems.length > 0))
    )
      issues.push({
        kind: "artifact.quality.verification-state-applicability-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "verification-state-applicability-invalid",
        details: { state, violation: "local-items" },
      });
  }
  const applicabilitySection = definition.match(
    /^## [0-9]+\. 試験段階と外部境界の適用\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const applicabilityRows = new Map<
    string,
    { applicability: string; externalBoundaryReach: string }
  >();
  for (const line of (applicabilitySection ?? "").split(/\r?\n/u)) {
    const row = line.match(
      /^\|\s*(UT|IT|ST|UAT)\s*\|\s*(Required|Conditional|N\/A)\s*\|\s*([^|]+)\|\s*(N\/A|Direct Boundary|Adjacent 1 Block|Related 2 Blocks|System\/E2E|User Acceptance)\s*\|\s*([^|]+)\|\s*$/u,
    );
    if (!row) continue;
    applicabilityRows.set(row[1] as string, {
      applicability: row[2] as string,
      externalBoundaryReach: row[4] as string,
    });
  }
  if (
    applicabilityRows.size !== 4 ||
    ["UT", "IT", "ST", "UAT"].some((level) => !applicabilityRows.has(level))
  )
    issues.push({
      kind: "artifact.quality.test-level-applicability-incomplete",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "test-level-applicability-incomplete",
      details: {},
    });
  const requiredLevelDisplay = new Map([
    ["UT", "Unit"],
    ["IT", "Integration"],
    ["ST", "System"],
    ["UAT", "User Acceptance"],
  ]);
  const primaryLevelText =
    definition.match(/^主な試験段階:\s*(.+?)\s*$/mu)?.[1];
  const expectedPrimaryLevels = ["UT", "IT", "ST", "UAT"]
    .filter(
      (level) => applicabilityRows.get(level)?.applicability === "Required",
    )
    .map((level) => requiredLevelDisplay.get(level));
  if (
    !primaryLevelText ||
    primaryLevelText
      .split("／")
      .map((level) => level.trim())
      .join("／") !== expectedPrimaryLevels.join("／")
  )
    issues.push({
      kind: "artifact.quality.primary-test-level-summary-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "primary-test-level-summary-mismatch",
      details: {},
    });

  const additionalTypeSection = definition.match(
    /^## 追加試験種別の適用\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const additionalTypeRows = new Map<
    string,
    { applicability: string; authorization: string }
  >();
  for (const line of (additionalTypeSection ?? "").split(/\r?\n/u)) {
    const row = line.match(
      /^\|\s*(RT|PT|LT)\s*\|\s*(Required|Conditional|N\/A)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!row) continue;
    additionalTypeRows.set(row[1] as string, {
      applicability: row[2] as string,
      authorization: (row[4] as string).trim(),
    });
  }
  if (
    additionalTypeRows.size !== 3 ||
    ["RT", "PT", "LT"].some((type) => !additionalTypeRows.has(type))
  )
    issues.push({
      kind: "artifact.quality.additional-test-type-applicability-incomplete",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "additional-test-type-applicability-incomplete",
      details: {},
    });
  for (const type of ["PT", "LT"]) {
    const row = additionalTypeRows.get(type);
    if (
      row &&
      ((row.applicability === "N/A" && row.authorization !== "N/A") ||
        (row.applicability !== "N/A" &&
          row.authorization !== "Human Explicit Authorization"))
    )
      issues.push({
        kind: "artifact.quality.expensive-test-authorization-invalid",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "expensive-test-authorization-invalid",
        details: {},
      });
  }
  const externalBoundaryStageOrder = new Map([
    ["N/A", 0],
    ["Direct Boundary", 1],
    ["Adjacent 1 Block", 2],
    ["Related 2 Blocks", 3],
    ["System/E2E", 4],
    ["User Acceptance", 5],
  ]);
  for (const level of ["UT", "IT", "ST", "UAT"]) {
    const applicability = applicabilityRows.get(level);
    if (!applicability) continue;
    const localItems = localItemLevelStages.filter(
      (item) => item.level === level,
    );
    const declaredReach = externalBoundaryStageOrder.get(
      applicability.externalBoundaryReach,
    );
    const hasItemBeyondDeclaredReach = localItems.some((item) => {
      const itemReach = externalBoundaryStageOrder.get(
        item.externalBoundaryStage,
      );
      return (
        declaredReach !== undefined &&
        itemReach !== undefined &&
        itemReach > declaredReach
      );
    });
    if (
      (applicability.applicability === "Required" && localItems.length === 0) ||
      (applicability.applicability === "N/A" && localItems.length > 0) ||
      hasItemBeyondDeclaredReach
    )
      issues.push({
        kind: "artifact.quality.test-level-applicability-conflict",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "test-level-applicability-conflict",
        details: {},
      });
  }
  const localIds = Array.from(
    (itemSection ?? "").matchAll(
      /^\|\s*`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`\s*\|/gmu,
    ),
    (match) => match[1] as string,
  );
  if (localIds.length === 0)
    issues.push({
      kind: "artifact.quality.definition-verification-items-missing",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "definition-verification-items-missing",
      details: {},
    });
  for (const localId of localIds) {
    const goalLocalRelation = `${qualityId}|${localId}`;
    definitionGoalLocalRelationEntries.push(goalLocalRelation);
    definitionGoalLocalRelations.add(goalLocalRelation);
  }

  return {
    sourceRelations: definitionSourceRelations,
    sourceRelationEntries: definitionSourceRelationEntries,
    sourceConditions: definitionSourceConditions,
    sourceGoalLevels: definitionSourceGoalLevels,
    obligationKeys: definitionObligationKeys,
    obligationKeyEntries: definitionObligationKeyEntries,
    detailGoalRelations: definitionDetailGoalRelations,
    detailGoalRelationEntries: definitionDetailGoalRelationEntries,
    goalLocalRelations: definitionGoalLocalRelations,
    goalLocalRelationEntries: definitionGoalLocalRelationEntries,
    localItemLevels: localItemLevels,
    localItemBoundaryStages: localItemBoundaryStages,
    localIds,
    issues,
  };
}
/**
 * Local ID出現列の所有重複を検査する。
 * @responsibility Local ID出現列の所有重複を検査する。
 * @trace ARCH-000008
 * @input sourcePath: 現在の定義の診断位置。localIds: 項目の独立抽出出現列。existingOwners: 以前の定義までのOwner Map。
 * @returns 先勝ちのOwner Map複製と出現ごとの重複Issue。
 * @precondition 本文検査後の元位置で呼び、集合化していない出現列を渡す。
 * @postcondition 入力Mapを変更せず、重複時にOwnerを上書きしない。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant 同一File内重複も検出し、既存のpreviousOwnerの真偽判定を維持する。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityLocalItemOwnership(
  sourcePath: string,
  localIds: readonly string[],
  existingOwners: ReadonlyMap<string, string>,
): QualityLocalItemOwnershipModel {
  const owners = new Map(existingOwners),
    issues: DomainIssue[] = [];
  for (const localId of localIds) {
    const previousOwner = owners.get(localId);
    if (previousOwner)
      issues.push({
        kind: "artifact.quality.local-verification-id-duplicate",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "local-verification-id-duplicate",
        details: { localId, previousOwner },
      });
    else owners.set(localId, sourcePath);
  }
  return { owners, issues };
}
