# Engineering Design／Implementation／Verificationの完全性

変更ID: `CHG-000080`
状態: `In Progress`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `engineering_completeness_contract_extension`

## 0. 現在状態

| 項目 | 現在値 |
|---|---|
| 現在の変更状態 | Docker Setup 8段階の固定診断により、選択UserのCRDD専用Claude Provider HomeにあるSubscription OAuthの失効を確認した。通常Taskから分離したHuman-only再認証Lifecycleを実装し、Command世代Barrierを本番関数・別Process・実Kernel Lockの結合試験で固定した。固定候補`b38d0120`の独立再レビューはCritical／Major／Minor 0でPassした |
| Phase／Gate適用判断 | `Applicable`: Architecture、実装、Quality、MigrationおよびReality Auditを一括変更せず、局所Gateで成立確認する必要がある |
| 現在Phase | `Phase 9 — Signed E2E／Release Gate`: Phase 2／4／7／8の独立再レビューはBlocking Finding 0でPassした。Claude再認証Lifecycleの検証義務を加えたCanonical設計集合156件のうち、v0.21対象を130件、v0.22移管を26件へ分けた。v0.21の未観測24件（Automated 2、Hybrid 12、Manual 10）は局所試験、署名E2Eと人間確認で処置する。移管26件は既存Prototype Relation 10件と未観測16件を区別し、いずれも新CapabilityのPass・実装済みへ変更しない |
| 現在Gate | `Passed: Gate 0〜8`。`In Progress: Gate 9`。Human-only Claude再認証入口は独立再レビューをPassした。形式・型・Lint・Trace確認、局所14／14およびDevelopment E2E 341／341もPassした。次は同じ固定内容をCoordinator署名候補へ反映し、実Docker／実Claude OAuth／System Browser境界を確認する |
| 成立済み | Architecture Detailsの実装構造観点、試験段階付きLocal Item 156件、日本語の条件区分、UAT／IT Pilot、Production Headerの構造Gate、Test Catalog 224件の責務別Local Item接続、Optionality Audit全数処置。既存範囲の独立再レビューはBlocking Finding 0、Coordinatorは2015件中2010 Pass・失敗0・5 Explicit Skip、Windows Process Gateは8／8 Pass、Checker全回帰は363／363 Pass。Claude再認証の局所単体試験12件と別Process回復結合試験2件もPassし、本番認証関数のEffect前`in_flight`耐久化、Command保留中の実Kernel Lock喪失、fresh Effect 0、正常close後だけの`idle`復帰を固定した |
| 未成立 | v0.21未観測Local Item 24件（Automated 2、Hybrid 12、Manual 10）のうち、署名E2Eまたは人間受入を必要とするEvidence処置と、Gate 9のRelease Readiness判定。v0.22移管26件は同版の実装・実境界・人間受入で再開する |
| 次のGate | Coordinatorを再署名し、人がHuman-only入口で一度Claude Subscriptionを再認証する。その後、Recovery Matrixと4経路E2Eを同じ固定候補で再実行する。結果を24件のEvidence義務へ対応付け、残る人間受入をRelease判断へ提示する |

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
| 未解消の不一致 | OPEN | Production Header、RelationおよびReality Auditの独立レビュー指摘は解消し、再レビューをPassした。Test Header、OptionalityおよびRequired Verification差分も解消済みである。署名E2Eと人間受入を必要とするEvidence義務だけが残る | Gate 9の署名E2E後に再確認する |

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
| Phase 1: Architecture Completeness | 基本・詳細設計から必要構造と検証対象を導く | Canonical Model、実装構造、Component／Boundary／State／Flow／Failure | 全詳細設計領域の適用表と導出差分 | 全18領域を適用、理由付きN/AまたはOPENへ処置する | Passed |
| Phase 2: Implementation Contract | Production Named Symbolを設計責務へ接続する | 固定Header Schema、ARCH Trace、Source Migration | Header構造、実在Trace、Architecture所有責務 | 対象Symbol全件がHeaderと実在ARCH-IDを持つ | Passed |
| Phase 3: Verification Completeness | 必要な試験義務とLocal Item集合を閉じる | UT／IT／ST／UAT、条件区分、外部境界段階、集合差 | Required／Defined／Level／Boundary差分 | Required - DefinedとLevel／Boundary不足が0件 | Passed |
| Phase 4: Test Source Contract | Test実装をQuality Local Itemへ接続する | Test Case／Named Helper／Fixture Header、QA Trace | Header構造、Local Item実在、試験段階一致、File Relation和集合 | FileはCase／HelperのRelation和集合、Caseは対応する1件、Helperは支援する1件以上を持ち、Test Symbol全件が実在Local Itemと試験段階に一致する | Passed |
| Phase 5: UAT Pilot | 上流の受入意味からUAT義務を再現する | REQ／UX／IA Pilotから全Canonical Sourceへ展開 | Source別UAT ObligationとSame／New判断 | 推測なしで導出でき、重複・導出不能を処置する | Passed |
| Phase 6: Optionality Audit | 重要評価の未記載をなくす | CRDD全体のOptional表現、Format、Checker | A〜F全数分類、理由付きN/A／OPEN、負例 | A〜F分類とC〜Fの必須評価化、理由なしN/A／OPEN 0件 | Passed |
| Phase 7: CRDD Self Migration | 新ContractをCRDD自身へ適用する | Architecture、Source、Test、Quality、Traceability | 契約母集団と利用側母集団の全数照合 | Ruleと現実の未移行0件 | Passed |
| Phase 8: Reality Audit | CanonicalからEvidenceまで照合する | Design→Obligation→Local Item→Test→Execution→Evidence | 欠落、矛盾、Orphan、Freshnessを全数判定 | 欠落・矛盾・Orphanを全数処置する | Passed |
| Phase 9: Independent Review／Release Gate | 独立反証とRelease Readinessを閉じる | 必須監査、全回帰、署名E2E | 固定改訂版への独立レビュー、監査、署名E2E | Blocking Finding 0、必要な署名E2E Pass、人間のRelease判断へ引渡し可能 | In Progress |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| Production Headerの必須tagだけでは既存Source全体を閉じられない | Canonical DesignからSourceまで完全性を追跡する同じ目的であり、単独Releaseしない | Phase 2へ全Named Symbolと全固定tagを追加 | Production母集団の全数移行をGateへ追加 | Coding Standards、Checker負例、独立レビュー | Added |
| Local Itemに試験段階・条件区分・外部境界段階の不足があった | Required Verificationの母集合を閉じる同じ目的である | Phase 3へLocal Item再採番、細分化、日本語5条件区分を追加 | Level／Boundary／条件区分の集合差0を要求 | Quality Definition、Checker、全回帰 | Added |
| 重要観点が「必要に応じて」で未評価のまま省略できる | AIの暗黙判断をFormatへ戻す同じ目的である | Phase 6としてOptionality Auditを追加 | C〜Fの必須評価化とSelf Migrationを完了条件へ追加 | CRDD正本、全ひな型、Checker、独立監査 | Added |
| 同じIntentの不足発見ごとにCHGが細分化し得る | 本CHG自身を完成まで追跡するChange Management上の前提不足である | Phase 0としてPhase／Gate／Scope Extension契約を追加 | Gate 0通過前に以後のPhase完了を確定しない | Change正本、Maintenance、ひな型、Checker | Added |
| 4経路E2Eの固定失敗理由が保存Recordで`unknown`へ劣化した | 外部境界を推測せず診断でき、Evidenceへ再現可能に接続する同じ完全性目的である | Phase 9へVerification Result Recorderの固定理由投影と負例を追加 | 実Provider再試行前に原因分類を耐久記録できることをGateへ追加 | 固定理由だけを許可し、自由文・秘密風文字列・Provider生出力を保存しない | Added |
| 段階別診断によりCRDD専用Claude Provider HomeのOAuth失効を確認した | 署名4経路E2Eを成立させる既存Capabilityの認証Lifecycleが、準備だけを要求して回復入口を欠いていた | Phase 9へHuman-only `authenticate-claude`入口、事後Probe、cleanup確認および利用手順を追加 | 再署名後の実再認証と同一候補4経路E2E PassをGateへ追加 | 通常Task Authority、自動再認証、Repository mount、API key fallbackは追加しない | Added |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| 新しいLocal Item IDをSchemaだけが受理し、Domain Validatorが旧形式を要求していた | Local Item再採番後もSymbol Graph契約はそのまま成立するという前提 | Phase 3／7のValidator移行を追加し、Gate 3は新旧二重契約解消後に判定する | Symbol Manifest Validator局所試験、Schema整合、全Symbol Graph試験 | QA-ID、Local Itemの意味、Architecture Relationは変更しない | Revised |
| Production Header Gateが約3.8万のtag単位指摘を検出した | 一部PackageのHeader補強だけでPhase 2を閉じられるという見込み | Gate 2を未通過のまま維持し、全Production Named SymbolをPackage単位で移行する | Header母集団、実在ARCH-ID、全固定tag、Formatter／型／Lint／全回帰 | Header Schemaと「Public／privateを分けない」原則は変更しない | Revised |
| 型宣言へFunction用の入出力・事前事後条件を要求すると、非該当説明が主となり型契約が読みにくくなった | 全Named Symbolへ単一Header Schemaを適用すれば責務を同じ精度で保存できるという前提 | Phase 2のHeaderを型契約、状態所有、実行責務の3 Schemaへ分離する | Schema別の正例・負例、全Production母集団、Formatter／型／Lint | Summary、責務、実在ARCH-IDへのTrace、必須評価原則は変更しない | Revised |
| 既存Test Suite Relation 37件すべてで、物理配置の試験段階とLocal Item IDの段階が少なくとも1件不一致だった | 既存`symbol.json`のTest RelationをそのままHeader移行入力にできるという前提 | Phase 4でTest Catalog 197件と個別Test Case／Helper／Fixtureを再分析し、物理配置またはLocal Item Relationを正す | Test File段階、Local Item段階、実在ID、個別Test責務、全Test実行 | 既存Testの成立済み検証能力とQuality Local Itemの意味は、置換根拠なしに削除・改称しない | Revised |
| Test Fileを一つの代表Local Itemへ縮約した結果、Semantic Coverageで17意味中16件のTest観測Relationが失われた | File、Case、HelperのRelationを同一の1件へ揃えればTest Source Contractを閉じられるという前提 | Phase 4／7を再開し、FileはCase／HelperのRelation和集合、Caseは対応する1件、Helperは支援する1件以上、`symbol.json`は和集合の正方向Ownerへ改訂する | Test Header契約試験、Symbol Graph、Semantic Coverage Pilot、全Test実行、独立意味レビュー | 試験段階付きLocal Item 150件、Test本体の振る舞いおよび旧Relationを根拠なくTest成立へ昇格しない原則は変更しない | Revised |
| 署名4経路E2Eの内側結果がRuntime固定理由を返しても、保存Recordの手管理許可集合に未登録なら`unknown`へ劣化した | `reason`の追加時にVerification Recorderも同期済みであり、失敗後に安全な原因分類を再観測できるという前提 | Gate 9を再開し、Provider／署名Runnerの固定理由をRecordへ投影する。ただし未知の自由文は従来どおり`unknown`へ閉じる | Formatter、型、Lint、Recorder負例、Development E2E、再署名Recovery Matrix、署名4経路E2E | Provider生出力、Credential、Host Pathおよび未許可の自由文は記録しない | Revised |
| 最初の診断Record是正候補でRoute Matrix自身の固定理由2件が未登録だった | Provider境界だけを確認し、同じProducer内のRunner例外・Process再起動分岐まで母集団へ含めなかった | Gate 9の独立レビューをFailとして維持し、`signed_route_matrix_route_runner_failed_closed`と`signed_route_matrix_process_restart_required`をexact追加する | Recorder正例・未知値拒否負例、Route Matrix契約試験、同一固定候補の独立再レビュー | Prefix一般許可、生出力保存、Status／Recovery／Effect契約変更は禁止 | Revised |
| Route Matrix理由を共有化した再レビューで、内側Coordinator TaskのProvider準備失敗7件がRecorder未登録と判明した | 外側RunnerだけをOwner Registryへ接続し、`results[]`が再帰投影する内側公開結果までProducer母集団を広げなかった | Provider準備失敗の公開語彙もOwner Registry化し、ProducerとRecorderを同じexact集合へ接続する | Registry全値のRecorder正例、未知値拒否負例、Coordinator Task契約試験、署名4経路E2Eの耐久Record再観測 | 内部Provider理由、自由文、生出力、Status／Recovery／Effect契約は変更しない | Revised |
| Provider準備7件の是正後も、Coordinator Task公開Constructorが任意文字列を受け、直接blocked理由52件中48件以上がRecorder未登録だった | 個別失敗群ごとのRegistry追加で十分と見なし、公開Result Constructorと再帰投影全体を型境界にしていなかった | 全Coordinator Task公開理由とSigned General Task理由をOwner Registry＋導出Union型へ集約し、公開Constructorを型制約する。下位動的理由はexact Registry一致だけを投影し、未知値を固定fallbackへ閉じる | Typecheck、Registry全値保存、未知値拒否、Coordinator Task／Signed General／Route Matrix契約試験、同一固定候補の独立再レビュー | Prefix／正規表現許可、任意fixture理由の公開、Provider生出力、Status／Recovery／Effect契約変更は禁止 | Revised |
| 再署名後の4経路E2Eで`unknown`は解消したが、forward経路が`coordinator_task_provider_failed`までしか分類されなかった | Coordinator Task内の直接理由を全数Registry化すれば、下位Process Controllerの固定理由もすべて包含できるという前提 | Docker Process Controllerが清掃後に公開できる固定完了理由38件を専用Owner Registryへ分離し、Producerの完了理由変数と結果構築引数をRegistry由来Union型へ制約した上で、Coordinator TaskおよびRecorderへ同じexact集合を接続する | Formatter、型、Lint、下位Registry全数閉包試験、Registry外Producer理由の型拒否、Recorder全Registry試験、独立レビュー、再署名Recovery Matrix、署名4経路E2E | Provider stderr／stdout、秘密値、自由文は公開せず、未知理由は`coordinator_task_provider_failed`へ閉じる | Revised |
| 下位理由を接続した再署名E2Eで、失敗が`docker_setup_command_failed`まで到達したが、8個のSetup用途のどこで非ゼロ終了したかをRecordから区別できなかった | SetupをProvider開始前の一つの技術段階として扱い、各外部境界の用途を診断契約へ固定していなかった | `create_subscription_auth_probe`から`start_proxy`までの8用途を、Registry由来の用途別固定理由へ一対一対応させる。Engine、Image、Codex認証Probeは作り込み前の最小単位手動確認で正常を確認する | 8用途の非ゼロ終了Matrix、Registry型閉包、Recorder全Registry試験、独立レビュー、再署名Recovery Matrix、署名4経路E2E | Docker argv、Host Path、stdout／stderr、秘密値、自由文はRecordへ追加しない | Revised |

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
| Markdown全体 | 137ファイル、314一致 | 検索語だけを問題判定へ使わず、固定履歴と現行文書を分けて確認した |
| 固定履歴（Change／Release／Evidence／CHANGELOG） | 58ファイル、134一致 | 当時の記録を現在形へ書き換えず、現行正本・ひな型・Checkerへの移行要否を確認した |
| 現行文書（固定履歴を除く） | 79ファイル、180一致 | 180件を全数分類し、曖昧な任意評価21件を発火条件または必須適用判断へ変更した |
| 配布ひな型 | 5一致 | 任意機能2件、条件付き適用2件、禁止する任意Path 1件であり、未評価を許す欄は0件 |

