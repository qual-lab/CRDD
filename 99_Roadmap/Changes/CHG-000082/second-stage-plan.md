# 第二段階：責務・状態所有・実行境界の再編計画

成果物種別: 変更計画
状態: In Progress（1〜5の着手許可。未決Architecture候補は未採用）
対象変更: [CHG-000082](change.md)
基準改訂版: `98cab6e3278a61684c557a6499cfb602e2d19111`
維持責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-09

## 1. 結論と実行境界

第一段階の名称・物理配置整理を基準とし、第二段階は責務、状態所有、公開操作、本番利用側を整理する。Package単位で段階的に実装・検証するが、上位と下位の契約は実装前に一括照合する。Packageの実装完了と、上位Capability全体の成立を区別する。

現行CRDDの工程順序を維持する。既存REQ／UX／IA／UI／SPECの意味を確認し、変更が必要な箇所だけ所有工程へ戻す。その後Architecture基本設計・詳細設計、Qualityの検証義務・検証設計を更新し、実装・検証へ進む。添付の概念図を理由に工程順序を変更しない。

| 項目 | 今回の扱い |
|---|---|
| 人間の許可 | 第二段階の計画作成に続き、2026-10-09に計画Commit後の1〜5着手を許可。添付の未決候補を一括採用したとは扱わない |
| 変更分類 | 非自明な責務再編。公開入口・保存契約・安全境界を変更する箇所は破壊的変更として個別に影響を提示する |
| 変更意図 | 既存採用Capabilityを保持し、重複状態・不要中継・過剰管理を削り、構造を説明可能にする |
| 書込み範囲 | 現在のCRDD Repository。外部Runtime、認証領域、別Repositoryの変更は本計画だけでは許可しない |
| 対象外 | 新しいAI機能、汎用Recovery／Lock Framework、Event Bus、共有実行Registry、先行したLinux配備、新しいUser Account |
| 歴史的Evidence | 当時の名称・署名・Hash・内容を保持。新構成の成立根拠には流用しない |
| 旧形式の移行 | フロントAIの確認・清掃手順が所有する。本番Sourceへ旧形式互換Readerを追加しない。未解決資源・参照を名前だけで消さない |
| v1.0との関係 | 添付は方向性であり、全候補をv0.22必須へ昇格しない。Release範囲・期限は別の人間判断 |

## 2. 着手前の照合と最初のGate

現行の[責務対応資料](Evidence/261007_develop-responsibility-mapping.md)、Orchestrator詳細設計、Package集合・直接importを確認した。現行設計にはCoordinator単体利用、Coordinatorの耐久記録・受領確認、Host排他への上位依存が残り、添付の目標と単なる配置変更以上の差がある。現行CROS HTTP、MCPのShared Host組立て、WorkbenchのPackage内部参照も移管対象の候補である。

現行Source全体・動的入口・配布閉包の全数照合はまだ行っていない。次の対応表を固定するまで削除・置換を開始しない。

| 固定するもの | 必要な内容 |
|---|---|
| 成立済みCapability | 公開操作、利用形態、正常・失敗・取消、過去の成立根拠と現在の限界 |
| 契約と利用側 | 公開API、CLI、MCP、Workbench、scripts、設定、保存値、Symbol、試験、配布・署名閉包 |
| 状態・資源の所有 | Task／Attempt／Queue、結果、Candidate、認証Home、Process、Container、Network、Lock、Recoveryの現在Ownerと移管先 |
| 各Fileの処置 | 維持／移動／統合／分割／廃止／判断待ち。分割では対象Symbolまで特定する |
| 既知不足 | 第一段階の責務混在12件、Native試験のSource分類、4試験SuiteとscriptsのSymbol接続、手動端末Probe、旧Recovery APIの型不整合、持ち越した5C |

旧5Cは免除せず、新しいOwner・必要保証・検証へ対応付ける。ただし旧方式の追加是正を先に完成させてから捨てる進め方は採らない。新契約で不要となる項目には理由を残し、旧Gateを新構成の合格へ読み替えない。

この段階の成果は、責務のBefore／After、依存方向、保持する保証、廃止候補の利用側影響、未決判断である。ArchitectureとQualityの独立確認後、人間が必要な変更を判断し、実装順を固定する。

## 3. Packageの推奨対応順

全16現行親Folderを対象に、変更不要も理由付きで処置する。`docker-isolation`は新設候補であり、採用前に作成しない。

2026-10-09の人間判断により、当初案の実行系6〜8を公開入口9〜11の後へ移す。大改修に先立ちCROS／MCP／Workbenchを整理するため、改訂後は公開入口を6〜8、実行系を9〜11とする。実行系の要求・結果・取消の目標契約は順序0で照合するが、その実装を前倒ししない。

前半の公開入口整理では現行の実行APIと安全境界を維持し、UI／Protocolの責務を実行内部から分離する。後半の差し替えに備えるためだけの中継Frameworkや二重実装は作らない。未成立の実行機能は未成立のまま示し、公開入口の限定完了と実行系を含む全体完成を区別する。公開入口を閉じるために実行系の変更が不可欠と判明した場合は、その依存を示して順序を再判断し、黙って大改修を前倒ししない。

