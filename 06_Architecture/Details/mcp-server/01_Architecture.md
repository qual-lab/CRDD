# MCP Transportアーキテクチャ

## CRDD Server共通操作への接続

既存MCP入口はToolとstdio／Streamable HTTPの契約を維持する。[CRDD Serverの標準入口](../../Definitions/ARCH-000012/architecture_definition.md#crdd-server共通入口の公開契約)に非秘密配置設定とTopic／Meetingの操作対象構成を委譲し、MCPへの認証・Tool入力検査・応答分類はTransportとToolのOwnerに残す。許可集合を要求間で再利用しない。

共有MCPの組込みOAuthでは、発行側がインスタンスごとに一つの有界な一時状態を生成・所有する。起動設定はクライアント・署名材料等だけを渡し、新しい発行側は同じ設定でも古い認可状態を引き継がない。検証側は標準のトークン照会を使い、内部状態を直接読まない。リポジトリへの現在認可はアクセス管理が判定し、OAuthの照会結果だけで許可しない。

配布CLIで共有OAuthを起動するには、管理状態の初期設定が完了し、現在の管理者にGoogleの紐付けが一件以上あることを要する。アクセス管理が既存の起動時観測と同じ排他内で確認する。未設定・初期設定途中・観測不能では、認可サーバーとListenerを起動せず、鍵方式へ自動で戻らない。起動時の確認は利用者の現在認可に代わらない。

Git利用では、MCPは認可済みの対象と操作を搬送する。Gitコマンド・事前観測・失敗後の再入場は独自に持たず、[CRDD ServerのGit利用](../workbench-server/01_Architecture.md#server-git-lifecycle)と[Coordinatorの実行・回復境界](../coordinator/01_Architecture.md#coordinator-git-lifecycle)に接続する。

## Objectiveの新規・再開区分

`crdd.start_objective`と`crdd.resume_objective`を別のツールとして提供する。どちらも元の実行要求を識別するために実行IDと計画を受け取るが、引数の`operation`は受け付けない。MCPはツール名で決まる固定の操作をCoordinatorへ搬送する。Objective結果はv4へ追従する。新規／再送／再開の判断と保存・実行のOwnerはCoordinatorであり、MCPは独自の再開台帳や再送を追加しない。受付世代は要求・状態照会の双方から撤去した。状態照会はv2で、内部初期化を発行しない。

設定済みのローカル・共有入口は、計画をCoordinatorの正式なObjective受付に一度だけ渡す。受付成功時に限りServerが対象を選び、現在認可と必要なWorkspace観測を行う。Workspaceの遅延読込みから戻った後は、取消確認・現在認可・Workspace観測を実行直前に続けて行う。応答の公開前にも共有認可を再確認する。不正計画は対象の選択や保存へ進まない。

保存境界の公開Runtime停止は、既存の単純停止と`recoveryIds`を持つ閉形式を区別して捕捉する。後者は密な文字列配列・ID文法・一意性を検査し、IDありでは`unknown`・回収未確認・明示対応必要を必須とする。新しいkindを推測しない。ObjectiveのTask回復IDと義務の集合一致、Process再起動・投影相関の検査は変更しない。

## 実Objective結果のWorkspace観測搬送 — 2026-11-14

runtime-activity-adapter ITは、実Coordinator受付・保存・有限Providerから返った二TaskのWorkspace観測を、実MCP結果Parserへ一続きで接続する。合成Projectionへの差替えで代用せず、全観測・Git HEAD不変・Queue状態の確認を維持する。実Git／保存の共通準備とexact Root清掃は下位Coの既存workspace-surface fixtureを一意に使い、MCPへ構築規則を複製しない。この限定試験は実AI・Docker・公開MCP Process E2Eの成立ではない。

## 配布入口のSource接続検査 — 2026-11-14

既存のruntime-activity-adapter ITは、開始済みReaderの終了待機に加えて、配布MCP入口がCoordinator公開Rootへ直接接続するSource検査を所有する。PRL-IT-012の既存義務から移管し、対象Pathと一致条件を変更しない。この読取りだけの確認は実MCP疎通・認可・Reader完了の検証と区別する。

## 公開MCP実行の検証Tool所有 — 2026-11-14

`tests/system/manual/verify-task-real-providers.ts`と`task-real-provider-contract.ts`は、公開MCP入口の応答・取消・親終了後の再入場を検証するToolとしてMCPが所有する。対応する48試験と専用の有限Node fixtureも同じPackageへ置く。Coordinatorは下位の業務実行Ownerとして利用し、CoordinatorのscriptからMCPの公開結果Parserを逆参照しない。旧Pathに転送入口は残さない。

Reportの契約ID・改訂13・試験対象Repositoryの固定marker Path・取消／回復順序と期限は維持する。Source観測はCoordinatorの`scripts/benchmark.ts`から直接取得し、受付は現Producerのv5だけに合わせ、旧v2／v3／v4を拒否する。旧Hashを補完・変換しない。対象集合・二読取りの正本は[Coordinator設計](../coordinator/01_Architecture.md)とし、MCPで再構築しない。公開にはHashと非秘密の改訂情報だけを返し、内部実体情報・Source本文は返さない。新規Objectiveを構築する検証Tool自身が`operation: "start"`を明示し、受付側に省略補完を追加しない。

有限試験は起動対象の代役と固定Node子を使い、実Provider検証の実行経路は起動しない。ただし、Import解決と処置前拒否の確認では、不正引数だけを付けた新品Node Processで正式入口を起動する。検証未開始・MCP子未開始の既存拒否結果と終了を確認し、この起動確認や合成値のScope検査を実AI・実Dockerの成立へ拡張しない。

## 3モデル分離への接続 — 2026-11-12

MCPはdocument-model／execution-model／configuration-modelを各操作のOwnerとして個別利用し、Model間のFacadeを設けない。AM RootはAM正本型を参照し、文書の期待値は3Identityへ投影する。生JSONの重複キー拒否と通信・操作ごとの閉じたスキーマ検査は既存Transport／入力処理へ局所化し、設定不正を非履歴Query／Recovery全体の停止へ広げない。

移管後の限定回帰・独立確認は実施中であり、全体回帰・実AI・Docker・過去保持物の操作を今回の確認へ含めない。保存Schema・Path・Lock・既存の公開失敗情報を変更したとは扱わない。

## 回復結果の集合搬送 — 2026-11-12

Coordinatorの正常な回復ID／義務の集合は、公開結果の捕捉で独自128件上限を設けず全件返す。個々のID形式、義務種別、未知field・Getter／Proxy拒否、一意性、両集合のexact対応と結果のCleanup／Effect相関は維持する。これは結果DTOの件数拒否の撤去であり、MCP受信量・Tool要求Schema・認証／認可の拡大ではない。

## 継続判断のState接続 — 2026-11-12

`crdd.request_decision`、`crdd.answer_decision`、`crdd.apply_decision`、`crdd.close_decision` は、ツール名に対応する固定の操作としてCoordinatorの判断契約（v2）へ接続する。引数の `operation` は受け付けない。対象Project・Milestone・元世代・Repository Revisionを共通に搬送する。要求には明示blockerId・Queue・質問・選択肢、回答には選択と任意comment、閉鎖にはinvalidatedと理由を指定する。回答だけでは実行を再開しない。同じ問題への再提案は同じblockerIdと新しいdecisionIdを使い、判断IDからBlockerを推測しない。判断の期限は設けず、旧lifetimeMs・expiresAt・expiredは未知入力として拒否する。回答先Principalは現在の認証ContextからCoordinatorへ搬送し、Tool入力で指定しない。再提案でも元回答先との一致をDomainの同Owner内で確認する。

結果の`decision`と`history`を分けて搬送し、回答保存済み・未適用、適用済み・履歴未確定、明示閉鎖を成功推定へ畳まない。旧continuationCapability・再発行・Host保存Rootを受け付けず、MCP独自の判断Storeや認可を追加しない。公開結果もDomainの閉形式検査を利用し、認証・現在の内容認可・返却前再認可は既存入口で維持する。

## Core実行依頼定義の直接接続 — 2026-10-28

配布入口 `template/tools/crdd-server.ts` は、単体stdioと共有HTTPで、Objective実行・判断送信・実行状態照会を同じツールとして提供する。単体は起動リポジトリとローカル主体、共有は明示された `repositoryId` に対する開発権限と、MCP OAuthトークンに結び付いたアクセス管理上の主体を使う。Nodeの既存24.12.0下限は当入口の現在プロセスで検査し、Coordinator診断の読込みを必要としない。

MCPの起動・discover・Tool一覧はCoordinator／Executorを読み込まない。実行系Toolの定義・処理は内部の `transport/mcp-server.ts` が持ち、該当Toolの呼出し時だけ固定したCoordinator公開入口を読み込む。待機前に引数を独立捕捉し、待機後に取消を確認し、現在の主体とRepositoryを下位操作へ結合する。Objectiveの同期結果捕捉はCoordinatorの完成受付を直接呼ぶ。Workspaceの実処置・実行状況検査も該当CallだけでCoordinatorを読む。読込み欠測は呼出し単位で非開示の失敗を返し、他のToolや待受けを停止せず、実行へfallbackしない。汎用loader・Router・Registryは追加しない。

共有では `repositoryId` をMCP受付で分離し、アクセス管理が確認した本人の紐付け・登録先と、Gitホストにおける本人の実効権限を要求のProjectに結び付ける。状態照会は読み取り、判断・開始・再開・取消は書き込みの許可を確認する。同じ対象を処置前と公開前に再確認し、対象不明に起動Repositoryや旧認可を代用しない。開始済みの共有Objectiveは、受付資格の寿命とは分けて[共通の実行受付](../workbench-server/01_Architecture.md)が監視する。失効や取消要求から、既に行った処置の巻戻しや回復完了を推定しない。

実行系3操作・実行定義・認可済みプロジェクト一覧は、HTTP APIと同じ実行・Projectの操作元を使う。入口は既存の操作Ownerへ直接つなぎ、対象・主体の確認、Coordinatorへの委譲、応答公開前の再確認を二重実装しない。Toolの入力、接続の認証・取消とJSON-RPC応答はMCP固有の責務とする。鍵管理とAM管理の公開範囲は変更しない。

Workspaceの操作準備は `service/workspace-request.ts` から `service/workspace.ts` に接続し、登録先と本人のGitホスト権限・実体の再照合はHTTPと同じ `service/access.ts` を使う。MCPのTool入力・取消・エラー応答は通信側、Workspaceの操作・Git処置の調停はServer、記録・状態遷移はExecution Modelが担当する。

`transport/mcp-server.ts`はHTTPと同じ実行定義の受付を経由してExecution Modelの一般定義CRUDへ接続する。`crdd.get_execution_plan`、`crdd.list_objectives`、`crdd.list_tasks`、`crdd.initialize_execution_definition`、`crdd.save_execution_plan`、Objective／Taskの作成・更新・削除をそれぞれ独立したツールとして登録する。共有では本人のGitホスト実効権限を読み取り・書き込み別に確認し、GitHubではAppの権限も確認する。外部照会は保存ロックの前に完了し、結果は現在の接続と対象を再確認した後に返す。入力は`repositoryId`、`projectId`、`milestoneId`と操作固有の項目であり、Root・主体・認可関数をClientから受け取らない。Plan等の意味・DAG・参照・CASはDomainが検査する。

応答はDomain結果を`structuredContent`と表示用textへ同じ内容で搬送する。unknown、競合、公開可能なexact回復参照を保持し、通信失敗を無保存又は再送許可に変換しない。独立する定義・照会系Toolの動作と、実行系Toolの呼出し・結果を別々に確認する。実Provider検証Toolは同じ配布入口を `--mcp-stdio` で起動する。

## Core API接続の目標 — 2026-10-27

[Domain API入出力](../execution-model/05_Runtime_Domain.md#runtime-domain-api)へ直接接続する。Coreの定義CRUD・QueryはCoordinatorをloadせず提供し、管理実行は明示導入時だけ既存実行Ownerへ接続する。現在認証・対象認可を検証済みRootと区別し、Host専用ContextをMCP入力から再構成しない。2026-10-27時点ではSourceと通信契約の追従・独立起動試験は未実施だった。現在の限定接続・検証は上節を参照し、保存先変更・Executor分離・実AI境界の成立とは区別する。

## 公式SDK移行の実装境界 — 2026-10-20

### Coordinator統合後の通信名 — 2026-10-22

Task状態のTool名は`crdd.get_execution_state`、起動構成の依存keyは`coordinator`とする。旧Tool名は一覧・Call受付から除き、旧構成keyは値が未定義でも拒否する。互換aliasを追加しない。Adapterの説明契約は`crdd-mcp/coordinator-adapter/v6`とし、Objective要求は`operation`、`plan`と`taskInputs`を必須とする。`projectModelOwnership`は調停側の`coordinator`を表す。Protocol版`2026-07-28`、認証・取消・終了の意味は変更しない。

MCP内部の診断reasonは`mcp_*`へ統一する。ただし、Coordinatorから返る保存契約・Task結果reasonは別の移行単位として維持する。旧通信名の撤去は、保存Schemaや保持中の回復参照を変更する根拠にはしない。

[移行対応表](../../../99_Roadmap/Changes/CHG-000082/mcp-server-sdk-structure.md)に従い、ProtocolとTransportを公式SDK v2へ移す。固定依存はServer `2.3.1`、Node HTTP接続`2.1.1`。AMのSource・公開API・保存・認証・ACLは変更しない。AM内部結果の投影検証はAM自身のUnit、MCPは型付き公開Outcomeの搬送を検査し、内部関数へPackage間deep importしない。

HTTPは公式SDKへ接続する。要求別の認証と受信量・重複キーの検査を経て、標準のJSON-RPC外枠と元のパラメーターをSDK Node接続へ渡す。SDKは対応版と所定のヘッダー一致を確認する。通信の包絡や未登録ToolはProtocolエラー、登録済みToolの引数・実行の失敗はTool結果で返し、JSON-RPC応答全体を二重格納しない。`server/discover` は通信能力の照会だけで、初回接続の確定や保存を行わない。

HTTPとstdioは `server/discover` 方式の対応版を公式SDKに委ね、CRDD独自の版一覧を持たない。v0.22で採用したSDKはこの方式では `2026-07-28` に対応する。旧 `initialize` は有効にしない。SDKの版違い応答は対応版の案内を保ち、版名に見せた任意文字列は返さない。共有HTTPの本番認証はOAuthの一経路とし、合成照会は試験側で構成して同じSDKのBearer検証と要求搬送に接続する。

SDKとの境界再確認（2026-10-21）: Content-Typeの意味判定はSDK公開`isJsonContentType`を使用する。Bearer、Origin、TLS終端Headerのexact相関と重複拒否、生JSONの重複key拒否、fatal UTF-8とbyte上限、公開methodの閉集合、取消・join・no-storeはCRDD側が所有する。CRDDはAcceptと、Tool以外で提示された `Mcp-Name` を確認する。プロトコル版と、SDKが定める必須ヘッダーおよび包絡の一致はSDKが検査する。初回確認保存が存在した切替前の構成とは区別する。

公開Server識別名は`crdd-mcp`とし、要求別SDK Server二経路と応答metadataで同じ内部定数を使う。Tool結果の`crdd-coordinator/...`等の既存契約namespace、Protocol版、Tool名、Release版の判断はこの識別名訂正へ含めない。

通常要求は要求ごとのHandlerと現在ACLを使い、Serverの再利用でPrincipalをcacheしない。SDKの標準Handlerを持つことだけでping、旧Initialize、通知等の公開範囲を拡張しない。stdioでも待機byte総量、逐次意味実行、EOF取消とjoinをSDK接続へ保持する。HTTP接続だけでstdio・Source全移管・旧Router撤去・Client互換の完了とは表示しない。

終了では従来の要求Controllerと未終了処理の集合を使い、SDKの終了だけで下位処理の終了を判断しない。HTTP切断は当該要求の取消をTool callbackへ伝える。ただし、最初のTaskが認可された共有Objectiveは、切断だけを理由に停止しない。Server終了は実行の監督を含め、開始済み処理とSDK資源の回収を待つ。

MCPの内部組立て・Tool定義と登録、認証後の要求構成は `transport/mcp-server.ts` に置く。HTTPは `transport/mcp-http.ts`、標準入出力は `transport/mcp-stdio.ts`、共通の要求受付とSDK接続は `transport/mcp-protocol.ts`、共用型は `transport/mcp-types.ts` が所有する。一度受理したTool名・引数を各操作へ渡す。HTTPとstdioは共通のJSON-RPC形式、一要求のSDK接続、開始済みOwnerを待ってからSDKを閉じる処理を共用する。HTTPのBearer／Originと切断時の非開示、stdioの有界逐次処理・EOF取消・出力完了は区別し、継承型のTransportを追加しない。WorkspaceのCoordinator受付、Topic／Meetingの書込み本文検査、活動Readerへの接続は それぞれの機能の所有元をHTTPと共用する。

HTTPとstdioでは、SDKが対応版を判定してから、`transport/mcp-protocol.ts` の共通受付でCRDDが受け付けるパラメーターとメタデータの必須項目を一度だけ確認する。通常要求の外枠とメタデータの未知キーは使わず、重複キーは `transport/parse-json.ts` が先に拒否する。`tools/list` は現在の認可で得た全件を一度に返し、カーソルを使わず `nextCursor` を発行しない。この取扱いはページ分割するTool自体の引数に適用しない。`createMcpServerFactory` は検査済み要求・現在の取消・開始済み処理の観測先を要求別SDK Serverへ結び付け、外枠を再検査しない。一要求のServerや認可結果は後続要求へ再利用しない。許可済みToolと実行先を公式の `McpServer` へ登録し、公開スキーマの検査はSDK、業務上の整合と実行時の認可は既存の処理が担う。本番Toolの契約試験も同じ受付とFactoryを使う。

通常のJSON-RPC要求では、最上位と `_meta` の未知項目と、メソッド別の `params` を区別する。前者は処理に使わない。後者の非対応項目は `-32602` で拒否する。既知のメタデータに必要な型の検査、版の照合や取消通知の既存契約は維持する。進捗トークンやログ水準は、正常な値を受理しても進捗・ログ通知の生成には使わない。

登録済みToolへ渡す入力はSDKが正規化し、公開スキーマで確認した値とする。SDKが正規化時に捨てる `__proto__` がTool引数の直下にある場合は、登録済みToolを呼び出さず固定の `-32602`／`Invalid params` を返す。通常要求の外枠やメタデータの未知項目はこの特例の対象ではない。スキーマ不適合は `isError: true` と固定文言 `Invalid arguments` で返し、SDKの検査詳細や入力値を公開しない。検査の内部故障や実行中の内部例外も固定のTool失敗に変換する。固定SDKは未登録名をProtocolエラー本文へそのまま入れるため、未登録・権限外は公開一覧と同じ集合に基づいて固定の `-32602`／`Tool unavailable` を返す。認可の結果をキャッシュせず、公開していないToolの存在も区別しない。

共有OAuthの保護対象メタデータ（Protected Resource Metadata）は、事前に確認した対象と認可サーバーのURLから公式SDKで生成する。対象は `/mcp`、利用できるスコープとヘッダーでのBearer搬送の案内は従来どおりである。公開情報の生成は、トークン照会や現在認可とは別の処理である。

共有HTTPのBearer検証と認証エラー応答は公式SDKに委譲する。Authorizationの重複・余剰語はSDKの解釈前に拒否する。照会側は有効なBearer、正しい発行者、単一かつ完全一致する `/mcp` 宛先、期限、外部クライアントと主体を確認し、SDKがスコープを判定する。SDKの資源照合で許可できる子パス、末尾スラッシュ違い、複数宛先をCRDDの許可範囲に広げない。トークンの拒否は401、スコープ不足は403で、認証の案内に保護対象メタデータのURLを付ける。照会サービスの障害は500とし、資格が無効だったとは扱わない。認証結果は当該SDK要求だけに渡し、Toolの実行前にSDKコンテキストの主体と現在認可に用いる主体を照合する。アクセス管理・Gitホストによる操作ごとの現在認可と、実行開始後の監視は別に維持する。

共有HTTPは、認証とアクセス管理による本人の受付判定を本文読取り前に行う。SDKはその要求の認証結果からServerを新規に組み立てる。トークンをキーにハンドラーや認可結果を保持しない。Server生成中に終了を開始した場合はToolを実行せず、生成物を閉じるまで待つ。非POSTと未対応Content-Typeは本文を待たずに405・415を返し、405には `Allow: POST` を付ける。通常はSDKの応答を使い、Fetch Requestに変換できない `CONNECT`・`TRACE`・`TRACK` だけはHTTP受付で405を返す。

本文前の照合では、OAuth主体が現在もCRDDの利用者に結び付いているかを確認する。本文を受け取った後のTool一覧・登録では現在のロールを確認し、管理一覧の実行時はアクセス管理が現在のロールと取得結果を同じ保存読取りで判定する。受信待ちの間に紐付けやロールが変わり得るため、本文前の結果を一覧・実行の許可として使い回さない。逆に、実行時の判定を理由に、未認証の本文を先に読む方式へ変更しない。

HTTPとstdioの受付はFactoryのみを受け取り、一般の関数を低水準SDKへ接続する本番分岐を持たない。通信故障の試験に必要な合成ハンドラーは、試験側でFactoryに適合させる。合成の低水準SDK応答を、本番Toolの応答契約の証明には用いない。

Workspace再編のMachine入口は[横断契約](../coordinator/05_Workspace.md)へ接続する。`crdd.list_workspaces`・`crdd.get_workspace`・`crdd.inspect_workspace`・`crdd.get_workspace_candidate_diff`を読み取り、作成・選択・改名・保留・固定・採用・候補閉鎖・破棄をそれぞれ別Toolとする。入力はRepository IDと操作別の閉じた欄で、`operation`や`command`を受理しない。Root・認可関数・参照解放の自己申告を受けない。通常Launcherは固定RepositoryのManifest、共有HTTPは要求毎のAM現在development許可から同じCoordinatorのTask／Objective公開Ownerを解決する。内容領域のworkspaceIdsをGit Workspace UUIDへ流用せず、鍵操作非公開・Repository登録Workbench限定の既存境界を変更しない。通常Objectiveには任意の`workspaceId`を搬送できるが、既存Queueの同Project所属・ready・保持なしを実Writerが再確認し、不明時にDirectへfallbackしない。公開接続の実装・検証中であり、実Provider全体の完成主張ではない。 GitHub付き登録のWorkspaceでは、GitHub照会を既存の実行Lease・保存Lockより前に終える。既存の認可確認点ではAM・連携・配置と接続先を同期で確認し、ネットワークを呼ばない。認可喪失で公開を止めても、確定済み意図・回復義務を消さない。

切替前の横断Relationでは、構成が認可済み同Project集合を選び、Domainの`federateTopicMeetingRelations`へ渡していた。現在の共有MCPは、この旧公開範囲を使う横断経路へ接続しない。

共有MCPのTopic／Meetingの一覧・詳細と書き込みは、Gitホスト連携を使う共有HTTPと同じ操作へ接続する。詳細の関連情報は明示されたRepository内に限定し、`relationScope: "repository"` を返す。不正入力・事前取消では外部照会に進まない。SDKツールの取消を外部照会まで伝え、待機後は本文取得と結果公開を止める。書き込みは本人の実効書込み権限を要求し、GitHubではAppの権限も確認する。指定Rootの作業ツリーだけを変更する。Access ManagementのLockを保持したまま記録Lockを取らない。記録Lock内の確定直前はローカルの認可・実体・接続先だけを再照合し、外部通信を行わない。確定後に公開できない結果から未保存を推定しない。旧公開範囲による許可は使わない。

### SDK移行後の公開入口と互換範囲

| 用途 | 公開API・起動入口 | 結果・境界 |
|---|---|---|
| Tool構成 | `createMcpServerFactory`、`McpServerDependencies`、`McpServerFactory` | 要求ごとのSDK Server。現在認可と元入力を後続要求へ共有しない |
| 現在認証 | `createOAuthMcpResolver` | トークンの確認結果から要求別の処理を解決する。現在認可を満たさない要求には対象を開示しない |
| stdio | `runMcpStdio` | 通常要求は有界の逐次実行。Objective実行中の状態照会・明示取消だけ並行枠1件。両枠とも同じSDK登録と現在認可に接続する。EOFで両方を取り消して終了を待つ。外部Streamを破棄しない |
| HTTP | `createMcpHttpRequestHandler` | 共有Serverの待受へ接続する認証付き要求処理。Origin・現在認可・切断取消・終了待ち |
| 構成・終了 | `readMcpServerConfiguration`、CRDD Serverの起動処理 | 共有HTTPと同じ待受の停止・取消・終了待ち。単独のHTTP MCP起動処理は持たない |
| Tool契約 | `transport/mcp-server.ts`の明示公開定義と専門Ownerへの接続 | 専門Ownerの既存入力・結果を維持。汎用Protocol補助は内部のみ |
| 配布コマンド | `crdd-server [--port <port>]`、`--shared`、`--mcp-stdio` | HTTPは常にloopback。stdioは単体に限りMCPだけを切替 |

判断Toolは、起動時に指定したローカルRepositoryか、共有認証で許可されたRepositoryに対してのみ正式な`submitDecision`を呼ぶ。起動側が判断処理や結果を差し替えるコールバックは受け取らない。判断の完全な記録はEMが保存操作内で検査し、`submitDecision`が結果区分と履歴・回復の相関を確認する。Transportは保存物を再読取りせず、共有接続の公開前認可と、結果未確認時の停止を維持する。

`routeMcpRequest` と `McpRequestRoutingDependencies` は撤去し、互換Routerを残さない。Task／Objective固有Schemaは `transport/mcp-server.ts`、閉じた共通通信入力の検査は `transport/mcp-protocol.ts` が所有する。生JSONの重複キー拒否は維持する。同一プロセスの直接呼び出しはJSON相当の値を渡す契約とし、getter・Proxyを呼ばずに拒否する保証は持たない。待機後まで使う値だけを操作側で確定する。認証結果および下位からの結果の検査は別境界で維持する。

公式Client `2.3.1`は試験用の開発依存だけに固定する。対応対象はProtocol `2026-07-28`を明示したmodern Clientであり、既定legacy Initializeや購読・汎用pingの互換を新設しない。stdioの取消通知は現在のIDだけへ結合し、不明・完了済みIDを次要求へ流用しない。Owner終了、SDK応答生成、外部出力callback、内部資源回収を分けて確認する。

成果物種別: Architecture詳細設計
詳細設計領域: mcp-server
状態: Candidate

MCPの通信・受付の実装は `crdd-server/src/transport` に置く。MCPはAI専用ではなくMachine向け公開境界である。WorkbenchとMCPは対等な独立入口であり、WorkbenchはLocal／共有配置とも同Hostの専門Package APIへ接続し、MCP Clientにはならない。Portfolio、Runtime Activity、Topic／Meetingの既存能力は実Ownerの公開契約へ接続する。現在認証・認可と接続解決はAccess Management、認可済みContextの意味解析・集約はDomain Modelが所有する。鍵管理とRepository登録はMCPの公開能力に含めない。現行Source・試験の成立範囲と正式評価は区別する。

## 基本設計との関係

### 公開起動入口の利用形態 — 2026-10-13

配布入口は既定単体と `--shared` を区別する。単体では `--mcp-stdio` を指定した場合に限りMCPを開始し、HTTPの `/mcp` は公開しない。共有HTTPは起動時に既存Host管理状態とOAuth設定を検証し、Host管理Rootを作らない。Googleログインを有効にした統一起動でMCP用OAuthの設定がない場合は、旧Bearer方式へ切り替えず起動を拒否する。要求ごとにMCP向けOAuthトークンと現在認可を照合する。AI設定管理と鍵操作をMCPに公開しない。

`--shared` と `--mcp-stdio` は併用できない。共有の初期設定はServerのHost管理CLIで行い、公開MCPから初回設定や確認保存を行わない。管理ルートが不明でも単体に切り替えない。終了時は既存のHTTP取消・終了待ち・待受の清掃を使い、確定済みの処置を取消で巻き戻さない。

旧Bearer方式のSource切替と局所公開Process試験では、初回限定→通常接続、administrator本人、同鍵失効後拒否、managerの旧四Tool拒否、不正mode・未設定／破損管理状態の拒否を評価した。これは当時の記録であり、現在の共有OAuthの成立証拠には用いない。

### Topic／Meetingの現在認可前の入力境界 — 2026-10-12

Routed Adapterは明示Repository IDを分離し、共通Adapterへ要求専用の遅延Resolverを渡す。各操作の完全な純粋Schema検査→取消確認→Resolver一回→取消再確認→Domain操作の順を固定する。Resolverの同期観測中に取消された場合も保存へ進まない。不正入力・開始前取消はResolver 0回、対象拒否nullは既存Invalid params、解決例外は秘密を含まないInternal errorへ閉じる。直接TopicMeetingAccessを渡す既存入口の正常CRUD・改訂競合・保存故障分類は維持する。

これはAM接続の事前条件の是正である。manifest Project拘束とDomain Relation移管を利用した実HTTP接続は下記構成へ接続済みで、公開Launcher・Workbench直接接続と旧REST撤去を実施した。正式評価と後続E2Eは別Gateとして維持する。保存開始後の取消からrollback・Effect 0を推定しない。

取消は、受付前なら `-32800` で対象Readerを呼ばない。同期Readerの実行中に検出した場合は当該Readerの終了を待ち、応答可能なら固定文言のTool失敗を返す。本文を公開せず、後続Readerを起動したり暗黙に再実行したりしない。

### 現在認可による内容操作の新Owner接続 — 2026-10-12

以下は旧Bearer方式での接続を確認した時点の記録である。現行の配布入口と認証方式は[公開起動入口の利用形態](#公開起動入口の利用形態--2026-10-13)に従う。

旧 `createAccessMcpResolver` は、旧接続鍵を照合して要求別Handlerを構成していた。現行Serverからはこの入口・照合分岐を撤去した。現行のOAuthでは、検証済みの主体を現在のアクセス管理と結び付け、許可済みの資料だけを公開する。文書未確認・競合を認可済み資料の失敗として区別し、認可未確認を正常な空集合に読み替えない。

Bearerは当該HTTP要求のclosureだけに保持し、保存・共有・応答・下位例外本文へ渡さない。文字列の消去保証は主張しない。開始前取消では集合・本文を読まず、同期Reader開始後は読取り終了を待って結果公開を止める。HTTP終了の資源所有・joinは既存Transportを利用し、新Session・State・Lockを追加しない。

この構成の公開ToolはProject Context一覧・取得とTopic／Meetingの既存12操作である。Topic／Meetingは完全入力検査と開始前取消の後に現在許可集合を取得し、指定Repositoryが非許可なら固定Invalid params、集合・Root・構成不明なら固定Internal errorへ閉じる。同Projectの全RootをVersion Control公開入口で再観測し、manifest Project拘束付きDomain操作とRelation判定へ渡す。構成中に保存せず、書込みは指定Sourceだけ、Relation探索は同Project許可集合だけとする。一件不明でも部分集合へ後退しない。

活動取得も同Resolverへ接続する。完全入力検査と開始前取消の後、現在AM集合から同Projectの全許可対象を選び、Project／Repository／技術的RootだけをCoordinatorの状態Readerへ渡す。0対象は非開示null、集合・Root不明は全体停止とする。結果検査はCoordinatorの結果Parserへ委譲し、応答Projectと要求Projectもexact比較する。内容・活動Toolの構成はContext二操作・Topic／Meeting十二操作・活動一操作の計十五Toolとなる。

鍵とAI設定管理はMCPへ公開しない。2026-10-13の撤去候補では旧CROS ResolverとShared HostをMCPのSource・公開export・配布入口から撤去し、配布MCP入口はcreateAccessMcpResolverを使う。Workbenchは同Hostの専門Packageへ直接接続する。旧REST同一Origin・Gateway health・HTTP入口stdin EOFは維持能力ではない。現在のTool集合は本人read・非鍵管理・内容・活動を現在の認可で選び、初期の15／19 Tool局所集合を最新のexact集合へ流用しない。PPR-IT-002、CPR-IT-010／012、RFD-IT-013／019、EST-IT-002／014の検証義務を維持し、正式191項目とMCP全体完成は別Gateとする。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | 標準Project Contextから得た読取り専用のProject／Portfolio ProjectionをMCP DTOへ写し、五つの観点、欠測・制限・根拠を失わず返す。Transportは独自のProject状態StoreやObjective／Milestone受入判断Authorityを生成しない。 | Partial |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | stdioとHTTPを同じPublic Application Contractへ接続し、Transport間の意味同一性を保つ。 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | Access Managementが現在認証・認可した要求だけを実Ownerへ渡し、許可範囲をTransportで拡張しない。鍵操作は一覧・Schema・登録・dispatchの全てで非公開とする。 | Partial |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 外部情報の入力・結果をMCP wireへ運ぶが、送信許可や候補採用Authorityは所有しない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | stdio、HTTP、Schema Adapter、LauncherをTransport責務へ限定する。 | [§2](#2-package境界) |
| Interface Model | Required | 公開DTOとCoordinatorのTask／Objective契約の変換を一方向にする。 | [§4](#4-authorityと情報境界) |
| Data Flow | Required | Client入力からApplication結果までTransportが意味を所有しない流れを示す。 | [§3](#3-依存と所有権) |
| State Model | Required | 接続、Request、取消、切断、Server終了を分ける。 | [§5](#5-transport-lifecycle) |
| Sequence | Required | 認証、変換、Application実行、結果搬送、終了joinの順序を固定する。 | [§5](#5-transport-lifecycle) |
| Failure／Recovery | Required | framing、認証、切断、Application失敗を理由別に返す。 | [§6](#6-正常準正常異常) |
| Deployment | Required | stdio Processとlocalhost HTTP Serverの配置差を示す。 | [§2](#2-package境界) |
| Observability | Required | wire、Request、Application、shutdownを相関して観測する。 | [§7](#7-検証と完成境界) |
| Security Boundary | Required | 認証、Origin、情報分類をTransport接続だけから生成しない。 | [§4](#4-authorityと情報境界) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | RequestごとのApplication実行を独立させ、Server終了時に取消してjoinする。 | [正本節](#5-transport-lifecycle) |
| Timing | PASS | 接続、Request、取消、Server終了の待機を別に観測する。 | [正本節](#5-transport-lifecycle) |
| Resource Lifecycle | PASS | stream、listener、Application実行を接続／Request Ownerへ結ぶ。 | [正本節](#5-transport-lifecycle) |
| External Boundary | PASS | stdio、共有HTTP、Origin、認証を独立境界として扱う。 | [正本節](#51-localhost-streamable-http) |
| Failure／Recovery | PASS | 切断、取消、framing不正、Application失敗を理由別に返す。 | [正本節](#6-正常準正常異常) |
| State／Consistency | PASS | 接続、Request、取消、切断、Server終了を分ける。 | [§5](#5-transport-lifecycle) |
| Observability | PASS | wire、Request、Application、shutdownを相関して観測する。 | [§7](#7-検証と完成境界) |
| Security／Trust | PASS | 認証、Origin、情報分類をTransport接続だけから生成しない。 | [§4](#4-authorityと情報境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `mcp.stdio-transport` | Interface／Lifecycle Ownership | JSON-RPC byte stream | framingを保った応答 | UTF-8分割、EOF、取消競合 | IT／ST | Direct Boundary | wire bytesとexit | listener／request 0 | なし |
| `mcp.localhost-http-transport` | Interface／Lifecycle Ownership | 認証済みHTTP request | stdioと同じApplication意味 | Origin、token、payload、shutdown | IT／ST | Direct Boundary | HTTP statusとcontract result | server／listener／request 0 | 実OS signalは未評価 |

鍵管理の非公開境界は既存Transport導出項目とは別に、Access Management詳細§8の`access-management.secret-delivery`へ接続する。新しいQA Local Itemは本書で推測採番しない。

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 公開境界の補足説明

| 対象 | 反証と観測 | 段階・終了後条件 | 未確認 |
|---|---|---|---|
| MCPの鍵操作非公開 | 単体／CROS、管理者／非管理者、stdio／HTTPで提供する構成のTool一覧・Schema・登録・直接Call／dispatchを照合。非秘密一覧・失効も公開されない。認証用Credential検証は存続 | IT／ST、Direct Boundary／System/E2E。鍵Owner呼出し・発行・失効・交換Effect0、Secret結果0。未提供の構成はN/A理由をQualityに残す | Quality Local Item、Source全登録閉包、本番Consumerと新Evidence |
| 認可Ownerの分離 | AMが現在認可した集合だけをDomainへ渡す。管理可否から内容参照を生成せず、DomainのCredential／Role／Grant解釈0を反証 | IT／ST、Direct Boundary。非許可Source読取り・情報開示0。単体の検証済み一Repositoryは資格不要 | 具体公開型、保存Schema、本番構成 |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-10-11

Related:
- [Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [Task／Objective管理](../coordinator/03_Task_Architecture.md)
- [MCP Serverの利用手順](../../../19_Workflows/04_MCP_Server.md)
- [Project状態参照とローカルMCP HTTP](../../../99_Roadmap/Changes/CHG-000064/change.md)

## 1. 目的と責務

MCP Serverは、Protocolのrequest、response、通知、接続とTransport lifecycleを、Coordinator、Domain ModelおよびAccess Managementの公開契約へ搬送する。Objective／Taskの意味、Provider、Repository成果物またはAuthorityの所有者ではない。AI／Machine Clientの種類から意味・権限を生成しない。Workbenchは独立したHuman入口でありMCP経由で操作しない。

v0.20の責務分離では既存MCP stdioを独立packageへ移し、MCP Streamable HTTPを同じCoordinator公開契約へ接続する別Transportとして追加する。HTTPはstdio実装またはCoordinator内部moduleを再利用して意味契約を作らない。

利用者向け起動入口は`template/tools/crdd-server.ts`を維持し、本体の起動へ配送する薄い入口とする。構成RootはMCP Server自身が所有し、Coordinator、Domain Model、Access Management等の実Ownerの公開APIだけから必要能力を構成する。Coordinator内部、Provider、Nativeや署名秘密を直接構成せず、Coordinator CLIもMCPをsubcommandとして所有しない。

## 2. Package境界

```text
40_Develop/crdd-server/
├ package.json
├ src/
│  ├ index.ts
│  └ mcp/
│     ├ core.ts
│     ├ request/
│     ├ tools/
│     └ transport/
└ tests/
   ├ unit/
   ├ integration/
   ├ system/
   ├ fixtures/
   └ support/
```

- `protocol`は通常要求のJSON-RPC必須項目・IDと、CRDD固有のメタデータ・Tool受付条件を確認する。通常要求の外枠に追加された未知キーは使わない。対応版はSDKが判定し、重複キーはJSONの解析時に拒否する。JSON-RPCエラーの構成は同じ関数をHTTPとstdioから使用する。Coordinatorへ依存しない。
- `adapters`はMCP入力をCoordinatorのTask／Objective公開要求へ変換し、公開結果をMCP結果へ投影する。Project Context参照では固定Markdownの意味契約を利用し、MCP固有の状態要約を正本化しない。
- `transports`はstdio、localhost HTTP等のbyte framing、fatal UTF-8、容量、header、socketおよびSession lifecycleを所有する。
- 共通操作は `src/service/` の内部処理とする。外部利用側にはCLIから起動するMCP通信だけを公開する。単体MCPの実行系Toolは通常一覧に含み、呼出しまで実行処理を読み込まない。パッケージのルートでは内部サービスを再公開しない。
- `composition`はServerの構成・起動を所有する。旧Shared ServerのREST／Gateway構成は撤去し、認可済み内部能力の接続だけを保持する。`boundary`は閉じた入力snapshotを所有し、`internal`という雑多な置場を作らない。src配下のFolderは二階層以内とする。
- `template/tools/crdd-server.ts`は配布用の薄い起動入口であり、本体構成や意味処理を再定義しない。

## 3. 依存と所有権

### 内部ブロック図

矢印は要求の搬送・呼出しを示す。結果は逆方向に返る。ProtocolはTransport間で共有し、Projectの意味契約を再定義しない。

```text
配布Launcher：構成と起動
  ↓
Transport（transports/）
  ├─ stdio：標準入出力・framing
  └─ localhost HTTP：認証・header・body・socket
       │
       ├→ Protocol（protocol/）
       │    JSON文書・MCP envelope・method・error
       ↓
Application Adapter（adapters/application-adapter.ts）
  │ Tool一覧と専門AdapterへのRoutingだけを所有
  ├→ Task／Objective入力・結果のAdapter
  │    │ MCP要求と実行要求・結果の変換
  │    ↓ 公開入口だけを利用
  │  Coordinator公開API【Task／Objective管理】
  │
  └→ Project Context Adapter
       │ 一覧・取得要求を許可済みPortfolioへ変換
       ├→ Repository Project Context Reader【単一Repository】
       └→ Domain Modelの認可済みPortfolio集約【複数Repository】
            ↑ Access Managementが現在認可したRepository集合だけ

終了制御（transports/process-signal-*）
  → 受付停止・要求取消・Application終了待ち・Transport回収

純粋な入力snapshot（boundary/）
  → 各利用箇所の入力を固定。実行権限は発行しない
```

`src/transport/mcp-server.ts` はMCP受付を構成する内部ファイルである。HTTPとstdioの受付は要求別のSDK Serverを構築する `McpServerFactory` に依存し、Task／ObjectiveまたはProject Contextの意味処理を直接所有しない。Coordinator、文書モデルのContext Reader／Portfolio集約およびAccess Managementとの具体的な組合せはLauncher／Server Composition Rootが所有し、MCP内部にProvider実行・Repository書込み・Workspace Grant判定のブロックを置かない。

MCPの実行操作は単一CoordinatorのTask／Objective公開API、Repository成果物操作と認可済みContext集約はDomain Model、要求毎の認証・認可と接続解決はAccess Managementの公開入口へ依存する。CoordinatorのPackage Rootは利用できるが、Execution等の内部Path、Provider、Candidate Store、Windows Adapter、実行知Storeを直接importしない。Topic／Meetingの本文CRUDはDomain Model、許可済みRepository Bindingの解決はAccess Management、MCP wire変換は本Serverが所有し、同じ処理をTransport別に複製しない。

CoordinatorのTask状態、Identity、Recovery、判断または結果fieldをMCP Schemaで独立再定義しない。MCP固有Envelopeは保持するが、そのpayloadはCoordinatorのcanonicalな公開契約を一つの変換規則で投影する。公開契約変更時はMCP利用側試験を変更影響型runnerが必ず選択する。

Project Contextを返す場合も同じ原則を適用する。`crdd.list_projects`は現在の接続から参照できるProject ID、統合状態および許可済みSource数だけを返し、`crdd.get_project_context`は指定ProjectのSource Coverageと各Repositoryが投影した五場面を返す。MCPは現在地、Risk・停止要因、人間の判断待ち、理由・根拠および次の一手を搬送するが、Repository内正本、共有分析および対話時の追加推論を混同しない。Repository Role外のContextを補完せず、項目別`Observed At`、Project Context固有IDまたはLive環境状態をMCPだけの都合で追加しない。

Repository単体では、現在の検証済みRepository Rootにある`PROJECT_CONTEXT.md`を毎Requestで読み取り、一SourceのPortfolio Projectionへ変換する。この経路にCROS Credentialを要求しない。CROS利用時は、Access Managementが現在認可したRepository集合をDomain Modelが集約したPortfolio Projectionを同じAdapterへ渡す。MCPは両経路のAuthorityを統合・拡張せず、入力Projectionに存在しないProjectを同じ`project_context_not_available`へ閉じる。

共有MCPでは、要求のBearerをMCP宛てOAuthトークンとして照会し、検証済みの主体だけをアクセス管理へ渡す。MCPはCRDDが以前発行した接続鍵を照合しない。現在の利用者・紐付け・ロールを操作に応じて確認し、内容操作は対象Gitホストにおける本人の現在の実効権限へ接続する。

要求別HandlerはOAuth照会と現在の主体の確認に成功した場合だけ構成する。Tool一覧・本人照会・管理の読取りは、同じ主体に対する現在のアクセス管理を使い、旧鍵のRole判定へ戻らない。本文待機後に権限を確認し、認可未確認を成功として公開しない。

本段落は公開入口切替前の局所確認履歴である。現在の公開入口接続と旧MCP Resolver／Shared Host撤去は§3を参照する。この接続は`createAccessMcpResolver`の実HTTP搬送契約で段階確認する。現在はContext二操作、Topic／Meeting十二操作と活動一操作に、Catalog構成時のProfile四操作を加えた局所候補であり、現在Role／Exposure／失効、固定拒否、manifest Project拘束と同Project Relationへ接続する。先行段階のContext専用・十四Tool・活動を含む十五Tool構成と、現在の条件付き十五／十九Tool候補を区別する。Catalog依存を構成した局所候補ではmanager／administratorが19 Tool、developerが15 Tool、Catalog未構成時は15 Toolとする。旧Resolver／Shared Hostは公開Launcher／Workbenchを含む全能力の本番代替が成立するまで撤去せず、新旧認証のfallback合成は行わない。鍵は非公開、Profileは現在AM認可と実HTTPの局所候補に接続済み。本番Launcher／Workbenchへの切替は未完了。Root能力・Token・内部Path・管理改訂を公開結果へ追加せず、同期Reader開始後の取消をI/O中断やEffect 0と表示しない。要求前の取消は内容読取りを開始せず、開始後は同期処理の終了を待って結果公開を停止する。本段落は本番切替済み・AM全体完成の表示ではない。

Coordinatorの実行状態を返すToolは`crdd.get_execution_state`とする。旧名`crdd.get_project_state`はProject全体のCurrent Projectionと誤認し得るため、v0.22の公開候補へ残さない。Project Contextは`crdd.list_projects`と`crdd.get_project_context`で取得し、Runtime DTOを再利用しない。

Repository単体MCPでは、Topic／Meetingの一覧、取得、登録、編集、削除およびMeeting Outcome処置ToolをProject Operationの共通Application契約へ接続する。一覧は同契約の検索、状態、Owner、期間、Relation、未処置Outcome、並び順およびID Cursor Paginationをそのまま搬送する。削除は誤登録理由、期待Revision、Relation影響0件および明示確認をすべて満たす場合だけEffectを発行する。Outcome処置は完了・移管・昇格・理由付き不採用を区別し、全件処置済みの場合だけ同じCommandでMeetingを閉じられる。

### 単体と共有の対象選択

単体は起動時に確認したリポジトリに固定し、兄弟リポジトリを探索しない。共有は有効なMCP OAuth資格と、登録済みの対象についてGitホストが返す本人の実効権限を使う。管理ロールは内容の権限にならない。明示指定を要求する操作では、そのIDだけを使い、別リポジトリへ切り替えない。対象IDは配送情報であり、提示だけで読取りを許可しない。設定不正や初期化不明で共有を単体へ切り替えない。

共有モードの初回管理者はHostの対話操作で外部ログイン主体と紐付ける。未初期化、管理者の紐付けなし、OAuth設定不足では共有を起動しない。単体stdioに共有の資格は要求せず、`--shared --mcp-stdio` は受け付けない。共有のOAuthトークンはHTTPの認証ヘッダーで受け、Tool引数には含めない。本文受信後にトークンと同意がまだ有効か共有Server内の状態で確認する。管理読取りでは待機後と結果公開前にも確認し、別の外部照会はしない。開始済み実行の監督は、この受付資格の寿命から分離する。

AI設定の管理はWorkbenchからリポジトリ別の専門APIを使い、MCPには公開しない。管理ロール用の登録一覧と、個人に許可された内容の一覧は別に扱う。旧構想の独立した `crdd.list_repositories` は現行の公開Toolではない。

共有のTopic／Meeting詳細は指定リポジトリの中だけで関連先を確認し、`relationScope: "repository"` を返す。切替前に検討した同Project内のリポジトリ横断は現行の詳細取得では行わず、関連先本文を複製しない。関連情報を別リポジトリの書込み許可に使わない。

### 3.1. CROS能力を搬送する閉じた操作契約

以下はMCPの公開能力契約である。Tool名はProtocol正本で定義し、一覧・Routing・入力／結果検査・Machine Clientと契約試験を同じ改訂へ接続する。Workbenchの直接APIとは利用側を分離し、任意commandを受ける汎用Toolへまとめない。

| 操作 | 設計候補の入力 | 構造化結果とOwner | 認可・反例 |
|---|---|---|---|
| `crdd.get_execution_activity` | 必須`projectId`、共有では対象の`repositoryId`も指定する。任意`cursor`、任意`limit`（既定20、1〜50の整数）。未知項目は拒否する。 | 現在状態`observed / absent / unknown`、理由、projection、独立したeventState／eventReason、events、eventContinuation。Readerが結果なし（`null`）を返した場合だけTool失敗の `unavailable` と `execution_activity_unavailable` を返す。 | 現在認可済みリポジトリだけを活動OwnerのReaderへ渡す。Eventが観測不能の場合は空の成功へ変えない。Readerの例外・不正結果・Project不一致は固定のTool失敗とし、対象なしの構造化結果は返さない。 |

設定の読取り・保存・同時更新検査はRepository別AI設定のOwnerが担う。MCPは新規ObjectiveのworkType／choiceを既存Coordinatorへ搬送するだけで、設定を暗黙更新しない。開始済み実行の固定選定を現在設定から補完・差替えない。

Project一覧・Context取得とTopic／Meetingの既存Tool名・安定IDは維持する。Hostの指定ユーザー／全員鍵交換をRemote Toolにしない。新しい管理操作を一部登録しただけでCROS管理Surface全体を完成としない。

活動接続では、`transport/mcp-server.ts`が`crdd.get_execution_activity`のSchema・入力搬送を所有し、活動結果の意味・検査は[Coordinatorの認可済み活動読取り](../coordinator/03_Task_Architecture.md#73-認可済みrepositoryの活動読取り--新owner接続候補)へ委譲する。`transport/mcp-server.ts`は実Readerを接続した場合だけ一覧とCallへ同時登録する。Access Managementの現在認可集合を今回要求のRoot・Project・Repositoryへ射影して渡し、資格・Role・AM Bindingを活動Ownerへ渡さない。実Storeと複数Repository合成が未確認の注入Readerだけでは公開Toolを完成としない。旧`readCrosRuntimeActivity`は歴史的な移管比較対象で、現行Ownerではない。Readerに取消APIを捏造せず、開始前取消は呼出し零回、開始後取消はReader完了をjoinしてから取消結果を返す。公開Launcherは接続済み、AI設定管理はMCP非公開、Workbenchは独立した直接経路を利用し、旧RESTは撤去済みである。正式評価と後続E2Eから全体完成を判定する。

### 3.2. Portfolioの一覧・詳細契約

`crdd.list_projects` は空Objectを受け取り、その要求で許可されたProject概要を一括で返す。検索、状態指定、ページ幅、CursorはToolに公開しない。ページ分割が必要なWorkbenchはHTTPの `GET /api/projects` を使う。旧MCPページ分割案は現行契約ではない。

`crdd.get_project_context` はProject IDを受け、共有ではリポジトリIDも必須とする。現在認可は要求ごとに判定し、一覧時の許可集合を使い回さない。許可外または未検出の内容を公開せず、取得できた対象だけ五場面とSource Coverageを返す。

### 3.3. 鍵管理のMCP非公開境界

共有MCPで受け付ける認証はMCP宛てOAuthだけとする。現在の本人に許可された管理の読取りは提供するが、利用者・リポジトリの管理書込みや旧鍵の発行・提示・失効・交換は公開しない。廃止した旧方式を互換Toolとして残さない。初回の管理者登録と再紐付けはServerのHost管理CLIが担当する。

以下四段落は非鍵管理の公開接続前に固定した契約の履歴であり、当時の「未確定」「今回Source不変更」「公開接続・QA未実行」を現在状態へ流用しない。現在の公開API・Tool／Schema・dispatch・本番Consumer接続は§3.3.1に従う。

初回Host設定はAccess Managementの承認済み別開始契約であり、MCPへ公開しない。MCP起動やRemote CallからBootstrapしない。ユーザー管理、Role内容設定、Repository登録、Exposureの担当RoleはARCH-000013の9 Role分担行に従いAccess Managementへ委譲する。manager／administratorが許可される非鍵管理と、administrator専用のadministrator Role付与・解除・変更／内容設定を区別し、Role内容設定で管理権限をON／OFF・再委譲しない。具体公開API・Tool／Schema・登録・dispatch・本番Consumerは未確定で、担当Roleの採用から新Toolの公開や接続済みを推定しない。Profile管理等の既存非鍵能力の採否も変更しないが、旧`systemAdmin`等の実装語彙を新しいRole権限契約として採用しない。

非鍵管理の要求はAM詳細§4の操作別入力と変更前の現在固定管理認可へ結合する。登録は予定Role・表示名、既存Role変更は対象userId・前後Role、名前変更は対象userId・新表示名、Role内容設定は対象Role・内容、Repository管理は対象ID・現在登録／公開状態・変更内容を搬送する。managerはadministratorの名前だけ変更可でRole変更不可。managerの正常管理へadministrator存在を要求しない。管理拒否と自身表示・許可内容拒否を区別し、登録≠公開、解除≠データ削除、更新受理≠内容取得を保つ。内容取得は次要求の現行Role・Exposure・実アクセスを再評価する。

Repository登録解除の非鍵結果は、同じ受理済み操作・採用改訂による対象登録と対応Exposureの除去および両読戻しを区別して搬送する。両確認時だけ完了を投影し、片側残存・観測不能を完了にしない。対象外登録・Exposureと対象Repository本体・Product Dataを保持し、両除去の完了から開始済み操作の取消・過去Effect0・実資源終了を生成しない。解除後の内容要求は現在認可とExposure・実アクセスを再評価し、旧許可集合を再利用しない。

入力・現在認可・必要状態不明の拒否と、保存後の読戻し／応答不明を別結果として投影する。後者から未保存・rollback・Effect0や完了を生成せず、通常管理へ交換Recoveryを足さない。これらは公開能力の制約であり、今回SourceのTool集合やProtocolを変更しない。Qualityは既存AMの認可・可視性・通常管理の導出キーから、要求搬送と許可外情報／Effect0、固定分担、解除の両読戻し・保持範囲・取消非証明、結果軸の保持を具体化する。鍵は一覧・Schema・登録・dispatchと鍵Recovery参照0だけを負観測し、鍵処置をMCPの試験対象操作として新設しない。固定8分担・登録解除・通常鍵3分岐の前回伝播候補は契約・品質の限定独立レビュー済み・残指摘0で、公開接続・QA実行済みではない。

#### 3.3.1. 非鍵管理Toolの具体化候補

通常接続は、全ロールに本人照会 `crdd.get_current_access` を提供する。HTTPの本人照会と同じ本人・現在ロール・改訂を返し、他の利用者・資格・管理操作候補・リポジトリの内容権限・保存先は返さない。

| 管理の読取り | 入力 | 成功時の投影 |
|---|---|---|
| `crdd.list_access_users` | 空オブジェクト | 改訂、利用者ID・表示名・ロール |
| `crdd.list_registered_repositories` | 空オブジェクト | 改訂、登録リポジトリID |

管理の読取り2件は、要求時に有効な `manager` または `administrator` にだけ一覧表示する。直接呼出しでも、アクセス管理が現在の認証主体・ロール・読取り範囲を確認する。一覧取得時の許可を使い回さない。個々の読取りは別の改訂を返し得る。拒否・観測不能を空一覧へ変えない。ロール別内容範囲と公開範囲のツールは一覧・入力定義・呼出しに含めない。

アクセス管理の書込みはロールにかかわらず一覧・入力定義・登録・呼出しに存在しない。利用者の登録・表示名変更・管理ロール変更、リポジトリの登録・登録解除はWorkbenchが受け付ける。通常の開発操作は本人のGitホストでの実効権限に従い、この管理操作の制限とは別である。

読取り結果はアクセス管理の非秘密投影を `structuredContent` へ搬送する。成功は `status: completed` と改訂・操作別配列のみ。現在ロールで提供しないToolは一覧に載せず、未登録Toolと同じ `-32602 / Tool unavailable` で拒否する。登録後も実行時の認可を維持し、以後の拒否は `management_read_rejected`、観測・清掃・解放不明は `management_read_unavailable` とする。保存先、資格、内部例外は公開しない。読取り前と応答前に取消を確認し、自動再送しない。結果の大きさだけを理由に既知の結果を未取得へ置換しない。

### 3.4. 初回Host設定の非公開境界

旧初回資格の限定接続は切替前の仕様であり、MCPからは撤去した。共有MCPではOAuthの同意を使い、旧資格で通信能力の照会やツール一覧を送っても、接続確認の保存を行わない。[AM保存設計§2.5](../access-management/02_Management_State_and_API.md#25-初回限定接続の具体契約)にある旧方式の保存契約は、切替前の検証と内部実装の撤去対象として区別する。

初回State／Sequenceと失敗分岐は[Access Management詳細](../access-management/01_Architecture.md#41-初回host設定のstateとsequence)が所有する。MCPは初期化Toolの一覧・Schema・登録・dispatchを全て持たず、初期化状態照会・元試行Identity・初期SecretのWorkbench搬送も公開しない。通常CROS認証、非鍵管理の9 Role分担行、同じHTTP入口の接続はこの例外を作らない。

MCP起動・`--shared`・設定File存在・Remote要求は初回設定の明示開始やHost Authorityではない。未初期化・破損・観測不能では既存起動契約に従い停止し、自動Bootstrap、別Root、新資格、単体fallbackを生成しない。未認証／非許可Clientへ管理ユーザーや試行の存在を結果・エラー・件数等で開示しない。独立したWorkbenchにも初期化操作・初回秘密提示を追加せず、Hostの操作はローカル対話入口で扱う。

旧非公開候補の限定Passは当時の固定版の履歴。最小鍵提示方式の限定レビューと、当時の専用Handler／AMによる初回確認の試験は、現行の共有OAuthの成立証拠に用いない。現行MCPには初回設定・状態照会・鍵操作のツールを登録しない。

## 4. Authorityと情報境界

### AI設定管理の非公開境界

`createAccessMcpResolver(root)`は現在認証・Repository認可と内容操作だけを接続する。AI設定の保存Ownerや管理操作を受け取らず、Tool定義・一覧・dispatch・専用公開APIを持たない。旧四Toolがmanager／administratorでも不在であること、呼出しが既存の未知Tool拒否へ閉じることを確認する。Credential・Role管理、Context・Topic／Meeting、Workspace、Objectiveの既存能力と要求ごとの現在認可を維持する。過去のProfile管理実測は旧方式の履歴であり、新方式の完成根拠にしない。

MCP Client、Session、connection、tool名またはmetadataからProject Authority、人間判断Authority、Repository操作権限、Recovery Authorityまたは成功を生成しない。認証・認可の結果は構成Rootから明示入力され、Adapterは対象Project、主体および要求へ結合したままCoordinatorへ渡す。

Raw Provider出力、Credential、Capability、内部Path、Host Path、内部Task logまたは実行知の非公開EventをMCP結果へ追加しない。公開結果は許可された主体と情報分類に対して必要最小限とする。

## 5. Transport lifecycle

Transportは要求受理、Application呼出し、結果生成、response書込み、切断、取消要求、Application側取消完了および資源回収を区別する。

```text
request bytes received
  → MCP envelope validated
  → public request constructed
  → application accepted or rejected
  → public result obtained
  → MCP result encoded
  → response write completed or unknown
  → transport resources settled
```

connection切断やstdio EOFをTask終了とみなさない。取消を要求した場合も、CoordinatorのTask管理が対象Taskと資源のsettlementを返すまで取消完了と表示しない。response書込み不明時は同じrequest identityによる再取得へ接続し、新しいObjectiveを発行しない。

<a id="51-localhost-streamable-http"></a>

### 5.1 共有のStreamable HTTP

HTTP Transportは一つの`/mcp` endpointでPOSTを受け、対応版を公式SDKで判定する。旧版のGET streamとTransport Session IDは持たない。

サーバー情報は開発版 `0.22.0-development` をHTTPとstdioで共用する。既存クライアントが送る有効な旧ログ水準と、通常要求の標準進捗項目 `progressToken` は受け流す。後者は文字列または有限の数値だけを認め、認可や業務処理、応答には使わない。stdioの取消通知の許可項目と要求ID・版の照合は維持する。ログ通知・進捗通知は追加しない。

公式SDKの `McpServer` に要求ごとにToolを登録する。discoverは一覧変更通知を提供しないことを `listChanged: false` で明示する。一覧とdiscoverのキャッシュ指定は `ttlMs: 0`、`cacheScope: private` を維持する。認証・入力の包絡・未登録Toolの拒否は通信段階で行う。共有HTTPで未登録Toolを呼ぶとHTTP 200内の `-32602` を返す。Tool引数や実行の失敗は `isError: true` と固定文言で返す。入口の取消はProtocolエラー、Tool実行中に応答可能な取消は固定文言のTool失敗とし、接続切断時は応答を送らない。取消後も開始済み処理を待ち、回復結果と片付けの観測を欠落させない。

- listenerは`127.0.0.1`だけへbindし、`0.0.0.0`、LAN AddressまたはInternetへfallbackしない。
- `--shared` の待受にだけMCP HTTPとOAuthの案内を接続する。単体起動のHTTPはWorkbenchとHTTP APIを提供するが、MCPを提供しない。単体MCPは `--mcp-stdio` で利用し、HTTP用の固定トークンは使用しない。
- `Origin`がない非ブラウザークライアントを許可し、ある場合は構成上許可したOriginとの完全一致を要求する。Originは本人確認の代用にしない。
- 対応するプロトコル版、および `MCP-Protocol-Version`、`Mcp-Method`、`tools/call` の `Mcp-Name` の必須・一致判定はSDKが行う。CRDDのHTTP受付では、Tool呼出し以外に付いた `Mcp-Name` を確認する。不一致や不正な能力情報の応答には入力値も検査詳細も含めない。
- `application/json`のfatal UTF-8かつ128 KiB以下の単一JSON-RPC文書だけを受理し、ClientはJSONとSSEの双方をAcceptに示す。
- 応答の切断は当該要求だけを取り消す。最初のTaskを認可済みの共有Objectiveは受付から独立して継続する。Server終了はHTTPとMCPの共通起動処理が所有し、新規受付を止め、処理中の要求と監督中の実行を取り消し、その終了を待つ。CLIは重複する終了イベントを別の終了操作へ展開しない。合成イベントの試験は、OSやコンソールからの実際の通知配送を証明しない。
- HTTP接続、Bearer tokenおよびheaderはTransport認証・相関情報であり、Project AuthorityまたはRecovery Authorityではない。

<a id="52-remote-cros-project-context-mcp"></a>

### 5.2 共有MCPの認証・認可

共有MCPは、単体stdioと同じ機能の正式APIへ接続するが、通信の認証と対象の認可を別途行う。

- 共有MCPはCRDD Serverの認可サーバーを案内し、`/mcp` 宛ての有効なOAuthアクセストークンだけを受け付ける。ログイン用のCookieや旧接続鍵は代用しない。受け付けられないトークンでは401を返す。
- 認可途中の操作と、本人の有効な同意がまだないセッションは、確立済みのセッション・同意・発行済みコードやトークンと別の枠に置く。途中の枠は256件までとし、期限切れを除いても満杯なら最古の途中状態だけを入れ替える。すでに読み取った途中状態でも、入れ替え後に書き戻さない。確立済み側は全体で2,048件、同じCRDD利用者につき64件、そのうち認可コードとアクセストークンを合計32件までとする。入替の対象は同じ利用者の古い発行記録だけとし、他の利用者の記録や確定した同意を追い出さない。入替を開始済み実行の停止理由にはしない。
- アクセス管理は現在の本人と連携登録を照合する。内容操作は、対象への本人のGitホストでの実効権限で決め、ロール別の内容範囲や公開範囲では判定しない。
- `tools/list` は現在許可された操作を表示し、`tools/call` は呼出し時の現在認可を別途確認する。MCPにはアクセス管理の書込みを公開しない。
- 共有配置でもListenerはloopback限定とする。許可された外部TLS終端からは`/mcp`へ直接配送する。CROS RESTの`/v1/...`と専用Shared Gatewayは設けない。統合CLIの`--shared`ではWorkbenchとMCPの公開Originを同値または双方省略とし、HTTPとMCPの資格受付は分ける。
- `mcp-server.json`のHTTPS公開Originと公開Host、TLS終端の確定Header、許可Originを検証する。TLS終端はClient由来のForwarded Headerを除去して上書きし、内部接続からの偽装を防ぐHost配置が確認できない場合は公開しない。認証後はAccess Managementが要求毎の現在認可を確認し、Local直接呼出しと同じ制約を用いる。鍵操作を除く公開能力だけを接続する。
- 非秘密設定は起動Repositoryの`.crdd/config/mcp-server.json`。現在の閉Schemaは任意の`publicOrigin`文字列だけで、空ObjectまたはFile不存在はlocalhost既定とする。`--shared`明示時だけ読み、Host設定や資格を含めない。例は[配布設定](../../../template/.crdd/config/mcp-server.example.json)。16KiBの独自容量拒否と固定Bufferを撤去し、開いたFileの観測sizeまで全量を読み取る。重複・余剰field、不正UTF-8、Directory／File link、取得時File Identity不一致、Descriptorのsize・mtime不一致、read／close異常は固定拒否にする。通常localhostとstdioは設定の存在で共有へ切り替えない。portは既存CLI引数が所有する。公開Originは案内URL、内部Listener URLは運用・試験の観測用として区別する。これは起動時Snapshotの検査で、取得後のPath／Directory不変を保証しない。HTTP／MCP受信量・Credential形式・許可Originは変更しない。配置Ownerが設定変更と再起動を管理する。
- Bearer TokenはRequest Headerからだけ受け取り、CLI引数、環境変数、共有設定、Repositoryまたはlogへ保存しない。公開証明書の管理はTLS終端の運用責務であり、MCP Transportは証明書Authorityを所有しない。
- 共有MCPはCRDD Serverと同じ待受で終了する。外部TLS終端自体はServerの終了対象ではない。`--mcp-stdio` ではMCPを標準入出力に切り替え、停止時は併設HTTPも終了する。

### ブロック状態遷移

| 現在状態 | 契機／事前条件 | 処理と観測 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| 未開始 | 単体stdioまたは共有OAuthの起動構成 | 入出力／待受を取得 | 待受中／拒否 | 拒否時はアプリケーション呼出し0 |
| 待受中 | 認証・protocol一致の要求 | decodeし公開契約へ一回搬送 | 実行中／要求拒否 | transport metadataをAuthorityへしない |
| 実行中 | 結果、切断、parent EOF、signal | encode、取消、進行要求join | 待受中／終了中 | 切断を成功へ補正しない |
| 終了中 | shutdown開始 | 新規受付を止め、要求・socket・listenerを閉じる | 終了／不明 | listener不存在、進行要求0、listener解除 |
| 不明 | close／joinを確認不能 | 閉じた失敗結果を返す | 終了待ち | Application成功やcleanup完了を主張しない |

Transport再接続は新しい接続Lifecycleであり、切断した要求のAuthorityや未確定結果を暗黙継承しない。stdio EOF、HTTP切断、Process signalを同じ通知名だけで同一のOS Evidenceにしない。

## 6. 正常・準正常・異常

Topic／Meeting Tool Callでは、公開スキーマ・意味上の入力拒否と未知の実行故障を、固定文言のTool失敗として区別する。ID書式、正整数Revision、limit 1〜100、states最大4は配送前に検査する。Query／Cursorの意味はDomainが所有し、読取りlistの既知3拒否理由だけを入力不正へ対応付ける。書込み操作で同じ理由の例外が出ても内部故障として扱う。例外本文・Path・秘密値を公開せず、内部エラーから未保存、rollback、Effect 0またはcleanup成立を主張しない。この義務は`QA-000005`／`CPR-IT-012`へ接続する。

昇格先CHGと、Outcomeの移管先Topic／CHGは固定ID書式を配送前に照合する。owner／none参照へID制約を足さない。create／updateのMarkdownはDomain公開Parserを純粋な入力検証として用いる。Parserの拒否は入力のTool失敗として返し、保存呼出し以降の例外は実行のTool失敗とする。正常結果・競合・対象不存在の操作結果は維持する。

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | 正しいMCP requestをstdioまたはlocalhost HTTPから受信 | CoordinatorのTask／Objective公開要求へ変換し、canonical結果をMCP responseへ投影する |
| 準正常 | 同じrequest identityを切断後に再送 | 新しいObjectiveを生成せず現在結果を返す |
| 準正常 | Coordinatorが判断待ちまたはRecovery要求を返す | 状態を保持して必要な次操作を返し、失敗または成功へ丸めない |
| 異常 | 未登録Tool、メソッド別 `params` の非対応項目、過大本文、不正な通信形式 | Coordinatorを呼び出さず通信段階で拒否する。通常要求の最上位と `_meta` の未知項目は拒否理由にしない |
| 異常 | 登録済みToolの不正な引数 | Coordinatorを呼び出さずTool失敗として返す |
| 異常 | MCPクライアントから管理書込みを要求する | 呼出し元のロールを問わず、公開していないToolとして拒否し、管理状態を変更しない |
| 異常 | 認証、Project BindingまたはAuthorityが不明 | Effect 0で拒否する |
| 異常 | connection切断またはresponse書込み不明 | Application結果を捏造せず、再取得可能なIdentityを保持する |
| 異常 | MCPとCoordinatorの結果Schemaが不一致 | 閉じた変換で拒否し、部分結果を公開しない |
| 異常 | HTTP認証、Originまたはmirror headerが不一致 | Applicationを呼ばずHTTP／Protocol errorで停止する |
| 異常 | Content-Length途中、slow body、idle keep-aliveまたはApplication実行中にServer終了 | 新規acceptを停止し、body reader、Application、handler、socketを回収してから終了を確認する。Node.jsが重複Signal eventを受領してもlistenerを先に解除せず、終了失敗を成功へ変えない。OS／ConsoleからのSignal配送は別の実行環境検証とする |

## 7. 検証と完成境界

単体試験はProtocolと変換、結合試験はstdio byte、UTF-8、framing、取消、切断、再送および結果投影、総合試験は実ProcessからCoordinator公開Applicationまでを確認する。Coordinatorの正常、判断待ち、Recovery、取消、Identity不一致および結果Schema変更を利用側回帰へ含める。

MCP packageの作成、stdio／HTTP起動またはtool一覧取得だけでは完成としない。認証済み主体からObjective、Decision、Project Stateの公開結果までの縦断、Authority非生成、切断時取消、資源回収、内部Path参照0、およびCoordinatorとMCPのSchema対応を確認する。HTTPはlocalhost限定、認証、Origin、mirror header、payload境界、Server終了時のApplication取消・join、Node.js Signal event受領後に終了確定までlistenerを保持する単一の公開Launcher配線、およびServer終了結果の観測が揃った場合だけ現行範囲を完成とする。実OS／Consoleから公開ProcessへのSignal配送と、その操作中のApplication終了は未評価として分離する。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `mcp.stdio-transport`<br>`mcp.localhost-http-transport` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | stdioとlocalhost HTTPを、同じTool、認証済みSession、構造化結果および取消契約を運ぶTransport契約へ揃える。 | TransportはDomain意味やAuthorityを作らず、framing、接続、切断と結果搬送だけを所有する。 | Transport追加によりTool挙動、情報公開、取消またはError語彙が変わる。 | `mcp.stdio-transport`<br>`mcp.localhost-http-transport` |
| Creation／Selection | Required | この観点を成立させる構造と責務が存在するため。 | Authority、入力または配置条件を満たした後にだけ具象・処理経路を選ぶ。 | 選択前の検証と選択後のIdentityを分け、未確認時はEffect 0とする。 | 選択条件の変更はTrust、Authorityまたは利用側契約へ波及する。 | `mcp.stdio-transport` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `mcp.stdio-transport` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `mcp.stdio-transport`<br>`mcp.localhost-http-transport` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `mcp.localhost-http-transport` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `mcp.localhost-http-transport` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000005、ARCH-000012、ARCH-000013、ARCH-000015のSource Definition | 同Traceability表の担当Detail ID（次行の鍵断面を除く） | Covered（既存対応。今回再評価せず、現在実装の証明ではない） | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |
| 同Traceability | ARCH-000013、UI-000008／SPEC-000012 | SCR-000008／BHV-000012の`PRT-000008.spec-000012`におけるMCP鍵操作非公開境界だけ | Partial | 非公開契約は§3.3。具体公開API・全Consumer・Quality・Source照合と新しい実境界検証は未完了。鍵意味・Host処理はAccess Management、通常表示はWorkbenchへ戻す |

担当Interaction Relation: `PRT-000004.spec-000002`、`PRT-000004.spec-000006`、`PRT-000004.spec-000007`、`PRT-000007.spec-000011`、`PRT-000008.spec-000012`、`PRT-000016.spec-000021`、`PRT-000016.spec-000026`、`PRT-000016.spec-000027`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

Checklist評価根拠: 既存の非鍵能力、二ModeのRepository指定とTransport設計を保持した。旧Credential Tool候補は撤回し、鍵断面は非公開境界だけをPartialで担当する。下のチェック済み項目は既存設計範囲の評価であり、新Owner接続・現在Source・Quality・実境界の完成を意味しない。既存QA-000001／004／007／009およびstdio ST-012／HTTP ST-013の過去判定を新境界へ流用しない。鍵非公開の新しい検証義務は本書の「Qualityへの引渡し」からQualityが具体化する。

最新固定8分担の限定独立レビューは当時の範囲だけに適用する。登録解除結果と鍵非公開境界の詳細伝播は候補反映・今回の契約・品質の限定独立レビュー済み・残指摘0である。旧観測・Checklistは当時の限定範囲を維持し、Quality・Source・本番接続・実境界の完成根拠へ流用しない。

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
