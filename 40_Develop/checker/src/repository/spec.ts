/**
 * spec成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  SpecDefinition,
  SpecDetailIndex,
  UiDefinition,
  UiScreen,
} from "../../../document-model/src/index.ts";
import {
  type DocumentRelationsRequest,
  evaluateDefinitionPairEvidence,
  inspectDocumentRelations,
  inspectSpecConsistency,
  parseArchitectureDefinition,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
  parseQualityDefinition,
  parseQualityDetailAnalysis,
  parseSpecAnalysis,
  parseSpecBehavior,
  parseSpecDefinition,
  parseSpecDefinitionCorrespondence,
  parseSpecDetailCorrespondence,
  parseSpecDetailIndex,
  parseSpecIndex,
  parseUiDefinition,
  parseUiDetailIndex,
  parseUiScreen,
} from "../../../document-model/src/index.ts";
import {
  mapSpecDomainIssueToFinding,
  mapUiDomainIssueToFinding,
} from "../report/convert.ts";
import type { DocumentFinding } from "../report/types.ts";
import {
  lstatIfPresent,
  pathContainsSymbolicLink,
} from "../repository/observe.ts";

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
  const observedUiDetailIndex = lstatIfPresent(uiDetailIndexPath)?.isFile()
    ? parseUiDetailIndex({
        path: relative(uiDetailIndexPath),
        content: read(uiDetailIndexPath),
      }).result
    : null;
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
      "detail_index",
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
      "behavior",
    ],
    [
      path.join(
        root,
        "template",
        "05_SPEC",
        "Details",
        "02_UI_SPEC_Detail_Correspondence.md",
      ),
      "detail_correspondence",
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
  for (const [templatePath, checklistKind] of specDetailTemplates) {
    if (!lstatIfPresent(templatePath)?.isFile()) {
      add(
        "error",
        "spec-detail-template-missing",
        relative(templatePath),
        "The official SPEC profile must include the complete SPEC Detail template set.",
      );
      continue;
    }
    const source = {
      path: relative(templatePath),
      content: read(templatePath),
    };
    const error = (
      checklistKind === "detail_index"
        ? parseSpecDetailIndex(source, { mode: "template" }).result
        : checklistKind === "behavior"
          ? parseSpecBehavior(source, { mode: "template" }).result
          : checklistKind === "detail_correspondence"
            ? parseSpecDetailCorrespondence(source, { mode: "template" }).result
            : (() => {
                throw Error("unknown_spec_checklist_kind");
              })()
    ).checklistContract.failure;
    if (error)
      add(
        "error",
        "spec-detail-template-checklist-invalid",
        relative(templatePath),
        `Every SPEC Detail template must expose one exact unevaluated checklist (${error}).`,
      );
  }
  for (const [templatePath, checklistKind] of [
    [requiredTemplates[0], "analysis_ux"],
    [requiredTemplates[1], "analysis_ia"],
    [requiredTemplates[2], "definition"],
  ] as const) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const source = {
      path: relative(templatePath),
      content: read(templatePath),
    };
    const error = (
      checklistKind === "analysis_ux"
        ? parseSpecAnalysis(source, "UX-XXXXXX", { mode: "template" })
        : checklistKind === "analysis_ia"
          ? parseSpecAnalysis(source, "IA-XXXXXX", { mode: "template" })
          : parseSpecDefinition(source, "SPEC-XXXXXX", { mode: "template" })
    ).result.checklistContract.failure;
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
    const error = parseSpecDefinitionCorrespondence(
      { path: relative(correspondencePath), content: read(correspondencePath) },
      { mode: "evaluated" },
    ).result.checklistContract.failure;
    if (error)
      add(
        "error",
        "ui-spec-correspondence-checklist-invalid",
        relative(correspondencePath),
        `The UI/SPEC correspondence review must expose one completed checklist (${error}).`,
      );
  }
  if (lstatIfPresent(correspondenceTemplatePath)?.isFile()) {
    const error = parseSpecDefinitionCorrespondence(
      {
        path: relative(correspondenceTemplatePath),
        content: read(correspondenceTemplatePath),
      },
      { mode: "template" },
    ).result.checklistContract.failure;
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
      const source = read(analysisPath);
      const isUx = entry.name.startsWith("UX-");
      if (isUx) analyzedUx.add(entry.name);
      else analyzedIa.add(entry.name);
      const model = parseSpecAnalysis(
        { path: relative(analysisPath), content: source },
        entry.name,
      );
      if (model.result)
        analysisRelationOccurrences.push(
          ...model.result.targets.map(
            (ref) => `${model.result?.expectedIdentity}|${ref.identity}`,
          ),
        );
      for (const issue of model.issues) {
        const finding = mapSpecDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectSpecConsistency({
    kind: "spec_analysis_coverage",
    ...{
      specIndexPath: relative(specIndexPath),
      specAnalysisRoot: relative(specAnalysisRoot),
      uxIds,
      iaIds,
      analyzedUx,
      analyzedIa,
      analysisRelationOccurrences,
    },
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const analysisRelations = new Set(analysisRelationOccurrences);
  const registryRead = parseSpecIndex({
    path: relative(specIndexPath),
    content: read(specIndexPath),
  });
  const registry = registryRead.result;
  const registryIds = new Set(registry.entries.map((entry) => entry.identity));
  const registryRelations = new Set(
    registry.entries.flatMap((entry) =>
      [...entry.uxIds, ...entry.iaIds].map((id) => `${id}|${entry.identity}`),
    ),
  );
  const indexCountRows = registry.counts.map((entry) => entry.cells);
  for (const issue of registryRead.issues) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const actualIds = new Set<string>();
  const definitionRelations = new Set<string>();
  const definitionRelationOccurrences: string[] = [];
  const specDefinitions: SpecDefinition[] = [];
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
      const source = read(definitionPath);
      const model = parseSpecDefinition(
        { path: relative(definitionPath), content: source },
        entry.name,
      );
      if (model.result) {
        specDefinitions.push(model.result);
        for (const ref of model.result.analysisInputs) {
          const pair = `${ref.identity}|${model.result.expectedIdentity}`;
          definitionRelationOccurrences.push(pair);
          definitionRelations.add(pair);
        }
        for (const ref of model.result.pairedInterfaces)
          definitionUiPairOccurrences.push(
            `${ref.identity}|${model.result.expectedIdentity}`,
          );
      }
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
  let observedSpecDetailIndex: SpecDetailIndex | null = null;
  if (!lstatIfPresent(specDetailIndexPath)?.isFile()) {
    add(
      "error",
      "spec-detail-current-artifact-missing",
      relative(specDetailIndexPath),
      "The official repository must keep the current SPEC Detail migration projection.",
    );
  } else {
    const detail = parseSpecDetailIndex({
      path: relative(specDetailIndexPath),
      content: read(specDetailIndexPath),
    });
    observedSpecDetailIndex = detail.result;
    for (const issue of inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: detail,
      actualIds: actualIds,
    })) {
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
  const screens: UiScreen[] = [];
  const uiDetailAreasRoot = path.join(root, "04_UI", "Details", "Areas");
  if (
    lstatIfPresent(uiDetailAreasRoot)?.isDirectory() &&
    !pathContainsSymbolicLink(root, uiDetailAreasRoot)
  )
    for (const areaEntry of fs.readdirSync(uiDetailAreasRoot, {
      withFileTypes: true,
    })) {
      if (!areaEntry.isDirectory()) continue;
      const areaPath = path.join(uiDetailAreasRoot, areaEntry.name);
      if (pathContainsSymbolicLink(root, areaPath)) continue;
      for (const screenEntry of fs.readdirSync(areaPath, {
        withFileTypes: true,
      })) {
        if (
          !screenEntry.isDirectory() ||
          !/^SCR-[0-9]{6}$/u.test(screenEntry.name)
        )
          continue;
        const screenPath = path.join(areaPath, screenEntry.name, "screen.md");
        if (
          !lstatIfPresent(screenPath)?.isFile() ||
          pathContainsSymbolicLink(root, screenPath)
        )
          continue;
        const parsed = parseUiScreen(
          { path: relative(screenPath), content: read(screenPath) },
          screenEntry.name,
        );
        screens.push(parsed.result);
        for (const issue of parsed.issues) {
          const finding = mapUiDomainIssueToFinding(issue);
          add(finding.severity, finding.code, finding.path, finding.message);
        }
      }
    }
  if (!lstatIfPresent(specDetailCorrespondencePath)?.isFile()) {
    add(
      "error",
      "ui-spec-detail-correspondence-missing",
      relative(specDetailCorrespondencePath),
      "The official repository must keep UI/SPEC Detail correspondence separate from Definition correspondence.",
    );
  } else {
    const detailCorrespondence = parseSpecDetailCorrespondence({
      path: relative(specDetailCorrespondencePath),
      content: read(specDetailCorrespondencePath),
    }).result;
    for (const issue of inspectDocumentRelations({
      kind: "ui_spec_details",
      correspondence: detailCorrespondence,
      screens,
      uiDetailIndex: observedUiDetailIndex,
      specDetailIndex: observedSpecDetailIndex,
      definitions: specDefinitions,
    })) {
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
    const architectureDetailTrace = parseArchitectureDetailMap({
      path: relative(architectureDetailTracePath),
      content: read(architectureDetailTracePath),
    }).result.trace;
    const qualityDetailAnalysis = parseQualityDetailAnalysis({
      path: relative(qualityDetailAnalysisPath),
      content: read(qualityDetailAnalysisPath),
    }).result.trace;
    const architectureDefinitionObservations = fs
      .readdirSync(path.join(root, "06_Architecture", "Definitions"), {
        withFileTypes: true,
      })
      .filter(
        (entry) => entry.isDirectory() && /^ARCH-[0-9]{6}$/u.test(entry.name),
      )
      .map((entry) => {
        const file = path.join(
          root,
          "06_Architecture",
          "Definitions",
          entry.name,
          "architecture_definition.md",
        );
        return parseArchitectureDefinition(
          { path: relative(file), content: read(file) },
          entry.name,
          {},
        ).result;
      });
    const qualityDefinitionObservations = fs
      .readdirSync(path.join(root, "07_Quality", "Definitions"), {
        withFileTypes: true,
      })
      .filter(
        (entry) => entry.isDirectory() && /^QA-[0-9]{6}$/u.test(entry.name),
      )
      .map((entry) => {
        const file = path.join(
          root,
          "07_Quality",
          "Definitions",
          entry.name,
          "quality_definition.md",
        );
        return parseQualityDefinition(
          { path: relative(file), content: read(file) },
          entry.name,
        ).result;
      });
    const architectureDefinitions: Extract<
      DocumentRelationsRequest,
      { kind: "ui_spec_downstream" }
    >["architectureDefinitions"][number][] = [];
    const qualityDefinitions: Extract<
      DocumentRelationsRequest,
      { kind: "ui_spec_downstream" }
    >["qualityDefinitions"][number][] = [];
    const areas: Extract<
      DocumentRelationsRequest,
      { kind: "ui_spec_downstream" }
    >["areas"][number][] = [];
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
      const definitionPath = path.join(
        architectureDefinitionsRoot,
        entry.name,
        "architecture_definition.md",
      );
      architectureDefinitions.push(
        parseArchitectureDefinition(
          { path: relative(definitionPath), content: read(definitionPath) },
          entry.name,
        ).result.assignment,
      );
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
      areas.push(
        parseArchitectureDetail(
          { path: relative(detailPath), content: read(detailPath) },
          entry.name,
        ).result.assignment,
      );
    }
    const qualityDefinitionsRoot = path.join(root, "07_Quality", "Definitions");
    for (const entry of fs.readdirSync(qualityDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^QA-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        qualityDefinitionsRoot,
        entry.name,
        "quality_definition.md",
      );
      qualityDefinitions.push(
        parseQualityDefinition(
          { path: relative(definitionPath), content: read(definitionPath) },
          entry.name,
        ).result.assignment,
      );
    }
    const currentUiDefinitionCount = fs
      .readdirSync(path.join(root, "04_UI", "Definitions"), {
        withFileTypes: true,
      })
      .filter(
        (entry) => entry.isDirectory() && /^UI-[0-9]{6}$/u.test(entry.name),
      ).length;
    for (const issue of inspectDocumentRelations({
      kind: "ui_spec_downstream",
      definitions: specDefinitions,
      uiDetailIndex: observedUiDetailIndex,
      specDetailIndex: observedSpecDetailIndex,
      path: relative(architectureDetailTracePath),
      architectureDefinitions,
      qualityDefinitions,
      areas,
      architectureTrace: architectureDetailTrace,
      qualityTrace: qualityDetailAnalysis,
      architectureDefinitionObservations,
      qualityDefinitionObservations,
      uiDefinitionCount: currentUiDefinitionCount,
      specDefinitionCount: actualIds.size,
    })) {
      const finding = mapSpecDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  for (const issue of inspectSpecConsistency({
    kind: "spec_definition_coverage",
    ...{
      specDefinitionsRoot: relative(specDefinitionsRoot),
      specIndexPath: relative(specIndexPath),
      definitionRelationOccurrences,
      definitionUiPairOccurrences,
      registryIds,
      actualIds,
    },
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
  for (const issue of inspectSpecConsistency({
    kind: "spec_coverage",
    ...{
      specIndexPath: relative(specIndexPath),
      indexCountRows,
      expectedIndexCounts,
      registryRelations,
      analysisRelations,
      definitionRelations,
    },
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const uiDefinitions: UiDefinition[] = [];
  const uiDefinitionsRoot = path.join(root, "04_UI", "Definitions");
  if (lstatIfPresent(uiDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UI-[0-9]{6}$/u.test(entry.name)) continue;
      const file = path.join(uiDefinitionsRoot, entry.name, "ui_definition.md");
      if (!lstatIfPresent(file)?.isFile()) continue;
      const source = read(file);
      const parsed = parseUiDefinition(
        { path: relative(file), content: source },
        entry.name,
      );
      if (parsed.result) uiDefinitions.push(parsed.result);
    }
  for (const issue of inspectDocumentRelations({
    kind: "ui_spec",
    uiDefinitionsRoot: relative(uiDefinitionsRoot),
    specIndexPath: relative(specIndexPath),
    uiDefinitions,
    specDefinitions,
    registry,
  })) {
    const finding = mapSpecDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  if (lstatIfPresent(correspondencePath)?.isFile()) {
    const correspondence = parseSpecDefinitionCorrespondence({
      path: relative(correspondencePath),
      content: read(correspondencePath),
    }).result;
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
    const evaluations: ReturnType<typeof evaluateDefinitionPairEvidence>[] = [];
    for (const pair of correspondence.pairs) {
      const uiPath = path.join(
        uiDefinitionsRoot,
        pair.uiId,
        "ui_definition.md",
      );
      const ui = parseUiDefinition(
        { path: relative(uiPath), content: read(uiPath) },
        pair.uiId,
      ).result;
      const specPath = path.join(
        specDefinitionsRoot,
        pair.specId,
        "spec_definition.md",
      );
      const spec = parseSpecDefinition(
        { path: relative(specPath), content: read(specPath) },
        pair.specId,
      ).result;
      evaluations.push(evaluateDefinitionPairEvidence(pair, ui, spec));
    }
    for (const issue of inspectDocumentRelations({
      kind: "ui_spec_evidence",
      correspondence,
      evaluations,
      registry,
      actualFingerprint: actualDefinitionFingerprint,
    })) {
      const finding = mapSpecDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  // 既存の関係評価後にBHV本文の局所診断を配送し、意味や新しい被覆条件を追加しない。
  const behaviorRoot = path.join(root, "05_SPEC", "Details");
  if (
    lstatIfPresent(behaviorRoot)?.isDirectory() &&
    !pathContainsSymbolicLink(root, behaviorRoot)
  )
    for (const entry of fs.readdirSync(behaviorRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^BHV-[0-9]{6}$/u.test(entry.name)) continue;
      const file = path.join(behaviorRoot, entry.name, "behavior.md");
      if (
        !lstatIfPresent(file)?.isFile() ||
        pathContainsSymbolicLink(root, file)
      )
        continue;
      const parsed = parseSpecBehavior(
        { path: relative(file), content: read(file) },
        { mode: "evaluated" },
      );
      for (const issue of parsed.issues) {
        const finding = mapSpecDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
}
