/**
 * crdd-domain-library:unit:public-boundaryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility crdd-domain-library:unit:public-boundaryが所有する検証責務を実行する。
 * @trace RCM-UT-014
 * @trace RCM-UT-016
 * @level UT
 * @scope domain、artifact、relation、reality、repository、public-boundary
 * @boundary RCM-UT-014=N/A: Packageの公開`index.ts`と利用側importは外部実行境界を持たない。 / RCM-UT-016=N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as domainLibrary from "../../src/index.ts";

/**
 * 公開する固定検査集合が呼出し元から変更されないことを確認する。
 * @responsibility 移管前は私有だった検査条件をRoot公開によって可変にしない。
 * @trace RCM-UT-014
 * @precondition Domain Rootの実Moduleを使用する。
 * @stimulus 固定配列と辞書へのReflect書込みを試みる。
 * @observation 書込み拒否と元値の一致。
 * @oracle 配列要素・長さと辞書の検査条件が変わらない。
 * @cleanup N/A: 不変値への拒否だけを観測する。
 * @boundary Package Rootと未信頼のJavaScript利用側。
 */
test("公開する固定検査集合は利用側から変更できない", () => {
  for (const value of [
    domainLibrary.RUNTIME_REPAIR_ACTIONS,
    domainLibrary.RUNTIME_REPAIR_DIRECTORIES,
    domainLibrary.purposeResource,
  ]) {
    const before = JSON.stringify(value);
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Reflect.set(value, "unexpected", "changed"), false);
    if (Array.isArray(value)) {
      assert.equal(Reflect.set(value, "0", "changed"), false);
      assert.equal(Reflect.set(value, "length", 0), false);
    } else {
      assert.equal(Reflect.set(value, "create_provider", "changed"), false);
    }
    assert.equal(JSON.stringify(value), before);
  }
  for (const name of [
    "finalReasons",
    "INTEGRATION_RECORD_IDENTITY",
    "INTEGRATION_BINDING_IDENTITY",
    "repairReasons",
    "nullableId",
    "stringArray",
  ]) {
    assert.equal(Object.hasOwn(domainLibrary, name), false);
  }
});

