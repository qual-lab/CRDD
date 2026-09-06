# MCP Transportアーキテクチャ

状態: v0.20実装中
担当責任者: Qual-Lab
最終更新日: 2026-09-05

Related:
- [Runtime責務分離](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)
- [Project Runtime](../project-runtime/01_Architecture.md)
- [v0.19 Project Runtime詳細設計](../coordinator/03_Project_Runtime_Design.md)
- [Project状態参照とローカルMCP HTTP](../../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)

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
- `adapters`はMCP入力をProject Runtime公開要求へ変換し、公開結果をMCP結果へ投影する。
- `transports`はstdio、localhost HTTP等のbyte framing、fatal UTF-8、容量、header、socketおよびSession lifecycleを所有する。
- `src/index.ts`を唯一の公開入口とし、利用側は内部Pathを参照しない。
- `template/tools/crdd-mcp.ts`は配布・起動の構成Rootであり、MCP ProtocolやProject Runtimeの意味を再定義しない。

## 3. 依存と所有権

MCPはProject Runtime packageの公開入口だけへ依存する。Coordinator、Provider、Candidate Store、Windows Adapter、実行知StoreまたはProject Runtime内部Pathをimportしない。

Project Runtimeの状態、Identity、Recovery、判断または結果fieldをMCP Schemaで独立再定義しない。MCP固有Envelopeは保持するが、そのpayloadはProject Runtimeのcanonicalな公開契約を一つの変換規則で投影する。公開契約変更時はMCP利用側試験を変更影響型runnerが必ず選択する。

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
