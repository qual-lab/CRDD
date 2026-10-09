# 第二段階：責務・状態所有・実行境界の再編計画

成果物種別: 変更計画
状態: In Progress（1〜8を継続。未決Architecture候補は未採用）
対象変更: [CHG-000082](change.md)
基準改訂版: `98cab6e3278a61684c557a6499cfb602e2d19111`
維持責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-09

## 1. 結論と実行境界

第一段階の名称・物理配置整理を基準とし、第二段階は責務、状態所有、公開操作、本番利用側を整理する。Package単位で段階的に実装・検証するが、上位と下位の契約は実装前に一括照合する。Packageの実装完了と、上位Capability全体の成立を区別する。

現行CRDDの工程順序を維持する。既存REQ／UX／IA／UI／SPECの意味を確認し、変更が必要な箇所だけ所有工程へ戻す。その後Architecture基本設計・詳細設計、Qualityの検証義務・検証設計を更新し、実装・検証へ進む。添付の概念図を理由に工程順序を変更しない。

| 項目 | 今回の扱い |
|---|---|
| 人間の許可 | 第二段階の計画作成に続き、2026-10-09に計画Commit後の1〜5着手、続いて1〜8の完了までの継続を許可。CROS Package維持判断は同日の後続判断で見直し、Access Managementへの責務再編を進める。移管の具体Ownerは§11で照合し、未決候補を一括採用したとは扱わない |
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
| 6 | 現行`cros` → `access-management`／`domain-model`等 | 認証・認可・管理回復と接続RegistryをAccess Managementへ再編し、Context集約・通信・実行判断を分離する。全Source・公開API・利用側の対応とArchitecture／Qualityを固定してから移管する | CROSを全体システム概念とPackage名に分ける。単純改名で現行責務全部をAccess Managementへ吸収せず、旧Package撤去は全責務と利用側の接続後とする |
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
| CROS Package維持か廃止か | 必要なRegistry／認可／RoutingのOwnerと、移管で増える依存・中継 | 2026-10-09の維持判断は後続の人間判断で見直し。認証・認可を`access-management`へ再編し、その他責務を実Ownerへ移した後に旧`cros`を撤去する。専用REST／Gateway／Shared Host廃止方針は維持する |
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

本節はPackage維持判断変更前の照合・実測履歴である。維持判断と以下の実施順は§11で見直された。現在のOwner方針と再開Gateは§11を優先し、本節の維持前提を現在の実装許可へ流用しない。過去の判断・観測・検証結果自体は変更しない。

### 結論と判断境界

CROSの登録・Credential・認可・横断投影は独立した責務として、2026-10-09の人間判断で独立Package維持を承認した。CROS専用REST／Gateway／Shared Hostは廃止対象であり、BrowserとWorkbench Server間のPresentation APIは維持する。以下の対応をArchitecture／Qualityと利用側へ具体化してから実装する。未決の実行系構成をこの判断から採用しない。

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

### 現行Ownerと本番未接続の区別

読取り専用の移管前確認を完了し、次の三能力を旧RESTから新Ownerへ対応付けた。下表は実装前の処置であり、新MCP接続の完成根拠ではない。

| 能力 | 意味・操作の現行Owner | 保持する試験と移管時の不足 |
|---|---|---|
| Portfolio | CROS `federation/project.ts`の`createPortfolioProjection`／`resolveAuthorizedRepositories` | CROSの許可Source・無効Bearer非開示、MCPのWorkspace限定搬送、WorkbenchのCoverage・失効後Current表示拒否を保持。一覧と個別取得の間で別Snapshotを混入させない読取り契約が必要 |
| AI Profile管理 | AI Adapter `catalog/types.ts`と`profile/administration.ts`の`createAiProfileCatalogAdministration`。CROSは管理可否を判定する | AI Adapterの競合・確認付き削除Oracle、CROSの非管理者403・Catalog非開示、Workbenchの管理者限定表示を保持。MCP Schema／route／Resolverは未接続。本番CROS LauncherもAdministrationを注入していない |
| Runtime活動 | 現行CROS `connection/http.ts`の観測・Event・Reader契約。実状態はOrchestratorが所有する | CROSのReader入力を許可Repositoryに限定するOracleと非開示Project拒否、WorkbenchのRemote活動表示を保持。型・読取り契約をTransportから分離する。MCPと本番CROS LauncherのReader注入は未接続 |

現行の主なOracleはCROS `remote-transport.contract.test.ts`、MCP `cros-project-context-mcp.integration.test.ts`、Workbench `workbench-server.contract.test.ts`およびAI AdapterのCatalog／Administration試験にある。REST試験の成功だけでは管理操作全体を網羅しない。`template/tools/crdd-cros-server.ts`はRegistry・Exposure・Topic／Meetingだけを組み立て、設定型にもAdministration／Runtime Readerがない。したがって、本番未接続を単なるTransport移動で解消済みと扱わない。Credential発行・回復は既存Local管理入口に保持する。

### 削除までの依存順

1. 承認済みCROS PackageをOwnerとして、共通契約と保持する認可・結果意味をArchitecture／Qualityで固定する。Exposure・Runtime観測／Reader型をHTTP Transportから分離し、Root export・設定Reader・MCP Resolver・Workbenchの直接利用側を追従する。
2. 未接続のProfile管理・Runtime活動をMCPへ接続し、正常、拒否、競合、欠測、取消と終了後状態を確認する。本番Launcherの依存注入も閉じる。現行`crdd-cros-server.ts`と設定型は両能力を注入しておらず、optional Portとfixture成功を本番成立へ読み替えない。
3. WorkbenchのREST利用四入口をMCPへ切替え、既存Topic／MeetingとBrowser APIを維持する。
4. 代替接続・試験・設定・公開入口・Symbolを照合した後、CROS REST／Shared Host／Gatewayを撤去する。旧通信実装を互換Readerとして残さず、導入側移行はフロントAI手順へ接続する。

REST試験は機械的に削除せず、認可、管理、ページング、結果検証、取消・終了のOracleを新Ownerの試験へ対応付ける。未対応Capabilityがある間は旧処理を置換済みと表示しない。Docker／Coordinator／Orchestrator大改修は前倒ししない。

### 段階6の型所有者分離 — 着手前照合

後続の共通認可接続は、既存認証関数を置換せず、HTTPとMCPに重複する認証後のSnapshot／Session／許可Repository集合だけをCROS `access/resolve.ts`へ集約する。着手前確認で認証順序とSession失敗の入口別処置を照合した。Contentでは各認証一回・Snapshot一回、ProfileとContent POSTではSnapshot零回を維持する。Reader故障を認証失敗へ丸めず、管理権限だけでContentを開示しない。Rootへ新関数一つを意図的に公開するが、新Tool、Store、Authority、Frameworkは追加しない。既存HTTP／MCP回帰、観測回数と失敗反例、実装・品質独立レビューで確認する。検証完了は未確認である。

共通化候補のCROS33件とMCP51件は成功したが、独立レビューは両観点で同じMinor1件を検出した。Readerを裸で渡すと従来のReceiverを失うため、HTTP二箇所・MCP一箇所だけを元入力への呼出しclosureへ訂正する。全結果統合と是正方針照合後、両入口の既存試験へ通常method Readerと観測回数のOracleを追加した。認証順序、失敗結果、公開集合、Authorityは変更せず、修正後候補で回帰と再レビューを行う。

是正後の固定候補はCROS33件、MCP51件、Workbench33件と各静的確認・Workbench BuildがPass、Fail／Skip／取消0。MCPに存在しないformat scriptを指定した初回確認は失敗して試験へ到達せず、既存Biomeで対象二Fileを整形して静的確認から再実行した。九Pathの限定再レビューは実装・品質とも指摘0。認証後Scopeの共通Owner接続を限定完了とし、段階6〜8のTool登録・本番接続・旧REST撤去は継続する。実Provider／Docker／署名操作は行っていない。

基準Commitは`3b3827a5`。既存HTTP内の四公開型だけを移す。認可Snapshotは`access/types.ts`、Runtime活動のEvent／観測／Readerは詳細設計§6.1と同じ`activity/types.ts`が所有する。Portfolioを扱う`federation`へ活動型を混在させない。HTTP lifecycle Handle、実関数、Validator、認可分岐、公開Symbol集合と型shapeは維持する。設定ReaderとRoot exportを同時に切替え、MCP Resolver／Shared Host／非開示試験、WorkbenchとCROS試験は既存Root参照で追従する。代表登録は`cros.public-api`と`cros.remote-transport`からの型依存閉包として照合し、毎Fileの新登録や新中継は作らない。

