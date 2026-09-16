# SPEC-000021 外部送信の同意範囲を検証して送信する

成果物種別: SPEC定義
SPEC ID: `SPEC-000021`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

外部送信の同意範囲を検証して送信する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000024](../../Analysis/UX-000024/spec_analysis.md) | 外部利用の送信・持帰り・昇格を制御する |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000014](../../Analysis/IA-000014/spec_analysis.md) | 受け渡す情報・Task・結果・帰還 |
| [IA-000017](../../Analysis/IA-000017/spec_analysis.md) | 外部送信先・目的・分類・同意・候補 |

## 両観点の統合判断

情報を外部へ送る時、送信先、目的、情報分類、対象範囲、同意状態を検証し、許可された最小情報だけを送る。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 情報を外部へ送る時 |
| 事前条件 | 送信先、目的、情報分類、対象範囲、同意の有効性を確認できる |
| Authority | 送信同意は許可範囲内の送信Effectだけを認め、結果受領や候補採用へ流用しない |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[送信候補] -> [同意検証]
  ├ valid -> [送信Effect発行] -> [送信済み]
  └ invalid／unknown -> [Effect 0]
```

- 振る舞い: 送信先、目的、情報分類、対象範囲、同意状態を検証し、許可された最小情報だけを送る。
- 成功条件: 送信前検査と送信Effectを区別し、利用した同意範囲を結果へ結合する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。
- 副作用: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 送信前検査と送信Effectを区別し、利用した同意範囲を結果へ結合する |
| 境界 | 同意範囲内／範囲外、有効／期限切れ／不明を分け、範囲外では送信Effectを発行しない |
| 失敗 | 期限切れ・範囲変更・不明な同意ではEffect 0で停止する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する」と矛盾する結果を返さない |
| 対応UI | [UI-000016](../../../04_UI/Definitions/UI-000016/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000016](../../../04_UI/Definitions/UI-000016/ui_definition.md)

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

- UX観点: [UX-000024](../../Analysis/UX-000024/spec_analysis.md)
- IA観点: [IA-000014](../../Analysis/IA-000014/spec_analysis.md)、[IA-000017](../../Analysis/IA-000017/spec_analysis.md)

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
