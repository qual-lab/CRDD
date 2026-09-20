# 変更トレース: 工程別の図面処置と意図引き渡し

変更ID: `CHG-000068`
状態: `Ready for Release Handoff`
担当責任者: Qual-Lab
対象版: `v0.21.0`
変更分類: `quality`
最終更新日: 2026-09-13

## 1. 結論と現在状態

起点Discovery: [EXP-000017](../../../01_Discovery/Analysis/EXP-000017/exploration.md)／`REQ-000032`

CRDDの各工程で、本来必要な図が作成されないまま意図、境界、状態、分岐または未解決事項が後工程へ渡り、実装・試験・E2Eで初めて不足が露出することを防ぐ。

全工程へ同じ図種を強制せず、各工程が自身の判断に必要な基本図、発火条件、記法および出口条件を所有する。固定入口では各基本図を、現行図、参照、理由付き非該当または作成不能のいずれかへ必ず処置する。

Discoveryの業務プロセスViewを起点に、DiscoveryからVerificationまでの工程固有Profile、発火／非発火、プレーンテキスト記法、正本境界および出口接続を具体化した。各固定入口Templateへ基本図の処置一覧を追加し、CRDD自身の現行成果物へ必要図、既存参照、理由付き非該当または作成不能を適用した。Checkerは宣言したTemplate構造と各基本図行の退行を検出する。独立レビューと不足／影響確認はCritical／Major／Moderate 0で完了した。

## 2. 保持する意図と目指さないこと

