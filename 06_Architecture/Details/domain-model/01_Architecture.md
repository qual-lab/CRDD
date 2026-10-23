# Domain Modelの責務境界

### Repository追加通信設定の読取り — 2026-10-21

`configuration/network-policy.ts`は`version:1`と`allowedHosts`の値契約、既定npm／PyPI三Host、重複Keyを拒否するJSON解析を所有する。最大32要素、各253文字、Fileは16KiB以内とする。Hostnameの技術的可否・Provider固定集合・通信許可は所有しない。

| 公開API | 入出力と境界 |
|---|---|
| `readNetworkPolicy(root)` | 発行済みRepository Rootから固定`.crdd/config/network-policy.json`を安定読取りし、ready/default・ready/fileまたはblockedを返す。書込み・mkdir・Lockは行わない |
| `NetworkPolicy` | 版と不変の追加Host配列。Role別設定・Repository外参照を持たない |
| `NetworkPolicyReadResult` | 不在だけ既定値、明示空配列は追加0、不正と読取り／実体確認不能を区別。Fileの生Hashは由来確認用であり許可ではない |

実I/Oは`storage/network-policy.ts`が所有し、既存bounded readerに親Directory chain・nlink・Root能力の前後確認を組み合わせる。未Commitの現在Fileを一回固定し、別Repositoryの値をCache・継承しない。Coordinatorの同意とDI／Proxyへの本番接続は後続であり、このReaderだけで追加通信を有効化しない。

非秘密の運用設定を`.crdd/config/network-policy.json`へ置き、配布例は`template/.crdd/config/network-policy.example.json`とする。File不存在はnpm／PyPIの既定3Host、`allowedHosts: []`は追加0とする。Schemaは`version: 1`と`allowedHosts`だけ、最大32要素・各253文字、本文は16KiB以下のUTF-8。JSONの重複Key（escape表記を含む）・未知／欠落Key・型差・上限超過は不正として止める。Hostの技術判断はDIが行い、Readerでは内容の勝手な補正や既定値fallbackをしない。source File Hashは由来確認用で、実効集合の同意Hashとは別である。

### 共通文書の表・Header・版・Identity — 2026-10-20

| Source | 公開操作と責務 |
|---|---|
| `artifact/verification-tables.ts` | `inspectBranchCoverageTable`は分岐数・実測率の算術を、`inspectRemediationTable`は是正の進捗・阻害・解決条件の相関と必要値を検査する。それぞれ検査行数とIssueを返す |
| `artifact/document-header.ts` | `inspectRelatedOrder`はRelated節の存在と標準番号順、`parseCanonicalReleaseHeader`は限定したHeader境界から版・状態・Baselineを返す |
| `artifact/release.ts` | `parseCandidateVersionHeader`、`parseReadmeVersion`は既存の限定文法を解析する。`inspectCanonicalDocumentVersions`は版集合・CandidateのBaselineとIssueを返す。`inspectChangelogRelease`は二言語節・移行宣言・分類・必要説明を検査する。`inspectStableCanonicalDocuments`、`inspectStableReadme`、`inspectStableChangelog`、`inspectStableReleaseHeader`はStable版の文書・表示・日付・変更記録の条件を検査する |
| `artifact/identity.ts` | `parseStableIdentityOccurrences`は生本文の全出現を返す。`inspectStableIdentityDefinitions`は可視の明示定義位置と手動改訂Issue、`inspectStableIdentityOwnership`は集約済み定義の所有重複、`inspectDiscoveryIdentityLinks`はREQリンクの定義所有不一致を検査する |
| `artifact/change.ts` | 既存の変更記録本文検査に加え、`parseChangeTraceHeader`で取得済みHeaderのID・標準見出しを独立に解析する |

全出現と明示定義、一般表と是正表、未測定と非数値、CandidateとStable、解析済み値と現在の実在を分ける。Mapの入力順・重複・後勝ち値、単純pipeと既存Fence文法、最初の節・Header、数値許容差を変更しない。Root、GitのTag／HEAD、File配置、対象範囲と実在の観測はCheckerが所有する。派生モデル・Issueを現在の正本・実行許可・品質Passへ昇格しない。

### Quality状態・分析・統合の本文契約 — 2026-10-20

| Source | 公開操作と所有する意味 |
|---|---|
| `artifact/quality-readiness.ts` | `inspectQualityCenterState`は版表記を正規化した有限状態・Ready分岐・Issueを返す。`inspectQualityRealityState`はその同じ結果モデルとReality状態を受け、許可された状態対を検査する。`hasQualityOpenChecklist`は可視Checklistの未解決項目を検出する |
| `artifact/quality-analysis.ts` | `inspectQualityAnalysis`は工程別Coverageと情報源・目標・条件・段階・Obligation Key・Local Itemの部分関係を返す。`inspectQualityCrossModelGoals`は五モデル処置、`inspectQualityDetailUnits`は詳細検証単位の行・重複・領域集合を照合する。`parseQualityCoverageSections`は工程本文からCoverage節を解析する |
| `artifact/quality-relations.ts` | `inspectQualityDefinitionRelations`、`inspectQualityLocalItemRelations`、`inspectQualityGoalLocalRelations`は分析・定義・詳細引渡しの双方向関係、段階と境界到達を照合する。`parseQualityDetailHandoff`は取得済み詳細本文から検証単位・段階・境界の後勝ちMapを返し、`isQualityLocalItemCountInvalid`は宣言件数との一致を判定する |
| `artifact/quality-templates.ts` | 検証結果・分析・統合の三書式の必須本文条件を判定する。通常成果物の状態・Coverage解析・件数照合は所有しない |

これらは取得済み値だけを扱う。工程六本文→統合本文、Coverage欠落時の早期終了、Readyの場合だけの追加読取り、Detailごとの読取り、件数確認時のReality再読取りはCheckerが元の位置で行う。生本文と可視本文を一律に統合せず、不正行から取得できる部分関係、重複出現、後勝ちMap、Issue順を保持する。Issueは中立の種類・位置・理由・必要な値だけを持ち、既存の公開診断文・Code・SeverityはCheckerが変換する。新しいReader、Snapshot、Registry、状態保存、実行許可は追加しない。

### Quality Definition本文とLocal ID所有 — 2026-10-20（限定移管）

`artifact/quality-definition.ts`の`inspectQualityDefinition`は取得済み生本文とDirectory由来QA-IDから、情報源・Obligation Key・条件区分・13列の検証項目・試験段階／外部境界・追加試験種別の適用・PT／LTの明示承認条件を検査する。コメント／Fence除去を新設せず、Header不正でも項目行を走査する。`QualityDefinitionModel`は関係集合と出現配列、後勝ちの条件・段階・境界Map、13列条件と独立したLocal ID出現列、中立Issueを返す。不正な情報源行からも解析できた関係を保持する。

`inspectQualityLocalItemOwnership`は診断位置、Local ID出現列、従来位置までのOwner Mapを受け、`QualityLocalItemOwnershipModel`で局所Mapの複製と出現ごとの重複Issueを返す。入力Mapを変更せず、同一File内の重複も検出し、Ownerは先勝ちとする。既存のOwner文字列の真偽判定を維持し、空文字を新たな所有確認済み値へ変えない。本文Issueの後に所有Issueを返す接続順はCheckerが維持する。保存・Registry・実行許可を所有しない。

標準本文が説明する11軸と現行v0.22 Definition／Checkerの13列（観測・Oracle・Evidenceへの細分化）の既存表現粒度差は、この挙動保存移管で変更しない。移管成功を規範上の完全な同一性・準拠成立と扱わない。Repository観測編成・共通文書意味の移管・最終回帰は別の残件である。

### Architecture分析・定義本文 — 2026-10-20（限定移管済み）

`artifact/architecture.ts`の`inspectArchitectureAnalysis`、`inspectArchitectureDefinition`は、first read由来の可視本文、Directory由来kind／ID、既に観測したReady状態、second readを既存Checklist検査へ渡して得た理由を入力とする。`ArchitectureBodyModel`はRelation出現列と中立Issueを返し、不正本文の部分関係も保持する。分析は正式入力・九観点別の語彙／根拠・Human Input・処置、定義は両分析入力・未確認表の完全被覆・必須構造・説明用placeholder・Ready時のOPEN／FAILを既存条件で検査する。

`inspectArchitectureDetailTemplate`はDefinition／Areaという固定二用途のDetail引渡し見出しと表Headerを検査する。`inspectArchitectureCrossModelIndex`は横断モデルの登録節が空ならIssueと空の取得対象列、存在すれば固定五文書の取得順を`ArchitectureCrossModelIndex`で返す。`inspectArchitectureCrossModel`は可視登録本文・可視モデル本文・同じ読取りに由来するFence保持本文から、厳密な登録リンク・見出し・図表断片を検査する。五文書の構造定義は非公開とし、任意モデルの登録やProfile拡張は提供しない。Ready以外でも既存と同じ条件を使用する。

`artifact/architecture-details.ts`は`inspectArchitectureDetailMap`で登録領域・Map関係・定義閉包関係を別集合として返し、`inspectArchitectureDetail`で詳細本文の関係・Covered定義・適用判断・Concern・Implementation Structure・Quality引渡し・Ready条件を検査する。不正本文でも抽出した関係とCovered定義を保持する。`inspectArchitectureDetailCoverage`は領域被覆→関係閉包→Ready時のCovered所有者という三条件を順に検査する。公開型は`ArchitectureDetailMapModel`、`ArchitectureDetailModel`、`ArchitectureDetailCoverageRequest`とする。

詳細表は既存の単純pipe分割と先頭行の省略を維持する。Quality引渡しは有効な10列行が少なくとも一件あれば受理し、Ready時だけ拒否する条件はRelationのMissing、ConcernとChecklistのOPEN／FAILに限定する。Implementation StructureのOPENやRelationのPartialを新たに拒否しない。

`artifact/architecture-relations.ts`は`parseArchitectureRegistry`で各行の最初の定義Linkに同じ行の全UI／SPEC出現を対応付け、`ArchitectureRegistryModel`へ集合と出現配列を分けて返す。`inspectArchitectureAnalysisCoverage`は既存の件数条件とDirectory完全被覆を区別し、`inspectArchitectureRegistryCoverage`と`inspectArchitectureComponentCoverage`がそれぞれ実定義への重複なし完全被覆を検査する。`inspectArchitectureRelations`は重複→分析／定義閉包→登録／分析閉包の順で検査する。集合検査の要求型は`ArchitectureAnalysisCoverageRequest`と`ArchitectureRelationsRequest`とし、診断位置だけを受け、未使用本文を要求しない。

各本文の取得・Checklist再読取り・Directory列挙・診断表示は所有しない。表／Sectionの専用補助は非公開とする。Architecture本文と集合判定の移管は、Repository観測編成やChecker全体の完成を意味しない。

### UI／SPEC定義対応の根拠と固定改訂 — 2026-10-20（限定移管済み）

`artifact/spec-correspondence.ts`は`parseSpecCorrespondenceRevision`で記録Fingerprintを解析し、`parseSpecCorrespondencePair`で厳密な正規対応行を`SpecCorrespondencePair`へ解析する。Cell数不足をこの時点で事前拒否せず、呼出し元のUI→SPEC読取り後に`inspectSpecCorrespondencePairEvidence`が共有UX／IA積集合、両側Anchor、八観点、見出し別の具体根拠、題名・定型理由・省略表現の除外を検査する。八行／八観点条件と`every`の短絡を維持し、返す理由列は実際に評価した行の出現だけとする。

`inspectSpecCorrespondence`は集約した対応・理由・行不整合と記録／実測Fingerprintから閉包→根拠→改訂の順で三Issueを返す。根拠の意味はNFKC・既存記号除去・小文字化後の四文字連続部分一致であり、全文引用へ強化しない。本文取得・Definition集合の生本文Fingerprint計算は所有しない。表・Section・根拠比較の専用補助は非公開とする。