| 順序 | 主対象Package | 主な作業・閉じる範囲 | この順序の理由 |
|---|---|---|---|
| 0 | 全体のArchitecture／Quality | 前節の対応表と上位・下位の要求／結果／取消／状態Ownerを固定する。Docker分離、単体Coordinator入口等の判断を得る | 下位を先に作り、後から上位の都合で契約を作り直すことを避ける |
| 1 | `version-control` | Repository／Revision／Git操作／採用時の短い書込み境界を整理。Layout観測とExclude更新を分離 | Domain保存と候補採用の基盤。worktree採用を前提にしない |
| 2 | `domain-model` | 意味・CRUD・保存の責務を整理。Topic／Meeting、投影と候補判断、型集合の混在を処置。改訂競合・必要な短時間排他・atomic公開を評価 | 上位が保存方式を重複実装しないため。DomainからGit Commit／Pushを発行しない |
| 3 | `execution-intelligence` | 実行事実・要約と評価候補を分離。時刻、欠測、保持設定と最小Event契約を確認 | 実行系再編に先立ち、記録する事実と記録Ownerを決める。実行制御を持たせない |
| 4 | `ai-adapter` | ProfileとProvider固有要求・CLI引数・結果変換・エラーを整理。公式CLIを未改造で使う | CoordinatorからProvider差を外す。AdapterからTask進行や履歴保存を発行しない |
| 5 | `platform-access` | 実行系が本当に必要とするOS保証と呼出し側を全数照合。必要Native部品だけ整理し、Nodeで同じ保証を満たせる部分は置換候補にする | Docker／Processの設計前にOS保証を確認。Package廃止やRust全面置換は事前決定しない |
| 6 | `cros` | Registry／Credential／Exposure／認可／Routingの必要責務を確定。重複Context意味生成を整理し、CROS REST／Gatewayを廃止して必要機能を移管 | Domainと現行実行APIを利用して横断境界を先に整理する。Package維持／廃止は別途判断する |
| 7 | `mcp-server` | Machine向け公開契約とstdio／HTTP lifecycleを閉じる。Shared Host所有と配布入口の巨大組立てを整理 | CROSの責務整理を受けて公開入口を整理。実行内部は現行契約を維持し、単一RepositoryとCROSで操作Schemaを不用意に分岐させない |
| 8 | `workbench-server` | 本番組立てをbinからSourceへ移し、Browser API／Local呼出し／Remote MCPを接続。変更通知・編集中入力保護を具体化 | 公開入口の責務整理を実行系大改修より先に閉じる。UX／IA・Visualの人間確認とBackend整理を区別する |
| 9 | `docker-isolation`候補／現行Coordinatorの隔離処理 | 採用した境界で隔離実行・取消・観測・清掃・必要最小の再入場を移す。使い捨て資源、一次失敗と清掃結果の分離を実環境で確認 | 後半の大改修では最初に資源Ownerを閉じる。Coordinator／Orchestratorの業務状態を持たせない |
| 10 | `coordinator` | AI Adapterと隔離APIを利用する実行・Executor／Reviewer・進捗・取消・結果返却へ集約。重複永続状態とConsumer保存依存を削る | 下位の終了条件が成立してからAI実行を組み立てる。下位から上位をimportしない |
| 11 | `orchestrator` | Task／Attempt／Queue・実行順・判断待ち・耐久結果を一つのOwnerへ集約。採用した本番入口を接続し、整理済み公開入口の利用側を追従する | Coordinatorの実結果を上位状態へ接続する。内部モックだけで本番完了にしない |
| 12 | `artifact-signing` | 最終実行閉包と必要な署名保証に合わせ、Release Tooling／Runtime検査の境界を整理 | Source移管ごとの反復署名を避ける。ただし実行系設計に影響する保証は順序0で先に判断する |
| 13 | `official-asset-governance` | 保存と認可・判断実行の混在を処置。比較交換・確定単位を保つ | 実行系と独立して閉じられる。今回も第三の中継層を追加しない |
| 14 | `semantic-coverage` → `checker` → `verification-runner` → `visual-preview` | Compiler／結果変換、Rule／CLI、Catalog／許可／回帰選択等を整理。新所有者の検査と実行Profileを完成させる | 全体の最終契約へ合わせる。移管中に必要な検査追従は各順序で先に実施し、ここまで放置しない |
| 15 | 全体 | 全回帰、Reality Audit、独立レビュー、必要な実Provider・署名E2E、移行・公開文書・現在状態を更新 | 全Package単体の合格だけから全体完成を推定しない |

## 4. 大改修する実行系の切り方

後半の実行系では実装順を下位から、要求設計を上位から行う。改訂後の段階9〜11を一度に全置換しない。前半で整理した公開入口へのAPI追従は各Package変更に含め、最終実境界は新構成で再確認する。

