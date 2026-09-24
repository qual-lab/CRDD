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

### UX観点の分析結果

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000032](../../../05_SPEC/Analysis/UX-000032/spec_analysis.md) | 記録済み・未記録・結果不明を見分け、重複や上書きなく次の処置を選べる |

### IA観点の分析結果

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000022](../../../05_SPEC/Analysis/IA-000022/spec_analysis.md) | Execution、Source、Observation、Record Attempt、Publication Resultを別の対象と関係として保つ |

### 両観点の統合判断

取得時の比較可能性を後付け変換へ依存させず、作成側がExecution Identity、観測値、観測状態、Source、Observed AtをCanonical契約で記録する。評価と改善候補は観測事実として記録しない。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | AIまたはToolの観測可能な実行段階が確定した時 |
| 事前条件 | Execution Identity、Source、観測時点、観測項目と値または未観測理由を検査できる |
| Authority | 許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない |
| 判定不能 | Identity、Sourceまたは観測状態を推測せず、記録を発行しないで理由を返す |

### 振る舞い・状態・結果

```text
[観測結果]
    ↓ Identity・Source・時点・状態を検査
[prepared]
    ↓ 不変公開を要求
[publishing]
    ├─ 完成記録を確認 ─→ [recorded]
    ├─ Effect未成立を確認 → [not_recorded]
    └─ 確定観測不能 ────→ [unknown]
[Canonical実行記録]
```

- `prepared`は入力検査後かつ公開Effect前、`publishing`は不変公開を要求済みかつ確定観測前として、`recorded`／`not_recorded`／`unknown`と区別する。
- 正常時は複数作成側が同じSchemaとIdentity規則で記録し、同じ入力の再送を重複事実にしない。
- 部分記録、並行書込みおよび衝突では、完成記録と中間残存を区別し、別Executionの記録を上書きしない。
- 記録結果は取得側がSource、Observed At、観測状態を再解釈せず読める形にする。

### 失敗・回復・副作用

- 失敗: Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。
- 副作用: 許可された実行記録領域への不変な記録だけ。Task、Provider、評価または他Sourceを変更しない。
- Effect成立が不明な場合は自動再発行せず、同じExecution Identityと記録Attemptで再観測できる回復義務を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 異なる作成側から同じ契約で記録し、取得側が意味を変えず比較できる |
| 境界 | 同一再送、複数作成側、並行書込み、部分記録を別Executionや完成記録へ誤統合しない |
| 失敗 | 途中失敗または衝突で中間物を完成記録として公開せず、別記録を上書きしない |
| 観測不能 | 保存Effect不明を`not_recorded`へ丸めず、同じIdentityで再観測可能にする |
| 対応UI | [UI-000020](../../../04_UI/Definitions/UI-000020/ui_definition.md)が記録済み、未記録、記録結果不明と同じExecution／Attemptを区別できる |

### 対応するUI

- pairs_with: [UI-000020](../../../04_UI/Definitions/UI-000020/ui_definition.md)

### 制約

生Provider出力、秘密情報または不要な個人情報を一律に記録しない。保存方式、DB製品またはProcess配置は本定義で固定しない。

### 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を、解消済みとみなさず次のとおり継承する。

#### UX-000032から継承する確認事項

入力Definitionから継承した確認事項の由来: [UX-000032](../../../02_UX/Definitions/UX-000032/ux_definition.md)

未確認事項は、統合元の要求ごとに次を保持する。

- REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。
- 確認事項: REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 判断者: 実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。
- 未確認時の影響: 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。
- Discoveryへ戻す条件: 想定した利用者、問題、望ましい変化または制約が誤っていると判明した場合。
- UX分析へ戻す条件: 利用場面、目的、得られる結果、重要場面、失敗または品質期待の統合判断が変わる場合。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### IA-000022から継承する確認事項

入力Definitionから継承した確認事項の由来: [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000032 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### SPEC固有の追加判断

現時点で追加の判断事項はない。これは上記の継承事項が解消済みという意味ではない。正式入力の意味、対応関係または成立条件に不足・競合が見つかった場合は、その意味を所有するUX／IAへ戻す。

### 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

### 補足定義

なし。

この節にあるUX／IA／REQ参照は、正式入力である当該UI／SPEC Definitionが報告する来歴であり、Architectureの追加の正式入力ではない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [実行事実の記録のArchitecture定義](../../Definitions/ARCH-000018/architecture_definition.md) | 実行記録Writerと不変Store | 許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない | 許可された実行記録領域への不変な記録だけ。Task、Provider、評価または他Sourceを変更しない。 | Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。 |

### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み | [実行事実の記録のArchitecture定義](../../Definitions/ARCH-000018/architecture_definition.md)へ入力Contractを意味変更せず渡す。 |
| Boundary／Component／Interface | 評価済み | 状態Ownerは実行記録Writerと不変Store。公開境界は入力定義のAuthority・Effect・制約を越えない。 |
| Data／State Ownership | 評価済み | 実行記録Writerと不変StoreをOwner候補とし、UI表示またはSPEC結果と内部状態を同一視しない。 |
| Failure／Recovery | 評価済み | Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。Recoveryは入力定義にある場合だけ保持する。 |
| Security／Trust | 評価済み | 入力定義のAuthority、開示、Effect 0および非推定条件を保持する。 |
| Quality Constraint | 評価済み | 未観測・不明・制限・失敗を成功または不存在へ丸めない。 |
| Human Input | 継承あり | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択。 |
| Open／Gap | 上流確認を継承 | 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。Architecture固有の追加Gapはない。 |
| Verification Intent | 評価済み | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

Human Inputの判断者は「実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。」。再評価契機は「対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。」。Architectureはこれらを解消済みとせず、入力の意味が変わる場合はOwner工程へ戻す。

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md) | New | 読取りProjectionと異なるState Owner、書込みEffect、並行制御および回復義務を持つため独立責務とする |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000020
- 記録Effectの実行と、利用者へ表示する記録状態を分ける。
- UIが記録Authorityを発行せず、同じExecution Identityの結果だけを表示することを確認する。

## Checklist

- [x] 自分自身のSPEC定義だけを正式入力として処置した
- [x] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] External Boundaryと終了後観測を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] UI観点との統合時に確認する事項を明示した
