# CHG-000021 Gap／Impact＋Conformance Audit

- 固定対象Commit: `d88a4c56d6d2f2f0e2ab06d64e16ca808dce7b71`
- 固定対象Tree: `31926d02ae27f230b54beeec9152c6cb4f55c8a6`
- Parent: `10d2f377874e327e536f31c219a5077098fdc899`
- Gap／Impact結果: `Pass`、Finding `0`
- Conformance結果: `Pass`、Finding `0`

## 確認結果

- `GCI-21-001`〜`003`、`GCI-21-R2-001`および`GCI-21-R3-001`は解消し、ASR／DOC同根を含む契約母集団と利用側母集団に未伝播または新規gapはない。
- 有効ポインター、Effect／Release投影、local-user方針とcurrent-token観測、将来binder、TypeScript／Rust字句境界、README／脅威モデルおよびCHGは一意に接続される。
- PL-16はexact 19 source／18 test、lines `6279 / 7071`、functions `225 / 244`、branches `964 / 1204`、未到達240 branchの理由、risk、代替確認、Ownerおよび再確認契機を保持し、`Conformant`である。
- Rust coverageはregions `1035 / 1143`、functions `43 / 44`、lines `663 / 725`、branches `0 / 0` `Not Available`であり、0/0を100%へ換算しない。
- C-04、C-07、C-11、PL-08、PL-16およびPL-19を含む影響基準は`Conformant`であり、公開Checker／CLI／Schema／wire／採用Repositoryに影響はない。
- 新規候補4分類は全分類0件である。

## 機械入力と未評価

Coordinator `343 / 343`、Checker `151 / 151`、TypeScript owned source `120`／Rust source `4`、TypeScript coverage、Rust `8 / 8`、Rust coverage、両package／Rust checks、full checker Error `0`／Warning `0`、diff／worktree cleanを共通入力として使用した。準拠claimは、v0.18 Candidate、production bindingおよびGateが未成立で、Released Baselineがv0.17.0のため`Not Eligible`であり、これは基準不適合を意味しない。実管理者provision、本番鍵／Release handoff、native durable store、DACL Effect、selected-user binder、protected reader、検証済み実行イメージ、bounded process、別Windows環境およびRelease判断は未評価である。