| 段階 | 閉じる内容 | 次へ進む確認 |
|---|---|---|
| 隔離境界 | 使用資源、入力、開始・終了、取消、Process終了、清掃、親喪失時に残る資源と最小処置 | Provider依頼なしの実Docker局所試験で、成功・開始失敗・取消・終了観測不能を区別できる |
| Coordinator実行 | Profile解決済み要求、公式CLI、Executor／Reviewer、進捗通知、最終結果。一次失敗を清掃結果で上書きしない | 下位の実結果を用いた結合試験と固定Taskの局所実Provider確認。表示・任意保存を清掃条件へ入れない |
| Orchestrator進行 | 受付、Queue、Task／Attempt、結果の耐久保存、人間判断、再開 | 本番入口から正常・取消・中断再入場・候補採否・競合を確認し、共有状態の重複がない |
| 公開利用側 | CLI／Workbench／MCPの実行経路と表示・操作 | 同じ公開Capabilityと認可を使い、単体試験成功を公開全体の完成へ昇格しない |

Dockerは隔離を維持し、Containerの継続利用を回復目標にしない。資源を安全に処置し、新しいAttemptを開始できることを目標とする。過去のunknownを成功へ変更せず、現在の資源不存在と再実行可能性を別に評価する。成立が立証された限定ケースだけを閉じ、汎用強制削除や共有Recovery管理へ拡張しない。

Consumerの結果保存はそのOwnerが担当する。Orchestratorの耐久受領と、Dockerの資源回収を分離する。応答文章とCandidate本体も区別し、意味のある候補・失敗根拠だけ必要なOwnerで保全する。

## 5. Packageごとの完了・Commit条件

主対象は一Packageとするが、API変更に伴う直接利用側、試験、設定・配布入口、Architecture／Quality／Symbolの追従は同じ変更に含める。Folderを厳密に一つに限定して壊れた呼出し側を残さない。一時的な汎用Adapterや旧方式互換Frameworkを増やさず、必要な連動切替は同じCommitへまとめる。

1. 該当する正本と公開契約、保持する保証、変更しない範囲を確認する。
2. 必要なArchitecture／Quality更新と人間判断を先に済ませる。
3. Source・試験・直接利用側・Schema・Symbol・設定・入口を更新する。
4. Formatter・型・Lint・静的契約、Package回帰、影響利用側の結合試験を実行する。
5. 外部資源Ownerを変更した段階では、その局所実境界を先に確認する。全E2Eを最初の影響分析にしない。
6. 固定差分を独立レビューし、対象内指摘を是正・再確認する。
7. 現在状態・対応表・CHGを更新し、完了したPackage単位でCommitする。Pushは人間が許可した運用範囲に従う。

Packageの限定完了は未検証の全体をPassと表示しない。既知の基準版不整合は切り離して記録するが、今回の変更が使う契約の不整合は先に解消する。削除前には代替先と利用側の接続、新しい根拠を照合する。

## 6. 判断が必要な地点

| 判断 | 提示する根拠 | 判断時点 |
|---|---|---|
| Coordinator単独の本番入口を廃止するか | 現行CLI／Workbench／MCP／scriptsのConsumer一覧、Orchestrator経由の代替、失う操作 | 順序0、公開入口変更前 |
| `docker-isolation`を独立Packageにするか | 現行File・資源Owner・AI Adapterとの依存、独立試験の実益、Package内Module案との比較 | 順序0、抽出前 |
| worktreeか現行隔離Snapshotか | Canonical保護、候補採用・競合、共有Git metadataとMount境界、運用費用 | 順序1〜2の設計。採用まで新方式を作らない |
| 署名・Native保証をどこまで削るか | 現在守る保証、具体的Consumer、Node／既存隔離による代替と残存Risk | 順序0で設計制約、順序5・12で具体的削除判断 |
| CROS Package維持か廃止か | 必要なRegistry／認可／RoutingのOwnerと、移管で増える依存・中継 | 順序6の実装前 |
| Workbenchの利用導線・表示・Visual | 現行UX／IAとの比較、Screen Inventory／Flow、代表画面と代替 | 順序8の接続維持後、画面再設計前 |

これらを一括質問せず、必要な根拠が揃った地点で推奨と影響を提示して止める。単なる内部File移動へ追加判断を要求しない。

## 7. レビュー・監査と収束

現在は1〜5へ着手しているが、未決Architecture候補の採用・全Sourceの監査・全体の実境界試験を完了したとは扱わない。順序0の全体照合は継続し、既存設計に整合する限定内部整理から進める。未決契約の削除・置換は照合と判断前に行わない。各Packageでは変更した責務に対する独立レビューと、必要な文書・不足影響監査を選ぶ。準拠基準自体を変更する場合だけ準拠監査を追加する。Communication／市場探索は公開訴求を変更しない段階には追加しない。

最終確認は変更した意味から全回帰面を導出する。正式Evidenceは判断に必要な結論・対象版・条件・根拠参照へ集約し、実行ごとの巨大ログをCHGへ保存しない。通常履歴・一時物の保持と、正式Evidenceの保持を分ける。

収束条件は、採用済みCapabilityの全対象にOwner・利用側・検証が対応し、重複状態と不要中継の処置が説明でき、未決の必須条件を将来へ隠していないことである。理想構造の完成や試験量の最大化を目的にしない。

## 8. 1〜5の着手結果 — 2026-10-09

計画Commitは`459d598d`。現行設計・Source・直接利用側から処置を具体化し、未決の実行系改修は前倒ししていない。

