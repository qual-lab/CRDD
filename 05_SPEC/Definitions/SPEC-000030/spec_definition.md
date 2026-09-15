# SPEC-000030 実行事実を同じ契約で記録する

成果物種別: SPEC定義
SPEC ID: `SPEC-000030`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

異なる実行基盤またはTypeScriptアプリが、観測した実行事実を同じ意味契約で記録する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000032](../../Analysis/UX-000032/spec_analysis.md) | 記録済み・未記録・結果不明を見分け、重複や上書きなく次の処置を選べる |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000022](../../Analysis/IA-000022/spec_analysis.md) | Execution、Source、Observation、Record Attempt、Publication Resultを別の対象と関係として保つ |

## 両観点の統合判断

取得時の比較可能性を後付け変換へ依存させず、作成側がExecution Identity、観測値、観測状態、Source、Observed AtをCanonical契約で記録する。評価と改善候補は観測事実として記録しない。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | AIまたはToolの観測可能な実行段階が確定した時 |
| 事前条件 | Execution Identity、Source、観測時点、観測項目と値または未観測理由を検査できる |
| Authority | 許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない |
| 判定不能 | Identity、Sourceまたは観測状態を推測せず、記録を発行しないで理由を返す |

## 振る舞い・状態・結果

```text
[観測結果]
    ↓ Identity・Source・時点・状態を検査
[Canonical実行記録]
    ↓ 不変な公開
[recorded／not_recorded／unknown]
```

- 正常時は複数作成側が同じSchemaとIdentity規則で記録し、同じ入力の再送を重複事実にしない。
- 部分記録、並行書込みおよび衝突では、完成記録と中間残存を区別し、別Executionの記録を上書きしない。
- 記録結果は取得側がSource、Observed At、観測状態を再解釈せず読める形にする。

## 失敗・回復・副作用

- 失敗: Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。
- 副作用: 許可された実行記録領域への不変な記録だけ。Task、Provider、評価または他Sourceを変更しない。
- Effect成立が不明な場合は自動再発行せず、同じExecution Identityと記録Attemptで再観測できる回復義務を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 異なる作成側から同じ契約で記録し、取得側が意味を変えず比較できる |
| 境界 | 同一再送、複数作成側、並行書込み、部分記録を別Executionや完成記録へ誤統合しない |
| 失敗 | 途中失敗または衝突で中間物を完成記録として公開せず、別記録を上書きしない |
| 観測不能 | 保存Effect不明を`not_recorded`へ丸めず、同じIdentityで再観測可能にする |
| 対応UI | [UI-000020](../../../04_UI/Definitions/UI-000020/ui_definition.md)が記録済み、未記録、記録結果不明と同じExecution／Attemptを区別できる |

## 対応するUI

- pairs_with: [UI-000020](../../../04_UI/Definitions/UI-000020/ui_definition.md)

## 制約

生Provider出力、秘密情報または不要な個人情報を一律に記録しない。保存方式、DB製品またはProcess配置は本定義で固定しない。

## 情報源

- UX観点: [UX-000032](../../Analysis/UX-000032/spec_analysis.md)
- IA観点: [IA-000022](../../Analysis/IA-000022/spec_analysis.md)
