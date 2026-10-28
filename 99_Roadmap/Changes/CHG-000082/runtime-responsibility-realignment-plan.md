# 基盤機能中心のRuntime責務再編計画

- 対象: CRDD v0.22 / CHG-000082
- 状態: A〜GのSource移管・公開接続と対象非AI確認は限定完了。全体回帰の不合格と是正後の限定成功は区別する。Hの実AI／Docker、人間操作、実データ移行は未実施。
- 基準: `5dae7108436205ecf7804d7898b1aecc2e8ce85b`
- 入力: 人間提示「Runtime Responsibility Realignment」。同文書の確認HEAD `81d9647a4`と旧Source名は基準当時の参照であり、旧構造を復活させない。
- 責任者: Qual-Lab
- 対象外: AI再送、Docker操作、既存Runtime領域・保持物の読取り／変更／削除、Release判断。

## 1. 何を変えるか

### 文書管理と実行管理の分担（人間確認済み）

CRDD文書群がMilestone／Roadmap／WBS・正式判断・Evidenceの正本であり、フロントAI等のCallerが読んで小・中規模の実行Taskへ分解しCoordinatorへ渡す。Coordinatorは渡された範囲を実行・調整して結果を返す。文書処理が必要な場合もCallerが明示Taskとして渡し、文書とRuntime状態の自動同期機能は追加しない。[用途・現行との差](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#document-and-execution-ownership)を設計正本とする。

本計画のDomain移管対象であるPlan／Objective／Milestoneは実行依頼の値・局所状態で、文書側の業務計画の第二正本ではない。既存ObjectiveはTask群の受入、Milestoneは同じ実行依頼全体の受入・判断待ち・回復の集約に使われる。既存名・IDを理由に文書項目と同一視したり、今回削除・一括改名したりしない。

基準版の公開構成は依頼を1 Objective＋1 Taskへ機械変換していた。今回、Callerが分解した複数Task Graphと個別入力を受け取るSourceへ切り替えた。Domain検査・Coordinatorの本番搬送・MCP Schemaを接続し、文書解析Planner・自動WBS生成・再計画Frameworkは追加しない。実AIの成立とは区別する。

人間と外部AIが文書・目的・仕事・判断を共有する基本機能（CRDD Core）を、自動実行の成立条件から独立させる。自動実行機能（Optional Automation）は削除せず、同じ業務モデルを利用する任意の追加機能とする。

直前のStorage再編は同一Coordinator内の論理Ownerを分けたもので、Core独立を成立させたものではない。本計画はその成果を出発点に、Package間の責務・公開契約・保存境界を見直す。旧Orchestratorの独立Process・Queue・同期管理は再導入しない。

| Owner | 目標責務 | 引き取らない責務 |
|---|---|---|
| Domain Model | Entity、局所状態遷移、Query／CRUD、設定、共有保存 | Scheduling、Dispatch、Provider実行、実行許可の独自発行 |
| Coordinator | 計画の実行受付、Task選択、Domain横断調停、Retry／Recovery調停 | Domain正本の複製、共通保存実装、単一試行の技術実装 |
| Executor | 単一Attempt、取消・期限、Effect観測、終了・結果・回復根拠の調整 | bin、常駐Server、独立Queue／Scheduler／Domain Store、計画全体の進行 |
| AI Adapter | Provider／Model Catalog、CLI・入出力・認証差の吸収 | Domain状態、Docker技術実装 |
| Docker Isolation／Platform Access | 既存の隔離・資源回収／OS境界 | 目的・仕事・採用判断 |
| MCP／Workbench | 共通Domain APIへのAI／人間向け入口、任意の自動実行接続 | Domainの重複実装、共通Gateway |

「Core」は論理的な基盤機能の呼称であり、新しい`core` PackageやDirectoryを作る指示ではない。

## 2. 初回棚卸しで確認したこと

静的な相対参照文字列`coordinator/src`を`src/**/*.ts(x)`から検索した。型参照と実行値参照を含む直接参照File数であり、推移的依存や実行時の独立成立を証明しない。

| Package | 直接参照File数 | 現在の処置 |
|---|---:|---|
| domain-model | 0 | 既存の中立的な保存・Context責務を土台にする。新移管で逆依存を作らない |
| ai-adapter | 0 | 技術Catalogと実行仕様のOwnerを維持する |
| mcp-server | 4 | Task・Workspace・実行状況と認証時の構成を分けて追跡する |
| workbench-server | 15 | 設定読取り、型、表示、Workspace、AI依頼をCore／任意実行へ分類する |

`executor` Packageはまだ存在しない。Domain Modelにも、添付で挙げたObjective／Task／Attempt／Queue／AI Selectionの各責務Folderはまだない。完成構造として空FolderやFile一式を先に作らない。

| 現行Source／利用側 | 現在確認できる責務 | 移管・評価先 |
|---|---|---|
| Coordinator `selection/types.ts`・`validation.ts`・`resolve.ts` | 設定Schemaと選定値・技術照合が同居 | 設定Schema／純粋解決はDomain、実行時BindingはCoordinator／Executorへ分解 |
| Coordinator `storage/ai-selection.ts` | 固定configのCAS保存。AI AdapterのJSON解析と選定検査も使用 | Domainの設定保存へ。構文解析、Catalog照合、実行許可を別に対応付ける |
| Coordinator `objective/`・`task/`・`decision/` | 業務値・局所遷移と実行調停 | 宣言単位でDomainとCoordinatorへ分類。Folder丸ごと移管しない |
| Coordinator `workspace/` | 論理値・保存操作・Git実操作の調整 | Domainの論理状態、Version ControlのGit、Coordinatorの実行調停を分離 |
| Coordinator `storage/state.ts`・`state/transition.ts`等 | 単一Snapshot、区画相関、物理出版と状態判断 | 共有保存と意味Ownerの接続を詳細設計。単純なWriter移動は禁止 |
| Coordinator `execution/settlement.ts`・`execution/lease.ts` | 元Ownerの真正証拠、一回使用、長期実行排他 | Executor／Coordinatorの実資源Ownerへ。Domain Entityへ真正Mapを移植しない |
| MCP `request/authentication.ts` | Domain CRUDを構成する際、Coordinatorの活動Readerも静的import | Core認可と任意実行の構成を分離 |
| MCP `request/server.ts`・`tools/task.ts`等 | Coordinator依存は注入上任意だが、Tool moduleを静的に構成 | Coordinatorが読込み不能な構成でCore起動を試験する |
| Workbench `server/routes/repository-view.ts` | 表示GETからCoordinatorのAI選択／通信設定をimport | Core設定APIへ直接接続 |
| Workbench `server/ai-selection/projection.ts` | AI Adapter CatalogとCoordinator設定Readerを合成 | CatalogはAI Adapter、設定はDomainから読む |
| Workbench `server/ai-request/`・AI依頼Panel | 読取り助言とWorkspace編集。会話履歴複製ではない | 「AI Chat非搭載」だけを理由に削除しない。機能対応と存続判断を先に確認 |

宣言索引・73項目のRoot API・直接利用側と、Domain／共通保存の具体案を[棚卸しとAfter案](runtime-domain-storage-after.md)へ整理した。74 File・1,668トップレベル宣言は構文索引であり、全実行閉包・真正証拠の移管確認を意味しない。上表だけで旧処理を不要・置換済みとしない。`storage`の5 Fileは直前再編の完了条件であり、移管先Package全体へ機械的に同じFile数を要求しない。

## 3. 先に固定する保存・状態契約

1. Core操作ごとに「更新する区画」「保全するAutomation区画」「同じCASへ含める相関」を定義する。Core CRUDにProvider認証やExecution起動を要求せず、既存Operation／Recoveryを空で上書きしない。
2. Entityの意味・局所遷移と、Cross-Domain調停を分ける。最新Snapshotに対する短期排他・再検査の位置を維持し、古い読取り値から保存を確定しない。
3. 共通の保存契約と、Executorが証明する事実を分ける。保存成功をAuthority・資源不存在・cleanupの証明にしない。元Controller／Hostのobject同一性、一回使用・初期化・出版順序の証拠を単なるEntityへ変換しない。
4. `state.json`は原則単一のまま。`queue.json`、独立Writer、共通Registry、Lock Framework、常駐Workerは追加しない。長いAI実行中は保存Lockを保持しない。
5. CoreとAutomationの型を分けても、Entity・Plan・判断の正本を複製しない。外部AI実行の報告からCRDD管理下のEffect／cleanupを推定しない。

| 代表例 | 必要な結果 |
|---|---|
| 自動実行を使わない新規Repository | Objective／Task／DecisionのCRUD・保存・再読がCoordinatorなしで成立 |
| 未解決Automation区画のあるSnapshotへ許可されたCore更新 | 当該区画と相関を保全し、実行再開やRecovery成功を自動生成しない |
| Core更新とQueue Claimが競合 | 同じCASで片方が競合として停止。別Storeへ分割して両方成功としない |
| 旧領域に未解決情報、新領域は不存在 | 空の新品状態へ切り替えない |
| Owner・履歴・pending・旧新対応が不明 | 移行・実行を止め、unknownと元参照を保持 |

## 4. 実施順序と出口

Callerの分解済みTask群の[公開受付契約](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#caller-task-graph-intake)をSourceへ接続した。PlanだけでなくTask別の既存実行入力を1対1で渡し、受付Hash二箇所へ固定する。Graph Server・本文Store・互換Wrapper、Task属性・文書同期・計画UIは増やさない。実行Snapshotと一般CRUDの移管は別に残る。

| 段階 | 作業 | 完了条件／主な確認 |
|---|---|---|
| A | 依存と既存能力の全棚卸し | Source宣言・Root API・利用側・旧Verificationを、移管／据置／撤去候補へ対応付ける |
| B | Domain Entity／Query／CRUDとAI Selectionの詳細設計 | 添付§5.3の十観点を各Domainで保持。Plan・Task Graph・Attempt・判断と実行状態を区別し、物理Afterと公開APIを提示 |
| C | 共有保存の詳細設計・Source移管 | 区画更新／保全と相関不変条件、短期Lock／CAS、保存途中再入場、真正証拠のOwnerを確定。DomainからCoordinator／Executorへ依存しない |
| D | Domain API実装とMCP／WorkbenchのCore接続 | Coordinatorを読込み不能にした構成で起動・CRUD・保存・再読取り。既存Automation区画を含む保全例も検査 |
| E | Runtime保存先の切替 | `.crdd/domain-model/`を第一候補として正本へ照合。state／history／pending／lockを一組で扱い、フロントAI移行手順と切戻し条件を確定してから有効化 |
| F | Executor Library境界の実装 | 最小のAttempt入力・結果・取消・終了・回復契約。Coordinator SnapshotやQueue Entryを丸ごと渡さない。Docker技術は既存Ownerを利用 |
| G | CoordinatorのOptional化 | 共通Domain APIとExecutorだけで調停。Domainの重複実装・不要Adapterを撤去し、Fake Executorで順序・Retry・Owner喪失・取消を確認 |
| H | 独立実境界と結合 | まずExecutor単独、次にCoordinator結合。実AI／Docker／人間操作は送信範囲・回数・回収を別途承認してから実行 |

A〜CはCoreのAPI成立に必要な保存境界を先に確定する依存順である。MCP／Workbenchの変更は、読取りを単に動的importへ変えるだけでは完了しない。Dの非AI成立を、F〜Hの自動実行完成待ちにしない。

機械的移管と意味変更を別差分にする。段階ごとの固定候補で回帰・独立レビューを行い、未接続Capabilityがある間は旧Ownerを削除しない。新しい常駐ProcessやPackage間ACKを途中構造として追加しない。

## 5. Runtime移行と既存方針の扱い

- 製品コードは新形式だけを扱い、旧形式移行はフロントAIの確認手順とする従来判断を維持する。添付§8.5の保全条件は、その手順と実行時の新領域有効化条件へ具体化する。自動Migration／互換読取りFrameworkを追加しない。
- `.crdd/domain-model/`は2026-10-28に人間が採用した。Sourceの新配置への接続と、実データの移行・有効化を区別する。旧新競合、中断、現在Owner、未解決Recovery、履歴・pendingの整合、有効化、旧領域退役を別Gateで確認する。今回の保持領域を調査・試験に使わない。
- `.crdd/config/ai-selection.json`は維持する。Catalogの内容はAI Adapter、設定の意味はDomain、現在の実行許可はCoordinator／Executorとする。
- 添付の`.crdd`直下禁止は今回のRuntime Fileへ適用する。文書化正本にある`external-send-policy.json`の既存例外は無断で撤去・一般変更しない。
- Core／Optionalの区別は新しいServer製品や分散Systemではない。同Process内の関数呼出しで成立する境界へIPC、Queue、Registryを追加しない。
- 既存助言とWorkspace編集の存続／任意機能化／撤去は、Workbenchの現在能力と要求への影響を整理して確認する。計画作成を止める判断ではないが、機能撤去前の判断である。

## 6. 設計・品質の正本と検証

| 更新する正本／利用側 | 予定処置 |
|---|---|
| Architecture基本設計・Component／Interface／Data Flow／Failure／Deployment | Core／Optionalの責務、依存、実行主体、状態・結果・Authorityの流れを更新 |
| Domain Model詳細・保存詳細 | Entityごとの十観点、Source対応表、保存相関、移行条件 |
| Coordinator詳細・Task詳細・Workspace | 共通Domainを参照し、調停と単一試行の境界を再定義 |
| Executor詳細 | 実Ownerから切り出す能力・入力／出力・取消／終了と回復根拠の設計。空の一般Frameworkを作らない |
| MCP／Workbench詳細・公開API・試験・配布入口 | 同じDomain APIへ接続。任意実行未導入と故障・欠測を区別 |
| Quality定義・設計・Trace・現在状態 | 添付AC-001〜027を正本の義務・具体項目へ対応付け、未評価をPassにしない |

検証はL1（Domain／保存・非AI）、L2（Core＋MCP／Workbench・非AI）、L4（Coordinator＋Fake Executor・非AI）を先に独立させる。L3（Executor＋実AI）とL5（全結合実AI）は別の実行許可を得るまで実施しない。L1／L2の完成をL5の未完了へ従属させず、L1／L2成功からL5を成功ともしない。

変更分類は複数Package・公開契約・保存先へ影響するArchitecture再編。今回は計画・調査だけでRuntimeの意味を変更しない。着手前確認では現在の単一保存、Core CRUDによるAutomation保全、真正証拠の扱い、AI Selection依存、Path切替の別Gateを読取り専用の確認者と照合し、計画へ統合した。

実装候補には専門独立レビュー、文書の参照確認、複数正本・移行・利用側の不足影響確認を適用する。準拠基準・Release判断は変更しないため、その採用・Release監査を今発火させない。計画作成の着手可をArchitecture採用、Source移管安全性、全体品質のPassへ流用しない。

比較した案は、現状維持、Core独立だけを動的importで装う案、本計画の共通Domain＋任意調停である。前二案は、共通CRUDの正本や保存相関をCoordinatorから分離できないため目的を満たさない。独立Process化も保存同期と復旧を増やすため採らない。

## 7. 現在の未確定事項と次作業

### D〜G再開時の接続確認 — 2026-10-28

基準`31aaccf37`から、D（Core公開接続）・E（保存先切替）・F（Executor境界）・G（任意調停化）を再開する。実AI・Docker照会／操作・過去保持物の読取り又は変更は対象外。共有Writerの移管完了と、これら四段階の成立を区別する。

| 段階 | 現在確認した不足と処置 | 変更してはならないもの／検証 |
|---|---|---|
| D | MCPのTool群とWorkbenchの活動・Workspace・通信設定RouteがCoordinatorへ静的到達する。CoreのDomain操作と任意実行の構成を分離し、一般CRUDの現在認可を接続する | Coordinator読込み拒否の実子Processで起動・CRUD・保存・再読取りを確認。Automation区画の全文保全、失効・CAS・対象参照拒否を維持 |
| E | `.crdd/domain-model/`は2026-10-28に承認済み。state／history／pending／短期lockを一組にする移行・切戻し手順を固定する | 実保持物を移動しない。旧新競合・未解決Owner／Recovery・観測不能で空初期化しない。自動互換読取りを作らない |
| F | Provider単段を一Attemptとする案を提示。編集→レビュー→是正の順序判断はCoordinatorへ残す | ExecutorへSnapshot・Queue・Lease・再試行方針を丸ごと渡さない。取消／join・unknown・exact回復参照を維持 |
| G | Dの実読込み閉包とFの契約を確定してから、既存調停をDomain＋Executorへ接続する | Fakeでも実際と同じ開始・取消・完了契約を使用。Domainとの二重状態・保存・新Registryを増やさない |

人間確認は、保存先、Executorの粒度、Core編集の既存内容権限への対応とローカル操作主体である。2026-10-28に後二点は承認された。ExecutorはProvider単段を一試行とし、編集→レビュー→是正の順序・Queue・再試行判断はCoordinatorに残す。Core定義編集は既存development内容権限へ対応し、ローカルWorkbenchは既存入口保護の下で起動Host利用者の操作として扱う。Browser接続元のOS本人証明や新しい認証・権限設定を追加しない。保存先も続く人間のOKにより`.crdd/domain-model/`へ確定した。Source切替と実データの移行許可は区別し、実保持物は操作しない。技術的なTool名やFile配置だけを理由に新たな承認段階を増やさない。既存の助言・編集・Workspace操作は任意機能として保全し、Core独立のために無断撤去しない。

判断不要な最初の差分として、`inspectAiSelectionChoice`／`hashExecutionSelection`をDomainの`ai-selection/validation.ts`へ集約した。型はDomainの既存`AiSelectionChoice`で閉じ、AI Adapterへの逆依存を追加しない。Coordinatorの旧File・Root再exportを撤去し、Workbenchの明示選択検査・内部利用側・Symbol・試験Oracleを直接接続した。Network PolicyのDocker構成やAuthorityは移していない。これはDの部分接続であり、Core全体の単独成立ではない。

局所四Suiteは26件成功。最初の新規Hash試験は合成Model名の転記不一致で二成功・一不合格となり、基準の`historical-model`へfixtureを一致させてから上記四Suiteを確認した。既存Hash期待値・拒否条件は変更していない。追加の利用側六Suiteは79件成功、Domain／Coordinator／Workbenchの型検査も成功した。独立レビューのMinor一件（新UTの台帳登録漏れ）を是正し、新UT三件再成功・Catalog409件valid・限定再レビュー残指摘零。変更した三文書の指摘は零で、参照展開先にはbroken-link 263件が残る。展開範囲は前段の文書検査と異なり、全体文書QAの合格又は263件の新旧全件照合を主張しない。変更Sourceの整形・Lintは警告／Error零（既存の情報診断三件）、diff check成功。今回の純粋検査移管だけを閉じ、D〜G全体完了は未宣言。人間確認は保存先一件だけが回答待ちである。

#### Dの公開Root独立とWorkbench接続

`281a324b3`後の候補では、公開入力・観測の純粋型／検査をDomainの意味Ownerへ移し、Scheduler・投影生成・実行AuthorityはCoordinatorへ残した。同期MCP Inspectorと既存公開名は同じDomain実体を利用する。MCPの任意Workspace／活動Reader、Workbenchの任意活動／Workspace／通信設定Readerは使用時だけ固定Ownerを読み込み、待機後の取消・認可・Rootを再照合する。汎用loader、Registry、Queueは追加しない。

Workbenchへ`GET/POST /api/runtime-definition`を接続した。既存Origin・Action Token・共有development権限又は起動Hostのローカル操作主体を使い、Domainの初期化・Plan保存・Objective／Task CRUD・Queryへ直接配送する。新しい計画UI、文書同期、実行権限は作らない。既定binはCoreだけを起動し、旧来のAI利用を続ける起動設定にはフロントAIが`--automation`を追記する。Library利用側の明示AI注入は維持する。

Coordinator／ExecutorのModule解決を拒否した子Processで、MCP Rootの本番FactoryとWorkbench Rootの実HTTPから保存・再読取り・CASを確認した。Workbenchは3MiB超の合法Planも同じ16MiB Writer制限内で保存し、Form搬送上限を超える宣言は拒否して全文不変を確認した。待機中失効・取消・切断は当該Source区間の有限代役でReader零を確認し、実HTTP正常経路の成立と区別した。bin構成も実entryを使い、既定Core／明示Automation／不正引数を確認した。

先行MCP全回帰は105件成功。Workbench先行全回帰は110件中107成功・3不合格、Domain先行全回帰も不合格だった。後者の公開API期待一覧二件、Workbenchの型import位置を誤読する検査、期限超過した固定日付の合成Event、検証Script切出し旧位置を追従し、対象別の再確認は成功した。製品の保持期間・安全判定・Timeoutは緩和していない。最新Workbench独立接続Suiteは3件成功。独立再レビューは先行のBody上限・待機後認可・bin試験の指摘を解消し、追加Source指摘零。対象全回帰は更新候補で再実行中であり、先行失敗を成功へ書き換えない。

更新候補のDomain全回帰は468件成功・不合格零、Workbench全回帰は111件成功・不合格零で終了した。Coordinatorの公開値・実状態投影・依存境界の関連34件と、Domain／Workbench／MCPの静的checkも成功。文書検査は今回の正本・計画・Context七文書に指摘零、参照展開先の過去リンク等3,367件は不合格のまま保持する。過去Evidenceは修正しない。

その後、配布MCP Launcherに残ったCoordinator静的参照を検出した。Node版本検査を現在Processの既存下限確認へ閉じ、単体`--automation`明示時だけ四操作を固定Moduleから構成する。既定local stdio／HTTPへ既存Workspace対象解決を使うCore RuntimeAccessを接続し、Manifest・Root・取消・projectId／repositoryIdを要求ごとに再確認する。CROSは既存AM認可を維持し、未接続のCROS＋Automationを64で拒否する。Module解決拒否下の実配布入口でも保存・再読取り・CASが成功した。入口変更後のMCP全回帰も105件成功・不合格零・取消零で終了し、stdioの実CRUD、HTTPの実ListenerとTool一覧、対象ID不一致、Node版、Owner欠測と不正引数拒否を確認した。追加独立レビューのSource指摘は零。自動実行有効時の実AI成立をこの非AI回帰から推定しない。

Catalogは411件の登録整合を確認したが、411件の試験成功を意味しない。このD検証時点では保存先Eは回答待ちで既存配置を維持していた。続くEの採用・検証は下節に示す。FのProvider単段Executor抽出とGの本番調停接続は別の未完了作業である。Fの着手前照合では、単段準備・Process／取消・join・結果・元回復証拠を一体で移し、Task全体の順序・Workspace・共通Host清掃をCoordinatorへ残す必要を確認した。現在混在するControlRecordを丸ごと渡す移管、証拠Mapの二重登録、ExecutorからCoordinator内部を参照する暫定接続は採らない。実AI・Docker・過去保持物を操作していない。



#### Eの保存先採用とSource切替 — 2026-10-28

人間の「OK」により共通保存先を`.crdd/domain-model/`へ統一する。Sourceの名前付き領域とPath fieldを`domain-model`／`domainModel`へ切り替え、Reader・Writer・history・Queue／Lease・公開入口・検証Scriptと合成試験を追従する。旧aliasは追加しない。Schema・CAS・Hash domain・Kernel Pipe名・真正Mapと一回使用証拠は変えない。`.crdd/config/coordinator.json`とその保持値も維持する。

着手前照合では、公開初期化へフロントAI手順だけを要求しても旧領域のある空初期化を防げないことを確認した。固定旧Pathのmetadata不存在だけを作成前・初回出版境界で検査し、ENOENT以外は拒否する最小処置を採用した。これは旧内容・旧SchemaのReader又は探索ではなく、自動移行・移動・削除も行わない。旧領域のDirectory／File／junction／観測不能、親置換、保存直前の後発出現と、新正本存在時の旧残置を区別した。新しい台帳・State・Lock Frameworkはない。

合成8件は成功。初回はQueryへ余分なexpectedAbsenceを渡したfixture不備、後続では保存Source試験の新private guard依存の追従漏れを検出し、拒否条件を緩めず是正した。全回帰・利用側結合・独立レビューは進行中であり、E完了とはまだ表示しない。[フロントAI移行・切戻し](../../../19_Workflows/01_Coordinator_Runtime.md#runtime-domain-storage-migration)を整備し、新書込み後の単純切戻しを禁止した。templateの共通状態placeholderは真正不存在の初期化と矛盾するため撤去し、初期化時だけ作成する。実保持物と旧実データは操作していない。

その後、Domain全回帰一実行474件とCoordinator／MCP／Workbenchの関連結合49件が全成功した。全回帰後に追加した親置換・出版直前出現を含む限定matrix八件、初回出版失敗とCore CRUD四件も別実行で成功した。これらを476件の単一runへ合算しない。制限環境でjunction作成がEPERMとなった一実行は不合格として区別し、通常実行環境では同じ八件が成功した。型検査で検出した試験mockのundefined対応も修正後に確認した。Domain／Coordinator／MCP／Workbenchの静的check、Catalog411登録整合、diff checkを通過した。

独立レビューの現行設計旧配置一件と、出版中断時のmarker／pending保持Oracle不足一件を是正した。同じmarker schema／Bindingでpendingを正規decodeし、再呼出し時の両bytes不変・正本不存在を確認した。限定再レビュー残指摘零。Domain05後段の旧配置維持記述も、当初時点と現在採用後を分けて同期した。EのSource切替・合成検証・移行手順は限定完了とするが、実データ移行・切戻し実行・過去保持物・F／G・実AI／Dockerの成立を含めない。

変更対象九文書の検査指摘は零。参照展開先にはbroken-link／anchor等3,374件が残り、全体文書検査はexit 1である。前段とは対象正本・展開先集合が異なるため、3,367件との差分を今回の新規故障数と断定せず、全体QA合格も主張しない。

Dの今回の非AI公開接続候補は、基準`281a324b3`と`40_Develop`／`template/tools`のtracked差分及び新規File本文を結合したSHA-256 `2a4134f5acb5ca208e118755a37228cda8e35a58317b72a31521a1a658dfe328`で特定する。独立最終確認の旧時点文書表現一件を時点限定へ是正し、MCPの同種表現も追従した。Source契約の追加指摘は零。Dの今回範囲は限定完了とし、Eの保存先判断、F／G、実AI／Docker、人間操作、CRDD全体QA又はRelease完了へ拡張しない。

#### Fの単段移管に対する着手前照合

続くSource実装では、Provider単段の準備・計画・Process開始／取消／join・結果正規化と通知／終端Mapを`40_Develop/executor`へ宣言単位で移管した。[Executor詳細](../../../06_Architecture/Details/executor/01_Architecture.md)を正式な境界の正本とする。Coordinatorには選定・送信同意・Task段階順序・Workspace・共通Host清掃と保存を残し、`execution/provider-executor.ts`の固定一実体へ接続した。DomainのCAS・Schema・Hash領域・Kernel・保存先を変更せず、新Registry／State／Worker／Lockを追加していない。

既存の準備Mapとcontrols、通知・終端の私有Mapはそれぞれ元Owner単位で一実体とし、三保存利用側は同じ本番Verifierへ直接接続する。通知登録→同期保存→finally失効、元result借用を保持し、Mapや生WriterをRootへ公開しない。本番Factoryは固定Docker Isolation、試験候補は別Map・本番Authorityなしとする。Module初期化の相互参照は同じSingletonへの関数宣言で束縛し、実行中の遅延Loaderを追加しない。

先行関連324件と独立Root／Map／準備の五件は成功した。独立レビューでは保存・回復試験の旧mock先一群を検出し、新しいVerifier Ownerへ追従した。型契約の同形二宣言もExecutor側へ一本化した。CatalogとSymbolは実移管先へ接続し、歴史的Evidenceは変更しない。AI・Docker照会／操作・認証情報・過去保持物の操作はない。

固定Sourceは基準`f7326f45e4f9e2c7f62de849fc68f55ae4e50afc`、tracked `40_Develop`差分と新規18FileのPath・NUL・本文を順に連結したSHA-256 `148b47293f01603e49e7c40534e1ae129bfdae1876f133d7897b0ea2972b3f96`で特定する。Executorの五件はCoordinator解決拒否、準備Map分離、同期通知失効、元結果と別Owner拒否、同じOracleによる旧Path変異拒否を確認した。最新通常Windowsの関連324件、MCP105件、Workbench111件の各全実行は別々に成功した。制限環境の同関連試験では実子Process取消が終了不明で失敗し、通常環境で324件全成功した結果と区別する。

Windows保存の先行六Caseは四成功・二不合格。終端と清掃の代役が移管後に同一Moduleとなり二重mockした一件は、終端区間後のrestoreで是正し、子Caseを含む二件が再成功した。正常Owner一回・保持あり・二回は先行成功、三回＋HTTPの15秒超過は単独実行で同じ期限のまま成功した。単独時のHTTP応答は約10.4秒。並行実行負荷が原因だったと断定せず、期限とOracleは変更しない。旧Path変異の検査も同じ検証関数へ正常／変異本文を渡す形へ補強し、独立再レビューは残指摘零。

Catalog414件valid、関連台帳二十八件成功、変更対象文書のChecker指摘零。Repository全体Checkerは別範囲の3,723指摘によりexit 1で、全体QA成功ではない。Domain広域では台帳期待集合の追従一件と子Process競合二件を検出した。前者は新Ownerをexact集合へ追加し、後二件は同じ期限で単独再成功した。全体の先行不合格を取り消さず、固定候補のDomain／Coordinator広域回帰終端は継続確認する。Source限定Passとこれらの未確定結果を区別する。

Domainの後続固定全実行は476件中475成功・一不合格・取消零だった。Topic／Meeting協調Writerの後続更新でWindows `rename` がEPERMを返した。同CaseとKernel競合の単独二件は成功し、さらに同保存Suite九件の単独実行では協調Writerが成功した一方、別の読戻し反例が同じrename拒否で不合格だった。拒否を許容するOracle、製品の再試行、期限変更は追加しない。失敗時の元syscall・source/destinationと自己生成Rootは試験結果で特定し、既存保持物は調べていない。

独立したSource確認で、このStoreと同Suiteは基準版から差分零、今回のDomain製品差分は台帳検査だけであり、Executor抽出から当該保存への依存経路はなかった。temporary descriptorのclose後rename、両子Processのclose／join後更新、各故障注入のfinally復元も確認した。原因をOSやAVへ断定せず、F／Gとは独立した既存Windows保存境界の未解消観測として分離する。担当責任者はQual-Lab、再評価契機はDomain保存境界の是正又は同じ固定SourceのWindows再現確認。保留中はDomain広域全成功・全体QA成立を主張できないが、現在のF／G移管の追加Source変更や危険な許容緩和を要しない。Source限定の完成と全体QAを分ける。

Coordinatorの固定全回帰は終了値1で終了した。保持した末尾診断は、新しいExecutorを未署名配布fixtureの複製対象へ含めなかったための`ERR_MODULE_NOT_FOUND`だった。末尾だけの出力から全不合格の件数・原因を推定せず、この実行を成功としない。既存components集合へExecutor一件だけを加え、利用側三Suite三十件は再成功した。製品Source・安全判定・Timeoutは変更していない。Architecture詳細MapのExecutor領域と二つの逆参照、Domain→Executorの既存台帳Binding、品質案内の旧未実装表示も追従した。限定独立レビューは残指摘零。修正後の全回帰では最終集計と不合格行を保持して確定する。

着手前照合の履歴: Fの原子的な移管単位は`executeStage`だけではなく、単段準備、Process開始／取消／join、結果正規化と元Docker回復証拠の閉包とした。`ControlRecord`のTask全体と単段字段を分け、後者の真正MapをExecutorへ一実体移管する方針を採用した。Coordinatorは現在Attemptの不透明Controlと終了後の不透明証拠を保持し、Task配列の順序・再試行・Workspaceと共通Host清掃を所有する。共通Host清掃前の各Attemptの準備、元清掃結果後の確定又は不明時の放棄は用途固定操作として接続し、汎用callback／新Registry／二重Mapは作らない。`result.ts`・`operation.ts`・`recovery.ts`の丸ごと移動は循環と上位責務流入を生むため、宣言単位で分割した。この着手前判断自体を実装・回帰の根拠にはしない。

<a id="executor-optional-final-results"></a>

#### F／Gの指定範囲の最終結果 — 2026-10-28

Provider単段のExecutor移管と、Domain＋Executorを使う任意Coordinatorの本番接続・重複撤去は、Sourceと対象非AI確認の範囲で完了した。実装は`3836e96a97be55a35ef159f86423fdbc6ed89bca`、配布fixture・台帳・設計対応の追従は`03a730a4d3e1cf4030b5489008d4948b68f703eb`でcommit・pushした。後続差分は試験二Fileと最終記録だけで、製品Sourceは前者から不変である。

固定`03a730a4d`のCoordinator `npm run test:portable`は1,795件中1,788成功・二不合格・対象外五・取消零、終了値1、約54分14秒だった。対象外は未許可の実Docker関連四件・実Provider一件で、Host Windows専用Gateもこの母集団の外である。不合格は公開操作試験の関数切出しが末尾importまでVMへ渡した構文エラーと、責務一覧への`execution/provider-executor.ts`登録漏れの二件だった。単独再現で原因を確認し、前者は既存の中立AST補助によるexact宣言抽出と関数形状確認へ、後者は技術実行集合への一件追従へ是正した。六つの失敗・取消条件、元依頼ID、終了失敗、秘密詳細非公開と、純粋閉包・全数一致・変異拒否は維持した。

是正後の二Suite全十五件は一実行ですべて成功した。固定全回帰一回の二不合格を消さず、1,795件の単一再成功とは表示しない。配布fixture三Suite三十件、Executor五件、関連三百二十四件、MCP百五件、Workbench百十一件、Windows保存の範囲別確認もそれぞれ別実行の根拠として保持する。今回の差分から実AI／Dockerの成功を推定しない。

Source・Oracle・配置・公開境界の独立レビューは、是正後の残指摘零。最後の二試験Fileは整形・警告を失敗とするLintを通過し、既存の情報診断二件をErrorへ換算しない。品質案内の古い未実装表示と詳細設計Mapの登録漏れも是正した。変更した品質三文書と詳細Mapの文書指摘は零、同検査から展開した参照先3,333指摘は別範囲で不合格を維持する。先行Repository全体3,723指摘とは母集団が異なり、その全件解消とはしない。結果本文は既存の本計画とTool出力に限定し、実行ごとの巨大なEvidence又はログ書庫は追加しない。再実行入口は各Packageの既存test／checkと上記二Suiteである。

未完了はHの実AI／Docker・人間操作、実データ移行、正式QAの全数再評価とRelease判断である。Domain全回帰のWindows rename EPERM一件は上段の担当・再評価条件で独立追跡し、全体品質の成功とはしない。これらをF／GのSource移管済み表示で覆わない。F／Gの既存Source移管範囲を閉じるための追加判断はない。Hは下段の採用済み試験用組立で進め、実境界の成立は未確認である。AI再送・Docker照会／操作・認証情報・過去保持物の読取り又は操作は実施していない。

<a id="windows-document-rename-investigation"></a>

#### Windows文書保存の拒否切り分けとHの準備 — 2026-10-28

`954100163`の後続調査であり、F／Gの製品Sourceを変更しない。対象はDomainのTopic／Meeting保存境界と既存CPR-IT-010の協調Writer試験。新品のRepository内合成Rootだけを使い、過去保持物・既存状態・認証・実AI・Dockerは操作しない。保存・改訂・排他・読戻しの契約は不変で、製品のretry、期限変更、権限緩和、新しい回復処理は追加しない。Source／Oracleの限定独立レビューと文書の参照確認を適用し、準拠・Release判断の変更や監査は今回対象外とする。

既存九件は八成功・一不合格。協調Writerの第一子が終了1となるが、従来の`stdio: ignore`で一次理由を失っていた。試験だけを`ignore / ignore / pipe`へ変更し、stderrを常時drainして先頭4096 bytesだけをメモリ保持し、close後のassert失敗補助に使う。Fileへ保存せず、上限後もpipeを消費する。code／signal／spawn error、十秒期限、release・kill・join、全子close後だけのRoot回収は維持する。診断追加後の九件も八成功・一不合格で、第一子の`rename`がNode v24.19.0／libuv 1.52.1で`EPERM / errno -4048`を返したことを確認した。改善又は成功へ読み替えない。

| CRDDを通さないNode標準比較 | 固定した例数 | 観測 |
|---|---:|---|
| 親Process・直前読取りなし | 8 | rename成功8 |
| 親Process・直前lstat／読取りあり | 8 | rename成功8 |
| 子Process・直前読取りなし | 8 | rename成功7、同じEPERM一件 |
| 子Process・直前lstat／読取りあり | 8 | rename成功8 |

比較は今回専用の非link試験親から生成したRootで、各例に新規の`record.md`=`BASE`と`.record.md.tmp`=`NEXT`を通常writeして閉じ、同じNodeの`fs.renameSync`を一度だけ呼んだ。子は固定`--input-type=module --eval`のNode組込みfsだけで動作し、CRDD Module・Writer・Lock・状態を読み込まない。これは同じ拒否をCRDDなしで再現した根拠であり、全EPERMの原因が同一又はCRDDに他の問題がないという証明ではない。

追加の参照元照会は、新品Root内の子rename最大十六例・最初の失敗で停止する有限比較とした。十三例目で同じ拒否を観測し、そのtemp／target二FileだけをWindows標準Restart Managerの`RmRegisterResources`／`RmGetList`へ渡した。両File属性は32（読み取り専用bitなし）、Start／Register／List／Endはすべて0、照会時点のprocess一覧は空だった。停止・再起動APIは呼んでいない。後追い照会であり、一時的なhandleやKernel／セキュリティ製品等の拒否を排除できず、原因をAV・ACL・特定Processへ断定しない。[libuv 1.52.1のWindows rename](https://github.com/libuv/libuv/blob/v1.52.1/src/win/fs.c)と[Windowsの照会API](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmgetlist)は一般的意味の参照だけに使い、ローカルの原因証拠としない。

比較の全子終了・今回Rootの通常削除と不存在を確認し、短命診断Script三件も削除・不存在確認した。生の診断書庫、製品用計測Framework、Native部品は追加しない。恒久差分は既存試験の有限stderr観測だけである。Domain型検査、変更試験の整形・警告を失敗とするLintは成功、Source・Oracle・結果とH条件の限定独立レビューは残指摘零。Windows保存の不合格自体は未解消で、担当Qual-Lab、再評価はWindowsファイルI/Oの拒否元を限定観測できる時又は実行環境変更時とする。OS監視やセキュリティ設定の変更を今回のSource調査許可から推定しない。

Hは次の条件候補へ分ける。まだ実行許可を取得又は消費したとは扱わない。

| 段階 | 送信・モデル・上限候補 | 前提・停止・回収 |
|---|---|---|
| Executor単独の読取り | 合成Contextと固定質問のみ。Codex `gpt-6.1-sol`／medium、Claude `claude-opus-5-5`／mediumを各一回、合計最大二回 | Coordinator解決拒否下で正常・取消・Host終了の非AI構成を先に固定する。既存Task検証ToolはCoordinator経由のため、単独実試験の代用にしない。独立実試験の準備は未完了 |
| Coordinator結合・Direct／Isolated | 合成`source.txt`・既存dirty／stage／未追跡確認用File・合成Context・固定指示と差分だけ。Codex編集→Claudeレビュー、必要な既存限定是正一回と再レビューまで。二Task、AI起動は合計最大八回 | 固定版で非AI事前確認・独立確認を先行。Task全体の自動再試行なし。不明な失敗で停止し、今回の資源だけ既存処理で回収する |

使用Imageは現行Sourceの固定Codex CLI 0.164.0（Task digest `832019e6…a4a4`、助言用 `112a73d8…6de3`）、Claude Code 2.1.310（`612433b7…c51f`）、共通Proxy（`4270d4dc…3766`）を候補とし、Image取得・更新は含めない。これはSourceの指定値であり、Engine・実Image・モデル利用可否は未確認。実施時の承認はDocker読取り照会・既存Subscription認証領域の用途限定使用・Provider通信・合成内容の外部送信・今回作成資源の回収までを明示する。Container／Networkは各同時最大二、Engine停止・固定Image欠測・事前確認失敗では停止する。Docker起動／再起動／修復、API Key fallback、実Repository本文送信、過去保持物操作は含めない。

今回のWindows拒否は、実試験の保存・回収も止め得る未解消Riskである。Source診断の完了を環境正常化と扱わず、現時点では実AIを開始しない。まず独立Executorの非AI試験構成と事前条件を具体化し、未解消環境Riskを再評価してから、確定した送信本文・固定Commit・回数・exact試験Root・清掃条件を人間へ提示する。未準備の実試験を今承認させない。

<a id="executor-standalone-non-ai-lifecycle"></a>

#### Executor独立候補の非AI生涯確認 — 2026-10-28

変更分類は検証追加。基準`70d09a0bb`の製品Source・API・保存契約は変更しない。既存ERB-IT-002／004とExecutor詳細設計へ照合し、読取り専用の着手前確認後、既存`public-boundary.contract.test.ts`へ一Caseを追加する。専門観点は単段の取消・終了相関と証拠のOwner結合。Source／Oracleの独立レビューと変更文書の参照検査を行い、準拠・Release監査は契約変更も完成宣言もないため対象外とする。新しい公開注入口、Framework、状態、Lock、外部試験物は追加しない。

新品Node子ProcessがExecutorのimport前にCoordinator解決拒否hookを登録し、解決試行零を検査する。既存の隔離候補Factory・実Controller・実DI command sessionを使い、合成Planと有限CommandHandle、Host callbackだけを代役にする。Claude形式の合成Probeについて正常、wait未完了中の取消、清掃不明、同期通知保存例外を各一回検査する。九purposeの順序、各handleの開始確認・wait回数、取消時の終了一回、wait終了後の清掃一回、清掃を返すまでcompletion未確定、後着解決による追加要求零を確認する。準備参照の再利用は拒否し、回復引渡しを最初の要求前に検査する。

清掃不明はblocked・清掃未確認・手動回復必要・同じexact回復参照・結果Hash非発行を共同検査し、不在証拠の欠測を終端観測へ登録しない。正常・取消・通知例外の元終端観測は元result／管理参照／操作ID／回復IDだけで借用でき、コピー・別Owner・別候補Runtimeを拒否する。元通知は同期callback内だけ有効とし、正常・取消・例外後すべてで失効を検査する。全completionと子Processの十五秒以内終了を確認する。

追加後のExecutor `npm test`は整形・型・警告を失敗とするLintを含め六件すべて成功。追加一Case内の四条件と既存五件を別件数へ水増ししない。Catalogは414項目validであり、414件の試験実行ではない。独立レビューの二指摘は取消APIの返却値・順序と通知保存例外の固定理由を追記し、再回帰後の再レビューは残指摘零。例外は既存の実行catchによる固定理由、false返却は保存拒否理由として区別し、製品側を変更しない。変更文書二件の指摘は零、参照展開した十七文書の十三指摘は旧CHG本体の過去Pathリンクに限定され、別範囲の不合格として保持する。全体QAの合格へ換算しない。

これは候補上の有限結合であり、本番`createProviderExecutor`の固定Docker接続、両Providerの実実行、耐久Recovery保存、実Process／Container不存在、Host Process喪失後の回収は未確認。Hの独立実試験準備全体は未完了のままとする。外部AI・Docker照会／操作・認証情報・過去保持物の読取り又は操作は行わない。Windows保存拒否の未解消Riskも変更しない。

<a id="executor-production-factory-non-ai-wiring"></a>

#### Executor本番Factory配線の非AI確認 — 2026-10-28

基準`fdb43e73d`からの検証追加で、製品Source・API・保存・Timeoutは不変。前段と同じERB-IT-002／004と詳細設計を使い、読取り専用の着手前照合で候補生涯と本番Factory配線の保証範囲を分けた。既存Case内で候補／本番Factoryの二構成へ同じ四条件を適用し、新しい試験Framework、製品用注入API、永続状態又はLockは作らない。

子Process内でCoordinatorの解決を拒否し、Executor import前にDocker Isolation Rootの`createDockerIsolationRuntime`だけをModule代役へ替える。他exportは実namespaceを維持し、代役Runtimeは既存公開の候補sessionへ有限CommandHandleを渡す。本番構成の計画は公開builderで生成して実`validatePlan`と投影へ通す。Factory生成各一回、入力が元の所在／Receipt借用二つだけであること、identity・構成・stdin・回復／管理Ownerの同一性、元清掃結果のVerifier搬送を確認する。Hostへ余剰に置いた実行・清掃primitiveは利用零、子内の外部Process生成APIも拒否して呼出し零を検査する。

前段の正常、wait中取消とjoin、清掃不明、同期通知保存例外のOracleを両構成で維持する。元結果・別Owner・別Runtimeの交差拒否に加え、本番公開Verifierへ元清掃結果、コピー、別回復／管理参照を渡して元結果だけを受理することを確認する。候補と同じ合成Claude Probeであり、本番Docker Runtime内部、両Providerの実実行、耐久保存、実Process／Container不存在、Host喪失後の回収は未確認。Hの実試験準備全体は完成扱いにしない。

追加後のExecutor `npm test`は静的検査を含め六件成功。一Case内の二構成×四条件を独立した八件へ水増ししない。Catalogは414項目valid、限定独立レビューは指摘零。変更三文書の指摘は零、参照展開した五十七文書では他のCHG本文に3,050指摘があり、その範囲は不合格のまま保持する。前段の十七文書・十三指摘とは母集団が異なり、増減の比較には使わない。本番DIでのReceipt借用は同一参照搬送までで、実Runtime内の利用成立とは区別する。実AI・Docker照会／操作・認証情報・過去保持物操作はなし。Windows保存拒否の未解消Riskを維持し、製品修正やretryで覆わない。

<a id="executor-real-boundary-host-decision"></a>

#### HのHost接続判断とWindows追加切り分け — 2026-10-28

人間から残件①単独実試験準備・②実Docker／実AI・③Windows保存拒否の対応を指示された。製品変更、新Host、実送信、Docker操作又はOS保護設定変更の許可まで拡張しない。Sourceと既存保証を照合した結果、次の判断待ちを検出した。

| 残件 | 現在分かったこと | 処置／未完了 |
|---|---|---|
| ①単独実試験準備 | 公開ExecutorはHostを受けるLibraryであり、本番HostはCoordinatorの`operation`／`authority`／`preparation`／`recovery`の私有Owner、Home／Host排他、同期保存へ結合する。Domainの保存APIと公開Plan builderだけでは元Capabilityの発行元を代替できない | 新Hostを複製せず、単独性は非AI、実境界は既存Coordinator経由へ分ける案を提示。判断前に完成条件を書き換えず、独立実試験準備の完了とはしない |
| ②実Docker／実AI | 既存Coordinatorの正式入口から同じExecutor本体へ接続できる。独立Hostを使う経路はない | 上記の検証分割判断後、送信本文・モデル・回数・exact試験Rootと回収範囲を確定して別途承認へ渡す。まだ起動・送信しない |
| ③Windows保存拒否 | CRDDなしのNode標準renameで再度EPERMが発生。Win32直接比較は有限例ですべて成功 | 拒否元は未確定。retry、期限／安全判定緩和、OS設定変更、新回復機構は追加しない |

①の棚卸しは作成担当と別の読取り専用確認者が同じ結論となった。既存保証を模した成功callbackを実Effectへ接続する案は、私有Ownerと耐久保存を検証したことにならないため採らない。新しい独立Hostを要求する場合は、実行Authority、元操作、Home／Host排他、Recoveryと保存を新たに設計・移管する範囲変更になる。この時点では分割検証を推奨して判断待ちとしたが、後段の人間判断により製品Hostと試験組立を区別して進める方針へ修正した。

③の追加比較は`2026-10-28T09:06:38.251Z`〜`09:06:41.115Z`、新品Root `C:\project\CRDD\.crdd\tests\rename-native-boundary-WRNOKu`だけを使用した。各子Processが`BASE`のtargetと`NEXT`のtempを書いて閉じ、一回だけ置換する。各方式は最大十六例、最初の失敗でその方式を停止し、再試行しない。Node子は十五成功・十六例目で`EPERM / errno -4048`、Python ctypesからの`MoveFileExW(MOVEFILE_REPLACE_EXISTING)`は十六成功・各直後Win32 error 0だった。成功時はtarget本文とtemp不存在を確認した。全子の通常終了、Root内が自己生成の二種File・固定本文・非linkだけであること、通常削除とRoot不存在、短命Script削除と不存在を確認した。実資源・過去保持物は対象外である。

Win32直接比較は[公式APIの失敗直後error観測](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)へ接続するための別経路であり、Nodeで失敗した同じ要求のWin32 errorを捕捉したものではない。両方式の例数・Process構成差と発生頻度があり、Node／libuv固有故障又はAV原因とは断定しない。失敗時刻の前五秒・後十秒だけ、既存Defender Operationalの1123／1124を読取り照会した。通常環境はアクセス拒否、許可された読取り環境では該当時間・IDのイベントなしだった。これはDefender一般や他製品・一時handleの影響不存在の証明ではない。監視有効化・監視用Driver導入・除外・保護解除・修復・再起動は行っていない。原因をさらに限定するには失敗要求時点のOS側観測が必要だが、今回はその監視を開始しない。担当Qual-Lab、再評価は用途限定のOS観測を承認できる時又は環境変更時とする。

限定独立レビューは判断不要／判断待ちの対象範囲一件を明確化し、再確認で残指摘零。変更計画の文書指摘は零、参照展開十三文書の十三指摘は旧CHG本体の過去Pathリンクに限定され、その検査範囲は不合格のまま保持する。今回は製品Source・試験定義を変更せず、上記の有限実測と文書確認だけを実施した。①〜③全体の完了、Windows原因特定又は実AI実施とは表示しない。

<a id="executor-test-composition-entry"></a>

#### Executor内の試験用組立と再実行入口 — 2026-10-28

人間はExecutorのscripts又はtests内で試験用Hostを組む方針を採用した。前段で「完全単独実試験には新Hostが必要」とした説明は、製品Hostと試験の依存構成を混同していた。製品HostやFrameworkの新設を必須条件にせず、試験用の有限組立を進める。前段の分割検証案の判断待ちは、この判断で解消する。ただし既存の私有Capabilityや本番共有Home／Host排他が単独で利用可能になったと読み替えない。

| 変更 | 実装／確認 |
|---|---|
| 非AIの明示入口 | `40_Develop/executor/scripts/verify-provider-attempt.ts`。`npm run verify:standalone`から実行し、既存public-boundary ITも同じ関数を呼ぶ。import時の書込み・Process生成は零 |
| 単段の有限組立 | 既存candidate／production_factoryと四終了条件を同じ新品子Processで維持。Coordinator解決と子内外部Process生成は拒否する |
| 試験fixture専用排他 | 新品Root内で`wx`取得、二重取得拒否、保存前の保持確認、解放後の再取得と保存拒否を実観測。本番Home／Host排他とは別 |
| イベントcommit | Domainの既存`writeCommittedJson`／`readCommittedJson`を使い、元操作・回復参照、Hash・File Identityと本文の読戻しを確認。元通知を同じ同期Gate内で検証してからだけ保存する |
| 負例 | Gate false／例外、別Owner、コピー・失効通知、コピー終端結果では記録を生成せず既存File一覧・fixture lock本文を維持する |
| 終了と清掃 | 元completionと子Process通常終了後だけ、Root Identity・非link・許容名・固定値・File種別を確認して通常削除・不存在確認。一次故障と清掃失敗は分離して保持し、未確認はexact Rootを報告する |

製品Source・Root公開API・本番Runtime state Schema・共有認証・Authorityを変更しない。Scriptは静的検査へ追加し、Symbolと既存Catalogを追従した。新しいRegistry、製品State、Lock Framework、常駐Process、独立Evidence書庫は作らない。イベントは今回だけの有限試験物であり、成功後に物理Rootごと回収し、過去保持物を探索しない。

Executorの静的検査込み回帰六件はすべて成功。明示CLI入口も別実行で成功し、両実行とも自己生成Rootの回収・不存在を確認した。Catalogは414項目valid。限定独立レビューのimport時Effect Oracle一件を、読取り専用loader descriptorだけの許可と書込みopen／unlinkの同Source変異で是正し、再レビューは残指摘零。変更三文書・Executor Symbolの指摘は零、参照展開五十七文書の他CHG本文3,050指摘は別範囲の不合格として保持する。これらは非AI検証の結果であり、実Docker・Provider認証・外部AI・共有Home排他・本番Host保存・Process喪失回復の成立ではない。実境界へ進む前に、試験Hostで使う実認証／共有Home排他と元回復保存を具体化し、実際のモデル・送信・回数・exact Root・回収範囲を提示する。

同作業の初回整形では、Biomeが既存IT Fileへの書込みにWindows error 1224（ユーザーマップセクションで開いたFileへの操作拒否）を返した。整形差分を限定編集した後の整形確認・型・Lint・回帰は成功した。これは別要求・別Fileの追加観測であり、先のNode rename EPERMと同じ原因又は特定Processによる保持とは断定しない。監視・OS設定変更・Docker・認証・AI・過去保持物操作は行っていない。

<a id="executor-home-preflight-entry"></a>

#### 実Home事前確認の別入口 — 2026-10-28

実AIへ進む前の認証領域metadata・共有排他の確認だけを、`executor/scripts/verify-provider-home.ts <codex|claude> <run-id>`へ接続した。通常`verify:standalone`やpackage importから実Homeを観測しない。製品Source／API・Home・Credentialの配置・既存Lock契約は変更しない。実行は一Providerのexact一回について別途承認してから行い、実装時はPlatform observer／Lockを代役化した非AI試験だけを実施した。

| 境界 | 処置 |
|---|---|
| Home選択 | `LOCALAPPDATA/Qual-Lab/CRDD/ProviderHomes/{provider}`だけ。任意Home Path・作成・修復・ACL変更は受け付けない |
| 観測 | 既存Native helperの候補・現Provider・終了確認・Artifact前後一致・Filesystem Effect零を要求する。保持中に再観測し四Hash一致を確認する |
| 排他 | 既存Platform Accessの非同期Named Pipe取得・解放をそのまま使用する。既存ProviderHome名のSHA-256 domain・prefix・slice・入力制約をSource Oracleで照合し、三変異を拒否する。Coordinator Moduleはロードしない |
| 失敗 | Native発行・取得・解放の不明を分け、取得後の再観測又は保存がthrowしても元Lockを一回だけ解放する。再取得・自動再試行は行わない |
| 試験記録 | 検証Repository内の新品`.crdd/tests/executor-home-{provider}-{run-id}/`だけ。Provider、非秘密試験ID、段階、一致bool、七日後の再評価時刻を既存確定JSONで保存・読戻しする。Home Path・四Hash・SID・ACL・Credential本文は残さない |
| 清掃 | 資源終了を確認した場合だけRoot Identity・非link・許容File・nlinkを照合し、既存確定JSON削除と空Root削除・不存在確認。未知又は部分保存はexact Rootを報告して保持する。七日経過だけで消さない |

新ITは十八の有限条件と排他名Oracleを二Caseにまとめ、観測／排他を代役にして実Homeへ触れない。合成のunknown負例が残した自己生成Rootは、実資源がすべて代役であることを前提に、試験が内容・非link・自己IDを確認して回収する。これを実Homeのunknown回収と混同しない。正常importのobserver／Lock呼出し零、不正Provider／run-idのEffect前拒否も確認する。Catalog・Symbol・Architecture・検証設計へ追従し、新Host Framework、Registry、製品用State又は回復処理を追加しない。

この入口の成功は「観測一致と、その事前確認のLock解放・試験Root回収」を意味するだけで、ログイン成功・AI実行許可・試行中の共有Home保持・本番Runtime state保存・Recovery完了を意味しない。これらの実行接続は残件として維持する。実AI・Docker・実認証内容・過去保持物を操作していない。

静的検査を含むExecutor回帰は八件成功、単独非AI CLIも成功、Catalogは415項目validだった。限定独立レビューで候補受理時のNative Process発行確認と、発行済み・終了未確認の反例不足一件を検出した。両観測で発行済みを要求し、初回／保持中の終了未知と未発行候補を追加して再レビュー残指摘零とした。十八条件は二Case内の条件数であり、回帰八件とは別の母集団である。変更三文書・Executor Symbolの文書検査指摘は零、参照展開五十七文書の他CHG本文3,050指摘は不合格のまま保持する。この事前検証時点では実Home確認は未実行で、固定Provider一値・exact試験Rootに限定したNative metadata観測二回以下と既存共有排他取得・解放一回の操作承認を求めた。

承認後、2026-10-28 19:52 JSTにCodex一回の実Home事前確認を実施した。対象はcleanな`d93570650a15f81064cc064519a10b7d67d0926d`、実行は`node 40_Develop/executor/scripts/verify-provider-home.ts codex HOME-CODEX-20261028-01`。sandboxの`LOCALAPPDATA`が別領域を指していたため、その環境では起動せず、承認済み実行環境の当該子Process内だけ`C:\Users\nakas\AppData\Local`を明示した。OS設定・Home内容は変更していない。Exit 0、`status=observed`、`reason=null`、`observationMatched=true`、`resourceCleanupConfirmed=true`、`fixtureCleanupConfirmed=true`、`fixtureRoot=null`となった。実行後の別照会でも`C:\project\CRDD\.crdd\tests\executor-home-codex-HOME-CODEX-20261028-01`の不存在を確認した。認証状態の検査・AI送信・Docker操作はすべて未実施で、Claudeや過去保持物へ範囲を拡大していない。生metadata・四Hash・認証内容のログは保存せず、実行方法と非秘密結果だけを本段落へ記録する。この結果は事前観測・排他終了・試験物回収に限定し、試行全体の排他・本番保存・Recovery又は実AI成功の根拠にはしない。

#### 単段試験Hostの保存・排他接続 — 2026-10-28

続く非AI実装は`scripts/provider-attempt-host.ts`に限定した。既存の固定`createProviderExecutor`とDomain確定JSONを使用し、一回限りの元管理・準備・回復参照、五資源の提出前記録とReceipt、同期通知照合、元清掃結果・元終端の保存を接続する。任意Rootではなく同Repositoryの`.crdd/tests/`配下の新品領域だけを受け付ける。製品API・Coordinator・保存Schemaを変更せず、新しい製品Host・Registry・State・Lock・回復Frameworkは追加しない。

排他は既存の同期Named Pipe APIを呼出し側が取得して渡す構成とした。非同期解放では同期の`completeMount`に終了事実を渡せないという当初の見立ては、既存同期APIを確認して訂正した。開始・所在借用・記録前に元排他の`assertLive`を確認し、五資源の明示不存在記録後だけ`release`を一回呼ぶ。解放状態到達を同じ元回復・管理・操作参照へ結合し、`verifyHomeLeaseRelease`で確認する。既存同期APIの成功はWorker最終exit確認とは異なるため、外側の子Process終了確認と、解放不明時のRoot保持を別の条件とする。今回その実OS経路は実行していない。

独立子Processの新ITは下位DI／Leaseだけを代役化し、実Writerを使用する。正常・取消・清掃不明・排他喪失・解放拒否／例外・四種の書込み拒否・書込み確定後の読戻し拒否を十一条件、一Caseで検査した。回復IDは既存形式に従いHome結合を含むが、四Hashの個別field、Home Path、認証内容、生Provider出力は保存しない。各イベントに`recordedAt`を付ける。未知負例のRootは実資源がすべて代役であることを前提に、試験自身が自己生成Fileの内容・非link・nlinkを確認して回収する。初回試験で元計画が開始境界で正規化コピーされることと既存回復IDのHome結合順序への追従漏れを検出し、元Capability照合を保持して是正した。初回が残した空の今回Root一件も確認後に通常削除・不存在確認した。実AI・Docker・実Home・過去保持物へは接続しない。

限定独立レビューで回復開始の保存失敗時にexact参照を失う一件を検出した。書込み前拒否と確定後読戻し拒否の双方で同じ回復IDを返し、新Effectを開始せず、元生存Leaseだけ一回解放する経路へ是正した。記録Rootは保持し、保存再試行・強制清掃は追加しない。再レビューは残指摘零。静的検査を含むExecutor回帰は九件すべて成功、Catalogは416項目valid、変更三文書・Executor Symbolの指摘は零だった。参照展開五十七文書の他CHG本文3,050指摘による全体不合格は維持する。十一条件を十一の独立Caseや実OS検証へ水増ししない。

この補助は試験用Hostの接続であり、実試験入口全体の準備完了ではない。実AIへ進むには、固定合成入力・Model選定・初回同意、Home観測と同期排他取得、固定計画構築、試験用子Processの終了／取消とRoot保持・清掃を明示CLIへ接続する必要がある。元HostのOS喪失回復や本番耐久Stateを代替したとは表示しない。

#### 単段実試験CLIの非AI接続 — 2026-10-28

`scripts/verify-provider-real.ts`に固定計画表示と明示実行を分けた試験入口を追加した。合成Contextのみ、Codex `gpt-6.1-sol`／Claude `claude-opus-5-5`のmedium助言一回、Repository非mount・tools／session無効とする。TTY同意後だけ一子を起動し、固定計画・既存Home観測／同期排他・前段の試験Hostへ接続する。製品Host・State・Queue・Recovery機構は追加せず、本番Source・Schema・期限・安全判定は変更しない。

独立確認の三指摘に従い、Git確認を同意後へ移し、Coordinator依存拒否hookをプロジェクト依存のロード前へ置いた。親子で元回復参照をEffect前に受け渡し、結果喪失時も保持する。監督上限では取消後に既存猶予で子closeを待ち、未観測ならRootを一切更新しない。取消競合・未知結果は成功清掃へ進めず、close観測後だけ非秘密結果と七日後の再評価時刻を記録する。生Provider出力は保存しない。

再確認の二指摘も反映した。正常清掃には回復IPCとACK送信成功を必須とし、close後の保存記録からの参照回収を成功条件の代用にしない。開始前の固定理由だけを列挙して保持し、未知の例外本文は従来どおり汎用理由へ閉じる。Home不一致と解放拒否が重なっても一次理由を維持する。

ACK送信callbackと子の結果・closeの順序は保証されないため、相関済み結果は送信発行後に保持し、正常清掃にはcallback成功とcloseを共同要求する。callback欠測でも既存監督上限を解除せず、失敗時に保持する。新しいIPC通知や製品待機Gateは作らない。

追加五Caseは、純粋計画とEffect前拒否、子の十条件、親の十五条件、静的依存変異、実IPC子の不正計画／開始前取消を確認した。最終候補のExecutor全回帰は一実行十四件成功・失敗零・取消零、二十TypeScriptの整形・型・警告を失敗とするLintも成功。Catalogは417件validである。修正版の独立再確認は残指摘零で、この試験入口の非AI接続範囲を閉じる。対象三文書とExecutor Symbolの指摘は零、参照展開五十七文書の既存3,050指摘による全体不合格は維持する。Native・Lease・Host又はforkの代役範囲を明示し、実Provider・Home・Dockerの成立とは扱わない。今回、実AI・Docker照会／操作・実Home・認証情報・過去保持物を操作していない。実送信は固定入力・Model・Image・回数・新品Rootと回収の範囲を別途承認後に行う。

#### 単段Codex一回試験の停止と保持 — 2026-10-28

人間が固定合成入力・両Provider各一回・固定Image・今回資源のみの回収を承認した。`f5127a3487531169eeac288ef3b622950731c5b1`でEngine（Linux／29.8.1）と固定Provider二Image・Proxy Imageの存在を読取り確認し、稼働Container零の後、Codexだけを`EXEC-20261028-01`として一回開始した。端末内の通常同意後、結果は`blocked / docker_process_controller_cleanup_unconfirmed`、終了値二。Claudeは未実施、再送・Docker再起動・Image更新・過去保持物操作はしていない。

返却値は`childCloseConfirmed=false`、`childCloseObserved=false`、`cleanupConfirmed=false`、`releaseConfirmed=false`、`terminalSaved=false`、`nativeCleanupConfirmed=true`、`adviceConfirmed=false`だった。元回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.e0e9ff0d111436dc423da7a23537ed57fad656bd7a4d3e84537104dd67b1d7db.cda506a0f8e80edf52c6ac09c40cbe83921ccccb4c0559fde5ba424710c66ab7`。`C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261028-01`は保持し、再評価時刻は2026-11-04T13:45:10.136Zとする。親は子close未観測なのでRootへ結果を書かず、`retentionRecordConfirmed=false`を返した。端末の有限結果を本節へ記録し、生出力は保存しない。

今回Rootには`recovery_opened`、`recovery_handoff`、`submission_planned`（`create_subscription_auth_probe`）の確定JSON三件だけがあり、Receipt・不存在・排他解放・終端保存の記録はない。後続の読取りで試験ScriptのNodeは零件。Container候補`6d28583322a6ed96ea3cd2fdc94efe3eabaccd8b6fa65830e7726c25d7c16d91`（`crdd-auth-a11dcaf2206e91a5`）は13:31:36Z作成、固定Codex Image、未起動・PID零・Network none・再起動なし・Home読取り専用だった。専用Networkは一覧になく、既存停止Container等は不変更。現時点のProcess不存在を、返却時のclose観測成立へ書き換えない。

作成拒否ではなく、作成要求以後の応答受領・記録の未確定が残る。保存記録はランダムContainer名／実IDとの結合を欠き、時刻・構成の一致だけで今回所有を断定しない。この候補とRootは削除せず保持し、今回資源としてのexact対象判断又は既存記録からの追加相関が必要。一次故障の詳細、子close未観測の理由、実AI実行の成立は未確定で、試験全体は不合格のまま扱う。

#### 単段試験停止の非AI調査 — 2026-10-28

今回保持Root・Sourceだけを読み、実AI・Docker再要求／再起動・実Home再取得・保持物変更は行わず切り分けた。既存所有Process APIに120ms後に合成65byteを返す自己生成Nodeだけを接続すると、五msの初回待機は未観測、後の待機では終了零・65byte・close確認となった。要求先が完了していても最初の待機にReceiptが届くとは限らないことを再現したが、今回Dockerの応答遅延の原因や実待機時間を特定した結果ではない。予定保存13:31:25.682Z、実行config作成約13:31:28Z、Container作成13:31:36.452Zであり、予定保存からの約10.77秒をそのまま十秒のコマンド待機超過とは扱わない。

子終了未観測には独立した有力要因がある。既存Platform AccessのWorker組立は`stdout:true`／`stderr:true`をresumeし、同期排他側はWorkerをunrefする。実Pipeを作らない有限Worker比較で、800ms後に終了するWorkerをunrefしたNodeはdrainなし約98ms、同じ構成のdrainあり約914msで終了した。別比較でもdrain約918ms、後からpauseしても約923msで、pauseだけでは解消しなかった。試験Hostは清掃不明時に排他を保持し、試験子のfinallyも開始後は解放しないため、結果送信後も排他Workerのstdioが子の終了を妨げ得る。実試験中のactive handleを採取していないため、これを唯一の残留要因とは断定しない。

一次原因を確定できない理由もSourceで確認した。Executorは既存`reportProviderBoundaryDiagnostic`へ一次故障の段階・Handle取得・応答観測・Receipt・固定例外分類を通知するが、今回の試験Hostはこのcallbackを接続していなかった。さらに`recordTerminal`は清掃成立時だけ保存するため、今回の失敗では一次診断が残らない。`submission_planned`にも既存計画が持つ予定名／labelを保存せず、plan Hashだけからランダム資源名を復元できない。このため残存候補のexact所有相関も不足している。

最小是正候補は、試験Hostが既存の閉じた非秘密一次診断を受け取り、作成前の予定名・所有labelを同じ試験記録へ残すこと、及び失敗結果後の試験子終了と排他Workerのstdio所有を既存Platform Accessの範囲で整理することである。新しいState・Registry・Recovery、Timeout延長、名前だけの削除は提案しない。今回の一次故障がコマンド待機・応答搬送・Receipt保存のどれかはなお未確定。調査段階では製品Source・試験Source・保持Rootを変更していない。

#### 単段試験の最小是正と非AI確認 — 2026-10-28

着手前整合で、解放失敗後の診断保存は既存Owner条件に適合しないと確認した。Writerのguardを緩めず、境界終了通知の相関済み一次故障と固定boolをメモリへ保持し、既存結果IPCの閉じた`diagnostic`へ載せた。解放成功後だけ同じ投影を確定JSONへ保存し、拒否・不明後は書かない。診断保存失敗は既存の非介入通知契約に従い実行判定を変えない。予定記録には既存の資源名・所有labelを加え、清掃側も完全キーと文法を検査する。過去保持Rootは新形式へ書き換えない。

Platform Accessの無出力Lock Workerだけ、親側stdioをresumeからdestroyへ変更した。Worker・共有状態・message・error／exit・取得解放処理・期限は不変。有限Workerを実helperへ接続し、release通信／共有状態・通常終了、unref親終了、旧resume変異の終了拘束を確認する。既存の実Worker入力失敗によるerror／exit検査も維持する。これらを実Home・Dockerや今回保持物の回収成功へ換算しない。実AI再送・Docker・過去保持物は未操作である。

独立レビューの予定相関一指摘を是正し、試験Root清掃に五用途各一件、単一label、終了観測との予定名完全一致を要求した。両CLI代役の正常fixtureを五予定・Receipt・終了観測へ揃え、異label・重複purpose・別の合法Provider名・終了観測側だけの名差を拒否する。これはRoot清掃前の照合であり、Dockerの資源名生成や削除許可は変更しない。

最終候補の非AI回帰はExecutor一実行十四件、Platform Access一実行138件がすべて成功した。両Packageの整形・型・警告を失敗とするLint、Catalog417件の検査も成功。試験Hostの十三条件、CLI子の十条件、親の二十二条件は各Case内の反例であり、独立Case件数へ水増ししない。独立再レビューは残指摘零。更新四文書・両Package対象の文書指摘は零で、参照展開七十二文書の既存3,131指摘による全体不合格は残す。今回の是正は非AI限定完了であり、実auth createの一次故障確定、再送成功、保持Container／Root回収又は全体QA完了ではない。現在、この最小是正の範囲で新たな人間判断はない。再送・保持物処置は別の明示判断とする。

#### 修正版Codex単段一回の受領停止 — 2026-10-29

人間の追加承認に従い、固定`26953699203d902eb6696eb4585aa7f693042565`、同じ合成入力・Codex `gpt-6.1-sol` medium・固定Imageで`EXEC-20261028-02`を一回だけ実行した。Engine・二固定Image・稼働Container零を事前に確認し、新品Rootを使用した。通常の端末同意後、終了値二、`blocked / docker_process_controller_cleanup_unconfirmed`。Claude・再送・Docker再起動・Image更新・過去保持物操作はしていない。

今回は子の`closeConfirmed/closeObserved`がともにtrue、非秘密結果の保存確認もtrueだった。一次故障は`create_subscription_auth_probe`の`resource_receipt_record / docker_resource_receipt_unavailable`、Handle取得・応答観測はtrue、Receipt保存false。Docker応答は終了零・stdout65byte・stderr零で、Provider本体開始の観測false、助言結果なし。元回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.b330e6ca77e38a120132e4d371c7d90021b12a214d6240ec789432fc2e51c37e.1ac5f92f5f7643e8eb8b69abe4609fbf3a5df687f6feb38aa2653c0c6214272c`で保持する。Root `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261028-02`は書き換えず保持し、再評価時刻は2026-11-04T14:58:31.859Z。過去の試験結果を今回成功へ書き換えない。

Source照合で、DIは作成stdoutをそのままReceipt callbackへ渡し、本番Coordinatorは`rawDockerId.trim()`後に64hex検査する一方、新試験Hostは生文字列を直接64hex検査していた。実callback本文を使ったメモリ内の非AI反証で、64byteは受理・書込み一回、LF付き65byte及びCRLF付き66byteは拒否・書込み零となった。今回の65byte応答・受領段階拒否と一致し、試験Hostの改行正規化欠落を原因として特定する。生Docker応答を保存・表示しておらず、過去01試験の直接原因までは同一と断定しない。最小是正は既存本番の正規化へ試験Hostを揃え、正常fixtureを改行付き応答へ追従させることであり、DIや本番受付の安全判定・期限を変える必要はない。実装はこの結果記録時点で未実施。

今回の予定記録には`crdd-auth-635e3f731c491fd4`と所有labelがあり、実ID `3daf7e0772fb93b04b33c7c5a6892c8cd9d61ff2e378012903b71e0a3cebab6d`の現在構成・固定Image・作成時刻・未起動PID零・Network none・Home読取り専用・再起動なしとの一致を確認できた。試験Node零、同labelの専用Network零も確認した。回収前の初回照合はPowerShellの日時自動型変換で文字列比較が不一致となり、削除前に停止した。値と型を確認し、DateTimeの最小値を未起動として同じ全条件を再照合した後、承認済み今回資源だけを実ID・forceなしで削除した。実IDとexact名の双方の不存在を確認済み。Root・旧Container等は不変更。この物理回収を元の技術履歴のcleanup成功や排他解放確認へ遡及変換しない。

#### 試験Receiptの改行正規化 — 2026-10-29

人間の指示に従い、単段試験HostのReceipt callbackだけを、本番Coordinatorと同じ`typeof rawId === "string" ? rawId.trim() : ""`の後に既存64hex検査を行う形へ揃えた。新しい共通Parser・API・State・Recoveryは追加せず、DI・本番Coordinator・保存guard・Timeout・命名・回収許可は変更しない。

既存Host結合の通常応答をLF付きへ変更し、裸IDとCRLF付き正常応答、短いID・複数ID・途中改行・非16進文字・大文字・空値の拒否を追加した。保存Receiptは五用途とも正規化済み64桁、拒否時はReceipt保存零・認証Probe以降の未発行・同回復参照保持を照合する。既存十三条件と合わせて一Case内二十一条件であり、独立Case件数とは分ける。実AI・Docker照会／操作・実Home・保持Rootは操作していない。

独立確認のMinor一件に従い、不正Receipt六条件すべてで結果の回復IDと開始時の元IDを直接比較するassertを追加した。最終候補のExecutor全回帰は一実行十四件成功・不合格零・取消零、整形・型・警告を失敗とするLintも成功。再レビューは残指摘零。対象三文書・Executorの文書指摘は零で、参照展開五十七文書の既存3,050指摘による全体不合格は維持する。実AI成功・過去試験の解消・保持Root回収をこの非AI結果から主張せず、再送は別の明示承認後とする。

#### 改行是正後Codex単段一回の意味検査停止 — 2026-10-29

人間の明示承認後、固定`c39556a4f656b8d04a6251235c6ee81c11cdeab7`で同じ合成入力・Codex `gpt-6.1-sol` medium・固定Imageを使用し、`EXEC-20261029-01`を一回だけ実行した。Engine・固定Image・稼働Container零と新品Rootを確認し、端末内の通常同意を経た。結果は終了値二、`blocked / trial_terminal_or_advice_unconfirmed`。Claude・再送・Docker再起動・Image更新・過去保持物操作はしていない。

今回の五作成Receiptはすべて保存され、Provider開始観測true、一次技術故障null、技術清掃・資源不存在・排他解放・元終端保存・Native終了・子closeはすべて確認済みだった。元の技術終端は`completed / provider_operation_completed`。結果本文は保存せず、705byteとSHA-256 `cf016bd4d5e77ed27a4e09d58b91327cc2742f6e36a065a23dbd05b91d18321f`だけを保持する。助言内容確認はfalseであり、読取り助言試験全体のPassとは扱わない。

回復参照`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.8750919c28c18965845772766aa84ac1c3ad604059867b12d76739452db83437.35ef9374e96c1a2894d77dd9a933ef043708ad956cd16301caca49f1eaeeb0e9`、Root `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261029-01`、再評価時刻2026-11-04T15:42:51.953Zを同じ有限結果へ保持する。今回Rootには予定・Receipt各五、Provider提出、五資源不存在、Home解放・Mount終了・回復終了・境界終了・元終端の計二十確定イベントがあり、親の結果保存も確認済み。試験Rootは不合格時の既存保持条件に従い変更・削除しない。資源清掃確認とRoot保持を分ける。

非AIのSource照合では、Executorは`adviceJson`を持つ正規化済みEnvelopeを返し、試験CLIも同じfieldを参照するため、外側の受渡し形式の不一致は確認されなかった。技術completedの経路は同Envelope生成を通る一方、試験CLIが`normalizeAdviceResult`の不合格理由を捨てて共通理由へまとめるため、Schema・Identity・項目／許可参照等の詳細な内容拒否を今回の保存結果から特定できない。生出力を復元・再送して推測しない。最小是正候補は既存Normalizerの閉じた理由コードを既存reasonへ接続することであり、新しいログ機構や生出力保存を必要としない。この結果記録時点ではSourceを変更していない。

#### 助言試験の正式契約提示と意味検査接続 — 2026-10-29

人間の「非AI照合後、次のCodex実試験まで一気に進める」指示に従い、合成指示と結果契約を照合した。Codex助言計画は`--output-schema`を使わないPrompt方式だが、従来の単段試験Promptは正式なcontract値・Revision・必須fieldを示していなかった。既存`describeAdviceResultSchema()`をJSON化してexact許可参照集合とともにPromptへ追加した。合成Context・Model・effort・Image・回数・読取り境界は不変で、Repository本文・Credential・過去出力は追加しない。変更後Promptの全文とHashは送信前の通常表示へ接続する。過去の生出力は保持していないため、この不足を前回の唯一の拒否原因とは断定しない。

内容検査だけの不合格は既存Normalizerの固定理由を既存reasonへ接続する。ただし実行失敗と元終端保存失敗を優先し、Envelope欠測は従来の共通未確認理由に留める。新しい状態・診断Framework・保存field・公開API・Timeoutは追加しない。

新しい一CaseはPlatform Home観測・NamedPipe Lease・Docker Isolation Runtimeの物理処置と清掃／資源観測を有限代役化し、Command stdoutへ合成Envelopeを与える。試験Host・Executor・AI Adapter Parser・内容Normalizerは実体へ接続する。両Provider正常、Schema extra／missing、Contract／Revision／status、空全区分・不正項目・投影外参照・Transport不成立とCodex重複Keyの計二十一条件を区別した。生Envelopeや助言本文は記録せず、元回復参照・五Receipt・終了・清掃を確認して今回の合成Rootだけを回収する。既存の全Host代役Caseにも内容理由・実行理由・終端保存理由の優先順位を追加した。回帰・独立確認後、承認済み新品Codex一回へ進み、失敗時は再試行しない。

最終SourceのExecutor全回帰は一実行十五件成功・失敗零・取消零、整形・型・警告を失敗とするLintも成功した。独立レビューの代役境界表現Minor一件をTest Header・Quality・本節で是正し、再レビューは残指摘零。対象三文書・Executorの文書指摘は零、参照展開五十七文書の既存3,050指摘は別範囲として残す。変更後合成Promptは2,188byte、SHA-256 `d2bd19238cf922b19daa1b9149db188f55dbaf8869369d915e1fd01670af46f5`。この非AI確認から実AI成功を主張せず、次に固定Sourceで承認済みCodex一回だけを実行する。

#### Dの内容認可とMCP定義操作の限定接続

承認済みdevelopment権限に基づき、Access Managementの`repository/resolve.ts`へ要求内の`resolveRuntimeContentAccess`を接続した。既存の同じ短期Lock内で現在状態・資格認証・内容認可・保留材料・Repository実体を確認する。Domainの各I/O確認点では同じ改訂と元bytesのHashを照合し、認可・実体・manifestを取り直す。資格の高コスト照合は要求ごとに一回だけで、後続は同じ元bytesへの結合を検査する。次要求とのcache共有、TTL、Snapshot保持、新State／Lockはない。失効、同改訂本文変更、Role／Exposure変更、manifest変更、保留不成立、Root差、取消、Lock解放不明は許可へ変換しない。

MCPのCore定義二ToolをDomainの既存初期化・CRUD・Queryへ直接接続した。閉じた操作入力、既存CAS、対象Hash、結果のunknown・exact参照を保持し、AI起動・Queue・判断承認を行わない。実子ProcessでCoordinator／ExecutorのModule解決を拒否し、Tool単体の初期化・CRUD・再読取り・CAS拒否を確認した。ただしMCP Rootには既存実行Toolからの静的到達が残るため、Server全体のCore単独成立ではない。WorkbenchのCore公開接続、Executor実体移管、Coordinator任意化も未完了である。

初回の内容認可結合では同一要求内で資格照合が繰り返され、合成状態の初期化・保存・読取りは約37.6秒だった。同じbytesへの結合を保つ一要求一回照合に変更後、同じCaseは約18.7秒で成功した。この有限計測を任意環境の性能保証へ一般化せず、Timeout・安全条件を緩和していない。局所試験では資格照合回数、未対応操作／別ProjectのI/O零、上記の拒否条件を固定した。

現在候補のAccess Management全回帰は173件成功・不合格零。Core Tool三件も成功した。MCPの初回通常環境全回帰は105件中104成功・一不合格で、追加二Toolへの一覧期待数追従漏れだけだった。修正後の当該Case成功に続き、全回帰一実行でも105件成功・不合格零・取消零となった。両Packageの整形・型・警告を失敗とするLint、台帳410件、diff checkは成功。限定独立レビューはSourceと文書のMinorを是正して残指摘零。変更した五文書の指摘は零、参照展開先のbroken-link 266件は別範囲として残す。先行の制限環境ではLink作成とloopbackが拒否され、MCPの一実行を中断した。その実行を成功又は全試験物不存在とは扱わず、過去保持物の探索・清掃へ拡張しない。AI・Docker・過去Runtime／保持物を操作していない。

- AのFile別宣言群・Root公開73項目・静的利用側を棚卸しし、B／Cの具体Afterを提示した。続いて[Runtime Domain正本](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md)にAPI入出力・単一保存・認可／CAS・一回性を具体化し、正式Architecture／Qualityへ接続した。宣言ごとの最終依存閉包、保存Schemaの全field対応と新識別子、五Contextのfresh確認搬送、実装接続は未完了。既存判断・根拠ID・局所受入を確認し、そのままDomainへ移す方針で、新しい非管理完了機能は追加しない。
- Eの保存先と手順、既存Workbench AI依頼の扱い、Plan確定と判断操作の現在認可は、該当実装へ入る前に具体例と影響を示して確認する。
- `AGENTS.md`末尾のProcess別試験名と現在のCoordinator package scriptsには名称の差がある。後続の試験入口を確定する際に照合し、存在しないscriptや省略による全回帰成功を主張しない。
- 直前の[Storage再編](coordinator-storage-ownership-plan.md)の初回全体回帰不合格・分割再確認と文書検査未合格は基準の品質制約として維持する。過去Evidenceを新Packageの成立根拠として改名・再利用しない。

Source移管を開始した。初回バッチは共有型七宣言、Planの閉形式・範囲検査、相対Path検査をDomainへ移し、Coordinator本番利用側を接続した。続いて複数Task公開受付と個別入力搬送、AI選択設定の型・検査・WriterをDomainへ移管した。設定保存先、保存Schema・実行状態値は変更せず、Objective受付契約は必須入力の追加によりv2へ改訂した。実行Snapshot WriterとPlan／Task／Decisionの一般CRUDは引き続き未完了である。既存属性で進める判断と、実装・合成検証後に保存切替を確認する順序は承認済み。

今回の限定回帰90件、Domain設定保存の実Filesystem結合11件、公開Objectiveの実保存・再入場10件、Coordinator依存境界6件は成功した。最初の設定保存実行はhardlink作成拒否により9成功・2失敗で、環境許可後に同じ安全条件の11件が成立した。最初の公開保存試験は中断で成功に含めず、後続の固定入口確認は10件成功。独立レビュー後は公開実保存試験へ二Taskの本番組立て・指示とPathの分離・同内容再入場時の再実行0・本文変更時の拒否を追加し、移管前後それぞれ10件成功した。閉集合検査の既存重複・追従漏れと、検証Tool内のraw保存Path二箇所を既存の名前付きPathへ是正し、横断16件・公開API二件が成功した。加えて固定I/OをDomainへ移し、故障注入二件を含む依存・閉集合回帰24件、状態・公開契約・MCP回帰75件が成功した。Domainへ移した保存試験は元PackageのModule Mock実行flagが必要で、flag欠落時の10成功・1失敗を経て正規条件11件成功を確認し、Domain通常試験入口も追従した。五Packageの型検査と変更77 SourceのFormat／Lint、差分検査が成功。限定独立レビューは残指摘0だが、試験入口flagの最終追従と結果記録は再確認する。Root Checkerは3,722エラー（broken-link 3,716・broken-anchor 5・既存Local ID未接続1）、今回のSymbol Path／Owner不整合は解消した。一般CRUDとWriter全体の移管・Core単独成立・全体QAは未完了である。AI再送・Docker・過去保持物の操作は実施していない。

このバッチの外部AIなしの局所・状態回帰と受入判断／選定搬送結合は計43件成功。Domain、Coordinator、MCP、Workbenchの型検査、変更SourceのFormat／Lintと差分検査を確認した。機能・安全境界の独立レビューは残指摘0、試験内のnon-null assertion七箇所は明示的な存在確認へ是正した。保存移管・Core単独稼働・公開Graph全体の試験結果ではない。Root Checkerは1,195文書を検査して3,722エラー・警告0で不合格を維持し、今回の三つの設計・計画文書に対する診断は0だった。過去Evidenceや全体QAを成功へ更新しない。

後続のDomain通常全回帰は不合格だった。今回の公開値・型の期待一覧とDomainの新規検査試験登録を追従し、公開境界12件は成功した。残るTest Catalog検査は26件中23成功・3不合格で、理由はHEADにも存在する他Packageの試験5ファイル未登録とWindows Process Profile不足1件である。独立確認で対象Source・台帳の基準版同一性を照合し、今回の新規不具合と区別したが、全回帰成功とは扱わない。今回の非AI移管候補の意味上の独立レビューは残指摘0、把握済みのindent二箇所はFormatへ追従する。

初回中断試験に関係し得る `C:\project\CRDD\.crdd\tests\crdd-project-public-runtime-hyPfZB` の由来・清掃確認は未確定で、名前と時刻だけを根拠に削除していない。後続の完走試験は各生成handleの清掃を実行した。この残存確認の未完を、過去保持物の操作許可や回収完了に読み替えない。

一般CRUD／Writer全面移管の前提として、Domain正本§5.0.1へ現行Root全20fieldとProject／Taskの分解対応、非互換な `crdd-domain/runtime-state/v1` を固定した。新SchemaのSource有効化は未実施。管理実行未導入の空区画と不正欠測を分け、定義をprojectsだけに保持し、固定選定・Owner・試行値は同じSnapshot内の対象定義Hashへ結合する。五Context・初期化・履歴一回証拠を公開DTO化せず、旧新Mapを併存させない。

今回のSourceでは判断記録・受入入力・世代Envelope等の型7宣言と検査5公開値をDomain `decision/types.ts / validation.ts`へ移し、Coordinatorの旧`decision/records.ts`を撤去した。直接利用側・型検査・Root公開集合・Symbolの安定ID・現行Architecture／QA Traceを追従。型除去・空白を除く既存検査本文の一致を独立確認し、条件緩和は検出されていない。認可・Capability発行・横断適用・物理Storeは元Ownerに残り、一般CRUD／Writer全面移管の完成ではない。

移管後の関連35件、固定I/Oと閉集合18件、単独の既存再計画一例が成功。Domain／Coordinator／MCP／Workbenchの型検査、変更93 SourceのFormat／Lint、差分検査、Task設計Trace検査が成功し、限定独立再レビューの残指摘0。Root Checkerは3,722エラーのまま、新しい移管Path／Ownerエラーはない。判断Store・再計画・状態をまとめた試験はStore前半3件の成功後に中断したため全体未判定であり、対象親子Processの終了だけを読取り確認した。中断試験の生成Root清掃は未確認で、保持物を含む強制清掃はしていない。再計画を一例に限定した実行は約18秒で成功しており、固有hangや製品故障とは断定しない。Checker naming全体も16成功・6不合格（既存Rust名、DI公開集合差、3つの実行環境junction拒否、既存Header不足）で、全体合格ではない。AI再送・Docker・過去保持物の操作は行っていない。

続いてWriterの三つのopen／fstat／fsync／close区間をDomain `storage/state.ts`の固定対象操作へ移した。履歴正本だけopen前に期待実体を固定する差、対象ごとのOwner照合時点、履歴だけの追加Effect記録、対象別の置換理由を維持した。三対象×八条件の24組合せと不正名拒否を一つの親試験で確認し、保存I/O・公開境界・状態遷移の計44件、単独の判断回復Store三件が成功。公開集合の期待順序一箇所は初回不一致を是正して再実行した。Domain／Coordinator型検査、変更五SourceのFormat／Lint、Task設計Traceと差分検査が成功し、限定独立レビューの残指摘0。一般CRUD・Snapshot Writer全体・Core単独成立は引き続き未完了であり、この物理I/O切出しを完成とは扱わない。

同じ候補の公開受付・受入判断・Platform独立回帰も22件成功し、この追加バッチの関連試験は計69件成功した。実保存を含む公開受付試験は約150秒で完走し、同内容再入場での再送なしを確認した。途中の無出力から停止・権限故障を断定せず、今回は中断していない。実行は外部AIなしで、各試験の自己生成領域の清掃hookを用い、過去保持物・Dockerを操作していない。

続く依存閉包の確認で、完全codecはCoordinatorの状態・受領・Workspace・履歴の純粋検査に加え、Docker側の修復checkpoint等の純粋codecにも依存すると確認した。Domainから実行Packageを逆参照したり、相関検査を省略して全体codec成立とはしない。現在の実資源観測・真正Owner確認は元Ownerに保ち、保存値の閉形式・相関検査を分離する必要がある。現時点で全宣言の移管閉包確定や全面移管完了とは扱わない。

この確認と並行し、保存途中版の純粋再入場分類をDomain `classifyRuntimeSnapshotReentry`へ本文不変で移し、CoordinatorのWriter一呼出しを接続した。三つの既存試験をDomainの `tests/unit/storage/state-reentry.contract.test.ts`へ移し、Symbol／Catalogの安定IDを保持してOwner・Pathを追従した。関連18件、状態・実判断回復Store回帰32件、Domain／Coordinator型検査は成功。限定独立レビューは残指摘0。これは一般CRUD・新Schema・Writer全面移管の完了ではなく、その未完状態を維持する。

### 完全codec依存分離のチェックポイント

正規byte表現・Hash・UTF-8検査をDomain `state/codec.ts`へ、完全Snapshotの純粋な依存閉包154宣言を`state / task / attempt / workspace / ai-selection`へ移した。Coordinator・Docker Isolation・AI Adapter・Version Controlの利用側をDomain Rootへ接続し、空になった旧専用Fileを撤去した。保存Schemaは既存v5のままであり、新Schema、一般CRUD、Snapshot Writer全体のDomain接続は引き続き未完了である。

独立レビューは型除去・内部名対応後の73関数本文一致と、Domainから実行Packageへのimport逆依存0を確認した。指摘された内部helperの過剰公開、固定配列・辞書の変更可能性、VM試験のalias未接続、現行Architecture・Symbol登録の追従漏れを是正した。追加観測で凍結RegExpでもcompileにより内部文法が変わるため、正規表現実体のRoot公開を除き、Hashは既存関数、Workspace Commit IDは純粋判定関数へ接続した。許容文法・Schema・unknown・真正Owner確認時点は変更しない。

依存分離後の状態・相関・再入場・固定I/O・公開境界80件が成功し、公開固定集合の変更拒否を追加した再回帰75件、非Windows修復VMとVersion Control利用側閉集合13件、Provider値変換15件も成功した。件数は重複を含む別実行であり合算しない。7影響Packageの型検査とTask設計Traceは成功。Root文書検査は既知の3,722エラーを維持し、全体合格ではない。

実保存を含むWindows修復結合は制限下35件不合格で、許可環境の代表一例も期待する模擬取得回数に不一致が残る。VM別名の接続欠落は修正したが、これを全失敗の原因や解消と断定しない。Task実行・受付を含む一括回帰はTask実行Suiteが長時間終了せず、exact親子Processの確認後に終了したため未完了。試験物の強制削除や保持物の操作はしていない。これらは後続のWriter／利用側接続時の調査・固定回帰へ引き継ぎ、チェックポイントのCommitを全体完成やQA合格へ読み替えない。

是正後の固定回帰は状態・相関・再入場・固定I/O・公開API・Version Control利用側を合わせ93件成功。変更182 TypeScriptのFormat／警告を失敗とするLint、Domain・Coordinator・Version Controlの再型検査、差分検査を確認した。Lintの既存情報診断は残すが警告・エラーは0。Windows修復結合と中断したTask Suiteをこの成功数へ含めない。

最終のRoot全数確認で、利用側に不要な局所validator等と残る二つのRegExp実体を非公開化した。内容Hashだけは正規byte表現とCASの公開責務をArchitectureへ明記して維持する。完全メモリの修復結果結合は、移管したencoderをVM依存へ渡していない試験側の追従漏れを是正し、既存26件すべて成功。公開境界・計画検査を含む同実行42件が成功した。

Windows修復Suiteには、静的importから`operation.ts → recovery.ts → Docker Isolation`をmock登録前に評価する経路がHEADにも存在した。今回新設された経路とは確認できないが、実Docker到達の有無も確定できないため、このSuiteの追加実行は停止する。本バッチのWindows試験について実Docker操作0とは主張しない。Sourceの移管やメモリ試験の成功を、この実境界の解消・回収証明に使わない。AI再送・Dockerの追加照会や修復・保持物操作は行わず、試験構成の是正を別の必要な非AI作業として追跡する。

### Windows試験是正とWriterの次の分離単位

`runtime-repair-owner`のModule mock二箇所を撤去し、実修復関数本文だけを29個の明示依存へ結合した。技術三操作は既存のUsing／模擬処理へ固定し、依存欠測と実DI関数の混入を組立て時に拒否する。実Writer・Kernel・故障注入・既存Oracle・清掃hookは維持した。非Windows反例一件、Windows代表一件と型検査が成功し、組立てに対する独立レビューは残指摘0。後続の修正版Suite全79件も成功した。この確認を過去の実Docker到達未確定の解消に流用しない。

Writer全面移管は、`commitCoordinatorStateSnapshotOwned`だけのFile移動では閉じない。五Contextのprivate `settlements`、初期化の`initializations`、履歴一回出版の`historyAttempts`、準備・commit・解放を一つのDomain保存Ownerへ移す。元Controller／Host／Leaseの真正Map、Docker終端・未発行通知の検証は技術Ownerに残す。処置前のbooleanへ置換せず、現在Ownerの同期照合を元のI/O時点で維持する。

その前提になる一般Task更新の純粋閉包六宣言を、Domainの`task/crud.ts`、`state/transition.ts`、`attempt/validation.ts`、`state/validation.ts`へ実体移管した。候補生成・Task正規化・共通CAS遷移・受領相関遷移・修復終了条件・固定履歴行導出が対象で、内側の受領相関遷移は非公開とする。Coordinatorの旧宣言・互換re-exportは残さず、利用側をDomain Rootへ接続した。既存Decoderへの短い委譲は同じ完全codecへの直接呼出しへ置き換えた。限定独立レビューの残指摘は0である。

新Schemaの型と純粋codecを追加し、Coreの作成途中の定義と、固定Selection／Ownerを持つ管理実行投影を分離した。定義Hash・Task順序・全区画相関・不正欠測を検査し、旧Schemaを新codecで受理しない。Coreのみの定義へ架空の実行選定やOwnerを補完しない。個別CRUDの途中状態を許す値検査と、`savePlan`／管理実行時の完全性検査を分けたが、既存の実行受付条件は維持する。これらは純粋値境界の実装であり、新Schemaの本番保存切替や一般CRUDの完成ではない。

Windows全回帰の最初の修正版は79件中66成功・13不合格だった。追加調査で、移管先Moduleの内部へ故障注入が届かない試験構成と、旧形式の合成Operationを確認した。Lock・固定I/O・Writerの実Sourceを同じVMへ組み込み、現行の固定選定・Task Attempt・受領形式へ試験入力を追従した。安全判定・Writer本文・期限・Oracleを緩めず、残る対象親子29件は成功した。再度の全79件はすべて成功し、取消・skipは0だった（約28分）。これは別実行の終端結果であり、部分結果を合算したものではない。現在の独立確認も過去の実Docker到達未確定を解消するものではない。

移管後の状態・相関・新Schema・Core検査・公開API・再入場の固定回帰79件、通常Task受領のWindows実保存一件、Domain／Coordinator型検査が成功した。子Process試験本文のDomain API参照三種類は構文・実exportの存在を確認したが、子Processの実結合成功とは扱わない。一般CRUD、五Context／初期化／履歴一回証拠と物理Writer全体、Reader／利用側の新Schema本番切替は引き続き未完了である。任意bytes用Writer、汎用validator callback、旧新Mapの二重登録は追加しない。AI再送・Docker・過去保持物の操作は行っていない。

Domain通常全回帰は290件中237成功・53不合格だった。リンク作成の環境拒否、Lock取得・回復試験の不成立、既知の試験台帳未登録を含む。全53件の原因を今回の移管へ一括帰属せず、変更対象の限定回帰と区別して全体不合格を維持する。Root文書検査も不合格のままであり、今回の限定独立レビューをRepository全体QAへ昇格しない。

同じDomain候補を必要な実行権限で再確認した結果は290件中287成功・3不合格だった。一時領域は今回専用のRepository-local Rootへ限定し、元の53件中50件はこの条件で成立した。残る3件は既知のTest Catalog未登録5 FileとWindows Process Profile不足1件であり、安全検査を省略せず不合格を維持する。今回の専用Rootは試験終了後の空・非ReparsePointを確認して非再帰削除し、不存在を確認した。過去保持物は操作していない。

続く小バッチでは、終了履歴の全行codecと期間保持候補の2関数をDomain `state/history.ts`へ本文不変で移した。旧Coordinator decoderへの短い委譲は、同じDomain完全codecへの内部aliasで直接接続した。物理File・実排他・出版・読戻し・現在Ownerは元の保存処理へ保持し、Coordinator／Workbenchの直接利用側とVM・子Process試験本文をDomain Rootへ追従した。状態・履歴・修復結果・公開境界67件と3Packageの型検査が成功し、限定独立レビューは残指摘0。移管後は実Writer接続に関係する限定Windows親子29件も成功した。前CommitのWindows全79件を本バッチへ流用せず、結果範囲を区別する。子Process本文の新しい4つのDomain参照は構文と実exportの存在を確認したが、子Process実結合の成功へ拡張しない。一般CRUD・新Schemaの本番保存切替・Writer全面移管は引き続き未完了である。

### 保存候補・遷移検査の依存閉包移管

追加45宣言をDomainの`state/crud.ts`、`task/crud.ts`、`state/validation.ts`、`attempt/validation.ts`、`attempt/repair-validation.ts`へ移した。同じSnapshot候補間の相互参照は一Fileへ保ち、再export専用Fileや新しい循環を追加しない。旧Decoderへの短い委譲とDIの旧`repair-state.ts`を撤去し、Coordinator・DIの本番ConsumerをDomain Rootへ接続した。このバッチ時点では一般CRUD・新Schemaの本番保存切替・物理Writer全面移管が未完了だった。以下のSource切替と区別する。

独立確認で指摘された試験専用7関数のRoot過剰公開を除き、修復・再起動・終了要約の直接値検査をDomainの試験へ移した。Coordinatorの保存／再起動結合は公開候補・codec経由のOracleへ追従した。Source宣言を構文木から取り出す既存試験補助はDomain試験側へ一実体で移し、利用側だけを追従した。DomainからCoordinatorの製品内部・試験補助への逆参照を残さない。

状態・要約・修復結果・Root公開境界・DI境界の固定90件、再起動の本番組立て15件が成功。追加のWindows修復親子29件も成功し、実Writer・Kernel・故障注入・既存Oracleを維持した。各実行を合算した全体QA合格とは扱わない。移管に伴う古いSource位置・VM依存・公開集合期待の追従漏れは是正し、初回不合格を隠さない。保存形式・I/O時点の真正Owner確認・Timeoutは変更せず、AI再送・Docker・過去保持物の操作は行っていない。

最終確認では、Checkerの旧DI公開Module期待と移管済みSymbolのOwner／検証関係の追従漏れを是正し、再起動結合へrevision・previousのexact連鎖検査を追加した。独立確認でこれら以外の残指摘は0。是正後の再起動15件とWindows29件は再実行でも成功し、4Package型検査、変更51 TypeScriptのFormat・警告を失敗とするLint、Symbolの一意Owner・実在Path・安定参照を確認した。Checker全体は16／22成功で、Rust名・既存Header・実行集合・環境のjunction拒否等の不合格を維持する。公開集合の限定再確認はDIを通過後にCoordinatorの既存Header不足で停止した。試験台帳の回帰も27件中24成功・3不合格で、既知の未登録5 FileとWindows実行Profile不足を保持し、今回追加・移管した試験の未登録はない。これらを全面移管の完了やRepository全体QA合格へ読み替えない。

### 新Schemaの既存Reader／Writer接続

Sourceの正本を `crdd-domain/runtime-state/v1` へ切り替え、旧codecを撤去した。定義は`projects`、固定選定・Owner・Task実行値は`managedExecutions`へ一度だけ保存する。既存の単一CAS、元unknown、exact参照、受領相関を維持し、旧v5は拒否する。Core-onlyの定義へ架空の選定・Ownerを生成しない。保存先は変更せず、既存の実データ・過去保持物を移行・削除していない。

通常更新のCore-only兄弟の本文・順序保持と、不正な技術行を試験fixtureが上書きしない反例を追加した。既存の部分再計画は実StatePort／Writer保存後に再読し、定義Hash、Task順序、旧Attempt／Operation／Authority／settlement、兄弟定義、古い世代の再保存拒否・正本bytes不変を確認した。この再計画fixtureの回復・受領・Candidateは空又はnullであり、非空本文の一般保持を立証したとは扱わない。非空の受領・回復相関は別のcodec／遷移反例と区別する。

固定された非AI回帰90件、Windows実Writer修復29件、実保存の部分再計画一件、Domain／Coordinator／Docker Isolation／Workbench／MCPの型検査が成功した。fixture上書き・利用側の技術Task参照・旧配置文字列切出しの追従漏れは是正し、一次診断反例一件も再成功した。変更30 TypeScriptのFormat・警告を失敗とするLintと差分検査は成功。Schema接続差分の独立レビューは残指摘0。

別の広域回帰は208件中204成功・4不合格で終了した。原因は移管前Pathからの宣言抽出一件、制限環境でのjunction作成拒否二件、容量fixtureの重複Path／受入条件一件である。宣言抽出は現OwnerのAST参照へ、容量fixtureは一意値へ是正した。診断一件・容量境界一件は各々再成功し、junction二件も必要な実行権限付きで成功した。容量Oracleの16MiB−1／16MiB／16MiB＋1、超過拒否・元本文不変・pending不存在・許容時の実保存と再読を維持し、製品上限・安全条件は変更しない。是正の独立再レビューは残指摘0。個別の成功を208件一括再成功へ合算せず、初回不合格と全体QA未完了を保持する。

現在の残件は一般CRUD、Domainへの物理Reader／Writer・短期保存Owner・五Context・初期化／履歴一回証拠の全面移管とその固定入口接続である。任意候補Writerや汎用callback取引をDomain Rootへ公開して完了させない。Coordinatorの真正Owner確認とDomainの保存を、既存と同じI/O確認点へ結合する必要がある。新SchemaのSource接続を、この全面移管・Core単独成立・既存実データ移行の完成へ読み替えない。

### 物理Writer移管前の固定保存用途への限定

Host清掃準備の本番二呼出しを、任意candidateの保存から、元操作Owner・exact回復参照・beforeだけを受ける固定用途へ変更した。保存側で同じOperation・解放済みLease・未要求のHost清掃を確認し、pending候補を再導出する。利用側のMapからcandidateを除去し、同じ確定版の再入場は全結果fieldを保持して無書込みで確認する。第三の状態と不正元版は拒否し、pendingの厳密再照合は既存Writerへ保持した。新しいMap・Lock・Registry・復旧方式は追加していない。一般CRUDと物理Writer全面移管は引き続き未完了である。

実Source・実codecの局所試験で不正元版・別操作・偽Owner・読取り後失効・解放不明・第三状態・確定済み結果全文を確認した。既存の本番Owner再入場試験は、移管済み純粋関数の模擬置換先が旧Storageに残っていた。現OwnerのDomainへ追従し、未設定Storage関数は実I/Oせず例外停止する代役として一件成功した。

Windows実Writerの追加子Caseは、rename故障で残る同一pendingの再入場、一回改訂、pending／markerの不存在、別pending拒否・元本文不変、確定後再入場の返却全文・書込みEffectなしを確認して成功した。ただし同時実行した既存の親Caseは、後続のKernel解放観測故障注入で期待した停止を観測できず不合格（親子二件中一件成功）だった。この初回結果は保持し、以下の追従後の成功と区別する。

現在の短期保存Lock・Domain固定I/O・Coordinator Writerの実Sourceを一つの試験用閉包へ接続し、故障注入先を更新した。既存の修復保存試験の同じ組立てを試験補助へ集約し、未指定の依存・製品判定・実FilesystemとKernel・Oracleを維持した。fixture内のMapは一実体だが、製品singleton成立の根拠にはしない。後続のdata URLに残った移管済みparseHostRecoveryTokenの旧importもDomain Rootへ追従した。製品Source・Root公開API・保存Schema・Timeoutは変更していない。

追従後のWindows保存・pending再入場は親子二件とも成功（約134秒）、共通補助へ追従したWindows修復保存は親子29件すべて成功（約128秒）した。本番Ownerの再入場反例一件、Coordinator型検査、変更試験のFormat／警告を失敗とするLintも成功した。試験補助はfile Symbolに登録し、新SuiteとしてCatalog登録しない。初回不合格や全体QA未完了を消さず、一般CRUD・物理Writer全面移管の完了へ換算しない。AI再送・実Docker・過去保持物は操作していない。

正常Owner一回形は、旧import追従後に清掃結果受領の期待と不一致だった。試験先頭の静的importがmock前に終端Moduleを評価し、後置した技術観測の代役へ届かない接続を確認した。各Caseでmock設定後に実settlement Moduleを一回だけ評価し、その全exportを同じcanonical参照へ結合した。prepare／capture／settleは同じprivate Mapを共有し、Owner終了・清掃後に逆順でmockを戻す。実判定・Oracleを変更せず、同じ一回形は約70秒で成功した。複数回・保持あり形の全回帰へ拡張せず、この初回不合格と限定再成功を区別する。限定独立再レビューは残指摘0だった。

同じ保存補助へ追従した認証unknown専用WriterのWorkbench／CLI二形も、実保存・Owner失効の故障注入・既存清掃hookを含めて成功した（計約47秒）。これらは外部AI・実Docker・認証情報を使わない合成試験であり、過去の実AI失敗や保持物の回収成立を示さない。

### 短期保存の遷移・閉鎖・退役条件のDomain接続

Coordinator `state/transition.ts`の観測型、区画遷移assert、四つの閉鎖・退役条件をDomain `state/transition.ts`へ実体移管し、旧Fileを撤去した。Writerと履歴退役処理という現在の本番Consumerが使う値五名・型一名だけをDomain Rootで明示公開する。互換ラッパー・再export専用File・新しい判定機構は作らない。既存Symbol IDをDomainの実Pathへ移し、公開集合検査・試験補助・責務分類・Architectureを追従した。

実Filesystemの不存在・履歴確定を読む二callbackの生成は既存Writerに残し、同じ短期Owner・元の確認位置で呼ぶ。DomainはI/Oを所有せず、有限の同期観測を利用して既存条件を検査する。独立レビューは移管部分27,268文字の本文一致、観測時点不変、Domainから実行Packageへの逆依存・新値循環なしを確認し、残指摘0。状態・Schema・公開集合・責務分離の固定回帰76件、両Packageの型検査、変更SourceのFormat／警告を失敗とするLintは成功した。物理Writer・短期保存Owner・五Contextと一回出版証拠の全面移管、一般CRUD、Core単独成立は引き続き未完了である。

移管後のWindows保存・pending再入場は親子二件とも成功（約132秒）し、実Writerと既存故障注入の接続を維持した。旧Runtime撤去・履歴の回帰は13件中12件成功・一件不合格で、後者は合成Root内のHardlink作成が環境からEPERM拒否された。必要な権限で同じ一件を再確認して成功し、初回13件の全体成功へ合算しない。Task設計の実装・検証接続検査も成功した。AI再送・実Docker・過去保持物の操作は行っていない。

### 残る受付・受領の値依存と物理移管の閉包

短期保存Ownerだけの移管は行わない。`acquireCoordinatorStorageOwnerForRepository`の構造的Repository入力、`readCoordinatorStorageOwnerBinding`の生Kernel handle返却、任意HashからのKernel取得は現在Package内の信頼境界を前提としている。これらをDomain Rootへ公開して接続する案は棄却した。物理Reader／Writer・履歴・短期Owner・五Context・初期化／履歴の一回証拠を同じOwnerへ移し、最終の固定用途入口だけを公開する方針を維持する。新しいRegistry・Map・Lock・汎用callback登録を追加しない。

その前提として、受付相関`coordinatorSnapshotIntakeMatches`をDomain `state/transition.ts`へ、受領競合`hasProjectTaskResultAcceptanceConflict`を`task/crud.ts`へ本文不変で移した。旧`state/settlement.ts`は撤去し、Queueの事前照合とWriterのLock内fresh照合、既存受領反例を同じ実体へ接続した。四fieldの`ProjectTaskResultFact`をDomain `task/types.ts`へ定義し、State PortとWriterで共用する。型共通化で実行時のexact key・Task／Attempt／Operation・未解決状態の相関検査を省略しない。保存がDI Root経由で参照していた二つの純粋関数も、同じ実体OwnerのDomain Rootへ直結した。

固定回帰80件、両Package型検査、変更13 TypeScriptのFormat／警告を失敗とするLint、Task設計の実装・検証接続検査が成功し、限定独立レビューは残指摘0。追加受付試験は世代・Hash・対象の局所照合だけであり、全体codec・実受付成立へ換算しない。Schema・Map・Kernel・Writer分岐順・現在Owner観測は変更していない。一般CRUD・物理保存全面移管は未完了である。

同候補のWindows実保存・pending再入場も親子二件とも成功（約120秒）した。既存WriterのLock内で受付・受領を再照合し、Owner失効・解放不明・同じpending再入場の元Oracleを維持する。AI再送・実Docker・過去保持物の操作なし。この結果も一般CRUDや全面移管の完了ではない。

物理移管の固定入口化対象は、汎用`withCoordinatorSnapshotOperation`の本番呼出32箇所を持つ六つの利用元まで含める。判断六、Workspace二、Task／Queue十一に加え、実行Lease九、状態Query一、履歴退役三がある。後三者を対象外へ落としたり、汎用callback取引をDomain Rootへ公開して完了させない。各技術Ownerのfresh検査を元の位置に保ち、用途固定の状態操作と保存内部取引へ分ける。

### 判断記録六操作の固定用途化

受入判断の作成・最新読取り・確定、判断回復の作成・読取り・比較更新の六callback本文をDomain `decision/crud.ts`へ移した。Coordinatorの二つの既存Storeは、元の短期Owner内でfresh読取りした後に固定関数を呼ぶ。DomainへworkingDirectory、保存Owner、callback、Filesystem、判断Authorityを渡さず、新Store factoryや公開Result Frameworkを追加しない。非公開の値constructorは元の三field／五fieldと外側freezeだけを再現し、nested値を追加freezeしない。

元Envelope全文Hashによる二世代連鎖、generation二優先、重複拒否、expected全文一致、同じentryだけの世代加算、対象外区画保持、拒否理由を維持する。作成・確定で使うRepository bindingは既存保存入口が検証する。これらの候補APIだけで保存・人間判断の真正性・回復完了を成立させない。Rootは用途固定の六値だけを明示公開し、constructorと汎用保存取引を公開しない。

独立レビューで、一般CRUDとの混同を避けるため六公開名を既存のCoordinator専用型・Schemaと同じ接頭辞へ統一した。`prepareCoordinatorAcceptanceDecisionCreation`／`projectCoordinatorAcceptanceDecisionRecord`／`prepareCoordinatorAcceptanceDecisionFinalization`、`prepareCoordinatorDecisionRecoveryCreation`／`projectCoordinatorDecisionRecoveryRecord`／`prepareCoordinatorDecisionRecoveryUpdate`である。旧名・互換aliasは残さず、Symbol／Catalogの安定IDは維持した。最終再レビューは残指摘0。

命名修正前の局所・状態・公開境界回帰44件、状態codecを含む別固定回帰43件、公開Taskフロー・受入System五件が成功した（別実行・重複あり、合算しない）。命名修正後は局所・Root集合十五件、実Store四件が成功し、作成／比較更新各一改訂、読取りbytes不変、不正binding、重複・stale、元Hash破損・未知欄の拒否を確認した。両Package型検査、変更七TypeScriptのFormat／警告を失敗とするLint、Task設計の実装・検証接続検査も成功。Formatterの初回はWindowsのmapped-file拒否1224で一Fileの書込みが失敗し、その後の確認で改行不足二箇所を検出した。同Fileだけ整形し、最終確認は成功した。検査の初回失敗を隠さず、拒否条件や期限は変更していない。

物理保存、短期Owner、五Context、一回出版証拠と一般CRUDの全面移管は未完了であり、六操作の候補移管をそれらの完成へ換算しない。AI再送・実Docker・認証情報・過去保持物の操作は行っていない。

### Workspace二操作・現在状態投影の固定用途化

判断六操作に続き、Workspace二callbackと現在状態Query一callbackをDomainの固定候補・投影へ移す。元の三wrapper・汎用取引の内部実体・物理WriterはCoordinatorに残し、同じ短期Ownerでfresh値を読む位置、CAS・失敗・解放条件を変えない。残る未固定の値操作はTask／Queue十一、Lease九、履歴退役三。固定済み九操作も物理取引移管はまだであり、残数から汎用取引が消えたとは扱わない。

着手前の読取り専用確認により、Domainへambient時刻読取りを移す案は採用せず、既存の有限観測の先例に合わせた。Process IDはfresh callback内で値取得、時計は無名の同期関数一つとし、拒否・非削除では零回、削除候補の末尾だけ二回観測する。新しい型・Manager・Registry・保存Contextは追加しない。統合結果の同本文再入場・異内容拒否、QueryのSchema／ID共同拒否、Workspaceの世代・非使用・処置確認順序を維持する。

局所試験の初回は保留拒否のfixtureがdiscardingのpendingを欠き、先行する値形式拒否になった。fixtureに正規の破棄意図を与えて是正し、製品のvalidator・拒否順を変更しない。初期接続の余分なcommaと局所最小fixtureの明示cast不足も静的検査で検出・是正した。回帰と独立レビューの最終結果は確認後に追記する。AI・Docker・保持物の操作なし。

限定独立レビューのMinor二件は、用途固定clockと任意Snapshot callbackを区別するHeader、及び実Storeのclock例外Caseで是正した。追加Caseは実Reader／Kernel／短期Ownerを使い、局所合成Workspace／Leaseは物理保存しない。clock一回でthrowした後のexact拒否、state bytes・history bytes又は不存在の不変、同Rootの後続read／fixture固有write成功と一改訂を確認した。実Lease・Authority・Git回収や全体codecの根拠にはしない。再レビューは残指摘0。

固定したDomain局所・判断・Root・履歴十九件、既存状態Query五件、実結果Store五件、追加clock失敗一件、Workspace反例四件が各実行で成功した（重複範囲を合算しない）。両Package型検査、変更TypeScriptのFormat／警告を失敗とするLint、Task設計接続検査も成功。Formatterは追加ITへの初回書込みがWindows mapped-file拒否1224で停止し、同Fileのみの後続整形・確認は成功した。広域Workspace十八件を含む先行実行は継続中であり、このcheckpointでは完了又は全体成功としない。物理Writer・一般CRUD・Core単独成立・実AI E2Eは引き続き未完了である。

### Task／Queueの受付・追加・照会の固定用途化

初回棚卸しでは純粋な六callbackをDomainへ移す案を考えたが、着手前確認で実行対象選択とexact回復後の再開判断はCoordinatorの責務と照合し、編集前に除外した。Domainへ移すのは受付照合・Queue追加・Queue一件照会・State PortのProject照会の四操作だけ。新しいScheduling／回復方針は追加せず、両操作は既存Coordinatorのまま維持する。残る未固定の本番callbackはTask／Queue七、Lease九、履歴三の計十九箇所であり、すべてをDomainの業務判断へ移す意味ではない。固定用途の保存接続と技術Ownerの現在観測を分離する必要がある。

既存の追加入力型は宣言本文を変えずDomain `task/types.ts`へ移し、State PortはRootの同じ型を使う。旧宣言・互換aliasを残さない。Queueの三値操作は`task/queue.ts`、Project投影は`state/crud.ts`。四実値と既存一型だけをRootへ明示公開し、結果constructor・任意取引・保存Owner・Leaseは公開しない。元の短期Lock内fresh適用、成功／拒否理由、Hashと受付相関、未指定Workspaceのnull、同内容再入場の無書込み、対象外参照と外側freezeのみの封筒を保つ。

局所四件・Root十三件は成功。追加した実Store一件も、新規一改訂、Project／Workspace／Lease／結果／履歴区画不変、照会・同ID再送・内容差拒否・既存受付照合のbytes不変を確認して成功した。選択順位・実Lease・別Process競合を含む既存回帰と独立レビューは別に確定する。AI再送・Docker・保持物操作はなし。

選択順位・稼働Ownerを横取りしない条件・Repository単位の実Lease・別Process競合の四件と、追加CRUD一件・状態Query五件の固定回帰十件が成功した。別のDomain局所・判断・公開集合・履歴二十三件も成功（重複実行は合算しない）。両Package型検査、変更九TypeScriptのFormat／警告を失敗とするLint、Task設計接続検査は成功した。

独立レビューは製品契約の指摘零、試験Minor一件だった。実Storeの対象外比較を部分配列の列挙からSnapshot全文比較へ補強し、許容差を一改訂・Queue一件追加・受付結合一件追加の三項目だけに限定した。是正後の同実Store一件とDomain Queue／Root十七件は再成功し、限定再レビューは残指摘零。Sourceの判定、Writer、実行優先順位や回復処理を変更していない。

先行Workspace広域回帰は別実行のまま継続中で、途中のstderrに`fatal: Needed a single revision`二行が出た。Case名・終了結果は未確定であり、原因・成功・回収を推定しない。今回の四操作の限定結果とは分けて追跡する。物理保存全面移管・一般CRUD・Core単独成立・実AI編集E2Eの完了には換算しない。

### Task／Queue残七用途の候補接続

先行Workspace広域回帰の最終結果を取得した。Workspace十八件・結果Store五件・状態Query五件の計二十八件が成功、失敗・取消は零、実行全体は約二十九分だった。途中のGit診断二行だけから失敗とは判定せず、最終のCase結果と区別する。これは先行の固定版に対する結果で、以下の七用途や物理Writer全面移管の根拠へ流用しない。

`d43e623e3`を基準に、残る十九用途の入力・現在観測・候補差分を[対応表](runtime-domain-storage-after.md#runtime-domain-fixed-storage-uses)へ固定した。そのうちTask／Queue七用途をDomain `task/queue.ts`へ接続した。単発受付・単発更新・未開始終了、一般Queue更新、選択差分適用、exact回復後適用、Lease解放確定の候補である。Schedulingの選択・回復処置の発火はCoordinatorに残し、Domainは閉じた決定値の整合を再検査する。新Schemaだけを復号する現在の保存入口から到達不能な旧Lease証拠fallbackは撤去し、旧形式の移行を製品へ戻さない。

単発更新の借用先行、一般更新の前提検査後借用、同じ実Leaseの六field投影・生存一回、成功末尾だけ時刻二回を維持する。Rootへ公開するのは利用中の七固定候補だけで、任意Snapshot取引、保存Owner、生Kernel handle、constructorは公開しない。選択の元世代・対象・限定差分に不整合があれば`orchestrator_queue_selection_invalid`で停止する。物理Writer・新しいScheduling・回復Framework・Map／Lockの追加は行わない。

独立レビューのModerate一件は、一般Queue更新の引数生成による後段fieldの先行評価だった。用途固定の五accessorで元の短絡順と複数読取りを維持し、borrow内の余分なtruthiness再読を除いた。実Store試験へ欠測／世代／再開条件／結果参照／遷移の各拒否でのgetter列・bytes不変、実Leaseの正常更新での元getter列を追加した。利用側の実LeaseをDomainへ渡さず、この投影を汎用reader Frameworkにしない。

新局所八件・既存Queue四件・公開境界十三件の計二十五件、両Packageの型検査とTask設計接続検査は成功した。七用途接続後の先行IT九件も成功したが、accessor是正前の結果なので是正後の再実行と区別する。Domain全文の通常入口は整形・型・警告を失敗とするLintを通過後、三百二十六件中二百七十三件成功・五十三件不合格・取消零だった。Hardlink／SymlinkのEPERM、Kernel／回復試験の拒否やTimeout、既存Catalog六診断を観測したが、五十三件すべての原因を同一環境原因とは断定しない。検査を緩和せず、現在の七用途の局所成功で全体不合格を上書きしない。

三十二本番callbackのうち候補本文を固定した用途は二十、残りは実行Lease九・履歴三の十二。二十用途でもCoordinator内の物理取引はまだ使っており、汎用取引撤去・物理閉包の全面移管・一般CRUD・Core単独成立は未完了である。AI再送・Docker照会／操作・認証情報・過去保持物操作はなし。新しい合成試験物だけを既存hookが処置する。

accessor是正後の固定IT九件はすべて成功（約三百三十四秒）、失敗・取消・skipは零。実Storeの先行拒否時getter列・bytes不変、実Leaseの正常更新列に加え、単発受付／終端、受付後取消、Owner喪失、別Process排他の元Oracleを維持した。別実行の状態遷移・世代喪失・履歴三十一件も成功し、合計して単一runとは表示しない。変更六TypeScriptの整形・警告を失敗とするLint、両Package型検査、Runtime／Task設計の接続検査は成功。最終独立レビューは残指摘零で、追加ITの字下げMinorは通常formatterだけで是正した。Domain全文の五十三件不合格、実AI未確認、物理保存移管未完了は維持する。

### Lease九用途・履歴三用途の固定候補接続

基準`9ef16c1e5`から、[十九用途の対応表](runtime-domain-storage-after.md#runtime-domain-fixed-storage-uses)に残る十二用途を接続した。Leaseの記録候補はDomain `attempt/lease.ts`、履歴の三候補は既存`state/history.ts`に置く。取得予約の資源不存在→Root→保存要求mark、取得確定の元intent→Lock実体確認、回復予約／確定のRoot・元Queue／intent全文再照合を維持する。Root投影は実StatsでなくRootと既存実体Hashの二field。PIDはCoordinatorの値入力で、Process生死・実Lock削除・opaque Map・回復発火は同じCoordinatorに残す。

Lease証拠生成の製品Consumerは三箇所だけだった。旧Storageの汎用Envelope生成・旧Directory Envelope Reader・旧exact証拠Readerの製品参照零を確認し、三関数二百十七行と未使用importを撤去した。証拠生成はDomainの非公開一関数で、元Schema・全文・Hash・取得一世代／終了一→二世代・外側freezeのみを保持する。現行Snapshotが使用する型・validatorは削除しない。

履歴の物理出版はCoordinatorに保持する。退役ではSchema確認後、pendingあり／なしにかかわらず元の出版を一回実行し、成功後だけDomainへ進む。搬送ではpendingあり時だけ出版し、失敗時に候補を呼ばない。Domainは対象ごとの元位置で閉鎖条件と履歴を再読し、必要なQueue退役時だけ受付世代を一回生成する。結果だけの退役と退役零件は世代を生成しない。履歴再読のrecorded／expired以外は既存の未確認理由へ閉じ、publisher・Owner・handle・任意Snapshot callbackをDomainへ渡さない。

着手前の読取り専用確認で九用途・三用途の観測点と責務を照合した。独立レビューのModerate一件は、二fieldを持つ継承thenableをRoot投影として受理する不足だった。Proxy確認後にprototypeを通常Object又はnullへ限定し、then継承も拒否した。必須二fieldを持つ継承thenable、own accessor、Proxyの負例でthen／getter／trap零・mark零を確認する。pending生成Headerの出版済みというMinorは、fresh元版・出版前へ訂正した。再レビューは追加指摘零。実Root観測・理由・候補・物理処置は変更しない。

初回局所では証拠SchemaのOracleに旧名を誤記し三件不合格となった。実際の既存定数へ期待値だけを追従し、製品のSchema・Hashを変更せずLease八件成功。Lease・履歴・Queue・Root・要約の固定回帰三十九件、履歴の局所五件が成功した。反例追加後のLease八件も再成功した。初回のFormatterは実行中Nodeが参照するStorage FileでWindows mapped-file拒否1224となったため、余分な空行一箇所だけpatchで是正し、最終整形確認は成功した。両Package型検査、変更九TypeScriptの整形・警告を失敗とするLint、Runtime／Task設計接続検査も成功した。

実Storeの通常対象回帰は五十三件中五十二件成功・一件不合格・取消零（約八百三十三秒）。不合格は試験のsymlink作成がEPERMで拒否されたCaseで、局所再現でも同じ境界で停止した。必要な権限で同じ一件を新品合成Rootで再確認し成功したが、初回run全体を成功へ変更しない。別にWindows Owner喪失十六modeと取得／解放途中の二Caseが成功（約百九十六秒）、履歴退役・共有採用証拠の二Caseが成功（約七十二秒）した。最終Root検査追加後の実opaque Lease一Caseも成功（約三十秒）。実AI・Docker・認証情報・過去保持物は使用していない。

履歴の実Filesystem回帰は十一件中十件成功・一件不合格・取消零。不合格は試験Hardlink作成のEPERMであり、必要な権限で同じ一件を新品Rootで再確認し成功した。出版／状態の二段確定、pending再入場、fsync／rename失敗、衝突拒否・期間保持の元Oracleは維持する。これらは別実行で、単一runへ合算しない。先行Domain全文三百二十六件の五十三不合格とは、対象母集団も結果も別である。

候補本文の固定接続は三十二／三十二。物理取引とReader／Writer・短期Owner・history I/O・五Context・初期化／一回履歴証拠はCoordinator内部に残り、一般CRUD・Core単独成立も未完了である。次はこの物理閉包を同じ保存Ownerとして移し、用途固定入口を接続してから旧汎用取引を撤去する。生Owner・Kernel・任意WriterをRoot公開する暫定解、新旧Mapの併存は採らない。Source接続と既存物理保存先・保持実データの切替は別扱いとする。

### 物理保存移管の現在性接続準備

通常実行・業務保存・回復読取り・終端保存の四用途は、RevisionとOwnerの条件が異なる。独立した着手前確認を経て、[正式設計](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#50-save-context)へ接続条件を明記した。既存operation private bindingへ初回検証済みRoot参照を保持し、四借用へ非列挙・固定のRootと用途を加えた。既存の再観測本文・呼出し回数・Hash・Kernel・一回Mapは変更せず、新しいRegistry・Factory・公開APIは追加していない。Writer／Lock内の値型は元の三field投影を維持する。

実Repositoryの三Caseと五Suite三十七件は成功。三十七件の初回実行は三十六成功・一不合格で、既存の現在入場試験の正常fixtureに新Schema必須の`managedExecutions`が欠けていた。operation変更を基準版へ一時復元しても同じ失敗を再現した。fixtureに空集合だけを追加し、製品検査は緩和していない。型検査、変更Sourceの整形・警告を失敗とするLint、Task／Runtime接続検査は成功。五Source／試験の限定独立レビューは残指摘零。

この候補は全面移管前の接続準備である。物理Reader／Writer・短期Owner・五Context・一回証拠の移管、三十二用途の物理固定入口化と旧汎用取引撤去、一般CRUDの本番接続はまだ完了していない。過去の全体回帰不合格も解消済みとはしない。AI・Docker・過去保持物は操作せず、今回の合成試験物だけを既存hookで回収した。


### 共通保存の実体移管と一般CRUD接続 — 2026-10-28

基準`9f3599e20`から、共通Reader／Writer・短期Owner・保存専用Kernel・五Context・一回履歴証拠をDomainへ実体移管した。Coordinatorの旧Storage三Fileは撤去し、三十二用途はDomainの有限操作へ接続する。任意Snapshot callbackをPackage境界へ渡さず、実行・終了の元OwnerはCoordinatorが有限観測として搬送する。Mapの複製・新Lock・新Registryはない。

一般初期化・Plan保存、Objective／Taskの追加・更新・削除と用途別Queryは同じ物理Writerへ本番接続した。新Schemaだけを使い、保存先と既存データの有効化・移行は別。AI選定・管理実行・完了Evidenceを一般CRUDのために作らない。

独立レビューの物理再照合不足は、元Host現在性とVC実体再照合をANDする形で是正した。生Pathを受ける技術保存APIの公開過多も検出し、37入口を真正なVC Root必須へ切り替えた。旧string・偽参照の全入口拒否、private Writer／Lock／任意取引のRoot非公開を確認した。保護判断Storeはprivate Root資格・Native・Kernelとの不可分性を維持し、構造Path＋callbackのDomain公開factoryにせずCoordinator `decision/store.ts`へ配置した。

確認済みの別実行結果は、Core CRUD／故障5形／初期化故障2形と実Store保全・選択失敗の計12件、Root四用途3件、37入口の偽造拒否1件、Root exact公開1件、保存Consumer閉包4件。管理実行・Queueが非空の別Project保存で対象外全区画を比較し、履歴一行のbyte保全も追加後に再成功した。さらにCore CRUD・四用途／偽造拒否・保存Consumer閉包の三Suiteは固定候補で18件成功。出版後不明・解放不明を成功へ丸めず、同じpendingの明示再入場だけを確認した。新規の回復処置は追加しない。

Domain全文の一実行は352件中346成功・6不合格だった。公開集合・新Ownerへの検査追従漏れ、試験の内部import、既知Catalog六診断が含まれる。公開集合と保存Consumer閉包を是正し、Catalog未登録五File・Windows実Process profile一件も現在の実在試験に追従して台帳26件を再成功させた。初回全体結果を成功へ書き換えない。

試験Ownerも移管中。履歴11件、保存専用Kernel3件、独立Process短期Owner1件、marker保全・清掃2件に加え、物理Snapshotの故障・不存在等13件と純codec・相関7件をDomainへ移して各再実行は成功した。後二Suiteの独立レビューは安全条件・元Oracleの残指摘零で、整形指摘を是正後20件を再成功させた。Workbench固定Reader接続16件、Coordinatorのexact Queue読取り・実行状況投影9件、MCPの公開保存接続4件も成功。MCPの制限環境での初回失敗はloopbackのEACCESであり、同じ4件を通常権限で確認した。

CoordinatorにはHost・Home・実行・回復の共同契約を残す。保存Kernel移管後も残るHost/Home/Console七CaseをWindows実Process Gateとして明示し、実行Profile・Owner Runnerと同期した。七件は成功。台帳検査で検出した分類不一致を、実条件のある試験の分類追従で処置し、検査を緩めていない。生WriterをRootへ増設したり、内部import検査へ例外を足したりして移管済み扱いにはしない。残るWriter固有Case・旧試験Facadeの撤去、全体回帰と最終独立レビューを完了するまで全体完了とはしない。現在の公開境界検査は、Coordinator側の四試験／補助Fileにある七つの保存内部importを検出して不合格であり、既知として保持する。

AI再送・Docker照会／操作・認証情報・過去保持物は操作していない。今回の自己生成試験領域だけを既存helperで処置した。巨大な実行別Evidence書庫は追加しない。

#### 試験所有者の追加移管と公開Reader追従

旧Coordinatorの純粋な状態相関試験をDomain `runtime-transitions`へ移し、実Hostの終了観測だけをCoordinator `host-observation`へ分離した。物理Snapshotの三Case、16MiBの厳密境界、Host準備保存wrapper、修復／認証／Task／終端Writerの五つのguard反証もDomain保存Suiteへ配置した。Coordinator側に残る公開回収・DI接続二十四件は再成功した。移管を理由にprivate Writer・Lock・任意取引を公開していない。

単発受付・Queue・Workspaceの試験を既存の用途固定Readerへ接続した。公開投影に含まれない区画の不変性は、同じ自己生成保存物の全文比較で確認する。Workspace時計例外は実Leaseと固定保存操作を通す元Oracleへ戻し、一件成功した。単発受付四件は同じWriterで全件成功し、受付前拒否・受付後失敗・即時取消・Owner喪失を区別している。Core CRUD・Repository入力・保存Consumer・codec・純粋遷移・Host観測の対象回帰は二十七件成功した。これらは別実行であり、全体回帰一回の結果へ合算しない。

独立確認で検出した`delivery_none`の変異先誤りは、Coordinator workerからprivate Source変異を撤去し、公開された配送入口の拒否・Effect 0・全bytes保全へ修正した。同分岐一件は実Windows保存で成功。private条件の反証はDomainの局所試験へ置き、実Reader全体やFilesystem保証と区別した。限定再レビューは残指摘零。hardlinkの初回EPERMは保持し、同一Caseを必要権限で実行した成功と区別する。

移管後のDomain保存Suite全体は、Windowsリンク拒否・pending再入場・16MiB境界を含む二十四件が一実行ですべて成功した。五Writer反証の移管も限定独立レビューで残指摘零。型検査、変更TypeScriptの整形・警告を失敗とするLint、Runtime／Task設計接続検査、Windows実行Profile四件は成功。台帳・公開境界の合同実行は四十一件中四十成功・一不合格で、残る七内部importを正しく検出している。七参照が含まれる複合試験と旧試験アダプター二Fileはまだ撤去できていない。変更中に継続している先行広域回帰は最終固定候補の根拠にせず、全面移管・アダプター撤去・固定全体回帰・最終独立レビューの完了は引き続き未宣言とする。

#### 保存の反例と実Host結合の分離

保存初期化・一回証拠・別Root・同bytes実体置換・hardlink・pendingの反例をDomain Snapshot I/Oへ移した。終了保存・履歴・配送の私有Context相関はDomain `runtime-settlement`、修復の用途固定・出版変異・回収進捗・同bytes I/O 0・履歴欠測の独立guardは`runtime-repair-storage`が所有する。合成Host／技術checkpointを実Host終了・Docker修復の根拠にしない。Coordinatorには実Host清掃から公開終了保存への結合と、実修復Callerの再入場・保持・終了保証を残した。

この実結合で初回修復の接続漏れを検出した。通常用途の`access.identity`ではなく、既存`settlements`が`runtime_repair`として保持する同一Contextだけを初期化証拠の鍵へ使い、後続Writerと一致させた。コピー・空Object・別kindの拒否、解放不明時の証拠失効とfinallyでの除去は不変で、新しいMap・Authority・回復経路は追加していない。限定独立レビューは残指摘零。

Domainの保存・終了相関・修復履歴の三Suiteは一実行で五十三件成功した。その後に追加した出版用途変異等を含む修復履歴二十九件、修復no-op一件、Coordinatorの実修復履歴・五中断点十一件、実Host現在状態二件はそれぞれ別実行で成功した。Coordinator側のgenerated試験接続で旧保存Moduleを直接呼んでいた漏れも、既存Host保存Adapterへ追従した。正常終了は`settling`と履歴確認済み・耐久配送待ちを共同確認し、unknownを成功へ書き換えていない。

旧`tests/support/storage-source.ts`は参照・Symbolとともに撤去した。残る`storage-adapter.ts`の未使用終端Writer・再exportを除き、内部importは七件から同Fileの二件へ減少した。公開境界検査はこの二件で引き続き不合格。検査の例外追加や生Writer公開はしていない。Task状態保存は型付き固定APIへ、試験全区画の観測は固定公開Readerと自己生成物の現行codec投影の照合へ追従中。通常Task受領・State Port二件と実行Profile四件は成功、台帳は407件でvalid。固定全体回帰・残アダプター撤去・最終独立レビューはまだ未完了である。AI再送・Docker照会／操作・過去保持物は操作していない。

#### 保存内部参照と旧試験アダプターの撤去後

上段は撤去途中の履歴である。現在は七つの保存内部参照をすべて移管し、`storage-source.ts`と`storage-adapter.ts`を参照・Symbolとともに撤去した。公開境界検査は内部import零で成功し、例外・生Writer公開は追加していない。最後の九つの生Writer呼出しは、用途固定のProject／統合結果APIへの追従と、Domain側への保存反例移管で解消した。Domainの保存区画Caseは、受付結合・Queue／Lease・結果・判断二世代・pendingの拒否と本文保全を確認して成功した。合成Lease観測は実Host・実Lease終了の証拠にしない。

実Host結合とCoordinatorの有限APIは維持する。試験開始値を直接配置する箇所は現行codecで検証した自己生成fixtureに限定し、製品Writerの出版成功とは区別した。旧Decision Store試験のOS一時領域への書込み拒否は、Repository内の実体確認付き試験Rootへ追従して二件成功した。MCPの局所実行で発生したlocalhostのEACCESは試験環境の通信制限であり、本番認可やTimeoutを変更せず通常実行環境で確認する。

Source／Owner境界の最終独立確認はMajor／Moderate零。最新状態の記録漏れをこの段落とProject Contextで是正した。固定候補のDomain／Coordinator全回帰、Windows結合と利用側確認は進行中であり、進行中の結果を成功へ算入しない。Workspaceの全区画比較で対象Queue世代の既存更新を検出したため、対象WorkspaceとQueueだけを期待差分へ明示し、対象外区画のexact比較を維持して再確認する。実データ移行・保存先変更・Core全体の単独成立はSource移管の完了と区別する。AI再送・Docker照会／操作・過去保持物は操作していない。

#### 動的内部参照の追加確認

上段の内部参照零は静的importの検査結果だった。独立確認で動的importとSource読取りの検出不足を認め、同じ公開境界検査を`import(...)`・`new URL(...)`にも適用した。追加八参照を例外扱いせず、保存初期Reader・transient終了Readerの五故障・回収とHost清掃の二Writer・結果受理decoder・修復モデルをDomainの既存試験Ownerへ移管した。CoordinatorにはHost／一回性／借用失効と有限の公開結果変換を残す。Root以外の公開や新しい試験用保存Adapterは追加しない。

移管後の公開境界・現在入場・再起動準備の合同三十八件、修復モデル二十件、decoderとCoordinator状態遷移二十九件は各別実行で成功した。回収WriterとHost清掃Writerは各九故障を維持する。独立レビューが指摘した部分fixtureを、正規操作準備と新codecで確認する完全Snapshotへ是正し、Host遷移後と清掃準備後も故障注入前に復号を確認して二件再成功した。これらは保存guardの試験で、実Host・Docker処置の証明ではない。Catalogは408件でvalid。

Windows結合の先行実行には、旧CLI引数、撤去済み受領field、旧保存Ownerへのmock登録という試験追従漏れがあった。現行`recovery resume`、四fieldの配送参照と結果領収書の不存在、実Host保存Adapterへの登録へ修正し、製品の拒否条件や期限は変更しない。人間向け回復案内の四箇所も同じ現行CLIへ追従した。各代表例の成功は確認済みだが、全条件の固定再確認は継続中で、先行不合格を上書きしない。

Domain／Coordinatorの全回帰とWindows固定再確認の終了結果は未確定。MCP／Workbench利用側34件は通常実行環境で成功し、制限環境でのlocalhost EACCESによる先行失敗とは別記する。現在の失敗試験Rootと過去保持物は強制回収せず保持し、今回許可されていないAI再送・Docker照会／操作は行っていない。

その後の自己横断確認で、現在入場試験がDomainの試験補助を経由して私有Storeを利用している接続を一件検出した。実Reader／初期化故障／短期Owner／物理境界のCase全体をDomainへ移し、Coordinatorには正式Rootと実Readerの結合、および有限結果の公開投影を残した。Domain側一件とCoordinator側四件は別実行で成功。Scannerはside-effect importを含む四構文とRepository内の相対参照閉包を検査し、内部Sourceへ到達する試験facadeを拒否する。中立fixtureは名前allowlistでなく依存内容に基づいて許可し、直達・中継の変異も検出する。十三件成功、最終独立確認は残指摘零。製品API・Source・安全判定・期限は変更していない。

Domain全体は一実行463件すべて成功した。この全実行後に移した入場Reader一件と強化Scannerは上記の別実行で確認しており、464件の単一runとは表示しない。CLI公開投影十四件、変更89 TypeScriptの整形・警告を失敗とするLint、Domain／Coordinator／MCP／Workbenchの型検査、Runtime／Task設計接続検査も成功した。Coordinator全体とWindows再確認は引き続き終了待ちである。

追従後のWindows固定再確認は十七件すべて成功した（約十五分）。CLI七形、Owner喪失五形、認証create例外五形であり、実Docker・認証情報は用いない。Domain全回帰、追加入場Reader、利用側34件とは別実行として扱う。旧候補の同条件不合格は撤回せず、試験引数／mockの追従後結果として記録する。文書検査は今回要求した八文書の指摘零、参照展開先に3376指摘が残る。移管した試験SymbolのQA参照二件を正しいOwnerへ追従し、独立確認は追加指摘零、Catalog408件validである。

Version Controlの既知Consumer集合にも旧保存三Pathが残っていたため、実移管先の四保存FileとHost側利用元へexact集合を追従した。三つのfresh子Processの公開Root検査は、Coordinator一・Domain保存I/O一・終了保存一の合計三を維持する。Domainの三型参照だけをstatic Named type importへ揃え、実処理・呼出し順は変えていない。初回十二件中四不合格、追従後十二件全成功と限定独立レビュー残指摘零を区別して記録する。現行のArchitecture・Quality・Source・配布入口に旧保存四File／旧試験Adapter二Fileの参照は残っていない。

Source区切りを`d6db2a557`としてcommit・pushした。進行していたWindows六Suiteの最終結果は120件中103成功・17不合格・取消零（約72分）。不合格は上段のCLI七形・Owner五形・認証例外五形と一致し、追従後の別実行17件すべての成功へ対応付く。先行run自体は不合格のまま保持する。保存・修復の13本体Caseとその負例、TaskのOwner喪失・Lease・判断・受領・Queue・受付相関の六Caseは先行runで成功した。単一runの120件成功には読み替えず、実Docker・AI・過去保持物への実境界成立も主張しない。

#### 全体回帰で検出した試験追従と実行環境の分離

Coordinator portableの先行全実行は終了値1であり、成功とは扱わない。削除済み保存SourceへのOracle、Host保存AdapterとDomainの二重mock登録、移管前のReader名、検証ToolのCatalog依存、Native依存mockの不足を検出した。現在Ownerへ試験を追従し、元の拒否条件・一回性・Effect零・相関Oracleを維持した。保存のController非依存OracleはDomainの既存Snapshot I/O Suiteへ移し、`ERB-IT-004`をSymbolへ追従した。製品Source・Timeout・安全判定は変更していない。

助言試験の実Repository依存も分離した。先行回帰時の`PROJECT_CONTEXT.md`は65,729 byteであり、既存65,536 byte上限による拒否は正しい。上限を広げず、既存の境界確認付き試験Directory helperで合成Gitと短いContextを作り、本番Reader・Packet固定・模擬Dispatchを検証する。助言八件は成功し、独立レビューの手組み清掃指摘を既存helperへの置換で解消した。境界helperを含む共通保存Suiteは制限環境でhardlink一件EPERM、通常Windows環境で十一件全成功だった。環境拒否を成功へ書き換えない。現在案内は移管要約の重複を削って65,536 byte未満へ整理したが、試験の入力は今後の文書増減に依存させない。

Windowsのproduction doctorとOperation作成の二件は、共有試験TEMP内の既存`crdd-coordinator-recovery-v1`が継承DACL・保護無効であり、Nativeが`terminal_descriptor_mismatch`で拒否した。既存物のACL修復・削除は行わず、新品のRepository内試験TEMPで同じ二件を実行して成功した。端末descriptorという理由名はConsoleではなく、Host記録Namespaceの保護検査を指す。既存TEMPの不合格と新品TEMPの二件成功を別結果として保持する。

対象追従の限定独立レビューは指摘一件を是正して残指摘零。公開境界十三件、Catalog408件、Coordinator型検査も成功。全体静的checkは整形・型・警告を失敗とするLint・Runtime／Task接続の全段を終了値零で通過した（Lintには既存の情報診断96件があり、警告・Errorではない）。新品TEMPを用いたCoordinator全体再回帰は進行中であり、その完了と追加Owner試験の最終確認前に全体完了とは表示しない。失敗試験Root・過去保持物の操作、AI再送、Docker照会／操作は行っていない。

Source固定候補は`d6db2a557`と`40_Develop`差分のSHA-256 `995df43d4a6cf27800924b8f11e8184e9e379c2ab04e608ddda4b666933b57b7`で特定する。この候補のDomain全実行は465件成功・不合格零・取消零（約7分31秒）。先行463件と差分試験を合算した値ではない。Domainの整形・型・警告を失敗とするLintも終了値零。今回更新したProject Contextと本計画の文書指摘は零で、参照展開した過去CHGのリンク切れ23件は別範囲として保持する。先行の八文書から展開した3376指摘とは対象集合が異なり、その全件是正又は全体QA合格を主張しない。

#### 指定範囲の最終結果

上段の進行中表示は経過記録である。固定候補のCoordinator portable全回帰は1,797件中1,792成功・不合格零・取消零・skip五件、終了値零（約88分52秒）で終了した。skipは明示Gateを有効化していない実Docker関連四件と実Provider一件であり、成功へ算入しない。Host Windows専用Gateはportableの選択範囲外で、先行120件と追従後17件の別実行結果は上段のまま保持する。Domain465件、利用側34件、Version Control十二件も別実行であり、単一runの総数へ合算しない。

今回の保存内部参照七件と後発の動的八参照の移管、旧試験Adapter二Fileの撤去、関連利用側・試験の追従、対象非AI回帰と独立レビューは完了した。公開境界十三件は内部Sourceへの試験facadeも拒否し、例外・互換Adapter・生Writer公開を追加していない。Source・文書のレビュー指摘は是正して残指摘零。最終Source差分Hashも上記固定候補と一致し、整形・警告を失敗とするLint・diff checkは終了値零だった。

今回新設したexact試験TEMP `C:\project\CRDD\.crdd\tests\storage-final-env-vhGiiB` は全試験終了後、Root・非Reparse・空のHost記録Namespaceと自己生成Nodeキャッシュだけであることを確認して通常削除し、不存在を確認した。既存の不一致Namespace、先行失敗Root、過去保持物には触れず、ACL修復・強制属性解除・Docker照会／操作・AI再送は行っていない。実データ移行・保存先切替・Core全体の単独成立・実AI／Docker E2E・CRDD全体QA／Release完了は、このSource移管の完了とは別である。現在、この指定範囲を閉じるための人間判断はない。
