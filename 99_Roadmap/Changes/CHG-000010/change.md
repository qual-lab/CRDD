# 変更トレース（Change Trace）: 初回固定候補の収束性

変更ID: `CHG-000010`
状態（Status）: `Ready for Verification`
担当責任者: Qual-Lab
最終更新日: 2026-08-10
対象リリース: v0.16.0
変更分類: breaking
移行要否: true
正本規則: [12_Change.md](../../../12_Change.md)

## 1. 契機と変更意図

v0.13.0からv0.15.0までの実運用では、指摘後の是正と固定後根拠は強化された一方、条件付き規則の反例、変更していない利用側、移行記述または現在状態表示が最初の固定後監査で初めて見つかり、候補の固定と差替えを繰り返す場合があった。監査の削減やモデルの自己申告による軽量化ではなく、固定前に確認すべき母集団と反例を明示して初回候補の精度を上げる。

本変更は次を追加する。

1. 非自明な変更について、契約母集団と利用側母集団を編集前に識別する。
2. 条件付き規則について、発火、非発火、境界、情報不足の4種類を固定前に確認する。
3. 概念定義、発火条件、判定不能時の扱い、発火後の処置または正式結果を分離する。
4. 予定した母集団と代表例を実差分、変更していない利用側および現在状態投影へ全数照合してから候補を固定する。
5. 初回独立確認が同じ4種類を再構成する。
6. 公式CHANGELOGの現行英日リリース節と、移行要否がtrueの場合の区分欠落を任意Checkerで検出する。

## 2. 人間による判断

Qual-Labの人間の決定権限者は、次の境界でv0.16.0候補の実装開始を指示した。

