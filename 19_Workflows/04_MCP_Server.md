# MCP Serverの利用手順

状態: Candidate（v0.22.0の二Surface構成。全体検証は未完了）
担当責任者: Qual-Lab

## 目的と責務

本書は、CRDD配布物に含まれるMCP Serverをstdioまたはlocalhost HTTPで起動する反復手順を所有する。Protocol、Transport lifecycle、認証、Authorityおよび完成条件は[MCP Transportアーキテクチャ](../06_Architecture/Details/mcp-server/01_Architecture.md)が所有し、本書で再定義しない。

MCPはCoordinatorのsubcommandではない。OrchestratorやPlatform Accessには独立した利用者向けProcess入口がないため、MCPと同じ形のWorkflowを機械的に追加しない。

## 公開入口

| 利用目的 | 公開入口 | 境界 |
|---|---|---|
| MCP stdio | `node 00_CRDD/template/tools/crdd-mcp-server.ts --stdio` | Clientと一つの標準入出力sessionを構成する |
| localhost HTTP | `node 00_CRDD/template/tools/crdd-mcp-server.ts --http --port <port>` | `127.0.0.1`だけへbindする。LAN／InternetまたはRemote接続を意味しない |
| CROS共有HTTP | `node 00_CRDD/template/tools/crdd-mcp-server.ts --cros --http --port <port>` | 現在のHost管理状態を要求毎に認証・認可する。外部公開時は同HostのTLS終端を配置する |
| Workbenchと同一ポート（開発時） | `npm --prefix 40_Develop/crdd-server start -- --cros --mcp --port <port>` | 同じloopback Listenerの `/mcp` のみMCPへ接続する。個別起動は引き続き利用できる |

採用Repositoryでは、公式Release tagへ固定した完全な`00_CRDD` cloneまたはsubmoduleから公開入口を起動する。CRDD公式Repository内の開発確認では、同じ相対位置の`template/tools/crdd-mcp-server.ts`を使用する。内部packageの`bin`、内部moduleまたはCoordinator CLIからMCP入口を推測しない。

## 共有Host上のMCP設定

MCPとWorkbenchは独立した公開契約であり、一つのListenerにまとめても資格・認可を相互代用しない。Shared Host／CROS REST／Gatewayという第三のServerは起動しない。明示`--cros`は既存HostのAccess Managementを使う選択であり、設定Fileの存在で自動切替しない。初回の管理者と鍵はHostのAccess Management入口で設定し、User・Repository登録・公開範囲はWorkbenchの管理操作で扱う。MCPへ鍵操作やRepository登録を公開しない。

同一ポートでは両パッケージの依存を準備してから `--cros --mcp` を明示する。両設定の公開Originを同じ値にするか両方とも省略する。違う値や一方だけの指定では起動しない。このモードで `CRDD_MCP_HTTP_BEARER_TOKEN` は使用せず、設定されていれば起動を拒否する。

公開HTTPS Originは起動Repositoryの`.crdd/config/mcp-server.json`に置き、portはCLI引数で指定する。[MCP設定例](../template/.crdd/config/mcp-server.example.json)と[Workbench設定例](../template/.crdd/config/workbench-server.example.json)は非秘密の可視配布例で、実設定として自動採用しない。User・Credential・Binding・Exposureは既存Host管理状態が正本であり、手編集する`cros.json`や管理状態の設定例を別に作らない。保存境界と移行は[Access Management設計](../06_Architecture/Details/access-management/02_Management_State_and_API.md)を参照する。

外部TLS終端はClient由来のForwarded Headerを除去し、`x-forwarded-proto=https`と期待する`x-forwarded-host`を上書きし、公開Hostを保持する。内部Listenerへの直接到達を運用側で禁止する。MCPのProtocol公開Pathは`/mcp`だけで、旧REST同一Origin・Gateway health・HTTP入口のstdin EOF終了を維持しない。BearerやTLS秘密鍵をRepository設定・argv・logへ保存しない。旧設定の移行・清掃はフロントAIがOwner停止・明示対応・読戻しを確認して実施し、Runtimeに旧形式fallbackを追加しない。

## 実行前と終了後

| 時点 | 確認 |
|---|---|
| 実行前 | Node、配布Identity、Repository Binding、外部送信Policy、認証情報および対象portの成立 |
| 実行中 | request identity、認証、Origin、容量、切断、取消および閉じた結果 |
| 終了時 | listener、socket、受信途中Request、実行中Applicationおよび取消処理のjoin |
| 観測不能 | 成功や不存在へ補正せず、MCP結果またはRuntimeのRecovery契約に従う |

直接端末の終了、stdio EOFまたはHTTP切断だけをTask終了と扱わない。Server再接続は新しいTransport lifecycleであり、前の接続が持つAuthorityや未確定結果を暗黙継承しない。

## 開発確認

MCPの型、Lint、Formatおよび試験は`40_Develop/crdd-server`の`package.json`が所有する入口から実行する。公開起動コマンドは変更しない。CoordinatorのTask／Objectiveまでの総合確認、実Provider、正式署名またはRelease判断を、パッケージ単体試験の成功から推定しない。実行対象と必要な試験は[検証設計](../07_Quality/03_Verification_Design.md)と[試験カタログ](../07_Quality/Registry/test-catalog.json)から選ぶ。

### 開発用HTTP API参照

`crdd-server` の開発依存と `workbench-ui` の依存を導入し、公式Repositoryで `npm --prefix 40_Develop/crdd-server start -- --docs --port <port>` を実行する。起動が案内したlocalhost URLの `/docs` でSwagger UI、`/openapi.json` でOpenAPIを取得する。共有モード・AI有効化とは併用しない。Swagger UIからの操作送信、外部バリデーターへの送信、資格の保存は無効にしている。MCP Toolは次のInspectorで確認し、OpenAPIにJSON-RPCを重ねて定義しない。

### 公式MCP Inspector

[公式Inspector](https://github.com/modelcontextprotocol/inspector) の固定版 `2.16.0` を開発用に使う。Windowsの今回の確認では Node.js `24.22.3` を使用した。製品のNode.js下限や依存へInspectorを加えない。確認には専用の作業領域を使い、`MCP_INSPECTOR_SECRET_STORE=memory`、`MCP_STORAGE_DIR`・`MCP_CATALOG_PATH`・npm cacheをその領域へ限定する。既存のInspector設定や実資格は読ませない。

公式Repository Rootを起点に、Inspector CLIで既存stdio入口のTool一覧だけを確認する。通常の起動では `--automation` を渡さない。外部配信から導入する場合は固定版と依存を確認し、インストール時スクリプトを無効にする。

```text
npm exec --ignore-scripts --yes --package @modelcontextprotocol/inspector@2.16.0 -- mcp-inspector --cli --protocol-era modern --method tools/list --strict --format json -- node template/tools/crdd-mcp-server.ts --stdio
```
