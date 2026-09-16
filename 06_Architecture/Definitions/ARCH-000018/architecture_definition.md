# 実行事実の記録のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000018`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

異なる実行基盤またはTypeScriptアプリから受け取った観測事実をCanonical契約で検査し、並行書込みと途中失敗を安全に扱って不変に公開する。

| 区分 | 内容 |
|---|---|
| 状態Owner | 実行記録Writer、不変Store、記録Attempt |
| 所有する責務 | Canonical Event検査、同一性、並行公開、衝突再読取り、Effect不明時の回復参照 |
| 所有しない責務 | Provider実行、Task状態更新、評価採用、読取りProjection、保存内容からの品質断定 |
| 主な外部境界 | 実行基盤／TypeScript API、記録Port、耐久Store、読取りProjection |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000020](../../Analysis/UI-000020/architecture_analysis.md) | 記録済み、未記録、記録結果不明と同じExecution Identity／Attemptを見分けられる |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000030](../../Analysis/SPEC-000030/architecture_analysis.md) | 異なる作成側が同じ契約で記録し、並行衝突と途中失敗を安全に扱う |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000020 | UI | 実行記録Writer／Store／Record Attempt | UI契約はAuthorityを発行しない。利用者操作: 入力定義に記録された操作・判断 | UI契約はEffectを定義しない | unknownを未記録と推定して再発行する | prepared／publishing／recorded／not_recorded／unknown / 記録対象→記録試行→結果→完成記録／拒否理由／同一試行の再観測 /  |
| SPEC-000030 | SPEC | 実行記録Writerと不変Store | 許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない | 許可された実行記録領域への不変な記録だけ。Task、Provider、評価または他Sourceを変更しない。 | Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。 | [観測結果]     ↓ Identity・Source・時点・状態を検査 [prepared]     ↓ 不変公開を要求 [publishing]     ├─ 完成記録を確認 ─→ [recorded]     ├─ Effect未成立を確認 → [not_recorded]     └─ 確定観測不能 ────→ [unknown] [Canonical実行記録] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000020 (UI)
   prepared／publishing／recorded／not_recorded／unknown / 記録対象→記録試行→結果→完成記録／拒否理由／同一試行の再観測 / 
└─ SPEC-000030 (SPEC)
   [観測結果]     ↓ Identity・Source・時点・状態を検査 [prepared]     ↓ 不変公開を要求 [publishing]     ├─ 完成記録を確認 ─→ [recorded]     ├─ Effect未成立を確認 → [not_recorded]     └─ 確定観測不能 ────→ [unknown] [Canonical実行記録]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000020 | 実行記録Writer／Store／Record Attempt | UI契約はAuthorityを発行しない。利用者操作: 入力定義に記録された操作・判断 | UI契約はEffectを定義しない |
| SPEC-000030 | 実行記録Writerと不変Store | 許可された記録作成側。Task実行、評価採用または別Sourceの変更Authorityを含まない | 許可された実行記録領域への不変な記録だけ。Task、Provider、評価または他Sourceを変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000020: unknownを未記録と推定して再発行する Effect: UI契約はEffectを定義しない
- SPEC-000030: Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。 Effect: 許可された実行記録領域への不変な記録だけ。Task、Provider、評価または他Sourceを変更しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000020 | unknownを未記録と推定して再発行する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000030 | Identity不明、Schema不一致、並行衝突、途中失敗、保存結果の観測不能を成功へ畳まない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000020 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000030 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1 Event Publisher／Recorder／Store Writer | Execution Intelligence | 実行事実記録Port／Writer／Store | Canonical責務として再接続 | [execution-intelligence試験](../../../07_Quality/Registry/test-catalog.json) | 外部TypeScriptアプリと複数作成側の実境界確認が必要 |

## 10. 実装と検証への引き渡し

- Record Port、検査、Writer、不変公開、再読取り確認を分ける。
- 単一Writerの正常系、複数作成側、同一再送、並行衝突、途中失敗、Effect不明を段階的に結合する。
- 完成記録の同一性と終了後のlock／一時物不存在を独立観測する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/execution-intelligence/01_Architecture.md)

## Checklist

- [x] UI分析とSPEC分析だけを正式入力として統合した
- [x] UI ContractとSPEC Contractを入力別に保持した
- [x] 独立したArchitecture Responsibilityを説明できる
- [x] 所有する責務、所有しない責務およびBoundaryを明示した
- [x] Major Component、Interfaceおよび依存方向を明示した
- [x] Data／State Ownershipを明示した
- [x] Authority、EffectおよびLifecycleを入力別に評価した
- [x] Failure Boundary、Recovery責任および観測を明示した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] DetailsへのHandoffを明示した
- [x] Qualityへ渡すVerification Intentを明示した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] 上流の観測可能な振る舞いをArchitectureで変更していない
