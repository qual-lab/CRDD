# 作業領域と実行基盤の責務設計

成果物種別: Architecture詳細設計（横断契約）
詳細設計領域: orchestrator
状態: Candidate（採用済み目標を具体化。Source・Schema・実境界は未実装／未検証）
維持責任者・決定権限: Qual-Lab
最終更新日: 2026-10-17
対象: ARCH-000004／ARCH-000008／ARCH-000009／ARCH-000011／ARCH-000012／ARCH-000013／ARCH-000015

## 1. 目的と適用範囲

作業領域（Workspace）は、一つのRepositoryに所属し、人間とAIが複数Taskを継続する論理的な作業場所である。本書はその意味、寿命、Taskとの関係とPackage間の引渡しを所有する。Git操作の技術詳細はVersion Control、RepositoryとContextはDomain Model、認可はAccess Management、隔離・Container資源はDocker Isolationが所有する。Orchestratorを新しい技術共通層にしない。

入力はCHG-000082で人間が提示・採用したWorkspace再編方針と、[現物の棚卸し](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md)。旧方式を削除可能とする根拠ではなく、旧能力から本目標へ切り替えるための契約とする。新操作に必要な上流UI／SPECの具体化、API・保存Schemaと実行許可が未確定の間は、Architecture Ready・実装Ready・公開能力完成を主張しない。

| 区分 | 現在の扱い |
|---|---|
| 採用済み目標 | Direct標準、必要時だけIsolated、Repository所有、通常AI実行はOrchestrator経由、Coordinatorは単発実行へ縮小 |
| 基準実装 | `a04ecb70`のDI分離は完成。独自Bundle Store、Workspaceを識別しないQueue、Workbench専用AI経路は残存 |
| 今回の変更 | ArchitectureとQualityの設計伝播。Source・設定・実データ・Git Refは変更しない |
| 明示対象外 | 新しいDaemon、汎用Queue／Lock／Recovery Framework、Worktreeによるセキュリティ隔離、Multi-host排他成立、通常Runtime署名の再導入 |

