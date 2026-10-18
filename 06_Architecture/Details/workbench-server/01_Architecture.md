# CROS Workbench詳細設計

### 読取り助言の限定実試験入口

Root検証を先行し、既存Version ControlのFilesystem観測でCommit、固定文書のHash、Profile Catalogだけを照合する。試験器自身の前後照合ではGit子Processを使用せず、既存Workbenchの安全なGit読取りは変更しない。`projectContextUnchanged`／`revisionUnchanged`と`wholeRepositoryUnchangedClaimed:false`を返し、index・他Sourceの不変は主張しない。DockerのHash対象fieldは欠落・型不正と正常nullを区別する。開始前・終了後ともContainerはcreated／exited／deadのみ許容し、paused／restarting／removingや状態欠測をidleへ畳まない。

`scripts/verify-readonly-ai.ts`は、外部送信の別許可を確認した操作者が一Providerだけを明示実行する検証入口とする。`--provider codex|claude --external-send-confirmed`以外はServer／Docker観測前に拒否する。固定Profile・質問・`PROJECT_CONTEXT.md`一件だけを公開HTTP→既存Orchestrator単発Ownerへ渡す。本文・資格は記録せず、自動再送・編集・採用・再起動は行わない。timeout、一次失敗、cleanup、副次失敗、close、最終観測を別に保持する。通常回帰から実送信を起動しない。

Dockerの事前照会はDesktop省電力cacheを含み得るため、全ID完全一致をEngine同一世代の証明にしない。既定bridge／host／noneは名前・driver・local scope・default bridge指定を厳密確認し、ID差を専用診断として出す。IPAM／Options／IPv4・IPv6／internal等の捕捉構成差は許容しない。既存Containerと利用者Networkは捕捉属性と集合を保持し、未知追加・消失・欠測・重複は非成功とする。runtimeの個別cleanup確認は独立条件であり、一覧成立やeventsだけで代替しない。構成Hashは観測した属性の比較であり、全設定・Filesystem内容の完全保全を主張しない。結果は限定試験だけの成立とし、全E2Eへ拡張しない。保存台帳・Lock・Recoveryは追加しない。

Workspace再編では[横断契約](../orchestrator/03_Workspace.md)に従う。`POST /workspace/action`は同Origin・Action Token・操作別閉入力・現在development認可からOrchestratorへ直接接続し、MCPを経由しない。Browserの作業領域Panelは受付一覧の有界取得、作業領域の作成・選択、変更確認、候補固定、固定差分確認、別採用・Merge・候補終了と作業領域破棄を分ける。期待世代・Base・HEAD・Blobを確認し、応答喪失時に自動再送せず再取得へ案内する。旧Bundle candidate/actionを新Git採用の証拠に使わない。単体RepositoryのAI入口はOrchestratorの単発Task Ownerへ接続する。助言とWorkspace編集を同じ受付・Writer・Leaseへ結合し、回答本文はProcess内だけに保持する。旧Bundle用`/candidate/action`は撤去し、Workspaceの固定・別採用へ接続する。共有接続も同じ単発Ownerを利用する。現在の接続資格・主体・RepositoryごとにProcess内の表示対象を分離し、開始・観測・取消と待機後の公開前に現在development認可を再確認する。Browserは既存の同Origin資格搬送を利用し、WorkbenchからMCPへ接続しない。実装・結合検証中で、実Providerや人間による導線評価まで完了したとはしない。

成果物種別: Architecture詳細設計
詳細設計領域: workbench-server
状態: Candidate
維持責任者: Qual-Lab

CHG-000082の再編後の実装親Folderは`workbench-server`とする。WorkbenchとMCPは対等な公開入口であり、WorkbenchはLocal／共有配置のいずれでもMCPへ依存しない。共有利用はBrowserから共有Host上のWorkbenchへ接続し、Workbench Serverが同Hostの専門Package APIを直接利用する。Workbench backendから別HostのMCP／CROSへ接続する旧経路を撤去する。以下の旧Remote経路の実測は当時の成立範囲であり、MCP依存全撤去後の完成証明ではない。Browser向けWorkbench API、React＋ViteのCSR、既存画面とVisual Baselineを維持し、今回の再編でUX／IAを独断で再設計しない。

## 基本設計との関係

### Workbenchの旧MCP依存撤去契約 — 2026-10-13

Workbenchの実行時依存にはMCP Server・旧CROS Packageを含めない。単体はRepositoryの専門Owner、共有は要求資格によるAM認可後に同Hostの専門Ownerへ直接接続する。Browser向けHTTP APIと独立MCP Serverの公開能力は維持する。

起動構成は現行fieldの閉集合とし、廃止した接続fieldを単体Rootへの暗黙fallbackへ読み替えない。別Host Endpoint、Remote資格、接続・更新・切断の旧POST、共通MCP Clientと四MCP Adapterを撤去する。Mainの接続表示は単体または同Host共有の状態だけを持ち、Endpoint・Remote通知を持たない。本文とRelationの同期Reader型は既存Topic／Meeting操作の責務に置き、通信専用型・再export Fileを残さない。

旧通信専用のJSON-RPC envelopeやTool写像試験は撤去する。現在認可・失効後の旧値非表示・未選択・別Root分離・CRUD／Relation・Profile・活動の検証義務は、直接経路の管理／Browser／本文／Git試験へ維持する。これは撤去候補の設計契約であり、回帰・独立レビュー・通常CLI・共有配置が完了したことを示さない。以下の旧Remote成立記録は現在の実装Owner／依存契約に使用しない。

### 管理操作の直接AM接続 — 2026-10-13

通常本人・管理四read・七保存は`management/operations.ts`からAccess Managementの既存APIと共通結果投影へ直接接続する。管理Rootと当該要求のBearerだけを内部Contextとして渡し、MCP Tool名・Protocol・Endpoint・中継用接続型を持たない。Standaloneの信頼済み内部DIとCROSの要求専用ContextはServerで分離する。管理側で新しい認可・保存・Sessionを実装しない。

Repository登録はWorkbenchの明示操作だけで、manager／administratorの現在認可とRoot検証を既存AMが所有する。登録だけで公開せず、公開範囲は別操作。MCP Serverの独立した管理Toolと、鍵3操作・登録のMCP非公開は維持する。今回の直接接続は管理系統だけであり、Portfolio、Topic／Meeting、Profile、Activityの旧MCP分岐は別途撤去する。

### Local CROSの直接Portfolio接続 — 2026-10-13

同Processの内容投影は`project/access-reader.ts`で現在AM許可集合を取得し、Domainの固定本文ReaderとPortfolio集約へ接続する。2026-10-14承認済みの切替では、認可集合・Root不明と取消は全体停止を維持し、認可済み文書の未確認・競合だけをSource単位で保持する。非completeは本文・Role・版がnullで、全体completeにせず、読めた情報と日本語の未確認／競合表示を併記する。JSON Inspectorも不可能な状態組合せを拒否する。既存の公開前比較処理はAMの`sameAccessCollection`へ移してMCPと共用し、fresh AM集合との契約値一致とRoot観測成功を確認する。同一Pathの物理実体不変は保証しない。管理Roleから内容を生成せず、認証済み許可空集合だけ正常空Portfolioとする。Root／Binding／資格をBrowser結果へ透過せず、新State／Session／MCP依存を追加しない。新表示の実Browser・全回帰と独立確認はまだ未完了。

明示Repository選択は同Readerの`resolveAccessRepository`で現在集合へ結合する。Topic／Meeting構成は`topic-meeting/access-resolver.ts`で同Projectの許可集合を既存Domainへ渡す。指定先だけが書込みOwnerであり、未登録・非許可から起動Rootへfallbackしない。返却Rootと操作を次要求の認可証明として保持せず、HTTP入力完了後の当該要求だけに使用する。

内部Readerに続き、Serverの`localAccessRoot`構成と専用`/local-connection/action`を局所接続した。CROS起動は配布用Logo／固定JSだけを読み、起動RepositoryのContext／Topic・Meeting／Profile Catalog／活動Readerを構成しない。未認証GETは非秘密access Model、接続POSTは確認後200の閉じたJSON（status: completed）だけを返し、通常読取りは次GETが現在資格で取得する。共有Browserで主体が混ざらないよう、CROSの通常要求は一つのAuthorization HeaderのBearerから当該要求だけのAM Contextを構成し、Server全体にログイン鍵・本人投影・接続Noticeを保持しない。重複・不正・欠落Headerは資格なし、不成立・状態不明は本人／内容非表示とする。Action Tokenは共通の用途限定入力条件であり認証ではない。各要求で現在資格と操作認可を取り直し、Aの接続をBの資格へ転用しない。切断はBrowserが鍵のmemory参照を捨てる操作で、他Browserをログアウト・資格失効させない。既存の同Process管理／鍵操作へ接続するが、Browserのmemory保持／Header送信はSource接続と鍵管理／接続の局所実Browser確認済みで、選択Repositoryの全内容入口はまだ未接続で、起動Rootへのfallbackをせず拒否する。この拒否は完成ではない。公開CLI、実Browser・共有TLS配置・全入口の終了保証は未完了であり、管理画面や局所HTTP成功からWorkbench全体成立を表示しない。

Local接続の完全Formは同Origin・Host・Content-Type・Body容量をHTTP Ownerが検査した後、既存`credential/administration.ts`の`authenticateWorkbenchConnection`へ渡す。許可fieldはactionToken／operation／tokenだけで、重複・未知field・用途差・取消は認証前拒否する。初回限定資格は既存AM確認保存へ接続し、出版完了後のfreshな通常認証に成功した場合だけ当該要求memoryの接続資格を返す。初回相関を内容Authorityへ変換しない。保存後取消は保存取消ではなく応答停止であり、次要求が現在状態を再確認する。内容操作は別途要求ごとに現在認可を取り直す。鍵・Rootは通常Model、URL、log、Browser Storageへ含めず、新Session保存は作らない。専用Local HTTP POSTは局所接続済みで、資格を完了後に保持しない。次要求は単一Authorization Headerでfresh認証する。Browser memory／Header送信はSource接続と鍵管理／接続の局所実Browser確認済みで、公開CLI、共有TLS配置、全内容入口は未接続であり、全体完成の根拠ではない。

### Browserの接続資格と応答搬送 — 2026-10-13

`workspaceIds`はRepository全体の公開先利用範囲であり、Role範囲とExposureの交差が非空のRepositoryを選ぶ。同一Repository内のPath・ファイル・Context Surface別ACLは提供しない。情報境界が必要な内容はRepositoryを分離する。この意味は[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md)の既存採用であり、Root検証だけで現在認可を省略する許可ではない。

`browser/connection.ts`は当該タブmemoryの鍵参照と要求世代を所有する。接続確認POSTの200・閉JSONを確認してから鍵を保持し、次のAPI要求だけにAuthorization Headerを添える。Serverは毎要求の現在認証・認可を所有する。切断・画面終了でmemory参照を解放し、URL、Web Storage、Cookie、通常Model、logへ鍵を保存しない。物理的なstring消去や外部Effectの取消は保証しない。