- シャドウ運用、項目ホワイトリスト、抜き取り監査またはモデル評価に依存する軽量路を採用しない。
- 現在必要な独立レビュー、専門確認または監査を減らさない。
- どのモデルでも同じ入力から確認できる母集団、反例および実差分を使い、一つ目の固定候補での収束確率を上げる。
- v0.15.0とv0.16.0のリリース判断は、候補修正と固定後確認が落ち着いた後に人間が行う。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`.gitattributes`](<../../../.gitattributes>)
- [`.github/copilot-instructions.md`](<../../../.github/copilot-instructions.md>)
- [`.github/pull_request_template.md`](<../../../.github/pull_request_template.md>)
- [`00_Overview.md`](<../../../00_Overview.md>)
- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Principles.md`](<../../../01_Principles.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`03_IA/01_Information_Architecture.md`](<../../../03_IA/01_Information_Architecture.md>)
- [`04_Agent_Organization.md`](<../../../04_Agent_Organization.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/Details/checker/01_Architecture.md`](<../../../06_Architecture/Details/checker/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](<../../../06_Architecture/Details/platform-access/01_Architecture.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/02_Quality_Strategy.md`](<../../../07_Quality/02_Quality_Strategy.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/04_Test_Catalog.json`](<../../../07_Quality/04_Test_Catalog.json>)
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Verification.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md`（削除または旧Path）
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
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`28_Implementation.md`](<../../../28_Implementation.md>)
- [`29_Verification.md`](<../../../29_Verification.md>)
- [`40_Develop/checker/.gitignore`](<../../../40_Develop/checker/.gitignore>)
- `40_Develop/checker/crdd-check.contract.test.ts`（削除または旧Path）
- [`40_Develop/checker/crdd-check.ts`](<../../../40_Develop/checker/crdd-check.ts>)
- [`40_Develop/checker/fault-injector.ts`](<../../../40_Develop/checker/fault-injector.ts>)
- [`40_Develop/checker/package-lock.json`](<../../../40_Develop/checker/package-lock.json>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/checker/regression-runner.ts`](<../../../40_Develop/checker/regression-runner.ts>)
- [`40_Develop/checker/test-catalog.ts`](<../../../40_Develop/checker/test-catalog.ts>)
- [`40_Develop/checker/test-discovery.ts`](<../../../40_Develop/checker/test-discovery.ts>)
- [`40_Develop/checker/test-runner.ts`](<../../../40_Develop/checker/test-runner.ts>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/checker/tests/integration/regression-runner.contract.test.ts`](<../../../40_Develop/checker/tests/integration/regression-runner.contract.test.ts>)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](<../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts>)
- [`40_Develop/checker/tests/unit/test-catalog.contract.test.ts`](<../../../40_Develop/checker/tests/unit/test-catalog.contract.test.ts>)
- `40_Develop/checker/tools-naming.contract.test.ts`（削除または旧Path）
- [`40_Develop/checker/tsconfig.json`](<../../../40_Develop/checker/tsconfig.json>)
- [`40_Develop/coordinator/.gitignore`](<../../../40_Develop/coordinator/.gitignore>)
- [`40_Develop/coordinator/bin/coordinator.ts`](<../../../40_Develop/coordinator/bin/coordinator.ts>)
- [`40_Develop/coordinator/package-lock.json`](<../../../40_Develop/coordinator/package-lock.json>)
- [`40_Develop/coordinator/package.json`](<../../../40_Develop/coordinator/package.json>)
- `40_Develop/coordinator/policies/windows-docker-desktop-4.41.2.policy`（削除または旧Path）
- [`40_Develop/coordinator/runtime/claude-managed-settings.json`](<../../../40_Develop/coordinator/runtime/claude-managed-settings.json>)
- [`40_Develop/coordinator/runtime/claude-provider.Dockerfile`](<../../../40_Develop/coordinator/runtime/claude-provider.Dockerfile>)
- [`40_Develop/coordinator/runtime/claude-task-settings.json`](<../../../40_Develop/coordinator/runtime/claude-task-settings.json>)
- [`40_Develop/coordinator/runtime/codex-executor-result-schema.json`](<../../../40_Develop/coordinator/runtime/codex-executor-result-schema.json>)
- [`40_Develop/coordinator/runtime/codex-provider.Dockerfile`](<../../../40_Develop/coordinator/runtime/codex-provider.Dockerfile>)
- [`40_Develop/coordinator/runtime/codex-result-schema.json`](<../../../40_Develop/coordinator/runtime/codex-result-schema.json>)
- [`40_Develop/coordinator/runtime/codex-reviewer-result-schema.json`](<../../../40_Develop/coordinator/runtime/codex-reviewer-result-schema.json>)
- `40_Develop/coordinator/runtime/coordinator-runtime-traceability.json`（削除または旧Path）
- [`40_Develop/coordinator/runtime/general-task-verification.txt`](<../../../40_Develop/coordinator/runtime/general-task-verification.txt>)
- `40_Develop/coordinator/runtime/project-runtime-design-traceability.json`（削除または旧Path）
- [`40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile`](<../../../40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile>)
- [`40_Develop/coordinator/runtime/provider-egress-proxy.py`](<../../../40_Develop/coordinator/runtime/provider-egress-proxy.py>)
- `40_Develop/coordinator/scripts/build-native-bootstrap.ts`（削除または旧Path）
- [`40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts>)
- `40_Develop/coordinator/scripts/check-native-bootstrap-pe.ts`（削除または旧Path）
- [`40_Develop/coordinator/scripts/check-native-runtime-trace.ts`](<../../../40_Develop/coordinator/scripts/check-native-runtime-trace.ts>)
- [`40_Develop/coordinator/scripts/check-platform-access-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-platform-access-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts>)
- [`40_Develop/coordinator/scripts/check-provider-authority-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-provider-authority-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-provider-home-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-provider-home-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-runtime-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-runtime-traceability.ts>)
- [`40_Develop/coordinator/scripts/generate-release-key.ts`](<../../../40_Develop/coordinator/scripts/generate-release-key.ts>)
- [`40_Develop/coordinator/scripts/measure-development-providers.ts`](<../../../40_Develop/coordinator/scripts/measure-development-providers.ts>)
- [`40_Develop/coordinator/scripts/platform-access-coverage-path.ts`](<../../../40_Develop/coordinator/scripts/platform-access-coverage-path.ts>)
- [`40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts`](<../../../40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts>)
- [`40_Develop/coordinator/scripts/promote-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/promote-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/release-staging-manifest.ts`](<../../../40_Develop/coordinator/scripts/release-staging-manifest.ts>)
- [`40_Develop/coordinator/scripts/revoke-external-send-consent.ts`](<../../../40_Develop/coordinator/scripts/revoke-external-send-consent.ts>)
- [`40_Develop/coordinator/scripts/sign-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/sign-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts`](<../../../40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts>)
- [`40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts`](<../../../40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts>)
- [`40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts`](<../../../40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-general-task.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-general-task.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-route-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-route-matrix.ts>)
- [`40_Develop/coordinator/src/core/cli-options.ts`](<../../../40_Develop/coordinator/src/core/cli-options.ts>)
- [`40_Develop/coordinator/src/core/command-report.ts`](<../../../40_Develop/coordinator/src/core/command-report.ts>)
- [`40_Develop/coordinator/src/core/development-execution-timing.ts`](<../../../40_Develop/coordinator/src/core/development-execution-timing.ts>)
- [`40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts`](<../../../40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts>)
- [`40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts`](<../../../40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts>)
- [`40_Develop/coordinator/src/core/docker-recovery-command-report.ts`](<../../../40_Develop/coordinator/src/core/docker-recovery-command-report.ts>)
- [`40_Develop/coordinator/src/core/doctor.ts`](<../../../40_Develop/coordinator/src/core/doctor.ts>)
- [`40_Develop/coordinator/src/core/host-generation-loss-transition.ts`](<../../../40_Develop/coordinator/src/core/host-generation-loss-transition.ts>)
- [`40_Develop/coordinator/src/core/interactive-console-reader.ts`](<../../../40_Develop/coordinator/src/core/interactive-console-reader.ts>)
- [`40_Develop/coordinator/src/core/interactive-console.ts`](<../../../40_Develop/coordinator/src/core/interactive-console.ts>)
- [`40_Develop/coordinator/src/core/node-runtime-version.ts`](<../../../40_Develop/coordinator/src/core/node-runtime-version.ts>)
- [`40_Develop/coordinator/src/core/project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/src/core/project-runtime-design-traceability.ts>)
- [`40_Develop/coordinator/src/core/runtime-process-safety-state.ts`](<../../../40_Develop/coordinator/src/core/runtime-process-safety-state.ts>)
- [`40_Develop/coordinator/src/core/runtime-traceability.ts`](<../../../40_Develop/coordinator/src/core/runtime-traceability.ts>)
- [`40_Develop/coordinator/src/core/task-cli-cancellation.ts`](<../../../40_Develop/coordinator/src/core/task-cli-cancellation.ts>)
- [`40_Develop/coordinator/src/core/windows-child-environment.ts`](<../../../40_Develop/coordinator/src/core/windows-child-environment.ts>)
- [`40_Develop/coordinator/src/security/authority-file-bundle.ts`](<../../../40_Develop/coordinator/src/security/authority-file-bundle.ts>)
- [`40_Develop/coordinator/src/security/authority-grant-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-grant-verifier.ts>)
- [`40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts>)
- `40_Develop/coordinator/src/security/authority-root-locator.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/authority-root-path-lexical.ts`](<../../../40_Develop/coordinator/src/security/authority-root-path-lexical.ts>)
- `40_Develop/coordinator/src/security/authority-root-profile.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/authority-trust-loader.ts`](<../../../40_Develop/coordinator/src/security/authority-trust-loader.ts>)
- [`40_Develop/coordinator/src/security/bounded-file-snapshot.ts`](<../../../40_Develop/coordinator/src/security/bounded-file-snapshot.ts>)
- [`40_Develop/coordinator/src/security/candidate-bundle-store.ts`](<../../../40_Develop/coordinator/src/security/candidate-bundle-store.ts>)
- [`40_Develop/coordinator/src/security/candidate-store-kernel-lock.ts`](<../../../40_Develop/coordinator/src/security/candidate-store-kernel-lock.ts>)
- [`40_Develop/coordinator/src/security/candidate-store-lock-worker.ts`](<../../../40_Develop/coordinator/src/security/candidate-store-lock-worker.ts>)
- [`40_Develop/coordinator/src/security/candidate-store-windows-adapter.ts`](<../../../40_Develop/coordinator/src/security/candidate-store-windows-adapter.ts>)
- [`40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/claude-execution-plan.ts`](<../../../40_Develop/coordinator/src/security/claude-execution-plan.ts>)
- [`40_Develop/coordinator/src/security/claude-structured-result.ts`](<../../../40_Develop/coordinator/src/security/claude-structured-result.ts>)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/codex-execution-plan.ts`](<../../../40_Develop/coordinator/src/security/codex-execution-plan.ts>)
- [`40_Develop/coordinator/src/security/codex-structured-result.ts`](<../../../40_Develop/coordinator/src/security/codex-structured-result.ts>)
- [`40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts`](<../../../40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts>)
- [`40_Develop/coordinator/src/security/coordinator-task-request.ts`](<../../../40_Develop/coordinator/src/security/coordinator-task-request.ts>)
- [`40_Develop/coordinator/src/security/coordinator-task-runtime.ts`](<../../../40_Develop/coordinator/src/security/coordinator-task-runtime.ts>)
- [`40_Develop/coordinator/src/security/delegation-route-selection.ts`](<../../../40_Develop/coordinator/src/security/delegation-route-selection.ts>)
- [`40_Develop/coordinator/src/security/delegation-selection-grant-runtime.ts`](<../../../40_Develop/coordinator/src/security/delegation-selection-grant-runtime.ts>)
- [`40_Develop/coordinator/src/security/development-measurement-constraints.ts`](<../../../40_Develop/coordinator/src/security/development-measurement-constraints.ts>)
- [`40_Develop/coordinator/src/security/development-measurement-session.ts`](<../../../40_Develop/coordinator/src/security/development-measurement-session.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts>)
- `40_Develop/coordinator/src/security/docker-desktop-repair-policy.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts>)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-host-transition-state.ts`](<../../../40_Develop/coordinator/src/security/docker-host-transition-state.ts>)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](<../../../40_Develop/coordinator/src/security/docker-isolation.ts>)
- [`40_Develop/coordinator/src/security/docker-owned-process.ts`](<../../../40_Develop/coordinator/src/security/docker-owned-process.ts>)
- [`40_Develop/coordinator/src/security/docker-process-controller.ts`](<../../../40_Develop/coordinator/src/security/docker-process-controller.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-identity.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-identity.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-journal.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-journal.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-lock-controller.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-lock-controller.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-public-projection.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-public-projection.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-state-machine.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-state-machine.ts>)
- [`40_Develop/coordinator/src/security/docker-runtime-state-binding.ts`](<../../../40_Develop/coordinator/src/security/docker-runtime-state-binding.ts>)
- [`40_Develop/coordinator/src/security/egress-proxy-policy.ts`](<../../../40_Develop/coordinator/src/security/egress-proxy-policy.ts>)
- `40_Develop/coordinator/src/security/enrollment-certificate-renewal.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/execution-environment.ts`](<../../../40_Develop/coordinator/src/security/execution-environment.ts>)
- [`40_Develop/coordinator/src/security/external-send-consent-record.ts`](<../../../40_Develop/coordinator/src/security/external-send-consent-record.ts>)
- [`40_Develop/coordinator/src/security/external-send-consent-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-consent-runtime.ts>)
- [`40_Develop/coordinator/src/security/external-send-grant-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-grant-runtime.ts>)
- [`40_Develop/coordinator/src/security/external-send-policy-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-policy-runtime.ts>)
- `40_Develop/coordinator/src/security/git-local-exclude.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/git-object-reader.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/host-operation-lock-supervisor.ts`](<../../../40_Develop/coordinator/src/security/host-operation-lock-supervisor.ts>)
- [`40_Develop/coordinator/src/security/host-recovery-record.ts`](<../../../40_Develop/coordinator/src/security/host-recovery-record.ts>)
- `40_Develop/coordinator/src/security/initial-enrollment-pure-core.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/initial-enrollment-runtime-state.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/local-personal-authority-runtime.ts`](<../../../40_Develop/coordinator/src/security/local-personal-authority-runtime.ts>)
- `40_Develop/coordinator/src/security/mcp-project-runtime-adapter.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/mcp-project-runtime-stdio.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/native-bootstrap-pe-inspector.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/native-provision-supervisor-release.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/native-runtime-trace.ts`](<../../../40_Develop/coordinator/src/security/native-runtime-trace.ts>)
- `40_Develop/coordinator/src/security/offline-enrollment-bundle-pure-core.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/plain-data-snapshot.ts`](<../../../40_Develop/coordinator/src/security/plain-data-snapshot.ts>)
- [`40_Develop/coordinator/src/security/platform-access-adapter.ts`](<../../../40_Develop/coordinator/src/security/platform-access-adapter.ts>)
- [`40_Develop/coordinator/src/security/platform-access-release.ts`](<../../../40_Develop/coordinator/src/security/platform-access-release.ts>)
- [`40_Develop/coordinator/src/security/platform-key-storage-policy.ts`](<../../../40_Develop/coordinator/src/security/platform-key-storage-policy.ts>)
- `40_Develop/coordinator/src/security/platform-provisioner-active-pointer-store.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/platform-provisioner-active-pointer.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/platform-provisioner-effect.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/platform-provisioner-install-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-gate.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-gate.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-policy-identity.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-policy-identity.ts>)
- `40_Develop/coordinator/src/security/platform-provisioner-pre-active-one-shot.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-release-trust.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-release-trust.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts>)
- `40_Develop/coordinator/src/security/platform-provisioner-windows-dacl.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts>)
- `40_Develop/coordinator/src/security/project-runtime-execution.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-human-decision.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-objective-intake.ts>)
- `40_Develop/coordinator/src/security/project-runtime-objective-request.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-public-runtime.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-replanning.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts>)
- `40_Develop/coordinator/src/security/project-runtime-state.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts>)
- [`40_Develop/coordinator/src/security/provider-authority-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-authority-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-billing-policy.ts`](<../../../40_Develop/coordinator/src/security/provider-billing-policy.ts>)
- [`40_Develop/coordinator/src/security/provider-eligibility-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-eligibility-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-home-mount-grant-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-home-mount-grant-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-home-mount-grant.ts`](<../../../40_Develop/coordinator/src/security/provider-home-mount-grant.ts>)
- [`40_Develop/coordinator/src/security/provider-home-observation.ts`](<../../../40_Develop/coordinator/src/security/provider-home-observation.ts>)
- [`40_Develop/coordinator/src/security/provider-home-windows-adapter.ts`](<../../../40_Develop/coordinator/src/security/provider-home-windows-adapter.ts>)
- [`40_Develop/coordinator/src/security/provider-home.ts`](<../../../40_Develop/coordinator/src/security/provider-home.ts>)
- [`40_Develop/coordinator/src/security/provider-isolation-profile.ts`](<../../../40_Develop/coordinator/src/security/provider-isolation-profile.ts>)
- [`40_Develop/coordinator/src/security/provider-lifecycle.ts`](<../../../40_Develop/coordinator/src/security/provider-lifecycle.ts>)
- [`40_Develop/coordinator/src/security/provider-model-profile-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-model-profile-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-model-selection-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-model-selection-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-task-packet-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-task-packet-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-task-structured-result.ts`](<../../../40_Develop/coordinator/src/security/provider-task-structured-result.ts>)
- `40_Develop/coordinator/src/security/provisioning-ca-pure-core.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-record-enrollment-binding.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-record-pure-core.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-record-store.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/provisioning-signature-primitives.ts`](<../../../40_Develop/coordinator/src/security/provisioning-signature-primitives.ts>)
- `40_Develop/coordinator/src/security/provisioning-trust-artifact-store.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-trust-floor-store.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-trust-floor.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/release-identity-grammar.ts`](<../../../40_Develop/coordinator/src/security/release-identity-grammar.ts>)
- `40_Develop/coordinator/src/security/repository-git-layout-internal.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-operation-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-operation-runtime.ts>)
- `40_Develop/coordinator/src/security/repository-root-resolution.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-workspace-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-workspace-runtime.ts>)
- [`40_Develop/coordinator/src/security/root-observation.ts`](<../../../40_Develop/coordinator/src/security/root-observation.ts>)
- [`40_Develop/coordinator/src/security/root-protection-policy.ts`](<../../../40_Develop/coordinator/src/security/root-protection-policy.ts>)
- `40_Develop/coordinator/src/security/runtime-activation-identity.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-locator-binding-contract.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-locator-binding.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-record.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-transition.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-root-path-identity.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-root-profile.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/secret-material-policy.ts`](<../../../40_Develop/coordinator/src/security/secret-material-policy.ts>)
- [`40_Develop/coordinator/src/security/signed-runner-safety-observation.ts`](<../../../40_Develop/coordinator/src/security/signed-runner-safety-observation.ts>)
- `40_Develop/coordinator/tests/authority-file-bundle.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-grant-verifier.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-prelaunch-verifier.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-root-locator.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-root-path-lexical.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-root-profile.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-trust-loader.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/bounded-file-snapshot.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/candidate-bundle-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/candidate-store-kernel-lock.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/candidate-store-windows-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/claude-docker-runtime-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/claude-execution-plan.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/claude-structured-result.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/cli-options.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/codex-docker-runtime-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/codex-execution-plan.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/codex-structured-result.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/command-report.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-claude-delegation.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-docker-recovery-cli.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-operation-creation-internal.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-task-process.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-task-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/delegation-route-selection.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/delegation-selection-grant-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-execution-timing.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-measurement-constraints.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-measurement-session.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-native-observation.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-provider-measurement.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-cleanup-eligibility.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-desktop-repair-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-desktop-repair-record-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-desktop-runtime-repair.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-effect-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-host-transition-state.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-process-controller.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-journal.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-lock-controller.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-public-projection.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-state-machine.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-runtime-state-binding.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/doctor.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/dynamic-fake-provider-cancellation-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/dynamic-fake-provider-failure-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/egress-proxy-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/enrollment-certificate-renewal.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-consent-docker-recovery.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-consent-revocation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-consent-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-grant-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-policy-runtime.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/fixtures/candidate-store-lock-owner.ts`](<../../../40_Develop/coordinator/tests/fixtures/candidate-store-lock-owner.ts>)
- [`40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json`](<../../../40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json>)
- [`40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts`](<../../../40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts>)
- [`40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts`](<../../../40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts>)
- [`40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts`](<../../../40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts>)
- [`40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/windows-native-helper-environment-unavailable.ts`](<../../../40_Develop/coordinator/tests/fixtures/windows-native-helper-environment-unavailable.ts>)
- [`40_Develop/coordinator/tests/fixtures/windows-native-helper-profile-fault.ts`](<../../../40_Develop/coordinator/tests/fixtures/windows-native-helper-profile-fault.ts>)
- `40_Develop/coordinator/tests/generate-release-key.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/git-local-exclude.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/git-object-reader.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/git-object-reader.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/host-generation-loss-transition.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/initial-enrollment-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/initial-enrollment-runtime-state.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/cli-options.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/cli-options.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts>)
- `40_Develop/coordinator/tests/integration/docker-desktop-repair-policy.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts>)
- `40_Develop/coordinator/tests/integration/project-runtime-public-runtime.integration.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts>)
- `40_Develop/coordinator/tests/interaction-boundary-regression.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/local-personal-authority-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-build.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-pe-fixture.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-pe-inspector.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-pe-runner.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-provision-supervisor-release.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-runtime-trace.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/node-runtime-version.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/offline-enrollment-bundle-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/plain-data-snapshot.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-release.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-ts-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-key-storage-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-active-pointer-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-active-pointer.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-effect.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-install-layout.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-manifest-loader.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-package-filesystem.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-package-gate.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-policy-identity.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-pre-active-one-shot.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-release-identity.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-release-trust.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-trust-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-windows-dacl.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-authority-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-authority-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-billing-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-eligibility-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-mount-grant-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-mount-grant.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-observation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-isolation-profile.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-lifecycle.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-model-profile-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-model-selection-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-task-packet-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-task-structured-result.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-ca-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-record-enrollment-binding.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-record-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-record-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-signature-primitives.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-trust-artifact-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-trust-floor-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-trust-floor.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/release-identity-grammar.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-git-layout.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-operation-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-root-resolution.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-workspace-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/root-observation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/root-protection-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-activation-locator-binding.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-activation-record.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-activation-transition.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-process-safety-state.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-root-path-identity.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-root-profile.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-trace-case.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-trace-case.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-traceability.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/secret-material-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/sign-release-manifest.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-general-task-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-recovery-matrix-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-route-matrix-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-runner-safety-observation.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/support/helpers/docker-desktop-repair-history-publication-testing.ts`](<../../../40_Develop/coordinator/tests/support/helpers/docker-desktop-repair-history-publication-testing.ts>)
- [`40_Develop/coordinator/tests/support/runtime-trace-case.ts`](<../../../40_Develop/coordinator/tests/support/runtime-trace-case.ts>)
- [`40_Develop/coordinator/tests/support/test-support.ts`](<../../../40_Develop/coordinator/tests/support/test-support.ts>)
- [`40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts`](<../../../40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts>)
- [`40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts>)
- `40_Develop/coordinator/tests/system/mcp-project-runtime-stdio.integration.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts>)
- `40_Develop/coordinator/tests/task-cli-cancellation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/test-support.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/command-report.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/command-report.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/doctor.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/doctor.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts>)
- `40_Develop/coordinator/tests/unit/mcp-project-runtime-adapter.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts>)
- `40_Develop/coordinator/tests/unit/project-runtime-platform-contract.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/unit/project-runtime-state.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/root-observation.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/root-observation.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts>)
- [`40_Develop/coordinator/tsconfig.strict.json`](<../../../40_Develop/coordinator/tsconfig.strict.json>)
- [`40_Develop/coordinator/tsconfig.tests.json`](<../../../40_Develop/coordinator/tsconfig.tests.json>)
- [`40_Develop/platform-access/.gitignore`](<../../../40_Develop/platform-access/.gitignore>)
- [`40_Develop/platform-access/build.rs`](<../../../40_Develop/platform-access/build.rs>)
- [`40_Develop/platform-access/Cargo.lock`](<../../../40_Develop/platform-access/Cargo.lock>)
- [`40_Develop/platform-access/Cargo.toml`](<../../../40_Develop/platform-access/Cargo.toml>)
- [`40_Develop/platform-access/rust-toolchain.toml`](<../../../40_Develop/platform-access/rust-toolchain.toml>)
- `40_Develop/platform-access/src/bin/coordinator.rs`（削除または旧Path）
- [`40_Develop/platform-access/src/docker_repair.rs`](<../../../40_Develop/platform-access/src/docker_repair.rs>)
- [`40_Develop/platform-access/src/main.rs`](<../../../40_Develop/platform-access/src/main.rs>)
- `40_Develop/platform-access/src/native_bootstrap_core.rs`（削除または旧Path）
- [`40_Develop/platform-access/src/protocol.rs`](<../../../40_Develop/platform-access/src/protocol.rs>)
- [`40_Develop/platform-access/src/windows.rs`](<../../../40_Develop/platform-access/src/windows.rs>)
- [`40_Develop/platform-access/tests/cli.rs`](<../../../40_Develop/platform-access/tests/cli.rs>)
- `40_Develop/platform-access/tests/native_bootstrap_core.rs`（削除または旧Path）
- [`51_Document_Audit.md`](<../../../51_Document_Audit.md>)
- [`52_Conformance_Audit.md`](<../../../52_Conformance_Audit.md>)
- [`53_Gap_Impact_Audit.md`](<../../../53_Gap_Impact_Audit.md>)
- `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md`（削除または旧Path）
- `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md`（削除または旧Path）
- `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md`（削除または旧Path）
- `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000010_First_Pass_Convergence.md`（削除または旧Path）
- `90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md`（削除または旧Path）
- `90_Release/Changes/CHG-000016_Internal_TypeScript_Migration.md`（削除または旧Path）
- `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md`（削除または旧Path）
- `90_Release/Changes/CHG-000054_Agent_Organization_Document_Architecture.md`（削除または旧Path）
- `90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md`（削除または旧Path）
- `90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md`（削除または旧Path）
- `90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000010_Checker_Run_3b26d56.json`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000010_Checker_Run_dbe718c.json`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000010_Test_Run_3b26d56.tap`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000010_Test_Run_dbe718c.tap`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000010_Verification_Run_Record_3b26d56.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000010_Verification_Run_Record_dbe718c.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000010/change.md`](<../../../99_Roadmap/Changes/CHG-000010/change.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`biome.json`](<../../../biome.json>)
- [`CHANGELOG.md`](<../../../CHANGELOG.md>)
- [`CONTRIBUTING.md`](<../../../CONTRIBUTING.md>)
- [`README.md`](<../../../README.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- [`template/03_IA/01_Information_Architecture.md`](<../../../template/03_IA/01_Information_Architecture.md>)
- [`template/04_UI/01_User_Interface.md`](<../../../template/04_UI/01_User_Interface.md>)
- [`template/05_SPEC/01_Behavior_Specification.md`](<../../../template/05_SPEC/01_Behavior_Specification.md>)
- [`template/06_Architecture/01_Architecture.md`](<../../../template/06_Architecture/01_Architecture.md>)
- [`template/07_Quality/01_Quality_Center.md`](<../../../template/07_Quality/01_Quality_Center.md>)
- [`template/07_Quality/02_Quality_Strategy.md`](<../../../template/07_Quality/02_Quality_Strategy.md>)
- [`template/07_Quality/03_Verification_Design.md`](<../../../template/07_Quality/03_Verification_Design.md>)
- `template/90_Release/Changes/CHG-XXXXXX_Template.md`（削除または旧Path）
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- `template/tools/crdd_check.mjs`（削除または旧Path）
- `template/tools/crdd_check.ts`（削除または旧Path）
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- `tools/checker/.gitignore`（削除または旧Path）
- `tools/checker/crdd_check.test.ts`（削除または旧Path）
- `tools/checker/crdd_check.ts`（削除または旧Path）
- `tools/checker/crdd-check.contract.test.ts`（削除または旧Path）
- `tools/checker/crdd-check.ts`（削除または旧Path）
- `tools/checker/fault-injector.ts`（削除または旧Path）
- `tools/checker/package-lock.json`（削除または旧Path）
- `tools/checker/package.json`（削除または旧Path）
- `tools/checker/tools-naming.contract.test.ts`（削除または旧Path）
- `tools/checker/tsconfig.json`（削除または旧Path）
- `tools/coding-standards.md`（削除または旧Path）
- `tools/coordinator/architecture/README.md`（削除または旧Path）
- `tools/coordinator/bin/coordinator.ts`（削除または旧Path）
- `tools/coordinator/package.json`（削除または旧Path）
- `tools/coordinator/README.md`（削除または旧Path）
- `tools/coordinator/src/core/cli-options.ts`（削除または旧Path）
- `tools/coordinator/src/core/command-report.ts`（削除または旧Path）
- `tools/coordinator/src/core/doctor.ts`（削除または旧Path）
- `tools/coordinator/src/security/authority-grant-verifier.ts`（削除または旧Path）
- `tools/coordinator/src/security/authority-root-locator.ts`（削除または旧Path）
- `tools/coordinator/src/security/coordinator-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-isolation.ts`（削除または旧Path）
- `tools/coordinator/src/security/egress-proxy-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/execution-environment.ts`（削除または旧Path）
- `tools/coordinator/src/security/host-recovery-record.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-runtime-state.ts`（削除または旧Path）
- `tools/coordinator/src/security/plain-data-snapshot.ts`（削除または旧Path）
- `tools/coordinator/src/security/platform-key-storage-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-ca-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-enrollment-binding.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-signature-primitives.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout-internal.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-activation-locator-binding.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-activation-transition.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-root-path-identity.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-file-bundle.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-grant-verifier.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-prelaunch-verifier.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-root-locator.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-root-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-trust-loader.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/cli-options.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/command-report.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/coordinator-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/doctor.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/egress-proxy-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/enrollment-certificate-renewal.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/git-local-exclude.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/initial-enrollment-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/initial-enrollment-runtime-state.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/offline-enrollment-bundle-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/plain-data-snapshot.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-key-storage-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-provisioner-package-gate.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-provisioner-trust-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-authority-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-isolation-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-ca-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-record-enrollment-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-record-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-signature-primitives.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/repository-git-layout.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/root-protection-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-locator-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-record.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-transition.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-root-path-identity.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-root-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/THREAT_MODEL.md`（削除または旧Path）
- `tools/coordinator/threat-model.md`（削除または旧Path）
- `tools/coordinator/tsconfig.typecheck.json`（削除または旧Path）
- `tools/crdd_check_fault_injector.ts`（削除または旧Path）
- `tools/crdd_check.test.mjs`（削除または旧Path）
- `tools/crdd_check.test.ts`（削除または旧Path）
- `tools/crdd_check.ts`（削除または旧Path）
- `tools/tsconfig.checker.json`（削除または旧Path）

</details>

## 3. 想定する影響

- 正本: `00_Overview.md`、`02_Terminology.md`、`10_Agent.md`、`16_Quality_Assurance.md`、`19_Maintenance.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`
- AI入口: `AGENTS.md`、`template/AGENTS.md`
- ひな型: `template/90_Release/Changes/CHG-XXXXXX_Template.md`
- 任意Checker（当時）: `template/tools/crdd_check.ts`、`tools/crdd_check.test.ts`。現在の配布正本は[`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)、現在の試験移設先は[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- 公開保守入口、案内と移行: `CONTRIBUTING.md`、`README.md`、`CHANGELOG.md`
- 版表示: 26正本文書
- 準拠影響: 条件規範を品質保証で扱う場合はPL-16、非自明なAI変更ではAD-02、条件規範を変更した対象の初回独立確認ではAD-21を再評価する。Core、Product LifecycleまたはAgentic Deliveryの基準数、工程順、成果物構造、安定コンテキストIDは変更しない。

## 4. 対象外と変更禁止

- 新しい監査、承認段階、恒久成果物、準拠プロファイル、安定コンテキストIDまたは外部QAツールを追加しない。
- 記録限定経路、ホワイトリスト、シャドウ運用、抜き取り承認またはモデル能力による監査削減を導入しない。
- 既存の独立確認、監査集合、専門品質確認、人間の決定権限を弱めない。
- v0.15.0のCommunication／Context Dependency契約または過去CHANGELOGを書き換えない。
- `CRDD_Introduction.pptx`は本変更の固定対象へ含めない。

## 5. 固定前の収束確認

### 5.1. 契約母集団

| 契約対象 | 予定処置 |
|---|---|
| 変更経路の選択と非自明性 | 自己申告や行数ではなく、変更対象、条件付き規則、利用側および移行への影響から判断する |
| 着手前整合確認 | 契約母集団、利用側母集団、4種類の代表例を保持する |
| 変更実行契約 | 固定前に予定と実差分を全数照合し、不一致を未解消のまま固定しない |
| 検証設計 | 条件付き規則を4種類の例で確認可能にする |
| 初回独立確認と監査 | 同じ例と利用側を再構成し、意味と伝播を確認する |
| 任意Checker | 現行英日CHANGELOGと移行注記の決定論的な区分欠落だけを検出する |

### 5.2. 利用側母集団

| 利用側 | 予定処置 |
|---|---|
| 公式AI入口 | 着手前の母集団、4例、固定前照合を案内する |
| 配布AI入口 | 採用先でも同じ境界を案内する |
| 変更トレースひな型 | 非自明な変更だけで軽量に取得できる節を追加する |
| 準拠基準PL-16／AD-02／AD-21 | 検証設計、編集前計画と固定前照合、初回独立再構成へ責務を分けて接続する |
| 公開保守入口 | 採用済み変更の実行時だけ`10_Agent`／`19_Maintenance`へ接続し、Issue受付の外部提案者へ代表例等を常時要求しない |
| README英日 | 監査削減ではない目的と運用を同じ意味で案内する |
| CHANGELOG英日 | breaking、移行、復旧、延期時リスク、検証、限界を取得可能にする |
| 26正本文書 | v0.16.0の版表示へ揃える。意味変更のない文書は内容更新日を変えない |

### 5.3. 固定前の実差分照合結果

| 利用側または変更群 | 実際の処置 |
|---|---|
| `00_Overview.md` | 人間向け経路要約に限定し、非自明／軽微の操作条件を`10_Agent.md`へ委譲した |
| `02_Terminology.md` | 契約母集団／利用側母集団を、一般の非自明変更と複数箇所是正の両方へ接続した |
| `10_Agent.md`、`16_Quality_Assurance.md`、`19_Maintenance.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md` | 単一正本、検証可能性、固定前照合、初回独立再構成、監査観点を責務別に更新した |
| root／template `AGENTS.md` | 公式／配布AI入口を同じ正本境界へ更新した |
| root／template `CLAUDE.md`、root／template `.github/copilot-instructions.md` | 各`AGENTS.md`を正本入口として参照するため、本文重複なしで追従することを確認し変更不要とした |
| `CONTRIBUTING.md`英日 | 採用済み変更の実行を`10_Agent`／`19_Maintenance`へ接続し、Issue受付の軽量性を保持した |
| Issue受付契約、PRひな型、`12_Change.md` | Issue受付は提案段階、PRひな型は提出時確認、`12_Change`はCHG最小記録契約を所有するため、4例の実行義務を重複させず変更不要とした |
| `template/90_Release/Changes/CHG-XXXXXX_Template.md` | `10_Agent`への正本参照、実差分処置、未解消不一致の記録欄を追加した |
| `README.md`、`CHANGELOG.md`英日 | 目的、採用影響、条件付きPL-16／AD-21、移行、復旧、延期時リスクを同じ意味で更新した |
| 当時の`template/tools/crdd_check.ts`、`tools/crdd_check.test.ts`（現在の試験移設先は[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)） | 現行英日Release節、移行要否／分類の判定不能・不一致、構造化区分を決定論的に確認した |
| `CHG-000010_*_3b26d56`の固定後根拠3件 | 初回固定候補の実行事実を履歴として保持し、実行記録を`Invalidated`として現在判定への流用を禁止した |
| `CHG-000010_*_dbe718c`の固定後根拠3件 | 第2固定候補の実行事実を履歴として保持し、実行記録を`Invalidated`として現在判定への流用を禁止した |
| `CHG-000010_*_e19501d`の固定後根拠およびCurrent Record 7件 | v0.15.0公開前の最終候補に対するChecker、試験、3系統確認、現在状態を履歴として保持し、再接続後の最終判定への流用を禁止した |
| 版表示のみの正本文書 | 26正本文書の対象集合をリポジトリのVersionヘッダーから全数照合し、意味を変えない文書はVersionだけ更新した |

最終固定前の変更集合は、公開結果記録を含むmainコミット`122a0f2cfe6f94a504604d0f265d549f1f08c35f`との差分から再導出する。現在の実差分は、内容／入口／Checker等35ファイル、初回固定候補の履歴根拠3ファイル、第2固定候補の履歴根拠3ファイル、v0.15.0公開前の最終候補に対する固定後根拠およびCurrent Record 7ファイルの計48ファイルであり、上表の変更、既存参照で追従、理由付き変更不要のいずれかへ対応している。確認待ち0件、未解消不一致0件である。今後の修正で集合が変わった場合は、この件数と処置を固定前に再照合する。

### 5.4. 代表例

| 種別 | 例 | 期待結果 |
|---|---|---|
| 発火 | PL-18の発火条件または正式結果語を変更する | 正本、PL-18、監査、AI入口、公開案内、移行記述を利用側母集団として固定前に照合する |
| 非発火 | 誤字だけを直し、適用条件、例外、状態、準拠または利用側を変えない | 理由を示して簡潔化できる。新しい成果物や全監査を自動追加しない |
| 境界 | 説明用の文言変更が条件付き規則の意味を変える可能性がある | 非発火を自己申告せず、正本と利用側を確認して必要な経路へ昇格する |
| 情報不足 | どの利用側が結果を消費するか、または条件へ該当するか判定できない | 不足情報、確認担当または決定権限、再開条件を残し、発火、非該当または完了へ丸めない |

## 6. 実装と検証

- 実装対象: 本記録の契約母集団と利用側母集団
- Checker回帰試験: 現行リリース節欠落、移行注記区分欠落、完全な英日注記、移行不要の境界を確認する
- 全体Checker: 固定候補へ一度実行し、完全結果と対象同一性を固定後根拠として保存する
- 独立確認: エージェント運用レビュー、文書監査、不足／影響・準拠影響監査を同じ固定候補へ実行する
- 解消条件: 各確認が未解決Finding 0件で、4種類の新規候補を処置し、現在状態へ接続できること

## 7. 移行

- `migration_required: true`
- 本v0.16.0候補の初回作成時点ではv0.14.0が公開中で、v0.15.0は未公開候補だった。人間のリリース承認後、v0.15.0を注釈付きタグ`v0.15.0`として公開し、公開結果記録を含むmainコミット`122a0f2cfe6f94a504604d0f265d549f1f08c35f`へ本候補を再接続した。再接続後の新しいCommit／Tree／根拠／3系統確認を最終リリース判断に使用する。
- v0.16.0の採用開始時はMigration Completenessを満たし、人間が有効化するまで公開済みv0.15.0を維持する。
- AIによる非自明な保守またはAgentic Delivery表明ではAD-02を再評価する。条件規範を品質保証で検証する場合はPL-16、条件規範を新設・変更した対象の初回独立確認ではAD-21も条件付きで再評価する。
- 完了済み履歴を一括で書き換えない。進行中の手順が新しい母集団、4種類の例または固定前照合を保持できない場合だけ更新する。
- 部分適用を戻す場合はv0.15.0の入口と実行手順へ戻し、候補記録を削除せず履歴として保持する。

## 8. 既知の制限と残るリスク

- 明示した母集団は、未知の利用側を必ず発見することを保証しない。
- 4種類の代表例は、専門領域の意味判断そのものを自動化しない。
- Checkerは実装した決定論的検査だけを証明し、意味の正しさ、監査能力または準拠を代替しない。
- 実運用での固定候補差替え回数、監査往復、処理時間および新規Finding数の改善効果は、リリース後の新しい運用データで別変更契機として評価する。

## 9. 初回固定候補の監査履歴

- 固定候補: Commit `3b26d562e4dca594caf2193cdb5caad15297ba1b`、Tree `6572c8a1291a58f903b6ec275d97a6dde2b7a1db`
- 共通機械根拠: `CHG-000010_Verification_Run_Record_3b26d56.md`、Checker JSON、TAP
- 統合Finding: Agent Major 2件、Document Major 2件／Minor 1件、Gap／Conformance Major 2件／Minor 1件
- 処置: 単一正本、既知利用側、PL-16／AD-02／AD-21、Checkerの判定不能／英日不一致、公開基準版とリリース順を一括修正する。旧固定候補の結果は当時の履歴として保持し、現在の解消判定またはRelease Handoffへ流用しない。

## 9.1. 第2固定候補の監査履歴

- 固定候補: Commit `dbe718caa19e6d50f48be1a21a913dbb374507e8`、Tree `4f18bb0ed143e161a1d195851c1a71ec58161e8e`
- 共通機械根拠: `CHG-000010_Verification_Run_Record_dbe718c.md`、Checker JSON、TAP
- 統合Finding: Agent Major 1件、Document 0件、Gap／Conformance Minor 1件
- 処置: 見出し、移行宣言および移行注記区分を同じMarkdown構造走査へ統合し、非YAMLコードフェンス内の例示を判定根拠にせず、言語区分と現行Release節の欠落／重複を全数確認する。旧固定候補の結果は当時の履歴として保持し、現在の解消判定またはRelease Handoffへ流用しない。

## 9.2. v0.15.0公開前の最終固定候補

- 固定候補: Commit `e19501dc457841605aa033ed10e0d47fb4c43c5e`、Tree `1556397b103adfb267dca5c7b7bfc58edebd506a`
- 基準: `c73da4d45861914a1d5a83892e1149e9cd9cf7e2`（v0.15.0未公開候補）
- 結果: Checker、139回帰試験、エージェント運用レビュー、文書監査、不足／影響・準拠影響監査はすべて`Pass`、未解決Finding 0件
- 現在の扱い: v0.15.0公開前候補に対する履歴として保持する。公開済みv0.15.0のmainへ再接続した最終候補の解消判定またはRelease Handoffへ流用しない

## 10. 現在の処置

v0.15.0の先行公開と、公開結果記録を含むmainへの再接続を完了した。現在状態は`Ready for Verification`であり、再接続後の固定コミット、固定後Checker、独立確認、統合、v0.16.0のリリース判断および公開識別子は未確定である。

## 11. リリース

- 対象リリース: v0.16.0
- 収録リリース: 未確定
- 統合: 未実施
- 公開識別子: 未確定
- 次の処置: 再接続後の候補を固定し、機械確認、回帰試験および3系統の独立確認を新しい対象Identityに対して取り直す。全結果の統合後にv0.16.0のリリース実行へ進む