| 区分 | 内容 |
|---|---|
| 保持する意図 | 工程間で正しい意図、保持条件、未解決事項および下位義務を引き継ぐ |
| 保持する意図 | 図から設計漏れ、試験不足、未接続経路および意味の不一致を実装・E2E前に検出する |
| 保持する意図 | Markdown単体で人間とAIが同じ意味を読み、Git差分で変更を確認できる |
| 目指さないこと | 全工程へDiscoveryまたはArchitectureの記法を流用する |
| 目指さないこと | 図の枚数、線の本数または形式充足だけを工程合格にする |
| 目指さないこと | 図を第二の正本、独立Databaseまたは新しい安定Context ID台帳にする |
| 目指さないこと | 単純な対象へ架空の状態、Actor、処理、時間または試験を作る |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Discovery/01_Product_Discovery.md`](<../../../01_Discovery/01_Product_Discovery.md>)
- [`01_Discovery/02_Product_Candidates.md`](<../../../01_Discovery/02_Product_Candidates.md>)
- `01_Discovery/02_Runtime_and_CROS_Product_Candidates.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000001/exploration.md`](<../../../01_Discovery/Analysis/EXP-000001/exploration.md>)
- [`01_Discovery/Analysis/EXP-000002/exploration.md`](<../../../01_Discovery/Analysis/EXP-000002/exploration.md>)
- `01_Discovery/Analysis/EXP-000002/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000003/exploration.md`](<../../../01_Discovery/Analysis/EXP-000003/exploration.md>)
- `01_Discovery/Analysis/EXP-000003/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000004/exploration.md`](<../../../01_Discovery/Analysis/EXP-000004/exploration.md>)
- `01_Discovery/Analysis/EXP-000004/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000005/exploration.md`](<../../../01_Discovery/Analysis/EXP-000005/exploration.md>)
- `01_Discovery/Analysis/EXP-000005/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000006/exploration.md`](<../../../01_Discovery/Analysis/EXP-000006/exploration.md>)
- `01_Discovery/Analysis/EXP-000006/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000007/exploration.md`](<../../../01_Discovery/Analysis/EXP-000007/exploration.md>)
- [`01_Discovery/Analysis/EXP-000008/exploration.md`](<../../../01_Discovery/Analysis/EXP-000008/exploration.md>)
- `01_Discovery/Analysis/EXP-000008/exploration.md`（削除または旧Path）
- `01_Discovery/Analysis/EXP-000009/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000009/exploration.md`](<../../../01_Discovery/Analysis/EXP-000009/exploration.md>)
- [`01_Discovery/Analysis/EXP-000010/exploration.md`](<../../../01_Discovery/Analysis/EXP-000010/exploration.md>)
- `01_Discovery/Analysis/EXP-000010/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000011/exploration.md`](<../../../01_Discovery/Analysis/EXP-000011/exploration.md>)
- `01_Discovery/Analysis/EXP-000011/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000012/exploration.md`](<../../../01_Discovery/Analysis/EXP-000012/exploration.md>)
- `01_Discovery/Analysis/EXP-000012/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000013/exploration.md`](<../../../01_Discovery/Analysis/EXP-000013/exploration.md>)
- `01_Discovery/Analysis/EXP-000013/exploration.md`（削除または旧Path）
- `01_Discovery/Analysis/EXP-000014/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000014/exploration.md`](<../../../01_Discovery/Analysis/EXP-000014/exploration.md>)
- [`01_Discovery/Analysis/EXP-000015/exploration.md`](<../../../01_Discovery/Analysis/EXP-000015/exploration.md>)
- `01_Discovery/Analysis/EXP-000015/exploration.md`（削除または旧Path）
- `01_Discovery/Analysis/EXP-000016/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000016/exploration.md`](<../../../01_Discovery/Analysis/EXP-000016/exploration.md>)
- `01_Discovery/Analysis/EXP-000017/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000017/exploration.md`](<../../../01_Discovery/Analysis/EXP-000017/exploration.md>)
- `01_Discovery/Analysis/EXP-000018/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000018/exploration.md`](<../../../01_Discovery/Analysis/EXP-000018/exploration.md>)
- `01_Discovery/Analysis/EXP-000019/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000019/exploration.md`](<../../../01_Discovery/Analysis/EXP-000019/exploration.md>)
- [`01_Discovery/Analysis/EXP-000020/exploration.md`](<../../../01_Discovery/Analysis/EXP-000020/exploration.md>)
- `01_Discovery/Analysis/EXP-000020/exploration.md`（削除または旧Path）
- `01_Discovery/Analysis/EXP-000021/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000021/exploration.md`](<../../../01_Discovery/Analysis/EXP-000021/exploration.md>)
- `01_Discovery/Analysis/EXP-000022/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000022/exploration.md`](<../../../01_Discovery/Analysis/EXP-000022/exploration.md>)
- `01_Discovery/Analysis/EXP-000023/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000023/exploration.md`](<../../../01_Discovery/Analysis/EXP-000023/exploration.md>)
- `01_Discovery/Analysis/EXP-000024/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000024/exploration.md`](<../../../01_Discovery/Analysis/EXP-000024/exploration.md>)
- `01_Discovery/Analysis/EXP-000025/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000025/exploration.md`](<../../../01_Discovery/Analysis/EXP-000025/exploration.md>)
- [`01_Discovery/Analysis/EXP-000026/exploration.md`](<../../../01_Discovery/Analysis/EXP-000026/exploration.md>)
- `01_Discovery/Analysis/EXP-000026/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000027/exploration.md`](<../../../01_Discovery/Analysis/EXP-000027/exploration.md>)
- `01_Discovery/Analysis/EXP-000027/exploration.md`（削除または旧Path）
- `01_Discovery/Analysis/EXP-000028/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000028/exploration.md`](<../../../01_Discovery/Analysis/EXP-000028/exploration.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`03_IA/01_Information_Architecture.md`](<../../../03_IA/01_Information_Architecture.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/Details/checker/01_Architecture.md`](<../../../06_Architecture/Details/checker/01_Architecture.md>)
- [`06_Architecture/Details/cros/01_Architecture.md`](<../../../06_Architecture/Details/cros/01_Architecture.md>)
- [`06_Architecture/Details/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/Details/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](<../../../06_Architecture/Details/project-operation/01_Architecture.md>)
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
- `40_Develop/version-control/scripts/generate-checker-runtime.ts`（削除または旧Path）
- `40_Develop/version-control/src/distribution/checker-version-control-runtime.ts` → [`40_Develop/version-control/src/git/checker-repository-observation-adapter.ts`](<../../../40_Develop/version-control/src/git/checker-repository-observation-adapter.ts>)
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
- `90_Release/Changes/CHG-000067_Project_Operation_Context.md`（削除または旧Path）
- `90_Release/Changes/CHG-000068_Phase_Diagram_and_Intent_Handoff.md`（削除または旧Path）
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
- [`99_Roadmap/Changes/CHG-000068/Evidence/260913_group-a-independent-review.md`](<../../../99_Roadmap/Changes/CHG-000068/Evidence/260913_group-a-independent-review.md>)
- [`99_Roadmap/Changes/CHG-000070/change.md`](<../../../99_Roadmap/Changes/CHG-000070/change.md>)
- [`99_Roadmap/Changes/CHG-000071/change.md`](<../../../99_Roadmap/Changes/CHG-000071/change.md>)
- [`99_Roadmap/Changes/CHG-000071/Evidence/260913-2335_signed-e2e.md`](<../../../99_Roadmap/Changes/CHG-000071/Evidence/260913-2335_signed-e2e.md>)
- [`99_Roadmap/Changes/CHG-000072/change.md`](<../../../99_Roadmap/Changes/CHG-000072/change.md>)
- [`README.md`](<../../../README.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- [`template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md`](<../../../template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md>)
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- [`template/06_Architecture/01_Architecture.md`](<../../../template/06_Architecture/01_Architecture.md>)
- [`template/99_Roadmap/Changes/CHG-XXXXXX/change.md`](<../../../template/99_Roadmap/Changes/CHG-XXXXXX/change.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- `template/tools/internal/version-control-runtime.ts` → [`40_Develop/version-control/src/git/checker-repository-observation-adapter.ts`](<../../../40_Develop/version-control/src/git/checker-repository-observation-adapter.ts>)

</details>

## 3. 変更する責務

```text
上位工程の意図・保持条件・未解決事項
                    |
                    v
          [工程入口: 図の処置判定]
                    |
                    v
       工程固有の図と正本情報を相互照合
                    |
          +---------+---------+
          |                   |
          v                   v
    設計要素へ接続       検証義務へ接続
          |                   |
          +---------+---------+
                    |
                    v
       [工程出口: 未処置・不一致 0]
                    |
                    v
     下位工程へ保持／変更／未解決を引渡し
```

| 対象 | 現在の弱点 | 目指す状態 |
|---|---|---|
| 工程正本 | 図の推奨はあっても必要性の判定と出口処置が工程ごとに不均一 | 基本図、発火／非発火、意味記法、正本境界、設計・検証接続を定義 |
| 固定入口Template | 文章や任意参照だけで図を省略できる | 基本図ごとの処置一覧と標準セクションを持つ |
| 工程移行 | 図の存在と意図の一致を分けて反証できない | 保持、承認済み変更、未解決、下位義務を対応づける |
| 品質保証 | 図で露出した分岐・境界・状態が検証項目へ届かないことがある | 設計要素、検証義務、検証項目または理由付き非該当へ接続する |
| Checker | 見出しやTemplate退行は検出できても必要図セクションの欠落を検出しない | 宣言した基本セクションと処置欄の構造的欠落を決定論的に検出する |

## 4. 工程別の基本図Profile

次は詳細記法の正本ではなく、各工程で具体化する責務範囲である。最終的な記法、発火条件および非該当条件は各工程正本が所有する。

| 工程 | 基本的に処置する図または関係表示 | 主に防ぐ不足 |
|---|---|---|
| Discovery | 課題・根拠・機会の関係、業務範囲／入出力、Actor別Process、Value Stream、As-Is／To-Be、項目間全体像 | 対象境界、根拠、Root Cause、Handoff、待機、変革意図の欠落 |
| UX | 利用前後を含むJourney、重要場面、Service Blueprint、失敗／回復体験 | 画面操作だけへの縮退、提供責務、裏側支援、回復体験の欠落 |
| IA | Object／Relation、情報階層、Navigation、可視性／状態概念 | Object重複、見つけられない情報、現在位置、関係・状態の混同 |
| UI／SPEC対応 | 操作・表示・System結果の対応、状態差および不一致 | UIだけの操作、SPECだけの状態、Feedback・Error・Recoveryの片側欠落 |
| UI | 論理画面／領域構成、画面・操作Flow、表示状態／Variant、主要Component関係 | 重要情報、代替操作、空・待機・失敗・権限差の表示漏れ |
| SPEC | Use Case／振る舞いFlow、状態遷移、Actor／System間Sequence、Error／Effect分岐 | 条件、例外、状態、Authority、Effect、結果の意味漏れ |
| Architecture | 全体／内部Block、状態遷移、Block間Sequence、Class／Type、DFD、ER図、Schema Responsibility Map | Owner、Boundary、Lifecycle、Data Flow、Entity Relation、Canonical Schema Owner、共通／固有責務、Consumer、Recoveryの未接続 |
| Implementation | Source／Package／Build BlockとArchitectureの対応、必要時の実装Sequence者向けLifecycle表示 | 実装所有者の漂流、設計にない経路、旧Capabilityの消失、試験対象漏れ |
| Verification | 検証義務と試験Level／Boundaryの対応、状態・分岐・Block別Coverage、結果から判断への接続 | 代表成功例への偏り、結合段階、利用側、失敗／回復、未評価範囲の欠落 |

## 5. 成果物の最小構造

各工程の固定入口は、少なくとも次を持つ。

1. 対象範囲、情報源改訂版および網羅状態。
2. 工程固有の基本図ごとの処置一覧。
3. 必要な図を置く標準セクション、または一意な参照。
4. 上位意図の保持、承認済み変更、未解決および下位義務の対応。
5. 図から導出した設計要素、検証義務または理由付き非該当。
6. 工程出口での現行性と未処置0の確認。

図を別ファイルへ分割するかは対象の規模と読みやすさで決める。ファイルを分けること自体を適用深度にせず、固定入口から現在の対象へ一意に到達できるようにする。

## 6. 検証と完了条件

| Gate | 完了条件 |
|---|---|
| 共通契約 | 文書化規則が意図引き渡し、図の処置、非該当、現行性および設計・検証接続を定義する |
| 工程正本 | DiscoveryからVerificationまで、各工程が基本図Profile、発火／非発火、記法および出口条件を持つ |
| Template | 各固定入口に処置一覧と基本図セクションがあり、空欄だけで工程を通過できない |
| 自己適用 | CRDD自身の現行工程成果物で、必要図または理由付き非該当と投影元を確認できる |
| 設計接続 | 図から判明した境界、状態、分岐、例外および未接続が設計要素へ反映される |
| 検証接続 | 同じ要素が検証義務、検証項目または理由付き非該当へ接続される |
| Checker | Templateと宣言構造の欠落を検出し、意味の妥当性を自動合格させない |
| 独立確認 | 文書監査と不足／影響監査が、重複正本、意図劣化および工程横断の未接続なしと確認する |

## 6.1. 実装・自己適用結果

| 対象 | 結果 | 残るGate |
|---|---|---|
| 工程正本 | UX、IA、UI／SPEC対応、UI、SPEC、Implementation、Verificationへ基本図Profileと凡例を追加。既存Discovery／Architectureの記法と責務を維持 | 独立確認 |
| Template | Discovery、UX、IA、UI、SPEC、Architecture、Verificationの固定入口で基本図を必ず処置する構造へ統一 | 独立確認 |
| CRDD自己適用 | 現行Discovery、UX、IA、UI、SPEC、Architecture、Verificationへ処置一覧を追加。未設計のWorkbench Componentは作成不能と再評価契機を明示 | Group BでWorkbenchをDiscoveryから再評価 |
| Implementation | `40_Develop`へ説明用Markdownを増やさず、Architecture BlockからSource／Package／Build／Test／Runtime入口へ接続する規則を追加 | 実装変更時の工程移行レビュー |
| Checker | Templateごとの必須図行を契約試験で確認し、旧Runtime Data Pathの検出対象を試験Consumerまで拡張 | 全体Checker、独立確認 |
| Runtime Data清掃 | 現在のworktreeで`.crdd/test-tmp`と`.crdd/test-fixtures`が存在せず、`.crdd/tmp/.operations`にOperation Recordが残っていないことを確認。試験Fixtureは`.crdd/tests/<execution-unit>/<run-id>`を使用し、自身の実行単位を終了時に清掃する | 旧Path非再生成回帰と現在状態の観測。過去の個別清掃手順は耐久Evidenceがないため完了根拠へ使用しない |

## 6.2. 独立確認結果

| 確認対象 | 結果 | 根拠 |
|---|---|---|
| 工程別基本図とDiscovery目的別投影 | Pass | 7工程の現行入口と7つのTemplate、工程規則、発火境界、正本境界および自己適用を確認 |
| Work Lifecycle履歴参照の移行前後 | Pass | 旧Pathのみ、新Pathのみ、併存、双方不存在、byte変更の5状態を直接反証 |
| 指摘件数 | Critical 0、Major 0、Moderate 0 | 前回Moderateは専用Fixture追加によりClosed |
| 機械確認 | Pass | 静的確認、Checker結合回帰311件、Repository全体Checker 440 Markdown／2,497 link／744 historical reference、error 0／warning 0 |

詳細結果は[独立レビューEvidence](./Evidence/260913_group-a-independent-review.md)を参照する。

## 7. 変更禁止範囲

- 各工程の決定権限、専門品質または既存の状態語を変更しない。
- Architectureの既存図記法とBlock／状態／Sequence／Class／DFD／ER図／Schema Responsibility Map／結合試験の正本を別文書へ複製しない。
- 図を作れない状態を`Not Applicable`へ畳まず、根拠不足と対象不存在を区別する。
- Checkerの見出し検出を、図の内容、意図一致または工程合格の証明に使わない。
- 上位図を下位工程へコピーして更新元を分岐させない。
