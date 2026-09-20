# Quality Integration

成果物種別: Quality統合分析
状態: Canonical
維持責任者: Qual-Lab

## 1. 統合の責務

工程別Quality分析で全件処置した検証義務を、意味単位の検証目標へ`Same／New／Merge`で統合する。工程別分析を置き換えず、複数工程の成立条件を一つの検証目標へ接続してもSource固有条件を失わない。

## 2. Architecture横断モデルの処置

横断モデルはCanonical IDとは別のIDを発行しない。Architecture全体にまたがる成立条件を、該当する検証目標へ次のように接続する。

| 検証目標 | [Component／責務](../06_Architecture/02_Component_and_Responsibility_Model.md) | [境界／Interface](../06_Architecture/03_Boundary_and_Interface_Model.md) | [Runtime／Data Flow](../06_Architecture/04_Runtime_and_Data_Flow_Model.md) | [故障／回復](../06_Architecture/05_Failure_Recovery_and_Resilience_Model.md) | [配置／実行](../06_Architecture/06_Deployment_and_Execution_Model.md) |
|---|---|---|---|---|---|
| Repositoryと契約移行 | Required | Required | Required | Required | N/A: Runtime配置を所有しない |
| 変更と品質状態 | Required | Required | Required | Required | N/A: 配置差を品質状態の条件にしない |
| Project Runtime lifecycle | Required | Required | Required | Required | Required |
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
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | 署名Component | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-08` | Covered | なし |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | 一回限りAuthorizationの並行消費 | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-07` | Covered | なし |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | 利用側境界 | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-09` | Covered | Manifest配置・公開はCoordinatorの別検証単位で再評価する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | Generic Core | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-01`、`RCM-02`、`RCM-09`、`RCM-10`、`AUH-02`、`AUH-03`、`AUH-06` | Covered | 意味妥当性は独立レビューで確認する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | 配布入口 | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-08` | Covered | なし |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | 宣言集合と導出集合 | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-03`、`RCM-04` | Covered | 意味妥当性と移行採用は独立レビューで確認する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | 開発試験runnerのLifecycle | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-07` | Covered | 所要時間そのものを品質合否に使わない |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | Consumer closure | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-03`、`RCM-04`、`RCM-05` | Covered | 意味妥当性は独立レビューで確認する |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | 縦断移行 | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-03`、`RCM-05` | Covered | 外部実境界は該当IT／STで再評価する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Dependency Direction | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-09` | OPEN | 物理移動後のimport graphでChecker逆依存0を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Public Surface | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-09`、`AUH-02` | OPEN | Capability別公開入口の実装後にexport allowlist、deep import禁止、巨大Barrel不在と利用者向け境界を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Consumer Closure | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-03`、`RCM-04` | OPEN | 旧deep import 0と宣言集合・自動導出集合の一致を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Result Boundary | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-11`、`AUH-02` | OPEN | Domain Outcome／IssueとChecker Findingの型分離後に必須field、partial／unobservableおよび禁止fieldを確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Repository Boundary | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-12` | OPEN | Repository観測公開後に検証済みRoot、Root外、symlink／junction、regular fileおよび終了後資源を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Distribution Identity | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `RCM-08`、`RCM-09`、`AIT-10` | OPEN | 開発Root／採用側基準版Rootの両経路がlauncherから同じ公開実装へ到達することを確認する。Native Runtime ArtifactのPath移行はManifest、署名、Promotion、RecoveryおよびE2Eを同じGateで閉じる |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | Provider選択・Home／Trust境界 | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `ERB-06`、`ERB-08`、`AIT-04` | Covered | 実Provider／実HomeのITで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | Provider実行・外部送信・候補Review | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md) | `ERB-01`、`ERB-02`、`ERB-05`、`EST-03`、`EST-05`、`CPR-01` | Covered | 実Provider双方向経路と候補Reviewで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | 署名済みManifest・staging promotion | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-10` | Covered | 正式鍵を用いるRelease署名とpromotionで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | 取消・Task回復 | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-03`、`PRL-04` | Covered | 実Processの取消・競合完了・再入場で再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | Docker修復・再起動・別Session／Runtime引継ぎ | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `PRL-04`、`ERB-09`、`ERB-11` | Covered | 実機停止・修復・再起動・別Runtime引継ぎで再評価する |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | 認証・Workspace境界 | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-03`、`RFD-04` | Covered | 敵対的multi-tenantのHost分離は対象外 |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | Federation | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `PPR-01`、`PPR-02`、`PPR-05`、`RFD-04`、`RFD-09`、`RFD-10` | Covered | 物理保存形式はDevelopmentで選択する |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | Handoff | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `ERB-10`、`RFD-11`、`EST-09` | Covered | Transport Schema確定時に再評価する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | 実行記録の読取り | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | `ERP-01`、`PPR-03` | Covered | 外部Source別の実在性をReality Auditで確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | 状態投影 | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-06` | Covered | 利用側表示の理解可能性はUATで確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | 時間的出所 | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-09`、`PPR-10` | Covered | Clock Sourceの実装と実環境差はReality Auditで再評価する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | 評価候補 | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-04`、`PPR-08` | Covered | 人間判断後の下流処置は候補昇格の別検証単位で確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | 実行記録の公開 | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04` | Covered | 複数作成側の実境界で再評価する |
| [mcp](../06_Architecture/Details/mcp/01_Architecture.md) | stdio Transport | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `PPR-06`、`CPR-01`、`EST-01`、`EST-02`、`EST-10` | Covered | なし |
| [mcp](../06_Architecture/Details/mcp/01_Architecture.md) | localhost HTTP | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `RFD-04`、`EST-01`、`EST-02` | Covered | 実OS signalはReality Auditで確認する |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | 素材判断 | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-01`、`OAG-02` | Covered | 法的助言は対象外 |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | 収載・公開 | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-03`、`OAG-05` | Covered | 外部配布先の撤回能力はReality Auditで確認する |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | 同一素材版の競合判断 | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-06` | Covered | 複数判断者による競合で再評価する |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | Process境界 | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `PRL-03`、`ERB-01`、`ERB-02` | Covered | Windows実境界で再評価する |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | Docker修復 | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `ERB-09`、`RDL-02` | Covered | Docker Desktop実境界で再評価する |
| [project-operation](../06_Architecture/Details/project-operation/01_Architecture.md) | Topic／Meeting lifecycle | [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-05` | Covered | 物理保存形式はDevelopmentで選択する |
| [project-operation](../06_Architecture/Details/project-operation/01_Architecture.md) | Project Projection | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-01`、`PPR-02`、`PPR-05`、`PPR-06` | Covered | 表示構成はUI実装時に再評価する |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | Task lifecycle | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | `PRL-01`、`PRL-02`、`PRL-03`、`PRL-04`、`PRL-05`、`PRL-06`、`PRL-11`、`PPR-06` | Covered | なし |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | Objective／Milestone受入判断 | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-07`、`PRL-08`、`PRL-09`、`PRL-10` | Covered | 物理StoreはDevelopmentで選択する |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | Public Application | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `PRL-01`、`PRL-12`、`EST-01` | Covered | なし |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | 監査集合統合 | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-01`、`CQS-03`、`CQS-04` | Covered | 専門判断の妥当性は各監査で確認する |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | 是正再入場 | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-01`、`CQS-04` | Covered | 人間のRisk受容が発生した時点で再評価する |
| [runtime-data](../06_Architecture/Details/runtime-data/01_Architecture.md) | Repository-local data | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `PPR-06`、`RDL-01`、`RDL-02`、`RDL-04` | Covered | 現行Path移行はReality Auditで確認する |
| [runtime-data](../06_Architecture/Details/runtime-data/01_Architecture.md) | CROS runtime root | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RFD-03`、`RDL-01`、`RDL-03` | Covered | Linux配置はv0.22で再評価する |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | 軸別評価 | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-01`、`AIT-03`、`AIT-05` | Covered | 品質監査内容は別Ownerで確認する |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | Trust Policy | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-04` | Covered | OS Credential Store連携時に再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | Root capability | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-01`、`RFD-02` | Covered | Windows／Linux実境界で再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | Snapshot port | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `PPR-09`、`RFD-08` | Covered | 代替Version Control Adapter実装時に再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | Contract migration closure | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-03`、`RCM-04` | Covered | 意味妥当性と移行採用は独立レビューで確認する |

各行は詳細設計のQuality引渡し表にある検証単位をそのまま保持する。`Covered`は設計上の接続が完了した意味であり、実装・実行・合格を意味しない。`OPEN`は未確認事項を既存Local Itemへ丸めず、再評価条件とともに保持する。


## 4. 検証項目の閉包

Source IDごとの検証義務は各工程の`Analysis/<工程>/quality_analysis.md`、Architecture横断条件は§2、詳細設計から受け取る条件は§3が所有する。各Quality定義は、それらを次のLocal Item集合へ具体化する。Local Itemをこの表に載せるだけでは意味Coverageとせず、個別Definitionの刺激、観測、期待理由および終了後条件を独立レビューする。

| 検証目標 | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-01`、`RCM-02`、`RCM-03`、`RCM-04`、`RCM-05`、`RCM-06`、`RCM-07`、`RCM-08`、`RCM-09`、`RCM-10`、`RCM-11` | 6工程のAnalysis §3 | 本書§2／§3とchecker／contract-migration／crdd-domain-library／version-control |
| [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-01`、`CQS-02`、`CQS-03`、`CQS-04`、`CQS-05`、`CQS-06`、`CQS-07` | 6工程のAnalysis §3 | 本書§2／§3とquality-change-control |
| [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-01`、`PRL-02`、`PRL-03`、`PRL-04`、`PRL-05`、`PRL-06`、`PRL-07`、`PRL-08`、`PRL-09`、`PRL-10`、`PRL-11`、`PRL-12` | 6工程のAnalysis §3 | 本書§2／§3とproject-runtime／coordinator／platform-access |
| [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-01`、`PPR-02`、`PPR-03`、`PPR-04`、`PPR-05`、`PPR-06`、`PPR-07`、`PPR-08`、`PPR-09`、`PPR-10` | 6工程のAnalysis §3 | 本書§2／§3とcros／execution-intelligence／mcp／project-operation／project-runtime／runtime-data／version-control |
| [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-01`、`CPR-02`、`CPR-03`、`CPR-04`、`CPR-05` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-operation |
| [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-01`、`ERB-02`、`ERB-03`、`ERB-04`、`ERB-05`、`ERB-06`、`ERB-07`、`ERB-08`、`ERB-09`、`ERB-10`、`ERB-11` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／platform-access |
| [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-01`、`RFD-02`、`RFD-03`、`RFD-04`、`RFD-05`、`RFD-06`、`RFD-07`、`RFD-08`、`RFD-09`、`RFD-10`、`RFD-11`、`RFD-12` | 6工程のAnalysis §3 | 本書§2／§3とcros／crdd-domain-library／mcp／runtime-data／version-control |
| [Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RDL-01`、`RDL-02`、`RDL-03`、`RDL-04`、`RDL-05`、`RDL-06` | 6工程のAnalysis §3 | 本書§2／§3とplatform-access／runtime-data |
| [外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `EST-01`、`EST-02`、`EST-03`、`EST-04`、`EST-05`、`EST-06`、`EST-07`、`EST-08`、`EST-09`、`EST-10`、`EST-11` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-runtime |
| [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-01`、`AIT-02`、`AIT-03`、`AIT-04`、`AIT-05`、`AIT-06`、`AIT-07`、`AIT-08`、`AIT-09`、`AIT-10` | 6工程のAnalysis §3 | 本書§2／§3とartifact-signing／coordinator／runtime-trust |
| [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-01`、`OAG-02`、`OAG-03`、`OAG-04`、`OAG-05`、`OAG-06` | 6工程のAnalysis §3 | 本書§2／§3とofficial-asset-governance |
| [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05`、`ERP-06`、`ERP-07` | 6工程のAnalysis §3 | 本書§2／§3とexecution-intelligence |
| [成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `AUH-01`、`AUH-02`、`AUH-03`、`AUH-04`、`AUH-05`、`AUH-06` | 6工程のAnalysis §3 | 本書§2／§3とchecker／crdd-domain-library／cros |

## Checklist

- [x] 全Canonical IDを一件以上のQuality Analysis行で処置した
- [x] Source固有の成功、失敗、Riskおよび未確認事項を保持した
- [x] Source ID、検証目標、試験段階およびLocal Itemを一意に接続した
- [x] 5横断モデルと全Architecture詳細設計領域を処置した
- [x] Quality Integrationだけで第三の要求・設計・検証契約を作っていない
- [x] 上流の未確認事項をUAT、OPEN義務または上流再開のいずれかへ処置した
- [x] 検証目標とLocal Itemの重複、孤立および未接続を残していない
- [x] 現行Source、TestまたはEvidenceからCanonical検証義務を逆算していない
