# SPEC-000018 Runtimeの信頼要素を独立評価する

成果物種別: SPEC定義
SPEC ID: `SPEC-000018`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

Runtimeの信頼要素を独立評価する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000020](../../Analysis/UX-000020/spec_analysis.md) | 利用環境の信頼方針で実行基盤を選ぶ |
| [UX-000031](../../Analysis/UX-000031/spec_analysis.md) | 公式の識別と保証を混同せず見分ける |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000015](../../Analysis/IA-000015/spec_analysis.md) | 準拠・改ざん有無・配布者・信頼方針 |

## 両観点の統合判断

実行基盤を選択または公式配布物を確認する時、準拠、完全性、配布者、利用者所有の信頼方針、品質根拠を独立に評価して結果を返す。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 実行基盤を選択または公式配布物を確認する時 |
| 事前条件 | 対象Artifact、準拠根拠、Hash・署名、Publisher、利用者Trust Policyを確認できる |
| Authority | Deployment OwnerがTrust Policyを所有する。Qual-Lab署名は公式配布者の識別だけを保証する |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

## 振る舞い・状態・結果

```text
[Artifact] -> [準拠／完全性／Publisher／Trust Policy／品質を別評価]
 -> [trusted／untrusted／unknown]
```

- 振る舞い: 準拠、完全性、配布者、利用者所有の信頼方針、品質根拠を独立に評価して結果を返す。
- 成功条件: 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。
- 副作用: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める |
| 境界 | 準拠／完全性／配布者／利用者方針／品質根拠を別軸にし、一要素のPassを全体信頼へ広げない |
| 失敗 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り評価だけを返し、Runtime実行Capabilityを自動発行しない」と矛盾する結果を返さない |
| 対応UI | [UI-000013](../../../04_UI/Definitions/UI-000013/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000013](../../../04_UI/Definitions/UI-000013/ui_definition.md)

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

- UX観点: [UX-000020](../../Analysis/UX-000020/spec_analysis.md)、[UX-000031](../../Analysis/UX-000031/spec_analysis.md)
- IA観点: [IA-000015](../../Analysis/IA-000015/spec_analysis.md)

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