| 順序 | 現在の処置 | 次の確認 |
|---|---|---|
| 1 Version Control | 除外設定更新を既存`git/local-ignore-adapter.ts`へ移し、Layoutは観測・共通再検証へ限定した。公開API、128KiB上限、関数本体、結果型、Lock・更新順序を維持。限定独立レビュー指摘0 | この限定移管は確認済み。worktree方式変更・採用境界の設計変更は未採用で、別途比較する |
| 2 Domain Model | 共通活動操作・型を`activity/operations.ts`／`activity/types.ts`へ移管。一時保存型は`storage/types.ts`へ限定し、投影と候補判断を同じContext領域の別Fileへ分離。限定独立レビュー指摘0 | 本体・型・公開集合一致、Package回帰106件とCROS／MCP／Workbench型接続を確認。全体Checkerの未変更Coordinator指摘は別残件として保持する |
| 3 Execution Intelligence | 改善提案を`evaluation/improvement-candidates.ts`へ移管し、事実Eventの検査・Summaryを一方向に利用する。公開API・提案本文・結果値不変、限定独立レビュー指摘0 | 基準・変更後各82件のPackage回帰、公開入口契約、Orchestrator／Workbench型接続を確認。保存方式や採用Authorityは変更しない |
| 4 AI Adapter | Provider認証Probeの出力判定・非正常終了分類をAI Adapterへ移し、Coordinatorの引数再検証を既存Provider記述へ接続。限定独立レビュー指摘0 | Package回帰13件、Controller／Effect結合126件を確認。隔離資産の移管は後半のDocker Owner確定まで先行させず、署名・実Provider境界の未評価を保持する |
| 5 Platform Access | OS保証と実利用側を照合。Namespace初期化・親chainと対象観測を分離し、公開Protocol・権限・終了条件は維持 | 通常Native回帰と限定独立レビューで確認する。実OS専用fixture、Docker Desktop部品の撤去・Native廃止・再署名は局所整理の完了に含めず、後半実行系の判断へ対応付ける |

### Version Controlの限定確認

- 基準Package回帰46件全件Pass。移管後に所有者分離の契約試験を追加し、最終47件全件Pass、Skip／Failとも0。
- Formatter、型検査、LintはPass。通常／linked worktree、七つの更新失敗段階、実Process競合、再入場、公開Symbol・Consumer閉包の既存試験を維持した。
- 移動したブロックを基準`98cab6e3`と機械比較し、Owner名の説明・末尾改行以外は一致。関数本体・結果形式の変更なし。
- 着手前の独立確認と変更後の限定独立レビューを実施。指摘0。既存両Fileと試験SuiteのSymbol登録は変更不要。
- 実Git試験の一時RootはRepository内`.crdd/tests/stage2-version-control`へ限定。Docker／Provider依頼、認証領域変更、署名・Release操作は行っていない。
- これは除外更新Owner移管の成立根拠であり、第二段階全体の完了・新方式Candidate採用・署名配布の成立根拠ではない。

### Domain Modelの限定確認

- 活動操作の実体は一つのまま保持。Topic／Meetingの種別固定操作、保存実装、Cursor、改訂競合、削除確認、昇格・Outcome処置は変更していない。
- 読取り投影は`project-context/source-projection.ts`、候補採否判断は`project-context/candidate-decision.ts`が所有する。判断条件・結果値・保存形式は不変。新しい公開Symbolや中継層は追加していない。
- 基準版と変更後のPackage回帰は各106件全件Pass、Skip／Failとも0。Formatter、型検査、Lint、CROS／MCP Server／Workbench Serverの型検査はPass。
- 移管した関数本文、活動型・一時保存三型、Rootの公開Symbol集合を基準Commitと機械比較し一致した。直接参照、Symbol登録、Architectureの配置、Checkerの公開Path集合を追従した。
- 着手前整合確認と変更後の限定独立レビューを実施し、指摘0。全体Checkerの公開入口検査はPassだが、未変更CoordinatorのNative試験Header・型分類・Test Symbol登録で二つの検査が失敗した。全体Passとは扱わず、後半の実行系整理へ残す。
- Docker、外部Provider、署名・配布、保存Lifecycleの変更は対象外。候補判断関数の移動を正本Effectの実行検証とは扱わない。

### Execution Intelligenceの限定確認

- 改善提案を既存の評価領域へ分離し、記録・検査・要約は既存Ownerに保持した。新抽象、Provider呼出し、採用権限、自動変更は追加していない。
- 提案関数本文とRoot公開Symbol集合を基準版と機械比較し一致。不正Eventの拒否、欠測、根拠Event ID、契約文字列、`proposal`、Authority非付与は不変。
- 基準・変更後各82件のPackage回帰は全件Pass。Formatter、型、Lint、Orchestrator／Workbenchの型検査はPass。Checkerの公開入口・依存方向・階層の限定3検査はPass。
- Architecture、Symbol、新Ownerを検証する既存二Suite、直接参照、Checker期待集合を追従。着手前確認と変更後の限定独立レビューは指摘0。
- 全体Checkerの未変更Coordinator指摘と、後半の実行系・署名実E2Eは残る。局所結果から全体完成を主張しない。

