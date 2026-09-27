# IA-000023のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000023`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000023 標準Project Contextの情報定義](../../../03_IA/Definitions/IA-000023/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から、表示で見分ける情報、優先順位、導線および開示境界だけを導く。

## 2. UIへ引き継ぐ情報構造

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| Project Context Projection | Repositoryの現在状態を読む共通入口 | Project ID＋Repository ID＋Repository Role |
| 現在事実 | 正本から得た現在の結論 | Owner Relationへ戻る |
| 共有分析 | Risk、課題、依存、影響、選択肢 | 導出元、前提、確実性、再評価条件を示す。独自IDを付けない |
| 不完全性 | 欠測、競合、未反映、判断不能 | 正常値と分け、Ownerまたは再投影へ進む |
| Project Status | 五つの観点をまとめた回答 | 現在地、Risk・停止、判断待ち、理由・根拠、次の一手 |
| 期限状態 | Version期限とRoadmap項目期限 | `set`／`not_set`。未設定時の日程リスクは`not_evaluated` |
| 追加推論・提案 | Front AIが対話時に加える内容 | 現在事実・共有分析と見分けられる表示にする |

## 3. 表示の優先順位とNavigation

```text
Project／Repository Identity
        ↓
現在地・Scope・Version／節目
        ↓
Risk・停止・判断待ち
        ↓
理由・根拠・Owner Relation
        ↓
共有分析・選択肢・次の一手
        ↓
不完全性・再投影要否
```

一つの状況確認で五つの観点をまとめて示し、詳細確認では各観点からOwner Artifactへ戻れるようにする。項目別観測時点、Live状態、Deploy先またはInfrastructure Healthを表示契約へ追加しない。

## 4. 表示差と開示境界

| 観点 | UIでの処置 |
|---|---|
| 現在事実／共有分析／追加推論 | ラベル、まとまり、順序のいずれかだけに依存せず区別する |
| Current／Conflict／Incomplete／Unknown | 一つの正常状態へ畳まない |
| 期限設定済み／未設定 | 未設定を安全またはRiskなしと表示しない |
| Repository Role外 | 存在開示権限なしにContext名・Repository名・件数を表示しない |
| Owner変更未反映 | 古いProject Contextを現在値として表示せず、競合とOwner導線を示す |

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000004 Project・節目・Portfolioの状況把握](../../Definitions/UI-000004/ui_definition.md) | Same | 五場面、現在事実、共有分析、不完全性、期限状態、Owner Relation | Projectの現在地を理解する既存UI責務を具体化する |
| [UI-000007 入口をまたぐ共通依頼・結果](../../Definitions/UI-000007/ui_definition.md) | Same | Consumer間で同じProject Contextの意味を保持する | 入口を変えても結果意味を変えない既存責務を利用する |

## 6. UX観点との統合時に確認すること

UX側が求める利用者成果・重要場面と、五場面・事実・分析・提案・不完全性・期限状態の表示が対応することをUI定義で確認する。固定Markdownの物理構成やWorkbenchの具体画面はUI Detailで比較する。

## 未確認事項・人間判断・戻り条件

| 区分 | 内容 |
|---|---|
| 未確認事項 | 一画面・Markdownでの情報量、五場面の優先順位、共有分析の訂正導線、期限入力の負担 |
| 判断者 | プロジェクト運営者／PMを代表する利用者とQual-Lab |
| UIへ戻す条件 | 五場面が分断される、事実と分析を見分けられない、または固定構造が人間の理解を妨げる場合 |
| IAへ戻す条件 | Consumerごとに別の情報Objectまたは同一性が必要と判明した場合 |

## 検証意図

固定Project Contextから五場面をまとめて理解でき、現在事実・共有分析・追加推論、期限未設定、不完全性およびRole外非開示を取り違えない表示契約を導けることを確認する。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるIA Definitionを一件だけ特定した
- [x] IAのObject、Identity、Relation、State、Visibilityおよび導線を保持した
- [x] 表示の優先順位とNavigationを評価した
- [x] 表示差と開示境界を評価した
- [x] UI候補への処置と理由を明示した
- [x] UX観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとUIまたはIAへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] UX、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] Behavior Ruleを先取りしていない
- [x] 補足分析へ必須情報を退避していない
