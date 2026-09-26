# MCP Transportアーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: mcp
状態: Canonical

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
| Interface Model | Required | 公開DTOとProject Runtime契約の変換を一方向にする。 | [§4](#4-authorityと情報境界) |
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
最終更新日: 2026-09-11

Related:
- [Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [Project Runtime](../project-runtime/01_Architecture.md)
- [MCP Serverの利用手順](../../../19_Workflows/04_MCP_Server.md)
- [Project状態参照とローカルMCP HTTP](../../../99_Roadmap/Changes/CHG-000064/change.md)

## 1. 目的と責務

MCP packageは、MCP Protocolのrequest、response、通知、接続およびTransport lifecycleを、Project Runtimeの公開アプリケーション契約へ搬送するAdapterである。Project Runtime、Coordinator、Provider、Repository操作またはAuthorityの所有者ではない。

v0.20の責務分離では既存MCP stdioを独立packageへ移し、MCP Streamable HTTPを同じProject Runtime公開契約へ接続する別Transportとして追加する。HTTPはstdio実装またはCoordinator内部moduleを再利用して意味契約を作らない。

利用者向け起動入口は`template/tools/crdd-mcp.ts`とする。この入口だけがMCP package、Project Runtime公開契約およびCoordinator公開Adapterを構成する。MCP package自身はCoordinatorへ依存せず、Coordinator CLIもMCPをsubcommandとして所有しない。

## 2. Package境界

```text
40_Develop/mcp/
├ package.json
├ src/
│  ├ index.ts
│  ├ protocol/
│  ├ adapters/
│  └ transports/
└ tests/
   ├ unit/
   ├ integration/
   ├ system/
   ├ fixtures/
   └ support/
```

- `protocol`はMCP version、閉じたJSON-RPC Envelope／ID／metadata、method／tool名、Protocol response／errorおよび完全な単一JSON文書の判定を所有する。JSON-RPC error envelopeの構成もProtocolだけが所有し、stdio／HTTP Transportは同じ公開constructorを使用して独自のerror objectを再定義しない。Project RuntimeやCoordinatorへ依存しない。
- `adapters`はMCP入力をProject Runtime公開要求へ変換し、公開結果をMCP結果へ投影する。Project Context参照では固定Markdownの意味契約を利用し、MCP固有の状態要約を正本化しない。
- `transports`はstdio、localhost HTTP等のbyte framing、fatal UTF-8、容量、header、socketおよびSession lifecycleを所有する。
- `src/index.ts`を唯一の公開入口とし、利用側は内部Pathを参照しない。
- `template/tools/crdd-mcp.ts`は配布・起動の構成Rootであり、MCP ProtocolやProject Runtimeの意味を再定義しない。

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
Project Runtime Adapter（adapters/）
  │ MCP要求と公開要求・結果の変換
  ↓ 公開入口だけを利用
Project Runtime【別package】

終了制御（transports/process-signal-*）
  → 受付停止・要求取消・Application終了待ち・Transport回収

純粋な入力snapshot（internal/）
  → 各利用箇所の入力を固定。実行権限は発行しない
```

`src/index.ts`が利用側への公開窓口となる。Coordinatorとの具体的な組合せはLauncherが所有し、MCP内部にProvider実行・Repository書込みのブロックを置かない。

MCPはProject Runtime packageの公開入口だけへ依存する。Coordinator、Provider、Candidate Store、Windows Adapter、実行知StoreまたはProject Runtime内部Pathをimportしない。

Project Runtimeの状態、Identity、Recovery、判断または結果fieldをMCP Schemaで独立再定義しない。MCP固有Envelopeは保持するが、そのpayloadはProject Runtimeのcanonicalな公開契約を一つの変換規則で投影する。公開契約変更時はMCP利用側試験を変更影響型runnerが必ず選択する。

Project Contextを返す場合も同じ原則を適用する。MCPは現在地、Risk・停止要因、人間の判断待ち、理由・根拠および次の一手を一つの結果として搬送できるが、Repository内正本、共有分析および対話時の追加推論を混同しない。Repository Role外のContextを補完せず、項目別`Observed At`やLive環境状態をMCPだけの都合で追加しない。

## 4. Authorityと情報境界

MCP Client、Session、connection、tool名またはmetadataからProject Authority、人間判断Authority、Repository操作権限、Recovery Authorityまたは成功を生成しない。認証・認可の結果は構成Rootから明示入力され、Adapterは対象Project、主体および要求へ結合したままProject Runtimeへ渡す。

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

connection切断やstdio EOFをTask終了とみなさない。取消を要求した場合も、Project Runtimeが対象Taskと資源のsettlementを返すまで取消完了と表示しない。response書込み不明時は同じrequest identityによる再取得へ接続し、新しいObjectiveを発行しない。

### 5.1 localhost Streamable HTTP

HTTP TransportはMCP `2026-07-28`へ固定し、一つの`/mcp` endpointでPOSTを受ける。旧版のGET streamとTransport Session IDは持たない。

- listenerは`127.0.0.1`だけへbindし、`0.0.0.0`、LAN AddressまたはInternetへfallbackしない。
- 32 byte以上の不透明Bearer tokenを起動時にHostから受け取り、未設定または不正なtokenでは起動しない。token値を結果、logまたはRepositoryへ保存しない。
- `Origin`がない非Browser Clientを許可し、Originがある場合は起動時のlocalhost allowlistとのexact一致だけを許可する。
- `MCP-Protocol-Version`、`Mcp-Method`および`tools/call`の`Mcp-Name`を本文の`_meta`、`method`、`params.name`と照合する。
- `application/json`のfatal UTF-8かつ128 KiB以下の単一JSON-RPC文書だけを受理し、ClientはJSONとSSEの双方をAcceptに示す。
- response切断は当該要求の取消であり、別要求またはProject全体の取消に拡張しない。Server終了はclosingへ一度だけ遷移し、`server.close()`で新規accept停止を開始してから、受信中body／request、Application、handler、残存socketの順に取消・回収し、Server終了と全Registryの空を確認した場合だけTransport cleanup完了を返す。公開LauncherがNode.jsの`SIGINT`／`SIGTERM` eventを受領した後は、最初のeventで同じ終了Promiseを開始し、Application取消とjoinを含む`server.close()`がsettleするまで両方のlistenerを保持する。重複eventを別終了へ展開せず、終了の成功・失敗が確定した後にだけlistenerを解除する。OSまたはConsoleからNode.js ProcessへのSignal配送自体はこの契約の成立範囲に含めず、対応環境ごとの実Process検証なしに利用者操作の成立を主張しない。
- HTTP接続、Bearer tokenおよびheaderはTransport認証・相関情報であり、Project AuthorityまたはRecovery Authorityではない。

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
| 正常 | 正しいMCP requestをstdioまたはlocalhost HTTPから受信 | Project Runtime公開要求へ変換し、canonical結果をMCP responseへ投影する |
| 準正常 | 同じrequest identityを切断後に再送 | 新しいObjectiveを生成せず現在結果を返す |
| 準正常 | Project Runtimeが判断待ちまたはRecovery要求を返す | 状態を保持して必要な次操作を返し、失敗または成功へ丸めない |
| 異常 | 未知tool、未知field、過大payloadまたは不正framing | Project Runtimeを呼び出さずProtocol errorで停止する |
| 異常 | 認証、Project BindingまたはAuthorityが不明 | Effect 0で拒否する |
| 異常 | connection切断またはresponse書込み不明 | Application結果を捏造せず、再取得可能なIdentityを保持する |
| 異常 | MCPとProject Runtimeの結果Schemaが不一致 | 閉じた変換で拒否し、部分結果を公開しない |
| 異常 | HTTP認証、Originまたはmirror headerが不一致 | Applicationを呼ばずHTTP／Protocol errorで停止する |
| 異常 | Content-Length途中、slow body、idle keep-aliveまたはApplication実行中にServer終了 | 新規acceptを停止し、body reader、Application、handler、socketを回収してから終了を確認する。Node.jsが重複Signal eventを受領してもlistenerを先に解除せず、終了失敗を成功へ変えない。OS／ConsoleからのSignal配送は別の実行環境検証とする |

## 7. 検証と完成境界

単体試験はProtocolと変換、結合試験はstdio byte、UTF-8、framing、取消、切断、再送および結果投影、総合試験は実ProcessからProject Runtime公開Applicationまでを確認する。Project Runtimeの正常、判断待ち、Recovery、取消、Identity不一致および結果Schema変更を利用側回帰へ含める。

MCP packageの作成、stdio／HTTP起動またはtool一覧取得だけでは完成としない。認証済み主体からObjective、Decision、Project Stateの公開結果までの縦断、Authority非生成、切断時取消、資源回収、内部Path参照0、およびProject RuntimeとMCPのSchema対応を確認する。HTTPはlocalhost限定、認証、Origin、mirror header、payload境界、Server終了時のApplication取消・join、Node.js Signal event受領後に終了確定までlistenerを保持する単一の公開Launcher配線、およびServer終了結果の観測が揃った場合だけ現行範囲を完成とする。実OS／Consoleから公開ProcessへのSignal配送と、その操作中のApplication終了は未評価として分離する。

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
