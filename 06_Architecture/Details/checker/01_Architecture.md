# Checkerの設計

## 文書入口とRepository観測の分離 — 2026-10-20（実装済み・最終確認中）

旧Profileは撤去した。`cli/document.ts`は引数・Root初回確認・表示・終了値を所有し、`repository/document.ts`は探索・Scope・参照・文書状態・工程観測の順序と報告集計を所有する。工程観測はproject-context、work-lifecycle、discovery-ux、ia、ui、spec、architecture、qualityの八Fileへ分ける。工程間をつなぐ共通Reader、Snapshot、Registryは作らず、取得済み値をDomainへ渡す。既存参照解決関数だけをDiscovery／UXへ明示搬送し、Readerを再構築しない。診断は元の追記配列に配送し、途中の例外でも先行診断を破棄しない。

Qualityの有限状態・工程分析・統合・Detail引渡し・関係閉包と書式条件はDomainへ接続する。Centerの解析結果を同じままReality状態対の検査へ渡し、関連flagを独立に再構成しない。DomainのIssueは専用の二変換で従来診断へ接続する。Coverage節欠落時は従来どおり統合本文をreadした後でreturnし、以降の定義列挙・Detail取得を実行しない。読取り前の先読みSnapshotは作らず、同Fileの再read、Ready条件付きread、実Path集合とIDの観測は元位置に保持する。

Quality Definitionは従来のphysicalDefinitionPaths順に一回ずつ生本文をreadし、Directoryから解決したQA-IDと診断位置を`inspectQualityDefinition`へ渡す。部分関係・出現列・後勝ちMapを既存の集約先へ追加し、本文Issueを表示する。その後に独立抽出Local ID列と現在のOwner Mapを`inspectQualityLocalItemOwnership`へ渡し、先勝ちの所有と重複Issueを後続へ接続する。新しいFile読取り・先読み・保存・管理基盤は追加しない。`report/quality.ts`の専用変換が二十kindを従来のcode・文言へ接続し、動的文言の必要情報と未知kindを検査する。

Architecture分析／定義は従来どおり本文read・可視化後に同Fileを再readし、既存Domain Checklist検査を実行してから`inspectArchitectureAnalysis`／`inspectArchitectureDefinition`へ渡す。分析済みIDとRelationの集約は診断表示前、定義の実在ID追加は二回read前に維持する。Templateのlstat・readと不存在時の省略も維持し、用途別の意味だけを`inspectArchitectureDetailTemplate`へ渡す。横断モデルは`inspectArchitectureCrossModelIndex`が返す固定文書順にlstat・readし、欠落時は旧診断を表示して次へ進む。登録節が空ならモデルFileは観測しない。一回のreadから可視本文とFence保持本文を導き、`inspectArchitectureCrossModel`へ渡す。

詳細Mapの取得後に`inspectArchitectureDetailMap`へ接続する。Detail DirectoryはFile有無より前に実領域集合へ追加し、File欠落は診断後に継続する。一回目の可視本文と二回目のChecklist理由を`inspectArchitectureDetail`へ渡し、部分関係とCovered定義を従来位置で集約する。領域列挙後の三閉包条件は`inspectArchitectureDetailCoverage`へ接続し、診断位置文字列だけを渡す。

分析列挙後の網羅性は`inspectArchitectureAnalysisCoverage`、横断モデル取得後の登録本文は`parseArchitectureRegistry`へ接続する。定義列挙後は`inspectArchitectureRegistryCoverage`を呼び、Component表は横断モデルの取得値を流用せず同Fileを元位置で再readして`inspectArchitectureComponentCoverage`へ渡す。Detail処理後の重複・三者閉包は`inspectArchitectureRelations`へ渡す。専用変換が十八kindを旧code・文言へ接続する。本文意味をCheckerへ再実装しない。本文意味と観測編成のSource分離は実装済みであり、固定候補の最終回帰・レビュー・清掃を別に確認する。

定義対応Evidenceは`artifact/spec-correspondence.ts`の四APIへ接続する。対応本文read後の改訂表解析、全Definition Directory名sort・Fileのlstat・生本文の直接read・相対Path付きNUL区切りSHA-256、続く対応行別UI→SPECのreadという順を維持する。Fingerprint用の生本文と可視根拠検査用本文の二度取りを統合しない。正規行だけの対象解決後に行検査を呼び、実際に訪問した理由を出現順に集約する。最後の閉包・根拠・改訂の中立Issueを`report/convert.ts`で旧診断三分類へ変換する。表・根拠文の解釈をCheckerへ再実装せず、Fingerprint用のFilesystem観測とhash計算だけを維持する。

DetailのUI対応・Screen関係・SPEC表被覆・対応表状態をDomainの`artifact/spec-details.ts`へ直接接続する。Checkerは従来の列挙、`lstat`、read、欠落診断を維持し、`report/convert.ts`で中立Issueを旧診断へ変換する。期待Relation集合の編成は既存位置に置き、Screenの純粋な集合照合だけは対応表検査内で行う。対応表が欠落している場合の読取りや解析を新たに実行しない。

下流では中央ARCH→中央QA→combined ARCH→combined QA→ARCH定義再read→領域→QA定義再read→UI Directory件数の観測順を維持する。定義／領域は各read直後、中央表はQA定義列挙後の従来位置でDomainの用途別モデルへ変換する。Directory名をOwner／領域名とし、本文IDで上書きしない。最終UI件数観測後に`inspectSpecDetailDownstream`へ渡し、純粋なOwner集合編成と閉包判定だけを同観測後へ移す。不存在時の追加lstat、combined本文の別read、UI Directory数（定義File存在数ではない）を維持する。下流被覆の中立Issueは旧診断へ変換する。

SPEC分析・登録表・定義の取得済み本文はDomainの三APIへ渡し、関係出現列／集合を従来の位置で集約し、既存report/convertのSPEC用変換で旧診断へ配送する。分析網羅性、定義網羅性、UI定義件数取得後の件数／三者閉包、UI本文read後の対応関係閉包も、元位置でDomainへ直接接続する。不正本文からも関係を保持し、観点別ID追加と後続Detail／下流Traceの列挙・読取りを先取りしない。工程本文意味と観測編成の分離は実装済み。最終回帰・レビュー・清掃を別に確認する。

UX正式入力はDiscovery定義read・参照候補解析・Path解決・境界確認を維持し、観測済み六事実をDomainの`inspectUxFormalInput`へ渡す。定義参照が一件のときだけ同一Pathを比較し、観測失敗を安全なfalseへ畳まない。正式入力診断は本文診断より先に表示する。最終UX／Journey閉包は旧Root観測後の元位置で`inspectUxRelations`へ渡し、従来の二診断を既存report/convertから表示する。新しい参照観測・状態・回復処理は追加しない。

