# 変更トレース: Project Operation Context

変更ID: `CHG-000067`
状態: `In Progress`
担当責任者: Qual-Lab
対象版: `v0.21.0`
変更分類: `feature`
最終更新日: 2026-09-14

## 1. 結論と現在状態

Project Management Projection、Topic／Project AttentionおよびMeeting／Context Promotionを、一つのProject Operation Contextとして設計・実装する。Project、Commercial、Topic、MeetingおよびCommunicationは物理階層ではなく責務と安定Identityで接続し、同一Repositoryへの同居と別Repositoryへの分離を可能にする。

```text
Project Operation Context
├ Identity
├ Responsibility
├ Lifecycle
├ Relation
├ Read-only Projection
└ Optional Repository Structure
```

| 項目 | 現在状態 |
|---|---|
| Project／Repository／Binding Identity | 設計中 |
| 責務・Authority・Relation | 設計中 |
| Topic／Meeting Lifecycle | 設計中 |
| Project Management Projection | 設計中 |
| 任意Top-level構造 | 設計中 |
| Project Operation／Workbench Discovery | `Complete for Scope`。Workbench／MCP共同利用体系まで再探索し、独立レビューPass。2026-09-13にUX移行承認済み |
| Workbench／MCP共同UX | `Remediation in Progress`。固定Commit `edcbd30f`の独立レビュー（Major 4、Moderate 3）を受け、個別REQを一次の自己完結したUX分析、02〜05を横断Synthesis、01を全体俯瞰・Relation台帳として再整理した。REQ↔UXとREQ↔Journeyを組単位で閉じ、Same判断を利用者・起点・Outcome・Failureの比較へ改める。新しい固定候補への独立再レビューがPassするまでIA移行可能とは表示しない |
| Discoveryの人間理解確認 | 完了。AIによる既存Context再構成と人間理解を分け、Workbench、Remote MCP、Repository単独利用および工程境界の人間提示内容をUX入力へ反映 |
| UX規範・ひな型・Checker・試験 | Visual-firstの6章を維持し、各要求別分析へREQ固有のJourney、Service Blueprint、責任境界および品質を自己完結して残す。02〜05への参照は横断Synthesisへの接続であり、個別分析を代替しない。同一文書内の図・表・文章による意味反復だけを削減した。Checkerは見出しの存在だけで意味品質を代替せず、REQ↔UXとREQ↔Journeyのpairwise closure、Canonical UX定義重複および現行4列表を決定論的に検査する。Repository全体Checker、Checker契約試験、型・Lint・Format確認後に独立再レビューへ戻す |
| 安定コンテキストIDの訂正・置換 | `REQ / UX / IA / UI / SPEC`共通で、`@n`の手動改訂番号を廃止した。意味不変の訂正は同じID、意味の置換は新IDと`supersedes`を用い、過去内容はCHG、Git、Release tagおよび固定Evidenceから追跡する。Checkerは手動改訂番号の再導入を拒否する |

## 2. 契機と人間が決定した範囲

2026-09-12の利用者対話で、次を決定した。