/**
 * exportedNamesのTest準備責務を実行する。
 *
 * @responsibility exportedNamesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exportedNamesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
function exportedNames(relativePath: string): readonly string[] {
  const source = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath),
    "utf8",
  );
  const names = [
    ...[
      ...source.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s*from/gu),
    ].flatMap((match) =>
      (match[1] ?? "")
        .split(",")
        .map(
          (entry) =>
            entry
              .trim()
              .replace(/^type\s+/u, "")
              .split(/\s+as\s+/u)
              .at(-1) ?? "",
        )
        .filter((entry) => entry.length > 0),
    ),
    ...[
      ...source.matchAll(
        /export\s+(?:type|interface|const|function|class)\s+([A-Za-z][A-Za-z0-9]*)/gu,
      ),
    ].map((match) => match[1] ?? ""),
  ];
  return names.filter((name) => name.length > 0).sort();
}

/**
 * typescriptFilesのTest準備責務を実行する。
 *
 * @responsibility typescriptFilesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus typescriptFilesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
function typescriptFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...typescriptFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(target);
  }
  return files;
}

/**
 * Package Rootの実行時・型を含む明示exportとPackage入口が宣言済み集合だけであることを検証する。
 *
 * @responsibility 採用済みRoot公開集合の欠落・追加と廃止Subpathの再導入を拒否する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Package Rootの実行時exportを列挙する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Package Rootは宣言済みの公開集合だけを公開する", () => {
  assert.deepEqual(Object.keys(domainLibrary).sort(), [
    "COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT",
    "COORDINATOR_DURABLE_FOUNDATION_CONTRACT",
    "COORDINATOR_INTEGRATION_CONTRACT",
    "COORDINATOR_PROJECT_SNAPSHOT_SCHEMA",
    "COORDINATOR_STATE_CONTRACT",
    "COORDINATOR_STATE_SCHEMA",
    "CROS_DIRECTORY_ID",
    "CROS_TRUST_POLICY_SCHEMA",
    "EXTERNAL_SEND_POLICY_RELATIVE_PATH",
    "PROVIDER_ADVICE_OUTPUT_REASONS",
    "REPOSITORY_MANIFEST_RELATIVE_PATH",
    "REPOSITORY_MANIFEST_SCHEMA",
    "RUNTIME_REPAIR_ACTIONS",
    "RUNTIME_REPAIR_DIRECTORIES",
    "RUNTIME_STATE_MAXIMUM_BYTES",
    "RepositoryRuntimeDataAreaBlockedError",
    "SECRET_MATERIAL_POLICY_CONTRACT",
    "SECRET_MATERIAL_POLICY_CONTRACT_REVISION",
    "TESTS_RELATIVE_PATH",
    "aggregateRegressionStageResults",
    "applyMeetingOutcomeTreatment",
    "applyProjectOperationCandidateDecision",
    "applyTopicPromotion",
    "assertCoordinatorSnapshotTransition",
    "buildArtifactGraph",
    "buildRegressionStagePlan",
    "checkRepositoryRuntimeDataProtectionDirectory",
    "classifyCoordinatorRepairPublication",
    "classifyCoordinatorResourcePublication",
    "classifyRuntimeSnapshotReentry",
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "containsRecognizedSecretMaterial",
    "containsRecognizedSecretScope",
    "containsRecognizedSecretText",
    "coordinatorAdoptionWasRejected",
    "coordinatorAuthenticationClosureEvidence",
    "coordinatorAuthenticationUnknownCanClose",
    "coordinatorConsumerCompletionPolicy",
    "coordinatorHistoryLineBytes",
    "coordinatorOperationNonce",
    "coordinatorOperationSummaryBytes",
    "coordinatorQueueIsClosed",
    "coordinatorRejectedAdoptionEvidenceCanRetire",
    "coordinatorRepairCanComplete",
    "coordinatorRepairCanSummarize",
    "coordinatorRepairHistoryLineBytes",
    "coordinatorRepairRetentionMatchesCheckpoint",
    "coordinatorRepairSummaryBytes",
    "coordinatorSnapshotIntakeMatches",
    "coordinatorStandaloneAdoptionIsClosed",
    "coordinatorTaskResourcesAreSettled",
    "createCoordinatorRuntimeDataArea",
    "createDockerRestartRequestId",
    "createFilesystemRepositoryObservationPort",
    "createFilesystemSemanticBundlePublisher",
    "createFilesystemStoreRoot",
    "createMeetingOperations",
    "createPhaseChecklistItems",
    "createPortfolioProjection",
    "createRealitySymbolGraph",
    "createRuntimeStatePendingFile",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "createTemporaryOperation",
    "createTopicOperations",
    "decodeCoordinatorHistoryRows",
    "decodeDockerRestartCheckpoint",
    "decodeDockerRuntimeRepairCheckpoint",
    "decodeDockerRuntimeRepairDisposalCheckpoint",
    "decodeDockerRuntimeRepairRetentionTargets",
    "decodeProjectResultAcceptance",
    "decodeRuntimeDomainSnapshot",
    "describeSecretMaterialPolicyContract",
    "discoverRealitySymbols",
    "discoverRepositoryTestFiles",
    "dockerProcessControllerPublicCompletionReasons",
    "dockerRuntimeRepairCheckpointIsSettled",
    "dockerRuntimeRepairDisposalIsSettled",
    "encodeRuntimeStateValue",
    "ensureRepositoryRuntimeDataArea",
    "ensureRepositoryRuntimeDataAreaFromWorkingDirectory",
    "federateTopicMeetingRelations",
    "fixQualityCandidate",
    "flushRuntimeStateFile",
    "getJsonCommitName",
    "hasProjectTaskResultAcceptanceConflict",
    "hasQualityOpenChecklist",
    "hasRuntimeStateKeys",
    "hasRuntimeStateRecordKeys",
    "hasSkippedTestDeclaration",
    "hashRuntimeProjectDefinition",
    "hashRuntimeStateContent",
    "hashRuntimeStateValueText",
    "historyRow",
    "inspectArchitectureAnalysis",
    "inspectArchitectureAnalysisCoverage",
    "inspectArchitectureComponentCoverage",
    "inspectArchitectureCrossModel",
    "inspectArchitectureCrossModelIndex",
    "inspectArchitectureDefinition",
    "inspectArchitectureDetail",
    "inspectArchitectureDetailCoverage",
    "inspectArchitectureDetailMap",
    "inspectArchitectureDetailTemplate",
    "inspectArchitectureRegistryCoverage",
    "inspectArchitectureRelations",
    "inspectArtifactSources",
    "inspectBranchCoverageTable",
    "inspectCallerTaskInputs",
    "inspectCanonicalDocumentVersions",
    "inspectChangeDocument",
    "inspectChangelogRelease",
    "inspectCoordinatorQueueIntake",
    "inspectCrosTrustPolicy",
    "inspectDiscoveryAnalysis",
    "inspectDiscoveryDefinition",
    "inspectDiscoveryIdentityLinks",
    "inspectEvaluatedChecklist",
    "inspectExecutionPlan",
    "inspectExecutionSelection",
    "inspectIaAnalysis",
    "inspectIaAnalysisCoverage",
    "inspectIaCrossProjection",
    "inspectIaDefinition",
    "inspectIaIndexCoverage",
    "inspectIaRelations",
    "inspectPhaseDiagramTemplates",
    "inspectQualityAnalysis",
    "inspectQualityCenterState",
    "inspectQualityCrossModelGoals",
    "inspectQualityDefinition",
    "inspectQualityDefinitionRelations",
    "inspectQualityDesignStates",
    "inspectQualityDetailUnits",
    "inspectQualityGoalLocalRelations",
    "inspectQualityLocalItemOwnership",
    "inspectQualityLocalItemRelations",
    "inspectQualityRealityState",
    "inspectRealityTestCatalog",
    "inspectRelatedOrder",
    "inspectRemediationTable",
    "inspectRepositoryManifest",
    "inspectResourceIntensiveTestAuthority",
    "inspectSingleTaskRecord",
    "inspectSpecAnalysis",
    "inspectSpecAnalysisCoverage",
    "inspectSpecCorrespondence",
    "inspectSpecCorrespondencePairEvidence",
    "inspectSpecCoverage",
    "inspectSpecDefinition",
    "inspectSpecDefinitionCoverage",
    "inspectSpecDetailCorrespondence",
    "inspectSpecDetailDownstream",
    "inspectSpecDetailIndex",
    "inspectStableCanonicalDocuments",
    "inspectStableChangelog",
    "inspectStableIdentityDefinitions",
    "inspectStableIdentityOwnership",
    "inspectStableReadme",
    "inspectStableReleaseHeader",
    "inspectTaskExecutionSelections",
    "inspectTemplateChecklist",
    "inspectTestCatalog",
    "inspectUiAnalysis",
    "inspectUiAnalysisCoverage",
    "inspectUiDefinition",
    "inspectUiDetail",
    "inspectUiIndexCoverage",
    "inspectUiRelations",
    "inspectUiSpecRelations",
    "inspectUxAnalysis",
    "inspectUxDefinition",
    "inspectUxFormalInput",
    "inspectUxRelations",
    "integrateQualityGate",
    "isChangeNavigationInvalid",
    "isChangeTemplateInvalid",
    "isCoordinatorDecisionRecord",
    "isDockerRestartCheckpointSettled",
    "isMarkdownTableSeparator",
    "isProjectContextManifestIdentityInvalid",
    "isProjectContextProjectionInvalid",
    "isQualityAnalysisTemplateInvalid",
    "isQualityIntegrationTemplateInvalid",
    "isQualityLocalItemCountInvalid",
    "isQualityVerificationResultTemplateInvalid",
    "isRecognizedSecretBearingPath",
    "isRuntimeStateObject",
    "isSha256Hex",
    "isUxHandoffTargetSetExact",
    "isUxProjectionIncomplete",
    "isUxRootHandoffValid",
    "isWorkspaceCommitId",
    "leaseAcquisitionRecoveryId",
    "leaseIdentity",
    "loadTestCatalog",
    "normalizeCoordinatorTaskProjects",
    "normalizeExplicitChangedPaths",
    "normalizeRepositoryRelativePath",
    "observeFilesystemStoreLockOwnerAbsence",
    "observeRealitySymbolRepository",
    "observeRepositoryRuntimeDataArea",
    "omitMarkdownCommentsAndFencedCode",
    "omitMarkdownCommentsOutsideFencedCode",
    "omitMarkdownFencedCode",
    "parseAdoptedDiscoveryRequirements",
    "parseArchitectureRegistry",
    "parseCandidateVersionHeader",
    "parseCanonicalReleaseHeader",
    "parseChangeTraceHeader",
    "parseDockerTaskRecoveryId",
    "parseHostRecoveryToken",
    "parseIaIndex",
    "parseMarkdownAnchors",
    "parseMarkdownArtifact",
    "parseMarkdownFences",
    "parseMarkdownLinkReference",
    "parseMarkdownLinkTargets",
    "parseMarkdownTableRow",
    "parseMeetingMarkdown",
    "parseQualityCoverageSections",
    "parseQualityDetailHandoff",
    "parseReadmeVersion",
    "parseRepositoryProjectContextMarkdown",
    "parseRepositoryQualityProjectionMarkdown",
    "parseRepositoryReleaseProjectionMarkdown",
    "parseSpecCorrespondencePair",
    "parseSpecCorrespondenceRevision",
    "parseSpecDetailAreaOwnership",
    "parseSpecDetailCentralTrace",
    "parseSpecDetailDefinitionOwnership",
    "parseSpecIndex",
    "parseSpecScreenRelations",
    "parseStableIdentityOccurrences",
    "parseTopicMarkdown",
    "parseUiDetailBindings",
    "parseUiIndex",
    "parseUiSpecPairs",
    "parseUnambiguousJsonDocument",
    "parseUxFormalInputTargets",
    "parseUxIndex",
    "parseUxJourneyRelations",
    "phaseDiagramTemplatePaths",
    "prepareCoordinatorAcceptanceDecisionCreation",
    "prepareCoordinatorAcceptanceDecisionFinalization",
    "prepareCoordinatorAuthenticationUnknownClosureSnapshot",
    "prepareCoordinatorDecisionRecoveryCreation",
    "prepareCoordinatorDecisionRecoveryUpdate",
    "prepareCoordinatorHistoryRetention",
    "prepareCoordinatorIntegrationRecordCreation",
    "prepareCoordinatorQueueEntryCreation",
    "prepareCoordinatorQueueLeaseReleaseSettlement",
    "prepareCoordinatorQueueOperationUpdate",
    "prepareCoordinatorQueueRecoverySettlement",
    "prepareCoordinatorQueueSelection",
    "prepareCoordinatorRecoveredHistoryPublication",
    "prepareCoordinatorRepairHistoryLine",
    "prepareCoordinatorRepairHistoryPublication",
    "prepareCoordinatorRepairHistorySnapshot",
    "prepareCoordinatorRepairHistorySummary",
    "prepareCoordinatorSingleTaskQueueCreation",
    "prepareCoordinatorSingleTaskQueueUpdate",
    "prepareCoordinatorStateCleanupSnapshot",
    "prepareCoordinatorStateCompletionSnapshot",
    "prepareCoordinatorStateHistoryLine",
    "prepareCoordinatorStateHistorySnapshot",
    "prepareCoordinatorStateHostSnapshot",
    "prepareCoordinatorStateLifecycleSnapshot",
    "prepareCoordinatorStateOperationSnapshot",
    "prepareCoordinatorStateReferencesSnapshot",
    "prepareCoordinatorStateRepairCheckpointSnapshot",
    "prepareCoordinatorStateRepairCompletionSnapshot",
    "prepareCoordinatorStateRepairDisposalDecisionSnapshot",
    "prepareCoordinatorStateRepairDisposalProgressSnapshot",
    "prepareCoordinatorStateRepairRetentionHandoffSnapshot",
    "prepareCoordinatorStateRepairSessionSnapshot",
    "prepareCoordinatorStateRepairSnapshot",
    "prepareCoordinatorStateResourceSnapshot",
    "prepareCoordinatorStateRestartSnapshot",
    "prepareCoordinatorStateResultDeliverySnapshot",
    "prepareCoordinatorUnifiedTaskSections",
    "prepareCoordinatorUnifiedTaskSnapshot",
    "prepareCoordinatorUnstartedTaskQueueClosure",
    "prepareCoordinatorWorkspaceRecordUpdate",
    "prepareDockerRuntimeRepairSessionCheckpoint",
    "projectCoordinatorAcceptanceDecisionRecord",
    "projectCoordinatorCurrentState",
    "projectCoordinatorDecisionRecoveryRecord",
    "projectCoordinatorQueueEntry",
    "projectCoordinatorQueueProjectState",
    "projectCoordinatorTaskSettlement",
    "projectCoordinatorTaskSnapshot",
    "projectProjectOperationSources",
    "publishSemanticCoverage",
    "purposeResource",
    "readCanonicalDocumentHeader",
    "readCommittedJson",
    "readCoordinatorConfig",
    "readExecutionIntelligenceConfig",
    "readNetworkPolicy",
    "readRepositoryAiSelection",
    "readRepositoryProjectContext",
    "readRuntimeStateFile",
    "readStableBoundedFileSnapshot",
    "realitySymbolKinds",
    "recoverFilesystemStoreLock",
    "reenterQualityReview",
    "regressionStageOrder",
    "removeCommittedJson",
    "requireReadyRepositoryRuntimeDataArea",
    "resolveCrosRuntimeRoots",
    "resolveFilesystemStorePath",
    "resolveRepositoryRuntimeDataPaths",
    "resolveRepositoryRuntimeDataPathsFromWorkingDirectory",
    "resumeTemporaryOperation",
    "sameStableFileIdentity",
    "saveRepositoryAiSelection",
    "selectRegressionStaticOwners",
    "selectRegressionTests",
    "settleTemporaryOperation",
    "snapshotPlainArray",
    "snapshotPlainRecord",
    "snapshotRuntimeStateArray",
    "snapshotRuntimeStateRecord",
    "testLevels",
    "validCoordinatorAcceptanceDecisionRecord",
    "validCoordinatorDecisionRecoveryIntent",
    "validCoordinatorOutcome",
    "validCoordinatorPrimaryFailure",
    "validCoordinatorRepairOperation",
    "validCoordinatorRepairRetentionReceipt",
    "validCoordinatorRepairSummary",
    "validCoordinatorResultRecord",
    "validCoordinatorSnapshot",
    "validCoordinatorState",
    "validCoordinatorTaskState",
    "validCoordinatorWorkspace",
    "validId",
    "validLeaseEvidence",
    "validQueueEntry",
    "validResultReference",
    "validWorkspaceCandidateRequest",
    "validWorkspaceDisplayName",
    "validateAiSelectionConfig",
    "validateArtifactSchema",
    "validateCoordinatorStateRepairDisposalTransition",
    "validateCoordinatorStateRepairRetentionHandoffTransition",
    "validateCoordinatorStateRepairSessionTransition",
    "validateCoordinatorStateTransition",
    "validateCoordinatorUnifiedTransition",
    "validateDockerRuntimeRepairCheckpointTransition",
    "validateDomainOutcome",
    "validateHostRecoveryTransitionLineage",
    "validateRealitySymbolManifest",
    "validateTopicMeetingListInput",
    "verifyTemporaryOperationEvidencePromotion",
    "withFilesystemStoreLock",
    "writeCommittedJson",
  ]);
  assert.deepEqual(exportedNames("../../src/index.ts"), [
    "AiModelSelection",
    "AiProvider",
    "AiReasoningEffort",
    "AiSelectionCatalog",
    "AiSelectionChoice",
    "AiSelectionConfig",
    "AiSelectionConfigResult",
    "AiSelectionReadResult",
    "AiSelectionRole",
    "AiSelectionSaveResult",
    "AiSelectionSnapshot",
    "AiSelectionTemporaryReference",
    "ArchitectureAnalysisCoverageRequest",
    "ArchitectureBodyModel",
    "ArchitectureCrossModelIndex",
    "ArchitectureDetailCoverageRequest",
    "ArchitectureDetailMapModel",
    "ArchitectureDetailModel",
    "ArchitectureRegistryModel",
    "ArchitectureRelationsRequest",
    "ArtifactGraph",
    "ArtifactGraphResult",
    "ArtifactModel",
    "ArtifactRelation",
    "ArtifactSchema",
    "ArtifactSchemaValidationResult",
    "ArtifactSection",
    "ArtifactSource",
    "BuildArtifactGraphRequest",
    "COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT",
    "COORDINATOR_DURABLE_FOUNDATION_CONTRACT",
    "COORDINATOR_INTEGRATION_CONTRACT",
    "COORDINATOR_PROJECT_SNAPSHOT_SCHEMA",
    "COORDINATOR_STATE_CONTRACT",
    "COORDINATOR_STATE_SCHEMA",
    "CROS_DIRECTORY_ID",
    "CROS_TRUST_POLICY_SCHEMA",
    "CallerTaskInput",
    "ChecklistFailure",
    "ChecklistResult",
    "CoordinatorAcceptanceDecision",
    "CoordinatorAcceptanceDecisionEnvelope",
    "CoordinatorAcceptanceDecisionInput",
    "CoordinatorAcceptanceDecisionRecord",
    "CoordinatorAcceptanceTarget",
    "CoordinatorDecisionRecord",
    "CoordinatorDecisionRecoveryIntent",
    "CoordinatorLeaseKind",
    "CoordinatorObjectivePlan",
    "CoordinatorQueueEnqueueInput",
    "CoordinatorRepairRetentionReceipt",
    "CoordinatorResultRecord",
    "CoordinatorSnapshot",
    "CoordinatorSnapshotObservations",
    "CoordinatorState",
    "CoordinatorStateOperation",
    "CoordinatorStateRepairOperation",
    "CoordinatorStateSnapshot",
    "CoordinatorStateTaskOperation",
    "CoordinatorStoredTask",
    "CoordinatorTaskSettlementFact",
    "CoordinatorUnifiedSnapshot",
    "CoordinatorWorkspace",
    "CoordinatorWorkspaceCandidate",
    "CrosRootInput",
    "CrosTrustPolicy",
    "DockerRestartCheckpoint",
    "DockerRuntimeRepairCheckpoint",
    "DockerRuntimeRepairDisposalCheckpoint",
    "DockerRuntimeRepairRetentionTargets",
    "DomainIssue",
    "DomainLocation",
    "DomainOutcome",
    "DomainStatus",
    "EXTERNAL_SEND_POLICY_RELATIVE_PATH",
    "ExecutionPlanScope",
    "ExecutionSelection",
    "FederatedProjectProjection",
    "FederatedProjectSource",
    "FilesystemStoreLockOwnerAbsenceProof",
    "FilesystemStoreRoot",
    "FixedQualityCandidate",
    "HistoryRow",
    "IaAnalysisModel",
    "IaDefinitionModel",
    "IaIndexModel",
    "IntegratedQualityGate",
    "LeaseEvidenceContent",
    "LeaseEvidenceEnvelope",
    "LeaseKind",
    "LoadedRealitySymbolManifest",
    "MarkdownFence",
    "MarkdownFenceLine",
    "MarkdownLinkReference",
    "MeetingOperations",
    "MeetingOutcomeCommandResult",
    "MeetingOutcomeDisposition",
    "MeetingOutcomeTarget",
    "MeetingOutcomeTreatment",
    "MeetingRecord",
    "MeetingState",
    "NetworkPolicy",
    "NetworkPolicyReadResult",
    "PROVIDER_ADVICE_OUTPUT_REASONS",
    "PortfolioProjection",
    "ProjectContextSource",
    "ProjectDockerRecoveryAcknowledgement",
    "ProjectMilestoneRecord",
    "ProjectMilestoneState",
    "ProjectObjectiveDefinition",
    "ProjectObjectiveRecord",
    "ProjectObjectiveState",
    "ProjectOperationCandidate",
    "ProjectOperationCandidateDecision",
    "ProjectOperationCandidateDecisionResult",
    "ProjectOperationProjection",
    "ProjectOperationProjectionItem",
    "ProjectOperationRecord",
    "ProjectOperationRecordKind",
    "ProjectOperationSource",
    "ProjectOperationSourceState",
    "ProjectQueueEntry",
    "ProjectQueueState",
    "ProjectResultAcceptance",
    "ProjectTaskDefinition",
    "ProjectTaskRecord",
    "ProjectTaskRecoveryKind",
    "ProjectTaskRecoveryObligation",
    "ProjectTaskResultFact",
    "ProjectTaskStartPhase",
    "ProjectTaskState",
    "ProviderTurnCountDiagnostic",
    "PublishSemanticCoverageRequest",
    "PublishSemanticCoverageResult",
    "QualityCheckResult",
    "QualityCheckStatus",
    "QualityDefinitionModel",
    "QualityLocalItemOwnershipModel",
    "QualitySemanticRelation",
    "REPOSITORY_MANIFEST_RELATIVE_PATH",
    "REPOSITORY_MANIFEST_SCHEMA",
    "RUNTIME_REPAIR_ACTIONS",
    "RUNTIME_REPAIR_DIRECTORIES",
    "RUNTIME_STATE_MAXIMUM_BYTES",
    "RealityRepositoryObservationIssue",
    "RealitySymbol",
    "RealitySymbolDiscoveryRequest",
    "RealitySymbolDiscoveryResult",
    "RealitySymbolDiscoverySource",
    "RealitySymbolGraph",
    "RealitySymbolKind",
    "RealitySymbolManifest",
    "RealitySymbolNode",
    "RealitySymbolRepositoryObservation",
    "RegressionAggregateResult",
    "RegressionExecutionStep",
    "RegressionPlanEntry",
    "RegressionStage",
    "RegressionStagePlan",
    "RegressionStageResult",
    "RepositoryDirectoryEntry",
    "RepositoryDirectoryObservation",
    "RepositoryEntryKind",
    "RepositoryFileObservation",
    "RepositoryManifest",
    "RepositoryObservationPort",
    "RepositoryProjectContext",
    "RepositoryProjectContextReadResult",
    "RepositoryProjectContextScene",
    "RepositoryProjectContextSceneKey",
    "RepositoryProjectContextTable",
    "RepositoryQualityProjection",
    "RepositoryReleaseDependency",
    "RepositoryReleaseProjection",
    "RepositoryReleaseScope",
    "RepositoryRootCapability",
    "RepositoryRuntimeArea",
    "RepositoryRuntimeDataAreaBlockedError",
    "RepositoryRuntimeDataAreaObservation",
    "RepositoryWorktreeObservation",
    "RepositoryWorktreeResult",
    "ResourceIntensiveTestAuthority",
    "RuntimeDomainSnapshot",
    "RuntimeManagedExecution",
    "RuntimeProjectDefinition",
    "RuntimeStateEnvelope",
    "RuntimeStateFileName",
    "RuntimeStatePendingFileName",
    "SECRET_MATERIAL_POLICY_CONTRACT",
    "SECRET_MATERIAL_POLICY_CONTRACT_REVISION",
    "SemanticBundleContent",
    "SemanticBundlePublishReceipt",
    "SemanticBundlePublishRequest",
    "SemanticBundlePublisher",
    "SemanticCoverageBundle",
    "SemanticCoverageGraph",
    "SemanticCoverageProjection",
    "SemanticIr",
    "SemanticIrMeaning",
    "SemanticSourceDocument",
    "SingleTaskRecord",
    "SourceLocation",
    "SpecAnalysisModel",
    "SpecCorrespondencePair",
    "SpecDefinitionModel",
    "SpecDetailAreaOwnership",
    "SpecDetailCentralTrace",
    "SpecDetailDefinitionOwnership",
    "SpecDetailDownstreamRequest",
    "SpecIndexModel",
    "StableFileIdentity",
    "TESTS_RELATIVE_PATH",
    "TaskExecutionSelections",
    "TemporaryEvidencePromotionReceipt",
    "TemporaryOperationCapability",
    "TemporaryOperationRecoveryReference",
    "TestCatalog",
    "TestCatalogEntry",
    "TestLevel",
    "ToolRuntimeConfig",
    "ToolRuntimeConfigResult",
    "TopicMeetingAccess",
    "TopicMeetingDocument",
    "TopicMeetingListQuery",
    "TopicMeetingListResult",
    "TopicMeetingPage",
    "TopicMeetingRelation",
    "TopicMeetingRelationSource",
    "TopicMeetingRepository",
    "TopicMeetingWriteResult",
    "TopicOperations",
    "TopicPromotion",
    "TopicPromotionCommandResult",
    "TopicRecord",
    "TopicState",
    "UiIndexModel",
    "UiRelationsModel",
    "UxAnalysisModel",
    "UxFormalInputObservation",
    "UxFormalInputTarget",
    "UxIndexModel",
    "WorkspaceCandidateRequest",
    "WorkspaceCandidateResult",
    "WorkspaceCandidateSelection",
    "WorkspaceCandidateTemporary",
    "aggregateRegressionStageResults",
    "applyMeetingOutcomeTreatment",
    "applyProjectOperationCandidateDecision",
    "applyTopicPromotion",
    "assertCoordinatorSnapshotTransition",
    "buildArtifactGraph",
    "buildRegressionStagePlan",
    "checkRepositoryRuntimeDataProtectionDirectory",
    "classifyCoordinatorRepairPublication",
    "classifyCoordinatorResourcePublication",
    "classifyRuntimeSnapshotReentry",
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "containsRecognizedSecretMaterial",
    "containsRecognizedSecretScope",
    "containsRecognizedSecretText",
    "coordinatorAdoptionWasRejected",
    "coordinatorAuthenticationClosureEvidence",
    "coordinatorAuthenticationUnknownCanClose",
    "coordinatorConsumerCompletionPolicy",
    "coordinatorHistoryLineBytes",
    "coordinatorOperationNonce",
    "coordinatorOperationSummaryBytes",
    "coordinatorQueueIsClosed",
    "coordinatorRejectedAdoptionEvidenceCanRetire",
    "coordinatorRepairCanComplete",
    "coordinatorRepairCanSummarize",
    "coordinatorRepairHistoryLineBytes",
    "coordinatorRepairRetentionMatchesCheckpoint",
    "coordinatorRepairSummaryBytes",
    "coordinatorSnapshotIntakeMatches",
    "coordinatorStandaloneAdoptionIsClosed",
    "coordinatorTaskResourcesAreSettled",
    "createCoordinatorRuntimeDataArea",
    "createDockerRestartRequestId",
    "createFilesystemRepositoryObservationPort",
    "createFilesystemSemanticBundlePublisher",
    "createFilesystemStoreRoot",
    "createMeetingOperations",
    "createPhaseChecklistItems",
    "createPortfolioProjection",
    "createRealitySymbolGraph",
    "createRuntimeStatePendingFile",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "createTemporaryOperation",
    "createTopicOperations",
    "decodeCoordinatorHistoryRows",
    "decodeDockerRestartCheckpoint",
    "decodeDockerRuntimeRepairCheckpoint",
    "decodeDockerRuntimeRepairDisposalCheckpoint",
    "decodeDockerRuntimeRepairRetentionTargets",
    "decodeProjectResultAcceptance",
    "decodeRuntimeDomainSnapshot",
    "describeSecretMaterialPolicyContract",
    "discoverRealitySymbols",
    "discoverRepositoryTestFiles",
    "dockerProcessControllerPublicCompletionReasons",
    "dockerRuntimeRepairCheckpointIsSettled",
    "dockerRuntimeRepairDisposalIsSettled",
    "encodeRuntimeStateValue",
    "ensureRepositoryRuntimeDataArea",
    "ensureRepositoryRuntimeDataAreaFromWorkingDirectory",
    "federateTopicMeetingRelations",
    "fixQualityCandidate",
    "flushRuntimeStateFile",
    "getJsonCommitName",
    "hasProjectTaskResultAcceptanceConflict",
    "hasQualityOpenChecklist",
    "hasRuntimeStateKeys",
    "hasRuntimeStateRecordKeys",
    "hasSkippedTestDeclaration",
    "hashRuntimeProjectDefinition",
    "hashRuntimeStateContent",
    "hashRuntimeStateValueText",
    "historyRow",
    "inspectArchitectureAnalysis",
    "inspectArchitectureAnalysisCoverage",
    "inspectArchitectureComponentCoverage",
    "inspectArchitectureCrossModel",
    "inspectArchitectureCrossModelIndex",
    "inspectArchitectureDefinition",
    "inspectArchitectureDetail",
    "inspectArchitectureDetailCoverage",
    "inspectArchitectureDetailMap",
    "inspectArchitectureDetailTemplate",
    "inspectArchitectureRegistryCoverage",
    "inspectArchitectureRelations",
    "inspectArtifactSources",
    "inspectBranchCoverageTable",
    "inspectCallerTaskInputs",
    "inspectCanonicalDocumentVersions",
    "inspectChangeDocument",
    "inspectChangelogRelease",
    "inspectCoordinatorQueueIntake",
    "inspectCrosTrustPolicy",
    "inspectDiscoveryAnalysis",
    "inspectDiscoveryDefinition",
    "inspectDiscoveryIdentityLinks",
    "inspectEvaluatedChecklist",
    "inspectExecutionPlan",
    "inspectExecutionSelection",
    "inspectIaAnalysis",
    "inspectIaAnalysisCoverage",
    "inspectIaCrossProjection",
    "inspectIaDefinition",
    "inspectIaIndexCoverage",
    "inspectIaRelations",
    "inspectPhaseDiagramTemplates",
    "inspectQualityAnalysis",
    "inspectQualityCenterState",
    "inspectQualityCrossModelGoals",
    "inspectQualityDefinition",
    "inspectQualityDefinitionRelations",
    "inspectQualityDesignStates",
    "inspectQualityDetailUnits",
    "inspectQualityGoalLocalRelations",
    "inspectQualityLocalItemOwnership",
    "inspectQualityLocalItemRelations",
    "inspectQualityRealityState",
    "inspectRealityTestCatalog",
    "inspectRelatedOrder",
    "inspectRemediationTable",
    "inspectRepositoryManifest",
    "inspectResourceIntensiveTestAuthority",
    "inspectSingleTaskRecord",
    "inspectSpecAnalysis",
    "inspectSpecAnalysisCoverage",
    "inspectSpecCorrespondence",
    "inspectSpecCorrespondencePairEvidence",
    "inspectSpecCoverage",
    "inspectSpecDefinition",
    "inspectSpecDefinitionCoverage",
    "inspectSpecDetailCorrespondence",
    "inspectSpecDetailDownstream",
    "inspectSpecDetailIndex",
    "inspectStableCanonicalDocuments",
    "inspectStableChangelog",
    "inspectStableIdentityDefinitions",
    "inspectStableIdentityOwnership",
    "inspectStableReadme",
    "inspectStableReleaseHeader",
    "inspectTaskExecutionSelections",
    "inspectTemplateChecklist",
    "inspectTestCatalog",
    "inspectUiAnalysis",
    "inspectUiAnalysisCoverage",
    "inspectUiDefinition",
    "inspectUiDetail",
    "inspectUiIndexCoverage",
    "inspectUiRelations",
    "inspectUiSpecRelations",
    "inspectUxAnalysis",
    "inspectUxDefinition",
    "inspectUxFormalInput",
    "inspectUxRelations",
    "integrateQualityGate",
    "isChangeNavigationInvalid",
    "isChangeTemplateInvalid",
    "isCoordinatorDecisionRecord",
    "isDockerRestartCheckpointSettled",
    "isMarkdownTableSeparator",
    "isProjectContextManifestIdentityInvalid",
    "isProjectContextProjectionInvalid",
    "isQualityAnalysisTemplateInvalid",
    "isQualityIntegrationTemplateInvalid",
    "isQualityLocalItemCountInvalid",
    "isQualityVerificationResultTemplateInvalid",
    "isRecognizedSecretBearingPath",
    "isRuntimeStateObject",
    "isSha256Hex",
    "isUxHandoffTargetSetExact",
    "isUxProjectionIncomplete",
    "isUxRootHandoffValid",
    "isWorkspaceCommitId",
    "leaseAcquisitionRecoveryId",
    "leaseIdentity",
    "loadTestCatalog",
    "normalizeCoordinatorTaskProjects",
    "normalizeExplicitChangedPaths",
    "normalizeRepositoryRelativePath",
    "observeFilesystemStoreLockOwnerAbsence",
    "observeRealitySymbolRepository",
    "observeRepositoryRuntimeDataArea",
    "omitMarkdownCommentsAndFencedCode",
    "omitMarkdownCommentsOutsideFencedCode",
    "omitMarkdownFencedCode",
    "parseAdoptedDiscoveryRequirements",
    "parseArchitectureRegistry",
    "parseCandidateVersionHeader",
    "parseCanonicalReleaseHeader",
    "parseChangeTraceHeader",
    "parseDockerTaskRecoveryId",
    "parseHostRecoveryToken",
    "parseIaIndex",
    "parseMarkdownAnchors",
    "parseMarkdownArtifact",
    "parseMarkdownFences",
    "parseMarkdownLinkReference",
    "parseMarkdownLinkTargets",
    "parseMarkdownTableRow",
    "parseMeetingMarkdown",
    "parseQualityCoverageSections",
    "parseQualityDetailHandoff",
    "parseReadmeVersion",
    "parseRepositoryProjectContextMarkdown",
    "parseRepositoryQualityProjectionMarkdown",
    "parseRepositoryReleaseProjectionMarkdown",
    "parseSpecCorrespondencePair",
    "parseSpecCorrespondenceRevision",
    "parseSpecDetailAreaOwnership",
    "parseSpecDetailCentralTrace",
    "parseSpecDetailDefinitionOwnership",
    "parseSpecIndex",
    "parseSpecScreenRelations",
    "parseStableIdentityOccurrences",
    "parseTopicMarkdown",
    "parseUiDetailBindings",
    "parseUiIndex",
    "parseUiSpecPairs",
    "parseUnambiguousJsonDocument",
    "parseUxFormalInputTargets",
    "parseUxIndex",
    "parseUxJourneyRelations",
    "phaseDiagramTemplatePaths",
    "prepareCoordinatorAcceptanceDecisionCreation",
    "prepareCoordinatorAcceptanceDecisionFinalization",
    "prepareCoordinatorAuthenticationUnknownClosureSnapshot",
    "prepareCoordinatorDecisionRecoveryCreation",
    "prepareCoordinatorDecisionRecoveryUpdate",
    "prepareCoordinatorHistoryRetention",
    "prepareCoordinatorIntegrationRecordCreation",
    "prepareCoordinatorQueueEntryCreation",
    "prepareCoordinatorQueueLeaseReleaseSettlement",
    "prepareCoordinatorQueueOperationUpdate",
    "prepareCoordinatorQueueRecoverySettlement",
    "prepareCoordinatorQueueSelection",
    "prepareCoordinatorRecoveredHistoryPublication",
    "prepareCoordinatorRepairHistoryLine",
    "prepareCoordinatorRepairHistoryPublication",
    "prepareCoordinatorRepairHistorySnapshot",
    "prepareCoordinatorRepairHistorySummary",
    "prepareCoordinatorSingleTaskQueueCreation",
    "prepareCoordinatorSingleTaskQueueUpdate",
    "prepareCoordinatorStateCleanupSnapshot",
    "prepareCoordinatorStateCompletionSnapshot",
    "prepareCoordinatorStateHistoryLine",
    "prepareCoordinatorStateHistorySnapshot",
    "prepareCoordinatorStateHostSnapshot",
    "prepareCoordinatorStateLifecycleSnapshot",
    "prepareCoordinatorStateOperationSnapshot",
    "prepareCoordinatorStateReferencesSnapshot",
    "prepareCoordinatorStateRepairCheckpointSnapshot",
    "prepareCoordinatorStateRepairCompletionSnapshot",
    "prepareCoordinatorStateRepairDisposalDecisionSnapshot",
    "prepareCoordinatorStateRepairDisposalProgressSnapshot",
    "prepareCoordinatorStateRepairRetentionHandoffSnapshot",
    "prepareCoordinatorStateRepairSessionSnapshot",
    "prepareCoordinatorStateRepairSnapshot",
    "prepareCoordinatorStateResourceSnapshot",
    "prepareCoordinatorStateRestartSnapshot",
    "prepareCoordinatorStateResultDeliverySnapshot",
    "prepareCoordinatorUnifiedTaskSections",
    "prepareCoordinatorUnifiedTaskSnapshot",
    "prepareCoordinatorUnstartedTaskQueueClosure",
    "prepareCoordinatorWorkspaceRecordUpdate",
    "prepareDockerRuntimeRepairSessionCheckpoint",
    "projectCoordinatorAcceptanceDecisionRecord",
    "projectCoordinatorCurrentState",
    "projectCoordinatorDecisionRecoveryRecord",
    "projectCoordinatorQueueEntry",
    "projectCoordinatorQueueProjectState",
    "projectCoordinatorTaskSettlement",
    "projectCoordinatorTaskSnapshot",
    "projectProjectOperationSources",
    "publishSemanticCoverage",
    "purposeResource",
    "readCanonicalDocumentHeader",
    "readCommittedJson",
    "readCoordinatorConfig",
    "readExecutionIntelligenceConfig",
    "readNetworkPolicy",
    "readRepositoryAiSelection",
    "readRepositoryProjectContext",
    "readRuntimeStateFile",
    "readStableBoundedFileSnapshot",
    "realitySymbolKinds",
    "recoverFilesystemStoreLock",
    "reenterQualityReview",
    "regressionStageOrder",
    "removeCommittedJson",
    "requireReadyRepositoryRuntimeDataArea",
    "resolveCrosRuntimeRoots",
    "resolveFilesystemStorePath",
    "resolveRepositoryRuntimeDataPaths",
    "resolveRepositoryRuntimeDataPathsFromWorkingDirectory",
    "resumeTemporaryOperation",
    "sameStableFileIdentity",
    "saveRepositoryAiSelection",
    "selectRegressionStaticOwners",
    "selectRegressionTests",
    "settleTemporaryOperation",
    "snapshotPlainArray",
    "snapshotPlainRecord",
    "snapshotRuntimeStateArray",
    "snapshotRuntimeStateRecord",
    "testLevels",
    "validCoordinatorAcceptanceDecisionRecord",
    "validCoordinatorDecisionRecoveryIntent",
    "validCoordinatorOutcome",
    "validCoordinatorPrimaryFailure",
    "validCoordinatorRepairOperation",
    "validCoordinatorRepairRetentionReceipt",
    "validCoordinatorRepairSummary",
    "validCoordinatorResultRecord",
    "validCoordinatorSnapshot",
    "validCoordinatorState",
    "validCoordinatorTaskState",
    "validCoordinatorWorkspace",
    "validId",
    "validLeaseEvidence",
    "validQueueEntry",
    "validResultReference",
    "validWorkspaceCandidateRequest",
    "validWorkspaceDisplayName",
    "validateAiSelectionConfig",
    "validateArtifactSchema",
    "validateCoordinatorStateRepairDisposalTransition",
    "validateCoordinatorStateRepairRetentionHandoffTransition",
    "validateCoordinatorStateRepairSessionTransition",
    "validateCoordinatorStateTransition",
    "validateCoordinatorUnifiedTransition",
    "validateDockerRuntimeRepairCheckpointTransition",
    "validateDomainOutcome",
    "validateHostRecoveryTransitionLineage",
    "validateRealitySymbolManifest",
    "validateTopicMeetingListInput",
    "verifyTemporaryOperationEvidencePromotion",
    "withFilesystemStoreLock",
    "writeCommittedJson",
  ]);
  const metadata = JSON.parse(
    fs.readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../package.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(metadata.exports, {
    ".": "./src/index.ts",
    "./outcome": "./src/outcome.ts",
  });
});

/**
 * TopicとMeetingの宣言済み操作がRootから利用でき、内部解析操作が公開されないことを検証する。
 *
 * @responsibility 活動種別ごとの公開操作を維持し、共通Markdown内部解析の公開を拒否する。
 * @trace RCM-UT-014
 * @precondition Package Rootの公開入口を読み込む。
 * @stimulus 実行時exportを列挙し、各解析・更新操作の存在と禁止操作の不存在を照合する。
 * @observation Public ModuleのPropertyを観測する。
 * @oracle TopicとMeetingの宣言済み操作は利用でき、内部表解析はRootに公開されない。
 * @cleanup N/A: 不変なModule exportだけを観測する。
 * @boundary RCM-UT-014=N/A: 同一Processの公開集合を検査し、外部資源を操作しない。
 */
