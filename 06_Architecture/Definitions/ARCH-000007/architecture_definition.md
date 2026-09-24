# 実行事実と評価候補の取得のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000007`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

利用可能な実行記録だけを読取り、observed／not_observed／unknownを区別して、事実と評価候補を別結果として返す。記録生成・保存方式は所有しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 実行記録読取りProjection |
| 所有する責務 | 利用可能な実行記録の解決、欠測を保つ読取り集約、非Authority評価候補 |
| 所有しない責務 | 実行記録の生成・永続化、Task状態の更新、Provider実行、評価の自動採用、故障修復 |
| 主な外部境界 | 既存の実行記録Source、読取りPort、利用側 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000005](../../Analysis/UI-000005/architecture_analysis.md) | 実行事実と故障境界の診断 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000008](../../Analysis/SPEC-000008/architecture_analysis.md) | 実行事実と評価を区別して取得する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000005 | UI | 実行記録読取りProjection | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む。 | UI契約はEffectを定義しない | 未観測を0または正常へ畳む／一律の失敗表示で無関係な能力まで停止する | 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 / 実行→観測→根拠→評価→改善候補 / ；各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける / 故障→境界→影響する能力→継続可能範囲→回復 /  |
| SPEC-000008 | SPEC | 実行記録読取りProjection | 実行記録を閲覧できる主体。評価の閲覧は評価採用Authorityを含まない | 読取り専用。実行記録、対象Task、Providerを変更しない。 | 欠測を正常値へ補完せず、評価を観測事実として返さない。 | [取得条件] -> [実行記録を解決] -> [事実／未観測／評価を分離]  -> [根拠付き履歴] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000005 (UI)
   観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 / 実行→観測→根拠→評価→改善候補 / ；各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける / 故障→境界→影響する能力→継続可能範囲→回復 / 
└─ SPEC-000008 (SPEC)
   [取得条件] -> [実行記録を解決] -> [事実／未観測／評価を分離]  -> [根拠付き履歴]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000005 | 実行記録読取りProjection | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む。 | UI契約はEffectを定義しない |
| SPEC-000008 | 実行記録読取りProjection | 実行記録を閲覧できる主体。評価の閲覧は評価採用Authorityを含まない | 読取り専用。実行記録、対象Task、Providerを変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000005: 未観測を0または正常へ畳む／一律の失敗表示で無関係な能力まで停止する Effect: UI契約はEffectを定義しない
- SPEC-000008: 欠測を正常値へ補完せず、評価を観測事実として返さない。 Effect: 読取り専用。実行記録、対象Task、Providerを変更しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000005 | 未観測を0または正常へ畳む／一律の失敗表示で無関係な能力まで停止する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000008 | 欠測を正常値へ補完せず、評価を観測事実として返さない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000005 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000023: 実行環境の導入・運用者が「AI提供元固有の一連の状態変化を接続部越しに正確に扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000008 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の実行記録読取りProjection読取り | Execution Intelligence Query／Store Reader | 実行記録読取りProjection | 保持・読取りへ限定 | [execution-intelligence:integration:store](../../../07_Quality/Registry/test-catalog.json) | 外部アプリTS APIの読取り接続は未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は既存Sourceを読むPort、記録を解決するCore、事実／評価候補を返すProjectionを分ける。Event PublisherとStore Writerは現行能力の照合対象であり、この読取り責務へ含めない。
- Source解決→読取り→相関→欠測を保持したProjectionを段階的な結合試験で確認する。
- Event欠落、別Attempt混入、欠測補完、評価の事実化を理由別に反証する。
- Provider Taskの取消・Recoveryは非該当。Store書込み失敗は観測欠測として主処理と分ける。

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
