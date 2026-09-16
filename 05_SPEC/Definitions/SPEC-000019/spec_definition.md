# SPEC-000019 責務変更後の利用側閉包を検証する

成果物種別: SPEC定義
SPEC ID: `SPEC-000019`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

責務変更後の利用側閉包を検証する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000007](../../Analysis/UX-000007/spec_analysis.md) | 内部変更後も成立済み能力を安全に使う |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000005](../../Analysis/IA-000005/spec_analysis.md) | 成立済み能力・契約・利用側・置換根拠 |

## 両観点の統合判断

責務・契約・接続部を変更する時、旧能力、Producer、全Consumer、派生物、署名・Release経路を新所有者と検証根拠へ対応付ける。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 責務・契約・接続部を変更する時 |
| 事前条件 | 移動したCanonical Contract、旧Owner、新Owner、利用側母集団を特定できる |
| Authority | 変更責任者が移行候補を作り、独立確認後に完了を判断する |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

## 振る舞い・状態・結果

```text
[責務変更] -> [Producer／Consumer／派生物／署名経路を導出]
 -> [宣言集合と比較] -> [閉包／不足]
```

- 振る舞い: 旧能力、Producer、全Consumer、派生物、署名・Release経路を新所有者と検証根拠へ対応付ける。
- 成功条件: 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 代表経路だけのPassや旧処理の推測削除を許さない。
- 副作用: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない |
| 境界 | 宣言Consumer／導出Consumer、移行済み／未移行を分け、未確認Consumerを閉包済みにしない |
| 失敗 | 代表経路だけのPassや旧処理の推測削除を許さない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない」と矛盾する結果を返さない |
| 対応UI | [UI-000014](../../../04_UI/Definitions/UI-000014/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000014](../../../04_UI/Definitions/UI-000014/ui_definition.md)

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

- UX観点: [UX-000007](../../Analysis/UX-000007/spec_analysis.md)
- IA観点: [IA-000005](../../Analysis/IA-000005/spec_analysis.md)

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