### UI／SPEC Detail本文の対応モデル — 2026-10-20（限定移管済み）

`artifact/spec-details.ts`は、UIの最後の有効対応行を返す`parseUiDetailBindings`、Screenの対象UIとRelation／BHV出現列を返す`parseSpecScreenRelations`、SPEC定義集合に対するDetail表を検査する`inspectSpecDetailIndex`、Screen・対応表・Definition対応数の双方向被覆を検査する`inspectSpecDetailCorrespondence`を公開する。対応表だけの解析補助は同File内の非公開関数とする。本文の取得・列挙・欠落診断は所有しない。

UI対応の後勝ち、Screen行内の最初の一致、関係の出現順・重複、不正なSPEC行からも抽出できるBHV対応を維持する。Detail表の被覆と対応表の状態条件は二つの中立Issueへ分け、Checkerが旧code・文言へ変換する。UI／Screen／Detail表は生本文を受けて可視化し、対応表検査は既存の可視化済み本文を受けて再変換しない。

下流の既読可視本文は`parseSpecDetailDefinitionOwnership`、`parseSpecDetailAreaOwnership`、`parseSpecDetailCentralTrace`で定義所有・領域所属・中央関係へ解析する。結果型はそれぞれ`SpecDetailDefinitionOwnership`、`SpecDetailAreaOwnership`、`SpecDetailCentralTrace`であり、出現列・行内重複・後勝ちMap・中央行数を保持する。`inspectSpecDetailDownstream(request: SpecDetailDownstreamRequest)`はそれらのモデルと観測済み集合・combined本文・件数からOwner集合、Single／Shared／Joint、各Ownerの領域被覆、別行重複、中央表と最終被覆を検査する。QA側ID集合は従来どおりサイズを比較し、発行IDの定義本文への包含は`includes`のままとする。新たなRepository Snapshot・Reader・永続状態を所有しない。

### SPEC分析・登録表・定義の本文モデル — 2026-10-20（限定移管済み）

集合照合も同じOwnerに置く。`inspectSpecAnalysisCoverage`、`inspectSpecDefinitionCoverage`、`inspectSpecCoverage`はそれぞれ分析網羅性／重複、定義重複／登録網羅性、件数表／三者関係閉包を扱う。`parseUiSpecPairs`はUI定義から対応SPECの重複を保持する出現列を取り、`inspectUiSpecRelations`がUI／SPEC／登録表の双方向閉包を検査する。APIの区切りは途中のUI定義件数取得・UI本文readという観測境界に対応し、一括先読みや汎用集合検査のためではない。空集合・整数解析・同数誤差し替え・Issue順の従来条件を維持する。

`artifact/spec.ts`は`inspectSpecAnalysis(source, inputId)`、`parseSpecIndex(source)`、`inspectSpecDefinition(source, specId)`と対応する三つの結果型を公開する。分析はUX／IA観点の正式入力・処置とChecklist、登録表はID／関係集合・重複・件数表、定義は両分析の出典と正式入力・UI対応／受入条件・Checklistを扱う。関係の出現列を保持し、不正本文でも解析できた関係を後続へ渡す。定義内のUI判定は同じSPEC IDの局所出現列を使う。Checkerの一意な定義Directory列挙では、それまで集約した他IDの出現列がこの判定へ混入しないため、従来の集約列から対象IDだけ選ぶ条件と同じである。

可視本文化はDomain APIでも実施する。既存Consumerが同じ可視化済み値を渡す箇所は変換の冪等性を保持し、列挙・読取り・ID追加と後続Detail／下流Trace観測はCheckerの元位置に残す。今回の移管はSPEC Detail・対応Evidence・Architecture／Quality移管全体の完了を意味しない。

### Discovery分析・定義本文と採用要求解析 — 2026-10-20（限定移管済み）

`artifact/discovery.ts`の`inspectDiscoveryDefinition(source, requirementId)`は取得済みの要求定義を生本文のまま検査する。必須節、既存の制約／引渡し見出し二選択、Placeholder、最初に一致したEXP参照の表示IDとPath内ID、末尾Checklistを扱い、構造→Checklistの順に中立Issueを返す。構造不正でもChecklistを検査する。状態値、探索記録の実在、参照一意性、定義間の意味重複は新たに検査しない。

`inspectDiscoveryAnalysis(source, explorationId)`も生本文の成果物種別／EXP IDと可視Checklistの二Issueを順に返す。`parseAdoptedDiscoveryRequirements(markdown)`は入口の生本文から厳密な行頭形式・要求採用セル・最初のREQ IDだけを抽出し初出順のSetへまとめる。Root・列挙・実在ID追加・本文読取り・網羅性と診断表示はCheckerの責務に残す。入口の再readは元位置で行い、前の本文を再利用しない。入口Checklist・Template Checklist・正式入力・関係閉包の移管完了を意味しない。

### UX入口・投影・分析・定義の本文検査 — 2026-10-20（限定移管済み）

`artifact/ux.ts`は既読UX入口からID集合とREQ–UX関係を解析する`parseUxIndex`、横断投影Sectionを可視本文化して網羅性を判定する`isUxProjectionIncomplete`、Experience Mapの生本文からREQ–Journey集合を得る`parseUxJourneyRelations`を所有する。型`UxIndexModel`は入口の二集合だけを持つ。生本文と可視本文、単純Pipe分割とSet化の従来の違いを維持する。Checkerは同じ読取り位置で使用し、新しいI/O・状態保存・再解析は追加しない。

`inspectUxDefinition(source, uxId)`は取得済みUX定義の本文構造、直接Handoff、Checklistを順序付き中立Issueとして返す。状態行は生本文で一件を要求し、Canonical／Supersededを受理する。Checklist理由はHandoff判定前に計算し、本文不正でも後続検査を続ける。対象選択・実在ID追加・読取り・網羅性はCheckerに残す。

`inspectUxAnalysis(source, requirementId, registryLinkCount)`は既読分析本文の六段階構造、引渡し、Checklist、関係図／表、Same比較、責任境界表、Blueprint処置を検査する。`UxAnalysisModel`はREQ–UX／Journeyの二集合と順序付きIssueだけを持ち、不正本文からも解析可能な関係を保持する。図表の列比較で重複を消さず、Journeyは最初の指定行だけを使う。入口のPath出現数は既読文字列から得る値入力で、外部I/Oや診断順を変えないが、旧短絡条件内の純計算より前に計算される。

`inspectUxFormalInput(source, requirementId, observation)`は正式入力Header・期待リンク・探索元補完禁止と六観測事実を照合する。`UxFormalInputObservation`は定義内容有無・一致する定義参照だけか・探索分析参照・不正Discovery参照・不正Entity・危険対象の六Booleanに限定し、Root・Path一覧・Readerを持たない。定義内容はBoolean(definition)相当で空白を新たに拒否しない。Fence除去→Comment除去の順と生本文の禁止行を維持する。Path安全性・Discovery定義read・参照分類はCheckerが所有し、観測不能を安全へ補完しない。一部の純計算は旧短絡より先行するが、外部I/O・診断順は変えない。

`inspectUxRelations(request)`は入口モデルと分析／Journey関係集合を照合し、UX→Journeyの順でIssueを返す。UX側は入口IDが非空、Journey側はCanonical関係集合が非空という異なる条件を維持し、双方の双方向包含を検査する。呼出し元は旧Root観測の後で呼ぶ。入口／Template Checklist・他工程・全体完成の移管完了を意味しない。

### 変更文書の構造と案内集合 — 2026-10-20（移管済み）

`artifact/change.ts`は`inspectChangeDocument(source, aggregateId)`、`isChangeTemplateInvalid(markdown)`、`isChangeNavigationInvalid(markdown, aggregateIds)`をRootから公開する。Canonical本文は生本文の影響区画・旧見出し・番号80以降のPhase／Gate条件を既存順に検査し、影響見出し不一致だけは後続を打ち切る。ひな型は独立した既存条件、案内は最初の指定コメント区画と実在ID集合の一致を検査する。Root、存在確認・列挙・読取り、他工程TemplateやRelease Evidenceの観測はCheckerが所有し、中立Issueの表示もCheckerへ残す。通常のモデル検査であり、移行・互換変換・実行状態は所有しない。

### Reality用試験登録対応の検査 — 2026-10-20（移管済み）

`reality-traceability/catalog.ts`の`inspectRealityTestCatalog(value, sourcePath)`は、JSON解析済みの値からReality照合用の登録Path対応を作る。現行の`tests`配列、各要素の文字列`id`／`owner`／`path`、同一Pathの重複だけを検査し、空文字・未知field・空配列・ID重複を新たに拒否しない。一不正ごとに順序付き中立Issueを返し、一つでも不正があれば部分Mapを公開しない。登録要素は既存Graph入力と同じ`owner`／`testId`を使い、同じ意味のモデルを重複定義しない。

通常Test Catalogの厳密な検査とは用途・受理条件が異なり、一律に置換しない。Root・Filesystem観測・JSON解析・観測不能診断はCheckerに残す。移行・互換入力や新しいRegistry、認可・実行許可は追加しない。

### UI本文と関係の移管契約 — 2026-10-20（移管済み）

`artifact/ui.ts`は既読本文の入口解析、Detail集合、UX／IA別分析、定義、網羅性、関係閉包を所有する。Root公開は`parseUiIndex`、`inspectUiDetail`、`inspectUiAnalysis`、`inspectUiDefinition`、`inspectUiAnalysisCoverage`、`inspectUiIndexCoverage`、`inspectUiRelations`と型`UiIndexModel`／`UiRelationsModel`。Directoryの実在・Root選択・Template選択・読取り・診断表示はCheckerに残す。

入口の行別Issue、二観点別の重複を保持する関係列、本文不正とChecklist不正の別Issueを維持する。不正本文も抽出関係を返す。Detailは既存の行条件とSCR／PRT集合数だけを検査し、新しい一対一制約は追加しない。Definitionの正式入力はその本文内の分析参照と照合し、追加の読取りはしない。中立Issueは既存診断文言を持たず、Checkerが四項目へ明示変換する。

### IA本文と関係の移管契約 — 2026-10-20（移管済み）

`artifact/ia.ts`へ、IA入口の登録ID／UX–IA関係の解析、分析本文、定義本文、横断投影、分析網羅性、定義台帳、関係閉包の用途別検査を配置する。入力は読取り済み本文、期待ID、すでに得たIA意味モデルと実在確認済みID集合だけとする。Root、Reader、Filesystem Snapshot、診断callback、可変検査Sessionは含めない。

分析・定義は不正時も抽出できたObject・Identity／Relation・関係列を保持し、中立Issueを併記する。Setだけへ縮小して重複を失わない。通常可視本文と図のFence内を保持する本文、完全一致Section、括弧除去、Same／Renameの同族扱いとN/Aの全角ダッシュを変えない。Checkerは元の読取り位置で検査を呼び、分析網羅性、定義台帳、横断投影、最終関係閉包を元の位置で診断する。新しい状態機械や万能工程モデルを作らない。

### 成果物集合とUX引渡しの検査 — 2026-10-20

`artifact/inspect.ts`の`inspectArtifactSources({ sources, schemas? })`は読取り済み本文を入力順に解析し、成果物順・適用Schema順のIssue、関係GraphのIssueの順に返す。Schemaがinvalidでも解析済み成果物を捨てず、partialのGraphは非nullの結果を維持する。Graphが得られない場合は既存の`artifact_graph_result_missing`で拒否する。CLIの重要度・code・文言・終了値、Rule登録、Repository観測は所有しない。旧Checker Pipelineの代わりに新しいRunnerやRegistryは作らない。

`artifact/ux-handoff.ts`は読取り済み本文の正式な引渡し先を判定する。`isUxHandoffTargetSetExact`は四つの引渡し先の順序と完全一致を要求し、次の二段階または三段階見出しで対象Sectionを終える。`isUxRootHandoffValid`は入口の関係する三ラベルだけを比較し、二段階見出しだけで終える。この違いを汎用Parserへ畳まず、既存のコメント・Fence除外と判定条件を維持する。観測順と診断はCheckerが所有する。

