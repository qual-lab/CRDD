# Phase 5 — Repository間Owner Relation

検証日時: 2026-09-28 03:05 JST
対象変更: `CHG-000082`

## 結論

Remote CROSのTopic／Meeting取得で、Relation対象を現在Credentialから解決した同一Logical Projectの許可済みRepository集合だけから探索し、一意なOwner Repositoryへ戻れる読取り境界を成立させた。Relation先本文の複製、Grant外Repositoryの存在開示および別Repository書込みAuthorityの生成は行わない。

```text
Source Topic／Meeting
      ↓ 安定ID Relation
同一Session＋Exposure Snapshot
      ↓ 同一Logical Projectだけ
許可済みRepository Applications
      ├─ 1件 → available + ownerRepositoryId
      ├─ 0件 → unavailable
      └─ 複数 → conflicting
```

## 成立した境界

- Repository単体Applicationは、Topic／Meeting／CHGのRelation対象存在確認を同じ公開契約で提供する。
- CROS Composition Rootだけが複数Repositoryの許可集合を合成する。
- Source RepositoryへのCRUD、Outcome処置およびTopic昇格のEffect契約は変更しない。
- `unavailable`から、非開示Repositoryに対象が存在するかを判断しない。
- 同じIdentityが複数の許可Repositoryで見つかった場合は`conflicting`とし、任意のOwnerを選ばない。
- Remote MCPのTopic／Meeting取得結果にRelation状態とOwner Repositoryを含める。

## 検証結果

| 検証 | 結果 |
|---|---|
| Project Operation format／typecheck／lint | Pass |
| Project Operation全試験 | 18件Pass |
| MCP format／typecheck／lint | Pass |
| MCP全試験 | 43件Pass |
| DEV TopicからMGMT TopicへのRelation | `available`、`ownerRepositoryId=REPO-MGMT` |
| Relation先本文のDEVへの複製 | 0件 |
| 外部Provider Effect | 0 |

## 残る境界

- WorkbenchのRemote接続面からTopic／Meeting詳細を直接操作する場合は、同じRemote MCP Application契約をConsumerとして接続する必要がある。
- Shared Serverの外部公開にはTLS配置と運用設定入口が必要である。

## Checklist

- [x] Owner Repositoryを一意に解決した
- [x] 許可済みRepository集合だけを探索した
- [x] 不在と非開示を推測で分離していない
- [x] 重複Identityを任意Ownerへ畳んでいない
- [x] Relation先本文を複製していない
- [x] Relationから書込みAuthorityを生成していない
