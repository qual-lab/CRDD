# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

責務再編の段階1〜4（棚卸し、基本設計、詳細API・配置・QA引渡し、独立設計レビュー）を完了した。三観点の是正後再レビューはPass・必須残件0件。設計集合は13定義・172検証項目で、Source移管と新構成の実境界は未評価である。全体Checkerは1,572件Failを維持し、全体品質Passとはしない。次は段階5AのDomain統合からのSource移管であり、全回帰・署名E2E・Release判断は未完了。[現在の順序と確認範囲](99_Roadmap/Changes/CHG-000082/change.md)を参照する。

Docker回復記録の縮小は本番切替前の保存境界を具体化している。Repository結合と短期排他、保存途中の再入場分類、既存内容検証の分離に続き、現在状態の本文と操作・資源・回復参照の構造検査を追加した。新codecの関連単体14件と限定再レビューはPassである。分離時の局所回帰218件とは確認範囲を区別する。最新Snapshotの本番保存、Host回収前提の接続、旧保存撤去と実E2Eは未完了で、全体能力Graphの既知停止も維持する。[現在の範囲](99_Roadmap/Changes/CHG-000082/change.md#現在状態codecの構造相関--2026-10-07)を参照する。

移管された実行Evidenceは既存Markdownへ正式要約として集約し、未コミットJSON46Fileを独立確認後に回収した。過去の対象版・結果・観測限界は保持し、実行別の書庫を増やさない。[集約結果](99_Roadmap/Changes/CHG-000082/Evidence/261006_release-test-retention-phase4.md#移管jsonの正式要約と終了処置--2026-10-07)を参照する。

tmp清掃では終了済みログ104件と、承認された配布・試験生成物11件（合計約711MB）を追加回収した。公式CLIへの切替は局所確認・限定独立レビューまで完了したが、署名と実Provider E2Eは未実施である。Coverage保存先と署名Fixture命名の二件は是正済み。横断命名検査では既存Sourceの258件の指摘が残り、全域Passとはしない。旧改造CLI専用診断は廃止し、実Filesystem連続処置だけを正式試験へ移して17件成功・限定独立レビューPassとした。追加75ファイル（約519MB）も回収し、旧空.operations/.stagingとtests/coordinator-launchを回収し、試験親フォルダの再生成も是正した。署名一時配置はtmp/signatureへ切替済みで、局所試験と限定独立レビューはPassである。実署名・製品E2Eの未評価は維持する。新公式CLIの認証／取消E2E義務は維持する。[現在の処置と確認範囲](99_Roadmap/Changes/CHG-000082/change.md#tmpの追加回収と横断確認二件の是正--2026-10-07)を参照する。

Native試験の保存先整理は、残る九能力十実行とNode／Native排他互換を正式入口へ移し、全十一実測・独立再レビューを完了した。旧六領域2,041File（約255MiB）を確認後に回収し、`.crdd/verification`は不存在、`.crdd/tests`は空である。これは保存先整理の完了であり、署名・製品E2E・v0.22全体完了を示さない。[実施結果](99_Roadmap/Changes/CHG-000082/change.md#残るnative試験の移行と旧実物の終了処置--2026-10-07)を参照する。

署名範囲の縮小は実装と二観点の独立再レビューを完了し、必須追加指摘0である。全Repositoryの候補展開をやめ、固定Git版の実行閉包とNativeだけを照合するV6方式へ切り替えた。準備・署名・昇格・終了清掃を同じ端末所有権へ接続し、中断前の参照搬送も既存の一時操作記録だけで処置する。新しいstateや回復DBは追加していない。局所試験、型・整形・Lint、Headerと構造検査は成功したが、実署名・TTY・実子Process境界は未評価で、旧V5 ManifestによるV6昇格試験の前提不整合も残る。新方式の実Runtime利用可能・全E2E成功・Release可能を主張しない。本体Manifestを保全し、コミット・プッシュは人間指定により停止中。[現在の処置](99_Roadmap/Changes/CHG-000082/change.md#2026-10-06の範囲見直し--署名対象と一時配置の縮小)を参照する。

②の保存方式刷新は完了した。受付世代、終了整理、本番v2保存PortとRepository実切替を実施し、履歴は30日保持、終了済み処置後は旧IDの再利用を拒否する。候補・認証・署名・正式Evidenceは保全した。現署名候補のproduction初期化2件は成功。全Portable収集の失敗六件を未署名試験の前提欠陥として隔離し、関連35件すべて成功。本番Sourceは不変で、Architecture／Quality最終独立レビューもPass、必須是正0件となった。③以降・全製品E2E・全品質項目の未完了は維持する。[②の完了判定](99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#36-②の完了判定)を参照する。

2026-10-07の採用範囲照合では、独立Trust Policyの起動接続義務を現行必須から除去した。現在のSemantic集合は17意味、実装Relationあり17・自動Test Relationあり16・手動確認待ち1である。未実装機能を実装済みにはしていない。

過去の2026-10-06のReality Auditは13QA・176検証項目、試験Relationあり132・なし44、Symbol616（重複・未定義参照0）。18意味中16は実装と自動試験の両Relation、1は未接続、1は手動確認待ちである。これは品質項目のPass数ではなく、全項目のEvidence適用はOPENを維持する。[現在の現実照合](99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md)を参照する。

①の一時領域・検証資料整理は承認済み限定範囲で独立確認Passとなった。Coordinator記録の縮小とCandidateの7日保持は後続段階であり、②の保存切替だけを根拠に実装済みとしない。署名済み実Provider E2E・Release全体の成立も今回の限定確認から推定しない。[整理①の結果](99_Roadmap/Changes/CHG-000082/Evidence/261005_runtime-data-phase1.md#14-①の独立確認結果)を参照する。

CRDDはv0.21.0を公開済みで、v0.22.0の実装・検証を進めている。v0.22.0の目標Release日は2026-10-03である。Project Contextは五つの代表場面を共通形式で回答する要求を採用し、試験した最小形式をRepository共通入口へ昇格している。署名候補のProject Runtime公開MCP実Provider E2Eは通常二経路・取消・exact Recovery・最終資源回収まで合格した。Workbench、必要な四経路および残る品質項目の確認を継続しており、全体合格とRelease判断は未成立である。

| 種別 | 項目 | 現在状態 | Owner Relation |
|---|---|---|---|
| 現在事実 | 公開Baseline | v0.21.0 | Git tag `v0.21.0`、Commit `e9947d4f733c3c46b90ee9f78c70898d1920bae9` |
| 現在事実 | v0.22.0 | 実装・検証進行中、目標Release日2026-10-03 | [Roadmap](99_Roadmap/01_Roadmap.md)、[CHG-000082](99_Roadmap/Changes/CHG-000082/change.md) |
| 現在事実 | Project Context | Repository投影、Manifest v2 Identity照合、Markdown／Codex確認、Repository単体MCPおよびCROS Credentialで絞ったRemote Project Context MCPが成立 | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[Repository MCP検証](99_Roadmap/Changes/CHG-000082/Evidence/260927-2014_phase4-project-context-mcp.md)、[Remote MCP検証](99_Roadmap/Changes/CHG-000082/Evidence/260927-2029_phase4-remote-project-context-mcp.md) |
| 現在事実 | 情報入口 | Project ContextをOverviewとし、Topic、Meeting、Roadmap、Quality、DocumentationおよびRuntime Stateを各Ownerから読む能力地図を整理済み | [能力地図](01_Discovery/Analysis/EXP-000029/capability_map.md) |
| 現在事実 | Topic／Meeting操作 | Repository CRUD Coreと共通Applicationが成立し、WorkbenchおよびRepository単体MCPから登録・編集・Cursor一覧・取得・Relation影響付き削除を同じ契約で利用できる。同一Repository内ではOutcome表とAction移管表を同時更新し、全Outcome処置後だけMeetingを閉じられる。Remote CROSではRequestごとにCredential／Grant／Exposure／Bindingを再検証し、Workbenchが許可済みPortfolio Sourceを明示選択して同じ操作をMCP経由で行える。別RepositoryのRelationは同じSessionで許可された一意なOwnerへ遷移できるが、Relationを別Repository書込みAuthorityにはしない | [REQ-000039](01_Discovery/Definitions/REQ-000039/requirement.md)、[Remote Workbench検証](99_Roadmap/Changes/CHG-000082/Evidence/260928-0325_phase5-remote-workbench-topic-meeting.md) |
| 現在事実 | Workbench | Phase 4 Gateを通過しProduction Closureを進行中。表示基盤はReact＋Viteの純粋なClient-side Renderingへ移行し、全画面DOMのOwnerをBrowser Reactへ一本化した。Node Serverは固定Document Shell、JSON Read Model、認証・Authority、Repository Effectおよび固定Asset配信だけを所有し、SSR、Hydration、Raw HTML FragmentまたはDOM再読取りを行わない。JSONはCredential verifier、Remote接続Bearer、Private Key、Host Pathおよび永続Authorityを含まず、Process限定Action TokenとCredential操作直後の一回表示Tokenだけを用途限定Fieldで扱う。Current Release／Quality Projection、起点Section付きOwner Relation検索、Runtime ActivityのEvent／Remote投影、Topic／Meeting Collection／Detail／同一・Repository間Relation遷移／実在CHGへのTopic昇格、Remote CROSでの明示Repository選択とMCP読書き、Repository Tree／DiffおよびProject Portfolioの検索・20件単位継続読込・Source別五場面を構造化画面へ接続し、現在はCovered 13件、AI関連Partial 2件、Missing 0件である。CSR移行後の型・Lint・Build、統合試験19件および15画面のProduction DOMをDesktop／Tablet／Mobileと100%／200%／400%の27条件で実Browser再観測済みである。Visual Runnerは必須画面TargetのReact commit後に画像確定を待つ。終了要求直前に所有Process TreeをOS固有のexactな世代Identityで固定し、正常終了猶予後も残る子ProcessだけをGraphの深い順に限定処置する。Lifecycle局所ITでFallback実発行、最終Tree 0、Identity不一致／未検証時のEffect 0およびcleanup前段失敗後の後続段実行・Error集約を確認し、Production Workbenchの27条件も終了処理最大1589ms・Tree観測最大668ms・Fallback 0回で全件成功した。独立レビュー、文書監査およびGap／Impact監査はFinding 0で完了した。AI依頼は読取り助言／変更候補を明示し、Coordinator Mode Routerが別Executorへの配送・観測・取消と根拠参照付き結果の実行時検証を保持する。Repository単体Production CLIは検証済みRootの`PROJECT_CONTEXT.md`を内容Hash付き専用Task PacketへEffect 0で固定し、採用済みCatalogの同一改訂から選択ProfileのAdapter、Model、Reasoningを解決する。一依頼の外部送信確認、Provider別固定Adapter、Repository非共有Command Plan、Provider出力抽出、Executor Core、一回消費Packet、`workbench_advice` Docker Modeおよび変更候補Executorまで成立した。変更候補はStoreから再読取りしたMetadataの確認、操作ごとの明示確認、Project Runtime Lease、Revision・dirty・Scope再観測、Receiptと耐久記録を通る別操作で採用または破棄できる。採用してもCommit／Pushは行わない。Shared Serverは固定OS設定、検証済みRepository／Workspace Exposure、REST／MCP同一HTTPS Origin、外部TLS終端契約、Host限定Credential回復および終了後資源0まで成立した。未完了は実Provider E2EとAI関連2画面のClosureである | [CHG-000082](99_Roadmap/Changes/CHG-000082/change.md)、[純粋CSR移行](99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md)、[Shared Server運用境界](99_Roadmap/Changes/CHG-000082/Evidence/260928-1114_phase5-shared-server-production-boundary.md) |
| 現在事実 | 品質 | 移管母集団46 Local Itemのうち13件観測済み・33件未観測。Shared Gateway非開示の一項目を追加し、全体集計は内訳不整合により再照合中。移管一覧とv0.22採用Scopeは同一視しない。全体Quality Readyは未成立 | [Quality Center](07_Quality/01_Quality_Center.md) |

## 2. 何が危ない、または止まっているか

### 結論

v0.22.0は10/3の目標日を経過し、Release完了は未成立である。人間の最新指定により、是正前に全E2Eの成功・失敗・未実行を収集している。最新のWorkbench両助言は成功したが、送信確認の時間切れ、Project RuntimeのProvider開始前停止と未実行経路が残る。以前の通信断も解消済みとはしない。[全体確認の途中結果](99_Roadmap/Changes/CHG-000082/Evidence/261004_all-e2e-collection.md)を現在の根拠とする。期限やScopeをAIだけで変更しない。Project ContextではOwner Artifactとの二重管理を避ける必要がある。Manifest v2と公式Repositoryの自己適用には暫定Repository IDを設定したが、正式固定はv0.22の契約固定時に再評価する。

| 種別 | 結論 | 影響 | 根拠 |
|---|---|---|---|
| 現在事実 | v0.22.0は目標日を経過・Release完了未成立 | 2026-10-04（日本時間）時点でPhase 5進行中。未完了の回復、Workbench実Provider経路と品質確認を保持し、期限・Scopeの変更は人間が判断する | [Roadmap](99_Roadmap/01_Roadmap.md)、[CHG-000082](99_Roadmap/Changes/CHG-000082/change.md) |
| 現在事実 | v0.21対象のHybrid 12件、Manual 10件は未観測 | 全体Quality Readyを主張できない | [Quality Center](07_Quality/01_Quality_Center.md) |
| 現在事実 | 最新のCodex／Claude助言は成功。実Task経路には停止・未実行が残る。旧Coordinator状態は人間指定でリセット済み | 是正前の全体収集の未完了義務を維持する。以前のGET通信断は今回再現しなかったが、解消済みとしない。明示リセットを通常の製品回復成功や全E2E合格へ読み替えない。リセット前の旧Host三件の観測は履歴根拠として保持する | [全体確認と明示リセットの記録](99_Roadmap/Changes/CHG-000082/Evidence/261004_all-e2e-collection.md)、[通信断の履歴](99_Roadmap/Changes/CHG-000082/Evidence/261004_workbench-e2e-restart.md) |
| 共有分析 | 五場面の詳細をRootへ複製すると第二の正本になり得る | 更新負担とOwner Artifactとの不一致が増える | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[進捗契約](15_Progress.md#repository-project-context) |
| 現在事実 | Repository IDは`qual-lab.crdd-standard`を暫定採用 | Manifest v2の自己適用とFederation入力を試せる。正式固定前の変更は移行対象になる | [Manifest v2 Example](template/.crdd/config/repository-manifest.example.json)、[REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md) |

共有分析には独自IDを付けない。継続管理が必要になった場合だけ、CHGその他のOwner Artifactへ昇格する。

③のExecution Intelligence刷新と移行済み旧領域の清掃は完了した。新JSONLへ33件を移し、回収未確認10件はそのまま保護した。Execution Intelligence全82件、Workbench全33件、Coordinator関連13件、命名・Header契約全19件が成功し、独立再レビュー二観点もPass、必須是正0件となった。旧JSON33ファイルを削除後、新履歴33件・全時刻・保護10件と旧領域不存在を確認した。追加指定されたPath閉包6指摘も解消し、保存基盤59件・直接利用側32件・Runtime Data38件と独立再レビューで確認した。署名E2Eや全域Passとは扱わない。[③の完了範囲](99_Roadmap/Changes/CHG-000082/Evidence/261006_execution-intelligence-phase3.md#③の完了判定--2026-10-06)、[清掃結果](99_Roadmap/Changes/CHG-000082/Evidence/261006_execution-intelligence-phase3.md#移行済み旧領域の清掃--2026-10-06)と[追加是正の判定](99_Roadmap/Changes/CHG-000082/Evidence/261006_execution-intelligence-phase3.md#検証と完了判定)を参照する。追加の署名・Provider依頼・Docker操作は行っていない。

## 3. 今、人間が決めることは何か

### 結論

人間は作成境界の局所診断後、この開発PCの旧Coordinator実行状態のリセットと、記録・回復方式全般の縮小を指示した。一時43フォルダ、旧記録353ファイルと空記録Directory44件を削除し、送信同意2ファイル、認証Home、署名鍵、Repository成果物とEvidenceを保持した。保存済み署名Runtimeの読取りInventoryは回復待ち・active Home Bindingとも空である。旧Taskの作成結果は不明のままで、通常回復成功または全E2E合格へ変更しない。一次失敗診断の追加実装は未署名であり、今後の記録方式は現在状態・未解決回復・診断履歴を分離して設計を見直す。[現在の方針と結果](99_Roadmap/Changes/CHG-000082/Evidence/261004_all-e2e-collection.md)を優先し、以下の局所設計は当時の経緯として扱う。残る品質義務とRelease判断は保持する。

旧記録には作成したProcess・世代の結合がなく、保存済み診断の終了記録も三件へ結合できない。旧PIDの完全復元を永久の停止条件にせず、実際のCoordinator生成処理・子孫の現在の終了と、旧対象への再入場抑止を接続する。現在のProcess件数やLockだけでは非使用成立としない。2026-10-04に、人間はこの作業の試験以外ではCoordinatorを利用していないことと、既知7バイトfile一件を別の限定設計へ含めることを回答した。これは元Processの終了証明や実処置許可ではない。長寿命のAWS・単純待機・Computer Use Tool候補を、無根拠にCoordinator停止対象へ含めない。[現在の確認範囲](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#非使用確認の対象範囲を実在するcoordinator入口へ限定)に従い、対象を使えるCoordinator所有処理を特定する前に一括停止しない。実停止、固定OS保存場所の変更と既存三件の削除は別承認である。新クラスの専用記録codecと同handleのfile読取りは[自己生成対象で局所確認した](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#既知fileの記録候補と同handle読取り--2026-10-04)。十二実体の専用観測搬送と保存前の全対象Known照合は自己生成対象で局所確認した。Native保存・読戻しはSource上で接続し、[不正入力と本文Hash差の取得前拒否を実CLIで確認した](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#十二実体のnative保存読戻し接続--2026-10-04)。[Coordinator Adapter／caller耐久記録もSource接続し、自己生成Repositoryの保存・読戻し・非置換を局所確認した](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#十二実体のcoordinator保存読戻し接続--2026-10-04)。正常な固定OS保存・Native読戻し、本番再入場と公開処置は未成立であり、実残存の回収・全E2E・Release可能とは扱わない。

Host回復の記録準備と専用環境の是正は、局所47件・選択三契約と読み取り専用実診断を通過した範囲で確認した。一時親の取得停止は解消したが、実共有境界の移行は未実施である。通常producerの保護付き初期化と専用Native搬送をSource接続し、自己生成r3と局所搬送で作成・再利用・拒否を確認した。[配布依存の登録漏れを是正し](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#配布依存の登録と型引数付き関数の検査--2026-10-04)、旧v0.21の利用側集合を含む16関連試験・165 Source確認と現在の配布読取り診断が成功した。[配布検証ファイル全128試験も合格した](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#配布検証の試験ファイル全体の回帰--2026-10-04)。先行16件はその内数である。実署名搬送や公開Recoveryの成立とは区別する。署名付き実OS作成と既存ACL移行の確認は残る。[通常作成の保護と限定ACL移行](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#共有管理フォルダの保護不一致と次の判断--2026-10-04)は、同じCHGの設計・実装・試験へ追加することが承認された。共有親だけのACL移行案はその後取り下げ、現在の承認質問にしない。旧三件の処置条件の未確認は保持するが、追加復旧基盤の完成を保存済み署名Runtimeの固定E2E開始の一律前提にしない。実権限変更・実OS作成・旧三件処置は発行していない。[現在の結果と限界](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#十二実体の記録準備と実環境の保存境界--2026-10-04)に従い、正常保存・清掃・公開Recoveryの未成立を維持する。

[新しい試験のヘッダーと品質項目への関係の漏れを是正した](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#試験ヘッダーと品質項目への接続の是正--2026-10-04)。選択四契約とシンボルGraphは成功した。試験本体や実権限条件を変更した結果ではなく、先の128件回帰・実回復・全体品質とは区別する。

署名候補d36a9decと旧結果は保持しており、現在は再署名や秘密入力を求めていない。過去のDocker再起動承認をHost回収へ拡張せず、元Taskの完了、実清掃、全E2E合格またはRelease可能を主張しない。詳細は[限定保守の現在記録](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md)、原Taskの結果は[候補通信診断と終了待ち](99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md#候補d36a9decの署名通信切断の切り分けと終了待ちの不足)を参照する。

Workbenchの新モデル移行では、起動時のTool許可集合を固定する最小Adapterの追加が承認された。助言用の操作禁止は維持する。署名候補d36a9decで最新のCodex／Claude助言は成功したが、変更候補を含む全E2Eは未成立である。次は是正より先に残る経路を実行して結果をそろえる。6.1 Sol標準／6 Luna軽量用途へのモデル方針も承認済みである。承認済み方針は保持するが、現在は追加の署名入力を求めていない。今後必要となる署名の秘密入力は人間が行う。この承認をRelease承認とは扱わない。Repository IDの正式固定は、Project Context契約の固定時に改めて人間が判断する。

| 判断 | 判断する人 | 選択肢・影響 | Owner Relation |
|---|---|---|---|
| 確認済み（別途利用なし・既知fileの限定設計追加） | Qual-Lab | この作業以外のCoordinator利用なし。指定Rootの7バイト試験file一件を設計へ含め、空クラスは維持する。実停止・削除許可、非使用確認または回復成立とは扱わない | [人間回答と設計追加](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#人間回答と限定対象の設計追加--2026-10-04) |
| 確認済み（同じCHGの限定Recovery追加） | Qual-Lab | 設計・実装・局所反証・独立確認の範囲は承認済み。Coordinator所有範囲で調査・是正し、Windows再起動を前提にしない。候補判定を実処置・清掃完了へ読み替えず、実Process停止、実在三件の削除、元Token生成、Provider再送、Docker再起動とReleaseは含めない | [限定保守の現在記録](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md) |
| 確認済み（Coordinator所有範囲での回復方式） | Qual-Lab | 終了・利用抑止・排他・限定清掃で閉じる方向の調査と是正を承認済み。OS保証・全利用側・旧形式の非使用を確認できるまで実処置不可。実停止・削除は別承認。Windows再起動を現在の必須操作としない | [現在の方式と限界](99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md) |
| なし（同じTask回復IDの検証付き再起動を承認済み） | Qual-Lab | 再起動とTask回収を完了し、再観測で回復一覧cleanを確認した。新しいProvider依頼や永続データ削除は行っていない。助言成功または全E2E合格とは区別する | [新候補の回復記録](99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md#最大2ターン候補cb0bdb85の署名と結果取得前の通信失敗) |
| なし（最大2ターンPilotを承認済み） | Qual-Lab | 一つの依頼・一回送信・Tool禁止・Repository非共有を維持して限定実測へ進む。独立確認、新署名と実Provider成立を確認するまで正式化しない | [最大2ターンPilot](99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md#人間承認済みのclaude最大2ターンpilot) |
| なし（最小起動Adapter追加を承認済み） | Qual-Lab | 専用実行物の構築・配布・保守を含む承認済み範囲は維持する。署名候補d36a9decは成立したが、変更候補生成と全E2Eは未成立である。実Taskは上記停止Gateを保持し、承認だけから利用可能またはRelease可能とは表示しない | [CHG-000082](99_Roadmap/Changes/CHG-000082/change.md)、[移行の着手前確認](99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md) |
| なし（確認済み） | Qual-Lab | v0.22はRepository内＋Project横断＋AI利用構成を扱い、Workbench要求も採用済み。Discovery整理を閉じて次工程へ進める | [Scope探索](01_Discovery/Analysis/EXP-000034/exploration.md)、[REQ-000040](01_Discovery/Definitions/REQ-000040/requirement.md) |
| CRDD標準RepositoryのRepository IDを正式固定するか | Qual-Lab | 現在判断ではない。v0.22では`qual-lab.crdd-standard`を暫定採用し、Project Context契約固定時に維持または変更を判断する | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[Runtime Data Architecture](06_Architecture/Details/runtime-data/01_Architecture.md#5-configとrepository-identity) |
| なし（確認済み） | Qual-Lab | WorkbenchはDirection Aを採用し、公式CRDDロゴとNoto Sans CJK系Fontを使う | [Visual Baseline](04_UI/Details/Visual/workbench-hero/visual-baseline.md)、[CHG-000081](99_Roadmap/Changes/CHG-000081/change.md) |

## 4. なぜこの状態・判断になったか

### 結論

Workbenchを先に作るのではなく、どのConsumerでも同じProject理解へ到達できる交換契約を先に成立させると確認したため、Project Context Projectionを優先している。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| Project Context Projectionを第一段階とする | AIや媒体ごとの再探索と回答差を先に解消するため | [EXP-000029](01_Discovery/Analysis/EXP-000029/exploration.md)、[REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md) |
| WorkbenchはDirection Aと15 Screen ArchitectureからProduction化する | Project Contextだけでは日常操作とVersion Controlを一つの仕事として扱えず、Screen Inventory、Hero探索、Secondary展開と人間判断を経て具体化したため | [UI Detail](04_UI/Details/01_UI_Detail.md)、[CHG-000081](99_Roadmap/Changes/CHG-000081/change.md)、[CHG-000082](99_Roadmap/Changes/CHG-000082/change.md) |
| Deadlineは任意だが開始時に確認する | 未設定と確認漏れを区別し、設定済み期限をRisk分析へ使うため | [EXP-000031](01_Discovery/Analysis/EXP-000031/exploration.md)、[REQ-000037](01_Discovery/Definitions/REQ-000037/requirement.md) |
| UI／SPEC Detail契約はv0.21成果物へ伝播済み | v0.22固有設計前に既存Canonical Chainを閉じるため | [CHG-000081](99_Roadmap/Changes/CHG-000081/change.md) |

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 理由・成立条件 | Owner Relation |
|---|---|---|
| 是正前に残るE2Eを実行し、結果をそろえる | 人間の最新指定。端末の送信確認が時間切れになった実Task経路と未実行経路を再確認し、成功・失敗・未到達を区別する。旧三件の処置やRecovery拡張を先行しない | [全体確認の途中結果](99_Roadmap/Changes/CHG-000082/Evidence/261004_all-e2e-collection.md) |
| 残る品質項目を設計・実装・実測へ照合する | REQ-000037〜041の設計伝播を完了した後も、Relationだけを成立Evidenceとして扱わず、各検証義務を実際の観測へ接続する必要があるため | [Quality Center](07_Quality/01_Quality_Center.md)、[Discovery台帳](01_Discovery/01_Product_Discovery.md) |
| Workbenchの実Provider E2Eと残る画面Closureを行う | 15画面の実Browser Visual Gate、読取り助言／変更候補のProduction Runtimeおよび候補の別採否操作は成立した。残るAI関連Partial 2画面を実Codex／Claudeと最終Production Closureで再評価するため | [CHG-000082](99_Roadmap/Changes/CHG-000082/change.md)、[実Browser Visual Gate](99_Roadmap/Changes/CHG-000082/Evidence/260928-1028_phase5-workbench-actual-browser-visual.md) |
| 次工程Gateでv0.22.0の日程Riskを再評価する | Scopeは確認済みだが、2026-10-03までの残作業と検証費用は工程進行に合わせて更新する必要があるため | [Roadmap](99_Roadmap/01_Roadmap.md)、[REQ-000037](01_Discovery/Definitions/REQ-000037/requirement.md) |
| 現状の全体検証後にWorkbenchのUX／IAを見直す | 人間が表示スペース、情報の見せ方および作業導線の深掘り不足を懸念している。まず現状の局所試験・必要な署名E2E・全回帰・独立レビューを一区切りとし、その後に認識合わせを行う。機械検証の合格を使いやすさの成立へ読み替えない | [検証と見直しの順序](99_Roadmap/Changes/CHG-000082/change.md#現在の検証と次のworkbench見直しの順序) |

## Checklist

- [x] Project ID、Repository IDおよびRepository Roleを評価した。
- [x] 三つのIdentityがRepository Manifestと一致している。
- [x] 五場面を省略せず、結論を先に示した。
- [x] 現在事実と共有分析を区別した。
- [x] 正本が存在する内容をOwner Relationへ接続した。
- [x] Project Context固有の安定IDを追加していない。
- [x] 項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。
- [x] 確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。
- [x] Owner Artifactとの競合時はProject Contextを現在値として使わない。
- [x] 保存済みの次候補と対話時の追加提案を区別できる。
- [x] Gateを閉じる前に再投影要否を評価する。
