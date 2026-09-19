# CRDD参照Toolのアーキテクチャ

Status: Review Candidate (v0.21.0, Released Baseline: v0.20.1)
Owner: Qual-Lab
Last Updated: 2026-09-15

## 1. 目的と現在状態

本書はArchitecture工程の固定入口である。CanonicalなUI／SPECから導いた18件の責務定義と、それらをQualityが検証設計へ使える形に統合した横断モデルを案内する。個別定義の内容を再定義せず、対象、網羅状態、主要判断、未解決事項および次工程への引渡しを所有する。

個別責務定義、横断モデルおよび15領域の詳細設計は、前回の独立レビューを完了している。現在は、成果物別の可視Checklist、8種類のEngineering ConcernおよびTemplate／Checker契約を追加した改訂候補を再レビュー中である。現行実装との一致は、Architecture再レビュー完了後にQuality工程でReality Auditとして判定する。

## 2. 工程入力と再構築方法

Architectureの正式入力はCanonicalな20件のUI定義と29件のSPEC定義である。UIとSPECを別々に全数分析し、同じ上位責務境界へ属する結果を18件のArchitecture定義へ統合した。

```text
UI定義 20件 ──→ UI観点のArchitecture分析 20件 ──┐
                                                     ├─→ Architecture定義 18件
SPEC定義 29件 → SPEC観点のArchitecture分析 29件 ─┘
                                                              │
                                                              ▼
                                                   Architecture横断モデル
                                                              │
                                                              ▼
                                                   Details（詳細設計）
                                                              │
                                                              ▼
                                                     Qualityへの引渡し
```

REQ、UXおよびIAは由来確認に限って参照する。現行Architecture、Source、Directory構成および既存試験は、成立済み能力との後段照合対象であり、正式入力にない意味を補う根拠にはしない。

| 入力種別 | 対象数 | 分析済み | 未分析 | 状態 |
|---|---:|---:|---:|---|
| UI定義 | 20 | 20 | 0 | 全数分析済み |
| SPEC定義 | 29 | 29 | 0 | 全数分析済み |

## Architecture定義台帳

| Architecture定義 | 所有する責務 | 入力UI | 入力SPEC | 状態Owner |
|---|---|---|---|---|
| [機械検査と文書検査](Definitions/ARCH-000001/architecture_definition.md) | 決定論的なRepository検査、文書構造検査、意味レビューへの案内 | UI-000001、UI-000018 | SPEC-000001、SPEC-000023 | Checker CoreとCRDD現行Profile |
| [契約移行と利用側閉包](Definitions/ARCH-000002/architecture_definition.md) | 責務移動時のProducer、Consumer、派生物、署名・Release経路の閉包 | UI-000014 | SPEC-000019 | 変更影響分析とConsumer Closure契約 |
| [変更・監査・試験・品質の閉包](Definitions/ARCH-000003/architecture_definition.md) | 同じ改訂版に対する指摘、是正、Evidence、未確認範囲、現在Gateの統合 | UI-000015 | SPEC-000020 | Quality Centerと変更追跡 |
| [Project実行](Definitions/ARCH-000004/architecture_definition.md) | Objective／Task受付、Project状態、判断待ち、取消、Recovery、再入場、結果 | UI-000002、UI-000003、UI-000012 | SPEC-000002、SPEC-000003、SPEC-000004、SPEC-000005、SPEC-000017、SPEC-000028、SPEC-000029 | Project Runtime |
| [Project・Portfolio状態投影と受入判断記録](Definitions/ARCH-000005/architecture_definition.md) | Project／Milestone／Objective／Task状態と複数Project比較の読取り投影、およびObjective／Milestoneの受入・差戻し・判断待ちの限定記録 | UI-000004 | SPEC-000002、SPEC-000006、SPEC-000007 | Project Management Projection／Objective・Milestone Acceptance Decision Record |
| [Meeting候補と正本への引渡し](Definitions/ARCH-000006/architecture_definition.md) | Meeting ItemからTopic／Decision候補を作り、出所と採否を追跡する | UI-000009 | SPEC-000013 | Project Operation Context |
| [実行事実と評価候補の取得](Definitions/ARCH-000007/architecture_definition.md) | 実行記録の解決、欠測を保つ読取り集約、非Authority評価候補 | UI-000005 | SPEC-000008 | 実行記録読取りProjection |
| [実行境界の診断](Definitions/ARCH-000008/architecture_definition.md) | 外部境界の到達、受理、開始、結果搬送、終了状態の観測 | UI-000005 | SPEC-000009 | Platform Access診断Port |
| [Repository境界とBinding](Definitions/ARCH-000009/architecture_definition.md) | Repository Root検証、Repository／Project Identity、実行対象Binding | UI-000006 | SPEC-000010 | Version Control PortとRepository Binding Resolver |
| [Tool CapabilityとAIモデル構成](Definitions/ARCH-000010/architecture_definition.md) | Tool能力の発見、AIモデル構成の検証・選択理由 | UI-000010 | SPEC-000014、SPEC-000015 | Capability RegistryとModel Configuration Resolver |
| [Runtime Dataの配置・保持・清掃](Definitions/ARCH-000011/architecture_definition.md) | `.crdd`とOS管理Runtime Rootの用途、Owner、耐久性、保持、清掃 | UI-000011 | SPEC-000016 | Runtime Data Contract |
| [公開Transportの意味同一性](Definitions/ARCH-000012/architecture_definition.md) | decode／encode、接続Lifecycle、公開Application Contractへの搬送 | UI-000007 | SPEC-000011 | MCP／CLI Transport Adapter |
| [Workspace利用範囲とRepository Federation](Definitions/ARCH-000013/architecture_definition.md) | Session Grant、Workspace、Repository Exposure、Federation | UI-000008 | SPEC-000012 | CROS Session／Workspace Resolver |
| [Runtime Artifactの信頼評価](Definitions/ARCH-000014/architecture_definition.md) | 準拠、完全性、Publisher、Trust Policy、公式識別の独立評価 | UI-000013 | SPEC-000018 | Runtime Trust Evaluator |
| [外部送信・結果帰還・候補採用](Definitions/ARCH-000015/architecture_definition.md) | 送信同意、最小化送信、結果帰還、候補隔離、採否 | UI-000016 | SPEC-000021、SPEC-000026、SPEC-000027 | External Information Boundary |
| [過去情報と現在有効な意図](Definitions/ARCH-000016/architecture_definition.md) | 出所、発生時点、対象改訂版、現在／履歴／置換済み／不明の解決 | UI-000017 | SPEC-000022 | Context Provenance Resolver |
| [公式素材の権利・用途確認](Definitions/ARCH-000017/architecture_definition.md) | 出所、権利確認、許可用途、対象版、決定権限者の記録 | UI-000019 | SPEC-000024 | 公式Repositoryの素材収載判断 |
| [実行事実の記録](Definitions/ARCH-000018/architecture_definition.md) | Canonical Event検査、複数作成側、並行公開、途中失敗、Effect不明時の回復 | UI-000020 | SPEC-000030 | 実行記録Writerと不変Store |