### AI Adapterの限定確認

- 認証Probeの判定は`profile/subscription-status.ts`、非正常終了分類は`output/provider-error.ts`が所有する。Process・取消・回収・実行AuthorityはCoordinatorに保持する。
- 基準`57495b94`の旧関数本文と、移管後の二関数本文を独立レビューで機械比較し一致した。Offering、厳密認証と対話認証の別契約、分類順序・上限・理由値は変更していない。
- 引数再検証では既存の認証記述とClaude引数Builderを利用する。引数順序、助言経路の例外、Docker設定は不変。公開入口、Symbol、Controller試験の実装参照、Checker期待集合、Architectureを追従した。
- AI Adapterの書式・型・Lint・回帰13件はPass。Controller／Effect結合試験126件はPass、Skip 0。変更SourceのLintとCoordinatorのSource型検査はPass。Coordinatorの試験型検査は未変更二Fileの既知18件で失敗し、全体Passとは扱わない。
- 固定差分の限定独立レビューは指摘0。実Provider／Docker起動、認証操作、署名・配布は行っておらず、これらの実境界成立の証拠ではない。

### Platform Accessの保証・利用側照合

| 保証の所有範囲 | 現行利用側 | 今回の処置・Nodeへの置換評価 |
|---|---|---|
| RootのIdentity・アクセス観測 | CoordinatorのPlatform Access境界とRoot契約。検証済み実起動に未接続の入口は未接続のまま保持 | `root_observation`／`protection`を維持。NodeのPath文字列・stat・accessは同handleのWindows権限照合と同じ保証ではない。未接続を不要の根拠にしない |
| Provider Home／Candidate Store／Runtime Stateの保護 | `provider/home-windows-adapter.ts`、`platform-access/protected-root-windows-adapter.ts` | `protected_root`／`principal`／`protection`を維持。固定Known Folder、利用者SID、非Reparse、同handle Identity・DACL、限定初期化を環境変数や通常File APIで代替しない |
| System Directoryと最小子Process環境 | `host-execution/windows-directory-bootstrap.ts`と子Process環境構成 | `windows_directory`を維持。OS取得値と環境変数の文字列を同一視しない |
| Host Namespaceと終端記録 | `host-execution/terminal-windows-adapter.ts`とcaller checkpoint | Namespaceの三実体・保護・初期化を`host_namespace`、十一／十二対象の読取り・再照合・終了を`terminal_target`、容量・予約・保存・読戻しを`host_record`へ分離。保存区間の排他・receiptは同じ同期Ownerへ保持し、追加Frameworkを作らない |
| 固定Docker Desktop・署名Publisher・所有子Process | `docker-desktop/repair-native-process.ts`と既存修復・再起動入口 | WinVerifyTrust、Process実体、suspended→Job→resume、終了確認を維持。Node spawn・hashだけへの置換は同じ保証の根拠がない。修復削減は後半の実行系へ接続する |
| 固定Protocolと結果搬送 | Native `main.rs`／`protocol`、上記TS Adapter | Rust側の未信頼入力検査とTS側の未信頼応答検査は異なる境界。片側だけ成功することを理由に重複として削除しない |

上表は現在利用する保証とOwnerの照合であり、新しい保証の採用・実OS検証の完了ではない。Nodeへ移せる純粋なcodec・hashだけを抽出するための新APIは追加しない。必要性のない移管は依存と検証費用を増やすためである。

### Platform Accessの限定確認

- 対象観測の530行を`filesystem/terminal_target.rs`へ移管し、基準`9f6fd8c2`とブロック全体の機械比較で一致した。公開範囲、八／九handleの保持・逆順close、十一／十二実体の別契約、部分取得・元失敗と終了不明は不変。
- Rust直接利用側は`host_record`へ保持し、既存fixtureの名前・実行条件を変更しない。Native公開入口、wire、TS Adapter、Docker修復処理は変更していない。
- Architecture、Symbolと既存試験の実体参照、Module宣言、Coverageの明示Source集合を追従した。Coverage集合の存在しない旧`provider_home.rs`参照は現行`protected_root.rs`へ訂正した。
- 基準・移管後の通常Native回帰は各44単体＋6CLIがPass、23件は明示ignored。Cargo書式確認・Clippy（warning拒否）はPass。ignoredの実OS専用fixture、計測Coverage、署名・実Dockerは今回実行していない。
- 新Sourceは既存Native検証入口の再帰Source閉包へ含まれる。現行署名済み実行物を新Treeの検証証拠へ流用せず、後半で新しいBuild Identity・配布閉包・必要な署名境界を確認する。
- 限定独立レビューの文書図1件を是正し、Namespaceの直接dispatchと対象／記録要求を実装に合わせて分けた。是正後の未解決指摘0。実装上の保証漏れ・本体変更は検出していない。

## 9. CROS／MCP／Workbenchの移管前照合 — 2026-10-09

### 結論と判断境界

CROSの登録・認可・横断投影は独立した責務であるため、Packageは維持する案を推奨する。CROS専用REST／Gateway／Shared Hostは廃止対象であり、BrowserとWorkbench Server間のPresentation APIは維持する。Package維持の採否は人間判断待ちで、以下は移管案である。未採用の構成をSourceへ実装しない。

