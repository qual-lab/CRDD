/**
 * Quality文書の分析・統合関係を検査する。
 * @responsibility 取得済み値の意味だけを所有し、Filesystem観測と診断表示は所有しない。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
/**
 * 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @responsibility 工程別Quality分析の情報源・目標・条件・Local Item関係を解析・照合する。
 * @trace ARCH-000008
 * @input mappingSection: Coverage節。phaseAnalyses: 工程本文列。canonicalIds: 観測済み定義ID。analysisPath／analysisRoot: 診断位置。
 * @returns 目標Label、情報源条件・段階・Obligation KeyのMap、情報源とLocal Item関係、Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正な行と集合条件をIssueで返し、取得できた部分関係を保持する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityAnalysis(
  mappingSection: string,
  phaseAnalyses: readonly string[],
  canonicalIds: ReadonlySet<string>,
  analysisPath: string,
  analysisRoot: string,
) {
  const issues: DomainIssue[] = [];

  const mappingRows = mappingSection
    .split(/\r?\n/u)
    .filter((line) =>
      /^\|\s*\[(?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6}\]\(/u.test(line),
    );
  const mappedIds = new Set(
    mappingRows.flatMap((line) => {
      const match = line.match(
        /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\(/u,
      );
      return match ? [match[1] as string] : [];
    }),
  );
  const summarySourceGoalRelations = new Set<string>();
  const summarySourceGoalRelationEntries: string[] = [];
  const summarySourceLevels = new Map<string, Set<string>>();
  const goalLabelToSlug = new Map<string, string>();
  for (const line of mappingRows) {
    const sourceId = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\(/u,
    )?.[1];
    if (!sourceId) continue;
    const mappingCells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    const requestedLevels = new Set(
      Array.from(
        mappingCells[4]?.matchAll(/UT|IT|ST|UAT/gu) ?? [],
        (match) => match[0],
      ),
    );
    for (const goal of line.matchAll(
      /\[([^\]]+)\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
    )) {
      goalLabelToSlug.set(goal[1] as string, goal[2] as string);
      const relation = `${sourceId}|${goal[2]}`;
      summarySourceGoalRelationEntries.push(relation);
      summarySourceGoalRelations.add(relation);
      const sourceLevels =
        summarySourceLevels.get(sourceId) ?? new Set<string>();
      for (const requestedLevel of requestedLevels)
        sourceLevels.add(requestedLevel);
      summarySourceLevels.set(sourceId, sourceLevels);
    }
  }
  if (
    canonicalIds.size !== mappedIds.size ||
    [...canonicalIds].some((id) => !mappedIds.has(id)) ||
    [...mappedIds].some((id) => !canonicalIds.has(id))
  )
    issues.push({
      kind: "artifact.quality-analysis.canonical-mapping-coverage-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-mapping-coverage-mismatch",
      details: {},
    });

  if (new Set(mappingRows).size !== mappingRows.length)
    issues.push({
      kind: "artifact.quality-analysis.canonical-mapping-duplicate-row",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-mapping-duplicate-row",
      details: {},
    });
  if (
    summarySourceGoalRelationEntries.length !== summarySourceGoalRelations.size
  )
    issues.push({
      kind: "artifact.quality-analysis.canonical-source-goal-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "canonical-source-goal-duplicate",
      details: {},
    });

  const sourceRelationSections = phaseAnalyses.map(
    (phaseAnalysis) =>
      phaseAnalysis.match(
        /^## 3\. 検証目標への統合\s*$([\s\S]*?)(?=^##\s)/mu,
      )?.[1],
  );
  if (sourceRelationSections.some((section) => !section))
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing",
      targetIdentity: analysisRoot,
      location: { path: analysisRoot },
      reason: "source-local-relation-section-missing",
      details: {},
    });
  const sourceRelationSection = sourceRelationSections.join("\n");
  const analysisSourceRelations = new Set<string>();
  const analysisSourceGoalRelations = new Set<string>();
  const analysisSourceRelationEntries: string[] = [];
  const analysisSourceGoalRelationEntries: string[] = [];
  const analysisSourceConditions = new Map<string, string>();
  const analysisSourceGoalLevels = new Map<string, Set<string>>();
  const analysisObligationKeys = new Map<string, string>();
  const analysisObligationKeyEntries: string[] = [];
  const normalizeQualityCondition = (value: string): string =>
    value.trim().replace(/\s+/gu, " ");
  for (const line of (sourceRelationSection ?? "").split(/\r?\n/u)) {
    const relation = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\([^)]+\)\s*\|\s*`([a-z0-9.-]+)`\s*\|\s*([^|]+)\|\s*\[[^\]]+\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!relation) continue;
    const [
      ,
      sourceId,
      obligationKey,
      derivationSource,
      goalSlug,
      condition,
      levelCell,
      boundaryStage,
      localCell,
    ] = relation as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const requestedLevels = new Set(
      Array.from(levelCell.matchAll(/UT|IT|ST|UAT/gu), (match) => match[0]),
    );
    const localIds = Array.from(
      localCell.matchAll(/`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu),
      (match) => match[1],
    );
    const sourceGoalRelation = `${sourceId}|${goalSlug}`;
    const expectedObligationKey = `${sourceId.toLowerCase()}.${goalSlug.toLowerCase()}`;
    analysisObligationKeyEntries.push(obligationKey);
    analysisObligationKeys.set(sourceGoalRelation, obligationKey);
    analysisSourceGoalRelationEntries.push(sourceGoalRelation);
    analysisSourceGoalRelations.add(sourceGoalRelation);
    analysisSourceConditions.set(
      sourceGoalRelation,
      normalizeQualityCondition(condition),
    );
    analysisSourceGoalLevels.set(sourceGoalRelation, requestedLevels);
    if (
      obligationKey !== expectedObligationKey ||
      derivationSource.trim().length === 0 ||
      condition.trim().length === 0 ||
      requestedLevels.size === 0 ||
      boundaryStage.trim().length === 0 ||
      localIds.length === 0
    )
      issues.push({
        kind: "artifact.quality-analysis.source-local-relation-incomplete",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "source-local-relation-incomplete",
        details: {},
      });
    for (const localId of localIds) {
      const sourceLocalRelation = `${sourceId}|${goalSlug}|${localId}`;
      analysisSourceRelationEntries.push(sourceLocalRelation);
      analysisSourceRelations.add(sourceLocalRelation);
    }
  }
  if (analysisSourceGoalRelations.size === 0)
    issues.push({
      kind: "artifact.quality-analysis.source-local-relation-section-missing-empty-relations",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-local-relation-section-missing-empty-relations",
      details: {},
    });
  if (
    analysisSourceGoalRelationEntries.length !==
      analysisSourceGoalRelations.size ||
    analysisSourceRelationEntries.length !== analysisSourceRelations.size ||
    analysisObligationKeyEntries.length !==
      new Set(analysisObligationKeyEntries).size
  )
    issues.push({
      kind: "artifact.quality-analysis.source-relation-duplicate",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-relation-duplicate",
      details: {},
    });
  if (
    summarySourceGoalRelations.size !== analysisSourceGoalRelations.size ||
    [...summarySourceGoalRelations].some(
      (relation) => !analysisSourceGoalRelations.has(relation),
    ) ||
    [...analysisSourceGoalRelations].some(
      (relation) => !summarySourceGoalRelations.has(relation),
    )
  )
    issues.push({
      kind: "artifact.quality-analysis.source-goal-relation-closure-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "source-goal-relation-closure-mismatch",
      details: {},
    });

  return {
    summarySourceLevels,
    goalLabelToSlug,
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
    issues,
  };
}

/**
 * Quality統合表の横断モデル処置と目標集合を照合する。
 * @responsibility Quality統合表の横断モデル処置と目標集合を照合する。
 * @trace ARCH-000008
 * @input crossModelSection: 横断モデル節。goalLabelToSlug: 目標名とQA-IDの対応。analysisPath: 診断位置。
 * @returns 行・重複・処置・目標集合の不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正条件をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityCrossModelGoals(
  crossModelSection: string | undefined,
  goalLabelToSlug: ReadonlyMap<string, string>,
  analysisPath: string,
) {
  const issues: DomainIssue[] = [];

  const crossModelRows = (crossModelSection ?? "")
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*[^|]+\|/u.test(line))
    .filter((line) => !/^\|\s*(?:検証目標|---)/u.test(line));
  const crossModelGoals = new Set<string>();
  for (const line of crossModelRows) {
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    const goalSlug = goalLabelToSlug.get(cells[0] as string);
    if (!goalSlug || cells.length !== 6) {
      issues.push({
        kind: "artifact.quality-analysis.cross-model-row-invalid",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "cross-model-row-invalid",
        details: {},
      });
      continue;
    }
    if (crossModelGoals.has(goalSlug))
      issues.push({
        kind: "artifact.quality-analysis.cross-model-goal-duplicate",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "cross-model-goal-duplicate",
        details: { value0: String(goalSlug) },
      });
    crossModelGoals.add(goalSlug);
    for (const disposition of cells.slice(1))
      if (disposition !== "Required" && !/^N\/A:\s*\S.+/u.test(disposition))
        issues.push({
          kind: "artifact.quality-analysis.cross-model-disposition-invalid",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "cross-model-disposition-invalid",
          details: {},
        });
  }
  const goalSlugs = new Set(goalLabelToSlug.values());
  if (
    crossModelGoals.size !== goalSlugs.size ||
    [...goalSlugs].some((goalSlug) => !crossModelGoals.has(goalSlug)) ||
    [...crossModelGoals].some((goalSlug) => !goalSlugs.has(goalSlug))
  )
    issues.push({
      kind: "artifact.quality-analysis.cross-model-goal-coverage-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "cross-model-goal-coverage-mismatch",
      details: {},
    });

  return { issues };
}

/**
 * Quality統合表のArchitecture詳細検証単位と領域集合を解析・照合する。
 * @responsibility Quality統合表のArchitecture詳細検証単位と領域集合を解析・照合する。
 * @trace ARCH-000008
 * @input detailSection: 詳細設計処置節。linkedDetailPaths／physicalDetailPaths: リンク先と観測済み領域集合。analysisPath: 診断位置。
 * @returns Detailと目標・Local Itemの関係集合、検証単位集合、Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正行をIssueで返し、取得済み部分関係を保持する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityDetailUnits(
  detailSection: string | undefined,
  linkedDetailPaths: ReadonlySet<string>,
  physicalDetailPaths: ReadonlySet<string>,
  analysisPath: string,
) {
  const issues: DomainIssue[] = [];

  const analysisDetailGoalRelations = new Set<string>();
  const analysisDetailUnitGoalRelations = new Set<string>();
  const analysisDetailUnitLocalRelations = new Set<string>();
  const analysisDetailUnits = new Set<string>();
  for (const line of (detailSection ?? "").split(/\r?\n/u)) {
    const detailSlug = line.match(
      /^\|\s*\[([a-z0-9-]+)\]\([^)]*\/Details\/\1\/01_Architecture\.md\)\s*\|/u,
    )?.[1];
    if (!detailSlug) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 6 || (cells[1] as string).length === 0) {
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-row-invalid",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-row-invalid",
        details: {},
      });
      continue;
    }
    const unitKey = `${detailSlug}|${cells[1]}`;
    if (analysisDetailUnits.has(unitKey))
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-duplicate",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-duplicate",
        details: { value0: String(unitKey) },
      });
    analysisDetailUnits.add(unitKey);
    if (cells[4] !== "Covered" && cells[4] !== "OPEN")
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-disposition-invalid",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-disposition-invalid",
        details: {},
      });
    if ((cells[5] as string).length === 0)
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-reevaluation-missing",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-reevaluation-missing",
        details: {},
      });
    for (const goal of line.matchAll(
      /\[[^\]]+\]\(Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
    )) {
      const relation = `${detailSlug}|${goal[1]}`;
      analysisDetailGoalRelations.add(relation);
      const unitGoalRelation = `${unitKey}|${goal[1]}`;
      if (analysisDetailUnitGoalRelations.has(unitGoalRelation))
        issues.push({
          kind: "artifact.quality-analysis.architecture-detail-unit-goal-duplicate",
          targetIdentity: analysisPath,
          location: { path: analysisPath },
          reason: "architecture-detail-unit-goal-duplicate",
          details: { value0: String(unitGoalRelation) },
        });
      analysisDetailUnitGoalRelations.add(unitGoalRelation);
    }
    for (const localMatch of (cells[3] as string).matchAll(
      /`([A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3})`/gu,
    ))
      analysisDetailUnitLocalRelations.add(`${unitKey}|${localMatch[1]}`);
    if (!/`[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}`/u.test(cells[3] as string))
      issues.push({
        kind: "artifact.quality-analysis.architecture-detail-unit-local-item-missing",
        targetIdentity: analysisPath,
        location: { path: analysisPath },
        reason: "architecture-detail-unit-local-item-missing",
        details: { value0: String(unitKey) },
      });
  }
  if (analysisDetailGoalRelations.size === 0)
    issues.push({
      kind: "artifact.quality-analysis.architecture-detail-goal-relation-missing",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "architecture-detail-goal-relation-missing",
      details: {},
    });
  if (
    linkedDetailPaths.size !== physicalDetailPaths.size ||
    [...physicalDetailPaths].some(
      (detailPath) => !linkedDetailPaths.has(detailPath),
    ) ||
    [...linkedDetailPaths].some(
      (detailPath) => !physicalDetailPaths.has(detailPath),
    )
  )
    issues.push({
      kind: "artifact.quality-analysis.architecture-detail-coverage-mismatch",
      targetIdentity: analysisPath,
      location: { path: analysisPath },
      reason: "architecture-detail-coverage-mismatch",
      details: {},
    });

  return {
    analysisDetailGoalRelations,
    analysisDetailUnitLocalRelations,
    analysisDetailUnits,
    issues,
  };
}

/**
 * 工程分析本文からCoverage Indexだけを出現順に解析する。
 * @responsibility 工程分析本文からCoverage Indexだけを出現順に解析する。
 * @trace ARCH-000008
 * @input phaseAnalyses: 取得済み工程分析本文列。
 * @returns 各本文のCoverage節。欠落はundefinedとし、入力順を保つ。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。欠落を空の正常節へ補完しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseQualityCoverageSections(phaseAnalyses: readonly string[]) {
  const mappingSections = phaseAnalyses.map(
    (phaseAnalysis) =>
      phaseAnalysis.match(
        /^## 2\. 全件Coverage Index\s*$([\s\S]*?)(?=^##\s)/mu,
      )?.[1],
  );
  return mappingSections;
}