test("TopicとMeetingの公開操作をRootから利用し内部解析は公開しない", () => {
  assert.equal(typeof domainLibrary.parseTopicMarkdown, "function");
  assert.equal(typeof domainLibrary.applyTopicPromotion, "function");
  assert.equal(typeof domainLibrary.parseMeetingMarkdown, "function");
  assert.equal(typeof domainLibrary.applyMeetingOutcomeTreatment, "function");
  for (const name of ["tableRange", "readMetadata"])
    assert.equal(name in domainLibrary, false, name);
});

/**
 * srcのDirectoryはCapability-firstかつ二階層以内に保つを検証する。
 *
 * @responsibility srcのDirectoryはCapability-firstかつ二階層以内に保つの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus srcのDirectoryはCapability-firstかつ二階層以内に保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("srcのDirectoryはCapability-firstかつ二階層以内に保つ", () => {
  const sourceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../src",
  );
  const prohibitedNames = new Set(["common", "helpers", "internal", "utils"]);
  const violations: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const target = path.join(directory, entry.name);
      const relativePath = path
        .relative(sourceRoot, target)
        .replaceAll("\\", "/");
      const depth = relativePath.split("/").length;
      if (depth > 2 || prohibitedNames.has(entry.name))
        violations.push(relativePath);
      visit(target);
    }
  };
  visit(sourceRoot);
  assert.deepEqual(violations, []);
});

/**
 * Artifactの公開操作から解析・Schema検証・関係Graphを利用するを検証する。
 *
 * @responsibility Artifactの公開操作から解析・Schema検証・関係Graphを利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Artifactの公開操作から解析・Schema検証・関係Graphを利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Artifactの公開操作から解析・Schema検証・関係Graphを利用する", () => {
  const parsed = domainLibrary.parseMarkdownArtifact({
    path: "02_UX/Definitions/UX-000001/ux_definition.md",
    content: `# UX-000001 Sample

成果物種別: UX定義
UX ID: UX-000001
状態: Canonical
正式入力: REQ-000001

## Goal

[REQ-000001](../../../01_Discovery/Definitions/REQ-000001/requirement.md)

\`\`\`text
状態: Hidden
\`\`\`

<!-- 状態: Hidden -->

## Checklist

- [x] 意味を保持した
- OPEN: 人間確認待ち — 実利用を確認した
`,
  });
  assert.equal(parsed.canonicalId, "UX-000001");
  assert.deepEqual(parsed.formalInputs, ["REQ-000001"]);
  assert.equal(parsed.status, "Canonical");
  assert.deepEqual(
    parsed.checklist.map(({ result }) => result),
    ["passed", "open"],
  );

  const validation = domainLibrary.validateArtifactSchema(parsed, {
    id: "ux-definition",
    matches: () => true,
    requiredProperties: ["artifactType", "canonicalId", "status"],
    requiredSections: ["Missing"],
    allowedStatuses: ["Draft"],
  });
  assert.equal(validation.status, "invalid");
  assert.equal(validation.result, null);
  assert.deepEqual(validation.issues.map(({ kind }) => kind).sort(), [
    "artifact.schema.section-missing",
    "artifact.schema.status-invalid",
  ]);
  assert.equal(
    validation.issues.some(
      (issue) =>
        "code" in issue || "message" in issue || "summary" in issue.details,
    ),
    false,
  );
});

/**
 * RelationはArtifact Graphと中立Issueだけを公開するを検証する。
 *
 * @responsibility RelationはArtifact Graphと中立Issueだけを公開するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RelationはArtifact Graphと中立Issueだけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("RelationはArtifact Graphと中立Issueだけを公開する", () => {
  assert.deepEqual(
    exportedNames("../../src/index.ts").filter(
      (name) => name.includes("ArtifactGraph") || name === "buildArtifactGraph",
    ),
    [
      "ArtifactGraph",
      "ArtifactGraphResult",
      "BuildArtifactGraphRequest",
      "buildArtifactGraph",
    ],
  );
  const source = domainLibrary.parseMarkdownArtifact({
    path: "one.md",
    content: "# REQ-000001 One\n\n要求ID: REQ-000001\n",
  });
  const duplicate = domainLibrary.parseMarkdownArtifact({
    path: "two.md",
    content: "# REQ-000001 Two\n\n要求ID: REQ-000001\n",
  });
  const outcome = domainLibrary.buildArtifactGraph({
    artifacts: [source, duplicate],
  });
  assert.equal(outcome.status, "partial");
  assert.equal(outcome.result?.artifactsById.get("REQ-000001"), source);
  assert.deepEqual(outcome.issues, [
    {
      kind: "artifact.relation.canonical-id-duplicate",
      targetIdentity: "REQ-000001",
      location: { path: "two.md", line: 1 },
      reason: "canonical_identity_not_unique",
      details: { canonicalId: "REQ-000001" },
    },
  ]);
});

/**
 * Reality Traceabilityの宣言済み操作をRootから利用するを検証する。
 *
 * @responsibility Reality Traceabilityの宣言済み操作をRootから利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Traceabilityの宣言済み操作をRootから利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Reality Traceabilityの宣言済み操作をRootから利用する", () => {
  assert.equal(typeof domainLibrary.createRealitySymbolGraph, "function");
  assert.equal(typeof domainLibrary.discoverRealitySymbols, "function");
  assert.equal(typeof domainLibrary.validateRealitySymbolManifest, "function");
  assert.ok(Array.isArray(domainLibrary.realitySymbolKinds));
});

/**
 * Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成するを検証する。
 *
 * @responsibility Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成する", () => {
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "sample",
    symbols: [
      {
        symbolId: "sample.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const result = domainLibrary.discoverRealitySymbols({
    sources: [
      {
        subsystem: "sample",
        subsystemPath: "40_Develop/sample",
        manifestPath: "40_Develop/sample/symbol.json",
        manifestSource: JSON.stringify(manifest),
        symbolSources: new Map([["src/index.ts", "export {};\n"]]),
      },
    ],
    prerequisiteIssues: [],
  });
  assert.equal(result.status, "complete");
  assert.equal(result.result?.manifests[0]?.subsystemRoot, "40_Develop/sample");
});

/**
 * Reality Annotationは公開Discovery経由で検証しinternalを公開しないを検証する。
 *
 * @responsibility Reality Annotationは公開Discovery経由で検証しinternalを公開しないの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Annotationは公開Discovery経由で検証しinternalを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Reality Annotationは公開Discovery経由で検証しinternalを公開しない", () => {
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "sample",
    symbols: [
      {
        symbolId: "sample.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const result = domainLibrary.discoverRealitySymbols({
    sources: [
      {
        subsystem: "sample",
        subsystemPath: "40_Develop/sample",
        manifestPath: "40_Develop/sample/symbol.json",
        manifestSource: JSON.stringify(manifest),
        symbolSources: new Map([
          ["src/index.ts", "// @crdd QA-000001\n// @crdd ARCH-000009"],
        ]),
      },
    ],
    prerequisiteIssues: [],
  });
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues.map(({ kind }) => kind).sort(), [
    "annotation.architecture.relation-mismatch",
    "annotation.relation.domain-invalid",
  ]);
});

/**
 * 共通Outcomeは中立な処理結果契約だけを公開するを検証する。
 *
 * @responsibility 共通Outcomeは中立な処理結果契約だけを公開するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通Outcomeは中立な処理結果契約だけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("共通Outcomeは中立な処理結果契約だけを公開する", () => {
  assert.deepEqual(exportedNames("../../src/outcome.ts"), [
    "DomainIssue",
    "DomainLocation",
    "DomainOutcome",
    "DomainStatus",
    "validateDomainOutcome",
  ]);
});

/**
 * Domain Libraryの利用側は宣言済み公開indexだけを利用するを検証する。
 *
 * @responsibility Domain Libraryの利用側は宣言済み公開indexだけを利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Domain Libraryの利用側は宣言済み公開indexだけを利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Domain Libraryの利用側は宣言済み公開indexだけを利用する", () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const developRoot = path.join(repositoryRoot, "40_Develop");
  const consumers = [
    ...fs
      .readdirSync(developRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "domain-model")
      .map((entry) => path.join(developRoot, entry.name)),
    path.join(repositoryRoot, "template", "tools"),
  ];
  const violations: string[] = [];
  for (const consumerRoot of consumers)
    for (const file of typescriptFiles(consumerRoot)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /from\s+["']([^"']*domain-model\/src\/[^"']+)["']/gu,
      )) {
        const imported = match[1] ?? "";
        if (!imported.endsWith("/index.ts"))
          violations.push(
            `${path.relative(repositoryRoot, file).replaceAll("\\", "/")}: ${imported}`,
          );
      }
    }
  assert.deepEqual(violations, []);
});

/**
 * Reality Domain IssueはChecker語彙と絶対Pathを公開しないを検証する。
 *
 * @responsibility Reality Domain IssueはChecker語彙と絶対Pathを公開しないの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Domain IssueはChecker語彙と絶対Pathを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Reality Domain IssueはChecker語彙と絶対Pathを公開しない", () => {
  const invalidContract = domainLibrary.validateRealitySymbolManifest(
    {
      contract: "wrong",
      contractRevision: 1,
      subsystem: "fixture",
      symbols: [],
    },
    "40_Develop/fixture/symbol.json",
  );
  assert.equal(invalidContract.status, "invalid");
  assert.equal(
    invalidContract.issues.some(
      (issue) => issue.kind === "symbol-manifest-contract-invalid",
    ),
    false,
  );
  assert.equal(
    invalidContract.issues.some(
      (issue) =>
        issue.reason === "contract must be crdd/reality-symbol-manifest.",
    ),
    false,
  );
  assert.equal(
    invalidContract.issues.some(
      (issue) => "code" in issue || "message" in issue,
    ),
    false,
  );

  const absolutePath = "C:\\secret\\symbol.json";
  const invalidLocation = domainLibrary.validateRealitySymbolManifest(
    {},
    absolutePath,
  );
  assert.equal(invalidLocation.status, "invalid");
  assert.equal(JSON.stringify(invalidLocation).includes(absolutePath), false);
});

/**
 * Repository観測はRootの公開操作から不正Capabilityを拒否するを検証する。
 *
 * @responsibility Repository観測はRootの公開操作から不正Capabilityを拒否するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正Capabilityを渡し、不正容量上限との組合せでは上限拒否が先行することを確認する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: crdd-domain-library Test Source→対象契約
 */
test("Repository観測はRootの公開操作から不正Capabilityを拒否する", () => {
  const forgedCapability = {
    contract: "crdd-version-control/repository-location/v1",
  } as never;
  for (const maximumFileBytes of [
    0,
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () =>
        domainLibrary.createFilesystemRepositoryObservationPort(
          forgedCapability,
          maximumFileBytes,
        ),
      /^Error: repository_file_limit_invalid$/,
    );
  }
  assert.equal(
    domainLibrary
      .createFilesystemRepositoryObservationPort(forgedCapability)
      .observeDirectory("40_Develop").status,
    "unobservable",
  );
  const repositoryEntrySource = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/repository/create-observer.ts",
    ),
    "utf8",
  );
  assert.match(
    repositoryEntrySource,
    /from "\.\.\/\.\.\/\.\.\/version-control\/src\/index\.ts"/u,
  );
  assert.doesNotMatch(
    repositoryEntrySource,
    /version-control\/src\/(?!index\.ts)/u,
  );
});
