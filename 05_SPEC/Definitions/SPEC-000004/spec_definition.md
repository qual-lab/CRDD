# SPEC-000004 失敗後の再試行と回復を安全に選別する

成果物種別: SPEC定義
SPEC ID: `SPEC-000004`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

失敗後の再試行と回復を安全に選別する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000004](../../Analysis/UX-000004/spec_analysis.md) | 失敗後の再試行・回復を選ぶ |
| [UX-000022](../../Analysis/UX-000022/spec_analysis.md) | 残存資源を安全に回復・清掃する |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000003](../../Analysis/IA-000003/spec_analysis.md) | 実行・失敗・外部作用・回復 |
| [IA-000012](../../Analysis/IA-000012/spec_analysis.md) | 実行時データ・保持・清掃 |

## 両観点の統合判断

失敗・取消・切断後に継続方法を選ぶ時、同一依頼、外部作用の状態、回復義務、現在権限を照合し、状態確認・回復・再試行を分類する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 失敗・取消・切断後に継続方法を選ぶ時 |
| 事前条件 | 同じ依頼、試行、Effect状態、回復義務、現在Grantを照合できる |
| Authority | 回復または再試行を選ぶ決定権限者。分類結果だけではEffectを発行しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

## 振る舞い・状態・結果

```text
[失敗／切断] --Effect観測--> [なし／済み／不明]
  ├ なし  -> [再試行候補]
  ├ 済み  -> [結果再取得]
  └ 不明  -> [回復／再確認必須]
```

- 振る舞い: 同一依頼、外部作用の状態、回復義務、現在権限を照合し、状態確認・回復・再試行を分類する。
- 成功条件: 作用不明時は新規実行せず、同じ回復対象の識別情報と許可された次の行動を返す。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。
- 副作用: 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 作用不明時は新規実行せず、同じ回復対象の識別情報と許可された次の行動を返す |
| 境界 | Effectなし／成立済み／不明、回復Identity一致／曖昧を分け、不明時に再実行しない |
| 失敗 | 古い権限、曖昧な識別情報、作用不明では再発行を拒否する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る」と矛盾する結果を返さない |
| 対応UI | [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md)

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

- UX観点: [UX-000004](../../Analysis/UX-000004/spec_analysis.md)、[UX-000022](../../Analysis/UX-000022/spec_analysis.md)
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