着手前の読取り専用確認により、現行利用側、移管先の不足、保持保証と依存順を照合した。これは段階6の独立完成レビューや実装許可ではない。変更経路は既存CHG内の責務再編であり、実装時はArchitecture／Quality、直接利用側と配布入口の不足影響・文書確認、固定差分の独立レビューを行う。準拠基準・公開訴求・Release判断は変更しないため、準拠監査・市場探索・署名実E2Eをこの棚卸しへ追加しない。

### 現行利用側と移管案

| 現行入口・利用側 | 移管先・処置案 | 保持する成立条件と現在の不足 |
|---|---|---|
| Workbench Server→`readRemotePortfolio`→CROS REST | 既存MCPの`crdd.list_projects`／`crdd.get_project_context`へ切替 | 一覧はProject ID・状態・Source数のみで、完全なPortfolioではない。個別取得との整合、許可Source、五場面、欠測・競合を保持する読取り手順を設計する。接続済みとは扱わない |
| Workbench Server→`readRemoteAiProfileCatalog`／`executeRemoteAiProfileMutation`→CROS REST | Profile参照・管理をMCPの専門Adapterへ接続してから切替 | 現行MCPには未接続。systemAdmin限定、expectedRevision競合、削除確認、理由・現在Snapshotを保持する。管理権限からProject本文アクセスを生成しない |
| Workbench Server→`readRemoteRuntimeActivity`→CROS REST | Runtime活動の読取りをMCPへ接続してから切替 | 現行MCPには未接続。要求ごとの現在Credential・Exposure、許可Repository集合、cursor、limit（既定20・1〜50）、`observed/absent/unknown`、Event欠測・継続を保持する。欠測を空一覧の正常状態へ畳まない |
| Workbench Server→Topic／Meeting MCP Adapter | 既存MCP操作を維持 | 明示Repository、改訂競合、確認付き削除、Relationの非開示を保持。共通通信処理を整理する場合も汎用接続Frameworkを追加しない |
| CROS `connection/http.ts`内の型とReader契約 | 認可・横断投影の実責務Ownerへ移す | Exposure Snapshotに加えRuntime observation／event／readerも対象。MCP resolver、設定Reader、Workbenchの直接利用側を同じ切替へ含める |
| MCP `shared-host/server.ts`のREST・MCP・Gateway三Listener組立て | Shared Host／Gatewayを撤去し、MCP自身のHTTP lifecycleへ集約 | Origin、TLS終端、mirror header、Bearer、payload制限、切断・停止時の取消／join、Listener／Socket回収を維持する。Local呼出しはTransportを省いても認可を省かない |
| `/.well-known/cros-health`、Shared Server起動・設定・運用入口 | 旧入口を撤去し、必要な受付観測をMCP自身へ対応付ける | Transport受付は認証、Project参照、Provider正常、実行能力の成立を証明しない。旧URLの利用側、公開Launcher、設定、試験・運用手順の全数照合は未完了 |
| Credential発行・回復 | 既存Local管理入口に保持 | 秘密の発行能力をMCPへ新設しない。MCPは認証済み要求を認可へ接続する |
| Browser→Workbench API | 維持 | Server→CROS RESTの廃止と混同しない。表示導線・Visualの再設計は別の人間確認へ戻す |

### 削除までの依存順

1. CROS Packageの採否後、共通契約と保持する認可・結果意味をArchitecture／Qualityで固定する。
2. 未接続のProfile管理・Runtime活動をMCPへ接続し、正常、拒否、競合、欠測、取消と終了後状態を確認する。
3. WorkbenchのREST利用四入口をMCPへ切替え、既存Topic／MeetingとBrowser APIを維持する。
4. 代替接続・試験・設定・公開入口・Symbolを照合した後、CROS REST／Shared Host／Gatewayを撤去する。旧通信実装を互換Readerとして残さず、導入側移行はフロントAI手順へ接続する。

REST試験は機械的に削除せず、認可、管理、ページング、結果検証、取消・終了のOracleを新Ownerの試験へ対応付ける。未対応Capabilityがある間は旧処理を置換済みと表示しない。Docker／Coordinator／Orchestrator大改修は前倒ししない。

### 基準回帰の確認

- CROS Packageの静的確認と回帰33件はPass、Skip／Fail 0。これは現行RESTを含む基準結果であり、新MCP接続の結果ではない。
- MCP Packageは初回50件中1件が旧改名Path二箇所のENOENTで失敗した。試験の参照を現行`transport/stdio.ts`／`transport/streamable-http.ts`へ訂正後、静的確認と50件がPass、Skip／Fail 0。ProtocolがError envelopeを所有するassertionと対象数は不変である。
- 上記実行対象はHEAD `d25f4851`とMCP試験の二Path訂正。実行結果はTool出力から確認し、再実行は各Packageの`npm test`を使用する。外部Provider・Docker・認証・署名操作は行っていない。巨大ログの複製は作らない。
- Workbenchの基準回帰は33件中31件Pass・2件Fail。Node依存閉包の旧入口Pathと、現行Vite Build結果に未追従の追跡Bundleを検出した。入口・Server・Browser参照を現行配置へ訂正し、Bundleを再生成した。再BuildのSHA-256は`ffcecf344cbc6559b07e0a94a1d5615c08b34208fe0d4d865b7e5f2609f0d3ef`で一致。静的確認・対象二試験に続き、是正後の全回帰33件もPass、Skip／Fail 0。Browser実操作・Visual評価・実Provider成立を示す結果ではない。
- MCP試験・Workbench依存試験・生成Bundle・本節の固定差分を限定独立レビューし、指摘0。試験参照更新の意味と保持条件、Bundle Hash／Index Blobの一致を確認した。独立確認者はBuild・試験を再実行しておらず、実行結果は親のTool出力から確認した。Repository内の専用試験一時Rootは終了後にcacheだけであることを確認して回収する。

