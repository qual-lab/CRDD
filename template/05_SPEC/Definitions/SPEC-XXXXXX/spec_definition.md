# SPEC-XXXXXX 振る舞い名

成果物種別: SPEC定義
SPEC ID: `SPEC-XXXXXX`
状態: Candidate
維持責任者: （記入）

## 振る舞いの目的

独立して観測・変更・検証する振る舞いの目的を示す。

## UX観点の分析結果

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-XXXXXX](../../Analysis/UX-XXXXXX/spec_analysis.md) | |

## IA観点の分析結果

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

## 未確認事項・人間判断・戻り条件

### 正式入力から継承する確認事項

| Source ID | 確認事項 | 判断者 | 現在の判断 | 未確認時の影響 | 再評価契機 |
|---|---|---|---|---|---|
| [UX-XXXXXX](../../../02_UX/Definitions/UX-XXXXXX/ux_definition.md) | [正式入力に残る確認事項] | [判断者] | [OPEN／解消済み] | [影響] | [再評価契機] |
| [IA-XXXXXX](../../../03_IA/Definitions/IA-XXXXXX/ia_definition.md) | [正式入力に残る確認事項] | [判断者] | [OPEN／解消済み] | [影響] | [再評価契機] |

### SPEC固有の追加判断

[追加判断がなければ、その旨と、継承事項が解消済みという意味ではないことを書く。]

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 正式入力と変換根拠

- 正式入力: [UX-XXXXXX](../../../02_UX/Definitions/UX-XXXXXX/ux_definition.md)
- 正式入力: [IA-XXXXXX](../../../03_IA/Definitions/IA-XXXXXX/ia_definition.md)

以下は正式入力をSPECの責務へ変換した根拠であり、正式入力そのものではない。

- UX観点の分析根拠: [UX-XXXXXX](../../Analysis/UX-XXXXXX/spec_analysis.md)
- IA観点の分析根拠: [IA-XXXXXX](../../Analysis/IA-XXXXXX/spec_analysis.md)

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した
- [ ] UX OutcomeとIA Information Contractを保持した
- [ ] Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した
- [ ] Current State、Behavior、ResultおよびState Transitionを定義した
- [ ] Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した
- [ ] ConstraintとNon-goalを評価した
- [ ] Human Inputの必要性を評価した
- [ ] Open・GapとOwner工程へ戻す条件を明示した
- [ ] Verification Intentを明示した
- [ ] 対応するUIとのRelationを明示した
- [ ] UI Presentation、Architecture方式またはSource実装を先取りしていない
- [ ] 結果を観測可能な契約として定義した
- [ ] 補足定義へ必須情報を退避していない
