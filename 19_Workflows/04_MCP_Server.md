# CRDD ServerとMCPの利用手順

状態: Candidate（v0.22.0の二Surface構成。全体検証は未完了）
担当責任者: Qual-Lab

## 目的と責務

本書は、CRDD配布物からWorkbench・HTTP API・MCPを同じProcessで起動する手順を所有する。通信・認可・終了の契約は[MCP Transportアーキテクチャ](../06_Architecture/Details/mcp-server/01_Architecture.md)を参照する。

MCPはCoordinatorのsubcommandではない。OrchestratorやPlatform Accessには独立した利用者向けProcess入口がないため、MCPと同じ形のWorkflowを機械的に追加しない。

## 公開入口

| 利用目的 | 公開入口 | 境界 |
|---|---|---|
| 単体HTTP | `node 00_CRDD/template/tools/crdd-server.ts [--port <port>] [--docs]` | HTTP API・Workbench・MCP `/mcp` を同じ `127.0.0.1` のポートで提供 |
| 共有HTTP | `node 00_CRDD/template/tools/crdd-server.ts --shared [--port <port>]` | 同じ待受構成で既存のHost資格と対象Repositoryの権限を要求ごとに確認 |
| 単体stdio | `node 00_CRDD/template/tools/crdd-server.ts --mcp-stdio [--port <port>] [--docs]` | HTTP APIとWorkbenchを提供したまま、MCPだけstdioへ切替。HTTPの `/mcp` では処理しない |
| 利用方法 | `node 00_CRDD/template/tools/crdd-server.ts --help` | 待受を開始しない |

採用Repositoryでは、公式Release tagへ固定した完全な`00_CRDD` cloneまたはsubmoduleと、Serverの依存・Workbench UIの生成済み配布物を同じ版で用意する。公式Repository内の開発確認では `template/tools/crdd-server.ts` を使用する。ポートの省略または `0` で自動割当てする。stdio時は標準出力をMCP専用とし、起動URLと診断は標準エラーへ出す。stdin EOFまたは終了シグナルでMCPとHTTPの所有資源を閉じる。

単体と共有のどちらでも、Objective実行・判断送信・実行状態照会は通常のToolとして利用する。単体は起動Repository、共有は指定した `repositoryId` と開発権限に結び付ける。単体HTTPのMCPには既存の `CRDD_MCP_HTTP_BEARER_TOKEN` が必要で、未設定でもWorkbenchを起動するが `/mcp` の要求は拒否する。起動や一覧取得だけで実行Ownerを開始しない。旧MCP単独コマンド・旧フラグの互換入口は設けない。

## 共有Host上のMCP設定

MCPとWorkbenchは独立した公開契約であり、一つの待受でも資格・認可を相互代用しない。明示 `--shared` は既存HostのAccess Managementを使い、設定Fileの存在で自動切替しない。初回の管理者と鍵はHostのAccess Management入口で設定し、User・Repository登録・公開範囲はWorkbenchの管理操作で扱う。MCPへ鍵操作やRepository登録を公開しない。

共有時は公開Originの両設定を同じ値にするか、両方とも省略する。違う値や一方だけの指定では起動しない。`--shared` は `--docs`・`--mcp-stdio`・固定Bearerと併用できない。どのモードもLANやインターネットに直接公開しない。

公開HTTPS Originを指定する場合は、同じ値を起動リポジトリの`.crdd/config/mcp-server.json`と`.crdd/config/workbench-server.json`の両方へ設定する。ポートはCLI引数で指定する。[MCP設定例](../template/.crdd/config/mcp-server.example.json)と[Workbench設定例](../template/.crdd/config/workbench-server.example.json)は同じ例示用Originを使用し、実設定として自動採用しない。User・Credential・Binding・Exposureは既存Host管理状態が正本であり、手編集する`cros.json`や管理状態の設定例を別に作らない。保存境界と移行は[Access Management設計](../06_Architecture/Details/access-management/02_Management_State_and_API.md)を参照する。

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

MCPの型、Lint、Formatおよび試験は`40_Develop/crdd-server`の`package.json`が所有する入口から実行する。CoordinatorのTask／Objectiveまでの総合確認、実Provider、正式署名またはRelease判断を、パッケージ単体試験の成功から推定しない。実行対象と必要な試験は[検証設計](../07_Quality/03_Verification_Design.md)と[試験カタログ](../07_Quality/Registry/test-catalog.json)から選ぶ。

### 開発用HTTP API参照

`crdd-server` の開発依存と `workbench-ui` の依存を導入し、公式Repositoryで `npm --prefix 40_Develop/crdd-server start -- --docs --port <port>` を実行する。起動が案内したlocalhost URLの `/docs` でSwagger UI、`/openapi.json` でOpenAPIを取得する。共有モード・AI有効化とは併用しない。Swagger UIからの操作送信、外部バリデーターへの送信、資格の保存は無効にしている。MCP Toolは次のInspectorで確認し、OpenAPIにJSON-RPCを重ねて定義しない。

### 公式MCP Inspector

[公式Inspector](https://github.com/modelcontextprotocol/inspector) の固定版 `2.16.0` を開発用に使う。Windowsの今回の確認では Node.js `24.22.3` を使用した。製品のNode.js下限や依存へInspectorを加えない。確認には専用の作業領域を使い、`MCP_INSPECTOR_SECRET_STORE=memory`、`MCP_STORAGE_DIR`・`MCP_CATALOG_PATH`・npm cacheをその領域へ限定する。既存のInspector設定や実資格は読ませない。

公式Repository Rootを起点に、Inspector CLIで既存stdio入口のTool一覧だけを確認する。外部配信から導入する場合は固定版と依存を確認し、インストール時スクリプトを無効にする。

```text
npm exec --ignore-scripts --yes --package @modelcontextprotocol/inspector@2.16.0 -- mcp-inspector --cli --protocol-era modern --method tools/list --strict --format json -- node template/tools/crdd-server.ts --mcp-stdio
```
