# UI Detail

成果物種別: UI Detail統合投影
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的と移行境界

v0.21.0でCanonical化した20件のUI Definitionを、新しいUI Detail契約へ全件移行した現在状態を示す。既存実装、Workbench WIPまたは画面案を入力にせず、UI Definitionの利用者成果、情報、操作、状態およびFeedbackから導出した。

```text
20 UI Definition
      ↓ 全件処置
4 UI Area Design Guide
      ↓
20 SCR + 20 PRT + Interaction
      ↓
29 BHVとの31 Detail Relation
      ↓
Architecture／Quality
```

## 2. UI Definitionの処置

| UI ID | UI Definition | Detail適用 | UI Area | SCR／PRT／CMP | 理由 |
|---|---|---|---|---|---|
| `UI-000001` | 事前検査と意味レビューへの案内 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000001／PRT-000001](Areas/operation/SCR-000001/screen.md) | Canonical Definitionから導出 |
| `UI-000002` | 委任・実行状態・判断 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000002／PRT-000002](Areas/operation/SCR-000002/screen.md) | Canonical Definitionから導出 |
| `UI-000003` | 失敗後の再試行・回復・清掃 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000003／PRT-000003](Areas/operation/SCR-000003/screen.md) | Canonical Definitionから導出 |
| `UI-000004` | Project・節目・Portfolioの状況把握 | Applicable／Covered | [project-context](Areas/project-context/area.md) | [SCR-000004／PRT-000004](Areas/project-context/SCR-000004/screen.md) | Canonical Definitionから導出 |
| `UI-000005` | 実行事実と故障境界の診断 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000005／PRT-000005](Areas/operation/SCR-000005/screen.md) | Canonical Definitionから導出 |
| `UI-000006` | Repository内作業と対象選択 | Applicable／Covered | [project-context](Areas/project-context/area.md) | [SCR-000006／PRT-000006](Areas/project-context/SCR-000006/screen.md) | Canonical Definitionから導出 |
| `UI-000007` | 入口をまたぐ共通依頼・結果 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000007／PRT-000007](Areas/operation/SCR-000007/screen.md) | Canonical Definitionから導出 |
| `UI-000008` | Workspace接続と利用可能範囲 | Applicable／Covered | [configuration-trust](Areas/configuration-trust/area.md) | [SCR-000008／PRT-000008](Areas/configuration-trust/SCR-000008/screen.md) | Canonical Definitionから導出 |
| `UI-000009` | Meeting・Topic・候補の処置 | Applicable／Covered | [project-context](Areas/project-context/area.md) | [SCR-000009／PRT-000009](Areas/project-context/SCR-000009/screen.md) | Canonical Definitionから導出 |
| `UI-000010` | Tool・AIモデル構成の選択 | Applicable／Covered | [configuration-trust](Areas/configuration-trust/area.md) | [SCR-000010／PRT-000010](Areas/configuration-trust/SCR-000010/screen.md) | Canonical Definitionから導出 |
| `UI-000011` | 実行時データの保持・清掃 | Applicable／Covered | [configuration-trust](Areas/configuration-trust/area.md) | [SCR-000011／PRT-000011](Areas/configuration-trust/SCR-000011/screen.md) | Canonical Definitionから導出 |
| `UI-000012` | Agent間の情報引継ぎと再接続 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000012／PRT-000012](Areas/operation/SCR-000012/screen.md) | Canonical Definitionから導出 |
| `UI-000013` | Runtime信頼判断と公式識別 | Applicable／Covered | [configuration-trust](Areas/configuration-trust/area.md) | [SCR-000013／PRT-000013](Areas/configuration-trust/SCR-000013/screen.md) | Canonical Definitionから導出 |
| `UI-000014` | 成立済み能力と利用側の確認 | Applicable／Covered | [governance](Areas/governance/area.md) | [SCR-000014／PRT-000014](Areas/governance/SCR-000014/screen.md) | Canonical Definitionから導出 |
| `UI-000015` | 監査・変更・試験・品質の追跡 | Applicable／Covered | [governance](Areas/governance/area.md) | [SCR-000015／PRT-000015](Areas/governance/SCR-000015/screen.md) | Canonical Definitionから導出 |
| `UI-000016` | 外部送信の同意・持帰り・採否 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000016／PRT-000016](Areas/operation/SCR-000016/screen.md) | Canonical Definitionから導出 |
| `UI-000017` | 過去情報と現在有効な意図の選択 | Applicable／Covered | [project-context](Areas/project-context/area.md) | [SCR-000017／PRT-000017](Areas/project-context/SCR-000017/screen.md) | Canonical Definitionから導出 |
| `UI-000018` | 文書の物語・構造・図のNavigation | Applicable／Covered | [project-context](Areas/project-context/area.md) | [SCR-000018／PRT-000018](Areas/project-context/SCR-000018/screen.md) | Canonical Definitionから導出 |
| `UI-000019` | 公式素材の由来・権利・用途確認 | Applicable／Covered | [project-context](Areas/project-context/area.md) | [SCR-000019／PRT-000019](Areas/project-context/SCR-000019/screen.md) | Canonical Definitionから導出 |
| `UI-000020` | 実行記録の依頼と結果確認 | Applicable／Covered | [operation](Areas/operation/area.md) | [SCR-000020／PRT-000020](Areas/operation/SCR-000020/screen.md) | Canonical Definitionから導出 |

