# SPEC-000011のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000011`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000011 複数入口で同じ依頼・結果契約を保つ](../../../05_SPEC/Definitions/SPEC-000011/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

複数入口で同じ依頼・結果契約を保つ。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | stdio MCPまたはlocalhost HTTPから同じ仕事を依頼する時 |
| 事前条件 | 公開Application契約へ適合する入力と利用可能なTransportがある |
| Authority | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[stdio／localhost HTTP入力] -> [同じApplication Request]
 -> [同じ状態／結果／失敗分類]
```

- 振る舞い: 通信方式を公開Application契約へ変換し、同じ入力・状態・結果・失敗分類を返す。
- 成功条件: 入口の違いでAuthorityや結果の意味が変わらない。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。
- 副作用: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 入口の違いでAuthorityや結果の意味が変わらない |
| 境界 | 対応Transport／未対応Transport、同義入力／不正入力を分け、入口固有値で意味を変えない |
| 失敗 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する」と矛盾する結果を返さない |
| 対応UI | [UI-000007](../../../04_UI/Definitions/UI-000007/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [公開Transportの意味同一性のArchitecture定義](../../Definitions/ARCH-000012/architecture_definition.md) | MCP／CLI Transport Adapter | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない | Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [公開Transportの意味同一性](../../Definitions/ARCH-000012/architecture_definition.md) | Same | 受付前／受付済／Effect前後の失敗／結果ありを入口間で同じ意味に保つ。Transport固有Schemaを公開意味契約として再定義しない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000007
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
