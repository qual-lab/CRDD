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

#### 正式契約提示後のCodex単段成功とClaude事前確認 — 2026-10-29

固定Source `bcb17d141186b1a5d2a7ce336fea329d066f3a24`で、承認済みCodex単段試験 `EXEC-20261029-02`を一回実行した。Engine・二つの固定Image・稼働Container零・新品Rootを事前確認し、端末の通常同意後に送信した。Modelは`gpt-6.1-sol`／medium、合成Promptは上段の2,188byte・同一Hashである。結果は`completed`、reason null、`TRIAL_EXIT=0`だった。

助言内容検査・元終端保存・技術清掃・排他解放・Native終了・子closeがすべてtrue、一次故障null、Provider開始・Process tree終了・Container／Network不存在の各観測もtrueだった。結果本文は保存せず、755byteとSHA-256 `3c34de1949cb8c891b5e327b340ab30a18537fb447fc69e1cbdd79571374c297`だけを記録する。exact回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.497a85c62b98a72875e8d25cd4fc6988f6efaa7de49618c6feea20ad7d1f2163.d14e739aac921a38fd0bd3f677eda256728ccf581c0b3bb662103b4e390002eb`である。

試験結果のfixtureCleanupConfirmedはtrue、fixtureRoot／reviewAfterはnullだった。終了後の読取り確認でも今回Root `C:\project\CRDD\.crdd\tests\executor-real-codex-EXEC-20261029-02`は不存在、試験CLIのNode Processは零だった。過去保持物は操作していない。この合格はCodex単段読取り助言の範囲に限定し、Claude・Direct／Isolated編集E2E・全体QAの合格へ拡張しない。

続くClaude事前確認は、記録更新と既存Source／試験の照合として実施する。新しい契約・状態・権限・判定・実装は追加しない。純粋な計画表示で`claude-opus-5-5`／medium、同じ合成Prompt・正式Schema・exact許可参照、固定Provider Image `sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f`と固定Proxyを確認した。既存の両Provider二十一条件は、実Parser・Normalizerと試験Hostを接続し、物理Home・Lease・Dockerは有限代役である。したがって実認証・Image存在・実通信の成立までは証明しない。今回はClaude送信・Docker照会／操作・過去保持物操作を行わず、実試験は送信範囲の承認後に一回だけとする。

Claude事前照合後のExecutor通常入口は整形・型・警告を失敗とするLintを通過し、全十五件成功・失敗零・取消零・skip零だった。ClaudeはCLIの`--json-schema`にも同じSchemaを渡し、共通Promptと別契約を作らない。両Providerの結果は共通Normalizerへ接続し、終端保存・実行失敗の優先順位と正常時限定のRoot回収条件を維持する。今回の更新は既存実測と照合結果の記録だけであり、新しい設計判断やSource変更を含まない。Codex合格の撤回・過去失敗の上書きはせず、Claude実送信の承認待ちとする。

#### Claude単段の実行成功と試験清掃拒否 — 2026-10-29

人間の承認後、同じSourceと合成Promptで`EXEC-20261029-03`を一回実行した。Claude `claude-opus-5-5`／medium、固定Imageは上段の値で、Engine・Image存在・稼働Container零・新品Rootを確認し、端末内同意を経た。内側結果はcompleted、reason null、助言内容・元終端保存・技術清掃・排他解放・Native終了・子closeはすべて確認済み。一次故障null、Provider開始・Process tree終了・Container／Network不存在の観測もtrue。結果本文は保存せず、2,492byteとSHA-256 `effedd9974e5c94d10548193c431ef11b2a8851ef6a1db1eb5ed4bd92af54550`を記録する。

外側は`blocked / trial_completion_unconfirmed`、`TRIAL_EXIT=2`だった。親の確定結果ではprotocolFailure／unexpectedStdoutともfalse。今回Rootの二十確定イベントは終了まで揃っているが、`tmp/claude-65534/`という空の通常Directoryが残り、試験清掃の「tmp直下が空」という条件に一致しない。Nodeのlstat／readdirでも非Symlink・子零、managementは空、試験Node Process零を読取り確認した。これは助言又はDocker技術清掃の失敗ではなく、試験Rootの清掃条件と実残存の不一致である。正常清掃条件を緩和・再実行せず、Rootは保持した。

exact回復参照`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.4a0badc3d71d52243f4770cac7b36316445905834c8be7aad05afca1af838088.4672f65b39be3cf868ebf177fc6c68e2a86ccbcf34cf53b6654b40e56dbc3953`、Root `C:\project\CRDD\.crdd\tests\executor-real-claude-EXEC-20261029-03`、再評価時刻2026-11-04T16:55:09.177Zを同じ結果で保持する。再送・Docker再起動・Image更新・過去保持物操作なし。次の最小是正候補は、試験Toolだけで今回Root内の既知の空Directoryを非Link・Identity・範囲確認後に回収可能にすることであり、任意の再帰削除や製品Recovery追加は行わない。実試験全体は清掃未完のため合格へ変更しない。

#### Claude試験Toolの既知空Directory回収是正 — 2026-10-29

人間の継続指示に従い、製品Sourceではなく試験Toolの正常終了後清掃だけを是正した。Claude・固定名`tmp/claude-65534/`・単一子・空・非linkを条件とし、Root・tmp・management・対象子のIdentityを捕捉して削除直前に再照合する。通常rmdirのみで、未知名・File・非空・Codex同名・観測不能・Identity差は保持する。Scope／名前／内容の一般化、再帰削除、製品Recovery、追加Lockはない。

独立レビューで中間tmpの再照合不足を一件検出し、祖先のIdentity保存と削除直前照合を追加した。既存のIPC／終端条件に加え、既知空子成功・Codex非該当・未知名・File・非空・子link／Identity差・親link／Identity差の九条件を同じ親CLI試験へ接続した。Link／Identity差はmetadataの有限代役で、実OS競合耐性の証明ではない。拒否時の子rmdir零と既存確定イベントbytes不変を確認する。最終Executor通常入口は整形・型・警告を失敗とするLint、全十五件成功・失敗零・取消零・skip零。独立再レビューは残指摘零、diff checkも成功した。

初回Formatterの書込みはWindows mapped-file拒否1224で実施できず、指摘された改行一箇所をpatchで整形して最終確認は成功した。修正前のClaude実試験の終了値二は変更せず、今回の実Rootと過去保持Rootは操作していない。AI再送・Docker照会／再起動・Image更新も行っていない。Source是正と非AI清掃試験の成立であり、保持済み実Rootの清掃完了や編集E2Eの合格とは区別する。

#### 今回Claude保持Rootの承認済み回収と編集E2E残件 — 2026-10-29

人間が`EXEC-20261029-03`のRoot確認後回収を明示承認した。試験Node零、元記録にある五資源のID／予定名が現Docker一覧にないことを読取り確認した。Rootと祖先の実体・非link、exact回復参照、元結果の全成功条件、二十確定イベントのHash／Provider／sequence、許可されたFile集合・非link／単一link、空management、tmp直下の既知空子一件を再照合した。保持結果の元Hashは`3b99eeb08c01266e9a9f4bdfd0e59b64ae0d82010d9134e5f96640fae318bedd`。CHGに元結果を保持し、outcomeの確定Pairを既存削除APIで回収した後、修正済みの限定清掃関数で今回Rootを回収した。fixtureCleanupConfirmedとRoot不存在はtrue。短命清掃Scriptも撤去・不存在確認済みである。

短命Script初回はimport相対Pathの誤りで評価前に停止し、対象変更なしだった。参照先だけ修正した後に上記回収を一回実施した。元の実試験終了値二は書き換えず、「Claude単段の実行・内容確認成功、試験Toolの清掃拒否、後日の承認済み清掃完了」として区別する。AI再送・Docker再起動・Image更新・他の保持Root操作はない。

次のDirect／Isolated編集E2Eの残件は次のとおり。今回は棚卸しだけで実行・Source変更はしていない。

| 残件 | 必要な確認と処置 |
|---|---|
| 新品の試験入口 | 現`verify-workspace-ai.ts`は`workspace-ai-20261026/{preflight,edit}`を固定参照し、両Directoryが既に存在する。既存物を削除・再利用せず、新品の有限試験識別子とRootへ入口を最小追従する必要がある |
| 非AI本番結合 | 最新保存・Executor接続で、公開HTTP受付→状態観測→終了とDirect／IsolatedのGit操作・既存dirty／stage保全・回収を事前確認する。AI受付／観測十五秒、Workspace操作六十秒は維持し、実行OwnerをHTTP子へ移さない |
| 送信範囲の確定 | 合成Context・source.txt・固定指示・差分だけ、Codex `gpt-6.1-sol` medium編集→Claude `claude-opus-5-5` mediumレビュー、必要なら既存限定是正一回と再レビュー。二方式各一Task、上限八AI起動を候補とし、新品Root・固定Commit／Image・失敗停止／回収範囲を実行前に再提示して承認を得る |
| 実AI編集の成立 | Directは現在Tree編集・既存dirty／stage保全・自動Commitなし。Isolatedは独立Worktree編集後、試験内の明示選択だけ固定し、二親MergeとBranch／Worktree回収を確認する。読取り単段の成功から推定しない |
| 終了・記録 | 不明な失敗は再試行せず同じ参照で保持。今回資源の終了・不存在・Root回収と固定結果を確認し、過去失敗や全体QAと区別する |

#### 新品試験領域と非AI編集事前確認 — 2026-10-29

人間の1・2実施指示に従い、検証Toolの固定日付Rootを、確認済みRepository-local tests内の標準`mkdtempSync("workspace-ai-")`へ置換した。CLI引数・送信条件・製品Source・HTTP期限・既存清掃Gateは変更せず、設定・Registry・互換処理を追加しない。Docker一覧確認後だけ新品Rootを作り、exact Pathを既存結果へ載せる。独立レビューで作成後失敗時のPath欠落を検出し、Root検査・子Directory作成を捕捉して未確認Rootへの書込み・削除なしでexact Pathを返すよう是正した。正常・作成前拒否・realpath差・Root link・mkdir拒否を同じVMで反証し、再レビューは残指摘零だった。

今回の非AI事前確認は新品`C:\project\CRDD\.crdd\tests\workspace-ai-vlNwOC`で一回実行し、終了値零。Direct／IsolatedともlimitedProbePassed・closeConfirmed・runtimeClean・workspaceClean true、既存変更保全・成果Byte検証を確認した。Isolatedは候補固定・二親Merge・候補終了・WorktreeとBranch回収まで確認した。Docker比較はverified／observed_inventory_unchangedで追加・削除Container／Network零、Source不変、両fixture回収Gate eligible、fixtureRootsRemoved true、清掃失敗零だった。AI Client開始・外部AI送信は行っていない。

合成Gitの詳細は一時成果物として回収し、IsolatedのBase `3bc95bfaec486b1b4ada53d8d5f2dc65b3971b17`、Candidate `f4063de4ddabfbb23564e08626b5d9165ef63941`、Merge `c5e88e158638e89ad0170a7603fc6e7a4ddee044`と二親関係の確認結果だけを残す。引渡しJSONのSHA-256は`40aafd71cadd38d01940b87b637567893f29db8352c63ed35887fe9994678db7`。試験本体が合成fixtureを回収した後、残るresult.json一件だけ・非Reparse・結果全成功を再確認し、Fileと空親Directory二階層を非再帰削除して今回Root不存在を確認した。旧固定日付Root・他の過去保持物には触れていない。

静的確認はWorkbenchの整形・型・警告を失敗とするLintとclient Buildが成功（既存情報診断五件）。制限環境の対象三十件はHTTP応答前の二件不合格、通常環境の先行実行は三十件成功だった。最終候補の途中再確認にはHTTP時刻順序Oracle一件の不合格があり、個別でも再現した。判定を変えず数値だけの診断を追加した後の個別一件は成功したが、失敗時の値は旧Assertionに含まれず、原因解消とは断定しない。最終候補の固定回帰は別記し、過去runの不合格を上書きしない。

最終候補の対象二Suiteは、一実行三十件成功・失敗零・取消零・skip零（約九十秒）で終了した。先行runや個別成功との合算ではない。最後の文書・診断差分も独立レビュー残指摘零。diff checkは成功し、今回の非AI事前確認と新品Root対応を完了した。途中の時刻順序不合格の原因未確定は維持し、全体QA又は実AI成功へ拡張しない。

次は、この非AI成立を実AI編集の合格へ読み替えず、新品試験Root・固定Source／Image・合成送信本文・Codex編集／Claudeレビュー・上限回数・失敗時停止／回収範囲を改めて提示して承認を得る。今回の許可では実AIを開始しない。

#### 新品領域の実AI編集一回と取消後状態 — 2026-10-29

人間の明示承認後、固定`fb1afd64b82f3b5d214def0b135c3b489b25fb2a`、承認した三固定Image、稼働Container零を確認し、新品`C:\project\CRDD\.crdd\tests\workspace-ai-xMmxk7`で実AI編集試験を一回開始した。端末の通常同意後、Directの`request-f96c874e-56f6-4c35-bfb1-843165aca50f`を受け付けたが、状態取得がheaders_unobserved／timedOut trueの十五秒期限で失敗し、同じTaskへ取消を発行した。結果はE2E_EXIT=2、Isolated未開始、Task全体の再試行なし。

元Taskはcancelled／single_task_cancelled_after_effect_cleanup、cleanupConfirmed true、回復参照・副次失敗は空、closeConfirmed true。Codex executor attempt0の記録はturnCompleted true、itemErrorCount=1／itemErrorCodeModeCount=1、commandExecutionStartedCount=0、fileChangeStartedCount=0、報告・実変更Path各零だった。source.txtはBASEのまま。Codexの作成・開始・完了・exit零・Process tree終了・Container／Network不存在・cleanupを観測した。Claude reviewerはProvider作成／開始／完了未観測で、取消後の終了と清掃だけが成立した。Codex編集起動一回、Claudeレビュー起動零であり、モデル内部のAPI呼出数をこの記録から算出しない。

一次停止はHTTP状態取得Timeoutであり、Code Mode関連のProvider項目エラーも別に観測した。両者の因果関係、遅延区間、Code Modeエラーの具体的原因は未確定。生出力を保存しておらず、推測で補完しない。正常な助言単段の成功から編集機能の成立を推定しない。

境界相関は操作`OP-9230062799888042500767993141431403042`、回復相関`operation-33b8ea28-5b91-45de-ab5a-a038ba761af0`。Codexのexact回復参照は`docker-task.7a8a913ba325345122de111096d1e616e1f6cd4b9499ef405901862b8198f56a.a0b08dd570cd0e1afd69985b65c0e2556195f1f0ced00ee969ee4208a1e26b6f.b6ca74e6bd572c5a63c6ec2a588fdf4ff80c3b22f30ffbff6cbda26632384efc`、Claudeは`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.549e64008edb3433f0ab9d33544ca27577a931b4e7c484f8ba70c113d4d00276.8f41d486af9840bb06e730c182f972910306b6514254cd6fc44f2fe63d51c037`である。元引渡しJSONのSHA-256は`0f2171317e1fe9e52c9b33f5884e81200e302e7cb9d90dc12e5668dbd4520e55`。

試験Toolの通常清掃は両方式成功専用のため今回は対象外となり、fixture_root_or_removal_unconfirmedを返した。そのguardは変更しない。後続読取りで試験Node零、状態上のoperations／unresolvedRecoveries／pendingDeliveries／leaseIntents／workspaces各零、同Taskのcancelled／settled・cleanup true・回復参照空、project-operationのacquired→releasedを確認した。終了要約待ちはcancelled／cleanup confirmedの一件で、未解決実行義務とは区別する。Dirty／Stage／未追跡の合成確認物は元のまま、Git Worktreeは今回direct一件だけ、Source不変。現Docker一覧のCRDD Containerは過去保持の一件だけで、今回資源は残っていない。標準Network Identity変更は別診断であり、標準Networkの削除・再構築は行わない。

今回Rootの物理清掃は人間の今回資源回収承認内で実施した。exact解決Path、祖先と全内容の非Reparse、今回Rootがeditだけ・editがdirectとresult.jsonだけ、元結果Hash、未解決状態零、同Taskの取消確定、合成四Fileの元内容、Git Worktreeが今回direct一件だけであることを照合して、今回Rootだけを通常削除し不存在を再確認した。親Path補助照会の`Split-Path -LiteralPath -Parent`にはPowerShell引数不適合が出た。exact解決Pathと祖先・内容の検査は別に成立しており、終了後は`Path.GetDirectoryName`でも意図した親を照合した。ACL修復・属性の再構成は行っていない。実AI再送・Docker再起動・Image更新・過去保持物操作もない。元の失敗結果を成功へ変更せず、実AI編集E2Eは未成立である。

#### HTTP観測期限とCode Modeエラーの非AI切り分け — 2026-10-29

人間の調査指示に従い、Sourceと既存の有限診断を照合した。製品Source・判定・期限は変更せず、AI再送・Docker照会／作成／再起動・過去保持物操作は行っていない。外部参照には公開Codexの版固定Sourceだけを用い、内部試験内容・Path・結果は送っていない。

| 対象 | 確認した事実 | 原因の確定限界と最小案 |
|---|---|---|
| HTTP状態取得 | 検証ClientのobserveはTask専用照会でなく`readMain`の画面全体GETを使う。Ownerは同一OwnerのMapにあるSnapshotを現在認可後に返し、Task完了Promiseをawaitしない。後段にはTopic／Meeting等の同期読取りがある。編集Toolは既存の三境界時計を接続せず、失敗結果からServer受信前／Owner内／画面生成後段を分離できない | 十五秒そのものの原因は未確定。既存`createReadonlyVerificationTiming`を、読取りTool同様にClient callback・Server bind・Owner observe wrapper・stage設定・dispose／snapshotまで一組で編集Toolへ接続する。新ログ基盤、Worker、Queueや期限延長は不要 |
| Code Mode | `itemErrorCodeModeCount`はerror項目のmessageに対する正規表現件数。Host起動・handshake・実行物なしの合成三入力が、すべてparser confirmed／Code Mode一件／command零へ同じく投影された。Task計画はHost有効・in-process fallback禁止・Code Mode only。DockerfileにはCLIと同じ版・隣接位置のHostがある | 実Hostの具体故障は旧記録から復元不能。Host不足・起動失敗・初期通信失敗を断定しない。まず本番同等の固定Image／uid／mount／seccompで非AIのsession開始→固定計算→応答→終了を確認する経路を特定する。現試験のHost `--help`とCodex sandboxはこの代用ではない。推測したprotocol harness、Host無効化やfallback許可を追加しない |

HTTPの既存実保存結合一Caseへ、メモリ内CPUサンプリングとevent loop遅延計測を一時適用した。一件成功、約81.1秒、計測付きの最大event loop遅延12,440ms。CRDD Source内の自己sampleはPlatform Accessの同期`waitForState`約5,209ms、Version Controlの`readStableFileBytes`約694ms、`parseNarrowRepositoryConfig`約442msなどだった。サンプルは計測付き全試験の累積であり、単一HTTP要求の占有時間や実AI失敗時の内訳ではない。同期`Atomics.wait`とRepository実体再確認がHTTP処理を止め得ることはSourceと整合するが、今回十五秒Timeoutの再現・唯一原因の証明とはしない。Profile本文・生出力・プロンプトはFileへ保存せず、短命計測Scriptと試験helperの合成Rootは終了後不存在を確認した。

固定版の公式Sourceでは、[InstallContext](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/install-context/src/lib.rs)が同梱資源又はCLI隣接のHostを解決し、[remote_session](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode/src/remote_session.rs)は存在検査とsession生成を分ける。[connection](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode/src/remote_session/connection.rs)もspawnとhandshakeを別に扱う。したがってImage内の配置・`--help`・助言成功だけでは、編集時のHost session成立を証明できない。これらは一般的意味の参照であり、今回の実故障を直接観測した根拠ではない。

読取り専用の独立確認では、二つを独立事実として扱う方針が妥当であることを確認した。HTTP時計は三境界を一組で接続すること、Code Mode分類を後で加える場合も生message非公開・未知分類・件数相関・現行exact診断Schemaの影響を維持すること、固定Imageの実証には実行条件の提示と別の許可が必要であることを確認した。今回の調査では実装を開始しない。次はまず既存時計の接続と非AIの段階保存／並行HTTP反例を具体化し、Hostの非AI実証経路が成立しなければ不明のまま人間へ戻す。

#### 編集Toolへの既存HTTP時計接続と非AI結果 — 2026-10-29

人間の指示に従い、`verify-workspace-ai.ts`へ読取りToolと同じ`createReadonlyVerificationTiming`を接続した。Server生成前に時計を作り、Owner.observe wrapper、loopback Server bind、初回GET／Client callback、start／observe／cancel／close段階、Client終了後のdisposeとOwner終了後snapshotを一組で用いる。投影は既存evidenceのhttpTimingへ追加し、上限512件・本文／Token非保存・元Task結果不変を維持する。製品Source・HTTP API・十五秒／六十秒期限・Authority・保存guardは変更していない。

既存取消十一条件にcallback・段階・購読解除の確認を追従した。既存の実保存HTTP Caseには同じ時計を接続し、正常完了保存と同IDの状態取得をPromise.allで並行要求する。実Owner・実Writer・公開HTTP・HTTP子Processは通すが、executeと認可callbackは合成で、AI／Dockerは使わない。Promise.allから厳密な時間重複又は実AI失敗の再現を推定しない。

最初の対象二Suiteは三十件成功だった。完了保存に並行した状態GETは、要求開始→Server受信3,302ms、Server受信→finish233ms、対応Owner.observe0ms、要求開始→headers3,539ms、本文→親close32ms。Owner観測十二件の最大も計測上0msで、欠測計上零・購読解除済みだった。この合成条件では主要な待ちをServer受信前へ分離できたが、socket／OS配送とmain event loop停止の内訳はこの時計だけでは区別しない。先行の同期保存・Lock待ちのSource／計測と整合する一方、実AI時十五秒の唯一原因とは確定しない。Ownerは合成認可callbackであり、実試験の設定再観測費用まで零と主張しない。

独立レビューのMinor一件は、試験の応答喪失用startを直前のcancel段階で記録していた点だった。手動POST前をstart・受付後GET前をobserveへ合わせ、存在確認Oracleを追加した。元の切断・同ID継続・取消・保存・回収条件は変更しない。FormatterのWindows mapped-file拒否1224は、指示された整形をpatchで反映して最終Formatで確認した。新しいPromise変数に明示型を付け、整形・型・警告を失敗とするLintは成功（既存情報診断五件）。最終対象回帰と再レビューは以下で確定する。

最終候補の対象二Suiteは一実行三十件成功・失敗零・取消零・skip零（約65.8秒）で終了した。段階追従後の並行GETはClient→Server4,045ms、Server465ms、対応Owner0ms、headers到達4,507ms。複数回の値を一runへ合算しない。限定独立再レビューは残指摘零。試験helperの清掃条件と元結果を維持し、今回の時計接続を完了したが、実AI時十五秒の根本原因又は全体QAの合格を宣言しない。

#### Code Mode非AI実証の承認候補 — 2026-10-29

今回は条件整理だけで、実Containerを作らない。固定Codex Task Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`に同梱された0.164.0のHostを使う。公式版固定の[message](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode-protocol/src/host/message.rs)と[codec](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/code-mode-protocol/src/host/codec.rs)に沿う一時的・用途固定のClientで、初期通信→session/open→固定計算→結果→session/shutdown→子終了を確認する案とする。仕様を推測せず、実装前に必要fieldと版の整合を確認する。恒久API・Package・汎用Client・独自Protocolは新設しない。Host単独の成功を本番CLI経路の成功へ拡張しない。

