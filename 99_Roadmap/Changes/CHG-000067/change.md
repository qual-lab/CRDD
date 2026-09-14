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
| Workbench／MCP共同UX | `Remediation Verification`。固定Commit `374b710d`の独立再レビューは、30 UX、68候補の移行および36要求Coverageを妥当とした一方、Major 2、Moderate 1としてSame判断のActor／Trigger／Outcome比較不足、Service BlueprintのCanonical記法・具体的Handoff不足およびCHG全数表との不一致を検出した。Same 23件をActor／Trigger／Outcome／Failureの両側比較へ拡張し、作成34件を`[U:] [T:] [S:] [R:]`、可視境界、要求固有の返却情報・次行動へ統一した。CHG全数表は個別分析を正として再生成した。Repository全体CheckerはError 0／Warning 0、Checkerの全273試験、型検査、LintおよびFormat検査は成功した。次の固定候補への独立再レビューがPassするまでIA移行可能とは表示しない |
| Discoveryの人間理解確認 | 完了。AIによる既存Context再構成と人間理解を分け、Workbench、Remote MCP、Repository単独利用および工程境界の人間提示内容をUX入力へ反映 |
| UX規範・ひな型・Checker・試験 | Visual-firstの6章を維持し、各要求別分析へREQ固有のJourney、Service Blueprint、責任境界および品質を自己完結して残す。02〜05への参照は横断Synthesisへの接続であり、個別分析を代替しない。同一文書内の図・表・文章による意味反復だけを削減した。Checkerは見出しの存在だけで意味品質を代替せず、REQ↔UXとREQ↔Journeyのpairwise closure、Canonical UX定義重複、SameのActor／Trigger／Outcome／Failure比較構造、および作成BlueprintのCanonical記号・可視境界・失敗時返却・次行動を決定論的に検査する。比較の妥当性と図の意味品質は独立UXレビューで反証する。Repository全体Checker、Checker契約試験、型・Lint・Format確認後に独立再レビューへ戻す |
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

### Service Blueprint適用の全数再判定

利用者行動、利用者から観測可能な接点、提供責務、時間差および失敗・回復時のHandoffを36要求で再評価した。個別分析を正として、次表は同じ主体、接点、返却情報および次の行動を投影する。