## Architecture横断モデル

| 成果物 | 所有する内容 | Qualityへの主な引渡し | 状態 |
|---|---|---|---|
| [Component／責務モデル](02_Component_and_Responsibility_Model.md) | Component、責務、状態Owner、所有禁止、主要Port | UT／Component検証 | 固定候補 |
| [境界／Interfaceモデル](03_Boundary_and_Interface_Model.md) | Component間、外部System、Platform、Trust境界と交換契約 | IT／契約／外部境界検証 | 固定候補 |
| [Runtime／Data Flowモデル](04_Runtime_and_Data_Flow_Model.md) | Data、State、Identity、Authorityの流れと整合条件 | 状態／整合性／情報流検証 | 固定候補 |
| [故障／回復／耐障害モデル](05_Failure_Recovery_and_Resilience_Model.md) | 故障領域、取消、Retry、Recovery、cleanup、終了条件 | 故障／回復／残存検証 | 固定候補 |
| [配置／実行モデル](06_Deployment_and_Execution_Model.md) | Process、Runtime、配置、実行単位、並行性、Resource | 実行環境／Timing／Resource検証 | 固定候補 |

横断モデルは個別定義の代替ではない。個別責務間の関係、共同成立条件およびQualityが検証単位へ変換するための情報を所有する。

## Architecture詳細設計

| 成果物 | 所有する内容 | 状態 |
|---|---|---|
| [詳細設計の対応表](07_Detail_Architecture_Map.md) | 18件のARCH-IDと詳細設計領域の多対多Relation、領域閉包、Qualityへの引渡し | Canonical |
| [`Details/*/01_Architecture.md`](Details/) | 15領域のComponent、Interface、Data／State Flow、Sequence、Failure／Recovery、配置、観測およびEngineering Concern | Canonical |
| `Details/*/*_Reality_Audit.md` | 基準版Capability、現行実装および既存試験との後段照合。Canonical詳細設計ではない | 照合資料 |

ARCH-IDは全体の基本設計Identityであり、詳細設計領域のIdentityではない。一つのARCH-IDを複数領域が具体化でき、一つの領域が複数ARCH-IDを実現できる。詳細設計は基本設計のコピーではなく、「何を成立させるか」を「どの構造・境界・Flowで成立させるか」へ具体化する。