CMPは全件で理由付き未発行である。20 Logical Screenの意味順序は共通だが、Product固有の複数実画面で同じ外観・Interaction構造が反復することをまだ確認していないため、Reusable Componentへ昇格しない。

## 3. UI AreaとScreen Inventory

| SCR | 目的 | Area | Source UI | 主なPRT | 状態 |
|---|---|---|---|---|---|
| [SCR-000001](Areas/operation/SCR-000001/screen.md) | 事前検査と意味レビューへの案内 | operation | [UI-000001](../Definitions/UI-000001/ui_definition.md) | PRT-000001 | Canonical |
| [SCR-000002](Areas/operation/SCR-000002/screen.md) | 委任・実行状態・判断 | operation | [UI-000002](../Definitions/UI-000002/ui_definition.md) | PRT-000002 | Canonical |
| [SCR-000003](Areas/operation/SCR-000003/screen.md) | 失敗後の再試行・回復・清掃 | operation | [UI-000003](../Definitions/UI-000003/ui_definition.md) | PRT-000003 | Canonical |
| [SCR-000004](Areas/project-context/SCR-000004/screen.md) | Project・節目・Portfolioの状況把握 | project-context | [UI-000004](../Definitions/UI-000004/ui_definition.md) | PRT-000004 | Canonical |
| [SCR-000005](Areas/operation/SCR-000005/screen.md) | 実行事実と故障境界の診断 | operation | [UI-000005](../Definitions/UI-000005/ui_definition.md) | PRT-000005 | Canonical |
| [SCR-000006](Areas/project-context/SCR-000006/screen.md) | Repository内作業と対象選択 | project-context | [UI-000006](../Definitions/UI-000006/ui_definition.md) | PRT-000006 | Canonical |
| [SCR-000007](Areas/operation/SCR-000007/screen.md) | 入口をまたぐ共通依頼・結果 | operation | [UI-000007](../Definitions/UI-000007/ui_definition.md) | PRT-000007 | Canonical |
| [SCR-000008](Areas/configuration-trust/SCR-000008/screen.md) | Workspace接続と利用可能範囲 | configuration-trust | [UI-000008](../Definitions/UI-000008/ui_definition.md) | PRT-000008 | Canonical |
| [SCR-000009](Areas/project-context/SCR-000009/screen.md) | Meeting・Topic・候補の処置 | project-context | [UI-000009](../Definitions/UI-000009/ui_definition.md) | PRT-000009 | Canonical |
| [SCR-000010](Areas/configuration-trust/SCR-000010/screen.md) | Tool・AIモデル構成の選択 | configuration-trust | [UI-000010](../Definitions/UI-000010/ui_definition.md) | PRT-000010 | Canonical |
| [SCR-000011](Areas/configuration-trust/SCR-000011/screen.md) | 実行時データの保持・清掃 | configuration-trust | [UI-000011](../Definitions/UI-000011/ui_definition.md) | PRT-000011 | Canonical |
| [SCR-000012](Areas/operation/SCR-000012/screen.md) | Agent間の情報引継ぎと再接続 | operation | [UI-000012](../Definitions/UI-000012/ui_definition.md) | PRT-000012 | Canonical |
| [SCR-000013](Areas/configuration-trust/SCR-000013/screen.md) | Runtime信頼判断と公式識別 | configuration-trust | [UI-000013](../Definitions/UI-000013/ui_definition.md) | PRT-000013 | Canonical |
| [SCR-000014](Areas/governance/SCR-000014/screen.md) | 成立済み能力と利用側の確認 | governance | [UI-000014](../Definitions/UI-000014/ui_definition.md) | PRT-000014 | Canonical |
| [SCR-000015](Areas/governance/SCR-000015/screen.md) | 監査・変更・試験・品質の追跡 | governance | [UI-000015](../Definitions/UI-000015/ui_definition.md) | PRT-000015 | Canonical |
| [SCR-000016](Areas/operation/SCR-000016/screen.md) | 外部送信の同意・持帰り・採否 | operation | [UI-000016](../Definitions/UI-000016/ui_definition.md) | PRT-000016 | Canonical |
| [SCR-000017](Areas/project-context/SCR-000017/screen.md) | 過去情報と現在有効な意図の選択 | project-context | [UI-000017](../Definitions/UI-000017/ui_definition.md) | PRT-000017 | Canonical |
| [SCR-000018](Areas/project-context/SCR-000018/screen.md) | 文書の物語・構造・図のNavigation | project-context | [UI-000018](../Definitions/UI-000018/ui_definition.md) | PRT-000018 | Canonical |
| [SCR-000019](Areas/project-context/SCR-000019/screen.md) | 公式素材の由来・権利・用途確認 | project-context | [UI-000019](../Definitions/UI-000019/ui_definition.md) | PRT-000019 | Canonical |
| [SCR-000020](Areas/operation/SCR-000020/screen.md) | 実行記録の依頼と結果確認 | operation | [UI-000020](../Definitions/UI-000020/ui_definition.md) | PRT-000020 | Canonical |

