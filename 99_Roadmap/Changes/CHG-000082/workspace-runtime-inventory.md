# Workspace方式への再編：現行能力と移管対応

成果物種別: 変更計画の調査・対応表
状態: 調査済み・詳細設計前（Source移管・実データ移行は未実施）
対象変更: [CHG-000082](change.md)
基準Commit: `a04ecb7038f1bbdc044bda07bbc709cddd0e2851`
担当責任者・方針決定権限: Qual-Lab
最終更新日: 2026-10-17

## 1. 結論と今回の範囲

Coordinatorだけを先に縮小せず、Version ControlのGit操作、Orchestratorの作業領域・仕事管理、Coordinatorの単発AI実行、Workbench／MCP／CLIの順に接続を切り替える。CandidateはWorkspaceへ改名するものではない。Workspaceは継続する作業領域、Candidateは採用判断のために固定した変更Commitとして分ける。

入力は人間が提示した「CRDD Workspace & Runtime Architecture 再編方針」。Directを標準、独立作業にGit Worktreeを使うIsolated、Repositoryごとのデータ所有、通常AI実行のOrchestrator経由、Coordinatorの業務永続責務縮小を再編対象とする。Tool Runtime側への製品データ集約、新しい常駐Daemon・汎用Lock／Recovery Framework、Worktreeを隔離とみなす変更は行わない。

本表は実装の所在と変更候補の対応であり、新設API・Schema・移行処理の確定設計ではない。今回はSource、通信契約、設定、Git Ref、実保存データ、Dockerを変更していない。過去Evidenceは変更せず、新構成の成立証拠として流用しない。

### 変更経路と着手前照合

- 分類: 複数Package・保存・認可・公開入口へ及ぶ再編の調査／計画更新。同じCHGの途中見直しとし、工程別CHGを作らない。
- 正本: [現在計画](second-stage-plan.md)、[Coordinator設計](../../../06_Architecture/Details/coordinator/01_Architecture.md)、[Orchestrator設計](../../../06_Architecture/Details/orchestrator/02_Detailed_Design.md)、[Version Control設計](../../../06_Architecture/Details/version-control/01_Architecture.md)、[Docker隔離設計](../../../06_Architecture/Details/docker-isolation/01_Architecture.md)。今回の表でこれらの現行契約を書き換えない。
- 着手前確認: 保存先の宣言と本番接続、既存能力の利用側、用語衝突、既存試験、移行前の保全を照合。読み取り専用の契約観点確認を実施。
- 今回の確認: 対応表の独立レビュー、文書リンク・差分確認。正式Architectureの更新段階で必要な文書／不足影響監査を行う。
- 今回は行わない確認: Source不変更のため実行回帰・実Docker／Provider試験は行わない。CRDD準拠基準・準拠表明を変えないため準拠監査は行わない。
- 人間判断: 基本方針は提示済み。具体的なDirect AI書込み方式、共有Gitへの許可、移行・破棄は詳細照合後に判断する。現在の棚卸しをこれらの実行許可にしない。

## 2. 保存先の現物と処置候補

Pathは基準Sourceが解決する場所であり、実機に当該データが存在するという主張ではない。秘密値や実候補本文は調査に収集していない。

| 対象 | 現在の保存・実装根拠 | 再編後の責務・処置候補 | 保持・撤去の条件 |
|---|---|---|---|
| Candidate本体 | `coordinator/src/platform-access/protected-root-windows-adapter.ts`の`rootPathCandidate`が`LOCALAPPDATA/Qual-Lab/CRDD/CandidateStore`を導出。`candidate/bundle-store.ts`の本番経路が使用 | Directは現在の作業Treeを使用し、毎作業のCandidate／Worktree生成を必須にしない。Isolatedの成果は対象Repositoryの`.crdd/workspaces/<id>/worktree/`へ保持。候補固定が必要な場合のGit参照・Commitと残す業務情報は方式別に対応付ける | 本番Host Storeを先に消さない。全参照・採用待ち・回復待ちの確認後、フロントAIが必要成果を保全して移行／清掃。Direct書込み許可・具体的Commit処理は未確定 |
| `.crdd/candidates/` | `domain-model/src/repository/resolve-storage-paths.ts`の名前付き領域。上記本番Storeとの接続は同一でない | 旧独自Storeの新しい常設保存先にはせず、Git移行後に宣言・Consumer・templateの要否を再評価 | 宣言の存在を本番切替済みとみなさない。Repository-localにしただけで二重Storeを維持しない |
| Coordinator現在状態 | `state-storage/model.ts`／`settlement-store.ts`。Repository-local `coordinator/state.json`、短命`state.lock`／`state.pending.json`、`history.jsonl`等 | 業務進行・結果参照はOrchestratorへ。単発実行の短命状態と必要最小限の残存処置を分離して評価 | 未解決Operation・配送・Host／資源参照を失わない。すべてをOrchestrator stateへ機械コピーしない |
| Orchestrator状態・Queue | `orchestrator/src/storage/current-state.ts`、`history.ts`。対象Repositoryの`.crdd/orchestrator/` | 既存の一体state・有限履歴を再利用し、RepositoryとWorkspaceの対象結合を追加する設計候補 | Queue／Attempt／Decision／結果参照の相関と再入場を維持。旧形式Runtime変換は追加しない |
| 一時AI作業領域 | `coordinator/src/host-execution/operation-workspace-lifecycle.ts`の既定`os.tmpdir()`、`repository-operation/workspace.ts`の固定Tree展開 | 継続Workspaceと、Docker用の短命実行材料を分離。Repository所属と借用・返却条件を明示 | OS一時Rootを今回移動・削除しない。継続WorkspaceをTask終了時のcleanupで消さない |
| 保持期間設定 | `.crdd/config/orchestrator.json`、`coordinator.json`等の用途別設定 | 通常履歴の期間設定はOwnerごとに維持。旧Candidate期限と継続Workspaceの寿命は別契約へ | 旧Candidateの最長168時間をWorkspaceの一律自動削除期限へ転用しない |
| 認証・Repository登録 | Access ManagementのHost管理領域、Provider認証は既存専門Owner | Host側保持を維持。製品RepositoryのWorkspaceへ秘密値を移さない | Package再編を理由に秘密値・保存Rootを変更しない |
| Merge分析資料 | 現行の専用本番実装は未確認 | `.crdd/workspaces/<id>/merge-result.md`。最初のMerge時に作成する案 | Task／Decisionの正本を複製せず、要点・対象Commit・参照を持つ。詳細Schema・保持整理は設計前 |

## 3. 能力・利用側・移管先の対応

以下のSource Pathはすべて`40_Develop/`相対。実装単位の所在を示し、Folder全体の無条件移動を指示しない。

| 能力 | 現在のOwner／主な本番利用側 | 目標Ownerと処置候補 | 既存能力を失わない撤去条件・必要検証 |
|---|---|---|---|
| Candidate生成・保存 | `coordinator/src/repository-operation/workspace.ts`→`candidate/bundle-store.ts`。`task/execution.ts`が公開／破棄を調整 | Git本体操作はVersion Control、成果の固定時点・参照・採用待ちはOrchestrator | 基準Commit／Tree、本文manifest、許可Path Hash、変更本文・情報分類、期限、staged／pending、回復参照を個別に対応。Gitだけで認可や失敗回復が成立したとしない |
| Candidate確認・採用・破棄 | `coordinator/src/workbench-ai/candidate-actions.ts`→Orchestrator公開APIおよび`candidate/integration-adapter.ts`／`platform/windows-adapter.ts`へのdeep import | Orchestratorへ統合し、Workbenchは公開APIへ接続 | Coordinator→Orchestratorの逆依存を解消。採用前Revision・レビュー固定内容・適用後保存失敗・重複採用拒否を新経路で確認 |
| 候補結果の記録・採用判断 | `orchestrator/src/candidate/{integrate,adopt,record-writer,integration-result,operations,integration-adapter}.ts`、stateのcandidateId／結果参照 | Orchestratorに維持。独自Bundle参照を固定Git成果へ再接続 | Store撤去前に全参照・公開結果・試験を切替。Candidate IDをCommit文字列へ単純置換しない |
| 固定Tree・変更比較・Git公開 | `version-control/src/fixed-snapshot.ts`、`git/commit-tree.ts`、`change-publication.ts` | Version Controlに維持・必要なGit操作を追加 | 既存固定Tree展開をGit Worktree生成と誤認しない。許可Path、差分、Commit／pushの現行制約を維持 |
| 継続Git Workspace | `version-control/src/repository/worktree-view.ts`は現在Tree／Diffの読取り。Worktree作成・Branch管理・Merge計算の本番接続は未確認 | 技術操作はVersion Control、Workspaceの利用・寿命はOrchestrator | 作成／再利用／取込／除去、Git共有管理情報、dirty、競合、途中失敗、再入場を設計・新検証。読取り試験だけでは成立しない |
| Task受付・進行 | `orchestrator/src/objective/`、`task/dispatch.ts`／`execute-attempt.ts`、`queue/types.ts` | Orchestratorに維持しDirect／Isolatedを同じTask対象へ接続 | Queue Entryには現在新Workspace識別がない。複数Processでの取得・再入場・対象不一致・二重実行を確認 |
| 単発AI実行 | `coordinator/src/task/execution.ts`、`provider/`、`ai-adapter`、DI Root API | CoordinatorはExecutor／Reviewer調整・取消・結果返却。Provider差はAI Adapter、隔離はDI | 新Task対象から旧CLI／助言／候補経路までを照合。通常実行のOrchestrator経由と開発／試験用直接入口を区別 |
| Workbench専用AI | `coordinator/src/workbench-ai/`の12 File。Workbench `bin/workbench-server.ts`が7 Moduleをdeep import | 業務依頼・結果はOrchestrator共通Taskへ、表示・HTTPはWorkbench、Provider差は既存Ownerへ | 12 Fileを丸ごと別Folderへ移さない。助言・取消・候補・結果公開の対応後に旧経路を撤去 |
| MCP公開入口 | `mcp-server/src/orchestrator/adapter.ts`、`request/access-resolver.ts` | MCPは認可済み対象を共通Package APIへ搬送 | 既存Repository識別・認可を維持しWorkspace選択を追加。WorkbenchをMCP依存へ戻さない |
| CLI公開入口 | `coordinator/src/cli/command.ts`のTask／候補／doctor、Orchestrator `src/cli/command.ts` | 通常TaskはOrchestrator、単発実行診断は用途限定Coordinator | 送信同意、実取消、終了コード、公開結果、対象Root解決を新構成で再確認。秘密入力を通常ログへ出さない |
| 通知・結果配送 | Coordinator `state-storage/`。Orchestratorは`task/executor.ts`が配送型・callback、`task/dispatch.ts`が捕捉閉包、`state/transitions.ts`／`storage/current-state.ts`が受領状態、`task/settle-docker-recovery.ts`が再入場Reader | 実行事実通知はCoordinator、後続再開に必要な受領はOrchestrator | Docker cleanupをConsumer任意保存へ再依存させない。同Process閉包だけで新Process再入場が成立したとしない |
| CRUD・Context読取り | Domain ModelのTopic／Meeting・Repository API | Domain Modelに維持。Directの作業対象に接続 | 通常CRUDをAI用Candidate経由にしない。短期更新排他・Revision・保存後読戻しと認可を維持 |

## 4. Queueと排他の棚卸し

| 現在の範囲 | 実装根拠 | 再編時に検討する粒度・反証 |
|---|---|---|
| state保存の短期排他 | Orchestrator `storage/current-state.ts`のstate保存／pending、Coordinator `settlement-store.ts` | 新Store／Lock Frameworkを作らず既存保存排他を評価。AI待機中の長期保持と区別 |
| 実行の長期Lease | `orchestrator/src/lease/controller.ts`の`project-operation`、`task/dispatch.ts`のbinding-wide lease後のQueue再読取り | 異なるWorkspaceの変更Taskを一律直列にしない。ただし現Leaseの保護範囲を確認してから変更し、先に外さない |
| 正本への採用 | `canonical-adoption` Leaseと`candidate/adopt.ts` | Direct CRUD・Promotionと共有Git更新の競合を対応。既存の採用排他だけでDomain CRUDまで協調済みとはしない |
| Provider／Host資源 | Coordinator `host-execution/kernel-lock.ts`、Host／Home取得、DIの既存資源処理 | Workspace排他と別。別Workspaceだから認証Homeや実行数の制限を迂回できるとはしない |
| Candidate Store排他 | `candidate-store.lock`とWindows Kernel排他、Store実体・利用者結合 | Bundle Storeの能力置換後に専用排他を撤去。Git・Orchestratorの現行排他へ対応せず消さない |

同一Hostの複数Processを最初の検証範囲とする。Multi-host共有Filesystemは適合未確認であり、ローカル排他から成立を推定しない。新しいHost全体のRegistryやQueue Serverを必要とするとは未判断。

## 5. 既存workspace表記の整理

人間の追加指示により`Workspace`を今回のDirect／Isolated作業領域の名称とする。既存の別概念は意味に合う名称へ変更する対象とする。Source・通信・設定の変更は後続の正式移管で一斉に行い、過去Evidenceは当時の名称・Hashを維持する。

| 既存の意味 | 現物 | 改名方針・候補 | 互換性・影響 |
|---|---|---|---|
| development／managementの閲覧範囲 | AM `credential/authentication.ts`、`access/repository-access.ts`、Role／Exposureの`workspaceIds`。Domain・MCP・Workbenchにも搬送 | 内容領域（候補`contentAreaId(s)`）へ改名。新WorkspaceのIDへ流用しない | 永続Schema・通信入力・Role／Exposure設定・表示・試験を同じ切替単位へ。単なる内部Symbol改名ではない |
| Taskごとの一時作業・管理Root | Coordinator `host-execution/operation-workspace-lifecycle.ts`、binding／借用型 | 一時実行領域を表す`execution-directory`等へ。所有する情報を確認してFile／Symbol単位で命名 | Root／回復参照・Nativeとの搬送も対象。継続Workspaceの寿命へ誤変換しない |
| 固定Source展開・候補抽出 | Coordinator `repository-operation/workspace.ts` | 固定Source展開と変更抽出の実責務で改名／分離を評価 | Bundle撤去と一体で扱い、`workspace.ts`だけの形式的改名で完了しない |
| Docker mount・CLI用語 | 隔離契約の作業Directory／`workspaceMountModeConfigured`等 | 自前公開fieldは作業Directory／mountの意味が伝わる名称へ整理候補。外部CLIの予約語は無断変更しない | 固定診断・公開Schema・利用側を同時照合。Dockerの境界を新Workspaceへ拡張しない |
| Gitの既存用語 | Version Controlの`worktree-view`、Git worktree | Git Worktreeは標準技術語として維持。読取りViewと新Workspace管理を区別 | Worktreeという語自体を新Workspaceへ置換しない |

基準Source検索では`worksplace`の綴りは検出しなかった。`workspace`はSource／試験／JSON等166 Fileに出現し、検索件数は実装能力や改名完了数ではない。上表は意味分類であり、正式実装前にはSymbol・Schema・Consumer・ひな型の全箇所対応へ展開する。

## 6. 検証・移行の入口と残る設計事項

### 基準版で既存能力を確認する試験

| 能力 | 既存試験（今回未実行） | 新方式で必要な追加確認 |
|---|---|---|
| 候補保存・読取り・期限・回収 | Coordinator `candidate-bundle-store.contract.test.ts`、`candidate-store-kernel-lock.contract.test.ts` | Git成果固定、参照中／未採用成果の保全、Workspace破棄との分離 |
| 作業展開・候補抽出 | Coordinator `repository-workspace-runtime.contract.test.ts` | Direct／Isolated、Task跨ぎの継続、Git管理情報のマウント境界 |
| 採用・適用後記録 | Orchestrator `candidate/adopt.contract.test.ts`、`candidate/integrate.contract.test.ts`、Coordinator `orchestrator-candidate-integration-adapter.integration.test.ts` | 固定Commitの再確認、dirty正本、競合、適用後記録失敗、再入場での二重適用拒否 |
| 状態・Queue・Process所有 | Coordinator `orchestrator-durable-foundation.contract.test.ts`、`orchestrator-queue-priority.contract.test.ts`、Orchestrator `public-owner-boundary.contract.test.ts` | 同一Workspace競合、異なるWorkspace並行、複数Process二重取得、片側喪失 |
| Git読取り・公開 | Version Control `repository-worktree-view.integration.test.ts`、`change-publication.integration.test.ts` | Worktree追加／除去、Branch、Merge計算／取込の実Git確認 |
| 隔離・公開実行 | [DI完成照合](second-stage-plan.md)、[DI詳細](../../../06_Architecture/Details/docker-isolation/01_Architecture.md) | 新Workspace借用の実Mount・取消・清掃。前方式の実測から新方式の成功を推定しない |

### 詳細設計で閉じる事項

1. Directの任意Source編集をDockerへどう渡し、共有Git情報へ何を許可するか。信頼済みCRUDと一律にしない。
2. 新WorkspaceのIdentity・Directの扱い・Task対象・Root解決と、既存の内容領域IDの改名。
3. Git Commitで代替するCandidate情報と、Task／Decision／レビュー記録として残す情報の最小集合。
4. Worktree内から起動した場合も、所属RepositoryのRuntime正本へ解決できるか。最寄りRootだけでnested `.crdd`を作らない。
5. Worktree／Branch作成・除去とGit Ref更新、Direct CRUD・Promotionの競合・dirty・失敗時状態。
6. Merge前計算、明示取込、通常Taskでの影響分析、`merge-result.md`の同期と保持。分析失敗を無断Rollbackや自動修正にしない。
7. Host旧Store・一時Root・両stateの現在参照を、実移行時にフロントAIが確認・保全・清掃する手順。今回の調査では存在・使用状況を実機確認していない。

署名の通常実行依存は基準Commitで撤去済み。入力文書に残る署名縮小の未決表現を理由に、Runtime署名や新しい配布Frameworkを再導入しない。正式配布の真正性は別責務として維持する。

次は本表を入力にArchitecture／Qualityの変更契約とPackageごとの完了条件を具体化する。①完了を新Workspace実装済み、旧Store廃止済み、移行承認または全体完成とは表示しない。

### 今回の確認結果

契約・品質の独立レビューで、DirectまでIsolated配置へ広げて読める記述一件と、配送・受領の実装所在誤記一件を検出した。全結果を統合し、両確認者と是正方針を照合して該当二セルだけを修正した。固定候補の限定再確認は両者とも残指摘0。三変更文書のローカルリンク所在と差分空白検査を確認し、新規表の参照先欠落は0。実行回帰・実Docker／外部AI依頼・保存データ移行は行っていない。①の調査・対応表を完了し、詳細設計へ引き渡す。

## 7. Direct／Candidateの簡素化方針と現物の再照合（2026-10-17）

