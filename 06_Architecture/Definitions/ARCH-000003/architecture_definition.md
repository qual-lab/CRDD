# 変更・監査・試験・品質の閉包のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000003`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

レビュー件数や試験件数を品質へ読み替えず、同じ固定改訂版に対する必須確認がすべて終わった時だけ工程状態を更新する。

| 区分 | 内容 |
|---|---|
| 状態Owner | Quality Centerと変更追跡 |
| 所有する責務 | 同じ改訂版に対する指摘、是正、試験Evidence、未確認範囲、現在Gateの統合 |
| 所有しない責務 | 各監査の専門判断、リスク受容、Release判断 |
| 主な外部境界 | CHG、監査結果、試験結果、Quality Center |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000015](../../Analysis/UI-000015/architecture_analysis.md) | 監査・変更・試験・品質の追跡 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000020](../../Analysis/SPEC-000020/architecture_analysis.md) | 変更・監査・試験・品質の閉包を評価する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000015 | UI | Quality Centerと変更追跡 | UI契約はAuthorityを発行しない。利用者操作: 指摘を見る／根拠を開く／次Gateへ進む。 | UI契約はEffectを定義しない | 一部是正や監査回数を完成と誤認する／単発成功や試験件数から一連の状態変化全体を保証する／同じ説明を複製し代表ファイルだけで済ませる | 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required） / 固定版→監査集合→統合方針→是正→再固定→判断 / ；計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable） / 変更→不確実性→試験層→実行結果→現在保証 / ；計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする / Roadmap→Change→対象ファイル→Evidence→Quality→Release /  |
| SPEC-000020 | SPEC | Quality Centerと変更追跡 | 各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める | 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。 | 試験件数や一部監査完了から全体Passを推定しない。 | [変更候補] -> [レビュー／監査／試験を対応付け]  -> [Pass／Finding／未実施／非該当] -> [残るGate] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000015 (UI)
   固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required） / 固定版→監査集合→統合方針→是正→再固定→判断 / ；計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable） / 変更→不確実性→試験層→実行結果→現在保証 / ；計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする / Roadmap→Change→対象ファイル→Evidence→Quality→Release / 
└─ SPEC-000020 (SPEC)
   [変更候補] -> [レビュー／監査／試験を対応付け]  -> [Pass／Finding／未実施／非該当] -> [残るGate]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000015 | Quality Centerと変更追跡 | UI契約はAuthorityを発行しない。利用者操作: 指摘を見る／根拠を開く／次Gateへ進む。 | UI契約はEffectを定義しない |
| SPEC-000020 | Quality Centerと変更追跡 | 各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める | 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000015: 一部是正や監査回数を完成と誤認する／単発成功や試験件数から一連の状態変化全体を保証する／同じ説明を複製し代表ファイルだけで済ませる Effect: UI契約はEffectを定義しない
- SPEC-000020: 試験件数や一部監査完了から全体Passを推定しない。 Effect: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000015 | 一部是正や監査回数を完成と誤認する／単発成功や試験件数から一連の状態変化全体を保証する／同じ説明を複製し代表ファイルだけで済ませる | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000020 | 試験件数や一部監査完了から全体Passを推定しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000015 | REQ-000026: CRDD作成者・保守者が「監査合意から是正・反証までを一つの改訂版で閉じる」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000030: CRDD作成者・保守者が「試験層ごとの保証と未確認範囲を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000033: CRDD作成者・保守者が「作業・変更・根拠・品質を役割別に辿る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000020 | REQ-000026: CRDD作成者・保守者が「監査合意から是正・反証までを一つの改訂版で閉じる」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000030: CRDD作成者・保守者が「試験層ごとの保証と未確認範囲を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000033: CRDD作成者・保守者が「作業・変更・根拠・品質を役割別に辿る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000015／PRT-000015](../../../04_UI/Details/Areas/governance/SCR-000015/screen.md) | UI-000015 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000020](../../../05_SPEC/Details/BHV-000020/behavior.md) | SPEC-000020 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000015.spec-000020`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のQuality Centerと監査集合 | Quality Center／変更追跡 | Quality Centerと変更追跡 | 保持・再編 | [CHG-000073 §5](../../../99_Roadmap/Changes/CHG-000073/change.md#5-独立レビューと構造是正) | 工程別Definitionの再構築確認へ接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「同じ改訂版に対する指摘、是正、試験Evidence、未確認範囲、現在Gateの統合」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 候補固定→必須確認→結果統合→是正または人間判断→品質状態更新を段階的な結合試験で確認する。
- 別改訂版の結果混入、必須監査の途中縮小、部分Passの全体Pass化を理由別に反証する。
- 外部TaskのRecoveryは非該当。確認中断時は未確認範囲を保持する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../../07_Quality/01_Quality_Center.md)
- [現行照合先](../../../16_Quality_Assurance.md)

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
