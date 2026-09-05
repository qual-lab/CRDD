# MCP Transportアーキテクチャ

状態: v0.20設計候補
担当責任者: Qual-Lab
最終更新日: 2026-09-05

Related:
- [Runtime責務分離](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)
- [Project Runtime](../project-runtime/01_Architecture.md)
- [v0.19 Project Runtime詳細設計](../coordinator/03_Project_Runtime_Design.md)

## 1. 目的と責務

MCP packageは、MCP Protocolのrequest、response、通知、SessionおよびTransport lifecycleを、Project Runtimeの公開アプリケーション契約へ搬送するAdapterである。Project Runtime、Coordinator、Provider、Repository操作またはAuthorityの所有者ではない。

v0.20の責務分離では既存MCP stdioを独立packageへ移す。後続のMCP Streamable HTTPは同じProject Runtime公開契約へ接続する別Transportとして追加し、stdio実装またはCoordinator内部moduleを再利用して意味契約を作らない。

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

- `protocol`はMCPの閉じたEnvelope、tool名、Protocol errorおよびframingを所有する。
- `adapters`はMCP入力をProject Runtime公開要求へ変換し、公開結果をMCP結果へ投影する。
- `transports`はstdio、後続のlocalhost HTTP等のbyte搬送とSession lifecycleを所有する。
- `src/index.ts`を唯一の公開入口とし、利用側は内部Pathを参照しない。

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

## 6. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | 正しいMCP requestをstdioから受信 | Project Runtime公開要求へ変換し、canonical結果をMCP responseへ投影する |
| 準正常 | 同じrequest identityを切断後に再送 | 新しいObjectiveを生成せず現在結果を返す |
| 準正常 | Project Runtimeが判断待ちまたはRecovery要求を返す | 状態を保持して必要な次操作を返し、失敗または成功へ丸めない |
| 異常 | 未知tool、未知field、過大payloadまたは不正framing | Project Runtimeを呼び出さずProtocol errorで停止する |
| 異常 | 認証、Project BindingまたはAuthorityが不明 | Effect 0で拒否する |
| 異常 | connection切断またはresponse書込み不明 | Application結果を捏造せず、再取得可能なIdentityを保持する |
| 異常 | MCPとProject Runtimeの結果Schemaが不一致 | 閉じた変換で拒否し、部分結果を公開しない |

## 7. 検証と完成境界

単体試験はProtocolと変換、結合試験はstdio byte、UTF-8、framing、取消、切断、再送および結果投影、総合試験は実ProcessからProject Runtime公開Applicationまでを確認する。Project Runtimeの正常、判断待ち、Recovery、取消、Identity不一致および結果Schema変更を利用側回帰へ含める。

MCP packageの作成、stdio起動またはtool一覧取得だけでは完成としない。認証済み主体からProject Runtimeの公開結果までの縦断、Authority非生成、切断後再取得、資源回収、内部Path参照0、およびProject RuntimeとMCPのSchema対応が揃った場合だけ既存stdio移行の完成とする。localhost HTTPは別変更の完成条件であり、本分離の成立へ先取りしない。

