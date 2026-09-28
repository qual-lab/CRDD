# Topic／Meeting Workbench・MCP CRUD検証

実行日時: 2026-09-27 20:55 JST

## 結論

Topic／MeetingのRepository CRUDを共通Application契約へ接続し、WorkbenchとRepository単体MCPが同じ一覧・取得・登録・編集・削除規則を利用することを確認した。

## 成立した範囲

| 観点 | 結果 |
|---|---|
| 一覧 | ID昇順、既定20件、最大100件、安定ID Cursor |
| 取得 | 検証済みRecordとCanonical Markdown |
| 登録・編集 | 固定Markdown検証、期待Revision、次Revision |
| 削除 | 誤登録理由、期待Revision、Relation影響0件、明示確認 |
| Workbench | localhost Token付きFormから共通Applicationを利用 |
| MCP | Topic／Meeting各5 Toolが共通Applicationを利用 |

## 検証結果

| Package | 結果 |
|---|---|
| `project-operation` | 10件成功、失敗0件 |
| `mcp` | 39件成功、失敗0件 |
| `workbench` | 9件成功、失敗0件 |

## 未成立

- Meeting OutcomeのTopic／CHG／Ownerへの移管操作
- Cross-Repository Owner Relation操作
- Remote CROS経由の書込み対象Repository RoutingとAuthority

## Checklist

- [x] MCPとWorkbenchで別のCRUD規則を作っていない
- [x] Cursor Paginationを共通Applicationに置いた
- [x] Relation付き削除をEffect 0で拒否する
- [x] Remote CROS書込みを未成立のまま公開していない
