# CROS Workbench詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: workbench-server
状態: Candidate
維持責任者: Qual-Lab

CHG-000082の再編後の実装親Folderは`workbench-server`とする。以下の既存実測は旧配置の成立範囲を示し、CROS RESTをMCPへ置き換えた新経路の完成証明ではない。Browser向けWorkbench API、React＋ViteのCSR、既存画面とVisual Baselineを維持し、今回の再編でUX／IAを独断で再設計しない。

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Project／Portfolio状態を、欠測と根拠を保った画面へ投影する。 | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingを一覧・詳細・操作Flowへ接続する。 | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | 検証済みRepository境界をWorktree表示へ接続する。 | Covered |
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | AI ProfileとTool Capabilityを選択可能な表示へ接続する。 | Covered |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | Local／Remoteの入口差を同じApplication意味へ適合する。 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | Workspace Grant内だけのProject情報を表示・操作する。 | Covered |
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
| Security Boundary | Required | loopback、Workspace Grant、Repository Root、外部送信を分ける。 | [§6](#6-interfaceとinteraction境界) |
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
| ARCH-000013 | Workspace Grant内の投影 | User Account、Repository内ACL、Role付替え |
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
      ├ CROS共通能力（認可付き内部呼出し／MCP Client）
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
| Consumer Adapter | Domain Model、CROS、Version Control、Coordinator、Orchestratorの公開契約を画面要求へ適合する | 具象内部型や秘密を画面へ漏らすこと。下位からWorkbenchをimportさせる逆依存 |

### 3.1. Packageと公開入口

`40_Develop/workbench-server`のsrcは用途別に`client`、`server`、`application`、`connection`、`view-model`、`asset`へ分け、src配下は二階層以内とする。Browser Componentだけが`.tsx`とReactのvalue importを所有し、Server Graphへ混ぜない。Rootの`index.ts`は起動・終了の公開入口、`types.ts`は公開型とし、Screen Component全数をServer入口から再exportしない。`bin/workbench.ts`は一つの起動入口、反復検証はscripts、fixtureはtestsに置く。tools入口は本体へ配送し、表示・業務・構成を複製しない。

本体構成Rootが下位の公開APIへ直接依存する。ここでいうAdapterは要求・結果の局所変換であり、下位へWorkbench専用Portを注入するFrameworkではない。AI Profile本体はAI Adapter、認可付き管理はCROS、共通実行はCoordinator、上位Objective／候補採用はOrchestrator、成果物CRUDはDomain Modelが所有する。

## 4. 実行・配置モデル

```text
[Local Repository Mode]
React Browser UI ── localhost ── Node Workbench Server ── Repository-local Ports

[Local CROS Mode]
React Browser UI ── Workbench API ── 認可済みCROS共通能力（同一Process）

[Remote CROS Mode]
React Browser UI ── Workbench API ── MCP Client ── MCP Server ── CROS共通能力
                                                         └ granted Workspace only

[Build]
React／TypeScript Source ── Vite ── fixed Browser Bundle
                                      └ Node Serverがexact allowlist配信
```

- Local Serverはloopbackだけで待ち受け、任意Interfaceへ公開しない。
- Repository単体利用はCROS Credentialを要求しない。
- CROS利用時は既存CredentialとSession Grantを接続へ渡す。同一Processの直接呼出しでも現在の認可・Exposureを確認し、認可を省略するLocal特例を作らない。Repository単体利用は別の範囲であり、CROS認可へ暗黙昇格しない。
- Browser BundleはViteで生成する派生物であり、React／TypeScript Sourceとは別の設計正本にしない。固定Pathは再編後の`40_Develop/workbench-server/dist/client/assets/workbench-client.js`へ移し、Buildなしで起動可能な配布物へ含める。Coordinatorから到達する実行閉包にWorkbench Bundleを無条件で加えず、Workbench配布・公開Assetの完全性とCoordinator署名範囲を区別する。Build不能、配布集合外、Asset欠落またはallowlist外要求では固定・起動・配信を拒否する。旧Pathは移行前のEvidenceとしてのみ扱う。
- Node Serverは空のDocument Shell、固定AssetおよびJSON Read Modelだけを配信し、Browser Clientが全画面DOMをClient-side Reactで構築する。JSONはCredential verifier、Remote接続Bearer、Private Key、Host Pathおよび永続Authorityを含まず、同一Originの明示POST用のProcess限定Action TokenとCredential操作直後の一回表示Tokenだけを用途限定Fieldで扱う。SSR、Hydration、Raw HTML Fragmentおよび既存DOMの再読取りは行わない。
- React要素を生成するPanelと共通表示ComponentはBrowser Clientだけがvalue importする。Node CLI／Serverから到達するRuntime依存GraphはApplication、Read Model生成、Authority、HTTPおよび固定Asset配信だけを含み、React／React DOMまたはBrowser描画Moduleへ到達しない。型参照はRuntime依存として扱わないが、value import／再Export／dynamic importは配布候補固定前に閉集合で検査する。
- Browserを閉じたことだけでServer終了を推定しない。明示shutdownまたはOwner Process終了でlistenerと進行中requestを回収する。
- Next.js／Server Action、Desktop wrapper、OS tray、auto update、installerは`N/A`: 現在の利用者成果に必要な根拠がなく、Node側の既存Authority境界と責務が重複する。

### 4.1. 接続と操作の移管

Workbench Serverは別ProcessのCROSに対してMCP Clientとなる。BrowserからRemote MCPへ直接Bearerを渡さず、Server内の接続だけで使用する。接続先は明示した完全なMCP Endpoint一つへ固定し、旧`baseUrl`／`mcpBaseUrl`二系統、暗黙`/mcp`付与、接続先推定とREST Fallbackを新構成に残さない。旧設定の分割・参照更新はフロントAIが行い、Runtime互換Readerは持たない。

| 操作 | 現行Sourceで確認した入口 | 再編後の接続先 | 維持する結果・制約 |
|---|---|---|---|
| 接続／更新、Portfolio取得 | `workbench-server.ts`の`readRemotePortfolio` | MCPの既存Project一覧・Context取得を共通Portfolio表示へ適合 | 検索・状態・Query拘束Cursor、五場面、Source Coverage、欠測を保持。部分取得を完全Portfolioへ畳まない。 |
| AI Profile一覧・変更 | `readRemoteAiProfileCatalog`／`executeRemoteAiProfileMutation` | CROS共通認可からAI Adapter管理へ接続するMCP操作 | 管理可否、expectedRevision、登録済みModel、削除確認を維持。Catalog未接続と権限拒否を同じ成功の空一覧にしない。 |
| Runtime Activity | `readRemoteRuntimeActivity` | CROS認可付きActivity MCP操作 | Project限定の現在状態とEvent、順序、Cursor、Continuationと独立したunknownを保持。 |
| Topic／Meeting | `remote-topic-meeting.ts`の既存MCP呼出し | 同じEndpointの既存Tool、CROS Routing→Domain Model | Repository指定、CRUD、Relation Owner、競合、Outcome処置、Close条件と非開示を維持。 |
| Credential管理 | 既存Credential Administration | 同一Processでは共通CROS API、別Processでは認可付きMCP操作 | Token一度表示、失効・rotation、管理権限≠内容Grantを維持。Host限定の全喪失回復はRemote公開しない。 |

接続入力はEndpointとCredentialの検証→Protocol／能力一覧→許可Portfolio取得→現在接続への置換の順に行う。候補接続の失敗で既存接続を成功扱いせず、旧ProjectionをCurrentとして表示しない。新接続・切断ごとに世代を変え、旧Requestの遅延結果を新接続へ反映しない。Refreshは現在Credential・Exposureを再確認し、失効したSourceの選択と編集操作を解除する。

切断・Server終了は新規要求を止め、進行中MCP要求の取消・join、Client／Socket回収、Credential参照と表示Snapshotの破棄を順に行う。Remote側の保存済みEffectを切断で取り消したことにせず、結果不明を既存操作Identityへ結び、暗黙再送しない。CredentialはProcess memoryだけに保持し、Endpointのuserinfo／query、Browser履歴、Storage、設定、Repository、logへ残さない。

現在の`crdd.list_projects`はProject ID・状態・Source数だけを返し、完全Portfolioではない。再編候補では[MCPのPortfolio契約](../mcp-server/01_Architecture.md#32-portfolioの一覧詳細契約)に従い、同じToolへ検索・状態・Query拘束Cursor・limitとページ内Sourceを接続する。Workbenchは返されたページだけを表示し、独自の二重ページングや未取得Sourceの検索を行わない。詳細取得は毎回現在認可を再確認する。複数Requestの結果を一つの原子的snapshotと偽らず、全Source取得済みでない表示を完全Portfolioにしない。公開SchemaとReaderの本番接続は未完了である。

Credential発行／rotationは[MCPのv0.22採用範囲](../mcp-server/01_Architecture.md#33-credential管理の公開境界--v022の採用範囲)に従い、Hostまたは同一Processの管理へ限定する。Remote Workbenchでは一覧・Grant変更・失効だけを提供し、発行／rotationは利用不能と理由付きで表示する。一般MCP Clientへ生Tokenを返さず、未提供の操作を対応済みとしない。

起動時の`--cros`で単体／CROS利用を明示する。指定なしは現在Rootに固定し、`crdd.list_repositories`から得る唯一のIDを自動選択して切替操作を出さない。CROS指定時は同じ一覧・repositoryId入力で許可対象から選択し、初期化済みだからという理由で自動移行しない。同一Process CROSでは構成設定、別Process接続では明示MCP Endpointを用い、CredentialをCLI引数へ置かない。CROS設定不正・接続不能時は単体へFallbackしない。サーバー起動用CRDDリポも公開設定なしで対象に加えない。

## 5. Dataと状態

| 状態 | Owner | Workbenchでの保持 | 終了条件 |
|---|---|---|---|
| 選択Project／Screen／Panel | Workbench Session | 一時保持可 | Session終了で破棄 |
| Project／Portfolio Projection | Owner Artifact→CROS／Project Operation | 表示用Snapshotだけ | 再取得またはSession終了 |
| Topic／Meeting編集入力 | 利用者＋Interaction Adapter | 送信完了まで保持 | 成功、取消、明示破棄 |
| Git Tree／Diff／Stage状態 | Version Control Adapter | 観測結果とIdentityだけ | 再観測またはSession終了 |
| AI依頼入力、依頼種別、現在結果と候補確認 | 現在Session | Provider正本や候補内容を複製せず、Candidate IDと安全な確認Metadataだけを一時保持 | 明示採用・確認付き破棄・保留、取消、Session終了 |
| Runtime Activity投影 | Orchestrator | 一回の表示用Snapshotだけ | 再観測またはSession終了 |
| Project Plan | Current Release Projection→Project Operation共通Reader | Version、期限、Risk、Scope、依存および判断の表示用Snapshot | 再観測またはSession終了。計画値はRoadmap／CHGが正本 |
| Quality | Current Quality Projection→Project Operation共通Reader | 状態、Coverage、Gap、次Gateおよび人間判断の表示用Snapshot | 再観測またはSession終了。品質の各意味はQuality成果物が正本 |
| Documentation | Roadmap詳細、Project Context Owner Relation | 検証済みPathとtitleだけ | 再観測またはSession終了。内容はOwner Artifactが正本 |
| Credential Secret | CROS接続境界 | Workbench Process memoryだけ。入力後に再表示せず、URL、HTML、Repository、logへ保存しない | 明示切断またはProcess終了で破棄 |
| Remote Topic／Meeting対象Repository | CROS Portfolio Projection | 現在Sessionの選択IDだけ。Source本文やGrantを複製しない | Portfolio再取得で対象外になった時、明示切替またはSession終了で破棄 |
| 公式ロゴ | Official Asset Governance | 読取り専用Assetとして配信 | Server終了 |

WorkbenchはCurrent Projectionを独自Databaseへ複製しない。将来Cacheを導入する場合も、Source Identity、Currentness、Coverage、失効条件を持つ派生物として別途設計する。

## 6. InterfaceとInteraction境界

| 入口 | 入力 | 出力 | Authority／Effect |
|---|---|---|---|
| Screen Load | Project、Screen、Cursor、Filter | View Model、Coverage、Continuation、Failure | 読取りAuthorityを追加しない |
| Topic／Meeting操作 | Identity、期待Revision、入力、操作種別 | success／conflict／partial／unknown | 既存Command／Candidate入口へ委譲する |
| Repository観測 | 検証済みRoot、対象Path／Revision | Tree、Diff、Staged、Unstaged、Untracked、Conflict | 読取りのみ |
| Stage／Commit／Push | 選択差分、Commit内容、確認済みRemote／Branch／Commit | 段階別結果、残る差分、unknown | 明示Authorityを既存Version Control Portへ渡す。Force Push 0 |
| AI依頼 | 選択Context、Profile ID、依頼種別（読取り助言／変更候補）、利用者入力、変更候補時の明示許可Path、一依頼だけの外部送信確認 | 依頼種別、事実、保存済み分析、追加推論、次の選択肢、各項目の根拠参照、未採用Candidate ID、Provider状態 | Profile IDと依頼種別を読み替えずApplicationへ渡す。Workbenchは送信対象を明示して一回確認を要求し、未確認をEffect 0で拒否する。読取り助言は利用者入力と許可済み投影を内容Hash付き専用Task Packetへ固定し、Task Hash・Catalog Revision・exact Profile・Providerへ結合した確認をDispatchで一回だけ消費する。変更候補は明示されたRepository相対許可Pathとexact Executor Profileを署名済みOrchestrator Single Taskへ固定し、結果を`untrusted_not_adopted`として返す。読取り助言の確認を候補生成や採用Authorityへ再利用せず、候補の採用、CommitおよびPublishは別操作にする。根拠参照のない項目を部分表示せず、参照から任意Path読取りAuthorityを作らない |
| AI変更候補の採否 | 現在AI結果のCandidate ID、Storeから再読取りした分類・期限・基準Revision・Candidate／Patch Hash・変更Path、操作ごとの明示確認 | available／blocked、採用Receipt、Effect・cleanup・Recovery状態 | 確認はEffect 0とし、採用・破棄・保留を別操作にする。採用はOrchestratorの旧所有者処置、Canonical Adoption Lease、現在Revision・dirty・Scope再観測、候補Receiptと耐久記録を通った場合だけ行う。破棄は別の確認を必須にし、保留はRepository／Candidate Store Effect 0とする。採用してもCommitまたはPushを行わない |
| Runtime Activity | Project ID、任意Event Cursor | observed／absent／unknown、Objective／Task件数、判断・Recovery・次処置、Project限定Event Page | 読取りのみ。Runtime正本、状態遷移またはRecovery Authorityを生成しない。EventはExecution Intelligence Storeから新しい順・上限付きで投影する |
| Owner Artifact | 起動時Catalogに含まれる相対Markdown Path | Roadmap／Quality／Relation原文 | 読取りのみ。Catalog外Path、外部URL、親参照およびRepository越境を拒否する |
| Project Plan | `99_Roadmap/03_Releases.md` | Baseline、対象Version、期限、Risk、Scope、依存、判断およびOwner Link | 読取りのみ。欠落や構造不正を空計画へ畳まず、Roadmapにない値を推測しない |
| Quality | `07_Quality/01_Quality_Center.md` | 全体状態、対象、観測済み／未観測、Gap、次Gate、人間判断およびOwner Link | 読取りのみ。未観測をPassへ、進行中AuditをReadyへ畳まない |
| AI Profile管理 | 現在接続OwnerのProfile候補、現在Revision、登録済みAdapter／Model | 採用済みProfile Snapshot、拒否理由 | RepositoryとCROSを混合せず、CROSは`systemAdmin`接続時だけ表示する。Adapterを新設せず、競合と未確認削除をEffect 0で拒否する |
| Connection | Endpoint、Credential | Session、Grant内Projection、接続状態 | Remote時だけ。非開示対象を推測しない |
| Remote Topic／Meeting | 現在Portfolioで選択したRepository ID、一覧条件、Identity、期待Revision、操作入力 | 一覧、詳細、Relation Owner、書込み結果 | RequestごとにMCPへ明示Repositoryを渡す。PortfolioにないIDを拒否し、Remote失敗時にLocalへfallbackしない |

## 7. Visualと公式素材

- Visual Baselineは[Direction A](../../../04_UI/Details/Visual/workbench-hero/visual-baseline.md)を使用する。
- FontはNoto Sans CJKを基準とし、存在しないWeightの合成を無効にする。
- 左上のApplication Brandには`crdd-brand-icon-512x512.jpg`を表示する。
- Assetが取得不能な場合は、壊れた画像のまま成功表示せず、Brand Asset failureを診断可能にする。類似アイコンを自動生成しない。
- 320〜1920 CSS pxと100%／200%／400% Browser Zoomの評価契約をProductionへ継承する。
- 汎用Web ProductとしてDesktop、Tablet、Mobile相当Profileをすべて評価する。全Profile Passを必須にせず、人間が理由付きで許容した不適合を明示する。

## 8. FailureとRecovery

Topic／Meeting POSTは、入力評価と操作配送を分ける。token、kind／operation、固定ID・期待Revision、操作別参照とDomain公開ParserによるMarkdown検証を配送前に評価し、不正は固定400 `topic_meeting_action_rejected`へ返す。createへID／Revisionを要求せず、owner／none参照へID制約を追加しない。既存のRemote可視性確認とLocal Repository選択意味は維持する。

Local操作またはRemote要求の直前にだけ配送済みを記録し、その後の操作・保存、結果検査、投影再読取りの例外は固定500 `topic_meeting_action_failed`へ返す。この配送判定はEffect有無の証明ではない。例外本文・Path・秘密値を公開せず、500からrollback・未保存・Effect 0・cleanup成立を推定しない。Domainが返す競合・確認不足等のblocked結果は、従来の303と公開モデルを維持する。`QA-000005`／`CPR-IT-012`へ故障分類、010へ正常操作・競合・削除確認を接続する。

| Failure | 保持するもの | 禁止 | Recovery |
|---|---|---|---|
| Projection partial／unavailable | 観測済み範囲、Source、Coverage | 完全状態への畳込み | 再投影、Owner Artifactへ移動 |
| HTTP request切断 | Request Identity、Effect発行状態 | 結果不明の暗黙再送 | 状態再確認、安全な再入場 |
| Topic／Meeting conflict | 入力、対象Identity、比較可能な差 | 最新値への無断上書き | 再読込、差分確認、取消 |
| Remote Repository未選択／Grant外 | Remote接続状態と許可済みPortfolio | Local Repositoryの代替表示、ID知識によるAuthority生成、対象存在の推測 | 許可済みPortfolioから明示選択、Credential／Exposure再確認 |
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

この表の旧配置での観測は保持する。再編後の同一Process CROS呼出し／Remote MCPへの置換は未実装であり、旧REST／Gatewayの`Covered`を新経路へ引き継がない。新配置の公開Graph、設定Reader、全操作と終了実測を段階6／7で再確認する。

| 対象 | 現在状態 | 分類 | 処置 |
|---|---|---|---|
| Production Workbench package | `40_Develop/workbench-server`にClient-side React Application Shell、Vite Browser Build、localhost Node Server、固定Document Shell、用途限定Token以外の秘密・Authorityを含まないJSON Read Model、Project Surface、Repository Work、Topic／Meeting CRUDとMeeting Outcome処置、Credential管理Surface、Remote接続入力、Portfolioの検索・状態絞込み・Query拘束継続読込・Project別Source表示、Owner分離したRepository／CROS AI Profile管理、選択Profile IDと依頼種別付きの現在Session AI依頼Port、変更候補の確認・採用・破棄SurfaceおよびRuntime Activity Portが存在する。全画面DOMはBrowser側React Componentだけが所有し、Node Serverは認証・Authority・Repository Effect・JSON生成・固定Asset配信だけを所有する。SSR、Hydration、Raw HTML FragmentおよびDOM再読取りは存在しない。Repository単体Compositionは読取り助言を署名済み`workbench_advice` Runtimeへ、変更候補を明示許可Path付きの署名済みOrchestrator Single Taskへ接続する。候補はStoreから再読取りした安全なMetadataを表示し、別確認とOrchestrator Leaseを通った場合だけ採用する。Commit／Pushは行わない | Partial | CSRの型・Lint・Build、HTTP／JSON契約試験、15画面の実Browser Visual再確認および独立レビューは成立した。残るCodex／Claudeの実Provider E2Eを閉じるまで全体完了へ昇格しない |
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