```text
実行・回復 ───────────┐
Project Context ───────┤
構成・信頼 ───────────┼→ 状態・根拠・不足・主要操作・次行動
変更・品質 ───────────┘
```

AreaごとのComposition、Interaction、状態、Accessibilityおよび避ける表現は各area.mdがDesign Guideとして所有する。

## 4. Visual Designの処置

| 項目 | 判定 | 内容／参照 |
|---|---|---|
| Screen Inventory | Completed | 20 SCRを全件登録 |
| Screen／Operation Flow | Completed | 各Area Design GuideとScreenで固定 |
| Hero Screen | N/A | v0.21はCLI、MCP、文書を含む異種Surfaceであり代表GUIを持たない |
| Visual Direction比較 | N/A | Product固有GUIのArt Directionはv0.22固有設計で行う |
| Human Direction Decision | N/A | v0.21の非視覚Surface共通契約には不要 |
| Visual Baseline | Completed | [v0.21 UI Visual Baseline](Visual/visual_baseline.md) |
| Secondary Screen展開 | Completed | 全20 SCRで意味順序とAccessibilityを確認 |
| Pattern発見 | Completed | 状態・根拠・次行動の意味Patternを確認 |
| CMP昇格判断 | N/A | 実画面の反復根拠がないため未発行 |

## 5. UI／SPEC Detail対応

[UI／SPEC Detail対応](../../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)で31 Relationを双方向に全件評価した。全Interactionは対応BHVを持ち、全BHVは一つ以上のSCR／PRTから利用者が認識できる。

## 6. Architecture／Qualityへの引き渡し

- Architecture: SCR、PRT、InteractionおよびBHVを、元Definitionが接続済みのARCH責務へ配置制約として伝播した。
- Quality: 既存のRequired Verification ObligationへDetail固有のScreen、Interaction、State、VisualおよびBehavior観測条件を統合した。
- Reality Audit: 実装、WIPおよび実画面との照合はCanonical Detail成立後に行う。

## 7. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| v0.22 Product固有Visual | OPEN | Qual-Lab | v0.21移行には影響しない | v0.22でGUI解決形を採用した時 |
| CMP発行 | OPEN | UI工程Owner | Reusable Componentは未発行 | 複数の実画面で反復を確認した時 |

## 補足分析

本移行はv0.21 Definitionの意味を変更しない。v0.22固有のScreen、Part、Visual、Behaviorは新しいCanonical Definitionから別途追加する。

## Checklist

- [x] v0.21のUI Definition 20件を全数処置した
- [x] 全UI DefinitionからUI Area、SCR、PRTおよびInteractionへ逆引きできる
- [x] 20 SCRと20 PRTを全件登録した
- [x] 全InteractionをBHVへ接続した
- [x] Product Visual Baselineの適用または理由付きN/Aを処置した
- [x] CMPを反復根拠なしに発行していない
- [x] ArchitectureとQualityへの伝播先を示した
- [x] WIPや既存実装をCanonical入力にしていない
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
