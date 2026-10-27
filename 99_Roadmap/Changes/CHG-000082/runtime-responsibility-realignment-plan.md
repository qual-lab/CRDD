# 基盤機能中心のRuntime責務再編計画

- 対象: CRDD v0.22 / CHG-000082
- 状態: 調査・段階計画。目標方針の入力を受領済み、詳細契約・Source移管は未完了。
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
- `.crdd/domain-model/`は保存先第一候補であり、今回確定・移行済みとは表示しない。旧新競合、中断、現在Owner、未解決Recovery、履歴・pendingの整合、有効化、旧領域退役を別Gateで確認する。今回の保持領域を調査・試験に使わない。
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