`reality-traceability/test-source.ts`の`hasSkippedTestDeclaration`は、既存の文字列・コメント除外とskip宣言検出をそのまま所有する。汎用TypeScript Parserや実行済みEvidenceの証明へ拡張しない。

### 工程Checklist期待項目の所有 — 2026-10-20

`artifact/phase-checklists.ts`の`createPhaseChecklistItems()`は、既存47種類の工程・成果物別Checklist期待項目を綴り・順序・派生列ごと所有する。呼出しごとに新しいObjectと配列を作り、共有可変状態・登録処理・Filesystem・版の自動選択は持たない。Checkerは同じ起動位置で一度取得し、既存の対象選択と`inspectEvaluatedChecklist`／`inspectTemplateChecklist`へ渡す。期待項目の所有移管であり、全工程の本文判定移管や品質Passを意味しない。

### Project Context本文検査 — 2026-10-20

`project-context/inspect.ts`の`isProjectContextProjectionInvalid(content, isTemplate)`は三Identity・五場面とChecklistの不一致をbooleanで返す。`isProjectContextManifestIdentityInvalid(content, manifest)`はBacktick内のIdentityとv2 Manifestの不一致を返す。両者は既存条件をそのまま移し、表示用Parserとは別の検査を所有する。Root・File観測・JSON解析・診断の文言・実行順はCheckerへ残す。型契約外のnull Manifestへのアクセス失敗も呼出し元へ伝播し、Checkerの既存catchによりManifest不正として扱う。今回の移管を理由に表や新しい品質条件を必須化しない。

### 行とコードFence構造の解析 — 2026-10-20

既存`artifact/markdown.ts`の`parseMarkdownFences(lines)`は、分割済み行から`{ entries, fences }`を返す。型`MarkdownFenceLine`／`MarkdownFence`は`artifact/types.ts`が所有し、操作と型をRootから明示公開する。行位置は0始まり、開始・終了行はFence内だがcontentsには含めず、内容行だけentriesと同じObjectを共有する。新しいfreeze・複製・状態保存を加えない。

開始・終了のindentは最大三ASCII空白、markerはbacktickまたはtilde三個以上。backtick開始のinfo内にbacktickがあれば通常行とする。閉じは同markerかつ開始以上の長さで末尾はspace／tabだけ。言語はinfoの先頭語を小文字化し、空は空文字。未閉鎖は`end:null / closed:false`のまま返し、構文不正を一括拒否するAPIではない。BOM除去・改行分割・コメント除去は引き取らない。

既存の可視本文除去APIや`parseMarkdownArtifact`はコメント処理・空白・返却情報が異なるため変更しない。三ConsumerはCheckerのDiscovery要求IDリンク、README版解析、CHANGELOG。Repository読取り・対象選択・リリース宣言の採否・診断はCheckerが所有し、DomainはFenceの言語や閉鎖だけから意味の妥当性を保証しない。

### 工程ひな型の基本図処置契約 — 2026-10-19

`artifact/phase-diagrams.ts`は既存七ProfileのPath・期待図名・列名・処置語彙と本文条件を所有する。Root公開は凍結した`phaseDiagramTemplatePaths`と、取得済み`ArtifactSource`列を受ける`inspectPhaseDiagramTemplates`だけとする。Profile Map自体や設定変更操作は公開しない。

既知Pathは完全一致で選び、未知Pathは対象外とする。入力順で一不正Source一つの中立Issueを返す。kindは`artifact.phase-diagram.contract-invalid`、reasonは`contract_incomplete`、Identityと位置は元Path、`details.missingItems`は従来順・重複を保った不足項目の連結文字列である。File不足はここでは検査せず、空Issue列から七Fileの存在・図の実在・品質を推定しない。

生本文の見出し・語彙照合、単純Pipe分割、二行skip、最初の非Pipe行で停止、重複図名の後勝ちを維持する。コメント・Fence内の記載も現状どおり参照し、新たな可視本文化や区切り行検査を追加しない。Discoveryの人間理解欄三条件も既存の特例として保持する。Filesystem探索・読取りとofficial適用判断、利用者向け診断はCheckerが所有する。

### 可視Checklistの構造検査 — 2026-10-19

`artifact/checklist.ts`は`inspectEvaluatedChecklist(markdown, expectedItems)`と`inspectTemplateChecklist(markdown, expectedItems)`をRootから公開する。返却値は既存`artifact/types.ts`の`ChecklistFailure`九理由またはnull。本文以外の観測、工程別期待項目の選択、診断表示は引き取らない。

既存の可視本文除外を用い、可視の`## Checklist`が一つであること、末尾配置、項目数と順序の完全一致を検査する。評価済み版は小文字`[x]`または理由付き`OPEN`／`FAIL`／`N/A`を受理し、全項目Passを要求する意味ではない。ひな型版は未評価項目と結果記法・理由の案内を要求する。複数違反時の最初の理由、空白・括弧・大文字小文字の既存境界を維持する。nullはこの構造条件だけの成立であり、品質全体のPassではない。

`parse-markdown.ts`は最初のSectionから評価結果をモデル化し、不正行を飛ばす場合や大文字`[X]`を読む場合がある。重複Section・後続本文・項目完全一致を検査しないため、今回の厳密な検査を同Parserの結果へ一律に置き換えない。補助の項目名抽出は非公開とし、汎用mode・options・Callbackを追加しない。

### 品質設計成果物の状態検査 — 2026-10-19

`src/artifact/quality-state.ts`の`inspectQualityDesignStates(artifacts)`は、渡された`ArtifactModel`集合だけを検査し、中立な`DomainIssue`列を入力順に返す。対象集合の選択やQuality Ready等の適用判断、CLI・Filesystem・診断文言は所有しない。

版接頭辞の除去、末尾の全角`（Released Baseline:...）`の除去、trimの順で状態を正規化し、`Canonical`との完全一致を要求する。欠落・空値・大小文字違い・ASCII括弧等の従来の拒否境界は変えない。Issueは`artifact.quality-design.state-invalid`、reasonは`canonical_state_required`、対象はCanonical IDまたは元Path、位置は元のSource Locationとする。detailsには元の`status`（nullを含む）と判定用`normalizedStatus`を別に保持する。入力は変更しない。

既存の汎用Schema検査は状態欠落時の扱いと正規化条件が異なるため、一律に置換しない。CheckerはこのIssueから従来のFindingへ明示変換し、未知のkindは拒否する。

### UX正式入力の参照候補解析 — 2026-10-19

`src/artifact/ux-inputs.ts`は`parseUxFormalInputTargets(text, repositoryRoot): UxFormalInputTarget[]`をRootから公開する。型は既存`artifact/types.ts`が所有し、target文字列とinvalidEntity flagを表す。補助のEntity処理・Discovery形状判定は非公開である。

処理順はMarkdown参照、HTML href、裸Path、Entity候補。裸の`01_Discovery/...`だけをHostの`path.join`でRoot文字列へ結合し、その後に限定Entity DecodeとMap登録を行う。同じDecode後targetは挿入順を保ち、異常flagを論理和で引き継ぐ。Rootを結合する位置を変えると、絶対参照との重複やRoot内のEntityの扱いが変わるため、旧順序を維持する。

Root引数は文字列の組立て用値であり、検証済みRoot Capabilityではない。Root検証・認可・Pathの実在・Link境界・Git履歴・Findingは所有しない。返却候補は存在・Root内・安全・正式入力として妥当なことを保証せず、invalidEntity=falseも全体妥当性ではない。限定名・数値Entityの一回Decode、不正値の原文保持、既存のescape・私用marker・形状条件を維持し、HTML全仕様への適合や新たな拒否を追加しない。

### 共通リンク参照解析の移管 — 2026-10-19

`src/artifact/links.ts`はRootから二つの純粋解析APIを公開する。Label正規化・URI Decode補助は非公開とし、既存のFence除外を同じDomain内から利用する。

| 公開API | 返却値・意味 |
|---|---|
| `parseMarkdownLinkTargets(text)` | 未Decodeの参照先配列。Inline、参照形式、短縮参照の三走査順・重複と、正規化Labelの後勝ちを維持する |
| `parseMarkdownLinkReference(raw)` | `MarkdownLinkReference`。最初の`#`で分割したtarget・anchorと、片方以上のDecode失敗を示す`decodeError` |

`MarkdownLinkReference`は既存`artifact/types.ts`が所有するreadonly型である。targetは参照文字列であり、解決済みFilesystem Pathではない。targetとanchorは分割後に各一度だけDecodeし、不正Encoding時はその側の元文字列と他方の成功結果を保持する。`decodeError:false`は存在・Root内・安全性・認可を表さない。URL判定・Path正規化・Filesystem観測・Git履歴取得は所有しない。

現在の受理集合を維持し、CommonMark全仕様への適合とは扱わない。Fence内は除外するがHTMLコメント内はこのAPI単独では除外しない。参照形式のLabelが短縮参照として再抽出される既存の重複も保持する。既存の`parseMarkdownArtifact`は可視行から安定IDを得て成果物Relationを構成する別責務なので、今回の参照文字列抽出へ一律置換しない。UX固有のEntity／Discovery参照候補は上記UX解析節が所有し、Root／Filesystem観測と正式入力の妥当性判断はCheckerへ残す。

### 可視本文・表・先頭Headerの移管 — 2026-10-19

`src/artifact/markdown.ts`は本文文字列だけを扱い、以下をRootから明示公開する。Filesystem・Git・Finding・CLIや新しい保存状態を所有しない。

| 公開API | 返却値・意味 |
|---|---|
| `omitMarkdownCommentsAndFencedCode(text)` | コメントを同幅空白へ、Fenceと内部を空行へ置き換えた文字列 |
| `omitMarkdownCommentsOutsideFencedCode(text)` | Fence内原文は維持し、Fence外コメントだけを同幅空白へ置き換えた文字列 |
| `parseMarkdownTableRow(line)` | Escape・Code Span内Pipeを区切りから除くCell配列。Pipeなしはnull。Backtickは除去し、外側Pipeは任意 |
| `isMarkdownTableSeparator(line, expectedCells)` | 共通表行解析後、Cell数とハイフン・配置記号の一致を返すboolean |
| `readCanonicalDocumentHeader(content)` | BOM・初期Anchor・最初のH1を除き、先頭英字Key行を順序・重複を保って連結した文字列。欠落時は空文字列 |

可視本文二方式はCRLFをLFへ正規化するが、コメントとFenceの受理順序を変更しない。Headerの値・重複の妥当性や表全体の意味は、この抽出APIでは保証しない。既存の`parse-markdown.ts`は行番号付き成果物モデル、`activity-table.ts`はTopic／Meetingの固定書式を所有し、コメント除去・Fence判定順や表の受理範囲が異なるため、一律に新APIへ置換しない。今回は小Fileを三つ新設せず、一つの純粋本文解析Fileへ同居する。

### Markdown Anchor解析の移管 — 2026-10-19

`src/artifact/anchors.ts`は本文文字列から見出しの可視文字、明示Anchor、重複接尾辞を解析する。Root公開APIは`parseMarkdownAnchors(content): Set<string>`と`omitMarkdownFencedCode(text): string`。後者はFenceを行数を保った空行へ置き換え、CRLFをLFへ正規化する。閉じていないFenceの以降は本文へ戻さない。これらはFilesystem・Git・CheckerのFinding・共有状態へ依存しない。Setは呼出しごとに新しく返す。

既存の成果物構造解析とAnchor解析は、HTML comment、Fence、見出し記法の受理範囲が異なるため同名の処理として統合しない。今回は従来のAnchor意味を維持する分離であり、Markdown全構文への適合を宣言しない。ファイル読取り・リンク対象観測・診断変換はCheckerに残る。工程別検査本体のDomain移管は別の未完了範囲である。

### 試験台帳・計画モデルの移管 — 2026-10-19