- `Project ID`と`Repository ID`を分け、一つの論理Projectが複数Repositoryを持てるようにする。
- `20_Project`は案件の安定情報だけを所有し、CHG、Quality、Roadmap、Git、実行状態、Topic、MeetingまたはCommercialを複製しない。
- Project Management Projectionは読取り専用の派生Viewであり、正本または独立Project管理Databaseにしない。
- Project、Commercial、Topics、MeetingsおよびCommunicationを別責務とし、安定IDとRelationで接続する。
- Commercialだけを特別扱いせず、Project、Topics、Meetings、Communicationその他の大きな責務領域も、同一Repositoryへの同居と領域単位の別Repository分離を選べるようにする。
- Repositoryを単一Roleへ固定せず、所有するContext Responsibilityの集合を宣言する。既存のTool／Runtime Capabilityとは別fieldで扱う。
- Meeting、TopicおよびCommunicationは使用サービスではなく目的と意味で分類する。
- `20_Project`、`21_Commercial`、`22_Topics`および`23_Meetings`は、使用するRepositoryだけに置く任意領域とする。
- CommercialはProjectとの分離境界だけをv0.21で固定し、会計・請求・税・通貨等の完全Schemaを作らない。
- 情報アクセス差はRepository分離、既存Git／OSの権限およびShared CROS ServerのWorkspace Exposureで表現し、CROSを独自IAM、Password Storeまたは暗号化製品にしない。
- Workbench等のUnlock操作は外部所有の認証処理への入口に限定し、同じOS Userが読める内容の表示ロックを強い情報境界とみなさない。
- Source Repositoryを読めない利用者向けの縮約Projectionは、自動要約や複製ではなく、明示的に許可された公開成果物として扱う。
- Project Operation Contextを一つの変更単位として設計し、実装と試験は責務単位で分ける。
- CROS Coreへ`general／privileged／administrator`の固定Role階層を設けず、`system_admin: true`のConnection Credentialによる管理RequestがCredentialごとの`workspace_ids[]`を設定する。
- `system_admin`、Content Access、既存の開示制約、Task Roleおよび人間の決定権限を別軸に保つ。
- Chat AgentとCoding Agentは同じCRDD正本から解決したAgent Operating Contextを参照し、会話全文のPrompt転記ではなく構造化Contextと判断要求でHandoffする。
- MCP接続済みであることを、CRDD規則の認識、準拠、Repository AccessまたはEffect Authorityの根拠にしない。
- v0.21へ採用済みのProject Operation／CROS Capabilityは、既知の次版全面Refactorを前提とする中間構造で正式化せず、現在宣言した利用形態を満たす最小責務を利用者入口から実境界・利用側まで閉じる。
- 内部のSpike、垂直Sliceおよび段階的結合試験は維持し、部分成立を公開CapabilityまたはRelease可能と表示しない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Discovery/01_Product_Discovery.md`](<../../../01_Discovery/01_Product_Discovery.md>)
- [`01_Discovery/02_Product_Candidates.md`](<../../../01_Discovery/02_Product_Candidates.md>)
- `01_Discovery/02_Runtime_and_CROS_Product_Candidates.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md`](<../../../01_Discovery/Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md>)
- [`01_Discovery/Explorations/EXP-000002_Audit_and_Decision_Convergence/exploration.md`](<../../../01_Discovery/Explorations/EXP-000002_Audit_and_Decision_Convergence/exploration.md>)
- `01_Discovery/Explorations/EXP-000002_Coordinated_AI_Execution/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000003_External_Context_Boundaries/exploration.md`](<../../../01_Discovery/Explorations/EXP-000003_External_Context_Boundaries/exploration.md>)
- `01_Discovery/Explorations/EXP-000003_Project_Runtime/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000004_Coordinated_AI_Execution/exploration.md`](<../../../01_Discovery/Explorations/EXP-000004_Coordinated_AI_Execution/exploration.md>)
- `01_Discovery/Explorations/EXP-000004_Execution_Intelligence/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000005_Repository_Distributed_Tooling/exploration.md`](<../../../01_Discovery/Explorations/EXP-000005_Repository_Distributed_Tooling/exploration.md>)
- `01_Discovery/Explorations/EXP-000005_Runtime_Responsibility_Separation/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000006_Agent_Guidance_Ownership/exploration.md`](<../../../01_Discovery/Explorations/EXP-000006_Agent_Guidance_Ownership/exploration.md>)
- `01_Discovery/Explorations/EXP-000006_Local_MCP_HTTP_Access/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md`](<../../../01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md>)
- [`01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md`](<../../../01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md>)
- `01_Discovery/Explorations/EXP-000008_Repository_Local_Work/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000009_Cross_Repository_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000009_Reasoning_Context/exploration.md`](<../../../01_Discovery/Explorations/EXP-000009_Reasoning_Context/exploration.md>)
- [`01_Discovery/Explorations/EXP-000010_Assurance_and_Regression/exploration.md`](<../../../01_Discovery/Explorations/EXP-000010_Assurance_and_Regression/exploration.md>)
- `01_Discovery/Explorations/EXP-000010_Human_and_AI_Entry_Points/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000011_Human_Readable_Documentation/exploration.md`](<../../../01_Discovery/Explorations/EXP-000011_Human_Readable_Documentation/exploration.md>)
- `01_Discovery/Explorations/EXP-000011_Remote_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000012_Recognizable_Official_Identity/exploration.md`](<../../../01_Discovery/Explorations/EXP-000012_Recognizable_Official_Identity/exploration.md>)
- `01_Discovery/Explorations/EXP-000012_Topic_and_Meeting_Continuity/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000013_Execution_Intelligence/exploration.md`](<../../../01_Discovery/Explorations/EXP-000013_Execution_Intelligence/exploration.md>)
- `01_Discovery/Explorations/EXP-000013_Portfolio_Visibility/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000014_Repository_Capability_Discovery/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md`](<../../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md>)
- [`01_Discovery/Explorations/EXP-000015_Local_MCP_HTTP_Access/exploration.md`](<../../../01_Discovery/Explorations/EXP-000015_Local_MCP_HTTP_Access/exploration.md>)
- `01_Discovery/Explorations/EXP-000015_Runtime_Data_Ownership/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000016_AI_Runtime_Changeability/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000016_Runtime_Data_Ownership/exploration.md`](<../../../01_Discovery/Explorations/EXP-000016_Runtime_Data_Ownership/exploration.md>)
- `01_Discovery/Explorations/EXP-000017_Cross_Project_Context_Exchange/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000017_Diagram_Guided_Handoff/exploration.md`](<../../../01_Discovery/Explorations/EXP-000017_Diagram_Guided_Handoff/exploration.md>)
- `01_Discovery/Explorations/EXP-000018_User_Owned_Runtime_Trust/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000018_Work_and_Evidence_Ownership/exploration.md`](<../../../01_Discovery/Explorations/EXP-000018_Work_and_Evidence_Ownership/exploration.md>)
- `01_Discovery/Explorations/EXP-000019_Audit_and_Decision_Convergence/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md`](<../../../01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md>)
- [`01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md`](<../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md>)
- `01_Discovery/Explorations/EXP-000020_External_Context_Boundaries/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000021_Agent_Guidance_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md`](<../../../01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md>)
- `01_Discovery/Explorations/EXP-000022_Reasoning_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md`](<../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md>)
- `01_Discovery/Explorations/EXP-000023_Assurance_and_Regression/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md`](<../../../01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md>)
- `01_Discovery/Explorations/EXP-000024_Human_Readable_Documentation/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md`](<../../../01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md>)
- `01_Discovery/Explorations/EXP-000025_Diagram_Guided_Handoff/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000025_Repository_Capability_Discovery/exploration.md`](<../../../01_Discovery/Explorations/EXP-000025_Repository_Capability_Discovery/exploration.md>)
- [`01_Discovery/Explorations/EXP-000026_AI_Runtime_Changeability/exploration.md`](<../../../01_Discovery/Explorations/EXP-000026_AI_Runtime_Changeability/exploration.md>)
- `01_Discovery/Explorations/EXP-000026_Work_and_Evidence_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md`](<../../../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md>)
- `01_Discovery/Explorations/EXP-000027_Repository_Distributed_Tooling/exploration.md`（削除または旧Path）
- `01_Discovery/Explorations/EXP-000028_Recognizable_Official_Identity/exploration.md`（削除または旧Path）
- [`01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md`](<../../../01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`02_UX/02_Personas.md`](<../../../02_UX/02_Personas.md>)
- [`02_UX/03_Experience_Map.md`](<../../../02_UX/03_Experience_Map.md>)
- [`02_UX/04_Service_Blueprint.md`](<../../../02_UX/04_Service_Blueprint.md>)
- [`02_UX/05_Quality_Expectations.md`](<../../../02_UX/05_Quality_Expectations.md>)
- [`02_UX/Requirements/REQ-000001/user_experience.md`](<../../../02_UX/Requirements/REQ-000001/user_experience.md>)
- [`02_UX/Requirements/REQ-000002/user_experience.md`](<../../../02_UX/Requirements/REQ-000002/user_experience.md>)
- [`02_UX/Requirements/REQ-000003/user_experience.md`](<../../../02_UX/Requirements/REQ-000003/user_experience.md>)
- [`02_UX/Requirements/REQ-000004/user_experience.md`](<../../../02_UX/Requirements/REQ-000004/user_experience.md>)
- [`02_UX/Requirements/REQ-000005/user_experience.md`](<../../../02_UX/Requirements/REQ-000005/user_experience.md>)
- [`02_UX/Requirements/REQ-000006/user_experience.md`](<../../../02_UX/Requirements/REQ-000006/user_experience.md>)
- [`02_UX/Requirements/REQ-000007/user_experience.md`](<../../../02_UX/Requirements/REQ-000007/user_experience.md>)
- [`02_UX/Requirements/REQ-000008/user_experience.md`](<../../../02_UX/Requirements/REQ-000008/user_experience.md>)
- [`02_UX/Requirements/REQ-000009/user_experience.md`](<../../../02_UX/Requirements/REQ-000009/user_experience.md>)
- [`02_UX/Requirements/REQ-000010/user_experience.md`](<../../../02_UX/Requirements/REQ-000010/user_experience.md>)
- [`02_UX/Requirements/REQ-000011/user_experience.md`](<../../../02_UX/Requirements/REQ-000011/user_experience.md>)
- [`02_UX/Requirements/REQ-000012/user_experience.md`](<../../../02_UX/Requirements/REQ-000012/user_experience.md>)
- [`02_UX/Requirements/REQ-000013/user_experience.md`](<../../../02_UX/Requirements/REQ-000013/user_experience.md>)
- [`02_UX/Requirements/REQ-000014/user_experience.md`](<../../../02_UX/Requirements/REQ-000014/user_experience.md>)
- [`02_UX/Requirements/REQ-000015/user_experience.md`](<../../../02_UX/Requirements/REQ-000015/user_experience.md>)
- [`02_UX/Requirements/REQ-000016/user_experience.md`](<../../../02_UX/Requirements/REQ-000016/user_experience.md>)
- [`02_UX/Requirements/REQ-000017/user_experience.md`](<../../../02_UX/Requirements/REQ-000017/user_experience.md>)
- [`02_UX/Requirements/REQ-000018/user_experience.md`](<../../../02_UX/Requirements/REQ-000018/user_experience.md>)
- [`02_UX/Requirements/REQ-000019/user_experience.md`](<../../../02_UX/Requirements/REQ-000019/user_experience.md>)
- [`02_UX/Requirements/REQ-000020/user_experience.md`](<../../../02_UX/Requirements/REQ-000020/user_experience.md>)
- [`02_UX/Requirements/REQ-000021/user_experience.md`](<../../../02_UX/Requirements/REQ-000021/user_experience.md>)
- [`02_UX/Requirements/REQ-000022/user_experience.md`](<../../../02_UX/Requirements/REQ-000022/user_experience.md>)
- [`02_UX/Requirements/REQ-000023/user_experience.md`](<../../../02_UX/Requirements/REQ-000023/user_experience.md>)
- [`02_UX/Requirements/REQ-000024/user_experience.md`](<../../../02_UX/Requirements/REQ-000024/user_experience.md>)
- [`02_UX/Requirements/REQ-000025/user_experience.md`](<../../../02_UX/Requirements/REQ-000025/user_experience.md>)
- [`02_UX/Requirements/REQ-000026/user_experience.md`](<../../../02_UX/Requirements/REQ-000026/user_experience.md>)
- [`02_UX/Requirements/REQ-000027/user_experience.md`](<../../../02_UX/Requirements/REQ-000027/user_experience.md>)
- [`02_UX/Requirements/REQ-000028/user_experience.md`](<../../../02_UX/Requirements/REQ-000028/user_experience.md>)
- [`02_UX/Requirements/REQ-000029/user_experience.md`](<../../../02_UX/Requirements/REQ-000029/user_experience.md>)
- [`02_UX/Requirements/REQ-000030/user_experience.md`](<../../../02_UX/Requirements/REQ-000030/user_experience.md>)
- [`02_UX/Requirements/REQ-000031/user_experience.md`](<../../../02_UX/Requirements/REQ-000031/user_experience.md>)
- [`02_UX/Requirements/REQ-000032/user_experience.md`](<../../../02_UX/Requirements/REQ-000032/user_experience.md>)
- [`02_UX/Requirements/REQ-000033/user_experience.md`](<../../../02_UX/Requirements/REQ-000033/user_experience.md>)
- [`02_UX/Requirements/REQ-000034/user_experience.md`](<../../../02_UX/Requirements/REQ-000034/user_experience.md>)
- [`02_UX/Requirements/REQ-000035/user_experience.md`](<../../../02_UX/Requirements/REQ-000035/user_experience.md>)
- [`02_UX/Requirements/REQ-000036/user_experience.md`](<../../../02_UX/Requirements/REQ-000036/user_experience.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`03_IA/01_Information_Architecture.md`](<../../../03_IA/01_Information_Architecture.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/checker/01_Architecture.md`](<../../../06_Architecture/checker/01_Architecture.md>)
- [`06_Architecture/cros/01_Architecture.md`](<../../../06_Architecture/cros/01_Architecture.md>)
- [`06_Architecture/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/project-operation/01_Architecture.md`](<../../../06_Architecture/project-operation/01_Architecture.md>)
- [`06_Architecture/project-runtime/01_Architecture.md`](<../../../06_Architecture/project-runtime/01_Architecture.md>)
- [`06_Architecture/runtime-data/02_Target_Architecture.md`](<../../../06_Architecture/runtime-data/02_Target_Architecture.md>)
- [`06_Architecture/version-control/01_Architecture.md`](<../../../06_Architecture/version-control/01_Architecture.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/04_Test_Catalog.json`](<../../../07_Quality/04_Test_Catalog.json>)
- `07_Quality/07_Structured_Document_Disposition_Inventory.json`（削除または旧Path）
- [`11_Skill.md`](<../../../11_Skill.md>)
- [`12_Change.md`](<../../../12_Change.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`19_Maintenance.md`](<../../../19_Maintenance.md>)
- [`19_Workflows/02_Checker.md`](<../../../19_Workflows/02_Checker.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/checker/regression-execution.ts`](<../../../40_Develop/checker/regression-execution.ts>)
- [`40_Develop/checker/regression-runner.ts`](<../../../40_Develop/checker/regression-runner.ts>)
- `40_Develop/checker/scripts/update-document-disposition-inventory.ts`（削除または旧Path）
- [`40_Develop/checker/test-catalog.ts`](<../../../40_Develop/checker/test-catalog.ts>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/checker/tests/integration/regression-runner.contract.test.ts`](<../../../40_Develop/checker/tests/integration/regression-runner.contract.test.ts>)
- [`40_Develop/checker/tests/unit/test-catalog.contract.test.ts`](<../../../40_Develop/checker/tests/unit/test-catalog.contract.test.ts>)
- [`40_Develop/checker/tsconfig.json`](<../../../40_Develop/checker/tsconfig.json>)
- [`40_Develop/coordinator/bin/coordinator.ts`](<../../../40_Develop/coordinator/bin/coordinator.ts>)
- [`40_Develop/coordinator/scripts/measure-development-providers.ts`](<../../../40_Develop/coordinator/scripts/measure-development-providers.ts>)
- [`40_Develop/coordinator/scripts/prepare-release-candidate.ts`](<../../../40_Develop/coordinator/scripts/prepare-release-candidate.ts>)
- [`40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts`](<../../../40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts>)
- [`40_Develop/coordinator/scripts/promote-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/promote-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/sign-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/sign-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts`](<../../../40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-general-task.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-general-task.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-route-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-route-matrix.ts>)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](<../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts>)
- [`40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts`](<../../../40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts>)
- [`40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts`](<../../../40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts>)
- [`40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts`](<../../../40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts>)
- [`40_Develop/coordinator/src/core/doctor.ts`](<../../../40_Develop/coordinator/src/core/doctor.ts>)
- [`40_Develop/coordinator/src/core/interactive-console.ts`](<../../../40_Develop/coordinator/src/core/interactive-console.ts>)
- [`40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts`](<../../../40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts>)
- [`40_Develop/coordinator/src/core/verification-result-record.ts`](<../../../40_Develop/coordinator/src/core/verification-result-record.ts>)
- [`40_Develop/coordinator/src/security/authority-file-bundle.ts`](<../../../40_Develop/coordinator/src/security/authority-file-bundle.ts>)
- [`40_Develop/coordinator/src/security/authority-grant-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-grant-verifier.ts>)
- [`40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts>)
- [`40_Develop/coordinator/src/security/authority-trust-loader.ts`](<../../../40_Develop/coordinator/src/security/authority-trust-loader.ts>)
- [`40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts`](<../../../40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-helper.ts>)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](<../../../40_Develop/coordinator/src/security/docker-isolation.ts>)
- [`40_Develop/coordinator/src/security/docker-project-recovery-settlement.ts`](<../../../40_Develop/coordinator/src/security/docker-project-recovery-settlement.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-journal.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-journal.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-public-projection.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-public-projection.ts>)
- [`40_Develop/coordinator/src/security/docker-restart-continuation-record.ts`](<../../../40_Develop/coordinator/src/security/docker-restart-continuation-record.ts>)
- [`40_Develop/coordinator/src/security/execution-environment.ts`](<../../../40_Develop/coordinator/src/security/execution-environment.ts>)
- [`40_Develop/coordinator/src/security/execution-intelligence-adapter.ts`](<../../../40_Develop/coordinator/src/security/execution-intelligence-adapter.ts>)
- [`40_Develop/coordinator/src/security/external-send-policy-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-policy-runtime.ts>)
- [`40_Develop/coordinator/src/security/platform-key-storage-policy.ts`](<../../../40_Develop/coordinator/src/security/platform-key-storage-policy.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-objective-intake.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts>)
- [`40_Develop/coordinator/src/security/provider-home.ts`](<../../../40_Develop/coordinator/src/security/provider-home.ts>)
- `40_Develop/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-operation-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-operation-runtime.ts>)
- `40_Develop/coordinator/src/security/repository-root-resolution.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-workspace-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-workspace-runtime.ts>)
- [`40_Develop/coordinator/src/security/windows-directory-bootstrap.ts`](<../../../40_Develop/coordinator/src/security/windows-directory-bootstrap.ts>)
- [`40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/doctor.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/doctor.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tsconfig.strict.json`](<../../../40_Develop/coordinator/tsconfig.strict.json>)
- [`40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts`](<../../../40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts>)
- [`40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts`](<../../../40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts>)
- [`40_Develop/execution-intelligence/src/store/verified-repository-root.ts`](<../../../40_Develop/execution-intelligence/src/store/verified-repository-root.ts>)
- [`40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts`](<../../../40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts>)
- [`40_Develop/mcp/src/adapters/project-runtime-adapter.ts`](<../../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts>)
- [`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`](<../../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts>)
- [`40_Develop/project-runtime/src/application/project-runtime-integration.ts`](<../../../40_Develop/project-runtime/src/application/project-runtime-integration.ts>)
- [`40_Develop/project-runtime/src/public-contract/integration-result.ts`](<../../../40_Develop/project-runtime/src/public-contract/integration-result.ts>)
- [`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`](<../../../40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts>)
- [`40_Develop/runtime-data/src/index.ts`](<../../../40_Develop/runtime-data/src/index.ts>)
- `40_Develop/runtime-data/src/platform/repository-root-capability.ts`（削除または旧Path）
- [`40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts`](<../../../40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts>)
- [`40_Develop/runtime-data/src/store/temporary-operation-store.ts`](<../../../40_Develop/runtime-data/src/store/temporary-operation-store.ts>)
- [`40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts`](<../../../40_Develop/runtime-data/tests/fixtures/create-temporary-operation-and-exit.ts>)
- [`40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts`](<../../../40_Develop/runtime-data/tests/fixtures/resume-temporary-operation-and-exit.ts>)
- [`40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts`](<../../../40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts>)
- [`40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts`](<../../../40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts>)
- [`40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts`](<../../../40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts>)
- [`40_Develop/version-control/package-lock.json`](<../../../40_Develop/version-control/package-lock.json>)
- [`40_Develop/version-control/package.json`](<../../../40_Develop/version-control/package.json>)
- [`40_Develop/version-control/scripts/generate-checker-runtime.ts`](<../../../40_Develop/version-control/scripts/generate-checker-runtime.ts>)
- [`40_Develop/version-control/src/distribution/checker-version-control-runtime.ts`](<../../../40_Develop/version-control/src/distribution/checker-version-control-runtime.ts>)
- [`40_Develop/version-control/src/fixed-revision.ts`](<../../../40_Develop/version-control/src/fixed-revision.ts>)
- [`40_Develop/version-control/src/fixed-snapshot.ts`](<../../../40_Develop/version-control/src/fixed-snapshot.ts>)
- [`40_Develop/version-control/src/git/fixed-revision-adapter.ts`](<../../../40_Develop/version-control/src/git/fixed-revision-adapter.ts>)
- [`40_Develop/version-control/src/git/fixed-snapshot-adapter.ts`](<../../../40_Develop/version-control/src/git/fixed-snapshot-adapter.ts>)
- [`40_Develop/version-control/src/git/local-change-set-adapter.ts`](<../../../40_Develop/version-control/src/git/local-change-set-adapter.ts>)
- [`40_Develop/version-control/src/git/object-reader.ts`](<../../../40_Develop/version-control/src/git/object-reader.ts>)
- [`40_Develop/version-control/src/git/repository-layout-adapter.ts`](<../../../40_Develop/version-control/src/git/repository-layout-adapter.ts>)
- [`40_Develop/version-control/src/git/repository-layout.ts`](<../../../40_Develop/version-control/src/git/repository-layout.ts>)
- [`40_Develop/version-control/src/git/repository-local-ignore-adapter.ts`](<../../../40_Develop/version-control/src/git/repository-local-ignore-adapter.ts>)
- [`40_Develop/version-control/src/index.ts`](<../../../40_Develop/version-control/src/index.ts>)
- [`40_Develop/version-control/src/local-change-set.ts`](<../../../40_Develop/version-control/src/local-change-set.ts>)
- [`40_Develop/version-control/src/repository-local-ignore.ts`](<../../../40_Develop/version-control/src/repository-local-ignore.ts>)
- [`40_Develop/version-control/src/repository-location.ts`](<../../../40_Develop/version-control/src/repository-location.ts>)
- [`40_Develop/version-control/src/repository-revision.ts`](<../../../40_Develop/version-control/src/repository-revision.ts>)
- [`40_Develop/version-control/tests/fixtures/repository-ignore-writer.ts`](<../../../40_Develop/version-control/tests/fixtures/repository-ignore-writer.ts>)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/local-change-set.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/local-change-set.integration.test.ts>)
- [`40_Develop/version-control/tests/integration/repository-location.integration.test.ts`](<../../../40_Develop/version-control/tests/integration/repository-location.integration.test.ts>)
- [`40_Develop/version-control/tsconfig.json`](<../../../40_Develop/version-control/tsconfig.json>)
- `90_Release/Changes/CHG-000067_Project_Operation_Context.md`（削除または旧Path）
- `90_Release/Changes/CHG-000068_Phase_Diagram_and_Intent_Handoff.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/01_Roadmap.md`](<../../../99_Roadmap/01_Roadmap.md>)
- [`99_Roadmap/02_Changes.md`](<../../../99_Roadmap/02_Changes.md>)
- [`99_Roadmap/Changes/CHG-000057/change.md`](<../../../99_Roadmap/Changes/CHG-000057/change.md>)
- [`99_Roadmap/Changes/CHG-000063/change.md`](<../../../99_Roadmap/Changes/CHG-000063/change.md>)
- [`99_Roadmap/Changes/CHG-000065/change.md`](<../../../99_Roadmap/Changes/CHG-000065/change.md>)
- [`99_Roadmap/Changes/CHG-000066/change.md`](<../../../99_Roadmap/Changes/CHG-000066/change.md>)
- [`99_Roadmap/Changes/CHG-000067/change.md`](<../../../99_Roadmap/Changes/CHG-000067/change.md>)
- [`99_Roadmap/Changes/CHG-000068/change.md`](<../../../99_Roadmap/Changes/CHG-000068/change.md>)
- [`99_Roadmap/Changes/CHG-000070/change.md`](<../../../99_Roadmap/Changes/CHG-000070/change.md>)
- [`99_Roadmap/Changes/CHG-000071/change.md`](<../../../99_Roadmap/Changes/CHG-000071/change.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`README.md`](<../../../README.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- [`template/01_Discovery/Explorations/EXP-XXXXXX_Short_Name/exploration.md`](<../../../template/01_Discovery/Explorations/EXP-XXXXXX_Short_Name/exploration.md>)
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- [`template/02_UX/02_Personas.md`](<../../../template/02_UX/02_Personas.md>)
- [`template/02_UX/03_Experience_Map.md`](<../../../template/02_UX/03_Experience_Map.md>)
- [`template/02_UX/04_Service_Blueprint.md`](<../../../template/02_UX/04_Service_Blueprint.md>)
- [`template/02_UX/05_Quality_Expectations.md`](<../../../template/02_UX/05_Quality_Expectations.md>)
- [`template/02_UX/Requirements/REQ-XXXXXX/user_experience.md`](<../../../template/02_UX/Requirements/REQ-XXXXXX/user_experience.md>)
- [`template/06_Architecture/01_Architecture.md`](<../../../template/06_Architecture/01_Architecture.md>)
- [`template/99_Roadmap/01_Roadmap.md`](<../../../template/99_Roadmap/01_Roadmap.md>)
- [`template/99_Roadmap/Changes/CHG-XXXXXX/change.md`](<../../../template/99_Roadmap/Changes/CHG-XXXXXX/change.md>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`template/tools/internal/version-control-runtime.ts`](<../../../template/tools/internal/version-control-runtime.ts>)

</details>

## 3. 既存契約からの発展

v0.19は一つのProjectを一つの明示Binding済みRepositoryへ結合した。CHG-000066はRepository-local `.crdd`のManifestへProject IDを置き、同じProject IDの複数書込みBindingを安全側で拒否した。v0.21の複数Repository Projectでは、Repositoryの論理Identityと実在するclone／worktreeのBindingを分ける。

```text
v0.19／CHG-000066
Project ID ──→ Repository Binding

v0.21
Project ID
  └─ Repository ID
       └─ Repository Binding ID
```

| 保持する保証 | 変更する意味 |
|---|---|
| Repository-local `.crdd`にはそのRepositoryの情報だけを置く | 同じProject IDを持つ複数の異なるRepository IDを許容する |
| Directory探索だけでProject／Repositoryを登録しない | Repository ManifestにRepository IDを追加する |
| 同じ論理Repositoryの複数書込みBindingを自動選択しない | 重複判定をProject ID単独からRepository IDとBindingへ移す |
| Binding、Authority、Credential、RecoveryをProject間で暗黙継承しない | CROSはProject Relationを読み取っても個別RepositoryのAuthorityを再検証する |

既存のProject IDをそのままRepository IDへ複製する移行を既定にしない。既存Repositoryの論理ProjectとRepository Identity、同じProjectへ属する他Repositoryの有無、およびBinding競合を確認できる移行入力を先に定める。

## 4. 対象範囲

| 対象 | 変更内容 |
|---|---|
| Discovery | Project運営、Topic、Meeting、Commercial境界とWorkbenchが解決する利用者課題、対象者、代替および採用条件を固定する |
| UX | Developer、PM、Managementごとの目的、Journey、欠測／Restricted時の理解と回復、およびRepository構造を過剰に意識させない体験原則を固定する |
| IA | Entity、Identity、Relation、所有責任および情報導線を固定する |
| Documentation | 任意Top-level領域、固定入口および非該当時の空成果物禁止を固定する |
| Architecture | Projection、Resolver、Repository接続、読取り・更新PortおよびAuthority境界を設計する |
| UI | Project／Portfolio、Source Coverage、Topic／Meeting／判断待ち、正本導線、Credential状態および定型操作の表示・Feedback・回復を固定する |
| UI／SPEC対応 | UI上の各表示・操作・状態を、Topic／Meeting／Projection／CROS公開契約の入力、結果、失敗およびEffectへ全数対応させる |
| SPEC | Topic／Meeting／Projection／Workbench操作の入力、状態、結果、失敗およびEffectを定義する |
| Runtime Data | Project／Repository／Binding IdentityのSchemaと移行を追加する |
| Implementation | 共通Core、Resolver、Projectionおよび必要な公開Interfaceを実装する |
| Quality | 単一Repository、複数Repository、分離Repository、Restricted Commercialおよび誤Bindingを検証する |
| Template／Checker | 使用時の標準入口を配布し、未使用時の空Directoryを要求しない |
| Repository Manifest／CROS | Context Responsibilityの複数宣言、重複所有の競合検出および領域単位のRepository解決を追加する |
| Shared Server接続境界 | RequestごとにBearer TokenをConnection Credentialへ照合し、`workspace_ids[]`、`system_admin`、失効およびRepository Policyを検証する。生TokenをRepository、`.crdd`またはlogへ保存しない |
| Agent Operating Context／Handoff | Taskごとの適用規則、Context、Capability、Decision境界、判断要求および再開契約をRevision付きで投影する |
| CROS Workbench | Project／Portfolio、Source Coverage、Topic／Meeting／判断待ちおよび正本導線を既存公開契約から表示し、少なくとも一つの定型操作を既存Command／Candidate入口へ渡す最小実装を行う |

### 4.0. Group B着手前整合確認

事前の設計対話は採用済み範囲と有力な解決策仮説として用いるが、利用者課題またはWorkbenchの有効性を示す実測へ読み替えない。[Project状態理解の探索](../../../01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md)では、CRDD自己適用で観測した停止・追加確認・補正・探索、そこから推定した認知負担、Repository構造の局所測定、人間判断および未検証のPM／Management仮説を分離した。[人間とAIの入口](../../../01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md)と[Remote Project Context](../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md)では、現行MCPの実装済み3操作と候補設計を分け、Actor別入口、公開Application Capability、Context最小化、Remote接続、切断／再取得およびWorkbenchの反証条件まで再探索する。

| 確認項目 | 結果 |
|---|---|
| 変更分類 | Project Operationの意味契約、Workbench公開利用側およびRepository構造を含む`feature` |
| 影響する正本 | Discovery、UX、IA、UI、SPEC、Architecture、Quality、Template／Checker |
| 保持する意図 | Repository単独利用、正本の一意性、欠測の明示、既存Authority、薄いSurface |
| 目指さないこと | Workbenchありきの要求形成、第二正本、独自IAM、完全なPM／Commercial製品 |
| 代表代替 | AI／MCPのみ、静的Report、薄いWorkbench、独立Project管理Database、中央要約複製 |
| 現在の選択 | 薄いWorkbenchを限定実装し、AI／MCPのみの経路を比較基準として維持する |
| 反証 | 現在地理解、欠測認識、正本到達を改善しない、または専用状態・権限迂回が必要なら拡張しない |
| 人間判断 | v0.21の限定実装範囲とUX工程への移行は決定済み。利用価値の成立はVerificationまで未確定 |

### 4.1. CROS Workbenchの工程Gate

WorkbenchはUI要求または既存Architectureだけから実装へ着手しない。強化された工程別図面処置契約を使い、次の順で各工程の入口、基本図の処置、出口条件および次工程への義務を固定する。

```text
Discovery
「誰の何を解決し、何を目指さないか」
    ↓
UX
「立場ごとに何を理解・判断・回復できるか」
    ↓
IA
「どの情報、関係、Identity、導線を見せるか」
    ├───────────────────────┐
    ▼                       ▼
UI                         SPEC
「画面・領域・状態・操作」   「入力・振る舞い・結果・失敗・Effect」
    │                       │
    └───────────┬───────────┘
                ▼
        UI／SPEC対応レビュー
        「表示・操作とSystem契約の全数対応」
                ↓
Architecture
「どのOwner、Port、Store、Transport、Authorityで成立させるか」
    ↓
Implementation
「固定済み契約をどう実装するか」
    ↓
Verification
「利用者成果から外部境界まで何を反証したか」
```

UIとSPECは直列化せず、共有する対応契約を介して並行に具体化し、Architectureへ進む前に対応レビューで合流する。後工程で上位の意図、情報責務、表示結果または操作意味の不足を検出した場合は、その場のAdapter、UI専用Storeまたは例外で補わず、所有する工程へ戻して以降の対応を再確認する。各工程の図を作成した事実だけで通過せず、現行図、参照、理由付き非該当または作成不能が処置され、次工程の義務と未解決事項が追跡できることを出口条件とする。

## 5. 目指さないこと

- JIRA、Notion、会計SystemまたはGit Clientの再実装。
- Workbench専用のProject正本、状態Storeまたは独自更新ロジック。
- CROS独自のUser Directory、Role管理、共通Password照合、汎用認証Provider、MFA、SSO、Refresh TokenまたはPassword Recovery。Token HashとWorkspace集合を持つ最小Credential Registryはこの対象外に含めない。
- WBS、Risk、Issue、Forecastまたは進捗率を単一のCanonical Entityへ統合すること。
- Commercialの見積、契約、原価、売上、粗利、請求、税または通貨の完全Schema。
- Service名だけによるMeeting、TopicまたはCommunicationの自動分類。
- Project Relationだけから別Repositoryへの読取り・書込みAuthorityを生成すること。
- 使用しないRepositoryへの`20_Project`、`21_Commercial`、`22_Topics`または`23_Meetings`の作成。

## 6. 完成条件

- [ ] Project ID、Repository ID、Repository Binding IDの意味と移行が一意である。
- [ ] Project、Commercial、Topic、Meeting、Communicationの所有情報と非所有情報が一意である。
- [ ] TopicとMeetingの正常、準正常、異常、昇格、終了および再開条件を追跡できる。
- [ ] Projectionが正本を複製せず、欠測、Restricted、ConflictingおよびStaleを正常値へ畳まない。
- [ ] Projection上の操作が所有正本への候補または専用Commandへ解決され、Projectionを直接更新しない。
- [ ] 同一Repository、同一Projectの複数Repository、およびCommercial／Communication分離Repositoryを扱える。
- [ ] Commercial、Topics、Meetings、Communicationその他の責務領域を任意のRepository境界で同居または分離できる。
- [ ] RepositoryのContext ResponsibilityとTool／Runtime Capabilityを混同せず、同一責務の競合Ownerを自動選択しない。
- [ ] RelationからAuthority、Credential、Recoveryまたは外部送信許可を生成しない。
- [ ] `system_admin: true`のCredentialだけがCredentialごとのWorkspace集合を設定でき、管理可否からContent Accessを生成しない。
- [ ] Credential発行、Workspace集合設定、RequestごとのToken照合および失効を別の操作として扱える。
- [ ] Repository分離による情報境界と、表示上のロック／再確認を区別する。
- [ ] Repositoryごとの`available`、`credential_required`、`restricted`、`unavailable`および`unknown`を内容漏えいなしに投影できる。
- [ ] 縮約Projectionの公開が、元Repositoryへのアクセス不能を迂回する自動複製にならない。
- [ ] Chat AgentとCoding Agentが同じCRDD正本から解決したAgent Operating Contextを参照し、構造化Handoffで判断待ちと再開を追跡できる。
- [ ] MCP接続、Agent RoleまたはHandoff受領から未保有Authorityを生成しない。
- [ ] CROS Coreへ独立した情報分類制度、汎用Policy EngineまたはGlobal Operation Permission Registryを追加せず、既存Constraintは利用範囲を狭める方向にだけ適用する。
- [ ] Content Access、Capability固有のOperation Authorityおよび`system_admin`を分離する。
- [ ] 最小Workbenchが実際のCROS／Project Operation公開契約からProject ViewとSource Coverageを表示し、既存Command／Candidate入口への定型操作を縦断できる。
- [ ] Workbenchが第二正本、独自状態Store、直接Filesystem更新または独自Authority判定を持たない。
- [ ] WorkbenchがDiscovery、UX、IA、並行するUI／SPEC、UI／SPEC対応レビュー、Architecture、ImplementationおよびVerificationを正規経路で通り、各工程の基本図処置、出口条件、未解決事項および次工程への義務を追跡できる。
- [ ] 現在宣言した利用形態ごとに、Meaning Contract、実装、利用側移行、契約試験、実境界検証、E2EおよびEvidenceが接続する。
- [ ] 既知の次版全面置換を成立条件とする暫定Owner、Identity、Authorityまたは公開Contractを残さない。
- [ ] ひな型、Checkerおよび試験が任意領域の使用／非使用を区別する。
- [ ] 独立レビュー、Repository全体Checker、回帰および必要な実境界試験が成立する。

## 7. 正本と利用側

| 種別 | 参照 |
|---|---|
| Discovery | [統合したDiscovery判断](../../../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)、[個別探索](../../../01_Discovery/Explorations/) |
| IA | [CRDD内部Toolの情報構造](../../../03_IA/01_Information_Architecture.md) |
| Architecture | [Project Operation Contextのアーキテクチャ](../../../06_Architecture/project-operation/01_Architecture.md) |
| CROS利用境界 | [CROS Federationと利用境界](../../../06_Architecture/cros/01_Architecture.md) |
| Runtime Data基準 | [Runtime Dataの目標Architecture](../../../06_Architecture/runtime-data/02_Target_Architecture.md) |
| Communication | [CRDD外部コミュニケーション](../../../17_Communication.md) |
| Roadmap | [v0.21未完了作業](../../01_Roadmap.md#11-v0210--project運営信頼複数repository) |

## 8. 次のGate

| 対象 | 次のGate | 迂回しない境界 |
|---|---|---|
| CROS Workbenchの利用者向け経路 | 全36要求から統合した68 UX成果、New／Same理由、Journey、Blueprint、品質期待および検証義務を同じ改訂版で独立レビューする → Pass後、人間の決定権限者がIAへの移行を確認・承認する | 既存10 UX-IDに対する過去レビューを新しい母集団へ流用せず、IA、並行するUI／SPECとその対応レビューを飛ばしてArchitectureまたは実装へ進まない |
| 非UIのProject Operation意味契約 | UXから生じた情報、状態、判断、Source Coverageおよび回復導線の義務を入力として、Identity、責務、Lifecycle、Relation、ProjectionおよびRepository構造の既存設計候補をIAで再照合する | Workbenchの表示・操作をArchitectureで補完せず、IA／UI／SPECの所有事項へ戻す |

DiscoveryからUXへの移行は2026-09-13に承認済みである。全36要求の分析と68 UX成果への横断統合は完了したが、統合後文書の独立再レビューおよびIA移行判断は別Gateとして維持する。両経路がArchitectureで合流した後に、既存Project Runtime／Runtime Data／Communicationとの契約差を全数照合し、ひな型、Checkerおよび実装へ進む。

## 9. 次の工程是正へ保持する入力

2026-09-13、UX以降の工程間受渡しを、文書間の暗黙的な意味探索ではなく、上流で確定した意味単位と下流での処置を追跡できる構造へ改める案を受け付けた。これは現時点の採用済み設計ではなく、Version Control変更を閉じた後にUXから再評価する固定入力である。

| 候補 | 保持する意図 | 再評価する点 |
|---|---|---|
| 工程間Context Transformation | 下流工程が上流の意味単位を分析対象として受け取り、自工程の意味単位へ変換する | 工程ごとの直接入力、戻り先、同一／新規判断の決定権限 |
| IDとRelationによるTraceability | 意味本文はMarkdownに残し、由来、関係、処置、Coverageを機械追跡する | 新しい台帳を第二正本にしない最小構造と移行費用 |
| 多対多のContext Graph | `REQ`、UX、IA、UI、SPEC、Architectureを固定1対1にしない | Canonical EntityのOwner、重複判定、競合時の人間判断 |
| Quality Intentの段階的具体化 | 利用者期待を下流で突然発明せず、UX／IA／UIからSPEC、Architecture、検証へ渡す | 各工程が所有する粒度と既存検証義務との重複回避 |
| 検証責務の上流Context接続 | Test名や件数でなく、どの要求・体験・情報・仕様・設計を検証したかを示す | 単体／結合／総合／受入の主対象、Evidence Owner、Quality Center投影 |
| 構造Coverageと意味品質の分離 | Checkerは処置漏れを検出し、妥当性判断は工程レビューと検証が担う | 自動導出できる母集団、理由付き非該当、過剰な固定Schemaの回避 |

再評価では、提示された章構成やDirectory案をそのまま採用しない。現在のDiscovery／UX成果物、工程正本、既存ID、検証義務およびWorkbench利用契約を入力に、利用者が自然に理解できる物語、必要最小限の構造、移行可能性を確認する。UXの再整理が必要ならIAへ進む前に同工程へ戻し、以降の対応関係を再固定する。
