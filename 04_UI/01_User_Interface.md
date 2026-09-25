# ユーザーインターフェース

状態: UI Detail Ready／UI工程Exit待ち（v0.21.0 DefinitionのDetail移行完了）
担当責任者: Qual-Lab
対象版: v0.21.0
工程規則: [UI](../25_UI.md)、[UIと振る舞い仕様の対応レビュー](../24_UI_Behavior_Specification.md)

## 1. UI工程で解くこと

UI工程は、利用者成果を表すUX定義と、利用者が見分ける情報を表すIA定義を組み合わせ、認識・操作・表示状態・Feedbackとして使えるUI契約へ変換する。

```text
UX定義 ── 利用者が何を達成したいか ─→ UX観点のUI分析 ─┐
                                                       ├─→ UI定義
IA定義 ── 何を見分け、どう辿るか ────→ IA観点のUI分析 ─┘

REQ
 └─ UXを介した上流トレースとして辿る
    UIの直接入力にはしない
```

個別分析は[Analysis](Analysis/)に、現在有効なUI契約は[Definitions](Definitions/)に置く。`Analysis/UX-*`は全UXを利用者観点で、`Analysis/IA-*`は全IAを情報設計観点で独立して分析する。双方の分析は相手の正本を直接読んで不足を補完せず、UI定義で初めて対応付ける。これにより、利用者成果と情報構造のどちらか一方を暗黙の考慮へ退避しない。画面全体を横断した構造は、[表示面と領域](02_Surface_and_Region_Model.md)、[操作と表示状態](03_Interaction_and_State_Model.md)、[視覚表現とアクセシビリティ](04_Visual_and_Accessibility_Direction.md)、[UIとSPECの引き渡し](05_UI_SPEC_Handoff.md)へ投影する。現行実装との照合は[現行Interface参照](06_Current_Interface_Reference.md)に残す。

## 2. 入力と網羅状況

| 入力 | 件数 | 現在の処置 |
|---|---:|---|
| UX定義 | 32 | 全件を`Analysis/UX-*/ui_analysis.md`で個別分析する |
| IA定義 | 22 | 全件を`Analysis/IA-*/ui_analysis.md`で情報設計観点から個別分析する |
| UI分析（UX観点） | 32 | 全UXを一件ずつ分析し、利用者成果、認識、操作、Feedback、体験差を導く |
| UI分析（IA観点） | 22 | 全IAを一件ずつ分析し、情報、状態、関係、可視性、優先順位、導線を導く |
| UI定義 | 20 | 独立して変更・検証するUI契約へ統合する |

## 3. UI定義台帳

| UI | 利用者が使うInterface契約 | 主な入力UX | 主な入力IA |
|---|---|---|---|
| [UI-000001](Definitions/UI-000001/ui_definition.md) | 事前検査と意味レビューへの案内 | `UX-000001` | `IA-000001` |
| [UI-000002](Definitions/UI-000002/ui_definition.md) | 委任・実行状態・判断 | `UX-000002`、`UX-000003` | `IA-000002`、`IA-000003` |
| [UI-000003](Definitions/UI-000003/ui_definition.md) | 失敗後の再試行・回復・清掃 | `UX-000004`、`UX-000022` | `IA-000003`、`IA-000012` |
| [UI-000004](Definitions/UI-000004/ui_definition.md) | Project・節目・Portfolioの状況把握 | `UX-000005`、`UX-000009`、`UX-000015` | `IA-000002`、`IA-000006` |
| [UI-000005](Definitions/UI-000005/ui_definition.md) | 実行事実と故障境界の診断 | `UX-000006`、`UX-000008` | `IA-000004`、`IA-000020` |
| [UI-000006](Definitions/UI-000006/ui_definition.md) | Repository内作業と対象選択 | `UX-000010`、`UX-000011` | `IA-000006`、`IA-000007` |
| [UI-000007](Definitions/UI-000007/ui_definition.md) | 入口をまたぐ共通依頼・結果 | `UX-000012` | `IA-000008` |
| [UI-000008](Definitions/UI-000008/ui_definition.md) | Workspace接続と利用可能範囲 | `UX-000013` | `IA-000009` |
| [UI-000009](Definitions/UI-000009/ui_definition.md) | Meeting・Topic・候補の処置 | `UX-000014` | `IA-000010` |
| [UI-000010](Definitions/UI-000010/ui_definition.md) | Tool・AIモデル構成の選択 | `UX-000016`、`UX-000018` | `IA-000011`、`IA-000013` |
| [UI-000011](Definitions/UI-000011/ui_definition.md) | 実行時データの保持・清掃 | `UX-000017`、`UX-000022` | `IA-000012`、`IA-000003` |
| [UI-000012](Definitions/UI-000012/ui_definition.md) | Agent間の情報引継ぎと再接続 | `UX-000019`、`UX-000021` | `IA-000014`、`IA-000003` |
| [UI-000013](Definitions/UI-000013/ui_definition.md) | Runtime信頼判断と公式識別 | `UX-000020`、`UX-000031` | `IA-000015` |
| [UI-000014](Definitions/UI-000014/ui_definition.md) | 成立済み能力と利用側の確認 | `UX-000007` | `IA-000005` |
| [UI-000015](Definitions/UI-000015/ui_definition.md) | 監査・変更・試験・品質の追跡 | `UX-000023`、`UX-000026`、`UX-000029` | `IA-000016` |
| [UI-000016](Definitions/UI-000016/ui_definition.md) | 外部送信の同意・持帰り・採否 | `UX-000024` | `IA-000014`、`IA-000017` |
| [UI-000017](Definitions/UI-000017/ui_definition.md) | 過去情報と現在有効な意図の選択 | `UX-000025` | `IA-000021` |
| [UI-000018](Definitions/UI-000018/ui_definition.md) | 文書の物語・構造・図のNavigation | `UX-000027`、`UX-000028` | `IA-000018` |
| [UI-000019](Definitions/UI-000019/ui_definition.md) | 公式素材の由来・権利・用途確認 | `UX-000030` | `IA-000019` |
| [UI-000020](Definitions/UI-000020/ui_definition.md) | 実行記録の依頼と結果確認 | `UX-000032` | `IA-000022` |

