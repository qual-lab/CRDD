# 変更トレース: v0.20.1 リリース状態伝播

変更ID: `CHG-000069`
状態: `Ready for Release Handoff`
担当責任者: Qual-Lab
対象版: `v0.20.1`
収載対象: `v0.20.1`
変更分類: `corrective`
最終更新日: 2026-09-12

## 1. 結論

v0.20.0は、署名済み4経路E2E、Recovery Matrixおよび最終監査を完了して2026-09-11に公式tagへ収載した。一方、候補から公開済み状態へ移す機械的な文書遷移を実行しないまま統合・tag作成へ進んだため、公開tag内の正本、README、CHANGELOG、Quality Center、Tool文書、CHGおよびRoadmapに候補表示が残った。

v0.20.1は、この公開状態の利用側伝播漏れを正し、Stableな最終候補に候補表示が残る状態をCheckerで拒否する。変更対象はRelease Identity、文書、Checkerおよびその契約試験であり、Runtime実行集合、署名manifest、Native成果物、PolicyおよびSchemaは変更しない。

## 2. 原因と構造是正

| 項目 | v0.20.0で起きたこと | v0.20.1の是正 |
|---|---|---|
| 状態遷移 | Commit Cの許可Pathと遷移内容は記述したが、実行完了を統合前Gateにしなかった | Stable化後の全利用側閉包を通常Checkerで検査する |
| 利用側集合 | 手書きのexact Path一覧に依存し、CHG-000065等の取り残しがあった | 現行Markdownの先頭表示から候補残存を自動導出する |
| 公開案内 | READMEと英日CHANGELOGを個別に確認した | 正本版、README版、英日の日付付きRelease見出しを相関検査する |
| 変更トレース | CHGの公開状態がRelease判断待ちのまま残った | v0.20.0対象CHGを公式tagと公開日へ接続する |
| Roadmap | 完了したv0.20作業が未完了登録簿に残った | 完了根拠へ移し、v0.21以降だけを残す |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`00_Overview.md`](<../../../00_Overview.md>)
- [`01_Principles.md`](<../../../01_Principles.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`04_Agent_Organization.md`](<../../../04_Agent_Organization.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_Autonomous_Operation.md`](<../../../05_Autonomous_Operation.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- [`06_Architecture/Details/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/Details/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/Details/mcp/01_Architecture.md`](<../../../06_Architecture/Details/mcp/01_Architecture.md>)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](<../../../06_Architecture/Details/platform-access/01_Architecture.md>)
- [`06_Architecture/Details/project-runtime/01_Architecture.md`](<../../../06_Architecture/Details/project-runtime/01_Architecture.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- `07_Quality/07_Structured_Document_Disposition_Inventory.json`（削除または旧Path）
- [`10_Agent.md`](<../../../10_Agent.md>)
- [`11_Skill.md`](<../../../11_Skill.md>)
- [`12_Change.md`](<../../../12_Change.md>)
- [`13_Release.md`](<../../../13_Release.md>)
- [`14_Workflow.md`](<../../../14_Workflow.md>)
- [`15_Progress.md`](<../../../15_Progress.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`17_Communication.md`](<../../../17_Communication.md>)
- [`18_Context_Dependency.md`](<../../../18_Context_Dependency.md>)
- [`19_Maintenance.md`](<../../../19_Maintenance.md>)
- [`19_Workflows/01_Coordinator_Runtime.md`](<../../../19_Workflows/01_Coordinator_Runtime.md>)
- [`19_Workflows/04_MCP_Server.md`](<../../../19_Workflows/04_MCP_Server.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`28_Implementation.md`](<../../../28_Implementation.md>)
- [`29_Verification.md`](<../../../29_Verification.md>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- `40_Develop/checker/scripts/update-document-disposition-inventory.ts`（削除または旧Path）
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/checker/tsconfig.json`](<../../../40_Develop/checker/tsconfig.json>)
- [`51_Document_Audit.md`](<../../../51_Document_Audit.md>)
- [`52_Conformance_Audit.md`](<../../../52_Conformance_Audit.md>)
- [`53_Gap_Impact_Audit.md`](<../../../53_Gap_Impact_Audit.md>)
- `90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md`（削除または旧Path）
- `90_Release/Changes/CHG-000062_Execution_Intelligence.md`（削除または旧Path）
- `90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md`（削除または旧Path）
- `90_Release/Changes/CHG-000065_Structured_First_Documentation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000069_V0201_Release_State_Propagation.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000069/change.md`](<../../../99_Roadmap/Changes/CHG-000069/change.md>)
- [`CHANGELOG.md`](<../../../CHANGELOG.md>)
- [`README.md`](<../../../README.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)

</details>

## 3. 完成条件

- 全CRDD正本が`Version: v0.20.1`かつ`Status: Stable`である。
- 現行Markdownの先頭表示にv0.20.1の`Candidate`が残らない。
- READMEがv0.20.1を候補表現なしで示す。
- CHANGELOGの英日両区分がv0.20.1とv0.20.0の公開日を示す。
- v0.20.0対象CHGが`Released`と公式tagへ接続される。
- Roadmapに完了済みv0.20作業が残らない。
- Runtime実行Identityがv0.20.0から変わらないことを差分分類で確認する。

`Ready for Release Handoff`は変更内容とリリースメタデータが統合へ渡せることを示し、公開済みを意味しない。v0.20.1の公開状態は、この変更を含むCommitを公式`v0.20.1` tagが参照した場合だけ成立する。

## 4. 変更しない範囲

- Runtime code、Native成果物、Policy、Schemaおよび署名manifest
- v0.20.0の公式tag、Commitおよび署名済みEvidence
- v0.20.0で成立したCapabilityと未評価範囲
- v0.21以降の機能範囲、順序および採否

## 5. 検証

Repository全体Checker、Checker契約試験、FormatterおよびGit差分検査を実行する。Runtime実行集合が不変であるため、再署名、Provider E2EおよびRecovery Matrixは再実行しない。
