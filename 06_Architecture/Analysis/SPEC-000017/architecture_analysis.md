# SPEC-000017のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000017`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000017 Task情報と結果を同じ仕事へ引き継ぎ再取得する](../../../05_SPEC/Definitions/SPEC-000017/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

Task情報と結果を同じ仕事へ引き継ぎ再取得する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | Agent間引継ぎまたは切断後の再接続を行う時 |
| 事前条件 | 同じRequest Identity、入力出所、Attempt、結果、現在Grantを照合できる |
| Authority | 送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[依頼準備] -> [情報搬送] -> [Task実行] -> [結果生成] -> [結果帰還]
切断時: [同じIdentityで状態／結果再取得]
```

- 振る舞い: 出所付き入力、Task識別情報、試行、結果、現在Grantを結合し、同じ依頼の状態・結果を取得する。
- 成功条件: 情報搬送と実行、結果生成と結果帰還を別状態として返す。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 応答喪失を未実行とみなさず、別依頼として再発行しない。
- 副作用: 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。
- 応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 情報搬送と実行、結果生成と結果帰還を別状態として返す |
| 境界 | Request Identity一致／不一致、接続中／切断、結果あり／未取得を分け、別依頼を再発行しない |
| 失敗 | 応答喪失を未実行とみなさず、別依頼として再発行しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない」と矛盾する結果を返さない |
| 対応UI | [UI-000012](../../../04_UI/Definitions/UI-000012/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project実行のArchitecture定義](../../Definitions/project-execution/architecture_definition.md) | 結果再接続Resolver | 送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない | 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。 | 応答喪失を未実行とみなさず、別依頼として再発行しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project実行](../../Definitions/project-execution/architecture_definition.md) | Same | 委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000002、UI-000003、UI-000012
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
