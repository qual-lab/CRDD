# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は判断しない。
> 詳細・判断理由は各Owner Artifactを参照し、履歴を本文へ蓄積しない。

## 1. 今どうなっているか

### 結論

承認された検証Tool限定の是正として、HTTP子Processへの入力をstdin終端待ちからNode標準IPCの一件搬送へ変更した。HTTP15/60秒・親20/65秒・終了確認・Task Ownerは維持し、対象回帰25件、型・整形・lintと独立レビューを完了した。親を22秒停止する反例でも正式ClientのHTTP完了と子終了を確認した。実AI再送・Docker操作・保持物操作は行っていない。元実AIの親占有処理・Provider非0との因果・以前の15秒HTTP故障は未確定で、実AI E2E成功とは扱わない。[是正と非AI検証](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#verification-client-ipc-implementation)を参照する。

承認された計測付きClaude Opus 5.5／medium読取りを固定Source `b114c08f`・同じ合成Contextで一回実行した。GET13件は約0.57〜0.95秒だったが、最後はHTTP15秒故障ではなく、検証用Client子Processの親側20秒監視で停止した。Taskはprovider_process_exit_nonzero、取消結果・資源回収・終了は確認済み。親側callback処理に最大約8.3秒の観測遅延があり、元のGET15秒故障、最後の要求の停止境界、Provider非0との因果は未確定。再送・編集E2E・Docker再起動・既存保持物操作なし。今回Rootと短命四File・tmp directoryは安全条件を再確認して清掃・不存在確認済み。兄弟の非秘密結果JSONだけ期限付き保全する。[今回の実測と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-observation-timing-once)を参照する。

新Model読取りを固定Source `59cd8ec3`で各一回実行した。Codex `gpt-6.1-sol`／mediumは成功。Claude `claude-opus-5-5`／mediumはTask・実行completed、cleanup確認済みだが、状態観測のHTTP headers未観測Timeoutにより検証全体は不合格。再送せず、Direct／Isolated編集E2Eは未実施のまま停止した。保持中の採用済みCandidateは既存APIで終了・Workspace破棄し、未解決義務ゼロの試験領域9件を確認後削除した。Isolated2領域の履歴確定待ち各1件と、正式回復がresource_unconfirmedで停止した旧unknown領域は2026-11-01までの再評価対象として保持する。Docker再起動・強制削除なし。[今回の結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#new-model-ai-once-results-20261025)を参照する。

検証Toolのexact `/workspace/action` 全操作だけ60秒／親65秒へ是正し、AI受付・取消とAI状態観測を含むWorkbench viewは15秒／親20秒を維持した。型・静的確認、対象十八件回帰、新品合成Repositoryの非AI Direct／Isolated事前確認が成功した。固定・二親Merge・Candidate終了・Worktree／Ref回収まで成立し、当該adopt応答は約27秒。製品Source・Lock機構は変更していない。先行のLock失敗はinline起動引数のWorker継承によるもので、診断・回収は通常File起動とする。当該非AI事前確認では実AI0回、再送・Docker再起動なし。今回の成功を旧試験の成功・回収へ遡及しない。[原因・限定是正・確認結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#new-model-ai-e2e-approval-20261025)を参照する。

Repository Manifestの旧Capability宣言を統合先の`coordinator`、現名称の`mcp-server`／`domain-model`へ追従した。公式Codex CLI 0.164.0とClaude Code 2.1.310の新Image・技術Catalogを固定し、`.crdd/config/ai-selection.json`はCodex `gpt-6.1-sol`／medium、独立ReviewerだけClaude `claude-opus-5-5`／mediumを指定する。公開Readerと五役割の選定、非AIの起動・合成隔離・試験物回収と対象回帰は確認済み。現在は両新Modelの読取りTask／実行completedを各一回観測したが、Claude検証全体は状態観測Timeoutで不合格。Host RPC・編集E2Eは未確認。旧Modelへの暗黙fallbackはない。[設定とImage更新の結果・限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#provider-image-update-20261025)を参照する。

先行の旧Model条件で承認されたDirect／Isolated編集E2Eは、実AI前の正式非AI事前確認で停止した。Directの合成変更・既存Dirty／Stage／未追跡保全は成功したが、IsolatedのWorkspace準備でHTTP応答未観測の15秒Timeoutとなった。作成自体は同UUIDの状態・Gitで成立を確認し、当該試験での再試行・AI送信は行っていない。先行試験のWorktree・専用Branchは既存公開discardで回収済み。終了要約一件の履歴確定は保存Owner取得不成立で止まったため、先行試験の合成Rootは2026-11-01まで保全する。編集E2Eは未実施のままである。[先行試験の失敗と回収状態](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#workspace-edit-preflight-timeout-result)を参照する。

修正版`1861c09aa`で同条件のClaude読取りを承認どおり一回実行し、Task／実行ともcompleted、HTTP故障・Timeoutなし、cleanupConfirmed trueとなった。既存停止Container以外のContainerや試験Networkは終了後一覧に残らず、本体・合成入力・選択設定は不変。今回はlimitedProbePassed trueであり、実AI編集・全体E2Eの成功ではない。今回合成Rootの履歴出版待ち一件は、終了後メンテナンスの保存Owner取得が不成立だったため保全し、2026-11-01を再評価期限とする。未解決回復・結果配送待ちは零、旧保持物は不変。[一回の成功結果と記録保全](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-turn-acceptance-result)を参照する。

ProviderのCLI実行制限と結果受理を分離した。Claudeの助言・編集・レビュー・boolean Probeは`num_turns`を正の安全整数の観測情報として扱い、CLI要求値や計画上限との比較で拒否しない。Claudeの起動引数とTask計画上限16、Codexの一依頼終端検査、既存Timeout・取消・回収は維持する。結果受理用の上限入力・上限超過判定fieldを撤去し、契約説明・改訂と利用側を追従した。過去の失敗・診断・保持物は不変。非AI回帰とレビューの確定結果は[今回の是正記録](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#provider-turn-limit-result-separation)へ接続し、実AI成功へ読み替えない。

診断付きClaude読取りを承認どおり一回実行し、成功Envelopeの`num_turns`が数値3だったことを確認した。CLI終了0の後、CRDDの1〜2整数条件で拒否しており、今回は認証失敗・Container作成unknown・HTTP故障ではない。`--max-turns 2`との数え方の差やCLI側の意味は未確定で、当該実測時点では受理条件を変更しなかった。その旧比較条件は今回の現行方針へ置換済みである。今回の実行資源は回収確認済み、未解決回復・結果配送待ち（pendingDeliveries）は零、履歴出版待ち（historyPending）は一件。合成Rootは失敗記録と未配送履歴一件のため2026-11-01を再評価期限として保持する。AI再送・再起動・旧保持物変更は行わない。[今回の一回実測](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-turn-count-diagnostic-once-result)を参照する。

Claude助言のTurn数拒否に、有無・型と正規化済み数値表記だけの任意診断を接続した。AI Adapter→Controller一次失敗→状態・履歴→検証Toolの搬送を揃え、生出力・文字列／Object本文は保存しない。診断追加時点では1〜2整数の旧受理条件、取消・回収・実行許可を維持した。旧回数比較は冒頭の現行方針へ置換済みである。局所搬送三件と、Controller／Tool156件・状態契約一件・AI Adapter24件は成功した。実AI再送・Docker・認証・保持物の操作はなく、先行失敗の具体的な`num_turns`は未復元。[最小診断と非AI検証](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-turn-count-minimal-diagnostic)を参照する。

Claude再認証後の正式statusはconfirmed／cleanupConfirmed trueとなり、loginの三Container・二Networkとstatus用Containerの不存在を確認した。その後、同じ合成Context・固定質問・opus／mediumの読取りを承認どおり一回実行したが、Claude CLI終了0の後に`workbench_ai_claude_turn_count_invalid`でblockedとなった。HTTP故障・Timeoutはなく、実行資源の回収と入力不変は確認済み。再試行せず、失敗診断と未配送履歴一件のため今回合成Rootを期限付き保持する。当該先行試験時点の正規化は`num_turns`に1～2整数を要求していたが（現在は冒頭の正の安全整数契約へ置換済み）、実値は保存しておらず、上限超過・欠落・型不正の別は未確定。[再認証後一回の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-after-reauth-result)を参照する。

Codex／Claudeのstatus共通化では、Provider固有の正規出力・出力先・既知警告の検査をAI Adapterに閉じ、Coordinatorは共通結果と終了値だけを扱う。未ログインは確認操作完了／未認証であり、login成功やTask実行許可には昇格しない。共通化の非AI検証はCoordinator関連168件・AI Adapter24件、型・整形・lintが成功し、その検証自体では実Home・Docker・AI再送・login・先行保持物を操作していない。後続のClaude実認証結果は上段と区別する。[両Providerのstatus共通化](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#provider-authentication-status-unification)を参照する。先行一回の実status失敗と回収済み結果は[元の比較記録](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-formal-authentication-status-result)へ維持する。

先行の非AI調査では、専用Homeの想定位置に認証Fileが存在することと、正式status／Task前probeの共通Mount構成を確認した。両経路には更新・telemetry抑止環境値の差があるが、原因とする根拠はなく製品修正は行っていない。既存二Suite38件は成功。資格本文・期限は未読で、この調査自体ではAI再送・実Container追加・login・Docker再起動・保持物変更なし。その後承認された正式status比較の結果は上段を参照する。[先行調査結果と比較案](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-authentication-path-investigation)を参照する。

追加診断付きのClaude読取りを承認どおり一回実行し、認証確認CLIの正規出力が「未ログイン」（`authenticationStatus: unconfirmed`）で終了1だったことを確認した。Container作成unknownではなく、作成後の認証確認で停止している。認証切れかContainer内の認証利用経路かは未確定で、AI本体・外部送信は未開始。今回はHTTP故障なし、回収確認済み、操作・未解決回復・配送待ちは零だが未配送履歴一件は保持する。再送・再起動・先行保持物の変更は行わない。[一回試験の診断結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-auth-diagnostic-result)を参照する。

読取り確認の失敗を非AIで切り分け、拒否条件を維持したまま認証三値とHTTP子の固定故障段階・終了観測だけを既存診断へ追加した。Coordinator影響158件、Workbench通常86件、静的検査と独立レビューは成功／残指摘零。残ったWindows保存・再入場試験も、旧CLI・Module代役の登録順・試験importだけを追従し、一件と関連CLI十九件の成功まで確認した。文書参照展開先3,368指摘と、元のClaude故障原因未特定は維持する。AI再送・Docker操作・保持物変更は行っていない。[診断の最小是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#readonly-failure-diagnostics)と[Windows試験の追従結果](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#windows-state-cli-followup)を参照する。

先行のClaude読取り確認は、認証確認Containerのstart／attachが終了1となり、Provider本体開始・外部送信は未発行のまま停止した。別にobserve用HTTP子Process故障も記録し、同IDの取消結果・技術一次故障は保持できた。その実行資源は回収確認済みで、Task返却の未解決recoveryIds・secondaryFailuresは空。ただし清掃済み履歴のDocker相関参照とhistoryPending一件は保持する。失敗調査と未配送履歴の保全のため同合成Rootを保持し、2026-11-01までに既存Ownerで履歴の配送・保持を確認して清掃判断へ戻す。先行unknown Rootは変更しない。再送・Docker再起動・編集二試験は行わない。先行observe故障の因果は現在も未確定であり、現在の次候補は上段の認証利用経路の非AI調査である。実AI E2EのPassではない。[先行結果と回収範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-confirm-result)と[再開前確認](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#pre-ai-readonly-readiness)を参照する。

修正済み前提からClaude読取りを承認どおり一回試したが、認証確認Containerの作成結果はunknownのまま、結果観測ではHTTP診断上timedOut false／ECONNRESETを記録して停止した。同じTaskの取消結果も保持できた。一方、保持記録のProvider本体はnot_started・外部送信not_issuedで、回収未確認と三つの副次失敗が残り、新しい合成Rootとexact回復参照を保持する。再送・追加再起動はしていない。[今回の診断・保持範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-readonly-once-diagnostic-result)を参照する。

追加調査では、Toolのobserve失敗後に同じTaskを取り消す順序を確認した。合成の無出力子を既存処理で取り消すと、元CLI記録と同じ終了1・stdout／stderr各0となったため、この終了形だけでDockerによるcreate拒否とは断定できない。loopbackが利用できる追加権限では、実HTTP Ownerと検証Clientの五要求・三条件比較はすべて成功し、切断は再現しなかった。通常制限下の実行はhandled0で比較成立前に停止したため、この成功へ含めない。既存Docker backendログ内にはUTC14:57:13〜19の起動遷移が記録され、bridge作成時刻もその窓内にある。ただし発行者、元要求との直接相関、HTTP切断との因果は未確定。この読取り・合成比較では追加の製品修正・AI再送・Docker操作・保持物変更は行っていない。[今回の事実と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#http-cancellation-and-backend-startup-diagnosis)を参照する。

単体create比較は、標準／CRDD経路の固定Python、固定Claude Imageの空Home、追加承認した実Claude Home指定で成功した。最新の実Home指定は474ms・終了0で、停止状態のMount表示を照合して今回Container・一時Fileだけ回収した。Container起動、probeによる認証Home本文の読取り・変更要求、認証・AI・通信、Docker再起動は行っていない。認証有効性や元故障の原因特定ではなく、保持物は不変更。[実Home比較の結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claude-real-home-create-comparison)を参照する。

耐久Task受付と実行開始の分離、および検証ToolだけのHTTP Client別Process化を実装した。Task Owner・API・15秒HTTP期限は維持し、新Worker／Queueは追加していない。Workbench通常結合回帰85件、Coordinator関連回帰24件と限定独立再レビューは成功。子の受付応答本文完了は約2.9秒、取消は約11.7秒で、親の終了通知処理の遅延とは分離して観測した。同Processの過去の期限超過、元observeのECONNRESETとContainer作成unknownの原因は未解明で、実AI E2E・全体QA完了とはしない。変更4文書の指摘は零だが参照展開先には313指摘が残る。AI再送・Docker要求・保持物操作は行っていない。[結果と未完境界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#task-acceptance-candidate-verification)と[先行調査](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#http-real-task-storage-diagnosis)を参照する。

初回結果の回復参照搬送漏れは既存引渡し値を初回保存へ届ける最小修正を実装済みで、terminal検査は維持する。静的検査、助言22件、初回実保存一件、関連回帰269件、Catalog384件の検査は成功。単発保存Suiteも約四分五十三秒で二件すべて成功し、前回中断が早すぎた点は訂正済み。全体回帰・実AI完成ではない。[参照搬送の是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#advice-recovery-reference-handoff-fix)と[保存Suiteの切分け](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#single-task-state-duration-diagnosis)を参照する。

先行する合成設定の保存拒否は、空Git templateで作った確認fixtureの`.git/info`未準備として非AIで特定・是正済み。製品の安全条件は変更せず、保存Suite十一件・静的検査・限定独立レビューが成功した。この是正の試験物は清掃済みであり、新たに保持した今回Rootとは区別する。[保存準備の是正](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#selection-save-preparation-diagnosis)を参照する。

非AIの初回全体は1,850件中1,811成功・33失敗・6skipで不合格を保持する。全33失敗はSource・安全条件を変えず通常Windowsで成功確認し、関連正常系と環境skip一件を含む対象確認は計51件成功。AI Adapter24件・Workbench合成HTTP12件と静的検査も成功した。単一runの全体Passとは表示しない。[確定結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#元作業再開後の非ai回帰--2026-10-24)を参照する。

保持②は利用者承認の安全確認後、合成試験Root・対応する空のHost一時Root・旧marker一件だけを削除し、三対象の不存在を確認した。現行の状態・履歴に元参照はなく、対象ProcessとDocker資源も直前照会で不存在。AI再送・Docker再起動・認証領域操作・新しい回復機構の追加はない。旧試験の失敗・作成結果unknownとexact回復参照は履歴へ維持し、旧APIの回復成功や編集E2E成功には変更しない。[限定清掃の範囲と結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#retained-edit-trial-disposal)を参照する。元失敗の因果は[読取り調査](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#retained-edit-trial-readonly-diagnosis)の限定結論を維持する。

ClaudeのJSONエラー説明の取りこぼしは、既存AI Adapterの変換内で最小是正した。公開理由・APIを増やさず、生出力は保存しない。AI Adapter全24件、Coordinator影響回帰306件と静的検査が成功し、限定独立レビューは残指摘零。過去の実失敗原因は未特定で、実AI再送・Docker／認証操作・保持②の操作は行っていない。未実施の編集二試験や全体E2EをPassへ変更しない。[結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#claudeエラー変換の最小是正と非ai回帰--2026-10-24)を参照する。

再承認後、通常ファイル入口でCodex／Claudeの認証状態と回収を確認した。新品合成Contextだけを使う実AI読取り試験はCodex成功、Claudeは起動後の終了値1でblocked。両方のProcess終了・Container／Network終了後不存在・Tree不変を確認した。AI起動計二回、再送なし。停止条件に従いDirect／Isolated編集二試験は未実施。Claudeの非0原因は未特定で、認証切れ・通信故障とは断定しない。Docker再起動・本体設定移行・保持②の操作は行っていない。[観測結果と停止範囲](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#再承認後の合成実ai確認--2026-10-24)を参照する。

Repository別AI選択をTask・Objective・Grant・Packet・Operation Identityへ接続し、Home利用権限からModel選定を分離した。現在State／Project Snapshotはv5、Operation Identityはv2で、新形式だけを扱う。旧AI Profile／Store・MCP四Tool・Host Catalog起動依存を撤去し、Workbenchは選択Repositoryの設定Reader／CAS Writerと作業分類・明示選択へ接続した。Objective六Sourceと本番`public-*.ts`の整理、正式API・対象→操作のCLI・本番Consumer接続も完了した。

固定版`9db97f00a`の通常全体回帰は1,845件中1,788成功・52失敗・5skipで完走し、不合格として保持する。失敗は検証Tool・旧fixture・Owner参照・依存検査の追従漏れへ全数対応付け、通常実装と安全条件を変えず是正した。関連17 Suiteは217件全成功。実保存・Workspace・回復の影響四Suiteは102成功／1失敗で完走後、最後の試験側Owner搬送を是正し、当該Caseと公開境界の3件成功まで確認した。型・整形・lint・Trace・Header全数・台帳383件の検査と限定独立レビューは成功／残指摘0。一〜五の実装・本番接続・非AI検証は限定完了で、未解消の今回回帰失敗はない。実AI・実認証・人間確認・本体設定の実移行、全体QA・Releaseは未完了であり、全体完成とはしない。②のAI再試行と保持物の内容・Runtime状態・資源実体の操作は行わない。一度のDirectory metadata一覧観測は[最終確認の範囲と限界](99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#final-normal-regression)へ記録した。

Coordinator構造再設計の残る配置を56 Sourceへ一括移管し、今回のSource・利用側・試験・設計／登録追従を限定完了とした。公開Root217項目と保存B六Fileの本文は維持する。固定本番Sourceの全体回帰は1,854件中1,830成功・19失敗・5skipで完走。19失敗はすべて試験側の旧配置前提へ対応付け、修正版の対象Suiteを275件・13件・47件・21件で全成功まで確認した。最初の全体Commandを成功へ読み替えない。静的検査、Windows保存、直接利用側、限定独立レビューは成功／残指摘0。[最終結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#3822-残るsource配置の一括移管と最終確認)を参照する。横断QAと実境界E2Eは別途残り、実AI②・保持物・実Docker・認証は今回の対象外。

Coordinator構造整理の先行単位では、承認済みの本番未接続Trust評価と旧terminal codec／caller保存候補を廃止した。旧4 Source・専用試験3本、登録・設定と設計／QAを追従し、直接利用側24件と共通排他・回復・保存・履歴96件が成功、限定独立確認の残指摘0。Native共通処理・通常回復・保存統合Bを維持する。独立Trustの上流意図は代替未接続のまま残し、廃止を品質成立へ換算しない。[対象と確認範囲](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#3812-限定廃止の確認結果--2026-10-23)を参照する。

保存統合Bは、実装・旧試験の移行・固定版回帰の範囲を完了した。Task・Queue・Workspaceを共通Ownerと単一物理Writerへ接続し、履歴も同じRoot・保持設定へ切り替えた。旧ACK専用API・内部枝・二段リレーと旧設定Reader・配布例・Schemaを撤去した。固定通常回帰は1,862成功・失敗0・5skip、Workbench／MCP共通入口一件とWindows保存影響三十件も成功した。実AI・実DockerのE2Eと全体QAの完成ではない。次候補は利用者提示のCoordinator構造再設計であり、今回の保存契約を凍結基準にする。[確認結果と限界](99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#375-保存統合bの最終確認)を参照する。

②の実AI編集E2Eの今回試験は利用者判断で終了し、2026-10-24に既知の今回試験物・旧Runtime記録を限定廃棄した。作成結果unknownと同じ回復参照は歴史記録へ維持する。旧APIの回収成功・E2EのPass・一般回復条件の緩和ではない。AI再試行は行わない。[当時の終了判断](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-edit-trial-ended-unresolved)と[今回の清掃結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#retained-edit-trial-disposal)を区別する。

固定Commit `d4edcd1e`後の追従是正では、検証Tool3 Suiteの接続、Test Header全数Gate、現行文書43診断の是正に続き、確定誤検知236件を検査側で解消した。生診断は1,836→1,600、追加0。Checker全386件は385成功／既知1失敗（残1,600診断）で完走した。文書診断は現行0、歴史CHG旧参照3,353による全体不合格を維持する。Browser接続1場面も元失敗の原因未確定のまま。当該是正時点では、②のAI再試行・保持物削除は行わず、保持3 Hashと安全条件は不変だった。[今回の是正と確認](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#naming-false-positive-remediation)を正本とし、[先行の分類・文書是正](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#verification-tool-document-closure)と[是正前の固定版結果](99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#workspace-fixed-regression)を区別する。

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
