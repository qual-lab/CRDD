# 責務再編 — 基準ファイルと利用側の棚卸し

状態: 段階1〜4完了。段階5Aの統合対象69Fileは実移管先と局所確認を反映済み。配布契約の包括確認、残る移管と全体実検証は未完了。
担当責任者: Qual-Lab
対象: CHG-000082、2026-10-07
基準改訂版: `463dd4a1ffd86e8bf5c58bb37a92e2ba11984621`（Git object format: sha1）

基準の意味: 上記は全830ファイルのSource固定版。初期提案の`76d2c036`、計画追記の`463dd4a1`、棚卸し中間コミットの`3b9e6be0`を区別する。後二版の差は計画・棚卸し文書だけであり、Sourceの母集団を差し替えたものではない。後続の実装変更時は、旧母集団と新Ownerの関係を保持して改訂する。

## 結論

全18領域のGit管理対象830ファイルを一次キーとして固定し、各Fileの予定処置、分割対象の関数・責務、静的／非import利用側、保持能力と過去根拠、必須実経路と現在QA項目の対応を整理した。下表は移管の計画であり、公開API・詳細配置の設計完了、Source移管または能力成立を示さない。未接続・不足は後続Gateへ明示的に引き継ぐ。実行結果の書庫ではなく、[再編計画](261007_develop-responsibility-mapping.md#23-責務再編を完了させる計画)の作業表として更新する。

配置案の優先関係: 830行の粗表は段階1で固定した初期移管計画を起点とする。後続の確定配置・公開APIは[詳細設計の完了判定](261007_develop-responsibility-mapping.md#段階3の完了判定--2026-10-08)が参照する各OwnerのDetailsと、本書の関数単位優先表を優先する。初期行を自動的に実装済みへ変更せず、段階5で旧File・新Owner・全Consumerの実接続を全数照合する。段階5Aでは旧Domain Library33、Project Operation18、Runtime Data18の計69行を実在するexact Fileへ更新した。分割・共通化によるN:N対応を保持し、局所確認済みと全体Gate完了を区別する。下記の基準版Consumer表は過去母集団であり、現在のimport先として利用しない。

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
| 40_Develop/ai-runtime/package-lock.json | 移管済み | 40_Develop/ai-adapter/package-lock.json | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/package.json | 移管済み | 40_Develop/ai-adapter/package.json | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/ai-profile-types.ts | 移管済み | 40_Develop/ai-adapter/src/catalog/types.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/catalog-store.ts | 移管済み | 40_Develop/ai-adapter/src/profile/catalog-store.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/catalog.ts | 移管済み | 40_Develop/ai-adapter/src/catalog/catalog.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/default-ai-profile-catalog.json | 移管済み | 40_Develop/ai-adapter/src/catalog/default-ai-profile-catalog.json | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/index.ts | 移管済み | 40_Develop/ai-adapter/src/index.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/profile-administration.ts | 移管済み | 40_Develop/ai-adapter/src/profile/profile-administration.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/src/registry.ts | 移管済み | 40_Develop/ai-adapter/src/profile/registry.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/symbol.json | 移管済み | 40_Develop/ai-adapter/symbol.json | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/tests/ai-profile-catalog.contract.test.ts | 移管済み | 40_Develop/ai-adapter/tests/ai-profile-catalog.contract.test.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/tests/integration/ai-profile-catalog-store.integration.test.ts | 移管済み | 40_Develop/ai-adapter/tests/integration/ai-profile-catalog-store.integration.test.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts | 移管済み | 40_Develop/ai-adapter/tests/integration/ai-profile-consumers.integration.test.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/ai-runtime/tsconfig.json | 移管済み | 40_Develop/ai-adapter/tsconfig.json | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
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
| 40_Develop/coordinator/src/plain-data-snapshot.ts | 移管案（段階5B着手前補正） | 40_Develop/domain-model/src/plain-data/plain-data-snapshot.ts<br>40_Develop/domain-model/src/plain-data/index.ts | Provider計画とCoordinatorの共通入力防御を単一Ownerへ移す。既存Record／Array検査と返却値だけを保持し、深いSnapshot・Authority・保存を追加しない。正本公開契約と全利用側・試験・署名閉包への接続後に実施。旧入口の再exportは残さない |
| 40_Develop/coordinator/src/platform-access/platform-access-adapter.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-access-adapter.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-key-storage-policy.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-key-storage-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-manifest-loader.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-manifest-loader.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-package-filesystem.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-package-filesystem.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-package-gate.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-package-gate.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-policy-identity.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-policy-identity.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-release-identity.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-release-identity.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-release-trust.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-release-trust.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/platform-access/platform-provisioner-trust-core.ts | 維持案 | 40_Develop/coordinator/src/platform-access/platform-provisioner-trust-core.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/project-runtime/docker-project-recovery-settlement.ts | 移管済み | project-runtime/src/task/docker-recovery-settlement.ts（改名後orchestrator） | 上位exact状態照合を物理移管。下位内部資源処置の公開範囲は拡大しない。本番組立ての全移管と段階6確認は未完了 |
| 40_Develop/coordinator/src/project-runtime/execution-intelligence-adapter.ts | 移管・責務整理 | orchestratorの上位Attempt記録 | 段階5Cで現行project-runtime/src/task/execution-intelligence-adapter.tsへ移管。公開入口へ利用側を接続。親改名・全本番組立ては継続中 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-acceptance-authority-adapter.ts | 移管・責務整理 | orchestratorの受入判断権限 | 段階5Cで現行project-runtime/src/decision/acceptance-authority-adapter.tsへ移管。公開入口へ本番組立て・試験を接続。親改名・全保存移管は継続中 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-acceptance-decision-store.ts | 検証・型を移管済み／旧Writer撤去済み | 40_Develop/project-runtime/src/decision/acceptance-decision-record.ts | 試験は現行Snapshot Storeへ切替。保存処理は耐久基盤に一本化し、基盤の物理移管は継続中 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-candidate-integration-adapter.ts | 関数分割 | orchestratorのProject相関＋coordinator公開単一実行／資源API | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-composition-root.ts | 移管・責務整理 | orchestratorの進行／判断／現在状態保存 | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-decision-capability-adapter.ts | 移管・責務整理 | orchestratorの人間判断用秘密値・Hash生成 | 段階5Cで現行project-runtime/src/decision/decision-capability-adapter.tsへ移管。全直接利用側を公開入口へ接続し、既存生成・一回判断契約を維持 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-decision-recovery-store.ts | Intent検証を移管済み／旧Writer撤去済み | 40_Develop/project-runtime/src/decision/decision-recovery-record.ts | 試験は現行Snapshot Storeへ切替。保存処理は耐久基盤に一本化し、基盤の物理移管は継続中 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-durable-foundation.ts | 移管済み／旧移行Reader・旧Writer・未使用部分形式codec撤去済み | 40_Develop/project-runtime/src/storage/current-state-store.ts | 旧形式移行はフロントAIへ限定。現行読取り・未解決Lease結合・State保存反例・Queue優先順位と実行・再計画の接続を新版Portで確認。保存Root・設定と本番組立ての切替は残件 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-execution-authorization-adapter.ts | 移管・下位接続維持 | orchestratorのProject相関＋coordinatorのCapability発行・失効 | 段階5Cで現行project-runtime/src/task/execution-authorization-adapter.tsへ移管。下位発行・失効は既存callbackに委譲し、Source閉包と全直接利用側を新Pathへ接続 |
| 40_Develop/project-runtime/src/task/execution-host-adapter.ts | 関数分割 | orchestratorのProject相関＋coordinator公開単一実行／資源API | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-history.ts | 移管・責務整理 | orchestratorの進行／判断／現在状態保存 | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-integration-record-adapter.ts | 旧Writer・Reader撤去済み／現行保存へ試験切替 | 40_Develop/project-runtime/src/storage/result-record.ts と storage/types.ts、現行Snapshot保存 | 結果値検査を上位公開入口へ移管し、同一再送・完全な候補ID・衝突拒否を単一状態保存で確認。旧形式移行ReaderはフロントAIの移行方針に従い撤去 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-objective-intake.ts | 移管・責務整理 | orchestratorの進行／判断／現在状態保存 | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-public-adapter.ts | 移管・責務整理 | orchestratorの進行／判断／現在状態保存 | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/project-runtime/src/task/single-task-adapter.ts | 関数分割 | orchestratorのProject相関＋coordinator公開単一実行／資源API | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/project-runtime/src/task/task-recovery-adapter.ts | 関数分割 | orchestratorのProject相関＋coordinator公開単一実行／資源API | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-windows-decision-store.ts | 移管・責務整理 | orchestratorの進行／判断／現在状態保存 | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/project-runtime/project-runtime-windows-platform-adapter.ts | 関数分割 | orchestratorのProject相関＋coordinator公開単一実行／資源API | 本文の19File処置とsavedv2過去保証へ接続済み。内部遷移は段階3・6で照合 |
| 40_Develop/coordinator/src/provider/claude-docker-runtime-adapter.ts | 関数分割 | ai-adapterの固有記述＋coordinatorの実実行・権限 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/claude-execution-plan.ts | 移管済み | 40_Develop/ai-adapter/src/claude/claude-execution-plan.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/claude-structured-result.ts | 移管済み | 40_Develop/ai-adapter/src/claude/claude-structured-result.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/claude-subscription-authentication.ts | 分割・接続済み（部分） | 40_Develop/ai-adapter/src/claude/authentication.ts＋元File | login／status引数とProbe判定をAI Adapterへ移管。Process・Home・Lock・回収はCoordinatorに維持。Provider実行Adapter全体と配布閉包は未了 |
| 40_Develop/coordinator/src/provider/codex-advice-distribution.ts | 移管済み | 40_Develop/ai-adapter/src/codex/codex-advice-distribution.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/codex-docker-runtime-adapter.ts | 関数分割 | ai-adapterの固有記述＋coordinatorの実実行・権限 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/codex-execution-plan.ts | 移管済み | 40_Develop/ai-adapter/src/codex/codex-execution-plan.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/codex-executor-seccomp.ts | 関数分割 | ai-adapterの固有記述＋coordinatorの実実行・権限 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/codex-structured-result.ts | 移管済み | 40_Develop/ai-adapter/src/codex/codex-structured-result.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/delegation-route-selection.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/delegation-selection-grant-runtime.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-authority-runtime.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-billing-policy.ts | 移管済み | 40_Develop/ai-adapter/src/profile/provider-billing-policy.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/provider-eligibility-runtime.ts | 分割移管済み | 40_Develop/ai-adapter/src/profile/eligibility.ts＋Coordinatorの元File | 五軸の意味判定を移し、観測組立て・Runtime候補公開は維持。型・選択・判定33契約を確認。段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/provider-home-mount-grant-runtime.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-home-mount-grant.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-home-observation.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-home-windows-adapter.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-home.ts | 関数分割 | ai-adapterの固有記述＋coordinatorの実実行・権限 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-isolation-profile.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-lifecycle.ts | 分割・接続済み（部分） | 40_Develop/ai-adapter/src/profile/authentication-policy.ts＋元File | 固定認証方針をAI Adapterへ移管。実観測・実行権限はCoordinatorに維持。全配布閉包は未了 |
| 40_Develop/coordinator/src/provider/provider-model-profile-runtime.ts | 移管済み | 40_Develop/ai-adapter/src/profile/provider-model-profile.ts | 既存Symbol IDを保持。Profile解決・利用側48契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/provider/provider-model-selection-runtime.ts | 分割・接続済み（部分） | AI Adapterのprofile/provider-model-profile.ts＋元File | Provider別Family選好だけを移管。作業分類・リスク・推論強度の選択責務はCoordinatorに維持 |
| 40_Develop/coordinator/src/provider/provider-task-packet-runtime.ts | 維持・内部再配置 | coordinatorの実行権限／隔離／Host接続 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/provider/provider-task-structured-result.ts | 関数分割 | ai-adapterの固有記述＋coordinatorの実実行・権限 | 本文のProvider関数表へ接続済み。具体配置・API・反証は段階3で固定 |
| 40_Develop/coordinator/src/repository-operation/coordinator-operation-creation-internal.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/coordinator-operation-creation-internal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/repository-operation-runtime.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/repository-operation-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/repository-workspace-runtime.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/repository-workspace-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/root-observation.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/root-observation.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/repository-operation/root-protection-policy.ts | 維持案 | 40_Develop/coordinator/src/repository-operation/root-protection-policy.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/bounded-file-snapshot.ts | 共通保存部品へ移管 | 40_Develop/domain-model/src/storage/bounded-file-snapshot.ts | 上位状態を持たない安定読取り。利用側はstorage公開入口へ接続 |
| 40_Develop/coordinator/src/state-storage/coordinator-state-model.ts | 維持案 | 40_Develop/coordinator/src/state-storage/coordinator-state-model.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/coordinator-state-runtime.ts | 維持案 | 40_Develop/coordinator/src/state-storage/coordinator-state-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/state-storage/docker-recovery-journal.ts | 維持案 | 40_Develop/coordinator/src/state-storage/docker-recovery-journal.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/coordinator-task-request.ts | 維持案 | 40_Develop/coordinator/src/task/coordinator-task-request.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/coordinator-task-result-reasons.ts | 維持案 | 40_Develop/coordinator/src/task/coordinator-task-result-reasons.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/coordinator-task-runtime.ts | 維持案 | 40_Develop/coordinator/src/task/coordinator-task-runtime.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/development-measurement-constraints.ts | 維持案 | 40_Develop/coordinator/src/task/development-measurement-constraints.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/task/development-measurement-session.ts | 維持案 | 40_Develop/coordinator/src/task/development-measurement-session.ts | 内部配置・本文照合待ち |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-dispatch-runtime.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-execution-plan.ts | 関数分割 | 本文のWorkbench AI関数境界 | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-production-runtime.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-command.ts | 移管済み | 40_Develop/ai-adapter/src/advice/advice-provider-command.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-executor.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-provider-output.ts | 移管済み | 40_Develop/ai-adapter/src/advice/advice-provider-output.ts | 実配置・局所契約を確認。全配布閉包・段階5B全体の完了判定は未了 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-result.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-runtime-packet.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-advice-task.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-change-candidate-runtime.ts | 関数分割 | 本文のWorkbench AI関数境界 | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-provider-adapter.ts | 関数分割 | 本文のWorkbench AI関数境界 | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-repository-composition.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-ai-request-application.ts | 維持・用途整理 | coordinatorの単一助言実行／結果Contract | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
| 40_Develop/coordinator/src/workbench-ai/workbench-candidate-application.ts | 移管・下位API接続 | orchestratorの候補採否／保存。本文操作はCoordinator API | 本文の39File処置へ接続済み。取消受付と実終端を区別 |
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
| 40_Develop/crdd-domain-library/package-lock.json | 統合・移管、局所確認済み | 40_Develop/domain-model/package-lock.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/package.json | 統合・移管、局所確認済み | 40_Develop/domain-model/package.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/artifact/artifact-graph.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/artifact/artifact-model.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/artifact/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/artifact/index.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/artifact/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/artifact/markdown-artifact-parser.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/artifact/schema-validator.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/artifact/schema-validator.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/filesystem-store-root/filesystem-store-kernel-lock-worker.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/storage/filesystem-store-kernel-lock-worker.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/storage/filesystem-store-root.ts<br>40_Develop/domain-model/src/storage/types.ts<br>40_Develop/domain-model/src/storage/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/index.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/index.ts<br>40_Develop/domain-model/src/artifact/index.ts<br>40_Develop/domain-model/src/storage/index.ts<br>40_Develop/domain-model/src/reality-traceability/index.ts<br>40_Develop/domain-model/src/repository/index.ts<br>40_Develop/domain-model/src/quality-change-control/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/outcome.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/outcome.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/quality-change-control/index.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/quality-change-control/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/quality-change-control/quality-gate.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/quality-change-control/quality-gate.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/domain-issue.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/domain-issue.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/index.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/symbol-annotation.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/symbol-discovery.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/symbol-graph.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/symbol-manifest-model.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/reality-traceability/symbol-manifest-validator.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/repository/filesystem-repository-observer.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/repository-observation/index.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/repository/types.ts<br>40_Develop/domain-model/src/repository/repository-observation.ts<br>40_Develop/domain-model/src/repository/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/src/repository-observation/reality-symbol-repository-observer.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/repository/reality-symbol-repository-observer.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/symbol.json | 統合・移管、局所確認済み | 40_Develop/domain-model/symbol.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-contender.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/fixtures/filesystem-store-lock-contender.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-owner.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/fixtures/filesystem-store-lock-owner.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/integration/quality-change-control.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/quality-change-control.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/reality-repository.integration.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/system/quality-change-control.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/system/quality-change-control.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/unit/filesystem-store-root.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/unit/filesystem-store-root.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/unit/public-boundary.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/unit/public-boundary.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tests/unit/repository-observation.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/unit/repository-observation.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/crdd-domain-library/tsconfig.json | 統合・移管、局所確認済み | 40_Develop/domain-model/tsconfig.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
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
| 40_Develop/platform-access/.gitignore | 維持・利用側追従 | 40_Develop/platform-access/.gitignore | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/Cargo.lock | 維持・利用側追従 | 40_Develop/platform-access/Cargo.lock | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/Cargo.toml | 維持・利用側追従 | 40_Develop/platform-access/Cargo.toml | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/build.rs | 維持・利用側追従 | 40_Develop/platform-access/build.rs | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/rust-toolchain.toml | 維持・利用側追従 | 40_Develop/platform-access/rust-toolchain.toml | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/docker_authenticode.rs | 内部移動 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/docker_repair.rs | 関数分割・固定入口維持 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/host_namespace_protocol.rs | 内部移動 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/main.rs | 関数分割・固定入口維持 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/protocol.rs | 内部移動 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/terminal_protocol.rs | 内部移動 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/windows.rs | 関数分割・固定入口維持 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/windows_directory.rs | 内部移動 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/windows_owned_child.rs | 内部移動 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/src/windows_terminal.rs | 関数分割・固定入口維持 | platform-access/srcのprocess／filesystem／docker-desktop／protocol（Rust Fileはsnake_case） | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/symbol.json | 配置Relation更新 | 40_Develop/platform-access/symbol.json | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/tests/cli.rs | 維持・利用側追従 | 40_Develop/platform-access/tests/cli.rs | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/tests/fixtures/host_namespace_creation.rs | 維持・利用側追従 | 40_Develop/platform-access/tests/fixtures/host_namespace_creation.rs | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/platform-access/tests/fixtures/windows_protection.rs | 維持・利用側追従 | 40_Develop/platform-access/tests/fixtures/windows_protection.rs | 本文のNative19File表へ接続済み。固定worker名・五File Coverage・署名閉包を追従 |
| 40_Develop/project-operation/package-lock.json | 統合・移管、局所確認済み | 40_Develop/domain-model/package-lock.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/package.json | 統合・移管、局所確認済み | 40_Develop/domain-model/package.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/index.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/project-context/index.ts<br>40_Develop/domain-model/src/topic/index.ts<br>40_Develop/domain-model/src/meeting/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/project-operation.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/project-context/project-operation.ts<br>40_Develop/domain-model/src/project-context/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/repository-project-context.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/project-context/repository-project-context.ts<br>40_Develop/domain-model/src/project-context/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/repository-quality-projection.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/project-context/repository-quality-projection.ts<br>40_Develop/domain-model/src/project-context/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/repository-release-projection.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/project-context/repository-release-projection.ts<br>40_Develop/domain-model/src/project-context/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/topic-meeting-application.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/storage/topic-meeting-application.ts<br>40_Develop/domain-model/src/storage/types.ts<br>40_Develop/domain-model/src/topic/topic-application.ts<br>40_Develop/domain-model/src/meeting/meeting-application.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/topic-meeting-repository.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/storage/topic-meeting-repository.ts<br>40_Develop/domain-model/src/storage/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/src/topic-meeting.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/topic/topic-markdown.ts<br>40_Develop/domain-model/src/topic/types.ts<br>40_Develop/domain-model/src/meeting/meeting-markdown.ts<br>40_Develop/domain-model/src/meeting/types.ts<br>40_Develop/domain-model/src/artifact/activity-markdown.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/symbol.json | 統合・移管、局所確認済み | 40_Develop/domain-model/symbol.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tests/integration/candidate-adoption.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/candidate-adoption.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tests/integration/project-projection.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/project-projection.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/repository-project-context.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/topic-meeting-application.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/topic-meeting-record.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/topic-meeting-repository.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/project-operation/tsconfig.json | 統合・移管、局所確認済み | 40_Develop/domain-model/tsconfig.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
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
| 40_Develop/runtime-data/package-lock.json | 統合・移管、局所確認済み | 40_Develop/domain-model/package-lock.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/package.json | 統合・移管、局所確認済み | 40_Develop/domain-model/package.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/src/core/runtime-data-contract.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/configuration/runtime-data-contract.ts<br>40_Develop/domain-model/src/configuration/types.ts<br>40_Develop/domain-model/src/storage/runtime-data-area.ts<br>40_Develop/domain-model/src/repository/runtime-area-result.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/src/index.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/repository/index.ts<br>40_Develop/domain-model/src/storage/index.ts<br>40_Develop/domain-model/src/configuration/index.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/repository/runtime-data-path-resolver.ts<br>40_Develop/domain-model/src/repository/types.ts<br>40_Develop/domain-model/src/configuration/runtime-data-paths.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/src/platform/tool-runtime-config.ts | 分割・移管、局所確認済み | 40_Develop/domain-model/src/configuration/tool-runtime-config.ts<br>40_Develop/domain-model/src/configuration/types.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/src/store/temporary-operation-store.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/src/storage/temporary-operation-store.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/symbol.json | 統合・移管、局所確認済み | 40_Develop/domain-model/symbol.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/fixtures/create-temporary-operation-and-exit.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/fixtures/resume-temporary-operation-and-exit.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/repository-runtime-data-paths.integration.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/runtime-data-consumer-closure.integration.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/temporary-operation-lifecycle.integration.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/integration/tool-runtime-config.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/integration/tool-runtime-config.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/system/temporary-operation-cleanup.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/system/temporary-operation-cleanup.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/unit/runtime-data-contract.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/unit/runtime-data-contract.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tests/unit/runtime-data-path-resolver.contract.test.ts | 統合・移管、局所確認済み | 40_Develop/domain-model/tests/unit/runtime-data-path-resolver.contract.test.ts | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
| 40_Develop/runtime-data/tsconfig.json | 統合・移管、局所確認済み | 40_Develop/domain-model/tsconfig.json | 段階5AのSource・公開入口・利用側・Symbol・Catalogを接続。全体回帰・実署名・実E2Eは未完了 |
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
| 40_Develop/project-runtime/src/task/execution-host-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-history.ts | 40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-integration-record-adapter.ts | 40_Develop/project-runtime/src/index.ts<br>40_Develop/runtime-data/src/index.ts<br>40_Develop/version-control/src/repository-location.ts |
| 40_Develop/coordinator/src/project-runtime/project-runtime-objective-intake.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/project-runtime/src/task/single-task-adapter.ts | 40_Develop/project-runtime/src/index.ts |
| 40_Develop/project-runtime/src/task/task-recovery-adapter.ts | 40_Develop/project-runtime/src/index.ts |
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

## ProviderとWorkbench AIの関数単位照合

2026-10-07、読み取り専用の責務確認結果を統合した。対象は`coordinator/src/provider/`の25ファイルと`coordinator/src/workbench-ai/`の14ファイルである。以下は全ファイル表の粗い移管候補より優先する。完成後の独立レビューではなく、実装前の責務照合である。

AI AdapterはCLIの引数・固定環境・モデル選択・認証方式・出力解釈を返す。実行権限、Host一時Path、Recovery Store、Docker資源の所有を移管しない。CoordinatorはAdapterを通常の関数呼出しで利用し、AdapterからCoordinatorへのimportや実行Callback注入による逆依存を作らない。

### Provider配下

現行Pathの接頭辞は`40_Develop/coordinator/src/provider/`である。

| 現行ファイル | 確定する責務境界と予定処置 |
|---|---|
| codex-execution-plan.ts | AI Adapter。`planCodexReadOnlyProbe`／`planCodexIsolatedTask`のCLI、引数と要求する実行特性。要求をDocker実観測に読み替えない。 |
| claude-execution-plan.ts | AI Adapter。Turn Budget、probe／Task CLI、SchemaとEnvelope契約。 |
| codex-advice-distribution.ts | AI Adapter。配布Identityとinit必要性。Dockerへの実指定はCoordinator。 |
| codex-executor-seccomp.ts | 分割。必要なProfile IdentityはAI Adapter。`resolveFixedCodexExecutorSeccompProfile`の実体・Hash・Path検証はCoordinatorの隔離資産検証。 |
| codex-structured-result.ts | AI Adapter。`normalizeCodexStructuredResult`と補助処理。 |
| claude-structured-result.ts | AI Adapter。Envelope正規化。`parseUnambiguousJsonDocument`は同AdapterのProvider共通Parserへ分離。 |
| provider-billing-policy.ts | AI Adapter。Offering、Subscription、API fallback接続制約。Authorityは発行しない。 |
| provider-model-profile-runtime.ts | AI AdapterのProfile管理へ統合。Catalog解決を一本化。 |
| provider-model-selection-runtime.ts | 分割。Family／Effort／Tier解決はAI Adapter。Risk／WorkClass等の選択根拠は呼出し側入力。Objective計画は移管しない。 |
| provider-eligibility-runtime.ts | 分割。認証・Quota・配布対応の意味はAI Adapter。実環境・Home・Policyとの観測組立てはCoordinator。現行preflight要求を認証済みへ昇格しない。 |
| delegation-route-selection.ts | Coordinator。Executor／Reviewer、Depth、Ancestor、独立性の選定。モデル解決のみAI Adapterを利用。 |
| delegation-selection-grant-runtime.ts | Coordinator。Operation結合、30秒有効期限、単一消費と失効。 |
| provider-authority-runtime.ts | Coordinator。Authority発行・消費・失効、実行直前再検証。 |
| provider-home-mount-grant.ts | Coordinator。Grant状態、Operation／Profile／Home Identity結合。 |
| provider-home-mount-grant-runtime.ts | Coordinator。Lease、Mount使用、完了と失効。 |
| provider-home-windows-adapter.ts | CoordinatorのHost接続。Native署名、helper起動、opaque観測とMount source消費。接続方式だけAI Adapterへ問い合わせる。 |
| provider-home-observation.ts | CoordinatorのNative接続／Protocol。Candidate StoreとRuntime Stateの観測も含み、AI Adapterへ移さない。 |
| provider-home.ts | 分割。Provider固有Home選択・認証方式はAI Adapter。OS Root、保護、Mountと`observeRuntimeOwnedWindowsProviderHomeCandidate`はCoordinator。 |
| provider-isolation-profile.ts | Coordinator。Authority、Mount Grant、Egress結合。Provider情報のみAI Adapterを利用。 |
| provider-lifecycle.ts | 分割。`AUTH_POLICIES`はAI Adapter。共通実行制約、模擬Provider観測、期限・取消・不存在はCoordinator。 |
| provider-task-packet-runtime.ts | Coordinator。外部送信Grant、Repository投影、秘密検査と単一使用。`promptFor`もProvider非依存のTask Contractとして維持。 |
| provider-task-structured-result.ts | 分割移管済み。`extractProviderTaskEnvelope`のJSONL／Envelope／Turns・Usage解釈はAI Adapterの`output/task-envelope.ts`へ接続。Executor／Reviewer結果、Review整合性とRemediation CapabilityはCoordinator。処理本文の同一性と出力・Task結果28契約を確認。 |
| codex-docker-runtime-adapter.ts | 分割移管中。CLI、認証引数、禁止環境集合、Model構文と固定環境値検査、init／seccomp要求をAI Adapterから取得。環境のDocker引数化はCoordinator。取消・二時計期限・一回消費は共通Lifecycle、九コマンドとMount組立ては共通Command Plan、資源名と乱数検査は共通Resource Planへ単一化した。受理・Packet消費・Authority照合・候補保存は`docker-runtime/provider-docker-preparation.ts`へ接続済み。既存Capability StoreとProvider固有計画・結果は維持し、検証用Factoryも共通準備へ移管済み。Factory・Claude固有引数移管後の全配布133契約も成功した。残るMount・Egress・選定Identity・Capabilityの計画組立ては当初予定の段階5Cで共通実行へ統合し、二Provider専用Fileを最終配置として残さない。 |
| claude-docker-runtime-adapter.ts | 同じ境界で分割移管中。CLI、Turn Budget、認証引数、Model構文と固定環境値検査はAI Adapter。Container／Network／Proxy Token／MountとPreparedPlanはCoordinator。取消・期限・消費、九コマンド・Mount組立て、資源名・乱数検査と準備本体は共通処理へ接続済み。Claudeの作業量確認と公開結果の追加項目を固定呼出し側に保持し、検証用Factoryも共通準備へ移管済み。Factory・Claude固有引数移管後の全配布133契約も成功した。残るMount・Egress・選定Identity・Capabilityの計画組立ては当初予定の段階5Cで共通実行へ統合し、二Provider専用Fileを最終配置として残さない。 |
| claude-subscription-authentication.ts | 分割。login／status引数と`probeConfirmed`はAI Adapter。`runDockerCommandWithAuthority`、`cleanAuthenticationResources`、不存在、Home LockとRecovery記録はCoordinator。 |

### Workbench AI配下

現行Pathの接頭辞は`40_Develop/coordinator/src/workbench-ai/`である。

| 現行ファイル | 確定する責務境界と予定処置 |
|---|---|
| workbench-ai-advice-provider-command.ts | AI Adapter。Codex／Claude助言CLI Plan。結果の意味Schemaは中立入力として渡し、Coordinatorを逆importしない。 |
| workbench-ai-advice-provider-output.ts | AI Adapter。Provider Envelopeとevent抽出。 |
| workbench-ai-advice-execution-plan.ts | 分割移管中。Profileの五項目exact照合とCLI計画はAI Adapter。Catalog改訂・Hash・Prompt、Repository非共有、tools禁止等の実行条件・Authority照合はCoordinator。 |
| workbench-ai-provider-adapter.ts | 分割移管中。Role、Model、推論強度、Provider／Offeringの整合検査はAI Adapter。TaskのProfile ID対応、Executor選択・実呼出しはCoordinatorの組立て。 |
| workbench-ai-advice-provider-executor.ts | Coordinator。`safePlan`、取消、Effectとcleanupの相関。 |
| workbench-ai-advice-production-runtime.ts | Coordinator。Operation、Home観測、Grant、Docker開始・取消、Host cleanup、Recoveryと失敗相関。Provider分岐は共通記述へ置換。 |
| workbench-ai-advice-runtime-packet.ts | Coordinator。Operation／commandHash結合の単一使用Capability。Command型のみAI Adapterから利用。 |
| workbench-ai-advice-dispatch-runtime.ts | Coordinator。外部送信確認、Single Request Grantと取消・cleanup相関。 |
| workbench-ai-advice-task.ts | Coordinator。投影、秘密検査、許可Reference、Task HashとProvider非依存Prompt。 |
| workbench-ai-advice-result.ts | Coordinator。事実／共有分析／追加推論／次候補と許可Referenceの意味Contract。Provider Envelopeではない。 |
| workbench-ai-request-application.ts | Coordinator。一依頼の開始・観測・取消。Objective／Queue／採否とは分ける。 |
| workbench-ai-repository-composition.ts | Coordinator。Repository限定助言Packet組立て。現在入力はPROJECT_CONTEXT.md一つ。Root検証はVersion Control、ProfileはAI Adapter。 |
| workbench-ai-change-candidate-runtime.ts | 分割。単一Candidate TaskはCoordinator公開API。現行Project Runtime内部依存を撤去し、Attempt／Project進行の組立てはOrchestratorへ。 |
| workbench-candidate-application.ts | Orchestrator。採用、Persistence、Integration RecordとSnapshot維持。本文read／discardはCoordinator公開Candidate APIを利用。 |

### Architecture／Qualityへ持ち越す具体的な差

- `workbench-ai-request-application.ts`は取消要求時に即座にSnapshotを`cancelled`へ変え、後続結果を捨てる。これは実停止・cleanup完了の証拠ではない。段階2・3で取消受付と終端の表示契約を分け、段階5・6で公開入口の観測まで検証する。
- Provider結果の正規化を移管しても、Review判断・Remediation AuthorityをAI Adapterへ移管しない。
- Coordinator内のCandidate採用がProject Runtime内部を呼ぶ逆依存を撤去する。候補生成だけを採用済みと表示しない。
- 汎用DI、Capability Store注入、Docker callback Frameworkは新設しない。純粋な記述／ParserとCoordinator実行所有の分離で処置する。

## Domain三領域の責務照合

読み取り専用確認では統合方針は維持できるが、全Sourceを一律分割する一次案は粗いと確認した。以下を全ファイル表より優先する。配置統合とRuntime保存Path変更は別であり、`.crdd/config`、Canonical Topic／Meeting配置、保持期間をこの再編だけで変更しない。

| 現行のまとまり | 新責務入口／処置 |
|---|---|
| crdd-domain-library/src/artifact全5File | artifactへ丸ごと移管。Model、Markdown解析、SchemaとGraphを維持。 |
| crdd-domain-library/src/outcome.ts | outcomeへ移管。complete／partial／invalid／unobservableとIssueの意味を維持。 |
| crdd-domain-library/src/reality-traceability全7File | reality-traceabilityへ移管。Annotation、Discovery、Symbol検証、GraphとIssue。 |
| crdd-domain-library/src/quality-change-control全2File | quality-change-controlへ移管。固定候補、必須監査集合、結果統合と再入場。 |
| crdd-domain-library/src/filesystem-store-rootの入口とWorker | storageへ移管。Root Capability、Kernel Lock、Owner不存在証明。新Store Frameworkへ置換しない。 |
| crdd-domain-library/src/repository-observation全3File | repositoryへ移管。Version Controlの検証済みRootを利用し、依存方向を逆転しない。 |
| project-operation/src/repository-project-context.ts | project-contextへ丸ごと移管。固定Markdown契約。 |
| project-operation/src/repository-release-projection.ts | project-contextへ丸ごと移管。Release投影の解析であり判断を発行しない。 |
| project-operation/src/repository-quality-projection.ts | project-contextへ丸ごと移管。Quality投影をQuality Gateへ統合しない。 |
| project-operation/src/project-operation.ts | 分割。Source型と`projectProjectOperationSources`はproject-context。`applyProjectOperationCandidateDecision`と型は同入口内のContext候補採否契約として分離する。Quality専用Gateへ混ぜず、Task一般採否へ拡張しない。 |
| project-operation/src/topic-meeting.ts | Topic型／Parser／Promotionはtopic、Meeting型／Parser／Outcome処置はmeeting。小さい表読取り共通核のみ共用し、新Parser Frameworkを作らない。 |
| project-operation/src/topic-meeting-application.ts／topic-meeting-repository.ts | 責務別公開入口を分ける。Paging、Cursor、Relation、削除確認、Revision競合、保存確定、CHG存在確認の共通核は複製しない。跨り操作は一方向の内部呼出しにし、両indexの循環importを禁止。 |
| runtime-data/src/tool-runtime-config.ts | configurationへ丸ごと移管。長いことだけを理由に分割しない。設定読取りと保持処置のOwnerを区別。 |
| runtime-data/src/temporary-operation-store.ts | storageへ丸ごと移管。一時Operationの世代・Lock・再入場・promotion・終了の閉集合を維持。 |
| runtime-data/src/runtime-data-contract.ts | 分割。Repository Manifestはrepositoryの単一Owner、Trust Policy Schema検査はconfiguration。後者を未採用のTrust Authorityへ有効化しない。 |
| runtime-data/src/runtime-data-path-resolver.ts | 分割。Root検証／用途Path／観測はrepository、Directory作成／ignore／readyとCROS OS Rootはstorage。署名Root解決の`resolveBundledRepositoryRuntimeDataPathsForProtectedSigning`を用途限定の接続として明示。移動後import.meta.urlの祖先数を再計算・検証。 |
| 三つのsrc/index.ts | 責務別公開入口へ再構成。CheckerやSemantic CoverageにTopic Store／Workerを巨大barrel経由で読み込ませない。 |
| 三領域のpackage／lock／tsconfig | domain-modelへ統合。旧試験scriptsの集合を減らさない。 |
| 三つのsymbol.json | PathとSubsystem Ownerを統合。配置名だけを理由に安定Symbol Identityを再発行しない。 |
| 全契約試験と四Fixture | 新責務のtestsへ移管。跨り試験は維持。Filesystem Lock Owner／Contender、Temporary Operation Create／Resumeの子Process入口とcwdも追従。 |

固定Workerは`new URL(..., import.meta.url)`、Fixtureは`path.resolve`またはspawnSyncで参照される。相対import変更だけでは閉じない。Manifestの子入口閉包、Runner分類、配布入口にも同時処置を与える。CHG-000074のArtifact／Symbol Foundation、CHG-000082のProject Context／Topic・Meeting CRUD／一時操作清掃の過去保証は保持し、履歴Evidenceの旧Path自体は書き換えない。

Context候補採否のpure関数は現在public exportと契約試験があり、Source上の`ownerEffectIssued`返却値を実Filesystem採用の観測へ読み替えない。新Ownerで必要な本番接続または用途限定内部契約の処置を段階2・3で照合する。着手前確認だけで全69Fileの意味監査・能力保持Passを主張しない。

## Orchestratorの本番接続と旧保存の処置

現行接頭辞は`40_Develop/coordinator/src/project-runtime/`。全19Fileの公開関数・本番factory・利用側を読み取り専用で照合した。durable-foundation内部の全遷移を逐行監査した結果ではない。新構成への配置案は次のとおり。

| 現行ファイル | 新Owner／予定処置 |
|---|---|
| docker-project-recovery-settlement.ts | OrchestratorでProject／世代／Task／Attempt／Operationとsettled義務を照合。資源回復receiptの消費はCoordinator公開API。 |
| execution-intelligence-adapter.ts | Orchestrator。Task Attempt観測の記録変換。Coordinator共通観測の記録と重複させない。 |
| project-runtime-acceptance-authority-adapter.ts | Orchestrator。Project／Milestone／Principalと採用判断権限。Provider実行権限とは別。 |
| project-runtime-acceptance-decision-store.ts | v2で使う型・検証のみOrchestrator。旧acceptance-decisions世代Directory Writerは撤去。 |
| project-runtime-candidate-integration-adapter.ts | 分割。候補統合、基準Revision、採用・rollbackはOrchestrator。候補Bodyのread／persist／publishはCoordinator公開API。 |
| project-runtime-composition-root.ts | Orchestrator。Objective／Decision／Acceptance／State Queryの組立て。Coordinator private start／cancel／Capability／Recoveryを公開操作へ置換。診断streamは上位Ownerで終了。 |
| project-runtime-decision-capability-adapter.ts | Orchestrator。判断継続用の単一使用SecretとHash。平文Secretを保存しない。 |
| project-runtime-decision-recovery-store.ts | v2で使うIntent型・検証のみOrchestrator。旧recovery/decisions Writerは撤去。 |
| project-runtime-durable-foundation.ts | Orchestratorの現在codec／state／Queue／Lease／受付世代と履歴に責務分割。旧schema／reader／writerの恒久互換処理を移管しない。保存primitiveはdomain-model／Nativeの既存入口を利用。 |
| project-runtime-execution-authorization-adapter.ts | 分割。Project／Task／Attempt／Revision結合はOrchestrator。単一実行Capability発行・未使用失効はCoordinator。 |
| project-runtime-execution-host-adapter.ts | 分割。Project用Clock／IDはOrchestrator。Process世代観測・終了不明時の実行不能化はCoordinatorのHost公開操作。 |
| project-runtime-history.ts | Orchestrator。終了記録・時刻・一次失敗／cleanup・保持期間・重複の意味。 |
| project-runtime-integration-record-adapter.ts | v2型・結果検証のみOrchestrator。旧results/integration／adoption WriterとReaderは撤去。 |
| project-runtime-objective-intake.ts | Orchestrator。受付Epoch、既受付ID拒否、Objective／Queue、持続状態と終了後maintenance。 |
| project-runtime-public-adapter.ts | Orchestrator公開入口。Coordinator indexから再exportしない。Principal実観測のみ下位公開操作へ。 |
| project-runtime-single-task-adapter.ts | 分割。開始／取消／完了待機／listener解除／終了結果とexact Recovery検証はCoordinator。Project入力・結果変換はOrchestrator。Workbench候補も共通単一実行を利用する。 |
| project-runtime-task-recovery-adapter.ts | Project義務・相関はOrchestrator。実Recovery／ack／finalizeはCoordinator公開操作。 |
| project-runtime-windows-decision-store.ts | Orchestrator。判断状態保存、Principal観測、保護Root、排他、CASを保持。保護方式変更に拡張しない。 |
| project-runtime-windows-platform-adapter.ts | 分割。Project Lease／RootはOrchestrator。子Process環境、Provider Home、Docker cleanupとNative観測はCoordinator。partialを全面対応へ変えない。 |

関数分割の一次キーは`runProjectRuntimeSingleTaskAttempt`、`consumeProjectSettledDockerRecoveryWithRuntimeBoundary`、`createRuntimeOwnedProjectCandidateIntegrationAdapter`、`createProjectRuntimeExecutionHostAdapters`、`createCurrentPersistencePorts`／`createProjectRuntimeSnapshotPersistencePorts`。開始前取消、開始観測失敗後の取消と完了待機、遅延Abort、exact Identityを保持する。旧factory丸ごとの移動ではなく、現在のsavedv2本番factoryとcodecから新接続を組み直す。

追加ConsumerはCoordinatorのdocker-recovery-runtime、Workbench候補application／runtime、Coordinator index、CLI、template/tools/crdd-mcp.ts、Workbench runtime-activity、固定19Pathを持つconsumer-closure試験と配布閉包／改ざん試験である。特にDocker回復本体のProject state照合を上位へ移し、Coordinator→Orchestrator importを残さない。

保持根拠は[②保存刷新](261005_project-runtime-phase2.md)の本番初期化2/2・Host36/36、受付世代／Queue／Lease／30日履歴である。Portableの2266 Pass・6失敗・5 Skipと限定是正35/35を一つの全回帰Passへ合算しない。[全E2E収集](261004_all-e2e-collection.md)のReviewer未起動／create outcome unknown、[正式要約](261006_release-test-retention-phase4.md)の旧四経路と回復は未解決範囲・過去版として保持する。

### CLI入口の分離案

親のSource再確認では単一Coordinator binが共通launch判定後にcoordinator-commandを起動し、同commandがProject本番composition／初期化を直接importしている。`runProjectCommand`はbounded stdin、取消Signal登録・解除、JSONと終了値を持つため、単なるexport変更では足りない。

予定は、Project command本体をOrchestratorの単一bin／cliへ移し、Coordinator binは単体Task・診断・候補・署名等の起動だけを所有すること。既存配布入口の`crdd-coordinator.ts`は用途振分けだけの薄い入口としてProjectをOrchestratorへ接続する。入口名を理由にCoordinator本体へOrchestrator依存を残さない。interactive／automationの端末・JSON条件、stdin上限、Signal解除、終了値と現在のdevelopment_candidate表示を維持する。具体的な共通入力・報告関数の公開subpathは段階3で固定し、入力本文をRouterで先読みしたり新Processを挟んだりしない。

## Platform Accessの19FileとNative関数境界

単一Rust package／bin／固定Protocolを維持する。Folderはkebab-case、Rust module FileはCoding Standardsに従うsnake_case。Edition、依存、toolchain、panic方針を再編理由で更新しない。

| 現行のまとまり | 同package内の予定配置・処置 |
|---|---|
| .gitignore／Cargo.lock／Cargo.toml／build.rs／rust-toolchain.toml | 維持。target除外、固定Windows toolchain、Worker Hash埋込みを保持。 |
| src/main.rs | 入口と限定Modeを維持。Host frame搬送のみprotocol/dispatch.rsへの限定分割候補。新Modeを作らない。 |
| src/protocol.rs／host_namespace_protocol.rs／terminal_protocol.rs | 移管済み: protocol/access.rs／host_namespace.rs／host_record.rs。bytes、magic、revision、flagsと判定本文を維持し、全Native参照・試験台帳・Symbol・既存Coverage対象を追従。通常Native50件と台帳20契約が成功。terminalはHost終端記録であり対話端末ではない。 |
| src/windows_owned_child.rs | 移管済み: process/owned_child.rs。spawn／wait／terminated_cleanupとOutcome型を同じOwnerに保持。子試験のexact名も追従し、取消・timeout・Owner handle close後の終了観測を再確認。 |
| src/windows_directory.rs | 移管済み: filesystem/windows_directory.rs。system directoryの実API観測を維持し、windows.rsからの固定Known Folder五関数とShell取得・解放を分離。環境変数だけの解決に置換しない。 |
| src/windows.rs | 移管済み: Token／SID観測はprocess/principal.rs、Handle／ACL／Directory Identityとbounded ACE SIDはfilesystem/protection.rs、固定Home／Candidate／Runtime Namespaceはfilesystem/provider_home.rs、Root用途別観測はfilesystem/root_observation.rs。旧Fileを撤去し、入口は用途別Ownerを直接呼ぶ。本文保持、通常Native50件、Clippyを確認。 |
| src/windows_terminal.rs | 移管・分割済み: filesystem/host_record.rsは専用記録の容量・予約・保存・読戻し、protected_file.rsは保護付き作成・Flush・読戻し・同Identity非置換公開・close、host_namespace.rsは保持親chain・固定child初期化・十一／十二対象観測を所有する。公開入口、fixture所属・exact子起動名・静的Graph Hash・台帳・Symbol・Coverage対象を追従。本文保持、通常Native50件、Clippy、台帳・Oracle23件を確認。Native実環境専用試験・配布閉包と段階5B全体確認は別に残る。任意Path保存APIへ一般化しない。 |
| src/docker_authenticode.rs | 移管済み: docker-desktop/publisher.rs。Docker publisherの限定検査。処理本文を保持し、Native参照・Symbol・試験台帳を追従。Windows向け型確認、通常試験44＋CLI6件が成功。明示起動専用23件は未実行。 |
| src/docker_repair.rs | 移管・分割済み: signed artifact／Process Path・作成時刻・scope照合はdocker-desktop/identity.rs、Mutex・停止・開始・再起動はrepair.rs。本文と閉じたModule可視性を保持。Engine readinessとTask義務はCoordinatorに残す。 |
| symbol.json | File／関数／test所属を追従。Relationを改名だけで失わない。 |
| tests/cli.rs／fixtures/host_namespace_creation.rs／windows_protection.rs | 維持。Module参照と固定worker文字列を同時追従。自己生成fixtureの範囲を拡張しない。 |

`TerminalStage::{create,publish,verify_identity,close}`、bounded readと同Handle保護検査が保存primitiveの分割キー。`terminal_capacity_name`、`with_terminal_capacity`、`finish_terminal_capacity`、inventory／reservation／save／read、`ObservedTerminalRecord`等は専用記録の分割キー。publishは既存名非上書きでありstate atomic replaceと同じ意味ではない。NT rename pending中のbuffer／IO_STATUS_BLOCK生存、不存在と観測不能、保存とHandle終了、capacity unknownの保持を変更しない。

固定非import依存はNative保護scriptの`windows::protection_tests::terminal_protection_fixture_observes_handle_sharing`、子worker名とcold worker名、`check-platform-access-coverage.ts`の五File母集合（main／protocol／windows／docker_repair／tests/cli）、Native frame Adapter、固定exe配布Pathと署名閉包である。Module移動と同時に全数追従し、移動行をCoverage分母から落とさない。明示targetと共有target Directoryを維持し、無印debug／releaseを標準で生成しない。

[過去Native要約](261006_release-test-retention-phase4.md)は正常・拒否、Root／run／exe／cwd不一致、Handle／worker終了・fixture不存在までの根拠であり、本番統合・厳密期限・親喪失後回復・署名E2Eの成立ではない。新配置の実測前に旧結果をPassへ流用しない。

## 非import利用側と回帰実行の照合

基準Sourceのpackage公開入口、scripts、配布入口および回帰実行側を確認した。ファイル名の移動だけでは次の経路は追従しないため、段階3の設計と段階5の同時切替対象へ含める。

| 利用側 | 現在の接続 | 新配置での予定処置・確認方法 |
|---|---|---|
| package公開入口 | 17 Node packageのname／exports。Coordinatorは`./cli`のみで、他領域は主にsrc/index.ts。domain-libraryは7 subpath | 16領域への統合後も責務別subpathを維持。公開呼出し側から型・実行を確認し、巨大barrelとprivate importを増やさない。RustはCargo入口を維持。 |
| template/tools/crdd-coordinator.ts | Coordinatorの単一binをimport | 入口名を維持し、Repository開発Root／利用側01_CRDD内Rootの両方で本体接続を確認。 |
| template/tools/crdd-mcp.ts | mcp、project-operation公開入口 | MCP Server／domain-model公開入口へ同時切替。`--cros`を明示選択とし、単体は検証済み起動Rootへ固定。両ModeのRepository対象Toolは同じrepositoryId必須入力を使い、単体一覧は自身一件のみ。CROS Credentialを単体へ要求せず、設定不正時の自動Fallbackを作らない。 |
| template/tools/crdd-cros-server.ts | MCP内Shared Serverとruntime-dataのCROS Root型 | 採用能力をMCP Server入口へ置換してから撤去。独立CROS REST／Gatewayを残さず、認可・TLS配置条件・管理者回復を失わない。 |
| template/tools/cros-shared-server-config-example.json | 人間から見える設定例 | CROS登録・ExposureとMCP Server配置へ責務分離。正式設定例は見える実ファイルとして残し、局所隠し値だけに置換しない。 |
| Coordinator package scripts | 個別Coverage、Native build／lint／Host試験、Traceability／Graph、署名実境界検証 | Source移管と同じ変更でPath／試験Owner／閉包を更新。Nativeの明示target、Portable／Host分離、外部AI自動非実行を維持。 |
| Workbench package scripts | Vite build、prestart／pretest build、Node Server、Visual system test | workbench-serverへRoot変更。CSRのbuild資産とServer配信閉包を同時更新し、27表示条件・終了後Process Treeを再観測。 |
| verification-runner/catalog/test-catalog.ts | Owner18種、engine表、試験Path正規表現、changedPath判定 | 新16領域と分割後試験のOwnerを全数対応。移管前後の選択集合と実行集合を照合し、分類だけを変更しない。 |
| verification-runner/application/regression-runner.ts | 固定Node Owner実行一覧、static checks、`--all`の固定変更Path | 選択されたOwnerを実行できる単一の一覧へ接続。NodeとCargoの方式は維持し、不対応Ownerは成功扱いせず停止。 |
| 署名／配布／Promotion | Coordinator scripts、Native配布実体、template/tools/coordinatorのManifest | V6固定Git実行閉包、新package／Asset Path、外部TTY、署名後のmanifest-only昇格へ対応。現署名の結果を新閉包へ流用しない。詳細は再編計画§24の未確認義務を維持。 |

### 検出した既存の回帰実行欠落

`RUNNER_SUPPORTED_OWNERS`は18領域を許可するが、`runLevelStage`のNode実行一覧は11領域に限られる。`ai-runtime`、`cros`、`official-asset-governance`、`project-operation`、`visual-preview`、`workbench`の6領域はその実行一覧にない。`runStaticStage`も同6領域を処理しない。`--all`の固定変更Pathは9領域であり、全18領域そのものを列挙していない。これは新配置による回帰ではなく、基準版に既にある実装上の集合差である。

選択件数やstage成功だけでは全選択試験の実行を証明できない。段階5でOwner一覧の重複を除き、段階6では「選択した全試験が実際の実行要求へ一度ずつ到達する」「不対応Ownerを成功へ丸めない」を反証する。現在の全回帰Passは主張しない。元の各package試験を削除せず、新Ownerへ維持する。人間の追加判断を必要とする新機能ではなく、計画済みの回帰Runner追従と全域検証の欠落是正として扱う。

静的な集合比較も再実行した。登録18領域に対しNode実行11＋Cargo実行1で12領域、差は上記6領域で一致した。現在Catalogで対応する試験FileはAI Runtime 3、CROS 12、Official Asset Governance 2、Project Operation 6、Visual Preview 2、Workbench 4の計29Fileである。これはFile数でありTest Case数ではない。今回の比較はSourceとCatalogの読取りだけで、試験実行・Provider送信・Docker操作は発行していない。

## 基準能力・新Owner・保持根拠の対応

package数とARCH-IDは一対一ではない。下表は現行18領域の能力を新Ownerへ対応するもので、ARCHをFolderごとに新設する一覧ではない。実行結果は記載された過去版だけに適用される。新構成の確認は段階6・7で再実施する。

| 現行領域 | 保持する能力／新Owner | 現在の主利用側 | 過去根拠・現在の限界／新構成で必要な確認 |
|---|---|---|---|
| ai-runtime | Catalog、Profile解決・CRUD・Revision／ai-adapter | Coordinator、CROS、MCP、Workbench | [Profile契約](260927-2157_ai-profile-catalog.md)。未観測を認証済みにしない。固有CLI分離後のProfile一致と認証・取消実境界を確認。 |
| artifact-signing | 署名入力・鍵利用・固定結果／artifact-signing | Coordinator署名scripts | [署名・結果集約](261006_release-test-retention-phase4.md)。V6 TTY・実子Processと新閉包は未評価。重い署名範囲をChecker等へ拡張しない。 |
| checker | 決定論的構造／Coverage検査、FindingとCLI／checker | 配布入口、回帰Runner、開発者 | [Symbol Foundation変更](../../CHG-000074/change.md#4-検証と残るgate)。旧試験Passは新Owner反映の証拠ではない。実採用Repository入口と同じFinding意味を確認。 |
| coordinator | 単体Task、Executor／Reviewer、候補本体、取消・回収・一次失敗／coordinator | 単体CLI、Orchestrator、Workbench | [旧四経路・回復](261006_release-test-retention-phase4.md)、[未完了E2E](261004_all-e2e-collection.md)。公式CLI切替後・新署名で全必要経路と実終端を確認。 |
| crdd-domain-library | Artifact／Graph／Symbol／保存Root／品質変更Gate／domain-model責務別入口 | Checker、Semantic Coverage、Store利用側 | [CHG-000074](../../CHG-000074/change.md)、[責務整理の旧検証](../../CHG-000076/change.md)。Worker・Root・不存在とGraph非部分発行を維持。 |
| cros | 登録Repository、Credential／Session／Exposure、権限内Federation・管理者回復／cros | MCP Server、同Process Workbench | [Remote Context](260927-2029_phase4-remote-project-context-mcp.md)、[旧Shared運用](260928-1114_phase5-shared-server-production-boundary.md)。REST撤去後のMCP・内部呼出しで同じ認可を検証。契約試験のみのContext Package等は本番成立へ昇格しない。 |
| execution-intelligence | 観測記録・照会・評価候補、欠測と30日保持／execution-intelligence | Coordinator、Orchestrator、Workbench／CROS投影 | [③刷新](261006_execution-intelligence-phase3.md)。記録生成と読取りの意味を区別し、移管後の時刻・重複なし・保持設定を確認。 |
| mcp | Repository単体stdio、認可されたHTTP Machine入口・Topic／Meeting操作／mcp-server | AI／Machine、Remote Workbench | [Repository Context MCP](260927-2014_phase4-project-context-mcp.md)、[CRUD](260927-2055_topic-meeting-workbench-mcp-crud.md)。Activity／Profile本番接続、Origin／TLS配置・取消を新入口で確認。 |
| official-asset-governance | 素材の権利・用途・収録判定／official-asset-governance | 公式素材Tooling | ARCH-000017と現契約試験を保持。Source／入口維持で他領域統合を読み込ませない。過去署名Provider試験を素材権利のEvidenceにしない。 |
| platform-access | Windows世代／ACL／Handle／Job／固定Native Protocol／platform-access | Coordinator Native Adapterと署名・Host試験 | [Native正式要約](261006_release-test-retention-phase4.md)。内部移動後に固定frame、Worker、Hash、終了と拒否を再実測。本番統合・期限・親喪失後回復の未成立を保持。 |
| project-operation | Context投影、Topic／Meeting CRUD・Relation・Promotion／domain-model | Workbench、Repository単体MCP、CROS | [CRUD](260927-2055_topic-meeting-workbench-mcp-crud.md)、[Remote操作](260928-0325_phase5-remote-workbench-topic-meeting.md)。跨り更新・完結条件・削除確認・Revision競合・非開示を維持。 |
| project-runtime | Objective／Task／Decision／Acceptance／Queue／savedv2／orchestrator | CLI、MCP、Workbench、Activity投影 | [②完了範囲](261005_project-runtime-phase2.md)。旧Writerを再導入せず本番保存・再入場と単一実行の相関を確認。Provider停止・未実行は[全体収集](261004_all-e2e-collection.md)から引継ぎ。 |
| runtime-data | Root／Manifest／設定／一時操作・所有者／domain-model | 各Owner Store、署名入口、配布起動 | [①保存境界](261005_runtime-data-phase1.md)、[③のPath閉包是正](261006_execution-intelligence-phase3.md)。署名Root・Fixture／Worker・用途限定清掃と設定既定値を維持。 |
| semantic-coverage | 決定論的IR、片側Relation、生成Bundle／semantic-coverage | Checker・現実照合と生成入口 | [Semantic Foundation](../../CHG-000075/change.md)、[現在の現実照合](261006_phase2-reality-audit.md)。Domain subpath移行、実体参照、決定性・原子的公開を再確認。生成RelationをTest Passとしない。 |
| verification-runner | Catalog・変更影響・段階選択・実行／verification-runner | 開発Workflow、全回帰 | [過去責務整理](../../CHG-000076/change.md)。上記6領域の実行欠落が現基準にある。新16Ownerの選択と実実行の全数一致を反証し、旧選択数を全実行根拠にしない。 |
| version-control | Root／Revision／Tree／Diff、Snapshot／Publication／version-control | 各Root検証、Workbench Git操作、Orchestrator採用 | [変更公開IT](260927-1836_phase3-change-publication-it.md)、[旧責務検証](../../CHG-000076/change.md)。Domain CRUDがCommit／Pushを発行しない境界と新呼出し側を確認。 |
| visual-preview | 局所配信、Browser Zoom、Visual確認の終了／visual-preview | Visual検証Workflow、Workbench画面確認 | [実Browser表示](260928-1028_phase5-workbench-actual-browser-visual.md)、[CSR終端確認](260928-2354_phase5-pure-csr-runtime-closure.md)。維持領域。Server常駐を理由に製品機能へ変えず、実Browser／Process終了を再確認。 |
| workbench | 純粋CSR、Browser API、五場面とOwner情報・Git・AI接続／workbench-server | Human Browser | [純粋CSR](260928-1745_phase5-workbench-pure-csr.md)、[Remote操作](260928-0325_phase5-remote-workbench-topic-meeting.md)。Browser RESTは維持、Server間RESTのみ撤去。画面27条件と単体／Remote AIの未完了義務を別に確認。 |

未知または未接続の利用側は、CROSの契約のみのContext Package／Handoff／AI計画、Activity／Profileの本番接続、V6実端末、現行Snapshot本番Writer／Host終端、Workbench候補・Reviewer、全域Graphと明示した。これらは能力不存在や今回の対象外ではなく、設計・実装・検証の後続Gateで処置する必須集合である。Trust Policy独立Framework、Linux自動Deploy、第三Surface、Workbench UX再探索は人間が採用していない実装範囲として区別する。

## 必須実経路と現在QA項目の固定集合

対象は再編計画§23の最終実境界集合である。IDは現在のQuality Definitionに実在する検証義務を参照し、経路全体がそのIDだけで十分に設計・実行済みとはしない。以下の不足は段階3でQuality Ownerが具体化し、段階6／7の選択集合へ保持する。表の経路を合格数を減らす目的で統合・除外しない。新しい要求が判明した場合は影響を評価して同じ表を改訂する。

| 必須実経路 | 採用能力／新Owner | 現在Local Item ID | 根拠・欠測と予定処置 | 後続Gate |
|---|---|---|---|---|
| Coordinator単体Codex実行 | 単体実行／Coordinator＋AI Adapter | ERB-IT-001、EST-ST-003、EST-ST-005 | 外部構成・開始・結果・終了と送信同意を相関する。旧四経路根拠は対象版を区別し、新閉包で再確認。 | 3・6・7 |
| Coordinator単体Claude実行 | 同上 | ERB-IT-001、EST-ST-003、EST-ST-005 | Codexの成功を流用しない。認証・Provider Home・公式CLI差を個別確認。 | 3・6・7 |
| Executor Codex→Reviewer Codex | 実行／独立Review／Coordinator | ERB-IT-001、PRL-ST-001、CPR-IT-001、EST-ST-011 | 現行項目は個別組合せを列挙していない。段階3で四経路を独立scenarioに固定し、Reviewer起動・結果帰還を確認。 | 3・7 |
| Executor Codex→Reviewer Claude | 同上 | ERB-IT-001、PRL-ST-001、CPR-IT-001、EST-ST-011 | Provider交差と独立Reviewを保持。過去対象版の結果は新経路の成立証明にしない。 | 3・7 |
| Executor Claude→Reviewer Codex | 同上 | ERB-IT-001、PRL-ST-001、CPR-IT-001、EST-ST-011 | [全体収集](261004_all-e2e-collection.md)のReviewer準備停止と一次原因・回収義務を引き継ぐ。 | 3・7 |
| Executor Claude→Reviewer Claude | 同上 | ERB-IT-001、PRL-ST-001、CPR-IT-001、EST-ST-011 | 四経路の一つとして独立評価。単体Claudeの結果から推定しない。 | 3・7 |
| 公開取消・親Process喪失・回収・新試行 | 実行Lifecycle／Coordinator | ERB-IT-002、ERB-IT-003、ERB-IT-004、ERB-ST-030、EST-ST-005 | 両Providerの要求受付と実終了を分離。旧Workspace再利用禁止、遅延通知、一次失敗と清掃結果の分離はQA-000006のSnapshot追加scenarioを保持。 | 3・6・7 |
| Claude再認証・再入場 | Provider認証差／AI Adapter、資源／Coordinator | ERB-IT-008、ERB-UT-016、ERB-IT-017 | 固定Home・実認証・耐久的回収を確認。秘密の表示・記録を行わず、認証成功だけをcleanup成功にしない。 | 3・6・7 |
| Docker通常故障と限定unknown終了 | Disposable実行／Coordinator | ERB-IT-003、ERB-IT-004、ERB-IT-014、ERB-ST-030 | 過去unknownを消さず現在資源と旧Ownerを観測。旧ERB-ST-009／011／IT-012の段階退避・Handoff義務は縮小目標と不一致があり、段階3で保持保証と撤去要素を再導出する。 | 3・6・7 |
| Objective→Task→候補→統合待ち | 上位編成／Orchestrator→Coordinator | PRL-ST-001、PRL-IT-012、PRL-UT-014 | ②の保存根拠と公開入口を対応させる。Task完了をObjective受入にしない。 | 3・6・7 |
| 判断待ち・Objective／Milestone受入 | 上位判断／Orchestrator | PRL-UAT-002、PRL-IT-008、PRL-ST-009、PRL-UAT-010 | 明示判断と再入場、重複Effect 0を確認。自動受入を追加しない。 | 3・6・7 |
| Queue・Lease・state／history・回復再入場 | 上位現在状態／Orchestrator | PRL-IT-011、PRL-IT-013、PRL-ST-003、PRL-ST-004、ERP-IT-001、ERP-IT-003 | savedv2接続、世代切替・30日保持・未解決除外を②の根拠から引継ぎ。下位回収と上位保存を一つの成功値にしない。 | 3・6・7 |
| 候補採用・破棄・保留とRevision競合 | 採否／Orchestrator、候補本体／Coordinator | CPR-IT-006、CPR-UT-009、CPR-UAT-002、CPR-UAT-003 | 明示確認、対象・Scope再観測、採用Receiptを保持。Commit／Pushは別操作。 | 3・6・7 |
| Workbench Codex／Claude助言 | Human AI入口／Workbench Server→Coordinator | ERB-UT-023、ERB-IT-001、EST-ST-003、EST-ST-005 | Provider別の二scenario。UTのFake成功から実助言成功を推定しない。改造CLIのERB-IT-024〜029は今回の保持経路でなく、QA-000006に廃止・置換理由を反映済み。新構成の実Provider成功は未確認である。 | 3・6・7 |
| Workbench Codex／Claude変更候補とReview | 同上＋Orchestrator採否 | ERB-UT-023、CPR-IT-001、CPR-IT-006、EST-ST-011 | 二Providerの候補生成・Review・本体取得・破棄を個別確認。採用・Commit・Pushを試験の暗黙Effectにしない。 | 3・6・7 |
| Local Context・Topic／Meeting CRUD | 同Process内部能力／Workbench Server＋CROS＋Domain Model | PPR-IT-019、RFD-IT-009、CPR-ST-005、CPR-IT-008、EST-IT-010 | Browser RESTを維持し内部RESTだけ撤去。Repository単体とCROS利用の意味・認可を保持。 | 3・6・7 |
| Remote Context・Topic／Meeting CRUD | Machine境界／Workbench Server→MCP Server→CROS | PPR-IT-019、CPR-ST-005、CPR-IT-008、EST-IT-010、EST-IT-002 | [Remote操作](260928-0325_phase5-remote-workbench-topic-meeting.md)をMCP代替経路へ再接続。HTTP成功だけで同じCRUD能力成立としない。 | 3・6・7 |
| Local／Remote Activity取得・欠測・Cursor | CROS公開Reader／Orchestrator＋Execution Intelligence | PPR-IT-002、PPR-IT-010、PPR-IT-012、ERP-IT-001、EST-IT-010 | QA-000004の追加条件とQA-000009のEST-IT-010に、本番Reader、現在値／履歴欠測、Cursor／limit、失効、Local／Remote比較を固定した。実測は未完了。 | 3・6・7 |
| Local／Remote AI Profile CRUD | 管理能力／CROS＋AI Adapter | RCM-IT-005、RCM-IT-010、ERB-IT-006、RFD-ST-003、RFD-ST-004、EST-IT-010 | QA-000001とQA-000009へOwner別Store、expectedRevision、CRUD拒否、保存後応答喪失、現在認可とLocal／Remote比較を固定した。実測は未完了。 | 3・6・7 |
| 三Role・失効・Exposure・非開示 | 共通認可／CROS | RFD-ST-003、RFD-ST-004、RFD-IT-013、PPR-ST-005 | 管理能力を内容Accessにしない。Local／MCP双方で現在Grantを再観測し、非公開Repositoryの存在・秘密を漏らさない。初期管理Credentialは内容Grantなし、発行／rotationはHostまたは同Process Workbenchのみ、Remoteは一覧・Grant変更・失効に限定する。既存IDへ正常・拒否の具体scenarioを対応し、旧Remote秘密配送を保持対象にしない。 | 3・6・7 |
| 全管理者喪失・限定Access回復 | Host管理操作／CROS | RFD-ST-016 | 既存administrator_recovery／full_access_resetの保証を維持。REST撤去はHost限定経路の削除理由ではない。 | 3・6・7 |
| Repository単体MCP stdio／HTTP | Machine入口／MCP Server | EST-IT-001、EST-IT-002、EST-ST-012、EST-ST-013、RFD-IT-009 | stdioのUTF-8分割・EOF・取消とHTTP結果を別評価。CROS設定なしでlocal利用を成立させる。Repository一覧一件、自身IDの受理、別IDの拒否、兄弟Repository非探索、Mode自動切替なしを両入口で確認する。Workbenchは同じ一件を自動選択する。 | 3・6・7 |
| 共有MCPのTLS・Origin・Exposure | 配置契約／MCP Server＋CROS | EST-IT-001、EST-IT-002、RFD-ST-003、RFD-ST-004 | 過去はloopback・模擬TLS Headerまで。QA-000007／009へ実TLS配置、Host／Origin、偽装Header、失効・Exposure変更を具体化済み。実測は未完了。Linux必須性と利用可能環境を設計後に判定し、Windowsで代替済みにしない。 | 3・4・7 |
| Server切断・取消・終了後資源 | HTTP／Process所有／MCP Server・Workbench Server | EST-IT-002、EST-ST-012、EST-ST-013、ERB-IT-020、ERB-IT-021 | Listener・Socket・Request・子Processの実終了を入口別に確認。stdioはEST-ST-012、HTTPは新EST-ST-013で独立判定。body途中・idle・実行中・重複Signalと全Registry終端をQA-000009へ具体化済み。実測は未完了。 | 3・6・7 |
| 実Windows保存・Process・ACL・Native Protocol | OS境界／Platform Access＋Coordinator | ERB-IT-001〜004、ERB-ST-030、RFD-IT-012、RDL-IT-001、ERP-IT-003 | [Native正式要約](261006_release-test-retention-phase4.md)の局所成立と本番未接続を分離。固定frame、Handle、Job、ACL、終端のscenarioを新配置へ対応。 | 3・6・7 |
| 最小署名準備→対話署名→Manifest適用→清掃 | 署名閉包／Signing＋Coordinator | AIT-IT-002、AIT-IT-003、AIT-IT-007〜009、AIT-IT-013、AIT-IT-015、AIT-ST-010 | V6実TTYは未観測。重い署名はCoordinator閉包だけ。AITの汎用Trust Policy義務を今回の新Framework採用にしない。 | 3・6・7 |
| 未改造公式CLIの固定配布と実利用 | Provider配布／AI Adapter＋Coordinator | ERB-IT-031、ERB-IT-001、ERB-ST-030 | 版・Hash・Image局所確認と実助言／実Task／取消を別評価。旧Patch Buildを再導入しない。 | 3・6・7 |
| Workbench実Browser・Asset・画面非破損 | Human表示／Workbench Server＋Visual Preview | ERB-IT-018〜021、ERB-ST-019、ERB-ST-022、OAG-IT-005 | 既存27条件とPure CSR根拠を保持。新構成の本番Server／Assetで既存27条件を再観測する。汎用Webの評価範囲を無断で絞らず、未確認・不適合を人間許容なしにPassへ変更しない。新画面設計は対象外。 | 3・6・7 |

この表は試験結果ではない。詳細設計で現在IDの適用を確定できないものは、Quality Analysisで導出不能／不足として処置する。記載したIDの実在だけをCoverage Passにしない。共通の全利用側移管はRCM-IT-003／004／009、RCM-ST-012、全回帰の登録・実行一致はCQS-IT-011／012、CQS-ST-012へ接続する。

## Checklist

- [x] 全18領域・830Fileの基準母集団を固定した。
- [x] 相対importで取得できる312関係・173利用側を、取得限界付きで記録した。
- [x] 分割候補、置換後廃止候補、維持候補と未確認事項を区別した。
- [x] 分割対象の本文・関数責務、全18領域の保持能力・新Owner・過去Evidenceと現在限界を対応させた。公開API確定・Source移管は後続Gateである。
- [x] package script、子Process、設定、署名、Manifest、Workflowと移行利用側の横断処置を追加し、Runnerの既存実行欠落を識別した。
- [x] 計画の必須実経路を現在QA項目へ全数対応させ、適用不足・旧義務との不一致と後続Gateを明示した。
- [ ] OPEN: 段階2・3の正本設計とQuality補強、段階4の固定設計独立確認・是正後再確認は完了。段階5のSource移管を継続中であり、棚卸し・設計の完了を全移管・能力成立へ昇格しない。最新状態は責務対応計画の各段階記録を参照する。
- [x] N/A: 本表は棚卸し中の計画。Source変更・Runtime試験・外部Effectは発行していない。