同Origin以外への送信とCaller指定のAuthorizationは拒否し、redirectを追従しない。本文は16 MiBまで読み、上限超過時はReaderを取消・解放する。応答待機後にも要求世代と取消を確認し、旧接続の応答を次の主体へ渡さない。自動再送はしない。接続POSTの失敗・不明では資格参照と旧表示を破棄し、既知保存をrollbackしない。

Browserのmanual redirect応答はstatus・Header・本文を隠すため、303を接続確認に使わない（[Fetch Standard](https://fetch.spec.whatwg.org/#concept-filtered-response-opaque-redirect)）。接続結果は秘密・本人・内容・管理情報を含まない確認だけであり、内容は後続のfresh認可要求で取得する。Sourceと合成Transportに加え、鍵管理／接続の局所実Browser8件とWorkbench回帰50件を確認した。限定独立再レビューは残指摘0である。全内容Navigation・共有公開配置・公開CLI・MCP依存撤去・正式191項目の成立は未確認であり、この局所成功を全体完成へ流用しない。

### 現在候補のCSR画面遷移

選択RepositoryのGET接続では、今回AMが確認した一つの短命許可集合から選択Root・Portfolio・同ProjectのTopic／Meetingを構成し、ContextのRepository／Project IDとmanifestを相関する。Surface・本文・一覧・Relation・Git観測とModel構築後の公開直前に、既存AMで全Rootを再観測し、管理改訂とRepository ID／Binding／manifest全契約field／workspaceIdsの正規化全集合がexact一致する場合だけ応答する。差異・不明・取消は旧内容を部分公開せず固定拒否とし、その照合後に外部I/Oを追加しない。repositoryIdは0件またはexact1件だけ受け、空1件は選択解除、重複は認証・AM・Root本文観測前に拒否する。新Session／Lock／Cacheは追加しない。起動Rootや前要求の結果へfallbackせず、直前操作・AI／Candidate結果は要求専用のnullとする。共有側Profile情報の`aiProfiles: null`は未取得を表し、0件・不存在・利用不可を意味しない。Inspector、一覧表示とAI依頼入力は同じnull意味を保持し、単体の既定Catalogを維持する。内容POST接続まで共有側の内容保存Formを無効化する。この途中GET接続は保存・本文リンク・共有配置の完成ではない。

`browser/entry-client.tsx`は既知のMain／Project／Topic／MeetingリンクとGET検索を同OriginのModel取得へ接続する。外部リンク、別タブ・修飾クリック、download、POSTを一律に横取りしない。明示Repository IDを検索・内部移動で落とさず、Serverの現在認可で再解決する。URLのIDを認可証明や物理Rootとして使わない。

表示要求は専用世代とAbortControllerを持ち、前要求を取消し、待機後に世代を再確認する。取得・契約検査後だけhistoryと新Modelを採用し、historyへ資格や業務Snapshotを保存しない。戻る操作はfresh取得を行う。失敗時は古い内容を保持せず固定blocked表示とし、自動再送しない。画面移動でタブの資格を永続化せずに維持する。

pagehideでは監視・所有fetch・React Root・資格参照を解放する。cacheからのpageshow再開は資格なしで新Rootとfresh Modelを構成し、旧Snapshotを復元しない。実Browser内の合成pagehide／pageshow通知はこの解放・再開callbackの検証であり、Browser cacheの採用可否・実際の保存復元の証明ではない。

この段落はGET navigation接続時点の記録である。現在の選択RepositoryのTopic／Meeting POSTは後述の共有Record Formで局所Browser接続候補となり、Git操作、`/change`／`/owner-artifact`本文リンク、共有公開配置等は未接続である。全画面移管完了を主張しない。基準版のAI／CandidateはRepository単体Compositionだけが成立対象であり、CROSの選択Rootへ起動Repositoryの実行Ownerを流用しない。未接続AIを今回暗黙実装せず、後半実行系の未接続として保持する。

### 共有Profileの直接Owner接続契約 — 2026-10-13

Workbenchの起動構成は、既存AI Adapterの検査済みHost Catalog Administrationを用途限定で注入する。CROS管理Rootと併用し、単体Modeへの混合注入を拒否する。Browserは保存Rootを指定できず、未構成・Store不成立・破損を起動RepositoryのCatalogへ補完しない。LinuxのAM stateとCatalog configのRootは異なり得るため、AM PathからCatalog Pathを合成しない。

一覧は要求資格から既存AMの現在Profile管理認可を確認し、manager／administratorの場合だけ一つのOwner Snapshotを取得して一覧と管理表示へ投影する。developerや資格不成立ではsnapshotを呼ばず、選択Repositoryの内容許可をProfile管理許可へ読み替えない。保存は閉じたForm・Origin・Action Token・入力上限・取消を確認した後、fresh認可を通して既存Administrationへ一回だけ委譲する。結果はAI Adapterの既存相関検査を使用し、後段失敗・取消を未保存やrollbackへ畳まず再送しない。AM LockをCatalog処理へ持ち越さず、新Store・Session・認可Cacheを作らない。

Browserでは既存のProfile Form／TableをMainとAccessの同じComponentから利用する。共有管理の一覧・保存は同Origin専用APIへmemory資格Ownerを通して搬送し、Browserは非秘密の閉Snapshotと送信操作に相関した結果だけを検査する。保存確認後のfresh取得故障は「保存済み・現在設定未確認」、保存応答の喪失・不正は「変更結果未確認」として分離し、旧Catalogを現在値へ補完せず自動再送しない。明示再取得はGETだけを行う。二重送信は同期guard、取得取消・終了・Owner／Action Token切替は所有Signalと世代で扱い、旧結果・通知を次の主体へ持ち越さない。内容Repositoryの許可はProfile管理の前提にしない。

これは実装に適用する接続契約であり、公開CLI・Browser全反証・Visual評価・旧MCP経路撤去が既に成立したことを表さない。Repository単体の資格不要管理と独立MCPの四管理操作は維持する。

### 選択Repositoryの内容操作と本文への接続契約 — 2026-10-13

共有内容操作は起動Repositoryや前要求の操作Objectを利用しない。同Origin・Host・Content-Type・Query・Body上限を確認し、Body搬送完了後の閉Formから一件だけの明示Repository IDを取得する。操作別の許可field、scalar重複、ID・期待改訂、確認・Markdown等を検査してから、fresh AM許可集合Cを取得する。createへ既存契約にないID／期待改訂の入力を要求しない。

Topic／MeetingはCの同Project集合から既存Domain操作とRelationを構成する。Gitは選択Rootの既存Version Controlへ委譲し、Stage／Unstage／Commit／明示確認済み通常Pushを維持する。任意command、Force、再送、Domainへの資格搬送、新Recovery／ACKは追加しない。Effect直前に対象Identityと取消を確認し、一回だけ配送する。保存開始後はOwnerの終了を待ち、取消からrollbackを推定しない。

処置前拒否、配送後の結果未確認、既知処置後の現在投影未確認を分離する。結果公開前にはC2と取消を確認し、現在認可不成立で対象本文・Metadataを公開しない。確認済み処置を未保存へ書き換えず、非秘密の固定通知で現在結果の公開不可を示す。要求ごとの結果をServer全体の直前結果へ保持しない。

`/change`と`/owner-artifact`も今回の選択Rootを使用する。宣言されたID／Pathだけを既存Readerへ渡し、Owner Artifact Catalogは当該Rootの現在Contextから構成する。読取り後のC2と取消を確認する。Browserは同Originの既存資格搬送で原文を取得し、Reactのtextとして表示する。資格付きURL、任意Path、raw HTML／Markdown実行、起動Rootへのfallbackは追加しない。

これは③の実装対象契約であり、現在の未接続操作の拒否を正常能力の成立証明にはしない。入力待機中の失効・公開変更、同名IDの別Repository、異Project Relation、保存後認可故障・応答喪失・取消、実Git Process終了と要求joinを検証してから旧経路を撤去する。

Gitの直接接続候補では、閉Formを既存Version Control要求へ変換し、今回AM集合の選択Rootだけへ一回配送する。Pushは既存Target観測のavailable・公開先・Branch・Revisionと要求が一致する場合だけ許可し、任意URLや別Remoteへ読み替えない。同期Git終了の前後に通信通知を処理し、取消・C2不成立では成功本文を返さない。既存Ownerの七field結果は操作・理由・Effect・Revisionへ相関し、blockedでも発行済みEffectを保持する。配送後例外は固定503で結果未確認とし、共有の直前結果・新Store・ACK・Recoveryは追加しない。Browserと実行中切断の成立は別途確認する。

Browserの共有Git接続は既存Repositoryフォームを再利用し、選択ID・Tokenと閉Formを送信前に照合する。要求ごとの結果を操作・理由・Effect・Revisionへ相関し、同期pending guardで二重送信を拒否する。既知完了／拒否／不明とfresh GETを分離し、取得故障では旧Git状態・操作フォームを表示しない。再取得はGETのみとし、終了・対象切替では所有Signalと世代で旧結果を拒否する。単体は従来入口、同Host CROSは明示接続済みの操作だけ有効化し、旧Remoteの表示・操作を持たない。Git差分・Branch・Remote設定の意味はVersion Controlが所有し、Browser独自の保存・再送・ACKを作らない。

### 選択成果物の原文表示 — 2026-10-13

Owner Artifact一覧は本文表示の成立条件と分離する。通常File・相対Path・実PathのRepository内所属を確認し、開いた実体と読取り前後を照合して先頭最大8KiBだけを読む。その範囲内の完全行から第一H1を得て、未完了行・UTF-8途中・見出し未観測は相対Path表示へ戻す。handleは成功／失敗ともcloseし、read／close・実体変更の不明では一覧全体をunknownとする。一覧のavailableは掲載対象の観測成立であり、全本文の表示可能性を保証しない。大きい文書が含まれても計画投影と一覧を失わず、明示本文要求には従来の512KiB制限を維持する。新しいCache・Store・公開fieldは追加しない。

`/change`／`/owner-artifact`のnative GETは固定Document Shellだけを返し、原文は既知CSR navigationから同Originの`/api/workbench-view`へ要求する。同Host CROSでは今回の明示Repository IDをAM集合のRootへ結合し、CHG-ID固定Readerまたは選択Rootの現在Owner Catalog Readerをawaitした後、取消と既存C2を確認して公開する。単体は検証済みContextのRepository IDを出所とし、別IDを明示した要求は拒否する。旧RemoteではMCP照会も起動Root原文fallbackも行わない。

Queryは本文種別ごとのroute／repositoryId／idまたはpathだけをexact一件で受け、重複・余剰・越境はRoot本文観測前に拒否する。Readerは従来のlexical／realpath／通常File／非link境界と512KiB上限を維持し、取得したUTF8文字列の容量も再確認する。async読取りを途中放棄せず完了をjoinし、取消・失効・公開集合／manifest変化では本文を返さない。新Cache・Lock・Recoveryは追加しない。

閉じた`artifact` Modelは出所Repository ID、共有選択（単体はnull）、種別、既存Identity（CHG-ID／相対Path）と原文だけを持つ。Browserはkind／Identity／選択と要求URLの一致、512KiB、余剰fieldを検査し、原文をReactの`pre` textとして表示する。Markdown／HTML／本文linkを実行・操作入口化しない。戻る／履歴移動は現在選択とmemory資格を保持してfresh取得し、遅延旧応答を採用しない。reload／新タブは資格なしで接続画面へ戻し、私有本文を復元しない。このAPI Media Type変更は原文取得能力をJSON→text表示へ移すもので、旧native text/markdownを併存させない。

本文接続は実HTTP・実Browser・全Browser回帰と限定独立レビューで確認した。これは本文能力の限定成立であり、Git操作・通常CLI・共有配置・旧Remote撤去・正式191項目とAM全体完成は別に確認する。

### 共有Record FormのBrowser搬送 — 2026-10-13

Main／Record Detailの既存Topic・Meeting Formは`browser/record-operation-panel.tsx`の同じ要求専用搬送を使用する。`recordActionsConfigured`は直接Ownerへ接続したModelの表示可能性を表すbooleanであり、認可ではない。単体は既存native Form、新同Host CROSは現在資格付きJSON POST、旧Remoteの表示・操作は持たない。同じ`cros_available`表示から操作可否を推定しない。

送信前にFormのRepository ID／Action Tokenを現在Modelへ照合し、File・重複を拒否する。未選択のcloseMeeting／confirmedは一件のfalseへ変換し、hidden false＋checkbox trueの二重値や暗黙trueを作らない。同期pending guardで一回送信し、所有Signal・画面世代で終了後採用を拒否する。結果は同じ要求の閉じた五fieldから操作・種別・理由・Effectを確認する。結果にRecord IDは含まれないため、別要求・別対象の実測証明へ転用しない。

既知completed／blockedと後続fresh取得は別の事実として扱う。再取得が失敗した場合は既知結果を保持し、以前の本文・FormをCurrent表示しない。不正・喪失した保存応答は未保存と判断せず、明示再取得もGETだけを行う。URLのroute／query／選択Repositoryを保持して応答の選択とSignalを再確認する。Detailの削除後は同じRepository一覧へ移り、その他の操作は同じDetailを再取得する。Serverの保存とC2は既存契約のままで、Browser独自の保存、rollback、Session、ACK、Recoveryは追加しない。

この実装候補はTopic／MeetingのBrowser接続であり、未接続Git操作・本文入口・通常CLI・旧Remote撤去や③全体の完成を意味しない。実Browserの操作、二重送信、応答故障、取消と終了後状態を確認してから限定Gateを判定する。

### 活動Ownerの結果と画面投影 — 2026-10-12

同Hostの活動読取り前後では、既存の通信待機処理を一回ずつ通し、切断通知を処理してから要求Signalを確認する。開始前の切断はReaderへ渡さず、開始中の切断は同期読取りを放棄・再実行せず完了をjoinした後で成功本文を抑止する。これは同期Filesystem I/Oの途中中断を保証するものではない。

同Host CROSの選択Mainでは、要求内の単一AM集合から選択RepositoryのProjectと同Project対象全件を導出し、既存Orchestratorの`readAuthorizedRuntimeActivity`へID・技術Root・20件上限・任意Cursorだけを渡す。資格・Role・Bindingを活動Ownerへ渡さず、Query自己申告Projectや起動Rootを使わない。既存の表示変換は現在状態と履歴の不明を分離し、Cursor不正・Reader故障を先頭ページや空成功へ補完しない。同期読取りの強制途中取消は追加せず、開始済みReaderの終了を待ってCallerが取消と公開直前のAM全集合一致を確認する。Activity故障のunknown表示と、AM集合不成立のMain全体拒否を分ける。保存・初期化・Task実行・新Cacheは追加しない。旧Remote ActivityのMCP分岐の撤去と公開CLI／共有配置の完成は別途必要である。

旧REST受取経路もOrchestratorの検査済み活動観測を使用する。Remote Clientが要求Projectと応答Projectの一致を確認した後、`projectRuntimeActivityForWorkbench`が現行画面のPropertyだけを新Objectへ再構成する。結果直下のProject／Source／現在OwnerとEventのRepositoryを暗黙転記しない。現在状態と履歴状態は独立して保持し、観測済み履歴理由だけを画面所有の`execution_events_observed`へ写す。unknown・空履歴・Continuationの意味は保持する。画面に出所を表示する判断や同型通信DTOの新設は含めない。

Repository単体の活動Readerも同じOrchestrator APIへ直接接続する。構築時にDomain ContextのProject／Repository IDをコピーして固定し、要求Project不一致またはRoot不成立では観測不能を返す。Workbench独自の履歴解析・並び替え・Cursor生成は廃止する。現在Revisionは活動Ownerが取得し、Push先やupstreamの設定を読取り成立条件にしない。既定20件、上限50件と不正Cursor拒否はOwnerの契約に従う。旧二要素Cursorは移行せず、フロントAIは既存画面の短命Cursorを破棄して新規取得する。公開factoryの第二引数に固定Identityを必須化するSource API変更であり、永続状態Schemaを変更しない。旧Remote経路撤去、公開Launcher、全体完成は別途確認する。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project／Portfolio状態を、欠測と根拠を保った画面へ投影する。 | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingを一覧・詳細・操作Flowへ接続する。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | 検証済みRepository境界をWorktree表示へ接続する。 | Covered |
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | AI ProfileとTool Capabilityを選択可能な表示へ接続する。 | Covered |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | Local／Remoteの入口差を同じApplication意味へ適合する。 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | 現在認可された情報の表示、通常管理の入力・結果搬送と同一Processの通常鍵操作をAccess Managementへ委譲する。 | Partial。論理初回接続・v2目標Schemaは具体化済み。具体API・提示観測の実装／実境界・移行・本番接続はOPEN |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 外部AI依頼、結果帰還および候補採否の境界を表示する。 | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | 現在有効な意図と履歴正本への導線を提供する。 | Covered |
| [ARCH-000017](../../Definitions/ARCH-000017/architecture_definition.md) | 承認済みCRDD公式ロゴをApplication Brandへ使用する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Shell、Server、AdapterおよびPortの責務を分ける。 | [§3](#3-componentと責務) |
| Interface Model | Required | Browser、HTTP、Application Contractおよび外部境界を固定する。 | [§6](#6-interfaceとinteraction境界) |
| Data Flow | Required | Canonical SourceからView ModelとDOMまでの搬送を示す。 | [§5](#5-dataと状態) |
| State Model | Required | loading、ready、partial、restricted、unknown、failedを区別する。 | [§5](#5-dataと状態) |
| Sequence | Required | 要求、受理、Effect、結果、回復を分ける。 | [§6](#6-interfaceとinteraction境界) |
| Failure／Recovery | Required | 部分成功、競合、結果不明および安全な再入場を扱う。 | [§8](#8-failureとrecovery) |
| Deployment | Required | localhost ServerとBrowser UIの配置を固定する。 | [§4](#4-実行配置モデル) |
| Observability | Required | DOM、HTTP、Application結果、外部Effectを別に観測する。 | [§11](#11-quality引渡しの要約) |
| Security Boundary | Required | loopback、現在認可範囲、Repository Root、外部送信を分ける。 | [§6](#6-interfaceとinteraction境界) |
| Implementation Structure | Required | Production packageの責務分割とVariationを評価する。 | [Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 並行Request、Projection再取得および書込み結果をRequest Identityと期待Revisionで分離する。 | [Componentと責務](#3-componentと責務) |
| Timing | PASS | loading、更新中、timeout、結果不明を区別し、期限超過を失敗または不存在へ畳まない。 | [FailureとRecovery](#8-failureとrecovery) |
| Resource Lifecycle | PASS | listener、request、session、child processのOwnerと終了後条件を固定する。 | [実行・配置モデル](#4-実行配置モデル) |
| External Boundary | PASS | Git、Remote CROS、AI Provider、Filesystemを別境界として扱う。 | [InterfaceとInteraction境界](#6-interfaceとinteraction境界) |
| State／Consistency | PASS | Projection Identity、期待Revisionおよび再観測によってstaleな画面からの無断更新を防ぐ。 | [Dataと状態](#5-dataと状態) |
| Failure／Recovery | PASS | partial、restricted、conflict、unknownと安全な再入場を分ける。 | [FailureとRecovery](#8-failureとrecovery) |
| Observability | PASS | View State、Application Result、Effect、終了後資源を独立して観測する。 | [Qualityへの引渡し](#qualityへの引渡し) |
| Security／Trust | PASS | localhost既定と既存Authorityを維持し、非開示SourceやSecretを画面へ露出しない。 | [InterfaceとInteraction境界](#6-interfaceとinteraction境界) |

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `workbench.component-boundary` | Component／Responsibility | Browser UI→Workbench Adapter→公開Application Contract | UIが正本やAuthorityを所有せず同じ契約を利用する | Screenが独自状態や書込みを実装する | ST | System/E2E | import、request、result、Owner | 重複正本0、未所有Effect 0 | Project Context、Topic／Meeting、Version Control、Credential、AI Profile／Request、Runtime ActivityおよびOwner Artifact PortをProductionで観測済み。15画面のProduction DOMは実Browser Visual Gateで全数観測済み |
| `workbench.interface-boundary` | Interface／Security | Browser→localhost Server→Consumer Port | loopbackと既存Authority内だけで要求を搬送する | 外部Bind、内部型露出、Grant越境 | IT | Direct Boundary | bind address、request、Grant、response | listener 0、秘密再表示0 | localhost、Credential管理、Bearer Remote Transport、Browser接続入口、および外部TLS終端から同一Origin Gatewayへの境界を観測済み |
| `workbench.view-state` | State／Consistency | Projection→View Model→DOM | partial、restricted、unknownを区別する | unknownをempty／completeへ畳む | UAT | User Acceptance | state、coverage、source、表示 | staleな成功表示0 | Topic／Meeting未構成、Remote失効、Git観測不能、AI未接続、Runtime absent／unknown、Owner Artifact unknownをProduction DOMで分離済み。人間受入は未完了 |
| `workbench.interaction-sequence` | Sequence／Effect | 操作→要求→受理→Effect→結果→回復 | 各段階を区別し結果不明時に暗黙再送しない | request発行を完了と表示する | IT／ST | Direct Boundary／System E2E | request identity、effect state、result | 重複Effect 0 | Repository Work、Topic／Meeting、Credential、接続、AI Profile、現在Session AI Port、署名済み読取り助言Production Runtimeおよび変更候補の確認・採用・破棄境界を局所観測済み。実Provider E2Eは未確認 |
| `workbench.resource-flow` | Data Flow／Lifecycle | listener、request、session、child process | shutdown後に所有資源が残らない | Browser closeだけでcleanup完了とする | IT／ST | Direct Boundary／System E2E | handle、OS固有のexactな世代Identity、listener、temporary resource | 所有資源0 | localhost ServerのListener／Connection cleanupに加え、15画面の実Browser Process、専用ProfileおよびWorkbench Listenerの終了後不存在を観測済み。Visual Runnerは終了要求直前にTreeを再取得し、正常終了後5秒の猶予、同一世代Identityの残存子Processだけへの限定Fallback、最終30秒の不存在確認を順に行う。一段のcleanup失敗後も後続段を試行し、終了処理とTree観測の所要時間を記録する。実Browser 27条件は全件成功し、局所ITでは親終了後に残る子ProcessへFallbackを実発行して最終0件を確認した。読取り助言Runtimeの実Provider E2Eは未確認 |
| `workbench.failure-recovery` | Failure／Recovery | conflict、partial、unknown、provider failure | 入力と確認済み結果を保ち安全に再入場できる | 自動再実行、無断上書き、事実損失 | ST | System/E2E | retained input、result classification、next action | 未承認Effect 0 | Push結果不明は観測済み。他のOperation／Providerは未確認 |
| `workbench.mode-variation` | Variation／Common Contract | Repository単体／Local CROS／Remote CROS | 可用能力差を示し同じ結果意味を保つ | Modeごとに状態語彙やAuthorityが変わる | IT | Direct Boundary | mode、capability、result schema | 未許可Source読取り0 | Browserからの接続・更新・切断、Remote Portfolio取得、許可済みSource選択、Remote Topic／Meetingの一覧・詳細・書込み・Relation遷移、失効後Unavailable、およびREST／MCP同一HTTPS Origin契約を観測済み |
| `workbench.screen-composition` | UI Composition／Visual | Direction Aの15 Screenと公式ロゴ | 公式ロゴを左上に表示し各Profileで主要Flowを利用できる | 代替Logo、横Overflow、Focus不能、情報階層崩壊 | ST | System/E2E | image load、DOM、zoom、viewport、keyboard | Browser資源0 | [実Browser Visual Gate](../../../99_Roadmap/Changes/CHG-000082/Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)で15画面、Desktop／Tablet／Mobile、100%／200%／400%の27条件を全数観測済み。人間UATは未完了 |

## 現行実装との照合

現行Repositoryには`40_Develop/workbench-server`のProduction Workbench packageが存在する。`04_UI/Details/Visual/workbench-hero`は設計Evidenceであり、Production Sourceや実装済みCapabilityとして扱わない。Production packageへ接続したCROS、Project Operation、Version Controlおよび公式Assetは、下記Reality Auditと検証結果で現在の成立範囲を区別する。

## 1. 目的と結論

CROS Workbenchは、Project Context、Topic、Meeting、Quality、正本Relation、AI依頼およびRepository作業へ進む人間向けの薄い利用面である。Workbench専用の業務正本、Authority、Access判定またはGit実装を持たず、既存の公開Application Contractを画面へ適合する。

最初のProduction実装は、TypeScriptで実装するlocalhost限定Node HTTP Serverと、Reactで構成するBrowser UIの組合せとする。ViteはBrowser Clientの決定論的なBuildだけを所有し、認証、Server Action、正本読取りまたは業務Effectを所有しない。同じView ModelとInteraction Contractを将来のRemote CROS接続でも使用できるようにし、Next.js等のFull-stack FrameworkやElectron等のDesktop包装は現在の成立条件にしない。

左上のブランド表示は[CRDD公式ロゴ](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg)を使用する。文字、仮図形、絵文字または独自の類似画像へ置換しない。

## 2. 対応するArchitecture責務

| Architecture ID | Workbenchが利用する責務 | Workbenchが所有しないもの |
|---|---|---|
| ARCH-000005 | Project／Portfolioの状態投影 | Project状態、受入判断の正本 |
| ARCH-000006 | Topic／Meetingの一覧、詳細、候補と引渡し | Topic／Meetingの意味とLifecycle規則 |
| ARCH-000009 | 検証済みRepository境界 | Repository Rootの推測、Git実装 |
| ARCH-000010 | AI ProfileとTool Capabilityの表示・選択 | Provider能力、Model Registryの正本 |
| ARCH-000012 | Local／Remote入口で同じApplication意味を使う | TransportによるAuthority生成 |
| ARCH-000013 | 現在認可されたContextの表示、通常管理と通常鍵操作の人間向け入口 | 認可判定、ユーザー／Role／資格の正本、Host CLIの実行・回復 |
| ARCH-000015 | 外部AI依頼、結果帰還と候補採否 | 外部送信許可、候補内容、Canonical Repositoryの無断更新 |
| ARCH-000016 | 現在有効な意図と履歴への導線 | Git履歴やCHGの代替正本 |
| ARCH-000017 | 公式ロゴの出所と用途 | 新しいBrand Assetの自己承認 |

## 3. Componentと責務

```text
Browser
└ Workbench Client-side React UI
   ├ React Application Shell
   ├ Screen Router
   ├ View Model Renderer
   └ Interaction Adapter
            │ localhost HTTP／将来Remote HTTP
            │ fixed Document Shell + safe JSON Read Model + Action POST
            ▼
   Workbench Application Adapter
      ├ Domain Model公開API（Context／Topic／Meeting／Owner読取り）
      ├ Access Management公開契約（同一Processの現在認可・通常鍵操作）
      ├ AI Adapter公開API（Profile管理）
      ├ Version Control公開API
      ├ Coordinator公開API（単体AI依頼）
      ├ Orchestrator公開API（上位Task／候補採用／状態照会）
      └ Official Asset公開API
            │
            ▼
既存の公開Application Contract／Adapter
```

| Component | 所有する責務 | 所有しない責務 |
|---|---|---|
| React Application Shell | Global Navigation、現在Project、表示領域、左上の公式ロゴおよび全画面DOMのClient-side描画 | Project状態、認証判定、Git状態 |
| Vite Build Adapter | Browser Clientの依存解決、最小化および固定配布Asset生成 | Runtime Authority、Server Routing、業務状態、Secret注入 |
| Screen Router | SCRと選択ContextのNavigation | Business Lifecycle、正本Relationの生成 |
| View Model Renderer | 公開結果をVisual Stateへ変換 | 欠測、制限、結果不明の推測補完 |
| Interaction Adapter | 利用者操作を既存Application Requestへ変換 | Authority、Retry許可、Effect成功の生成 |
| Workbench HTTP Server | localhost listener、静的Asset、Application request、shutdown | Project／Git／Credentialの意味 |
| Consumer Adapter | Domain Model、Access Management、Version Control、Coordinator、Orchestratorの公開契約を画面要求へ適合する | 具象内部型や秘密を画面へ漏らすこと。下位からWorkbenchをimportさせる逆依存 |

### 3.1. Packageと公開入口

`40_Develop/workbench-server`のsrcは実責務で分ける。`browser`はCSR描画と同Origin資格搬送（browser/connection.ts）、`management`は非鍵管理の要求と結果検査、`credential`は鍵管理の接続を所有する。`project`／`project-plan`／`quality`／`owner-artifact`／`activity`／`topic-meeting`／`ai-profile`／`ai-request`は各能力の表示・操作適合を所有し、下位の意味や認可を再実装しない。src配下は二階層以内とする。Browser Componentだけが`.tsx`とReactのvalue importを所有し、Server Graphへ混ぜない。Rootの`index.ts`は起動・終了の公開入口、`server.ts`はHTTPと構成を所有し、Screen Component全数をServer入口から再exportしない。`bin/workbench-server.ts`は一つの起動入口、反復検証はscripts、fixtureはtestsに置く。tools入口は本体へ配送し、表示・業務・構成を複製しない。

本体構成Rootが下位の公開APIへ直接依存する。ここでいうAdapterは要求・結果の局所変換であり、下位へWorkbench専用Portを注入するFrameworkではない。AI Profile本体はAI Adapter、共有Profile管理操作の認可はAccess Management（現在manager／administratorへ直接接続済み。通常起動は⑤）、共通実行はCoordinator、上位Objective／候補採用はOrchestrator、成果物CRUDはDomain Modelが所有する。

## 4. 実行・配置モデル

```text
[Local Repository Mode]
React Browser UI ── localhost ── Node Workbench Server ── Repository-local Ports

[Local CROS Mode]
React Browser UI ── Workbench API ── Access Managementの現在認可 → Domain Model等の内部能力（同一Process）

[同Host CROS Mode／共有配置]
React Browser UI ── Workbench API ── Access Managementの現在認可 ── 同Host専門Package
独立MCP Server ── 同じ専門Package（Workbenchとの相互依存なし）
                                                         └ 現在認可済みRepositoryだけ

[Build]
React／TypeScript Source ── Vite ── fixed Browser Bundle
                                      └ Node Serverがexact allowlist配信
```

- Local Serverはloopbackだけで待ち受け、任意Interfaceへ公開しない。
- Repository単体利用はCROS Credentialを要求しない。
- CROS利用時は要求Credentialを接続へ渡し、Access Managementが現在ユーザー・Role・操作権限を評価する。同一Processの直接呼出しでも現在の認可・Exposureを確認し、認可を省略するLocal特例を作らない。Repository単体利用は別の範囲であり、CROS認可へ暗黙昇格しない。
- Browser BundleはViteで生成する派生物であり、React／TypeScript Sourceとは別の設計正本にしない。固定Pathは再編後の`40_Develop/workbench-server/dist/client/assets/workbench-client.js`へ移し、Buildなしで起動可能な配布物へ含める。Coordinatorから到達する実行閉包にWorkbench Bundleを無条件で加えず、Workbench配布・公開Assetの完全性とCoordinator署名範囲を区別する。Build不能、配布集合外、Asset欠落またはallowlist外要求では固定・起動・配信を拒否する。旧Pathは移行前のEvidenceとしてのみ扱う。
- Node Serverは空のDocument Shell、固定AssetおよびJSON Read Modelだけを配信し、Browser Clientが全画面DOMをClient-side Reactで構築する。JSONはCredential verifier、Remote接続Bearer、Private Key、Host Pathおよび永続Authorityを含まず、同一Originの明示POST用のProcess限定Action TokenとCredential操作直後の一回表示Tokenだけを用途限定Fieldで扱う。SSR、Hydration、Raw HTML Fragmentおよび既存DOMの再読取りは行わない。
- React要素を生成するPanelと共通表示ComponentはBrowser Clientだけがvalue importする。Node CLI／Serverから到達するRuntime依存GraphはApplication、Read Model生成、Authority、HTTPおよび固定Asset配信だけを含み、React／React DOMまたはBrowser描画Moduleへ到達しない。型参照はRuntime依存として扱わないが、value import／再Export／dynamic importは配布候補固定前に閉集合で検査する。
- Browserを閉じたことだけでServer終了を推定しない。明示shutdownまたはOwner Process終了でlistenerと進行中requestを回収する。
- Next.js／Server Action、Desktop wrapper、OS tray、auto update、installerは`N/A`: 現在の利用者成果に必要な根拠がなく、Node側の既存Authority境界と責務が重複する。

### 4.1. 接続と操作の直接Owner接続

Workbenchは単体・共有とも同Hostの専門Package APIを直接利用する。別Hostの機能を利用する場合、BrowserがそのHostのWorkbenchへ接続する。Workbench backendに別Host接続、MCP Client、loopback、REST fallbackを設けない。旧Endpoint設定・短命接続の整理はフロントAIの移行手順が担当し、Runtime互換Readerは持たない。

| 操作 | 現行の直接接続 | 維持する結果・制約 |
|---|---|---|
| Portfolio取得 | project/access-reader.ts → AMの現在集合 → Domain本文／集約 | 五場面、検索・状態・継続、Source分離、欠測・不明、全集合再照合 |
| AI Profile一覧・変更 | AMの現在管理認可 → AI Adapterの注入済みHost Catalog | manager／administrator、期待改訂、登録済みModel、削除確認、保存一回、取得不能を空成功にしない |
| Runtime Activity | AMの同Project集合 → Orchestratorの活動Reader | Project・Cursor、現在状態と履歴のunknown分離、開始済みReader join、取消後成功本文0 |
| Topic／Meeting | AM集合 → Domain操作／Relation | 指定Root、CRUD、競合、Outcome全件処置後Close、昇格、現在認可と非開示 |
| Git | AMの選択Root → Version Control | Stage／解除／Commit／確認済み通常Push、現在Target相関、一回処置、結果不明と再送0 |
| 鍵管理 | credential/administration.ts → 同Process AM | administrator専用、一応答だけの提示、MCP非公開、秘密を汎用GET・Storageへ保持しない |

共有の入力は同Originの接続資格だけとし、Browserタブのmemoryから当該要求Headerへ搬送する。内容／管理要求は毎回現在のAM認可を確認し、保存／取得後の取消・現在集合差では結果を公開しない。旧ProjectionをCurrentへ補完せず、終了・対象切替・遅延通知は既存の要求世代とSignalで拒否する。保存済みEffectを切断で取り消したことにせず、表示用の新Recovery／ACK・共有Sessionを作らない。

鍵の通常操作はAMが所有し、Host回復・初回設定は承認済みHost入口が所有する。Workbenchは通常鍵操作の一度提示と案内を担当する。MCPの一覧・Schema・dispatchへ鍵操作を追加しない。OSログイン済みHost操作者へ追加認証を要求しない。

起動時の--crosによる単体／共有の明示選択、Host設定の接続、TLS共有公開は⑤の未完了対象である。単体は現在Rootの唯一のRepository ID、共有は現在許可集合の同じRepository ID契約で選択する。初期化済みだから自動切替せず、設定不正時は単体へfallbackしない。サーバー起動用CRDDリポも公開設定なしで対象へ加えない。局所直接接続の成功を通常CLI／共有配置の完成へ流用しない。

公開CLIの起動拒否はHost構成・初期化状態・Host Profile・公式Logo・Client Asset・Repository Rootの固定分類だけを表示し、それ以外は`workbench_startup_unavailable`へ閉じる。元例外本文、Path、資格は表示しない。起動失敗時に単体modeへ自動切替せず、SIGINT／SIGTERMは所有Workbench Handleの既存closeへ接続する。Process終了とListener不存在は別に観測し、合成Signal試験をOSのSignal搬送保証へ昇格しない。

共有公開時はWorkbench自身の非秘密`publicOrigin`へHTTPS Originを明示し、`localAccessRoot`の現在認証Ownerを必須とする。単体の資格不要内容を暗黙共有化しない。内部Listenerと`baseUrl`／`healthUrl`はloopbackのまま、利用者向け`publicUrl`は明示公開Originとする。各要求は単一Host・`x-forwarded-proto: https`・公開Hostに一致する単一`x-forwarded-host`をAM観測前に検査する。Originは存在時exact一致、POSTでは必須とし、欠測・重複・混在は固定421で拒否する。TLS終端は同HostでClient案内Headerを除去・上書きし、内部Listenerの到達範囲を配置Ownerが管理する。Header一致だけを実TLS通信やHost内非信頼Processへの防御成立として表示しない。WorkbenchとMCPに同一Originを要求せず、第三Gatewayを作らない。現在はServer optionsの局所候補であり、CLI設定と実TLS配置は未完了である。

非秘密設定は起動Repositoryの`.crdd/config/workbench-server.json`。閉Schemaは任意の`publicOrigin`文字列だけで、空ObjectまたはFile不存在はlocalhost既定とする。`--cros`明示時だけ読み、portは既存CLI引数が所有する。例は[配布設定](../../../template/.crdd/config/workbench-server.example.json)。資格・Host管理情報を含めず、重複・余剰field、不正UTF-8、16KiB超過、観測時のDirectory／File link、取得時File Identity不一致、取得済みDescriptorのサイズ・mtime不一致は固定拒否にする。単体起動は設定があっても共有へ自動切替しない。ReaderとCLIは接続候補であり、実TLS配置と共有縦断検証を別に閉じる。 これは起動時Snapshotの検査で、取得後のPath／Directory不変を保証しない。配置Ownerが設定変更と再起動を管理する。

## 5. Dataと状態

| 状態 | Owner | Workbenchでの保持 | 終了条件 |
|---|---|---|---|
| 選択Project／Screen／Panel | Workbench Session | 一時保持可 | Session終了で破棄 |
| Project／Portfolio Projection | Owner Artifact→Domain Model | 表示用Snapshotだけ | 再取得またはSession終了 |
| Topic／Meeting編集入力 | 利用者＋Interaction Adapter | 送信完了まで保持 | 成功、取消、明示破棄 |
| Git Tree／Diff／Stage状態 | Version Control Adapter | 観測結果とIdentityだけ | 再観測またはSession終了 |
| AI依頼入力、依頼種別、現在結果と候補確認 | 現在Session | Provider正本や候補内容を複製せず、Candidate IDと安全な確認Metadataだけを一時保持 | 明示採用・確認付き破棄・保留、取消、Session終了 |
| Runtime Activity投影 | Orchestrator | 一回の表示用Snapshotだけ | 再観測またはSession終了 |
| Project Plan | Current Release Projection→Domain Model共通Reader | Version、期限、Risk、Scope、依存および判断の表示用Snapshot | 再観測またはSession終了。計画値はRoadmap／CHGが正本 |
| Quality | Current Quality Projection→Domain Model共通Reader | 状態、Coverage、Gap、次Gateおよび人間判断の表示用Snapshot | 再観測またはSession終了。品質の各意味はQuality成果物が正本 |
| Documentation | Roadmap詳細、Project Context Owner Relation | 検証済みPathとtitleだけ | 再観測またはSession終了。内容はOwner Artifactが正本 |
| 接続Credential Secret | Access Management認証／Workbench接続境界 | Workbench Process memoryだけ。入力後に再表示せず、URL、HTML、Repository、logへ保存しない | 明示切断またはProcess終了で破棄 |
| Remote Topic／Meeting対象Repository | Access Management認可済み集合→Domain Model投影 | 現在Sessionの選択IDだけ。Source本文やGrantを複製しない | Portfolio再取得で対象外になった時、明示切替またはSession終了で破棄 |
| 公式ロゴ | Official Asset Governance | 読取り専用Assetとして配信 | Server終了 |

WorkbenchはCurrent Projectionを独自Databaseへ複製しない。将来Cacheを導入する場合も、Source Identity、Currentness、Coverage、失効条件を持つ派生物として別途設計する。

## 6. InterfaceとInteraction境界

| 入口 | 入力 | 出力 | Authority／Effect |
|---|---|---|---|
| Screen Load | Project、Screen、Cursor、Filter | View Model、Coverage、Continuation、Failure | 読取りAuthorityを追加しない |
| Topic／Meeting操作 | Identity、期待Revision、入力、操作種別 | success／conflict／partial／unknown | 既存Command／Candidate入口へ委譲する |
| Repository観測 | 検証済みRoot、対象Path／Revision | Tree、Diff、Staged、Unstaged、Untracked、Conflict | 読取りのみ |
| Stage／Commit／Push | 選択差分、Commit内容、確認済みRemote／Branch／Commit | 段階別結果、残る差分、unknown | 明示Authorityを既存Version Control Portへ渡す。Force Push 0 |
| AI依頼 | 選択Context、Profile ID、依頼種別（読取り助言／Workspace編集）、利用者入力、変更候補時の明示許可Path、一依頼だけの外部送信確認 | 依頼種別、事実、保存済み分析、追加推論、次の選択肢、各項目の根拠参照、未採用Candidate ID、Provider状態 | Profile IDと依頼種別を読み替えずApplicationへ渡す。Workbenchは送信対象を明示して一回確認を要求し、未確認をEffect 0で拒否する。読取り助言は利用者入力と許可済み投影を内容Hash付き専用Task Packetへ固定し、Task Hash・Catalog Revision・exact Profile・Providerへ結合した確認をDispatchで一回だけ消費する。編集は対象Workspaceとexact Executor Profileを単発Taskへ結合し、借用実行の変更観測を返す。作業指示Pathは指示・事後確認でありPath別ACLではない。読取り助言の確認を候補生成や採用Authorityへ再利用せず、候補の採用、CommitおよびPublishは別操作にする。根拠参照のない項目を部分表示せず、参照から任意Path読取りAuthorityを作らない |
| AI変更候補の採否 | 現在AI結果のCandidate ID、Storeから再読取りした分類・期限・基準Revision・Candidate／Patch Hash・変更Path、操作ごとの明示確認 | available／blocked、採用Receipt、Effect・cleanup・Recovery状態 | 確認はEffect 0とし、採用・破棄・保留を別操作にする。採用はOrchestratorの旧所有者処置、Canonical Adoption Lease、現在Revision・dirty・Scope再観測、候補Receiptと耐久記録を通った場合だけ行う。破棄は別の確認を必須にし、保留はRepository／Candidate Store Effect 0とする。採用してもCommitまたはPushを行わない |
| Runtime Activity | Project ID、任意Event Cursor | observed／absent／unknown、Objective／Task件数、判断・Recovery・次処置、Project限定Event Page | 読取りのみ。Runtime正本、状態遷移またはRecovery Authorityを生成しない。EventはExecution Intelligence Storeから新しい順・上限付きで投影する |
| Owner Artifact | 単体は検査済み起動Catalog、同Host CROSは今回選択Rootの現在Catalogに含まれる相対Markdown Path | Roadmap／Quality／Relation原文 | 読取りのみ。Catalog外Path、外部URL、親参照およびRepository越境を拒否する |
| Project Plan | `99_Roadmap/03_Releases.md` | Baseline、対象Version、期限、Risk、Scope、依存、判断およびOwner Link | 読取りのみ。欠落や構造不正を空計画へ畳まず、Roadmapにない値を推測しない |
| Quality | `07_Quality/01_Quality_Center.md` | 全体状態、対象、観測済み／未観測、Gap、次Gate、人間判断およびOwner Link | 読取りのみ。未観測をPassへ、進行中AuditをReadyへ畳まない |
| AI Profile管理 | 現在接続OwnerのProfile候補、現在Revision、登録済みAdapter／Model | 採用済みProfile Snapshot、拒否理由 | 共有Profileは現在manager／administratorへ直接接続済み。通常CLIのHost Catalog構成は⑤の未完了対象。Repository単体にRoleを要求せず、Adapterを新設せず、競合と未確認削除を拒否する |
| Connection | Endpoint、Credential | Session、現在認可されたProjection、接続状態 | Remote時だけ。非開示対象を推測しない |
| Remote Topic／Meeting | 現在Portfolioで選択したRepository ID、一覧条件、Identity、期待Revision、操作入力 | 一覧、詳細、Relation Owner、書込み結果 | RequestごとにMCPへ明示Repositoryを渡す。PortfolioにないIDを拒否し、Remote失敗時にLocalへfallbackしない |

### 6.1. 通常鍵操作の表示・結果搬送

意味の正本は[Access Management詳細](../access-management/01_Architecture.md)である。Workbenchは同一Processの人間向け入力・表示と結果搬送だけを所有し、資格Store、認可、交換Recoveryを複製しない。Workbenchに別Process接続を持たない。独立MCPのBearer認証はMCP Serverが所有し、鍵操作を公開しない。

| 操作 | 処置前の対象・条件 | 結果と禁止する読み替え |
|---|---|---|
| 通常発行 | 現行administrator、既存userId | 新Secretを一回だけ表示。旧資格の失効0、交換Recovery0。表示名は認証根拠にしない |
| 独立失効 | 現行administrator、exact資格IdentityとuserIdの結合 | 指定資格だけを処置。他の資格への拡張0、発行0、Secret0、交換再入場0 |
| 指定ユーザー交換 | 現行administrator、既存対象userId・表示名、旧資格全体の失効範囲と既存発行先を処置前表示 | 同じユーザーへ一回発行。他ユーザーを保持。通常入口では追加確認Gateを要求しない |
| 全ユーザー交換 | 現行administrator、操作主体を含む失効範囲と指定した既存administrator発行先を処置前表示し、明示確認 | 全旧資格を失効、指定発行先へ一回発行。他ユーザーの再発行は通常管理で行う |

Hostの交換2操作はWorkbench Backendで実行せず、信頼したログイン済み操作者の対話CLIとして別入口へ案内する。追加認証・昇格・確認コードを設けず、既存Root／Path検証を維持する。交換の入口2種×操作2種の全4組で対象・影響を表示し、Hostの2組と全ユーザー交換の通常入口の計3組だけ明示確認する。この確認契約を通常発行・独立失効へ拡張しない。初回Host設定は通常交換とは別契約で、以下の案内境界へ接続する。

交換ではAccess Managementが旧失効前から同じexact Recovery IDへ結合する。失効・新発行・結果記録・提示結果を別事実として表示し、後段失敗だけで確認済み発行をunknownへ戻さない。通常の秘密は用途限定・短命なbackend応答から操作administrator画面へ一度だけ提示し、追加受領ボタンを設けない。対象本人への安全な引渡し・受領は製品外で観測しない。Secretの保存・再送・再表示、一般MCP／DTO・一覧・履歴・Log・Evidenceへの公開は0。次の3分岐を表示し、通常発行／独立失効に交換Recoveryを付与しない。

| 現在確認できる状態 | Workbenchの表示・導線 | 禁止する表示・操作 |
|---|---|---|
| 発行または非秘密結果記録が不明 | Credential IDとは別の非秘密な元発行Identityと既知事実に基づく現在再観測へ案内。交換由来だけ元のexact Recoveryを維持 | 成功／rollbackへの丸め、新交換の開始、通常発行への交換Recovery追加 |
| 発行・結果記録確定、提示・引渡し未確認 | 「発行済み・受け渡し未確認」と表示。本人受領は観測外。現在許可されたadministratorが既存指定／全員交換を明示選択する。新交換は別Operation／別Recoveryで、各交換内だけ同じexact Recovery | 確定未受領の断定、確定発行の不明化、秘密再表示・自動再発行、別交換成功を旧受領・rollback・取消完了と表示 |
| 現在administratorとして接続できない | 既存ログイン済みHostの交換2操作へ案内 | Workbench認可迂回、Hostへの通常発行・独立失効・追加認証の追加 |

別交換では現在対象・認可と4組の事前表示／3組の確認を再適用する。指定交換は先の鍵を含む対象ユーザーの全旧有効資格→同じ既存userIdへ一資格、他ユーザー保持。全員交換は先の鍵を含む全旧有効資格→指定既存administratorへ一資格、他ユーザーは通常再発行・再配布となる。旧元発行Identityと確定事実はAMが保持し、Workbenchは旧処理との相関を失わない。遅延した旧応答の失効済み鍵を利用可能と表示しない。

未知対象、必要な既存administratorの不存在、認可破損または安全な観測不能は処置前に停止する。userId／username／Role／Role詳細権限／Repository登録／Product Dataは交換で変更しない。資格状態は旧失効・新発行によって変わる。管理者であることから内容参照を許可せず、他ユーザー情報の表示も現在の参照許可に従う。ユーザー・Role内容設定・Repository登録／Exposureの管理はARCH-000013の9 Role分担行に従い、Role内容設定から管理権限を生成しない。具体公開API・Schema・本番接続は未完了。AI Profile管理の担当Roleはmanager／administratorに確定した。現在認可のSource・本番接続は未完了である。

論理初回接続とv2目標SchemaはAM保存設計へ具体化済み。具体画面配置、公開API・結果Field、提示観測の実装／実境界・移行・本番接続は未成立。SCR-000008／BHV-000012／`PRT-000008.spec-000012`への接続はPartialである。Qualityは通常発行の失効0・Recovery0、独立失効の対象限定・発行0、交換4組表示／3組確認、鍵3分岐、元Identityと別交換の区別、MCP鍵操作0、Secret再表示0、遅延失効鍵の利用案内0、後段失敗時の既知事実保持をIT／STで導出する。ここでQA Local Item IDを推測して発行しない。旧伝播候補の限定Passは履歴。今回の最小提示方式の差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）で、QA実行済みではない。

#### 6.1.1. 同Process管理POSTの具体契約

管理依存は構成ごとに分離する。Standaloneの限定内部DIは信頼済み構成の検証済みAM Root／Bearerを使用する。Local CROSは内部構成のAM Rootと、当該要求の単一Authorization HeaderのBearerを使用し、要求外のログイン鍵として保持しない。両構成および旧Remote接続の混在を拒否する。AM保存RootはBrowser入力から取得しない。Repository登録の対象Rootは別の明示操作入力であり、管理認可と対象Root／manifest検証を必要とする。一覧と各操作で現在認証・認可を取り直し、一覧の操作表示を実行許可として再利用しない。

| 境界 | 具体契約 |
|---|---|
| 非秘密一覧 | AMの同改訂SnapshotからユーザーのID・表示名・Role、資格のID・元発行ID・失効・提示状態、現在交換相関だけを投影する。秘密・Verifier・Salt・内部Rootは返さない |
| 管理POST | `/connection-credentials/action`は`issue / revoke / exchange-user / exchange-all`だけを受理する。現在改訂・既存userIdと操作別の対象を必須とし、旧profile／rotate／update_access、重複・未知field、不一致Origin／Host、不正Content-TypeとAction Tokenを保存前に拒否する |
| 鍵提示 | 保存と`unconfirmed`記録の後、`no-store`の専用JSON一応答へ鍵を入れる。応答の`presenting`は出力開始の結果で、本人受領・提示確認・交換完了ではない。汎用`/api/workbench-view`へ鍵や直前の鍵応答を保持しない |
| 提示後 | 所有Responseの全byteの`finish`と先行故障なしを確認してから、元発行相関の`confirmed`を別保存する。HTTP終了はBrowser描画・コピー・本人受領の証明ではない。切断・取消・故障では確認や交換終了を進めず、自動再送しない |
| 交換終了 | 他ユーザー指定交換では操作主体の既存管理者鍵、本人指定交換・全交換では当該要求で発行した新管理者鍵を短命に使用する。通常AM終了入口で現在Role・資格・改訂・exact交換相関・提示確認を再評価し、失効・変更・不明なら記録を保持する。Host終了入口・他の鍵へのfallbackは行わない |
| Server終了 | 開始した管理要求と提示後処置を終了待機へ含める。画面用応答の任意保存を終了条件に追加しない。秘密は当該要求の短命値として解放し、新しいSession／Receipt／Recovery Storeを作らない |

旧CROS管理依存・Form・Client Modelの資格部分は、新Serverと同時配布するCSRへ一斉切替する内部契約変更である。旧形式の互換受付・秘密再取得は設けない。本人交換・全交換で接続に使用した旧鍵が失効した場合は、新しい鍵での明示接続が必要であり、応答成功から旧接続の継続を表示しない。

同Process注入による接続は、局所HTTPの出力／後処置故障と、実Browserの通常発行・本人交換・全交換の短命表示・消去・再読込・旧接続失効まで評価済みである。この限定範囲の独立再レビューは残指摘0。公開Launcher、通常接続切替および正式Local Item評価は未完了であり、Workbench資格管理全体の完成を主張しない。

### 6.2. 通常管理の入力・結果搬送

Workbenchは[Access Management詳細§4](../access-management/01_Architecture.md#4-通常管理と独立失効)へ次の操作を委譲する。表示上の操作可否はAuthorityではなく、実行時にAMが変更前の現在管理認可・対象・期待改訂を確認する。Standalone／CROS／共有Host配置のすべてで同ProcessのAMへ直接接続する。Browser向けHTTPを残し、Workbenchの管理処理はMCP ClientやMCP Serverを必要としない。

| 操作 | 入力・対象制約 | 表示する結果・保持条件 |
|---|---|---|
| ユーザー登録 | 予定Role・表示名。managerはdeveloper／manager、administratorは三Role | 新userIdと保存・読戻し結果。既存ID・変更前Roleを要求しない。資格発行は別操作 |
| 表示名変更 | 既存userId・新表示名。manager／administratorが操作し、administratorの名前もmanagerが変更可 | 名前だけの変更結果。ID・Role・Credential保持 |
| 既存Role変更 | 既存userId・前後Role。managerは両方developer／managerのみ | 現行Roleと保存・読戻し結果。administratorの付与・解除・降格はadministratorのみ |
| Role内容設定 | 対象Role・変更内容。developer／managerはmanager／administrator、administratorはadministratorのみ | 内容設定の変更結果。固定管理分担のON／OFF・再委譲なし |
| Repository登録・解除 | 対象ID・現在登録／Exposure状態・変更内容。manager／administrator | 登録結果≠公開／取得。解除は同じ受理操作・採用改訂で登録と対応Exposureを除去し、両読戻し確認時だけ完了と表示。対象外登録・ExposureとRepository本体・Product Dataを保持。解除完了≠開始済み操作の取消・過去Effect0・実資源終了 |
| Exposure設定 | 対象ID・現在登録／公開状態・変更内容。manager／administrator | 明示公開設定の保存結果≠内容取得成功 |

manager自身の内容範囲変更も、変更前の管理認可→明示更新→次要求の現在Role・Exposure・実アクセス再評価の順を表示する。manager正常管理にadministrator存在条件を要求せず、管理拒否を自身表示・許可内容の拒否へ広げない。未知対象・必要状態不明・競合は新Effect前停止。保存後の読戻し／応答不明は既知更新と未確定範囲を分け、未保存・rollback・Effect0・完了を推定せず、交換Recoveryを追加しない。

Qualityは9 Role分担行×三Role、操作別入力、managerのadministrator名前だけ変更、自己内容変更の時間順、登録／公開、解除の両読戻し・対象外／本体保持・取消非証明、管理≠内容、保存後不明の禁止推定を既存AM導出キーへ接続する。片側除去・読戻し不明の完了表示を反証する。管理画面・HTTP・AM保存への局所接続は次節で具体化する。公開Launcher・共有公開配置・正式評価はOPENであり、局所接続を全体完成へ昇格しない。

#### 6.2.1. 非鍵管理の接続候補

接続単位は、Workbenchの全配置で四管理read＋七保存（Repository登録含む）である。通常三Role本人はAM `readCurrentAccess`の直接呼出しで取得し、管理一覧から名前・Roleを推定しない。独立MCP Surfaceの同Toolは別の利用側であり、Workbenchが呼ぶ入口ではない。AM内部managementOperationsをSurface提供済みの能力へ変換しない。管理read・保存の非秘密結果はAM共通投影を使い、Browserで閉shapeを検査する。新しい管理Store／結果mapper／Role規則を追加しない。

状態: 管理の直接接続候補。画面とPOSTは既存AMの四read＋七保存へ接続済みで、Workbench独自の管理Store・Role判定・結果契約を作らない。Standaloneの信頼済み内部DIとCROSの要求専用Bearerを分離する。Repository登録はWorkbenchの明示操作だけであり、共有利用ではサーバー上の対象Rootを指定する。MCPの管理Toolは[独立MCP Surfaceの契約](../mcp-server/01_Architecture.md#331-非鍵管理toolの具体化候補)として維持し、Workbenchの依存としない。全内容・公開Launcher・共有TLS・正式評価の完成は別Gateである。

画面はユーザー、Role内容、登録Repository、公開範囲の四管理投影を別の改訂付きで保持する。全Role本人の名前表示は通常接続の本人投影を使い、管理一覧をdeveloperへ開示しない。四読取りが違う改訂なら同一Snapshotを表示したと主張せず、各保存フォームが利用した投影の改訂をexpectedRevisionへ渡す。一保存後は現在投影をrefreshし、競合・応答喪失で自動再送しない。管理可否の表示は操作Authorityではなく、AMが要求毎に確認する。

七保存操作は操作別の閉POST入力から同じAM入口へ一回だけ接続する。Origin／Host／Content-Type／要求容量／同画面のAction Tokenを既存Server境界で確認し、開始前取消は保存0、開始後は同期保存終了を待って応答を処置する。入力Tokenは資格を含めず、管理RootやBearerをBrowserのフォーム・JSONへ渡さない。登録Rootを指定する際は「サーバー上のRepositoryフォルダ」と表示し、BrowserのローカルPathとの違いを説明する。

保存確認済み、拒否、保存結果未確認、保存確認後の清掃未確認を区別して表示する。既知出版を「変更なし」へ丸めず、解除成功からRepository本体削除・旧Task終了を推定しない。更新したRole内容やExposureの実利用可否は次要求の現在認可で確認する。管理結果・改訂を表示しても秘密・Binding・内部Path・Lock回復参照を追加しない。通常の説明Responseは表示用であり、新たな受領ACKや永続配送Stateを要求しない。

非鍵管理の公開結果形式は[Access Managementの保存とAPI](../access-management/02_Management_State_and_API.md)が所有する共通投影の閉Unionと固定失敗分類を使う。Workbenchで別の保存結果型や自由文字列理由を定義せず、直接AM利用時も同じ公開投影へ変換する。先行材料処置と新出版準備、既知出版後のLock終了不明を区別し、非公開secondaryを推測しない。

### 6.3. 初回Host設定の案内

初回資格での接続操作は[AM保存設計§2.5](../access-management/02_Management_State_and_API.md#25-初回限定接続の具体契約)に従い、WorkbenchのLocal／共有Host配置はいずれも閉じた専用connect POSTから、次HTTP要求のfresh通常読取りへ接続する。利用者の接続操作は一回で、追加受領ボタンを設けない。接続POST内は確認保存と通常資格の現存確認だけで、本人・内容・管理・鍵操作を公開しない。AM確認保存前の応答、単なるHTTP到達、旧Portfolio取得から初回完了を表示しない。初回完了表示は後続通常読取り成功後だけである。既知保存後の応答喪失は再接続で現在状態を確認し、秘密再表示・自動再発行・rollbackをしない。独立MCP Surfaceの完全な限定discoverはMCP自身の契約であり、Workbenchの接続経路ではない。専用Workbench HTTP POSTは局所接続済みで、資格を完了後に保持せず、次要求の単一Authorization Headerでfresh認証する。Browser memory／Header送信はSource接続と鍵管理／接続の局所実Browser確認済みで、公開CLI、共有TLS配置、全内容入口は未接続。先行5文書の限定Passを今回の変更や本番成立へ流用しない。

初回の意味・State・Sequenceは[Access Management詳細](../access-management/01_Architecture.md#41-初回host設定のstateとsequence)、利用者表示のOwnerはSCR-000008／BHV-000012とする。WorkbenchはHostの明示操作へ案内するだけで、初期化実行・UUID作成・鍵発行・初期SecretのWorkbench搬送をBackendに追加しない。

| 許可された確認情報 | 表示・案内 |
|---|---|
| 未試行・双方未初期化が確認済み | Hostで管理用表示名を入力し、初回設定を明示実行する案内。Workbenchから開始しない |
| 既存管理状態 | 初期化不可。通常の鍵喪失は既存Host交換へ案内する |
| 確認済み途中 | 非秘密の個別事実とHost元試行再観測へ案内。発行／記録不明と受け渡しだけ不明を分ける |
| 未観測・情報不足 | 未初期化と表示せず、Hostで現在状態を確認する案内 |

Remote MCPから初期化状態を照会する新機能は作らない。接続不可や設定Fileの有無だけではユーザー・試行の存在を確定できない。初回SecretはHost端末で一度提示し、Workbench画面へ移さない。Host提示とexact同鍵の限定接続成功、その確認保存・読戻し・短命材料清掃／Lock終了を区別し、全確認後だけ初回完了と通常管理への案内を行う。いずれか未確認・失敗・観測不能なら完了表示0・通常Authority0。発行／記録確定後の提示・接続未確認は既存Host指定交換を別明示操作として案内し、Secret再表示・自動再発行をしない。接続Owner・限定Protocol・Host交換後Binding・v2目標SchemaはAM保存設計へ具体化済み。具体表示・提示観測の実装／実境界・移行・本番接続はOPEN。

旧初回案内の限定Passは当時の固定版の履歴。今回の最小提示方式の差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。QualityへはHost案内と実行の分離、提示と接続確認の別、確認保存・読戻し・清掃／Lock終了の失敗反例、通常Secretの対象本人受領非推定を渡す。

## 7. Visualと公式素材

- Visual Baselineは[Direction A](../../../04_UI/Details/Visual/workbench-hero/visual-baseline.md)を使用する。
- FontはNoto Sans CJKを基準とし、存在しないWeightの合成を無効にする。
- 左上のApplication Brandには`crdd-brand-icon-512x512.jpg`を表示する。
- Assetが取得不能な場合は、壊れた画像のまま成功表示せず、Brand Asset failureを診断可能にする。類似アイコンを自動生成しない。
- 320〜1920 CSS pxと100%／200%／400% Browser Zoomの評価契約をProductionへ継承する。
- 汎用Web ProductとしてDesktop、Tablet、Mobile相当Profileをすべて評価する。全Profile Passを必須にせず、人間が理由付きで許容した不適合を明示する。

## 8. FailureとRecovery

Topic／Meeting POSTは、入力評価と操作配送を分ける。token、kind／operation、固定ID・期待Revision、操作別参照とDomain公開ParserによるMarkdown検証を配送前に評価し、不正は固定400 `topic_meeting_action_rejected`へ返す。createへID／Revisionを要求せず、owner／none参照へID制約を追加しない。既存のRemote可視性確認とLocal Repository選択意味は維持する。

旧Standalone／Remote比較分岐では、Local操作またはRemote要求の直前にだけ配送済みを記録し、その後の操作・保存、結果検査、投影再読取りの例外を固定500 `topic_meeting_action_failed`へ返す。この配送判定はEffect有無の証明ではなく、500からrollback・未保存・Effect 0・cleanup成立を推定しない。Domainのblocked結果は従来の303と公開モデルを維持する。同Host CROSの直接分岐は要求専用結果とし、completed／blockedは200 JSON、配送前拒否は400、配送後例外・C2不成立は503 `topic_meeting_action_outcome_unconfirmed`、取消は成功本文0とする。両分岐を同じ検証結果で成立扱いにせず、`QA-000005`の`CPR-IT-012`へ故障分類、010へ正常操作・競合・削除確認を接続する。例外本文・Path・秘密は公開しない。

| Failure | 保持するもの | 禁止 | Recovery |
|---|---|---|---|
| Projection partial／unavailable | 観測済み範囲、Source、Coverage | 完全状態への畳込み | 再投影、Owner Artifactへ移動 |
| HTTP request切断 | Request Identity、Effect発行状態 | 結果不明の暗黙再送 | 状態再確認、安全な再入場 |
| Topic／Meeting conflict | 入力、対象Identity、比較可能な差 | 最新値への無断上書き | 再読込、差分確認、取消 |
| Remote Repository未選択／現在認可範囲外 | Remote接続状態と認可済み集合からのDomain Model投影 | Local Repositoryの代替表示、ID知識によるAuthority生成、対象存在の推測 | Access Managementの現在認可を再評価し、許可済みPortfolioから明示選択 |
| Git観測不能 | Project Context、最後に確認したRevision | 空TreeやClean扱い | Repository再観測、外部Git Client |
| Push結果不明 | Remote、Branch、Commit、相関情報 | 自動再Push、Force Push | Remote状態の再確認 |
| AI Provider失敗 | 確認済み事実、保存済み分析、依頼種別、入力 | 推論を事実化、読取り助言を変更候補へ読み替える、候補を採用 | 同じIdentityと依頼種別で再観測、別Profile、元Screen |
| AI候補のRevision／Scope競合 | Candidate ID、安全な確認Metadata、現在Revision、dirty Path、操作結果 | 古い候補の自動採用、確認済み範囲外の変更、暗黙再試行 | 候補を再生成するか、現在Repositoryとの差を確認して明示操作へ戻る |
| Runtime状態未接続／観測不能 | Project Contextと観測理由 | Objective 0件、完了または直前値への畳込み | State Query Adapter接続、再観測 |
| Owner Artifact欠落／越境／過大 | Project ContextとCatalog観測理由 | 部分Catalog公開、任意Path探索 | Catalog全体をunknownとしOwner側を確認する |
| Logo／CSS取得失敗 | Application request状態 | 代替Brandの創作 | Asset経路診断、再取得 |
| React Client Bundle欠落／不一致 | Server起動前のBuild結果 | HTMLだけを完全なReact移行として表示、任意Asset配信 | Vite Buildを再実行し、固定Assetの存在とHTTP契約を再確認 |
| JSON Read Model取得失敗／不正 | 固定Document Shellと取得失敗理由 | 空画面、直前値またはBrowser推測での補完 | 同じRoute条件で再取得し、Server側Owner Artifact／Adapterを診断する |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | Repository単体、Local CROS、Remote CROSの具象差がある。 | Consumer PortとMode別Adapter | Modeは意味・Authorityを変更しない。 | 新Mode追加時は全ScreenとDisclosureを再評価する。 | `workbench.mode-variation` |
| Common Contract | Required | 複数入口で同じView StateとInteraction Resultを使う。 | 共通View Model／Result Contract | Surface固有語彙をDomain結果へ逆流させない。 | 契約変更は全Adapterと画面へ波及する。 | `workbench.component-boundary`<br>`workbench.view-state` |
| Creation／Selection | Required | Project、Mode、Connection、AI Profileを明示選択する。 | Selection Service／Screen Context | 利用不能対象を暗黙選択しない。 | 選択規則変更はNavigationとAuthorityへ波及する。 | `workbench.mode-variation` |
| State-dependent Behavior | Required | loading、partial、unknown、Effect前後で許可操作が異なる。 | View State Machine／Interaction State | unknown時に成功や再実行を既定にしない。 | 状態追加は全Screenと試験へ波及する。 | `workbench.view-state`<br>`workbench.interaction-sequence` |
| Composition／Recursion | Required | 15 Screenと反復PartからProduct固有Patternを発見する。 | React Shell、SCR／PRT Composition、後段CMP昇格 | Heroを先に抽象化せず反復根拠から昇格する。Server FragmentをComponent境界として持たず、Browser ReactがCompositionを所有する。 | React ComponentまたはCMP追加時はScreen Coverageを再評価する。 | `workbench.screen-composition` |
| Lifecycle Ownership | Required | Server、request、session、child processを所有する。 | Runtime Owner／Shutdown Coordinator | 終了後に所有資源を残さない。 | lifecycle変更はIT／STへ波及する。 | `workbench.resource-flow` |
| External Boundary | Required | Git、Remote CROS、AI Provider、Filesystemを扱う。 | 境界別Port／Adapter | 一境界の成功を他境界へ流用しない。 | 境界追加はAuthorityとE2Eへ波及する。 | `workbench.interface-boundary`<br>`workbench.failure-recovery` |

## 10. Reality Audit

次表は移管前の旧経路と成立済みCapabilityを照合する歴史的比較入力である。旧Remote／systemAdmin／Shared ServerのCoveredを現行構成や新版の検証根拠へ使用しない。現行Owner・直接接続と未完了範囲は冒頭の契約とCHG-000082の現在計画で確認する。全体の現在評価は⑥で再生成する。

この表と冒頭のQuality観測表は旧配置の履歴として保持し、新しいユーザー／現在Role／鍵入口の合格根拠にはしない。再編後の同一Process CROS呼出し／Remote MCPへの置換は未実装であり、旧REST／Gatewayの`Covered`を新経路へ引き継がない。新配置の公開Graph、設定Reader、全操作と終了実測を段階6／7で再確認する。

| 対象 | 現在状態 | 分類 | 処置 |
|---|---|---|---|
| Production Workbench package | `40_Develop/workbench-server`にClient-side React Application Shell、Vite Browser Build、localhost Node Server、固定Document Shell、用途限定Token以外の秘密・Authorityを含まないJSON Read Model、Project Surface、Repository Work、Topic／Meeting CRUDとMeeting Outcome処置、Credential管理Surface、Remote接続入力、Portfolioの検索・状態絞込み・Query拘束継続読込・Project別Source表示、Owner分離したRepository／CROS AI Profile管理、選択Profile IDと依頼種別付きの現在Session AI依頼Port、変更候補の確認・採用・破棄SurfaceおよびRuntime Activity Portが存在する。全画面DOMはBrowser側React Componentだけが所有し、Node Serverは認証・Authority・Repository Effect・JSON生成・固定Asset配信だけを所有する。SSR、Hydration、Raw HTML FragmentおよびDOM再読取りは存在しない。Repository単体CompositionはOrchestratorの単発受付から、助言を固定Context専用Runtimeへ、編集を借用WorkspaceのSingle Taskへ接続する。通常実行に署名は要求しない。旧Bundle採用入口は撤去し、Candidate固定・Merge・採用は既存Workspace管理で別操作とする。Task完了でCommit／Pushは行わない | Partial | CSRの型・Lint・Build、HTTP／JSON契約試験、15画面の実Browser Visual再確認および独立レビューは成立した。残るCodex／Claudeの実Provider E2Eを閉じるまで全体完了へ昇格しない |
| Runtime Activity | Repository単体では現在RevisionとProject IDを既存Orchestrator State QueryおよびExecution Intelligence Storeへ接続する。Remote CROSではRequestごとにCredentialとExposureを再検証し、許可済みRepositoryだけをRuntime Activity Readerへ渡す。現在状態とEvent観測不能を独立表示し、Project限定Eventを新しい順・Cursor付きで継続読込する | Covered | Repository EventのProject分離・順序・Continuation、Remote CROSのGrant分離、Credential失効後の直前値非表示を結合試験で確認した。Runtime正本、Event正本またはRecovery AuthorityはWorkbenchへ移さない |
| Project Plan | 固定Current Release Projectionを共通ReaderでVersion、期限、Risk、Scope、依存および判断へ変換し、Roadmap詳細と同じOwner Artifact Routeへ接続する | Covered | Projection構造を第二正本化せず、Roadmap／CHG更新時の同時更新契約を維持する |
| Quality | 固定Current Quality Projectionを共通Readerで状態、Coverage、Gap、次Gateおよび人間判断へ変換し、Quality Center原文へ接続する | Covered | Quality Center更新時のProjection整合を維持し、Evidence自体をWorkbenchへ複製しない |
| Documentation | Roadmap詳細とProject ContextのMarkdown Owner Relationを検証済みCatalogへし、title／PathのCatalog内検索、Project Context起点Section表示および原文Routeへ接続する | Covered | Current Projectionは一段Relationだけを扱い、再帰展開はしない。欠落・越境・観測失敗はCatalog全体をunknownとして部分成功へ畳まない |
| Direction A HTML／CSS／PNG | UI DetailのVisual Fixture | Design Evidence | Production Sourceへ丸ごと移植せず、Visual BaselineとCompositionを実装入力にする |
| CROS Application Contract | Portfolio Federation、Credential管理、Bearer Remote Portfolio、`systemAdmin`限定AI Profile管理およびWorkbench接続／更新／切断を接続済み。許可済みPortfolio内だけを検索・状態絞込み・Query拘束Cursorで継続読込し、選択ProjectはRepository Sourceごとの五場面を欠測のまま表示する。Shared ServerはREST／MCP同一HTTPS Origin、固定OS設定、外部TLS終端契約および終了後Listener 0まで接続済み | Covered | N/A: 公開証明書の運用は配置先のTLS終端が所有する |
| Project Operation | Project ContextとTopic／Meeting共通ApplicationをWorkbenchへ接続し、検索、状態・Owner・期間・Relation・未処置Outcomeによる絞込み、安定並び順、Query拘束Cursor、独立Detail、取得本文、登録、編集、Relation影響付き削除、Outcome全件処置後のMeeting Close、実在CHGへのTopic昇格接続、同一Repository内のTopic／Meeting／CHG Relation遷移、および同じSessionとExposure Snapshotに限定したRepository間Owner Relation解決を提供する。Relationを別Repository書込みAuthorityにはしない | Covered | Repository間Owner解決、曖昧・未許可・欠落時の安全な停止、およびRemote Workbenchからの明示Source選択を結合試験で確認済み |
| Version Control | Directory単位の遅延Tree、Query拘束Continuation、選択FileのPrepared／Working Diffと切詰め表示、Stage／Unstage／Commit／確認済み通常Pushを公開PortとGit Adapterへ接続済み | Covered | 未追跡File内容を暗黙読取りせず、Force／暗黙再送を追加しない |
| Official Logo | `04_UI/assets/brand`の承認済み画像をProduction Shellが配信する | Covered | 同じAsset Identityを維持する |
| Desktop wrapper | 存在しない | N/A | 現在の成果に不要。OS統合要求が発生した時だけ再評価する |

## 11. Quality引渡しの要約

- localhostだけにbindし、任意Interfaceへ公開しない。
- 公開入口から公式ロゴを含むDirection A Shellを表示できる。
- Node Serverが固定Document Shellと用途限定Token以外の秘密・Authorityを含まないJSON Read Modelを同一Originで返し、Vite Bundleから起動したClient-side Reactだけが全画面DOMを生成する。Action Tokenは認証・業務Authorityを単独で付与せず、Credential生Tokenは明示管理操作直後の最初のJSON応答だけで一回表示する。
- Local／Remoteの入口差でApplication意味、状態語彙、失敗分類を変えない。
- 欠測、非開示、部分成功、結果不明を完全・空・失敗へ畳まない。
- Effectを伴う操作ではAuthority、要求、受理、Effect、結果、終了後状態を分ける。
- 320〜1920 CSS px、100%／200%／400% Zoom、Keyboard順、文字下限、操作対象、ContrastをProduction DOMで評価する。
- shutdown後にlistener、request、child process、一時AssetまたはCredentialが残らない。

最新ARCH-000013の境界伝播は設計候補であり、論理Owner・限定Protocol・v2目標SchemaはAM保存設計へ具体化済み。具体API・保存実装・提示実境界・移行・Quality導出と本番接続はOPEN。以下の既存Checklist評価を新構成の全体完了へ流用しない。

Checklist評価根拠: Remote MCP公開Schema、Local内部呼出し、Browser APIのConsumer対応を具体化した。Component、Interface、Data／StateおよびSequenceの設計を本番実接続と区別した。 QA-000001／004／007／009の追加観測条件へ操作・接続世代・失効・応答喪失・終了の義務を渡した。旧Gatewayと新MCP経路の実績を混同せず、新構成の実境界は未評価である。

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

最新固定8分担の限定独立レビューは当時の範囲だけに適用する。登録解除と鍵3分岐の詳細伝播は候補反映・今回の契約・品質の限定独立レビュー済み・残指摘0。旧観測・Checklistは当時の限定範囲を維持し、Quality・Source・本番接続・実境界の完成根拠へ流用しない。
