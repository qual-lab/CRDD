# 責務再編 — 基準ファイルと利用側の棚卸し

状態: Draft — 段階1の母集団固定。確定移管表ではない。
担当責任者: Qual-Lab
対象: CHG-000082、2026-10-07
基準改訂版: `463dd4a1ffd86e8bf5c58bb37a92e2ba11984621`（Git object format: sha1）

## 結論

全18領域のGit管理対象830ファイルを一次キーとして固定した。下表は現在の計画から導いた処置案であり、ファイル本文・関数の責務・全利用側・過去根拠の照合前に移動や削除を許可するものではない。段階1は未完了である。実行結果の書庫ではなく、[再編計画](261007_develop-responsibility-mapping.md#23-責務再編を完了させる計画)の作業表として更新する。

## 分母と取得範囲

- 分母: 基準改訂版の`git ls-files 40_Develop`。生成cache、依存install物、ignored Runtimeは含めない。
- 静的利用側: `40_Develop`と`template/tools`の追跡TS／TSX／MJSから相対importを解決した312関係・173利用側File。type importとvalue importは未分離。
- 子Process入口、package script、固定Path、動的import、JSON設定、Manifest閉包、Workflow、実行環境と過去Evidenceはこの静的集合では網羅しない。後続照合で追加する。
- 基準分母は830。Headerが責務を具体的に説明しないFileもあり、Header名だけを最終配置判断にしない。

## 領域ごとの母集団

| 現領域 | ファイル数 | 目標Owner |
|---|---:|---|
| ai-runtime | 14 | ai-adapter |
| artifact-signing | 11 | artifact-signing |
| checker | 28 | checker |
| coordinator | 444 | coordinator |
| crdd-domain-library | 33 | domain-model |
| cros | 29 | cros |
| execution-intelligence | 21 | execution-intelligence |
| mcp | 30 | mcp-server |
| official-asset-governance | 10 | official-asset-governance |
| platform-access | 19 | platform-access |
| project-operation | 18 | domain-model |
| project-runtime | 48 | orchestrator |
| runtime-data | 18 | domain-model |
| semantic-coverage | 18 | semantic-coverage |
| verification-runner | 13 | verification-runner |
| version-control | 36 | version-control |
| visual-preview | 10 | visual-preview |
| workbench | 30 | workbench-server |

## 全ファイルの処置案

Pathは基準版におけるRepository相対Pathである。同じFileの行を更新し、完了Fileの別コピーを作らない。新設・廃止予定Fileは確定設計後に明示追加する。行の存在、機械的な改名先または試験Fileの移動だけでは能力保持を証明しない。

| 基準File | 処置案 | 目標Owner／配置 | 未完了の確認 |
|---|---|---|---|
| 40_Develop/ai-runtime/package-lock.json | 統合・更新案 | 40_Develop/ai-adapter/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/ai-runtime/package.json | 統合・更新案 | 40_Develop/ai-adapter/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/ai-runtime/src/ai-profile-types.ts | 移管案 | 40_Develop/ai-adapter/src/ai-profile-types.ts | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/src/catalog-store.ts | 移管案 | 40_Develop/ai-adapter/src/catalog-store.ts | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/src/catalog.ts | 移管案 | 40_Develop/ai-adapter/src/catalog.ts | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/src/default-ai-profile-catalog.json | 移管案 | 40_Develop/ai-adapter/src/default-ai-profile-catalog.json | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/src/index.ts | 移管案 | 40_Develop/ai-adapter/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/src/profile-administration.ts | 移管案 | 40_Develop/ai-adapter/src/profile-administration.ts | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/src/registry.ts | 移管案 | 40_Develop/ai-adapter/src/registry.ts | 内部配置・本文照合待ち |
| 40_Develop/ai-runtime/symbol.json | 統合・更新案 | 40_Develop/ai-adapter/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/ai-runtime/tests/ai-profile-catalog.contract.test.ts | 移管案 | 40_Develop/ai-adapter/tests/ai-profile-catalog.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/ai-runtime/tests/integration/ai-profile-catalog-store.integration.test.ts | 移管案 | 40_Develop/ai-adapter/tests/integration/ai-profile-catalog-store.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts | 移管案 | 40_Develop/ai-adapter/tests/integration/ai-profile-consumers.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/ai-runtime/tsconfig.json | 統合・更新案 | 40_Develop/ai-adapter/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/artifact-signing/package-lock.json | 維持＋参照更新案 | 40_Develop/artifact-signing/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/artifact-signing/package.json | 維持＋参照更新案 | 40_Develop/artifact-signing/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/artifact-signing/src/index.ts | 維持案 | 40_Develop/artifact-signing/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/artifact-signing/src/one-shot-authorization.ts | 維持案 | 40_Develop/artifact-signing/src/one-shot-authorization.ts | 内部配置・本文照合待ち |
| 40_Develop/artifact-signing/src/private-key-signing.ts | 維持案 | 40_Develop/artifact-signing/src/private-key-signing.ts | 内部配置・本文照合待ち |
| 40_Develop/artifact-signing/src/signature-result.ts | 維持案 | 40_Develop/artifact-signing/src/signature-result.ts | 内部配置・本文照合待ち |
| 40_Develop/artifact-signing/src/terminal-secret-input.ts | 維持案 | 40_Develop/artifact-signing/src/terminal-secret-input.ts | 内部配置・本文照合待ち |
| 40_Develop/artifact-signing/symbol.json | 維持＋参照更新案 | 40_Develop/artifact-signing/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/artifact-signing/tests/integration/private-key-signing.integration.test.ts | 維持案 | 40_Develop/artifact-signing/tests/integration/private-key-signing.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/artifact-signing/tests/unit/one-shot-authorization.contract.test.ts | 維持案 | 40_Develop/artifact-signing/tests/unit/one-shot-authorization.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/artifact-signing/tsconfig.json | 維持＋参照更新案 | 40_Develop/artifact-signing/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/checker/.gitignore | 維持案 | 40_Develop/checker/.gitignore | 内部配置・本文照合待ち |
| 40_Develop/checker/bin/crdd-check.ts | 維持案 | 40_Develop/checker/bin/crdd-check.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/package-lock.json | 維持＋参照更新案 | 40_Develop/checker/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/checker/package.json | 維持＋参照更新案 | 40_Develop/checker/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/checker/src/adapters/artifact-relation.ts | 維持案 | 40_Develop/checker/src/adapters/artifact-relation.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/adapters/domain-outcome.ts | 維持案 | 40_Develop/checker/src/adapters/domain-outcome.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/adapters/reality-test-catalog.ts | 維持案 | 40_Develop/checker/src/adapters/reality-test-catalog.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/adapters/reality-traceability.ts | 維持案 | 40_Develop/checker/src/adapters/reality-traceability.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/application/checker-command.ts | 維持案 | 40_Develop/checker/src/application/checker-command.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/findings/finding-model.ts | 維持案 | 40_Develop/checker/src/findings/finding-model.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/index.ts | 維持案 | 40_Develop/checker/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/pipeline/checker-pipeline.ts | 維持案 | 40_Develop/checker/src/pipeline/checker-pipeline.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/profiles/current-profile.ts | 維持案 | 40_Develop/checker/src/profiles/current-profile.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/rules/current-profile.ts | 維持案 | 40_Develop/checker/src/rules/current-profile.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/rules/quality-design-state.ts | 維持案 | 40_Develop/checker/src/rules/quality-design-state.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/rules/reality-symbol-graph.ts | 維持案 | 40_Develop/checker/src/rules/reality-symbol-graph.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/src/rules/rule-registry.ts | 維持案 | 40_Develop/checker/src/rules/rule-registry.ts | 内部配置・本文照合待ち |
| 40_Develop/checker/symbol.json | 維持＋参照更新案 | 40_Develop/checker/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/checker/template-tools-tsconfig.json | 維持案 | 40_Develop/checker/template-tools-tsconfig.json | 内部配置・本文照合待ち |
| 40_Develop/checker/tests/integration/crdd-check.contract.test.ts | 維持案 | 40_Develop/checker/tests/integration/crdd-check.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/integration/domain-outcome-adapter.contract.test.ts | 維持案 | 40_Develop/checker/tests/integration/domain-outcome-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/integration/tools-naming.contract.test.ts | 維持案 | 40_Develop/checker/tests/integration/tools-naming.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/support/fault-injector.ts | 維持案 | 40_Develop/checker/tests/support/fault-injector.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/support/test-discovery.ts | 維持案 | 40_Develop/checker/tests/support/test-discovery.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/test-runner.ts | 維持案 | 40_Develop/checker/tests/test-runner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/unit/checker-core.contract.test.ts | 維持案 | 40_Develop/checker/tests/unit/checker-core.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tests/unit/symbol-graph.contract.test.ts | 維持案 | 40_Develop/checker/tests/unit/symbol-graph.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/checker/tsconfig.json | 維持＋参照更新案 | 40_Develop/checker/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/coordinator/.gitignore | 維持案 | 40_Develop/coordinator/.gitignore | 内部配置・本文照合待ち |
| 40_Develop/coordinator/bin/coordinator.ts | 維持案 | 40_Develop/coordinator/bin/coordinator.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/package-lock.json | 維持＋参照更新案 | 40_Develop/coordinator/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/coordinator/package.json | 維持＋参照更新案 | 40_Develop/coordinator/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/coordinator/runtime/claude-managed-settings.json | 維持案 | 40_Develop/coordinator/runtime/claude-managed-settings.json | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/claude-provider.Dockerfile | 維持案 | 40_Develop/coordinator/runtime/claude-provider.Dockerfile | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/claude-task-settings.json | 維持案 | 40_Develop/coordinator/runtime/claude-task-settings.json | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/codex-advice-provider.Dockerfile | 維持案 | 40_Develop/coordinator/runtime/codex-advice-provider.Dockerfile | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/codex-executor-result-schema.json | 維持案 | 40_Develop/coordinator/runtime/codex-executor-result-schema.json | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/codex-executor-seccomp.json | 維持案 | 40_Develop/coordinator/runtime/codex-executor-seccomp.json | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/codex-provider.Dockerfile | 維持案 | 40_Develop/coordinator/runtime/codex-provider.Dockerfile | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/codex-result-schema.json | 維持案 | 40_Develop/coordinator/runtime/codex-result-schema.json | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/codex-reviewer-result-schema.json | 維持案 | 40_Develop/coordinator/runtime/codex-reviewer-result-schema.json | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/general-task-verification.txt | 維持案 | 40_Develop/coordinator/runtime/general-task-verification.txt | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile | 維持案 | 40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile | 内部配置・本文照合待ち |
| 40_Develop/coordinator/runtime/provider-egress-proxy.py | 維持案 | 40_Develop/coordinator/runtime/provider-egress-proxy.py | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/authenticate-claude-subscription.ts | 維持案 | 40_Develop/coordinator/scripts/authenticate-claude-subscription.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts | 維持案 | 40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-native-runtime-trace.ts | 維持案 | 40_Develop/coordinator/scripts/check-native-runtime-trace.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-platform-access-coverage.ts | 維持案 | 40_Develop/coordinator/scripts/check-platform-access-coverage.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts | 維持案 | 40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts | 維持案 | 40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-provider-authority-coverage.ts | 維持案 | 40_Develop/coordinator/scripts/check-provider-authority-coverage.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-provider-home-coverage.ts | 維持案 | 40_Develop/coordinator/scripts/check-provider-home-coverage.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-runtime-capability-graph.ts | 維持案 | 40_Develop/coordinator/scripts/check-runtime-capability-graph.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/check-runtime-traceability.ts | 維持案 | 40_Develop/coordinator/scripts/check-runtime-traceability.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/generate-release-key.ts | 維持案 | 40_Develop/coordinator/scripts/generate-release-key.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/measure-development-providers.ts | 維持案 | 40_Develop/coordinator/scripts/measure-development-providers.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/platform-access-coverage-path.ts | 維持案 | 40_Develop/coordinator/scripts/platform-access-coverage-path.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/prepare-codex-advice-image.ts | 維持案 | 40_Develop/coordinator/scripts/prepare-codex-advice-image.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/prepare-release-candidate.ts | 維持案 | 40_Develop/coordinator/scripts/prepare-release-candidate.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/prepare-release-runtime.ts | 維持案 | 40_Develop/coordinator/scripts/prepare-release-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/project-runtime-design-traceability.ts | 維持案 | 40_Develop/coordinator/scripts/project-runtime-design-traceability.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts | 維持案 | 40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/promote-release-manifest.ts | 維持案 | 40_Develop/coordinator/scripts/promote-release-manifest.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/release-manifest-promotion.ts | 維持案 | 40_Develop/coordinator/scripts/release-manifest-promotion.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/release-staging-manifest.ts | 維持案 | 40_Develop/coordinator/scripts/release-staging-manifest.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/revoke-external-send-consent.ts | 維持案 | 40_Develop/coordinator/scripts/revoke-external-send-consent.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/runtime-traceability.ts | 維持案 | 40_Develop/coordinator/scripts/runtime-traceability.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/sign-release-manifest.ts | 維持案 | 40_Develop/coordinator/scripts/sign-release-manifest.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/sign-release-terminal.ts | 維持案 | 40_Develop/coordinator/scripts/sign-release-terminal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verification-result-reasons.ts | 維持案 | 40_Develop/coordinator/scripts/verification-result-reasons.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verification-result-record.ts | 維持案 | 40_Develop/coordinator/scripts/verification-result-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts | 維持案 | 40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts | 維持案 | 40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-native-protection.ts | 維持案 | 40_Develop/coordinator/scripts/verify-native-protection.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-native-terminal-fixtures.ts | 維持案 | 40_Develop/coordinator/scripts/verify-native-terminal-fixtures.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts | 維持案 | 40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts | 維持案 | 40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-signed-general-task.ts | 維持案 | 40_Develop/coordinator/scripts/verify-signed-general-task.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts | 維持案 | 40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts | 維持案 | 40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/scripts/verify-signed-route-matrix.ts | 維持案 | 40_Develop/coordinator/scripts/verify-signed-route-matrix.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/authority-file-bundle.ts | 維持案 | 40_Develop/coordinator/src/authority/authority-file-bundle.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/authority-grant-verifier.ts | 維持案 | 40_Develop/coordinator/src/authority/authority-grant-verifier.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/authority-prelaunch-verifier.ts | 維持案 | 40_Develop/coordinator/src/authority/authority-prelaunch-verifier.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/authority-root-path-lexical.ts | 維持案 | 40_Develop/coordinator/src/authority/authority-root-path-lexical.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/authority-trust-loader.ts | 維持案 | 40_Develop/coordinator/src/authority/authority-trust-loader.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/local-personal-authority-runtime.ts | 維持案 | 40_Develop/coordinator/src/authority/local-personal-authority-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/runtime-trust-evaluator.ts | 維持案 | 40_Develop/coordinator/src/authority/runtime-trust-evaluator.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/authority/secret-material-policy.ts | 維持案 | 40_Develop/coordinator/src/authority/secret-material-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/candidate/candidate-bundle-store.ts | 維持案 | 40_Develop/coordinator/src/candidate/candidate-bundle-store.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/candidate/candidate-store-windows-adapter.ts | 維持案 | 40_Develop/coordinator/src/candidate/candidate-store-windows-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/cli-options.ts | 維持案 | 40_Develop/coordinator/src/cli/cli-options.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/command-report.ts | 維持案 | 40_Develop/coordinator/src/cli/command-report.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/coordinator-command.ts | 維持案 | 40_Develop/coordinator/src/cli/coordinator-command.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/coordinator-launch.ts | 維持案 | 40_Develop/coordinator/src/cli/coordinator-launch.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/interactive-console-reader-lifecycle-internal.ts | 維持案 | 40_Develop/coordinator/src/cli/interactive-console-reader-lifecycle-internal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/interactive-console-reader.ts | 維持案 | 40_Develop/coordinator/src/cli/interactive-console-reader.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/interactive-console.ts | 維持案 | 40_Develop/coordinator/src/cli/interactive-console.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/cli/task-cli-cancellation.ts | 維持案 | 40_Develop/coordinator/src/cli/task-cli-cancellation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/development-execution-timing.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/development-execution-timing.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/docker-desktop-repair-doctor-dispatch.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/docker-desktop-repair-doctor-dispatch.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/docker-recovery-command-report.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/docker-recovery-command-report.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/doctor.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/doctor.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/native-runtime-trace.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/native-runtime-trace.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/platform-access-release.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/platform-access-release.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/provisioning-signature-primitives.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/provisioning-signature-primitives.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/release-identity-grammar.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/release-identity-grammar.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/diagnostics/signed-runner-safety-observation.ts | 維持案 | 40_Develop/coordinator/src/diagnostics/signed-runner-safety-observation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-current-artifact-trust.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-current-artifact-trust.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-continuation-store.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-continuation-store.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-history-publication.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-history-publication.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-native-process-lifecycle.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-native-process-lifecycle.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-native-process.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-native-process.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-record-store.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-repair-record-store.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-desktop-runtime-repair.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-desktop-runtime-repair.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-continuation-record.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-continuation-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-execution.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-execution.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-handoff-record.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-handoff-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-machine.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-machine.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-record.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-runtime.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-restart-state.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-restart-state.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-desktop/docker-wsl-state.ts | 維持案 | 40_Develop/coordinator/src/docker-desktop/docker-wsl-state.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-cleanup-eligibility.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-cleanup-eligibility.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-cli-trust.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-cli-trust.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-container-init-observation.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-container-init-observation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-effect-runtime.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-effect-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-host-transition-state.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-host-transition-state.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-isolation.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-isolation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-owned-process.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-owned-process.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-process-controller-result-reasons.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-process-controller-result-reasons.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-process-controller.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-process-controller.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-identity.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-identity.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-lock-controller.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-lock-controller.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-public-projection.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-public-projection.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-record-model.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-record-model.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime-internal.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime-internal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-state-machine.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-recovery-state-machine.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/docker-runtime/docker-runtime-state-binding.ts | 維持案 | 40_Develop/coordinator/src/docker-runtime/docker-runtime-state-binding.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/external-send/egress-proxy-policy.ts | 維持案 | 40_Develop/coordinator/src/external-send/egress-proxy-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/external-send/external-send-consent-record.ts | 維持案 | 40_Develop/coordinator/src/external-send/external-send-consent-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/external-send/external-send-consent-runtime.ts | 維持案 | 40_Develop/coordinator/src/external-send/external-send-consent-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/external-send/external-send-grant-runtime.ts | 維持案 | 40_Develop/coordinator/src/external-send/external-send-grant-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/external-send/external-send-policy-runtime.ts | 維持案 | 40_Develop/coordinator/src/external-send/external-send-policy-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock-lifecycle-internal.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock-lifecycle-internal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/candidate-store-lock-worker.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/candidate-store-lock-worker.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/execution-environment.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/execution-environment.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-generation-loss-transition.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-generation-loss-transition.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-operation-inprocess-lease-internal.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-operation-inprocess-lease-internal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-operation-lock-supervisor.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-operation-lock-supervisor.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-orphan-recovery-policy.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-orphan-recovery-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-recovery-namespace-windows-adapter.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-recovery-namespace-windows-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-recovery-record.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-recovery-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-terminal-caller-checkpoint.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-terminal-caller-checkpoint.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-terminal-caller-lease.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-terminal-caller-lease.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-terminal-record.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-terminal-record.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/host-terminal-windows-adapter.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/host-terminal-windows-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/node-runtime-version.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/node-runtime-version.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/runtime-local-typescript-child-entrypoints.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/runtime-local-typescript-child-entrypoints.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/runtime-process-safety-state.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/runtime-process-safety-state.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/windows-child-environment.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/windows-child-environment.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/host-runtime/windows-directory-bootstrap.ts | 維持案 | 40_Develop/coordinator/src/host-runtime/windows-directory-bootstrap.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/index.ts | 維持案 | 40_Develop/coordinator/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/plain-data-snapshot.ts | 維持案 | 40_Develop/coordinator/src/plain-data-snapshot.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-access-adapter.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-access-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-key-storage-policy.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-key-storage-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-manifest-loader.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-manifest-loader.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-package-filesystem.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-package-filesystem.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-package-gate.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-package-gate.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-policy-identity.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-policy-identity.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-release-identity.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-release-identity.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-release-trust.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-release-trust.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-trust-core.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-trust-core.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/project-runtime/docker-project-recovery-settlement.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/execution-intelligence-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-acceptance-authority-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-acceptance-decision-store.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-candidate-integration-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-composition-root.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-decision-capability-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-decision-recovery-store.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-durable-foundation.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-execution-authorization-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-execution-host-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-history.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-integration-record-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-objective-intake.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-public-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-single-task-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-task-recovery-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-windows-decision-store.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-windows-platform-adapter.ts | 移管・分割案 | orchestratorの実行／判断／保存接続（§14・§23C） | Coordinator側の呼出し境界を本文照合 |
| 40_Develop/coordinator/src/provider/claude-docker-runtime-adapter.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/claude-execution-plan.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/claude-structured-result.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/claude-subscription-authentication.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/codex-advice-distribution.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/codex-docker-runtime-adapter.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/codex-execution-plan.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/codex-executor-seccomp.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/codex-structured-result.ts | 分割案 | Provider固有計画・出力はai-adapter、Docker資源・認証lifecycleはcoordinator | 関数単位の分割と逆依存照合待ち |
| 40_Develop/coordinator/src/provider/delegation-route-selection.ts | 維持案 | 40_Develop/coordinator/src/provider/delegation-route-selection.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/delegation-selection-grant-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/delegation-selection-grant-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-authority-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-authority-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-billing-policy.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-billing-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-eligibility-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-eligibility-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-home-mount-grant-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-home-mount-grant-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-home-mount-grant.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-home-mount-grant.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-home-observation.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-home-observation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-home-windows-adapter.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-home-windows-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-home.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-home.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-isolation-profile.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-isolation-profile.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-lifecycle.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-lifecycle.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-model-profile-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-model-profile-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-model-selection-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-model-selection-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-task-packet-runtime.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-task-packet-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/provider/provider-task-structured-result.ts | 維持案 | 40_Develop/coordinator/src/provider/provider-task-structured-result.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/coordinator-operation-creation-internal.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/coordinator-operation-creation-internal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/repository-operation-runtime.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/repository-operation-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/repository-workspace-runtime.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/repository-workspace-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/root-observation.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/root-observation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/root-protection-policy.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/root-protection-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/bounded-file-snapshot.ts | 維持案 | 40_Develop/coordinator/src/state-storage/bounded-file-snapshot.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/coordinator-state-model.ts | 維持案 | 40_Develop/coordinator/src/state-storage/coordinator-state-model.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/coordinator-state-runtime.ts | 維持案 | 40_Develop/coordinator/src/state-storage/coordinator-state-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/docker-recovery-journal.ts | 維持案 | 40_Develop/coordinator/src/state-storage/docker-recovery-journal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/coordinator-task-request.ts | 維持案 | 40_Develop/coordinator/src/task/coordinator-task-request.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/coordinator-task-result-reasons.ts | 維持案 | 40_Develop/coordinator/src/task/coordinator-task-result-reasons.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/coordinator-task-runtime.ts | 維持案 | 40_Develop/coordinator/src/task/coordinator-task-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/development-measurement-constraints.ts | 維持案 | 40_Develop/coordinator/src/task/development-measurement-constraints.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/development-measurement-session.ts | 維持案 | 40_Develop/coordinator/src/task/development-measurement-session.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-dispatch-runtime.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-dispatch-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-execution-plan.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-execution-plan.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-production-runtime.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-production-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-command.ts | 移管案 | 40_Develop/ai-adapter/src/（Provider別接続） | 公開入力・結果契約の照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-executor.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-executor.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-output.ts | 移管案 | 40_Develop/ai-adapter/src/（Provider別接続） | 公開入力・結果契約の照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-result.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-result.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-runtime-packet.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-runtime-packet.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-task.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-task.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-change-candidate-runtime.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-change-candidate-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-provider-adapter.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-provider-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-repository-composition.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-repository-composition.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-request-application.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-ai-request-application.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-candidate-application.ts | 維持案 | 40_Develop/coordinator/src/workbench-ai/workbench-candidate-application.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/symbol.json | 維持＋参照更新案 | 40_Develop/coordinator/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/coordinator/tests/fixtures/candidate-store-lock-owner.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/candidate-store-lock-owner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-command-owner.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-command-owner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-recovery-owner.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-recovery-owner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/coordinator-launch-terminal-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/coordinator-launch-terminal-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json | 維持案 | 40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/docker-handoff-worker.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/docker-handoff-worker.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/docker-owned-process-test-support.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/docker-owned-process-test-support.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/docker-owned-process-worker.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/docker-owned-process-worker.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/fixed-runtime-signing-fixture.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/fixed-runtime-signing-fixture.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/git-packed-object-fixture.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/git-packed-object-fixture.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/native-terminal-oracles.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/native-terminal-oracles.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-current-ports.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-current-ports.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-lease-interleaving-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-lease-interleaving-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-lease-race-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-lease-race-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-cancellation.txt | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-cancellation.txt | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-verification.txt | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-verification.txt | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/project-runtime-snapshot-lock-owner.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/project-runtime-snapshot-lock-owner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/release-manifest-promotion-racer.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/release-manifest-promotion-racer.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/repository-test-directory-fixture.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/repository-test-directory-fixture.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/task-controller-cancellation-fixture.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/task-controller-cancellation-fixture.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/windows-native-helper-environment-unavailable.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/windows-native-helper-environment-unavailable.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/fixtures/windows-native-helper-profile-fault.ts | 維持案 | 40_Develop/coordinator/tests/fixtures/windows-native-helper-profile-fault.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/cli-options.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/cli-options.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-desktop-repair-continuation-store.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-desktop-repair-continuation-store.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-restart-execution.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-restart-execution.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-restart-machine.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-restart-machine.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-restart-real-observation.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-restart-real-observation.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/docker-restart-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/docker-restart-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/host-recovery-namespace.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/host-recovery-namespace.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/native-protection-entry.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/native-protection-entry.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/native-terminal-oracles.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/native-terminal-oracles.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/prepare-release-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/prepare-release-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-history.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-history.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/release-candidate-preparation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/release-candidate-preparation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/runtime-trust-evaluator.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/runtime-trust-evaluator.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/runtime-trust-package-gate.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/runtime-trust-package-gate.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/sign-release-terminal.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/sign-release-terminal.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/support/candidate-store-kernel-lock-harness.ts | 維持案 | 40_Develop/coordinator/tests/support/candidate-store-kernel-lock-harness.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/support/helpers/docker-desktop-repair-history-publication-testing.ts | 維持案 | 40_Develop/coordinator/tests/support/helpers/docker-desktop-repair-history-publication-testing.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/support/interactive-console-child-harness.ts | 維持案 | 40_Develop/coordinator/tests/support/interactive-console-child-harness.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/support/runtime-trace-case.ts | 維持案 | 40_Develop/coordinator/tests/support/runtime-trace-case.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/support/test-support.ts | 維持案 | 40_Develop/coordinator/tests/support/test-support.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/support/unsigned-runtime-fixture.ts | 維持案 | 40_Develop/coordinator/tests/support/unsigned-runtime-fixture.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts | 維持案 | 40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/docker-session-handoff.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/docker-session-handoff.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/project-runtime-acceptance-decision.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/project-runtime-acceptance-decision.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/project-runtime-recovery.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/project-runtime-recovery.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/release-manifest-promotion.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/release-manifest-promotion.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/signed-reviewer-boundary-verification.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/signed-reviewer-boundary-verification.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/claude-subscription-authentication.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/claude-subscription-authentication.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/command-report.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/command-report.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/coordinator-state-model.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/coordinator-state-model.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-restart-continuation-record.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-restart-continuation-record.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-restart-handoff-record.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-restart-handoff-record.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-restart-record.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-restart-record.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-restart-state.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-restart-state.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/docker-wsl-state.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/docker-wsl-state.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/doctor.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/doctor.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/project-runtime-decision-capability-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/project-runtime-decision-capability-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/project-runtime-execution-authorization-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/project-runtime-execution-authorization-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/project-runtime-execution-host-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/project-runtime-execution-host-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/project-runtime-profile-transport.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/project-runtime-profile-transport.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-home.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-home.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/root-observation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/root-observation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-dispatch-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-dispatch-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-command.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-command.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-output.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-output.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-change-candidate-runtime.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-change-candidate-runtime.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tests/unit/workbench-ai-request-application.contract.test.ts | 維持案 | 40_Develop/coordinator/tests/unit/workbench-ai-request-application.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/coordinator/tsconfig.strict.json | 維持＋参照更新案 | 40_Develop/coordinator/tsconfig.strict.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/coordinator/tsconfig.tests.json | 維持＋参照更新案 | 40_Develop/coordinator/tsconfig.tests.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/crdd-domain-library/package-lock.json | 統合・更新案 | 40_Develop/domain-model/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/crdd-domain-library/package.json | 統合・更新案 | 40_Develop/domain-model/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts | 移管案 | 40_Develop/domain-model/src/artifact/artifact-graph.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/artifact/artifact-model.ts | 移管案 | 40_Develop/domain-model/src/artifact/artifact-model.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/artifact/index.ts | 移管案 | 40_Develop/domain-model/src/artifact/index.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts | 移管案 | 40_Develop/domain-model/src/artifact/markdown-artifact-parser.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/artifact/schema-validator.ts | 移管案 | 40_Develop/domain-model/src/artifact/schema-validator.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/filesystem-store-root/filesystem-store-kernel-lock-worker.ts | 移管案 | 40_Develop/domain-model/src/storage/filesystem-store-kernel-lock-worker.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts | 移管案 | 40_Develop/domain-model/src/storage/index.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/index.ts | 移管案 | 40_Develop/domain-model/src/index.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/outcome.ts | 移管案 | 40_Develop/domain-model/src/outcome.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/quality-change-control/index.ts | 移管案 | 40_Develop/domain-model/src/quality-change-control/index.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/quality-change-control/quality-gate.ts | 移管案 | 40_Develop/domain-model/src/quality-change-control/quality-gate.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/domain-issue.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/domain-issue.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/index.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/index.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/symbol-annotation.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/symbol-discovery.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/symbol-graph.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/symbol-manifest-model.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts | 移管案 | 40_Develop/domain-model/src/reality-traceability/symbol-manifest-validator.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts | 移管案 | 40_Develop/domain-model/src/repository/filesystem-repository-observer.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/repository-observation/index.ts | 移管案 | 40_Develop/domain-model/src/repository/index.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/src/repository-observation/reality-symbol-repository-observer.ts | 移管案 | 40_Develop/domain-model/src/repository/reality-symbol-repository-observer.ts | 公開subpathと保存／Root境界を照合 |
| 40_Develop/crdd-domain-library/symbol.json | 統合・更新案 | 40_Develop/domain-model/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-contender.ts | 移管案 | 40_Develop/domain-model/tests/fixtures/filesystem-store-lock-contender.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-owner.ts | 移管案 | 40_Develop/domain-model/tests/fixtures/filesystem-store-lock-owner.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/integration/quality-change-control.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/quality-change-control.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/reality-repository.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/system/quality-change-control.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/system/quality-change-control.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/unit/filesystem-store-root.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/unit/filesystem-store-root.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/unit/public-boundary.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/unit/public-boundary.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tests/unit/repository-observation.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/unit/repository-observation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/crdd-domain-library/tsconfig.json | 統合・更新案 | 40_Develop/domain-model/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/cros/bin/cros-access-recovery.ts | 維持案 | 40_Develop/cros/bin/cros-access-recovery.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/package-lock.json | 維持＋参照更新案 | 40_Develop/cros/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/cros/package.json | 維持＋参照更新案 | 40_Develop/cros/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/cros/src/application-contract.ts | 維持案 | 40_Develop/cros/src/application-contract.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/connection-credential.ts | 維持案 | 40_Develop/cros/src/connection-credential.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/credential-access-recovery-cli.ts | 維持案 | 40_Develop/cros/src/credential-access-recovery-cli.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/credential-access-recovery-file-adapter.ts | 維持案 | 40_Develop/cros/src/credential-access-recovery-file-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/credential-access-recovery.ts | 維持案 | 40_Develop/cros/src/credential-access-recovery.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/credential-registry-file-adapter.ts | 維持案 | 40_Develop/cros/src/credential-registry-file-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/index.ts | 維持案 | 40_Develop/cros/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/project-federation.ts | 維持案 | 40_Develop/cros/src/project-federation.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/remote-transport.ts | 分割後廃止案 | CROS認可能力＋MCP Server、REST実装は置換後撤去 | 保持能力の全分岐と既存利用側照合待ち |
| 40_Develop/cros/src/runtime.ts | 維持案 | 40_Develop/cros/src/runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/src/shared-server-config-file-adapter.ts | 分割・改名案 | CROS構成とMCP配置（名称未固定） | 公開設定Schema・読取り・Front AI移行照合 |
| 40_Develop/cros/src/tool-registry.ts | 維持案 | 40_Develop/cros/src/tool-registry.ts | 内部配置・本文照合待ち |
| 40_Develop/cros/symbol.json | 維持＋参照更新案 | 40_Develop/cros/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/cros/tests/integration/connection-credential.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/connection-credential.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/cros-core.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/cros-core.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/project-federation.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/project-federation.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/remote-transport.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/remote-transport.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/shared-server-config-file-adapter.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/shared-server-config-file-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/surface-contract.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/surface-contract.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/integration/tool-registry.contract.test.ts | 維持案 | 40_Develop/cros/tests/integration/tool-registry.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/system/context-handoff.contract.test.ts | 維持案 | 40_Develop/cros/tests/system/context-handoff.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/system/result-return.contract.test.ts | 維持案 | 40_Develop/cros/tests/system/result-return.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tests/system/session-access.contract.test.ts | 維持案 | 40_Develop/cros/tests/system/session-access.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/cros/tsconfig.json | 維持＋参照更新案 | 40_Develop/cros/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/execution-intelligence/.gitignore | 維持案 | 40_Develop/execution-intelligence/.gitignore | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/package-lock.json | 維持＋参照更新案 | 40_Develop/execution-intelligence/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/execution-intelligence/package.json | 維持＋参照更新案 | 40_Develop/execution-intelligence/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts | 維持案 | 40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/application/execution-record-projection.ts | 維持案 | 40_Develop/execution-intelligence/src/application/execution-record-projection.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/application/record-projection.ts | 維持案 | 40_Develop/execution-intelligence/src/application/record-projection.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/boundary/plain-data-snapshot.ts | 維持案 | 40_Develop/execution-intelligence/src/boundary/plain-data-snapshot.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/core/bounded-integrated-result-evaluation.ts | 維持案 | 40_Develop/execution-intelligence/src/core/bounded-integrated-result-evaluation.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/core/execution-intelligence.ts | 維持案 | 40_Develop/execution-intelligence/src/core/execution-intelligence.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/core/temporal-provenance.ts | 維持案 | 40_Develop/execution-intelligence/src/core/temporal-provenance.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/index.ts | 維持案 | 40_Develop/execution-intelligence/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts | 維持案 | 40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/src/store/verified-repository-root.ts | 維持案 | 40_Develop/execution-intelligence/src/store/verified-repository-root.ts | 内部配置・本文照合待ち |
| 40_Develop/execution-intelligence/symbol.json | 維持＋参照更新案 | 40_Develop/execution-intelligence/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/execution-intelligence/tests/fixtures/execution-intelligence-store-writer.ts | 維持案 | 40_Develop/execution-intelligence/tests/fixtures/execution-intelligence-store-writer.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts | 維持案 | 40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/execution-intelligence/tests/integration/execution-record-projection.contract.test.ts | 維持案 | 40_Develop/execution-intelligence/tests/integration/execution-record-projection.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/execution-intelligence/tests/integration/record-projection.contract.test.ts | 維持案 | 40_Develop/execution-intelligence/tests/integration/record-projection.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/execution-intelligence/tests/unit/execution-intelligence.contract.test.ts | 維持案 | 40_Develop/execution-intelligence/tests/unit/execution-intelligence.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/execution-intelligence/tests/unit/temporal-provenance.contract.test.ts | 維持案 | 40_Develop/execution-intelligence/tests/unit/temporal-provenance.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/execution-intelligence/tsconfig.json | 維持＋参照更新案 | 40_Develop/execution-intelligence/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/mcp/package-lock.json | 統合・更新案 | 40_Develop/mcp-server/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/mcp/package.json | 統合・更新案 | 40_Develop/mcp-server/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/mcp/src/adapters/application-adapter.ts | 移管案 | 40_Develop/mcp-server/src/adapters/application-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/adapters/project-context-adapter.ts | 移管案 | 40_Develop/mcp-server/src/adapters/project-context-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/adapters/project-runtime-adapter.ts | 移管案 | 40_Develop/mcp-server/src/adapters/project-runtime-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/adapters/topic-meeting-adapter.ts | 移管案 | 40_Develop/mcp-server/src/adapters/topic-meeting-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/boundary/plain-data-snapshot.ts | 移管案 | 40_Develop/mcp-server/src/boundary/plain-data-snapshot.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/composition/cros-project-context-application.ts | 移管案 | 40_Develop/mcp-server/src/composition/cros-project-context-application.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/composition/cros-shared-server.ts | 置換後廃止案 | mcp-serverの単一Listenerと外部TLS配置 | Origin・認可・終了保証の置換を設計 |
| 40_Develop/mcp/src/index.ts | 移管案 | 40_Develop/mcp-server/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/protocol/project-context-protocol.ts | 移管案 | 40_Develop/mcp-server/src/protocol/project-context-protocol.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/protocol/project-runtime-protocol.ts | 移管案 | 40_Develop/mcp-server/src/protocol/project-runtime-protocol.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/protocol/topic-meeting-protocol.ts | 移管案 | 40_Develop/mcp-server/src/protocol/topic-meeting-protocol.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/protocol/unambiguous-json-document.ts | 移管案 | 40_Develop/mcp-server/src/protocol/unambiguous-json-document.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/transports/process-signal-shutdown.ts | 移管案 | 40_Develop/mcp-server/src/transports/process-signal-shutdown.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/transports/request-handler.ts | 移管案 | 40_Develop/mcp-server/src/transports/request-handler.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/transports/stdio-transport.ts | 移管案 | 40_Develop/mcp-server/src/transports/stdio-transport.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/src/transports/streamable-http-transport.ts | 移管案 | 40_Develop/mcp-server/src/transports/streamable-http-transport.ts | 内部配置・本文照合待ち |
| 40_Develop/mcp/symbol.json | 統合・更新案 | 40_Develop/mcp-server/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts | 移管案 | 40_Develop/mcp-server/tests/integration/cros-project-context-mcp.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/integration/cros-shared-server.integration.test.ts | 移管案 | 40_Develop/mcp-server/tests/integration/cros-shared-server.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts | 移管案 | 40_Develop/mcp-server/tests/integration/topic-meeting-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/integration/transport-lifecycle.contract.test.ts | 移管案 | 40_Develop/mcp-server/tests/integration/transport-lifecycle.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts | 移管案 | 40_Develop/mcp-server/tests/system/cros-projection-non-disclosure.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/system/cros-shared-server-entry.integration.test.ts | 移管案 | 40_Develop/mcp-server/tests/system/cros-shared-server-entry.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/system/stdio-transport.integration.test.ts | 移管案 | 40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts | 移管案 | 40_Develop/mcp-server/tests/system/streamable-http-transport.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts | 移管案 | 40_Develop/mcp-server/tests/unit/project-context-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts | 移管案 | 40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/mcp/tsconfig.json | 統合・更新案 | 40_Develop/mcp-server/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/official-asset-governance/package-lock.json | 維持＋参照更新案 | 40_Develop/official-asset-governance/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/official-asset-governance/package.json | 維持＋参照更新案 | 40_Develop/official-asset-governance/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/official-asset-governance/src/index.ts | 維持案 | 40_Develop/official-asset-governance/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/official-asset-governance/src/official-asset-governance.ts | 維持案 | 40_Develop/official-asset-governance/src/official-asset-governance.ts | 内部配置・本文照合待ち |
| 40_Develop/official-asset-governance/src/official-asset-store.ts | 維持案 | 40_Develop/official-asset-governance/src/official-asset-store.ts | 内部配置・本文照合待ち |
| 40_Develop/official-asset-governance/symbol.json | 維持＋参照更新案 | 40_Develop/official-asset-governance/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/official-asset-governance/tests/fixtures/asset-decision-worker.ts | 維持案 | 40_Develop/official-asset-governance/tests/fixtures/asset-decision-worker.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/official-asset-governance/tests/integration/asset-governance.contract.test.ts | 維持案 | 40_Develop/official-asset-governance/tests/integration/asset-governance.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/official-asset-governance/tests/unit/revision-conflict.contract.test.ts | 維持案 | 40_Develop/official-asset-governance/tests/unit/revision-conflict.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/official-asset-governance/tsconfig.json | 維持＋参照更新案 | 40_Develop/official-asset-governance/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/platform-access/.gitignore | 維持案 | 40_Develop/platform-access/.gitignore | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/Cargo.lock | 維持＋参照更新案 | 40_Develop/platform-access/Cargo.lock | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/platform-access/Cargo.toml | 維持＋参照更新案 | 40_Develop/platform-access/Cargo.toml | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/platform-access/build.rs | 維持案 | 40_Develop/platform-access/build.rs | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/rust-toolchain.toml | 維持＋参照更新案 | 40_Develop/platform-access/rust-toolchain.toml | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/platform-access/src/docker_authenticode.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/docker_repair.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/host_namespace_protocol.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/main.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/protocol.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/terminal_protocol.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/windows.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/windows_directory.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/windows_owned_child.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/src/windows_terminal.rs | 維持案 | platform-access内：process／filesystem／docker-desktop／protocol（Rust名は維持） | Native内部責務とProtocol・Build閉包の本文照合 |
| 40_Develop/platform-access/symbol.json | 維持＋参照更新案 | 40_Develop/platform-access/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/platform-access/tests/cli.rs | 維持案 | 40_Develop/platform-access/tests/cli.rs | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/platform-access/tests/fixtures/host_namespace_creation.rs | 維持案 | 40_Develop/platform-access/tests/fixtures/host_namespace_creation.rs | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/platform-access/tests/fixtures/windows_protection.rs | 維持案 | 40_Develop/platform-access/tests/fixtures/windows_protection.rs | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/package-lock.json | 統合・更新案 | 40_Develop/domain-model/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-operation/package.json | 統合・更新案 | 40_Develop/domain-model/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-operation/src/index.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/project-operation.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/repository-project-context.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/repository-quality-projection.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/repository-release-projection.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/topic-meeting-application.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/topic-meeting-repository.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/src/topic-meeting.ts | 統合・分割案 | domain-modelのproject-context／topic／meeting／quality-change-control | TopicとMeetingの結合処置・候補判断を関数照合 |
| 40_Develop/project-operation/symbol.json | 統合・更新案 | 40_Develop/domain-model/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-operation/tests/integration/candidate-adoption.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/candidate-adoption.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/tests/integration/project-projection.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/project-projection.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/repository-project-context.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/topic-meeting-application.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/topic-meeting-record.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/topic-meeting-repository.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-operation/tsconfig.json | 統合・更新案 | 40_Develop/domain-model/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-runtime/package-lock.json | 統合・更新案 | 40_Develop/orchestrator/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-runtime/package.json | 統合・更新案 | 40_Develop/orchestrator/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-runtime/src/application/project-runtime-acceptance-decision.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-acceptance-decision.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-candidate-adoption.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-candidate-adoption.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-execution.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-execution.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-human-decision.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-human-decision.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-integration.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-integration.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-objective-application.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-objective-application.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-objective-intake.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-objective-intake.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-replanning.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-replanning.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/application/project-runtime-state-query.ts | 移管案 | 40_Develop/orchestrator/src/application/project-runtime-state-query.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/boundary/plain-data-snapshot.ts | 移管案 | 40_Develop/orchestrator/src/boundary/plain-data-snapshot.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/boundary/repository-relative-path.ts | 移管案 | 40_Develop/orchestrator/src/boundary/repository-relative-path.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/core/project-runtime-queue.ts | 移管案 | 40_Develop/orchestrator/src/core/project-runtime-queue.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/core/project-runtime-state.ts | 移管案 | 40_Develop/orchestrator/src/core/project-runtime-state.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/index.ts | 移管案 | 40_Develop/orchestrator/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/acceptance-decision-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/acceptance-decision-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/candidate-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/candidate-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/clock-identity-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/clock-identity-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/decision-capability-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/decision-capability-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/decision-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/decision-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/execution-authorization-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/execution-authorization-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/execution-observation-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/execution-observation-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/execution-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/execution-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/integration-record-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/integration-record-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/lease-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/lease-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/platform-contract.ts | 移管案 | 40_Develop/orchestrator/src/ports/platform-contract.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/port-result.ts | 移管案 | 40_Develop/orchestrator/src/ports/port-result.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/process-safety-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/process-safety-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/state-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/state-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/ports/task-recovery-port.ts | 移管案 | 40_Develop/orchestrator/src/ports/task-recovery-port.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/public-contract/decision-request.ts | 移管案 | 40_Develop/orchestrator/src/public-contract/decision-request.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/public-contract/integration-result.ts | 移管案 | 40_Develop/orchestrator/src/public-contract/integration-result.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/public-contract/objective-request.ts | 移管案 | 40_Develop/orchestrator/src/public-contract/objective-request.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/public-contract/project-state-query.ts | 移管案 | 40_Develop/orchestrator/src/public-contract/project-state-query.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/src/public-contract/runtime-result.ts | 移管案 | 40_Develop/orchestrator/src/public-contract/runtime-result.ts | 内部配置・本文照合待ち |
| 40_Develop/project-runtime/symbol.json | 統合・更新案 | 40_Develop/orchestrator/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/project-runtime/tests/integration/acceptance-decision-application.integration.test.ts | 移管案 | 40_Develop/orchestrator/tests/integration/acceptance-decision-application.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/candidate-adoption-application.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/candidate-adoption-application.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/execution-observation-port.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/execution-observation-port.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/human-decision-application.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/human-decision-application.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/integration-application.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/integration-application.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/objective-intake.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/objective-intake.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/platform-contract.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/platform-contract.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/project-state-query.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/project-state-query.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts | 移管案 | 40_Develop/orchestrator/tests/unit/public-contract.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/project-runtime/tsconfig.json | 統合・更新案 | 40_Develop/orchestrator/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/runtime-data/package-lock.json | 統合・更新案 | 40_Develop/domain-model/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/runtime-data/package.json | 統合・更新案 | 40_Develop/domain-model/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/runtime-data/src/core/runtime-data-contract.ts | 統合・分割案 | domain-modelのconfiguration／repository／storage | 設定・Root・保存の責務を関数照合 |
| 40_Develop/runtime-data/src/index.ts | 統合・分割案 | domain-modelのconfiguration／repository／storage | 設定・Root・保存の責務を関数照合 |
| 40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts | 統合・分割案 | domain-modelのconfiguration／repository／storage | 設定・Root・保存の責務を関数照合 |
| 40_Develop/runtime-data/src/platform/tool-runtime-config.ts | 統合・分割案 | domain-modelのconfiguration／repository／storage | 設定・Root・保存の責務を関数照合 |
| 40_Develop/runtime-data/src/store/temporary-operation-store.ts | 統合・分割案 | domain-modelのconfiguration／repository／storage | 設定・Root・保存の責務を関数照合 |
| 40_Develop/runtime-data/symbol.json | 統合・更新案 | 40_Develop/domain-model/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts | 移管案 | 40_Develop/domain-model/tests/fixtures/create-temporary-operation-and-exit.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts | 移管案 | 40_Develop/domain-model/tests/fixtures/resume-temporary-operation-and-exit.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/repository-runtime-data-paths.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/runtime-data-consumer-closure.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/temporary-operation-lifecycle.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/integration/tool-runtime-config.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/integration/tool-runtime-config.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/system/temporary-operation-cleanup.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/system/temporary-operation-cleanup.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/unit/runtime-data-contract.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/unit/runtime-data-contract.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tests/unit/runtime-data-path-resolver.contract.test.ts | 移管案 | 40_Develop/domain-model/tests/unit/runtime-data-path-resolver.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/runtime-data/tsconfig.json | 統合・更新案 | 40_Develop/domain-model/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts | 維持案 | 40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/package-lock.json | 維持＋参照更新案 | 40_Develop/semantic-coverage/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/semantic-coverage/package.json | 維持＋参照更新案 | 40_Develop/semantic-coverage/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/semantic-coverage/src/application/semantic-bundle.ts | 維持案 | 40_Develop/semantic-coverage/src/application/semantic-bundle.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/application/semantic-coverage.ts | 維持案 | 40_Develop/semantic-coverage/src/application/semantic-coverage.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/compilation/index.ts | 維持案 | 40_Develop/semantic-coverage/src/compilation/index.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts | 維持案 | 40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts | 維持案 | 40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/coverage/index.ts | 維持案 | 40_Develop/semantic-coverage/src/coverage/index.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts | 維持案 | 40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/index.ts | 維持案 | 40_Develop/semantic-coverage/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts | 維持案 | 40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts | 維持案 | 40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts | 内部配置・本文照合待ち |
| 40_Develop/semantic-coverage/symbol.json | 維持＋参照更新案 | 40_Develop/semantic-coverage/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts | 維持案 | 40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/semantic-coverage/tests/unit/public-boundary.contract.test.ts | 維持案 | 40_Develop/semantic-coverage/tests/unit/public-boundary.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts | 維持案 | 40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/semantic-coverage/tsconfig.json | 維持＋参照更新案 | 40_Develop/semantic-coverage/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/verification-runner/bin/regression-runner.ts | 維持案 | 40_Develop/verification-runner/bin/regression-runner.ts | 内部配置・本文照合待ち |
| 40_Develop/verification-runner/package-lock.json | 維持＋参照更新案 | 40_Develop/verification-runner/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/verification-runner/package.json | 維持＋参照更新案 | 40_Develop/verification-runner/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/verification-runner/src/application/regression-runner.ts | 維持案 | 40_Develop/verification-runner/src/application/regression-runner.ts | 内部配置・本文照合待ち |
| 40_Develop/verification-runner/src/catalog/test-catalog.ts | 維持案 | 40_Develop/verification-runner/src/catalog/test-catalog.ts | 内部配置・本文照合待ち |
| 40_Develop/verification-runner/src/execution/regression-execution.ts | 維持案 | 40_Develop/verification-runner/src/execution/regression-execution.ts | 内部配置・本文照合待ち |
| 40_Develop/verification-runner/src/index.ts | 維持案 | 40_Develop/verification-runner/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/verification-runner/symbol.json | 維持＋参照更新案 | 40_Develop/verification-runner/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/verification-runner/tests/acceptance/regression-plan-understanding.contract.test.ts | 維持案 | 40_Develop/verification-runner/tests/acceptance/regression-plan-understanding.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts | 維持案 | 40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/verification-runner/tests/system/resource-intensive-gate.contract.test.ts | 維持案 | 40_Develop/verification-runner/tests/system/resource-intensive-gate.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts | 維持案 | 40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/verification-runner/tsconfig.json | 維持＋参照更新案 | 40_Develop/verification-runner/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/version-control/package-lock.json | 維持＋参照更新案 | 40_Develop/version-control/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/version-control/package.json | 維持＋参照更新案 | 40_Develop/version-control/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/version-control/src/change-publication.ts | 維持案 | 40_Develop/version-control/src/change-publication.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/checker-observation/index.ts | 維持案 | 40_Develop/version-control/src/checker-observation/index.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/fixed-revision.ts | 維持案 | 40_Develop/version-control/src/fixed-revision.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/fixed-snapshot.ts | 維持案 | 40_Develop/version-control/src/fixed-snapshot.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/change-publication-adapter.ts | 維持案 | 40_Develop/version-control/src/git/change-publication-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/checker-repository-observation-adapter.ts | 維持案 | 40_Develop/version-control/src/git/checker-repository-observation-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/fixed-revision-adapter.ts | 維持案 | 40_Develop/version-control/src/git/fixed-revision-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/fixed-snapshot-adapter.ts | 維持案 | 40_Develop/version-control/src/git/fixed-snapshot-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/local-change-set-adapter.ts | 維持案 | 40_Develop/version-control/src/git/local-change-set-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/object-reader.ts | 維持案 | 40_Develop/version-control/src/git/object-reader.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/repository-layout-adapter.ts | 維持案 | 40_Develop/version-control/src/git/repository-layout-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/repository-layout.ts | 維持案 | 40_Develop/version-control/src/git/repository-layout.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/repository-local-ignore-adapter.ts | 維持案 | 40_Develop/version-control/src/git/repository-local-ignore-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/git/repository-worktree-view-adapter.ts | 維持案 | 40_Develop/version-control/src/git/repository-worktree-view-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/index.ts | 維持案 | 40_Develop/version-control/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/local-change-set.ts | 維持案 | 40_Develop/version-control/src/local-change-set.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/migration-closure.ts | 維持案 | 40_Develop/version-control/src/migration-closure.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/repository-identity/index.ts | 維持案 | 40_Develop/version-control/src/repository-identity/index.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/repository-local-ignore.ts | 維持案 | 40_Develop/version-control/src/repository-local-ignore.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/repository-location.ts | 維持案 | 40_Develop/version-control/src/repository-location.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/repository-revision.ts | 維持案 | 40_Develop/version-control/src/repository-revision.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/src/repository-worktree-view.ts | 維持案 | 40_Develop/version-control/src/repository-worktree-view.ts | 内部配置・本文照合待ち |
| 40_Develop/version-control/symbol.json | 維持＋参照更新案 | 40_Develop/version-control/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/version-control/tests/fixtures/migration-consumer-declaration.json | 維持案 | 40_Develop/version-control/tests/fixtures/migration-consumer-declaration.json | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/fixtures/repository-ignore-writer.ts | 維持案 | 40_Develop/version-control/tests/fixtures/repository-ignore-writer.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/change-publication.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/change-publication.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/local-change-set.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/local-change-set.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/repository-location.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/repository-location.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/integration/repository-worktree-view.integration.test.ts | 維持案 | 40_Develop/version-control/tests/integration/repository-worktree-view.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tests/system/migration-system-closure.contract.test.ts | 維持案 | 40_Develop/version-control/tests/system/migration-system-closure.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/version-control/tsconfig.json | 維持＋参照更新案 | 40_Develop/version-control/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/visual-preview/bin/visual-preview.ts | 維持案 | 40_Develop/visual-preview/bin/visual-preview.ts | 内部配置・本文照合待ち |
| 40_Develop/visual-preview/package-lock.json | 維持＋参照更新案 | 40_Develop/visual-preview/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/visual-preview/package.json | 維持＋参照更新案 | 40_Develop/visual-preview/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/visual-preview/src/browser-zoom-verifier.ts | 維持案 | 40_Develop/visual-preview/src/browser-zoom-verifier.ts | 内部配置・本文照合待ち |
| 40_Develop/visual-preview/src/index.ts | 維持案 | 40_Develop/visual-preview/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/visual-preview/src/preview-server.ts | 維持案 | 40_Develop/visual-preview/src/preview-server.ts | 内部配置・本文照合待ち |
| 40_Develop/visual-preview/symbol.json | 維持＋参照更新案 | 40_Develop/visual-preview/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts | 維持案 | 40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/visual-preview/tests/integration/visual-preview-server.contract.test.ts | 維持案 | 40_Develop/visual-preview/tests/integration/visual-preview-server.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/visual-preview/tsconfig.json | 維持＋参照更新案 | 40_Develop/visual-preview/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/workbench/bin/workbench.ts | 移管案 | 40_Develop/workbench-server/bin/workbench.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/client/entry-client.tsx | 移管案 | 40_Develop/workbench-server/client/entry-client.tsx | 内部配置・本文照合待ち |
| 40_Develop/workbench/client/workbench-ai-request-panel.tsx | 移管案 | 40_Develop/workbench-server/client/workbench-ai-request-panel.tsx | 内部配置・本文照合待ち |
| 40_Develop/workbench/client/workbench-app.tsx | 移管案 | 40_Develop/workbench-server/client/workbench-app.tsx | 内部配置・本文照合待ち |
| 40_Develop/workbench/client/workbench-projection-panels.tsx | 移管案 | 40_Develop/workbench-server/client/workbench-projection-panels.tsx | 内部配置・本文照合待ち |
| 40_Develop/workbench/dist/client/assets/workbench-client.js | 移管案 | 40_Develop/workbench-server/dist/client/assets/workbench-client.js | 内部配置・本文照合待ち |
| 40_Develop/workbench/package-lock.json | 統合・更新案 | 40_Develop/workbench-server/package-lock.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/workbench/package.json | 統合・更新案 | 40_Develop/workbench-server/package.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/workbench/scripts/workbench-ai-verification-http.ts | 移管案 | 40_Develop/workbench-server/scripts/workbench-ai-verification-http.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/ai-profile-surface.ts | 移管案 | 40_Develop/workbench-server/src/ai-profile-surface.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/ai-request.ts | 移管案 | 40_Develop/workbench-server/src/ai-request.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/credential-administration.ts | 移管案 | 40_Develop/workbench-server/src/credential-administration.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/index.ts | 移管案 | 40_Develop/workbench-server/src/index.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/owner-artifact-surface.ts | 移管案 | 40_Develop/workbench-server/src/owner-artifact-surface.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/presentation/workbench-client-model.ts | 移管案 | 40_Develop/workbench-server/src/presentation/workbench-client-model.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/presentation/workbench-components.ts | 移管案 | 40_Develop/workbench-server/src/presentation/workbench-components.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/presentation/workbench-shell.ts | 移管案 | 40_Develop/workbench-server/src/presentation/workbench-shell.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/project-plan-surface.ts | 移管案 | 40_Develop/workbench-server/src/project-plan-surface.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/project-surface.ts | 移管案 | 40_Develop/workbench-server/src/project-surface.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/quality-surface.ts | 移管案 | 40_Develop/workbench-server/src/quality-surface.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/remote-topic-meeting.ts | 移管案 | 40_Develop/workbench-server/src/remote-topic-meeting.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/runtime-activity.ts | 移管案 | 40_Develop/workbench-server/src/runtime-activity.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/src/workbench-server.ts | 移管案 | 40_Develop/workbench-server/src/workbench-server.ts | 内部配置・本文照合待ち |
| 40_Develop/workbench/symbol.json | 統合・更新案 | 40_Develop/workbench-server/symbol.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/workbench/tests/integration/project-surface.contract.test.ts | 移管案 | 40_Develop/workbench-server/tests/integration/project-surface.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts | 移管案 | 40_Develop/workbench-server/tests/integration/workbench-node-dependency-closure.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/workbench/tests/integration/workbench-server.contract.test.ts | 移管案 | 40_Develop/workbench-server/tests/integration/workbench-server.contract.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/workbench/tests/system/workbench-visual.integration.test.ts | 移管案 | 40_Develop/workbench-server/tests/system/workbench-visual.integration.test.ts | 対象責務・Local Item・実観測境界に基づき試験移管先を確定 |
| 40_Develop/workbench/tsconfig.json | 統合・更新案 | 40_Develop/workbench-server/tsconfig.json | Owner移管と全Consumer・検査／配布閉包を追従 |
| 40_Develop/workbench/vite.config.ts | 移管案 | 40_Develop/workbench-server/vite.config.ts | 内部配置・本文照合待ち |

## 静的利用側の取得集合

これは呼出しの存在確認であり、実際の本番到達性・結果待機・取消・Authority・Effect・署名閉包成立の根拠ではない。

| 利用側File | 異なる領域の参照先 |
|---|---|
| 40_Develop/ai-runtime/src/catalog-store.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/ai-runtime/tests/integration/ai-profile-catalog-store.integration.test.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts | 40_Develop/coordinator/src/provider/provider-model-profile-runtime.ts<br>40_Develop/workbench/src/ai-profile-surface.ts |
| 40_Develop/checker/src/adapters/artifact-relation.ts | 40_Develop/crdd-domain-library/src/index.ts |
| 40_Develop/checker/src/adapters/domain-outcome.ts | 40_Develop/crdd-domain-library/src/index.ts |
| 40_Develop/checker/src/adapters/reality-test-catalog.ts | 40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/checker/src/adapters/reality-traceability.ts | 40_Develop/crdd-domain-library/src/index.ts<br>40_Develop/crdd-domain-library/src/reality-traceability/index.ts<br>40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/checker/src/pipeline/checker-pipeline.ts | 40_Develop/crdd-domain-library/src/artifact/index.ts |
| 40_Develop/checker/src/profiles/current-profile.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/checker-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/checker/src/rules/reality-symbol-graph.ts | 40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/checker/src/rules/rule-registry.ts | 40_Develop/crdd-domain-library/src/artifact/index.ts |
| 40_Develop/checker/tests/unit/checker-core.contract.test.ts | 40_Develop/crdd-domain-library/src/artifact/index.ts |
| 40_Develop/checker/tests/unit/symbol-graph.contract.test.ts | 40_Develop/crdd-domain-library/src/reality-traceability/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/coordinator/scripts/check-platform-access-coverage.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/generate-release-key.ts | 40_Develop/artifact-signing/src/index.ts |
| 40_Develop/coordinator/scripts/measure-development-providers.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/prepare-codex-advice-image.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/prepare-release-candidate.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/prepare-release-runtime.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/fixed-snapshot.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts | 40_Develop/mcp/src/index.ts<br>40_Develop/project-runtime/src/public-contract/project-state-query.ts |
| 40_Develop/coordinator/scripts/promote-release-manifest.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/sign-release-manifest.ts | 40_Develop/artifact-signing/src/index.ts<br>40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verification-result-record.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-native-protection.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-native-terminal-fixtures.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-signed-general-task.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/scripts/verify-signed-route-matrix.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/cli/coordinator-command.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/diagnostics/doctor.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/docker-runtime/docker-recovery-runtime.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/external-send/external-send-policy-runtime.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/fixed-snapshot.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/host-runtime/host-terminal-caller-checkpoint.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/host-runtime/host-terminal-caller-lease.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-release-identity.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/fixed-snapshot.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/execution-intelligence-adapter.ts | 40_Develop/execution-intelligence/src/index.ts<br>40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-acceptance-authority-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-acceptance-decision-store.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-candidate-integration-adapter.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/fixed-snapshot.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-composition-root.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-decision-capability-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-decision-recovery-store.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-durable-foundation.ts | 40_Develop/project-runtime/src/boundary/repository-relative-path.ts<br>40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-execution-authorization-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-execution-host-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-history.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-integration-record-adapter.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-objective-intake.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-single-task-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-task-recovery-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-windows-decision-store.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-windows-platform-adapter.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/provider/provider-model-profile-runtime.ts | 40_Develop/ai-runtime/src/ai-profile-types.ts<br>40_Develop/ai-runtime/src/catalog.ts |
| 40_Develop/coordinator/src/repository-operation/repository-operation-runtime.ts | 40_Develop/version-control/src/fixed-revision.ts<br>40_Develop/version-control/src/git/fixed-revision-adapter.ts<br>40_Develop/version-control/src/repository-location.ts<br>40_Develop/version-control/src/repository-revision.ts |
| 40_Develop/coordinator/src/repository-operation/repository-workspace-runtime.ts | 40_Develop/version-control/src/fixed-snapshot.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/state-storage/coordinator-state-runtime.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-dispatch-runtime.ts | 40_Develop/ai-runtime/src/ai-profile-types.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-execution-plan.ts | 40_Develop/ai-runtime/src/ai-profile-types.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-production-runtime.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-command.ts | 40_Develop/ai-runtime/src/ai-profile-types.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-change-candidate-runtime.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/version-control/src/git/fixed-revision-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-repository-composition.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/workbench-ai/workbench-candidate-application.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/tests/fixtures/fixed-runtime-signing-fixture.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/tests/fixtures/project-runtime-current-ports.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/index.ts |
| 40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts | 40_Develop/version-control/src/git/object-reader.ts<br>40_Develop/version-control/src/index.ts |
| 40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts | 40_Develop/version-control/src/fixed-snapshot.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts<br>40_Develop/version-control/src/git/object-reader.ts<br>40_Develop/version-control/src/git/repository-layout.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/index.ts |
| 40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/coordinator/tests/integration/prepare-release-runtime.contract.test.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/version-control/src/git/fixed-snapshot-adapter.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts | 40_Develop/execution-intelligence/src/index.ts<br>40_Develop/mcp/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts | 40_Develop/execution-intelligence/src/index.ts<br>40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-history.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts | 40_Develop/mcp/src/index.ts<br>40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts | 40_Develop/version-control/src/git/repository-layout-adapter.ts<br>40_Develop/version-control/src/git/repository-layout.ts |
| 40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts | 40_Develop/artifact-signing/src/index.ts |
| 40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/tests/system/project-runtime-acceptance-decision.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/system/project-runtime-recovery.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/coordinator/tests/unit/project-runtime-profile-transport.contract.test.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/version-control/src/index.ts |
| 40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts | 40_Develop/ai-runtime/src/index.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-dispatch-runtime.contract.test.ts | 40_Develop/ai-runtime/src/index.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts | 40_Develop/ai-runtime/src/ai-profile-types.ts<br>40_Develop/ai-runtime/src/catalog.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts | 40_Develop/ai-runtime/src/catalog.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts | 40_Develop/ai-runtime/src/catalog.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-change-candidate-runtime.contract.test.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/version-control/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts | 40_Develop/ai-runtime/src/catalog.ts |
| 40_Develop/coordinator/tests/unit/workbench-ai-request-application.contract.test.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/crdd-domain-library/src/repository-observation/index.ts | 40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/crdd-domain-library/src/repository-observation/reality-symbol-repository-observer.ts | 40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts | 40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/cros/bin/cros-access-recovery.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/cros/src/credential-access-recovery-cli.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/cros/src/credential-access-recovery-file-adapter.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/cros/src/credential-registry-file-adapter.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/cros/src/project-federation.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/cros/src/remote-transport.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/project-runtime/src/index.ts |
| 40_Develop/cros/src/shared-server-config-file-adapter.ts | 40_Develop/project-operation/src/index.ts<br>40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/index.ts |
| 40_Develop/cros/tests/integration/project-federation.contract.test.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/cros/tests/integration/remote-transport.contract.test.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/cros/tests/integration/shared-server-config-file-adapter.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/execution-intelligence/src/store/verified-repository-root.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/mcp/src/adapters/application-adapter.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/src/adapters/project-context-adapter.ts | 40_Develop/cros/src/index.ts |
| 40_Develop/mcp/src/adapters/project-runtime-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/mcp/src/adapters/topic-meeting-adapter.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/src/composition/cros-project-context-application.ts | 40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/src/composition/cros-shared-server.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts | 40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/tests/integration/cros-shared-server.integration.test.ts | 40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts | 40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/mcp/tests/system/cros-shared-server-entry.integration.test.ts | 40_Develop/cros/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| 40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts | 40_Develop/cros/src/index.ts |
| 40_Develop/official-asset-governance/src/official-asset-store.ts | 40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts |
| 40_Develop/official-asset-governance/tests/fixtures/asset-decision-worker.ts | 40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts |
| 40_Develop/official-asset-governance/tests/integration/asset-governance.contract.test.ts | 40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts |
| 40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts | 40_Develop/version-control/src/git/repository-local-ignore-adapter.ts<br>40_Develop/version-control/src/repository-local-ignore.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/runtime-data/src/platform/tool-runtime-config.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/runtime-data/src/store/temporary-operation-store.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/runtime-data/tests/integration/tool-runtime-config.contract.test.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/runtime-data/tests/system/temporary-operation-cleanup.contract.test.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/semantic-coverage/bin/compile-semantic-coverage-pilot.ts | 40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/semantic-coverage/src/application/semantic-coverage.ts | 40_Develop/crdd-domain-library/src/index.ts<br>40_Develop/crdd-domain-library/src/reality-traceability/index.ts<br>40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts | 40_Develop/crdd-domain-library/src/index.ts |
| 40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts | 40_Develop/crdd-domain-library/src/index.ts |
| 40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts | 40_Develop/crdd-domain-library/src/index.ts<br>40_Develop/crdd-domain-library/src/reality-traceability/index.ts |
| 40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts | 40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts | 40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts | 40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts | 40_Develop/crdd-domain-library/src/reality-traceability/index.ts<br>40_Develop/crdd-domain-library/src/repository-observation/index.ts<br>40_Develop/version-control/src/repository-identity/index.ts |
| 40_Develop/verification-runner/src/execution/regression-execution.ts | 40_Develop/version-control/src/index.ts |
| 40_Develop/visual-preview/src/browser-zoom-verifier.ts | 40_Develop/runtime-data/src/index.ts |
| 40_Develop/visual-preview/src/preview-server.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/visual-preview/tests/integration/visual-preview-server.contract.test.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/bin/workbench.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/coordinator/src/platform-access/platform-provisioner-package-filesystem.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-dispatch-runtime.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-production-runtime.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-executor.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-ai-change-candidate-runtime.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-ai-provider-adapter.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-ai-repository-composition.ts<br>40_Develop/coordinator/src/workbench-ai/workbench-candidate-application.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/src/ai-profile-surface.ts | 40_Develop/ai-runtime/src/index.ts |
| 40_Develop/workbench/src/credential-administration.ts | 40_Develop/cros/src/index.ts |
| 40_Develop/workbench/src/presentation/workbench-client-model.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts<br>40_Develop/version-control/src/index.ts |
| 40_Develop/workbench/src/project-plan-surface.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/workbench/src/project-surface.ts | 40_Develop/project-operation/src/index.ts<br>40_Develop/version-control/src/change-publication.ts<br>40_Develop/version-control/src/git/change-publication-adapter.ts<br>40_Develop/version-control/src/git/local-change-set-adapter.ts<br>40_Develop/version-control/src/local-change-set.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/src/quality-surface.ts | 40_Develop/project-operation/src/index.ts |
| 40_Develop/workbench/src/remote-topic-meeting.ts | 40_Develop/mcp/src/index.ts<br>40_Develop/project-operation/src/index.ts |
| 40_Develop/workbench/src/runtime-activity.ts | 40_Develop/coordinator/src/index.ts<br>40_Develop/execution-intelligence/src/index.ts<br>40_Develop/project-runtime/src/index.ts<br>40_Develop/version-control/src/change-publication.ts<br>40_Develop/version-control/src/git/change-publication-adapter.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/src/workbench-server.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/cros/src/index.ts<br>40_Develop/project-operation/src/index.ts<br>40_Develop/version-control/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/tests/integration/project-surface.contract.test.ts | 40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/tests/integration/workbench-server.contract.test.ts | 40_Develop/ai-runtime/src/index.ts<br>40_Develop/cros/src/index.ts<br>40_Develop/execution-intelligence/src/index.ts<br>40_Develop/mcp/src/index.ts<br>40_Develop/project-operation/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/workbench/tests/system/workbench-visual.integration.test.ts | 40_Develop/version-control/src/repository-location.ts<br>40_Develop/visual-preview/src/index.ts |
| template/tools/crdd-cros-server.ts | 40_Develop/cros/src/index.ts<br>40_Develop/mcp/src/index.ts<br>40_Develop/runtime-data/src/index.ts |
| template/tools/crdd-mcp.ts | 40_Develop/coordinator/src/index.ts<br>40_Develop/mcp/src/index.ts<br>40_Develop/project-operation/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |

## Checklist

- [x] 全18領域・830Fileの基準母集団を固定した。
- [x] 相対importで取得できる312関係・173利用側を、取得限界付きで記録した。
- [x] 分割候補、置換後廃止候補、維持候補と未確認事項を区別した。
- [ ] OPEN: 本文・関数単位の責務照合、過去Capability Evidenceと新Ownerの全数対応が未完了。全行の予定処置を確定してから段階1を閉じる。
- [ ] OPEN: package script、子Process、設定、署名、Manifest、Workflowと移行利用側の横断対応を追加する。
- [x] N/A: 本表は棚卸し中の計画。Source変更・Runtime試験・外部Effectは発行していない。
