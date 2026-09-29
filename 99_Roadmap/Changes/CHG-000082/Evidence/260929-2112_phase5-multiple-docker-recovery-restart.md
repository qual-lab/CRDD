# Phase 5 複数Docker Recoveryの検証付き再起動

## 結論

署名実境界の再開中に、同じRuntime Stateへ2件のDocker Task Recoveryが残ると、検証付き再起動が件数競合で停止し、どちらのRecoveryも正式経路から収束できない循環を確認した。

既存のRecovery ID、耐久記録および保持Evidenceは削除・改名せず、再起動前に現在の全Recovery Scopeを停止確認したうえで、選択したexact Recoveryを1件ずつ処置できる契約へ是正した。現時点では局所契約と結合回帰が成立しており、署名済み実環境での2件収束は未確認である。

## 観測と原因

| 項目 | 結果 |
|---|---|
| Docker Desktop修復履歴 | 未終了の旧履歴を正規採用し、保持Evidenceを削除せず終了済みへ閉じた |
| Docker Task Recovery Inventory | 異なるexact Recovery IDを2件観測した |
| 通常Recovery | create結果不明のため、再起動境界なしでは安全に収束不能 |
| 検証付き再起動 | Inventoryがexact 1件であることを要求し、2件ではHost Effect前に`docker_restart_scope_conflict`で停止した |
| 本質原因 | 複数件を安全に列挙する観測は存在したが、全Scopeを固定して1件ずつ収束させるAuthority経路がなかった |

件数競合を単に許可すると、別Taskが稼働中でもDocker Desktop全体を再起動できる。そこで件数条件だけを緩めず、現在Inventoryに属する全Host世代、全論理HomeおよびRuntime Stateの停止確認を再起動Authorityへ追加した。

## 是正した契約

```text
現在のRecovery Inventory
        ↓
全Recovery IDを閉集合として固定
        ↓
全Host世代を決定順でLock
        ↓
全論理Homeを決定順でLock
        ↓
Runtime StateをLock
        ↓
Inventory／Host／Home／Rootをfresh再確認
        ↓
選択したexact Recoveryへ再起動記録を結合
        ↓
再起動後、選択したRecoveryだけを回復
        ↓
残るRecoveryは独立した次の回復として処置
```

未選択Recoveryの記録、Identityおよび義務は変更しない。Inventoryの追加、欠落、置換、Host／Home Identity差、Lock競合または観測不能ではHost Effect 0で停止する。

## 局所確認

| 確認 | 結果 |
|---|---|
| TypeScript型検査 | Pass |
| Lint | 681ファイル、警告・エラー0 |
| 再起動準備専用契約 | 5件中5件Pass |
| Docker Recovery結合回帰 | 115件中115件Pass |
| Coordinator全Portable回帰 | 2,118件中2,113件Pass、失敗0、Host限定5件Skip |
| 複数ScopeのLock順 | Host全件→Home全件→Runtime Stateを確認 |
| 準備中のInventory変化 | 再検証で拒否 |
| 別Recoveryが残る再入場 | 対象Recoveryのrestart chainだけを受理し、未選択RecoveryをInventoryへ保持 |

## 未完了

- 更新Source Commitを固定しCoordinator Runtimeを再署名する
- 現在保持されている2件のRecoveryを、署名済み公開入口から1件ずつ収束させる
- Docker Task Recovery Inventoryが空であることをfreshに確認する
- 修正後の実Provider E2E、必要な四経路E2Eおよび独立レビューを完了する

## Checklist

- [x] 既存Recovery IDとEvidenceを削除・改名していない
- [x] 複数件を許可する前に全Scopeの非稼働を確認する契約を追加した
- [x] Lock順を決定的にした
- [x] Inventory変化とIdentity差をHost Effect前に拒否した
- [x] 未選択Recoveryを完了または不存在へ畳んでいない
- [x] 局所契約と関連結合回帰を確認した
- [x] Coordinator全Portable回帰で既存Capabilityの破損がないことを確認した
- [ ] 署名済み実環境で2件を順次収束させた
