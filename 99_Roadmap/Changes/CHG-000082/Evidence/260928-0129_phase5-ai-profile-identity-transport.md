# Phase 5 — AI Profile Identity搬送

## 結論

Workbenchで選択するProfile IDを、Coordinator Task Request、Route Candidate、Executor Selection Grantまでexactに保持する契約を追加した。明示IDが未知、形式不正、Provider／Role／Tier不一致、またはResolverが別Profileを返す場合はProvider Effect前に拒否する。独立ReviewerはExecutorのProfile指定を継承しない。

## 成立した境界

```text
Workbench Profile選択
  │ profileId
  ▼
Workbench AI Request Port
  │ Production Adapterは未接続
  ▼
Coordinator Task Request
  │ requestedProfileId
  ▼
Route Candidate
  │ exact identity
  ▼
Executor Selection Grant

Independent Reviewer
  └ requestedProfileId = null
```

- 従来のProfile自動選択入力は互換形として維持した。
- 明示ProfileはCatalog内のIdentityから解決し、Familyの自動選択条件へ暗黙に戻さない。
- Profile選択だけではProvider Authorityまたは外部送信Authorityを発行しない。
- WorkbenchとCoordinatorを結ぶProduction Adapterおよび実Provider実行はこの時点では未成立である。

## 検証

| 対象 | 結果 |
|---|---|
| Profile Resolver／Route／Selection Grant局所契約 | 30 / 30 Pass |
| Coordinator Task Runtime | 158 / 158 Pass |
| Coordinator format／typecheck／lint | Pass |
| Runtime Capability Graph | Pass |
| Runtime Traceability | Pass |
| Project Runtime Design Traceability | Pass |

## 残るGap

Owner別の採用済みCatalog SnapshotとWorkbench AI Request Portを、署名済みCoordinator公開実行境界へ結ぶProduction Adapterが必要である。Adapter成立前に、一覧表示またはProfile選択を実Provider実行可能と表示しない。
