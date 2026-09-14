# 変更トレース: 構造を先に選ぶ文書改善

変更ID: `CHG-000065`
状態: `Released`
担当責任者: Qual-Lab
対象版: `v0.20.0`
リリース: `v0.20.0`（2026-09-11）
変更分類: `quality`
最終更新日: 2026-09-11

## 1. 結論と現在状態

v0.20.0のリリース前に、CRDD Repository内の人間可読文書を全数対象として、文章中心の説明を意味の種類に合う構造へ変更した。情報量を削減すること、表の数を増やすこと、または過去tag上の原記録を変更することは目的にしない。対象集合は公式tag `v0.20.0`のGit TreeとMarkdown Path抽出条件から再構成できる。本書には対象428件、処置結果および固定改訂版の要約を保持する。文書ごとの処置・理由・正本OwnerというGitから再構成できない判断は、tag内の`07_Quality/07_Structured_Document_Disposition_Inventory.json`（blob `3968129b9210329ac818c321b40b1241fc5dbda6`）に固定されている。現行Treeへ同JSONを複製せず、現在の文書Inventoryとして更新し続けない。

規範と監査観点は[文書化](../../../03_Documentation.md#104-structured-first)と[文書監査](../../../51_Document_Audit.md)へ追加した。初回処置では全427文書を現在文書84件と固定履歴343件へ分け、固定履歴を一括して無変更とした。しかし、固定履歴であることは事実保全の条件であり、可読性評価の免除理由ではない。2026-09-11の人間判断に基づき、過去CHG、Evidenceおよび検証結果を含む全件を再評価した。Roadmap詳細の正本分離でDiscovery文書を1件追加したため、最終母集団は現在文書85件と固定履歴343件の合計428件である。byte列が公開履歴のIdentityとなる文書は原記録を保全し、目的別の構造化索引から現行正本と固定原記録を分けて読めるようにした。初回監査Passは拡張後の完了根拠へ流用せず、新しい固定改訂版を再監査する。

## 2. 変更する責務

| 対象 | 現在の問題 | 目指す状態 |
|---|---|---|
| CRDD規則 | 条件、例外、決定権限および処置が長文中で混在し得る | 表、箇条書き、Flowから係り先を直接読める |
| 全工程成果物 | Discovery、UX、IA、UI、UI／SPEC対応、SPEC、Architecture、ImplementationおよびVerificationが所有する状態、関係、Input／Output、判断または受入条件が文章へ埋まり得る | 各工程の責務に合う表、Matrix、Diagram、FlowまたはChecklistを使う |
| Roadmap | 設計詳細と履歴が未完了作業の索引へ流入し得る | 作業、状態、次のGate、詳細正本への参照へ限定する |
| `CHG-*` | 時系列の開発日誌が現在の変更契約を埋め得る | 現在状態、契約差、指摘と是正、根拠、残るGateを先に示す |
| 検証結果 | 手順詳細が対象、結果および未確認範囲を埋め得る | 対象改訂版、条件、結果、未確認範囲を構造化する |
| 公開済み履歴 | 事実と判断を変えず、現行Tree上の表示が文章中心のまま残り得る | 意味とIdentityを保持できれば原記録を構造是正する。byte固定した原記録は変更せず、現行正本と分けた目的別索引を提供する |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`00_Overview.md`](<../../../00_Overview.md>)
- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Discovery/01_Product_Discovery.md`](<../../../01_Discovery/01_Product_Discovery.md>)
- [`01_Discovery/02_Product_Candidates.md`](<../../../01_Discovery/02_Product_Candidates.md>)
- `01_Discovery/02_Runtime_and_CROS_Product_Candidates.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md`](<../../../01_Discovery/Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md>)
- [`01_Discovery/Explorations/EXP-000002_Audit_and_Decision_Convergence/exploration.md`](<../../../01_Discovery/Explorations/EXP-000002_Audit_and_Decision_Convergence/exploration.md>)
- `01_Discovery/Explorations/EXP-000002_Coordinated_AI_Execution/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000003_External_Context_Boundaries/exploration.md`](<../../../01_Discovery/Explorations/EXP-000003_External_Context_Boundaries/exploration.md>)
- `01_Discovery/Explorations/EXP-000003_Project_Runtime/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000004_Coordinated_AI_Execution/exploration.md`](<../../../01_Discovery/Explorations/EXP-000004_Coordinated_AI_Execution/exploration.md>)
- `01_Discovery/Explorations/EXP-000004_Execution_Intelligence/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000005_Repository_Distributed_Tooling/exploration.md`](<../../../01_Discovery/Explorations/EXP-000005_Repository_Distributed_Tooling/exploration.md>)
- `01_Discovery/Explorations/EXP-000005_Runtime_Responsibility_Separation/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000006_Agent_Guidance_Ownership/exploration.md`](<../../../01_Discovery/Explorations/EXP-000006_Agent_Guidance_Ownership/exploration.md>)
- `01_Discovery/Explorations/EXP-000006_Local_MCP_HTTP_Access/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md`](<../../../01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md>)
- [`01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md`](<../../../01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md>)
- `01_Discovery/Explorations/EXP-000008_Repository_Local_Work/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000009_Cross_Repository_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000009_Reasoning_Context/exploration.md`](<../../../01_Discovery/Explorations/EXP-000009_Reasoning_Context/exploration.md>)
- [`01_Discovery/Explorations/EXP-000010_Assurance_and_Regression/exploration.md`](<../../../01_Discovery/Explorations/EXP-000010_Assurance_and_Regression/exploration.md>)
- `01_Discovery/Explorations/EXP-000010_Human_and_AI_Entry_Points/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000011_Human_Readable_Documentation/exploration.md`](<../../../01_Discovery/Explorations/EXP-000011_Human_Readable_Documentation/exploration.md>)
- `01_Discovery/Explorations/EXP-000011_Remote_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000012_Recognizable_Official_Identity/exploration.md`](<../../../01_Discovery/Explorations/EXP-000012_Recognizable_Official_Identity/exploration.md>)
- `01_Discovery/Explorations/EXP-000012_Topic_and_Meeting_Continuity/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000013_Execution_Intelligence/exploration.md`](<../../../01_Discovery/Explorations/EXP-000013_Execution_Intelligence/exploration.md>)
- `01_Discovery/Explorations/EXP-000013_Portfolio_Visibility/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000014_Repository_Capability_Discovery/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md`](<../../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md>)
- [`01_Discovery/Explorations/EXP-000015_Local_MCP_HTTP_Access/exploration.md`](<../../../01_Discovery/Explorations/EXP-000015_Local_MCP_HTTP_Access/exploration.md>)
- `01_Discovery/Explorations/EXP-000015_Runtime_Data_Ownership/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000016_AI_Runtime_Changeability/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000016_Runtime_Data_Ownership/exploration.md`](<../../../01_Discovery/Explorations/EXP-000016_Runtime_Data_Ownership/exploration.md>)
- `01_Discovery/Explorations/EXP-000017_Cross_Project_Context_Exchange/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000017_Diagram_Guided_Handoff/exploration.md`](<../../../01_Discovery/Explorations/EXP-000017_Diagram_Guided_Handoff/exploration.md>)
- `01_Discovery/Explorations/EXP-000018_User_Owned_Runtime_Trust/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000018_Work_and_Evidence_Ownership/exploration.md`](<../../../01_Discovery/Explorations/EXP-000018_Work_and_Evidence_Ownership/exploration.md>)
- `01_Discovery/Explorations/EXP-000019_Audit_and_Decision_Convergence/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md`](<../../../01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md>)
- [`01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md`](<../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md>)
- `01_Discovery/Explorations/EXP-000020_External_Context_Boundaries/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000021_Agent_Guidance_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md`](<../../../01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md>)
- `01_Discovery/Explorations/EXP-000022_Reasoning_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md`](<../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md>)
- `01_Discovery/Explorations/EXP-000023_Assurance_and_Regression/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md`](<../../../01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md>)
- `01_Discovery/Explorations/EXP-000024_Human_Readable_Documentation/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md`](<../../../01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md>)
- `01_Discovery/Explorations/EXP-000025_Diagram_Guided_Handoff/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000025_Repository_Capability_Discovery/exploration.md`](<../../../01_Discovery/Explorations/EXP-000025_Repository_Capability_Discovery/exploration.md>)
- [`01_Discovery/Explorations/EXP-000026_AI_Runtime_Changeability/exploration.md`](<../../../01_Discovery/Explorations/EXP-000026_AI_Runtime_Changeability/exploration.md>)
- `01_Discovery/Explorations/EXP-000026_Work_and_Evidence_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md`](<../../../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md>)
- `01_Discovery/Explorations/EXP-000027_Repository_Distributed_Tooling/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000028_Recognizable_Official_Identity/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md`](<../../../01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md>)
- [`01_Principles.md`](<../../../01_Principles.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`04_Agent_Organization.md`](<../../../04_Agent_Organization.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_Autonomous_Operation.md`](<../../../05_Autonomous_Operation.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/checker/01_Architecture.md`](<../../../06_Architecture/checker/01_Architecture.md>)
- [`06_Architecture/coordinator/01_Architecture.md`](<../../../06_Architecture/coordinator/01_Architecture.md>)
- [`06_Architecture/coordinator/02_Threat_Model.md`](<../../../06_Architecture/coordinator/02_Threat_Model.md>)
- `06_Architecture/coordinator/03_Project_Runtime_Design.md`（削除または旧Path）
- [`06_Architecture/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/mcp/01_Architecture.md`](<../../../06_Architecture/mcp/01_Architecture.md>)
- [`06_Architecture/platform-access/01_Architecture.md`](<../../../06_Architecture/platform-access/01_Architecture.md>)
- [`06_Architecture/project-runtime/01_Architecture.md`](<../../../06_Architecture/project-runtime/01_Architecture.md>)
- [`06_Architecture/project-runtime/02_Detailed_Design.md`](<../../../06_Architecture/project-runtime/02_Detailed_Design.md>)
- [`06_Architecture/version-control/01_Architecture.md`](<../../../06_Architecture/version-control/01_Architecture.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/04_Test_Catalog.json`](<../../../07_Quality/04_Test_Catalog.json>)
- [`07_Quality/05_Coordinator_Runtime_Traceability.json`](<../../../07_Quality/05_Coordinator_Runtime_Traceability.json>)
- [`07_Quality/06_Project_Runtime_Design_Traceability.json`](<../../../07_Quality/06_Project_Runtime_Design_Traceability.json>)
- `07_Quality/07_Structured_Document_Disposition_Inventory.json`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md`（削除または旧Path）
- [`10_Agent.md`](<../../../10_Agent.md>)
- [`11_Skill.md`](<../../../11_Skill.md>)
- [`12_Change.md`](<../../../12_Change.md>)
- [`13_Release.md`](<../../../13_Release.md>)
- [`14_Workflow.md`](<../../../14_Workflow.md>)
- [`15_Progress.md`](<../../../15_Progress.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`17_Communication.md`](<../../../17_Communication.md>)
- [`18_Context_Dependency.md`](<../../../18_Context_Dependency.md>)
- [`19_Maintenance.md`](<../../../19_Maintenance.md>)
- [`19_Workflows/01_Coordinator_Runtime.md`](<../../../19_Workflows/01_Coordinator_Runtime.md>)
- [`19_Workflows/02_Checker.md`](<../../../19_Workflows/02_Checker.md>)
- [`19_Workflows/04_MCP_Server.md`](<../../../19_Workflows/04_MCP_Server.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`28_Implementation.md`](<../../../28_Implementation.md>)
- [`29_Verification.md`](<../../../29_Verification.md>)
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
- [`40_Develop/coordinator/runtime/codex-executor-seccomp.json`](<../../../40_Develop/coordinator/runtime/codex-executor-seccomp.json>)
- [`40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts>)
- [`40_Develop/coordinator/scripts/check-runtime-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-runtime-traceability.ts>)
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
- [`40_Develop/coordinator/src/security/codex-executor-seccomp.ts`](<../../../40_Develop/coordinator/src/security/codex-executor-seccomp.ts>)
- [`40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts`](<../../../40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts>)
- [`40_Develop/coordinator/src/security/coordinator-task-runtime.ts`](<../../../40_Develop/coordinator/src/security/coordinator-task-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts>)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](<../../../40_Develop/coordinator/src/security/docker-isolation.ts>)
- [`40_Develop/coordinator/src/security/docker-process-controller.ts`](<../../../40_Develop/coordinator/src/security/docker-process-controller.ts>)
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
- [`40_Develop/coordinator/src/security/provider-task-packet-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-task-packet-runtime.ts>)
- `40_Develop/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-operation-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-operation-runtime.ts>)
- `40_Develop/coordinator/src/security/repository-root-resolution.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-workspace-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-workspace-runtime.ts>)
- [`40_Develop/coordinator/src/security/windows-directory-bootstrap.ts`](<../../../40_Develop/coordinator/src/security/windows-directory-bootstrap.ts>)
- [`40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts>)
- [`40_Develop/coordinator/tests/support/runtime-trace-case.ts`](<../../../40_Develop/coordinator/tests/support/runtime-trace-case.ts>)
- [`40_Develop/coordinator/tests/system/signed-reviewer-boundary-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-reviewer-boundary-verification.contract.test.ts>)
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
- [`51_Document_Audit.md`](<../../../51_Document_Audit.md>)
- [`52_Conformance_Audit.md`](<../../../52_Conformance_Audit.md>)
- [`53_Gap_Impact_Audit.md`](<../../../53_Gap_Impact_Audit.md>)
- `90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md`（削除または旧Path）
- `90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md`（削除または旧Path）
- `90_Release/Changes/CHG-000062_Execution_Intelligence.md`（削除または旧Path）
- `90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md`（削除または旧Path）
- `90_Release/Changes/CHG-000065_Structured_First_Documentation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000069_V0201_Release_State_Propagation.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/01_Roadmap.md`](<../../../99_Roadmap/01_Roadmap.md>)
- [`99_Roadmap/02_Changes.md`](<../../../99_Roadmap/02_Changes.md>)
- [`99_Roadmap/Changes/CHG-000057/change.md`](<../../../99_Roadmap/Changes/CHG-000057/change.md>)
- [`99_Roadmap/Changes/CHG-000063/change.md`](<../../../99_Roadmap/Changes/CHG-000063/change.md>)
- [`99_Roadmap/Changes/CHG-000065/change.md`](<../../../99_Roadmap/Changes/CHG-000065/change.md>)
- [`99_Roadmap/Changes/CHG-000066/change.md`](<../../../99_Roadmap/Changes/CHG-000066/change.md>)
- [`99_Roadmap/Changes/CHG-000067/change.md`](<../../../99_Roadmap/Changes/CHG-000067/change.md>)
- [`99_Roadmap/Changes/CHG-000068/change.md`](<../../../99_Roadmap/Changes/CHG-000068/change.md>)
- [`99_Roadmap/Changes/CHG-000070/change.md`](<../../../99_Roadmap/Changes/CHG-000070/change.md>)
- [`99_Roadmap/Changes/CHG-000071/change.md`](<../../../99_Roadmap/Changes/CHG-000071/change.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`CHANGELOG.md`](<../../../CHANGELOG.md>)
- [`README.md`](<../../../README.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- [`template/01_Discovery/Explorations/EXP-XXXXXX_Short_Name/exploration.md`](<../../../template/01_Discovery/Explorations/EXP-XXXXXX_Short_Name/exploration.md>)
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- [`template/03_IA/01_Information_Architecture.md`](<../../../template/03_IA/01_Information_Architecture.md>)
- [`template/04_UI/01_User_Interface.md`](<../../../template/04_UI/01_User_Interface.md>)
- [`template/05_SPEC/01_Behavior_Specification.md`](<../../../template/05_SPEC/01_Behavior_Specification.md>)
- [`template/06_Architecture/01_Architecture.md`](<../../../template/06_Architecture/01_Architecture.md>)
- [`template/07_Quality/01_Quality_Center.md`](<../../../template/07_Quality/01_Quality_Center.md>)
- [`template/07_Quality/02_Quality_Strategy.md`](<../../../template/07_Quality/02_Quality_Strategy.md>)
- [`template/07_Quality/03_Verification_Design.md`](<../../../template/07_Quality/03_Verification_Design.md>)
- `template/07_Quality/Verification_Results/Verification_Result_Template.md`（削除または旧Path）
- [`template/80_Communication/01_Communication.md`](<../../../template/80_Communication/01_Communication.md>)
- `template/90_Release/Changes/CHG-XXXXXX_Template.md`（削除または旧Path）
- `template/99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`template/99_Roadmap/Changes/CHG-XXXXXX/change.md`](<../../../template/99_Roadmap/Changes/CHG-XXXXXX/change.md>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`template/tools/internal/version-control-runtime.ts`](<../../../template/tools/internal/version-control-runtime.ts>)

</details>

## 3. 全数確認の処置

各人間可読文書を次のいずれかへ分類する。

- `構造是正`: 意味を保持したまま表、箇条書き、Flowまたは短い段落へ変更する。
- `正本移動または参照化`: 別の成果物が所有すべき詳細や重複を移し、参照へ置換する。
- `変更不要`: 文章であることが意味を保持し、必要事項を誤読なく取得できる。
- `履歴保全付き可読性是正`: 原記録の直接構造是正、または固定原記録と現行正本を分ける構造化索引を用いる。
- `確認不能`: 対象読者、決定権限または意味保持の根拠不足を明示し、人間判断へ戻す。

## 4. 変更禁止範囲

- 情報量、条件、例外、決定権限、規範強度、判断理由または未確認範囲を短文化のために落とさない。
- 表のセルへ元の長文を移すだけで改善済みとしない。
- 同じ説明をRoadmap、CHG、Architecture、検証結果へ複製しない。
- 公開済みtag、当時の事実、判断、検証結果、数値、根拠Identityまたは改訂版を変更しない。
- 文字数、段落長、箇条書き数または表の数を単独の合否基準にしない。

## 5. 検証とRelease Gate

| Gate | 完了条件 |
|---|---|
| 対象母集団 | Repository内の人間可読文書を全数列挙し、対象外を理由付きで示す |
| 処置閉包 | 各対象が5つの処置のいずれかを持ち、未処置が0件である |
| 意味保持 | 変更前後で対象、条件、例外、主体、状態、結果および規範強度が一致する |
| 正本境界 | Roadmap、CHG、各工程正本、検証結果およびGitの責務が重複しない |
| 工程網羅 | Discovery、UX、IA、UI、UI／SPEC対応、SPEC、Architecture、Implementation、Verificationと、横断するQualityおよび適用時のCommunicationの各成果物が処置済みである |
| 機械確認 | Link、Anchor、Header、参照および文書構造の既存Checkerが成功する |
| 独立確認 | 文書監査が全母集団とサンプリング限界を示し、未解決の必須指摘がない |

本変更はv0.20.0のRelease前に完了させる。文書および配布Checkerだけの変更ではCoordinator Runtimeの正式署名を再発行しない。今回の観測でPackage Rootが変化した直接原因は、検証専用の機械可読設計対応をCoordinatorの`runtime/`へ誤配置し、実行時に不要な投影までRuntime実行集合へ含めていたことだった。二つの投影を`07_Quality`へ移して責務境界を是正するため、新しい固定候補では一度だけRuntime実行Identityが変わる。境界是正後のIdentityを再署名して影響する正式E2Eを行い、以後の文書・Checker・検証投影だけの変更では同E2Eを発火しない。Release Identityと文書監査の対象改訂版は最終変更後に固定する。

## 6. 初回母集団観測

| 観測 | 結果 | 扱い |
|---|---:|---|
| Repository全体CheckerのMarkdown母集団 | 427件 | 全数処置の分母。Git管理外は含まない |
| `90_Release`配下 | 326件 | 公開済み履歴、未リリースCHG、検証結果を区別する |
| その他のルート規則・工程・設計・Workflow・Template | 101件 | 現在の判断と作業へ使う文書を優先して意味監査する |
| Checker | Error 0／Warning 0 | Link、Anchor、Header等の構造成立。意味可読性の合格ではない |

長い段落の機械抽出は重点候補の選定にだけ使用する。段落長が短いこと、表が存在すること、またはCheckerが成功したことから、構造を先に選ぶ表現や正本境界の成立を推定しない。

## 7. 全数処置の結果

初回のPath分類では`07_Quality/Verification_Results`全25件を固定履歴として数えた。文書の役割を確認した結果、v0.20の統合検証結果1件はRelease判断まで更新される現在文書であり、固定履歴24件と分離した。配置名だけで文書の現在性を決めず、成果物の役割とRelease状態で分類する。

| 母集団 | 件数 | 処置 | 結果 |
|---|---:|---|---|
| 公開済みCHG、固定Evidence、固定検証結果 | 343 | 履歴保全付き可読性是正 | byte固定の原記録は不変。[変更記録の案内](../../02_Changes.md)から、現在状態、現行正本、Canonical CHG、個別Evidenceおよび固定Commit／tagを目的別に区別して追跡できる |
| 現在の正本、案内、ひな型、未公開CHG、v0.20統合検証結果 | 85 | 全件再評価 | Roadmapから分離したDiscovery正本を含む。構造・配置是正の対象と、既に意味に合う表・箇条書き・テキスト図を持つ変更不要対象を分離。固定質問票や長さ基準は追加しない |
| 合計 | 428 | 未処置0件 | 新しいDiscovery正本を含む。機械確認と独立再監査は公式tag `v0.20.0`へ固定した集合で行った |

| 現在文書の区画 | 件数 | 主な確認 | 処置 |
|---|---:|---|---|
| ルート正本・案内 | 35 | 正本範囲、重複、全工程適用、用語、現在性 | 規範は既に構造化済み。意味を文章で保持すべき思想・背景は変更不要 |
| Discovery、UX、IA、UI、SPEC | 5 | 工程固有の状態、関係、判断、引き渡し | 正本は変更不要。各配布ひな型を構造化 |
| Architecture | 10 | 責務、依存、状態、Authority、Effect、図の意味記法 | Project Runtimeの上位設計と現行詳細設計を同Component配下へ分ける。旧版の別文書は現行Treeへ累積せずGit tagで保持 |
| Quality | 4 | 対象改訂版、結果、未確認範囲、Release Gate | Quality Centerとv0.20統合検証結果の重複・旧Gateを是正。配布ひな型を構造化 |
| Workflow | 4 | 操作手順と規範の混在、利用者行動 | 独立した公開起動入口を持つMCPの利用手順を分離。直接起動しない内部ComponentへはWorkflowを機械的に追加しない |
| Release | 7 | CHGの現在状態、変更契約、Timeline、残るGate | CHG-000061／063／065とCHGひな型を是正 |
| Roadmap | 1 | 未完了作業、現在状態、次のGate、詳細正本参照 | 詳細な将来候補をDiscoveryへ移し、旧Gateを更新 |
| 配布ひな型 | 16 | 適用先の工程入口、Quality、Communication、CHG、Roadmap | 13件を構造化。既に構造が成立する3件は変更不要 |
| Repository運用 | 2 | Issue／PR案内と本文正本の分離 | 変更不要 |

## 8. 検出して是正した不整合

| 不整合 | 是正 | 意味保持 |
|---|---|---|
| Runtime責務分離のRoadmapだけが`Formal E2E Pending` | 初回是正時に、前の署名候補で成立した正式4経路E2E、Recovery Matrix、技術監査を反映 | 後続変更後の現在Gateへ流用せず、Quality Centerで前候補と現在候補を分離 |
| 試験体系CHGが完成根拠を持ちながら`In Progress` | `Ready for Release Handoff`へ更新し、完成条件を表で明示 | 任意UAT／PT／LTの未実行を成功へ補完しない |
| v0.20統合検証結果に途中候補の「次は署名・再監査」が残存 | 前候補の最終結果を検証結果へ集約し、現在候補のGateはQuality Centerへ分離 | 前候補の不成立経緯と実測値を保持し、現在候補の完了とは表示しない |
| 工程ひな型が状態と引き渡しを文章・空箇条書きへ委ねる | DiscoveryからArchitecture、Quality、Communication、CHG、Roadmapの13ひな型を構造化 | 固定質問票にはせず、対象に応じた詳しさを維持 |
| 構造化済みひな型の退行を検出できない | 主要6工程の現在状態・引き渡し表と全工程正本行をChecker契約試験へ接続 | 表の存在だけを意味品質の合格とは扱わない |
| 旧Project Runtime設計と参照ArchitectureがCoordinator配下に残り、現在正本の二重化に見える | 旧文書と大規模な参照節を削除。現在の責務はProject Runtime正本、exactな設計対応は機械可読成果物、旧版はGit tagへ分離 | CoordinatorにはExecution Portとの現行接続だけを残し、版ごとの旧文書累積を避ける |
| MCPは独立公開起動入口を持つが、利用手順はCoordinator手順に埋没 | `19_Workflows/04_MCP_Server.md`へ操作を分離し、ArchitectureはProtocol・Transport契約だけを所有 | Project RuntimeとPlatform Accessには独立Process入口がないため、不要なWorkflowは追加しない |
| 機械可読な設計対応がCoordinatorの`runtime/`へ置かれ、検証投影の変更まで署名対象になっていた | Coordinator／Project Runtimeの設計対応を`07_Quality`へ移し、検査Scriptと契約試験から参照する | 実行時設定と検証専用投影を分離。今回の移動による一回のIdentity変更は再署名し、以後の検証投影更新はRuntime E2Eを発火しない |
| 固定履歴343件を一括して可読性変更不要とした | 全件を監査母集団へ戻し、原記録直接是正と固定原記録＋構造化索引を区別。変更台帳の冒頭を目的別案内へ再構成 | 公開履歴のbyte Identityを保持しつつ、現在状態と過去原記録を同一視しない |

## 9. 独立文書監査への引き渡し

| 項目 | 内容 |
|---|---|
| 対象 | 428文書。現在性と成果物種別は区別するが、固定履歴を可読性評価から除外しない |
| 重点 | 全件の配置責務、Structured-first、重複、状態・Gateの整合、および履歴文書の意味保全 |
| 固定履歴 | 過去tag上の原記録は不変。現行Treeの各文書は個別評価し、必要なら履歴保全付き構造是正を行う |
| 機械確認 | Checker契約試験、型・Lint・Format、Repository全体Checker |
| 前候補 | `8536965`で全428件の対象集合と機械閉包を確認したが、独立監査で履歴圧縮、Roadmap正本分離、対象集合の意味契約および時点表示に未完了を検出 |
| 現在の適用 | 5件を一体是正し、公式tag `v0.20.0`から再構成できる428件、Repository全体Checkerおよび独立文書再監査が成立。前候補の監査結果は流用していない |
| Runtime Gate | 検証専用投影を除外したRuntime実行IdentityをRelease sequence `2026091104`で再署名し、正式4経路4/4とRecovery Matrix 7/7が成立 |
| 最終一括監査 | Critical／Major／Moderate／Minor 0件で成立 |
| 未完了 | なし。公式tag `v0.20.0`へ収載済み |

旧版詳細設計を現行Treeへ累積せず、現行詳細設計をProject Runtime配下で更新し、当時の歴史的述語だけを検証済みGit tag上の元Pathへ結ぶ構造とした。機械対応は設計正本ではなくCoordinator実装・試験との検証用投影であり、Runtime技術Gateとv0.20全体の文書Gateも分離した。Evidence更新後の最終監査まで完了し、署名前のPassを最終Release判断へ流用していない。
