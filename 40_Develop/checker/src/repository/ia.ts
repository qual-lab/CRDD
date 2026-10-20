/**
 * ia成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */
import type { DocumentFinding } from "../report/types.ts";

import { lstatIfPresent } from "../repository/observe.ts";

import fs from "node:fs";
import path from "node:path";

import {
  parseIaIndex,
  inspectIaAnalysis,
  inspectIaDefinition,
  inspectIaAnalysisCoverage,
  inspectIaIndexCoverage,
  inspectIaCrossProjection,
  inspectIaRelations,
  type IaAnalysisModel,
  type IaDefinitionModel,
  createPhaseChecklistItems,
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../domain-model/src/index.ts";
import { mapIaDomainIssueToFinding } from "../report/convert.ts";

/**
 * ia成果物を観測し、本文・関係の意味をDomainへ渡す。
 * @responsibility 工程固有の観測順・短絡・再読取りと診断の配送を所有する。
 * @trace ARCH-000001
 * @input root: 検査Root。repositoryMode: 既存の適用モード。findings: 呼出し元が所有する追記先。
 * @returns N/A: 診断をfindingsへ出現順に追記する。
 * @precondition Rootと適用モードは呼出し元が観測済みである。
 * @postcondition 本文意味を再実装せず、観測済み値をDomainへ渡す。
 * @effect Filesystemを同期読取りし、局所の診断配列へ追記する。保存・外部送信なし。
 * @failure 観測・解析例外は伝播し、それまでの診断を破棄・正常化しない。
 * @invariant 不存在時の省略、途中return、同File再読取り、診断順を維持する。
 * @boundary Repository観測とDomain本文モデルの境界。
 * @security 新しいRoot、Authority、Reader、Snapshot、Registryを作らない。
 * @concurrency 同じ起動内の同期観測。共有Lock・永続状態は持たない。
 */
export function inspectIaRepository(
  root: string,
  repositoryMode: string,
  findings: DocumentFinding[],
): void {
  const add = (severity: string, code: string, file: string, message: string) =>
    findings.push({ severity, code, path: file, message });
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const read = (file: string) => fs.readFileSync(file, "utf8");
  const {
    iaIndexChecklistItemTexts,
    iaObjectRelationChecklistItemTexts,
    iaStructureNavigationChecklistItemTexts,
    iaStateVisibilityChecklistItemTexts,
    iaAnalysisChecklistItemTexts,
    iaDefinitionChecklistItemTexts,
  } = createPhaseChecklistItems();

  if (repositoryMode !== "official") return;
  const uxDefinitionsRoot = path.join(root, "02_UX", "Definitions");
  const iaIndexPath = path.join(
    root,
    "03_IA",
    "01_Information_Architecture.md",
  );
  const iaAnalysisRoot = path.join(root, "03_IA", "Analysis");
  const iaDefinitionsRoot = path.join(root, "03_IA", "Definitions");
  if (!lstatIfPresent(iaIndexPath)?.isFile()) return;

  const requiredTemplates = [
    path.join(root, "template", "03_IA", "01_Information_Architecture.md"),
    path.join(root, "template", "03_IA", "02_Object_and_Relation_Model.md"),
    path.join(
      root,
      "template",
      "03_IA",
      "03_Information_Structure_and_Navigation.md",
    ),
    path.join(
      root,
      "template",
      "03_IA",
      "04_State_Visibility_and_Responsibility.md",
    ),
    path.join(
      root,
      "template",
      "03_IA",
      "Analysis",
      "UX-XXXXXX",
      "ia_analysis.md",
    ),
    path.join(
      root,
      "template",
      "03_IA",
      "Definitions",
      "IA-XXXXXX",
      "ia_definition.md",
    ),
  ];
  for (const templatePath of requiredTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "ia-reconstruction-template-missing",
        relative(templatePath),
        "The official IA profile must include root, cross-cutting, analysis, and definition templates.",
      );
  const templateChecklistContracts: Array<[string, readonly string[]]> = [
    [requiredTemplates[0], iaIndexChecklistItemTexts],
    [requiredTemplates[1], iaObjectRelationChecklistItemTexts],
    [requiredTemplates[2], iaStructureNavigationChecklistItemTexts],
    [requiredTemplates[3], iaStateVisibilityChecklistItemTexts],
    [requiredTemplates[4], iaAnalysisChecklistItemTexts],
    [requiredTemplates[5], iaDefinitionChecklistItemTexts],
  ];
  for (const [templatePath, expectedItems] of templateChecklistContracts) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const checklistError = inspectTemplateChecklist(
      read(templatePath),
      expectedItems,
    );
    if (checklistError)
      add(
        "error",
        "ia-template-checklist-invalid",
        relative(templatePath),
        `The IA template must provide the exact visible unevaluated checklist (${checklistError}).`,
      );
  }

  const iaCrossArtifacts: Array<[string, readonly string[]]> = [
    [iaIndexPath, iaIndexChecklistItemTexts],
    [
      path.join(root, "03_IA", "02_Object_and_Relation_Model.md"),
      iaObjectRelationChecklistItemTexts,
    ],
    [
      path.join(root, "03_IA", "03_Information_Structure_and_Navigation.md"),
      iaStructureNavigationChecklistItemTexts,
    ],
    [
      path.join(root, "03_IA", "04_State_Visibility_and_Responsibility.md"),
      iaStateVisibilityChecklistItemTexts,
    ],
  ];
  for (const [artifactPath, expectedItems] of iaCrossArtifacts) {
    if (!lstatIfPresent(artifactPath)?.isFile()) {
      add(
        "error",
        "ia-cross-artifact-missing",
        relative(artifactPath),
        "The official IA profile must keep the index and three cross-cutting projections.",
      );
      continue;
    }
    const checklistError = inspectEvaluatedChecklist(
      read(artifactPath),
      expectedItems,
    );
    if (checklistError)
      add(
        "error",
        "ia-artifact-checklist-invalid",
        relative(artifactPath),
        `The current IA artifact must record the exact assessed checklist (${checklistError}).`,
      );
  }
  for (const sharedEvidenceRoot of [
    path.join(root, "05_SPEC", "Evidence"),
    path.join(root, "template", "05_SPEC", "Evidence"),
  ])
    if (lstatIfPresent(sharedEvidenceRoot)?.isDirectory())
      add(
        "error",
        "spec-shared-evidence-root-forbidden",
        relative(sharedEvidenceRoot),
        "SPEC-specific evidence belongs under its SPEC ID; cross-SPEC execution evidence belongs to Change or Release.",
      );

  const uxIds = new Set<string>();
  if (lstatIfPresent(uxDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uxDefinitionsRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        /^UX-[0-9]{6}$/u.test(entry.name) &&
        lstatIfPresent(
          path.join(uxDefinitionsRoot, entry.name, "ux_definition.md"),
        )?.isFile()
      )
        uxIds.add(entry.name);

  const iaIndexModel = parseIaIndex({
    path: relative(iaIndexPath),
    content: read(iaIndexPath),
  });
  const iaAnalyses = new Map<string, IaAnalysisModel>();
  const actualAnalysisIds = new Set<string>();
  if (lstatIfPresent(iaAnalysisRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(iaAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UX-[0-9]{6}$/u.test(entry.name)) continue;
      const analysisPath = path.join(
        iaAnalysisRoot,
        entry.name,
        "ia_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      actualAnalysisIds.add(entry.name);
      const analysisModel = inspectIaAnalysis(
        { path: relative(analysisPath), content: read(analysisPath) },
        entry.name,
      );
      iaAnalyses.set(entry.name, analysisModel);
      for (const issue of analysisModel.issues) {
        const finding = mapIaDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  for (const issue of inspectIaAnalysisCoverage(
    uxIds,
    actualAnalysisIds,
    relative(iaIndexPath),
  )) {
    const finding = mapIaDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const actualIaIds = new Set<string>();
  const iaDefinitions: IaDefinitionModel[] = [];
  if (lstatIfPresent(iaDefinitionsRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(iaDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^IA-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        iaDefinitionsRoot,
        entry.name,
        "ia_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualIaIds.add(entry.name);
      const definitionModel = inspectIaDefinition(
        { path: relative(definitionPath), content: read(definitionPath) },
        entry.name,
        iaAnalyses,
      );
      iaDefinitions.push(definitionModel);
      for (const issue of definitionModel.issues) {
        const finding = mapIaDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  for (const issue of inspectIaIndexCoverage(
    iaIndexModel,
    actualIaIds,
    relative(iaIndexPath),
  )) {
    const finding = mapIaDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const [crossPath] of iaCrossArtifacts.slice(1)) {
    if (!lstatIfPresent(crossPath)?.isFile()) continue;
    for (const issue of inspectIaCrossProjection(
      { path: relative(crossPath), content: read(crossPath) },
      actualIaIds,
    )) {
      const finding = mapIaDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  for (const issue of inspectIaRelations(
    iaIndexModel,
    [...iaAnalyses.values()],
    iaDefinitions,
    relative(iaIndexPath),
  )) {
    const finding = mapIaDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}