最新のDirect／Candidate簡素化判断は[現物再照合](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#7-directcandidateの簡素化方針と現物の再照合2026-10-17)に記録した。Directは現在Treeの通常Source／Test／非秘密設定を原則編集可能とし、同一ファイルの既存dirtyもInputにする。allowedPathsは指示と事後変更範囲評価だけで、DockerのPath単位制御にしない。想定外変更は差分確認へ返し、変更防止・AI由来断定・自動Rollbackの根拠にしない。Candidate方式は固定BaseからcleanなIsolated Worktreeを用い、共有側dirtyを自動継承しない。共有Git変更はVCの明示操作に限定し、AI完了から自動Commit／Promotionしない。両方式で自動Stash／Reset／Cleanをしない。Directの基本保護と安全なGit読取りは現実装だけでは未成立であり、技術保証の不足を報告してから次の構成を判断する。今回Source実装は開始しない。

その後の人間判断により、開発用`.env`の配置とCoding AIから読まれる可能性を許容した。秘密情報の区分とDirect／Candidate共通の技術境界は[Docker Isolationの共通方針](../docker-isolation/01_Architecture.md#workspace-isolation-policy)を正本とし、全秘密fileの隠蔽を必須にしない。本番Secretは通常開発環境へ置かず、開発資格の限定権限・期限は既存管理側の運用前提とする。OrchestratorにSecret管理・資格注入・Cloud検証を追加しない。

## 2. 方式・識別・所有境界

| 方式 | 作業対象 | 寿命・成果 | 禁止する読み替え |
|---|---|---|---|
| 通常作業（Direct） | 利用者が指定した現在の作業Tree | 既存未Commit変更を含む。作業ごとのCandidate・Worktree生成を必須にしない | Direct選択を無制限のAI書込み許可にしない。通常CRUDの安全性を任意Source編集へ流用しない |
| 独立作業（Isolated） | 専用BranchとGit Worktree | Task単位の使い捨てではない。複数TaskとCommitを継続保持 | Task終了・取消だけで削除・resetしない。別Worktreeを別Repositoryや隔離環境とみなさない |

対象はRepository識別とそのRepositoryに所属するWorkspace識別で結合する。ID文字列やCWDだけでPath・権限を確定しない。DirectのID表現・具体APIは未決であり、仮の値を永続契約として発行しない。

Isolatedの技術APIでは上位発行の小文字UUIDを使い、Version Controlが専用Branchを`crdd/workspace/<uuid>`、配置を所属Repository直下の`.crdd/workspaces/<uuid>/worktree/`へ導く。UUIDは操作許可ではない。採否・保留・非使用はOrchestratorが既存利用調停で処置期間を通じ維持し、削除時は期待HEADと変更破棄の明示有無を渡す。新しいWorkspace台帳・Lockは追加しない。この値形式の確定だけでUI・Task保存Schemaと本番接続を完成としない。

新設Workspaceの名称はこの作業領域に用いる。既存のdevelopment／managementを表す`workspaceId(s)`は内容領域（設計名`contentAreaId(s)`）へ改名する。権限の意味を変えず、Role／Exposure・Manifest・通信・保存Schemaと全利用側を同じ切替単位で更新する。内容領域への閲覧許可から新Workspace作成・実行・Mergeの許可を自動生成しない。既存の短命作業領域は一時実行領域等の実責務名へ改め、Dockerや外部CLIの予約語は変更しない。過去Evidenceの名称・署名・Hashは維持する。

## 3. Packageの責務と依存方向

```text
Browser → Workbench Server ─┐
MCP Client → MCP Server ────┼→ Orchestrator → Coordinator → AI Adapter
通常Task CLI ──────────────┘        │                └→ Docker Isolation
                                   ├→ Version Control
                                   └→ Domain Model
共有接続の各公開操作 → Access Managementの現在認可
```

通常AI実行は共通Task経路を使う。Topic／Meetingの信頼済みCRUD等は専門APIへ直接接続でき、すべての読取り・CRUDをAI Task化しない。WorkbenchとMCPは対等な入口であり、WorkbenchからMCPへの依存・loopback・第三のGatewayを追加しない。Coordinator直接入口は開発／試験・単発診断に限定し、通常認可や隔離を迂回させない。

| Owner | 所有すること | 所有しないこと |
|---|---|---|
| Orchestrator | Task／Attempt／Queue、Workspace利用・寿命、候補固定の要求と採否、Decision適用、Promotion調整、結果参照と再入場 | Gitコマンド、Container操作、Credential、Context意味の再実装 |
| Coordinator | 一回のExecutor／Reviewer調整、短命実行状態、取消、通知と結果返却 | 業務Task／Queue／Workspace／Candidateの永続Lifecycle、採用・Promotion、Docker技術Lifecycle |
| Version Control | Git Root／Worktree／Branch／Commit／Diff／Merge計算・取込・除去と操作後確認 | 採用判断、Task進行、認可、一般データ保管 |
| Domain Model | Repository Identity／Manifest、Context解析・CRUD、Repository-local配置の共通契約 | Credential解釈、Git Ref更新、Task調停 |
| Access Management | 共有接続の主体、Role、内容領域、登録・Exposureと要求ごとの認可 | Context本文、Workspace進行・Task成果の所有、Transport |
| Docker Isolation | 実行環境の隔離、許可されたMount、開始・終了・取消・Container／Network回収、限定残存処置 | Workspace削除、Task採否、上位永続状態、Git操作の業務許可 |
| AI Adapter | Provider固有CLI、Profile・認証手順、入出力差 | Orchestrator状態、Workspace寿命、採用判断 |
| Workbench／MCP | 表示・操作またはProtocol、認可済み対象搬送、共通API利用 | 専用Queue、業務状態の第二正本、公開入口ごとのAI実行実装 |

通知は下位の契約に上位がcallbackを登録し、Coordinatorが元Operationへ結び、必要な事実だけをOrchestratorへ伝播する。下位は上位Packageをimportしない。一次失敗、技術cleanup、結果配送、耐久受領は別の事実として保持する。Consumerの任意保存や表示をDocker cleanupの条件にしない。

## 4. 配置とRoot解決

```text
対象Repository/
├ .git/                         共有Git管理情報
├ 現在の作業Tree                Direct
└ .crdd/
   ├ config/                    対象Repositoryの非秘密設定
   ├ orchestrator/              既存state・Queue・結果参照・有限履歴
   └ workspaces/<id>/           Isolatedの付随情報
      ├ worktree/               Git Worktree
      └ merge-result.md         最初のMerge時から要点・参照を更新
```

Tool Runtimeのインストール先、Clone先、CWDを製品データの暗黙の保存先にしない。Worktree内からの起動でも、検証した所属RepositoryへRuntime正本を解決する。最寄りworktree Rootの下へ別の`.crdd`を無条件生成せず、通常Repository・linked worktree・submodule・入れ子の誤結合を拒否する。Rootと作業Treeの実体、Git共通管理情報、Repository識別と認可を照合できない場合は新Effect前に停止する。

`.crdd/workspaces/`はGit追跡、Checker一般再帰、AI自動収集、通常Source探索・Build入力から除外し、明示対象のWorkspaceだけを読む。設定allowlistは維持する。Hostには登録・Credential等の既存管理データのみを残し、製品Task・候補内容・分析を共通ログやCacheへ集約しない。借用された実行材料・ログ・一時物にも対象Repositoryと権限・保持・清掃条件を適用する。

候補固定が必要なコード変更は、対象Repository・Workspace・baseと固定Commit／Tree・レビュー対象差分・許可範囲・Task／Decision参照を相関させる。Commitだけで採用Authority・認可・レビュー成立を表さない。Topic／Meetingの提案や人間判断候補までCommitへ変換しない。独自Bundle Storeと専用排他の撤去は、[棚卸しの能力・利用側対応](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#3-能力利用側移管先の対応)を新経路で閉じた後とする。

## 5. 状態・競合・終了条件

次は論理的な状態と必要観測であり、新しい永続enumやStoreを指示するものではない。Task状態とWorkspace寿命を一つにしない。

| 状況 | 処置・Owner | 観測と終了後条件 |
|---|---|---|
| Directを選択 | Orchestratorが検証済み対象へ結合 | 作業Tree・元変更・Revisionを観測。Worktree生成0 |
| Isolated作成 | Orchestratorが明示要求、VCがBranch／Worktree作成 | 要求・Git受理・登録・実体・終了を区別。部分成立は同対象の残件として保持し別対象削除0 |
| Task待機・実行 | 既存Queue／Attemptを対象Workspaceへ結合 | 別Processの二重取得拒否。同一Workspaceの競合変更を調停し、別Workspaceは必要な共有制約以外で止めない |
| 実行失敗・取消・親喪失 | Coordinator→DIの終端、Orchestratorの元Task処置 | 既知Effectと一次失敗保持。継続Workspace、既存dirty・他Task成果の削除／reset 0。不明資源を不存在にしない |
| Merge前評価 | VCが固定二Commitの3-way計算 | clean／conflict／unknownを区別。作業TreeとBranchの更新0。Git Object生成可能性は副作用として扱う |
| 明示Merge | 人間の取込先・対象Commit確認後、Orchestrator→VC | 実行直前のHEAD・dirty・認可・競合を再確認。途中失敗を再発行せず現在状態へ再入場 |
| Merge後分析 | 通常Taskとして影響を整理 | 対象Commitと分析を相関し`merge-result.md`を更新。分析失敗でもMerge自動Rollback・自動修正連鎖0 |
| Promotion | 人間が固定成果・正本Revision・未レビュー変更を確認 | 正本書込み・適用済み事実・後続記録を区別。保存失敗を未適用へ巻き戻して二重適用しない |
| 採用・取込済みのIsolated終了 | Orchestratorが取込先の成果と採用記録を確認しVCへ明示要求 | 未取込残差・未追跡・ignored成果の破棄範囲も確定し、不要な専用Worktree・専用Branch・不要Directoryを回収する。採用だけで未取込内容の破棄を推定しない |
| 不採用・破棄のIsolated終了 | Orchestratorが対象と非使用、必要判断資料の保全を確認しVCへ明示要求 | 確定した破棄範囲のdirty・未追跡・ignored成果を含め専用Worktree・専用Branchを削除する。未merge専用Branchも対象とし、残存を既定にしない。Git Objectの即時消去は要求しない |
| 継続・明示保留 | 継続作業又は人間が調査目的・保持期限を明示した場合だけ保持 | 自動で保留へ変換しない。期限到来時は削除又は延長を判断し、期限だけを削除許可にしない |
| 終了時の実行中・対象不一致 | 実行中は終了後に同じ終了処置へ進む。対象不一致・観測不能は理由を返して停止 | 未Commitやignoredの存在だけを対象不明としない。Gitのlock・別HEAD・別Worktreeを破棄許可で無条件突破しない。新しい保留台帳・監視・Recovery機構を追加しない |

上記の削除はIsolatedの専用資源に限定する。Directの現在のWorking Treeと通常Branchは削除対象にしない。

| 競合する範囲 | 調停する責務 | 別の範囲へ拡張しない条件 |
|---|---|---|
| 同じ作業Treeの変更Task・Merge | OrchestratorのWorkspace単位の利用調停 | 非干渉読取りの並行可能性を残す。新しいWorkspace別Serverを作らない |
| Direct CRUD・Promotion | 正本の短期排他・期待Revision確認、Domain／Orchestratorの協調 | 非協調Editorまで内部Lockで完全防止したとしない |
| 共有Git Ref・Worktree登録 | VCのGit共有管理情報に対する短期操作調停 | Workspaceが別でも共有Git競合を無視しない。Gitの既存保護を重複実装しない |
| Provider Home・Host・CPU等 | 既存の実行資源Owner | Workspace別だから既存Host／Home排他を解除しない。資源上限と業務排他を分ける |
| state保存 | 既存Orchestratorの短期保存排他・世代照合 | Provider待機中に保持しない。実効排他の成立をファイル存在・PIDだけで判断しない |

同一Hostの複数Processを対象とし、両Surfaceが同じRepository状態を読む。Memory Queueの共有を仮定しない。異なるHostから共有Filesystemを操作する保証は未評価で、対象外として扱う。

## 6. 必須評価と未決の停止条件

| 観点 | 評価・根拠 |
|---|---|
| Component／責任・Boundary | Applicable: §3のOwnerと公開API。第三Gateway・共通Daemonは不要 |
| 状態遷移・Sequence | Applicable: §5。要求・受理・Effect・結果保存を分ける |
| Data／Resource Flow | Applicable: §4。永続Workspaceと短命実行資源を分ける |
| Failure／Recovery | Applicable: §5。元失敗・同対象参照・参照中成果を保持 |
| Variation／Common Contract | Applicable: Direct／Isolatedは同じTask対象、方式差はVCと対象解決に限定 |
| Creation／Selection・Lifecycle | Applicable: Orchestratorが要求、VCが技術操作、DIは借用資源だけを回収 |
| State-dependent Behavior | Applicable: 採用にはレビュー・取込条件を要求し、明示破棄には対象・非使用・期待HEADを要求する。dirtyは破棄範囲に含められる。実行中・対象不一致・観測不能では削除しない |
| Composition／Recursion | N/A: 再帰WorkspaceやWorkspace内Workspaceを今回の管理能力として導入しない |
| Security／Concurrency／Timing | Applicable: §2／4／5。時刻・期限だけで安全や不存在を推定しない |
| Visual／利用者理解 | OPEN: 新規作成・選択・Merge・破棄の表示と誤認防止はUI／SPEC具体化とUATが必要 |

| 未決事項 | 止める作業・必要な根拠 |
|---|---|
| 両方式の共通隔離の技術構成 | 一般方針は人間採用済み。実Mount・書込みSource実装前にRepository外書込み、`.git`／実管理領域書込み、`.crdd`内部書込みと認証領域の保護を最小構成で確認。開発用`.env`の読取り可能性は許容し、本番Secretを通常開発環境へ持ち込まない。成立しなければ追加機構の前に不足と代替案を報告。allowedPaths別ACL・動的Mount承認は追加しない |
| 候補固定・取込Commitを誰がいつ発行するか、dirtyの扱い | Git書込みAPIとPromotion実装前に明示操作・保存・中断条件を固定。基本方針からCommit許可を推定しない |
| Workspace識別・内容領域改名・公開要求／保存Schema | Consumer全数対応と移行前に固定。旧ID自動転用・互換fallbackを作らない |
| 既存Store／旧一時Root・状態の保全と破棄 | 実移行前にフロントAIがexact Root・現在参照・使用・成果を確認し、必要許可を得る。今は削除0 |
| Multi-host | 今回実装の前提にしない。要求発生時に別途評価 |

以前の最小固定Mount案は、[合成実証](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#承認済み一回の実証結果と終了2026-10-17)でhardlink別名から元dummy内容を読める反例を確認した。これは当時の隠蔽仮説の反証であり、新しい開発情報の許容方針の不合格根拠へ流用しない。Git読取りの一律禁止は要求せず、この反例だけでGit書込み成功とも扱わない。書込み禁止と認証領域等の必要な保護は未証明のまま維持し、Secret管理・個別file ACL・動的Mount許可Frameworkは追加しない。

採用済み目的に対し、独自Bundleを残す案はGitとの二重正本とCoordinator永続責務を残すため目標にしない。一方、全操作をWorktree化する案はDirect標準を失い、すべてをGitへ吸収する案は認可・Task判断・提案の意味を失うため採用しない。既存Git・状態保存・専門Ownerの再利用を有力案とするが、上表の重要不確実性が残るため詳細設計は未収束である。

## 7. Qualityへの引渡し

| 導出キー | ARCH | 必要な保証 | 試験段階・実境界 | 主なQA |
|---|---|---|---|---|
| `orchestrator.workspace-task-target` | 000004／000012 | 共通Task、対象結合、複数Process・取消・再入場 | UT／IT／ST／UAT、実保存・公開入口 | QA-000003 |
| `orchestrator.workspace-code-candidate` | 000015 | 固定Git成果、明示採用、元変更保全、非コード提案との区別 | UT／IT／UAT、実Git・正本書込み | QA-000005 |
| `version-control.git-workspace-lifecycle` | 000009 | 作成・登録・Branch・Merge・除去、dirty・共有Ref・部分成立 | IT、実Gitの取得から終了まで | QA-000007・新RFD-IT-029 |
| `domain-model.workspace-placement` | 000011／000009 | 所属Repository、追跡／探索除外、保持・清掃 | UT／IT／ST／UAT、実Filesystem | QA-000008 |
| `access-management.workspace-content-separation` | 000013 | 内容領域と作業対象の分離・要求ごとの認可・非開示 | UT／IT／ST／UAT、保存・公開入口 | QA-000007 |
| `docker-isolation.workspace-borrowing` | 000008 | 最小Mount、終了後の実行資源回収、継続成果保全 | UT／IT／ST、実Mount・Process・取消 | QA-000006 |

Local Itemの条件・Oracleと実行結果は各Quality定義が所有する。新方式はNot Runであり、基準DI完成・旧Candidate試験・旧Gateを新方式へ継承しない。詳細設計の未決が閉じ、正常／境界／準正常／異常／回復、実利用側と終了後観測、移行手順を固定してからSourceへ進む。
