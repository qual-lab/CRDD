# MCP Serverの利用手順

状態: Stable（v0.21.0）
担当責任者: Qual-Lab

## 目的と責務

本書は、CRDD配布物に含まれるMCP Serverをstdioまたはlocalhost HTTPで起動する反復手順を所有する。Protocol、Transport lifecycle、認証、Authorityおよび完成条件は[MCP Transportアーキテクチャ](../06_Architecture/Details/mcp/01_Architecture.md)が所有し、本書で再定義しない。

MCPはCoordinatorのsubcommandではない。Project RuntimeやPlatform Accessには独立した利用者向けProcess入口がないため、MCPと同じ形のWorkflowを機械的に追加しない。

## 公開入口

| 利用目的 | 公開入口 | 境界 |
|---|---|---|
| MCP stdio | `node 00_CRDD/template/tools/crdd-mcp.ts --stdio` | Clientと一つの標準入出力sessionを構成する |
| localhost HTTP | `node 00_CRDD/template/tools/crdd-mcp.ts --http --port <port>` | `127.0.0.1`だけへbindする。LAN／InternetまたはRemote接続を意味しない |

採用Repositoryでは、公式Release tagへ固定した完全な`00_CRDD` cloneまたはsubmoduleから公開入口を起動する。CRDD公式Repository内の開発確認では、同じ相対位置の`template/tools/crdd-mcp.ts`を使用する。内部packageの`bin`、内部moduleまたはCoordinator CLIからMCP入口を推測しない。

## CROS Shared ServerのHost設定

Shared ServerはRepository単体の設定を使わず、OS管理のCROS設定Rootにある固定名`shared-server.json`を読む。配置Rootと認可契約は[CROS設計](../06_Architecture/Details/cros/01_Architecture.md)および[Runtime Data設計](../06_Architecture/Details/runtime-data/01_Architecture.md#6-crosとの物理分離)を参照する。

設定形式は、独立した[CROS Shared Server設定例](../template/tools/cros-shared-server-config-example.json)を参照する。例はGit管理する配布物であり、Runtimeが直接読み込む実設定ではない。本書に同じJSONを重複保持しない。

実設定はHost管理者が対象Root、公開Origin、TLS終端および公開範囲を確認して作成する。Bearer Tokenや秘密をこのJSONへ含めない。例の値を実設定や起動許可として自動採用しない。Runtimeが読むPathや形式は変更しない。

## 実行前と終了後

| 時点 | 確認 |
|---|---|
| 実行前 | Node、配布Identity、Repository Binding、外部送信Policy、認証情報および対象portの成立 |
| 実行中 | request identity、認証、Origin、容量、切断、取消および閉じた結果 |
| 終了時 | listener、socket、受信途中Request、実行中Applicationおよび取消処理のjoin |
| 観測不能 | 成功や不存在へ補正せず、MCP結果またはRuntimeのRecovery契約に従う |

直接端末の終了、stdio EOFまたはHTTP切断だけをTask終了と扱わない。Server再接続は新しいTransport lifecycleであり、前の接続が持つAuthorityや未確定結果を暗黙継承しない。

## 開発確認

MCP packageの型、Lint、Formatおよび試験は`40_Develop/mcp-server`の`package.json`が所有する入口から実行する。公開入口からProject Runtimeまでの総合確認、実Provider、正式署名またはRelease判断を、package単体試験の成功から推定しない。実行対象と必要な試験は[検証設計](../07_Quality/03_Verification_Design.md)と[試験カタログ](../07_Quality/Registry/test-catalog.json)から選ぶ。
