# MCP Transportアーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: mcp-server
状態: Candidate

CHG-000082の責務再編では実装親Folderを`mcp-server`とする。MCPはAI専用ではなくMachine向け公開境界であり、別ProcessのWorkbench ServerもClientとなる。CROS REST／Gatewayを廃止する代わりに、既存Portfolio、Profile管理、Runtime Activity、Credential、Topic／Meeting能力を共通CROS契約へ接続する。現行Source・試験の成立範囲と新しい配置の接続証明は区別する。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | 標準Project Contextから得た読取り専用のProject／Portfolio ProjectionをMCP DTOへ写し、五つの観点、欠測・制限・根拠を失わず返す。Transportは独自のProject状態StoreやObjective／Milestone受入判断Authorityを生成しない。 | Partial |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | stdioとHTTPを同じPublic Application Contractへ接続し、Transport間の意味同一性を保つ。 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | 認証済みRequest Access ContextだけをApplicationへ渡し、Workspace範囲をTransportで拡張しない。 | Partial |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 外部情報の入力・結果をMCP wireへ運ぶが、送信許可や候補採用Authorityは所有しない。 | Partial |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | stdio、HTTP、Schema Adapter、LauncherをTransport責務へ限定する。 | [§2](#2-package境界) |
| Interface Model | Required | 公開DTOとOrchestrator契約の変換を一方向にする。 | [§4](#4-authorityと情報境界) |
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

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-10-07

Related:
- [Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [Orchestrator](../orchestrator/01_Architecture.md)
- [MCP Serverの利用手順](../../../19_Workflows/04_MCP_Server.md)
- [Project状態参照とローカルMCP HTTP](../../../99_Roadmap/Changes/CHG-000064/change.md)

## 1. 目的と責務

MCP Serverは、Protocolのrequest、response、通知、接続とTransport lifecycleを、Orchestrator、Domain Modelおよび認可済みCROSの公開契約へ搬送する。Objective／Taskの意味、Provider、Repository成果物またはAuthorityの所有者ではない。ClientがAIかWorkbench Serverかで意味・権限を変えない。

v0.20の責務分離では既存MCP stdioを独立packageへ移し、MCP Streamable HTTPを同じOrchestrator公開契約へ接続する別Transportとして追加する。HTTPはstdio実装またはCoordinator内部moduleを再利用して意味契約を作らない。

利用者向け起動入口は`template/tools/crdd-mcp-server.ts`を維持し、本体の起動へ配送する薄い入口とする。構成RootはMCP Server自身が所有し、Orchestrator、Domain Model、CROSの公開APIだけから必要能力を構成する。Coordinator内部、Provider、Nativeや署名秘密を直接構成せず、Coordinator CLIもMCPをsubcommandとして所有しない。

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

- `protocol`はMCP version、閉じたJSON-RPC Envelope／ID／metadata、method／tool名、Protocol response／errorおよび完全な単一JSON文書の判定を所有する。JSON-RPC error envelopeの構成もProtocolだけが所有し、stdio／HTTP Transportは同じ公開constructorを使用して独自のerror objectを再定義しない。OrchestratorやCoordinatorへ依存しない。
- `adapters`はMCP入力をOrchestrator公開要求へ変換し、公開結果をMCP結果へ投影する。Project Context参照では固定Markdownの意味契約を利用し、MCP固有の状態要約を正本化しない。
- `transports`はstdio、localhost HTTP等のbyte framing、fatal UTF-8、容量、header、socketおよびSession lifecycleを所有する。
- `src/index.ts`を唯一の公開入口とし、利用側は内部Pathを参照しない。
- `composition`はServerの構成・起動を所有する。旧Shared ServerのREST／Gateway構成は撤去し、共通CROS能力の接続だけを保持する。`boundary`は閉じた入力snapshotを所有し、`internal`という雑多な置場を作らない。src配下のFolderは二階層以内とする。
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
  ├→ Orchestrator Adapter
  │    │ MCP要求と実行要求・結果の変換
  │    ↓ 公開入口だけを利用
  │  Orchestrator【別package】
  │
  └→ Project Context Adapter
       │ 一覧・取得要求を許可済みPortfolioへ変換
       ├→ Repository Project Context Reader【単一Repository】
       └→ CROS Portfolio Projection【複数Repository】

終了制御（transports/process-signal-*）
  → 受付停止・要求取消・Application終了待ち・Transport回収

純粋な入力snapshot（boundary/）
  → 各利用箇所の入力を固定。実行権限は発行しない
```

`src/index.ts`が利用側への公開窓口となる。Transportは`McpRequestHandler`だけへ依存し、OrchestratorまたはProject Contextの意味処理を直接所有しない。Coordinator、Repository Project Context ReaderおよびCROS Portfolioとの具体的な組合せはLauncher／Server Composition Rootが所有し、MCP内部にProvider実行・Repository書込み・Workspace Grant判定のブロックを置かない。

MCPの実行操作はOrchestrator、Repository成果物操作はDomain Model、横断認可と連合はCROSの用途別公開入口へ依存する。Coordinator、Provider、Candidate Store、Windows Adapter、実行知Storeまたはこれらの内部Pathをimportしない。Topic／Meetingの本文CRUDはDomain Model、許可済みRepositoryへのRoutingはCROS、MCP wire変換は本Serverが所有し、同じ処理をTransport別に複製しない。

Orchestratorの状態、Identity、Recovery、判断または結果fieldをMCP Schemaで独立再定義しない。MCP固有Envelopeは保持するが、そのpayloadはOrchestratorのcanonicalな公開契約を一つの変換規則で投影する。公開契約変更時はMCP利用側試験を変更影響型runnerが必ず選択する。

Project Contextを返す場合も同じ原則を適用する。`crdd.list_projects`は現在の接続から参照できるProject ID、統合状態および許可済みSource数だけを返し、`crdd.get_project_context`は指定ProjectのSource Coverageと各Repositoryが投影した五場面を返す。MCPは現在地、Risk・停止要因、人間の判断待ち、理由・根拠および次の一手を搬送するが、Repository内正本、共有分析および対話時の追加推論を混同しない。Repository Role外のContextを補完せず、項目別`Observed At`、Project Context固有IDまたはLive環境状態をMCPだけの都合で追加しない。

Repository単体では、現在の検証済みRepository Rootにある`PROJECT_CONTEXT.md`を毎Requestで読み取り、一SourceのPortfolio Projectionへ変換する。この経路にCROS Credentialを要求しない。CROS利用時は、CredentialとWorkspace Exposureを処置済みのPortfolio Projectionを同じAdapterへ渡す。MCPは両経路のAuthorityを統合・拡張せず、入力Projectionに存在しないProjectを同じ`project_context_not_available`へ閉じる。

Remote CROSではMCP専用の固定Bearerを別に発行しない。HTTP TransportはBearer文字列をRequest単位のHandler Resolverへ渡し、CROS Composition Rootが現在のConnection Credentialを検証する。検証済みWorkspace集合と同じ瞬間のExposure Snapshotから許可Portfolioを作り、そのRequest専用Handlerへ固定する。Credential Profile名、`systemAdmin`または前RequestのPortfolioからContent Accessを再構成しない。

Orchestratorの実行状態を返すToolは`crdd.get_orchestrator_state`とする。旧名`crdd.get_project_state`はProject全体のCurrent Projectionと誤認し得るため、v0.22の公開候補へ残さない。Project Contextは`crdd.list_projects`と`crdd.get_project_context`で取得し、Runtime DTOを再利用しない。

Repository単体MCPでは、Topic／Meetingの一覧、取得、登録、編集、削除およびMeeting Outcome処置ToolをProject Operationの共通Application契約へ接続する。一覧は同契約の検索、状態、Owner、期間、Relation、未処置Outcome、並び順およびID Cursor Paginationをそのまま搬送する。削除は誤登録理由、期待Revision、Relation影響0件および明示確認をすべて満たす場合だけEffectを発行する。Outcome処置は完了・移管・昇格・理由付き不採用を区別し、全件処置済みの場合だけ同じCommandでMeetingを閉じられる。

単体／CROSの両Modeで、Repositoryを対象にするToolは同じ`repositoryId`必須入力を用いる。単体では起動時に検証したRepository Rootと自身のIDへ固定し、別IDを拒否する。CROS Composition RootはRequestごとの現在Credential、Workspace Grant、Exposure Registry revision、Repository revisionおよびBindingを再検証し、許可済みRepositoryの共通Applicationだけを返す。Adapterは検証済み`repositoryId`を配送情報として処置してから共通処理を一回呼ぶ。IDを省略した暗黙選択、別RepositoryへのFallback、IDからの読取りAuthority生成を行わない。Grant外、固定Root不一致、改訂不一致またはBinding不在は、対象の存在・Role・Workspaceを開示しない同じ`Invalid params`へ閉じる。

### 単体／CROSの明示選択とRepository一覧

人間が2026-10-07に確認した利用モデルでは、`--cros`なしは起動Repository一つ、`--cros`ありはCROSの登録・公開・Credentialで許可したRepositoryを扱う。設定Fileの存在や初期化済み状態からModeを自動切替しない。CROS設定不正時に単体へ戻さず、単体起動で兄弟Repositoryを探索しない。

| 操作・状態 | 単体Mode | CROS Mode |
|---|---|---|
| `crdd.list_repositories` | 入力は空Object。検証済みRootの自身のrepositoryId、projectId、repositoryRoleを一件だけ返す。CROS登録は不要。 | 入力は空Object。現在CredentialとExposureから許可したRepositoryの同じ形の一覧だけを返す。管理者だから全件を返す扱いにはしない。 |
| Repository指定Tool | `repositoryId`は必須で、上記一件のIDだけを受理する。 | 同じ入力形式で、Request時に現在許可されたIDだけを受理する。 |
| Project一覧／連合Context | Repository指定を必要としない一覧・連合ToolへrepositoryIdを機械的に追加しない。一SourceのProjectを返す。 | Project IDとSource Coverageの意味を維持する。Project IDをRepository IDの代替にしない。 |
| Root／ID不明 | 起動Rootと正本Identityを確認できなければ開始しない。空の成功一覧にしない。 | 設定・Binding・Credentialの不正を停止／拒否し、起動用CRDDリポを自動公開しない。 |

`crdd.list_repositories`はProject一覧とは異なる対象選択の入口であり、新しい安定IDを採番せずRepository自身のIDを返す。Host Path、Registry内部ID、Credential、非許可Repositoryの存在・件数を返さない。Repository固定のObjective受付、判断、Runtime状態・Topic／Meeting操作はこの共通対象指定を利用し、配送後のpayloadはOrchestrator／Domain Modelの公開契約を用いる。CROS管理操作とProject連合の取得へ不要なRepository指定を追加しない。

CROSの初期管理CredentialはCROS構築時のHost対話操作で明示発行し、MCPを起動したことだけで発行しない。CROS HTTP入口はRegistry未初期化時に開始しない。単体stdioはCROS Credential不要、単体localhost HTTPは既存Transport Tokenを必要とする。CROSのBearerはHTTP認証Headerで受け、Tool引数にTokenを追加しない。今回CROS構成はHTTP入口へ限定し、`--cros --stdio`の未設計認証を暗黙提供しない。

Remote CROSのTopic／Meeting取得結果は、本文に記録された安定ID Relationを同じLogical Projectの許可済みRepository集合で解決する。一意な対象だけにOwner Repository IDを付け、0件は`unavailable`、複数件は`conflicting`として返す。MCPはRelation先本文をSource Repositoryへ複製せず、Relation結果を別Repository書込みのAuthorityとして扱わない。

### 3.1. CROS能力を搬送する閉じた操作契約

以下は新経路の設計候補であり、未実装Toolを既存`tools/list`へ登録済みとは表示しない。新しいTool名はProtocol正本で定義し、一覧・Routing・入力／結果検査・Workbench Clientと契約試験を同じ改訂で接続する。任意commandを受ける汎用Toolへまとめない。

| 操作 | 設計候補の入力 | 構造化結果とOwner | 認可・反例 |
|---|---|---|---|
| `crdd.get_runtime_activity` | 必須`projectId`、任意`cursor`、任意`limit`（既定20、1〜50の整数）。未知fieldを拒否する。 | CROS公開Activity契約。現在状態`observed / absent / unknown`、理由、projection、独立したeventState／eventReason、events、eventContinuation。 | 現在GrantのRepositoryだけをReaderへ渡す。Eventが観測不能の場合は空の成功へ変えない。 |
| `crdd.list_ai_profiles` | 空Object。未知fieldを拒否する。 | AI Adapterの`AiProfileCatalogSnapshot`をCROS Ownerから取得し、Repository Ownerと混合しない。 | 現在`system_admin`が必要。非管理主体へCatalog内容・管理Storeの存在を返さず、空Catalogに補正しない。 |
| `crdd.create_ai_profile` | `expectedRevision`と`profile`。操作値はHandlerが`create`へ固定する。 | AI Adapterの`AiProfileCatalogMutationResult`をそのまま投影する。 | 重複Identity、未登録Adapter／Model、不正Catalog、revision競合を既存理由で拒否する。 |
| `crdd.update_ai_profile` | `expectedRevision`と`profile`。操作値は`update`へ固定する。 | 同じMutationResult。 | 不在対象を作成へFallbackせず、revision競合を無断再試行しない。 |
| `crdd.delete_ai_profile` | `expectedRevision`、`profileId`、`confirmed`。操作値は`delete`へ固定する。 | 同じMutationResult。 | 未確認削除はEffect 0。生Provider Credential、任意Path／CLI引数の操作へ拡張しない。 |

`profile`のfield、数値revisionと既存reason集合はAI Adapterの型／Validatorを正本とし、MCP固有のProfile Schemaを別に発展させない。各Toolは固定operationを共通Mutationへ一度だけ変換する。Profile管理を表示することと操作時の認可を分け、`tools/list`と`tools/call`の両方で現在の管理可否を検証する。取消や応答喪失の後にStoreの採用済みrevisionを未採用へ書き換えず、結果再観測を行う。

Project一覧・Context取得とTopic／Meetingの既存Tool名・安定IDは維持する。Host限定Credential全喪失回復をRemote Toolにしない。新しい管理操作を一部登録しただけでCROS管理Surface全体を完成としない。

### 3.2. Portfolioの一覧・詳細契約

完全Portfolio用の重複Toolを増やさず、既存`crdd.list_projects`をページ単位の許可済みProjectionへ補強する。新形式だけを本体へ接続し、旧Consumerの移行はフロントAI手順と利用側更新で扱う。現在の入力が空Object・結果がSummaryだけという実装を、完成済みの新契約とはみなさない。

| 契約 | 入力／結果 | 保持条件 |
|---|---|---|
| 一覧入力 | 任意`query`（既定空文字）、任意`state`（`complete / partial / conflicting`、未指定は全状態）、任意`cursor`、任意`limit`（既定20、1〜50）。未知fieldを拒否する。 | 既存Workbenchと同じProject IDの部分一致・状態絞込みを用いる。検索対象を無断で非許可Source本文へ広げない。 |
| 一覧結果 | `projects`の各行に既存projectId／state／sourceCountと、CROSの`FederatedProjectSource`集合を保持する。`continuation`と`retainedAsSourceOfTruth: false`を返す。 | 一つの認可済みPortfolio snapshotから絞込み・安定並び順・ページ抽出を行う。結果はページであり全Project取得済みを意味しない。 |
| 詳細 | 既存`crdd.get_project_context`のprojectId入力と五場面・Source Coverageを維持する。 | 毎Requestで現在認可を再評価し、一覧時のGrantを再利用しない。許可外・未検出は同じ非開示結果へ閉じる。 |
| Cursor | 正規化Query、状態、limit、最終Project IDおよび現在の認可／Exposure／Source revision集合の非秘密digestへ拘束する。 | 改ざん、不一致、対象消失、改訂変化は無効Cursorへ閉じ、空の成功または先頭からの暗黙再開にしない。Cursor自体は読取りAuthorityではない。 |

Sourceのcontext、repositoryRole、complete／missing／conflictingと現在revisionはCROS型を正本とする。非許可Sourceの欠落枠、存在または件数を補完しない。ページ間や一覧と詳細の改訂差は別の観測であり、Workbenchは同じ原子的snapshotと表示しない。Query変更・失効・Cursor拒否時は旧ページとSource選択をCurrentから外し、利用者の明示Refreshへ戻す。Source本文の容量不適合は切詰めた正常Contextにせず、既存の観測不能／失敗へ分類する。

### 3.3. Credential管理の公開境界 — v0.22の採用範囲

人間は2026-10-07、今回のVerでは発行／rotationをHostまたは同一ProcessのWorkbench管理へ限定する方針を採用した。現行CROSの`listConnectionCredentials`は認証材料を除いたMetadataを返し、更新／失効は生Tokenを返さない。一方、`issueConnectionCredential`と`rotateConnectionCredential`は生Tokenを一度だけ返す。一般MCP結果へ生Tokenを追加せず、Remote Workbenchでこの二操作を提供しない。MCPから利用できる非秘密管理操作と、Host／同一Processの明示管理操作を区別する。

| 操作 | 必要な入力・結果の対応 | 現在の処置 |
|---|---|---|
| 一覧 | 空Object→ConnectionCredentialListResult。現在systemAdminを検証し、salt／Verifier／生Tokenを返さない。 | 非秘密の管理操作として詳細化可能。 |
| Grant変更 | credentialId、workspaceIds、systemAdmin→ConnectionCredentialChangeResult。現在Actorと対象を再検証し、inspect／publishのrevision一致を要求する。 | 非秘密。固定された古い管理Access Contextを無期限使用しない。 |
| 失効 | credentialId→ConnectionCredentialChangeResult。 | 非秘密。対象不明、権限不足、Registry競合を成功へ変えない。 |
| 発行／rotation | ProfileまたはcredentialId→Metadataと一度表示Token。 | Hostまたは同一Process Workbenchだけ。Remote MCP Toolへ登録せず、生Tokenを一般結果へ返さない。 |
| 管理資格全喪失回復 | Host所有者の対話確認→同一Recovery IDで既存Registryを更新する。 | Host限定を維持し、Remote公開しない。 |

非秘密の操作候補は`crdd.list_connection_credentials`（空入力）、`crdd.update_connection_credential_access`（credentialId、workspaceIds、systemAdmin）、`crdd.revoke_connection_credential`（credentialId）とする。未知fieldを拒否し、毎Callで現在管理権限と対象を再確認する。表示時に取得した古いActorをそのまま使い続けない。結果型、Registryのinspect／publish競合と既存reasonはCROSを正本とし、管理可否を内容Accessへ昇格させない。

Host発行は最初の管理Credentialを管理可・内容Grantなしで作り、起動ごとに再発行しない。通常発行／rotationは明示操作後の一回表示だけとし、Tokenの永続保存・再表示・Prompt／log混入を禁止する。応答喪失時に発行を暗黙再試行せず、Metadata／Registryを確認して必要な失効と新発行を明示操作する。秘密配送FrameworkやRemote Token保管は今回追加しない。将来Remote発行が必要な場合は別の具体要求・境界確認へ戻す。

## 4. Authorityと情報境界

MCP Client、Session、connection、tool名またはmetadataからProject Authority、人間判断Authority、Repository操作権限、Recovery Authorityまたは成功を生成しない。認証・認可の結果は構成Rootから明示入力され、Adapterは対象Project、主体および要求へ結合したままOrchestratorへ渡す。

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

connection切断やstdio EOFをTask終了とみなさない。取消を要求した場合も、Orchestratorが対象Taskと資源のsettlementを返すまで取消完了と表示しない。response書込み不明時は同じrequest identityによる再取得へ接続し、新しいObjectiveを発行しない。

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
- Remote CROS入口はRequestごとにConnection Credential Registryを再確認し、失効・不正Tokenを一律401へ閉じる。
- 認証成功後に現在のWorkspace Exposureを解決し、許可Repositoryだけを一RequestのPortfolioへ固定する。
- `tools/list`も許可済みHandlerから返し、Remote Project Context入口でOrchestrator操作を暗黙公開しない。
- 共有配置でもMCP Listenerはloopback限定とし、同一Hostの外部TLS終端から`/mcp`へ直接配送する。CROS RESTの`/v1/...`と専用Shared Gatewayは設けない。WorkbenchとMCPを同一Originに固定しない。
- `mcp-server.json`のHTTPS公開Originと公開Host、TLS終端の確定Header、許可Originを検証する。TLS終端はClient由来のForwarded Headerを除去して上書きし、内部接続からの偽装を防ぐHost配置が確認できない場合は公開しない。認証後はCROS共通能力がRequestごとのCredential／Exposureを再確認し、Local直接呼出しと同じ制約を用いる。
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

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | 正しいMCP requestをstdioまたはlocalhost HTTPから受信 | Orchestrator公開要求へ変換し、canonical結果をMCP responseへ投影する |
| 準正常 | 同じrequest identityを切断後に再送 | 新しいObjectiveを生成せず現在結果を返す |
| 準正常 | Orchestratorが判断待ちまたはRecovery要求を返す | 状態を保持して必要な次操作を返し、失敗または成功へ丸めない |
| 異常 | 未知tool、未知field、過大payloadまたは不正framing | Orchestratorを呼び出さずProtocol errorで停止する |
| 異常 | 認証、Project BindingまたはAuthorityが不明 | Effect 0で拒否する |
| 異常 | connection切断またはresponse書込み不明 | Application結果を捏造せず、再取得可能なIdentityを保持する |
| 異常 | MCPとOrchestratorの結果Schemaが不一致 | 閉じた変換で拒否し、部分結果を公開しない |
| 異常 | HTTP認証、Originまたはmirror headerが不一致 | Applicationを呼ばずHTTP／Protocol errorで停止する |
| 異常 | Content-Length途中、slow body、idle keep-aliveまたはApplication実行中にServer終了 | 新規acceptを停止し、body reader、Application、handler、socketを回収してから終了を確認する。Node.jsが重複Signal eventを受領してもlistenerを先に解除せず、終了失敗を成功へ変えない。OS／ConsoleからのSignal配送は別の実行環境検証とする |

## 7. 検証と完成境界

単体試験はProtocolと変換、結合試験はstdio byte、UTF-8、framing、取消、切断、再送および結果投影、総合試験は実ProcessからOrchestrator公開Applicationまでを確認する。Orchestratorの正常、判断待ち、Recovery、取消、Identity不一致および結果Schema変更を利用側回帰へ含める。

MCP packageの作成、stdio／HTTP起動またはtool一覧取得だけでは完成としない。認証済み主体からObjective、Decision、Project Stateの公開結果までの縦断、Authority非生成、切断時取消、資源回収、内部Path参照0、およびOrchestratorとMCPのSchema対応を確認する。HTTPはlocalhost限定、認証、Origin、mirror header、payload境界、Server終了時のApplication取消・join、Node.js Signal event受領後に終了確定までlistenerを保持する単一の公開Launcher配線、およびServer終了結果の観測が揃った場合だけ現行範囲を完成とする。実OS／Consoleから公開ProcessへのSignal配送と、その操作中のApplication終了は未評価として分離する。

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
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000005、ARCH-000012、ARCH-000013、ARCH-000015のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000004.spec-000002`、`PRT-000004.spec-000006`、`PRT-000004.spec-000007`、`PRT-000007.spec-000011`、`PRT-000008.spec-000012`、`PRT-000016.spec-000021`、`PRT-000016.spec-000026`、`PRT-000016.spec-000027`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

Checklist評価根拠: CROS既存能力のMCP公開SchemaとLocal／Remote利用側を具体化し、二Modeで同じRepository指定契約を保持した。Tool登録と本番接続は未評価である。 QA-000001／004／007／009へProfile、Activity、Credential、TLS・Origin、公開HTTP終端の検証義務を渡した。stdioのST-012とHTTPのST-013を独立判定し、実観測は未完了である。

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
