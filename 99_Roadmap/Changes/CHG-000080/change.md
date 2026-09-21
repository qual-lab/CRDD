# Engineering Design／Implementation／Verificationの完全性

変更ID: `CHG-000080`
状態: `In Progress`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `engineering_completeness_contract_extension`

## 0. 現在状態

| 項目 | 現在値 |
|---|---|
| 現在の変更状態 | Engineering CompletenessをRule、Format、Traceability、CheckerおよびCRDD自身の現実まで閉じる途中 |
| Phase／Gate適用判断 | `Applicable`: Architecture、実装、Quality、MigrationおよびReality Auditを一括変更せず、局所Gateで成立確認する必要がある |
| 現在Phase | `Phase 2／3／6／7 — Contract Migration`: Source Header、Local Item、OptionalityおよびCRDD自身の利用側移行を進めている |
| 現在Gate | `Gate 0 — Passed`: Phase／Gate／途中拡張／途中見直し契約を正本、ひな型、Checkerおよび本CHGへ反映した。後続Gateの成立は示さない |
| 成立済み | Architecture Detailsの実装構造観点、試験段階付きLocal Item 150件、日本語の条件区分、UAT／IT Pilot、Production Headerの構造Gate |
| 未成立 | 全Source／Test Header移行、Optionality Audit全数処置、全SubsystemのRequired Verification差分、Reality Audit、独立レビュー、署名E2E |
| 次のGate | Gate 2／3の前に、Production Header母集団とRequired／Defined Local Item集合を再固定する |

## 1. 変更の目的

重要な設計・実装・検証観点をAIの暗黙判断へ残さず、Canonical DesignからSource、TestおよびEvidenceまで完全性を追跡可能にする。Canonicalな工程成果物から必要な検証義務の母集合を導き、定義済みLocal Itemや既存Testの件数から試験十分性を逆算しない構造へ強化する。同時に、Architecture、Implementation Structure、Source／Test Contract、OptionalityおよびMigrationを一つのEngineering Contractとして閉じる。

```text
REQ／UX／IA              ──→ UAT Obligation
UI／SPEC                 ──→ ST Obligation
Architecture             ──→ IT Obligation
Architecture Details／実装構造 ──→ UT Obligation
                                 │
                                 ▼
                    QA-ID／Quality Local Item
                                 ↓
                              Test
                                 ↓
                             Evidence
```

この対応は試験段階の固定割当ではない。各工程が主に所有する成立条件を示し、同じ条件が異なる観測境界を必要とする場合はQuality Analysisで複数段階へ展開する。

## 2. 着手前整合確認

| 観点 | 現在判断 |
|---|---|
| 正本 | Architecture契約は`27_Architecture.md`、詳細設計とCoding規則は`06_Architecture`、Quality契約は`16_Quality_Assurance.md`と`07_Quality`が所有する |
| 現在の母集団 | REQ 36、UX 32、IA 22、UI 20、SPEC 29、ARCH 18の計157 Canonical ID、Architecture Details 18領域、Quality Definition 13件 |
| 成立済みCapability | 工程別Quality Analysis、13 Quality Definition、114 Local Item、UT／IT／ST／UAT適用表、外部境界の段階、PT／LT明示判断、Reality Audit Relationを維持する |
| 実証済みGap | Local ItemからTestへの接続は観測できるが、Canonical Modelから必要Local Item母集合を決定論的に導く構造がない |
| 追加する意味 | Canonical Model Item、導出Key、Required Verification Obligation、Implementation Structure Analysis、集合差Gate |
| 追加しないもの | REQ／UX／IA内のUAT専用ID、試験段階別QA-ID、Design Patternの一律強制、巨大Matrixの手編集正本、SourceからのCanonical Meaning逆算、Sub-CHG |
| 外部Effect | 文書、Template、Checkerおよび局所生成・検査に限定する。PT／LT、Provider送信、署名Runtime変更は別途判定する |

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 複数工程、実装、Checker、移行およびQualityへ影響する | 本CHGのPhase／Gateと独立レビューで再評価する |
| 変更する契約母集団 | Applicable | Architecture Details 18領域、Quality Definition 13件、Production／Test Named Symbolおよび関連ひな型・Checker | Phase 1〜7の母集団固定時に再確認する |
| 既知の利用側母集団と対象別の予定処置 | Applicable | CRDD公式成果物、配布ひな型、Checker、Source、TestおよびReality Auditが利用側である | Phase 7のSelf Migrationで全数照合する |
| 安全上重要な層間搬送 | Applicable | Canonical DesignからLocal Item、Test、Evidenceへの搬送が完成主張を決める | Phase 3、4、8でproducer／transport／consumerを照合する |
| 保護対象Effect／Recoveryの耐久Authority | Applicable | Source Header、Architectureおよび検証義務にAuthority／Effect／Recovery条件を保持する | 該当SubsystemのArchitecture DetailsとQA Local Itemで再確認する |
| 残存資源／Recovery／Authority義務を伴う取得transaction | Applicable | 外部境界を持つSubsystemでは取得、失敗、cleanupおよび回復の完全性が必要である | Phase 1、3、8の境界別監査で再評価する |
| 発火例／非発火例／境界例／情報不足例 | Applicable | Optionality、Header、Local Item、Phase／Gateの各分岐で過剰適用と未評価を反証する | Checker契約試験と独立レビューで確認する |
| 定義・発火条件・判定不能・正式結果の分離 | Applicable | 未記載、N/A、OPEN、FAILおよびPassを同一視しない | Phase 6のOptionality Auditで全数確認する |
| 固定前の実差分照合 | Applicable | 正本、ひな型、Checker、CRDD自身の成果物を同じ固定候補で照合する | 各Phase Gateと独立レビュー前に再実行する |
| 根拠の主張軸（入口形態） | Applicable | 公開入口、Source入口およびTest入口の差が成立主張へ影響する | Reality AuditとE2Eで確認する |
| 根拠の主張軸（観測基盤） | Applicable | 静的解析、Checker、Runner、実境界では観測可能範囲が異なる | 検証結果ごとに取得範囲を記録する |
| 根拠の主張軸（成果物Identity） | Applicable | Canonical ID、ARCH-ID、QA Local Item、SymbolおよびEvidenceの対応が必要である | Semantic CoverageとReality Auditで照合する |
| 根拠の主張軸（lifecycle） | Applicable | 定義、実装、実行、回復および終了後状態を一つの成功へ畳まない | Quality CenterとE2Eで確認する |
| 未解消の不一致 | OPEN | Source／Test Header移行、Optionality全数処置、Required Verification差分、Reality Auditおよび独立レビューが残る | Phase 2〜9を通過した時点で0件を再確認する |

## 3. 採用する責務境界

### 3.1. 上流工程とQuality

- REQ／UX／IAは受入に必要な意味の正本を維持し、UAT専用Local Itemを所有しない。
- Quality Analysisは上流の成立条件からRequired Verification Obligationを導出する。
- Quality DefinitionだけがLocal Itemを所有する。
- QA-IDは検証目標を表し、UT／IT／ST／UATごとに分割しない。
- 実行結果とEvidenceをDefinitionへ書き込まない。

### 3.2. Architectureと実装構造

- Architecture DetailsはComponent、Interface、State、Sequence、Data／Resource Flow、Failure／Recovery等を構造化されたCanonical Modelとして保持する。
- 図は人間可読な投影であり、機械導出の唯一の入力にしない。
- Variation、生成・選択、状態依存、構成、Lifecycleおよび外部境界を適用判定する。
- 同一責務の2つ目の具象実装を追加する場合は、Common Contractへの昇格を評価する。
- Pattern名の採用自体を品質条件にしない。

### 3.3. Quality Coverage