着手前の読取り専用確認で型Ownerと全直接利用側を照合した。新しい状態・資源・Authority・Effect・取消経路は導入せず、既存HTTP回帰とCROS／MCP／Workbench静的確認を使う。公開型本文一致・公開集合保持・代表登録到達を確認し、固定差分を独立レビューへ渡す。新MCP接続・本番Launcher・旧REST撤去は後続に保持し、今回の型分離を段階6全体の完成としない。準拠基準・外部公開訴求を変更しないため、準拠監査・市場探索・署名実E2Eは今回非該当である。

移管前CROS回帰は33件Pass。移管後は四型の宣言本文とRoot公開80 Symbolの集合一致、CROS／MCP／Workbenchの書式・型・Lint成功を確認した。初回静的確認の未使用importを除去後、CROS全回帰は32件Pass・1件Failとなったが、失敗は既存Config試験の準備中の`git init`異常終了であり、Config操作の拒否Oracleへ到達していない。同じ固定Sourceの局所再実行は1件Pass。これを無言で全Passへ補正せず、全回帰を再確認する。新型FileはRootの明示exportとHTTPのtype importへ直接接続し、代表Symbolから未到達の型として扱わない。

同じ固定Sourceでの最終回帰はCROS全33件、MCP全51件、Workbench全33件がPass、Fail／Skip／取消0で終了した。各静的確認とWorkbench BuildもPass。最初の試験準備中の異常終了は原因未確定のまま保持し、最終成功をその原因解消の証明にはしない。固定七Pathの実装・品質の独立レビューは双方指摘0。型所有者分離を限定完了とし、新MCP Tool、本番Launcher接続、旧REST撤去および段階6全体の完成は主張しない。

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

### Profile管理のMCP接続 — 着手前照合

基準は`b5733c6e`。既存CROS RESTの管理権限判定と操作別Mutation検査をCROS `profile/administration.ts`へ移し、AI Adapterの既存Catalog管理・保存・改訂競合は再利用する。MCPの一覧・作成・更新・削除を同時登録し、現在systemAdminでない主体へ管理ToolとCatalogを開示しない。管理RequestはContent Exposureを読まないよう、既存ResolverのContent Scopeを必要な操作で一回だけ解決する。既存Profileの構造ValidatorはAI Adapterから再利用できる入口にし、MCPでRole／Model語彙を別定義しない。未知入力拒否、非管理dispatch零回、改訂競合、未確認削除、保存後故障・取消の非再送を確認する。同期採用済み変更は応答取消で巻き戻さない。RESTと本番Launcher／Workbenchの代替接続・撤去は後続であり、新Store・DTO・Lock・Recoveryを作らない。関連Package回帰と実装・品質の独立レビューを行う。実Provider・Docker・署名はこの接続に不要で実行しない。

Profile四ToolとCROSの認可接続を実装し、管理者／Developerの一覧全件対照、非管理Catalog読取り0、Content読取り0、正常CRUD、期待改訂競合、未確認削除、未知入力、事前取消と採用後故障／取消の非再Mutationを確認した。初回試験はメモリRegistryの初期改訂1を0と誤認して失敗したため試験入力を訂正した。AI Adapter既存試験は新公開SymbolとDomain共通Validator依存のfixture追従漏れ2件を検出し、公開集合とfixtureの検証済み依存先だけを同期した。旧Storeの初期改訂0やRuntime契約は変更していない。

独立レビューは結果の相関不足Major1と、Helper Trace・非管理読取りの否定観測・Resolver HeaderのMinor3を返した。全結果と是正方針を両観点へ統合し、AI Adapterの既存Profile管理責務で操作／理由／改訂／対象Profileを共同検査する。成功は期待改訂+1とexact対象反映または削除後不存在、拒否は操作・理由固有の存在条件と改訂を満たす場合だけ公開する。Proxy／accessor非実行と所有済みCatalogを維持し、追加snapshot／executeは呼ばない。矛盾した成功・拒否、元値の後続変更を反証した。MCP全56件、AI Adapter全29件、CROS全33件と書式・型・LintはPass、Fail／Skip／取消0。Workbench全33件とBuildは相関是正前候補でPassしており、是正後の利用側回帰と独立再レビューは未完了である。本番Launcher・耐久Store Remote接続・失効全母集合・入口比較・旧REST撤去はこの局所結果で閉じない。

是正後Workbench全33件、Build・書式・型・LintもPass、Fail／Skip／取消0で終了した。実装再レビュー指摘0と品質Minor1（拒否反例二つの原因混在）を統合し、二Snapshotの改訂だけを一致させ、操作不一致と対象不存在を独立して反証した。Source・正常Case・QA IDは不変。最終静的確認、局所3件とMCP全56件はPass、両観点の限定再確認も指摘0。Profile管理のMCP Adapter接続を限定完了とする。CROS／MCPの公開Launcher構成、WorkbenchのRemote切替、Credential非秘密管理、設定分離と旧REST／Shared Host撤去は未完了である。巨大実行ログは保存せず、再実行可能なPackage試験と対象差分へ根拠を集約する。

### 非秘密Credential管理のMCP接続 — 着手前照合

この着手前案は後続の人間判断（§11）により停止した。Source編集・試験追加は未実施であり、旧CROS Owner前提の確認を移管後の実装許可・完成根拠へ流用しない。三操作の保持義務は新Owner計画へ引き継ぐ。

基準Commitは`2f398f0a`。変更分類は承認済み二Surface再編内の既存能力接続である。MCP詳細設計§3.3の一覧・Grant変更・失効を既存CROS関数へ一回だけ直接委譲する。Request Resolverが現在Credentialを認証し、systemAdminの場合だけ三Toolを公開する。管理操作はContent Exposureを読まず、Profile名から管理権限を生成しない。発行・rotation・Host回復、Registry保存形式、Content認可、旧REST、公開Launcherは変更しない。追加State／Lock／任意結果Portや結果防御Frameworkは作らない。

正常管理、非管理者非開示、自己demote／失効の次Request反映、未知対象、不正field／型／Proxy／accessor、publish競合・例外、処置前取消と採用後取消を確認する。取消・応答故障で保存を巻き戻さず、追加inspect・publish・自動再試行を行わない。発火例は現在systemAdmin、非発火例は有効Developer、境界例は自己権限変更、判定不能例はRegistry例外であり、それぞれ三操作公開、Tool非公開、次Request反映、内部故障非開示へ閉じる。

着手前の実装・品質確認では、既存Owner再利用と三Toolの閉じた入力へ整合を確認する。Credential操作全体はQA-000007の`RFD-ST-003`、局所HTTP認可接続は`RFD-IT-013`、入力・故障・取消はQA-000009の`EST-IT-002`へ対応する。IT結果をST全体の成立へ流用せず、Local／Remote本番Launcher、耐久Store、Workbench移管と秘密発行は未完了として維持する。固定差分の実装・品質の独立レビューと直接文書伝播を行い、準拠基準・公開訴求・Release判断は変更しないため準拠監査・市場探索・署名実E2Eは行わない。

### Runtime活動の共通OwnerとMCP接続 — 着手前照合

次の固定候補は、既存HTTPの活動検査をCROS `activity/validate.ts`へ、許可Project選択・Reader呼出し・結果検査を`activity/read.ts`へ移す。新MCP `crdd.get_runtime_activity`は設計済みprojectId／cursor／limit契約だけを搬送し、一覧とRoutingを同時接続する。現在Requestで解決した許可集合だけをReaderへ渡し、非許可はReader零回、Reader不在・故障・不正結果を空成功にしない。既存Readerは取消Signalを持たないためPromise競争を追加せず、取消前は呼ばず、開始後はReader完了をjoinしてから取消応答へ戻す。Reader自体の中断・実Provider取消を保証しない。新State／Frameworkを作らず、旧REST・本番Launcher・Workbench切替は代替接続完了まで維持する。Source境界の既存回帰、新Toolの入力／結果／非開示／待機取消反例と独立レビューで確認する。

活動Toolの初回回帰は51件Pass・2件Failで、任意cursor／limitを必須扱いした入力Snapshotを検出した。既存plain-data取得と明示した許可field検査へ是正し、試験コードの型指摘も訂正した。独立レビューはReader由来Objectの検査後変更・Proxyによる余剰情報透過と、取消joinを入力拒否義務へ混在させた問題を検出した。CROSに新Frameworkを作らず既存Domain Modelのplain-data SnapshotとOrchestratorのProjection copyを利用し、所有済みの固定結果だけを公開する。Proxy／accessor非実行、primitive語彙、nested余剰値、元Object変更の非透過を反証する。取消joinは導出元付き`EST-IT-014`へ分離し、HeaderとSymbolへ接続した。初回Lintの非null断言一件と、再レビューの表空行・Event Header二点も限定是正した。