承認が必要な実Effectは、稼働確認後の自己生成Container最大一件と、Repository内新品`.crdd/tests/code-mode-non-ai-*`だけ。network=none、認証情報・Repository本文・Provider設定を渡さず、空の合成Work／Home／tmpと本番同等の非root UID・read-only root・cap-drop・no-new-privileges・seccompを使う。外部AI呼出し・Image取得／更新・再起動／修復はしない。固定計算だけで外部Tool callbackを要求した場合は拒否して停止する。開始・初期通信・計算・終了の固定段階と終了値のみを残し、生stderr・本文を恒久保存しない。失敗時は自動再試行せず、同じ実IDの今回資源だけを確認して回収する。Engine停止／Image欠測／別のDocker作業中はEffect前停止。既存Container・Image・Volume・過去保持物は操作しない。提示時点では未承認であり、その後の人間承認に基づく一回結果を次項に記録する。

#### Code Mode非AI実証の一回結果 — 2026-10-29

人間が上記範囲を承認後、Source `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`を基準に、一時的な用途固定Clientだけを作成した。公式0.164.0の四メッセージと4-byte little-endian frameを使用し、固定計算`text(String(1 + 1));`、有効Tool零、全応答上限16 frame／一frame 65,536 byte／応答期限30秒とした。局所self-testは正常四メッセージと負例十件が成功。独立レビューで後続stdout受理・欠測cell ID受理を実行前に是正し、再確認の残指摘は零だった。`cell/closed`は任意通知として、ID確定後の同session／同cell一回だけを受理し、必須の終了証拠とは混同しない。

| 確認対象 | 一回の実測結果 |
| --- | --- |
| 実行境界 | 既存固定Image、network none、UID 65534:65534、read-only root、cap-drop ALL、no-new-privileges、既存seccomp、pids-limit 64。四Mount以外のRepository／認証情報は渡さない |
| Host同一性 | 同梱`codex-code-mode-host`のSHA-256 `8ee4f472e92ac226a189e98998633b2d07f989f208515750764db660369f2926`が一致 |
| 非AI動作 | handshake、session/open、固定計算結果`2`、session/shutdownの全応答を確認。外部Tool要求零、stderr零 |
| 終了 | stdin close、Host exit 0、stdout EOF、stderr読取り終了、Container exited／ExitCode 0。OOMKilled false、Restarting false、RestartCount 0 |
| 実環境の補助観測 | CPU 24、開始前pids 1、上限64。上限枯渇の再現なし |

実Container IDは`ae2a90a03b890be48c9bfe1decc096ea02ace6f0ca7de3c2c367140cd09cb3c4`、作成・起動は各一回。開始／終了は2026-10-29T02:38:23.493751387Z／02:38:23.956127038Z。元ID・Image・Config・MountとHostConfigを再照合し、未指定`OomKillDisable`だけ作成時false／終了後nullという表現差を検出した。指定した安全設定ではなく、他項目はexact一致、OOM／再起動も否定できたため、独立確認後この一field・一Containerだけを限定判断して通常rmした。boolean差を一般許容する比較器や回復処理は追加していない。元IDの一覧取得成功・該当零によりContainer不存在を確認した。

新品Rootは`C:\project\CRDD\.crdd\tests\code-mode-non-ai-20261029-01`、Identity `1687905628:35465847067816461:1793241181982825500`。Client SHA-256は`6b1c9d744e0c68face1344c2e366a65b14f803469e70ddc85f28215805b700ac`。回収前に祖先・全子の十二Identityと非リンク、全六entryのallowlist、Client Hash、元ID領収書を再照合し、work／home／tmpは空だった。確認した二fileと空の四子Directory・Rootだけを通常の非再帰削除で回収し、Root不存在を確認した。強制属性解除・ACL修復は行わず、今回の試験物の残存はない。生出力を保存せず、本番Source・期限・安全判定は変更していない。

この成功は固定Image／当該隔離条件下の公式Host単独動作を示す。過去のCode Mode項目エラーの原因や、Codex CLIからのHost接続、実AI編集E2Eの成立を証明しない。AI再送・Docker再起動・Image更新・過去保持物操作は行っていない。

#### Codex CLIとHost単独試験の条件差 — 2026-10-29

今回の許可は外部AIなしの調査と最小案の整理である。現行Sourceの読取りと正式な計画APIの純粋呼出しだけで照合し、新しいContainer・CLI Process・認証操作は発行しない。本番Source・設定・安全判定・Timeoutも変更しない。

| 境界 | Host単独試験 | 本番の編集計画 | 今回の判定 |
| --- | --- | --- | --- |
| 実体と外側隔離 | 固定Task Image、公式Host、UID 65534、既存seccomp、pids64、空Work・bind tmp | 同じTask Image／UID／seccomp／pids64、bind Work・tmp | 基本配置・計算・終了は成立。CLIを含むProcess数・並行条件の成立までは未確認 |
| Host起動・接続 | PythonからHost絶対Pathを直接spawn、固定hello/open/execute | Codex `exec`が設定を解釈してHostを解決・起動・通信 | CLIによるPath解決、起動、handshake、routingは未検証。直接試験の成功で置換しない |
| Homeと環境 | 空Homeをread-only、Host環境はHOME／TMPDIR／PATHのみ | Host側で準備したHomeをread-write、CLIへCODEX_HOME、Proxy環境を渡す | Home／環境の差はあるが、原因と確認されていない。秘密値は読まず再現入力へ渡さない |
| 計算とTool | 固定計算、enabled_tools空、delegate要求は拒否 | shell_tool／unified_exec有効。CLIが編集用Toolを提供 | delegate処理、コマンド隔離、実ファイル編集を単独試験は通らない。故障の優先原因と断定しない |
| 内側の権限 | Codex CLIの権限profileを経由しない | root deny、minimal read、Workspace write、Codex実行Fileだけ追加read、コマンド通信禁止 | 隣接Host／bwrapを使う段階と権限評価の関係は未確認。追加allowが必要とはまだ判断しない |
| Provider結果 | protocolと計算値・終了を直接検査 | output-schemaとJSONLへ投影 | 既存itemErrorCodeModeCountはerror本文の語句一致件数で、Host開始・handshake・delegateの段階を特定しない |

