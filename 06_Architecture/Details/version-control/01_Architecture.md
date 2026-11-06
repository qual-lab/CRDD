# Version Control境界

## 保存Identity観測の重複探索統合

`repository/location.ts`のPackage内部観測は、私有WeakMapで検証済みCapabilityを照合し、exact Rootの絶対Directory・実PathとfreshなGit配置を一回の探索で返す。Package Rootの公開APIには追加せず、観測結果をcache・Authority・永続状態にしない。`readRepositoryStorageIdentity`はこの観測をbefore／afterで一回ずつ実行し、Root、配置種別、common directory由来の論理IdentityとRoot由来の実体Identityの一致だけを既存shapeで返す。どちらかの観測が不正・不明又は不一致ならnullとする。

一回のIdentity観測内部にあった文字列Root解決と配置読取りの重複だけを統合する。別々のAPI呼出しやI/O phaseを跨いで結果を使い回さない。書込み前後・atomic replace／readback後・Lock／cleanupで必要なfresh確認は各Ownerが従来どおり呼ぶ。保存用のIdentityをCommit観測・AI実行許可へ昇格しない。

## B4の借用Tree観測 — 2026-10-21

2026-11-05のGit技術責務への再編で、借用領域の安定File読取りと容量制限付きinventoryを`coordinator/src/execution/files.ts`へ戻す。対象にはGit非管理の実行領域が含まれるため、Version ControlのGit読取りへ偽装しない。開始時dirtyを含む実Treeを観測し、Git Commitへ勝手に置き換えない。既存のPath・case衝突・link／hardlink・深さ・File数・容量・読取り前後Identityの検査と拒否順序を保持し、書込み・巻戻し・採用・削除を行わない。Task Capability、許可Path・Secretの意味、レビュー公開範囲とWorkspace寿命も引き続き上位Ownerに残す。

## Git技術責務によるSource構造 — 2026-11-06（最新候補の回帰確認中）

Repository、Worktree、共通Git技術をOwnerにする。業務上のWorkspace ID・表示名・関連CHG・保持Ref名とPathの選択はDomain／Coordinatorが所有し、Version Controlは確定した技術要求を実行する。実Path／Branch／Refと保存DTOの値は変えない。

```text
src/
├ index.ts
├ repository/
│  ├ location.ts            検証済みRepositoryの取得・freshなRoot再確認
│  ├ layout.ts              Git管理配置・実体の検査
│  ├ revision.ts            現在／指定Revision・形式・技術Identity
│  ├ discovery.ts           Entry一覧と宣言されたsubmodule
│  ├ files.ts               現在Tree／File・固定Commit File・選択コピー
│  ├ changes.ts             現在Fileと固定Commit間の差分
│  ├ working-directory.ts   Working Tree／Indexの変更集合・Stage／Unstage
│  ├ commit.ts              通常Commit・選択Commitと短命Indexの照合
│  ├ merge.ts               現在WorktreeへのMerge・親／Tree／途中状態
│  ├ reference.ts           上位指定RefのCAS・readback・限定された短命Index回収
│  ├ remote.ts              Remote観測と明示Push
│  ├ ignore.ts              ローカル除外の安全な更新
│  └ types.ts               Repository操作の要求・結果
├ worktree/
│  ├ crud.ts                Main／Linked観測、指定Linkedの生成・除去
│  └ types.ts               Worktree対象・要求・観測・結果
└ git/
   ├ execute.ts             exactなGit Process構成と有界入出力
   ├ read.ts                読取りCommandの既存制約
   └ objects.ts             Object読取り・解析
```

旧 `workspace/`・`publication/`・用途別Adapter／Factoryは撤去する。単に別Sourceの旧経路を呼ぶFacadeにはしない。Main／Linkedの内容操作は同じ実装を使い、MergeのHEAD／Index／MERGE_HEADは入力Worktree固有とする。CLI・新しいLock・Store・互換Readerは追加しない。

移行比較の`inspectMigrationSystemClosure`・`MigrationConsumerObservation`はRuntime公開から撤去する。合成配列の比較を実Consumer移行の成立根拠にしない。`version-control.contract-migration-closure`の確認義務とQA-000001の`RCM-ST-012`はOPENを維持し、Root観測・固定Snapshot・実際の利用側閉包を使って必要な入力を提供する。公開・Release・Recoveryを含む実System全体の成立は別途観測し、削除した合成試験の成功を流用しない。過去Evidenceは変更しない。

Git配置の実体識別では、WindowsのNode BigInt statが返す`-2^63 ≤ ino < 0`を、同じ64bit列の符号なし値へ正規化する。`repository/layout.ts`のPath・descriptor両観測を同じ表現で比較し、別ID・ゼロ・型不正・範囲外・POSIX負値・link・型・dev・birthtime・途中変更の拒否を維持する。既存の正値、Git配置契約、公開結果や保存済みIdentityは変更しない。

Workspace再編で追加するGit操作は[Workspace詳細](../coordinator/05_Workspace.md)を入力に設計する。明示要求のWorktree／Branch作成・除去、固定Commit、3-way競合計算、Merge取込と共有Git整合を本領域が技術的に担当し、寿命・採否・操作許可はOrchestratorへ残す。以下の既存worktree-viewはTree／Diff読取りであり新操作の実装根拠ではない。作成・観測・除去に加え、候補固定・MergeとOrchestratorの内部Package接続を実装した。公開Surface・実Provider E2E・実データ移行を含む全体完成とは区別する。

### 固定Candidate・二親Mergeの追加契約（2026-10-18、実装未完了）