最終Runtime候補のCROS全33件、MCP全53件、Workbench全33件と各書式・型・Lint、Workbench BuildはPass、Fail／Skip／取消0。両独立再レビューは指摘0で、元結果の暗黙文字列化と検査後透過を許容していない。全体Checkerは既知と同じ3,038件で未合格であり、この局所成功で解消しない。公開Launcher、Workbench本番MCP接続、Profile管理四Tool、旧REST撤去、実Reader取消・公開Process終端と実Providerは未完了である。実Provider、Docker起動、秘密鍵・署名操作は行っていない。

限定移管と局所回帰は成立しているが、Package全体の完了は未確定である。二つの読取り専用確認を統合し、以下を全数追跡する。CROSの採否待ちを理由に独立した是正を停止せず、後半の実行系大改修も前倒ししない。

| 対象 | 不足と最小処置 | 保持する条件・確認方法 | 現在状態 |
|---|---|---|---|
| Domain ModelのTopic／Meeting保存 | rename後のLock解放失敗を上位の入力不正・Effect 0へ丸める経路を除く。保存Ownerから一次失敗とcleanup結果を分離して搬送する | 正常CRUD・Revision・Relationは不変。rename後close／unlink故障と実ファイル・公開結果の相関を局所試験する。汎用Recovery Frameworkを追加しない | 一次失敗／cleanup分離、MCP／Workbenchの誤変換、部分write・一回読戻し・静的親link拒否は局所是正済み。実Process競合等の保存全体保証は次行で未完了を維持 |
| Topic／Meetingの保存境界 | 親Directoryのlink経由を拒否し、保存確定・読戻しの観測を接続する | Root外書込み禁止、保存形式・ID・認可Ownerは不変。親link・途中置換・読戻し失敗・実Process競合を反証する | 通常保存後の一回読戻し、部分write失敗、静的親link拒否と取得順固定の協調Writer実Process競合は確認済み。非協調Processの親差替え防止は判断待ち。電源断耐久性は人間判断により今回対象外 |
| Version Control公開入口 | 跨Packageの実体Path importを既存Root exportへ接続し、閉包試験へ禁止例を追加する | 新API・中継Fileは作らない。署名閉包のPath文字列とimportを区別する | 既知Consumer集合の接続・閉包確認は完了。固定47件と独立レビュー指摘0。Coordinator配布Suiteの試験側旧Path追従も133件・独立レビュー指摘0で確認済み。Coordinator全Package完成ではない |
| 現在の設計・Header | Domainの廃止済み入口、AI Adapterの旧配置参照、純粋計画のEffect記載、EI WriterのEffect・排他記載を実体へ合わせる | 関数本文・公開結果・Authorityは不変。書式・型・Lintと限定独立確認を行う | 訂正済み。限定独立確認は指摘0 |
| AI Adapter純粋試験3Suite | Codex／Claudeの構造化結果とBilling試験を実装Ownerへ移し、Symbol／Catalog／回帰入口を接続する | 14 caseの拒否例・Oracleを保持する。Coordinator結合試験は一括移管しない | 移管済み。14 case本文・Oracle不変、Package回帰27件と関連Consumer34件を確認 |
| 上記3SuiteのQA対応 | 現在のRCM-UT-016／AIT-UT-005はProvider結果／Billingの検証意味と一致しない。Canonicalから該当義務を再照合する | 物理移動を理由にQAの意味を改変しない。正しいLocal Itemへの接続を確定してから全体Passを評価する | ERB-UT-032／033へ訂正。移管と追加容量試験の限定独立レビューは指摘0。Codexの16KiB実入力境界を観測し、28件の回帰はPass |
| Topic／Meeting操作試験のQA対応 | Reader専用のCPR-IT-008へ更新試験が混在していた。保存操作はCPR-IT-010、保存例外はCPR-IT-011、公開故障応答はCPR-IT-012へ分離する | Readerの正本Effect 0は維持し、詳細設計§9.1・SPEC-000013、Suite Header、SymbolとCatalogを接続する | QA接続を訂正し、両種別のRepository／公開CRUDと協調Writer競合を確認済み。公開面の全操作母集合、Remote故障・投影再読取り・実OS cleanup全体の未評価は保持する |
| Source／Symbol閉包 | 単純Path照合の候補を、代表入口への集約登録と個別責務の方針へ照合する | Path差を直ちに欠落と断定しない。実体・公開helperの対応で判定する | 現行TS候補10FileとJSON設定1Fileを再集計し、全候補に代表実装・内部補助・配布設定の処置を照合。下記対応を参照。個別条件の試験網羅や全Package完成を意味しない |

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

### 改名後の試験Owner追従

MCP 9件・Workbench 3件のCatalog Ownerだけを現行Packageへ訂正した。全14登録についてSymbol所属、実Pathと実File存在を照合し、JSON解析・差分確認はPass、限定独立確認は指摘0。ID、Oracle、実行環境と必須性は不変で、実試験やCROS REST／Sharedの廃止判断を代替しない。

### 保存保証の未決判断

2026-10-09の人間判断: Topic／Meetingの保存完了は通常の保存＋内容・ID・改訂の読戻し一致までとする。電源断耐久性は今回の保証へ含めない。非協調Processの親Directory差替え防止の範囲は別の判断待ちであり、この決定から免除しない。

通常の保存完了＋読戻し確認の範囲は上記判断で確定した。静的link拒否＋協調Writer競合と非協調Processの親Directory差替え防止を分け、後者の必要範囲のみ人間へ確認中である。既存Path部品の事前／事後確認だけで競合置換防止・Root外Effect 0を主張しない。未回答を高い保証の採用や保証の免除へ読み替えず、独立した移管・試験整合を継続する。

Topic昇格・Meeting Outcome処置のcatchを純粋Markdown変換だけへ限定した。既存Repository契約へ更新前／実更新後の例外を注入し、両公開操作から同じ例外が伝播すること、実更新後のRevisionと状態を保持することを確認した。不正変換はblocked・既存理由・Effect 0と更新0回を別に確認した。新fault試験はVCS Rootを検証し、Repository-local `.crdd/tests`の非link親と自己生成領域だけを使用する。

固定候補のDomain Model回帰107件、書式・型・LintはPass。実装・品質／文書の二つの独立レビューは是正後指摘0。QAの010は部分検証であり、保存Ownerの一次失敗／cleanup、読戻し、親link、MCP／Workbenchの内部故障応答は未完了のまま保持する。

全体Checkerは未合格。2026-10-09の実行では3026件（broken-link 3002、broken-anchor 5、Catalog Owner不一致14、verifies対象欠落3、Project Context契約1、UI／SPEC Detail下流Coverage 1）を検出した。今回更新したDomain詳細設計、QA-000005、Detail分析、Domain Symbolと操作試験Pathへの指摘は0だが、これを全体完成の根拠にはしない。現在文書・Registryの移管不整合と、変更禁止の過去Evidenceに残る当時の参照を区別して後続処置を決める。

### AI Adapter純粋試験と品質接続の移管

Claude結果9件、Codex結果3件、課金方針2件を実装Ownerの試験Directoryへ移管した。コメント・import移設を除く本文・Oracleは基準Commit `5c33ba70`と完全一致し、Runtime Source、安定Symbol／Catalog IDと過去Evidenceは変更していない。ARCH-000004／000015の結果解釈からERB-UT-032、ARCH-000010と既存Subscription方針からERB-UT-033へ導出し、旧Domain Outcome／Trust軸への誤接続を解消した。

独立レビュー3指摘はcoverage入口の旧Path、15 Headerの外部境界表記、容量契約値と実拒否観測の混同を是正し、再レビューは両観点とも指摘0。AI Adapterの書式・型・Lintと27件、Coordinator関連Consumerの限定strict型・書式・Lintと34件はPass、Skip／Fail 0。Coordinator全体checkは既存Checker試験の整形1件で停止、全体型検査は既知Recovery二Fileの18件で未合格。実Provider・Docker・認証・署名・費用・取消／cleanup・16KiB実逸脱拒否の成立をこの移管結果から主張しない。coverage入口の6試験Pathは実在を確認し、未実行の他試験をPassへ計上しない。

### Sourceと代表Symbolの候補照合

四Packageの`src/`とManifest Pathを再比較し、TS候補10FileとJSON設定1Fileを確認した。以前の8件を固定母集団にせず、現行実体を基準に再集計した。各HeaderのARCH、公開入口、内部importとTestの`verifies`を読取り専用で照合し、次の処置を確定した。個別File登録を増やすだけの変更は行わない。

