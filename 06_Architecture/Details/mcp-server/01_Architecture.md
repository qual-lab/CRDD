# MCP Transportアーキテクチャ

## Core実行依頼定義の直接接続 — 2026-10-28

`tools/runtime.ts`はDomainの一般定義CRUDだけへ直接接続する。`crdd.get_runtime_definition`（plan/objectives/tasks）と`crdd.manage_runtime_definition`（initialize、plan.save、objective.create/update/delete、task.create/update/delete）の二Toolを、要求別Factoryの`runtimeDefinition`構成から登録する。AM認証構成は既存development内容権限を`resolveRuntimeContentAccess`で要求内Contextへ変換する。入力は`repositoryId`と操作別の閉じた`command`であり、Root・主体・認可関数をClientから受け取らない。Plan等の意味・DAG・参照・CASはDomainが検査する。

応答はDomain結果を`structuredContent`と表示用textへ同じ内容で搬送する。unknown、競合、公開可能なexact回復参照を保持し、通信失敗を無保存又は再送許可に変換しない。AI実行・判断承認・Queue投入・文書同期は提供しない。Tool単体のCoordinator非読込と実Writer接続は、Server Root全体のCoordinator非読込成立とは別に確認する。既存任意Toolの読込み閉包が残る間はCore全体の成立を表示しない。

## Core API接続の目標 — 2026-10-27