| 要求 | 処置 | 利用者 `[U:]` | 観測接点 `[T:]` | 提供責務 `[S:]` | 回復接点 `[R:]` | 失敗時の返却と次の行動 |
|---|---|---|---|---|---|---|
| `REQ-000001` | 作成 | CRDD作成者・保守者 | 成果物をレビューへ渡す前 | 機械Checker | 意味レビュー担当 | 検査範囲や理由が分からないという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 同じ対象と条件を固定し機械的不備を是正する |
| `REQ-000002` | 作成 | Project Operator／PM | 複数AIへ仕事を委ねる時 | 提供System／AI | 人間の決定権限者 | 暗黙の範囲拡張や回復不能という停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 目的・範囲・停止条件を提示し、返された状態から次の行動を判断する |
| `REQ-000003` | 作成 | Project Operator／PM | Projectの成果をまとめて任せる時 | 提供System／AI | 品質確認者 | Task件数を完成と誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: Objective・受入条件・判断点を渡し、Milestoneの採否を判断する |
| `REQ-000004` | 作成 | Runtime導入・運用者 | 実行結果を振り返る時 | Runtime／Tool | 評価担当／AI | 未観測を0や正常へ畳むという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 事実と評価を区別して比較し改善要否を判断する |
| `REQ-000005` | 作成 | Runtime導入・運用者 | Runtime Componentを置換する時 | 実装担当 | 独立確認者 | 内部Path変更で公開入口が壊れるという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 責務分離後も成立済みCapabilityを使う |
| `REQ-000006` | 作成 | Developer | 利用する接続方式を選ぶ時 | 提供System | 運用・確認者 | 接続方式ごとに状態や結果が変わるという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 利用環境に合う接続方式を選び、同じ意図の仕事を依頼する |
| `REQ-000007` | 作成 | Project Operator／PM | Project状況を確認する時 | 提供System | 正本Owner | 欠測や古い値を完全な現在値と誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 現在地と不足を確認し、次の判断またはSource確認を選ぶ |
| `REQ-000008` | 非該当 | — | — | — | — | このREQの中心は、一人のDeveloperが現在Repositoryで作業を開始し、必要な時だけ横断利用を選ぶことにある。利用者行動と接点は個別Journeyで完結し、別主体への責任移送、時間差のある応答、失敗後に別Ownerへ戻す処置は新しい成立条件にならないため非該当とする。CROSへの移行で別主体の許可・Handoff・回復が成果を左右するようになった場合は再評価する。 |
| `REQ-000009` | 作成 | Project Operator／PM | 参照または操作対象を選ぶ時 | 提供System | 運用・確認者 | 同名や近いPathを同じ対象と誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 目的に合う対象候補を選び、確認結果から実行可否を判断する |
| `REQ-000010` | 作成 | Project Operator／PM | 利用場面に合う入口を選ぶ時 | 提供System | 運用・確認者 | 入口ごとに別の業務ロジックが動くという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 入口が違っても同じProject操作を行う |
| `REQ-000011` | 作成 | Project Operator／PM | Remote Sessionを開始・再接続する時 | 提供System | CROS管理者 | 利用不能なRepositoryの存在や内容を推測表示するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 現在許可された範囲を理解して利用する |
| `REQ-000012` | 作成 | Project Operator／PM | Meeting後に決定・Topic・Actionを整理する時 | 提供System／AI | Project Operator／正本Owner | 会議記録が自動的に正本へ昇格するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 会議の内容を候補として整理し正本へつなぐ |
| `REQ-000013` | 作成 | Management | Portfolioの優先度を判断する時 | 提供System | 各Projectの正本Owner | 単一Scoreや欠測した集計で健全性を断定するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: Coverage差を踏まえて優先判断と掘り下げ先を選ぶ |
| `REQ-000014` | 作成 | Developer | Toolで処理を始める時 | 提供System | Repository／Tool Owner | 存在するファイルを利用可能Capabilityと誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 目的と必要Effectに合うToolを選ぶ |
| `REQ-000015` | 作成 | Runtime導入・運用者 | Runtime Dataを作成または清掃する時 | Runtime／Tool | 提供System | subdirectoryや別Rootへ同名データを作るという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 保持すべき状態と一時物を理解して処置する |
| `REQ-000016` | 作成 | Runtime導入・運用者 | 利用モデルやProvider条件を変更する時 | 提供System | Model構成Owner | 未知または非対応のモデルを実行可能と表示するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 利用目的に合うProfileを構成し選択結果を確認する |
| `REQ-000017` | 作成 | 外部Contextの所有者 | 別AgentやToolへ仕事を渡す時 | 提供System／AI | 外部Agent／Tool | 全量投入・Secret混入・古い仮説の現在値化という停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 送信目的と範囲を確認し、帰還結果の採否を判断する |
| `REQ-000018` | 作成 | Runtime導入・運用者 | Runtimeを導入または更新する時 | 提供System | Deployment Owner | 一つの署名表示を全保証と誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: Runtime Trustの各要素を別々に評価する |
| `REQ-000019` | 作成 | CRDD作成者・保守者 | Canonical ContractやOwnerを変更する時 | 提供System | 独立確認者 | 代表Consumerだけ更新して完了扱いするという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 変更した意味と維持する利用側を明示する |
| `REQ-000020` | 作成 | Project Operator／PM | Federated Projectを開く時 | 提供System | Repositoryごとの正本Owner | 読めないSourceを推測補完し完全表示するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: Coverageを確認して横断判断または掘り下げを選ぶ |
| `REQ-000021` | 作成 | Project Operator／PM | 応答喪失後に再接続する時 | 提供System | 運用・確認者 | Timeoutを未実行とみなし新規Effectを起こすという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 既存Requestを指定して再接続し、次の処置を判断する |
| `REQ-000022` | 作成 | Runtime導入・運用者 | 失敗後または保守時に残存を見つけた時 | 提供System | 人間の決定権限者 | 名前や経過時間だけで由来不明物を削除するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 残存の由来と影響を確認し処置を依頼する |
| `REQ-000023` | 作成 | Runtime導入・運用者 | Providerを選択・取消・回復する時 | 提供System | Provider | 設定可能を実行可能とみなし同じ取消挙動を仮定するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: Provider差と現在状態を理解して開始・取消・回復を選ぶ |
| `REQ-000024` | 作成 | Project Operator／PM | AgentやRuntimeから結果が戻る時 | Agent／Runtime | Project Operator／正本Owner | 別TaskやRevisionの結果を混入し自動採用するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 境界を越えた結果を同じTaskへ受け取る |
| `REQ-000025` | 作成 | Runtime導入・運用者 | Runtime Artifactを実行候補にする時 | 提供System | Deployment Owner | Qual-Lab署名だけを唯一の実行資格にするという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 信頼するPublisherとLocal例外を自分で定める |
| `REQ-000026` | 作成 | CRDD作成者・保守者 | 複数Findingを是正する時 | 独立監査者 | 人間の決定権限者 | 一部是正や監査回数を完成と誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 全Findingと編集・試験を対応付けて一つの候補へ反映する |
| `REQ-000027` | 作成 | 外部Contextの所有者 | 外部AI・Tool・RepositoryへContextを送る時 | 提供System／AI | 外部AI／Tool／Repository | 接続済みを包括許可とし結果を自動採用するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 送信範囲に同意し、帰還結果の採否を判断する |
| `REQ-000028` | 作成 | Developer | ChatからCodingまたは逆へ引き継ぐ時 | Coding Agent | 提供System | 入口文書が第二正本になり不足をAIが補完するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 入口が違っても同じCRDD正本と判断境界を使う |
| `REQ-000029` | 作成 | CRDD作成者・保守者 | 過去判断を再利用または更新する時 | 過去の判断・仮説の作成者 | 人間の決定権限者 | 履歴を上書きし競合する理由を勝手に統合するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 履歴と現在値を区別して再利用候補を提示する |
| `REQ-000030` | 作成 | CRDD作成者・保守者 | 変更の検証計画を作る時 | 品質確認者 | 人間の決定権限者 | 単発成功や試験件数からLifecycle全体を保証するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 変更意味と確認したい保証を示す |
| `REQ-000031` | 作成 | CRDD作成者・保守者 | 工程成果物を初めて読む時 | 成果物作成者 | レビュー担当 | Checklist順と専門語だけで文書を埋めるという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 課題と判断の物語から構造化詳細へ進む |
| `REQ-000032` | 作成 | CRDD作成者・保守者 | 工程の入口・出口で成果物を渡す時 | 上流工程の成果物Owner | 品質確認者 | 必要な図を黙って省略しAIごとに記法が変わるという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 工程固有の図から状態・関係・未接続を理解する |
| `REQ-000033` | 作成 | CRDD作成者・保守者 | 変更の現在地や根拠を調べる時 | 提供System | 各成果物Owner | 同じ説明を複製し代表ファイルだけで済ませるという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 目的に応じて未完了・変更理由・根拠・品質を辿る |
| `REQ-000034` | 作成 | Developer | Toolを導入または起動する時 | 提供System | CRDD／Tool Publisher | 外部の任意ToolやCandidateを正式版と誤認するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 反復用開発実行と公式Runtimeを目的に応じて選ぶ |
| `REQ-000035` | 作成 | CRDD作成者・保守者 | ブランド素材を追加または利用する時 | 素材作成者／権利確認者 | 人間の決定権限者 | 見た目だけで権利やTrust保証を推定するという停止理由、成立済み範囲、保持状態および再開条件<br>次の行動: 公式用途とライセンス条件を照合して候補化する |
| `REQ-000036` | 非該当 | — | — | — | — | このREQが変えるのは、Developerの通常作業をVersion Controlの状態や実装から切り離すことであり、利用者が観測する新しいHandoffを追加することではない。通常作業と履歴Capabilityの責任差はJourneyと責任境界で保持でき、別主体への時間差のある責任移送や回復受け渡しは成果の成立条件にならないため非該当とする。Version Control操作そのものを別Serviceへ委任し、その失敗・回復が利用者体験を左右する場合は再評価する。 |

