# CROS WorkbenchのProduction実装

変更ID: `CHG-000082`
状態（Status）: `In Progress`
担当責任者: Qual-Lab
最終更新日: 2026-11-20

## Coordinatorの根本削減 — 2026-11-19

### Host本番接続の前進切替 — 2026-11-20（限定確認完了）

#### Git固定と旧試験の現Owner接続

2026-11-20の続行では、最後の旧現在状態試験をState v7／Identity v6／summary v6と独立Hostへ接続し、Co全試験を含む型検査は成功した。その後、型検査を通過するSource文字列内にも残っていた旧Host／Probe代役を現Ownerへ接続した。既知の旧入口は本番・Script・試験検索で残存0。未実施だったHost中断点13件、1,001件のGit固定・Reviewer搬送、129件のTask実保存を追加の限定確認対象とし、全体回帰とは区別する。

| 今回の限定確認 | 結果と範囲 |
|---|---|
| 現在状態・pending主試験 | 1成功（172403.9508ms）。Label拒否を現保存受付へ接続し、初回出版故障は実renameで注入。元本文・pending相関を確認。先行したLabel前提・旧故障点・清掃の失敗は成功へ上書きしない |
| 再起動の既知失敗2形とCLI認証unknown | 3成功（主試験失敗を含む4件実行のうち3件、全枠289752.3171ms）。全段階本文、解放前拒否、二重確定拒否、同要求再入場、14故障条件を含む |
| 別Process CLI／Restart／認証Restart | 是正後3成功（249408.2078ms）。初回は3失敗。旧改訂数と、生存する兄弟Host排他を保持した試験準備が原因。正規解放と8／13更新へ追従し、各保存全文・兄弟本文／実体を確認 |
| 正常終了準備と開始診断 | 30成功（788.1266ms）。旧Host専用資源試験の欠測・一件欠測・重複・未知key・名前差を現終了準備へ移し、観測Image差だけでは拒否しない肯定対照を保持 |
| Probe二保存・完了・取消 | 現Factoryと実EM資源規則へ接続後3成功（417.4985ms）。旧文字列検出の互換支援・Token往復・私有Mapを撤去。初回の旧宣言欠測、VM別Realmによる先行拒否、未発行時Host清掃の期待差をそれぞれ是正 |
| Task共用fixture | 独立した合成Hostと正規操作順へ追従。正常実行は1成功（33032.6053ms）、開始前終了は別実行で1成功（23790.2431ms）。続行した129件実保存も1成功（1907832.6213ms）。先行失敗と是正内容は下記に保持 |

主試験等の5Fileと、その後のProbe／開始診断・台帳の追加是正は、独立読取レビューでともに残指摘0。追加検出したHost資源単体は現終了準備への義務移管後にFile・Symbol・台帳登録を撤去し、互換関数は作らない。最終の限定5 File（開始／終了、Probe、現在資源回復）は66成功・失敗／取消／skip各0（1050.9023ms）。Source／全試験の厳格型検査は成功し、台帳は402 Fileでvalid、testExecution=not_started、effectIssued=false。全体回帰・実AI・Docker・過去保持物、コミット／プッシュは実施していない。

別Processの初回Restart失敗で保全した今回生成の2 Repositoryは、exact Root・Git Root・State Hash・全Host／子Receipt・全配下のLinkなし・Lock不存在を確認して回収し、両Rootの明示不存在を確認した。対象は`.crdd/tests/current-host-transition-6244-fWMzvn`と`current-host-transition-6244-raMfoo`だけで、他の過去保持物は操作していない。前回子はtimeoutではなく、CLI子起動前の兄弟Host排他拒否による例外終了だった。既定Process拒否と有限技術応答を使った試験の後片付けであり、Task回復・実Docker不存在・製品E2Eの成功を合成していない。

追加の129件試験の初回は失敗した。原因は合成fixtureがTaskの回復ID一覧を登録順で期待し、現行のOperation nonce順と一致しなかったこと。元の検証内容を保ち、期待値を独立にnonce昇順へ構成した。内部fixture例外を上位の安全停止だけで隠さず、元の失敗箇所も試験結果へ残す。製品の並び・保存判定は変更しない。

是正後の129件実保存は1成功（1907832.6213ms）。Host中断点の追加13件は10成功・3件の子Process期限超過（1603702.705ms）で、history_pending／completion_pending／completion_readbackを期限変更なしの直列再確認へ分けた。初回の結果は維持し、成功扱いにはしない。

この初回期限超過で今回生成した`current-host-transition-17712-AnWaI9`／`-1jNO70`／`-HpdNCp`も回収した。OSのProcess一覧を読み取れる権限で照合し、残Lock所有PID 11436／27692／19504及び全exact回復IDに一致するNode子が不在であること、Nodeの引数観測不能が0であることを確認した。経過時間を停止証明の代替にせず、Root・Git Root・存在Host／子Receipt・終端Hostの明示不存在・State Hash・残Lockの本文／世代／実体を直前まで照合した。同じ試験Root全体の廃棄として3件とも不存在を確認し、本番のLock自動回復・State変更やDocker操作はしていない。先の2件と合わせ、報告した今回の保全5領域は回収済みである。

同じ期限の再確認は2成功・1失敗（276948.0696ms）。history_pendingとcompletion_readbackは成功し、completion_pendingは既存Host清掃関数の通常Reader固定による拒否を検出した。終了出版pendingだけを正規のexecution_completion Readerへ接続し、元断面・Host・相関・資源・Lease・Ownerと明示不存在を共同再確認する読取り専用分岐へ是正した。既に終結したHostを再清掃せず、pending確定は既存終了Ownerだけが行う。21形の反証を追加し、静的検査後の現在回復Fileは34成功（790.9897ms）、独立レビュー残指摘0。実publication再入場のcompletion_pendingは1成功（81276.7937ms）で、追加13中断点は個別再確認を含めて成立した。最終の関連5 Fileは67成功（1023.3333ms）、失敗・取消・skip各0。

この例外終了で保全した今回の`current-host-transition-22216-Hu63Vp`も、親PID不在・exact回復IDのNode子不在・引数観測不能0、Lock不存在、終端Host Root不存在、兄弟Receipt・State Hash・実体の不変を直前まで照合して回収し、Rootの不存在を確認した。報告した今回の保全領域は計6件とも回収済みであり、過去保持物には触れていない。

1,001件のCoordinator実Git試験の初回はcandidate固定で失敗した（1252981.1219ms）。VCの一操作30秒の中でFileごとにGitのObject書込み・Index更新・完成Tree照合を繰り返す構造を確認し、期限を延長せず、捕捉済みbytesの同OID書込み再利用、一時IndexのNUL一括更新、選択Pathだけの引数分割Tree照合へ整理した。検査後PathをGitへ再openさせる案は、別内容をObject化する副作用を増やすため採用しない。各Fileの実体・bytes・Hash検査、削除先行、通常Index／HEAD／Ref非変更、出力条件と一時回収は維持する。独立レビューで不正NUL補完と同OID後続File反証の不足を検出し、是正後3試験成功（26222.7301ms）、再レビュー残指摘0。VC実1,001選択＋改変負例は4328.2992msで成立したが、CoordinatorのFileごとの読取りと異なるBlob大量時の性能まで解決済みとはしない。上位1,001件搬送は別に再確認する。

削除元Tree観測の非0終了は既存のGit失敗理由を維持し、注入到達・一時物回収・通常Index／HEAD／Ref不変を追加確認した。VCの最終限定4試験は成功（27376.571ms）、独立再レビュー残指摘0。最後の旧入口検索で未追従のProbe構成搬送試験を検出し、元Snapshotと回収条件の搬送、不明・Receipt欠測・Owner喪失時のHost清掃0／保存0・元参照保持・一回解放を現本文へ接続した。型・書式・Lint後1成功（271.5232ms）、独立再レビュー残指摘0。旧Token等の既知5入口は本番・Script・試験の検索で0である。

コミット前の横断再確認では、肯定fixtureの旧State v6がCo／EM／Workbenchの3件、CLI回復先と認証create親／合成試験に旧Host内包形式、現行設計・QAに旧版と未完了記載が残っていた。新v7と独立Hostへ追従し、同じOPのDocker＋Hostを対象として真の兄弟全文を保全する。終端Hostの残存はterminal／cleanup confirmedと専用Rootの明示不存在で確認し、旧marker・Host Path補完は作らない。退役済開発guard専用期待は除去し、通常Taskと正式診断APIのRoot搬送・差替え反証、Reader欠測・例外・解放不明は維持する。

この追加限定3 Fileの初回は28成功・3失敗（28383.7433ms）。削除済み宣言境界、合成故障点の旧操作件数、旧台帳Owner期待を是正し、最終31成功（28706.2407ms）、失敗・取消・skip各0。EMの修復終了は限定1成功（329.3581ms）。WBの実AI試験は実行せず、後片付け期待だけを新契約へ追従し厳格型・書式・Lintを確認した。追加是正の独立再レビューは指摘0。全40_Develop及び現行Architecture／QAの旧契約語検索では、禁止・非漏洩の反証として必要な旧名と履歴を維持し、旧形式の肯定接続を残さない。

上位の実Git搬送は1成功（4683380.885ms、試験本体4682755.2706ms）。1,000件の対照、1,001変更・65許可Path、1MiB超本文とReviewerへの1,002 File搬送、元Repositoryの非変更まで確認し、試験hookの終了後にexact Root `crdd-workspace-repository-sEOemR`のENOENTを別途確認した。VCのCommit作成期限は変更せず、全体の所要時間はCoordinatorがFileごとに実Gitを繰り返し読む現在の費用を含む。大集合の一般的な性能保証や全体回帰の成立は主張しない。

今回の新方式へのSource・利用側・旧試験・台帳・現行文書の切替と、指定した限定確認を完了した。変更全体の書式・警告をエラーとするLint、Co Source／全試験とEM／Executor／DI／VC／Workbenchの厳格型検査、402 Fileの台帳、二つの実行設計照合、変更文書の限定Checkerは成功。Source・試験・記録の追加独立確認は残指摘0。全体回帰・実AI・実Docker・過去保持物は未実施のままであり、統合・Release可能の判定へ拡大しない。

以下の個別進捗は各実施時点の履歴である。「現在」「未完了」や型診断数は当該記録時点を指し、最新の到達点・未確認範囲は本節先頭を正本とする。先行した失敗や未実施結果を、後続の限定成功で上書きしない。

Coordinatorの基準・候補はVCの既存Commit／Ref操作へ接続した。独自Inventory・Manifest・候補WeakMapと`readExecutionInventory`を削除し、同じEM Host記録にRef予定・OID・未回収Index・確認・回収を保存する。Reviewerは許可範囲だけの固定Commitコピーを実行計画へ渡し、可変Worktreeへ戻らない。配送本文の取り違え確認である`projectionHash`は別責務として保持する。VCの既存要求へ明示`allowEmpty`、固定File結果へ実Blob OIDを加え、公開関数は増やしていない。

独立レビューで祖先case衝突、予定を飛ばすGit資源追加、配列の余剰Symbol受付を検出し、既存処理内で是正した。Git集合のprefixだけを照合し、初回追加は一件の未取得予定へ制限、配列をdescriptorの全own keyで検査する。再レビューは残指摘0。新しいStore・Registry・Wrapper・旧Readerは作らない。

| 限定確認 | 現在確認できた結果 |
|---|---|
| Host Git値／開始・Checkpoint | 9成功、失敗・取消・skip 0（277.0002ms） |
| Co実GitとHost記録 | Main、Linked、Ref不一致、秘密拒否、Receipt保存失敗、祖先case衝突の六観点が個別指定で成功。保存不明時はRef未発行・Root保持・清掃拒否。全Hostケースの一括再実行は未実施 |
| VC既存Commit | Main／Linkedの一試験内で空選択の既定拒否、明示同Tree固定、Blob OID、通常Index／HEAD／Ref不変が成功（17406.1339ms） |
| EM終了保存 | 現行Hostを独立保持し、技術資源終結後にHostを別Checkpointへ保存。正常終端・認証二種とHost初回保存の限定再実行は6成功（33893.9424ms）。読後の認可失効・元本文不変を追加確認 |
| Co作成／助言 | 現実宣言へ追従後27成功（704.4005ms）。旧任意ID取得Factoryだけの二Caseは退役。初期化失敗・清掃不明・exact参照・wx解放五条件は維持 |
| Probe回復 | 現実宣言へ接続した二試験が成功（421.9903ms）。同世代の順序、Root明示不存在、16故障・取消と一回解放を確認 |
| EM資源・回復終端 | 資源key／名前重複と、五資源・Restart・Host・元版・結果保持の二試験が成功（411.4948ms）。旧Host準備DTOと後続Token専用三Case・専用fixtureは撤去し、CAS・現在性・解放不明等を現保存Ownerへ対応付けた |
| 利用側 | Task Packetの旧候補HashをCommit IDへ追従し、失敗したReviewer／取消四試験は是正後4成功（111866.1991ms）。固定Objectの明示コピー一試験が成功（14004.6604ms）。Policy四形の実保存接続一試験が成功（85883.6377ms） |

終了履歴の公開照会に旧summary v5判定が残っていたため、新v6だけへ是正した。旧形式との両受理は行わない。EM終了保存・ReaderとCo作成／助言／Probeの限定読取レビューは残指摘0。旧同期の機構だけを退役し、実保存・資源・再入場・CLI・兄弟操作の検証を失わない対応を記録した。

旧試験追従の続行で、EMの大規模遷移試験を独立Host記録へ切り替えた。削除済みToken系譜・旧Host候補生成・初期Host専用抽出試験は退役し、同Host次round、別Host、五資源、再起動、履歴、Task相関、終端、非対象保持の反証は現行操作へ接続した。独立レビューで、全操作更新によるHost形式不正の先行拒否、未清掃Hostによる偽拒否、別Host欠測による偽拒否の三系統を是正し、再レビューの残指摘は0。対象9試験成功（811.6377ms）、EMの全試験を含む型検査も成功した。

Host専用保存の排他解放失敗は、実共通Lockの削除にEIOを注入して反証した。開始不成立・保存事実あり・Effectあり・解放不明・元回復参照の相関と、残Lock下の再送拒否を維持する。通常／rename／unlockの親を含む4件成功（10009.7063ms）、独立再レビューの残指摘0。

Coの実Host active-binding試験は旧マーカーを撤去し、同じ操作IDの未終結Docker操作を実保存してHost回収拒否と元参照を確認した（1件成功、11869.4206ms）。通常継続・二役選定・Reviewer結果投影は新Identity／Commit IDへ追従し、限定3件成功（34643.2915ms）。削除済みToken往復Factory専用3試験は退役し、現開始の入力・計画・Consumer拒否4試験は成功（475.3354ms）。Repository操作は自己生成Host記録へ接続し、実体取得の旧二関数抽出を撤去。限定13件の初回は10成功・3失敗で、削除済み抽出の追従後1件成功、リンク権限の承認付き再実行2件成功を別結果として記録する。初回を成功へ書き換えない。

Task Runtimeの対象Fileを全件限定再実行し、136成功・失敗／取消／skip各0（24578.4317ms）。このFile内のリンク境界はリンク作成権限を持つ承認済み環境で確認した。Coordinator全体回帰の成功とは区別し、先行した132成功・4失敗及び限定是正3成功を重複加算しない。

旧回復試験との保証照合で、Restart未終結でもHost物理削除へ進める不足を検出した。既存の削除前Gateへ`restartSettled`を戻し、資源終結・Lease解放・Owner無効だがRestart未終結の実保存断面でRoot保持を確認した。Root不存在時のpending保存拒否・保存後不明・Owner失効と合わせて4件成功（64327.3413ms）、正常再入場のpending→confirmed保存順とRoot削除要求0は1件成功（14713.5075ms）。旧Host専用checkpoint二試験はこれらとEM保存試験へ対応付けて撤去し、現在回復の資源・Owner・元版・履歴・取消・再入場30件は成功（668.1123ms）。独立再レビューの残指摘0。

本番Sourceの切替と利用側の限定成立を、全試験追従完了へ換算しない。Coの旧実Driver・回復fixture・旧Workspace試験は引き続き追従中であり、試験を含む型検査は7 File・113診断で未成功（実行した失敗試験件数ではない）。全体回帰・実AI・Docker・過去保持物・コミット／プッシュは行っていない。

完全切替の続行では、別Process回復子とDocker Effect試験の削除済みHost入口・Token・Marker取得を撤去し、検証済みRepository、同じEM Host記録、実Root・全子の実体へ接続した。旧Host清掃の26条件Helperは退役し、現行の`cleanupRuntimeOwnedDockerTaskHost`とOwner照合の実本文へ22条件を移した。処置前の失効・本文差・Reader／解放不明・Lease保存拒否、処置後のRoot不明・terminal欠測・private本文更新・停止後の追加処置0を確認し、現在回復Fileの限定再実行は31成功（674.3766ms）。独立読取レビューの残指摘は0。

Docker Effectの現Host化では、Lockの生存確認が一度falseになっても次のtrueで元Ownerを再利用できる不足を検出した。既存の世代照合で退役と能力失効を確定し、Lock自動解放・記録削除・回復方式の追加は行わない。限定Fileの初回は9成功・1失敗で、是正後の当該一試験は成功（11468.6967ms）。Root・全子実体・State本文を保持し、正式な新Ownerの回復後だけRoot不存在を確認した。独立読取レビューの残指摘は0。初回失敗を成功へ書き換えず、個別再実行と全File成立を区別する。

本番Source／通常Scriptの厳格型検査は成功した。試験を含む型検査は4 File・65診断まで減ったが未成功であり、別Process回復の再接続試験も追従中である。旧試験の独自代役に残る4群（Provider通知、正常終了準備、正常finalizer、初期化失敗のexact相関）は検証義務を現Ownerへ接続してから退役する。完全切替・統合可能・全体回帰成功はまだ主張しない。

別Process回復の実接続で、EMのLease解放受付だけが旧`ownerDisabled`を要求していた不足を検出した。現在の六field契約に合わせて`execution.ownerEffect === "disabled"`を照合し、旧fieldをCoや保存形式へ復活させない。同じ元版・対象・資源終結・結果非改変と後段遷移検査は維持する。正例とOwner有効／不明、資源未終結、別版／別対象、結果／summary改変の八条件を実受付本文へ追加し、対象Checkpoint Fileは10成功（277.0857ms）。EM全試験を含む型検査、対象整形・Lint及びCo本番／通常Script型検査が成功し、独立レビューの残指摘は0。別Process回復の実接続成功はこの単体結果から推定しない。

続く終了保存では、借用Repositoryの非列挙`root`が回復Ownerのspreadで脱落する原因を検出した。同じ参照を非列挙・変更不可のまま私有Ownerへ明示搬送し、公開・JSON・保存形式・認可を拡張しない。修正後、停止下Lock同一性及び別Processのproducer回復が2成功（63170.677ms）。対象Dockerの終了・履歴一回・記録除去、独立Hostのterminal保持とRoot不存在、兄弟記録全文／Root／全子実体保全まで確認した。独立レビューは同種spreadの実Consumerも照合し、残指摘0。

旧巨大正常Owner代役の固有義務は、既存Provider単体Fileへ五つの実宣言試験として移管した。Provider通知の既知Effectとphase／summary拒否、正常終了準備の元版・元plan再入場、正常finalizerのblocked→completed→失効、実`durableRecord`による初期化失敗alias拒否と放棄、不存在観測の保存・fresh読戻し・二重保存拒否を維持する。移管先Fileは27成功（634.828ms）、独立再レビューの指摘0を確認後、旧Token・Marker・Host準備Factoryを含む巨大Caseを撤去した。初回Intent前の終端候補の正負もEMへ追加し、Checkpoint Fileの最終限定再実行は11成功（295.1ms）である。

保存直後にProcessを終了する`state_saved`の実結合は、pending保存拒否・pending保存後切断・Root除去直後切断・confirmed保存拒否の四境界からの再入場まで成功した（1試験、72907.6869ms）。新方式では確定保存拒否後のHost状態を`unknown`として保持するため、旧`pending`固定の期待を残さない。対象外の全文・Root／全子実体、停止下の元Lock処置、最後の履歴一回と対象Docker除去まで確認する。親の終了観測・停止下Lock同一性・レビュー所見相関・回復子の初回Intent前提の四限定試験も成功（527.2147ms）。故障調査にだけ使用したWriter戻り値・Owner再照合の診断代役は撤去した。

再起動準備試験の旧Host専用九Caseは現Ownerへ義務を照合し、不足していた取得途中の拒否／例外・元版差後の解放不明を現在回復試験へ移した。Host／Home／Stateの取得段階ごとに後続取得0・保持済みだけ逆順一回解放・Writer0・元参照を確認する。現在回復Fileは最終32成功（672.31ms）、独立再レビューの指摘0。旧`recoveryBody`、`fixture("recovery")`、Token／Marker代役と旧Readerを撤去し、再起動Scope・Lock・保存・失効の11Caseは全維持した。現行の独立Host記録を使う専用fixtureへ整理後、11成功（475.4739ms）。型宣言のimport後配置を是正し、静的検査と独立再確認も残指摘0。

現在も完全切替は未完了。試験を含むCo型検査は、`coordinator-state-runtime`1 File・40診断でExit 1。`current-host-transition`と`repository-workspace-runtime`の型検査は成功したが、生成子本文・共用fixture内の旧Host前提は型検査だけでは検出できず、実CLI・認証・履歴・再起動の義務を現入口へ接続してから撤去する。全体回帰・実AI・Docker・過去保持物及びコミット／プッシュは未実施である。

Workspace試験の`readExecutionInventory`参照とGit一覧の旧代役を撤去した。VCの対象一覧に残るtracked削除は明示削除Selectionで確認し、10故障は本番Git選択本文と実VCへ接続する。読取り途中欠測・descriptor終了はそれを実行するFile読取り本文で維持する。大量条件は20,000／20,002件と256MiB前後の整合したFile代役を本番選択本文・File読取りへ渡し、全件選択・全byte読取り・descriptor終了を確認した。大量条件から実Commit成立を主張せず、既存1,001件の実Commit・Reviewer搬送試験は削除していないが、今回再実行はしていない。故障・件数・容量・現行9契約の限定4件は成功（15484.4866ms）。

実Gitの初回限定4件は2成功・2失敗で、失敗は開始固定CommitとHEADのOID同一視及びGit一覧Scopeとexact操作Rootの混同だった。前者は合法OID・元HEADとの内容同一・候補のexact基準へ分離し、後者はVCのexact Root拒否で確認した。是正後は検証Toolの実Byte／取消終了不明・開始Commitと候補固定・範囲外／HEAD不正／内容差の3件が成功（142229.6818ms）。初回成功した秘密投影拒否・Reviewer差替え拒否の2件も別結果として保持し、失敗を成功へ上書きしない。試験Rootは局所の清掃一覧を逆順で全件処置し、一件の例外で後続を飛ばさず、全Host清掃とRoot同一性を確認してから削除する。故障注入したRefもfinallyで元bytesへ戻す。独立再レビューは残指摘0。

台帳の限定確認では、前の変更でWindows用保存試験を含むようになったEMのruntime-core-crudに実行profile未登録を検出した。既存のrestricted_process／windows_process_controlだけを同じ試験IDへ登録し、検査は緩めていない。再確認は403 Fileでvalid、testExecution=not_started、effectIssued=false。Workspaceの台帳も固定Commit・非採用／非Merge・借用HEAD／Index保持と自己所有Ref回収へ追従した。

現在Host結合試験をEM Hostの操作ID・実Root／Receiptへ追従し、旧Token／marker・Host専用ReaderのA／B／C自動再出版を撤去した。通常回収はLease一版、Host pending／terminal二版、全解放後の終端一版、履歴二版の全保存本文を独立構成して照合する。対象Hostはphase／cleanup以外を全文保持し、兄弟は本文とRoot／全直下実体を保持する。通常・結果欠測は個別再実行で成功した（各58594.2722ms、58092.6214ms）。失効Ownerでの回収拒否は、現行契約に合わせ解放済みOwnerを負例とし、下位Effect 0を維持した。

履歴checkpointのpendingからfresh再入場する実試験で、履歴Readerの受理後にHost世代の通常Reader固定が自己拒否する接続漏れを検出した。Host世代へ既存EMの三種の読取り要求とexact Docker回復IDだけを引き継ぎ、取得前後・fresh照合でHost全文とOP相関を確認する。通常Readerが成立したら受付を破棄し、途中保存中のHost checkpoint・Root削除は拒否する。任意Reader callback・旧Host専用Reader・実行時循環は追加しない。30条件の局所反証を含む現在回復Fileは33成功（910.9558ms）、実checkpoint-pending再入場は1成功（64186.2722ms）。さらに局所12試験と履歴confirmed-pending／公開Driverの実保存2試験は14成功（132218.5636ms）、失敗・取消・skipは0。Driverだけは技術資源結果の一保存が加わるため、通常経路の6版と区別して7版を要求する。独立読取レビューは残指摘0。初回の限定起動は試験用Module代役flagの指定漏れで15成功・18失敗となり、正しい既存入口で再実行した結果と区別する。他の中断点・CLI／認証／再起動の再照合と旧試験1 Fileの追従は引き続き必要であり、局所成立を完全切替へ換算しない。

追加追従：未開始失敗の既存一試験を資源BookのOwnerへ移した。元失敗11形とLease二種、実行・資源・結果の正負対照、元失敗消去拒否、fixture本文不変を維持する。Dockerだけを変える候補・負例にも同じStateのHostを保持し、Host全文不変を比較する。四単体Fileの更新後限定回帰は36成功、失敗・取消・skip各0（1214.6516ms、Exit 0）。独立読取再レビューは残指摘0件。前の35成功と重複加算しない。EM全試験を含む型検査は旧試験五Fileの44診断、Exit 1であり、Co旧試験・Git接続も未完了である。

旧試験追従の続行では、HostをDocker記録のfieldや配列先頭から読む前提を撤去し、同じStateのkindと操作相関で取得する形へ変更した。旧Host Token生成・後継Hashの試験Helperを削除し、同じ操作ID／回復参照／Root・子Receiptの単調遷移と別操作・偽phase・実体差・余剰・旧Token拒否へ置き換えた。履歴はsummary v6へ追従し、旧v2とv5（schema単独差及び旧field付き）を明示拒否する。129件の反証は対応するHostを全て保持したまま末尾Docker Hashだけを破壊し、別理由の孤立拒否にすり替えない。

開始保存後の終端準備失敗の既存一試験は、通常CheckpointのOwnerへ移し、正規Identity・保存済みHostと既存Source準備を使用する。六シナリオの元参照・保存事実・Context・解放不明・Effect・呼出し順のassertは維持する。この四単体Fileの最終限定回帰は35成功、失敗・取消・skip各0（1149.0396ms、Exit 0）。各再実行を重複加算しない。整形、依存閉包の厳格型検査、Lintが成功し、独立再レビューは残指摘0件。製品Source・安全規則は変更していない。EM全試験を含む型検査は旧試験五Fileの47診断でExit 1のままであり、全体回帰・Git接続の完了は主張しない。

追記：旧`state/probe-record.ts`、Host Tokenの整形入口、未使用の`prepareOwnedStateInitialization`を削除した。通常実行・回復・診断と検証ScriptはEMの同じHost記録へ接続する。Docker開始に残っていた空Stateの仮生成を撤去し、元Identity本文と操作・Repositoryを検証した後、Hostを含む現在Stateを必須として既存Writerへ渡す。失敗時の元回復参照、CAS、認可、保存・解放不明の分類は維持する。

本番／Scriptからの参照がなく旧試験だけが使っていたProbeの旧失敗正規化二関数と専用型も削除した。現役シナリオの結果構築へ統一し、現在使用する作成前清掃と技術結果投影は維持した。対象の診断単体十試験と本番Source／通常Scriptの厳格型検査が成功し、この削除の限定独立Source確認は残指摘0件である。旧integration試験の追従完了とは区別する。

今回の追加限定確認は、開始／Checkpointの六試験、通常Owner二段階の結合一試験、Root作成直後のProcess中断一試験、初回Host出版とpending再入場の一試験が成功した。初回出版試験は既存Core試験Fileへ移し、旧初期化入口を呼ばない。Readerのblocked＋値あり／completed＋値なし、同値再送、State消失後の再初期化拒否、別Repository、fresh Process、同bytes実体置換、pending一致／不一致、hardlink拒否を保持した。通常Owner試験では検証中の別操作全文保全を確認後、試験が作成した未発行操作だけを正式に終結し、当該実行のRoot清掃まで確認した。hardlink作成は今回のRepository-local試験領域だけで通常Windows権限により実行した。Sourceと上記試験差分の限定独立再レビューは残指摘0件。

