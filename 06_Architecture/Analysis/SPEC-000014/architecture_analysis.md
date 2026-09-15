# SPEC-000014のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000014`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000014 Repositoryに適合する標準Toolを解決する](../../../05_SPEC/Definitions/SPEC-000014/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

Repositoryに適合する標準Toolを解決する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 目的に合う標準Toolを選ぶ時 |
| 事前条件 | Repositoryの固定改訂版、登録済み能力、配布根拠を読める |
| Authority | Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[目的＋Repository改訂版] -> [能力・配布根拠照合] -> [利用可能候補／不足／不一致]
```

- 振る舞い: 登録能力、利用可否、固定改訂版、配布根拠、必要Authorityを照合して利用候補を返す。
- 成功条件: 未登録能力を推測せず、版不一致や欠落を明示する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: Tool一覧の閲覧だけで実行Authorityを発行しない。
- 副作用: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 未登録能力を推測せず、版不一致や欠落を明示する |
| 境界 | 登録済み／未登録能力、改訂版一致／不一致を分け、候補提示から実行Authorityを発行しない |
| 失敗 | Tool一覧の閲覧だけで実行Authorityを発行しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用で候補を返し、Toolまたは配布物を実行・変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Tool CapabilityとAIモデル構成のArchitecture定義](../../Definitions/ARCH-000010/architecture_definition.md) | Tool能力Registry | Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない | 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。 | Tool一覧の閲覧だけで実行Authorityを発行しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Tool CapabilityとAIモデル構成](../../Definitions/ARCH-000010/architecture_definition.md) | Same | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000010
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
