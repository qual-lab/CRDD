# CHG-000015 Agent／Architecture／Security Review

- 固定対象Commit: `36be2f39c453cbad90031288232b0b38db3ed95c`
- 固定対象Tree: `8831df1aa7306aaf91049c8e7f4f26e706ffbc24`
- 親Commit: `b6ed005c2cf862bd2e3a19c6134d1ec470f4369a`
- 共通入力: Coordinator `191 / 191 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0` / Warning `0`、diff／worktree clean
- 結果: `Pass`
- Finding: `0`
- 確信度: `High`

## 確認結果

`AG-ONBOARDING-001`および同根`DOC-ONBOARDING-001`は解消した。`reverificationTriggers`は変化検知時に必ずfail-closed再確認を開始する入口、`reprovisionConditions`は再確認後に再Provisionが必要と確定する条件へ分離された。Authority Root Identity不一致は将来の検証済みProvisioning記録に対する不一致に限定され、caller claimまたは単なるPath差を根拠にしない。Provisioning記録検証とresolverは未実装のため、現在この条件を観測済みまたは成立済みとしない。

公開contractが単一ownerであり、doctorは直接投影する。contract試験とdoctor試験は二段階behavior、3 triggerおよび3 conditionを完全一致で固定する。README、Threat ModelおよびCHGも「検知、fail-closed再確認、確定条件成立時だけ再Provision案内、自動修復なし」の順序で一致する。無効Repositoryの非発火、現行Authority Root明示Path、専用Provisionerの将来Effect所有、Provisioner／receipt／resolver／Root／activation Effect未実装、Capability未発行、Provider／Operation非発火およびGate `blocked`を維持する。

## 水平探索と未評価

親差分6ファイルと直接利用側を全数確認し、旧`reprovisionTriggers`および旧behavior値の現行残存はない。旧`b6ed005`監査集合は履歴と解消条件にだけ用い、合否へ流用していない。新規候補4分類はすべて`0`である。実Platform Provisioner、署名／Trust確認、Provisioning記録、OS別ACL／DACL、Authority Root resolver、実activation、Capability、Provider／OperationおよびReleaseは未実装または未評価である。