```text
Canonical Model Item
        ↓
Required Verification Obligation
        ↓
Defined Local Item
        ↓
Test Connected
        ↓
Executed／Passed／Evidence
```

各段階を別の状態として扱う。後段の存在から前段の完全性を推定しない。

## 4. 実装順序

1. 現行Templateと157 Canonical IDの表現能力を棚卸しする。
2. Architecture DetailsへCanonical Model ItemとImplementation StructureのTemplateを追加する。
3. Quality Analysis／Definitionへ導出元、条件区分、Integration Scopeおよび集合差を固定する。
4. REQ／UX／IAからUAT ObligationをPilot導出する。
5. Coordinator／Project RuntimeのArchitecture DetailsからIT ObligationをPilot導出する。
6. 導出不能な意味だけを上流TemplateのGapとして是正する。
7. Checkerまたは決定論的CompilerでRequired／Definedの集合差を検査する。
8. 現行13 Quality DefinitionとReality Audit Relationを移行する。
9. Formatter、型、Lint、局所試験、全回帰、Repository Checkerおよび独立レビューを完了する。

## Phase／Gateと途中拡張

### 適用判断

| 評価対象 | 判定 | 理由 |
|---|---|---|
| Phase／Gate | Applicable | Architecture、実装、Quality、MigrationおよびReality Auditを一括変更せず、同じ変更意図の局所成立を確認する必要がある |

### PhaseとGate

PhaseはCHGを分割する別Identityではなく、一つの変更意図を安全に成立させる内部段階である。各Gateの通過は局所成立だけを示し、CHG全体の採用、Releaseまたは完了を意味しない。

| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |
|---|---|---|---|---|---|
| Phase 0: CHG Model Extension | 途中拡張・途中見直しを履歴とGate付きで扱う | `12_Change.md`、`19_Maintenance.md`、CHGひな型、Checker、本CHG | 発火・非発火・境界・情報不足例と構造契約試験 | 正本・ひな型・Checker・Dogfoodが一致し、別CHG判定とGate再開を検査できる | Passed |
| Phase 1: Architecture Completeness | 基本・詳細設計から必要構造と検証対象を導く | Canonical Model、実装構造、Component／Boundary／State／Flow／Failure | 全詳細設計領域の適用表と導出差分 | 全18領域を適用、理由付きN/AまたはOPENへ処置する | In Progress |
| Phase 2: Implementation Contract | Production Named Symbolを設計責務へ接続する | 固定Header Schema、ARCH Trace、Source Migration | Header構造、実在Trace、Architecture所有責務 | 対象Symbol全件がHeaderと実在ARCH-IDを持つ | In Progress |
| Phase 3: Verification Completeness | 必要な試験義務とLocal Item集合を閉じる | UT／IT／ST／UAT、条件区分、外部境界段階、集合差 | Required／Defined／Level／Boundary差分 | Required - DefinedとLevel／Boundary不足が0件 | In Progress |
| Phase 4: Test Source Contract | Test実装をQuality Local Itemへ接続する | Test Case／Named Helper／Fixture Header、QA Trace | Header構造、Local Item実在、試験段階一致 | Test Symbol全件が実在Local Itemと試験段階に一致する | In Progress |
| Phase 5: UAT Pilot | 上流の受入意味からUAT義務を再現する | REQ／UX／IA Pilot | Source別UAT ObligationとSame／New判断 | 推測なしで導出でき、重複・導出不能を処置する | Pilot Completed／全体展開待ち |
| Phase 6: Optionality Audit | 重要評価の未記載をなくす | CRDD全体のOptional表現、Format、Checker | A〜F全数分類、理由付きN/A／OPEN、負例 | A〜F分類とC〜Fの必須評価化、理由なしN/A／OPEN 0件 | In Progress |
| Phase 7: CRDD Self Migration | 新ContractをCRDD自身へ適用する | Architecture、Source、Test、Quality、Traceability | 契約母集団と利用側母集団の全数照合 | Ruleと現実の未移行0件 | In Progress |
| Phase 8: Reality Audit | CanonicalからEvidenceまで照合する | Design→Obligation→Local Item→Test→Execution→Evidence | 欠落、矛盾、Orphan、Freshnessを全数判定 | 欠落・矛盾・Orphanを全数処置する | Planned |
| Phase 9: Independent Review／Release Gate | 独立反証とRelease Readinessを閉じる | 必須監査、全回帰、署名E2E | 固定改訂版への独立レビュー、監査、署名E2E | Blocking Finding 0、必要な署名E2E Pass、人間のRelease判断へ引渡し可能 | Planned |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| Production Headerの必須tagだけでは既存Source全体を閉じられない | Canonical DesignからSourceまで完全性を追跡する同じ目的であり、単独Releaseしない | Phase 2へ全Named Symbolと全固定tagを追加 | Production母集団の全数移行をGateへ追加 | Coding Standards、Checker負例、独立レビュー | Added |
| Local Itemに試験段階・条件区分・外部境界段階の不足があった | Required Verificationの母集合を閉じる同じ目的である | Phase 3へLocal Item再採番、細分化、日本語5条件区分を追加 | Level／Boundary／条件区分の集合差0を要求 | Quality Definition、Checker、全回帰 | Added |
| 重要観点が「必要に応じて」で未評価のまま省略できる | AIの暗黙判断をFormatへ戻す同じ目的である | Phase 6としてOptionality Auditを追加 | C〜Fの必須評価化とSelf Migrationを完了条件へ追加 | CRDD正本、全ひな型、Checker、独立監査 | Added |
| 同じIntentの不足発見ごとにCHGが細分化し得る | 本CHG自身を完成まで追跡するChange Management上の前提不足である | Phase 0としてPhase／Gate／Scope Extension契約を追加 | Gate 0通過前に以後のPhase完了を確定しない | Change正本、Maintenance、ひな型、Checker | Added |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| 新しいLocal Item IDをSchemaだけが受理し、Domain Validatorが旧形式を要求していた | Local Item再採番後もSymbol Graph契約はそのまま成立するという前提 | Phase 3／7のValidator移行を追加し、Gate 3は新旧二重契約解消後に判定する | Symbol Manifest Validator局所試験、Schema整合、全Symbol Graph試験 | QA-ID、Local Itemの意味、Architecture Relationは変更しない | Revised |
| Production Header Gateが約3.8万のtag単位指摘を検出した | 一部PackageのHeader補強だけでPhase 2を閉じられるという見込み | Gate 2を未通過のまま維持し、全Production Named SymbolをPackage単位で移行する | Header母集団、実在ARCH-ID、全固定tag、Formatter／型／Lint／全回帰 | Header Schemaと「Public／privateを分けない」原則は変更しない | Revised |
| 型宣言へFunction用の入出力・事前事後条件を要求すると、非該当説明が主となり型契約が読みにくくなった | 全Named Symbolへ単一Header Schemaを適用すれば責務を同じ精度で保存できるという前提 | Phase 2のHeaderを型契約、状態所有、実行責務の3 Schemaへ分離する | Schema別の正例・負例、全Production母集団、Formatter／型／Lint | Summary、責務、実在ARCH-IDへのTrace、必須評価原則は変更しない | Revised |
| 既存Test Suite Relation 37件すべてで、物理配置の試験段階とLocal Item IDの段階が少なくとも1件不一致だった | 既存`symbol.json`のTest RelationをそのままHeader移行入力にできるという前提 | Phase 4でTest Catalog 193件と個別Test Case／Helper／Fixtureを再分析し、物理配置またはLocal Item Relationを正す | Test File段階、Local Item段階、実在ID、個別Test責務、全Test実行 | 既存Testの成立済み検証能力とQuality Local Itemの意味は、置換根拠なしに削除・改称しない | Revised |

