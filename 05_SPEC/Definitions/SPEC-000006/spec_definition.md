# SPEC-000006 Projectと節目の現在状態を投影する

成果物種別: SPEC定義
SPEC ID: `SPEC-000006`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

Projectと節目の現在状態を投影する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000005](../../Analysis/UX-000005/spec_analysis.md) | 目的と受入条件で節目を委ねる |
| [UX-000009](../../Analysis/UX-000009/spec_analysis.md) | プロジェクトの現在地を根拠と不完全性付きで理解する |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000002](../../Analysis/IA-000002/spec_analysis.md) | 目的・節目・Task・受入・判断 |
| [IA-000006](../../Analysis/IA-000006/spec_analysis.md) | Project・Repository・Binding・読取り投影（Projection） |

## 両観点の統合判断

Projectまたは節目の現在地を照会する時、目的、受入、Task、統合状態、根拠、欠測、観測時点を同じProjectへ結合して読取り投影を返す。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | Projectまたは節目の現在地を照会する時 |
| 事前条件 | Project IDと許可された情報源を解決できる |
| Authority | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

## 振る舞い・状態・結果

```text
[情報源解決] -> [完全／partial／stale／conflicting]
 -> [根拠付きProject View]
```

- 振る舞い: 目的、受入、Task、統合状態、根拠、欠測、観測時点を同じProjectへ結合して読取り投影を返す。
- 成功条件: 部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 競合・欠測・開示制限を正常値で補完しない。
- 副作用: 読取り投影だけを返し、Project正本を変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる |
| 境界 | Project一致／不一致、完全／欠測／古い／競合を分け、別Projectの情報を混ぜない |
| 失敗 | 競合・欠測・開示制限を正常値で補完しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り投影だけを返し、Project正本を変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000004](../../../04_UI/Definitions/UI-000004/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000004](../../../04_UI/Definitions/UI-000004/ui_definition.md)

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

- UX観点: [UX-000005](../../Analysis/UX-000005/spec_analysis.md)、[UX-000009](../../Analysis/UX-000009/spec_analysis.md)
- IA観点: [IA-000002](../../Analysis/IA-000002/spec_analysis.md)、[IA-000006](../../Analysis/IA-000006/spec_analysis.md)

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
