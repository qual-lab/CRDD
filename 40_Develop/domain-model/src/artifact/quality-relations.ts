/**
 * Quality分析・定義・Detail引渡しの集合閉包を検査する。
 * @responsibility 取得済み値の関係照合を所有し、Filesystemと診断表示は所有しない。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
/**
 * Quality分析と定義の情報源・条件・段階・Detail関係の双方向閉包を照合する。
 * @responsibility Quality分析と定義の情報源・条件・段階・Detail関係の双方向閉包を照合する。
 * @trace ARCH-000008
 * @input request: 分析・定義の関係集合、出現列、条件・段階・Obligation KeyのMap、診断位置。
 * @returns 重複、情報源・目標・条件・段階・Detail関係の閉包不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 関係条件不一致をIssueで返し、入力を変更しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityDefinitionRelations(
  request: Readonly<{
    definitionSourceRelationEntries: readonly string[];
    definitionSourceRelations: ReadonlySet<string>;
    definitionGoalLocalRelationEntries: readonly string[];
    definitionGoalLocalRelations: ReadonlySet<string>;
    definitionDetailGoalRelationEntries: readonly string[];
    definitionDetailGoalRelations: ReadonlySet<string>;
    analysisDetailGoalRelations: ReadonlySet<string>;
    analysisSourceRelations: ReadonlySet<string>;
    definitionObligationKeyEntries: readonly string[];
    analysisObligationKeys: ReadonlyMap<string, string>;
    definitionObligationKeys: ReadonlyMap<string, string>;
    analysisSourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
    localItemLevels: ReadonlyMap<string, string>;
    summarySourceLevels: ReadonlyMap<string, ReadonlySet<string>>;
    definitionSourceGoalLevels: ReadonlyMap<string, ReadonlySet<string>>;
    analysisSourceConditions: ReadonlyMap<string, string>;
    definitionSourceConditions: ReadonlyMap<string, string>;
    definitionsRoot: string;
    analysisPath: string;
  }>,
) {
  const {
    definitionSourceRelationEntries,
    definitionSourceRelations,
    definitionGoalLocalRelationEntries,
    definitionGoalLocalRelations,
    definitionDetailGoalRelationEntries,
    definitionDetailGoalRelations,
    analysisDetailGoalRelations,
    analysisSourceRelations,
    definitionObligationKeyEntries,
    analysisObligationKeys,
    definitionObligationKeys,
    analysisSourceGoalLevels,
    localItemLevels,
    summarySourceLevels,
    definitionSourceGoalLevels,
    analysisSourceConditions,
    definitionSourceConditions,
    definitionsRoot,
    analysisPath,
  } = request;
  const issues: DomainIssue[] = [];
  if (definitionSourceRelationEntries.length !== definitionSourceRelations.size)
    issues.push({
      kind: "artifact.quality-relations.definition-source-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-source-relation-duplicate",
      details: {},
    });
  if (
    definitionGoalLocalRelationEntries.length !==
    definitionGoalLocalRelations.size
  )
    issues.push({
      kind: "artifact.quality-relations.definition-goal-local-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-goal-local-relation-duplicate",
      details: {},
    });
  if (
    definitionDetailGoalRelationEntries.length !==
    definitionDetailGoalRelations.size
  )
    issues.push({
      kind: "artifact.quality-relations.definition-detail-goal-relation-duplicate",
      targetIdentity: definitionsRoot,
      location: { path: definitionsRoot },
      reason: "definition-detail-goal-relation-duplicate",
      details: {},
    });
  if (
    analysisDetailGoalRelations.size !== definitionDetailGoalRelations.size ||
    [...analysisDetailGoalRelations].some(
      (relation) => !definitionDetailGoalRelations.has(relation),
    ) ||
    [...definitionDetailGoalRelations].some(
      (relation) => !analysisDetailGoalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.detail-goal-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "detail-goal-relation-closure-mismatch",
      details: {},
    });

  if (
    analysisSourceRelations.size !== definitionSourceRelations.size ||
    [...analysisSourceRelations].some(
      (relation) => !definitionSourceRelations.has(relation),
    ) ||
    [...definitionSourceRelations].some(
      (relation) => !analysisSourceRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.source-local-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-closure-mismatch",
      details: {},
    });
  if (
    definitionObligationKeyEntries.length !==
      new Set(definitionObligationKeyEntries).size ||
    analysisObligationKeys.size !== definitionObligationKeys.size ||
    [...analysisObligationKeys].some(
      ([relation, obligationKey]) =>
        definitionObligationKeys.get(relation) !== obligationKey,
    ) ||
    [...definitionObligationKeys].some(
      ([relation, obligationKey]) =>
        analysisObligationKeys.get(relation) !== obligationKey,
    )
  )
    issues.push({
      kind: "artifact.quality-relations.obligation-key-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "obligation-key-closure-mismatch",
      details: {},
    });
  for (const [
    sourceGoalRelation,
    requestedLevels,
  ] of analysisSourceGoalLevels) {
    const relatedLocalIds = Array.from(analysisSourceRelations)
      .filter((relation) => relation.startsWith(`${sourceGoalRelation}|`))
      .map((relation) => relation.slice(sourceGoalRelation.length + 1));
    const relatedLevels = new Set(
      relatedLocalIds.flatMap((localId) => {
        const level = localItemLevels.get(localId);
        return level ? [level] : [];
      }),
    );
    for (const requestedLevel of requestedLevels)
      if (!relatedLevels.has(requestedLevel))
        issues.push({
          kind: "artifact.quality-relations.source-test-level-coverage-mismatch",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "source-test-level-coverage-mismatch",
          details: {},
        });
  }
  for (const [sourceId, requestedLevels] of summarySourceLevels) {
    const decomposedLevels = new Set<string>();
    for (const [sourceGoalRelation, levels] of analysisSourceGoalLevels)
      if (sourceGoalRelation.startsWith(`${sourceId}|`))
        for (const level of levels) decomposedLevels.add(level);
    if (
      requestedLevels.size !== decomposedLevels.size ||
      [...requestedLevels].some((level) => !decomposedLevels.has(level))
    )
      issues.push({
        kind: "artifact.quality-relations.source-test-level-decomposition-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-test-level-decomposition-mismatch",
        details: { value0: String(sourceId) },
      });
  }
  if (
    analysisSourceGoalLevels.size !== definitionSourceGoalLevels.size ||
    [...analysisSourceGoalLevels].some(([relation, levels]) => {
      const definitionLevels = definitionSourceGoalLevels.get(relation);
      return (
        !definitionLevels ||
        levels.size !== definitionLevels.size ||
        [...levels].some((level) => !definitionLevels.has(level))
      );
    })
  )
    issues.push({
      kind: "artifact.quality-relations.definition-source-test-level-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "definition-source-test-level-closure-mismatch",
      details: {
        value0: String(
          JSON.stringify(
            [...analysisSourceGoalLevels].map(([relation, levels]) => [
              relation,
              [...levels],
            ]),
          ),
        ),
        value1: String(
          JSON.stringify(
            [...definitionSourceGoalLevels].map(([relation, levels]) => [
              relation,
              [...levels],
            ]),
          ),
        ),
      },
    });
  if (
    analysisSourceConditions.size !== definitionSourceConditions.size ||
    [...analysisSourceConditions].some(
      ([relation, condition]) =>
        definitionSourceConditions.get(relation) !== condition,
    ) ||
    [...definitionSourceConditions].some(
      ([relation, condition]) =>
        analysisSourceConditions.get(relation) !== condition,
    )
  )
    issues.push({
      kind: "artifact.quality-relations.source-condition-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-condition-closure-mismatch",
      details: {},
    });

  return { issues };
}
/**
 * Quality統合のLocal Item集合とDetailの必要段階・境界到達を照合する。
 * @responsibility Quality統合のLocal Item集合とDetailの必要段階・境界到達を照合する。
 * @trace ARCH-000008
 * @input request: 統合本文、Local ID所有、Detail検証単位・関連項目と必要段階／境界、診断位置。
 * @returns 目標とLocal Itemの関係集合・出現列、集合・段階・境界到達の不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返し、取得済みLocal Item関係を保持する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityLocalItemRelations(
  request: Readonly<{
    analysis: string;
    localItemOwners: ReadonlyMap<string, string>;
    analysisDetailUnitLocalRelations: ReadonlySet<string>;
    physicalDetailUnits: ReadonlySet<string>;
    physicalDetailUnitLevels: ReadonlyMap<string, ReadonlySet<string>>;
    physicalDetailUnitBoundaryStages: ReadonlyMap<string, string>;
    localItemLevels: ReadonlyMap<string, string>;
    localItemBoundaryStages: ReadonlyMap<string, string>;
    analysisPath: string;
  }>,
) {
  const {
    analysis,
    localItemOwners,
    analysisDetailUnitLocalRelations,
    physicalDetailUnits,
    physicalDetailUnitLevels,
    physicalDetailUnitBoundaryStages,
    localItemLevels,
    localItemBoundaryStages,
    analysisPath,
  } = request;
  const issues: DomainIssue[] = [];
  const localItemSection = analysis.match(
    /^## 4\. 検証項目の閉包\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const listedLocalIds = new Set<string>();
  const listedGoalLocalRelations = new Set<string>();
  const listedGoalLocalRelationEntries: string[] = [];
  for (const line of (localItemSection ?? "").split(/\r?\n/u)) {
    const goalSlug = line.match(
      /^\|\s*\[[^\]]+\]\(Definitions\/([A-Z0-9-]+)\/quality_definition\.md\)\s*\|/u,
    )?.[1];
    if (!goalSlug) continue;
    for (const localMatch of line.matchAll(
      /`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu,
    )) {
      listedLocalIds.add(localMatch[1] as string);
      const relation = `${goalSlug}|${localMatch[1]}`;
      listedGoalLocalRelationEntries.push(relation);
      listedGoalLocalRelations.add(relation);
    }
  }
  if (
    listedLocalIds.size !== localItemOwners.size ||
    [...listedLocalIds].some((localId) => !localItemOwners.has(localId)) ||
    [...localItemOwners].some(([localId]) => !listedLocalIds.has(localId))
  )
    issues.push({
      kind: "artifact.quality-relations.local-verification-item-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "local-verification-item-closure-mismatch",
      details: {},
    });
  for (const relation of analysisDetailUnitLocalRelations) {
    const localId = relation.slice(relation.lastIndexOf("|") + 1);
    if (!localItemOwners.has(localId))
      issues.push({
        kind: "artifact.quality-relations.architecture-detail-unit-local-item-unknown",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-local-item-unknown",
        details: { value0: String(localId) },
      });
  }
  const boundaryStageRank = new Map([
    ["N/A", 0],
    ["Direct Boundary", 1],
    ["Adjacent 1 Block", 2],
    ["Related 2 Blocks", 3],
    ["System/E2E", 4],
    ["User Acceptance", 5],
  ]);
  for (const unitKey of physicalDetailUnits) {
    const relatedLocalIds = Array.from(analysisDetailUnitLocalRelations)
      .filter((relation) => relation.startsWith(`${unitKey}|`))
      .map((relation) => relation.slice(unitKey.length + 1));
    const relatedLevels = new Set(
      relatedLocalIds.flatMap((localId) => {
        const level = localItemLevels.get(localId);
        return level ? [level] : [];
      }),
    );
    const requiredLevels =
      physicalDetailUnitLevels.get(unitKey) ?? new Set<string>();
    if (
      requiredLevels.size === 0 ||
      [...requiredLevels].some((level) => !relatedLevels.has(level))
    )
      issues.push({
        kind: "artifact.quality-relations.architecture-detail-unit-level-coverage-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-level-coverage-mismatch",
        details: { value0: String(unitKey) },
      });
    const requiredBoundaryStage =
      physicalDetailUnitBoundaryStages.get(unitKey) ?? "";
    const requiredBoundaryRank = boundaryStageRank.get(requiredBoundaryStage);
    const actualBoundaryRank = Math.max(
      -1,
      ...relatedLocalIds.map(
        (localId) =>
          boundaryStageRank.get(localItemBoundaryStages.get(localId) ?? "") ??
          -1,
      ),
    );
    if (
      requiredBoundaryRank === undefined ||
      actualBoundaryRank < requiredBoundaryRank
    )
      issues.push({
        kind: "artifact.quality-relations.architecture-detail-unit-boundary-coverage-mismatch",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-boundary-coverage-mismatch",
        details: { value0: String(unitKey) },
      });
  }

  return { listedGoalLocalRelationEntries, listedGoalLocalRelations, issues };
}
/**
 * Quality統合と定義の目標別Local Item関係を照合する。
 * @responsibility Quality統合と定義の目標別Local Item関係を照合する。
 * @trace ARCH-000008
 * @input request: 統合・定義の目標とLocal Itemの関係集合、出現列、診断位置。
 * @returns 目標とLocal Itemの重複・閉包不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityGoalLocalRelations(
  request: Readonly<{
    listedGoalLocalRelationEntries: readonly string[];
    listedGoalLocalRelations: ReadonlySet<string>;
    definitionGoalLocalRelations: ReadonlySet<string>;
    analysisPath: string;
  }>,
) {
  const {
    listedGoalLocalRelationEntries,
    listedGoalLocalRelations,
    definitionGoalLocalRelations,
    analysisPath,
  } = request;
  const issues: DomainIssue[] = [];
  if (listedGoalLocalRelationEntries.length !== listedGoalLocalRelations.size)
    issues.push({
      kind: "artifact.quality-relations.goal-local-relation-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "goal-local-relation-duplicate",
      details: {},
    });
  if (
    listedGoalLocalRelations.size !== definitionGoalLocalRelations.size ||
    [...listedGoalLocalRelations].some(
      (relation) => !definitionGoalLocalRelations.has(relation),
    ) ||
    [...definitionGoalLocalRelations].some(
      (relation) => !listedGoalLocalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-relations.goal-local-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "goal-local-relation-closure-mismatch",
      details: {},
    });

  return { issues };
}
/**
 * Architecture DetailのQuality引渡しから検証単位・段階・境界を解析する。
 * @responsibility Architecture DetailのQuality引渡しから検証単位・段階・境界を解析する。
 * @trace ARCH-000008
 * @input content: 取得済みArchitecture Detail本文。detailSlug: 領域名。
 * @returns 検証単位集合と段階・境界の後勝ちMap。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。Issueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityDetailHandoff(content: string, detailSlug: string) {
  const physicalDetailUnits = new Set<string>();
  const physicalDetailUnitLevels = new Map<string, Set<string>>();
  const physicalDetailUnitBoundaryStages = new Map<string, string>();
  const handoffSection = content.match(
    /^## Qualityへの引(?:渡し|き渡し)\s*$([\s\S]*?)(?=^##\s)/mu,
  )?.[1];
  for (const line of (handoffSection ?? "").split(/\r?\n/u)) {
    if (!/^\|/u.test(line)) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    const unit = cells[0];
    if (
      !unit ||
      unit === "検証単位" ||
      unit === "導出キー" ||
      /^---/u.test(unit)
    )
      continue;
    const unitKey = `${detailSlug}|${unit}`;
    physicalDetailUnits.add(unitKey);
    physicalDetailUnitLevels.set(
      unitKey,
      new Set(
        Array.from(
          cells[5]?.matchAll(/UT|IT|ST|UAT/gu) ?? [],
          (match) => match[0],
        ),
      ),
    );
    const declaredBoundaryCell = cells[6] ?? "";
    const declaredBoundaryStages = [
      "N/A",
      "Direct Boundary",
      "Adjacent 1 Block",
      "Related 2 Blocks",
      "System/E2E",
      "User Acceptance",
    ].filter((stage) => declaredBoundaryCell.includes(stage));
    physicalDetailUnitBoundaryStages.set(
      unitKey,
      declaredBoundaryStages.at(-1) ?? "",
    );
  }

  return {
    physicalDetailUnits,
    physicalDetailUnitLevels,
    physicalDetailUnitBoundaryStages,
  };
}

/**
 * Quality文書が宣言するLocal Item件数を実集合の件数と照合する。
 * @responsibility Quality文書が宣言するLocal Item件数を実集合の件数と照合する。
 * @trace ARCH-000008
 * @input declaringDocument: 件数宣言を含む本文。localItemCount: 定義が所有する実集合の件数。
 * @returns 件数宣言が欠落または不一致ならtrue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。Issueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isQualityLocalItemCountInvalid(
  declaringDocument: string,
  localItemCount: number,
): boolean {
  const declaredCount = declaringDocument.match(
    /^\|\s*Local Item数\s*\|\s*([0-9]+)\s*\|\s*$/mu,
  )?.[1];
  return (
    declaredCount === undefined ||
    Number.parseInt(declaredCount, 10) !== localItemCount
  );
}
