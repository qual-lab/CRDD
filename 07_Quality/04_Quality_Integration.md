# Quality Integration

成果物種別: Quality統合分析
状態: Canonical
維持責任者: Qual-Lab

## 1. 統合の責務

工程別Quality分析で全件処置した検証義務を、意味単位の検証目標へ`Same／New／Merge`で統合する。工程別分析を置き換えず、複数工程の成立条件を一つの検証目標へ接続してもSource固有条件を失わない。

### 1.1 Release適用範囲

Canonical設計集合と個別Releaseの検証対象を分ける。Local Itemを後続版へ移しても、定義、未観測状態およびSource Relationは削除しない。移管はPass、実装済みまたは検証済みを意味しない。

| 対象 | Local Item数 | Release上の処置 |
|---|---:|---|
| Canonical設計集合 | 154 | 全件を保持する |
| v0.21 Group A | 128 | v0.21のQuality Gateで評価する。106件観測済み、22件未観測 |
| v0.22 Group B以降 | 26 | v0.21のGateから分離する。Prototype Relation 10件、未観測16件を区別し、v0.22で実装・実境界・人間受入を再評価する |

v0.22へ移管する26件のうち、`RFD-IT-009`、`RFD-IT-011`、`RCM-IT-010`、`RFD-ST-004`、`ERB-ST-013`、`EST-IT-010`、`EST-ST-011`、`PPR-IT-002`、`CPR-IT-004`、`CPR-IT-006`は既存PrototypeとのRelationを持つ。未観測16件は、`AIT-UAT-006`、`CPR-ST-005`、`CPR-UAT-002`、`CPR-UAT-003`、`CPR-UAT-007`、`ERB-IT-010`、`EST-UAT-007`、`EST-UAT-008`、`EST-UAT-009`、`PPR-ST-005`、`PPR-UAT-007`、`PPR-UAT-015`、`PRL-UAT-010`、`RFD-ST-003`、`RFD-ST-010`、`RFD-UAT-007`である。既存Relationは現実の非後退確認として保持するが、[v0.22 Roadmap](../99_Roadmap/01_Roadmap.md#12-v0220--project運営信頼複数repository)が要求する永続化、実境界および利用者受入の完成根拠には使用しない。

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
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | `artifact-signing.signature-component` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-008`、`AIT-UT-011` | Covered | なし |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | `artifact-signing.one-shot-authorization` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-007`、`AIT-UT-012` | Covered | なし |
| [artifact-signing](../06_Architecture/Details/artifact-signing/01_Architecture.md) | `artifact-signing.consumer-boundary` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-009` | Covered | Manifest配置・公開はCoordinatorの別検証単位で再評価する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.generic-core` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-UT-001`、`RCM-UT-002`、`RCM-IT-009`、`RCM-IT-010`、`AUH-IT-002`、`AUH-IT-003`、`AUH-ST-006` | OPEN | `RCM-IT-010`のCROS Tool Registry実境界はv0.22へ移管し、残る項目の意味妥当性を独立レビューする |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.distribution-entry` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-008` | Covered | なし |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.declared-derived-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004` | Covered | 意味妥当性と移行採用は独立レビューで確認する |
| [checker](../06_Architecture/Details/checker/01_Architecture.md) | `checker.test-runner-lifecycle` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-007` | Covered | 所要時間そのものを品質合否に使わない |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | `contract-migration.consumer-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004`、`RCM-IT-005`、`RCM-ST-012` | OPEN | `RCM-ST-012`は実Consumerの署名E2E観測待ちである |
| [contract-migration](../06_Architecture/Details/contract-migration/01_Architecture.md) | `contract-migration.vertical-migration` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-005`、`RCM-ST-012` | OPEN | 外部実境界は署名E2Eで再評価する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.dependency-direction` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-009`、`RCM-IT-013` | OPEN | 物理移動後のimport graphでChecker逆依存0を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.public-surface` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-IT-009`、`AUH-IT-002`、`RCM-UT-014` | OPEN | Capability別公開入口の実装後にexport allowlist、deep import禁止、巨大Barrel不在と利用者向け境界を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.source-layout` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-009`、`RCM-IT-015` | OPEN | 責務を示さない汎用Directory、Package Root直下の任意SourceおよびOwner不明の共通置場が0であることを確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.consumer-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004` | OPEN | 旧deep import 0と宣言集合・自動導出集合の一致を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.result-boundary` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `RCM-IT-011`、`AUH-IT-002`、`RCM-UT-016` | OPEN | Domain Outcome／IssueとChecker Findingの型分離後に必須field、partial／unobservableおよび禁止fieldを確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.repository-boundary` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-012` | OPEN | Repository観測公開後に検証済みRoot、Root外、symlink／junction、regular fileおよび終了後資源を確認する |
| [crdd-domain-library](../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | `crdd-domain-library.distribution-identity` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `RCM-IT-008`、`RCM-IT-009`、`AIT-ST-010` | OPEN | 開発Root／採用側基準版Rootの両経路がlauncherから同じ公開実装へ到達することを確認する。Native Runtime ArtifactのPath移行はManifest、署名、Promotion、RecoveryおよびE2Eを同じGateで閉じる |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.provider-selection` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `ERB-IT-006`、`ERB-IT-008`、`AIT-ST-004` | Covered | 実Provider／実HomeのITで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.provider-attempt` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md) | `ERB-IT-001`、`ERB-IT-002`、`ERB-ST-005`、`EST-ST-003`、`EST-ST-005`、`CPR-IT-001` | Covered | 実Provider双方向経路と候補Reviewで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.signed-promotion` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-ST-010`、`AIT-IT-013` | Covered | 正式鍵を用いるRelease署名とpromotionで再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.task-recovery` | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-ST-003`、`PRL-ST-004`、`PRL-IT-013` | Covered | 実Processの取消・競合完了・再入場で再評価する |
| [coordinator](../06_Architecture/Details/coordinator/01_Architecture.md) | `coord.docker-repair-handoff` | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `PRL-ST-004`、`ERB-ST-009`、`ERB-ST-011`、`ERB-IT-012` | OPEN | `ERB-ST-011`は実機停止・修復・再起動・別Runtime引継ぎの独立観測待ちである |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | `cros.workspace-access-boundary` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-013` | OPEN | v0.22でCredential検証、Workspace Grant、非開示を実境界として再開する |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | `cros.repository-federation` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `PPR-IT-001`、`PPR-IT-002`、`PPR-ST-005`、`RFD-ST-004`、`RFD-IT-009`、`RFD-ST-010` | OPEN | v0.22で複数Repository Projectionと物理保存を一体で再開する |
| [cros](../06_Architecture/Details/cros/01_Architecture.md) | `cros.context-handoff` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `ERB-IT-010`、`RFD-IT-011`、`EST-UAT-009`、`ERB-ST-013` | OPEN | v0.22でTransport Schemaと実Runtime Handoffを再開する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.record-read` | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | `ERP-IT-001`、`PPR-IT-003`、`PPR-UT-011` | Covered | 外部Source別の実在性をReality Auditで確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.state-projection` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-UT-006`、`PPR-IT-012` | Covered | 利用側表示の理解可能性はUATで確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.temporal-provenance` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-UAT-009`、`PPR-IT-010`、`PPR-UT-013` | Covered | Clock Sourceの実装と実環境差はReality Auditで再評価する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.evaluation-candidate` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-004`、`PPR-UAT-008`、`PPR-UT-014` | Covered | 人間判断後の下流処置は候補昇格の別検証単位で確認する |
| [execution-intelligence](../06_Architecture/Details/execution-intelligence/01_Architecture.md) | `execution-intelligence.record-publication` | [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-IT-001`、`ERP-IT-002`、`ERP-IT-003`、`ERP-ST-004` | Covered | 複数作成側の実境界で再評価する |
| [mcp](../06_Architecture/Details/mcp/01_Architecture.md) | `mcp.stdio-transport` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[候補の昇格](Definitions/QA-000005/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `PPR-UT-006`、`CPR-IT-001`、`EST-IT-001`、`EST-IT-002`、`EST-IT-010`、`EST-ST-012` | OPEN | 既存stdio Transportは維持し、Workbenchを含む四Surface同等性`EST-IT-010`はv0.22へ移管する |
| [mcp](../06_Architecture/Details/mcp/01_Architecture.md) | `mcp.localhost-http-transport` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `RFD-ST-004`、`EST-IT-001`、`EST-IT-002` | OPEN | 複数Repository Federationの`RFD-ST-004`はv0.22へ移管し、既存Transport非後退だけをv0.21で確認する |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | `official-asset-governance.asset-decision` | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-IT-007` | Covered | 法的助言は対象外 |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | `official-asset-governance.asset-publication` | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-ST-003`、`OAG-IT-005` | Covered | 外部配布先の撤回能力はReality Auditで確認する |
| [official-asset-governance](../06_Architecture/Details/official-asset-governance/01_Architecture.md) | `official-asset-governance.revision-conflict` | [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-IT-006`、`OAG-UT-008` | Covered | 複数判断者による競合で再評価する |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | `platform-access.process-boundary` | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `PRL-ST-003`、`ERB-IT-001`、`ERB-IT-002` | Covered | Windows実境界で再評価する |
| [platform-access](../06_Architecture/Details/platform-access/01_Architecture.md) | `platform-access.docker-repair` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `ERB-ST-009`、`RDL-ST-002`、`ERB-IT-014` | Covered | Docker Desktop実境界で再評価する |
| [project-operation](../06_Architecture/Details/project-operation/01_Architecture.md) | `project-operation.context-lifecycle` | [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-ST-005`、`CPR-IT-006`、`CPR-UAT-007` | OPEN | v0.22で永続Candidate StoreとAuthority境界を一体で再開する |
| [project-operation](../06_Architecture/Details/project-operation/01_Architecture.md) | `project-operation.project-projection` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-001`、`PPR-IT-002`、`PPR-ST-005`、`PPR-UT-006`、`PPR-UAT-015` | OPEN | v0.22でProject ProjectionとWorkbench利用側を一体で再開する |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | `project-runtime.task-lifecycle` | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[投影と出所](Definitions/QA-000004/quality_definition.md) | `PRL-ST-001`、`PRL-UAT-002`、`PRL-ST-003`、`PRL-ST-004`、`PRL-IT-005`、`PRL-UT-006`、`PRL-IT-011`、`PPR-UT-006` | Covered | なし |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | `project-runtime.acceptance-decision` | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-UT-007`、`PRL-IT-008`、`PRL-ST-009`、`PRL-UAT-010` | Covered | 物理StoreはDevelopmentで選択する |
| [project-runtime](../06_Architecture/Details/project-runtime/01_Architecture.md) | `project-runtime.public-application` | [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md)<br>[外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `PRL-ST-001`、`PRL-IT-012`、`EST-IT-001`、`PRL-UT-014` | Covered | なし |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | `quality-change-control.audit-set-integration` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-001`、`CQS-IT-003`、`CQS-IT-004`、`CQS-IT-008`、`CQS-ST-008` | Covered | 専門判断の妥当性は各監査で確認する |
| [quality-change-control](../06_Architecture/Details/quality-change-control/01_Architecture.md) | `quality-change-control.remediation-reentry` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-001`、`CQS-IT-004`、`CQS-IT-009`、`CQS-ST-009` | Covered | 人間のRisk受容が発生した時点で再評価する |
| [runtime-data](../06_Architecture/Details/runtime-data/01_Architecture.md) | `runtime-data.repository-local-storage` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `PPR-UT-006`、`RDL-IT-001`、`RDL-ST-002`、`RDL-IT-004` | Covered | 現行Path移行はReality Auditで確認する |
| [runtime-data](../06_Architecture/Details/runtime-data/01_Architecture.md) | `runtime-data.cros-runtime-root` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md)<br>[Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RFD-ST-003`、`RDL-IT-001`、`RDL-IT-003` | OPEN | Runtime Data分類はv0.21で維持し、CROS Rootへの実Session接続`RFD-ST-003`はv0.22へ移管する |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | `runtime-trust.axis-evaluation` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-001`、`AIT-IT-003`、`AIT-UT-005` | Covered | 品質監査内容は別Ownerで確認する |
| [runtime-trust](../06_Architecture/Details/runtime-trust/01_Architecture.md) | `runtime-trust.policy-decision` | [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-ST-004`、`AIT-IT-014` | Covered | OS Credential Store連携時に再評価する |
| [semantic-coverage](../06_Architecture/Details/semantic-coverage/01_Architecture.md) | `semantic-coverage.meaning-compilation` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-004`、`PPR-UT-016` | Covered | Pilot解除条件は別Changeで判断する |
| [semantic-coverage](../06_Architecture/Details/semantic-coverage/01_Architecture.md) | `semantic-coverage.relation-coverage` | [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-004`、`PPR-UT-017`、`PPR-IT-018` | Covered | 全Subsystem展開は別Changeで判断する |
| [semantic-coverage](../06_Architecture/Details/semantic-coverage/01_Architecture.md) | `semantic-coverage.bundle-publication` | [Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RDL-ST-002`、`RDL-IT-007` | Covered | 同時公開競合は実装拡張時に再評価する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.catalog-closure` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-003`、`CQS-UT-010`、`CQS-IT-011` | Covered | なし |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.stage-execution` | [変更と品質状態](Definitions/QA-000002/quality_definition.md)<br>[外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `CQS-IT-003`、`ERB-IT-002`、`ERB-IT-004`、`CQS-IT-012`、`CQS-ST-012` | Covered | 各Subsystem固有の外部資源はTest Ownerで再確認する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.resource-intensive-gate` | [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-003`、`CQS-IT-013`、`CQS-ST-013` | Covered | 実PT／LTは人間が範囲と上限を指定した場合だけ実行する |
| [verification-runner](../06_Architecture/Details/verification-runner/01_Architecture.md) | `verification-runner.boundary-progression` | [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-002`、`ERB-IT-004`、`ERB-ST-015` | Covered | 実環境差は対象IT／STで再確認する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.root-capability` | [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-001`、`RFD-IT-002` | Covered | Windows／Linux実境界で再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.snapshot-port` | [投影と出所](Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `PPR-UAT-009`、`RFD-IT-008` | Covered | 代替Version Control Adapter実装時に再評価する |
| [version-control](../06_Architecture/Details/version-control/01_Architecture.md) | `version-control.contract-migration-closure` | [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-IT-003`、`RCM-IT-004`、`RCM-ST-012` | OPEN | 実Consumerの公開・署名・Release・Recovery入口を署名E2Eで確認する |

各行は詳細設計のQuality引渡し表にある検証単位をそのまま保持する。`Covered`は設計上の接続が完了した意味であり、実装・実行・合格を意味しない。`OPEN`は未確認事項を既存Local Itemへ丸めず、再評価条件とともに保持する。


## 4. 検証項目の閉包

Source IDごとの検証義務は各工程の`Analysis/<工程>/quality_analysis.md`、Architecture横断条件は§2、詳細設計から受け取る条件は§3が所有する。各Quality定義は、それらを次のLocal Item集合へ具体化する。Local Itemをこの表に載せるだけでは意味Coverageとせず、個別Definitionの刺激、観測、期待理由および終了後条件を独立レビューする。

| 検証目標 | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| [Repositoryと契約移行](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001`、`RCM-UT-002`、`RCM-IT-003`、`RCM-IT-004`、`RCM-IT-005`、`RCM-UAT-006`、`RCM-IT-007`、`RCM-IT-008`、`RCM-IT-009`、`RCM-IT-010`、`RCM-IT-011`、`RCM-ST-012`、`RCM-IT-013`、`RCM-UT-014`、`RCM-IT-015`、`RCM-UT-016` | 6工程のAnalysis §3 | 本書§2／§3とchecker／contract-migration／crdd-domain-library／version-control |
| [変更と品質状態](Definitions/QA-000002/quality_definition.md) | `CQS-IT-001`、`CQS-IT-002`、`CQS-IT-003`、`CQS-IT-004`、`CQS-ST-005`、`CQS-UAT-006`、`CQS-UAT-007`、`CQS-IT-008`、`CQS-ST-008`、`CQS-IT-009`、`CQS-ST-009`、`CQS-UT-010`、`CQS-IT-011`、`CQS-IT-012`、`CQS-ST-012`、`CQS-IT-013`、`CQS-ST-013` | 6工程のAnalysis §3 | 本書§2／§3とquality-change-control |
| [Project Runtime lifecycle](Definitions/QA-000003/quality_definition.md) | `PRL-ST-001`、`PRL-UAT-002`、`PRL-ST-003`、`PRL-ST-004`、`PRL-IT-005`、`PRL-UT-006`、`PRL-UT-007`、`PRL-IT-008`、`PRL-ST-009`、`PRL-UAT-010`、`PRL-IT-011`、`PRL-IT-012`、`PRL-IT-013`、`PRL-UT-014` | 6工程のAnalysis §3 | 本書§2／§3とproject-runtime／coordinator／platform-access |
| [投影と出所](Definitions/QA-000004/quality_definition.md) | `PPR-IT-001`、`PPR-IT-002`、`PPR-IT-003`、`PPR-IT-004`、`PPR-ST-005`、`PPR-UT-006`、`PPR-UAT-007`、`PPR-UAT-008`、`PPR-UAT-009`、`PPR-IT-010`、`PPR-UT-011`、`PPR-IT-012`、`PPR-UT-013`、`PPR-UT-014`、`PPR-UAT-015`、`PPR-UT-016`、`PPR-UT-017`、`PPR-IT-018` | 6工程のAnalysis §3 | 本書§2／§3とcros／execution-intelligence／mcp／project-operation／project-runtime／runtime-data／version-control |
| [候補の昇格](Definitions/QA-000005/quality_definition.md) | `CPR-IT-001`、`CPR-UAT-002`、`CPR-UAT-003`、`CPR-IT-004`、`CPR-ST-005`、`CPR-IT-006`、`CPR-UAT-007` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-operation |
| [外部Runtime境界](Definitions/QA-000006/quality_definition.md) | `ERB-IT-001`、`ERB-IT-002`、`ERB-IT-003`、`ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006`、`ERB-UAT-007`、`ERB-IT-008`、`ERB-ST-009`、`ERB-IT-010`、`ERB-ST-011`、`ERB-IT-012`、`ERB-ST-013`、`ERB-IT-014`、`ERB-ST-015` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／platform-access |
| [RepositoryとFederation](Definitions/QA-000007/quality_definition.md) | `RFD-IT-001`、`RFD-IT-002`、`RFD-ST-003`、`RFD-ST-004`、`RFD-IT-005`、`RFD-UT-006`、`RFD-UAT-007`、`RFD-IT-008`、`RFD-IT-009`、`RFD-ST-010`、`RFD-IT-011`、`RFD-IT-012`、`RFD-IT-013` | 6工程のAnalysis §3 | 本書§2／§3とcros／crdd-domain-library／mcp／runtime-data／version-control |
| [Runtime Data lifecycle](Definitions/QA-000008/quality_definition.md) | `RDL-IT-001`、`RDL-ST-002`、`RDL-IT-003`、`RDL-IT-004`、`RDL-UT-005`、`RDL-UAT-006`、`RDL-IT-007` | 6工程のAnalysis §3 | 本書§2／§3とplatform-access／runtime-data |
| [外部送信とTransport](Definitions/QA-000009/quality_definition.md) | `EST-IT-001`、`EST-IT-002`、`EST-ST-003`、`EST-IT-004`、`EST-ST-005`、`EST-UAT-006`、`EST-UAT-007`、`EST-UAT-008`、`EST-UAT-009`、`EST-IT-010`、`EST-ST-011`、`EST-ST-012` | 6工程のAnalysis §3 | 本書§2／§3とcoordinator／cros／mcp／project-runtime |
| [成果物IntegrityとTrust](Definitions/QA-000010/quality_definition.md) | `AIT-IT-001`、`AIT-IT-002`、`AIT-IT-003`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006`、`AIT-IT-007`、`AIT-IT-008`、`AIT-IT-009`、`AIT-ST-010`、`AIT-UT-011`、`AIT-UT-012`、`AIT-IT-013`、`AIT-IT-014` | 6工程のAnalysis §3 | 本書§2／§3とartifact-signing／coordinator／runtime-trust |
| [公式AssetのGovernance](Definitions/QA-000011/quality_definition.md) | `OAG-UAT-001`、`OAG-UAT-002`、`OAG-ST-003`、`OAG-UAT-004`、`OAG-IT-005`、`OAG-IT-006`、`OAG-IT-007`、`OAG-UT-008` | 6工程のAnalysis §3 | 本書§2／§3とofficial-asset-governance |
| [実行記録の公開と再利用](Definitions/QA-000012/quality_definition.md) | `ERP-IT-001`、`ERP-IT-002`、`ERP-IT-003`、`ERP-ST-004`、`ERP-IT-005`、`ERP-UT-006`、`ERP-UAT-007` | 6工程のAnalysis §3 | 本書§2／§3とexecution-intelligence |
| [成果物の理解と工程引継ぎ](Definitions/QA-000013/quality_definition.md) | `AUH-UAT-001`、`AUH-IT-002`、`AUH-IT-003`、`AUH-ST-004`、`AUH-ST-005`、`AUH-ST-006` | 6工程のAnalysis §3 | 本書§2／§3とchecker／crdd-domain-library／cros |

## Checklist

- [x] 全Canonical IDを一件以上のQuality Analysis行で処置した
- [x] Source固有の成功、失敗、Riskおよび未確認事項を保持した
- [x] Source ID、検証目標、試験段階およびLocal Itemを一意に接続した
- [x] 5横断モデルと全Architecture詳細設計領域を処置した
- [x] Quality Integrationだけで第三の要求・設計・検証契約を作っていない
- [x] 上流の未確認事項をUAT、OPEN義務または上流再開のいずれかへ処置した
- [x] 検証目標とLocal Itemの重複、孤立および未接続を残していない
- [x] 現行Source、TestまたはEvidenceからCanonical検証義務を逆算していない
