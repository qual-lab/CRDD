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

| 詳細設計領域 | 接続する検証目標 | Qualityで受け取る主な成立条件 |
|---|---|---|
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | 署名前検査、署名対象、鍵境界、配置後の検証 |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | 決定論的検査、必要図とRelationの機械確認、未確認の分離、意味判断の非所有 |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | Producer、全Consumer、派生物、署名・Release経路の閉包 |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | Canonical記録、不変公開、並行Writer、実行事実、観測不能、出所と評価候補の分離 |
| [mcp](../06_Architecture/Details/mcp/01_Architecture.md) | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md) | Transport変換、公開Schema、Session、結果搬送 |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | 出所、権利、用途、収載・再配布Authority |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | OS資源、Process Effect、観測、cleanup、回復 |
| [project-operation](../06_Architecture/Details/project-operation/01_Architecture.md) | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md) | Project運営状態、Meeting／Topic候補、正本への引渡し |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | Objective、Task、Objective／Milestone受入判断、Task内判断、取消、回復、公開結果。読取り投影から受入判断Authorityを生成しない |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | 固定改訂版、指摘、是正、Evidence、現在Gateの閉包 |
| [runtime-data](../06_Architecture/Details/runtime-data/01_Architecture.md) | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | Repository-local／OS管理Root、用途、保持、清掃、回復 |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | 準拠、Integrity、Publisher、利用者所有Trust Policy |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |

各詳細設計領域のQuality引渡しにある正常、準正常、異常、観測および終了後条件を、接続先DefinitionのLocal Itemへ割り当てる。領域名の記載だけではCoverageとしない。


## 4. 検証項目の閉包

Source IDごとの検証義務は各工程の`Analysis/<工程>/quality_analysis.md`、Architecture横断条件は§2、詳細設計から受け取る条件は§3が所有する。各Quality定義は、それらを次のLocal Item集合へ具体化する。Local Itemをこの表に載せるだけでは意味Coverageとせず、個別Definitionの刺激、観測、期待理由および終了後条件を独立レビューする。

| 検証目標 | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-01`、`RCM-02`、`RCM-03`、`RCM-04`、`RCM-05`、`RCM-06` | 6工程のAnalysis §3 | 本書§2／§3とchecker／contract-migration／version-control |
| [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-01`、`CQS-02`、`CQS-03`、`CQS-04`、`CQS-05`、`CQS-06`、`CQS-07` | 6工程のAnalysis §3 | 本書§2／§3とquality-change-control |
| [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-01`、`PRL-02`、`PRL-03`、`PRL-04`、`PRL-05`、`PRL-06` | 6工程のAnalysis §3 | 本書§2／§3とproject-runtime／coordinator／platform-access |
| [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-01`、`PPR-02`、`PPR-03`、`PPR-04`、`PPR-05`、`PPR-06`、`PPR-07`、`PPR-08`、`PPR-09` | 6工程のAnalysis §3 | 本書§2／§3とcros／execution-intelligence／mcp／project-operation／project-runtime／runtime-data／version-control |
| [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-01`、`CPR-02`、`CPR-03`、`CPR-04`、`CPR-05` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-operation |
| [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-01`、`ERB-02`、`ERB-03`、`ERB-04`、`ERB-05` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／platform-access |
| [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-01`、`RFD-02`、`RFD-03`、`RFD-04`、`RFD-05`、`RFD-06` | 6工程のAnalysis §3 | 本書§2／§3とcros／mcp／runtime-data／version-control |
| [Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RDL-01`、`RDL-02`、`RDL-03`、`RDL-04`、`RDL-05` | 6工程のAnalysis §3 | 本書§2／§3とplatform-access／runtime-data |
| [外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `EST-01`、`EST-02`、`EST-03`、`EST-04`、`EST-05`、`EST-06`、`EST-07`、`EST-08`、`EST-09` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-runtime |
| [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-01`、`AIT-02`、`AIT-03`、`AIT-04`、`AIT-05`、`AIT-06` | 6工程のAnalysis §3 | 本書§2／§3とartifact-signing／coordinator／runtime-trust／version-control |
| [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-01`、`OAG-02`、`OAG-03`、`OAG-04`、`OAG-05` | 6工程のAnalysis §3 | 本書§2／§3とofficial-asset-governance |
| [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05`、`ERP-06`、`ERP-07` | 6工程のAnalysis §3 | 本書§2／§3とexecution-intelligence |
| [成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `AUH-01`、`AUH-02`、`AUH-03`、`AUH-04`、`AUH-05` | 6工程のAnalysis §3 | 本書§2／§3とchecker |