Discovery要求定義は列挙・実在ID追加・読取り後にDomainの`inspectDiscoveryDefinition`へ渡し、探索分析は元の読取り位置で`inspectDiscoveryAnalysis`へ渡す。`report/convert.ts`のDiscovery用変換は各二Issueを成果物別の旧診断へ変換する。採用要求IDは元位置で入口を再readして`parseAdoptedDiscoveryRequirements`へ渡す。採用要求との網羅性確認は従来位置に残し、入口Checklist・Template条件は今回の移管対象に含めない。

UX分析は正式入力のPath解決・Discovery定義の観測・先行不正診断を行った後、既読本文と期待REQ ID・入口のPath出現数をDomainの`inspectUxAnalysis`へ渡す。分析専用六Issueは既存report/convertで旧診断へ変換し、解析済み関係を現在の集合へ集約する。本文不正でも関係を保持し、外部読取りと後続閉包確認は従来の位置に残す。

UX定義の本文構造・直接Handoff・ChecklistはDomainの`inspectUxDefinition`へ渡し、定義専用の三種類の中立Issueを`report/convert.ts`で旧code・文言へ変換する。定義Directory列挙、ID集合追加、本文読取り、最後の網羅性確認は従来の位置に残す。Discovery本文の移管済みを意味しない。

変更記録の本文構造・ひな型固有条件・指定案内区画の集合照合はDomainの`artifact/change.ts`へ移管した。CheckerはRoot、CHG列挙・整列・読取り、他工程TemplateとRelease Evidenceの観測を所有し、中立Issueを`report/convert.ts`で既存の四field診断へ変換する。見出し不正時の短絡や番号80以降の適用条件は変更しない。旧形式の移行処理や一般的な工程検査Frameworkは追加しない。

探索を`repository/discover.ts`、指定範囲と一段参照拡張を`repository/scope.ts`、現在参照先・固定Git履歴の読取り・短命cacheと参照mapを`repository/references.ts`へ移す。初期Root・基準版観測の値を明示入力とし、観測の先読み・新しい永続状態・一般I/O抽象を追加しない。固定履歴表の読取りは従来どおりFile探索の前に行い、検査後の参照mapも元の位置で作る。

Project Context本文の固定構造とManifest Identity比較はDomainの`project-context/inspect.ts`へ分離する。表示用Parserとは受理条件が異なるため、そのParserへの置換で条件を強めない。Root検証・Manifest Path解決・通常File／Link確認・JSON解析・失敗診断と読取り順はCheckerに残す。旧Registry／Pipelineは撤去し、品質状態はDomain検査と既存診断変換、Realityはrepository/reality.tsの観測へ直接接続した。工程本文判定のDomain移管、専用診断変換の配置、旧Profile撤去は実装済み。全体回帰・独立確認・清掃の最終確認前であり、Repository全体の品質合格は主張しない。

## Repository観測の配置整理 — 2026-10-20

Semanticの残存接続は`repository/semantic.ts`が既存の観測順・Domain Compile・Graph結果接続を所有し、`report/semantic.ts`が既存Issueの診断変換だけを所有する。三fieldの`SemanticCoverageDiagnostic`は`report/types.ts`へ置き、文書／Rule診断と無理に統合しない。前提診断がある場合はGraphを作らず、その入力診断列を同じ参照で返す。未知kindや不足Detailは従来どおり拒否する。旧`semantic/inspection.ts`と互換reexportは残さず、Root公開・保存契約は変更しない。

Realityも同じ境界にそろえる。`report/reality.ts`は既存の三field診断への変換、`repository/reality.ts`はManifest・Catalog・Test Source観測とDomain結果の接続を所有する。CatalogのJSON解析は観測側、その後の限定的な登録対応検査はDomainの`inspectRealityTestCatalog`へ渡す。旧二Fileと試験専用Manifest変換wrapperは本番から撤去する。Manifestがない場合のCatalog読取り省略、前提診断時のGraph省略と同一診断列、観測不能・JSON不正・本文不正の既存区別を維持する。

`repository/observe.ts`は既存の`lstatIfPresent`、`pathContainsSymbolicLink(root, target)`、`isWithin(parent, child)`を所有する。Repository観測はRootを明示して呼び、Rootの選択・実体拒否・適用範囲・診断を維持する。Package Rootの公開集合には追加しない。

`lstatIfPresent`はENOENTだけnullとし、その他の観測失敗は伝播する。Link検出はRoot自身を含まず、配下構成要素を順に読み、Root同一・字句上Root外・途中不存在でfalseを返す。このfalseを安全性や不存在の一般証明には用いない。`isWithin`はScope・Gitlink・採用基準版・履歴領域にも使う既存の字句判定であり、先頭`..`の名前も拒否する条件を維持する。実体固定・Hardlink検出・競合防止・新しい認可は追加しない。

## 診断型・収集・変換の配置整理 — 2026-10-19

本番使用中のArtifact Issue変換を`report/convert.ts`、局所診断収集を`report/collect.ts`、診断型を`report/types.ts`へ配置した。公開`CheckerFinding`と内部`DocumentFinding`は別shapeのまま保持する。Rootは従来どおり前者だけを実体から公開し、旧Pathの互換exportは残さない。収集は単純な追加順・重複・元Objectを保持し、並替えや新しい重複除去を追加しない。

通常文書の表示は`report/output.ts`の`writeDocumentReport(report, options, writeOutput)`へ分離した。内部の`DocumentReport`と`DocumentReferenceMap`は既存field・null・観測順を保持する表示用型で、Rootへ公開しない。repository/document.tsがレポートを元のkey順に構築して時刻・件数を集計し、cli/document.tsが終了値を確定する。表示側はObjectを再構築せず、JSON単独は診断配列、JSON＋Summaryは全レポート、人間表示は元の文字列・改行・callback粒度で渡す。参照mapの別表示は人間Summary時だけ。callbackの失敗は同じ例外を伝播し後続発行を止める。cli/document.tsは元requestのメソッド呼出しも維持する。保存先・Filesystem・時計・新しい合否判定を表示側へ持たせない。

利用者承認により、本番Consumerが0件だった`findings/domain-outcome.ts`の汎用変換・専用結果型・旧ITを撤去する。Domainの四状態・相関・必須／禁止fieldはDomain直接UTが確認する。Checkerは本番Producerが返す結果から、用途別の診断・拒否・既存終了値へ接続する。汎用四状態を一律にChecker公開結果へ残す旧契約は退役し、その旧ITを本番接続の根拠へ流用しない。新しい汎用変換や状態管理は追加しない。