現行文書180一致の分類結果は次のとおりである。分類は検索語の字面ではなく、その文が許可する選択と必要な評価で判定した。`語彙・否定用途`は、`任意Pathを許可しない`、規範語彙の定義、または任意性という概念説明であり、Optionalityの適用判断ではない。

| 分類 | 件数 | 最終処置 |
|---|---:|---|
| A. Optional Feature | 63 | 機能を選択可能なまま維持し、必須能力または必須評価と混同しない |
| B. Optional Artifact | 17 | 作成を一律必須にせず、適用判断を要求する成果物では作成／既存参照／理由付き`N/A`へ接続した |
| C. Optional Evaluation | 0 | 曖昧な省略を許す箇所を残していない |
| D. Optional Safety／Quality Check | 0 | 重要確認を必須適用判断へ昇格したため、任意確認として残していない |
| E. Conditional Applicability | 15 | 発火条件と、`Applicable`／理由付き`N/A`／理由・確認先・再評価契機付き`OPEN`を明示した |
| F. Human Judgment／Authority | 16 | 判断主体、移送条件または例外Authorityを明示した |
| Optionalityではない語彙・否定用途 | 69 | 禁止境界、説明または規範語彙として維持した |

優先対象では、Quality結果の層間搬送、耐久Authority、残存資源／Recovery、四つの根拠軸、PT／LTおよび人間判断を11件の必須適用判断へ昇格した。Architecture Detailsの7実装構造観点は判定理由列と`OPEN`を持つ全数評価へ変更した。UI／Architecture固定入口は維持責任者、基本決定権限、項目別例外Authorityを分離した。Communicationの認知意図、市場・採用探索および人間対象調査、SPECの要求から終了までの段階分離、CHGの固定前収束確認も、曖昧な「該当する場合」から理由付き適用判断へ変更した。