| Package／候補Path | 現在の登録・担当範囲 | 処置 |
|---|---|---|
| Version Control `repository/revision.ts` | `version-control.public-api`のRoot明示exportと登録済みGit Revision Adapterへ接続 | Revision観測・Format検査を代表範囲として維持 |
| Domain Model `artifact/graph.ts`、`artifact/validate-schema.ts`、`artifact/parse-markdown.ts` | `crdd-domain-library.artifact-entry`とARCH-000008の`crdd-domain-library.source.src.index`。公開境界試験は双方を参照し実操作を検証 | 各実体をRootの代表範囲として維持 |
| Domain Model `reality-traceability/discover.ts` | `crdd-domain-library.reality-traceability-entry`からRoot公開。公開境界試験へ接続 | Discoveryを代表範囲として維持 |
| Domain Model `reality-traceability/issue.ts`、`reality-traceability/annotations.ts` | 登録済みGraph／Manifest検査とDiscoveryが使用する非公開の共通処理 | 内部補助として代表登録を維持 |
| Execution Intelligence `input/plain-data-snapshot.ts` | 登録済みEvent・評価・Store・投影・時刻由来分類が使用する入力防御 | 内部補助として維持。新公開Symbolは作らない |
| AI Adapter `profile/types.ts` | 登録済みProfile実行照合・Eligibilityが利用し、Rootが実行Identity型を公開 | 型契約の代表範囲として維持 |
| AI Adapter `codex/advice-distribution.ts` | Root公開と登録済み助言Commandが固定配布Identity・初期化条件を利用 | Command代表の担当範囲として維持 |
| AI Adapter `catalog/default-ai-profile-catalog.json` | 登録済みCatalog Resolverが静的import。詳細設計§5の配布設定・Schema・署名閉包対象 | TS Sourceではなく配布設定として維持 |

この照合で個別登録の実欠落は検出していない。到達・担当範囲の確認を、全正常・拒否・故障条件の試験済みや配布・署名の実検証済みへ昇格しない。安定ID、Source、公開集合と正方向Relationは変更していない。

### Codex容量境界の実入力確認

既存normalizerは変更せず、単一exact JSONへ有効なASCII空白を加えた16,383／16,384／16,385 bytesの入力を渡す。上限以下の受理と超過拒否、正規化値、生出力非公開を確認した。追加後のAI Adapter全28件と書式・型・LintはPass、Skip／Fail 0。移管14 Caseの当時の限界は保持し、追加試験を新しい成立根拠として区別する。Claudeの容量契約、実Process出力制限、費用・取消・cleanupの成立には流用しない。

Source対応表と容量試験・正本追従の固定5Fileは独立した二観点の確認で指摘0。全体Checkerは3,041件で未合格（broken-link 3,032、broken-anchor 4、Project Context契約1、verifies対象欠落3、UI／SPEC Detail下流Coverage 1）。今回の更新5Pathへの指摘は0で、過去CHGの旧試験Path参照は当時のEvidenceとして改名しない。verifies欠落3件はCoordinatorの旧Runtime Data Resolver参照であり、現在のDomain保存責務への対応を別途照合する。

### 通常保存後の読戻し確認

登録・更新のrename後、既存Record Lockを保持したまま保存先を一回読み直す。同じ読取りから得たUTF-8 bytes、ID、改訂とProject IDを保存予定値へ照合し、欠落・読取り失敗・解析失敗・不一致は完了として返さない。保存済み正本の自動rollback、読戻し再試行、新しいLock／Recoveryは追加しない。人間が採用した通常保存＋読戻しの範囲に限定し、電源断耐久性は保証しない。

Topic／Meetingと登録／更新の4経路について、正常と9故障分類の40組合せを一つの契約試験へ接続した。実bytes・改訂の保持、一次失敗とcleanup併発、Lock保持、読取り回数、不正UTF-8とmock復元・試験Root回収を確認する。既存close故障注入は所有Lock descriptorだけへ限定し、読戻しで使うFilesystem内部descriptorと混同しない。Domain Model全109件、MCP全51件、Workbench全33件と各Packageの書式・型・LintはPass、Skip／Fail 0。これは実Provider・Docker・実Browser・実OS故障や保存全体保証の完成根拠ではない。

独立レビューのSource指摘0と品質Minor2件を統合し、Meeting helperの正常／異常TraceとQA011の登録・更新対象範囲だけを訂正した。実装・40組合せ・assertion・ID・Oracleは不変で、両観点の限定再レビューは指摘0。訂正後の書式・型・Lintと局所4CaseもPass。親link、write自体の部分失敗、実Process競合と非協調Processの親差替え範囲は引き続き未完了として扱う。

### 旧Runtime Data検証参照の是正

Coordinatorの三Suiteに残る旧Resolver参照を、実際の試験本文とOracleに基づいて処置する。鍵生成Suiteは保存領域をfixture準備に使うだけで保存保証を検証しないため、当該関係を削除する。Orchestrator Compositionと開発Provider測定Suiteは、実生成したDomainの停止Errorから理由・Effect・cleanup・retry・回復参照を保持する公開投影を検証するため、`domain-model.runtime-area-result`へ接続する。Reader／Writerへ機械置換せず、Source、試験本文、QA ID、他の関係と過去Evidenceは変更しない。静的確認と独立レビューが完了するまで、是正済みの検証結果とは扱わない。

JSON解析・差分確認と旧参照0／新参照2の照合はPass。固定差分の実装・品質の独立レビューは双方指摘0。全体Checkerは3,038件で未合格だが、検証参照対象の欠落3件は解消した。残る内訳はbroken-link 3,032、broken-anchor 4、Project Context契約1、UI／SPEC Detail下流Coverage 1。試験本文とRuntimeは不変で、このMetadata是正のための実Provider・鍵生成・署名試験は実行していない。

### 保存途中の部分書込み失敗

短命Fileを排他的openで所有確定してから同じdescriptorへ書込み、close確認後だけrenameする。open失敗は他者Fileに触れず、write・close・rename失敗では所有する短命Fileだけを回収する。一次失敗、undefined例外、close／unlink併発を既存AggregateErrorへ保持し、新Recovery・Lock・再試行は追加しない。24組合せの反証を既存QA011へ接続する。親link、実Process競合、実OS close失敗と電源断耐久性はこの是正の成立根拠に含めない。実測・独立レビューは未完了である。

実測結果: Domain Modelの書式・型・Lintと全110件、MCPの同静的確認と全51件、WorkbenchのBuild・同静的確認と全33件はPass、Skip／Fail 0。最初の追加試験はEEXIST注入の内部open再帰で失敗したため、他者Fileの準備を注入外のdescriptorで行うよう訂正し、静的確認から全回帰を再実行した。Runtimeの不足を注入の修正で隠したものではない。独立Sourceレビュー指摘0と品質Minor1を統合し、Detail分析表への直接伝播だけを是正した。両観点の再確認は指摘0。既存の40読戻し組合せと正常・rename故障Oracleは維持した。今回の処置で保存全体や1〜8全体を完了とは扱わない。

### 静的な保存先親linkの拒否

既存Adapter内のDirectory観測をCRUD・一覧・CHG参照へ接続し、recursive mkdirを一階層作成へ置換する。Root・種別親・Record親のlink／junction・通常Fileを拒否し、ENOENTだけをmissingとする。Lock・短命File・rename・削除・cleanupの前に該当chainを確認し、新Lock・Recovery・公開Capabilityは作らない。観測直後の非協調Process置換はこの変更では防止せず、必要範囲の人間判断待ちを維持する。固定候補の回帰・独立確認は未完了である。

1〜5の再照合では、Version ControlのRoot公開入口への全Consumer追従が実未完了と判明した。代表3件の是正を全Consumer完成へ拡張せず、この親link処置後に実importと配布閉包のPath文字列を分類して全利用側を接続する。Domainの協調Writer実Process競合も残る。Execution IntelligenceとAI Adapterの追加必須Source是正は今回特定しておらず、Platformの実OS専用fixture・新Build／署名は後半の実境界に対応付ける。CROS Packageの採否待ちは段階6実装の停止条件であり、他の独立した残件を止める理由にはしない。

固定候補の実測結果: Domain Model全112件、MCP全51件、Workbench全33件と各Packageの書式・型・Lint、Workbench BuildはPass、Fail／Skip 0。実装と品質の独立レビューは双方指摘0。初回局所試験では既存published故障試験のcause不存在assertionが一度失敗したが、以降の局所・全回帰では再現せず、原因未確定として保持する。新fixtureのDirectory改名後junction作成はWindowsでEBUSYとなったため、初期状態から静的linkを置くfixtureへ訂正した。Productionの再試行やOracle緩和は行っていない。この結果は非協調Processの差替え防止、実OS close故障、電源断耐久性、実Provider／Docker／署名の根拠ではない。

