# Meeting Outcome処置の共通接続検証

## 結論

Meeting Outcomeの完了・Topic移管・CHG昇格・理由付き不採用を、Project Operationの共通ApplicationからRepository単体MCPとWorkbenchへ接続した。Outcome表、Actionと移管表、Close判定、未処置Outcome、状態および改訂は一つの次版として更新され、pending Outcomeが残るClose、対象不存在、Project不一致および改訂競合ではFilesystem Effectを発行しない。

## 検証結果

| 対象 | 結果 | 観測 |
|---|---|---|
| Project Operation | Pass | 12件成功。Topic移管、CHG昇格、対象不存在、未処理Outcome Close拒否を確認 |
| MCP | Pass | 40件成功。`crdd.treat_meeting_outcome`が共通Applicationを使用 |
| Workbench | Pass | 10件成功。Outcome処置FormからClose後の`closed`／`pending 0`を再観測 |

## 境界

- 同一Repository内のTopicとCHGは実在確認後に接続する。
- 責任主体／所有正本への移管は明示参照を保持するが、別RepositoryへEffectを発行しない。
- Remote CROS経由の書込みおよびCross-Repository Owner Relationは、対象RepositoryのAuthorityとRoutingが成立するまで公開しない。