[Workspace詳細](../coordinator/05_Workspace.md#採用git統合の採用方針2026-10-18実装未完了)が採用判断と表示名を所有し、Version Controlは選択された内容のCommit固定、取込前評価、明示Mergeと親・Tree・Refの読戻しを所有する。

| 技術境界 | 必要な保証 |
|---|---|
| 候補固定 | 明示Baseと確認した選択内容だけからCandidate Commitを確定する。通常index全体のCommitを使わず、利用者のindexと未選択dirtyを保持する。未選択の既存Commitを親履歴に含める方式は拒否する。固定後にBase／対象Commit／差分を返す |
| 標準Gitの利用 | 一時index、Tree／Commit Object、Refの期待値付き更新等の既存Git機能を評価する。候補固定だけで共有Branchを更新しない。新しい永続台帳・独自LockやMerge Engineを作らない |
| 取込前評価 | Git標準の3-way計算で競合と観測不能を区別する。判定だけでWorking Tree／Branchを変更しない。新規Git Objectの生成はあり得る |
| Merge | 新規取込はFast-forward可能時も`merge --no-ff`を基本にする。Commitの親一覧が順序を含め`[expectedTargetHead, candidateCommit]`と一致することを読戻す。固定Candidateが取込先履歴の祖先である実Git観測を既取込判定とし、新規Merge成功にせず再発行しない。Tree／Message一致は代用不能で、祖先観測不能では停止する |
| Candidate Ref回収 | Workspace Branchと別資源としてRef・期待Commitを既存上位記録へ返す。上位が採用時の取込済み又は不採用の明示破棄、必要参照・保持・非使用を確認した後、標準Gitの期待値付きRef削除を行う。Workspace継続中も独立処置でき、他Refを変更しない。不一致・使用中・観測不能では削除0、途中失敗は同対象へ再入場し、Objectの即時消去は要求しない |
| 既存作業 | HEAD／dirty／staged／未追跡を直前に再観測し、上書き又は選択外混入のおそれがあれば発行しない。非衝突dirtyも一律cleanへ制限しない。Gitが保全できない入力は理由を返して停止する |
| 結果・中断 | 発行前拒否、Conflict、Git成功、応答喪失、結果読戻し不能を分ける。途中状態を自動abort／reset／stash／cleanで解消しない。既存上位記録へ元操作と期待／観測HEADを返し、Message一致だけから再入場の成立を推定しない |
| Message | Coordinatorが表示名・UUID・Base・候補・関連CHGを既存形式のMessageへ投影する。VCは技術的な長さ・制御文字を検査し、shellを使わずGitへ渡す。Messageを認可や品質証明と解釈しない |

反証には、Fast-forward可能時の二親生成、分岐時の正常Merge、既取込の非発行、未選択過去Commitとstageの非混入、共有側の非衝突dirty保全、衝突／未追跡上書き拒否、確認後のHEAD変更、制御文字を含む名前、Git成功後の上位保存失敗を含める。実Git境界はQA-000007の`RFD-IT-029`、上位の選択・認可・保存・名前搬送はQA-000005へ接続する。[現在のSource・実Git結果](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#採用git統合のsource接続と実git確認)を参照し、既存Worktree作成・観測・除去の成功で代替しない。

### Git Worktree管理の実装契約

この段階は固定Base Commitから独立作業Treeを作り、明示終了時に不要なWorktreeと専用Branchを削除する技術処理に限定する。新しい利用者入口、採否判断、Task保存、Merge、互換Readerは追加しない。実装・検証・公開Symbolへの接続が完了するまでは公開Capability完成と扱わない。

| 操作・境界 | 契約 |
|---|---|
| 入力の結合 | 検証済みRepositoryと上位指定の相対Path／Branchを受け、作成はfull Base Commit、削除は期待HEADを必須とする。WorkspaceのUUIDと既存Path／Branchの選択はCoordinatorが所有する。Mainは観測・内容操作対象であり、削除対象にしない |
| 所属Repository | 標準GitのWorktree一覧のmainを候補にし、既存Root検証・layoutの共通管理領域との一致を確認する。linkedからの呼出しでも所属Root直下へ置く。bare、別Repository、移動・重複・観測不能を推測で補わない |
| 配置 | 上位が所属Root内の相対PathとBranchを明示する。既存Workspaceの配置選択はCoordinatorが所有する。Path逸脱、祖先link、既存Worktree・登録・Branchの衝突は上書きしない。既存の親Directoryは許容するがVCでは除去しない。ignore設定を暗黙更新せず、既存除外の成立を前提確認する |
| 作成 | full Commit IDをCommit実体へ照合後、標準Gitで専用BranchとWorktreeを作る。共有Treeのdirtyをコピーしない。登録・実体・HEAD・Branch・cleanを読戻し確認する |
| 観測 | 登録と実体の有無、HEAD、Branch、locked／prunableを観測する。staged・unstaged・未追跡・ignoredを含む変更・残存の有無をdirtyとして検知し、未取得nullと区別する。観測失敗を不存在・cleanへ畳まない |
| 終了要求 | Orchestratorが採用・取込済み又は不採用・破棄を確定し、対象と非使用を確認して要求する。採用時は取込先の成果と採用記録を確認し、未取込残差・未追跡・ignored成果の破棄範囲も明示する。採用という結果だけで未取込内容まで消さない |
| 削除前確認 | Repository、Worktree実体・登録、専用Branchと期待HEADを再照合する。継続利用・期限付き明示保留・実行中・Gitのlocked状態・対象不一致・観測不能では停止する。dirty・未追跡・ignored成果は、確定した破棄範囲に含まれるなら削除拒否理由にしない |
| 削除順序 | Worktreeを標準Gitで除去→実体と登録の不存在確認→専用Branchを期待HEAD付きで削除→Ref不存在確認。未mergeの不採用Branchも明示破棄できる。変更を伴うWorktreeに必要な標準Gitのforce指定は、この確定済み対象だけに限定する。lock突破や未知の入れ子Repositoryの再帰削除へ拡張しない |
| 削除後 | 不要なWorktree・登録・専用Branchを残さない。必要な判断資料は責務Ownerが保全し、不要なWorkspace Directoryも確認後回収する。Commit Objectの即時消去・安全消去は保証せず、Git標準の参照と回収に任せる。他Branch・共有Tree・他Workspaceを変更しない |
| 外部処理 | 親Git環境・global／system設定、hook、fsmonitor、lazy fetchを抑止する。checkoutのsmudge／processと状態確認のclean／processを事前評価し、設定があれば未対応として拒否する。前段diff helperの成立をcheckoutへ流用しない |
| 途中失敗 | 要求未発行、発行後の非0、timeout、部分登録、読戻し不能を分ける。Worktree除去とBranch削除を別に観測し、一方だけの成立を全体成功にしない。同じ対象と成立済み段階へ再入場できる情報を返し、別ID再試行・自動Rollback・reset・prune・対象不明の強制清掃はしない |
| 競合 | 標準GitのRef／Worktree保護を使う。Hostによる非協調変更を完全に原子化する保証は作らず、独自Lock・Registry・常駐監視を追加しない |

技術APIは`createWorktree`、`getWorktree`、`removeWorktree`とする。削除の`discardChanges`は省略時false、明示trueだけで変更・未追跡・ignoredの破棄を許容する。上位は処置期間を通じ既存の利用調停で非使用を維持する。VC単独でTask実行中・採否・保留を判定したとは表示しない。WorktreeとBranchの不存在を独立観測し、Branchだけ残る部分状態も同ID・期待HEADで再入場する。親DirectoryはVCでは削除せず実観測を返す。CoordinatorがWorkspace専用親の再利用禁止と明示回収・保存投影を所有し、観測不能はnullで保持する。submoduleのgitlinkと現物、未追跡の入れ子Gitは拒否し、任意再帰削除をしない。

正常例はdirty共有Treeから固定Baseのclean Worktreeを作り、採用・取込済み又は不採用・破棄の確定後に不要なWorktreeと専用Branchを削除する場合。非発火例はTaskの終了・取消だけで継続Workspaceを削除しない場合。境界例はignored開発fileを含む明示破棄、未mergeの不採用Branch、処置直前のHEAD変更。判定情報不足例は要求後のtimeoutや一覧取得失敗で、同対象の部分成立／不明として停止する。

反証は実Gitの通常Root／linked起動、shared dirty非継承、二作業Tree、Path・登録・Branch衝突、採用成果保全・未取込残差の処置、dirty／未追跡／ignoredを含む明示破棄、未mergeの不採用Branch削除、保留／実行中／lock／HEAD不一致の拒否、外部処理の発火対照と非発火、Worktreeだけ削除後のBranch削除失敗・同対象再入場、他Workspace保全を用いる。発行中断・timeoutはProcess代役と実Gitの部分登録観測を組み合わせる。これはQA-000007・RFD-IT-029の部分接続であり、Merge・上位の再入場・全WorkspaceのPassではない。

成果物種別: Architecture詳細設計
詳細設計領域: version-control
状態: Canonical

### Workspace切替前の共通読取り

Tree／Diffの完成操作は、Package内部の共通Git読取りを利用する。親Git環境とglobal／system設定からの対象差替えを防ぎ、Git管理情報と作業Treeを指定Rootへ固定する。外部Diff・textconv・fsmonitor・pager・lazy fetchとoptional lockによる任意更新を抑止し、literal Pathを扱う。既存の出力上限・30秒期限・利用側の失敗分類を維持する。公開Adapterや注入Runnerは設けず、Gitの実行詳細は内部で所有する。通常作業全体へCommitを要求せず、操作ごとの成立範囲を結果で示す。

diff前には同じRoot・固定環境で標準Gitの設定名だけを有界観測し、clean／process filterがある場合は観測を拒否する。変換処理の独自実装・設定の強制上書き・属性や改行変換全体の削除は行わない。Git LFS等のfilter利用Repositoryの差分は現経路では未対応となり、空差分や成功へ補完しない。設定なしは正規のexit1・stdout空・起動errorなしだけで確認する。二要求の合計待機枠は従来の30秒以内に収める。設定観測とdiffの間に非協調のHost操作者が設定を変更する場合の原子性は保証せず、新しいLockや監視を追加しない。

通常Stageも同じ設定名観測を共有するが、Stage本体と同じRepository・global・systemの有効設定範囲を使う。設定がある場合だけ、Gitのliteral Path選択による候補File列挙と`check-attr`で今回の対象への適用を照合する。外部clean／processが適用される場合、観測失敗、Signal終了、総30秒期限の消費時は`add`を発行せず、`blocked / prepare_external_filter_unavailable / effectIssued:false / effectConfirmed:false / revisionIdentity:null`を返す。属性応答は全Path・属性名・件数を照合し、予約表示値と同名driverの曖昧さも許可へ補完しない。標準LFS設定があるだけで未適用のFileまで拒否しない。Workbenchはprepare専用の組合せとして受理する。UnstageとStage発行後の不明分類は変更しない。Filter Command値は返さず、属性・認証・Author設定を強制上書きしない。設定・属性観測とEffect間の非協調な変更の原子性は保証せず、新しいLockや監視は追加しない。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000002](../../Definitions/ARCH-000002/architecture_definition.md) | 契約移行時に旧／新Consumerを検索できるSnapshotと差分Portを提供する。 | Partial |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | 起点Pathから正確なRepository Root／worktree種別を検証し、選択差分のStage／Commit／確認済み通常Pushを目的別Portで扱う。 | Covered |
| [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md) | Runtime Artifactの完全性評価へ単一Snapshotとrevisionを提供する。Trust判断は所有しない。 | Partial |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | 履歴、Working Tree、観測時点を分け、Git commitを現在状態の必須条件にしない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Root、Snapshot、History、Diff、Integrityを目的別Portへ分ける。 | [§3](#3-目的別port) |
| Interface Model | Required | Git固有表現をCore契約へ漏らさない。 | [§3](#3-目的別port) |
| Data Flow | Required | 起点Pathから検証済みRootと単一Snapshotを発行する流れを示す。 | [§4](#4-capabilityと再確認) |
| State Model | Required | 未検証、検証済み、変化検出、観測不能を分ける。 | [§4](#4-capabilityと再確認) |
| Sequence | Required | Consumer移行をPort導入、並行照合、旧経路禁止の順で行う。 | [§6](#6-段階移行) |
| Failure／Recovery | Required | Root不明、競合、途中変更時にCapabilityを発行しない。 | [§7](#7-検証) |
| Deployment | Required | Repository、worktree、submoduleと本番Consumerの配置差を扱う。 | [§5](#5-consumer移行の必要条件) |
| Observability | Required | Root kind、revision、dirty state、観測時点、失敗理由を返す。 | [§7](#7-検証) |
| Security Boundary | Required | 読めるPathを自動的に許可済みRepositoryへ昇格しない。 | [§2](#2-責務境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 一回の判断を一つのSnapshotへ結び、途中変化を混在させない。 | [正本節](#4-capabilityと再確認) |
| Timing | PASS | 観測時点とRevisionを結果へ付け、古い観測を再利用しない。 | [正本節](#4-capabilityと再確認) |
| Resource Lifecycle | PASS | subprocess、snapshot、一時出力をOperation所有にする。 | [正本節](#7-検証) |
| External Boundary | PASS | GitをAdapterとして扱い、commit済みをCoreの成立条件にしない。 | [正本節](#3-目的別port) |
| Failure／Recovery | PASS | Root不明、worktree、submodule、fake `.git`、観測不能を区別する。 | [正本節](#7-検証) |
| State／Consistency | PASS | 未検証、検証済み、変化検出、観測不能を分ける。 | [§4](#4-capabilityと再確認) |
| Observability | PASS | Root kind、revision、dirty state、観測時点、失敗理由を返す。 | [§7](#7-検証) |
| Security／Trust | PASS | 読めるPathを自動的に許可済みRepositoryへ昇格しない。 | [§2](#2-責務境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `version-control.root-capability` | Interface／Security Boundary | 起点Path | exact Repository Root | fake .git、nested、submodule、link | IT | Direct Boundary | root kindとreason | process／handle 0 | Windows/Linux実境界 |
| `version-control.snapshot-port` | Interface／Consistency | working tree／revision | 単一snapshotの結果 | 観測間変更、commit前情報欠落 | IT | Direct Boundary | snapshot identityとobserved_at | 一時出力0 | 代替VCS Adapter未実装 |
| `version-control.change-publication` | Interface／External Effect | 選択差分、Stage領域、Local Commit、確認済みUpstream | 選択差分だけをCommitし、確認したRemote・Branch・Commitを通常Pushして終了後状態を返す | 誤対象、Conflict、Commit失敗、Push拒否、認証失敗、通信断、結果不明の成功化、自動再送 | IT／ST | System/E2E | Tree、差分集合、各Effect発行・確認、Remote結果、終了後状態 | 結果不明時の暗黙再送0、Force Push 0、Process／handle 0 | 部分Stageと大規模Repositoryの操作負担はWorkbench Pilotで確認 |
| `version-control.contract-migration-closure` | Flow／Consistency | 旧／新Owner、Producer、全Consumer、派生物、公開入口、署名・Release | 単一Snapshot上で移行集合が完全一致 | Consumer取り残し、別Snapshot混入、Canonical Path／Identity／State再解釈 | IT／ST | Related 2 Blocks | snapshot identity、集合差分、旧参照 | 全Consumer移行前の旧処理削除0 | 意味妥当性と移行採用は独立レビュー |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-13
要求: [`REQ-000036`](../../../01_Discovery/Definitions/REQ-000036/requirement.md)
変更: [`CHG-000071`](../../../99_Roadmap/Changes/CHG-000071/change.md)

## 1. なぜ独立させるのか

CRDDのToolはGitを、Repository Rootの確定、変更集合の観測、固定Snapshotの読取り、候補生成およびRelease Identityの作成に使っている。現在は各ComponentがGit CLIまたはGit内部構造を直接扱うため、通常作業までCommit SHAへ結合しやすく、別のVersion Control実装へ差し替える境界も不明確である。

Version ControlはRuntime Dataの保存内容ではない。Runtime Dataは「どこへ何を保存するか」を所有し、Version Controlは「RepositoryとRevisionをどう観測するか」を所有する。このため、`version-control`を`runtime-data`の子ではなく、全Toolから利用できるRoot Componentとする。

```text
Checker ───────────────┐
Runtime Data ──────────┤
Execution Intelligence ┤
Orchestrator ───────┼──→ Version Control完成操作
Coordinator ───────────┤                 │
Release／Signing ──────┘                 ▼
                                      共通Git技術処理
                                          │
                                          ▼
                                    Git CLI／Git Store
```

## 2. 責務境界

`repository/layout.ts`がRepository配置・実体Identityの観測と共通再検証を、`repository/ignore.ts`が除外設定の内容生成・Lock・書込み・原子的確定・readback・清掃結果を所有する。公開の`registerRepositoryLocalIgnore`は固定実装へ直接接続し、利用側のAdapter選択・注入を要求しない。Domain側も完成結果の確定後だけRuntime領域を作成する。内部の段階別故障試験と、実更新後の読戻し故障を通じたDomain結合試験を分ける。Lock名、更新順序、結果値、観測不能と不存在の区別は維持する。

| Owner | 所有すること | 所有しないこと |
|---|---|---|
| 利用側Component | 必要な意味、許可する操作、失敗時の処置 | Gitコマンド、`.git`配置、Object形式の再解釈 |
| Version Control | Repository・Worktree・変更内容の完成操作、Git CLI／Object読取り、技術結果の分類 | 業務Object Identity、採否・Release判断、Runtime Data保存 |
| Runtime Data | 検証済みRepository Rootに結合した`.crdd` PathとLifecycle | Repository RootまたはRevisionの独自観測 |
| Release／Signing | 固定Snapshotが必要な理由と署名Gate | 通常作業へClean TreeまたはCommitを要求すること |

## 3. 目的別Port

以下は完成操作の責務分類であり、実行時Port／Adapterを別々に構築する契約ではない。利用側はRootから必要な完成操作だけを参照し、固定Git実装は内部共通処理へ直接接続する。本書の移行表に残るPort／Git Adapterという呼称は、操作境界／内部Git実装を指す。交換用の抽象層やFactoryの存続を要求しない。

| Port | 入力 | 結果 | 固定Revision必須 | 代表利用側 |
|---|---|---|---|---|
| Repository Location | 起点Directory | 検証済みの最寄り／exact Repository RootとRepository形態 | いいえ | Runtime Data、Execution Intelligence、Checker |
| Local Change Set Observation | 検証済みRoot、必要な比較基準 | Revision差、準備済み差分、作業中差分、未登録Pathと観測状態 | いいえ | Checker、回帰選択、Workbench |
| Repository Worktree View | 検証済みRoot、Directory、Cursor、選択File | Directory直下Entry、変更区分、Query拘束Continuation、Prepared／Working Patchと切詰め状態 | いいえ | Workbench |
| Change Publication | 検証済みRoot、選択差分、Commit内容、確認済みRemote・Branch・送信Commit、人間Authority | Stage／Unstage、Commit、通常Pushの各結果と終了後状態 | いいえ | Workbench |
| Fixed Snapshot Read | 検証済みRoot、明示Revision、対象Path | Revision／Snapshot Identity付きの固定内容または観測不能 | はい | 固定履歴、外部送信Policy、候補生成 |
| Candidate Materialization | 固定Commit、許可Path、検証済み出力Repository内の空Directory。独立Tokenは発行しない | 隔離された候補と内容Identity。失敗時は部分生成の不存在またはcleanup観測不能 | はい | Coordinator、Orchestrator統合 |
| Fixed Revision Identity | 検証済みRoot、固定候補 | Revision／Snapshot／Object FormatのIdentity | はい | 署名、Release準備 |
| Repository-local Ignore Registration | 検証済みRoot、固定のignore entry | `registered`／`blocked`、原子的・冪等な登録結果、適用前後の内容Identity、Effect発行・確認・cleanup状態 | いいえ | Runtime用Repository-local除外の登録 |

通常の文書読取り、編集、Communication、Topic、Meeting、ProjectionおよびWorkbench表示は、Local Change Set Observationが変更ありを返しても成立する。Git Adapterが取得したCommit SHAはRevision Identityの実装値として出所へ付加できるが、業務ObjectのIdentity、通常保存の前提または正しさの代替にしない。

Version ControlはGit技術PackageとしてCommit・Index・Refを明示する。業務側はその技術値を業務Identityや採否の代替にしない。既存の保存値・観測値で使う意味の対応は次のとおり。

| Canonicalな意味 | Git Adapter内の観測例 |
|---|---|
| Revision Identity | commit object ID |
| Snapshot Identity | tree object ID |
| Revision差 | 比較基準Revisionから現在Revisionまでの差 |
| 準備済み差分 | indexと現在Revisionの差 |
| 作業中差分 | working treeとindexの差 |
| 未登録Path | untracked path |
| Repository-local Ignore | common Git directoryの`info/exclude` |

Release Identity、Runtime Execution Identity、署名対象集合およびRelease GateはVersion Controlの出力ではない。Release／SigningがFixed Revision IdentityとRuntime対象集合を入力に合成する。

固定内容の読取りは、一Fileあたり既定64KiBの上限を維持する。Runtime署名の出所照合など、必要な大きいSource／Nativeを読む利用側だけが`maximumBytes`を明示できる。値は1以上64MiB以下の安全な整数に限定し、既存Git objectの総読取り上限、Root・Revision・Path・modeと安定読取りの確認を緩めない。省略は既定値、不正値・上限超過・観測不能は内容なしの停止結果とする。通常の文書読取りへ大容量値を暗黙適用しない。この追加契約の実装・境界試験は[CHG-000082](../../../99_Roadmap/Changes/CHG-000082/change.md)で検証中である。

Git Adapterが本番RuntimeでGit CLIを起動する場合、その子Process境界はAdapter内部へ隔離するだけでは完了しない。署名Runtimeを構成する側は、実在する呼出し元、実行primitive、固定実行ファイルprefix、許可引数prefixおよび結果受領箇所をRuntime依存閉包へ全数登録し、配布物の静的観測と一致する場合だけ候補として扱う。Version Control側はGit操作の意味と失敗正規化を所有し、署名・Release Authorityは引き続き所有しない。

### 3.1 現行公開Symbol

依存方向はDomain Model → Version Controlとする。Domainが既存Workspace保存DTOと業務検査を所有し、技術選択・短命Index参照はVC正本の型を再利用する。CoordinatorがCommitと保持Ref、採用とMerge、明示終了とRef削除を合成する。

| Owner・用途 | 公開Symbol |
|---|---|
| Repository対象 | `Repository`、`RepositoryResult`、`getRepository`、`getRepositoryFromWorkingDirectory`、`resolveVerifiedRepositoryRoot`、`resolveVerifiedRepositoryRootFromWorkingDirectory` |
| 改訂・技術Identity | `readRepositorySnapshot`、`readRepositoryFormat`、`readRepositoryRevision`、`readRepositoryStorageIdentity`、`FixedRevisionIdentity`、`RepositoryRevisionObservation` |
| Worktree | `getWorktree`、`createWorktree`、`removeWorktree`、`WorktreeTarget`、`WorktreeResult`、`WorktreeCreateRequest`、`WorktreeRemoveRequest` |
| 現在内容・Index | `readTree`、`readFile`、`readFileDiff`、`readWorkingChanges`、`stagePaths`、`unstagePaths`、`WorkingChanges`、`TreePage`、`FileDiff`、`PathsRequest`、`FileReadRequest`、`WorkingFile` |
| 固定Commit・差分・コピー | `readCommitFile`、`copyCommitFiles`、`readCommitDiff`、`CommitFileReadRequest`、`CommitFile`、`CommitFilesCopyRequest`、`CommitFilesCopyResult`、`CommitDiffRequest`、`CommitDiff` |
| Commit・Merge | `commitChanges`、`createCommit`、`mergeCommit`、`ChangesResult`、`CommitSelection`、`CommitTemporary`、`ChangesCommitRequest`、`CommitCreateRequest`、`CommitCreateResult`、`CommitMergeRequest`、`CommitMergeResult` |
| Ref | `createReference`、`removeReference`、`ReferenceCreateRequest`、`ReferenceRemoveRequest`、`ReferenceResult` |
| Remote | `readRemoteTarget`、`pushRepositoryRevision`、`RemoteTarget`、`RepositoryPushRequest` |
| 宣言と除外 | `readRepositorySubmodules`、`readRepositoryEntries`、`registerRepositoryLocalIgnore` |

公開操作の入力構築・結果保持に必要な既存Request／Result型は、そのOwner定義をRootから公開する。型の複製や関数型からの迂回導出は行わない。内部Git ContextとTreeの構成要素単独の型は公開しない。

RootのDirectory再確認2関数は、Domain等がGit以外のRepository-local保存を行う直前の原本確認に必要な実利用があるため維持する。静的なLocation説明辞書は撤去し、診断では取得結果と発行済みTokenの契約値だけを表示する。借用Treeの所属は既存の保存用実体Identityで確認し、HEAD不要の条件を維持する。Layout検査のRoot公開は撤去し、技術解析と既存反証は内部に保持する。未使用の契約定数のRoot再公開とLayoutの静的Adapter説明関数は撤去する。Host Pathを返す内部利用の値は利用者向け結果へ載せない。

選択固定は既存Intent保存後、同期的に `createCommit → createReference` を呼び、必要なIndex回収とRef確定の合成結果だけを保存する。Commit生成後に回収が未確認でも既知OIDを捨てず、Ref確保を試みるが成功へ昇格しない。Ref読取りは `readRepositoryRevision(repository,{reference})` に明示不存在・存在・観測不能を保持する。指定Revisionの参照解決も同じ入口へ接続し、Checker用の独立したGit実行／固定本文Readerは撤去する。

removeReference は、保存済みの自己生成短命Index参照が指定された場合に限り、固定管理範囲・元実体・限定内容を照合して先に回収する。Commit ID未取得の回収を createCommit の新規Object生成へ読み替えない。任意Path削除、追加のStore／Registry／再探索は行わない。

### 3.2 用途を限定した公開入口

VCの成功・失敗理由は技術操作Ownerへ揃える。Commit生成はcommit_create_*、Mergeはcommit_merge_*、固定内容コピーはcommit_copy_*、固定Commit差分はcommit_diff_*、共有一時Index回収はcommit_temporary_*とする。旧candidate_*理由はVCから返さない。同名の旧入力不正でも操作ごとに別理由とし、技術的失敗をoutcome_unknownへ潰さない。Root公開API・status・Effect・不明・回収確認の意味と、OID・Tree・Path・Index・親関係・途中状態の判定は維持する。

内部Object／配置HelperはinspectGitCommitTree／copyGitCommitTree／readGitCommitFile／inspectRepositoryGitObjectFormat／inspectGitRepositoryLayoutとし、Merge対象はsourceCommitで表す。一般的な未検証入力のcandidate変数や内部観測statusは業務採否を表さないため、今回の改名で変更しない。一時Indexのcandidate-index-は既存exact Identityであり、COMMIT_TEMPORARY_PREFIXの値として維持する。CRDDの候補採否やTask状態の判断は引き続き上位Ownerの責務である。

公開理由値の変更は保存側にも影響する。Domainは今回搬送するcommit_create／commit_merge／commit_temporary系列と自分が所有する業務理由を受理し、固定・Merge成功は新しい成功理由とCommit相関で検査する。旧成功理由を持つ既存の固定／Merge状態は新検査で拒否する。保存fieldが同形でも意味上の互換性があるとは扱わず、自動移行・旧理由へのfallback・過去保持物の操作を追加しない。

resolveVerifiedRepositoryRootは、Domain等のRepository-local保存や所在照合のために維持する。Root取得はGit操作を利用側へ移す入口ではない。内容・Index・Commit・Reference・Merge・Remote操作はVCの完成操作で完結する。本番srcのRoot利用を点検した範囲では、RootからGit操作を自作する確定事例はない。検証Scriptの実GitによるRoot対照と自己生成fixtureの準備・観測は、本番のGit操作再実装とは区別する。

`readFile(repository,{path,baseCommit?})`は現在の作業Fileを読む。比較基準の省略または明示undefinedでは同じ呼出しの開始時HEADを使い、結果のbaseCommitへ返す。明示Baseは従来どおり比較に使う。Repositoryの実Object形式に一致する完全長OIDのみ受け付け、HEADなし、不正Path、link、容量超過、観測中のHEAD／内容変更は拒否する。この操作の失敗名はrepository_file系とし、候補固定の失敗と区別する。CoordinatorのWorkspace内容確認は保存済みBaseを引き続き明示する。

内容・Index操作の対象は渡された検証済みRepositoryである。Main固定ではなく、LinkedのRootを取得すれば同じ操作を利用できる。実Git対照試験では異なるHEAD・Index・作業内容を設定し、読取りとStage／Unstage／Commitの対象一致、反対側のHEAD・Index・作業File不変を両方向で確認する。共有Object Databaseや対象Branchの更新はこの不変条件に含めない。

今回SHA-256の操作対応は追加しない。既存Root入口のSHA-1限定を維持し、SHA-256 RepositoryはCapability発行前の拒否対照として確認する。内部のObject形式観測が可能なことを、公開操作全体のSHA-256対応と解釈しない。

`readWorkingChanges`は4観測が全て成功した後、既存の文字順・重複排除で`changedPaths`を一度だけ集約する。独立した集約関数は公開せず、Workbenchの表示用変更集合は既存fieldだけを明示投影する。

`readRepositorySnapshot`は検証済みRepositoryを受け、前後のRepository・改訂一致と中央のCommit／Tree対応を一つの実装で照合し、既存Fixed Revision Identity形式を返す。旧3入口と候補形式への中間変換は撤去する。保存値やHashの既存候補形式が必要な利用側は、その正本形式へ明示投影する。観測不能・差替えは既存のnull契約へ閉じる。CoordinatorのOperation Capabilityや40桁限定の実行許可は所有しない。Orchestratorの受付・採用・状態観測はCoordinatorの内部Git観測へ依存せず、この公開操作を利用する。

`readRepositoryStorageIdentity`は保存初期化と短期保存Ownerへの結合に用途を限定する。HEADの存在を前提にせず、Git共通管理領域と作業Rootの実体を前後で確認する。実行対象や回復でCommit観測が必要な利用側は従来のRevision操作を使い、この保存用結果で代用しない。

標準公開入口は`src/index.ts`に統合する。以下は別Fileの入口ではなく、Root公開API内の用途別Symbol集合である。Checker、Semantic Coverage、Domain Model等の利用側は必要なNamed Symbolだけをimportする。Rootの静的依存閉包には他用途のModuleも含まれ得るため、用途別importだけから狭い物理閉包や外部Effect不存在を推定しない。Module読込みと操作実行を区別し、Git内部実装への直接依存は禁止する。

#### Checker Observation

公開入口: 40_Develop/version-control/src/index.ts（Checker観測の公開Symbol）

| Capability | 公開Symbol |
|---|---|
| Checker Repository Observation | `readRepositorySubmodules`、`readRepositoryEntries`、`getRepository`、`readRepositoryRevision`、`readCommitFile` |

#### Repository Identity

公開入口: 40_Develop/version-control/src/index.ts（Repository Identityの公開Symbol）

| Capability | 公開Symbol |
|---|---|
| Repository Location | `Repository`、`resolveVerifiedRepositoryRoot`、`resolveVerifiedRepositoryRootFromWorkingDirectory`、`getRepository`、`getRepositoryFromWorkingDirectory` |

## 4. Capabilityと再確認

Repository Capabilityは、構造が同じ値を利用側が作るだけでは成立しない。AdapterがRepository境界、実体Path、link／reparse、worktree形態および必要なVersion Control応答を確認した場合だけ発行する。

| 時点 | 必須確認 |
|---|---|
| Capability発行 | 起点、exact Root、Repository形態、観測方法、失敗理由 |
| 読取り・書込み直前 | RootとRepository境界が同じであること、必要なRevisionの存在 |
| 外部Effect直前 | 対象Snapshot、許可Path、利用側Authority、観測時点 |
| 結果公開前 | 実際に使ったRoot／Revision／変更集合と観測不能範囲 |

`copyCommitFiles`は明示された出力Repositoryの原本と、そのRoot内の相対Directoryを受け取る。Root自体、管理Path、逸脱、link、途中の別Repository境界と非空Directoryを拒否し、Root・親・出力先の実体を同じ同期呼出し内で確認する。内容検査関数の呼出し後、成功返却前、失敗Cleanup前にも照合し、差し替えられた実体は削除しない。独立した出力Token・WeakMap・借用管理は撤去する。

Repository-local Ignoreは、`info/exclude`のPathを公開せず、適用前後の内容Hashを返す。rename前の失敗は`effectConfirmation: not_issued`、rename後にreadbackを完了できない失敗は`effectConfirmation: unknown`として区別する。Lock残存のcleanupを確認できない場合も再試行可能とは表示しない。

dirty、untrackedまたはdetachedであることだけを不正としない。必要な保証を満たせない状態と、利用側が明示的に許可していない状態だけを拒否する。

## 5. Consumer移行の必要条件

試験FixtureがRepositoryを作るためのGit呼出しはAdapter利用を要求しない。次表は本番Sourceまたは配布ToolがVersion Control境界へ移行する際の置換契約と完了条件を定義する。現在の実装・移行状態は対象改訂版付きReality Auditで判定する。

| Consumer群 | 置換対象の直接依存 | 移行先Port | 移行順 | 完了条件 |
|---|---|---|---|---|
| Runtime Data | Repository RootをGit CLIから直接取得する処理 | Repository Location | 1 | Root能力をPortから取得し、旧Root Ownerと直接Git依存が0 |
| Coordinator Repository Security | Repository Root／Layout／Operationの直接解釈 | Repository Location、Repository-local Ignore Registration | 1 | Root／Layout解釈をPortへ一本化し、Runtime Data領域作成時のignore登録を新Portへ接続 |
| Coordinator公式CLI配置準備 | 配置入力・一時領域の起点Root | Repository Location。領域作成はRuntime Dataを経由する | 1 | `prepare-codex-image.ts`がexact Rootを検証し、そのRoot直下の`.crdd/tmp`だけに新しいContextを作成する。未改造公式実行物だけを配置し、既存ContextとRuntime配布物は変更しない |
| Checker Current Tree | Root、index、HEAD、historical objectの直接観測 | Root公開APIのChecker Observation集合。Repository Identityが必要な責務は同Rootの対応集合を使う | 2 | 開発・採用の両経路が検証済みCRDD基準版のRoot公開APIを利用し、旧中継入口とGit内部実装への直接依存が0 |
| Regression Selection | 変更集合の直接導出 | Local Change Set Observation | 2 | 変更集合の意味をPortへ一本化し、実Git境界の反証を持つ |
| Coordinator Snapshot | Object Reader、Workspace、Candidate IntegrationによるGit内部構造の直接解釈 | Fixed Snapshot Read、Candidate Materialization | 3 | Object ReaderをAdapter内部へ隔離し、旧Owner Consumerが0 |
| Policy／Provisioning | Policy／Provisioningによる固定Snapshotの直接解釈 | Fixed Snapshot Read | 3 | 保護対象の依存閉包をexact Port／Adapter importで固定 |
| Release／Signing | Release／SigningによるRevision・Snapshotの直接解釈 | Fixed Revision Identity、Fixed Snapshot Read。Release Identityは利用側で合成する | 4 | 署名前のConsumer閉包、実行primitive、固定SnapshotとRelease Identityを反証できる |
| Doctor／公開診断 | Repository Git Layoutの直接説明 | Repository Locationの公開Projection | 4 | Git内部構造ではなく、Portが許可した公開Projectionだけを返す |

Execution IntelligenceはRuntime DataのRoot Capabilityを利用しているため、Runtime Data移行後に間接利用側として回帰を確認する。OrchestratorはCoordinator Adapter経由のSnapshot／Candidate利用を確認し、Gitへ直接依存させない。

## 6. 段階移行

```text
PortとGit Adapterの最小契約
          │
          ▼
Repository Locationを一本化
          │
          ▼
Local Change Set Observationを移行
          │
          ▼
Fixed Snapshot／Candidateを移行
          │
          ▼
Release／Signingを移行
          │
          ▼
本番Sourceの直接Git依存を機械的に拒否
```

各段階で、旧Consumerと完成操作が同じ意味を別々に解釈する期間を最小化する。完成操作へ移したConsumerは旧APIへ戻せない契約試験を持ち、全Consumer移行前に旧実装を削除しない。

## 7. 検証

| 観点 | 必須反証 |
|---|---|
| Repository Location | 通常Repository、linked worktree、submodule worktree、fake `.git`、link／reparse、Root途中の不正境界 |
| Local Change Set | 変更なし、Revision差、準備済み差分、作業中差分、未登録Path、rename、削除、観測不能 |
| Fixed Snapshot | loose／packed object、不明Revision、Path逸脱、内容改変、Object形式差 |
| Candidate | 許可Path外、衝突、部分生成、cleanup不明、同一Snapshotの再現性、所有Capability不一致、所有Directory外 |
| Repository-local Ignore | 通常／冪等、write・fsync・close・rename・readback失敗、二つの実Processによる競合と再入場、通常／linked worktree、適用前後Identity |
| Fixed Revision／Release利用側 | 通常作業は未Commitで成立し、署名／Releaseだけが固定Snapshot不足を拒否する。Release Identityは利用側が合成する |
| Consumer Closure | 本番Sourceの直接Git CLI／内部構造依存、旧API import、未登録Consumerを拒否する |
| 署名Runtime依存閉包 | 配布対象のGit Adapterにある子Process呼出しが、呼出し元・primitive・実行ファイル・引数・結果受領の登録集合と完全一致し、未登録または未使用の宣言を拒否する |
| 公開契約 | Repository・Worktree・Commit等の技術実体は公開名に使う。GitのProcess生結果・内部Context・不要なAdapter／Factoryは公開しない |

実Gitとの結合試験は、呼出し、結果取得、取消／失敗、後始末までのLifecycleを対象にする。Mockだけから実Git境界の成立を推定しない。

コピーの内容検査は同期の判断関数であり、`true`を拒否、`false`を許可として扱う。通知・ACKへ読み替えない。非Boolean値も拒否し、実Promiseが返った場合はRejectを捕捉するが待機しない。内容拒否など明示的な書込み前経路以外では、段階情報のない下位失敗を発行可能性・Effect不明として保持し、空一覧から未発行を推定しない。同じ出力実体のCleanup確認も、その過去不明を消さない。結果の`outputPathReported: false`は絶対Pathを搬送しないことを示す。旧Snapshotの個別型と`workspacePathReported`を新公開正本として残さず、永続化DTOや既存OperationのRecovery Schemaは変更しない。耐久Recordへ結合していない新しい回復IDは作らない。

Candidate採用は、全変更の適用成功、途中失敗後のrollback確認済み、rollback不明を区別する。先行PathへEffectを発行した後にrollbackを確認できない場合は、後続処理や一時Workspaceのcleanup成否にかかわらずEffect不明として停止する。rollback確認済みだけを正本Effectなしへ戻し、採用済みEffectと一時Workspace cleanupも別fieldで表現する。

Repository-local Ignoreの`blocked`結果はRuntime Data入口まで判別可能な結果として伝播する。rename後の観測不能、cleanup未確認および再試行禁止を`null`へ畳まず、`.crdd`領域は作成せずにexact Recovery参照を返す。

Consumer ClosureはAPI名の利用有無だけで完了しない。Canonicalな停止結果を受け取る全Consumerは、原因、Effect発行・不明状態、cleanup、再試行可否およびRecovery参照を、Ownerの構造化結果または同じfieldを保持する構造化Errorとして最終運用境界まで運ぶ。単純な`null`、汎用Errorまたは別原因へ畳む実装を拒否する。

Version Control Ownerの全試験はTest Catalogへ登録し、Version Control変更時と`--all`時の両方で静的確認・結合試験へ選択する。新しいOwner試験を追加してもCatalogまたは実行Owner集合へ伝播しなければ、回帰契約不成立として拒否する。

## 8. Checkerへの配布

v0.21 Phase 4では、`template/tools/crdd-check.ts`が同じCRDD基準版RootのVersion Control公開入口を直接利用し、Checker向けの生成Artifactを廃止した。採用Repositoryへ別Packageのinstallを要求せず、`template/tools`だけの単独コピーもサポートしない。Checker実装本体の`40_Develop`移行とlauncher薄型化は後続Phaseで行う。

```text
<verified CRDD baseline root>/
├ 40_Develop/version-control/   Canonical source／Owner package
├ 40_Develop/checker/           Checker implementation
└ template/tools/crdd-check.ts  thin launcher
```

| Gate | 確認内容 |
|---|---|
| Root Identity | 開発時はVersion Control RootとRepository Manifest、採用時は署名済みRelease Manifestで同じ基準版Rootを検証する |
| 実装Identity | launcherと同じ基準版Root直下の`40_Develop`だけを利用し、親Project、別Versionまたは類似配置へfallbackしない |
| 単独launcher | `template/tools`だけを配置したFixtureはEffect 0で拒否する |
| 追加installなし | 採用Repositoryへ別Package installまたはCRDD公式開発環境を要求しない |
| 単一契約 | Checker内部へ別のGit実装を複製せず、Version Control公開入口だけを使う |

## 9. 基準版Capabilityの移行

基準版はReleased Baseline `v0.20.1`とする。v0.20.1が引き継ぐv0.19.0／v0.20.0の成立Evidenceを使い、固定本文は変更しない。

| 基準Capability | 基準Evidence | 現Owner／API | 新Owner／Port | 保持する保証 | focused確認 | 実境界確認 | 旧実装削除Gate |
|---|---|---|---|---|---|---|---|
| Repository Root | [Coordinator完成確認](../../../99_Roadmap/Changes/CHG-000015/Evidence/260901_coordinator-completion-review.md)、[Runtime Data完了](../../../99_Roadmap/Changes/CHG-000066/change.md) | Runtime Data Root Capability、Coordinator Root Resolver | Repository Location | exact nearest Root、通常／linked／submodule、fake境界・link拒否、利用時再確認 | Owner契約試験＋既存Root試験 | 実Gitで3形態と拒否境界 | 全Root Consumer移行＋旧import 0 |
| Repository Layout／Local Ignore | [Coordinator完成確認](../../../99_Roadmap/Changes/CHG-000015/Evidence/260901_coordinator-completion-review.md) | Coordinator Git Layout／Repository Operation | Repository Location、Repository-local Ignore Registration | Git Directory／common directoryの実体、並行更新、原子性、冪等性、linked worktree共有影響、readback | 既存Layout／Operation試験の同一反証 | 通常／linked worktreeの実Git更新 | 全利用側移行＋旧書込み入口 0 |
| Fixed Object／Object Format | [packed object結合14/14](../../../99_Roadmap/Changes/CHG-000015/Evidence/260901_coordinator-completion-review.md) | Coordinator Git Object Reader | Fixed Snapshot Read、Fixed Revision Identity | loose／packed、OFS／REF delta、checksum、object ID、mode、許可Path、SHA-1／SHA-256判定 | 既存14件と破損反証を新Portへ接続 | 固定Gitでpacked-only Fixture | 旧Object Reader Consumer 0＋同等反証Pass |
| Candidate生成／統合 | [v0.19最終署名E2E](../../../99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md) | Repository Workspace、Candidate Integration Adapter | Candidate Materialization | base Revision／Snapshot、許可Path、部分生成、衝突、内容一致、cleanup／Recovery、正本Effect分離 | Candidate／Integration契約試験 | 実Providerを使わない固定Snapshot縦断＋Release前E2E | 全Candidate Consumer移行＋旧入口 0＋cleanup成立 |
| Signing／Release | [v0.20正式署名・4経路・Recovery](../../../99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md) | Release準備／Manifest署名Script | Fixed Revision Identityを利用するRelease／Signing | 単一Snapshot、配布Root、Manifest、Runtime Execution Identity、秘密入力前Gate、4経路／Recoveryとの同一性 | 署名前契約・mutation・Consumer closure | 正式署名、4経路4/4、Recovery 7/7 | 新しい正式Evidence成立後だけ旧経路削除 |

移行表の全行が新境界で成立するまで、旧実装を不要または置換済みと扱わない。一方、成立後は恒久互換層として残さず、利用側を新Portへ統一して削除する。

## 10. 対象外と未決事項

- Git実装を前提とした完成操作を公開する。将来のVCS差替えのためだけのAdapter・Factory・Portは設けず、GitのProcess生結果や内部Contextは公開しない。
- Git操作全般を提供する汎用Libraryや、任意Command実行入口は作らない。
- Git履歴が不要なRuntime DataをVersion Control Componentへ移さない。
- Remote Repository Hosting、認証情報管理、Pull、Force Push、RebaseおよびServer側Git管理は対象外とする。Branch／Worktree作成・MergeはWorkspace再編の明示要求に限定して設計対象へ戻すが、一般Git管理機能へ拡張しない。通常Pushは確認済みUpstreamへの限定Effectとして扱う。
- Object Format差、submoduleおよびlinked worktreeで保持すべき既存Capabilityは、段階移行の実測で再確認する。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `version-control.root-capability`<br>`version-control.snapshot-port`<br>`version-control.change-publication`<br>`version-control.contract-migration-closure` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Repository Root、Snapshot、差分観測と変更公開を、Gitの技術実体に対応する完成操作へ揃える。 | 利用側は通常作業全体へCommitを要求せず、変更公開時だけ選択差分と確認済み送信対象を渡す。 | Gitの生Command結果や内部Contextが利用側へ漏れ、対象照合やdirty状態の扱いが破綻する。 | `version-control.root-capability`<br>`version-control.snapshot-port`<br>`version-control.change-publication`<br>`version-control.contract-migration-closure` |
| Creation／Selection | Required | この観点を成立させる構造と責務が存在するため。 | Authority、入力または配置条件を満たした後にだけ具象・処理経路を選ぶ。 | 選択前の検証と選択後のIdentityを分け、未確認時はEffect 0とする。 | 選択条件の変更はTrust、Authorityまたは利用側契約へ波及する。 | `version-control.root-capability` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `version-control.root-capability` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `version-control.root-capability`<br>`version-control.snapshot-port`<br>`version-control.contract-migration-closure` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `version-control.contract-migration-closure` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `version-control.contract-migration-closure` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000002、ARCH-000009、ARCH-000014、ARCH-000016のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000006.spec-000010`、`PRT-000006.spec-000031`、`PRT-000013.spec-000018`、`PRT-000014.spec-000019`、`PRT-000017.spec-000022`

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