`ai-adapter/src/codex/plan.ts`の編集計画は、GPT-6.1 Solにcode_mode／code_mode_host／code_mode_onlyを指定し、in-process fallbackを禁止する。助言計画もHostを使用するがshell_tool／unified_execを無効化し、read-only sandboxを使う。このSource差を実編集故障の反証とは扱わない。現行の[公式設定文書](https://learn.chatgpt.com/docs/config-file/config-reference)にもCode Mode・権限profileはあるが、稼働中の固定0.164.0と同版の契約を示すものではないため、現行文書のkeyへ機械追従しない。

結論は具体原因未確定である。Host実体の基本不成立やHost単独でのpids64枯渇を支持する結果はなく、残る候補はCLIの設定解釈／Host解決・起動・通信、Home／環境、Tool委譲／内側sandboxである。過去の生出力は保存しておらず、旧件数から失敗段階を復元できない。独立確認で「Tool委譲を優先原因」とする推定を取り下げ、同列の未確定候補へ整理した。

最小案は製品変更なしで、次の二境界を分ける。第一に固定CLIの既存sandbox入口と同じ権限profileで、合成Workへの固定command一件を非AI実証する。これで確認できるのはコマンド隔離経路であり、Host接続の成立とは別である。第二にCLI→Hostの起動・handshake・delegateを非AIで発火できる既存の正式入口があるか、固定版で先に確認する。現SourceのCRDD公開入口では、その非AI発火を確認していない。入口がなければ独自fake Provider／汎用Host Client／CLI改造を追加せず、その範囲を未確認として残す。通常の`codex exec`を非AI確認のつもりで起動しない。実Containerでの追加検証にはImage・引数・mount・回収範囲を固定して別途許可を得る。現時点ではHost追加allow、root read化、fallback許可、Timeout延長、Image更新を是正として採用しない。

#### CLI内側sandboxの非AI確認案 — 2026-10-29

OpenAI Docsで[CLIのsandbox入口](https://learn.chatgpt.com/docs/cli/reference)を確認した。現在の文書は`codex sandbox linux`、名前付き権限profile、作業Directory、設定overrideと`--`以後の固定commandという入口を説明する。ただし固定0.164.0の実helpに代わる根拠ではない。既存Docker ProbeはPythonのFilesystem／Network確認であり、このCLI内側の経路を呼ばないため、成功結果を流用しない。

追加許可を得る場合の範囲は、同じ固定Task Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`から新品Container一件・起動一回とする。exact local Imageがない場合はpull／buildせずEffect零で停止する。network none、認証情報／Repository本文なし、同じ非root／read-only root／cap-drop／no-new-privileges／seccomp／pids64を維持し、空の合成Work・Home・tmpと読取り専用の固定試験入力だけを使う。新品Rootは`C:\project\CRDD\.crdd\tests\codex-sandbox-non-ai-20261029-01`であり、実行前準備としてinput/probe.pyだけを作成した。Docker照会・作成・起動はまだ行っていない。

Container内では第一に固定CLIの`sandbox linux --help`だけを読む。名前付きprofile・cd・configの必要optionが確認できなければ固定分類を残して停止し、別引数の試行や通常execへの代替をしない。一致した場合だけ、既存編集profileと同じroot deny／minimal read／Workspace write／Codex File read／network falseで、合成Work内の一Fileに既知文字列を書き、読戻し一致・通常削除を行う固定command一件を実行する。git／内部状態の空の保護領域は外側のread-only mountで維持する。この実行はモデル、Provider認証、Host protocol、Task受付を使わず、CLI sandbox・コマンド起動・合成File操作の可否だけを判定する。

試験入力は`input/probe.py`、SHA-256 `2fc7cda5a655834df07590a08bcc75fed0f873ce2408afa7b2905222b4d2712a`。入力Fileを読み込んだ局所self-testは固定commandの構文・shell不使用のargv・環境変数集合を確認し、外部Process零で成功した。独立確認の出力無制限保持指摘を是正し、両streamを並行読取り、合計65,536 byte以内だけを保持して超過時は元Process groupへTERM一回・五秒の終了確認へ接続する。64KiB境界・超過時buffer不増加・TERM一回と終了未確認の負例を有限代役で確認した。Container入口は`python3 -B /probe/probe.py`、内側のcommandは`/usr/local/bin/python3 -I -B -c <固定Source>`でshellを使わない。固定Sourceは`/work/sandbox-probe.txt`が未存在であることを確認し、`CRDD_SANDBOX_NON_AI\n`を書き、同bytesを読戻し、unlink後に`CRDD_SANDBOX_OK`だけを出す。モデル・任意command・本文・認証値を引数へ入れない。

MountはRoot内input→`/probe`（RO）、work→`/work`（RW）、home→`/provider-home`（RW）、tmp→`/tmp`（RW）、guards/git→`/work/.git`（RO）、guards/internal→`/work/.crdd`（RO）に固定する。work内の二mountpointも空で事前作成する。正常時の合成probe Fileは不存在、保護二領域は空のままとし、準備済み入口・元ID領収書以外の新規entryは清掃前に確認する。元ID領収書はRoot直下`trial.json`だけで、trial／sourceCommit／rootIdentity／image／probeSha256／containerIdの六fieldに固定する。作成応答後の元64桁hexを保存・読戻し確認してからだけstartする。これは不変の作成応答領収書であって現在状態ではなく、state fieldを設けず、未開始又は開始済みの判断材料へ転用しない。親喪失後は元IDで現状態を観測し、開始可否にかかわらず同じ試験を再実行しない。領収書の欠測／不一致ではstart零で停止し、要求結果又は終了が不明なら同じ元IDを保持する。CLIが作るHome／tmp内の未知entryを名前だけで一括削除せず、確認不能なら保持する。この正例はprofile指定の受理とWorkspace操作の成立だけを示し、root deny／minimal read／network falseの各強制を独立証明しない。外側DockerのRO／network noneによる拒否を内側の保証へ算入しない。

help・commandごとの有界待機と出力量、元子Processの終了、元Container構成・停止・IDを確認し、失敗時の再試行・Timeout延長・追加capabilityは行わない。結果は固定段階・終了値・分類だけを記録し、生出力を恒久保存しない。今回の既知内容とIdentityを照合できる試験物だけを通常回収し、観測不能・未知内容はexact参照付きで保持する。Image取得／更新、Docker Engine／daemon起動・再起動・修復、既存資源・過去保持物への処置は含めない。これは承認候補であり、実Containerの処置はまだ行っていない。

#### CLI内側sandbox非AI試験の一回停止 — 2026-10-29

上記範囲を人間が承認した後、Engine linux 29.8.1、exact local Image存在・稼働Container零、probe Hash・既存seccomp Hash、Rootと祖先／全初期子の非Link・Identityを確認した。新品Containerの作成応答は64桁元IDとして受領し、不変領収書の保存・読戻しと六Mount／Image／UID／read-only root／network none／seccomp／pids64の照合後、一回だけstartした。

結果は`blocked / fixed_cli_help_mismatch`、stage `help`、helpConfirmed false、commandStarted false、commandExitCode nullだった。Containerは2026-10-29T05:37:50.670886073Z開始・05:37:51.300447905Z終了、exited／ExitCode 2、OOMKilled false、Restarting false、RestartCount 0。attach呼出し自体の終了値は1で、Containerの終了値とは区別する。固定File操作、CLI内側sandboxの成立、Host接続は未確認である。

停止条件は、helpの終了値非零又は必要option（permission-profile／cd／config）の欠測のどちらかだった。今回の有限結果はその内訳を保持しておらず、CLI本体の故障、option名の違い、help出力先の差のいずれかを断定しない。検証Toolの診断不足があり、次に是正するならhelp終了値・各option検出のboolean・stdout／stderr byte数だけを既存結果へ追加するのが最小候補である。生help／stderrの保存、新しい状態・Registry、別引数へのfallback、製品権限の緩和は不要であり、今回は追加実行をしない。

元Container IDは`ab0354f449b67716df0bd00c34c3e0f2d946691b1d6688082ea17655a1f44fd0`。Root Identityは`1687905628:39969446695535305:1793246950934337900`、入力Hashは前項と一致する。停止後の全Config／MountとHostConfigは未指定OomKillDisableのfalse→null以外一致した。回収直前にも停止・元ID・全設定を再照合し、この未指定fieldだけを今回の表現差として限定判断した。元IDへ通常rm一回を実行し、一覧取得成功・該当零によってContainer不存在を確認した。

RootにはCLI補助用の空lock二件・空Directoryと、固定CLIのContainer内Pathを指すsymbolic link三件が残った。Node lstat／readlinkで追跡せず検査し、三件ともtargetは`/opt/crdd/providers/codex/0.164.0/codex`、Windowsのreparse tagは0xa000001dだった。独立確認後、初期十六Identityと全二十二entryの現在Identity／単一link／bytes／Hash／link targetを再照合した。link三件はFile.Deleteでentry自身だけを除去し、空lock二件・既知probe／領収書と空の既知Directoryだけを通常・非再帰削除した。Root不存在を確認し、今回の試験物は回収完了。link先・任意の再帰削除・強制属性解除・ACL修復は扱っていない。AI送信・Docker Engine再起動・Image更新・過去保持物操作・失敗後の再試行は行っていない。

#### help診断の最小是正・非AI局所確認 — 2026-10-29

人間の継続指示に従い、新品の`C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-02\input\probe.py`だけを準備した。前回Rootや試験を再利用せず、製品Sourceは変更しない。SHA-256は`9d9e9ab298bf693fbe0dde69f209862a2f98e2cf89c493477ddaff04c571586e`。既存の固定CLI・30秒待機・合計64KiB保持上限・元Process groupへのTERM一回と五秒終了確認を維持し、実行対象を`sandbox linux --help`一回だけへ縮小した。通常exec、固定File操作、引数fallback、Provider認証・モデル呼出しの経路は持たせない。

診断はhelpExitCode、helpStdoutBytes／helpStderrBytes、permission-profile／cd／configのstdout／stderr別検出boolean、複数形permissions-profileの診断booleanだけを返す。生help／stderr・未知本文を返さず、helpが完了しなければ各観測はnull、helpObserved falseとして失敗を保持する。成功条件は終了値零かつ必要な三optionがstdoutに存在すること。stderr側だけ又は複数形の検出を成功・自動切替へ使わない。独立確認の部分一致指摘を受け、optionの前後境界を照合し、cd-root／config-file／連結文字列／別suffixの誤検出を拒否した。これは試験の確認条件の是正であり、本番のAuthority・保存・安全判定へ変更を加えない。

局所self-testは、正常・非零終了・stderrのみ・option不足・複数形・本文非公開・部分一致反例・equals／comma表記の十一診断条件、64KiB境界と超過時buffer不増加、終了確認の有限代役二条件を確認し成功した。外部Process起動零であり、実CLI・Docker・実OSの取消成立を証明しない。WindowsでPythonを`-B`指定し、bytecode生成を避けた。Docker照会／作成／起動、AI再送、過去保持物操作は実施しておらず、元のhelp停止原因も未確定のままとする。

次の実行は別途承認後、新品Container一件で固定Image・network none・同じ非root／RO／seccomp／pids64・空Work／Home／tmpとRO試験入力だけを使い、上記help一回と今回試験物の確認後回収に限定する。Engine停止・Image欠測はEffect前停止、失敗時再試行なし、観測不能・未知内容はexact Root／ID付きで保持する。File操作を含む前回の実行許可を再利用せず、helpだけへ縮小した範囲を提示する。この準備入力は次回試験後に回収し、未使用の場合は2026-11-05を再評価日とする。新しい恒久Tool・公開API・Registry・Recoveryは追加しない。

#### help専用診断付き一回実行 — 2026-10-29

人間の承認後、同じSource `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`・固定Image・入力Hashでhelpだけを一回実行した。Engine linux 29.8.1、local Imageのexact一致、稼働Container零、Root／祖先／初期全子十一Identity、四Mount、非root／read-only root／network none／seccomp／pids64、元ID領収書の読戻しを確認後にstartした。Container IDは`85bc5708881df683140d2144fbcafbd0be0144e90d940c7bf606cc311197f4e8`、Root Identityは`1687905628:24769797951586580:1793258453100230500`。

| 診断 | 一回の観測 |
| --- | --- |
| 結果 | blocked、stage help、reason help_command_nonzero |
| help | 観測完了、終了値101、stdout 0 byte、stderr 216 byte |
| 必須option | permission-profile／cd／configはstdout／stderrとも未検出。複数形permissions-profileも未検出 |
| 後続 | commandStarted false。固定File操作、Host接続、AI呼出しはいずれも未実行 |
| 外側終了 | Container exited／ExitCode 2、attach呼出し終了値1。OOMKilled false、Restarting false、RestartCount 0 |

Container開始／終了は2026-10-29T08:12:20.815682212Z／08:12:21.411011176Z。前回のhelp mismatchは、今回の条件では「help自体の非零終了」であり、正常helpにoptionが不足した結果ではないと切り分けられた。ただしstderrは本文を保存せずbyte数だけを記録したため、具体的な内部故障は未確定である。終了値101だけからpanicや権限・Process数枯渇等の原因を断定せず、製品設定・Image・Timeoutの是正へ進まない。失敗後の再試行は行わない。

今回RootにはCLI由来の空lock二件、空Directoryと固定CLI Pathを指すlink三件を検出し、他の新規本文Fileはなかった。元IDと停止・構成を再照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定した上で通常rm一回、一覧取得成功・該当零によりContainer不存在を確認した。初期十一Identityと全十七entryの現在Identity／単一link／bytes／Hash／link targetを再照合し、三件のreparse tag 0xa000001dを個別確認してlink自身だけをFile.Deleteした。空lock二件と既知probe／領収書、既知の空Directoryだけを非再帰・通常削除し、Root不存在まで確認した。今回の物理残存はない。link先・ACL・強制削除・任意再帰は扱わず、AI再送・Docker Engine起動／再起動／修復・Image更新・過去保持物操作は行っていない。

#### stderrの有限診断準備 — 2026-10-29

次の継続指示に対し、未承認の再試行はせず、新品`C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-03\input\probe.py`を準備した。SHA-256は`b4f9e4903d07e01f3cbdfff5703b6423650ca6933cf9b89429e49fe2b20e243a`。help一回だけの経路・30秒期限・合計64KiB上限・TERM一回と五秒終了確認・既存成功条件は不変。stderr本文をメモリ内で、panic／Thread生成／Signal処理／Runtime言及／資源不足／権限／File欠測／Memory／sandbox言及／引数拒否の十boolean、`Os { code }`又は`os error`に限定した0〜65535のOS番号（重複除去・昇順・最大八件）へ変換する。任意本文・Path・一般的な数字を返さず、空・未分類・番号打切りを明示する。これは語句の観測であり、原因の確定ではない。

外部Process零の局所確認でhelp十一条件、分類九条件、64KiB境界と終了の有限代役二条件が成功。本文非搬送、一般code表記・六桁番号の拒否、最大八件も反証し、独立レビュー残指摘零。製品Source・設定・Image・安全判定は変更しない。実CLI／Docker・AI・過去保持物は操作していない。次は同じ固定Image・隔離条件、空Work／Home／tmp・RO入力、exact元ID領収書と通常回収の既存条件を用い、別途承認した新品Container一件でhelpだけを一回実行する。File操作・通常exec・AI・fallback・自動再試行は含めず、Engine停止・Image欠測では停止する。準備入力は試験後に回収し、未使用時は2026-11-05に再評価する。

#### 診断付きhelp確認の事前停止 — 2026-10-29

人間が上記一回と今回試験物の回収を承認した後、入力・seccompのHashとSource HEADの一致を確認した。最初のEngine読取りが接続先`dockerDesktopLinuxEngine`のpipe欠測で失敗したため、その場で停止した。Image照会・稼働資源照会・Container作成／起動・CLI helpは未実施。これはCLIの終了値101の再現結果ではなく、Engineへ接続できないためのEffect前停止である。Engine起動／再起動・修復・再試行は行わず、AI送信・過去保持物操作もない。今回Rootには準備済みinput/probe.pyだけがあり、既知Hash・exact配置・祖先を含む非link・単一link・全entryを確認して、そのFileと空のinput／Rootだけを非再帰・通常回収した。Root不存在を確認し、今回の物理残存はない。実試験の失敗原因分類は未取得のまま保持する。

#### 通常起動後の診断付きhelp一回結果 — 2026-10-29

人間がDocker Desktopの通常起動とhelp一回・今回物回収を明示承認した。公式配置のDesktop実行物の署名Valid／Docker Incを確認し、非表示の通常起動一回でEngine linux 29.8.1が応答した。再起動・修復はしない。固定Task Imageの存在・exact一致、稼働Container零を確認し、新品Root `C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-04`へ前回レビュー済みと同じ入力Hash `b4f9e4903d07e01f3cbdfff5703b6423650ca6933cf9b89429e49fe2b20e243a`を復元した。Root Identityは`1687905628:52072870694109774:1793272535309933200`。入力の局所self-test十一help／九分類／終了二条件も再確認した。

元Container IDは`aca4d91eb695bbb7425384eb4f1dbd804bced9f4f75fec06b29354a3c8a58b12`。作成応答・exact領収書保存と読戻し・固定Image／四Mount／network none／UID 65534／RO root／既存seccomp／pids64の照合後、help一回だけを実行した。開始／終了は2026-10-29T11:16:26.268895227Z／11:16:26.933974846Z。結果はblocked／help_command_nonzero、helpObserved true、helpExitCode 101、stdout 0 byte／stderr 216 byte、必要三optionと複数形は両stream未検出、commandStarted falseだった。Containerはexited／ExitCode 2、attach終了値1、OOMKilled false／Restarting false／RestartCount 0。

stderrの固定診断はrecognized_markers、panic／missingFile／sandboxMentionがtrue、OSエラー番号は`[2]`・打切りなし。他の七markerは未検出だった。同じstderrで三つの固定markerを検出した事実と、それらの因果関係は区別する。具体的な欠測Path・発生点・sandbox補助Fileとの因果はまだ未確定であり、marker未検出をThread／資源不足等の不存在証明へ使わず、番号だけからbwrap欠測や権限故障を断定しない。直接確認できたのはhelp Processの非零終了と正常help本文の非観測までであり、製品権限・Timeout・Imageを変更せず、再試行しない。生stderrは保存していない。固定File操作・Host接続・AIはいずれも未実行。

停止・元ID・Config／Mountを再照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定判断して、通常rm一回と一覧上の不存在を確認した。Rootの初期十一Identityと全十七entryの現在Identity／nlink／bytes／Hash／link targetを再照合。固定CLIを指す三linkはreparse tag 0xa000001dを個別確認してFile.Deleteでentry自身だけを削除し、既知の空lock二件・probe・領収書と空Directoryだけを非再帰で通常削除した。Root不存在を確認し、今回の物理残存はない。Desktopは通常起動後のままとし、AI送信・Docker再起動・Image取得／更新・過去保持物操作はしていない。

#### 固定版Source照合による検証呼出しの不一致 — 2026-10-29

調査指示に対して実行を繰り返さず、Build入力が示す公式Commit `6aaac694803004a63c6f393d153c96d22521a6b9`のSourceと現行Dockerfileを読取り照合した。現行一般文書から推定したCLI構造を固定版へ当てはめたことが誤りだった。

固定版の[CLI定義](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/cli/src/main.rs#L437)は`SandboxCommand`にHost別引数をflattenし、OS名によるlinux subcommandを持たない。Linuxでは[LandlockCommand](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/cli/src/lib.rs#L96)の末尾可変長commandとして解釈する。公式のhelp試験も`codex sandbox --help`を使う。したがって当方の`codex sandbox linux --help`はhelpを読む呼出しではなく、隔離内の対象commandに`linux --help`を渡す誤った形である。これは検証Toolの固定版契約不一致として特定した。

[Linux実行処理](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/linux-sandbox/src/linux_run_main.rs#L1094)には、対象commandへのexecvp失敗でpanicする経路がある。存在しないlinuxコマンドの発行は、今回のpanic／missingFile／sandboxMentionとOS番号2に整合する有力な説明である。ただし生本文を保持していないため、元のpanic発生箇所と完全に一致した実証とは区別する。Image内のbwrap欠測・配置不整合が確認されたとは扱わない。

配置側では、Dockerfileのbwrap先`/opt/crdd/providers/codex/0.164.0/codex-resources/bwrap`は[固定版の探索候補](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/linux-sandbox/src/bundled_bwrap.rs#L112)の第一候補に一致する。HostのCLI隣接配置も[InstallContextのfallback](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/install-context/src/lib.rs#L160)と一致する。これはSourceとBuild定義の照合であり、今回Imageを再抽出して実Fileの現存・動作を確認した結果ではない。配置変更やImage更新を行う根拠はない。

過去記録の解釈を訂正する。`commandStarted=false`は検証wrapperの後続固定File操作が未開始であることしか示さず、CLI内部のsandbox／command経路の未開始を証明しない。上段の「helpだけ」「sandbox本体未開始」は当時の意図・解釈であり、固定版Source照合後の事実として再利用しない。合成Workの固定File操作・AI・Provider認証は実行しておらず、外側network noneと空の限定Mount、今回分の確認後回収は維持される。この問題を元の実AI編集E2EのCode Mode故障原因へ一般化しない。

最小是正案は検証入力だけの変更で、helpを`codex sandbox --help`、別途許可した固定commandを`codex sandbox --permission-profile crdd-executor ... -- /usr/local/bin/python3 ...`とし、誤ったlinux要素を除去する。固定版Sourceの構文と一致する正例・旧呼出しを拒否する負例を局所確認してから、必要な一回の実境界確認を別途提示する。自動的な別引数再試行、恒久互換層、Image／Host配置変更、権限緩和、Timeout延長は不要。今回は調査・記録のみであり、修正版の実行・AI送信・Docker操作・過去保持物操作はしていない。

#### help呼出しの最小是正・局所試験と一回確認条件 — 2026-10-29

人間の実装指示に従い、新品Root `C:\project\CRDD\.crdd\tests\codex-sandbox-help-20261029-05`の`input/probe.py`へ検証入力を準備した。SHA-256は`3543cb42d11e69c3b2cbee3beb320a1edc6858b902f4c28c2d9c370c8e4b4f6c`。起動引数を固定tupleの`(CLI, sandbox, --help)`へ修正し、spawn前にもこのexact集合を照合する。旧linux要素・通常exec・余分な引数を拒否し、他の引数へ自動切替しない。既存のstderr有限分類、30秒、64KiB、TERM一回＋五秒終了確認、help成功条件は維持する。製品Source・Image・配置・権限は変更しない。`commandStarted`はwrapper後続File操作だけを指すとコメントへ明記し、CLI内部のEffect零を示すfieldとして扱わない。

WindowsのPythonを`-B`で実行した局所self-testは、起動引数四条件、help十一条件、分類九条件、main搬送二条件、終了の有限代役二条件、64KiB境界が成功した。旧呼出しをmainへ与えた場合はspawnを拒否する代役を設定し、`help_invocation_invalid`で閉じることを確認した。正常helpの搬送も同じmainで確認したが、外部Process起動は零であり、実CLI／Containerの成功とは区別する。Docker照会・実行、AI送信・過去保持物操作はしていない。

| 修正版一回確認の条件 | 固定する範囲 |
| --- | --- |
| Image | 既存localの`sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`。取得・更新・Buildなし |
| 回数・処理 | 新品Container最大一件、起動一回、CLIは上記help一回のみ。固定File操作・通常exec・Host／AI呼出しなし |
| 隔離 | network none、非root 65534、RO root、cap-drop ALL、no-new-privileges、既存seccomp、pids64。秘密・認証情報・Repository本文なし |
| Mount | Root内input→/probeはRO、空work→/work・home→/provider-home・tmp→/tmpはRW。Root外のMountなし |
| 前提 | Engine・exact Image・他の稼働Containerなし・入力Hash・Root／祖先Identity・非linkを確認。Engine停止・Image欠測・他作業中は要求前停止し、起動／再起動／修復しない |
| 領収書 | 作成応答後の元IDと六fieldの不変trial.jsonを保存・読戻し確認し、元ID構成照合後だけstart。現在状態や未開始証明へ転用しない |
| 結果 | helpの終了値零と必要option三つのstdout exact検出。成功してもCLI help面の確認だけで、sandbox実行・権限制御・Host接続・編集E2Eの成立へ拡張しない |
| 失敗・回収 | 再試行なし。同じ元IDの停止・構成を確認して通常rm／不存在確認。Root全entry・Identity・Hashと補助link自身を再照合して既知物だけ通常・非再帰回収。不明はexact Root／IDと再評価日を記録して保持 |

これは条件の整理と局所確認までで、実行承認はまだ求める段階である。準備入力は承認後の試験終了時に回収し、未使用又は残存時の再評価日は2026-11-05とする。過去保持物を対象に含めず、正常起動や失敗を過去の不明事実へ上書きしない。

#### 修正版helpの一回成功と回収 — 2026-10-29

人間の承認後、Source `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`・同じ固定Task Image・上記入力Hashで`codex sandbox --help`を一回実行した。Engine linux 29.8.1、local Image exact一致、稼働Container零、Rootと祖先・初期全子十一Identity、四Mount・隔離条件、元ID領収書の保存・読戻しを確認してからstartした。実IDは`ad31eb7e442b1db7dc63a43d8cf9c402257e6c26dc81ad0767d022cd7bd38e18`、Root Identityは`1687905628:40532396647466567:1793273097947772000`。

結果はcompleted／reason null、helpObserved true／helpConfirmed true、help終了値0、stdout 1,932 byte／stderr 0 byte。permission-profile／cd／configの三つをstdoutでexact検出し、stderr診断はemptyだった。開始／終了は2026-10-29T11:28:07.743409650Z／11:28:08.205410795Z。Containerもexited／ExitCode 0、attach呼出し終了値0、OOMKilled false／Restarting false／RestartCount 0。Image・権限・Host配置・Timeoutを変えず、検証呼出しのlinux除去後にhelpの正常応答を確認した。旧panicの生本文を復元したものではなく、元の実AI編集E2EのCode Mode故障原因や解消は依然として別の未確認事項である。help成功をsandbox内のcommand／権限制御／Host接続の成立へ算入しない。

元ID・停止・Config／Mountを再照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定判断した。通常rm一回後、一覧取得成功・該当零でContainer不存在を確認。Rootは初期十一Identityと全十四entryの現在Identity／nlink／bytes／Hash／link targetを再照合し、既知の三linkは各reparse tag 0xa000001dを確認してentry自身だけをFile.Deleteした。空lock一件・既知probe／領収書・空Directoryだけを通常・非再帰削除し、Root不存在を確認した。今回の残存はない。再試行・AI送信・Docker Engineの起動／再起動・Image取得／更新・過去保持物操作は行っていない。

#### sandbox固定commandの非AI確認条件案 — 2026-10-29

今回は条件整理だけで、実行コード・試験Rootはまだ作成せず、Docker照会・起動も行わない。承認後に局所試験と独立確認を終えてから、既存の用途固定試験と同じ有界Process処理で実行する。新しい公開API・Registry・Lock・Recovery・Provider代役は作らない。

対象は既存local Task Image `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4`の公式Codex 0.164.0。新品Container最大一件・起動一回、CLIも一回のみ。先に成功したhelpを再実行せず、正しい構文`codex sandbox --permission-profile crdd-executor --cd /work --config ... -- /usr/local/bin/python3 -I -B -c <固定Source>`を使う。設定は現在の編集計画と同じdefault_permissions、root deny／minimal read／Workspace write／Codex実行File read、コマンドnetwork falseとする。余分なlinux要素・shell・通常exec・Host／モデル・認証処理は使わない。

実際の引数は次のexact配列だけに閉じる。CLIは`/opt/crdd/providers/codex/0.164.0/codex`、SOURCEは下記271 byteのSourceだけであり、実装時に同じHashを再照合する。CONFIG_1〜3の個数・値・順序を固定し、製品Plan全体やcode_mode／Host／model／認証設定を展開しない。

```text
CONFIG_1 = default_permissions="crdd-executor"
CONFIG_2 = permissions.crdd-executor.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="write"},"/opt/crdd/providers/codex/0.164.0/codex"="read"}
CONFIG_3 = permissions.crdd-executor.network.enabled=false
ARGV = [CLI, "sandbox", "--permission-profile", "crdd-executor", "--cd", "/work",
        "--config", CONFIG_1, "--config", CONFIG_2, "--config", CONFIG_3,
        "--", "/usr/local/bin/python3", "-I", "-B", "-c", SOURCE]
