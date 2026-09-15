# SPEC-000030のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000030`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000030 実行事実を同じ契約で記録する](../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md)

このSPEC定義だけを正式入力とする。上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

異なる実行基盤またはTypeScriptアプリが、観測した実行事実を同じ意味契約で記録する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | AIまたはToolの観測可能な実行段階が確定した時 |
| 事前条件 | Execution Identity、Source、観測時点、観測項目と値または未観測理由を検査できる |
| Authority | 許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない |
| 判定不能 | Identity、Sourceまたは観測状態を推測せず、記録を発行しないで理由を返す |

### 振る舞い・状態・結果

```text
[観測結果] -> [Identity・Source・時点・状態を検査]
 -> [不変な公開] -> [recorded／not_recorded／unknown]
```

### 失敗・回復・副作用

- Identity不明、Schema不一致、並行衝突、途中失敗または保存結果の観測不能を成功へ畳まない。
- 許可された実行記録領域への不変な記録だけをEffectとする。
- Effect不明では自動再発行せず、同じExecution IdentityとAttemptで再観測する。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [実行事実の記録のArchitecture定義](../../Definitions/ARCH-000018/architecture_definition.md) | 実行記録Writerと不変Store | 許可された記録作成側 | 許可された記録領域への不変な記録 | 並行衝突、途中失敗、Effect不明、別Execution上書き |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md) | New | 読取りProjectionと異なるState Owner、書込みEffect、並行制御および回復義務を持つため独立責務とする |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000020
- 記録Effectの実行と、利用者へ表示する記録状態を分ける。
- UIが記録Authorityを発行せず、同じExecution Identityの結果だけを表示することを確認する。
