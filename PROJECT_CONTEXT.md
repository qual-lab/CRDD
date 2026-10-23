# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は判断しない。
> 詳細・判断理由は各Owner Artifactを参照し、履歴を本文へ蓄積しない。

## 1. 今どうなっているか

### 結論

現在は、利用者の四添付に基づく[Coordinator公開操作・認証・AI選択の再設計](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md)を進行中。Objective六Sourceへの分配と本番`public-*`撤去を行い、受入判断・人間判断・照会を既存Ownerへ統合した。公開217項目と保存契約は維持。Objective連続回帰64件、短回帰29件、公開受付10件、移管後の境界24件、利用側閉包16件と静的・限定独立確認は成功／残指摘0。Workspace・品質受入を含む後続結合は実行中であり、全体完了ではない。次は技術カタログとRepository別選択を本番接続してから正式Task APIを確定し、旧Storeを新APIへ一時露出させる二度変更を避ける。旧形式Readerは追加せず移行はフロントAIが担当する。正式API／CLI・共通認証・新設定の全体切替は未完了。②のAI再試行と保持物操作は行わない。

Coordinator構造再設計の残る配置を56 Sourceへ一括移管し、今回のSource・利用側・試験・設計／登録追従を限定完了とした。公開Root217項目と保存B六Fileの本文は維持する。固定本番Sourceの全体回帰は1,854件中1,830成功・19失敗・5skipで完走。19失敗はすべて試験側の旧配置前提へ対応付け、修正版の対象Suiteを275件・13件・47件・21件で全成功まで確認した。最初の全体Commandを成功へ読み替えない。静的検査、Windows保存、直接利用側、限定独立レビューは成功／残指摘0。[最終結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#3822-残るsource配置の一括移管と最終確認)を参照する。横断QAと実境界E2Eは別途残り、実AI②・保持物・実Docker・認証は今回の対象外。

Coordinator構造整理の先行単位では、承認済みの本番未接続Trust評価と旧terminal codec／caller保存候補を廃止した。旧4 Source・専用試験3本、登録・設定と設計／QAを追従し、直接利用側24件と共通排他・回復・保存・履歴96件が成功、限定独立確認の残指摘0。Native共通処理・通常回復・保存統合Bを維持する。独立Trustの上流意図は代替未接続のまま残し、廃止を品質成立へ換算しない。[対象と確認範囲](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#3812-限定廃止の確認結果--2026-10-23)を参照する。

保存統合Bは、実装・旧試験の移行・固定版回帰の範囲を完了した。Task・Queue・Workspaceを共通Ownerと単一物理Writerへ接続し、履歴も同じRoot・保持設定へ切り替えた。旧ACK専用API・内部枝・二段リレーと旧設定Reader・配布例・Schemaを撤去した。固定通常回帰は1,862成功・失敗0・5skip、Workbench／MCP共通入口一件とWindows保存影響三十件も成功した。実AI・実DockerのE2Eと全体QAの完成ではない。次候補は利用者提示のCoordinator構造再設計であり、今回の保存契約を凍結基準にする。[確認結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#375-保存統合bの最終確認)を参照する。

②の実AI編集E2Eの今回試験は、利用者判断で終了したが、回収は未完了である。認証確認用Containerの作成結果unknown、同じ回復参照と試験物を保持する。停止Containerだけが遅れて残る可能性は今回に限り許容されているが、E2EのPass・回収完了・一般回復条件の緩和ではない。AI再試行は行わない。詳細と再評価条件は[今回試験の終了判断](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-edit-trial-ended-unresolved)を参照する。

固定Commit `d4edcd1e`後の追従是正では、検証Tool3 Suiteの接続、Test Header全数Gate、現行文書43診断の是正に続き、確定誤検知236件を検査側で解消した。生診断は1,836→1,600、追加0。Checker全386件は385成功／既知1失敗（残1,600診断）で完走した。文書診断は現行0、歴史CHG旧参照3,353による全体不合格を維持する。Browser接続1場面も元失敗の原因未確定のまま。②のAI再試行・保持物削除は行わず、保持3 Hashと安全条件は不変。[今回の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)を正本とし、[先行の分類・文書是正](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure)と[是正前の固定版結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression)を区別する。

v0.22のCHG-000082は進行中。Docker Isolationは`a04ecb70`でコミット・プッシュ済み。Direct／Candidateは共通のDocker方針を採用し、開発用`.env`がCoding AIから読まれ得るリスクを受容した。本番SecretはGit・通常開発環境へ置かず既存管理を使い、開発資格は本番権限なし・限定権限・期限ありとする。独自Secret Manager・file別ACL・動的Mount許可Frameworkは追加しない。固定Pathの最小Mount試験は二構成で成功し、通常Source書込みとGit／内部状態への書込み拒否を確認した。全link経路・任意Repository・製品実装全体の保証ではない。Coordinatorの借用実行は実装・結合試験と独立再レビューまで完了（限定範囲）。実Provider E2E・実データ移行は未実施。統合・タグ・リリースは含めない。条件と限界は[接続結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#借用実行接続の実装結合確認の区切り)を参照する。

Version ControlのWorktree管理に続き、名前付きCandidateの明示固定・別採用・二親MergeとOrchestratorの既存保存・排他への内部接続を実装した。選択外のCommit／Stage混入を避け、失敗後も同じ候補で再入場し、採否確定後の不要Refを回収する。新しい管理台帳・Lock・一般Recoveryは追加しない。公開Surface・本番Direct／Candidate切替はSource接続と限定検証を完了し、旧Bundle／Store本体・専用Native処理を撤去した。新構成全体の実境界評価と実データ移行は未完了。filter設定・gitlinkを含む作成は未対応として拒否し、部分試験を新Workspace全体の完成へ換算しない。現在の結果と限界は[採用・Git統合の実装結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#採用git統合のsource接続と実git確認)を参照する。

| 対象 | 現在の状態 | Owner Relation |
|---|---|---|
| 統合前の追加構造整理 | 旧Coordinatorの六単位と判断入口に続き、活動Reader四Fileと保存Bindingを状態照会へ移管し、C前の小Folder整理を限定完了（現Source82／70）。Orchestrator通常129件・利用側74件成功、Storage七Fileは不変、独立レビュー指摘0。残す型契約等は用途又は保存凍結の理由を記録。次はCの入口・Package統合、保存の最終評価は別単位。既存OPEN・横断検査3失敗とWorkbench既存lint二件・全体QA未完了を維持する。②の再試行・保持物操作は行わない | [活動照会とBindingの移管結果](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#27-活動照会と保存bindingの配置整理) |
| Cの統合・名称切替と保存再編 | Task／ObjectiveとExecutionをCoordinatorへ統合し、通信・構成・診断名と設計配置を切り替えた。保存統合Bの単一Writer・共通Owner・原子受領・履歴接続、旧ACK専用枝撤去と試験移行を完了。固定通常回帰1,862成功・失敗0・5skip、共通公開入口一件・Windows保存影響三十件も成功。C全体・実境界E2E・全体QAの完成とは区別し、過去CHGの文書不合格と②の保持物は維持する | [Bの確認結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#375-保存統合bの最終確認)、[単一保存Lifecycle](06_Architecture/Details/coordinator/04_Task_Detailed_Design.md#unified-storage-lifecycle) |
| C前のCLI責務整理 | CLIを受付・引数・回復表示・取消の四Fileへ限定し、診断・版判定・同意端末を既存責務へ移管。通常全回帰1,717成功・失敗0・5 skip、局所120件・端末18件・直接利用側の試験と静的検査は成功、独立レビュー残指摘0で限定完了。関連Dynamic Fake coverageの連続二回出力不一致と既存命名検査3件は別件として維持し、全体QAのPassとはしない。C統合・②再試行・保持物操作は未実施 | [CLI整理の結果と計測課題](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#231-cli整理の確認結果と残る計測課題) |
| 残る実行系の再編 | 元観測の照合、Task入力と助言を分離し、Source83 File・公開API・利用側のC前対応表を確定。残す三Fileの循環と二Stateの保証単位を明確化。局所221件・Windows正常Owner結合1件成功、Source／文書の独立レビュー残指摘0。失敗合成試験Rootは清掃済み。Orchestrator回帰129件成功。Coordinator全回帰は1,714成功・追従漏れ1失敗・5 skipで完走し、責務分類二行の是正後に該当4件成功。C前を限定完了として直前で停止。C本体・D・実境界・全体QAは未実施で、②の再試行・保持物操作なし | [C前の処置と検証結果](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#22-c直前までの残存整理) |
| Docker Isolationの構造・追加通信先 | 配置・設定・同意・Workbench・Proxy接続と旧定義整理、限定実通信・回帰・独立レビューを確認。DNS上限不足を是正した固定Imageでnpm／pip取得、未許可・直接通信拒否、取得後待機取消・今回資源回収が成功。広回帰の追従漏れ1件は是正後再確認済み。製品全体E2E・Releaseとは区別し、既存②と先行2Rootのunknownは別に保持する | [対応表・集約結果・保持参照](99_Roadmap/Changes/CHG-000082/docker-isolation-source-structure.md) |
| Platform Accessの構造・Native接続再編 | ①〜⑤の移管・配置・公開API整理は完了。Host記録・Desktop補助子の技術処理をPAへ移し、上位の許可・回復判断は維持。PA88件・DI293件・Rust55件等の通常回帰、静的検査、台帳378件valid、限定独立レビュー残指摘0。明示Docker試験・配布更新・外部AI E2Eは対象外。全体文書検査の既存不合格は未解消 | [対応表・結果と残る検証境界](99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md#11-①⑤の最終照合) |
| WorkbenchのFramework・構造移行 | Express／Router／Query、画面分割・共有契約・全Client TSXの通常検査を接続。対象1〜5は最終通常78件・全Browser15件・表示検証・静的確認と限定独立再レビュー指摘0で完了。先行Browser失敗はreload応答境界まで特定して試験観測を是正したが、CDP内部原因の完全特定とは扱わない。実AI・実Hostの人間確認・全体QA・Releaseは別途 | [現在の結果と限界](99_Roadmap/Changes/CHG-000082/workbench-framework-structure.md#14-query画面分割共有配置と通常検査) |
| MCP ServerのSDK・構造移行 | stdio／HTTPを公式SDKへ接続し、全Toolを責務別配置へ移管。旧Router・Protocol重複公開を撤去。本番入口と現在認証は同じ要求別Factoryへ接続。是正後全100試験・公式Client両Transport往復・独立再レビュー指摘0。modern規格に限定し、実Provider・全体QA・Releaseは別途 | [対象四項目の結果と限界](99_Roadmap/Changes/CHG-000082/mcp-server-sdk-structure.md) |
| 検査・検証Packageの再編 | 工程・共通文書意味をDomainへ移し、旧Profile・中継を撤去。CheckerをCLI／Repository観測／診断表示へ整理した。公開三操作・三型と診断・観測順を維持。Domain249成功、Checker440成功／既存横断命名1失敗／手動1未実施。型・静的・台帳370 valid、独立再レビュー残指摘0。今回の再編と全体QA不合格（横断命名1,411、文書3,426診断）は区別する。②AI再試行・保持物削除・Docker操作は行っていない | [六項目の結果と限界](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#checker-refactor-closure) |
| AI AdapterのSource整備 | 命名・公開APIに加え、両ProviderのDocker配置・固定実行物情報をDIへ分離。利用側回帰・限定独立レビュー残指摘0。実AI・実Docker・正式全E2Eと他Packageの整備は別に残る | [配置との境界](06_Architecture/Details/ai-adapter/01_Architecture.md#docker配置とprovider操作の分離--2026-10-19)、[区切りと検証範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review) |
| Workspace／Orchestrator | ③の本番Workspace接続・旧Bundle／Store本体と専用Nativeの撤去、検証Toolの取消・終了確認移管を完了。変更範囲の実Git・結合回帰と限定独立レビューは完了した。新構成全体の回帰・実境界・移行の最終評価、②の実AI編集E2Eは残る | [撤去の区切りと現在残件](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-store-retirement) |
| Access Management／公開入口 | 責務別配置・公開API整理に加え、ユーザー有効状態の独立APIを接続。現在は鍵の有無から導出し、確認不能を無効と区別する。回帰・限定独立レビュー完了。保存Schema・権限分担は維持。MCPのロール更新Tool名は変更済み。初回設定・鍵操作の実入口と人間確認は後続E2Eへ保持する | [現在の構造・公開API](06_Architecture/Details/access-management/01_Architecture.md#source構造の再編--2026-10-19)、[区切りと検証範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review) |
| Docker Isolationの基準能力 | 旧Docker責務分離単位の実装・検証結果を保持する。技術的な実行・観測・取消・回収を分離し、状態保存・操作前後のOwner確認・結果受領は上位に保持。今回の再配置・追加Allowlist・未知残存の回収成功へ旧結果を流用しない。実境界の成立と限界は隔離設計の対象条件を参照 | [現在の計画・検証結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md) |
| 通常実行の署名依存 | Coordinator専用の署名入口・Manifest設定・固定AST graphと、Domainの旧署名専用profileを撤去。通常保存の失敗反証と旧入力拒否を確認し、限定独立レビューの残指摘0。汎用成果物署名・必要Artifact同一性・現在認可・隔離は維持する | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)、[保存設計](06_Architecture/Details/domain-model/03_Repository_Storage.md) |
| 検証 | 確定誤検知236件を検査側で是正し、生診断は1,836→1,600（追加0）。局所・QA Header全数3/3、関係16/16・静的確認成功。Checker全386件は385成功／既知1失敗（残1,600診断）で完走。Browser元原因未確定・正式QA未評価は維持する | [236件の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)、[分類・Browser調査](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-browser-triage) |

試験件数は実行範囲の結果であり、QA検証項目のPass数・実Docker／Providerの成功・Release可能を意味しない。

## 2. 何が危ない、または止まっているか

全体完成を阻むのは未処置の差分と未観測境界である。局所成功から全体の成立を推定しない。

| 残件 | 影響・処置 | Owner Relation |
|---|---|---|
| 回帰 | 3 Suite分類・Test Header・現行文書の限定是正、型・静的・関連回帰と独立確認は完了。Checkerの既存Source命名・責務Header未達、Browser元失敗・原因未確定、未実施Host境界・正式198項目評価・合成7領域清掃は分離して保持する | [現在の確認と残件](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure) |
| 文書・工程の全体検査 | 最新Repository Checkerは現行0・歴史CHG旧参照3,353診断で全体Exit 1。現行43診断を是正したが、正式QA・実境界・全体完成の代替ではない。歴史Evidenceの一括改名やPass化は行わない | [検査の範囲と限界](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure) |
| 整理後の実境界接続 | 上位接続の限定整理は確認済み。自動破棄保存前の中断から明示保持し、同じstateで新Taskへ接続する限定Caseと同File全16件が成功。新しい共有State・Registry・Lock・Recovery Frameworkは追加しない | [隔離設計](06_Architecture/Details/docker-isolation/01_Architecture.md)、[保存設計](06_Architecture/Details/domain-model/03_Repository_Storage.md) |
| 実境界 | 実Docker五資源・未起動認証構成・fresh回収・認証create不明の限定終了・公式Imageの版／三Hash／隔離を確認。009はWSL保守後に同ID正式終了。030は実Ctrl+Cとreviewer準備中の親喪失を元IDの回収・待ち0まで確認。Windows自動削除・汎用WSL fallback・executor実行中の親喪失・実Provider全E2Eは主張しない | [検証計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)、[実行手順](19_Workflows/01_Coordinator_Runtime.md) |
| 限定終了の実試験 | 診断付き新品一回が成功。Docker再起動1回、認証create結果不明の限定Classで不存在2回・終了保存・正式回収・履歴・操作除去・専用Root不存在を確認。以前の起動未確認Failと原因未確定は保持し、汎用unknown終了やDI全体完成へ換算しない | [実測と清掃記録](99_Roadmap/Changes/CHG-000082/second-stage-plan.md) |
| 全体評価・収束 | DIの基準範囲完成照合は保持。補助Unit追加後の現在199項目の正式再評価・全体Checker不合格・後続E2Eは残る。未実施・不明・部分成立をPassへ畳まない | [Quality Center](07_Quality/01_Quality_Center.md)、[Reality Audit](07_Quality/05_Current_Implementation_Reality_Audit.md) |

## 3. 今、人間が決めることは何か

Checker整理では、利用者が未使用の汎用Outcome Adapter・専用結果型・旧ITの撤去と、QAの本番接続への具体化を承認した。Domain四状態の直接検査と、本番の診断・拒否・公開終了値を区別して確認する。現在追加の人間判断は必要ない。旧ITの結果を新しい本番保証へ流用しない。[採用と確認範囲](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#検査検証packageの縮小--2026-10-19の途中見直し)を参照する。

今回の退避物はWSL限定保守と同ID正式終了まで確認済み。公開Taskの実Ctrl+C、reviewer準備中のCLI親喪失とも、元IDで資源回収・履歴・正式Readerの待ち0まで確認した。親喪失をexecutor実行中の成立へ拡張しない。再認証の技術構築・旧Docker環境profile・試験結合漏れを是正し、DIの完成条件へ現在の回帰・実測・独立レビューを照合した。一般Recovery拡張・追加再起動・記録手編集はしない。承認済みのClaude単独一回は終了・回収まで成功し、その実境界確認について追加の人間判断は必要ない。

| 対象 | 現在の判断・許可境界 |
|---|---|
| Docker隔離と簡素化 | 使い捨てと最小管理へ簡素化する方針は承認済み |
| 実境界の評価 | 009と030の今回の観測を正式義務へ限定接続する。未観測の全異常枝や全Provider経路のPassへ拡張しない。追加の故意破損・Provider依頼・再起動は予定しない |
| 実Docker再起動・外部AIへの新しい依頼 | 今回は発行していない。固定版の回帰失敗を先に処置し、②の送信範囲・回数・停止条件は別途確認する。保持中unknownの成功化・強制清掃・自動再送は行わない。[現在の結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression) |
| 初回設定・鍵操作の実入口と人間UAT | 後続E2Eで確認する |
| 最終統合・版・期限・リリース | 今回の局所結果から決定しない |

判断の正本は[CHG](99_Roadmap/Changes/CHG-000082/change.md)と[第二段階計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)。実行許可・採用・Release判断を区別する。

## 4. なぜこの状態・判断になったか

既存能力を新しい責務へ移し、過剰な署名・配布コピー・回復管理を減らしている。Docker隔離そのものは維持する。

| 方針 | 理由 | Owner Relation |
|---|---|---|
| 技術処理はDocker Isolationへ、Task保存・通知・受領は上位へ | 下位がCoordinator／Orchestratorを知る逆依存を避け、利用側の保存方式をDocker cleanup条件にしない | [Coordinator設計](06_Architecture/Details/coordinator/01_Architecture.md)、[Coordinator Task詳細設計](06_Architecture/Details/coordinator/04_Task_Detailed_Design.md) |
| 旧署名資格を別の資格へ置き換えない | Commit／Hashは追跡・同一性確認であり、実行許可やPublisher真正性ではない。現在の認可と隔離を各Ownerで確認する | [通常実行と配布の分離](06_Architecture/Details/coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離) |
| Project Contextは現在投影だけにする | 詳細の第二正本や進捗書庫を作らず、人間・AI・MCP・Workbenchが同じ現在像を短時間で読めるようにする | [要求](01_Discovery/Definitions/REQ-000038/requirement.md) |

過去の経過・判断・検証条件は既存CHGとGit履歴から追跡する。現在文書へ経過を追記し続けたり、新しい履歴書庫へ複製したりしない。

## 5. 次に何をすべきか

全17Packageの構造整理では、AI Adapterの助言・試験専用API整理とInit判定のDI移管を`b2e568ba`までコミット・プッシュ済み。利用者の添付方針に合わせてProvider共通契約中心のAfter候補を計画へ記録し、観測と環境変数の検査を`provider/validation.ts`へ同居した。関連86件・静的確認・独立レビューを完了し、判定条件と通常保存は維持する。[順序・After候補・現在結果](99_Roadmap/Changes/CHG-000082/second-stage-plan.md#source-structure-review)を参照する。全体のFolder／File整理と名称・Header・公開集合の最終確認は残り、Package完成ではない。以下の回帰・実境界残件も保持し、②のAI再試行と保持物削除は行わない。

| 順序 | 次の作業候補 | 完了条件・停止点 |
|---|---|---|
| 1 | 固定版で再現した不整合の局所是正 | 新検証Toolの境界・Consumer、旧前提の試験・台帳・現行説明を接続し、未確定のWindows／Browser事象を区別する。②再試行・保持物削除なし |
| 2 | 是正後の候補を固定し再検証 | 同じ安全条件・検証義務を維持し、③の局所成立と全体評価を区別する |
| 3 | ②の限定実AI編集E2Eを再計画 | 送信内容・回数・停止条件を提示し、別途人間承認を得てから実行する |
| 4 | 実境界・移行結果を③とv0.22の最終評価へ接続 | 保持中unknownを成功へ書き換えず、採用・Release判断を別にする |

詳細な対象・順序・反証・担当は[第二段階計画](99_Roadmap/Changes/CHG-000082/second-stage-plan.md)と[Workspace棚卸し](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md)に従う。v0.22全体の後続候補は[Roadmap](99_Roadmap/01_Roadmap.md)で確認する。

## Checklist

- [x] Project ID、Repository IDおよびRepository Roleを評価した。
- [x] 三つのIdentityがRepository Manifestと一致している。
- [x] 五場面を省略せず、結論を先に示した。
- [x] 現在事実と共有分析を区別した。
- [x] 正本が存在する内容をOwner Relationへ接続した。
- [x] Project Context固有の安定IDを追加していない。
- [x] 項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。
- [x] 確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。
- [x] Owner Artifactとの競合時はProject Contextを現在値として使わない。
- [x] 保存済みの次候補と対話時の追加提案を区別できる。
- [x] Gateを閉じる前に再投影要否を評価する。