Related:
- [現行の責務対応と第一段階結果](Evidence/261007_develop-responsibility-mapping.md)
- [Orchestrator詳細設計](../../../06_Architecture/Details/orchestrator/01_Architecture.md)
- [コーディング規約](../../../06_Architecture/99_Coding_Standards.md)
- [変更管理](../../../19_Maintenance.md)

## 10. 段階1〜5の全体照合と是正対象 — 2026-10-09

限定移管と局所回帰は成立しているが、Package全体の完了は未確定である。二つの読取り専用確認を統合し、以下を全数追跡する。CROSの採否待ちを理由に独立した是正を停止せず、後半の実行系大改修も前倒ししない。

| 対象 | 不足と最小処置 | 保持する条件・確認方法 | 現在状態 |
|---|---|---|---|
| Domain ModelのTopic／Meeting保存 | rename後のLock解放失敗を上位の入力不正・Effect 0へ丸める経路を除く。保存Ownerから一次失敗とcleanup結果を分離して搬送する | 正常CRUD・Revision・Relationは不変。rename後close／unlink故障と実ファイル・公開結果の相関を局所試験する。汎用Recovery Frameworkを追加しない | 一次失敗／cleanup分離とMCP／Workbenchの誤変換は局所是正済み。親link、部分write、読戻し、耐久性、実Process競合等の保存全体保証は次行で未完了を維持 |
| Topic／Meetingの保存境界 | 親Directoryのlink経由を拒否し、保存確定・読戻しの観測を接続する | Root外書込み禁止、保存形式・ID・認可Ownerは不変。親link・途中置換・読戻し失敗・実Process競合を反証する | 未是正。既存primitiveの利用可否を先に照合する |
| Version Control公開入口 | 跨Packageの実体Path importを既存Root exportへ接続し、閉包試験へ禁止例を追加する | 新API・中継Fileは作らない。署名閉包のPath文字列とimportを区別する | 代表3利用側と既知Consumer集合を訂正済み。全利用側の閉包確認は残る |
| 現在の設計・Header | Domainの廃止済み入口、AI Adapterの旧配置参照、純粋計画のEffect記載、EI WriterのEffect・排他記載を実体へ合わせる | 関数本文・公開結果・Authorityは不変。書式・型・Lintと限定独立確認を行う | 訂正済み。限定独立確認は指摘0 |
| AI Adapter純粋試験3Suite | Codex／Claudeの構造化結果とBilling試験を実装Ownerへ移し、Symbol／Catalog／回帰入口を接続する | 14 caseの拒否例・Oracleを保持する。Coordinator結合試験は一括移管しない | 未移管 |
| 上記3SuiteのQA対応 | 現在のRCM-UT-016／AIT-UT-005はProvider結果／Billingの検証意味と一致しない。Canonicalから該当義務を再照合する | 物理移動を理由にQAの意味を改変しない。正しいLocal Itemへの接続を確定してから全体Passを評価する | 未是正 |
| Topic／Meeting操作試験のQA対応 | Reader専用のCPR-IT-008へ更新試験が混在していた。保存操作はCPR-IT-010、保存例外はCPR-IT-011へ分離する | Readerの正本Effect 0は維持し、新項目へ詳細設計§9.1・SPEC-000013、Suite Header、SymbolとCatalogを接続する | 是正中。010は既存7件の部分検証で、通常update・確認付きdelete・改訂競合の試験接続は未確認。公開面の保存故障応答と実OS cleanup全体は未評価 |
| Source／Symbol閉包 | 単純Path照合の未登録候補8Fileを、代表入口への集約登録と個別責務の方針へ照合する | 8件を直ちに欠落と断定しない。実体・公開helperの対応で判定する | 未確認 |

実OS fixture、Coverage計測、新Build／署名閉包、実Provider・Docker、ST／UATと人間受入は未評価として後続の実境界確認へ接続する。局所回帰や安全な拒否を上位保証の完成へ昇格しない。過去Evidenceは当時の条件のまま保持する。

今回の参照・Header訂正後、Domain Model 106件、Execution Intelligence 82件、AI Adapter 13件、Workbench Server 33件、Version ControlのConsumer閉包12件は全件Pass、Skip／Fail 0。五Packageの書式・型・LintはPass。既知Consumer集合へ実利用側2件を追加し、厳密集合比較は維持した。限定独立レビューは指摘0。これらは上表の未是正の保存保証・QA対応を満たす根拠ではない。実Provider依頼、Docker操作、認証・署名・Release操作は行っていない。

