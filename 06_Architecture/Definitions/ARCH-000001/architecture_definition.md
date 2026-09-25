# 機械検査と文書検査のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000001`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

機械で確定できる不備だけをCheckerが返し、解釈を要する内容は対象と改訂版を保ったまま意味レビューへ渡す。文書の読みやすさや図の意味を、見出しの存在だけから合格としない。

| 区分 | 内容 |
|---|---|
| 状態Owner | Checker CoreとCRDD現行Profile |
| 所有する責務 | 決定論的なRepository検査、文書構造検査、意味レビューへの案内 |
| 所有しない責務 | 意味の採否、独立レビュー、工程移行・Release判断 |
| 主な外部境界 | Repository正本、Checker利用者、独立レビュー |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000001](../../Analysis/UI-000001/architecture_analysis.md) | 事前検査と意味レビューへの案内 |
| [UI-000018](../../Analysis/UI-000018/architecture_analysis.md) | 文書の物語・構造・図のNavigation |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000001](../../Analysis/SPEC-000001/architecture_analysis.md) | 事前検査を実行し意味レビューへ案内する |
| [SPEC-000023](../../Analysis/SPEC-000023/architecture_analysis.md) | 文書の物語・構造・図と工程引継ぎを検査する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000001 | UI | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 検査を実行する／指摘箇所へ進む。 | UI契約はEffectを定義しない | 検査範囲や理由が分からない | 検査前／不備あり／機械確認済み。意味判断は別状態 / 対象→指摘→場所→所有成果物 /  |
| UI-000018 | UI | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 概要を読む／図から詳細へ進む／正本を開く。 | UI契約はEffectを定義しない | 確認項目順と専門語だけで文書を埋める／必要な図を黙って省略しAIごとに記法が変わる | 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別 / 問題と目的→判断→構造化詳細→根拠→次工程 / ；作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason） / 上流意図→工程図→要素の意味→下流義務 /  |
| SPEC-000001 | SPEC | Checker CoreとCRDD現行Profile | 検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない | Repository内容を変更しない読取り検査。 | 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。 | [未検査] --検査--> [指摘なし／指摘あり／検査不能] |
| SPEC-000023 | SPEC | Checker CoreとCRDD現行Profile | 工程成果物の作成者と確認者。Checker結果は意味採用Authorityを持たない | 読取り検査だけを行い、文書内容や工程状態を自動変更しない。 | Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。 | [工程成果物] -> [物語／構造／図／凡例／関係を検査]  -> [成立／不足／作成不能理由] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000001 (UI)
   検査前／不備あり／機械確認済み。意味判断は別状態 / 対象→指摘→場所→所有成果物 / 
├─ UI-000018 (UI)
   下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別 / 問題と目的→判断→構造化詳細→根拠→次工程 / ；作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason） / 上流意図→工程図→要素の意味→下流義務 / 
├─ SPEC-000001 (SPEC)
   [未検査] --検査--> [指摘なし／指摘あり／検査不能]
└─ SPEC-000023 (SPEC)
   [工程成果物] -> [物語／構造／図／凡例／関係を検査]  -> [成立／不足／作成不能理由]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000001 | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 検査を実行する／指摘箇所へ進む。 | UI契約はEffectを定義しない |
| UI-000018 | Checker CoreとCRDD現行Profile | UI契約はAuthorityを発行しない。利用者操作: 概要を読む／図から詳細へ進む／正本を開く。 | UI契約はEffectを定義しない |
| SPEC-000001 | Checker CoreとCRDD現行Profile | 検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない | Repository内容を変更しない読取り検査。 |
| SPEC-000023 | Checker CoreとCRDD現行Profile | 工程成果物の作成者と確認者。Checker結果は意味採用Authorityを持たない | 読取り検査だけを行い、文書内容や工程状態を自動変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000001: 検査範囲や理由が分からない Effect: UI契約はEffectを定義しない
- UI-000018: 確認項目順と専門語だけで文書を埋める／必要な図を黙って省略しAIごとに記法が変わる Effect: UI契約はEffectを定義しない
- SPEC-000001: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。 Effect: Repository内容を変更しない読取り検査。
- SPEC-000023: Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。 Effect: 読取り検査だけを行い、文書内容や工程状態を自動変更しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000001 | 検査範囲や理由が分からない | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| UI-000018 | 確認項目順と専門語だけで文書を埋める／必要な図を黙って省略しAIごとに記法が変わる | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000001 | 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000023 | Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000001 | REQ-000001: CRDD作成者・保守者が「意味レビュー前に機械判定できる不備を落とす」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| UI-000018 | REQ-000031: CRDD作成者・保守者が「課題と判断の物語から構造化詳細へ進む」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000032: CRDD作成者・保守者が「工程固有の図から状態・関係・未接続を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD閲覧者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000001 | REQ-000001: CRDD作成者・保守者が「意味レビュー前に機械判定できる不備を落とす」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000023 | REQ-000031: CRDD作成者・保守者が「課題と判断の物語から構造化詳細へ進む」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000032: CRDD作成者・保守者が「工程固有の図から状態・関係・未接続を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD閲覧者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000001／PRT-000001](../../../04_UI/Details/Areas/operation/SCR-000001/screen.md) | UI-000001 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [SCR-000018／PRT-000018](../../../04_UI/Details/Areas/project-context/SCR-000018/screen.md) | UI-000018 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000001](../../../05_SPEC/Details/BHV-000001/behavior.md) | SPEC-000001 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000023](../../../05_SPEC/Details/BHV-000023/behavior.md) | SPEC-000023 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000001.spec-000001`、`PRT-000018.spec-000023`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のCheckerと文書検査 | Checker／CRDD現行Profile（06_Architecture/checker） | Checker CoreとCRDD現行Profile | 保持・再編 | [checker:integration:crdd-check](../../../07_Quality/Registry/test-catalog.json) | 新工程の構造契約をProfileへ追加 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「決定論的なRepository検査、文書構造検査、意味レビューへの案内」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 入力固定→検査→構造化結果→必要時に意味レビューへ案内を段階的な結合試験で確認する。
- 読取不能、対象不明、Profile不一致、形式適合だけの完成表示を理由別に反証する。
- 取消・Recovery・外部送信は非該当。子Processを使う検査だけはProcess終了確認を別途必要とする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/checker/01_Architecture.md)
- [現行照合先](../../99_Coding_Standards.md)

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
