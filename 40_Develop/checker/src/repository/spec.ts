/**
 * spec成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */
import type { DocumentFinding } from "../report/types.ts";

import { lstatIfPresent } from "../repository/observe.ts";

import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import {
  inspectSpecAnalysis,
  inspectSpecAnalysisCoverage,
  inspectSpecDefinitionCoverage,
  inspectSpecCoverage,
  parseUiSpecPairs,
  parseUiDetailBindings,
  parseSpecScreenRelations,
  inspectSpecDetailIndex,
  inspectSpecDetailCorrespondence,
  parseSpecDetailDefinitionOwnership,
  parseSpecDetailAreaOwnership,
  parseSpecDetailCentralTrace,
  inspectSpecDetailDownstream,
  parseSpecCorrespondenceRevision,
  parseSpecCorrespondencePair,
  inspectSpecCorrespondencePairEvidence,
  inspectSpecCorrespondence,
  type SpecDetailDownstreamRequest,
  inspectUiSpecRelations,
  inspectSpecDefinition,
  parseSpecIndex,
  createPhaseChecklistItems,
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
  omitMarkdownCommentsAndFencedCode,
} from "../../../domain-model/src/index.ts";
import { mapSpecDomainIssueToFinding } from "../report/convert.ts";

/**
 * spec成果物を観測し、本文・関係の意味をDomainへ渡す。
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
export function inspectSpecRepository(
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
    specAnalysisUxChecklistItemTexts,
    specAnalysisIaChecklistItemTexts,
    specDefinitionChecklistItemTexts,
    specDetailIndexChecklistItemTexts,
    specBehaviorChecklistItemTexts,
    uiSpecDetailCorrespondenceChecklistItemTexts,
    uiSpecCorrespondenceChecklistItemTexts,
  } = createPhaseChecklistItems();

  if (repositoryMode !== "official") return;
  const specIndexPath = path.join(
    root,
    "05_SPEC",
    "01_Behavior_Specification.md",
  );
  if (!lstatIfPresent(specIndexPath)?.isFile()) return;
  const specAnalysisRoot = path.join(root, "05_SPEC", "Analysis");
  const specDefinitionsRoot = path.join(root, "05_SPEC", "Definitions");
  const uiDetailIndexPath = path.join(
    root,
    "04_UI",
    "Details",
    "01_UI_Detail.md",
  );
  const canonicalUiDetailByUi = lstatIfPresent(uiDetailIndexPath)?.isFile()
    ? parseUiDetailBindings(read(uiDetailIndexPath))
    : new Map<string, Readonly<{ scr: string; prt: string }>>();
  const requiredTemplates = [
    path.join(
      root,
      "template",
      "05_SPEC",
      "Analysis",
      "UX-XXXXXX",
      "spec_analysis.md",
    ),
    path.join(
      root,
      "template",
      "05_SPEC",
      "Analysis",
      "IA-XXXXXX",
      "spec_analysis.md",
    ),
    path.join(
      root,
      "template",
      "05_SPEC",
      "Definitions",
      "SPEC-XXXXXX",
      "spec_definition.md",
    ),
  ];
  const specProjectionTemplates = [
    path.join(root, "template", "05_SPEC", "01_Behavior_Specification.md"),
    path.join(root, "template", "05_SPEC", "02_Use_Case_and_Behavior_Flow.md"),
    path.join(root, "template", "05_SPEC", "03_State_Transition_Model.md"),
    path.join(root, "template", "05_SPEC", "04_Actor_System_Sequence.md"),
    path.join(root, "template", "05_SPEC", "05_Error_Effect_and_Recovery.md"),
    path.join(root, "template", "05_SPEC", "06_UI_SPEC_Correspondence.md"),
  ];
  const specDetailTemplates = [
    [
      path.join(root, "template", "05_SPEC", "Details", "01_SPEC_Detail.md"),
      specDetailIndexChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "05_SPEC",
        "Details",
        "BHV-XXXXXX",
        "behavior.md",
      ),
      specBehaviorChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "05_SPEC",
        "Details",
        "02_UI_SPEC_Detail_Correspondence.md",
      ),
      uiSpecDetailCorrespondenceChecklistItemTexts,
    ],
  ] as const;
  for (const templatePath of specProjectionTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "spec-projection-template-missing",
        relative(templatePath),
        "The official SPEC profile must include its root and cross-cutting projection templates.",
      );
  for (const templatePath of requiredTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "spec-reconstruction-template-missing",
        relative(templatePath),
        "The official SPEC profile must include separate UX-view and IA-view analyses plus the integrated SPEC definition template.",
      );
  for (const [templatePath, checklistItems] of specDetailTemplates) {
    if (!lstatIfPresent(templatePath)?.isFile()) {
      add(
        "error",
        "spec-detail-template-missing",
        relative(templatePath),
        "The official SPEC profile must include the complete SPEC Detail template set.",
      );
      continue;
    }
    const error = inspectTemplateChecklist(read(templatePath), checklistItems);
    if (error)
      add(
        "error",
        "spec-detail-template-checklist-invalid",
        relative(templatePath),
        `Every SPEC Detail template must expose one exact unevaluated checklist (${error}).`,
      );
  }
  for (const [templatePath, checklistItems] of [
    [requiredTemplates[0], specAnalysisUxChecklistItemTexts],
    [requiredTemplates[1], specAnalysisIaChecklistItemTexts],
    [requiredTemplates[2], specDefinitionChecklistItemTexts],
  ] as const) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const error = inspectTemplateChecklist(read(templatePath), checklistItems);
    if (error)
      add(
        "error",
        "spec-template-checklist-invalid",
        relative(templatePath),
        `The SPEC template must expose one exact unevaluated checklist (${error}).`,
      );
  }
  const correspondencePath = path.join(
    root,
    "05_SPEC",
    "06_UI_SPEC_Correspondence.md",
  );
  const correspondenceTemplatePath = specProjectionTemplates[5];
  if (lstatIfPresent(correspondencePath)?.isFile()) {
    const error = inspectEvaluatedChecklist(
      read(correspondencePath),
      uiSpecCorrespondenceChecklistItemTexts,
    );
    if (error)
      add(
        "error",
        "ui-spec-correspondence-checklist-invalid",
        relative(correspondencePath),
        `The UI/SPEC correspondence review must expose one completed checklist (${error}).`,
      );
  }
  if (lstatIfPresent(correspondenceTemplatePath)?.isFile()) {
    const error = inspectTemplateChecklist(
      read(correspondenceTemplatePath),
      uiSpecCorrespondenceChecklistItemTexts,
    );
    if (error)
      add(
        "error",
        "ui-spec-correspondence-template-checklist-invalid",
        relative(correspondenceTemplatePath),
        `The UI/SPEC correspondence template must expose one exact unevaluated checklist (${error}).`,
      );
  }

  const definitionIds = (base: string, prefix: "UX" | "IA", file: string) => {
    const result = new Set<string>();
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
  const uxIds = definitionIds(
    path.join(root, "02_UX", "Definitions"),
    "UX",
    "ux_definition.md",
  );
  const iaIds = definitionIds(
    path.join(root, "03_IA", "Definitions"),
    "IA",
    "ia_definition.md",
  );
  const analyzedUx = new Set<string>();
  const analyzedIa = new Set<string>();
  const analysisRelationOccurrences: string[] = [];

  if (lstatIfPresent(specAnalysisRoot)?.isDirectory())
    for (const entry of fs.readdirSync(specAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^(UX|IA)-[0-9]{6}$/u.test(entry.name))
        continue;
      const analysisPath = path.join(
        specAnalysisRoot,
        entry.name,
        "spec_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      const source = omitMarkdownCommentsAndFencedCode(read(analysisPath));
      const isUx = entry.name.startsWith("UX-");
      if (isUx) analyzedUx.add(entry.name);
      else analyzedIa.add(entry.name);
      const model = inspectSpecAnalysis(
        { path: relative(analysisPath), content: source },
        entry.name,
      );
      analysisRelationOccurrences.push(...model.relations);
      for (const issue of model.issues) {
        const finding = mapSpecDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectSpecAnalysisCoverage({
    specIndexPath: relative(specIndexPath),
    specAnalysisRoot: relative(specAnalysisRoot),
    uxIds,
    iaIds,
    analyzedUx,
    analyzedIa,
    analysisRelationOccurrences,
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const analysisRelations = new Set(analysisRelationOccurrences);
  const registry = parseSpecIndex({
    path: relative(specIndexPath),
    content: read(specIndexPath),
  });
  const registryIds = registry.ids;
  const registryRelations = registry.relations;
  const registryUiPairs = registry.uiPairs;
  const indexCountRows = registry.countRows;
  for (const issue of registry.issues) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const actualIds = new Set<string>();
  const definitionRelations = new Set<string>();
  const definitionRelationOccurrences: string[] = [];
  const definitionUiPairs = new Set<string>();
  const definitionUiPairOccurrences: string[] = [];
  if (lstatIfPresent(specDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(specDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^SPEC-[0-9]{6}$/u.test(entry.name))
        continue;
      const definitionPath = path.join(
        specDefinitionsRoot,
        entry.name,
        "spec_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualIds.add(entry.name);
      const source = omitMarkdownCommentsAndFencedCode(read(definitionPath));
      const model = inspectSpecDefinition(
        { path: relative(definitionPath), content: source },
        entry.name,
      );
      definitionRelationOccurrences.push(...model.relations);
      for (const pair of model.relations) definitionRelations.add(pair);
      definitionUiPairOccurrences.push(...model.uiPairs);
      for (const pair of model.uiPairs) definitionUiPairs.add(pair);
      for (const issue of model.issues) {
        const finding = mapSpecDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  const specDetailIndexPath = path.join(
    root,
    "05_SPEC",
    "Details",
    "01_SPEC_Detail.md",
  );
  let canonicalBhvBySpec = new Map<string, string>();
  if (!lstatIfPresent(specDetailIndexPath)?.isFile()) {
    add(
      "error",
      "spec-detail-current-artifact-missing",
      relative(specDetailIndexPath),
      "The official repository must keep the current SPEC Detail migration projection.",
    );
  } else {
    const detail = inspectSpecDetailIndex(
      {
        path: relative(specDetailIndexPath),
        content: read(specDetailIndexPath),
      },
      actualIds,
    );
    canonicalBhvBySpec = detail.behaviors;
    for (const issue of detail.issues) {
      const finding = mapSpecDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const specDetailCorrespondencePath = path.join(
    root,
    "05_SPEC",
    "Details",
    "02_UI_SPEC_Detail_Correspondence.md",
  );
  const expectedDetailRelations = new Map<
    string,
    Readonly<{ bhv: string; ui: string; spec: string; scr: string }>
  >();
  for (const pair of definitionUiPairOccurrences) {
    const [ui, spec] = pair.split("|");
    const uiDetail = canonicalUiDetailByUi.get(ui);
    const bhv = canonicalBhvBySpec.get(spec);
    if (!uiDetail || !bhv) continue;
    expectedDetailRelations.set(`${uiDetail.prt}.spec-${spec.slice(-6)}`, {
      bhv,
      ui,
      spec,
      scr: uiDetail.scr,
    });
  }
  const screenRelationTuples: string[] = [];
  const uiDetailAreasRoot = path.join(root, "04_UI", "Details", "Areas");
  if (lstatIfPresent(uiDetailAreasRoot)?.isDirectory())
    for (const areaEntry of fs.readdirSync(uiDetailAreasRoot, {
      withFileTypes: true,
    })) {
      if (!areaEntry.isDirectory()) continue;
      const areaPath = path.join(uiDetailAreasRoot, areaEntry.name);
      for (const screenEntry of fs.readdirSync(areaPath, {
        withFileTypes: true,
      })) {
        if (
          !screenEntry.isDirectory() ||
          !/^SCR-[0-9]{6}$/u.test(screenEntry.name)
        )
          continue;
        const screenPath = path.join(areaPath, screenEntry.name, "screen.md");
        if (!lstatIfPresent(screenPath)?.isFile()) continue;
        screenRelationTuples.push(
          ...parseSpecScreenRelations(read(screenPath), screenEntry.name),
        );
      }
    }
  const expectedCorrespondenceTuples = new Set(
    [...expectedDetailRelations].map(
      ([relationKey, value]) =>
        `${relationKey}|${value.bhv}|${value.ui}|${value.spec}|${value.scr}`,
    ),
  );
  if (!lstatIfPresent(specDetailCorrespondencePath)?.isFile()) {
    add(
      "error",
      "ui-spec-detail-correspondence-missing",
      relative(specDetailCorrespondencePath),
      "The official repository must keep UI/SPEC Detail correspondence separate from Definition correspondence.",
    );
  } else {
    const detailCorrespondence = omitMarkdownCommentsAndFencedCode(
      read(specDetailCorrespondencePath),
    );
    for (const issue of inspectSpecDetailCorrespondence(
      {
        path: relative(specDetailCorrespondencePath),
        content: detailCorrespondence,
      },
      expectedCorrespondenceTuples,
      screenRelationTuples,
      new Set(definitionUiPairOccurrences).size,
    )) {
      const finding = mapSpecDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const architectureDetailTracePath = path.join(
    root,
    "06_Architecture",
    "08_UI_SPEC_Detail_Traceability.md",
  );
  const qualityDetailAnalysisPath = path.join(
    root,
    "07_Quality",
    "Analysis",
    "Detail",
    "quality_analysis.md",
  );
  if (
    !lstatIfPresent(architectureDetailTracePath)?.isFile() ||
    !lstatIfPresent(qualityDetailAnalysisPath)?.isFile()
  ) {
    add(
      "error",
      "ui-spec-detail-downstream-traceability-missing",
      relative(
        !lstatIfPresent(architectureDetailTracePath)?.isFile()
          ? architectureDetailTracePath
          : qualityDetailAnalysisPath,
      ),
      "Issued UI/SPEC Detail identities must have canonical Architecture and Quality downstream traceability.",
    );
  } else {
    const architectureDetailTrace = omitMarkdownCommentsAndFencedCode(
      read(architectureDetailTracePath),
    );
    const qualityDetailAnalysis = omitMarkdownCommentsAndFencedCode(
      read(qualityDetailAnalysisPath),
    );
    const issuedScreenIds = new Set(
      [...architectureDetailTrace.matchAll(/SCR-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const issuedPartIds = new Set(
      [...architectureDetailTrace.matchAll(/PRT-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const issuedBehaviorIds = new Set(
      [...architectureDetailTrace.matchAll(/BHV-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const qualityScreenIds = new Set(
      [...qualityDetailAnalysis.matchAll(/SCR-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const qualityPartIds = new Set(
      [...qualityDetailAnalysis.matchAll(/PRT-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const qualityBehaviorIds = new Set(
      [...qualityDetailAnalysis.matchAll(/BHV-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const architectureDefinitionsCombined = fs
      .readdirSync(path.join(root, "06_Architecture", "Definitions"), {
        withFileTypes: true,
      })
      .filter(
        (entry) => entry.isDirectory() && /^ARCH-[0-9]{6}$/u.test(entry.name),
      )
      .map((entry) =>
        omitMarkdownCommentsAndFencedCode(
          read(
            path.join(
              root,
              "06_Architecture",
              "Definitions",
              entry.name,
              "architecture_definition.md",
            ),
          ),
        ),
      )
      .join("\n");
    const qualityDefinitionsCombined = fs
      .readdirSync(path.join(root, "07_Quality", "Definitions"), {
        withFileTypes: true,
      })
      .filter(
        (entry) => entry.isDirectory() && /^QA-[0-9]{6}$/u.test(entry.name),
      )
      .map((entry) =>
        omitMarkdownCommentsAndFencedCode(
          read(
            path.join(
              root,
              "07_Quality",
              "Definitions",
              entry.name,
              "quality_definition.md",
            ),
          ),
        ),
      )
      .join("\n");
    const architectureDefinitions: SpecDetailDownstreamRequest["architectureDefinitions"][number][] =
      [];
    const qualityDefinitions: SpecDetailDownstreamRequest["qualityDefinitions"][number][] =
      [];
    const areas: SpecDetailDownstreamRequest["areas"][number][] = [];
    const architectureDefinitionsRoot = path.join(
      root,
      "06_Architecture",
      "Definitions",
    );
    for (const entry of fs.readdirSync(architectureDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^ARCH-[0-9]{6}$/u.test(entry.name))
        continue;
      const source = omitMarkdownCommentsAndFencedCode(
        read(
          path.join(
            architectureDefinitionsRoot,
            entry.name,
            "architecture_definition.md",
          ),
        ),
      );
      architectureDefinitions.push({
        owner: entry.name,
        ownership: parseSpecDetailDefinitionOwnership(source),
      });
    }
    const architectureDetailsRoot = path.join(
      root,
      "06_Architecture",
      "Details",
    );
    for (const entry of fs.readdirSync(architectureDetailsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const detailPath = path.join(
        architectureDetailsRoot,
        entry.name,
        "01_Architecture.md",
      );
      if (!lstatIfPresent(detailPath)?.isFile()) continue;
      const source = omitMarkdownCommentsAndFencedCode(read(detailPath));
      areas.push({
        area: entry.name,
        ownership: parseSpecDetailAreaOwnership(source),
      });
    }
    const qualityDefinitionsRoot = path.join(root, "07_Quality", "Definitions");
    for (const entry of fs.readdirSync(qualityDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^QA-[0-9]{6}$/u.test(entry.name)) continue;
      const source = omitMarkdownCommentsAndFencedCode(
        read(
          path.join(
            qualityDefinitionsRoot,
            entry.name,
            "quality_definition.md",
          ),
        ),
      );
      qualityDefinitions.push({
        owner: entry.name,
        ownership: parseSpecDetailDefinitionOwnership(source),
      });
    }
    const central = parseSpecDetailCentralTrace(
      architectureDetailTrace,
      qualityDetailAnalysis,
    );
    const currentUiDefinitionCount = fs
      .readdirSync(path.join(root, "04_UI", "Definitions"), {
        withFileTypes: true,
      })
      .filter(
        (entry) => entry.isDirectory() && /^UI-[0-9]{6}$/u.test(entry.name),
      ).length;
    for (const issue of inspectSpecDetailDownstream({
      path: relative(architectureDetailTracePath),
      relations: expectedDetailRelations,
      architectureDefinitions,
      qualityDefinitions,
      areas,
      central,
      issued: {
        screens: issuedScreenIds,
        parts: issuedPartIds,
        behaviors: issuedBehaviorIds,
      },
      quality: {
        screens: qualityScreenIds,
        parts: qualityPartIds,
        behaviors: qualityBehaviorIds,
      },
      architectureDefinitionsCombined,
      qualityDefinitionsCombined,
      uiDefinitionCount: currentUiDefinitionCount,
      specDefinitionCount: actualIds.size,
    })) {
      const finding = mapSpecDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  for (const issue of inspectSpecDefinitionCoverage({
    specDefinitionsRoot: relative(specDefinitionsRoot),
    specIndexPath: relative(specIndexPath),
    definitionRelationOccurrences,
    definitionUiPairOccurrences,
    registryIds,
    actualIds,
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const expectedIndexCounts = new Map([
    ["UX定義", uxIds.size],
    ["IA定義", iaIds.size],
    ["SPEC分析", analyzedUx.size + analyzedIa.size],
    ["SPEC定義", actualIds.size],
    [
      "UI定義",
      lstatIfPresent(path.join(root, "04_UI", "Definitions"))?.isDirectory()
        ? fs
            .readdirSync(path.join(root, "04_UI", "Definitions"), {
              withFileTypes: true,
            })
            .filter(
              (entry) =>
                entry.isDirectory() &&
                /^UI-[0-9]{6}$/u.test(entry.name) &&
                lstatIfPresent(
                  path.join(
                    root,
                    "04_UI",
                    "Definitions",
                    entry.name,
                    "ui_definition.md",
                  ),
                )?.isFile(),
            ).length
        : 0,
    ],
  ]);
  for (const issue of inspectSpecCoverage({
    specIndexPath: relative(specIndexPath),
    indexCountRows,
    expectedIndexCounts,
    registryRelations,
    analysisRelations,
    definitionRelations,
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const uiPairs = new Set<string>();
  const uiPairOccurrences: string[] = [];
  const uiDefinitionsRoot = path.join(root, "04_UI", "Definitions");
  if (lstatIfPresent(uiDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UI-[0-9]{6}$/u.test(entry.name)) continue;
      const file = path.join(uiDefinitionsRoot, entry.name, "ui_definition.md");
      if (!lstatIfPresent(file)?.isFile()) continue;
      const source = omitMarkdownCommentsAndFencedCode(read(file));
      for (const pair of parseUiSpecPairs(source, entry.name)) {
        uiPairOccurrences.push(pair);
        uiPairs.add(pair);
      }
    }
  for (const issue of inspectUiSpecRelations({
    uiDefinitionsRoot: relative(uiDefinitionsRoot),
    specIndexPath: relative(specIndexPath),
    uiPairOccurrences,
    registryUiPairs,
    definitionUiPairs,
    uiPairs,
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  if (lstatIfPresent(correspondencePath)?.isFile()) {
    const correspondence = omitMarkdownCommentsAndFencedCode(
      read(correspondencePath),
    );
    const correspondencePairs: string[] = [];
    const recordedDefinitionFingerprint =
      parseSpecCorrespondenceRevision(correspondence);
    const definitionFingerprintInputs: string[] = [];
    for (const [definitionsRoot, fileName, relativeRoot] of [
      [uiDefinitionsRoot, "ui_definition.md", "04_UI/Definitions"],
      [specDefinitionsRoot, "spec_definition.md", "05_SPEC/Definitions"],
    ] as const) {
      for (const directory of fs.readdirSync(definitionsRoot).sort()) {
        const absolutePath = path.join(definitionsRoot, directory, fileName);
        if (!lstatIfPresent(absolutePath)?.isFile()) continue;
        const relativePath = `${relativeRoot}/${directory}/${fileName}`;
        definitionFingerprintInputs.push(
          `${relativePath}\n${fs.readFileSync(absolutePath, "utf8")}`,
        );
      }
    }
    const actualDefinitionFingerprint = createHash("sha256")
      .update(definitionFingerprintInputs.join("\n\u0000\n"), "utf8")
      .digest("hex");
    const correspondenceReasons: string[] = [];
    let hasInvalidPairEvidence = false;
    for (const line of correspondence.split(/\r?\n/u)) {
      const pair = parseSpecCorrespondencePair(line);
      if (!pair) continue;
      correspondencePairs.push(`${pair.uiId}|${pair.specId}`);
      const uiSource = omitMarkdownCommentsAndFencedCode(
        read(path.join(uiDefinitionsRoot, pair.uiId, "ui_definition.md")),
      );
      const specSource = omitMarkdownCommentsAndFencedCode(
        read(path.join(specDefinitionsRoot, pair.specId, "spec_definition.md")),
      );
      const evidence = inspectSpecCorrespondencePairEvidence(
        pair,
        correspondence,
        uiSource,
        specSource,
      );
      correspondenceReasons.push(...evidence.reasons);
      if (evidence.invalid) hasInvalidPairEvidence = true;
    }
    for (const issue of inspectSpecCorrespondence({
      artifact: {
        path: relative(correspondencePath),
        content: correspondence,
      },
      pairs: correspondencePairs,
      reasons: correspondenceReasons,
      expectedPairs: registryUiPairs,
      hasInvalidPairEvidence,
      recordedFingerprint: recordedDefinitionFingerprint,
      actualFingerprint: actualDefinitionFingerprint,
    })) {
      const finding = mapSpecDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
}