本節と§8は当時の方針・構成候補・実測を記録する。秘密情報の現在の区分は後続の[§9](#9-開発情報と共通隔離方針の変更2026-10-17)とDI正本を優先し、旧「全秘密アクセス禁止」や開発情報の全隠蔽を現在の停止条件へ流用しない。

### 人間が訂正・採用した境界

前節までの棚卸しとその後のArchitecture伝播に対し、人間が次を明示した。以前の「allowedPathsをDockerの書込み制限にする」「同一ファイルにdirtyがあれば都度確認する」推奨は採用しない。以下を現在方針とし、未確定だったDirect／dirtyの一般方針を再質問しない。今回はSource実装を開始せず、必要な変更と撤去条件を整理する。

| 対象 | 現在の採用方針 |
|---|---|
| Direct | 現在のWorking Treeを直接編集。通常Source／Test／非秘密設定は原則編集可能。同じファイルの既存dirtyも現在Inputに含める。Candidate化・Promotionをしない |
| 技術保護 | 選択Repository外への書込み、`.git`と実Git管理領域への書込み、秘密情報へのアクセス、`.crdd`内部状態への書込みを禁止。一般設定の編集許可を秘密値の読取り・送信許可へ拡張しない |
| allowedPaths | 作業指示と実行後の変更範囲評価のみ。DockerのPath単位ACL・Mount許可には使わない。範囲外変更の事後検出は変更防止ではなく、元ファイルを自動復元しない |
| Candidate方式 | Isolated Workspaceで、固定Base CommitからcleanなWorktreeを生成して変更を作る。共有側dirtyは自動継承しない。共有側dirtyがあるだけでは生成・実行を拒否しない。固定するコード成果と継続Workspaceの区別は維持 |
| Git更新 | 今回採用するCommit・Branch／Worktree管理・切替・Merge・Pushの技術操作はVersion Controlが担当。Cherry-pick／Rebase等も必要時のOwnerはVCだが、今回の提供範囲へ追加しない。AIへ共有Git更新を直接委譲せず、AI終了だけではCommitしない。検証と明示操作後に確定する |
| Dirtyと統合 | Directではdirtyを許容し、Stage済み変更を勝手にCommitへ含めない。統合先に衝突するdirty・Stage済み変更・未追跡物があれば自動Promotionせず停止。無関係なdirtyを一律拒否しない |
| 失敗・取消・競合 | 自動Commit／Stash／Reset／Clean／Rollbackをしない。同時編集による上書きリスクを明示し、監視常駐・新Lock Frameworkで解消したとはしない。Git競合解消は人間または明示依頼したCoding AIの別作業 |

### 現行実装との差分と撤去候補

Pathは`40_Develop/`相対。判定はSourceの読取りによるもので、実機への侵入試験・実Mount検証は行っていない。

| 現物 | 必要な変更 | 縮小・撤去できる候補／残す保証 |
|---|---|---|
| DI `execution/command-plan.ts`は作業Root一件と`readOnly`から単一bind mountを構成。`.git`／`.crdd`／秘密ファイルの除外なし | Direct用の基本保護が可能かを先に評価。Repository全体RWを指定するだけでは新方針未成立 | allowedPaths別Mount／Path ACL・動的承認は作らない。固定境界の最小構成を検証できなければ報告して止める |
| Coordinator `repository-operation/workspace.ts`は固定Treeを別領域へ展開し、manifest・allowedPathsHashと変更を確認、Bundle保存へ渡す | Directは開始時の実Tree／dirtyをInputにし、終了差分と想定外変更を返す。既存変更・並行変更・帰属不明を今回AIの成果と断定しない | Directには固定Tree複製、Bundle保存・publish、Candidate採用／Promotionを接続しない。事後差分・入力相関・秘密値非公開は維持 |
| `task/execution.ts`のCandidate公開／破棄、`candidate/bundle-store.ts`のstaged／pending／期限／容量／専用排他／回復 | Candidate方式を固定BaseのGit WorktreeとOrchestrator参照へ接続。全Consumer・未解決参照・必要成果を先に対応 | 置換後に独自Bundle本体・公開段階・専用GC／Lock／Store回復を撤去。現在の元参照を無断削除しない。Gitへ採用判断や認可を吸収しない |
| `workbench-ai/candidate-actions.ts`は旧Candidate IDから読取り・採用・破棄、Orchestratorへ依存 | Direct結果とCandidate統合を別操作へ。通常AI経路をOrchestratorへ統合 | Coordinator内のSurface専用採用中継・逆依存を撤去。表示／HTTPはWorkbench、Git操作はVCへ |
| VC `git/worktree-view-adapter.ts`のDiffは`--no-ext-diff`あり、textconv無効・環境／任意設定・optional lockの閉じた制御は未接続 | Status／Diff／Logを操作別に安全な読取りとして固定。副作用を生む拡張・外部処理を起動しない条件を確認 | Git機能・Conflict解消を独自再実装しない。新Git実行Frameworkでなく既存Adapterの有限操作・引数・環境を評価 |
| VC `git/change-publication-adapter.ts`は通常`git commit`を実行 | 明示確定時の対象差分・既存index・dirtyの混入を再確認する設計が必要 | `git add .`や既存index全体を今回成果とみなさない。Commit処理の存在だけで新候補固定成立としない |
| `secret-material-policy.ts`は既知形式・名前の検出。Claude設定はProvider HomeのRead／Edit／Write等を拒否 | 既存防御を維持し、秘密ファイルをMountで露出しない条件とProvider側制限を別評価 | 認識済み秘密の拒否を未知秘密不存在の証明にしない。既存CLI防御がある事実とOS境界の未実証を混同しない |
| Orchestratorのstate／Queue／LeaseとDIのHost／Home・資源終端 | 対象Workspace・結果・Git参照へ既存機構を再接続 | 新Registry／永続State／監視Process／汎用Lock／Recoveryを追加しない。既存排他の必要保証を評価せず全撤去しない |

### 現構成だけでは保証できない条件

1. **Directの基本保護**: 単一のRepository RW bindには内部Pathの除外がない。`.git`／`.crdd`が同じRootにあれば、そのまま露出する。Container root filesystemのread-onlyは別のRW mountを読取り専用にしない。linked worktreeの`.git`ポインタ・共有管理情報、別名・リンク・入れ子Mountも実境界での確認が必要。
2. **秘密情報へのアクセス禁止**: Repository内の既知秘密ファイルを露出しないことと、通常Sourceに埋め込まれた未知秘密まで検出して完全遮断することは別。現検出器では後者を証明できない。Provider自身の認証に必要な専用Homeと、AIの任意読取り・他の資格情報も分けて評価する。既存Provider制限を撤去しない。
3. **副作用を生まないGit読取り**: `--no-ext-diff`だけではtextconv等の全外部処理を無効化したことにならない。Status／Diff／Logそれぞれで設定・環境・fsmonitor・pager・引数・optional lock等を評価する。現読取りAdapterを新保証の完成として表示しない。
4. **同時編集と帰属**: Directは同じ実ファイルを共有する。開始／終了観測だけで、人間との同時編集による上書きを防止できず、全差分をAI由来と断定もできない。警告と差分・不明の提示は行うが、常駐監視・自動復元で解決する設計へ拡張しない。

Dockerのbind mountはHost側の実ファイルへ作用し、mount単位のreadonlyと内部除外は同じ機能ではない。[Docker公式仕様](https://docs.docker.com/engine/storage/bind-mounts/)を参照。Gitの外部Diffとtextconvは別の設定・optionであり、Statusの背景処理ではindex更新も考慮する。[Git Diff公式仕様](https://git-scm.com/docs/git-diff)、[Git Status公式仕様](https://git-scm.com/docs/git-status)を参照。確認日は2026-10-17。外部照会は公開技術語・公式URLのみで、内部Source・Path・候補・秘密値を送信していない。

### 最小案と代替案（未実装）

| 案 | 維持する意図・限界 | 次の処置 |
|---|---|---|
| 通常TreeのRW共有＋保護対象だけ固定的に非公開／非書込みとする標準Docker構成 | Directを維持し、allowedPaths制御を作らない。固定mask等の手段は候補であり、親からの置換・別名・ファイル／Directory差・秘密Path・Desktop上の意味は未証明 | 最有力の調査対象。新Frameworkを作らず、成立条件を限定実証する計画を先に提示。今回実行しない |
| Repository内の秘密を既存の保護領域へ分離し、共有する通常Treeに置かない | 秘密露出を減らせるが、配置・既存Tool利用を変える。未知秘密が自動でなくなる保証ではない | 必要になった対象だけ人間へ具体的影響を提示。現データ移動・削除はしない |
| 最小構成で基本保護を満たせないRepositoryはDirectを未対応として停止 | 不足保証を隠さない。Candidate方式も独自の隔離確認が必要で、無断fallbackはしない | 保証できない項目と理由を提示し人間判断へ。DirectをPatch適用・常時Worktreeへ勝手に変更しない |

結論: 方針は採用済みだが、**現行Docker Isolationだけで新Directの基本保護を満たすとは言えない**。技術構成の確認前にDirect実装を開始せず、削除候補も能力置換・参照保全・必要検証が揃うまで削除しない。今回の照合はSource読取りと公開仕様確認だけであり、実装・Mount・Git書込み・実データ移行は0。

本再照合の固定候補レビューは契約・品質の二観点で実施した。Git操作のOwner方針と今回提供する機能範囲の混同一件を、両確認者との照合後に対象セルだけ是正し、両限定再確認は残指摘0。ローカル参照先欠落0、差分空白検査成功。これは方針と現物Gapの確認であり、未実証のDirect保護を成立へ変更しない。

## 8. Directの最小Mount案と限定実証計画（未実装・未実行）

### 結論と構成候補

現在TreeのRW共有を維持し、保護対象を空の読取り専用Mountで覆う標準Docker構成を、最初の反証対象とする。これは成立済み設計ではない。固定Pathの保護を実証できても、未知秘密を含むDirect全体の完全保護を実証したとはしない。

| Container側 | 構成候補 | 意図・制限 |
|---|---|---|
| `/work` | 選択した現在TreeのRW bind | 通常Source・Test・非秘密設定と既存dirtyを直接編集。allowedPaths別Mountは作らない |
| `/work/.git`がDirectory | 空Directoryの読取り専用Mount | 元の内容を非公開・非書込みとする。空のreadonly tmpfsまたは空Directory bindを候補とし、実証前に方式を一つへ固定する |
| `/work/.git`がfile | 空fileのreadonly bind | linked worktreeのポインタを覆う。共有Git管理Directory自体はmountしない |
| `/work/.crdd` | 空Directoryの読取り専用Mount | 内部状態を非公開・非書込みとする。通常Sourceの編集範囲には含めない |
| 既存の既知秘密file | 空fileのreadonly bind | 名前・所在が確認済みの対象に限定。通常Sourceに埋め込まれた未知秘密や後から作られる秘密を包括しない |
| その他のHost領域 | mountしない | Docker socket／pipe・Host Root・一般の認証Directoryを提供しない。Provider専用認証は既存の別契約で評価する |

fileとDirectoryの型を区別し、存在しないbind元を暗黙作成する指定は使わない。空placeholderは共有Treeの外側に置く。root filesystem read-only、非root、capability削除等の既存隔離を維持し、保護対象の親Directoryや別名からの差替えも反証対象にする。Repository内の入れ子Git管理領域・submoduleを、Rootの`.git`だけで保護済みとしない。

Mountによる内容の隠蔽、read-only rootとRW mountの違い、再帰Mountの制約は[bind mount仕様](https://docs.docker.com/engine/storage/bind-mounts/)と[run仕様](https://docs.docker.com/reference/cli/docker/container/run/)を根拠とする。readonly tmpfsは[公式tmpfs仕様](https://docs.docker.com/engine/storage/tmpfs/)上の候補であり、file保護へ流用しない。Docker DesktopのLinux Containerでの実際の意味は、文書だけで成立扱いしない。

### 合成物だけを使う試験境界

| 項目 | 計画 |
|---|---|
| exact Root | `C:\project\CRDD\.crdd\tests\direct-mount-boundary\`。未来の専用試験Rootであり、今回は作成しない |
| 内容 | Root内に合成Repository、空placeholder、観測用sentinel、短い結果要約。実RepositoryのSource・秘密・認証情報を複製しない |
| 実行物 | 既存local Image一つ。実行前に所在・版・exact Image IDを読取り確認し、承認対象へ明記する。取得・更新しない |
| Container | 通常Git Directory型とlinked worktree file型の二構成を順番に実行。同時一件。刺激を安全に独立させられなければ実行前に計画を再整理し、件数へ無理に詰め込まない |
| 外部Effect | networkなし、外部AIなし、認証領域なし、Docker再起動・修復なし。実データ・既存Container／Image／Volumeを削除しない |
| 期限・終了 | 各Container最大60秒を初期上限候補とし、実行前に固定。失敗・観測不能・保護破りでは以後の刺激を停止し、同じ実IDの試験資源だけを回収する。自動再試行・別方式fallbackをしない |
| 清掃 | 自己生成Containerの実IDと不存在を確認後、専用Rootの非使用・内容・範囲を確認して削除。新規Networkは作らず、既存の`none`等も削除しない。回収不能なら残存対象と理由を報告し、汎用Recoveryを追加しない |

Host側sentinelも専用Root内に置き、Containerへ共有する合成Treeの外側とする。現CRDDの`.git`／`.crdd`そのものを試験で書込み対象にしない。実行許可はまだ取得しておらず、試験Sourceの作成も今回の対象外である。

### 刺激・観測・判定

| 観点 | 刺激 | 必要な観測・判定 |
|---|---|---|
| 正対照 | 既存dirty相当の合成Sourceを読取り・変更 | Hostの同じfileへ変更が現れる。全書込みが権限不足だっただけの試験を保護成功にしない |
| Git管理・内部状態 | 保護Pathへの読取り、書込み、新規file、rename、削除 | 元内容を読み取れず変更できない。Containerの終了値だけでなくHostの保護対象・親・実体の不変を確認する |
| file／Directoryの差 | `.git` Directoryとポインタfileを各構成で使用 | 実Git管理領域・Ref・indexに変化なし。ポインタを覆っただけで別経路の安全まで主張しない |
| 別経路 | 合成symlink／hardlink／junction、大小文字違い・別名、親Directory差替え、入れ子Git領域 | 各経路を別に記録。作れない刺激はNot Run、読取り不能な観測はUnknown。いずれも保護成功へ畳まない |
| 既知秘密 | dummy値だけを持つ保護fileを読取り・変更 | 元dummy内容が見えずHost側内容・実体が不変。実秘密は使わず出力へ複製しない |
| 固定maskの限界 | 起動後に新しいdummy秘密Pathを追加する反例 | 固定maskで包括できない条件を確認するための反例。読めた場合は包括保護Failであり、期待した挙動だから全体Passとはしない |
| Repository外 | mount一覧とHost側sentinel、書込み対象の到達経路を照合 | sentinel不変と非公開Mountを確認。単一Pathへ到達できないだけで任意Host Path書込み不能を証明したとしない |
| 終了 | 正常・失敗・期限時の終了と試験物回収 | 自己生成Containerの不存在とHost観測の確定まで確認。回収成功を保護試験成功へ読み替えない |

各刺激の前提・Host比較値・終了条件を試験器へ固定する前に、構成と反例を再照合する。別名で元の保護対象へ到達できる、親から置換できる、または観測できない場合は、その構成の保証は未成立として止める。反例を外して成功率を上げず、新しい監視・ACL・台帳をその場で追加しない。

### 実証後も残る判断

固定maskは、起動時に把握したPathの保護候補にすぎない。未知秘密、別名、実行中の新規秘密配置を自動で包括する案ではない。これらを含む無条件の「秘密アクセス禁止」は現段階で保証できないため、Directを有効化する前に、未対応条件での停止・秘密をTree外へ置く前提等を具体的な結果とともに人間へ提示する。現在の方針を、暗黙のリスク受容や秘密を含むTreeの共有許可へ変更しない。

次の順序は、計画の独立確認→保証不足の説明→限定試験の具体的許可→試験器と構成の固定→局所実証である。Source本実装、実データ移行、旧Bundle撤去はその後の判断とし、今回進めない。

### 限定試験の承認対象の固定（2026-10-17）

DockerのImage一覧・Image設定・稼働Container一覧を読取り確認した。初回のsandbox内照会はpipeアクセス拒否であり、許可された読取り照会で確認した。Container作成・起動・停止・Image取得は行っていない。稼働Containerは0、次の専用Rootは不存在だった。この観測を将来の非使用保証にせず、実行直前に再確認する。

| 固定する対象 | 内容 |
|---|---|
| Image | 既存`python:3.12-slim`、Image実ID `sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`。Linux／amd64、既定commandは`python3`、Image定義のVolumeなし。実行の固定値はこのImage実IDとする |
| 選定理由 | 現行Provider Dockerfileと同じ基底Image。AI CLI・認証なしでFilesystem刺激を実行するため。製品Provider全体やその認証保護を検証するImageとして扱わない |
| 実行構成 | Image実IDで固定、pull禁止、network=`none`、user=`65534:65534`、root filesystem readonly、cap-drop=`ALL`、no-new-privileges。Imageの既定root userに依存しない |
| mask方式 | file／Directoryとも、Tree外の空placeholderをreadonly bind。今回tmpfs方式との比較は行わない。型違い・元Path不存在は起動前に停止 |
| 専用Rootと内容 | `C:\project\CRDD\.crdd\tests\direct-mount-boundary\`内だけに`directory-case/`、`pointer-case/`の合成Tree、`masks/`、`sentinels/`、短命結果を作る。実CRDD本体を`/work`へmountしない |
| 二構成 | 一件目は合成`.git` Directory、二件目は合成`.git`ポインタfileと非共有の管理領域sentinel。Git構造を模したFilesystem試験であり、実Git Worktree／Ref更新の試験ではない |
| 試験器 | 承認後、`40_Develop/docker-isolation/tests/integration/direct-mount-boundary.integration.test.ts`へ明示実行専用の試験を追加する候補。通常回帰からDockerを勝手に起動しない。製品Source・公開API・保存Schemaは変更しない |
| 上限 | Container最大2件、順次一件ずつ、各60秒。停止・回収も対象の実IDに限定し各60秒を上限とする。timeout時は以後の試験を止める。自動再試行・件数追加なし |
| 観測と保持 | 合成Sourceの実編集を正対照にし、保護対象・親・別経路・Host sentinelを前後比較。作れない別名はNot Run、観測不能はUnknown、保護破りはFail。通常logは専用Rootだけ、短い結果・限界を本計画に記録し、実行別Evidence書庫を作らない |
| 回収 | 今回作成したContainerだけを実IDで停止・削除して不存在確認。専用Rootの非使用・非reparseの削除境界と合成物を確認し、合成link自体を含めて清掃する。範囲外へlinkを辿って削除しない。確認不能な残存は保持して報告 |
| 実行しないこと | Docker起動／再起動／修復、Image取得・Build・更新、既存Container／Image／Volume／Network削除、外部AI依頼、認証使用、実Repository編集、Commit／Push、製品Source実装 |

合成linkの作成自体がHostの追加権限を必要とする場合は、その刺激をNot Runにして追加権限操作を行わない。既知秘密の代わりは無害なdummy値だけとし、通常Source内の未知秘密・後置き秘密を包括保護できない制約を維持する。試験開始前に試験器の独立確認と対象・構成の再照合を完了する。今回の許可要求は上表の試験器作成・限定実行・自己生成試験物の回収だけであり、Direct本実装の許可を含まない。

### 承認済み一回の実証結果と終了（2026-10-17）

人間は上表の試験器作成・限定試験・自己生成物回収を承認した。実行前の独立レビューで、最終Host比較の失敗が成功条件へ未接続、清掃例外による一次失敗上書き、未実施刺激の記録不足を検出した。全結果の統合・是正方針の照合後、試験private処理だけで三観点を是正した。一次のみ・清掃のみ・両方・Hostのみの四失敗形をDockerなしの一Caseで反証し、再レビューは両観点残指摘0。製品Source・公開API・永続Schemaは変更していない。

試験器: `40_Develop/docker-isolation/tests/integration/direct-mount-boundary.integration.test.ts`、SHA-256 `b13e8a47a32dfdef6be92c165ee708d97bb90b668c1a465f3b8cb3f07ded3ade`。整形・Lint・型検査成功。通常実行ではDocker部分一件をskipし、明示承認値を与えた一回だけ実Dockerを使用した。

| 観測 | 結果・主張できる範囲 |
|---|---|
| 実行 | 固定Image実IDのDirectory型一件。全実行約10.13秒、Docker部分約10.04秒。試験器局所一件Pass、実Docker一件Fail、exit1 |
| 正常対照 | 既存dirty相当の内容を読取り、同じHost fileの編集成功を確認 |
| 固定Path | `.git`／`.crdd`の元内容隠蔽、dummy秘密fileの隠蔽、書込み・rename・unlink拒否を含め、反例前の11項目がPass。任意Path・全Directの保証ではない |
| 最初の反例 | 合成`.git/config`を指すRW Tree内のhardlink別名から、覆った元fileのdummy内容を読取り可能。`hardlink-original-hidden=Fail`で即停止。固定Pathの隠蔽を別名にも適用できるという仮説を反証した |
| 未確認との区別 | この反例はGit管理情報への書込み成功や、秘密fileの別名読取り成功を実測したものではない。Git読取り自体は一律禁止の要求ではなく、読取り反例だけで採用済みの全安全条件が破られたとは断定しない。別名経由の書込み・秘密保護は未実証のまま |
| 未実施 | 後続symlink・大小文字別名・入れ子Gitの三刺激は先行FailによりNot Run。junction・親Directory差替え・起動後新秘密は今回未実装のNot Run。ポインタfile型の二件目もNot Run。追加試験・再試行なし |
| Host観測 | 元保護対象・親の列挙と実体・mask・Tree外sentinelは前後不変。通常Sourceの指定した合成変更以外を元成果と扱わない |
| 回収 | 同じ実ID・固定Image・所有labelを再確認して自己生成Container一件を回収。ID・名前・labelの不存在確認後、専用Rootをlink非追従で回収。追加読取りでも試験labelのContainer0・専用Root不存在を確認 |
| 失敗の保持 | 一次失敗=`protection-result`、Container清掃失敗なし、Root清掃失敗なし。最後のTest assertionは未到達の二件目を報告するが、一次反例は構造化結果に別保持。清掃成功で元Failを書き換えない |

結果は**最小Mount案の限定反証**であり、製品DIの既存完成判定、実Git、Provider認証、E2E、Direct全体のPass／Failへ機械的に換算しない。新規Network、Image取得／更新、外部AI、認証使用、Docker起動／再起動／修復、既存Dockerデータ削除、実Repository編集、Commit／Pushは行っていない。

次は、この読取り反例と要求上の書込み禁止・秘密保護を分け、既存のlink／実体検査の再利用で保証を限定できるかをSource読取りで評価する。新しい走査Framework・ACL・Registry・Lockや追加試験を自動で実装／実行しない。Directの本実装は未着手で、固定maskだけを保証成立として採用しない。

## 9. 開発情報と共通隔離方針の変更（2026-10-17）

人間は§8の実測後、開発情報のリスク受容と本番資格の分離によって、全秘密fileの隠蔽を要求しない方針を採用した。現在の正本は[Docker Isolation共通方針](../../../06_Architecture/Details/docker-isolation/01_Architecture.md#workspace-isolation-policy)であり、本節は判断と変更差分を追跡する。

| 人間が採用した内容 | 以前の案からの変更・実装への引渡し |
|---|---|
| ローカル開発用`.env`を許容しAIから読める可能性を受容 | 読取り自体を不合格・新Gateにしない。値がProviderへ送られ得るリスクもあり、送信されない保証はしない。CRDDのPrompt／logへの明示複製許可や公開情報化とは別 |
| 本番SecretはGit・通常開発環境へ置かずGitHub／GCP／AWS既存管理を利用 | 独自Secret Manager・Cloud Secret取得／注入を新設しない。実際の本番Secret移動・Cloud設定変更は今回行わない |
| 開発資格は本番権限なし・限定権限・有効期限あり | 既存資格管理の運用前提。具体値は環境側で設定・確認する。DIが自動判別・検証済みとは表示しない |
| Direct／Candidate共通Docker方針 | 作業対象・用途別RWは区別するが、隔離・認証・終了の安全原則を別実装へ分岐しない。Candidateへローカル`.env`を自動コピーしない |
| 独自Secret管理・file別ACL・動的Mount許可Frameworkを追加しない | 開発情報を隠すための個別mask拡張を進めない。Git／内部状態への書込み禁止等の必要境界は残し、既存機構での最小実装を評価する |

以前の合成試験のSource・Hash・元Fail・清掃結果は変更せず、当時の隠蔽仮説の反証として維持する。hardlink経由の読取りを新方針の失敗へ流用せず、Git書込み・Repository外書込み・認証保護等の未実証事項が解消したとも扱わない。開発用`.env`以外のProvider認証Home・Access Managementの鍵・本番資格の保護、既存の外部送信同意と情報分類を維持する。

今回の変更はArchitecture・Quality・変更計画の方針伝播であり、Source・設定・実資格・Cloud・Dockerは操作しない。既知秘密の検出器、候補投影、Provider制限の各Consumerを区分別に照合してからSourceへ進み、名称が`.env`というだけで本番資格を許容したり現防御を一律撤去したりしない。

## 10. 新方針と既存実装の差分・実装順序（2026-10-17）

人間は§9の方針で差分整理から実装へ進むことを指示した。変更分類は、既存の境界を保った実装詳細とWorkspace方式への責務移行。まず既存の共通部品を変更し、新しい管理機構を追加しない。今回の初回実装対象は下表のGit読取り二Adapterであり、Direct／Candidate全体の実装完了とはしない。

| 現物・責務 | 新方針との差分と処置 | 実装の順序・完了状態 |
|---|---|---|
| DI `execution/command-plan.ts` | 作業Rootの単一bindと用途別readOnlyを既に共用。`.env`別maskやDirect／Candidate別Secret管理は存在せず追加不要。Git／`.crdd`書込み等の新対象保護は未接続 | 共通Git読取り後、Workspace対象の借用と同じ切替単位で実装。現単一bindを安全成立としない |
| Coordinator `authority/secret-material-policy.ts` | Scope、Task Packet、Review、Bundle、明示Promptの各Consumerが共用。検出器の全削除は値の明示コピー防止まで解除するため行わない | Tree共有とCRDDの明示投影を分離して既存Consumerを切替。旧Task Scopeで`.env`を拒否する経路は現存し、新方式対応済みではない |
| `repository-operation/workspace.ts`／`candidate/bundle-store.ts` | 固定Tree複製・allowedPathsHash・内容投影・Bundle保存は旧方式。`.env`許容だけを理由に全体を緩和せず、Git成果への置換と一体で撤去 | VCのGit操作→Orchestrator Workspace／Task→Coordinator単発実行→Surfaceの順。必要成果・現在参照の移行後に旧Bundleを廃止 |
| VC `worktree-view-adapter.ts`／`local-change-set-adapter.ts` | 同じdiff／ls-files読取りに、外部textconv・fsmonitor・親Git環境注入・pathspec解釈のGapがあった | 初回実装。既定実行をprivate `git/read-command.ts`へ集約。既存2MiB／16MiB・30秒・結果形・Runner注入は維持 |
| VCのWorktree／Branch／固定Commit／Merge | 現worktree-viewは閲覧だけで、新Workspace管理APIではない | 読取りの後に実装。標準Gitを使い、独自Merge EngineやCommit Frameworkを追加しない |
| Provider Home／AM鍵／送信同意 | 開発用`.env`とは別区分。既存認証・認可と明示送信の検査は維持 | 今回変更なし。Cloud Secret取得・資格自動注入を追加しない |
| 開発資格の権限・期限 | GitHub／GCP／AWS等の既存管理側の設定。DIの値判定からは証明不能 | 運用確認の前提。独自Credential台帳やCloud SDK検査を新設しない |
| 保護対象の別名・link | 現inventoryにはsymlink拒否と実体比較があるが、新Direct全Treeのhardlink書込み禁止の実証ではない | 必要なGit／内部状態の書込み保証として既存機構を評価。開発情報の読取りだけを理由に新走査・監視・Lockを増やさない |

### 最初の実装の技術契約と確認結果

`git/read-command.ts`はPackage内部で二Adapterの既定spawnだけを共用する。公開API・Port・Registry・State・Lockを追加しない。diff／ls-filesだけを許可し、親`GIT_*`を大小文字にかかわらず除去する。Git管理領域と作業Treeを指定Rootへ固定し、pager・optional lock・fsmonitor・replace object・lazy fetch・対話認証を抑止する。diffは外部Diffとtextconvを明示無効化する。global／system Git設定を読取り時には使わず、Repository-local属性や改行設定は維持する。Git for Windows 2.54.0ではNodeのdevice Pathをconfigに指定すると拒否されたため、同環境の空configは`NUL`を使う。これは新しいOS層ではなくGit呼出しの設定値である。

仕様根拠は[Gitの起動・環境](https://git-scm.com/docs/git)と[Diffの変換抑止](https://git-scm.com/docs/git-diff)。照会は公開URLだけで内部Source・秘密・Repository情報を送信していない。command成功、marker0、index不変を組み合わせ、外部処理が発火する合成対照なしの試験を抑止成功にしない。

実Gitの合成対照では外部Diff・textconv・fsmonitorの発火を確認後、新経路でmarker0と元差分・index bytes不変を確認した。親Git環境・Repositoryのcore.worktree差替え、特殊Path、通常Root／linked worktree、staged／unstaged／untracked、空結果、非Repository拒否、出力超過を確認。起動失敗・期限・出力超過の既存理由と固定optionは実Gitとは別のProcess差替えCaseで確認した。

通常回帰の前にsandbox内ではMSYSの起動制限で発火対照が失敗したため、抑止成功へ換算せず通常実行環境で同じ局所試験を確認した。新局所2件成功後、Version Controlの整形・型検査・Lintと全49件が成功（18,873.2856ms、exit0、失敗・取消・skip0）。実Gitの試験一時Rootは`.crdd/tests/`へ限定し、既存のos.tmpdir利用Caseも当該ProcessのTEMP／TMP指定で同範囲へ閉じた。実RepositoryのGit更新、Docker・外部AI・Cloudは行っていない。これは二Adapterの局所改善であり、Status／Log・新Workspace管理・Direct全体の完成ではない。

固定候補レビューでは、clean／process filterが未処置、Symbol Manifest／中央Catalogの登録不足を検出した。全結果を統合し、設定を上書きして差分の意味を変えるのでなく、同Root・固定環境の標準Git設定名観測でfilterありのdiffを拒否する最小案を両確認者と照合した。設定なしはexit1かつstdout空・起動errorなしだけとし、存在・異常・不正出力は後続diff0へ閉じる。二要求の合計枠は従来30秒とし、Registry・State・Lockを追加しない。LFS等のfilter利用Repositoryの差分は未対応であり、非協調Hostによる二要求間の設定差替えの原子性も保証しない。

是正後はclean／processの実Git発火対照→新経路拒否・marker0と、設定不明／不正時diff0の局所を追加した。新局所3件、Version Control全50件が成功（19,941.977ms、exit0、失敗・取消・skip0）、整形・型検査・Lint成功。先行49件の結果は是正前の範囲として保持する。既存Symbol Manifestと中央Catalogへ新helper／Suiteを接続し、前回のDirect合成試験も登録不足だけを補正する。後者は本番Sourceを呼ばない調査用試験で、虚偽のverifiesを作らず、明示承認値なしではDockerを動かさない。試験本文・元Hash・Fail・清掃結果は変更しない。

是正固定候補の契約・品質再レビューは両者残指摘0。中央Catalog検査の指摘0、新Suiteが変更Sourceから選択されること、既存Catalog契約試験25件成功（11,993.9565ms）、差分空白検査成功を確認した。新規`git-read-*`試験Rootは残存0。ここまでを共通読取りの実装区切りとし、Workspace管理・Direct／Candidateの本番切替は後続へ明示して引き渡す。

### 次のGit Worktree管理への着手

人間の指示で前段を`e3e33ec0`へコミットした。プッシュは実施していない。次はVersion Control内の作成・観測・明示終了時のWorktree／専用Branch削除へ進む。着手前のArchitecture／Quality確認を統合し、[技術契約](../../../06_Architecture/Details/version-control/01_Architecture.md#git-worktree管理の実装契約)へ反映する。先行設計の「clean以外は除去拒否・Branch常時保持」は、人間が残存継続を指摘したため、以下の終了方針へ改訂した。Source実装前の見直しであり、旧設計の実装・試験成功は存在しない。

採用・取込済みでは成果保全と未取込残差の処置、不採用・破棄では対象と非使用を確認し、dirty・未追跡・ignoredを含む確定済み対象を削除する。不要なWorktree・専用Branchを残さず、必要な標準Gitのforce指定は明示破棄対象だけへ限定する。継続中・期限付き明示保留・実行中・対象不一致を区別する。Worktree削除とBranch削除の部分失敗は同対象・段階別に追跡し、全体成功にしない。Commit Objectの即時消去は要求しない。

新Registry・独自Lock・一般Recovery・自動Commit・Mergeは追加しない。実Git試験はRepository-localの合成領域だけを使い、Docker、認証情報、外部AI、Cloudを使用しない。Isolated技術APIの小文字UUIDと固定Branch／配置をWorkspace正本とVC詳細へ具体化し、上位UI・公開要求・Task保存Schemaの完成とは区別する。

### Git Worktree管理の部分実装と実Git試験

VCの`git/worktree-management.ts`に作成・観測・明示削除の三APIを実装し、Package Root公開、既存Symbol Manifest・中央CatalogとRFD-IT-029へ接続した。専用Refは期待HEAD付きの標準Git更新で削除し、WorktreeとRefの不存在を別に観測する。空のWorkspace Directoryは回収し、判断資料が残る場合は`workspaceDirectoryRetained`でOwnerへ返す。採否・非使用の利用調停と必要資料の処置は上位の責務であり、Git技術APIだけでWorkspace全体の終了を主張しない。

初回の合成実Git5件は、check-ignoreがliteral-pathspecs指定を受理しないためEffect前に失敗した。公開の固定相対Pathだけを扱う同commandからその指定を除き、再検証5件成功。追加境界を含む6件とPackage全56件成功（40,022.2145ms、失敗・取消・skip0）、整形・型検査・Lint成功。実Gitはdirty共有Tree非継承、linked起動、二Workspace、採用成果保全、不採用dirty／未追跡／ignored削除、lock／別HEAD／入れ子Git／祖先junction／Branch衝突拒否、hookとsmudgeの発火対照→非発火を確認した。作成実処理後のtimeout通知代役と、Worktree削除後のRef失敗代役から同対象へ再入場した。実時間timeout・上位Task・本番採否・Merge実装の実証にはしない。

中央Catalog検査指摘0、Catalog契約25件成功（8,863.8111ms）。独立確認で、公開dirtyは内訳ではなく有無、nullの意味はfield別であるという記述修正と、Base gitlink・ignoredだけ・削除直前dirty変化の個別Oracle不足を検出した。全結果と最小是正を両確認者へ照合し、処理を拡張せず文言と同Suite試験を補強した。上記56件は補強前の結果として保持する。補強後は実Gitを使う同Suite7件とPackage全57件成功（42,723.5284ms、失敗・取消・skip0）、整形・型検査・Lint成功、Catalog検査指摘0、差分空白検査成功。`worktree-management-*`の自己生成Rootは残存0。是正固定候補のArchitecture・Quality独立再レビューは両者残指摘0。RFD-IT-029全体はNot Run、本番Consumerは未接続であり、次はOrchestratorの上位処置へ接続する。

### Orchestrator接続の着手

人間の指示で前段を`9c462a2e`へコミットした（プッシュなし）。次段の着手前調査で、現在のSnapshotにはWorkspace集合がなく、同じRepository Rootを保存・実行・回復へ搬送していること、旧候補採用はBundle適用でGit取込の証拠ではないことを確認した。単純なVC呼出し追加・Root置換・採用成功からの即削除は行わない。

両専門観点を統合し、[Orchestrator詳細の対応表](../../../06_Architecture/Details/orchestrator/02_Detailed_Design.md#workspace接続の実装順序と移管先)とQA-000003の上位結合条件へ反映する。まず既存state内の保存・遷移とVC接続、次に受付・Task搬送と保存Root／実行Tree分離を同じ実行切替で閉じる。採用後の片付けは後続の実Git取込確認と一体で完成させ、①だけで全終了能力を完成としない。新しい台帳・Lock・互換Readerは追加しない。現在は設計具体化までで、この段階のSource実装・実データ変更は未着手。

### Orchestratorの実装・限定結合結果（2026-10-17）

既存Snapshotを厳密なv3へ更新し、Workspace現在集合とQueue参照を同じstate.jsonへ接続した。既存project-operation Lease内で意図保存→VC→結果保存を行い、短期保存LockをGit処理中に保持しない。作成・観測・期限付き保留・明示破棄を公開し、Task終端からの自動削除は行わない。Dispatcherへ所属保存Rootと選択実行Treeを分けて搬送した。新Registry・Lock・互換Readerは追加していない。本Repositoryの実運用状態は移行・削除していない。

独立レビューの3指摘（作成途中の条件再照合不足、既終端Queue結果の取消化、委譲前拒否の外部実行不明扱い）を両確認者と照合して是正した。作成中だけ固定Base／期待HEAD・clean・非locked／prunableを再確認し、拒否時は同UUID意図を保持する。参照解放と既存結果を分離し、未委譲の拒否では回復ID・Process破棄を発行しない。是正固定候補の契約・品質再レビューは両者指摘0。履歴は既存の分類要約を使い、実行ごとのEvidence書庫を新設しない。

Node v24.19.0／Windowsの実Git・既存排他で、Orchestratorの整形・型検査・Lint、UT73件とIT24件が成功（IT 140,988.079ms、失敗・取消・skip0）。新Suite6件は複数Task継続、実保存、別Process競合・同UUID再入場、Git作成後の結果保存用open失敗、Worktree除去後のRef失敗、保留・別HEAD・欠測・Reader拒否を確認した。prunable刺激はDirectory欠測との結合例で、単独条件の全変異網羅ではない。初回の試験準備不足、Worker起動引数・Windowsの削除対象CWD、およびQueueのintegration_pendingをcompletedと誤期待した失敗は試験側で是正して再検証した。通常回帰の制限環境で待機した今回の試験Processは停止し、実環境プロファイルで確認した。

隣接する保存基盤は全51件中48成功・旧版比較3失敗を保持し、試験側の版2比較だけを版3へ更新後に該当3件が成功（16,653.0566ms）。単一run全件成功とはしない。判断回復・履歴・採用記録の隣接18件も成功（25,430.549ms）。Coordinator型検査、中央Catalog検査指摘0、Catalog契約25件成功、差分空白検査成功。旧形式fixtureは現形式へ更新し、歴史的Evidenceは変更していない。

これはOrchestrator内の保存・VC・Task搬送までの限定成立である。実Coordinatorは新対象未接続をEffect前に拒否し、採用申告も実Git取込未接続として拒否する。実Provider、公開Surface、採用・Merge、未解決配送／回復を含む全体評価、実データ移行と利用者受入は後続。QA全体のNot Runを解除せず、Docker・外部AI・Cloud・本体Gitへの実処置は行っていない。

最終結果搬送の確認では、既存Storeの回復参照を保存拒否・再読取り拒否から返却へ保持し、Lease解放の二次失敗で一次参照を上書きしないよう補正した。解放側の別参照はreleaseRecoveryIdへ分離し、新Stateや回復機構を追加しない。補正後の静的3軸、実保存失敗の結合1件（21,211.7158ms）、本番関数本文に有限代役を接続した二重失敗合成1件が成功。後者は実保存／実Leaseの根拠ではない。上記全回帰はこの返却補正前、新Suiteは現在7件であり、全回帰時の6件と追加1件を区別する。

### Coordinator実行接続の着手と現在の停止点

人間の指示でOrchestrator接続までを`135e032c`へコミットした（プッシュなし）。次工程は既存方針内の実装詳細・複数Package結合変更であり、Coordinator／Orchestrator／DIと関連QAを対象とする。着手前に契約・品質の読み取り確認を行い、両観点からRoot搬送だけでは旧複製・Bundle・清掃の所有境界を置換できないことを確認した。[切替順序](../../../06_Architecture/Details/coordinator/01_Architecture.md#workspace実行接続の切替契約2026-10-17)へ集約する。完成時は技術・品質の独立レビュー、文書・不足影響の限定照合を行う。標準準拠条件・リリース判断を変えないため準拠監査や全リリースE2Eを機械的に追加しない。

現在の技術停止条件は、単一RW bindではGit／内部状態の書込み禁止が成立しない点である。新RW経路・旧Bundle撤去はまだ実装しない。既存の固定ImageとContainer稼働状況を読む照会は、実行環境の承認審査でDocker操作未承認として拒否され、発行していない。迂回や別経路の実行は行わない。現在のImage所在とEngine状態は未観測である。

次の人間判断は、既存試験の後継としての限定Mount書込み試験の許可だけである。期待Imageは過去と同じ`sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`、不存在・Engine停止時は取得／起動せず停止する。新しい専用Root `.crdd/tests/workspace-write-boundary/`内に無害な合成Tree・mask・sentinelだけを作り、Directory型とポインタfile型を各一件、同時一件・最大二Container・各60秒で確認する。networkなし、非root、read-only root、cap-drop ALL、no-new-privileges、pull禁止。Source書込みを正対照とし、Git／内部状態の書込み・rename・unlink・別名経路とTree外sentinelを観測する。開発用dummy.envの読取りは許容し、秘密隠蔽を合否条件にしない。

試験器は既存DIの試験所有領域内に置き、通常回帰ではDockerを動かさない。失敗は一回で停止し、今回の実ID・構成・labelを再確認できた資源と専用Rootだけを回収・不存在確認する。回収不明では同対象を保持して報告する。既存Container／Image／Volume、認証情報、実Repository本文、Docker再起動／修復、外部AIには触れない。これは技術境界の実証であり、Provider・Coordinator全体・採用Git統合の成功ではない。

### 固定Path書込み境界の承認済み限定結果（2026-10-17）

人間は上記二構成と事前読取りを明示承認し、成功してもSecret完全隠蔽・あらゆるlink経路・任意Repositoryの保証へ拡張しないこと、失敗時は新ACL／Mount管理／Recoveryを追加しないことを指定した。EngineのLinux応答と固定Image実ID・Linux／amd64・稼働Container0を確認した。初回のImage表示形式は不存在のVolumes欄で解析エラーになり、存在確認用の表示項目だけへ絞って正常確認した。Image取得・更新・Docker起動はしていない。

既存試験器`40_Develop/docker-isolation/tests/integration/direct-mount-boundary.integration.test.ts`を今回の限定目的へ更新した。過去の試験本文はGit基準`135e032c`、当時の結果・Hashは本記録の先行節に保持する。実行版SHA-256は`a0de5d10104aaf69c42782ca097add82cbf75e1092605fda52965c9e4bb41cce`。独立レビューの回収前構成照合不足を是正し、元ID・名前・Image・label・User・NetworkMode・root read-only・Capabilities・SecurityOpt・Mount集合を初回と回収前の同じprivate照合で確認した。構成差の局所代役で削除要求0・清掃失敗保持を確認し、両再レビューは指摘0。製品Source・公開API・保存Schemaは変更していない。

| 実測対象 | 結果・限界 |
|---|---|
| Directory型 `.git` | 通常Sourceの既存内容読取り・同file書込みとdummy.env読取りが成功。固定PathへのGit／内部状態書込み・追加・rename・unlinkは拒否 |
| ポインタfile型 `.git` | 同じ固定構成で上記観測が成功。実Git Worktreeや共有Git操作の実証ではない |
| 構成 | `/work`はRW、`.git`は型に合う空placeholderをRO bind、`.crdd`は空DirectoryをRO bind。dummy.envのmaskなし。network none・非root・root read-only・cap-drop ALL・no-new-privileges |
| Hostと回収 | 保護対象・mask・Tree外sentinelの内容と実体は不変。通常Sourceの指定変更だけを確認。自己生成Container二件を逐次実ID・元構成で回収し、ID・名前・labelの不存在と専用Root削除を確認。追加読取りでも専用label0・Root不存在 |
| 対象外 | Secret完全隠蔽、hardlink／symlink・大小文字別名・入れ子Git・junction・親差替え、任意Repositoryへの適用。試験出力のNot Runは今回の対象外を表し、本番実装の追加義務やPassとして扱わない |

Node v24.19.0／Docker Desktopの現在環境で、限定Docker Caseは12,216.9375ms、試験全体は12,310.4478ms、通常局所二件と実Docker一件の計3件成功（exit0、失敗・取消・skip0）。固定Pathの観測は二構成各11項目で、全体保護の網羅数ではない。新規Network、認証、外部AI、Docker再起動・修復、既存資源変更は行っていない。実行別ログ書庫は増やさず、この要約と再実行可能な試験Sourceへ接続する。

推奨は、この三MountをDirect／Isolatedの共通構成候補とすること。固定Pathの最小境界は実測できたが、借用Treeの本番接続、link等の適用前提、生成・存在しない保護Pathの扱い、実Provider・取消・回収・次Taskは未成立である。構成の本番採用とCoordinator接続は次の判断・実装へ分け、今回成功だけで未接続拒否を解除しない。

### Coordinatorの借用実行接続（2026-10-17、実装・結合確認中）

人間は三本構成の採用とCoordinator接続を指示した。所属Rootを認可・保存・回復・配送に使い、実行TreeだけをProviderへ渡す。短命なOperation結合を追加し、永続台帳・Lock・回復Frameworkは追加しない。旧Bundle準備・保存・出版は借用入口で呼ばず、既存差分照合とReviewerだけを再利用する。TreeとBranchはOrchestrator／VCの所有のまま保持し、Task終了・失敗・取消で削除・resetしない。

| 確認断面 | 現在の根拠と限界 |
|---|---|
| 実Tree | 自己生成GitのDirect／Isolatedを二Task継続し、開始dirtyを今回差分へ含めず、内部状態を除外、Source・Git・Branchを清掃後も保持する。上位AdapterとProvider構成への所属Root／実行Tree搬送も確認する |
| Task調整 | 有限代役で通常二役割・一回是正・初回／是正後の範囲外変更停止・取消と既存清掃を確認する。実AIの実行証拠ではない |
| Docker構成 | 三本Mountの計画、Source RW／Reviewer RO、固定保護二本RO、回収観測の欠落・余剰・RW・Source差拒否を確認する。既存の限定実Docker結果を超える保証はしない |
| 利用側 | Orchestratorの全UT73とIT25が成功。実Providerを使う新方式E2E、採用・Git統合、公開Surface・利用者確認、実データ移行は別の残件 |

借用走査は既存上限20,000 file・全体256MiB・単一64MiBを維持する。link・複数hardlink・入れ子Git・上限超過は実行前拒否する。任意Treeへの適用可能性を追加主張せず、この制約を解くための新しい監視・ACL等も追加しない。変更Pathの帰属は未確定とし、欠測を変更なし／Tree現存へ丸めない。固定候補の独立レビューと必要な是正後に、本接続範囲の完了を判定する。

固定候補W1の二必須独立レビューは、即時回収の保護期待値搬送、上位変更metadata搬送、清掃失敗時の最終投影迂回の三点を検出した。統合是正案を両確認者へ返し、整合確認後に既存経路内で修正した。DIはProvider用途だけ元二Sourceを即時照合へ渡す。Coordinatorは早期失敗を含む全終端の後で観測し、TaskAttemptからOrchestratorのTask／Attempt／Operation対応結果へ同じ閉metadataを搬送する。一次理由・exact回復参照・清掃結果は不変で、新State／Store／回復機構は追加していない。

是正候補の関連Coordinator ITは210件成功。DIの即時回収本体を通す有限Transport試験は14件成功し、正常五Mountだけ回収、保護欠落／RW化／Source差ではrm0を確認した。上位DispatcherのDirect正常／途中失敗とIsolatedの局所二件も成功した。実Gitでの開始基準→無変更／変更あり／欠測の観測を、実TaskAttemptから上位単発結果へ搬送する確認を含む。全Checkerは既知error3,342・warning0、今回変更5Markdown Pathの指摘0であり、全体Passではない。再レビューと最終回帰は別に記録する。

### 借用実行接続の実装・結合確認の区切り

W2で検出したProducer／受領側の変更Path件数不一致は、既存上限1,000件を超えた一覧をnullへ投影する限定是正とした。実Gitで1,000／1,001件を作り、実TaskAttemptを通して元blocked理由・exact回復ID・清掃未確認・手動回復／Process再起動判定が保持されることを確認した。切詰め・上限緩和・新しい保存状態は追加していない。

W3の二必須独立再レビューはともに指摘0。確認した最終SourceのSHA-256は`repository-operation/workspace.ts`が`89847b4ce49b7445be4995c80a54da211fdac5c4cb6055cc05becf7782a54248`、対応実Git試験が`335975862b8e2eb7e32745c70f1c07d5dd1e8efd4caa7124b2eacbfee81cc2d1`。実行別Evidence書庫は増やさず、再実行可能なSourceと本要約で追跡する。

| 最終確認範囲 | 結果 |
|---|---|
| Coordinator関連結合 | 210成功、失敗・取消・skip0。実Gitの二方式・二Task、実Adapterの結果搬送、是正・取消・Host保存拒否、1,000／1,001件境界を含む |
| Provider計画・保存・実行／回復Ownerの既存回帰 | 140成功。実Docker・外部AIは含めない |
| Docker Isolation通常回帰 | 342成功・失敗0・明示Docker試験1skip。前の承認済み実Docker限定結果とは別run |
| Orchestrator | UT73成功、最終IT26成功。途中の公開API一覧試験1失敗は新snapshot APIへの期待一覧未追従で、更新後に全ITを再実行して成功 |
| 静的・追跡 | 関連3Packageのcheck成功、Runtime／Orchestrator Trace検査accepted、diff-check成功 |
| 清掃 | 今回の`borrowed-workspace-*`／`orchestrator-workspace-*`自己生成Root残存なし |

今回依頼されたCoordinator借用実行への実装・結合確認は上記限定範囲で完了。新永続Registry・State・Lock・回復Framework、実AI依頼、追加Docker再起動は行っていない。実Providerの新方式E2E、公開Surface・利用者確認、採用／Git統合、実データ移行、旧方式の全面撤去およびv0.22全体の完成は未完了のまま区別する。コミット・プッシュは本作業では実施していない。

## 採用・Git統合への着手整理

借用実行接続までの37ファイルを`1fd3129a`へコミットし、cleanを確認した。プッシュは未実施。人間の次段階指示は、Workspace方式の採用・Git統合への接続である。2026-10-18に明示選択による候補固定と別操作の採用を承認し、Fast-forward優先案を変更して新規統合は原則`--no-ff`の二親Mergeとした。承認は製品実装に対するもので、本RepositoryのBranch取込み・main統合を行う指示ではない。

### 保持する能力と移管先

| 現在の能力・不足 | 次段階の処置 |
|---|---|
| 旧`candidate/adopt.ts`の明示採用・現在Revision／Scope再照合・Lease・Receipt・解放 | Orchestratorに維持。固定Git成果と取込先へ結合する。候補生成・送信同意から採用権限を推定しない |
| 旧`candidate/integrate.ts`／`integration-adapter.ts`のBundle適用 | Git Mergeの成功証拠として流用しない。新経路の同等能力成立まで旧ConsumerとSourceは残す |
| VCのWorktree作成・観測・除去 | 登録・実体・専用Branch・期待HEADの再照合を維持し、採用確認後の既存disposeへ接続する |
| VCの`change-publication`の選択準備・Commit | 存在するが通常index全体のCommitであり、確認したWorkspace差分の固定へそのまま流用しない。Commit生成の技術OwnerはVCのまま |
| `git/commit-tree.ts` | Git Object／Treeの読取りでありCommit生成APIではない。名前から既存生成能力を推定しない |
| Orchestratorの`adopted`入口 | 現在は未接続拒否。採用申告だけでTreeを消すように解除せず、取込済み成果・記録・非使用・残差処置の成立後に接続する |

### 採用した操作・実装順

1. **候補固定**: 人間が確認したPathと内容だけを明示指定。Orchestratorは既存操作Leaseと現在Workspace記録で利用を調停し、VCがCandidate BranchへCommitを発行する。Base Commitと対象Commit、選択内容の一致と親関係を検証し、Workspace HEADに含まれる未選択の過去Commitを暗黙採用しない。未追跡は選択されたものだけ。ignored・開発`.env`の自動追加、無関係な既存staged内容の混入、Task終端だけの自動Commitは行わない。固定後の差分を人間が確認できるようにする。
2. **取込前評価**: 固定候補Commit、取込先Branch・期待HEAD、変更範囲、未レビュー差分を示す。VCがGit標準の3-way計算でclean／conflict／unknownを返し、評価だけでWorktree・Branchを更新しない。Git Object生成の可能性は評価の副作用として扱う。
3. **明示採用・取込**: 人間が固定Commitと取込先を確認した後、Orchestratorが現在認可・非使用・期待Revisionとdirty、候補の範囲を再照合し、VCがGit標準の`merge --no-ff`を実行する。Fast-forward可能時も新規統合はMerge Commitを作り、第1親＝確認した取込先HEAD、第2親＝Candidate Commitの完全一致を読戻す。既取込では新しいMergeを発行しない。Conflictは停止し、Squash／Rebase／Cherry-pick・独自Merge Engineは追加しない。
4. **結果確定・再入場**: 元操作・候補Commit・取込先・取込後HEADを既存Workspace現在値／採用記録へ結合する。Git成功後の保存失敗を未実施へ戻さず、同じ対象を再観測して二重Commit／Mergeを防ぐ。一次失敗・記録失敗・Lease解放失敗を分ける。新Store・Lock・一般Recoveryは作らない。
5. **採用後の終了**: 取込先の成果と採用記録、非使用、未取込残差の処置を確認してから、既存disposeで不要な専用Worktree／Branchを回収する。Merge後の影響分析は通常Taskへ接続し、分析失敗でも自動Rollbackしない。

取込先dirtyの既存判断は維持する。衝突する未Commit・staged・未追跡変更、Gitが安全に保持できない構成、観測不能では停止する。非衝突dirtyまで一律に拒否する変更は今回採用していない。自動Stash／Reset／Clean／Rollback、利用者変更のCommit混入は行わない。Directは既に現在Treeを編集しているためIsolatedの採用Mergeを適用せず、既存の明示Git公開操作を別責務として維持する。

### 変更経路・検証・停止条件

| 観点 | 着手時の処置 |
|---|---|
| 分類・正本 | 採用済みWorkspace目標の実装追加と旧方式からの責務移管。Orchestrator／VC詳細・QA000005／007・既存利用側を照合する |
| 着手前照合 | 親の現物確認と契約／Qualityの二読取り専用確認を実施。Commit生成とGit Mergeは未実装、通常index Commit・旧Bundle Receiptは代用不能と確認 |
| 正常・非発火 | 固定済みIsolatedを明示採用して取込む。Task終了・Direct編集・非採用ではMerge／自動Commitを発行しない |
| 境界・不足 | HEAD差・確認後の変更・既存stage混入・dirty衝突・Git応答喪失・記録失敗では、未実施／実施済み／不明を分けて同対象へ戻す |
| 検証 | 実Gitの固定・取込・衝突拒否・元index／dirty保全、Git成功→保存失敗→別Process再入場、採用後のWorktree／Branch回収。外部AI・Remote Pushは使わない |
| 必須レビュー | 契約・技術とQualityの独立レビュー、関連文書／リンク確認、Workspace→VC→採用記録→利用側の限定Gap／Impact確認 |
| 実施しない主な監査 | CRDD準拠基準・安定ID・リリース判断は変えないため準拠監査／リリース監査は発火させない。工程横断の全面再設計はしない |
| 人間判断・停止 | 明示選択による独立固定と別採用、二親Mergeは2026-10-18採用済み。今回許可されたGit／Filesystem意味で保証できなければ追加機構の前に不足・代替を提示する。現在追加の採否質問はない |

### 表示名と履歴の追加条件（2026-10-18）

以下のSource不足・未実施は設計着手前の観測である。実装後の現在結果は次節へ集約する。

Workspace名は継続作業、Candidate名は固定成果を説明する任意の表示値とする。現SourceのWorkspace記録はUUIDのみで、表示名・固定Candidate・Merge段階の保存型はまだない。既存記録・codec・Reader・利用側・試験を同じ切替単位で更新し、新Registryは作らない。候補固定時の両表示名を保持し、後の改名を過去の固定情報へ遡及させない。省略時はUUID／Commitを表示する。Merge Messageの内容と名前の入力制約は[Workspace詳細の採用方針](../../../06_Architecture/Details/orchestrator/03_Workspace.md#採用git統合の採用方針2026-10-18実装未完了)を正本とする。

着手前の読取り専用技術確認では、Git標準機能で成立する方向だが、`--no-ff`だけでは過去Commit混入を防げないこと、既取込では二親Commitを新規生成しないこと、通常index全体のCommitは代用できないことを確認した。候補固定・Git統合・命名搬送の実装／実Git試験は未実施。今回の文書更新を能力完成やQuality Passとしない。

設計の二必須独立確認では、Candidate Branchの寿命がWorkspace Branchと未分離という指摘一件を得た。全結果を統合し、両確認者と是正案の整合を確認してから、Ref＋期待Commitを既存記録へ結合し、必要参照・保持・非使用を確認後に独立回収する条件と実Gitの反証を追加した。既取込判定は固定Candidateの祖先関係に限定し、同Tree／Messageや観測不能を代用しない。新しい管理機構は追加しない。

### 採用・Git統合のSource接続と実Git確認

2026-10-18の指示に従い、VCの固定・取込・Ref回収と、Orchestratorの既存Snapshot／操作Lease／正本採用Lease／不変結果Portを接続した。表示名はUUIDと分離し、同候補の固定時名を維持する。実行別Evidence書庫・新Registry・新Lock・一般Recoveryは追加しない。既存Stage・未選択変更をCandidateへ含めず、Directの通常TreeをMerge対象へ自動変換しない。

独立確認W1では、再入場のTree未照合、未固定拒否候補の終了不能、途中改名による再入場不一致、Object書込みEffectの未計数、未完了MergeのCommit継続不足を検出した。両確認者へ統合是正案を提示し、合意後に共用入力検査・未固定Ref不存在確認・保存済み名／Commitの再利用・期待Tree再計算・未完了Commitだけの継続・stickyな要求発行記録を実装した。一次失敗は候補記録と既存採否結果へ保持する。保存codecは正当な前段結果を持つ途中意図と、矛盾した成功を区別する。

通常制限下の先行試験ではGit補助Shellとlink作成がOSに拒否され、11件中2件が環境制限で失敗した。通常環境の同fixture再試験は11件成功。別Process試験の`--input-type=module`が既存Workerへ継承される起動拒否は、通常入口と同じ`-e`へ修正した。製品の排他・Recoveryは緩和していない。これらは当時の失敗として保持し、最終Sourceの結果と混同しない。

W2／W3の独立確認では、一時index回収失敗の参照欠落、複数MERGE_HEADを先頭OIDで誤認する可能性、採否又は回収終端保存後に本文が変わって再入場できない問題を検出した。両確認者と統合案を照合し、既存候補結果に限定Path・実体照合値又は実体不明を保持、Git管理fileの単一親確認、採否・回収失敗・不変終端本文の分離を行った。終端保存済みでもfreshなRef・一時物不存在を確認する。新Store・Lock・探索削除・一般Recoveryは追加していない。

追加反証の一回は試験側の別Processへの故障代役がESMのnamed importへ反映されず失敗した。`syncBuiltinESMExports`で実際の要求へ故障が入ることを接続し、終端保存→現在解除保存拒否→別ProcessのRef観測拒否→別Process成功を再確認した。製品側の安全条件を緩和せず、試験器失敗と製品是正を分ける。

W4の技術・Qualityの独立再レビューは両者とも残指摘0。最終Source／試験入力は基準Commit `1fd3129a06d843362f2437941a526348647d92a6`に対する作業差分とし、次の8ファイルの昇順`Path=SHA-256`をLF結合したSHA-256は`71e33d79035420c705412f232efe077fdd6d136a682791989bc8db38fbd88c3d`である。VCの`src/index.ts`・`src/git/worktree-management.ts`・`src/git/workspace-candidate.ts`、Orchestratorの`src/workspace/record.ts`・`src/workspace/operations.ts`、VCの`tests/integration/consumer-closure.integration.test.ts`・`worktree-management.integration.test.ts`、Orchestratorの`tests/integration/workspace-lifecycle.integration.test.ts`を対象とする。環境はWindows、Node.js v24.19.0、Git 2.54.0.windows.1。試験用の実Git・Native排他は通常環境で実行し、生成先はRepository-local `.crdd/tests/`のみとした。

最終全回帰・文書照合・生成物回収の結果を下表へ確定する。公開Workbench／MCP操作、実Provider E2E、実データ移行、旧Bundle全面撤去、v0.22全体完成・最終統合・リリースはこの作業の完成主張に含めない。今回のSource／通信契約の追加を、実Repositoryの旧状態移行済みとは扱わない。

| 2026-10-18の最終確認範囲 | 結果 |
|---|---|
| 静的確認 | VC／OrchestratorともFormatter・型・Lint成功。Orchestrator試験の既存style info 2件は残り、warning／errorではない |
| Version Control全回帰 | 64件成功、失敗・取消・skip 0。合成Repositoryの実Gitで選択固定、二親Merge、競合停止、元index／dirty保全、一時物回収、既取込、複数MERGE_HEAD拒否を確認 |
| Orchestrator全回帰 | UT 73件、IT 33件成功、失敗・取消・skip 0。実Git・実Snapshot・既存Native排他・別Processで、名前固定、現在認可、保存失敗後の二重Merge防止、採否と回収終端の不変再利用を確認 |
| 設計トレース | Runtime／Orchestratorの両Checkerが`accepted` |
| 独立確認 | 技術・QualityのW4再レビューは残指摘0。限定Gap／Impactも追加0。文書監査の旧時制2箇所を内部実装済み／公開全体未完了へ同期し、現在投影・最終結果記録を含む再照合も指摘0 |
| 文書Checker | 変更した6 Markdown Pathの個別指摘0。指定scopeと関連標準検査を含むrun全体はerror 1,070／warning 0のためFailであり、Repository全体の文書合格は主張しない。既存の全体是正を今回の部分成功で代替しない |
| 未実施 | 実Provider依頼、Docker操作、Workbench／MCPの新操作公開、人間UAT、実データ移行、旧Bundle全面撤去。本Repository本体の候補採用・Merge・Push・Releaseは行っていない |

最終run終了後、自己生成した`worktree-management-*`／`orchestrator-workspace-*`の試験Rootは0件で、全fixtureの回収を確認した。差分の空白検査も成功。今回の変更は未コミットであり、人間が操作したステージ状態を維持する。

### 公開入口への接続着手（2026-10-18）

人間の指示により上記17ファイルを`5038b6bd`へコミットし、作業Treeがcleanであることを確認した。Push・main統合は行っていない。前節の未コミット表示はこのコミット前の結果記録である。次はWorkbench／MCPの公開入口接続を同じCHGで進める。

変更分類は、採用済みWorkspace方式の公開入力・現在認可・表示と本番Consumerへの接続である。既存の人間判断・Git所有・隔離・保存・回復境界は変更しない。着手前に契約／技術とQuality／利用側の二つの読取り専用確認を行った。独立完成レビューとは区別する。実装・関連文書・限定Gap／Impact・実公開入口の回帰を必要とし、準拠基準・Releaseの変更はないため準拠／Release監査は追加しない。

| 接続対象・現在の不足 | 予定処置 |
|---|---|
| Orchestrator内部APIはRoot／Bindingと関数を直接受ける | 公開入力はRepository／Project／Queue／WorkspaceのIDと操作固有値へ限定する。Root・保存Binding・認可関数はServer構成が解決する。現在値・状態・固定Commit・失敗／回復参照の公開投影をOwnerへ接続し、内部記録全体を返さない |
| 明示選択に必要な変更一覧・file内容／差分・Blob確認値 | 既存VC読取りを優先利用し、Base・現在内容・選択Pathを相関した観測を返す。切詰め・欠測・binaryを正常全文へ丸めず、再観測で変更した選択は固定しない。新Candidate Storeを作らない |
| Workspaceの一覧／状態、作成、改名、保留、明示終了 | 同じOrchestratorの既存現在値・操作へ両Surfaceから直接接続する。内容範囲の旧workspaceIdsをGit Workspace UUIDへ流用せず、既存Queue所属・期待HEAD・非使用を確認する |
| 選択WorkspaceでのTask、取消・結果 | 公開依頼から対象Workspaceを既存Taskへ搬送する。Directは既存Tree、Isolatedは検証した専用Treeとし、起動Rootへのfallback・自動Commit・自動採用を行わない |
| Candidateの固定・採用・終了 | 固定と採用を別操作にし、確認したBase・選択内容・固定Commit・取込先を搬送する。外部の採用済み申告やreferencesReleasedのBooleanだけで内部条件を成立させず、既存状態・利用・保持と現在認可へ対応させる |
| 通常MCP配布Launcher | 現行三ToolのOrchestrator構成と混同せず、新入力／一覧／dispatchを公開入口まで接続する |
| CROS HTTPのcreateAccessMcpResolver | 現在は内容・活動等だけを構成する。新Adapterの単体追加で完了せず、要求毎のAM認証・現在許可・Repository所属から新操作を構成する |
| WorkbenchのcandidateActions／candidate/action | 旧Coordinator Bundle経路を新Git候補の採用証拠へ流用しない。既存Project／作業・候補表示へWorkspace選択→変更確認→固定→固定成果確認→別採用／終了の導線を具体化する。既存Visual Baselineを維持し、UI／SPEC Detailと検証へ反映する |

実装順は、共通Ownerの公開入力・読取り投影、MCP Adapterと通常／CROS Launcher、Workbenchの現在認可・HTTP・CSR表示、実Git＋実Writerを使う両公開入口の結合／System確認、独立レビュー・文書／Gap照合・生成物回収とする。WorkbenchをMCP Clientへ変更せず、第三Gateway・新Registry・Lock・承認Framework・一般Recoveryは作らない。実AI・Docker・既存データ移行は本段階の内部試験から暗黙実行しない。

人間がFront AIへ対象・内容・操作を明示指示してMCPが代行することは既存契約で成立する。Serverが人間由来を技術的に証明する追加要件は採用していない。認証済みPrincipalや確認Booleanを人間判断の証明にせず、Front AIはTask完了・候補生成から固定／採用／破棄を自動発行しない。既存submit_decision／adoptResultを新Git採用の許可へ転用しない。

**実装前の判断待ち:** 共有CROSで新しいGit書込み操作を誰へ許可するか。現在のAMはRoleごとの管理分担とdevelopment／managementの内容利用範囲を所有するが、新Workspaceの作成・固定・採用・破棄の操作許可は未確定である。旧閲覧許可から新操作許可を自動発行しないというQA-000007の条件を維持する。推奨案は、三Roleいずれも当該Repositoryのdevelopment利用範囲が現在許可されていればこれらの明示操作を利用可能、management範囲だけの場合は利用不可とし、Roleごとの新しい設定スイッチは増やさないこと。Repository単体利用は既存の資格不要・固定Root境界を維持する。この案は提案であり、Sourceへの認可実装は判断後に行う。

2026-10-18に人間が上記操作権限案を採用し、両公開入口の実装・結合試験を指示した。判断待ちは解消。既存AMの現在`development`許可を明示的に新操作へ適用する承認であり、Role管理権限・旧内容閲覧からの暗黙拡張ではない。二つの着手前確認もこの決定との整合を確認した。発火例はdevelopment許可＋現在対象一致、非発火例はmanagementのみ／失効／別Repository、境界例は確認後の内容・HEAD・権限変更、情報不足例はRoot／状態／認可観測不能とし、後三者で新Effectを許可しない。公開入力はRootや認可関数を含めず、選択fileの相対Path・mode・Blob確認値は操作固有値として受け付ける。

### 公開Workspace管理の実装・結合結果（2026-10-18）

基準は`5038b6bd`。新しい管理台帳・排他・一般Recovery・Secret Managerを追加せず、既存OrchestratorのWriterとLease、VCの標準Gitへ接続した。WorkbenchはMCPを呼ばない。通常固定Repositoryは資格不要、共有接続は三Roleとも現在の対象`development`許可を要求する。

| 対象 | 実装・観測した範囲 |
|---|---|
| 共通Owner | `workspace/commands.ts`が操作別の閉入力、所属、期待世代、現在認可と非秘密投影を所有する。Root・callback・参照解放済みの自己申告はwireに含めない |
| MCP | `crdd.get_workspace`／`crdd.manage_workspace`の二Tool。通常stdio Launcher、共有HTTP Resolverまで接続し、同じOwnerを呼ぶ |
| Workbench | 同Origin `POST /workspace/action`とCSR Panel。一覧・作成・選択・改名・保持、file確認・固定、固定差分・別採用・終了を分ける。旧Bundleのcandidate/actionは流用しない |
| 実Git／保存 | 確認したfileのBlobを固定し、Task完了だけでは採用しない。固定後のTree変更が固定差分へ混入しないこと、二親Merge、RefとWorktreeの回収を実Git・実Writerで確認 |
| 故障後 | WorkbenchのMerge結果をGit・保存後のHTTP終了位置で切断し、MCPの同ID読取りからmerged／同Merge Commitを再取得、HEAD不変と正式終了・回収を確認。汎用の発行後取消完了や全故障枝の実証ではない |
| 秘密境界 | raw本文・patch元値とhunk本文を既存判定へ接続。合成の固定形式、先頭／2行目の名前付き秘密、削除行・固定差分を両HTTPで非出力拒否。通常Sourceは表示し、`.env`一律禁止や未知秘密不存在保証は追加しない |
| Browser | 本番Bundle・専用Chromeで作成の二重送信抑止、応答破損の非再送と再取得、終了を確認。別Workspace ID、不正changedPaths／statusの正常形JSONも表示へ採用しない。最新P3是正後の非空合成一覧保持を含む再実行も3件成功（62,546ms）。合成一覧はUI故障反例であり、実Git差分の成立と区別する |
| 表示 | 新Panelを含む既存3 RouteのPC／Tablet／Mobileと100／200／400%の27測定が成功。人間による導線・Tasteの採用確認は別である |

技術とQualityの二必須独立レビューを固定候補へ実施し、raw秘密検査、候補BaseとWorkspace Baseの区別、不正応答の全検査後反映を是正した。元の2レビューが終了する前にSource是正せず、統合案の両者整合後に更新した。残る変更一覧反映順のP3も同じ手順で限定是正・再レビューし、Source上の残指摘は両者0。最終実行結果は次表へ同期する。

| 検証 | 現在結果・限界 |
|---|---|
| 静的検査・Build | VC／Orchestrator／MCP／Workbenchの型検査・適用範囲の整形／Lint成功。Browser Bundle生成成功。TSXは既存Biome対象外のため、当該新Panelを同Formatterのstdin指定で個別整形した |
| VC回帰 | 全64件成功 |
| Orchestrator | UT73件成功。IT全34件の初回は32成功、公開Export集合と保存故障代役のQueue前提の2件を是正し、対象再実行は成功。修正後全34件の一括再実行結果とは区別する |
| MCP最終回帰 | 全88件成功（140,152ms）。公開Git縦断、秘密反例、通常単体入口と既存管理・Transportを含む |
| Workbench回帰 | 全58件中56成功・既存2件失敗。公開Workspace HTTP結合・実Browserは別の該当試験で確認。全回帰Passとはしない |
| 文書検査 | 変更した8正本の限定検査で当該Pathの指摘0。関連展開を含む全結果は1,100エラーで不合格であり、全Repositoryの現行完全検査や全体準拠Passではない |

既存Workbenchの2失敗は、HEAD時点でも1,079,297 bytesの`second-stage-plan.md`がOwner Artifact Readerの512KiB上限を超えること、および現在のProject Contextにない旧文言・固定件数への期待である。今回の公開操作がOwner Artifactを全件availableへ変えたとは扱わず、上限を緩めない。担当責任者はQual-Lab、再評価契機はWorkbench全体の品質・文書整理とv0.22完成Gateとする。後続で正本の分割／要約と固定fixture化のどちらをOwnerが行うか照合する。

今回完成の対象は公開Workspace管理の限定接続である。Workbench旧AI専用経路の共通Taskへの置換、実Provider E2E、別Baseの実Git→実Browser縦断、人間UAT、実データ移行・旧Bundle全面撤去は未完了であり、今回の成功へ含めない。通常Objectiveの任意Workspace IDは受付へ搬送するが、共有WorkbenchのAI実行機能全体を提供済みとしない。新しい実Provider依頼、Docker操作、統合、タグ、Releaseは実行していない。

限定文書監査・Gap／Impact監査も二件の集合で実施した。実行時点の表現と既存Browser Suiteから新Panelへの`verifies`関係を同期し、新QA IDや実行別Evidence書庫を増やしていない。全試験終了後、今回のWorkspace・MCP・Browser・Visualの自己生成試験Root残存は0件。人間のステージ状態は維持し、今回分は未コミット・未プッシュである。

### 旧AI経路置換への着手（2026-10-18）

人間の依頼により、公開接続43ファイルを`174bef00`（`feat(workspace): expose management through Workbench and MCP`）へコミットした。直後の作業Treeはclean。Push・main統合・Releaseは行っていない。前節の未コミット表示はコミット前の実行結果である。

変更分類は採用済みWorkspace方式への既存AI能力の責務移管・本番利用側切替。Architecture／Quality／実装／公開利用側へ影響するため、技術と品質の着手前整合確認を二件の集合で実施・統合した。独立完成レビューではない。必要な完成レビューは技術・品質、文書監査と限定Gap／Impact。準拠基準・安定ID・Release判断は変えないため、準拠監査／Release監査は追加しない。

| 現行経路・不足 | 処置・順序 |
|---|---|
| `workbench-server/bin/workbench-server.ts`がCoordinatorの`workbench-ai`を直接構成 | 共通Taskの実装後、Orchestrator公開APIを使う薄い構成へ変更する。MCP依存を導入しない |
| `repository-composition.ts`は固定Context一件、exact Profile、専用助言Packetを所有 | 読取り専用の保証と四分類・参照を維持して共通Taskへ接続。通常Objectiveは常に変更実行前提のため単純転用しない |
| `operation-composition.ts`は旧OS判断StoreのPrincipal照合とTask後のBundle統合を持つ | AM Principalと同一視しない。既存受付・Writer・Dispatcherを再利用し、Workspace実行結果と明示Git採用を旧Bundleから分離する |
| `objective/execute.ts`はDispatcherの`workspaceResults`を公開Objective結果へ搬送していない | 同Task／Attemptの閉じた変更観測を結果契約と利用側へ接続する。内部結果の存在だけで公開表示済みとしない |
| Workbenchの現在依頼ID・Snapshotは単一Processの共有変数 | 共有利用では主体／Repository／Workspaceの対象照合と既存Queue／Task参照へ接続する。新Session台帳や全利用者共有の現在依頼を作らない |
| `/candidate/action`は旧Bundle用 | 新Workspace管理へ同名で読み替えない。変更確認・固定・別採用の代替能力と利用側を検証してから旧入口を撤去する |

置換の正本は[Workspace詳細の置換契約](../../../06_Architecture/Details/orchestrator/03_Workspace.md#旧workbench-ai経路の置換契約2026-10-18移行中)。共通Taskの明示種別と結果→既存実行・保存→Workbenchの開始・照会・取消→旧利用側撤去の順とする。Prompt・投影・回答本文の非永続を維持し、別名の要求・計画・採用基準・Eventへの本文コピーも確認する。再起動後の本文は欠測であり、自動再送せず、資源回収は既存参照から独立して行う。新Frameworkと保存先は増やさない。追加の人間判断は現在不要である。

発火例は現在development許可・対象所属一致・exact Profile・種別別の送信同意、非発火例は同意なし／管理内容だけ／別Repository、境界例は待機後失効・Workspace変更・結果と取消の競合、情報不足例は対象・本文・回収・配送の観測不能。後三者を完了・空結果・処置なしへ丸めず、元Taskと取得済み参照を保持する。局所試験、実Writer／実Git／HTTPの有限代役結合、実Browser、固定候補の独立レビューを予定する。実Provider／Docker／実データ移行は別の実境界として扱う。

着手時の基準確認は`node --test --test-concurrency=1 tests/unit/workbench-ai/request-lifecycle.contract.test.ts tests/unit/workbench-ai/advice-dispatch.contract.test.ts tests/unit/workbench-ai/advice-packet.contract.test.ts`をCoordinator packageから実行し、26件成功・失敗／skip 0（833ms）。旧能力の入力・Packet・結果拒否の基準であり、新共通Taskへの接続や資源回収・実Provider成功の証明ではない。生成物や生出力の書庫を追加せず、試験Sourceと再実行方法を保持する。

上記のArchitecture・QA・着手記録の三文書を固定し、技術／利用側と品質の二つの限定文書・影響確認を実施した。両者とも指摘0。Source完成レビューではなく、その計画確認時点では置換Sourceは未変更であった。差分の空白検査は成功。この計画更新は未コミットであり、基準コミットへ遡及して含めない。

### 共通Task結果搬送の限定是正（2026-10-18）

全置換の最初の小単位として、Dispatcherが既に生成する`workspaceResults`がObjective結果で落ちる接続漏れを是正した。Orchestratorの既存結果Factoryと閉snapshot、MCPの公開検査を更新し、新State・Store・Lockは追加していない。失敗結果にも取得済み観測を保持し、不正付随観測で元の失敗理由・cleanup・回復参照を上書きしない。

実Git・実Writerの結合を追加した際、内部Task完了＋未採用投影をMCPが既存の完成相関で拒否することも再現した。Factoryを一律blockedへ変更すると旧Bundle Consumerの内部進行まで止めるため、その案は採用せず、二つの着手前確認の結果を統合した。最終公開のMCPだけで未採用をblockedへ写し、元raw completedの安全条件・既存相関定義・内部結果は維持した。新しい状態・一般回復・metadata存在だけの旧統合回避guardは作らない。

初回結合試験の準備は既存Queueを直接除く案がWriterに拒否された。製品の保存条件を緩めず、同じ自己生成試験Root内に新品Git／Snapshotを作る準備へ修正した。次の失敗は上記公開完成相関を再現したものであり、MCP検査を緩めず是正した。公開API集合試験の期待値の並び違いも修正した。これらを当初から成功だったとは扱わない。

固定Sourceへの技術／品質の二独立レビューはともに指摘0。今回完成主張は変更観測の搬送と公開未採用表示に限定する。旧Bundle統合停止、助言種別・本文非永続の共通実行接続、Workbench切替、実Provider・実データ移行は未完了である。実行結果は後続の確定表へ集約する。

| 今回の確認 | 確定結果と限界 |
|---|---|
| 基準と実行条件 | `174bef00`に対するSource／試験差分。Windows、Node.js v24.19.0、Git 2.54.0.windows.1。合成Repositoryは`.crdd/tests/orchestrator-workspace-*`内だけ。Git／Native排他の試験は通常環境で実行し、外部AI・Docker・認証情報は使わない |
| 静的確認 | Orchestrator／MCPの`npm run check`成功。既存Orchestrator試験のstyle情報2件はwarning／errorではない |
| Orchestrator単体 | `npm run test:run`全74件成功、失敗／skip 0（1,565ms）。今回の分岐coverage測定・全IT一括再実行は未実施 |
| 新しい結果搬送の実結合 | `node --test --test-name-pattern="実Objective受付" tests/integration/workspace-lifecycle.integration.test.ts`の1件成功（8,789ms）。実受付・Writer・二Task・Objective結果とMCP検査を通し、変更観測二件、内部completed／公開blocked、HEAD不変、Queueのintegration_pendingを確認。通常Launcherから実AIを起動する全経路ではない |
| 公開API・依存境界 | `node --test tests/integration/public-owner-boundary.contract.test.ts`全3件成功（2,398ms） |
| MCP全回帰 | `npm run test:run`全89件成功、失敗・取消・skip 0（149,243ms）。実HTTP／stdio／通常Launcher等の既存母集団を含む。実Providerの成功ではない |
| 独立確認 | 固定Sourceの技術・品質はともに指摘0。限定文書／Gap照合もともに指摘0。Repository全体の文書・準拠合格やRelease可能の判定ではない |

通常の実行stdoutはこの結果要約と試験Sourceから再生成する。実行別Evidence書庫・Runtimeログ・本文複製をGitへ追加しない。今回の結果搬送だけで旧AI経路の置換完了とはしない。Source変更と計画更新は未コミット・未プッシュで、人間のステージ操作は変更していない。

### 旧AI経路置換の一括対応（2026-10-18、検証中）

人間の一括対応指示により、①助言／Workspace編集の共通単発Owner、②Workbench単体／共有の開始・観測・取消、③旧Workbench専用要求台帳・Bundle候補実行・採用操作の撤去を実装した。既存Project計画・Objective・Milestone・Bundle能力は対象を分けて保持する。Prompt・Context・回答本文はProcess内だけとし、既存Queueへ識別・進行・回復参照を保存する。自動Commit・Merge・Promotion、新しいStore／Lock／Session Registryは追加していない。

次表は先行固定候補時点の経過である。現在の判定と残件は、後段「一括対応の最終確認」に従う。

| 確認対象 | 現在の結果・限界 |
|---|---|
| 固定候補のOrchestrator全結合 | 差分Hash `8883aa8dcf18d00a3bc9c17155d6e069c5b800e6`で全37件成功、失敗・skip 0（307,262ms）。実Git・既存Writer／Native排他と有限実行代役を使用。実Docker／Providerは使用しない |
| Source変更と並走した先行試験 | 保存未確認・Root不正による失敗を観測。固定前の失敗を成功へ書き換えず、上記固定候補結果と区別する。変更並走が原因だったとの断定はしない |
| Workbench全結合 | 58件中56件成功、2件失敗。巨大な既存計画文書の読取り上限に関する既知のProject表示失敗が残る。全体Passではない |
| 独立レビュー | 初回是正後も、Task cleanとLease終端の分離、回収後の保存失敗、同Owner回復、待機中の同時開始、Server再構成後の再入場、副次失敗参照、本文欠測とprimaryの区別を追加指摘。両確認者へ統合是正方針を戻して整合済み。是正後の再レビューは未完了 |
| 再入場の限定確認 | 同Owner回復・元ID再観測を含むOrchestrator実保存2件、共有HTTPのServer再構成1件、Coordinator既存履歴によるexact終了再照合1件が成功。最後の試験の初回起動は必要なmodule mock実行オプション不足で停止し、packageのオプションを付けた実行で成功した。これをDocker実境界の成功とは扱わない |

正式回収後に上位保存が失敗した場合の再入場には、既存Coordinator履歴の限定契約改訂を使用する。新しいworkbench相関付き要約だけv4とし、元の利用元と上位操作相関を保存する。旧固定要約は本文・Hash不変で、新保証の根拠に補完しない。処置は[Coordinatorの終了相関](../../../06_Architecture/Details/coordinator/01_Architecture.md#単発workbench依頼の終了相関2026-10-18実装検証中)と[Workspaceの置換契約](../../../06_Architecture/Details/orchestrator/03_Workspace.md#旧workbench-ai経路の置換契約2026-10-18移行中)を正本とする。

全置換完成・Release可能はまだ主張しない。残る再検証、固定候補再レビュー、既知Workbench失敗、実Provider E2E・人間UAT・実データ移行を区別する。実行別Evidence書庫は作らず、上記要約と試験Sourceを保持する。現在の差分は未コミット・未プッシュである。

#### 一括対応の最終確認

共通単発Ownerへの接続、Workbench単体／共有の開始・観測・取消、Workbench専用旧経路の撤去という①〜③のSource・結合範囲を確認した。既存Project／Bundle能力は保持する。技術・品質の限定独立再レビューは両方とも残指摘0件（固定差分`c5a92601afe5146866f2e3bedabd70cfa5e2e49a`）。その後の変更は以下の試験用代役の所属照合、書式整形、生成物のステージ同期と結果記録であり、本番処理を変更していない。

| 最終確認 | 結果と適用限界 |
|---|---|
| Orchestrator | UT75件成功（2,192ms）。最終全ITは37件中36成功・1失敗（302,615ms）で、失敗は新しい読取り専用Exportの期待値差だけ。期待値同期後の公開境界全3件成功（3,272ms）。単一run全37成功とは表示しない。単発ITは同Owner回復・未終了Lease・交差startの追加反例も成功 |
| MCP | 全89件成功、失敗・skip 0（141,755ms）。実Git・実HTTP／stdio・有限実行代役であり、実Provider成功ではない |
| Coordinator履歴 | 純粋モデル5件成功（657ms）。checkpoint正常／不正のv4負例を含む既存Host Writerの1件成功（26,297ms）。旧固定bytes／Hash・consumer／上位相関・現在不存在条件を維持 |
| Workbench | 全59件中55成功・4失敗（168,485ms）。既知の計画表示2件に加え、試験用Ownerが別IDも所有済みと返す不備と、最新Browser BuildのIndex未同期が各1件。代役を本番Ownerの所属拒否へ合わせ、今回生成物だけをステージ同期後、この2件の限定再実行は両方成功（2,401ms）。単体／共有のServer再構成後の元ID再入場も全体run内で成功。最終全59件を全成功とはしない |
| 静的確認・生成物 | Orchestrator／Coordinator／MCP／Workbenchのcheck成功、Browser Build成功。Coordinatorの実行・設計Trace検査もaccepted。既存の情報レベルstyle提案はerror／warningへ読み替えない |

Workbenchに残る既知2件は、既存の巨大な`second-stage-plan.md`がOwner Artifact読取り上限を超え、計画がunknownとなる表示試験である。今回の単発実行・再入場とは別に是正対象として保持し、上限を無条件に拡大して隠さない。Browserだけの新規Host初回同意、実Provider E2E、UATと実データ移行は未実施のまま。編集のHost送信同意の運用前提はWorkspace正本へ明記した。

コミット・プッシュは実施していない。Browser再生成物一件だけをステージ同期し、それ以外の人間によるステージ内容は変更していない。

### 計画表示2失敗の是正（2026-10-18）

人間の追加依頼により、参照文書一覧が約1MiBの変更計画を本文上限512KiBで拒否し、一覧全体をunknownにする結合を是正する。計画投影のReader自体の故障ではなく、先行説明の「計画がunknown」は一覧の未取得と区別して訂正する。

変更はWorkbench Reader、既存試験、直接のArchitecture／QAと現在投影に限定する。既存の本文上限・認可・Repository境界・公開DTO・保存は不変更。全文上限増加と巨大計画の全面分割は今回目的に対して影響が大きいため採用せず、一覧用の先頭8KiBの見出し取得を本文読取りから分離する。親の着手前照合と技術・品質の読取り専用確認は編集前に整合し、人間の追加判断はない。正常、容量境界、途中行／UTF-8、非対象Path、欠測・read／close・実体差を既存ITへ接続する。独立レビューと限定文書・影響確認、Workbench静的検査と全回帰を実施する。工程契約・準拠・Release判断を変えないため全体準拠監査は追加しない。Docker・外部AIは使わず、自己生成物はRepository-local `.crdd/tests`から回収する。

一覧の是正後、初回の限定4件は3成功・1失敗（13,924ms）だった。残るDirection A試験は、CSR側の「日程リスク」という表示文言をJSONにも要求する旧期待値だった。表示は変更せず、計画の取得成功・日程リスクの非空・共通Readerとの値一致を確認する試験へ修正した。Project表示の固定品質件数も、取得成功・非空を確認したうえで正本Readerとの一致へ置き換えた。不明同士の一致を成功とはしない。

| 最終確認 | 結果と適用限界 |
|---|---|
| 固定対象 | 基準`174bef00d692501f428951ae2f95405668d99292`、`git diff --binary HEAD`のGit blob Hash `43be74de18781303cf070474e95851605bed1de0`。全回帰中にSourceを変更せず、終了後も同Hashを確認。以下の結果追記・現在投影更新は回帰後の文書変更として区別する |
| 公開回帰入口 | Workbench Serverの`npm test`全60件成功、失敗・取消・skip 0（175,916ms）。pretestのBrowser Build、書式・型・Lintも成功。元の2失敗を含み、実Git・loopback HTTP・自己生成合成データを使用する。実Docker・外部AI・実資格は使用しない |
| 読取り境界 | 512KiB直前後、8KiB見出し境界、途中行／UTF-8、read／close失敗、実体差・欠測等を確認。一覧は巨大文書の見出しを表示できるが、同文書の本文取得は従来どおり拒否する実HTTP結合も成功。既存の認可・リンク拒否試験を維持する |
| 独立確認 | 最終固定候補の技術・品質と限定文書／影響確認はともに指摘0。初回限定試験の失敗を保持し、最終全60成功と混同しない |
| 残る範囲 | 今回の2失敗は解消。実Provider E2E、人間UAT、実データ移行、全体品質再評価、新しいBrowser実測は未実施。全Packageの単一run成功・Release可能とはしない |

実行別Evidence書庫は追加せず、本要約と試験Sourceを保持する。今回コミット・プッシュは行っていない。

#### コミット後のOrchestrator全回帰（2026-10-18）

人間の指示で上記までを`9e4b4d08`へコミットした。プッシュは未実施。Sourceを変更せずOrchestratorの公開`npm test`を再実行し、静的検査成功、UT全75件成功（1,615ms）、IT全37件成功（276,098ms）、失敗・取消・skip 0を確認した。Lintの既知style情報2件はerror／warningではない。先行runの36成功・1失敗を消さず、期待値同期後の今回一括成功と区別する。実Git・自己生成Writer／排他の試験であり、Docker・外部AIは使用していない。

後続E2Eの入口照合では、既存`verify-orchestrator-real-providers.ts`はProject計画と採用を含み、今回のWorkbench単発依頼そのものではないと確認した。そのまま新経路全体の成立証明へ流用しない。新しい単発経路の実Provider確認は送信対象・範囲を明示し、追加承認前に開始しない。

#### 読取り専用の実Provider確認（2026-10-18、途中停止）

人間はCodex／Claude各一回、`PROJECT_CONTEXT.md`と固定質問だけの送信、既存Docker隔離、自己生成資源の回収を承認した。編集・採用・Commit・Docker再起動・Profile変更は対象外。短命Runnerを実行前に独立確認し、Profile／Catalog固定、一次失敗とclose失敗の分離、timeout後の完了競合でも失敗を保持する条件を確認した。製品Sourceは`0dac1529`のまま。最初の環境審査は送信許可確認不足で拒否され、対象ファイル・両送信先を明示した提案と人間の直接承認を同じ入口へ再提示後に実行が許可された。迂回・初回拒否時の送信はない。

| 対象 | 実測結果と限界 |
|---|---|
| Codex一回 | `PROFILE-100001`／`gpt-5.6-sol`、依頼`request-47ee9354-3e3c-44b0-8702-bbb2b3523802`、Operation `OP-264717650761609107924181161446803518758`。公開HTTPから本番単発Ownerへ接続し、Provider開始・exit0・公開completedを確認。事実2項目・次候補1項目、本文は保存しない |
| 個別回収・状態 | Process終了、今回Container／Network不存在、cleanup確認、回復参照・副次失敗0。Coordinatorのoperations／unresolvedRecoveries／pendingDeliveriesは各0。Orchestratorは今回Queueがcompleted／settled、Lease acquired／releasedを確認。通常の終了記録・historyPendingを未解決実行資源と混同しない |
| 全体試験の停止 | 正本不変・Server close成功だったが、試験前後のDocker全Container／Network ID集合一致がfalseとなり、stickyな安全停止で終了。試験全体は不合格であり、個別成功で上書きしない。初回基準のID集合を出力しておらず、差分の完全な再構成と原因特定はできていない |
| 後続の読取り確認 | 現在は試験前から存在した停止Container一件と、bridge／host／none／jarvis_defaultのみ。今回のinternal／egress二NetworkはDockerイベントでもcreate→destroyを確認した。標準bridgeのCreatedは試験開始付近だが、不一致原因とは断定しない。連続した一覧二読取りは一致。資源削除・再起動・製品是正は追加しない |
| 警告 | NodeがSocketのerror／close各14 listenerに対するMaxListenersExceededWarningを出した。今回closeは成功したが、監視漏れ不存在や警告原因の解消を主張しない。製品修正を今回試験へ混入させない |
| Claude | 未実行。Codex再依頼は行わない。全一覧不一致を未確定のまま安全停止条件から除外せず、新baselineによるClaude一回だけの継続を人間へ確認する |

実行別Evidence書庫・生出力は追加しない。短命Runnerは試験終了後に回収し、未使用のClaude承認だけを理由に安全停止を自動解除しない。今回の観測は読取り助言の一経路に限り、新方式全E2E・人間UAT・編集／採用／移行の成立ではない。

#### Claude単独一回の確認（2026-10-18）

人間が安全停止後の新baselineによるClaude一回と試験物回収を明示承認した。同じ固定質問と`PROJECT_CONTEXT.md`だけを使用し、Codex再依頼、Profile変更、編集・採用、Docker再起動は行っていない。短命Runnerの限定独立確認は指摘0。製品Sourceは`0dac1529`のまま、前回結果を記録した未コミット文書も試験前後で不変だった。

| 確認 | 結果 |
|---|---|
| 実Provider | `PROFILE-200001`／Claude `opus`、依頼`request-ff1bbf3b-b952-4026-89e9-e617c8e597e9`、Operation `OP-154392190998890482546238155370879165941`。公開HTTP→本番単発Ownerから一回実行し、開始・exit0・公開completed／executionStatus completedを確認。事実4・共有分析3・追加推論2・次候補2。回答本文は保存しない |
| 終了・回収 | timeoutなし、一次失敗なし、回復参照・副次失敗0。Process終了、所有Container／Network不存在、cleanup確認、Server close成功。Coordinatorの実行中・回復待ち・配送待ちは各0、今回Task completed／settled、Lease acquired／releasedを終了後に再確認 |
| 前後観測 | 開始時の既存Container一件とNetwork四件のIDを記録し、終了後の追加／消失はすべて0、稼働0。正本のCommit・status・diff・Context Hash不変。Claude単独の限定試験は成功、終了Code 0 |
| 残る不確実性 | Node Socketのerror／close各14 listener警告は再現し、原因・監視漏れ不存在は未確認。前回Codexの全一覧不一致は未解明のまま保持する。今回を両Provider単一run全成功や全E2E成立へ拡張しない |

短命Runnerと専用空Rootは確認後に削除し、通常の終了状態・履歴は既存Ownerへ残す。製品修正・新しい回復機構・実行別Evidence書庫は追加しない。

#### 警告・一覧不一致の原因調査（2026-10-18、製品修正なし）

人間の調査指示により、Source、当時のDocker Host／VMログと外部AIなしの局所再現を確認した。実Providerの再依頼、Docker再起動・修復・新規Container作成は行っていない。

| 対象 | 確認した原因・根拠 | 限界と最小是正候補（未実装） |
|---|---|---|
| Socket監視数警告 | 既存`withFilesystemStoreLock`を自己生成Rootで11回同期取得・解放すると、cleanupは全件trueでもstderrのerror／close監視は各2→24となる。続く既存Lifecycle Reporterの登録で各25の同型警告が発生し、stackは`execution-controller.ts:669/670`を示す。イベント処理後250msの観測では各2へ戻る。各Lock間に25msのイベント処理を挟んだ反証では最大4・終了2・警告なし | Node組込みWorkerは既定stdioを親へ転送し、その登録時だけ警告上限を抑制する。`root-and-lock.ts`の解放ACKはWorker内のserver close完了であり、親側のexit／stdio監視撤去とは別。同期Lock群で親の終了通知処理が遅れ、Reporterの追加登録が警告を顕在化させる説明を強く支持する。全経路の恒久漏れ不存在は未証明。既存Workerのstdio／終了所有を整理する候補であり、上限増加・固定sleep・親の同期Atomicsでexit待機へ変更しない |
| HTTP起因の反証 | Package読込み後のstderr監視は各2。合成HTTP基盤40読取り、実Workbench公開GET30読取り、期限付きGET3読取り、本番検証Client＋合成Owner20観測では警告なし。後者は監視各2を維持しListener close完了 | 警告をHTTP pollingやReporter単独の恒久漏れと断定しない。途中の長いGET診断は終了時に30読取り成功・exit0を確認した |
| Codex全一覧不一致 | Docker backend logは18:32:17.301／19.964 JSTのnetwork一覧と事前version／pingを`apicache`の応答として記録。18:32:30.526のContainer createが9時間33分idle後のVM起動を発火し、engine stopped→starting。VMログで18:32:35.072にdaemon起動、標準bridge Createdは18:32:35.868。事前baselineと復帰後観測は同じEngine世代ではなかった | 省電力キャッシュ→復帰後の全ID完全一致という試験条件が不適切だった説明を強く支持する。初回baseline ID未保存のため、差分がbridgeだけだったことや全既存資源保全は未確定。元Failは保持。標準Engine資源の世代、今回exact所有資源不存在、既存利用者資源保全を分けて観測する候補とし、全一覧条件の単純削除・eventsだけで不存在判定はしない |

原因解釈の限定独立確認は指摘解消済み。調査用二Sourceと自己生成Lock Rootは回収し、製品Source・設定は変更していない。新しいRecovery、Registry、Lock Framework、試験再実行は追加しない。

#### 監視数警告・一覧比較の限定是正（2026-10-18）

人間が二点の是正・局所試験・回帰を許可した。内部Lock Workerのstdioを親Consoleへ自動pipeせず明示消費する方式へ変更した。共有状態ACK、error／exit通知、既存Lockの取得・解放・回復条件は維持し、固定sleep・監視上限変更・新しい管理機構は追加していない。同期11回の実Lock試験で親stderr監視数が増えないことを確認した。これを全Workerの恒久漏れ不存在証明へ拡張しない。

検証入口は`workbench-server/scripts/verify-readonly-ai.ts`へ固定した。別許可済みの一Provider・固定質問・Context一件だけを扱い、通常回帰では実AIを起動しない。Docker比較は標準NetworkのID差を専用診断へ分離し、捕捉構成・利用者資源・個別cleanupと前後idleを独立評価する。Hash対象fieldの欠落・異型は非成功、正常nullは区別する。試験器自身の前後照合は検証Root・Revision・Context Hash・Profileに限定し、Git子Processを使用しない。既存Workbenchの安全なGit読取りは維持し、全Repository／indexの不変は主張しない。今回、実AI・実Dockerの再試験は行っておらず、先行Codexの元Failは変更しない。

| 確認 | 結果と限界 |
|---|---|
| 局所 | Domain Lock 13件、Coordinator Lock／終了29件、試験器4件が成功。回帰で判明した模擬Workerのstdio追従不足は代役だけ修正し、Process安全6件（内部10故障モード）も成功。合計52件。取得失敗・timeout・error／exit・cleanup Oracleを緩めていない |
| 静的確認・独立確認 | 関連Packageのformat／型／lintを確認。技術・品質の限定独立再レビューは是正後残指摘0。文書のGit非使用主張も試験器自身へ限定した |
| Workbench回帰 | Build・静的確認と全64件成功。局所HTTPが制限環境で接続前拒否されたため、通常環境で再実行し成功した。外部AI・Docker操作・資格は使用しない |
| Domain回帰 | 全123件中122成功・1失敗。Runtime保存Consumerの配置チェック8指摘は、自変更をHEADへ戻したメモリ上の比較でも同一であり既存不整合。今回scopeへ混入させない |
| Coordinator回帰 | 公開`npm test`のportable回帰を最後まで実行しexit1。Host Windows専用集合・実Provider E2Eの成功は主張しない。修正前のPoison代役失敗は上記局所再確認で解消したが、修正後の全回帰を再実行したとはしない。既存2失敗は下表に保持する |

| 既存回帰残件 | 確認した内容 |
|---|---|
| 保存先Consumerチェック | `storage-consumer-closure.integration.test.ts`。新Workspace経路4ファイルに由来するraw-root／root-literal／未登録workspacesの計8指摘。今回変更前にも同じ結果 |
| Single Task有限結果 | `orchestrator-execution.contract.test.ts`のPR-N-01。先行Workspace接続で必須になった`workspaceResult`を旧completion代役が返さない。有限startTaskは今回変更したWorker生成を呼ばない。安全条件の緩和ではなく別の試験追従が必要 |
| Core Source母集団 | `orchestrator-platform-independence.contract.test.ts`。基準HEADにも存在するTask／Workspaceの6ファイルが旧分類表にない。import辺評価前の母集団不一致であり、全件を一律pureへ追加して通さない |

今回の二是正は局所・独立確認済みだが、全回帰成功・実Provider再確認・全E2E成立ではない。実行別Evidence書庫は増やさず、この要約と既存Ownerの履歴だけを保持する。

#### Workspace関連3件の是正と回帰（2026-10-18）

人間の指示により上記3件を是正した。基準Commitは`0dac1529f51cbbb424800a702014eb9482c13a36`で、先行する監視数警告・一覧比較の未コミット是正を含む作業ツリーを対象とした。新しいState、Registry、Lock、監視Process、Recovery機構は追加していない。

| 対象 | 是正内容 |
|---|---|
| 保存先Consumer | Domain Modelへ既存Worktree領域の名前付き定義を追加。物理配置はVersion Controlが所有し、上位は既存の配置観測結果を利用する。Coordinatorの保護用Directory準備は既存Domain保存処理へ集約し、内部Rootを公開しない。観測時の作成なし、準備時の空Directoryのみ、file・link・観測不能時の拒否を試験した |
| Single Task有限結果 | 既存Direct実行契約のWorkspace完了結果を試験代役へ補い、実際の引数・返却条件を確認した。全回帰で見つかったComposition側の同型代役も追従し、同File全10件成功。製品の完了判定は緩めていない |
| Core Source母集団 | Task／Workspaceの6ファイルを実際の依存責務に基づき分類した。未知Source・不正import辺の拒否を維持する。固定export一覧・検証Toolの実Consumer一覧も現行APIへ追従した |

| 回帰範囲 | 結果と限界 |
|---|---|
| Domain Model | 公開試験123件すべて成功 |
| Version Control | 公開試験64件すべて成功 |
| Orchestrator | 公開試験UT75件・IT37件すべて成功 |
| Workbench Server | Build・静的確認を含む公開試験64件すべて成功 |
| MCP Server | 公開試験89件すべて成功 |
| Coordinator全回帰 | portable集合を最後まで実行。全1,923件中1,910成功・8失敗・5対象外、取消0、exit1、約17分5秒。8失敗中1件は上記Composition代役で、是正後の同File10件成功と区別する。残る7件は未解消であり、全回帰Passとしない |
| Coordinatorの残る7件 | Queue取消試験の初期状態保存1件、Git配置識別5件、操作領域の実体識別1件。取消処理到達前の準備拒否や実体識別取得の拒否を観測したが、共通原因・今回変更との因果は未確定。識別条件は変更していない |
| 局所診断 | Git配置・操作領域の同じ25件は通常実行で成功した一方、全回帰と同じ実行設定では一度5件失敗した。その後の設定再照合・非改変の識別観測付き実行は25件成功し、異常metadataは捕捉できなかった。合成3,072観測も正常。局所成功を間欠失敗の解消や既存不具合の証明へ読み替えない |
| 独立確認 | 技術・品質の限定再レビューは是正後残指摘0。残る7件を未解消とする評価を維持し、識別確認の緩和・根拠のないTimeout延長・管理機構追加は行わない |

Coordinatorの書式・型・Lintと追跡検査は成功し、Lintの既知情報64件はerror／warningではない。Composition代役の最終変更後にも型・書式・Lintを再確認した。実AI依頼、Docker操作、資格使用、Commit・Pushは行っていない。正式QA全体の成立数やRelease判断は変更しない。次の確認対象は残る7件の最初の拒否原因であり、原因未確定のまま安全条件を弱めない。

#### Windows実体識別の限定是正と回帰（2026-10-18）

人間が残る7件の調査・最小是正・回帰を許可した。試験用File一件で、Node v24.19.0のBigInt inodeは`-6998593820933646654`、Windows標準照会は`0x9ee00000000196c2`だった。同じ64bit列を符号なし値へ直すと`11448150252775904962`でWindows IDと完全一致する。実Nodeのstat配列も`BigInt64Array`だった。[libuvのstat型](https://docs.libuv.org/en/v1.x/fs.html#c.uv_stat_t)はinodeを`uint64_t`としている。正常な上位bit付きIDを負値という理由だけで拒否する欠陥を確認した。Number変換・絶対値化は使わない。

| 処置 | 内容と維持した条件 |
|---|---|
| 最小補正 | VCのGit配置識別、Domainの上限付き保存Reader、Coordinator所有領域のDirectory／File／descriptorの計5取得点で、Windowsのbigintかつ`-2^63 ≤ ino < 0`だけを同じ64bit列の符号なし値へ正規化。型不正・ゼロ・下限逸脱・POSIX負値・型・link・dev・birthtime・容量・途中変更・別IDを引き続き拒否する |
| 保存・利用側 | 従来の正値と保存済み記録は不変更。Schema・移行Reader・State・Registry・Lock・Recoveryを追加しない。Orchestrator試験準備では既存の固定失敗理由をassertionへ保持した |
| 反証 | 負値を与えた実Reader三経路は修正前3件失敗、修正後成功。5取得点の実本文でOS別・符号境界・不正型・欠測・link等を確認。実Readerの別ID拒否、操作作成・再検証・回収、保存・再読・開始前取消まで計5試験を接続した |
| 実観測と限界 | 実在する負inodeのmetadataを補正済みVC関数へ渡してもWindows IDと一致し、dev・birthtimeは不変だった。元7失敗の各metadataは未捕捉であり、過去すべての原因が同一だったとは断定しない。観測済み同型欠陥の反証と今回全回帰の成功を現在の是正根拠とする |

| 公開回帰 | 最終結果 |
|---|---|
| Coordinator | portable全1,927件：1,922成功・失敗0・取消0・対象外5、exit0、1,172,872ms。元7件と追加4件を含む。実AI・Docker試験やHost専用集合の成功ではない |
| Domain Model | 124／124成功、44,998ms |
| Version Control | 64／64成功、114,734ms。先行63成功・1失敗は機能確認後の試験Root清掃EPERM。空・非使用を確認した当該Rootだけ非再帰で回収し、Source・合否条件を変えず全回帰を再実行した。元Failは保持する |
| Orchestrator | UT75／75成功、IT37／37成功（IT531,795ms） |
| Access Management | 共通保存Readerの直接利用側152／152成功、224,283ms |
| MCP Server | 89／89成功、211,581ms |
| Workbench Server | Build・静的確認と64／64成功、275,128ms |
| 静的・独立確認 | 書式・型・LintとCoordinator追跡検査は成功。既知Lint情報64件はerror／warningではない。技術・品質の限定独立レビューは残指摘0 |

製品Sourceは回帰中不変更。基準HEADは`0dac1529`、先行Tool二ファイルを除く`40_Develop`対HEAD差分Hashは`a222ad39d04c73bd6c35ae49f77bce8994400ebe`で開始・終了時に一致。二ファイルのSHA-256も先行固定値から不変だった。ステージ操作を内容変更と混同せず、こちらからCommit・Pushはしていない。

横断調査で見つけたProbe記録、Docker IsolationのCLI／回収／退避、Platform Accessの別Readerには未評価の同型判定候補がある。各Package Ownerが実障害または当該領域改修時に再評価する。今回5取得点との直接Identity受渡し不整合は確認されず、一斉修正を混入させない。Probe Writerには記録作成後の拒否もあり得るため、単なる拒否をEffect 0や清掃成立と表示しない。全Windows経路対応済みとは主張しない。

実AI・Docker操作・実資格使用、新管理機構、実行別Evidence書庫は追加していない。正式198項目の全数評価、実Provider全E2E、人間UAT・移行・Release判断は別に残す。

#### 最新Sourceの読取り専用実AI確認と残る切替（2026-10-18）

基準Commitは`9e99cdf1001ba98cd7d859c1878733d33a8551e6`。人間が`PROJECT_CONTEXT.md`全文と固定質問を既存SubscriptionのCodex／Claudeへ各一回送信する範囲を明示承認した後、既存`verify-readonly-ai.ts`を順番に実行した。最初の環境審査拒否はProcess作成・外部送信前であり、Provider再試行には数えない。実行別Evidence Directoryは追加しない。

| 対象 | 公開入口からの観測結果 |
|---|---|
| Codex | `PROFILE-100001`／`gpt-5.6-sol`、要求`request-ad9170fb-0fcd-4df4-8c5f-2eedbdee5524`。completed、一次失敗なし、二次失敗0、回復参照0、cleanup確認済み、exit0 |
| Claude | `PROFILE-200001`／`opus`、要求`request-63798336-2a73-4e33-8e5d-be0fc95ba697`。completed、一次失敗なし、二次失敗0、回復参照0、cleanup確認済み、exit0 |
| 共通の終了確認 | Server close確認済み、Timeoutなし、Context Hash／Git Revision不変、既存Container／Network一覧と構成の前後一致、追加・消失資源0。監視数警告は今回の両実行で観測されなかった |
| 主張の限界 | 公開HTTP経由の読取り助言と回収の限定成功であり、全Repository／index不変、編集E2E、回答内容の全数品質、人間UAT、全E2E成立は主張しない。生の回答・資格は記録しない |

続く編集E2Eと旧方式撤去は未完了。既存の技術・品質の読取り専用事前確認を統合し、次の順で進める。

1. 自己生成RepositoryでDirectの既存dirty／stage保全と編集・終了を確認する。Directを自動採用へ接続しない。
2. 同じ自己生成RepositoryのIsolatedで、実AI編集、公開差分確認、選択した変更だけの固定、別操作の採用、二親Mergeと不要Branch／Worktreeの回収を確認する。候補CommitとMerge親・Treeを実Gitで照合する。
3. Project計画の本番利用側をWorkspace方式へ接続してから、旧Bundle生成・統合・採用・Store専用処理を除去する。`operation-composition.ts`の計画終了後統合と既存採用入口は現用であり、単発Taskの成功だけから置換済みとしない。計画・Quality・判断待ちを失わせず、AI完了から自動Commit・Mergeしない。

旧Storeの想定先`%LOCALAPPDATA%/Qual-Lab/CRDD/CandidateStore`は読取り照会時点で不存在だった。この一点から全旧保存先・回復参照不存在や全移行完了は推定しない。正式Evidenceは歴史的証跡として不変更とし、Domain Modelの別用途の候補処理を名称だけで削除しない。

今回の経路は既存Capabilityの検証と複数Packageの利用側切替である。編集前にArchitecture／Qualityと実Consumerを照合し、製品変更の固定候補には技術・品質の独立レビューと利用側の不足／影響確認を行う。準拠表明・Releaseは変更しないため、それらの全件監査を今回の限定検証へ追加しない。編集試験の外部送信許可は上記読取り助言の承認とは別に扱う。

人間は続いて、合成Root内のDirect／Isolated各一Task、候補固定・二親Merge・自己生成物回収を承認した。編集用固定Imageの互換性を再照合し、助言用`gpt-5.6-sol`と編集用`gpt-5.5`の違いを説明した上で、編集試験だけ既存`PROFILE-100003`／`gpt-5.5`へ変更する判断を得た。Claudeは`opus`を維持する。5.6用Profileの追加案は取りやめ、Catalog・Imageの本体設定を変更しない。

外部AIなしの試験器事前確認では、合成二RepositoryのDirect変更保全とIsolatedの公開差分確認・候補固定・別採用・二親／Tree照合・候補終了・Workspace終了・Branch／Worktree不存在・子Root回収が成功した。Docker前後一覧・構成は一致した。実mainの親link拒否・清掃EPERM反例を含む局所6件と静的確認は成功し、試験器の独立再レビューは残指摘0。これは実AI編集の成功ではない。先行する試験器のGit空設定、ロゴ前提、HTTP必須field、合成Rootに存在しない関連CHG指定の失敗は外部AI前に止まり、自己生成物だけを確認後に清掃した。

③の計画集約は、人間が「同じWorkspaceでTaskを順番に実行」を採用した。Directは現在Treeのまま品質判断へ、Isolatedは明示固定・別Git採用後に品質判断へ接続する。Task完了から自動Commit・Mergeしない。Architecture詳細とQA-000005へ切替先の条件を反映したが、本番Sourceの切替・旧Bundle／Store撤去は未完了である。

編集の実試験は承認済みの外部対話端末で一回だけ開始した。Direct要求`request-6e383c4e-d563-41d8-a676-af4ab26633c5`は`provider_process_exit_nonzero`でblockedとなり、Isolatedは開始していない。元Operationは`OP-177329842347160795331207977218656387170`、最初の失敗は`execution_classification`／`start_provider_attached`で、command handle取得・応答観測あり、receipt記録なし。Provider終了の詳細原因と外部送信成立の有無は、この閉じた診断だけでは確定しない。モデル又はDockerが原因だったと断定せず、自動再試行・別Provider切替をしない。

| 終了時の確認 | 結果 |
|---|---|
| Directの変更 | `source.txt`は`BASE`のまま、閉じた変更観測は空配列。編集成功・dirty保全の実AI成立は主張しない |
| Task・Server | 元失敗を保持、cleanup確認済み、回復参照0、二次失敗0、Server close確認済み |
| 現在状態 | Coordinatorの操作・未解決回復・配送待ちは各0。Orchestratorの当該単発依頼はsettled、cleanup済み |
| Docker | 試験後の読取り再確認では既存の停止Container一件だけ。既存利用者資源の一覧・構成は不変。標準bridgeのIDは変わったが、構成一致と個別回収を別に観測しており再起動・修復は発行していない |
| 試験器の評価修正 | 元reportの`provider_cleanup_unconfirmed`は、両方式の試験成功をcleanup条件へ誤結合した試験器の判定であった。Task失敗・技術回収・合成Root清掃を分離し、Task失敗でも回収成立を独立評価する有限反例を追加。元FailをPassへ書換えない |

実AI編集は失敗条件に従って停止した。②の編集E2Eは未成立、③は設計伝播までであり、1〜3全完了又はRelease可能とは扱わない。不要な失敗診断書庫は増やしていない。現在非使用・回復不要・実行資源不存在、当該単発依頼settledと既存Git Worktree登録追加なしを再確認し、今回の`.crdd/tests/workspace-real-ai/`を回収して不存在を確認した。

試験の合否とcleanup判定を分離した最終Toolの書式・型・Lint及び局所6件は成功した。最終文書／不足影響の限定独立レビューと検証Toolの限定独立レビューはともに指摘0件。これは実編集の元Failを解消する根拠ではなく、原因調査前に再試行・旧方式撤去へ進まない。今回Commit・Pushは行っていない。

#### 編集非0終了の最小診断補完と無通信確認

一次失敗へ同じDocker CLIの数値終了値とstdout／stderr byte数を追加し、Codexの有界JSONLエラーを既存の失敗分類へ接続した。原文保存・実行条件の緩和・新しい回復管理は追加しない。元失敗では数値終了値を保存しておらず、詳細原因は遡及確定できない。

固定Image `sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c`で、資格Mountなし・Network none・非root・readonly Root・合成三Mountだけの限定確認を実施した。通常Entrypointの編集CLI引数＋`--help`はDocker／Containerとも終了0、help表示あり、引数拒否なし（stdout 3957 bytes、stderr 103 bytes）。別Containerの固定Pythonは終了0で通常Source書込み、`.git`／`.crdd`書込み拒否を確認した。stderr本文を記録しておらず、警告不存在とは主張しない。二Containerと専用Rootの不存在を確認した。

この確認はImageの基本起動と三Mountだけの成立を示し、認証・モデル・実Taskを評価しない。元E2E原因をDocker又はモデルへ断定できず、AI再試行・再認証・Docker再起動は行っていない。

AI Adapter通常回帰33件、Controllerの非Host回帰109件、追加の数値契約・起動欠測・清掃失敗反例3件、Windows実保存・読戻し1件は成功した。型・書式・Lintも成功し、実装／保存契約と試験器／主張範囲の限定独立再レビューは各指摘0件。試験器の失敗反例は有限代役によるもので、実Dockerの故障再現ではない。実AI編集の再試行は未承認・未実施のまま残す。

#### 同条件の一回再実行（2026-10-18、失敗・回収未完了）

上記時点の後、人間が同じ条件で一回だけの再実行と試験物回収を承認した。端末起動文の構文誤りは試験本体開始前に検出し、Root不存在を確認して起動方法だけを修正した。実試験は一回だけ開始し、Direct要求`request-f4e17fe1-6ca6-4afc-9471-58ae859b858e`の受付後、公開状態取得で`workbench_verification_transport_failed`となった。Isolatedは未開始、Task再送・別Provider切替なし。

元Operationは`OP-173742365490754481381956596975309094311`。保存状態はProvider未開始・外部送信未発行・共有書込み未発行、一次Process診断はnullであり、前回のAI非0終了の再現とは扱わない。HTTP試験器は15秒期限を持つが、今回の最終reportは例外causeを保持していないため、期限超過と別の搬送失敗を断定しない。

同じ回復ID `docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.3e1615d6c5f027a803efd6518df0d30558cc7b711c766a1610cc98293fea2ad7.7a7a9408b57b0127f42f0e71ce377bd6bef00ac2e28f81d483ac2c46d204b770` の正式回収は`docker_task_recovery_resource_unconfirmed`で停止した。認証確認用Containerだけが作成結果unknown、他四資源は未要求。OwnerのEffectはdisabledとなり、回収CLIのLock解放は確認済みだが、Task回収・Host回収・記録終了は未完了である。

回収後の読取り一覧は既存停止Container `jarvis-python-1`と既存Networkだけで、今回の試験資源追加は観測されなかった。これを未確定Createの正式終了証明に置換しない。`.crdd/tests/workspace-real-ai/`と同じ回復参照、関連Host領域は未解決のため保持し、自動期限削除・手動記録書換え・再起動・再試験を行わない。次はHTTP状態取得の失敗原因と、未確定Createの既存終了経路を確認する。今回②は未成立である。

#### 通信失敗後の試験器終了処置の限定是正

人間の許可に基づき、通信失敗の固定分類・操作段階・期限Timerの発火・許可済みcodeを保存し、清掃用abortを期限超過と誤記録しないようにした。受付IDが確定した後の観測失敗だけ、既存Ownerへ同じTask IDの取消を一回発行し、そのTask結果・cleanup・回復参照を記録してからServerを閉じる。取消例外・別ID・実行中返却・回復待ち・副次失敗又はその欠測は清掃成功へ畳まない。元通信失敗、取消失敗、close失敗を分離し、新規Task再送・期限延長・新しい管理機構・本番回復条件の変更は行わない。

外部AI・Docker・認証情報を使わない有限反例とloopback公開HTTPによる関連回帰9件が成功し、型・書式・Lintも成功。技術／品質の限定独立再レビューは各残指摘0件。これは実AI再試行、公開取消HTTPの実証、元通信失敗の詳細原因確定又は保持中試験物の回収成立ではない。保持中Root内の結果・Coordinator状態・Orchestrator状態の3ファイルはSHA-256不変を確認し、関連Host領域も処置しない。AI再試行・Docker再起動・記録強制削除は未実施、今回の残存は同じ回復参照で保持する。

<a id="workspace-edit-trial-ended-unresolved"></a>

#### 今回の試験終了と未解決回収の保持（2026-10-18、人間判断）

決定権限者である利用者は、今回の認証確認用Containerが遅れて停止状態で残る可能性を許容し、今回の試験を終了扱いにすることを指示した。これは今回の失敗試験だけの判断であり、一般のunknown回収条件の変更、AI再試行、Docker再起動又は削除の許可ではない。

| 区分 | 確定した扱い |
|---|---|
| 試験 | 終了。Directは失敗、Isolatedは未実施。②の編集E2E成立・Pass・Release可能を主張しない |
| 回収 | 未完了。`cleanupConfirmed:false`を成功へ変更せず、認証確認用Container作成結果のunknownを維持する |
| 対象・追跡 | 要求`request-f4e17fe1-6ca6-4afc-9471-58ae859b858e`、Operation `OP-173742365490754481381956596975309094311`。上記一回再実行に記載したexact Docker回復IDと関連Host回復参照をそのまま保持する |
| 物理残存 | `.crdd/tests/workspace-real-ai/`、対応Host一時領域・markerを保持する。状態・結果の強制書換えや削除は行わない |
| 残るリスク | 遅延したCreateにより、未startの停止Containerだけが後発で残る可能性。現在資源未観測を将来の不存在保証へ拡張しない |
| 再評価契機・担当 | Front AI又はRuntime運用担当が、利用者から明示された同IDの回収調査で再評価する。後からID・作成結果が判明した場合は既存の構成照合・同ID回収を検討する。期限だけでunknownや保持物を自動破棄しない |

今回の記録更新では、Runtimeの状態・終了条件・排他・回復機構を変更しない。試験終了と未解決回収を分離して記録するだけとし、AI再試行・Docker操作・残存削除は行っていない。

#### ②・③の残件と次の進め方（今回の区切り）

③の着手前対応表（基準`d60f8c06`）。既存の技術・品質の読み取り専用確認から、下記の接続は採用済み契約内で実施でき、追加の人間判断はない。実AI・保持物処置・旧Store全面撤去は今回の接続作業へ含めない。

| 既存利用側／成立済み責務 | 今回の処置・接続先 | 確認する反証 |
|---|---|---|
| `task/dispatch.ts`のTask予約・結果受領・回復・Lease終了 | 同じQueueのWorkspace対象をTask直前に読み、予約から保存・回復処置まで一件ずつ実行。既存Writer／回復参照は維持 | 依存なし二Taskでも同時稼働1、取消・保存不明後は後続0 |
| `objective/execute.ts`の初回・再入場 | 保存済みQueue／Workspaceの同一性を用いてDirectの品質判断待ち、Isolatedの明示Git採用待ちを投影。初回だけの結果metadataに依存しない | 再入場でTask再送・旧統合0、対象差・欠測を拒否 |
| `operation-composition.ts`の計画終了後Bundle統合・`adoptResult` | Workspaceの待ち結果へ接続し、旧自動採用要求はEffect前に明示拒否 | 旧Integration Adapter生成0、Task完了・配送ACKでCommit／Merge0 |
| 公開品質受入と既存Decision／根拠保存 | DirectはGit採用不要。Isolatedは元計画と同Queue／Workspaceの既存採用結果・固定候補・Merge・現在HEADを照合 | 採用前、別HEAD、別Queue、記録欠測を拒否。Ref回収後も受入可能 |
| `orchestrator/src/cli/command.ts`と`template/tools/crdd-mcp-server.ts`の計画受付 | 共通の公開Objective／品質判断Ownerへの接続を維持する。MCPは閉じた結果へ再構成し、旧Bundle統合へ分岐しない | 同じQueueの再入場で初回変更観測がなくても再送0。状態・取消・認証条件を維持 |
| Workbenchの共通単発Taskと活動Reader | 計画を捏造しない既存単発OwnerとSnapshotの投影を維持する。計画経路の切替を理由に別の受付・本文Storeを作らない | Repository／主体分離、再構成後の元ID観測・取消。単発成功を複数Taskの実AI成立へ流用しない |
| 旧Bundle／Store・別用途の候補・歴史Evidence | 今回は接続切替の成立範囲を確認。旧保存・回復参照の全数処置前に全面撤去しない | 実AI未確認を成功にせず、②保持物を清掃対象に含めない |

| 対象 | 済んだ範囲 | 残件 |
|---|---|---|
| ② 実AI編集E2E | 合成Git・有限代役の事前確認、固定Imageの無通信起動・三Mount、診断補完、通信失敗後の終了処置。今回の実試験は終了判断済み | Directの実AI編集・既存dirty／stage保全、Isolatedの実AI編集から明示固定・二親Merge・Worktree／Branch回収までの実境界成功は未成立。新しい実AI試行は別途許可を要する |
| 今回の回収 | 元失敗・unknown・exact回復参照と保持物を維持。停止Containerが遅れて残る可能性の許容を記録 | 回収自体は未完了。今回の試験終了とは独立し、再起動・強制削除・一般回復改修を他作業の前提にしない |
| ③ 計画のWorkspace接続・旧Bundle撤去 | 同じWorkspaceでTaskを順次実行する本番接続、初回／再入場の待ち結果、Direct／Isolated別の公開品質受入を既存Queue・採用記録へ接続。旧Bundle自動統合の呼出しを除去。外部AIなしの結合・関連回帰と限定独立レビューを完了 | 旧Bundle生成／統合／Store専用処理・公開参照・設定の全面撤去と移行確認、必要な実境界確認は別途残る |

次の推奨順序は、まず③の本番利用側・旧処理・成立済みCapabilityの対応を固定し、外部AIなしでWorkspace接続と複数Task・実保存・再入場・明示採用・品質受入の結合確認を進めることとする。旧処理は置換先・利用側・必要検証が揃った範囲だけ撤去し、別用途のDomain候補・採用判断・歴史Evidenceを削除しない。②の実AI再検証は必要な実境界条件を固定して別途人間の許可を得た後とし、今回の許容を再送許可へ読み替えない。最終的な③の完了は必要な実境界、移行、回帰・レビューとの対応まで確認し、有限代役の成功だけで旧処理全面置換又はRelease可能と表示しない。

#### ③の本番接続と外部AIなしの確認（2026-10-18）

計画の予約対象を一件ずつに限定し、既存の結果保存・回復・Lease終了を経て次Taskへ進む。公開Compositionから旧Bundle統合呼出しを除去し、初回と再入場とも保存済みQueueを用いてDirectの品質判断待ち／Isolatedの明示採用待ちを返す。`adoptResult:true`は新規受付・Task・採用Effect前に拒否する。旧Store又は初回だけの`workspaceResults`へのfallbackは追加しない。

Isolatedの品質判断と状態取得は、元計画Revision、Project／Milestone、同Queue／Workspace、既存の固定候補・採用結果、現在Merge HEADを照合する。過去の一次失敗を消さず、正常な同操作再入場後の現在の採用成立と分ける。候補Ref終了後も同じ既存結果記録で判断できる。DirectはGit採用を要求せず、Task完了・候補採用・品質受入を別操作として維持する。

| 確認 | 現在の結果・限界 |
|---|---|
| 静的確認・単体 | Orchestratorの書式・型・Lint、CoordinatorのSource／試験型と変更試験Lintは成功。Orchestrator単体76件成功。既存Lintの情報表示2件は警告と区別する |
| 本番Composition・Dispatcher | 関連結合58件成功。旧統合Adapter呼出し0、初回観測欠測の再入場でTask再送0、旧自動採用要求のEffect前拒否、取消・保存失敗・同じ回復参照の保持を含む |
| 実Git・実保存 | Orchestrator全結合38件成功。Direct／Isolated各二Taskの直列実行、前Task変更の継続、Git自動処置0を確認。Merge Commit拒否→同操作再入場成功→一次失敗保持→Ref終了→別Process公開品質受入も成功。追加したMerge後の元計画の状態取得は、同じ実Git結合一件を再実行して成功 |
| 利用側 | MCPの公開契約20件、Workbenchの主体／Repository分離・元ID観測／取消2件成功。外部AIは使わない |
| 独立確認 | 技術・品質及び限定文書／不足影響の指摘は是正済み。過去失敗からの正常採用、Commit IDの不正な中間長拒否を追加反証し、状態取得の追加接続も技術レビュー指摘0 |
| 文書Checker | 全体3,342件、対象を絞った展開範囲63件で非Pass。今回変更した3文書自体への指摘は0件。全体の未整合を今回の限定接続で解消したとは扱わない |

新しいStore・Registry・Lock・回復機構、外部AI送信、Docker操作は追加・実行していない。②の保持結果と両Runtime状態のHashは着手前と一致し、unknown・exact回復参照・物理保持を変更していない。旧Bundle／Store専用Source・公開参照・設定の全面撤去、移行処置及び実AI編集の成立は残る。今回の成功を②の失敗の解消、③全体完成又はRelease許可へ昇格しない。

#### 旧Bundle／Storeの撤去着手（基準`4e3719e8`）

利用者は上記の接続をCommit・Pushし、旧Bundle／Store全面撤去へ進むことを指示した。変更分類は既存の破壊的なWorkspace移行内の旧実装退役とする。Source・試験・配布入口・Architecture／Quality・移行案内を対象とし、②のAI再試行・保持物削除、外部AI、Docker操作、一般回復拡張は対象外である。

技術・品質の読取り専用着手前確認から、次の順に閉包を切り替える。固定候補の独立技術／品質レビューと限定文書／不足影響確認を行う。準拠表明・Releaseは変更せず、それらの全件監査は追加しない。

| 対象 | 撤去又は維持の処置 |
|---|---|
| Orchestrator旧統合 | 本番接続済みWorkspaceへ置換。旧Integration Adapterと未使用factory依存、旧Bundle用の公開統合・採用を退役させる |
| 既存結果保存 | Workspaceも使用する結果Record／Writerは保存Ownerへ移す。保存bytes・Hash・既存採用結果の意味を変えず、再export専用層は残さない |
| Coordinator | Bundle準備・複製・永続化・公開／破棄・専用GC／回復を撤去する。借用Treeの差分／Reviewer読取り、Host／Docker／Process回復、結果配送・取消を維持する |
| 公開入口 | 利用者はWorkspace指定必須を採用した。その意味は上位のCLI受付・Orchestratorによる選択／解決であり、CoordinatorへID検索・管理を追加することではない。未指定では開始せず、自動Direct化・旧Bundle fallbackをしない |
| Windows共通処理 | Candidate Store専用の観測・保護・排他だけを退役する。共通Worker、Console／Host／Provider／State排他は削除しない |
| 移行・根拠 | 実ユーザーの`AppData/Local/Qual-Lab/CRDD/CandidateStore`は読取りで現存・中身0件。Repositoryの現在状態と②保持状態に旧候補／Storeの非null参照・Bundle記録は0件。その他の保存物まで不存在とは主張せず、旧データはFront AIの確認・移行対象とする |

初回・取消・失敗・保存不明・同操作再入場・現在対象不一致・公開結果を検証し、旧入口の拒否と撤去したSymbol／Sourceの非到達も確認する。旧試験削除を成功件数へ加算せず、別用途のDomain候補、Workspace採否・品質Decision、歴史Evidenceと②保持物を変更しない。

#### 撤去前の責務再確認（2026-10-18）

利用者は「上位が作業対象を決め、Coordinatorは受け取って実行するだけ」を確認した。先の「CoordinatorのCLIでWorkspace指定必須」という説明は受付と実行の責務を混同していたため、[横断Architectureの引渡し契約](../../../06_Architecture/Details/orchestrator/03_Workspace.md#実行対象の引渡しとcliの責務2026-10-18人間確認済み)へ整理し直した。Workspaceの選択・ID解決・利用調停は上位、受領対象の安全検証・一回のExecutor／Reviewer調整はCoordinator、隔離・技術資源回収はDocker Isolationとする。

| 撤去の順序 | 対応する場所・守る条件 |
|---|---|
| 1. 入力と利用側の照合 | 通常CLI・Workbench・MCP→Orchestrator→Coordinatorを対象に、上位での対象解決と下位の安全確認を対応付ける。CoordinatorのWorkspace ID照会・配置再構築は上位へ移す対象とする |
| 2. 上位受付の接続 | 既存配布入口とOrchestratorの共通Task経路へ接続し、解決済み作業対象だけをCoordinatorへ渡す。新しいCLI専用Queue・Store・Resolver Frameworkを作らない |
| 3. 旧生成・保存の撤去 | 全入口の対象搬送を確認した後に、旧Bundle複製・生成・公開・破棄・Store・専用回復を撤去する。Review用差分読取りと現在のHost／Docker／Process回復は維持する |
| 4. 公開契約・移行・反証 | 不正／未指定拒否、対象差、取消と回収不明、元対象との相関、借用Tree保全、旧公開Symbol非到達を確認する。保存型の配置移管と保存データの意味変更を分ける |

この設計整理の時点では、中断時に一部適用された未使用factory依存の撤去22行を戻し、SourceはCommit`4e3719e8`と同じ状態としていた。以降の実装状況は次項で区別する。追加の人間判断は現在ない。

#### 対象搬送・実行接続の切替（2026-10-18、全面撤去は継続中）

| 境界 | 実施した変更と限定確認 |
|---|---|
| 通常CLI | 既存配布入口からOrchestratorの単発Ownerへ接続。閉じた共通要求と明示`workspaceId`を必須にし、省略・旧Bundle要求をAI開始前に拒否する。`null`は明示Directだけに用いる。下位CLIから上位を呼び戻さない |
| Coordinator | IDによるWorktree検索を撤去。上位が渡す実Path・Git共通実体・期待HEAD・保護Mountを照合する。通常実行からStore準備、Bundle永続化・公開・破棄を除去し、旧固定コピーへのfallbackを除去した |
| Orchestrator | 旧Integration Adapterとその未使用factory依存を撤去。Workspaceでも必要な結果Record／Portと契約定数は既存保存Ownerへ移し、保存bytes・Hashを変更しない |
| 取消・結果 | 単発Ownerの既存pendingを待つ入口と外部取消Signalを接続。最終出力はOwner終了・Signal解除後の一回だけ。受付後の待機・終了例外でも元requestIdを保持し、終了失敗を副次情報にする |
| 再入場 | 既存v4終了要約とReaderをWorkbench／CLIの固定二種へ接続。元consumer・上位操作ID・回復参照が一致し、現在操作・回復・配送が残らない場合だけ終了を確認する。旧相関欠測を補完しない |
| 試験 | 旧複製fixtureを、上位役が作成する自己生成Git Worktreeへ移行。変更範囲の事後観測とReviewer内容検査を分け、容量・リンク・改訂差・差替え・借用Tree保全を13件で確認。旧Store内容上限専用試験と旧Integration Adapter専用試験は退役し、成功件数へ加算しない |

限定接続の技術・品質レビュー指摘は是正後0件。CoordinatorのSource／試験型、Orchestrator型、変更Sourceの書式・Warningを失敗とするLint、実子Process／本番Composition結合18件、元IDを保持する実CLI例外試験と入力拒否2件、CLIの相関付き履歴確認が成功した。CLI取消・例外の追加を含むOrchestrator最新全回帰115件が成功した。MCP公開契約20件、Version Control利用側閉包12件、Domain保存利用側閉包4件、Platform非依存4件も成功。旧試験Catalog／Symbolの撤去参照は現行台帳から除き、歴史Evidenceは変更していない。全RepositoryのChecker又は新版実AI E2Eの成功へ昇格しない。

残る撤去対象は、旧Store本体と専用検証Tool／Native処理、旧Orchestratorの公開統合・採用API及びMCPの旧結果分岐、旧候補field／設定／移行案内の利用側閉包である。現時点で全面撤去済みとはしない。新しいRegistry・Store・Lock・回復Frameworkは追加していない。②のAI再試行・Docker操作・保持物削除は実施せず、保持結果と両Runtime状態の3 Hashは着手前と一致する。

#### 旧検証責務の置換と専用機構撤去の着手条件

変更分類は採用済みWorkspace移行内の破壊的な旧方式退役とし、基準は`4e3719e8`と前項の未Commit接続差分である。利用側・Architecture・Quality・Source・現行台帳を同じ切替単位で扱う。技術・品質の読取り専用着手前確認を統合し、次を維持条件とする。②の実AI再試行、Docker操作、保持物の移行・削除及び歴史Evidence変更は対象外である。

| 従来の確認責務 | 新方式の確認先・処置 | 未実測として残す境界 |
|---|---|---|
| Bundle exportの内容一致 | 上位が解決した実行Treeの固定Fileをbytes・末尾LF・Hash・変更Pathで確認する | 新版の実AI編集成立は②が未完了のまま |
| 実Executor／Reviewer・再修正 | 一般Task検証の実結果とWorkspace観測を結合し、Provider／最終Reviewと内容を別々に確認する | 模擬結果から実Provider成功を主張しない |
| Source・Base相関と四経路 | Source前後観測を維持し、各経路の自己生成Treeを分離する。Sourceと作業TreeのIdentityを混同しない | 実四経路は今回実行しない |
| 取消・親喪失・技術回収 | 既存の取消join・待機期限・元回復参照・後発通知と実Process試験を維持する。Workspace正常試験で代用しない | 実Container／親喪失E2Eの再実測は別途許可が必要 |
| Workspace／Ref回収 | 上位とVersion Controlの既存明示操作で確認し、Coordinatorの技術回収と分離する | 借用TreeをTask終了時に自動削除しない |
| 保存・排他 | 新Workspaceが使うResult Record／Port、bytes・Hash・Binding、冪等再入場、保存／解放失敗を維持する | 現行Schemaを名称だけで再符号化しない |
| Store固有方式 | staged／publish／export／discard、容量・TTL・GC、Store専用Native受付・回復を退役する | 他のOwnerへ同じStoreを再実装しない |
| 公開結果 | 旧Bundle Integration Envelopeは拒否し、Objective／Workspace結果と既存品質判断を維持する | 旧保存物の存在を空Storeだけで否定しない |

初回編集前に正常な新Workspace結果、旧Bundle shape、受領対象差、取消と完了の交差、結果・保存の観測不能を照合する。旧方式専用試験の退役は成功件数へ加算しない。共有試験はCase単位で維持し、固定候補には技術・品質の独立レビュー及び限定文書／不足影響確認を行う。今回、準拠表明・公開・Releaseを変更しないため、それらの全件監査は追加しない。

#### 旧公開API撤去と検証責務移管の途中結果（2026-10-18）

| 対象 | 現在の処置と確認 |
|---|---|
| 旧公開操作 | `candidate/adopt.ts`・`integrate.ts`・`operations.ts`・`integration-result.ts`を撤去し、Root公開一覧、MCPの旧Integration結果受理、現行Symbol／Catalog／設計Pathを追従した。既存保存の契約Identity・結果WriterはWorkspace用に維持する |
| 成果確認 | 新Workspace試験器へ実変更PathとWorkspace ID、実Byte・UTF-8・末尾LF・長さ・SHA-256の確認を接続。Byte反証は既存`ai-verification`試験へ統合し、改行差・別本文・未観測／過剰Pathを拒否する。模擬試験12件成功であり、②の実AI成功ではない |
| Source照合 | 既存Source observerの固定範囲を試験Root作成前と、Task待機・取消・Owner終了・試験物処置後に比較する。範囲・内容Hash・実体Hashの差又は再観測不能では成功終了しない。全Repository不変やGit履歴不変を意味しない |
| 共通結合 | 旧Bundle統合代役を外し、同一Workspaceの逐次実行、上位の明示品質受入、保存と段階的履歴整理、別Projectの解放証拠保全を既存実Portで確認した。変更対象の局所結合3件成功。旧拒否API専用Caseは退役し、架空のWorkspace拒否Recordを保存側へ追加しない |
| 回帰境界 | CoordinatorのSource／試験型、WorkbenchとMCPの型、変更SourceのWarningを失敗とするLint、設計トレース検査が成功。Repository横断命名試験ではDocker Isolationの既存設定名・公開一覧、Native試験Header等の不整合とsandboxのjunction拒否を観測し、全体Passとはしない |

全面撤去は未完了である。次の順序を維持し、未接続の検証責務を削除だけで閉じない。

1. `verify-signed-general-task.ts`のSource前後照合・四経路・取消join・終了不明・元回復参照を新Workspace成果の確認へ移す。現在のStore読取り／破棄参照はこの移管まで残っている。
2. 最後の利用側を移した後に、`src/candidate/bundle-store.ts`、専用試験・設定・候補fieldの利用側を撤去する。
3. Store専用の保護Root・Kernel Lock・Native受付を撤去する。共通WorkerとHost／Provider／Console／State排他は残す。

新Registry・Store・Lock・Recoveryは追加していない。外部AI、Docker操作、②の保持物処置は実施していない。旧Evidenceを変更せず、今回の局所確認を新版の実Provider E2E成立へ昇格しない。現在、人間による追加判断は必要ない。

是正後の限定技術・品質レビューは指摘0件。Orchestratorの現行全回帰105件、実Git Worktree・既存結果保存・本番組立ての結合回帰28件、MCP／公開値契約／Platform非依存33件が成功した。旧方式専用試験の退役を成功件数へ含めない。②の保持結果と両状態の3 Hashは着手前と一致する。Store本体・旧General Task検証・Native専用処理を残しているため、これらの確認から全面撤去又はRelease可能とは表示しない。

<a id="workspace-store-retirement"></a>

#### General Task検証移管・Store本体／専用Nativeの撤去（2026-10-18）

前項の撤去残件のうち、今回依頼された検証移管・Store本体・専用Native処理を完了した。基準は同じ`4e3719e8`とその後の未Commit差分であり、②の実AI編集成立や全体Release完成とは分ける。

| 対象 | 現在の処置 |
|---|---|
| General Task検証 | 上位Toolが既存Version Controlで独立Worktreeを生成し、解決済み対象だけをCoordinatorへ渡す。Source前後照合、四経路、取消ACK／元completionのjoin、遅延・重複通知、終了不明と元回復参照を維持。実Byte・LF・HashはStore exportでなく実Treeから確認する |
| 上位の領域終了 | 元UUIDはTask結果の任意fieldから復元しない。終端・技術回収・回復参照なし・元Workspace一致が確認できる場合だけ、自己生成WorktreeとBranchを既存Git操作で終了する。不明では元UUIDを保持してcleanup falseを返す。Task一次理由と領域終了失敗を別fieldへ分離する |
| Store本体 | `candidate/bundle-store.ts`と専用試験を削除。保存・公開・期限・GC・Store専用回復・専用排他の稼働経路は残さない。歴史保存fieldのnull検査や不正入力拒否を残すことは、Store稼働能力の維持ではない |
| Native・共通排他 | Store専用種別3と保護Root受付を削除し、実CLIで旧値3を拒否。Home種別1/2とRuntime State種別4、共通Worker・State／Host／Provider／Console排他を維持。共通試験・Fixtureは実責務名の`kernel-lock`へ移管した |
| Task状態と台帳 | StoreのSTAGED状態と専用資源を撤去し、正常Review後からHost回収へ直接接続。失敗時は元段階と技術回復参照を保持。Architecture、現行Symbol、Catalogと機械Traceを同期する |
| 入力・診断保存 | 入力所有のAST検査を実Orchestrator受付へ移し、専用ReaderのSymbol・単一呼出し・直接stdin禁止を維持。既存検証記録rev5に元Workspace UUID・回収確認・固定保持理由だけを加え、処置Authorityや新Stateを作らない |

技術・品質の独立レビューは、回収前の終了条件、結果欠測時の元対象保持、一次失敗分離の是正後に残指摘0件。実Git試験では元dirty／HEADの保全、内容一致、終了不明・別ID・回復参照等での処置拒否、正式終了後の登録・専用Branch・Directory不存在を確認した。

限定確認は、Task状態・取消・技術回収153件、General／Route／Reviewer／Recovery／結果記録／対話境界119件、共通Lock実Process27件、Native単体47件・CLI結合8件、Artifact／本番Native Adapter135件が成功した。記録投影と入力検査の最終再確認45件も成功。旧Store専用試験の削除を成功件数へ加算していない。機械Traceは8資源・17状態・18遷移の対応を受理した。Coordinator Source／試験型、Orchestrator・MCP・Workbench型と変更Sourceの書式・Warningを失敗とするLintを確認する。

再生成入口はCoordinator packageの`tests/integration/coordinator-task-runtime.contract.test.ts`、`repository-workspace-runtime.contract.test.ts`、`kernel-lock.contract.test.ts`、`development-native-observation.integration.test.ts`、上記`tests/system/*verification.contract.test.ts`と`verification-result-record.contract.test.ts`、`interaction-boundary-regression.contract.test.ts`。Nativeは固定toolchain・明示`x86_64-pc-windows-msvc` targetのCargo test／clippy／release buildを用いる。生出力は一時生成物として恒久書庫へ複製せず、再実行可能なSource・試験とこの限定結論を残す。対象は未Commit差分を含み、HEADだけを実測対象とは表示しない。

Nativeの現行配布実体は再ビルド後SHA-256 `ce265feabf5ef08aa0ab103078746fc40941db4fdf2d100eb7316711a4f6fddc`で、template実物とBootstrapの固定期待値を一致させた。署名Gateは追加していない。

外部AI・Docker操作、②の再試行・保持物削除は実施していない。保持結果・Coordinator state・Orchestrator stateの3 Hashは既存記録と一致した。旧AppData領域の物理清掃も今回行わない。新版の実AI編集E2Eと保持中unknownの処置は、元回復参照を維持して別途人間判断へ残す。全RepositoryのCheckerやReleaseをPassとは表示しない。現在、この撤去作業に追加の人間判断は必要ない。

#### ②・③の現在残件と再開順序

| 区分 | 現在の残件 | 再開条件・順序 |
|---|---|---|
| ③のSource切替・撤去 | 本番Workspace接続、旧Bundle／Store・専用Native・未使用CLI解析の撤去は完了。旧全null保存fieldの防御や歴史Evidenceは稼働旧経路と区別して維持 | 本区切りをCommit固定する。旧方式の管理機構を復元しない |
| ③の最終成立確認 | 新構成全体の回帰・必要な実境界と実データ移行の最終評価。局所結果を全体Passへ換算しない | 固定Commitで外部AIなしの全体回帰を先行し、現行Source／設定／案内の残存参照を分類。旧データの物理処置は承認を得た範囲だけ |
| ②の実AI編集 | Directの実編集・dirty／stage保全、Isolatedの実編集・明示固定・二親Merge・領域回収の成功は未成立 | ③の固定候補と送信範囲・回数・停止条件を確定し、別途人間承認を得て再試行する。今回のCommit／Push許可を送信許可へ読み替えない |
| 失敗試験の保持物 | 同じ回復参照でunknownと回収未完了を保持 | ②／③と独立した処置。今回削除せず、再評価・回収の許可があったときだけ既存経路で扱う |

推奨順序は、Commit／Pushによる区切り→固定候補の外部AIなし全体回帰と残存参照確認→②の限定実AI再試行の承認確認→実境界結果を③の最終評価へ接続、である。保持物の強制清掃や新しいRecovery機構を、次の作業の前提にしない。