Domainの成果物集合検査と用途別変換ではSchema invalidのIssueとGraph partialの非null結果を保持する。一方、現Quality本番呼出しはschemasを指定せず、品質状態の診断だけを公開する。文書公開入口の実入力不備・Realityの実Source欠測・Semantic入力欠測は診断と終了1、Semantic Root不正は終了2として検証する。Domain構造として妥当な未知kindはSurfaceの各本番変換が拒否する。公開三操作・JSON・文言・出力順・終了値は不変とし、詳細な検証条件はQA-000001のRCM-IT-011／RCM-UT-016が所有する。

## 移管後のSource構造と公開入口案 — 2026-10-19

状態: 責務移管後の現在配置。以下のTreeへSource・利用側を接続済みであり、最終回帰・独立確認を行う。小さな判定の抽出だけではChecker再編を完成としない。添付Source Structure Reviewと現在のCoding Standardsに従い、Folderは責務、Fileは実際の操作・役割を表す。

単一受付の合意と実装単位: 受付は`cli/command.ts`へ集約し、`cli/types.ts`は維持する。exactな接続は`bin/checker.ts`→`src/cli/command.ts`の内部操作`runCheckerCommand`→既存三操作の実体である。binはargv・cwd・stdioと終了codeだけを接続する。受付は実際のモード選択・flag除去を所有し、再exportだけの転送ではない。bin専用操作を標準APIへ増やす実利用はないためRootへ公開せず、他Packageからこの内部Fileへのdeep importを許可しない。通常公開三操作は従来どおりRootから利用する。

共有要求・終了型は`cli/types.ts`へ移し、旧Profileから互換exportしない。操作固有の引数解釈は各実処理が引き続き所有し、万能parserへ統合しない。Semanticと台帳／計画の受付は`cli/semantic.ts`／`cli/test-catalog.ts`へ配置した。importの移動差以外は本文を変更せず、Rootと単一受付は同じ実体へ接続する。旧Pathの互換転送は残さない。document受付と観測・固有検査の分離も実装済みであり、Source配置の成立と全体品質の評価を区別する。

出力・保存の境界: 通常レポートは`report/output.ts`で整形後に`writeOutput`へ搬送し、エラー通知は従来どおり`writeError`へ渡す。binではstdout／stderrとなる。Checkerはレポート用`storage/`・履歴・ローテーションを持たない。`--semantic --write`だけは表示用レポートではなく意味Coverage生成物を既存Domain保存APIへ渡す。Semantic／台帳の固有出力を通常文書の新レポートへ無理に統合しない。

```text
checker/
├ bin/checker.ts                 argv・cwd・標準入出力と単一受付を接続
└ src/
   ├ index.ts                    公開三操作・共有型だけを明示export
   ├ cli/
   │  ├ command.ts               既存三モードの単一受付・振分け
   │  ├ types.ts                 既存要求・終了結果の共有型
   │  ├ document.ts              文書検査の引数・Root初回確認・表示・終了値
   │  ├ semantic.ts              意味Coverageの引数・取得編成・明示保存接続
   │  └ test-catalog.ts          台帳検査／回帰計画の引数・差分入力・表示接続
   ├ repository/
   │  ├ document.ts              文書検査全体の観測順・工程接続・報告集計
   │  ├ project-context.ts       ProjectionとManifestの実在・Identity接続
   │  ├ work-lifecycle.ts        CHG／Releaseの実在・本文・案内接続
   │  ├ discovery-ux.ts          Discovery・UXの列挙・正式入力・本文接続
   │  ├ ia.ts                    IAの列挙・本文・関係接続
   │  ├ ui.ts                    UI／Detailの列挙・本文・関係接続
   │  ├ spec.ts                  SPEC／対応根拠の列挙・取得・Hash・関係接続
   │  ├ architecture.ts          Architectureの列挙・本文・横断モデル・Detail接続
   │  ├ quality.ts               Qualityの構成・状態・分析・定義・閉包接続
   │  ├ observe.ts               初期Root形態・実在File・Link等の観測
   │  ├ discover.ts              Git一覧・基準版・取得不能時のFile探索
   │  ├ scope.ts                 指定範囲・一段関係・未検査集合の選択
   │  ├ references.ts            参照先・Anchor・固定Git履歴・参照map
   │  ├ semantic.ts              意味入力の観測・Domain Compile・結果接続
   │  ├ reality.ts               Manifest・Catalog・Test Source観測と結果接続
   │  └ types.ts                 観測済み入力・探索結果・参照の型
   └ report/
      ├ types.ts                 既存診断・報告の型（異なる公開shapeは維持）
      ├ convert.ts               中立Issueから既存code・文言への明示変換
      ├ document.ts              共通文書・Identity・版の診断変換
      ├ quality.ts               Quality状態・定義・分析・関係の診断変換
      ├ semantic.ts              Semantic固有Issueの三field診断への変換
      ├ reality.ts               Reality固有Issueの三field診断への変換
      ├ collect.ts               診断収集・既存順序・重複処置
      └ output.ts                JSON・Summary・人間向け表示
```

空Folder・空Fileは作らない。CLI用途ごとの小さな解析・変換は各入口Fileへ同居し、独立した変更理由と実共有があるものだけをrepository／reportへ分離する。独立再利用のないexecution中継、万能Parser、共通Result Framework、Capability内barrelは追加しない。convertが異なる診断体系を隠す巨大Fileになる場合は実際の変換契約に応じて分け、ファイル数をこのTreeへ合わせるための統合はしない。

| 現在の配置 | 到達先での処置 |
|---|---|
| 旧`profiles/current.ts` | 本文意味をDomain、受付をcli/document、観測をrepository、診断をreportへ分けて撤去済み。丸ごとの改名・移動や互換中継は残さない |
| `inspection/pipeline.ts`、`rules/*` | 判定意味をDomain、必要な観測順をRepositoryへ対応付け、Checkerには直接呼出しの編成だけを残した。callback中継・旧Registryは撤去済みで、新Registryは作成しない |
| `findings/*` | 診断型・変換・収集をreportへ整理し、不要な中継を撤去済み |
| 旧`semantic/command.ts`、旧`test-catalog/command.ts` | `cli/semantic.ts`／`cli/test-catalog.ts`へ移管済み。旧Path・転送は撤去し、既存公開操作を維持する |
| `semantic/inspection.ts`、`reality/*` | 判定をDomain、実観測をrepository、既存診断変換をreportへ対応付けた。旧File・転送だけの型・関数は撤去済み |

UTは新Owner・新Pathへ追従し、検査意味を移した試験はDomain、CLI・観測・表示・終了値の試験はCheckerが所有する。IT以降は内部File名へ機械的に合わせず、維持する公開操作・利用場面を名前と検証義務へ対応付ける。全Source Headerは移管後の実責務・Effect・失敗境界へ更新する。

### 最終公開APIの範囲

