# 工程成果物Repository Pattern

変更ID: `CHG-000073`
状態: `Implementation In Progress`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `repository_structure_change`

## 1. 変更の目的

起点Discovery: [EXP-000011](../../../01_Discovery/Analysis/EXP-000011/exploration.md)／[EXP-000017](../../../01_Discovery/Analysis/EXP-000017/exploration.md)／`REQ-000031`／`REQ-000032`

各工程の分析過程、確定したCanonical Entity、工程全体の投影が同じRoot文書へ混在し、次工程が上流の分析を再解釈しなければならない状態を解消する。DiscoveryとUXを代表として、子Folderの一次成果物を自己完結させ、工程Rootを台帳・Coverage・Navigation・横断合成へ限定する。

## 2. 現在状態と構造変更

| 対象 | 変更前 | 変更後 |
|---|---|---|
| Discovery分析 | `Explorations/EXP-ID_Short_Name/exploration.md` | `Analysis/EXP-ID/exploration.md`。Folder名は安定IDだけ、案内名はH1と台帳が所有 |
| Discovery出力 | 要求本文と判断理由が探索記録・Root台帳へ分散 | `Definitions/REQ-ID/requirement.md`がCanonical Requirementを自己完結して所有 |
| UX分析 | `Requirements/REQ-ID/user_experience.md` | `Analysis/REQ-ID/ux_analysis.md`が要求別の一次分析を自己完結して所有 |
| UX出力 | UXの現在定義がRoot台帳と複数REQ分析へ分散 | `Definitions/UX-ID/experience.md`がCanonical UX成果を自己完結して所有 |
| 工程Root | 個別本文と工程全体像が混在し得る | `01_*`は入口・台帳・Coverage・Current State・Navigation、その他Root文書は横断合成 |
| Evidence | 工程共通の空Folderをひな型へ先置き | 必要な所有対象のID直下だけに作成。実行結果はCHG／Release Evidenceが所有 |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`01_Discovery/01_Product_Discovery.md`](<../../../01_Discovery/01_Product_Discovery.md>)
- [`01_Discovery/02_Product_Candidates.md`](<../../../01_Discovery/02_Product_Candidates.md>)
- `01_Discovery/Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000001/exploration.md`](<../../../01_Discovery/Analysis/EXP-000001/exploration.md>)
- `01_Discovery/Explorations/EXP-000002_Audit_and_Decision_Convergence/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000002/exploration.md`](<../../../01_Discovery/Analysis/EXP-000002/exploration.md>)
- `01_Discovery/Explorations/EXP-000003_External_Context_Boundaries/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000003/exploration.md`](<../../../01_Discovery/Analysis/EXP-000003/exploration.md>)
- `01_Discovery/Explorations/EXP-000004_Coordinated_AI_Execution/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000004/exploration.md`](<../../../01_Discovery/Analysis/EXP-000004/exploration.md>)
- `01_Discovery/Explorations/EXP-000005_Repository_Distributed_Tooling/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000005/exploration.md`](<../../../01_Discovery/Analysis/EXP-000005/exploration.md>)
- `01_Discovery/Explorations/EXP-000006_Agent_Guidance_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000006/exploration.md`](<../../../01_Discovery/Analysis/EXP-000006/exploration.md>)
- `01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000007/exploration.md`](<../../../01_Discovery/Analysis/EXP-000007/exploration.md>)
- `01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000008/exploration.md`](<../../../01_Discovery/Analysis/EXP-000008/exploration.md>)
- `01_Discovery/Explorations/EXP-000009_Reasoning_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000009/exploration.md`](<../../../01_Discovery/Analysis/EXP-000009/exploration.md>)
- `01_Discovery/Explorations/EXP-000010_Assurance_and_Regression/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000010/exploration.md`](<../../../01_Discovery/Analysis/EXP-000010/exploration.md>)
- `01_Discovery/Explorations/EXP-000011_Human_Readable_Documentation/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000011/exploration.md`](<../../../01_Discovery/Analysis/EXP-000011/exploration.md>)
- `01_Discovery/Explorations/EXP-000012_Recognizable_Official_Identity/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000012/exploration.md`](<../../../01_Discovery/Analysis/EXP-000012/exploration.md>)
- `01_Discovery/Explorations/EXP-000013_Execution_Intelligence/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000013/exploration.md`](<../../../01_Discovery/Analysis/EXP-000013/exploration.md>)
- `01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000014/exploration.md`](<../../../01_Discovery/Analysis/EXP-000014/exploration.md>)
- `01_Discovery/Explorations/EXP-000015_Local_MCP_HTTP_Access/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000015/exploration.md`](<../../../01_Discovery/Analysis/EXP-000015/exploration.md>)
- `01_Discovery/Explorations/EXP-000016_Runtime_Data_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000016/exploration.md`](<../../../01_Discovery/Analysis/EXP-000016/exploration.md>)
- `01_Discovery/Explorations/EXP-000017_Diagram_Guided_Handoff/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000017/exploration.md`](<../../../01_Discovery/Analysis/EXP-000017/exploration.md>)
- `01_Discovery/Explorations/EXP-000018_Work_and_Evidence_Ownership/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000018/exploration.md`](<../../../01_Discovery/Analysis/EXP-000018/exploration.md>)
- `01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000019/exploration.md`](<../../../01_Discovery/Analysis/EXP-000019/exploration.md>)
- `01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000020/exploration.md`](<../../../01_Discovery/Analysis/EXP-000020/exploration.md>)
- `01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000021/exploration.md`](<../../../01_Discovery/Analysis/EXP-000021/exploration.md>)
- `01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000022/exploration.md`](<../../../01_Discovery/Analysis/EXP-000022/exploration.md>)
- `01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000023/exploration.md`](<../../../01_Discovery/Analysis/EXP-000023/exploration.md>)
- `01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000024/exploration.md`](<../../../01_Discovery/Analysis/EXP-000024/exploration.md>)
- `01_Discovery/Explorations/EXP-000025_Repository_Capability_Discovery/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000025/exploration.md`](<../../../01_Discovery/Analysis/EXP-000025/exploration.md>)
- `01_Discovery/Explorations/EXP-000026_AI_Runtime_Changeability/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000026/exploration.md`](<../../../01_Discovery/Analysis/EXP-000026/exploration.md>)
- `01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000027/exploration.md`](<../../../01_Discovery/Analysis/EXP-000027/exploration.md>)
- `01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md`（削除または旧Path）
- [`01_Discovery/Analysis/EXP-000028/exploration.md`](<../../../01_Discovery/Analysis/EXP-000028/exploration.md>)
- [`01_Discovery/Definitions/REQ-000001/requirement.md`](<../../../01_Discovery/Definitions/REQ-000001/requirement.md>)
- [`01_Discovery/Definitions/REQ-000002/requirement.md`](<../../../01_Discovery/Definitions/REQ-000002/requirement.md>)
- [`01_Discovery/Definitions/REQ-000003/requirement.md`](<../../../01_Discovery/Definitions/REQ-000003/requirement.md>)
- [`01_Discovery/Definitions/REQ-000004/requirement.md`](<../../../01_Discovery/Definitions/REQ-000004/requirement.md>)
- [`01_Discovery/Definitions/REQ-000005/requirement.md`](<../../../01_Discovery/Definitions/REQ-000005/requirement.md>)
- [`01_Discovery/Definitions/REQ-000006/requirement.md`](<../../../01_Discovery/Definitions/REQ-000006/requirement.md>)
- [`01_Discovery/Definitions/REQ-000007/requirement.md`](<../../../01_Discovery/Definitions/REQ-000007/requirement.md>)
- [`01_Discovery/Definitions/REQ-000008/requirement.md`](<../../../01_Discovery/Definitions/REQ-000008/requirement.md>)
- [`01_Discovery/Definitions/REQ-000009/requirement.md`](<../../../01_Discovery/Definitions/REQ-000009/requirement.md>)
- [`01_Discovery/Definitions/REQ-000010/requirement.md`](<../../../01_Discovery/Definitions/REQ-000010/requirement.md>)
- [`01_Discovery/Definitions/REQ-000011/requirement.md`](<../../../01_Discovery/Definitions/REQ-000011/requirement.md>)
- [`01_Discovery/Definitions/REQ-000012/requirement.md`](<../../../01_Discovery/Definitions/REQ-000012/requirement.md>)
- [`01_Discovery/Definitions/REQ-000013/requirement.md`](<../../../01_Discovery/Definitions/REQ-000013/requirement.md>)
- [`01_Discovery/Definitions/REQ-000014/requirement.md`](<../../../01_Discovery/Definitions/REQ-000014/requirement.md>)
- [`01_Discovery/Definitions/REQ-000015/requirement.md`](<../../../01_Discovery/Definitions/REQ-000015/requirement.md>)
- [`01_Discovery/Definitions/REQ-000016/requirement.md`](<../../../01_Discovery/Definitions/REQ-000016/requirement.md>)
- [`01_Discovery/Definitions/REQ-000017/requirement.md`](<../../../01_Discovery/Definitions/REQ-000017/requirement.md>)
- [`01_Discovery/Definitions/REQ-000018/requirement.md`](<../../../01_Discovery/Definitions/REQ-000018/requirement.md>)
- [`01_Discovery/Definitions/REQ-000019/requirement.md`](<../../../01_Discovery/Definitions/REQ-000019/requirement.md>)
- [`01_Discovery/Definitions/REQ-000020/requirement.md`](<../../../01_Discovery/Definitions/REQ-000020/requirement.md>)
- [`01_Discovery/Definitions/REQ-000021/requirement.md`](<../../../01_Discovery/Definitions/REQ-000021/requirement.md>)
- [`01_Discovery/Definitions/REQ-000022/requirement.md`](<../../../01_Discovery/Definitions/REQ-000022/requirement.md>)
- [`01_Discovery/Definitions/REQ-000023/requirement.md`](<../../../01_Discovery/Definitions/REQ-000023/requirement.md>)
- [`01_Discovery/Definitions/REQ-000024/requirement.md`](<../../../01_Discovery/Definitions/REQ-000024/requirement.md>)
- [`01_Discovery/Definitions/REQ-000025/requirement.md`](<../../../01_Discovery/Definitions/REQ-000025/requirement.md>)
- [`01_Discovery/Definitions/REQ-000026/requirement.md`](<../../../01_Discovery/Definitions/REQ-000026/requirement.md>)
- [`01_Discovery/Definitions/REQ-000027/requirement.md`](<../../../01_Discovery/Definitions/REQ-000027/requirement.md>)
- [`01_Discovery/Definitions/REQ-000028/requirement.md`](<../../../01_Discovery/Definitions/REQ-000028/requirement.md>)
- [`01_Discovery/Definitions/REQ-000029/requirement.md`](<../../../01_Discovery/Definitions/REQ-000029/requirement.md>)
- [`01_Discovery/Definitions/REQ-000030/requirement.md`](<../../../01_Discovery/Definitions/REQ-000030/requirement.md>)
- [`01_Discovery/Definitions/REQ-000031/requirement.md`](<../../../01_Discovery/Definitions/REQ-000031/requirement.md>)
- [`01_Discovery/Definitions/REQ-000032/requirement.md`](<../../../01_Discovery/Definitions/REQ-000032/requirement.md>)
- [`01_Discovery/Definitions/REQ-000033/requirement.md`](<../../../01_Discovery/Definitions/REQ-000033/requirement.md>)
- [`01_Discovery/Definitions/REQ-000034/requirement.md`](<../../../01_Discovery/Definitions/REQ-000034/requirement.md>)
- [`01_Discovery/Definitions/REQ-000035/requirement.md`](<../../../01_Discovery/Definitions/REQ-000035/requirement.md>)
- [`01_Discovery/Definitions/REQ-000036/requirement.md`](<../../../01_Discovery/Definitions/REQ-000036/requirement.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`02_UX/02_Personas.md`](<../../../02_UX/02_Personas.md>)
- [`02_UX/03_Experience_Map.md`](<../../../02_UX/03_Experience_Map.md>)
- `02_UX/Requirements/REQ-000001/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000001/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000001/ux_analysis.md>)
- `02_UX/Requirements/REQ-000002/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000002/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000002/ux_analysis.md>)
- `02_UX/Requirements/REQ-000003/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000003/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000003/ux_analysis.md>)
- `02_UX/Requirements/REQ-000004/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000004/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000004/ux_analysis.md>)
- `02_UX/Requirements/REQ-000005/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000005/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000005/ux_analysis.md>)
- `02_UX/Requirements/REQ-000006/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000006/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000006/ux_analysis.md>)
- `02_UX/Requirements/REQ-000007/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000007/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000007/ux_analysis.md>)
- `02_UX/Requirements/REQ-000008/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000008/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000008/ux_analysis.md>)
- `02_UX/Requirements/REQ-000009/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000009/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000009/ux_analysis.md>)
- `02_UX/Requirements/REQ-000010/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000010/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000010/ux_analysis.md>)
- `02_UX/Requirements/REQ-000011/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000011/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000011/ux_analysis.md>)
- `02_UX/Requirements/REQ-000012/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000012/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000012/ux_analysis.md>)
- `02_UX/Requirements/REQ-000013/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000013/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000013/ux_analysis.md>)
- `02_UX/Requirements/REQ-000014/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000014/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000014/ux_analysis.md>)
- `02_UX/Requirements/REQ-000015/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000015/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000015/ux_analysis.md>)
- `02_UX/Requirements/REQ-000016/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000016/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000016/ux_analysis.md>)
- `02_UX/Requirements/REQ-000017/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000017/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000017/ux_analysis.md>)
- `02_UX/Requirements/REQ-000018/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000018/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000018/ux_analysis.md>)
- `02_UX/Requirements/REQ-000019/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000019/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000019/ux_analysis.md>)
- `02_UX/Requirements/REQ-000020/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000020/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000020/ux_analysis.md>)
- `02_UX/Requirements/REQ-000021/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000021/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000021/ux_analysis.md>)
- `02_UX/Requirements/REQ-000022/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000022/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000022/ux_analysis.md>)
- `02_UX/Requirements/REQ-000023/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000023/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000023/ux_analysis.md>)
- `02_UX/Requirements/REQ-000024/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000024/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000024/ux_analysis.md>)
- `02_UX/Requirements/REQ-000025/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000025/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000025/ux_analysis.md>)
- `02_UX/Requirements/REQ-000026/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000026/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000026/ux_analysis.md>)
- `02_UX/Requirements/REQ-000027/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000027/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000027/ux_analysis.md>)
- `02_UX/Requirements/REQ-000028/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000028/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000028/ux_analysis.md>)
- `02_UX/Requirements/REQ-000029/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000029/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000029/ux_analysis.md>)
- `02_UX/Requirements/REQ-000030/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000030/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000030/ux_analysis.md>)
- `02_UX/Requirements/REQ-000031/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000031/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000031/ux_analysis.md>)
- `02_UX/Requirements/REQ-000032/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000032/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000032/ux_analysis.md>)
- `02_UX/Requirements/REQ-000033/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000033/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000033/ux_analysis.md>)
- `02_UX/Requirements/REQ-000034/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000034/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000034/ux_analysis.md>)
- `02_UX/Requirements/REQ-000035/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000035/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000035/ux_analysis.md>)
- `02_UX/Requirements/REQ-000036/user_experience.md`（削除または旧Path）
- [`02_UX/Analysis/REQ-000036/ux_analysis.md`](<../../../02_UX/Analysis/REQ-000036/ux_analysis.md>)
- [`02_UX/Definitions/UX-000001/experience.md`](<../../../02_UX/Definitions/UX-000001/experience.md>)
- [`02_UX/Definitions/UX-000002/experience.md`](<../../../02_UX/Definitions/UX-000002/experience.md>)
- [`02_UX/Definitions/UX-000003/experience.md`](<../../../02_UX/Definitions/UX-000003/experience.md>)
- [`02_UX/Definitions/UX-000004/experience.md`](<../../../02_UX/Definitions/UX-000004/experience.md>)
- [`02_UX/Definitions/UX-000005/experience.md`](<../../../02_UX/Definitions/UX-000005/experience.md>)
- [`02_UX/Definitions/UX-000006/experience.md`](<../../../02_UX/Definitions/UX-000006/experience.md>)
- [`02_UX/Definitions/UX-000007/experience.md`](<../../../02_UX/Definitions/UX-000007/experience.md>)
- [`02_UX/Definitions/UX-000008/experience.md`](<../../../02_UX/Definitions/UX-000008/experience.md>)
- [`02_UX/Definitions/UX-000009/experience.md`](<../../../02_UX/Definitions/UX-000009/experience.md>)
- [`02_UX/Definitions/UX-000010/experience.md`](<../../../02_UX/Definitions/UX-000010/experience.md>)
- [`02_UX/Definitions/UX-000011/experience.md`](<../../../02_UX/Definitions/UX-000011/experience.md>)
- [`02_UX/Definitions/UX-000012/experience.md`](<../../../02_UX/Definitions/UX-000012/experience.md>)
- [`02_UX/Definitions/UX-000013/experience.md`](<../../../02_UX/Definitions/UX-000013/experience.md>)
- [`02_UX/Definitions/UX-000014/experience.md`](<../../../02_UX/Definitions/UX-000014/experience.md>)
- [`02_UX/Definitions/UX-000015/experience.md`](<../../../02_UX/Definitions/UX-000015/experience.md>)
- [`02_UX/Definitions/UX-000016/experience.md`](<../../../02_UX/Definitions/UX-000016/experience.md>)
- [`02_UX/Definitions/UX-000017/experience.md`](<../../../02_UX/Definitions/UX-000017/experience.md>)
- [`02_UX/Definitions/UX-000018/experience.md`](<../../../02_UX/Definitions/UX-000018/experience.md>)
- [`02_UX/Definitions/UX-000019/experience.md`](<../../../02_UX/Definitions/UX-000019/experience.md>)
- [`02_UX/Definitions/UX-000020/experience.md`](<../../../02_UX/Definitions/UX-000020/experience.md>)
- [`02_UX/Definitions/UX-000021/experience.md`](<../../../02_UX/Definitions/UX-000021/experience.md>)
- [`02_UX/Definitions/UX-000022/experience.md`](<../../../02_UX/Definitions/UX-000022/experience.md>)
- [`02_UX/Definitions/UX-000023/experience.md`](<../../../02_UX/Definitions/UX-000023/experience.md>)
- [`02_UX/Definitions/UX-000024/experience.md`](<../../../02_UX/Definitions/UX-000024/experience.md>)
- [`02_UX/Definitions/UX-000025/experience.md`](<../../../02_UX/Definitions/UX-000025/experience.md>)
- [`02_UX/Definitions/UX-000026/experience.md`](<../../../02_UX/Definitions/UX-000026/experience.md>)
- [`02_UX/Definitions/UX-000027/experience.md`](<../../../02_UX/Definitions/UX-000027/experience.md>)
- [`02_UX/Definitions/UX-000028/experience.md`](<../../../02_UX/Definitions/UX-000028/experience.md>)
- [`02_UX/Definitions/UX-000029/experience.md`](<../../../02_UX/Definitions/UX-000029/experience.md>)
- [`02_UX/Definitions/UX-000030/experience.md`](<../../../02_UX/Definitions/UX-000030/experience.md>)
- [`02_UX/Definitions/UX-000031/experience.md`](<../../../02_UX/Definitions/UX-000031/experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/artifact-signing/01_Architecture.md`](<../../../06_Architecture/artifact-signing/01_Architecture.md>)
- [`06_Architecture/version-control/01_Architecture.md`](<../../../06_Architecture/version-control/01_Architecture.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`19_Workflows/01_Coordinator_Runtime.md`](<../../../19_Workflows/01_Coordinator_Runtime.md>)
- [`19_Workflows/02_Checker.md`](<../../../19_Workflows/02_Checker.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`40_Develop/artifact-signing/package.json`](<../../../40_Develop/artifact-signing/package.json>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/coordinator/package.json`](<../../../40_Develop/coordinator/package.json>)
- [`40_Develop/execution-intelligence/package.json`](<../../../40_Develop/execution-intelligence/package.json>)
- [`40_Develop/mcp/package.json`](<../../../40_Develop/mcp/package.json>)
- [`40_Develop/project-runtime/package.json`](<../../../40_Develop/project-runtime/package.json>)
- [`40_Develop/runtime-data/package.json`](<../../../40_Develop/runtime-data/package.json>)
- [`40_Develop/version-control/package.json`](<../../../40_Develop/version-control/package.json>)
- [`99_Roadmap/01_Roadmap.md`](<../../../99_Roadmap/01_Roadmap.md>)
- [`99_Roadmap/02_Changes.md`](<../../../99_Roadmap/02_Changes.md>)
- [`99_Roadmap/Changes/CHG-000015/change.md`](<../../../99_Roadmap/Changes/CHG-000015/change.md>)
- [`99_Roadmap/Changes/CHG-000055/change.md`](<../../../99_Roadmap/Changes/CHG-000055/change.md>)
- [`99_Roadmap/Changes/CHG-000057/change.md`](<../../../99_Roadmap/Changes/CHG-000057/change.md>)
- [`99_Roadmap/Changes/CHG-000058/change.md`](<../../../99_Roadmap/Changes/CHG-000058/change.md>)
- [`99_Roadmap/Changes/CHG-000063/change.md`](<../../../99_Roadmap/Changes/CHG-000063/change.md>)
- [`99_Roadmap/Changes/CHG-000065/change.md`](<../../../99_Roadmap/Changes/CHG-000065/change.md>)
- [`99_Roadmap/Changes/CHG-000066/change.md`](<../../../99_Roadmap/Changes/CHG-000066/change.md>)
- [`99_Roadmap/Changes/CHG-000067/change.md`](<../../../99_Roadmap/Changes/CHG-000067/change.md>)
- [`99_Roadmap/Changes/CHG-000068/change.md`](<../../../99_Roadmap/Changes/CHG-000068/change.md>)
- [`99_Roadmap/Changes/CHG-000070/change.md`](<../../../99_Roadmap/Changes/CHG-000070/change.md>)
- [`99_Roadmap/Changes/CHG-000071/change.md`](<../../../99_Roadmap/Changes/CHG-000071/change.md>)
- [`99_Roadmap/Changes/CHG-000072/change.md`](<../../../99_Roadmap/Changes/CHG-000072/change.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- `template/01_Discovery/Explorations/EXP-XXXXXX_Short_Name/exploration.md`（削除または旧Path）
- [`template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md`](<../../../template/01_Discovery/Analysis/EXP-XXXXXX/exploration.md>)
- [`template/01_Discovery/Definitions/REQ-XXXXXX/requirement.md`](<../../../template/01_Discovery/Definitions/REQ-XXXXXX/requirement.md>)
- `template/01_Discovery/Evidence/.gitkeep`（削除または旧Path）
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- `template/02_UX/Requirements/REQ-XXXXXX/user_experience.md`（削除または旧Path）
- [`template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md`](<../../../template/02_UX/Analysis/REQ-XXXXXX/ux_analysis.md>)
- [`template/02_UX/Definitions/UX-XXXXXX/experience.md`](<../../../template/02_UX/Definitions/UX-XXXXXX/experience.md>)
- `template/02_UX/Evidence/.gitkeep`（削除または旧Path）
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`99_Roadmap/Changes/CHG-000073/change.md`](<../../../99_Roadmap/Changes/CHG-000073/change.md>)

</details>

## 3. 保持する意図と変更禁止範囲

- Discoveryの28探索、36要求、UXの36要求分析、31 Canonical UX成果および既存の多対多Relationを失わない。
- 子FolderのMarkdownは対象固有の意味、理由、条件、制約、関係、品質および引き渡しを参照だけへ追い出さない。
- Root文書は個別本文の第二の正本にならず、個別成果物はRoot文書を読まなければ意味が成立しないForeign Key集にしない。
- AnalysisとDefinitionを1対1に固定しない。
- IA以降とQualityのDirectoryを形式だけで先行移動せず、各工程の見直し時に正本、利用側および検証設計を再調査する。
- Development、Test asset、CommitまたはEvidenceへ、工程Patternを揃えるだけの意味の薄いGlobal IDを発行しない。

## 4. Evidence所有

```text
探索固有の根拠
→ 必要なEXPの Analysis/EXP-ID/Evidence/

再利用可能な検証設計
→ Quality

自動試験実装
→ 40_Develop

変更・Releaseで実行した結果
→ CHG／Release Evidence
```

`template/01_Discovery/Evidence/`や`template/02_UX/Evidence/`のような空の共通箱は配布しない。Evidenceがない分析・Definitionへ空Folderを作らず、別OwnerのEvidenceを複製しない。

## 5. 独立レビューと構造是正

初回独立レビューは、物理配置と台帳が揃っていても、36件のDiscovery Definitionが共通定型文中心で、Definitionだけから現在のUXを再導出できないことを検出した。この状態を文書不備ではなく、工程引渡し契約の未成立として扱う。

| 指摘 | 原因 | 構造是正 | 確認方法 |
|---|---|---|---|
| Discovery Definitionから現在のUXを再生成できない | 要求本文以外が共通定型化され、対象、状況、因果、比較、反証が欠落 | Templateと36 Definitionを、対象・利用状況、問題と変化、採用理由、成立条件、制約、検証意図、工程引渡しへ再構成 | UX成果物を伏せ、Definitionだけを別の確認者へ渡して再分析する |
| UXがDefinitionを正式入力としていない | UX AnalysisがEXPを直接参照し、Definition不足を補完できた | UXは同じREQのDefinitionだけを`分析対象`として持ち、不足時はDiscoveryへ差し戻す | EXP直接参照、別REQ参照、Definition欠落をCheckerの反例で拒否する |
| 共通定型文でもCheckerを通る | 見出しの存在だけをDefinition Readyと扱った | 要求固有Section、形成元Relation、同一Sectionの重複禁止を現行Profileへ追加 | 見出しだけ揃えた2 Definitionを反例にする |
| 分割試験が静的検査を迂回できる | Package scriptだけを直し、運用入口の順序が旧契約のままだった | `AGENTS.md`で同じ固定Commitの静的検査成功を分割試験の前提にする | Package契約試験で順序を固定する |

固定Commit `c45192b8`の独立再レビューはCritical 0、Major 4、Moderate 2だった。初回指摘の構造だけを満たしても、Definitionが所有する意味をUXへ忠実に変換できていない組と、別成果として分けたUXへ同じ体験定型を複製した箇所が残ったため、次を一つの工程引渡し閉包として是正する。

| 再レビューで判明した意味欠落 | 正しい状態 | 是正 |
|---|---|---|
| `REQ-000028`がAI入口間の共通規則・正本・判断境界ではなく、Agent間引継ぎへ置換された | 入口が異なっても同じCanonical Contextと決定境界へ到達する | `UX-000012`へ統合し、Workbench／MCP／CLI／AI入口の差を入口制約へ限定 |
| `REQ-000034`が固定Commit・配布物・Manifest・Runtimeの対応ではなく、未Commit変更とEffect authorityへ置換された | 利用者が手作業でReleaseを照合せず、同じ固定改訂版の組を利用できる | `UX-000016`へ統合し、不一致・欠落・改ざんを失敗として保持 |
| `REQ-000035`の閲覧者成果が保守者の素材権利確認へ畳まれた | 閲覧者と保守者の独立した成果を両方保持する | `UX-000031`を追加し、公式表示と署名・準拠・品質保証を混同しない成果を分離 |
| `REQ-000027`がAI／Tool送信だけへ狭まり、検索、公開Communication、管理対象依存、外部反応の昇格境界を失った | 外部利用の送信・持帰り・昇格を一つの利用者成果として扱う | `UX-000024`と要求別分析へ失われた対象と禁止する自動昇格を復元 |
| 独立したUX成果が同じGoal／重要体験を共有した | 各UX Definitionが固有の利用者、状況、Goal、Outcome、重要場面、失敗を持つ | `UX-000003`／`000004`、`000007`／`000008`を再分析し、定型複製をChecker反例化 |
| UXの正式入力境界をLink位置や見出し語だけで迂回できた | 同じREQのDefinition 1件だけを正式入力とし、EXPや別REQを補助入力にしない | 全Linkを機械検査し、意味同等性はDefinitionだけを渡す独立レビューで確認 |

固定Commit `d47c5e40`の再レビューでは、前表の意味欠落と定型複製は解消した。残ったMajor 1件・Moderate 1件は、新しい正式入力検査の記法別反証と、追加した閲覧者成果の横断Persona利用側が閉じていないことだった。

| 残った取り残し | 是正 | 反証・確認 |
|---|---|---|
| UX AnalysisのEXP参照を、別名表示または参照形式Linkで検査から迂回できる | 表示名ではなく、Markdown Linkから解決したRepository相対PathでDiscovery Definition／Analysisを分類する | 別名inline、anchor付き、reference-style、別REQ Definitionを拒否し、同じREQ Definition 1件だけを受理 |
| `UX-000031`の閲覧者が横断Personaへ未統合 | `02_Personas.md`へCRDD閲覧者のGoal、Pain、利用Context、判断責任、根拠・確信度を追加し、個別分析とDefinitionを接続 | 閲覧者と保守者を再統合せず、各成果のJourney、Outcome、Failureを独立して確認 |

固定Commit `e010e5c6`の再レビューではPersona側が解消し、意味伝播にも新しいCritical／Major／Moderateはなかった。一方、Link記法の閉集合にshortcut referenceと脚注が不足していたため、同じ正式入力境界のMajor 1件として追加是正した。Link抽出はinline、full、collapsed、shortcut reference、脚注を解決後Pathへ統一し、Source Analysisと別REQ Definitionの両方で記法別反例を持つ。

その後の人間確認では、意味と構造が揃っていても、Discovery／UXの見出し、表および図へ`Goal`、`Outcome`、`Persona`、`Journey`、`Service Blueprint`、`Coverage`等が繰り返され、非エンジニア／非デザイナーが本文だけから大意をつかみにくいことが分かった。用語集への登録と人間向けの分かりやすさを別に扱い、次を同じ変更範囲で是正する。

| 取り残し | 原因 | 正しい状態 | 確認方法 |
|---|---|---|---|
| 正式用語が人間向け表示へそのまま流入する | 用語集掲載語や正式表示名を可読性の根拠にできた | 用語集なしでも、非専門家が誰の何が問題で何を変えるかを説明できる | Discovery／UXを非専門家の読者像で独立レビューする |
| ひな型が英語の見出し・表・図ラベルを要求する | 工程契約と表示契約を分けていなかった | 人間向け表示は常用的な日本語、ID・技術名称・状態実値は原文を維持する | ひな型と実成果物の同じ表示項目を照合する |
| 工程名まで説明語と同じように和訳する | 正式な工程名と、人間向けの説明語を区別していなかった | `Discovery`、`UX`、`IA`、`UI`、`SPEC`、`Architecture`、`Development`、`Verification`、`Release`は正式名を維持し、必要な場合だけ初出へ短い日本語説明を添える | 現行成果物、ひな型、Checkerの要求文字列から旧和訳を検索し、正式名へ統一する |
| `探索記録`、`要求定義`等の成果物種別だけでは所有工程を判別できない | Folder位置を読めば工程が分かる前提で、工程と成果物の役割を別々に表していた | `Discovery分析`、`Discovery定義`、`UX分析`、`UX定義`のように、正式工程名と役割を一つの表示へ揃える | 既存成果物、ひな型、Checkerおよび契約試験で旧表示を拒否し、新表示を全数確認する |
| Checkerが旧英語ラベルを完成条件にする | 表層語を工程構造の識別子として固定した | 日本語の構造ラベルを検査し、内容の分かりやすさは独立レビューへ残す | 旧ラベルだけの成果物を反例にし、新ラベルの完全な成果物を受理する |

固定Commit `e41e4af5`の独立レビューでは、Critical 0の一方で、3レビューを合わせてMajor 5、Moderate 7が残った。件数は重複を含むため、次の4クラスタへ統合して是正する。

| 指摘クラスタ | 原因 | 正しい状態 | 構造是正 |
|---|---|---|---|
| `Same`判断の根拠が比較不能 | 一部の関係が長い説明または短い結論だけで、既存UXと現在要求の差を同じ軸で確認できなかった | 22件すべてで担い手、利用のきっかけ、得られる結果、避ける失敗を両側と差に分ける | 15分析文書の22関係へ4軸比較を追加し、Checkerは構造だけ、意味の同一性は独立レビューが確認する |
| DiscoveryからUXを再構築する意味が不足 | 一部の探索・要求で、誰がどの状況で何に困るか、委譲時に人間が何を渡すか、閲覧者に何が起きるかが薄かった | UXを伏せても利用者、状況、問題、望ましい変化、制約を再構成できる | 7探索の問題背景、`REQ-000003`の委譲境界、`REQ-000031`／`000032`の閲覧者を要求側へ補う |
| 平易化が正式契約を壊した | 一括置換が工程名、状態実値、技術境界およびEffectの意味まで和訳・縮小した | 人間向け説明は平易にしつつ、正式工程名、状態実値、安定技術名と安全境界を保持する | テンプレートの正式状態・工程名を復元し、Effect、Project Runtime、Application Core等は平易な説明を初出へ添える |
| Checkerが意味判断を代行した | 文字数、一般括弧、本文の完全一致を内容品質の証明に使った | Checkerは構造、ID、Path、関係、網羅範囲だけを決定論的に検査し、意味は独立レビューで反証する | 文字数と意味重複判定を削除し、限定Placeholderと`Same`4軸の存在だけを検査する |

固定Commit `90fdc12`の再レビューでは、平易化と4軸比較の構造は改善したが、比較対象となる既存UXを先に拡張してから`Same`を判断したため、根拠が循環する問題が残った。また、3件の関係は元のDiscovery定義では支えられず、正式状態値と正式入力検査にも取り残しがあった。3レビューの結果を一括し、次の工程間引き渡し是正として扱う。

| 残った問題 | 正しい状態 | 是正・反証 |
|---|---|---|
| `Same`比較が拡張後のUXを根拠にする | 各UXを最初に`New`とした要求分析の担い手・利用のきっかけ・成果・失敗を比較基準にする | 残る19関係を元の定義軸へ戻して再比較し、成立後にだけCanonical UXへ追加の担い手・場面を統合 |
| 3関係が上流定義で支えられない | `REQ-000003→UX-000004`、`REQ-000006→UX-000008`、`REQ-000009→UX-000009`だけを解除し、他の成立する関係を維持する | UX台帳、要求分析、UX定義の三方向を同時更新し、Relation Closureで反証 |
| Discovery分析の意味をUXが暗黙に補完する | UXは同じREQのDiscovery定義だけを正式入力にし、不足する再試行・回復・失敗位置・外部作用発行の意味はDiscovery定義へ戻す | `REQ-000003`／`REQ-000006`を先に補い、33分析の根拠表示を正式入力へ統一 |
| 正式状態値が翻訳される | UX定義の状態は`Canonical`／`Superseded`の閉集合を維持する | 31定義を`Canonical`へ戻し、翻訳状態の反例試験を追加 |
| 正式入力検査をHTMLまたは明示Pathで迂回できる | Markdown、HTML、本文・inline codeの明示Pathを同じ解決済みPathとして扱う | ルート外・不正符号化は根拠へ昇格せず安全に拒否し、コメントとcode fence内の例示は入力扱いしない |
| Checkerに題材固有の文章拒否が残る | Checkerは特定の意味文章でなく、構造・ID・Path・関係・網羅範囲を検査する | 題材固有の文字列拒否を削除し、意味の妥当性は独立レビューへ維持 |

再レビューの合格条件は、文面の自然さやリンク数ではない。主要な利用者、発生状況、問題、望ましい変化、独立したOutcome候補、重要な失敗および品質期待がDefinitionだけから再導出でき、現在のUXとの差を情報欠落または正当な再分析として説明できることである。

`90fdc12`後の3レビューで残った指摘は、同じ変更単位として是正した。解除した3関係は正式関係表だけでなく人間向けの統合図からも除去した。残る19件の`Same`関係は、各UXを最初に`New`とした要求分析のUX固有記載を第一根拠とし、同時点のDefinitionは同名軸の照合にだけ使う。後続要求が補った利用者、場面、成立条件、失敗および検証意図はCanonical Definitionへ保持するが、中心成果と比較元を上書きしない。正式入力検査はCommonMarkのLink、HTML、本文Path、絶対Pathを同じ境界で扱い、コメント、code fenceおよびエスケープされた例示を入力へ昇格しない。UX状態、責任境界節と表、およびRelation図と表の一致は、表層の件数ではなく閉じた構造として反証する。

この是正後の再レビューは、比較元を初版Definitionの要求全体値へ逆転させたこと、上流へ戻した2要求の意味をUXへ再伝播していないこと、HTML entityと責任境界の重複節に反証漏れがあることを検出した。監査間で次の一次キーへ合意し、関係やIDを先決せず再是正した。

| 再レビューで残った問題 | 固定した境界 | 是正・反証 |
|---|---|---|
| 19件の比較元が混在 | 最初の`New`要求分析のUX固有値を第一根拠とし、同時点Definitionは照合に限定する | 19件すべてへ比較元を明示し、UX固有成果と最初の要求が示した失敗へ再固定。Definition内の利用者成果、図、表、重要体験も同じ中心成果へ統一 |
| 後続条件が中心成果を上書き | `Same`成立後の追加は利用者、場面、成立条件、失敗、検証意図として保持し、中心成果を置換しない | 該当Definitionへ統合後の条件境界を明示し、元の要求分析との関係を維持 |
| `REQ-000003`の次行動の区別が下流で弱まる | UX-000003は現在状態から再試行・回復・再開を選ぶ意味、UX-000005は同じ目的・節目・判断点へ戻る意味を担う | 要求分析、両Definitionの必要情報、成立条件、検証意図、下流引渡しへ重複なく伝播。解除済みUX-000004は戻さない |
| `REQ-000006`の失敗診断が下流で弱まる | UX-000012の入口同値性を判断する情報として、通信方式、失敗位置、外部作用の発行有無を保持する | 要求分析とDefinitionの成立条件、必要情報、検証意図、下流引渡しへ伝播し、UX-000008の故障影響範囲へ再拡張しない |
| HTML entityと相対Pathで正式入力境界を迂回できる | 一回だけ復号し、未知・過大・surrogate・不完全・二重entityを例外終了させず拒否する | path関連named／numeric entity、先頭`./`、不正entityの反例を追加 |
| 責任表だけ数えて重複節を見逃す | 責任境界節が1件、その節直後の表が1件、正式見出しが1件であることを同時に確認する | 別見出しの第二表を置いた反例を追加 |

fingerprint `2bfd0a6a8b64b1681d195abf0489e4ec4963a964`の3レビューでは、前表の構造反証は成立した一方、要求固有の意味をCanonical UXへ統合する単位と、正式入力Pathの復号後判定に取り残しがあることを検出した。指摘を個別の文面修正へ分解せず、次の工程間変換クラスタとして一括是正した。

| 再レビューで残った問題 | 固定した境界 | 是正・反証 |
|---|---|---|
| `REQ-000006`の最初の成果が後続要求を先取りした | 最初の`New`はstdio MCPとlocalhost HTTPの意味同値だけを所有し、Workbench／CLI／複数AI入口は後続要求の追加条件とする | `UX-000012`の中心成果をREQ-000006へ戻し、REQ-000010／000028の追加場面を別表で保持 |
| 一部の`Same`比較が要求全体または拡張後Definitionを比較元にした | 最初の`New`要求分析にあるUX固有成果と、その正式入力であるDiscovery定義から4軸を固定する。不整合がある初版UX定義を不足軸の補完に使わない | 該当する比較の担い手、利用のきっかけ、得られる結果、避ける失敗を上流から再導出し、残る18件を非循環の根拠契約へ統一 |
| `UX-000008`の最初の要求所有者が誤っていた | AI実行環境ごとの故障境界と利用可能範囲は`REQ-000023`が最初に定義し、`REQ-000005`からは導出しない | `REQ-000005→UX-000008`を解除し、`REQ-000023→UX-000008`を`New`へ変更。要求分析、台帳、Definitionを同時更新 |
| 後続要求の追加条件が定型文または空だった | 中心成果を変えず、各後続要求が追加した場面、条件、失敗、検証意図を要求別に特定する | `Same`を受ける13 Definitionへ要求固有の追加条件を記載し、owner修正後に後続`Same`がないUX-000008を加えた計14 Definitionで状態を明示 |
| UX-000002／000003／000009で副次的な行動が消えた | 中心成果とは分けたまま、入力、待機、取消、回復、再試行、次判断のための情報を成立条件と下流引渡しへ保持する | 3 Definitionへ副次行動を復元し、新しい独立UXへ分割しない |
| 正式入力HeaderとPath候補が別々に成立し得た | コメントとcode fenceを除いた可視本文で、唯一の`分析対象:` Header自身が同じREQ Definitionを指す場合だけ正式入力とする | コメント／両fence内だけのHeaderと本文別位置Linkを拒否し、可視Headerと例示内重複は受理する反例を追加 |
| Markdown／HTML／本文Pathで復号処理が分かれ、通常文やエスケープ例をPathと誤認し得た | すべての実候補を一回だけ同じ復号器へ通し、不正entityを連続したDiscovery Path骨格がある場合だけ上位判定へ伝える | inline、full、collapsed、shortcut、footnote、HTML quoted／unquoted、本文Path、二重符号化、良性本文、literal／entity escapeの反例を同じ契約試験へ追加 |

fingerprint `44bffff8c93cab099272bc1648749cf9682603e7`の3レビューでは、Discovery／UXの意味伝播と関係は維持できていたが、エスケープ済み区切りを含む一つの文字列全体を除外すると、その後に独立して始まる有効なDiscovery参照まで見逃せることを検出した。Checkerは文字列全体を早期除外せず、参照開始候補ごとにエスケープ済み区切りとの連続性を判定する。区切りをエスケープした同じPathの例示は入力へ昇格させず、カンマやコロンの後に独立して始まる有効な参照は検査する正負反例を追加した。Discovery／UX本文、ID、関係およびIA以降は変更していない。

次の固定候補では、参照開始と境界を復号前の文字列で別々に探すと、数値entityで表した`01`やコロンを見逃せることを検出した。escaped spanだけを識別子へ置き換えた後、同じ一回復号結果から参照開始とPath連続性を判定し、その結果を再復号せず正式入力検査へ渡す形に統一した。decimal／hexadecimalのroot、numeric／unknown entityの境界、numeric slashで継続する同一Path、および従来の非発火例を同じ試験で反証する。

## 6. 完了条件

| Gate | 完了条件 |
|---|---|
| Structure | Discovery 28 Analysis／36 Definitions、UX 36 Analysis／31 DefinitionsがCanonical配置にある |
| Self-contained | 子成果物が対象固有の意味、成立条件、関係および下流入力を単独で説明できる |
| Downstream Reproducibility | `Definitions/REQ-*`を下流入力として、現在のUX分析、Canonical UX、関係、重要な失敗および品質期待を情報劣化なく再構成できる |
| Projection | Discovery／UX Rootから全Analysis・DefinitionとCoverageを一意に辿れる |
| Consumer Closure | 正本文書、ひな型、Checker、CHG、RoadmapおよびArchitecture参照が新Pathへ移行する |
| Regression | 全体Checker、Checker契約試験、旧Root／共通Evidence再導入の反証がPassする |
| Independent Review | 文書、準拠、Gap／ImpactのCritical／Major／Moderateが0になる |

## 7. 現在の検証

| 確認 | 結果 |
|---|---|
| Discovery Analysis／Definition | 28／36 |
| UX Analysis／Definition | 36／31 |
| 全体Checker | `errors: 0`、`warnings: 0` |
| Checker契約試験 | 293／293 Pass。全CommonMark参照形式、HTML quoted／unquoted、本文・絶対Pathを同じ一回復号へ通し、path関連named／numeric entity、未知・範囲外・surrogate・不完全・二重entityによる正式入力迂回と、責任境界の重複節を反証済み。正式入力Headerは可視本文のHeader自身へ結合し、通常文、コメント、code fenceおよびエスケープされた例示は正式入力へ昇格しない。意味妥当性は独立レビューへ分離 |
| 全回帰入口 | `npm test --prefix 40_Develop/checker`がFormatter確認→型検査→Lint→Repository Checker→試験本体の順で完走 |
| 全TypeScript package静的入口 | 8／8 Pass。Formatter確認→型検査→Lintの順序と、該当package固有の静的契約検査を確認 |
| 独立再レビュー | fingerprint `85ebdabbbc890505ee760a9aee96c83fc2e14231`を3者が読取り専用で確認し、Critical 0／Major 0／Moderate 0でPass。Discovery DefinitionだけからのUX再構築、意味境界、関係、正式入力Path検査の正負例を確認 |

固定Commit `d53875d8`までの工程間意味伝播は一度Passしたが、その後の人間向け表示契約と`Same`関係の具体化で新しい引き渡し不備が露出した。最終候補は18件の`Same`関係、`Same`を受ける13 DefinitionとUX-000008を合わせた14 Definitionの追加条件区画、UX-000008の正式な要求所有者、正式入力Headerと対象Pathの結合、およびescaped spanを保持した一回復号まで是正した。全293件の回帰と3者の独立再レビューがPassし、Discovery／UXの工程間引き渡しはIAへ移行できる状態になった。現在、人間による追加判断は必要ない。
