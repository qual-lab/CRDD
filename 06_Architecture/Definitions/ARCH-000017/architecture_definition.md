# 公式素材の権利・用途確認のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000017`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

candidate／approved／restricted／withdrawnを区別し、生成手段や見た目だけから公開・再配布権を推定しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 公式Repositoryの素材収載判断 |
| 所有する責務 | 素材の出所、権利確認、許可用途、対象版、決定権限者の記録 |
| 所有しない責務 | 法的判断の自動化、確認だけからの収載・再配布、用途外利用 |
| 主な外部境界 | 素材提供者、決定権限者、公式Repository、公開成果物 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000019](../../Analysis/UI-000019/architecture_analysis.md) | 公式素材の由来・権利・用途確認 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000024](../../Analysis/SPEC-000024/architecture_analysis.md) | 公式素材の由来・権利・用途を確認する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000019 | UI | 公式Repositoryの素材収載判断 | UI契約はAuthorityを発行しない。利用者操作: 素材を見る／根拠を確認する／利用する。 | UI契約はEffectを定義しない | 見た目だけで権利や信頼保証を推定する | 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） / 素材→由来→権利→用途→収載・派生 /  |
| SPEC-000024 | SPEC | 公式Repositoryの素材収載判断 | 権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない | 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。 | 生成手段だけで権利を推定せず、用途外利用を許可しない。 | [素材候補] -> [由来／権利／用途／判断者を照合]   ├ 確認済み -> [approved／restricted]   ├ 取下げ -> [withdrawn]   └ 不明 -> [candidateのまま停止] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000019 (UI)
   候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） / 素材→由来→権利→用途→収載・派生 / 
└─ SPEC-000024 (SPEC)
   [素材候補] -> [由来／権利／用途／判断者を照合]   ├ 確認済み -> [approved／restricted]   ├ 取下げ -> [withdrawn]   └ 不明 -> [candidateのまま停止]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000019 | 公式Repositoryの素材収載判断 | UI契約はAuthorityを発行しない。利用者操作: 素材を見る／根拠を確認する／利用する。 | UI契約はEffectを定義しない |
| SPEC-000024 | 公式Repositoryの素材収載判断 | 権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない | 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000019: 見た目だけで権利や信頼保証を推定する Effect: UI契約はEffectを定義しない
- SPEC-000024: 生成手段だけで権利を推定せず、用途外利用を許可しない。 Effect: 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000019 | 見た目だけで権利や信頼保証を推定する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000024 | 生成手段だけで権利を推定せず、用途外利用を許可しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000019 | REQ-000035: 識別表示が入口発見を助けながら信頼誤認を増やさないか、権利情報の許容確認負担 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000024 | REQ-000035: 識別表示が入口発見を助けながら信頼誤認を増やさないか、権利情報の許容確認負担 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000019／PRT-000019](../../../04_UI/Details/Areas/project-context/SCR-000019/screen.md) | UI-000019 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000024](../../../05_SPEC/Details/BHV-000024/behavior.md) | SPEC-000024 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000019.spec-000024`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の公式素材確認記録 | Communication／Release判断 | 公式Repositoryの素材収載判断 | 保持 | [CHG-000073 §5](../../../99_Roadmap/Changes/CHG-000073/change.md#5-独立レビューと構造是正) | Workbench操作は未定義 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「素材の出所、権利確認、許可用途、対象版、決定権限者の記録」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 候補→根拠確認→人間判断→対象版・用途照合→収載／非収載を段階的な結合試験で確認する。
- 生成手段からの権利推定、許可用途の拡張、撤回後の継続利用を理由別に反証する。
- Runtime Recoveryは非該当。判断不能時は候補を隔離する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../../17_Communication.md)
- [現行照合先](../../../19_Maintenance.md)

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
