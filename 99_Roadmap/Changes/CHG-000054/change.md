# 変更トレース: エージェント組織の文書アーキテクチャ

変更ID: `CHG-000054`
- 状態: `Released`（v0.18.0）
- 決定権限者: Qual-Lab
- 最終更新日: 2026-09-01
- 対象version: v0.18.0
- 変更分類: `normative`
- 移行要否: `migration_required: true`
- 概念正本: [`04_Agent_Organization.md`](../../../04_Agent_Organization.md)
- 自律Operation Architecture: [`05_Autonomous_Operation.md`](../../../05_Autonomous_Operation.md)
- 実装案内: [Runtimeの振る舞い仕様](../../../05_SPEC/01_Behavior_Specification.md)
- 統合台帳: [未リリース変更トレース統合台帳](../../02_Changes.md)

## 1. 結論

[完成評価](../CHG-000015/Evidence/260901_coordinator-completion-review.md#completion-assessment-147fb29)後、[人間が内容と移行方針を採用](../CHG-000014/change.md#candidate-adoption-20260901)した。現在はPRへの引渡し段階で、main統合・リリースは未承認。以下の経緯にある判断・検証待ちは当時の履歴として保持する。

CRDDの中心概念であるエージェント組織（Agent Organization）を、特定Providerや`tools/coordinator`の実装から分離し、ルートの基礎正本へ集約した。READMEの「AIの開発チーム」「AIに専門性と実行を、人間にアイデア・判断・責任を」というVisionは、この概念の利用者向け入口であり独立したRelease価値ではないため、旧`CHG-000045`を本変更へ統合した。

次の表は概念と実装を分離した当時の結果である。Runtimeの仕様・設計・手順・コードは、その後[工程別配置への移行](../CHG-000017/change.md#9-内部ツールの工程別配置への移行)で分離した。現在の配置は同移行先を参照し、表の旧READMEを現行入口とみなさない。

| 層 | 正本／入口 | 所有する意味 |
|---|---|---|
| 利用者向け入口 | `README.md`の英語／日本語節 | CRDDが目指すAI開発チーム、人間とAIの役割、採用時に何が変わるか |
| 概念・規範候補 | `04_Agent_Organization.md` §1～§11、§13～§15 | Role、Specialty、Delegation、Independence、Cost、Authority、Human boundary、Provider independence |
| 非規範実行Architecture | `04_Agent_Organization.md` §12 | Execution Slate、Eligibility、Optimization、Context Projection、Fallback、Execution provenance |
| 自律Operation Architecture | `05_Autonomous_Operation.md` | 再評価、Operation Contract、Effect、安全、健全性、将来互換 |
| Runtime実装 | `tools/coordinator/README.md` | build、run、Adapter、Docker、Native、State、Recovery、試験 |
| 準拠判定 | `52_Conformance_Audit.md`のAD-22 | エージェント組織を使用するときの横断基準 |

同じ概念を各文書で再定義せず、入口と実装は正本へ参照する。


## 2. 人間／AIの基本境界

```text
AI: Specialized execution / analysis / verification
Human: Idea / value / decision authority / accountability
```

人間がコードを書くことを開発の前提とせず、AIがUX、UI、Architecture、Implementation、TestおよびReview等の専門性を分担するHuman Coding-less Developmentを目指す。ただし、AIの能力、役割、利用可能性または自己申告から決定権限を推定しない。人間は重要判断、外部Effect、Risk Acceptance、受入および結果への責任を保持する。

この境界の上位目的を[`01_Principles.md`](../../../01_Principles.md#2-purpose-and-core-belief)へ統合した。AIへの実行委譲は人間の思考代替ではなく、問い、違和感、仮説、価値判断および学びへ集中する余地を作る。AIは人間が自分の意見を育てる思考支援になり得るが、永続的な依存を目的にしない。個人やProjectで得た学びを、特定の優秀な個人へ依存しない再利用可能な組織能力へ変え、HumanとAIが自ら課題探索・要求形成、判断、実行および学びを回せる状態を成功条件とする。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`.gitattributes`](<../../../.gitattributes>)
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
- [`05_Autonomous_Operation.md`](<../../../05_Autonomous_Operation.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/Details/checker/01_Architecture.md`](<../../../06_Architecture/Details/checker/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](<../../../06_Architecture/Details/platform-access/01_Architecture.md>)
- `06_Autonomous_Operation_Responsibility.md`（削除または旧Path）
- `07_Autonomous_Operation_Safety.md`（削除または旧Path）
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/02_Quality_Strategy.md`](<../../../07_Quality/02_Quality_Strategy.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Verification.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md`（削除または旧Path）
- `08_Operation_Health_and_Human_Interface.md`（削除または旧Path）
- `09_Forward_Compatibility.md`（削除または旧Path）
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
- [`40_Develop/checker/test-discovery.ts`](<../../../40_Develop/checker/test-discovery.ts>)
- [`40_Develop/checker/test-runner.ts`](<../../../40_Develop/checker/test-runner.ts>)
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
- [`40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile`](<../../../40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile>)
- [`40_Develop/coordinator/runtime/provider-egress-proxy.py`](<../../../40_Develop/coordinator/runtime/provider-egress-proxy.py>)
- `40_Develop/coordinator/scripts/build-native-bootstrap.ts`（削除または旧Path）
- [`40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts>)
- `40_Develop/coordinator/scripts/check-native-bootstrap-pe.ts`（削除または旧Path）
- [`40_Develop/coordinator/scripts/check-native-runtime-trace.ts`](<../../../40_Develop/coordinator/scripts/check-native-runtime-trace.ts>)
- [`40_Develop/coordinator/scripts/check-platform-access-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-platform-access-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-provider-authority-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-provider-authority-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-provider-home-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-provider-home-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-runtime-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-runtime-traceability.ts>)
- [`40_Develop/coordinator/scripts/generate-release-key.ts`](<../../../40_Develop/coordinator/scripts/generate-release-key.ts>)
- [`40_Develop/coordinator/scripts/measure-development-providers.ts`](<../../../40_Develop/coordinator/scripts/measure-development-providers.ts>)
- [`40_Develop/coordinator/scripts/platform-access-coverage-path.ts`](<../../../40_Develop/coordinator/scripts/platform-access-coverage-path.ts>)
- [`40_Develop/coordinator/scripts/release-staging-manifest.ts`](<../../../40_Develop/coordinator/scripts/release-staging-manifest.ts>)
- [`40_Develop/coordinator/scripts/revoke-external-send-consent.ts`](<../../../40_Develop/coordinator/scripts/revoke-external-send-consent.ts>)
- [`40_Develop/coordinator/scripts/sign-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/sign-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts`](<../../../40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts>)
- [`40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts`](<../../../40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts>)
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
- [`40_Develop/coordinator/src/core/runtime-process-safety-state.ts`](<../../../40_Develop/coordinator/src/core/runtime-process-safety-state.ts>)
- [`40_Develop/coordinator/src/core/runtime-traceability.ts`](<../../../40_Develop/coordinator/src/core/runtime-traceability.ts>)
- [`40_Develop/coordinator/src/core/task-cli-cancellation.ts`](<../../../40_Develop/coordinator/src/core/task-cli-cancellation.ts>)
- [`40_Develop/coordinator/src/core/verification-result-record.ts`](<../../../40_Develop/coordinator/src/core/verification-result-record.ts>)
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
- [`40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts>)
- `40_Develop/coordinator/tests/fixtures/release-manifest-validity-vectors.txt`（削除または旧Path）
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
- `40_Develop/coordinator/tests/task-cli-cancellation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/test-support.ts`（削除または旧Path）
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
- `90_Release/Changes/CHG-000012_Current_Decision_Set.md`（削除または旧Path）
- `90_Release/Changes/CHG-000013_Communication_Market_and_Adoption_Exploration.md`（削除または旧Path）
- `90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md`（削除または旧Path）
- `90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md`（削除または旧Path）
- `90_Release/Changes/CHG-000016_Internal_TypeScript_Migration.md`（削除または旧Path）
- `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md`（削除または旧Path）
- `90_Release/Changes/CHG-000018_Biome_Advisory_Closure.md`（削除または旧Path）
- `90_Release/Changes/CHG-000019_Rust_Platform_Access_Core.md`（削除または旧Path）
- `90_Release/Changes/CHG-000020_Platform_Access_Release_Binding.md`（削除または旧Path）
- `90_Release/Changes/CHG-000021_Protected_Active_Pointer.md`（削除または旧Path）
- `90_Release/Changes/CHG-000022_Provider_Lifecycle_Foundation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000023_Dynamic_Fake_Provider_Lifecycle.md`（削除または旧Path）
- `90_Release/Changes/CHG-000024_Dynamic_Fake_Provider_Failure_Verification.md`（削除または旧Path）
- `90_Release/Changes/CHG-000025_Dynamic_Fake_Provider_Cancellation_Verification.md`（削除または旧Path）
- `90_Release/Changes/CHG-000026_Provider_Home_Protection_Foundation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000027_Coordinator_Test_And_Package_Inventory_Stability.md`（削除または旧Path）
- `90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md`（削除または旧Path）
- `90_Release/Changes/CHG-000031_Runtime_Owned_Operation_Context_Capability.md`（削除または旧Path）
- `90_Release/Changes/CHG-000032_Current_Process_Principal_Observation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md`（削除または旧Path）
- `90_Release/Changes/CHG-000034_Native_Direct_Provision_Supervisor_Entrypoint.md`（削除または旧Path）
- `90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md`（削除または旧Path）
- `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md`（削除または旧Path）
- `90_Release/Changes/CHG-000037_Claude_No_Network_Version_Probe.md`（削除または旧Path）
- `90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md`（削除または旧Path）
- `90_Release/Changes/CHG-000039_Runtime_Owned_Provider_Home_Observation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000040_Runtime_Owned_Provider_Home_Mount_Grant.md`（削除または旧Path）
- `90_Release/Changes/CHG-000041_Explainable_Model_Selection_And_Claude_Docker_Adapter.md`（削除または旧Path）
- `90_Release/Changes/CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md`（削除または旧Path）
- `90_Release/Changes/CHG-000043_Docker_Process_Controller.md`（削除または旧Path）
- `90_Release/Changes/CHG-000044_Runtime_Provider_Authority_Capability.md`（削除または旧Path）
- `90_Release/Changes/CHG-000045_README_AI_Development_Team_Vision.md`（削除または旧Path）
- `90_Release/Changes/CHG-000046_Runtime_Provider_Eligibility_Observation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000047_Runtime_Provider_Model_Profile_Resolution.md`（削除または旧Path）
- `90_Release/Changes/CHG-000048_Runtime_Docker_Recovery_Connection.md`（削除または旧Path）
- `90_Release/Changes/CHG-000049_Runtime_Docker_Effect_Executor.md`（削除または旧Path）
- `90_Release/Changes/CHG-000050_Local_Personal_Authority_and_Bounded_Eligibility.md`（削除または旧Path）
- `90_Release/Changes/CHG-000051_Runtime_Repository_Revision_Binding.md`（削除または旧Path）
- `90_Release/Changes/CHG-000052_Coordinator_Claude_Probe_Runtime_Facade.md`（削除または旧Path）
- `90_Release/Changes/CHG-000053_Codex_Subscription_Runtime_Adapter.md`（削除または旧Path）
- `90_Release/Changes/CHG-000054_Agent_Organization_Document_Architecture.md`（削除または旧Path）
- `90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md`（削除または旧Path）
- `90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000014_Current_Review_Record_850b485.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_CRDD_v0_18_Concept.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- `99_Roadmap/02_CRDD_v0_18_Responsibility_Boundary.md`（削除または旧Path）
- `99_Roadmap/03_CRDD_v0_18_PoC_Plan.md`（削除または旧Path）
- `99_Roadmap/05_CRDD_v0_18_Operation_Health_and_Human_Interface.md`（削除または旧Path）
- `99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md`（削除または旧Path）
- `99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md`（削除または旧Path）
- `99_Roadmap/09_CRDD_v0_18_Agent_Organization.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000054/change.md`](<../../../99_Roadmap/Changes/CHG-000054/change.md>)
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
- `template/99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`template/CLAUDE.md`](<../../../template/CLAUDE.md>)
- `template/tools/coordinator/coordinator-package-manifest.json`（削除または旧Path）
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- `tools/checker/crdd-check.contract.test.ts`（削除または旧Path）
- `tools/checker/test-discovery.ts`（削除または旧Path）
- `tools/checker/test-runner.ts`（削除または旧Path）
- `tools/checker/tools-naming.contract.test.ts`（削除または旧Path）
- `tools/checker/tsconfig.json`（削除または旧Path）
- `tools/coding-standards.md`（削除または旧Path）
- `tools/coordinator/architecture/README.md`（削除または旧Path）
- `tools/coordinator/README.md`（削除または旧Path）
- `tools/coordinator/src/core/command-report.ts`（削除または旧Path）
- `tools/coordinator/src/security/claude-execution-plan.ts`（削除または旧Path）
- `tools/coordinator/src/security/coordinator-runtime.ts`（削除または旧Path）
- `tools/coordinator/tests/claude-execution-plan.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/command-report.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/coordinator-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-authority-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/threat-model.md`（削除または旧Path）

</details>

## 3. エージェント組織の境界

- Agent Organizationは単純なparent／subagent関係、固定Workflowまたは常時Multi-Agentを意味しない。
- Role、Specialty、Capability、Work Assignment、Delegation、Independent Review、Execution SlateおよびCoordinatorを必要な範囲で編成する。
- RoleとAuthorityを分け、Executor、ReviewerまたはCoordinatorという役割だけからRepository、External Send、PromotionまたはFinancial Effectの権限を成立させない。
- 不要なAgentを起動せず、品質成立条件を満たすEligible Set内でCostを最適化する。Costのために独立ReviewやAuthorityを弱めない。
- Codex、Claude Codeおよび将来Providerから独立し、Coordinator Runtimeは概念を実装する一候補として扱う。
- Provider同士の直接spawn、無制限な再帰委譲、Authority cycle、Cost amplificationおよびAIへの無制限Authorityを非目標とする。

## 4. 採用した文書構造

初稿ではRoadmapと`tools/coordinator/README.md`へ概念、Policy、Architectureおよび実装が分散していた。監査結果に基づき次へ収束した。

1. Roadmapは未完了の方向・順序・到達点だけを所有し、概念正本にしない。
2. `tools/coordinator/README.md`からCost、Independent Review、Authority、人間境界等の上位意味を`04_Agent_Organization.md`へ移す。
3. 実行Architectureは概念正本の非規範§12へ置き、具体的なProcess、Docker、Provider CLI、StateおよびRecoveryはtoolsへ残す。
4. 自律Operationの旧分割文書を`05_Autonomous_Operation.md`へ統合し、空wrapperや番号埋め文書を残さない。
5. 用語集は短い定義と正本導線を所有し、特定versionのCurrent Stateを一般定義へ埋め込まない。
6. README、Overview、配布`template/AGENTS.md`、AuditおよびCHANGELOG候補を同じ責務方向へ更新する。

`04`へ`05`を全統合しない。`04`は「AIチームをどう編成・統治するか」、`05`は「そのチームがどう安全にOperationするか」を所有し、規範強度、変更頻度、採用単位およびレビュー範囲を分ける。

## 5. README Visionの統合

旧`CHG-000045`が所有した公開入口の意図を本変更へ統合する。

- CRDDは「Context Repositoryを使ったAI Coding」だけでなく、「AIの開発チームを成立させるための開発手法」であることを冒頭で示す。
- AIは専門性と実行・検証を担い、人間はアイデア、判断、責任へ集中する。
- AIは人間の思考を置き換えず、人間自身の仮説形成と学びを支援し、個人の学びを組織能力へ接続する。
- 通常のAI Codingとの差を、Context、判断履歴、専門工程および工程間依存をRepositoryで共有する点として示す。
- CRDD自身と実Projectでdogfoodingしていることを、将来Visionだけでなく現在の実践として示す。
- Runtimeの現在利用可能範囲、Trust／Provisioning／Recovery詳細をREADME冒頭へ展開せず、三層の導線で圧縮する。

このVisionは人間の責任をAIへ移さず、特定Provider、Runtime実装またはv0.18のRelease状態を概念へ固定しない。

## 6. 規範・準拠・移行

AD-22は、既存AD-04／07／08／11を再定義せず、エージェント組織に固有のRole／Authority分離、委譲、独立性、Cost、人間境界およびProvider非依存性を横断確認する。

採用側はv0.18を採用するとき、次を評価する。

- エージェント組織を使用するか。使用しない場合はAD-22の該当範囲を理由付きで非該当とする。
- Agent、Role、Authority、Delegation、Independent ReviewおよびHuman Decision Boundaryが既存Projectで重複・競合しないか。
- 旧Roadmap、独自Glossaryまたはtools READMEを概念正本として参照していないか。
- Runtimeを使用する場合、概念採用とRuntime有効化・Provider認証・External Sendを別判断として扱っているか。

移行を延期する場合は以前固定したv0.17.xを維持する。Candidate文書の存在、Checker合格またはRuntime実装だけで採用、準拠、統合、Stable化またはReleaseを成立させない。

## 7. 実装発展とEvidence

旧`CHG-000045`の旧filename、原文Hash、固定Git改訂版、統合理由およびEvidence有無は[統合台帳](../../02_Changes.md#consolidated-chg-000045)へ固定する。旧全文は固定Git改訂版から取得できる。

本変更の主要な監査発展は次である。

- 初稿: Roadmapを概念正本候補にし、概念重複とversion依存定義を残したためFail。
- 基礎配置是正: `04_Agent_Organization.md`へ移したが、AD-22、README三層導線、locale-first、規範分類および移行影響が不足。
- 規範是正: AD-22とCHANGELOG候補を追加したが、統合集合の最大分類、変更説明面およびChecker命名契約の後続追跡を追加是正。
- 責務是正: `04`／`05`／tools／Roadmapを分離し、旧自律Operation文書を`05`へ統合。
- 最終固定版`91d0709bf892646527a3f4396f2d7c5da444079d`: Security／Conformance、Document、Gap／Impact／利用導線監査がFinding 0でPass。

過去固定版のPassは当時版の履歴であり、本CHG統合改訂版の現在判定へ流用しない。

## 8. 現在の検証義務

1. 単一READMEの英語／日本語節、Overview、Terminology、`04`、`05`、tools README、AD-22、template、CHANGELOG候補の一方向導線を全数確認する。
2. 概念・Policyの重複定義、旧分割文書、空wrapper、Roadmap内の完了済み本文および用語集のversion固有Current Stateが0であることを確認する。
3. `04`の規範／非規範強度と参照元表示、`04`／`05`の採用単位、Runtime実装との差を確認する。
4. 旧`CHG-000045`が台帳から本CHGへ一意に到達し、IDを再利用していないことを確認する。
5. Repository全体Checker、Checker契約試験、関連package checkおよび`git diff --check`を実行する。
6. 最新固定改訂版へArchitecture、Security／Conformance、DocumentおよびGap／Impact監査を再実行する。

## 9. 対象外とRelease処置

本変更はCoordinator RuntimeのProvider Adapter、Docker、Native、Authority発行、Runtime State、Recoveryまたは実Provider送信を変更しない。それらは[`CHG-000015`](../CHG-000015/change.md)が所有する。

Issue #30のclose、v0.18採用、統合、Stable化、tagまたはReleaseは人間の別判断である。本変更は未リリースであり、最新改訂版の全確認後にRelease統合へ引き渡す。現在、この統合方針について追加の人間判断は必要ない。
