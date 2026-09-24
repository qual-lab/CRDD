# CHG-000026／027 Gap／Impact＋Conformance Audit

- 固定対象Commit: `5057d8ba66d3a10d7816059d89211dd3b312894a`
- 固定対象Tree: `bc0d0e80e2c175484817c137d13a6b370c47f509`
- Parent: `1d89434e998005abdd4e0952252f1c37c5c5b80f`
- 53 Gap／Impact Audit: `Pass`／Finding `0`
- 52 Conformance Audit: `Pass`／Finding `0`
- 変更scope claim eligibility: `Eligible`

## 確認結果

- `GCI-HOME-001`～`003`は、説明、品質来歴、runtime Identityおよび新固定根拠への伝播が成立し、解消条件を維持する。
- `GCI-HOME-004`は、spawn同期、scenario別上限、終了要求exact 1回、close、Dynamic coverageおよびparallel反復により`Resolved`である。
- `GCI-HOME-005`は、directory entry名・種別の前後完全一致、Identity／realpath／handle条件、追加・削除・型変更試験およびserial反復により`Resolved`である。
- CHG26のprivate breaking migrationはRepository内producer／consumer全数処置、旧aliasなし、supported production state 0および新固定検証により`Met`である。CRDD基準版の移行完了要件は`Out of Scope / Not Applicable`である。
- package inventory、cancellation fixture、品質生成器、private migration、監査履歴、公開面およびRelease境界の契約母集団と利用側母集団を全数確認した。新規候補4分類は全区分0件である。

## 品質根拠と限定

Provider Home coverageはNode `v24.19.0`／下限`24.12.0`、exact 7 source／7 test、lines `2045 / 2240`、functions `82 / 89`、branches `403 / 491`、未到達88件、payload SHA-256 `fef274a509cbfc3354dd54a193fb9e8d07ce528229b72f4568bd6eb45b470920`、stdout 62,399 byte／SHA-256 `6eec9cf410e1672454e744d1fba95b45ee468cd6d55ec8993f49a5044ea5b49c`、stderr 0である。source closureは`5 / 5`、Coordinator production 66、test 60、Checker／template 5、Rust 4、unique total 134である。

実Windows Home作成・ACL、実Release packageへの敵対的同時変更、実Docker取消、実Provider／OAuth／Egress、Authority／Capability、Gate open、統合、StableおよびReleaseは未評価である。`Eligible`はCHG26／27変更scopeの適格性に限り、これらの成立を意味しない。水平探索にサンプリングはなく、現在の追加人間判断はない。