#### Production Header移行母集団

`tools-naming.contract.test.ts`がTypeScript Projectから取得したProduction Named Symbolを同じ固定改訂版で集計した。違反件数はtag単位であり、Symbol件数とは分ける。

| Package | 未移行Symbol | tag単位指摘 | 現在処置 |
|---|---:|---:|---|
| coordinator | 2166 | 28086 | 3 Schemaへ移行し、実在ARCH-IDを領域別に接続。構造違反0 |
| project-runtime | 209 | 2682 | 3 Schemaへ移行。構造違反0 |
| version-control | 140 | 1818 | 3 Schemaへ移行。構造違反0 |
| checker | 113 | 1456 | 3 Schemaへ移行。構造違反0 |
| crdd-domain-library | 74 | 958 | 3 Schemaへ移行。構造違反0 |
| execution-intelligence | 63 | 818 | 3 Schemaへ移行。構造違反0 |
| runtime-data | 58 | 746 | 3 Schemaへ移行。構造違反0 |
| mcp | 52 | 672 | 3 Schemaへ移行。構造違反0 |
| verification-runner | 52 | 676 | 3 Schemaへ移行。構造違反0 |
| semantic-coverage | 48 | 456 | 3 Schemaへ移行。構造違反0 |
| artifact-signing | 12 | 90 | 3 Schemaへ移行。構造違反0 |
| 合計 | 2987 | 38458 | 全2987 Symbolの構造移行済み。意味妥当性の独立レビュー待ち |

### Optionality Auditの現在結果

検索語の件数は問題件数ではない。`任意byte列`、`任意Path`、固定履歴中の記述、規範語彙の定義等も含むため、各該当箇所をA〜Fへ分類してから処置する。

| 母集団 | 観測結果 | 現在の処置 |
|---|---:|---|
| Markdown全体 | 137ファイル、357一致 | 分類対象。件数だけでOptional Evaluationと判定しない |
| 固定履歴（Change／Release／Evidence／CHANGELOG） | 136一致 | 当時の記録を現在形へ書き換えず、現行正本・ひな型・Checkerへの移行要否だけを確認する |
| 現行文書（固定履歴を除く） | 221一致 | A〜F分類とC〜FのFormat／Checker接続を継続する |
| 配布ひな型 | 6一致 | 全件確認済み。任意機能、条件付きの実行経路、禁止する任意Pathまたは補助Toolであり、未評価を許す欄は0件 |

優先対象では、Quality結果の層間搬送、耐久Authority、残存資源／Recovery、四つの根拠軸、PT／LTおよび人間判断を11件の必須適用判断へ昇格した。Architecture Detailsの7実装構造観点は判定理由列と`OPEN`を持つ全数評価へ変更した。UI／Architecture固定入口は維持責任者、基本決定権限、項目別例外Authorityを分離した。Communicationの認知意図、市場・採用探索および人間対象調査、SPECの要求から終了までの段階分離、CHGの固定前収束確認も、曖昧な「該当する場合」から理由付き適用判断へ変更した。

Phase 6は現行文書221一致の分類と、実成果物・Test Headerを含む利用側移行が完了するまで`In Progress`を維持する。

CHG-000079で成立したSource命名、公開入口および限定Header契約は、本CHGのPhase 2が引き継ぐ基準Capabilityである。CHG-000079の完了履歴と署名Evidenceは変更せず、本CHGはそこから判明した全Named Symbol、固定Header SchemaおよびSource／Test Traceability不足を追加範囲として所有する。

## 5. Pilotの判定基準

| 確認 | 完了条件 |
|---|---|
| UAT導出 | REQの受入条件、UXの利用者成果・重要場面・失敗、IAの情報発見・理解・関連付けから、AI推測なしに義務を導ける |
| IT導出 | Component、Boundary、State Transition、Sequence、Failure／Recoveryの各適用項目から義務を列挙できる |
| UT補完 | Architecture DetailsとImplementation Structureから局所責務、分岐、不変条件およびErrorの義務を導ける |
| 統合 | 同じ意味を重複Local Item化せず、Same／New／Mergeの理由を説明できる |
| 完全性 | Required ObligationとLocal Itemの集合差を機械的に検出できる |
| 非該当 | N/Aに理由があり、未検討または後工程送りへ使われていない |

## 6. 現在状態と構造変更

### 6.1. UAT導出Pilot

Project Viewの受入を代表例として、既存TestやLocal Itemを先に見ず、上流Definitionから必要義務を導出した。

| Source | Obligation Key | 導出したUAT義務 | 対応Local Item | 差分 |
|---|---|---|---|---|
| [REQ-000007](../../../01_Discovery/Definitions/REQ-000007/requirement.md) | `req-000007.acceptance` | 欠測、制限、競合、古さを完全な現在値へ畳まず、根拠または次の判断対象へ進める。 | `PPR-UAT-007` | なし |
| [UX-000009](../../../02_UX/Definitions/UX-000009/ux_definition.md) | `ux-000009.current-view` | 現在の表示を信じる直前に、根拠、不完全性、観測時点を理解し、確認先を選べる。 | `PPR-UAT-007` | なし |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | `ia-000006.find-understand` | Project、Repository、Binding、Source、Coverage、状態を発見・識別・関連付けできる。 | `PPR-UAT-007` | なし |

REQの成立条件・検証意図、UXの利用者成果・重要場面・失敗、IAの対象・Relation・状態・見つけ方から導出できたため、このPilotでは上流TemplateへUAT専用Propertyを追加しない。

### 6.2. ArchitectureからITへの導出Pilot

CoordinatorとProject Runtimeでは、詳細設計の境界、状態、順序、故障および終了後条件を局所導出キーへ接続した。8キーを先に導出し、既存Quality Definitionとの集合差を後から比較した。

| 詳細設計領域 | 導出キー | 対応する主なLocal Item | Required - Defined |
|---|---|---|---:|
| Coordinator | `coord.provider-selection` | `ERB-IT-006`、`ERB-IT-008` | 0 |
| Coordinator | `coord.provider-attempt` | `ERB-IT-001`、`ERB-IT-002`、`ERB-ST-005`、`EST-ST-003`、`EST-ST-005`、`CPR-IT-001` | 0 |
| Coordinator | `coord.signed-promotion` | `AIT-ST-010` | 0 |
| Coordinator | `coord.task-recovery` | `PRL-ST-003`、`PRL-ST-004` | 0 |
| Coordinator | `coord.docker-repair-handoff` | `PRL-ST-004`、`ERB-ST-009`、`ERB-ST-011` | 0 |
| Project Runtime | `project-runtime.task-lifecycle` | `PRL-ST-001`〜`PRL-UT-006`、`PRL-IT-011` | 0 |
| Project Runtime | `project-runtime.acceptance-decision` | `PRL-UT-007`〜`PRL-UAT-010` | 0 |
| Project Runtime | `project-runtime.public-application` | `PRL-ST-001`、`PRL-IT-012`、`EST-IT-001` | 0 |

