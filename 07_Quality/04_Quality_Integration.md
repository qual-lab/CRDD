# Quality Integration

## Workspace方式の追加統合（2026-10-17）

秘密区分の変更は隔離義務QA-000006の既存Local Itemへ条件追加し、[DI共通方針](../06_Architecture/Details/docker-isolation/01_Architecture.md#workspace-isolation-policy)をDirect／Candidateへ同じ基準で適用する。開発用`.env`の許容と、本番資格・Provider認証・AM鍵の保護を分離する。旧隠蔽試験は当時の反例として保持し、新方針の不合格や正式Passへ流用しない。件数・正式Not Runは変更しない。

Merge後分析と資料更新はTask義務`PRL-ST-001`／`PRL-IT-013`、保存義務`RDL-IT-001`／003へ接続する。分析失敗・取消・再入場、元Merge結果／Ref保持、自動Rollback／修正／Merge再発行0、対象Commitと資料保存の相関を分ける。RFD-IT-029のGit処置だけで後続分析・資料更新の成立を代替しない。

[ARCH追加分析](Analysis/ARCH/quality_analysis.md#workspace方式からの追加導出2026-10-17)の六導出を、Task＝QA-000003、コード候補／人間採用＝QA-000005、隔離＝QA-000006、Repository／内容認可／Git境界＝QA-000007、配置・保持＝QA-000008へ統合する。単純なArtifact増加でQA-IDを追加しない。実Git Worktree／Branch／MergeのLifecycleは既存読取りOracleに収まらないため`RFD-IT-029`をNewとし、他は既存Local Itemの方式別追加条件とする。Direct CRUD・Topic／Meeting提案の意味をコードCandidateへ吸収しない。

現設計集合は13定義・198 Local Item。追加は1件、試験実行・正式Pass増分は0。新方式はすべてNot Runであり、旧Bundle／DI／共有入口のEvidenceは旧対象へ維持する。変更した義務へ適用できない元結果を、新方式の現在Passへ集約しない。詳細なOracle・観測は各QA定義、対象別実行計画は[検証設計](03_Verification_Design.md)が所有する。以下の旧局所経過は当時の結果として保持する。

2026-10-13の旧Shared Host撤去候補：旧GatewayのREST／MCP同一Origin、health、HTTP入口stdin EOFは廃止対象で、新しい二Surfaceの義務へ移植しない。TLS／Origin／Signal／Socket終了は現streamable-http、現在認証・非開示・Profile／活動／内容／Relationはaccess-capabilities、残す4 Adapter Caseはai-profile-adapter／runtime-activity-adapterへ接続する。旧GatewayのRFD-ST-004観測は過去Evidenceとして保持し、新STのPassへ流用しない。正式191項目・QA ID・Not Runを維持する。以下の旧局所結果と未接続表示は当時の範囲である。

2026-10-19にartifact-signing／official-asset-governanceの専用機能を廃止した。該当する旧設計単位は現在のCoveredから外し、既存表のOPENで旧方式の現行未被覆を明示する。廃止した専用機能の再実装待ちではなく、対象除外はQA-000010／QA-000011の適用表に従う。素材権利・必要Artifact同一性等の残る上流義務は別に評価する。

成果物種別: Quality統合分析
状態: Canonical
維持責任者: Qual-Lab

現在の統合候補：最小鍵提示と初回限定接続を既存QA-000007／QA-000009へ接続する。通常提示と本人受領観測外、初回限定discoverと次要求の通常Authorityを分離する。提示前保存・遅延通知・v2相関・保存／応答故障は各Local ItemのOracleで判定し、正式191項目・Not Runを維持する。今回12文書は独立レビュー待ち、Source・本番Consumer・実境界・移行は未完了。以下の旧局所件数を現在候補の実行結果にしない。

直前の活動接続結果はAM現在認可から活動OwnerへのMCP搬送で、関連5Packageの283 Case・静的3軸・Workbench Buildと限定独立再レビュー残指摘0を確認した。詳細は[活動接続の局所結果](../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#現在認可mcpと直接利用側の実装候補--2026-10-12)を参照する。共有Profile管理のmanager／administrator許可は文書24件の独立再レビューを完了し、追加区分のSource・実HTTPは局所候補接続済みである。AM60／AI Adapter30／CROS34／MCP68／Workbench33の計225 Case・静的3軸とWorkbench Build成功。CROS／Workbenchは旧比較Consumerの回帰であり、新RoleのWorkbench本番接続ではない。固定候補の限定独立再レビューはPass・残指摘0で、Repository全体Checkerの既知3057 errorsは未解消。本番Launcher／Workbench・鍵配送・旧REST撤去は未完了。Catalog依存を構成した局所候補ではmanager／administratorが19 Tool、developerが15 Tool、Catalog未構成時は15 Toolとする。QA-000001とQA-000007の既存義務へ接続し、191 Local Itemの正式Not Runを維持する。以下の件数・未接続表示は当時の局所履歴で、現在の完成証明へ流用しない。

前段の認証接続はRFD-IT-013の資格→User→現在Role投影部分と、RFD-IT-024の初回状態非更新。AM全35 Case・静的3軸成功、固定13ファイルの限定独立再レビューPass・残指摘0。同一Lock／改訂、本人情報の閉包、失効・破損・解放不明拒否を観測した。

初回資格保存接続時点の局所履歴：RFD-IT-024の相関・User・初回資格保存部分までSource／Test候補を接続済み。AM全33 Case・静的3軸成功、固定10ファイルの限定独立再レビューPass・全重大度の残指摘0。配送／受領／通常接続、認証・現在認可・本番Host／Consumerは未成立。設計集合191項目の正式評価Not Runを維持する。以下の29 Case以前は各接続時点の局所履歴である。

鍵生成・照合の技術層は既存RFD-IT-017／018のNode crypto部分へ接続する候補である。新Local Itemを追加せず、保存・現在認可・失効・交換・配送・本番Surfaceとの未接続を維持する。AM全29 Case・静的3軸成功は技術局所実行、191項目の正式評価はNot Runである。

以下は初回資格保存接続前の履歴である。初回管理者保存をRFD-IT-024のUser部分へ追加接続した。canonical相関、保存済み同Userへの再入場、生成前拒否、保存途中Process喪失、二Process競合、出版後Lock解放不明を局所確認する。Root準備・鍵・配送・認証・本番Host・初回全体は未成立。新Local Itemは追加せず191項目・Not Runを維持する。下段のUser生成未成立はこの部分接続前の履歴である。

2026-10-12の通常保存Adapter局所実装は既存RFD-IT-021の保存部分へ接続した。新Local Itemを追加せず設計集合191項目を維持する。AM全19 Case・静的3軸成功は部分実行であり、現在認可・六管理操作・初回／鍵処置・公開縦断の全体成立とは分離する。正式項目評価Not Run、Quality Ready未成立を維持する。

以下はUser・初回資格保存接続前の履歴である。初回相関の保存部分をRFD-IT-024へ追加接続した。既存Rootでの排他的baseline作成・読戻し・exact再入場・部分書込み保持・二Process競合・解放不明を局所確認する。Root準備、User生成、鍵、配送、本番Host、初回全体は未成立。191項目・Not Runを維持する。

## 1. 統合の責務

工程別Quality分析で全件処置した検証義務を、意味単位の検証目標へ`Same／New／Merge`で統合する。工程別分析を置き換えず、複数工程の成立条件を一つの検証目標へ接続してもSource固有条件を失わない。

### 1.1 Release適用範囲

Canonical設計集合と個別Releaseの検証対象を分ける。Local Itemを後続版へ移しても、定義、未観測状態およびSource Relationは削除しない。移管はPass、実装済みまたは検証済みを意味しない。

| 対象 | Local Item数 | Release上の処置 |
|---|---:|---|
| Canonical設計集合 | 191 | 2026-10-12に状態Schema純粋検査RFD-UT-028をNew追加。旧190件は2026-10-11の設計集合。HTTP公開Process終端の`EST-ST-013`と公式CLIの`ERB-IT-031`を含み、廃止した改造CLIの024～029は含めない。項目数はPass数ではない |
| v0.21 Group A | 130 | v0.21のQuality Gateで評価する。108件観測済み、22件未観測 |
| v0.21からの移管母集団 | 46 | 持越しと後続追加の一覧。現在の個別観測と採用Release Scopeとの対応は[算定Owner](05_Current_Implementation_Reality_Audit.md#13-移管母集団の処置とrelease適用範囲)を参照し、本表で件数を再定義しない |

移管母集団は、v0.22の採用済みRelease Scopeそのものではない。`ERB-IT-018`は[固定された直接境界根拠](../99_Roadmap/Changes/CHG-000082/Evidence/261002_visual-preview-direct-boundary.md)へ接続した。既存Prototype Relationは対象指示として保持するが、完成根拠へ読み替えない。本格Trust Policy管理はDiscoveryとCHGの対象外であり、`AIT-UAT-006`全体との対応はQual-Labが最終Quality／Scope Gateまでに再照合する。安全上必要な信頼要素分離や署名検証も含まれるため、この項目全体を非該当として削除しない。現在の件数・未観測項目は[Reality Audit](05_Current_Implementation_Reality_Audit.md#12-relation是正結果)、完成範囲は[Roadmap](../99_Roadmap/01_Roadmap.md#12-v0220--project運営複数repository)と[Scope探索](../01_Discovery/Analysis/EXP-000034/exploration.md)を正本とする。

## 2. Architecture横断モデルの処置

公式CLIの検証義務はCoordinator詳細設計7.5.1・11節から導出し、`coord.advice-code-mode-host`を`ERB-IT-031`、`ERB-UT-023`および`ERB-ST-030`へ接続する。改造CLI固有の024～029は採用済み廃止対象としてGit履歴に残し、現行集合に含めない。未改造の公式配布・Docker隔離・通知と結果・取消と親Process喪失後の資源観測を維持する。過去の成功を新方式の成功へ流用しない。

横断モデルはCanonical IDとは別のIDを発行しない。Architecture全体にまたがる成立条件を、該当する検証目標へ次のように接続する。

| 検証目標 | [Component／責務](../06_Architecture/02_Component_and_Responsibility_Model.md) | [境界／Interface](../06_Architecture/03_Boundary_and_Interface_Model.md) | [Runtime／Data Flow](../06_Architecture/04_Runtime_and_Data_Flow_Model.md) | [故障／回復](../06_Architecture/05_Failure_Recovery_and_Resilience_Model.md) | [配置／実行](../06_Architecture/06_Deployment_and_Execution_Model.md) |
|---|---|---|---|---|---|
| Repositoryと契約移行 | Required | Required | Required | Required | N/A: Runtime配置を所有しない |
| 変更と品質状態 | Required | Required | Required | Required | N/A: 配置差を品質状態の条件にしない |
| Orchestrator lifecycle | Required | Required | Required | Required | Required |
| 投影と出所 | Required | Required | Required | Required | N/A: 投影の意味は配置方式へ依存させない |
| 候補の昇格 | Required | Required | Required | Required | N/A: 正本への昇格契約を特定Process配置へ固定しない |
| 外部Runtime境界 | Required | Required | Required | Required | Required |
| RepositoryとFederation | Required | Required | Required | Required | Required |
| Runtime Data lifecycle | Required | Required | Required | Required | Required |
| 外部送信とTransport | Required | Required | Required | Required | Required |
| 成果物IntegrityとTrust | Required | Required | Required | Required | Required |
| 公式AssetのGovernance | N/A: Runtime Componentを持たない | Required | Required | Required | N/A: 配置方式ではなく収載・公開判断を確認する |
| 実行記録の公開と再利用 | Required | Required | Required | Required | Required |
| 成果物の理解と工程引継ぎ | Required | Required | Required | Required | N/A: 配置方式ではなく成果物の理解と意味伝播を確認する |

`N/A`は横断モデルを確認しないという意味ではなく、そのモデルが当該検証目標の成立条件を所有しない判断である。権利情報の搬送、開示境界および不明時の停止は、公式AssetのGovernanceでもData Flow、Interface、Failureとして確認する。


## 3. Architecture詳細設計領域の処置

| 詳細設計領域 | 検証単位 | 接続する検証目標 | Local Item | 処置状態 | 未確認／再評価条件 |
|---|---|---|---|---|---|
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.current-authorization` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-UT-020`、`RFD-IT-013`、`RFD-ST-003` | Covered | 現在値の認可義務への接続であり、全入口の実測Passではない。内容語彙・Schema変更時に再評価する |
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.visibility` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-013`、`RFD-ST-004`、`RFD-UAT-007` | Covered | 三可視境界の非開示・許可範囲を確認する。具体表示・本番接続の未観測を残す |
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.management-and-revoke` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-UT-020`、`RFD-IT-018`、`RFD-IT-021`、`RFD-ST-022` | Covered | 固定管理判定、独立失効、同一操作・改訂での登録／Exposure両除去読戻しを分担する。取消完了や対象外変更へ一般化しない |
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.key-exchange-scope` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-UT-028`、`RFD-IT-017`、`RFD-ST-016`、`RFD-UAT-007` | OPEN | UT-028は保存Schema側の交換段階・対象集合・発行先相関だけを所有し、prepareKeyExchangeの選択・確認全体のUTではない。四組の対象・確認・保持は既存IT／ST／UATへ接続するが、純粋選択判定の未接続・実境界の未観測を残す。固定管理権限UTや初回UTで補完せず、Ready・実測Passへ昇格しない |
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.partial-recovery` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-025`、`RFD-ST-016` | Covered | 発行／記録不明と確定後提示不明を区別し元Identityを保持する。初回再観測と通常交換を相互代替せず、物理再入場の未観測を残す |
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.host-initialization` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-UT-023`、`RFD-IT-024`、`RFD-ST-026`、`RFD-UAT-027` | Covered | 初回の元試行・提示・限定接続・保存・清掃順の定義接続。実状態移行・本番接続・実境界は別に評価する |
| [access-management](../06_Architecture/Details/access-management/01_Architecture.md) | `access-management.secret-delivery` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-017`、`RFD-ST-016` | Covered | 発行・記録・提示と短命値解放を別観測し本人受領を推定しない。入力・提示結果の保存／搬送・清掃変更時に再評価する |
| [docker-isolation](../06_Architecture/Details/docker-isolation/01_Architecture.md) | `docker-isolation.lifecycle` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-001`、`ERB-ST-005` | Covered | 元操作・固定構成・実ID・所有Handle終端と不存在を段階別に確認する。新Workspace全Provider実境界は未評価 |
| [docker-isolation](../06_Architecture/Details/docker-isolation/01_Architecture.md) | `docker-isolation.failure-recovery` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-003`、`ERB-ST-030` | Covered | 一次失敗・清掃不明・親喪失とexact再入場を確認する。履歴だけで現在不存在を補完せず、追加領域Continuationは未観測 |
| [docker-isolation](../06_Architecture/Details/docker-isolation/01_Architecture.md) | `docker-isolation.security-boundary` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-001`、`ERB-ST-005`、`ERB-UAT-007` | Covered | 作業Tree・Git／内部状態・認証Homeの用途別Mount境界を確認する。局所構成から任意link・全Provider・利用者確認の成立を推定しない |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.advice-code-mode-host` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-031`、`ERB-UT-023`、`ERB-ST-030` | OPEN | 公式配布と公開起動、通知と最終結果、取消・親Process喪失を個別評価する。局所起動の履歴を署名・実Provider・終了後資源の成功へ流用しない |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `coord.provider-attempt` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-UT-032` | Covered | Provider構造化結果の純粋解析・正規化／拒否だけ。実CLI、終了、取消、cleanupは既存IT／STで別評価する |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `coord.provider-selection` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-UT-033` | Covered | Subscription限定の方針記述だけ。実課金・認証・Provider実行や実行Authorityの成立を示さない |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | `artifact-signing.signature-component` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-008`、`AIT-UT-011` | OPEN | 2026-10-19の専用Package廃止。旧設計との対応であり現版の完成根拠ではない |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | `artifact-signing.one-shot-authorization` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-007`、`AIT-UT-012` | OPEN | 2026-10-19の専用Package廃止。旧設計との対応であり現版の完成根拠ではない |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | `artifact-signing.consumer-boundary` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-009` | OPEN | 2026-10-19の専用Package廃止。旧設計との対応であり現版の完成根拠ではない |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `ai-runtime.catalog-validation` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001`、`RCM-UT-002` | Covered | 閉じたSchema、秘密値・任意実行入口拒否を局所試験で観測済み |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `ai-runtime.profile-resolution` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001`、`RCM-IT-005` | OPEN | Consumer間Identity一致は観測済み。採用済みSnapshotの実Provider注入を再評価する |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `ai-runtime.availability` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001`、`RCM-IT-010` | OPEN | 四軸Projectionは観測済み。実Host・認証・Authority Observerを再評価する |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `ai-runtime.catalog-adoption` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-005`、`RCM-IT-010` | Covered | Repository／CROS Owner別耐久Snapshotと競合Effect 0を観測済み |
| [ai-adapter](../06_Architecture/Details/ai-adapter/01_Architecture.md) | `ai-runtime.profile-administration` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-UT-002`、`RCM-IT-005` | OPEN | Repository Workbenchの限定管理は観測済み。CROS管理入口を再評価する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.generic-core` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-UT-001`、`RCM-UT-002`、`RCM-IT-009`、`RCM-IT-010`、`AUH-IT-002`、`AUH-IT-003`、`AUH-ST-006` | OPEN | `RCM-IT-010`のCROS Tool Registry実境界はv0.22へ移管し、残る項目の意味妥当性を独立レビューする |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.distribution-entry` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-008` | Covered | なし |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.declared-derived-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004` | Covered | 意味妥当性と移行採用は独立レビューで確認する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.test-runner-lifecycle` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-007` | Covered | 所要時間そのものを品質合否に使わない |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | `contract-migration.consumer-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004`、`RCM-IT-005`、`RCM-ST-012` | OPEN | `RCM-ST-012`は実Consumerの署名E2E観測待ちである |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | `contract-migration.vertical-migration` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-005`、`RCM-ST-012` | OPEN | 外部実境界は署名E2Eで再評価する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.dependency-direction` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-009`、`RCM-IT-013` | OPEN | 物理移動後のimport graphでChecker逆依存0を確認する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.public-surface` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-IT-009`、`AUH-IT-002`、`RCM-UT-014` | OPEN | Capability別公開入口の実装後にexport allowlist、deep import禁止、巨大Barrel不在と利用者向け境界を確認する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.source-layout` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-009`、`RCM-IT-015` | OPEN | 責務を示さない汎用Directory、Package Root直下の任意SourceおよびOwner不明の共通置場が0であることを確認する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.consumer-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004` | OPEN | 旧deep import 0と宣言集合・自動導出集合の一致を確認する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.result-boundary` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-IT-011`、`AUH-IT-002`、`RCM-UT-016` | OPEN | Domain Outcome／IssueとChecker Findingの型分離後に必須field、partial／unobservableおよび禁止fieldを確認する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.repository-boundary` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-012` | OPEN | Repository観測公開後に検証済みRoot、Root外、symlink／junction、regular fileおよび終了後資源を確認する |
| [domain-model](../06_Architecture/Details/domain-model/01_Architecture.md) | `crdd-domain-library.distribution-identity` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `RCM-IT-008`、`RCM-IT-009`、`AIT-ST-010` | OPEN | 開発Root／採用側基準版Rootの両経路がlauncherから同じ公開実装へ到達することを確認する。Native Runtime ArtifactのPath移行はManifest、署名、Promotion、RecoveryおよびE2Eを同じGateで閉じる |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.provider-selection` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `ERB-UT-016`、`ERB-IT-017`、`ERB-IT-006`、`ERB-IT-008`、`AIT-ST-004` | Covered | Claude再認証の実Provider／実Home境界は署名STで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.provider-attempt` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md) | `ERB-IT-001`、`ERB-IT-002`、`ERB-ST-005`、`EST-ST-003`、`EST-ST-005`、`CPR-IT-001` | Covered | 実Provider双方向経路と候補Reviewで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.signed-promotion` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-ST-010`、`AIT-IT-013` | Covered | 正式鍵を用いるRelease署名とpromotionで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.task-recovery` | [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-ST-003`、`PRL-ST-004`、`PRL-IT-013` | Covered | 実Processの取消・競合完了・再入場で再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.docker-repair-handoff` | [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `PRL-ST-004`、`ERB-ST-009`、`ERB-ST-011`、`ERB-IT-012` | OPEN | `ERB-ST-011`は実機停止・修復・再起動・別Runtime引継ぎの独立観測待ちである |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | `cros.workspace-access-boundary` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-013`、`RFD-ST-016` | Covered | 設計上の検証義務接続を示す。`RFD-ST-004`の現在権限・古いExposure・admin-only非開示だけを[実HTTP根拠](../99_Roadmap/Changes/CHG-000082/Evidence/261002_shared-gateway-non-disclosure.md)へ接続した。Credential LifecycleとHost Access Recoveryの全体成立は未観測のまま保持する。公開証明書運用は外部TLS終端の責務である |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | `cros.repository-federation` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `PPR-IT-001`、`PPR-IT-002`、`PPR-ST-005`、`RFD-ST-004`、`RFD-IT-009`、`RFD-ST-010` | Covered | 設計上の接続であり全項目Passではない。`PPR-IT-002`と今回の`RFD-ST-004`は限定根拠へ接続し、`PPR-ST-005`のHybrid受入、任意CROSのlocal同値、実Runtime間Handoffは未完成として[算定Owner](05_Current_Implementation_Reality_Audit.md#13-移管母集団の処置とrelease適用範囲)へ戻す。実Filesystem、Internet TLSと全内部handle不存在へ一般化しない |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | `cros.context-handoff` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `ERB-IT-010`、`RFD-IT-011`、`EST-UAT-009`、`ERB-ST-013` | OPEN | v0.22でTransport Schemaと実Runtime Handoffを再開する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.record-read` | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | `ERP-IT-001`、`PPR-IT-003`、`PPR-UT-011` | Covered | 外部Source別の実在性をReality Auditで確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.state-projection` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-UT-006`、`PPR-IT-012` | Covered | 利用側表示の理解可能性はUATで確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.temporal-provenance` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-UAT-009`、`PPR-IT-010`、`PPR-UT-013` | Covered | Clock Sourceの実装と実環境差はReality Auditで再評価する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.evaluation-candidate` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-004`、`PPR-UAT-008`、`PPR-UT-014` | Covered | 人間判断後の下流処置は候補昇格の別検証単位で確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.record-publication` | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-IT-001`、`ERP-IT-002`、`ERP-IT-003`、`ERP-ST-004` | Covered | 複数作成側の実境界で再評価する |
| [mcp-server](../06_Architecture/Details/mcp-server/01_Architecture.md) | `mcp.stdio-transport` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `PPR-UT-006`、`CPR-IT-001`、`EST-IT-001`、`EST-IT-002`、`EST-IT-010`、`EST-ST-012` | OPEN | 既存stdio Transportは維持し、Workbenchを含む四Surface同等性`EST-IT-010`はv0.22へ移管する |
| [mcp-server](../06_Architecture/Details/mcp-server/01_Architecture.md) | `mcp.localhost-http-transport` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `RFD-ST-004`、`EST-IT-001`、`EST-IT-002`、`EST-ST-013` | OPEN | 二Surface化のHost／Origin／TLSと公開HTTP終端をQA正本へ具体化した。旧Gatewayの非開示観測は履歴であり、新経路の成功へ流用しない。実配置・全資源終端は段階5〜7で確認する |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | `official-asset-governance.asset-decision` | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-IT-007` | OPEN | 2026-10-19の専用Package廃止。旧設計との対応であり現版の完成根拠ではない |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | `official-asset-governance.asset-publication` | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-ST-003`、`OAG-IT-005` | OPEN | 2026-10-19の専用Package廃止。旧設計との対応であり現版の完成根拠ではない |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | `official-asset-governance.revision-conflict` | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-IT-006`、`OAG-UT-008` | OPEN | 2026-10-19の専用Package廃止。旧設計との対応であり現版の完成根拠ではない |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | `platform-access.process-boundary` | [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `PRL-ST-003`、`ERB-IT-001`、`ERB-IT-002` | Covered | Windows実境界で再評価する |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | `platform-access.docker-repair` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `ERB-ST-009`、`RDL-ST-002`、`ERB-IT-014` | Covered | Docker Desktop実境界で再評価する |
| [project-operation](../06_Architecture/Details/domain-model/02_Activity_Context.md) | `project-operation.context-lifecycle` | [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-ST-005`、`CPR-IT-006`、`CPR-UAT-007`、`CPR-IT-008` | OPEN | Topic／Meeting Record Readerは成立。永続Store、全CRUD、Outcome移管、Authorityおよび安全な削除はv0.22で継続する |
| [project-operation](../06_Architecture/Details/domain-model/02_Activity_Context.md) | `project-operation.project-projection` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-001`、`PPR-IT-002`、`PPR-ST-005`、`PPR-UT-006`、`PPR-UAT-015` | OPEN | v0.22でProject ProjectionとWorkbench利用側を一体で再開する |
| [orchestrator](../06_Architecture/Details/orchestrator/01_Architecture.md) | `orchestrator.task-lifecycle` | [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | `PRL-ST-001`、`PRL-UAT-002`、`PRL-ST-003`、`PRL-ST-004`、`PRL-IT-005`、`PRL-UT-006`、`PRL-IT-011`、`PPR-UT-006` | Covered | なし |
| [orchestrator](../06_Architecture/Details/orchestrator/01_Architecture.md) | `orchestrator.candidate-adoption` | [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-UT-009`、`CPR-IT-006` | Covered | 実Providerが生成した候補からの採用はPhase 5 E2Eで再評価する |
| [orchestrator](../06_Architecture/Details/orchestrator/01_Architecture.md) | `orchestrator.acceptance-decision` | [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-UT-007`、`PRL-IT-008`、`PRL-ST-009`、`PRL-UAT-010` | Covered | 物理StoreはDevelopmentで選択する |
| [orchestrator](../06_Architecture/Details/orchestrator/01_Architecture.md) | `orchestrator.public-application` | [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `PRL-ST-001`、`PRL-IT-012`、`EST-IT-001`、`PRL-UT-014` | Covered | なし |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | `quality-change-control.audit-set-integration` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-001`、`CQS-IT-003`、`CQS-IT-004`、`CQS-IT-008`、`CQS-ST-008` | Covered | 専門判断の妥当性は各監査で確認する |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | `quality-change-control.remediation-reentry` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-001`、`CQS-IT-004`、`CQS-IT-009`、`CQS-ST-009` | Covered | 人間のRisk受容が発生した時点で再評価する |
| [runtime-data](../06_Architecture/Details/domain-model/03_Repository_Storage.md) | `runtime-data.repository-local-storage` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `PPR-UT-006`、`RDL-IT-001`、`RDL-ST-002`、`RDL-IT-004` | Covered | 現行Path移行はReality Auditで確認する |
| [runtime-data](../06_Architecture/Details/domain-model/03_Repository_Storage.md) | `runtime-data.cros-runtime-root` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RFD-ST-003`、`RDL-IT-001`、`RDL-IT-003` | OPEN | Runtime Data分類はv0.21で維持し、CROS Rootへの実Session接続`RFD-ST-003`はv0.22へ移管する |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | `runtime-trust.axis-evaluation` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-001`、`AIT-IT-003`、`AIT-UT-005` | Covered | 品質監査内容は別Ownerで確認する |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | `runtime-trust.policy-decision` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-001`、`AIT-ST-004` | Covered | OS Credential Store連携時に再評価する |
| [semantic-coverage](../06_Architecture/Details/semantic-coverage/01_Architecture.md) | `semantic-coverage.meaning-compilation` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-004`、`PPR-UT-016` | Covered | Pilot解除条件は別Changeで判断する |
| [semantic-coverage](../06_Architecture/Details/semantic-coverage/01_Architecture.md) | `semantic-coverage.relation-coverage` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-004`、`PPR-UT-017`、`PPR-IT-018` | Covered | 全Subsystem展開は別Changeで判断する |
| [semantic-coverage](../06_Architecture/Details/semantic-coverage/01_Architecture.md) | `semantic-coverage.bundle-publication` | [Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RDL-ST-002`、`RDL-IT-007` | Covered | 同時公開競合は実装拡張時に再評価する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.catalog-closure` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-003`、`CQS-UT-010`、`CQS-IT-011` | Partial | 新Ownerの回帰・独立確認で再評価する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.stage-execution` | [変更と品質状態](Definitions/QA-000002/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `CQS-IT-003`、`ERB-IT-002`、`ERB-IT-004`、`CQS-IT-012`、`CQS-ST-012` | Superseded | 一括自動実行の廃止により旧保証を取り下げる。段階順・未実行は計画と実行手順へ分離する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.resource-intensive-gate` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-003`、`CQS-IT-013`、`CQS-ST-013` | Partial | 実PT／LTは人間が範囲と上限を指定した場合だけ実行する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.boundary-progression` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-002`、`ERB-IT-004`、`ERB-ST-015` | Partial | 実環境差は対象IT／STで再確認する |
| [visual-preview](../06_Architecture/Details/visual-preview/01_Architecture.md) | `visual-preview.local-read-only-preview` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-018` | Covered | localhost読取り専用配信境界を確認する |
| [visual-preview](../06_Architecture/Details/visual-preview/01_Architecture.md) | `visual-preview.browser-lifecycle-observation` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-020`、`ERB-ST-022` | Covered | Listener三値観測、親Browser正常終了／Fallback分離、親終了後に残る子Processへのexactな世代Identity限定Fallback、Identity不一致／未検証時のEffect 0、Graph深度順、cleanup失敗後の後続段実行・Error集約および最終不存在をITで確認する。Workbench実Browser STはReact commit後の全表示条件と通常終了時の資源0を確認する |
| [visual-preview](../06_Architecture/Details/visual-preview/01_Architecture.md) | `visual-preview.actual-browser-zoom` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-ST-019`、`ERB-ST-022` | Covered | 固定Visual成果物の実Browser Zoom 15条件とWorkbench Production DOMのcold相当・連続実行各27条件で、表示品質、画像確定、終了所要時間および終了後資源0を確認する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.root-capability` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-001`、`RFD-IT-002` | Covered | Windows／Linux実境界で再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.snapshot-port` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `PPR-UAT-009`、`RFD-IT-008` | Covered | 代替Version Control Adapter実装時に再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.change-publication` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-014`、`RFD-ST-015` | Covered | Stage／Unstage／Commit／確認済み通常Push、通信断、Remote再観測不能、暗黙再送0およびForce Push 0を観測済み |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.contract-migration-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004`、`RCM-ST-012` | OPEN | 実Consumerの公開・署名・Release・Recovery入口を署名E2Eで確認する |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.component-boundary` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-ST-005` | OPEN | Production Sourceと公開Application Contractの接続後に再評価する |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.interface-boundary` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-UT-023`、`ERB-IT-021` | Covered | AI依頼種別Routerの局所境界とlocalhost Production Serverの固定Route、loopback、Security Headerおよび拒否境界を確認する |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.view-state` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-UAT-015` | OPEN | Production DOMで欠測・制限・判断不能を反証する |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.interaction-sequence` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-014`、`RFD-ST-015` | Covered | Token付きProduction HTTP境界と実Browser表示を分け、操作完了後の再観測失敗でもEffect結果を保持することを観測済み |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.resource-flow` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-021`、`ERB-ST-022` | Covered | Server lifecycleをIT、15画面の実Browser Process／Profile／Listener終了後不存在をSTで観測した。正常終了猶予、exact Identity限定Fallback、最終不存在、画像確定待ちおよび終了所要時間を、cold相当と連続実行の各27条件で再確認済み |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.failure-recovery` | [候補の昇格](Definitions/QA-000005/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `CPR-IT-006`、`CPR-ST-005`、`RFD-ST-015` | OPEN | AI候補の確認・採用・破棄とRevision／Scope競合はITで接続済み。その他のPartial／Unknownからの安全な再入場をProduction全画面で確認する |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.mode-variation` | [外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `EST-IT-001` | OPEN | Repository単体／Local／Remote CROSで同じ結果意味を確認する |
| [workbench-server](../06_Architecture/Details/workbench-server/01_Architecture.md) | `workbench.screen-composition` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `ERB-IT-021`、`ERB-ST-022`、`OAG-ST-003` | Covered | ITで公式ロゴとShellを固定し、Production DOMのDirection Aを15画面×3表示Profile×3 ZoomのSTで観測済み。人間UATは別義務として維持する |

各行は詳細設計のQuality引渡し表にある検証単位をそのまま保持する。`Covered`は設計上の接続が完了した意味であり、実装・実行・合格を意味しない。`OPEN`は未確認事項を既存Local Itemへ丸めず、再評価条件とともに保持する。


### 初回Host設定の詳細設計入力

| 詳細設計領域 | 検証単位 | 接続する検証目標 | Local Item | 処置状態 | 未確認／再評価条件 |
|---|---|---|---|---|---|
| [Access Management](../06_Architecture/Details/access-management/01_Architecture.md) | access-management.host-initialization | QA-000007 | RFD-UT-023、RFD-UT-028、RFD-IT-024、RFD-IT-025、RFD-ST-026、RFD-UAT-027 | Defined／Not Run | UT023とIT024の相関・User・初資格保存は旧局所候補の履歴。UT028を含む今回v2 Parser・提示の実観測・完全限定接続・次要求通常認証・本番Host／Consumer・v1棚卸し移行はOPEN／Not Run。初回内部読取り、初期化開始、公開状態照会、確認Ownerを別に観測する。正式191項目と旧結果の対象版を保持 |
| [MCP](../06_Architecture/Details/mcp-server/01_Architecture.md) | 初回設定・状態照会の非公開と限定接続 | QA-000009 | EST-ST-015（Same更新） | Defined／Not Run | 鍵操作・初期化開始・状態Readerは四面非公開／呼出し0。完全な初回server/discoverだけ確認Ownerをexact 1回、不正要求・通常Toolは0。応答は非秘密、同要求の通常Authority0を本番入口で実観測する |

## 4. 検証項目の閉包

Source IDごとの検証義務は各工程の`Analysis/<工程>/quality_analysis.md`、Architecture横断条件は§2、詳細設計から受け取る条件は§3が所有する。各Quality定義は、それらを次のLocal Item集合へ具体化する。Local Itemをこの表に載せるだけでは意味Coverageとせず、個別Definitionの刺激、観測、期待理由および終了後条件を独立レビューする。

| 検証目標 | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001`、`RCM-UT-002`、`RCM-IT-003`、`RCM-IT-004`、`RCM-IT-005`、`RCM-UAT-006`、`RCM-IT-007`、`RCM-IT-008`、`RCM-IT-009`、`RCM-IT-010`、`RCM-IT-011`、`RCM-ST-012`、`RCM-IT-013`、`RCM-UT-014`、`RCM-IT-015`、`RCM-UT-016` | 6工程のAnalysis §3 | 本書§2／§3とchecker／contract-migration／crdd-domain-library／version-control |
| [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-001`、`CQS-IT-002`、`CQS-IT-003`、`CQS-IT-004`、`CQS-ST-005`、`CQS-UAT-006`、`CQS-UAT-007`、`CQS-IT-008`、`CQS-ST-008`、`CQS-IT-009`、`CQS-ST-009`、`CQS-UT-010`、`CQS-IT-011`、`CQS-IT-012`、`CQS-ST-012`、`CQS-IT-013`、`CQS-ST-013` | 6工程のAnalysis §3 | 本書§2／§3とquality-change-control |
| [Orchestrator lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-ST-001`、`PRL-UAT-002`、`PRL-ST-003`、`PRL-ST-004`、`PRL-IT-005`、`PRL-UT-006`、`PRL-UT-007`、`PRL-IT-008`、`PRL-ST-009`、`PRL-UAT-010`、`PRL-IT-011`、`PRL-IT-012`、`PRL-IT-013`、`PRL-UT-014` | 6工程のAnalysis §3 | 本書§2／§3とorchestrator／coordinator／platform-access |
| [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-001`、`PPR-IT-002`、`PPR-IT-003`、`PPR-IT-004`、`PPR-ST-005`、`PPR-UT-006`、`PPR-UAT-007`、`PPR-UAT-008`、`PPR-UAT-009`、`PPR-IT-010`、`PPR-UT-011`、`PPR-IT-012`、`PPR-UT-013`、`PPR-UT-014`、`PPR-UAT-015`、`PPR-UT-016`、`PPR-UT-017`、`PPR-IT-018`、`PPR-IT-019`、`PPR-UAT-020` | 6工程のAnalysis §3 | 本書§2／§3とcros／execution-intelligence／mcp／project-operation／orchestrator／runtime-data／version-control |
| [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-IT-001`、`CPR-UAT-002`、`CPR-UAT-003`、`CPR-IT-004`、`CPR-ST-005`、`CPR-IT-006`、`CPR-UAT-007`、`CPR-IT-008`、`CPR-UT-009`、`CPR-IT-010`、`CPR-IT-011`、`CPR-IT-012` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-operation／orchestrator |
| [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-001`、`ERB-IT-002`、`ERB-IT-003`、`ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006`、`ERB-UAT-007`、`ERB-IT-008`、`ERB-ST-009`、`ERB-IT-010`、`ERB-ST-011`、`ERB-IT-012`、`ERB-ST-013`、`ERB-IT-014`、`ERB-ST-015`、`ERB-UT-016`、`ERB-IT-017`、`ERB-IT-018`、`ERB-ST-019`、`ERB-IT-020`、`ERB-IT-021`、`ERB-ST-022`、`ERB-UT-023`、`ERB-ST-030`、`ERB-IT-031`、`ERB-UT-039`、`ERB-UT-038`、`ERB-UT-037`、`ERB-UT-036`、`ERB-UT-035`、`ERB-UT-034`、`ERB-UT-032`、`ERB-UT-033` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／platform-access／visual-preview／workbench |
| [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-001`、`RFD-IT-002`、`RFD-ST-003`、`RFD-ST-004`、`RFD-IT-005`、`RFD-UT-006`、`RFD-UAT-007`、`RFD-IT-008`、`RFD-IT-009`、`RFD-ST-010`、`RFD-IT-011`、`RFD-IT-012`、`RFD-IT-013`、`RFD-IT-014`、`RFD-ST-015`、`RFD-ST-016`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-019`、`RFD-UT-020`、`RFD-IT-021`、`RFD-ST-022`、`RFD-UT-023`、`RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027`、`RFD-IT-029`、`RFD-UT-028` | 6工程のAnalysis §3と初回接続節、Detail3処置行 | 本書§2／§3とaccess-management／domain-model／mcp-server／workbench-server／version-control |
| [Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RDL-IT-001`、`RDL-ST-002`、`RDL-IT-003`、`RDL-IT-004`、`RDL-UT-005`、`RDL-UAT-006`、`RDL-IT-007` | 6工程のAnalysis §3 | 本書§2／§3とplatform-access／runtime-data |
| [外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `EST-IT-001`、`EST-IT-002`、`EST-ST-003`、`EST-IT-004`、`EST-ST-005`、`EST-UAT-006`、`EST-UAT-007`、`EST-UAT-008`、`EST-UAT-009`、`EST-IT-010`、`EST-ST-011`、`EST-ST-012`、`EST-ST-013`、`EST-IT-014`、`EST-ST-015` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／orchestrator |
| [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-001`、`AIT-IT-002`、`AIT-IT-003`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006`、`AIT-IT-007`、`AIT-IT-008`、`AIT-IT-009`、`AIT-ST-010`、`AIT-UT-011`、`AIT-UT-012`、`AIT-IT-013`、`AIT-IT-015` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator。署名専用項目は退役 |
| [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005`、`OAG-IT-006`、`OAG-IT-007`、`OAG-UT-008` | 6工程のAnalysis §3 | 本書§2／§3と素材文書・人間の判断。専用Store項目は退役 |
| [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-IT-001`、`ERP-IT-002`、`ERP-IT-003`、`ERP-ST-004`、`ERP-IT-005`、`ERP-UT-006`、`ERP-UAT-007` | 6工程のAnalysis §3 | 本書§2／§3とexecution-intelligence |
| [成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `AUH-UAT-001`、`AUH-IT-002`、`AUH-IT-003`、`AUH-ST-004`、`AUH-ST-005`、`AUH-ST-006` | 6工程のAnalysis §3 | 本書§2／§3とchecker／crdd-domain-library／cros |

## 5. UI／SPEC Detail入力の現在状態

| Source Layer | 対象 | 現在状態 | Qualityでの処置 | 戻り条件 |
|---|---|---|---|---|
| Definition | v0.21のUI／SPEC Definition | Covered | 既存Quality AnalysisとQA Definitionへ統合済み | N/A: v0.21契約で閉包済み |
| Detail | 20 SCR、20 PRT、32 Interaction、30 BHV | Covered | [Detail Quality分析](Analysis/Detail/quality_analysis.md)で全数処置し、Source Definition由来の既存QAへ具体的観測条件として統合する | Product固有Visual／CMPを発行した時に再分析する |

## 鍵の期限なし方針の接続 — 2026-10-11

鍵の期限なし（2026-10-11）は既存QA-000007／RFD-ST-003・RFD-IT-013・RFD-UAT-007へ統合する。時間だけ経過した同じ有効鍵、明示失効・交換後の旧鍵、Role／詳細権限／Exposure変更後の現在認可を別に評価する。新Local Itemなし、更新項目Not Run、Source／Store／本番資格接続・新Evidence未完了。

## Checklist

- [x] 全Canonical IDを一件以上のQuality Analysis行で処置した
- [x] Source固有の成功、失敗、Riskおよび未確認事項を保持した
- [x] UI／SPEC Definition由来とDetail由来の検証義務を区別して統合した
- [x] Source ID、検証目標、試験段階およびLocal Itemを一意に接続した
- [x] 5横断モデルと全Architecture詳細設計領域を処置した
- [x] Quality Integrationだけで第三の要求・設計・検証契約を作っていない
- [x] 上流の未確認事項をUAT、OPEN義務または上流再開のいずれかへ処置した
- [x] 検証目標とLocal Itemの重複、孤立および未接続を残していない
- [x] 現行Source、TestまたはEvidenceからCanonical検証義務を逆算していない
