# CHG-000020 Gap／Impact＋Conformance Audit

- 固定対象Commit: `6690d34436b0f3c6421ab47333e60ab429075265`
- 固定対象Tree: `6fc7f90765cdcd6be115909183e8a1860726f7bf`
- Parent: `aad8572376d8252693f4b30d8013a2eede04ef36`
- Gap／Impact結果: `Pass`、Finding `0`
- Conformance結果: `Pass`、Finding `0`

## 確認結果

- `GCI-20-001`〜`004`、`GCI-20-R2-001`および`GCI-20-R3-001`／`002`は解消し、ASR／DOC同根を含む契約母集団と利用側母集団に未伝播または新規gapはない。
- 読み取り専用成果物観測、専用Release staging配置module、固定署名入口、manifest／Trust／Release Identity、固定停止Adapter、doctor／Runtime投影、coverage、README／脅威モデルおよびCHGは一意に接続される。
- PL-16はexact 14 source／13 test、lines `5342 / 6104`、functions `189 / 207`、branches `821 / 1039`、全未到達branchの理由、risk、代替確認、Ownerおよび再確認契機を保持し、`Conformant`である。
- C-04、C-07、C-11およびPL-19を含む影響基準は`Conformant`であり、公開CLI／Schema／wire／採用Repositoryに影響はない。
- 公式Release build／stagingだけのbreaking migration、v0.17.0への復旧、v0.18 Candidateおよび非Release境界を維持する。
- 新規候補4分類は全分類0件である。

## 機械入力と未評価

Coordinator `352 / 352`、Checker `151 / 151`、TypeScript owned source `127`／Rust source `4`、TypeScript coverage、Rust `7 / 7`、Rust coverage regions `817 / 907`・functions `36 / 37`・lines `538 / 590`・branches `0 / 0` `Not Available`、両package／Rust checks、full checker Error `0`／Warning `0`、diff／worktree cleanを共通入力として使用した。準拠claimは、v0.18 Candidate、CHG検証段階、最終Release Identityおよび人間の採用／統合／Release判断が未成立のため`Not Eligible`であり、これは基準不適合を意味しない。本番署名、実Release staging、保護済み有効世代、検証済み実行イメージ、production process、DACL／POSIX／実Windows FFIおよびRelease判断は未評価である。