Pilot範囲の`Defined - Required`、Level不一致、Relation不明も0件だった。これは既存Qualityが十分だった証明ではなく、今回の8導出キーに限り、必要義務と既存Local Itemが一致した結果である。残り16詳細設計領域は移行後に同じ差分判定を行う。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`03_Documentation.md`](../../../03_Documentation.md)
- [`05_SPEC/04_Actor_System_Sequence.md`](../../../05_SPEC/04_Actor_System_Sequence.md)
- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`06_Architecture/Details/artifact-signing/01_Architecture.md`](../../../06_Architecture/Details/artifact-signing/01_Architecture.md)
- [`06_Architecture/Details/checker/01_Architecture.md`](../../../06_Architecture/Details/checker/01_Architecture.md)
- [`06_Architecture/Details/contract-migration/01_Architecture.md`](../../../06_Architecture/Details/contract-migration/01_Architecture.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`06_Architecture/Details/crdd-domain-library/01_Architecture.md`](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md)
- [`06_Architecture/Details/cros/01_Architecture.md`](../../../06_Architecture/Details/cros/01_Architecture.md)
- [`06_Architecture/Details/execution-intelligence/01_Architecture.md`](../../../06_Architecture/Details/execution-intelligence/01_Architecture.md)
- [`06_Architecture/Details/mcp/01_Architecture.md`](../../../06_Architecture/Details/mcp/01_Architecture.md)
- [`06_Architecture/Details/official-asset-governance/01_Architecture.md`](../../../06_Architecture/Details/official-asset-governance/01_Architecture.md)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](../../../06_Architecture/Details/platform-access/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](../../../06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/project-runtime/01_Architecture.md`](../../../06_Architecture/Details/project-runtime/01_Architecture.md)
- [`06_Architecture/Details/quality-change-control/01_Architecture.md`](../../../06_Architecture/Details/quality-change-control/01_Architecture.md)
- [`06_Architecture/Details/runtime-data/01_Architecture.md`](../../../06_Architecture/Details/runtime-data/01_Architecture.md)
- [`06_Architecture/Details/runtime-trust/01_Architecture.md`](../../../06_Architecture/Details/runtime-trust/01_Architecture.md)
- [`06_Architecture/Details/semantic-coverage/01_Architecture.md`](../../../06_Architecture/Details/semantic-coverage/01_Architecture.md)
- [`06_Architecture/Details/verification-runner/01_Architecture.md`](../../../06_Architecture/Details/verification-runner/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/03_Verification_Design.md`](../../../07_Quality/03_Verification_Design.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Analysis/IA/quality_analysis.md`](../../../07_Quality/Analysis/IA/quality_analysis.md)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](../../../07_Quality/Analysis/REQ/quality_analysis.md)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](../../../07_Quality/Analysis/SPEC/quality_analysis.md)
- [`07_Quality/Analysis/UI/quality_analysis.md`](../../../07_Quality/Analysis/UI/quality_analysis.md)
- [`07_Quality/Analysis/UX/quality_analysis.md`](../../../07_Quality/Analysis/UX/quality_analysis.md)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](../../../07_Quality/Definitions/QA-000001/quality_definition.md)
- [`07_Quality/Definitions/QA-000002/quality_definition.md`](../../../07_Quality/Definitions/QA-000002/quality_definition.md)
- [`07_Quality/Definitions/QA-000003/quality_definition.md`](../../../07_Quality/Definitions/QA-000003/quality_definition.md)
- [`07_Quality/Definitions/QA-000004/quality_definition.md`](../../../07_Quality/Definitions/QA-000004/quality_definition.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Definitions/QA-000007/quality_definition.md`](../../../07_Quality/Definitions/QA-000007/quality_definition.md)
- [`07_Quality/Definitions/QA-000008/quality_definition.md`](../../../07_Quality/Definitions/QA-000008/quality_definition.md)
- [`07_Quality/Definitions/QA-000009/quality_definition.md`](../../../07_Quality/Definitions/QA-000009/quality_definition.md)
- [`07_Quality/Definitions/QA-000010/quality_definition.md`](../../../07_Quality/Definitions/QA-000010/quality_definition.md)
- [`07_Quality/Definitions/QA-000011/quality_definition.md`](../../../07_Quality/Definitions/QA-000011/quality_definition.md)
- [`07_Quality/Definitions/QA-000012/quality_definition.md`](../../../07_Quality/Definitions/QA-000012/quality_definition.md)
- [`07_Quality/Definitions/QA-000013/quality_definition.md`](../../../07_Quality/Definitions/QA-000013/quality_definition.md)
- [`07_Quality/Registry/semantic-coverage-pilot.json`](../../../07_Quality/Registry/semantic-coverage-pilot.json)
- [`12_Change.md`](../../../12_Change.md)
- [`16_Quality_Assurance.md`](../../../16_Quality_Assurance.md)
- [`19_Maintenance.md`](../../../19_Maintenance.md)
- [`27_Architecture.md`](../../../27_Architecture.md)
- [`28_Implementation.md`](../../../28_Implementation.md)
- [`29_Verification.md`](../../../29_Verification.md)
- [`40_Develop/artifact-signing/src/private-key-signing.ts`](../../../40_Develop/artifact-signing/src/private-key-signing.ts)
- [`40_Develop/artifact-signing/src/terminal-secret-input.ts`](../../../40_Develop/artifact-signing/src/terminal-secret-input.ts)
- [`40_Develop/artifact-signing/symbol.json`](../../../40_Develop/artifact-signing/symbol.json)
- [`40_Develop/checker/src/adapters/artifact-relation.ts`](../../../40_Develop/checker/src/adapters/artifact-relation.ts)
- [`40_Develop/checker/src/adapters/reality-test-catalog.ts`](../../../40_Develop/checker/src/adapters/reality-test-catalog.ts)
- [`40_Develop/checker/src/adapters/reality-traceability.ts`](../../../40_Develop/checker/src/adapters/reality-traceability.ts)
- [`40_Develop/checker/src/application/checker-command.ts`](../../../40_Develop/checker/src/application/checker-command.ts)
- [`40_Develop/checker/src/findings/finding-model.ts`](../../../40_Develop/checker/src/findings/finding-model.ts)
- [`40_Develop/checker/src/pipeline/checker-pipeline.ts`](../../../40_Develop/checker/src/pipeline/checker-pipeline.ts)
- [`40_Develop/checker/src/profiles/current-profile.ts`](../../../40_Develop/checker/src/profiles/current-profile.ts)
- [`40_Develop/checker/src/rules/current-profile.ts`](../../../40_Develop/checker/src/rules/current-profile.ts)
- [`40_Develop/checker/src/rules/quality-design-state.ts`](../../../40_Develop/checker/src/rules/quality-design-state.ts)
- [`40_Develop/checker/src/rules/reality-symbol-graph.ts`](../../../40_Develop/checker/src/rules/reality-symbol-graph.ts)
- [`40_Develop/checker/src/rules/rule-registry.ts`](../../../40_Develop/checker/src/rules/rule-registry.ts)
- [`40_Develop/checker/symbol.json`](../../../40_Develop/checker/symbol.json)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/checker/tests/unit/symbol-graph.contract.test.ts`](../../../40_Develop/checker/tests/unit/symbol-graph.contract.test.ts)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts)
- [`40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts`](../../../40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts)
- [`40_Develop/coordinator/src/core/cli-options.ts`](../../../40_Develop/coordinator/src/core/cli-options.ts)
- [`40_Develop/coordinator/src/core/command-report.ts`](../../../40_Develop/coordinator/src/core/command-report.ts)
- [`40_Develop/coordinator/src/core/coordinator-launch.ts`](../../../40_Develop/coordinator/src/core/coordinator-launch.ts)
- [`40_Develop/coordinator/src/core/development-execution-timing.ts`](../../../40_Develop/coordinator/src/core/development-execution-timing.ts)
- [`40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts`](../../../40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts)
- [`40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts`](../../../40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts)
- [`40_Develop/coordinator/src/core/docker-recovery-command-report.ts`](../../../40_Develop/coordinator/src/core/docker-recovery-command-report.ts)
- [`40_Develop/coordinator/src/core/docker-restart-execution.ts`](../../../40_Develop/coordinator/src/core/docker-restart-execution.ts)
- [`40_Develop/coordinator/src/core/docker-restart-state.ts`](../../../40_Develop/coordinator/src/core/docker-restart-state.ts)
- [`40_Develop/coordinator/src/core/doctor.ts`](../../../40_Develop/coordinator/src/core/doctor.ts)
- [`40_Develop/coordinator/src/core/host-generation-loss-transition.ts`](../../../40_Develop/coordinator/src/core/host-generation-loss-transition.ts)
- [`40_Develop/coordinator/src/core/interactive-console-reader-lifecycle-internal.ts`](../../../40_Develop/coordinator/src/core/interactive-console-reader-lifecycle-internal.ts)
- [`40_Develop/coordinator/src/core/interactive-console-reader.ts`](../../../40_Develop/coordinator/src/core/interactive-console-reader.ts)
- [`40_Develop/coordinator/src/core/interactive-console.ts`](../../../40_Develop/coordinator/src/core/interactive-console.ts)
- [`40_Develop/coordinator/src/core/node-runtime-version.ts`](../../../40_Develop/coordinator/src/core/node-runtime-version.ts)
- [`40_Develop/coordinator/src/core/project-runtime-design-traceability.ts`](../../../40_Develop/coordinator/src/core/project-runtime-design-traceability.ts)
- [`40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts`](../../../40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts)
- [`40_Develop/coordinator/src/core/runtime-process-safety-state.ts`](../../../40_Develop/coordinator/src/core/runtime-process-safety-state.ts)
- [`40_Develop/coordinator/src/core/runtime-traceability.ts`](../../../40_Develop/coordinator/src/core/runtime-traceability.ts)
- [`40_Develop/coordinator/src/core/task-cli-cancellation.ts`](../../../40_Develop/coordinator/src/core/task-cli-cancellation.ts)
- [`40_Develop/coordinator/src/core/verification-result-record.ts`](../../../40_Develop/coordinator/src/core/verification-result-record.ts)
- [`40_Develop/coordinator/src/core/windows-child-environment.ts`](../../../40_Develop/coordinator/src/core/windows-child-environment.ts)
- [`40_Develop/coordinator/src/security/authority-file-bundle.ts`](../../../40_Develop/coordinator/src/security/authority-file-bundle.ts)
- [`40_Develop/coordinator/src/security/authority-grant-verifier.ts`](../../../40_Develop/coordinator/src/security/authority-grant-verifier.ts)
- [`40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts`](../../../40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts)
- [`40_Develop/coordinator/src/security/authority-root-path-lexical.ts`](../../../40_Develop/coordinator/src/security/authority-root-path-lexical.ts)
- [`40_Develop/coordinator/src/security/authority-trust-loader.ts`](../../../40_Develop/coordinator/src/security/authority-trust-loader.ts)
- [`40_Develop/coordinator/src/security/bounded-file-snapshot.ts`](../../../40_Develop/coordinator/src/security/bounded-file-snapshot.ts)
- [`40_Develop/coordinator/src/security/candidate-bundle-store.ts`](../../../40_Develop/coordinator/src/security/candidate-bundle-store.ts)
- [`40_Develop/coordinator/src/security/candidate-store-kernel-lock-lifecycle-internal.ts`](../../../40_Develop/coordinator/src/security/candidate-store-kernel-lock-lifecycle-internal.ts)
- [`40_Develop/coordinator/src/security/candidate-store-kernel-lock.ts`](../../../40_Develop/coordinator/src/security/candidate-store-kernel-lock.ts)
- [`40_Develop/coordinator/src/security/candidate-store-lock-worker.ts`](../../../40_Develop/coordinator/src/security/candidate-store-lock-worker.ts)
- [`40_Develop/coordinator/src/security/candidate-store-windows-adapter.ts`](../../../40_Develop/coordinator/src/security/candidate-store-windows-adapter.ts)
- [`40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts`](../../../40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts)
- [`40_Develop/coordinator/src/security/claude-execution-plan.ts`](../../../40_Develop/coordinator/src/security/claude-execution-plan.ts)
- [`40_Develop/coordinator/src/security/claude-structured-result.ts`](../../../40_Develop/coordinator/src/security/claude-structured-result.ts)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts)
- [`40_Develop/coordinator/src/security/codex-execution-plan.ts`](../../../40_Develop/coordinator/src/security/codex-execution-plan.ts)
- [`40_Develop/coordinator/src/security/codex-executor-seccomp.ts`](../../../40_Develop/coordinator/src/security/codex-executor-seccomp.ts)
- [`40_Develop/coordinator/src/security/codex-structured-result.ts`](../../../40_Develop/coordinator/src/security/codex-structured-result.ts)
- [`40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts`](../../../40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts)
- [`40_Develop/coordinator/src/security/coordinator-task-request.ts`](../../../40_Develop/coordinator/src/security/coordinator-task-request.ts)
- [`40_Develop/coordinator/src/security/coordinator-task-runtime.ts`](../../../40_Develop/coordinator/src/security/coordinator-task-runtime.ts)
- [`40_Develop/coordinator/src/security/delegation-route-selection.ts`](../../../40_Develop/coordinator/src/security/delegation-route-selection.ts)
- [`40_Develop/coordinator/src/security/delegation-selection-grant-runtime.ts`](../../../40_Develop/coordinator/src/security/delegation-selection-grant-runtime.ts)
- [`40_Develop/coordinator/src/security/development-measurement-constraints.ts`](../../../40_Develop/coordinator/src/security/development-measurement-constraints.ts)
- [`40_Develop/coordinator/src/security/development-measurement-session.ts`](../../../40_Develop/coordinator/src/security/development-measurement-session.ts)
- [`40_Develop/coordinator/src/security/docker-cli-trust.ts`](../../../40_Develop/coordinator/src/security/docker-cli-trust.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-current-artifact-trust.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-current-artifact-trust.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-continuation-store.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-continuation-store.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-history-publication.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-history-publication.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts)
- [`40_Develop/coordinator/src/security/docker-host-transition-state.ts`](../../../40_Develop/coordinator/src/security/docker-host-transition-state.ts)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](../../../40_Develop/coordinator/src/security/docker-isolation.ts)
- [`40_Develop/coordinator/src/security/docker-owned-process.ts`](../../../40_Develop/coordinator/src/security/docker-owned-process.ts)
- [`40_Develop/coordinator/src/security/docker-process-controller.ts`](../../../40_Develop/coordinator/src/security/docker-process-controller.ts)
- [`40_Develop/coordinator/src/security/docker-project-recovery-settlement.ts`](../../../40_Develop/coordinator/src/security/docker-project-recovery-settlement.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-identity.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-identity.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-journal.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-journal.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-lock-controller.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-lock-controller.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-public-projection.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-public-projection.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-runtime.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-state-machine.ts`](../../../40_Develop/coordinator/src/security/docker-recovery-state-machine.ts)
- [`40_Develop/coordinator/src/security/docker-restart-continuation-record.ts`](../../../40_Develop/coordinator/src/security/docker-restart-continuation-record.ts)
- [`40_Develop/coordinator/src/security/docker-restart-handoff-record.ts`](../../../40_Develop/coordinator/src/security/docker-restart-handoff-record.ts)
- [`40_Develop/coordinator/src/security/docker-restart-machine.ts`](../../../40_Develop/coordinator/src/security/docker-restart-machine.ts)
- [`40_Develop/coordinator/src/security/docker-restart-record.ts`](../../../40_Develop/coordinator/src/security/docker-restart-record.ts)
- [`40_Develop/coordinator/src/security/docker-restart-runtime.ts`](../../../40_Develop/coordinator/src/security/docker-restart-runtime.ts)
- [`40_Develop/coordinator/src/security/docker-runtime-state-binding.ts`](../../../40_Develop/coordinator/src/security/docker-runtime-state-binding.ts)
- [`40_Develop/coordinator/src/security/docker-wsl-state.ts`](../../../40_Develop/coordinator/src/security/docker-wsl-state.ts)
- [`40_Develop/coordinator/src/security/egress-proxy-policy.ts`](../../../40_Develop/coordinator/src/security/egress-proxy-policy.ts)
- [`40_Develop/coordinator/src/security/execution-environment.ts`](../../../40_Develop/coordinator/src/security/execution-environment.ts)
- [`40_Develop/coordinator/src/security/execution-intelligence-adapter.ts`](../../../40_Develop/coordinator/src/security/execution-intelligence-adapter.ts)
- [`40_Develop/coordinator/src/security/external-send-consent-record.ts`](../../../40_Develop/coordinator/src/security/external-send-consent-record.ts)
- [`40_Develop/coordinator/src/security/external-send-consent-runtime.ts`](../../../40_Develop/coordinator/src/security/external-send-consent-runtime.ts)
- [`40_Develop/coordinator/src/security/external-send-grant-runtime.ts`](../../../40_Develop/coordinator/src/security/external-send-grant-runtime.ts)
- [`40_Develop/coordinator/src/security/external-send-policy-runtime.ts`](../../../40_Develop/coordinator/src/security/external-send-policy-runtime.ts)
- [`40_Develop/coordinator/src/security/host-operation-lock-supervisor.ts`](../../../40_Develop/coordinator/src/security/host-operation-lock-supervisor.ts)
- [`40_Develop/coordinator/src/security/host-recovery-record.ts`](../../../40_Develop/coordinator/src/security/host-recovery-record.ts)
- [`40_Develop/coordinator/src/security/local-personal-authority-runtime.ts`](../../../40_Develop/coordinator/src/security/local-personal-authority-runtime.ts)
- [`40_Develop/coordinator/src/security/native-runtime-trace.ts`](../../../40_Develop/coordinator/src/security/native-runtime-trace.ts)
- [`40_Develop/coordinator/src/security/plain-data-snapshot.ts`](../../../40_Develop/coordinator/src/security/plain-data-snapshot.ts)
- [`40_Develop/coordinator/src/security/platform-access-adapter.ts`](../../../40_Develop/coordinator/src/security/platform-access-adapter.ts)
- [`40_Develop/coordinator/src/security/platform-access-release.ts`](../../../40_Develop/coordinator/src/security/platform-access-release.ts)
- [`40_Develop/coordinator/src/security/platform-key-storage-policy.ts`](../../../40_Develop/coordinator/src/security/platform-key-storage-policy.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-gate.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-package-gate.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-policy-identity.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-policy-identity.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-release-trust.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-release-trust.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts)
- [`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-decision-capability-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-decision-capability-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts`](../../../40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts)
- [`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`](../../../40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts)
- [`40_Develop/coordinator/src/security/project-runtime-execution-authorization-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-execution-authorization-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`](../../../40_Develop/coordinator/src/security/project-runtime-objective-intake.ts)
- [`40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-task-recovery-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-task-recovery-adapter.ts)
- [`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`](../../../40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts)
- [`40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts`](../../../40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts)
- [`40_Develop/coordinator/src/security/provider-authority-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-authority-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-billing-policy.ts`](../../../40_Develop/coordinator/src/security/provider-billing-policy.ts)
- [`40_Develop/coordinator/src/security/provider-eligibility-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-eligibility-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-home-mount-grant-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-home-mount-grant-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-home-mount-grant.ts`](../../../40_Develop/coordinator/src/security/provider-home-mount-grant.ts)
- [`40_Develop/coordinator/src/security/provider-home-observation.ts`](../../../40_Develop/coordinator/src/security/provider-home-observation.ts)
- [`40_Develop/coordinator/src/security/provider-home-windows-adapter.ts`](../../../40_Develop/coordinator/src/security/provider-home-windows-adapter.ts)
- [`40_Develop/coordinator/src/security/provider-home.ts`](../../../40_Develop/coordinator/src/security/provider-home.ts)
- [`40_Develop/coordinator/src/security/provider-isolation-profile.ts`](../../../40_Develop/coordinator/src/security/provider-isolation-profile.ts)
- [`40_Develop/coordinator/src/security/provider-lifecycle.ts`](../../../40_Develop/coordinator/src/security/provider-lifecycle.ts)
- [`40_Develop/coordinator/src/security/provider-model-profile-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-model-profile-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-model-selection-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-model-selection-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-task-packet-runtime.ts`](../../../40_Develop/coordinator/src/security/provider-task-packet-runtime.ts)
- [`40_Develop/coordinator/src/security/provider-task-structured-result.ts`](../../../40_Develop/coordinator/src/security/provider-task-structured-result.ts)
- [`40_Develop/coordinator/src/security/provisioning-signature-primitives.ts`](../../../40_Develop/coordinator/src/security/provisioning-signature-primitives.ts)
- [`40_Develop/coordinator/src/security/release-identity-grammar.ts`](../../../40_Develop/coordinator/src/security/release-identity-grammar.ts)
- [`40_Develop/coordinator/src/security/repository-operation-runtime.ts`](../../../40_Develop/coordinator/src/security/repository-operation-runtime.ts)
- [`40_Develop/coordinator/src/security/repository-workspace-runtime.ts`](../../../40_Develop/coordinator/src/security/repository-workspace-runtime.ts)
- [`40_Develop/coordinator/src/security/root-observation.ts`](../../../40_Develop/coordinator/src/security/root-observation.ts)
- [`40_Develop/coordinator/src/security/root-protection-policy.ts`](../../../40_Develop/coordinator/src/security/root-protection-policy.ts)
- [`40_Develop/coordinator/src/security/secret-material-policy.ts`](../../../40_Develop/coordinator/src/security/secret-material-policy.ts)
- [`40_Develop/coordinator/src/security/signed-runner-safety-observation.ts`](../../../40_Develop/coordinator/src/security/signed-runner-safety-observation.ts)
- [`40_Develop/coordinator/src/security/windows-directory-bootstrap.ts`](../../../40_Develop/coordinator/src/security/windows-directory-bootstrap.ts)
- [`40_Develop/coordinator/symbol.json`](../../../40_Develop/coordinator/symbol.json)
- [`40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts`](../../../40_Develop/crdd-domain-library/src/artifact/artifact-graph.ts)
- [`40_Develop/crdd-domain-library/src/artifact/artifact-model.ts`](../../../40_Develop/crdd-domain-library/src/artifact/artifact-model.ts)
- [`40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts`](../../../40_Develop/crdd-domain-library/src/artifact/markdown-artifact-parser.ts)
- [`40_Develop/crdd-domain-library/src/artifact/schema-validator.ts`](../../../40_Develop/crdd-domain-library/src/artifact/schema-validator.ts)
- [`40_Develop/crdd-domain-library/src/outcome.ts`](../../../40_Develop/crdd-domain-library/src/outcome.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/domain-issue.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/domain-issue.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-annotation.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-discovery.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-graph.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-model.ts)
- [`40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts`](../../../40_Develop/crdd-domain-library/src/reality-traceability/symbol-manifest-validator.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/filesystem-repository-observer.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/index.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/index.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/reality-symbol-repository-observer.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/reality-symbol-repository-observer.ts)
- [`40_Develop/crdd-domain-library/symbol.json`](../../../40_Develop/crdd-domain-library/symbol.json)
- [`40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts`](../../../40_Develop/execution-intelligence/src/application/execution-intelligence-recorder.ts)
- [`40_Develop/execution-intelligence/src/boundary/plain-data-snapshot.ts`](../../../40_Develop/execution-intelligence/src/boundary/plain-data-snapshot.ts)
- [`40_Develop/execution-intelligence/src/core/bounded-integrated-result-evaluation.ts`](../../../40_Develop/execution-intelligence/src/core/bounded-integrated-result-evaluation.ts)
- [`40_Develop/execution-intelligence/src/core/execution-intelligence.ts`](../../../40_Develop/execution-intelligence/src/core/execution-intelligence.ts)
- [`40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts`](../../../40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts)
- [`40_Develop/execution-intelligence/src/store/verified-repository-root.ts`](../../../40_Develop/execution-intelligence/src/store/verified-repository-root.ts)
- [`40_Develop/execution-intelligence/symbol.json`](../../../40_Develop/execution-intelligence/symbol.json)
- [`40_Develop/mcp/src/adapters/project-runtime-adapter.ts`](../../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts)
- [`40_Develop/mcp/src/boundary/plain-data-snapshot.ts`](../../../40_Develop/mcp/src/boundary/plain-data-snapshot.ts)
- [`40_Develop/mcp/src/protocol/project-runtime-protocol.ts`](../../../40_Develop/mcp/src/protocol/project-runtime-protocol.ts)
- [`40_Develop/mcp/src/protocol/unambiguous-json-document.ts`](../../../40_Develop/mcp/src/protocol/unambiguous-json-document.ts)
- [`40_Develop/mcp/src/transports/process-signal-shutdown.ts`](../../../40_Develop/mcp/src/transports/process-signal-shutdown.ts)
- [`40_Develop/mcp/src/transports/stdio-transport.ts`](../../../40_Develop/mcp/src/transports/stdio-transport.ts)
- [`40_Develop/mcp/src/transports/streamable-http-transport.ts`](../../../40_Develop/mcp/src/transports/streamable-http-transport.ts)
- [`40_Develop/mcp/symbol.json`](../../../40_Develop/mcp/symbol.json)
- [`40_Develop/platform-access/symbol.json`](../../../40_Develop/platform-access/symbol.json)
- [`40_Develop/project-runtime/src/application/project-runtime-execution.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-execution.ts)
- [`40_Develop/project-runtime/src/application/project-runtime-human-decision.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-human-decision.ts)
- [`40_Develop/project-runtime/src/application/project-runtime-integration.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-integration.ts)
- [`40_Develop/project-runtime/src/application/project-runtime-objective-application.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-objective-application.ts)
- [`40_Develop/project-runtime/src/application/project-runtime-objective-intake.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-objective-intake.ts)
- [`40_Develop/project-runtime/src/application/project-runtime-replanning.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-replanning.ts)
- [`40_Develop/project-runtime/src/application/project-runtime-state-query.ts`](../../../40_Develop/project-runtime/src/application/project-runtime-state-query.ts)
- [`40_Develop/project-runtime/src/boundary/plain-data-snapshot.ts`](../../../40_Develop/project-runtime/src/boundary/plain-data-snapshot.ts)
- [`40_Develop/project-runtime/src/boundary/repository-relative-path.ts`](../../../40_Develop/project-runtime/src/boundary/repository-relative-path.ts)
- [`40_Develop/project-runtime/src/core/project-runtime-queue.ts`](../../../40_Develop/project-runtime/src/core/project-runtime-queue.ts)
- [`40_Develop/project-runtime/src/core/project-runtime-state.ts`](../../../40_Develop/project-runtime/src/core/project-runtime-state.ts)
- [`40_Develop/project-runtime/src/ports/candidate-port.ts`](../../../40_Develop/project-runtime/src/ports/candidate-port.ts)
- [`40_Develop/project-runtime/src/ports/clock-identity-port.ts`](../../../40_Develop/project-runtime/src/ports/clock-identity-port.ts)
- [`40_Develop/project-runtime/src/ports/decision-capability-port.ts`](../../../40_Develop/project-runtime/src/ports/decision-capability-port.ts)
- [`40_Develop/project-runtime/src/ports/decision-port.ts`](../../../40_Develop/project-runtime/src/ports/decision-port.ts)
- [`40_Develop/project-runtime/src/ports/execution-authorization-port.ts`](../../../40_Develop/project-runtime/src/ports/execution-authorization-port.ts)
- [`40_Develop/project-runtime/src/ports/execution-observation-port.ts`](../../../40_Develop/project-runtime/src/ports/execution-observation-port.ts)
- [`40_Develop/project-runtime/src/ports/execution-port.ts`](../../../40_Develop/project-runtime/src/ports/execution-port.ts)
- [`40_Develop/project-runtime/src/ports/integration-record-port.ts`](../../../40_Develop/project-runtime/src/ports/integration-record-port.ts)
- [`40_Develop/project-runtime/src/ports/lease-port.ts`](../../../40_Develop/project-runtime/src/ports/lease-port.ts)
- [`40_Develop/project-runtime/src/ports/platform-contract.ts`](../../../40_Develop/project-runtime/src/ports/platform-contract.ts)
- [`40_Develop/project-runtime/src/ports/port-result.ts`](../../../40_Develop/project-runtime/src/ports/port-result.ts)
- [`40_Develop/project-runtime/src/ports/process-safety-port.ts`](../../../40_Develop/project-runtime/src/ports/process-safety-port.ts)
- [`40_Develop/project-runtime/src/ports/state-port.ts`](../../../40_Develop/project-runtime/src/ports/state-port.ts)
- [`40_Develop/project-runtime/src/ports/task-recovery-port.ts`](../../../40_Develop/project-runtime/src/ports/task-recovery-port.ts)
- [`40_Develop/project-runtime/src/public-contract/decision-request.ts`](../../../40_Develop/project-runtime/src/public-contract/decision-request.ts)
- [`40_Develop/project-runtime/src/public-contract/integration-result.ts`](../../../40_Develop/project-runtime/src/public-contract/integration-result.ts)
- [`40_Develop/project-runtime/src/public-contract/objective-request.ts`](../../../40_Develop/project-runtime/src/public-contract/objective-request.ts)
- [`40_Develop/project-runtime/src/public-contract/project-state-query.ts`](../../../40_Develop/project-runtime/src/public-contract/project-state-query.ts)
- [`40_Develop/project-runtime/symbol.json`](../../../40_Develop/project-runtime/symbol.json)
- [`40_Develop/runtime-data/src/core/runtime-data-contract.ts`](../../../40_Develop/runtime-data/src/core/runtime-data-contract.ts)
- [`40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts`](../../../40_Develop/runtime-data/src/platform/runtime-data-path-resolver.ts)
- [`40_Develop/runtime-data/src/store/temporary-operation-store.ts`](../../../40_Develop/runtime-data/src/store/temporary-operation-store.ts)
- [`40_Develop/runtime-data/symbol.json`](../../../40_Develop/runtime-data/symbol.json)
- [`40_Develop/semantic-coverage/src/application/semantic-bundle.ts`](../../../40_Develop/semantic-coverage/src/application/semantic-bundle.ts)
- [`40_Develop/semantic-coverage/src/application/semantic-coverage.ts`](../../../40_Develop/semantic-coverage/src/application/semantic-coverage.ts)
- [`40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts`](../../../40_Develop/semantic-coverage/src/compilation/quality-semantic-relation.ts)
- [`40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts`](../../../40_Develop/semantic-coverage/src/compilation/semantic-ir-compiler.ts)
- [`40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts`](../../../40_Develop/semantic-coverage/src/coverage/semantic-coverage-graph.ts)
- [`40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts`](../../../40_Develop/semantic-coverage/src/infrastructure/filesystem-semantic-bundle-publisher.ts)
- [`40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts`](../../../40_Develop/semantic-coverage/src/migrations/legacy-runtime-inventory.ts)
- [`40_Develop/semantic-coverage/symbol.json`](../../../40_Develop/semantic-coverage/symbol.json)
- [`40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts`](../../../40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts)
- [`40_Develop/verification-runner/src/application/regression-runner.ts`](../../../40_Develop/verification-runner/src/application/regression-runner.ts)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](../../../40_Develop/verification-runner/src/catalog/test-catalog.ts)
- [`40_Develop/verification-runner/src/execution/regression-execution.ts`](../../../40_Develop/verification-runner/src/execution/regression-execution.ts)
- [`40_Develop/verification-runner/symbol.json`](../../../40_Develop/verification-runner/symbol.json)
- [`40_Develop/version-control/src/fixed-revision.ts`](../../../40_Develop/version-control/src/fixed-revision.ts)
- [`40_Develop/version-control/src/fixed-snapshot.ts`](../../../40_Develop/version-control/src/fixed-snapshot.ts)
- [`40_Develop/version-control/src/git/checker-repository-observation-adapter.ts`](../../../40_Develop/version-control/src/git/checker-repository-observation-adapter.ts)
- [`40_Develop/version-control/src/git/fixed-revision-adapter.ts`](../../../40_Develop/version-control/src/git/fixed-revision-adapter.ts)
- [`40_Develop/version-control/src/git/fixed-snapshot-adapter.ts`](../../../40_Develop/version-control/src/git/fixed-snapshot-adapter.ts)
- [`40_Develop/version-control/src/git/local-change-set-adapter.ts`](../../../40_Develop/version-control/src/git/local-change-set-adapter.ts)
- [`40_Develop/version-control/src/git/object-reader.ts`](../../../40_Develop/version-control/src/git/object-reader.ts)
- [`40_Develop/version-control/src/git/repository-layout-adapter.ts`](../../../40_Develop/version-control/src/git/repository-layout-adapter.ts)
- [`40_Develop/version-control/src/git/repository-layout.ts`](../../../40_Develop/version-control/src/git/repository-layout.ts)
- [`40_Develop/version-control/src/local-change-set.ts`](../../../40_Develop/version-control/src/local-change-set.ts)
- [`40_Develop/version-control/src/repository-local-ignore.ts`](../../../40_Develop/version-control/src/repository-local-ignore.ts)
- [`40_Develop/version-control/src/repository-location.ts`](../../../40_Develop/version-control/src/repository-location.ts)
- [`40_Develop/version-control/src/repository-revision.ts`](../../../40_Develop/version-control/src/repository-revision.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`99_Roadmap/01_Roadmap.md`](../../../99_Roadmap/01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../../99_Roadmap/02_Changes.md)
- [`99_Roadmap/Changes/CHG-000073/change.md`](../../../99_Roadmap/Changes/CHG-000073/change.md)
- [`99_Roadmap/Changes/CHG-000075/change.md`](../../../99_Roadmap/Changes/CHG-000075/change.md)
- [`99_Roadmap/Changes/CHG-000078/Evidence/260921_reality-audit-closure.md`](../../../99_Roadmap/Changes/CHG-000078/Evidence/260921_reality-audit-closure.md)
- [`99_Roadmap/Changes/CHG-000078/change.md`](../../../99_Roadmap/Changes/CHG-000078/change.md)
- [`99_Roadmap/Changes/CHG-000080/change.md`](change.md)
- [`template/04_UI/01_User_Interface.md`](../../../template/04_UI/01_User_Interface.md)
- [`template/05_SPEC/04_Actor_System_Sequence.md`](../../../template/05_SPEC/04_Actor_System_Sequence.md)
- [`template/06_Architecture/01_Architecture.md`](../../../template/06_Architecture/01_Architecture.md)
- [`template/06_Architecture/Details/area/01_Architecture.md`](../../../template/06_Architecture/Details/area/01_Architecture.md)
- [`template/07_Quality/03_Verification_Design.md`](../../../template/07_Quality/03_Verification_Design.md)
- [`template/07_Quality/99_Verification_Result_Format.md`](../../../template/07_Quality/99_Verification_Result_Format.md)
- [`template/07_Quality/Analysis/PHASE/quality_analysis.md`](../../../template/07_Quality/Analysis/PHASE/quality_analysis.md)
- [`template/07_Quality/Definitions/QA-XXXXXX/quality_definition.md`](../../../template/07_Quality/Definitions/QA-XXXXXX/quality_definition.md)
- [`template/80_Communication/01_Communication.md`](../../../template/80_Communication/01_Communication.md)
- [`template/99_Roadmap/Changes/CHG-XXXXXX/change.md`](../../../template/99_Roadmap/Changes/CHG-XXXXXX/change.md)
- [`template/tools/schemas/reality-symbol-schema.json`](../../../template/tools/schemas/reality-symbol-schema.json)
- [`template/tools/schemas/semantic-coverage-pilot-schema.json`](../../../template/tools/schemas/semantic-coverage-pilot-schema.json)

</details>
## 7. 検証計画

| 確認 | 目的 |
|---|---|
| Template契約試験 | 必須Property、可視Checklist、理由付きN/Aおよび工程Handoffを固定する |
| 導出Pilot | 上流Canonical MeaningからRequired Obligationを再現できることを確認する |
| 負例 | Model Item欠落、導出元なしLocal Item、Level不整合、RequiredなのにN/A、理由なしN/Aを拒否する |
| Reality移行 | 既存Local ItemとTest Relationを新しい母集合へ接続し、成立済みCoverageを失わない |
| 独立レビュー | Architecture、Quality、工程間Contextおよび利用側の意味を別実行者が反証する |

## 8. Source／Test Traceabilityへの展開

設計と実装、品質設計とTest実装を対称に追跡する。ただしRelation Ownerを重複させない。

```text
ARCH-ID ──→ Production Named Symbol

ARCH-ID ──→ Quality Local Item ──→ Test Case／Helper／Fixture
```

| 対象 | 正方向Relation | 現在状態 |
|---|---|---|
| Production Named Symbol | Summary、`@responsibility`、実在`ARCH-*`への`@trace` | Checkerの構造Gateと負例を実装済み。既存SourceをPackage単位で意味確認しながら移行中 |
| Test File／Case／Helper／Fixture | 実在Quality Local Itemへの`@trace` | Local Itemを試験段階別に細分化した後にGateを有効化する。現行IDからの推測付与は禁止 |
| Architecture Details | 7つのImplementation Structure観点 | 18領域とTemplateへ反映済み |
| Quality Local Item | Architecture Meaning、試験段階、観測境界 | 必要母集合との差分是正を継続中 |

Production母集団へGateを適用した初回観測では、`artifact-signing`を除く既存PackageにHeaderまたはTrace不足が残った。件数だけを減らすための定型Header一括生成は行わず、各PackageのArchitecture所有責務へ接続できるかを確認する。接続不能なSymbolはDocumentation例外ではなくArchitecture Gapとする。

## Checklist

- [x] 現在の157 Canonical IDと18詳細設計領域を母集団として固定した。
- [x] 既存Quality CapabilityとReality Audit Relationを移行対象として保持した。
- [x] QA-IDとLocal ItemのOwnerを変更していない。
- [x] UAT専用情報をREQ／UX／IAへ重複保持しない方針を固定した。
- [x] Design Pattern自体を必須化しない方針を固定した。
- [x] Canonical Model ItemとImplementation StructureのTemplate差分を確定し、18領域へ適用した。
- [x] UAT／IT導出Pilotを完了し、上流意味とArchitectureから決定論的に導出できることを確認した。
- [x] Required ObligationとLocal Itemの集合差Gateを実装し、試験段階と外部境界段階の不足を検出可能にした。
- [ ] OPEN: 移行、独立レビューおよび全回帰を完了する。理由: 実装未着手である。