## 基本図の処置

| 基本図 | 正本 | 処置 | 未確認範囲 |
|---|---|---|---|
| 全体／内部ブロック図 | [Component／責務モデル](02_Component_and_Responsibility_Model.md#2-全体ブロック図) | 作成 | 物理実装との対応 |
| 状態遷移表／状態遷移図 | [Runtime／Data Flowモデル](04_Runtime_and_Data_Flow_Model.md#3-横断状態遷移) | 作成 | 実装上の状態値 |
| ブロック間シーケンス図 | [境界／Interfaceモデル](03_Boundary_and_Interface_Model.md#4-主要なブロック間シーケンス) | 作成 | 物理Process上の順序 |
| クラス／型関係図 | [境界／Interfaceモデル](03_Boundary_and_Interface_Model.md#3-型とportの関係) | 作成 | 物理型名 |
| DFD | [Runtime／Data Flowモデル](04_Runtime_and_Data_Flow_Model.md#2-主要データフロー) | 作成 | Workbenchの物理通信方式 |
| ER図 | [Runtime／Data Flowモデル](04_Runtime_and_Data_Flow_Model.md#4-概念entity関係) | 作成 | 物理Schema |
| Schema責務図 | [境界／Interfaceモデル](03_Boundary_and_Interface_Model.md#5-schema責務) | 作成 | 物理field |
| 故障／回復図 | [故障／回復／耐障害モデル](05_Failure_Recovery_and_Resilience_Model.md#2-故障と回復の全体図) | 作成 | 実装別の再試行上限 |
| 配置／実行図 | [配置／実行モデル](06_Deployment_and_Execution_Model.md#2-論理配置図) | 作成 | OS／Processの物理配置 |

## 5. Architecture Ready判定

| 条件 | 現在状態 | 根拠／次の処置 |
|---|---|---|
| UI／SPEC全数分析 | 再レビュー候補 | 20 UI、29 SPEC、未分析0。現行UI／SPEC Contractを再転記し、Source固有の観点評価と未確認事項を追加した |
| 個別責務定義 | 再レビュー候補 | 18定義、台帳と完全一致。現行49分析からAuthority、Effect、Lifecycle、失敗および未確認事項を再統合した |
| 5横断モデル | 前回Pass・影響再確認待ち | 前回固定版のPass履歴を保持し、現行分析／定義の変更影響を再確認する |
| Qualityへの検証観点 | 再レビュー候補 | 15詳細領域の検証対象、反証する失敗、観測、終了後条件、未確認範囲を再照合した |
| Reality Audit境界 | 定義済み | [配置／実行モデル](06_Deployment_and_Execution_Model.md#5-reality-auditへの引渡し) |
| 基本設計の独立レビュー | 是正後再レビュー待ち | 固定Commit `984aa466`のMajor指摘を是正し、新しい固定候補を再レビューする |
| 詳細設計 | 再レビュー候補 | [詳細設計の対応表](07_Detail_Architecture_Map.md)を基準に、15領域のRelation、必要成果物、Engineering Concernを具体化した |
| 詳細設計の独立レビュー | 是正後再レビュー待ち | 所有責務、Quality引渡し、結果語彙およびCanonical／Reality Audit境界の指摘を是正し、新しい固定候補を再レビューする |

前回固定版のArchitecture Ready履歴は保持する。現在の改訂候補は、Checklist／Engineering Concern拡張後の独立レビュー指摘を是正中であり、Architecture Readyを再確定していない。

## 6. 保持する意図と対象外

- Project RuntimeはProject-levelの意味と状態を所有し、Provider選定、Transport、OS操作を所有しない。
- Transport、Execution編成、観測、Platform、Trust、Qualityを独立責務として保つ。
- Workbenchは正本を複製せず、同じApplication Contractを使う薄い操作面とする。
- Sourceや既存DirectoryからCanonical Componentを逆算しない。
- この工程で物理Schema、使用Framework、Process数、OS配置を先決めしない。
- v0.20.1の成立済み能力を失わないが、基準版実装を新しい意味の根拠にしない。

## 7. 次工程への引渡し

Qualityは個別ARCH定義、5つの横断モデルおよび対応する詳細設計領域を入力にする。ただし現行改訂候補の独立再レビューがPassし、Architecture Readyを再確定するまでは正式引渡しを開始しない。Ready後もUT／IT／ST等の名称を先に割り当てず、責務、境界、状態、故障、実行条件から検証単位を導く。Source、既存試験および基準版実装との照合はCanonical詳細設計が完成した後のReality Auditとして別に行う。
