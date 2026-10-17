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
