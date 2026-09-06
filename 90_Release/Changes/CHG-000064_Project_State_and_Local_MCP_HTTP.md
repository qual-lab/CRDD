# 変更トレース: Project状態参照とローカルMCP HTTP

変更ID: `CHG-000064`
状態: `Ready for Independent Review`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `feature`
最終更新日: 2026-09-06

## 1. 結論と現在状態

Project Runtimeが所有する現在状態を、正本変更や実行権限を伴わない読み取り専用結果として取得し、MCP stdioと同じ公開アプリケーション契約をlocalhost限定のMCP Streamable HTTPへ搬送する。

状態参照はProject RuntimeのState Portから`readState`だけを受け取り、Task、判断、Authority、成功、進捗率または正本変更を生成しない。状態の不存在と観測不能、要求したRepository改訂版と保存状態の不一致を区別する。MCPは同じcanonical結果を閉じたtool結果へ投影し、独自のProject状態を所有しない。

HTTPはMCP 2026-07-28のstatelessなPOST単位Transportとして実装する。IPv4 localhostだけへbindし、Bearer認証、Origin確認、Protocol／Method／Nameのmirror header照合、UTF-8と容量上限、切断時の取消伝播および終了時の進行要求joinを要求する。旧版のGET stream、Transport Session IDまたはLAN／Internet公開互換を追加しない。

固定改訂版`ce7c4d3073099926b3302eb9aa8e2c03d18aa699`で、公開Runtimeが作成した受入済みProject Stateを状態参照ApplicationからMCP Adapterへ渡し、`observed`、受入済みMilestoneおよび`no_effect`を同じ閉じた結果として確認した。別の総合試験では`template/tools/crdd-mcp.ts`のstdio／localhost HTTP公開Process、認証済み状態参照、拒否、切断取消および終了joinを確認した。公開RuntimeからTransportまでの全層を単一試験Fixtureへ偽装統合せず、実状態の意味縦断と実Process Transportの縦断を相補的な根拠として扱う。

## 2. 人間が決定した範囲

- v0.20でProject Stateの読み取り専用投影とlocalhost MCP Streamable HTTPを実装する。
- Project Runtimeが公開契約を所有し、MCPはTransportとMCP Envelopeだけを所有する。
- stdioとHTTPは同じObjective、Decision、Project State操作へ到達する。
- HTTPはlocalhostに限定し、Linux／Remote Runtime、複数Repositoryおよび外部公開を本変更へ含めない。
- 性能試験、長時間試験および実Provider試験は、人間の明示指示なしに実行しない。

## 3. 目指さないこと

- WBS、Topic、Risk、Forecast、手入力進捗率またはProject Management正本を作ること。
- Project State、HTTP connection、MCP metadataまたはBearer tokenからProject Authorityを生成すること。
- v0.19以前のMCP SessionやGET streamを互換実装すること。
- 状態不存在、観測不能、Recovery要求またはRepository改訂版不一致を成功へ補正すること。
- Tokenをログ、MCP結果、実行知またはRepository管理ファイルへ保存すること。

## 4. 設計と実装境界

- [Project Runtimeアーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md): 状態参照要求、canonical投影、read-only ApplicationおよびState Port境界。
- [MCP Transportアーキテクチャ](../../06_Architecture/mcp/01_Architecture.md): 3つのtool、stdio／HTTP共通Adapter、localhost、認証、header相関、取消および資源回収。
- [状態参照公開契約](../../40_Develop/project-runtime/src/public-contract/project-state-query.ts): 閉じた要求・結果と投影のtrust-boundary検証。
- [状態参照Application](../../40_Develop/project-runtime/src/application/project-runtime-state-query.ts): `readState`だけを受け取る非Effect処理。
- [MCP Adapter](../../40_Develop/mcp/src/adapters/project-runtime-adapter.ts): 同じcanonical操作のMCP投影。
- [Streamable HTTP Transport](../../40_Develop/mcp/src/transports/streamable-http-transport.ts): 2026-07-28 HTTP binding。
- [MCP公開Launcher](../../template/tools/crdd-mcp.ts): MCP Transportと公開Adapterを結合する利用者向け構成Root。
- [Coordinator公開Adapter](../../40_Develop/coordinator/src/composition/project-runtime-public-adapter.ts): Repository Root、改訂版、選択利用者およびPersistence Adapterを、内部Pathを公開せずMCP構成Rootへ提供する。

## 5. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | 認証済み主体が現行Repository改訂版のProjectを取得 | canonicalな現在投影を返し、Effectを発行しない |
| 準正常 | Project Stateが存在しない | `absent`を正常な観測として返し、未開始や成功を推定しない |
| 準正常 | 状態Storeを観測できない | `unknown`と既存Recovery要否を返し、空状態へ畳まない |
| 異常 | 保存状態と要求Repository改訂版が異なる | 現在値として公開せずEffect 0で停止する |
| 異常 | HTTP認証、Originまたはmirror headerが不正 | Applicationを呼ばずHTTP／JSON-RPC errorを返す |
| 異常 | payload過大、不正UTF-8、重複JSON keyまたは未知field | 意味処理前に拒否する |
| 異常 | response完了前にClientが切断 | 対象要求へ取消を伝播し、成功やcleanup完了を捏造しない |
| 異常 | Server終了時に要求が進行中、または終了中にsignalが重複 | 最初のsignalで取消を要求し、signal listenerを保持したまま全要求をjoinする。終了結果がsettleした後にだけlistenerを解除し、失敗を資源回収完了へ変えない |

## 6. 検証と完成条件

- Project Runtime単体試験で、正常、不存在、観測不能、改訂版不一致、未知fieldおよび投影相関を確認する。
- MCP Adapter試験で3 toolの閉Schema、認証先行、canonical結果保持および不正結果拒否を確認する。
- HTTP結合試験でlocalhost bind、Bearer、Origin、必須header、容量・UTF-8、切断取消、Server終了時join、実行中Applicationと重複signalを含む公開Launcherのlistener所有、およびstdioとの意味一致を確認する。
- Coordinator公開Adapterの結合試験とMCP公開Launcherの総合試験で、現行Repositoryと選択利用者へ結合した状態参照を確認する。
- Project RuntimeからMCP／Coordinatorへの逆依存0、MCPからCoordinator内部Pathへの依存0を維持する。
- 独立レビュー、全体Checkerおよび対象回帰が成功するまで完成と表示しない。

正式候補ではRuntime Execution Identityの変更として署名と影響する正式E2Eを行う。開発中の確認から実Provider、署名、性能試験または長時間試験を自動発火しない。