## 4. 全体構成

```text
Repository / CLI / MCP / Workbench
                │
                ▼
       [現在の対象と利用範囲]
                │
       ┌────────┼─────────┐
       ▼        ▼         ▼
   Project    実行・判断   保守・品質
       │        │         │
       └────────┼─────────┘
                ▼
      状態・不足・根拠・次の行動
                │
                ▼
       正本／回復／候補処置へ進む
```

入口が変わっても成功・停止・判断要否の意味を変えない。Workbenchだけに正本、業務ロジック、Authority判断または独自状態Storeを作らない。

## 5. 基本図の処置

| 基本図 | 処置 | 現行図 | 未確認範囲 |
|---|---|---|---|
| 論理画面／領域構成図 | 作成 | [表示面と領域](02_Surface_and_Region_Model.md) | 実装前の視覚評価 |
| 画面／操作Flow | 作成 | [操作と表示状態](03_Interaction_and_State_Model.md) | Prototypeでの到達性 |
| 表示状態／Variant図 | 作成 | [操作と表示状態](03_Interaction_and_State_Model.md#3-表示状態の共通variant) | 実端末・GUI差 |
| 主要Component関係図 | 作成 | [表示面と領域](02_Surface_and_Region_Model.md#3-表示責任のブロック) | 実装Componentとの対応 |
| UI／SPEC対応図 | 作成 | [UIとSPECの引き渡し](05_UI_SPEC_Handoff.md) | 31組の対応レビュー済み。独立再レビュー待ち |

## 6. 現在状態と次工程

v0.21.0のUI Definition 20件は当時の契約でCanonical化されている。新しいUI Detail契約に対して、4 Area Design Guide、20 SCR、20 PRTおよび31 Interaction Relationへ全件移行した。現在状態は[UI Detail](Details/01_UI_Detail.md)を正本とする。

```text
v0.21 UI Definition: Canonical
        ↓
v0.21 UI Detail移行: Complete
        ↓
v0.22固有変更はDiscoveryから別途追加
```

32件のUX定義と22件のIA定義を別々の正式入力として全数分析し、20件のUI定義へ統合した。REQはUXを介して追跡するが、UIの直接入力にはしない。以前の独立レビュー後に記録作成側のGapを検出したため、UX-000032とIA-000022からUI-000020を追加した。全54分析と20定義は成果物別Checklistを完了し、UI契約はUI／SPEC対応レビューへ渡せる状態である。一方、[表示面ごとの視覚評価](04_Visual_and_Accessibility_Direction.md#5-表示面ごとの現在状態)と人間による工程Exit判断は未完了であり、Architectureへの通常Handoffを許可する完全な`UI Ready`ではない。

## 補足分析

なし。

## Checklist

- [x] 全UX DefinitionとIA DefinitionをUI分析へ一件ずつ対応付けた
- [x] 全UI分析をUI Definitionへ処置した
- [x] UI台帳とAnalysis・Definitionsの関係が一致する
- [x] 新UI Detail契約に対する全20 UI DefinitionをSCR／PRT／Interactionへ移行した
- [x] v0.21移行結果とv0.22固有Detailを区別した
- [x] 横断成果物を個別UI定義の第二の正本にしていない
- [x] 基本図を全件処置した
- [x] Human Input、Open・Gapおよび戻り条件を明示した
- [x] UI契約Ready、UI／SPEC対応レビュー入力Ready、UI工程Exitを区別した
- [x] v0.21の非視覚Surfaceを含むVisual／Accessibility契約を全20 SCRで評価した
- OPEN: v0.22 Product固有GUIのPrototype／実画面評価と人間による工程Exit判断。v0.21移行のArchitecture／Quality伝播は完了している
- [x] ArchitectureまたはSourceから意味を逆輸入していない
