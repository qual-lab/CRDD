# Tool CapabilityとAIモデル構成のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000010`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。

| 区分 | 内容 |
|---|---|
| 状態Owner | Capability RegistryとModel Configuration Resolver |
| 所有する責務 | Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由 |
| 所有しない責務 | Tool実行、Provider利用可能性の捏造、Repository Binding |
| 主な外部境界 | Repository設定、Tool Package、Provider Preflight |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000010](../../Analysis/UI-000010/architecture_analysis.md) | Tool・AIモデル構成の選択 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000014](../../Analysis/SPEC-000014/architecture_analysis.md) | Repositoryに適合する標準Toolを解決する |
| [SPEC-000015](../../Analysis/SPEC-000015/architecture_analysis.md) | AIモデル構成を検証し実効選択を決める |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000010 | UI | Capability RegistryとModel Configuration Resolver | UI契約はAuthorityを発行しない。利用者操作: 選ぶ／構成を検証する／更新する。 | UI契約はEffectを定義しない | 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する／未知または非対応のモデルを実行可能と表示する | 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） / 仕事→必要能力→登録Tool→配布根拠→起動 / ；有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） / 設定→検証→利用可能候補→選択→理由・再選定条件 /  |
| SPEC-000014 | SPEC | Tool能力Registry | Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない | 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。 | Tool一覧の閲覧だけで実行Authorityを発行しない。 | [目的＋Repository改訂版] -> [能力・配布根拠照合] -> [利用可能候補／不足／不一致] |
| SPEC-000015 | SPEC | AIモデル構成Manager | 構成管理者が更新を採用し、Runtimeが検証済み構成から選択する | 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。 | 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。 | [構成Candidate] -> [検証]   ├ valid -> [採用済み構成] -> [実効選択]   └ invalid／unavailable -> [拒否／再選定条件] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000010 (UI)
   利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） / 仕事→必要能力→登録Tool→配布根拠→起動 / ；有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） / 設定→検証→利用可能候補→選択→理由・再選定条件 / 
├─ SPEC-000014 (SPEC)
   [目的＋Repository改訂版] -> [能力・配布根拠照合] -> [利用可能候補／不足／不一致]
└─ SPEC-000015 (SPEC)
   [構成Candidate] -> [検証]   ├ valid -> [採用済み構成] -> [実効選択]   └ invalid／unavailable -> [拒否／再選定条件]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000010 | Capability RegistryとModel Configuration Resolver | UI契約はAuthorityを発行しない。利用者操作: 選ぶ／構成を検証する／更新する。 | UI契約はEffectを定義しない |
| SPEC-000014 | Tool能力Registry | Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない | 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。 |
| SPEC-000015 | AIモデル構成Manager | 構成管理者が更新を採用し、Runtimeが検証済み構成から選択する | 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000010: 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する／未知または非対応のモデルを実行可能と表示する Effect: UI契約はEffectを定義しない
- SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。 Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。
- SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。 Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000010 | 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する／未知または非対応のモデルを実行可能と表示する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000014 | Tool一覧の閲覧だけで実行Authorityを発行しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000015 | 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000010 | REQ-000014: 開発者が「現在リポジトリで利用可能な機能を知る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000034: 開発者が「リポジトリに対応する標準ツールを迷わず使う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000016: 実行環境の導入・運用者が「AIモデル選択を検証可能な構成として更新する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 開発者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000014 | REQ-000014: 開発者が「現在リポジトリで利用可能な機能を知る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000034: 開発者が「リポジトリに対応する標準ツールを迷わず使う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 開発者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000015 | REQ-000016: 実行環境の導入・運用者が「AIモデル選択を検証可能な構成として更新する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000010／PRT-000010](../../../04_UI/Details/Areas/configuration-trust/SCR-000010/screen.md) | UI-000010 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000014](../../../05_SPEC/Details/BHV-000014/behavior.md) | SPEC-000014 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000015](../../../05_SPEC/Details/BHV-000015/behavior.md) | SPEC-000015 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000010.spec-000014`、`PRT-000010.spec-000015`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| Tool入口はv0.20.1、外部モデル構成は基準版なし | Coordinator Tool入口／Provider model profile | Capability RegistryとModel Configuration Resolver | 一部保持・一部新規 | [coordinator:unit:provider-model-profile-runtime](../../../07_Quality/Registry/test-catalog.json) | Capability Registryと外部構成Schemaは未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 能力発見→構成読込→検証→利用可能性確認→選択結果を段階的な結合試験で確認する。
- 未知Capability推定、古いモデル名固定、availability未確認の選択、一覧取得から実行Authority生成を理由別に反証する。
- cleanup・Recoveryは非該当。利用不能時は再選択条件を返す。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

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
