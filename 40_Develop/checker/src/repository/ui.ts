/**
 * ui成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */
import type { DocumentFinding } from "../report/types.ts";

import { lstatIfPresent } from "../repository/observe.ts";

import fs from "node:fs";
import path from "node:path";

import {
  parseUiIndex,
  inspectUiDetail,
  inspectUiAnalysis,
  inspectUiDefinition,
  inspectUiAnalysisCoverage,
  inspectUiIndexCoverage,
  inspectUiRelations,
  type UiRelationsModel,
  createPhaseChecklistItems,
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../domain-model/src/index.ts";
import { mapUiDomainIssueToFinding } from "../report/convert.ts";

/**
 * ui成果物を観測し、本文・関係の意味をDomainへ渡す。
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
export function inspectUiRepository(
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
    uiAnalysisUxChecklistItemTexts,
    uiAnalysisIaChecklistItemTexts,
    uiDefinitionChecklistItemTexts,
    uiDetailIndexChecklistItemTexts,
    uiAreaChecklistItemTexts,
    uiScreenChecklistItemTexts,
    uiComponentChecklistItemTexts,
    uiVisualBaselineChecklistItemTexts,
    uiSpecHandoffChecklistItemTexts,
  } = createPhaseChecklistItems();

  if (repositoryMode !== "official") return;
  const uxDefinitionsRoot = path.join(root, "02_UX", "Definitions");
  const iaDefinitionsRoot = path.join(root, "03_IA", "Definitions");
  const uiIndexPath = path.join(root, "04_UI", "01_User_Interface.md");
  const uiAnalysisRoot = path.join(root, "04_UI", "Analysis");
  const uiDefinitionsRoot = path.join(root, "04_UI", "Definitions");
  if (!lstatIfPresent(uiIndexPath)?.isFile()) return;

  const requiredTemplates = [
    path.join(
      root,
      "template",
      "04_UI",
      "Analysis",
      "UX-XXXXXX",
      "ui_analysis.md",
    ),
    path.join(
      root,
      "template",
      "04_UI",
      "Analysis",
      "IA-XXXXXX",
      "ui_analysis.md",
    ),
    path.join(
      root,
      "template",
      "04_UI",
      "Definitions",
      "UI-XXXXXX",
      "ui_definition.md",
    ),
  ];
  const uiProjectionTemplates = [
    path.join(root, "template", "04_UI", "01_User_Interface.md"),
    path.join(root, "template", "04_UI", "02_Surface_and_Region_Model.md"),
    path.join(root, "template", "04_UI", "03_Interaction_and_State_Model.md"),
    path.join(
      root,
      "template",
      "04_UI",
      "04_Visual_and_Accessibility_Direction.md",
    ),
    path.join(root, "template", "04_UI", "05_UI_SPEC_Handoff.md"),
  ];
  const uiDetailTemplates = [
    [
      path.join(root, "template", "04_UI", "Details", "01_UI_Detail.md"),
      uiDetailIndexChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "04_UI",
        "Details",
        "Areas",
        "AREA-NAME",
        "area.md",
      ),
      uiAreaChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "04_UI",
        "Details",
        "Areas",
        "AREA-NAME",
        "SCR-XXXXXX",
        "screen.md",
      ),
      uiScreenChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "04_UI",
        "Details",
        "Components",
        "CMP-XXXXXX",
        "component.md",
      ),
      uiComponentChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "04_UI",
        "Details",
        "Visual",
        "visual_baseline.md",
      ),
      uiVisualBaselineChecklistItemTexts,
    ],
  ] as const;
  for (const templatePath of uiProjectionTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "ui-projection-template-missing",
        relative(templatePath),
        "The official UI profile must include its root and cross-cutting projection templates.",
      );
  for (const templatePath of requiredTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "ui-reconstruction-template-missing",
        relative(templatePath),
        "The official UI profile must include separate UX-view and IA-view analysis templates plus the integrated UI definition template.",
      );
  for (const [templatePath, checklistItems] of uiDetailTemplates) {
    if (!lstatIfPresent(templatePath)?.isFile()) {
      add(
        "error",
        "ui-detail-template-missing",
        relative(templatePath),
        "The official UI profile must include the complete UI Detail template set.",
      );
      continue;
    }
    const error = inspectTemplateChecklist(read(templatePath), checklistItems);
    if (error)
      add(
        "error",
        "ui-detail-template-checklist-invalid",
        relative(templatePath),
        `Every UI Detail template must expose one exact unevaluated checklist (${error}).`,
      );
  }
  for (const [templatePath, checklistItems] of [
    [requiredTemplates[0], uiAnalysisUxChecklistItemTexts],
    [requiredTemplates[1], uiAnalysisIaChecklistItemTexts],
    [requiredTemplates[2], uiDefinitionChecklistItemTexts],
  ] as const) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const error = inspectTemplateChecklist(read(templatePath), checklistItems);
    if (error)
      add(
        "error",
        "ui-template-checklist-invalid",
        relative(templatePath),
        `The UI template must expose one exact unevaluated checklist (${error}).`,
      );
  }
  const uiHandoffPath = path.join(root, "04_UI", "05_UI_SPEC_Handoff.md");
  const uiHandoffTemplatePath = uiProjectionTemplates[4];
  if (lstatIfPresent(uiHandoffPath)?.isFile()) {
    const error = inspectEvaluatedChecklist(
      read(uiHandoffPath),
      uiSpecHandoffChecklistItemTexts,
    );
    if (error)
      add(
        "error",
        "ui-spec-handoff-checklist-invalid",
        relative(uiHandoffPath),
        `The UI-side handoff must expose one completed checklist (${error}).`,
      );
  }
  if (lstatIfPresent(uiHandoffTemplatePath)?.isFile()) {
    const error = inspectTemplateChecklist(
      read(uiHandoffTemplatePath),
      uiSpecHandoffChecklistItemTexts,
    );
    if (error)
      add(
        "error",
        "ui-spec-handoff-template-checklist-invalid",
        relative(uiHandoffTemplatePath),
        `The UI-side handoff template must expose one exact unevaluated checklist (${error}).`,
      );
  }

  const canonicalIds = (
    definitionsRoot: string,
    prefix: "UX" | "IA",
    file: string,
  ) => {
    const ids = new Set<string>();
    if (!lstatIfPresent(definitionsRoot)?.isDirectory()) return ids;
    for (const entry of fs.readdirSync(definitionsRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(path.join(definitionsRoot, entry.name, file))?.isFile()
      )
        ids.add(entry.name);
    return ids;
  };
  const uxIds = canonicalIds(uxDefinitionsRoot, "UX", "ux_definition.md");
  const iaIds = canonicalIds(iaDefinitionsRoot, "IA", "ia_definition.md");

  const uiIndexSource = {
    path: relative(uiIndexPath),
    content: read(uiIndexPath),
  };
  const uiIndexModel = parseUiIndex(uiIndexSource);
  for (const issue of uiIndexModel.issues) {
    const finding = mapUiDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const uiDetailIndexPath = path.join(
    root,
    "04_UI",
    "Details",
    "01_UI_Detail.md",
  );
  if (!lstatIfPresent(uiDetailIndexPath)?.isFile()) {
    add(
      "error",
      "ui-detail-current-artifact-missing",
      relative(uiDetailIndexPath),
      "The official repository must keep the current UI Detail migration projection.",
    );
  } else {
    for (const issue of inspectUiDetail(
      {
        path: relative(uiDetailIndexPath),
        content: read(uiDetailIndexPath),
      },
      uiIndexModel.ids,
    )) {
      const finding = mapUiDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const analysisUxIds = new Set<string>();
  const analysisIaIds = new Set<string>();
  const uiAnalyses: UiRelationsModel[] = [];
  if (lstatIfPresent(uiAnalysisRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^(UX|IA)-[0-9]{6}$/u.test(entry.name))
        continue;
      const analysisPath = path.join(
        uiAnalysisRoot,
        entry.name,
        "ui_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      const model = inspectUiAnalysis(
        { path: relative(analysisPath), content: read(analysisPath) },
        entry.name,
      );
      uiAnalyses.push(model);
      if (entry.name.startsWith("UX-")) analysisUxIds.add(entry.name);
      else analysisIaIds.add(entry.name);
      for (const issue of model.issues) {
        const finding = mapUiDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectUiAnalysisCoverage(
    uiIndexSource.path,
    uxIds,
    iaIds,
    analysisUxIds,
    analysisIaIds,
  )) {
    const finding = mapUiDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const actualUiIds = new Set<string>();
  const uiDefinitions: UiRelationsModel[] = [];
  if (lstatIfPresent(uiDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UI-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        uiDefinitionsRoot,
        entry.name,
        "ui_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualUiIds.add(entry.name);
      const model = inspectUiDefinition(
        { path: relative(definitionPath), content: read(definitionPath) },
        entry.name,
      );
      uiDefinitions.push(model);
      for (const issue of model.issues) {
        const finding = mapUiDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectUiIndexCoverage(
    uiIndexSource.path,
    uiIndexModel,
    actualUiIds,
  )) {
    const finding = mapUiDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const issue of inspectUiRelations(
    uiIndexSource.path,
    uiIndexModel,
    uiAnalyses,
    uiDefinitions,
  )) {
    const finding = mapUiDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}
