/**
 * discovery-ux成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */

import fs from "node:fs";
import path from "node:path";
import type { UxAnalysisModel } from "../../../document-model/src/index.ts";
import {
  inspectUxConsistency,
  parseDiscoveryAnalysis,
  parseDiscoveryDefinition,
  parseDiscoveryIndex,
  parseUxAnalysis,
  parseUxDefinition,
  parseUxExperienceMap,
  parseUxIndex,
  parseUxPersonas,
  parseUxQualityExpectations,
  parseUxServiceBlueprint,
} from "../../../document-model/src/index.ts";
import {
  mapDiscoveryDomainIssueToFinding,
  mapUxDomainIssueToFinding,
} from "../report/convert.ts";
import type { DocumentFinding } from "../report/types.ts";
import { lstatIfPresent, samePath } from "../repository/observe.ts";
import type { LocalLinkResolution } from "../repository/types.ts";
import type { createDocumentReferenceReader } from "./references.ts";

/**
 * discovery-ux成果物を観測し、本文・関係の意味をDomainへ渡す。
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
export function inspectDiscoveryUxRepository(
  root: string,
  repositoryMode: string,
  findings: DocumentFinding[],
  resolveLocalTarget: ReturnType<
    typeof createDocumentReferenceReader
  >["resolveLocalTarget"],
): void {
  const add = (severity: string, code: string, file: string, message: string) =>
    findings.push({ severity, code, path: file, message });
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const read = (file: string) => fs.readFileSync(file, "utf8");

  if (repositoryMode !== "official") return;
  const discoveryPath = path.join(
    root,
    "01_Discovery",
    "01_Product_Discovery.md",
  );
  const uxIndexPath = path.join(root, "02_UX", "01_User_Experience.md");
  const discoveryDefinitionsRoot = path.join(
    root,
    "01_Discovery",
    "Definitions",
  );
  const discoveryAnalysisRoot = path.join(root, "01_Discovery", "Analysis");
  const requirementsRoot = path.join(root, "02_UX", "Analysis");
  const uxDefinitionsRoot = path.join(root, "02_UX", "Definitions");
  const experienceMapPath = path.join(root, "02_UX", "03_Experience_Map.md");
  if (
    !lstatIfPresent(discoveryPath)?.isFile() ||
    !lstatIfPresent(uxIndexPath)?.isFile()
  )
    return;
  if (!lstatIfPresent(requirementsRoot)?.isDirectory()) {
    add(
      "error",
      "ux-requirement-analysis-root-missing",
      relative(requirementsRoot),
      "The official UX profile must retain the requirement-analysis root.",
    );
    return;
  }
  const discoveryRoot = parseDiscoveryIndex({
    path: relative(discoveryPath),
    content: read(discoveryPath),
  });
  for (const issue of discoveryRoot.issues) {
    const finding = mapDiscoveryDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
  if (lstatIfPresent(discoveryAnalysisRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(discoveryAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^EXP-[0-9]{6}$/u.test(entry.name)) continue;
      const analysisPath = path.join(
        discoveryAnalysisRoot,
        entry.name,
        "exploration.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      const analysis = read(analysisPath);
      for (const issue of parseDiscoveryAnalysis(
        { path: relative(analysisPath), content: analysis },
        entry.name,
      ).issues) {
        const finding = mapDiscoveryDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  for (const [discoveryTemplatePath, kind] of [
    [
      path.join(root, "template", "01_Discovery", "01_Product_Discovery.md"),
      "index",
    ],
    [
      path.join(
        root,
        "template",
        "01_Discovery",
        "Analysis",
        "EXP-XXXXXX",
        "exploration.md",
      ),
      "analysis",
    ],
    [
      path.join(
        root,
        "template",
        "01_Discovery",
        "Definitions",
        "REQ-XXXXXX",
        "requirement.md",
      ),
      "definition",
    ],
  ] as const) {
    if (!lstatIfPresent(discoveryTemplatePath)?.isFile()) continue;
    const source = {
      path: relative(discoveryTemplatePath),
      content: read(discoveryTemplatePath),
    };
    const parsed =
      kind === "index"
        ? parseDiscoveryIndex(source, { mode: "template" })
        : kind === "analysis"
          ? parseDiscoveryAnalysis(source, "EXP-XXXXXX", { mode: "template" })
          : parseDiscoveryDefinition(source, "REQ-XXXXXX", {
              mode: "template",
            });
    for (const issue of parsed.issues) {
      const finding = mapDiscoveryDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  for (const [uxArtifactPath, kind] of [
    [uxIndexPath, "index"],
    [path.join(root, "02_UX", "02_Personas.md"), "personas"],
    [experienceMapPath, "experience_map"],
    [path.join(root, "02_UX", "04_Service_Blueprint.md"), "service_blueprint"],
    [
      path.join(root, "02_UX", "05_Quality_Expectations.md"),
      "quality_expectations",
    ],
  ] as const) {
    if (!lstatIfPresent(uxArtifactPath)?.isFile()) {
      add(
        "error",
        "ux-canonical-projection-missing",
        relative(uxArtifactPath),
        "The official UX profile must retain all five canonical projection artifacts.",
      );
      continue;
    }
    const source = {
      path: relative(uxArtifactPath),
      content: read(uxArtifactPath),
    };
    const parsed =
      kind === "index"
        ? parseUxIndex(source, { mode: "evaluated" })
        : kind === "personas"
          ? parseUxPersonas(source, { mode: "evaluated" })
          : kind === "experience_map"
            ? parseUxExperienceMap(source, { mode: "evaluated" })
            : kind === "service_blueprint"
              ? parseUxServiceBlueprint(source, { mode: "evaluated" })
              : parseUxQualityExpectations(source, { mode: "evaluated" });
    const checklistError = parsed.result.checklistContract.failure;
    if (checklistError)
      add(
        "error",
        "ux-checklist-contract-invalid",
        relative(uxArtifactPath),
        `Each canonical UX projection must contain one visible, fully evaluated artifact-specific Checklist (${checklistError}).`,
      );
  }
  for (const [uxTemplatePath, kind] of [
    [path.join(root, "template", "02_UX", "01_User_Experience.md"), "index"],
    [path.join(root, "template", "02_UX", "02_Personas.md"), "personas"],
    [
      path.join(root, "template", "02_UX", "03_Experience_Map.md"),
      "experience_map",
    ],
    [
      path.join(root, "template", "02_UX", "04_Service_Blueprint.md"),
      "service_blueprint",
    ],
    [
      path.join(root, "template", "02_UX", "05_Quality_Expectations.md"),
      "quality_expectations",
    ],
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Analysis",
        "REQ-XXXXXX",
        "ux_analysis.md",
      ),
      "analysis",
    ],
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Definitions",
        "UX-XXXXXX",
        "ux_definition.md",
      ),
      "definition",
    ],
  ] as const) {
    if (!lstatIfPresent(uxTemplatePath)?.isFile()) {
      add(
        "error",
        "ux-template-missing",
        relative(uxTemplatePath),
        "The official distribution must retain all seven UX templates.",
      );
      continue;
    }
    const source = {
      path: relative(uxTemplatePath),
      content: read(uxTemplatePath),
    };
    const parsed =
      kind === "index"
        ? parseUxIndex(source, { mode: "template" })
        : kind === "personas"
          ? parseUxPersonas(source, { mode: "template" })
          : kind === "experience_map"
            ? parseUxExperienceMap(source, { mode: "template" })
            : kind === "service_blueprint"
              ? parseUxServiceBlueprint(source, { mode: "template" })
              : kind === "quality_expectations"
                ? parseUxQualityExpectations(source, { mode: "template" })
                : kind === "analysis"
                  ? parseUxAnalysis(source, "REQ-XXXXXX", { mode: "template" })
                  : parseUxDefinition(source, "UX-XXXXXX", {
                      mode: "template",
                    });
    const checklistError = parsed.result.checklistContract.failure;
    if (checklistError)
      add(
        "error",
        "ux-checklist-template-invalid",
        relative(uxTemplatePath),
        `Each UX template must expose one visible artifact-specific Checklist with unevaluated items and result guidance (${checklistError}).`,
      );
  }
  for (const [uxTemplatePath, heading] of [
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Analysis",
        "REQ-XXXXXX",
        "ux_analysis.md",
      ),
      "## 6. 下流への引き渡し",
    ],
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Definitions",
        "UX-XXXXXX",
        "ux_definition.md",
      ),
      "## 下流への引き渡し",
    ],
  ] as const) {
    if (
      lstatIfPresent(uxTemplatePath)?.isFile() &&
      !(
        heading === "## 6. 下流への引き渡し"
          ? parseUxAnalysis(
              { path: relative(uxTemplatePath), content: read(uxTemplatePath) },
              "REQ-XXXXXX",
              { mode: "template" },
            )
          : parseUxDefinition(
              { path: relative(uxTemplatePath), content: read(uxTemplatePath) },
              "UX-XXXXXX",
              { mode: "template" },
            )
      ).result.handoffContract.valid
    )
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(uxTemplatePath),
        "UX handoff templates must contain exactly IA, Quality Analysis / UX, UI, and SPEC with their formal boundary labels; no direct Architecture or Verification target is allowed.",
      );
  }
  const templatePath = path.join(
    root,
    "template",
    "02_UX",
    "Analysis",
    "REQ-XXXXXX",
    "ux_analysis.md",
  );
  if (!lstatIfPresent(templatePath)?.isFile())
    add(
      "error",
      "ux-requirement-analysis-template-missing",
      relative(templatePath),
      "The official distribution must include the UX requirement-analysis template.",
    );
  const adoptedRequirements = parseDiscoveryIndex({
    path: relative(discoveryPath),
    content: read(discoveryPath),
  }).result.adoptedRequirementIds;
  const actualRequirements = new Set<string>();
  const uxIndex = read(uxIndexPath);
  const uxIndexModel = parseUxIndex({
    path: relative(uxIndexPath),
    content: uxIndex,
  }).result;
  const canonicalUxIds = uxIndexModel.ids;
  for (const [projectionPath, parseProjection] of [
    [path.join(root, "02_UX", "02_Personas.md"), parseUxPersonas],
    [experienceMapPath, parseUxExperienceMap],
    [
      path.join(root, "02_UX", "04_Service_Blueprint.md"),
      parseUxServiceBlueprint,
    ],
    [
      path.join(root, "02_UX", "05_Quality_Expectations.md"),
      parseUxQualityExpectations,
    ],
  ] as const) {
    if (!lstatIfPresent(projectionPath)?.isFile()) continue;
    for (const issue of inspectUxConsistency({
      kind: "ux_projection",
      projection: parseProjection({
        path: relative(projectionPath),
        content: read(projectionPath),
      }).result.projection,
      canonicalIds: canonicalUxIds,
    })) {
      const finding = mapUxDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  for (const [artifactPath, artifactKind] of [
    [uxIndexPath, "index"],
    [path.join(root, "02_UX", "05_Quality_Expectations.md"), "quality"],
    [path.join(root, "template", "02_UX", "01_User_Experience.md"), "template"],
  ] as const) {
    if (!lstatIfPresent(artifactPath)?.isFile()) continue;
    const source = {
      path: relative(artifactPath),
      content: read(artifactPath),
    };
    const model =
      artifactKind === "quality"
        ? parseUxQualityExpectations(source).result
        : parseUxIndex(source, {
            mode: artifactKind === "template" ? "template" : "evaluated",
          }).result;
    if (model.forbiddenDownstream)
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(artifactPath),
        "UX must hand off formally to IA, accompany Quality Analysis / UX, and leave UI/SPEC as post-IA contract relations; it must not hand off directly to Architecture or Verification.",
      );
  }
  for (const [artifactPath, heading] of [
    [uxIndexPath, "## 4. 現在状態と次工程への引き渡し"],
    [
      path.join(root, "template", "02_UX", "01_User_Experience.md"),
      "## 6. 現在状態と次工程への引き渡し",
    ],
  ] as const) {
    if (
      lstatIfPresent(artifactPath)?.isFile() &&
      !parseUxIndex(
        { path: relative(artifactPath), content: read(artifactPath) },
        {
          mode:
            heading === "## 6. 現在状態と次工程への引き渡し"
              ? "template"
              : "evaluated",
        },
      ).result.handoffContract.valid
    )
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(artifactPath),
        "The UX entry must expose IA as its only immediate phase handoff, Quality Analysis / UX as its accompanying analysis, and UI/SPEC as post-IA contract relations without a direct Architecture or Verification target.",
      );
  }
  const uxAnalyses: UxAnalysisModel[] = [];
  const experienceMap = lstatIfPresent(experienceMapPath)?.isFile()
    ? parseUxExperienceMap({
        path: relative(experienceMapPath),
        content: read(experienceMapPath),
      }).result
    : null;
  for (const entry of fs.readdirSync(requirementsRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() || !/^REQ-[0-9]{6}$/u.test(entry.name)) continue;
    const analysisPath = path.join(
      requirementsRoot,
      entry.name,
      "ux_analysis.md",
    );
    if (!lstatIfPresent(analysisPath)?.isFile()) continue;
    actualRequirements.add(entry.name);
    const analysis = read(analysisPath);
    const discoveryDefinitionPath = path.join(
      discoveryDefinitionsRoot,
      entry.name,
      "requirement.md",
    );
    const definition = lstatIfPresent(discoveryDefinitionPath)?.isFile()
      ? read(discoveryDefinitionPath)
      : "";
    const model = parseUxAnalysis(
      { path: relative(analysisPath), content: analysis },
      entry.name,
      { referenceRoot: root },
    );
    const formalInputTargets = model.result.formalInputTargets;
    const analysisTargets = formalInputTargets
      .map(({ target }) => resolveLocalTarget(analysisPath, target))
      .filter(
        (resolved): resolved is LocalLinkResolution => !resolved.external,
      );
    const discoveryDefinitionLinks = analysisTargets.filter((resolved) =>
      /^01_Discovery\/Definitions\/REQ-[0-9]{6}\/requirement\.md$/u.test(
        relative(resolved.target).replaceAll("\\", "/"),
      ),
    );
    const sourceAnalysisLinks = analysisTargets.filter((resolved) =>
      /^01_Discovery\/Analysis\/EXP-[0-9]{6}\/exploration\.md$/u.test(
        relative(resolved.target).replaceAll("\\", "/"),
      ),
    );
    const invalidDiscoveryInputLinks = analysisTargets.filter((resolved) => {
      const normalized = relative(resolved.target).replaceAll("\\", "/");
      return (
        /(?:^|\/)01_Discovery\/(?:Analysis|Definitions)\//u.test(
          resolved.targetText.replaceAll("\\", "/"),
        ) &&
        !/^01_Discovery\/(?:Analysis\/EXP-[0-9]{6}\/exploration\.md|Definitions\/REQ-[0-9]{6}\/requirement\.md)$/u.test(
          normalized,
        )
      );
    });
    for (const issue of inspectUxConsistency({
      kind: "ux_formal_input",
      analysis: model.result,
      observation: {
        definitionHasContent: Boolean(definition),
        matchingDefinitionOnly:
          discoveryDefinitionLinks.length === 1 &&
          samePath(
            discoveryDefinitionLinks[0]?.target ?? "",
            discoveryDefinitionPath,
          ),
        hasSourceAnalysis: sourceAnalysisLinks.length > 0,
        hasInvalidDiscoveryTarget: invalidDiscoveryInputLinks.length > 0,
        hasInvalidEntity: formalInputTargets.some(
          (target) => target.invalidEntity,
        ),
        hasUnsafeTarget: analysisTargets.some(
          (resolved) =>
            resolved.decodeError ||
            resolved.outsideRoot ||
            resolved.symbolicBoundary,
        ),
      },
    })) {
      const finding = mapUxDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    for (const issue of inspectUxConsistency({
      kind: "ux_analysis_registration",
      analysis: model,
      index: uxIndexModel,
    })) {
      const finding = mapUxDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    uxAnalyses.push(model.result);
  }
  if (
    adoptedRequirements.size !== actualRequirements.size ||
    [...adoptedRequirements].some((id) => !actualRequirements.has(id))
  )
    add(
      "error",
      "ux-requirement-analysis-coverage-mismatch",
      relative(uxIndexPath),
      "Every adopted Discovery requirement must have exactly one UX requirement-analysis directory, regardless of its primary related domains.",
    );
  const discoveryDefinitionIds = new Set<string>();
  if (lstatIfPresent(discoveryDefinitionsRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(discoveryDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^REQ-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        discoveryDefinitionsRoot,
        entry.name,
        "requirement.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      discoveryDefinitionIds.add(entry.name);
      const definition = read(definitionPath);
      for (const issue of parseDiscoveryDefinition(
        { path: relative(definitionPath), content: definition },
        entry.name,
      ).issues) {
        const finding = mapDiscoveryDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  if (
    adoptedRequirements.size !== discoveryDefinitionIds.size ||
    [...adoptedRequirements].some((id) => !discoveryDefinitionIds.has(id))
  )
    add(
      "error",
      "discovery-requirement-definition-coverage-mismatch",
      relative(discoveryPath),
      "Every adopted Discovery requirement must have exactly one canonical requirement definition.",
    );
  const uxDefinitionIds = new Set<string>();
  if (lstatIfPresent(uxDefinitionsRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(uxDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UX-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        uxDefinitionsRoot,
        entry.name,
        "ux_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      uxDefinitionIds.add(entry.name);
      const definition = read(definitionPath);
      for (const issue of parseUxDefinition(
        { path: relative(definitionPath), content: definition },
        entry.name,
      ).issues) {
        const finding = mapUxDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }
  if (
    canonicalUxIds.size !== uxDefinitionIds.size ||
    [...canonicalUxIds].some((id) => !uxDefinitionIds.has(id))
  )
    add(
      "error",
      "ux-definition-coverage-mismatch",
      relative(uxIndexPath),
      "Every canonical UX outcome must have exactly one UX definition.",
    );
  const legacyRoots = [
    path.join(root, "01_Discovery", "Explorations"),
    path.join(root, "02_UX", "Requirements"),
    path.join(root, "template", "01_Discovery", "Evidence"),
    path.join(root, "template", "02_UX", "Evidence"),
  ];
  for (const legacyRoot of legacyRoots)
    if (lstatIfPresent(legacyRoot))
      add(
        "error",
        "phase-repository-legacy-root-present",
        relative(legacyRoot),
        "The current phase repository pattern must not retain a legacy or empty common root.",
      );
  for (const issue of inspectUxConsistency({
    kind: "ux_relations",
    ...{
      uxIndexPath: relative(uxIndexPath),
      experienceMapPath: relative(experienceMapPath),
      index: uxIndexModel,
      analyses: uxAnalyses,
      experienceMap,
    },
  })) {
    const finding = mapUxDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}