既存の公開操作三つと共有型三つを維持する。以下はCLI型のAPIであり、一般的な成果物モデル検査APIはDomainが所有する。

| 公開名 | 役割 | 実体の配置 |
|---|---|---|
| `runChecker(request): CheckerResult` | 文書検査の起動と結果出力 | cli/document.ts |
| `runSemanticCoverage(request): CheckerResult` | 固定対象の意味Coverage確認・明示保存 | cli/semantic.ts |
| `runTestCatalog(request): CheckerResult` | 台帳検査または回帰計画。試験は起動しない | cli/test-catalog.ts |
| `CheckerRunRequest` | arguments、cwd、writeOutput、writeError | cli/types.ts |
| `CheckerResult` | exitCode | cli/types.ts |
| `CheckerFinding` | 既存の公開診断型 | report/types.ts |

レポート本文は既存の出力先へ渡す。`CheckerResult`が型付きレポート全体を返すとは説明しない。通常文書診断の四fieldと、rule必須・evidence任意の`CheckerFinding`は現在別shapeである。配置整理を理由に全診断へrule等を追加せず、JSON・文言・順序・終了値を維持する。新しいAPI体系や汎用実行層は今回の到達条件に含めない。

### binの操作一覧

binはPackage名と同じ`bin/checker.ts`一つを維持する。以下は現在の公開操作であり、新しいsubcommand体系へ変更しない。

| 操作 | 引数 | Effect |
|---|---|---|
| 文書検査 | `--root <path>`、`--json`、`--summary`、`--scope <path>`反復、`--references <path>` | 読取りと表示 |
| 意味Coverage確認 | `--semantic`、`--root <path>` | 読取りとJSON表示 |
| 意味Coverage保存 | 上記へ`--write` | 既存Snapshotの明示保存。保存OwnerはDomain |
| 台帳検査 | `--test-catalog`、`--root <path>` | 読取りと表示 |
| 回帰計画 | 上記へ`--changed <path>`反復、`--base <revision>`、`--all`のいずれか。`--levels <list>`でLevel選択 | Git等の読取りと計画表示。試験起動なし |

計画の高負荷条件入力は既存の`--resource-intensive-authorized`、`--purpose`、`--environment`、`--max-duration-minutes`、`--max-invocations`、`--max-credits`、`--cleanup`、`--stop-condition`を維持する。入力充足を実行許可や実上限の強制へ昇格しない。`--semantic`と`--test-catalog`は併用しない。現行binでも両指定は後段引数拒否64となり、優先実行が成立するわけではない。配置換え時に受付で明示拒否する場合は、その診断経路の変更を別に照合し、既存64を維持する。`--help`は未対応であり、新設済みと扱わない。実際の操作手順は[Checker手順](../../../19_Workflows/02_Checker.md)が所有する。

## 工程ひな型の基本図処置検査のDomain移管 — 2026-10-19

`checkPhaseDiagramDispositionContracts`はofficial適用を判定し、Domainの`phaseDiagramTemplatePaths`の順で既存の探索・fallback・存在確認・本文読取りを行う。存在しないFileは従来どおりskipする。本文条件は`inspectPhaseDiagramTemplates`へ委譲し、返却Issueから既存code・Path・文言のFindingへ変換する。未知kindや不正detailsは正常診断へ丸めず拒否する。

