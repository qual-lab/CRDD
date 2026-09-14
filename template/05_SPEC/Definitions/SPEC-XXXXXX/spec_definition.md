# SPEC-XXXXXX 振る舞い名

成果物種別: SPEC定義
SPEC ID: `SPEC-XXXXXX`
状態: Candidate
維持責任者: （記入）

## 振る舞いの目的

独立して観測・変更・検証する振る舞いの目的を示す。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-XXXXXX](../../Analysis/UX-XXXXXX/spec_analysis.md) | |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-XXXXXX](../../Analysis/IA-XXXXXX/spec_analysis.md) | |

## 両観点の統合判断

UX成果とIA構造を、契機・条件・状態・結果へどう統合したかを示す。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | |
| 事前条件 | |
| Authority | |
| 判定不能 | |

## 振る舞い・状態・結果

正常・準正常・異常・回復のうち実在する経路だけを示す。

## 失敗・回復・副作用

失敗条件、保持、再試行、取消、回復、Effect、終了後条件を適用範囲に応じて示す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | |
| 境界 | |
| 失敗 | |
| 観測不能 | |
| 対応UI | |

## 対応するUI

次の二形式は排他的に使う。

### 直接UIがある場合

- pairs_with: [UI-XXXXXX](../../../04_UI/Definitions/UI-XXXXXX/ui_definition.md)

### 直接UIがない場合

- pairs_with: Not Applicable
- 理由: （直接UIを持たない理由）
- 運用Feedback: （利用側契約、公開結果または運用上の確認手段）
- 人間確認: （確認者と確認結果）

## 制約

Architecture方式、実装、UI表現または試験手順を先取りしない。

## 情報源

- UX観点: [UX-XXXXXX](../../Analysis/UX-XXXXXX/spec_analysis.md)
- IA観点: [IA-XXXXXX](../../Analysis/IA-XXXXXX/spec_analysis.md)
