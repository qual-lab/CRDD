/**
 * quality成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */

import fs from "node:fs";
import path from "node:path";
import {
  type ArtifactSource,
  inspectDocumentRelations,
  inspectQualityAnalysis,
  inspectQualityLocalItemOwnership,
  parseArchitectureDetail,
  parseArtifact,
  parseQualityAnalysis,
  parseQualityCenter,
  parseQualityDefinition,
  parseQualityDetailAnalysis,
  parseQualityIntegration,
  parseQualityRealityAudit,
  parseQualityStrategy,
  parseQualityVerificationDesign,
  parseQualityVerificationResult,
} from "../../../document-model/src/index.ts";
import { mapArtifactDomainIssueToCheckerFinding } from "../report/convert.ts";
import {
  mapQualityAnalysisIssueToFinding,
  mapQualityDefinitionIssueToFinding,
  mapQualityDesignStateIssueToFinding,
  mapQualityRelationsIssueToFinding,
} from "../report/quality.ts";
import type { DocumentFinding } from "../report/types.ts";
import {
  lstatIfPresent,
  pathContainsSymbolicLink,
} from "../repository/observe.ts";

/**
 * quality成果物を観測し、本文・関係の意味をDomainへ渡す。
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
export function inspectQualityRepository(
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

  const qualityRoot = path.join(root, "07_Quality");
  const analysisRoot = path.join(qualityRoot, "Analysis");
  const phaseAnalysisSpecs = ["REQ", "UX", "IA", "UI", "SPEC", "ARCH"] as const;
  const phaseAnalysisPaths = phaseAnalysisSpecs.map((prefix) =>
    path.join(analysisRoot, prefix, "quality_analysis.md"),
  );
  const analysisPath = path.join(qualityRoot, "04_Quality_Integration.md");
  const architectureIndexPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  if (!lstatIfPresent(architectureIndexPath)?.isFile()) return;
  if (
    !lstatIfPresent(analysisPath)?.isFile() ||
    phaseAnalysisPaths.some((phasePath) => !lstatIfPresent(phasePath)?.isFile())
  ) {
    add(
      "error",
      "quality-canonical-mapping-missing",
      relative(analysisRoot),
      "The official repository must keep one origin-based Quality analysis for REQ, UX, IA, UI, SPEC, and ARCH plus one Quality Integration result.",
    );
    return;
  }

  const templateQualityRoot = path.join(root, "template", "07_Quality");
  const requiredQualityFiles = [
    "01_Quality_Center.md",
    "02_Quality_Strategy.md",
    "03_Verification_Design.md",
    "04_Quality_Integration.md",
    "05_Current_Implementation_Reality_Audit.md",
  ] as const;
  const requiredTemplateQualityFiles = [
    ...requiredQualityFiles,
    "99_Verification_Result_Format.md",
  ] as const;
  for (const [qualityStructureRoot, requiredFiles] of [
    [qualityRoot, requiredQualityFiles],
    [templateQualityRoot, requiredTemplateQualityFiles],
  ] as const) {
    for (const fileName of requiredFiles) {
      const filePath = path.join(qualityStructureRoot, fileName);
      if (
        !lstatIfPresent(filePath)?.isFile() ||
        pathContainsSymbolicLink(root, filePath)
      )
        add(
          "error",
          "quality-current-profile-file-missing",
          relative(filePath),
          "The CRDD official current profile must keep the complete numbered Quality root file set and the template-only 99 verification-result helper.",
        );
    }
    const requiredDirectories =
      qualityStructureRoot === qualityRoot
        ? ["Analysis", "Definitions", "Registry"]
        : ["Analysis", "Definitions"];
    for (const directoryName of requiredDirectories) {
      const directoryPath = path.join(qualityStructureRoot, directoryName);
      const stat = lstatIfPresent(directoryPath);
      if (!stat?.isDirectory() || pathContainsSymbolicLink(root, directoryPath))
        add(
          "error",
          "quality-repository-structure-invalid",
          relative(directoryPath),
          "Quality Analysis, Definitions, and the official machine-consumer Registry must remain in their current-profile directories.",
        );
    }
  }
  for (const registryFileName of [
    "test-catalog.json",
    "coordinator-runtime-traceability.json",
    "coordinator-task-design-traceability.json",
  ]) {
    const registryFilePath = path.join(
      qualityRoot,
      "Registry",
      registryFileName,
    );
    if (
      !lstatIfPresent(registryFilePath)?.isFile() ||
      pathContainsSymbolicLink(root, registryFilePath)
    )
      add(
        "error",
        "quality-current-profile-registry-missing",
        relative(registryFilePath),
        "The CRDD official repository currently has machine consumers for all three Quality Registry contracts.",
      );
  }
  for (const legacyRelativePath of [
    "07_Quality/04_Test_Catalog.json",
    "07_Quality/05_Coordinator_Runtime_Traceability.json",
    "07_Quality/06_Project_Runtime_Design_Traceability.json",
    "07_Quality/Analysis/canonical-definition-mapping",
    "07_Quality/Analysis/current-implementation-reality",
    "template/07_Quality/04_Verification_Result_Format.md",
    "template/07_Quality/Analysis/_Template",
    "template/07_Quality/Definitions/_Template",
    "template/07_Quality/Evidence",
  ]) {
    const legacyPath = path.join(root, legacyRelativePath);
    if (lstatIfPresent(legacyPath))
      add(
        "error",
        "quality-legacy-layout-reintroduced",
        relative(legacyPath),
        "The CRDD official current profile must not reintroduce a superseded Quality path or shared Evidence container.",
      );
  }

  const qualityRootChecklistSpecs = [
    ["01_Quality_Center.md", "center", parseQualityCenter],
    ["02_Quality_Strategy.md", "strategy", parseQualityStrategy],
    [
      "03_Verification_Design.md",
      "verification_design",
      parseQualityVerificationDesign,
    ],
    ["04_Quality_Integration.md", "integration", parseQualityIntegration],
    [
      "05_Current_Implementation_Reality_Audit.md",
      "reality_audit",
      parseQualityRealityAudit,
    ],
  ] as const;
  for (const [fileName, , parse] of qualityRootChecklistSpecs) {
    const currentPath = path.join(qualityRoot, fileName);
    if (lstatIfPresent(currentPath)?.isFile()) {
      const currentError = parse(
        { path: relative(currentPath), content: read(currentPath) },
        { mode: "evaluated" },
      ).result.checklistContract.failure;
      if (currentError)
        add(
          "error",
          "quality-visible-checklist-invalid",
          relative(currentPath),
          `The Quality current-profile artifact must keep one evaluated visible Checklist with the canonical item set (${currentError}).`,
        );
    }
    const templatePath = path.join(templateQualityRoot, fileName);
    if (lstatIfPresent(templatePath)?.isFile()) {
      const templateError = parse(
        { path: relative(templatePath), content: read(templatePath) },
        { mode: "template" },
      ).result.checklistContract.failure;
      if (templateError)
        add(
          "error",
          "quality-template-visible-checklist-invalid",
          relative(templatePath),
          `The Quality template must keep one unevaluated visible Checklist with result guidance and the canonical item set (${templateError}).`,
        );
    }
  }

  const verificationResultTemplatePath = path.join(
    templateQualityRoot,
    "99_Verification_Result_Format.md",
  );
  const verificationResultTemplateError = parseQualityVerificationResult(
    {
      path: relative(verificationResultTemplatePath),
      content: lstatIfPresent(verificationResultTemplatePath)?.isFile()
        ? read(verificationResultTemplatePath)
        : "",
    },
    { mode: "template" },
  ).result.checklistContract.failure;
  if (verificationResultTemplateError)
    add(
      "error",
      "quality-template-visible-checklist-invalid",
      relative(verificationResultTemplatePath),
      `The Quality verification-result template must keep one unevaluated visible Checklist with result guidance and the canonical item set (${verificationResultTemplateError}).`,
    );

  if (lstatIfPresent(verificationResultTemplatePath)?.isFile()) {
    const verificationResultTemplate = read(verificationResultTemplatePath);
    if (
      !parseQualityVerificationResult(
        {
          path: relative(verificationResultTemplatePath),
          content: verificationResultTemplate,
        },
        { mode: "template" },
      ).result.templateContract?.valid
    )
      add(
        "error",
        "quality-verification-result-applicability-contract-invalid",
        relative(verificationResultTemplatePath),
        "The verification-result template must require all eleven applicability evaluations and reasoned N/A/OPEN handling.",
      );
  }

  const qualityAnalysisTemplatePath = path.join(
    templateQualityRoot,
    "Analysis",
    "PHASE",
    "quality_analysis.md",
  );
  const qualityAnalysisTemplateError = parseQualityDetailAnalysis(
    {
      path: relative(qualityAnalysisTemplatePath),
      content: read(qualityAnalysisTemplatePath),
    },
    { mode: "template" },
  ).result.checklistContract.failure;
  if (qualityAnalysisTemplateError)
    add(
      "error",
      "quality-template-visible-checklist-invalid",
      relative(qualityAnalysisTemplatePath),
      `The Quality Analysis template must keep one unevaluated visible Checklist with result guidance and the canonical item set (${qualityAnalysisTemplateError}).`,
    );
  if (lstatIfPresent(qualityAnalysisTemplatePath)?.isFile()) {
    const source = read(qualityAnalysisTemplatePath);
    if (
      !parseQualityAnalysis(
        {
          path: relative(qualityAnalysisTemplatePath),
          content: source,
        },
        { mode: "template" },
      ).result.templateContract?.valid
    )
      add(
        "error",
        "quality-source-layer-contract-missing",
        relative(qualityAnalysisTemplatePath),
        "Quality Analysis must distinguish Definition-derived success conditions from Detail-derived observation conditions and preserve their relation.",
      );
  }
  const qualityIntegrationTemplatePath = path.join(
    templateQualityRoot,
    "04_Quality_Integration.md",
  );
  if (lstatIfPresent(qualityIntegrationTemplatePath)?.isFile()) {
    const source = read(qualityIntegrationTemplatePath);
    if (
      !parseQualityIntegration(
        {
          path: relative(qualityIntegrationTemplatePath),
          content: source,
        },
        { mode: "template" },
      ).result.templateContract?.valid
    )
      add(
        "error",
        "quality-detail-integration-contract-missing",
        relative(qualityIntegrationTemplatePath),
        "Quality Integration must preserve the source layer and the Same/New/Merge rationale for Definition and Detail obligations.",
      );
  }
  for (const phaseAnalysisPath of phaseAnalysisPaths) {
    const checklistError = parseQualityAnalysis(
      { path: relative(phaseAnalysisPath), content: read(phaseAnalysisPath) },
      { mode: "evaluated" },
    ).result.checklistContract.failure;
    if (checklistError)
      add(
        "error",
        "quality-visible-checklist-invalid",
        relative(phaseAnalysisPath),
        `Every Quality Analysis must keep one evaluated visible Checklist with the canonical item set (${checklistError}).`,
      );
  }

  const qualityDefinitionTemplatePath = path.join(
    templateQualityRoot,
    "Definitions",
    "QA-XXXXXX",
    "quality_definition.md",
  );
  const qualityDefinitionTemplateError = parseQualityDefinition(
    {
      path: relative(qualityDefinitionTemplatePath),
      content: read(qualityDefinitionTemplatePath),
    },
    "QA-XXXXXX",
    { mode: "template" },
  ).result.checklistContract.failure;
  if (qualityDefinitionTemplateError)
    add(
      "error",
      "quality-template-visible-checklist-invalid",
      relative(qualityDefinitionTemplatePath),
      `The Quality Definition template must keep one unevaluated visible Checklist with result guidance and the canonical item set (${qualityDefinitionTemplateError}).`,
    );
  const qualityDefinitionPaths = fs
    .readdirSync(path.join(qualityRoot, "Definitions"), {
      withFileTypes: true,
    })
    .filter((entry) => entry.isDirectory() && /^QA-[0-9]{6}$/u.test(entry.name))
    .map((entry) =>
      path.join(
        qualityRoot,
        "Definitions",
        entry.name,
        "quality_definition.md",
      ),
    )
    .filter((definitionPath) => lstatIfPresent(definitionPath)?.isFile());
  for (const definitionPath of qualityDefinitionPaths) {
    const checklistError = parseQualityDefinition(
      { path: relative(definitionPath), content: read(definitionPath) },
      path.basename(path.dirname(definitionPath)),
      { mode: "evaluated" },
    ).result.checklistContract.failure;
    if (checklistError)
      add(
        "error",
        "quality-visible-checklist-invalid",
        relative(definitionPath),
        `Every Quality Definition must keep one evaluated visible Checklist with the canonical item set (${checklistError}).`,
      );
  }

  const qualityCenterPath = path.join(qualityRoot, "01_Quality_Center.md");
  const qualityCenter = lstatIfPresent(qualityCenterPath)?.isFile()
    ? read(qualityCenterPath)
    : "";
  const qualityCenterResult = parseQualityCenter({
    path: relative(qualityCenterPath),
    content: qualityCenter,
  });
  const { isQualityDesignReady, isQualityReady } = qualityCenterResult.result;
  for (const issue of qualityCenterResult.issues.filter(
    (issue) => issue.kind !== "artifact.quality.checklist-invalid",
  )) {
    const finding = mapQualityAnalysisIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const realityAuditPath = path.join(
    qualityRoot,
    "05_Current_Implementation_Reality_Audit.md",
  );
  const realityAudit = lstatIfPresent(realityAuditPath)?.isFile()
    ? read(realityAuditPath)
    : "";
  const realityAuditResult = parseQualityRealityAudit({
    path: relative(realityAuditPath),
    content: realityAudit,
  });
  for (const issue of inspectDocumentRelations({
    kind: "quality_reality_state",
    center: qualityCenterResult.result,
    reality: realityAuditResult,
  })) {
    const finding = mapQualityAnalysisIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  if (isQualityDesignReady || isQualityReady) {
    const qualityDesignEntries = [
      ...qualityRootChecklistSpecs
        .filter(([, kind]) => kind !== "reality_audit")
        .map(
          ([fileName, , parse]) =>
            [path.join(qualityRoot, fileName), parse] as const,
        ),
      ...phaseAnalysisPaths.map(
        (file) => [file, parseQualityAnalysis] as const,
      ),
      ...qualityDefinitionPaths.map(
        (file) =>
          [
            file,
            (source: ArtifactSource) =>
              parseQualityDefinition(source, path.basename(path.dirname(file))),
          ] as const,
      ),
    ];
    const qualityDesignPaths = qualityDesignEntries.map(([file]) => file);
    const qualityCurrentEntries = isQualityReady
      ? [
          ...qualityDesignEntries,
          [realityAuditPath, parseQualityRealityAudit] as const,
        ]
      : qualityDesignEntries;
    const qualityDesignArtifactPaths = qualityDesignPaths.filter(
      (qualityDesignPath) => qualityDesignPath !== qualityCenterPath,
    );
    const artifacts = qualityDesignArtifactPaths
      .filter((artifactPath) => lstatIfPresent(artifactPath)?.isFile())
      .map((artifactPath) => ({
        path: relative(artifactPath),
        content: read(artifactPath),
      }))
      .map((source) => parseArtifact(source).result);
    for (const issue of inspectDocumentRelations({
      kind: "artifact_relations",
      artifacts,
    }))
      mapArtifactDomainIssueToCheckerFinding(issue);
    for (const issue of inspectDocumentRelations({
      kind: "quality_design_states",
      artifacts,
    })) {
      const finding = mapQualityDesignStateIssueToFinding(
        issue,
        isQualityReady ? "Quality Ready" : "Quality Design Ready",
      );
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    for (const [qualityCurrentPath, parse] of qualityCurrentEntries) {
      if (!lstatIfPresent(qualityCurrentPath)?.isFile()) continue;
      if (
        parse({
          path: relative(qualityCurrentPath),
          content: read(qualityCurrentPath),
        }).result.hasOpenChecklist
      )
        add(
          "error",
          "quality-ready-with-open-checklist-result",
          relative(qualityCurrentPath),
          `${isQualityReady ? "Quality Ready" : "Quality Design Ready"} must not be declared while an applicable Quality Checklist still contains OPEN, FAIL, or an unchecked item.`,
        );
    }
  }

  const phaseSources = phaseAnalysisPaths.map((phasePath) => read(phasePath));
  const analysis = read(analysisPath);
  const phaseAnalyses = phaseSources.map(
    (content, index) =>
      parseQualityAnalysis({
        path: relative(phaseAnalysisPaths[index] as string),
        content,
      }).result,
  );
  const parsedIntegration = parseQualityIntegration({
    path: relative(analysisPath),
    content: analysis,
  });
  const integration = parsedIntegration.result;
  const mappingSections = phaseAnalyses.map((model) => model.coverage[0]?.text);
  if (mappingSections.some((section) => !section)) {
    add(
      "error",
      "quality-canonical-mapping-section-missing",
      relative(analysisRoot),
      "Every phase Quality analysis must expose its canonical sources in the '全件Coverage Index' section instead of satisfying coverage through IDs mentioned elsewhere.",
    );
    return;
  }
  const mappingSection = mappingSections.join("\n");

  const canonicalDefinitionSpecs = [
    ["01_Discovery", "REQ", "requirement.md"],
    ["02_UX", "UX", "ux_definition.md"],
    ["03_IA", "IA", "ia_definition.md"],
    ["04_UI", "UI", "ui_definition.md"],
    ["05_SPEC", "SPEC", "spec_definition.md"],
    ["06_Architecture", "ARCH", "architecture_definition.md"],
  ] as const;
  const canonicalIds = new Set<string>();
  for (const [
    phaseDirectory,
    prefix,
    definitionFile,
  ] of canonicalDefinitionSpecs) {
    const definitionsRoot = path.join(root, phaseDirectory, "Definitions");
    if (!lstatIfPresent(definitionsRoot)?.isDirectory()) continue;
    for (const entry of fs.readdirSync(definitionsRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(
          path.join(definitionsRoot, entry.name, definitionFile),
        )?.isFile()
      )
        canonicalIds.add(entry.name);
  }

  const inspectQualityAnalysisResult = inspectQualityAnalysis(
    phaseAnalyses,
    canonicalIds,
    integration,
    relative(analysisRoot),
  );
  const {
    summarySourceLevels,
    goalLabelToSlug,
    analysisSourceRelations,
    analysisSourceConditions,
    analysisSourceGoalLevels,
    analysisObligationKeys,
  } = inspectQualityAnalysisResult;
  for (const issue of inspectQualityAnalysisResult.issues) {
    const finding = mapQualityAnalysisIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const linkedDefinitionPaths = new Set(
    Array.from(
      mappingSection.matchAll(
        /\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
      ),
      (match) =>
        path.join(
          qualityRoot,
          "Definitions",
          match[1],
          "quality_definition.md",
        ),
    ),
  );
  if (linkedDefinitionPaths.size === 0)
    add(
      "error",
      "quality-definition-closure-missing",
      relative(analysisPath),
      "The Quality mapping must connect its verification obligations to meaningful verification definitions.",
    );
  for (const definitionPath of linkedDefinitionPaths) {
    if (!lstatIfPresent(definitionPath)?.isFile())
      add(
        "error",
        "quality-definition-missing",
        relative(definitionPath),
        "Every verification definition linked by the canonical Quality mapping must exist.",
      );
  }

  const definitionsRoot = path.join(qualityRoot, "Definitions");
  const physicalDefinitionPaths = new Set(
    lstatIfPresent(definitionsRoot)?.isDirectory()
      ? fs
          .readdirSync(definitionsRoot, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() &&
              /^QA-[0-9]{6}$/u.test(entry.name) &&
              lstatIfPresent(
                path.join(definitionsRoot, entry.name, "quality_definition.md"),
              )?.isFile(),
          )
          .map((entry) =>
            path.join(definitionsRoot, entry.name, "quality_definition.md"),
          )
      : [],
  );
  if (
    physicalDefinitionPaths.size !== linkedDefinitionPaths.size ||
    [...physicalDefinitionPaths].some(
      (definitionPath) => !linkedDefinitionPaths.has(definitionPath),
    ) ||
    [...linkedDefinitionPaths].some(
      (definitionPath) => !physicalDefinitionPaths.has(definitionPath),
    )
  )
    add(
      "error",
      "quality-definition-set-mismatch",
      relative(definitionsRoot),
      "The verification definitions on disk must exactly match the objective set linked from the canonical Quality mapping; orphan and unknown objectives are not allowed.",
    );

  for (const issue of inspectDocumentRelations({
    kind: "quality_architecture_models",
    integration,
    architectureRoot: path.join(root, "06_Architecture"),
    integrationDirectory: path.dirname(analysisPath),
    analysisPath: relative(analysisPath),
  })) {
    const finding = mapQualityAnalysisIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }

  for (const issue of inspectDocumentRelations({
    kind: "quality_goals",
    rows: inspectQualityAnalysisResult.crossModelRows,
    goalLabelToSlug,
    analysisPath: relative(analysisPath),
  })) {
    const finding = mapQualityAnalysisIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const detailSection = integration.details[0]?.text;
  const detailRoot = path.join(root, "06_Architecture", "Details");
  const physicalDetailPaths = new Set(
    lstatIfPresent(detailRoot)?.isDirectory()
      ? fs
          .readdirSync(detailRoot, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() &&
              lstatIfPresent(
                path.join(detailRoot, entry.name, "01_Architecture.md"),
              )?.isFile(),
          )
          .map((entry) =>
            path.join(detailRoot, entry.name, "01_Architecture.md"),
          )
      : [],
  );
  const linkedDetailPaths = new Set(
    Array.from(
      (detailSection ?? "").matchAll(
        /\]\((\.\.\/06_Architecture\/Details\/[a-z0-9-]+\/01_Architecture\.md)\)/gu,
      ),
      (match) => path.resolve(path.dirname(analysisPath), match[1]),
    ),
  );
  const detailCoverage = {
    ...integration.detailUnitData,
    issues: inspectDocumentRelations({
      kind: "quality_detail_coverage",
      integration: parsedIntegration,
      linkedDetailPaths: linkedDetailPaths,
      physicalDetailPaths: physicalDetailPaths,
      analysisPath: relative(analysisPath),
    }),
  };
  const {
    analysisDetailGoalRelations,
    analysisDetailUnitLocalRelations,
    analysisDetailUnits,
  } = detailCoverage;
  for (const issue of detailCoverage.issues) {
    const finding = mapQualityAnalysisIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const physicalDetailUnits = new Set<string>();
  const physicalDetailUnitLevels = new Map<string, ReadonlySet<string>>();
  const physicalDetailUnitBoundaryStages = new Map<string, string>();
  for (const detailPath of physicalDetailPaths) {
    const detailSlug = path.basename(path.dirname(detailPath));
    const model = parseArchitectureDetail(
      { path: relative(detailPath), content: read(detailPath) },
      detailSlug,
      {},
    ).result.qualityHandoff;
    for (const value of model.units) physicalDetailUnits.add(value);
    for (const [key, value] of model.levels)
      physicalDetailUnitLevels.set(key, value);
    for (const [key, value] of model.boundaryStages)
      physicalDetailUnitBoundaryStages.set(key, value);
  }
  if (
    physicalDetailUnits.size !== analysisDetailUnits.size ||
    [...physicalDetailUnits].some((unit) => !analysisDetailUnits.has(unit)) ||
    [...analysisDetailUnits].some((unit) => !physicalDetailUnits.has(unit))
  )
    add(
      "error",
      "quality-architecture-detail-unit-coverage-mismatch",
      relative(analysisPath),
      "The Quality integration matrix must process the exact verification-unit set handed off by every current Architecture detail area.",
    );

  const localItemOwners = new Map<string, string>();
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
  for (const definitionPath of physicalDefinitionPaths) {
    const definition = read(definitionPath);
    const qualityId = path.basename(path.dirname(definitionPath));
    const model = parseQualityDefinition(
      { path: relative(definitionPath), content: definition },
      qualityId,
    );
    for (const value of model.result.sourceRelations)
      definitionSourceRelations.add(value);
    for (const relation of model.result.sourceRelationEntries)
      definitionSourceRelationEntries.push(relation);
    for (const [key, value] of model.result.sourceConditions)
      definitionSourceConditions.set(key, value);
    for (const [key, value] of model.result.sourceGoalLevels)
      definitionSourceGoalLevels.set(key, new Set(value));
    for (const [key, value] of model.result.obligationKeys)
      definitionObligationKeys.set(key, value);
    for (const key of model.result.obligationKeyEntries)
      definitionObligationKeyEntries.push(key);
    for (const value of model.result.detailGoalRelations)
      definitionDetailGoalRelations.add(value);
    for (const relation of model.result.detailGoalRelationEntries)
      definitionDetailGoalRelationEntries.push(relation);
    for (const value of model.result.goalLocalRelations)
      definitionGoalLocalRelations.add(value);
    for (const relation of model.result.goalLocalRelationEntries)
      definitionGoalLocalRelationEntries.push(relation);
    for (const [key, value] of model.result.localItemLevels)
      localItemLevels.set(key, value);
    for (const [key, value] of model.result.localItemBoundaryStages)
      localItemBoundaryStages.set(key, value);
    for (const issue of model.issues.filter(
      (issue) => issue.kind !== "artifact.quality.checklist-invalid",
    )) {
      const finding = mapQualityDefinitionIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    const ownership = inspectQualityLocalItemOwnership(
      relative(definitionPath),
      model.result.localIds,
      localItemOwners,
    );
    for (const [localId, owner] of ownership.owners)
      localItemOwners.set(localId, owner);
    for (const issue of ownership.issues) {
      const finding = mapQualityDefinitionIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const inspectQualityDefinitionRelationsResult = inspectDocumentRelations({
    kind: "quality_definition_relations",
    ...{
      definitionSourceRelationEntries: definitionSourceRelationEntries,
      definitionSourceRelations: definitionSourceRelations,
      definitionGoalLocalRelationEntries: definitionGoalLocalRelationEntries,
      definitionGoalLocalRelations: definitionGoalLocalRelations,
      definitionDetailGoalRelationEntries: definitionDetailGoalRelationEntries,
      definitionDetailGoalRelations: definitionDetailGoalRelations,
      analysisDetailGoalRelations: analysisDetailGoalRelations,
      analysisSourceRelations: analysisSourceRelations,
      definitionObligationKeyEntries: definitionObligationKeyEntries,
      analysisObligationKeys: analysisObligationKeys,
      definitionObligationKeys: definitionObligationKeys,
      analysisSourceGoalLevels: analysisSourceGoalLevels,
      localItemLevels: localItemLevels,
      summarySourceLevels: summarySourceLevels,
      definitionSourceGoalLevels: definitionSourceGoalLevels,
      analysisSourceConditions: analysisSourceConditions,
      definitionSourceConditions: definitionSourceConditions,
      definitionsRoot: relative(definitionsRoot),
      analysisPath: relative(analysisPath),
    },
  });
  for (const issue of inspectQualityDefinitionRelationsResult) {
    const finding = mapQualityRelationsIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const localItemCoverage = {
    ...integration.localItemData,
    issues: inspectDocumentRelations({
      kind: "quality_local_item_relations",
      ...{
        integration: integration,
        localItemOwners: localItemOwners,
        analysisDetailUnitLocalRelations: analysisDetailUnitLocalRelations,
        physicalDetailUnits: physicalDetailUnits,
        physicalDetailUnitLevels: physicalDetailUnitLevels,
        physicalDetailUnitBoundaryStages: physicalDetailUnitBoundaryStages,
        localItemLevels: localItemLevels,
        localItemBoundaryStages: localItemBoundaryStages,
        analysisPath: relative(analysisPath),
      },
    }),
  };
  const { listedGoalLocalRelationEntries, listedGoalLocalRelations } =
    localItemCoverage;
  for (const issue of localItemCoverage.issues) {
    const finding = mapQualityRelationsIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  const declaredLocalItemCounts = [
    [qualityCenterPath, qualityCenter],
    [
      path.join(qualityRoot, "05_Current_Implementation_Reality_Audit.md"),
      lstatIfPresent(
        path.join(qualityRoot, "05_Current_Implementation_Reality_Audit.md"),
      )?.isFile()
        ? read(
            path.join(
              qualityRoot,
              "05_Current_Implementation_Reality_Audit.md",
            ),
          )
        : "",
    ],
  ] as const;
  for (const [declaringPath, declaringDocument] of declaredLocalItemCounts) {
    if (
      (declaringPath === qualityCenterPath
        ? parseQualityCenter({
            path: relative(declaringPath),
            content: declaringDocument,
          })
        : parseQualityRealityAudit({
            path: relative(declaringPath),
            content: declaringDocument,
          })
      ).result.localItemCount !== localItemOwners.size
    )
      add(
        "error",
        "quality-local-verification-item-count-mismatch",
        relative(declaringPath),
        "The declared Local Item count must exist in the canonical design-set table and equal the exact Local Item set owned by current Quality Definitions.",
      );
  }
  const inspectQualityGoalLocalRelationsResult = inspectDocumentRelations({
    kind: "quality_goal_local_relations",
    ...{
      listedGoalLocalRelationEntries: listedGoalLocalRelationEntries,
      listedGoalLocalRelations: listedGoalLocalRelations,
      definitionGoalLocalRelations: definitionGoalLocalRelations,
      analysisPath: relative(analysisPath),
    },
  });
  for (const issue of inspectQualityGoalLocalRelationsResult) {
    const finding = mapQualityRelationsIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  for (const sharedEvidencePath of [
    path.join(qualityRoot, "Evidence"),
    path.join(qualityRoot, "Verification_Results"),
  ])
    if (lstatIfPresent(sharedEvidencePath))
      add(
        "error",
        "quality-shared-evidence-box-forbidden",
        relative(sharedEvidencePath),
        "Quality must keep result ownership with the relevant verification definition or release/change evidence owner instead of recreating a shared catch-all Evidence box.",
      );
}
