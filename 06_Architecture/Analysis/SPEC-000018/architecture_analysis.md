# SPEC-000018のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000018`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000018 Runtimeの信頼要素を独立評価する](../../../05_SPEC/Definitions/SPEC-000018/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

Runtimeの信頼要素を独立評価する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 実行基盤を選択または公式配布物を確認する時 |
| 事前条件 | 対象Artifact、準拠根拠、Hash・署名、Publisher、利用者Trust Policyを確認できる |
| Authority | Deployment OwnerがTrust Policyを所有する。Qual-Lab署名は公式配布者の識別だけを保証する |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[Artifact] -> [準拠／完全性／Publisher／Trust Policy／品質を別評価]
 -> [trusted／untrusted／unknown]
```

- 振る舞い: 準拠、完全性、配布者、利用者所有の信頼方針、品質根拠を独立に評価して結果を返す。
- 成功条件: 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。
- 副作用: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める |
| 境界 | 準拠／完全性／配布者／利用者方針／品質根拠を別軸にし、一要素のPassを全体信頼へ広げない |
| 失敗 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り評価だけを返し、Runtime実行Capabilityを自動発行しない」と矛盾する結果を返さない |
| 対応UI | [UI-000013](../../../04_UI/Definitions/UI-000013/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Runtime Artifactの信頼評価のArchitecture定義](../../Definitions/runtime-artifact-trust/architecture_definition.md) | Runtime Trust Evaluator | Deployment OwnerがTrust Policyを所有する。Qual-Lab署名は公式配布者の識別だけを保証する | 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Runtime Artifactの信頼評価](../../Definitions/runtime-artifact-trust/architecture_definition.md) | Same | verified／trusted／quality_assuredを別軸にし、Qual-Lab署名を実行資格へ集約しない。Forkや企業署名、許可されたLocal unsignedを利用者所有Policyで評価する。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000013
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