旧Runnerの台帳型・読取り・整合検査・回帰選択を`src/test-catalog/inspect.ts`へ、段階型・計画・結果集約・相対Path正規化を`src/test-catalog/plan.ts`へ移した。公開型は`TestCatalog`／`TestCatalogEntry`／`TestLevel`、高負荷の条件型、段階・計画・結果型であり、公開操作は台帳の読取り・整合検査、条件検査、Owner／試験選択、段階計画、結果集約、Path正規化である。正確な集合はRoot明示exportと固定集合試験で照合する。

台帳の読取り・試験Sourceとの照合は読取りEffectを持つが、選択・段階計画・結果集約は局所計算である。Git差分の観測はCheckerからVersion Controlへ委譲し、DomainはGit操作・npm／Cargo構成・試験の起動Callback・自動段階制御を持たない。既存catalogの保存先・Schema・Profile分類を維持し、Project固有の実行手段と計画を分ける。[移管境界](../verification-runner/01_Architecture.md#2026-10-19の責務移管)を参照する。

### Semanticの移管 — 2026-10-19

旧Semantic Coverage PackageのIR、Quality Relation、Coverage Graph、Bundle生成を`src/semantic/`、原子的保存を`src/storage/semantic-store.ts`へ移管する。Root APIから実責務Fileを明示exportし、Capability内barrelや新しい管理状態を作らない。中立的なDomainOutcomeとDomainIssueを返し、Checker固有の診断・起動・旧JSON移行調査は所有しない。保存は既存の検証済みRoot・Link拒否・書込み同期・読戻し・原子的置換・finally回収を維持する。以下の旧「Semantic IRとBundle公開はDomain外」という記述はこの範囲で置換する。意味と関係の詳細は[Semantic詳細](../semantic-coverage/01_Architecture.md#2026-10-19の責務移管)に従い、同名の設計領域と廃止した実装Packageを区別する。

### 目的限定Contextの未接続範囲 — 2026-10-13

旧CROSのContext Package値生成prototypeは撤去する。認可済みSource／Portfolio集約はDomainの入力処理として接続済みだが、目的限定Package Identity、Consumer lifecycle、消費終了後に第二正本を残さないことは未接続である。RFD-ST-010をOPENとして保持し、単純な値copyを新Domain APIへ移して完成としない。認可は引き続きAccess Management、Handoffの実行・再開判断はOrchestratorの5C依存範囲であり、DomainはAuthorityを発行しない。

### 認可済み集合内のRelation解決 — 2026-10-12

`activity/federate-relations.ts`の公開`federateTopicMeetingRelations(sourceRepositoryId, sources)`は、認可済み同Project集合の中からSourceを導出し、Topic／MeetingのRelationだけを合成する。Source一意・Repository重複なし・同Projectを読取り前に検査するが、これは構造整合であり認可証明ではない。認可と集合選定は構成側に残す。一意OwnerだけRepository IDを返し、0件はunavailable、複数件はconflictingとする。既存Owner値は流用せず、読取り例外では部分結果を返さない。書込み等の既存操作参照はSourceのまま保持する。旧MCP構成をこのDomain入口へ接続するが、AM本番Resolverへの接続・旧CROS撤去は未完了である。

### Topic／Meeting本文のProject拘束 — 2026-10-12

公開生成関数`createTopicOperations`／`createMeetingOperations`は、文字列Rootの場合だけ期待Project IDを受け、共通保存Ownerへ渡す。AM利用側は現在認可manifestのProjectを必ず指定する。指定値の形式はRoot観測前、登録・更新の本文一致はLock／Directory作成前、既存本文一致は返却前に検査する。不一致は固定例外とし、部分内容・Pathを返さない。削除時のincoming Relationも、参照候補がTopic／Meeting正本の場合は同じParserとProject一致を通す。Project欄のない他種別へ新fieldは要求しない。保存契約を直接注入する既存入口では第2引数を型・実行時とも拒否し、未実装の保証を付けない。単体の期待値未指定をAM認可保証と扱わない。AM Resolver／本番HTTPへの接続、認可集合内のRelation解決は未完了である。

Topic／Meeting一覧の純粋入力検査は公開`validateTopicMeetingListInput(kind, input)`で既存の条件正規化・Cursor検査を共用する。種別はToolまたは操作側で固定し、limit・状態・sort・Relation・日付・種別固有条件・Cursor構造／Query結合をRepository解決・読取り前に拒否する。Domain一覧自身も同じ検査を先行する。新しいSchema、Parser、保存状態、認可は追加しない。manifestと本文のProject拘束はこの検査とは別の未完了範囲である。

成果物種別: Architecture詳細設計
詳細設計領域: domain-model
状態: Candidate

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Artifact解析、Relation構築等の共通能力と、Checker固有の判定・結果表現を分ける。 | Covered |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | Consumer Closureを含む共通Relation能力を、Checker以外の利用側も同じ意味で利用できる境界にする。 | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Reality TraceabilityをChecker Ruleから分離し、実装・試験Symbolの中立な観測能力として公開する。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | Repository観測とVersion Control Adapterを、Domain意味およびChecker実装から分離する。 | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project Context、Release、Qualityの構造化投影を提供し、上位の受入判断・実行状態を所有しない。 | Partial |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingの構造化CRUD、Outcome処置、昇格とRelation解決を責務別に提供する。 | Partial |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | 用途限定Root、設定読取り、保存・排他・短命ファイルの共通部品を提供し、Runtimeごとの終了判断を所有しない。 | Partial |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | Source改訂版、現在性、履歴と未観測を投影・保存契約で区別する。 | Partial |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | 認可済み集合のContext／Portfolio集約と中立なRoot／保存部品。認証・認可状態は所有しない。具体型・公開API・本番接続はOPEN。 | Partial |

本書は、旧CRDD Domain Library、Project Operation、Runtime Dataの実装を`domain-model`へ統合する責務境界を定義する。Topic／Meetingの意味・状態は[活動Context詳細](./02_Activity_Context.md)、保存用途・保持・清掃は[保存配置詳細](./03_Repository_Storage.md)が所有し、Package統合を理由に重複定義しない。現在の移管と検証Gateは[CHG-000082](../../../99_Roadmap/Changes/CHG-000082/change.md)、過去のLibrary分離は[CHG-000076](../../../99_Roadmap/Changes/CHG-000076/change.md)へ戻る。

新配置での接続は未実施である。従来のCoveredは保持する設計断面であり、統合後のSource、全利用側、試験・署名の成立を示さない。

## 1. 責務と非目標

### 1.1 この設計が所有すること

- CRDD共通Domain能力とChecker固有能力の境界
- Package Rootの明示exportと責務別の公開許可集合
- Filesystem／Version Controlを扱うRepository境界
- Domain ResultからSurface固有結果へ変換する責務
- 開発Rootと採用Rootの両方で成立する実装解決境界
- Consumer Closureを維持する恒久条件
- Access Managementが認可したRepository集合からのContext／Portfolio集約

### 1.2 非目標

- Credential、Role、Grant、Exposureの解釈・認可判断、資格Secret／交換Recovery／認証Storeの所有
- Checker FindingをCRDD共通Domainの結果型にすること
- 純再exportだけの中間Fileを追加し、公開集合のOwnerを重複させること
- 同名Fileや類似Algorithmだけを根拠に共通化すること
- MCP／Workbenchの旧接続を、新配置の接続確認なしに成立済みとして扱うこと
- Git Adapterの意味をDomainへ取り込むこと
- 公開APIから採用、Authority、Releaseまたは外部Effect許可を発行すること
- Source移行の進捗や試験結果をArchitectureの正本にすること

## 2. ComponentとSource配置

```text
40_Develop/
│
├ domain-model/
│  └ src/
│     ├ index.ts                   宣言済み全Capabilityの明示公開入口
│     ├ outcome.ts                 Capability横断の中立な処理結果契約
│     ├ artifact/                  Artifact解析・Schema・Relation Graph
│     ├ plain-data/                Record／Array入力の検査・浅い所有Snapshot
│     ├ activity/                  Topic／Meeting共通操作と契約型（operations.ts／types.ts）
│     ├ storage/                   用途限定Store Root、排他・短命保存
│     ├ configuration/             Manifest・設定の検証と読取り
│     ├ project-context/           正本の読取り投影と候補判断（source-projection.ts／candidate-decision.ts）
│     ├ topic/                     Topic状態・CRUD・昇格
│     ├ meeting/                   Meeting記録・Outcome処置・CRUD
│     ├ quality-change-control/    品質・変更の中立な意味判定
│     ├ reality-traceability/      Symbol Manifest・Annotation・Graph
│     └ repository/                検証済みRoot内の安全な観測・Path解決
│
├ version-control/
│  └ src/
│     └ index.ts                   公開入口
│
└ checker/
   ├ src/
   │  ├ index.ts                   公開入口
   │  ├ pipeline/                  Checker実行編成
   │  ├ findings/                  Checker固有結果
   │  ├ rules/                     Rule Registry／現行Profile
   │  ├ adapters/                  Domain結果からChecker結果への変換
   │  └ migrations/                期限付き移行処理
   ├ bin/                           人間／package script向けの薄いCLI
   ├ scripts/                       開発・生成・移行専用Script
   └ tests/                         試験と試験専用支援

└ verification-runner/
   ├ src/
   │  ├ index.ts                   公開入口
   │  ├ application/               回帰実行Use Case
   │  ├ catalog/                   Test Catalog読取り・選択
   │  └ execution/                 段階計画と子Process実行
   ├ bin/                           人間／package script向けの薄いCLI
   └ tests/                         検証実行Capabilityの試験

Semantic Coverageの配置
├ domain-model/src/semantic/       IR・Relation・Coverage
├ domain-model/src/storage/semantic-store.ts
└ checker/src/semantic/            起動・診断・表示

template/tools/
├ crdd-check.ts                    薄い起動入口
├ crdd-coordinator.ts              薄い起動入口
├ crdd-mcp-server.ts                      薄い起動入口
└ schemas/                         配布版が所有する固定Schema
```

物理Directoryは公開／非公開ではなく、Capability、責務または外部境界を表す。`internal/`を非公開性の根拠にせず、Package Rootの`src/index.ts`とArchitectureが宣言したexport集合で公開面を制御する。責務Folderごとに中間公開Fileを追加しない。

`src/`直下は責務を表し、その下は最大一階層までとする。`domain/`、`application/`、`internal/`を形式的な中間階層として追加しない。`repository/`は検証済みRootの観測・解決という具体責務であり、全I/Oの雑多な置場にはしない。共通結果契約の実体は`outcome.ts`が所有する。Package公開面は`src/index.ts`が実責務Fileから明示exportし、個別責務Folderは実体と共有型を所有する。公開Pathの集約を理由に責務やAuthorityを統合しない。

Package Rootにはecosystem固定Fileだけを置く。TypeScript Sourceは`src/`、`bin/`、`scripts/`または`tests/`の責務へ分類する。`bin/`は引数受付、公開Use Caseの呼出し、構造化結果の表示および終了値反映だけを所有する。回帰段階の選択・実行、Process呼出し、Authority判定および計画・結果構築はVerification Runnerが所有する。`bin/`と`scripts/`は実装本体を再定義せず、宣言済み公開入口を利用する。

## 3. 公開入口と依存方向

### 3.1 許可する方向

```text
Repository／Version Control Infrastructure
                 ▲
                 │ 観測結果
        CRDD Domain Capabilities
     Artifact／Relation／Reality
                 ▲
                 │ 公開API
       ┌─────────┼──────────┐
       │         │          │
    Checker     MCP     Workbench／Generator
```

| 利用側 | 利用してよい入口 | 利用してはならないもの |
|---|---|---|
| Checker | `domain-model/src/index.ts`の必要なSymbol、Version Controlの宣言済み公開入口 | 利用目的外の業務CRUD・保存Writerの実行、非公開実装Path、不要なGit操作 |
| 開発Tool | Package Rootの宣言済みSymbol | Checker Rule、任意の近傍`index.ts` |
| MCP | 必要なDomainの公開入口 | Checker Pipeline、Checker Finding、Checker Rule |
| Workbench | 必要なDomainまたは公開Application Contract | Checker実装、Filesystem Adapterの直接呼出し |
| Test | 原則として公開入口。非公開単位の試験だけ同じCapabilityの実装Path | 他Capabilityの非公開実装 |

### 3.2 禁止する方向

- DomainはChecker、MCPまたはWorkbenchをimportしない。
- Repository／Version Control基盤はArtifactまたはRealityの意味をimportしない。
- Checker固有の`FindingSink`をDomain APIの引数または戻り値にしない。
- Subsystem外の利用側は公開入口を飛び越えて実装Fileをdeep importしない。
- `template/tools`にDomain、Checker、RepositoryまたはVersion Controlの実装本体を置かない。

### 3.3 Rootから公開する責務別契約

| Capability／公開入口 | 公開Symbolの完全集合／正本 | Effect | 禁止する責務 |
|---|---|---|---|
| Package Root `domain-model/src/index.ts` | 各責務が保持する既存公開Symbolを`src/index.ts`から明示exportする。実行時・型を含む完全集合は同Fileと固定公開集合の契約試験で照合する | Module公開だけでは操作を実行しない。呼出し時のEffectは各責務の契約に従う | 中間Barrelの追加、未宣言操作の公開、Root集約を理由にAuthorityや用途を拡張すること |
| Artifact `domain-model/src/index.ts` | Artifact Model、Schema検証、Relation Graphの公開型と決定論的関数 | なし | Checker Finding、利用者向けmessage |
| Plain Data `domain-model/src/index.ts` | `snapshotPlainRecord`、`snapshotPlainArray`だけ。exact own key・prototype・data descriptorを検査し、浅い所有Snapshotまたは既存拒否結果を返す | なし | getter／Proxy trapの実行、nested値全体の安全性保証、Authority発行、Store／Writer・Provider実行への依存 |
| Storage `domain-model/src/index.ts` | 検証済みStore Root、Root内Path解決、Kernel排他、exact Lock回復、短命操作の作成・再入場・終了、上限付き安定ファイル読取り | 用途限定Root内の保存・回収とKernel Endpoint。安定読取りは読取り専用descriptorを使用する | 任意絶対PathのAuthority化、個別Domain判断、Filesystem Recordだけによる排他推定 |
| Configuration `domain-model/src/index.ts` | Manifest／設定Schema検証、Repository別Tool設定読取り | 設定読取りだけ。Root作成と設定の自動書込みなし | Policyの採用、Trust Framework、Credential・Authorityの発行 |
| Project Context `domain-model/src/index.ts` | Project Context／Release／Qualityの構造化Reader、Source投影、Context固有候補判断 | 本文の解析・意味変換はEffectなし | Roadmap・品質・実行状態の第二正本、一般Task候補の採用 |
| Topic `domain-model/src/index.ts` | Topic解析・状態変換・登録・編集・取得・一覧・昇格・誤登録削除 | 認可済みRepository内の明示CRUDだけ | Meeting本文・CHG本文の複製、Git Commit／Push、別Repositoryの自動選択 |
| Meeting `domain-model/src/index.ts` | Meeting解析・CRUD・Outcome処置・Close評価 | 認可済みRepository内の明示CRUDだけ | pendingを残すClose、時点記録を現在値で上書き、Topicへの無条件昇格 |
| Quality Change Control `domain-model/src/index.ts` | 品質・変更状態の中立な判定 | なし | Checker固有Rule、採用・Release Authority |
| Reality Traceability `domain-model/src/index.ts` | Symbol Manifest、Annotation解釈、Graphの公開型と決定論的な生成・検証関数 | なし。Path APIはRepository相対表記の構文検査だけに用いる | Repository走査、Checker Finding変換、Reality Audit実行、Test合格、実装完成 |
| Repository `domain-model/src/index.ts` | 検証済みRoot内のRepository観測、名前付きPath解決、保存領域の読取り専用観測 | Filesystem読取りだけ | Directory作成、設定自動生成、Git確定・公開、採用判断 |
| Domain Model Semantic API／Checker実行入口 | Domainは意味・関係・Coverage・保存、Checkerは入力編成と診断表示 | 明示したBundle公開 | Architecture・Quality・実装の意味採否、部分公開の成功扱い |
| Version Control `version-control/src/index.ts` | [Version Control用途限定公開入口](../version-control/01_Architecture.md#32-用途を限定した公開入口)のNamed Symbolを明示利用 | 宣言されたRepository観測とIdentity確認 | Domain意味、未Commit通常操作の拒否、利用しないGit Adapterの依存閉包への混入 |
| Checker `checker/src/index.ts` | `CheckerRunRequest`、`CheckerResult`、`CheckerFinding`、`runChecker`、`runSemanticCoverage`、`runTestCatalog` | `runChecker`はRepository読取りのみ。`runSemanticCoverage`も既定は読取りで、明示`--write`時だけDomain storageへBundle保存を委譲する | Domain Issueの改変、意味採否、外部Effect許可、Checker内での保存本体再実装 |
| Test Catalog `domain-model/src/index.ts` | `TestCatalog`、`TestCatalogEntry`、`TestLevel`、台帳の読取り・整合検査・回帰選択、段階計画・結果型と純粋な結果集約。全SymbolはRootと契約試験に固定 | 台帳・試験Sourceの読取り。計画・結果集約は局所計算 | Git差分観測、npm／Cargoの構成、試験起動、許可・品質成立の推定 |

Domain Modelの各責務は共通Rootから公開する。本表は操作の責務・Effect境界を示し、Rootの実行時・型を含む明示export集合は固定許可集合の契約試験で完全一致を検査する。`./outcome`は共通結果だけの既存Subpathとして維持し、廃止したCapability別Subpathを再導入しない。新しい公開Symbolは対象責務と本表へ接続し、固定許可集合の変更を審査する。

Filesystem Storeの所有権遷移は、WindowsではNamed Pipe、LinuxではAbstract Unix SocketをWorker lifetimeへ結合したOS Kernel排他で直列化する。Lock RecordはRecovery IdentityとOwner PIDを保持する耐久根拠であり、排他そのものではない。Recordの生成、観測および回復対象の確定は同じKernel Lock内で行う。Kernel Endpoint解放後のRecord削除は、同じexact IdentityのObligationを再確認する二段階cleanupとして別世代を保護する。

通常Operationと回復Operationのどちらでも、Kernel Endpointを解放する前に同じRootへexact Recovery IdentityのRecovery Obligation Recordを書き込み、`fsync`で耐久化する。Operation結果とcleanup結果は別に扱い、Effect発行後に解放を確認できない場合はEffect状態を`issued`、`not_issued`または`unknown`として搬送し、Lock RecordとObligation Recordを残す。成功結果はKernel Endpointの解放、同じRecordの再確認、Obligation解消まで確認した場合だけ返す。後続Ownerは通常Recordより先にObligationを確認してEffect 0で停止し、同じIdentityの再入場だけが再確認と解消を行える。

Owner不存在の観測でもKernel Endpointの解放を確認できなければProofを返さず観測不能とする。空、部分、破損または読取り不能なRecordは`recovery_required`へ昇格せず観測不能としてEffect 0で停止する。`recovery_required`を返す場合は、検証済みRecordに含まれる非nullのexact Recovery Identityを必須とする。対応するKernel原語を提供しないOSではFilesystem Lockへ縮退せず、観測不能として停止する。

## 4. Data Flow

```text
Repository上の入力
  Markdown／symbol.json／Architecture Details
                  │
                  ▼
CRDD Domain Library
  ├ Artifact Model
  ├ Relation Graph
  └ Reality Symbol Graph
                  │
          構造化Result／Issue
                  │
       ┌──────────┼──────────────────┐
       ▼          ▼                  ▼
 Checker Adapter  MCP／Workbench
       │
       ├→ Domain semantic：意味・関係・Coverage
       ├→ Domain storage：明示Bundle公開
       │    temporary→fsync→readback→atomic publish→cleanup
       ▼
 Checker Finding／Exit Code
```

純粋な解析・意味変換は`node:fs`実装へ依存せず、Repositoryの観測結果または呼出し側が取得した内容を受け取る。統合Package内のCRUDと設定読取りは責務別のRepository／保存公開面を利用し、純粋Coreから暗黙に呼び出さない。Checker AdapterがDomainの構造化Issueを`CheckerFinding`へ変換し、RuleとPipelineが最終結果を構成する。

`storage/bounded-file-snapshot.ts`は容量上限、開いた実体とPathの読取り前後の同一性を確認し、descriptorを終了する共通読取り部品である。CoordinatorのTask・技術実行を統合した保存OwnerがPackage Rootの宣言済みSymbolを利用する。読取り可能なPathを保存・回復Authorityへ昇格せず、Root・用途・内容の判定は利用側が保持する。上限超過、増減、同長差替え、親Directory差替えを拒否し、部品自体は書込みや状態遷移を所有しない。

### 4.1. 認可済みContext／Portfolioの集約

ARCH-000013の意味Ownerである[Access Management](../access-management/01_Architecture.md)が要求ごとに認可済みRepository集合を解決し、呼出し元がその集合だけをDomain Modelへ渡す。DomainはCredential、Role、Grant、Exposureを解釈せず、公開呼出し元は認可を迂回しない。Repository単体利用の資格不要な検証済みRootとは別の入力範囲である。

| 段階 | Domainが扱う情報・処理 | 境界・失敗条件 |
|---|---|---|
| 入力 | 現在要求で認可済みのprojectId、repositoryId、読取り状態、revision、context | 認可集合不明は停止し、明示空集合とは区別する。Root／Binding検証と認可は上流Ownerの責務。全Registry、古い固定Grant、推定Repositoryへfallbackしない |
| Root・読取り | 既存Repository／Version Control契約で技術的境界を検証し、Owner Artifactを解析 | Root検証を認可へ昇格しない。認可拒否と読取り不能を成功の空値へ畳まない |
| 集約 | Project IDに従い、既存Contextの五場面、Source Coverage、出所・改訂、部分取得と矛盾を保持 | 未許可Repositoryの存在・件数・内容を推測・補完しない。複数読取りを原子的Snapshotと偽らない |
| 返却 | 人間・MCP向けに適合できる中立なProject／Portfolio結果 | Authority、Credential、鍵Secret、交換Recoveryを結果へ混ぜない。利用側の現在認可再確認を代替しない |

中立なRoot／保存部品は[Repository保存](./03_Repository_Storage.md)の既存配置・Path検証を支えるだけであり、Access Managementの秘密Store・保存Schema・認可状態の意味Ownerにはならない。Package再編を理由に保存Root・保護条件を変えず、追加共有State・Registry・Lockを作らない。

Source値の意味と現在性はOwner Artifactに従い、独自のProject正本、履歴Store、Live状態、安定IDまたはObserved Atを追加しない。2026-10-14の人間承認により、純粋集約`createPortfolioProjection`の入力`ProjectContextSource`はprojectId、repositoryId、state、revision、contextを明示する五項目へ切替候補を実装済み（最終固定候補の全回帰・独立確認は未完了）。今回の認可は呼出し側が保証し、Domainで再認可しない。completeは確認済み本文、missingは認可済み中立Snapshotでの明示的な未提供、unavailableは文書未確認、conflictingは識別情報競合を表す。既存Observerが不存在と観測不能を型で区別しない場合はunavailableとし、missingへ断定しない。非completeのrevision、contextと公開repositoryRoleはnullとし、管理改訂や推測値を入れず、競合文書の外国Identity・本文・版を公開しない。Projectは競合優先、全Source completeだけcomplete、それ以外partial。従来の昇順と不変結果を維持し、Credential、Exposure、Binding、Root、元contentは集約入力へ含めない。

現在の認可済み集合はAccess Management、本文読取り・集約はDomain、搬送と表示は独立したWorkbench／MCPが所有する。旧CROS Package・RESTは撤去済みで、新たなGatewayを設けない。読取り不能・競合の本番表示への切替候補は局所実Browser確認済み、全回帰・独立確認待ちである。複数Repositoryの読取りを原子的Snapshotと主張しない。SCR-000008／BHV-000012／`PRT-000008.spec-000012`の集約断面は最終検証後に評価する。

Qualityへの導出元は本節。正常な許可集合の集約、部分読取り・矛盾、入力集合欠落、未許可Source非開示、認可とRoot検証の分離をUT／IT／STで評価する。観測は入力集合と読取り先、出所・改訂・Coverage、拒否結果、終了後の秘密・認可状態の非保持とし、旧CROS試験を新契約の合格根拠へ流用しない。QA Local Item IDはQuality側の導出で確定する。

固定本文Readerは公開`readRepositoryProjectContext`、実体は`src/project-context/read-context.ts`とする。今回要求で検証した技術的Rootと期待manifestを受け、既存Repository観測で`PROJECT_CONTEXT.md`を最大1 MiBまで読み、解析後のProject ID・Repository ID・Repository Roleが全一致した場合だけ不変Contextを返す。Readerは認証・認可・Root探索・保存を行わない。期待manifestは今回要求の相関用Snapshotであり、現在manifestの再読取りや複数Fileの原子的Snapshotを保証しない。

承認済み切替では、技術的Rootの不成立は全体停止を要求するblocked、文書の取得・解析不能はunavailable、三Identity不一致はconflictingとして区別する。文書不存在、Directory／Link、上限超過、読取り中の文書変化・観測不能を正常な空本文へ畳まない。Rootは既存Version Controlで前後に再観測し、Root不明を文書未確認へ変換しない。Root、manifest、原文、絶対Path、下位例外を結果へ含めない。既存Observerの同descriptor・実体照合・closeを再利用する。Reader成功はAM認可の成立証明ではない。PPR-IT-019へ本文読取り、PPR-IT-002へ中立Source／Portfolio接続、RFD-IT-019へ現在認可集合との本番結合を導出する。

Readerの成功結果は解析済み`context`と`revision`を持つ。`revision`は同じ安定読取りで解析へ渡した`observed.source`そのものをUTF-8指定で一回SHA-256化した`context-text-sha256:<64小文字hex>`である。再open・別read・解析後再serializeを使わない。同じtextは同じ値、空白等でtextが変われば解析結果が同じでも別値となる。これは本文Snapshotの相関値であり、Git／管理改訂、Stable ID、署名、認可、耐久保存およびデコード前の生byte同一性を保証しない。失敗結果はrevisionを持たない。AM許可集合から実本文へ渡す局所ITは管理改訂を流用せず、五項目Sourceのrevisionへこの値を搬送する。本番Consumer接続候補は局所確認済みで、最終固定候補の検証完了はまだ主張しない。

## 5. 結果と失敗の境界

| 結果 | Owner | 意味 |
|---|---|---|
| Domain Result | 各Domain Capability | Model、Graph、Projection等の正常結果 |
| Domain Issue | 各Domain Capability | 入力不備、重複、未知Relation、観測不能等の中立な構造化問題 |
| Checker Finding | Checker | 現行Profile上のcode、severity、Path、利用者向けmessage |
| Checker実行不能 | Checker CLI／Pipeline | Root不明、必要入力の読取不能、Process失敗等で検査集合を完了できない状態 |

Domain IssueはChecker severity、Rule名、exit codeを持たない。MCP／Workbenchは同じDomain Issueから各Surface固有の表示を作り、Checker Findingを表示契約として流用しない。

共通結果の妥当性は`validateDomainOutcome`への直接UTで四状態、result／Issue相関、必須field・禁止fieldを確認する。構造として正しい未知kindはDomainが拒否せず、各Surfaceの明示変換が表示可能性を判断する。このUTはCheckerの汎用四状態変換や各本番Consumer接続の証明ではない。

Domain結果は`kind`、`targetIdentity`、`location`、`reason`、`details`、`status`およびResultの有無を中立な契約として保持する。Checkerは用途別の明示Mappingで既存診断へ変換し、未知kind・欠落detailを拒否する。非成功・欠測を成功へ丸めないことは、実Producerから本番診断・公開終了値までを確認する。全fieldや四状態を一律のChecker結果型へ複製する旧汎用変換契約は退役し、診断の既存shapeを変更しない。

## 6. 配布と開発の境界

Coordinatorの保護実行から保存公開入口へ到達する場合、保存排他のWorkerも実行閉包に含める。WorkerのOwnerと起動はDomain Model内に維持し、Coordinatorへの逆依存やCoordinator専用起動APIをDomainへ導入しない。配布観測は`storage/root-and-lock.ts`の一つの直接起動と、同じ保存責務内の`kernel-lock-worker.ts`への固定相対参照を対応付け、起動元・参照先・Worker実体とその依存を検査する。参照の変更・間接化・起動追加・欠落、実体欠落または観測不能では停止する。Domain全Sourceを一律に署名するのではなく、実到達した閉包へ同Workerを接続する。

| 領域 | 責務 |
|---|---|
| `template/tools` | 採用Repository向けの安定した起動入口と設定／Schema。業務ロジックを所有しない |
| `40_Develop/domain-model` | Artifact、Relation、Reality、共通Outcome、Repository観測、設定・保存部品、Topic／MeetingとContext投影の実装正本。旧三Packageの移管先 |
| `40_Develop/checker` | CheckerのCanonical実装正本、CLI、Profile、Generator、試験およびfixture |
| `40_Develop/version-control` | Version Control Port／AdapterのCanonical実装正本 |
| `40_Develop/<subsystem>/symbol.json` | 現実側Symbolの正方向Relation Owner |
| `07_Quality/Registry` | Canonical成果物から生成または移行する機械投影。Library SourceのOwnerではない |

`template/tools`から`40_Develop`へ実装をコピーしない。起動入口は自身の実PathからCRDD基準版Root候補を一つだけ導出し、そのRootのIdentityを検証してから同じRoot直下の`40_Develop`へ接続する。

| 実行形態 | launcherの位置 | 実装解決先 | 判定 |
|---|---|---|---|
| CRDD標準の開発 | `CRDD Root/template/tools/` | `CRDD Root/40_Develop/` | Repository Manifestで開発Rootを検証する |
| CRDD採用Repositoryの一般Tool | `<Project>/<CRDD基準版Directory>/template/tools/` | 同じ基準版Directoryの`40_Develop/` | 同じCRDD基準版Root、宣言した公開入口と当該Toolが必要とする配布Identityを検証する。Coordinator署名や全Repository Tree検証を一律要求しない |
| Coordinatorの保護実行 | 同じ基準版DirectoryのCoordinator入口 | 検証済みCoordinator実行閉包と固定Native | [CoordinatorのV6署名契約](../coordinator/01_Architecture.md#署名範囲の縮小--v6方式と再編後の閉包)へ接続し、Manifest、選択した実行閉包とNativeのIdentityを検証する |
| launcherだけの単独コピー | Project Root等 | なし | 対象外。代替Pathを推定せずEffect 0で停止する |

Root候補はlauncher実Pathの`template/tools`からexactに2階層上だけを採用する。launcher、候補Root、当該Toolが読むIdentity入力および実装入口はregular file／directoryであり、symbolic link、junctionまたはRoot外解決を含んではならない。Coordinator保護実行の署名Manifestも同じ実体確認へ含めるが、一般Toolへ署名Manifestの存在を一律要求しない。必要なIdentity入力が不存在・不一致・観測不能なら代替Rootや署名免除を推測せず停止する。単独配布Artifactが必要な場合は`40_Develop`の正本からRelease工程で決定論的に生成し、`template/tools`に二つ目の手編集実装を作らない。

## 7. Consumer Closure

### 7.1 Consumer契約

| Consumer分類 | 利用契約 |
|---|---|
| `template/tools` launcher | 同じ基準版Rootの公開入口だけへ接続し、実装本体を持たない |
| CRDD公式Repository CLI | Checker公開入口へ接続し、DomainやRuleの非公開Pathをimportしない |
| Checker試験台帳入口 | `runTestCatalog`がDomain Rootの台帳検査・選択・計画へ接続する。試験起動・npm構成・一括自動結果収集を持たない |
| 開発／生成Script | 用途を限定し、必要なCapabilityの宣言済み公開入口を使う |
| 同一Capabilityの単体試験 | 公開入口を原則とし、非公開単位だけ同じCapabilityの実装Pathを利用できる |
| 複数Capabilityの結合試験 | 各Capabilityの公開入口を使い、他Capabilityの実装Pathをimportしない |
| MCP／Workbench | 接続時にDomainまたは公開Application Contractを使い、Checker実装を再利用しない |

MCPとWorkbenchの旧公開入口利用は移管対象である。新Packageへの接続、本番Reader／Storeおよび終了後状態の確認前に新構成を完成済みと表示しない。

### 7.2 Closure条件

- 宣言した公開入口と実Sourceから導出した公開入口が一致する。
- 全ConsumerがArchitecture宣言済みの入口だけを利用する。
- 未宣言export、Subsystem間deep importおよび禁止する逆依存を機械検出する。
- Source Path変更時は、launcher、package script、fixture、試験、現在有効な文書および配布契約を同じ変更で確認する。
- 旧Pathは、全Consumer移行と終了後不存在を確認するまで削除済みと扱わない。
- Consumer集合は手書き台帳だけに依存せず、実Sourceと公開入口から導出した集合との差分を確認する。

## 8. Security境界

- Repository観測は検証済みRoot内のregular file／directoryに限定する。
- 公開Filesystem PortはVersion Controlが発行した検証済みRepository Root Capabilityだけを受け取る。
- 完全修飾Pathは実行OSのPath形式で判定し、Windowsではdrive／通常UNC、POSIXでは`/`から始まるPathだけを受理する。
- File内容は、開いたHandleの所在を検証済みRoot配下として証明できる場合だけ、同じHandleから読む。
- Identity不一致、証明不能または観測不能では安全を推定せず、`unobservable`で停止してHandleを閉じる。
- symbolic link、junctionまたはRoot外Pathを、存在だけで確認済みにしない。
- Version ControlのProcess実行とBundle書込みをDomain Modelへ移さない。Filesystem読取り・CRUD保存は用途別公開面へ隔離し、純粋な意味変換から呼び出さない。
- 読取りAPIとFilesystem Effectを持つAPIを公開面で区別する。
- Domain ResultからAuthority、採用判断、Release判断または外部Effect許可を生成しない。

## 9. 統合後の公開操作と保存Owner

以下は実装を分割する設計契約であり、新APIの実装済み宣言ではない。公開Symbolの移管は元の意味・結果・失敗条件を保持する。Topic／Meetingが共有する内部Repository手順は`storage/`へ集約できるが、相互の公開Barrelを循環importしない。

| 操作／既存Symbol | 新しい公開入口 | 入力と結果 | 主な利用側 | AuthorityとEffect |
|---|---|---|---|---|
| `projectProjectOperationSources`、`applyProjectOperationCandidateDecision` | `src/index.ts`の該当Symbol | Source状態・改訂版／投影、対象候補と明示判断／次候補状態 | Workbench Server、MCP Server、CROS | 意味変換だけ。対象の採否Authorityを生成せず、一般Patchの採用はOrchestratorへ渡す |
| `federateTopicMeetingRelations`、`TopicMeetingRelationSource` | `src/index.ts`の該当Symbol | Source Repository IDと認可済み同Project操作集合／Relationだけを合成したTopicMeetingAccess | MCP Serverの旧CROS構成、後続のAM本番構成 | Relation読取りのみ。認可・集合選定は所有せず、書込み等のSource操作参照を維持する |
| `parseRepositoryProjectContextMarkdown`、`parseRepositoryReleaseProjectionMarkdown`、`parseRepositoryQualityProjectionMarkdown` | `src/index.ts`の該当Symbol | 所有正本のMarkdown／固定表の構造化結果 | Workbench Server、MCP Server、CROS | Effectなし。不正表・欠測を推測で補完しない |
| `parseTopicMarkdown`、`applyTopicPromotion` | `src/index.ts`の該当Symbol | Topic本文、昇格先Identity・期待改訂／検証済み次版 | TopicのCRUD操作 | 意味変換だけ。実在する対象・同一Projectと人間判断は保存前に再確認 |
| `parseMeetingMarkdown`、`applyMeetingOutcomeTreatment` | `src/index.ts`の該当Symbol | Meeting本文、Outcome処置／全表が一致する次版 | MeetingのCRUD操作 | 意味変換だけ。pendingが残るCloseを拒否 |
| `createTopicOperations`（内部の共通Repository／ApplicationからTopic操作だけを公開） | `src/index.ts`の該当Symbol | 選定・認可済みRootまたは同じ保存契約、対象ID、期待改訂、Relation／CRUD結果・Cursor付き一覧 | Workbench Server、MCP Server。Access Managementは認可済みBindingを供給 | 対象Repositoryだけに保存。誤登録削除は影響確認と明示承認が必要 |
| `createMeetingOperations`、`MeetingOutcomeCommandResult` | `src/index.ts`の該当Symbol | 選定・認可済みRootまたは同じ保存契約、Meeting／Outcome、期待改訂／処置結果 | Workbench Server、MCP Server | 同一Repositoryの原子的次版。別Repository処置はAccess Managementの現在認可と利用側Routingが成立するまで発行しない |
| `inspectRepositoryManifest`、`inspectCrosTrustPolicy` | `src/index.ts`の該当Symbol | 明示した宣言／検査結果 | CROS、Checker、各設定利用側 | 宣言の検証のみ。既存Schemaの移管をTrust Policy Framework採用と扱わない |
| `readCoordinatorConfig`、`readExecutionIntelligenceConfig` | `src/index.ts`の該当Symbol | 検証済みRootと当該Tool／検証済み設定Snapshot | Coordinator、Execution Intelligence | 設定読取り。不存在だけ既定30日、不正・読取り不能は整理を停止。旧Orchestrator設定は探索しない |
| `resolveRepositoryRuntimeDataPaths`、`observeRepositoryRuntimeDataArea` | `src/index.ts`の該当Symbol | 検証済みRoot／用途別Pathと境界観測 | Runtime各Owner、Execution Intelligence、診断 | 読取りだけ。`not_observed`と`blocked`を区別し、Rootを逆算しない |
| `ensureRepositoryRuntimeDataArea`、`createCoordinatorRuntimeDataArea`、`createTemporaryOperation`／`resumeTemporaryOperation`／`settleTemporaryOperation` | `src/index.ts`の該当Symbol | 許可Root、用途、exact Identity／保存Capability・終了／回復結果 | Coordinator、Orchestrator、試験・署名準備 | 宣言用途だけ作成・回収。由来不明・使用中・観測不能ではEffect前停止 |

`createTopicMeetingOperations`の共通実体は一つとし、Topic／Meeting公開面は許可された操作だけを返す。既存型の意味を変えず、全APIの巨大再公開や別実装を作らない。File名・型名の具体化は段階3の公開Symbol全数照合で固定する。

種別固定の公開操作は生成時にTopicまたはMeetingを選び、CRUD呼出しに種別引数を持たない。`promoteTopic`はTopicだけ、`treatMeetingOutcome`はMeetingだけに存在する。両公開面を同じ認可済みRepositoryへ構成する組の型は`TopicMeetingAccess`であり、組自体が認可・操作・保存を追加しない。保存契約の注入は既存Applicationの検証境界を維持するためのもので、任意Rootへの許可や別RepositoryへのFallbackを生成しない。

### 9.1. 状態保存と呼出し順

保存PathはRootから種別親・Record親まで既存Directoryを順にlstatし、link／junction・非Directoryを拒否する。ENOENTだけを未作成とし、観測不能は不存在へ畳まない。作成は一階層ずつ行い、EEXIST後も再観測する。Lockと短命Fileの作成前、rename・削除・cleanup前にも該当chainを確認する。listは安定Record ID名のlinkを黙って除外せず拒否し、hasChangeも固定CHG親を同じ観測へ接続する。Relation探索の無関係なlink非追跡は維持する。以下で未完了とする親link保証は非協調Processの同時差替えを含む保証であり、静的な親link拒否とは区別する。この事前観測は観測直後の差替えを防止せず、Root外Effect 0の同時競合保証を証明しない。その必要範囲は人間判断待ちとして別に保持する。

| 順序 | 所有者と処置 | 失敗・取消・中断時 |
|---|---|---|
| 1 | Workbench Server／MCP Serverが操作入力を受付。共有利用ではAccess Managementが対象Binding、Credential、現在Role・操作権限・公開範囲を再確認 | 認可不明なら本文・件数・対象存在を開示せず、CRUD Effectを発行しない |
| 2 | Topic／MeetingがIdentity、期待改訂、Relation、状態遷移を評価し、全表が一致する次版を作る | 不正・競合・未処置Outcomeは保存前拒否。通知だけで採用・終了を確定しない |
| 3 | 保存部品が同じRootで排他、短命File生成、保存確定、読戻しを担当 | 最初の失敗と保存・cleanup結果を分け、不明を旧版・次版いずれかの成功へ丸めない |
| 4 | 操作Ownerが次版の保存を確認して公開結果を返し、短命File・Handleを終了する | 応答喪失時の再入場は対象Identityと改訂を再観測。古い入力を盲目的に再適用しない |

Source本文を読むだけの投影は書込み排他・作業Directoryを作らない。Task／Queue／判断／採用と技術実行／回復はCoordinatorの同じ`state.json`・Writer・短期Ownerへ統合し、通常終了要約は同領域の`history.jsonl`へ保存する。Execution Intelligenceは別の非Authorityな分析履歴であり、進行・回復の状態正本ではない。Domain Modelへ中央状態正本を追加せず、期限整理や成果物の寿命は各意味Ownerが判断する。共通保存部品は用途を推測して削除しない。

Topic昇格とMeeting Outcome処置では、Markdownの純粋な変換不正だけを保存前の入力拒否へ変換する。保存契約の呼出し以降に発生した例外は入力不正や`filesystemEffectCount: 0`へ変換せず、同じ一次例外を利用側へ渡す。MCP／Workbenchも入力拒否と内部の保存失敗を区別し、秘密値や内部Pathを返さない。例外の伝播だけを保存・cleanup全体の成立根拠とはしない。

Topic／Meeting保存では一次処理とcleanupを別に評価する。一次失敗だけなら同じ例外をthrowし、cleanupも失敗した場合は標準`AggregateError`の`cause`に一次例外、`errors`に試行順のcleanup例外を保持する。例外値が`undefined`でも失敗の有無を別に保持する。保存成功後のcleanup失敗はcauseに架空の一次失敗を作らず例外を返し、実保存をrollback・Effect 0へ読み替えない。Lock closeとunlinkは独立に試みる。短命Fileは排他的openの成功で所有を確定し、同じdescriptorへ書込み、close確認後だけrenameする。open失敗時は既存Fileへ触れず、部分write・close・rename失敗後は所有するexact短命Fileのunlinkを試みてENOENTだけを不存在として扱う。closeを盲目的に再発行せず、writeとcloseの併発ではcloseをcleanup失敗として保持する。試行をcleanup成立と同一視せず、入れ子の失敗はcause chainを保持する。既存同期Lock形式と正常CRUD・改訂・Relationは不変で、新しいRecoveryやKernel Lock Frameworkをこの局所是正へ追加しない。親linkと実Process競合は別の未完了保証として残る。電源断耐久性は人間判断により今回の対象外とする。

登録・更新の保存完了は、rename成功後、既存Record Lockを保持したまま対象Fileを一度読み戻し、書いたUTF-8 bytesと完全一致すること、その同じ読取りから解析したID・改訂・Project IDが期待値と一致することで確認する。null、読取り・解析例外、不一致は保存後の内部失敗として返す。公開済みFileをrollbackせず、未保存やEffect 0を主張しない。読戻しはrename失敗用の短命File回収とは分離し、cleanup併発時も一次失敗をcauseへ保持する。別File横断、定期再確認、再試行、追加Lock・Recoveryは導入しない。通常の保存＋読戻しの範囲であり、電源断耐久性・親Directory差替え耐性・実Process競合の完成証明ではない。

### 9.2. 移管確認と反証

- 旧三Packageの全公開Symbol、利用側、worker起動URL、固定fixture、Schema・配布閉包を新責務へ対応する。Rootの文字置換だけで接続済みとしない。
- CheckerのArtifact利用からTopic／Meeting Writer、CROS設定、Provider実行が読み込まれないことを依存閉包で確認する。
- Topic編集の期待改訂不一致、Meetingのpending Close、Relation先不存在ではEffect 0を観測する。保存要求だけを次版確定の証明にしない。
- 最初の保存失敗と排他解放失敗を独立に観測し、別Ownerのretryが旧回復義務を無視して書き込めないことを確認する。
- 旧Meaning・QA導出キーは保持する。現在の`crdd-domain-library.*`、`project-operation.*`、`runtime-data.*`はPackage名ではなく既存の設計項目参照であり、改名だけで新IDを発行しない。

公開集合の移管先と既存QA義務は§9.3、全File／Consumerの予定処置は全ファイル対応、設定・配布とFront AI移行は各Ownerへ接続する。OPEN: 新公開面・worker・全Consumerの実装移管と実起動、設定例と配布物の実切替、統合後のSource試験と実境界は段階5〜7で確認する。

### 9.3. 旧公開集合の移管先と検証義務

Provider計画の分離時に、Coordinatorの共通入力防御を`plain-data/snapshot.ts`へ単一移管し、Package Rootの明示exportから公開する。CoordinatorとAI AdapterはRootの該当Symbolへ直接依存し、旧Coordinator入口の再exportや同一検査のコピーを残さない。既存Recordのnull／Arrayのstatus・reason、Proxyのtrap前拒否、getter未実行、enumerability、Array上限・hole・余剰key拒否、浅い凍結を維持する。外部Effect・深いSnapshot・汎用Trust Frameworkを追加しない。既存`PPR-UT-006`のSnapshot反証と各Authority／Provider入力の負例、公開集合と推移依存、型所属・配布閉包を移管後に照合する。設計の具体化を実装移管済み・試験Passと扱わない。

旧三Packageの公開型は意味を保って各責務の`types.ts`へ移し、Package Rootから明示exportする。型だけのFileを`outcome.ts`と呼ぶ運用は追加しない。共通`outcome.ts`は既存の実行時検証`validateDomainOutcome`も持つため維持する。Rootの名前空間exportや責務別の中間Barrelを追加せず、既存公開集合を実責務Fileから明示し、利用側はRootから必要なSymbolを選択する。

| 旧公開集合 | 移管先 | 利用側と確認する既存義務 |
|---|---|---|
| `parseMarkdownArtifact`、`buildArtifactGraph`、`validateArtifactSchema`とArtifact／Schema型 | `src/index.ts`の該当Symbol | Checker、Semantic Coverage、成果物解析の利用側。`RCM-IT-009/013`で依存方向、`RCM-UT-014`で公開集合、`RCM-IT-003/004`でConsumer閉包を確認する。 |
| `createRealitySymbolGraph`、`validateRealitySymbolManifest`、`discoverRealitySymbols`、`realitySymbolKinds`とSymbol型 | `src/index.ts`の該当Symbol | Checker、Semantic Coverage、Reality Audit。意味GraphとSymbol Graphを混同せず、旧七導出キーと実観測の不足区分を保持する。 |
| `fixQualityCandidate`、`integrateQualityGate`、`reenterQualityReview`と品質Gate型 | `src/index.ts`の該当Symbol | 品質・変更の判定利用側。`RCM-IT-011/RCM-UT-016`で共通結果とChecker結果を分離し、品質GateからRelease Authorityを生成しない。 |
| `createFilesystemStoreRoot`、`resolveFilesystemStorePath`、`withFilesystemStoreLock`、`observeFilesystemStoreLockOwnerAbsence`、`recoverFilesystemStoreLock`とRoot／Lock型 | `src/index.ts`の該当Symbol | 各Store Owner。worker起動URLは同じstorage配下の実workerへ接続する。`RDL-IT-001/003/004`でRoot・排他・再入場・回収を、`RCM-IT-003/004`で移管後の利用側を確認する。Lock Fileだけを実排他の証拠にしない。 |
| `createFilesystemRepositoryObservationPort`、`observeRealitySymbolRepository`とRepository観測型 | `src/index.ts`の該当Symbol | Checker、Semantic Coverage、Repository表示。`RFD-IT-012`でRoot外・link・regular file・観測不能とHandle終了を確認する。 |
| Runtime DataのPath解決・観測・ready検査、CWD起点の二resolverと`resolveCrosRuntimeRoots` | `src/index.ts`の該当Symbol | Coordinator、Orchestrator、Execution Intelligence、CROS、試験入口。CWDは対象Rootそのものではなく、Version Control境界で確定する入力として維持する。CROS Rootを単体Repository書込み許可へ拡張しない。`RDL-IT-001/003/004`と`RFD-ST-003`へ対応する。 |
| Runtime Dataの領域作成、temporary operationの作成・再入場・終了、`verifyTemporaryOperationEvidencePromotion`とReceipt／Capability型 | `src/index.ts`の該当Symbol | 署名準備、各Runtimeと試験入口。操作状態・世代・exact参照と正式Evidence昇格確認を保持する。`RDL-IT-001/003/004`で未解決保護と終了後条件を確認する。 |
| Manifest／Trust宣言、Tool設定の型・検査・読取り、用途別の固定Path／Schema定数 | `src/index.ts`の該当Symbol | CROS、Checker、Tool設定利用側。既存Trust Schemaの検査能力は維持するが独立Trust Frameworkを有効化しない。`RCM-ST-012`で新設定・旧参照・全Consumerを照合する。 |
| Project／Release／Quality投影、候補判断と全対応型 | `src/index.ts`の該当Symbol | Workbench Server、MCP Server、CROS。`PPR-IT-001/002/PPR-ST-005/PPR-UT-006/PPR-UAT-015`で部分観測、出所、情報境界と表示意味を維持する。 |
| Topic／Meeting Record、状態、昇格、Outcome、Repository／Application、Query／Page／Relation／Resultの全対応型 | `src/index.ts`の該当Symbol | Workbench Server、MCP Server。共通保存実体は一つとし、各公開面で操作を限定する。`CPR-ST-005/CPR-IT-006/CPR-UAT-007/CPR-IT-008`で全CRUD・安全な削除・Outcome処置とCloseを維持する。 |

各利用側のFile単位処置は[全ファイル対応](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-file-inventory.md)に結合する。ここでの公開集合固定は移管方針であり、旧importの不存在、workerの実起動、各公開入口の本番接続と試験成功は段階5〜7で観測する。既存QAの件数・過去Passをこの表の追加で変更しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Checker固有、CRDD共通Domain、Repository／Version Control基盤を分ける。 | [§2](#2-componentとsource配置) |
| Interface Model | Required | 利用側が実装Fileを直接importしない公開入口を固定する。 | [§3](#3-公開入口と依存方向) |
| Data Flow | Required | Repository入力からDomain、Surface結果、Effect Adapterまでを示す。 | [§4](#4-data-flow) |
| State Model | Required | 統合対象のTopic／Meeting状態、候補判断、保存・排他の状態を意味Ownerごとに維持する。 | [§9](#9-統合後の公開操作と保存owner) |
| Sequence | Required | Domain結果をSurface固有結果へ変換する順序を固定する。 | [§4](#4-data-flow) |
| Failure／Recovery | Required | 観測不能、Domain Issue、Checker Findingおよび実行不能を分ける。 | [§5](#5-結果と失敗の境界) |
| Deployment | Required | `40_Develop`を実装正本、`template/tools`を薄い入口と設定配置に限定する。 | [§6](#6-配布と開発の境界) |
| Observability | Required | 公開APIとConsumer集合のClosure条件を固定する。 | [§7](#7-consumer-closure) |
| Security Boundary | Required | Root検証、link非追従、読取りと書込みEffectの分離を維持する。 | [§8](#8-security境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Topic／Meetingの期待改訂と保存排他を維持し、Package統合を共有Writerの新設と扱わない。 | [§9](#9-統合後の公開操作と保存owner) |
| Timing | PASS | 時点付きMeeting、投影現在性、Tool別保持期間を意味Ownerへ接続し、普通の履歴期間で未解決状態を削除しない。 | [§9](#9-統合後の公開操作と保存owner) |
| Resource Lifecycle | PASS | Handleと一時物はEffectを持つAdapterが所有し、Domainへ移さない。 | [§8](#8-security境界) |
| External Boundary | PASS | FilesystemとVersion ControlをRepository／Adapterとして分離する。 | [§3](#3-公開入口と依存方向) |
| Failure／Recovery | PASS | Domain Issue、Surface固有結果、実行不能を分ける。 | [§5](#5-結果と失敗の境界) |
| State／Consistency | PASS | 正方向Relation Ownerだけを入力とし、逆引きGraphを生成する。 | [§4](#4-data-flow) |
| Observability | PASS | 公開面とConsumer集合を宣言集合・導出集合で照合する。 | [§7](#7-consumer-closure) |
| Security／Trust | PASS | Root Capability、regular file、Handle所在およびlink境界を維持する。 | [§8](#8-security境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `crdd-domain-library.dependency-direction` | Implementation Structure | Domain、Checker、Repository基盤 | DomainからCheckerへのimportが0 | DomainがChecker型、RuleまたはCLIをimport | IT | N/A | import graph | 禁止逆依存0 | 将来Consumer接続時の再確認 |
| `crdd-domain-library.public-surface` | Interface／Implementation Structure | Package Rootの明示公開入口 | 利用側がRootの必要Symbolだけをimport | deep import、中間Barrel、未宣言export | UT／IT | Direct Boundary | export集合とConsumer import集合 | 集合差分0 | 将来公開API追加時の再確認 |
| `crdd-domain-library.source-layout` | Implementation Structure | CRDD所有Source | Directoryが責務を表し、Package Rootへ任意Sourceがない | 汎用`internal`、Root直下の`.ts`、Owner不明の共通置場 | IT | N/A | import graphとSource tree | 禁止Path 0 | 別Subsystem変更時の再確認 |
| `crdd-domain-library.consumer-closure` | Flow／Consistency | launcher、CLI、Script、試験 | 全Consumerが現在の入口を利用 | 旧Path残存、宣言漏れ、未知Consumer | IT | Related 2 Blocks | 宣言集合と自動導出集合 | 集合差分0 | 将来Consumer接続時の再確認 |
| `crdd-domain-library.result-boundary` | Interface | Domain IssueとSurface固有結果 | 中立IssueをSurface Adapterが変換 | Domainがseverity、Checker code、exit codeを決定 | UT／IT | Direct Boundary | 型と契約試験 | DomainからChecker型への依存0 | MCP／Workbench表示Adapter |
| `crdd-domain-library.repository-boundary` | Interface／Failure-Recovery | Repository観測と公開Effect | 検証済みRoot内のregular fileだけを観測 | Root外読取り、link先を確認済み扱い | IT | Direct Boundary | 境界反証fixture | Handleと一時物0 | 代替Version Control Adapter |
| `crdd-domain-library.distribution-identity` | Interface／Deployment | launcherと同じ基準版Rootの実装 | launcherが公開APIだけへ接続 | `template/tools`内の実装コピー、別版へのfallback | IT／ST | Related 2 Blocks | launcher target／配布Identity | launcher内の業務ロジック0 | 採用Repositoryでの配布実測 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

本書は現在あるべき設計を所有し、現行Sourceを設計の根拠として逆輸入しない。Source、Test、package、配布物およびEvidenceとの一致は、Canonical設計固定後のReality Auditで照合する。移行中のPath対応、実行結果および残るGateはCHG-000076で追跡する。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `crdd-domain-library.dependency-direction`<br>`crdd-domain-library.public-surface`<br>`crdd-domain-library.source-layout`<br>`crdd-domain-library.consumer-closure`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary`<br>`crdd-domain-library.distribution-identity` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Artifact、Relation、Repository ObservationおよびResultを、Checker／MCP／Workbenchから再利用できるDomain契約として公開する。 | Domain型はCLIやFilesystemの具象を所有せず、各Consumerが同じ意味と結果語彙を利用する。 | Consumer別の類似型・変換・例外語彙が増え、同じCRDD意味が分岐する。 | `crdd-domain-library.public-surface`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary` |
| Creation／Selection | Required | Topic／Meeting操作と用途限定保存部品を検証済みRootへ結合する。 | 用途別公開入口と共通内部Repository手順。 | 作成を操作許可や別Repositoryの自動選択と扱わない。 | Root・公開操作の追加は全利用側とEffect前拒否へ波及する。 | `project-operation.context-lifecycle`<br>`runtime-data.repository-local-storage` |
| State-dependent Behavior | Required | Topic／Meetingの状態、期待改訂、保存・回復状態により許可操作が異なる。 | 意味変換と保存確定を分けた状態判定。 | pending Close、競合、観測不能を成功へ畳まない。 | 状態変更は正本表、CRUD、再入場、QAへ波及する。 | `project-operation.context-lifecycle`<br>`runtime-data.repository-local-storage` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `crdd-domain-library.dependency-direction`<br>`crdd-domain-library.public-surface`<br>`crdd-domain-library.source-layout`<br>`crdd-domain-library.consumer-closure`<br>`crdd-domain-library.result-boundary`<br>`crdd-domain-library.repository-boundary`<br>`crdd-domain-library.distribution-identity` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `crdd-domain-library.distribution-identity` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `crdd-domain-library.distribution-identity` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000001、ARCH-000002、ARCH-000008、ARCH-000009、ARCH-000013のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |
| [活動Contextの担当Relation](./02_Activity_Context.md#上流uispec-detailとの関係) | ARCH-000005、ARCH-000006、ARCH-000016のSource Definition | Topic／MeetingとProject Contextの既存担当Relationを統合Packageの責務別入口で実現する | Partial | 詳細の意味は活動Contextが所有。新配置の利用側接続は段階5〜7で確認する |
| [保存配置の担当Relation](./03_Repository_Storage.md#上流uispec-detailとの関係) | ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016のSource Definition | Repository-local／CROSの保存境界に接続された既存担当Relation | Partial | 認可状態はAccess Managementへ、Context集約はDomain Modelへ、Runtime固有の現在状態は各Ownerへ残す |
| [認可済みContext／Portfolio集約](#41-認可済みcontextportfolioの集約) | ARCH-000013のUI-000008／SPEC-000012 | SCR-000008／PRT-000008／BHV-000012、`PRT-000008.spec-000012`の集約断面 | Partial | 具体型・API・Reader接続・Quality・Source・本番接続はOPEN。意味変更はUI／SPECへ、配置変更はARCH-000013へ戻す |

担当Interaction Relation: `PRT-000001.spec-000001`、`PRT-000005.spec-000009`、`PRT-000006.spec-000010`、`PRT-000006.spec-000031`、`PRT-000014.spec-000019`、`PRT-000018.spec-000023`、`PRT-000008.spec-000012`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

Checklist評価根拠: §9の公開集合・保存Owner・呼出し順と全ファイル対応により、Component、Interface、Data／StateおよびSequenceを具体化した。実装移管と実起動は未評価である。 §9.3で旧三領域の公開集合を既存Local Itemへ対応し、対象・反証・観測・終了後条件をQualityへ渡した。設計の対応を試験Passと扱っていない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
