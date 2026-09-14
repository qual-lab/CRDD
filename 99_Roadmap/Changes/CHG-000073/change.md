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
- [`03_Documentation.md`](<../../../03_Documentation.md>)
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

- Discoveryの28探索、36要求、UXの36要求分析、30 Canonical UX成果および既存の多対多Relationを失わない。
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

## 5. 完了条件

| Gate | 完了条件 |
|---|---|
| Structure | Discovery 28 Analysis／36 Definitions、UX 36 Analysis／30 DefinitionsがCanonical配置にある |
| Self-contained | 子成果物が対象固有の意味、成立条件、関係および下流入力を単独で説明できる |
| Downstream Reproducibility | `Definitions/REQ-*`を下流入力として、現在のUX分析、Canonical UX、関係、重要な失敗および品質期待を情報劣化なく再構成できる |
| Projection | Discovery／UX Rootから全Analysis・DefinitionとCoverageを一意に辿れる |
| Consumer Closure | 正本文書、ひな型、Checker、CHG、RoadmapおよびArchitecture参照が新Pathへ移行する |
| Regression | 全体Checker、Checker契約試験、旧Root／共通Evidence再導入の反証がPassする |
| Independent Review | 文書、準拠、Gap／ImpactのCritical／Major／Moderateが0になる |

## 6. 現在の検証

| 確認 | 結果 |
|---|---|
| Discovery Analysis／Definition | 28／36 |
| UX Analysis／Definition | 36／30 |
| 全体Checker | `errors: 0`、`warnings: 0` |
| Checker契約試験 | 277／277 Pass。Discovery／UXの空の共通Evidence Root再導入と、全CRDD所有TypeScript packageの静的検査先行を反証済み |
| 全回帰入口 | `npm test --prefix 40_Develop/checker`がFormatter確認→型検査→Lint→Repository Checker→試験本体の順で完走 |
| 全TypeScript package静的入口 | 8／8 Pass。Formatter確認→型検査→Lintの順序と、該当package固有の静的契約検査を確認 |

現在、人間による追加判断は必要ない。独立レビュー前に影響ファイル一覧、Checker追加試験、全リンクおよび工程間Relationを固定する。