```

Container入口は直前の試験と同じ`python3 -B /probe/probe.py`に固定し、用途固定の監督コードから上記CLIを子一件だけspawnする。shellを経由しない。実行前の局所試験は旧linux・exec・separator欠測・config欠測／余剰／並替え・Source Hash差をすべてspawn零で拒否する。既存`coordinator/tests/integration/codex-executor-sandbox.integration.test.ts`にも正しいsandbox入口と権限設定抽出があるが、Host help・Home読書き拒否等を含む別範囲の試験であり、shell包装・回収処理も今回条件と異なるため、そのまま一括実行しない。恒久Frameworkを追加せず、確認対象を今回の固定commandへ限定する。

固定SourceはUTF-8・271 byte、SHA-256 `c45e2ed831c36651e11f581f210ffecc4dfcfbd741de2ccc1c729d867f686b4a`。内容は次の一つだけとする。

```python
import os
p="/work/sandbox-probe.txt"
data=b"CRDD_SANDBOX_NON_AI\n"
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,"wb") as f:
    f.write(data)
with open(p,"rb") as f:
    assert f.read()==data
os.unlink(p)
print("CRDD_SANDBOX_OK")
```

| 項目 | 承認を求める限定範囲 |
| --- | --- |
| Root | `C:\project\CRDD\.crdd\tests\codex-sandbox-command-20261029-01`のみ。実Repository本文・Git管理領域・認証領域は渡さない |
| 外側隔離 | network none、UID 65534:65534、RO root、cap-drop ALL、no-new-privileges、既存seccomp、pids64。Image取得／Build／更新なし、Network／Volume作成なし |
| Mount | Root内input→/probeはRO、空work→/work・home→/provider-home・tmp→/tmpはRW。空guards/git→/work/.gitとguards/internal→/work/.crddはRO、mountpointも事前に空で作成する |
| 一時的Effect | 上記合成File一件の排他的作成・既知bytes書込み・読戻し一致・unlink。CLIがHome／tmpへ作る補助物は今回Root内だけで確認・回収する |
| 実行前 | Engine応答、exact local Image、他の稼働Containerなし、固定引数／Source Hash、Root／祖先／全初期子のIdentity・非link、既存seccompを確認。元作成IDの不変領収書を保存・読戻し後、構成照合してstart |
| 前提不成立 | Engine停止、Image欠測、他のDocker作業、Root／構成不一致はEffect前停止。Desktop／Engine起動・再起動／修復、代替Image、別引数へのfallbackは行わない |
| 有界処理 | CLIは30秒・stdout/stderr合計64KiB。期限／出力量超過では元Process groupへTERM一回、五秒の終了観測。再試行・期限延長・追加capabilityなし |
| 成功条件 | CLI終了値0とexact成功marker、固定File不存在・workの予定外変更なし、元子ProcessとContainerの終了、正常回収と不存在を別々に確認する。stderrは既存の非秘密分類・byte数だけを記録 |
| 回収 | 元IDと同じ構成・停止を確認した今回Containerだけ通常rm。Root全entry／Identity／nlink／bytes／Hash、既知linkはtargetとreparseを照合してlink自身だけを除去。既知Fileと空Directoryを非再帰・通常削除し、Root不存在確認。force／ACL修復／過去物処置なし |
| 不明・残存 | 作成・終了・内容・同一性が不明なら再試行・強制回収をせず、exact Root／IDと未解決点を記録して保持。既定七日で再評価し、期限だけで削除しない |

この一正例で示せるのは、同じ名前付きprofileを指定したCLI sandbox経路で固定File操作を実行できたことまでである。root deny／minimal read／network falseの各規則の独立した強制証明ではなく、外側DockerのRO／network noneを内側の保証へ重複算入しない。Host接続・Code Mode・実AI編集E2Eの成立も主張しない。承認対象は、この一回の合成File操作と今回物の確認後回収であり、AI送信・Docker再起動・過去保持物操作を含めない。

#### sandbox固定commandの一回成功と回収 — 2026-10-29

人間の承認後、上記のexact引数・三config・固定Sourceだけを使う用途固定入力を準備した。probe SHA-256は`478ffaab75a74156a0f76e613ff1778fc3e106e22c5bd3d1cdb9ed7f83432072`。旧linux／exec／separator欠測／config欠測・余剰・並替え／Source差／期待Source Hash差の八条件は、Popen拒否代役下でspawn零・fixed_argv_invalidへ閉じた。271 byteとSource Hash、64KiB境界・終了の有限代役二条件も成功。独立レビュー残指摘零を確認してから実行へ進んだ。

Engine linux 29.8.1、既存local Image exact一致・稼働Container零、Root／祖先／全初期子十六Identityと非linkを確認し、新品Container一件を作成した。元IDは`2733f9e480f538f1cc4ae05130d8c51d4809c13f65e77cd2d3cd98e308790ca8`、Root Identityは`1687905628:49539595902085877:1793274008325595400`。不変領収書の保存・読戻し、六Mount・固定Image・既存隔離条件を照合後、一回startした。開始／終了は2026-10-29T11:41:31.287438029Z／11:41:32.038969606Z。

結果はcompleted／reason null、CLI観測完了・終了値0、stdout 16 byteのexact成功marker、stderr 0 byte。固定SourceによるFile作成・既知bytes読戻し・unlinkを確認し、監督側のFile不存在とWork全体が空の二保護Directoryだけであることもtrueだった。Containerはexited／ExitCode 0、attach終了値0、OOMKilled false／Restarting false／RestartCount 0。これは現在の名前付きprofileを指定したCLI sandbox経路の正例成立であり、各規則の独立した強制、Host接続、Code Mode又は実AI編集E2Eの成立ではない。

終了後に同じ元ID・Config／Mount・停止を照合し、未指定OomKillDisableのfalse→nullだけを今回の表現差として限定した上で、通常rm一回と一覧上の不存在を確認した。Rootの初期十六Identityと全二十二entryの現在Identity／nlink／bytes／Hash／link targetを再照合。既知の三linkは各reparse tag 0xa000001dを確認してentry自身だけをFile.Deleteし、空lock二件・既知probe／領収書・空Directoryだけを非再帰・通常削除した。Root不存在を確認し、今回の物理残存はない。再試行・help再実行・AI送信・Docker Engineの起動／再起動・Image取得／更新・過去保持物操作は行っていない。製品Source・設定・権限・Timeoutも不変である。

実行許可を提示する際の回収条件は、作成応答の元実ID・同じ構成／所有・停止状態、試験Rootと祖先のIdentity・非linkを確認できた場合だけ通常回収する。作成結果・終了・Identityのいずれかが観測不能なら、確定済みのexact ID／Rootを保持し、自動再試行・force cleanup・別ID再構成は行わない。session/shutdownの受理を終了へ丸めず、transport close・Host子Process exit・Container停止を別々に確認する。元の旧失敗又は過去保持物へ適用しない。

#### sandbox確認後の接続棚卸しと非AI再確認 — 2026-10-29

固定command成功後、既存の編集試験・Provider計画・利用側契約を照合した。`verify-workspace-ai.ts --preflight`はAI分岐を通らず、合成Fileを試験自身で編集してWorkspaceの固定・統合・終了を確認する。CLI→Host→Toolを発火する検査ではない。現在のCRDD Sourceと試験の確認範囲には、この三者を非AIで一括実証する既存入口は見つかっていない。公式CLI全体にその入口が存在しないとは断定しない。新しいfake Provider・Host Client・Workerを追加せず、Host単体とsandbox単体の成功をCode Mode又は元の編集故障の解消へ読み替えない。

Source `19c4f51b3771ef3b3b11325dd23d33d769d8bc6c`の二Suiteを外部AIなしで実行し、18件中16成功・2不合格だった。失敗は公開HTTP試験mainと実保存付きHTTPの子Client境界で、headers_unobserved／timedOut falseとなり、15秒超過とは異なる。通常のローカル接続を許可した環境で同じ二Caseだけを実行し、2件とも成功・終了値0（約58秒）を確認した。実保存Caseは通常完了・取消・応答喪失後の同ID継続、Owner終了と現在の未解決区画の不存在、自己生成Rootの清掃hook完了を確認する。三POSTの本文受領は約0.92秒・0.90秒・3.61秒で既存15秒内だった。先行不合格を上書きせず、18件の単一成功runとも表示しない。モデル選定二件を含む他の16成功は最初の実行結果である。製品Source・権限・Timeoutは変更せず、Docker照会／操作・外部AI・過去保持物操作はしていない。

次に実AIへ進む場合は、新品のRepository内試験Rootで既存Direct／Isolated各一Taskを順次実行する案とする。送信対象は合成Context、合成source.txtと固定編集指示、レビューに必要な合成差分だけであり、本体Context・Source・秘密値は送らない。Codex `gpt-6.1-sol`／mediumで編集、Claude `claude-opus-5-5`／mediumでレビューし、既存の限定是正一回と再レビューを含め各Task最大四段・全体最大八Provider起動とする。Task全体の再試行はしない。Directは既存dirty／stage／未追跡内容の保全、Isolatedは明示固定・二親Merge・Branch／Worktree終了まで既存試験で照合する。既存固定Image・現在の隔離条件・HTTP十五秒を維持し、元のHTTP遅延・Code Mode故障の診断を接続する。失敗時は次のTaskへ進まず、同ID取消・終了確認と今回物の安全な回収だけを行い、不明資源はexact参照付きで保持する。Docker再起動・Image更新・過去保持物操作は含めない。この送信と今回物回収には改めて人間の承認が必要であり、本段階では実施していない。

上記段落の限定独立レビューは残指摘零。二Suiteの母集団、別runの分離、非AI成功の限界、Provider最大起動数と未承認送信の境界をSourceへ照合した。差分の空白検査も成功した。

#### 承認済み編集E2EのDirect停止 — 2026-10-29

人間の承認後、Engine linux 29.8.1・稼働Container零・既存Codex／Claude／Proxy固定Imageのexact存在を確認した。新品`workspace-ai-E6SEIF`の非AI事前確認はDirect／Isolatedとも成功し、既存dirty／stage保全・候補固定・二親Merge・Workspace終了と試験Repository回収を確認した。実AI端末の初回起動は空白を含むNode Pathの引用符がStart-Process搬送で失われて失敗した。Node Processと新Root未生成を読取り確認してから、固定起動コマンドだけをEncodedCommandで搬送し直した。AIの再送ではなく、検証Tool自体の未起動の是正である。

実AIの新品Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-mlV1po`。Directの受付IDは`request-a7ef658e-26bd-4673-ab86-8b7393bca0c9`、相関参照は`operation-ee49d66e-2658-4a49-a137-c857d35dd128`。編集→レビュー→許可済み限定是正→再レビューの四段まで実行し、Taskは`coordinator_task_independent_review_not_approved`でblocked、試験は`edit_task_not_completed`／verify_result、E2E_EXIT=2で停止した。Isolatedは未実行で、Task全体の再試行はしていない。

CodexのAttempt 0／1は両方turnCompleted true、Code Modeを言及するitem error各一件、commandExecution／fileChangeは各零だった。source.txtはBASEのまま、changedPathsは空。Claudeは各回changes_requested・指摘一件を返した。これは編集未成立をレビューが拒否した観測であり、CLI→Hostのspawn・handshake・delegateのどこでCode Modeが失敗したかは、現在の有限診断だけでは特定できない。item errorの本文や生出力は保存せず、単体sandbox成功によってこの故障が解消したとはしない。

今回のHTTPは62要求すべてでheadersを受領し、最長約14.139秒、transportFailure nullだった。15秒超過は今回再現せず、元のHTTP問題全般の解消とは断定しない。四Provider境界すべてでProcess完了／終了、Container・Network不存在、cleanupConfirmedを確認し、一次技術失敗はnull。TaskのcleanupConfirmed／Owner close／runtimeClean／workspaceCleanはtrue、Recovery参照は空。既存Docker inventoryは保全され、標準NetworkのID差だけを既存比較が区別してverifiedとした。標準Network自体を清掃対象にしない。

試験mainの物理Root回収は、成功時の二mode集合を要求する既存Gateで停止し、`fixture_root_or_removal_unconfirmed`を記録した。これはContainer／Network／Task operation等の実行資源の回収不明ではなく、二mode成功用の集合検査を満たさないため、自己生成Rootが既知残存してmainの自動削除対象にならなかった結果である。今回の清掃前確認では現在operations／unresolvedRecoveries／pendingDeliveries／leaseIntentsは零、同じTaskはsettled／blocked・Owner世代null・cleanup true・Recovery参照空、Gitは自己Root一Worktree・mainだけ、共有先WorktreeやCandidate Branchはない。dirty／stage／未追跡は合成の元内容だけである。実AI試験Rootは35通常File・36Directory、全File nlink 1・reparse零、内容Hash `54c07090e7e122fbe5b064c37ddfec927fbc1b686a79cca71af37bf32e9f5667`。非AI事前Rootは結果JSON一File・二Directory、内容Hash `d3f194892a68d12b02743a9a725d69bd6c79e97c736a9b004ac58d0885fe4603`。試験Node不存在・稼働Container零も再確認した。過去物を調査／削除対象へ広げず、この二つの自己生成Rootだけを承認済み清掃対象とする。

