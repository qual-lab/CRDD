# CHG-000070 Work LifecycleとEvidence所有の再編

変更ID: `CHG-000070`
状態: `Ready for Release Handoff`
決定権限: Qual-Lab
基準版: v0.20.1

## 1. 変更の目的

起点Discovery: [EXP-000018](../../../01_Discovery/Analysis/EXP-000018/exploration.md)／`REQ-000033`

Roadmap、Change、ReleaseおよびEvidenceの配置を、ファイル種別ではなく「何の作業状態を示し、何の成立を証明するか」で再編する。人間が使う`Roadmap`というNavigation Anchorは維持し、個別Evidenceを`07_Quality`へ集約する構造は廃止する。

## 2. 現在状態と問題

| 対象 | 現在状態 | 問題 |
|---|---|---|
| Roadmap | `99_Roadmap/01_Roadmap.md` | Product以外の標準、Runtime、CROS、Tool、研究を含み、名称が所有範囲より狭い |
| Change | `90_Release/Changes`にCHG本文と共通Evidence置場がある | Changeと直接Evidenceの探索経路が分かれる |
| Release | `90_Release`がChange置場を兼ねる | ChangeとReleaseが別Entityである一方、Work Lifecycle上の接続が見えにくい |
| Verification Result | `07_Quality/Verification_Results`とChange Evidenceへ分散 | EvidenceのOwnerが「Quality成果物か」で決まり、証明対象から離れる |
| Quality Center | 個別Evidenceを横断参照する | 現在品質の投影とEvidence倉庫の責務が混在する |
| CHGの影響範囲 | 変更意図と主要参照は読めるが、当該CHGで変更した全Pathを即時に取得できない | 構造変更を表で示し、その直後に全影響ファイルを折り畳み可能な一覧として置く |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Discovery/01_Product_Discovery.md`](<../../../01_Discovery/01_Product_Discovery.md>)
- [`01_Discovery/02_Product_Candidates.md`](<../../../01_Discovery/02_Product_Candidates.md>)
- `01_Discovery/02_Runtime_and_CROS_Product_Candidates.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000001/exploration.md`](<../../../01_Discovery/Analysis/EXP-000001/exploration.md>)
- [`01_Discovery/Analysis/EXP-000002/exploration.md`](<../../../01_Discovery/Analysis/EXP-000002/exploration.md>)
- `01_Discovery/Explorations/EXP-000002_Coordinated_AI_Execution/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000003/exploration.md`](<../../../01_Discovery/Analysis/EXP-000003/exploration.md>)
- `01_Discovery/Explorations/EXP-000003_Project_Runtime/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000004/exploration.md`](<../../../01_Discovery/Analysis/EXP-000004/exploration.md>)
- `01_Discovery/Explorations/EXP-000004_Execution_Intelligence/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000005/exploration.md`](<../../../01_Discovery/Analysis/EXP-000005/exploration.md>)
- `01_Discovery/Explorations/EXP-000005_Runtime_Responsibility_Separation/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000006/exploration.md`](<../../../01_Discovery/Analysis/EXP-000006/exploration.md>)
- `01_Discovery/Explorations/EXP-000006_Local_MCP_HTTP_Access/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000007/exploration.md`](<../../../01_Discovery/Analysis/EXP-000007/exploration.md>)
- [`01_Discovery/Analysis/EXP-000008/exploration.md`](<../../../01_Discovery/Analysis/EXP-000008/exploration.md>)
- `01_Discovery/Explorations/EXP-000008_Repository_Local_Work/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000009_Cross_Repository_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000009/exploration.md`](<../../../01_Discovery/Analysis/EXP-000009/exploration.md>)
- [`01_Discovery/Analysis/EXP-000010/exploration.md`](<../../../01_Discovery/Analysis/EXP-000010/exploration.md>)
- `01_Discovery/Explorations/EXP-000010_Human_and_AI_Entry_Points/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000011/exploration.md`](<../../../01_Discovery/Analysis/EXP-000011/exploration.md>)
- `01_Discovery/Explorations/EXP-000011_Remote_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000012/exploration.md`](<../../../01_Discovery/Analysis/EXP-000012/exploration.md>)
- `01_Discovery/Explorations/EXP-000012_Topic_and_Meeting_Continuity/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000013/exploration.md`](<../../../01_Discovery/Analysis/EXP-000013/exploration.md>)
- `01_Discovery/Explorations/EXP-000013_Portfolio_Visibility/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000014_Repository_Capability_Discovery/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000014/exploration.md`](<../../../01_Discovery/Analysis/EXP-000014/exploration.md>)
- [`01_Discovery/Analysis/EXP-000015/exploration.md`](<../../../01_Discovery/Analysis/EXP-000015/exploration.md>)
- `01_Discovery/Explorations/EXP-000015_Runtime_Data_Ownership/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000016_AI_Runtime_Changeability/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000016/exploration.md`](<../../../01_Discovery/Analysis/EXP-000016/exploration.md>)
- `01_Discovery/Explorations/EXP-000017_Cross_Project_Context_Exchange/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000017/exploration.md`](<../../../01_Discovery/Analysis/EXP-000017/exploration.md>)
- `01_Discovery/Explorations/EXP-000018_User_Owned_Runtime_Trust/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000018/exploration.md`](<../../../01_Discovery/Analysis/EXP-000018/exploration.md>)
- `01_Discovery/Explorations/EXP-000019_Audit_and_Decision_Convergence/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000019/exploration.md`](<../../../01_Discovery/Analysis/EXP-000019/exploration.md>)
- [`01_Discovery/Analysis/EXP-000020/exploration.md`](<../../../01_Discovery/Analysis/EXP-000020/exploration.md>)
- `01_Discovery/Explorations/EXP-000020_External_Context_Boundaries/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000021_Agent_Guidance_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000021/exploration.md`](<../../../01_Discovery/Analysis/EXP-000021/exploration.md>)
- `01_Discovery/Explorations/EXP-000022_Reasoning_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000022/exploration.md`](<../../../01_Discovery/Analysis/EXP-000022/exploration.md>)
- `01_Discovery/Explorations/EXP-000023_Assurance_and_Regression/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000023/exploration.md`](<../../../01_Discovery/Analysis/EXP-000023/exploration.md>)
- `01_Discovery/Explorations/EXP-000024_Human_Readable_Documentation/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000024/exploration.md`](<../../../01_Discovery/Analysis/EXP-000024/exploration.md>)
- `01_Discovery/Explorations/EXP-000025_Diagram_Guided_Handoff/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000025/exploration.md`](<../../../01_Discovery/Analysis/EXP-000025/exploration.md>)
- [`01_Discovery/Analysis/EXP-000026/exploration.md`](<../../../01_Discovery/Analysis/EXP-000026/exploration.md>)
- `01_Discovery/Explorations/EXP-000026_Work_and_Evidence_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000027/exploration.md`](<../../../01_Discovery/Analysis/EXP-000027/exploration.md>)
- `01_Discovery/Explorations/EXP-000027_Repository_Distributed_Tooling/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000028_Recognizable_Official_Identity/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000028/exploration.md`](<../../../01_Discovery/Analysis/EXP-000028/exploration.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/Details/checker/01_Architecture.md`](<../../../06_Architecture/Details/checker/01_Architecture.md>)
- [`06_Architecture/Details/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/Details/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/Details/project-runtime/01_Architecture.md`](<../../../06_Architecture/Details/project-runtime/01_Architecture.md>)
- [`06_Architecture/Details/version-control/01_Architecture.md`](<../../../06_Architecture/Details/version-control/01_Architecture.md>)
- [`07_Quality/Registry/test-catalog.json`](<../../../07_Quality/Registry/test-catalog.json>)
- `07_Quality/07_Structured_Document_Disposition_Inventory.json`（削除または旧Path）
- [`12_Change.md`](<../../../12_Change.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`19_Workflows/02_Checker.md`](<../../../19_Workflows/02_Checker.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/checker/regression-execution.ts`](<../../../40_Develop/checker/regression-execution.ts>)
- [`40_Develop/checker/regression-runner.ts`](<../../../40_Develop/checker/regression-runner.ts>)
- `40_Develop/checker/scripts/update-document-disposition-inventory.ts`（削除または旧Path）
- [`40_Develop/checker/test-catalog.ts`](<../../../40_Develop/checker/test-catalog.ts>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/checker/tests/integration/regression-runner.contract.test.ts`](<../../../40_Develop/checker/tests/integration/regression-runner.contract.test.ts>)
- [`40_Develop/checker/tests/unit/test-catalog.contract.test.ts`](<../../../40_Develop/checker/tests/unit/test-catalog.contract.test.ts>)
- [`40_Develop/checker/tsconfig.json`](<../../../40_Develop/checker/tsconfig.json>)
- [`40_Develop/coordinator/bin/coordinator.ts`](<../../../40_Develop/coordinator/bin/coordinator.ts>)
- [`40_Develop/coordinator/scripts/measure-development-providers.ts`](<../../../40_Develop/coordinator/scripts/measure-development-providers.ts>)
- [`40_Develop/coordinator/scripts/prepare-release-candidate.ts`](<../../../40_Develop/coordinator/scripts/prepare-release-candidate.ts>)
- [`40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts`](<../../../40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts>)
- [`40_Develop/coordinator/scripts/promote-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/promote-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/sign-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/sign-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts`](<../../../40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-general-task.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-general-task.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-route-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-route-matrix.ts>)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](<../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts>)
- [`40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts`](<../../../40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts>)
- [`40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts`](<../../../40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts>)
- [`40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts`](<../../../40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts>)
- [`40_Develop/coordinator/src/core/doctor.ts`](<../../../40_Develop/coordinator/src/core/doctor.ts>)
- [`40_Develop/coordinator/src/core/interactive-console.ts`](<../../../40_Develop/coordinator/src/core/interactive-console.ts>)
- [`40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts`](<../../../40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts>)
- [`40_Develop/coordinator/src/core/verification-result-record.ts`](<../../../40_Develop/coordinator/src/core/verification-result-record.ts>)
- [`40_Develop/coordinator/src/security/authority-file-bundle.ts`](<../../../40_Develop/coordinator/src/security/authority-file-bundle.ts>)
- [`40_Develop/coordinator/src/security/authority-grant-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-grant-verifier.ts>)
- [`40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts>)
- [`40_Develop/coordinator/src/security/authority-trust-loader.ts`](<../../../40_Develop/coordinator/src/security/authority-trust-loader.ts>)
- [`40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts`](<../../../40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts>)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](<../../../40_Develop/coordinator/src/security/docker-isolation.ts>)
- [`40_Develop/coordinator/src/security/docker-project-recovery-settlement.ts`](<../../../40_Develop/coordinator/src/security/docker-project-recovery-settlement.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-journal.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-journal.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-public-projection.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-public-projection.ts>)
- [`40_Develop/coordinator/src/security/docker-restart-continuation-record.ts`](<../../../40_Develop/coordinator/src/security/docker-restart-continuation-record.ts>)
- [`40_Develop/coordinator/src/security/execution-environment.ts`](<../../../40_Develop/coordinator/src/security/execution-environment.ts>)
- [`40_Develop/coordinator/src/security/execution-intelligence-adapter.ts`](<../../../40_Develop/coordinator/src/security/execution-intelligence-adapter.ts>)
- [`40_Develop/coordinator/src/security/external-send-policy-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-policy-runtime.ts>)
- [`40_Develop/coordinator/src/security/platform-key-storage-policy.ts`](<../../../40_Develop/coordinator/src/security/platform-key-storage-policy.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-objective-intake.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts>)
- [`40_Develop/coordinator/src/security/provider-home.ts`](<../../../40_Develop/coordinator/src/security/provider-home.ts>)
- `40_Develop/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-operation-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-operation-runtime.ts>)
- `40_Develop/coordinator/src/security/repository-root-resolution.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-workspace-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-workspace-runtime.ts>)
- [`40_Develop/coordinator/src/security/windows-directory-bootstrap.ts`](<../../../40_Develop/coordinator/src/security/windows-directory-bootstrap.ts>)
- [`40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/doctor.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/doctor.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tsconfig.strict.json`](<../../../40_Develop/coordinator/tsconfig.strict.json>)
- [`40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts`](<../../../40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts>)
- [`40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts`](<../../../40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts>)
- [`40_Develop/execution-intelligence/src/store/verified-repository-root.ts`](<../../../40_Develop/execution-intelligence/src/store/verified-repository-root.ts>)
- [`40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts`](<../../../40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts>)
- [`40_Develop/mcp/src/adapters/project-runtime-adapter.ts`](<../../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts>)
- [`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`](<../../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts>)
- [`40_Develop/project-runtime/src/application/project-runtime-integration.ts`](<../../../40_Develop/project-runtime/src/application/project-runtime-integration.ts>)
- [`40_Develop/project-runtime/src/public-contract/integration-result.ts`](<../../../40_Develop/project-runtime/src/public-contract/integration-result.ts>)
- [`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`](<../../../40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts>)
- [`40_Develop/runtime-data/src/index.ts`](<../../../40_Develop/runtime-data/src/index.ts>)
- `40_Develop/runtime-data/src/platform/repository-root-capability.ts`（削除または旧Path）
- [`40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts`](<../../../40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts>)
- [`40_Develop/runtime-data/src/store/temporary-operation-store.ts`](<../../../40_Develop/runtime-data/src/store/temporary-operation-store.ts>)
- [`40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts`](<../../../40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts>)
- [`40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts`](<../../../40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts>)
- [`40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts`](<../../../40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts>)
- [`40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts`](<../../../40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts>)
- [`40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts`](<../../../40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts>)
- [`40_Develop/version-control/package-lock.json`](<../../../40_Develop/version-control/package-lock.json>)
- [`40_Develop/version-control/package.json`](<../../../40_Develop/version-control/package.json>)
- [`40_Develop/version-control/scripts/generate-checker-runtime.ts`](<../../../40_Develop/version-control/scripts/generate-checker-runtime.ts>)
- [`40_Develop/version-control/src/distribution/checker-version-control-runtime.ts`](<../../../40_Develop/version-control/src/distribution/checker-version-control-runtime.ts>)
- [`40_Develop/version-control/src/fixed-revision.ts`](<../../../40_Develop/version-control/src/fixed-revision.ts>)
- [`40_Develop/version-control/src/fixed-snapshot.ts`](<../../../40_Develop/version-control/src/fixed-snapshot.ts>)
- [`40_Develop/version-control/src/git/fixed-revision-adapter.ts`](<../../../40_Develop/version-control/src/git/fixed-revision-adapter.ts>)
- [`40_Develop/version-control/src/git/fixed-snapshot-adapter.ts`](<../../../40_Develop/version-control/src/git/fixed-snapshot-adapter.ts>)
- [`40_Develop/version-control/src/git/local-change-set-adapter.ts`](<../../../40_Develop/version-control/src/git/local-change-set-adapter.ts>)
- [`40_Develop/version-control/src/git/object-reader.ts`](<../../../40_Develop/version-control/src/git/object-reader.ts>)
- [`40_Develop/version-control/src/git/repository-layout-adapter.ts`](<../../../40_Develop/version-control/src/git/repository-layout-adapter.ts>)
- [`40_Develop/version-control/src/git/repository-layout.ts`](<../../../40_Develop/version-control/src/git/repository-layout.ts>)
- [`40_Develop/version-control/src/git/repository-local-ignore-adapter.ts`](<../../../40_Develop/version-control/src/git/repository-local-ignore-adapter.ts>)
- [`40_Develop/version-control/src/index.ts`](<../../../40_Develop/version-control/src/index.ts>)
- [`40_Develop/version-control/src/local-change-set.ts`](<../../../40_Develop/version-control/src/local-change-set.ts>)
- [`40_Develop/version-control/src/repository-local-ignore.ts`](<../../../40_Develop/version-control/src/repository-local-ignore.ts>)
- [`40_Develop/version-control/src/repository-location.ts`](<../../../40_Develop/version-control/src/repository-location.ts>)
- [`40_Develop/version-control/src/repository-revision.ts`](<../../../40_Develop/version-control/src/repository-revision.ts>)
- [`40_Develop/version-control/tests/fixtures/repository-ignore-writer.ts`](<../../../40_Develop/version-control/tests/fixtures/repository-ignore-writer.ts>)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/local-change-set.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/local-change-set.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/repository-location.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/repository-location.integration.test.ts>)
- [`40_Develop/version-control/tsconfig.json`](<../../../40_Develop/version-control/tsconfig.json>)
- [`99_Roadmap/01_Roadmap.md`](<../../../99_Roadmap/01_Roadmap.md>)
- [`99_Roadmap/02_Changes.md`](<../../../99_Roadmap/02_Changes.md>)
- [`99_Roadmap/Changes/CHG-000001/change.md`](<../../../99_Roadmap/Changes/CHG-000001/change.md>)
- [`99_Roadmap/Changes/CHG-000002/change.md`](<../../../99_Roadmap/Changes/CHG-000002/change.md>)
- [`99_Roadmap/Changes/CHG-000003/change.md`](<../../../99_Roadmap/Changes/CHG-000003/change.md>)
- [`99_Roadmap/Changes/CHG-000004/change.md`](<../../../99_Roadmap/Changes/CHG-000004/change.md>)
- [`99_Roadmap/Changes/CHG-000005/change.md`](<../../../99_Roadmap/Changes/CHG-000005/change.md>)
- [`99_Roadmap/Changes/CHG-000006/change.md`](<../../../99_Roadmap/Changes/CHG-000006/change.md>)
- [`99_Roadmap/Changes/CHG-000007/change.md`](<../../../99_Roadmap/Changes/CHG-000007/change.md>)
- [`99_Roadmap/Changes/CHG-000008/change.md`](<../../../99_Roadmap/Changes/CHG-000008/change.md>)
- [`99_Roadmap/Changes/CHG-000009/change.md`](<../../../99_Roadmap/Changes/CHG-000009/change.md>)
- [`99_Roadmap/Changes/CHG-000010/change.md`](<../../../99_Roadmap/Changes/CHG-000010/change.md>)
- [`99_Roadmap/Changes/CHG-000011/change.md`](<../../../99_Roadmap/Changes/CHG-000011/change.md>)
- [`99_Roadmap/Changes/CHG-000012/change.md`](<../../../99_Roadmap/Changes/CHG-000012/change.md>)
- [`99_Roadmap/Changes/CHG-000013/change.md`](<../../../99_Roadmap/Changes/CHG-000013/change.md>)
- [`99_Roadmap/Changes/CHG-000014/change.md`](<../../../99_Roadmap/Changes/CHG-000014/change.md>)
- [`99_Roadmap/Changes/CHG-000015/change.md`](<../../../99_Roadmap/Changes/CHG-000015/change.md>)
- [`99_Roadmap/Changes/CHG-000017/change.md`](<../../../99_Roadmap/Changes/CHG-000017/change.md>)
- [`99_Roadmap/Changes/CHG-000054/change.md`](<../../../99_Roadmap/Changes/CHG-000054/change.md>)
- [`99_Roadmap/Changes/CHG-000055/change.md`](<../../../99_Roadmap/Changes/CHG-000055/change.md>)
- [`99_Roadmap/Changes/CHG-000056/change.md`](<../../../99_Roadmap/Changes/CHG-000056/change.md>)
- [`99_Roadmap/Changes/CHG-000057/change.md`](<../../../99_Roadmap/Changes/CHG-000057/change.md>)
- [`99_Roadmap/Changes/CHG-000058/change.md`](<../../../99_Roadmap/Changes/CHG-000058/change.md>)
- [`99_Roadmap/Changes/CHG-000059/change.md`](<../../../99_Roadmap/Changes/CHG-000059/change.md>)
- [`99_Roadmap/Changes/CHG-000060/change.md`](<../../../99_Roadmap/Changes/CHG-000060/change.md>)
- [`99_Roadmap/Changes/CHG-000061/change.md`](<../../../99_Roadmap/Changes/CHG-000061/change.md>)
- [`99_Roadmap/Changes/CHG-000062/change.md`](<../../../99_Roadmap/Changes/CHG-000062/change.md>)
- [`99_Roadmap/Changes/CHG-000063/change.md`](<../../../99_Roadmap/Changes/CHG-000063/change.md>)
- [`99_Roadmap/Changes/CHG-000064/change.md`](<../../../99_Roadmap/Changes/CHG-000064/change.md>)
- [`99_Roadmap/Changes/CHG-000065/change.md`](<../../../99_Roadmap/Changes/CHG-000065/change.md>)
- [`99_Roadmap/Changes/CHG-000066/change.md`](<../../../99_Roadmap/Changes/CHG-000066/change.md>)
- [`99_Roadmap/Changes/CHG-000067/change.md`](<../../../99_Roadmap/Changes/CHG-000067/change.md>)
- [`99_Roadmap/Changes/CHG-000068/change.md`](<../../../99_Roadmap/Changes/CHG-000068/change.md>)
- [`99_Roadmap/Changes/CHG-000069/change.md`](<../../../99_Roadmap/Changes/CHG-000069/change.md>)
- [`99_Roadmap/Changes/CHG-000070/change.md`](<../../../99_Roadmap/Changes/CHG-000070/change.md>)
- [`99_Roadmap/Changes/CHG-000071/change.md`](<../../../99_Roadmap/Changes/CHG-000071/change.md>)
- [`99_Roadmap/Changes/CHG-000071/Evidence/260913-2335_signed-e2e.md`](<../../../99_Roadmap/Changes/CHG-000071/Evidence/260913-2335_signed-e2e.md>)
- [`99_Roadmap/Changes/CHG-000072/change.md`](<../../../99_Roadmap/Changes/CHG-000072/change.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`README.md`](<../../../README.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- [`template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md`](<../../../template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md>)
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- [`template/99_Roadmap/Changes/CHG-XXXXXX/change.md`](<../../../template/99_Roadmap/Changes/CHG-XXXXXX/change.md>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`template/tools/internal/version-control-runtime.ts`](<../../../template/tools/internal/version-control-runtime.ts>)

</details>

## 3. 採用する責務

```text
99_Roadmap
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
01_Roadmap.md              未完了作業の現在入口
02_Changes.md              Change一覧・統合履歴の入口
03_Releases.md             公開対象・状態・判断の現在入口