Coordinatorの本番Source／通常Scriptの厳格型検査は成功した。ただし、他の旧Host形式を直接構築する試験fixtureの追従とGit固定内容方式の本番接続は未完了であり、完全切替・全体回帰成功・統合可能とは表示しない。旧方式の互換入口は追加せず、実AI・実Docker・全体回帰・過去保持物・コミット・プッシュは操作していない。

上記是正後の型検査では、Coordinator試験入口に143診断（19 File）、EMの試験を含む入口に50診断（8 File）が残り、各Exit 1である。いずれも今回の新保存契約へ未追従の試験側に残る診断であり、実行した失敗試験件数とは区別する。削除済みSourceを参照するCoverage対象・Symbol依存・Source閉集合を更新し、Source閉集合の限定六試験は成功した。旧試験の削除や型の緩和では解消しない。

旧実装への巻戻しは行わず、採用済みのEM正本へ接続を進める。Task／AdviceのHost作成、正常終了、回復、隔離Probeは同じHost記録と実Lockを使用する。Docker記録内のHost複製・旧Token遷移・専用保存準備は撤去対象とし、固定した元操作参照を終了まで保持する。ProbeはDIの元Snapshotと回収条件を既存Callbackから保存し、ID欠測をCompletionの値で成功補完しない。

独立Source確認で、清掃前の成功表示、明示未発行の保存欠測、Root削除後の再入場、非Probe回復結果の完了field欠測を検出し是正した。診断の既存単体Fileへ、同一Receiptと終了・回収の共同条件、正の未発行と五単軸負例、削除後再入場・Root観測不明・解放不明の反証を追加する。不変Sourceだけを共有し、可変記録と故障は各観点で独立させる。

この変更単位は未完了である。診断試験の依存閉包に限定した厳格型検査と対象Lintは成立したが、Package全体の型検査には旧検証Scriptと旧試験の追従不整合が残る。旧Probe専用記録の残存Consumer、試験fixture・Coverage登録・文書の一括切替、Git固定Commitを使うCoordinator側の内容観測接続は後続作業とする。実AI・Docker・全体回帰・過去保持物は操作せず、作業中Treeを実行可能・統合可能とは表示しない。

最終候補の診断単体Fileは10試験すべて成功（失敗・取消・skip各0、531.9307ms、Exit 0）。追加した二試験は合計20観点であり、20件の独立試験又は実境界試験とは数えない。診断試験の依存閉包の厳格型検査、対象Lint、差分形式確認に成功し、固定候補の限定独立再確認は残指摘0件。Package型検査はCoordinatorのSource／Script入口で4診断、試験を含む入口で191診断、EMの試験を含む入口で56診断が残り、いずれもExit 1である。本番src内の診断は0だが、これはPackage全体の型検査成功を意味しない。型診断件数を失敗試験件数へ換算しない。

基準Commitは767f56eb9。人間は、Source移動ではなく処理・状態・保存・変換を減らし、Coordinatorを受付・外部操作の順序・観測搬送へ限定する方針を採用した。さらに、Host回復記録をEMへ一本化してRepository State不可読時のHost参照だけによる独立回復を廃止すること、Git基準へ一本化して無視対象・管理外領域を含む物理内容の一律監査を廃止することを明示採用した。既存保持物の自動移行・削除は行わない。

着手前に正常経路をRequest→Objective→Queue→Task→Attemptとして追い、既存のEM／VC／Executor／DIとの対応と過去の検証先を照合した。未接続Classifier、単なる保存転送Port・試験用旧Helperを撤去し、同一Workspaceで一件しか開始しないWave・配列・複数Promise調停を単件化する。EMの複数候補・容量・競合規則と、同じAttemptの遅延・重複開始通知の保存順序は別の保証として保持する。

後続のHost統合は、最初のDirectory作成前にEMのIntentを保存して初期化中断の記録欠落を閉じてから、marker・専用Hash token・二正本の同期を撤去する。Git統合は適用される実行Treeと固定Base／Candidate・Reviewer提示内容を先に確定し、独自Inventory／Manifestを置き換える。新しいStore・汎用Runner・Manager・Policy Package・互換経路を作らない。Receipt保存や実Home排他を無意味な重複として削除せず、保存Stateの判断は既存EM完成操作へ統合する。

変更分類は未接続機能の退役、実行調停の簡素化と採用済みの保証・保存境界変更である。親が各段階の入力・Authority・Effect前後・取消・回復・利用側を照合し、作者と分離した技術レビュー、限定回帰、文書／QA／台帳／参照確認を行う。標準の準拠基準・決定権限・リリースを変更しないため準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは対象外とし、各段階の限定成立を全体完成へ換算しない。

### 未接続・転送層の撤去と共有Workspace単件化の限定完了

本単位では製品Source・試験の未接続Classifier／保存転送Factory・Port／旧State投影Helperを撤去した。Workspaceの三つの保存呼出しは既存EM完成操作へ同じ入力・時点で直接接続し、Lease・期待世代・現在認可・CAS・同内容再送と異内容衝突拒否を維持する。EMから上位Sourceを照合していた横断Closure試験は、既存の検証内容とLocal Item IDを保持してCoordinatorへ移管した。Classifier専用の候補受付・偽成功metadata条件は退役し、Task再試行・差替え・上限・世代・完全選定保持は実EM保存を使う既存試験へ接続した。代替Classifierや本番の再計画Runtimeは作らない。

dispatchは候補一件を直接処理し、一要素のWave・Attempt／結果配列・Promise.all・中間Attempt DTOを撤去した。実開始・委譲は同じ試行のflagへ縮小し、通知Promise連鎖・元IDの回復相関・予約→引渡し保存→実行→終端保存は維持した。EMの候補容量・競合規則と設定上限は変更しない。Sourceは60 File・55,488行から59 File・54,823行へ縮小した（末尾改行を含むFile別計数、コメント込み）。下位製品Sourceへの本文移動はない。

| 確認面 | 結果 |
|---|---|
| 静的確認 | Coordinatorの型・整形・Lint・二追跡検査が成功。994 File、警告0・既存情報179 |
| 未接続・転送層 | 限定44独立ケース成立。初回39件中のClosure一件は旧Owner一覧の不整合で失敗し、実Consumer・共通Lock所在へ追従後に該当Suite四件が成功。追加五ケースは別名で確認し、再実行を加算しない |
| 単件化 | task-executionの直接影響する12試験が成功（471,640ms）。正常・実Adapter・七Taskの直列完了・依存と競合・同期throw／非同期Reject・開始前取消・清掃不明・保存候補不正を確認 |
| 台帳・文書 | Catalog403 Fileはvalid、試験起動・Effectなし。限定文書確認192／1207文書、エラー0・警告0 |
| 独立レビュー | 転送／Classifier撤去と単件化を別作者が確認。ヘッダー順の二Fileを是正後、両範囲とも残指摘0。Closureの非Owner拒否・任意Root構築拒否等の反証は維持 |

