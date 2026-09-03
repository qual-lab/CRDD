# 変更トレース: Minimum AI-native Project Runtime

変更ID: `CHG-000057`
- 状態: `In Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-09-01
- 対象: v0.18 Single Task Runtimeを実行単位として再利用する、単一Project／単一RepositoryのMilestone運営Runtime
- 対象リリース: `v0.19.0`
- 変更分類: `additive`
- `migration_required`: `false`。v0.18.1のSingle Task入口は保持する。新しいProject Runtimeを選択して利用する場合だけ、その能力の採用条件と追加契約を確認する
- リリースレベル: `MINOR`

正本: [Discovery](../../01_Discovery/01_CRDD_Product_Discovery.md#v019-minimum-project-runtime)、[UX](../../02_UX/01_User_Experience.md#6-milestoneを委ねる利用体験)、[IA](../../03_IA/01_Information_Architecture.md#6-project-runtimeの情報階層)、[UI](../../04_UI/01_User_Interface.md#8-project-runtimeの状態表示)、[振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md#project-runtime-contract)、[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-reference-architecture)、[検証設計](../../07_Quality/03_Verification_Design.md#project-runtime-verification)

## 1. Triggerと人間の判断

v0.18.0で、公式Codex／Claude Code CLIをCoordinatorが仲介し、一つのTaskをExecutor、独立Reviewer、限定是正、候補、取消およびRecoveryまで高信頼に実行するRuntimeが成立した。v0.18.1では新規採用入口とRuntime実行Identityを是正し、clone／submoduleから同じSingle Task Runtimeを利用できる基準を公開した。一方、人間はObjective分解、Task順序、次Taskの開始、Project全体の進捗理解および統合結果の判断を引き続き担っていた。

人間の決定権限者は、v0.19を「一つのTaskを実行するRuntime」から「一つのMilestoneを理解し、必要なObjectiveとTaskを計画・実行・再計画・統合できるMinimum AI-native Project Runtime」へ進める変更として採用した。最大5はTask総数ではなく同時実行数の上限であり、常に5並列する目標ではない。

## 2. 確認したCurrent State

- v0.18.1 Single Task Runtimeは正式署名4経路、失敗・取消・Recovery、隔離候補、cleanupおよび採用形態E2Eを持つ実行単位として再利用できる。
- CRDDはProjectの意味、Roadmap、CHG、Progress、Decision、QualityおよびEvidenceを既存正本へ保持しており、新しいProject Management正本を作る必要はない。
- 限定分散、MCP等の協働接続面、照合費用および統合結果の評価はDiscoveryで候補として保持されていたが、v0.19への収載・実装許可は未成立だった。
- Coordinatorは一つのTask lifecycleを所有するが、Project／Milestone／Objective階層、Task Graph、Project State、部分再計画およびMilestone Integrationをまだ所有しない。

## 3. Change Intent

一つの明示Binding済みRepositoryを持つProjectについて、人間がMilestoneと受入条件を示した後、Parent CoordinatorがProject Contextを理解し、Objectiveと任意数のTaskへ計画し、Dependencyと競合に応じて最大5 Taskを並行実行し、進捗、再計画、人間判断および統合受入を管理できるようにする。

MCPはProject Runtimeへの薄い外部接続面として追加し、CLIと同じCoordinator Coreへ接続する。v0.19の公開面は`crdd.run_objective`と`crdd.submit_decision`に限定し、同じrequest identityの再送を切断後の最新状態取得へ用いる。選択ユーザーのOS principal、既存Milestone AuthorityおよびRuntime発行の一回限り・期限付き継続CapabilityをHuman Decisionへ結合する。Runtimeはraw値を保持せず、対象・主体・世代・改訂版・期限へ結合したhashと消費状態だけをRepository外のOS管理・Runtime保護Rootへ保存する。Repository外の保護RecordとRepository内Project Stateにまたがる原子性は仮定せず、decision application IDと適用前後のProject世代を保護Recordへ`prepared`として耐久化し、DecisionとMilestoneを一つのProject State世代へ適用・再読取りした後に`finalized`とする。再起動時は両側のID・世代・状態から再適用、未適用、finalizeまたはRecoveryを一意に選び、判定不能ならQueue、LeaseおよびTask Effectを発行しない。Queueは両側の一致と`finalized`を確認した後に一度だけLeaseする。無効入力は正規Capabilityを変更せず、応答喪失時の明示置換は旧hashを先に失効して新しい1件だけを発行する。MCP固有のProject Model、Authority、Repository直接操作または内部Task／Scheduler／再計画／統合の直接操作を作らない。`crdd.get_project_state`はv0.20以降の保留候補であり、本変更の完成条件へ含めない。

## 4. 保持する意図と変更禁止範囲

- v0.18 Single Task RuntimeのTrust、Authority、隔離候補、独立Review、取消、cleanupおよびRecoveryを弱めない。
- 個別Task Pass、Agent数、並列数またはProgress率をObjective／Milestone Acceptanceへ読み替えない。
- 子Task、Provider出力、MCP ClientまたはRepository内容からAuthority、Scope拡張、Risk受容またはMilestone Acceptanceを生成しない。
- Roadmap、CHGまたは新しいPM DatabaseをProject Runtimeの第二正本にしない。
- 人間が承認したMilestone Scope内の内部Task切替だけを理由に反復承認を要求しない。
- 対話作業とスケジュール実行を同じ正本Worktreeへ同時に書き込ませず、対話起点を優先しながら未開始要求を失わない。
- v0.19で複数Project、複数Repository、常設自律運転、Organization Runtimeまたは無制限Worker Poolへ拡張しない。

## 5. Objectiveと依存順

| Objective | 成立条件 | 主な依存 |
|---|---|---|
| Project Runtime Design | Discovery、UX、IA、UI、SPEC、Architecture、Verificationが同じ階層・状態・受入を定義し、状態・資源・Lock・Authority・Effectを実装予定ownerと検証へ接続 | なし |
| Coordinator Refactoring | Project責務とSingle Task責務を分離し、Platform Contractの内側へWindows固有実装を閉じ、既存Task契約を保持 | Design |
| Durable Project Foundation | Project State Store、耐久Operation Queue、Project Operation Lease、正本採用LeaseのSchema、原子的更新、世代、所有喪失、保持・回収を成立 | Design、Refactoring |
| MCP Thin Vertical Slice | MCP Objective IntakeからSingle Task Resultまで同じ意味契約で往復 | Design、Refactoring、Durable Foundationの必要最小部 |
| Project Model | Project／Milestone／Objective／TaskとProject Stateを表現 | Design |
| Task Graph／Scheduler | Dependency、競合、最大5並列、枠解放後の開始を制御 | Durable Foundation、Project Model、Single Task Unit |
| Progress Projection | 実状態からProgress、Quality、Blocker、Risk、Decision、Critical Pathを投影 | Project Model、Scheduler |
| Replanning／Escalation | Plan維持、部分再計画、人間判断を区別 | Project Model、Progress |
| Integration Verification | Cross-task整合とObjective／Milestone Acceptanceを確認 | 全実行Objective |
| Dogfooding／Utility | CRDD v0.19自身を管理し、Accepted Resultまでの総費用と品質を評価 | E2E成立 |
| Closure | 全検証、独立レビュー、必要監査、移行、Release候補を固定 | 全Objective |

Objectiveは同じMeaningful Changeの段階であり、工程Step、個別実装または監査Findingごとに新しいCHGを発行しない。独立して採否・移行・切戻し・リリースできる別意図が成立した場合だけ分離を再評価する。

## 6. 検証義務

正常、準正常、異常および判定不能を、Project入力から統合受入まで一続きで確認する。少なくともMCPの薄い縦断経路、任意Task数、最大5並列、5未満の選択、Dependency待ち、共有競合拒否、局所失敗、部分再計画、人間判断、Integration不成立、取消、Parent喪失、cleanup不明およびRecoveryを含める。

設計の状態・資源・Lock・Authority・Effectを実装所有者と試験へ接続し、個別試験数やcoverage率からProject lifecycleの成立を推定しない。CRDD v0.19自己適用では、Time to Accepted Result、Human Active Time、AI Processing Time、Queue Waiting、Integration Cost、Conflict、Retry、Remediation、Replanning、Human Escalation、Provider利用および後工程Findingを観測する。保証活動については、レビュー、独立レビュー、監査、再レビュー／再監査、検証時間、完了までの検証反復、根拠量、指摘事項および是正回数を、観測可能で判断に役立つ範囲で追加する。保証活動の削減自体を目標にせず、品質条件を維持した採用可能な結果までの総コストとして評価する。

## 7. Git／Release運用

本変更は`main`から作成した一つのfeatureブランチで、正本、実装、試験、移行、CHG、配布内容および必要なRelease manifestまで完成させる。署名対象が変わる場合のSource A、manifest carrier Bおよび最終Release Commit Cは[Coordinator Runtimeの作業手順](../../19_Workflows/01_Coordinator_Runtime.md#release-manifestの生成)に従い、同じfeatureブランチ内で固定・検証して一つのプルリクエストで`main`へ統合する。`develop`またはrelease専用ブランチを追加せず、統合後の`main`へmanifest更新だけの別プルリクエストを追加しない。

## 8. 現在状態と次のGate

本節の表だけが現在有効な状態と次のGateを示す。表より後の段落は実装・検証の発展を時系列で残す履歴であり、「この時点では」「当時」「その後」と明示した状態を現在値へ読み替えない。後続の観測や是正で過去の判断・失敗を上書きせず、後段は上表の根拠となる時系列履歴として読む。

| 区分 | 現在値 |
|---|---|
| 成立 | 設計対応、契約・結合試験、署名固定版の正常縦断2経路、うち1経路の正本採用、低Risk文書1件の自己適用と正本採用、認証主体の意味入口への伝播、Repository Binding単位の別Process排他、Lease取得後のfresh優先選択、Task Authorityの実行直前発行と未使用Authority失効、Task開始の`reserved / handoff_prepared / running`分離、Task別・種別別のexact Recovery相関、個別回復義務の耐久settlement、Queue／State／個別義務の途中中断から完了済みEffectを再発行しない再開、再計画上限と独立したfresh retry、終端request再送のEffect 0投影、親EOF取消、対話／スケジュール競合、Docker完了receiptによる冪等再入場を含む署名前の決定論的Project全体確認 |
| 未成立 | 認証済み公開MCP Clientからの実Provider経路、実Provider実行中の取消、および実Docker資源を用いたRecovery settlementの署名後最終E2E |
| 次Gate | 固定候補の独立確認・必要監査、指摘是正後のRuntime実行Identity固定と最終E2E、未評価事項のRelease処遇、収載・分類・移行・残存Riskの人間判断 |
| 根拠 | [正常縦断E2E](Evidence/CHG-000057_Project_Runtime_Real_Provider_E2E_d44ae1a.md)、[自己適用](Evidence/CHG-000057_Project_Runtime_Self_Application_0acc157.md)、[初回署名前検証](../../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Pre_Sign_Verification.md)、[確認済み回復の収束に関する署名前検証](../../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Acknowledgement_Closure_Pre_Sign_Verification.md)、[検証設計](../../07_Quality/03_Verification_Design.md#project-runtime-verification) |

工程正本を接続した後、Project Modelの最初の実装として、Task、Objective、Milestoneを別状態で保持する純粋な状態契約を追加した。Task完了後はObjectiveを`integration_pending`へ進めるだけとし、受入条件ごとのEvidenceを伴うObjective統合、全Objective受入後のMilestone統合を、それぞれ別の世代更新として固定した。Project State投影もWork Progress、Quality、Human Decision、RecoveryおよびNext Actionを分離し、Task完了や未観測値からProject成功を生成しない。

[Project状態契約試験](../../40_Develop/coordinator/tests/project-runtime-state.contract.test.ts)は、最大5件選択、Dependency、Path／Conflict、cleanup不明、Recovery、古い世代、Graph不正に加え、Task完了後の統合待ち、Objective／Milestoneの段階受入、Evidence不足、Recovery時の成功補正禁止を確認する。[MCP Adapter契約試験](../../40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts)は、薄い単一Task経路とAdapter固有Authority 0を維持する。

これはProject Runtime全体の完成、MCPの外部公開、v0.19.0 ReleaseまたはRisk受容を意味しない。この時点ではProject State Store、Project Operation lease、対話優先の耐久Operation Queue、正本採用Lease、Single Task Runtimeとの複数Task結合、部分再計画、Parent喪失、実成果物のIntegrationおよび公開入口E2Eが未接続だった。後続の部分接続を含む現在状態は本節末尾で追跡する。

実Provider E2E準備中、Docker create submissionの耐久化後・receipt前にProcessを失った既存Taskが、後発のDocker Desktop復旧後も安全に収束できないことを確認した。空のDocker一覧を未作成証明へ読み替える既存禁止は保持し、同じTaskより後に始まった検証済みDocker Desktop再起動、署名済み旧復旧履歴、現在のRuntime Authority、同じ選択ユーザー・保護Root・Policy、終了済み安全状態および対象資源の二軸不存在を結合する正式Recovery入口を追加した。旧署名は履歴由来の検証だけに限定し、現在の実行AuthorityやCapabilityへ昇格させない。これにより保護状態の手動削除や無期限停止を避けつつ、不明なcreate結果を任意の再起動だけで消去しない。

Project Runtimeの設計固定版では、[Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md)に9 Interface、9永続Record、13資源、4 Lock、7 Authority、9 Effect、7状態機械、52遷移、31不変条件および15失敗注入点を固定した。[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)は、各遷移をexactに一つの対応へ結び、その対応からLock・Authority・Effect・順序・検証を解決し、孤立、未知参照、未接続・重複接続、異質遷移の和集合化、Record時間関係の逆転、人間向け正本との双方向不一致および実在Pathとの差を決定論的に拒否する。人間判断では、Platform Adapter所有の保護Record `absent → issued`とreadback後のClient返却、`issued → prepared`、Decision／Milestoneの同一Project State世代への適用と再読取り、同Adapterによる`prepared → finalized`、および保護Rootのfreshな`finalized`観測後のQueue Leaseという順序を要求する。`prepared`後の失効にはProject旧世代・未適用のfresh確認を必須とする。Project側だけが不明なら別の検証済みRecovery Storeへexactな回復意図を先に残して保護RecordをRecoveryへ進め、保護Root自体が不明なら同Rootの遷移を捏造せず別Recovery Storeだけへ回復意図を残す。そこも不明なら手動回復・Effect不明・Process再利用禁止とする。Recoveryは回復意図、保護Root、Project Stateをfreshに結合し、matching newを`finalized`、verified old/unappliedを`invalidated`へ収束する。初回作成後のexactな`absent`＋raw未返却＋Project未適用、および期限更新後のexactな`expired`＋Project未適用はEffect 0で安全にsettleし、freshな`issued`はinvalidated、freshな`prepared`はrecovery_requiredから既存照合へ接続する。必要な継続Record更新のreadback後だけ回復意図をsettleし、不明・競合では回復意図をrequiredに保持する。OS管理保護Root、無効入力時の不変、応答喪失時の明示置換、二重発行、Capability lifecycle欠落も拒否する。設計固定版の時点では、既存のProject状態契約とMCP Adapterを`partial`、State Store、Queue、Project Adapter、Human Decision ControllerおよびPlatform Contractを`planned`として区別した。この固定版の設計完了をProject Runtimeの実装完了または公開完了へ読み替えない。

設計の独立Architecture／Securityレビュー、文書Scope／Gap／Impact確認および指摘是正は完了した。機械確認は52遷移／52対応、契約試験13/13、Coordinator全確認およびCRDD全体Checkerで成立し、独立再レビューは重大・中重大度の指摘0でPassした。後続の設計固定版は32不変条件と16失敗注入点を持つ。未評価範囲は、Project State Store、Queue、Platform Adapterの残る保証と本番Project経路への接続、Human Decision Controllerの実装、実OS保護Storeの障害注入および公開CLI／MCP E2Eである。

Coordinator／Platform責務分離の候補実装として、`IF-PLATFORM`のPlatform契約（境界母集団、Architectureが要求する保証母集団、実在する操作候補、fallback経路なし）、実在するWindows実装だけを結線するWindows Platform Adapter、および`IF-SINGLE-TASK`のSingle Task Adapter（attempt結合、固定Revision結合、取消転送、Effect前拒否とEffect不明の分離、閉結果正規化。Task要求スキーマの正本はv0.18 Runtimeが保持）を`IMPL-RESPONSIBILITY-SEPARATION-CANDIDATE`として接続した。初期候補では操作名の一致だけから境界全体を対応済みと判定していたため、レビューで保証の過大表示を検出した。修正後は、Principal／Provider Homeだけを現在の完成境界とし、Repository Root解決、子Process環境導出、Container Host回復状態観測およびRuntime Root保護観測は実装・試験済みの部分抽出として保持する。残る保証をすべて満たさない境界は、操作候補が存在してもEffect 0で停止する。Single Task Adapterについても、cleanup未確認、手動RecoveryまたはRecovery ID残存を`settled`へ補正していた結果写像と、Effect不明でも`completed`を保持できる成功表示をレビューで検出した。修正後は`effectState: unknown`へ閉じ、成功表示と競合する場合は固定理由の`blocked`へ単調化する回帰試験を追加した。Project Runtime CoreのPlatform非依存は、Core閉集合の推移的import走査とOS固有token禁止の契約試験で機械強制した。Platform契約候補の単体試験は成立したが、`PR-A-07`（Platform不明・Adapter不在・保証未成立のEffect 0）は`planned`のままである。ResolverとWindows Adapterはまだ本番Project Effect経路から呼ばれないため、実入口でのGate成立を主張しない。既存Single Task Runtime本体、既存契約および署名対象は変更していない。Effect前拒否母集団はv0.18実装の実throw経路との照合試験（うち1種は実誘発）で結合し、process poisoning系2種の実誘発は共有Runtime状態への汚染を避けるため「単一Taskの縦断接続」段階の着手前整合確認で再評価する。Platform非依存走査へのforward-slash Drive文字Pathの禁止追加は、誤検知の検証を伴って「耐久状態・Queue・Lease」段階の着手前整合確認で再評価する。Platform family観測の責務所在（現在はWindows Adapter所有で、win32以外を一律Identity不明として停止）は、Linux／macOS Adapterを追加する後続変更の着手前整合確認で再設計する（いずれも担当は当該段階の実装担当）。この候補接続をProject Adapter経路の完成、公開入口接続またはCLI／MCP E2Eの成立へ読み替えない。この段階で次に着手するとした対象は、Project State Store、耐久Operation Queue、Project Operation leaseおよび正本採用Leaseだった。未完成能力をRelease済みまたは破棄済みへ変更しない。

なお、Effect不明へ閉じる結果は`manualRecoveryRequired: true`も必須とし、cleanup未確認またはRecovery ID残存を自動回復済みとして扱わない。

耐久基盤の最初の候補として、Repository-local `.crdd/project-runtime/`にProject StateとOperation Queueを世代ごとの不変Recordとして保存するStore、およびProject Operationと正本採用を別々に直列化するLeaseを追加した。Recordは検証済みRepository Rootからだけ解決し、link境界を拒否し、完全Schema、filenameと世代、連続世代を照合したうえで、同一Filesystem上の一時file作成、flush、rename、exact readbackを行う。Project Stateはexpected generation不一致、Queueは同一requestの再送とidentity衝突を区別する。Queue ownerは呼出し側の文字列ではなく、Runtimeが発行し現在も同じRepository Binding／Project／Queueで有効と観測できる不透明なProject Operation Leaseからだけ導出する。正本採用LeaseはQueueではなくRepository BindingとProjectを共有範囲とする。判断待ち・Recovery待ちからの再開は一般更新関数へ含めず、専用の証跡付き経路が接続されるまで拒否する。短時間変更Lockと長時間Leaseは分離し、stale Lockを時刻だけで奪取しない。Lease解放前に回復Markerを耐久化し、Lock解放、解放証跡およびMarker除去までを確認できなければ、同じLease identityの再取得を止めて手動回復へ閉じる。

この候補の契約試験は、`PR-D-N-01`、`PR-D-Q-01`、`PR-D-A-01`として、正常な保存・再読取り、古い世代、破損またはhash再計算済みの不完全Record、Envelopeの閉Schema、filenameと世代の一致・連続性、一時／未知file残存、保存byte上限の境界、Queue全世代のProject／Queue identity結合、Queue再送、identity衝突、拒否時の世代不変、実Leaseとのowner結合、所有中Queueの全離脱経路、偽造・別Queue・解放済みLeaseの拒否、同一Projectに対する別Queueからの正本採用排他、二重取得、正常解放後の再取得、および解放証跡失敗後の回復Markerと再取得拒否を確認する。Record hashは偶発破損の検出であり、同じユーザーが意味上有効なRecordへ書き換えてhashも更新した場合の保護を主張しない。これは耐久基盤段階の部分成立であり、Single Task Effect前のattempt耐久化、Scheduler、対話Lane優先、Process owner喪失後Recovery、保護anchor、Integration、実際の正本採用または公開入口E2Eは未接続である。この段階で次に着手するとした対象は、単一Task縦断でState／Queue／Leaseと既存Single Task Adapterを結び、実Process喪失とRecoveryを含む終了後観測を成立させることだった。

単一Task縦断と複数Task制御の中核候補として、耐久QueueをProject Operation Leaseへ結び、各Taskの`starting`／`running`を世代付きStateへ保存して短時間変更Lockを解放した後、既存Single Task Adapterを呼ぶProject実行所有者を追加した。Single Task結果は閉じたSchema、attempt、Operation、非秘密のAuthority bindingおよびRepository Revisionへ照合し、正常完了だけをTask完了へ反映する。cleanup不明、手動Recovery、Recovery ID、観測不能またはIdentity不一致の結果はTaskとQueueを`recovery_required`へ進め、State上の容量と競合予約を解放しない。Task完了後のQueueは`integration_pending`で止まり、Objective／Milestoneの受入または正本採用を生成しない。同一Queueの再実行は最新の統合待ち状態を返し、新規Task Effectを出さない。Queueの終端結果とLease解放は二段階で耐久化し、Lock不存在、exactな解放証跡および回復Marker不存在をfreshに確認した後だけQueue ownerを消す。

独立再レビューでは、Lease取得後の一部異常returnが物理解放を通らないこと、Lease証跡のQueue／種別／filename結合、結果field間の相関、保存不能なRecovery IDおよびProcess再起動義務の伝播不足を検出した。是正後は取得後の全異常経路を共通終了処理へ集約し、Queueへの回復意図、物理解放、exact証跡によるowner settlementの順に収束させる。Queue観測不能でも解放証跡を残して後続Processからreconcile可能にする。Lease証跡はRepository Binding、Project、種別、Queue、owner generation／process、disposition、世代、exact filenameを一体で照合する。Task結果は`status`、Effect、cleanup、手動回復、Process再起動、Recovery IDの相関を検証し、矛盾または永続Stateが保存できないIDをRuntime所有の安全なRecovery Identityへ単調化する。Process再起動義務はProject結果まで保持し、同じProcessで後続Taskを開始しない。

修正後のGap再監査では、物理Lock作成後からLease返却／Queue owner結合前までの部分取得が、後続処理失敗またはProcess喪失時に回復座標を持たない可能性を検出した。取得処理はLease種別、元Queue、owner generation、Processおよび決定論的な回復IDを結ぶ取得中Markerを、同一Filesystemの一時file、flush、atomic rename、exact readbackで物理Lockより先に耐久化する順序へ変更した。物理Lock作成後は同じownerのLock所有Markerを残す。同期失敗は全資源のfreshな不存在を確認できた場合だけ巻戻し済みとし、不完全な一時file、不正Marker、所有不明Lockまたは観測不明では取得中Markerと決定論的な回復IDを保持して再取得を止める。

続く独立再レビューでは、解放Marker作成後・Queue owner結合前の停止と、Queue ownerを持たない正本採用Leaseが同じ取得回復へ接続されていないことを検出した。取得回復をLease種別共通のプロトコルへ分離し、正本採用の回復IdentityをRepository BindingとProjectへ固定した。別Process終了fixtureではProject Operationと正本採用の両方についてowner不存在、取得中Marker、Lock所有Marker、取得／解放／owner喪失証跡を相関検証し、全Marker・Lockのfreshな不存在後だけ再取得可能へ収束する。Project Operationの取得中MarkerはQueue回復世代のreadback後まで保持し、その直後の停止を再処理しても同じ回復世代を重複作成しない。不完全な一時file、不正Marker、既存LockまたはIdentity不一致は自動削除せず、exactな回復ID付きの手動回復へ閉じる。

最終文書／Gap再監査では、取得中Markerのwrite／flush／rename／readback自体が失敗した初回結果だけ、既に算出した回復IDを返さない契約差を検出した。是正後は、失敗直後にLock、解放Marker、取得中Marker、Lock所有Markerおよび取得一時fileの不存在をfreshに確認できた場合だけ巻戻し済みとし、残存または観測不能では初回から決定論的な回復IDを返す。atomic rename後のreadback失敗を故障注入し、Marker非削除、初回回復ID、後続回復および再取得可能状態までを一続きで確認した。

限定技術再レビューでは、不存在確認に用いたBoolean APIがアクセス拒否等の観測不能も不存在へ畳み得る点を検出した。不在確認を個別Pathの`lstat`が`ENOENT`を返した場合だけ成立する三値境界へ変更し、Marker readback失敗とPath観測拒否を同時に故障注入して、巻戻し済みへ縮退せず同じ回復IDを返し、Filesystemを変更しないことを確認した。

この再レビューで得た二つの一般化可能な原因を、Coordinator固有の注意事項には閉じず、CRDD共通規範へ還元した。第一に、不存在を安全条件とする観測は明示的な不存在と観測不能を分け、Boolean化された負の結果だけでは不存在を証明しない。第二に、Recovery Identityが決定論的に確定した後は、次回再入場だけでなく最初の失敗結果、耐久記録およびsettlementまで同じexact Identityを保持する。共通規範化の独立技術確認では、全公開利用側への無条件なIdentity保持が、未認証・未認可の利用側へ対象の存在やRecovery Authorityを漏らし得る境界不足を検出した。公開境界を補正した際の文書監査では、内部Identityの同一性を未定義の「回復系統」へ弱めた不整合を検出した。最終的に、内部では同じexact Recovery Identityを保持し、公開は認証・認可・情報分類上許可された利用側に限って、同じIdentityまたは同じ内部Identityへ決定論的かつ追跡可能に結合した非Authorityの回復参照を返す。境界外の利用側へ対象の存在、IdentityまたはRecovery Authorityを開示しない。これらを[エージェント](../../10_Agent.md#pre-execution-alignment-check)、[アーキテクチャ](../../27_Architecture.md#24-状態処理順序副作用)、[品質保証](../../16_Quality_Assurance.md#52-検証設計)および導入用AI入口へ接続し、故障注入で初回結果から再入場・settlementまでのexact Identityと、公開利用側の認可・可視性・参照結合を分けて確認する基準へ変更した。

同じ実行所有者は純粋Schedulerを耐久Stateへ接続し、最大5件の現在容量、Dependency、Pathの親子関係および意味競合を各wave前に再評価する。独立Task 7件では最初の5件が終了した後に残りを開始し、Dependencyと競合Taskは先行Taskの完了後まで開始しない。取消はSingle Task Adapterの既存signal経路へ渡し、開始前取消はEffect 0でQueue ownershipを解放する。実ProcessでLeaseを取得した後にownerを終了させるfixtureでは、Queue、Lease evidence、Lockおよび同じowner generationを照合し、別のPlatform観測がowner不存在を確定した場合だけQueueを`recovery_required`へ進めてLockを回収する。owner生存、不明またはIdentity不一致では奪取しない。

これは当該時点で単一Task／複数TaskのCore結合が部分成立したことを示す。その後、Windows Platform Adapterによるowner観測とCLIからの共通Objective入口、対話Lane優先、同一計画の再試行・部分再計画・人間判断移送、Task候補IDの耐久状態への受渡し、統合候補・Conflict停止・明示採用・Objective／Milestone受入の正常経路を接続した。再計画後の実行AuthorityはTask定義作成時に先行発行せず、実行直前に現在世代とretry回数へ結合したfresh capabilityとして生成する。公開入力、Planner結果およびTask実行集合は閉Schemaとしてsnapshotし、余剰field、getter、ProxyまたはScope拡張をProject Effect前に拒否する。公開Objective入口から失敗、再計画、fresh attempt、Task候補、統合、Milestone受入までの全体結合試験と、人間判断後の再開経路を追加した。

OS管理のHuman Decision保護Store、公開MCP stdio Process、および実Candidate Storeからの統合・明示採用を開発候補へ接続した。判断Storeはraw Capabilityを保存せず、Windows Runtime State保護Root上の不変世代列とkernel lockを使い、prepare後のProcess喪失ではProject Stateのapplication ID／世代／Milestone状態を再照合してfinalizedまたはinvalidatedへ収束する。この時点では判断Capabilityの置換、Project終端を含む全失効および独立Recovery Intentが未成立だった。その後、明示置換では旧hashの失効readback後だけ新Capabilityを発行し、stale／superseded／cancelled／Project終端／期限切れを専用失効へ接続した。保護RootまたはProject Stateの観測不能は別の検証済みRecovery Storeへexactな意図を先に耐久化し、freshな両側観測によってfinalized／invalidated／expiredまたは安全な不存在へ収束した後だけsettleする契約を実装・試験した。MCP Processは128 KiB以下のJSON Linesを逐次処理し、親EOF時に進行中Objectiveへ取消を通知する。Candidate Adapterはbase commit／tree／manifest、変更Pathおよび内容を照合し、明示された採用Authority下だけで適用し、途中失敗ではbackupからrollbackする。当該時点では、実Provider候補を用いる採用、認証済みMCP Client、切断・電源断を含む本番同等E2E、実Clientを含む全Recovery settlement、自己適用および独立した完成確認は未成立だった。当該時点の次Gateは、到達可能な署名固定版で既存Docker Recoveryを正式に収束させ、本番同等E2Eと自己適用を実行することだった。

固定開発版の実Provider E2Eでは、Single Task Runtimeが検証済み署名配布のCandidate Storeへ保存した候補を、現在SourceのProject Runtimeが別の未署名Storeから読もうとして統合前に停止する構成差を検出した。公開Runtimeの統合Adapterを構成点へ引き上げ、productionは自身の署名済みStoreを固定し、固定開発版だけは検証済み署名配布のStore操作を明示注入するよう是正した。現在SourceはProject実行制御だけを所有し、この注入からRelease Authorityを取得しない。公開Runtime構成の結合試験でTask候補が同じStore境界を通ってMilestone受入へ到達することを確認した。また、実Providerの安全な停止を一般的な再計画結果へ畳まず、Provider出力を含まない閉じたTask結果要約を同じE2E記録へ追加した。当該時点では、是正後の実Provider候補採用は再実測待ちであり、成立済みへ先行更新しなかった。

同じE2Eの再試行では、固定開発版のSource／Native／Repository Identityと利用上限を確認した後に、実際の外部送信許可とは別の6桁確認を毎回要求していた。これは開発Sessionの利用制限とProvider送信Authorityを一つの操作に重ね、初期設定後は同じ永続境界の送信許可を再利用する既存UXと矛盾していた。開発Session固有の対話確認を除去し、固定Identity、期限、2 Task、最大8 CLI呼出しおよびRelease Authority 0を機械的な利用可否判定として保持した。実Providerへの各送信は引き続き通常の初期外部送信許可だけを通り、許可なし、境界変更、失効、取消または観測不能ではProvider Effect前に確認または停止する。これにより再試行時の人間入力を減らすが、固定開発版から外部送信AuthorityまたはRelease Authorityを生成しない。

保留中の実Provider E2Eを再開する過程で、v0.18.1のDocker Task Recoveryは検証済みDesktop再起動Fenceを受け取るHelpと下位実装を持ちながら、公開引数Parserが必要な2引数を受理せず到達不能だったことを確認した。現行実装ではHelp、Parser、Dispatcherの同じ閉じた文法へ接続済みである。さらに、Docker Desktop修復履歴の引継ぎが新manifest配置だけを読み、正式なv0.18旧Release Rootを拒否して全inventoryを不明にする構成差を検出した。履歴用loaderは新旧配置のexact一方だけを受理し、併存・欠落・不正を拒否するよう是正した。署名前プレチェックでは、修復履歴の引継ぎだけが共通loaderへ接続され、再起動Fence付きDocker Task Recovery本体は旧配置専用loaderを直接使用している伝播漏れを検出した。両producerを同じ共通loaderへ統一し、公開三引数がRecovery処理へ到達する結合試験と、全producerの接続検査を追加した。旧manifestは署名済み履歴の検証だけに用い、現在のRuntime AuthorityやEffectを発行しない。公開済みv0.18.1配布自体は変更できないため、既存Recoveryを安全に解除した実Provider再実測は、到達可能な署名固定版の作成後まで未成立として保持する。

到達可能な署名固定版で既存Recoveryを正式に収束させた後の実Provider E2Eでは、Claude Executor／Codex Reviewer経路が候補保存、統合、正本採用およびMilestone受入まで成立した。一方、Codex Executor／Claude Reviewer経路は、Claude Codeが作業量から指定した`--max-turns`を超えるturn数を成功Envelopeへ報告し、結果受理時に停止した。cleanupは確認され、候補・Recovery残存はなかった。調査により、Providerへ指定する実行目標とRuntimeが結果を受理する絶対上限を同一値にしていた契約誤りを確認した。作業量由来の指定値、絶対受理上限、Runtime所有のtimeout／出力量／Process停止を分離し、指定値超過を上限遵守へ読み替えない契約へ変更した。固定fixtureで指定値以下、指定値超過かつ絶対上限以下、絶対上限超過、上限到達エラーおよび不正turn数を検証する。受理したClaude段階では、指定値、報告値、絶対上限および指定値超過の有無だけを非Authority観測としてcleanup後のTask結果と実測記録へ保持し、不正値またはcleanup未確認時は公開しない。

署名固定版Source A `8cb1383`、Manifest carrier Source B `d44ae1a`による[実Provider E2E](Evidence/CHG-000057_Project_Runtime_Real_Provider_E2E_d44ae1a.md)では、Codex Executor／Claude ReviewerとClaude Executor／Codex Reviewerの両経路が、MCP Objective受付、Single Task実行、独立Review、候補保存、統合およびMilestone受入まで完了した。明示採用を要求した後者だけで正本採用Receiptを確認した。全Taskでcleanupを確認し、手動Recovery、Process再起動義務およびRecovery残存はなかった。問題となったClaude Reviewerは指定目標6 turnに対して10 turnを報告したが、絶対受理上限16以内として成功結果を受理し、指定目標超過を非Authority観測として結果へ保持した。Claude Executorは指定目標8 turnに対して4 turnだった。これにより両Provider方向のProject Runtime正常縦断経路と今回のturn契約是正は実測済みとなった。ただし、2件の固定単一Path Taskであり、任意Task、全Provider組合せ、取消・Recovery全組合せ、長期安定性、有用性比較、v0.19全体完成またはReleaseを意味しない。

[自己適用](Evidence/CHG-000057_Project_Runtime_Self_Application_0acc157.md)では、CRDD自身の品質状態更新を一つのMilestoneとしてClaude Code ExecutorとCodex独立Reviewerへ委譲し、指定した1ファイルだけの変更、Milestone受入および正本採用まで126.528秒で完了した。開始後の人間入力、再試行、再計画および手動Recoveryはなく、cleanupも確認した。これにより、低Riskの単一文書更新について、人間がAgent間のContextを運搬せずAccepted Resultへ到達する限定的な実務利用は成立した。比較Baseline、人間の実作業時間、AI処理時間およびProvider利用量は未測定であり、速度・費用・品質・Provider分散の総合的な優位は未確定とする。次のGateは、Project全体の結合確認に残る代表経路を実行し、未評価事項のRelease処遇を整理した固定候補へ独立確認と必要監査を一括して、v0.19の収載・移行・Release判断材料を確定することである。

Project全体の結合確認では、対話Operationが実Provider処理中になった後に同じProjectへスケジュール要求を到着させたところ、後着要求が二つ目のQueue ownerを取得して`running`へ進み、共有Project Stateに実行可能TaskがないことをRecoveryへ誤分類した。既存試験は対話・スケジュールの両要求を未開始状態で同時に並べる順序だけを確認しており、「先行要求が`leased / running`になった後の後着」という時間順を覆っていなかった。Queue優先順位を未所有要求間の選択だけへ限定し、実行中Ownerが存在する間は二つ目のOperation Leaseを発行せず、後着スケジュール要求を`waiting_foreground`へ耐久化するよう是正した。Queue単体と公開Objective受付の両層で、後着要求のProvider Effect 0、cleanup確認済み、手動Recovery不要、および先行Taskだけが一度実行されることを確認した。本番同等の公開Process構成による再実測は、新しい署名固定版を作る前の独立プレチェック後に行い、成立前はPR-Q-05を部分確認のまま保持する。

固定候補前の独立技術確認では、後着Queueの時間順是正だけでは排他の原子性、Recoveryの通常再入場、MCP認証主体の意味入口への伝播、Task Authorityの有効期間、およびstdio終了結果のcleanup意味保持が不足していることを検出した。局所例外ではなく、Project Operation LeaseをRepository Binding単位のOS排他へ変更し、別Process同時起動でもexactに一つだけが所有する試験を追加した。v0.19は同じBinding内を直列化し、Project間並列を提供済みとしない。

RecoveryはClient指定IDを受ける別経路を作らず、同じObjective requestの再入場時に耐久Queueのexact Recovery IDを発行Runtimeへ渡す。回復完了後に専用Queue settlementを先に耐久化し、同じProject State世代で旧attemptをfresh retryへ置換する。settlement直後に中断してもRecovery Effectを再発行せず、State更新から再開できる。Identity不一致、資源残存、観測不能または再試行上限到達では通常実行へ戻らない。契約試験では初回のRecovery保持、再入場、exact ID、fresh attempt、2回目のTask完了および残存Recovery 0までを確認した。実Docker資源を伴う公開Process E2Eは署名固定候補後のGateとして残す。

Task AuthorityはTask Graph作成時にまとめて発行せず、各attemptの予約を耐久化した後、外部Effect直前に一回限りのfresh Authorityとして発行する。7 Taskを2 waveで実行する試験は7個の異なるAuthorityを確認し、開始前取消は発行0を確認する。MCP AdapterはRuntimeが検証したprincipal identityをObjective／Decisionの共通意味入口まで渡し、request identityへ結合する。stdio transportは自身の終了処理が成功しても、意味結果のcleanup不明または手動回復要を成功へ畳まない。

Project全体E2E前の固定候補技術確認では、選択とQueue claimの間の優先順位競合、QueueとProject Stateの別々の耐久更新中断、Parent喪失時のTaskとDocker Recoveryの相関、再計画上限0でのRecovery停止、終端request再送、およびTask Authority発行直後の取消に未閉包の境界を検出した。最初の是正では、Repository Binding単位Lease取得後のfreshなQueue再選択、Project Operation IDによるDocker Recovery相関、単一Recovery IDのsettlement、および未使用Authority失効を接続した。その後の独立確認で、複数Recovery IDの欠落、種別を失った誤った回復処理、個別settlementの再実行、Effect開始前後を区別しない`running`表示、Authority失効不明後のProcess再利用、公開結果への回復情報伝播不足を検出した。現在の候補は、TaskごとにHost／Docker／Candidate／Candidate Storeの型付き回復義務と`required / recovering / settled`を耐久化し、全義務がsettleした後だけfresh retryへ進める。未知・不一致なIDから合成Recovery Identityを作らず、回復対象未解決・Process再利用禁止へ閉じる。Task開始は`reserved → handoff_prepared → running`をEffect境界に合わせ、Parent喪失時はreservedをEffect 0へ戻し、preparedはexact一致または明示的な不存在、runningはexact一致だけを採用する。Authority失効不明はProcessをpoisonし、Project結果へ再起動義務と全回復情報を保持する。Queue／State／個別義務の途中更新後も、耐久段階から未完了Effectだけを再開する。これらは契約・Process内結合の成立であり、残る公開Process E2Eの成立へ読み替えない。

署名前の固定候補監査では、MCP公開結果の最上位だけを閉じても入れ子のProjection／判断／Recoveryへ未知fieldやdescriptorが残り得ること、`waiting_foreground`から中間の`queued`を経ずLeaseできる実装差、Docker回復完了Receiptを消費せず有限上限へ蓄積すること、および一般のProcess再起動要求が型付きRuntime Process回復義務へ正規化されないことを検出した。是正後は、MCPの各操作をexact contractと再帰的に閉じたdescriptor-safe DTOへ写像し、別操作のfield、Proxy、accessorおよび相関矛盾を公開前に拒否する。Queueは設計どおり`waiting_foreground → queued → leased`だけを許可する。Docker完了ReceiptはProject Stateへexact義務のsettlementをreadbackした後に確認済みとして除去し、除去前の中断は同じReceiptからDocker Effect 0で再開する。Runtime Process回復IDはParent RuntimeだけがProcess Instance、attemptおよびOperationへ結合して発行し、下位Adapterの自己申告、別bindingまたは改変IDを採用しない。一般のProcess再起動要求も同じ型付き義務とProcess poisonへ単調化する。いずれも局所例外ではなく、設計不変条件、実装所有者、公開利用側および正常・準正常・異常試験へ一括して接続した。

同じ固定候補の監査集合を完走した結果、MCPの閉じた形だけでは、外側のProject／Milestoneと内側Projection、cleanupと手動Recovery、Effect不明とProcess再起動義務の意味相関を保証できないことを追加検出した。さらに、Docker完了ReceiptをIDだけで除去できるproduction入口、別Taskの`runtime_process`義務の再利用、およびEffect開始後のthrow・不正結果を開始前失敗と同じ再計画へ戻せる経路が残っていた。是正後は、MCPの操作別DTOについて相関不変条件を双方向に検証し、Docker Receiptの除去を同じRepository Binding、Project、Milestone、世代、Task、attempt、Operationへ結合したfreshなProject State settlementだけに限定した。IDだけの確認入口はproduction facadeから除去した。`runtime_process`義務は発行時のTask attemptとOperationへ結合し、別Taskでの再利用を拒否する。Effect開始前失敗はEffect 0の再計画、Effect開始後のthrow・不正結果・binding差はProcess poison、再起動要求およびParent発行の型付き義務へ分離した。

全体試験では、長大な制限Process試験と実Windows子孫Process終了試験を同じ長期Processへ連続混在させると、後者7件だけがOS終了観測の既定猶予を超え、同じ7件の隔離実行では成立する環境干渉を確認した。既存の検証設計が所有していた二つの試験環境を既定`npm test`へ接続し、Windows実資源Gateを先に7件、その後に残る制限Process母集団1,552件の順で実行するよう固定した。失敗除外、猶予延長または母集団削減ではなく、全1,559件の意味を二つの適切な実行環境へ分けて維持する。

Project全体E2Eへ進む直前の固定候補監査では、Docker完了ReceiptをTombstoneへ置換しただけでは、同じTombstoneの再入場、作成・除去の片側中断、有限上限の終了、およびProject側が何を確認済みとしたかを再構成できず、回復を重ねると正常な利用でも上限へ到達することを検出した。また、MCPの公開Projectionはfield間相関を確認していても、状態機械上到達不能なMilestone／件数の組合せや、外側Objective結果と内側の受入・取消・人間判断・回復状態の矛盾を拒否しきれていなかった。

是正後のDocker経路は、完了Receiptと資源不存在、Project義務の`settled`、exact Tombstone作成、Receipt除去、Project義務の`acknowledged`、Tombstone除去、Queue settlement、fresh retryを別々の耐久境界として固定した。Projectの確認情報はRepository Binding、Project、Milestone、Task、attempt、Operation、settlement世代、Runtime Rootの4 hash、およびReceipt committed pairのhash／identityを持つ。Runtime State上の作成・再入場・除去・件数判定は同じkernel lockで直列化し、committed pairの作成・削除中断は同じ内容・同じ対象だけをjournalから再開する。Project側の確認済みreadback後は一時Tombstoneを必ず回収する。64件のTombstoneが存在する境界では65件目のReceiptを保持して停止し、exactな1件を回収した後だけ65件目を再開できることを確認した。回収済みTombstoneに旧Receiptを物理的に再投入した場合も既処理成功へ畳まず、Receipt pairを変更しない。さらに、旧attempt／Operationと現在Project bindingの不一致を同じ物理Receiptが存在する状態で検証し、Runtime側の削除処理0、Project State／Queue／Receipt pair不変を確認した。production facadeはReceipt identityを不透明なfile identityとして検証し、Project側の拡張確認情報から内部回収契約のexactな3項目だけを再構成する。Queue settlement済みの再入場でも未完了のProject acknowledgementと確認資源回収を省略しない。MCPはdescriptor-safeな入れ子snapshot後、Objective別Task状態集計を用いて到達可能なMilestone／件数と外側Objective結果の相関を検証し、全体件数だけが一致する反証例をProvider／Task／正本Effect 0で拒否する。部分再計画は依存されていない失敗Taskだけを置換し、`superseded`履歴を含む終端進捗からObjective／Milestone受入まで到達する。生存する依存Taskがある場合は依存を暗黙に付け替えない。これらは設計正本、機械可読な状態・資源・不変条件、および利用側試験へ伝播した。実Docker資源を伴う公開Process E2Eと認証済みMCP Clientの実測は、この技術候補を固定して独立再監査した後のGateとして残す。

[確認済み回復の収束に関する署名前検証](../../07_Quality/Verification_Results/2026-09-03_Project_Runtime_Acknowledgement_Closure_Pre_Sign_Verification.md)では、技術候補`3125d9d`について制限Process試験1,561件、Windows実資源Gate 7件、関連試験165件、descriptor-safe境界1件および設計追跡13件がすべて成功した。Windows実資源GateはSandboxのProcess制御制限下で成立しなかった結果も保持し、Native Process権限での7/7を実OS資源の根拠とした。過去の署名前検証は記録時点のblobへ復元し、今回の結果を別Evidenceとして追加した。この結果は決定論的な技術候補の成立であり、残る実Provider・実Docker・認証済みMCP ClientのE2Eを代替しない。

## 9. 設計確定からリリース判断までの実行計画

次の段階は依存順で進める。内部Taskへ分割できるが、後段の成功を前段の完了根拠へ流用しない。各段階の実装開始前に、対象Interface、保持する意図、変更禁止範囲、正常・準正常・異常、受入条件および検証方法をTask Packetへ固定する。

| 段階 | 変更内容 | 段階の完了条件 |
|---|---|---|
| Project Runtime設計の確定 | Project Runtime Core、Single Task Adapter、State Store、Queue／Lease、Scheduler、Integration、CLI／MCPの責務とInterfaceを確定。永続Schema、原子的更新、Lock順序、再計画、受入Evidence、脅威と失敗注入点を設計対応へ接続 | DiscoveryからVerificationまでの意味一致、機械可読な状態・資源・遷移・不変条件・検証対応、Checker、Architecture／Securityレビュー、文書／影響確認が成立 |
| Coordinator／Platform責務分離 | 既存Single Task Runtimeの契約を維持し、Project Runtimeから呼べるAdapterを抽出。Platform Contractを置き、Project Runtime CoreからWindows固有moduleへの直接依存を禁止 | 既存Single Task試験と署名対象の意味回帰0、Project Runtime CoreのPlatform非依存、Windows Adapter経由で同じ保証を再現 |
| 耐久状態・Queue・Lease | Project State Store、Operation Queue、Project Operation Lease、正本採用Leaseを実装 | durable-before-effect、世代付き原子的更新、重複Effect 0、owner喪失・破損・観測不能のFail Closed、回収条件を契約試験で確認 |
| 単一Taskの縦断接続 | CLI／MCP Objective IntakeからTask exact 1件を既存Runtimeへ渡し、Project Stateへ結果を反映 | CLIとMCPの意味一致、Adapter固有Authority 0、再送の冪等性、切断後cleanup、公開入口の正常・異常結合が成立 |
| 複数Taskの制御 | Task Graph、Dependency、競合予約、容量最大5、枠解放後開始を接続 | 1～5並列、5超の待機、Dependency、共有競合、古いReady、cleanup不明、6件目Effect 0を結合試験で確認 |
| 進捗・再計画・人間判断 | Project State Projection、計画維持、部分再計画、人間判断移送を接続 | Work ProgressとQualityを分離し、`superseded`と後継、再計画上限、Scope外停止、判断表示を確認 |
| 統合・採用候補 | Objective／Milestone Integration、Integration workspace、正本採用Leaseを接続 | 個別Passから成功を生成せず、受入Evidence、Cross-task conflict、Revision再確認、候補の採用・破棄・cleanupを確認 |
| Project全体の結合確認 | CLI／MCP、取消、Parent喪失、Recovery、対話／スケジュール競合を本番同等入口で確認 | 検証設計のPR-N／Q／H／A／I母集団、終了後資源、入力搬送、人間表示を固定改訂版で確認 |
| 自己適用・有用性評価 | CRDD v0.19の限定MilestoneをProject Runtimeで運営 | Accepted Resultまでの時間、人間の実作業時間、Queue、Integration、再計画、Provider分散、保証コスト、品質を未測定値と分けて記録 |
| リリース判断の準備 | 指摘是正、移行、配布、Release候補を固定 | 全Checker、独立レビュー、必要監査、影響を受ける署名・E2E、変更トレース、品質状態、移行および人間のRelease判断材料が揃う |

現在のCoordinatorはSingle Task Runtimeであるため、後続実装を一つの巨大Taskとして委譲しない。確定した設計境界ごとに実装Taskを作り、各Taskの候補を独立確認した後、段階単位の結合結果へ統合する。ExecutorまたはReviewerのProvider選択はCoordinator Policyに従い、本計画の設計意味を特定Providerへ結合しない。

## 10. Linux／macOS対応を見据えた今回の境界

Linux／macOS Runtimeの実装、配布、認証、回復および実Provider E2Eはv0.19の対象外とする。一方、Coordinator／Platform責務分離では、Project Runtime Coreへ新しいWindows固有依存を持ち込まず、現在実在するOS依存を[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-platform-boundary)のPlatform Contractへ閉じる。MCPはTransport AdapterとしてPlatform Contractと直交させ、stdio／HTTP等の搬送方式や対象OSが変わってもProject Model、Authority、状態遷移および成功条件を変えない。

v0.19で成立させるのは、Windows Adapterが現在の保証を保持し、将来Linux／macOS Adapterを追加してもProject Model、Authority、Task Graph、Integrationまたは受入意味を変更しない境界までである。各OSのUser／Filesystem保護、Process、Container、Lock、ConsoleおよびRecoveryは、実在する利用条件と同等保証の検証計画を伴う後続変更として判断する。未実装Adapter、空の互換層、OS名だけの抽象化または保証を弱めたfallbackを追加しない。