清掃では自己生成Git object十四FileのReadOnlyだけを解除し、通常Fileと空Directoryを個別削除した。空の`.git` DirectoryはHidden属性によって最初の通常削除が拒否された。残存全三Directoryだけを再確認し、当該空DirectoryのHiddenだけを解除して通常削除した。ACL修復・force／再帰削除・他Root処置は行っていない。結果要約を本段落へ残した後、実AI／事前確認の両Rootの不存在を確認し、今回の物理残存は零となった。次の調査は既存Code Mode診断の不足区間に限定し、追加AI送信や設定緩和を本結果から許可しない。

#### Direct停止後のCode Mode診断経路の調査 — 2026-10-29

今回の指示は原因調査であり、製品実装・設定変更、AI再送、新しいContainer、Docker再起動、Image更新、過去保持物の読取り／変更は行わない。現行Source・設計・直前の要約と、公開された一般的なCodex設定文書だけを照合した。現行の[CLI参照](https://learn.chatgpt.com/docs/cli/reference)と[権限profile](https://learn.chatgpt.com/docs/permissions)の説明は固定0.164.0のHost内部故障の根拠にはならず、旧版へ設定を機械追従させない。

診断の縮約点はAI Adapter `provider/result.ts`の`itemErrorCodeModeCount`である。元JSONLのerror itemのmessageをメモリ内で受け取り、保存用にはerror item総数と、message由来では`/code[ _-]?mode/iu`の一致件数だけを返す。Executor `result/normalization.ts`はその観測値を`providerExecutionObservation`へ搬送し、`result/validation.ts`は閉じたfieldと上限を検査する。これらの利用側にHost起動・接続・委譲の段階情報が隠れているわけではない。生出力を後から読む経路や、清掃した試験Rootを再構築する経路は作らない。

外部Effectなしの純粋比較で、Host spawnの権限拒否・handshakeの不一致・Tool委譲の利用不能を表す三つの合成messageを、正式な`parseProviderResult`へ同じEnvelopeで渡した。三入力ともparser confirmed・Code Mode件数一件・command／fileChange零で、返却診断全文が同一となることをassertした。これは分類の情報落ちの再現であり、実故障が三候補のいずれかだという実証ではない。既存Codex結果・選定Consumerの二Suiteも7件全成功。合成内部errorを含んでもSchema上の完了をconfirmedとする既存契約を確認したが、これをTask採用・実編集成功へ解釈しない。内部error一件だけで常にTaskを拒否する変更は、回復可能な中間errorまで止める可能性があり、この調査では採用しない。

現時点の結論は、CLI／Hostの具体的故障原因は未確定、既存観測からその区間を復元できない原因は診断の縮約で確定、という二点である。隣接Host／bwrapの配置、同じ名前付きprofileのsandbox正例、Host単独計算成功は保全するが、CLI→Host接続の成功へ合算しない。特に権限設定の明示readがCLI実体だけであることは照合したが、Hostがその制限内で起動されると確認していないため、Host Path追加allowを是正とはしない。

最小是正案は、新しいLog／State／Managerを作らず、既存error itemのメモリ内分類に「Host・spawn・handshake／protocol・接続終了・Tool・権限・欠測・Timeoutを言及したか」と未分類件数を閉じた有限観測として追加することである。語句の言及と実際の発生点は区別し、本文・Path・Command・任意error codeを保持せず、成功判定・権限・Timeout・Imageは変えない。改訂する場合はAI Adapterの返却型・分類、Executorの閉形式検査、既存Coordinator／検証Toolの搬送と合成負例を同時に追従する。固定版で一意なerror code又は接頭辞を確認できたものだけを段階分類へ昇格し、それ以外は候補markerのままにする。実装はまだ行っていない。分類の非AI確認と独立レビューを終える前に、同じ広い実AI E2Eを再送しない。

#### Code Modeの非秘密診断の最小是正 — 2026-10-29

人間の継続指示に基づき、上段の診断追加だけを実装した。AI Adapterの既存error item処理へ八つの`itemError*MentionCount`と`itemErrorUnclassifiedCount`を追加し、message本文はメモリ内だけで処理する。Code Modeの一般語だけでは分類済みとせず、message欠測も未分類へ含める。同じitemの複数語句は独立に数え、原因・発生点は確定しない。新しい公開関数、Log、State、Registry、Managerは追加していない。

Executorの閉形式検査は、九fieldの全件存在又は全欠測だけを受理し、旧観測を零補完しない。負数・非整数・非有限・総数超過、分類済み件数と未分類件数の矛盾を拒否する。Coordinator公開投影は同じ検査へ直接接続し、搬送前の新field集合だけへの二重固定を除いた。Workbench試験で正式parserから段階診断への新値保全と秘密風本文の非搬送を確認した。Envelope・採否・認証・Authority・清掃条件・Timeout・Imageは変更していない。Architectureと既存Quality義務への接続も追従した。

最終局所三Suiteは36件全成功。Executor全回帰は15件全成功。Coordinator Task Runtime全体は制限環境で157件中156成功・一件junction作成EPERM、同じ一件の通常環境成功に続き、Suite全体を通常環境で157件全成功として再確認した。先行不合格と別runを区別し、合算しない。四Packageの型検査、変更七TypeScriptの整形・警告を失敗とするLint、diff checkが成功した。初回Workbench型検査の試験Record型不足、及びCoordinatorの有限代役が旧診断のままで新期待値と一致しなかった追従漏れは是正して再確認した。製品の拒否条件を緩めていない。

AI Adapter全回帰は27件中26成功・一不合格。残る`catalog-loading.contract.test.ts`は、同梱Catalogの検査Source内にDomain importが一箇所という置換前提を持つが、基準HEADの同じSourceにも二箇所のimportがあり、split長3対期待2で停止する。今回そのSourceと試験は変更しておらず、診断追加の成功へ混入せず既存試験追従の別件として保持する。全Package回帰成功又は全体QA完了とは表示しない。

限定独立レビューは指摘零。語句分類の重複・未分類・旧欠測・相関、閉形式と秘密非搬送、Coordinator／Workbenchへの搬送をSourceで反証した。実AIは再送せず、Docker・Image・過去保持物も操作していない。次の実AIではこの新診断を使えるが、今回の非AI成功で旧故障原因が確定又は解消したとは扱わない。

#### Catalog試験の既存追従漏れの是正 — 2026-10-29

人間の継続指示に基づき、上段で別件として保持したCatalog試験一件を是正した。製品の`catalog/validation.ts`と`catalog/resolve.ts`は各々Domainの型import・実行時importを持つため、独立fixtureへの複製時に二参照を同じ正式Ownerへ置換する。試験のexact出現数期待を二参照へ追従し、replaceAllを使用した。正例、JSON欠落・構文不正・Schema不正の子Process終了値／固定理由／成功marker不存在というOracleと、fixtureのfinally清掃は変更しない。製品Source・拒否条件・Catalog値は不変である。

修正後のAI Adapter全回帰は27件すべて成功、整形・型検査・警告を失敗とするLintも成功した。先行26成功・一不合格を撤回せず、追従後の別runとして記録する。実AI再送、Docker／Image操作、過去保持物の操作は行っていない。次の実AI確認では、前段で追加した有限語句診断を使い、同じ合成内容・Codex GPT-6.1 Sol medium／Claude Opus 5.5 medium、Direct成功後だけIsolatedへ進む一回の編集E2Eを改めて提示する。Task全体の自動再試行・新しい実行管理は追加しない。

#### 新診断付き編集E2Eの一回停止 — 2026-10-29

人間の明示承認後、Engine linux 29.8.1・稼働Container零と既存固定Codex／Claude／Proxy Imageのexact存在を確認し、新品`C:\project\CRDD\.crdd\tests\workspace-ai-LY1F33`で既存編集E2Eを一回実行した。通常の送信同意は対話端末で行う。Direct受付IDは`request-7f4daa4f-6210-4fad-8d9a-3063ef70bd3f`、相関参照は`operation-894710c5-faf5-4d28-a0df-8fad941b62f3`。編集→レビュー→承認範囲の限定是正→再レビューの四段で停止し、Isolatedは未実行、Task全体の再試行はしていない。Taskの一次結果は`coordinator_task_independent_review_not_approved`、試験は`edit_task_not_completed`／verify_result、E2E_EXIT=2。実行Sourceの不変も確認した。

新診断の九fieldは保存結果まで搬送されている。Codexの初回／限定是正はいずれもCode Mode言及error一件・未分類一件、八mentionは全零、turnCompleted true、commandExecution／fileChangeは零、source.txtはBASE、changedPaths空だった。Claudeは両回changes_requested・指摘一件を返した。新観測が欠測したのではなく、実errorが今回の有限語句に一致しなかった結果である。marker零をHost／起動／接続／権限問題の不存在へ解釈せず、実故障の原因・段階は引き続き未確定とする。単に同じ広いE2Eを再送したり、推測で権限・Imageを変える根拠にはならない。生Provider出力・エラー本文は保存していない。

HTTPは59要求すべてheaders受領・最長12.696秒、transportFailure nullで、今回も15秒超過は再現しなかった。四Provider境界すべてでProcess完了／終了、Container・Network不存在、cleanup true・技術一次失敗nullを観測した。Taskのcleanup true・Owner close true・runtimeClean／workspaceClean true・Recovery参照空。既存Docker inventoryは保全され、標準NetworkのID差だけを既存比較が区別してverifiedとした。標準Networkは今回清掃の対象にしない。

試験mainは前回同様、二mode成功集合を満たさず`fixture_root_or_removal_unconfirmed`で物理Rootの自動削除を停止した。清掃前の再確認ではoperations／unresolvedRecoveries／pendingDeliveries／leaseIntentsは零、同Taskはsettled／blocked・Owner世代null・cleanup true・回復参照空だった。Gitは自己Root一Worktree・mainだけで、追加Candidate Branchや共有Git先はなく、元の合成dirty／stage／未追跡を保全している。試験Node不存在・稼働Container零、空のLease領域を確認。全35通常File・36Directoryはlinkなし、全File nlink 1、内容Hash `3cfb8a3a22e6ef9d77ad2a5eade2676ceaba88677fc2bd85cd524cce08a44395`で記録し、この自己生成Rootだけを承認済み清掃対象とする。過去保持物は調査・清掃対象へ広げていない。

その後、Rootと既知祖先の非reparse・全七十子entry・既知属性集合を再照合し、今回Git objectのReadOnlyと空`.git` DirectoryのHiddenだけを解除して、通常Fileと空Directoryを個別削除した。force／再帰削除・ACL修復を行わず、Root不存在を確認した。今回の物理残存は零であり、Docker再起動・Image更新・過去保持物操作は行っていない。今回の有限分類では原因特定に十分でなかったことを保持し、追加実AIは停止したまま、次は固定版のerror定型と既存観測点の照合を先に行う。

#### 固定CLIのWarningとerror itemの意味の再確認 — 2026-10-29

固定配布Commit `6aaac694803004a63c6f393d153c96d22521a6b9`の公開SourceをGitHub接続で読取り確認した。内部Source・認証・実Repository本文は外部へ送らず、公開Repository・Commit・Source Pathだけを照会した。AI再送・Docker照会／操作・Image更新・過去保持物操作・製品実装変更は行っていない。

重要な訂正として、固定版[JSONL出力](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L409)の`collect_warning`は、Warningを`item.completed`の`ErrorItem`へ変換する。ConfigWarningも同じitem型へ投影し、いずれもCodexStatusはRunningを維持する。従って`itemErrorCount`は実行故障の件数ではなく、警告を含み得るJSONLのerror型item数である。過去段落と会話で「Code Mode実行エラーが編集を止めた」と因果を読ませた説明は、現在の観測では確定できないとして訂正する。編集／File変更が成立せずレビューが拒否した事実は維持する。

[固定版features](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/features/src/lib.rs#L1198)は`code_mode`／`code_mode_only`をUnderDevelopmentとして登録し、同Fileの`unstable_features_warning_event`は明示有効化された開発中機能を列挙する警告を生成する。CRDDの編集計画は両者を明示有効化し、助言計画にある`suppress_unstable_features_warning=true`を持たない。この警告は、現在の八語句分類に一致しないままCode Mode件数に一致し得る。正式parserへ同版の警告形式を合成入力して、confirmed・総数一・Code Mode一・未分類一・全mention零になることをassertした。今回の保存観測と同じ値になる反例であり、今回の実messageがこの警告と同一だと復元した証拠ではない。

もう一つの[モデル対応警告](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/session/code_mode_warning.rs#L5)も同じ合成投影となる。ただし固定同梱[models.json](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/models-manager/models.json#L177)のGPT-6.1 Solは`tool_mode=code_mode_only`を持つため、同梱定義だけを前提にその警告が発火したとは判断しない。実行時に取得したModel metadataは今回照会しておらず、モデル非対応を原因にしない。

[Host接続](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/code-mode/src/remote_session/connection.rs#L158)の固定Sourceは、通常の子Process生成とhello／handshakeを分け、具体的なHost起動・接続失敗はその定型を持つ。Host spawn自体をCRDDの名前付きコマンドsandboxへ通す処理ではない。gRPC接続の別実装もあるが、固定Featureの既定はfalseでCRDD計画にもその有効化はないため、過去の非AIprotocol試験と本番protocolが異なるとはこの調査から断定しない。Host読取りallow追加やgRPC切替は是正として採用しない。

次の最小案は、既存error item解析で固定版の既知Warning文面とのexact一致を非秘密の補助件数として追加することである。JSONLで元通知種別は失われるため、この一致だけでWarning由来又は非故障とは確定せず、既存itemErrorCount・未分類件数から除外しない。未知itemを成功又は警告へ丸めず、生本文を保存せず、単に警告を非表示にして解消扱いにもしない。新Manager・Log・Stateは不要である。Warning通知と同じmessageの通常ErrorItemの区別不能も非AI反例として固定してから、編集未成立そのものの観測・指示・結果契約を再評価する。同じ広い実AI E2Eの追加再送は、今回の確認には含めない。

#### 既知警告文面の補助一致と非AI確認 — 2026-10-29

人間の継続指示に基づき、既存観測へ`itemErrorKnownWarningTextCount`一fieldだけを追加した。固定CLIの開発中機能警告とModel Code Mode対応警告について、可変部分を限定した全文テンプレート一致を4096 UTF-16 code unit以内・改行なしで判定する。本文・Path・Model値を返さず、元通知がWarningか通常ErrorItemかを断定しない。総数・Code Mode件数・八語句分類・未分類件数は従来どおり独立保持し、一致を減算・非故障・Task成功へ利用しない。

Executorの同じ閉形式検査へ新fieldの0〜総数・safe integerを接続した。新field欠測の直前形式、語句分類導入前、従来0.149の既知形式も、それぞれexact集合のまま受理し、欠測を零補完しない。利用側の期待値と有限代役、正式parserから段階診断までの結合を追従した。固定文面・前後の余分文字・大小文字差・改行・未知本文・message欠測・上限超過、同じ文面を持つ通常ErrorItemとの区別不能、総数・未分類の非減算・秘密風値の非搬送を反証した。Architecture／Qualityの説明もerror型がWarningを含み得る意味へ訂正した。

AI Adapter全28件、Executor全15件、Coordinator Task Runtime全157件、利用側の結果正規化／診断三十件が、それぞれ別runで全成功した。初回局所三Suite三十七件とは重複を合算しない。四Package型検査、変更六Sourceの整形・警告を失敗とするLint、diff checkが成功し、独立Sourceレビューは残指摘零。新しい公開関数・Manager・Log・State・Registryを追加せず、実行許可・採否・権限・Timeout・Image・清掃条件は不変である。

この変更は診断の意味の誤認を避けるための補助であり、旧実messageを復元した結果でも、編集故障の解消でもない。AI再送、Docker照会／操作、Image更新、過去保持物操作は行っていない。

#### 編集未成立の入力と結果契約の非AI照合 — 2026-10-29

既知Warning補助の追加後、実AIを再送せず、現在の指示・Path・Mount・正規化のSource接続を確認した。Workbenchの固定依頼はTask objectiveへ入り、`readPaths`は`PROJECT_CONTEXT.md`にallowedPathsを加える。Task PacketはExecutorへ/work内・allowedPathsだけの編集、利用可能なFilesystem／Shell・Python／POSIX text Toolの使用、実File確認を指示する。Executor計画はexecutor役割でread_write、Docker計画も/workへRW bindし、Gitと内部状態だけをROで保護する。今回Sourceの確認範囲で、ExecutorへReviewerの読取り専用指示やread_only Mountが混入する接続漏れは見つかっていない。ただし現在のSource照合を、過去の実Container全構成の再観測やAIによる入力理解の証明にはしない。

結果の意味は二層に分かれる。`codex-executor-result.json`とPacket指示は`status=completed`の形を指定し、変更がなければchangedPaths空を許可する。Executor `result/normalization.ts`はsummaryの形式を検査するが、上位へはstatus・changedPaths・verificationCountと有限技術観測だけを渡し、summary本文は返さない。従って「変更不要」と「Toolが利用できず変更できなかった」をsummaryだけに書いた二つの合成結果は、同じcompleted／変更零の正規化結果になる。正式公開normalizerへ二入力を渡して両方confirmed・正規化結果のdeepEqual・summary不存在を非AIでassertした。これは説明が失われる境界の確認であり、今回の実summaryがどちらだったかの復元ではない。

このSchema受理はTaskの目標達成や採用を意味せず、実Fileと独立レビューが別に検査する。今回もレビューは拒否しており、このSource照合を成功判定の緩和、全noopの拒否、新しい失敗State又はRecovery追加の根拠にしない。現時点で編集未成立の原因は未確定のままである。

次の調査案は、同じ広い四段E2Eを繰り返したり説明語句のcounterを増やす前に、一回の合成Executor診断に限って、既存構造化結果のsummaryを正規化で捨てる直前に確認する方式を検討することである。Provider生JSONL・資格情報・生stderrは対象外、summaryも未信頼のProvider申告として実故障の証明と分ける。ただしこれは現在の自由記述非公開境界を一時的に変更するため、実装・表示・AI送信へ進む前に、exactな確認先・UTF-8 byte上限・送信内容・回数・回収条件、同一Attempt／Recovery相関、改行／制御文字拒否、認識済みSecret検査不成立時の非表示、端末・Log・診断・Fileへの非保存と終了後の参照破棄を具体化し、人間承認を得る。表示先自体が履歴を保持する場合に「メモリだけなので非保存」とは扱わない。別Attempt・秘密風値・検査例外・上限超過は表示零／保存零を確認する。方式は未確定であり、今回の指示から非公開境界変更の許可は推定しない。製品コード・成功条件・権限・Timeoutを変更せず、AI再送・Docker照会／操作・過去保持物操作は行っていない。

#### 試験限定summary確認の構成候補 — 2026-10-29

既存`createProviderExecutor`のHost契約と単独試験入口を確認した。元Provider stdoutはExecutor内部の`acceptOutput`でだけ正規化され、試験Hostにもsummary本文を渡す既存callbackはない。従って本番APIの無条件拡張、有限診断への自由記述追加、HostやDocker起動の複製は採用しない。NodeのModule試験機能は既存Executor試験で使用しているが、summary観測に流用できることはまだ非AIの接続確認が必要である。

最小候補は、検証Tool専用の新品子Processで、対象consumerをimportする前に元normalizerを呼ぶ薄い観測を置く方法とする。元関数へ同じ引数を一回だけ渡し、同じ返却object又は同じ例外を返す。元がconfirmedの時だけ同じrawを既存公開Parserで再解析し、最初のCodex／executor呼出しからsummary候補一件だけを確認する。normalizerの引数にはTask／Attempt／Recovery IDがないため、このseam自身がexact identityを検証したとは表示しない。同時Task一件・専用子Process・呼出順による限定結合であり、identityは外側の既存Task lifecycle結果から別に確認する。本文は元Task終了と外側結果・観測順の確認後にだけ表示可能とし、異なるTask・並行Task・role／provider順序差・呼出し欠測又は予期しない重複は表示零へ閉じる。既存の限定是正に伴う二回目Executorのsummaryは取得・表示しない。

認証・同意・Authority・Process・取消・回収・採否は代役化しない。再解析・Secret検査・表示が失敗しても元return object／例外を変えず、観測側だけ固定理由へ閉じる。Module観測を含むため、この結果を通常Source無計測のE2E成功とは表示しない。元normalizer throw、再解析／検査throw、呼出し零・余剰・順序差、二Task並行、元結果・清掃不変を非AIで確認する。観測復元は専用子Processの終了まで確認し、mock.restoreだけから既読consumerの復元を推定しない。新しい製品公開API・永続State・Log・汎用hook Frameworkは作らない。

実行候補は新品合成RepositoryのDirect一Taskだけとし、Isolatedへ自動進行しない。合成Context・source.txtの固定一行編集指示・合成差分だけを送り、Codex GPT-6.1 Sol mediumの編集とClaude Opus 5.5 mediumのレビュー、既存限定是正一回・再レビューを含め最大四Provider起動とする。単段だけを見てTaskのOwner／レビューを迂回する経路は作らず、Task全体再試行はしない。既存固定Imageと通常同意・隔離・Home排他を使用し、今回自己生成したRoot／資源だけを同じID・内容・停止の確認後に回収する。Docker再起動・Image更新・過去保持物操作は含めない。

表示は最初のCodex Executorのsummary一件だけ、UTF-8最大2048 byte・単一行・制御文字とPath表現拒否・既存認識済みSecret検査成立を条件とする。欠測・上限超過・検査例外・相関不明では本文を表示せず、固定理由だけを残す。切詰めや伏字で許可条件を満たした扱いにしない。本文をFile／自動Log／耐久診断／公開APIへ保存せず、元JSONL・stderr・資格情報は表示しない。判定に使った本文の参照は確認後に破棄する。表示してもProviderの未信頼な申告であり、OS／Host故障の事実へ昇格しない。

従来の「端末も含め非保存」をそのまま満たす案ではない。普段の外部端末へ表示すれば、端末を閉じるまでスクロールバックに残り、利用者側の記録機能があれば別途保存され得る。この残存条件を明示して人間が受容した場合だけ、端末への一回表示を限定例外とする。Chatや結果JSONへ本文を貼らせず、確認後は利用者に原因候補の要約だけを返してもらう。例外を受容しない場合は本文表示をしない。専用Viewerや新しい一時GUI基盤で回避する実装は追加しない。

上記は承認候補の具体化だけであり、summary観測の実装・本文表示・AI送信は未実施。方式の非AI成立を確認できなければ実AIへ進まず、別の製品hook追加へ自動拡張しない。

#### 試験限定summary確認の実装・非AI確認 — 2026-10-29

人間の限定承認を受け、Executorの試験用観測とWorkbenchのDirect専用入口を接続した。製品公開API・結果正規化・採否・Timeout・保持／回収条件は変更していない。既存normalizerを同じ引数で一回呼び、元返却object／例外を維持する。最初のCodex説明文だけを検査済みメモリ値として保持し、元Task終了・実行資源cleanup・外側相関・試験物処置結果・結果記録成功を確認後に端末へ一回表示する。故障証拠フォルダの保持と実行資源cleanupは区別する。本文の自動保存・自動Log・公開結果への追加は行わず、端末scrollback残存だけが今回の受容範囲となる。

非AIで、検査拒否・検査例外・表示例外・一回表示・二回目Executorの非採取・欠測／余剰／別role／複数Task・処置欠測・結果書込み失敗・安全保持を確認した。新品Node子では実Controllerと有限Commandを使い、Codex編集→Claudeレビューの正規normalizer接続、九purpose順序、各cleanup一回、子終了を確認した。未承認／非対話端末は64で拒否する。HTTPを含む試験Tool回帰16件、構造化結果と診断30件が成功し、Executor／Workbenchの型検査が成功した。独立レビューの2指摘（処置結果の確認不足、接続試験の到達不足）は是正し、再レビュー残指摘0。実AIは本項記録時点では未実施であり、通常無計測E2E成功へ換算しない。

次の実行は承認済みの新品合成Direct一Taskだけとし、Codex gpt-6.1-sol／mediumとClaude claude-opus-5-5／medium、既存限定是正込み最大4段を維持する。Isolated・自動再試行・Docker再起動・Image更新・過去保持物操作へ拡張しない。端末の通常送信同意は引き続き利用者が入力する。

#### Direct説明文診断の実測結果 — 2026-10-29

承認済みの一回を新品領域`.crdd/tests/workspace-ai-SzDdsl/`で実行し、人間申告の終了値は`DIAGNOSTIC_EXIT=2`だった。Isolated・自動再試行・Docker再起動・Image更新は行っていない。Requestは`request-dcd0b3e3-3921-415c-bde4-bfb05c050433`、相関は`operation-42241c65-0037-4f74-be78-209d58c3b9e2`。Codex初回とClaude初回レビューの2段結果を観測し、Claudeはchanges_requested／finding 1。是正Codexは準備後の取消境界だけがあり、Provider作成・開始・完了は未観測だった。

一次失敗は状態GETの`headers_unobserved`／15秒Timeout。該当Client ordinal32は発行1793279607327、応答Header未受領、期限確定1793279622338（15011ms）、終了1793279623063。対応Server ordinal32の受信観測1793279622788はClient発行から15461ms後、応答終了1793279623062（受信後274ms）。Owner状態照会は受信後19msで終了した。この区間はServer受信観測以前の待機が支配的だが、Client送出・接続待ちとServer event loop待ちの内訳は既存時点だけでは断定しない。Timeoutを延長せず、同じTaskの取消を行い、status cancelled／phase settled／cleanup true／Recovery参照0で終了を確認した。

Codex初回はturnCompleted true、error型1件、CodeMode語句1件、既知警告文面一致1件、command／fileChange 0件、候補Path 0件。既知警告文面一致は警告由来やHost故障の確定には使わない。合成sourceはBASEのまま。段階結果2件と終了境界3件（未開始の是正段を含む）が一致しないため、今回の説明文表示Gateは不成立となる。本文は保存していないため後から復元せず、説明文による原因確認は未完とする。通常無計測E2E成功へ算入しない。

初回2段と未開始是正段の全境界でProcess終了・Container不存在・Network不存在・cleanup true。Task Owner／HTTP Client終了、排他取得と解放の同一Owner相関、operations／pendingDeliveries／unresolvedRecoveries／leaseIntents各0を確認した。既存の合成queue-a／queue-bとready定義は未起動のfixture入力であり実行中ではない。Dockerの現況に今回資源はなく、既存停止Container2件は不変更。標準bridge ID差は既存比較でverified、追加利用者資源なし。試験フォルダは成功成果条件を満たさず自動保持されたため、Front AIが今回Rootだけの安全清掃を確認する。清掃前inventoryは35 File／36 Directory／89291 byte、全File nlink1・Reparseなし、inventory SHA-256 `c53e7f1e4fafb61bb69b93846d225ece9712785cc4035f79703240e2a4ff69b6`。過去保持物は操作しない。

今回Rootの清掃は完了した。実行Node PID35584と同試験を参照するNodeの不存在、Git worktreeが合成main一件だけであること、元dirty／stage／untrackedとBASEの保持、リンクなし・File単一linkと上記inventoryを確認した。35 Fileを個別削除し、自己生成Git objectのReadOnly属性と空の`.git`のHidden属性だけを解除して、36 Directoryを空確認後に削除した。Root不存在を再確認済み。ACL・製品Git履歴・認証・過去保持物・既存Docker資源は変更していない。

#### HTTP受信前待機の非AI切り分け — 2026-10-29

対象は検証Toolの実装詳細とQualityの観測根拠に限定した。着手前に同一Taskの取消・子close・Server終了・本文非保存、HTTP15秒／Workspace60秒、公開API不変更を既存Source／Workbench設計へ照合した。実装・技術品質の独立レビュー、文書の直接伝播・リンク確認を行い、製品機能・決定権限・準拠基準・Releaseを変えないため全体準拠監査とRelease判断は発火させない。AI送信・Docker照会／操作・過去保持物操作は今回行っていない。

既存Client frameへ要求生成とHeader送出直前の時刻を追加し、同じrequest objectだけを相関させた。送出直前は送達証明ではない。Serverを所有する検証Processには短命Timerの最大遅延一区間だけを加え、同期I/O・CPU・OS待ち等の原因断定とは区別した。欠測null、時刻範囲・因果順序・余分field拒否、終了時の同callback購読解除・Timer解除を維持する。新しい保存・監視Process・Worker・Queue・Recoveryは作っていない。

新品の独立HTTP Clientと合成loopback Serverで、Server側だけ1.5秒停止してもClientは送出直前へ進むこと、送出直前→Server受信300ms超、Timer遅延1000ms超を確認した。これは非AIでの因果反例であり、以前の15秒Timeoutの同一原因証明ではない。親22秒停止＋独立Serverでは子HTTPが15秒以内に成立する既存反例も維持した。過去実測には新しい時刻がないため、過去原因の確定や本文の復元はできない。

最終候補のClient／HTTP試験24件は全成功（58.85秒）。型検査・変更5 FileのLint／整形・diff検査も成功。独立レビューのMinor2件（応答Headerが送出前となる逆順拒否、購読解除の試験代役不足）を是正し、局所3件と全24件を再確認、再レビュー残指摘0。変更対象は検証Toolだけであり、本番Coordinatorの修正完了・実AI編集成功・過去故障の解消とは表示しない。次の実測を行う場合は既存の実AI送信承認を別に確認し、無断再送しない。

#### 新HTTP診断付きDirect一回の実測 — 2026-10-29

人間の再承認後、Engine29.8.1／稼働Container0／既存固定Image3件を読取り確認し、非AIの観測2件と閉形式3件を再確認して、新品`.crdd/tests/workspace-ai-WVzi8a/`のDirect一Taskだけを実行した。Requestは`request-ea3ddf6b-93d0-4e07-a353-a3e727b7aa34`、相関は`operation-4f24f13a-a5bd-44e0-ae82-6a78aa904fc3`。Codex gpt-6.1-sol／medium、Claude claude-opus-5-5／mediumで編集→レビュー→限定是正→再レビューの4段が終了した。Isolated・Task再試行・Docker再起動・Image更新は行っていない。

人間申告は`summaryInspection.displayed=true`／`summary_displayed_after_task_close`、`DIAGNOSTIC_EXIT=2`。説明文の限定確認は成立したが、未信頼のProvider申告は実基盤故障の確定根拠にしない。本文を本記録・File・自動Logへ複製せず、表示済み内容は端末scrollbackの限定受容として扱う。機械的なTask結果はblocked／`coordinator_task_independent_review_not_approved`。Codex両回とも候補Path0、command／fileChangeイベント0、turnCompleted true、error型1件／CodeMode語句1件／既知警告文面一致1件。Claude両回ともchanges_requested／finding1。合成sourceはBASEのままであり、編集E2E不合格は維持する。

HTTP58要求は全Headerを受領し、transportFailureなし。最大Header待機はordinal25の14574ms。Client開始1793280792218、要求生成1793280792230、送出直前1793280792234、Server受信1793280806526、応答終了1793280806787、Client Header受領1793280806792。送出直前→受信は14292ms、受信後応答261ms、Owner照会16ms。受信前の待機が支配的と分かったが、送出直前は送達証明ではない。Server側Timerの最大遅延は別の時間帯（expected1793280889033／observed1793280903567／delay14534ms）で、同区間に重なるClient要求は記録されていない。Server処理停滞の存在とHTTP最大待機の直接因果を同一視しない。今回Timeoutがなかったことも過去故障の解消証明ではない。

全4段のProvider作成・開始・終了とProcess終了・Container不存在・Network不存在・cleanup trueを観測。Taskはphase settled、Recovery参照0、secondaryFailure0、operations／pendingDeliveries／unresolvedRecoveries／leaseIntents各0、同Ownerの排他取得・解放が相関した。試験Node PID37016と同試験参照Nodeの不存在、合成mainだけのGit worktree、元dirty／stage／untracked保持を確認した。Docker現況に今回資源なし、既存停止Container2件と利用者Networkは不変更、標準bridge ID差だけを既存比較がverifiedとした。成功成果条件未達で自動保持された今回Rootを、既存の人間承認に従いFront AIが清掃する。事前inventoryは35 File／36 Directory／119732 byte、全File nlink1／Reparseなし、SHA-256 `52a6faa9e7422b61841e2bf3acda848905dce09bfa93773634eb5b7a646a06f4`。過去保持物は対象外。

今回の35 Fileは個別削除し、自己生成Git objectのReadOnly属性と空の`.git`のHidden属性だけを解除して、36 Directoryを空確認後に削除した。`workspace-ai-WVzi8a`の不存在を再確認済み。ACL・本体Git履歴・既存Docker資源・認証・過去保持物は変更していない。追加再実行はしていない。

#### 実編集と成功済み非AI試験の起動条件照合 — 2026-10-29

今回は読取り調査と純粋な計画生成・既存試験だけを実施し、AI送信・Docker照会／操作・過去保持物操作・製品Source変更は行っていない。現行`planProviderExecution`へgpt-6.1-sol／medium／executorを渡し、成功済み固定commandと同じpermissions三設定（root deny／minimal read／workspace write、network false）、作業場所`/work`、stdin入力、code_mode_only・Host有効／fallback禁止、shell／unified_exec有効をassertした。AI Adapter回帰28件成功。実編集入力のexecutor指示は編集とPython／POSIX Toolの利用を許可しており、助言用のTool禁止指示を渡す構成ではない。

| 観点 | 成功済み非AI確認 | 実AI編集 | 残る確認 |
| --- | --- | --- | --- |
| 固定実行物 | 同じTask Image／CLI0.164.0／Host | 同じ固定Identity | 別版・別Imageの差を示す根拠なし |
| 外側隔離 | UID65534・RO root・cap-drop・no-new-privileges・seccomp・pids64 | 同じ固定方針 | 同時Process／補助Threadの総量は未計測 |
| 内側権限・作業場所 | 三permissionsと/workで固定Pythonの作成・読戻し・削除成功 | 同じ三permissionsと/workを計画 | 実AIによるTool委譲と同じ経路の成功ではない |
| 起動順 | Host単独の固定計算、CLI sandbox→固定commandを別々に確認 | CLI→Host→Code Mode→nested Tool→sandbox | 接続・委譲のどこが未成立かは不明 |
| 入力・承認 | 固定commandを直接指定。Model・自動承認・JSON結果Schemaなし | stdin Task Packet、Model選択、approve-for-me、結果Schema | 明示的な構成差だが、不具合の確定ではない |
| Home・通信 | 空Home・network none・認証なし | 既存認証Homeと限定Proxy | 非AI確認から本番Home／Proxyの成立を推定しない |

固定版公式Source Commit`6aaac694803004a63c6f393d153c96d22521a6b9`を追加確認した。[CLI起動](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/arg0/src/lib.rs)はTokio multi-thread、[Host起動](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/code-mode-host/src/main.rs)はcurrent-threadである。従って「両者が各々CPU数のworker poolを持つ」という単純仮説は採用しない。補助Thread／子Processを含むpids64不足は未証明であり、上限引上げの根拠にはしない。

[固定JSONL変換](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/exec/src/event_processor_with_jsonl_output.rs)の`map_item_with_id`はCode Mode cell／Toolの全面投影をせず、対応外をNoneにする。[Code Mode実行](https://github.com/openai/codex/blob/6aaac694803004a63c6f393d153c96d22521a6b9/codex-rs/core/src/tools/code_mode/execute_handler.rs)の開始・初回結果失敗はモデル向け`RespondToModel`へ返る。そのためcommand／FileChange零や既知警告一致だけで、Host未起動・Code Mode未発火・具体故障原因を証明できない。新しいcounterの追加、権限・期限・Image変更は採用しない。

調査結論の独立レビューは限定Pass／残指摘0。次の候補は、同一cgroup内でCLIとHostを独立二Processとして同時稼働させる非AIの資源観測であり、実行は未承認・未実施。共存成功をCLIによるHost解決／spawn／handshake／Tool委譲の成立とは扱わず、離散samplingで瞬間peak不存在や本番最大資源量を証明しない。実施するなら開始前・両者稼働時・終了後のpids current／max／拒否counterと元PID終了を相関し、秘密なし・network none・固定Image・pids64を維持して、一回の試験物だけを回収する条件を別途固定する。

#### 非AI CLI／Host共存試験の実行前固定 — 2026-10-29

人間が同時稼働一回と今回物回収を承認した。対象Rootは`C:\project\CRDD\.crdd\tests\codex-cli-host-coexist-20261029-01`のみ。現行固定Codex Task Imageでnetwork none、UID65534、RO root、cap-drop ALL、no-new-privileges、既存seccomp、pids64を維持する。inputだけRO、空work／home／tmpはRW、work内.git／.crddに空guardsをROで重ねる。認証・Repository本文・Proxy・外部AIは使用しない。製品Source・設定・上限・Image・過去保持物は変更しない。

用途固定probe SHA-256 `404601768eef123d72794a05fbf8f34c8ea75dc94c244176e4fe23574819c795`。CLI argvは現行公開Planのgpt-6.1-sol／medium／executorから生成した全argvとexact一致した。stdinへ一byteも渡さず独立CLI Processを保持し、独立Hostへ公式V1 protocolのhello／open／固定計算`text(String(1 + 1));`／shutdownを送る。空EOFによるCLI exit1＋入力なしmarker、Host計算2＋EOF／exit0、元Process終了、pids current基準復帰・拒否counter不増・既知resource error未観測を共同確認する。30秒、stream各64KiB、Host16frame、各元Process groupへ必要時TERM一回と5秒の終了確認。失敗は再試行しない。生出力はメモリ処理だけで、有限段階・数値・元PID・終了値だけを残す。

局所の正常／不正結果3負例、資源観測の正常／欠測・残存・拒否counter・既知error4負例、全argv一致を確認。独立レビューの終了Gate不足を是正して、再レビュー残指摘0。同一cgroupの独立二Process共存だけを評価し、CLIによるHost解決／接続／Tool委譲、本番最大資源量、離散samplingによるpeak不存在へ主張を拡張しない。Engine29.8.1・固定Image存在・稼働Container0、Root祖先の非linkを確認した。作成元IDの領収書と構成照合後に一回だけ起動し、未知ならその元ID／Rootを保持する。

#### 非AI CLI／Host共存の一回結果 — 2026-10-29

元Container ID`a4811f84b4566a8b6ede59cbfdfa4c1c6c5e876cf98fca4986f9d247c35a9d6a`を作成一回・起動一回で使用した。元ID領収書をRoot内で保存・読戻しし、固定Image、停止状態、UID、pids64、RO root、security設定、exact六Mountと起動内容を照合して起動した。開始2026-10-29T14:10:37.646573039Z、終了14:10:39.298950616Z、attach0、Container exited／exit0／OOMKilled false／Restarting false／RestartCount0。非AI結果はcompleted／reason null、Host固定計算と空stdinのCLI生存・元子終了・資源数基準復帰がすべて確認された。

| 時点 | cgroup pids.current | CLI Thread数 | Host Thread数 | pids.events max |
| --- | ---: | ---: | ---: | ---: |
| 開始前 | 1 | 未起動 | 未起動 | 0 |
| CLI生存 | 36 | 35 | 未起動 | 0 |
| 両者生存 | 40 | 36 | 3 | 0 |
| 固定計算後 | 57 | 36 | 20 | 0 |
| 両者終了後 | 1 | 終了 | 終了 | 0 |

元CLI PID7はTask入力を一byteも受けず、空EOF後exit1＋既知の入力なしmarker、stdout0 byte／stderr30 byte。元Host PID44はhello／open／固定計算2／shutdown／EOF／exit0、stdout725 byte／stderr0 byte。生streamは保存せず、resource errorの既知語句観測false、childCloseConfirmed／resourceClosureConfirmed true。CLI自生成のSQLite・補助link等は空の試験Homeにだけ生成され、今回物として確認・回収する。取得した最大sample57は上限64の残り7を示すが、瞬間peakや実編集時の総量ではない。今回pids上限拒否がないことは、この独立二Process共存の範囲だけの結果であり、CLI→Host接続／Tool委譲・実AI故障の原因確定・上限変更の根拠とはしない。

Root Identity`1687905628:118500965196179391:1793282760398252300`は不変。回収前に全34 entry（通常File18・既知Linux symbolic link3・Directory13）の非link境界・通常File nlink1・bytes／Hash、既知link targetが同梱CLI exact Pathであることを確認した。inventory SHA-256 `32a774c9e5c2bb6b00451b5a79c0273f214cd75bd749cab04c8d4c8c07d21c23`。workとguardsは空の保護Directoryだけで、未知の編集成果はない。過去保持物は不変更。元ID・停止・構成を再照合して通常rmし、今回Rootだけを非再帰・通常削除する。

今回のContainerは元IDで通常rmし、一覧照会成功・該当0で不存在を確認した。回収前照合のPowerShell式が正常な`CapAdd=null`を配列1件と数えたため一度停止したが、読取りで追加Capabilityなしと確認し、当該式だけnull判定へ修正した。実Container設定・製品コード・上限は変更せず、再試験もしない。既知Linux link3件はreparse tag0xa000001dとexact target確認後にlink自身だけをFile.Deleteし、通常File18件と空Directory13件を通常・非再帰削除した。Root不存在を確認済みで、今回の物理残存は0。CLI自生成DBも回収し、生streamやDBの複製は残していない。Docker再起動・Image更新・過去保持物操作は行っていない。

人間からpids64自体の必要性を再質問された。今回の承認は上限不変更なので値は維持したが、独立CLI＋Hostの固定計算だけでsample57まで達することから、64の適正性は別途見直す必要がある。PID上限による資源枯渇防止の目的と、64という固定値の妥当性を分離し、制限を置くことだけを安全性・実用性の成立根拠にしない。現試験ではpids.events拒否0なので実AI失敗の原因を確定せず、設定変更の採用と追加実測は人間判断へ戻す。

#### Docker独自PID上限の撤廃 — 2026-10-29

人間は固定64を別の大きな値へ置換する案ではなく、CRDDによるProcess／Thread数制限そのものの撤廃を採用した。AI実行・助言・認証確認・login・Proxy・診断の全生成経路から`--pids-limit`を削除し、inspectの`PidsLimit`を構成成立・回収の必要条件から外した。`-1`の指定、新設定、自動算定、監視、回復機構は追加していない。Docker／Hostが独立して持つ既定値や資源制約は変更しておらず、全実環境で無制限になるという保証ではない。大量Process生成によるHost資源圧迫の残存リスクはある。

Image・実ID・名前・label、非root、RO root、capability削減、no-new-privileges、seccomp、Mount、通信、Init、取消・回収の条件は維持した。Proxyの固定包装は21／23引数へ、診断入力上限は固定包装171＋payload256＝427引数へ追従した。24構成の全argvへ旧PID指定だけを試験内で復元すると旧golden Hashと一致し、他の包装・payload変更がないことを確認する。過去Evidence・保持物・既存Containerは変更しない。

非AI回帰の初回で、Proxy位置指定・期待値の追従漏れと、既存Engine試験の`node:fs`模擬がDomain側のnamed importへ未追従であることを検出した。前者は短縮後の位置へ修正し、後者は同じ模擬objectをdefault／named両方へ渡した。実Filesystemへ迂回させず、試験の拒否・回収条件は変更していない。

最終確認はDocker Isolationのformat／型／lint成功（既存の情報通知2件、warning／errorなし）、通常回帰291件成功・失敗0・実境界2件skip。Executorのcheck・17件成功。Coordinator通常／実Docker試験用の型検査成功、関連4Suite（認証create・回復再入場・Host移行・Process Controller）129件成功。独立レビューの試験位置漏れ1件を修正・再確認し、残指摘0。`git diff --check`成功。実Docker・実AI・Image更新・過去保持物操作は今回実施していない。これらの非AI結果を過去のCode Mode故障の原因確定、Direct／Isolated編集E2E成功とは扱わない。

#### PID上限撤廃後の一回編集E2E：承認と事前確認 — 2026-10-29

固定Sourceは`f748c8da8cf4a9faabdd1f6a44feeca1e796df26`。人間は新品合成RepositoryでDirect→成功時だけIsolatedを各一Task、Codex `gpt-6.1-sol`／medium編集とClaude `claude-opus-5-5`／mediumレビュー、既存限定是正一回・再レビューまで全体最大八Provider段を承認した。送信は合成Context・source.txt・固定指示・差分だけ。Task全体再試行、Docker再起動、Image更新、過去保持物操作は含まない。失敗時は次方式を開始せず同ID取消・終了確認と今回物の安全な回収だけを行い、確認不能は同じ回復参照で保持する。通常送信同意は対話端末で人間が入力する。

Engine linux 29.8.1・稼働Container零・既存Codex／Claude／Proxy固定Digest三件の存在を読取り確認した。既存created認証Container一件・旧exited Container一件と四Networkは基準観測にだけ使用し、操作しない。独立Source照合は残指摘零。非AI三Suiteは制限環境でloopback応答前の通信失敗五件（33成功／38件）を検出したが、Source・期限を変えず通常のローカル通信権限で同じ38件が成功した。失敗を隠さず、前者を実AI故障又はPID撤廃故障と断定しない。

新品`C:\project\CRDD\.crdd\tests\workspace-ai-qsjifi`の`--preflight`は終了値零、両方式limitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、Directの既存dirty／stage／未追跡保全、Isolatedの候補固定・二親Merge・候補終了・Worktree／Branch回収が成立した。Docker前後差は追加／削除零・既存inventory保持・system構成一致、Source不変。両fixtureの回収Gateはeligibleで削除済み。引渡し用result.jsonと空親だけをFront AIの確認後清掃対象とする。実AIはこの事前確認に含まれない。

非AI引渡しJSONのSHA-256は`642cb90b819299423d0017458fdb2aea589f01eee6c1c98d8b881aa40bfe1abb`。exact Rootと通常Directory／File二entry、結果の両方式成功・回収Gate・Source不変を再照合し、このJSONと空親二Directoryだけを非再帰の通常削除で清掃した。`workspace-ai-qsjifi`の不存在を確認済み。

23:37 JSTに外部対話端末PID33576を起動し、通常の`--external-send-confirmed`一回を開始した。今回実AI専用Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-JDuqVH`。Sourceの起動引用符はEncodedCommand内で固定し、生出力の自動保存はしない。現在は人間の通常送信同意と実行終了待ちであり、成功・回収済みとは表示しない。

#### PID上限撤廃後の一回編集E2E：実結果と清掃判定の不整合 — 2026-10-29

人間申告は`E2E_EXIT=2`。再送はしていない。一方、元resultではDirect／IsolatedともlimitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、Task／execution completed、Claudeレビューapproved・finding零だった。各方式はCodex編集→Claudeレビューの二段だけ、全体四Provider起動で、限定是正は不要。Directは`DIRECT_OK\n`の10byteと既存dirty／stage／未追跡の保全を確認した。Isolatedは`ISOLATED_OK\n`の12byte、候補固定Commit `e1f3c70e93488cac512540d9ec906ef8ecd8b104`、二親Merge `72e6ec63e4aeb30184a1a366d8c196f8caaab43f`、候補終了・Worktree／Branch回収まで成功した。HTTP通信失敗なし、Header待機最大はDirect10000ms／Isolated13688msで、十五秒期限は変更していない。Source不変。

Direct Requestは`request-2b0656c9-7180-4710-add0-5570d513528f`、Isolatedは`request-89097feb-a8c6-47b2-b237-990a95bcf936`。四段ともProvider正常終了・Process Tree終了・Container／Network不存在・cleanup true。今回Docker資源の前後差は零で、既存created認証Container・旧exited Container・四Networkを変更していない。

終了値2の直接理由は両fixtureRemovalGateが`fixture_cleanup_unconfirmed`となったこと。公開Task Snapshotは成功時も`primaryFailure: coordinator_task_workspace_review_completed`を返し、試験Gateはnullを要求していた。`coordinator/src/task/requests.ts`のSnapshot構築が`primaryFailure: record ? record.reason : reason`として成功reasonを複写することを確認した。これをProvider故障、編集不成立又はDocker回収失敗とは扱わない。元報告の`fullE2eVerified:false`、削除失敗、終了値2は変更しない。正式入口の成功時primaryFailureと清掃試験の契約整合は未是正であり、次の最小修正候補とする。

通常File入口の既存Domain Readerで両Taskのsettled／completed・cleanup true・recoveryIds空と同Request履歴のcompleted／cleanup confirmed／primaryFailure nullを確認した。技術操作・未解決回復・配送待ち・Lease Intent・Workspaceは零。inline入口ではReader確認が不成立で、通常入口の初回は相対import誤りでEffect前に停止した。この診断上の失敗は製品故障へ読み替えない。

独立確認後、今回清掃だけのメモリ内投影として、元のreasonとprimaryFailureが同じ既知成功reasonであること、freshな同Request履歴がprimaryFailure nullであることを全件assertしたうえで、Task投影の当該fieldだけを正本から取り出した。元result.jsonは改変せず、既存assessFixtureRemoval本文・maintain／transfer・再読・Git／Lease／Root条件を省略せず再利用した。最初の別JavaScript実行領域での評価は配列prototype差で拒否され、同領域の未変更本文では両Gateがeligible／fixture_closed_and_unreferencedとなった。これを汎用例外・新しい回復機構・製品修正として追加していない。

元result SHA-256は`d8811a3e56fab154fa83d4f71f886ed224fe3aa846ae53530902fe0f3625a416`。今回Root全体は通常File74・Directory73、全File nlink1、symbolic linkなし、inventory SHA-256 `e381ff0125114beb89941bdac5553eb0c2d99f7e1aafcf677cb97f383e70abb3`。試験Nodeの終了とDocker基準復帰を再観測し、今回の合成Git・終了済み状態・非秘密結果・短命確認入口だけを清掃対象とする。過去保持物は対象外。編集成功と上限撤廃の時間的相関はあるが、この一回だけから旧故障の原因がPID64だったとは確定しない。

清掃時にexact絶対Root・全147entryの範囲・nonreparse・件数・元結果Hashを再確認した。ReadOnlyは今回合成Git objectの31Fileだけ、Hiddenは今回の空`.git`二Directoryだけと照合し、その属性だけを解除して通常File74件・空Directory73件を非再帰で個別回収した。`workspace-ai-JDuqVH`の不存在を確認済みで、今回の物理残存は零。ACL修復・force／再帰削除・AI再送・Docker再起動・Image更新・過去保持物操作はなし。元実行の終了値2と清掃判定の未是正事項は維持し、手動清掃を元試験の終了値0へ遡及しない。

#### 成功時primaryFailureの最小是正 — 2026-10-29

人間の継続指示により、`task/requests.ts`の公開view投影一箇所だけを変更した。公開statusと記録statusの両方がcompletedの場合だけprimaryFailure null、成功理由はreasonへ維持する。blocked／cancelled／unknown、記録欠測、公開側又は保存側の片側だけcompletedでは従来理由を保全する。回復参照・副次失敗・保存Schema・遷移・清掃Gate・HTTP期限に変更はない。新API・State・回復機構は追加しない。

PRL-UT-006へ製品view本文の境界行列を追加し、ERB-IT-021の本番Owner・実保存・HTTP子Client結合へ非null成功reasonと取消reasonの相関assertを追加した。初回の試験型検査で行列tupleの未確定要素型を検出し、値を変えずconst tupleへ追従後、両Package型検査、Workbench check、Coordinator変更Fileのformat／lint、局所二件が成功した。Workbench関連二Suite三十件とCoordinatorの公開契約・Owner境界・回復参照三Suite二十一件が成功。独立レビューは残指摘零。続く単発Taskの実保存回帰四件も成功し、自己生成Rootの不存在を確認した。差分検査も成功。AI再送・Docker照会／操作・過去保持物操作は行っていない。過去一回の終了値2を変更せず、今回の非AI確認を実AI終了値0の観測として扱わない。

#### 成功時primaryFailure是正後の同条件再確認：着手 — 2026-10-29／30

人間はcommit・push後の同条件再試験を明示した。修正と前回結果を`2fd35fb5ffa64f52667f7ff27fa96eedf8b6e5b5`でcommit・pushし、Sourceクリーンを確認した。前回と同じ新品合成Direct→成功時だけIsolated、Codex GPT-6.1 Sol／medium編集・Claude Opus 5.5／mediumレビュー、既存限定是正込み全体最大八段、一Task一回・失敗時再送なし、今回物のみ回収という範囲を維持する。Docker再起動・Image更新・過去保持物操作は行わない。

Engine linux29.8.1・稼働Container零と既存固定Image三件を読取り確認後、新品`C:\project\CRDD\.crdd\tests\workspace-ai-WLbiJV`で非AI事前確認を行った。終了値零、両方式limitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、両清掃Gate eligible・fixtureRootsRemoved true、Git候補固定・二親Merge・候補終了・Worktree／Branch回収、既存変更保全、Source不変、Docker前後差零を確認した。result SHA-256は`df3deaf195784c65a126fd3561d742c9779e13f3dcf61d7c0d01949fc6d6bffb`。

23:59:44 JSTに外部対話端末PID31980を起動し、承認済み実AI一回を通常`--external-send-confirmed`で開始した。今回専用Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-Uvd2mD`。通常送信確認は人間が端末内で行い、確認コードや生出力は自動保存しない。現在は実行終了待ちで、今回の結果・回収成立は未確定である。日付境界をまたいでも同じ一回として扱い、新たな再送枠を追加しない。

非AI事前確認の引渡しJSONは、exact Root・全三entry・nonreparse・上記Hash・両成功と清掃条件を再照合後、File一件と空親二Directoryだけを非再帰の通常削除で回収した。`workspace-ai-WLbiJV`の不存在を確認済み。

#### 是正後の同条件一回：HTTP期限による停止結果 — 2026-10-30

人間申告は`E2E_EXIT=2`。今回Requestは`request-9811ef06-a7a9-4c71-8df3-2ea9229b62cd`、操作相関は`operation-b2c94137-b879-4deb-9425-d246d27a7306`。DirectのCodex編集は一段正常終了、source.txtは`DIRECT_OK\n`となり、changedPathsは一件で一致した。既知Code Mode警告一件を観測したがCommandは一件開始・完了・exit0、技術一次失敗なし。ClaudeはContainer作成・Process開始前に取消され、レビューとIsolatedは未開始。Taskの再送はしていない。

停止はobserveのGET21でheaders_unobserved／timedOut trueの十五秒期限。Client開始1793286053485、要求生成3497、送出直前3501、Server受信1793286068242、応答終了8501、Client期限終了8503（同じ先頭時刻桁を省略）。送出直前からServer受信14741ms、受信から応答終了259ms、Owner照会17ms。Server event loopの最大停止はexpected1793286053429→observed1793286068241、14812msでこの要求区間と重なる。受信前待機と処理停止の相関は観測されたが、占有していた処理・同期I/O・CPU・OS待ちの原因は未確定。前回のprimaryFailure混入／最終清掃判定とは別の停止であり、今回成功終端へ到達していないため実AIで修正済み清掃Gateの通過は未確認。

同ID取消後はTask／execution cancelled、reason／primaryFailureは`single_task_cancelled_after_effect_cleanup`、cleanup true、回復参照・副次失敗は空、Client／Owner終了確認済み。Codex・未開始ReviewerともContainer／Network不存在とcleanup true。今回Container追加／削除は零、既存二Containerは不変更。標準bridgeはID `c9ba8af9270f77fcd2631e4676351b4ae984bb6151bfa34c9ebdfbc7978ff72b`から`5b1b08c0cbbc017830bef0cc72f669ffbc383ba52a991d4501218dd8e4ee28fa`へ変わったが、比較では標準構成同一・既存利用者資源保持だった。変更原因は未確定で、標準Networkを回収対象にしない。こちらからDocker再起動・Image更新は発行していない。Source不変、原result SHA-256は`dbbe262002d74b4c588024d4d4cd13c39cb3bae2031ec7514fc4d5f95db3f4e0`。

今回の通常File入口で既存Domain Readerを用い、同Requestのsettled／cancelled・Owner世代null・cleanup true・回復参照空、履歴cancelled／cleanup confirmed、Lease取得・解放の同一対、未解決技術区画零・結果零を確認した。Gitは元Base・共有indexのstaged.txt・既存dirty／未追跡・Sourceの合成一行を保持し、main一Branch・自己Worktree一件のみ。既存maintainは一件を正式退役、transferは記録零、再読で未解決義務・履歴待ち・Lease証拠零と元二Queueだけへの復帰を確認した。元結果と終了値2は改変せず、今回物だけの物理清掃へ進む。過去保持物は調査・変更していない。

今回Rootの全通常File36・Directory36、全File nlink1・linkなし、inventory SHA-256 `1b7fb4757eb97e634f1a9f362e304fd79790eee01171d0a28e861ac711310363`を確認し、元結果Hash・exact Root・祖先nonreparseを再照合した。今回Git object十四FileのReadOnlyと空`.git`一件のHiddenだけを解除し、通常Fileと空Directoryを非再帰で個別削除した。`workspace-ai-Uvd2mD`の不存在を確認済み。今回の物理残存は零。追加AI試験・製品修正は実施していない。

#### 実AI編集とHTTP表示の検証分離 — 2026-10-30

人間は実AI実行確認とWorkbench画面確認の混在を解消する方針を採用した。着手前の独立照合で、既存公開APIだけで成立すること、元Owner・現在認可・二十分試験期限・取消・元結果・Domain照合・既存清掃Gateを維持する条件を確認した。変更分類は検証経路の責務是正であり、製品のTask Lifecycle・保存Schema・HTTP契約・十五秒期限を変更しない。Source／契約の独立レビューと変更意味に対応した非AI結合回帰を実施し、準拠基準・リリース条件の変更や実AI再送を対象にしない。

`verify-workspace-ai.ts`はWorkbench Server起動、画面全体GET、HTTP Client生成と定期状態pollを撤去し、同じ`openTaskSession`のstart／wait／cancel／closeへ接続した。Workspaceは公開`executeWorkspace`へ従来のcommand順・現在認可を渡す。Task用AbortSignalをWorkspace操作へ流用しない。Timerは開始前に設置し全分岐で解除、期限時は同じRequestを一回取消して終了を待つ。新Worker・Queue・公開API・Registry・Stateは追加しない。Toolの既存物理配置を理由に製品Package依存や公開境界は変更しない。

wait結果は本文を永続化せず元Ownerから取得し、freshなDomain Readerで同Root・Project・Request・Principal・Task／Attempt／Operation ID、settled、status／reason／cleanup／回復参照、Owner解放・Lease Intent終端を照合する。照会不能・不一致は成功へ補完しない。Domainの本文欠測は実行状態の不明を意味せず、一時本文のために新Storeを作らない。既存の最終清掃Gate・Git／Workspace／Docker inventory照合は省略しない。HTTP表示・受付・取消・応答喪失の既存非AI試験は別に維持し、過去のHTTP受信前停止の原因究明・修復済みとは表示しない。

新しい試験専用子`workspace-package-preflight.ts`では、AI開始を固定拒否しDocker一覧だけを合成代役にして、正式Toolの両方式を実Git・Domain保存・候補固定・二親Merge・候補終了・Worktree／Branch回収まで通す。成功後はresult JSON一致、exact tests親・prefix・実体・唯一entry・nlinkを照合し、引渡しFileと空親だけをunlink／rmdirする。外部AI・実Docker・過去保持物操作は行わない。

初回の39件回帰はSource／Fixture追従の途中で行列一件が不整合となり38成功・1失敗、追従後の固定候補では39件成功した。これを最終修正後へ流用しない。独立レビューで「wait結果の保存前に取消結果待機が失敗すると元結果・回復参照を失う」Moderate一件と反例不足Minor一件を検出した。元waitを先に保持し、同ID取消結果が確認できたときだけ更新、取消例外／別IDでは元結果と固定副次失敗を保持する順序へ是正した。開始の通常拒否、Task／Operation不一致、期限取消の例外／別IDの反例を追加し、局所行列とWorkbench checkが成功、再レビュー残指摘零。最終修正後の固定候補で三Suite三十九件が全成功した。Package直結の両方式事前確認では実Git・Domain保存・Merge・回収と引渡し親の不存在を確認した。Workbench check、差分検査、独立再レビュー残指摘零。実AI・実Docker・過去保持物操作は実施しておらず、新経路での実AI編集の再成立やHTTP実故障の解消は未検証である。

#### HTTP分離後の一回実AI編集：承認と事前確認 — 2026-10-30

人間は新しいPackage直接経路の一回を承認した。合成Context・source.txt・固定指示・差分だけ、Codex `gpt-6.1-sol`／medium編集→Claude `claude-opus-5-5`／mediumレビュー、Direct→成功時だけIsolated各一Task、既存限定是正一回・再レビュー込み全体最大八Provider段を維持する。Task再送・Docker再起動・Image更新・過去保持物操作は含めない。基準Commitは`2fd35fb5ffa64f52667f7ff27fa96eedf8b6e5b5`、そこへ最終非AI回帰・独立レビュー済みの未Commit差分を加えた候補であり、基準Commit単体の実測とは表示しない。実行Tool SHA-256は`323f595dae4f330ad33bae6b320d7c8f637f87f232761f862c97232d157e0881`。

Engine linux29.8.1・稼働Container零・既存三固定Imageを読取り確認した。新品`C:\project\CRDD\.crdd\tests\workspace-ai-TvLDzU`の非AI事前確認は終了値零、両方式limitedProbePassed／runtimeClean／workspaceClean／closeConfirmed true、既存変更保全・候補固定・二親Merge・Worktree／Branch回収・両削除Gate・Source不変・Docker前後差零を確認した。HTTP Server起動・画面GET・pollは行っていない。引渡しJSON SHA-256は`a6e74aaca85d255280bf1e8187732ebd521b75ab061d474ca23fadfab57db06c`。

00:35:46 JSTに外部対話端末PID22988を起動し、通常`--external-send-confirmed`の一回を開始した。今回実AI専用Rootは`C:\project\CRDD\.crdd\tests\workspace-ai-hiBbKw`。通常送信同意は端末内で人間が行い、生出力・確認コードをFile／Logへ保存しない。実行終了・結果・今回物の回収は現在未確定である。

非AI事前確認の引渡しJSONと空親は、exact Root・全三entry・nonreparse・Hash・両方式の清掃条件を再照合後、File一件と空Directory二件だけを非再帰の通常削除で回収した。`workspace-ai-TvLDzU`の不存在を確認済み。

<a id="workspace-direct-api-real-ai-pass-20261030"></a>

#### HTTP分離後の一回実AI編集：両方式の限定合格 — 2026-10-30

人間申告は`E2E_EXIT=0`。元resultの確認でも両方式limitedProbePassed／stateVerified／runtimeClean／workspaceClean／closeConfirmed true、Task／execution completed、primaryFailure null、回復参照・副次失敗は空だった。成功理由はreasonに残り、前回のprimaryFailure混入による清掃拒否は今回発生していない。各方式はCodex編集→Claudeレビューの二段だけ、全体四Provider起動であり、Claudeはいずれもapproved・finding零、限定是正・Task再送は不要だった。

| 方式 | Request ID | 確認結果 |
| --- | --- | --- |
| Direct | `request-9b02e429-e41c-4840-bd8f-19329aa8881e` | `DIRECT_OK\n`の10byte／Hash一致、changedPaths一件、既存dirty／stage／未追跡保全、同RequestのDomain終端相関 |
| Isolated | `request-f07bcba8-6536-417a-b7c7-7bc694b5208d` | `ISOLATED_OK\n`の12byte／Hash一致、Domain終端相関、候補固定・Merge・候補終了・Workspace回収 |

Isolated候補Commitは`da7753609dadec2caecdf772f2e02f4ae72cf083`、Mergeは`33dce3de866946266a5585e747e4ca783c4c84be`。固定Toolの実行時assertで二親相関、Candidate／MergeのTree一致、Worktree／専用Ref不存在を検査してからlimitedProbePassedへ進む。これら細部を結果JSONの専用field単独から推測したのではなく、実行Source不変と当該Oracle成立へ結合した確認である。四Provider段の境界診断は、正常終了・Process Tree終了・Container／Network不存在・cleanup trueを全て確認した。既知Code Mode警告は両Codexで一件ずつ残るが、Command開始・完了・exit0と編集成立が観測され、故障件数へ読み替えない。

両fixtureRemovalGateはexact一件ずつeligible／fixture_closed_and_unreferenced、fixtureRootsRemoved true、cleanupFailures空。Source不変で、Tool Hashは着手時の`323f595dae4f330ad33bae6b320d7c8f637f87f232761f862c97232d157e0881`と一致した。今回Node Processの終了を再観測済み。Docker一覧は既存二Containerのみ、今回物は残っていない。標準bridgeのIDは`5b1b08c0cbbc017830bef0cc72f669ffbc383ba52a991d4501218dd8e4ee28fa`から`f725e643d2eaf00fc4968cc7e1036616178414f90a723985ed297d0a8a4a2f3d`へ変わり、既存利用者資源保全・system構成一致として分類された。raw inventory完全不変とは主張せず、原因未確定の標準Networkは操作しない。Docker再起動・Image更新・過去保持物操作は発行していない。

元result SHA-256は`f00cf580f625cb09647cdde83941c2248eaede5be53c09d78b658d9af4247bef`。独立の結果相関レビューは残指摘零。結果自身のfullE2eVerified falseを維持し、今回の主張は承認済みの直接API版一回で両方式の限定Task・保存・診断・回収が共同成立した範囲とする。Workbench HTTP故障の修復、全CRDD QA、一般的な再現性、全機能E2Eへ拡張しない。残る引渡しresult.jsonと空親だけを内容・Root確認後に回収する。

引渡しJSONは、両Task／Domain相関・清掃Gate・Source不変・元Hash・exact Root・祖先／全三entryのnonreparseと唯一Fileを再確認後、通常削除した。空editと自己Rootは非再帰rmdirで回収し、`workspace-ai-hiBbKw`の不存在を確認済み。今回の物理残存は零。既存Docker資源・標準Network・過去保持物は不変更。

#### Executor単独の構造整理と確認範囲 — 2026-10-30

基準Commitは`bd881667`。先行の直接API版検証整理はこのCommitへ保存済みであり、今回の依頼にpushは含めない。対象はExecutor内部の責務配置と非AI確認で、Workbench／MCP／Coordinatorの機能拡張・実AI再送・Docker操作・過去保持物の処置は対象外とする。

変更分類は内部Refactorと検証配置の移管。正本はExecutor詳細設計・QA-000006・既存Test Catalog／Symbol、直接利用側はExecutor内Controller／Plan／診断ToolとRoot型利用側である。着手前の独立照合で、結果契約・拒否理由・元WeakMap・一回使用・consumerのIdentity結合・検証Toolのimportとmock URLを維持する方針を確認した。文書の整合と横断影響をレビュー対象とし、準拠基準の変更・Release判断・外部通信がないため準拠監査と実境界再試験は今回追加しない。

| 対象 | 処置 | 保持する保証 |
|---|---|---|
| result/normalization.ts | task.ts／advice.tsへ分割し旧ファイルを撤去 | Taskの編集・レビュー意味、助言の許可参照、契約値・改訂・理由 |
| 結果の共有型 | result/types.tsへ移管。共通の成否形は内部型照合だけに利用 | Root公開名・推論型・返却field。Runtime値を追加しない |
| Controller内の助言Envelope変換 | advice.tsへ移管 | AI Adapterの共通parseProviderResult、診断と失敗順序 |
| 共通文字列・byte上限 | 既存validation.tsの内部公開へ集約 | 条件・上限不変。Rootへ公開しない |
| 限定是正証拠 | task.ts内の一つのWeakMapで発行・消費 | 原本一回だけ、コピー・別object・再使用は拒否 |
| attempt/plan.ts／consumer | 維持 | 実行計画とTask Graphを混同せず、回復Identityを変えない |
| Controller本体 | 単一生涯を維持 | 開始・取消・join・清掃を行数だけで分割しない |
| 結果検査UT | 純粋なTask全件とAdvice三件をExecutorへ移管 | 安定Test／Symbol ID維持。上位Packet結合は旧Ownerに残す |

公開責務別の正常・準正常・異常・終了後条件と試験の対応は[QA-000006](../../../07_Quality/Definitions/QA-000006/quality_definition.md#executor単独packageの確認範囲--2026-10-30)に集約した。新しい検証Registry・State・Lock・Runnerは作成しない。Result coverageの実行入口はExecutorへ置き、Coordinator側は自分のRuntime／Packet試験だけを保持する。

先行の独立レビュー二指摘は、Controller終端試験を専用ファイル・Catalog／Symbolへ分離し、移管した結果coverage入口をExecutorへ移すことで是正した。製品契約・Root API集合・元証拠に退行は検出されていない。結果型の追加整理を含む最終39件・型検査・整形・Lintと再レビューを完了し、今回の単独非AI確認範囲は完了、残指摘零と判定する。現在、人間による判断は必要ない。

| 実行済み確認 | 結果と範囲 |
|---|---|
| Executor通常確認 | 型移管後の最終39件成功、型検査・整形・Lint成功 |
| Result coverage入口 | 22件成功。coverage値はロードした他Packageも含むためPackage安全性の百分率としない |
| Coordinator Runtime／Packet coverage入口 | 168件成功 |
| 直接影響する助言／Task Packet四Suite | 30件成功 |
| Controller既存全体Suite | 通常Windows環境で115件成功。制限環境では実子孫終了確認二件が不成立だったため、期限・判定を変えず通常環境で確認 |
| Workbench診断搬送の既存Suite | 14件成功。新しいWorkbench機能の成立とはしない |
| Catalog／Symbol | 台帳420件valid、SymbolのRepository／Domain指摘零 |
| 型利用側 | Coordinator・Workbench・MCPの型検査成功。機能拡張や通信試験とは区別する |
| 今回変更した四文書 | 対象文書自身の指摘零。参照先へ拡張された検査は538診断を含み全体Passとはしない |
| 全体文書検査 | 履歴を含む全体は3,721診断で不合格。今回のSource成功を全CRDD文書合格へ拡張しない |

実AI・Dockerは実行せず、既存の対象版付き実試験結果を保持する。今回生成した合成試験物の処置は各既存試験の終了条件に従い、過去保持物は操作しない。既存の実境界結果や模擬試験から、任意のOS／Provider故障の完全網羅を主張しない。

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
