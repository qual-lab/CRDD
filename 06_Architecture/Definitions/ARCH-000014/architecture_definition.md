# 実行物の確認根拠と導入判断のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000014`
状態: Canonical
維持責任者: Qual-Lab

独立Trust評価器と汎用Trust Policy管理は現在の製品要求・開発残件から外す。導入時は既存Ownerの確認結果・公開根拠・未確認範囲を分けて人間が判断する。既存の内容同一性・認可・隔離・品質確認を維持し、一つの成功を全体信頼や実行許可へ広げない。

## 現在の適用範囲

独立Trust評価器・総合的な信頼状態の生成・汎用Policyの登録／適用は製品要求と開発残件に含めない。既存Ownerの内容同一性・認可・隔離・品質確認と、公開根拠・未確認範囲を参照する人間の導入判断を維持する。公式表示や一つの成功から実行許可・全体信頼を推定しない。

## 1. 責務と境界

各根拠の確認状態と人間の判断を区別し、製品が総合Trustを判定する契約を設けない。公式版・派生版・手元版の利用判断は導入責任者が行い、専用Policy評価機能は要求しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 専用評価器は要求しない。内容同一性はVersion Control、実行境界はCoordinator／Executor／Docker Isolation、品質確認はQA、公開判断はRelease Ownerがそれぞれ維持する |
| 所有する責務 | 既存Ownerの確認根拠と人間の導入判断の分離 |
| 所有しない責務 | 利用者に代わる信頼判断、外部送信、候補採用 |
| 主な外部境界 | 既存Ownerの確認結果、公開文書、導入責任者 |

準拠、完全性、Publisher、利用者判断、品質の独立軸は維持する。2026-10-19の人間判断により、独自の成果物署名Packageは廃止し、通常実行資格へ署名を要求しない。必要ArtifactのHash照合と各公開境界の採用済み確認は維持し、汎用Trust Policy Frameworkや代替署名機能は追加しない。未実装・未評価をtrustedやquality_assuredへ畳まず、署名があることだけで全Toolへ実行Authorityを発行しない。旧署名の設計・結果は歴史的比較に限定する。

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000013](../../Analysis/UI-000013/architecture_analysis.md) | 導入判断の根拠と公式識別 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000018](../../Analysis/SPEC-000018/architecture_analysis.md) | 導入判断の根拠を区別して確認する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000013 | UI | 既存の確認Ownerと導入責任者 | UI契約はAuthorityを発行しない。利用者操作: 既存の確認結果・公開文書を見る／根拠と未確認範囲を確認する。 | UI契約はEffectを定義しない | 一つの署名表示を全保証と誤認する／アイコンや見た目を署名・準拠・品質保証と誤認する | 各根拠の確認済み／未確認と人間の導入判断を区別する / 成果物（Artifact）→各根拠→利用者方針→導入判断 / ；公式の識別表示と確認根拠・品質の対象範囲を区別し、総合的な信頼状態は生成しない / 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 /  |
| SPEC-000018 | SPEC | 既存の確認Ownerと導入責任者 | 導入責任者が公開文書と既存確認結果を基に利用を判断する。製品は汎用Trust Policyの保存・選択・適用を提供せず、署名だけで実行を許可しない | 既存根拠の案内だけを行い、総合評価・Policy保存・実行Capability発行は行わない。 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 | [対象Artifact] -> [既存Ownerの確認結果・公開文書と未確認範囲を確認] -> [導入責任者が利用可否を判断] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000013 (UI)
   各根拠の確認済み／未確認と人間の導入判断を区別する / 成果物（Artifact）→各根拠→利用者方針→導入判断 / ；公式の識別表示と確認根拠・品質の対象範囲を区別し、総合的な信頼状態は生成しない / 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 /
└─ SPEC-000018 (SPEC)
   [対象Artifact] -> [既存Ownerの確認結果・公開文書と未確認範囲を確認] -> [導入責任者が利用可否を判断]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000013 | 既存の確認Ownerと導入責任者 | UI契約はAuthorityを発行しない。利用者操作: 既存の確認結果・公開文書を見る／根拠と未確認範囲を確認する。 | UI契約はEffectを定義しない |
| SPEC-000018 | 既存の確認Ownerと導入責任者 | 導入責任者が公開文書と既存確認結果を基に利用を判断する。製品は汎用Trust Policyの保存・選択・適用を提供せず、署名だけで実行を許可しない | 既存根拠の案内だけを行い、総合評価・Policy保存・実行Capability発行は行わない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000013: 一つの署名表示を全保証と誤認する／アイコンや見た目を署名・準拠・品質保証と誤認する Effect: UI契約はEffectを定義しない
- SPEC-000018: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 Effect: 既存根拠の案内だけを行い、総合評価・Policy保存・実行Capability発行は行わない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000013 | 一つの署名表示を全保証と誤認する／アイコンや見た目を署名・準拠・品質保証と誤認する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000018 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000013 | REQ-000018: 実行環境の導入・運用者が「既存Ownerの確認根拠と未確認範囲を区別する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000025: 実行環境の導入・運用者が「公開根拠を参照して自分の環境での導入を判断する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000035: 識別表示が入口発見を助けながら信頼誤認を増やさないか、権利情報の許容確認負担 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000018 | REQ-000018: 実行環境の導入・運用者が「既存Ownerの確認根拠と未確認範囲を区別する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000025: 実行環境の導入・運用者が「公開根拠を参照して自分の環境での導入を判断する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000035: 識別表示が入口発見を助けながら信頼誤認を増やさないか、権利情報の許容確認負担 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000013／PRT-000013](../../../04_UI/Details/Areas/configuration-trust/SCR-000013/screen.md) | UI-000013 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000018](../../../05_SPEC/Details/BHV-000018/behavior.md) | SPEC-000018 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000013.spec-000018`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の署名済みRuntime Identity | Artifact Signing／Coordinator release trust | 既存の確認Ownerと導入責任者 | 保持・Trust分離候補 | [artifact-signing:integration:private-key-signing](../../../07_Quality/Registry/test-catalog.json)、[coordinator:integration:sign-release-manifest](../../../07_Quality/Registry/test-catalog.json) | 専用Trust Policy管理は現在の開発対象外 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 専用Core・Port・Adapter・評価APIを新設しない。確認は現在の各Ownerで完結し、導入判断は人間が行う。
- 既存Ownerの確認結果・不一致・観測不能を確認し、一要素を総合信頼や実行許可へ拡張しないことを検証する。
- 署名への保証集約、unknownのtrusted化、公式表示から実行許可生成、Fork排除を理由別に反証する。
- Task Recovery・外部送信は非該当。再確認は対象Artifact・既存根拠・導入条件が変わった時に行う。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現在の実行境界](../../Details/coordinator/01_Architecture.md)、[Git内容同一性](../../Details/version-control/01_Architecture.md)。独立Trust評価器は現在の製品要求外であり、旧署名Packageの廃止を評価器の完成としない
- [現行照合先](../../Details/coordinator/01_Architecture.md)

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
