# SPEC-000005 残存資源を清掃し終了後を確認する

成果物種別: SPEC定義
SPEC ID: `SPEC-000005`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

残存資源を清掃し終了後を確認する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000017](../../Analysis/UX-000017/spec_analysis.md) | 実行時データを安全に保持・清掃する |
| [UX-000022](../../Analysis/UX-000022/spec_analysis.md) | 残存資源を安全に回復・清掃する |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000003](../../Analysis/IA-000003/spec_analysis.md) | 実行・失敗・外部作用・回復 |
| [IA-000012](../../Analysis/IA-000012/spec_analysis.md) | 実行時データ・保持・清掃 |

## 両観点の統合判断

回復または清掃可能と分類された残存を処置する時、回復義務と清掃処置を同じ識別情報へ結合し、処置後に不存在または安全な終了を再観測する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 回復または清掃可能と分類された残存を処置する時 |
| 事前条件 | exact Recovery Identity、清掃可能判定、対象Rootを確認できる |
| Authority | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[義務あり] -> [処置準備済み] -> [清掃Effect発行済み]
 -> [終了後未確認] -> [不存在確認・義務解消]
```

- 振る舞い: 回復義務と清掃処置を同じ識別情報へ結合し、処置後に不存在または安全な終了を再観測する。
- 成功条件: 処置の発行だけで完了せず、終了後確認によって義務を解消する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。
- 副作用: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。
- 応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 処置の発行だけで完了せず、終了後確認によって義務を解消する |
| 境界 | 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける |
| 失敗 | 由来不明、参照中、観測不能は削除せず、義務を保持する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない |
| 対応UI | [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md)、[UI-000011](../../../04_UI/Definitions/UI-000011/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md)、[UI-000011](../../../04_UI/Definitions/UI-000011/ui_definition.md)

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

- UX観点: [UX-000017](../../Analysis/UX-000017/spec_analysis.md)、[UX-000022](../../Analysis/UX-000022/spec_analysis.md)
- IA観点: [IA-000003](../../Analysis/IA-000003/spec_analysis.md)、[IA-000012](../../Analysis/IA-000012/spec_analysis.md)

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
