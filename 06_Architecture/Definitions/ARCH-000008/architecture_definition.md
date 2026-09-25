# 実行境界の診断のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000008`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。

| 区分 | 内容 |
|---|---|
| 状態Owner | Platform Access診断Port |
| 所有する責務 | 外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測 |
| 所有しない責務 | Provider Task、Docker修復、再起動、結果採用 |
| 主な外部境界 | OS Process、Docker、Network、外部CLI |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000005](../../Analysis/UI-000005/architecture_analysis.md) | 実行事実と故障境界の診断 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000009](../../Analysis/SPEC-000009/architecture_analysis.md) | 実行基盤の故障境界と利用可能範囲を診断する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000005 | UI | 実行記録読取りProjection | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む。 | UI契約はEffectを定義しない | 未観測を0または正常へ畳む／一律の失敗表示で無関係な能力まで停止する | 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 / 実行→観測→根拠→評価→改善候補 / ；各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける / 故障→境界→影響する能力→継続可能範囲→回復 /  |
| SPEC-000009 | SPEC | Platform Access診断Port | 運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない | 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。 | 一つの失敗から全機能停止や原因を断定しない。 | [故障観測] -> [認証／起動／実行／取消／搬送／回復を照合]  -> [確定箇所／未確定／利用可能範囲] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000005 (UI)
   観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 / 実行→観測→根拠→評価→改善候補 / ；各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける / 故障→境界→影響する能力→継続可能範囲→回復 / 
└─ SPEC-000009 (SPEC)
   [故障観測] -> [認証／起動／実行／取消／搬送／回復を照合]  -> [確定箇所／未確定／利用可能範囲]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000005 | 実行記録読取りProjection | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む。 | UI契約はEffectを定義しない |
| SPEC-000009 | Platform Access診断Port | 運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない | 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000005: 未観測を0または正常へ畳む／一律の失敗表示で無関係な能力まで停止する Effect: UI契約はEffectを定義しない
- SPEC-000009: 一つの失敗から全機能停止や原因を断定しない。 Effect: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000005 | 未観測を0または正常へ畳む／一律の失敗表示で無関係な能力まで停止する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000009 | 一つの失敗から全機能停止や原因を断定しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000005 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000023: 実行環境の導入・運用者が「AI提供元固有の一連の状態変化を接続部越しに正確に扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000009 | REQ-000023: 実行環境の導入・運用者が「AI提供元固有の一連の状態変化を接続部越しに正確に扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000005／PRT-000005](../../../04_UI/Details/Areas/operation/SCR-000005/screen.md) | UI-000005 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000009](../../../05_SPEC/Details/BHV-000009/behavior.md) | SPEC-000009 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000005.spec-000009`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のProvider境界診断 | Coordinator／Platform Access診断 | Platform Access診断Port | 保持・分離 | [coordinator:integration:provider-execution-boundary-matrix](../../../07_Quality/Registry/test-catalog.json) | Provider非依存Port名は未確定 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 対象固定→境界別Probe→結果相関→終了を段階的な結合試験で確認する。
- 境界の一括失敗化、生stderr依存、観測不能のavailable化、診断から修復へのAuthority昇格を理由別に反証する。
- 修復・Recoveryは非該当。必要時は別の回復入口を案内する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/platform-access/01_Architecture.md)
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
