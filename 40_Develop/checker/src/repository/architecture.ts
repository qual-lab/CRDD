/**
 * architecture成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */

import fs from "node:fs";
import path from "node:path";
import {
  type ArchitectureAnalysis,
  type ArchitectureDefinition,
  type ArchitectureDetailMapModel,
  type ArchitectureDetailModel,
  inspectArchitectureConsistency,
  parseArchitectureAnalysis,
  parseArchitectureCrossModel,
  parseArchitectureDefinition,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
  parseArchitectureIndex,
} from "@qual-lab/crdd-document-model";
import { mapArchitectureDomainIssueToFinding } from "../report/convert.ts";
import type { DocumentFinding } from "../report/types.ts";
import { lstatIfPresent } from "../repository/observe.ts";

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

  for (const [templatePath, checklistKind] of [
    [
      path.join(
        root,
        "template",
        "06_Architecture",
        "Analysis",
        "UI-XXXXXX",
        "architecture_analysis.md",
      ),
      "analysis_ui",
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
      "analysis_spec",
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
      "definition_template",
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
      "detail_template",
    ],
  ] as const) {
    if (!lstatIfPresent(templatePath)?.isFile()) continue;
    const checklistError = (
      checklistKind === "analysis_ui"
        ? parseArchitectureAnalysis(
            { path: relative(templatePath), content: read(templatePath) },
            "UI",
            "UI-XXXXXX",
            { mode: "template" },
          )
        : checklistKind === "analysis_spec"
          ? parseArchitectureAnalysis(
              { path: relative(templatePath), content: read(templatePath) },
              "SPEC",
              "SPEC-XXXXXX",
              { mode: "template" },
            )
          : checklistKind === "definition_template"
            ? parseArchitectureDefinition(
                { path: relative(templatePath), content: read(templatePath) },
                "ARCH-XXXXXX",
                { mode: "template" },
              )
            : parseArchitectureDetail(
                { path: relative(templatePath), content: read(templatePath) },
                "area",
                { mode: "template" },
              )
    ).result.checklistContract.failure;
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
    const source = read(architectureDefinitionTemplatePath);
    for (const issue of parseArchitectureDefinition(
      {
        path: relative(architectureDefinitionTemplatePath),
        content: source,
      },
      "ARCH-XXXXXX",
      { mode: "template" },
    ).issues.filter(
      (issue) =>
        ![
          "artifact.architecture.definition-contract-invalid",
          "artifact.architecture.detail-contract-invalid",
        ].includes(issue.kind),
    )) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  if (lstatIfPresent(architectureDetailTemplatePath)?.isFile()) {
    const source = read(architectureDetailTemplatePath);
    for (const issue of parseArchitectureDetail(
      { path: relative(architectureDetailTemplatePath), content: source },
      "area",
      { mode: "template" },
    ).issues.filter(
      (issue) =>
        ![
          "artifact.architecture.definition-contract-invalid",
          "artifact.architecture.detail-contract-invalid",
        ].includes(issue.kind),
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
  const analyses: ArchitectureAnalysis[] = [];
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
      const source = read(analysisPath);
      const checklistSource = {
        path: relative(analysisPath),
        content: read(analysisPath),
      };
      const model = parseArchitectureAnalysis(
        { path: relative(analysisPath), content: source },
        kind,
        id,
        { checklistSource },
      );
      analyses.push(model.result);
      for (const issue of inspectArchitectureConsistency({
        kind: "architecture_readiness",
        documentType: "analysis",
        document: model,
        isReady: isArchitectureReadyStatus,
      })) {
        const finding = mapArchitectureDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectArchitectureConsistency({
    kind: "architecture_inputs",
    sourcePath: relative(architectureIndexPath),
    analysisPath: relative(analysisRoot),
    analyses,
    uiIds,
    specIds,
    actualAnalysisIds,
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const registrySource = {
    path: relative(architectureIndexPath),
    content: read(architectureIndexPath),
  };
  const crossModelIndex = parseArchitectureIndex(registrySource);
  for (const issue of crossModelIndex.issues.filter(
    (issue) =>
      issue.kind !== "artifact.architecture.definition-index-coverage-mismatch",
  )) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const file of crossModelIndex.result.files) {
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
    const modelSource = read(modelPath);
    for (const issue of inspectArchitectureConsistency({
      kind: "architecture_cross_model",
      document: parseArchitectureCrossModel(
        { path: relative(modelPath), content: modelSource },
        file,
      ),
      index: crossModelIndex.result,
    })) {
      const finding = mapArchitectureDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  const registryModel = crossModelIndex.result.registry;
  const definitionRoot = path.join(root, "06_Architecture", "Definitions");
  const actualDefinitions = new Set<string>();
  const definitions: ArchitectureDefinition[] = [];
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
      const source = read(definitionPath);
      const checklistSource = {
        path: relative(definitionPath),
        content: read(definitionPath),
      };
      const model = parseArchitectureDefinition(
        { path: relative(definitionPath), content: source },
        entry.name,
        { checklistSource },
      );
      definitions.push(model.result);
      for (const issue of inspectArchitectureConsistency({
        kind: "architecture_readiness",
        documentType: "definition",
        document: model,
        isReady: isArchitectureReadyStatus,
      })) {
        const finding = mapArchitectureDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }

  for (const issue of inspectArchitectureConsistency({
    kind: "architecture_registry_coverage",
    sourcePath: relative(architectureIndexPath),
    registry: registryModel,
    actualDefinitions: actualDefinitions,
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const componentModelPath = path.join(
    root,
    "06_Architecture",
    "02_Component_and_Responsibility_Model.md",
  );
  if (lstatIfPresent(componentModelPath)?.isFile()) {
    const componentSource = read(componentModelPath);
    for (const issue of inspectArchitectureConsistency({
      kind: "architecture_component_coverage",
      model: parseArchitectureCrossModel(
        {
          path: relative(componentModelPath),
          content: componentSource,
        },
        "02_Component_and_Responsibility_Model.md",
      ).result,
      actualDefinitions: actualDefinitions,
    })) {
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
  let detailMap: ArchitectureDetailMapModel | null = null;
  const details: ArchitectureDetailModel[] = [];
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
    const source = read(detailMapPath);
    const model = parseArchitectureDetailMap({
      path: relative(detailMapPath),
      content: source,
    });
    detailMap = model.result;
    for (const issue of inspectArchitectureConsistency({
      kind: "architecture_detail_map_coverage",
      document: model,
      actualDefinitions,
    })) {
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
      if (detailMap?.retiredAreas.has(entry.name)) continue;
      const source = read(detailPath);
      const detailMarkdown = read(detailPath);
      const checklistSource = {
        path: relative(detailPath),
        content: detailMarkdown,
      };
      const model = parseArchitectureDetail(
        { path: relative(detailPath), content: source },
        entry.name,
        { checklistSource },
      );
      details.push(model.result);
      for (const issue of inspectArchitectureConsistency({
        kind: "architecture_readiness",
        documentType: "detail",
        document: model,
        isReady: isArchitectureReadyStatus,
      })) {
        const finding = mapArchitectureDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  for (const issue of inspectArchitectureConsistency({
    kind: "architecture_detail_coverage",
    ...{
      sourcePath: relative(detailMapPath),
      map: detailMap,
      details,
      actualDetailAreas,
      actualDefinitions,
      isArchitectureReady,
    },
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const issue of inspectArchitectureConsistency({
    kind: "architecture_relations",
    ...{
      sourcePath: relative(architectureIndexPath),
      analyses,
      definitions,
      registry: registryModel,
    },
  })) {
    const finding = mapArchitectureDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}