七Profileの内容・列・図名・処置語彙は[Domain詳細](../domain-model/01_Architecture.md#工程ひな型の基本図処置契約--2026-10-19)へ集約し、Checkerには同じ表を複製しない。generic／adopterへの適用拡大、図の品質保証、新しいRegistryは追加しない。

## 共通Checklist検査のDomain移管 — 2026-10-19

Discovery・UX・IA・UI・SPEC・Architecture・Qualityが共有する可視Checklistの構造判定は、Domain Rootの`inspectEvaluatedChecklist`／`inspectTemplateChecklist`へ接続する。47種類の期待項目配列と移管済み本文検査はDomainが所有し、適用対象の選択・観測と既存code・文言はCheckerが維持する。既存の失敗理由と判定順を変更せず、互換aliasや新しい登録基盤は設けない。意味の正本は[Domain詳細](../domain-model/01_Architecture.md#可視checklistの構造検査--2026-10-19)であり、工程別検査全体の移管完了ではない。

## 品質設計成果物の状態検査のDomain移管 — 2026-10-19

旧品質状態RuleとRegistryは撤去した。現在は`repository/quality.ts`からDomain Rootの`inspectQualityDesignStates`と`report/quality.ts`の表示変換へ直接接続する。品質設計の対象集合、readiness、Findingのseverity・code・文言・入力順はCheckerが維持する。状態正規化とCanonical判定の意味は[Domain詳細](../domain-model/01_Architecture.md#品質設計成果物の状態検査--2026-10-19)が所有する。

report/convert.tsで中立Issueを明示変換し、未知kindは例外として拒否する。新しいRegistryや変換専用Fileは追加しない。この規則の移管だけでQuality Readyの全体成立やChecker全体の薄い入口化を主張しない。

## 本文解析のDomain移管 — 2026-10-19

行・コードFence構造はDomain Rootの`parseMarkdownFences`へ移管した。CheckerのDiscovery要求IDリンク、README版表示、CHANGELOGの三箇所が同じ結果を利用する。BOM除去・改行分割と検査の適用・宣言の意味・診断は元の場所へ残し、局所`parseMarkdownStructure`と二型の互換定義は撤去する。行index・内外・未閉鎖・内容行の参照関係を維持し、詳細は[Domainの行／Fence解析](../domain-model/01_Architecture.md#行とコードfence構造の解析--2026-10-20)に従う。

見出し・明示Anchor・重複接尾辞とFence除外は、Domain Rootの`parseMarkdownAnchors`／`omitMarkdownFencedCode`へ移管した。`repository/document.ts`と`repository/references.ts`は検証対象ファイルの読取り、固定履歴本文の取得、リンク先の存在照合とFinding表示を引き続き所有する。DomainへChecker code・message・CLI引数・読取りcallbackを渡さない。公開CLI、診断順序、Scope、References、終了Codeは変更しない。

続いて可視本文二方式・表行／区切り行・先頭Header抽出をDomain `artifact/markdown.ts`へ移管した。CheckerはRoot公開APIから得た本文・Cell・Headerに既存の検査条件を適用する。HeaderのVersion／Status検査・診断を抽出APIへ混ぜず、RootやRepositoryの観測も移さない。

共通リンク参照の抽出・target／anchor分解は、Domain Rootの`parseMarkdownLinkTargets`／`parseMarkdownLinkReference`へ移管した。Checkerは返却値を既存の`resolveLocalTarget`へ接続し、外部URL分類・Root境界・Link観測・固定Git履歴・Finding変換を維持する。参照文字列の解析成功から、参照の存在や安全性を推定しない。

UX固有の参照候補解析は、本文と現在のRoot文字列を`parseUxFormalInputTargets`へ渡す形へ移管した。Checkerは返却候補を既存のPath解決・Discovery Definition／Analysis識別・正式入力検査へ接続する。Root検証や権限判断をDomainへ移したものではない。参照候補の意味は[UX解析の境界](../domain-model/01_Architecture.md#ux正式入力の参照候補解析--2026-10-19)に従う。

受付・観測・意味・表示のSource分離を実装した。全体回帰の不合格や未実施項目を局所成功からPassへ読み替えない。巨大なProfileをそのままDomainへ移動したり、新しいRule登録基盤を追加したりしない。具体的な本文APIと既存Parserとの差は[Domain詳細](../domain-model/01_Architecture.md#可視本文表先頭headerの移管--2026-10-19)、共通リンクの意味は[リンク解析の境界](../domain-model/01_Architecture.md#共通リンク参照解析の移管--2026-10-19)に従う。

## 試験台帳・計画の入口 — 2026-10-19

`src/cli/test-catalog.ts`の`runTestCatalog(CheckerRunRequest)`をPackage Rootと既存binの`--test-catalog`から利用する。引数は`--root`、`--changed`反復、`--base`、`--all`、`--levels`と既存の高負荷条件入力である。変更指定なしは台帳検査だけ、変更指定ありは回帰計画を返す。既定Rootは既存Version Controlでcwdから検証し、Git差分も同Packageの公開APIへ委譲する。

モデル、台帳読取り・整合検査、選択、段階計画はDomain Root APIを利用する。Checkerはnpm／Cargoコマンドを生成せず、試験Processや実行Callbackも持たない。公開結果は試験ID・Path・Owner・段階・順序・必要な条件と`testExecution:not_started`を含む。計画成功は試験合格ではない。高負荷条件が揃っても実上限を強制しないため計画のみである。

旧Runnerの一括自動実行・自動結果収集を廃止し、フロントAI／人間がProjectの実行手段で実施する。CRDD公式Repositoryのnpm設定は開発環境固有であり、Checkerの依存や適用先への要求にしない。[移管境界](../verification-runner/01_Architecture.md#2026-10-19の責務移管)を参照する。

成果物種別: Architecture詳細設計
詳細設計領域: checker
状態: Canonical

## Semantic実行入口の移管 — 2026-10-19

Checkerは`src/repository/semantic.ts`と`src/report/semantic.ts`で既存Repository観測とDomainのSemantic計算を編成し、Issueを既存の診断コードへ変換する。`src/cli/semantic.ts`の`runSemanticCoverage`と既存binの`--semantic`を公開入口とする。意味解析・Relation・Coverage・保存本体を複製せずDomain Root APIへ接続する。既定の`runChecker`と文書検査の振る舞いは変えない。詳細は[Semantic責務移管](../semantic-coverage/01_Architecture.md#2026-10-19の責務移管)に従う。旧形式の調査・移行はフロントAIが保守手順に従って行い、Checkerへ移行専用コードを恒久保持しない。以下の「CheckerはSemantic生成・公開を所有しない」という旧記述は、意味計算・保存本体を所有しないという境界へ置換する。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | Generic Checker CoreとCRDD現行Profileを分け、構造・ID・Path・Relationの決定論的検査を具体化する。 | Covered |
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | 契約移行で宣言集合と自動導出集合を比較する機械検査だけを担当する。変更の意味判断は所有しない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Core、Profile、CLI、package入口の責務を分ける。 | [§2](#2-実装正本と配布入口) |
| Interface Model | Required | 入力Root、Finding、終了codeと利用側の意味を固定する。 | [§6](#6-結果の意味と利用側) |
| Data Flow | Required | 探索、読取り、検査、集約、結果の流れを示す。 | [§3](#3-検査の順序) |
| State Model | Required | 未開始、検査中、完了、実行不能と資源解放を区別する。 | [§5](#5-資源と終了) |
| Sequence | Required | 構造確認後に意味別Profileを適用する順序が再現性に影響する。 | [§3](#3-検査の順序) |
| Failure／Recovery | Required | FindingとChecker実行不能を分ける。 | [§6](#6-結果の意味と利用側) |
| Deployment | Required | 実装正本と薄い配布入口の接続を保つ。 | [§2](#2-実装正本と配布入口) |
| Observability | Required | 検査範囲、未検査範囲、所要時間、Findingを返す。 | [§6](#6-結果の意味と利用側) |
| Security Boundary | Required | 検証済みRootだけを読み、link越境を確認済みにしない。 | [§4](#4-読取り境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | RunごとにRoot、結果、一時領域を分離し、共有可変状態を持たない。 | [§5](#5-資源と終了) |
| Timing | PASS | 所要時間の合格上限は持たないが、試験runnerのtimeout、取消、子Process完了通知と終了後回収を別に観測する。 | [§5](#5-資源と終了) |
| Resource Lifecycle | PASS | 読取りhandle、子Process、一時領域をRun所有として終了時に回収する。 | [§5](#5-資源と終了) |
| External Boundary | PASS | Filesystem、Version Control Port、package入口の失敗を適合へ丸めない。 | [§4](#4-読取り境界) |
| Failure／Recovery | PASS | Findingと実行不能を区別し、未検査範囲をPassへ含めない。 | [§6](#6-結果の意味と利用側) |
| State／Consistency | PASS | 未開始、検査中、完了、実行不能と資源解放を区別する。 | [§5](#5-資源と終了) |
| Observability | PASS | 検査範囲、未検査範囲、所要時間、Findingを返す。 | [§6](#6-結果の意味と利用側) |
| Security／Trust | PASS | 検証済みRootだけを読み、link越境を確認済みにしない。 | [§4](#4-読取り境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `checker.generic-core` | Component | 可視Markdown／Path／ID | 同一入力で同一Finding | 非表示構造、link越境、重複ID | UT | N/A | Finding codeとpath | handle・一時物0 | 意味妥当性は独立レビュー |
| `checker.distribution-entry` | Interface | package入口とRepository入口 | 同じCore／Profileを実行 | 旧実装、内部Path直参照 | IT | Direct Boundary | 実行source identity | 同じ終了code | なし |
| `checker.declared-derived-closure` | Flow／Consistency | Consumer／派生物／公開・Release経路の構造 | 両集合が完全一致 | 欠落、未知、重複、正規節外、旧Path／API残存 | IT | Related 2 Blocks | Finding code、Path、集合差分 | 構造差分0 | 意味妥当性と移行採用は独立レビュー |
| `checker.test-runner-lifecycle` | Sequence／Lifecycle Ownership | 試験子Process、timeout、取消、fixture | 完了・timeout・取消を区別し、全子Processの終了とfixture残存を確認する | timeoutを正常完了へ丸める、子Processまたはfixtureの残存を見落とす | IT | Direct Boundary | 終了状態、signal、残存Process、fixture分類 | 全子Process終了、残存物を未確認として報告 | 所要時間そのものは品質合否に使わない |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-19

## 1. 何を解く部品か

Checkerは、CRDD文書の構造、版、識別子、リンク、アンカー、宣言した契約の整合を決定論的に調べる。文書を編集するツールではなく、AIの専門判断やCRDD準拠を認定するツールでもない。検査結果を読んだ人またはAIが、責務を持つ文書を修正する。

利用契約は[振る舞い仕様](../../../05_SPEC/07_Current_Behavior_Reference.md#checker-contract)、操作は[Checkerの手順](../../../19_Workflows/02_Checker.md)、全体の品質状態は[品質の現在状態](../../../07_Quality/01_Quality_Center.md)を参照する。

## 2. 実装正本と配布入口

現在残るFindingおよびProfile本体は`40_Develop/checker/src`が所有し、上記到達先へ移管中である。`cli/command.ts`は単一受付として既存三操作へ接続し、工程別検査本体を所有しない。`template/tools/crdd-check.ts`は公式Repository CLIを起動し、両入口とも検査本体を複製しない。

| 部品 | 責務 | この分離の理由 |
|---|---|---|
| [配布入口](../../../template/tools/crdd-check.ts) | 安定CLI名から同じ基準版Root内の公式Repository CLIへ相対接続する | 採用Repository向け入口を維持しつつ、検査意味を`template`に二重管理しない |
| [Checker実装正本](../../../40_Develop/checker) | Checker固有Finding、Repository観測、CLIおよび結果報告を所有する | Rule追加のたびにlauncherを変更せず、共通能力をChecker専有にしない |
| [公式Repository CLI](../../../40_Develop/checker/bin/checker.ts) | 同じChecker公開APIへ接続する | 実装工程から発見できる入口を持ち、コピーを作らない |
| [private package](../../../40_Develop/checker/package.json) | 型・命名・静的解析・試験の開発環境 | 開発依存を採用先の必須導入物へ広げない |
| [試験runner](../../../40_Develop/checker/tests/test-runner.ts) | 安全に列挙した試験を子Processで実行する | 通常Checkerの検査と、fixtureを作る開発試験を分ける |

`template/tools`は配布契約として残すが、Checker実装本体を所有しない。起動入口だけを単独コピーした実行形態は対象外とし、公式clone／submodule内の`40_Develop`実装を相対importで解決できなければProcess開始時に停止する。CheckerはRepositoryを読む補助Toolであり、Provider Effect、Runtime Authorityまたは共有Effectを発行しない。このためCoordinatorの署名済みRuntime閉包へ含めず、通常のRepository Root、regular file、link非介在、公開入口およびConsumer Closureを検証境界とする。

## 3. 検査の順序

### 内部ブロック

Checkerは一つの配布入口から開始し、検査基盤は`40_Develop/checker/src`の責務別Directoryが所有する。Findingと検査の編成はChecker、成果物解析・Schema・関係Graphの意味はDomainが所有する。旧Rule RegistryとPipelineは撤去した。工程別検査本体をlauncherへ置かず、callback登録だけで責務分離済みと扱わない。

```text
配布入口 [template/tools/crdd-check.ts]
       │ 安定CLI名・引数受付・Runtime Root解決のみ
       ├─────────────────┐
       │                                 │
公式Repository CLI                   採用Repository入口
[40_Develop/checker/bin/checker.ts]       [<CRDD基準版Directory>/template/tools/crdd-check.ts]
       │                                 │
       └─────────────────┘
                         │ Checker公開API
                         ▼
Checker
  cli/command.ts                 単一受付・三操作の選択
  cli/document.ts                文書の引数・Root初回確認・表示・終了値
       ↓
  repository/document.ts         探索・Scope・参照・工程順と集計
       ├ 工程別八File            実在・列挙・読取り・Domain接続
       ├ repository/reality.ts   実装・試験Traceの観測
       └ Domain Model公開API     本文解析・Schema・関係・品質条件
                    ↓ 中立Issue
  report/                        既存診断変換・JSON・人間向け表示

開発試験入口 tests/test-runner.ts
  → tests/support/test-discovery.ts
  → tests/（通常Checkerとは別の子Process・fixture lifecycle）
```

| 内部ブロック | Source群・関数群 | 役割 |
|---|---|---|
| 開発用接続部 | `40_Develop/checker/bin/checker.ts` | 内部の`src/cli/command.ts`へ接続し、launcherへ検査実装を複製しない |
| 発見・参照・範囲 | `40_Develop/checker/src/`のRepository発見、`anchorsFor*`、`resolveLocalTarget`と範囲選択部 | 確認する文書集合と参照先を構成する |
| Artifact変換 | Domain `artifact/parse-markdown.ts`、`artifact/types.ts` | 取得済みMarkdown表現を意味Modelへ変換する |
| 構造・関係検査 | Domain `artifact/validate-schema.ts`、`artifact/graph.ts`と工程別意味検査 | 単一成果物の構造と成果物間Relationを検査する |
| 用途別検査 | 工程別検査と`repository/reality.ts` | 十工程を既存順で直接実行し、その後にRealityを観測する。Registryを介在させない |
| 成果物集合の検査 | Domain `artifact/inspect.ts` | Source順の解析、Schema順の検査、関係Graphを構成し、表示はCheckerが行う |
| 診断 | `report/types.ts`、`report/convert.ts`、`report/document.ts`、`report/quality.ts`等 | 異なる既存shapeを維持して表示へ変換する。一律のrule・evidenceを追加しない |
| 公開操作 | `cli/document.ts`、`cli/semantic.ts`、`cli/test-catalog.ts` | 既存三操作の引数・表示・終了値を所有する |
| 文書観測の編成 | `repository/document.ts`と工程別八File | 工程を元の順に直接呼び、Realityはその後に実行する。旧Profile・互換中継・Rule Registryは持たない |
| 報告 | `repository/document.ts`の集計と`report/output.ts` | 観測済みの指摘・未確認・件数を既存stdout形式へ返す。CLIが終了値を確定する |
| 開発検証 | `40_Develop/checker/tests/` | 試験発見と契約検証。通常実行の構成部ではない |

専門的な意味監査、外部URLへの照会、自動文書修正は接続していない。次の順序説明と境界表が、その制約を具体化する。

```text
1. Repository Discovery
        ↓
2. Markdown Parse
        ↓
3. Artifact Model Build
        ↓
4. Schema Validation
        ↓
5. Relation Resolution
        ↓
6. Cross-artifact Validation
        ↓
7. Special Rules
        ↓
8. Finding Report
```

検査の既存順序は維持するが、汎用Stage・Rule ID登録APIは提供しない。用途別検査を直接呼び、観測・短絡・失敗の順序を変更しない。Markdown Parser libraryやJSON Schema validatorの採用は実装選択であり、この責務境界を満たす限り特定libraryを設計契約にしない。

実装上の順序は`40_Develop/checker`の実装正本で照合できる。引数処理、`discoverProjectFiles`、参照解決、範囲選択、報告構築を辿ると、どの集合を実際に確認したか再構成できる。単なるファイル件数では確認範囲を表さない。

### 全体確認と限定確認

`--root`省略時のRootは起動Directoryであり、最寄りGit Rootの自動解決ではない。公式の作業手順ではRootを明示する。

`--scope`では、指定したMarkdown集合に直接の参照先・参照元を一段追加する。依存関係を無限に辿る検査ではない。一方、版・構造・安定ID等の全体検査は残る。このため限定確認は「指定ファイルだけ検査」でも「Repository全体確認」でもない。

| 集合 | 意味 | 報告での区別 |
|---|---|---|
| 発見集合 | Git追跡済み＋非無視の未追跡、またはFilesystem探索で得たもの | 発見方式と失敗理由を保持 |
| 要求した範囲 | 利用者が`--scope`で指定した対象 | `requested_scope` |
| 展開した範囲 | 直接の参照関係を追加した確認対象 | `expanded_scope`、件数と省略表示の有無 |
| 全体検査 | 限定時にも行う構造等の確認 | `global_checks` |
| 除外・未確認 | Git無視、Gitlink境界、確認できない範囲等 | 除外情報と`unchecked`。指摘0へ吸収しない |

## 4. 読取り境界

外部URLへ通信して存在確認しない。ローカルリンクではRoot外への解決、symbolic link／junction等を確認済みにしない。Gitlinkは独立した境界として扱う。Gitが使えない場合のFilesystem探索は、Gitと同一の確認を保証する代替ではなく、失敗理由・除外・未確認付きの経路である。

Checkerは、現在の正本・案内・ひな型・Change・Work Lifecycle Evidenceの通常リンクを現在Pathに対して検査する。本文を変更できない固定履歴では、CRDD Official Current Profileが承認済み移行表から当時の参照基準を解決し、固定本文を通常リンク修正の対象にしない。固定原文Identity、過去Git object、移行表が当時の移行を正しく表すかという真正性は独立監査が扱う。固定履歴の扱いを、現行正本または改変可能なChange／Evidenceのリンク切れを許容する例外に使わない。

| 層 | 対象 | 含めないもの |
|---|---|---|
| Generic Checker Core | Root、発見集合、Path境界、Link、Anchor、ID、宣言された汎用構造 | CRDD公式Repositoryの固有Version、CHG、実装package、過去移行 |
| CRDD Official Current Profile | 現在の公式正本・template・版・状態・現行Directory契約、通常のChange／Evidenceリンク、承認済み移行表による固定履歴参照の機械的解決 | 過去Releaseの意味評価、固定Commit／Blobと移行表の真正性、個別CHGの監査 |

## 5. 資源と終了

| 資源・操作 | 所有と終了 | 保証しないこと |
|---|---|---|
| 文書・参照索引 | Checker Processのメモリ | 索引化しただけで意味品質が成立すること |
| Filesystem読取り | 同期読取り。読取失敗は処理ごとの拒否または例外へ | あらゆる例外で完全なsummaryが返ること |
| Git子Process | 本体の同期呼出し。各呼出しの設定に従う | 全体deadline、全Git呼出し共通timeout、独自のprocess tree回収契約 |
| stdout／stderr | 結果と引数エラーを出力 | 途中中断時に完全なJSONが残ること |
| 試験fixture | private試験だけが一時Rootを作り、通常終了時に清掃する | 通常Checkerの読取り契約との同一視、強制終了後の清掃保証 |

通常Checker本体は文書の生成・修正・削除を行わない。開発試験は別の資源所有者であり、`os.tmpdir()`の解決先を承認済みのRepository-local `.crdd/tests/checker`へ指定して実行する。通常のCheckerに、存在しないAuthority、候補Store、永続Recoveryを追加しない。

### ブロック状態遷移

| 現在状態 | 契機／事前条件 | 処理と観測 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| 未受付 | 正規化済みRootと引数 | Root、mode、範囲を検証 | 発見中／拒否 | 拒否時は子Process・書込み0 |
| 発見中 | Gitまたは理由付きfallbackを開始 | 文書、参照、未確認境界を列挙 | 索引済み／失敗 | Git子Process終了、読取りだけ |
| 索引済み | 対象集合確定 | 構造・参照・契約を照合 | 集計中 | Repository byte不変 |
| 集計中 | 全検査終了 | 指摘・warning・未確認を分けて構成 | 報告済み | stdoutとexitが同じ結果を表す |
| 試験実行中 | 開発runnerが試験を開始 | timeout／取消／終了を観測 | 完了／部分失敗 | 全子Process終了、fixture残存を分類 |

通常検査と開発試験runnerを同じLifecycleへ畳まない。試験runnerのcleanupまたは子Process終了が不明な場合、通常Checkerが読取り専用であることを根拠に成功へ補正しない。

通常検査は現在の正本、参照、ID、構造および禁止された旧Pathを対象とする。過去の大規模移行を全source byteから再演する確認はCheckerの責務にせず、当該移行の独立監査で行う。Checkerの品質試験では、Repository境界、現行Path、ID、参照等の一般化した機械的不変条件だけを小さなfixtureで反証する。

## 6. 結果の意味と利用側

正常に報告を構築した場合、errorがあればexit 1、なければexit 0。warningや未確認があっても0になり得る。引数拒否はstderrとexit 2であり、未捕捉例外・外部からの終了とは分ける。`--help`は現行の引数ではない。

通常テキストは人間向け、`--json`単独は指摘配列、`--json --summary`は範囲・発見方式・未確認・指摘を含む報告である。`--references <file-or-directory>`の対象Pathは必須。相対PathはRoot基準で解決し、絶対PathもRoot内の場合だけ受理する。参照関係表示はsummaryと併用する。CIや監査はexit 0だけで判断せず、必要範囲と未確認も読む。

## 7. 設計から試験への接続

| 確認する不確実性 | 正常・準正常・異常の代表 | 接続先 |
|---|---|---|
| Root・入力の意味 | 明示Root、省略、未知引数、値欠落 | [Checker契約試験](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts) |
| 範囲の取り違え | 全体、限定、一段展開、全体検査の残存 | 同契約試験のscope／references項目 |
| 発見と読取り | Git、fallback、読取失敗、link／Gitlink | 同契約試験の発見・境界・fault injection項目 |
| 表示と終了 | テキスト、JSON配列、summary、0／1／2 | 同契約試験の出力・引数項目 |
| 試験そのものの脱落 | nested試験、重複・未知entry、TypeScript所有集合との差 | [試験列挙](../../../40_Develop/checker/tests/support/test-discovery.ts)、[命名契約](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts) |

この表は試験への接続であり、全件の最新実行結果ではない。結果は品質記録へ分離する。意味監査、初見利用者の理解、中断時の実子Process観測は、Checkerの指摘件数から証明しない。

## 8. Reality Traceability基盤

Reality Traceabilityは、Canonical設計と現行Source／TestのRelationを機械可読にする。設計一致の意味判断やGap分類をCheckerへ移さない。

```text
Architecture Definition          Quality Definition
        ARCH-ID                       QA-ID
           │                            │
           └──────────┬─────────────────┘
                      ▼
        40_Develop/<subsystem>/symbol.json
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
 Implementation Symbol        Test Symbol
          ▲                       │
          └────── verifies ───────┘
                      │
                      ▼
             Global Symbol Graph
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Checker       MCP       Workbench
```

| 所有対象 | 責務 | 所有しないこと |
|---|---|---|
| 共通Schema | Manifest、Symbol種別、Path、ARCH／QA／Local Test／`verifies`の構造 | ArchitectureやQualityの本文 |
| Subsystem-local `symbol.json` | 意味のある最小Owner単位とCanonical IDのRelation | 設計一致・検証合格の主張 |
| Symbol Discovery | `40_Develop`直下のSubsystemを列挙し、通常fileとRoot内Pathだけを受理。不正ManifestはGraphへ混入させない | Directory名の固定allowlist |
| Repository File Observer | Test Catalog、Quality Definition、Symbol Sourceの各Path要素と実体Pathを検査し、link／junction、Root外、観測不能を拒否 | 内容の意味評価 |
| Global Symbol Graph | ARCH→実装、QA→試験、試験→実装と各逆方向のIndex。構造Findingが1件でもあればGraphを発行しない | Reality Gapの意味分類 |
| Quality Local Item解決 | Test SymbolのLocal Test IDが、同じSymbolに結合したQA定義の検証項目に実在することを確認 | Test実装済み・Passの主張 |
| Test Catalog Adapter | Test SymbolのPathとOwnerがTest Catalogへexactに一度だけ登録されていることを確認 | Test CatalogをGraph Coreへ直接読ませること、試験結果の意味評価 |
| Source Header | Production Named SymbolはARCH-ID、Test File／Case／Helper／FixtureはQuality Local Itemへ接続する局所Navigation Hintを必須で持つ。`symbol.json`との不一致を検出する | Relationの正本、HeaderからCanonical Relationを逆生成すること |

新Subsystemは`40_Develop/<subsystem>/symbol.json`を追加して参加する。Checker CoreへSubsystem名を追加しない。Implementation SymbolはARCH Relationだけを、Test SymbolはQA、Local Test、`verifies` Relationだけを所有し、設計と検証の責務を一つのSymbolへ混在させない。Symbol Pathは途中要素を含めてlink／junctionではない通常fileであり、実体PathもSubsystem内に留まる場合だけ受理する。Test SymbolはTest Catalog Adapterが返す登録集合へexact Pathと同一Ownerで接続する。`symbol.json`が存在しPathとIDが解決できることはRelationの構造成立だけを意味し、`Covered`、実装済み、試験済みまたは合格済みを意味しない。

本番実装を呼ばない合成環境の実証は、Test Symbolへ`verificationTarget: "environment"`を明示する。この場合もQA・Local Test・実Pathの関係を必須とし、`verifies`は空集合だけを許す。通常試験の`verifies`非空条件は維持し、環境実証を実装Symbol又は実装の意味Coverageへ加算しない。未知値、実装Symbolへの付与、架空の実装関係との併記は拒否する。

検証Tool自身の構築・判定・終了制御を検査するSuiteは、環境実証へ分類しない。検証Toolと用途限定判定fixtureを`kind: "verification-tool"`としてQA・Local Test・実Pathへ接続し、Suiteは非空の`verifies`で実際の対象Toolへ結合する。ToolのPathはPackage内の`scripts/`または`tests/fixtures/`の通常TypeScript／Rust fileだけを許す。ARCH・意味実装・環境指定とTool自身の検証辺を禁止し、`verifies`は明示空配列とする。既存のPath実体観測、QA／Local解決、通常試験の参照条件を維持する。Tool宛て辺は実装検証Indexへ登録せず、Semantic CoverageもToolを実装や意味の検証証拠へ加算しない。ここで確認するのは検証手段の局所契約であり、本番Capabilityや実Native／OS動作の合格ではない。

Header検査もこの分類に従う。検証済みManifestと宣言元Package内の通常実Pathへexactに結合した検証ToolにはQuality Headerを適用し、Production Headerを重複要求しない。Toolの識別子命名とQA／Local Item対応の検査は維持し、未登録script、不正Manifest、別Packageへの解決、重複又は実装との混在を免除に利用しない。同じTypeScript Symbolのoverload集合は先頭宣言のHeaderを一度検査し、後続宣言にHeaderがないことだけを重複診断しない。先頭の不足、後続に明示した不正Header、別Symbolの不足、各宣言の命名・parameterは引き続き検査する。

Test Catalogの定義、変更影響からの試験選択、試験段階の実行および結果集約は[Verification Runner](../verification-runner/01_Architecture.md)が所有する。CheckerのTest Catalog Adapterは、Reality Symbolとの構造整合だけを読取り検査し、試験を選択・実行しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `checker.generic-core`<br>`checker.distribution-entry`<br>`checker.declared-derived-closure`<br>`checker.test-runner-lifecycle` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Rule、Profile、Repository観測および結果報告を、決定論的FindingとEffect 0の共通契約へ揃える。 | RuleはRepositoryを変更せず、対象、code、severityおよび理由を同じ結果境界へ返す。 | Rule追加が独自走査・独自結果・暗黙除外を持ち、検査母集団が分岐する。 | `checker.generic-core`<br>`checker.distribution-entry`<br>`checker.declared-derived-closure` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `checker.generic-core` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `checker.generic-core`<br>`checker.distribution-entry`<br>`checker.declared-derived-closure`<br>`checker.test-runner-lifecycle` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `checker.test-runner-lifecycle` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `checker.test-runner-lifecycle` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000001、ARCH-000002のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000001.spec-000001`、`PRT-000014.spec-000019`、`PRT-000018.spec-000023`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

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