### UX-ID Canonical再編

旧68候補は初回採用前であり、IA、Releaseまたは外部利用側がCanonical Identityとして採用していない。技術語非依存と独立した利用者成果の判定を追加し、現行正本は30件だけを使用する。旧番号は互換Aliasとして残さず、次表を変更根拠として保持する。

| 旧候補 | 旧表題 | 現行UX | 処置分類 | 固有理由 |
|---|---|---|---|---|
| `UX-000001` | Repository単独利用 | `UX-000010` | 同一Outcome | 旧「Repository単独利用」は現行「Repository単独で日常作業を続ける」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000002` | 根拠付きProject View | `UX-000009` | 同一Outcome | 旧「根拠付きProject View」は現行「Projectの現在地を根拠と不完全性付きで理解する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000003` | 薄いWorkbench | `UX-000012` | Capability条件 | 旧「薄いWorkbench」は現行「入口を変えても同じ仕事を続ける」を実現する操作・利用可能性・入口であり、単独で完了する利用者成果ではない |
| `UX-000004` | 所有正本へ戻る候補操作 | `UX-000014` | 同一Outcome | 旧「所有正本へ戻る候補操作」は現行「Meeting内容を候補化し採否を判断する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000005` | 最小Portfolio比較 | `UX-000015` | 同一Outcome | 旧「最小Portfolio比較」は現行「複数Projectを根拠付きで比較する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000006` | Workbench比較価値 | `UX-000009` | Validation条件 | 旧「Workbench比較価値」は現行「Projectの現在地を根拠と不完全性付きで理解する」の成立を反証する検証観点・比較条件であり、利用者成果として別IDを発行しない |
| `UX-000007` | Workspace限定Remote利用 | `UX-000013` | 同一Outcome | 旧「Workspace限定Remote利用」は現行「許可されたWorkspaceだけをRemote利用する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000008` | 同一要求への再接続 | `UX-000021` | 同一Outcome | 旧「同一要求への再接続」は現行「切断後も同じRequestへ戻る」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000009` | Milestoneを委ねる | `UX-000005` | 同一Outcome | 旧「Milestoneを委ねる」は現行「目的と受入条件でMilestoneを委ねる」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000010` | 出所付きContextと結果の往復 | `UX-000019` | 同一Outcome | 旧「出所付きContextと結果の往復」は現行「必要なContextを渡し結果を同じ仕事へ戻す」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000011` | 決定論的な事前確認 | `UX-000001` | 同一Outcome | 旧「決定論的な事前確認」は現行「意味レビューへ集中できる事前確認」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000012` | 行動可能な機械指摘 | `UX-000001` | Capability条件 | 旧「行動可能な機械指摘」は現行「意味レビューへ集中できる事前確認」を実現する操作・利用可能性・入口であり、単独で完了する利用者成果ではない |
| `UX-000013` | 委任範囲と権限の理解 | `UX-000002` | 同一Outcome | 旧「委任範囲と権限の理解」は現行「委任範囲と権限を理解して任せる」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000014` | 委任中の実行状態理解 | `UX-000003` | 同一Outcome | 旧「委任中の実行状態理解」は現行「委任中の状態と判断要否を理解する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000015` | 再試行と回復の選択 | `UX-000004` | 同一Outcome | 旧「再試行と回復の選択」は現行「失敗後の再試行・回復を選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000016` | Objectiveと受入条件の委任 | `UX-000005` | Capability条件 | 旧「Objectiveと受入条件の委任」は現行「目的と受入条件でMilestoneを委ねる」を実現する操作・利用可能性・入口であり、単独で完了する利用者成果ではない |
| `UX-000017` | 部分成功と完成の区別 | `UX-000005` | Quality条件 | 旧「部分成功と完成の区別」は現行「目的と受入条件でMilestoneを委ねる」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000018` | 実行事実の出所追跡 | `UX-000006` | 同一Outcome | 旧「実行事実の出所追跡」は現行「実行事実を根拠付きで振り返る」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000019` | 未観測値の保持 | `UX-000006` | Information条件 | 旧「未観測値の保持」は現行「実行事実を根拠付きで振り返る」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000020` | 事実・評価・改善候補の区別 | `UX-000006` | Information条件 | 旧「事実・評価・改善候補の区別」は現行「実行事実を根拠付きで振り返る」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000021` | 内部変更後の公開体験維持 | `UX-000007` | 同一Outcome | 旧「内部変更後の公開体験維持」は現行「内部変更後も成立済み能力を安全に使う」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000022` | 故障範囲の理解 | `UX-000008` | 同一Outcome | 旧「故障範囲の理解」は現行「故障した境界と影響範囲を理解する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000023` | 移行後の成立済み能力維持 | `UX-000007` | Validation条件 | 旧「移行後の成立済み能力維持」は現行「内部変更後も成立済み能力を安全に使う」の成立を反証する検証観点・比較条件であり、利用者成果として別IDを発行しない |
| `UX-000024` | Transport間の意味同値 | `UX-000012` | Quality条件 | 旧「Transport間の意味同値」は現行「入口を変えても同じ仕事を続ける」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000025` | 接続失敗と処理失敗の区別 | `UX-000008` | Information条件 | 旧「接続失敗と処理失敗の区別」は現行「故障した境界と影響範囲を理解する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000026` | Sourceと現行性への到達 | `UX-000009` | Information条件 | 旧「Sourceと現行性への到達」は現行「Projectの現在地を根拠と不完全性付きで理解する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000027` | 欠測・制限・競合の理解 | `UX-000009` | Information条件 | 旧「欠測・制限・競合の理解」は現行「Projectの現在地を根拠と不完全性付きで理解する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000028` | 必要時だけの横断移行 | `UX-000010` | Capability条件 | 旧「必要時だけの横断移行」は現行「Repository単独で日常作業を続ける」を実現する操作・利用可能性・入口であり、単独で完了する利用者成果ではない |
| `UX-000029` | Project・Repository・Rootの対象確認 | `UX-000011` | 同一Outcome | 旧「Project・Repository・Rootの対象確認」は現行「Project・Repository・Rootを区別して対象を選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000030` | Surface間の公開結果共有 | `UX-000012` | Quality条件 | 旧「Surface間の公開結果共有」は現行「入口を変えても同じ仕事を続ける」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000031` | Credential不足と利用不能の区別 | `UX-000013` | Information条件 | 旧「Credential不足と利用不能の区別」は現行「許可されたWorkspaceだけをRemote利用する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000032` | System管理能力とContent閲覧の分離 | `UX-000013` | Architecture条件 | 旧「System管理能力とContent閲覧の分離」は現行「許可されたWorkspaceだけをRemote利用する」を支える責務分離・依存境界であり、利用者が独立して達成するOutcomeではない |
| `UX-000033` | Meeting内容の意味分類 | `UX-000014` | Information条件 | 旧「Meeting内容の意味分類」は現行「Meeting内容を候補化し採否を判断する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000034` | Topicの継続・新規判断 | `UX-000014` | 同一Outcome | 旧「Topicの継続・新規判断」は現行「Meeting内容を候補化し採否を判断する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000035` | 許可範囲のPortfolio比較 | `UX-000015` | Quality条件 | 旧「許可範囲のPortfolio比較」は現行「複数Projectを根拠付きで比較する」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000036` | Repository Tool能力の発見 | `UX-000016` | 同一Outcome | 旧「Repository Tool能力の発見」は現行「仕事に必要な標準Toolを迷わず選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000037` | 能力表示とEffect権限の区別 | `UX-000016` | Information条件 | 旧「能力表示とEffect権限の区別」は現行「仕事に必要な標準Toolを迷わず選ぶ」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000038` | Runtime Data配置の理解 | `UX-000017` | Information条件 | 旧「Runtime Data配置の理解」は現行「Runtime Dataを安全に保持・清掃する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000039` | Durable・TemporaryのLifecycle理解 | `UX-000017` | 同一Outcome | 旧「Durable・TemporaryのLifecycle理解」は現行「Runtime Dataを安全に保持・清掃する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000040` | AIモデル構成の妥当性理解 | `UX-000018` | Validation条件 | 旧「AIモデル構成の妥当性理解」は現行「AIモデル構成を安全に更新・選択する」の成立を反証する検証観点・比較条件であり、利用者成果として別IDを発行しない |
| `UX-000041` | AIモデル選択と再選定理由 | `UX-000018` | 同一Outcome | 旧「AIモデル選択と再選定理由」は現行「AIモデル構成を安全に更新・選択する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000042` | 現在必要なContextの選択 | `UX-000019` | Information条件 | 旧「現在必要なContextの選択」は現行「必要なContextを渡し結果を同じ仕事へ戻す」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000043` | Context不足・競合時の非捏造 | `UX-000019` | Quality条件 | 旧「Context不足・競合時の非捏造」は現行「必要なContextを渡し結果を同じ仕事へ戻す」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000044` | Secretと不要情報を含めないContext | `UX-000019` | Quality条件 | 旧「Secretと不要情報を含めないContext」は現行「必要なContextを渡し結果を同じ仕事へ戻す」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000045` | Runtime Trust要素の個別理解 | `UX-000020` | Information条件 | 旧「Runtime Trust要素の個別理解」は現行「利用環境の信頼方針でRuntimeを選ぶ」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000046` | Deployment Owner所有のTrust Policy | `UX-000020` | 同一Outcome | 旧「Deployment Owner所有のTrust Policy」は現行「利用環境の信頼方針でRuntimeを選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000047` | 契約移行のConsumer閉包理解 | `UX-000007` | Validation条件 | 旧「契約移行のConsumer閉包理解」は現行「内部変更後も成立済み能力を安全に使う」の成立を反証する検証観点・比較条件であり、利用者成果として別IDを発行しない |
| `UX-000048` | 再接続時のAccess再検証 | `UX-000021` | Quality条件 | 旧「再接続時のAccess再検証」は現行「切断後も同じRequestへ戻る」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000049` | 残存資源と清掃完了の理解 | `UX-000022` | 同一Outcome | 旧「残存資源と清掃完了の理解」は現行「残存資源を安全に回復・清掃する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000050` | Provider固有Lifecycleの正確な表示 | `UX-000008` | Information条件 | 旧「Provider固有Lifecycleの正確な表示」は現行「故障した境界と影響範囲を理解する」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000051` | Task結果の相関と完全性 | `UX-000019` | Quality条件 | 旧「Task結果の相関と完全性」は現行「必要なContextを渡し結果を同じ仕事へ戻す」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000052` | 監査・是正の閉包理解 | `UX-000023` | 同一Outcome | 旧「監査・是正の閉包理解」は現行「監査・是正・判断を一つの改訂版で閉じる」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000053` | 現在必要な人間判断の提示 | `UX-000023` | Information条件 | 旧「現在必要な人間判断の提示」は現行「監査・是正・判断を一つの改訂版で閉じる」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000054` | 外部送信範囲と同意の理解 | `UX-000024` | 同一Outcome | 旧「外部送信範囲と同意の理解」は現行「外部送信範囲と同意を理解して送る」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000055` | AI入口から同じ正本への到達 | `UX-000019` | Capability条件 | 旧「AI入口から同じ正本への到達」は現行「必要なContextを渡し結果を同じ仕事へ戻す」を実現する操作・利用可能性・入口であり、単独で完了する利用者成果ではない |
| `UX-000056` | 推論Contextの履歴と現在値 | `UX-000025` | 同一Outcome | 旧「推論Contextの履歴と現在値」は現行「過去の推論Contextと現在値を区別する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000057` | 試験層と現在の保証範囲の理解 | `UX-000026` | 同一Outcome | 旧「試験層と現在の保証範囲の理解」は現行「試験層と現在の保証範囲を理解して選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000058` | 外部境界Lifecycleの段階検証 | `UX-000026` | Validation条件 | 旧「外部境界Lifecycleの段階検証」は現行「試験層と現在の保証範囲を理解して選ぶ」の成立を反証する検証観点・比較条件であり、利用者成果として別IDを発行しない |
| `UX-000059` | 高負荷試験の明示的な実行選択 | `UX-000026` | 同一Outcome | 旧「高負荷試験の明示的な実行選択」は現行「試験層と現在の保証範囲を理解して選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000060` | 物語と構造を両立する文書理解 | `UX-000027` | 同一Outcome | 旧「物語と構造を両立する文書理解」は現行「物語と構造から文書の意味を理解する」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000061` | 基本図による意図引き渡し | `UX-000028` | 同一Outcome | 旧「基本図による意図引き渡し」は現行「工程固有の図から意図を引き継ぐ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000062` | Work・Change・Evidence・Qualityの役割別Navigation | `UX-000029` | 同一Outcome | 旧「Work・Change・Evidence・Qualityの役割別Navigation」は現行「Work・Change・Evidence・Qualityを迷わず辿る」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000063` | CHGからの全影響Path確認 | `UX-000029` | Information条件 | 旧「CHGからの全影響Path確認」は現行「Work・Change・Evidence・Qualityを迷わず辿る」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000064` | 過去Evidenceの不変な参照 | `UX-000029` | Quality条件 | 旧「過去Evidenceの不変な参照」は現行「Work・Change・Evidence・Qualityを迷わず辿る」で避ける誤認または守る品質条件であり、成果そのものではない |
| `UX-000065` | Repositoryに対応するTool利用 | `UX-000016` | 同一Outcome | 旧「Repositoryに対応するTool利用」は現行「仕事に必要な標準Toolを迷わず選ぶ」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000066` | 開発実行と署名済み実行の区別 | `UX-000016` | Information条件 | 旧「開発実行と署名済み実行の区別」は現行「仕事に必要な標準Toolを迷わず選ぶ」の判断に必要な情報・状態・識別軸であり、独立したGoal／Outcomeではない |
| `UX-000067` | 公式視覚素材の出所・権利・用途理解 | `UX-000030` | 同一Outcome | 旧「公式視覚素材の出所・権利・用途理解」は現行「公式素材を権利と用途を確認して使う」と利用者のGoal・最終Outcome・避けるFailureが同じで、旧粒度だけが細かいため統合する |
| `UX-000068` | Version Control非依存の日常作業 | `UX-000010` | Architecture条件 | 旧「Version Control非依存の日常作業」は現行「Repository単独で日常作業を続ける」を支える責務分離・依存境界であり、利用者が独立して達成するOutcomeではない |
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
| CROS Workbenchの利用者向け経路 | 全36要求から統合した30 UX成果、New／Same理由、Journey、Blueprint、品質期待および検証義務を同じ改訂版で独立レビューする → Pass後、人間の決定権限者がIAへの移行を確認・承認する | 既存10 UX-IDに対する過去レビューを新しい母集団へ流用せず、IA、並行するUI／SPECとその対応レビューを飛ばしてArchitectureまたは実装へ進まない |
| 非UIのProject Operation意味契約 | UXから生じた情報、状態、判断、Source Coverageおよび回復導線の義務を入力として、Identity、責務、Lifecycle、Relation、ProjectionおよびRepository構造の既存設計候補をIAで再照合する | Workbenchの表示・操作をArchitectureで補完せず、IA／UI／SPECの所有事項へ戻す |

DiscoveryからUXへの移行は2026-09-13に承認済みである。全36要求の分析と30 UX成果への横断統合は完了したが、統合後文書の独立再レビューおよびIA移行判断は別Gateとして維持する。両経路がArchitectureで合流した後に、既存Project Runtime／Runtime Data／Communicationとの契約差を全数照合し、ひな型、Checkerおよび実装へ進む。

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