Changes/CHG-xxxxxx/
├ change.md                変更理由・判断・経緯・結果
└ Evidence/                そのChangeを直接証明する根拠

Releases/vX.Y.Z/Evidence/  Release全体を直接証明する根拠


07_Quality
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strategy／Verification Design／Test Catalog／Traceability
Quality Center             上記Evidenceを読む現在品質の投影
```

`99_Roadmap`全体を未完了作業だけに限定しない。未完了登録簿の責務は`01_Roadmap.md`、Change Navigationは`02_Changes.md`、Release Navigationは`03_Releases.md`へ限定し、Directory全体はWork LifecycleのNavigation Rootとする。

## 4. Evidenceの配置判断

| 直接証明する対象 | Owner | 配置 |
|---|---|---|
| 一つのChange | 当該CHG | `99_Roadmap/Changes/<CHG-ID>/Evidence/` |
| 複数Changeを含む一つのRelease | 当該Release | `99_Roadmap/Releases/<version>/Evidence/` |
| Repository全体の現在品質 | Quality Center | 元Evidenceを複製せず参照・評価する |

Execution／Observation EvidenceとVerification Assessmentは、Metadataまたは名称で区別できる。同じ証明対象に属する限り、この違いだけで別Top-levelへ分離しない。

## 5. 名称とIdentity

| 要素 | 責務 | 規則 |
|---|---|---|
| CHG Directory | 安定したChange ID | `CHG-000070/`。表題は`change.md`と一覧が所有する |
| CHG本文 | 当該Directory内の唯一のChange Narrative | `change.md` |
| 新規Evidence名 | 観測順と局所的な種別 | `<YYMMDD-HHmm>_<type>.<ext>`を基本とする |
| 正確な意味 | 対象、改訂版、時刻、状態 | 必要な値だけをEvidence内のMetadataに持つ |
| 現在採用するEvidence | 最新Fileと現在有効の分離 | CHGまたはRelease本文が参照する |

Filenameの時刻基準はCRDD公式RepositoryではJSTとし、正式時刻を持つ場合はISO 8601で記録する。既存Evidenceも新Canonical Namingへ移行し、旧命名を恒久例外として残さない。

| 移行時の精度 | Canonical名 | 時刻の根拠 |
|---|---|---|
| 観測分まで確定 | `YYMMDD-HHmm_<type>` | Evidenceの明示時刻 |
| 観測日だけ確定 | `YYMMDD_<type>` | Evidenceまたは既存Filenameの明示日 |
| 観測日が未確定 | `YYMMDD-HHmm_<type>` | Gitの初回収載時刻。Evidence観測時刻とは扱わない |
| 同一時刻粒度と種別が衝突 | `..._<type>-01` | 連番は衝突回避にだけ用いる |

移行対応表に旧Path、新Path、移行前後HashおよびTimestampの根拠を残す。Path自体を不変Identityとは扱わず、Git Historyと移行対応表から追跡可能にする。

## 6. 変更禁止範囲

- 過去CHG本文は、現在のCanonical Change契約へ移行するために構造と案内を更新できる。過去の判断、結果、観測値またはリリース状態を現在の値で遡及上書きしない。
- byte列自体がEvidence Identityである固定Evidenceは変更しない。CHGの可読性・追跡性を改善することと、観測原文の改変を分ける。
- 影響ファイル一覧へ、同じCommitに混在した別CHGまたは無関係な機械整形を含めない。過去の帰属を一意に確定できない場合は推測せず、その限界を明示する。
- CHG本文と履歴を別Artifactへ分割しない。
- Quality Centerを個別Evidenceの第二正本にしない。
- Evidenceを日付、拡張子または`Verification`という語だけでOwnerへ分類しない。
- 旧Pathの互換stubを恒久配置しない。

## 6.1 CHGを作らない通常データ操作

Work Lifecycleは、管理対象の全Markdown更新へCHGを要求する仕組みではない。Communication、Topic、Meeting、Commercial等では、成立済み契約に従うデータの追加・編集・削除を通常Operationとして扱う。CHGが追跡するのは、構造、Schema、関係、Lifecycle、Authority、Tool／Runtime挙動または移行規則の変更である。

| 対象 | 通常Operation | CHG対象 |
|---|---|---|
| Communication | 記事・案内・測定記録の追加や編集 | 公開状態契約、成果物構造、自動公開処理の変更 |
| Topic | Topic itemの追加、更新、終了 | Topic Schema、関係、状態遷移の変更 |
| Meeting | 議事録、決定候補、Actionの追加や更新 | Meeting契約、Promotion規則の変更 |
| Commercial | 成立済み項目への値の追加や更新 | Commercialの責務境界、Schema、Authorityの変更 |

データ操作と契約変更が同時に起きる場合も、CHGへ通常データの内容を複製せず、契約変更とその代表検証だけを追跡する。

## 7. 移行単位

| 順序 | 処置 | 完了条件 |
|---|---|---|
| 1 | 現行CHG、Change Evidence、Verification Result、Release Evidence候補を棚卸し | 全ファイルが一つの証明対象または判断待ちに分類される |
| 2 | 正本規則、ひな型、Checkerの現行Path契約を固定 | 旧Pathを新規正本として許可しない反証を持つ |
| 3 | Roadmap、CHG Aggregate、Evidenceを一括移行 | CHGはCanonical契約へ統一し、固定Evidenceの本文byteを維持したままPath変換を行う |
| 4 | Consumer Closure | 現行Checker、Workflow、Template、Tool、MCP／Runtimeの利用Pathを全数照合する。移行対応表と、固定改訂版から再構成した対象集合の真正性は独立監査で確認する |
| 5 | 独立確認 | 文書Owner、履歴Identity、リンク、正本一意性、移行漏れがMajor 0になる |

## 8. 現在の棚卸し

| 母集団 | 現在数 | 初期分類 |
|---|---:|---|
| CHG本文 | 35 | 各CHG Aggregateへ移行し、影響ファイル契約へ統一 |
| `90_Release/Changes/Evidence` | 343 | filenameのCHG IDだけで確定せず、CHG本文・統合台帳のOwner接続と照合 |
| `07_Quality/Verification_Results` | 28 | Change固有またはRelease全体へ分類 |
| 旧Path参照を持つ追跡File | 116 | Contract単位で自動導出し、移行後0件を確認 |

数は2026-09-12の着手時観測であり、完了判定は固定数ではなく移行対象集合と移行後集合の完全一致で行う。

## 9. 現在のGate

| Gate | 状態 |
|---|---|
| 目標責務と最終構造 | 採用済み |
| Evidence Owner全数分類 | 完了。移行元固定CommitのDispositionと旧配置契約から独立導出 |
| 正本・Template・Checker変更 | 完了。現行Profileが旧Path再作成、案内欠落および現在のCanonical配置退行を機械拒否 |
| 物理移行とConsumer Closure | 完了。408件を移行し、固定履歴392件はsource byteを完全保持 |
| 移行前後の証拠連続性 | 完了。移行時の固定監査でsource／target、Commit、Hashおよび配置を照合した。通常Checkerへ過去移行の再演責務は残さない |
| Canonical名称の意味閉包 | 完了。`99_Roadmap/01_Roadmap.md`の表題を所有範囲と一致する`CRDD Roadmap`へ統一し、固定したCanonical案内文書のPath変更時に旧表題が残る状態をCheckerで拒否する |
| CHG影響ファイル契約 | 是正完了。全35件を同一の折り畳み可能な平坦Path一覧へ統一し、Git履歴、直接参照および現在差分から確認できる全Pathを収載した。構造上の意味は直前の変更表が所有し、一覧内で分類を重複させない |
| 独立レビュー／監査 | `Pass`。是正後の同一改訂版でCritical 0／Major 0／Moderate 0／Minor 0を確認。全CHGの影響Path閉包、平坦一覧の正本境界、UX要求分析Directory全欠落の反証、および変更後状態表示を確認済み |

名称移行ではPath、Linkおよび配置だけでなく、文書表題が移行後の責務を表すことまで利用側閉包へ含める。全MarkdownへFilenameと表題の機械的一致を要求せず、安定したCanonical案内文書について宣言したPathと表題の組を検証する。

## 10. Checker責務の是正

本移行のために追加した固定履歴、移行Manifest、個別CHG、特定Releaseおよびpackage内部の再演検査を通常Checkerへ恒久化しない。移行時の確認と、現在状態の継続検査は別の責務である。

| 責務 | 所有者 | 継続方法 |
|---|---|---|
| Root、Path、Link、Anchor、ID、宣言構造 | Generic Checker Core | 題材に依存しない小さな契約試験 |
| CRDD公式Repositoryの現在の版、状態、正本、template、Directory、通常のChange／Evidenceリンク | CRDD Official Current Profile | 現在のCanonical構成に対する反証試験 |
| 固定履歴参照の識別と承認済み移行表による機械的解決 | CRDD Official Current Profile | 固定本文Hash、移行表Schema、重複・Root外Path・不正Hashの反証試験 |
| 固定原文Identity、過去Git object、移行表が当時の移行を表すかという真正性 | 当該ChangeのEvidenceと独立監査 | 固定改訂版に対する一回の監査記録 |
| packageの公開API、内部依存、実行挙動 | 各packageの契約試験 | package所有の単体・結合・回帰試験 |
| 文書の意味品質、可読性、正本Scope | 文書レビュー／監査 | 対象を固定した人間・AIの意味確認 |

CHG-000065の全数文書監査で用いたPath／Blob集合は、公式tag `v0.20.0`、Markdown Path抽出条件、対象428件および監査結果から再構成する。文書ごとの処置・理由・正本OwnerはGit Treeだけから再構成できない判断なので、tag内の`07_Quality/07_Structured_Document_Disposition_Inventory.json`（blob `3968129b9210329ac818c321b40b1241fc5dbda6`）を当時の固定Evidenceとする。現行Treeへ複製せず、現在のInventoryとして更新しない。
