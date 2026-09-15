# 変更トレース: gitlinkサブモジュール検証

変更トレースID: `CHG-000005`
状態: `Released`
担当責任者: Qual-Lab
最終更新日: 2026-07-31

正本規則: [変更](../../../12_Change.md)

## 契機 / 起点

CRDDをサブモジュールとして採用するプロジェクトから、正常なgitlinkをCheckerが未初期化と誤認する報告を受けた。

旧Checkerは、`.gitmodules`の記載と`git -C 00_CRDD rev-parse`の成否を中心に判定していた。親Indexのmode `160000`を直接確認せず、Git metadataへアクセスできない状態を未初期化へ丸めていたため、次の誤判定があり得た。

- 正常なgitlinkでも、権限や実行環境によりHEADを読めないと未初期化になる
- `.gitmodules`の記載だけで通常ディレクトリをサブモジュールとみなす
- Git管理領域だけが残る壊れた状態を初期化済みとみなす
- gitlink OIDとサブモジュールHEADの不一致を見逃す
- `git -C 00_CRDD`が親Gitを探索し、通常ディレクトリを検証済みと誤認する

## 主要な変更意図

サブモジュール宣言、親Indexのgitlink、作業ツリー、Git管理領域、HEAD、Revision一致を別々に確認する。確認不能を未初期化と断定せず、人間と自動化が原因別に対処できる結果を返す。

## 想定する影響

直接変更する成果物:

- 当時の`template/tools/crdd_check.ts`。現在の配布正本は[`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)
- 当時の`tools/crdd_check.test.ts`。現在の移設先は[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- 当時の`tools/crdd_check_fault_injector.ts`。現在の移設先は[`40_Develop/checker/fault-injector.ts`](../../../40_Develop/checker/fault-injector.ts)
- [`README.md`](../../../README.md)
- [`CHANGELOG.md`](../../../CHANGELOG.md)
- 公開版を示す24正本文書のVersion／Last Updatedヘッダー

利用側への条件付き影響:

- 配布Checkerを使用する採用プロジェクトは、更新によりgitlink診断の精度が上がる
- finding codeを完全一致で処理する自動化は、新しい診断コードへの対応を確認する
- JSON利用者は、詳細診断に`baseline_submodule_state`を使用する
- 互換項目`baseline_submodule_initialized`は、`true`を確認済み、`false`をgitlink確認済みかつworktree不在、`null`を非該当または未確認として扱う

工程成果物、データ、利用者操作、セキュリティ、プライバシー、実行時コストへの影響はない。

## 対象外 / 変更してはならないこと

- `00_CRDD`の配置、基準版有効化、人間の決定権限を変更しない
- 基本フォルダ、安定コンテキストID、準拠基準、移行規則を変更しない
- サブモジュール内部を親リポジトリ所有のファイルとして再帰検査しない
- 正当なGit worktreeでGit管理領域が親リポジトリ外にある構成を拒否しない
- 汚れたサブモジュールworktreeの検出は追加しない
- Checkerを準拠条件または監査の代替にしない

## 判断 / 承認の参照

- 人間による判断: v0.11.4でChecker不具合として修正する
- 変更分類: `clarification`
- 移行要否: なし
- 作業ブランチ: `codex/v0.11.4-gitlink-detection`

## 変更内容

親リポジトリとサブモジュールを次の順で確認する。

1. `.gitmodules`に対象パスが正しいsubmodule節として宣言されている
2. 親Indexの対象パスが通常stage 0のmode `160000`である
3. 親Indexからgitlink OIDを取得できる
4. 対象worktreeが存在する
5. 対象自身のGit rootとGit管理領域へアクセスできる
6. 対象自身のHEADを取得できる
7. HEADとgitlink OIDが一致する

Checkerは次の状態を個別に返す。

```text
declared
gitlink_indexed
gitlink_conflicted
gitlink_oid
worktree_present
gitdir_accessible
head_readable
head_oid
head_matches_gitlink
```

診断は次のように分離する。

| 状態 | 診断 |
|---|---|
| 宣言あり・通常gitlinkなし | `baseline-gitlink-missing` |
| 通常gitlinkあり・宣言なし | `baseline-submodule-declaration-missing` |
| 通常gitlinkあり・worktreeなし | `baseline-submodule-not-initialized` |
| Index競合、Index／Git管理領域／HEADの確認不能 | `baseline-submodule-unverified` |
| HEADとgitlink OIDが不一致 | `baseline-submodule-revision-mismatch` |
| すべて成立 | 検証済み |

一般のgitlinkまたはIndex取得不能時の宣言済みsubmoduleは未確認境界として扱う。親リポジトリの破損リンクと断定せず、初期化後にそのsubmodule rootから直接確認する。

## 変更影響の伝播確認

- 規範変更: なし。Checkerは任意の決定論的確認であり、CRDD規則を変更しない
- 維持する基準: 基準版採用、基本フォルダ、安定コンテキストID、準拠、監査のツール非依存
- 正本文書: 意味変更はなく、公開版ヘッダーだけをv0.11.4へ揃える
- 文書監査: 版、リンク、変更トレース、用語、公開差分を確認するため適用
- 不足／影響監査: 採用先、一般gitlink、fallback、JSON利用者への影響を確認するため適用
- 準拠監査: 準拠基準を変更しないことの限定確認として適用
- 工程移行レビュー: プロダクト工程の移行ではないため非適用
- 品質保証成果物レビュー: プロダクトの検証義務・品質状態を変更しないため非適用

## 実装の参照

- 判定実装（当時）: `template/tools/crdd_check.ts`。現在の配布正本は[`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)
- 回帰試験（当時）: `tools/crdd_check.test.ts`。現在の移設先は[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- 異常注入（当時）: `tools/crdd_check_fault_injector.ts`。現在の移設先は[`40_Develop/checker/fault-injector.ts`](../../../40_Develop/checker/fault-injector.ts)

## 検証

- 回帰試験: 100件すべて合格
- Checker本体: 行・分岐ともに100%
- CRDD全体確認: Error 0／Warning 0
- 実環境確認: `qual-suite`の親gitlink OIDと`00_CRDD` HEADが一致し、正常なサブモジュールとして判定
- 独立コードレビュー: 初回指摘と再確認指摘を是正し、最終固定版で`Pass`
- 文書監査: 初回指摘を是正し、最終固定版で`Pass`
- 不足／影響監査・準拠影響確認: 初回指摘と再確認指摘を是正し、最終固定版で`Pass`

回帰対象:

- 正常な実サブモジュール
- 宣言のみ、gitlinkのみ、worktreeなし、通常ディレクトリ
- 引用符付き`.gitmodules` pathとsubmodule節外のpath
- `.gitmodules`のコメント、引用値の連結、不正な設定出力
- `.gitmodules`の読取不能
- Windowsの大文字・小文字が異なる同一パス
- 親Index mode確認不能、gitlink競合
- Git root／Git管理領域／HEAD確認不能
- HEADとgitlink OIDの不一致
- Gitを利用できないfallback
- 一般gitlink配下へのリンク、範囲指定、参照マップ

## 実際の影響 / 逸脱

- 規範、成果物構造、ID、準拠表明、プロダクト実装への影響はない
- CheckerのJSON状態と診断コードを直接読む自動化だけ、条件付きで対応確認が必要
- 想定範囲からの逸脱はない

## 正本コンテキストの更新

- Checker実装と試験をv0.11.4へ更新
- READMEの公開版表示をv0.11.4へ更新
- CHANGELOGへv0.11.3からの純粋差分と採用影響を追加
- 24正本文書の公開版ヘッダーをv0.11.4へ更新し、規範本文は変更しない

## 既知制限 / 残存リスク

- Git metadataを読めない環境では推測せず`unverified`とする
- サブモジュール内部の文書、実装、意味、準拠は、そのsubmodule rootで別途確認する
- HEADとgitlink OIDの一致は確認するが、未コミット変更の有無は確認しない

## リリース

- 対象バージョン: `v0.11.4`
- 収録リリース: `v0.11.4`
- 処置: `Released`
- 統合: [PR #4](https://github.com/qual-lab/CRDD/pull/4)
- 公開識別子: `v0.11.4`タグ

## 後続対応 / ロードマップ

- 現時点で別のロードマップ項目はない
- 独立レビュー、監査、mainへの統合、リリース処置を完了した

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
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000005/change.md`](<../../../99_Roadmap/Changes/CHG-000005/change.md>)
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
- `tools/coordinator/src/security/host-recovery-record.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-runtime-state.ts`（削除または旧Path）
- `tools/coordinator/src/security/plain-data-snapshot.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-enrollment-binding.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-signature-primitives.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout-internal.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
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
- `tools/crdd_check_fault_injector.cjs`（削除または旧Path）
- `tools/crdd_check_fault_injector.ts`（削除または旧Path）
- `tools/crdd_check.test.mjs`（削除または旧Path）
- `tools/crdd_check.test.ts`（削除または旧Path）
- `tools/crdd_check.ts`（削除または旧Path）
- `tools/tsconfig.checker.json`（削除または旧Path）

</details>
