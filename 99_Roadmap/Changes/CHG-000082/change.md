# CROS WorkbenchのProduction実装

変更ID: `CHG-000082`
状態（Status）: `In Progress`
担当責任者: Qual-Lab
最終更新日: 2026-10-06

## 現在状態

| 項目 | 記載内容 |
|---|---|
| 現在の変更状態 | Phase 5のProduction Closureを進行中。画面・共有Server・Topic／Meeting・Version ControlとAIのProduction接続は既存Evidenceに保持する。署名Runtime `45254e2b`と独立レビュー済みTool `1b756ac2`による公開MCP実Provider E2EはRun `2e55c8cd2897464b`で合格した。正常二経路、取消、親Process喪失後のexact Recovery、再入場時の人間採用判断待ちおよび最終在庫清掃を観測した。Observer接続是正の静的検査と局所158／158も合格した。この合格をWorkbench実Provider経路、Quality移管母集団および未観測の検証義務全体またはRelease可能状態へ拡張しない |
| 対象改訂版 | `v0.22.0` |
| 保存方式刷新② | 完了。実装、受付世代接続、終了整理、本番v2保存Port、Repository切替、現署名・production初期化、全回帰結果の処置とArchitecture／Quality最終独立レビューを完了し、コミット・プッシュ済み。全品質項目・全製品E2Eの成立とは分離する。[完了判定](Evidence/261005_project-runtime-phase2.md#36-②の完了判定) |
| 保存方式刷新③ | Execution IntelligenceのJSONL化、安全診断・実績割当・一般Operation、30日既定のTool別設定と新形式切替を完了。独立再レビュー二観点Pass、必須是正0件。移行済み旧領域は人間指示により清掃済み、未解決10件は新履歴で保護。追加指定の既知閉包6指摘も反証・直接回帰・独立再レビューで解消した。署名E2Eは未完了のまま維持する。[③の完了判定](Evidence/261006_execution-intelligence-phase3.md#③の完了判定--2026-10-06)、[追加是正の判定](Evidence/261006_execution-intelligence-phase3.md#検証と完了判定) |
| 成立済み | G1〜G5のScreen Architecture、Direction A、5画面のSecondary展開、Production Shell、公式ロゴ、Project Context共通Reader、Topic／Meeting Record ReaderとRepository CRUD Core、共通Applicationの検索・絞込み・安定並び順・Query拘束Cursor、WorkbenchのTopic／Meeting独立Detail、Workbench／Repository単体MCPのTopic／Meeting CRUDと同一Repository内Meeting Outcome処置、Remote CROSのCredential／Workspace／Exposure／Repository Revision再検証付きTopic／Meeting Routing、同じSessionとExposure Snapshotに限定したRepository間Owner Relation解決、Workbenchの許可済みPortfolio Source明示選択・Remote Topic／Meeting MCP読書き・Owner Repository付きRelation遷移・Local fallback禁止、許可済みPortfolio Federation、Repository mode／CROS federation表示、Project Portfolioの検索・状態絞込み・20件単位Query拘束継続読込・Source別五場面Detail・欠測保持、作業ツリー読取り、選択Stage／Unstage／Commit／確認済み通常Push、拒否・通信断・結果不明・再観測、Role別Credential Core、Token非保存、永続Registry、Workbench Credential管理Surface、Bearer Remote Transport、Workbench Remote接続／更新／切断、Project Runtime状態Toolの非曖昧化、CROS CredentialによるRemote Project Context MCP、Host限定Access Recovery、AI Profileの閉じた共通Schema・一意解決・四軸Availability・Owner別耐久Snapshot・改訂競合付き採用Core・Repository／CROS WorkbenchのProfile限定管理・`systemAdmin`以外へのCatalog非開示・Coordinator／Workbench Consumer接続、Workbenchの現在Session限定AI依頼Port、読取り助言／変更候補の明示、開始／観測／取消、事実／共有済み分析／追加推論／次の選択肢の分離表示、Coordinatorの依頼種別別Mode Router・現在Process内観測・取消・未知状態非推測、読取り助言の利用者依頼・Profile・内容Hash付き許可済み投影をEffect 0で固定する専用Task Packet、許可参照へ拘束した専用Result Parser、Workbench選択Profile IDのCoordinator Task Request→Route Candidate→Executor Selection Grantへのexact搬送とReviewerへの非伝播、Runtime ActivityのRepository実構成、Execution Intelligence EventのProject限定継続読込、Remote CROSのCredential／Exposure再検証付きActivity投影、未接続／absent／unknown／observedの分離表示 |
| 未成立 | Workbenchの読取り助言／変更候補の実Codex／Claude検証、必要な四経路E2E、残るQuality義務の個別処置、および最新Treeの最終配布固定・署名・照合。公開MCP E2Eと最終回復在庫確認は今回成立済みであり、旧失敗結果は履歴Evidenceとして保持する。画面Visual成立、公開MCP成立および局所試験からWorkbench全体の実境界成立を推定しない |
| Phase／Gate適用判断 | `Applicable`: 画面Shell、読取り投影、書込みEffect、Remote接続を分けて成立確認する必要がある |
| 現在Phase | `Phase 5 — Production Closure` |
| 現在Gate | `Passed: Phase 4`: User Accountを追加せず、Role Credentialから許可範囲だけのSessionを作り、Repository単体／Remote CROS、Repository／CROS Profile Ownerおよび非管理者へのCatalog非開示を分離した |
| 次のGate | 人間の最新指定により、是正前に全E2Eの結果を収集する。最新の両助言は成功したが、送信確認の時間切れ、Project RuntimeのProvider開始前停止と未実行経路が残る。残りの実行と結果保存→根本原因ごとの是正計画→必要な是正・再検証→残るQuality義務の個別処置→最終候補の回帰・独立確認→配布固定・再署名・最終照合→人間の採用・Release判断へ進む。旧三件を削除せず、未成立の回復機能や品質義務を免除しない。[全体確認の途中結果](Evidence/261004_all-e2e-collection.md) |

共有管理フォルダのACL移行を前提に復旧設計を広げる案は取り下げ、現在の承認質問にしない。2026-10-04の人間の確認により、まずE2Eを実行し、再現性のある問題だけ対応を検討する。実アクセス権変更・共有環境の初期化・Process停止・旧三件削除は行っていない。以前の局所設計・実装・試験は履歴として保持し、回復全体の成立またはRelease可能とは扱わない。[再開方針と確認結果](Evidence/261004_workbench-e2e-restart.md)を現在の案内とする。

## 契機 / 起点

| 項目 | 記載内容 |
|---|---|
| 種別 | v0.22 Product Capability実装 |
| 情報源 | Workbench Discovery、REQ-000040、UI／SPEC Detail Pilot、CHG-000081 |
| 理由 | 人間・AI・MCPが同じProject Contextを利用できる状態に加え、人間がProject、Topic、Meeting、Repository作業へ進む軽量な入口をProductionとして成立させる |
| 起点となる探索（EXP） | [EXP-000029](../../../01_Discovery/Analysis/EXP-000029/exploration.md)、[EXP-000030](../../../01_Discovery/Analysis/EXP-000030/exploration.md) |
| 対象要求（REQ） | [REQ-000040](../../../01_Discovery/Definitions/REQ-000040/requirement.md) |
| 不具合／監査是正の場合の逸脱契約 | N/A: 新Capabilityの実装である |
| ロードマップ参照 | [v0.22 CROS Workbenchの最小実装](../../01_Roadmap.md#12-v0220--project運営複数repository) |
| 情報源コンテキストの改訂版 | CHG-000081 Phase 6 Passed時点 |
| 人間による着手判断の参照 | 本対話でv0.22 Discovery、Direction A、公式ロゴ利用および実装継続を確認済み |

## 主な変更意図

Workbenchを、独自の正本やAuthorityを持たない薄い利用面として実装する。Production形態はTypeScriptのNode localhost ServerとReact Browser UIとし、ViteはBrowser BundleのBuildだけを所有する。同じ画面契約を将来のRemote CROSでも再利用できるようにし、Next.js等のFull-stack FrameworkやElectron等のDesktop包装は現在の成立条件へ含めない。

左上のブランド表示には、[CRDD公式ロゴ](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg)を使用する。文字、仮図形、絵文字または類似アイコンで代替しない。

## 現在状態と構造変更

### 現在の検証と次のWorkbench見直しの順序

人間は、まず現状の設計・実装で必要な局所試験、署名付きE2E、全回帰および独立レビューを完了し、結果と残課題を示して一区切りつける方針を確認した。その後にWorkbenchのUX／IAを再検討する。現状の試験が通ることを、表示スペースと作業導線の十分性の証明とは扱わない。

後続の見直し対象は、表示スペースの役割・情報量・優先順位、表示情報と人間の作業の対応、一覧・詳細・比較・編集の遷移、およびAI相談から人間判断・操作への導線である。現在の検証候補へ未分析のUX変更を混在させず、検証結果の提示後に人間との認識合わせから開始する。見直しの採用内容またはRelease可否をこの順序の確認だけから確定しない。

| 項目 | 変更前 | 変更後 |
|---|---|---|
| Workbench実体 | Visual FixtureとCanonical UI／SPEC Detailだけが存在する | `40_Develop/workbench`がProduction Web Surfaceを所有する |
| Application意味 | CROS、Project Operation、Version Control等に分散した公開契約がある | Workbench Adapterが既存公開契約を利用し、意味やAuthorityを作らない |
| 実行面 | FrameworkとProcess配置が未決 | localhost限定のNode Server＋React Browser UIとし、ViteはBrowser Buildに限定する |
| Branding | Visual Fixtureが公式ロゴを参照する | Production Shellも同じ公式Asset Identityを使用する |
| Desktop包装 | 未定 | 対象外。OS統合上の必要性が実証された場合に別判断する |

詳細設計は[Workbench Architecture](../../../06_Architecture/Details/workbench/01_Architecture.md)を正本とする。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`99_Roadmap/Changes/CHG-000082/change.md`](./change.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md`](./Evidence/261002_host-orphan-recovery-design.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_quality-item-reconciliation.md`](./Evidence/261002_quality-item-reconciliation.md)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_native-test-cleanup-preflight.md`](./Evidence/261002_native-test-cleanup-preflight.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_quality-visual-preview-projection.md`](./Evidence/261002_quality-visual-preview-projection.md)
- [`40_Develop/coordinator/src/security/host-orphan-recovery-policy.ts`](../../../40_Develop/coordinator/src/security/host-orphan-recovery-policy.ts)
- [`40_Develop/coordinator/src/security/host-terminal-record.ts`](../../../40_Develop/coordinator/src/security/host-terminal-record.ts)
- [`40_Develop/coordinator/src/security/host-terminal-caller-lease.ts`](../../../40_Develop/coordinator/src/security/host-terminal-caller-lease.ts)
- [`40_Develop/coordinator/src/security/host-terminal-caller-checkpoint.ts`](../../../40_Develop/coordinator/src/security/host-terminal-caller-checkpoint.ts)
- [`40_Develop/coordinator/src/security/host-terminal-windows-adapter.ts`](../../../40_Develop/coordinator/src/security/host-terminal-windows-adapter.ts)
- [`40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts)
- [`40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts`](../../../40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts)
- [`40_Develop/platform-access/src/terminal_protocol.rs`](../../../40_Develop/platform-access/src/terminal_protocol.rs)
- [`40_Develop/platform-access/src/windows_terminal.rs`](../../../40_Develop/platform-access/src/windows_terminal.rs)
- [`40_Develop/platform-access/src/windows.rs`](../../../40_Develop/platform-access/src/windows.rs)
- [`40_Develop/platform-access/src/main.rs`](../../../40_Develop/platform-access/src/main.rs)
- [`40_Develop/platform-access/tests/cli.rs`](../../../40_Develop/platform-access/tests/cli.rs)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](../../../40_Develop/coordinator/src/security/docker-isolation.ts)
- [`40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts)
- [`40_Develop/coordinator/tsconfig.strict.json`](../../../40_Develop/coordinator/tsconfig.strict.json)
- [`07_Quality/Definitions/QA-000003/quality_definition.md`](../../../07_Quality/Definitions/QA-000003/quality_definition.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md`](./Evidence/260930-1853_codex-model-host-migration-preflight.md)
- [`40_Develop/coordinator/runtime/codex-advice-builder.Dockerfile`](../../../40_Develop/coordinator/runtime/codex-advice-builder.Dockerfile)
- [`40_Develop/coordinator/runtime/codex-advice-startup-test.patch`](../../../40_Develop/coordinator/runtime/codex-advice-startup-test.patch)
- [`40_Develop/coordinator/runtime/codex-advice-startup-test-inputs.sha256`](../../../40_Develop/coordinator/runtime/codex-advice-startup-test-inputs.sha256)
- [`40_Develop/coordinator/scripts/prepare-codex-advice-build.ts`](../../../40_Develop/coordinator/scripts/prepare-codex-advice-build.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1305_phase5-workbench-selection-binding.md`](./Evidence/260929-1305_phase5-workbench-selection-binding.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1428_phase5-production-selection-contract.md`](./Evidence/260929-1428_phase5-production-selection-contract.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md`](./Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`06_Architecture/07_Detail_Architecture_Map.md`](../../../06_Architecture/07_Detail_Architecture_Map.md)
- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`06_Architecture/Details/workbench/01_Architecture.md`](../../../06_Architecture/Details/workbench/01_Architecture.md)
- [`06_Architecture/Details/visual-preview/01_Architecture.md`](../../../06_Architecture/Details/visual-preview/01_Architecture.md)
- [`06_Architecture/Details/ai-runtime/01_Architecture.md`](../../../06_Architecture/Details/ai-runtime/01_Architecture.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`06_Architecture/Definitions/ARCH-000010/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md)
- [`06_Architecture/Details/mcp/01_Architecture.md`](../../../06_Architecture/Details/mcp/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](../../../06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`04_UI/04_Visual_and_Accessibility_Direction.md`](../../../04_UI/04_Visual_and_Accessibility_Direction.md)
- [`04_UI/06_Current_Interface_Reference.md`](../../../04_UI/06_Current_Interface_Reference.md)
- [`05_SPEC/07_Current_Behavior_Reference.md`](../../../05_SPEC/07_Current_Behavior_Reference.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](../../../07_Quality/Definitions/QA-000001/quality_definition.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](../../../07_Quality/Analysis/REQ/quality_analysis.md)
- [`07_Quality/Analysis/UX/quality_analysis.md`](../../../07_Quality/Analysis/UX/quality_analysis.md)
- [`07_Quality/Analysis/UI/quality_analysis.md`](../../../07_Quality/Analysis/UI/quality_analysis.md)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](../../../07_Quality/Analysis/SPEC/quality_analysis.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](../../../40_Develop/verification-runner/src/catalog/test-catalog.ts)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/ai-runtime`](../../../40_Develop/ai-runtime)
- [`40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts`](../../../40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts)
- [`40_Develop/coordinator/src/security/provider-model-profile-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-model-profile-runtime.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts)
- [`40_Develop/coordinator/scripts/check-runtime-capability-graph.ts`](../../../40_Develop/coordinator/scripts/check-runtime-capability-graph.ts)
- [`40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-execution-plan.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-execution-plan.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-command.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-provider-command.ts)
- [`40_Develop/coordinator/src/security/codex-advice-distribution.ts`](../../../40_Develop/coordinator/src/security/codex-advice-distribution.ts)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts)
- [`40_Develop/coordinator/src/security/docker-container-init-observation.ts`](../../../40_Develop/coordinator/src/security/docker-container-init-observation.ts)
- [`40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json`](../../../40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json)
- [`40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-output.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-provider-output.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-executor.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-provider-executor.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-runtime-packet.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-runtime-packet.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-production-runtime.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-advice-production-runtime.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/workbench-ai-profile-catalog-flow.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-command.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-command.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-output.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-output.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-provider-adapter.ts`](../../../40_Develop/coordinator/src/security/workbench-ai-provider-adapter.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts)
- [`40_Develop/workbench/package.json`](../../../40_Develop/workbench/package.json)
- [`40_Develop/workbench/package-lock.json`](../../../40_Develop/workbench/package-lock.json)
- [`40_Develop/workbench/tsconfig.json`](../../../40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/vite.config.ts`](../../../40_Develop/workbench/vite.config.ts)
- [`40_Develop/workbench/symbol.json`](../../../40_Develop/workbench/symbol.json)
- `40_Develop/workbench/client/entry-client.ts`（削除）
- [`40_Develop/workbench/client/entry-client.tsx`](../../../40_Develop/workbench/client/entry-client.tsx)
- [`40_Develop/workbench/client/workbench-app.tsx`](../../../40_Develop/workbench/client/workbench-app.tsx)
- [`40_Develop/workbench/client/workbench-ai-request-panel.tsx`](../../../40_Develop/workbench/client/workbench-ai-request-panel.tsx)
- [`40_Develop/workbench/client/workbench-projection-panels.tsx`](../../../40_Develop/workbench/client/workbench-projection-panels.tsx)
- [`40_Develop/workbench/src/presentation/workbench-client-model.ts`](../../../40_Develop/workbench/src/presentation/workbench-client-model.ts)
- [`40_Develop/workbench/src/presentation/workbench-components.ts`](../../../40_Develop/workbench/src/presentation/workbench-components.ts)
- [`40_Develop/workbench/bin/workbench.ts`](../../../40_Develop/workbench/bin/workbench.ts)
- [`40_Develop/workbench/src/index.ts`](../../../40_Develop/workbench/src/index.ts)
- [`40_Develop/workbench/src/ai-profile-surface.ts`](../../../40_Develop/workbench/src/ai-profile-surface.ts)
- [`40_Develop/workbench/src/ai-request.ts`](../../../40_Develop/workbench/src/ai-request.ts)
- [`40_Develop/workbench/src/credential-administration.ts`](../../../40_Develop/workbench/src/credential-administration.ts)
- [`40_Develop/workbench/src/project-plan-surface.ts`](../../../40_Develop/workbench/src/project-plan-surface.ts)
- [`40_Develop/workbench/src/project-surface.ts`](../../../40_Develop/workbench/src/project-surface.ts)
- [`40_Develop/workbench/src/quality-surface.ts`](../../../40_Develop/workbench/src/quality-surface.ts)
- `template/tools/coordinator/coordinator-package-manifest.json`（削除）
- [`40_Develop/workbench/src/remote-topic-meeting.ts`](../../../40_Develop/workbench/src/remote-topic-meeting.ts)
- [`40_Develop/workbench/src/runtime-activity.ts`](../../../40_Develop/workbench/src/runtime-activity.ts)
- [`40_Develop/workbench/src/owner-artifact-surface.ts`](../../../40_Develop/workbench/src/owner-artifact-surface.ts)
- [`40_Develop/workbench/src/workbench-server.ts`](../../../40_Develop/workbench/src/workbench-server.ts)
- [`40_Develop/workbench/scripts/workbench-ai-verification-http.ts`](../../../40_Develop/workbench/scripts/workbench-ai-verification-http.ts)
- [`40_Develop/workbench/tsconfig.json`](../../../40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/src/presentation/workbench-shell.ts`](../../../40_Develop/workbench/src/presentation/workbench-shell.ts)
- [`40_Develop/workbench/tests/integration/project-surface.contract.test.ts`](../../../40_Develop/workbench/tests/integration/project-surface.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-server.contract.test.ts`](../../../40_Develop/workbench/tests/integration/workbench-server.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts`](../../../40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts)
- [`40_Develop/workbench/dist/client/assets/workbench-client.js`](../../../40_Develop/workbench/dist/client/assets/workbench-client.js)
- [`40_Develop/workbench/tests/system/workbench-visual.integration.test.ts`](../../../40_Develop/workbench/tests/system/workbench-visual.integration.test.ts)
- [`40_Develop/visual-preview/src/browser-zoom-verifier.ts`](../../../40_Develop/visual-preview/src/browser-zoom-verifier.ts)
- [`40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts`](../../../40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md`](./Evidence/260928-1745_phase5-workbench-pure-csr.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260928-2354_phase5-pure-csr-runtime-closure.md`](./Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-0025_phase5-signed-csr-distribution-closure.md`](./Evidence/260929-0025_phase5-signed-csr-distribution-closure.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1123_phase5-mount-grant-fresh-observation.md`](./Evidence/260929-1123_phase5-mount-grant-fresh-observation.md)
- [`.gitignore`](../../../.gitignore)
- [`40_Develop/cros/src/project-federation.ts`](../../../40_Develop/cros/src/project-federation.ts)
- [`40_Develop/cros/src/connection-credential.ts`](../../../40_Develop/cros/src/connection-credential.ts)
- [`40_Develop/cros/src/credential-access-recovery.ts`](../../../40_Develop/cros/src/credential-access-recovery.ts)
- [`40_Develop/cros/src/credential-access-recovery-file-adapter.ts`](../../../40_Develop/cros/src/credential-access-recovery-file-adapter.ts)
- [`40_Develop/cros/src/credential-access-recovery-cli.ts`](../../../40_Develop/cros/src/credential-access-recovery-cli.ts)
- [`40_Develop/cros/bin/cros-access-recovery.ts`](../../../40_Develop/cros/bin/cros-access-recovery.ts)
- [`40_Develop/cros/src/remote-transport.ts`](../../../40_Develop/cros/src/remote-transport.ts)
- [`40_Develop/cros/src/runtime.ts`](../../../40_Develop/cros/src/runtime.ts)
- [`40_Develop/cros/src/index.ts`](../../../40_Develop/cros/src/index.ts)
- [`40_Develop/cros/tests/integration/connection-credential.contract.test.ts`](../../../40_Develop/cros/tests/integration/connection-credential.contract.test.ts)
- [`40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts`](../../../40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts)
- [`40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts`](../../../40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts)
- [`40_Develop/cros/tests/integration/project-federation.contract.test.ts`](../../../40_Develop/cros/tests/integration/project-federation.contract.test.ts)
- [`40_Develop/cros/tests/integration/remote-transport.contract.test.ts`](../../../40_Develop/cros/tests/integration/remote-transport.contract.test.ts)
- [`40_Develop/cros/tests/system/session-access.contract.test.ts`](../../../40_Develop/cros/tests/system/session-access.contract.test.ts)
- [`40_Develop/cros/symbol.json`](../../../40_Develop/cros/symbol.json)
- [`40_Develop/mcp/src/protocol/project-runtime-protocol.ts`](../../../40_Develop/mcp/src/protocol/project-runtime-protocol.ts)
- [`40_Develop/mcp/src/protocol/project-context-protocol.ts`](../../../40_Develop/mcp/src/protocol/project-context-protocol.ts)
- [`40_Develop/mcp/src/protocol/topic-meeting-protocol.ts`](../../../40_Develop/mcp/src/protocol/topic-meeting-protocol.ts)
- [`40_Develop/mcp/src/adapters/application-adapter.ts`](../../../40_Develop/mcp/src/adapters/application-adapter.ts)
- [`40_Develop/mcp/src/adapters/project-context-adapter.ts`](../../../40_Develop/mcp/src/adapters/project-context-adapter.ts)
- [`40_Develop/mcp/src/adapters/topic-meeting-adapter.ts`](../../../40_Develop/mcp/src/adapters/topic-meeting-adapter.ts)
- [`40_Develop/mcp/src/composition/cros-project-context-application.ts`](../../../40_Develop/mcp/src/composition/cros-project-context-application.ts)
- [`40_Develop/mcp/src/transports/request-handler.ts`](../../../40_Develop/mcp/src/transports/request-handler.ts)
- [`40_Develop/mcp/src/transports/stdio-transport.ts`](../../../40_Develop/mcp/src/transports/stdio-transport.ts)
- [`40_Develop/mcp/src/transports/streamable-http-transport.ts`](../../../40_Develop/mcp/src/transports/streamable-http-transport.ts)
- [`40_Develop/mcp/src/index.ts`](../../../40_Develop/mcp/src/index.ts)
- [`40_Develop/mcp/symbol.json`](../../../40_Develop/mcp/symbol.json)
- [`40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts`](../../../40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts)
- [`40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts`](../../../40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts)
- [`40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts`](../../../40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts)
- [`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`](../../../40_Develop/mcp/tests/system/stdio-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts`](../../../40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts`](../../../40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts)
- [`template/tools/crdd-mcp.ts`](../../../template/tools/crdd-mcp.ts)
- [`40_Develop/project-operation/src/index.ts`](../../../40_Develop/project-operation/src/index.ts)
- [`40_Develop/project-operation/src/repository-project-context.ts`](../../../40_Develop/project-operation/src/repository-project-context.ts)
- [`40_Develop/project-operation/src/topic-meeting.ts`](../../../40_Develop/project-operation/src/topic-meeting.ts)
- [`40_Develop/project-operation/src/topic-meeting-repository.ts`](../../../40_Develop/project-operation/src/topic-meeting-repository.ts)
- [`40_Develop/project-operation/src/topic-meeting-application.ts`](../../../40_Develop/project-operation/src/topic-meeting-application.ts)
- [`40_Develop/project-operation/symbol.json`](../../../40_Develop/project-operation/symbol.json)
- [`40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts)
- [`40_Develop/version-control/src/change-publication.ts`](../../../40_Develop/version-control/src/change-publication.ts)
- [`40_Develop/version-control/src/git/change-publication-adapter.ts`](../../../40_Develop/version-control/src/git/change-publication-adapter.ts)
- [`40_Develop/version-control/src/index.ts`](../../../40_Develop/version-control/src/index.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/version-control/tests/integration/change-publication.integration.test.ts`](../../../40_Develop/version-control/tests/integration/change-publication.integration.test.ts)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts)
- [`template/22_Topics/_Template/topic.md`](../../../template/22_Topics/_Template/topic.md)
- [`template/23_Meetings/_Template/meeting.md`](../../../template/23_Meetings/_Template/meeting.md)
- [`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)
- [`Evidence/260927-1733_phase1-production-shell.md`](./Evidence/260927-1733_phase1-production-shell.md)
- [`Evidence/260927-1748_phase2-project-context-reader.md`](./Evidence/260927-1748_phase2-project-context-reader.md)
- [`Evidence/260927-1759_topic-meeting-record-contract.md`](./Evidence/260927-1759_topic-meeting-record-contract.md)
- [`Evidence/260927-1812_phase2-read-only-project-surface.md`](./Evidence/260927-1812_phase2-read-only-project-surface.md)
- [`Evidence/260927-1836_phase3-change-publication-it.md`](./Evidence/260927-1836_phase3-change-publication-it.md)
- [`Evidence/260927-1845_phase3-repository-work.md`](./Evidence/260927-1845_phase3-repository-work.md)
- [`Evidence/260927-1921_phase4-credential-administration.md`](./Evidence/260927-1921_phase4-credential-administration.md)
- [`Evidence/260927-1939_phase4-remote-transport.md`](./Evidence/260927-1939_phase4-remote-transport.md)
- [`Evidence/260927-1945_phase4-workbench-remote-connection.md`](./Evidence/260927-1945_phase4-workbench-remote-connection.md)
- [`Evidence/260927-1954_phase4-workbench-connection-surface.md`](./Evidence/260927-1954_phase4-workbench-connection-surface.md)
- [`Evidence/260927-1959_mcp-runtime-state-tool-name.md`](./Evidence/260927-1959_mcp-runtime-state-tool-name.md)
- [`Evidence/260927-2014_phase4-project-context-mcp.md`](./Evidence/260927-2014_phase4-project-context-mcp.md)
- [`Evidence/260927-2022_phase4-test-catalog-closure.md`](./Evidence/260927-2022_phase4-test-catalog-closure.md)
- [`Evidence/260927-2029_phase4-remote-project-context-mcp.md`](./Evidence/260927-2029_phase4-remote-project-context-mcp.md)
- [`Evidence/260927-2037_topic-meeting-repository-crud.md`](./Evidence/260927-2037_topic-meeting-repository-crud.md)
- [`Evidence/260927-2055_topic-meeting-workbench-mcp-crud.md`](./Evidence/260927-2055_topic-meeting-workbench-mcp-crud.md)
- [`Evidence/260927-2120_meeting-outcome-treatment.md`](./Evidence/260927-2120_meeting-outcome-treatment.md)
- [`Evidence/260927-2157_ai-profile-catalog.md`](./Evidence/260927-2157_ai-profile-catalog.md)
- [`Evidence/260927-2257_phase5-screen-reality-audit.md`](./Evidence/260927-2257_phase5-screen-reality-audit.md)
- [`Evidence/260927-2303_phase5-runtime-activity.md`](./Evidence/260927-2303_phase5-runtime-activity.md)
- [`Evidence/260927-2309_phase5-owner-artifact-surface.md`](./Evidence/260927-2309_phase5-owner-artifact-surface.md)
- [`Evidence/260927-2324_phase5-runtime-activity-composition.md`](./Evidence/260927-2324_phase5-runtime-activity-composition.md)

</details>

## 想定する影響

- コンテキスト: Project／Portfolio、Topic／Meeting、Quality、正本Relation、AI依頼、Repository Worktree、接続設定
- 成果物: Workbench Architecture、Quality Analysis／Definition、Production Source、Test、Evidence
- 利用者 / 運用: Developer、Project Operator、PM、Management、Administratorが同じ入口を役割内で利用する
- データ / インターフェース / 移行: 既存CROS／Project Operation／Version Control公開契約を利用し、Workbench専用正本を追加しない
- セキュリティ / プライバシー / コスト: localhost既定、Repository／Session Authorityを再評価せず、非開示情報を推測しない。Desktop Runtime依存は追加しない

## 対象外 / 変更してはならないこと

現在品質の一項目適用、旧集計の不整合と採用Scopeの再照合は[品質投影記録](Evidence/261002_quality-visual-preview-projection.md)を参照する。この記録更新からSource、検証義務、AuthorityまたはRelease Scopeを変更しない。

- 対象外: Electron等のDesktop包装、Force Push、Merge、Rebase、通常Discard、Workbench内会話履歴の正本化、本格Trust Policy管理
- 変更してはならないこと: CROS／Project Operation／Version ControlのAuthority、Project ContextのOwner、非開示Sourceの存在秘匿、CHG-000081で固定したDirection Aと公式ロゴの使用

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 新しい利用者入口、Process、HTTP境界およびRepository Effectを追加する | 各Phase Gateと独立レビュー |
| 変更する契約母集団 | Applicable | Workbench UI／SPEC Detail、関連Architecture、Quality、公開Application Contract | Phase 0／1で固定する |
| 既知の利用側母集団と対象別の予定処置 | Applicable | Local Browser、将来Remote CROS、Repository単体利用 | Screen／入口別のSystem試験で確認する |
| 安全上重要な層間搬送 | Applicable | UI操作から既存Application Contract、Version Control Effectへの搬送 | 書込みPhaseでEffect前後を確認する |
| 保護対象Effect／Recoveryの耐久Authority | Applicable | Commit／Push、Credential管理は既存Authorityだけを使う | Effect実装前に再照合する |
| 残存資源／Recovery／Authority義務を伴う取得transaction | Applicable | HTTP listener、Browser request、Git process、Remote session | Integration／System試験で確認する |
| 発火例／非発火例／境界例／情報不足例 | Applicable | Local／Remote、権限あり／なし、部分観測、結果不明を分ける | Screenごとの契約試験 |
| 定義・発火条件・判定不能・正式結果の分離 | Applicable | loading／empty／partial／restricted／unknown／failedを正常へ畳まない | UI stateとApplication結果の照合 |
| 固定前の実差分照合 | Applicable | Source追加前にArchitecture／Qualityを固定する | 各実装Phase開始前 |
| 根拠の主張軸（入口形態） | Applicable | Repository単体、Local CROS、Remote CROSで可用能力が異なる | Public Surface E2E |
| 根拠の主張軸（観測基盤） | Applicable | DOM、HTTP、Application Contract、Git／Remote境界を分ける | Verification Design |
| 根拠の主張軸（成果物Identity） | Applicable | UI／BHV／ARCH／QA／Source／Test／Evidenceを接続する | Reality Audit |
| 根拠の主張軸（lifecycle） | Applicable | Server開始、要求、Effect、結果、shutdown、資源0を分ける | Host E2E |
| 未解消の不一致 | OPEN | UI／CSR画面、Application Contract、実データ、Production全Profile STおよびShared Server運用境界は接続済み。Project Runtime公開MCPはRun `2e55c8cd2897464b`で通常二経路・取消・exact Recovery・最終回復在庫確認まで合格した。旧取消Oracleおよび終了後Observer接続の不一致は是正・独立確認済みである。Workbench実Provider、必要な四経路、残る個別品質項目および最終配布署名は未完了である | 未完了の実境界と個別品質項目を確認し、最終固定候補の回帰・独立レビュー・再署名後にRelease判断へ渡す |

## 変更経路の計画

- 適用判定: `Applicable`: Architecture Detail、Quality、Development、Reality Auditを順に進める
- 計画した主な工程 / 共通責務: Reality Audit→Architecture Detail→Quality義務→Production Skeleton→読取り面→書込み面→Remote接続→E2E
- 選択理由: Canonical Detailを既存WIPへ合わせず、既存公開契約を利用する最小Surfaceとして実装するため
- 予定する検証: Formatter、型、Lint、単体／結合／System、実Browser visual profile、Repository Checker、独立レビュー
- 判断上重要だが選ばなかった主な経路と理由: Electron先行は包装と配布の責務を増やし、現時点の利用者成果に必要ないため採用しない

## Phase／Gateと途中拡張

### 適用判断

| 評価対象 | 判定 | 理由 |
|---|---|---|
| Phase／Gate | Applicable | 読取りSurfaceとRepository／Credential Effectを同時に完成扱いしないため |

### PhaseとGate

| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |
|---|---|---|---|---|---|
| Phase 0: Reality Audit／Production Boundary | 現行実装、再利用契約、配置、素材、対象外を固定する | CHG、Architecture Detail、Map | Current Reality照合、Repository Checkerの構造・Relation検査 | 第二正本・Authority生成0、利用する公開契約と実行面が一意 | Passed |
| Phase 1: Production Skeleton | localhost ServerとBrowser Shellを成立させる | `40_Develop/workbench` | 静的確認、Server lifecycle、Browser smoke、公式ロゴ読込 | 公開入口からDirection A Shellを表示し、shutdown後資源0 | Passed |
| Phase 2: Read-only Project Surface | Project／Portfolio／Topic／Meeting等を公開契約から表示する | Adapter、View Model、Screens | Contract／System／Accessibility | 欠測・制限・部分成功を保持して主要読取りFlowが成立 | Passed |
| Phase 3: Repository Work | Tree／Diff／Stage／Commit／通常Pushを接続する | Version Control Adapter、確認Flow | Effect前後、失敗、結果不明、回復 | Force Push 0、暗黙再送0、選択差分だけを処置 | Passed |
| Phase 4: Connection／AI Surface | Local／Remote接続、Role別Credential、AI依頼面を接続する | CROS／Runtime Adapter | Authority、Disclosure、Session lifecycle | User管理を追加せず、許可範囲だけで同じ契約を利用 | Passed |
| Phase 5: Production Closure | 15 Screen範囲、Visual、E2E、Reality Auditを閉じる | 全Production Surface | 全回帰、実Browser、独立レビュー | Blocking Finding 0、未観測を明示しRelease判断へ引渡し可能 | In Progress |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| 通常producerの共有管理DirectoryとNativeの固定保護条件が一致しなかった | 同じHost回復責務の局所不一致として調査したが、現Directoryから他利用者の実変更可能性までは実証していない | 当初、保護付き作成と限定ACL移行の設計・実装・試験を追加した。現在は追加拡張を止め、固定E2Eと再現した失敗を優先する | 追加基盤の完成を保存済み署名Runtimeの固定E2E開始の一律前提にしない。旧三件や回復全体の未成立を消去しない | ACL移行案は取り下げ、現在の承認質問にしない。権限変更・共有OS作成・旧三件削除は未実施 | 過去の局所確認と配布128試験を保持し、製品全体の完成へ一般化しない。[現在の方針](Evidence/261004_workbench-e2e-restart.md)、[旧比較](Evidence/261002_host-orphan-recovery-design.md#共有管理フォルダの保護不一致と次の判断--2026-10-04) |
| 既存Host残存一件に、既知の`workspace/fixture.txt`、7bytesが存在した。2026-10-04に人間が限定設計への追加を承認した | 元の回復参照がない同じHost残存を安全に処置する責務の具体的な反例であり、汎用非空清掃の追加ではない | Phase 5の限定Recoveryへ指定file一件を別クラスとして追加。空クラス・現行十一実体Schemaは緩めない | 十二実体・同handle内容／リンク数確認・fileからの非再帰処置・部分再入場を設計、実装、Qualityへ接続する。全体Gateと新実Task停止は維持する | 人間は、この作業の試験以外でCoordinatorを利用していないことと設計対象への追加を回答した。これはProcess終了、非使用、実停止・削除の承認ではない | 専用codec、観測、Native保存／読戻し、Adapter・callerと記録準備をSource接続した。空TEMP／TMPの実所在取得停止をHost専用環境で是正し、30 Host UT／8 caller IT／9 Windows Adapter UTと選択3契約が成功した。読み取り専用実診断は専用保存子Directory欠落で停止した。初期化入口・正常固定OS保存・本番再入場・公開処置は未成立。[現在の結果](Evidence/261002_host-orphan-recovery-design.md#十二実体の記録準備と実環境の保存境界--2026-10-04) |
| 元の回復参照を確定できない空のHost残存が観測され、同じCHGで限定保守経路を追加する人間判断を得た | 実Provider検証後の残存から安全に回復できない、既存Recovery責務の欠落であり、新しい汎用清掃Capabilityではない | Phase 5へ空のhost_onlyに限る対象確認・fresh承認・非使用確認・限定処置・不存在観測を追加 | 新実Task停止を維持する。候補判定、実観測、Authority、実処置、公開入口および全資源観測を分けて閉じる。局所UTをRecovery完成へ読み替えない | 設計・実装・局所反証・独立確認は本対話で承認済み。2026-10-03にCoordinator所有範囲の終了・利用抑止・排他で閉じる方向を確認し、Windows再起動を前提にしない。実在三件の削除、元Token生成、実Process停止、Provider再送、Docker再起動、Releaseは含めない | 第一単位は候補設計とAuthorityを発行しない内部Policy。全利用側と旧形式の閉包、作成前排他、OS処置境界・再入場はOPEN。方式の採否待ちではなく承認範囲内の再設計中。[現在記録](Evidence/261002_host-orphan-recovery-design.md) |
| 署名済み実境界で障害修復Protocolが意図的に返す公式停止の未発行を上位Runtimeが失敗扱いした | Workbench AI実Provider E2Eを成立させるDocker境界のProduction Closureであり、同じIntent内の実境界Gapである | Phase 5へ障害修復の`not_issued`受理契約是正を追加 | Repairでは公式停止を発行せず、上位Runtimeが`false / not_issued`だけを正常分岐として受理する局所契約試験、署名済み修復、Host Windows回帰を追加 | 既存の修復ID・耐久記録・Trust・削除禁止を維持し、`true / unknown`を成功へ補正しない | 対応中 |
| Workbenchの将来展開を踏まえ、表示層をReact＋Viteへ固定する人間判断を得た | Project Context、Topic／Meeting、Repository、AIおよびShared Serverを一つのWorkbenchへ展開する同じProduction Intentであり、別Capabilityではない | Phase 5へVite Browser Build、固定Asset配信および既存15画面のReact移行を追加 | Node側のAuthorityとHTTP操作契約を維持し、CSR、JSON Read Model、CSP、allowlist、既存IT、実Browser Visualを再確認する。全画面Component化前を移行完了と表示しない | React＋Vite採用は本対話で確認済み。Next.js、Electron、業務AuthorityのClient移動は対象外 | 実装・直接検証・独立レビュー済み。Phase 5全体の実Provider E2Eは継続 |
| 段階移行境界やSSRとの二重管理を残さず、既存15画面本体をClient-side React Componentへ移行する人間判断を得た | React＋ViteをWorkbenchのProduction表示基盤として固定する同じIntentの完結条件であり、新しい利用者Capabilityではない | Phase 5へ全画面CSR、JSON Read Model境界、Raw HTML Fragment廃止、SSR／Hydration廃止およびBrowser DOM再読取り廃止を追加 | 既存15画面、Form、Action Token、権限、Server Effect、同一Origin／CSP、3表示Profile×3 Zoomを不変条件として再検証する。旧署名候補は移行前Evidenceとしてのみ保持し、移行後に新しい固定候補を作る | 本対話でスコープ拡大とSSR不採用を確認済み。Clientへの業務Authority移動、Next.js、Electronは引き続き対象外 | 実装・直接検証・独立レビュー済み。Phase 5全体の実Provider E2Eは継続 |
| 純粋CSR移行後の署名候補を直接起動すると、Node実行グラフが旧SurfaceのReact rendererへ到達し、空のAI Profile Storeが返す既定Catalog Revision 0を実行計画が拒否した | 署名配布物と実Provider E2Eを成立させる同じWorkbench Production Closureであり、新しい利用者Capabilityではない | Phase 5へBrowser-only Panel分離、Node依存閉包検査、Revision 0のStore→Composition→Dispatch統合試験およびJSON境界の整数検証を追加 | Server RuntimeからReact value依存を除外し、既定Catalogの初期Revision 0だけをexactに受理する。負数・小数・破損・観測不能は拒否し、最初の採用だけをRevision 1とする | SSR再導入、Node DOM所有、Revisionの暗黙補正は対象外。現行方針のまま是正可能なため追加判断なし | 局所型・Lint・Build、Workbench統合20件、Coordinator局所11件をPass。不連続Revisionと連続Revisionの破損Envelopeは独立反証とし、どちらもEffect前に拒否する。署名候補の直接起動と実Provider E2Eは後続で再固定する |
| 純粋CSR修正後のSource Commitを署名できたが、署名stagingにVite生成済みBrowser Bundleが存在せずWorkbenchを直接起動できなかった | 署名済みWorkbenchを利用者入口から起動する同じProduction Closureであり、CSR Sourceだけの成立を配布成立へ誤認しないため | Phase 5へ固定Browser BundleのGit追跡・署名Tree収載契約を追加 | Vite生成結果を設計正本へ昇格せず、固定Pathの派生AssetをSource Commitへ収載する。Build再実行後も追跡Bundleが一致し、Manifest除外Source Treeから直接起動できることを要求する | Runtime Build、Node側React import、署名後の未追跡Asset追加は対象外。現在方針の完結に必要な一意修正であり追加判断なし | `.gitignore`の包括除外を廃止し、固定Bundleを追跡対象へ追加した。Git追跡集合を検査する`ERB-IT-021`を追加し、Workbench 21／21 Pass。旧署名候補はSource／配布閉包不一致のため流用しない |
| 署名候補の実Provider E2EがMount Grant消費前に`workbench_ai_advice_mount_authorization_unavailable`で停止した | 既存Architectureが要求する一回限り観測Capabilityとfresh再観測を、本番助言Runtimeへ接続する同じProduction Closureである | Phase 5へMount Grant発行後・消費前のProvider Home再観測を追加 | 発行用観測と消費用fresh観測を別Capabilityとして局所反証し、再観測不能ではGrant消費0・Provider Effect 0・Operation cleanup完了を要求する。修正後の署名候補で実Provider E2Eを再実行する | Provider Home契約、Mount Grant TTL、Repository非共有、外部送信許可範囲は変更しない。既存契約へ一意に整合するため追加判断なし | 実装・局所試験・型検査・Coordinator Portable全回帰・独立確認済み。再署名、実Provider E2Eは継続 |
| Mount修正後の署名候補が次のSelection境界で`workbench_ai_advice_selection_unavailable`に停止した | Workbench専用助言Operationが一般Selection Runtimeの必須Repository結合と、Selection Grantを必要とする明示委譲の要求意味を欠いていた。設計済みのMount前／Effect直前二段階Selectionも未接続だった。同じProduction Closure内の接続Gapである | Phase 5へ元Repository Identity結合、Selection再発行Lifecycleおよび明示委譲Selection要求を追加 | 一般SelectionのRepository結合条件と`none`のGrant非発行契約を弱めず、元RepositoryをOperationへ内部結合する。Workbenchの明示Provider／Profile選択を`beneficial`かつ`explicit_user_delegation`として要求する。Mount前の初回SelectionをMount後に失効し、同じ入力による再SelectionのProvider、Profile、Model、推論強度、速度および理由が完全一致する場合だけEffectへ進む。発行済みSelectionは意味検証前からcleanup対象として保持し、旧Selection失効失敗と不正な再SelectionをAuthority残存不明へ閉じる。Production接続を局所反証し、修正後署名候補でE2Eを再実行する | Repository／WorkspaceのProvider Mount、Path搬送、任意読取りAuthority、Selection TTL、`none`経路および外部送信許可範囲は変更しない。既存Architectureへ一意に整合するため追加判断なし | Production Selection対象35／35、型・Lint・Capability Graph／Traceability、Workbench 21／21、Portable 2,117件中2,112 Pass／5 Explicit Skip／0 Fail。是正後候補の独立確認、再署名、実Provider E2Eは継続 |
| Repository結合・二段階Selection修正後の署名候補も初回Selectionで`workbench_ai_advice_selection_unavailable`に停止した | WorkbenchがProduction Selection契約へ渡す要求意味の接続Gapであり、同じ助言Production Closureの継続である | Phase 5へWorkbench Selection要求契約とProduction直接結合試験を追加 | Selection Grantを必要とする明示AI実行を`none`へ畳まず、`beneficial`／`explicit_user_delegation`、明示Provider／Profile、Coordinator役割、Operation chainを含む閉じた要求Objectを渡す。Mock fixtureで余分なPropertyを含めて完全比較し、Productionが生成した初回・再発行要求を実Selection Runtimeへ渡して旧Grant失効、新Grant消費およびProvider準備までを反証する | `none`のGrant不要契約、Profile選択、Repository非共有、外部送信許可およびProvider Effect Gateは変更しない。既存契約へ一意に整合するため追加判断なし | 局所35／35、型・Lint・Capability Graph／Traceability、Portable 2,117件中2,112 Pass／5 Explicit Skip／0 Fail。是正後独立確認、再署名および実Provider E2Eは継続 |
| 署名実Provider E2Eが17件の不一致で停止した | 実Provider境界を成立させる同じProduction Closureであり、17件は独立した新Capabilityではなく、Provider境界診断の閉集合、正規Candidate Identityの利用側互換、人間受入待ちの期待値という3つの契約ずれから派生していた | Phase 5へLifecycle診断の設定・開始・終了Event分離、Candidate Identity非縮退、`integration_pending`終端のE2E期待を追加 | 既知Lifecycle Eventを違反へ誤分類せず、同じOperationへ相関する。Canonical Candidate IDをIntegration Recordまで完全保持する。Task完了・候補採用をObjective／Milestone受入へ昇格せず、人間の明示受入は別Capabilityに維持する | Docker Desktop内部socket障害との時間的相関は有力仮説として分離し、CRDD原因と断定しない。受入Authority、外部送信範囲、Provider HomeおよびDocker Recovery契約は変更しない | Source、Architecture、Qualityおよび局所契約を是正。局所33／33、Portable 2,120件中2,112 Pass／8 Explicit Skip／0 Fail、Host Windows 93／93、独立確認Finding 0。再署名および実Provider E2Eは継続 |
| 再署名後の実Provider E2Eで正常2経路は成立したが、取消経路に2件の不一致が残った | stdio EOFは親Transport喪失による取消要求であり、取消完了ではない。Productionは終了観測不能を`blocked / unknown`とexact Runtime Process Recovery義務へ閉じたが、検証Oracleだけが即時`cancelled / settled`を要求していた | Phase 5の検証OracleとE2E所有fixture清掃を改訂 | 取消要求、Provider／Process終了、結果、cleanupを分離し、不明時は一意なRecovery義務と最終Inventory cleanを必須にする。E2Eが所有する既知fixture変更だけを開始前内容へ戻す | 公開MCPへ新しい取消Toolを追加せず、Transport喪失、取消要求、取消完了およびRecoveryを混同しない。Productionの保守的な停止契約を弱めない | 静的検査一式、Portable 2,120件中2,112 Pass／8 Explicit Skip／0 Fail、Host Windows 10／10、局所System 30／30、独立確認Finding 0。再署名実Provider E2Eおよび四経路E2Eは継続 |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| N/A: 現時点で途中見直しなし | N/A | N/A | N/A | UI／SPEC Detailと既存公開契約 | N/A |

## 変更影響の伝播確認

- 情報源の改訂版: CHG-000081 Phase 6 Passed
- 監査結果の参照: CHG-000081独立レビューFinding 0
- 上流 / 同層の正本更新: Workbench Architecture Detailを追加した
- 下流影響の再探索: Quality、Development、Test Catalog、Reality AuditをPhase順に更新する
- 再監査の結果: Phase 0固定候補で実施する
- 伝播例外: N/A: 例外なし

## 実装の参照

- [`40_Develop/workbench`](../../../40_Develop/workbench)
- 公開API: `startWorkbench`
- CLI: `node 40_Develop/workbench/bin/workbench.ts`

## 検証

- 検証義務: Workbench Architecture Detailの8導出キーを既存Quality目標へ接続し、Production境界を`ERB-IT-021`、Production DOMを`ERB-ST-022`へ分けた
- 検証設計: localhost直接境界ITと実Browser System／E2Eを分離した
- 結果参照: [Phase 1 Production Shell](./Evidence/260927-1733_phase1-production-shell.md)、[Phase 2 Project Context Reader](./Evidence/260927-1748_phase2-project-context-reader.md)、[Topic／Meeting Record Contract](./Evidence/260927-1759_topic-meeting-record-contract.md)、[Phase 2 Read-only Project Surface](./Evidence/260927-1812_phase2-read-only-project-surface.md)、[Phase 3 Change Publication IT](./Evidence/260927-1836_phase3-change-publication-it.md)、[Phase 3 Repository Work](./Evidence/260927-1845_phase3-repository-work.md)、[Phase 4 Project Context MCP](./Evidence/260927-2014_phase4-project-context-mcp.md)、[Phase 4 試験台帳の閉包確認](./Evidence/260927-2022_phase4-test-catalog-closure.md)、[Phase 4 AI Profile Catalog](./Evidence/260927-2157_ai-profile-catalog.md)、[Phase 4 Workbench AI依頼Port](./Evidence/260927-2210_workbench-ai-request-port.md)、[Phase 5 15画面Reality Audit](./Evidence/260927-2257_phase5-screen-reality-audit.md)、[Phase 5 Runtime Activity](./Evidence/260927-2303_phase5-runtime-activity.md)、[Phase 5 Owner Artifact Surface](./Evidence/260927-2309_phase5-owner-artifact-surface.md)、[Phase 5 Runtime Activity実構成](./Evidence/260927-2324_phase5-runtime-activity-composition.md)、[Phase 5 Project Plan構造化投影](./Evidence/260927-2337_phase5-project-plan-projection.md)、[Phase 5 Quality構造化投影](./Evidence/260927-2350_phase5-quality-projection.md)、[Phase 5 Documentation検索](./Evidence/260927-2352_phase5-documentation-search.md)、[Phase 5 Runtime Activity閉包](./Evidence/260928-0014_phase5-runtime-activity-closure.md)、[Phase 5 Topic／Meeting Collection／Detail](./Evidence/260928-0031_phase5-topic-meeting-collection-detail.md)、[Phase 5 Repository Tree／Diff](./Evidence/260928-0044_phase5-repository-tree-diff.md)、[Phase 5 Topic／Meeting Relation遷移](./Evidence/260928-0053_phase5-topic-meeting-relation-navigation.md)、[Phase 5 Topic→CHG昇格接続](./Evidence/260928-0105_phase5-topic-change-promotion.md)、[Phase 5 Project Portfolio遷移](./Evidence/260928-0115_phase5-project-portfolio-navigation.md)、[Phase 5 AI結果Provenance](./Evidence/260928-0207_phase5-ai-result-provenance.md)、[Phase 5 現在の15画面Reality Audit](./Evidence/260928-0243_phase5-current-screen-reality-audit.md)
- 追加結果参照: [Phase 5 Remote CROS Topic／Meeting Routing](./Evidence/260928-0253_phase5-remote-topic-meeting-routing.md)
- 追加結果参照: [Phase 5 Repository間Owner Relation](./Evidence/260928-0305_phase5-cross-repository-owner-relation.md)
- 追加結果参照: [Phase 5 Remote Workbench Topic／Meeting](./Evidence/260928-0325_phase5-remote-workbench-topic-meeting.md)
- 追加結果参照: [Phase 5 Workbench AI一回送信境界](./Evidence/260928-0415_phase5-workbench-ai-send-boundary.md)
- 追加結果参照: [Phase 5 Workbench Provider Adapter](./Evidence/260928-0425_phase5-workbench-provider-adapter.md)
- 追加結果参照: [Phase 5 署名Runtime閉包と助言Execution Plan](./Evidence/260928-0439_phase5-signed-runtime-closure-and-advice-plan.md)
- 追加結果参照: [Phase 5 Provider Command／Output境界](./Evidence/260928-0500_phase5-provider-command-and-output-boundary.md)
- 追加結果参照: [Phase 5 読取り助言Runtime Packet](./Evidence/260928-0530_phase5-advice-runtime-packet.md)
- 追加結果参照: [Phase 5 `workbench_advice` Docker境界](./Evidence/260928-0600_phase5-workbench-advice-docker-boundary.md)
- 追加結果参照: [Phase 5 読取り助言Production Runtime](./Evidence/260928-0635_phase5-workbench-advice-production-runtime.md)、[Phase 5 Workbench変更候補Production Runtime](./Evidence/260928-0715_phase5-workbench-change-candidate-runtime.md)、[Phase 5 AI二画面の現在Reality Audit](./Evidence/260928-0725_phase5-ai-screen-reality-audit.md)、[Phase 5 AI Runtime Package Closure](./Evidence/260928-0750_phase5-ai-runtime-package-closure.md)、[Phase 5 変更候補の採否境界](./Evidence/260928-0911_phase5-candidate-disposition.md)
- 追加結果参照: [Phase 5 Workbench実Browser Visual Gate](./Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)
- 追加結果参照: [Phase 5 React＋Vite Shell移行](./Evidence/260928-1535_phase5-react-vite-shell-migration.md)（SSR／Hydrationを使用していた移行途中の履歴Evidence。現行表示構造は後続の純粋CSR Evidenceが置き換える）
- 追加結果参照: [Phase 5 Docker Process終了全体期限](./Evidence/260928-1543_phase5-docker-process-termination-budget.md)
- 追加結果参照: [Phase 5 Workbench純粋CSR移行](./Evidence/260928-1745_phase5-workbench-pure-csr.md)
- 追加結果参照: [Phase 5 純粋CSR Runtime閉包検証](./Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)
- 追加結果参照: [Phase 5 署名CSR配布閉包](./Evidence/260929-0025_phase5-signed-csr-distribution-closure.md)
- 追加結果参照: [Phase 5 Mount Grant fresh再観測](./Evidence/260929-1123_phase5-mount-grant-fresh-observation.md)
- 追加結果参照: [Phase 5 Workbench Repository結合とSelection更新](./Evidence/260929-1305_phase5-workbench-selection-binding.md)
- 追加結果参照: [Phase 5 Workbench Production Selection契約](./Evidence/260929-1428_phase5-production-selection-contract.md)
- 追加結果参照: [Phase 5 複数Docker Recoveryの検証付き再起動](./Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md)
- 追加結果参照: [Phase 5 実Provider E2Eの契約整合](./Evidence/260929-2254_phase5-real-provider-contract-alignment.md)
- 追加結果参照: [署名Runtimeの終了後Observer接続是正と公開MCP E2E再実測](./Evidence/260930-1440_signed-runtime-recovery-observer.md)
- 追加結果参照: [Workbench助言の実Provider出力拒否と診断搬送の是正](./Evidence/260930-1621_workbench-advice-result-rejection.md)
- 追加結果参照: [Shared Gatewayの非開示境界と品質適用](./Evidence/261002_shared-gateway-non-disclosure.md)。`RFD-ST-004`だけを新しい実HTTP根拠へ接続し、Host回収・実Provider・全体品質の未成立は維持する
- 追加結果参照: [品質176項目の固定候補照合](./Evidence/261002_quality-item-reconciliation.md)。全項目の候補集合と旧版の観測主張108件の現行適用未照合を追跡する。Profile搬送の局所36試験とWorkbench HTTP一試験を入口別に照合し、公開CLI／MCP Transportから現行Catalog・Task選定への結合不足を分けた。旧二JSONの廃止条件と四経路の画面なし実行の公開入口未対応も現行実体から確認した。現在の品質件数と停止Gateは変更しない。
- 追加結果参照: [Profile選択の現行UTとRole反例の補強](./Evidence/261002_profile-selection-current-ut.md)。局所60件の根拠を記録し、Transport同等性、PRL-UT-014全体、全体品質と実回復の未成立は維持する
- 追加是正参照: [公開ObjectiveのProfile搬送と試験登録](./Evidence/261002_objective-profile-transport.md)。任意Profile入力、MCP SchemaとTask搬送の実装接続漏れ、先行Host候補UTの登録漏れを是正した。局所117件の結果を全入口・実回復・全体品質へ拡張しない
- Quality Center: `RFD-IT-014`と`RFD-ST-015`を、Workbench→Version Control→実Git／bare Remote、実Browser確認、故障分類および再観測のEvidenceとして観測済みにした。`ERB-ST-022`も15画面、Desktop／Tablet／Mobile、100%／200%／400%の27条件、React commit後の画像確定待ち、終了所要時間および終了後不存在Evidenceへ接続した。`ERB-IT-020`は残存子Processへの世代Identity限定Fallback実発行とIdentity不一致時のEffect 0へ接続した

## 実際の影響 / 逸脱

- 実際に通った工程 / 共通責務: Discovery、UX、IA、UI／SPEC、UI／SPEC Detail、Architectureへの伝播
- 計画との差: Desktop包装を追加せず、計画どおりlocalhost ServerとBrowser Shellだけを実装した
- 追加 / 削除した工程・検証と理由: Visual Previewの成立を流用せず、Workbench固有の`ERB-IT-021`と`ERB-ST-022`へ分離した
- 経路不足から生じた指摘事項: 初回Mobile smokeでNavigationが一行横Scrollになったため、320px相当では3列折返しへ是正した
- 最終的に有効だった検証: 固定Route IT、15画面×3表示Profile×3 Zoomの実Browser Visual Gate、Repository Checker
- Production Closureで追加した検証: 署名Runtime配布観測がVersion Controlの5つのGit子Process呼出しを未登録として拒否することを確認し、閉集合登録後にPlatform Provisioner／署名Manifestの局所契約試験143件をPassした
- 署名済みDocker障害修復で、Repair Protocolが公式停止`S`を意図的に発行せず`false / not_issued`を返す一方、上位Runtimeが`true / confirmed`だけを正常としていた実境界不一致を検出した。Repairは`K`、Docker WSL停止およびrun世代退避を所有する既存境界を維持し、上位Runtimeは意図的な未発行だけを受理する。`true / unknown`は引き続き停止し、署名済み再実行、Host Windows回帰および実Provider E2Eが完了するまでPhase 5は閉じない

## 正本コンテキストの更新

- Workbench実装構造: `06_Architecture/Details/workbench/01_Architecture.md`
- UI／Visual: `04_UI/Details/**`
- System Behavior: `05_SPEC/Details/**`
- 実装・試験: `40_Develop/workbench/**`（Phase 1以降）

## リリース

- 対象リリース: `v0.22.0`
- 収録リリース: 未収録
- 処置: 実装・検証・独立レビュー後に人間が判断する

## 既知の制限 / 残るリスク

- localhost Web SurfaceがDesktop固有操作なしで必要な利用体験を満たすかはProduction Dogfoodで確認する。
- 公式ロゴはRepository内の承認済みAssetを使用するが、配布Packageでの単一Ownerと収載方法はPhase 1で固定する。
- WorkbenchのAI依頼Surfaceは選択Profile ID、読取り助言／変更候補、一依頼だけの外部送信確認を明示するApplication Portまで成立した。読取り助言は一般TaskのExecutor／Reviewerへ流用せず、Task Hash、Catalog Revision、exact Profile ID、Providerへ確認を結合して一回だけ消費する専用DispatchをProduction Compositionへ接続した。Effect前取消、Effect後取消競合、Provider例外、cleanup不明および不正結果は自動再送または成功へ畳まない。Provider Adapterはexact ProfileをCodex／Claudeの一方へだけ渡し、専用Execution PlanとProvider Command Planでstdin搬送、Repository／Workspace mountなし、Tool／Sessionなし、API Key／有料fallbackなしを固定する。Executor CoreはCodex JSONLのTool Eventを拒否し、Claude Envelopeから助言JSONだけを抽出して生metadataを公開しない。Executor Coreから署名Runtimeへ渡すOperation、Profile、Task／Projection Hash、PromptおよびCommand Hashは`ADVICEPKT-*`の一回消費Packetへ固定し、別Owner消費、再利用、取消後利用および共有境界拡張を拒否する。Production Runtimeは署名配布物Capability、Operation世代、Provider Home、Selection、Docker回復、Host cleanupおよび最終Recovery確定を所有し、両cleanup完了後だけ助言JSONを返す。修正前署名候補の実Provider E2EはMount Grant fresh再観測Gapで停止し、修正後署名候補では未実施である。
- Coordinatorに現在Process限定Mode Routerを追加し、読取り助言／変更候補を別Executorへ一回だけ配送する契約、取消後の遅延完了保護および未知Identityの非推測を`ERB-UT-023`で確認した。Workbench Production Compositionは読取り助言の専用Dispatch、Provider別固定Adapter、署名済みProduction Runtimeに加え、変更候補の明示許可Path、exact Executor Profileおよび署名済みProject Runtime Single Taskを接続した。候補は未信頼・未採用Identityとして公開し、候補生成とは別の確認・採用・破棄操作を接続した。採用は現在候補との一致、明示確認、Project Runtime Lease、Revision・dirty・Scope再観測、Receiptと耐久記録を必須にし、Commit／Pushへ拡張しない。修正前署名候補の実Provider E2EはMount Grant fresh再観測Gapで停止し、修正後署名候補では未実施である。
- AI結果は四区分の各項目を本文と一件以上の正本参照の組へ変更した。Coordinator Mode RouterはExecutor結果を閉じたSchemaで実行時検証し、専用Advice Result Parserは単一JSONを許可済み読取り投影のexact参照集合へ拘束する。根拠参照なし、投影外参照、重複Key、複数JSON、余分なKeyまたは過大値を部分公開せずblockedへ閉じる。Workbenchは参照を表示するが、参照から任意Path読取りAuthorityを生成しない。固定Provider Executorへの同契約接続は成立済みであり、今回是正後の署名候補再固定・直接起動と実Provider E2Eは未確認である。

## 後続対応 / ロードマップ

固定CLI本体のモデル情報で、助言用`gpt-5.6-sol`は`code_mode_only`だが現行助言実行ではHostを無効化する不整合を確認した。実測errorもCode Mode利用不能の固定文言へ一致した。設定関連のもう一件は未特定である。人間は後続判断として6.1 Solを標準、6 Lunaを軽量用途とするProfileと対応固定CLIへの移行を承認した。旧5.5互換Profile／5.6 Host案は判断前の候補履歴として保持し、現在の採用方針にはしない。

公式CLI `0.159.2`の固定配布物では両モデルがCode Mode専用だった。Hostを正式に含めるだけでなく、非表示Tool名の直接呼出しを実行前に拒否できる許可集合が必要である。公式Sourceの起動時`ToolPolicy`はこの制限を持つが、公開CLI設定からの注入入口は今回の確認で未発見だった。専用実行物の構築・配布・保守を伴う最小起動Adapterへの拡張は人間が承認した。助言用の権限は広げず、通常Executor／Reviewerと専用制限を分け、局所反証と独立レビュー後に再署名・実Provider E2Eへ進む。現在は新モデル実行、Host有効化、権限緩和またはerror無視を行っていない。初期ProfileのJSON外出しは型・Lint・契約試験13件と配布物観測を通過し、独立レビューPass・Finding 0である。根拠、未確認範囲および着手前確認は[モデル・Host移行の着手前確認](Evidence/260930-1853_codex-model-host-migration-preflight.md)を参照する。

署名Runtime `52249c52`の再診断では、拒否対象が完了error通知二件と判明した。固定文字列分類は設定関連一件、code mode関連一件に一致したが、原因の確定ではない。正常終了・資源回収後もWorkbench助言は拒否されており、受理条件を緩めず固定CLIの設定契約へ戻って確認する。診断Toolは独立レビューを通過し、本文や未知値は保存していない。通常E2E合格へは算入しない。根拠と限界は[Codexエラー通知分類](Evidence/260930-1801_workbench-advice-error-classification.md)を参照する。

先行する通知契約の是正は[通知契約照合](Evidence/260930-1643_workbench-advice-notification-contract.md)に記録した。署名Runtime `ecb7fb1d`のCodex単独実測は正常終了・資源回収後に`workbench_ai_codex_tool_event_forbidden`で停止した。正常な思考通知の誤拒否と不正・更新Itemの検査漏れを局所是正し、関連257件と独立レビューを通過した。その実測時点では具体的なItem種別を観測しておらず、原因を思考通知と断定していない。後続の署名Runtime `52249c52`でも拒否が続き、上記診断でerror通知を特定した。解消確認、Claude助言と変更候補およびWorkbench全体のE2Eは未完了である。

Phase 4までの接続とPhase 5の13画面を閉じ、15画面のProduction DOMを3表示Profile×3 Zoomの実Browserで観測した。読取り助言、変更候補の生成と別操作での採否、Shared Serverの公開入口はProduction Compositionまで接続済みである。署名Runtime `45254e2b`と是正済み検証Tool `1b756ac2`によるRun `2e55c8cd2897464b`は、Project Runtime公開MCPの通常二経路、取消、exact Recovery、最終回復在庫確認まで合格した。再入場後の人間の採用判断待ちは意図した停止であり、自動採用完了を主張しない。是正前の失敗結果は履歴Evidenceとして保持する。次はWorkbench実Provider E2Eと必要な四経路E2Eを実測し、残る品質項目を個別照合する。その後、最終回帰・独立レビュー、最終配布固定、再署名、署名拒否試験および直接起動確認を閉じて人間のRelease判断へ渡す。現在の限定合格を全体Quality ReadyまたはRelease可能へ読み替えない。