今回の実Git・保存fixtureは既存の終了hookで自己生成領域を回収した。実AI・Docker・過去保持物・全体回帰は操作していない。公開API・保存形式・実行保証は本単位では変更せず、Host記録／Git内容の一本化と回復状態判断のEM統合は未実装の後続単位である。採用済みの具体接続と保証境界は[統合計画](coordinator-consolidation-plan.md#根本削減の採用済み接続方針--2026-11-19)に記録した。Coordinator全体の最小化完了、全利用側・実環境の成立は主張しない。

### 受動DoctorのHost作成撤去

採用済みHost一本化のうち、通常診断は保存先を移さずHost作成そのものを撤去した。無条件のOperation取得、受動時の清掃、清掃失敗からの新規Host回復義務生成を除去し、未作成のFilesystem Policyを架空のPathから構築しない。既存Git／所在／Provider候補・認証変数名の観測と入力拒否は維持する。明示隔離試験だけは元の作成・元SignalでのProbe待機・回収／保持分類へ接続する。

診断結果は改訂17。受動時の`filesystem.policy`は`null`、`operation.directories`は`not_implemented`／`owned_operation_directories_not_requested`となり、同じcheck順の位置にblockerが一つ増える。readiness集約と必須check集合を緩和せず、隔離未実施は引き続き成立扱いしない。受動観測の例外は元例外のままとし、存在しない作成物の清掃失敗へ置換しない。公開関数集合・CLI引数・終了値規則と保存Schemaは不変だが、結果値のこの差を不変と表示しない。

変更分類は採用済みの不要Effect撤去。初回編集前に親と読取り確認者が実分岐、結果利用側、成功／非要求／不正入力／観測失敗／明示隔離／取消・回収不明を照合した。対象Packageの静的検査、既存PRL-UT-014とERB-IT-003の限定回帰、独立技術・文書レビューを行う。準拠基準・決定権限・Releaseを変更しないため準拠監査は追加しない。実AI・Docker・全体回帰・過去保持物は操作しない。

Run／Adviceと明示隔離試験のHost記録EM統合は未実装である。着手前照合で、現行`ExecutionModelAccess`が読取り用途とProject／Milestone対象を前提とし、作成前Host保存へそのまま使えないことを確認した。既存AccessへHost記録の書込み用途とRepository単位対象を閉じて接続し、既存Writer／現在認可へ渡す必要がある。仮の管理Capability・架空Project・別Store・汎用Grantは作らない。今回の受動診断撤去を、その保存基盤の実装完了へ換算しない。

固定版の静的検査は成功（994 File、警告0・既存情報179、型と二追跡検査成立）。既存診断UT八件と、Namespaceの失敗保全・本番受動DoctorのIT二件が成功し、失敗・skip・取消は0件。UTの一Case内では省略・受動・観測失敗・隔離・回収不明・取消済Signal・初期化失敗の七条件を独立したメモリ代役で確認した。これは実Dockerの取消・回収成立の証明ではない。ITの自己生成Rootは子終了・実体一致・空確認後に回収し、過去保持物は操作していない。

Catalog403 Fileはvalid（試験起動・Effectなし）、限定文書確認250／1207文書はエラー0・警告0。作者から分離した固定版のSource・試験・文書レビューは残指摘0件。受動の旧改訂固定と旧作成説明の残存検索、差分形式も成功した。今回の限定完了は受動DoctorのHost作成撤去であり、Host記録の保存統合・Git一本化・Coordinator全体の削減完了は主張しない。コミット・プッシュは未実施である。

### Host記録一本化の内部値契約準備

EMの既存Attempt types／validationへ、元操作ID・用途・作成日時・Root／固定子領域Receipt・phase／cleanupだけのHost候補を追加した。別nonce・Hash token・任意Path・架空のDocker履歴は追加しない。初回を未作成Intentへ限定し、実体Receiptと元IDの差替え・喪失、終端の再開を拒否する。不明からの明示回収再試行と、未開始への巻戻しを区別する。descriptorで入力を捕捉し、Proxy／getter・余剰欄を拒否、Receiptは独立凍結する。

これは採用済み統合へ向けた内部Sliceであり、本番のOperationRecord閉集合・State Reader／Writer・Coordinator作成／回復経路・公開Rootにはまだ接続していない。保存Schemaは未変更、旧marker・tokenの撤去とHost統合自体は未完了である。型を通すためにHostへhistory等の不要fieldを足す処置や、別Store・Facade・互換変換は行わない。作成前にHost Intentを含む最初のStateを一出版するため、既存AccessのRepository単位用途、現在認可、Owner取得と初回領域作成を既存Writerへ閉じて接続するのが次の実装対象となる。

内部準備の固定版はEMの型・整形・Lint成功（72 File、警告0・既存情報34）。Checkpointの既存三Caseと新規二Caseが成功、失敗・skip・取消0で、実保存・実体操作は行っていない。独立Sourceレビューは指摘0。既存Suite・正式IDを維持して台帳とSource対応、ArchitectureとQAへ境界を追従する。値契約の成功を作成前耐久化・Host回収・本番統合完了へ換算しない。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは操作しない。

最終の限定文書確認は179／1207文書、エラー0・警告0。Catalog403 Fileはvalidで試験起動・Effectなし。nested getter／Proxyの反証と、本番Checkpointの未対応Host種別拒否を加えた後も同じ五Caseが成功した。文書・台帳を含む固定版の独立再レビューは指摘0で、再実行を試験数へ重複加算しない。公開Root・保存閉集合・State Reader／Writerはこの内部準備では変更していない。

### Probe資源を既存Host操作へ結合する保存契約

Executorの通知搬送に続き、Host記録へ既存`OperationResources`を結合した。Task／Adviceは明示`null`、隔離Probeだけが単一Containerの記録を保持する。専用Store、疑似Task／Provider／Home、新しい保存関数・Writer・Mapは追加しない。既存開始／Checkpoint／Reader／Writerの閉じたHost値として保存し、取得済みReceipt・資源記録の巻戻しと喪失を拒否する。資源が未解決のままHostを終端化せず、`retain`変更・自動再発見Receiptも拒否する。保存値の捕捉は実行Propertyを呼ばず、資源の内側まで独立凍結する。

Coordinatorの回復照会は、Host内Probeについても資源key・通知保存区分・観測区分だけを返す。Container ID・Mount・元Snapshot・内部Hashは返さない。今回の保存契約はCoordinatorのHost実作成・回収・Probe実行を新保存へ切り替えたものではなく、旧Host markerとProbe専用記録の撤去も未完了である。新Readerは`resources`省略を補完せず、過去保持物は操作しない。

独立レビューを統合し、Probe全遷移後の元Host一意性・全文保持のassertと、QAの公開投影説明を是正した。親の追加反証で発行不明から未発行へ戻せる候補を確認したため、Host資源の同一要求についてunknown／issuedからnot_issuedへの変更を拒否した。汎用資源規則は変更せず、既知未発行の終結は維持する。初期Intent単独を未発行証明へ使わない条件を設計に明記した。

最終の限定確認は、指定三単体Fileの36Case、Co保存照会の3Case、実保存のHost正常／rename故障と既存Core CRUDの三場面が成功した。実保存のNode親結果や同じCaseの再実行は重複加算しない。Host正常場面内ではProbeの複数Checkpoint、拒否時の本文不変、元Host一意性・全文保持を確認する。EM／Coの型検査と追加Sourceの整形・Lint（警告0・既存情報13）、Catalog403 Fileのvalid、限定文書179／1207文書のエラー0・警告0を確認した。独立Source・文書レビューと統合是正後の局所再レビューは残指摘0件。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは操作しない。

### 借用専用Snapshotに残った非借用分岐の撤去

`workspaces.set`の唯一の登録点と全本番呼出しを照合し、実行Snapshotが常に借用Worktreeへ結合していることを確認した。私有`WorkspaceRecord.sourceTree`を必須化し、自己所有Workspaceへのfallback、非借用時だけの対象外変更拒否・機密候補検査、条件付き`unexpectedPaths`投影を撤去した。旧状態や互換Wrapperは追加しない。

借用対象が欠けた場合の拒否、現在のRepository／Operation／Mount／借用先の照合、許可Pathの構造検査、対象外Pathの観測、Reviewerへ渡す前の認識済み機密検査と候補同一性検査は維持する。試験には、対象省略・不正対象からのSnapshot未発行と自己所有Workspaceの内容不変を追加した。この非借用分岐撤去では、保存形式・Root公開集合・CLI・下位PackageのSourceは変更しない。後述のProbe通知変更は別の承認済み差分である。

Host本番切替の着手前照合では、隔離Probeの現通知が用途名／Container IDだけであり、そのままではCoordinatorがDI構成を再生成することを確認した。人間が既存callbackの最小変更を承認したため、Executorの既存二通知へDIの実Snapshotと実Plan由来の回収条件を第2引数で搬送した。Receipt欠測時の`retain`、同期通知拒否と後続Effect停止を維持し、新Store・汎用通知Framework・自動再発見は追加しない。Rootの提供関数・型集合は増やさず、既存通知契約の引数だけを拡張した。Host旧marker／Probe専用記録の撤去とCoordinatorの保存／回復切替は未完了である。

本単位の限定結果は、Coの借用／対象外変更／偽入力／機密投影／候補差替えの五CaseとExecutorのProbe／独立公開境界の五Case、計十Caseが成功した。既存Caseの再実行は重複加算しない。Co・Executorの型検査と追加Sourceの整形／Lint、Catalog403 Fileのvalid、限定文書194／1207文書のエラー0・警告0を確認した。独立Source・文書レビューの説明二点を統合して是正し、局所再レビューの残指摘は0件。自己生成試験物は既存fixture終了処理で清掃した。全体回帰・実AI・Docker・過去保持物、コミット・プッシュは操作しない。

### Git対象のFile列挙へ一本化

承認済みのGit基準化のうち、`execution/files.ts`の独自Filesystem全再帰を撤去した。VC既存`readRepositoryEntries`が返す追跡済み／無視外未追跡Fileだけを安定読取りし、Git非管理領域と`borrowed`の二方式を廃止した。Ignore指定済みでも追跡Fileは対象に残し、無視された未追跡領域とRoot直下Runtime `.crdd`は走査しない。新しいFacade・公開API・Git実装は追加しない。

親と読取り確認者が、既存の借用Tree／候補／ReviewerのCapability、VCの観測完了fieldと失敗例を着手前に照合した。Stage区分の欠測・不正は一覧成功へ畳まず、Submodule・入れ子Repositoryへ踏み込まない。選択Path・祖先のcase衝突、Link／Hardlink、特殊実体、安定読取りは維持する。列挙後の最初の実体確認でのENOENTだけ欠測とし、読取り途中消失・権限拒否は拒否する。全Fileの原子的Snapshotや非協調ProcessとのPath置換排他は主張しない。

Host本番切替はProbeのContainer Intent／Receiptも同時接続する必要があり、作成だけを先に切り替える二重記録は追加しない。本単位は独立して採用済みのGit対象列挙を先行するもの。内容Hash・候補の私有記録とHost旧markerは残るため、Coordinator根本削減全体の完成とは扱わない。保存形式・CLI・Root公開集合とVCのSourceは変更しない。全体回帰・実AI・Docker・過去保持物は操作しない。

限定回帰は既存借用／候補／Reviewer六Case、1001変更・大量File・大容量・Windows Junctionの追加四Case、依存境界六Caseの計16Caseが成功した。同じCaseの再実行を加算しない。故障Case内ではGit一覧失敗・Stage欠測／不正・Submodule・祖先case衝突・特殊実体・Link・Hardlink・権限拒否・読取り途中欠測の十条件を個別に確認する。初回の読取り故障代役が前段Repository読取りへ漏れたため、対象Fileのdescriptorへ限定して是正した。Windows Junctionは通常実行で作成時EPERMとなり、許可された実行条件の単独再確認で成功した。いずれも製品検査を緩めていない。

Coの型検査・追加三Sourceの整形／Lint（警告0）、Catalog403 Fileのvalid、限定文書163／1207文書のエラー0・警告0を確認した。独立Sourceレビューの不足二反証（祖先case衝突と特殊実体）を追加して同じCaseで成功し、独立再レビューの残指摘は0件。独立文書／台帳レビューと結果追記の局所再確認も指摘0件。自己生成物は既存fixtureの終了処理で清掃し、過去保持物は操作しない。全体回帰・実AI・Dockerの成立へ一般化しない。

### Host技術記録の主体分離と保存照会

HostOperationAccessからPrincipalを撤去し、検証済みRepositoryと元操作の現在認可だけへ限定した。技術記録の保存はPrincipalを取得せず、要求主体の記録は既存Task／AdviceのOwnerへ残す。一般ExecutionModelAccess・AMの認可と主体必須条件は変更しない。取消と書込み権限の失効を同一視する処理も追加しない。

既存Coordinator回復照会は`host-operation.OP-*`のexact参照を受け付け、保存済みHostのphase／cleanupだけを返す。実体Receipt、Path、資格情報は公開しない。欠測・重複・不正形式・保存観測不明を区別し、Probe照合・実資源観測・回収・再実行を発行しない。これは読取り接続だけであり、Run／AdviceのHost作成・回復切替、共通排他の作成前取得、旧marker撤去は未完了である。

限定照会三件と実保存のHost正常／rename故障・既存Core CRUD三場面（Node親を含む四件）が成功した。HostのPrincipal getterを呼ばず保存できる反証、認可拒否時の未保存と保存不明時の元参照保持を既存Caseで確認した。EMとCoordinatorの型検査も成功した。追加Source五Fileの整形・Lintは成功（警告0、既存情報13）。Catalog403 Fileはvalid（試験起動・Effectなし）。独立Source・文書レビューの意味上の指摘は0件で、台帳の字下げ一箇所を是正した。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは操作しない。

限定文書確認は183／1207文書、エラー0・警告0。今回の追加差分の形式確認も成功した。これは指定範囲の結果であり、全体回帰の成立とは区別する。

### Host作成前Intentの既存Writer接続

前単位の内部値契約を既存OperationRecord／Readerへ接続した。Hostは元操作IDから導いた非Authority参照を持ち、専用nonce・Hash token・Pathを持たない。既存`saveOperationStart`の明示`host_operation`用途が、作成前Intentを最初のState本文から一出版する。同じOwner・既存初回領域primitive・既存pending／rename／読戻しを使用し、空Stateの先行保存、新Store・Writer・Mapを追加しない。

Checkpointは同じ保存済みHost操作とexpectedVersionを必要とする。null版や、現在版が一致しても未開始のIDを追加する要求を拒否し、Startの代わりに使えない。元ID・Receiptの単調遷移と対象外区画を保ち、物理Writerでも元本文と同じHost候補を再導出する。保存確認・Lock解放・返却前の現在認可が揃った場合だけ開始成立を返す。出版不明・初回pendingは同じ参照を保持して停止し、新しい空状態へ読み替えない。実Host Directoryはこれらの保存操作から作成しない。

一般ExecutionModelAccessへHost用途を混ぜる初期案は、AMの独立した内容Access型からWorkbench／MCPへの代入を壊すため是正した。一般Accessを原形へ戻し、HostOperationAccessへ既存Root・Principalと元操作だけの現在確認を分離した。AMのRole・用途集合・一般Consumerの権限は拡張しない。HostをDocker／修復の履歴や終端へ流さない三種分岐を加え、利用側と試験も種別を明示する。Root関数は増やさず、現行State閉集合へHostを追加する。旧形式の変換・既存保持物操作は行わない。

着手前に既存Owner・初回境界・現在認可・CAS・元参照と、成功／不正入力／未初期化／保存不明／版不一致を照合した。変更分類は採用済みHost統合へ向けた保存契約の拡張。EM／Coordinatorの静的確認、利用側の型検査、保存と値契約の限定回帰、独立技術レビュー、文書・台帳確認を行う。標準準拠・決定権限・Releaseを変更しないため準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物は操作しない。

初回の実保存確認は正常・rename故障の二場面（親を含むNode結果三件）が成功した。最初のrename対象本文にIntentがあること、認可拒否時の未保存、同値開始再送、Receipt更新、stale拒否、失敗時のpending・元参照保持と再呼出し停止を確認した。追加反証でCheckpointのnull版と未開始ID追加を閉じ、同じ実保存Caseへ拒否・bytes不変を追加している。実体値は合成であり、Hostの物理回収成立を主張しない。

EMの型・整形・Lintは成功（72 File、警告0・既存情報34）。Coordinatorの型・整形・Lintと二追跡検査も成功（994 File、警告0・既存情報179）、Workbench／MCPは型検査が成功した。EMの指定四単体Fileは38件成功し、既存Docker／修復の値契約とWriter用途を維持した。独立レビューでAccess型の波及と単体責務文言を是正し、追加したCheckpoint反証も含む局所再レビューの残指摘は0件。後続の限定結果は追記し、同じ試験の再実行を加算しない。

今回接続したのはEMのHost保存基盤である。Coordinatorの通常Run／Advice・明示隔離試験の実作成／回復切替、旧marker・tokenの撤去とGit一本化は未完了で、全体完成・本番E2E成立・過去保存物の移行済みとは扱わない。コミット・プッシュは実施しない。

最終版の指定五単体Fileは48件成功（失敗・skip・取消0）。実保存の再確認はHost正常／rename故障と既存Core CRUDの三場面（Node親を含む四件）が成功し、Checkpointによる未開始追加拒否も同じCase内で確認した。Coordinatorの実Reader／照会CLI／四種投影の指定三件も成功した。同じCaseの再実行や親結果を独立場面へ重複加算しない。自己生成試験Rootは既存終了hookで回収し、過去保持物は操作していない。

Catalog403 Fileはvalid（試験起動・Effectなし）。限定文書確認183／1207文書はエラー0・警告0。文書レビューでCheckpointのLock説明一箇所をDocker／Host経路別に是正し、局所再照合の残指摘は0件。SourceレビューのAccess型是正、Checkpoint受付の追加反証とともに、今回の保存基盤だけを限定確認済みとする。Rootの関数集合、一般ExecutionModelAccess、AM／Workbench／MCPのSourceを変更せず、Host保存型の追加と現在の未接続範囲を区別する。

### 残る重複処理とGit固定に必要な既存操作の整理

四系統の一括指示に対し、受付済み選定の再解析と状態表示の二重計算を先に是正した。各Stageは独立捕捉・凍結済みの元選定を直接使い、同じ参照との恒真比較も撤去する。外部preflight・準備結果・Packetの完全値、役割、試行、現在OperationとHomeの相関確認は維持する。投影生成と外部DTO受付の進行・品質・優先次操作は既存File内の同じ計算を使い、外部入力の構造・件数・到達可能性と結果相関の検査は省略しない。

Git固定用の前提として、VCの既存`readCommitDiff`へPath省略時の全体比較とGit由来の変更Pathを追加した。`readFile`／`createCommit`は基準Commitの通常Blobを確認したうえで親Directoryごとの削除を扱う。Link・別Repository・観測不能を不存在へ畳まず、通常Index・HEADは変更しない。内部の祖先確認だけを同じ技術Ownerで共有し、Root関数・新File・Store・保持Refの自動回収は追加していない。

| 確認面 | 結果と限界 |
|---|---|
| Coordinator | 状態照会・遷移の18試験、Stage選定の直接影響6試験に成功。Source型検査・対象整形は成功 |
| VC | 直接影響する既存二Fileの限定回帰は24試験中20成功・4失敗、Exit 1。4件はWindowsのShell／Link権限制約であり、同じ4件のみ通常権限で再実行して全成功、Exit 0。最初のCommandを全成功へ読み替えない。追加したMain／Linkedの全体差分・Directory削除・根拠なし削除拒否・祖先再確認時のLink／EACCES反証も成功。型・対象整形・Lint成功 |
| 独立レビュー | Coordinatorの二系統は指摘0。VCの後段祖先確認で内部理由名が漏れる一指摘を是正し、反証追加後の固定版再レビューは指摘0。Source・Architecture・QA・既存Catalog項目を照合 |
| 文書・登録 | Catalog受付はcomplete、試験起動・Effectなし。指定五文書から展開した限定確認201／1207文書はエラー0・警告0。差分形式確認も成功 |
| 試験物 | 今回作成したRepository-local fixtureだけを既存終了処理で回収。実AI・Docker・過去保持物・全体回帰は未操作 |

Hostの本番切替、旧marker／Probe専用記録／Hash tokenとDocker側Host複製の撤去、CoordinatorのInventory／Manifest／候補WeakMap撤去はまだ完了していない。Git拡張の局所成立をCoordinatorの固定内容接続完成へ換算しない。

着手前照合で、Host削除条件に子Dockerの`lease:released`と現行`areTaskResourcesSettled`を単純にANDすると、資源記録なしの未開始失敗で回収と結果確定が循環することを確認した。後続切替では「技術要求前の終了」と実Home解放を分け、元の未開始失敗・未発行観測・exact回復参照を保持してから同じHost排他で回収する。`resources:null`だけを未実行証明へ昇格しない。呼出し側と一括切替前の新Host Lock署名や未使用の作成領域は残していない。

### 未開始失敗の保存接続と資源終結条件の是正

Host切替前の実接続照合で、要求前の失敗を残すと資源終結へ進めない条件と、Coordinatorが保存する開始拒否の段階／理由をEMが拒否する不整合を確認した。旧Host記録を先に削除せず、同じ変更意図の前提是正として既存の値契約・記録入口を更新した。

資源なしの終了準備では、Provider未開始・送信／共有書込み未発行・Owner無効化・未確定の結果／要約／履歴・再起動義務終結を維持し、元失敗のCommand取得・応答・Receiptが明示falseで、Command観測が欠測／nullの場合だけ、元失敗を消さずに資源終結を判定する。Lease保持／解放は別条件として区別し、不明は拒否する。この判定からHome解放・Host不存在・全体清掃成功を推定しない。全利用先の共同条件を独立照合した。

Coordinatorの未開始記録は、元Owner／回復参照・開始済みControlなし・blocked・Docker／Provider Effectなしと、Executorの既知四拒否理由を必要とする。EMは計画拒否／Home取得失敗の正しい組と限定した一次失敗形だけを受理し、観測済み資源要求・Provider開始・送信／共有書込み・Owner活動／不明との矛盾を拒否する。結果非nullでは元理由との双方向一致とblockedを要求し、成功・取消・別理由への置換を拒否する。元理由を汎用失敗へ畳まず、新しいStore・公開入口・互換Readerは追加していない。

EMの既存四Fileは47試験、Coordinatorの既存Provider実行Fileは22試験が成功した。EM側でLease二種・元失敗の有無・Command観測欠測／null・開始拒否四理由の肯否対照、失敗消去拒否、四理由の限定形12反証と結果区分を確認する。各失敗は先に実際の`executing`／Lease保持／Owner無効化の候補を一回生成・復号し、その元版から終了準備とLease二種へ進める。元失敗保持と技術資源未終結の中間状態を省略しない。execution八変異・資源発行済み・元失敗欠測・成功／取消／別理由はOperation全体のDecoderでも差分反証し、肯定対照で当該条件への到達を確認する。Coordinatorは実宣言が既存公開保存操作へ渡す要求の元理由・段階・exact参照・全fieldと、拒否時の保存要求0を確認する。新たな実保存・Host・外部Processは使っていない。

公開境界の限定試験で、当初のCo試験がEM内部の候補生成・Decoderを直接参照している不整合を検出した。例外や試験用公開は追加せず、内部の実モデル反証をEM自身へ戻し、Co試験を記録要求の検証へ限定した。修正後の公開境界十試験は全成功し、実保存の結合成立とは区別する。

公開境界を含む最終の既存五Fileは57成功（上記47件と公開境界十件を含む）、Coの既存Fileは22成功。中間形の追加後も同じモデルCaseが成功し、固定版のSource・試験と文書・台帳の独立再レビューは残指摘0となった。別の再実行を件数へ加算しない。

EMの型とCoordinatorのSource／試験型は成功し、対象整形・Lintはエラー／警告0である。独立レビューで欠測／null対照と理由照合の片方向不足を検出し、成功例追加・対称条件・Operation全体の反証を実施した固定版の残指摘は0件。試験再実行を独立件数へ加算しない。文書・正式QA・既存Catalog項目も同じ境界へ追従する。

本番の未開始記録は`executing`／Lease保持／Host未回収／結果nullを維持し、保存できることから実解放・回収済みを捏造しない。Hostの本番切替、旧marker／Probe記録／Hash token／二重遷移撤去とGit固定接続は引き続き未完了。全体回帰・実AI・Docker・過去保持物・コミット／プッシュは行っていない。

最終の限定文書確認211／1207文書はエラー0・警告0。Catalog403 Fileの受付はcomplete、失敗0で試験起動・Effectなし。差分形式確認も成功した。

### Host一括切替の未完了と動作可能な基準への復帰

Host作成・回復をEMへ切り替える実装を試みたが、Run／Advice／隔離Probeの利用側とDocker記録の旧Host fieldを一体更新する前に、旧宣言を先行削除して型不整合を生じさせた。この未完了の編集だけを撤回した。先行して検証したHost保存基盤、未開始失敗の保存是正、選定／投影の重複削減、VCの固定比較拡張と既存の作業差分は保持する。未接続の新Lock署名、未使用の作成領域、転送Wrapperは残さない。

復帰後、CoordinatorのSource／試験型とEMの型は成功した。既存の限定六FileはEM57件・Coordinator22件が成功し、失敗・取消・skipは0。対象の整形・Lintはエラー／警告0で、情報診断は維持する。別途試行した`biome check`はimport整理の要求で失敗しており、所定の整形・Lint成功へ読み替えない。完了済み範囲の独立Source／試験再確認は指摘0である。

一括指示の完成条件は未達。残る実装は、同じ実Lockと元操作IDによるHost作成／回復の本番接続、旧marker・token・Probe専用記録・Docker側Host複製の撤去、Git固定CommitとReviewerコピーへの接続である。前提試験の成功をこれらの完成や実境界の成功へ換算しない。全体回帰・実AI・Docker・過去保持物・コミット／プッシュは実施していない。

## 選定・準備・Home利用許可の単純化 — 2026-11-19

### Host切替前の二重清掃経路の撤去

共通wx排他の解放は同期である一方、Host領域には同期・非同期の二つの清掃と失効処理が残っていた。通常清掃を同じ本体へ統合し、Lock保持中だけ同期入口を拒否する分岐、非同期専用二宣言を撤去した。実体回収、能力失効、同じ世代の解放、回復記録整理と真正結果の順を維持する。解放false／例外では登録と記録を保持し、世代退役・Process停止へ閉じる。rollback／recoverの結果確認も明示的な`cleanup_unknown`拒否へ追従した。新しいWrapper・公開Root関数・保存形式は追加していない。

利用側と既存試験の全参照を新しい単一入口へ更新した。既存PRL-UT-014に実宣言の五差分反証を追加し、ERB-IT-003の真正結果試験は自己生成操作で実wx Lockを保持して清掃する。限定三Fileの初回は36成功・1失敗で、試験代役が旧async返値を保持して参照照合を壊していた。代役を本番の同期契約へ追従後、同じ37件が成功した。実Filesystem／wxの指定一件も成功し、自己生成RootとLockの不存在を確認した。再実行を独立件数へ加算しない。Source／試験の型と対象整形・Lintは成功、警告0・既存情報8件。

独立Sourceレビューの古いAsync／Effect説明一件を是正し、実生成されない返却型の一値も除去した。既存の世代失効IT指定一件はKernel取得だけを代役にし、実Filesystemで後発拒否・本文不変・解放一回・自己生成物回収を確認して成功した。最終のSource／試験型と同じ37件、二追跡検査は成功。Catalog403 Fileはvalid、試験未起動・Effectなし。限定文書218／1207文書はエラー0・警告0。コメント・Source・試験・文書・台帳の独立再確認は指摘0となった。HostのEM一本化・旧marker／token／Probe記録撤去・Git固定／Reviewer接続は引き続き未完了。全体回帰・実AI・Docker・過去保持物・コミット／プッシュは操作していない。

### 撤去後の再照合による追従是正

再確認で、製品Sourceから撤去したPrepared消費を、Executorの試験支援とその八利用Fileが代役で再現していたことを確認した。人間の是正指示により、支援の`consumePreparedPlan`とopaqueな準備参照を撤去し、元の技術計画を直接開始する。実一回開始・現在管理Owner・Recovery相関・取消・清掃・結果搬送の検証は維持する。専用tokenを別名で再導入せず、既存のLifecycle Controlと実受付の検証へ接続する。文書に残る選定Hashとv5 Identityの誤った保存項目説明も実Producer／Readerへ合わせる。

分類は試験支援・利用側と現行文書の追従是正であり、製品Source・公開API・保存形式・安全判定・期限は変更しない。親が直接利用元と正常計画・不正計画・元管理Owner・二重開始・取消・回収不明を着手前に照合し、限定回帰、作者と分離した技術レビュー、文書・参照確認を行う。準拠基準・決定権限・Releaseを変更しないため準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは対象外とする。

旧消費callback・opaque準備参照・未使用の消費済みbooleanを撤去した。支援の一回開始は製品と同じ既存Lifecycle Controlに接続し、二回目のRecovery作成を拒否する。元管理参照の拒否は既存verifyRevisionへ移し、誤ってObjectを返していた代役を真偽値へ是正した。別Owner時のCommand／Recovery開始0、取消・清掃不明とexact参照を維持する。試験内だけのconsumer拒否Ruleは実Coordinator受付へ戻し、unknown／undefinedの反証をその既存表へ移した。消滅したMount通知の期待値だけを撤去し、実終了順序は維持した。

Coordinatorの静的検査・二追跡検査は成功し、警告0・既存情報179。限定三Fileの118試験、上位受付の二試験、Executor公開境界・レビュー搬送の五試験、Workbench summaryの二試験が成功した。作者の先行確認・重複再実行は合算しない。Executor48 File、Workbench109 Fileの型・整形・Lintも成功。今回の試験物は各既存終了処理で回収し、Host子Processの終了・不存在を確認した。

独立技術レビューで見つかった元Owner拒否のtruthy Objectと消滅イベント期待を修正し、固定版の追加指摘は0件。独立文書レビューでは旧完全選定借用の残存一箇所も直接照合へ是正した。旧Mount Owner・消滅したverifier／借用APIを説明する段落も、元Executor通知・既存durableRecord・cleanupCheckpoint・terminalObservationへ更新した。旧許可経路の語を現行保証へ置換するだけではなく、実Producer／Readerと照合して記述した。

是正後の再照合では、全Toolの現役TypeScriptに旧consumePreparedPlan／preparedCapability／Mount完了callback・イベントの残存0を確認した。旧Grant・人工選定IDの残存は、旧field拒否と公開非存在を確認する負例二箇所だけである。今回の現行設計・QAに記載したRuntimeOwned照合／借用／完了関数は、すべて製品Sourceに実在する。Catalog403 Fileはvalid、試験起動・Effectなし。修正文書の限定確認は248／1207文書、エラー0・警告0、差分形式確認も成功した。文書の最終一点を修正した局所独立再レビューも追加指摘0件。今回の範囲内で追加の対応漏れは検出していないが、全体回帰・実AI・Dockerの成立は主張しない。

必要性監査を受け、人間はSelection／Prepared、Mount Grant、保存処理の順で整理することを指示し、Mount Grantの撤去に伴う保存形式更新も明示承認した。完全選定・役割・試行番号を上位の不変計画に直接保持し、Executor構築時だけ技術値へ投影する。選定GrantのMap・30秒期限・利用／失効token・人工選定ID・Hash借戻し、準備の二WeakMapと即時消費、Home Grant・5分期限・観測／所在Capability・10秒期限・疑似Mount完了証明を撤去する。実Homeの共通wx排他・Pathと実体確認、既存のTask／Executor／DI取消、実資源終端、保存のCAS・Writer・exact回復参照は変更対象と区別する。

Operation Identityはv5へ更新し、grantRefと独立したmountLeaseReleased終端条件を撤去する。互換Reader・ダミー値・常時trueの代替証明は追加しない。旧v4を含むStateは新Readerが拒否し、終了済み旧Operationも対象となる。旧記録の完結や移行は別の明示操作であり、今回は既存保存物の参照・変更・削除・自動移行を行わない。Rootの関数集合は維持するが、Executor要求型・EM保存受付・内部終了契約は新形へ追従する。

変更分類は内部許可体系の削減と保存受付の破壊的改訂である。親が実Consumerと入力・開始・取消・回収・再入場を照合し、担当を分離した読取り確認者が選定・Home・保存の必要性と変更影響を確認した。試験は退役機構専用の条件と、実機能の検証義務を区別して追従する。対象Packageの静的検査・直接影響する限定回帰、独立技術レビュー、文書／台帳／参照の確認を行う。CRDDの準拠基準・決定権限・Releaseは変更しないため準拠監査を追加しない。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは対象外とする。Receipt必須保存の保証変更とHost marker／EMの保存統合は別単位で扱い、本単位の完了へ混ぜない。

### 実装と限定検証

Selection／Prepared／Home Grantの製品経路を撤去し、完全選定・Home観測値・元計画を直接搬送した。Host復帰は元の実清掃・保存Owner・計画を照合し、その後の最終終端で実Home解放を確認する。Host復帰前へHome解放済み条件を追加しない。退役機構専用の四試験FileとCoverage入口二つを撤去し、現役preflight・役割・Packet・取消・回復の義務は既存試験へ移した。

| 対象 | 限定結果 |
|---|---|
| Coordinator | 型・整形・Lint・二追跡検査成功。995 File、警告0・情報179。八Fileの192試験成功。別実行のjunction一試験も通常Windows権限で成功。実保存を伴う通常継続一試験は初回実行で成功し、繰返していない |
| EM | 型・整形・Lint成功。純粋な状態遷移・履歴・修復三File32試験と、終端保存一File四試験が成功。v5の固定JSONに対応する既知Hashを更新し、旧v4と余分なgrantRefを拒否する反証を維持 |
| Executor | 型・整形・Lint成功。公開境界四試験、終端共同条件を含むController五試験が成功。共同条件は実清掃四条件と保存受理の32組合せとし、旧synthetic Mount条件だけを撤去 |
| Workbench | 型・整形・Lint成功。summary観測二試験成功。子Process文字列fixtureの旧Grant・選定ID・Hash・未使用完了callbackを撤去 |
| 台帳 | Catalogは403 Fileでvalid。試験起動・Effectなし。Runtime追跡は旧Mount Grant資源だけを除いた六資源へ追従 |

同じ試験の是正前実行・作者試験・再実行を合算しない。限定回帰で見つかった旧理由、旧Prepared消費期待、独立捕捉後の参照同一期待、固定Hash、現行CLI File集合の追従漏れは、現役保証の反証を維持して試験側で是正した。junction作成のEPERMは製品判定前の実行環境制限として分離し、対象一試験だけ通常Windows権限で再確認した。作成した試験領域は既存の終了処理で回収し、失敗した二つのjunction準備Rootも不存在確認済みである。全体回帰、実AI・Docker、過去保持物操作は行っていない。

作者から分離した技術レビューで、本番の完全選定・Packet・元Operation、取消・実Home排他・清掃・Host復帰順序、EM v5受付とWriter保証、Executor要求、ScriptとWorkbench接続を照合した。機能の指摘は0件。説明残骸二箇所と、試験の配列対Object比較では独立捕捉を証明しない一点を是正し、元選定と捕捉要素それぞれの別参照・凍結を検証する形で該当一試験が成功、独立再レビューの追加指摘0件となった。再試験を192件へ重複加算しない。

Architecture・QA・Workflowの十Fileを追従した。限定文書確認は276／1207文書、エラー0・警告0。独立文書レビューで、Coordinator設計の旧「保存形式不変」と退役Grant／PAを現行Ownerとする二系統の記載を是正し、修正版の局所再レビューは追加指摘0件となった。関数集合の維持と、要求型・保存形式の更新を区別する。現役Packet／ControlのCapabilityと歴史段階の記録は、本単位の撤去へ拡張しない。現在、人間による追加判断は必要なく、Receipt保証変更・Host marker／EM保存統合・取消状態の追加簡素化は別単位の残件である。

## Local許可体系撤去の利用側・文書追従漏れ是正 — 2026-11-19

再確認で、Executorの非AI検証ScriptとWorkbenchのsummary観測試験の子Process文字列に、旧Authority参照と未呼出の消費代役が残ることを検出した。型検査の対象にならない文字列内の追従漏れであり、人間の是正指示により宣言・Plan field・代役だけを除去する。独立した本番権限を発行しないことのassert、開始・取消・清掃不明・通知保存例外・元Owner相関・summary搬送の既存検証は維持する。現行設計三文書とQAに残る準備期限・二時計・別Authorityの消費説明を、一回消費・現在Operation・既存Recoveryの説明へ追従する。

変更分類は既存撤去契約への利用側接続・文書追従であり、着手前に二つの文字列fixtureと実Consumerを照合し、独立確認者も撤去対象が未使用であることを確認した。製品Source・公開API・保存形式・安全判定・実行期限は変更しない。対象二Packageの静的検査、既存二Suiteだけの限定回帰、独立完成レビューと文書／参照確認を実施する。準拠基準・決定権限・Releaseを変えないため準拠監査は追加せず、全体回帰・実AI・Docker・過去保持物・コミット・プッシュは対象外とする。

静的検査はExecutor48ファイル（情報8件・警告0）とWorkbench109ファイル（情報4件・警告0）で型・整形・Lintが成功。限定回帰はExecutorのpublic-boundary 4件、Workbenchのsummary観測2件が全成功し、失敗・skip・取消0。検証Scriptは既存の自己生成領域の回収と不存在確認まで完了した。後続の文書確認・独立レビュー結果は実施後に追記する。

初回の文書限定確認は220／1207文書でエラー0・警告0。独立レビューが追加で検出したExecutor設計の旧型・期限・失効説明三箇所と、隣接する古い宣言数の案内を是正した。現行Source・Script・試験の旧参照field／発行消費代役／準備時計・定数、現行設計・QA・Workflowの旧PreparedAuthority／二時計期限／未消費別Authorityの説明は検索残存0である。退役説明と現役MountGrant・Selection・通知の期限を混同せず、歴史Evidenceと既存の意味IDは書き換えない。

修正版の限定文書確認も126／1207文書でエラー0・警告0、固定六ファイルと直接接続の独立再レビューは指摘0件。既存の開始・取消・回収・保存・結果搬送のassertと現役の別期限が不変であることを確認した。差分形式確認も成功。今回の全体回帰・実AI・Docker・過去保持物操作・コミット・プッシュは未実施である。

## 自作Local許可体系と重複期限の撤去 — 2026-11-19

人間の指示により、自作Profile・Registry・Local Grant、人工的なAUTHREG／AUTH／SCOPE識別子、それらのHash・改訂版・相互照合、30秒cacheと更新される5分期限を撤去する。同一同期呼出し内で発行・消費する別Provider Authorityの5秒期限・専用Map／WeakMap・失効処理、および準備計画の30秒期限・時計も撤去対象とした。名前変更・成功stub・別台帳・代替期限は追加しない。

変更分類は内部許可契約の削減であり、既存の開始・取消・失敗時の資源所有を着手前に照合した。Preparedの管理参照一致と一回消費、現在Operation、Selection／Mount、Home排他、必要記録・回収の実処理は今回変更せず、残すことを最終決定したものとは扱わない。人間が次段で吟味する四条件へ、残存処理とOwnerを対応付ける。Root公開・永続形式・実行Timeoutは変更しない。Doctorの退役専用説明二項目を除き、診断改訂は15とする。

既存の退役専用試験・集計は撤去し、混在する開始一回・取消・Egress・Home／Recovery観点は維持して利用側を追従する。限定した静的検査・回帰、独立技術レビュー、文書と登録情報の照合を行う。準拠基準・決定権限・Releaseを変更しないため準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物・コミット・プッシュは対象外とする。検証結果は実施後に記録する。

撤去後の検索では旧Source／Factory／人工ID・参照field・専用拒否理由の本番残存は0。準備結果の旧許可発行fieldと期限・時計の型も撤去し、旧理由の変換と専用試験入力も除去した。内側準備契約はCodex改訂9／Claude改訂8。別名許可・成功stub・新しいRegistryは追加していない。

最初の限定確認で、旧expired期待と撤廃済み文字列容量上限の拒否期待、Link作成権限、旧非同期Lock代役を検出した。期待だけを現契約へ追従し、容量上限は製品へ戻さず長い参照の正常保持を確認した。同期wxの取得・boolean解放へ試験代役を追従し、失効Ownerの通常清掃拒否と記録不変を確認してから、元のexact参照で既存の別回復Ownerへ接続する。製品の失効・回復判定は緩めない。途中の10ファイル実行332件中331成功・1失敗を上書きせず、是正後の固定実行では同じ10ファイル332件が全成功、失敗・skip・取消0（24,560.8396ms）。Executorの試験支援追従は別の1件が成功し、重複する作者試験や先行実行を合算しない。

Coordinatorの全静的gateは999ファイル、型・整形・二追跡検査成功、Lint警告0・情報176件。Executor型検査も成功。Catalogは407ファイルでvalid、試験起動・Effectなし。限定文書確認は248／1207文書でエラー0・警告0。独立技術レビューでは旧説明・死field・QAの旧失効説明を是正し、修正版の残指摘0を確認した。今回の失敗実行が作った四つのgeneration-loss領域は各固定Root・元記録Hash・exact参照を照合して既存Recoveryで回収し、Root・marker・親の不存在を確認した。権限失敗で作った空Namespace試験領域も今回物だけを回収した。過去保持物は操作していない。

QAの旧Authority終了説明を是正した後の限定再確認も156／1207文書でエラー0・警告0。試験支援に残った未参照の準備期限定数も除去し、Executor型検査と同じレビュー搬送1件の再実行、限定独立再レビューで残指摘0を確認した。同じ試験の再実行は成功件数へ加算しない。

## Packet／Mount失効とHome観測の追加閉包 — 2026-11-19

再照合で、Selectionだけを確認していた終了処理にPacket／Mount失効の返却無視が残り、Home Node観測にも未使用effects引数と旧Helper／Native専用fieldが残ることを確認した。人間の是正指示により、既存失効不明処理への接続と旧データの撤去に限定する。失効成功・拒否・観測不能・例外を分離し、呼出し一回・終了処理継続・元理由／回復参照・既存poisonを維持する。AdviceのRecovery放棄とpoison通知の例外も結果構築を飛ばさない閉包へ含める。新Store・Manager・Wrapper、Root公開・保存形式・期限の変更は行わない。

Node観測の内側改訂9ではHelper／配布物／Process群終了の未使用fieldだけを撤去し、Node読取りのEffect 0と回復不要を明示する。対応する契約・実体試験と、有限代役の旧fieldを追従する。実ProcessやDIの同名終了fieldは対象外とし、Path・Link・実体・旧Lock・Capabilityの期限と一回消費を維持する。着手前整合、限定回帰、独立技術レビューと文書／登録確認を実行し、準拠基準・決定権限・Release不変のため準拠監査は追加しない。全体回帰・実AI・Docker・過去保持物は操作しない。

固定版ではTaskのPacket／Mountも明示的revokedだけを成立とし、AdviceはPacket／Recovery放棄のtrue、Selection／Mountのrevokedだけを成立とした。独立した例外境界と元参照の局所解除により各呼出しは一回、後続の失効・終了処理を継続する。Task16・Advice16・Recovery放棄を含む8条件の反証で、poison通知例外でも一次理由・元Host／Docker参照・清掃未確認を保持することを確認した。Sourceに旧Helper専用fieldの生成・参照はなく、再導入拒否の不存在assertだけを試験に残す。

Coordinatorの型・整形・Lint・二追跡検査は成功、情報176件・警告0。通常Windows権限で、Task Runtime・Advice Runtime・Home観測UT・認証UT・新品Home／Source観測ITの5ファイル218件が成功（30,164.0563ms）、有限CLI代役の変更対象1ケースも成功（11,698.7523ms）。二実行219件の限定結果であり、先行253件や作者の局所8ケースを加算しない。Home撤去・失効終了の独立完成レビューは各指摘0件。試験は今回の自己生成領域を既存清掃で回収し、全体回帰・実AI・Docker・過去保持物・コミット・プッシュは未実施である。

文書の限定確認は238／1207文書でエラー0・警告0。Catalogは412ファイルでvalid、試験起動・Effectなし。旧生成field／旧確認フラグの製品Source残存、公開Root・API・下位三Packageの差分はいずれもなく、差分形式確認も成功した。

## 残る機能必要性監査からの是正 — 2026-11-19

人間は、認証の旧Helper結果判定の是正、未接続候補の撤去、Selection Grant往復とDoctor合成環境の整理、Local許可構造の再評価の順に進めることを承認した。通常Run／Doctor／Auth／Recovery／Maintenanceの成立済み保証を削減対象と混同せず、公開Root・保存Schema・実技術Cleanup・現在Operation・世代・一回消費・exact回復参照を維持する。変更分類は内部接続是正と未接続機能の退役であり、各単位の着手前整合、限定回帰、独立レビューと文書／台帳追従を行う。準拠基準・決定権限・Releaseは変更せず、全体回帰・実AI・Docker・過去保持物は操作しない。

最初の認証是正では、Node観測のEffect 0拒否をHelper終了未確認へ誤変換する受付だけを修正した。明示的なProcess Effectなし・回復不要の場合だけ清掃確認済みとし、元理由と回復分類を保持する。実受付本文の抽出試験へ両Provider×status／login×Effectなし／あり／不明の12条件を追加し、認証開始0と分類保持を確認した。認証開始後の排他・取消・保存・Cleanup・Recoveryは不変。型・整形・Lint・追跡検査と認証Suite43件は成功、独立レビュー指摘0。後続の候補撤去やGrant簡略化の完了をこの結果から推定しない。

Doctorの未使用合成環境は、専用組立て・変数集合・コピー処理と、転送名／フィルタ成功field・合成判定だけを撤去する。診断改訂14へ明示的に追従し、Hostの変数名検出・秘密値非記録・実隔離観測と現在の失敗条件は保持する。受動DoctorのOperation取得・終了整理は実Host資源の別契約として今回は変更しない。新しいDI観測APIや代替環境組立ては追加しない。

SelectionはHome前の非発行適合確認とHome後の一回発行へ整理し、事前確認と発行の適合Ruleを同じOwnerへ集約した。初回発行・失効・再発行の往復、未接続supersede、比較専用処理と旧refresh三理由は撤去する。30秒TTL・一回消費・元Operation／役割／試行／完全選定Hashと現在性は維持する。独立レビューでTaskだけ未消費Selectionの失効結果を無視する経路を検出し、既存poison・元Host回復参照・清掃未確認へ接続した。失効要求は一回、通知例外でも元理由・参照を保持し、後段でcleanへ上書きしない。内側契約は改訂6とし、Rootと保存形式は不変である。

固定版の最初の限定10ファイル回帰は253件中251成功・2失敗だった。失敗は模擬Docker回収を持つHost取消試験で、Claude Planの作業量欠測、有限Docker代役の作成ID／回収観測欠測、旧清掃通知順の期待という試験接続不整合を検出した。Coordinatorの試験2ファイルだけへ、元要求と一致する作業量、現行Planの各資源へ一意の64桁IDと同じIDの不存在／不明観測、現行Ownerの通知順を明示した。製品・AD・Executorの検査や期限を緩めず、取消一回・実子終了・投影・回収／保持・exact参照の検証内容を維持した。独立レビューで代役による成功補完がないことを確認し指摘0件。

最終固定版で同じ10ファイルを通常Windows権限・直列で再実行し、253成功・失敗／取消／skip／todo各0、35,242.3103ms、Exit 0だった。初回失敗を成功へ読み替えず、別実行として記録する。最終の型・整形・Lint・二追跡検査は成功、既存情報174件・警告0。Catalogは412ファイルでvalid、試験起動なし。限定文書検査は294／1207文書でエラー0・警告0。Root候補退役、Doctor診断、Grantと失効不明是正、試験接続追従の独立再レビューはすべて指摘0件。今回の自己生成試験物は既存清掃とexact対象の不存在確認で閉じ、過去保持物は操作していない。全体回帰・実AI・Docker・コミット・プッシュは未実施である。

Local Profile／Registryの再評価では、外部の登録・管理・失効Consumerはなく、自己生成の単一GrantとProfileが起動許可の発行／消費の同一性照合に使われていることを確認した。独立Registry機能を維持する根拠とは区別し、用途固定Local許可へ縮小する余地はある。ただし現在のScope・Home・Egress・有効期限を削除する許可ではない。30秒cache・5分Grant・5秒起動Authorityの役割と所有先を確定する別設計単位へ残し、今回は再評価までとする。現行の許可判定を勝手に緩めず、新しいStoreやRegistryは追加しない。

未接続候補の単位では、Root保護Policy評価、合成Root観測Codec、常時未実装Root観測入口、Home Layout評価と専用Helperを代替なしで撤去した。現役のProvider Home所在・Node実体観測・Binding・Grant・認証・回復とWindows Path検査は維持する。Platform内側契約は改訂3で`runtime_root_recovery`枠・保証を削除し、Home契約は改訂7で未使用Layout説明を削除する。DoctorのRoot保護候補説明も削除し、この単位では報告改訂13とした。通常Root公開・保存Schema・既存安全判定は不変。専用二試験とSymbol／Catalogを退役し、混合Platform／Home試験の現役義務とQA正式項目は保持する。削除をPassへ換算しない。後続Doctor合成環境整理とは別の変更として追跡する。

候補撤去後の型・整形・Lint・二追跡検査は成功（既存情報174件、警告0）。Home／Platform／Windows AdapterとNamespaceの4ファイルは29件中28成功・1失敗であり、全成功とはしない。失敗は既存Namespace反証の自己生成RootでLink作成がEPERMとなり製品処理前に停止したもので、拒否条件は緩めない。試験が保持した今回のRoot `.crdd/tests/node-namespace-IirVet` はこの時点で未操作であり、過去保持物とは区別する。候補専用二試験の削除はこの件数へ含めない。Root公開は不変、SymbolのJSONは319登録、Catalogは412ファイルへ追従した。

EPERMの1件は通常権限で同じ試験本体を単独再実行し成功した。最初の4ファイル実行をExit 0へ読み替えず、限定再確認として区別する。先行runの自己生成Rootは子Processがstatus 1／signalなし／起動例外なしで終了し、Link作成直前の既知空Directory `link-target`だけが残ることを確認した。検証済みRepository-localのexact Root、通常Directory・非Link・canonical Path、現在の実体同一性と空内容を照合し、非再帰の空Directory削除だけで今回分を回収して不存在を確認した。過去保持物や未知内容は操作していない。

## 開発計測を通常Taskの外側へ統一 — 2026-11-19

追加照合で、計測の取消・期限によって入口認可まで失効し、通常Taskの待機後認可が終了結果・exact回復参照を隠す接続不備を検出した。既存試験へ待機後認可の反証を追加して失敗を再現し、Scriptのローカル入口認可と、Signal／後続開始条件を分離した。通常Task APIの認可規則・保存形式・Root公開は変更しない。取消・期限の二系統と正常完了との競合でも、元結果・清掃状態・exact回復参照の保持、最終返却待機、後続開始0を確認する。これは既存実装契約の是正であり、Architecture・QAと直接試験を更新し、限定回帰と独立技術レビューを行う。準拠基準・決定権限は不変のため準拠監査は追加しない。

是正後のCoordinator型・整形・Lint・追跡検査は成功し、計測・公開Owner境界・Platform依存境界の3試験ファイル24件が成功した。既知のLint情報174件は警告・エラーと区別する。今回の取消・認可分離とArchitecture／QA追従の独立レビューは指摘0件で、対象文書と直接参照先の限定確認は229／1207文書でエラー0・警告0。現在、人間による追加判断は必要ない。全体回帰・実AI・Docker・過去保持物の操作は実施していない。

人間は通常runTask二回の外側計測と、専用の段階別Timing・四回／八回会計・各段階Source失効の撤去を承認した。既存計測ScriptはProject・Principal・期限・期待Source Hash・通常Task二件を明示受付し、通常の保存・認可・Workspace・排他・取消join・回復へ接続する。旧設定の変換、新しいPrincipalやTask IDの推測生成、新Store／Facade／Registryは追加しない。

製品のmeasurement.ts、Controller専用startとInvocation Wrapper、Operationの開発Context、Authority／Recoveryの開発分岐、専用結果投影を撤去する。必要なSource v4観測は既存計測Scriptへ集約し、MCP・Workbench・一般Task検証の利用側を直接追従する。専用Session／Constraints／Timingの三試験とその登録は退役し、削除をPassに数えない。現役の通常取消・回収・現在Owner・初回exact参照の混合検証は残す。

結果改訂4は通常Taskの最終返却までの経過時間とSource前後観測を表し、旧段階別計測やSourceの連続失効との同等保証は主張しない。後続停止はstatusだけでなくcleanup、exact回復集合、secondaryFailuresを確認する。取消後に早期完了せず、通常Taskの最終返却まで待ってTimerとListenerを解放する。Rootと内部実体Hash・Promptは結果へ追加しない。全体回帰・実AI・Docker・過去保持物は操作しない。

初回独立レビューで、計測後の出力Directory確認・保存失敗が取得済みTask結果／回復IDを消す経路を検出した。出力段階だけを局所catchし、元結果・一次理由・cleanup・回復集合を保持したままblocked、`outputConfirmed:false`と固定副次理由を返すよう是正した。Directory差と書込み例外を本番main本文の局所試験で反証し、再送・新しい保存台帳・秘密値の公開は追加しない。

Coordinatorの型・静的・追跡検査、MCP／Workbenchの型・静的検査は成功。初回の関連5ファイル34件、Task／Process／Sourceの3ファイル260件が成功し、出力是正後の計測／Source2ファイル16件と依存境界／Authority／回復診断／Coverage4ファイル19件も成功した。重なるCaseを別の新規成功件数へ加算しない。MCP／Workbenchの実入口不正引数・Source・取消結果搬送は各3件成功し、実AI・Dockerへ接続していない。Catalogは414ファイルで整合した。

Authorityの最終Sourceによる4 Source・8ファイルのCoverage集計は通知を記録したまま二回一致し、行7,957／12,635・関数127／282・分岐616／706だった。未到達の義務は保持する。payload SHA-256は`cadab6806d7314cc46780da0d23b9eecaee7cc3671b03c971aa110f50f0fd286`。先行Trust単位の集計と対象Sourceの違いを区別し、過去結果を上書きしない。

最終閉包確認で、生成経路のない旧開発理由四値を公開理由の閉集合から撤去した。再導入拒否のprefix判定は、独立レビューが見つけた語境界の未発火を是正し、旧四理由を含む反例と現行全Sourceへ同じ判定を適用した。型・静的検査と境界／計測／診断の最終20件、是正後の境界6件は成功。Source・利用側・文書を含む独立再レビューは残指摘0で、現在、人間による追加判断は必要ない。

限定文書検査は250／1207文書でエラー0・警告0。退役試験への歴史CHGリンクは10ファイル30出現だけに既存規約の旧参照注記を加え、当時本文・結果・URLを維持した。CHGヘッダーが追記で規定の先頭40行を外れたため、変更ID・状態・Ownerをタイトル直下へ戻し、最終更新日を同期した。検査側の規約は変更していない。全体回帰・実AI・Docker・過去保持物の操作、コミット・プッシュは実施していない。

## 未接続の外部Trust受付とLocalの往復変換の撤去 — 2026-11-19

基準`d848b5ce`で外部File Bundle・Trust Policy・Registry bytes・外部prelaunch受付には製品Consumerがなく、Doctorの説明と専用試験だけが参照していた。専用受付・型・定数・説明、専用3試験と台帳登録を撤去し、LocalのPolicy／Manifest生成とBundle／Policy Hash照合も代替なしで撤去する。旧試験の退役を検証成功へ換算しない。

Local許可元は独立凍結したProfile・Registry・Scopeを直接渡す。現役RegistryのGrant評価、Profile／Registry Hashと改訂版、Grant・Provider・Operation・Scope・Homeの相関、30秒の許可元cache、5分のGrant期限、Capabilityの5秒・単調時計・一回消費・失効は維持する。外部入力を内部候補へ昇格する入口や互換Wrapperは追加しない。Doctorの`egress`の旧Trust説明3項目だけは明示的に縮小し、Root公開契約と保存形式は変更しない。

Coordinatorの整形・型・Lint・二つの追跡検査、現役Authority／Profile／準備／Snapshotと依存境界の限定12試験ファイル102件は成功。Test Catalogは417ファイルで整合し、対象文書の限定検査は248／1207文書でエラー0・警告0。独立レビューは残指摘0。

追加の`provider-authority:coverage`集計は初回未成立だった。既存Local Authority試験の`stripTypeScriptTypes`が出すNode.jsの実験機能通知で、集計入口のstderr空条件に停止した。同じ8ファイル・起動構成の原因確認では試験Process終了値0、標準エラーは当該通知1件、LCOV出力ありを確認し、試験失敗と通知の分類不整合として是正した。

通知を隠すflagや任意stderrの無視は追加せず、既知通知一件の固定本文・help行・真の入力終端までの一致だけを受理して`diagnostics`へ記録する。未知・重複・余剰stderr、実行失敗、不正LCOVの拒否と60秒期限は維持し、二回比較はCoverageと通知の両方を対象とする。既存のCoverage結果shapeを保ち、結果の最上位に`diagnostics`を追加した。専用の反証を既存試験へ追加して3件成功、4 Source・8試験ファイルの実集計は二回一致した。行7,958／12,639、関数127／282、分岐616／706の到達であり、未到達義務をPassへ変換しない。集計payloadのSHA-256は`2672bfe1af99fdeaefdca07f731eaa3bac3871d86e35c165eed69f0d857fb14a`。

Coverageの独立レビューで、正規表現の`$`が許容する末尾改行を追加空行の反例として検出した。真の入力終端へ是正し、正規CRLF受理と追加LF／CRLF拒否を試験へ追従した。最終の型・静的確認と3試験、実集計二回一致は成功、独立再レビューは残指摘0。対象の限定文書検査は168／1207文書でエラー0・警告0。

本節実施時は開発計測の分離が未完了だった。専用保証を外す人間の承認と、その後の実装は[開発計測の製品経路分離](coordinator-consolidation-plan.md#開発計測の製品経路分離--2026-11-19)へ追跡する。全体回帰・実AI・実Docker・過去保持物の操作は実施しない。

## 未接続Host残存回復候補の撤去 — 2026-11-19

基準`d848b5ce`で、`evaluateHostOrphanRecoveryPlan`は専用単体試験以外の利用先がなく、実観測・処置・公開入口へ未接続だった。現行製品の通常Recoveryとは区別し、候補判定、専用型、専用単体試験、SymbolとTest Catalogの登録を代替なしで撤去した。旧Native清掃・専用記録候補の設計と品質定義も現在の義務から除外する。退役した試験はPassへ換算しない。

通常Recoveryのexact回復参照、現在Owner・世代の照合、長期／短期排他、共有回復Directory、助言初期化失敗時の初回参照保持は維持する。由来や非使用を確定できないHost残存を推測で削除する機能は提供しない。過去Evidenceと判断履歴は保持し、過去の物理残存は走査・変更しない。

限定確認ではCoordinatorの整形・型・Lint・二つの追跡検査と、回復投影・回復開始診断・Platform非依存の3試験ファイル16件が成功した。全体回帰、実AI、実Docker、過去保持物の操作は実施していない。外部TrustとLocal Grantの整理、開発計測の製品経路からの分離は別の後続作業であり、本撤去で完了とはしない。

独立レビューで見つかった旧Orphan義務の文書残存を是正し、再レビューは残指摘0。対象文書と直接参照先の限定検査は248／1207文書でエラー0・警告0、Test Catalogは420ファイルで整合した。履歴内の旧設計リンク4出現だけに既存規約の`[旧参照]`を付け、当時の本文・結果値は変更していない。

## 未接続Temporary Operationの退役 — 2026-11-12

現行の実行モデルから、旧署名準備向けTemporary Operationの作成・再開・根拠昇格・終了、専用のMap・型・故障注入Variantを代替なしで撤去する。基準38d51403fの全製品src／bin／scriptsとtemplateではRoot再export以外のCallerはなく、最後の本番Caller `prepare-release-runtime.ts` はa04ecb703で署名準備・昇格一式とともに撤去されている。以後の移管とwx化は専用ライブラリの保持・試験であり、本番再接続ではなかった。

共有の固定領域・File I/O・Error class・通常State／Attemptの回復は変更しない。既存の専用IT／STとfixture二個を退役し、Catalog・Symbolのactive集合を追従する。正式QA ID・元の検証義務と過去Evidenceは保持し、旧一時操作の自動化slice退役を全項目の免除や成功へ読み替えない。

過去のtmp／.operations記録は今回未走査・未操作であり、不存在と断定しない。旧APIによる自動再開・清掃は提供しなくなるため、由来不明物は保全し、必要な場合は対象確認と個別承認を伴う処置へ残す。互換Reader・移行・代替Store・新しい清掃Toolは追加しない。

## 現在状態

Callerの分解済みTask群を渡す[旧参照][公開入力契約](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md#caller-task-graph-intake)をDomain検査・Coordinator本番組立て・MCPへ接続した。Plan＋Task別入力を1対1で受け、受付Hashに結合し、欠測補完・文書同期・新Storeを追加しない。AI選択設定の型・検査・保存と共通JSON解析、固定状態ファイルI/OをDomainへ移した。二Taskの本番組立て・実保存・再入場10件、設定保存11件、依存・閉集合・I/O24件、状態・公開契約等75件、公開境界12件は成功し、限定独立レビューは残指摘0。一般CRUD・Writer全面移管・Core単独稼働は未完了。Domain全回帰は既存台帳不整合による3試験不合格、Root Checkerも3,722エラーで全体不合格を維持する。詳細と中断試験の未確定清掃は[実施計画](runtime-responsibility-realignment-plan.md#7-現在の未確定事項と次作業)へ記録した。AI・Docker・過去保持物は操作していない。

人間確認に基づき、CRDD文書群がMilestone／Roadmap／WBSの正本、CallerであるフロントAI等がTaskを計画・分解、Coordinatorが渡された小・中規模Taskを実行する分担へArchitecture／計画を整理した。既存Objective／Milestoneは実行依頼内のTask群／全体の受入・判断待ち・回復集約で、文書の同名概念との自動対応はない。基準版の1 Objective＋1 Task包装と、今回接続した分解済みTask搬送を区別する。文書処理はCallerの明示Taskに限り、自動同期・自動WBS生成・別の業務計画正本は追加しない。

既存判断・EvidenceとTaskの完了／受入の接続をSourceで確認した。[正本の接続確認](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md)のとおり、判断記録・根拠ID・局所受入を維持してDomainへ移し、新しい非管理完了機能は追加しない。現行のTask終端は管理実行の相関とcleanup、受入はObjective／Milestoneの既存状態を要求する。根拠IDの検査はEvidence本文・品質の自動検証ではない。既存Map結合6件は今回成功、新Package・実保存・公開Surfaceの成立ではない。既存属性のみとし、保存切替は実装・合成検証後に確認する順序を承認済みとして整理した。AI・Docker・保持物は操作しない。

2026-10-27、CoreをCoordinator非依存にするRuntime責務再編案を受領し、[基盤機能中心の再編計画](runtime-responsibility-realignment-plan.md)で調査・段階設計を開始した。基準は`5dae71084`。直前のStorage五File化を土台に、Domainの正本・共通保存、任意のCoordinator、LibraryのみのExecutorを分ける。以下のAccess Management段階の結果は先行の区切りであり、新方針の実装・保存移行・実AI成立を示さない。AI再送・Docker・過去保持物の操作は継続して対象外とする。

同日の初回Sourceバッチとして共有型七宣言・計画値検査・Path規則をDomainへ移し、Coordinator利用側と試験を追従した。外部AIなしの対象43件と四Packageの型検査は成功した。保存・CRUD・複数Task公開受付の全面接続は未完了であり、全体回帰完了・Core単独稼働・移行完了とはしない。今回の限定確認と残件は上記計画の現在地に記録する。

現行74 Source Fileの宣言索引、Root公開73項目、MCP／Workbench・配布入口・直接試験利用側を[Domain・共通保存の棚卸しとAfter案](runtime-domain-storage-after.md)へ整理した。Domainの局所CRUDと技術実行の確定を分け、単一Snapshot／CAS・短期排他・一回使用証拠を維持する候補である。全宣言の移管実装・Core独立の実証・正式Architecture切替は未完了であり、保存先も有効化しない。

後続で[API入出力・単一保存の設計正本](../../../06_Architecture/Details/domain-model/05_Runtime_Domain.md)を作成し、基本設計・Domain／Coordinator／MCP／WorkbenchとQA-000003／000008へ反映した。設計の具体化であり、Source・保存Schema有効化・Runtimeは変更していない。当初Draftとした属性・非管理完了報告の扱いは上記の判断・接続確認へ更新した。新契約の追加シナリオは既存QA項目内ですべてNot Runとし、旧結果を継承しない。

Access Management再編のSource・保存・Host CLI・Workbench／MCPの専門Owner接続と旧CROS／REST／Gateway撤去は候補実装済み。WorkbenchはLocal／共有配置とも同Hostの専門APIへ直接接続し、MCPに依存しない。承認済みPortfolio部分表示を含む対象回帰480件成功・失敗0、人間UAT1件Skip、Source／契約と結果同期の最終限定独立確認残指摘0。今回の区切りは成立し、コミット・プッシュ後に計画済みのDocker周りの責務分離へ進む。[現在の計画](second-stage-plan.md#今回の区切りと後続e2e--2026-10-14)と[集約検証結果](Evidence/261014_access-management-verification.md)を現在判断の参照先とする。

実Hostの初回設定・鍵操作の縦断と人間UATは人間判断により後続E2Eへ保持する。正式191項目の全体評価、全体Checker未合格、持越しDocker／Coordinator／Orchestratorの大改修は未完了であり、今回の区切りをCHG全体完了・リリース可能へ拡張しない。追加の人間判断は現在ない。

### 先行段階の判断と実装状況（履歴）

以下の現在・成立済み・未追従等は記録当時の対象版に限る。旧CROS、Remote MCP経路、Role表現等を現行仕様や新版の検証根拠として再採用しない。現在の状態は本節冒頭と第二段階計画を参照する。

認可方式の途中見直しとして、人間はUUIDによる安定ユーザーID、管理者が設定・変更する表示専用名、Roleと詳細権限、ユーザーへ紐付くCredentialとリセットをv0.22へ採用した。[現在の採用判断](second-stage-plan.md#現在の採用判断)とREQ-000041へ反映し、EXP-000036には旧判断履歴を保持した。一般的なアカウント管理は追加しない。採用方向の確認待ちは解消したが、UX以降の設計・Quality・Source・Schema・移行・回帰は未追従である。

Access Management再編の正式Architecture着手前には、要求のRole別共有Credentialと詳細設計・SourceのCredential別Grantが不一致と判明した。[照合結果と二案](second-stage-plan.md#正式architecture着手前の照合結果)は当時の診断・提案履歴として保持する。人間の新採用は旧二案のいずれでもない。要求から下流へ新方式を伝播して設計を固定した後、認可Source移管・旧Owner撤去へ進む。秘密値・実保存先・過去Evidenceは変更していない。

2026-10-09の途中見直し: 人間が第二段階の独立CROS Package維持判断を変更した。CROSを全体システム概念として維持し、認証・認可・管理回復を`access-management`へ再編する。Context集約、業務入力、Runtime投影、通信と汎用中継は実Ownerへ照合し、丸ごと改名しない。現行18 Source File・bin入口・12試験Fileと直接Consumerの初回棚卸しを[第二段階計画§11](second-stage-plan.md#11-access-managementへの再編--2026-10-09の途中見直し)へ記録した。具体Ownerの候補、正式Architecture／Quality反映とSource移管は未完了。直前の非秘密Credential MCP接続案はSource編集前に停止した。既存保存Root、Credential保護、過去Evidenceは変更せず、旧REST／Gateway／Shared Hostと旧Packageの撤去は代替能力の本番接続後とする。1〜8の継続範囲を維持し、段階9〜11の大改修は前倒ししない。

2026-10-09: 第一段階の名称・参照整理後の基準Commit `98cab6e3`から、[第二段階の責務再編計画](second-stage-plan.md)をDraftとして作成した。現行CRDDの工程順序を維持し、Package単位で実行系を含む責務再編を計画する。添付の未決Architecture候補を一括採用せず、Source実装へはまだ着手しない。旧5Cの持ち越しは新Ownerと必要保証へ照合し、旧方式の完成を先行条件にしない。

Source構造規約の第1段階は未完了。文書整備・限定独立再レビューだけを完了し、人間による範囲訂正に従って全Sourceの命名・配置とUT対応を移行中である。機能分割、公開API集合の変更、5Cの追加是正はこの改名へ混ぜない。規約・既存実装・旧検査の差分は[第1段階の記録](Evidence/261007_develop-responsibility-mapping.md#source構造規約の第1段階--2026-10-09)で追跡する。

| 項目 | 記載内容 |
|---|---|
| 現在の変更状態 | Phase 5の責務再編は未完了。Orchestrator／Coordinator／Dockerの追加是正と依存検証を人間承認により大規模改修へ持ち越す。局所結果と旧対象版のEvidenceを最新Tree全体の完成へ拡張しない。[現在の判断](#持ち越し判断--orchestratorcoordinatordocker2026-10-09) |
| 対象改訂版 | `v0.22.0` |
| 責務再編の現在順序 | 段階1〜4、5A／5Bは局所完了。5C追加是正は持ち越し。MCP／Workbenchをserver名へ移動し、物理的な親フォルダ移動の区切りで停止した。個別File責務精査は未着手。5D〜Fの機能再編、6〜8とCHG全体は未完了。[移動の到達点](Evidence/261007_develop-responsibility-mapping.md#親フォルダ移動の到達点--2026-10-09)と[処置表](Evidence/261007_develop-responsibility-mapping.md#持ち越しの処置--2026-10-09)を優先する。段階完了時のコミット方針は保持し、プッシュ・統合・Releaseは別許可に従う |
| 保存方式刷新② | 完了。実装、受付世代接続、終了整理、本番v2保存Port、Repository切替、現署名・production初期化、全回帰結果の処置とArchitecture／Quality最終独立レビューを完了し、コミット・プッシュ済み。全品質項目・全製品E2Eの成立とは分離する。[完了判定](Evidence/261005_project-runtime-phase2.md#36-②の完了判定) |
| 保存方式刷新③ | Execution IntelligenceのJSONL化、安全診断・実績割当・一般Operation、30日既定のTool別設定と新形式切替を完了。独立再レビュー二観点Pass、必須是正0件。移行済み旧領域は人間指示により清掃済み、未解決10件は新履歴で保護。追加指定の既知閉包6指摘も反証・直接回帰・独立再レビューで解消した。署名E2Eは未完了のまま維持する。[③の完了判定](Evidence/261006_execution-intelligence-phase3.md#③の完了判定--2026-10-06)、[追加是正の判定](Evidence/261006_execution-intelligence-phase3.md#検証と完了判定) |
| 成立済み | G1〜G5のScreen Architecture、Direction A、5画面のSecondary展開、Production Shell、公式ロゴ、Project Context共通Reader、Topic／Meeting Record ReaderとRepository CRUD Core、共通Applicationの検索・絞込み・安定並び順・Query拘束Cursor、WorkbenchのTopic／Meeting独立Detail、Workbench／Repository単体MCPのTopic／Meeting CRUDと同一Repository内Meeting Outcome処置、Remote CROSのCredential／Workspace／Exposure／Repository Revision再検証付きTopic／Meeting Routing、同じSessionとExposure Snapshotに限定したRepository間Owner Relation解決、Workbenchの許可済みPortfolio Source明示選択・Remote Topic／Meeting MCP読書き・Owner Repository付きRelation遷移・Local fallback禁止、許可済みPortfolio Federation、Repository mode／CROS federation表示、Project Portfolioの検索・状態絞込み・20件単位Query拘束継続読込・Source別五場面Detail・欠測保持、作業ツリー読取り、選択Stage／Unstage／Commit／確認済み通常Push、拒否・通信断・結果不明・再観測、Role別Credential Core、Token非保存、永続Registry、Workbench Credential管理Surface、Bearer Remote Transport、Workbench Remote接続／更新／切断、Project Runtime状態Toolの非曖昧化、CROS CredentialによるRemote Project Context MCP、Host限定Access Recovery、AI Profileの閉じた共通Schema・一意解決・四軸Availability・Owner別耐久Snapshot・改訂競合付き採用Core・Repository／CROS WorkbenchのProfile限定管理・`systemAdmin`以外へのCatalog非開示・Coordinator／Workbench Consumer接続、Workbenchの現在Session限定AI依頼Port、読取り助言／変更候補の明示、開始／観測／取消、事実／共有済み分析／追加推論／次の選択肢の分離表示、Coordinatorの依頼種別別Mode Router・現在Process内観測・取消・未知状態非推測、読取り助言の利用者依頼・Profile・内容Hash付き許可済み投影をEffect 0で固定する専用Task Packet、許可参照へ拘束した専用Result Parser、Workbench選択Profile IDのCoordinator Task Request→Route Candidate→Executor Selection Grantへのexact搬送とReviewerへの非伝播、Runtime ActivityのRepository実構成、Execution Intelligence EventのProject限定継続読込、Remote CROSのCredential／Exposure再検証付きActivity投影、未接続／absent／unknown／observedの分離表示 |
| 未成立 | 最新Treeの本番利用側一体接続、実Docker回復、必要な実AI／署名E2E、Quality義務、全体回帰・独立確認・配布固定は未完了。持ち越しは免除でない。旧対象版の公開MCP E2E等は履歴根拠として保持する |
| Phase／Gate適用判断 | `Applicable`: 画面Shell、読取り投影、書込みEffect、Remote接続を分けて成立確認する必要がある |
| 現在Phase | `Phase 5 — Production Closure`: 責務再編中、5C追加是正は持ち越し |
| 現在Gate | 旧REQ-000041契約でのPhase 4 Passは履歴。最小ユーザー識別契約の認可部分は正式伝播・再評価待ちで、現在のPass根拠にしない。無関係な旧成立能力と過去Evidenceは維持する |
| 次のGate | 新認可方式をUX以降へ正式伝播し、設計・QA、Source・移行・回帰を接続する。5D〜Fの独立処置とRuntime依存を確認する。持ち越した5C・署名実E2Eを直ちに再実行しない。全移管後はFile責務精査前に人間へ報告する。全体回帰・Reality Audit・固定Sourceレビュー・署名E2E・人間の採用／Release判断の未達Gateは維持する |

2026-10-04当時は、共有管理フォルダのACL移行を前提に復旧設計を広げる案を取り下げ、まずE2Eを実行し、再現性のある問題だけ対応を検討する方針だった。当時の記録では実アクセス権変更・共有環境の初期化・Process停止・旧三件削除は行っていない。局所設計・実装・試験を履歴として保持し、回復全体の成立またはRelease可能とは扱わない。[当時の再開記録](Evidence/261004_workbench-e2e-restart.md)は経緯であり、現在の処置は[持ち越し判断](#持ち越し判断--orchestratorcoordinatordocker2026-10-09)に従う。

## 契機 / 起点

| 項目 | 記載内容 |
|---|---|
| 種別 | v0.22 Product Capability実装 |
| 情報源 | Workbench Discovery、REQ-000040、UI／SPEC Detail Pilot、CHG-000081 |
| 理由 | 人間・AI・MCPが同じProject Contextを利用できる状態に加え、人間がProject、Topic、Meeting、Repository作業へ進む軽量な入口をProductionとして成立させる |
| 起点となる探索（EXP） | [EXP-000029](../../../01_Discovery/Analysis/EXP-000029/exploration.md)、[EXP-000030](../../../01_Discovery/Analysis/EXP-000030/exploration.md) |
| 対象要求（REQ） | [REQ-000040](../../../01_Discovery/Definitions/REQ-000040/requirement.md) |
| 不具合／監査是正の場合の逸脱契約 | N/A: 新Capabilityの実装である |
| ロードマップ参照 | [v0.22 CROS Workbenchの最小実装](../../01_Roadmap.md#12-v0220--project運営複数repository) |
| 情報源コンテキストの改訂版 | CHG-000081 Phase 6 Passed時点 |
| 人間による着手判断の参照 | 本対話でv0.22 Discovery、Direction A、公式ロゴ利用および実装継続を確認済み |

## 主な変更意図

### 2026-10-06の範囲見直し — 署名対象と一時配置の縮小

人間の承認により、同じv0.22の実行・検証入口を成立させる変更として署名範囲縮小を追加する。理由は、全体Tree照合のために候補ごとのRepository全体展開が増え、終了処置と再署名の負担を生んでいたためである。release／release-stagingの63候補は明示廃棄済みであり、旧一時wrapperから再利用しない。コミット・プッシュは停止する。

| 段階 | 処置と完了条件 | 現在状態 |
|---|---|---|
| 契約確認 | 成立済みの実行閉包、子入口、Native、Policy、Provider、設定Owner、原子公開と過去Evidenceを変更後Ownerへ対応付ける。 | 着手前の二観点確認を統合済み。[旧参照][ArchitectureのV6方式と再編後の閉包](../../../06_Architecture/Details/coordinator/01_Architecture.md#署名範囲の縮小--v6方式と再編後の閉包)を記録した。完成後レビューではない。 |
| 署名・配置の変更 | V6の署名／検証、選択FileのGit出所照合、最小一時配置、原子Manifest公開と終了・中断の処置を公開入口から接続する。 | 現行V6／履歴V2・V5・V6の分離、Signerと昇格前後の選択File照合、最小一時配置と終了清掃を接続した。既存公開準備入口のbinding局所8件と限定独立レビューはPass。本体Manifestの再署名と署名付き実境界は未実施。 |
| 利用側と伝播 | Runtime公開説明、昇格、履歴読取り、Domain Library、Native設計、Workflowと既存QAの検証設計を揃える。 | 未完了。通常Runtimeが既に持つ実行閉包検証は維持する。 |
| 検証と閉鎖 | 型・整形・Lint後に局所反例、必要な回帰、固定候補の独立レビュー、必要な署名付き実境界を確認する。 | V6／履歴分離9件、選択File出所と読取り上限2件、Manifest昇格14件は静的確認後に成功。旧全体展開fixtureを最小RuntimeとNativeの固定試験入力へ刷新し、署名入口・端末補助37件が成功した。その後の限定レビューで`.git`不存在判定の不足1件を両入口で是正し、production読取り再レビューは限定Pass。最小準備・清掃の追加局所4件も成功した。公開入口接続、変更全体の回帰・独立レビューは未完了。実署名、Provider依頼、Docker／ACL操作はまだ行わない。 |

実行JSONの恒久保存やverification整理は、この変更の前提条件にしない。過去の署名値・結果・Root・Hashを新方式へ書き換えず、V5履歴専用検証と現在Capability発行を分ける。全体配布Treeの一致保証は終了するが、Runtime集合、固定Policy、Nativeと必要な利用側の検証を弱めない。実行中の不変保証を前後Hashだけで成立扱いしない。既存のAIT-IT-002／003／013、AIT-ST-010を用い、新QA IDや新しい署名・清掃Frameworkを増設しない。

入口接続では、旧`prepare-release-candidate`が候補を作成して終了する方式を完成形として残さない。既存の一時操作Ownerを準備から署名・昇格・終了清掃まで維持し、Process-local能力をJSON化しない。署名済みstaging自身からの昇格、終了不明時の同じ回復参照、成功・失敗・取消時の清掃を保持する。未評価の正常準備を拒否試験の成功から推定しない。

最小準備の追加局所試験4件は静的確認後に成功した。固定GitのRuntime集合とNativeだけを展開し、正常終了時の作業領域・操作記録の不存在を確認した。操作記録を一時的に読めなくした反例では清掃未確認と同じ回復参照を保持し、記録復元後の同じSessionから終了処置できた。隣接する試験入力は変更していない。これは公開署名入口、実署名または昇格全体の成功を意味しない。

準備処理の限定独立レビューで、不正終端値による有効Session失効と、耐久的な回復移送後の再入場の未検証を検出した。既存5値の実行時検査を追加し、不正値ではOwnerを呼ばずSession・状態・同じ回復参照を保持する。合成試験でOwner移送とexact作業Directoryの清掃失敗を個別に与え、同じ参照を既存再入場APIへ渡して終了・不存在まで確認した。整形・Lintと現在の全Source／試験の型検査は成功し、更新した局所4件と固定2ファイルの限定再レビューもPassとなった。自身で作成した共通fixture、出所照合実装、Signerおよび公開workflow全体は、この限定レビューの対象外である。

利用側整合の確認では、旧準備入口を残した集合宣言、保護対象のVCS barrel参照、昇格入口のRuntime Root手組を検出した。準備処理の固定入力Ownerへの直接参照、変更済みの既知Consumer集合、昇格時の既存RuntimeData読取り専用観測へ揃えた。Rootとtmpの前後境界Identity、operation/work境界、`.git`の明示不存在を維持する。利用側整合14件と、出所照合・最小準備・昇格の回帰28件は静的確認後にすべて成功した。準備importと昇格観測の追加差分も限定独立レビューPassであり、公開入口・実署名・変更全体の独立レビューは引き続き未完了である。

公開準備入口を同一端末内の準備→署名→昇格→終了処置へ置き換えた。限定独立レビューで検出した、停止期限を保証しすぎた説明と、試験の必須Header・部分確認範囲の不足2件を是正した。直接子へのSIGKILL停止要求と返却待ちを区別し、時間切れ相当でも終了処置せず同じ回復参照を保持する反例を追加した。静的確認後の局所8件と固定2ファイルの限定再レビューはPassとなった。実署名、TTYおよび実子Processの終了は対象外である。

既存Native保護検証Toolの6起動点と昇格の1起動点を固定Owner・引数・内容Hashへ接続した。Tool graphは全登録39件、検証用13件、Runtime26件を受理し、Native9改変・昇格3改変の局所反例を拒否した。Native／Cargo／ACLを実行した根拠ではなく、公開入口の追加是正後に同じgraphを再確認する。

全SourceのHeader検査では、Signer試験の終了hookのHeader不足と、公開準備試験が旧CPR-IT-001へ接続されたままの登録を検出した。hookの責務を明記し、新試験の実際の確認範囲に合わせて既存AIT-IT-013へ接続した。Production Named Symbolと全Test Sourceの機械検査2件は成功した。試験登録の記載もbinding部分境界へ限定し、実署名・TTY・子Processの未評価を保持する。

追加独立確認では、Native構造試験の品質追跡不足と、共有fixtureの祖先検査前の再帰Directory作成を検出した。前者はERB-IT-001／002とAIT-IT-013の確認範囲をFile・Case・Symbolで分け、起動本体・graphの件数とHashを維持した。後者は最初の書込み前にRoot・`.crdd`・`tests`を全数確認し、alias・型不正・canonical不一致・観測不能では書込み0、ENOENTだけ段階作成・再観測へ接続した。全指摘の是正方針を監査間で確認してから適用し、固定候補の再監査は両範囲ともPass・追加指摘0となった。局所4件、全Header検査2件、Native graph局所2件は成功した。署名入口・端末補助の回帰37件も成功し、実署名を成功扱いしていない。

変更全体の二観点レビューでは、初回中断前の参照搬送不足と、Signer固有の署名直前差替え／Git marker観測不能の反例不足を検出した。全結果を統合し、両確認者と整合した限定方針で是正した。署名準備は既存AI実行キューへ未接続であるため、新しいstateやDBを追加せず、起動側が開始前から保持する両識別子を必須非秘密引数として既存Ownerへ搬送する。内部ID生成を廃止し、不正入力は作成前に拒否する。Signer本体を変更せず、Runtime／Native差替え時の秘密鍵読取り0・Manifest不存在・能力再利用拒否と、dangling Git marker／EACCES拒否を試験へ追加した。是正前の関連局所57件、Runtime Data42件、Version Control45件は成功した。是正後の準備4件、CLI8件、Signer反例2件も成功し、固定改訂版の再レビューへ渡す。実TTY・署名・実子Process終了は未評価のままである。

二観点の独立再レビューはPass、必須追加指摘0となった。参照搬送で変わった既存Lifecycleの固定登録1値だけを更新し、登録集合・検査ロジック・昇格処理を維持した。構造検査はSource31・検証用起動13・Runtime起動26を受理し、改変拒否2件と登録限定の独立確認もPassとなった。最終の整形・型・Lint・三構造検査とHeader検査2件は成功し、操作記録の残存0、release／release-stagingの不存在、本体ManifestのHash不変を確認した。

現在の未解決事項は、旧V5 Manifestを現在V6の昇格試験へ使う前提不整合と署名付き実境界確認である。旧Manifestを新方式へ書き換えて試験を通したり、Process検査を弱めたりしない。新方式の手順説明は更新したが、実行再開許可またはRelease成立を意味しない。今回新しいEvidence JSONは追加せず、旧Manifestを保全した。コミット・プッシュは引き続き人間指定により停止する。

2026-10-07、人間は署名試験を延期し、`tmp`・`tests`・旧`verification`のうち明らかに不要な内容の清掃を許可した。空試験Directory8件、既存fixture由来のPID記録97件、元Archiveを保全した同HashのBuild Source Archive21件、正式集約済みの旧静的collectorと結果13件、終了診断31領域、完了済み試験・移行資料5領域、旧配布tar8件、終了済み試験・画面確認32領域、置換済みTool139件と診断生成物21件を回収した。残ったPID9件は生成時刻より後の別Processへの番号再利用と確認した。計3890File・1199Directory、1,297,532,280 bytesを回収し、不存在を確認した。巨大ログを正式Evidenceへ複製していない。

`tests`は回復記録を持つ失敗fixture一件だけを保全した。旧`verification`は未解決の唯一原本5領域、固定Native入力・未移行Owner・現行診断根拠7領域、旧回復Toolが参照するE2E結果4領域の計16領域を保全する。collectorは退役したが、回復参照の消失を避けるため後者の結果だけは残す。過去の失敗値を成功へ変更しない。`tmp`のBuild21領域は正式Source・固定入力との照合と非使用確認により回収可能と判定したが、安全審査がフォルダ全体削除を停止したため、exactな21領域の人間承認を依頼した。承認前に分割削除等で拒否を回避しない。残る10領域と133直下Fileは下表の理由で今回の回収対象外とした。元Archive、認証、本体Manifest、固定Native入力と既存のGit差分は保全し、コミット・プッシュ停止と署名延期を維持する。全物理残存の解消とは表示しない。

| 残存集合 | 保全理由と次の処置条件 |
|---|---|
| `tmp/codex-01592-attestation`、`codex-01592-migration` | 正式Build入口の固定Host・Source入力。参照を正式配置へ置換し、同一生成を確認してから回収する。 |
| `tmp/.operations` | 空の既存Owner管理領域。一般生成物の一括削除から除外する。 |
| `tmp/codex-advice-auth-compat-20261001`、`codex-advice-auth-refresh-20261001` | 認証関連入力・結果。認証・清掃参照の確認なしに回収しない。 |
| `tmp/codex-advice-cli-cancellation-20261001` | 実CLI／OS試験の唯一の補助Source。正式Source化と利用側置換後に回収する。 |
| `tmp/codex-advice-formal-verification-20261001-r2`、`codex-advice-provider-image-20261001` | 現在の品質根拠・固定Production入力。正式な必要根拠と入力の非消失確認後に整理する。 |
| `tmp/codex-advice-patch-baseline-20261001` | alias一件を含むため今回の非alias回収集合から除外する。参照先を確認するまで辿ったり削除したりしない。 |
| `tmp/sign-v022-csr-5a2d6b02`、署名記録55File | 唯一署名情報の非消失確認が残る。延期した署名確認の再開前に再評価する。 |
| 直下の認証Tool1・回復Tool26・Provider／回復／認証記録43・Provider試験結果8 | 記録の役割・回復参照を保全する。現在使用中とは断定せず、実E2E再開前に解決状況と必要最小限の記録を再評価する。 |

同日、人間が旧Build21領域の削除を明示承認した。対象Root・祖先の非alias、現在Processの非使用、各Fileの排他読取りを再確認して回収し、21領域すべての不存在を確認した。追加回収は398File・33Directory、4,424,632,119 bytes。今回の清掃累計は4288File・1232Directory、5,722,164,399 bytesとなった。前段の承認待ちは解消済みであり、現在の削除待ちではない。固定Source Archiveと本体ManifestのSHA256は清掃前後で一致した。`tmp`は保全理由を持つ10領域・133直下File、旧`verification`は16領域、`tests`は失敗fixture一件となり、許可された不要物の清掃を完了した。必要入力・未解決原本の全廃はこの完了に含めない。

残した`tests/host-caller-4326d29c-f315-4a4f-8fc0-4d1816873df1`は、人間の再確認指定を受けて内容を照合した。回復記録のruntime／repository／user Hashは試験用の反復文字、対象Identityも試験Sourceと一致する合成値であり、実運用の未解決回復原本ではなかった。現在のSource・設定・状態からの参照とProcess利用はなく、失敗原因と是正は既存文書へ記録済みである。既存の不要物削除許可に基づき、非alias・exact集合20File・排他読取り・非使用を再確認して仮Repositoryを回収した。追加20File・14Directory・29,604 bytes、累計4308File・1246Directory・5,722,194,003 bytes。対象の不存在と`tests`配下が空であることを確認した。先の一件保全は調査中の判断であり、現在の残存一覧ではない。

人間の追加指定により、`template/.crdd`の直下は現行保存先定義の9領域（config、project-runtime、coordinator、execution-intelligence、candidates、release、communication、tests、tmp）を保持する。設定例4件があるconfigには`.gitkeep`を置かず、空の8領域だけを`.gitkeep`で保持する。下位フォルダ・状態・Lock・logは作成しない。廃止済みverificationと旧release-stagingはひな型へ追加しない。現行定義との集合一致、8placeholderの存在、設定例以外の実データ不存在とGit差分の形式を確認した。配布ひな型の空フォルダ保持であり、利用側のRuntime状態をGit追跡する許可ではない。

旧verificationの残りについて、人間は旧E2E4領域の再確認後の回収と、未解決結果5領域の現在情報確認後の回収を指定した。Project RuntimeのqueueEntries・leaseEvidence・leaseIntents・decisionRecoveriesは空、Repository-localと旧OS保存先のCoordinator状態Rootはなく、旧回復Toolは撤去済みRelease候補に依存していた。現在の利用参照がない過去診断として9領域と旧参照Tool4件を回収し、39File・9Directory・200,053 bytesの不存在を確認した。累計4347File・1255Directory・5,722,394,056 bytes。過去のblocked・cleanup不明を成功へ変更せず、実Docker回復・再起動・Provider依頼は行っていない。現在のverification残存はNative試験関連7領域だけであり、固定パス・補助Source・生成物のBefore／Afterを人間へ提示するまで変更しない。

今回の清掃は保存物の処置であり、実装・保証・権限を変更しない。再評価と残存処置はCHG-000082の整理④で追跡し、署名試験や全E2Eの完了と混同しない。

Workbenchを、独自の正本やAuthorityを持たない薄い利用面として実装する。Production形態はTypeScriptのNode localhost ServerとReact Browser UIとし、ViteはBrowser BundleのBuildだけを所有する。同じ画面契約を将来のRemote CROSでも再利用できるようにし、Next.js等のFull-stack FrameworkやElectron等のDesktop包装は現在の成立条件へ含めない。

左上のブランド表示には、[CRDD公式ロゴ](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg)を使用する。文字、仮図形、絵文字または類似アイコンで代替しない。

## 現在状態と構造変更

### 現在の検証と次のWorkbench見直しの順序

人間は、まず現状の設計・実装で必要な局所試験、署名付きE2E、全回帰および独立レビューを完了し、結果と残課題を示して一区切りつける方針を確認した。その後にWorkbenchのUX／IAを再検討する。現状の試験が通ることを、表示スペースと作業導線の十分性の証明とは扱わない。

後続の見直し対象は、表示スペースの役割・情報量・優先順位、表示情報と人間の作業の対応、一覧・詳細・比較・編集の遷移、およびAI相談から人間判断・操作への導線である。現在の検証候補へ未分析のUX変更を混在させず、検証結果の提示後に人間との認識合わせから開始する。見直しの採用内容またはRelease可否をこの順序の確認だけから確定しない。

| 項目 | 変更前 | 変更後 |
|---|---|---|
| Workbench実体 | Visual FixtureとCanonical UI／SPEC Detailだけが存在する | `40_Develop/workbench`がProduction Web Surfaceを所有する |
| Application意味 | CROS、Project Operation、Version Control等に分散した公開契約がある | Workbench Adapterが既存公開契約を利用し、意味やAuthorityを作らない |
| 実行面 | FrameworkとProcess配置が未決 | localhost限定のNode Server＋React Browser UIとし、ViteはBrowser Buildに限定する |
| Branding | Visual Fixtureが公式ロゴを参照する | Production Shellも同じ公式Asset Identityを使用する |
| Desktop包装 | 未定 | 対象外。OS統合上の必要性が実証された場合に別判断する |

詳細設計は[Workbench Architecture](../../../06_Architecture/Details/workbench-server/01_Architecture.md)を正本とする。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`99_Roadmap/Changes/CHG-000082/change.md`](./change.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md`](./Evidence/261002_host-orphan-recovery-design.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_quality-item-reconciliation.md`](./Evidence/261002_quality-item-reconciliation.md)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_native-test-cleanup-preflight.md`](./Evidence/261002_native-test-cleanup-preflight.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/261002_quality-visual-preview-projection.md`](./Evidence/261002_quality-visual-preview-projection.md)
- [`40_Develop/coordinator/src/security/host-orphan-recovery-policy.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/host-orphan-recovery-policy.ts)
- [`40_Develop/coordinator/src/security/host-terminal-record.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/host-terminal-record.ts)
- [`40_Develop/coordinator/src/security/host-terminal-caller-lease.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/host-terminal-caller-lease.ts)
- [`40_Develop/coordinator/src/security/host-terminal-caller-checkpoint.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/host-terminal-caller-checkpoint.ts)
- [`40_Develop/coordinator/src/security/host-terminal-windows-adapter.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/host-terminal-windows-adapter.ts)
- [`40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/host-terminal-record.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts`](https://github.com/qual-lab/CRDD/blob/7c4100bc2e09c32dad26dcf4c2eb82808ec665eb/40_Develop/coordinator/tests/integration/host-terminal-caller-checkpoint.integration.test.ts)
- [`40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts`](https://github.com/qual-lab/CRDD/blob/8640aff422042042fbe5adf71b8c192e167b11b0/40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts)
- [`40_Develop/platform-access/src/terminal_protocol.rs`](https://github.com/qual-lab/CRDD/blob/337319269c5c42338cc006251b7897a360b2414c/40_Develop/platform-access/src/terminal_protocol.rs)
- [`40_Develop/platform-access/src/windows_terminal.rs`](https://github.com/qual-lab/CRDD/blob/337319269c5c42338cc006251b7897a360b2414c/40_Develop/platform-access/src/windows_terminal.rs)
- [`40_Develop/platform-access/src/windows.rs`](https://github.com/qual-lab/CRDD/blob/337319269c5c42338cc006251b7897a360b2414c/40_Develop/platform-access/src/windows.rs)
- [旧参照][`40_Develop/platform-access/src/main.rs`](../../../40_Develop/platform-access/src/main.rs)
- [旧参照][`40_Develop/platform-access/tests/cli.rs`](../../../40_Develop/platform-access/tests/cli.rs)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/docker-isolation.ts)
- [`40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/host-operation-lock-activation.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/host-orphan-recovery-policy.contract.test.ts)
- [`40_Develop/coordinator/tsconfig.strict.json`](../../../40_Develop/coordinator/tsconfig.strict.json)
- [`07_Quality/Definitions/QA-000003/quality_definition.md`](../../../07_Quality/Definitions/QA-000003/quality_definition.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md`](./Evidence/260930-1853_codex-model-host-migration-preflight.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1305_phase5-workbench-selection-binding.md`](./Evidence/260929-1305_phase5-workbench-selection-binding.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1428_phase5-production-selection-contract.md`](./Evidence/260929-1428_phase5-production-selection-contract.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md`](./Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`06_Architecture/07_Detail_Architecture_Map.md`](../../../06_Architecture/07_Detail_Architecture_Map.md)
- [`06_Architecture/99_Coding_Standards.md`](../../../06_Architecture/99_Coding_Standards.md)
- [`06_Architecture/Details/workbench/01_Architecture.md`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/06_Architecture/Details/workbench/01_Architecture.md)
- [`06_Architecture/Details/visual-preview/01_Architecture.md`](../../../06_Architecture/Details/visual-preview/01_Architecture.md)
- [`06_Architecture/Details/ai-runtime/01_Architecture.md`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/06_Architecture/Details/ai-runtime/01_Architecture.md)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](../../../06_Architecture/Details/coordinator/01_Architecture.md)
- [`06_Architecture/Definitions/ARCH-000010/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md)
- [`06_Architecture/Details/mcp/01_Architecture.md`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/06_Architecture/Details/mcp/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`04_UI/04_Visual_and_Accessibility_Direction.md`](../../../04_UI/04_Visual_and_Accessibility_Direction.md)
- [`04_UI/06_Current_Interface_Reference.md`](../../../04_UI/06_Current_Interface_Reference.md)
- [`05_SPEC/07_Current_Behavior_Reference.md`](../../../05_SPEC/07_Current_Behavior_Reference.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Definitions/QA-000001/quality_definition.md`](../../../07_Quality/Definitions/QA-000001/quality_definition.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](../../../07_Quality/Analysis/REQ/quality_analysis.md)
- [`07_Quality/Analysis/UX/quality_analysis.md`](../../../07_Quality/Analysis/UX/quality_analysis.md)
- [`07_Quality/Analysis/UI/quality_analysis.md`](../../../07_Quality/Analysis/UI/quality_analysis.md)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](../../../07_Quality/Analysis/SPEC/quality_analysis.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/verification-runner/src/catalog/test-catalog.ts)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/ai-runtime`](https://github.com/qual-lab/CRDD/blob/337319269c5c42338cc006251b7897a360b2414c/40_Develop/ai-runtime)
- [`40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts`](https://github.com/qual-lab/CRDD/blob/337319269c5c42338cc006251b7897a360b2414c/40_Develop/ai-runtime/tests/integration/ai-profile-consumers.integration.test.ts)
- [`40_Develop/coordinator/src/security/provider-model-profile-runtime.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/provider-model-profile-runtime.ts)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/docker-desktop-repair-native-process-lifecycle.ts)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts)
- [旧参照][`40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-native-helper.contract.test.ts)
- [旧参照][`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts)
- [旧参照][`40_Develop/coordinator/scripts/check-runtime-capability-graph.ts`](../../../40_Develop/coordinator/scripts/check-runtime-capability-graph.ts)
- [旧参照][`40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-execution-plan.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-advice-execution-plan.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-command.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-advice-provider-command.ts)
- [`40_Develop/coordinator/src/security/codex-advice-distribution.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/codex-advice-distribution.ts)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/docker-effect-runtime.ts)
- [`40_Develop/coordinator/src/security/docker-container-init-observation.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/docker-container-init-observation.ts)
- [旧参照][`40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json`](../../../40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json)
- [`40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-output.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-advice-provider-output.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-provider-executor.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-advice-provider-executor.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-runtime-packet.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-advice-runtime-packet.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-advice-production-runtime.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-advice-production-runtime.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/workbench-ai-advice-execution-plan.contract.test.ts)
- [旧参照][`40_Develop/coordinator/tests/integration/advice-profile-catalog-flow.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/advice-profile-catalog-flow.integration.test.ts)
- [旧参照][`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts)
- [`40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-advice-command.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-advice-command.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/provider-advice-output.contract.test.ts`](../../../40_Develop/coordinator/tests/unit/provider-advice-output.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/workbench-ai-advice-provider-executor.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/workbench-ai-advice-runtime-packet.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/workbench-ai-advice-production-runtime.contract.test.ts)
- [`40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts)
- [`40_Develop/coordinator/src/security/workbench-ai-provider-adapter.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/security/workbench-ai-provider-adapter.ts)
- [`40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/coordinator/tests/unit/workbench-ai-provider-adapter.contract.test.ts)
- [旧参照][`40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/claude-subscription-authentication-recovery.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts)
- [旧参照][`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts)
- [`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`](https://github.com/qual-lab/CRDD/blob/bfe6d43e13c6a484dd58a447bc6f2a9566d3cfc9/40_Develop/coordinator/src/composition/project-runtime-composition-root.ts)
- [`40_Develop/workbench/package.json`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/package.json)
- [`40_Develop/workbench/package-lock.json`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/package-lock.json)
- [`40_Develop/workbench/tsconfig.json`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/vite.config.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/vite.config.ts)
- [`40_Develop/workbench/symbol.json`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/symbol.json)
- `40_Develop/workbench/client/entry-client.ts`（削除）
- [`40_Develop/workbench/client/entry-client.tsx`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/client/entry-client.tsx)
- [`40_Develop/workbench/client/workbench-app.tsx`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/client/workbench-app.tsx)
- [`40_Develop/workbench/client/workbench-ai-request-panel.tsx`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/client/workbench-ai-request-panel.tsx)
- [`40_Develop/workbench/client/workbench-projection-panels.tsx`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/client/workbench-projection-panels.tsx)
- [`40_Develop/workbench/src/presentation/workbench-client-model.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/presentation/workbench-client-model.ts)
- [`40_Develop/workbench/src/presentation/workbench-components.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/presentation/workbench-components.ts)
- [`40_Develop/workbench/bin/workbench.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/bin/workbench.ts)
- [`40_Develop/workbench/src/index.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/index.ts)
- [`40_Develop/workbench/src/ai-profile-surface.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/ai-profile-surface.ts)
- [`40_Develop/workbench/src/ai-request.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/ai-request.ts)
- [`40_Develop/workbench/src/credential-administration.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/credential-administration.ts)
- [`40_Develop/workbench/src/project-plan-surface.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/project-plan-surface.ts)
- [`40_Develop/workbench/src/project-surface.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/project-surface.ts)
- [`40_Develop/workbench/src/quality-surface.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/quality-surface.ts)
- `template/tools/coordinator/coordinator-package-manifest.json`（削除）
- [`40_Develop/workbench/src/remote-topic-meeting.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/remote-topic-meeting.ts)
- [`40_Develop/workbench/src/runtime-activity.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/runtime-activity.ts)
- [`40_Develop/workbench/src/owner-artifact-surface.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/owner-artifact-surface.ts)
- [`40_Develop/workbench/src/workbench-server.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/workbench-server.ts)
- [`40_Develop/workbench/scripts/workbench-ai-verification-http.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/scripts/workbench-ai-verification-http.ts)
- [`40_Develop/workbench/tsconfig.json`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/src/presentation/workbench-shell.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/src/presentation/workbench-shell.ts)
- [`40_Develop/workbench/tests/integration/project-surface.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/tests/integration/project-surface.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-server.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/tests/integration/workbench-server.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/tests/integration/workbench-node-dependency-closure.contract.test.ts)
- [`40_Develop/workbench/dist/client/assets/workbench-client.js`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/dist/client/assets/workbench-client.js)
- [`40_Develop/workbench/tests/system/workbench-visual.integration.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/workbench/tests/system/workbench-visual.integration.test.ts)
- [`40_Develop/visual-preview/src/browser-zoom-verifier.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/visual-preview/src/browser-zoom-verifier.ts)
- [`40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts`](../../../40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md`](./Evidence/260928-1745_phase5-workbench-pure-csr.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260928-2354_phase5-pure-csr-runtime-closure.md`](./Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-0025_phase5-signed-csr-distribution-closure.md`](./Evidence/260929-0025_phase5-signed-csr-distribution-closure.md)
- [`99_Roadmap/Changes/CHG-000082/Evidence/260929-1123_phase5-mount-grant-fresh-observation.md`](./Evidence/260929-1123_phase5-mount-grant-fresh-observation.md)
- [`.gitignore`](../../../.gitignore)
- [`40_Develop/cros/src/project-federation.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/project-federation.ts)
- [`40_Develop/cros/src/connection-credential.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/connection-credential.ts)
- [`40_Develop/cros/src/credential-access-recovery.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/credential-access-recovery.ts)
- [`40_Develop/cros/src/credential-access-recovery-file-adapter.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/credential-access-recovery-file-adapter.ts)
- [`40_Develop/cros/src/credential-access-recovery-cli.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/credential-access-recovery-cli.ts)
- [`40_Develop/cros/bin/cros-access-recovery.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/bin/cros-access-recovery.ts)
- [`40_Develop/cros/src/remote-transport.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/remote-transport.ts)
- [`40_Develop/cros/src/runtime.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/40_Develop/cros/src/runtime.ts)
- [`40_Develop/cros/src/index.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/src/index.ts)
- [`40_Develop/cros/tests/integration/connection-credential.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/tests/integration/connection-credential.contract.test.ts)
- [`40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/tests/integration/credential-registry-file-adapter.contract.test.ts)
- [`40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/tests/integration/credential-access-recovery-file-adapter.contract.test.ts)
- [`40_Develop/cros/tests/integration/project-federation.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/tests/integration/project-federation.contract.test.ts)
- [`40_Develop/cros/tests/integration/remote-transport.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/tests/integration/remote-transport.contract.test.ts)
- [`40_Develop/cros/tests/system/session-access.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/tests/system/session-access.contract.test.ts)
- [`40_Develop/cros/symbol.json`](https://github.com/qual-lab/CRDD/blob/378d93cb6ffb0cc7c9561e0572d62bdd656f3312/40_Develop/cros/symbol.json)
- [`40_Develop/mcp/src/protocol/project-runtime-protocol.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/protocol/project-runtime-protocol.ts)
- [`40_Develop/mcp/src/protocol/project-context-protocol.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/protocol/project-context-protocol.ts)
- [`40_Develop/mcp/src/protocol/topic-meeting-protocol.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/protocol/topic-meeting-protocol.ts)
- [`40_Develop/mcp/src/adapters/application-adapter.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/adapters/application-adapter.ts)
- [`40_Develop/mcp/src/adapters/project-context-adapter.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/adapters/project-context-adapter.ts)
- [`40_Develop/mcp/src/adapters/topic-meeting-adapter.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/adapters/topic-meeting-adapter.ts)
- [`40_Develop/mcp/src/composition/cros-project-context-application.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/composition/cros-project-context-application.ts)
- [`40_Develop/mcp/src/transports/request-handler.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/transports/request-handler.ts)
- [`40_Develop/mcp/src/transports/stdio-transport.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/transports/stdio-transport.ts)
- [`40_Develop/mcp/src/transports/streamable-http-transport.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/transports/streamable-http-transport.ts)
- [`40_Develop/mcp/src/index.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/src/index.ts)
- [`40_Develop/mcp/symbol.json`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/symbol.json)
- [`40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/tests/unit/project-context-adapter.contract.test.ts)
- [`40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/tests/integration/topic-meeting-adapter.contract.test.ts)
- [`40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/tests/integration/cros-project-context-mcp.integration.test.ts)
- [`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/tests/system/stdio-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/tests/system/streamable-http-transport.integration.test.ts)
- [`40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/3ea50c54f72127d1cfcccacd6591e0912beb5b06/40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts)
- [`template/tools/crdd-mcp.ts`](https://github.com/qual-lab/CRDD/blob/b8fad5349f3882d89c4dbbc31a86a2cced05f3d8/template/tools/crdd-mcp.ts)
- [`40_Develop/project-operation/src/index.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/src/index.ts)
- [`40_Develop/project-operation/src/repository-project-context.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/src/repository-project-context.ts)
- [`40_Develop/project-operation/src/topic-meeting.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/src/topic-meeting.ts)
- [`40_Develop/project-operation/src/topic-meeting-repository.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/src/topic-meeting-repository.ts)
- [`40_Develop/project-operation/src/topic-meeting-application.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/src/topic-meeting-application.ts)
- [`40_Develop/project-operation/symbol.json`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/symbol.json)
- [`40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/tests/integration/topic-meeting-repository.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts`](https://github.com/qual-lab/CRDD/blob/8af65cdd94b45b424ef8c23d3e2600a50cdcdfd7/40_Develop/project-operation/tests/integration/topic-meeting-application.contract.test.ts)
- [旧参照][`40_Develop/version-control/src/change-publication.ts`](../../../40_Develop/version-control/src/change-publication.ts)
- [旧参照][`40_Develop/version-control/src/git/change-publication-adapter.ts`](../../../40_Develop/version-control/src/git/change-publication-adapter.ts)
- [`40_Develop/version-control/src/index.ts`](../../../40_Develop/version-control/src/index.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/version-control/tests/integration/change-publication.integration.test.ts`](../../../40_Develop/version-control/tests/integration/change-publication.integration.test.ts)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts)
- [`template/22_Topics/_Template/topic.md`](../../../template/22_Topics/_Template/topic.md)
- [`template/23_Meetings/_Template/meeting.md`](../../../template/23_Meetings/_Template/meeting.md)
- [`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)
- [`Evidence/260927-1733_phase1-production-shell.md`](./Evidence/260927-1733_phase1-production-shell.md)
- [`Evidence/260927-1748_phase2-project-context-reader.md`](./Evidence/260927-1748_phase2-project-context-reader.md)
- [`Evidence/260927-1759_topic-meeting-record-contract.md`](./Evidence/260927-1759_topic-meeting-record-contract.md)
- [`Evidence/260927-1812_phase2-read-only-project-surface.md`](./Evidence/260927-1812_phase2-read-only-project-surface.md)
- [`Evidence/260927-1836_phase3-change-publication-it.md`](./Evidence/260927-1836_phase3-change-publication-it.md)
- [`Evidence/260927-1845_phase3-repository-work.md`](./Evidence/260927-1845_phase3-repository-work.md)
- [`Evidence/260927-1921_phase4-credential-administration.md`](./Evidence/260927-1921_phase4-credential-administration.md)
- [`Evidence/260927-1939_phase4-remote-transport.md`](./Evidence/260927-1939_phase4-remote-transport.md)
- [`Evidence/260927-1945_phase4-workbench-remote-connection.md`](./Evidence/260927-1945_phase4-workbench-remote-connection.md)
- [`Evidence/260927-1954_phase4-workbench-connection-surface.md`](./Evidence/260927-1954_phase4-workbench-connection-surface.md)
- [`Evidence/260927-1959_mcp-runtime-state-tool-name.md`](./Evidence/260927-1959_mcp-runtime-state-tool-name.md)
- [`Evidence/260927-2014_phase4-project-context-mcp.md`](./Evidence/260927-2014_phase4-project-context-mcp.md)
- [`Evidence/260927-2022_phase4-test-catalog-closure.md`](./Evidence/260927-2022_phase4-test-catalog-closure.md)
- [`Evidence/260927-2029_phase4-remote-project-context-mcp.md`](./Evidence/260927-2029_phase4-remote-project-context-mcp.md)
- [`Evidence/260927-2037_topic-meeting-repository-crud.md`](./Evidence/260927-2037_topic-meeting-repository-crud.md)
- [`Evidence/260927-2055_topic-meeting-workbench-mcp-crud.md`](./Evidence/260927-2055_topic-meeting-workbench-mcp-crud.md)
- [`Evidence/260927-2120_meeting-outcome-treatment.md`](./Evidence/260927-2120_meeting-outcome-treatment.md)
- [`Evidence/260927-2157_ai-profile-catalog.md`](./Evidence/260927-2157_ai-profile-catalog.md)
- [`Evidence/260927-2257_phase5-screen-reality-audit.md`](./Evidence/260927-2257_phase5-screen-reality-audit.md)
- [`Evidence/260927-2303_phase5-runtime-activity.md`](./Evidence/260927-2303_phase5-runtime-activity.md)
- [`Evidence/260927-2309_phase5-owner-artifact-surface.md`](./Evidence/260927-2309_phase5-owner-artifact-surface.md)
- [`Evidence/260927-2324_phase5-runtime-activity-composition.md`](./Evidence/260927-2324_phase5-runtime-activity-composition.md)

</details>

## 想定する影響

- コンテキスト: Project／Portfolio、Topic／Meeting、Quality、正本Relation、AI依頼、Repository Worktree、接続設定
- 成果物: Workbench Architecture、Quality Analysis／Definition、Production Source、Test、Evidence
- 利用者 / 運用: Developer、Project Operator、PM、Management、Administratorが同じ入口を役割内で利用する
- データ / インターフェース / 移行: 既存CROS／Project Operation／Version Control公開契約を利用し、Workbench専用正本を追加しない
- セキュリティ / プライバシー / コスト: localhost既定、Repository／Session Authorityを再評価せず、非開示情報を推測しない。Desktop Runtime依存は追加しない

## 対象外 / 変更してはならないこと

現在品質の一項目適用、旧集計の不整合と採用Scopeの再照合は[品質投影記録](Evidence/261002_quality-visual-preview-projection.md)を参照する。この記録更新からSource、検証義務、AuthorityまたはRelease Scopeを変更しない。

- 対象外: Electron等のDesktop包装、Force Push、Merge、Rebase、通常Discard、Workbench内会話履歴の正本化、本格Trust Policy管理
- 変更してはならないこと: CROS／Project Operation／Version ControlのAuthority、Project ContextのOwner、非開示Sourceの存在秘匿、CHG-000081で固定したDirection Aと公式ロゴの使用

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 新しい利用者入口、Process、HTTP境界およびRepository Effectを追加する | 各Phase Gateと独立レビュー |
| 変更する契約母集団 | Applicable | Workbench UI／SPEC Detail、関連Architecture、Quality、公開Application Contract | Phase 0／1で固定する |
| 既知の利用側母集団と対象別の予定処置 | Applicable | Local Browser、将来Remote CROS、Repository単体利用 | Screen／入口別のSystem試験で確認する |
| 安全上重要な層間搬送 | Applicable | UI操作から既存Application Contract、Version Control Effectへの搬送 | 書込みPhaseでEffect前後を確認する |
| 保護対象Effect／Recoveryの耐久Authority | Applicable | Commit／Push、Credential管理は既存Authorityだけを使う | Effect実装前に再照合する |
| 残存資源／Recovery／Authority義務を伴う取得transaction | Applicable | HTTP listener、Browser request、Git process、Remote session | Integration／System試験で確認する |
| 発火例／非発火例／境界例／情報不足例 | Applicable | Local／Remote、権限あり／なし、部分観測、結果不明を分ける | Screenごとの契約試験 |
| 定義・発火条件・判定不能・正式結果の分離 | Applicable | loading／empty／partial／restricted／unknown／failedを正常へ畳まない | UI stateとApplication結果の照合 |
| 固定前の実差分照合 | Applicable | Source追加前にArchitecture／Qualityを固定する | 各実装Phase開始前 |
| 根拠の主張軸（入口形態） | Applicable | Repository単体、Local CROS、Remote CROSで可用能力が異なる | Public Surface E2E |
| 根拠の主張軸（観測基盤） | Applicable | DOM、HTTP、Application Contract、Git／Remote境界を分ける | Verification Design |
| 根拠の主張軸（成果物Identity） | Applicable | UI／BHV／ARCH／QA／Source／Test／Evidenceを接続する | Reality Audit |
| 根拠の主張軸（lifecycle） | Applicable | Server開始、要求、Effect、結果、shutdown、資源0を分ける | Host E2E |
| 未解消の不一致 | OPEN | UI／CSR画面、Application Contract、実データ、Production全Profile STおよびShared Server運用境界は接続済み。Project Runtime公開MCPはRun `2e55c8cd2897464b`で通常二経路・取消・exact Recovery・最終回復在庫確認まで合格した。旧取消Oracleおよび終了後Observer接続の不一致は是正・独立確認済みである。Workbench実Provider、必要な四経路、残る個別品質項目および最終配布署名は未完了である | 未完了の実境界と個別品質項目を確認し、最終固定候補の回帰・独立レビュー・再署名後にRelease判断へ渡す |

## 変更経路の計画

- 適用判定: `Applicable`: Architecture Detail、Quality、Development、Reality Auditを順に進める
- 計画した主な工程 / 共通責務: Reality Audit→Architecture Detail→Quality義務→Production Skeleton→読取り面→書込み面→Remote接続→E2E
- 選択理由: Canonical Detailを既存WIPへ合わせず、既存公開契約を利用する最小Surfaceとして実装するため
- 予定する検証: Formatter、型、Lint、単体／結合／System、実Browser visual profile、Repository Checker、独立レビュー
- 判断上重要だが選ばなかった主な経路と理由: Electron先行は包装と配布の責務を増やし、現時点の利用者成果に必要ないため採用しない

## Phase／Gateと途中拡張

### 適用判断

| 評価対象 | 判定 | 理由 |
|---|---|---|
| Phase／Gate | Applicable | 読取りSurfaceとRepository／Credential Effectを同時に完成扱いしないため |

### PhaseとGate

| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |
|---|---|---|---|---|---|
| Phase 0: Reality Audit／Production Boundary | 現行実装、再利用契約、配置、素材、対象外を固定する | CHG、Architecture Detail、Map | Current Reality照合、Repository Checkerの構造・Relation検査 | 第二正本・Authority生成0、利用する公開契約と実行面が一意 | Passed |
| Phase 1: Production Skeleton | localhost ServerとBrowser Shellを成立させる | `40_Develop/workbench` | 静的確認、Server lifecycle、Browser smoke、公式ロゴ読込 | 公開入口からDirection A Shellを表示し、shutdown後資源0 | Passed |
| Phase 2: Read-only Project Surface | Project／Portfolio／Topic／Meeting等を公開契約から表示する | Adapter、View Model、Screens | Contract／System／Accessibility | 欠測・制限・部分成功を保持して主要読取りFlowが成立 | Passed |
| Phase 3: Repository Work | Tree／Diff／Stage／Commit／通常Pushを接続する | Version Control Adapter、確認Flow | Effect前後、失敗、結果不明、回復 | Force Push 0、暗黙再送0、選択差分だけを処置 | Passed |
| Phase 4: Connection／AI Surface | Local／Remote接続、Role別Credential、AI依頼面を接続する | CROS／Runtime Adapter | Authority、Disclosure、Session lifecycle | User管理を追加せず、許可範囲だけで同じ契約を利用 | Passed |
| Phase 5: Production Closure | 15 Screen範囲、Visual、E2E、Reality Auditを閉じる | 全Production Surface | 全回帰、実Browser、独立レビュー | Blocking Finding 0、未観測を明示しRelease判断へ引渡し可能 | In Progress |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| 通常producerの共有管理DirectoryとNativeの固定保護条件が一致しなかった | 同じHost回復責務の局所不一致として調査したが、現Directoryから他利用者の実変更可能性までは実証していない | 当初、保護付き作成と限定ACL移行の設計・実装・試験を追加した。現在は追加拡張を止め、固定E2Eと再現した失敗を優先する | 追加基盤の完成を保存済み署名Runtimeの固定E2E開始の一律前提にしない。旧三件や回復全体の未成立を消去しない | ACL移行案は取り下げ、現在の承認質問にしない。権限変更・共有OS作成・旧三件削除は未実施 | 過去の局所確認と配布128試験を保持し、製品全体の完成へ一般化しない。[現在の方針](Evidence/261004_workbench-e2e-restart.md)、[旧比較](Evidence/261002_host-orphan-recovery-design.md#共有管理フォルダの保護不一致と次の判断--2026-10-04) |
| 既存Host残存一件に、既知の`workspace/fixture.txt`、7bytesが存在した。2026-10-04に人間が限定設計への追加を承認した | 元の回復参照がない同じHost残存を安全に処置する責務の具体的な反例であり、汎用非空清掃の追加ではない | Phase 5の限定Recoveryへ指定file一件を別クラスとして追加。空クラス・現行十一実体Schemaは緩めない | 十二実体・同handle内容／リンク数確認・fileからの非再帰処置・部分再入場を設計、実装、Qualityへ接続する。全体Gateと新実Task停止は維持する | 人間は、この作業の試験以外でCoordinatorを利用していないことと設計対象への追加を回答した。これはProcess終了、非使用、実停止・削除の承認ではない | 専用codec、観測、Native保存／読戻し、Adapter・callerと記録準備をSource接続した。空TEMP／TMPの実所在取得停止をHost専用環境で是正し、30 Host UT／8 caller IT／9 Windows Adapter UTと選択3契約が成功した。読み取り専用実診断は専用保存子Directory欠落で停止した。初期化入口・正常固定OS保存・本番再入場・公開処置は未成立。[現在の結果](Evidence/261002_host-orphan-recovery-design.md#十二実体の記録準備と実環境の保存境界--2026-10-04) |
| 元の回復参照を確定できない空のHost残存が観測され、同じCHGで限定保守経路を追加する人間判断を得た | 実Provider検証後の残存から安全に回復できない、既存Recovery責務の欠落であり、新しい汎用清掃Capabilityではない | Phase 5へ空のhost_onlyに限る対象確認・fresh承認・非使用確認・限定処置・不存在観測を追加 | 新実Task停止を維持する。候補判定、実観測、Authority、実処置、公開入口および全資源観測を分けて閉じる。局所UTをRecovery完成へ読み替えない | 設計・実装・局所反証・独立確認は本対話で承認済み。2026-10-03にCoordinator所有範囲の終了・利用抑止・排他で閉じる方向を確認し、Windows再起動を前提にしない。実在三件の削除、元Token生成、実Process停止、Provider再送、Docker再起動、Releaseは含めない | 第一単位は候補設計とAuthorityを発行しない内部Policy。全利用側と旧形式の閉包、作成前排他、OS処置境界・再入場はOPEN。方式の採否待ちではなく承認範囲内の再設計中。[現在記録](Evidence/261002_host-orphan-recovery-design.md) |
| 署名済み実境界で障害修復Protocolが意図的に返す公式停止の未発行を上位Runtimeが失敗扱いした | Workbench AI実Provider E2Eを成立させるDocker境界のProduction Closureであり、同じIntent内の実境界Gapである | Phase 5へ障害修復の`not_issued`受理契約是正を追加 | Repairでは公式停止を発行せず、上位Runtimeが`false / not_issued`だけを正常分岐として受理する局所契約試験、署名済み修復、Host Windows回帰を追加 | 既存の修復ID・耐久記録・Trust・削除禁止を維持し、`true / unknown`を成功へ補正しない | 対応中 |
| Workbenchの将来展開を踏まえ、表示層をReact＋Viteへ固定する人間判断を得た | Project Context、Topic／Meeting、Repository、AIおよびShared Serverを一つのWorkbenchへ展開する同じProduction Intentであり、別Capabilityではない | Phase 5へVite Browser Build、固定Asset配信および既存15画面のReact移行を追加 | Node側のAuthorityとHTTP操作契約を維持し、CSR、JSON Read Model、CSP、allowlist、既存IT、実Browser Visualを再確認する。全画面Component化前を移行完了と表示しない | React＋Vite採用は本対話で確認済み。Next.js、Electron、業務AuthorityのClient移動は対象外 | 実装・直接検証・独立レビュー済み。Phase 5全体の実Provider E2Eは継続 |
| 段階移行境界やSSRとの二重管理を残さず、既存15画面本体をClient-side React Componentへ移行する人間判断を得た | React＋ViteをWorkbenchのProduction表示基盤として固定する同じIntentの完結条件であり、新しい利用者Capabilityではない | Phase 5へ全画面CSR、JSON Read Model境界、Raw HTML Fragment廃止、SSR／Hydration廃止およびBrowser DOM再読取り廃止を追加 | 既存15画面、Form、Action Token、権限、Server Effect、同一Origin／CSP、3表示Profile×3 Zoomを不変条件として再検証する。旧署名候補は移行前Evidenceとしてのみ保持し、移行後に新しい固定候補を作る | 本対話でスコープ拡大とSSR不採用を確認済み。Clientへの業務Authority移動、Next.js、Electronは引き続き対象外 | 実装・直接検証・独立レビュー済み。Phase 5全体の実Provider E2Eは継続 |
| 純粋CSR移行後の署名候補を直接起動すると、Node実行グラフが旧SurfaceのReact rendererへ到達し、空のAI Profile Storeが返す既定Catalog Revision 0を実行計画が拒否した | 署名配布物と実Provider E2Eを成立させる同じWorkbench Production Closureであり、新しい利用者Capabilityではない | Phase 5へBrowser-only Panel分離、Node依存閉包検査、Revision 0のStore→Composition→Dispatch統合試験およびJSON境界の整数検証を追加 | Server RuntimeからReact value依存を除外し、既定Catalogの初期Revision 0だけをexactに受理する。負数・小数・破損・観測不能は拒否し、最初の採用だけをRevision 1とする | SSR再導入、Node DOM所有、Revisionの暗黙補正は対象外。現行方針のまま是正可能なため追加判断なし | 局所型・Lint・Build、Workbench統合20件、Coordinator局所11件をPass。不連続Revisionと連続Revisionの破損Envelopeは独立反証とし、どちらもEffect前に拒否する。署名候補の直接起動と実Provider E2Eは後続で再固定する |
| 純粋CSR修正後のSource Commitを署名できたが、署名stagingにVite生成済みBrowser Bundleが存在せずWorkbenchを直接起動できなかった | 署名済みWorkbenchを利用者入口から起動する同じProduction Closureであり、CSR Sourceだけの成立を配布成立へ誤認しないため | Phase 5へ固定Browser BundleのGit追跡・署名Tree収載契約を追加 | Vite生成結果を設計正本へ昇格せず、固定Pathの派生AssetをSource Commitへ収載する。Build再実行後も追跡Bundleが一致し、Manifest除外Source Treeから直接起動できることを要求する | Runtime Build、Node側React import、署名後の未追跡Asset追加は対象外。現在方針の完結に必要な一意修正であり追加判断なし | `.gitignore`の包括除外を廃止し、固定Bundleを追跡対象へ追加した。Git追跡集合を検査する`ERB-IT-021`を追加し、Workbench 21／21 Pass。旧署名候補はSource／配布閉包不一致のため流用しない |
| 署名候補の実Provider E2EがMount Grant消費前に`workbench_ai_advice_mount_authorization_unavailable`で停止した | 既存Architectureが要求する一回限り観測Capabilityとfresh再観測を、本番助言Runtimeへ接続する同じProduction Closureである | Phase 5へMount Grant発行後・消費前のProvider Home再観測を追加 | 発行用観測と消費用fresh観測を別Capabilityとして局所反証し、再観測不能ではGrant消費0・Provider Effect 0・Operation cleanup完了を要求する。修正後の署名候補で実Provider E2Eを再実行する | Provider Home契約、Mount Grant TTL、Repository非共有、外部送信許可範囲は変更しない。既存契約へ一意に整合するため追加判断なし | 実装・局所試験・型検査・Coordinator Portable全回帰・独立確認済み。再署名、実Provider E2Eは継続 |
| Mount修正後の署名候補が次のSelection境界で`workbench_ai_advice_selection_unavailable`に停止した | Workbench専用助言Operationが一般Selection Runtimeの必須Repository結合と、Selection Grantを必要とする明示委譲の要求意味を欠いていた。設計済みのMount前／Effect直前二段階Selectionも未接続だった。同じProduction Closure内の接続Gapである | Phase 5へ元Repository Identity結合、Selection再発行Lifecycleおよび明示委譲Selection要求を追加 | 一般SelectionのRepository結合条件と`none`のGrant非発行契約を弱めず、元RepositoryをOperationへ内部結合する。Workbenchの明示Provider／Profile選択を`beneficial`かつ`explicit_user_delegation`として要求する。Mount前の初回SelectionをMount後に失効し、同じ入力による再SelectionのProvider、Profile、Model、推論強度、速度および理由が完全一致する場合だけEffectへ進む。発行済みSelectionは意味検証前からcleanup対象として保持し、旧Selection失効失敗と不正な再SelectionをAuthority残存不明へ閉じる。Production接続を局所反証し、修正後署名候補でE2Eを再実行する | Repository／WorkspaceのProvider Mount、Path搬送、任意読取りAuthority、Selection TTL、`none`経路および外部送信許可範囲は変更しない。既存Architectureへ一意に整合するため追加判断なし | Production Selection対象35／35、型・Lint・Capability Graph／Traceability、Workbench 21／21、Portable 2,117件中2,112 Pass／5 Explicit Skip／0 Fail。是正後候補の独立確認、再署名、実Provider E2Eは継続 |
| Repository結合・二段階Selection修正後の署名候補も初回Selectionで`workbench_ai_advice_selection_unavailable`に停止した | WorkbenchがProduction Selection契約へ渡す要求意味の接続Gapであり、同じ助言Production Closureの継続である | Phase 5へWorkbench Selection要求契約とProduction直接結合試験を追加 | Selection Grantを必要とする明示AI実行を`none`へ畳まず、`beneficial`／`explicit_user_delegation`、明示Provider／Profile、Coordinator役割、Operation chainを含む閉じた要求Objectを渡す。Mock fixtureで余分なPropertyを含めて完全比較し、Productionが生成した初回・再発行要求を実Selection Runtimeへ渡して旧Grant失効、新Grant消費およびProvider準備までを反証する | `none`のGrant不要契約、Profile選択、Repository非共有、外部送信許可およびProvider Effect Gateは変更しない。既存契約へ一意に整合するため追加判断なし | 局所35／35、型・Lint・Capability Graph／Traceability、Portable 2,117件中2,112 Pass／5 Explicit Skip／0 Fail。是正後独立確認、再署名および実Provider E2Eは継続 |
| 署名実Provider E2Eが17件の不一致で停止した | 実Provider境界を成立させる同じProduction Closureであり、17件は独立した新Capabilityではなく、Provider境界診断の閉集合、正規Candidate Identityの利用側互換、人間受入待ちの期待値という3つの契約ずれから派生していた | Phase 5へLifecycle診断の設定・開始・終了Event分離、Candidate Identity非縮退、`integration_pending`終端のE2E期待を追加 | 既知Lifecycle Eventを違反へ誤分類せず、同じOperationへ相関する。Canonical Candidate IDをIntegration Recordまで完全保持する。Task完了・候補採用をObjective／Milestone受入へ昇格せず、人間の明示受入は別Capabilityに維持する | Docker Desktop内部socket障害との時間的相関は有力仮説として分離し、CRDD原因と断定しない。受入Authority、外部送信範囲、Provider HomeおよびDocker Recovery契約は変更しない | Source、Architecture、Qualityおよび局所契約を是正。局所33／33、Portable 2,120件中2,112 Pass／8 Explicit Skip／0 Fail、Host Windows 93／93、独立確認Finding 0。再署名および実Provider E2Eは継続 |
| 再署名後の実Provider E2Eで正常2経路は成立したが、取消経路に2件の不一致が残った | stdio EOFは親Transport喪失による取消要求であり、取消完了ではない。Productionは終了観測不能を`blocked / unknown`とexact Runtime Process Recovery義務へ閉じたが、検証Oracleだけが即時`cancelled / settled`を要求していた | Phase 5の検証OracleとE2E所有fixture清掃を改訂 | 取消要求、Provider／Process終了、結果、cleanupを分離し、不明時は一意なRecovery義務と最終Inventory cleanを必須にする。E2Eが所有する既知fixture変更だけを開始前内容へ戻す | 公開MCPへ新しい取消Toolを追加せず、Transport喪失、取消要求、取消完了およびRecoveryを混同しない。Productionの保守的な停止契約を弱めない | 静的検査一式、Portable 2,120件中2,112 Pass／8 Explicit Skip／0 Fail、Host Windows 10／10、局所System 30／30、独立確認Finding 0。再署名実Provider E2Eおよび四経路E2Eは継続 |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| N/A: 現時点で途中見直しなし | N/A | N/A | N/A | UI／SPEC Detailと既存公開契約 | N/A |

## 変更影響の伝播確認

- 情報源の改訂版: CHG-000081 Phase 6 Passed
- 監査結果の参照: CHG-000081独立レビューFinding 0
- 上流 / 同層の正本更新: Workbench Architecture Detailを追加した
- 下流影響の再探索: Quality、Development、Test Catalog、Reality AuditをPhase順に更新する
- 再監査の結果: Phase 0固定候補で実施する
- 伝播例外: N/A: 例外なし

## 実装の参照

- [`40_Develop/workbench-server`](../../../40_Develop/workbench-server)
- 公開API: `startWorkbench`
- CLI: `node 40_Develop/workbench-server/bin/workbench-server.ts`

## 検証

- 検証義務: Workbench Architecture Detailの8導出キーを既存Quality目標へ接続し、Production境界を`ERB-IT-021`、Production DOMを`ERB-ST-022`へ分けた
- 検証設計: localhost直接境界ITと実Browser System／E2Eを分離した
- 結果参照: [Phase 1 Production Shell](./Evidence/260927-1733_phase1-production-shell.md)、[Phase 2 Project Context Reader](./Evidence/260927-1748_phase2-project-context-reader.md)、[Topic／Meeting Record Contract](./Evidence/260927-1759_topic-meeting-record-contract.md)、[Phase 2 Read-only Project Surface](./Evidence/260927-1812_phase2-read-only-project-surface.md)、[Phase 3 Change Publication IT](./Evidence/260927-1836_phase3-change-publication-it.md)、[Phase 3 Repository Work](./Evidence/260927-1845_phase3-repository-work.md)、[Phase 4 Project Context MCP](./Evidence/260927-2014_phase4-project-context-mcp.md)、[Phase 4 試験台帳の閉包確認](./Evidence/260927-2022_phase4-test-catalog-closure.md)、[Phase 4 AI Profile Catalog](./Evidence/260927-2157_ai-profile-catalog.md)、[Phase 4 Workbench AI依頼Port](./Evidence/260927-2210_workbench-ai-request-port.md)、[Phase 5 15画面Reality Audit](./Evidence/260927-2257_phase5-screen-reality-audit.md)、[Phase 5 Runtime Activity](./Evidence/260927-2303_phase5-runtime-activity.md)、[Phase 5 Owner Artifact Surface](./Evidence/260927-2309_phase5-owner-artifact-surface.md)、[Phase 5 Runtime Activity実構成](./Evidence/260927-2324_phase5-runtime-activity-composition.md)、[Phase 5 Project Plan構造化投影](./Evidence/260927-2337_phase5-project-plan-projection.md)、[Phase 5 Quality構造化投影](./Evidence/260927-2350_phase5-quality-projection.md)、[Phase 5 Documentation検索](./Evidence/260927-2352_phase5-documentation-search.md)、[Phase 5 Runtime Activity閉包](./Evidence/260928-0014_phase5-runtime-activity-closure.md)、[Phase 5 Topic／Meeting Collection／Detail](./Evidence/260928-0031_phase5-topic-meeting-collection-detail.md)、[Phase 5 Repository Tree／Diff](./Evidence/260928-0044_phase5-repository-tree-diff.md)、[Phase 5 Topic／Meeting Relation遷移](./Evidence/260928-0053_phase5-topic-meeting-relation-navigation.md)、[Phase 5 Topic→CHG昇格接続](./Evidence/260928-0105_phase5-topic-change-promotion.md)、[Phase 5 Project Portfolio遷移](./Evidence/260928-0115_phase5-project-portfolio-navigation.md)、[Phase 5 AI結果Provenance](./Evidence/260928-0207_phase5-ai-result-provenance.md)、[Phase 5 現在の15画面Reality Audit](./Evidence/260928-0243_phase5-current-screen-reality-audit.md)
- 追加結果参照: [Phase 5 Remote CROS Topic／Meeting Routing](./Evidence/260928-0253_phase5-remote-topic-meeting-routing.md)
- 追加結果参照: [Phase 5 Repository間Owner Relation](./Evidence/260928-0305_phase5-cross-repository-owner-relation.md)
- 追加結果参照: [Phase 5 Remote Workbench Topic／Meeting](./Evidence/260928-0325_phase5-remote-workbench-topic-meeting.md)
- 追加結果参照: [Phase 5 Workbench AI一回送信境界](./Evidence/260928-0415_phase5-workbench-ai-send-boundary.md)
- 追加結果参照: [Phase 5 Workbench Provider Adapter](./Evidence/260928-0425_phase5-workbench-provider-adapter.md)
- 追加結果参照: [Phase 5 署名Runtime閉包と助言Execution Plan](./Evidence/260928-0439_phase5-signed-runtime-closure-and-advice-plan.md)
- 追加結果参照: [Phase 5 Provider Command／Output境界](./Evidence/260928-0500_phase5-provider-command-and-output-boundary.md)
- 追加結果参照: [Phase 5 読取り助言Runtime Packet](./Evidence/260928-0530_phase5-advice-runtime-packet.md)
- 追加結果参照: [Phase 5 `workbench_advice` Docker境界](./Evidence/260928-0600_phase5-workbench-advice-docker-boundary.md)
- 追加結果参照: [Phase 5 読取り助言Production Runtime](./Evidence/260928-0635_phase5-workbench-advice-production-runtime.md)、[Phase 5 Workbench変更候補Production Runtime](./Evidence/260928-0715_phase5-workbench-change-candidate-runtime.md)、[Phase 5 AI二画面の現在Reality Audit](./Evidence/260928-0725_phase5-ai-screen-reality-audit.md)、[Phase 5 AI Runtime Package Closure](./Evidence/260928-0750_phase5-ai-runtime-package-closure.md)、[Phase 5 変更候補の採否境界](./Evidence/260928-0911_phase5-candidate-disposition.md)
- 追加結果参照: [Phase 5 Workbench実Browser Visual Gate](./Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)
- 追加結果参照: [Phase 5 React＋Vite Shell移行](./Evidence/260928-1535_phase5-react-vite-shell-migration.md)（SSR／Hydrationを使用していた移行途中の履歴Evidence。現行表示構造は後続の純粋CSR Evidenceが置き換える）
- 追加結果参照: [Phase 5 Docker Process終了全体期限](./Evidence/260928-1543_phase5-docker-process-termination-budget.md)
- 追加結果参照: [Phase 5 Workbench純粋CSR移行](./Evidence/260928-1745_phase5-workbench-pure-csr.md)
- 追加結果参照: [Phase 5 純粋CSR Runtime閉包検証](./Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)
- 追加結果参照: [Phase 5 署名CSR配布閉包](./Evidence/260929-0025_phase5-signed-csr-distribution-closure.md)
- 追加結果参照: [Phase 5 Mount Grant fresh再観測](./Evidence/260929-1123_phase5-mount-grant-fresh-observation.md)
- 追加結果参照: [Phase 5 Workbench Repository結合とSelection更新](./Evidence/260929-1305_phase5-workbench-selection-binding.md)
- 追加結果参照: [Phase 5 Workbench Production Selection契約](./Evidence/260929-1428_phase5-production-selection-contract.md)
- 追加結果参照: [Phase 5 複数Docker Recoveryの検証付き再起動](./Evidence/260929-2112_phase5-multiple-docker-recovery-restart.md)
- 追加結果参照: [Phase 5 実Provider E2Eの契約整合](./Evidence/260929-2254_phase5-real-provider-contract-alignment.md)
- 追加結果参照: [署名Runtimeの終了後Observer接続是正と公開MCP E2E再実測](./Evidence/260930-1440_signed-runtime-recovery-observer.md)
- 追加結果参照: [Workbench助言の実Provider出力拒否と診断搬送の是正](./Evidence/260930-1621_workbench-advice-result-rejection.md)
- 追加結果参照: [Shared Gatewayの非開示境界と品質適用](./Evidence/261002_shared-gateway-non-disclosure.md)。`RFD-ST-004`だけを新しい実HTTP根拠へ接続し、Host回収・実Provider・全体品質の未成立は維持する
- 追加結果参照: [品質176項目の固定候補照合](./Evidence/261002_quality-item-reconciliation.md)。全項目の候補集合と旧版の観測主張108件の現行適用未照合を追跡する。Profile搬送の局所36試験とWorkbench HTTP一試験を入口別に照合し、公開CLI／MCP Transportから現行Catalog・Task選定への結合不足を分けた。旧二JSONの廃止条件と四経路の画面なし実行の公開入口未対応も現行実体から確認した。現在の品質件数と停止Gateは変更しない。
- 追加結果参照: [Profile選択の現行UTとRole反例の補強](./Evidence/261002_profile-selection-current-ut.md)。局所60件の根拠を記録し、Transport同等性、PRL-UT-014全体、全体品質と実回復の未成立は維持する
- 追加是正参照: [公開ObjectiveのProfile搬送と試験登録](./Evidence/261002_objective-profile-transport.md)。任意Profile入力、MCP SchemaとTask搬送の実装接続漏れ、先行Host候補UTの登録漏れを是正した。局所117件の結果を全入口・実回復・全体品質へ拡張しない
- Quality Center: `RFD-IT-014`と`RFD-ST-015`を、Workbench→Version Control→実Git／bare Remote、実Browser確認、故障分類および再観測のEvidenceとして観測済みにした。`ERB-ST-022`も15画面、Desktop／Tablet／Mobile、100%／200%／400%の27条件、React commit後の画像確定待ち、終了所要時間および終了後不存在Evidenceへ接続した。`ERB-IT-020`は残存子Processへの世代Identity限定Fallback実発行とIdentity不一致時のEffect 0へ接続した

## 実際の影響 / 逸脱

- 実際に通った工程 / 共通責務: Discovery、UX、IA、UI／SPEC、UI／SPEC Detail、Architectureへの伝播
- 計画との差: Desktop包装を追加せず、計画どおりlocalhost ServerとBrowser Shellだけを実装した
- 追加 / 削除した工程・検証と理由: Visual Previewの成立を流用せず、Workbench固有の`ERB-IT-021`と`ERB-ST-022`へ分離した
- 経路不足から生じた指摘事項: 初回Mobile smokeでNavigationが一行横Scrollになったため、320px相当では3列折返しへ是正した
- 最終的に有効だった検証: 固定Route IT、15画面×3表示Profile×3 Zoomの実Browser Visual Gate、Repository Checker
- Production Closureで追加した検証: 署名Runtime配布観測がVersion Controlの5つのGit子Process呼出しを未登録として拒否することを確認し、閉集合登録後にPlatform Provisioner／署名Manifestの局所契約試験143件をPassした
- 署名済みDocker障害修復で、Repair Protocolが公式停止`S`を意図的に発行せず`false / not_issued`を返す一方、上位Runtimeが`true / confirmed`だけを正常としていた実境界不一致を検出した。Repairは`K`、Docker WSL停止およびrun世代退避を所有する既存境界を維持し、上位Runtimeは意図的な未発行だけを受理する。`true / unknown`は引き続き停止し、署名済み再実行、Host Windows回帰および実Provider E2Eが完了するまでPhase 5は閉じない

## 正本コンテキストの更新

- Workbench実装構造: `06_Architecture/Details/workbench/01_Architecture.md`
- UI／Visual: `04_UI/Details/**`
- System Behavior: `05_SPEC/Details/**`
- 実装・試験: `40_Develop/workbench/**`（Phase 1以降）

## リリース

- 対象リリース: `v0.22.0`
- 収録リリース: 未収録
- 処置: 実装・検証・独立レビュー後に人間が判断する

## 既知の制限 / 残るリスク

- localhost Web SurfaceがDesktop固有操作なしで必要な利用体験を満たすかはProduction Dogfoodで確認する。
- 公式ロゴはRepository内の承認済みAssetを使用するが、配布Packageでの単一Ownerと収載方法はPhase 1で固定する。
- WorkbenchのAI依頼Surfaceは選択Profile ID、読取り助言／変更候補、一依頼だけの外部送信確認を明示するApplication Portまで成立した。読取り助言は一般TaskのExecutor／Reviewerへ流用せず、Task Hash、Catalog Revision、exact Profile ID、Providerへ確認を結合して一回だけ消費する専用DispatchをProduction Compositionへ接続した。Effect前取消、Effect後取消競合、Provider例外、cleanup不明および不正結果は自動再送または成功へ畳まない。Provider Adapterはexact ProfileをCodex／Claudeの一方へだけ渡し、専用Execution PlanとProvider Command Planでstdin搬送、Repository／Workspace mountなし、Tool／Sessionなし、API Key／有料fallbackなしを固定する。Executor CoreはCodex JSONLのTool Eventを拒否し、Claude Envelopeから助言JSONだけを抽出して生metadataを公開しない。Executor Coreから署名Runtimeへ渡すOperation、Profile、Task／Projection Hash、PromptおよびCommand Hashは`ADVICEPKT-*`の一回消費Packetへ固定し、別Owner消費、再利用、取消後利用および共有境界拡張を拒否する。Production Runtimeは署名配布物Capability、Operation世代、Provider Home、Selection、Docker回復、Host cleanupおよび最終Recovery確定を所有し、両cleanup完了後だけ助言JSONを返す。修正前署名候補の実Provider E2EはMount Grant fresh再観測Gapで停止し、修正後署名候補では未実施である。
- Coordinatorに現在Process限定Mode Routerを追加し、読取り助言／変更候補を別Executorへ一回だけ配送する契約、取消後の遅延完了保護および未知Identityの非推測を`ERB-UT-023`で確認した。Workbench Production Compositionは読取り助言の専用Dispatch、Provider別固定Adapter、署名済みProduction Runtimeに加え、変更候補の明示許可Path、exact Executor Profileおよび署名済みProject Runtime Single Taskを接続した。候補は未信頼・未採用Identityとして公開し、候補生成とは別の確認・採用・破棄操作を接続した。採用は現在候補との一致、明示確認、Project Runtime Lease、Revision・dirty・Scope再観測、Receiptと耐久記録を必須にし、Commit／Pushへ拡張しない。修正前署名候補の実Provider E2EはMount Grant fresh再観測Gapで停止し、修正後署名候補では未実施である。
- AI結果は四区分の各項目を本文と一件以上の正本参照の組へ変更した。Coordinator Mode RouterはExecutor結果を閉じたSchemaで実行時検証し、専用Advice Result Parserは単一JSONを許可済み読取り投影のexact参照集合へ拘束する。根拠参照なし、投影外参照、重複Key、複数JSON、余分なKeyまたは過大値を部分公開せずblockedへ閉じる。Workbenchは参照を表示するが、参照から任意Path読取りAuthorityを生成しない。固定Provider Executorへの同契約接続は成立済みであり、今回是正後の署名候補再固定・直接起動と実Provider E2Eは未確認である。

## Nativeビルド出力の運用規則 — 2026-10-07

人間は無印`debug/release`をCargo標準の自動生成として許容しつつ、CRDDの正式入口では対象環境を明示し、無印成果物を利用しない方針を採用した。[コーディング規約](../../../06_Architecture/99_Coding_Standards.md#native-build-output)を正本とし、Architecture詳細とWorkflowから接続する。対象環境の指定なし、対象成果物欠落、複数候補ではfallbackせず停止する。Cargo補助出力の存在だけを違反・削除許可へ変換しない。

今回の経路はNative運用規則の文書変更であり、対象・出力・補助生成の区別を着手前に照合した。文書と利用側の独立整合確認を行い、署名・E2E・準拠監査は実装や準拠基準を変更しない今回の範囲では実行しない。ビルド入口の実適合、Coverage cache共有への変更、Native残存回収は後続の配置整理で処置する。今回の記載を実装移行完了へ読み替えない。新たな人間判断、削除、署名、Docker操作、コミット・プッシュは行わない。

追加した規約節、Workflow、Architecture参照および本記録を固定範囲として独立確認し、修正が必要な指摘0件だった。直接リンク・アンカーと差分の空白検査も成功した。確認は文書整合に限定し、実装適合・実ビルド・cache清掃の成立を含まない。

### 共有キャッシュへの実装移行と清掃

CoverageとNative保護試験のビルド先を`40_Develop/platform-access/target`へ統一した。実行物は今回のCargo JSON出力から取得し、対象環境、入力・実行物Hash、保存先とcache祖先のIdentityを照合する。試験ごとにビルド一式を複製せず、短命の計測値・結果だけを`.crdd/tests`へ置く。Coverage成功時はその領域を回収し、失敗時は小さな結果を保持する。共有cacheは実行単位の清掃対象にしない。

Formatter、Lint（警告0）、型検査、局所契約試験9件、実Coverage計測、実Native保護試験が成功した。Native試験は4拒否例、別Processの保護確認、入力と境界の不変、exit/closeおよびfixture2件の不存在を観測した（86ms）。Coverageの対象5ファイルは行51.06%、関数54.29%、領域53.45%であり、固定toolchainではbranch計測不可のままである。これらを全体品質合格や本番Recovery成立へ読み替えない。

独立レビューの祖先確認に関する2指摘を是正し、再レビューで解消・追加重大指摘なしを確認した。参照、使用中Process、Root、aliasを確認して旧`coverage-*`／`closure-*`81領域（45,767ファイル、11,132,015,618bytes）を削除し、残存0を再観測した。通常のCargo cacheと他の未処置領域は維持する。生の実行結果をEvidence書庫として追加しない。署名、E2E、Docker操作、コミット・プッシュは今回実行していない。

### 旧verificationのNative試験入口整理

旧7領域の利用側を調べ、自己生成namespace試験を正式TS入口へ移した。今回Cargoが返す共有cache内の実行物とfreshなtests領域で再実行し、元19拒否例、全close、入力不変、exit/closeとfixture不存在を確認した（是正後60ms、終了値0）。成功後の一時領域は不存在である。型・Formatter・Lint、Rustfmt・Clippy、局所契約試験4件が成功した。独立レビューの失敗時保存境界の指摘を是正し、再レビューで解消・追加必須指摘なしを確認した。祖先置換と失敗条件の試験は局所反証であり、実timeout全体の実測とは区別する。

旧capacity領域の`capacity-r1`、publication領域の`fixture`と`fixture-r2`は読取り拒否のままであり、不存在や不要とは判定していない。残る固定試験と歴史診断も未移行である。旧7領域全体の回収、④全体、署名・E2EまたはRelease可能の完成主張は行わない。生結果の書庫や試験ごとのBuild複製は追加しない。

旧Native保護領域だけは正式入口への能力移行を独立確認し、物理回収対象とした。旧`cargo-home/config.toml`はoffline、固定Windows target、領域内のtarget-dir、固定Rust compiler、cache自動清掃なしを指定していた（SHA-256 `ed76cb2c73394af49f6eecd116495e5a3af4d7dee3c08ff19f01d61e37845878`）。他の過去実行JSONがこの旧設定を使用した事実は履歴として保持し、現在の再実行能力へ読み替えない。歴史入力の物理回収であり、過去記録の書換えや他6領域の処置は行わない。新入口の再実測は72ms、4拒否例・両Worker・handle終了・入力と境界不変・exit/close・fixture2件不存在が成立した。本番接続、厳密期限、親喪失は未検証のままである。

回収前に旧保護領域1,292ファイルの非reparse、領域内で閉じるhardlink12組、排他open、削除直前Hashを確認し、leaf Fileと空Directoryを回収した。82,026,252bytes分の生成物と領域Rootの不存在を確認した。この時点の旧verification残り6領域・読取り拒否3箇所は、次の追加処置で確認する。namespaceのpackage入口も再実行で成功した（85ms）。

### 残るNative試験の移行と旧実物の終了処置 — 2026-10-07

正式入口`platform-access:verify-terminal-fixtures`へ、対象・保存・容量（前後）・現在候補・cold・rename・公開・disposition・既知fileの九能力十実行とNode／Native排他互換一件を移行した。今回Cargoの共有cache実行物、固定Node、入力と直接helperのHash、祖先Identityを前後照合する。修正後十一実行は全件成功、各自己生成対象は不存在、known-fileのreparseは拒否を実観測した。namespaceも再実行成功。Native通常44件成功・23件ignored、入口／Oracle契約7件成功、型・整形・Lint成功。全E2E・署名・公開Recoveryは検証範囲に含めない。

旧Root読戻し・mutationの歴史診断二入口は廃止した。全bytes・ACL・Identity・closeは現在候補／cold／rename、四変更操作の拒否と公開後stage不存在は現在候補／cold／rename／公開へ継承した。旧二名同Identityの失敗診断は成功能力に読み替えない。元の診断追加Git版は`f61706558ea3a7fc0cd54cde85dce029461aeca2`である。初回の一時所在指定不一致と編集中入力変化は成功にせず保持・終了確認後に回収し、固定候補で再実測した。

独立レビューの必須指摘一件（直接helper二ファイルの入力Hash不足）は是正し、再レビューで必須指摘0。実測成功とは別に、試験判定・保存／清掃境界・歴史能力の対応を確認した。実行Owner Hashは`e54b459791795a9200e900d16e3b6426992df09ce86296dbccff6459a9bd03e2`、Native入力Hashは`59eb329855a39acf8133dfbbb7eae37f94cc98c25bc5c50312dde023ec45e00d`、Oracle Hashは`1f0fe1be61ceec5b63803af6f83c72f20aa9c836f83544aea45de5bd16608040`。

人間が承認した三Directoryと内側六Fileだけ権限を修復した。capacity-r1は空、publicationのfixture／fixture-r2は各8192byteの人工値`x`を持つstage／publicと5byteの人工旧値`prior`であり、実候補・認証情報ではない。旧六領域は2,041File・266,834,866bytes、hardlink54組は領域内で閉じ、alias0。相対Pathと各内容Hashを昇順連結した台帳Hashは`c67462411fe84c3703c1a877fc067af3f3072317ffcaf2302ce66e28c4d7abdb`。現在参照と実行Processは0。削除直前の排他open・Identity／Hash再照合後にleaf Fileと空Directoryを回収し、六領域と`.crdd/verification`の不存在を確認した。排他openは同一hardlink実体を一度だけ取得し、閉じた集合を別の使用中Processと誤認しない。権限修復用三ファイルも回収済みで`.crdd/tests`は空。生結果の書庫はCHGへ追加しない。実測後の入口コメント移動は関数の直前へ説明を戻す編集だけで、実行処理を変更していない。コミット・プッシュは人間の停止指定を維持する。

### tmpの有限清掃と残る根拠の分類 — 2026-10-07

今回の処置は保存物の清掃であり、Runtime・署名・回復契約を変更しない。現在のProject Runtime v2状態は受付・Queue・Lease・結果・判断回復の各集合が空で、tmpへの参照はない。tmpを参照する実行Processは観測されなかった。Docker APIはEngine pipe不存在で観測不能のため、Dockerへ渡したビルド・試験領域は今回回収しない。

| 分類 | 処置と理由 |
|---|---|
| 旧端末ラッパー22件 | 既に回収した旧release配置を参照する、実行単位に固定した復旧・再起動・観測用の控え。現在参照と排他読取りを再確認して回収する。実操作は再実行しない |
| 旧署名コピー`sign-v022-csr-5a2d6b02` | 2,023File・35,629,103bytes、aliasと複数hardlinkは0。現行Source・設定・状態から参照されない旧全Repositoryコピー。排他読取り・内容再確認後に回収する |
| 現行builder入力 | `codex-01592-migration/official-source.tar.gz`と`codex-01592-attestation/codex-code-mode-host-x86_64-unknown-linux-musl`を保持。前者SHA-256は`b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a`、後者は`5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03`で74,068,880bytes。取得・照合根拠も後続整理の対象とする |
| 局所診断と専用試験Source | `auth-create-plan-preflight-261004.mjs`、認証互換／更新、CLI取消、正式21試験の識別根拠は保持。再実行能力・未成立条件を失わないようEvidence処置と合わせて分類する |
| 終了結果・署名ログ・archive等 | 名前や日付だけで不要判定せず、後続のEvidence整理で正式記録との対応と固有情報を確認する。生結果の書庫をCHGへ追加しない |

読取り専用の独立着手前確認では、必須入力と固有試験根拠の保持、Docker使用状態未確認の領域の据置き、現在状態とのexact参照照合を確認した。これは清掃結果の独立レビューではない。tmp全体の不存在は完成条件にせず、現行ビルドの能力を保持する。コミット・プッシュ、署名、Provider依頼、Docker再起動、権限修復は行わない。

第一回収として旧ラッパー22件と署名コピー2,023Fileを処置した。削除前に検証済みRepository Root、現在集合の空、tmp参照Processの不存在、alias拒否、各FileのHash／サイズと排他openを再確認した。署名コピーの事前台帳Hashは`261639d5ff4abbc632be96fc4b3cee987a18c617f529b26e6ecf887dc02a6b77`。処置後に対象22Fileと署名コピーRootの不存在を確認した。残る107直下Fileと8子Directoryは、現在入力・固有試験根拠・終了控えが混在するため、Evidenceの意味処置と使用確認に接続して継続分類する。

人間の追加指定により、不要な試験根拠・終了控え・ビルド物の回収を先行する。正式二十一試験は既存[終端記録](Evidence/260930-1853_codex-model-host-migration-preflight.md#統合後候補の正式二十一試験の終端結果2026-10-01)へ判定・対象版・限界・成果物Hash・独立確認を記録済みで、残存21ログの各一件成功も再読取りで一致した。試験本体のtracked Patchと公式Sourceは保持し、過去実測を再実行や全体Passへ変更しない。`formal-verification`の61File・1,035,492,801bytes、未採用`provider-image`の7File・361,211,591bytes、公式Source展開控え`patch-baseline`の8,704File・86,369,194bytesを有限回収対象とする。Source展開控えの相対symlink `vendor/bubblewrap/LICENSE → COPYING`一件は辿らずlink自身だけ処置する。

Docker APIのコンテナ一覧は未確認のまま保持する。一方、WSL実行中一覧は終了code0で空、Docker Desktop／backend／daemon／WSL VMのHost Processは0、tmp参照Processと現在処理は0と再観測した。今回は人間指定に基づくHost側の非使用・排他確認済み物理控えの回収に限定し、旧retentionのDocker内部一覧の確認完了、Docker資源不存在、実Provider試験や回復の成功とは表示しない。

現行builderがtmpの固定二入力を読むのは過去の取得配置を直接参照する実装であり、通常Runtime／署名の依存ではない。tmpの恒久保持を正当化する契約ではなく、再ビルドの取得・配置整理が残る。tmpだけに存在する取消・認証試験のコードは、単なるlogと区別し、正規試験への移管要否を確認するまで保持する。

### 公式Codexへの復帰と助言境界の縮小 — 2026-10-07

人間は、Codex内部まで改造する品質要求は依頼しておらず、公式Codexを既存Dockerで隔離する役割分担へ戻すことを指定した。以前の最小起動Adapter承認は過去の判断として保持するが、専用Buildの継続根拠にしない。変更意図は同じWorkbench助言の完結であり、新しいCHG・Recovery Framework・追加防御を作らない。

| 対象 | 予定処置と完了確認 |
|---|---|
| 専用CLI | 助言だけ公式未改造0.159.2へ置換。CLI・Hostの公式配布Hashと新Image実Digestを確認する。通常Task公式0.149.1は変更しない |
| 既存防御 | Repository／Workspace非共有、Docker非root／root filesystem読取り専用、既存mount・権限・通信制限、認証、外部送信確認、API-key fallback禁止を維持 |
| 結果 | 内部計算の既知通知と最終本文を分離。独自PolicyのTool集合制限を保証しない。Error・不正形式・最終結果不正とcleanup未確定は拒否 |
| Lifecycle | init・取消・終了後回収と旧exact Recovery Identityを保全。新Imageとの照合を計画・Effect直前・清掃・再入場へ伝播する |
| 廃止 | 独自Source Build／Patch／試験Patch／linker／配布Identityと関連試験を全数棚卸しし、旧根拠を新方式へ流用しない。公式配布へ切替後、不要tmp材料を回収 |
| 検証 | コマンド計画・出力抽出・配布・Docker構成・取消／Recovery・署名閉包への局所回帰と独立レビュー。実署名・外部Provider E2E・Release判断は別途扱う |

読取り専用の着手前確認で、通常Taskと助言の配布責務分離、公式CLI実体Hash一致、採用済みモデルの最低Client版と0.159.2の整合を確認した。人間承認したDocker通常起動後、公式実行物を配置するImageを作成し、実Digest `sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e`、CLI版およびCLI・Host・bwrapのHashを確認した。初回のImage参照表記誤りは包装定義で是正した。CLI起動時の読取り専用filesystemによるPATH alias作成Warningは保持し、実助言の失敗不存在へ読み替えない。

局所29試験とDocker Effect／Recoveryの129試験は失敗・skip 0で成功し、ProductionとTestの型検査も成功した。旧Source Build入口とPatch／linkerを撤去し、旧exact Recoveryのinit構成は保持した。過去の改造CLIは基準Commit `823cb32deaa0e21a28aad73942ab5a05a9aa0950`から追跡できる。独立レビュー、署名と実Provider E2Eは未完了であり、新方式全体の完成を表示しない。Docker再起動／修復／永続データ削除／外部AI依頼は発行していない。

公式CLI移行の独立レビューは対象限定Pass。旧Tool禁止説明の直接伝播漏れを是正し再確認した。旧改造Buildの3領域（formal-verification、provider-image、patch-baseline）を参照・非使用・実体・Hash・排他読取り確認後に回収し、不存在を確認した。今回作成した配置Context2領域もImage確定後に回収した。計5領域・約2.2GBを削除し、新公式Imageと取得元公式配布物は保持した。tmp全体の清掃完了とはしない。

横断確認ではConsumer閉包14試験中13成功、命名契約19試験中18成功。失敗は先行Native整理のcoverage scriptによる直接.crdd Root構築と、fixed-runtime-signing.fixture.tsの命名規則不一致であり、本公式CLI移行のSource変更とは分離して未解消を保持する。規則を弱めず、次の整理でOwner実装を修正する。署名・外部AI依頼・コミット・プッシュは今回実行していない。

### tmpの追加回収と横断確認二件の是正 — 2026-10-07

終了済みの署名・復旧・Workbench診断のトップレベル104ファイル（78,581bytes）を、現在参照・非使用・実体と排他読取り確認後に回収した。さらに人間のexact対象承認に従い、公開配布アーカイブ、取得検証Tool、旧取消試験の複製実行物とstdout／stderrの11ファイル（710,575,169bytes）を回収し、全対象の不存在を確認した。公開取得元・版・Hash・署名照合結果は既存のモデル・Host移行根拠に保持する。現行公式CLIとHost本体のHashは不変であり、配布物の複製を根拠の正本として永久保持しない。

Coverage入口はRepository Root検証と既存Runtime Dataのtests領域取得へ接続し、Runtime Data／Version ControlのConsumer閉集合にも追加した。固定署名Fixtureはfixed-runtime-signing-fixture.tsへ改名し、二つの直接importを更新した。追加Native終端試験入口のstrict検査一覧漏れも是正した。処理意味、署名、Docker実行、祖先Identity、共有targetと終了清掃は変更していない。独立Sourceレビューは対象限定Pass、必須指摘0である。

関連六試験ファイルは62件中61件成功した。唯一の命名横断失敗は、初回の検査対象漏れを是正した再実行で、既存Sourceの258件のHeader／Trace／識別子指摘へ具体化した。元の二件の違反を解消したことを横断検査全体Passと同一視しない。ProductionとTestの型検査、変更箇所の整形・Lintは成功した。未処置指摘を弱い規則へ変更せず、次のSource整理対象として保持する。

tmpには現行公式Imageの明示入力、旧認証互換／更新・取消の固有試験Sourceとその対応資料、および未処置の旧取得物が残る。これらを別の一時フォルダへ移して清掃済みとはしない。固有試験の正式Ownerへの移行または能力の廃止判断が必要であり、tmp全体の清掃完了を主張しない。実署名・実Provider E2E・Docker再起動・コミット・プッシュは行っていない。

### 旧改造CLI診断の廃止と空領域の清掃 — 2026-10-07

命名試験は不要なchecker-naming親を作らず、tests直下の一意なnaming-fixtureだけをfinallyで回収する構成へ変更した。対象試験1件と整形・Lintは成功し、既存の空checker-namingは削除・不存在確認済みである。共有tests親は削除しない。

codex-advice-auth-compat、auth-refresh、cli-cancellationの旧三診断領域は、廃止した改造CLI専用の試験候補として撤去対象とする。独自Rust補助を新方式へ昇格せず、旧診断Sourceの再実行能力は廃止する。過去の限定結果・失敗・未成立条件は既存モデル・Host移行根拠で保持する。新公式CLIの認証・取消・親Process喪失と実Provider E2Eの義務は維持し、旧診断撤去を能力移管済みまたは新方式Passとは表示しない。旧認証Source Archiveとstatic Image exportはこの診断の終了に合わせて撤去対象とする。

auth-create-plan-preflight-261004.mjsの実FilesystemによるClaude→Codex連続処置は、現行の差替え契約試験へ完全には移管されていない。これだけは今回の撤去から除外し、正式試験への最小移行後に回収する。tmpに必須の本番Sourceがあるとは説明しない。

operations管理領域の先頭ドットは安全保証ではなく内部管理面の識別である。現行temporary-operation-storeが開始時に.operationsを作り、記録とLockの確定時に.stagingを作る。名前を通常のoperations/stagingへ変えることは可能だが、exact再入場参照・試験・Architectureの同時変更を要するため、今回の物理清掃と分離する。


独立確認で単発診断の実Filesystem境界が既存の差替え試験だけでは代替できないと分かったため、docker-effect-runtime.contract.test.tsへ『実config清掃後はClaudeからCodexへ同じ管理領域を再利用できる』を追加した。固定Sourceのprivate config三関数を試験内だけで使用し、Productionへ試験Exportを追加していない。旧診断の互換Task条件は既定falseの試験引数へ限定し、現行の実モデル選定や設定は変更しない。計画検証は物理領域作成前に行う。実config作成・Identity確認・削除二回、清掃前の計画差替え拒否、清掃後のCodex開始と終了後の空を確認した。CLI信頼とProcessは差替えであり、Docker実行・Provider成立は主張しない。

型・整形・LintとEffect全17試験が成功し、移行の限定独立レビューはPass、必須指摘0である。初回の試験前提誤りは本体欠陥とせず、準備前の検証へ移して是正し、残った自己生成空領域も回収した。その後、旧三診断領域・旧二Archive・単発mJSの70ファイル（157,683,575bytes）を現在状態空・操作記録空・稼働Container 0・実体と排他読取り確認後に削除し、全六対象の不存在を確認した。旧診断Sourceの再実行能力は廃止し、過去のMD根拠は保持した。

公開取得元の複製も永続Cacheにしない。公式Imageのexact Digestを再確認し、公式CLI／Hostの固定Hashを再照合後、取得二領域の5ファイル（360,844,108bytes）を回収した。Imageは保持し、Image再作成時は公式Release rust-v0.159.2からCLI／Hostを再取得・検証してprepare-codex-advice-image.tsへ明示入力する必要がある。CLI本体のSource Buildは不要である。tmpの残存は空の.operations/.stagingだけ、testsは空である。今回の75ファイル回収を新公式CLIの認証・取消E2E完了へ読み替えない。

## 後続対応 / ロードマップ

固定CLI本体のモデル情報で、助言用`gpt-5.6-sol`は`code_mode_only`だが現行助言実行ではHostを無効化する不整合を確認した。実測errorもCode Mode利用不能の固定文言へ一致した。設定関連のもう一件は未特定である。人間は後続判断として6.1 Solを標準、6 Lunaを軽量用途とするProfileと対応固定CLIへの移行を承認した。旧5.5互換Profile／5.6 Host案は判断前の候補履歴として保持し、現在の採用方針にはしない。

公式CLI `0.159.2`の固定配布物では両モデルがCode Mode専用だった。Hostを正式に含めるだけでなく、非表示Tool名の直接呼出しを実行前に拒否できる許可集合が必要である。公式Sourceの起動時`ToolPolicy`はこの制限を持つが、公開CLI設定からの注入入口は今回の確認で未発見だった。専用実行物の構築・配布・保守を伴う最小起動Adapterへの拡張は人間が承認した。助言用の権限は広げず、通常Executor／Reviewerと専用制限を分け、局所反証と独立レビュー後に再署名・実Provider E2Eへ進む。現在は新モデル実行、Host有効化、権限緩和またはerror無視を行っていない。初期ProfileのJSON外出しは型・Lint・契約試験13件と配布物観測を通過し、独立レビューPass・Finding 0である。根拠、未確認範囲および着手前確認は[モデル・Host移行の着手前確認](Evidence/260930-1853_codex-model-host-migration-preflight.md)を参照する。

署名Runtime `52249c52`の再診断では、拒否対象が完了error通知二件と判明した。固定文字列分類は設定関連一件、code mode関連一件に一致したが、原因の確定ではない。正常終了・資源回収後もWorkbench助言は拒否されており、受理条件を緩めず固定CLIの設定契約へ戻って確認する。診断Toolは独立レビューを通過し、本文や未知値は保存していない。通常E2E合格へは算入しない。根拠と限界は[Codexエラー通知分類](Evidence/260930-1801_workbench-advice-error-classification.md)を参照する。

先行する通知契約の是正は[通知契約照合](Evidence/260930-1643_workbench-advice-notification-contract.md)に記録した。署名Runtime `ecb7fb1d`のCodex単独実測は正常終了・資源回収後に`workbench_ai_codex_tool_event_forbidden`で停止した。正常な思考通知の誤拒否と不正・更新Itemの検査漏れを局所是正し、関連257件と独立レビューを通過した。その実測時点では具体的なItem種別を観測しておらず、原因を思考通知と断定していない。後続の署名Runtime `52249c52`でも拒否が続き、上記診断でerror通知を特定した。解消確認、Claude助言と変更候補およびWorkbench全体のE2Eは未完了である。

Phase 4までの接続とPhase 5の13画面を閉じ、15画面のProduction DOMを3表示Profile×3 Zoomの実Browserで観測した。読取り助言、変更候補の生成と別操作での採否、Shared Serverの公開入口はProduction Compositionまで接続済みである。署名Runtime `45254e2b`と是正済み検証Tool `1b756ac2`によるRun `2e55c8cd2897464b`は、Project Runtime公開MCPの通常二経路、取消、exact Recovery、最終回復在庫確認まで合格した。再入場後の人間の採用判断待ちは意図した停止であり、自動採用完了を主張しない。是正前の失敗結果は履歴Evidenceとして保持する。次はWorkbench実Provider E2Eと必要な四経路E2Eを実測し、残る品質項目を個別照合する。その後、最終回帰・独立レビュー、最終配布固定、再署名、署名拒否試験および直接起動確認を閉じて人間のRelease判断へ渡す。現在の限定合格を全体Quality ReadyまたはRelease可能へ読み替えない。


## 署名一時配置とCoordinator入口統合 — 2026-10-07

人間はbin/launch.tsをbin/coordinator.tsへ統合し、署名処理をtmp/signature/の準備→署名→正式Manifest適用→フォルダごとの清掃として整理する方針を採用した。operations/stagingへの単純改名は行わない。共有一時処理の現在の本番利用側はprepare-release-runtimeだけである。

通常処理の所有者はsrc/core/coordinator-command.tsへ移し、旧doctor／project／capabilities／candidate／task直接入力、同一PID、stdio・cwd、外部端末条件を維持する。署名閉包検査と直接利用側・試験は移動した所有者へ追従し、検査を弱めない。

署名一時配置はCoordinator詳細設計の整理方針に従う。異なる操作IDの同時署名拒否、保存途中の中断、正式適用前後の中断、適用済み再入場の署名0回、清掃失敗と終了後不存在を確認する。現在は新配置切替済みとはしない。実署名・Provider E2Eとコミット・プッシュは実行しない。


### 入口統合の限定確認結果

型検査・対象七ファイルの整形／Lint・diff確認は成功した。入口と取消の19件、移動後の署名閉包2件、Version Control利用側10件は成功した。引数なしhelpの互換指摘を是正し、独立再レビューは入口統合限定でPass、必須残件0となった。

入口・CLI・対話境界の収集は51件中50件成功、未変更verify-native-protection.tsの既存Shell搬送検査1件は失敗した。全回帰Passへ拡張しない。旧候補で開始した包括Package試験は長時間未完了のため、そのexact試験Processだけを終了した。最新候補の包括Package確認は残る。実署名、署名一時配置の実装切替、製品E2Eは未完了である。


### Native Root接続と空試験親フォルダの是正 — 2026-10-07

Nativeスクリプトの横断指摘は、三入口がGitを直接呼びRepository Rootを再解釈していたことが原因である。verify-native-protection／verify-native-terminal-namespace／verify-native-terminal-fixturesを既存Version ControlのverifyRepositoryRootとresolveVerifiedRepositoryRootへ接続した。Root一致とNative Oracleは維持し、既知Consumer集合へ接続先を追加した。型検査と該当横断試験1件は成功した。

空のtests/coordinator-launchは試験親Directoryの残存だった。試験はtests直下の一意な自作領域だけを作成・削除する方式へ変更し、整形確認後の再実行1件成功と終了後不存在を確認した。空の旧tmp/.operations/.stagingとその親もexact空・非aliasを確認して削除した。現在の空Directoryは想定トップ領域tests／tmpだけである。共有一時処理の旧既定配置は署名配置切替前にはまだ実装に存在し、この物理清掃だけで廃止済みとはしない。

### 署名一時配置の切替と移行責務の分離 — 2026-10-07

署名準備を`tmp/signature/work`へ切り替え、制御文書・Lock・保存確定前Fileを同じsignature Rootへ集約した。通常完了ではRootごと回収する。正式Manifest適用後の中断は、候補と正式Manifestの全File Hash一致を確認した場合だけ清掃へ進む。不一致・観測不能では候補とexact回復参照を保持し、新たな署名や強制削除を行わない。Signerと昇格入口も最新signature配置だけを受け付ける。

旧構成の移行は署名だけに限定しない。Coordinator、Project Runtime、Execution Intelligence、設定、ログ、候補、一時領域および試験結果の棚卸し・保全・移行・清掃をフロントAI手順へ明記した。実装は採用済み最新構成を扱い、移行専用の旧Reader／Writer・二重書込み・Fallbackを増やさない。現行Capabilityに必要な過去署名の真正性検証は移行互換と混同しない。

局所確認はRuntime Data全44件、Coordinator準備・中断12件、Signer Root／昇格配置2件が成功した。型検査、対象整形・Lint、diff確認も実施した。保存・公開・読取り・最終清掃の失敗7変種を含む限定独立再レビューはPass、必須追加指摘0である。実署名・対話端末・製品E2E・全体移行完了の主張には拡張しない。人間指定によりコミット・プッシュは行っていない。

### 移管Evidenceの正式要約化 — 2026-10-07

人間承認により、Recorder14実行42JSONとNative4JSONを既存の整理④Markdownへ集約し、Release案内を要約へのリンクへ変更した。過去の結果・時刻・対象版・固有署名Identity・未記録観測・失敗義務を維持し、重複本文と開始／完了管理Fileを恒久書庫にしない。限定独立再レビューPass後、範囲・非使用・記録相関・削除直前Hashを確認し、46File・157,884 bytesを回収、全件不存在を確認した。実署名・製品E2E・現在品質の全体合格は主張しない。コミット・プッシュは行っていない。

### Runtime Trust起動接続の採用範囲是正 — 2026-10-07

人間からの処遇再確認によりRoadmapの将来版と上流の独立読取り評価を照合した。Coordinatorが利用者Trust Policyを有効化してProvider起動Gateへ消費する義務は現行v0.22の採用範囲ではなく、ARCH-000014の読取り評価契約を過剰拡張したものだった。現行Semantic Required行とAIT-IT-014を除去し、IDは再利用しない。評価部品の既存二試験とOracleは保持し、AIT-IT-001の部分境界へ再接続した。署名・完全性・起動時Gate・既存Trust候補部品・将来Roadmap・上流Canonical IDは変更していない。

正本からSemantic Coverageを再生成し、17意味の実装Relation17、自動Test Relation16、手動確認待ち1となった。実装追加・過去Missingの実証解消・全体品質Passとは表示しない。過去CHGと監査の判定は履歴として維持する。

限定独立レビューは2026-10-07にPass。適用表に残った旧AIT-IT-014参照を是正し、現行の必須参照不存在を再確認した。Semantic Coverageの16試験、独立読取り評価Gateの2試験、変更対象の形式・LintおよびCoordinatorの型検査はPass。全体Checkerは16指摘を検出し、このうち旧ID残存1件を今回是正した。他の既存リンク・Quality対応表／適用判定の残件は全体Passとして扱わない。署名・実Provider E2E・将来Trust起動接続の成立は主張しない。

### Docker回復縮小の保存契約・反証具体化 — 2026-10-07

Coordinator詳細設計に、現在状態の閉集合、保存途中の再入場、結果受理後の回収、および認証Probeに限定したunknown終了条件を具体化した。基本情報のOwnerを`operations`へ一本化し、回復と未受理結果は参照で接続する。旧作成結果のunknownは保持し、現在の資源不存在だけから過去成功や旧OwnerのEffect不能を推定しない。Runtime Dataの署名一時配置参照を現行`tmp/signature`へ合わせた。

独立設計レビューの指摘に従い、保存途中のFileは正規Snapshotと同一形式・同一bytesとし、元revisionと元Fileのexact bytes Hashへ結合した。初回保存と既知元版喪失、保存済み更新と同版異内容を区別する。追加JournalやLock Frameworkは作らない。既存QA Local Itemへ中断・参照不整合・遅延Create・終了後不存在の反証を接続した。限定設計再レビューはPass、必須指摘0である。Source切替と実境界成立の判定ではない。

既存回復状態機械、Recovery Runtime、Process Controllerの局所基準試験は215件成功、失敗・取消・skipは0だった。新保存方式の実装試験ではない。Coordinatorの整形、Production／Test型検査、Lintは成功したが、後続の能力Graph検査は`platform_provisioner_runtime_dependency_child_process_unbound`で停止した。全体Checkerの既存15指摘も残るため、全回帰Passとは表示しない。

現在状態の本番保存接続、限定unknown終了の実装、通常履歴の保持設定、利用側の切替および実境界・署名E2Eは未完了である。今回、Docker再起動、実Provider依頼、実署名、旧回復記録の削除は行っていない。

### 保存再入場判定の第一実装 — 2026-10-07

既存の回復状態機械へCoordinator Snapshotの純粋な再入場判定を追加した。元版／次版のexact bytes Hash、Repository結合、初回Root条件、明示不存在／観測不能、previous改訂相関、非安全整数・overflowを照合する。返却は非Authorityの処置候補で、File・Lock・Docker操作を発行しない。新規三Caseを含む単体十一件と、既存Recovery Runtime／Process Controllerを含む局所回帰218件は全件成功し、失敗・取消・skipは0だった。型・対象整形・Lint・diff確認も成功した。固定Source二Fileの限定独立レビューはPass、必須指摘0である。全Snapshot検証、物理保存と清掃、本番Writer接続、限定unknown終了、全体Checkerの既存残件および実環境E2Eはこの判定へ含めない。旧記録の削除・実署名・Provider依頼・Docker再起動は行っていない。

### 現在状態の保存先・排他接続 — 2026-10-07

既存Repository Operation Ownerへ内部保存先借用を追加し、Root・論理／実体Identity・発行revisionとOwnerを再観測する。公開検証結果へPathを追加せず、借用をAuthorityとして扱わない。既存Windows排他primitiveのCoordinator専用namespaceを追加し、Host試験プロファイルへ接続した。保存先とOwner失効、同Root競合、別Root・Project Runtimeとの独立、解放後再取得の局所二件、および先の再入場三件を合わせた五件が成功した。型検査・対象Biome・diff確認も成功し、限定独立レビューPass、必須是正0である。保存Root Hashの導出、全Snapshot Schema、物理Writer、既存排他との取得順、doctorの再入場Root、本番切替は未完了である。実署名・Docker再起動・Provider依頼・旧記録削除は行っていない。

### 回復記録の内容検証と物理保存の分離 — 2026-10-07

着手前確認で、旧base／段階FileはNative Authorityそのものではないが、Coordinatorの資源選択・回復相関・Host清掃前提へ結合していると確認した。単純なWriter置換を避け、既存八宣言を`docker-recovery-record-model.ts`へ移し、Runtimeから共通の内容検証を利用する形へ分離した。宣言本文は空白正規化したGit基準版比較で全八件一致し、条件や既存受理範囲を変更していない。新しい互換Reader、保存方式の二重正本、Native操作やAuthorityは追加していない。

分離後の回復状態機械・Recovery Runtime・Process Controller局所回帰218件は全件成功、失敗・取消・skipは0だった。型検査、対象Biome、diff確認は成功し、Source二FileとArchitecture追加説明の限定独立レビューはPass、必須是正0である。能力Graph検査は既存の`platform_provisioner_runtime_dependency_child_process_unbound`で停止するため、全体検査Passとはしない。全Snapshot Schema、Writer、Host処置前提の最新状態接続、旧保存撤去、限定unknown終了および実署名E2Eは未完了である。

### 現在状態codecの構造相関 — 2026-10-07

`coordinator-state-model.ts`へ最新Snapshotの閉じた型と本文検査を追加した。固定操作情報とHost遷移の確定JSON本文を文字列として保持し、外側のkey整列によってNative証明の項目順・Hashを変更しない。五purposeの要求状態と現在観測、一次失敗と最終結果、操作と回復・搬送参照を分離した。別Repository、重複・孤立参照、不正改訂、未知field、非正規本文、不正UTF-8、BOM、getter／Proxyを拒否する。ID確定済みで観測unknownになっても資源IDを保持する。

独立レビューの二指摘（Host許可辺の未限定とBuffer accessor評価）を是正し、現行三辺への限定と組込みbyte取得・コピー、拒否反証を追加した。型検査・対象Biome・関連単体十四件が成功し、Source／Test／Architectureの限定再レビューはPass、必須残件0である。先の218件回帰を今回の新codecの回帰数へ合算しない。Snapshot間の遷移不変条件、実Writer・Host回収接続、旧保存撤去と署名E2Eは未完了である。今回もDocker操作、Provider依頼、署名と旧実物削除は行っていない。

### 現在状態の物理保存Port — 2026-10-07

通常操作Ownerへ結合した保存Portを追加した。既存排他、検証済みRepository結合、bounded読取りを用い、現在状態とpendingを固定配置へ保存する。Runtime Data Ownerの排他的領域作成と初回本文を結合し、空の既存領域や公開後の状態喪失を初回へ読み替えない。本文とFile Identity、再openしたdescriptorを照合し、同内容の別Fileを拒否する。保存確認と排他終了を別に返す。

改訂間では固定Identity、確認済み資源ID、一次失敗、結果と受理参照を保持する。回復と搬送の変更も操作Ownerへ結合し、unknownを未発行へ変更しない。終端証明が未接続の間は操作・回復・搬送の削除を拒否する。独立レビューの指摘を是正し、初回準備前のOwner照合と排他解放未確認時の初期化証拠失効も追加した。

型検査、対象Biome、単体三件と実Windows Filesystemの保存・再入場一件はPass、作業差分とstaged差分の形式検査もPass。公開後の状態消失、同内容の実体差し替え、hardlink、別pending、Owner失効、unknown負方向の反証を含む。実装・Architectureの限定再レビューはPass、必須実装指摘0である。ただし追加二指摘の専用反例試験（別Owner初回候補のEffect0と領域未作成、公開前保存失敗と排他解放失敗後の初回再試行拒否）は未完了であり、保存Slice全体の検証完了とは表示しない。本番Producer、doctor再入場、Host終端、旧保存撤去、履歴設定、署名E2Eは引き続き未完了。Docker操作、Provider依頼、署名と旧実物削除は行っていない。

### 責務再編・Architecture Closureの完了計画 — 2026-10-07

人間との確認に基づく親フォルダ統合・AI固有処理分離・CROS REST／Gateway廃止・Native内部整理を、同じCHGの責務再編として扱う。[対応案と完了計画](./Evidence/261007_develop-responsibility-mapping.md#23-責務再編を完了させる計画)に、全能力・File照合、ARCH基本設計、Details／Quality、設計独立確認、依存順の実装、全体回帰・Reality Audit、固定候補署名E2E、完了判定の順序とGateを記録した。計画はCommit `3389345e`と後続具体化案を基準とする。

計画作成時点ではArchitecture正本・Source移管は未着手だった。既存Snapshot／回復縮小等の未完了義務は対応付けて維持し、この計画だけで解消済み・全体Pass・Release可能とは表示しない。PR統合・Release判断は別に保持する。

### 責務再編の現在地 — 2026-10-08

#### 持ち越し判断 — Orchestrator／Coordinator／Docker（2026-10-09）

Qual-Labは、大規模改修で実装が変わる見込みを理由に、5Cの追加是正とそれに依存する検証を持ち越すことを承認した。確認済みの局所結果と未解決事項を保持し、大規模改修の入力とする。Sourceの追加変更、巻戻し、削除、新しい回復管理機構の追加は今回行わない。実施版・期限は未設定である。

5C、責務再編の段階5全体、段階6〜8およびCHG全体は未完了を維持する。持ち越しはGate免除、残存リスクの受容、Release範囲の変更または新Architectureの採用を意味しない。CROS／MCP／Workbench等の独立した整理を一括保留せず、5D〜Fの各処置についてRuntime依存を確認する。全移管後、親フォルダ内のFile名・責務・配置精査前に停止して人間へ報告する条件も維持する。

担当責任者・再開判断者はQual-Lab。大規模改修の目的・責務・成立済みCapabilityの維持範囲が確認されたとき、または現行Runtimeを必要とする計画・Release判断時に、残件と検証義務を再評価する。自動再開しない。残件と段階1〜8への影響は[持ち越しの処置表](Evidence/261007_develop-responsibility-mapping.md#持ち越しの処置--2026-10-09)を参照する。

以下の進捗・次手順は各記録時点の経緯であり、現在の追加実装・E2E再実行指示ではない。

#### 未採用の設計候補 — 終了履歴整理後の配送再入場（2026-10-09）

状態: 未採用・未実装のまま大規模改修への入力として持ち越し。決定権限者: Qual-Lab。今回の持ち越し承認は履歴必須条件の変更承認ではなく、現在の実装条件を維持する。

現在の整理済み配送観測は、固定上位ACK・現在参照不存在に加え、短期履歴の対象行と結果Hashを必須としている。履歴保持期限後はこの相関を取得できず、配送残件がなくても再入場を終了できない。読み取り専用の設計確認では、過去の成功証明ではなく現在の配送残件不存在だけへ保証を限定し、真正な上位耐久ACKと現在Snapshotを必須とする最小案が成立し得ると判断した。ただし既承認の履歴必須条件を変更するため、人間承認なしに採用しない。

提案は、正規・安定読取り可能な履歴に対象行がない場合も、固定上位ACKと同じRepository・Task・Attempt・回復参照を照合し、現在の操作・回復・配送参照が明示不存在であれば配送残件なしと確認すること。対象行がある場合のHash矛盾、履歴File欠落・破損・重複・観測不能、ACK不明、対象残存、保存途中、観測変更、排他解放未確認は拒否を維持する。対象行欠測を期限切れと断定せず、過去の正常終了・Producer ACK保存・実資源回収を新しく証明しない。新しい台帳・領収書・Lockを追加せず、Taskを再実行しない。

承認時はCoordinator／Orchestratorの正本とQA期待値を先に更新し、最小実装・反証・独立レビューへ進む。不採用または保留時は、履歴相関欠測後の再入場停止が残る。現在の自動継続は本方針の承認を意味しない。

5Cの本番未採用Draft操作Identityへ固定Consumerを必須化し、既存Hash・回復ID・不変遷移とSettlement Contextへ結合した。consumer欠落版を自動補完せず、旧state／pendingは新品扱いせず保全停止する。同じoperation-identity/v1のDraft更新であり、旧固定結果を新版の根拠へ流用しない。用途別の結果登録・終了候補・限定Writerを接続し、Orchestratorだけfresh耐久ACKを必要とする。最新六局所契約・型・Lintは成功した。Docker終端・上位Reader出口は模擬であり、実返却・耐久ACK保存・本番Producerへの一体切替はまだ未完了である。

5Cの結果受領方式は、人間判断により用途別へ整理した。単体CLI／Workbenchは既存返却境界への一時的な引渡し、Orchestratorは後続再開用の耐久ACKを要求する。Producerの資源回収をConsumerの閲覧・任意保存へ依存させず、Candidate・一次失敗・未解決Recoveryは責務Ownerが別に保全する。新しい耐久結果Storeは追加しない。固定Consumerから方式を導出し、任意入力や空集合からOrchestratorを降格しない。Architecture／QA006へ反例と変更禁止範囲を伝播した。本番切替・実返却／ACK・全体回帰は未完了であり、方針採用と実装完了を区別する。

段階1〜4、段階5AのDomain Model統合と5BのAI Adapter／Platform Access移管は局所検証まで完了した。最新5B Sourceの配布閉包全133契約、AI Adapter全13契約、Coordinatorの型・固定計画と両Provider準備42契約が成功した。Native通常50試験・全target Clippy、利用側八Package型接続は確認済みだが、実環境専用Native23件、全体回帰・固定Source独立レビュー・署名E2Eは別に残る。次は5CのCoordinator共通実行・Orchestrator移管・実行記録。残るProvider別組立てを最終配置として固定しない。[計画と検証範囲](Evidence/261007_develop-responsibility-mapping.md#段階5bの局所完了判定--2026-10-08)を正本とする。

段階5C〜F、全親フォルダのFile名・責務・配置精査、段階6〜8は未完了である。局所成功や設計独立確認を、全Sourceの独立レビュー・実E2E・Release準備完了へ拡張しない。

5Cの同Process本番Task配送を、元Control捕捉→全結果読取り→上位終端とACKの同世代保存→固定Reader→下位整理へ接続した。新Processの上位受領・終了、保存途中の再入場に加え、履歴相関が残る整理後再入場も実Filesystem・上位接続の三契約と限定独立レビューで確認した。保存後応答不明・部分整理失敗でも元Task結果とACKを保持し、Taskを再実行しない。新しい台帳やLockを作らず、Task完了時のControl削除も維持する。保持期限後の相関欠測、下位出版後marker残存、実資源回収の旧入口切替、旧二試験Fileの18型指摘、実Dockerと5C全体は残る。[今回の接続と確認限界](Evidence/261007_develop-responsibility-mapping.md#新processの再開接続の順序--2026-10-09)を参照する。

5Cの過去実行unknownと現在回収義務を分離する限定方針は人間承認済みであり、v2終了要約・履歴と通常整理の限定変更をモデル四契約・実Filesystem二契約・限定独立レビューで確認した。さらにProvider要求前の同期評価保存を本番Controllerと既存Ownerへ接続し、局所109契約・Source型・Lint・限定独立レビューが成功した。元の終端Contextへの同期受領Readerの一回結合も、最新実Filesystem二契約・型・Lint・限定独立確認で成功した。新しい共有管理機構は追加していない。上位ACKの本番一体接続、fresh Process再入場、旧試験移行、実Docker一体確認と全5Cは残る。[今回の本番接続と証明範囲](Evidence/261007_develop-responsibility-mapping.md#実行評価の発生点への本番接続--2026-10-08)と[同Process受領Reader接続](Evidence/261007_develop-responsibility-mapping.md#耐久受領readerの同process結合--2026-10-08)を参照する。