### Version Control全利用側の公開入口接続 — 着手前照合

変更分類は既存公開契約への内部接続是正とする。基準はCommit `6ace24bb`。読取り専用確認で、本番／scriptsの40FileとTemplate入口1Fileの実importは既存Root exportだけへ切替可能と確認した。関数本文、Git引数・結果、公開Symbol集合、鍵・署名Authority、過去Evidenceは変更しない。署名scriptの二SymbolをRootへ移すため、保護import検査の対応表だけを同時追従する。実行primitive・実体Sourceの観測Path文字列は別責務であり置換しない。

試験側のdeep importは15File。Root非公開Symbolを直接検証する三Suiteは内部Adapter試験として維持し、残る公開契約の利用をRootへ接続する。新APIや公開中継は作らない。Consumer閉包試験はPackage外の実importを全数走査し、deep import、動的import、Namespace、再exportを未使用に畳まない反例へ補強する。用途別集合の厳密照合は維持する。Rootの静的依存閉包拡大は保護経路の静的契約と影響Packageの型・回帰で確認し、実署名・配布成立は未評価として分ける。

必須確認は実装と品質／伝播の独立レビュー、Consumer閉包・保護署名経路の契約試験、影響Packageの静的確認と関連回帰。規則自体・準拠基準・公開Surfaceを変更しないため、この接続是正に新しい準拠監査や実Provider／Docker／署名は要求しない。新しい公開APIが必要、関数本文や署名保証を変更する必要が判明した場合は実装を止め再整理する。

本番／scripts／Templateの41Fileと公開契約を使う12試験FileをRootへ接続した。初回独立レビューで検出した生成子Processの6参照とOrchestrator mockの2参照も接続した。閉包Helperは局所トークン走査でコメント・文字列と宣言を区別し、同一行、コメント付き宣言、backtickのliteral動的importも拒否する。任意計算specifierや任意生成Sourceの完全解決は保証しない。既知子Process六経路とmockの旧参照は既存Caseで個別照合し、内部Adapter三Suiteの非公開Symbolと実体観測Pathは保持した。

固定候補のVersion Control全47件と書式・型・LintはPass。入口変更後のExecution Intelligence全82件、AI Adapter全28件、Visual Preview全10件、Workbench全33件と各静的確認、Workbench BuildはPass。Orchestratorの静的確認と回復接続mockの1件もPass。Coordinatorの上位受理Reader試験は、初回のmodule mock用起動flag不足と、以前の移管で残った廃止済みStorage／Task二Pathを訂正して1件Pass。Host Windows保存scenarioはこの実行から除外しており、六子Process経路の実環境成立とは扱わない。

Coordinator全体checkは既知Checker整形1件で停止し、型検査も既知Recovery二Fileの18件で未合格。LintはExit 0（参考情報54件）。署名保護flowの局所三件は1件Pass・2件Failで、`compilePlatformProvisionerManifestPayloadCandidate`の保護import対応不足を検出した。現在入力と、基準版のVC二importだけ新表へ正規化した比較入力は同じ理由で停止する。この比較は基準版全体の実試験ではなく、今回の入口変更以外にも不足が存在する切り分けである。既存署名保証を緩めず、未解消として後続へ保持する。初回レビュー結果を最終版へ流用せず、修正後の独立再レビューは未完了とする。実Provider、Docker操作、秘密鍵・実署名・公開は行っていない。

57Fileの再レビューは品質指摘0、実装側にテンプレート式内literal動的importの見落とし1件が残った。両観点で是正方針を照合し、閉包Helperだけをテンプレート本文と式へ分けた局所走査に変更した。nested式・object式内のimport拒否と、本文・エスケープ・式内文字列／コメントの非発火を既存Caseへ追加する。正規表現本文のbacktickを誤認した初回回帰は45件Pass・2件Failであり、正規表現literalと除算の対照を追加して再実行する。Source全構文を解決する汎用parserではなく、任意計算specifier・任意生成Sourceの保証は追加しない。Runtime、公開集合、利用側Path、保護map、QA IDは不変。静的確認と最終回帰・修正後再レビューの結果は完了後に別記する。

是正後のVersion Controlは書式・型・Lintと全47件Pass、Fail／Skip 0。新しい固定候補の独立再レビューへ渡す。他Packageの結果は各入力が不変の範囲に限って保持し、Coordinator全体静的・署名経路・Host Windows六経路の残件は解消扱いにしない。

固定57Fileの最終独立再レビューは実装・品質とも指摘0。Version Control公開入口への今回の利用側接続是正は限定範囲で完了とする。段階1〜5全体の完了ではない。次の署名局所是正は、現行`manifest-trust.ts`に存在する二Symbolに対し、保護import表が廃止済み`trust-core.ts`を要求する第一段階改名の追従漏れである。現行Sourceを確認し、署名保証を維持した別の固定候補として処置する。

### 署名保護import表の改名追従 — 着手前照合

基準Commitは`9b99331f`。変更分類は第一段階改名の接続漏れ是正であり、保護表のimport元だけを現行`manifest-trust.ts`へ同期する。二Symbolの必須性、同名decoy・alias・欠落・重複・事前Effectの拒否、署名入力とAuthorityは維持する。正常Source受理、旧Pathへ戻した入力の拒否、既存保護flow反例を確認する。実鍵・署名・Docker・Providerは使わず、Source契約試験と静的確認、実装／品質の限定独立レビューで確認する。新しい保証や許可集合の拡大が必要なら停止し、単純なPath同期へ混ぜない。

保護import表の一Pathを同期し、既存Caseへ旧Path拒否の反例を追加した。変更二Sourceの書式・Lint、production strict型検査はPass。署名保護flow局所三件は3件Pass、Fail／Skip 0。関連Suite全体は実行中で、独立レビューとともに完了未確認。既知Recovery試験の型不足やCoordinator全体静的の未合格は解消主張に含めない。

限定した三Fileの独立レビューは実装・品質とも指摘0。関連Suite全体の実行結果は引き続き確認中であり、局所3件の成功を全体へ拡張しない。

関連Suite全体はExit 1で終了した。今回対象の署名保護三件は全件成功したが、別Caseに残る旧`host-runtime`／`docker-runtime`とOrchestrator `src/core`等の参照でENOENTを検出し、意図した拒否phaseの不一致も残った。全SuiteをPassとは扱わず、試験側移管漏れとその他停止原因を分類して後続是正する。局所三件と独立レビュー指摘0を根拠に、保護import表の改名追従だけを限定完了とする。実署名・配布・Coordinator全体完成ではない。

### Topic／Meetingの正常CRUDと協調Writer競合 — 着手前照合

変更対象は既存`CPR-IT-010`の正常CRUD網羅と保存排他の実Process観測で、保存Runtimeは変更しない。Topic／Meeting双方の登録・一覧・取得・更新・期待改訂拒否・確認なし削除拒否・確認付き削除を実bytesと改訂へ接続する。新しいfixtureは検証済みRepository-local `.crdd/tests`へ限定し、mock・子Processを回収してRoot不存在を確認する。既存Relation付き削除・変換・Outcome・昇格の試験を保持し、Repository CRUDだけで公開操作全体の完成を主張しない。

実Process競合は第一子がexact既存Lockを実openした後に自己生成readyを発行し、第二子の更新拒否と終了・正本不変を確認してから第一子を解放する。spawn直後にerror／closeを観測し、保留・joinには期限を設ける。fixtureがdescriptorを返す前に失敗した場合は自身で回収する。finallyでは所有子のclose確認後だけRootを回収し、join不能やcleanup併発を一次失敗で隠さない。通常の協調Writer更新を対象とし、異常死回復、同時open勝者選択、非協調親差替え、電源断保証へ拡張しない。新Lock、Recovery、公開APIや共有Stateは作らない。

正常CRUDの既存Caseを両種別の全操作へ補強し、Repository-local fixtureへ切り替えた。Domain Model全112件と書式・型・LintはPass、Fail／Skip 0。保存Runtimeは不変で、協調Writer実Process競合はこのCaseでは未実装・未確認。QA-000005へ通常経路の追加観測と限界を直接接続し、限定独立レビューへ渡す。

両独立レビューは同一原因のMinor1を返した。古改訂入力が保存済み本文と同じでは誤保存を検出できないため、有効な異bytes候補を渡し、拒否直後の正本bytesと改訂保持を両種別でassertする。全結果統合と両観点の是正方針照合後に限定修正し、Runtime・QA ID・正常更新・Relation解消と削除Oracleは保持する。

