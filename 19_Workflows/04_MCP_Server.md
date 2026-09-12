# MCP Serverの利用手順

状態: Stable（v0.20.1）
担当責任者: Qual-Lab

## 目的と責務

本書は、CRDD配布物に含まれるMCP Serverをstdioまたはlocalhost HTTPで起動する反復手順を所有する。Protocol、Transport lifecycle、認証、Authorityおよび完成条件は[MCP Transportアーキテクチャ](../06_Architecture/mcp/01_Architecture.md)が所有し、本書で再定義しない。

MCPはCoordinatorのsubcommandではない。Project RuntimeやPlatform Accessには独立した利用者向けProcess入口がないため、MCPと同じ形のWorkflowを機械的に追加しない。

## 公開入口

| 利用目的 | 公開入口 | 境界 |
|---|---|---|
| MCP stdio | `node 00_CRDD/template/tools/crdd-mcp.ts --stdio` | Clientと一つの標準入出力sessionを構成する |
| localhost HTTP | `node 00_CRDD/template/tools/crdd-mcp.ts --http --port <port>` | `127.0.0.1`だけへbindする。LAN／InternetまたはRemote接続を意味しない |

採用Repositoryでは、公式Release tagへ固定した完全な`00_CRDD` cloneまたはsubmoduleから公開入口を起動する。CRDD公式Repository内の開発確認では、同じ相対位置の`template/tools/crdd-mcp.ts`を使用する。内部packageの`bin`、内部moduleまたはCoordinator CLIからMCP入口を推測しない。

## 実行前と終了後

| 時点 | 確認 |
|---|---|
| 実行前 | Node、配布Identity、Repository Binding、外部送信Policy、認証情報および対象portの成立 |
| 実行中 | request identity、認証、Origin、容量、切断、取消および閉じた結果 |
| 終了時 | listener、socket、受信途中Request、実行中Applicationおよび取消処理のjoin |
| 観測不能 | 成功や不存在へ補正せず、MCP結果またはRuntimeのRecovery契約に従う |

直接端末の終了、stdio EOFまたはHTTP切断だけをTask終了と扱わない。Server再接続は新しいTransport lifecycleであり、前の接続が持つAuthorityや未確定結果を暗黙継承しない。

## 開発確認

MCP packageの型、Lint、Formatおよび試験は`40_Develop/mcp`の`package.json`が所有する入口から実行する。公開入口からProject Runtimeまでの総合確認、実Provider、正式署名またはRelease判断を、package単体試験の成功から推定しない。実行対象と必要な試験は[検証設計](../07_Quality/03_Verification_Design.md)と[試験カタログ](../07_Quality/04_Test_Catalog.json)から選ぶ。
