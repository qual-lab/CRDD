# IA-000010のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000010`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000010 Meeting・Topic・候補・採否](../../../03_IA/Definitions/IA-000010/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から情報設計観点だけを導き、利用者成果と操作体験はUX観点の分析に委ねる。

## 2. UIへ引き継ぐ情報構造

会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 会議（Meeting） | 時間境界を持つ対話 | Meeting ID |
| 会議項目（Meeting Item） | 会議内の観察・問い・判断候補 | Meeting内Identity |
| 候補（Candidate） | 正本更新前の提案 | 候補（Candidate） ID |
| 論点（Topic） | 継続して扱う論点 | Topic ID |
| 関係（Relation） | 同一・関連・派生等の判断 | 対象Identityと種類 |
| 判断（Decision） | 採用・却下・保留 | 権限（Authority）と改訂版（Revision） |

UIでは「会議（Meeting）、会議項目（Meeting Item）、候補（Candidate）、論点（Topic）、関係（Relation）、判断（Decision）」の識別と関係を維持する。同名・近似値、未観測・不存在、現在値・古い値を表示都合でまとめない。

## 3. 表示の優先順位とNavigation

| 利用場面 | 最初に見分ける対象 | 区別する状態 | 次の導線 |
|---|---|---|---|
| `UX-000014`／プロジェクト運営者／PM／Meeting後に決定・Topic・Actionを整理する時 | 会議（Meeting）、会議項目（Meeting Item）、候補（Candidate）、論点（Topic）、関係（Relation）、判断（Decision）、責任者（Owner） | 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | Meeting→Item→候補→既存Topic比較→採否→所有正本 |

```text
Meeting・Topic・候補・採否
        ↓
対象と現在状態
        ↓
不足・制限・競合
        ↓
関係・根拠
        ↓
判断／回復／次の対象
```

内部ID、生Log、実装詳細は最初の結論へ混在させず、根拠を掘り下げる段階で示す。

## 4. 表示差と開示境界

IA定義が要求する状態区分:

- `UX-000014`: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける

IA定義が要求する導線と責任:

- プロジェクト運営者／PM: Meeting後に決定・Topic・Actionを整理する時に「会議の内容を候補として整理し正本へつなぐ」ために必要な判断を行う。システムは「会議記録が自動的に正本へ昇格する」を避けられるよう、候補・判断・反映結果を区別する。

値なし、未観測、古い値、競合、部分取得、開示制限および結果不明は、それぞれ利用者の次の判断が異なる場合に別の表示状態として扱う。開示できない対象は、その存在自体を示せるかも決定権限に従う。

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000009 Meeting・Topic・候補の処置](../../Definitions/UI-000009/ui_definition.md) | New | Meeting・Topic・候補・採否 | この情報構造を利用者が判断できる表示へ変換する |

## 6. UX観点との統合時に確認すること

UX観点の分析が求める利用者成果、重要場面、操作およびFeedbackに対し、「Meeting・Topic・候補・採否」の対象・状態・関係・導線が過不足なく判断材料を提供するかをUI定義で確認する。IAからUIへ引き渡す固有の意図は「UIは候補比較と採否を、SPECはRelationと状態を、Project Operationは正本更新を具体化する。」であり、利用者の目的をここで推測して先取りしない。
