# Phase 5 — Topic／Meeting Relation遷移

## 結論

Topic／Meeting Detailから、同一Repository内で実在を確認したTopic、MeetingおよびCHG正本へ遷移できるようにした。欠落Relationはリンクへ変換せず、参照先がない状態として表示する。

## 成立した境界

```text
Topic／Meeting Canonical Markdown
        ↓ 安定ID抽出
Project Operation Application
        ↓ 同一Repository内の存在確認
┌──────────┬──────────┬──────────┐
│ Topic    │ Meeting  │ CHG      │
│ Detail   │ Detail   │ 固定Path │
└──────────┴──────────┴──────────┘

欠落Relation
        ↓
参照先なし。リンク生成0
```

- Relation対象は`TOPIC-xxxxxx`、`MTG-xxxxxx`、`CHG-xxxxxx`の安定IDに限定した。
- Topic／MeetingはProject Operation Repositoryから存在を確認する。
- CHGは`99_Roadmap/Changes/<CHG-ID>/change.md`の固定Pathだけを検証して読む。
- Browser入力から任意Filesystem Pathを受けない。
- Cross-Repository Relationや書込みAuthorityを、この読取り遷移から生成しない。

## 検証

| 対象 | 結果 |
|---|---|
| Project Operation format／typecheck／lint | Pass |
| Project Operation integration | 17 / 17 Pass |
| Workbench format／typecheck／lint | Pass |
| Workbench integration | 16 / 16 Pass |
| 欠落Relationの非リンク表示 | Pass |
| CHG固定Path外への入力 | 受付けない |

## 残る範囲

Meeting Detailは独立NavigationとRelation遷移まで成立したためCoveredへ更新する。Topic DetailはOwner Artifactへの昇格Commandが未成立であり、Cross-Repository Owner Relation操作も残る。現在の15画面Reality AuditはCovered 11、Partial 4、Missing 0とする。
