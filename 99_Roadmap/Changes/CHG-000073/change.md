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
| UX分析 | `Requirements/REQ-ID/user_experience.md` | `Analysis/REQ-ID/ux_analysis.md`が要求別の一次分析を自己完結して所有する。現行6章の物語順を維持し、利用者、前後の変化、重要場面、失敗、品質期待、未確認事項および可視Checklistを同じ成果物で閉じる |
| UX出力 | UXの現在定義がRoot台帳と複数REQ分析へ分散 | `Definitions/UX-ID/ux_definition.md`がCanonical UX成果を自己完結して所有する。複数REQを統合する場合も各REQの未確認事項を失わない。直後工程IA、伴走するQuality Analysis / UX、IA完了後にUI／SPECが保持するContract Relationを区別し、UXからArchitectureへ直接引き渡さない |
| IA分析 | 既存文書と実装から情報構造を後追いで説明 | 32件のUX定義を一件ずつ`Analysis/UX-ID/ia_analysis.md`で分析し、現行文書・実装の棚卸結果と別経路で照合 |
| IA出力 | 単一Root文書へ情報対象、関係、導線、状態、下流義務が混在 | 22件の`Definitions/IA-ID/ia_definition.md`を現在有効な情報契約とし、Root文書は台帳と横断図だけを投影。実行基盤の故障範囲、過去判断・現在意図、実行記録の作成・公開状態は別の利用者判断として独立させる |
| UI分析 | 単一文書がUX、IA、現行実装および過去の操作契約を混在して説明 | 31件の`Analysis/UX-ID/ui_analysis.md`が利用者成果・操作・Feedbackを、21件の`Analysis/IA-ID/ui_analysis.md`が情報・状態・関係・可視性・導線を別々に全数分析する。相手側の不足を暗黙に補完せず、UI定義で初めて統合する |
| UI出力 | 現行操作、将来Workbench候補、表示品質、UI／SPEC対応が単一Root文書に混在 | 19件の`Definitions/UI-ID/ui_definition.md`へ独立した利用者Interface契約を統合し、Root文書は台帳・Coverage・Navigation、横断文書は表示面・状態・視覚方針・SPEC引渡し、現行実装は別参照へ分ける |
| SPEC分析 | 単一文書がUX成果、IA構造、現行実装、UI対応および振る舞い詳細を混在して説明 | 31件の`Analysis/UX-ID/spec_analysis.md`と21件の`Analysis/IA-ID/spec_analysis.md`で正式入力を別々に分析し、REQ・相手観点・現行実装から不足を補完しない |
| SPEC出力 | 巨大な単一Root文書が現在有効な振る舞い、旧経緯、横断図および現行実装参照を所有 | 29件の`Definitions/SPEC-ID/spec_definition.md`へ独立した観測可能な振る舞い契約を統合し、Root文書は台帳・Coverage・横断図、現行実装との照合は`07_Current_Behavior_Reference.md`へ分ける。読取りは`SPEC-000008`、異なる実行基盤・ApplicationからのCanonical記録と不変公開は`SPEC-000030`としてAuthority・Effect・失敗境界を分ける。外部送信、結果帰還、候補昇格、再接続、取消、判断返却も、Authority・副作用・入力UXが異なるため分割する |
| UI／SPEC入力境界 | 下流工程がREQを直接読み、UX／IAの不足を暗黙に補完し得る | UIとSPECはUX＋IAを共通の正式入力として別々に分析する。REQはUXより上流の追跡情報に限定し、不足時はUXまたはIAを再開する |
| Architecture分析 | 現行部品設計と実装を先に読み、上流の利用者Interfaceや振る舞いを後追いで説明し得る | 20件のUI定義と29件のSPEC定義を正式入力として別々に全数分析する。REQ、UX、IA、現行Architectureおよび実装から不足を補完しない |
| Architecture出力 | Rootの全体設計とTool別設計が増築され、UI／SPECから各責務へ至る判断が追えない | 同じ上位責務境界に属する入力を18件の`Definitions/ARCH-ID/architecture_definition.md`へ基本設計として統合する。読取りProjectionは`ARCH-000007`、Canonical記録と不変公開は`ARCH-000018`として分離する。State Owner、Authority、Effect、失敗領域またはlifecycleが異なる入力はSibling blockとして保つ。5横断モデルの後、`Details/`で実装可能な詳細設計へ具体化し、多対多対応表、Applicability、Engineering Concern、Quality引渡し、Reality Audit境界を保持する |
| Quality分析・定義 | 巨大な検証設計文書と既存試験一覧から、検証すべき意味を逆算しやすい | REQ 36、UX 32、IA 22、UI 20、SPEC 29、ARCH 18の計157 Canonical IDをQuality Analysis Mappingで一行以上処置する。個別処置をID別MDと同一視せず、検証義務を`Same／New／Merge`で13検証目標へ統合する。`Source ID → 検証目標 → 試験段階 → Local Item`と`Architecture詳細設計領域 → 検証目標`をMapping・Definition間で完全一致させる。複数目標を持つSourceの試験段階は各目標へ一律適用せず、目標別段階の和集合として保持する。検証目標を試験段階別に物理分割せず、各定義内でUT／IT／ST／UATの適用と、外部境界の直接・隣接1 block・関連2 blocks・System／E2E・利用者受入への段階到達を判断する。既存実装・試験との対応は後続のReality Auditとして分離する |
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
- [`02_UX/Definitions/UX-000001/ux_definition.md`](<../../../02_UX/Definitions/UX-000001/ux_definition.md>)
- [`02_UX/Definitions/UX-000002/ux_definition.md`](<../../../02_UX/Definitions/UX-000002/ux_definition.md>)
- [`02_UX/Definitions/UX-000003/ux_definition.md`](<../../../02_UX/Definitions/UX-000003/ux_definition.md>)
- [`02_UX/Definitions/UX-000004/ux_definition.md`](<../../../02_UX/Definitions/UX-000004/ux_definition.md>)
- [`02_UX/Definitions/UX-000005/ux_definition.md`](<../../../02_UX/Definitions/UX-000005/ux_definition.md>)
- [`02_UX/Definitions/UX-000006/ux_definition.md`](<../../../02_UX/Definitions/UX-000006/ux_definition.md>)
- [`02_UX/Definitions/UX-000007/ux_definition.md`](<../../../02_UX/Definitions/UX-000007/ux_definition.md>)
- [`02_UX/Definitions/UX-000008/ux_definition.md`](<../../../02_UX/Definitions/UX-000008/ux_definition.md>)
- [`02_UX/Definitions/UX-000009/ux_definition.md`](<../../../02_UX/Definitions/UX-000009/ux_definition.md>)
- [`02_UX/Definitions/UX-000010/ux_definition.md`](<../../../02_UX/Definitions/UX-000010/ux_definition.md>)
- [`02_UX/Definitions/UX-000011/ux_definition.md`](<../../../02_UX/Definitions/UX-000011/ux_definition.md>)
- [`02_UX/Definitions/UX-000012/ux_definition.md`](<../../../02_UX/Definitions/UX-000012/ux_definition.md>)
- [`02_UX/Definitions/UX-000013/ux_definition.md`](<../../../02_UX/Definitions/UX-000013/ux_definition.md>)
- [`02_UX/Definitions/UX-000014/ux_definition.md`](<../../../02_UX/Definitions/UX-000014/ux_definition.md>)
- [`02_UX/Definitions/UX-000015/ux_definition.md`](<../../../02_UX/Definitions/UX-000015/ux_definition.md>)
- [`02_UX/Definitions/UX-000016/ux_definition.md`](<../../../02_UX/Definitions/UX-000016/ux_definition.md>)
- [`02_UX/Definitions/UX-000017/ux_definition.md`](<../../../02_UX/Definitions/UX-000017/ux_definition.md>)
- [`02_UX/Definitions/UX-000018/ux_definition.md`](<../../../02_UX/Definitions/UX-000018/ux_definition.md>)
- [`02_UX/Definitions/UX-000019/ux_definition.md`](<../../../02_UX/Definitions/UX-000019/ux_definition.md>)
- [`02_UX/Definitions/UX-000020/ux_definition.md`](<../../../02_UX/Definitions/UX-000020/ux_definition.md>)
- [`02_UX/Definitions/UX-000021/ux_definition.md`](<../../../02_UX/Definitions/UX-000021/ux_definition.md>)
- [`02_UX/Definitions/UX-000022/ux_definition.md`](<../../../02_UX/Definitions/UX-000022/ux_definition.md>)
- [`02_UX/Definitions/UX-000023/ux_definition.md`](<../../../02_UX/Definitions/UX-000023/ux_definition.md>)
- [`02_UX/Definitions/UX-000024/ux_definition.md`](<../../../02_UX/Definitions/UX-000024/ux_definition.md>)
- [`02_UX/Definitions/UX-000025/ux_definition.md`](<../../../02_UX/Definitions/UX-000025/ux_definition.md>)
- [`02_UX/Definitions/UX-000026/ux_definition.md`](<../../../02_UX/Definitions/UX-000026/ux_definition.md>)
- [`02_UX/Definitions/UX-000027/ux_definition.md`](<../../../02_UX/Definitions/UX-000027/ux_definition.md>)
- [`02_UX/Definitions/UX-000028/ux_definition.md`](<../../../02_UX/Definitions/UX-000028/ux_definition.md>)
- [`02_UX/Definitions/UX-000029/ux_definition.md`](<../../../02_UX/Definitions/UX-000029/ux_definition.md>)
- [`02_UX/Definitions/UX-000030/ux_definition.md`](<../../../02_UX/Definitions/UX-000030/ux_definition.md>)
- [`02_UX/Definitions/UX-000031/ux_definition.md`](<../../../02_UX/Definitions/UX-000031/ux_definition.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/Details/artifact-signing/01_Architecture.md`](<../../../06_Architecture/Details/artifact-signing/01_Architecture.md>)
- [`06_Architecture/Details/version-control/01_Architecture.md`](<../../../06_Architecture/Details/version-control/01_Architecture.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`19_Workflows/01_Coordinator_Runtime.md`](<../../../19_Workflows/01_Coordinator_Runtime.md>)
- [`19_Workflows/02_Checker.md`](<../../../19_Workflows/02_Checker.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`40_Develop/artifact-signing/package.json`](<../../../40_Develop/artifact-signing/package.json>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`02_UX/Definitions/UX-000032/ux_definition.md`](<../../../02_UX/Definitions/UX-000032/ux_definition.md>)
- [`03_IA/Analysis/UX-000032/ia_analysis.md`](<../../../03_IA/Analysis/UX-000032/ia_analysis.md>)
- [`03_IA/Definitions/IA-000022/ia_definition.md`](<../../../03_IA/Definitions/IA-000022/ia_definition.md>)
- [`04_UI/Analysis/UX-000032/ui_analysis.md`](<../../../04_UI/Analysis/UX-000032/ui_analysis.md>)
- [`04_UI/Analysis/IA-000022/ui_analysis.md`](<../../../04_UI/Analysis/IA-000022/ui_analysis.md>)
- [`04_UI/Definitions/UI-000020/ui_definition.md`](<../../../04_UI/Definitions/UI-000020/ui_definition.md>)
- [`05_SPEC/Analysis/UX-000032/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000032/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000022/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000022/spec_analysis.md>)
- [`06_Architecture/Analysis/UI-000020/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000020/architecture_analysis.md>)
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
- [`template/02_UX/Definitions/UX-XXXXXX/ux_definition.md`](<../../../template/02_UX/Definitions/UX-XXXXXX/ux_definition.md>)
- `template/02_UX/Evidence/.gitkeep`（削除または旧Path）
- `02_UX/Definitions/UX-000001/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000002/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000003/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000004/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000005/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000006/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000007/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000008/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000009/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000010/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000011/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000012/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000013/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000014/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000015/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000016/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000017/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000018/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000019/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000020/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000021/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000022/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000023/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000024/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000025/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000026/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000027/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000028/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000029/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000030/experience.md`（削除または旧Path）
- `02_UX/Definitions/UX-000031/experience.md`（削除または旧Path）
- [`03_IA/01_Information_Architecture.md`](<../../../03_IA/01_Information_Architecture.md>)
- [`03_IA/02_Object_and_Relation_Model.md`](<../../../03_IA/02_Object_and_Relation_Model.md>)
- [`03_IA/03_Information_Structure_and_Navigation.md`](<../../../03_IA/03_Information_Structure_and_Navigation.md>)
- [`03_IA/04_State_Visibility_and_Responsibility.md`](<../../../03_IA/04_State_Visibility_and_Responsibility.md>)
- [`03_IA/Analysis/UX-000001/ia_analysis.md`](<../../../03_IA/Analysis/UX-000001/ia_analysis.md>)
- [`03_IA/Analysis/UX-000002/ia_analysis.md`](<../../../03_IA/Analysis/UX-000002/ia_analysis.md>)
- [`03_IA/Analysis/UX-000003/ia_analysis.md`](<../../../03_IA/Analysis/UX-000003/ia_analysis.md>)
- [`03_IA/Analysis/UX-000004/ia_analysis.md`](<../../../03_IA/Analysis/UX-000004/ia_analysis.md>)
- [`03_IA/Analysis/UX-000005/ia_analysis.md`](<../../../03_IA/Analysis/UX-000005/ia_analysis.md>)
- [`03_IA/Analysis/UX-000006/ia_analysis.md`](<../../../03_IA/Analysis/UX-000006/ia_analysis.md>)
- [`03_IA/Analysis/UX-000007/ia_analysis.md`](<../../../03_IA/Analysis/UX-000007/ia_analysis.md>)
- [`03_IA/Analysis/UX-000008/ia_analysis.md`](<../../../03_IA/Analysis/UX-000008/ia_analysis.md>)
- [`03_IA/Analysis/UX-000009/ia_analysis.md`](<../../../03_IA/Analysis/UX-000009/ia_analysis.md>)
- [`03_IA/Analysis/UX-000010/ia_analysis.md`](<../../../03_IA/Analysis/UX-000010/ia_analysis.md>)
- [`03_IA/Analysis/UX-000011/ia_analysis.md`](<../../../03_IA/Analysis/UX-000011/ia_analysis.md>)
- [`03_IA/Analysis/UX-000012/ia_analysis.md`](<../../../03_IA/Analysis/UX-000012/ia_analysis.md>)
- [`03_IA/Analysis/UX-000013/ia_analysis.md`](<../../../03_IA/Analysis/UX-000013/ia_analysis.md>)
- [`03_IA/Analysis/UX-000014/ia_analysis.md`](<../../../03_IA/Analysis/UX-000014/ia_analysis.md>)
- [`03_IA/Analysis/UX-000015/ia_analysis.md`](<../../../03_IA/Analysis/UX-000015/ia_analysis.md>)
- [`03_IA/Analysis/UX-000016/ia_analysis.md`](<../../../03_IA/Analysis/UX-000016/ia_analysis.md>)
- [`03_IA/Analysis/UX-000017/ia_analysis.md`](<../../../03_IA/Analysis/UX-000017/ia_analysis.md>)
- [`03_IA/Analysis/UX-000018/ia_analysis.md`](<../../../03_IA/Analysis/UX-000018/ia_analysis.md>)
- [`03_IA/Analysis/UX-000019/ia_analysis.md`](<../../../03_IA/Analysis/UX-000019/ia_analysis.md>)
- [`03_IA/Analysis/UX-000020/ia_analysis.md`](<../../../03_IA/Analysis/UX-000020/ia_analysis.md>)
- [`03_IA/Analysis/UX-000021/ia_analysis.md`](<../../../03_IA/Analysis/UX-000021/ia_analysis.md>)
- [`03_IA/Analysis/UX-000022/ia_analysis.md`](<../../../03_IA/Analysis/UX-000022/ia_analysis.md>)
- [`03_IA/Analysis/UX-000023/ia_analysis.md`](<../../../03_IA/Analysis/UX-000023/ia_analysis.md>)
- [`03_IA/Analysis/UX-000024/ia_analysis.md`](<../../../03_IA/Analysis/UX-000024/ia_analysis.md>)
- [`03_IA/Analysis/UX-000025/ia_analysis.md`](<../../../03_IA/Analysis/UX-000025/ia_analysis.md>)
- [`03_IA/Analysis/UX-000026/ia_analysis.md`](<../../../03_IA/Analysis/UX-000026/ia_analysis.md>)
- [`03_IA/Analysis/UX-000027/ia_analysis.md`](<../../../03_IA/Analysis/UX-000027/ia_analysis.md>)
- [`03_IA/Analysis/UX-000028/ia_analysis.md`](<../../../03_IA/Analysis/UX-000028/ia_analysis.md>)
- [`03_IA/Analysis/UX-000029/ia_analysis.md`](<../../../03_IA/Analysis/UX-000029/ia_analysis.md>)
- [`03_IA/Analysis/UX-000030/ia_analysis.md`](<../../../03_IA/Analysis/UX-000030/ia_analysis.md>)
- [`03_IA/Analysis/UX-000031/ia_analysis.md`](<../../../03_IA/Analysis/UX-000031/ia_analysis.md>)
- [`03_IA/Definitions/IA-000001/ia_definition.md`](<../../../03_IA/Definitions/IA-000001/ia_definition.md>)
- [`03_IA/Definitions/IA-000002/ia_definition.md`](<../../../03_IA/Definitions/IA-000002/ia_definition.md>)
- [`03_IA/Definitions/IA-000003/ia_definition.md`](<../../../03_IA/Definitions/IA-000003/ia_definition.md>)
- [`03_IA/Definitions/IA-000004/ia_definition.md`](<../../../03_IA/Definitions/IA-000004/ia_definition.md>)
- [`03_IA/Definitions/IA-000005/ia_definition.md`](<../../../03_IA/Definitions/IA-000005/ia_definition.md>)
- [`03_IA/Definitions/IA-000006/ia_definition.md`](<../../../03_IA/Definitions/IA-000006/ia_definition.md>)
- [`03_IA/Definitions/IA-000007/ia_definition.md`](<../../../03_IA/Definitions/IA-000007/ia_definition.md>)
- [`03_IA/Definitions/IA-000008/ia_definition.md`](<../../../03_IA/Definitions/IA-000008/ia_definition.md>)
- [`03_IA/Definitions/IA-000009/ia_definition.md`](<../../../03_IA/Definitions/IA-000009/ia_definition.md>)
- [`03_IA/Definitions/IA-000010/ia_definition.md`](<../../../03_IA/Definitions/IA-000010/ia_definition.md>)
- [`03_IA/Definitions/IA-000011/ia_definition.md`](<../../../03_IA/Definitions/IA-000011/ia_definition.md>)
- [`03_IA/Definitions/IA-000012/ia_definition.md`](<../../../03_IA/Definitions/IA-000012/ia_definition.md>)
- [`03_IA/Definitions/IA-000013/ia_definition.md`](<../../../03_IA/Definitions/IA-000013/ia_definition.md>)
- [`03_IA/Definitions/IA-000014/ia_definition.md`](<../../../03_IA/Definitions/IA-000014/ia_definition.md>)
- [`03_IA/Definitions/IA-000015/ia_definition.md`](<../../../03_IA/Definitions/IA-000015/ia_definition.md>)
- [`03_IA/Definitions/IA-000016/ia_definition.md`](<../../../03_IA/Definitions/IA-000016/ia_definition.md>)
- [`03_IA/Definitions/IA-000017/ia_definition.md`](<../../../03_IA/Definitions/IA-000017/ia_definition.md>)
- [`03_IA/Definitions/IA-000018/ia_definition.md`](<../../../03_IA/Definitions/IA-000018/ia_definition.md>)
- [`03_IA/Definitions/IA-000019/ia_definition.md`](<../../../03_IA/Definitions/IA-000019/ia_definition.md>)
- [`03_IA/Definitions/IA-000020/ia_definition.md`](<../../../03_IA/Definitions/IA-000020/ia_definition.md>)
- [`03_IA/Definitions/IA-000021/ia_definition.md`](<../../../03_IA/Definitions/IA-000021/ia_definition.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- `template/02_UX/Definitions/UX-XXXXXX/experience.md`（削除または旧Path）
- [`template/03_IA/01_Information_Architecture.md`](<../../../template/03_IA/01_Information_Architecture.md>)
- [`template/03_IA/02_Object_and_Relation_Model.md`](<../../../template/03_IA/02_Object_and_Relation_Model.md>)
- [`template/03_IA/03_Information_Structure_and_Navigation.md`](<../../../template/03_IA/03_Information_Structure_and_Navigation.md>)
- [`template/03_IA/04_State_Visibility_and_Responsibility.md`](<../../../template/03_IA/04_State_Visibility_and_Responsibility.md>)
- [`template/03_IA/Analysis/UX-XXXXXX/ia_analysis.md`](<../../../template/03_IA/Analysis/UX-XXXXXX/ia_analysis.md>)
- [`template/03_IA/Definitions/IA-XXXXXX/ia_definition.md`](<../../../template/03_IA/Definitions/IA-XXXXXX/ia_definition.md>)
- `template/03_IA/Evidence/.gitkeep`（削除または旧Path）
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`99_Roadmap/Changes/CHG-000073/change.md`](<../../../99_Roadmap/Changes/CHG-000073/change.md>)

- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`99_Roadmap/Changes/CHG-000017/change.md`](<../../../99_Roadmap/Changes/CHG-000017/change.md>)
- [`template/04_UI/01_User_Interface.md`](<../../../template/04_UI/01_User_Interface.md>)
- [`template/05_SPEC/01_Behavior_Specification.md`](<../../../template/05_SPEC/01_Behavior_Specification.md>)
- [`04_UI/02_Surface_and_Region_Model.md`](<../../../04_UI/02_Surface_and_Region_Model.md>)
- [`04_UI/03_Interaction_and_State_Model.md`](<../../../04_UI/03_Interaction_and_State_Model.md>)
- [`04_UI/04_Visual_and_Accessibility_Direction.md`](<../../../04_UI/04_Visual_and_Accessibility_Direction.md>)
- [`04_UI/05_UI_SPEC_Handoff.md`](<../../../04_UI/05_UI_SPEC_Handoff.md>)
- [`04_UI/06_Current_Interface_Reference.md`](<../../../04_UI/06_Current_Interface_Reference.md>)
- [`04_UI/Analysis/IA-000001/ui_analysis.md`](<../../../04_UI/Analysis/IA-000001/ui_analysis.md>)
- [`04_UI/Analysis/IA-000002/ui_analysis.md`](<../../../04_UI/Analysis/IA-000002/ui_analysis.md>)
- [`04_UI/Analysis/IA-000003/ui_analysis.md`](<../../../04_UI/Analysis/IA-000003/ui_analysis.md>)
- [`04_UI/Analysis/IA-000004/ui_analysis.md`](<../../../04_UI/Analysis/IA-000004/ui_analysis.md>)
- [`04_UI/Analysis/IA-000005/ui_analysis.md`](<../../../04_UI/Analysis/IA-000005/ui_analysis.md>)
- [`04_UI/Analysis/IA-000006/ui_analysis.md`](<../../../04_UI/Analysis/IA-000006/ui_analysis.md>)
- [`04_UI/Analysis/IA-000007/ui_analysis.md`](<../../../04_UI/Analysis/IA-000007/ui_analysis.md>)
- [`04_UI/Analysis/IA-000008/ui_analysis.md`](<../../../04_UI/Analysis/IA-000008/ui_analysis.md>)
- [`04_UI/Analysis/IA-000009/ui_analysis.md`](<../../../04_UI/Analysis/IA-000009/ui_analysis.md>)
- [`04_UI/Analysis/IA-000010/ui_analysis.md`](<../../../04_UI/Analysis/IA-000010/ui_analysis.md>)
- [`04_UI/Analysis/IA-000011/ui_analysis.md`](<../../../04_UI/Analysis/IA-000011/ui_analysis.md>)
- [`04_UI/Analysis/IA-000012/ui_analysis.md`](<../../../04_UI/Analysis/IA-000012/ui_analysis.md>)
- [`04_UI/Analysis/IA-000013/ui_analysis.md`](<../../../04_UI/Analysis/IA-000013/ui_analysis.md>)
- [`04_UI/Analysis/IA-000014/ui_analysis.md`](<../../../04_UI/Analysis/IA-000014/ui_analysis.md>)
- [`04_UI/Analysis/IA-000015/ui_analysis.md`](<../../../04_UI/Analysis/IA-000015/ui_analysis.md>)
- [`04_UI/Analysis/IA-000016/ui_analysis.md`](<../../../04_UI/Analysis/IA-000016/ui_analysis.md>)
- [`04_UI/Analysis/IA-000017/ui_analysis.md`](<../../../04_UI/Analysis/IA-000017/ui_analysis.md>)
- [`04_UI/Analysis/IA-000018/ui_analysis.md`](<../../../04_UI/Analysis/IA-000018/ui_analysis.md>)
- [`04_UI/Analysis/IA-000019/ui_analysis.md`](<../../../04_UI/Analysis/IA-000019/ui_analysis.md>)
- [`04_UI/Analysis/IA-000020/ui_analysis.md`](<../../../04_UI/Analysis/IA-000020/ui_analysis.md>)
- [`04_UI/Analysis/IA-000021/ui_analysis.md`](<../../../04_UI/Analysis/IA-000021/ui_analysis.md>)
- [`04_UI/Analysis/UX-000001/ui_analysis.md`](<../../../04_UI/Analysis/UX-000001/ui_analysis.md>)
- [`04_UI/Analysis/UX-000002/ui_analysis.md`](<../../../04_UI/Analysis/UX-000002/ui_analysis.md>)
- [`04_UI/Analysis/UX-000003/ui_analysis.md`](<../../../04_UI/Analysis/UX-000003/ui_analysis.md>)
- [`04_UI/Analysis/UX-000004/ui_analysis.md`](<../../../04_UI/Analysis/UX-000004/ui_analysis.md>)
- [`04_UI/Analysis/UX-000005/ui_analysis.md`](<../../../04_UI/Analysis/UX-000005/ui_analysis.md>)
- [`04_UI/Analysis/UX-000006/ui_analysis.md`](<../../../04_UI/Analysis/UX-000006/ui_analysis.md>)
- [`04_UI/Analysis/UX-000007/ui_analysis.md`](<../../../04_UI/Analysis/UX-000007/ui_analysis.md>)
- [`04_UI/Analysis/UX-000008/ui_analysis.md`](<../../../04_UI/Analysis/UX-000008/ui_analysis.md>)
- [`04_UI/Analysis/UX-000009/ui_analysis.md`](<../../../04_UI/Analysis/UX-000009/ui_analysis.md>)
- [`04_UI/Analysis/UX-000010/ui_analysis.md`](<../../../04_UI/Analysis/UX-000010/ui_analysis.md>)
- [`04_UI/Analysis/UX-000011/ui_analysis.md`](<../../../04_UI/Analysis/UX-000011/ui_analysis.md>)
- [`04_UI/Analysis/UX-000012/ui_analysis.md`](<../../../04_UI/Analysis/UX-000012/ui_analysis.md>)
- [`04_UI/Analysis/UX-000013/ui_analysis.md`](<../../../04_UI/Analysis/UX-000013/ui_analysis.md>)
- [`04_UI/Analysis/UX-000014/ui_analysis.md`](<../../../04_UI/Analysis/UX-000014/ui_analysis.md>)
- [`04_UI/Analysis/UX-000015/ui_analysis.md`](<../../../04_UI/Analysis/UX-000015/ui_analysis.md>)
- [`04_UI/Analysis/UX-000016/ui_analysis.md`](<../../../04_UI/Analysis/UX-000016/ui_analysis.md>)
- [`04_UI/Analysis/UX-000017/ui_analysis.md`](<../../../04_UI/Analysis/UX-000017/ui_analysis.md>)
- [`04_UI/Analysis/UX-000018/ui_analysis.md`](<../../../04_UI/Analysis/UX-000018/ui_analysis.md>)
- [`04_UI/Analysis/UX-000019/ui_analysis.md`](<../../../04_UI/Analysis/UX-000019/ui_analysis.md>)
- [`04_UI/Analysis/UX-000020/ui_analysis.md`](<../../../04_UI/Analysis/UX-000020/ui_analysis.md>)
- [`04_UI/Analysis/UX-000021/ui_analysis.md`](<../../../04_UI/Analysis/UX-000021/ui_analysis.md>)
- [`04_UI/Analysis/UX-000022/ui_analysis.md`](<../../../04_UI/Analysis/UX-000022/ui_analysis.md>)
- [`04_UI/Analysis/UX-000023/ui_analysis.md`](<../../../04_UI/Analysis/UX-000023/ui_analysis.md>)
- [`04_UI/Analysis/UX-000024/ui_analysis.md`](<../../../04_UI/Analysis/UX-000024/ui_analysis.md>)
- [`04_UI/Analysis/UX-000025/ui_analysis.md`](<../../../04_UI/Analysis/UX-000025/ui_analysis.md>)
- [`04_UI/Analysis/UX-000026/ui_analysis.md`](<../../../04_UI/Analysis/UX-000026/ui_analysis.md>)
- [`04_UI/Analysis/UX-000027/ui_analysis.md`](<../../../04_UI/Analysis/UX-000027/ui_analysis.md>)
- [`04_UI/Analysis/UX-000028/ui_analysis.md`](<../../../04_UI/Analysis/UX-000028/ui_analysis.md>)
- [`04_UI/Analysis/UX-000029/ui_analysis.md`](<../../../04_UI/Analysis/UX-000029/ui_analysis.md>)
- [`04_UI/Analysis/UX-000030/ui_analysis.md`](<../../../04_UI/Analysis/UX-000030/ui_analysis.md>)
- [`04_UI/Analysis/UX-000031/ui_analysis.md`](<../../../04_UI/Analysis/UX-000031/ui_analysis.md>)
- [`04_UI/Definitions/UI-000001/ui_definition.md`](<../../../04_UI/Definitions/UI-000001/ui_definition.md>)
- [`04_UI/Definitions/UI-000002/ui_definition.md`](<../../../04_UI/Definitions/UI-000002/ui_definition.md>)
- [`04_UI/Definitions/UI-000003/ui_definition.md`](<../../../04_UI/Definitions/UI-000003/ui_definition.md>)
- [`04_UI/Definitions/UI-000004/ui_definition.md`](<../../../04_UI/Definitions/UI-000004/ui_definition.md>)
- [`04_UI/Definitions/UI-000005/ui_definition.md`](<../../../04_UI/Definitions/UI-000005/ui_definition.md>)
- [`04_UI/Definitions/UI-000006/ui_definition.md`](<../../../04_UI/Definitions/UI-000006/ui_definition.md>)
- [`04_UI/Definitions/UI-000007/ui_definition.md`](<../../../04_UI/Definitions/UI-000007/ui_definition.md>)
- [`04_UI/Definitions/UI-000008/ui_definition.md`](<../../../04_UI/Definitions/UI-000008/ui_definition.md>)
- [`04_UI/Definitions/UI-000009/ui_definition.md`](<../../../04_UI/Definitions/UI-000009/ui_definition.md>)
- [`04_UI/Definitions/UI-000010/ui_definition.md`](<../../../04_UI/Definitions/UI-000010/ui_definition.md>)
- [`04_UI/Definitions/UI-000011/ui_definition.md`](<../../../04_UI/Definitions/UI-000011/ui_definition.md>)
- [`04_UI/Definitions/UI-000012/ui_definition.md`](<../../../04_UI/Definitions/UI-000012/ui_definition.md>)
- [`04_UI/Definitions/UI-000013/ui_definition.md`](<../../../04_UI/Definitions/UI-000013/ui_definition.md>)
- [`04_UI/Definitions/UI-000014/ui_definition.md`](<../../../04_UI/Definitions/UI-000014/ui_definition.md>)
- [`04_UI/Definitions/UI-000015/ui_definition.md`](<../../../04_UI/Definitions/UI-000015/ui_definition.md>)
- [`04_UI/Definitions/UI-000016/ui_definition.md`](<../../../04_UI/Definitions/UI-000016/ui_definition.md>)
- [`04_UI/Definitions/UI-000017/ui_definition.md`](<../../../04_UI/Definitions/UI-000017/ui_definition.md>)
- [`04_UI/Definitions/UI-000018/ui_definition.md`](<../../../04_UI/Definitions/UI-000018/ui_definition.md>)
- [`04_UI/Definitions/UI-000019/ui_definition.md`](<../../../04_UI/Definitions/UI-000019/ui_definition.md>)
- [`template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md`](<../../../template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md>)
- [`template/04_UI/Analysis/UX-XXXXXX/ui_analysis.md`](<../../../template/04_UI/Analysis/UX-XXXXXX/ui_analysis.md>)
- [`template/04_UI/Definitions/UI-XXXXXX/ui_definition.md`](<../../../template/04_UI/Definitions/UI-XXXXXX/ui_definition.md>)
- `template/04_UI/Evidence/.gitkeep`（削除または旧Path）

- [`05_SPEC/02_Use_Case_and_Behavior_Flow.md`](<../../../05_SPEC/02_Use_Case_and_Behavior_Flow.md>)
- [`05_SPEC/03_State_Transition_Model.md`](<../../../05_SPEC/03_State_Transition_Model.md>)
- [`05_SPEC/04_Actor_System_Sequence.md`](<../../../05_SPEC/04_Actor_System_Sequence.md>)
- [`05_SPEC/05_Error_Effect_and_Recovery.md`](<../../../05_SPEC/05_Error_Effect_and_Recovery.md>)
- [`05_SPEC/06_UI_SPEC_Correspondence.md`](<../../../05_SPEC/06_UI_SPEC_Correspondence.md>)
- [`05_SPEC/07_Current_Behavior_Reference.md`](<../../../05_SPEC/07_Current_Behavior_Reference.md>)
- [`05_SPEC/Analysis/IA-000001/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000001/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000002/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000002/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000003/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000003/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000004/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000004/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000005/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000005/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000006/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000006/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000007/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000007/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000008/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000008/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000009/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000009/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000010/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000010/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000011/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000011/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000012/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000012/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000013/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000013/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000014/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000014/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000015/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000015/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000016/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000016/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000017/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000017/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000018/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000018/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000019/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000019/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000020/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000020/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000021/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000021/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000001/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000001/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000002/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000002/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000003/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000003/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000004/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000004/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000005/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000005/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000006/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000006/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000007/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000007/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000008/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000008/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000009/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000009/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000010/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000010/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000011/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000011/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000012/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000012/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000013/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000013/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000014/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000014/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000015/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000015/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000016/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000016/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000017/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000017/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000018/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000018/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000019/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000019/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000020/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000020/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000021/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000021/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000022/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000022/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000023/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000023/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000024/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000024/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000025/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000025/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000026/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000026/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000027/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000027/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000028/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000028/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000029/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000029/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000030/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000030/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000031/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000031/spec_analysis.md>)
- [`05_SPEC/Definitions/SPEC-000001/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000002/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000002/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000003/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000003/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000004/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000004/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000005/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000005/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000006/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000006/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000007/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000007/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000008/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000008/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000009/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000009/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000010/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000010/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000011/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000011/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000012/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000013/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000013/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000014/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000014/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000015/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000015/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000016/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000016/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000017/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000017/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000018/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000018/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000019/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000019/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000020/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000020/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000021/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000021/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000022/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000022/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000023/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000023/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000024/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000024/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000026/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000026/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000027/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000027/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000028/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000028/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000029/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000029/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000030/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md>)
- [`06_Architecture/Details/checker/01_Architecture.md`](<../../../06_Architecture/Details/checker/01_Architecture.md>)
- [`README.md`](<../../../README.md>)
- [`template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md`](<../../../template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md>)
- [`template/05_SPEC/Analysis/UX-XXXXXX/spec_analysis.md`](<../../../template/05_SPEC/Analysis/UX-XXXXXX/spec_analysis.md>)
- [`template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md`](<../../../template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md>)
- `template/05_SPEC/Evidence/.gitkeep`（削除または旧Path）
- [`06_Architecture/Analysis/UI-000001/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000001/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000002/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000002/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000003/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000003/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000004/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000004/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000005/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000005/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000006/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000006/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000007/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000007/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000008/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000008/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000009/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000009/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000010/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000010/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000011/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000011/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000012/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000012/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000013/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000013/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000014/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000014/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000015/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000015/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000016/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000016/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000017/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000017/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000018/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000018/architecture_analysis.md>)
- [`06_Architecture/Analysis/UI-000019/architecture_analysis.md`](<../../../06_Architecture/Analysis/UI-000019/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000001/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000001/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000002/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000002/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000003/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000003/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000004/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000004/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000005/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000005/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000006/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000006/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000007/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000007/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000008/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000008/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000009/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000009/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000010/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000010/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000011/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000011/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000012/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000012/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000013/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000013/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000014/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000014/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000015/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000015/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000016/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000016/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000017/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000017/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000018/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000018/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000019/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000019/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000020/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000020/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000021/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000021/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000022/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000022/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000023/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000023/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000024/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000024/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000026/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000026/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000027/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000027/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000028/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000028/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000029/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000029/architecture_analysis.md>)
- [`06_Architecture/Analysis/SPEC-000030/architecture_analysis.md`](<../../../06_Architecture/Analysis/SPEC-000030/architecture_analysis.md>)
- [`06_Architecture/Definitions/ARCH-000001/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000002/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000002/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000003/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000003/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000004/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000004/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000005/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000005/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000006/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000006/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000007/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000007/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000008/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000008/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000009/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000009/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000010/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000011/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000011/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000012/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000012/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000013/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000014/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000014/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000015/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000016/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000016/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000017/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000017/architecture_definition.md>)
- [`06_Architecture/Definitions/ARCH-000018/architecture_definition.md`](<../../../06_Architecture/Definitions/ARCH-000018/architecture_definition.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/02_Component_and_Responsibility_Model.md`](<../../../06_Architecture/02_Component_and_Responsibility_Model.md>)
- [`06_Architecture/03_Boundary_and_Interface_Model.md`](<../../../06_Architecture/03_Boundary_and_Interface_Model.md>)
- [`06_Architecture/04_Runtime_and_Data_Flow_Model.md`](<../../../06_Architecture/04_Runtime_and_Data_Flow_Model.md>)
- [`06_Architecture/05_Failure_Recovery_and_Resilience_Model.md`](<../../../06_Architecture/05_Failure_Recovery_and_Resilience_Model.md>)
- [`06_Architecture/06_Deployment_and_Execution_Model.md`](<../../../06_Architecture/06_Deployment_and_Execution_Model.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/Registry/test-catalog.json`](<../../../07_Quality/Registry/test-catalog.json>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`template/06_Architecture/01_Architecture.md`](<../../../template/06_Architecture/01_Architecture.md>)
- [`template/06_Architecture/02_Component_and_Responsibility_Model.md`](<../../../template/06_Architecture/02_Component_and_Responsibility_Model.md>)
- [`template/06_Architecture/03_Boundary_and_Interface_Model.md`](<../../../template/06_Architecture/03_Boundary_and_Interface_Model.md>)
- [`template/06_Architecture/04_Runtime_and_Data_Flow_Model.md`](<../../../template/06_Architecture/04_Runtime_and_Data_Flow_Model.md>)
- [`template/06_Architecture/05_Failure_Recovery_and_Resilience_Model.md`](<../../../template/06_Architecture/05_Failure_Recovery_and_Resilience_Model.md>)
- [`template/06_Architecture/06_Deployment_and_Execution_Model.md`](<../../../template/06_Architecture/06_Deployment_and_Execution_Model.md>)
- [`template/06_Architecture/Analysis/UI-XXXXXX/architecture_analysis.md`](<../../../template/06_Architecture/Analysis/UI-XXXXXX/architecture_analysis.md>)
- [`template/06_Architecture/Analysis/SPEC-XXXXXX/architecture_analysis.md`](<../../../template/06_Architecture/Analysis/SPEC-XXXXXX/architecture_analysis.md>)
- [`template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md`](<../../../template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md>)
- `template/06_Architecture/Evidence/.gitkeep`（削除または旧Path）
- [`06_Architecture/07_Detail_Architecture_Map.md`](<../../../06_Architecture/07_Detail_Architecture_Map.md>)
- [`06_Architecture/Details/contract-migration/01_Architecture.md`](<../../../06_Architecture/Details/contract-migration/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/cros/01_Architecture.md`](<../../../06_Architecture/Details/cros/01_Architecture.md>)
- [`06_Architecture/Details/execution-intelligence/01_Architecture.md`](<../../../06_Architecture/Details/execution-intelligence/01_Architecture.md>)
- [`06_Architecture/Details/execution-intelligence/02_Current_Implementation_Reality_Audit.md`](<../../../06_Architecture/Details/execution-intelligence/02_Current_Implementation_Reality_Audit.md>)
- [`06_Architecture/Details/mcp/01_Architecture.md`](<../../../06_Architecture/Details/mcp/01_Architecture.md>)
- [`06_Architecture/Details/official-asset-governance/01_Architecture.md`](<../../../06_Architecture/Details/official-asset-governance/01_Architecture.md>)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](<../../../06_Architecture/Details/platform-access/01_Architecture.md>)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](<../../../06_Architecture/Details/project-operation/01_Architecture.md>)
- [`06_Architecture/Details/project-runtime/01_Architecture.md`](<../../../06_Architecture/Details/project-runtime/01_Architecture.md>)
- [`06_Architecture/Details/quality-change-control/01_Architecture.md`](<../../../06_Architecture/Details/quality-change-control/01_Architecture.md>)
- [`06_Architecture/Details/runtime-data/01_Architecture.md`](<../../../06_Architecture/Details/runtime-data/01_Architecture.md>)
- [`06_Architecture/Details/runtime-data/02_Current_Path_Reality_Audit.md`](<../../../06_Architecture/Details/runtime-data/02_Current_Path_Reality_Audit.md>)
- [`06_Architecture/Details/runtime-trust/01_Architecture.md`](<../../../06_Architecture/Details/runtime-trust/01_Architecture.md>)
- [`template/06_Architecture/07_Detail_Architecture_Map.md`](<../../../template/06_Architecture/07_Detail_Architecture_Map.md>)
- [`template/06_Architecture/Details/area/01_Architecture.md`](<../../../template/06_Architecture/Details/area/01_Architecture.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/02_Quality_Strategy.md`](<../../../07_Quality/02_Quality_Strategy.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/04_Quality_Integration.md`](<../../../07_Quality/04_Quality_Integration.md>)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](<../../../07_Quality/05_Current_Implementation_Reality_Audit.md>)
- [`07_Quality/Definitions/QA-000010/quality_definition.md`](<../../../07_Quality/Definitions/QA-000010/quality_definition.md>)
- [`07_Quality/Definitions/QA-000013/quality_definition.md`](<../../../07_Quality/Definitions/QA-000013/quality_definition.md>)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](<../../../07_Quality/Definitions/QA-000005/quality_definition.md>)
- [`07_Quality/Definitions/QA-000002/quality_definition.md`](<../../../07_Quality/Definitions/QA-000002/quality_definition.md>)
- [`07_Quality/Definitions/QA-000012/quality_definition.md`](<../../../07_Quality/Definitions/QA-000012/quality_definition.md>)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](<../../../07_Quality/Definitions/QA-000006/quality_definition.md>)
- [`07_Quality/Definitions/QA-000009/quality_definition.md`](<../../../07_Quality/Definitions/QA-000009/quality_definition.md>)
- [`07_Quality/Definitions/QA-000011/quality_definition.md`](<../../../07_Quality/Definitions/QA-000011/quality_definition.md>)
- [`07_Quality/Definitions/QA-000003/quality_definition.md`](<../../../07_Quality/Definitions/QA-000003/quality_definition.md>)
- [`07_Quality/Definitions/QA-000004/quality_definition.md`](<../../../07_Quality/Definitions/QA-000004/quality_definition.md>)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](<../../../07_Quality/Definitions/QA-000001/quality_definition.md>)
- [`07_Quality/Definitions/QA-000007/quality_definition.md`](<../../../07_Quality/Definitions/QA-000007/quality_definition.md>)
- [`07_Quality/Definitions/QA-000008/quality_definition.md`](<../../../07_Quality/Definitions/QA-000008/quality_definition.md>)
- [`template/07_Quality/Analysis/PHASE/quality_analysis.md`](<../../../template/07_Quality/Analysis/PHASE/quality_analysis.md>)
- [`template/07_Quality/Definitions/QA-XXXXXX/quality_definition.md`](<../../../template/07_Quality/Definitions/QA-XXXXXX/quality_definition.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)

- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- [`06_Architecture/Details/project-runtime/02_Detailed_Design.md`](<../../../06_Architecture/Details/project-runtime/02_Detailed_Design.md>)
- `07_Quality/Analysis/current-implementation-reality/quality_analysis.md`（削除または旧Path）
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](<../../../07_Quality/Analysis/ARCH/quality_analysis.md>)
- [`07_Quality/Analysis/IA/quality_analysis.md`](<../../../07_Quality/Analysis/IA/quality_analysis.md>)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](<../../../07_Quality/Analysis/REQ/quality_analysis.md>)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](<../../../07_Quality/Analysis/SPEC/quality_analysis.md>)
- [`07_Quality/Analysis/UI/quality_analysis.md`](<../../../07_Quality/Analysis/UI/quality_analysis.md>)
- [`07_Quality/Analysis/UX/quality_analysis.md`](<../../../07_Quality/Analysis/UX/quality_analysis.md>)
- `07_Quality/Analysis/canonical-definition-mapping/quality_analysis.md`（削除または旧Path）
- `07_Quality/Definitions/repository-and-contract-migration/verification.md`（削除または旧Path）
- `07_Quality/Definitions/change-and-quality-state/verification.md`（削除または旧Path）
- `07_Quality/Definitions/project-runtime-lifecycle/verification.md`（削除または旧Path）
- `07_Quality/Definitions/projection-and-provenance/verification.md`（削除または旧Path）
- `07_Quality/Definitions/candidate-promotion/verification.md`（削除または旧Path）
- `07_Quality/Definitions/external-runtime-boundary/verification.md`（削除または旧Path）
- `07_Quality/Definitions/repository-and-federation/verification.md`（削除または旧Path）
- `07_Quality/Definitions/runtime-data-lifecycle/verification.md`（削除または旧Path）
- `07_Quality/Definitions/external-send-and-transport/verification.md`（削除または旧Path）
- `07_Quality/Definitions/artifact-integrity-and-trust/verification.md`（削除または旧Path）
- `07_Quality/Definitions/official-asset-governance/verification.md`（削除または旧Path）
- `07_Quality/Definitions/artifact-understanding-and-handoff/verification.md`（削除または旧Path）
- `07_Quality/Definitions/execution-record-publication/verification.md`（削除または旧Path）
- `07_Quality/05_Coordinator_Runtime_Traceability.json`（削除または旧Path）
- [`07_Quality/Registry/coordinator-runtime-traceability.json`](<../../../07_Quality/Registry/coordinator-runtime-traceability.json>)
- `07_Quality/06_Project_Runtime_Design_Traceability.json`（削除または旧Path）
- [`07_Quality/Registry/project-runtime-design-traceability.json`](<../../../07_Quality/Registry/project-runtime-design-traceability.json>)
- `07_Quality/04_Test_Catalog.json`（削除または旧Path）
- [`19_Workflows/03_Execution_Intelligence.md`](<../../../19_Workflows/03_Execution_Intelligence.md>)
- [`19_Workflows/04_MCP_Server.md`](<../../../19_Workflows/04_MCP_Server.md>)
- [`40_Develop/checker/regression-runner.ts`](<../../../40_Develop/checker/regression-runner.ts>)
- [`40_Develop/checker/test-catalog.ts`](<../../../40_Develop/checker/test-catalog.ts>)
- [`40_Develop/checker/tests/unit/test-catalog.contract.test.ts`](<../../../40_Develop/checker/tests/unit/test-catalog.contract.test.ts>)
- [`40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts>)
- [`40_Develop/coordinator/scripts/check-runtime-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-runtime-traceability.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/support/runtime-trace-case.ts`](<../../../40_Develop/coordinator/tests/support/runtime-trace-case.ts>)
- [`99_Roadmap/Changes/CHG-000001/change.md`](<../CHG-000001/change.md>)
- [`99_Roadmap/Changes/CHG-000002/change.md`](<../CHG-000002/change.md>)
- [`99_Roadmap/Changes/CHG-000004/change.md`](<../CHG-000004/change.md>)
- [`99_Roadmap/Changes/CHG-000005/change.md`](<../CHG-000005/change.md>)
- [`99_Roadmap/Changes/CHG-000007/change.md`](<../CHG-000007/change.md>)
- [`99_Roadmap/Changes/CHG-000010/change.md`](<../CHG-000010/change.md>)
- [`99_Roadmap/Changes/CHG-000061/change.md`](<../CHG-000061/change.md>)
- [`99_Roadmap/Changes/CHG-000062/change.md`](<../CHG-000062/change.md>)
- [`99_Roadmap/Changes/CHG-000064/change.md`](<../CHG-000064/change.md>)
- [`template/07_Quality/03_Verification_Design.md`](<../../../template/07_Quality/03_Verification_Design.md>)
- [`template/07_Quality/04_Quality_Integration.md`](<../../../template/07_Quality/04_Quality_Integration.md>)
- [`template/07_Quality/05_Current_Implementation_Reality_Audit.md`](<../../../template/07_Quality/05_Current_Implementation_Reality_Audit.md>)
- `template/07_Quality/04_Verification_Result_Format.md`（削除または旧Path）
- [`template/07_Quality/99_Verification_Result_Format.md`](<../../../template/07_Quality/99_Verification_Result_Format.md>)
- `template/07_Quality/Analysis/_Template/quality_analysis.md`（削除または旧Path）
- `template/07_Quality/Definitions/_Template/verification.md`（削除または旧Path）


- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`04_UI/02_Surface_and_Region_Model.md`](<../../../04_UI/02_Surface_and_Region_Model.md>)
- [`04_UI/03_Interaction_and_State_Model.md`](<../../../04_UI/03_Interaction_and_State_Model.md>)
- [`04_UI/04_Visual_and_Accessibility_Direction.md`](<../../../04_UI/04_Visual_and_Accessibility_Direction.md>)
- [`04_UI/05_UI_SPEC_Handoff.md`](<../../../04_UI/05_UI_SPEC_Handoff.md>)
- [`04_UI/Analysis/IA-000001/ui_analysis.md`](<../../../04_UI/Analysis/IA-000001/ui_analysis.md>)
- [`04_UI/Analysis/IA-000002/ui_analysis.md`](<../../../04_UI/Analysis/IA-000002/ui_analysis.md>)
- [`04_UI/Analysis/IA-000003/ui_analysis.md`](<../../../04_UI/Analysis/IA-000003/ui_analysis.md>)
- [`04_UI/Analysis/IA-000004/ui_analysis.md`](<../../../04_UI/Analysis/IA-000004/ui_analysis.md>)
- [`04_UI/Analysis/IA-000005/ui_analysis.md`](<../../../04_UI/Analysis/IA-000005/ui_analysis.md>)
- [`04_UI/Analysis/IA-000006/ui_analysis.md`](<../../../04_UI/Analysis/IA-000006/ui_analysis.md>)
- [`04_UI/Analysis/IA-000007/ui_analysis.md`](<../../../04_UI/Analysis/IA-000007/ui_analysis.md>)
- [`04_UI/Analysis/IA-000008/ui_analysis.md`](<../../../04_UI/Analysis/IA-000008/ui_analysis.md>)
- [`04_UI/Analysis/IA-000009/ui_analysis.md`](<../../../04_UI/Analysis/IA-000009/ui_analysis.md>)
- [`04_UI/Analysis/IA-000010/ui_analysis.md`](<../../../04_UI/Analysis/IA-000010/ui_analysis.md>)
- [`04_UI/Analysis/IA-000011/ui_analysis.md`](<../../../04_UI/Analysis/IA-000011/ui_analysis.md>)
- [`04_UI/Analysis/IA-000012/ui_analysis.md`](<../../../04_UI/Analysis/IA-000012/ui_analysis.md>)
- [`04_UI/Analysis/IA-000013/ui_analysis.md`](<../../../04_UI/Analysis/IA-000013/ui_analysis.md>)
- [`04_UI/Analysis/IA-000014/ui_analysis.md`](<../../../04_UI/Analysis/IA-000014/ui_analysis.md>)
- [`04_UI/Analysis/IA-000015/ui_analysis.md`](<../../../04_UI/Analysis/IA-000015/ui_analysis.md>)
- [`04_UI/Analysis/IA-000016/ui_analysis.md`](<../../../04_UI/Analysis/IA-000016/ui_analysis.md>)
- [`04_UI/Analysis/IA-000017/ui_analysis.md`](<../../../04_UI/Analysis/IA-000017/ui_analysis.md>)
- [`04_UI/Analysis/IA-000018/ui_analysis.md`](<../../../04_UI/Analysis/IA-000018/ui_analysis.md>)
- [`04_UI/Analysis/IA-000019/ui_analysis.md`](<../../../04_UI/Analysis/IA-000019/ui_analysis.md>)
- [`04_UI/Analysis/IA-000020/ui_analysis.md`](<../../../04_UI/Analysis/IA-000020/ui_analysis.md>)
- [`04_UI/Analysis/IA-000021/ui_analysis.md`](<../../../04_UI/Analysis/IA-000021/ui_analysis.md>)
- [`04_UI/Analysis/IA-000022/ui_analysis.md`](<../../../04_UI/Analysis/IA-000022/ui_analysis.md>)
- [`04_UI/Analysis/UX-000001/ui_analysis.md`](<../../../04_UI/Analysis/UX-000001/ui_analysis.md>)
- [`04_UI/Analysis/UX-000002/ui_analysis.md`](<../../../04_UI/Analysis/UX-000002/ui_analysis.md>)
- [`04_UI/Analysis/UX-000003/ui_analysis.md`](<../../../04_UI/Analysis/UX-000003/ui_analysis.md>)
- [`04_UI/Analysis/UX-000004/ui_analysis.md`](<../../../04_UI/Analysis/UX-000004/ui_analysis.md>)
- [`04_UI/Analysis/UX-000005/ui_analysis.md`](<../../../04_UI/Analysis/UX-000005/ui_analysis.md>)
- [`04_UI/Analysis/UX-000006/ui_analysis.md`](<../../../04_UI/Analysis/UX-000006/ui_analysis.md>)
- [`04_UI/Analysis/UX-000007/ui_analysis.md`](<../../../04_UI/Analysis/UX-000007/ui_analysis.md>)
- [`04_UI/Analysis/UX-000008/ui_analysis.md`](<../../../04_UI/Analysis/UX-000008/ui_analysis.md>)
- [`04_UI/Analysis/UX-000009/ui_analysis.md`](<../../../04_UI/Analysis/UX-000009/ui_analysis.md>)
- [`04_UI/Analysis/UX-000010/ui_analysis.md`](<../../../04_UI/Analysis/UX-000010/ui_analysis.md>)
- [`04_UI/Analysis/UX-000011/ui_analysis.md`](<../../../04_UI/Analysis/UX-000011/ui_analysis.md>)
- [`04_UI/Analysis/UX-000012/ui_analysis.md`](<../../../04_UI/Analysis/UX-000012/ui_analysis.md>)
- [`04_UI/Analysis/UX-000013/ui_analysis.md`](<../../../04_UI/Analysis/UX-000013/ui_analysis.md>)
- [`04_UI/Analysis/UX-000014/ui_analysis.md`](<../../../04_UI/Analysis/UX-000014/ui_analysis.md>)
- [`04_UI/Analysis/UX-000015/ui_analysis.md`](<../../../04_UI/Analysis/UX-000015/ui_analysis.md>)
- [`04_UI/Analysis/UX-000016/ui_analysis.md`](<../../../04_UI/Analysis/UX-000016/ui_analysis.md>)
- [`04_UI/Analysis/UX-000017/ui_analysis.md`](<../../../04_UI/Analysis/UX-000017/ui_analysis.md>)
- [`04_UI/Analysis/UX-000018/ui_analysis.md`](<../../../04_UI/Analysis/UX-000018/ui_analysis.md>)
- [`04_UI/Analysis/UX-000019/ui_analysis.md`](<../../../04_UI/Analysis/UX-000019/ui_analysis.md>)
- [`04_UI/Analysis/UX-000020/ui_analysis.md`](<../../../04_UI/Analysis/UX-000020/ui_analysis.md>)
- [`04_UI/Analysis/UX-000021/ui_analysis.md`](<../../../04_UI/Analysis/UX-000021/ui_analysis.md>)
- [`04_UI/Analysis/UX-000022/ui_analysis.md`](<../../../04_UI/Analysis/UX-000022/ui_analysis.md>)
- [`04_UI/Analysis/UX-000023/ui_analysis.md`](<../../../04_UI/Analysis/UX-000023/ui_analysis.md>)
- [`04_UI/Analysis/UX-000024/ui_analysis.md`](<../../../04_UI/Analysis/UX-000024/ui_analysis.md>)
- [`04_UI/Analysis/UX-000025/ui_analysis.md`](<../../../04_UI/Analysis/UX-000025/ui_analysis.md>)
- [`04_UI/Analysis/UX-000026/ui_analysis.md`](<../../../04_UI/Analysis/UX-000026/ui_analysis.md>)
- [`04_UI/Analysis/UX-000027/ui_analysis.md`](<../../../04_UI/Analysis/UX-000027/ui_analysis.md>)
- [`04_UI/Analysis/UX-000028/ui_analysis.md`](<../../../04_UI/Analysis/UX-000028/ui_analysis.md>)
- [`04_UI/Analysis/UX-000029/ui_analysis.md`](<../../../04_UI/Analysis/UX-000029/ui_analysis.md>)
- [`04_UI/Analysis/UX-000030/ui_analysis.md`](<../../../04_UI/Analysis/UX-000030/ui_analysis.md>)
- [`04_UI/Analysis/UX-000031/ui_analysis.md`](<../../../04_UI/Analysis/UX-000031/ui_analysis.md>)
- [`04_UI/Analysis/UX-000032/ui_analysis.md`](<../../../04_UI/Analysis/UX-000032/ui_analysis.md>)
- [`04_UI/Definitions/UI-000001/ui_definition.md`](<../../../04_UI/Definitions/UI-000001/ui_definition.md>)
- [`04_UI/Definitions/UI-000002/ui_definition.md`](<../../../04_UI/Definitions/UI-000002/ui_definition.md>)
- [`04_UI/Definitions/UI-000003/ui_definition.md`](<../../../04_UI/Definitions/UI-000003/ui_definition.md>)
- [`04_UI/Definitions/UI-000004/ui_definition.md`](<../../../04_UI/Definitions/UI-000004/ui_definition.md>)
- [`04_UI/Definitions/UI-000005/ui_definition.md`](<../../../04_UI/Definitions/UI-000005/ui_definition.md>)
- [`04_UI/Definitions/UI-000006/ui_definition.md`](<../../../04_UI/Definitions/UI-000006/ui_definition.md>)
- [`04_UI/Definitions/UI-000007/ui_definition.md`](<../../../04_UI/Definitions/UI-000007/ui_definition.md>)
- [`04_UI/Definitions/UI-000008/ui_definition.md`](<../../../04_UI/Definitions/UI-000008/ui_definition.md>)
- [`04_UI/Definitions/UI-000009/ui_definition.md`](<../../../04_UI/Definitions/UI-000009/ui_definition.md>)
- [`04_UI/Definitions/UI-000010/ui_definition.md`](<../../../04_UI/Definitions/UI-000010/ui_definition.md>)
- [`04_UI/Definitions/UI-000011/ui_definition.md`](<../../../04_UI/Definitions/UI-000011/ui_definition.md>)
- [`04_UI/Definitions/UI-000012/ui_definition.md`](<../../../04_UI/Definitions/UI-000012/ui_definition.md>)
- [`04_UI/Definitions/UI-000013/ui_definition.md`](<../../../04_UI/Definitions/UI-000013/ui_definition.md>)
- [`04_UI/Definitions/UI-000014/ui_definition.md`](<../../../04_UI/Definitions/UI-000014/ui_definition.md>)
- [`04_UI/Definitions/UI-000015/ui_definition.md`](<../../../04_UI/Definitions/UI-000015/ui_definition.md>)
- [`04_UI/Definitions/UI-000016/ui_definition.md`](<../../../04_UI/Definitions/UI-000016/ui_definition.md>)
- [`04_UI/Definitions/UI-000017/ui_definition.md`](<../../../04_UI/Definitions/UI-000017/ui_definition.md>)
- [`04_UI/Definitions/UI-000018/ui_definition.md`](<../../../04_UI/Definitions/UI-000018/ui_definition.md>)
- [`04_UI/Definitions/UI-000019/ui_definition.md`](<../../../04_UI/Definitions/UI-000019/ui_definition.md>)
- [`04_UI/Definitions/UI-000020/ui_definition.md`](<../../../04_UI/Definitions/UI-000020/ui_definition.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`05_SPEC/02_Use_Case_and_Behavior_Flow.md`](<../../../05_SPEC/02_Use_Case_and_Behavior_Flow.md>)
- [`05_SPEC/03_State_Transition_Model.md`](<../../../05_SPEC/03_State_Transition_Model.md>)
- [`05_SPEC/04_Actor_System_Sequence.md`](<../../../05_SPEC/04_Actor_System_Sequence.md>)
- [`05_SPEC/05_Error_Effect_and_Recovery.md`](<../../../05_SPEC/05_Error_Effect_and_Recovery.md>)
- [`05_SPEC/06_UI_SPEC_Correspondence.md`](<../../../05_SPEC/06_UI_SPEC_Correspondence.md>)
- [`05_SPEC/Analysis/IA-000001/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000001/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000002/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000002/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000003/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000003/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000004/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000004/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000005/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000005/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000006/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000006/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000007/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000007/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000008/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000008/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000009/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000009/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000010/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000010/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000011/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000011/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000012/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000012/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000013/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000013/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000014/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000014/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000015/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000015/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000016/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000016/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000017/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000017/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000018/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000018/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000019/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000019/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000020/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000020/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000021/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000021/spec_analysis.md>)
- [`05_SPEC/Analysis/IA-000022/spec_analysis.md`](<../../../05_SPEC/Analysis/IA-000022/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000001/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000001/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000002/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000002/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000003/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000003/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000004/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000004/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000005/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000005/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000006/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000006/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000007/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000007/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000008/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000008/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000009/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000009/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000010/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000010/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000011/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000011/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000012/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000012/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000013/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000013/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000014/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000014/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000015/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000015/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000016/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000016/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000017/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000017/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000018/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000018/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000019/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000019/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000020/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000020/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000021/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000021/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000022/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000022/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000023/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000023/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000024/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000024/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000025/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000025/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000026/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000026/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000027/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000027/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000028/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000028/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000029/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000029/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000030/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000030/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000031/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000031/spec_analysis.md>)
- [`05_SPEC/Analysis/UX-000032/spec_analysis.md`](<../../../05_SPEC/Analysis/UX-000032/spec_analysis.md>)
- [`05_SPEC/Definitions/SPEC-000001/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000002/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000002/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000003/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000003/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000004/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000004/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000005/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000005/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000006/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000006/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000007/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000007/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000008/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000008/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000009/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000009/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000010/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000010/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000011/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000011/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000012/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000013/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000013/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000014/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000014/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000015/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000015/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000016/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000016/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000017/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000017/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000018/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000018/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000019/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000019/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000020/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000020/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000021/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000021/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000022/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000022/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000023/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000023/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000024/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000024/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000026/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000026/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000027/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000027/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000028/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000028/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000029/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000029/spec_definition.md>)
- [`05_SPEC/Definitions/SPEC-000030/spec_definition.md`](<../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`99_Roadmap/Changes/CHG-000073/change.md`](<change.md>)
- [`template/04_UI/01_User_Interface.md`](<../../../template/04_UI/01_User_Interface.md>)
- [`template/04_UI/02_Surface_and_Region_Model.md`](<../../../template/04_UI/02_Surface_and_Region_Model.md>)
- [`template/04_UI/03_Interaction_and_State_Model.md`](<../../../template/04_UI/03_Interaction_and_State_Model.md>)
- [`template/04_UI/04_Visual_and_Accessibility_Direction.md`](<../../../template/04_UI/04_Visual_and_Accessibility_Direction.md>)
- [`template/04_UI/05_UI_SPEC_Handoff.md`](<../../../template/04_UI/05_UI_SPEC_Handoff.md>)
- [`template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md`](<../../../template/04_UI/Analysis/IA-XXXXXX/ui_analysis.md>)
- [`template/04_UI/Analysis/UX-XXXXXX/ui_analysis.md`](<../../../template/04_UI/Analysis/UX-XXXXXX/ui_analysis.md>)
- [`template/04_UI/Definitions/UI-XXXXXX/ui_definition.md`](<../../../template/04_UI/Definitions/UI-XXXXXX/ui_definition.md>)
- [`template/05_SPEC/01_Behavior_Specification.md`](<../../../template/05_SPEC/01_Behavior_Specification.md>)
- [`template/05_SPEC/02_Use_Case_and_Behavior_Flow.md`](<../../../template/05_SPEC/02_Use_Case_and_Behavior_Flow.md>)
- [`template/05_SPEC/03_State_Transition_Model.md`](<../../../template/05_SPEC/03_State_Transition_Model.md>)
- [`template/05_SPEC/04_Actor_System_Sequence.md`](<../../../template/05_SPEC/04_Actor_System_Sequence.md>)
- [`template/05_SPEC/05_Error_Effect_and_Recovery.md`](<../../../template/05_SPEC/05_Error_Effect_and_Recovery.md>)
- [`template/05_SPEC/06_UI_SPEC_Correspondence.md`](<../../../template/05_SPEC/06_UI_SPEC_Correspondence.md>)
- [`template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md`](<../../../template/05_SPEC/Analysis/IA-XXXXXX/spec_analysis.md>)
- [`template/05_SPEC/Analysis/UX-XXXXXX/spec_analysis.md`](<../../../template/05_SPEC/Analysis/UX-XXXXXX/spec_analysis.md>)
- [`template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md`](<../../../template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md>)
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)

</details>

## 3. 保持する意図と変更禁止範囲

- Discoveryの28探索、36要求、UXの36要求分析、32 Canonical UX成果および既存の多対多Relationを失わない。
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

### IA独立レビューの構造是正

| 指摘 | 原因 | 構造是正 |
|---|---|---|
| 31分析から19定義へ統合する際に、入力UX固有の対象・状態・導線が消失 | 分析成果物がひな型の7軸より縮小され、定義側に入力別の意味保持箇所がなかった | 31分析を対象・識別・関係・状態・可視性・導線・責任へ統一し、各定義に入力UX別の利用場面・対象・状態・導線を保持する |
| 実行基盤の故障範囲と、過去判断・現在意図が別責務へ混在 | 既存ID数の維持を優先し、独立した利用者判断かを再評価していなかった | 人間判断により`IA-000020`と`IA-000021`へ分割する |
| 定義で状態語や対象が初出し、分析から再現できない | 実装照合とIA判断の由来を分析へ残していなかった | 状態は入力分析にある利用者区分を正とし、実装上の状態実値は下流で対応付ける。IA固有の識別・関係は分析で理由を残す |
| 31分析・19定義の責任記述が定型文で、対象固有の利用場面が分からない | 構造準拠を自己完結性より優先した | UX定義から利用者、場面、目的、結果、重要場面、失敗、品質を各分析へ保持し、定義側も入力別に責任と判断を示す |
| ひな型、現行分析、Checker fixtureが別契約 | Checker試験が実ひな型を利用せず縮小fixtureを正としていた | 現行31分析とCheckerをひな型へ統一し、実ひな型を埋めた正例と縮小構造の負例を追加する |
| `REQ-000036`表示がDiscovery分析へ接続 | REQとEXPの所有境界をPath移行時に閉じていなかった | 現行Architecture 2件をDiscovery定義へ接続し、非固定文書の偽装参照をCheckerで拒否する |
| UX-000002／000003／000009で副次的な行動が消えた | 中心成果とは分けたまま、入力、待機、取消、回復、再試行、次判断のための情報を成立条件と下流引渡しへ保持する | 3 Definitionへ副次行動を復元し、新しい独立UXへ分割しない |
| 正式入力HeaderとPath候補が別々に成立し得た | コメントとcode fenceを除いた可視本文で、唯一の`分析対象:` Header自身が同じREQ Definitionを指す場合だけ正式入力とする | コメント／両fence内だけのHeaderと本文別位置Linkを拒否し、可視Headerと例示内重複は受理する反例を追加 |
| Markdown／HTML／本文Pathで復号処理が分かれ、通常文やエスケープ例をPathと誤認し得た | すべての実候補を一回だけ同じ復号器へ通し、不正entityを連続したDiscovery Path骨格がある場合だけ上位判定へ伝える | inline、full、collapsed、shortcut、footnote、HTML quoted／unquoted、本文Path、二重符号化、良性本文、literal／entity escapeの反例を同じ契約試験へ追加 |

fingerprint `595de7b4596403db7ddbdda4fa41ea4c21ab2aa8ca0cb314ea33596471c1da01`のIA再レビューでは、31分析、21定義、35関係の意味伝播と2件の分割は妥当と確認された。一方、実成果物が一致していてもCheckerがRoot台帳を含む三者の関係閉包を強制していないMajor 1件と、候補表示、ひな型再生成性、表現不一致のModerate 3件、英語実装語のMinor 1件が残った。意味本文と関係を変更せず、次の構造是正としてまとめた。

| 再レビューで残った問題 | 正しい状態 | 是正・反証 |
|---|---|---|
| Root台帳、分析の処置節、定義の情報源節を別々に読めた | 三つの正規区画から抽出した`(UX, IA)`関係が重複なしで完全一致する | 台帳だけのUX差替え、正規節外へのLink移動、同じ関係行または対象節の重複を拒否する |
| レビュー候補を現在有効な正本と表示した | 独立レビュー完了までは定義候補、採用後だけ意味の正本と表示する | Root図・説明・ひな型を候補と採用後の状態へ分ける。定義自体はレビュー前にCanonicalへ昇格しない |
| IA分析ひな型が7軸を自由文へ縮小できた | 利用者、場面、目的、得たい結果、重要場面、失敗、品質をひな型から再生成できる | 7軸表をひな型とfixtureへ移し、軸の欠落を反例にする |
| `UX-000013`の場面と英語実装語が文書内で不一致または未説明 | 正式入力、分析、定義が同じ平易な表現を持ち、正式語は日本語説明と併記する | 「リモート接続を開始・再接続する時」へ統一し、状態値と実装語を日本語表示付きにする |

fingerprint `44bffff8c93cab099272bc1648749cf9682603e7`の3レビューでは、Discovery／UXの意味伝播と関係は維持できていたが、エスケープ済み区切りを含む一つの文字列全体を除外すると、その後に独立して始まる有効なDiscovery参照まで見逃せることを検出した。Checkerは文字列全体を早期除外せず、参照開始候補ごとにエスケープ済み区切りとの連続性を判定する。区切りをエスケープした同じPathの例示は入力へ昇格させず、カンマやコロンの後に独立して始まる有効な参照は検査する正負反例を追加した。Discovery／UX本文、ID、関係およびIA以降は変更していない。

次の固定候補では、参照開始と境界を復号前の文字列で別々に探すと、数値entityで表した`01`やコロンを見逃せることを検出した。escaped spanだけを識別子へ置き換えた後、同じ一回復号結果から参照開始とPath連続性を判定し、その結果を再復号せず正式入力検査へ渡す形に統一した。decimal／hexadecimalのroot、numeric／unknown entityの境界、numeric slashで継続する同一Path、および従来の非発火例を同じ試験で反証する。

fingerprint `2feaa8ed3deabd412432364f8b85873d2231dfe90ccaa51bddf1a2a557516a45`のIA再レビューでは、31分析、21定義、35関係の閉包と、前回指摘された意味伝播・候補表示・ひな型再生成性の是正を確認できた。一方で、回復の行動と未解消の義務が一つの対象へ畳まれていたこと、コードフェンスやHTMLコメント内の偽構造を関係として数え得たこと、および同じ正式語の日本語表示と実装語の説明に残りがあることを検出した。次の三点を同じIA候補の構造是正として扱った。

| 再レビューで残った問題 | 固定した境界 | 是正・反証 |
|---|---|---|
| 回復処置と回復義務が同じ対象・状態として見えた | 回復義務は終了後確認まで残る責任、回復処置はその義務を解消するための行動とする | `IA-000003`と入力UX 3件で、義務発生→処置中→処置済み・終了後未確認→義務解消の状態変化、対象、関係、下流引き渡しを分離 |
| 非表示MarkdownがIA関係の成立根拠になり得た | Root台帳、分析の`IA処置`、定義の`情報源`は表示されるMarkdownだけから抽出する | バッククォート／チルダのコードフェンスとHTMLコメントだけに置いた構造を拒否し、正式構造と非表示重複が共存する正例を追加 |
| 同じ正式語の日本語表示と実装語の説明が揺れた | 一つのIA定義内では正式語に一つの日本語表示を対応させ、内部名は平易な役割説明と併記する | 正式契約、能力維持の根拠、接続中の作業単位、作業領域、選択結果、準拠、現在有効な意図を統一し、接続部・実行観測・実行時データ等の説明を追加 |

fingerprint `84ba5ef934944e4c16d2f42b7ef0cbb124515f5dac6f7dfb9d4026df22589071`の再レビューでは、回復処置と回復義務の分離、および非表示Markdownによる関係偽装の是正はPassした。21定義の全数再走査により、対象表と関係図を別々に平易化した5定義で同じ正式語の日本語表示がまだ一致せず、9分析で内部実装名の役割説明が不足していることを検出した。対象表の表示名を一次キーとして関係図を統一し、現行構造欄の内部名は意味を変えず「平易な役割（正式名）」で示す。ID、35関係およびIA統合境界は変更しない。

同じ固定候補の構造レビューでは、閉じた非表示領域の反証はPassしたが、未閉鎖HTMLコメントを文末まで非表示として扱えず、コメント内のフェンス記号とフェンス内のコメント記号が互いの状態を誤変更し得ることを検出した。IA専用の二段置換を、表示中／コードフェンス内／HTMLコメント内を一回で区別する状態走査へ置き換える。未閉鎖コメントだけに置いた三つの正規構造を拒否し、コメント内の未閉鎖フェンスまたはフェンス内の未閉鎖コメントの後にある正式構造を保持する正負例を追加する。

### IA内容と工程境界の再確認

UXで確立した「読みやすい既存構造を維持し、不足する意味と可視Checklistだけを補う」方針をIAへ適用した。32件のUX定義、32件のIA分析、22件のIA定義、4件のRoot／横断成果物、6件のひな型を同じ責務境界で見直した。

| 確認したこと | 結果と処置 |
|---|---|
| 正式入力 | IA分析は対応するUX Definition 1件だけを正式入力とし、現行文書・実装との比較は後続Reality Auditの参考情報へ分離した |
| IA分析の自己完結性 | 利用者成果、情報候補、識別・関係、状態、可視性、導線、時間差、優先度、まとまり、責任、判断権限、失敗、未確認事項、戻り条件および検証意図を同じ成果物で処置した |
| IA定義の自己完結性 | 全入力UXの利用場面を保持し、対象・識別・関係、状態・可視性・時間差、優先度・まとまり・見つけ方、責任・判断権限、失敗・制約・未確認事項および検証意図を単独で理解できるようにした |
| 工程Handoff | UIとSPECはUX＋IAを正式入力とする。Quality Analysis / IAは伴走入力とし、Architecture／Sourceへの直接Handoffは作らない |
| 横断投影 | Object／Relation、Structure／Navigation、State／Visibility／Responsibilityの3投影で全22 IA IDを一件ずつ処置し、個別定義の第二の正本を作らない |
| 作成者の自己確認 | 32分析、22定義、Root 1件、横断投影3件の末尾へ成果物別の可視`## Checklist`を置いた。6ひな型は`[ ]`と結果語彙の説明を持ち、完成成果物は評価済み状態だけを持つ |
| Checker責務 | 正式入力、32分析／22定義の閉包、台帳との関係一致、3横断投影の全ID処置、正確な後続接続、成果物別Checklistおよび6ひな型を機械検査する。本文と自己評価の意味的一致は独立レビューへ残す |

初回独立レビューでは、構造閉包がPassしていても、31分析が共通の生成形へ寄り、Object・同一性・関係、責任・判断権限およびUX固有の未確認事項を再構築できないことを検出した。固定候補`033ab744f958880122f84409cbccc9c70026ff7e`はCritical 0／Major 2／Moderate 2でPass不可とし、次を一括是正した。

| 指摘 | 構造是正 |
|---|---|
| 複数Objectを一行へ集約し、利用者や成果をObjectとして図示した | 32分析をUX Definitionの必要情報から再分析し、Objectごとに意味・同一性を分けた。図は情報Objectだけを用い、関係名付きの縦配置・分岐表示へ変更した |
| 責任と判断権限が同文だった | 情報を作成・更新・提供する責任と、意味・状態・次の行動を確定する権限を分離し、22定義でも入力UX別に保持した |
| UX固有の未確認事項を循環参照へ置換した | 確認事項、判断者、現在判定、未確認時の影響を32分析と22定義へ継承し、IA固有の追加事項と分けた |
| 横断投影が全IDで同文だった | 3投影で各IA IDの対象領域と横断確認内容を個別表示し、Object投影には孤立・循環・関係欠落の確認結果を追加した |
| IA規則にArchitecture直接接続が残った | IAはUI／SPECへ意味を渡し、ArchitectureはUI／SPECを正式入力として分析する表現へ統一した。工程Gapは通常Handoffと分けた |
| Checker試験名が保証範囲より広かった | 「後続関係表への直接Handoff追加を拒否」に限定し、Object表、未確認事項、責任・権限の必須構造を機械検査へ追加した |

固定候補fingerprint `1dd241d57c1b0d5e7b4bf9a7a7a6f77843949211`の再レビューは、前回指摘のうちObject別記述と図の可読性を確認した一方、Object集合の処置、Identity／Relationの変換、責任主体の意味、およびCheckerの集合閉包にMajor 2件／Moderate 1件を検出し、Pass不可とした。次の構造是正を同じIA変更として適用した。

| 再レビューで残った問題 | 正しい状態 | 是正・反証 |
|---|---|---|
| 分析Objectの一部がCanonical化候補表で暗黙に未処置となり、定義側の入力Objectと一致しなかった | 全分析Objectが`Same／Rename／Merge／Split／Not Applicable`のいずれかで明示処置され、Definition Mappingと完全一致する | 32分析の全Objectを一行以上で処置し、DefinitionのSource Object・Canonical Objectとのexact集合閉包をCheckerへ追加した。重複は全行`Split`だけ、`New`と実在しないSource／Targetを拒否する反証を追加した |
| Object名だけが接続され、IdentityとRelationの変換根拠が不足した | Source Analysisの識別条件・関係からCanonical定義を再構築でき、利用側で再解釈しない | 22定義へ`Identity／Relationの変換`を追加し、全分析・定義の可視Checklistへ自己確認を追加した。IA-000009はSessionとWorkspace Grantの識別を分離し、IA-000010は会議・会議項目・論点・関係の意味を保持するMappingへ是正した |
| 責任主体名が実在する組織・Roleの確定に読めた | IAは情報契約上必要な機能責任だけを定義し、実際の人物・組織・Componentへの割当を後続へ残す | 英語の仮想Role名を平易な機能責任へ置換し、32分析、22定義、横断責任モデル、ひな型およびCheckerへ「割当を確定しない」契約を明示した |
| Checkerが表の存在だけを確認し、Object集合の欠落・余分・誤接続を受理し得た | Analysis処置集合とDefinition Mapping集合が同じSource／Target／処置を表す | 集合抽出、処置語彙、N/A理由、重複Split、Source実在、Target実在、全Target Coverage、およびAnalysis↔Definition exact closureを機械検査と負例で固定した |

### UI独立レビューの構造是正

初回UI独立レビューは、31件のUX観点分析、21件のIA観点分析、19件のUI定義という配置と関係閉包だけでは、個別UIの意味が十分に再構成されたとは言えないことを検出した。指摘を次の三クラスタへまとめ、全件を同じ固定候補で是正する。

| 指摘 | 原因 | 構造是正 |
|---|---|---|
| 静的な文書・素材を含むUX観点分析へ同じ実行Lifecycleが投影された | ひな型の状態例を個別UXの意味より先に適用した | 利用開始、成果成立、成果不成立、判断不能を基本とし、待機、取消、回復、権限差は入力UXが必要とする場合だけ追加する |
| UI定義がUX成果とIA構造を個別に列挙するだけで、両者の対応が曖昧だった | UI ID単位の集約を、UXとIAの意味統合とみなした | 実際の`UX × IA`関係ごとに、利用者成果、必要な情報、区別する状態、導線、Feedbackを対応付ける。信頼判断は準拠、完全性、配布者、利用者方針、品質主張を別軸にする |
| 横断状態文書が全UIへ実行状態を強制するように読めた | 共通Variantと個別UIへの適用条件を分けていなかった | 19 UIの適用範囲表を先に置き、取消・回復を含む完全Lifecycleは該当UIだけに適用する |
| 移動済み現行UI参照、現在の件数、試験数が追随していなかった | 責務移動後の派生文書と記録への参照閉包が不足した | 固定Evidence本文とHashは変更せず、旧参照と現在の`04_UI/06_Current_Interface_Reference.md`の対応をこのCHGで明示する。CHGの件数と試験結果は現行候補へ同期する |
| Checker試験名が意味再構築まで保証するように読めた | 構造検査と独立した意味レビューの責務を区別していなかった | Checkerの保証を構造・正式入力・関係閉包へ限定し、意味の再構築可能性は独立レビューで確認する |

固定Evidence `CHG-000015/Evidence/260901_coordinator-completion-review.md`の旧`04_UI/01_User_Interface.md#4-現行表示の参照と表現方針`参照は、現在の[現行Interface参照 §4](../../../04_UI/06_Current_Interface_Reference.md#4-現行表示の参照と表現方針)へ移動した。固定Evidence本文は当時のHashを保つため変更しない。

是正後の再レビューでは初回指摘をすべて解消したが、19 UI定義の`両観点の統合判断`と`SPECへの引き渡し`が同じ意味を全文複製し、横断引き渡し文書も共通状態を全UIへ要求するように読めるModerate 1件が残った。統合判断をUI意味の唯一の正本とし、後者を`UI／SPEC対応レビューへ渡す項目`へ変更した。ここにはUX／IA ID、UIで観測可能にすべき操作・Feedback、SPEC側で未確定の入力・成功・停止・結果だけを置き、統合済みの利用者成果・情報・状態・導線は再掲しない。横断文書もUIごとの適用範囲で選ばれた状態だけを渡す契約へ修正した。UI ID、名称、UX／IA関係、状態適用判断および固定Evidenceは変更していない。

再々レビューは、19 UI定義の旧引き渡し節がすべて廃止され、`両観点の統合判断`が唯一のUI意味正本であること、37件のUX×IA関係が統合判断と対応レビュー入力で完全一致すること、横断文書が個別UIの適用範囲を優先することを確認した。結果はCritical 0／Major 0／Moderate 0／Minor 0でPassしたため、52分析を分析済み、19定義をCanonicalへ昇格し、UI工程をSPECへ引き渡す。

### Architecture再構築

| 確認したこと | 結果 |
|---|---|
| 正式入力 | UI定義19件、SPEC定義28件だけを正式入力として固定した |
| 分析網羅 | UI観点19件、SPEC観点28件を別々に分析し、未分析0件 |
| 責務統合 | 同じ上位責務境界に属する結果を17のArchitecture定義へ統合した。状態Owner、Authority、Effect、失敗領域またはlifecycleが異なる入力はSibling blockと独立状態機械として保持した |
| 現行照合 | 既存Tool設計を正式入力ではなく、成立済み能力・移行対象・未接続範囲の照合先として接続した |
| 機械反証 | 正式入力への別工程混入、分析欠落、Root台帳・分析・定義の関係不一致をCheckerで拒否する |
| 図による引継ぎ | Rootへ全体図、横断状態表、Sequence、型／Port、DFD、ER、Schema責務を置き、各定義へ責務別ブロック・状態を置いた |

Architecture定義の再構築後、Qualityが必要とする検証単位、境界、状態・Resource、故障および実行条件をRoot一冊から再構成しにくいことを検出した。個別定義の追加では解消せず、Rootを入口・台帳・Ready判定へ絞り、次の横断モデルを固定構成として追加した。

| 横断モデル | 構造是正 | Qualityへの引渡し |
|---|---|---|
| Component／責務 | 17定義を状態Owner、所有／非所有、Portで統合 | UT／Component候補 |
| 境界／Interface | Component、外部System、Platform、Trust境界とSequenceを統合 | IT／契約／外部境界候補 |
| Runtime／Data Flow | Data、State、Identity、Authority、ERを統合 | 状態／整合性／情報流候補 |
| 故障／回復／耐障害 | 部分故障、取消、Retry、Recovery、cleanup、終了条件を統合 | 故障注入／回復／残存候補 |
| 配置／実行 | 論理実行単位、Resource、並行性、段階的結合を統合 | 実行環境／Timing／Resource候補 |

現行Source、Directory構成、既存試験およびv0.20.1実装はCanonical Architectureの正式入力から外し、Architecture Ready後のReality Audit対象へ分離した。これにより、既存実装からComponentを逆算せず、成立済み能力との照合も失わない。

横断モデルの初回独立レビューは、個別定義が正しくても、統合図・既存試験・機械検査への伝播が未完了であることを検出した。4点を同じArchitecture Closureとして是正した。

| 指摘 | 原因 | 構造是正 | 反証 |
|---|---|---|---|
| 読取り専用の実行事実取得へ旧Publisher／Writerが再混入 | 基準版能力と新しいCanonical責務を横断図で混同した | 既存Sourceを現在責務の外側に置き、読取りProjectionだけをCanonical Flowとした | Schema責務とDFDの双方で生成・保存を非所有化 |
| DFD・状態遷移・ERの意味を一意に再構成できない | 見た目だけの図を正式記法へ変換していなかった | DFDのActor／Process／Store／分類、状態ID・Guard・処置、ERの関係ID・方向・多重度を明示 | Checkerが必須構造と図記号の欠落を拒否 |
| 既存Test CatalogをCanonical候補の根拠へ誤接続 | Reality AuditとQualityへの新規入力を同じ参照で表した | 既存corridorはv0.20.1詳細設計へ戻し、5横断モデルは未分析のQuality入力として別表化 | Catalog 19件とRepository link検査 |
| 横断モデルのCheckerが見出し存在しか確認しない | ファイル単位の存在を責務閉包とみなした | 横断節、5成果物の必須構造、Component責務表と17定義の完全一致を検査 | 節全欠落、定義欠落・未知・重複、列欠落、空見出しだけの負例 |

基本設計のレビューPass後、Architecture工程を`Analysis → Definitions → Details`の三層へ具体化した。17件の基本設計へ`ARCH-000001`から`ARCH-000017`を採番し、既存の個別Architecture領域を`Details/`へ移した。物理移動だけで正本化せず、次の閉包を追加した。

| 詳細設計の論点 | 固定した状態 | 機械反証 |
|---|---|---|
| ARCH-IDと詳細領域の混同 | ARCH-IDは基本設計、詳細領域は実装可能な構造。多対多Relationで接続 | 17 ARCH-ID、詳細設計対応表、15領域文書のRelation集合を完全一致 |
| 不要な詳細成果物の量産 | Component、Interface、Data／State、Sequence、Failure、Deployment、Observability、Securityを`Required`／`N/A`で判断し、N/Aへ理由を要求 | 判定値、理由、参照先の欠落を拒否 |
| Checklistだけの完了 | Concurrency、Timing、Resource、External Boundary、Failure／RecoveryへResult、Rationale、Evidenceを要求 | 不明なResult、空理由、空Evidenceを拒否 |
| 既存Sourceからの逆算 | Canonical詳細設計を固定してからReality Auditで照合 | Detailsは現行実装との照合を独立節として持つ |

初回独立レビューは、45件の分析を作成しただけでは入力固有の状態・操作・副作用が共通表現へ失われ、7つの大分類には別の状態Ownerやlifecycleが同居していたことを検出した。これは表現改善ではなく、UI／SPECからArchitectureへの意味伝播不成立として扱った。

| 指摘クラスタ | 根本原因 | 構造是正 | 確認方法 |
|---|---|---|---|
| 入力固有契約の欠落 | 見出し構造だけを写し、UIの状態差とSPECの副作用適用可否を分析へ保持しなかった | UIは成果・表示・操作・状態差・アクセシビリティ・制約、SPECは目的・契機・Authority・状態・副作用・検証義務を正式入力からそのまま保持する | UI-000004、UI-000005、読取り専用SPECを含む45分析を再レビューする |
| 7分類への過剰統合 | 話題の近さを責務同一性とみなし、Owner、Authority、Effect、失敗、lifecycleの差を失った | 独立状態機械を17責務へ分け、UI-000005のような多対多関係を許容する | Root台帳・分析・定義のRelation集合を機械的に完全一致させる |
| 定義の自己完結不足 | 参照先と一般的な設計語だけで定義を構成した | 各定義へ所有／非所有、入力別7軸比較、block、状態遷移、失敗、非該当、成立済み能力比較、実装引渡しを置く | 定義だけから責務境界と検証義務を再構成する独立レビューを行う |
| 基準版能力との比較不足 | 現行設計へのLinkを置くだけで保持・新規・Gapを比較しなかった | 基準版Capability、旧照合先、新Owner、保持状態、Evidence、Gapを責務ごとに明示する | v0.20.1の成立済み能力を削除・置換していないことを照合する |
| Checker正例が弱い | 見出しと短いPlaceholderでも正例になった | 実際の状態・Authority・Effect・失敗境界を持つ正例へ変更し、多対多関係の重複と欠落を別々に拒否する | Checker契約試験とRepository全体Checkerを実行する |

第2回独立レビューでは、入力固有の契約を分析へ保持した一方、定義後半で責務全体のAuthority、Effectおよびlifecycleへ再び一括化した箇所を検出した。特に`SPEC-000008`の読取り契約へEvent発行・保存を混ぜたことと、Project実行内の受付・照会・分類・清掃・再接続を同じ状態機械として扱ったことを、Major 2件として是正した。

| 第2回指摘 | 根本原因 | 構造是正 | 機械反証 |
|---|---|---|---|
| 読取り責務へ書込み能力を再導入 | 基準版能力の比較対象と、今回の責務が所有する能力を混同した | 実行事実取得を既存Sourceの読取りProjectionへ限定し、Event PublisherとStore Writerを非所有にした | `SPEC-000008`のAuthority、Effect、失敗およびlifecycleを入力別表で固定する |
| 責務内の入力差を後半節で消失 | 統合後もSibling blockである受付・照会・分類・清掃・再接続を、責務全体の状態機械へまとめた | 全17定義の統合、Interface、品質、失敗をUI／SPEC入力ごとの行へ接続し、前blockのAuthorityやEffectを継承しない | 入力別7軸表、Interface表、品質表の欠落、正規節外Relation、重複Relation、Placeholder定義を拒否する |
| 基準版Evidenceの粒度不足 | 現行設計節の一般参照を能力の証拠として扱った | 基準版Capabilityごとに旧Owner、現行照合先、試験IDまたは新規未実装を明記する | 成立済み能力と新規責務を同じEvidence状態へ丸めない |

第3回独立レビューでは、入力別のArchitecture定義は改善した一方、Root Architectureに基準版のEvent Publisher／Store Writerが現在の読取り責務として残り、UI-000002の「取消す」「判断を返す」に対応するSPECが存在しないことを検出した。実行知の現行書込み能力は基準版Capability比較へ限定し、現在のCanonical Architectureを既存記録Sourceからの読取りPortへ統一した。操作不足はArchitectureで推測せず、UX-000003とIA-000002／IA-000003へ戻り、取消の終了確認をSPEC-000028、判断返却と同じTaskの再開をSPEC-000029として独立契約化した。

### Discovery内容の再確認

Quality設計の一区切り後、工程成果物を上から一工程ずつ読み直す方針へ切り替えた。Discoveryでは28探索と36要求を全数確認し、共通の10章構成へ一括変換すると、既存の良好な因果と転換点が分断されることを確認した。

| 確認したこと | 結果と処置 |
|---|---|
| ひな型と実成果物の章構成差 | 探索記録は題材に応じた物語順を維持する。見出し差を不備にせず、必要な意味を一意に見つけられない状態を不備とした |
| 短い遡及探索の自己完結性 | 現在地、未確認事項またはUXへの引き渡しが暗黙だった10件を、既存REQの意味を変えず補強した |
| Discovery状態の境界 | 7件に残っていた下流の成立状態や現行実装・運用の断定を、Discoveryが所有する採用判断、利用者成果、反証条件および戻り先へ戻した |
| 36要求の再構築可能性 | 全件が、対象、利用状況、問題、望ましい変化、比較、成立条件、制約、検証意図およびUX引き渡しを単独で保持している。2件に混入していた下流の表示語を、元の探索から導ける利用状況と次行動へ戻した |
| 補足的な分析 | 各工程のひな型に補足欄を持てる共通規則を追加した。必須情報の退避や雑記にはせず、繰り返す補足は標準項目への昇格候補とする。Discoveryの2ひな型へ先行適用した |
| 作成者の自己確認 | Discovery Root、探索記録、要求定義の末尾へ、成果物ごとの責務に合わせた可視の`## Checklist`を置く。`[x]`は必要な処置を本文へ残した状態、`OPEN`／`FAIL`／`N/A`は理由付きの正式結果、`[ ]`はひな型だけで許される未評価状態とした。Checklistは自己確認の記録であり、Checkerや独立レビューの代替にしない |

UX以降のひな型と実成果物は、Discoveryのレビューを閉じてから工程順に扱う。この節の確認を、UX以降の一括変換または実コードとのReality Audit開始の根拠にはしない。

Discovery固定候補`4e398ccef6c876d007c52bc54904506568be8f6f`は、物語と必要意味、Definition単独での再構築可能性、遡及記録の忠実性、Discoveryと下流状態の分離、補足欄の標準化経路について一度Passした。その後、作成者の自己確認を非表示の編集指示ではなくCanonical成果物へ残る正式結果にする方針を採用したため、このPassは可視Checklist変更後の候補へ流用しない。新候補では、全28探索、全36要求、Rootおよび3ひな型のChecklist、機械検査の責務境界を再レビューする。

可視Checklist変更後の初回再レビューは、全1,032項目を一律`[x]`にしたことで、図示の処置や未確認事項の評価が本文と矛盾する自己評価を検出した。また、ひな型が未評価と`OPEN`を混同し得る説明であり、Checkerが末尾配置と成果物種別固有の項目集合を確認していなかった。次の三点を同じDiscovery変更として是正した。

| 指摘 | 原因 | 是正 |
|---|---|---|
| 本文根拠のない`[x]` | 成果物ごとの評価をせず、共通Checklistを一括適用した | 65成果物の1,024項目を本文へ再照合した。再レビューで、次工程に残した検証事項を未確認事項なしと評価した8件を検出して`[x]`へ是正し、最終的に913件を`[x]`、非該当111件を理由付き`N/A`とした。Root 8件と合わせて`[x]`921件、`N/A`111件、未評価・未完了・不適合は0件 |
| ひな型の状態説明が曖昧 | 未評価を`OPEN`へ対応させるように読めた | `[ ]`はひな型だけの未評価、`OPEN`は評価済みだが必要処置が未完了、`FAIL`は不適合、`N/A`は非該当として3ひな型へ同じ定義を表示 |
| Checkerが任意の単一項目を受理 | 可視性と評価形式だけを検査し、末尾・成果物種別固有の構造を検査していなかった | Root／EXP／REQの項目集合と順序を検査し、最後の必須項目以降を可視空白だけに限定した。通常段落、H3、引用、表による後続本文を拒否する。ひな型では説明と項目の間を含むChecklist以降のH1〜H6も拒否し、項目を別Sectionへ移せない。本文と評価の意味的一致は独立レビューへ残した |

### UX内容と工程境界の再確認

Discoveryで確立した「物語として理解できる本文＋成果物上に残る自己確認」をUXへ順番に適用した。章数を増やすことを目的にせず、現行6章の流れを維持しながら、36要求分析、32 UX定義、5横断成果物および7ひな型を同じ責務境界で見直した。

| 確認したこと | 結果と処置 |
|---|---|
| 要求別分析の自己完結性 | REQの意味、利用者・目的・成果、利用前後の変化、UX統合判断、重要場面、失敗、品質期待および次工程への接続を同じ`ux_analysis.md`で理解できるようにした |
| UX定義の自己完結性 | 利用者、利用場面、目的、成果、成立条件に加え、利用前後の変化、重要な失敗、品質期待、責任境界、制約、対象外、未確認事項および戻り条件を定義単独で保持した |
| 複数REQの統合 | 13件の複数REQ入力を持つUX定義で、最初のREQだけでなく全入力REQの未確認事項をREQ ID付きで保持した。中心成果と追加条件の区別は維持した |
| 工程Handoff | UXの直後工程はIA、Quality Analysis / UXは伴走、UI／SPECはIA完了後にUX定義とIA定義の双方を使う後続Relationとした。個別分析・定義に残っていたArchitecture／検証への直接引き渡し欄は削除し、UXが所有しない後続設計を先取りしない構造へ統一した |
| 作成者の自己確認 | Root 5件、要求分析36件、UX定義32件の末尾へ成果物別の可視`## Checklist`を置いた。ひな型は`[ ]`、完成成果物は本文に処置を残した項目を`[x]`とし、状態語の意味をDiscoveryと揃えた |
| Checker責務 | 7成果物種別ごとの項目集合、順序、末尾配置、実成果物の評価済み状態およびひな型の未評価状態を機械検査する。5つのRoot正本と7ひな型の欠落、4つの横断投影における全UX IDの欠落・重複、旧直接Handoffの再導入も拒否する。本文と自己評価の意味的一致は独立レビューへ残す |

初回独立レビューは、自己完結性と工程境界の補強を確認した一方、次のMajor 3件とModerate 1件を検出した。局所修正ではなく、正本、ひな型、Checkerおよび契約試験を同じ変更として閉じた。

| 指摘 | 原因 | 構造是正 |
|---|---|---|
| 旧Architecture／Verification直結が個別成果物に残存 | 新しい工程Handoffを追記しただけで旧欄を利用側まで閉じていなかった | 36分析と32定義から旧直接Handoffを削除し、IA、Quality Analysis / UX、IA後のUI／SPEC Relationだけを保持 |
| 4横断成果物が全UX ID処置を示せない | 横断合成を文章と図だけで表し、入力集合との閉包が暗黙だった | Persona、Experience Map、Service Blueprint、Quality Expectationsへ32 UX IDの一回限りの対応表を追加 |
| 人間確認の自己評価が一般文だけだった | ひな型の汎用文を個別成果物へ一括適用した | 68個別成果物へ現在判定、確認事項、判断者、未確認時の影響を明示し、未確認事項を完了主張へ畳まない |
| Checkerが正本・ひな型欠落と横断閉包を見ない | Checklist内部だけを検査していた | 正本／ひな型欠落、横断投影の欠落・重複、旧Handoff再導入を固有Findingと反証試験で固定 |

第2回独立レビューは初回4指摘の解消を確認したうえで、構造閉包後に残った意味の所有先と検査方式を指摘した。

| 指摘 | 原因 | 構造是正 |
|---|---|---|
| 分割した兄弟UX 7件で同じ「利用者に起きる変化」を所有 | 元REQの共通背景を分割後のCanonical成果へ複製した | 委任前／委任中／失敗後、記録の読取り／作成、素材の保守／閲覧を各UX固有の変化へ分離。32定義で同一節の完全重複0件を確認 |
| Service Blueprintの主区間に意味上の誤配置 | 32 IDの全数投影を機械生成し、個別定義の利用場面より語句を優先した | 32件を個別定義から再判定し、委任前、待機、対象選択、外部利用、成果物引渡し、記録作成等を6区間へ配置し直した |
| 旧Handoff検査が禁止文言へ依存 | 必須4行の存在検査と特定語検索だけで余分な接続を拒否できなかった | Rootは正式引渡し3項目、分析・定義は許可4接続先のexact集合を構造抽出する。言い換えたArchitecture直接行を追加する反証試験を追加 |
| UX Centerが31件の過去Passを現在状態として表示 | 過去候補のレビュー結果と32件候補の工程Gateを分離していなかった | 31件Passを履歴へ限定し、現在32件候補の再レビュー状態をCHGと一致させた |
| 2分析の判断者文が崩れていた | 利用者説明の機械合成で修飾先がずれた | 「CRDD閲覧者」を代表する利用者と括弧内の対象者へ書き直した |

### UI／SPEC内容と工程境界の再確認

IA工程を閉じた後、UIとSPECを別々の専門工程として見直し、双方がReadyになった後にだけ対応レビューを行った。既存の意味を章数へ機械的に合わせず、自己完結性、正式入力、未確認事項、検証意図および可視Checklistを同じ候補で閉じた。

| 提案項目 | 判定 | 現行での実現方法 | 処置 |
|---|---|---|---|
| UX観点とIA観点の分離分析 | 採用 | UI 54分析、SPEC 54分析 | 各観点の正式入力を一件に限定し、他観点やREQを正式入力へ混在させない |
| 個別定義の自己完結性 | 採用 | UI 20定義、SPEC 29定義 | 成立条件、失敗、制約、未確認事項、戻り条件および検証意図を定義内に保持 |
| 可視Checklist | 採用 | 168個別・Root成果物で評価済み | 完成成果物は`[x]`、ひな型は`[ ]`とし、Checkerが成果物種別固有の項目集合を検査 |
| UI契約Ready、UI工程Exit、SPEC Readyの独立判定 | 採用 | 各Rootの現在状態 | UI契約を対応レビューへ渡せる状態と、Prototype／実画面・人間判断を含むUI工程Exitを分ける。片側の完成を他方で補完しない |
| UI／SPEC対応レビュー | 採用 | `05_SPEC/06_UI_SPEC_Correspondence.md` | 31組をShared Context、State、Trigger、Result、Failure、Recovery、Authority、Visibility、Constraint、Coverage、Evidenceで全数確認 |
| 第三のUI／SPEC仕様 | 不採用 | 対応文書はClosure Evidence | GapはUI、SPEC、IAまたはUXの所有工程へ戻し、対応文書で新しい契約を定義しない |
| Architecture／Sourceからの補完 | 不採用 | Reality Auditを分離 | UIとSPECの不足を下流設計や現行実装から逆輸入しない |

固定Commit `8652bf59`の独立レビューでは、Critical 0の一方で、UIにMajor 3／Moderate 1、SPECにMajor 3／Moderate 2／Minor 1、対応ClosureにMajor 2／Moderate 1を検出し、Pass不可とした。主因は、上流UX／IAの未確認事項をUI／SPECで「なし」へ畳んだ情報劣化、UI契約ReadyとUI工程Exitの混同、外部送信Effect成立後の結果不明契約不足、および対応表が関係一覧だけで個別レビュー根拠を持たないことだった。現在は、正式入力の未確認事項を全分析・定義へ継承し、31組の個別Evidence、UI-000004とSPEC-000002の委任関係、外部送信の要求・受理・Effect・結果搬送・再観測を是正した候補を独立再レビューへ渡す段階である。

固定Commit `1e700eec`の第2回独立レビューでは、初回の情報劣化は解消した一方、Critical 0／Major 7／Moderate 3が残った。重複を統合すると、委任体験のUI横断投影不足、外部送信の要求発行前判定と要求受理後のEffect不明の混同、正式入力Definitionと分析記録の集合未検査、およびUI／SPEC対応Evidenceが8観点の節Anchorへ到達できない問題だった。次を同じ候補で是正し、旧結果を流用せず再レビューする。

| 残った問題 | 正しい状態 | 是正と反証 |
|---|---|---|
| UI-000004が節目の委任を閲覧へ縮退 | 委任前の対象・範囲・権限・受入条件、受理・拒否・判断待ち・結果不明、Task／Objective／Milestoneの別々の完成をUI契約と横断投影で認識できる | UI定義、表示面、操作・状態モデルを更新し、SPEC-000002の受入条件をUI-000002とUI-000004へ分けた |
| 外部送信のinvalid／unknown分岐が要求発行後に見える | 同意不成立は要求発行0。要求受理後のEffect観測不能とEffect成立後の結果搬送失敗を別状態にする | SPEC-000021を`Effect不明`と`Effect成立・結果不明`へ分離し、同じ依頼識別情報・自動再発行0・再観測を反証条件へ追加した |
| Definitionの正式入力が分析Linkだけでも通る | UX／IA Definitionの正式入力集合と観点別分析集合が完全一致し、両者の責務を区別する | 全49定義へ正式入力と変換根拠を分離記録し、片側欠落をChecker契約試験で拒否する |
| 対応表のPassが節根拠を持たない | 31組ごとにShared Contextの積集合と8観点のUI節／SPEC節／判定／理由を辿れる | 組別Evidenceを追加し、共有集合、両側Anchor、固定改訂版、受入条件と`pairs_with`の一致をCheckerで検査する |
| Rootの件数とGate表示が古い | 現行集合の32 UX／22 IA／54分析／29 SPEC／20 UIと、UI契約Ready・工程Exit待ちを区別する | Root件数を現行集合へ直し、件数不一致と状態混同を反証対象へ追加した |

固定Commit `a881571f`の第3回独立レビューでは、構造上の31組Closureと360件の契約試験Passを確認した一方、Critical 0／Major 2／Moderate 2／Minor 1が残った。対応表の汎用理由が、UI-000004とSPEC-000002の実際の状態不一致を隠したことを主要因として、次を同じ候補で是正した。

| 第3回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| 委任結果の状態・結果・回復が未閉包 | UI側だけが拒否、判断待ち、結果不明およびTask／Objective／Milestoneの完成差を持っていた | SPEC-000002へ同じ結果区分、同一依頼再観測および段階別受入を追加し、組別Evidenceで一対一に照合した |
| SPEC-000021の回復Ownerが不明 | 回復処置と終了条件を定義したが、再観測を所有する機能責任とAuthorityを結合していなかった | 元の依頼識別情報と状態照会Capabilityを持つ送信側機能責任をOwnerとし、再観測Authorityを照会だけへ限定した |
| UI Gate語彙が二義的 | `UI Ready`をUI契約成立と工程Exitの両方に使っていた | 独立成立は`UI Contract Ready`、専門確認後の共同Gate待ちは`UI Phase Exit Pending`、共同Gate完了だけを`UI Ready`とした |
| 31組の理由が8個の汎用文を反復 | 行の存在を組別の意味確認とみなした | 248行をUI-ID、SPEC-ID、対象固有の契約事実を持つ理由へ置換し、重複理由、旧汎用文、対象ID欠落をCheckerで拒否した |
| 再レビュー入力を再構成できない | 自己参照するCommit記録だけへ依存した | UI／SPEC Definition集合のSHA-256を正本へ固定し、Definition変更後の古い指紋を専用Findingで拒否した |

固定Commit `06799f96`の第4回独立レビューでは、SPEC単体はCritical／Major／Moderate／Minor 0でPassした。UI単体とUI／SPEC Closureは、31組・248行のうち240行が対象IDと定義見出しを差し替えた共通文であり、実際の状態、操作、結果、失敗、回復、Authority、可視性および制約を確認した根拠にならないため、Major 1件でPass不可とした。構造上の全数閉包を意味上の確認と誤認したことが原因である。

同じ指摘を局所的な文言変更で閉じず、248行すべてを`UI事実（UI-ID）「具体的事実」／SPEC事実（SPEC-ID）「具体的事実」／対応: 判断理由`へ置換した。ひな型も同じ記録形式へ改め、Checkerは対象組の両ID、両側事実および対応理由の構造だけを検査する。意味的一致の判断は独立レビューへ残し、見出しの言い換え、片側事実だけ、別組IDの混入を契約試験で拒否する。全体CheckerはError／Warning 0、全回帰は360／360 Passである。更新した固定候補は旧レビュー結果を流用せず、UI、SPEC、UI／SPEC Closureの3系統へ再提示する。

固定Commit `fd837e46`の第5回独立レビューでは、UI単体の自己完結性は満たした一方、UI／SPEC ClosureにMajor 2／Moderate 1、SPECにMajor 2／Moderate 1が残った。具体的事実という形式へ変えただけで、複数SPECへ分かれるUIの責務を組ごとに限定できておらず、18行は省略記号で根拠を欠いていた。また、取消要求後の状態と実行記録公開中の状態がCanonical定義から欠けていた。

| 第5回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| 複数SPECに同じUI事実を流用 | UI全体の契約事実を組別Evidenceへ複製し、組が所有する責務を限定していなかった | 31組×8観点を共有UX／IAと対象Definition節から再生成し、送信・結果搬送・候補採否、実行・取消・判断返却を組ごとに分離した |
| UI-000002とSPEC-000028の取消Lifecycle不足 | 取消操作の存在だけを対応とみなし、要求受理、取消確定、結果不明、回復要否をUI状態へ投影していなかった | UI-000002へ`cancel_requested`、`cancelled`、`cancel_unknown/recovery_required`と同じRecovery Identityでの再観測を追加した |
| SPEC-000030の公開途中状態不足 | IA-000022が要求する準備・公開中・確定を最終状態だけへ縮退した | `prepared`、`publishing`、`recorded`、`not_recorded`、`unknown`を別状態として定義し、要求、Effect、完了を同一視しない契約へ戻した |
| 省略・題名置換でもCheckerを通せる | 形式とIDだけを検査していた | 省略記号、題名だけ、同上等を拒否し、両側事実が指定Anchor節の本文へ接続することを検査する。題名置換と省略記号の反証試験を追加した |

固定Commit `aaa925d7`の第6回独立レビューでは、取消Lifecycle、公開途中状態、31組・248行の構造閉包は確認できた一方、UI単体にMajor 1、SPEC単体にMajor 1、UI／SPEC ClosureにMajor 2が残った。原因は、複数SPECへ接続するUIの組別Evidenceへ、同じUIまたはSPECを共有する別の組の責務を再び混ぜたことである。

| 第6回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000002の委任受付・状態照会・取消を混在 | UI全体の状態集合を各SPECとの組へ流用した | SPEC-000002は提案・受理・拒否・blocked、SPEC-000003は通常Task状態、SPEC-000028は取消Lifecycleへ分離し、別組の状態・結果・回復を各Evidenceから除外した |
| SPEC-000002の受付と上位受入を混在 | 一つのSPECを共有するUI-000002とUI-000004の責務差を無視した | UI-000002との組は委任範囲・Authority・受理可否、UI-000004との組はTask完了・Objective受入・Milestone受入へ分離した |
| UI-000004の現在地投影へ委任結果を混在 | Project状態の読取りと委任・受入を同じProject操作として扱った | SPEC-000006との組をSource・Coverage・Freshness、不完全性および読取りAuthorityへ限定し、委任・上位受入をSPEC-000002との組へ戻した |
| UI-000016の送信・結果搬送・候補採用を混在 | 一連の外部連携を一つの結果として各組へ複製した | SPEC-000021は同意・要求・Effect・結果搬送、SPEC-000026は応答受領と未信頼候補返却、SPEC-000027は候補の採否と正本Effectへ分離した。要求受理後のEffect不明とEffect成立後の結果不明も別状態とし、どちらも自動再送しない |

固定Commit `07d70d86`の第7回独立レビューでは、前回の隣接責務混在は解消した一方、UI、SPEC、UI／SPEC Closureの各レビューにMajor 1件ずつが残った。三件はいずれも、正本内または対応Evidenceへの意味伝播を局所更新で止めたことに起因する。

| 第7回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000016の引渡し・横断投影が旧一状態 | 主Feedbackと対応Evidenceだけを更新し、同じUIの利用側投影を閉じなかった | 引渡し節と横断状態モデルへ`Effect不明`と`Effect成立・結果不明`の表示意味、禁止する自動再送および別々の戻り先を伝播した |
| UI-000004／SPEC-000002に委任受付が残存 | UI-000002から上位受入を除いた一方向だけの分離だった | UI-000004正本へObjective／Milestone受入・差戻し・判断待ち、対象別Authorityおよび三段階を追加し、当該組をTask完了→Objective受入→Milestone受入だけへ限定した。委任の提案・受付・拒否はUI-000002との組へ限定した |
| 227／248行の対応理由が定型句 | 両側事実を引用した後も、関係をSPEC題名と汎用判定規則だけで説明した | 既に具体化済みの21行を保持し、残る220行を、同じ行の具体的UI事実とSPEC事実を用いた状態対応、発火条件、結果投影、失敗表示、戻り先、Authority、可視性および制約の関係文へ置換した。旧定型句0件とDefinition集合指紋を機械確認する |

固定Commit `79a7cb7b`の第8回独立レビューでは、UIにMajor 1、SPECとUI／SPEC ClosureにMajor 2が残った。旧定型句を消すための機械置換が、引用済み事実を8種類の新定型文へ当てはめただけで、組ごとの対応判断になっていなかった。また、UI-000004の三段階受入を追加した際に、上位モデルへ旧委任責務が残り、SPEC-000002には差戻し契約が不足していた。

| 第8回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000004の旧委任責務が横断投影へ残存 | Definitionと主対応組だけを更新し、Surface／Interaction／隣接組までConsumer Closureを取らなかった | 委任の提案・受付・拒否・範囲見直しをUI-000002へ限定し、UI-000004をTask根拠、Objective／Milestoneの受入・差戻し・判断待ちへ統一した |
| SPEC-000002が上位差戻しを契約しない | UI側だけへ差戻し操作・状態を追加した | Objective／Milestoneごとの契機、事前条件、受入・差戻し・判断待ち、戻り先、Authorityおよび下位完了から上位受入を推定した場合のEffect 0をSPEC正本へ追加した |
| 220行が8種類の新定型文 | UI事実とSPEC事実の引用を意味判定と誤認し、共通文へ機械展開した | 31組×8観点を再読し、248行すべてへ組・観点固有の対応、非対応、禁止する推定、戻り先またはAuthority境界を記録した。対応理由は248件すべて一意で、旧8定型句0件を確認する |

固定Commit `29c8ebc9`の第9回独立レビューでは、三段階受入契約と旧委任責務の除去を確認した一方、UIにMajor 2、SPECとUI／SPEC ClosureにMajor 1が残った。個別化した対応理由が、両Definitionにない状態・Gate・前提・表示項目を追加して第三仕様になっていた。また、委任責務はUI-000004から除外しただけで、新OwnerのUI-000002正本へ提案・受付・拒否・範囲見直しを正方向に伝播していなかった。

| 第9回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000002が移管後の委任責務を自己完結しない | 旧Ownerからの除外を移行完了とみなし、新Owner Definitionへの正方向伝播を確認しなかった | UI-000002へ提案・受付・拒否・同じ提案の範囲見直し、その状態、Feedback、戻り先を追加し、実行中・取消・判断返却と分離した |
| 対応Evidenceが第三仕様を作る | 固有説明を増やす際に両正本から導けない状態名、Gate、前提条件、表示義務を補った | 対応理由を両Definitionにある事実の一対一、包含、独立軸または片側固有の説明へ限定する。必要な新契約はOwner Definitionへ戻し、Evidenceだけで補完しない |
| UI-000016の二つの不明状態が組間で再混在 | 組ごとの責務より一連の外部連携Flowを優先した | SPEC-000021ではEffect不明とEffect成立・結果不明の意味・戻り先・自動再送禁止を保持し、SPEC-000026を結果受領・Identity照合・未信頼候補返却だけへ限定した |

固定Commit `7e3b5949`の第10回独立レビューは248行を全数監査し、問題60行を一括で特定した。問題なしは188行である。主要因は、異なる状態軸や兄弟SPECの責務を一つの対応へ畳んだこと、およびEvidenceだけで新しい状態、Gate、前提、回復、表示義務または実装規則を追加したことである。

| 第10回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000002内に旧委任状態と導線が残存 | 詳細節だけを更新し、統合判断と表示面をConsumerとして閉じなかった | IAが所有する準備中／許可待ち／実行中／停止を利用者向けLifecycleとして保持し、提案・受付可能・受付済み・拒否を受付Feedbackとして全利用箇所へ伝播した。拒否時は同じ提案の範囲見直し、受付結果不明時は同じ依頼の再観測へ接続する |
| UI-000016に採用・却下・保留の三結果が未投影 | SPEC-000027の三分岐をEvidenceで補い、UI Ownerへ戻さなかった | 採用は候補が所有正本へ反映された状態、却下・保留は既存の判断（Decision）へ返る結果値として操作、Feedback、戻り先、Handoffへ伝播した。後二者をCandidate状態へ追加せず、同じ候補と出所へ結合し所有正本を変更しない |
| 60行で軸混同または第三仕様化 | 個別説明を増やす過程で、両正本から導ける関係と望ましい追加設計を分離しなかった | 全問題行を両側の既存事実、一対一／包含／独立軸／片側固有、兄弟組の所有先だけで書き直した。固有回復なしのSPECへ回復入口を追加せず、未定義の状態・Gate・表示・実装規則を除去した |

固定Commit `bbf31cff`の第11回独立レビューでは、第10回の問題60行が直接には全件是正され、31組、248行および三段階受入の閉包を確認した。一方、SPEC側の詳細状態をUIの正式入力より優先した逆流と、結果受領・候補採否の兄弟責務混入を新たに検出した。

| 第11回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000002でSPECの受付結果をLifecycle状態へ置換 | SPECとの一対一対応を優先し、IAが所有する利用者向け状態を上書きした | 準備中／許可待ち／実行中／停止をLifecycleとして復元し、提案・受付可能・受付済み・拒否を受付Feedbackへ分離した。受付結果不明はIAの不明状態契約に基づく条件付き表示とし、Lifecycleへ追加せず同じ依頼の再観測へ接続した |
| UI-000016で却下・保留をCandidate状態化 | SPEC-000027の結果値とIAのCandidate Lifecycleを同じ軸へ畳んだ | 採用時だけ候補を採用状態へ進め、却下・保留は同じCandidate Identityへ結合する判断（Decision）の結果値として示す。Interaction、Definition、HandoffおよびEvidenceを同じ非対称性へ統一した |
| SPEC-000026のRecoveryへ採否導線を混入 | 外部結果のIdentity照合失敗時にも候補が成立していると仮定した | Identity欠落・曖昧な応答は隔離して採用可能候補にせず、失敗理由と安全な戻り先だけを示す。候補成立、採否、同候補への復帰およびProvider Effect再発行を当該組へ追加しない |
| SPEC-000027のResultへ未定義の理由結合を追加 | 追跡可能性をEvidenceだけで新しいfieldへ具体化した | 採否、反映先、Decisionから同じ候補・対象正本への関係だけを保持し、未定義の理由fieldを除去した |

固定Commit `ac68368a`の第12回独立レビューでは、SPECレビューが全248行をPassとし、UIとClosureに各Major 1件が残った。UI横断投影でLifecycleと受付Feedbackの分離が未伝播であり、SPEC-000027の通常の採否導線を失敗Recoveryへ再利用していた。

| 第12回指摘 | 原因 | 構造是正と反証 |
|---|---|---|
| UI-000002の横断投影とState対応に受付Feedbackが混在 | Definitionの軸分離を上位Consumerと対応理由へ閉じなかった | 横断投影でUX-000002のLifecycle、UX-000003のTask Lifecycle、受付Feedbackおよび受付結果不明の再観測条件を別々に示した。State対応から拒否と停止の対応を除き、拒否を受付Feedbackだけへ限定した |
| SPEC-000027の通常採否導線を失敗Recoveryへ転用 | 同じ候補へのDecision結合と失敗時の安全な帰還を同じ戻り先とみなした | Recoveryは失敗理由と安全な戻り先の表示までに限定し、戻り先、回復状態、再試行または再実行方法をEvidenceで特定しない。同じ候補への結合はState・Resultだけで保持した |

固定Commit `ab20ff4b`の第13回独立レビューでは、UI、SPEC、UI／SPEC Closureの3系統がいずれもCritical／Major／Moderate／Minor 0でPassした。全20 UI Definition、29 SPEC Definition、横断成果物、ひな型、31組・248 Evidence行を再確認し、Lifecycleと受付Feedback、通常の採否と失敗Recovery、および兄弟SPEC間の責務が分離されていることを確認した。Repository CheckerはError 0／Warning 0、契約試験は360／360 Passである。

## 6. 完了条件

| Gate | 完了条件 |
|---|---|
| Structure | Discovery 28 Analysis／36 Definitions、UX 36 Analysis／32 Definitions、IA 32 Analysis／22 Definitions、UIはUX観点32 Analysis／IA観点22 Analysis／20 Definitions、SPECはUX観点32 Analysis／IA観点22 Analysis／29 Definitions、ArchitectureはUI観点20 Analysis／SPEC観点29 Analysis／18 Definitions／5横断モデル／15 Details、Qualityは全157 Canonical IDを処置するAnalysis 1件／Verification Definition 13件がCanonical配置にある |
| Self-contained | 子成果物が対象固有の意味、成立条件、関係および下流入力を単独で説明できる |
| Downstream Reproducibility | `Definitions/REQ-*`からUXを、UX定義からIAを、UX＋IA定義からUIとSPECを、UI＋SPEC定義からArchitectureを情報劣化なく再構成できる。各工程は正式入力より上流を直接参照して不足を隠さない |
| Projection | Discovery／UX Rootから全Analysis・DefinitionとCoverageを一意に辿れる |
| Consumer Closure | 正本文書、ひな型、Checker、CHG、RoadmapおよびArchitecture参照が新Pathへ移行する |
| Regression | 全体Checker、Checker契約試験、旧Root／共通Evidence再導入の反証がPassする |
| Independent Review | 文書、準拠、Gap／ImpactのCritical／Major／Moderateが0になる |

## 7. 現在の検証

| 確認 | 結果 |
|---|---|
| Discovery Analysis／Definition | 28／36 |
| UX Analysis／Definition | 36／32。全要求分析とUX定義を自己完結させ、複数REQを統合する13定義では全入力の未確認事項を保持した。Root 5件を含む73成果物と7ひな型へ成果物別の可視Checklistを適用し、直後工程IA、伴走するQuality Analysis / UX、IA後のUI／SPEC Relationを区別した。初回4指摘と第2回Major 1件／Moderate 3件／Minor 1件を是正し、独立再レビューCritical／Major／Moderate／Minor 0でPass |
| IA Analysis／Definition | 32／22。全入力UXの利用場面、対象、識別、関係、状態、可視性、時間差、導線、責任、判断権限、失敗および検証意図を保持した。209 Analysis Objectと157適用対象Source Identity行を全数照合し、DefinitionがAnalysisのIdentity／Relationを後付けで再解釈できないChecker契約を追加した。不一致0件、`Merge`／`Split` 0件、3横断投影は各22 IA-IDを一意に処置し、独立再レビューでIA工程を閉じた |
| UI Analysis／Definition | UX観点32／IA観点22／Definition 20。正式入力に残る未確認事項を全54分析と20定義へ継承し、UI固有判断と分けた。UI契約は対応レビュー入力Readyだが、Prototype／実画面評価と人間によるUI工程Exit判断はOPEN |
| SPEC Analysis／Definition | UX観点32／IA観点22／Definition 29。正式入力に残る未確認事項を全54分析と29定義へ継承した。全UX観点分析へSource固有の境界を明示し、外部送信のEffect成立後・結果不明・同一依頼再観測を独立契約として保持した。独立再レビューCritical／Major／Moderate／Minor 0でPass |
| Architecture Analysis／Definition／Details | UI観点20／SPEC観点29／Definition 18。第2回再レビューで、上流来歴を追加の正式入力と誤読できる表記、UI固有の失敗境界の取り落とし、`SPEC-000002`の実行受付と上位受入判断の重複、署名Authorizationの並行消費、CheckerのTiming、Coordinator詳細設計への現行状態混入、およびCheckerの表構造検査不足を検出した。49 Analysisの来歴表示と失敗境界、18 Definitionへの伝播、`ARCH-000004`／`ARCH-000005`の責務Slice、Artifact Signing／Checker／Coordinator詳細設計、Template Checkerと反証試験を是正した。現在状態はReview Candidateであり、更新後の固定候補を同じ3系統へ再レビューする |
| 全体Checker | `errors: 0`、`warnings: 0` |
| Discovery Checklist | Root 1件、探索28件、要求36件の全成果物に可視Checklistがあり、`[x]`921件、理由付き`N/A`111件、`OPEN`／`FAIL`／未評価の`[ ]`は0件。ひな型3件は可視Checklistと未評価の`[ ]`を持つ |
| Discovery Checklist契約試験 | 非表示だけのChecklist、完成成果物の`[ ]`、理由形式のない結果、Checklist後の本文、別成果物用Checklist、単一汎用項目、およびひな型の項目を後続Sectionへ移す構造を拒否し、理由付き`OPEN`／`FAIL`／`N/A`を受理するFocused試験4／4 Pass |
| Discovery Checklist独立レビュー | 固定候補fingerprint `69f65c1a01d9deeba0b5dc25a082b5b18c141e589fb6cdb81248cee5bc5730c4`、73ファイル、UX混入0件を読取り専用で確認した。全1,032項目の評価、8探索の未確認事項、3ひな型の5状態、CommonMark ATX／Setext見出しによる分断防止、完成成果物の末尾契約およびChecker責務分離を確認し、Critical／Major／Moderate／Minor 0でPass |
| UX Checklist独立レビュー | 固定候補fingerprint `cfed9a93f31fc80615b7d985d3d6a3cee941b890`を読取り専用で確認した。36要求分析、32 UX定義、5横断成果物、7ひな型、工程Handoff、兄弟UXの意味所有、横断投影およびChecker反証を確認し、Critical／Major／Moderate／Minor 0でPass |
| Checker契約試験 | 統合試験368件。UI／SPECの既存閉包に加え、Architecture分析の9観点表について正確な3列、閉じた判定語彙、根拠、欠落・余分を反証した。Architecture定義の未確認表は正式入力集合との完全一致、正確な5列、非空値を反証し、候補では理由付き`OPEN`／`FAIL`を保持しつつArchitecture ReadyではChecklistとEngineering Concernの未解決を拒否する |
| 全回帰入口 | Formatter確認、型検査、Lint、Repository Checkerを通過した。Checker試験本体は368／368 Pass、失敗・取消・skip 0。Repository CheckerはError 0／Warning 0 |
| 全TypeScript package静的入口 | 8／8 Pass。Formatter確認→型検査→Lintの順序と、該当package固有の静的契約検査を確認 |
| 独立再レビュー | fingerprint `85ebdabbbc890505ee760a9aee96c83fc2e14231`を3者が読取り専用で確認し、Critical 0／Major 0／Moderate 0でPass。Discovery DefinitionだけからのUX再構築、意味境界、関係、正式入力Path検査の正負例を確認 |
| IA独立レビュー | 最終固定候補fingerprint `8a2c25c001f4de2653cba62ccc09879cee3011b1`を読取り専用で確認した。32 Analysis／22 Definitions、209 Analysis Object、157適用対象Source Identity行、3横断投影、Template、`23_IA.md`、CheckerおよびHandoff境界を照合し、不一致0件、`Merge`／`Split` 0件を確認した。Critical／Major／Moderate／Minor 0でPass |
| UI独立レビュー | 固定Commit `ab20ff4b`について、全20 UI Definition、横断成果物6件、ひな型8件、UI／SPEC対応Evidenceを確認した。Lifecycleと受付Feedback、受付結果不明時の再観測、およびUI工程Gateの境界を維持し、Critical／Major／Moderate／Minor 0でPass |
| SPEC独立レビュー | 固定Commit `ab20ff4b`について、全29 SPEC Definition、横断成果物7件、ひな型9件を確認した。外部送信Effect、受付結果、Identity隔離、通常採否および失敗Recoveryの責務を維持し、Critical／Major／Moderate／Minor 0でPass |
| UI／SPEC対応レビュー | 固定Commit `ab20ff4b`について、31組×8観点の248 Evidence行を全数確認した。入力→両分析→20 UI／29 SPEC Definition→31組→248 Evidenceの閉包と、Evidenceが第三仕様を作らないことを確認し、Critical／Major／Moderate／Minor 0でPass |
| Architecture独立レビュー | 固定候補`05c4cbc95c315cd65851598be69da563b1416397`について、UI-000002の4操作、取消・判断返却のSibling block、読取りProjectionと基準版書込み能力の分離、19 UI／28 SPEC／17 Definitionの閉包を確認し、Critical／Major／Moderate／Minor 0でPass |
| Architecture詳細設計の独立レビュー | 15領域の責務とQuality引渡しを全数確認した。Execution IntelligenceのCanonical詳細を読取り専用へ限定し、基準版Writer／Storeを非CanonicalなReality Auditへ分離した。契約移行にはCovered ownerを置き、全ARCH-IDが少なくとも一つのCovered詳細領域を持つことを機械反証した。最終再レビューCritical／Major／Moderate／Minor 0でPass |
| Quality全件分析 | 157件のCanonical IDを13検証目標へ接続した。独立レビューで、目標名への接続だけではSource固有条件がLocal Itemへ届かず、実行記録の作成責務と成果物理解の検証が不足すると判明した。上流GapをUX-000032／IA-000022／UI-000020／SPEC-000030／ARCH-000018へ戻し、`Source ID → 検証目標`190関係、`Source ID → 検証目標 → Local Item`572関係と`詳細設計領域 → 検証目標`38関係をMapping・Definitionへ同じ集合で固定した。全81 Local Itemを11軸へ拡張し、検証目標ごとにUT／IT／ST／UATおよびRT／PT／LTの適用と外部境界の段階到達を固定した。独立レビューが見つけた、上流Mappingで必須の段階をDefinition側で任意化する不整合を、AIT-05／06、CQS-05／06、ERP-07、EST-06、PPR-07で是正した。さらに複数目標を持つSourceの段階を各目標へ一律適用していた曖昧さを解消し、`Source ID + 検証目標`ごとの試験段階、対応Local Item、Source全体行との和集合をCheckerで相互検査する。Quality Owner分離、Template、Current Profileおよび影響ファイル一覧を是正し、独立再レビュー中 |

固定Commit `d53875d8`までの工程間意味伝播は一度Passしたが、その後のArchitecture／Quality再構築で、取消・判断返却に加えて実行記録の作成側契約不足を検出した。いずれも下流で推測せず、UX／IAから導ける正式入力へ戻し、読取りと書込みのAuthority、Effect、失敗およびlifecycleを分離した。固定Commit `984aa466`と`eb544d6`へのArchitecture再レビューでは、現行UI／SPEC改訂のConsumer Closure、Checklist根拠、Detail Owner、Quality引渡し、Candidate／Ready Gateに続き、上流来歴の扱い、UI固有Failure、兄弟Architecture間の責務Slice、一回限りAuthorizationの並行消費、Timingおよび表構造の機械反証を検出した。現在は全指摘の是正候補を固定する段階であり、Architecture ReadyとQuality正式引渡しは停止している。現在、人間による追加判断は必要ない。
