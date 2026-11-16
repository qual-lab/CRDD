/**
 * ia成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */

import fs from "node:fs";
import path from "node:path";
import {
  type IaAnalysisModel,
  type IaDefinitionModel,
  inspectDocumentRelations,
  parseIaAnalysis,
  parseIaDefinition,
  parseIaIndex,
  parseIaObjectRelation,
  parseIaStateVisibility,
  parseIaStructureNavigation,
} from "../../../document-model/src/index.ts";
import { mapIaDomainIssueToFinding } from "../report/convert.ts";
import type { DocumentFinding } from "../report/types.ts";
import { lstatIfPresent } from "../repository/observe.ts";

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
  const templateChecklistContracts = [
    [requiredTemplates[0], "index"],
    [requiredTemplates[1], "object_relation"],
    [requiredTemplates[2], "structure_navigation"],
    [requiredTemplates[3], "state_visibility"],
    [requiredTemplates[4], "analysis"],
    [requiredTemplates[5], "definition"],
  ] as const;
  for (const [templatePath, kind] of templateChecklistContracts) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const source = {
      path: relative(templatePath),
      content: read(templatePath),
    };
    const parsed =
      kind === "index"
        ? parseIaIndex(source, { mode: "template" })
        : kind === "object_relation"
          ? parseIaObjectRelation(source, { mode: "template" })
          : kind === "structure_navigation"
            ? parseIaStructureNavigation(source, { mode: "template" })
            : kind === "state_visibility"
              ? parseIaStateVisibility(source, { mode: "template" })
              : kind === "analysis"
                ? parseIaAnalysis(source, "UX-XXXXXX", { mode: "template" })
                : parseIaDefinition(source, "IA-XXXXXX", { mode: "template" });
    const checklistError = parsed.result.checklistContract.failure;
    if (checklistError)
      add(
        "error",
        "ia-template-checklist-invalid",
        relative(templatePath),
        `The IA template must provide the exact visible unevaluated checklist (${checklistError}).`,
      );
  }

  const iaCrossArtifacts = [
    [iaIndexPath, "index"],
    [
      path.join(root, "03_IA", "02_Object_and_Relation_Model.md"),
      "object_relation",
    ],
    [
      path.join(root, "03_IA", "03_Information_Structure_and_Navigation.md"),
      "structure_navigation",
    ],
    [
      path.join(root, "03_IA", "04_State_Visibility_and_Responsibility.md"),
      "state_visibility",
    ],
  ] as const;
  for (const [artifactPath, kind] of iaCrossArtifacts) {
    if (!lstatIfPresent(artifactPath)?.isFile()) {
      add(
        "error",
        "ia-cross-artifact-missing",
        relative(artifactPath),
        "The official IA profile must keep the index and three cross-cutting projections.",
      );
      continue;
    }
    const source = {
      path: relative(artifactPath),
      content: read(artifactPath),
    };
    const parsed =
      kind === "index"
        ? parseIaIndex(source, { mode: "evaluated" })
        : kind === "object_relation"
          ? parseIaObjectRelation(source, { mode: "evaluated" })
          : kind === "structure_navigation"
            ? parseIaStructureNavigation(source, { mode: "evaluated" })
            : parseIaStateVisibility(source, { mode: "evaluated" });
    const checklistError = parsed.result.checklistContract.failure;
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
  }).result;
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
      const analysisModel = parseIaAnalysis(
        { path: relative(analysisPath), content: read(analysisPath) },
        entry.name,
      );
      iaAnalyses.set(entry.name, analysisModel.result);
      for (const issue of analysisModel.issues) {
        const finding = mapIaDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  for (const issue of inspectDocumentRelations({
    kind: "ia_analysis_coverage",
    expectedIds: uxIds,
    actualIds: actualAnalysisIds,
    sourcePath: relative(iaIndexPath),
  })) {
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
      const definitionModel = parseIaDefinition(
        { path: relative(definitionPath), content: read(definitionPath) },
        entry.name,
      );
      iaDefinitions.push(definitionModel.result);
      for (const issue of inspectDocumentRelations({
        kind: "ia_definition",
        definition: definitionModel,
        analyses: iaAnalyses,
      })) {
        const finding = mapIaDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  for (const issue of inspectDocumentRelations({
    kind: "ia_index_coverage",
    index: iaIndexModel,
    actualIds: actualIaIds,
    sourcePath: relative(iaIndexPath),
  })) {
    const finding = mapIaDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const [crossPath] of iaCrossArtifacts.slice(1)) {
    if (!lstatIfPresent(crossPath)?.isFile()) continue;
    for (const issue of inspectDocumentRelations({
      kind: "ia_projection",
      projection: parseIaObjectRelation({
        path: relative(crossPath),
        content: read(crossPath),
      }).result.projection,
      actualIds: actualIaIds,
    })) {
      const finding = mapIaDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  for (const issue of inspectDocumentRelations({
    kind: "ia_relations",
    index: iaIndexModel,
    analyses: [...iaAnalyses.values()],
    definitions: iaDefinitions,
    sourcePath: relative(iaIndexPath),
  })) {
    const finding = mapIaDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}
