# 文書モデルの責務と公開契約

成果物種別: Architecture詳細設計
詳細設計領域: document-model

## 基本設計との関係

文書の読取り・探索・Semantic成果物の保存は、呼出し側が選定した既存の絶対Directoryを受け取る。文書モデルはGitやVCの型に依存せず、パス越境、リンク、ファイル実体、本文と文書内Identityを検査する。検査対象Repositoryの選定と、必要なGit観測はCheckerなどの呼出し側が所有する。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Artifactと工程の完成Parse・局所Issueを所有し、適用選択と表示はCheckerに残す | Covered |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | 文書契約と公開面・Consumerへの意味搬送を閉じる | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project Contextの現在投影と出典を扱い、読取りを受入判断にしない | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingの内容・状態・改訂とCRUDを所有する | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 診断用の文書モデル・Issueを返し、技術実行・CLI終了値は所有しない | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | 明示Repositoryの文書・活動を扱い、Git実体検証はVCへ委譲する | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | AM認可済み集合だけを読み、認証・認可を再実装しない | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | 出典・過去参照と現在の関係を区別し、過去記録を新Authorityにしない | Covered |

Coveredは局所責務の設計接続を表し、ARCH全体や実動作の合格ではない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 責務Ownerと禁止依存を固定する | [現行契約](#model-boundary) |
| Interface Model | Required | 完成操作と部分結果を区別する | [現行契約](#public-api) |
| Data Flow | Required | 受付から結果までの搬送を明示する | [現行契約](#consumers) |
| State Model | Required | 現在版・候補・未確認を区別する | [現行契約](#storage) |
| Sequence | Required | 検査・保存・終了の順を維持する | [現行契約](#storage) |
| Failure／Recovery | Required | 拒否・部分成立・不明と再入場を区別する | [現行契約](#storage) |
| Deployment | Required | Repository内所在とConsumer配置を固定する | [現行契約](#storage) |
| Observability | Required | 理由・出典と未評価を失わない | [現行契約](#verification) |
| Security Boundary | Required | 受付と認可を別Ownerにする | [現行契約](#consumers) |
| Implementation Structure | Required | 意味Ownerと保存部品を分離する | [現行契約](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 改訂・期待Identity・共通Lockを別の保証として維持する | [既存の設計処置](#storage) |
| Timing | PASS | 受付・現在観測・保存の時点と上位の許可を混同しない | [既存の設計処置](#consumers) |
| Resource Lifecycle | PASS | 自分のLock・一時物・descriptorの終了と残存を結果に保持する | [既存の設計処置](#storage) |
| External Boundary | PASS | VC・Filesystemの不存在と観測不能を区別する | [既存の設計処置](#storage) |
| State／Consistency | PASS | 局所値の受付とモデル横断・上位判断の成立を区別する | [既存の設計処置](#model-boundary) |
| Failure／Recovery | PASS | 不明を補完せず、自動再試行・移行・未知物削除を追加しない | [既存の設計処置](#storage) |
| Observability | PASS | 内容モデル・理由・Issueと保存のEffect／終了相関を保持する | [既存の設計処置](#public-api) |
| Security／Trust | PASS | 受付成功を現在認可・外部実行Authorityへ昇格しない | [既存の設計処置](#consumers) |

- `PASS`: 詳細設計上の処置を記載した状態。試験・実境界・全体QAの合格ではない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。
- `OPEN`: 未解決の設計事項がある状態。
- `FAIL`: 必須設計と矛盾する状態。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | モデル種別で受付条件が異なる | 型・規則の宣言Ownerごとに局所化 | 一律Readerや差替えFrameworkへ統合しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.document-contracts` |
| Common Contract | Required | 完成操作の結果相関を維持する | Rootから宣言元を直接公開 | 3モデル共通の結果Facadeは作らない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.package-boundary` |
| Creation／Selection | Required | 固定対象と入力種別を照合する | 明示した入力から対象を構成 | 上位の認可・実行先を選ばない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.document-contracts` |
| State-dependent Behavior | Required | 現在版により受理できる更新が異なる | 局所遷移と改訂照合 | 読取り成功を保存・実行許可にしない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.document-contracts` |
| Composition／Recursion | Required | 複数の値と整合条件を組み合わせる | 既存の完成操作内で必要な値だけを合成 | 他モデルを直接参照しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.document-contracts` |
| Lifecycle Ownership | Required | 自分の保存資源を所有する | Lockと一時物の終了処置 | 未知・不明時の保全を維持する | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.document-storage` |
| External Boundary | Required | Filesystem・VC・共通Lockを利用する | 専門Ownerの技術契約へ接続 | 外部事実をモデルだけから捏造しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `document-model.document-storage` |

## 入力・状態・保存境界の接続

取得済み本文から型付きモデルと局所Issueを返し、複数モデルの関係を評価する。活動保存は現在改訂と取消を照合し、自分の保存だけを所有する。 不正入力・競合は後続Effectを開始せず、Effect後の不明は元の相関と残存を保持する。通常の読取りを暗黙更新へ変換せず、現在の保存形式・公開集合・期限・安全判定は変更しない。
状態: 実装・限定検証・独立再レビュー済（全体回帰未実施。統合判断とは別）
担当責任者: Qual-Lab
最終更新日: 2026-11-16

<a id="model-boundary"></a>
## 1. 責務と依存

Artifactの参照モデルは`links`に未Decodeのtarget、出現ごとのhistorical区分（注記なしnull／適用declared／不適用invalid）、Related内かどうかを保持する。旧linkTargets文字列配列と並列の互換fieldは持たない。通常参照の三走査順・重複は維持し、exactな直前`[旧参照]`を持つ可視Inlineだけを分類する。参照形式への二重抽出とコード／コメント／escapeからの注記発火を防ぐ。履歴配置・Related・外部URLの文書規則はDMが判定し、不適用は局所Issueと通常の関係を保持する。適用した同じ出現だけをArtifactの現在関係から除き、同じtargetの他の出現へ波及させない。Filesystemの実在・境界、固定byte照合、検査Scopeと計数はCheckerが所有し、注記を当時の存在・安全・認可の証明として返さない。内部のUX正式入力Readerも新しい参照モデルからtargetを使う。Rootの公開項目数は変更しない。

Quality内部の定義閉包・定義集合被覆・Local Item宣言件数は、既存inspectQualityConsistencyが取得済みモデルと観測集合から比較する。Architecture詳細の検証単位とQuality統合の一致は工程横断のため、既存inspectDocumentRelationsが所有する。両者の既存要求Unionへ用途を追加し、新しい公開関数・型・転送Wrapperは設けない。Filesystem観測・参照Path解決は行わず、Coverage欠測時の不足方向と余分方向の区別を維持する。先頭Coverage節の定義IDと先頭詳細処置節の参照targetは各完成Parseが捕捉し、CheckerはPath解決と実観測の集合化だけを行う。

ReleaseはRoadmap表題・README版・観測済みTag・Evidence案内を比較する。共通Artifactは安定IDのファイル名禁止とEvidence名を比較し、Changeは定義Header・宣言IDと観測済み配置を比較する。Filesystemの探索・認可・安全性は所有しない。

Change配置の比較はfilename／evidence／aggregateの三用途に限定する。Checkerが検査Pathを認識できない結果は文書の意味検査ではないため、unrecognizedという要求・Issueを持たない。認識不能の表示はCheckerが直接所有し、Repository Modeと認識Path一覧をDMへ伝播しない。公開関数・型の項目数は変更しない。

配布ひな型の責任者宣言はUI／Architectureの明示templateモードで検査する。CommunicationとActor／System Sequenceはそれぞれの完成Parseとモデルを設け、原文・Artifact・主要節と部分結果を保持する。共通Helperへ工程固有の必須文言を集めず、各Ownerが固定条件を渡す。新しいSourceは対応Ownerがなかったcommunication/parse.tsだけとし、中間Facade・Rule Registry・第二の保存Schemaは作らない。追加公開は二Parse・二モデル型・独立した配置比較二操作であり、この追加時点のRootは227項目（値103・型124）。既存Parserの通常モードの診断は変更しない。

文書モデル（document-model）はCRDD成果物・Markdown構造・Relation・Project Context・Topic／Meeting・Semantic・Reality・試験Catalogと、それらの保存を所有する。実行State、設定Reader、認証、AI／Docker実行、Recovery許可は所有しない。

文書・実行・構成の3モデルは、型・再export・deep import・dynamic import・package依存を含め相互の直接依存を持たない。既存Consumerが各Ownerの完成操作を呼び、必要な値だけを明示投影する。共通Facade・第4Package・汎用Storeを作らない。VC・共通Lock・Node.jsは必要なOwnerが直接使用する。

<a id="document-conceptual-models"></a>
## 1.1 モデルを中心とする設計（UI／SPEC工程モデルを先行接続）

通常ScreenはSPEC Readerの既存取得点で一度解析し、局所ChecklistのIssueをUI診断へ配送する。局所不備があっても同じ部分モデルを既存の関係比較へ渡す。文書と祖先のLinkを除外し、不在時の新しい作成義務は設けない。参照用のUI Definitionまで局所診断を追加する変更ではない。

以下は人間が採用したモデル優先の方向を具体化した設計である。UI／SPEC分析・定義・台帳と、Screen内のPart・Detail対応根拠はモデル構築と既存の関係評価へ接続した。下流担当はArchitecture／Qualityが原文・出典付きの担当モデルを構築し、Semanticへ接続した。Definition対応の八観点根拠、Architectureの分析・定義・登録・横断文書・詳細本文、Qualityの工程別分析・統合・定義も内容モデルへ接続した。通常AREA／CMP／Visual／BHVも局所Checklist診断へ接続した。他工程には未接続・検査用投影が残り、公開項目全体がこの契約を満たすという説明ではない。型名を変えたりFileを移すだけで成果物の概念モデルが成立したとは扱わない。

下流比較ではSemanticが期待関係・Owner Mode・中央／局所の被覆を評価する。ARCH／QAの第一読取りから作る内容モデル列と、後の所有投影用読取りは別の既存観測であり、それらを統合したり同一世代の保証を追加したりしない。UI件数はDirectory観測、SPEC件数は実在定義集合の件数を渡し、モデル配列長に置換しない。QA側の集合は旧サイズ比較、第一観測の内容モデルは可視行へのsubstring検索で旧combined本文includesの条件を保持する。文書内の自由文から記載されていない状態・品質を推論しない。

### 責務と入力・出力

| 層 | 入力 | 所有する値・処理 | 結果から主張しないこと |
|---|---|---|---|
| Artifact | 同じ取得で捕捉した本文・相対Path | 宣言、見出し、表、参照、Checklistの出現と出典位置。工程共通の構造 | 工程の成立、実在参照、品質Pass |
| 工程モデル | Artifactと明示した成果物種別 | その工程の明示内容・正式入力・関係・条件・義務・出典と、局所規則の検査 | 他工程の成立、自由文の解釈完了 |
| Semantic | 工程モデルと必要な取得範囲の情報 | 工程間の意味・対応・重複・閉包・未解決参照の評価 | 生Markdownの再解析、記述されていない意味の推測 |
| Reality Traceability | 工程モデルと別途得た実装・試験の観測 | 宣言された要求・設計・検証義務と観測実体の対応 | 文書だけを根拠とする実体不存在、試験未実施の成功化 |
| 品質Gate | 固定改訂版、必須確認集合、モデルに関係付けた独立確認結果 | 同じ改訂版の完了・指摘・欠落・確認不能の統合 | 文書内のReady／PASS表記からの品質Pass・実行許可・リリース承認 |
| Checker | 今回の取得対象・実行条件・上記の完成操作 | 対象選択、取得、評価の実行、診断表示と終了値 | 工程の本文意味の独自解析・再定義 |

工程の型は相手工程の型を保持しない。例えばUIはSPECへの明示参照を出典付きで保持し、SPECモデルとの一致はSemanticが確認する。モデルはMarkdown正本から同一要求内で構築する値であり、第二の永続正本・独立Schema・Store・Registryを新設しない。

### 工程別モデルの対象

次の名称は概念上の候補であり、公開名の一括改名や新しい必須文書項目の追加を意味しない。Analysis／Definition／Detail／Indexは目的が異なるため、工程ごとの判別型で区別し、一つの任意Property集合へ平坦化しない。

| 工程 | モデルが保持する明示内容 | 主な既存入力 |
|---|---|---|
| Discovery | 課題・要求、対象と利用状況、望ましい変化、採用根拠、成立条件、失敗・制約・対象外、未確認と引渡し | 探索分析、REQ定義、入口台帳 |
| UX | 利用者成果、利用者・状況・目的、成立条件、重要場面・失敗・品質期待、必要情報、責任境界、検証意図、引渡し | UX分析・定義、Journeyと投影文書 |
| IA | 情報の意味・Identity・Object・Relation、状態・可視性・時間、優先度・まとまり・責任、失敗・制約と検証意図 | IA分析・定義、登録表 |
| UI | 利用者成果、UX／IAの正式入力と統合根拠、表示面・操作・Feedback・状態表示・アクセシビリティ、SPEC参照、未確認・検証意図 | UI分析・定義・Detail・登録表 |
| SPEC | 目的、UX／IA入力と統合根拠、契機・事前条件・Authority・判断不能、振る舞い・状態・結果、失敗・回復・副作用、受入条件・検証義務、UI対応 | SPEC分析・定義・Detail・登録表・対応根拠 |
| Architecture | 責務・非責務・境界、UI／SPEC入力ごとのState Owner・Authority・Effect・失敗・Lifecycle、構造・依存、実装引渡し、明示Semantic要素 | 分析・定義、横断モデル、詳細設計・登録表 |
| Quality | 情報源条件・Obligation Key・導出元、適用判断・境界・試験段階、Local Itemの前提・刺激・観測・Oracle・終了後条件、根拠と限界 | 分析・定義、統合・Reality Audit・結果文書、試験台帳 |
| Change | 変更意図・対象・理由・基準改訂、影響、指摘と処置、判断・根拠・残るGate | CHG本文と変更案内 |
| Release | 対象版・範囲・変更一覧・移行と依存・確認結果の参照、公開状態の宣言 | Release案内、CHANGELOG、READMEの版宣言 |

機械的に構造化された列・ID・関係は意味のある型付き値へ取り出す。自由文の目的・振る舞い・回復等は、名前の付いた本文内容と出典として保持し、実行可能条件、状態機械、新しいSemantic Keyへ変換しない。単なるMarkdown構文木だけでも、検査で作ったMap／Setの寄せ集めだけでも工程モデルの完成としない。

### 値・出典・局所検査

共通結果・診断の型はartifact/types.tsが所有する。DocumentResultはcomplete／partial／invalid／unobservableを保持し、ParseResultは取得済み本文に対する前の三状態へ限定する。ルートoutcome.tsと本番利用のない結果オブジェクトValidatorは撤去した。文書種別ごとの完成Parseへ統合する移行は継続中であり、既存の全入口を完成Parseと表示しない。

- モデル本体と診断を分ける。取得済み本文の完成受付はArtifactが所有するParseResult<T>、観測・横断処理はDocumentResult<T>を使い、新しい汎用Result Frameworkは作らない。resultに工程モデル、issuesに取得・解析・局所検査の問題を置く。completeはその操作範囲での成立であり、全工程の品質Passではない。
- 同じ取得本文からモデル・出典位置・診断を構築する。既存の内容相関値や上位が確定した改訂を利用し、新しいHash方式・改訂カウンター・自動探索を設けない。改訂が固定されていない読取りを品質Gateの固定候補とみなさない。
- 出現順の参照・宣言・行を保持し、重複をMap／Setだけへ畳まない。既存Consumerが必要とする先勝ち／後勝ちの索引は、Ownerが出現列から明示的に導出する。
- 取得対象外、明示的不存在、観測不能、見出し欠測、不正行、明示N/Aは同じ空値へ畳まない。解析可能な部分はpartialとして保持し、後続の評価は当該比較に必要な情報の充足を確認する。完全に解釈できない入力を正常な空モデルへ変換しない。
- 文書内の状態・承認・PASSは宣言として記録し、外部確認済みの事実へ昇格しない。Placeholderは生の出現として扱い、実在するIDや解決済み関係へ昇格しない。
- 最初の節／一意な節、次H2必須／EOF許可、raw／可視本文、表分割などの既存差を一律に共通化しない。原則を変える必要があれば、モデル化とは分けて影響と判断を示す。

### 最初に閉じるUI／SPEC定義のモデル契約

最初の実装対象は、現行のUI／SPEC Definitionとその対応評価である。片方の新型を追加するだけで終えず、両者の構築・局所検査・Semanticの利用・Checkerの取得と表示・既存試験まで一つの経路として閉じる。

| 候補モデル | 具体的に保持する内容 | 根拠となる現行ひな型の節 |
|---|---|---|
| UiDefinition | 共通Artifact、利用者成果、正式入力・観点別の根拠・統合判断、表示・情報優先度・操作／Feedback・状態表示・アクセシビリティ、制約、SPEC対応宣言、未確認・検証意図 | template/04_UI/Definitions/UI-XXXXXX/ui_definition.md |
| SpecDefinition | 共通Artifact、目的、正式入力・観点別根拠・統合判断、契機／事前条件／Authority／判断不能の項目列、振る舞い・結果、失敗／回復／副作用、受入条件・検証義務、UI対応宣言、制約・未確認 | template/05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md |

各値・表行・関係は元の内容と出典へ結び付ける。UI対応の直接参照と明示N/Aが同じ文書に混在する場合も、その宣言列を残して局所検査へ渡す。既に正しい単一選択へ正規化されたように扱わない。自由文の振る舞いから状態遷移を生成せず、機械的な対応評価は明示参照・出現・対象集合を使う。自由文の意味的充足は必要なレビュー結果として別に扱う。

SemanticのUI／SPEC入口は、UiDefinition列・SpecDefinition列とSpecIndexを受け取る。対応集合の生成・重複検出・閉包比較はSemanticが所有し、Checkerが作った比較用集合を受け付けない。Filesystemの実在・Directory集合の照合は混ぜない。Architecture入力・Quality目標・明示Semantic表の受付は下記の工程モデルへ接続する。Reality／品質Gateはそれぞれの観測モデル・固定確認結果を受け、本文の宣言から完成状態を生成しない。

### Source・公開契約・実装Gate

工程のtypes.tsが概念モデル、解析のSourceがその構築、validation.tsがモデルの局所規則を所有する。純粋な解析にparse.tsを使うことはできるが、実際の保存CRUDがない工程へ空のcrud.tsや中継operations.tsを設けない。共通の本文・位置・参照解析はArtifact内部に置き、工程別の語彙・固定項目は工程Ownerに残す。新しいcommon/・Root Helper・基底Class・モデルRegistryは作らない。

公開の中心は、工程モデルを返す完成した構築／読取り操作と、そのモデルを消費する横断評価である。取得済み本文から構築する純粋な入口と、Repository読取りを同時に公開するかは実Consumerの必要性で決め、数を合わせるために両方を作らない。具体名・field型は次の対応が閉じたものから確定し、全内部型をRootへ再exportしない。

1. ひな型の明示内容→モデルの値・出現列・出典→既存規則→本番Consumer→反証試験を対応付ける。
2. UI／SPECを同じ取得単位から構築し、局所検査がモデルを利用する。旧文字列検査を新型の裏でそのまま独立再実行する実装を完成としない。
3. Semanticをモデル入力へ接続し、Checkerの本文解析・比較用集合の組立てと不要な部分Parserを撤去する。旧／新契約の二重受付や互換Adapterは新設しない。
4. 既存の受理・拒否条件、診断順・位置、部分情報、参照解決・取得範囲・保存の保証を試験へ対応付ける。モデル化だけを理由に条件を強化・緩和しない。
5. 同じモデルをSemantic・Reality・品質確認へ利用できることを必要範囲で検証する。独立確認・実体観測・固定改訂の未接続を局所試験成功で代替しない。

### UI／SPEC定義の実装対応

| 値・規則 | SourceのOwner | 利用側・保証 |
|---|---|---|
| 名前付き内容、期待ID、宣言、参照、出典 | ui/types.ts、spec/types.tsと各parse.ts | 各節は出現列。欠測は空列、空本文・重複節は個別に残す |
| 節本文、表のCell列、参照の位置 | artifact/types.ts、artifact/markdown.ts | 表Header・Separatorも原文の行として残す。先頭改行の位置と各表行の位置を区別する |
| UIの一意節、SPECの先頭節、先頭pairs_with、正式入力・受入対応 | 各validation.ts | モデルの局所検査。旧includesの構文出現はsyntaxTokensとして実際の節と分け、節を捏造しない |
| Checklist | 各parse.tsから既存エンジン | 契約Issue→Checklist Issue。モデル内にIssueを埋め込まない |
| 部分結果、宣言IDの不一致 | DocumentResult、expectedIdentityとdeclarations | 違反時もpartialのモデルを保持。関係の相関は列挙元の期待IDを使う |
| UI／SPEC対応 | semantic/relations.ts | partialの取得済み参照も比較し、局所違反だけで捨てない |
| 取得・診断配送 | Checker repository/ui.ts、spec.ts | 読取り順を保持。SpecのUI対応取得ではUI全体の局所診断を追加配送しない |

parseUiDefinition／parseSpecDefinitionはDocumentResultを返す完成入口であり、旧inspectUiDefinition／inspectSpecDefinitionと部分ParserのparseUiSpecPairsは残さない。自由記述の条件・振る舞い・回復は出典付き本文であり、実行可能な状態機械や自動的な品質成立を意味しない。モデル自体の保存・新しいHash・別Storeは追加しない。

### UI／SPEC分析モデルの接続

parseUiAnalysis／parseSpecAnalysisは、期待IDからUX／IA観点を選び、UiAnalysis／SpecAnalysisと局所診断をDocumentResultで返す。観点ごとに異なる内容を判別型で持ち、他観点の結論を補完しない。旧inspectUiAnalysis／inspectSpecAnalysisとSpecAnalysisModelは撤去し、既存のparse.ts・types.ts・validation.tsを利用する。

| 観点 | UI分析が保持する内容 | SPEC分析が保持する内容 |
|---|---|---|
| 共通 | 正式入力、処置、統合時の論点、未確認事項、検証意図、宣言と期待ID、参照と出典 | 同左 |
| UX | 引き継ぐ成果、認識・操作・Feedback、状況による体験差 | 引き継ぐ成果、観測する契機・結果・失敗、受入条件と適用範囲 |
| IA | 情報構造、優先順位・Navigation、表示差・開示境界 | 利用場面の意味、対象・識別・関係、状態・可視性・時間、導線・責任・失敗時の保持 |

各節は重複を消さず本文・表行・位置を保持する。DocumentSection.boundaryは次H2で閉じるか文書終端で閉じるかの構文情報であり、工程名や品質判断を持たない。UI分析は正式入力・処置の一意節を使う。SPEC分析は先頭節を使い、正式入力のみ次H2を必須とし、処置はEOFを許可する。正式入力の旧判定は、UIの表示ID／リンク先IDの独立照合、SPECの期待Path文字列の存在確認、節本文全体の禁止参照検査を維持する。targetsは選択条件に一致する参照の出現列であり、UIは重複を後段へ渡し、SPECは局所でも重複を拒否する。

分析・定義モデルのsourceは、同じ取得のPath／contentを独立捕捉した原文である。CRLF・コメント・Fence内の図や例を失わず保持するが、検査・参照抽出は従来の可視本文を使い、図の意味を推定しない。取得済み原文を診断・ログ・Semantic Bundleへ自動出版しない。CheckerはSPEC分析・定義・UI対応の同じ読取り点で原文を渡し、追加読取りや診断配送順の変更を行わない。

UIの既存関係評価は分析モデルと定義モデルを受け、比較用関係は評価Ownerが導出する。SPECの同工程被覆に必要な既存の関係列はtargetsから導出する。部分モデルを捨てず、期待IDで相関する。BHV本体とその他の横断評価までモデル入力へ統一したとは扱わない。

### 登録台帳・Detail統合台帳の接続

| モデル | 内容 | 完成入口と評価 |
|---|---|---|
| UiIndex | 登録名、Definition参照、UX／IA入力ID、出現行と出典 | parseUiIndexがモデルと行別Issueを返す。登録被覆・関係評価はentriesを利用する |
| SpecIndex | 登録名、Definition参照、UX／IA／UI入力ID、件数宣言と出典 | parseSpecIndexがモデルと重複Issueを返す。SemanticはモデルからUI対応集合を導出する |
| UiDetailIndex | Definitionごとの適用処置・領域・SCR／PRT・理由・出典、抽出成立した対応索引 | parseUiDetailIndexで構築し、UIのinspectUiConsistencyのui_detail_coverageで期待定義集合と照合する |
| SpecDetailIndex | Definitionごとの適用処置・BHV・理由・出典、抽出成立した対応索引 | parseSpecDetailIndexで構築し、SPECのinspectSpecConsistencyのspec_detail_coverageで期待定義集合と照合する |

登録台帳は既存の厳密な行構文を満たす出現だけをentriesへ採用する。名前・参照・入力ID・生Cell・位置を保持し、空白や列を正規化してから新たに登録しない。tableRowsは既存の表行分割で得られる全行であり、未認識行をentriesから消したことと原文から失ったことを同一視しない。原文sourceも保持する。parseUiIndex／parseSpecIndexのresultは常に取得済みモデルで、局所違反があってもpartialのモデルを利用できる。SpecIndexの件数宣言は最初のHeaderと直後Separatorに続く列数の合う連続行だけを使い、値を数値へ補完しない。

Detail台帳の構築と被覆検査は異なるConsumerのために分ける。SPECの関係組立てではUI対応索引だけが必要であり、UI被覆診断を追加配送しない。旧parseUiDetailBindingsを撤去し、同じ読取り点で完成したUiDetailIndexのbindingsを利用する。構築は行不正でも内容と抽出可能な対応を残し、検査は従来の行条件・重複・集合条件・Canonical宣言を一つの既存診断へ評価する。行ごとの新しい一対一対応や診断の二重配送を追加しない。

bindings／behaviorsは最後の抽出成立行だけで更新する。後続行に必要なIDが欠ければ前値を保持し、各CellのSCR／PRT／BHVは最初の一致を使う。適用処置や理由が不正でも抽出成立した対応を捨てない。Canonicalは本文中の宣言であり、旧includesの受理を独立検証済みの証明へ昇格しない。

旧UiIndexModel／UiRelationsModel／SpecIndexModelは撤去済みである。各工程のtypes.ts／parse.ts／validation.tsとSemanticの関係評価を使い、Facade・保存Schemaの追加は行わない。統合台帳の成立からDetail全体完成を主張しない。

### Screen／PartとDetail対応根拠の接続

| モデル | 内容 | 現在の本番利用 |
|---|---|---|
| UiScreen | 目的・入口／終了、Composition、Partの意味・情報・操作・状態、Interaction、State／Variant、Accessibility、昇格・未確認事項、対象UI・期待Screen IDと宣言、表行・原文・出典 | parseUiScreenが従来のScreen読取り点で構築し、Semanticが明示関係を利用する |
| SpecDetailCorrespondence | 対象範囲、UI→BHV／BHV→UIの被覆、N:N関係、Gap、引渡し、完全に抽出した対応行・宣言・原文・出典 | parseSpecDetailCorrespondenceが同じ対応文書の読取り点で構築し、Semanticが比較する |

PRTは現行ひな型・正本では独立part.mdではなくScreen内のCompositionとInteractionへ記載される。UiScreen.partsは完全なPRT IDの構成行を保持し、Interaction KeyをPart宣言へ混ぜない。Cellは既存Markdown分割規則を使い、backtickを含む原表記はsourceと行位置から確認できる。図・コメント・CRLFも原文へ残すが、参照抽出へFence内を追加しない。

対象UIは可視本文全体の最初の旧構文一致を使い、節限定・厳密Link検査へ強めない。Screenの関係行は全表行から最初のRelation Key／BHVを捕捉し、対象UI欠測でもモデル内の行を捨てない。評価時には対象UI不在のScreen関係を旧どおり空とし、tupleのScreen IDは本文宣言でなく列挙元の期待IDを使う。新しい欠測・不一致診断は追加しない。

Detail対応根拠はひな型と現行正本の節名が異なるため、対象範囲・Gap・引渡しの既存両形を位置付きで捕捉する。正本文書やひな型を改名しない。比較用の完全対応は旧どおり節外を含む全表行から最初のIDで取得する。Pass・確認文言は構文出現として扱い、独立した品質PassやChecklist全項目の成立へ読み替えない。

inspectDocumentRelationsのui_spec_detailsは、Screen列・Detail対応モデル・両Detail統合台帳モデル・SpecDefinition列を受け取る。期待tupleと一意なDefinition対応件数はSemanticが同じモデルから導出し、後勝ち・重複・集合・件数と既存確認文言を一つの旧診断へ評価する。旧parseSpecScreenRelations／inspectSpecDetailCorrespondenceと、Spec内部の部分対応Parserは撤去する。下流Owner比較のui_spec_downstreamも同じ両Detail索引・SpecDefinition列からSemanticが期待Mapを導出する。Checker製の期待Mapと旧inspectSpecDetailDownstream／SpecDetailDownstreamRequestは撤去した。ARCH定義／領域はArchitectureDetailAssignment、QA定義はQualityDetailAssignment、両中央表はArchitectureDetailTrace／QualityDetailTraceで渡す。旧3部分Parser・型は撤去した。

工程Checkerは固定配置に存在するAREA・CMP・Visual Baseline・BHV本文を各完成Parseへ接続し、既存の局所Checklist診断を配送する。文書の新規作成義務、任意再帰探索、ID・表・自由文の新しい意味検査は追加しない。ScreenはSPECの既存読取り位置で局所Issueを配送し、同じ解析結果を関係比較にも渡す。モデル接続から自由文全体の解釈・実装・品質検証成立を主張しない。

### Architecture登録台帳の内容モデル

`parseArchitectureIndex()`は取得済み原文と相対Pathを受け、横断登録と定義台帳を同じ文書へ統合する。registryはArtifact・全表行・台帳節の出現・位置付き登録行を`ArchitectureRegistryModel`へ保持する。登録行は表に限定せず、先頭の正確な台帳節にある各行の最初の定義Linkと全UI／SPEC出現を対応付ける。集合と出現列、重複、欠測と空節を分け、同名の後続節や不正行も原文・構造観測へ残す。登録モデルは実在・完成・品質合格の証明ではない。

Checkerは従来の登録評価前の再読取りを原文として捕捉し、その取得から横断登録モデルと台帳モデルを構築する。冒頭のReady判定用取得との統合や同版保証は追加しない。既存の被覆・関係診断は同じ投影を使用する。

### Architecture横断・詳細とQualityの内容モデル

| モデル | 内容と後続利用 |
|---|---|
| ArchitectureCrossModelIndex | 原文、横断登録節の全出現、全表行。先頭節が非空なら従来の固定五文書を取得対象とする |
| ArchitectureCrossModel | 固定文書名、原文、可視行、Fence保持の構造節、全表行。可視見出しと構造断片を別に検査する |
| ArchitectureDetailMapModel | 領域節・閉包節の全出現、原文・出典、領域・二種類の関係集合 |
| ArchitectureDetailModel | 原文・領域・関係、適用判断・Concern・実装構造・品質引渡し・Checklist、明示Semantic表のraw捕捉 |
| QualityAnalysis | 原文・出典、全件Coverageと検証目標統合節の全出現。後続の関係評価へモデル列を渡す |
| QualityIntegration | 原文・出典、横断モデルと詳細領域の処置節。二節の異なるEOF条件を維持する |
| QualityDefinitionModel | 期待QA-ID、原文・出典、情報源・詳細入力・条件適用・項目・段階適用・追加種別の節、関係列・Map、明示Semantic表とLocal Itemの実行形態 |

Architectureの旧四検査入口とQuality定義検査は対応するparse入口へ置換した。内容モデルと診断はDocumentResultのresult／issuesへ分離する。Quality分析は内容の捕捉とモデル間の関係評価を分け、旧parseQualityCoverageSectionsは撤去した。新File・互換Wrapperは作らない。各文法の行filter、単純Pipe、先頭行除外、先頭／後勝ち、重複列、部分値と診断順を維持し、一般Markdown表の読取りへ一律化しない。モデルは取得値であり、宣言されたCovered／PASSは実体や検証成功の証明ではない。

### Semantic・Reality・品質Gateの受付

UI／SPEC自身の分析網羅性・登録・定義関係・Detail被覆は、それぞれ既存validation.tsのinspectUiConsistency／inspectSpecConsistencyとtypes.tsの閉じた入力契約が所有する。Semanticの旧八caseと六つの局所Helperを撤去し、SPECの出現重複は同じ式を持つ既存hasDuplicateへ統合する。UI–SPECの対応・Detail対応・下流担当・EvidenceはSemanticへ残す。Detailの局所被覆Issueがあればそれを優先し、新たな重複診断を足さない。本文再取得・取得断面統合・新しいI/Oは行わない。

UI Detailの期待定義集合は取得済みUiIndexから、SPECの登録集合・分析／定義の関係列・件数表はSpecIndex／SpecAnalysis／SpecDefinitionから、各照合Ownerが導出する。Checkerは比較用文字列を組み立てない。実体観測によるID集合と五種類の件数はCheckerが渡し、特にSPEC分析件数を解析成功数やモデル列長で代用しない。部分モデル・入力順・重複出現・Setの先頭順、件数表の整数解析と後勝ちを維持する。モデルを受ける同工程の複数文書照合は単体Parseへ押し込まず、独立した完成操作として公開する。

UXの登録数は取得済みUxIndexの原文と分析の期待Identityから、旧文字列一致式で導出する。構造化リンク数やPath正規化へ置き換えない。UXとJourneyの閉包はUxAnalysisModel列とUxExperienceMapから導出し、Checkerの関係Set組立てを要求しない。Experience Map欠測はnullで受け、比較内で従来の空関係へ対応するが、読取り例外を欠測へ変換しない。正式入力の参照解決・境界確認と、実在ID集合は引き続きCheckerの観測責務とする。

UX分析・定義の被覆は既存inspectUxConsistencyのux_analysis_coverage／ux_definition_coverageが所有する。UX分析へは上位がDiscovery採用REQの期待集合を搬送し、UXはDiscovery型を参照しない。Discovery自身の採用要求対実在定義はinspectDiscoveryCoverageがDiscoveryIndexと観測ID集合を受ける完成比較として所有する。単体Parseに外部観測を混ぜず、Semanticや汎用Validatorの分岐へ押し込まない。三比較とも旧件数差と期待側包含、空集合の受理、元の診断Pathを維持する。追加RootはDiscoveryの一関数だけで、新しい公開型は追加しない。

Architecture内の八比較は既存architecture/relations.tsのinspectArchitectureConsistencyが所有し、閉じたArchitectureConsistencyRequestを受け付ける。分析・定義・詳細のReady、登録・Component・関係・領域閉包、横断文書と詳細Map、分析入力の比較を行う。Semanticの旧八caseと局所Helperは撤去し、転送しない。件数比較とDirectory Identity比較は別条件のままとし、取得済み集合からRepository全体の実在を保証しない。モデル宣言への参照はimport typeで、validation.tsへの実行時逆依存を作らない。

architecture_relationsは分析・定義モデル列と登録モデル、architecture_detail_coverageは詳細Map・本文モデル列と実在領域／定義集合を受ける。比較用のSet・出現列・Covered集合はArchitecture Owner内で元の式から導出し、Callerへ組立てを要求しない。Mapのnullは従来の空の登録・関係集合に対応するだけで、欠測診断やReady時のCovered拒否を省略しない。モデル内と文書間の出現順・重複、Set初出順、部分関係、三つの詳細不整合の順序を維持する。

compileSemanticIrはArchitectureDetailModel、compileQualitySemanticRelationsはQualityDefinitionModel列を受け取る。明示表の構造捕捉は工程Ownerへ戻し、SemanticはCell・出典・モデル間の意味参照を評価する。従来Semanticが対象にしたraw本文（コメント・Fenceを含む）と、Architecture局所検査の可視本文を混同しない。原文Hashは同じraw文字列から生成する。未使用となったSemanticSourceDocumentのRoot公開を撤去した。

QualityのIdentityは従来どおりSource Pathから評価し、期待ID・本文宣言で不正Pathを補完しない。Local IDのexact出現数、実行形態表の最初の表と最初の一致行、不明はnullという条件を維持する。工程Parserの局所IssueはSemanticのIssueと別であり、一方の結果から他方を省略しない。Checkerは既存の観測位置で取得した値からモデルを構築し、読取りの追加・統合をしない。

Qualityの定義閉包は定義モデル列・既存の工程分析結果・統合モデル、GoalとLocal Itemの閉包は定義モデル列・統合モデル、横断Goal処置は工程分析結果を受ける。比較用Set・出現列・条件MapをCheckerに組み立てさせない。定義の集約は`quality/validation.ts`の内部処理が所有し、Quality比較と下流Semanticが同じ実装を使う。文書順・出現重複・Set初出順・Map後勝ち・段階Setの独立複製を維持し、partialを除外しない。各比較で独立に集約するため、一回集約の保証や永続Cacheは持たない。Local Item所有者の先勝ち照合は別の契約として維持する。

Quality分析結果のhasCoverageSectionsは、渡された各分析モデルの先頭Coverage節が取得できていることだけを示す。Checkerは先に六工程の分析Fileを確認する。空のモデル列を全工程の観測完了とは扱わない。節が揃わなくても集約・照合を停止せず、正本外の既知ID、取得済みCoverageから情報源関係への不足、既知の要求段階の不足、重複・不正処置・定義とDetailの照合を継続する。欠測があるときは逆方向の不足・全体件数・未知Goal名・全Goal集合の一致を保留し、欠測を空表として不一致を生成しない。節が存在するが内容が空の表と、節自体の欠測は区別する。既存Issueの分類・正常時の順序は維持し、公開関数・型の追加は行わない。

Reality Graphは観測済みManifest・実在ID／試験台帳・前提Issue、Semantic CoverageはIR・Quality関係・Symbolモデルを使う。品質Gateは固定改訂版・必須確認集合・同版の確認結果を使う。これらへ本文を直接読む入口を足さず、記載上のReady／PASSからverifiedや実装済みを発行しない。

### Architecture分析・定義の内容モデル

parseArchitectureAnalysis／parseArchitectureDefinitionは`architecture/parse.ts`で原文を捕捉し、DocumentResultのresultへ内容モデル、issuesへ局所診断を分ける。旧ArchitectureBodyModelとinspectArchitectureAnalysis／inspectArchitectureDefinitionは撤去した。局所違反でもモデルと関係出現を保持し、モデル自身へissuesを置かない。対象文書固有の型は `architecture/types.ts`、Checklistの期待集合は `architecture/validation.ts`、組合せの整合評価は `architecture/relations.ts` が所有する。

| モデル | 保持する内容 | 評価に使う既存断面 |
|---|---|---|
| ArchitectureAnalysis | Artifact・原文・期待Identity・UI／SPEC観点・宣言・全表行、正式入力、継承契約、設計、九観点評価、処置、統合時確認、Checklist | exact見出しの先頭節・九行の閉じた判定語彙・正式入力境界・関係出現・Ready条件 |
| ArchitectureDefinition | Artifact・原文・期待Identity・宣言・全表行、責務、両入力、統合、構造、データ、失敗、品質、未確認、移行、引渡し、現行照合、Checklist | 入力別関係、未確認表の集合・重複・列条件、構造断片、説明用PlaceholderとReady条件 |

同じexact見出しの全出現と出典を保持し、評価では旧どおり最初の節を選ぶ。未確認表・九観点表は最初のHeader／直後Separatorを要求し、途中の列幅不正はnullである。SPEC対応表の打切り条件と統一しない。nullでも原文・節・全表行には部分内容を残す。syntaxTokensは旧includes条件の断面として使い、新しい受理・拒否規則を追加しない。

Checkerは1回目の原文readと2回目のChecklist readを維持し、後者の理由を別入力として渡す。同一改訂の一括Snapshotを主張しない。ArchitectureのinspectArchitectureConsistencyはpartialを含む分析モデル列からUI／SPEC分析済みIdentity集合を導出し、物理Directory集合・実在ID件数はCallerの観測値を維持する。局所モデルのcompleteは既存検査範囲だけの成立であり、Architecture Ready・独立レビュー・実装や全品質の成立ではない。

通常BHV本体は既存の完成Parserへ接続済みで、局所Checklistの不備を返す。通常Screenも既存の取得結果から局所Issueを返す。公開境界の全件棚卸しは第2節と変更計画に記録し、未接続の独立Capabilityを本番接続済みとは扱わない。

### Discovery・UX・IAの本文モデル

主要本文の入口はparseDiscoveryAnalysis／parseDiscoveryDefinition、parseUxAnalysis／parseUxDefinition、parseIaAnalysis／parseIaDefinitionである。原文・Artifact・期待Identity・名前付き本文節の全出現・表・出典と部分関係をresultへ、局所診断をissuesへ分離する。既存の検査入口と互換Wrapperは残さない。新しいモデル名は正本Moduleに置き、現在のConsumerが明示型を必要としないものをRootへ一律追加しない。

| 工程 | モデルが保持する明示内容 | 維持する検査断面 |
|---|---|---|
| Discovery分析 | きっかけ、問題、仮説、選択、学び、採用要求の記載、引渡し、補足、Checklist | raw種別・期待ID、可視で評価済みChecklist。自由文の採用判断を生成しない |
| Discovery定義 | 要求、対象、変化、採用根拠、成立条件、リスク・対象外、未確認、検証意図、引渡し、関係、全探索参照 | raw必須文言・Placeholder、最初のEXP参照の表示ID／Path ID、構造不正後も続けるChecklist |
| UX分析 | 一次分析、利用者・成果、変化、統合、重要体験、引渡し、Checklist、REQ–UX／Journey関係 | raw文言・図・表、処置語彙・Same比較・責任表・Blueprint処置。台帳Link出現数との比較はSemantic |
| UX定義 | 利用者成果、変化、成立条件、体験・品質期待、境界、未確認、検証意図、引渡し、関係、raw状態宣言 | 状態宣言の出現数、Canonical／Superseded、旧Handoffの正確な集合、診断順 |
| IA分析 | UX入力、情報候補、状態・可視性・責任、実装参考、処置、引渡し、補足、Checklist、Object／Identityと対応列 | 可視本文のexact一意節、旧表文法と対応規則、不正でも抽出可能なObjectと関係 |
| IA定義 | 意味、対象・識別・関係、状態、情報のまとまり・責任、失敗、検証意図、引渡し、入力、補足、Checklist、対応列 | 通常の可視本文とFence保持の構造行を区別する。分析Object・Identityとの比較は捕捉済みの証拠をSemanticへ渡す |

名前付き節は内容捕捉であり、新たな必須見出しを発行しない。Discovery／UXのraw includes条件を厳密な節存在や可視Artifact値で代用しない。IAのexactSecondLevelSectionは「見出しが厳密に1件」のままで、モデルが保持した全出現の先頭へ置換しない。欠測／重複のnullと唯一存在する空節を区別する。Parserは局所違反でもモデルを返し、partialを実在・採用・品質成功へ読み替えない。

### 台帳・横断投影と詳細引渡し

| 入口・Owner | 保持内容・既存の評価断面 |
|---|---|
| parseDiscoveryIndex | raw登録行のID・採用記載・出典・重複、採用ID集合。採用は旧行頭・採用セルincludes条件の記載観測であり、新しい採否判断ではない |
| parseUxIndex | raw登録行・出典・重複、UX IDと二列目のREQ関係。集合は出現行から導出し、本文を繰り返し解析しない |
| parseUxExperienceMap | rawのJourney行・外側の空Cellを含む列・REQ参照・出典と関係集合。最低7Cell・REQ列5という専用文法を維持する |
| UX四横断文書のprojection | 文書別Parseが固定対象節・原文・表・ID全出現と集合を保持し、inspectUxConsistencyのux_projectionが被覆を比較する。見出しは旧indexOfであり、exact H2へ強めない |
| IA三横断文書のprojection | 文書別Parseが原文・4／5節の全出現・一意条件の選択本文・ID出現を保持し、inspectIaConsistencyのia_projectionが被覆を比較する。4節がnullの場合だけ5節を使い、空節を欠測へ畳まない |
| ArchitectureDetailModel.qualityHandoff | rawの品質引渡し節・表行・出典、領域別の検証単位・試験段階・境界の後勝ちMap。可視qualityHandoffSectionsとは別の断面である |

旧parseAdoptedDiscoveryRequirements／parseUxJourneyRelations／isUxProjectionIncomplete／inspectIaCrossProjectionは内容Parserへ置換し、旧parseQualityDetailHandoffは撤去した。Rootに互換名・Wrapperを残さない。UX投影のDomain IssueはCheckerの従来code・文言・相対Pathへ同じ位置で配送する。

Architecture詳細のraw引渡しは「引渡し／引き渡し」の二表記、次H2必須・EOF非対応、最初の節、単純Pipe、試験段階列5・境界列6を維持する。複数境界の選択は固定候補列の最後であり、本文出現順ではない。Quality Consumerは従来の同じ一回のreadからArchitectureモデルを構築し、qualityHandoffだけを使う。ここで追加のArchitecture局所Issueを配送したり品質成功を判断したりしない。旧引渡し試験の観点はArchitectureの既存Suiteへ移し、削除しない。

### Quality状態・共通文書断面とUX引渡し

| 入口 | モデルと評価範囲 |
|---|---|
| 各Quality文書Parseの共通内容 | rawの状態宣言・Local Item数宣言の全出現と先頭値、原文・Artifact・全表、可視の先頭ChecklistからEOFまでの内容と未完了flag。種別・方式を明示した受付ではChecklistの期待列と失敗理由も保持 |
| parseQualityCenter | QualityDocumentと、宣言状態の既存正規化・有限状態・Design Ready／Quality Readyの分岐条件をresultへ、局所Issueをissuesへ分離 |
| parseQualityRealityAudit | Reality自身の状態・件数・本文と局所診断。Centerとの状態対はQualityのinspectQualityConsistency（quality_reality_state）が比較し、未知Center時は状態対不一致を追加しない |
| UX分析・定義・台帳のhandoffContract | 各完成Parseが内部構文処理を使い、原文・出典・選択節・全label出現・比較対象列・期待列と局所validを保持する。独立のRoot受付は設けない |

QualityDocumentは現行Consumerが共有する状態・件数・Checklistの具体的な断面であり、全品質文書を一つの任意Property集合へ平坦化するものではない。新File・汎用Runner・Facadeを作らない。宣言件数の最初のraw行と旧Number.parseIntを維持し、重複拒否・可視化・安全整数上限を追加しない。Checklistは可視本文の最初の正確な見出しからEOFまでで、次H2では閉じない。状態宣言の採用はraw先頭一致であり、可視Artifactの状態を代用しない。

Checkerの初回Artifact集合読取り→Canonical状態診断→各Checklist再read、Center初回本文と後のReality再readを維持する。件数は観測済みOwner集合の件数とモデル値を直接比較する。旧hasQualityOpenChecklist／isQualityLocalItemCountInvalid、旧Center／Realityの状態検査入口は撤去し、後者は内容Parserへ置換する。Ready宣言の解析やhasOpenChecklist=falseを品質Gate成立へ読み替えない。

UX引渡しは旧indexOfで選択し、contractはH2／H3終端・Header二種除外・四label順、rootはH2終端・Header一種除外・関連label選択・三label順を維持する。rootの非対象labelもモデルのentriesには保持する。欠測節はnull、存在する空節は空内容とし、ともにvalid=falseである。UX分析・定義は同じ捕捉モデルをhandoffContractへ保持して既存の包括診断に使い、二重の診断を発行しない。Template／Rootの別readと文脈別の既存文言も維持する。旧二Boolean入口と旧実装は残さず、validは当該表構造の成立だけを表す。

### UI・SPECの文書別完成Parseと工程間比較

| 文書 | 完成Parseと内容モデル |
|---|---|
| UI分析・定義・台帳 | parseUiAnalysis／parseUiDefinition／parseUiIndex |
| UI Detail台帳・画面 | parseUiDetailIndex／parseUiScreen |
| UI領域・部品・Visual基準・引渡し | parseUiArea／parseUiComponent／parseUiVisualBaseline／parseUiHandoff |
| SPEC分析・定義・台帳 | parseSpecAnalysis／parseSpecDefinition／parseSpecIndex |
| SPEC Detail台帳・振る舞い | parseSpecDetailIndex／parseSpecBehavior |
| UI／SPEC対応文書 | parseSpecDetailCorrespondence／parseSpecDefinitionCorrespondence |

各文書のParseは、独立捕捉した原文・Artifact・表・名前付き節・参照と出典、Checklistの期待列・失敗理由をresultへ、局所診断をissuesへ返す。分析・定義・Screenは列挙元の期待IDを受け、Checklist対象は明示したtemplate／evaluated方式を使う。既定はevaluated。ひな型は旧Checklist条件だけを評価し、新しい通常ID・Placeholder拒否を追加しない。UIの一意節とSPECの先頭節、raw／可視／Fenceの断面、短い不正行、重複出現と最後に抽出成立した対応Mapを維持する。

Detail台帳では行・重複・Canonical宣言の局所条件をParseが所有し、外部の期待定義集合との被覆・Screen／Part／BHV件数は各UI／SPEC Ownerが所有する。inspectUiConsistencyのui_detail_coverage／inspectSpecConsistencyのspec_detail_coverageは完成Parse結果と実在集合を受け、局所と被覆が併存しても旧combined診断を一件だけ返す。Checklist診断をこの既存被覆経路で新しく追加配送しない。同工程の分析・登録・閉包比較も、それぞれ同じOwnerのui_analysis_coverage／ui_index_coverage／ui_relationsとspec_analysis_coverage／spec_definition_coverage／spec_coverageへ統合する。

Checkerは各文書を対応Parseへ渡し、既存の局所診断と関係診断の位置・順序を維持する。SPECが参照用に読むUIモデルの局所Issueは追加配送しない。Definition根拠はFingerprint用読取り後、各ペアを新しくreadして直ちに評価し、短Cell例外後に後続ペアを先読みしない。AREA／CMP／VisualはUI関係評価後、BHVはSPECのDefinition根拠評価後に、固定配置に存在する通常本文を一回ずつ読み、各Parserの既存局所Issueを配送する。不在・非対象配置を新しい欠落として扱わず、Linkをたどらない。生の工程診断順と公開レポートの整列順を区別する。

旧部分parseUiDocument／parseSpecDocumentと工程別の公開inspectUi*／inspectSpec*は撤去し、spec/details.tsも残さない。互換Wrapper・新しいReader・Store・Registryは設けない。Architectureの部分Checklist受付も撤去し、下記の完成Parseへ統合した。共通Checklist構文エンジンは内部だけで利用し、構造成立を品質Pass・認可へ読み替えない。

### Discovery文書のChecklist受付

Discoveryの公開入口はparseDiscoveryIndex／parseDiscoveryAnalysis／parseDiscoveryDefinitionと三つの文書モデル型、および任意Markdownの参照受付parseDiscoveryReferencesである。discovery/parse.tsが内容・出典を捕捉し、types.tsがモデル、validation.tsが固定三種類のChecklistと捕捉済みモデルの局所検査を所有する。部分Checklist受付parseDiscoveryDocumentの宣言・Root公開は撤去し、互換Wrapperを残さない。

各Parseは原文・Artifact・全表・内容・Checklist条件と失敗理由をresultへ、局所診断をissuesへ返す。modeは明示的なtemplate／evaluatedで、既定はevaluated。通常の分析／定義はraw構造→可視Checklistの順、ひな型は従来のChecklist条件だけを検査し、通常用のID・種別・Placeholder拒否を追加しない。分析／定義のraw Checklist節を可視断面で上書きしない。台帳はraw行頭・採用セルsubstring・最初のID・Set初出順を保持し、Checklist不備でも採用集合や内容を失わない。期待列は受付ごとに独立し、構造成立を採用・品質Pass・認可へ変換しない。

CheckerはRootとTemplateの局所Issueを同じ位置で既存診断へ変換する。後段の採用REQ取得は別readを維持し、モデル値だけを使ってChecklist Issueを二重配送しない。基本図経路も台帳モデルのdiagramContractだけを使い、別のChecklist Issueを追加配送しない。Root読取り前のearly return、Template不存在時skip、実際のread・診断順とUXの観測経路は変更しない。公開部分Parser・期待列取得API・新しい観測や保存は設けない。

### UX・IAの文書別完成Parse

UXは台帳・想定利用者・利用の流れ・サービス提供の流れ・品質期待・分析・定義の七文書、IAは台帳・Object関係・情報構造とNavigation・状態可視性・分析・定義の六文書を各一つのParseで受け付ける。文書種別をPathから推測せず、対応するParserを呼ぶ。公開入口と型は次のとおりである。

| 工程 | 文書別の公開Parse | 文書モデル |
|---|---|---|
| UX | parseUxIndex、parseUxPersonas、parseUxExperienceMap、parseUxServiceBlueprint、parseUxQualityExpectations、parseUxAnalysis、parseUxDefinition | UxIndexModel、UxPersonas、UxExperienceMap、UxServiceBlueprint、UxQualityExpectations、UxAnalysisModel、UxDefinitionModel |
| IA | parseIaIndex、parseIaObjectRelation、parseIaStructureNavigation、parseIaStateVisibility、parseIaAnalysis、parseIaDefinition | IaIndexModel、IaObjectRelation、IaStructureNavigation、IaStateVisibility、IaAnalysisModel、IaDefinitionModel |

両工程ともparse.tsが原文・Artifact・全表・名前付き節・内容・出典と局所診断、types.tsがモデル契約、validation.tsが非公開の固定Checklistと局所文法を所有する。UXのhandoff.ts・inputs.tsは複数の完成Parseで使う内部の具体的な構文処理であり、単独のRoot受付ではない。部分Checklist受付・Handoff／参照候補の部分Parser・外部集合を受け取る投影Parserと独立比較のRoot公開を撤去し、互換Wrapperを残さない。

modeはtemplate／evaluatedを明示でき、既定はevaluated。未知modeは拒否する。通常のUX分析／定義、IA分析／定義の既存局所診断順とChecklist失敗理由を保持し、ひな型では通常用のID・種別・Placeholder等の契約を追加しない。rawのUX内容、可視IA本文、Fence保持構造、可視Checklistを同じ断面へ平坦化しない。部分不備でも捕捉できたObject・Identity・関係・参照・引渡しを失わない。

UX分析は正式入力のHeader・期待リンク一致・禁止宣言と参照候補を捕捉する。参照候補のMarkdown→HTML→裸Path→Entity順、限定Decode、重複時の異常flag合成を維持する。referenceRootは裸のRepository起点Pathを組み立てるために呼出し側が明示する文字列であり、Root検証やFilesystem観測のAuthorityではない。Checkerは同じreadの完成モデルを再利用し、従来どおり参照解決・定義read・境界確認を行う。六観測との照合はUXのinspectUxConsistencyのux_formal_input、台帳の登録件数はux_analysis_registrationへ渡し、旧構造Issueと重複しない。正式入力診断→本文診断の順は変えない。

IA定義Parseは他文書の分析Mapを受け取らない。mappingKeysは文書内で有効な対応宣言であり、外部分析との成立済み対応ではない。mappingEvidenceは分析ID・Object名・対応key、identityEvidenceは参照Objectと記載Identityを保持する。IAのinspectIaConsistencyのia_definitionが実分析MapのObject存在・Identityを比較し、局所のdefinition-contract-invalidと同じ一件へ統合する。最終ia_relationsは実分析で受理できた対応列だけを使い、存在しないObjectの対応を閉包へ数えない。Mapの後勝ち、重複宣言、局所不備との併存を保持する。

UX内比較はinspectUxConsistencyのux_projection／ux_relations、IA内比較はinspectIaConsistencyのia_analysis_coverage／ia_index_coverage／ia_projection／ia_relationsへ接続する。UX投影は先頭substring、IA投影はexact一意節と4節null時だけの5節fallbackを維持する。Checkerの別read・lstat・不存在skip・短絡と診断順は変更しない。Checklistだけを観測していた位置ではその失敗理由だけ、後段投影では各UX／IA Ownerの被覆Issueだけ、基本図ではdiagramContractだけを使い、追加の局所Issueを二重配送しない。

<a id="architecture-quality-parse"></a>

### Architecture・Qualityの文書別完成Parse

| 文書 | 公開Parseと局所モデル |
|---|---|
| Architecture入口 | parseArchitectureIndex。横断文書の登録と定義台帳を同じ原文へ統合し、registryと局所診断を返す |
| Architecture分析・定義・領域本文 | parseArchitectureAnalysis／parseArchitectureDefinition／parseArchitectureDetail。内容・出典・局所IssueとChecklist条件を保持する |
| Architecture横断文書・詳細Map | parseArchitectureCrossModel／parseArchitectureDetailMap。固定文書の内容・構造、Mapの領域・閉包参照と追跡を保持する |
| Qualityの五つのRoot文書 | parseQualityCenter／parseQualityStrategy／parseQualityVerificationDesign／parseQualityIntegration／parseQualityRealityAudit |
| Qualityの分析・定義・検証結果 | parseQualityAnalysis／parseQualityDetailAnalysis／parseQualityDefinition／parseQualityVerificationResult |

各公開Parseは文書全体の取得済み内容をresult、文書内の不備をissuesへ返す。Qualityは共通の状態宣言・件数・可視Checklist・原文・全表を各モデルへ保持する。期待列の九種とArchitectureの通常／ひな型の六種は内部で所有し、Pathから種類を推定しない。方式はtemplate／evaluatedで、既定はevaluated。ひな型へ通常本文のID・構造・Placeholder拒否を追加しない。

Architectureの本文初回とChecklist二回目は別観測である。Checkerは元位置で二回取得し、Parseへ初回原文とoptions.checklistSourceを渡す。モデルはsourceとchecklistSourceを別々に独立捕捉し、Checklist理由を上位で計算して渡さない。Readyとの比較はarchitecture_readinessがモデルの未解決表現と局所Issueを一件の既存包括診断へ統合する。Detail Mapのヘッダーは局所、実在定義集合との被覆はarchitecture_detail_map_coverage、横断文書の本文構造は局所、Indexへの登録はarchitecture_cross_modelが所有する。

Qualityの分析Parseは一文書内の関係・条件・出現列・後勝ちMapをrelationDataへ、統合Parseは横断行・詳細検証単位・検証項目閉包をcrossModelRows／detailUnitData／localItemDataへ保持する。QualityのinspectQualityAnalysisは解析済みの複数モデルを順に合成して被覆・重複・閉包を照合する。本文を再解析せず、旧combined診断の位置と順を維持する。inspectQualityLocalItemOwnershipは完成QualityDefinitionModelの出典・localIdsと先行文書のOwnerを比較し、先勝ちMapと出現ごとの診断を返す。この二つは実Consumerが比較後のMapを必要とするQuality内部の完成比較操作であり、局所Validatorや互換Wrapperではない。

Qualityの状態対・Ready時の文書集合・分析／定義の目標・Local Item閉包はQualityのinspectQualityConsistencyが所有する。別工程のArchitecture実体集合・Detail単位・必要段階／境界との対応はSemanticが比較する。Reality自身の未知状態はParseで判断し、Centerとの状態対はquality_reality_stateが局所状態診断→状態対診断の順に返す。Center不明時には状態対診断を追加しない。原文の先頭状態・先頭件数とNumber.parseInt、hasOpenChecklistの先頭Checklist→EOF条件は維持し、一般Artifactの可視状態やChecklistエンジンの成功で代替しない。

ひな型の固定表現は完成モデルのtemplateContractへ統合する。Qualityの検証結果はraw、分析・統合は可視本文のsubstring条件、ArchitectureのDefinition／Areaは可視本文の既存条件だけを評価する。旧部分parseArchitectureDocument／parseQualityDocument、独立ひな型Parse、担当・追跡の部分ParserはRootに残さない。templates.ts等は完成Parseが実利用する内部の構文処理であり、互換受付は設けない。Qualityの旧relations.ts／state.tsは比較の移管後に撤去した。

Checkerは正常入力での元のlstat、read、Ready分岐、診断順と表示を維持する。QualityのCoverage欠測時は欠落エラーを残して独立検査を続行し、欠測情報に依存する比較方向だけを保留する。局所Issueが追加された完成Parseを相関取得や既存Checklist専用の位置で使っても、無関係な診断を新しく配送しない。登録表の局所重複と外部被覆も旧一件診断として元位置で扱う。図の断面はdiagramContractだけを使い、品質Passや許可を推定しない。

基本図の表構文はArtifact内部のparseDiagramDispositionが所有し、工程名・固定Path・期待図名・Discovery固有条件を持たない。期待図名はDiscovery／UX／IA／Qualityの文書受付、UI／SPECのRoot Index、Architectureの横断Indexがそれぞれ一か所で所有する。Discoveryの人間理解三条件もDiscovery内で判定する。内容モデルのdiagramContractは原文・全表・選択節・Header・採用前の全行・後勝ちMap・不足項目とIssueを保持する。Checkerは七つの観測Path、順序・存在確認・fallback・元のreadを所有し、diagramContract.issuesだけを従来表示へ接続する。Root Indexの既存status／issuesへ基本図Issueを混ぜず、基本図観測へ台帳Issueも追加しない。

raw、先頭節からEOF、Header直後の一行飛ばし、非Pipe行での停止、空名の非採用、重複後勝ち、不足理由順は維持する。適用されないDocument種別・方式のdiagramContract=nullは適合を意味しない。UI／SPEC／Architectureは既存Root Parserを使い、架空のChecklist index種別や追加APIを作らない。旧parsePhaseDiagramTemplates／phaseDiagramTemplatePathsのRoot公開とPathによる自動Profile選択は撤去した。観測対象外を新しい工程や適合へ補完しない。

Checklist定義の共通Catalogは廃止した。全47種類はDiscovery 3・UX 7・IA 6・UI 9・SPEC 7・Architecture 6・Quality 9として各工程が非公開で所有する。旧「UI／SPEC共用」の三種類も実体とConsumerで分類し、UI側引渡しはUI、対応レビューとDetail対応はSPECが所有する。工程間Import・定義の複製・期待列取得APIを設けない。旧Factory・Source・Root公開とSymbolの旧参照は撤去し、全47種類の項目・順序・派生列・受付間の独立性は維持する。基本図の工程別条件も各Root内容モデルへ接続し、共通構文と工程Owner・観測側を分離した。

### 識別情報と正本文書共通HeaderのOwner

| 処理 | Ownerとモデル境界 |
|---|---|
| parseArtifact(...).result.identity | Artifactが原文・全表・raw ID出現・Fence除去後の一般宣言・手動改訂・コードフェンス外リンクと出典を保持する |
| UX台帳の表宣言 | parseUxIndexが従来専用の行頭正規表現でidentityDefinitionsへ捕捉する。通常のentriesや一般宣言で代用しない |
| DiscoveryのREQリンク所有判断 | parseDiscoveryReferencesが任意MarkdownからArtifactModelとDiscovery参照だけの局所Issueを構築する |
| 定義所有の重複 | Semanticのidentity_ownershipがモデルから集約した宣言Mapを比較する |
| parseCanonicalDocument | Releaseが正本文書familyの全文・版・状態・Baselineと出典を捕捉する。一般Header読取りとRelated順序はArtifactに残す |

Identityの一般文法は共通Artifactに残すが、DiscoveryのPath判断とUX専用表規則を混在させない。Checkerは同じ本文取得からモデルを構築し、一般宣言の後にUXの専用表宣言を同順で集約する。raw出現の収集、adopterの00_CRDD除外、コメント・BOM・CRLF・Fence・重複・行位置・手動改訂Issueと所有重複Issueの順序は維持する。別のリンク観測readでは手動改訂Issueを追加配送しない。旧四つのIdentity補助公開を一つの内容受付と既存の関係評価へ統合し、互換Wrapperを残さない。正本文書の共通HeaderはReleaseの完成Parseへ統合し、部分Header ParserをRootに残さない。共通Headerの受理文法は維持する。

### Definition対応の八観点根拠

SPECのparseSpecDefinitionCorrespondenceは、原文・Artifact・全表行・対象改訂表・記録Fingerprint・正規対応行の出現と出典、各対応の先頭H3根拠節と八観点表を返す。表の最初の一致・直後Separator・列幅の連続条件と、H3で閉じず次H2又はEOFで閉じる旧条件を保持する。短い正規行もここでは補完・拒否せずモデルへ残す。

UI／SPEC Definitionは、対応根拠用の題名とexact見出しの先頭本文をcorrespondenceTitle／correspondenceSectionsへ出典付きで捕捉する。空節と欠測を区別し、一般的なSection捕捉と受理条件を一律化しない。両構築関数は局所違反でも捕捉したモデルを返す既存実態を戻り値型へ明示するが、partialを品質成立へ読み替えない。

| Owner | 入力と処理 | 維持する境界 |
|---|---|---|
| SPEC | 対応文書の取得済み原文→SpecDefinitionCorrespondence | 改訂の宣言は実測と別。未認識行も原文・全表へ保持する |
| UI／SPEC | 対応行ごとに取得し直した定義→各定義モデル | 最初の正確な題名・見出し、空・欠測・H3通過・H2終端を保持する |
| SemanticのevaluateDefinitionPairEvidence | 一つの対応行モデルと両定義モデル→invalid・訪問した理由列 | 両定義read直後に評価。八行・八観点の前提、every短絡と短Cell例外を保持する |
| Semanticのui_spec_evidence | 対応モデル・即時評価列・SpecIndex・先行実測Fingerprint→閉包・根拠・改訂のIssue | 比較用の期待集合・理由・不整合flagをCheckerに作らせない |
| Checker | 既存順のFilesystem観測・Fingerprint計算・即時評価の呼出し・診断配送 | 評価例外後に後続ペアを読まない。Fingerprint用raw読取りとfreshな対応定義readを統合しない |

根拠の四文字一致・正規化・具体理由書式等は既存の機械的条件のままであり、独立した意味採用や品質Passではない。Fingerprint比較も別時点の読取りが同一世代であることを保証しない。旧4公開入口・SpecCorrespondencePair・spec/correspondence.tsは撤去し、Wrapperを残さない。即時比較の独立公開は、例外時に後続読取りを止める実Consumerのために維持する。

### Architecture／Qualityの担当モデル

| モデルとOwner | 保持する明示内容 | 評価・実装の成立と区別する点 |
|---|---|---|
| ArchitectureDetailAssignment（architecture/types.ts） | 原文・Artifact・全表行、期待Identityとdefinition／area種別、担当行の本文と出典、UI／SPEC担当、先頭Traceability行とARCH所属 | 定義と領域は型で区別。先頭所属が空でも後続から補完しない。担当宣言は実装・認可ではない |
| ArchitectureDetailTrace（同上） | 原文・Artifact・全表行、全可視本文のSCR／PRT／BHV、六列の成立行数、Owner／Area・Mode・BHV、重複と後勝ちMap | 不正行中のIDも旧抽出範囲へ残し、空Areaや未認識行を失わない |
| QualityDetailAssignment（quality/types.ts） | 原文・Artifact・全表行、期待Identity、出典付き担当行、UI／SPEC担当とRelation出現 | ARCH型へ依存しない。行内重複flagと別行の出現回数を分ける |
| QualityDetailTrace（quality/types.ts） | 原文・Artifact・全表行、全可視本文の発行ID、五列の成立行数、Owner・Mode・BHV、重複と後勝ちMap | 品質Passや実試験成功を本文宣言から発行しない |

担当・追跡は、それぞれArchitecture定義／領域モデルのassignment、Architecture詳細Mapのtrace、Quality定義のassignment、Quality Detail分析のtraceへ統合した。独立した部分Parserは公開しない。原文は同じ既存read点で取得し、可視化は各Owner内で行う。期待IdentityはDirectory列挙元、本文のCanonical ID・状態はArtifactへ別に保持する。Semanticだけが両工程を合成し、工程型同士をimportしない。Checker製のID集合・合同中央表・owner／ownership Wrapperは撤去した。初回readではArchitectureDefinition／QualityDefinitionModel列を別に構築し、後の担当モデルへ再利用しない。Qualityはraw局所検査と別にvisibleLinesを保持し、第一観測の可視substring比較へ渡す。

これは明示担当契約のモデル化であり、Architecture／Qualityの分析・定義・詳細本文全体をモデル化したという完成主張ではない。モデルの表・宣言から新しい配置やAuthorityを推測しない。

### Change本文と変更案内の完成受付

change/parse.tsのparseChangeDocumentは方式を明示してCanonical本文とひな型を受け、ChangeDocumentと局所IssueをParseResultで返す。原文・Artifact・全表・行出典、先頭40行のID／標準見出し、列挙元の期待Identity、実ひな型の変更意図・契機・状態・影響・対象外・判断・検証、計画・Phase・収束の節を保持する。影響見出し数・影響Block・全影響行・収束表は一度捕捉し、validation.tsはこの内容を使う。宣言IDを列挙元の期待IDへ置き換えず、CHG-000079／80の適用閾値と見出し不一致時の打切り・不正Block後の継続順を維持する。

parseChangeIndexはChangeIndexに全指定コメント区画と出典を保持し、先頭区画だけからリンク全出現を捕捉する。文書内重複はParseが一件返す。ChangeのinspectChangeNavigationは非重複モデルと観測済みCHG ID一覧の件数・包含を比較し、局所重複を追加診断で二重化しない。区画欠測と期待集合空を新たな違反へ変えない。Parseのpartialと横断評価の空Issueを全体合格へ読み替えない。

旧Header／本文検査／Template Boolean／案内Booleanの四公開は撤去し、部分Parserの互換Wrapperを残さない。Header観測だけのConsumerも同じ完成Parseから宣言を取得するが、元の先頭40行という取得範囲と二回read・評価順を維持し、その観測位置で新しい本文Issueを表示しない。取得断面だけから文書全体の成立を判断しない。

### READMEの完成受付とStable比較

release/parse.tsのparseReadmeはReadmeと局所IssueをParseResultで返す。原文・Artifact・全表・raw行・Fence外行、先頭Headerの採用値と位置、raw先頭20行、Candidate／Released Baselineの出現、二言語節を保持する。BOM・Fence・Anchor・太字行を旧どおり扱い、最初の意味行で版を採用できなくても後続行を探さない。版欠測だけでは新しいIssueを作らず、completeは内容捕捉の完了であり公開版への適合ではない。

Stable版との比較はReleaseのinspectReleaseConsistency（stable_readme）が所有する。全文のliteralな版表示比較と、モデルへ捕捉したraw先頭20行のCandidate残留を従来順で検査する。Headerの採用版を全文表示の代用にせず、期待値に改行が含まれる場合も元のsubstring比較を維持する。旧parseReadmeVersion／inspectStableReadmeの本体とRoot公開は撤去し、互換Wrapperは残さない。通常版比較とStable比較で行われる別readは統合しない。正本文書familyと集合比較は後述の専用完成受付へ接続する。

### CHANGELOGの多版モデルと診断対象

parseChangelogはChangelogと局所IssueをParseResultで返す。version引数は一つの多版文書内の診断対象を選ぶ条件であり、最新版の推定・他文書との一致・公開許可ではない。原文・Artifact・全表・raw行、既知二言語の全節出現と全版節、宣言行・採用値または不正理由、移行注記と出典を保持する。内容捕捉を全過去版への合否検査へ拡大せず、選択版だけをvalidation.tsへ渡して言語節数・対象版節数・宣言・二言語相関・必要説明を従来順で評価する。

Fence外の完全なbullet inline-codeと、閉じたyaml／ymlのkeyだけを宣言として扱う。未閉鎖YAMLがあっても別の閉じた宣言の内容・出典を保持し、拒否理由は従来どおり未閉鎖を優先する。同値重複・競合、通常本文・引用・他Fenceの除外を維持する。分類と必要説明は両言語の移行要否がtrueである場合だけ診断する。ParseはCHANGELOG宣言用のFence構造と内容を一回捕捉し、局所検査は捕捉済みの宣言と証拠を使う。

Stable版の見出し二件・日付一意はReleaseのinspectReleaseConsistency（stable_changelog）へ接続する。旧契約は任意の期待版文字列を受け付けるため、ここだけは捕捉済み全原文に対する版指定の完全一致正規表現を維持し、通常の一行版節やFence外内容へ狭めない。Stable観測ではParseの局所Issueを追加配送せず、同じ位置で旧Stable診断だけを表示する。旧二検査入口の本体・Root公開は撤去し、新File・Wrapper・Readerは作らない。

### 正本文書familyと版・状態の集合評価

parseCanonicalDocumentはCRDD正本文書群の共通Headerと全文をCanonicalDocumentへ捕捉する。Artifact・原文・全表・raw行・共通Header・版・状態・Released Baseline・Candidate三形式の採用版・Ready／Releasedの宣言行と出典を保持する。共通Headerは既存規則による正規化済み文字列と最初の採用fieldの原文行を持ち、欠測はnullとする。タイトルやAnchorをHeaderの出典へ代用しない。Candidate以外のBaseline、CandidateのBaseline欠測・自身の版との同一は単体Issueとして返すが、その他の文書や集合を推測しない。このfamilyはUI／SPEC等の工程固有内容を解析・検査済みとするものではない。

inspectReleaseDocumentsはParse結果列から非null版だけのSetと件数、全文書のCandidate相関、Baseline、Stable観測候補版を一度導出する。二つの独立した手製DTOを受け取らず、全版不一致→文書順のCandidate外Baseline不備→Candidate相関の旧診断順を維持する。Candidateの局所Issueは単純連結せず、モデル値から集合文脈の診断へ再構成し、件数・順序・集合値を維持する。Stable候補は文書数・Stable宣言・版集合の純粋条件だけを示す。候補があっても状態不整合は残り、公開・品質・認可は成立しない。

Stableの集合状態はReleaseのinspectReleaseConsistency（stable_canonical_documents）、限定取得したMarkdownのCandidate／Ready／ReleasedとTag観測の比較はstable_release_documentへ接続する。16行観測はその断面だけをモデル化し、全本文へ補完しない。Candidate三形式の文法優先順、rawの対象版substring、Path条件、Tag未確認をnullのまま扱う条件を維持する。official／scope、Git観測と処置はCheckerに残し、別read・短絡・診断位置順・versioned_documents_checkedを変えない。旧五公開・本体・互換Wrapperは撤去し、release/validation.tsは完成Parseの内部条件・版集合・Stable観測比較を所有する。

<a id="public-api"></a>
Releaseの版・Baseline・Stable条件はRelease自身が所有する。inspectReleaseDocumentsは既存のParse結果列から集合候補と診断を返し、inspectReleaseConsistencyは正本文書集合・個別文書の取得断面・README・CHANGELOGと観測済み版／Tagを比較する。Stable四kindはSemanticのDispatcherから撤去し、ReleaseからSemanticやParseへ戻る依存を設けない。Rootは宣言元から直接公開し、旧転送Wrapperは残さない。Checkerの別read・16行断面・原文substring・Tag未確認null・短絡と診断順は維持する。Release・Quality、Architectureの八比較とUI／SPECの各四比較、UXの四比較とIAの五比較はそれぞれのOwnerへ移管済みである。先行棚卸しの工程移管候補27判定は各Ownerへ移管し、その時点でSemanticには真の工程横断10判定を残した。今回、Architecture検証単位とQuality統合の被覆を追加し、現行は11判定となる。

## 2. 公開入口とSource

単一本文の品質表・Discovery参照・Reality Catalogは、parseQualityTables／parseDiscoveryReferences／parseRealityTestCatalogがモデル構築と限定診断まで完了する。旧三InspectorとQualityVerificationEvaluationは撤去し、転送Wrapperを残さない。QualityTablesは原文Artifact・分岐表／是正表の件数と区分別Issue、RealityTestCatalogは従来の限定登録Mapである。品質表とDiscovery参照は全Markdownの従来の適用範囲を維持し、一般Artifactの別診断を追加配送しない。completeはそれぞれの受付範囲だけの成立で、全品質Passではない。

publishSemanticCoverageは検証済みRepositoryを受け、Bundle構築後に既存Writerを一回呼ぶ。不要なPublisher Factory・Port型・転送処理は撤去し、WriterのPath・Link・原子的置換・失敗時保全と内部の故障Hookを維持する。Topic／Meetingの生成入口はRootと期待Projectだけを受け、保存契約注入Overloadは撤去する。故障注入は既存activity/operations.tsのOwner試験へ閉じ、本番Root経路の種別限定・改訂・期待Project検査を別に確認する。

parseRealityTestCatalogは取得済みJSON本文と出典を受け、解析と三文字列field・Path重複だけの限定Map構築を完了する。JSON不正と構造不正はいずれも結果nullだが別Issueで区別し、Checkerは従来のcode・文言へ変換する。readTestCatalogの全Schema・走査条件へ置き換えず、一回観測・Manifestなし時の読取り省略・前提不成立時のGraph省略を維持する。parseMarkdownLinkReferenceとMarkdownLinkReferenceは、現在参照と固定Git履歴のraw値を一回Decodeして失敗を保持する独立値契約として残す。Filesystem／Git解決はCheckerに残し、解析を複製しない。

[Rootの宣言](../../../40_Develop/document-model/src/index.ts)は明示公開226項目（値102・型124）を持つ。値には定数・Parser・検査を含み、226個の操作を意味しない。現在の集合は[公開契約試験](../../../40_Develop/document-model/tests/unit/public-boundary.contract.test.ts)の固定期待値と照合する。[分離途中の棚卸し](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#document-public-inventory)は調査時点の履歴である。文書単位のParse・モデルと、実利用または独立した完成契約を残し、内部構文Helperと部分更新はRootへ出さない。文書の保存・照会・連合操作や共通技術受付までParseだけへ押し込まず、未接続Capabilityの本番利用を主張しない。

公開内部化候補六項目は、Publisher Factory／Port型とTopicMeetingRepositoryの三公開を撤去し、Reality Catalogの限定受付とMarkdown参照受付・型の三項目を独立入力境界として維持した。前者は完成出版とRoot指定CRUDへ統合し、後者は異なる観測や全Schema走査への置換・Checkerでの解析複製を避ける。今回の分類と選択的整理は完了したが、参照数や公開数だけから全将来用途に対する最小性は主張しない。

| Source | 所有する契約 |
|---|---|
| artifact/ | 共通Markdown・成果物構造・診断・Graph・Schema・内部Checklist構文エンジン。工程固有Checklist定義は工程Ownerが所有する |
| discovery/、ux/、ia/、spec/、ui/、architecture/、quality/、change/、release/ | 工程文書の解析・局所検査。UX専用の入力参照型はux/types.tsが所有する |
| activity/、topic/、meeting/ | 活動正本のCRUD・一覧・Relation・処置 |
| project-context/ | 正本文書の3期待Identity照合、Source・Portfolio投影 |
| semantic/、reality-traceability/ | IR・Coverage・Symbol宣言と観測 |
| test-catalog/、quality-change-control/ | readTestCatalogによる読取り・構造・実在集合との一回照合と、その同じ観測集合。品質確認結果の純粋モデル |
| repository/、storage/ | 文書観測、Topic／Meeting・Semantic保存 |

parseArtifactは共通構造・Identity・Related・Anchor・Linkと局所Issueを返し、明示したschemasだけを同じ結果へ適用する。Artifact内部の構造捕捉とSchema／Graphエンジンは非公開とする。横断的なGraph比較はinspectDocumentRelationsへ、任意Markdownの品質表はparseQualityTablesが同じ取得本文からArtifactとQualityTables、区分別件数・Issueを返す。一般Artifactの局所Issueを品質表のIssueへ混ぜず、ArtifactからQualityへの逆依存も作らない。Checkerは従来の各取得位置で必要なIssue集合だけを配送し、別readの統合や適用文書の追加はしない。

Project Contextは単体Parseの部分結果と構造欠測を区別し、Manifestとの比較はSemanticが所有する。表示用の内容捕捉とCheckerの固定構造条件を混同せず、旧Consumerで検査していなかった局所Issueを新しい認可条件にしない。Reality Manifestは既存manifest.tsのparseRealitySymbolManifestがunknownを受け付け、JSON読取りの失敗と構造不正を区別する。

共通Artifactは、Checker向けの診断用リンク集合と、本文のインラインリンク（出現位置・直前の見出しを含む）を区別する。本文の捕捉からはHTMLコメント・コードフェンス・インラインコード内のリンクを除き、Checkerの既存リンク集合と診断条件は変えない。`project-context/parse.ts` の完成Parseは、本文中の相対Markdownリンクを直前のH2と結び、参照候補として返す。参照候補は内容モデルとは別に返し、MCPやWorkbenchの既存Project Context応答には項目を増やさない。Repository実体・認可・公開は利用側が確認する。

readTopicMeetingListは入力検査、取消確認、呼出し側が所有する認可済み対象の一回解決、再度の取消確認、一覧取得を閉じる。resolverや保存読取りの例外は入力不正へ畳まない。Factoryは変更せず、新しいキャッシュ・Authority・Facadeを作らない。

Consumerの受理条件は用途ごとに異なる。Project Contextのpartialは局所文書条件に不備があるが内容モデルは捕捉できた状態であり、AMの登録Identity照合、CLIのProject ID搬送、Workbenchの内容表示では利用できる。Checklistを認可・実行許可へ昇格しない一方、構造欠測のnull、AMのManifest Identity不一致、読取り不能の既存拒否は維持する。これは部分結果全体を正しいと承認する契約ではない。

| 一覧の内部状態 | 既存MCPの返却 | 意味の境界 |
|---|---|---|
| complete | 完成Page | 対象解決後に一回取得。認可自体の保証は解決Ownerが持つ |
| invalid | -32602／Invalid params | 対象解決前に入力拒否 |
| cancelled | -32800／Request cancelled | 取消を対象未取得へ畳まない |
| unavailable | -32602／Invalid params | 対象不存在・認可拒否の詳細を公開せず、内部状態は失わない |

この変換は現在のMCP契約を維持するものであり、別の公開理由を新設する判断ではない。resolverの例外は既知の一覧エラー名でも内部故障とし、一覧呼出しが返す既知入力エラーとは区別する。

品質確認結果の純粋モデルを配置したことから、Checker本番の新Gateや受入権限を生成しない。Semantic公開の既存Writerの保存契約は維持し、HookをRootへ公開しない。

成果物（Artifact）を土台とし、工程文書モデル、意味・品質の横断評価、Checkerの順に利用する。実装上の依存はCheckerからモデル側へ向ける。回帰対象・静的検査Owner・高負荷試験の実行条件・段階計画・結果集約はCheckerが所有し、文書モデルからCheckerを参照しない。台帳の構造検査に必要な段階・Profileの値契約は文書モデルに残す。試験計画を提供しても、実行許可・試験合格・自動実行を意味しない。

工程固有の21実装と12試験ファイルは工程Ownerへ移管し、旧Artifact Pathや互換再exportは残さない。公開名・型の意味・診断のkind／reason・順序はこの配置変更で変えない。Artifact基盤から工程Ownerへの逆Importと、UX専用型の共通型への再混入を公開境界試験で拒否する。

工程間比較の`inspectDocumentRelations(request)`は、閉じた判別型`DocumentRelationsRequest`で比較ごとの入力を区別する。`ui_spec`はUiDefinition列・SpecDefinition列・SpecIndexと診断位置を受け、Semantic自身が対応集合を導出する。`ui_spec_details`はScreen・Detail対応根拠・両Detail統合台帳・SpecDefinitionのモデルを受ける。`ui_spec_downstream`は両Detail統合台帳・SpecDefinitionとArchitecture／Qualityの担当モデル・中央対応モデルと別観測断面を受ける。`ui_spec_evidence`は定義対応モデル・即時評価列・SpecIndexと先行実測Fingerprintを受ける。ArchitectureのinspectArchitectureConsistencyの`architecture_inputs`はArchitectureAnalysis列、観測した実在Directory集合・UI／SPEC期待集合と診断位置を受ける。Quality内部の目標表はinspectQualityConsistencyへ渡す。未知の種別を別比較や空結果へ切り替えない。旧2関数と旧Architecture入力型・Wrapper、旧Quality横断目標検査は撤去済みである。UI重複→三者閉包、Detail対応の宣言・重複・双方向閉包・件数、Architecture件数→Directory集合、Quality行→重複→処置→目標被覆の従来順を維持する。空Issue列は当該比較の違反なしであり、全品質Pass・認可・実在確認ではない。

UI本文の対応SPEC参照は、完成入口`parseUiDefinition`が他のUI定義内容とともに出典付きで捕捉し、UiDefinitionのpairedSpecificationsへ保持する。SPEC側は`parseSpecDefinition`がSpecDefinitionのpairedInterfacesへ対応UI参照を保持する。部分Parserの`parseUiSpecPairs`は撤去済みであり、Semanticは工程モデルを利用して本文を再解析しない。定義の節出現と出典はArtifact内部の`captureDocumentSections`で捕捉し、UI分析入力の一意節、SPEC分析入力の先頭節、対応宣言の先頭pairs_withという異なる選択条件を各工程で維持する。その他の既存利用箇所が使う`readMarkdownSection`を含め、Artifact内部の捕捉・節抽出補助はRootへ公開しない。

Quality横断目標の表解析はQualityが所有する。parseQualityIntegrationはrawの最初の横断節と、そのfilter前本文から参照出現をcrossModelReferencesへ保持する。重複・順序・出典を消さず、次H2必須・EOF代替なし、コメント・Fenceを新たに除去しない旧条件を維持する。文書内の関係・条件・後勝ちMapはQualityの完成Parseが捕捉し、QualityのinspectQualityAnalysisは複数モデルの結果だけを合成する。Semanticのquality_architecture_modelsはQualityIntegrationを受け、Architectureが既存の単一Catalogから導出した固定五文書と比較する。旧path.join／resolveと同じ基点を使う純粋計算であり、新しいFile読取りや実在確認は行わない。集合化は比較位置でだけ行い、同数の誤差替えも拒否する。Checkerの固定五文書リストと直接比較は撤去し、同じ位置で旧code・文言を表示する。

今回対象にした共通領域の責務と固定五モデル比較は、内容観測・工程固有規則・横断比較・表示へ接続した。通常AREA／CMP／Visual／BHVは既存Parserと局所診断へ接続済みである。公開物全体を棚卸しし、不要な構文Helperと中間公開を撤去した。Screenの局所Issueも接続済みである。その他の未接続本文・実利用は、具体的な対象と必要性を確認して別に追跡する。Fileを移すだけで完了とせず、全体回帰・実AI／Dockerや未接続本文の成立を今回の限定結果から推定しない。

<a id="consumers"></a>
## 3. 利用側の投影

Checkerは文書構造を検査し、Workbench／MCPは活動操作・表示を利用する。AM／Coordinator等が構成モデルのManifestを取得した場合、`readRepositoryProjectContext(repository, expectedIdentity)`へprojectId／repositoryId／repositoryRoleの3値だけを明示投影する。第2引数は文書モデル自身の`RepositoryProjectContext`から取った3 fieldであり、Manifest型や設定全体を受け取らない。

三Identityの完全一致、本文実体確認、内容改訂、不明・不一致の区別は維持する。文書読取りから認証・認可・Task許可を生成せず、複数モデルの画面結合は既存Consumerが行う。

<a id="storage"></a>
## 4. 保存と終了条件

Topicは22_Topics、Meetingは23_Meetingsの既存正本、Project ContextはPROJECT_CONTEXT.md、Semanticは既存指定成果物を使用する。Package分離でSchema・Path・ID・Lock Identity・改訂・同一Repository内の出版順序を変更しない。

固定Path、Traversal・Link拒否、実体照合、期待改訂、Relation確認、原子的置換と失敗分類を各文書Ownerに保持する。Node.js標準操作と共通Lockへ既存保存処理から接続し、汎用保存Helperを別モデルから借りない。

活動の詳細は[活動Context](02_Activity_Context.md)、実行Stateは[実行モデル](../execution-model/01_Architecture.md#storage)、設定保存は[構成モデル](../configuration-model/01_Architecture.md#storage)を参照する。

<a id="ui-spec-detail-placement"></a>
## 上流UI／SPEC Detailの局所分担

[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)のARCH-000001、ARCH-000002、ARCH-000006、ARCH-000009、ARCH-000013、ARCH-000016について、以下の文書断面を担当する。中央表のコピーや、他モデルの実行・設定・認可を統合する第二の正本は作らない。

担当Interaction Relation: `PRT-000001.spec-000001`、`PRT-000006.spec-000010`、`PRT-000008.spec-000012`、`PRT-000014.spec-000019`、`PRT-000018.spec-000023`、`PRT-000009.spec-000013`、`PRT-000017.spec-000022`

| 対応関係 | この領域の担当 | 担当しない処理・未確認境界 |
|---|---|---|
| PRT-000001.spec-000001／PRT-000018.spec-000023 | 成果物・工程文書の構造と関係、Project Contextの解析 | Checkerの起動・診断表示、自由文の意味採用、全工程のモデル化完了 |
| PRT-000006.spec-000010 | 上位から渡された期待projectId／repositoryId／repositoryRoleに対するContext照合 | Manifest探索・設定読取り、Git Rootの技術検証、実行対象の選定 |
| PRT-000008.spec-000012 | AM経由で許可された集合のContext・Portfolio集約 | 認証・認可・鍵操作。上位の集約断面の未実装は既存Partialのまま残す |
| PRT-000014.spec-000019 | 変更契約・成果物関係と実装宣言の値モデル | 全Consumerを観測するCheckerの実行、移行採用・Release判断 |

資源・回復記録は実行モデル、Manifestは構成モデルがそれぞれ所有し、上位が値を投影する。Git差分選択・Commit・PushのPRT-000006.spec-000031はVCと利用側の完成操作であり、文書モデルの担当として継承しない。担当の配置が記述できたことを実装・独立検証・品質の成立へ読み替えない。

<a id="verification"></a>
## 5. 検証と未確認

公開集合・文書解析・三Identity・活動CRUD・Semantic出版・Repository境界と異常系を既存試験へ対応付ける。試験Rootは検証済みRepository直下の今回専用.crdd/testsへ限定し、同実体の清掃と不存在を確認する。

移管後の限定回帰・独立レビュー結果は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で更新する。Source配置や単独型検査をもって全Consumer接続・同等保証・全体完成としない。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `document-model.package-boundary` | Interface／State／Failure | 完成Parse・工程モデル・横断関係と保存の公開境界 | 既存の完成操作・Owner・結果相関を保持 | 低位から上位への依存、不要Helper公開 | UT | N/A | RCM-UT-014の入力・結果・現在値と必要な終了確認 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
| `document-model.document-contracts` | Interface／State／Failure | 部分モデル・Issue・診断順とConsumerの結果相関 | 既存の完成操作・Owner・結果相関を保持 | 欠測の成功化、同一取得の情報喪失、独自再判定 | UT／IT | Adjacent 1 Block | RCM-UT-016／RCM-IT-011の入力・結果・現在値と必要な終了確認 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
| `document-model.document-storage` | Interface／State／Failure | Topic・Meeting・Context・Semanticの保存と終了 | 既存の完成操作・Owner・結果相関を保持 | 取消後Effect・別対象・改訂競合・終了不明 | IT | Direct Boundary | CPR-IT-010／011は活動CRUD、PPR-IT-018／RDL-IT-007はSemantic出版、PPR-IT-019はContext読取りを区別 | Readerは保存Effect 0。CRUD／出版は元対象と改訂を維持し、確定または未知残存・終了不明を返す | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |

## 現行実装との照合

上記導出キーは現在の責務と既存試験の接続であり、今回の試験実施結果ではない。実装・限定検証と変更経緯は[既存変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。旧Domainの一括公開・共通Helper・結果の四状態を3モデルへ複製しない。配布launcherとReleaseの全Consumer閉包は上位Ownerの未完了義務として保持する。

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
