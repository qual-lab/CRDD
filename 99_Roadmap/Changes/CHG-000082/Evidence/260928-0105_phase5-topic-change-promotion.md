# Phase 5 — TopicからCHGへの昇格接続

## 結論

Topic Detailから、同一Repository内に既に存在する採用済みCHGへTopicを昇格接続できるようにした。WorkbenchとMCPは同じProject Operation Applicationを使用し、CHG新規作成や採用Authorityを生成しない。

## 処理境界

```text
Human／AI
  │ Topic ID、期待改訂、既存CHG ID、採用理由、残る責務
  ▼
Project Operation Application
  ├ CHG固定Pathの実在確認
  ├ Topic期待改訂の確認
  └ Topic Canonical次版の生成
        ├ 状態 = promoted
        ├ 改訂 +1
        ├ CHG Relation
        └ 終了・昇格表
```

- CHGが存在しない場合はFilesystem Effect 0で拒否する。
- Topicが`open`または`waiting`でない場合は拒否する。
- CHG本文をTopicへ複製しない。
- CHGの新規作成、採用判断、Cross-Repository書込みをこの操作へ含めない。
- WorkbenchとMCPの両入口で同じApplication結果を返す。

## 検証

| 対象 | 結果 |
|---|---|
| Project Operation format／typecheck／lint | Pass |
| Project Operation integration | 18 / 18 Pass |
| MCP format／typecheck／lint | Pass |
| MCP unit／integration／system | 41 / 41 Pass |
| Workbench format／typecheck／lint | Pass |
| Workbench integration | 16 / 16 Pass |

## 画面判定

Topic Detailは独立Navigation、現在状態・経緯・Relationの表示、更新、確認付き削除、Relation遷移および実在CHGへの昇格接続が成立したためCoveredへ更新する。現在の15画面Reality AuditはCovered 12、Partial 3、Missing 0である。
