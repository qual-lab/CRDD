# SPEC-000002 委任範囲と権限を確定して受理する

成果物種別: SPEC定義
SPEC ID: `SPEC-000002`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

委任範囲と権限を確定して受理する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000002](../../Analysis/UX-000002/spec_analysis.md) | 委任範囲と権限を理解して任せる |
| [UX-000005](../../Analysis/UX-000005/spec_analysis.md) | 目的と受入条件で節目を委ねる |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000002](../../Analysis/IA-000002/spec_analysis.md) | 目的・節目・Task・受入・判断 |

## 両観点の統合判断

目的・受入条件・対象範囲を委任する時、目的、範囲、担い手、決定権限、節目を検証し、実行可能な依頼だけを受理する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 目的・受入条件・対象範囲を委任する時 |
| 事前条件 | 目的、受入条件、許可範囲、担い手候補、判断主体を確認できる |
| Authority | Project運営者が委任範囲を決める。Runtimeは範囲を拡張しない |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[提案] --検証--> [受理可能] --受理--> [Task作成済み]
   └--不足／競合--> [blocked・Effect 0]
```

- 振る舞い: 目的、範囲、担い手、決定権限、節目を検証し、実行可能な依頼だけを受理する。
- 成功条件: 受理結果から実行対象・未委任判断・完了条件を一意に確認できる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。
- 副作用: 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 受理結果から実行対象・未委任判断・完了条件を一意に確認できる |
| 境界 | 委任範囲内／範囲外、判断主体一致／不一致を分け、未委任範囲を受理しない |
| 失敗 | 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする」と矛盾する結果を返さない |
| 対応UI | [UI-000002](../../../04_UI/Definitions/UI-000002/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000002](../../../04_UI/Definitions/UI-000002/ui_definition.md)

## 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 未確認事項・人間判断・戻り条件

| 項目 | 現在の判断 | 不足時に戻す工程 |
|---|---|---|
| 未確認事項 | なし | UI／SPECまたはOwner工程 |
| 人間判断 | 現在のCanonical範囲では追加判断なし | 判断を所有する工程 |
| 戻り条件 | 正式入力、対応関係または成立条件に不足・競合が見つかった場合 | 不足を所有するUX／IA／UI／SPEC |

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 情報源

- UX観点: [UX-000002](../../Analysis/UX-000002/spec_analysis.md)、[UX-000005](../../Analysis/UX-000005/spec_analysis.md)
- IA観点: [IA-000002](../../Analysis/IA-000002/spec_analysis.md)

## Checklist

- [x] UX DefinitionとIA Definitionの分析を正式入力として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した
- [x] Current State、Behavior、ResultおよびState Transitionを定義した
- [x] Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した
- [x] ConstraintとNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するUIとのRelationを明示した
- [x] UI Presentation、Architecture方式またはSource実装を先取りしていない
- [x] 結果を観測可能な契約として定義した
- [x] 補足定義へ必須情報を退避していない