Oracle修正後は書式・型・LintとRepository Suite全7件Pass、Fail／Skip 0。先の112件全回帰の対象と、この修正後局所再実行の対象を区別する。その他Package入力・Runtimeは不変で、固定候補の限定再レビューで是正解消を確認する。

修正後の限定再レビューは両観点とも指摘0で、Repository正常CRUDの補強は確認済み。協調Writer実Process競合と公開操作母集合の網羅は引き続き残件である。

### 配布閉包試験の旧Path追従 — 着手前照合

基準Commitは`0b2b49a6`。関連Suite全体で発見した試験側の参照漏れを処置する。`host-runtime`は`host-execution`、kernel-lock・子entrypoint・Lock supervisorは現行Fileへ、`docker-runtime`は`docker-execution`のowned-process／command-effectsへ、CLI lifecycleは現行非internal Fileへ対応させる。Orchestratorのintegration-resultと未使用sibling fixtureは現行candidate Folderへ置く。架空攻撃File名、状態・reason、役割IDと既存拒否Oracleは維持し、廃止Folderをわざわざ作って試験を通さない。

実行能力伝播反例の局所再現では、dispatchの正本を置換できず、意図した変異が未発火であった。現行Sourceと空白だけが異なるfrom／toを同期し、既存の変異発火assertion・拒否phaseを保持する。Runtime・公開API・Authorityは変更しない。Source対応と静的確認、速い伝播反例、実fixture利用側を確認した後に関連Suite全体を再実行する。実装と品質の限定独立レビューを行い、別の契約不足があればPath同期へ混ぜず分類する。実Provider・Docker・実鍵・実署名は使わない。

旧Path同期後の伝播反例・内部lifecycle反例は局所2件Pass。固定候補の実装・品質レビューは同じ原因のMinor2件を返した。攻撃側と許可対照の相対importが実fixtureへ接続していないため、それぞれ実Docker Process OwnerとCoordinator子入口へ同期する。duplicate_path置換には書込み直後の発火assertionを追加する。両結果を統合してから限定是正し、Runtime・許可集合・既存拒否理由とcandidate対照は維持する。修正前候補の全Suiteは是正前に停止したため、完走・全体Passの根拠には使用しない。是正後は該当3ケースを先に確認し、新しい固定候補で再レビューと全Suiteを行う。

是正後の書式・Lint、差分空白確認はPass。duplicate_pathの変異発火と拒否、実Ownerを指すsibling importの直接拒否、実Coordinator wrapperを指す許可対照を含む該当3ケースは3件Pass、Fail／Skip 0。局所成功は配布Suite全体や実署名の成立ではなく、全Suiteと修正後独立再レビューは未完了である。

配布閉包試験の修正後独立再レビューは両観点とも指摘0。全Suiteは引き続き実行中で、終了前に全体Passへ更新しない。

修正後の配布Filesystem Suiteは全133件Pass、Fail／Skip 0で終了した。実行入力のRuntime Sourceは不変で、実鍵・実署名・Provider・Docker操作は行っていない。今回の試験側移管追従は独立レビュー指摘0と全Suite結果により限定完了とする。Coordinator全Packageの型・既知Recovery・Host実環境の未評価を、この結果で解消しない。

### Topic／Meeting協調Writerの実Process確認

既存の着手前条件を具体化し、固定ESM eval Sourceと固定import先、所有Root内の入力・結果Fileで実子Processを起動する。通常入口とevalで異なるargv位置は`slice(1)`へ固定した。第一子のexact Lock open後にreadyを発行し、第二子のcloseと拒否tuple、第一子保留と正本保持を確認してからreleaseする。子のclose、保存結果、改訂2／3、Lock・短命File不存在を共同確認する。Runtime・公開API・Lock形式は不変で、新Frameworkは作らない。

初回局所試験はfixtureのRepository子Root作成漏れで失敗した。実Operation開始前の不足であり、自己生成の空Rootを確認して回収した。Root作成とRepository構築をcleanup対象のtry内へ移し、書式・型・Lintと局所1件はPass。最終Oracleへstatus／reasonと後続更新後の短命File不存在を追加して全回帰・独立レビューへ渡す。取得順を固定した協調Writer以外の保証を追加しない。

追加後のDomain Model全113件と書式・型・LintはPass、Fail／Skip 0。実装・品質の独立レビューは同じMinor1件を返した。子hookがdescriptorを返す前の一次失敗にclose失敗が併発すると上書きするため、closeを一度だけ別tryへ置き、AggregateErrorのcauseに元失敗を保持する。両結果統合後に試験fixtureだけを是正し、Runtime・Lock形式・取得順・正常Oracleは維持する。実OS close失敗の回収保証へ拡張しない。

fixture是正後の書式・型・Lintと局所競合1件はPass、Fail／Skip 0。全113件は是正前候補の結果として区別し、修正後の限定再レビューへ渡す。実OS close失敗注入・非協調Writer・異常死は今回の確認対象外である。

是正後の実装・品質再レビューは両観点とも指摘0。取得順を固定した協調Writerの競合・正本保持・Lock解放・後続更新再利用の確認は限定完了とする。公開操作全母集合と非協調親差替えの未決範囲は解消主張に含めない。自己生成domain-writer Rootの残存0を確認した。

### Topic／Meeting公開CRUDの接続 — 着手前照合

基準Commitは`0b5ae212`。Repository正常CRUDと公開種別固定の既存Caseを照合すると、公開Topic／Meeting面からの通常update・改訂競合・確認なし／確認付きdeleteが未観測である。既存`CPR-IT-010`の同Caseを両公開操作へ拡張し、本文bytes・改訂・拒否Effect 0・削除後の取得／一覧と実体不存在を確認する。種別誤用・専用操作の非公開・既存検索／Relation／昇格／OutcomeのOracleは保持し、正本種別を生成時に固定するRuntimeは変更しない。新fixture Rootは検証済みRepository-local `.crdd/tests`へ限定し、finally回収を観測する。これは通常CRUDの公開接続であり、全公開操作母集合・実OS故障・非協調Writerの完成主張ではない。静的確認、局所とPackage回帰、実装・品質の限定独立レビューを行う。

初回確認は削除前確認の返却値に存在しないexistsを期待したため、型確認と局所試験が失敗した。実契約のrecord／relationPathsへ照合を訂正し、書式・型・Lintの成功後に局所1件を再実行してPass、Fail／Skip 0。Runtimeは不変で、自己生成Rootはfinallyで回収した。Package回帰と限定独立レビューは未完了である。

補強後のDomain全113件と書式・型・LintはPass、Fail／Skip 0。限定レビューは品質指摘0、実装Minor1件で、競合・確認なし削除・確認付き削除のstatusが未観測だった。全結果統合後、既存reason／Effectとblocked／blocked／completedを共同確認する3assertの追加を両観点へ照合して是正した。Runtime・入力・正本bytes・QA IDは不変。最終局所確認と限定再レビューの結果を別記する。

status相関追加後の書式・型・Lintと公開CRUD局所1件はPass、Fail／Skip 0。先の全113件と最終局所の対象を区別し、限定再レビューへ渡す。domain-public-crud Rootの残存0を確認した。

是正後の実装・品質の限定再レビューは両観点とも指摘0。status・reason・Effectと実bytes／改訂の相関を確認し、Runtime・入力・QA IDは不変である。通常公開CRUDの補強を限定完了とし、全公開操作母集合や非協調Process・実OS故障の未確認範囲は保持する。

最終status相関候補で`domain-model`の`npm test`を再実行し、書式・型・Lintと全113件がPass、Fail／Skip／取消0で終了した。これは今回の公開CRUD補強と既存Package回帰の結果であり、上記対象外の保証や実Provider・Docker・署名E2Eの成立を示さない。

## 11. Access Managementへの再編 — 2026-10-09の途中見直し

### 結論と変更境界

人間は独立`cros` Package維持の先の判断を変更し、認証・認可・権限管理を`access-management`へ再編する方向を提示した。CROSはRepository群と専門Capabilityが連携して成立する全体システムの概念とし、一Packageの名称と同一視しない。Package数削減ではなく、名前・配置から責務を予測できる構造を目的とする。本節はSource照合と移管計画であり、正式Architectureの反映・新Packageの実装・旧Packageの廃止は未完了である。

