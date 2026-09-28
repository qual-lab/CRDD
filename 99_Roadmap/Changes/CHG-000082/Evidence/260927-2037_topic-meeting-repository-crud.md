# Topic／Meeting Repository CRUD検証記録

## 結論

TopicとMeetingの登録、編集、一覧、取得および物理削除を、一つのProject Operation Repository契約として実装した。正当な履歴の削除には使わず、誤登録理由、期待改訂、Relation解消および人間の明示確認が揃った場合だけ対象一件を削除する。

## 成立した範囲

| 操作 | 結果 | 保持した境界 |
|---|---|---|
| 登録 | PASS | Revision 1の検証済みMarkdownだけを固定Pathへ作成 |
| 編集 | PASS | 同じID・Project IDと次Revisionだけを置換 |
| 一覧／取得 | PASS | Directory未使用を`not_configured`、存在しないItemをnullで区別 |
| 競合 | PASS | Lockまたは期待Revision不一致をEffect 0で拒否 |
| 削除影響確認 | PASS | Repository内Markdownの参照Pathを削除前に列挙 |
| 物理削除 | PASS | Relation 0、誤登録理由、明示確認の全条件成立時だけ対象一件を削除 |

## 実行結果

```text
対象: 40_Develop/project-operation
実行: npm.cmd test
結果: 9 passed / 0 failed

内訳:
- format: PASS
- typecheck: PASS
- lint: PASS
- Topic／Meeting Reader: PASS
- Repository CRUD／競合／削除境界: PASS
```

## 残る範囲

- WorkbenchとMCPのCommand Surfaceは未接続である。
- Meeting OutcomeをTopic、CHGまたはOwner Artifactへ移管する個別操作は未実装である。
- 別RepositoryからのRelation影響確認はCROS Repository Router接続時に扱う。現在の削除は一つの検証済みRepository Root内で完結する。

## Checklist

- [x] TopicとMeetingで入口固有の正本を作っていない
- [x] 期待Revision不一致を上書きしていない
- [x] 一時FileをCanonical Recordとして残していない
- [x] Relation付きRecordを削除していない
- [x] 確認なしの物理削除を行っていない
- [x] 対象以外を連鎖削除していない
- [ ] OPEN: Workbench／MCP CommandとOutcome移管は後続Sliceで接続する