### 保存例外の局所是正と全体Checker再確認

MCP公開応答の次段階では、明示Schema拒否と保存境界の内部故障を分離する。ID書式・Revision・limit・states件数の公開Schemaを前検査へ同期し、Query／CursorはDomainの既知一覧拒否3理由だけをlist呼出しに限定して対応付ける。書込みで同じ理由の例外が出ても内部故障とし、例外本文・秘密値・Pathを公開しない。既存MCP操作3件はReader項目008から010へ、新故障試験は012へ接続する。Workbench、Remote失敗、投影再読取りと実OS cleanupは未評価として後続へ保持する。

独立レビューで参照IDと不正Markdownの拒否が内部故障へ変わる反例を確認し、固定参照ID Schemaと既存Domain Parserの配送前検証を追加した。owner／none参照と正常結果は不変。QA導出表・条件表、File／共用Helperの012接続も同期する。MCP回帰51件と書式・型・LintはPass、最終追加反例の局所4件もPass。保存後の例外は実更新済みRevisionを保持した注入で検証しており、実OS故障・rollback・cleanupの保証へ昇格しない。

是正後のSource・品質／文書の独立確認は残指摘0。最終Header更新後も書式・型・Lintと局所4件はPass。全体Checkerは3025件で未合格（前回3026件から今回SuiteのCatalog Owner不一致1件を解消）。変更したMCP詳細設計、QA定義、試験Pathそのものの新指摘はないが、CHG本文から旧MCP試験Pathへの既知broken-linkは残る。未完了のWorkbench応答・保存Owner保証・横断移管整合を後続で閉じる。

### Workbenchの保存故障応答

入力評価後、Local操作／Remote要求の直前にだけ配送段階を記録する。前段拒否は既存400、配送以降の内部故障は固定500へ分離し、正常blocked結果の303は維持する。自己生成の空Topic保存先を通常fileへ変え、入力不正と保存開始時故障を対比する。通常Topic CRUDへ改訂競合・削除確認の反例も接続する。Listenerの終了は新しいTCP接続で確認し、HTTP keep-aliveの既存接続切断とは分ける。試験Root回収は観測assertionが失敗してもfinallyで実行する。

この局所処置はRemote故障、Workbench保存後故障・投影再読取り、実OS保存確定・cleanup全体の完成ではない。Workbench全回帰33件、局所2件、書式・型・LintはPass。Sourceと品質／文書の独立レビューは指摘0。全体Checkerは3024件で未合格であり、今回SuiteのCatalog Owner不一致1件を解消した。Workbenchの別Suiteに残る既知Owner不一致3件は未是正として区別する。実Provider、Docker、署名、実Browser操作の検証根拠にはしない。

### Topic／Meeting保存Ownerの失敗分離

既存同期Lockと短命Fileの形式を維持し、一次処理とcleanupの失敗を標準AggregateErrorで分離する。close失敗でもunlinkを試み、rename失敗後の短命Fileはexact unlinkのENOENTだけを不存在として扱う。新Recovery／Kernel Lock Frameworkは導入しない。Repository SuiteをReader用008から正常010・故障011へ訂正し、旧Reader Oracleは維持する。独立レビュー2指摘は試験所属RepositoryへのRoot固定と分析の失敗構造記述へ是正し、再レビューは両方指摘0。訂正前の全回帰108件と、訂正後の局所3件・書式・型・LintのPassを区別する。最終全体Checkerは3024件で未合格、今回の変更Pathへの指摘0。親link、読戻し、write自体の部分失敗、耐久性、実Process競合は未完了であり、保存全体完成とは表示しない。注入closeは実Handleを閉じた後の失敗報告で、実OS close失敗時のHandle回収を証明しない。実Provider・Docker・認証・署名・公開操作は行っていない。

Topic昇格・Meeting Outcome処置のcatchを純粋Markdown変換だけへ限定した。既存Repository契約へ更新前／実更新後の例外を注入し、両公開操作から同じ例外が伝播すること、実更新後のRevisionと状態を保持することを確認した。不正変換はblocked・既存理由・Effect 0と更新0回を別に確認した。新fault試験はVCS Rootを検証し、Repository-local `.crdd/tests`の非link親と自己生成領域だけを使用する。

固定候補のDomain Model回帰107件、書式・型・LintはPass。実装・品質／文書の二つの独立レビューは是正後指摘0。QAの010は部分検証であり、保存Ownerの一次失敗／cleanup、読戻し、親link、MCP／Workbenchの内部故障応答は未完了のまま保持する。

全体Checkerは未合格。2026-10-09の実行では3026件（broken-link 3002、broken-anchor 5、Catalog Owner不一致14、verifies対象欠落3、Project Context契約1、UI／SPEC Detail下流Coverage 1）を検出した。今回更新したDomain詳細設計、QA-000005、Detail分析、Domain Symbolと操作試験Pathへの指摘は0だが、これを全体完成の根拠にはしない。現在文書・Registryの移管不整合と、変更禁止の過去Evidenceに残る当時の参照を区別して後続処置を決める。
