# 変更トレース: v0.18内部ツール近代化と命名Baseline

変更ID: `CHG-000017`
- 状態: `Released`（v0.18.0。公開後のCoordinator配布是正はCHG-000056で追跡）
- 決定権限者: Qual-Lab
- 判断日: 2026-08-16
- 最終更新日: 2026-09-01
- 対象: CRDD公式Repositoryの`40_Develop/**`（旧`tools/**`）、配布用`template/tools/**`、工程別の設計・品質文書配置と対応する規則・ひな型・利用側
- 対象version: v0.18.0。v0.18.1ではCHG-000056に伴う配布成果物・検査入口の是正として再開
- 変更分類: `breaking`
- 移行要否: `migration_required: true`
- 関連正本: [`19_Maintenance.md#33-internal-typescript-runtime`](../../../19_Maintenance.md#33-internal-typescript-runtime)、[`19_Maintenance.md#34-essential-correction-and-compatibility-boundary`](../../../19_Maintenance.md#34-essential-correction-and-compatibility-boundary)、[内部ツール・コーディング規約](../../../06_Architecture/99_Coding_Standards.md)
- 統合台帳: [未リリース変更トレース統合台帳](../../02_Changes.md)

## 1. 結論と変更意図

v0.18では、CRDD内部ツールをNode.js 24.12以上で直接実行できるTypeScriptへ統一し、TypeScript型検査、Biome、命名、試験発見および配布Checker Pathを一つの保守Baselineへ収束させる。

旧`CHG-000016`のTypeScript完全移行と旧`CHG-000018`のBiome診断是正は、本変更の途中Stepと完了条件であり、独立した利用者価値またはRelease処置を持たないため本CHGへ統合した。旧`CHG-000016`の「配布Pathは変更しない」という当時判断は、後続の人間判断によってsupersededされ、現在判定へ使用しない。

現在、内部ScriptのTypeScript移行、Node.js 24系でのnative実行、Biome Warning 0 Gate、nested testを含む決定論的列挙および旧Checker Pathを残さない移行候補は成立している。2026-08-30の所有集合再固定で検出した命名違反243件も是正し、[検証義務と機械確認結果](#6-現在の検証義務)へ記録した。後続の試験一時領域と生成物探索の是正は[Release処置](#8-release処置)で追跡する。

[完成評価・端末追加確認](../CHG-000015/Evidence/260901_coordinator-completion-review.md#windows-terminal-verification)で全検証義務の照合と必要な独立確認を終え、[人間が内容・移行方針を採用](../CHG-000014/change.md#candidate-adoption-20260901)した。内部ツールの配置・命名・利用者設計の対象はPR #32へ統合した。以下の旧固定版・再開・判断待ちは当時の履歴として保持する。

### 公開準備で検出したChecker誤判定の是正（2026-09-01）

Stable表示への移行後、Checkerが03_Documentation本文のコード例にあるReleased Baselineを実ヘッダーへ混入した。また、現在の英日CHANGELOGに実在する「Not required for adopting projects」「採用プロジェクトでは不要」「切戻し／復旧」「既知の限界」を固定表示語の検出が認識しなかった。内容の欠落ではなく、検査対象領域と表示語の対応不足であり、本CHGを再開して是正する。

冒頭の実ヘッダーだけからVersion・Status・Released Baselineを一組として取得し、本文やコード例から欠落値を補完しない。移行注記では確認した同義の表示語を認識するが、任意の自由文を意味推論して合格にしない。真の項目欠落、別リリース、引用やコード例だけの項目、Stable実ヘッダーに残るBaselineは引き続き拒否する。

同じ表示解析の水平確認で、READMEの旧Status表示では太字終端を版番号へ混入し、現在のVersion表示は照合対象から漏れることも確認した。公式README冒頭の既知の両形式を照合し、版だけの表示と説明付き表示を受理する一方、実際の版不一致は拒否する。本文・コード例だけの表示や採用先プロジェクト独自のREADMEを公式版の根拠にしない。

配布正本と既存契約試験を同時に更新し、全体確認・独立確認を終えるまで解消済みとしない。規範上の移行義務、機械キー、過去の根拠は変更しない。

独立確認では、移行ラベルがあっても説明が空の項目を受理する不足を検出した。既知の全旧新ラベルについて説明の非空白確認と正負の回帰試験を追加し、内容の意味・十分性の推論へは拡張しない。[公開準備の検証記録](../CHG-000015/Evidence/260901_coordinator-completion-review.md#release-preparation-verification)で初回判定、是正、再確認を分けて追跡する。

## 2. 採用したBaseline

| 項目 | 契約 |
|---|---|
| 実装言語 | 内部実行Scriptは`.ts`を標準とする |
| Runtime | Node.js 24.12 LTS以上のnative TypeScript型除去を使用する |
| 追加変換層 | `tsx`、`ts-node`、Babel、Bundlerまたは専用compiler出力をRuntime必須にしない |
| 型検査 | Checker、Coordinator production、Coordinator testを所有projectへ全数接続する |
| Lint／Format | Biome 2.5.6とRepository rootの`biome.json`を単一正本とする |
| Warning | `--error-on-warnings`を両private packageへ適用し、Warning 1件以上で失敗する |
| Info | Info 0は固定版実績であり、将来のInfo発生を自動拒否する恒久契約にしない |
| 命名 | file、folder、TypeScript identifier、Boolean、array、constant、test kind、machine identifierを`06_Architecture/99_Coding_Standards.md`へ固定する |
| 試験発見 | package所有の`.test.ts`を再帰列挙し、型検査の所有試験集合とexact一致させ、0件を失敗する |
| 互換 | 旧名shim、alias、重複入口を残さず、明示移行または以前の固定Releaseへ戻す |
| Release署名 | 開発反復を公式鍵・passphrase・実署名Effectから分離し、全非秘密条件を入力前に検査した固定Release Candidateだけを一度署名する |
| Tool配布 | Source・build・試験は`40_Develop`、採用Repositoryへ届くTool本体・固定Native成果物・配布Identityは`template/tools`、変更・Evidence・Release状態は`90_Release`へ分離する |
| Repository-local状態 | Repository rootの`.crdd`はignore-by-defaultとし、Runtime状態、Candidate、log、一時成果物および生成物を追跡しない。内容自体が検証入力になる非秘密のCommit固定Repository設定だけを明示allowlistする |

公開CheckerのCLI、JSON、Schema、reason、status、暗号domainおよび既存machine contractは、命名規則だけを理由に変更しない。単一配布正本へ委譲するpackage entry adapterは責務分離であり、旧入口互換wrapperではない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`.gitattributes`](<../../../.gitattributes>)
- [`.github/pull_request_template.md`](<../../../.github/pull_request_template.md>)
- [`.gitignore`](<../../../.gitignore>)
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
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/02_Quality_Strategy.md`](<../../../07_Quality/02_Quality_Strategy.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/Registry/test-catalog.json`](<../../../07_Quality/Registry/test-catalog.json>)
- `07_Quality/Verification_Results/2026-08-31_Coordinator_Closure_Verification.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Verification.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Coverage.json`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Native_Distribution_Verification.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Signed_E2E.md`（削除または旧Path）
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
- [`40_Develop/checker/bin/crdd-check.ts`](<../../../40_Develop/checker/bin/crdd-check.ts>)
- [`40_Develop/checker/tests/support/fault-injector.ts`](<../../../40_Develop/checker/tests/support/fault-injector.ts>)
- [`40_Develop/checker/package-lock.json`](<../../../40_Develop/checker/package-lock.json>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/verification-runner/bin/regression-runner.ts`](<../../../40_Develop/verification-runner/bin/regression-runner.ts>)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](<../../../40_Develop/verification-runner/src/catalog/test-catalog.ts>)
- [`40_Develop/checker/tests/support/test-discovery.ts`](<../../../40_Develop/checker/tests/support/test-discovery.ts>)
- [`40_Develop/checker/tests/test-runner.ts`](<../../../40_Develop/checker/tests/test-runner.ts>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts`](<../../../40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts>)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](<../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts>)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](<../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts>)
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
- `40_Develop/coordinator/tests/docker-owned-process.integration.test.ts`（削除または旧Path）
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
- [`40_Develop/coordinator/tests/fixtures/docker-owned-process-test-support.ts`](<../../../40_Develop/coordinator/tests/fixtures/docker-owned-process-test-support.ts>)
- [`40_Develop/coordinator/tests/fixtures/docker-owned-process-worker.ts`](<../../../40_Develop/coordinator/tests/fixtures/docker-owned-process-worker.ts>)
- [`40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts`](<../../../40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts>)
- [`40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts>)
- `40_Develop/coordinator/tests/fixtures/release-manifest-validity-vectors.txt`（削除または旧Path）
- [`40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts`](<../../../40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts>)
- [`40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts`](<../../../40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts>)
- [`40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/task-controller-cancellation-fixture.ts`](<../../../40_Develop/coordinator/tests/fixtures/task-controller-cancellation-fixture.ts>)
- [`40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts>)
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
- `40_Develop/coordinator/tests/terminal-interaction-probe.contract.test.ts`（削除または旧Path）
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
- `40_Develop/coordinator/tests/verification-result-record.contract.test.ts`（削除または旧Path）
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
- `90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md`（削除または旧Path）
- `90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000015_Closure_Coverage_48664a2.json`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.json`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000015_Signed_E2E_45ea2ac.json`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000015_Signed_E2E_45ea2ac.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000017_Agent_Security_Review_5185946.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000017_Current_Review_Record_5185946.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000017_Document_Audit_5185946.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000017_Gap_Conformance_Audit_5185946.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000055_Utility_45ea2ac.json`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000055_Utility_45ea2ac.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000017/change.md`](<../../../99_Roadmap/Changes/CHG-000017/change.md>)
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
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- `template/tools/coordinator/coordinator-package-manifest.json`（削除または旧Path）
- `template/tools/coordinator/windows-x64/coordinator.exe`（削除または旧Path）
- [`template/tools/coordinator/windows-x64/crdd-platform-access.exe`](<../../../template/tools/coordinator/windows-x64/crdd-platform-access.exe>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- `tools/checker/crdd-check.contract.test.ts`（削除または旧Path）
- `tools/checker/crdd-check.ts`（削除または旧Path）
- `tools/checker/fault-injector.ts`（削除または旧Path）
- `tools/checker/package.json`（削除または旧Path）
- `tools/checker/test-discovery.ts`（削除または旧Path）
- `tools/checker/test-runner.ts`（削除または旧Path）
- `tools/checker/tools-naming.contract.test.ts`（削除または旧Path）
- `tools/checker/tsconfig.json`（削除または旧Path）
- `tools/coding-standards.md`（削除または旧Path）
- `tools/coordinator/architecture/README.md`（削除または旧Path）
- `tools/coordinator/bin/coordinator.ts`（削除または旧Path）
- `tools/coordinator/package.json`（削除または旧Path）
- `tools/coordinator/README.md`（削除または旧Path）
- `tools/coordinator/scripts/check-platform-access-coverage.ts`（削除または旧Path）
- `tools/coordinator/scripts/check-runtime-traceability.ts`（削除または旧Path）
- `tools/coordinator/scripts/sign-release-manifest.ts`（削除または旧Path）
- `tools/coordinator/scripts/verify-signed-general-task.ts`（削除または旧Path）
- `tools/coordinator/scripts/verify-signed-recovery-matrix.ts`（削除または旧Path）
- `tools/coordinator/scripts/verify-signed-route-matrix.ts`（削除または旧Path）
- `tools/coordinator/src/core/cli-options.ts`（削除または旧Path）
- `tools/coordinator/src/core/command-report.ts`（削除または旧Path）
- `tools/coordinator/src/core/docker-cleanup-eligibility.ts`（削除または旧Path）
- `tools/coordinator/src/core/docker-recovery-command-report.ts`（削除または旧Path）
- `tools/coordinator/src/core/doctor.ts`（削除または旧Path）
- `tools/coordinator/src/core/runtime-traceability.ts`（削除または旧Path）
- `tools/coordinator/src/core/task-cli-cancellation.ts`（削除または旧Path）
- `tools/coordinator/src/security/authority-grant-verifier.ts`（削除または旧Path）
- `tools/coordinator/src/security/authority-root-locator.ts`（削除または旧Path）
- `tools/coordinator/src/security/candidate-bundle-store.ts`（削除または旧Path）
- `tools/coordinator/src/security/candidate-store-kernel-lock.ts`（削除または旧Path）
- `tools/coordinator/src/security/claude-docker-runtime-adapter.ts`（削除または旧Path）
- `tools/coordinator/src/security/claude-execution-plan.ts`（削除または旧Path）
- `tools/coordinator/src/security/codex-docker-runtime-adapter.ts`（削除または旧Path）
- `tools/coordinator/src/security/codex-execution-plan.ts`（削除または旧Path）
- `tools/coordinator/src/security/coordinator-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/coordinator-task-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-desktop-repair-native-helper.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-desktop-repair-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-desktop-repair-record-store.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-desktop-runtime-repair.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-effect-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-isolation.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-process-controller.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-recovery-journal.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-recovery-public-projection.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-recovery-runtime-internal.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-recovery-state-machine.ts`（削除または旧Path）
- `tools/coordinator/src/security/egress-proxy-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/execution-environment.ts`（削除または旧Path）
- `tools/coordinator/src/security/external-send-consent-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/host-operation-lock-supervisor.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/plain-data-snapshot.ts`（削除または旧Path）
- `tools/coordinator/src/security/platform-access-adapter.ts`（削除または旧Path）
- `tools/coordinator/src/security/platform-key-storage-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/provider-home-observation.ts`（削除または旧Path）
- `tools/coordinator/src/security/provider-lifecycle.ts`（削除または旧Path）
- `tools/coordinator/src/security/provider-model-profile-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/provider-model-selection-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/provider-task-packet-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/provider-task-structured-result.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-ca-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-signature-primitives.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout-internal.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-workspace-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-activation-locator-binding.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-root-path-identity.ts`（削除または旧Path）
- `tools/coordinator/src/security/secret-material-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/signed-runner-safety-observation.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-file-bundle.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-grant-verifier.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-prelaunch-verifier.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-root-locator.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-root-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-trust-loader.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/candidate-bundle-store.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/candidate-store-kernel-lock.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/claude-docker-runtime-adapter.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/cli-options.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/codex-docker-runtime-adapter.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/command-report.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/coordinator-docker-recovery-cli.integration.test.ts`（削除または旧Path）
- `tools/coordinator/tests/coordinator-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/coordinator-task-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/delegation-route-selection.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-cleanup-eligibility.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-desktop-runtime-repair.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-host-transition-state.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-process-controller.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-recovery-journal.integration.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-recovery-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/docker-runtime-state-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/doctor.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/egress-proxy-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/enrollment-certificate-renewal.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/external-send-consent-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/external-send-grant-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/fixtures/recovery-cleanup-probe.ts`（削除または旧Path）
- `tools/coordinator/tests/fixtures/signed-general-poison-probe.ts`（削除または旧Path）
- `tools/coordinator/tests/generate-release-key.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/git-local-exclude.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/initial-enrollment-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/initial-enrollment-runtime-state.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/offline-enrollment-bundle-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/plain-data-snapshot.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-access-adapter.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-key-storage-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-provisioner-package-gate.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-provisioner-trust-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-authority-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-eligibility-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-home-mount-grant-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-isolation-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-task-structured-result.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-ca-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-record-enrollment-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-record-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-signature-primitives.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/repository-git-layout.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/repository-operation-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/repository-root-resolution.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/repository-workspace-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/root-protection-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-locator-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-record.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-transition.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-root-path-identity.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-root-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-trace-case.ts`（削除または旧Path）
- `tools/coordinator/tests/sign-release-manifest.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/signed-route-matrix-verification.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/signed-runner-safety-observation.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/task-cli-cancellation.contract.test.ts`（削除または旧Path）
- `tools/coordinator/threat-model.md`（削除または旧Path）
- `tools/coordinator/tsconfig.strict.json`（削除または旧Path）
- `tools/coordinator/tsconfig.tests.json`（削除または旧Path）
- `tools/platform-access/rust-toolchain.toml`（削除または旧Path）
- `tools/platform-access/src/protocol.rs`（削除または旧Path）
- `tools/platform-access/src/windows.rs`（削除または旧Path）
- `tools/platform-access/tests/cli.rs`（削除または旧Path）

</details>

## 3. 外部Path移行

| 旧名 | 新名 | 処置 |
|---|---|---|
| `tools/checker/crdd_check.ts` | `tools/checker/crdd-check.ts` | 公式Repository private入口を置換 |
| `tools/checker/crdd_check.test.ts` | `tools/checker/crdd-check.contract.test.ts` | Checker契約試験を置換 |
| `template/tools/crdd_check.ts` | `template/tools/crdd-check.ts` | 配布正本を置換 |
| 採用側`tools/crdd_check.ts` | 採用側`tools/crdd-check.ts` | 採用側配置契約を置換 |
| `tools/coordinator/THREAT_MODEL.md` | `tools/coordinator/threat-model.md` | 現行脅威モデルPathを置換 |
| `tools/coordinator/tests/<subject>.test.ts` | `tools/coordinator/tests/<subject>.contract.test.ts` | Coordinator試験を現行kindへ置換 |
| Checker package script `run` | `verify:repository` | 曖昧なbare名を責務名へ置換 |

採用Repositoryはv0.18を採用するとき、次を同じ移行で行う。

1. コピー済み`tools/crdd_check.ts`を`tools/crdd-check.ts`へrenameする。
2. `AGENTS.md`、CI、script、文書および自動化の実行Pathを更新する。
3. CRDDを`00_CRDD/`へ置き、Checkerをコピーしていない場合は`node 00_CRDD/template/tools/crdd-check.ts --root . --json --summary`へ更新する。
4. 現在Treeに旧Checker Pathが残らないことを確認する。
5. 固定採用候補へ新PathのCheckerまたは同等確認と必要な独立確認を実行してから基準版を有効化する。

移行を延期する採用Repositoryはv0.17.xの固定Releaseを維持する。移行失敗時は部分的shimを追加せず、変更前Releaseと採用側差分へ戻す。

## 4. TypeScript／Biome移行の保持条件

- Node.js組込み、ESMおよび`import type`を使用し、Runtime変換を必要とする`enum`、Runtime namespace、parameter property、decoratorまたはpath aliasを導入しない。
- 外部入力は`unknown`から型Predicateで絞り、`@ts-nocheck`、広域抑制または`noImplicitAny`無効化で移行を成立させない。
- Biome診断の是正は等価な表現、未使用private処置および明示消費で行い、広域除外や抑制commentを追加しない。
- `lint` package scriptのWarning GateをChecker契約試験で固定する。
- 現行のTypeScript sourceとtestを所有集合へexact oneで含め、未所属、余剰、case collision、junction、root外解決、未知entryおよび試験0件をfail closedにする。
- source identifierのrename時もSchema key、CLI flag、reason、status、protocol、暗号domain、Docker外部fieldおよびmachine contractを保持する。
- Release署名を持つToolは、productionの意味契約を公式鍵・passphrase・正式manifestなしで反復検証できる開発入口を所有する。正式署名は内容修正中のデバッグ手段にせず、固定候補の非秘密条件を入力前に全数検査し、失敗時にmanifestまたはAuthorityを残さない。一般利用者は署名検証だけを行い、公式鍵またはpassphraseを保有しない。

## 5. 実装発展と統合した旧CHG

| 旧CHG | 位置付け | 保持する判断／根拠 |
|---|---|---|
| `CHG-000016` | TypeScript完全移行Step | Node.js 24.12以上、変換packageなし、移行順序、strict型検査、当時の段階実装と監査 |
| `CHG-000018` | Biome収束Step | Warning 44件／Info 3件の固定版解消、Warningだけの継続Gate、Infoの非一般化、最終監査 |

旧ID、旧filename、統合前状態、固定Commit／Tree／原文SHA-256、統合理由およびEvidenceは[統合台帳](../../02_Changes.md)を正本とする。旧全文は固定Git改訂版から取得できる。

本CHG自身では、初回の型付き命名分類器が既存識別子と宣言形を漏らしたFinding、安全read／利用文脈／最外利用先の反復是正、将来のnested testが`npm test`から漏れるFinding、Boolean集合とtest discoveryの閉包不足を履歴として保持する。個別Findingの詳細と当時の合否は[`Evidence/CHG-000017_Current_Review_Record_5185946.md`](./Evidence/260816-1459_current-review-record.md)および関連監査Evidence、旧`CHG-000016`／`000018`の台帳entryから取得する。

### TypeScript移行とRust分離の経緯

productionの実ファイル移行はPathとIdentityの小さいpredicate、Locator binding、Root profile、Platform policy群、prelaunch verifier、enrollment renewal、plain-data snapshot、CLI option、Authority Bundle／Grant／Trust Loader、Provisioning CA／offline enrollment、Platform Provisioner Trust、Provider isolation、Docker isolation、Root protection、Host recovery record、Repository Git layout公開境界と内部Resolver／writer、初回登録Runtime state／pure Core、Authority／Runtime Root locator・Path Identity、外向きProxy policy、activation record／transition、署名primitive、準備記録pure Core、準備記録–登録証明書結合、Execution Environment、DoctorおよびCoordinator CLI入口までTypeScriptへ移行した。

当時の後続判断では、OS固有の読み取り専用観測を最小Rust componentへ分離した。現在は明示経路の限定操作も含み、現行の責務は[Windowsネイティブ部品の設計](../../../06_Architecture/Details/platform-access/01_Architecture.md)に従う。

### 設計文書の名称・責務の是正

脅威モデルも`06_Architecture/Details/coordinator/02_Threat_Model.md`へ揃えた。この時点では品質規則が番号なしの名前を指定していたため、設計文書の改名だけには含めなかった。その後、人間が固定構成自体の是正を承認したため、[品質文書の番号付き配置](#quality-document-naming)として規則・ひな型・利用側を同時に更新する。旧規則に従っていた文書を、当時からの規則違反とは扱わない。

2026-08-31、設計正本を移設前の`README.md`という名称で残していた点を是正した。Checker、Coordinator、platform-accessの3部品は各Directoryの`01_Architecture.md`へ揃え、入口は既存の[全体設計](../../../06_Architecture/01_Architecture.md)を使う。互換READMEや新しいCHGは追加しない。

Coordinatorは、移行経緯を本節へ、開発確認の順序を既存Workflowの参照へ整理した。現在の型・命名条件は設計に残し、限定実測の詳細はProvider実装契約の節へ移した。現行リンク、設計と試験の対応表、検証Runnerの読取り対象、契約試験、履歴台帳の後継Pathを同期する。固定Evidenceと旧Path／Commit／Blob／SHA-256は変更せず、改名後の配布を旧署名で検証済みと扱わない。

## 6. 現在の検証義務

1. Node.js 24.12以上でChecker／Coordinatorのnative TypeScript実行を確認する。
2. Checker／Coordinatorの型検査、Biome Lint、Formatterおよび全試験を実行する。
3. test discovery集合とTypeScript projectの所有試験集合がexact一致し、0件、nested、欠落、余剰、case collision、junctionおよび未知entryを反証する。
4. TypeScript所有sourceの未所属／余剰0、命名違反0、廃止Pathの現行利用0を確認する。
5. Repository全体Checkerと`git diff --check`を実行する。
6. Release署名を持つToolについて、開発入口の公式鍵・passphrase・実署名Effect 0、正式署名入口の対話前非秘密検査、失敗時Effect 0および一般利用者の検証専用経路を契約試験で確認する。
7. Repository-local `.crdd`の通常生成物がGitに追跡されず、明示allowlistした非秘密のCommit固定Repository設定だけが追跡可能であることを確認する。
8. 最新固定改訂版へArchitecture／Security、Document、Gap／ImpactおよびConformanceを再実行する。

過去の固定版`5185946ae8193d7bc305be3152558abd45fde020`および`1ce8cedde4865aeb389047c2d2471b922928092e`に対するPassは当時版の履歴であり、本統合改訂版の現在判定へ流用しない。

2026-08-30の再確認では、Repository-local `.crdd`を廃止Path走査から除外し、版固定`.policy`とPlain text成果物の命名規則を正本化した。また、実行時にspawnされる`host-operation-lock-supervisor.ts`をproduction TypeScript projectの所有集合へ追加し、現行所有件数をproduction 142、test 145、TypeScript unique 299、Rust 9へ再固定した。この結果、Checker契約試験は古い件数assertionの先まで進み、現行source／testの命名違反243件を検出した。

広域抑制、allowlistまたは件数だけの調整は行わず、43ファイルのCRDD所有local symbolを型付き宣言単位で是正した。公開Schema／Result keyは変更せず、shorthand propertyは`effectStateUnknown: isEffectStateUnknown`等の明示形へ分離した。命名契約試験7 / 7、Checker全契約試験173 / 173、Coordinator Trace／型／Lint／Format、Coordinator全試験1,211 / 1,211、Repository全体Checker（356 Markdown、2,169 links、674 anchors、Error 0、Warning 0）を確認した。これは実装と機械確認の完了であり、最新固定改訂版の独立レビューおよび§6.8の監査集合が完了するまで本CHGを最終Passへ昇格しない。

## 7. 影響と対象外

実際の影響:

- 内部Scriptのnative TypeScript実行とstrict型検査
- Warningを再発させないBiome Gate
- CRDD所有の命名正本と型付き全数分類
- nested testを漏らさず0件成功を拒否する試験入口
- 開発E2Eと正式署名の分離、秘密入力前の完全な非秘密検査、および一般利用者へRelease秘密を要求しない発行／検証境界
- Repository-local `.crdd`のignore-by-defaultと、非秘密のCommit固定Repository設定だけを許す明示例外
- 採用RepositoryのChecker Path移行とno-shim境界

対象外:

- 公開CheckerのSchema／意味変更
- Coordinator RuntimeのAuthority、Capability、EffectまたはProvider実行契約
- 過去CHG／Evidence／CHANGELOG内の当時Pathの改稿
- v0.17.0 Released Baselineの変更
- Candidateの実装だけによる採用、準拠、Stable化またはRelease

## 8. Release処置

2026-08-30、[実務自己適用で検出した4件の試験前提不一致](../CHG-000055/change.md#21-表示案から実装検証への接続)を同じ未リリース変更で是正した。`TEMP`／`TMP`をRepository-localへ置くと、試験用Pathが実RepositoryのGit境界と秘密鍵保存禁止範囲を継承していた。製品の境界判定を弱めず、鍵生成の実装と依存をbyte一致で確認した隔離配布環境へ配置し、その配布Rootの外側・実Repositoryの`.crdd`内へ試験専用鍵を出力する。配布Root内への出力拒否、暗号化・公開鍵対応、既存出力拒否、短いpassphrase拒否と出力不存在を確認する。

署名の不一致鍵試験は独立した試験鍵を作り、変更していない署名実装を隔離配布環境で実行する。署名側の外部鍵Path制限と固定公開鍵照合を両方維持し、`release_manifest_private_key_not_pinned`とmanifest未生成を確認する。Root解決の境界不存在試験は一時Directoryを作らず、実Repositoryが載るvolume rootを読み取りだけで検査する。同rootに`.git`がないという試験前提は明示検査し、成立しない環境をskipや成功へ変換しない。隔離環境と試験鍵は各試験の終了処理で回収し、対象不存在を確認する。公式鍵・実Provider・署名済み配布物は使用・変更しない。

関連3試験ファイル19件、試験型検査、変更3ファイルのLint／formatを確認した。既存の全試験をRepository-localな一時保存条件で再実行し、結果をCHG-000055へ接続する。今回の対象は4件の前提是正であり、全packageの通常試験入口が保存場所を自動強制することまでは保証しない。最終の独立監査・Release判断は未完了のまま維持する。

2026-08-31、実務残件の全機械確認で、同じ一時保存方針に対する二つの伝播漏れを追加是正した。新しいChange Intentではなく、本CHGの検査入口と試験前提の是正として扱う。

- Biomeの生成物除外が三つのE2E Directoryだけに限定され、`.crdd/release-staging`等に残る配布物の入れ子設定を読み込んで停止した。Repository-local `.crdd`全体とTool配下の旧生成領域を探索対象外にし、`tools`／`template/tools`の所有Sourceは検査対象に維持した。実際のBiomeを起動する回帰試験で、入れ子設定・不正な生成Sourceを無視しつつ、両所有Sourceの`debugger`をそれぞれ拒否することを確認する。除外前の失敗と除外後の成功を確認済みである。
- Checker試験の一時DirectoryからGitが親のCRDDを発見し、「非Git対象」の41件が期待と異なった。製品の探索や判定は変更せず、試験Processだけで`GIT_CEILING_DIRECTORIES`を一時Rootへ固定し、終了時に元の環境値を復元する。fixture自身に作るGit Repositoryは引き続き検査できる。代表3件と上記回帰試験は合格した。

通常利用者の設定、公開Checkerの結果契約、Provider Authority、署名境界は変更しない。全Checker試験、所有Sourceの型・Lint・Format、全体Checkerを再確認し、結果を[実務残件の記録](../CHG-000055/change.md#22-実務残件の横断確認と最終試験への接続)へ接続する。機械確認を最終独立監査の代用にはしない。

この段落を記録したv0.18.0公開前時点では本変更は未リリースであり、最新固定改訂版の全確認後にRelease統合へ引き渡す計画だった。v0.18.0はその後公開済みである。旧`CHG-000016`／`000018`のEvidence導線、採用側Path移行、no-shim、Node minimumおよびRollbackを確認した当時の記録として保持する。

上記のCHG統合方針について追加の人間判断は不要である。以下の配置移行で発生した履歴参照の判断とは区別する。

## 9. 内部ツールの工程別配置への移行

2026-08-31、人間の一括実施依頼と、`tools`に案内だけを残さず手順を作業フローへ分ける説明後の続行指示を受けて、既存の内部ツール整備意図に属する配置是正を開始した。新しいCHGや実行権限を作らず、本CHGの移行・検証・切戻し境界へ含める。

| 旧配置 | 現在の移行先 | 処置 |
|---|---|---|
| `tools/checker/` | `40_Develop/checker/` | 配布正本へ接続するprivate packageを一括移動 |
| `tools/coordinator/`のコード・テスト・ビルド・固定素材 | `40_Develop/coordinator/` | packageの深さと兄弟関係を維持。署名package固定Root、Task、型・命名・coverage・traceと試験fixtureを更新 |
| `tools/platform-access/` | `40_Develop/platform-access/` | Rust crateを一括移動。当時は配布済みnative成果物を移動対象外とした。後続の配布判断は下記に記録する |
| `tools/coding-standards.md` | [実装規約](../../../06_Architecture/99_Coding_Standards.md) | 設計工程へ移し、実装対象Rootを更新 |
| Coordinator README内の振る舞い・条件・限界 | [振る舞い仕様](../../../05_SPEC/01_Behavior_Specification.md) | 操作手順と実装方式から分離 |
| Coordinatorの設計・脅威モデル | [実行設計](../../../06_Architecture/Details/coordinator/01_Architecture.md)、[脅威モデル](../../../06_Architecture/Details/coordinator/02_Threat_Model.md) | 詳細を移し、[設計入口](../../../06_Architecture/01_Architecture.md)から責務と未確認範囲を示す |
| Coordinator README内の反復手順 | [Coordinator作業手順](../../../19_Workflows/01_Coordinator_Runtime.md) | 発行担当と利用者の操作、入力、停止、結果の返却先を区別 |
| 品質方針・確認方法・現在状態 | [品質の現在状態](../../../07_Quality/01_Quality_Center.md) | 標準の品質保証構成を使用。過去Evidenceを集め直さない |

この移行開始時点では、`template/tools`の採用先配布契約と`90_Release`内のnative成果物Pathを変更しない方針だった。後続の導入経路評価で、CRDD Repositoryをcloneまたはsubmoduleで取得した時点に、同じ基準版のRuntimeも利用可能であることを優先した。v0.18.0では配布正本を`template/tools/coordinator/`とし、`windows-x64/coordinator.exe`、`windows-x64/crdd-platform-access.exe`および配布manifestを同じ配布面へ集約した。現在のv0.18.1候補はCHG-000056により、単一`windows-x64/crdd-platform-access.exe`とrevision 5 manifestだけを現行配布契約とする。`40_Develop`はソース・build・試験、`90_Release`はCHG・Evidence・公開状態を所有し、実行物の配布面にはしない。旧`tools`への互換shim、起動alias、第二ソース、別Download、ZIP、自動取得またはインストーラは追加しない。切戻す場合は個別の旧Pathを混在させず、以前の固定Repository／署名配布一式へ戻す。既存のRuntime状態や認証Homeを配置変更の理由で削除しない。

v0.18.0で実施した実行物の移行対は、`90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe`から`template/tools/coordinator/windows-x64/coordinator.exe`、`90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe`から`template/tools/coordinator/windows-x64/crdd-platform-access.exe`である。[未署名Native配布物の再現確認](../CHG-000015/Evidence/260901_coordinator-native-distribution-verification.md)は当時の2組のbytesとSource入力を固定した履歴であり、現在のv0.18.1候補、正式署名または署名済みE2Eを代替しない。

### 移行前の確認と追加是正

旧boolean probe専用facadeと専用試験を除去し、現行Taskへ実子Process・所有Filesystemを接続する5シナリオの結合試験を追加した。新試験を開発E2Eコマンドとその契約試験の双方へ接続した。既存6件と新試験2件の命名違反はlocal bindingだけを是正し、公開Schema keyと意味は維持した。移行前の正規package DirectoryでCoordinator全試験1,410/1,410、命名7/7を確認した。リポジトリ直下からpackage相対試験を誤起動した失敗は合格へ含めない。この結果は移行前の比較基準であり、新配置の検証を代替しない。

### 現在の未完了事項

新配置の機械検証と開発E2Eは実行した範囲で合格した。配置移行差分の独立レビューは実装側Pass、文書側の軽微3件も是正後の限定再レビューで解消確認済み・追加指摘0となった。[対象・結果・除外・是正履歴](./Evidence/260831_tool-layout-verification.md)を参照する。過去の固定Evidence5文書にある旧Pathへの9リンクは、人間が承認した限定的な歴史参照として、原文、旧Git内容および現在の後継を区別して検証した。未知のリンクエラーは抑制しない。最新正式署名E2Eは[48515ebの4経路・復旧・実Task取消](../../Releases/v0.18.0/Evidence/260901_coordinator-signed-e2e.md#signed-e2e-48515eb)を実測した。コード・試験の限定再確認に続き、結果記録と現在案内の限定確認も完了した。その後、UX／IA／UIを含む工程整備と全体の完成監査を完了し、[候補内容・移行方針の採用記録](../CHG-000014/change.md#candidate-adoption-20260901)へ接続した。完了したロードマップ項目は整理済みであり、main統合・Release判断は別に残る。

再起動後の着手前照合で、公開済みCHG6文書にある別の13リンクは、公開当時の参照ではなく、後の移行で追加した「現在の移設先」案内だと確認した。`v0.17.0`と基準HEADの差分により由来を確認し、固定Evidenceの例外対象には含めない。対象はCHG-000001／000002／000004／000005／000007／000010。人間の明示承認を受け、この13案内の表示Pathとリンク先だけを`40_Develop/checker/`へ更新した。既存の当時の判断・検証記録は変更せず、歴史参照の検証は9リンクに限定する。

新配置の開発E2Eは239/239件合格した。[対象と限界を含む検証結果](./Evidence/260831_tool-layout-development-e2e.md)へ接続し、正式署名・実Provider・移行全体の完了根拠とは区別する。旧ルート`tools`は空であることと非linkの実Directoryであることを確認して非再帰削除した。`template/tools`と既存の認証・Runtime状態は削除していない。


<a id="tool-experience-design"></a>

### 利用者設計の補完と詳細文書の再構成

2026-08-31、人間から、正式署名E2E・完成監査へ進む前に強化済み工程に沿ってUX、UI、UIと仕様の対応を文書化する指示を受けた。同じTool工程整備の不足補完として本CHGへ含め、新CHGを作らない。

[利用体験](../../../02_UX/01_User_Experience.md)、[情報構造](../../../03_IA/01_Information_Architecture.md)、[操作・表示](../../../04_UI/01_User_Interface.md)を既存実装からの再構成候補として作成し、仕様と検証設計へ接続した。通常利用者、フロントAI、復旧担当、Checker利用者、開発・配布担当を区別する。新GUI、Runtime挙動変更、Authority拡張、正式署名、過去Evidenceの改稿は行わない。基準はHEAD `d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9`に既存の工程別配置差分を加えた作業状態である。

着手前に親担当が22／23／24／25とDiscovery、公開CLI、結果表示、同意・取消・候補・Checkerの実装／試験を照合し、独立した文書担当が工程責務とCLI適用境界を読み取り専用で確認した。主因は既存規則の適用不足であり、新しい汎用マトリクス規則は追加しない。25_UIの行単位CLIに対する参照媒体の扱いだけは明確化候補として人間へ提示し、無断でN/Aまたは規則変更にしない。

文書化で検出した実装・検証差は[UI未解決事項](../../../04_UI/06_Current_Interface_Reference.md#open-issues)へ、義務と確認方法は[検証設計](../../../07_Quality/03_Verification_Design.md#tool-user-experience-verification)へ接続する。Qual-LabのRuntime保守が正式署名候補を固定する前に是正・再確認する。文書の独立レビューと、UI工程の完了・人間による移行判断は別に扱う。

続いて人間から、詳細アーキテクチャが「移動しただけ」に見えるとの指摘を受けた。SPEC、実行アーキテクチャ、脅威モデルには長段落、現行条件・補正経緯・未接続候補の混在が残る。配置の正当性・リンク・意味保存を確認した以前の限定Passを、工程成果物としての再構成完了へ流用しない。内部の契約は保持し、操作／状態／責務と判断理由から辿れる構造へ再構成する必要がある。対象母集団にはアーキテクチャ概要、品質3入口、Workflowも含め、単なる行数・ファイル名だけで判定しない。

読み取り専用の横断確認では、SPECの公開契約と内部方式の混在、設計詳細と脅威モデルの履歴・現行条件・未接続候補の混在、Workflowの利用可能コマンドと構文候補の混在を確認した。一方、設計の状態・資源・Lock・回収・遷移表は再利用できる。全廃や機械的改行ではなく、既存の有効な設計を軸に所有責務を戻す。

意味の不一致も検出した。設計の是正許可行と`INV-BOUNDED-REMEDIATION`には「自由文Hashだけ」「自由文本文は別Providerへ転送しない」が残っていたが、現行`provider-task-packet-runtime.ts`は`reviewerDefectClaim: finding.message`とHashを搬送する。送信許可、Validator、Task Packetを照合し、設計2か所を上限付き指摘本文・Secret検査・同一Executorへの一回限定・命令として不採用という現行契約へ合わせた。Traceの同一Executor・一回制約は既に一致しており、Schema、送信許可または実行コードは変更していない。今回の限定独立再確認で、この説明差の是正を確認した。

仕様は公開入力を先に置き、結果、取消、指摘是正、診断、未接続準備候補、送信・候補保存・選定、固定検証を分けた。内部producer・完了搬送・Process poisonの3段落は内容を保持して実行アーキテクチャへ移管し、仕様から参照した。設計ではDocker回復とSupervisorの巨大な段落を、取得前条件、停止位置、回収、利用側、終了後条件へ展開し、既存の状態・資源・Lock表を維持した。脅威モデルは資産・境界・脅威を先頭に戻し、現在制御、未接続候補、固定版の履歴を分離した。Workflowは構文候補と通常利用を区別し、署名の固有秘密鍵Pathを用途の分かるplaceholderへ置き換えた。

これらは内容構造の第一回是正であり、長段落の全解消、設計と実ソース全体の一致、UI実装差の解消、実端末での利用品質を主張しない。文書の重複詳細と未接続候補の記述には追加精査が残るため、既存の未完了事項と最終固定前の再確認を維持する。


2026-08-31、今回の11文書を固定し、文書・影響・準拠と設計・安全性・試験の2観点群で独立確認した。初回は各Minor 2件、計4件。推論強度別と残っていたturn上限の説明、通常doctorの一時領域生成・回収の説明、現行通信経路と未接続準備候補の混在、利用者設計節と歴史台帳の階層を是正した。両確認者へ統合方針を再提示して整合後に適用し、限定再確認は双方Pass・追加指摘0。実行コード、権限、算定式、固定Evidenceは変更していない。

是正後の全体Checkerは380文書・2,540リンク・836アンカー、固定歴史参照24件のIdentity確認24件、active／indexed残存0、エラー0・警告0（2026-08-31T09:35:17.058Z）。関連する構造化結果・Task Packet・人間向け表示の3試験ファイルは28/28合格、Runtime traceabilityの確認はacceptedだった。機械確認は文書の意味、実端末での操作、実Providerまたは新配置の正式署名E2Eを証明しない。今回のPassは文書再構成候補と合意した4件の是正に限定し、UI全工程、既知表示差、実端末確認およびRuntime全体完成の未完了を維持する。

この時点の全体Checkerは380文書・2,528リンク・831アンカーを確認し、エラー0・警告0だった。ただし意味の不一致と設計再構成不足はこの機械検査では検出できていない。新しいUX／IA／UI候補の独立レビュー、既知差の是正、実端末確認、通常工程移行は未完了である。今回の直接編集はCRDD Coordinator Runtime経由ではなく親担当が行っており、原因をRuntimeの選定やモデルへ帰属させない。親担当の計画が配置・意味保存の確認へ偏り、工程成果物としての再構成を完了条件へ落とせていなかった点を是正する。

<a id="tool-layout-historical-references"></a>

### Checker・Windows内部部品への設計範囲の補完

利用者からCoordinatorだけへ設計が偏っているとの指摘を受け、同じ配置・工程整備の意図内で対象を補完した。Checkerは独立した検査ツール、platform-accessは限定したOS観測・操作を担う内部部品と区別する。新しいCHG、GUI、汎用Recovery機構は追加しない。

着手前に3名の読み取り専用担当がCheckerの配布本体・範囲・報告、RustとTSの操作境界・資源、公開CLIの結果producerと表示consumerを分担して照合し、全結果を計画へ統合した。[Checker設計](../../../06_Architecture/Details/checker/01_Architecture.md)、[Windows内部部品設計](../../../06_Architecture/Details/platform-access/01_Architecture.md)、[Checker手順](../../../19_Workflows/02_Checker.md)を追加し、共通UX／IA／UI／SPEC／検証設計から接続した。実装の移動だけでなく、責務、非目標、設計理由、検査範囲、失敗時の保証限界を記述する。

同時に結果表示の実装差を是正した。未取得booleanを否定へ補正せず、未知の操作・状態・理由を直接表示しない。候補export成功を理由欠落から失敗表示にせず、停止・回復不明・再起動必要では候補操作を案内しない。回復IDの重複排除と全形式の保持、Date範囲外の期限も確認する。公開JSON、Authority、Provider選定・実行、署名境界は変更しない。

2026-08-31、表示契約・CLI取消投影・実子Processとの接続試験28件が成功した。実子Process試験は正常、非ゼロ終了、取消、close不明、Host回収拒否の結果を人間表示まで渡す。実Provider・Docker・実端末・署名済み配布物を使った証明ではない。今回の追加範囲の独立確認、最新全体試験とE2E、工程移行・Release判断は未完了として保持する。

追加範囲の実行結果と独立確認は[品質記録の追加確認](./Evidence/260831_tool-layout-verification.md#3部品の設計補完結果表示の追加確認)に集約した。関連開発E2Eは旧表示assertion是正後289/289、Checker全契約試験207/207。文書の事前照合でも、参照コマンドの値必須条件と処理順を取り逃がしたため、説明の粒度だけでなく実際の引数parserと処理順へ照合する必要がある。既存の設計・実装・試験照合規則の適用課題として記録し、新しい汎用規則やCHGは増やさない。

<a id="quality-document-naming"></a>

### 品質文書の番号付き配置

2026-08-31、人間から品質フォルダの命名も統一する指示を受け、同じ工程別配置の是正として[品質保証の固定構成](../../../16_Quality_Assurance.md#42-fixed-quality-structure)を更新した。品質の現在状態、方針、検証設計の責務は変えず、探索順が分かる名前へ揃える。新CHG、互換ファイル、全Markdownへの番号義務は追加しない。既存利用側のPathが変わるため、変更分類は`breaking`、移行は必要とする。統合・Releaseの判断は別である。

| 旧名（`07_Quality/`内） | 新名（同じDirectory） |
|---|---|
| `Quality_Center.md` | `01_Quality_Center.md` |
| `Quality_Strategy.md` | `02_Quality_Strategy.md` |
| `Verification_Design.md` | `03_Verification_Design.md` |

公式と配布ひな型の6ファイル、品質規則の構成図・責務表、Overview、Skill例、配布AI入口、各工程ひな型、現行の設計・仕様・案内・品質参照、およびChecker試験fixtureを同時に更新する。Checker本体に旧名依存はなく、採用先へ新しい機械エラー条件を追加しない。保守用の契約試験で、規則・公式・ひな型の一致と旧名・片側移行・欠落・順序違いの拒否を確認する。PL-16は品質規則を参照するためIDや品質責務を変更せず、新配置への追従を確認する。

採用側は次の順序で移行する。

1. 現行基準版、旧3文書、利用者の追記、参照・スクリプトを棚卸しする。新名が既に存在する、複数文書が同じ責務を主張する、または履歴の固定条件が不明なら、上書き・削除せず照合してから判断する。
2. 文書内容・アンカー・品質判定を保持して上表どおり改名し、現在使用する参照と接続部を更新する。旧名の互換コピーを残さない。品質保証を適用しない対象には空文書を作らない。
3. 通常リンク、番号付き構成、ひな型、関連準拠基準を確認し、移行の独立確認と基準版有効化の人間判断へ接続する。
4. 確認が完了するまでは旧基準版を維持する。失敗時はファイル配置と参照・接続部を一組で戻し、利用者の追記や移行記録を失わない。

`Verification_Results/`、日付付き結果名、結果ひな型は維持する。開発E2E結果の末尾2リンクは現在の品質文書への案内として更新し、当時の対象・Hash・実結果は変更しない。固定Evidence、公開済みCHG本文、過去CHANGELOGは書き換えず、今回の移行を過去実測の更新として扱わない。先行する設計改名の確認記録も当時の範囲を保持する。

### 完成監査の現在表示と検証記録の是正

2026-09-01、固定版`98ccc9d`への全体独立確認を3系統で実施し、[5件の指摘と処置](../CHG-000015/Evidence/260901_coordinator-completion-review.md)へ統合した。本CHGでは、保護操作を裸のRuntimeで起動する古いpackage案内3件の除去と回帰試験、診断・復旧の固定日本語表示、品質記録への伝播を所有する。現行の未到達分岐評価と再確認を継続し、修正済みを指摘解消または全体完成へ昇格しない。

後続の境界試験と未到達評価も同じCHGへ接続し、品質の現在状態、検証設計、結果、ロードマップを同期する。追加した試験コードの変数名2か所を既存命名規則が検出したため、規則の例外や新しいCHGを作らず、当該試験内で是正した。最新の実行結果と過去の固定測定を分離し、完了前の行をロードマップから削除しない。

[署名版4f10201の4経路・復旧・実Task取消](../../Releases/v0.18.0/Evidence/260901_coordinator-signed-e2e.md)が成立し、`4f10201`へ至る当時の修正と実測記録の限定独立確認は完了した。以下の失敗・是正経緯は保持し、Quality Centerと現在案内だけを新しい根拠へ同期する。固定設計や過去Evidenceを後続結果で書き換えず、全Runtime・v0.18・Releaseは未完了のままとする。

Tree `687699ed`の一括完成監査で、UIとCHGの実測済み事項がUX／IA／SPEC／Roadmapの現在案内へ反映されていないこと、および現在の分岐網羅率の分子・分母・未計測範囲への接続不足を確認した。同じ未リリース変更内で、現在状態だけを同期し、過去の固定結果は変更しない。文書5件は`3495bcd1`で限定再確認Pass。その後に検出したArchitecture冒頭の同種箇所も水平是正へ含める。

[Runtime側の是正](../CHG-000015/change.md#完成監査後の限定是正)は、実Providerの是正1往復と、実Process終了処理の共有・取消試験を所有する。本CHGは工程別文書と品質記録への伝播を所有し、新しいCHGや規範を作らない。工程Pass、全体完成、統合・Releaseは自動昇格せず、[品質の現在状態](../../../07_Quality/01_Quality_Center.md)から未確認部分と担当・再確認条件を辿れるようにする。

後続の実Task取消は、OS通知到達・通常回収失敗・正規Recovery成功を観測した。詳細を[追加検証結果](../CHG-000015/Evidence/260831_coordinator-closure-verification.md#public-task-cancellation-observation)へ集約し、Quality Center、Architecture、UX／UI、検証設計の現在案内を同期する。以前の「OS未確認」を過去runでは保持し、現在は是正後再実測待ちと区別する。固定Evidenceや過去の限定Passは書き換えない。

[追加検証の記録](../CHG-000015/Evidence/260831_coordinator-closure-verification.md)では、分岐網羅率の対象155ファイル、重複計測7ファイル、未ロード4ファイルとNative未測定を分離した。全体試験の失敗と限定試験の成功も併記し、先行する全試験合格を現在状態へ流用しない。Process所有部品の移設で検査対象一覧の更新漏れも検出したため、既存の水平伝播確認の対象に、実行主体を列挙する契約試験を含めて是正する。

### 利用者確認の収束と端末参照媒体

端末参照の確認プログラムと契約試験10件を追加し、UI入口とWorkflowから発見可能にした。正式同意やTaskの実行は行わず、現在のwriter／readerだけを使う。全試験の是正後結果はCoordinator 1,425/1,425、Checker 208/208、開発E2E 239/239。詳細とログ識別は[品質の結果](./Evidence/260831_tool-layout-verification.md#端末参照媒体と全体試験の再確認)へ集約する。実端末では時間切れ・取消・空入力拒否・値の読取りと不一致判定をrun別に観測し、表示例まで到達した。比較対象の数値が入力案内に混在して迷わせたため、参照の文言を入力する値だけに揃えて試験へ固定した。ユーザーは今回のPowerShellで折返し・拡大後も日本語と長いIDを読めたと回答した。この限定確認は完了とし、別のWindows Terminal環境、読み上げ、実Task取消等の未評価範囲、今回差分の完成監査と工程移行は保持する。

2026-08-31、基準`08cdd26`から残件1〜5を継続した。表示の三値化・固定日本語説明・候補操作の抑止は限定再確認済みだったが、UIと検証設計に未解消の記述が残っていたため、現在の品質状態だけを同期した。過去の結果を上書きせず、実端末・全体監査の未完了は維持する。

人間は、行単位CLIをHTMLではなく再実行可能な端末表示・操作例で確認する方針と、Windows Terminal／PowerShellの日本語・キーボード・折返し・拡大を当面の対象とし、読み上げは未評価と明示する方針を承認した。UI規則の責務・網羅・完了・監査・参照媒体と配布ひな型を同期し、画面構成型TUI、GUIとの混在、判定情報不足を分ける。媒体選択をUI責務の免除にせず、Web等の既存の代表HTML要件、人間判断、専門確認、実装との既知差更新は維持する。意味上は既存UI検証責務の媒体明確化であり、新しい工程・中央台帳・安定ID・Runtime権限を追加しない。採用側は既存の参照媒体を表示面ごとに照合し、端末確認の未実施を合格へ読み替えない。

着手前照合は文書・準拠と実装・試験の2観点で行った。発火例は人間向けの行CLI、非発火例は人間向け表示を持たない内部バイナリprotocol、境界例はTUIまたはGUIとの混在、情報不足例は表示方式・操作・対象端末が不明な場合とした。内部protocolにも上位表示への伝播確認は残し、混在は表示面ごと、不明は調査・判断待ちとして扱う。

全Coordinator試験の初回再実行では1,415件中1,414件が合格し、手順書に個人固有の秘密鍵Pathを要求していた1試験が失敗した。手順は既に承認済み絶対Pathのplaceholderへ一般化していたため、個人Pathへ戻さず試験を現在契約へ同期した。保護操作の絶対Path・固定Node・Effect前検査は緩めていない。

Checker全試験は208件中207件が合格し、品質命名の新試験で3つの配列変数が複数形規約に不適合だった。対象試験・型・Lintの成功だけでは内部全数命名検査を代替できなかったため、変数名を是正し、全数検査を含む試験集合へ戻す。規則の抑制、例外追加、過去の限定確認を全体成功へ読み替える処置は行わない。

試験起動時には、親のShellで相対一時Pathの取得失敗を停止へ結合できず、一度試験を開始して中断した。中断実行は合格根拠から除外し、OS一時Rootの直近の変更一覧では該当残存物を確認しなかった。ただしこの一覧だけで全資源不存在を保証しない。再実行ではRepository直下の絶対Path・通常Directory・非reparseを検証し、Shellエラー時は試験開始前に停止する。一般規則の不足ではなく、既存の起動条件を強制する接続が不足した事例として、試験入口を固定する既存の後続確認へ接続する。

## 10. 配置移行後に固定履歴を読む方法

固定Evidence5文書の9リンク出現だけを対象とする。同じ文書・旧対象・アンカーの重複をまとめると9組となる。原文と旧Pathは変更・再作成しない。通常のリンクは現在のファイルへ解決し、この台帳の完全一致した固定履歴だけを別に検証する。

- 現在の実装は次の案内から開く。下記の機械可読記録では`successorPath`に同じ後継を記録する。旧リンク自体は現在のファイルへの直接リンクにはならない。
- 移行直前の内容は`git show <targetCommit>:<targetPath>`で読む。`targetBlobOid`とSHA-256から同じGit実体か確認できる。Markdownのアンカーはその旧内容に対して確認する。
- `evidenceCommit`は原文を固定した移行直前の基準であり、各実測の実行Commitではない。過去の実測対象・dirty差分・制約は元Evidenceを読む。この台帳は当時実行されたbyteや移行後コードの実測を新たに証明しない。
- CHGや現行文書は対象に含めない。Evidenceという配置だけでは足りず、固定Commitと原文全体のSHA-256、実際の参照組が一致することを確認する。
- 原文変更、未知の組、Git実体または旧アンカーの欠落、後継の欠落・リンク境界は拒否する。後継の存在は意味の同一性の証明ではなく、意味の移行は本変更の独立レビューで確認する。
- 旧対象が作業ツリーまたはGit indexに残る場合も拒否し、それぞれ`historical_references_active`と`historical_references_indexed`へ別に数える。削除をstageしていない移行途中は、ファイルが見えなくても合格にしない。台帳で識別した組と、歴史参照として検証を通した組を区別し、indexにある状態を検証済みへ含めない。

現在の後継は次の3件である。

- [Windows nativeカバレッジ集計](../../../40_Develop/coordinator/scripts/check-platform-access-coverage.ts)
- [TypeScript接続部カバレッジ集計](../../../40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts)
- [Coordinator実行設計](../../../06_Architecture/Details/coordinator/01_Architecture.md)

<!-- crdd-tool-layout-historical-references: 1 -->
```json
{
  "schemaRevision": 1,
  "evidenceCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
  "references": [
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_0ef4f73b.md",
      "sourceSha256": "0ef4f73b9ba04f95cd21471f5f890fa02d8965e0bf063fd672467cbc49c1a967",
      "targetPath": "tools/coordinator/scripts/check-platform-access-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "1cc8cbba827b5151f2890131ebd76f2d44ffe9d2",
      "targetSha256": "99ce72a51d0510bf1d194839f3bcfcec6bb41cc4efbc9036c7f6f490e670e30c",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_0ef4f73b.md",
      "sourceSha256": "0ef4f73b9ba04f95cd21471f5f890fa02d8965e0bf063fd672467cbc49c1a967",
      "targetPath": "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "dd6977576c599a39a042563ec4f7b6bc73e431fd",
      "targetSha256": "c6a8ed5b8fe421df19cf272fc1dae303626f641d08d2586ca18cb9e4fb6b5066",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_2ce29c02.md",
      "sourceSha256": "2ce29c020398e555b59c8ee2d67b2f5473b8eba73d526e21c464a04a9a659720",
      "targetPath": "tools/coordinator/scripts/check-platform-access-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "1cc8cbba827b5151f2890131ebd76f2d44ffe9d2",
      "targetSha256": "99ce72a51d0510bf1d194839f3bcfcec6bb41cc4efbc9036c7f6f490e670e30c",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_2ce29c02.md",
      "sourceSha256": "2ce29c020398e555b59c8ee2d67b2f5473b8eba73d526e21c464a04a9a659720",
      "targetPath": "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "dd6977576c599a39a042563ec4f7b6bc73e431fd",
      "targetSha256": "c6a8ed5b8fe421df19cf272fc1dae303626f641d08d2586ca18cb9e4fb6b5066",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_38f6a310.md",
      "sourceSha256": "3cd1a42ceebe35ddcb30f303ea2a829d54dead785614457f4891ac1dbfb9bd4e",
      "targetPath": "tools/coordinator/scripts/check-platform-access-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "1cc8cbba827b5151f2890131ebd76f2d44ffe9d2",
      "targetSha256": "99ce72a51d0510bf1d194839f3bcfcec6bb41cc4efbc9036c7f6f490e670e30c",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_38f6a310.md",
      "sourceSha256": "3cd1a42ceebe35ddcb30f303ea2a829d54dead785614457f4891ac1dbfb9bd4e",
      "targetPath": "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "dd6977576c599a39a042563ec4f7b6bc73e431fd",
      "targetSha256": "c6a8ed5b8fe421df19cf272fc1dae303626f641d08d2586ca18cb9e4fb6b5066",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_76b90bcc.md",
      "sourceSha256": "76b90bccd9cb46bb122781a32ba0cf0a0c3393e8c833c68cf2884991a4520e9d",
      "targetPath": "tools/coordinator/scripts/check-platform-access-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "1cc8cbba827b5151f2890131ebd76f2d44ffe9d2",
      "targetSha256": "99ce72a51d0510bf1d194839f3bcfcec6bb41cc4efbc9036c7f6f490e670e30c",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_76b90bcc.md",
      "sourceSha256": "76b90bccd9cb46bb122781a32ba0cf0a0c3393e8c833c68cf2884991a4520e9d",
      "targetPath": "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "dd6977576c599a39a042563ec4f7b6bc73e431fd",
      "targetSha256": "c6a8ed5b8fe421df19cf272fc1dae303626f641d08d2586ca18cb9e4fb6b5066",
      "successorPath": "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
      "anchor": null
    },
    {
      "sourcePath": "90_Release/Changes/Evidence/CHG-000055_Focused_Dogfooding_588f04f.md",
      "sourceSha256": "06010bac9e74e716755e2fc8d095a39cee999c9d7305c2cd4f0b5ad6b50bd95a",
      "targetPath": "tools/coordinator/architecture/README.md",
      "targetCommit": "d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9",
      "targetBlobOid": "3b8f95c72a0da9576e2e353dce01a0fa9515a9eb",
      "targetSha256": "72add62c772f1a40abd14b63037e54bb7b1af355a78980870957e22bd58f5a35",
      "successorPath": "06_Architecture/Details/coordinator/01_Architecture.md",
      "anchor": "9-正常準正常異常"
    }
  ]
}
```


<a id="released-navigation-migration"></a>

## 11. 公開済み変更記録に後から追加した現行案内の移行

人間が承認した6文書・13箇所の「現在の試験移設先」案内だけを新配置へ更新した。過去の判断・実装Path・実測・公開内容の記録は変えない。既存変更台帳の固定Commit・byte数・SHA-256も保持する。

検査では固定Git原文のSHA-256を確認し、以下の完全一致するMarkdownリンクだけを指定回数置換して期待する全文を生成する。対象外本文、0件・過不足、重複、未知source、後継欠落・リンク境界は拒否する。HEADは固定原文または置換後全文、作業ツリーは置換後全文だけを許可し、作業ツリーのCRLF/LF差以外を正規化しない。記録のない公開済みCHGは従来の全文不変確認を維持する。

この13案内は現在の通常リンクであり、固定Evidence9件の歴史参照件数には含めない。

<!-- crdd-released-navigation-migration: 1 -->
```json
{
  "schemaRevision": 2,
  "sources": [
    {
      "sourcePath": "90_Release/Changes/CHG-000001_Human_Decision_Presentation.md",
      "sourceSha256": "f569968819724d5765bec1d4cf4a3b10a11641082bd6e5c5878a2e5a054e6833",
      "replacements": [
        {
          "before": "[`tools/checker/crdd-check.contract.test.ts`](../../tools/checker/crdd-check.contract.test.ts)",
          "via": "[`40_Develop/checker/crdd-check.contract.test.ts`](../../40_Develop/checker/crdd-check.contract.test.ts)",
          "after": "[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)",
          "count": 2
        }
      ]
    },
    {
      "sourcePath": "90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md",
      "sourceSha256": "851bee26bdbb7c292b591ca5a87e8e9aaeed9c261776e34eba1cd03fbb84b1d3",
      "replacements": [
        {
          "before": "[`tools/checker/crdd-check.contract.test.ts`](../../tools/checker/crdd-check.contract.test.ts)",
          "via": "[`40_Develop/checker/crdd-check.contract.test.ts`](../../40_Develop/checker/crdd-check.contract.test.ts)",
          "after": "[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)",
          "count": 3
        }
      ]
    },
    {
      "sourcePath": "90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md",
      "sourceSha256": "3ce1df556590c7ef204eb8da2fd75232807b0030f7edd2089d905cbe97e55618",
      "replacements": [
        {
          "before": "[`tools/checker/crdd-check.contract.test.ts`](../../tools/checker/crdd-check.contract.test.ts)",
          "via": "[`40_Develop/checker/crdd-check.contract.test.ts`](../../40_Develop/checker/crdd-check.contract.test.ts)",
          "after": "[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)",
          "count": 1
        }
      ]
    },
    {
      "sourcePath": "90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md",
      "sourceSha256": "3339466c6810774effdf40900c141087366097f3ec7fde24789b97ea2ac23af3",
      "replacements": [
        {
          "before": "[`tools/checker/crdd-check.contract.test.ts`](../../tools/checker/crdd-check.contract.test.ts)",
          "via": "[`40_Develop/checker/crdd-check.contract.test.ts`](../../40_Develop/checker/crdd-check.contract.test.ts)",
          "after": "[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)",
          "count": 2
        },
        {
          "before": "[`tools/checker/fault-injector.ts`](../../tools/checker/fault-injector.ts)",
          "after": "[`40_Develop/checker/tests/support/fault-injector.ts`](../../../40_Develop/checker/tests/support/fault-injector.ts)",
          "count": 2
        }
      ]
    },
    {
      "sourcePath": "90_Release/Changes/CHG-000007_Multi_Location_Remediation.md",
      "sourceSha256": "c3eb4344ff1ce7f372ef3e5c1a10cf4b8bede37183c5271cee8f60ba05026164",
      "replacements": [
        {
          "before": "[`tools/checker/crdd-check.contract.test.ts`](../../tools/checker/crdd-check.contract.test.ts)",
          "via": "[`40_Develop/checker/crdd-check.contract.test.ts`](../../40_Develop/checker/crdd-check.contract.test.ts)",
          "after": "[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)",
          "count": 1
        }
      ]
    },
    {
      "sourcePath": "90_Release/Changes/CHG-000010_First_Pass_Convergence.md",
      "sourceSha256": "1af36f2eccd4fe6ca5c75c9b9f385dad0d40602b009f42a706fb97db95892686",
      "replacements": [
        {
          "before": "[`tools/checker/crdd-check.contract.test.ts`](../../tools/checker/crdd-check.contract.test.ts)",
          "via": "[`40_Develop/checker/crdd-check.contract.test.ts`](../../40_Develop/checker/crdd-check.contract.test.ts)",
          "after": "[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)",
          "count": 2
        }
      ]
    }
  ]
}
```
