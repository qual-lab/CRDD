/**
 * architecture成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */
import type { DocumentFinding } from "../report/types.ts";

import { lstatIfPresent } from "../repository/observe.ts";

import fs from "node:fs";
import path from "node:path";

import {
  inspectArchitectureCrossModelIndex,
  inspectArchitectureCrossModel,
  inspectArchitectureDetailMap,
  inspectArchitectureDetail,
  inspectArchitectureDetailCoverage,
  inspectArchitectureAnalysisCoverage,
  parseArchitectureRegistry,
  inspectArchitectureRegistryCoverage,
  inspectArchitectureComponentCoverage,
  inspectArchitectureRelations,
  inspectArchitectureAnalysis,
  inspectArchitectureDefinition,
  inspectArchitectureDetailTemplate,
  createPhaseChecklistItems,
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
} from "../../../domain-model/src/index.ts";
import { mapArchitectureDomainIssueToFinding } from "../report/convert.ts";

/**
 * architecture成果物を観測し、本文・関係の意味をDomainへ渡す。
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
export function inspectArchitectureRepository(
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
    architectureUiAnalysisChecklistItemTexts,
    architectureSpecAnalysisChecklistItemTexts,
    architectureDefinitionChecklistItemTexts,
    architectureDefinitionTemplateChecklistItemTexts,
    architectureDetailChecklistItemTexts,
    architectureDetailTemplateChecklistItemTexts,
  } = createPhaseChecklistItems();

  if (repositoryMode !== "official") return;
  const architectureIndexPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  if (!lstatIfPresent(architectureIndexPath)?.isFile()) return;
  const architectureIndexRaw = read(architectureIndexPath);
  const isArchitectureReadyStatus = /Status:\s*Architecture Ready\b/u.test(
    architectureIndexRaw,
  );

  for (const [templatePath, expectedItems] of [
    [
      path.join(
        root,
        "template",
        "06_Architecture",
        "Analysis",
        "UI-XXXXXX",
        "architecture_analysis.md",
      ),
      architectureUiAnalysisChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "06_Architecture",
        "Analysis",
        "SPEC-XXXXXX",
        "architecture_analysis.md",
      ),
      architectureSpecAnalysisChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "06_Architecture",
        "Definitions",
        "ARCH-XXXXXX",
        "architecture_definition.md",
      ),
      architectureDefinitionTemplateChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "06_Architecture",
        "Details",
        "area",
        "01_Architecture.md",
      ),
      architectureDetailTemplateChecklistItemTexts,
    ],
  ] as const) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const checklistError = inspectTemplateChecklist(
      read(templatePath),
      expectedItems,
    );
    if (checklistError)
      add(
        "error",
        "architecture-template-checklist-contract-invalid",
        relative(templatePath),
        `Each Architecture template must expose one visible artifact-specific Checklist with unevaluated items and result guidance (${checklistError}).`,
      );
  }

  const architectureDefinitionTemplatePath = path.join(
    root,
    "template",
    "06_Architecture",
    "Definitions",
    "ARCH-XXXXXX",
    "architecture_definition.md",
  );
  const architectureDetailTemplatePath = path.join(
    root,
    "template",
    "06_Architecture",
    "Details",
    "area",
    "01_Architecture.md",
  );
  if (lstatIfPresent(architectureDefinitionTemplatePath)?.isFile()) {
    const source = omitMarkdownCommentsAndFencedCode(
      read(architectureDefinitionTemplatePath),
    );
    for (const issue of inspectArchitectureDetailTemplate(
      {
        path: relative(architectureDefinitionTemplatePath),
        content: source,
      },
      "definition",
    )) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  if (lstatIfPresent(architectureDetailTemplatePath)?.isFile()) {
    const source = omitMarkdownCommentsAndFencedCode(
      read(architectureDetailTemplatePath),
    );
    for (const issue of inspectArchitectureDetailTemplate(
      { path: relative(architectureDetailTemplatePath), content: source },
      "area",
    )) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const definitionIds = (
    phase: "04_UI" | "05_SPEC",
    prefix: "UI" | "SPEC",
    file: string,
  ): Set<string> => {
    const result = new Set<string>();
    const base = path.join(root, phase, "Definitions");
    if (!lstatIfPresent(base)?.isDirectory()) return result;
    for (const entry of fs.readdirSync(base, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(path.join(base, entry.name, file))?.isFile()
      )
        result.add(entry.name);
    return result;
  };
  const uiIds = definitionIds("04_UI", "UI", "ui_definition.md");
  const specIds = definitionIds("05_SPEC", "SPEC", "spec_definition.md");
  const analysisRoot = path.join(root, "06_Architecture", "Analysis");
  const analysisRelations = new Set<string>();
  const analyzedUi = new Set<string>();
  const analyzedSpec = new Set<string>();
  const actualAnalysisIds = new Set<string>();

  if (lstatIfPresent(analysisRoot)?.isDirectory())
    for (const entry of fs.readdirSync(analysisRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        /^(?:UI|SPEC)-[0-9]{6}$/u.test(entry.name) &&
        lstatIfPresent(
          path.join(analysisRoot, entry.name, "architecture_analysis.md"),
        )?.isFile()
      )
        actualAnalysisIds.add(entry.name);

  for (const [kind, ids] of [
    ["UI", uiIds],
    ["SPEC", specIds],
  ] as const)
    for (const id of ids) {
      const analysisPath = path.join(
        analysisRoot,
        id,
        "architecture_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) {
        add(
          "error",
          "architecture-analysis-missing",
          relative(analysisPath),
          `Every canonical ${kind} definition must have exactly one Architecture analysis.`,
        );
        continue;
      }
      const source = omitMarkdownCommentsAndFencedCode(read(analysisPath));
      const checklistError = inspectEvaluatedChecklist(
        read(analysisPath),
        kind === "UI"
          ? architectureUiAnalysisChecklistItemTexts
          : architectureSpecAnalysisChecklistItemTexts,
      );
      const model = inspectArchitectureAnalysis(
        { path: relative(analysisPath), content: source },
        kind,
        id,
        isArchitectureReadyStatus,
        checklistError,
      );
      if (kind === "UI") analyzedUi.add(id);
      else analyzedSpec.add(id);
      for (const relation of model.relations) analysisRelations.add(relation);
      for (const issue of model.issues) {
        const finding = mapArchitectureDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectArchitectureAnalysisCoverage({
    sourcePath: relative(architectureIndexPath),
    analysisPath: relative(analysisRoot),
    analyzedUi,
    analyzedSpec,
    uiIds,
    specIds,
    actualAnalysisIds,
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const index = omitMarkdownCommentsAndFencedCode(read(architectureIndexPath));
  const crossModelIndex = inspectArchitectureCrossModelIndex({
    path: relative(architectureIndexPath),
    content: index,
  });
  for (const issue of crossModelIndex.issues) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const file of crossModelIndex.files) {
    const modelPath = path.join(root, "06_Architecture", file);
    if (!lstatIfPresent(modelPath)?.isFile()) {
      add(
        "error",
        "architecture-cross-model-missing",
        relative(modelPath),
        "Every declared Architecture cross-cutting model must exist before Architecture Ready.",
      );
      continue;
    }
    const rawModelSource = omitMarkdownCommentsOutsideFencedCode(
      read(modelPath),
    );
    const modelSource = omitMarkdownCommentsAndFencedCode(rawModelSource);
    for (const issue of inspectArchitectureCrossModel(
      { path: relative(modelPath), content: modelSource },
      file,
      index,
      rawModelSource,
    )) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  const registryModel = parseArchitectureRegistry(index);
  const {
    relations: registryRelations,
    relationEntries: registryRelationEntries,
  } = registryModel;
  const definitionRoot = path.join(root, "06_Architecture", "Definitions");
  const actualDefinitions = new Set<string>();
  const definitionRelations = new Set<string>();
  const definitionRelationEntries: string[] = [];
  if (lstatIfPresent(definitionRoot)?.isDirectory())
    for (const entry of fs.readdirSync(definitionRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^ARCH-[0-9]{6}$/u.test(entry.name))
        continue;
      const definitionPath = path.join(
        definitionRoot,
        entry.name,
        "architecture_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualDefinitions.add(entry.name);
      const source = omitMarkdownCommentsAndFencedCode(read(definitionPath));
      const checklistError = inspectEvaluatedChecklist(
        read(definitionPath),
        architectureDefinitionChecklistItemTexts,
      );
      const model = inspectArchitectureDefinition(
        { path: relative(definitionPath), content: source },
        entry.name,
        isArchitectureReadyStatus,
        checklistError,
      );
      for (const relation of model.relations) {
        definitionRelationEntries.push(relation);
        definitionRelations.add(relation);
      }
      for (const issue of model.issues) {
        const finding = mapArchitectureDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectArchitectureRegistryCoverage(
    relative(architectureIndexPath),
    registryModel,
    actualDefinitions,
  )) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const componentModelPath = path.join(
    root,
    "06_Architecture",
    "02_Component_and_Responsibility_Model.md",
  );
  if (lstatIfPresent(componentModelPath)?.isFile()) {
    const componentSource = omitMarkdownCommentsAndFencedCode(
      read(componentModelPath),
    );
    for (const issue of inspectArchitectureComponentCoverage(
      { path: relative(componentModelPath), content: componentSource },
      actualDefinitions,
    )) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const detailMapPath = path.join(
    root,
    "06_Architecture",
    "07_Detail_Architecture_Map.md",
  );
  const detailRoot = path.join(root, "06_Architecture", "Details");
  const detailMapRelations = new Set<string>();
  const detailMapClosureRelations = new Set<string>();
  const detailDocumentRelations = new Set<string>();
  const detailCoveredDefinitions = new Set<string>();
  const registeredDetailAreas = new Set<string>();
  const actualDetailAreas = new Set<string>();
  const isArchitectureReady = isArchitectureReadyStatus;
  if (!lstatIfPresent(detailMapPath)?.isFile())
    add(
      "error",
      "architecture-detail-map-missing",
      relative(detailMapPath),
      "Architecture must map every ARCH-ID to one or more detailed design areas before Architecture Ready.",
    );
  else {
    const source = omitMarkdownCommentsAndFencedCode(read(detailMapPath));
    const model = inspectArchitectureDetailMap(
      { path: relative(detailMapPath), content: source },
      actualDefinitions,
    );
    for (const area of model.areas) registeredDetailAreas.add(area);
    for (const relation of model.relations) detailMapRelations.add(relation);
    for (const relation of model.closureRelations)
      detailMapClosureRelations.add(relation);
    for (const issue of model.issues) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  if (lstatIfPresent(detailRoot)?.isDirectory())
    for (const entry of fs.readdirSync(detailRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^[a-z0-9-]+$/u.test(entry.name)) continue;
      actualDetailAreas.add(entry.name);
      const detailPath = path.join(
        detailRoot,
        entry.name,
        "01_Architecture.md",
      );
      if (!lstatIfPresent(detailPath)?.isFile()) {
        add(
          "error",
          "architecture-detail-document-missing",
          relative(detailPath),
          "Every detailed design area must have one self-contained 01_Architecture.md.",
        );
        continue;
      }
      const source = omitMarkdownCommentsAndFencedCode(read(detailPath));
      const detailMarkdown = read(detailPath);
      const checklistError = inspectEvaluatedChecklist(
        detailMarkdown,
        architectureDetailChecklistItemTexts,
      );
      const model = inspectArchitectureDetail(
        { path: relative(detailPath), content: source },
        entry.name,
        isArchitectureReady,
        checklistError,
      );
      for (const relation of model.relations)
        detailDocumentRelations.add(relation);
      for (const identity of model.coveredDefinitions)
        detailCoveredDefinitions.add(identity);
      for (const issue of model.issues) {
        const finding = mapArchitectureDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  for (const issue of inspectArchitectureDetailCoverage({
    sourcePath: relative(detailMapPath),
    registeredDetailAreas,
    actualDetailAreas,
    detailMapRelations,
    detailDocumentRelations,
    detailMapClosureRelations,
    actualDefinitions,
    detailCoveredDefinitions,
    isArchitectureReady,
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const issue of inspectArchitectureRelations({
    sourcePath: relative(architectureIndexPath),
    analysisRelations,
    definitionRelations,
    definitionRelationEntries,
    registryRelations,
    registryRelationEntries,
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}