基準は`2f398f0a`。直前の非秘密Credential MCP接続は計画のみで停止し、Sourceへ追加していない。既に接続したProfile／活動MCPの現行能力を保持し、新Ownerへの追従と新しい検証を行う。旧維持判断と旧基準の独立レビューは履歴として残し、新構成の採用・完成判定へ流用しない。1〜5の確認済み範囲は撤回せず、Domainへの移管影響がある公開集合・型・Consumerだけを再確認する。段階9〜11の実行系大改修は前倒ししない。

### 現行全Fileと移管候補

現行`cros/src`の18 TS Fileと`bin/cros.ts`を列挙し、公開入口、実import、主要関数と利用側を照合した。候補先は現行命名規約に従い、`src/<責務>/<file>.ts`までとする。子index・再export専用File、新しい空Folderは追加しない。以下の候補名は移管前のArchitecture／Quality照合で固定し、機械的な名前変更だけを完成としない。

| 現行Path（`40_Develop/cros/`起点） | 現在の実責務 | 処置・新Owner候補 | 保持するもの／追加確認 |
|---|---|---|---|
| `src/access/credential.ts` | Credential発行・認証・一覧・Grant変更・失効・rotation | `access-management/src/credential/operations.ts` | 明示Grant、管理とContentの分離、非秘密Metadata、inspect／publish競合。秘密発行はHost／Local限定 |
| `src/access/registry-file-adapter.ts` | Credential Registryの不変Revision保存 | `access-management/src/credential/file-store.ts` | 完全Snapshot検査、競合、現在OS Rootと保護条件。不必要な保存方式変更はしない |
| `src/access/recovery.ts` | 管理資格喪失時の計画・対象再照合・限定回復 | `access-management/src/recovery/operations.ts` | 同一回復Identity、管理者確認、Content Grant非発行。Docker回復や汎用Recoveryへ統合しない |
| `src/access/recovery-file-adapter.ts` | 回復prepare／settleの不変記録 | `access-management/src/recovery/file-store.ts` | 現行保存先・排他作成・flush／読戻し。履歴保持の変更は今回の改名へ混ぜない |
| `src/access/recovery-cli.ts` | Hostの対話回復操作 | `access-management/src/recovery/cli.ts` | 人間確認・秘密の一回表示・Remote非公開 |
| `bin/cros.ts` | 回復mode／OS Root入力・端末I/O | `access-management/bin/access-management.ts` | Package同名の主要入口。一つのbin。OS領域変更なし。公開コマンド名・環境名の移行は別に対応付ける |
| `src/access/resolve.ts` | 認証済みAccess→同一Exposure Snapshot→許可集合 | `access-management/src/access/resolve.ts` | Request一回観測、現在Credential、systemAdminからContent非生成 |
| `src/access/types.ts` | ExposureとRepositoryの同一観測型 | `access-management/src/access/types.ts` | DomainのContext型と認可Snapshotを混同しない。Domain→Access Management依存を作らない |
| `src/access/session-context.ts`（Credential／Session／Exposure／Repository解決） | Credential SnapshotとSession、Binding／改訂を使う認可 | `access-management/src/access/session.ts`／`resolve.ts`／`types.ts`へ責務分離 | 型と関数名を実責務へ合わせる。RepositoryのDomain情報と認可用Bindingを分け、必要な型だけRoot公開 |
| 同File（ContextItem／ContextPackage／createContextPackage） | 目的・Source・改訂・欠測を持つContext集約 | `domain-model/src/project-context/package.ts`候補 | restrictedの非開示は保持。認可判断をDomainへ移さず、認可済み情報だけ受ける |
| 同File（Handoff／resume、局所操作、AI行動計画） | Task相関・Authority照合、疑似局所更新、共通計画投影 | REVIEW。Context値はDomain候補、Task再開判断はOrchestrator候補、疑似操作は削除候補 | 現在は固有契約試験のみの利用を確認。ARCH-000009／015の義務と現行実Ownerへ照合してから処置。試験専用という理由だけでは削除しない |
| `src/federation/project.ts`（resolveAuthorizedRepositories） | Grant／Exposure／改訂の認可フィルタ | `access-management/src/access/resolve.ts` | 認可済みRepository集合を返す。Portfolio生成は行わない |
| 同File（createPortfolioProjection・3公開型） | Context Identity照合、Project集約、欠測・競合の投影 | `domain-model/src/project-context/portfolio.ts` | DomainはCredential／Sessionを入力にせず、認可済みDomain情報を入力にする。MCP／WorkbenchのPortfolio型も新Ownerへ追従 |
| `src/profile/administration.ts`（resolve） | systemAdminによるAI Profile管理可否 | `access-management/src/access/administration.ts`候補 | AI AdapterのCatalog管理実体を再実装しない。Content観測不要・非管理非開示 |
| 同File（parseMutation） | 閉じたMutation入力の検査 | AI Adapterの既存Profile管理責務へ統合候補 | operation／Revision／Profile語彙はAI Adapter、Transport envelopeはMCP。認可Packageへ業務入力Schemaを残さない |
| `src/activity/read.ts` | 許可集合のProject選択、Reader待機・結果検査 | 分離候補。対象認可はAccess Management、観測・結果契約はOrchestrator | 任意Repository探索禁止、unknown／欠測、Reader joinと取消限界を保持。Orchestratorの内部大改修はしない |
| `src/activity/types.ts` | Orchestrator投影・Runtime Event・Reader入力型 | Orchestratorの既存活動公開領域へ統合候補 | Repository型依存をDomainの非認可情報へ限定。実行事実の正本をExecution Intelligenceへ勝手に変更しない |
| `src/activity/validate.ts` | Orchestrator状態相関と活動応答の閉包検査 | Orchestratorの既存公開投影Validatorへ統合候補 | MCP／Workbenchで共有。Access Managementへ上位Task意味検査を持たせない |
| `src/configuration/shared-server-file-adapter.ts` | Origin／Port、接続設定、Root検証、Context解析、Exposure、Topic／Meeting生成が混在 | SPLIT。接続・Exposure設定はAccess Management、ContextはDomain、Listener設定と本番組立てはMCP／Workbench | 設定の存在によるMode切替禁止。現在Binding／Context改訂検査を維持し、単体から兄弟Repoを探索しない |
| `src/connection/http.ts` | CROS REST ServerとRemote Client、入力stream・応答変換 | 代替MCPと本番Consumer成立後DELETE | Browser↔Workbench RESTは対象外。認可・競合・活動欠測・終了保証は新経路で実証 |
| `src/tool/registry.ts` | Tool実装一覧、公開可否、取消・結果分類 | REVIEW。MCP等の実登録先に統合または未使用中継を削除 | 現行本番Consumerは検索で見つからず自Package試験のみ。Tool登録契約とARCH-000010／012を先に照合し、新汎用Registryは作らない |
| `src/surface/operation.ts` | 汎用Ownerへのinspect／apply、Surface転送、委譲結果相関 | REVIEW。固有意味を持つ実Ownerへ統合またはDELETE | 本番Consumerは検索で見つからず自Package試験のみ。Handoff／Result義務を消さず、値の投影とTask採用判断を分ける |
| `src/index.ts` | 上記責務全体の明示公開 | 全移管後DELETE。新Ownerの`src/index.ts`から必要Symbolだけ公開 | 同型DTOや互換barrelを追加しない。未対応の公開契約を消さない |

### 保存正本の実照合

現行RootはDomainの`repository/resolve-storage-paths.ts`にある`resolveCrosRuntimeRoots`で決まり、Windowsでは`<LOCALAPPDATA>/<publisher>/cros/<trustDomainId>/`、Linuxでは既存XDG config／stateの同じ三segmentを用いる。Credentialはstate直下の`credential-registry/registry-<revision>.json`、管理回復は`credential-access-recovery/`、接続設定はconfig直下の`shared-server.json`から読む。これはSource上の配置規則の確認であり、利用者の実秘密Fileを読んだ結果ではない。

現行には独立したRepository Connection Registry保存Adapterが見当たらず、`shared-server.json`のrepositories／workspaceIdsを読んでBindingとExposureを構成している。「Registry」という名称だけから新Storeを作らない。接続設定のOwnerをAccess Managementへ定め、HTTP設定と分ける際にも既存Host Rootと秘密の保護を維持する。将来の設定File名変更はFrontend AIの明示移行へ接続し、Sourceへ旧互換Readerを追加しない。Package改名を理由に`cros`というOS Path segment、Token version、秘密Verifier、保存改訂を変更しない。

共有Rootは複数Ownerが利用するCROS全体の配置契約であり、Access Management固有の内容所有へ集約しない。現時点の物理Providerは`domain-model/src/repository/resolve-storage-paths.ts`であるが、それをDomainの意味Owner確定と扱わない。現在の配置とPath Identityを維持し、将来のProvider変更またはOwner別Rootへの移行は、全Consumer・保存Path・保護・移行を対応付けた別判断とする。Access ManagementがAI Profile内容を所有する構造や、AI AdapterからAccess Managementへの保存依存を作らない。

