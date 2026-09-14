# SPEC-000011 複数入口で同じ依頼・結果契約を保つ

成果物種別: SPEC定義
SPEC ID: `SPEC-000011`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

複数入口で同じ依頼・結果契約を保つ。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000012](../../Analysis/UX-000012/spec_analysis.md) | 入口を変えても同じ仕事を続ける |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000008](../../Analysis/IA-000008/spec_analysis.md) | 公開受付・通信方式・結果 |

## 両観点の統合判断

stdio MCPまたはlocalhost HTTPから同じ仕事を依頼する時、通信方式を公開Application契約へ変換し、同じ入力・状態・結果・失敗分類を返す。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | stdio MCPまたはlocalhost HTTPから同じ仕事を依頼する時 |
| 事前条件 | 公開Application契約へ適合する入力と利用可能なTransportがある |
| Authority | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

## 振る舞い・状態・結果

```text
[stdio／localhost HTTP入力] -> [同じApplication Request]
 -> [同じ状態／結果／失敗分類]
```

- 振る舞い: 通信方式を公開Application契約へ変換し、同じ入力・状態・結果・失敗分類を返す。
- 成功条件: 入口の違いでAuthorityや結果の意味が変わらない。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。
- 副作用: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 入口の違いでAuthorityや結果の意味が変わらない |
| 境界 | 対応Transport／未対応Transport、同義入力／不正入力を分け、入口固有値で意味を変えない |
| 失敗 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する」と矛盾する結果を返さない |
| 対応UI | [UI-000007](../../../04_UI/Definitions/UI-000007/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000007](../../../04_UI/Definitions/UI-000007/ui_definition.md)

## 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 情報源

- UX観点: [UX-000012](../../Analysis/UX-000012/spec_analysis.md)
- IA観点: [IA-000008](../../Analysis/IA-000008/spec_analysis.md)
