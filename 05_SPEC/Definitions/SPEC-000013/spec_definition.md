# SPEC-000013 Meeting内容を候補化し所有正本へ昇格する

成果物種別: SPEC定義
SPEC ID: `SPEC-000013`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

Meeting内容を候補化し所有正本へ昇格する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000014](../../Analysis/UX-000014/spec_analysis.md) | Meeting内容を候補化し採否を判断する |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000010](../../Analysis/IA-000010/spec_analysis.md) | Meeting・Topic・候補・採否 |

## 両観点の統合判断

Meetingの項目を継続論点または決定候補として扱う時、観察・仮説・候補・決定を区別し、既存Topicとの関係と採否を記録して所有正本へ反映する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | Meetingの項目を継続論点または決定候補として扱う時 |
| 事前条件 | Meeting Item、出所、候補種別、所有正本、判断主体を確認できる |
| Authority | 候補作成と採否判断を分け、正本更新は所有者の採用Authorityを必要とする |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[観察／会話] -> [候補]
  ├ 採用 -> [所有正本更新]
  ├ 却下 -> [候補履歴]
  └ 保留 -> [判断待ち]
```

- 振る舞い: 観察・仮説・候補・決定を区別し、既存Topicとの関係と採否を記録して所有正本へ反映する。
- 成功条件: 候補の出所、判断者、採否、反映先を辿れる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 文字列一致だけで統合・分割せず、会話を自動採用しない。
- 副作用: 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 候補の出所、判断者、採否、反映先を辿れる |
| 境界 | 新規候補／既存候補、採用／却下／保留を分け、未採用候補で正本を変更しない |
| 失敗 | 文字列一致だけで統合・分割せず、会話を自動採用しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0」と矛盾する結果を返さない |
| 対応UI | [UI-000009](../../../04_UI/Definitions/UI-000009/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000009](../../../04_UI/Definitions/UI-000009/ui_definition.md)

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

- UX観点: [UX-000014](../../Analysis/UX-000014/spec_analysis.md)
- IA観点: [IA-000010](../../Analysis/IA-000010/spec_analysis.md)

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