| 保存内容 | 現行Path（既存Root起点） | 内容Owner／利用側 | 今回の処置 |
|---|---|---|---|
| Credential Registry | state内`credential-registry/` | Access Management候補 | Path・秘密保護・不変Revisionを維持 |
| 管理回復記録 | state内`credential-access-recovery/` | Access Management候補 | Path・限定回復契約を維持 |
| 接続・公開・Listener設定 | config内`shared-server.json` | Access Management／MCP／Workbenchへ責務分離候補 | 内容分離とFile移行を対応付け、Rootは変更しない |
| AI Profile Catalog | config内`ai-profile-catalog/` | AI Adapterの`profile/store.ts` | 内容・Schema・保存先を維持。管理可否だけAccess Management |

### 利用側・検証の移管母集合

| 利用側／成果物 | 必要な処置 |
|---|---|
| MCP `project-context/adapter.ts`とResolver | Portfolio型・生成はDomain、Credential／ScopeはAccess Management。Requestごとの認可を必ず経由 |
| MCP Profile／Runtime活動Adapter | Profile入力はAI Adapter、管理可否はAccess Management、活動型・検査は実Ownerへ接続 |
| Workbench `server.ts`／`credential/administration.ts`／`browser/client-model.ts` | Local認可と非秘密管理をAccess Managementへ、表示型はDomainへ、Remote ClientはMCPへ切替。Browser REST維持 |
| `template/tools/crdd-cros-server.ts`とMCP Shared Host | 新MCP正式入口・設定・Reader注入とWorkbench代替を確認後に撤去。旧起動能力を先に消さない |
| CROSの12試験File、MCP／WorkbenchのCROS結合・System試験 | 検証義務のOwnerと観測境界で移管・補強する。過去結果を新配置へ流用せず、新しい対象で実行 |
| Checker命名、Version Control Consumer閉包、Coordinator配布閉包 | package名・SourcePrefix・公開集合・実依存に追従。配布のためだけにAccess Management全体を署名閉包へ追加しない |
| 共有Rootの全利用側 | DomainのRoot公開API・契約試験、AI AdapterのProfile Store・保存試験、CROSのCredential／Recovery／設定試験、MCPのShared Server入口試験を照合。移管後の新候補でPath Identityと保護条件を再検証 |
| Package metadata／build契約 | `package.json`のname・exports・bin・scripts、`tsconfig.json`、`symbol.json`を新Ownerへ対応付ける。`package-lock.json`は採用Package graphとmanifestから再生成する派生物であり、独立正本・手編集対象としない。旧名の実利用と歴史記録を区別し、全接続・bin案内・検証成立後だけ旧Packageを撤去 |
| Domain公開Trust Policy契約 | `inspectCrosTrustPolicy`／`CrosTrustPolicy`／`CROS_TRUST_POLICY_SCHEMA`は既存宣言Validatorとして現状維持し、Domain試験・Architecture・公開集合・履歴を照合する。改名／廃止は別判断。新しい運用必須Policy、Coordinator Authorityへの統合、Schema変更は行わない |
| Architecture／Quality／symbol／Template設定／案内／Project Context | 現行Owner・導出元・新API・配置と一致させる。過去Evidenceは変更しない |

以下は現行12試験Fileの全数対応である。Pathは`40_Develop/cros/tests/`起点、各名称には`.contract.test.ts`が付く。現Traceは正式QA適合判定ではなく照合入力であり、QA ID・本文・Oracle・過去結果はこの計画更新で変更しない。一Fileを一Ownerへ強制せず、複合責務は分割候補とする。保持Oracleは新Ownerで再実行し、過去Passや自己Package試験だけを代替能力の成立・削除根拠にしない。

| 現行試験File | 現Trace | 対象責務 | 移管・分割・代替候補 | 保持Oracle／未決 |
|---|---|---|---|---|
| `integration/connection-credential` | RFD-IT-013 | Credential・要求認可 | Access Managementへ移管 | 明示Grant、失効、秘密非保持、管理とContent分離。公開MCP／Workbench結合は別確認 |
| `integration/credential-access-recovery-file-adapter` | RFD-IT-013 | 管理回復の保存・再入場 | Access Management回復へ移管 | 人間確認、同一Identity、Registry確定、秘密非保持、再入場 |
| `integration/credential-registry-file-adapter` | RFD-IT-013 | Registry保存 | Access Management保存へ移管 | OS Root、別Adapter読戻し、Revision競合、保存保護 |
| `integration/local-operation-ai-plan` | RFD-IT-009／RFD-IT-011 | 局所操作・AI計画・Handoff | REVIEW。Domain／Orchestratorの実Ownerへ分割または代替 | availability、局所同等性、AI入口制約。疑似操作のCanonical義務・本番代替は未確定 |
| `integration/project-federation` | PPR-IT-002 | 認可集合・Portfolio | Access Management認可／Domain投影へ分割 | 許可集合外非読取り、欠測、Identity不一致、競合 |
| `integration/remote-transport` | PPR-IT-002／RFD-IT-013 | Remote認可・情報非開示 | MCPの実経路で代替後に旧REST試験撤去 | Request毎認可、Workspace非開示、Registry改訂、Token非報告。代替本番検証は未完了 |
| `integration/shared-server-config-file-adapter` | PPR-IT-002／RFD-IT-013 | Host設定・Root・Context・Exposure | Access Management／Domain／MCP設定へ分割 | 不正Root・Context拒否、Binding、Grant不一致、現在Path Identity |
| `integration/surface-contract` | EST-IT-010 | Surface間Owner・結果・取消 | REVIEW。実Owner・本番Surface試験へ代替 | 同一Owner、Authority、Effect、取消、結果相関。抽象FixtureだけでServer成立を主張しない |
| `integration/tool-registry` | RCM-IT-010 | 登録・公開・実装接続 | REVIEW。実登録先へ統合または代替 | 公開可否、Host availability、Authority、取消、cleanup。新汎用Registryは追加しない |
| `system/context-handoff` | ERB-ST-013／RFD-ST-010 | Context引渡し・再入場 | REVIEW。Domain値／Orchestrator判断へ分割 | Source・対象Identity、改訂、Authority、必要Context、再入場。値関数から本番ST成立を推定しない |
| `system/result-return` | EST-ST-011 | 結果引渡し・再実行制御 | REVIEW。実Orchestratorの結果受領へ対応 | createdBy、改訂、差分、Evidence、返却先、Authority、replay。新汎用DTOは作らない |
| `system/session-access` | RFD-ST-003／RFD-ST-004 | Session・Exposure・公開操作 | Access Managementへ移管しMCP／Workbench実Surfaceを補強 | Session終了、失効、Workspace／Repository認可、非開示。新Surface接続の検証は未完了 |

Tool Registry等の本番未使用判定は、今回のTS Source検索による確認であり、動的参照・設定・公開案内・Git履歴・過去VerificationとCanonical義務を含む削除Gateは未完了である。

### 実施順・再開Gate

1. 本表の未決候補をSource・Canonical義務・過去Capabilityから確定し、基本／詳細ArchitectureとQAを新Ownerへ対応付ける。必要な人間判断だけを提示する。
2. Credential・認可・限定Access Recovery・接続設定をAccess Managementへ移す。DomainのPortfolio／Context処理を分け、Root明示公開・型依存・試験を同時追従する。
3. 業務入力・活動投影・Tool／Surface／Handoffの残存責務を既存Ownerへ統合または削除する。段階9〜11の大改修が不可欠なものは依存を示し、段階6〜8の完成へ隠さない。
4. MCP／WorkbenchのLocal・Remote本番Consumer、単体／CROS Mode、設定と公開入口を接続する。認可前読取り0、非開示、改訂競合、処置前／後取消、終了後状態を新経路で確認する。
5. 全責務・公開集合・利用側・代替実測が閉じた後、旧REST／Gateway／Shared Hostと`cros`Packageを撤去する。全回帰・独立レビュー・Reality Auditと現在投影を更新する。

実装前整合確認と固定候補前照合を新Ownerでやり直す。独立した実装・品質観点で本計画を確認し、全結果を統合して是正する。保存Path・Token・Grantの意味を変える必要が判明した場合は改名へ混ぜず影響と人間判断へ戻す。新IAM Platform、User Account、汎用Registry／Lock／Gateway／互換Serverは対象外。現時点で全1〜8の完成・Release可能は主張しない。