[Domain API入出力](../domain-model/05_Runtime_Domain.md#runtime-domain-api)へ直接接続する。Coreの定義CRUD・QueryはCoordinatorをloadせず提供し、管理実行は明示導入時だけ既存実行Ownerへ接続する。現在認証・対象認可を検証済みRootと区別し、Host専用ContextをMCP入力から再構成しない。APIの内部型をそのまま通信Schemaへ露出せず、Sourceと通信契約の追従・独立起動試験は未実施。

## 公式SDK移行の実装境界 — 2026-10-20

### Coordinator統合後の通信名 — 2026-10-22

Task状態のTool名は`crdd.get_coordinator_state`、起動構成の依存keyは`coordinator`とする。旧Tool名は一覧・Call受付から除き、旧構成keyは値が未定義でも拒否する。互換aliasを追加しない。Adapterの説明契約は`crdd-mcp/coordinator-adapter/v4`とし、Objective要求は`plan`と`taskInputs`を必須とする。`projectModelOwnership`は調停側の`coordinator`を表す。Protocol版`2026-07-28`、認証・取消・終了の意味は変更しない。

MCP内部の診断reasonは`mcp_*`へ統一する。ただし、Coordinatorから返る保存契約・Task結果reasonは別の移行単位として維持する。旧通信名の撤去は、保存Schemaや保持中の回復参照を変更する根拠にはしない。

[移行対応表](../../../99_Roadmap/Changes/CHG-000082/mcp-server-sdk-structure.md)に従い、ProtocolとTransportを公式SDK v2へ移す。固定依存はServer `2.3.1`、Node HTTP接続`2.1.1`。AMのSource・公開API・保存・認証・ACLは変更しない。AM内部結果の投影検証はAM自身のUnit、MCPは型付き公開Outcomeの搬送を検査し、内部関数へPackage間deep importしない。

HTTPは公式SDKへ接続する。要求別の既存認証、byte／重複キー／Header一致検査、初回discoverの確認保存を公式entry前に維持し、同じ検査済みbodyをSDK Node接続へ渡す。SDKがJSON-RPCの受付・dispatch・応答生成を所有し、Tool callbackには既存のTool結果だけを返す。既存Handlerが返すProtocol errorはSDKの`ProtocolError`へ変換し、JSON-RPC応答全体をTool結果へ二重格納しない。初回保存成功後のSDK失敗・切断を未保存へ戻さず、自動再確認しない。

SDKとの境界再確認（2026-10-21）: Content-Typeの意味判定はSDK公開`isJsonContentType`を使用する。Bearer、Origin、TLS終端Headerのexact相関と重複拒否、生JSONの重複key拒否、fatal UTF-8とbyte上限、公開methodの閉集合、取消・join・no-storeはCRDD側が所有する。標準HeaderとAcceptの事前Gateは、現状の初回確認保存がSDK呼出し前にあるため維持する。同じ不正要求をSDKも拒否することだけを理由に事前Gateを除去しない。今回、初回保存の位置や認可契約は変更しない。

公開Server識別名は`crdd-mcp`とし、要求別SDK Server二経路と応答metadataで同じ内部定数を使う。Tool結果の`crdd-coordinator/...`等の既存契約namespace、Protocol版、Tool名、Release版の判断はこの識別名訂正へ含めない。

通常要求は要求ごとのHandlerと現在ACLを使い、Serverの再利用でPrincipalをcacheしない。SDKの標準Handlerを持つことだけでping、旧Initialize、通知等の公開範囲を拡張しない。stdioでも待機byte総量、逐次意味実行、EOF取消とjoinをSDK接続へ保持する。HTTP接続だけでstdio・Source全移管・旧Router撤去・Client互換の完了とは表示しない。

終了では従来の要求Controllerと未終了処理の集合を使い、SDK closeだけから下位Effect終了を推定しない。HTTP切断・Server終了は同じ要求の取消をTool callbackへ伝播し、既存Ownerの完了待ちとSDK資源回収を終えてから終了結果を返す。新しい永続状態、共有Lock、Registry、認証Frameworkは追加しない。

Tool定義と処理は`tools/access-management.ts`、`tools/project-context.ts`、`tools/topic-meeting.ts`、`tools/workspace.ts`、`tools/execution-status.ts`へ責務単位で配置する。同じToolのSchemaと搬送をprotocol／adapterの二Fileに分けず、認可・保存の実処理は各専門Packageへ残す。要求認証の接続は`request/authentication.ts`、終了編成は`transport/shutdown.ts`が所有する。TaskのToolとSchemaは`tools/task.ts`へ同居させ、共通の閉入力検査は内部`request/validation.ts`へ分離する。stdioは既存の有界Queueを入口Adapterとして維持し、SDK内部Streamへ検査済み要求だけを搬送する。意味実行の逐次性、待機総量、EOF後の取消結果搬送、出力callback完了とOwner joinをSDK closeと区別して検証する。

本番の共通境界は`createMcpServerFactory`が返す要求別SDK Server生成とする。HTTP要求とstdioの一要求ごとの内部SDK接続へ、検査済みの元入力・現在取消・開始したOwner Promiseの観測先を結合する。一要求で作ったServerや認可結果を後続要求へ再利用しない。Tool定義とOwnerの対応を要求内の固定構成としてSDKへ登録し、旧`routeMcpRequest`を本番入口に残さない。標準McpServerのTool errorへの変換は既存Protocol errorと異なるため、公式の低水準Server登録を使い、入力拒否と業務上の`isError`を区別する。CRDD固有の閉入力・重複キー・getter拒否は内部`request/validation.ts`等へ残すが、汎用Protocol補助をPackage Rootから公開しない。直接試験も同じFactoryを公式SDK接続で呼び、試験専用の別dispatchを作らない。

Workspace再編のMachine入口は[横断契約](../coordinator/05_Workspace.md)へ接続する。`crdd.get_workspace`は一覧・状態・現在file・固定差分、`crdd.manage_workspace`は作成・選択・改名・保持・固定・別採用・終了を扱う。入力はRepository IDと操作別の閉じたcommandで、Root・認可関数・参照解放の自己申告を受けない。通常Launcherは固定RepositoryのManifest、共有HTTPは要求毎のAM現在development許可から同じCoordinatorのTask／Objective公開Ownerを解決する。内容領域のworkspaceIdsをGit Workspace UUIDへ流用せず、鍵操作非公開・Repository登録Workbench限定の既存境界を変更しない。通常Objectiveには任意の`workspaceId`を搬送できるが、既存Queueの同Project所属・ready・保持なしを実Writerが再確認し、不明時にDirectへfallbackしない。公開接続の実装・検証中であり、実Provider全体の完成主張ではない。

Topic／Meetingの横断Relationでは、構成が認可済み同Project集合を選び、Domainの`federateTopicMeetingRelations`へRepository ID・Project ID・既存操作だけを渡す。MCPは所有者の0／1／複数判定を再実装せず、認可とProtocolを所有する。AM本番Resolver・公開Launcherは接続済み、旧CROS／REST／Shared Hostは撤去済みである。正式品質評価と後続E2Eの完成は別に確認する。

### SDK移行後の公開入口と互換範囲

| 用途 | 公開API・起動入口 | 結果・境界 |
|---|---|---|
| Tool構成 | `createMcpServerFactory`、`McpServerDependencies`、`McpServerFactory` | 要求ごとのSDK Server。現在認可と元入力を後続要求へ共有しない |
| 現在認証 | `createAccessMcpResolver` | 現在の資格から要求別Factoryまたは非開示null。旧来の関数として直接呼ばない |
| stdio | `runMcpStdio`、限定用途の`runMcpCoordinatorStdio` | 有界逐次実行・EOF取消・Owner join・意味cleanup結果。外部Streamを破棄しない |
| HTTP | `startMcpStreamableHttp`、`startMcpAuthenticatedStreamableHttp`、限定用途の`startMcpCoordinatorStreamableHttp` | 待受情報と`close()`。Origin・認証・切断取消・Owner join |
| 構成・終了 | `readMcpServerConfiguration`、`closeMcpHttpOnProcessSignal` | 既存の閉設定とSignal終了編成 |
| Tool契約 | 各`tools/*.ts`の明示公開定義・処理・結果検査 | 専門Ownerの既存入力・結果を維持。汎用Protocol補助は内部のみ |
| 配布コマンド | `crdd-mcp-server --stdio`、`--http --port <port>`、`--cros --http --port <port>` | 既存利用形態を維持。CROS stdioは未採用のため拒否 |

`routeMcpRequest`と`McpRequestRoutingDependencies`は撤去し、互換Routerを残さない。旧`orchestrator/adapter.ts`と`orchestrator/protocol.ts`も撤去する。Task／Objective固有Schemaは`tools/task.ts`、CRDDの閉入力・結果包絡は内部`request/validation.ts`へ分離する。Raw JSONの重複キー解析とgetterを呼ばない所有Snapshotは必要な入力境界として維持する。

公式Client `2.3.1`は試験用の開発依存だけに固定する。対応対象はProtocol `2026-07-28`を明示したmodern Clientであり、既定legacy Initializeや購読・汎用pingの互換を新設しない。stdioの取消通知は現在のIDだけへ結合し、不明・完了済みIDを次要求へ流用しない。Owner終了、SDK応答生成、外部出力callback、内部資源回収を分けて確認する。

成果物種別: Architecture詳細設計
詳細設計領域: mcp-server
状態: Candidate

CHG-000082の責務再編では実装親Folderを`mcp-server`とする。MCPはAI専用ではなくMachine向け公開境界である。WorkbenchとMCPは対等な独立入口であり、WorkbenchはLocal／共有配置とも同Hostの専門Package APIへ直接接続し、MCP Clientにはならない。Portfolio、Runtime Activity、Topic／Meetingの既存能力は実Ownerの公開契約へ接続する。現在認証・認可と接続解決はAccess Management、認可済みContextの意味解析・集約はDomain Modelが所有する。鍵管理とRepository登録はMCPの公開能力に含めない。現行Source・試験の成立範囲と正式評価は区別する。

## 基本設計との関係

### 公開起動入口の利用形態 — 2026-10-13

配布入口は通常Repository固定の`--stdio`／`--http --port <port>`と、CROSの`--cros --http --port <port>`を区別する。通常HTTPの固定`CRDD_MCP_HTTP_BEARER_TOKEN`はloopback Transport保護であり、AM User／Roleを意味しない。CROS HTTPでは固定Token入力を拒否し、既存Host配置から管理Rootを作成せず検証し、管理状態の未設定・不明を起動前拒否する。各要求のBearerは既存`createAccessMcpResolver`が再評価する。AI設定管理と鍵操作はMCPへ公開せず、Host Catalogを起動依存にしない。Workbenchの新設定接続は後続で確認する。

CROS stdioは資格搬送の採用契約がないため開始前拒否する。初回途中は既存限定Handlerだけ、通常接続は初回完了後の現在認証・認可だけを使用する。Root不明から通常Repositoryへfallbackしない。終了は既存HTTP取消・join・Listener清掃へ接続し、保存済みEffectを取消で巻き戻さない。

Source切替と局所公開Process試験では、初回限定→通常接続、administrator本人、同鍵失効後拒否、managerの旧四Tool拒否、不正mode・未設定／破損管理状態の拒否を評価済みである。公開STは既存IT断面を入力に用いるが、STからIT Local Itemへ直接Traceせず、正式ST／IT結果へ未昇格とする。旧REST／Shared Host撤去とWorkbench直接接続は実施済み。実Hostの初回設定・鍵実入口・利用者理解は後続E2Eへ保持し、局所結果からMCP全体完成を表示しない。

### Topic／Meetingの現在認可前の入力境界 — 2026-10-12

Routed Adapterは明示Repository IDを分離し、共通Adapterへ要求専用の遅延Resolverを渡す。各操作の完全な純粋Schema検査→取消確認→Resolver一回→取消再確認→Domain操作の順を固定する。Resolverの同期観測中に取消された場合も保存へ進まない。不正入力・開始前取消はResolver 0回、対象拒否nullは既存Invalid params、解決例外は秘密を含まないInternal errorへ閉じる。直接TopicMeetingAccessを渡す既存入口の正常CRUD・改訂競合・保存故障分類は維持する。

これはAM接続の事前条件の是正である。manifest Project拘束とDomain Relation移管を利用した実HTTP接続は下記構成へ接続済みで、公開Launcher・Workbench直接接続と旧REST撤去を実施した。正式評価と後続E2Eは別Gateとして維持する。保存開始後の取消からrollback・Effect 0を推定しない。

取消結果の分類は既存Adapterを維持する。開始前は`-32800`で対象Reader 0回、同期Reader開始後のSignal検出は当該Reader終了後に`-32603 Project Context unavailable`へ閉じ、結果を公開せず後続Reader・暗黙再実行0とする。EST-IT-014への今回の接続は開始前取消の部分範囲だけであり、全取消義務の完成ではない。

### 現在認可による内容操作の新Owner接続 — 2026-10-12

`createAccessMcpResolver`（`request/authentication.ts`）は既存HTTP Transportへ渡す要求専用の構成入口である。Headerの通常認証は初回completedと現在資格を要求し、本文待機後のTool CallではAMの現在許可集合を再取得する。2026-10-14承認済みの切替では、Domain ReaderのProject・Repository・読取り状態・本文版・解析Contextの5項目をPortfolioへ渡す。文書未確認・競合は非complete Sourceとして本文・Role・版をnullにし、読めたSourceと併記する。認証済み空集合だけ正常空結果、認可集合不明・Root不成立・取消・公開前集合差は全体エラーとする。全Reader→集約→fresh AM集合→AM所有`sameAccessCollection`→Signal再確認→返却の順で公開し、新しい認可・保存Frameworkを作らない。切替の局所試験・全回帰・独立確認は別Gateで評価する。

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
| External Boundary | PASS | stdio byte、localhost HTTP、Origin、認証を独立境界として扱う。 | [正本節](#51-localhost-streamable-http) |
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

利用者向け起動入口は`template/tools/crdd-mcp-server.ts`を維持し、本体の起動へ配送する薄い入口とする。構成RootはMCP Server自身が所有し、Coordinator、Domain Model、Access Management等の実Ownerの公開APIだけから必要能力を構成する。Coordinator内部、Provider、Nativeや署名秘密を直接構成せず、Coordinator CLIもMCPをsubcommandとして所有しない。

## 2. Package境界

```text
40_Develop/mcp-server/
├ package.json
├ src/
│  ├ index.ts
│  ├ types.ts
│  ├ protocol/
│  ├ adapters/
│  ├ composition/
│  ├ boundary/
│  └ transports/
└ tests/
   ├ unit/
   ├ integration/
   ├ system/
   ├ fixtures/
   └ support/
```

- `protocol`はMCP version、閉じたJSON-RPC Envelope／ID／metadata、method／tool名、Protocol response／errorおよび完全な単一JSON文書の判定を所有する。JSON-RPC error envelopeの構成もProtocolだけが所有し、stdio／HTTP Transportは同じ公開constructorを使用して独自のerror objectを再定義しない。Coordinatorへ依存しない。
- `adapters`はMCP入力をCoordinatorのTask／Objective公開要求へ変換し、公開結果をMCP結果へ投影する。Project Context参照では固定Markdownの意味契約を利用し、MCP固有の状態要約を正本化しない。
- `transports`はstdio、localhost HTTP等のbyte framing、fatal UTF-8、容量、header、socketおよびSession lifecycleを所有する。
- `src/index.ts`を唯一の公開入口とし、利用側は内部Pathを参照しない。
- `composition`はServerの構成・起動を所有する。旧Shared ServerのREST／Gateway構成は撤去し、認可済み内部能力の接続だけを保持する。`boundary`は閉じた入力snapshotを所有し、`internal`という雑多な置場を作らない。src配下のFolderは二階層以内とする。
- `template/tools/crdd-mcp-server.ts`は配布用の薄い起動入口であり、本体構成や意味処理を再定義しない。

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

`src/index.ts`が利用側への公開窓口となる。Transportは`McpRequestHandler`だけへ依存し、Task／ObjectiveまたはProject Contextの意味処理を直接所有しない。Coordinator、Domain ModelのContext Reader／Portfolio集約およびAccess Managementとの具体的な組合せはLauncher／Server Composition Rootが所有し、MCP内部にProvider実行・Repository書込み・Workspace Grant判定のブロックを置かない。

MCPの実行操作は単一CoordinatorのTask／Objective公開API、Repository成果物操作と認可済みContext集約はDomain Model、要求毎の認証・認可と接続解決はAccess Managementの公開入口へ依存する。CoordinatorのPackage Rootは利用できるが、Execution等の内部Path、Provider、Candidate Store、Windows Adapter、実行知Storeを直接importしない。Topic／Meetingの本文CRUDはDomain Model、許可済みRepository Bindingの解決はAccess Management、MCP wire変換は本Serverが所有し、同じ処理をTransport別に複製しない。

CoordinatorのTask状態、Identity、Recovery、判断または結果fieldをMCP Schemaで独立再定義しない。MCP固有Envelopeは保持するが、そのpayloadはCoordinatorのcanonicalな公開契約を一つの変換規則で投影する。公開契約変更時はMCP利用側試験を変更影響型runnerが必ず選択する。

Project Contextを返す場合も同じ原則を適用する。`crdd.list_projects`は現在の接続から参照できるProject ID、統合状態および許可済みSource数だけを返し、`crdd.get_project_context`は指定ProjectのSource Coverageと各Repositoryが投影した五場面を返す。MCPは現在地、Risk・停止要因、人間の判断待ち、理由・根拠および次の一手を搬送するが、Repository内正本、共有分析および対話時の追加推論を混同しない。Repository Role外のContextを補完せず、項目別`Observed At`、Project Context固有IDまたはLive環境状態をMCPだけの都合で追加しない。

Repository単体では、現在の検証済みRepository Rootにある`PROJECT_CONTEXT.md`を毎Requestで読み取り、一SourceのPortfolio Projectionへ変換する。この経路にCROS Credentialを要求しない。CROS利用時は、Access Managementが現在認可したRepository集合をDomain Modelが集約したPortfolio Projectionを同じAdapterへ渡す。MCPは両経路のAuthorityを統合・拡張せず、入力Projectionに存在しないProjectを同じ`project_context_not_available`へ閉じる。

Remote CROSではMCP専用の固定Bearerを別に発行しない。HTTP TransportはBearer文字列をRequest単位のHandler Resolverへ渡し、Server Composition RootがAccess Managementへ現在Credentialの検証を委譲する。Credentialに紐付く既存userId、現在Role詳細権限、Exposure、Bindingと実アクセスを整合した改訂で別評価し、許可済みRepository集合だけをDomain Modelへ渡す。DomainはCredential／Role／Grantを解釈せずPortfolioを集約し、その要求専用Handlerへ固定する。旧Credential固定Profile／`systemAdmin`、管理可否または前要求のPortfolioから内容参照権限を再構成しない。

通常Handlerの発行にはAMの`authenticateNormalConnection`を用い、有効資格と初回設定`completed`を同じ管理改訂で確認する。初回途中にも利用する`authenticateCredential`だけでは通常接続を許可しない。HTTP本文待機後の内容操作は`resolveRepositoryAccessCollection`で現在認可を再評価し、直ちにDomain固定本文Readerへ渡す。本文取得が一件でも不成立なら固定エラーで全体を停止し、部分Portfolio・`null/missing`へ変換しない。初回完了を確認した認証済み許可対象0件だけを正常な空Portfolioとする。

本段落は公開入口切替前の局所確認履歴である。現在の公開入口接続と旧MCP Resolver／Shared Host撤去は§3を参照する。この接続は`createAccessMcpResolver`の実HTTP搬送契約で段階確認する。現在はContext二操作、Topic／Meeting十二操作と活動一操作に、Catalog構成時のProfile四操作を加えた局所候補であり、現在Role／Exposure／失効、固定拒否、manifest Project拘束と同Project Relationへ接続する。先行段階のContext専用・十四Tool・活動を含む十五Tool構成と、現在の条件付き十五／十九Tool候補を区別する。Catalog依存を構成した局所候補ではmanager／administratorが19 Tool、developerが15 Tool、Catalog未構成時は15 Toolとする。旧Resolver／Shared Hostは公開Launcher／Workbenchを含む全能力の本番代替が成立するまで撤去せず、新旧認証のfallback合成は行わない。鍵は非公開、Profileは現在AM認可と実HTTPの局所候補に接続済み。本番Launcher／Workbenchへの切替は未完了。Root能力・Token・内部Path・管理改訂を公開結果へ追加せず、同期Reader開始後の取消をI/O中断やEffect 0と表示しない。要求前の取消は内容読取りを開始せず、開始後は同期処理の終了を待って結果公開を停止する。本段落は本番切替済み・AM全体完成の表示ではない。

Coordinatorの実行状態を返すToolは`crdd.get_coordinator_state`とする。旧名`crdd.get_project_state`はProject全体のCurrent Projectionと誤認し得るため、v0.22の公開候補へ残さない。Project Contextは`crdd.list_projects`と`crdd.get_project_context`で取得し、Runtime DTOを再利用しない。

Repository単体MCPでは、Topic／Meetingの一覧、取得、登録、編集、削除およびMeeting Outcome処置ToolをProject Operationの共通Application契約へ接続する。一覧は同契約の検索、状態、Owner、期間、Relation、未処置Outcome、並び順およびID Cursor Paginationをそのまま搬送する。削除は誤登録理由、期待Revision、Relation影響0件および明示確認をすべて満たす場合だけEffectを発行する。Outcome処置は完了・移管・昇格・理由付き不採用を区別し、全件処置済みの場合だけ同じCommandでMeetingを閉じられる。

単体／CROSの両Modeで、Repositoryを対象にするToolは同じ`repositoryId`必須入力を用いる。単体では起動時に検証したRepository Rootと自身のIDへ固定し、別IDを拒否する。Server Composition RootはAccess Managementの現在認証・認可、Exposure／Repository改訂とBindingの検証結果を用い、許可済みRepositoryのDomain公開操作だけを返す。Adapterは検証済み`repositoryId`を配送情報として処置してから共通処理を一回呼ぶ。IDを省略した暗黙選択、別RepositoryへのFallback、IDからの読取りAuthority生成を行わない。現在許可範囲外、固定Root不一致、改訂不一致またはBinding不在は、対象の存在・Role・Workspaceを開示しない同じ`Invalid params`へ閉じる。

### 単体／CROSの明示選択とRepository一覧

AI設定の管理はWorkbenchから対象Repositoryの専門APIへ直接接続し、MCPへ設定CRUDを公開しない。旧Profileの一覧・登録・更新・削除四Tool、専用Adapter、Root公開API、Host Catalog注入と管理認可resolverを撤去する。すべてのRoleで旧Toolは一覧に存在せず、呼出しは未知Toolとして拒否する。MCPの起動は旧Catalogの有無に依存せず、Host初期化・現在認証・Repository認可の既存条件は維持する。新しい設定Tool、互換handler又はHost設定正本を作らない。Workbenchへの新設定接続と旧Profile Store全面撤去は別の単位で確認する。

人間が2026-10-07に確認した利用モデルでは、`--cros`なしは起動Repository一つ、`--cros`ありはCROSの登録・公開・Credentialで許可したRepositoryを扱う。設定Fileの存在や初期化済み状態からModeを自動切替しない。CROS設定不正時に単体へ戻さず、単体起動で兄弟Repositoryを探索しない。

| 操作・状態 | 単体Mode | CROS Mode |
|---|---|---|
| `crdd.list_repositories` | 入力は空Object。検証済みRootの自身のrepositoryId、projectId、repositoryRoleを一件だけ返す。CROS登録は不要。 | 入力は空Object。Access Managementが現在認可したRepositoryの同じ形の一覧だけを返す。管理者だから全件を返す扱いにはしない。 |
| Repository指定Tool | `repositoryId`は必須で、上記一件のIDだけを受理する。 | 同じ入力形式で、Request時に現在許可されたIDだけを受理する。 |
| Project一覧／連合Context | Repository指定を必要としない一覧・連合ToolへrepositoryIdを機械的に追加しない。一SourceのProjectを返す。 | Project IDとSource Coverageの意味を維持する。Project IDをRepository IDの代替にしない。 |
| Root／ID不明 | 起動Rootと正本Identityを確認できなければ開始しない。空の成功一覧にしない。 | 設定・Binding・Credentialの不正を停止／拒否し、起動用CRDDリポを自動公開しない。 |

`crdd.list_repositories`はProject一覧とは異なる対象選択の入口であり、新しい安定IDを採番せずRepository自身のIDを返す。Host Path、Registry内部ID、Credential、非許可Repositoryの存在・件数を返さない。Repository固定のObjective受付、判断、Runtime状態・Topic／Meeting操作はこの共通対象指定を利用し、配送後のpayloadはCoordinator／Domain Modelの公開契約を用いる。CROS管理操作とProject連合の取得へ不要なRepository指定を追加しない。

CROSの初期管理CredentialはCROS構築時のHost対話操作で明示発行し、MCPを起動したことだけで発行しない。CROS HTTP入口はRegistry未初期化時に開始しない。単体stdioはCROS Credential不要、単体localhost HTTPは既存Transport Tokenを必要とする。CROSのBearerはHTTP認証Headerで受け、Tool引数にTokenを追加しない。今回CROS構成はHTTP入口へ限定し、`--cros --stdio`の未設計認証を暗黙提供しない。

Remote CROSのTopic／Meeting取得結果は、本文に記録された安定ID Relationを同じLogical Projectの許可済みRepository集合で解決する。一意な対象だけにOwner Repository IDを付け、0件は`unavailable`、複数件は`conflicting`として返す。MCPはRelation先本文をSource Repositoryへ複製せず、Relation結果を別Repository書込みのAuthorityとして扱わない。

### 3.1. CROS能力を搬送する閉じた操作契約

以下はMCPの公開能力契約である。Tool名はProtocol正本で定義し、一覧・Routing・入力／結果検査・Machine Clientと契約試験を同じ改訂へ接続する。Workbenchの直接APIとは利用側を分離し、任意commandを受ける汎用Toolへまとめない。

| 操作 | 設計候補の入力 | 構造化結果とOwner | 認可・反例 |
|---|---|---|---|
| `crdd.get_execution_status` | 必須`projectId`、任意`cursor`、任意`limit`（既定20、1〜50の整数）。未知fieldを拒否する。 | 既存Activity公開契約（Owner移管・本番接続は未完了）。現在状態`observed / absent / unknown`、理由、projection、独立したeventState／eventReason、events、eventContinuation。 | 現在認可済みRepositoryだけを活動OwnerのReaderへ渡す。Eventが観測不能の場合は空の成功へ変えない。 |

設定の読取り・保存・同時更新検査はRepository別AI設定のOwnerが担う。MCPは新規ObjectiveのworkType／choiceを既存Coordinatorへ搬送するだけで、設定を暗黙更新しない。開始済み実行の固定選定を現在設定から補完・差替えない。

Project一覧・Context取得とTopic／Meetingの既存Tool名・安定IDは維持する。Hostの指定ユーザー／全員鍵交換をRemote Toolにしない。新しい管理操作を一部登録しただけでCROS管理Surface全体を完成としない。

活動接続では、`tools/execution-status.ts`が`crdd.get_execution_status`のSchema・入力搬送を所有し、活動結果の意味・検査は[Coordinatorの認可済み活動読取り](../coordinator/03_Task_Architecture.md#73-認可済みrepositoryの活動読取り--新owner接続候補)へ委譲する。`request/server.ts`は実Readerを接続した場合だけ一覧とCallへ同時登録する。Access Managementの現在認可集合を今回要求のRoot・Project・Repositoryへ射影して渡し、資格・Role・AM Bindingを活動Ownerへ渡さない。実Storeと複数Repository合成が未確認の注入Readerだけでは公開Toolを完成としない。旧`readCrosRuntimeActivity`は歴史的な移管比較対象で、現行Ownerではない。Readerに取消APIを捏造せず、開始前取消は呼出し零回、開始後取消はReader完了をjoinしてから取消結果を返す。公開Launcherは接続済み、AI設定管理はMCP非公開、Workbenchは独立した直接経路を利用し、旧RESTは撤去済みである。正式評価と後続E2Eから全体完成を判定する。

### 3.2. Portfolioの一覧・詳細契約

完全Portfolio用の重複Toolを増やさず、既存`crdd.list_projects`をページ単位の許可済みProjectionへ補強する。新形式だけを本体へ接続し、旧Consumerの移行はフロントAI手順と利用側更新で扱う。現在の入力が空Object・結果がSummaryだけという実装を、完成済みの新契約とはみなさない。

| 契約 | 入力／結果 | 保持条件 |
|---|---|---|
| 一覧入力 | 任意`query`（既定空文字）、任意`state`（`complete / partial / conflicting`、未指定は全状態）、任意`cursor`、任意`limit`（既定20、1〜50）。未知fieldを拒否する。 | 既存Workbenchと同じProject IDの部分一致・状態絞込みを用いる。検索対象を無断で非許可Source本文へ広げない。 |
| 一覧結果 | `projects`の各行に既存projectId／state／sourceCountと、Domain Modelへ移管する既存`FederatedProjectSource`集合を保持する。`continuation`と`retainedAsSourceOfTruth: false`を返す。 | 一つの認可済みPortfolio snapshotから絞込み・安定並び順・ページ抽出を行う。結果はページであり全Project取得済みを意味しない。 |
| 詳細 | 既存`crdd.get_project_context`のprojectId入力と五場面・Source Coverageを維持する。 | 毎Requestで現在認可を再評価し、一覧時の許可集合を再利用しない。許可外・未検出は同じ非開示結果へ閉じる。 |
| Cursor | 正規化Query、状態、limit、最終Project IDおよび現在の認可／Exposure／Source revision集合の非秘密digestへ拘束する。 | 改ざん、不一致、対象消失、改訂変化は無効Cursorへ閉じ、空の成功または先頭からの暗黙再開にしない。Cursor自体は読取りAuthorityではない。 |

Sourceのcontext、repositoryRole、complete／missing／conflictingと現在revisionはDomain Modelの意味契約に従う。既存CROS型は移管比較入力で、具体公開型の移管は未完了である。非許可Sourceの欠落枠、存在または件数を補完しない。ページ間や一覧と詳細の改訂差は別の観測であり、Workbenchは同じ原子的snapshotと表示しない。Query変更・資格失効・Cursor拒否時は旧ページとSource選択をCurrentから外し、利用者の明示Refreshへ戻す。Source本文の容量不適合は切詰めた正常Contextにせず、既存の観測不能／失敗へ分類する。

### 3.3. 鍵管理のMCP非公開境界

最新判断の意味Ownerは[Access Management詳細](../access-management/01_Architecture.md#7-配置秘密観測境界)と[ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md)である。MCPの要求認証にCredentialを使用することと、鍵を管理する操作を公開することは別である。鍵操作はSecretの有無にかかわらずMCPへ公開しない。旧案の資格一覧・資格への個別Grant変更・独立失効Tool候補は撤回し、互換Toolとして残さない。

| 境界 | 担当する処理 | 提供しない処理 |
|---|---|---|
| MCP要求認証 | Access Managementへ要求毎にCredential検証・現在認可を委譲する | MCP起動や認証成功による資格発行、鍵管理権限の生成 |
| MCP公開能力 | 認可済みの非鍵能力だけを搬送する | 鍵操作の`tools/list`掲載、Schema、登録、Call Routing／dispatch。非秘密一覧・独立失効も例外にしない |
| 通常鍵管理 | 同一Process Workbench BackendがAccess Managementへ直接委譲する。発行・独立失効・交換は現行administrator専用固定 | 別Process WorkbenchからMCPを経由した鍵操作、Role設定による鍵操作ON／OFF |
| Host回復 | 信頼したログイン済みローカル操作者の対話CLIから指定ユーザー／全員の交換2操作だけを委譲する。追加認証なし、既存Root／Path検証を維持 | 通常発行・独立失効、Remote Tool、専用資格・承認コード・OS管理者昇格 |

WorkbenchはMCP Clientではなく、同HostのAccess Managementへ直接接続する。通常の指定ユーザー交換だけ追加確認なし、Hostまたは全員交換の3組は明示確認を要求する。全4組の対象ID・表示名・失効範囲・既存発行先・保持情報の事前表示は各ローカル入口が担当し、MCPで代用しない。鍵の3分岐、結果・失敗・元発行Identityと交換Recovery・一度表示の意味はAccess Managementが所有し、MCPに鍵結果照会・鍵Recovery参照・交換State・秘密配送を追加しない。Bearer認証を続けることは鍵操作公開の例外ではない。

以下四段落は非鍵管理の公開接続前に固定した契約の履歴であり、当時の「未確定」「今回Source不変更」「公開接続・QA未実行」を現在状態へ流用しない。現在の公開API・Tool／Schema・dispatch・本番Consumer接続は§3.3.1に従う。

初回Host設定はAccess Managementの承認済み別開始契約であり、MCPへ公開しない。MCP起動やRemote CallからBootstrapしない。ユーザー管理、Role内容設定、Repository登録、Exposureの担当RoleはARCH-000013の9 Role分担行に従いAccess Managementへ委譲する。manager／administratorが許可される非鍵管理と、administrator専用のadministrator Role付与・解除・変更／内容設定を区別し、Role内容設定で管理権限をON／OFF・再委譲しない。具体公開API・Tool／Schema・登録・dispatch・本番Consumerは未確定で、担当Roleの採用から新Toolの公開や接続済みを推定しない。Profile管理等の既存非鍵能力の採否も変更しないが、旧`systemAdmin`等の実装語彙を新しいRole権限契約として採用しない。

非鍵管理の要求はAM詳細§4の操作別入力と変更前の現在固定管理認可へ結合する。登録は予定Role・表示名、既存Role変更は対象userId・前後Role、名前変更は対象userId・新表示名、Role内容設定は対象Role・内容、Repository管理は対象ID・現在登録／公開状態・変更内容を搬送する。managerはadministratorの名前だけ変更可でRole変更不可。managerの正常管理へadministrator存在を要求しない。管理拒否と自身表示・許可内容拒否を区別し、登録≠公開、解除≠データ削除、更新受理≠内容取得を保つ。内容取得は次要求の現行Role・Exposure・実アクセスを再評価する。

Repository登録解除の非鍵結果は、同じ受理済み操作・採用改訂による対象登録と対応Exposureの除去および両読戻しを区別して搬送する。両確認時だけ完了を投影し、片側残存・観測不能を完了にしない。対象外登録・Exposureと対象Repository本体・Product Dataを保持し、両除去の完了から開始済み操作の取消・過去Effect0・実資源終了を生成しない。解除後の内容要求は現在認可とExposure・実アクセスを再評価し、旧許可集合を再利用しない。

入力・現在認可・必要状態不明の拒否と、保存後の読戻し／応答不明を別結果として投影する。後者から未保存・rollback・Effect0や完了を生成せず、通常管理へ交換Recoveryを足さない。これらは公開能力の制約であり、今回SourceのTool集合やProtocolを変更しない。Qualityは既存AMの認可・可視性・通常管理の導出キーから、要求搬送と許可外情報／Effect0、固定分担、解除の両読戻し・保持範囲・取消非証明、結果軸の保持を具体化する。鍵は一覧・Schema・登録・dispatchと鍵Recovery参照0だけを負観測し、鍵処置をMCPの試験対象操作として新設しない。固定8分担・登録解除・通常鍵3分岐の前回伝播候補は契約・品質の限定独立レビュー済み・残指摘0で、公開接続・QA実行済みではない。

#### 3.3.1. 非鍵管理Toolの具体化候補

本人表示の別責務として、通常Resolverは`crdd.get_current_access`を提供する。空の閉入力でAM `readCurrentAccess`をfresh一回だけ呼び、通常三Roleすべてへ提供する。結果はcompleted／revision／user／contentAccess／permittedRepositories、拒否・不明はunavailableとAMの固定理由だけ。managementOperations、他User、資格、Root／Bindingは返さない。管理四read／六保存の認可とは混同しない。初回限定Handlerとserver/discoverは不変更。developerは18、manager／administratorは28。Workspace二操作を含む現在集合であり、旧16／26は追加前の局所履歴である。Repository登録はMCP非公開であり、登録用Toolを加算しない。旧25／29は本人Tool追加前の局所履歴である。

非鍵管理の閉結果投影はAM `management/result.ts`へ移し、MCP固有のenvelope・isError・固定説明・最終UTF-8 16 MiB上限だけを本Adapterへ残す。Workbench直接呼出しでも同じ投影を用い、意味変換を二重管理しない。出力上限超過のmanagement_response_too_largeはMCPが所有し、AM結果へ混ぜない。

状態: 非鍵管理の十操作はAM Resolverと公開Launcherへ接続済み。Repository登録はWorkbenchだけに採用済みであり、MCPのSource／Schema／一覧／dispatchに追加しない。この事項の現在判断待ちはない。Workbenchは専門APIへ直接接続する。正式評価と後続E2Eの未確認範囲は保持し、鍵とHost操作の非公開境界は不変更。

| Tool候補 | 操作固有入力 | 成功時の管理投影 |
|---|---|---|
| `crdd.list_access_users` | 空Object | revision、users（userId／username／role） |
| `crdd.list_role_content_access` | 空Object | revision、roles（role／workspaceIds） |
| `crdd.list_registered_repositories` | 空Object | revision、repositories（repositoryIdだけ） |
| `crdd.list_repository_exposure` | 空Object | revision、repositories（repositoryId／workspaceIds） |
| `crdd.register_user` | username、plannedRole | User登録結果 |
| `crdd.update_user_name` | userId、username | User変更結果 |
| `crdd.update_user_role` | userId、currentRole、nextRole | User変更結果 |
| `crdd.update_role_content_access` | targetRole、workspaceIds | Role内容変更結果（userIdはnull） |
| `crdd.unregister_repository` | repositoryId | 登録・対応公開範囲の解除結果 |
| `crdd.update_repository_exposure` | repositoryId、workspaceIds | 公開範囲変更結果 |

全入力Objectを閉じ、未知field、重複field、不正型を拒否する。六保存操作は共通して`operationId`（既存UUIDv4形式）と`expectedRevision`（1以上のsafe integer）を必須とする。usernameはstring構造だけを検査し、表示名の値制約は[AM保存設計](../access-management/02_Management_State_and_API.md)のCanonical検査へ委譲する。Roleはdeveloper／manager／administrator、workspaceIdsはdevelopment／managementの重複なし配列、User IDは既存UUID形式、Repository IDは既存AMの1〜128文字の識別子とする。空のworkspaceIdsは明示範囲0であり拒否しない。具体値の業務判定・対象存在・現在改訂はAMが所有する。MCP入力からBearer、管理状態Root、Binding、任意の操作名を受けない。

Tool一覧では要求時の現在通常認証に基づきmanager／administratorへ採用した管理Tool集合を表示し、developer、初回限定、管理Context未構成には管理操作を追加しない。本人一Toolだけは通常三Roleへ提供する。managerへ一覧表示してもadministratorを含むRole変更・登録・内容設定は許可されず、call時のAM判定を維持する。旧Local／stdioの固定依存へ自動追加しない。Context二操作、Topic／Meeting十二操作、活動一操作、Workspace二操作と本人一操作を合わせdeveloperは18、manager／administratorは非鍵管理十操作を加えて28となる。Repository登録はWorkbench限定であり、MCPの一覧・Schema・dispatchには存在しない。

四読取りは別々の現在改訂である。Role内容読取りはmanagerへadministrator行を補完せず、User読取りはmanagerによるadministrator名前管理の既存範囲を保持する。公開範囲のnull（設定なし）と空配列（明示範囲0）を区別する。内部DTOのkind・bindingId・Path・資格は公開しない。拒否・観測／清掃／解放不明を空一覧にしない。非鍵管理応答はJSON-RPC最終ObjectのUTF-8で16 MiB以下とし、超過は固定未取得として全体を拒否する。部分一覧、暗黙Paging、新Inventoryは作らず、他のToolへこの局所上限を一律適用しない。

公開結果は次の閉Unionとする。表にないfieldを追加せず、管理状態Root、登録Root、Binding、資格・秘密、例外本文、内部Recovery参照を返さない。JSON-RPC入力不正は既存`-32602`、開始前／終了後取消は既存`-32800`であり、以下のAM実行結果と混同しない。

| 結果 | exact fieldと値 |
|---|---|
| 管理読取り成功 | `status: completed`、`revision`（1以上のsafe integer）、上表Tool固有の`users`／`roles`／`repositories`配列だけ |
| 管理読取り拒否 | `status: unavailable`、`reason: management_read_rejected`だけ。AM認証／参照拒否を同じ結果へ閉じる |
| 管理読取り不明 | `status: unavailable`、`reason: management_read_unavailable`だけ。観測・材料清掃・Lock終了の不明を空一覧にしない |
| 応答上限超過 | `status: unavailable`、`reason: management_response_too_large`だけ。部分配列なし |
| 保存成功 | `status: completed`、`operationId`、`expectedRevision`、`revision`、操作別`userId`または`repositoryId`、`publication: confirmed`、`cleanupConfirmed: true`。Role内容保存のuserIdはnull |
| 保存拒否 | `status: rejected`、`reason: management_request_rejected`だけ。認可前・対象不明・改訂競合を区別開示しない |
| 認可後保存未完了 | `status: unavailable`、`reason: management_operation_unavailable`、`operationId`、`expectedRevision`、`observedRevision`（safe integerまたはnull）、`publication`（not_attempted／unconfirmed／confirmed）、`cleanupConfirmed`（boolean）、`primaryFailure`（下表の閉enum） |

`primaryFailure`はAMの実Resultにある同名fieldだけを次表へ写し、内部例外や自由文字列を透過しない。

| AMの固定理由 | 公開primaryFailure |
|---|---|
| `state_store_previous_pending_settled` | `previous_materials_settled` |
| `state_store_pending_failed` | `previous_materials_unavailable` |
| `state_store_capacity_exceeded` | `capacity_exceeded` |
| `state_store_identity_failed` | `identity_generation_failed` |
| `state_store_candidate_failed` | `candidate_invalid` |
| `state_store_repository_binding_failed` | `repository_validation_failed` |
| `state_store_prepare_failed` | `prepare_failed` |
| `state_store_publish_failed` | `publication_failed` |
| `state_store_read_back_failed` | `readback_failed` |
| `state_store_cleanup_failed` | `cleanup_failed` |
| `state_store_lock_unknown`、`filesystem_store_lock_operation_completed_cleanup_unknown` | `release_unknown` |
| その他・未知理由 | `storage_unavailable` |

先行材料の処置と新出版準備を同じ分類へ畳まない。出版成功後のLock終了不明はprimaryへ到達し得る。一方、既知の最初の失敗に付随する内部secondary理由をこの表から推定・新規公開しない。cleanupConfirmedは材料とLock終了の複合確認であり、falseだけから失敗箇所を推定しない。全分類で既知publicationと観測改訂を保持し、rollback・Effect 0・completedへ書き換えない。operationIdは相関であってReceiptや冪等再送保証ではない。

完全Schema検査→開始前signal確認→AM同期API最大一回→終了後signal確認→閉結果公開の順とする。開始前取消は管理API呼出し0。同期保存開始後は終了まで待ち、取消・応答喪失で既知出版を戻さず、成功応答の抑止と保存の取消を区別する。自動再送せず次要求で現在状態を読む。Bearerは既存HTTP Headerから当該要求closureへ結合し、本文・結果・ログへ転記しない。Repository登録はWorkbench限定の採用済み方針に従い、このMCP経路では登録Root候補を受け取らない。

実装の責務配置は`src/tools/access-management.ts`（十Toolの閉入力・現在通常認証・AM委譲・閉結果）、`request/server.ts`（一覧／SDK登録）と`request/authentication.ts`（Header資格の要求専用構成）とする。外部Consumerは既存Package Rootの`createAccessMcpResolver`と`createMcpServerFactory`を使い、新たなCapability barrelや管理Storeを追加しない。Repository登録を含めない採用済みTool集合の配置であり、正式評価・後続E2Eは未完了として保持する。

上記の閉結果Unionは、既存Tool応答方式と同じ`structuredContent`へ置く。`content`は秘密・入力・内部理由を複製しない固定説明だけ、`isError`は管理結果がcompleted以外ならtrueとする。外側のJSON-RPC／Protocol metadataは既存契約を保持し、16 MiBはその最終応答全体で検査する。Schema不正や取消等のProtocol errorを、管理結果のstructuredContentへ混在させない。

### 3.4. 初回Host設定の非公開境界

限定接続の具体Owner／Protocolは[AM保存設計§2.5](../access-management/02_Management_State_and_API.md#25-初回限定接続の具体契約)に従う。初回資格には通常Tool Handlerを渡さず、HTTPと既存Protocolの完全検査を通る`server/discover`だけを受ける。AMのfresh相関照合・確認保存・読戻し・短命清掃・Lock終了後だけ非秘密の成功応答を返し、通常Authorityは次要求で取り直す。初期化操作・状態照会・鍵操作の公開例外ではなく、Client応答受領保証でもない。Sourceと公開HTTPは接続済みである。実Hostからの初回縦断と利用者理解は後続E2Eへ保持し、模擬入力の成功を実Host成立にしない。

初回State／Sequenceと失敗分岐は[Access Management詳細](../access-management/01_Architecture.md#41-初回host設定のstateとsequence)が所有する。MCPは初期化Toolの一覧・Schema・登録・dispatchを全て持たず、初期化状態照会・元試行Identity・初期SecretのWorkbench搬送も公開しない。通常CROS認証、非鍵管理の9 Role分担行、同じHTTP入口の接続はこの例外を作らない。

MCP起動・`--cros`・設定File存在・Remote要求は初回設定の明示開始やHost Authorityではない。未初期化・破損・観測不能では既存起動契約に従い停止し、自動Bootstrap、別Root、新資格、単体fallbackを生成しない。未認証／非許可Clientへ管理ユーザーや試行の存在を結果・エラー・件数等で開示しない。独立したWorkbenchにも初期化操作・初回秘密提示を追加せず、Hostの操作はローカル対話入口で扱う。

旧非公開候補の限定Passは当時の固定版の履歴。今回の最小提示方式を受けた境界差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。初回限定接続の必要性から、通常MCP認証・内容Authority・鍵Tool・状態照会・Secret搬送の例外を生成しない。通常認証はcompletedを要求し、初回確認は専用の限定HandlerとAM Ownerへ分離して接続する。具体接続Owner・ProtocolはAM詳細で閉じる。Qualityは鍵4面・状態照会の不存在、起動／Remote入力から初期化Effect0、未確認保存・読戻し・清掃後の通常Authority0を確認する。Source／公開HTTPは接続済みで、実Host縦断・人間UAT・正式評価・最終Gateは未完了。

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

### 5.1 localhost Streamable HTTP

HTTP TransportはMCP `2026-07-28`へ固定し、一つの`/mcp` endpointでPOSTを受ける。旧版のGET streamとTransport Session IDは持たない。

- listenerは`127.0.0.1`だけへbindし、`0.0.0.0`、LAN AddressまたはInternetへfallbackしない。
- 32 byte以上の不透明Bearer tokenを起動時にHostから受け取り、未設定または不正なtokenでは起動しない。token値を結果、logまたはRepositoryへ保存しない。
- `Origin`がない非Browser Clientを許可し、Originがある場合は起動時のlocalhost allowlistとのexact一致だけを許可する。
- `MCP-Protocol-Version`、`Mcp-Method`および`tools/call`の`Mcp-Name`を本文の`_meta`、`method`、`params.name`と照合する。
- `application/json`のfatal UTF-8かつ128 KiB以下の単一JSON-RPC文書だけを受理し、ClientはJSONとSSEの双方をAcceptに示す。
- response切断は当該要求の取消であり、別要求またはProject全体の取消に拡張しない。Server終了はclosingへ一度だけ遷移し、`server.close()`で新規accept停止を開始してから、受信中body／request、Application、handler、残存socketの順に取消・回収し、Server終了と全Registryの空を確認した場合だけTransport cleanup完了を返す。公開LauncherがNode.jsの`SIGINT`／`SIGTERM` eventを受領した後は、最初のeventで同じ終了Promiseを開始し、Application取消とjoinを含む`server.close()`がsettleするまで両方のlistenerを保持する。重複eventを別終了へ展開せず、終了の成功・失敗が確定した後にだけlistenerを解除する。OSまたはConsoleからNode.js ProcessへのSignal配送自体はこの契約の成立範囲に含めず、対応環境ごとの実Process検証なしに利用者操作の成立を主張しない。
- HTTP接続、Bearer tokenおよびheaderはTransport認証・相関情報であり、Project AuthorityまたはRecovery Authorityではない。

### 5.2 Remote CROS Project Context MCP

Remote CROSのProject Context MCPは、同じ`/mcp` Protocolを使うが認証Ownerが異なる。

- Repository単体のlocalhost入口は起動時固定TokenをTransport認証へ使用し、CROS Credentialを要求しない。
- Remote CROS入口はAccess Managementへ要求毎の現在Credential検証を委譲し、失効・不正Tokenを一律401へ閉じる。
- 認証成功後にAccess Managementが現在Role・Exposure・Binding・実アクセスを評価し、認可済みRepository集合だけをDomain Modelへ渡して一要求のPortfolioへ固定する。
- `tools/list`も許可済みHandlerから返し、Remote Project Context入口でTask／Objective操作を暗黙公開しない。
- 共有配置でもMCP Listenerはloopback限定とし、同一Hostの外部TLS終端から`/mcp`へ直接配送する。CROS RESTの`/v1/...`と専用Shared Gatewayは設けない。WorkbenchとMCPを同一Originに固定しない。
- `mcp-server.json`のHTTPS公開Originと公開Host、TLS終端の確定Header、許可Originを検証する。TLS終端はClient由来のForwarded Headerを除去して上書きし、内部接続からの偽装を防ぐHost配置が確認できない場合は公開しない。認証後はAccess Managementが要求毎の現在認可を確認し、Local直接呼出しと同じ制約を用いる。鍵操作を除く公開能力だけを接続する。
- 非秘密設定は起動Repositoryの`.crdd/config/mcp-server.json`。現在の閉Schemaは任意の`publicOrigin`文字列だけで、空ObjectまたはFile不存在はlocalhost既定とする。`--cros`明示時だけ読み、Host設定や資格を含めない。例は[配布設定](../../../template/.crdd/config/mcp-server.example.json)。重複・余剰field、不正UTF-8、16KiB超過、観測時のDirectory／File link、取得時File Identity不一致、取得済みDescriptorのサイズ・mtime不一致は固定拒否にする。通常localhostとstdioは設定の存在で共有へ切り替えない。portは既存CLI引数が所有する。公開Originは案内URL、内部Listener URLは運用・試験の観測用として区別する。 これは起動時Snapshotの検査で、取得後のPath／Directory不変を保証しない。配置Ownerが設定変更と再起動を管理する。
- Bearer TokenはRequest Headerからだけ受け取り、CLI引数、環境変数、共有設定、Repositoryまたはlogへ保存しない。公開証明書の管理はTLS終端の運用責務であり、MCP Transportは証明書Authorityを所有しない。
- MCP Server停止は自身の受付停止、Request取消、Application join、Listener／Socket回収と終了結果までを一つの終了条件とし、親Processの標準入力終了でも同じ経路を通る。WorkbenchやTLS終端の終了を所有しない。旧Gateway終了試験だけでこの新しい公開経路の終了を証明しない。

### ブロック状態遷移

| 現在状態 | 契機／事前条件 | 処理と観測 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| 未開始 | stdioまたはlocalhost HTTPの固定設定 | 入出力／listenerを取得 | 待受中／拒否 | 拒否時はApplication呼出し0 |
| 待受中 | 認証・protocol一致の要求 | decodeし公開契約へ一回搬送 | 実行中／要求拒否 | transport metadataをAuthorityへしない |
| 実行中 | 結果、切断、parent EOF、signal | encode、取消、進行要求join | 待受中／終了中 | 切断を成功へ補正しない |
| 終了中 | shutdown開始 | 新規受付を止め、要求・socket・listenerを閉じる | 終了／不明 | listener不存在、進行要求0、listener解除 |
| 不明 | close／joinを確認不能 | 閉じた失敗結果を返す | 終了待ち | Application成功やcleanup完了を主張しない |

Transport再接続は新しい接続Lifecycleであり、切断した要求のAuthorityや未確定結果を暗黙継承しない。stdio EOF、HTTP切断、Process signalを同じ通知名だけで同一のOS Evidenceにしない。

## 6. 正常・準正常・異常

Topic／Meeting Tool Callでは、公開Schemaの拒否を`-32602 / Invalid params`、操作・保存の未知内部例外を`-32603 / Internal error`へ分離する。ID書式、正整数Revision、limit 1〜100、states最大4は配送前に検査する。Query／Cursorの意味はDomainが所有し、読取りlistの既知3拒否理由だけを入力不正へ対応付ける。書込み操作で同じ理由の例外が出ても内部故障として扱う。例外本文・Path・秘密値を公開せず、内部エラーから未保存、rollback、Effect 0またはcleanup成立を主張しない。この義務は`QA-000005`／`CPR-IT-012`へ接続する。

昇格先CHGと、Outcomeの移管先Topic／CHGは固定ID書式を配送前に照合する。owner／none参照へID制約を足さない。create／updateのMarkdownはDomain公開Parserを純粋な入力検証として用い、この検証の拒否だけを`-32602`へ返す。保存呼出し以降の例外へParser拒否の分類を適用しない。正常結果・競合・対象不存在の操作結果は維持し、従来入力不正に丸めていた内部故障だけのProtocol codeを訂正する。

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | 正しいMCP requestをstdioまたはlocalhost HTTPから受信 | CoordinatorのTask／Objective公開要求へ変換し、canonical結果をMCP responseへ投影する |
| 準正常 | 同じrequest identityを切断後に再送 | 新しいObjectiveを生成せず現在結果を返す |
| 準正常 | Coordinatorが判断待ちまたはRecovery要求を返す | 状態を保持して必要な次操作を返し、失敗または成功へ丸めない |
| 異常 | 未知tool、未知field、過大payloadまたは不正framing | Coordinatorを呼び出さずProtocol errorで停止する |
| 異常 | 管理者または別Process Workbenchが非秘密一覧・独立失効を含む鍵操作をCallする | 未構成のToolとして拒否し、鍵Owner呼出し・発行・失効・交換Effect・Secret結果は全て0。認証成功を鍵操作許可へ昇格しない |
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
