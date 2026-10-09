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
| 5 Platform Access | Protocol、Filesystem保護、Process、Docker Desktopの責務集合を確認。WindowsのIdentity／権限観測を提供している | 実呼出し・必要保証・Node代替可否を対応付ける。Docker Desktop部品の撤去とNative廃止を既定にせず、後半実行系に依存する判断は明示して残す |

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

Related:
- [現行の責務対応と第一段階結果](Evidence/261007_develop-responsibility-mapping.md)
- [Orchestrator詳細設計](../../../06_Architecture/Details/orchestrator/01_Architecture.md)
- [コーディング規約](../../../06_Architecture/99_Coding_Standards.md)
- [変更管理](../../../19_Maintenance.md)