Phase 6は、現行文書180一致の全数分類、曖昧な21件の是正、正本・ひな型・Checkerの接続およびCRDD自身の利用側確認を完了した。Test HeaderはPhase 4、全SubsystemのRequired Verification差分はPhase 3、Reality AuditはPhase 8が所有するため、これらをPhase 6の完了条件へ重複させない。

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

### 6.2. ArchitectureからITへの導出結果

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

8件の代表導出キーで変換方法を固定した後、18のArchitecture Definitionと18の詳細設計領域へ展開した。REQ 36件、UX 32件、IA 22件、UI 20件、SPEC 29件およびARCH 18件をQuality Analysisで全数処置し、156の一意なLocal Itemへ統合した。各工程の`Required - Defined`、Level不一致およびRelation不明は0件である。Architecture DetailsのLevel／外部境界段階不足もChecker上0件であり、初回に検出した試験段階不足35件・外部境界段階不足17件を期待値緩和せず解消した。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`01_Principles.md`](../../../01_Principles.md)
- [`03_Documentation.md`](../../../03_Documentation.md)
- [`05_Autonomous_Operation.md`](../../../05_Autonomous_Operation.md)
- [`06_Architecture/Details/checker/01_Architecture.md`](../../../06_Architecture/Details/checker/01_Architecture.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`10_Agent.md`](../../../10_Agent.md)
- [`19_Maintenance.md`](../../../19_Maintenance.md)
- [`19_Workflows/01_Coordinator_Runtime.md`](../../../19_Workflows/01_Coordinator_Runtime.md)
- [`25_UI.md`](../../../25_UI.md)
- [`26_Behavior_Specification.md`](../../../26_Behavior_Specification.md)
- [`27_Architecture.md`](../../../27_Architecture.md)
- [`28_Implementation.md`](../../../28_Implementation.md)
- [`40_Develop/artifact-signing/symbol.json`](../../../40_Develop/artifact-signing/symbol.json)
- [`40_Develop/artifact-signing/tests/integration/private-key-signing.integration.test.ts`](../../../40_Develop/artifact-signing/tests/integration/private-key-signing.integration.test.ts)
- [`40_Develop/checker/symbol.json`](../../../40_Develop/checker/symbol.json)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/checker/tests/unit/symbol-graph.contract.test.ts`](../../../40_Develop/checker/tests/unit/symbol-graph.contract.test.ts)
- [`40_Develop/coordinator/symbol.json`](../../../40_Develop/coordinator/symbol.json)
- [`40_Develop/coordinator/bin/launch.ts`](../../../40_Develop/coordinator/bin/launch.ts)
- [`40_Develop/coordinator/package.json`](../../../40_Develop/coordinator/package.json)
- [`40_Develop/coordinator/scripts/authenticate-claude-subscription.ts`](../../../40_Develop/coordinator/scripts/authenticate-claude-subscription.ts)
- [`40_Develop/coordinator/src/core/coordinator-launch.ts`](../../../40_Develop/coordinator/src/core/coordinator-launch.ts)
- [`40_Develop/coordinator/src/security/claude-subscription-authentication.ts`](../../../40_Develop/coordinator/src/security/claude-subscription-authentication.ts)
- [`40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-recovery-owner.ts`](../../../40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-recovery-owner.ts)
- [`40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-command-owner.ts`](../../../40_Develop/coordinator/tests/fixtures/claude-subscription-authentication-command-owner.ts)
- [`40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/claude-subscription-authentication.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/claude-subscription-authentication.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/cli-options.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/cli-options.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/development-package-scripts.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-continuation-store.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-continuation-store.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-execution.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-execution.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-machine.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-machine.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-real-observation.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-real-observation.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/release-candidate-preparation.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/release-candidate-preparation.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/signed-reviewer-real-boundary.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts)
- [`40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts`](../../../40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts)
- [`40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts`](../../../40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts)
- [`40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts`](../../../40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts)
- [`40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts`](../../../40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts)
- [`40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts`](../../../40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts)
- [`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts`](../../../40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts)
- [`40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts`](../../../40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts)
- [`40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts`](../../../40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts)
- [`40_Develop/coordinator/tests/system/signed-reviewer-boundary-verification.contract.test.ts`](../../../40_Develop/coordinator/tests/system/signed-reviewer-boundary-verification.contract.test.ts)
- [`40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts`](../../../40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts)
- [`40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts`](../../../40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts)
- [`40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts`](../../../40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/command-report.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/command-report.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-restart-continuation-record.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-restart-continuation-record.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-restart-handoff-record.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-restart-handoff-record.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-restart-record.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-restart-record.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-restart-state.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-restart-state.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/docker-wsl-state.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/docker-wsl-state.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/doctor.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/doctor.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/project-runtime-decision-capability-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/project-runtime-decision-capability-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/project-runtime-execution-authorization-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/project-runtime-execution-authorization-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/project-runtime-execution-host-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/project-runtime-execution-host-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-home.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-home.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/root-observation.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/root-observation.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts)
- [`40_Develop/crdd-domain-library/src/repository-observation/index.ts`](../../../40_Develop/crdd-domain-library/src/repository-observation/index.ts)
- [`40_Develop/crdd-domain-library/symbol.json`](../../../40_Develop/crdd-domain-library/symbol.json)
- [`40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts`](../../../40_Develop/crdd-domain-library/tests/integration/reality-repository.integration.test.ts)
- [`40_Develop/crdd-domain-library/tests/unit/public-boundary.contract.test.ts`](../../../40_Develop/crdd-domain-library/tests/unit/public-boundary.contract.test.ts)
- [`40_Develop/crdd-domain-library/tests/unit/repository-observation.contract.test.ts`](../../../40_Develop/crdd-domain-library/tests/unit/repository-observation.contract.test.ts)
- [`40_Develop/execution-intelligence/symbol.json`](../../../40_Develop/execution-intelligence/symbol.json)
- [`40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts`](../../../40_Develop/execution-intelligence/tests/integration/execution-intelligence-store.contract.test.ts)
- [`40_Develop/execution-intelligence/tests/unit/execution-intelligence.contract.test.ts`](../../../40_Develop/execution-intelligence/tests/unit/execution-intelligence.contract.test.ts)
- [`40_Develop/mcp/symbol.json`](../../../40_Develop/mcp/symbol.json)
- [`40_Develop/mcp/tests/integration/transport-lifecycle.contract.test.ts`](../../../40_Develop/mcp/tests/integration/transport-lifecycle.contract.test.ts)
- [`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`](../../../40_Develop/mcp/tests/system/stdio-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts`](../../../40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts)
- [`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`](../../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)
- [`40_Develop/platform-access/src/docker_authenticode.rs`](../../../40_Develop/platform-access/src/docker_authenticode.rs)
- [`40_Develop/platform-access/src/docker_repair.rs`](../../../40_Develop/platform-access/src/docker_repair.rs)
- [`40_Develop/platform-access/src/main.rs`](../../../40_Develop/platform-access/src/main.rs)
- [`40_Develop/platform-access/src/protocol.rs`](../../../40_Develop/platform-access/src/protocol.rs)
- [`40_Develop/platform-access/src/windows.rs`](../../../40_Develop/platform-access/src/windows.rs)
- [`40_Develop/platform-access/src/windows_directory.rs`](../../../40_Develop/platform-access/src/windows_directory.rs)
- [`40_Develop/platform-access/src/windows_owned_child.rs`](../../../40_Develop/platform-access/src/windows_owned_child.rs)
- [`40_Develop/platform-access/symbol.json`](../../../40_Develop/platform-access/symbol.json)
- [`40_Develop/platform-access/tests/cli.rs`](../../../40_Develop/platform-access/tests/cli.rs)
- [`40_Develop/project-runtime/symbol.json`](../../../40_Develop/project-runtime/symbol.json)
- [`40_Develop/project-runtime/tests/unit/execution-observation-port.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/execution-observation-port.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/human-decision-application.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/human-decision-application.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/integration-application.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/integration-application.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/objective-intake.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/objective-intake.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/platform-contract.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/platform-contract.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/project-state-query.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/project-state-query.contract.test.ts)
- [`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`](../../../40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts)
- [`40_Develop/runtime-data/symbol.json`](../../../40_Develop/runtime-data/symbol.json)
- [`40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts`](../../../40_Develop/runtime-data/tests/integration/repository-runtime-data-paths.integration.test.ts)
- [`40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts`](../../../40_Develop/runtime-data/tests/integration/runtime-data-consumer-closure.integration.test.ts)
- [`40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts`](../../../40_Develop/runtime-data/tests/integration/temporary-operation-lifecycle.integration.test.ts)
- [`40_Develop/runtime-data/tests/unit/runtime-data-contract.contract.test.ts`](../../../40_Develop/runtime-data/tests/unit/runtime-data-contract.contract.test.ts)
- [`40_Develop/runtime-data/tests/unit/runtime-data-path-resolver.contract.test.ts`](../../../40_Develop/runtime-data/tests/unit/runtime-data-path-resolver.contract.test.ts)
- [`40_Develop/semantic-coverage/symbol.json`](../../../40_Develop/semantic-coverage/symbol.json)
- [`40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts`](../../../40_Develop/semantic-coverage/tests/integration/semantic-bundle-publisher.integration.test.ts)
- [`40_Develop/semantic-coverage/tests/unit/public-boundary.contract.test.ts`](../../../40_Develop/semantic-coverage/tests/unit/public-boundary.contract.test.ts)
- [`40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts`](../../../40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts)
- [`40_Develop/verification-runner/symbol.json`](../../../40_Develop/verification-runner/symbol.json)
- [`40_Develop/verification-runner/src/application/regression-runner.ts`](../../../40_Develop/verification-runner/src/application/regression-runner.ts)
- [`40_Develop/verification-runner/src/execution/regression-execution.ts`](../../../40_Develop/verification-runner/src/execution/regression-execution.ts)
- [`40_Develop/verification-runner/tests/acceptance/regression-plan-understanding.contract.test.ts`](../../../40_Develop/verification-runner/tests/acceptance/regression-plan-understanding.contract.test.ts)
- [`40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts`](../../../40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts)
- [`40_Develop/verification-runner/tests/system/resource-intensive-gate.contract.test.ts`](../../../40_Develop/verification-runner/tests/system/resource-intensive-gate.contract.test.ts)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts)
- [`40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts`](../../../40_Develop/version-control/tests/integration/fixed-revision-and-ignore.integration.test.ts)
- [`40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts`](../../../40_Develop/version-control/tests/integration/fixed-snapshot.integration.test.ts)
- [`40_Develop/version-control/tests/integration/local-change-set.integration.test.ts`](../../../40_Develop/version-control/tests/integration/local-change-set.integration.test.ts)
- [`40_Develop/version-control/tests/integration/repository-location.integration.test.ts`](../../../40_Develop/version-control/tests/integration/repository-location.integration.test.ts)
- [`99_Roadmap/Changes/CHG-000080/change.md`](change.md)
- [`template/CLAUDE.md`](../../../template/CLAUDE.md)
- [`02_UX/01_User_Experience.md`](../../../02_UX/01_User_Experience.md)
- [`04_UI/04_Visual_and_Accessibility_Direction.md`](../../../04_UI/04_Visual_and_Accessibility_Direction.md)
- [`04_UI/06_Current_Interface_Reference.md`](../../../04_UI/06_Current_Interface_Reference.md)
- [`05_SPEC/07_Current_Behavior_Reference.md`](../../../05_SPEC/07_Current_Behavior_Reference.md)
- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`06_Architecture/Definitions/ARCH-000005/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000005/architecture_definition.md)
- [`06_Architecture/Definitions/ARCH-000006/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000006/architecture_definition.md)
- [`06_Architecture/Definitions/ARCH-000013/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md)
- [`06_Architecture/Details/crdd-domain-library/01_Architecture.md`](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md)
- [`06_Architecture/Details/cros/01_Architecture.md`](../../../06_Architecture/Details/cros/01_Architecture.md)
- [`06_Architecture/Details/official-asset-governance/01_Architecture.md`](../../../06_Architecture/Details/official-asset-governance/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](../../../06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/runtime-data/01_Architecture.md`](../../../06_Architecture/Details/runtime-data/01_Architecture.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](../../../07_Quality/Definitions/QA-000001/quality_definition.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`40_Develop/checker/src/profiles/current-profile.ts`](../../../40_Develop/checker/src/profiles/current-profile.ts)
- [`40_Develop/checker/src/rules/reality-symbol-graph.ts`](../../../40_Develop/checker/src/rules/reality-symbol-graph.ts)
- [`40_Develop/coordinator/scripts/verify-signed-route-matrix.ts`](../../../40_Develop/coordinator/scripts/verify-signed-route-matrix.ts)
- [`40_Develop/coordinator/scripts/verify-signed-general-task.ts`](../../../40_Develop/coordinator/scripts/verify-signed-general-task.ts)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts)
- [`40_Develop/coordinator/src/core/verification-result-reasons.ts`](../../../40_Develop/coordinator/src/core/verification-result-reasons.ts)
- [`40_Develop/coordinator/src/core/verification-result-record.ts`](../../../40_Develop/coordinator/src/core/verification-result-record.ts)
- [`40_Develop/coordinator/src/security/coordinator-task-result-reasons.ts`](../../../40_Develop/coordinator/src/security/coordinator-task-result-reasons.ts)
- [`40_Develop/coordinator/src/security/docker-process-controller.ts`](../../../40_Develop/coordinator/src/security/docker-process-controller.ts)
- [`40_Develop/coordinator/src/security/docker-process-controller-result-reasons.ts`](../../../40_Develop/coordinator/src/security/docker-process-controller-result-reasons.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts)
- [`40_Develop/coordinator/tests/fixtures/docker-handoff-worker.ts`](../../../40_Develop/coordinator/tests/fixtures/docker-handoff-worker.ts)
- [`40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts`](../../../40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts)
- [`40_Develop/coordinator/tests/system/docker-session-handoff.contract.test.ts`](../../../40_Develop/coordinator/tests/system/docker-session-handoff.contract.test.ts)
- [`40_Develop/crdd-domain-library/package.json`](../../../40_Develop/crdd-domain-library/package.json)
- [`40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts`](../../../40_Develop/crdd-domain-library/src/filesystem-store-root/index.ts)
- [`40_Develop/crdd-domain-library/src/filesystem-store-root/filesystem-store-kernel-lock-worker.ts`](../../../40_Develop/crdd-domain-library/src/filesystem-store-root/filesystem-store-kernel-lock-worker.ts)
- [`40_Develop/crdd-domain-library/src/index.ts`](../../../40_Develop/crdd-domain-library/src/index.ts)
- [`40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-owner.ts`](../../../40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-owner.ts)
- [`40_Develop/crdd-domain-library/tests/unit/filesystem-store-root.contract.test.ts`](../../../40_Develop/crdd-domain-library/tests/unit/filesystem-store-root.contract.test.ts)
- [`40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-contender.ts`](../../../40_Develop/crdd-domain-library/tests/fixtures/filesystem-store-lock-contender.ts)
- `40_Develop/cros/src/durable-store.ts`（削除）
- [`40_Develop/cros/src/index.ts`](../../../40_Develop/cros/src/index.ts)
- [`40_Develop/cros/src/tool-registry.ts`](../../../40_Develop/cros/src/tool-registry.ts)
- [`40_Develop/cros/symbol.json`](../../../40_Develop/cros/symbol.json)
- `40_Develop/cros/tests/fixtures/durable-boundary-worker.ts`（削除）
- [`40_Develop/cros/tests/integration/cros-core.contract.test.ts`](../../../40_Develop/cros/tests/integration/cros-core.contract.test.ts)
- [`40_Develop/cros/tests/integration/surface-contract.contract.test.ts`](../../../40_Develop/cros/tests/integration/surface-contract.contract.test.ts)
- [`40_Develop/cros/tests/system/context-handoff.contract.test.ts`](../../../40_Develop/cros/tests/system/context-handoff.contract.test.ts)
- [`40_Develop/cros/tests/system/result-return.contract.test.ts`](../../../40_Develop/cros/tests/system/result-return.contract.test.ts)
- [`40_Develop/cros/tests/system/session-access.contract.test.ts`](../../../40_Develop/cros/tests/system/session-access.contract.test.ts)
- [`40_Develop/mcp/src/adapters/project-runtime-adapter.ts`](../../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts)
- [`40_Develop/official-asset-governance/src/official-asset-governance.ts`](../../../40_Develop/official-asset-governance/src/official-asset-governance.ts)
- [`40_Develop/official-asset-governance/src/official-asset-store.ts`](../../../40_Develop/official-asset-governance/src/official-asset-store.ts)
- [`40_Develop/official-asset-governance/symbol.json`](../../../40_Develop/official-asset-governance/symbol.json)
- [`40_Develop/official-asset-governance/tests/fixtures/asset-decision-worker.ts`](../../../40_Develop/official-asset-governance/tests/fixtures/asset-decision-worker.ts)
- [`40_Develop/official-asset-governance/tests/integration/asset-governance.contract.test.ts`](../../../40_Develop/official-asset-governance/tests/integration/asset-governance.contract.test.ts)
- `40_Develop/project-operation/src/candidate-store.ts`（削除）
- [`40_Develop/project-operation/src/index.ts`](../../../40_Develop/project-operation/src/index.ts)
- [`40_Develop/project-operation/symbol.json`](../../../40_Develop/project-operation/symbol.json)
- [`40_Develop/project-operation/tests/integration/candidate-adoption.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/candidate-adoption.contract.test.ts)
- [`40_Develop/version-control/tests/fixtures/migration-consumer-declaration.json`](../../../40_Develop/version-control/tests/fixtures/migration-consumer-declaration.json)
- [`40_Develop/version-control/tests/system/migration-system-closure.contract.test.ts`](../../../40_Develop/version-control/tests/system/migration-system-closure.contract.test.ts)
- [`99_Roadmap/01_Roadmap.md`](../../01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000066/change.md`](../CHG-000066/change.md)
- [`99_Roadmap/Changes/CHG-000067/change.md`](../CHG-000067/change.md)
- [`template/07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../template/07_Quality/05_Current_Implementation_Reality_Audit.md)
- `template/tools/coordinator/coordinator-package-manifest.json`（削除）

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
| Production Named Symbol | Summary、`@responsibility`、実在`ARCH-*`への`@trace` | Checkerの構造Gateと負例を実装し、現行Production母集団の構造・実在Trace検査をPassした。意味妥当性も独立再レビューで確認し、Blocking Finding 0でPassした |
| Test File／Case／Helper／Fixture | 実在Quality Local Itemへの`@trace` | Test Catalog 224件を全15 Manifest Ownerへ接続した。FileはCase／Helper Relationの和集合、Caseは対応する1件、Helperは支援する1件以上を保持し、Local Item実在、Owner、試験段階および`verifies`をCheckerで照合する |
| Architecture Details | 7つのImplementation Structure観点 | 18領域とTemplateへ反映済み |
| Quality Local Item | Architecture Meaning、試験段階、観測境界 | 156件へ細分化し、Required／Defined、試験段階および外部境界段階の差分0を確認済み |

Production母集団へGateを適用した初回観測では、`artifact-signing`を除く既存PackageにHeaderまたはTrace不足が残った。各PackageのArchitecture所有責務へ接続して是正し、現在の構造GateはPassした。接続不能なSymbolをDocumentation例外へ退避しない原則を維持し、独立再レビューでも意味妥当性を確認した。

## Checklist

- [x] 現在の157 Canonical IDと18詳細設計領域を母集団として固定した。
- [x] 既存Quality CapabilityとReality Audit Relationを移行対象として保持した。
- [x] QA-IDとLocal ItemのOwnerを変更していない。
- [x] UAT専用情報をREQ／UX／IAへ重複保持しない方針を固定した。
- [x] Design Pattern自体を必須化しない方針を固定した。
- [x] Canonical Model ItemとImplementation StructureのTemplate差分を確定し、18領域へ適用した。
- [x] UAT／IT導出Pilotを完了し、上流意味とArchitectureから決定論的に導出できることを確認した。
- [x] Required ObligationとLocal Itemの集合差Gateを実装し、試験段階と外部境界段階の不足を検出可能にした。
- [x] Test Catalog 224件と検出したTest Case全件を責務別Quality Local Itemへ接続し、File Relation和集合、Local Item実在および試験段階一致を機械確認した。
- [x] 独立レビュー是正後の同一候補でCoordinator／Checker全回帰を再実行した。Coordinatorは2015件中2010 Pass・失敗0・明示Skip 5、Checkerは363／363 Passである。
- [x] Production Header、Relation、Reality Auditおよび実装境界の独立再レビューを完了し、Blocking Finding 0を確認した。
- [ ] OPEN: 署名E2Eと、人間受入を必要とするEvidence義務を完了する。理由: Phase 2／4／7／8はPassし、Phase 9だけが署名E2EとRelease判断待ちである。
